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
import { REGIONS, findRegionsForTile } from './pbf-region-registry.mjs';

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
const WORKBENCH_PBF_MAX_REGIONS = Math.max(1, Number(process.env.OBS_WORKBENCH_PBF_MAX_REGIONS || _cfg.pbfMaxRegions || 6));
const WORKBENCH_PBF_THIN_EXTEND = String(process.env.OBS_WORKBENCH_PBF_THIN_EXTEND || '1') !== '0';
const WORKBENCH_PBF_THIN_OBS_MAX = Math.max(0, Number(process.env.OBS_WORKBENCH_PBF_THIN_OBS_MAX || 1));
const WORKBENCH_PBF_THIN_LIN_MAX = Math.max(0, Number(process.env.OBS_WORKBENCH_PBF_THIN_LIN_MAX || 250));
const WORKBENCH_PBF_THIN_POI_MAX = Math.max(0, Number(process.env.OBS_WORKBENCH_PBF_THIN_POI_MAX || 250));

const PBF_CACHE_DIR = path.join(CACHE_BASE, 'pbf');
const PBF_CACHE_TTL_MS = Number(process.env.OBS_WORKBENCH_PBF_TTL_DAYS || 7) * 24 * 60 * 60 * 1000;

const TILE_STEP_DEG = 25 / 60;
const STALE_AFTER_MS = 90 * 24 * 60 * 60 * 1000;
const PORT = Number(process.env.OBS_WORKBENCH_PORT || 8788);
const LAT_TILE_COUNT = Math.round(180 / TILE_STEP_DEG);
const LON_TILE_COUNT = Math.round(360 / TILE_STEP_DEG);

const REGION_BY_ID = new Map(REGIONS.map(r => [String(r.id), r]));
const tileRegionMetaCache = new Map();
const regionPolyCache = new Map(); // regionId -> { mode:'poly'|'bbox', polygon?:{outers,holes,bbox} }
const regionTileCache = new Map(); // regionId -> string[] tiles matching region coverage

const pbfDownloads = new Map(); // regionId -> { status, downloaded, total, url, name, path }
const pbfDownloadPromises = new Map(); // regionId -> Promise (dedup concurrent downloads)

const queue = [];
const queueSet = new Set();
const queueFreshSet = new Set();
let processing = false;
let currentTile = null;
let autoPushWhenDone = false; // set via enqueue autoPush:true
const WORKBENCH_RETRIES = Number(process.env.OBS_WORKBENCH_RETRIES || 4);
const WORKBENCH_DELAY_MS = Number(process.env.OBS_WORKBENCH_DELAY_MS || 2200);
const WORKBENCH_FAIL_COOLDOWN_MS = Number(process.env.OBS_WORKBENCH_FAIL_COOLDOWN_MS || 12000);
const WORKBENCH_504_EXTRA_COOLDOWN_MS = Number(process.env.OBS_WORKBENCH_504_EXTRA_COOLDOWN_MS || 18000);
const WORKBENCH_CACHE_RECOVERY_RETRY_MS = Number(process.env.OBS_WORKBENCH_CACHE_RECOVERY_RETRY_MS || 10000);
const WORKBENCH_PROCESS_LOG_MAX = Math.max(20, Number(process.env.OBS_WORKBENCH_PROCESS_LOG_MAX || 250));
const WORKBENCH_REPO_SYNC_TIMEOUT_MS = Math.max(5000, Number(process.env.OBS_WORKBENCH_REPO_SYNC_TIMEOUT_MS || 25000));
const lastResults = new Map();
let lastRepoSync = {
  ok: false,
  running: false,
  phase: 'idle',
  startedAt: 0,
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
let repoSyncPromise = null;
let processSeq = 0;
const processLog = [];
const currentProgress = {
  tile: null,
  phase: 'idle',
  source: '',
  pbfRegions: [],
  relevantRegionCount: 0,
  lowCoverage: false,
  thinDetected: false,
  thinExtended: false,
  message: '',
  startedAt: 0,
  updatedAt: 0
};

function pushProcessEvent(event, details = {}) {
  processSeq += 1;
  const entry = {
    seq: processSeq,
    ts: Date.now(),
    event: String(event || 'event'),
    ...details
  };
  processLog.push(entry);
  if (processLog.length > WORKBENCH_PROCESS_LOG_MAX) {
    processLog.splice(0, processLog.length - WORKBENCH_PROCESS_LOG_MAX);
  }
  return entry;
}

function setCurrentProgress(patch = {}) {
  Object.assign(currentProgress, patch, { updatedAt: Date.now() });
}

class CacheUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CacheUnavailableError';
    this.code = 'CACHE_UNAVAILABLE';
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms || 0))));
}

function looksLikeCacheUnavailable(text) {
  const s = String(text || '').toLowerCase();
  if (!s) return false;
  const cacheHint = s.includes('/volumes/') || s.includes('obs-split') || s.includes('workbench-cache') || s.includes('/pbf/');
  const hasEioCode = /(^|[^a-z0-9])eio([^a-z0-9]|$)/.test(s);
  return (
    s.includes('operation not permitted') ||
    s.includes('input/output error') ||
    hasEioCode ||
    s.includes('enospc') ||
    s.includes('read-only file system') ||
    s.includes('erofs') ||
    s.includes('cache-pfad nicht verfügbar') ||
    (cacheHint && s.includes('enoent')) ||
    (cacheHint && s.includes('not a directory')) ||
    (cacheHint && s.includes('no such file or directory'))
  );
}

