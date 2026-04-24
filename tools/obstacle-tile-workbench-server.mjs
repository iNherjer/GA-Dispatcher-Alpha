#!/usr/bin/env node
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { spawn } from 'node:child_process';
import { gunzipSync, gzipSync } from 'node:zlib';
import { findRegionsForTile } from './pbf-region-registry.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Portable config: read workbench.config.json from same dir as server ---
let _cfg = {};
try {
  const cfgPath = path.join(__dirname, 'workbench.config.json');
  if (existsSync(cfgPath)) _cfg = JSON.parse(await fs.readFile(cfgPath, 'utf8'));
} catch (_) {}

// Resolve a path from config: relative paths are resolved relative to __dirname (tools/),
// NOT cwd — so the server works regardless of where it is launched from.
function resolveCfgPath(val, defaultPath) {
  if (process.env[val.envKey]) return path.resolve(process.env[val.envKey]);
  if (val.cfgVal) return path.resolve(__dirname, val.cfgVal);
  return defaultPath;
}

// repoRoot: where the git repo + obstacles/ dir live (env > config > default: parent of tools/)
const ROOT = resolveCfgPath(
  { envKey: 'OBS_WORKBENCH_REPO_ROOT', cfgVal: _cfg.repoRoot },
  path.resolve(__dirname, '..')
);

// cacheDir: where PBFs and tmp files are stored — can be on external drive
const CACHE_BASE = resolveCfgPath(
  { envKey: 'OBS_WORKBENCH_CACHE_DIR', cfgVal: _cfg.cacheDir },
  path.join(__dirname, 'workbench-cache')
);

const TOOLS_DIR = path.join(__dirname);   // tools are always next to the server file
const HTML_PATH = path.join(TOOLS_DIR, 'obstacle-tile-workbench.html');
const OBST_DIR = path.join(ROOT, 'obstacles');
const CORE_TILE_DIR = path.join(OBST_DIR, 'core-tiles');
const POI_TILE_DIR = path.join(OBST_DIR, 'poi-tiles');
const CORE_MANIFEST_PATH = path.join(OBST_DIR, 'core-manifest.v1.json');
const POI_MANIFEST_PATH = path.join(OBST_DIR, 'poi-manifest.v1.json');
const FAILED_PATH = path.join(OBST_DIR, 'failed-split-tiles.json');

const WORKBENCH_TMP_DIR = path.join(CACHE_BASE, 'obs-split');
const WORKBENCH_TMP_OUT_DIR = path.join(WORKBENCH_TMP_DIR, 'combined-tiles');
const WORKBENCH_TMP_MANIFEST = path.join(WORKBENCH_TMP_DIR, 'combined-manifest.v1.json');
const WORKBENCH_TMP_FAILED = path.join(WORKBENCH_TMP_DIR, 'combined-failed-tiles.json');
const WORKBENCH_PBF_PATH = String(process.env.OBS_WORKBENCH_PBF_PATH || '').trim();
const WORKBENCH_PBF_MAX_REGIONS = Math.max(1, Number(process.env.OBS_WORKBENCH_PBF_MAX_REGIONS || _cfg.pbfMaxRegions || 3));

const PBF_CACHE_DIR = path.join(CACHE_BASE, 'pbf');
const PBF_CACHE_TTL_MS = Number(process.env.OBS_WORKBENCH_PBF_TTL_DAYS || 7) * 24 * 60 * 60 * 1000;

const TILE_STEP_DEG = 25 / 60;
const STALE_AFTER_MS = 90 * 24 * 60 * 60 * 1000;
const PORT = Number(process.env.OBS_WORKBENCH_PORT || 8788);

const pbfDownloads = new Map(); // regionId -> { status, downloaded, total, url, name, path }
const pbfDownloadPromises = new Map(); // regionId -> Promise (dedup concurrent downloads)

const queue = [];
const queueSet = new Set();
let processing = false;
let currentTile = null;
let autoPushWhenDone = false; // set via enqueue autoPush:true
const WORKBENCH_RETRIES = Number(process.env.OBS_WORKBENCH_RETRIES || 4);
const WORKBENCH_DELAY_MS = Number(process.env.OBS_WORKBENCH_DELAY_MS || 2200);
const WORKBENCH_FAIL_COOLDOWN_MS = Number(process.env.OBS_WORKBENCH_FAIL_COOLDOWN_MS || 12000);
const WORKBENCH_504_EXTRA_COOLDOWN_MS = Number(process.env.OBS_WORKBENCH_504_EXTRA_COOLDOWN_MS || 18000);
const lastResults = new Map();
let lastRepoSync = {
  ok: false,
  checkedAt: 0,
  message: 'Noch nicht geprüft.',
  remoteRef: 'origin/main',
  remoteTileCount: 0,
  localTileCount: 0,
  missingInRepoCount: 0,
  missingLocalCount: 0,
  missingInRepoSample: [],
  missingLocalSample: [],
  missingInRepoTiles: [],
  remoteTiles: [],
  remoteCoreCount: 0,
  remotePoiCount: 0,
  localCoreCount: 0,
  localPoiCount: 0,
  localCompleteCount: 0,
  remoteCompleteCount: 0
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

function normalizeTileKey(v) {
  const s = String(v || '').trim();
  if (!/^-?\d+\|-?\d+$/.test(s)) return null;
  return s;
}

function tilePath(baseDir, tileKey) {
  const [latI, lonI] = String(tileKey).split('|');
  return path.join(baseDir, latI, `${lonI}.json`);
}

function tileGzPath(baseDir, tileKey) {
  const [latI, lonI] = String(tileKey).split('|');
  return path.join(baseDir, latI, `${lonI}.json.gz`);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

// Yields [latI, lonI] pairs for all tile files with the given suffix under baseDir.
async function* iterateTileFiles(baseDir, suffix) {
  let latDirs;
  try { latDirs = await fs.readdir(baseDir); } catch { return; }
  for (const latI of latDirs) {
    const latDir = path.join(baseDir, latI);
    let files;
    try { files = await fs.readdir(latDir); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith(suffix)) continue;
      const lonI = f.slice(0, -suffix.length);
      if (!/^\d+$/.test(lonI)) continue;
      yield [latI, lonI];
    }
  }
}

async function readJsonSafe(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

async function writeJson(filePath, obj) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(obj, null, 2), 'utf8');
}

