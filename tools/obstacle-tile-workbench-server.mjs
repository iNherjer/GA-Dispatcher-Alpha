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
const INFRA_TILE_DIR = path.join(OBST_DIR, 'infra-tiles');
const CORE_MANIFEST_PATH = path.join(OBST_DIR, 'core-manifest.v1.json');
const POI_MANIFEST_PATH = path.join(OBST_DIR, 'poi-manifest.v1.json');
const INFRA_MANIFEST_PATH = path.join(OBST_DIR, 'infra-manifest.v1.json');
const FAILED_PATH = path.join(OBST_DIR, 'failed-split-tiles.json');

const WORKBENCH_TMP_DIR = path.join(CACHE_BASE, 'obs-split');
const WORKBENCH_TMP_OUT_DIR = path.join(WORKBENCH_TMP_DIR, 'combined-tiles');
const WORKBENCH_TMP_ENRICH_DIR = path.join(WORKBENCH_TMP_DIR, 'infra-enrichment');
const WORKBENCH_DUCKDB_TMP_DIR = path.join(WORKBENCH_TMP_DIR, 'duckdb-temp');
const WORKBENCH_TMP_MANIFEST = path.join(WORKBENCH_TMP_DIR, 'combined-manifest.v1.json');
const WORKBENCH_TMP_FAILED = path.join(WORKBENCH_TMP_DIR, 'combined-failed-tiles.json');
const WORKBENCH_PBF_PATH = String(process.env.OBS_WORKBENCH_PBF_PATH || '').trim();
const WORKBENCH_PBF_MAX_REGIONS = Math.max(1, Number(process.env.OBS_WORKBENCH_PBF_MAX_REGIONS || _cfg.pbfMaxRegions || 6));
const WORKBENCH_PBF_BORDER_EXTRA_MIN_RATIO = Math.max(0, Number(process.env.OBS_WORKBENCH_PBF_BORDER_EXTRA_MIN_RATIO || _cfg.pbfBorderExtraMinRatio || 0.08));
const WORKBENCH_PBF_THIN_EXTEND = String(process.env.OBS_WORKBENCH_PBF_THIN_EXTEND || '1') !== '0';
const WORKBENCH_PBF_THIN_OBS_MAX = Math.max(0, Number(process.env.OBS_WORKBENCH_PBF_THIN_OBS_MAX || 1));
const WORKBENCH_PBF_THIN_LIN_MAX = Math.max(0, Number(process.env.OBS_WORKBENCH_PBF_THIN_LIN_MAX || 250));
const WORKBENCH_PBF_THIN_POI_MAX = Math.max(0, Number(process.env.OBS_WORKBENCH_PBF_THIN_POI_MAX || 250));
const WORKBENCH_DUCKDB_MEMORY_LIMIT = String(process.env.OBS_WORKBENCH_DUCKDB_MEMORY_LIMIT || _cfg.duckdbMemoryLimit || '768MB').trim() || '768MB';
const WORKBENCH_DUCKDB_THREADS = Math.max(1, Number(process.env.OBS_WORKBENCH_DUCKDB_THREADS || _cfg.duckdbThreads || 2));
const WORKBENCH_PUSH_REMOTE = normalizeGitRemoteName(process.env.OBS_WORKBENCH_PUSH_REMOTE || _cfg.pushRemote || 'origin', 'origin');
const WORKBENCH_MAIN_BRANCH = normalizeGitBranchName(process.env.OBS_WORKBENCH_MAIN_BRANCH || _cfg.mainBranch || 'main', 'main');
const WORKBENCH_PUSH_BRANCH = normalizeGitBranchName(process.env.OBS_WORKBENCH_PUSH_BRANCH || _cfg.pushBranch || 'tile-workbench', 'tile-workbench');
const WORKBENCH_MAIN_REF = `${WORKBENCH_PUSH_REMOTE}/${WORKBENCH_MAIN_BRANCH}`;
const WORKBENCH_PUSH_REF = `${WORKBENCH_PUSH_REMOTE}/${WORKBENCH_PUSH_BRANCH}`;

const PBF_CACHE_DIR = path.join(CACHE_BASE, 'pbf');
const PBF_CACHE_TTL_DAYS = Math.max(1, Number(process.env.OBS_WORKBENCH_PBF_TTL_DAYS || _cfg.pbfTtlDays || 7));
const PBF_CACHE_TTL_MS = PBF_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