async function isCacheWritable() {
  try {
    await ensureDir(CACHE_BASE);
    const probe = path.join(CACHE_BASE, '.wb_cache_probe');
    await fs.writeFile(probe, String(Date.now()), 'utf8');
    await fs.unlink(probe).catch(() => {});
    return true;
  } catch (_) {
    return false;
  }
}

async function assertCacheWritableOrThrow(context = '') {
  const ok = await isCacheWritable();
  if (ok) return;
  throw new CacheUnavailableError(`Cache-Pfad nicht verfügbar${context ? ` (${context})` : ''}: ${CACHE_BASE}`);
}

async function waitForCacheRecovery() {
  while (true) {
    const ok = await isCacheWritable();
    if (ok) {
      console.log(`[Tile-Workbench] Cache wieder verfügbar: ${CACHE_BASE}`);
      return;
    }
    console.warn(`[Tile-Workbench] Cache nicht verfügbar, neuer Check in ${Math.round(WORKBENCH_CACHE_RECOVERY_RETRY_MS / 1000)}s: ${CACHE_BASE}`);
    await sleep(WORKBENCH_CACHE_RECOVERY_RETRY_MS);
  }
}

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

function tileBoundsFromIndices(latI, lonI) {
  const south = -90 + latI * TILE_STEP_DEG;
  const north = south + TILE_STEP_DEG;
  const west = -180 + lonI * TILE_STEP_DEG;
  const east = west + TILE_STEP_DEG;
  return { south, west, north, east };
}

function bboxIntersects(a, b) {
  return !(a.north <= b.south || a.south >= b.north || a.east <= b.west || a.west >= b.east);
}