function defaultManifest() {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    grid: { tileEdgeNm: 25, stepLatDeg: TILE_STEP_DEG, stepLonDeg: TILE_STEP_DEG },
    regions: [],
    tileCount: 0,
    tiles: []
  };
}

async function upsertManifestTile(manifestPath, tileKey) {
  const m = await readJsonSafe(manifestPath, defaultManifest());
  const tiles = new Set((Array.isArray(m.tiles) ? m.tiles : []).map(normalizeTileKey).filter(Boolean));
  tiles.add(tileKey);
  const out = {
    ...defaultManifest(),
    ...m,
    generatedAt: new Date().toISOString(),
    tileCount: tiles.size,
    tiles: Array.from(tiles).sort()
  };
  await writeJson(manifestPath, out);
}

async function removeFailedTile(tileKey) {
  const failedData = await readJsonSafe(FAILED_PATH, { generatedAt: new Date().toISOString(), failedTiles: [] });
  const failedTiles = (Array.isArray(failedData.failedTiles) ? failedData.failedTiles : [])
    .filter(item => normalizeTileKey(item && item.tile) !== tileKey);
  await writeJson(FAILED_PATH, {
    generatedAt: new Date().toISOString(),
    failed: failedTiles.length,
    failedTiles
  });
}

async function upsertFailedTile(tileKey, info = {}) {
  const failedData = await readJsonSafe(FAILED_PATH, { generatedAt: new Date().toISOString(), failedTiles: [] });
  const rows = Array.isArray(failedData.failedTiles) ? failedData.failedTiles : [];
  const keep = rows.filter(item => normalizeTileKey(item && item.tile) !== tileKey);
  keep.push({
    tile: tileKey,
    status: Number(info.status || 0),
    error: String(info.error || 'Tile-Load fehlgeschlagen'),
    server: String(info.server || ''),
    at: new Date().toISOString()
  });
  await writeJson(FAILED_PATH, {
    generatedAt: new Date().toISOString(),
    failed: keep.length,
    failedTiles: keep
  });
}

async function runCmd(bin, args, opts = {}) {
  return await new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd: opts.cwd || ROOT,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += String(d); });
    child.stderr.on('data', d => { stderr += String(d); });
    child.on('close', (code) => {
      resolve({ code: Number(code || 0), stdout, stderr });
    });
    child.on('error', (err) => {
      resolve({ code: 1, stdout, stderr: `${stderr}\n${String(err && err.message || err)}` });
    });
  });
}