const TILE_STEP_DEG = 25 / 60;
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
const queueRegionHintMap = new Map(); // tileKey -> Set(regionId), used for region-anchored PBF passes
const infraEnrichQueue = [];
const infraEnrichQueueSet = new Set();
const infraEnrichFreshSet = new Set();
const infraEnrichRegionHintMap = new Map(); // tileKey -> Set(regionId), mirrors complete region-anchored fetches
let processing = false;
let currentTile = null;
let infraEnrichProcessing = false;
let infraEnrichCurrentTile = null;
let autoPushWhenDone = false; // set via enqueue autoPush:true
let autoPushInfraEnrichWhenDone = false; // set via enrich autoPush:true
let pushStatus = {
  running: false,
  ok: null,
  phase: 'idle',
  step: '',
  message: 'Noch kein Push gestartet.',
  startedAt: 0,
  finishedAt: 0,
  updatedAt: 0,
  commitMessage: '',
  stagedFiles: []
};
const WORKBENCH_RETRIES = Number(process.env.OBS_WORKBENCH_RETRIES || 4);
const WORKBENCH_DELAY_MS = Number(process.env.OBS_WORKBENCH_DELAY_MS || 2200);
const WORKBENCH_FAIL_COOLDOWN_MS = Number(process.env.OBS_WORKBENCH_FAIL_COOLDOWN_MS || 12000);
const WORKBENCH_504_EXTRA_COOLDOWN_MS = Number(process.env.OBS_WORKBENCH_504_EXTRA_COOLDOWN_MS || 18000);
const WORKBENCH_CACHE_RECOVERY_RETRY_MS = Number(process.env.OBS_WORKBENCH_CACHE_RECOVERY_RETRY_MS || 10000);
const WORKBENCH_PROCESS_LOG_MAX = Math.max(20, Number(process.env.OBS_WORKBENCH_PROCESS_LOG_MAX || 250));
const WORKBENCH_REPO_SYNC_TIMEOUT_MS = Math.max(5000, Number(process.env.OBS_WORKBENCH_REPO_SYNC_TIMEOUT_MS || 25000));
const INFRA_ENRICH_BATCH_TILE_MAX = Math.max(1, Number(process.env.OBS_WORKBENCH_INFRA_BATCH_TILE_MAX || _cfg.infraBatchTileMax || 10));
const COMPLETE_LOAD_BATCH_TILE_MAX = Math.max(1, Number(process.env.OBS_WORKBENCH_COMPLETE_BATCH_TILE_MAX || _cfg.completeBatchTileMax || 10));
const lastResults = new Map();
let lastRepoSync = {
  ok: false,
  running: false,
  phase: 'idle',
  startedAt: 0,
  checkedAt: 0,
  message: 'Noch nicht geprüft.',
  remoteRef: WORKBENCH_PUSH_REF,
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
const tileStateEntryCache = new Map();
let collectTileStatePromise = null;
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

function setPushStatus(patch = {}, options = {}) {
  Object.assign(pushStatus, patch, { updatedAt: Date.now() });
  if (options && options.silent) return pushStatus;
  pushProcessEvent('push-status', {
    tile: '-',
    running: !!pushStatus.running,
    ok: pushStatus.ok,
    phase: pushStatus.phase,
    step: pushStatus.step,
    message: pushStatus.message,
    stagedFileCount: Array.isArray(pushStatus.stagedFiles) ? pushStatus.stagedFiles.length : 0,
    commitMessage: pushStatus.commitMessage || ''
  });
  return pushStatus;
}

function statSignature(filePath, stat, exists) {
  if (!exists || !stat) return 'missing';
  return [
    filePath,
    Math.round(Number(stat.mtimeMs || 0)),
    Number(stat.size || 0)
  ].join('|');
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

function normalizeGitRemoteName(value, fallback) {
  const s = String(value || '').trim();
  if (!s) return fallback;
  if (!/^[A-Za-z0-9._-]+$/.test(s)) return fallback;
  return s;
}

function normalizeGitBranchName(value, fallback) {
  const s = String(value || '').trim();
  if (!s) return fallback;
  if (
    !/^[A-Za-z0-9._/-]+$/.test(s) ||
    s.startsWith('-') ||
    s.startsWith('/') ||
    s.endsWith('/') ||
    s.includes('..') ||
    s.includes('//') ||
    s.endsWith('.lock')
  ) {
    return fallback;
  }
  return s;
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

function normalizeRegionIds(value) {
  const raw = Array.isArray(value) ? value : [value];
  return Array.from(new Set(raw.map(v => String(v || '').trim()).filter(id => id && REGION_BY_ID.has(id))));
}

function getRegionHintsForTile(tileKey) {
  const key = normalizeTileKey(tileKey);
  if (!key) return [];
  return normalizeRegionIds(Array.from(queueRegionHintMap.get(key) || []));
}

function getInfraRegionHintsForTile(tileKey) {
  const key = normalizeTileKey(tileKey);
  if (!key) return [];
  return normalizeRegionIds(Array.from(infraEnrichRegionHintMap.get(key) || []));
}

function mergeQueueRegionHints(tileKey, regionIds) {
  const key = normalizeTileKey(tileKey);
  const ids = normalizeRegionIds(regionIds);
  if (!key || !ids.length) return;
  if (!queueRegionHintMap.has(key)) queueRegionHintMap.set(key, new Set());
  const set = queueRegionHintMap.get(key);
  for (const id of ids) set.add(id);
}

function mergeInfraRegionHints(tileKey, regionIds) {
  const key = normalizeTileKey(tileKey);
  const ids = normalizeRegionIds(regionIds);
  if (!key || !ids.length) return;
  if (!infraEnrichRegionHintMap.has(key)) infraEnrichRegionHintMap.set(key, new Set());
  const set = infraEnrichRegionHintMap.get(key);
  for (const id of ids) set.add(id);
}

function clearQueueRegionHints(tileKey) {
  const key = normalizeTileKey(tileKey);
  if (key) queueRegionHintMap.delete(key);
}

function clearInfraRegionHints(tileKey) {
  const key = normalizeTileKey(tileKey);
  if (key) infraEnrichRegionHintMap.delete(key);
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

function boundsArea(bounds) {
  const height = Math.max(0, Number(bounds?.north || 0) - Number(bounds?.south || 0));
  const width = Math.max(0, Number(bounds?.east || 0) - Number(bounds?.west || 0));
  return height * width;
}

function boundsIntersectionArea(a, b) {
  const south = Math.max(Number(a?.south || 0), Number(b?.south || 0));
  const north = Math.min(Number(a?.north || 0), Number(b?.north || 0));
  const west = Math.max(Number(a?.west || 0), Number(b?.west || 0));
  const east = Math.min(Number(a?.east || 0), Number(b?.east || 0));
  return Math.max(0, north - south) * Math.max(0, east - west);
}

function regionBounds(region) {
  if (!region || !Array.isArray(region.bbox) || region.bbox.length !== 4) return null;
  const [south, west, north, east] = region.bbox.map(Number);
  if (![south, west, north, east].every(Number.isFinite)) return null;
  return {
    south: Math.min(south, north),
    west: Math.min(west, east),
    north: Math.max(south, north),
    east: Math.max(west, east)
  };
}

function tileCenter(bounds) {
  return {
    lat: (Number(bounds?.south || 0) + Number(bounds?.north || 0)) / 2,
    lon: (Number(bounds?.west || 0) + Number(bounds?.east || 0)) / 2
  };
}

function pointInBounds(lon, lat, bounds) {
  return !!bounds &&
    lat >= Number(bounds.south) &&
    lat <= Number(bounds.north) &&
    lon >= Number(bounds.west) &&
    lon <= Number(bounds.east);
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

async function runPbfPythonCmd(args) {
  await ensureDir(WORKBENCH_DUCKDB_TMP_DIR);
  return await runCmd('python3', args, {
    cwd: ROOT,
    env: {
      OBS_WORKBENCH_DUCKDB_TEMP_DIR: WORKBENCH_DUCKDB_TMP_DIR,
      OBS_WORKBENCH_DUCKDB_MEMORY_LIMIT: WORKBENCH_DUCKDB_MEMORY_LIMIT,
      OBS_WORKBENCH_DUCKDB_THREADS: String(WORKBENCH_DUCKDB_THREADS),
      TMPDIR: WORKBENCH_DUCKDB_TMP_DIR,
      TMP: WORKBENCH_DUCKDB_TMP_DIR,
      TEMP: WORKBENCH_DUCKDB_TMP_DIR
    }
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

async function resolveRelevantRegionCandidatesForTile(tileKey) {
  const key = normalizeTileKey(tileKey);
  if (!key) return [];
  const [latI, lonI] = key.split('|').map(Number);
  if (!Number.isFinite(latI) || !Number.isFinite(lonI)) return [];
  const tileBounds = tileBoundsFromIndices(latI, lonI);
  const tileArea = boundsArea(tileBounds) || 1;
  const center = tileCenter(tileBounds);
  const bboxCandidates = findRegionsForTile(key);
  if (!bboxCandidates.length) return [];

  const candidates = [];
  for (const region of bboxCandidates) {
    const coverage = await ensureRegionPolygon(region);
    const poly = coverage.mode === 'poly' ? coverage.polygon : null;
    if (poly && !tileIntersectsPolygon(tileBounds, poly)) continue;
    const bounds = (poly && poly.bbox) ? poly.bbox : regionBounds(region);
    const intersectionRatio = bounds ? boundsIntersectionArea(tileBounds, bounds) / tileArea : 0;
    const centerInside = poly
      ? pointInPoly(center.lon, center.lat, poly)
      : pointInBounds(center.lon, center.lat, bounds);
    candidates.push({
      region,
      regionId: String(region.id || ''),
      coverageMode: coverage.mode === 'poly' ? 'poly' : 'bbox',
      centerInside: !!centerInside,
      intersectionRatio: Math.max(0, Math.min(1, intersectionRatio))
    });
  }
  const out = candidates.length > 0
    ? candidates
    : bboxCandidates.map(region => {
        const bounds = regionBounds(region);
        return {
          region,
          regionId: String(region.id || ''),
          coverageMode: 'bbox',
          centerInside: pointInBounds(center.lon, center.lat, bounds),
          intersectionRatio: bounds ? Math.max(0, Math.min(1, boundsIntersectionArea(tileBounds, bounds) / tileArea)) : 0
        };
      });
  out.sort((a, b) => {
    if (a.centerInside !== b.centerInside) return b.centerInside ? 1 : -1;
    const ratioDelta = Number(b.intersectionRatio || 0) - Number(a.intersectionRatio || 0);
    if (Math.abs(ratioDelta) > 1e-9) return ratioDelta;
    return Number(a.region?.sizeMb || 0) - Number(b.region?.sizeMb || 0);
  });
  return out;
}

async function resolveRelevantRegionsForTile(tileKey) {
  return (await resolveRelevantRegionCandidatesForTile(tileKey)).map(c => c.region).filter(Boolean);
}

async function ensurePbfPathsForRegionIds(regionIds = [], seen = new Set()) {
  const selectedPaths = [];
  const selectedRegionIds = [];
  for (const rawId of Array.isArray(regionIds) ? regionIds : []) {
    const regionId = String(rawId || '').trim();
    if (!regionId || selectedRegionIds.includes(regionId)) continue;
    const region = REGION_BY_ID.get(regionId);
    if (!region) continue;
    try {
      const p = await ensurePbfRegion(region);
      const rp = path.resolve(p);
      if (!seen.has(rp)) {
        selectedPaths.push(rp);
        seen.add(rp);
      }
      selectedRegionIds.push(regionId);
    } catch (err) {
      console.error(`[PBF] Download fehlgeschlagen für ${region.name}: ${err.message || err}`);
    }
  }
  return { paths: selectedPaths, regionIds: selectedRegionIds };
}

async function resolvePbfPathsForTile(tileKey, options = {}) {
  const selectedPaths = [];
  const remainingPaths = [];
  const seen = new Set();
  const selectedRegionIds = [];
  const remainingRegionIds = [];
  const preferredRegionIds = normalizeRegionIds(options && options.preferredRegionIds);
  const regionAnchored = preferredRegionIds.length > 0 && options.regionAnchored !== false;
  // Manual path is preferred when present, but no longer exclusive.
  if (WORKBENCH_PBF_PATH && existsSync(WORKBENCH_PBF_PATH)) {
    const rp = path.resolve(WORKBENCH_PBF_PATH);
    selectedPaths.push(rp);
    seen.add(rp);
  }
  const candidates = await resolveRelevantRegionCandidatesForTile(tileKey);
  const selectedCandidates = [];
  const remainingCandidates = [];
  let usedRegionAnchor = false;

  if (regionAnchored) {
    const candidateById = new Map(candidates.map(c => [String(c.regionId || ''), c]));
    for (const regionId of preferredRegionIds) {
      const candidate = candidateById.get(regionId);
      if (!candidate) continue;
      if (selectedCandidates.length >= WORKBENCH_PBF_MAX_REGIONS) {
        remainingCandidates.push({
          ...candidate,
          selected: false,
          deferred: true,
          significant: true,
          reason: 'max-regions'
        });
        continue;
      }
      selectedCandidates.push({
        ...candidate,
        selected: true,
        deferred: false,
        significant: true,
        reason: 'region-anchor'
      });
    }
    usedRegionAnchor = selectedCandidates.length > 0;
    const selectedIds = new Set(selectedCandidates.map(c => c.regionId));
    for (const candidate of candidates) {
      if (selectedIds.has(candidate.regionId)) continue;
      remainingCandidates.push({
        ...candidate,
        selected: false,
        deferred: true,
        significant: false,
        reason: 'neighbor-region-pass'
      });
    }
  }

  if (!selectedCandidates.length) {
    usedRegionAnchor = false;
    remainingCandidates.length = 0;
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const primary = selectedCandidates.length === 0;
      const significantBorder = !!candidate.centerInside || Number(candidate.intersectionRatio || 0) >= WORKBENCH_PBF_BORDER_EXTRA_MIN_RATIO;
      const shouldSelect = primary || significantBorder;
      const annotated = {
        ...candidate,
        selected: false,
        deferred: false,
        significant: shouldSelect,
        reason: primary ? 'primary' : (significantBorder ? 'border-extra' : 'thin-fallback-only')
      };
      if (shouldSelect && selectedCandidates.length < WORKBENCH_PBF_MAX_REGIONS) {
        annotated.selected = true;
        selectedCandidates.push(annotated);
      } else {
        annotated.deferred = true;
        if (shouldSelect) annotated.reason = 'max-regions';
        remainingCandidates.push(annotated);
      }
    }
  }
  const ensured = await ensurePbfPathsForRegionIds(selectedCandidates.map(c => c.regionId), seen);
  selectedPaths.push(...ensured.paths);
  selectedRegionIds.push(...ensured.regionIds);
  const significantRemainingRegionIds = remainingCandidates
    .filter(c => c.significant && !usedRegionAnchor)
    .map(c => c.regionId)
    .filter(Boolean);
  for (const regionId of significantRemainingRegionIds) {
    const region = REGION_BY_ID.get(regionId);
    if (!region) continue;
    try {
      const p = await ensurePbfRegion(region);
      const rp = path.resolve(p);
      if (!seen.has(rp)) {
        remainingPaths.push(rp);
        seen.add(rp);
      }
      remainingRegionIds.push(regionId);
    } catch (err) {
      console.error(`[PBF] Download fehlgeschlagen für ${region.name}: ${err.message || err}`);
    }
  }
  const deferredRegionIds = remainingCandidates.map(c => c.regionId).filter(Boolean);
  return {
    selectedPaths,
    remainingPaths,
    selectedRegionIds,
    remainingRegionIds: Array.from(new Set(remainingRegionIds.concat(deferredRegionIds))),
    significantRemainingRegionIds,
    relevantRegionCount: candidates.length,
    selectedRegionCount: selectedCandidates.length,
    deferredRegionCount: remainingCandidates.length,
    significantRemainingCount: significantRemainingRegionIds.length,
    regionAnchored: usedRegionAnchor,
    allowThinExtend: !usedRegionAnchor,
    regionDecisions: selectedCandidates.concat(remainingCandidates).map(c => ({
      id: c.regionId,
      mode: c.coverageMode,
      selected: !!c.selected,
      deferred: !!c.deferred,
      significant: !!c.significant,
      centerInside: !!c.centerInside,
      intersectionRatio: Math.round(Number(c.intersectionRatio || 0) * 10000) / 10000,
      reason: c.reason
    }))
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
    const r = await runPbfPythonCmd(pbfCmd);
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

async function extractPbfCombinedBatchForPbf(tileKeys, pbfPath) {
  const cleanTiles = Array.from(new Set((Array.isArray(tileKeys) ? tileKeys : []).map(normalizeTileKey).filter(Boolean)));
  const tmpDir = path.join(WORKBENCH_TMP_OUT_DIR, `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await ensureDir(tmpDir);
  const cmd = [
    'tools/dryrun_pbf_combined_chunk.py',
    '--pbf', pbfPath,
    '--tiles', cleanTiles.join(','),
    '--out-dir', path.relative(ROOT, tmpDir)
  ];
  const run = await runPbfPythonCmd(cmd);
  const filesByTile = new Map();
  for (const tileKey of cleanTiles) {
    const filePath = path.join(tmpDir, `${tileKey.replace('|', '_')}.combined.json`);
    if (existsSync(filePath)) filesByTile.set(tileKey, filePath);
  }
  return { run, filesByTile, tmpDir };
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

function getTileCounts(corePayload, poiPayload, infraPayload = null) {
  return {
    obs: Number(corePayload?.counts?.obs || 0),
    lin: Number(corePayload?.counts?.lin || 0),
    poi: Number(poiPayload?.counts?.poi || 0),
    infra: Number(infraPayload?.counts?.infra || infraPayload?.counts?.poi || infraPayload?.infra?.poi?.length || 0),
    clusters: Number(infraPayload?.counts?.clusters || infraPayload?.infra?.clusters?.length || 0)
  };
}

function getTileDataStatus(corePayload, poiPayload, infraPayload = null) {
  const explicit = String(corePayload?.meta?.dataStatus || poiPayload?.meta?.dataStatus || '').trim();
  if (explicit === 'empty' || explicit === 'loaded') return explicit;
  const counts = getTileCounts(corePayload, poiPayload, infraPayload);
  return (counts.obs + counts.lin + counts.poi + counts.infra + counts.clusters) === 0 ? 'empty' : 'loaded';
}

function emptyTileCounts() {
  return { obs: 0, lin: 0, poi: 0, infra: 0, clusters: 0 };
}

function countsFromRecentResult(tileKey) {
  const recent = lastResults.get(tileKey);
  const rawCounts = recent && recent.ok !== false && recent.counts ? recent.counts : null;
  if (!rawCounts) return null;
  return {
    obs: Number(rawCounts.obs || 0),
    lin: Number(rawCounts.lin || 0),
    poi: Number(rawCounts.poi || 0),
    infra: Number(rawCounts.infra || rawCounts.poiInfra || 0),
    clusters: Number(rawCounts.clusters || 0)
  };
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
    meta: existingPoi?.meta || incomingPoi?.meta || undefined,
    poi: { poi },
    counts: { poi: poi.length }
  };
}

const INFRA_ENRICHMENT_SCHEMA = 'ga.infraEnrichment.v1';
const INFRA_ENRICHMENT_FIELDS = [
  'infra_type',
  'ref',
  'operator',
  'osm_kind',
  'osm_id',
  'generator_source',
  'plant_source',
  'generator_method',
  'plant_method',
  'substation',
  'transformer',
  'voltage',
  'frequency',
  'location',
  'utility',
  'bridge',
  'service',
  'industrial',
  'building',
  'building_use',
  'construction',
  'content',
  'healthcare',
  'office',
  'shop',
  'public_transport',
  'emergency',
  'barrier',
  'tunnel',
  'pipeline',
  'substance',
  'monitoring',
  'monitoring_water_level',
  'lock_tag',
  'embankment',
  'recycling_type',
  'material',
  'cluster_type',
  'cluster_count',
  'cluster_radius_nm',
  'cluster_sample_names',
  'infra_cluster',
  'sample_count',
  'infra_enriched'
];

function nonEmptyValue(value) {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  return String(value).trim() !== '';
}

const INFRA_MAJOR_HIGHWAY = new Set([
  'motorway', 'motorway_link',
  'trunk', 'trunk_link',
  'primary', 'primary_link',
  'secondary', 'secondary_link',
  'tertiary', 'tertiary_link'
]);
const INFRA_DRIVABLE_HIGHWAY = new Set([
  ...INFRA_MAJOR_HIGHWAY,
  'living_street',
  'residential',
  'road',
  'service',
  'unclassified'
]);
const INFRA_MAJOR_RAIL = new Set(['rail', 'light_rail', 'narrow_gauge', 'subway', 'tram']);
const INFRA_RAIL_FACILITIES = new Set(['station', 'halt', 'signal_box', 'switch', 'signal', 'level_crossing', 'crossing', 'junction', 'platform', 'buffer_stop']);
const INFRA_INDUSTRIAL_MAN_MADE = new Set([
  'water_works', 'wastewater_plant', 'works', 'storage_tank', 'silo',
  'chimney', 'tower', 'mast', 'communications_tower', 'water_tower', 'gasometer'
]);
const INFRA_PUBLIC_BUILDINGS = new Set(['civic', 'commercial', 'hospital', 'industrial', 'public', 'retail', 'school', 'train_station', 'transportation', 'university', 'warehouse']);
const INFRA_PUBLIC_AMENITIES = new Set(['bus_station', 'clinic', 'college', 'community_centre', 'courthouse', 'fire_station', 'fuel', 'hospital', 'kindergarten', 'police', 'post_office', 'school', 'townhall', 'university', 'water_works', 'wastewater_plant', 'waste_transfer_station']);
const INFRA_WATER_UTILITY_AMENITIES = new Set(['water_works', 'wastewater_plant']);
const INFRA_WASTE_AMENITIES = new Set(['recycling', 'waste_disposal', 'waste_transfer_station']);
const INFRA_MARINE_AMENITIES = new Set(['ferry_terminal']);
const INFRA_MARINE_LEISURE = new Set(['marina']);
const INFRA_MARINE_MAN_MADE = new Set(['pier', 'dock', 'quay', 'jetty']);
const INFRA_MARINE_WATERWAYS = new Set(['dock', 'lock_gate']);
const INFRA_ENERGY_STORAGE_SOURCES = new Set(['battery', 'storage']);
const INFRA_ENERGY_PLANT_SOURCES = new Set(['biogas', 'biomass', 'gas', 'geothermal', 'oil']);
const INFRA_PIPELINE_UTILITIES = new Set(['gas', 'heating', 'pipeline']);
const INFRA_WATER_UTILITIES = new Set(['water', 'sewerage', 'wastewater']);
const INFRA_TRAFFIC_PROTECTION_BARRIERS = new Set(['noise_barrier', 'retaining_wall']);
const INFRA_PERIMETER_BARRIERS = new Set(['fence', 'gate']);
const INFRA_FLOOD_PROTECTION_MAN_MADE = new Set(['dyke', 'embankment']);
const INFRA_FEATURE_TYPE_CAPS = {
  bridge: 900,
  rail: 900,
  power_grid: 650,
  power_station: 650,
  traffic_protection: 500,
  marine_infra: 260,
  perimeter_security: 420,
  public_building: 500,
  industrial: 700,
  road: 700,
  telecom: 650,
  waste: 350,
  water_utility: 350,
  storage_tank: 300,
  fuel: 250,
  pipeline: 300,
  construction: 350,
  solar: 260,
  wind: 300,
  hydro: 350,
  flood_protection: 300,
  quarry: 220,
  energy_plant: 220,
  energy_storage: 160,
  water_tank: 160,
  infra: 250,
  power: 160
};
const INFRA_CLUSTER_TYPE_CAPS = {
  rail: 260,
  solar: 180,
  power_grid: 160,
  construction: 130,
  industrial: 160,
  traffic_protection: 130,
  marine_infra: 80,
  perimeter_security: 120,
  public_building: 120,
  pipeline: 110,
  flood_protection: 100,
  water_utility: 110,
  waste: 100,
  quarry: 80,
  energy_plant: 80,
  energy_storage: 50,
  infra: 80
};
const INFRA_FEATURE_TOTAL_CAP = 4800;
const INFRA_CLUSTER_TOTAL_CAP = 650;

function inferInfraType(raw = {}) {
  const clean = (value) => String(value || '').trim().toLowerCase();
  const power = clean(raw.power);
  const generatorSource = clean(raw.generator_source || raw['generator:source']);
  const plantSource = clean(raw.plant_source || raw['plant:source']);
  const highway = clean(raw.highway);
  const railway = clean(raw.railway);
  const waterway = clean(raw.waterway);
  const manMade = clean(raw.man_made || raw.manMade);
  const bridge = clean(raw.bridge);
  const landuse = clean(raw.landuse);
  const industrial = clean(raw.industrial);
  const amenity = clean(raw.amenity);
  const leisure = clean(raw.leisure);
  const building = clean(raw.building);
  const construction = clean(raw.construction);
  const content = clean(raw.content);
  const location = clean(raw.location);
  const utility = clean(raw.utility);
  const shop = clean(raw.shop);
  const office = clean(raw.office);
  const healthcare = clean(raw.healthcare);
  const emergency = clean(raw.emergency);
  const publicTransport = clean(raw.public_transport);
  const barrier = clean(raw.barrier);
  const tunnel = clean(raw.tunnel);
  const pipeline = clean(raw.pipeline);
  const substance = clean(raw.substance);
  const monitoring = clean(raw.monitoring);
  const monitoringWaterLevel = clean(raw.monitoring_water_level || raw['monitoring:water_level']);
  const lockTag = clean(raw.lock_tag || raw.lock);
  const embankment = clean(raw.embankment);
  const name = clean(raw.name);
  const roofish = location === 'roof' || building === 'roof' || name.includes('dach') || name.includes('roof');
  const positiveLock = !!lockTag && !/^(no|false|0)$/i.test(lockTag);
  if (generatorSource === 'solar' || plantSource === 'solar') return roofish ? 'solar_roof' : 'solar';
  if (generatorSource === 'wind' || plantSource === 'wind') return 'wind';
  if (power === 'storage' || INFRA_ENERGY_STORAGE_SOURCES.has(generatorSource) || INFRA_ENERGY_STORAGE_SOURCES.has(plantSource)) return 'energy_storage';
  if (
    INFRA_MARINE_AMENITIES.has(amenity) ||
    INFRA_MARINE_LEISURE.has(leisure) ||
    INFRA_MARINE_MAN_MADE.has(manMade) ||
    INFRA_MARINE_WATERWAYS.has(waterway) ||
    positiveLock ||
    /(hafen|marina|schleuse|anleger|anlegestelle|kai)/.test(name)
  ) return 'marine_infra';
  if (INFRA_PERIMETER_BARRIERS.has(barrier) || /(zaun|wildzaun|schutzzaun|perimeter)/.test(name)) return 'perimeter_security';
  if (/(hydro|water)/.test(`${generatorSource} ${plantSource}`) || ['dam', 'weir'].includes(waterway)) return 'hydro';
  if (INFRA_ENERGY_PLANT_SOURCES.has(generatorSource) || INFRA_ENERGY_PLANT_SOURCES.has(plantSource) || ['plant', 'generator'].includes(power)) return 'energy_plant';
  if (landuse === 'construction' || construction || building === 'construction') return 'construction';
  if (['substation', 'transformer', 'switchgear', 'converter', 'compensator'].includes(power)) return 'power_station';
  if (['line', 'minor_line', 'cable', 'tower', 'pole'].includes(power)) return 'power_grid';
  if (bridge && bridge !== 'no') return 'bridge';
  if (manMade === 'bridge') return 'bridge';
  if (INFRA_MAJOR_RAIL.has(railway) || INFRA_RAIL_FACILITIES.has(railway)) return 'rail';
  if (INFRA_MAJOR_HIGHWAY.has(highway)) return 'road';
  if (amenity === 'fuel') return 'fuel';
  if (manMade === 'pipeline' || pipeline || INFRA_PIPELINE_UTILITIES.has(utility) || ['gas', 'oil', 'hot_water', 'steam'].includes(substance)) return 'pipeline';
  if (
    manMade === 'pumping_station' ||
    INFRA_WATER_UTILITY_AMENITIES.has(amenity) ||
    INFRA_WATER_UTILITIES.has(utility) ||
    waterway === 'lock_gate' ||
    positiveLock ||
    monitoringWaterLevel ||
    monitoring.includes('water_level')
  ) return 'water_utility';
  if (landuse === 'landfill' || INFRA_WASTE_AMENITIES.has(amenity)) return 'waste';
  if (landuse === 'quarry') return 'quarry';
  if (INFRA_FLOOD_PROTECTION_MAN_MADE.has(manMade) || embankment) return 'flood_protection';
  if (INFRA_TRAFFIC_PROTECTION_BARRIERS.has(barrier) || tunnel) return 'traffic_protection';
  if (manMade === 'water_tower' || (manMade === 'storage_tank' && /(water|wasser)/.test(`${content} ${name}`))) return 'water_tank';
  if (manMade === 'storage_tank') return 'storage_tank';
  if (['tower', 'mast', 'communications_tower'].includes(manMade)) return 'telecom';
  if (
    INFRA_PUBLIC_BUILDINGS.has(building) ||
    INFRA_PUBLIC_AMENITIES.has(amenity) ||
    healthcare ||
    emergency === 'fire_service' ||
    emergency === 'ambulance_station' ||
    office === 'government' ||
    ['station', 'platform'].includes(publicTransport)
  ) return 'public_building';
  if (
    landuse === 'industrial' ||
    industrial ||
    INFRA_INDUSTRIAL_MAN_MADE.has(manMade) ||
    ['water_works', 'wastewater_plant', 'waste_transfer_station', 'bus_station'].includes(amenity) ||
    ['fuel', 'car_repair'].includes(shop)
  ) return 'industrial';
  if (power) return 'power';
  return 'infra';
}

function cleanInfraPoiEntry(raw = {}) {
  const lat = Number(raw?.lat);
  const lon = Number(raw?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const out = {
    name: String(raw?.name || '').slice(0, 90),
    lat: Math.round(lat * 1e5) / 1e5,
    lon: Math.round(lon * 1e5) / 1e5,
    tourism: String(raw?.tourism || '').toLowerCase(),
    historic: String(raw?.historic || '').toLowerCase(),
    natural: String(raw?.natural || '').toLowerCase(),
    water: String(raw?.water || '').toLowerCase(),
    landuse: String(raw?.landuse || '').toLowerCase(),
    amenity: String(raw?.amenity || '').toLowerCase(),
    leisure: String(raw?.leisure || '').toLowerCase(),
    man_made: String(raw?.man_made || '').toLowerCase(),
    power: String(raw?.power || '').toLowerCase(),
    railway: String(raw?.railway || '').toLowerCase(),
    highway: String(raw?.highway || '').toLowerCase(),
    waterway: String(raw?.waterway || '').toLowerCase(),
    layer: String(raw?.layer || '').toLowerCase(),
    place: String(raw?.place || '').toLowerCase(),
    infra_type: String(raw?.infra_type || inferInfraType(raw)).toLowerCase(),
    sourceKind: 'infra'
  };
  for (const key of INFRA_ENRICHMENT_FIELDS) {
    const value = raw?.[key];
    if (!nonEmptyValue(value)) continue;
    if (key === 'sample_count' || key === 'cluster_count') out[key] = Math.max(0, Math.round(Number(value || 0)));
    else if (key === 'cluster_radius_nm') out[key] = Math.max(0, Math.round(Number(value || 0) * 100) / 100);
    else if (key === 'infra_enriched' || key === 'infra_cluster') out[key] = true;
    else out[key] = String(value).slice(0, 120);
  }
  out.infra_enriched = true;
  if (isLowValueInfraEntry(out)) return null;
  return out;
}

function isLowValueInfraEntry(e = {}) {
  const clean = (value) => String(value || '').trim().toLowerCase();
  const infraType = clean(e.infra_type || inferInfraType(e));
  const bridge = clean(e.bridge);
  const highway = clean(e.highway);
  const railway = clean(e.railway);
  const manMade = clean(e.man_made);
  const power = clean(e.power);
  const name = clean(e.name);
  const location = clean(e.location);
  const building = clean(e.building);
  if (infraType === 'solar_roof' || ((clean(e.generator_source) === 'solar' || clean(e.plant_source) === 'solar') && (location === 'roof' || building === 'roof' || name.includes('dach') || name.includes('roof')))) {
    return true;
  }
  if (manMade === 'bridge' && !railway && !highway && !name) return true;
  if (((bridge && bridge !== 'no') || manMade === 'bridge') && !INFRA_DRIVABLE_HIGHWAY.has(highway) && !INFRA_MAJOR_RAIL.has(railway) && !name) {
    return true;
  }
  if (power === 'pole') return true;
  const ref = clean(e.ref);
  const operator = clean(e.operator);
  const distinctName = !!name && name !== operator && name !== ref;
  const voltageValues = (String(e.voltage || '').match(/\d+/g) || []).map(Number);
  const voltage = Math.max(0, ...voltageValues);
  const substation = clean(e.substation);
  if (power === 'substation') {
    if (['minor_distribution', 'kiosk', 'transformer'].includes(substation) && voltage < 30000) return true;
    if (!substation && !distinctName && Number(e.sample_count || 0) < 10 && voltage < 30000) return true;
  }
  if (power === 'transformer' && !distinctName && !substation) return true;
  if (INFRA_MAJOR_RAIL.has(railway) && !(bridge && bridge !== 'no') && !clean(e.tunnel)) return true;
  if (railway === 'platform' && !name) return true;
  return false;
}

function maxInfraVoltage(value = '') {
  const nums = String(value || '').match(/\d+/g) || [];
  return nums.reduce((max, raw) => Math.max(max, Number(raw) || 0), 0);
}

function hasDistinctInfraName(e = {}) {
  const clean = (value) => String(value || '').trim().toLowerCase();
  const name = clean(e.name);
  if (!name) return false;
  return name !== clean(e.operator) && name !== clean(e.ref);
}

function infraEntryPriority(e = {}) {
  const clean = (value) => String(value || '').trim().toLowerCase();
  const infraType = clean(e.infra_type || e.cluster_type || inferInfraType(e));
  const railway = clean(e.railway);
  const highway = clean(e.highway);
  const power = clean(e.power);
  const substation = clean(e.substation);
  const bridge = clean(e.bridge);
  const clusterCount = Number(e.cluster_count || 0);
  const sampleCount = Number(e.sample_count || 0);
  const voltage = maxInfraVoltage(e.voltage);
  let score = 0;
  if (hasDistinctInfraName(e)) score += 14;
  if (clean(e.ref)) score += 5;
  if (clean(e.operator)) score += 2;
  if (sampleCount > 0) score += Math.min(8, Math.log2(Math.max(1, sampleCount)));
  if (clusterCount > 0) score += Math.min(10, Math.log2(Math.max(1, clusterCount)) + 2);
  if (infraType === 'bridge') {
    if (INFRA_MAJOR_HIGHWAY.has(highway)) score += 9;
    else if (INFRA_DRIVABLE_HIGHWAY.has(highway)) score += 5;
    if (INFRA_MAJOR_RAIL.has(railway)) score += 8;
    if (bridge === 'viaduct' || bridge === 'aqueduct') score += 4;
  } else if (infraType === 'rail') {
    if (railway === 'station' || railway === 'halt' || railway === 'signal_box') score += 10;
    else if (railway === 'switch' || railway === 'level_crossing' || railway === 'crossing' || railway === 'junction') score += 7;
    else if (railway === 'signal') score += 4;
  } else if (infraType === 'power_station') {
    if (['transmission', 'subtransmission', 'distribution', 'traction', 'generation'].includes(substation)) score += 10;
    if (voltage >= 110000) score += 10;
    else if (voltage >= 30000) score += 6;
    if (['switchgear', 'converter', 'compensator'].includes(power)) score += 5;
  } else if (infraType === 'solar') {
    if (clusterCount >= 3 || sampleCount >= 12 || clean(e.power) === 'plant') score += 8;
  } else if (infraType === 'marine_infra') {
    if (clean(e.waterway) === 'lock_gate') score += 8;
    else if (clean(e.leisure) === 'marina' || clean(e.amenity) === 'ferry_terminal') score += 6;
    else score += 4;
  } else if (infraType === 'perimeter_security') {
    if (clean(e.barrier) === 'gate') score += 5;
    else score += 2;
  } else if (['wind', 'hydro', 'construction', 'pipeline', 'water_utility', 'waste', 'quarry', 'fuel', 'energy_plant', 'energy_storage', 'water_tank'].includes(infraType)) {
    score += 4;
  }
  return score;
}

function capInfraEntriesByType(items = [], caps = {}, totalCap = 0, typeKey = 'infra_type') {
  const groups = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const key = String(item?.[typeKey] || item?.infra_type || 'infra').trim().toLowerCase() || 'infra';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const capped = [];
  for (const [key, group] of groups.entries()) {
    const limit = Number(caps[key] || caps.infra || 250);
    group.sort((a, b) => {
      const score = infraEntryPriority(b) - infraEntryPriority(a);
      if (score) return score;
      return String(a.name || '').localeCompare(String(b.name || ''))
        || Number(a.lat || 0) - Number(b.lat || 0)
        || Number(a.lon || 0) - Number(b.lon || 0);
    });
    capped.push(...group.slice(0, limit));
  }
  capped.sort((a, b) => {
    const typeCmp = String(a?.[typeKey] || a?.infra_type || '').localeCompare(String(b?.[typeKey] || b?.infra_type || ''));
    if (typeCmp) return typeCmp;
    return String(a.name || '').localeCompare(String(b.name || ''))
      || Number(a.lat || 0) - Number(b.lat || 0)
      || Number(a.lon || 0) - Number(b.lon || 0);
  });
  if (!totalCap || capped.length <= totalCap) return capped;
  return capped
    .slice()
    .sort((a, b) => infraEntryPriority(b) - infraEntryPriority(a))
    .slice(0, totalCap)
    .sort((a, b) => String(a?.[typeKey] || a?.infra_type || '').localeCompare(String(b?.[typeKey] || b?.infra_type || ''))
      || String(a.name || '').localeCompare(String(b.name || ''))
      || Number(a.lat || 0) - Number(b.lat || 0)
      || Number(a.lon || 0) - Number(b.lon || 0));
}

function infraPoiPrimaryKey(e = {}) {
  const osmKind = String(e?.osm_kind || '').trim();
  const osmId = String(e?.osm_id || '').trim();
  if (osmKind && osmId) return `osm|${osmKind}|${osmId}`;
  return '';
}

function infraPoiGeoKey(e = {}) {
  return [
    String(e?.name || ''),
    Math.round(Number(e?.lat || 0) * 1e5),
    Math.round(Number(e?.lon || 0) * 1e5),
    String(e?.power || ''),
    String(e?.man_made || ''),
    String(e?.railway || ''),
    String(e?.highway || ''),
    String(e?.waterway || '')
  ].join('|');
}

function mergeInfraPoiEntries(existing = {}, incoming = {}) {
  const out = { ...existing };
  for (const [key, value] of Object.entries(incoming || {})) {
    if (!nonEmptyValue(value)) continue;
    if (key === 'sample_count') {
      out[key] = Math.max(Number(out[key] || 0), Number(value || 0));
    } else if (key === 'infra_enriched') {
      out[key] = true;
    } else {
      out[key] = value;
    }
  }
  out.infra_enriched = true;
  return out;
}

function infraClusterPrimaryKey(e = {}) {
  const osmKind = String(e?.osm_kind || '').trim();
  const osmId = String(e?.osm_id || '').trim();
  if (osmKind && osmId) return `cluster|${osmKind}|${osmId}`;
  const type = String(e?.cluster_type || e?.infra_type || '').trim();
  return [
    'cluster',
    type,
    String(e?.name || ''),
    Math.round(Number(e?.lat || 0) * 1e5),
    Math.round(Number(e?.lon || 0) * 1e5)
  ].join('|');
}

function mergeInfraClusterEntries(existing = {}, incoming = {}) {
  const out = mergeInfraPoiEntries(existing, incoming);
  out.infra_cluster = true;
  out.cluster_type = String(out.cluster_type || out.infra_type || '').toLowerCase();
  return out;
}

function mergeInfraEnrichmentPayload(existingPoi, enrichmentPayload, metaPatch = {}) {
  const exPoi = Array.isArray(existingPoi?.poi?.poi)
    ? existingPoi.poi.poi
    : (Array.isArray(existingPoi?.poi) ? existingPoi.poi : []);
  const incomingRaw = Array.isArray(enrichmentPayload?.poi) ? enrichmentPayload.poi : [];
  const incoming = incomingRaw.map(cleanInfraPoiEntry).filter(Boolean);
  const poi = exPoi.map(e => ({ ...e }));
  const primaryIndex = new Map();
  const geoIndex = new Map();
  for (let i = 0; i < poi.length; i++) {
    const primary = infraPoiPrimaryKey(poi[i]);
    if (primary && !primaryIndex.has(primary)) primaryIndex.set(primary, i);
    const geo = infraPoiGeoKey(poi[i]);
    if (geo && !geoIndex.has(geo)) geoIndex.set(geo, i);
  }

  let added = 0;
  let updated = 0;
  for (const entry of incoming) {
    const primary = infraPoiPrimaryKey(entry);
    const geo = infraPoiGeoKey(entry);
    const idx = (primary && primaryIndex.has(primary))
      ? primaryIndex.get(primary)
      : (geo && geoIndex.has(geo) ? geoIndex.get(geo) : -1);
    if (idx >= 0) {
      poi[idx] = mergeInfraPoiEntries(poi[idx], entry);
      updated += 1;
    } else {
      const nextIdx = poi.length;
      poi.push(entry);
      if (primary) primaryIndex.set(primary, nextIdx);
      if (geo) geoIndex.set(geo, nextIdx);
      added += 1;
    }
  }

  const existingMeta = existingPoi?.meta && typeof existingPoi.meta === 'object' ? existingPoi.meta : {};
  const prevInfra = existingMeta.infraEnrichment && typeof existingMeta.infraEnrichment === 'object'
    ? existingMeta.infraEnrichment
    : {};
  const nowIso = new Date().toISOString();
  const sourceRegions = Array.from(new Set([
    ...(Array.isArray(prevInfra.pbfRegions) ? prevInfra.pbfRegions : []),
    ...(Array.isArray(metaPatch.pbfRegions) ? metaPatch.pbfRegions : [])
  ].map(String).filter(Boolean)));
  const meta = {
    ...existingMeta,
    dataStatus: 'loaded',
    infraEnrichment: {
      ...prevInfra,
      schema: INFRA_ENRICHMENT_SCHEMA,
      version: 1,
      enrichedAt: nowIso,
      tile: String(metaPatch.tile || enrichmentPayload?.tile || existingPoi?.tile || ''),
      source: 'pbf',
      pbfRegions: sourceRegions,
      lastIncoming: incoming.length,
      totalIncoming: Number(prevInfra.totalIncoming || 0) + incoming.length,
      totalAdded: Number(prevInfra.totalAdded || 0) + added,
      totalUpdated: Number(prevInfra.totalUpdated || 0) + updated,
      fields: INFRA_ENRICHMENT_FIELDS.filter(k => k !== 'infra_enriched')
    }
  };

  return {
    payload: {
      v: 1,
      tile: String(enrichmentPayload?.tile || existingPoi?.tile || metaPatch.tile || ''),
      source: String(existingPoi?.source || enrichmentPayload?.source || ''),
      generatedAt: String(existingPoi?.generatedAt || nowIso),
      meta,
      poi: { poi },
      counts: { poi: poi.length }
    },
    stats: {
      incoming: incoming.length,
      added,
      updated,
      total: poi.length
    }
  };
}

function getInfraPayloadPoiList(payload = {}) {
  if (Array.isArray(payload?.infra?.poi)) return payload.infra.poi;
  if (Array.isArray(payload?.poi)) return payload.poi;
  if (Array.isArray(payload?.poi?.poi)) return payload.poi.poi;
  return [];
}

function mergeInfraTilePayload(existingInfra, incomingInfra, metaPatch = {}) {
  const existingRaw = getInfraPayloadPoiList(existingInfra);
  const incomingRaw = getInfraPayloadPoiList(incomingInfra);
  const poi = [];
  const seedClusters = [];
  for (const raw of existingRaw) {
    const entry = cleanInfraPoiEntry(raw);
    if (!entry) continue;
    if (entry.infra_cluster) seedClusters.push(entry);
    else poi.push(entry);
  }
  const primaryIndex = new Map();
  const geoIndex = new Map();
  for (let i = 0; i < poi.length; i++) {
    const primary = infraPoiPrimaryKey(poi[i]);
    if (primary && !primaryIndex.has(primary)) primaryIndex.set(primary, i);
    const geo = infraPoiGeoKey(poi[i]);
    if (geo && !geoIndex.has(geo)) geoIndex.set(geo, i);
  }

  let added = 0;
  let updated = 0;
  for (const raw of incomingRaw) {
    const entry = cleanInfraPoiEntry(raw);
    if (!entry) continue;
    if (entry.infra_cluster) {
      seedClusters.push(entry);
      continue;
    }
    const primary = infraPoiPrimaryKey(entry);
    const geo = infraPoiGeoKey(entry);
    const idx = (primary && primaryIndex.has(primary))
      ? primaryIndex.get(primary)
      : (geo && geoIndex.has(geo) ? geoIndex.get(geo) : -1);
    if (idx >= 0) {
      poi[idx] = mergeInfraPoiEntries(poi[idx], entry);
      updated += 1;
    } else {
      const nextIdx = poi.length;
      poi.push(entry);
      if (primary) primaryIndex.set(primary, nextIdx);
      if (geo) geoIndex.set(geo, nextIdx);
      added += 1;
    }
  }

  const clusterMap = new Map();
  const clusterInputs = [
    ...seedClusters,
    ...(Array.isArray(existingInfra?.infra?.clusters) ? existingInfra.infra.clusters : []),
    ...(Array.isArray(incomingInfra?.infra?.clusters) ? incomingInfra.infra.clusters : [])
  ];
  for (const raw of clusterInputs) {
    const entry = cleanInfraPoiEntry({ ...raw, infra_cluster: true, cluster_type: raw?.cluster_type || raw?.infra_type });
    if (!entry) continue;
    entry.infra_cluster = true;
    entry.cluster_type = String(entry.cluster_type || entry.infra_type || '').toLowerCase();
    const key = infraClusterPrimaryKey(entry);
    if (!clusterMap.has(key)) clusterMap.set(key, entry);
    else clusterMap.set(key, mergeInfraClusterEntries(clusterMap.get(key), entry));
  }
  const clusters = capInfraEntriesByType(Array.from(clusterMap.values()), INFRA_CLUSTER_TYPE_CAPS, INFRA_CLUSTER_TOTAL_CAP, 'cluster_type');
  const cappedPoi = capInfraEntriesByType(poi, INFRA_FEATURE_TYPE_CAPS, INFRA_FEATURE_TOTAL_CAP, 'infra_type');
  const existingMeta = existingInfra?.meta && typeof existingInfra.meta === 'object' ? existingInfra.meta : {};
  const incomingMeta = incomingInfra?.meta && typeof incomingInfra.meta === 'object' ? incomingInfra.meta : {};
  const nowIso = new Date().toISOString();
  return {
    v: 1,
    tile: String(incomingInfra?.tile || existingInfra?.tile || metaPatch.tile || ''),
    source: String(incomingInfra?.source || existingInfra?.source || 'pbf'),
    generatedAt: String(incomingInfra?.generatedAt || existingInfra?.generatedAt || nowIso),
    meta: {
      ...existingMeta,
      ...incomingMeta,
      schema: 'ga.infraTile.v1',
      dataStatus: cappedPoi.length || clusters.length ? 'loaded' : 'empty',
      mergedAt: nowIso,
      mergeStats: {
        added,
        updated,
        incoming: incomingRaw.length,
        rawInfra: poi.length,
        rawClusters: clusterMap.size,
        cappedInfra: cappedPoi.length,
        cappedClusters: clusters.length
      }
    },
    infra: { poi: cappedPoi, clusters },
    counts: {
      infra: cappedPoi.length,
      clusters: clusters.length
    }
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
    'obstacles/infra-tiles',
    'obstacles/core-manifest.v1.json',
    'obstacles/poi-manifest.v1.json',
    'obstacles/infra-manifest.v1.json',
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

async function getCurrentGitBranch() {
  const r = await runCmd('git', ['branch', '--show-current'], { cwd: ROOT });
  if (r.code !== 0) return { ok: false, branch: '', message: (r.stderr || r.stdout || '').trim() || 'aktueller Git-Branch konnte nicht gelesen werden' };
  return { ok: true, branch: String(r.stdout || '').trim() };
}

async function getUnmergedGitPaths() {
  const r = await runCmd('git', ['diff', '--name-only', '--diff-filter=U'], { cwd: ROOT });
  if (r.code !== 0) return { ok: false, paths: [], message: (r.stderr || r.stdout || '').trim() || 'Git-Konfliktstatus konnte nicht gelesen werden' };
  const paths = String(r.stdout || '').split('\n').map(s => s.trim()).filter(Boolean);
  return { ok: true, paths };
}

async function remoteRefExists(ref) {
  const r = await runCmd('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: ROOT });
  return r.code === 0;
}

async function fetchWorkbenchRefs() {
  const mainFetch = await runCmd('git', ['fetch', '--no-tags', WORKBENCH_PUSH_REMOTE, WORKBENCH_MAIN_BRANCH], { cwd: ROOT });
  if (mainFetch.code !== 0) {
    return {
      ok: false,
      message: (mainFetch.stderr || mainFetch.stdout || '').trim() || `${WORKBENCH_MAIN_REF} konnte nicht gefetcht werden`
    };
  }

  const branchFetch = await runCmd('git', ['fetch', '--no-tags', WORKBENCH_PUSH_REMOTE, WORKBENCH_PUSH_BRANCH], { cwd: ROOT });
  const hasPushRef = await remoteRefExists(WORKBENCH_PUSH_REF);
  if (branchFetch.code !== 0) {
    const msg = (branchFetch.stderr || branchFetch.stdout || '').trim();
    if (hasPushRef) {
      return { ok: false, message: msg || `${WORKBENCH_PUSH_REF} konnte nicht gefetcht werden` };
    }
  }

  return {
    ok: true,
    remoteRef: hasPushRef ? WORKBENCH_PUSH_REF : WORKBENCH_MAIN_REF,
    pushRefExists: hasPushRef
  };
}

async function assertTileWorkbenchBranchReady() {
  const unmerged = await getUnmergedGitPaths();
  if (!unmerged.ok) return unmerged;
  if (unmerged.paths.length > 0) {
    return {
      ok: false,
      message: `Git-Konflikt offen (${unmerged.paths.length} Datei(en)). Bitte im Linux-Repo erst "git rebase --abort" oder "git merge --abort" ausfuehren, dann erneut starten.`,
      unmergedPaths: unmerged.paths
    };
  }

  const branch = await getCurrentGitBranch();
  if (!branch.ok) return branch;
  if (branch.branch !== WORKBENCH_PUSH_BRANCH) {
    return {
      ok: false,
      message: `Tile-Push ist auf Branch "${WORKBENCH_PUSH_BRANCH}" konfiguriert, aktueller Branch ist "${branch.branch || '(detached)'}". Bitte im Linux-Repo auf den Tile-Branch wechseln: git fetch ${WORKBENCH_PUSH_REMOTE}; git switch ${WORKBENCH_PUSH_BRANCH} || git switch -c ${WORKBENCH_PUSH_BRANCH} ${WORKBENCH_MAIN_REF}`,
      currentBranch: branch.branch
    };
  }

  return { ok: true, currentBranch: branch.branch };
}

async function getRemoteSyncState() {
  const ready = await assertTileWorkbenchBranchReady();
  if (!ready.ok) return ready;

  const refs = await fetchWorkbenchRefs();
  if (!refs.ok) return refs;

  const cmp = await runCmd('git', ['rev-list', '--left-right', '--count', `${refs.remoteRef}...HEAD`], { cwd: ROOT });
  if (cmp.code !== 0) {
    return {
      ok: false,
      message: (cmp.stderr || cmp.stdout || '').trim() || 'git rev-list fehlgeschlagen'
    };
  }
  const parts = String(cmp.stdout || '').trim().split(/\s+/).map(Number);
  const behind = Number(parts[0] || 0);
  const ahead = Number(parts[1] || 0);
  return {
    ok: true,
    behind,
    ahead,
    remoteRef: refs.remoteRef,
    pushBranch: WORKBENCH_PUSH_BRANCH,
    pushRemote: WORKBENCH_PUSH_REMOTE,
    currentBranch: ready.currentBranch
  };
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

async function loadRemoteManifestTiles(remoteRef, manifestPathInRepo, fallbackPathInRepo = null) {
  const show = await runCmd('git', ['show', `${remoteRef}:${manifestPathInRepo}`], {
    cwd: ROOT,
    timeoutMs: 8000,
    env: { GIT_TERMINAL_PROMPT: '0' }
  });
  let payloadText = String(show.stdout || '');
  if (show.code !== 0 && fallbackPathInRepo) {
    const fb = await runCmd('git', ['show', `${remoteRef}:${fallbackPathInRepo}`], {
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
    message: `Repo-Sync: fetch ${WORKBENCH_MAIN_REF} / ${WORKBENCH_PUSH_REF}...`
  };

  try {
    const ready = await assertTileWorkbenchBranchReady();
    if (!ready.ok) {
      lastRepoSync = {
        ...lastRepoSync,
        ok: false,
        running: false,
        phase: 'failed',
        checkedAt: Date.now(),
        message: ready.message || 'Tile-Branch ist nicht bereit'
      };
      return lastRepoSync;
    }

    const fetched = await fetchWorkbenchRefs();
    if (!fetched.ok) {
      lastRepoSync = {
        ...lastRepoSync,
        ok: false,
        running: false,
        phase: 'failed',
        checkedAt: Date.now(),
        message: fetched.message || 'git fetch fehlgeschlagen'
      };
      return lastRepoSync;
    }
    const remoteRef = fetched.remoteRef;

    lastRepoSync = {
      ...lastRepoSync,
      phase: 'remote-manifest',
      checkedAt: Date.now(),
      message: `Repo-Sync: Remote-Manifeste aus ${remoteRef} lesen...`
    };
    const remoteCoreRes = await loadRemoteManifestTiles(remoteRef, 'obstacles/core-manifest.v1.json', 'obstacles/manifest.v1.json');
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
    const remotePoiRes = await loadRemoteManifestTiles(remoteRef, 'obstacles/poi-manifest.v1.json');
    const remotePoiTiles = remotePoiRes.ok ? remotePoiRes.tiles : new Set();
    const remoteInfraRes = await loadRemoteManifestTiles(remoteRef, 'obstacles/infra-manifest.v1.json');
    const remoteInfraTiles = remoteInfraRes.ok ? remoteInfraRes.tiles : new Set();

    lastRepoSync = {
      ...lastRepoSync,
      phase: 'local-scan',
      checkedAt: Date.now(),
      message: 'Repo-Sync: lokale Tiles prüfen...'
    };
    const localCoreTiles = await collectLocalTileKeysFromFs(CORE_TILE_DIR);
    const localPoiTiles = await collectLocalTileKeysFromFs(POI_TILE_DIR);
    const localInfraTiles = await collectLocalTileKeysFromFs(INFRA_TILE_DIR);
    const localCompleteTiles = setIntersection(setIntersection(localCoreTiles, localPoiTiles), localInfraTiles);

    const remoteCoreTiles = remoteCoreRes.tiles;
    const remoteCompleteTiles = setIntersection(setIntersection(remoteCoreTiles, remotePoiTiles), remoteInfraTiles);

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
      remoteRef,
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
      remoteInfraCount: remoteInfraTiles.size,
      localCoreCount: localCoreTiles.size,
      localPoiCount: localPoiTiles.size,
      localInfraCount: localInfraTiles.size,
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
  const infraManifest = await readJsonSafe(INFRA_MANIFEST_PATH, defaultManifest());

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
  const keys = new Set([
    ...(Array.isArray(coreManifest.tiles) ? coreManifest.tiles : []),
    ...(Array.isArray(poiManifest.tiles) ? poiManifest.tiles : []),
    ...(Array.isArray(infraManifest.tiles) ? infraManifest.tiles : [])
  ].map(normalizeTileKey).filter(Boolean));

  for (const tileKey of keys) {
    const coreGz = tileGzPath(CORE_TILE_DIR, tileKey);
    const poiGz = tileGzPath(POI_TILE_DIR, tileKey);
    const infraGz = tileGzPath(INFRA_TILE_DIR, tileKey);
    const coreFile = existsSync(coreGz) ? coreGz : tilePath(CORE_TILE_DIR, tileKey);
    const poiFile = existsSync(poiGz) ? poiGz : tilePath(POI_TILE_DIR, tileKey);
    const infraFile = existsSync(infraGz) ? infraGz : tilePath(INFRA_TILE_DIR, tileKey);
    const hasCore = existsSync(coreFile);
    const hasPoi = existsSync(poiFile);
    const hasInfra = existsSync(infraFile);
    if (!hasCore && !hasPoi && !hasInfra) continue;

    const recent = lastResults.get(tileKey);
    const recentSig = recent ? `${Number(recent.at || 0)}:${recent.ok === false ? 'fail' : 'ok'}` : '';
    const sig = [
      hasCore ? coreFile : 'missing',
      hasPoi ? poiFile : 'missing',
      hasInfra ? infraFile : 'missing',
      recentSig
    ].join('::');
    const cached = tileStateEntryCache.get(tileKey);
    let baseEntry = cached && cached.sig === sig ? cached.baseEntry : null;
    if (!baseEntry) {
      const recentCounts = countsFromRecentResult(tileKey);
      const counts = recentCounts || emptyTileCounts();
      const countsReady = !!recentCounts;
      const totalCount = countsReady
        ? counts.obs + counts.lin + counts.poi + counts.infra + counts.clusters
        : null;
      const dataStatus = countsReady
        ? (totalCount === 0 ? 'empty' : 'loaded')
        : (hasCore && hasPoi ? 'loaded' : (hasInfra ? 'infra-only' : 'partial'));
      baseEntry = {
        hasCore,
        hasPoi,
        hasInfra,
        dataStatus,
        empty: dataStatus === 'empty',
        countsReady,
        ...(countsReady ? { counts, totalCount } : {}),
        infraEnriched: !!hasInfra
      };
      tileStateEntryCache.set(tileKey, { sig, baseEntry });
    }
    const regionMeta = getRegionMetaForTile(tileKey);
    const partialCoveragePossible = !WORKBENCH_PBF_PATH && regionMeta.count > WORKBENCH_PBF_MAX_REGIONS;
    const partialReason = partialCoveragePossible
      ? `Tile schneidet ${regionMeta.count} Regionen (Limit ${WORKBENCH_PBF_MAX_REGIONS})`
      : '';

    const loadedEntry = {
      ...baseEntry,
      stale: false,
      partialCoveragePossible
    };
    if (partialCoveragePossible) {
      loadedEntry.regionOverlapCount = Number(regionMeta.count || 0);
      loadedEntry.partialReason = partialReason;
    }
    loadedMap[tileKey] = loadedEntry;
  }
  for (const key of Array.from(tileStateEntryCache.keys())) {
    if (!keys.has(key)) tileStateEntryCache.delete(key);
  }

  const recent = {};
  for (const [k, v] of lastResults.entries()) recent[k] = v;

  const regionRows = [];
  for (const r of REGIONS) {
    const id = String(r.id);
    const download = pbfDownloads.get(id) || {};
    const pbfPath = path.join(PBF_CACHE_DIR, `${id}.osm.pbf`);
    let pbfCached = false;
    let pbfMtimeMs = 0;
    let pbfSizeBytes = 0;
    try {
      const stat = await fs.stat(pbfPath);
      pbfCached = stat.isFile();
      pbfMtimeMs = Number(stat.mtimeMs || 0);
      pbfSizeBytes = Number(stat.size || 0);
    } catch (_) {}
    const ageMs = pbfCached && pbfMtimeMs ? Date.now() - pbfMtimeMs : 0;
    regionRows.push({
      id,
      name: String(r.name),
      continent: String(r.continent || ''),
      sizeMb: Number(r.sizeMb || 0),
      bbox: Array.isArray(r.bbox) ? r.bbox.map(Number) : [],
      coverage: (regionPolyCache.get(id) || {}).mode || 'unknown',
      pbfCached,
      pbfFresh: pbfCached && ageMs >= 0 && ageMs < PBF_CACHE_TTL_MS,
      pbfAgeDays: pbfCached && ageMs >= 0 ? Math.round(ageMs / (24 * 60 * 60 * 1000)) : null,
      pbfSizeBytes,
      pbfStatus: String(download.status || (pbfCached ? 'ready' : 'missing')),
      pbfError: String(download.error || '')
    });
  }

  return {
    ok: true,
    root: ROOT,
    port: PORT,
    gitConfig: {
      pushRemote: WORKBENCH_PUSH_REMOTE,
      pushBranch: WORKBENCH_PUSH_BRANCH,
      pushRef: WORKBENCH_PUSH_REF,
      mainBranch: WORKBENCH_MAIN_BRANCH,
      mainRef: WORKBENCH_MAIN_REF
    },
    sourceConfig: {
      pbfPath: WORKBENCH_PBF_PATH,
      pbfAvailable: !!WORKBENCH_PBF_PATH && existsSync(WORKBENCH_PBF_PATH),
      cacheDir: CACHE_BASE,
      pbfTtlDays: PBF_CACHE_TTL_DAYS,
      cacheRecoveryRetrySec: Math.round(WORKBENCH_CACHE_RECOVERY_RETRY_MS / 1000),
      pbfMaxRegions: WORKBENCH_PBF_MAX_REGIONS,
      pbfBorderExtraMinRatio: WORKBENCH_PBF_BORDER_EXTRA_MIN_RATIO,
      pbfThinExtend: WORKBENCH_PBF_THIN_EXTEND,
      duckdbTempDir: WORKBENCH_DUCKDB_TMP_DIR,
      duckdbMemoryLimit: WORKBENCH_DUCKDB_MEMORY_LIMIT,
      duckdbThreads: WORKBENCH_DUCKDB_THREADS,
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
    regions: regionRows,
    downloads: Object.fromEntries(pbfDownloads),
    processing,
    currentTile,
    infraEnrichProcessing,
    infraEnrichCurrentTile,
    queue: queue.slice(),
    queueFresh: queue.filter(k => queueFreshSet.has(k)),
    queueRegionHints: Object.fromEntries(Array.from(queueRegionHintMap.entries()).map(([k, v]) => [k, Array.from(v)])),
    infraEnrichQueue: infraEnrichQueue.slice(),
    infraEnrichFresh: infraEnrichQueue.filter(k => infraEnrichFreshSet.has(k)),
    infraEnrichRegionHints: Object.fromEntries(Array.from(infraEnrichRegionHintMap.entries()).map(([k, v]) => [k, Array.from(v)])),
    queueLength: queue.length,
    tileStepDeg: TILE_STEP_DEG,
    staleAfterDays: 90,
    loaded: loadedMap,
    failed: failedMap,
    recent,
    processSeq,
    processLogTail: processLog.slice(-80),
    pushStatus: {
      ...pushStatus,
      ageSec: pushStatus.updatedAt ? Math.round((Date.now() - pushStatus.updatedAt) / 1000) : null
    },
    currentProgress: { ...currentProgress },
    manifest: {
      generatedAt: coreManifest.generatedAt || null,
      tileCount: Number(coreManifest.tileCount || Object.keys(loadedMap).length || 0),
      coreTileCount: Number(coreManifest.tileCount || 0),
      poiTileCount: Number(poiManifest.tileCount || 0),
      infraTileCount: Number(infraManifest.tileCount || 0)
    },
    repoSync: {
      ok: !!lastRepoSync.ok,
      running: !!lastRepoSync.running,
      phase: String(lastRepoSync.phase || 'idle'),
      startedAt: Number(lastRepoSync.startedAt || 0),
      checkedAt: Number(lastRepoSync.checkedAt || 0),
      message: String(lastRepoSync.message || ''),
      remoteRef: String(lastRepoSync.remoteRef || WORKBENCH_PUSH_REF),
      remoteTileCount: Number(lastRepoSync.remoteTileCount || 0),
      localTileCount: Number(lastRepoSync.localTileCount || 0),
      missingInRepoCount: Number(lastRepoSync.missingInRepoCount || 0),
      missingLocalCount: Number(lastRepoSync.missingLocalCount || 0),
      missingInRepoSample: Array.isArray(lastRepoSync.missingInRepoSample) ? lastRepoSync.missingInRepoSample : [],
      missingLocalSample: Array.isArray(lastRepoSync.missingLocalSample) ? lastRepoSync.missingLocalSample : []
    }
  };
}

async function getCollectedTileState() {
  if (collectTileStatePromise) return collectTileStatePromise;
  collectTileStatePromise = collectTileState().finally(() => {
    collectTileStatePromise = null;
  });
  return collectTileStatePromise;
}

function enqueueTiles(tileKeys, options = {}) {
  const fresh = !!(options && options.fresh);
  const regionHints = options && options.regionHints;
  const added = [];
  for (const raw of Array.isArray(tileKeys) ? tileKeys : []) {
    const key = normalizeTileKey(raw);
    if (!key) continue;
    const tileRegionHints = regionHints instanceof Map
      ? regionHints.get(key)
      : (regionHints && typeof regionHints === 'object' ? regionHints[key] : null);
    if (queueSet.has(key)) {
      if (fresh) queueFreshSet.add(key);
      mergeQueueRegionHints(key, tileRegionHints);
      continue;
    }
    if (key === currentTile) continue;
    queue.push(key);
    queueSet.add(key);
    if (fresh) queueFreshSet.add(key);
    mergeQueueRegionHints(key, tileRegionHints);
    added.push(key);
  }
  if (added.length > 0) processQueue();
  return added;
}

async function listRegionTiles(regionIds) {
  const selected = [];
  const tileSet = new Set();
  const tileRegions = new Map();
  for (const rawId of Array.isArray(regionIds) ? regionIds : []) {
    const id = String(rawId || '').trim();
    if (!id) continue;
    const region = REGION_BY_ID.get(id);
    if (!region) continue;
    selected.push(region);
    const keys = await collectRegionTileKeys(region);
    for (const tileKey of keys) {
      tileSet.add(tileKey);
      if (!tileRegions.has(tileKey)) tileRegions.set(tileKey, []);
      tileRegions.get(tileKey).push(id);
    }
  }
  return {
    selectedRegions: selected.map(r => ({ id: r.id, name: r.name, sizeMb: Number(r.sizeMb || 0), bbox: r.bbox })),
    tiles: Array.from(tileSet).sort(),
    tileRegions
  };
}

async function enqueueRegions(regionIds, options = {}) {
  const listed = await listRegionTiles(regionIds);
  const added = enqueueTiles(listed.tiles, { fresh: !!(options && options.fresh), regionHints: listed.tileRegions });
  return {
    selectedRegions: listed.selectedRegions,
    tiles: listed.tiles,
    foundTiles: listed.tiles.length,
    added
  };
}

async function storeCombinedTileFile(tileKey, combinedFile, options = {}) {
  const startedAt = Number(options.startedAt || Date.now());
  const freshReload = !!(options && options.freshReload);
  const regionHintIds = normalizeRegionIds(options && options.regionHintIds);
  const mergeExisting = !!(options && options.mergeExisting) || regionHintIds.length > 0 || !freshReload;
  const loadSource = String(options.loadSource || 'pbf');
  const run = options.run || { code: 0, stdout: '', stderr: '' };
  const pbfRegionIds = Array.isArray(options.pbfRegionIds) ? options.pbfRegionIds.filter(Boolean) : [];
  const lowCoverage = !!options.lowCoverage;

  const coreOut = tileGzPath(CORE_TILE_DIR, tileKey);
  const poiOut = tileGzPath(POI_TILE_DIR, tileKey);
  const infraOut = tileGzPath(INFRA_TILE_DIR, tileKey);
  const coreLegacyOut = tilePath(CORE_TILE_DIR, tileKey);
  const poiLegacyOut = tilePath(POI_TILE_DIR, tileKey);
  const infraLegacyOut = tilePath(INFRA_TILE_DIR, tileKey);
  const prevCoreFile = existsSync(coreOut) ? coreOut : (existsSync(coreLegacyOut) ? coreLegacyOut : '');
  const prevPoiFile = existsSync(poiOut) ? poiOut : (existsSync(poiLegacyOut) ? poiLegacyOut : '');
  const prevInfraFile = existsSync(infraOut) ? infraOut : (existsSync(infraLegacyOut) ? infraLegacyOut : '');
  const prevCorePayload = (mergeExisting && prevCoreFile) ? await readJsonMaybeGz(prevCoreFile, null) : null;
  const prevPoiPayload = (mergeExisting && prevPoiFile) ? await readJsonMaybeGz(prevPoiFile, null) : null;
  const prevInfraPayload = (mergeExisting && prevInfraFile) ? await readJsonMaybeGz(prevInfraFile, null) : null;

  let ok = false;
  let message = 'Tile-Load fehlgeschlagen';
  let finalObs = 0;
  let finalLin = 0;
  let finalPoi = 0;
  let finalInfra = 0;
  let finalClusters = 0;
  let dataStatus = 'failed';
  const combinedExists = existsSync(combinedFile);

  if (combinedExists) {
    const splitCmd = [
      'tools/split-combined-tile.mjs',
      '--in', path.relative(ROOT, combinedFile),
      '--core-out', path.relative(ROOT, coreOut),
      '--poi-out', path.relative(ROOT, poiOut),
      '--infra-out', path.relative(ROOT, infraOut)
    ];
    const splitRun = await runCmd('node', splitCmd, { cwd: ROOT });
    if (splitRun.code === 0 && existsSync(coreOut) && existsSync(poiOut) && existsSync(infraOut)) {
      const corePayloadRaw = await readJsonMaybeGz(coreOut, { counts: { obs: 0, lin: 0 } });
      const poiPayloadRaw = await readJsonMaybeGz(poiOut, { counts: { poi: 0 } });
      const infraPayloadRaw = await readJsonMaybeGz(infraOut, { counts: { infra: 0, clusters: 0 }, infra: { poi: [], clusters: [] } });
      const corePayload = prevCorePayload ? mergeCorePayload(prevCorePayload, corePayloadRaw) : corePayloadRaw;
      const poiPayload = prevPoiPayload ? mergePoiPayload(prevPoiPayload, poiPayloadRaw) : poiPayloadRaw;
      const infraPayload = prevInfraPayload ? mergeInfraTilePayload(prevInfraPayload, infraPayloadRaw) : infraPayloadRaw;
      const outObs = Number(corePayload?.counts?.obs || 0);
      const outLin = Number(corePayload?.counts?.lin || 0);
      const outPoi = Number(poiPayload?.counts?.poi || 0);
      const outInfra = Number(infraPayload?.counts?.infra || infraPayload?.infra?.poi?.length || 0);
      const outClusters = Number(infraPayload?.counts?.clusters || infraPayload?.infra?.clusters?.length || 0);
      const outTotal = outObs + outLin + outPoi + outInfra + outClusters;
      finalObs = outObs;
      finalLin = outLin;
      finalPoi = outPoi;
      finalInfra = outInfra;
      finalClusters = outClusters;
      dataStatus = outTotal === 0 ? 'empty' : 'loaded';
      const meta = {
        dataStatus,
        rawCounts: {
          obs: Number(corePayload?.meta?.rawCounts?.obs || outObs),
          lin: Number(corePayload?.meta?.rawCounts?.lin || outLin),
          poi: Number(poiPayload?.meta?.rawCounts?.poi || outPoi)
        }
      };
      const existingInfraEnrichment = prevPoiPayload?.meta?.infraEnrichment || poiPayload?.meta?.infraEnrichment || null;
      if (existingInfraEnrichment) meta.infraEnrichment = existingInfraEnrichment;
      corePayload.meta = meta;
      poiPayload.meta = meta;
      infraPayload.meta = {
        ...(infraPayload.meta || {}),
        dataStatus,
        rawCounts: {
          ...(infraPayload?.meta?.rawCounts || {}),
          obs: Number(corePayload?.meta?.rawCounts?.obs || outObs),
          lin: Number(corePayload?.meta?.rawCounts?.lin || outLin),
          poi: Number(poiPayload?.meta?.rawCounts?.poi || outPoi)
        }
      };
      infraPayload.counts = {
        ...(infraPayload.counts || {}),
        infra: outInfra,
        clusters: outClusters
      };
      await writeGzJson(coreOut, corePayload);
      await writeGzJson(poiOut, poiPayload);
      await writeGzJson(infraOut, infraPayload);

      await upsertManifestTile(CORE_MANIFEST_PATH, tileKey);
      await upsertManifestTile(POI_MANIFEST_PATH, tileKey);
      await upsertManifestTile(INFRA_MANIFEST_PATH, tileKey);
      await removeFailedTile(tileKey);
      try { await fs.unlink(tilePath(CORE_TILE_DIR, tileKey)); } catch (_) {}
      try { await fs.unlink(tilePath(POI_TILE_DIR, tileKey)); } catch (_) {}
      try { await fs.unlink(tilePath(INFRA_TILE_DIR, tileKey)); } catch (_) {}
      ok = true;
      message = outTotal === 0
        ? `Tile geladen (${loadSource}), leerer Split gespeichert`
        : `Tile geladen (${loadSource}), gesplittet und gespeichert`;
    } else {
      message = (splitRun.stderr || splitRun.stdout || 'Split fehlgeschlagen').trim() || 'Split fehlgeschlagen';
      if (looksLikeCacheUnavailable(message)) {
        throw new CacheUnavailableError(`Cache/Datenträgerproblem während Tile ${tileKey}: ${message.slice(0, 220)}`);
      }
      await upsertFailedTile(tileKey, { status: 0, error: message });
    }
  } else {
    message = 'PBF-Batch lieferte keine Combined-Datei';
    await upsertFailedTile(tileKey, { status: 0, error: message });
  }

  try { await fs.unlink(combinedFile); } catch (_) {}

  const result = {
    ok,
    at: Date.now(),
    durationMs: Date.now() - startedAt,
    code: Number(run?.code || 0),
    status: ok ? 0 : 1,
    error: ok ? '' : message,
    server: '',
    dataStatus,
    counts: { obs: finalObs, lin: finalLin, poi: finalPoi, infra: finalInfra, clusters: finalClusters },
    message
  };
  lastResults.set(tileKey, result);
  setCurrentProgress({
    tile: tileKey,
    phase: ok ? 'done' : 'failed',
    source: loadSource,
    message
  });
  pushProcessEvent('tile-done', {
    tile: tileKey,
    freshReload,
    ok,
    source: loadSource,
    pbfRegions: pbfRegionIds.slice(),
    lowCoverage,
    dataStatus,
    counts: { obs: finalObs, lin: finalLin, poi: finalPoi, infra: finalInfra, clusters: finalClusters },
    message
  });
  return result;
}

async function processOneTile(tileKey, options = {}) {
  await assertCacheWritableOrThrow('before-tile');
  currentTile = tileKey;
  const startedAt = Date.now();
  const freshReload = !!(options && options.freshReload);
  const regionHintIds = normalizeRegionIds(options && options.regionHintIds);
  const regionAnchored = regionHintIds.length > 0;
  const mergeExisting = regionAnchored || !freshReload;
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
  const infraOut = tileGzPath(INFRA_TILE_DIR, tileKey);
  const coreLegacyOut = tilePath(CORE_TILE_DIR, tileKey);
  const poiLegacyOut = tilePath(POI_TILE_DIR, tileKey);
  const infraLegacyOut = tilePath(INFRA_TILE_DIR, tileKey);
  const prevCoreFile = existsSync(coreOut) ? coreOut : (existsSync(coreLegacyOut) ? coreLegacyOut : '');
  const prevPoiFile = existsSync(poiOut) ? poiOut : (existsSync(poiLegacyOut) ? poiLegacyOut : '');
  const prevInfraFile = existsSync(infraOut) ? infraOut : (existsSync(infraLegacyOut) ? infraLegacyOut : '');
  const prevCorePayload = (mergeExisting && prevCoreFile) ? await readJsonMaybeGz(prevCoreFile, null) : null;
  const prevPoiPayload = (mergeExisting && prevPoiFile) ? await readJsonMaybeGz(prevPoiFile, null) : null;
  const prevInfraPayload = (mergeExisting && prevInfraFile) ? await readJsonMaybeGz(prevInfraFile, null) : null;

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

  const pbfResolution = await resolvePbfPathsForTile(tileKey, { preferredRegionIds: regionHintIds, regionAnchored });
  const pbfPaths = Array.isArray(pbfResolution?.selectedPaths) ? pbfResolution.selectedPaths : [];
  let pbfRemainingPaths = Array.isArray(pbfResolution?.remainingPaths) ? pbfResolution.remainingPaths : [];
  const pbfRegionIds = Array.isArray(pbfResolution?.selectedRegionIds) ? pbfResolution.selectedRegionIds.filter(Boolean) : [];
  let pbfRemainingRegionIds = Array.isArray(pbfResolution?.remainingRegionIds) ? pbfResolution.remainingRegionIds.filter(Boolean) : [];
  const relevantRegionCount = Number(pbfResolution?.relevantRegionCount || 0);
  const lowCoverage = Number(pbfResolution?.significantRemainingCount || 0) > 0;
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
      if (WORKBENCH_PBF_THIN_EXTEND && pbfResolution?.allowThinExtend !== false && thinDetected && (pbfRemainingPaths.length > 0 || pbfRemainingRegionIds.length > 0)) {
        if (pbfRemainingPaths.length === 0 && pbfRemainingRegionIds.length > 0) {
          const extraResolution = await ensurePbfPathsForRegionIds(pbfRemainingRegionIds, new Set(pbfPaths.map(p => path.resolve(p))));
          pbfRemainingPaths = extraResolution.paths;
          pbfRemainingRegionIds = extraResolution.regionIds;
        }
        if (pbfRemainingPaths.length > 0) {
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
  let finalInfra = 0;
  let finalClusters = 0;
  let dataStatus = 'failed';

  if (combinedExists && !failedItem) {
    const splitCmd = [
      'tools/split-combined-tile.mjs',
      '--in', path.relative(ROOT, combinedFile),
      '--core-out', path.relative(ROOT, coreOut),
      '--poi-out', path.relative(ROOT, poiOut),
      '--infra-out', path.relative(ROOT, infraOut)
    ];
    const splitRun = await runCmd('node', splitCmd, { cwd: ROOT });
    if (splitRun.code === 0 && existsSync(coreOut) && existsSync(poiOut) && existsSync(infraOut)) {
      const corePayloadRaw = await readJsonMaybeGz(coreOut, { counts: { obs: 0, lin: 0 } });
      const poiPayloadRaw = await readJsonMaybeGz(poiOut, { counts: { poi: 0 } });
      const infraPayloadRaw = await readJsonMaybeGz(infraOut, { counts: { infra: 0, clusters: 0 }, infra: { poi: [], clusters: [] } });
      const corePayload = prevCorePayload ? mergeCorePayload(prevCorePayload, corePayloadRaw) : corePayloadRaw;
      const poiPayload = prevPoiPayload ? mergePoiPayload(prevPoiPayload, poiPayloadRaw) : poiPayloadRaw;
      const infraPayload = prevInfraPayload ? mergeInfraTilePayload(prevInfraPayload, infraPayloadRaw) : infraPayloadRaw;
      const outObs = Number(corePayload?.counts?.obs || 0);
      const outLin = Number(corePayload?.counts?.lin || 0);
      const outPoi = Number(poiPayload?.counts?.poi || 0);
      const outInfra = Number(infraPayload?.counts?.infra || infraPayload?.infra?.poi?.length || 0);
      const outClusters = Number(infraPayload?.counts?.clusters || infraPayload?.infra?.clusters?.length || 0);
      const outTotal = outObs + outLin + outPoi + outInfra + outClusters;
      finalObs = outObs;
      finalLin = outLin;
      finalPoi = outPoi;
      finalInfra = outInfra;
      finalClusters = outClusters;
      dataStatus = outTotal === 0 ? 'empty' : 'loaded';
      const meta = {
        dataStatus,
        rawCounts: {
          obs: Number(corePayload?.meta?.rawCounts?.obs || outObs),
          lin: Number(corePayload?.meta?.rawCounts?.lin || outLin),
          poi: Number(poiPayload?.meta?.rawCounts?.poi || outPoi)
        }
      };
      const existingInfraEnrichment = prevPoiPayload?.meta?.infraEnrichment || poiPayload?.meta?.infraEnrichment || null;
      if (existingInfraEnrichment) meta.infraEnrichment = existingInfraEnrichment;
      corePayload.meta = meta;
      poiPayload.meta = meta;
      infraPayload.meta = {
        ...(infraPayload.meta || {}),
        dataStatus,
        rawCounts: {
          ...(infraPayload?.meta?.rawCounts || {}),
          obs: Number(corePayload?.meta?.rawCounts?.obs || outObs),
          lin: Number(corePayload?.meta?.rawCounts?.lin || outLin),
          poi: Number(poiPayload?.meta?.rawCounts?.poi || outPoi)
        }
      };
      infraPayload.counts = {
        ...(infraPayload.counts || {}),
        infra: outInfra,
        clusters: outClusters
      };
      await writeGzJson(coreOut, corePayload);
      await writeGzJson(poiOut, poiPayload);
      await writeGzJson(infraOut, infraPayload);

      await upsertManifestTile(CORE_MANIFEST_PATH, tileKey);
      await upsertManifestTile(POI_MANIFEST_PATH, tileKey);
      await upsertManifestTile(INFRA_MANIFEST_PATH, tileKey);
      await removeFailedTile(tileKey);
      // Delete old plain .json counterparts (migrating to .json.gz)
      try { await fs.unlink(tilePath(CORE_TILE_DIR, tileKey)); } catch (_) {}
      try { await fs.unlink(tilePath(POI_TILE_DIR, tileKey)); } catch (_) {}
      try { await fs.unlink(tilePath(INFRA_TILE_DIR, tileKey)); } catch (_) {}
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
    counts: { obs: finalObs, lin: finalLin, poi: finalPoi, infra: finalInfra, clusters: finalClusters },
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
    counts: { obs: finalObs, lin: finalLin, poi: finalPoi, infra: finalInfra, clusters: finalClusters },
    message
  });
}

function mergeInfraEnrichmentChunks(chunks, tileKey) {
  const map = new Map();
  const clusterMap = new Map();
  for (const chunk of Array.isArray(chunks) ? chunks : []) {
    const list = Array.isArray(chunk?.poi) ? chunk.poi : [];
    for (const raw of list) {
      const entry = cleanInfraPoiEntry(raw);
      if (!entry) continue;
      if (entry.infra_cluster) {
        const cKey = infraClusterPrimaryKey(entry);
        if (!clusterMap.has(cKey)) clusterMap.set(cKey, entry);
        else clusterMap.set(cKey, mergeInfraClusterEntries(clusterMap.get(cKey), entry));
        continue;
      }
      const key = infraPoiPrimaryKey(entry) || infraPoiGeoKey(entry);
      if (!map.has(key)) map.set(key, entry);
      else map.set(key, mergeInfraPoiEntries(map.get(key), entry));
    }
    const clusters = Array.isArray(chunk?.infra?.clusters) ? chunk.infra.clusters : [];
    for (const raw of clusters) {
      const entry = cleanInfraPoiEntry({ ...raw, infra_cluster: true, cluster_type: raw?.cluster_type || raw?.infra_type });
      if (!entry) continue;
      entry.infra_cluster = true;
      entry.cluster_type = String(entry.cluster_type || entry.infra_type || '').toLowerCase();
      const key = infraClusterPrimaryKey(entry);
      if (!clusterMap.has(key)) clusterMap.set(key, entry);
      else clusterMap.set(key, mergeInfraClusterEntries(clusterMap.get(key), entry));
    }
  }
  const poi = Array.from(map.values());
  const clusters = Array.from(clusterMap.values());
  return {
    v: 1,
    schema: INFRA_ENRICHMENT_SCHEMA,
    tile: tileKey,
    generatedAt: new Date().toISOString(),
    source: chunks.map(c => c?.source || '').filter(Boolean).join('+') || 'pbf',
    counts: { poi: poi.length, clusters: clusters.length },
    poi,
    infra: { poi, clusters }
  };
}

async function extractInfraEnrichmentForTile(tileKey, pbfPaths) {
  let run = { code: 1, stdout: '', stderr: '' };
  const chunks = [];
  await ensureDir(WORKBENCH_TMP_ENRICH_DIR);
  for (const pbfPath of Array.isArray(pbfPaths) ? pbfPaths : []) {
    const tmpOut = path.join(
      WORKBENCH_TMP_ENRICH_DIR,
      `${String(tileKey).replace('|', '_')}.${path.basename(pbfPath, '.osm.pbf')}.infra.json`
    );
    const cmd = [
      'tools/enrich-infra-tile-from-pbf.py',
      '--pbf', pbfPath,
      '--tile', tileKey,
      '--out', path.relative(ROOT, tmpOut)
    ];
    const r = await runPbfPythonCmd(cmd);
    run = r;
    if (r.code === 0 && existsSync(tmpOut)) {
      try {
        const parsed = JSON.parse(await fs.readFile(tmpOut, 'utf8'));
        chunks.push(parsed);
      } catch (_) {}
      try { await fs.unlink(tmpOut); } catch (_) {}
    }
  }
  return { run, chunks };
}

async function extractInfraEnrichmentBatchForPbf(tileKeys, pbfPath) {
  const cleanTiles = Array.from(new Set((Array.isArray(tileKeys) ? tileKeys : []).map(normalizeTileKey).filter(Boolean)));
  let run = { code: 1, stdout: '', stderr: '' };
  const chunksByTile = new Map(cleanTiles.map(k => [k, []]));
  if (!cleanTiles.length) return { run, chunksByTile };
  await ensureDir(WORKBENCH_TMP_ENRICH_DIR);
  const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tmpDir = path.join(
    WORKBENCH_TMP_ENRICH_DIR,
    `batch-${batchId}-${path.basename(pbfPath, '.osm.pbf').replace(/[^a-z0-9_.-]+/gi, '_')}`
  );
  await ensureDir(tmpDir);
  const cmd = [
    'tools/enrich-infra-tile-from-pbf.py',
    '--pbf', pbfPath,
    '--tiles', cleanTiles.join(','),
    '--out-dir', path.relative(ROOT, tmpDir)
  ];
  try {
    run = await runPbfPythonCmd(cmd);
    if (run.code === 0) {
      let files = [];
      try { files = await fs.readdir(tmpDir); } catch (_) { files = []; }
      for (const file of files) {
        if (!file.endsWith('.infra.json')) continue;
        const full = path.join(tmpDir, file);
        try {
          const parsed = JSON.parse(await fs.readFile(full, 'utf8'));
          const tile = normalizeTileKey(parsed?.tile);
          if (!tile || !chunksByTile.has(tile)) continue;
          chunksByTile.get(tile).push(parsed);
        } catch (_) {}
      }
    }
  } finally {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
  return { run, chunksByTile };
}

async function writeInfraLayerForTile(tileKey, chunks, pbfRegionIds, run, startedAt, options = {}) {
  const freshReplace = !!(options && options.freshReplace);
  const enrichmentPayload = mergeInfraEnrichmentChunks(chunks, tileKey);
  const infraOut = tileGzPath(INFRA_TILE_DIR, tileKey);
  const infraLegacyOut = tilePath(INFRA_TILE_DIR, tileKey);
  const prevInfraFile = existsSync(infraOut) ? infraOut : (existsSync(infraLegacyOut) ? infraLegacyOut : '');
  const prevInfraPayload = (!freshReplace && prevInfraFile)
    ? await readJsonMaybeGz(prevInfraFile, null)
    : {
        v: 1,
        tile: tileKey,
        source: 'infra-enrichment',
        generatedAt: new Date().toISOString(),
        infra: { poi: [], clusters: [] },
        counts: { infra: 0, clusters: 0 },
        meta: { schema: 'ga.infraTile.v1', dataStatus: 'loaded' }
      };
  const regions = Array.from(new Set((Array.isArray(pbfRegionIds) ? pbfRegionIds : []).map(String).filter(Boolean)));
  const mergedPayload = mergeInfraTilePayload(prevInfraPayload, enrichmentPayload, { tile: tileKey });
  mergedPayload.meta = {
    ...(mergedPayload.meta || {}),
    schema: 'ga.infraTile.v1',
    dataStatus: mergedPayload.counts.infra || mergedPayload.counts.clusters ? 'loaded' : 'empty',
    pbfRegions: regions,
    infraEnrichment: {
      schema: INFRA_ENRICHMENT_SCHEMA,
      version: 1,
      enrichedAt: new Date().toISOString(),
      source: 'pbf',
      tile: tileKey,
      pbfRegions: regions,
      lastIncoming: Number(enrichmentPayload?.counts?.poi || 0),
      fields: INFRA_ENRICHMENT_FIELDS.filter(k => k !== 'infra_enriched')
    }
  };
  await writeGzJson(infraOut, mergedPayload);
  try { await fs.unlink(infraLegacyOut); } catch (_) {}
  await upsertManifestTile(INFRA_MANIFEST_PATH, tileKey);

  lastResults.set(tileKey, {
    ok: true,
    at: Date.now(),
    durationMs: Date.now() - Number(startedAt || Date.now()),
    code: Number(run?.code || 0),
    dataStatus: 'loaded',
    counts: { obs: 0, lin: 0, poi: 0, infra: mergedPayload.counts.infra, clusters: mergedPayload.counts.clusters },
    message: `${freshReplace ? 'Infra-Layer frisch ersetzt' : 'Infra-Layer gespeichert'}: ${Number(enrichmentPayload?.counts?.poi || 0)} Treffer + ${Number(enrichmentPayload?.counts?.clusters || 0)} Cluster, gesamt ${mergedPayload.counts.infra} Infra-Features + ${mergedPayload.counts.clusters} Cluster`
  });
  pushProcessEvent('infra-enrich-done', {
    tile: tileKey,
    freshReload: freshReplace,
    ok: true,
    source: 'pbf',
    pbfRegions: regions,
    counts: {
      incoming: Number(enrichmentPayload?.counts?.poi || 0),
      added: Number(mergedPayload?.meta?.mergeStats?.added || 0),
      updated: Number(mergedPayload?.meta?.mergeStats?.updated || 0),
      poi: mergedPayload.counts.infra,
      infra: mergedPayload.counts.infra,
      clusters: mergedPayload.counts.clusters
    },
    message: lastResults.get(tileKey).message
  });
  return mergedPayload;
}

function enqueueInfraEnrichmentTiles(tileKeys, options = {}) {
  const fresh = !!(options && options.fresh);
  const regionHints = options && options.regionHints;
  const added = [];
  if (options && options.autoPush) autoPushInfraEnrichWhenDone = true;
  for (const raw of Array.isArray(tileKeys) ? tileKeys : []) {
    const key = normalizeTileKey(raw);
    if (!key) continue;
    const tileRegionHints = regionHints instanceof Map
      ? regionHints.get(key)
      : (regionHints && typeof regionHints === 'object' ? regionHints[key] : null);
    if (infraEnrichQueueSet.has(key)) {
      if (fresh) infraEnrichFreshSet.add(key);
      mergeInfraRegionHints(key, tileRegionHints);
      continue;
    }
    if (key === infraEnrichCurrentTile) continue;
    infraEnrichQueue.push(key);
    infraEnrichQueueSet.add(key);
    if (fresh) infraEnrichFreshSet.add(key);
    mergeInfraRegionHints(key, tileRegionHints);
    added.push(key);
  }
  if (added.length > 0) processInfraEnrichmentQueue();
  return added;
}

async function enqueueInfraEnrichmentRegions(regionIds, options = {}) {
  const listed = await listRegionTiles(regionIds);
  const added = enqueueInfraEnrichmentTiles(listed.tiles, {
    autoPush: !!(options && options.autoPush),
    fresh: !!(options && options.fresh),
    regionHints: listed.tileRegions
  });
  return {
    selectedRegions: listed.selectedRegions,
    tiles: listed.tiles,
    foundTiles: listed.tiles.length,
    added
  };
}

async function processOneInfraEnrichmentTile(tileKey, options = {}) {
  await assertCacheWritableOrThrow('before-infra-enrichment');
  infraEnrichCurrentTile = tileKey;
  const startedAt = Date.now();
  const regionHintIds = normalizeRegionIds(options && options.regionHintIds);
  const regionAnchored = regionHintIds.length > 0;
  setCurrentProgress({
    tile: tileKey,
    phase: 'infra-enrich',
    source: 'pbf',
    message: 'Starte Infra-Enrichment',
    startedAt
  });

  const pbfResolution = await resolvePbfPathsForTile(tileKey, { preferredRegionIds: regionHintIds, regionAnchored });
  const pbfPaths = Array.isArray(pbfResolution?.selectedPaths) ? pbfResolution.selectedPaths : [];
  const pbfRegionIds = Array.isArray(pbfResolution?.selectedRegionIds) ? pbfResolution.selectedRegionIds.filter(Boolean) : [];
  let pbfRemainingPaths = Array.isArray(pbfResolution?.remainingPaths) ? pbfResolution.remainingPaths : [];
  let pbfRemainingRegionIds = Array.isArray(pbfResolution?.remainingRegionIds) ? pbfResolution.remainingRegionIds.filter(Boolean) : [];
  if (pbfPaths.length === 0) {
    throw new Error(`Keine PBF-Region für Infra-Enrichment von ${tileKey} gefunden`);
  }

  pushProcessEvent('infra-enrich-start', {
    tile: tileKey,
    pbfRegions: pbfRegionIds.slice(),
    pbfRegionsExtra: pbfRemainingRegionIds.slice()
  });

  let extracted = await extractInfraEnrichmentForTile(tileKey, pbfPaths);
  let chunks = extracted.chunks;
  let run = extracted.run;
  let usedRegionIds = pbfRegionIds.slice();
  if (pbfResolution?.allowThinExtend !== false && chunks.length === 0 && (pbfRemainingPaths.length > 0 || pbfRemainingRegionIds.length > 0)) {
    if (pbfRemainingPaths.length === 0 && pbfRemainingRegionIds.length > 0) {
      const extraResolution = await ensurePbfPathsForRegionIds(pbfRemainingRegionIds, new Set(pbfPaths.map(p => path.resolve(p))));
      pbfRemainingPaths = extraResolution.paths;
      pbfRemainingRegionIds = extraResolution.regionIds;
    }
    if (pbfRemainingPaths.length > 0) {
      const extra = await extractInfraEnrichmentForTile(tileKey, pbfRemainingPaths);
      if (extra.chunks.length > 0) chunks = chunks.concat(extra.chunks);
      if (extra.chunks.length > 0) usedRegionIds = usedRegionIds.concat(pbfRemainingRegionIds);
      if (run.code !== 0) run = extra.run;
    }
  }
  if (chunks.length === 0) {
    throw new Error((run.stderr || run.stdout || 'Infra-Enrichment lieferte keine PBF-Daten').trim());
  }

  const enrichmentPayload = mergeInfraEnrichmentChunks(chunks, tileKey);
  const infraOut = tileGzPath(INFRA_TILE_DIR, tileKey);
  const infraLegacyOut = tilePath(INFRA_TILE_DIR, tileKey);
  const prevInfraFile = existsSync(infraOut) ? infraOut : (existsSync(infraLegacyOut) ? infraLegacyOut : '');
  const prevInfraPayload = prevInfraFile
    ? await readJsonMaybeGz(prevInfraFile, null)
    : {
        v: 1,
        tile: tileKey,
        source: 'infra-enrichment',
        generatedAt: new Date().toISOString(),
        infra: { poi: [], clusters: [] },
        counts: { infra: 0, clusters: 0 },
        meta: { schema: 'ga.infraTile.v1', dataStatus: 'loaded' }
      };
  const mergedPayload = mergeInfraTilePayload(prevInfraPayload, enrichmentPayload, { tile: tileKey });
  mergedPayload.meta = {
    ...(mergedPayload.meta || {}),
    schema: 'ga.infraTile.v1',
    dataStatus: mergedPayload.counts.infra || mergedPayload.counts.clusters ? 'loaded' : 'empty',
    pbfRegions: Array.from(new Set(usedRegionIds.map(String).filter(Boolean))),
    infraEnrichment: {
      schema: INFRA_ENRICHMENT_SCHEMA,
      version: 1,
      enrichedAt: new Date().toISOString(),
      source: 'pbf',
      tile: tileKey,
      pbfRegions: Array.from(new Set(usedRegionIds.map(String).filter(Boolean))),
      lastIncoming: Number(enrichmentPayload?.counts?.poi || 0),
      fields: INFRA_ENRICHMENT_FIELDS.filter(k => k !== 'infra_enriched')
    }
  };
  await writeGzJson(infraOut, mergedPayload);
  try { await fs.unlink(infraLegacyOut); } catch (_) {}
  await upsertManifestTile(INFRA_MANIFEST_PATH, tileKey);

  lastResults.set(tileKey, {
    ok: true,
    at: Date.now(),
    durationMs: Date.now() - startedAt,
    code: run.code,
    dataStatus: 'loaded',
    counts: { obs: 0, lin: 0, poi: 0, infra: mergedPayload.counts.infra, clusters: mergedPayload.counts.clusters },
    message: `Infra-Layer gespeichert: ${Number(enrichmentPayload?.counts?.poi || 0)} Treffer + ${Number(enrichmentPayload?.counts?.clusters || 0)} Cluster, gesamt ${mergedPayload.counts.infra} Infra-Features + ${mergedPayload.counts.clusters} Cluster`
  });
  setCurrentProgress({
    phase: 'infra-enrich-done',
    source: 'pbf',
    message: lastResults.get(tileKey).message
  });
  pushProcessEvent('infra-enrich-done', {
    tile: tileKey,
    ok: true,
    source: 'pbf',
    pbfRegions: Array.from(new Set(usedRegionIds.map(String).filter(Boolean))),
    counts: {
      incoming: Number(enrichmentPayload?.counts?.poi || 0),
      added: Number(mergedPayload?.meta?.mergeStats?.added || 0),
      updated: Number(mergedPayload?.meta?.mergeStats?.updated || 0),
      poi: mergedPayload.counts.infra,
      infra: mergedPayload.counts.infra,
      clusters: mergedPayload.counts.clusters
    },
    message: lastResults.get(tileKey).message
  });
}

async function processInfraEnrichmentBatch(tileKeys, options = {}) {
  const cleanTiles = Array.from(new Set((Array.isArray(tileKeys) ? tileKeys : []).map(normalizeTileKey).filter(Boolean)));
  if (!cleanTiles.length) return;
  const freshTiles = options && options.freshTiles instanceof Set ? options.freshTiles : new Set();
  await assertCacheWritableOrThrow('before-infra-enrichment-batch');
  const startedAt = Date.now();
  const batchLabel = cleanTiles.length === 1 ? cleanTiles[0] : `${cleanTiles[0]} +${cleanTiles.length - 1}`;
  infraEnrichCurrentTile = cleanTiles[0] || null;
  setCurrentProgress({
    tile: cleanTiles[0] || null,
    phase: 'infra-enrich-batch',
    source: 'pbf',
    message: `Starte Infra-Batch (${cleanTiles.length} Tiles)`,
    startedAt
  });

  const pbfBatches = new Map(); // pbfPath -> { tiles:Set, regionIds:Set }
  const tileRegions = new Map(cleanTiles.map(k => [k, new Set()]));
  const tileErrors = new Map();

  for (const tileKey of cleanTiles) {
    const regionHintIds = getInfraRegionHintsForTile(tileKey);
    const pbfResolution = await resolvePbfPathsForTile(tileKey, { preferredRegionIds: regionHintIds, regionAnchored: regionHintIds.length > 0 });
    const selectedPaths = Array.isArray(pbfResolution?.selectedPaths) ? pbfResolution.selectedPaths : [];
    const selectedRegionIds = Array.isArray(pbfResolution?.selectedRegionIds) ? pbfResolution.selectedRegionIds.filter(Boolean) : [];
    const pairs = [];
    selectedPaths.forEach((p, i) => pairs.push([p, selectedRegionIds[i] || 'manual']));
    if (!pairs.length) {
      tileErrors.set(tileKey, `Keine PBF-Region für Infra-Enrichment von ${tileKey} gefunden`);
      continue;
    }
    for (const [pbfPath, regionId] of pairs) {
      if (!pbfBatches.has(pbfPath)) pbfBatches.set(pbfPath, { tiles: new Set(), regionIds: new Set() });
      pbfBatches.get(pbfPath).tiles.add(tileKey);
      if (regionId) {
        pbfBatches.get(pbfPath).regionIds.add(String(regionId));
        tileRegions.get(tileKey).add(String(regionId));
      }
    }
  }

  pushProcessEvent('infra-enrich-start', {
    tile: batchLabel,
    tiles: cleanTiles.slice(),
    batch: true,
    freshReload: freshTiles.size > 0,
    pbfRegions: Array.from(new Set(Array.from(pbfBatches.values()).flatMap(v => Array.from(v.regionIds))))
  });

  const chunksByTile = new Map(cleanTiles.map(k => [k, []]));
  let lastRun = { code: 0, stdout: '', stderr: '' };
  let successfulRun = null;
  let batchFailureMessage = '';
  for (const [pbfPath, batch] of pbfBatches.entries()) {
    const tilesForPbf = Array.from(batch.tiles).sort();
    setCurrentProgress({
      phase: 'infra-enrich-batch-pbf',
      message: `PBF-Batch ${path.basename(pbfPath)} (${tilesForPbf.length} Tiles)`
    });
    pushProcessEvent('infra-enrich-pbf-batch', {
      tile: batchLabel,
      tiles: tilesForPbf,
      pbf: path.basename(pbfPath),
      pbfRegions: Array.from(batch.regionIds)
    });
    const extracted = await extractInfraEnrichmentBatchForPbf(tilesForPbf, pbfPath);
    lastRun = extracted.run || lastRun;
    const pbfHadChunks = Array.from(extracted.chunksByTile.values()).some(chunks => chunks.length > 0);
    if (pbfHadChunks) successfulRun = extracted.run || successfulRun || { code: 0, stdout: '', stderr: '' };
    for (const [tile, chunks] of extracted.chunksByTile.entries()) {
      if (!chunks.length) continue;
      chunksByTile.get(tile).push(...chunks);
    }
    if (lastRun.code !== 0 && !pbfHadChunks) {
      batchFailureMessage = (lastRun.stderr || lastRun.stdout || `PBF-Batch fehlgeschlagen: ${path.basename(pbfPath)}`).trim();
    }
  }

  for (const tileKey of cleanTiles) {
    const err = tileErrors.get(tileKey);
    const chunks = chunksByTile.get(tileKey) || [];
    if (err || !chunks.length) {
      const msg = err || batchFailureMessage || 'Infra-Enrichment lieferte keine PBF-Daten';
      lastResults.set(tileKey, {
        ok: false,
        at: Date.now(),
        durationMs: Date.now() - startedAt,
        code: Number(lastRun?.code || 1),
        message: `Infra-Enrichment fehlgeschlagen: ${msg}`
      });
      pushProcessEvent('infra-enrich-done', {
        tile: tileKey,
        ok: false,
        source: 'pbf',
        message: lastResults.get(tileKey).message
      });
      clearInfraRegionHints(tileKey);
      continue;
    }
    const regionHintIds = getInfraRegionHintsForTile(tileKey);
    await writeInfraLayerForTile(tileKey, chunks, Array.from(tileRegions.get(tileKey) || []), successfulRun || lastRun, startedAt, {
      freshReplace: freshTiles.has(tileKey) && regionHintIds.length === 0
    });
    clearInfraRegionHints(tileKey);
  }

  setCurrentProgress({
    phase: 'infra-enrich-done',
    source: 'pbf',
    message: `Infra-Batch abgeschlossen (${cleanTiles.length} Tiles)`
  });
}

async function processInfraEnrichmentQueue() {
  if (infraEnrichProcessing || processing) return;
  infraEnrichProcessing = true;
  try {
    while (infraEnrichQueue.length > 0) {
      const batch = [];
      const freshBatch = new Set();
      while (infraEnrichQueue.length > 0 && batch.length < INFRA_ENRICH_BATCH_TILE_MAX) {
        const next = infraEnrichQueue.shift();
        infraEnrichQueueSet.delete(next);
        const nextFresh = infraEnrichFreshSet.has(next);
        infraEnrichFreshSet.delete(next);
        if (next) {
          batch.push(next);
          if (nextFresh) freshBatch.add(next);
        }
      }
      if (!batch.length) continue;
      try {
        await processInfraEnrichmentBatch(batch, { freshTiles: freshBatch });
      } catch (err) {
        const errText = String(err && err.message || err || '');
        if ((err && err.code === 'CACHE_UNAVAILABLE') || looksLikeCacheUnavailable(errText)) {
          const msg = `Cache offline – Infra-Batch pausiert und wird erneut versucht`;
          pushProcessEvent('cache-offline', { tile: batch[0] || '-', tiles: batch.slice(), message: msg });
          for (let i = batch.length - 1; i >= 0; i--) {
            const key = batch[i];
            if (!infraEnrichQueueSet.has(key)) {
              infraEnrichQueue.unshift(key);
              infraEnrichQueueSet.add(key);
              if (freshBatch.has(key)) infraEnrichFreshSet.add(key);
            }
          }
          await waitForCacheRecovery();
          continue;
        }
        for (const next of batch) {
          const msg = `Infra-Enrichment fehlgeschlagen: ${errText}`;
          clearInfraRegionHints(next);
          lastResults.set(next, {
            ok: false,
            at: Date.now(),
            durationMs: 0,
            code: 1,
            message: msg
          });
          pushProcessEvent('infra-enrich-done', {
            tile: next,
            ok: false,
            source: 'pbf',
            message: msg
          });
        }
      } finally {
        infraEnrichCurrentTile = null;
      }
    }
  } finally {
    infraEnrichProcessing = false;
    infraEnrichCurrentTile = null;
    if (autoPushInfraEnrichWhenDone) {
      autoPushInfraEnrichWhenDone = false;
      console.log('[Tile-Workbench] Infra-Enrichment Queue leer — Auto-Push gestartet...');
      handlePush().then(r => {
        console.log(`[Tile-Workbench] Infra-Enrichment Auto-Push: ${r.ok ? 'OK' : 'Fehler — ' + r.message}`);
      }).catch(e => {
        setPushStatus({
          running: false,
          ok: false,
          phase: 'failed',
          step: 'exception',
          message: `Auto-Push Fehler: ${e && e.message || e}`,
          finishedAt: Date.now()
        });
        console.error('[Tile-Workbench] Infra-Enrichment Auto-Push Fehler:', e);
      });
    }
    if (queue.length > 0) processQueue();
  }
}

async function getCompletePbfBatchCandidate(tileKey, freshReload, regionHintIds = []) {
  const key = normalizeTileKey(tileKey);
  if (!key || COMPLETE_LOAD_BATCH_TILE_MAX <= 1) return null;
  const hints = normalizeRegionIds(regionHintIds);
  const pbfResolution = await resolvePbfPathsForTile(key, { preferredRegionIds: hints, regionAnchored: hints.length > 0 });
  const pbfPaths = Array.isArray(pbfResolution?.selectedPaths) ? pbfResolution.selectedPaths : [];
  const pbfRegionIds = Array.isArray(pbfResolution?.selectedRegionIds) ? pbfResolution.selectedRegionIds.filter(Boolean) : [];
  const relevantRegionCount = Number(pbfResolution?.relevantRegionCount || 0);
  const lowCoverage = Number(pbfResolution?.significantRemainingCount || 0) > 0;

  // Keep edge/multi-region and thin-extend candidates on the proven serial path.
  if (pbfPaths.length !== 1 || lowCoverage) return null;
  return {
    tileKey: key,
    freshReload: !!freshReload,
    pbfPath: pbfPaths[0],
    pbfRegionIds,
    regionHintIds: hints,
    mergeExisting: hints.length > 0,
    relevantRegionCount,
    lowCoverage
  };
}

function requeueCompleteItemsFront(items = []) {
  const clean = Array.isArray(items) ? items.filter(Boolean) : [];
  for (let i = clean.length - 1; i >= 0; i--) {
    const item = clean[i];
    const key = normalizeTileKey(item.tileKey);
    if (!key || queueSet.has(key) || key === currentTile) continue;
    queue.unshift(key);
    queueSet.add(key);
    if (item.freshReload) queueFreshSet.add(key);
  }
}

async function collectCompletePbfBatch(firstTile, firstFresh, firstRegionHints = []) {
  const first = await getCompletePbfBatchCandidate(firstTile, firstFresh, firstRegionHints);
  if (!first) return null;
  const batch = [first];
  const held = [];

  try {
    while (queue.length > 0 && batch.length < COMPLETE_LOAD_BATCH_TILE_MAX) {
      const next = queue.shift();
      const nextFresh = queueFreshSet.has(next);
      queueSet.delete(next);
      queueFreshSet.delete(next);
      const nextRegionHints = getRegionHintsForTile(next);
      let candidate = null;
      try {
        candidate = await getCompletePbfBatchCandidate(next, nextFresh, nextRegionHints);
      } catch (err) {
        if (next) held.push({ tileKey: next, freshReload: nextFresh });
        throw err;
      }
      if (candidate && candidate.pbfPath === first.pbfPath) {
        batch.push(candidate);
      } else if (next) {
        held.push({ tileKey: next, freshReload: nextFresh });
      }
    }
  } catch (err) {
    requeueCompleteItemsFront(batch.slice(1));
    throw err;
  } finally {
    requeueCompleteItemsFront(held);
  }
  return batch.length > 1 ? batch : null;
}

async function processCompletePbfBatch(batchItems) {
  const batch = Array.isArray(batchItems) ? batchItems.filter(Boolean) : [];
  if (batch.length < 2) return false;
  await assertCacheWritableOrThrow('before-complete-pbf-batch');
  const startedAt = Date.now();
  const pbfPath = batch[0].pbfPath;
  const tiles = batch.map(item => item.tileKey);
  const batchLabel = `${tiles[0]} +${tiles.length - 1}`;
  currentTile = tiles[0] || null;

  setCurrentProgress({
    tile: tiles[0] || null,
    phase: 'complete-pbf-batch',
    source: 'pbf-batch',
    pbfRegions: Array.from(new Set(batch.flatMap(item => item.pbfRegionIds || []))),
    relevantRegionCount: Math.max(...batch.map(item => Number(item.relevantRegionCount || 0))),
    lowCoverage: false,
    thinDetected: false,
    thinExtended: false,
    message: `Starte Complete-PBF-Batch (${tiles.length} Tiles)`,
    startedAt
  });
  pushProcessEvent('tile-batch-start', {
    tile: batchLabel,
    tiles: tiles.slice(),
    freshReload: batch.some(item => item.freshReload),
    source: 'pbf-batch',
    pbf: path.basename(pbfPath),
    pbfRegions: Array.from(new Set(batch.flatMap(item => item.pbfRegionIds || [])))
  });

  let extracted = null;
  try {
    setCurrentProgress({
      phase: 'complete-pbf-batch-load',
      message: `PBF-Batch ${path.basename(pbfPath)} (${tiles.length} Tiles)`
    });
    pushProcessEvent('tile-batch-pbf', {
      tile: batchLabel,
      tiles: tiles.slice(),
      pbf: path.basename(pbfPath)
    });
    extracted = await extractPbfCombinedBatchForPbf(tiles, pbfPath);
    const anyOutput = extracted.filesByTile && extracted.filesByTile.size > 0;
    if (!anyOutput) {
      const msg = (extracted.run?.stderr || extracted.run?.stdout || `PBF-Batch fehlgeschlagen: ${path.basename(pbfPath)}`).trim();
      if (looksLikeCacheUnavailable(msg)) {
        throw new CacheUnavailableError(`Cache/Datenträgerproblem während PBF-Batch ${batchLabel}: ${msg.slice(0, 220)}`);
      }
      throw new Error(msg || 'PBF-Batch lieferte keine Tile-Dateien');
    }

    for (const item of batch) {
      const filePath = extracted.filesByTile.get(item.tileKey);
      if (!filePath || !existsSync(filePath)) {
        pushProcessEvent('tile-batch-miss', {
          tile: item.tileKey,
          source: 'pbf-batch',
          message: 'Keine Batch-Datei für Tile, fallback auf Einzelpfad'
        });
        await processOneTile(item.tileKey, { freshReload: item.freshReload, regionHintIds: item.regionHintIds });
        clearQueueRegionHints(item.tileKey);
        continue;
      }
      setCurrentProgress({
        tile: item.tileKey,
        phase: 'complete-pbf-batch-split',
        source: 'pbf-batch',
        pbfRegions: item.pbfRegionIds.slice(),
        relevantRegionCount: item.relevantRegionCount,
        lowCoverage: item.lowCoverage,
        message: `Split/Speichern aus PBF-Batch (${item.tileKey})`
      });
      await storeCombinedTileFile(item.tileKey, filePath, {
        startedAt,
        freshReload: item.freshReload,
        regionHintIds: item.regionHintIds,
        mergeExisting: item.mergeExisting,
        loadSource: 'pbf-batch',
        run: extracted.run,
        pbfRegionIds: item.pbfRegionIds,
        lowCoverage: item.lowCoverage
      });
      clearQueueRegionHints(item.tileKey);
    }
    setCurrentProgress({
      tile: null,
      phase: 'complete-pbf-batch-done',
      source: 'pbf-batch',
      message: `Complete-PBF-Batch abgeschlossen (${tiles.length} Tiles)`
    });
    return true;
  } finally {
    currentTile = null;
    if (extracted && extracted.tmpDir) {
      try { await fs.rm(extracted.tmpDir, { recursive: true, force: true }); } catch (_) {}
    }
  }
}

async function processQueue() {
  if (processing || infraEnrichProcessing) return;
  processing = true;
  try {
    while (queue.length > 0) {
      const next = queue.shift();
      const nextFresh = queueFreshSet.has(next);
      queueSet.delete(next);
      queueFreshSet.delete(next);
      if (!next) continue;
      const nextRegionHints = getRegionHintsForTile(next);
      try {
        const batch = await collectCompletePbfBatch(next, nextFresh, nextRegionHints);
        if (batch) {
          try {
            await processCompletePbfBatch(batch);
            continue;
          } catch (batchErr) {
            const batchErrText = String(batchErr && batchErr.message || batchErr || '');
            if ((batchErr && batchErr.code === 'CACHE_UNAVAILABLE') || looksLikeCacheUnavailable(batchErrText)) {
              const msg = `Cache offline – Complete-Batch wird pausiert und automatisch erneut versucht`;
              pushProcessEvent('cache-offline', { tile: next, tiles: batch.map(item => item.tileKey), message: msg });
              setCurrentProgress({
                tile: next,
                phase: 'cache-wait',
                source: '',
                message: msg
              });
              requeueCompleteItemsFront(batch);
              await waitForCacheRecovery();
              continue;
            }
            pushProcessEvent('tile-batch-fallback', {
              tile: next,
              tiles: batch.map(item => item.tileKey),
              message: `Complete-Batch fehlgeschlagen, nutze Einzelpfad: ${batchErrText}`
            });
            requeueCompleteItemsFront(batch.slice(1));
          }
        }
        await processOneTile(next, { freshReload: nextFresh, regionHintIds: nextRegionHints });
        clearQueueRegionHints(next);
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
          mergeQueueRegionHints(next, nextRegionHints);
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
        clearQueueRegionHints(next);
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
        setPushStatus({
          running: false,
          ok: false,
          phase: 'failed',
          step: 'exception',
          message: `Auto-Push Fehler: ${e && e.message || e}`,
          finishedAt: Date.now()
        });
        console.error('[Tile-Workbench] Auto-Push Fehler:', e);
      });
    }
    if (infraEnrichQueue.length > 0) processInfraEnrichmentQueue();
  }
}

async function handlePush() {
  if (pushStatus.running) {
    return { ok: false, code: 409, step: 'push_running', message: 'Push läuft bereits.' };
  }
  if (processing || currentTile || queue.length > 0 || infraEnrichProcessing || infraEnrichCurrentTile || infraEnrichQueue.length > 0) {
    const blocked = {
      ok: false,
      code: 409,
      step: 'queue_active',
      message: `Queue läuft noch (${queue.length} normal, ${infraEnrichQueue.length} Enrichment${currentTile || infraEnrichCurrentTile ? ', 1 aktiv' : ''}). Bitte warten bis alles fertig ist.`
    };
    setPushStatus({
      running: false,
      ok: false,
      phase: 'blocked',
      step: blocked.step,
      message: blocked.message,
      finishedAt: Date.now()
    });
    return blocked;
  }

  const startedAt = Date.now();
  const finishPush = (result, phase = '') => {
    setPushStatus({
      running: false,
      ok: !!result.ok,
      phase: phase || (result.ok ? 'done' : 'failed'),
      step: String(result.step || ''),
      message: String(result.message || (result.ok ? 'Push abgeschlossen.' : 'Push fehlgeschlagen.')),
      finishedAt: Date.now(),
      commitMessage: String(result.commitMessage || result.commit || pushStatus.commitMessage || ''),
      stagedFiles: Array.isArray(result.stagedFiles) ? result.stagedFiles : (pushStatus.stagedFiles || [])
    });
    return result;
  };

  setPushStatus({
    running: true,
    ok: null,
    phase: 'sync_check',
    step: 'sync_check',
    message: 'Push: Git-Abgleich läuft...',
    startedAt,
    finishedAt: 0,
    commitMessage: '',
    stagedFiles: []
  });

  const syncState = await getRemoteSyncState();
  if (!syncState.ok) {
    return finishPush({ ok: false, code: 500, step: 'sync_check', message: syncState.message || 'Git-Abgleich fehlgeschlagen' }, 'failed');
  }
  if (syncState.behind > 0) {
    return finishPush({
      ok: false,
      code: 409,
      step: 'behind_remote',
      message: `Lokaler Tile-Branch ist ${syncState.behind} Commit(s) hinter ${syncState.remoteRef || WORKBENCH_PUSH_REF}. Bitte erst den Tile-Branch syncen/pullen, dann erneut pushen.`,
      behind: syncState.behind,
      ahead: syncState.ahead
    }, 'blocked');
  }

  setPushStatus({
    running: true,
    phase: 'status_before',
    step: 'status_before',
    message: 'Push: Tile-Änderungen werden geprüft...'
  });
  const before = await getTileGitStatus();
  if (!before.ok) {
    return finishPush({ ok: false, code: 500, step: 'status_before', message: before.raw || 'git status fehlgeschlagen' }, 'failed');
  }

  const pushPathCandidates = [
    'obstacles/core-tiles',
    'obstacles/poi-tiles',
    'obstacles/infra-tiles',
    'obstacles/core-manifest.v1.json',
    'obstacles/poi-manifest.v1.json',
    'obstacles/infra-manifest.v1.json',
    'obstacles/failed-split-tiles.json'
  ];
  const pushPaths = pushPathCandidates.filter(p => existsSync(path.join(ROOT, p)));

  setPushStatus({
    running: true,
    phase: 'add',
    step: 'add',
    message: 'Push: Tile-Dateien werden gestaged...'
  });
  const add = await runCmd('git', ['add', ...pushPaths], { cwd: ROOT });
  if (add.code !== 0) {
    return finishPush({ ok: false, step: 'add', message: (add.stderr || add.stdout || '').trim() || 'git add failed' }, 'failed');
  }

  setPushStatus({
    running: true,
    phase: 'staged_list',
    step: 'staged_list',
    message: 'Push: Staging wird geprüft...'
  });
  const staged = await runCmd('git', ['diff', '--cached', '--name-only', '--', ...pushPaths], { cwd: ROOT });
  if (staged.code !== 0) {
    return finishPush({ ok: false, code: 500, step: 'staged_list', message: (staged.stderr || staged.stdout || '').trim() || 'staged diff fehlgeschlagen' }, 'failed');
  }
  const stagedFiles = String(staged.stdout || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (stagedFiles.length === 0) {
    return finishPush({ ok: true, message: 'Keine neuen Tile-Änderungen zum Pushen.', stagedFiles: [] }, 'done');
  }
  setPushStatus({
    running: true,
    phase: 'commit',
    step: 'commit',
    message: `Push: Commit wird erstellt (${stagedFiles.length} Datei(en))...`,
    stagedFiles
  });

  const msg = `Update hosted split obstacle tiles (${new Date().toISOString().slice(0, 19).replace('T', ' ')})`;
  const commit = await runCmd('git', ['commit', '-m', msg], { cwd: ROOT });
  if (commit.code !== 0) {
    return finishPush({ ok: false, step: 'commit', message: (commit.stderr || commit.stdout || '').trim() || 'git commit failed', stagedFiles, commitMessage: msg }, 'failed');
  }
  setPushStatus({
    running: true,
    phase: 'push',
    step: 'push',
    message: `Push: Commit wird zu ${WORKBENCH_PUSH_REF} gesendet...`,
    commitMessage: msg,
    stagedFiles
  });

  const push = await runCmd('git', ['push', WORKBENCH_PUSH_REMOTE, `HEAD:${WORKBENCH_PUSH_BRANCH}`], { cwd: ROOT });
  if (push.code !== 0) {
    return finishPush({ ok: false, step: 'push', message: (push.stderr || push.stdout || '').trim() || 'git push failed', commit: msg, stagedFiles }, 'failed');
  }

  return finishPush({
    ok: true,
    message: `Tiles erfolgreich committed und nach ${WORKBENCH_PUSH_REF} gepusht (${stagedFiles.length} Datei(en)).`,
    commitMessage: msg,
    pushOut: (push.stdout || push.stderr || '').trim(),
    stagedFiles,
    pushBranch: WORKBENCH_PUSH_BRANCH,
    pushRemote: WORKBENCH_PUSH_REMOTE,
    aheadBeforePush: syncState.ahead,
    behindBeforePush: syncState.behind,
    changedBeforeAdd: before.lines
  }, 'done');
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
      const state = await getCollectedTileState();
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

    if (req.method === 'POST' && url.pathname === '/api/enrich-infra') {
      const body = await parseBody(req);
      const fresh = !!(body && body.fresh);
      const regionIds = normalizeRegionIds(body && body.regionIds);
      const out = regionIds.length
        ? await enqueueInfraEnrichmentRegions(regionIds, { autoPush: !!(body && body.autoPush), fresh })
        : {
            selectedRegions: [],
            tiles: Array.isArray(body && body.tiles) ? body.tiles : [],
            foundTiles: Array.isArray(body && body.tiles) ? body.tiles.length : 0,
            added: enqueueInfraEnrichmentTiles(body && body.tiles, { autoPush: !!(body && body.autoPush), fresh })
          };
      return sendJson(res, 200, {
        ok: true,
        added: out.added,
        fresh,
        selectedRegions: out.selectedRegions,
        foundTiles: Number(out.foundTiles || 0),
        queueLength: infraEnrichQueue.length,
        processing: infraEnrichProcessing,
        currentTile: infraEnrichCurrentTile
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/enqueue-region') {
      const body = await parseBody(req);
      if (body && body.autoPush) autoPushWhenDone = true;
      const fresh = !!(body && body.fresh);
      const out = await enqueueRegions(body && body.regionIds, { fresh });
      return sendJson(res, 200, {
        ok: true,
        fresh,
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
      queueRegionHintMap.clear();
      infraEnrichQueue.length = 0;
      infraEnrichQueueSet.clear();
      infraEnrichFreshSet.clear();
      infraEnrichRegionHintMap.clear();
      return sendJson(res, 200, { ok: true, queueLength: 0, infraEnrichQueueLength: 0, processing, currentTile, infraEnrichCurrentTile });
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