function getRegionMetaForTile(tileKey) {
  const key = normalizeTileKey(tileKey);
  if (!key) return { count: 0, ids: [] };
  if (tileRegionMetaCache.has(key)) return tileRegionMetaCache.get(key);
  const ids = findRegionsForTile(key).map(r => String(r.id));
  const meta = { count: ids.length, ids };
  tileRegionMetaCache.set(key, meta);
  return meta;
}

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersects = ((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPoly(lon, lat, poly) {
  let inOuter = false;
  for (const ring of poly.outers) {
    if (pointInRing(lon, lat, ring)) { inOuter = true; break; }
  }
  if (!inOuter) return false;
  for (const ring of poly.holes) {
    if (pointInRing(lon, lat, ring)) return false;
  }
  return true;
}

function orient(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(a, b, c) {
  return Math.min(a[0], b[0]) <= c[0] && c[0] <= Math.max(a[0], b[0]) &&
         Math.min(a[1], b[1]) <= c[1] && c[1] <= Math.max(a[1], b[1]);
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if ((o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0)) return true;
  if (Math.abs(o1) < 1e-12 && onSegment(a, b, c)) return true;
  if (Math.abs(o2) < 1e-12 && onSegment(a, b, d)) return true;
  if (Math.abs(o3) < 1e-12 && onSegment(c, d, a)) return true;
  if (Math.abs(o4) < 1e-12 && onSegment(c, d, b)) return true;
  return false;
}

function parsePolyText(text) {
  const lines = String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length < 3) return null;
  const rings = [];
  let i = 1; // first line is name
  while (i < lines.length) {
    const header = lines[i++];
    if (header.toUpperCase() === 'END') break;
    const isHole = header.startsWith('!');
    const ring = [];
    while (i < lines.length) {
      const line = lines[i++];
      if (line.toUpperCase() === 'END') break;
      const parts = line.split(/\s+/).filter(Boolean);
      if (parts.length < 2) continue;
      const lon = Number(parts[0]);
      const lat = Number(parts[1]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      ring.push([lon, lat]);
    }
    if (ring.length >= 3) rings.push({ isHole, ring });
  }
  if (rings.length === 0) return null;
  const outers = rings.filter(r => !r.isHole).map(r => r.ring);
  const holes = rings.filter(r => r.isHole).map(r => r.ring);
  if (outers.length === 0) return null;
  let minLat = Infinity, minLon = Infinity, maxLat = -Infinity, maxLon = -Infinity;
  for (const ring of [...outers, ...holes]) {
    for (const [lon, lat] of ring) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
  }
  return {
    outers,
    holes,
    bbox: { south: minLat, west: minLon, north: maxLat, east: maxLon }
  };
}

function tileIntersectsPolygon(tile, poly) {
  if (!bboxIntersects(tile, poly.bbox)) return false;

  const tileCorners = [
    [tile.west, tile.south],
    [tile.east, tile.south],
    [tile.east, tile.north],
    [tile.west, tile.north]
  ];
  const tileEdges = [
    [tileCorners[0], tileCorners[1]],
    [tileCorners[1], tileCorners[2]],
    [tileCorners[2], tileCorners[3]],
    [tileCorners[3], tileCorners[0]]
  ];

  for (const [lon, lat] of tileCorners) {
    if (pointInPoly(lon, lat, poly)) return true;
  }
  for (const ring of [...poly.outers, ...poly.holes]) {
    for (const [lon, lat] of ring) {
      if (lat >= tile.south && lat <= tile.north && lon >= tile.west && lon <= tile.east) return true;
    }
  }
  for (const ring of [...poly.outers, ...poly.holes]) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      for (const [c, d] of tileEdges) {
        if (segmentsIntersect(a, b, c, d)) return true;
      }
    }
  }
  return false;
}

function getRegionPolyUrl(region) {
  const url = String(region?.url || '');
  if (!url) return '';
  if (url.endsWith('.osm.pbf')) return url.slice(0, -8) + '.poly';
  return '';
}

async function ensureRegionPolygon(region) {
  const regionId = String(region?.id || '').trim();
  if (!regionId) return { mode: 'bbox' };
  if (regionPolyCache.has(regionId)) return regionPolyCache.get(regionId);

  const polyUrl = getRegionPolyUrl(region);
  if (!polyUrl) {
    const fallback = { mode: 'bbox' };
    regionPolyCache.set(regionId, fallback);
    return fallback;
  }

  const polyPath = path.join(PBF_CACHE_DIR, `${regionId}.poly`);
  let parsed = null;
  try {
    if (existsSync(polyPath)) {
      const txt = await fs.readFile(polyPath, 'utf8');
      parsed = parsePolyText(txt);
    }
  } catch (_) {}

  if (!parsed) {
    try {
      await ensureDir(PBF_CACHE_DIR);
      const res = await fetch(polyUrl, { redirect: 'follow' });
      if (res.ok) {
        const txt = await res.text();
        parsed = parsePolyText(txt);
        if (parsed) {
          await fs.writeFile(polyPath, txt, 'utf8');
        }
      }
    } catch (_) {}
  }

  const out = parsed ? { mode: 'poly', polygon: parsed } : { mode: 'bbox' };
  regionPolyCache.set(regionId, out);
  return out;
}

async function collectRegionTileKeys(region) {
  if (!region || !Array.isArray(region.bbox) || region.bbox.length !== 4) return [];
  const regionId = String(region.id || '').trim();
  if (regionId && regionTileCache.has(regionId)) {
    return regionTileCache.get(regionId).slice();
  }
  const [south, west, north, east] = region.bbox.map(Number);
  if (![south, west, north, east].every(Number.isFinite)) return [];

  const latMin = Math.max(0, Math.floor((Math.min(south, north) + 90) / TILE_STEP_DEG) - 1);
  const latMax = Math.min(LAT_TILE_COUNT - 1, Math.floor((Math.max(south, north) + 90) / TILE_STEP_DEG) + 1);
  const lonMin = Math.max(0, Math.floor((Math.min(west, east) + 180) / TILE_STEP_DEG) - 1);
  const lonMax = Math.min(LON_TILE_COUNT - 1, Math.floor((Math.max(west, east) + 180) / TILE_STEP_DEG) + 1);

  const coverage = await ensureRegionPolygon(region);
  const poly = coverage.mode === 'poly' ? coverage.polygon : null;
  const regionBounds = { south: Math.min(south, north), west: Math.min(west, east), north: Math.max(south, north), east: Math.max(west, east) };
  const out = [];
  for (let latI = latMin; latI <= latMax; latI++) {
    for (let lonI = lonMin; lonI <= lonMax; lonI++) {
      const tileBounds = tileBoundsFromIndices(latI, lonI);
      if (!bboxIntersects(tileBounds, regionBounds)) continue;
      if (poly && !tileIntersectsPolygon(tileBounds, poly)) continue;
      out.push(`${latI}|${lonI}`);
    }
  }
  if (regionId) regionTileCache.set(regionId, out.slice());
  return out;
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
    let settled = false;
    const child = spawn(bin, args, {
      cwd: opts.cwd || ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: opts.env ? { ...process.env, ...opts.env } : process.env
    });
    let stdout = '';
    let stderr = '';
    let timer = null;
    const timeoutMs = Number(opts.timeoutMs || 0);
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        if (settled) return;
        stderr += `\nTimeout nach ${Math.round(timeoutMs / 1000)}s: ${bin} ${args.join(' ')}`;
        try { child.kill('SIGTERM'); } catch (_) {}
        setTimeout(() => {
          if (!settled) {
            try { child.kill('SIGKILL'); } catch (_) {}
          }
        }, 1500).unref?.();
      }, timeoutMs);
      timer.unref?.();
    }
    child.stdout.on('data', d => { stdout += String(d); });
    child.stderr.on('data', d => { stderr += String(d); });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      const timedOut = timeoutMs > 0 && /Timeout nach \d+s:/.test(stderr);
      resolve({ code: timedOut ? 124 : Number(code || 0), stdout, stderr, timedOut });
    });
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
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

async function resolveRelevantRegionsForTile(tileKey) {
  const key = normalizeTileKey(tileKey);
  if (!key) return [];
  const [latI, lonI] = key.split('|').map(Number);
  if (!Number.isFinite(latI) || !Number.isFinite(lonI)) return [];
  const tileBounds = tileBoundsFromIndices(latI, lonI);
  const bboxCandidates = findRegionsForTile(key);
  if (!bboxCandidates.length) return [];

  const filtered = [];
  for (const region of bboxCandidates) {
    const coverage = await ensureRegionPolygon(region);
    const poly = coverage.mode === 'poly' ? coverage.polygon : null;
    if (poly && !tileIntersectsPolygon(tileBounds, poly)) continue;
    filtered.push(region);
  }
  return filtered.length > 0 ? filtered : bboxCandidates;
}