async function downloadPbfRegion(region) {
  await ensureDir(PBF_CACHE_DIR);
  const targetPath = path.join(PBF_CACHE_DIR, `${region.id}.osm.pbf`);
  const tmpPath = targetPath + '.tmp';
  pbfDownloads.set(region.id, { status: 'downloading', downloaded: 0, total: 0, url: region.url, name: region.name, path: targetPath });
  try {
    const res = await fetch(region.url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status} von ${region.url}`);
    const ctype = String(res.headers.get('content-type') || '').toLowerCase();
    if (ctype.includes('text/html')) {
      throw new Error(`Ungueltiger PBF-Download (HTML statt PBF): ${region.url} -> ${String(res.url || '')}`);
    }
    const total = Number(res.headers.get('content-length') || 0);
    let downloaded = 0;
    const sniffChunks = [];
    let sniffBytes = 0;
    pbfDownloads.set(region.id, { status: 'downloading', downloaded, total, url: region.url, name: region.name, path: targetPath });
    const fileStream = createWriteStream(tmpPath);
    const progress = new Transform({
      transform(chunk, _enc, cb) {
        downloaded += chunk.length;
        if (sniffBytes < 1024) {
          const max = Math.min(chunk.length, 1024 - sniffBytes);
          if (max > 0) {
            sniffChunks.push(chunk.subarray(0, max));
            sniffBytes += max;
          }
        }
        pbfDownloads.set(region.id, { status: 'downloading', downloaded, total, url: region.url, name: region.name, path: targetPath });
        cb(null, chunk);
      }
    });
    await pipeline(Readable.fromWeb(res.body), progress, fileStream);
    const sniffText = Buffer.concat(sniffChunks).toString('utf8').trimStart().toLowerCase();
    if (sniffText.startsWith('<!doctype html') || sniffText.startsWith('<html')) {
      throw new Error(`Ungueltiger PBF-Inhalt (HTML-Body): ${region.url} -> ${String(res.url || '')}`);
    }
    await fs.rename(tmpPath, targetPath);
    pbfDownloads.set(region.id, { status: 'ready', downloaded, total, url: region.url, name: region.name, path: targetPath });
    return targetPath;
  } catch (err) {
    pbfDownloads.set(region.id, { status: 'error', error: String(err.message || err), url: region.url, name: region.name, path: targetPath });
    try { await fs.unlink(tmpPath); } catch (_) {}
    throw err;
  }
}

async function ensurePbfRegion(region) {
  const targetPath = path.join(PBF_CACHE_DIR, `${region.id}.osm.pbf`);
  if (existsSync(targetPath)) {
    const stat = await fs.stat(targetPath);
    if ((Date.now() - stat.mtimeMs) < PBF_CACHE_TTL_MS) {
      pbfDownloads.set(region.id, { status: 'ready', ...(pbfDownloads.get(region.id) || {}), path: targetPath });
      return targetPath;
    }
  }
  if (pbfDownloadPromises.has(region.id)) return pbfDownloadPromises.get(region.id);
  const promise = downloadPbfRegion(region).finally(() => pbfDownloadPromises.delete(region.id));
  pbfDownloadPromises.set(region.id, promise);
  return promise;
}

async function resolvePbfPathsForTile(tileKey) {
  const paths = [];
  const seen = new Set();
  // Manual path is preferred when present, but no longer exclusive.
  if (WORKBENCH_PBF_PATH && existsSync(WORKBENCH_PBF_PATH)) {
    const rp = path.resolve(WORKBENCH_PBF_PATH);
    paths.push(rp);
    seen.add(rp);
  }
  const regions = findRegionsForTile(tileKey).slice(0, WORKBENCH_PBF_MAX_REGIONS);
  for (const region of regions) {
    try {
      const p = await ensurePbfRegion(region);
      const rp = path.resolve(p);
      if (!seen.has(rp)) {
        paths.push(rp);
        seen.add(rp);
      }
    } catch (err) {
      console.error(`[PBF] Download fehlgeschlagen für ${region.name}: ${err.message || err}`);
    }
  }
  return paths;
}

async function runOverpassToCombined(tileKey, combinedFile) {
  const cmd = [
    'tools/generate-obstacle-tiles.mjs',
    '--tiles', tileKey,
    '--force',
    '--delay-ms', String(WORKBENCH_DELAY_MS),
    '--retries', String(WORKBENCH_RETRIES),
    '--out', path.relative(ROOT, WORKBENCH_TMP_OUT_DIR),
    '--manifest', path.relative(ROOT, WORKBENCH_TMP_MANIFEST),
    '--failed', path.relative(ROOT, WORKBENCH_TMP_FAILED)
  ];
  const run = await runCmd('node', cmd, { cwd: ROOT });
  const failedData = await readJsonSafe(WORKBENCH_TMP_FAILED, { failedTiles: [] });
  const failedItems = Array.isArray(failedData.failedTiles) ? failedData.failedTiles : [];
  const failedItem = failedItems.find(x => normalizeTileKey(x && x.tile) === tileKey) || null;
  const combinedExists = existsSync(combinedFile);
  return { run, failedItem, combinedExists };
}

async function readJsonMaybeGz(filePath, fallback = null) {
  try {
    const raw = await fs.readFile(filePath);
    const text = String(filePath).endsWith('.gz')
      ? gunzipSync(raw).toString('utf8')
      : raw.toString('utf8');
    return JSON.parse(text);
  } catch (_) {
    return fallback;
  }
}

function mergeCombinedChunks(chunks, tileMeta) {
  const obsMap = new Map();
  const linMap = new Map();
  const poiMap = new Map();
  for (const c of chunks) {
    for (const e of (c.obs || [])) {
      const k = `${e.type}|${Math.round((e.lat || 0) * 1e4)}|${Math.round((e.lon || 0) * 1e4)}`;
      if (!obsMap.has(k)) obsMap.set(k, e);
    }
    for (const e of (c.lin || [])) {
      const k = `${e.layer || e.type || ''}|${e.name || ''}|${Math.round((e.lat || 0) * 1e4)}|${Math.round((e.lon || 0) * 1e4)}`;
      if (!linMap.has(k)) linMap.set(k, e);
    }
    for (const e of (c.poi || [])) {
      const k = `${e.name || ''}|${Math.round((e.lat || 0) * 1e4)}|${Math.round((e.lon || 0) * 1e4)}`;
      if (!poiMap.has(k)) poiMap.set(k, e);
    }
  }
  return {
    v: 1,
    tile: tileMeta.tile || '',
    source: chunks.map(c => c.source || '').filter(Boolean).join('+') || '',
    generatedAt: new Date().toISOString(),
    obs: Array.from(obsMap.values()),
    lin: Array.from(linMap.values()),
    poi: Array.from(poiMap.values())
  };
}

function mergeCorePayload(existingCore, incomingCore) {
  const exObs = Array.isArray(existingCore?.core?.obs) ? existingCore.core.obs : [];
  const exLin = Array.isArray(existingCore?.core?.lin) ? existingCore.core.lin : [];
  const inObs = Array.isArray(incomingCore?.core?.obs) ? incomingCore.core.obs : [];
  const inLin = Array.isArray(incomingCore?.core?.lin) ? incomingCore.core.lin : [];

  const obsMap = new Map();
  const linMap = new Map();

  const obsKey = (e) => `${String(e?.type || '')}|${Math.round(Number(e?.lat || 0) * 1e5)}|${Math.round(Number(e?.lon || 0) * 1e5)}|${Math.round(Number(e?.hFt || 0))}`;
  const linKey = (e) => `${String(e?.type || '')}|${String(e?.name || '')}|${Math.round(Number(e?.lat || 0) * 1e5)}|${Math.round(Number(e?.lon || 0) * 1e5)}`;

  for (const e of exObs) obsMap.set(obsKey(e), e);
  for (const e of inObs) obsMap.set(obsKey(e), e);
  for (const e of exLin) linMap.set(linKey(e), e);
  for (const e of inLin) linMap.set(linKey(e), e);

  const obs = Array.from(obsMap.values());
  const lin = Array.from(linMap.values());
  return {
    v: 1,
    tile: String(incomingCore?.tile || existingCore?.tile || ''),
    source: String(incomingCore?.source || existingCore?.source || ''),
    generatedAt: String(incomingCore?.generatedAt || new Date().toISOString()),
    core: { obs, lin },
    counts: { obs: obs.length, lin: lin.length }
  };
}

function mergePoiPayload(existingPoi, incomingPoi) {
  const exPoi = Array.isArray(existingPoi?.poi?.poi)
    ? existingPoi.poi.poi
    : (Array.isArray(existingPoi?.poi) ? existingPoi.poi : []);
  const inPoi = Array.isArray(incomingPoi?.poi?.poi)
    ? incomingPoi.poi.poi
    : (Array.isArray(incomingPoi?.poi) ? incomingPoi.poi : []);

  const poiMap = new Map();
  const poiKey = (e) => [
    String(e?.name || ''),
    Math.round(Number(e?.lat || 0) * 1e5),
    Math.round(Number(e?.lon || 0) * 1e5),
    String(e?.tourism || ''),
    String(e?.historic || ''),
    String(e?.natural || ''),
    String(e?.water || ''),
    String(e?.landuse || ''),
    String(e?.amenity || ''),
    String(e?.leisure || ''),
    String(e?.man_made || ''),
    String(e?.power || ''),
    String(e?.railway || ''),
    String(e?.highway || ''),
    String(e?.place || '')
  ].join('|');

  for (const e of exPoi) poiMap.set(poiKey(e), e);
  for (const e of inPoi) poiMap.set(poiKey(e), e);

  const poi = Array.from(poiMap.values());
  return {
    v: 1,
    tile: String(incomingPoi?.tile || existingPoi?.tile || ''),
    source: String(incomingPoi?.source || existingPoi?.source || ''),
    generatedAt: String(incomingPoi?.generatedAt || new Date().toISOString()),
    poi: { poi },
    counts: { poi: poi.length }
  };
}

async function writeGzJson(filePath, payload) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, gzipSync(JSON.stringify(payload)));
}

async function getTileGitStatus() {
  const paths = [
    'obstacles/core-tiles',
    'obstacles/poi-tiles',
    'obstacles/core-manifest.v1.json',
    'obstacles/poi-manifest.v1.json',
    'obstacles/failed-split-tiles.json'
  ];
  const r = await runCmd('git', ['status', '--porcelain', '--', ...paths], { cwd: ROOT });
  if (r.code !== 0) return { ok: false, lines: [], raw: (r.stderr || r.stdout || '').trim() };
  const lines = String(r.stdout || '')
    .split('\n')
    .map(s => s.trimEnd())
    .filter(Boolean);
  return { ok: true, lines, raw: lines.join('\n') };
}

async function getRemoteSyncState() {
  const fetchRes = await runCmd('git', ['fetch', 'origin', 'main'], { cwd: ROOT });
  if (fetchRes.code !== 0) {
    return {
      ok: false,
      message: (fetchRes.stderr || fetchRes.stdout || '').trim() || 'git fetch fehlgeschlagen'
    };
  }
  const cmp = await runCmd('git', ['rev-list', '--left-right', '--count', 'origin/main...HEAD'], { cwd: ROOT });
  if (cmp.code !== 0) {
    return {
      ok: false,
      message: (cmp.stderr || cmp.stdout || '').trim() || 'git rev-list fehlgeschlagen'
    };
  }
  const parts = String(cmp.stdout || '').trim().split(/\s+/).map(Number);
  const behind = Number(parts[0] || 0);
  const ahead = Number(parts[1] || 0);
  return { ok: true, behind, ahead };
}

async function collectLocalTileKeysFromFs(baseDir) {
  const out = new Set();
  async function walk(dir) {
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!e.isFile() || !(e.name.endsWith('.json') || e.name.endsWith('.json.gz'))) continue;
      const rel = path.relative(baseDir, full);
      const m = rel.match(/^(-?\d+)[/\\](-?\d+)\.json(?:\.gz)?$/);
      if (!m) continue;
      const key = normalizeTileKey(`${m[1]}|${m[2]}`);
      if (key) out.add(key);
    }
  }
  await walk(baseDir);
  return out;
}

async function loadRemoteManifestTiles(manifestPathInRepo, fallbackPathInRepo = null) {
  const show = await runCmd('git', ['show', `origin/main:${manifestPathInRepo}`], { cwd: ROOT });
  let payloadText = String(show.stdout || '');
  if (show.code !== 0 && fallbackPathInRepo) {
    const fb = await runCmd('git', ['show', `origin/main:${fallbackPathInRepo}`], { cwd: ROOT });
    if (fb.code !== 0) return { ok: false, message: (show.stderr || show.stdout || fb.stderr || fb.stdout || '').trim() || 'Manifest fehlt' };
    payloadText = String(fb.stdout || '');
  } else if (show.code !== 0) {
    return { ok: false, message: (show.stderr || show.stdout || '').trim() || 'Manifest fehlt' };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(payloadText || '{}');
  } catch (e) {
    return { ok: false, message: `Manifest JSON ungültig: ${String(e && e.message || e)}` };
  }
  const tiles = new Set();
  for (const raw of Array.isArray(parsed && parsed.tiles) ? parsed.tiles : []) {
    const k = normalizeTileKey(raw);
    if (k) tiles.add(k);
  }
  return { ok: true, tiles };
}

function setIntersection(a, b) {
  const out = new Set();
  for (const k of a) if (b.has(k)) out.add(k);
  return out;
}

async function runRepoSyncCheck() {
  const fetched = await runCmd('git', ['fetch', 'origin', 'main'], { cwd: ROOT });
  if (fetched.code !== 0) {
    lastRepoSync = {
      ...lastRepoSync,
      ok: false,
      checkedAt: Date.now(),
      message: (fetched.stderr || fetched.stdout || '').trim() || 'git fetch fehlgeschlagen'
    };
    return lastRepoSync;
  }

  const remoteCoreRes = await loadRemoteManifestTiles('obstacles/core-manifest.v1.json', 'obstacles/manifest.v1.json');
  if (!remoteCoreRes.ok) {
    lastRepoSync = {
      ...lastRepoSync,
      ok: false,
      checkedAt: Date.now(),
      message: remoteCoreRes.message || 'Remote-Core-Manifest konnte nicht gelesen werden'
    };
    return lastRepoSync;
  }
  const remotePoiRes = await loadRemoteManifestTiles('obstacles/poi-manifest.v1.json');
  const remotePoiTiles = remotePoiRes.ok ? remotePoiRes.tiles : new Set();

  const localCoreTiles = await collectLocalTileKeysFromFs(CORE_TILE_DIR);
  const localPoiTiles = await collectLocalTileKeysFromFs(POI_TILE_DIR);
  const localCompleteTiles = setIntersection(localCoreTiles, localPoiTiles);

  const remoteCoreTiles = remoteCoreRes.tiles;
  const remoteCompleteTiles = setIntersection(remoteCoreTiles, remotePoiTiles);

  const missingInRepo = [];
  for (const k of localCompleteTiles) if (!remoteCompleteTiles.has(k)) missingInRepo.push(k);
  const missingLocal = [];
  for (const k of remoteCompleteTiles) if (!localCompleteTiles.has(k)) missingLocal.push(k);
  missingInRepo.sort();
  missingLocal.sort();

  lastRepoSync = {
    ok: true,
    checkedAt: Date.now(),
    message: 'Repo-Sync geprüft',
    remoteRef: 'origin/main',
    remoteTileCount: remoteCompleteTiles.size,
    localTileCount: localCompleteTiles.size,
    missingInRepoCount: missingInRepo.length,
    missingLocalCount: missingLocal.length,
    missingInRepoSample: missingInRepo.slice(0, 20),
    missingLocalSample: missingLocal.slice(0, 20),
    missingInRepoTiles: missingInRepo,
    remoteTiles: Array.from(remoteCompleteTiles),
    remoteCoreCount: remoteCoreTiles.size,
    remotePoiCount: remotePoiTiles.size,
    localCoreCount: localCoreTiles.size,
    localPoiCount: localPoiTiles.size,
    localCompleteCount: localCompleteTiles.size,
    remoteCompleteCount: remoteCompleteTiles.size
  };
  return lastRepoSync;
}

async function collectTileState() {
  const coreManifest = await readJsonSafe(CORE_MANIFEST_PATH, defaultManifest());
  const poiManifest = await readJsonSafe(POI_MANIFEST_PATH, defaultManifest());

  const failedData = await readJsonSafe(FAILED_PATH, { failedTiles: [] });
  const failedMap = {};
  for (const item of Array.isArray(failedData.failedTiles) ? failedData.failedTiles : []) {
    const key = normalizeTileKey(item && item.tile);
    if (!key) continue;
    failedMap[key] = {
      status: Number(item.status || 0),
      error: String(item.error || ''),
      at: item.at ? Date.parse(item.at) || Date.now() : Date.now()
    };
  }

  const loadedMap = {};
  const now = Date.now();
  const keys = new Set([
    ...(Array.isArray(coreManifest.tiles) ? coreManifest.tiles : []),
    ...(Array.isArray(poiManifest.tiles) ? poiManifest.tiles : [])
  ].map(normalizeTileKey).filter(Boolean));

  for (const tileKey of keys) {
    const coreGz = tileGzPath(CORE_TILE_DIR, tileKey);
    const poiGz = tileGzPath(POI_TILE_DIR, tileKey);
    const coreFile = existsSync(coreGz) ? coreGz : tilePath(CORE_TILE_DIR, tileKey);
    const poiFile = existsSync(poiGz) ? poiGz : tilePath(POI_TILE_DIR, tileKey);
    const hasCore = existsSync(coreFile);
    const hasPoi = existsSync(poiFile);
    if (!hasCore && !hasPoi) continue;

    let coreStat = null;
    let poiStat = null;
    try { if (hasCore) coreStat = await fs.stat(coreFile); } catch (_) {}
    try { if (hasPoi) poiStat = await fs.stat(poiFile); } catch (_) {}

    const coreMtime = Number(coreStat?.mtimeMs || 0);
    const poiMtime = Number(poiStat?.mtimeMs || 0);
    const mtimeMs = Math.max(coreMtime, poiMtime);
    const stale = ((hasCore && (now - coreMtime) > STALE_AFTER_MS) || (hasPoi && (now - poiMtime) > STALE_AFTER_MS));

    loadedMap[tileKey] = {
      mtimeMs,
      stale,
      bytes: Number(coreStat?.size || 0) + Number(poiStat?.size || 0),
      bytesCore: Number(coreStat?.size || 0),
      bytesPoi: Number(poiStat?.size || 0),
      hasCore,
      hasPoi
    };
  }

  const recent = {};
  for (const [k, v] of lastResults.entries()) recent[k] = v;

  return {
    ok: true,
    root: ROOT,
    port: PORT,
    sourceConfig: {
      pbfPath: WORKBENCH_PBF_PATH,
      pbfAvailable: !!WORKBENCH_PBF_PATH && existsSync(WORKBENCH_PBF_PATH)
    },
    downloads: Object.fromEntries(pbfDownloads),
    processing,
    currentTile,
    queue: queue.slice(),
    queueLength: queue.length,
    tileStepDeg: TILE_STEP_DEG,
    staleAfterDays: 90,
    loaded: loadedMap,
    failed: failedMap,
    recent,
    manifest: {
      generatedAt: coreManifest.generatedAt || null,
      tileCount: Number(coreManifest.tileCount || Object.keys(loadedMap).length || 0)
    },
    repoSync: {
      ok: !!lastRepoSync.ok,
      checkedAt: Number(lastRepoSync.checkedAt || 0),
      message: String(lastRepoSync.message || ''),
      remoteRef: String(lastRepoSync.remoteRef || 'origin/main'),
      remoteTileCount: Number(lastRepoSync.remoteTileCount || 0),
      localTileCount: Number(lastRepoSync.localTileCount || 0),
      missingInRepoCount: Number(lastRepoSync.missingInRepoCount || 0),
      missingLocalCount: Number(lastRepoSync.missingLocalCount || 0),
      missingInRepoSample: Array.isArray(lastRepoSync.missingInRepoSample) ? lastRepoSync.missingInRepoSample : [],
      missingLocalSample: Array.isArray(lastRepoSync.missingLocalSample) ? lastRepoSync.missingLocalSample : []
    }
  };
}

function enqueueTiles(tileKeys) {
  const added = [];
  for (const raw of Array.isArray(tileKeys) ? tileKeys : []) {
    const key = normalizeTileKey(raw);
    if (!key) continue;
    if (queueSet.has(key) || key === currentTile) continue;
    queue.push(key);
    queueSet.add(key);
    added.push(key);
  }
  if (added.length > 0) processQueue();
  return added;
}

async function processOneTile(tileKey) {
  currentTile = tileKey;
  const startedAt = Date.now();

  const combinedFile = tilePath(WORKBENCH_TMP_OUT_DIR, tileKey);
  const coreOut = tileGzPath(CORE_TILE_DIR, tileKey);
  const poiOut = tileGzPath(POI_TILE_DIR, tileKey);
  const coreLegacyOut = tilePath(CORE_TILE_DIR, tileKey);
  const poiLegacyOut = tilePath(POI_TILE_DIR, tileKey);
  const prevCoreFile = existsSync(coreOut) ? coreOut : (existsSync(coreLegacyOut) ? coreLegacyOut : '');
  const prevPoiFile = existsSync(poiOut) ? poiOut : (existsSync(poiLegacyOut) ? poiLegacyOut : '');
  const prevCorePayload = prevCoreFile ? await readJsonMaybeGz(prevCoreFile, null) : null;
  const prevPoiPayload = prevPoiFile ? await readJsonMaybeGz(prevPoiFile, null) : null;

  await ensureDir(WORKBENCH_TMP_OUT_DIR);

  let run = { code: 1, stdout: '', stderr: '' };
  let loadSource = 'pbf';
  let pbfErrorText = '';
  let failedItem = null;

  const pbfPaths = await resolvePbfPathsForTile(tileKey);

  if (pbfPaths.length > 0) {
    const chunkResults = [];
    for (const pbfPath of pbfPaths) {
      const pbfCmd = [
        'tools/dryrun_pbf_combined_chunk.py',
        '--pbf', pbfPath,
        '--tile', tileKey,
        '--out', path.relative(ROOT, combinedFile) + `.pbf-${path.basename(pbfPath, '.osm.pbf')}.tmp`
      ];
      const tmpOut = path.resolve(ROOT, pbfCmd[pbfCmd.indexOf('--out') + 1]);
      const r = await runCmd('python3', pbfCmd, { cwd: ROOT });
      if (r.code === 0 && existsSync(tmpOut)) {
        try {
          const raw = await fs.readFile(tmpOut, 'utf8');
          const parsed = JSON.parse(raw);
          const cnt = parsed && parsed.counts ? parsed.counts : {};
          const totalRaw = Number(cnt.obs || 0) + Number(cnt.lin || 0) + Number(cnt.poi || 0);
          if (totalRaw > 0) chunkResults.push(parsed);
        } catch (_) {}
        try { await fs.unlink(tmpOut); } catch (_) {}
      } else {
        run = r;
      }
    }
    if (chunkResults.length > 0) {
      const merged = mergeCombinedChunks(chunkResults, { tile: tileKey });
      const total = merged.obs.length + merged.lin.length + merged.poi.length;
      if (total > 0) {
        await ensureDir(path.dirname(combinedFile));
        await fs.writeFile(combinedFile, JSON.stringify(merged));
      } else {
        loadSource = 'overpass';
        pbfErrorText = 'PBF lieferte keine Features (Tile außerhalb PBF-Abdeckung?)';
      }
    } else {
      loadSource = 'overpass';
      pbfErrorText = (run.stderr || run.stdout || '').trim() || 'PBF-Extraktion fehlgeschlagen';
    }
  } else {
    loadSource = 'overpass';
    pbfErrorText = 'Keine PBF-Region für dieses Tile gefunden';
  }

  if (loadSource === 'overpass') {
    const ov = await runOverpassToCombined(tileKey, combinedFile);
    run = ov.run;
    failedItem = ov.failedItem;
  }

  const combinedExists = existsSync(combinedFile);
  const failStatus = Number((failedItem && failedItem.status) || 0);
  const failError = String((failedItem && failedItem.error) || '').trim();
  const failServer = String((failedItem && failedItem.server) || '').trim();

  let ok = false;
  let message = 'Tile-Load fehlgeschlagen';

  if (combinedExists && !failedItem) {
    const splitCmd = [
      'tools/split-combined-tile.mjs',
      '--in', path.relative(ROOT, combinedFile),
      '--core-out', path.relative(ROOT, coreOut),
      '--poi-out', path.relative(ROOT, poiOut)
    ];
    const splitRun = await runCmd('node', splitCmd, { cwd: ROOT });
    if (splitRun.code === 0 && existsSync(coreOut) && existsSync(poiOut)) {
      const corePayloadRaw = await readJsonMaybeGz(coreOut, { counts: { obs: 0, lin: 0 } });
      const poiPayloadRaw = await readJsonMaybeGz(poiOut, { counts: { poi: 0 } });
      const corePayload = prevCorePayload ? mergeCorePayload(prevCorePayload, corePayloadRaw) : corePayloadRaw;
      const poiPayload = prevPoiPayload ? mergePoiPayload(prevPoiPayload, poiPayloadRaw) : poiPayloadRaw;
      if (prevCorePayload || prevPoiPayload) {
        await writeGzJson(coreOut, corePayload);
        await writeGzJson(poiOut, poiPayload);
      }
      const outObs = Number(corePayload?.counts?.obs || 0);
      const outLin = Number(corePayload?.counts?.lin || 0);
      const outPoi = Number(poiPayload?.counts?.poi || 0);
      const outTotal = outObs + outLin + outPoi;

      if (outTotal === 0 && loadSource === 'pbf') {
        // PBF raw data had no mission-relevant output after split; try Overpass once.
        const ov = await runOverpassToCombined(tileKey, combinedFile);
        run = ov.run;
        failedItem = ov.failedItem;
        if (!failedItem && existsSync(combinedFile)) {
          const splitRun2 = await runCmd('node', splitCmd, { cwd: ROOT });
          const corePayload2Raw = await readJsonMaybeGz(coreOut, { counts: { obs: 0, lin: 0 } });
          const poiPayload2Raw = await readJsonMaybeGz(poiOut, { counts: { poi: 0 } });
          const corePayload2 = prevCorePayload ? mergeCorePayload(prevCorePayload, corePayload2Raw) : corePayload2Raw;
          const poiPayload2 = prevPoiPayload ? mergePoiPayload(prevPoiPayload, poiPayload2Raw) : poiPayload2Raw;
          if (prevCorePayload || prevPoiPayload) {
            await writeGzJson(coreOut, corePayload2);
            await writeGzJson(poiOut, poiPayload2);
          }
          const outTotal2 = Number(corePayload2?.counts?.obs || 0) + Number(corePayload2?.counts?.lin || 0) + Number(poiPayload2?.counts?.poi || 0);
          if (splitRun2.code === 0 && existsSync(coreOut) && existsSync(poiOut) && outTotal2 > 0) {
            await upsertManifestTile(CORE_MANIFEST_PATH, tileKey);
            await upsertManifestTile(POI_MANIFEST_PATH, tileKey);
            await removeFailedTile(tileKey);
            try { await fs.unlink(tilePath(CORE_TILE_DIR, tileKey)); } catch (_) {}
            try { await fs.unlink(tilePath(POI_TILE_DIR, tileKey)); } catch (_) {}
            ok = true;
            message = 'Tile geladen (PBF→Overpass Fallback), gesplittet und gespeichert';
          } else {
            await upsertFailedTile(tileKey, {
              status: Number((failedItem && failedItem.status) || 0),
              error: 'Split ergab leere Core/POI-Ausgabe (PBF + Overpass)'
            });
            message = 'Split ergab leere Core/POI-Ausgabe (PBF + Overpass)';
          }
        } else {
          await upsertFailedTile(tileKey, {
            status: Number((failedItem && failedItem.status) || 0),
            error: String((failedItem && failedItem.error) || 'Overpass-Fallback fehlgeschlagen')
          });
          message = `PBF lieferte keine verwertbaren Core/POI-Daten, Overpass-Fallback fehlgeschlagen`;
        }
      } else if (outTotal === 0) {
        await upsertFailedTile(tileKey, {
          status: 0,
          error: 'Split ergab leere Core/POI-Ausgabe'
        });
        message = 'Split ergab leere Core/POI-Ausgabe';
      } else {
        await upsertManifestTile(CORE_MANIFEST_PATH, tileKey);
        await upsertManifestTile(POI_MANIFEST_PATH, tileKey);
        await removeFailedTile(tileKey);
        // Delete old plain .json counterparts (migrating to .json.gz)
        try { await fs.unlink(tilePath(CORE_TILE_DIR, tileKey)); } catch (_) {}
        try { await fs.unlink(tilePath(POI_TILE_DIR, tileKey)); } catch (_) {}
        ok = true;
        message = `Tile geladen (${loadSource}), gesplittet und gespeichert`;
      }
    } else {
      await upsertFailedTile(tileKey, {
        status: 0,
        error: (splitRun.stderr || splitRun.stdout || 'Split fehlgeschlagen').trim()
      });
      message = (splitRun.stderr || splitRun.stdout || 'Split fehlgeschlagen').trim() || 'Split fehlgeschlagen';
    }
  } else {
    await upsertFailedTile(tileKey, {
      status: failStatus,
      error: failError || (run.stderr || run.stdout || 'Tile-Load fehlgeschlagen').trim(),
      server: failServer
    });
    const failMsg = [
      failStatus ? `HTTP ${failStatus}` : '',
      failError,
      failServer ? `(Server: ${failServer})` : ''
    ].filter(Boolean).join(' | ');
    message = failMsg || (run.stderr && run.stderr.trim()) || (run.stdout && run.stdout.trim().split('\n').slice(-2).join(' | ')) || 'Tile-Load fehlgeschlagen';
    if (loadSource === 'overpass' && pbfErrorText) {
      message = `PBF fehlgeschlagen -> Overpass Fallback | ${message} | PBF: ${pbfErrorText.slice(0, 180)}`;
    } else if (loadSource === 'overpass') {
      message = `PBF fehlt -> Overpass Fallback | ${message}`;
    }
  }

  // Rohdaten aus dem Zwischenschritt immer wieder entfernen.
  try { await fs.unlink(combinedFile); } catch (_) {}

  lastResults.set(tileKey, {
    ok,
    at: Date.now(),
    durationMs: Date.now() - startedAt,
    code: run.code,
    status: failStatus,
    error: failError,
    server: failServer,
    message
  });
}

async function processQueue() {
  if (processing) return;
  processing = true;
  try {
    while (queue.length > 0) {
      const next = queue.shift();
      queueSet.delete(next);
      if (!next) continue;
      try {
        await processOneTile(next);
        const last = lastResults.get(next);
        if (last && last.ok === false) {
          const baseWait = WORKBENCH_FAIL_COOLDOWN_MS;
          const extraWait = Number(last.status) === 504 ? WORKBENCH_504_EXTRA_COOLDOWN_MS : 0;
          const waitMs = Math.max(0, baseWait + extraWait);
          if (waitMs > 0) {
            lastResults.set(next, {
              ...last,
              message: `${last.message} | Cooldown ${Math.round(waitMs / 1000)}s`
            });
            await new Promise(res => setTimeout(res, waitMs));
          }
        }
      } catch (err) {
        const errMsg = `Interner Fehler: ${String(err && err.message || err)}`;
        await upsertFailedTile(next, { status: 0, error: errMsg });
        lastResults.set(next, {
          ok: false,
          at: Date.now(),
          durationMs: 0,
          code: 1,
          message: errMsg
        });
      } finally {
        currentTile = null;
      }
    }
  } finally {
    processing = false;
    currentTile = null;
    if (autoPushWhenDone) {
      autoPushWhenDone = false;
      console.log('[Tile-Workbench] Queue leer — Auto-Push gestartet...');
      handlePush().then(r => {
        console.log(`[Tile-Workbench] Auto-Push: ${r.ok ? 'OK' : 'Fehler — ' + r.message}`);
      }).catch(e => {
        console.error('[Tile-Workbench] Auto-Push Fehler:', e);
      });
    }
  }
}

async function handlePush() {
  if (processing || currentTile || queue.length > 0) {
    return {
      ok: false,
      code: 409,
      step: 'queue_active',
      message: `Queue läuft noch (${queue.length} wartend${currentTile ? ', 1 aktiv' : ''}). Bitte warten bis alles fertig ist.`
    };
  }

  const syncState = await getRemoteSyncState();
  if (!syncState.ok) {
    return { ok: false, code: 500, step: 'sync_check', message: syncState.message || 'Git-Abgleich fehlgeschlagen' };
  }
  if (syncState.behind > 0) {
    return {
      ok: false,
      code: 409,
      step: 'behind_remote',
      message: `Lokaler Stand ist ${syncState.behind} Commit(s) hinter origin/main. Bitte erst syncen/pullen, dann erneut pushen.`,
      behind: syncState.behind,
      ahead: syncState.ahead
    };
  }

  const before = await getTileGitStatus();
  if (!before.ok) {
    return { ok: false, code: 500, step: 'status_before', message: before.raw || 'git status fehlgeschlagen' };
  }

  const pushPaths = [
    'obstacles/core-tiles',
    'obstacles/poi-tiles',
    'obstacles/core-manifest.v1.json',
    'obstacles/poi-manifest.v1.json',
    'obstacles/failed-split-tiles.json'
  ];

  const add = await runCmd('git', ['add', ...pushPaths], { cwd: ROOT });
  if (add.code !== 0) {
    return { ok: false, step: 'add', message: (add.stderr || add.stdout || '').trim() || 'git add failed' };
  }

  const staged = await runCmd('git', ['diff', '--cached', '--name-only', '--', ...pushPaths], { cwd: ROOT });
  if (staged.code !== 0) {
    return { ok: false, code: 500, step: 'staged_list', message: (staged.stderr || staged.stdout || '').trim() || 'staged diff fehlgeschlagen' };
  }
  const stagedFiles = String(staged.stdout || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (stagedFiles.length === 0) {
    return { ok: true, message: 'Keine neuen Tile-Änderungen zum Pushen.', stagedFiles: [] };
  }

  const msg = `Update hosted split obstacle tiles (${new Date().toISOString().slice(0, 19).replace('T', ' ')})`;
  const commit = await runCmd('git', ['commit', '-m', msg], { cwd: ROOT });
  if (commit.code !== 0) {
    return { ok: false, step: 'commit', message: (commit.stderr || commit.stdout || '').trim() || 'git commit failed' };
  }

  const push = await runCmd('git', ['push', 'origin', 'main'], { cwd: ROOT });
  if (push.code !== 0) {
    return { ok: false, step: 'push', message: (push.stderr || push.stdout || '').trim() || 'git push failed', commit: msg };
  }

  return {
    ok: true,
    message: `Tiles erfolgreich committed und gepusht (${stagedFiles.length} Datei(en)).`,
    commitMessage: msg,
    pushOut: (push.stdout || push.stderr || '').trim(),
    stagedFiles,
    aheadBeforePush: syncState.ahead,
    behindBeforePush: syncState.behind,
    changedBeforeAdd: before.lines
  };
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 2_000_000) {
        reject(new Error('Payload zu groß'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });

    if (req.method === 'GET' && url.pathname === '/') {
      const html = await fs.readFile(HTML_PATH, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(html);
    }

    if (req.method === 'GET' && url.pathname === '/favicon.ico') {
      res.writeHead(204, { 'Cache-Control': 'public, max-age=86400' });
      return res.end();
    }

    if (req.method === 'GET' && url.pathname === '/api/state') {
      const state = await collectTileState();
      return sendJson(res, 200, state);
    }

    if (req.method === 'POST' && url.pathname === '/api/enqueue') {
      const body = await parseBody(req);
      if (body && body.autoPush) autoPushWhenDone = true;
      const added = enqueueTiles(body && body.tiles);
      return sendJson(res, 200, {
        ok: true,
        added,
        queueLength: queue.length,
        processing,
        currentTile
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/clear-queue') {
      queue.length = 0;
      queueSet.clear();
      return sendJson(res, 200, { ok: true, queueLength: 0, processing, currentTile });
    }

    // Re-queue all tiles that still exist only as .json (not yet .json.gz) — migration helper.
    if (req.method === 'POST' && url.pathname === '/api/requeue-legacy-json') {
      const tiles = [];
      for await (const [latI, lonI] of iterateTileFiles(CORE_TILE_DIR, '.json')) {
        const key = `${latI}|${lonI}`;
        if (!existsSync(tileGzPath(CORE_TILE_DIR, key))) tiles.push(key);
      }
      const added = enqueueTiles(tiles);
      return sendJson(res, 200, { ok: true, found: tiles.length, added: added.length, queueLength: queue.length });
    }

    // Re-queue all already-loaded tiles to force a full refresh (useful after PBF update).
    if (req.method === 'POST' && url.pathname === '/api/requeue-all-loaded') {
      const body = await parseBody(req);
      const maxAge = Number(body && body.maxAgeDays) || 0; // 0 = all
      const now = Date.now();
      const seen = new Set();
      const tiles = [];
      const collectSuffix = async (suffix) => {
        for await (const [latI, lonI] of iterateTileFiles(CORE_TILE_DIR, suffix)) {
          const key = `${latI}|${lonI}`;
          if (seen.has(key)) continue;
          seen.add(key);
          if (maxAge > 0) {
            const gzp = tileGzPath(CORE_TILE_DIR, key);
            const jp = tilePath(CORE_TILE_DIR, key);
            const probePath = existsSync(gzp) ? gzp : jp;
            try {
              const st = await fs.stat(probePath);
              if (now - st.mtimeMs < maxAge * 86400_000) continue; // still fresh
            } catch (_) {}
          }
          tiles.push(key);
        }
      };
      await collectSuffix('.json.gz');
      await collectSuffix('.json');
      const added = enqueueTiles(tiles);
      return sendJson(res, 200, { ok: true, found: tiles.length, added: added.length, queueLength: queue.length });
    }

    if (req.method === 'POST' && url.pathname === '/api/push') {
      const out = await handlePush();
      return sendJson(res, out.ok ? 200 : Number(out.code || 500), out);
    }

    if (req.method === 'POST' && url.pathname === '/api/repo-sync') {
      const out = await runRepoSyncCheck();
      return sendJson(res, out.ok ? 200 : 500, out);
    }

    return sendJson(res, 404, { ok: false, error: 'not_found' });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: String(err && err.message || err) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Tile-Workbench] läuft auf http://127.0.0.1:${PORT}`);
  console.log(`[Tile-Workbench] Repo-Root:  ${ROOT}`);
  console.log(`[Tile-Workbench] Cache-Dir:  ${CACHE_BASE}`);
  console.log(`[Tile-Workbench] Tiles-Out:  ${OBST_DIR}`);
  console.log(`[Tile-Workbench] PBF-Cache:  ${PBF_CACHE_DIR}`);
});