async function resolvePbfPathsForTile(tileKey) {
  const selectedPaths = [];
  const remainingPaths = [];
  const seen = new Set();
  const selectedRegionIds = [];
  const remainingRegionIds = [];
  // Manual path is preferred when present, but no longer exclusive.
  if (WORKBENCH_PBF_PATH && existsSync(WORKBENCH_PBF_PATH)) {
    const rp = path.resolve(WORKBENCH_PBF_PATH);
    selectedPaths.push(rp);
    seen.add(rp);
  }
  const regions = await resolveRelevantRegionsForTile(tileKey);
  const selectedRegions = regions.slice(0, WORKBENCH_PBF_MAX_REGIONS);
  const remainingRegions = regions.slice(WORKBENCH_PBF_MAX_REGIONS);
  for (const region of selectedRegions) {
    try {
      const p = await ensurePbfRegion(region);
      const rp = path.resolve(p);
      if (!seen.has(rp)) {
        selectedPaths.push(rp);
        seen.add(rp);
      }
      selectedRegionIds.push(String(region.id || ''));
    } catch (err) {
      console.error(`[PBF] Download fehlgeschlagen für ${region.name}: ${err.message || err}`);
    }
  }
  for (const region of remainingRegions) {
    try {
      const p = await ensurePbfRegion(region);
      const rp = path.resolve(p);
      if (!seen.has(rp)) {
        remainingPaths.push(rp);
        seen.add(rp);
      }
      remainingRegionIds.push(String(region.id || ''));
    } catch (err) {
      console.error(`[PBF] Download fehlgeschlagen für ${region.name}: ${err.message || err}`);
    }
  }
  return {
    selectedPaths,
    remainingPaths,
    selectedRegionIds,
    remainingRegionIds,
    relevantRegionCount: regions.length
  };
}

function isThinCombinedPayload(payload) {
  const obs = Array.isArray(payload?.obs) ? payload.obs.length : 0;
  const lin = Array.isArray(payload?.lin) ? payload.lin.length : 0;
  const poi = Array.isArray(payload?.poi) ? payload.poi.length : 0;
  return obs <= WORKBENCH_PBF_THIN_OBS_MAX && lin <= WORKBENCH_PBF_THIN_LIN_MAX && poi <= WORKBENCH_PBF_THIN_POI_MAX;
}

async function extractPbfChunksForTile(tileKey, pbfPaths, combinedFile) {
  let run = { code: 1, stdout: '', stderr: '' };
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
        chunkResults.push(parsed);
      } catch (_) {}
      try { await fs.unlink(tmpOut); } catch (_) {}
    } else {
      run = r;
    }
  }
  return { run, chunkResults };
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

function getTileCounts(corePayload, poiPayload) {
  return {
    obs: Number(corePayload?.counts?.obs || 0),
    lin: Number(corePayload?.counts?.lin || 0),
    poi: Number(poiPayload?.counts?.poi || 0)
  };
}

function getTileDataStatus(corePayload, poiPayload) {
  const explicit = String(corePayload?.meta?.dataStatus || poiPayload?.meta?.dataStatus || '').trim();
  if (explicit === 'empty' || explicit === 'loaded') return explicit;
  const counts = getTileCounts(corePayload, poiPayload);
  return (counts.obs + counts.lin + counts.poi) === 0 ? 'empty' : 'loaded';
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
    counts: {
      obs: obsMap.size,
      lin: linMap.size,
      poi: poiMap.size
    },
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
  const show = await runCmd('git', ['show', `origin/main:${manifestPathInRepo}`], {
    cwd: ROOT,
    timeoutMs: 8000,
    env: { GIT_TERMINAL_PROMPT: '0' }
  });
  let payloadText = String(show.stdout || '');
  if (show.code !== 0 && fallbackPathInRepo) {
    const fb = await runCmd('git', ['show', `origin/main:${fallbackPathInRepo}`], {
      cwd: ROOT,
      timeoutMs: 8000,
      env: { GIT_TERMINAL_PROMPT: '0' }
    });
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
  if (lastRepoSync.running) {
    return {
      ...lastRepoSync,
      ok: false,
      message: 'Repo-Sync läuft bereits.'
    };
  }

  lastRepoSync = {
    ...lastRepoSync,
    ok: false,
    running: true,
    phase: 'fetch',
    startedAt: Date.now(),
    checkedAt: Date.now(),
    message: 'Repo-Sync: fetch origin/main...'
  };

  try {
    const fetched = await runCmd('git', ['fetch', '--no-tags', 'origin', 'main'], {
      cwd: ROOT,
      timeoutMs: WORKBENCH_REPO_SYNC_TIMEOUT_MS,
      env: { GIT_TERMINAL_PROMPT: '0' }
    });
    if (fetched.code !== 0) {
      lastRepoSync = {
        ...lastRepoSync,
        ok: false,
        running: false,
        phase: 'failed',
        checkedAt: Date.now(),
        message: (fetched.stderr || fetched.stdout || '').trim() || 'git fetch fehlgeschlagen'
      };
      return lastRepoSync;
    }

    lastRepoSync = {
      ...lastRepoSync,
      phase: 'remote-manifest',
      checkedAt: Date.now(),
      message: 'Repo-Sync: Remote-Manifeste lesen...'
    };
    const remoteCoreRes = await loadRemoteManifestTiles('obstacles/core-manifest.v1.json', 'obstacles/manifest.v1.json');
    if (!remoteCoreRes.ok) {
      lastRepoSync = {
        ...lastRepoSync,
        ok: false,
        running: false,
        phase: 'failed',
        checkedAt: Date.now(),
        message: remoteCoreRes.message || 'Remote-Core-Manifest konnte nicht gelesen werden'
      };
      return lastRepoSync;
    }
    const remotePoiRes = await loadRemoteManifestTiles('obstacles/poi-manifest.v1.json');
    const remotePoiTiles = remotePoiRes.ok ? remotePoiRes.tiles : new Set();

    lastRepoSync = {
      ...lastRepoSync,
      phase: 'local-scan',
      checkedAt: Date.now(),
      message: 'Repo-Sync: lokale Tiles prüfen...'
    };
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
      running: false,
      phase: 'done',
      startedAt: Number(lastRepoSync.startedAt || 0),
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
  } catch (e) {
    lastRepoSync = {
      ...lastRepoSync,
      ok: false,
      running: false,
      phase: 'failed',
      checkedAt: Date.now(),
      message: `Repo-Sync Fehler: ${String(e && e.message || e)}`
    };
    return lastRepoSync;
  }
}

function startRepoSyncJob() {
  if (repoSyncPromise && lastRepoSync.running) return repoSyncPromise;
  repoSyncPromise = runRepoSyncCheck().finally(() => {
    repoSyncPromise = null;
  });
  return repoSyncPromise;
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
    const corePayload = hasCore ? await readJsonMaybeGz(coreFile, null) : null;
    const poiPayload = hasPoi ? await readJsonMaybeGz(poiFile, null) : null;
    const counts = getTileCounts(corePayload, poiPayload);
    const totalCount = counts.obs + counts.lin + counts.poi;
    const dataStatus = hasCore && hasPoi ? getTileDataStatus(corePayload, poiPayload) : 'partial';

    const coreMtime = Number(coreStat?.mtimeMs || 0);
    const poiMtime = Number(poiStat?.mtimeMs || 0);
    const mtimeMs = Math.max(coreMtime, poiMtime);
    const stale = ((hasCore && (now - coreMtime) > STALE_AFTER_MS) || (hasPoi && (now - poiMtime) > STALE_AFTER_MS));
    const regionMeta = getRegionMetaForTile(tileKey);
    const partialCoveragePossible = !WORKBENCH_PBF_PATH && regionMeta.count > WORKBENCH_PBF_MAX_REGIONS;
    const partialReason = partialCoveragePossible
      ? `Tile schneidet ${regionMeta.count} Regionen (Limit ${WORKBENCH_PBF_MAX_REGIONS})`
      : '';

    loadedMap[tileKey] = {
      mtimeMs,
      stale,
      bytes: Number(coreStat?.size || 0) + Number(poiStat?.size || 0),
      bytesCore: Number(coreStat?.size || 0),
      bytesPoi: Number(poiStat?.size || 0),
      hasCore,
      hasPoi,
      dataStatus,
      empty: dataStatus === 'empty',
      counts,
      totalCount,
      regionOverlapCount: Number(regionMeta.count || 0),
      regionOverlapIds: Array.isArray(regionMeta.ids) ? regionMeta.ids.slice(0, 8) : [],
      partialCoveragePossible,
      partialReason
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
      pbfAvailable: !!WORKBENCH_PBF_PATH && existsSync(WORKBENCH_PBF_PATH),
      cacheDir: CACHE_BASE,
      cacheRecoveryRetrySec: Math.round(WORKBENCH_CACHE_RECOVERY_RETRY_MS / 1000),
      pbfMaxRegions: WORKBENCH_PBF_MAX_REGIONS,
      pbfThinExtend: WORKBENCH_PBF_THIN_EXTEND,
      pbfThinThresholds: {
        obsMax: WORKBENCH_PBF_THIN_OBS_MAX,
        linMax: WORKBENCH_PBF_THIN_LIN_MAX,
        poiMax: WORKBENCH_PBF_THIN_POI_MAX
      }
    },
    gapConfig: {
      mode: 'region-overlap-limit',
      maxRegionsPerTile: WORKBENCH_PBF_MAX_REGIONS,
      enabled: !WORKBENCH_PBF_PATH
    },
    regions: REGIONS.map(r => ({
      id: String(r.id),
      name: String(r.name),
      continent: String(r.continent || ''),
      sizeMb: Number(r.sizeMb || 0),
      bbox: Array.isArray(r.bbox) ? r.bbox.map(Number) : [],
      coverage: (regionPolyCache.get(String(r.id)) || {}).mode || 'unknown'
    })),
    downloads: Object.fromEntries(pbfDownloads),
    processing,
    currentTile,
    queue: queue.slice(),
    queueFresh: queue.filter(k => queueFreshSet.has(k)),
    queueLength: queue.length,
    tileStepDeg: TILE_STEP_DEG,
    staleAfterDays: 90,
    loaded: loadedMap,
    failed: failedMap,
    recent,
    processSeq,
    processLogTail: processLog.slice(-80),
    currentProgress: { ...currentProgress },
    manifest: {
      generatedAt: coreManifest.generatedAt || null,
      tileCount: Number(coreManifest.tileCount || Object.keys(loadedMap).length || 0)
    },
    repoSync: {
      ok: !!lastRepoSync.ok,
      running: !!lastRepoSync.running,
      phase: String(lastRepoSync.phase || 'idle'),
      startedAt: Number(lastRepoSync.startedAt || 0),
      checkedAt: Number(lastRepoSync.checkedAt || 0),
      message: String(lastRepoSync.message || ''),
      remoteRef: String(lastRepoSync.remoteRef || 'origin/main'),
      remoteTiles: Array.isArray(lastRepoSync.remoteTiles) ? lastRepoSync.remoteTiles : [],
      missingInRepoTiles: Array.isArray(lastRepoSync.missingInRepoTiles) ? lastRepoSync.missingInRepoTiles : [],
      remoteTileCount: Number(lastRepoSync.remoteTileCount || 0),
      localTileCount: Number(lastRepoSync.localTileCount || 0),
      missingInRepoCount: Number(lastRepoSync.missingInRepoCount || 0),
      missingLocalCount: Number(lastRepoSync.missingLocalCount || 0),
      missingInRepoSample: Array.isArray(lastRepoSync.missingInRepoSample) ? lastRepoSync.missingInRepoSample : [],
      missingLocalSample: Array.isArray(lastRepoSync.missingLocalSample) ? lastRepoSync.missingLocalSample : []
    }
  };
}

function enqueueTiles(tileKeys, options = {}) {
  const fresh = !!(options && options.fresh);
  const added = [];
  for (const raw of Array.isArray(tileKeys) ? tileKeys : []) {
    const key = normalizeTileKey(raw);
    if (!key) continue;
    if (queueSet.has(key)) {
      if (fresh) queueFreshSet.add(key);
      continue;
    }
    if (key === currentTile) continue;
    queue.push(key);
    queueSet.add(key);
    if (fresh) queueFreshSet.add(key);
    added.push(key);
  }
  if (added.length > 0) processQueue();
  return added;
}

async function listRegionTiles(regionIds) {
  const selected = [];
  const tileSet = new Set();
  for (const rawId of Array.isArray(regionIds) ? regionIds : []) {
    const id = String(rawId || '').trim();
    if (!id) continue;
    const region = REGION_BY_ID.get(id);
    if (!region) continue;
    selected.push(region);
    const keys = await collectRegionTileKeys(region);
    for (const tileKey of keys) tileSet.add(tileKey);
  }
  return {
    selectedRegions: selected.map(r => ({ id: r.id, name: r.name, sizeMb: Number(r.sizeMb || 0), bbox: r.bbox })),
    tiles: Array.from(tileSet).sort()
  };
}

async function enqueueRegions(regionIds) {
  const listed = await listRegionTiles(regionIds);
  const added = enqueueTiles(listed.tiles);
  return {
    selectedRegions: listed.selectedRegions,
    tiles: listed.tiles,
    foundTiles: listed.tiles.length,
    added
  };
}

async function processOneTile(tileKey, options = {}) {
  await assertCacheWritableOrThrow('before-tile');
  currentTile = tileKey;
  const startedAt = Date.now();
  const freshReload = !!(options && options.freshReload);
  setCurrentProgress({
    tile: tileKey,
    phase: 'preparing',
    source: '',
    pbfRegions: [],
    relevantRegionCount: 0,
    lowCoverage: false,
    thinDetected: false,
    thinExtended: false,
    message: freshReload ? 'Starte Tile-Verarbeitung (frisch laden)' : 'Starte Tile-Verarbeitung',
    startedAt
  });

  const combinedFile = tilePath(WORKBENCH_TMP_OUT_DIR, tileKey);
  const coreOut = tileGzPath(CORE_TILE_DIR, tileKey);
  const poiOut = tileGzPath(POI_TILE_DIR, tileKey);
  const coreLegacyOut = tilePath(CORE_TILE_DIR, tileKey);
  const poiLegacyOut = tilePath(POI_TILE_DIR, tileKey);
  const prevCoreFile = existsSync(coreOut) ? coreOut : (existsSync(coreLegacyOut) ? coreLegacyOut : '');
  const prevPoiFile = existsSync(poiOut) ? poiOut : (existsSync(poiLegacyOut) ? poiLegacyOut : '');
  const prevCorePayload = (!freshReload && prevCoreFile) ? await readJsonMaybeGz(prevCoreFile, null) : null;
  const prevPoiPayload = (!freshReload && prevPoiFile) ? await readJsonMaybeGz(prevPoiFile, null) : null;

  await ensureDir(WORKBENCH_TMP_OUT_DIR);

  let run = { code: 1, stdout: '', stderr: '' };
  let loadSource = 'pbf';
  let pbfErrorText = '';
  let failedItem = null;
  const failRecord = async (info = {}) => {
    const probeText = [
      String(info.error || ''),
      String(info.server || ''),
      String(run.stderr || ''),
      String(run.stdout || ''),
      String(pbfErrorText || '')
    ].join(' | ');
    if (looksLikeCacheUnavailable(probeText)) {
      throw new CacheUnavailableError(`Cache/Datenträgerproblem während Tile ${tileKey}: ${probeText.slice(0, 220)}`);
    }
    await upsertFailedTile(tileKey, info);
  };

  const pbfResolution = await resolvePbfPathsForTile(tileKey);
  const pbfPaths = Array.isArray(pbfResolution?.selectedPaths) ? pbfResolution.selectedPaths : [];
  const pbfRemainingPaths = Array.isArray(pbfResolution?.remainingPaths) ? pbfResolution.remainingPaths : [];
  const pbfRegionIds = Array.isArray(pbfResolution?.selectedRegionIds) ? pbfResolution.selectedRegionIds.filter(Boolean) : [];
  const pbfRemainingRegionIds = Array.isArray(pbfResolution?.remainingRegionIds) ? pbfResolution.remainingRegionIds.filter(Boolean) : [];
  const relevantRegionCount = Number(pbfResolution?.relevantRegionCount || 0);
  const lowCoverage = relevantRegionCount > pbfRegionIds.length;
  setCurrentProgress({
    phase: 'source-select',
    source: pbfPaths.length > 0 ? 'pbf' : 'overpass',
    pbfRegions: pbfRegionIds.slice(),
    relevantRegionCount,
    lowCoverage,
    message: `Quelle gewählt (${pbfPaths.length > 0 ? 'PBF' : 'Overpass'})`
  });
  pushProcessEvent('tile-start', {
    tile: tileKey,
    freshReload,
    pbfRegions: pbfRegionIds.slice(),
    pbfRegionsExtra: pbfRemainingRegionIds.slice(),
    relevantRegionCount,
    lowCoverage,
    source: pbfPaths.length > 0 ? 'pbf' : 'overpass'
  });

  if (pbfPaths.length > 0) {
    setCurrentProgress({
      phase: 'load-pbf',
      source: 'pbf',
      message: `Lade aus PBF (${pbfRegionIds.join(', ') || 'manuell'})`
    });
    pushProcessEvent('pbf-load-start', {
      tile: tileKey,
      pbfRegions: pbfRegionIds.slice(),
      pbfRegionsExtra: pbfRemainingRegionIds.slice(),
      lowCoverage
    });
    const extracted = await extractPbfChunksForTile(tileKey, pbfPaths, combinedFile);
    let chunkResults = extracted.chunkResults;
    run = extracted.run;
    if (chunkResults.length > 0) {
      let merged = mergeCombinedChunks(chunkResults, { tile: tileKey });
      const thinDetected = isThinCombinedPayload(merged);
      setCurrentProgress({
        thinDetected,
        message: `PBF Rohdaten: obs=${merged.obs.length}, lin=${merged.lin.length}, poi=${merged.poi.length}`
      });
      if (thinDetected) {
        pushProcessEvent('coverage-check', {
          tile: tileKey,
          lowCoverage,
          thinDetected,
          counts: { obs: merged.obs.length, lin: merged.lin.length, poi: merged.poi.length }
        });
      }
      if (WORKBENCH_PBF_THIN_EXTEND && pbfRemainingPaths.length > 0 && thinDetected) {
        setCurrentProgress({
          phase: 'load-pbf-extend',
          thinExtended: true,
          message: `Niedrige Abdeckung erkannt, erweitere mit ${pbfRemainingRegionIds.join(', ') || 'zusätzlichen Regionen'}`
        });
        pushProcessEvent('pbf-thin-extend', {
          tile: tileKey,
          pbfRegionsExtra: pbfRemainingRegionIds.slice()
        });
        const extra = await extractPbfChunksForTile(tileKey, pbfRemainingPaths, combinedFile);
        if (extra.chunkResults.length > 0) {
          chunkResults = chunkResults.concat(extra.chunkResults);
          merged = mergeCombinedChunks(chunkResults, { tile: tileKey });
          setCurrentProgress({
            message: `Erweiterte Rohdaten: obs=${merged.obs.length}, lin=${merged.lin.length}, poi=${merged.poi.length}`
          });
        }
      }
      const total = merged.obs.length + merged.lin.length + merged.poi.length;
      await ensureDir(path.dirname(combinedFile));
      await fs.writeFile(combinedFile, JSON.stringify(merged));
      if (total === 0) {
        setCurrentProgress({
          message: 'PBF lieferte keine Features; leerer Tile wird gespeichert'
        });
      }
    } else {
      loadSource = 'overpass';
      pbfErrorText = (run.stderr || run.stdout || '').trim() || 'PBF-Extraktion fehlgeschlagen';
      pushProcessEvent('overpass-fallback', {
        tile: tileKey,
        reason: pbfErrorText
      });
      setCurrentProgress({
        phase: 'fallback-overpass',
        source: 'overpass',
        message: pbfErrorText
      });
    }
  } else {
    loadSource = 'overpass';
    pbfErrorText = 'Keine PBF-Region für dieses Tile gefunden';
    pushProcessEvent('overpass-fallback', {
      tile: tileKey,
      reason: pbfErrorText
    });
    setCurrentProgress({
      phase: 'fallback-overpass',
      source: 'overpass',
      message: pbfErrorText
    });
  }

  if (loadSource === 'overpass') {
    setCurrentProgress({
      phase: 'load-overpass',
      source: 'overpass',
      message: `Fallback lädt ${tileKey} via Overpass`
    });
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
  let finalObs = 0;
  let finalLin = 0;
  let finalPoi = 0;
  let dataStatus = 'failed';

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
      const outObs = Number(corePayload?.counts?.obs || 0);
      const outLin = Number(corePayload?.counts?.lin || 0);
      const outPoi = Number(poiPayload?.counts?.poi || 0);
      const outTotal = outObs + outLin + outPoi;
      finalObs = outObs;
      finalLin = outLin;
      finalPoi = outPoi;
      dataStatus = outTotal === 0 ? 'empty' : 'loaded';
      const meta = {
        dataStatus,
        rawCounts: {
          obs: Number(corePayload?.meta?.rawCounts?.obs || outObs),
          lin: Number(corePayload?.meta?.rawCounts?.lin || outLin),
          poi: Number(poiPayload?.meta?.rawCounts?.poi || outPoi)
        }
      };
      corePayload.meta = meta;
      poiPayload.meta = meta;
      await writeGzJson(coreOut, corePayload);
      await writeGzJson(poiOut, poiPayload);

      await upsertManifestTile(CORE_MANIFEST_PATH, tileKey);
      await upsertManifestTile(POI_MANIFEST_PATH, tileKey);
      await removeFailedTile(tileKey);
      // Delete old plain .json counterparts (migrating to .json.gz)
      try { await fs.unlink(tilePath(CORE_TILE_DIR, tileKey)); } catch (_) {}
      try { await fs.unlink(tilePath(POI_TILE_DIR, tileKey)); } catch (_) {}
      ok = true;
      message = outTotal === 0
        ? `Tile geladen (${loadSource}), leerer Split gespeichert`
        : `Tile geladen (${loadSource}), gesplittet und gespeichert`;
    } else {
      await failRecord({
        status: 0,
        error: (splitRun.stderr || splitRun.stdout || 'Split fehlgeschlagen').trim()
      });
      message = (splitRun.stderr || splitRun.stdout || 'Split fehlgeschlagen').trim() || 'Split fehlgeschlagen';
    }
  } else {
    await failRecord({
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
    dataStatus,
    counts: { obs: finalObs, lin: finalLin, poi: finalPoi },
    message
  });
  setCurrentProgress({
    phase: ok ? 'done' : 'failed',
    source: loadSource,
    message,
    thinDetected: currentProgress.thinDetected,
    thinExtended: currentProgress.thinExtended
  });
  pushProcessEvent('tile-done', {
    tile: tileKey,
    freshReload,
    ok,
    source: loadSource,
    pbfRegions: pbfRegionIds.slice(),
    lowCoverage,
    dataStatus,
    counts: { obs: finalObs, lin: finalLin, poi: finalPoi },
    message
  });
}

async function processQueue() {
  if (processing) return;
  processing = true;
  try {
    while (queue.length > 0) {
      const next = queue.shift();
      const nextFresh = queueFreshSet.has(next);
      queueSet.delete(next);
      queueFreshSet.delete(next);
      if (!next) continue;
      try {
        await processOneTile(next, { freshReload: nextFresh });
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
        const errText = String(err && err.message || err || '');
        if ((err && err.code === 'CACHE_UNAVAILABLE') || looksLikeCacheUnavailable(errText)) {
          const msg = `Cache offline – Tile ${next} wird pausiert und automatisch erneut versucht`;
          pushProcessEvent('cache-offline', { tile: next, message: msg });
          setCurrentProgress({
            tile: next,
            phase: 'cache-wait',
            source: '',
            message: msg
          });
          await removeFailedTile(next).catch(() => {});
          lastResults.set(next, {
            ok: false,
            at: Date.now(),
            durationMs: 0,
            code: 1,
            message: msg
          });
          if (!queueSet.has(next)) {
            queue.unshift(next);
            queueSet.add(next);
            if (nextFresh) queueFreshSet.add(next);
          }
          await waitForCacheRecovery();
          continue;
        }
        const errMsg = `Interner Fehler: ${String(err && err.message || err)}`;
        pushProcessEvent('tile-error', { tile: next, message: errMsg });
        setCurrentProgress({
          tile: next,
          phase: 'failed',
          source: '',
          message: errMsg
        });
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
        if (queue.length === 0) {
          setCurrentProgress({
            tile: null,
            phase: 'idle',
            source: '',
            pbfRegions: [],
            relevantRegionCount: 0,
            lowCoverage: false,
            thinDetected: false,
            thinExtended: false,
            message: 'Queue leer'
          });
        }
      }
    }
  } finally {
    processing = false;
    currentTile = null;
    setCurrentProgress({
      tile: null,
      phase: 'idle',
      source: '',
      pbfRegions: [],
      relevantRegionCount: 0,
      lowCoverage: false,
      thinDetected: false,
      thinExtended: false,
      message: queue.length > 0 ? `Queue pausiert (${queue.length} offen)` : 'Queue leer'
    });
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
      const fresh = !!(body && body.fresh);
      const added = enqueueTiles(body && body.tiles, { fresh });
      return sendJson(res, 200, {
        ok: true,
        added,
        fresh,
        queueLength: queue.length,
        processing,
        currentTile
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/enqueue-region') {
      const body = await parseBody(req);
      if (body && body.autoPush) autoPushWhenDone = true;
      const out = await enqueueRegions(body && body.regionIds);
      return sendJson(res, 200, {
        ok: true,
        selectedRegions: out.selectedRegions,
        foundTiles: Number(out.foundTiles || 0),
        added: out.added,
        queueLength: queue.length,
        processing,
        currentTile
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/region-tiles') {
      const body = await parseBody(req);
      const out = await listRegionTiles(body && body.regionIds);
      return sendJson(res, 200, {
        ok: true,
        selectedRegions: out.selectedRegions,
        tiles: out.tiles,
        foundTiles: Number(out.tiles.length || 0)
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/clear-queue') {
      queue.length = 0;
      queueSet.clear();
      queueFreshSet.clear();
      return sendJson(res, 200, { ok: true, queueLength: 0, processing, currentTile });
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
      startRepoSyncJob();
      return sendJson(res, 202, {
        ok: true,
        started: true,
        repoSync: lastRepoSync
      });
    }

    if (req.method === 'GET' && url.pathname === '/api/repo-sync') {
      return sendJson(res, lastRepoSync.ok || lastRepoSync.running ? 200 : 500, {
        ok: !!lastRepoSync.ok || !!lastRepoSync.running,
        ...lastRepoSync
      });
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
