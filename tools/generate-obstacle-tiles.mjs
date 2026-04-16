#!/usr/bin/env node
/**
 * Generate hosted obstacle tiles from Overpass and store them locally.
 *
 * Output layout:
 *   obstacles/tiles/<latI>/<lonI>.json
 *
 * Usage examples:
 *   node tools/generate-obstacle-tiles.mjs --bbox 47.2,7.0,49.5,9.5
 *   node tools/generate-obstacle-tiles.mjs --tiles 331|452,332|452 --force
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const VP_OBS_TILE_EDGE_NM = 25;
const VP_OBS_TILE_STEP_LAT = VP_OBS_TILE_EDGE_NM / 60;
const VP_OBS_TILE_STEP_LON = VP_OBS_TILE_EDGE_NM / 60;

const DEFAULT_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter'
];

function parseArgs(argv) {
  const args = {
    bbox: '',
    tiles: '',
    tilesFile: '',
    out: 'obstacles/tiles',
    manifest: 'obstacles/manifest.v1.json',
    delayMs: 3200,
    retries: 2,
    force: false,
    skipExisting: true,
    maxTiles: 0,
    servers: DEFAULT_SERVERS.slice()
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const n = argv[i + 1];
    if (a === '--bbox' && n) { args.bbox = n; i++; continue; }
    if (a === '--tiles' && n) { args.tiles = n; i++; continue; }
    if (a === '--tiles-file' && n) { args.tilesFile = n; i++; continue; }
    if (a === '--out' && n) { args.out = n; i++; continue; }
    if (a === '--manifest' && n) { args.manifest = n; i++; continue; }
    if (a === '--delay-ms' && n) { args.delayMs = Math.max(0, Number(n) || 0); i++; continue; }
    if (a === '--retries' && n) { args.retries = Math.max(1, Number(n) || 1); i++; continue; }
    if (a === '--max-tiles' && n) { args.maxTiles = Math.max(0, Number(n) || 0); i++; continue; }
    if (a === '--servers' && n) { args.servers = n.split(',').map(s => s.trim()).filter(Boolean); i++; continue; }
    if (a === '--force') { args.force = true; args.skipExisting = false; continue; }
    if (a === '--no-skip-existing') { args.skipExisting = false; continue; }
    if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Generate obstacle tiles from Overpass.

Required (one of):
  --bbox south,west,north,east
  --tiles "latI|lonI,latI|lonI"
  --tiles-file path/to/tile-keys.txt

Optional:
  --out obstacles/tiles
  --manifest obstacles/manifest.v1.json
  --delay-ms 3200
  --retries 2
  --max-tiles 0
  --servers <csv>
  --force
`);
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function obsTileKey(lat, lon) {
  const latI = Math.floor((Number(lat) + 90) / VP_OBS_TILE_STEP_LAT);
  const lonI = Math.floor((Number(lon) + 180) / VP_OBS_TILE_STEP_LON);
  return `${latI}|${lonI}`;
}

function obsTileBoundsFromKey(key) {
  const [latI, lonI] = String(key).split('|').map(Number);
  if (!Number.isFinite(latI) || !Number.isFinite(lonI)) return null;
  const south = (latI * VP_OBS_TILE_STEP_LAT) - 90;
  const west = (lonI * VP_OBS_TILE_STEP_LON) - 180;
  return {
    latI,
    lonI,
    south,
    west,
    north: south + VP_OBS_TILE_STEP_LAT,
    east: west + VP_OBS_TILE_STEP_LON
  };
}

function collectTileKeysFromBbox(bboxRaw) {
  const p = String(bboxRaw || '').split(',').map(v => Number(v.trim()));
  if (p.length !== 4 || p.some(v => !Number.isFinite(v))) {
    throw new Error('Ungültige --bbox. Erwartet: south,west,north,east');
  }
  let [south, west, north, east] = p;
  if (south > north) [south, north] = [north, south];
  if (west > east) [west, east] = [east, west];
  const startKey = obsTileKey(south, west);
  const endKey = obsTileKey(north, east);
  const [latStart, lonStart] = startKey.split('|').map(Number);
  const [latEnd, lonEnd] = endKey.split('|').map(Number);
  const set = new Set();
  for (let latI = latStart; latI <= latEnd; latI++) {
    for (let lonI = lonStart; lonI <= lonEnd; lonI++) {
      set.add(`${latI}|${lonI}`);
    }
  }
  return Array.from(set);
}

function normalizeTileKey(v) {
  const s = String(v || '').trim();
  if (!/^-?\d+\|-?\d+$/.test(s)) return '';
  return s;
}

async function readTileKeysFromFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return raw
    .split(/\r?\n/)
    .map(line => line.split('#')[0].trim())
    .filter(Boolean)
    .map(normalizeTileKey)
    .filter(Boolean);
}

function extractFeatures(elements) {
  const obs = [];
  const lin = [];
  if (!Array.isArray(elements)) return { obs, lin };

  for (const e of elements) {
    if (e.type === 'node' && Number.isFinite(e.lat) && Number.isFinite(e.lon)) {
      const isWind = e.tags && e.tags['generator:source'] === 'wind';
      const hRaw = (e.tags && e.tags.height) ? String(e.tags.height).replace(',', '.') : (isWind ? '120' : '50');
      const hMeter = parseFloat(hRaw);
      if (!Number.isFinite(hMeter) || hMeter < 30) continue;
      obs.push({
        type: isWind ? 'wind' : 'mast',
        hFt: Math.round(hMeter * 3.28084),
        elevFt: 0,
        lat: Number(e.lat),
        lon: Number(e.lon)
      });
      continue;
    }
    if (e.type === 'way' && Array.isArray(e.geometry) && e.tags) {
      const featType = e.tags.highway ? 'highway' : (e.tags.waterway ? 'river' : '');
      if (!featType) continue;
      const name = String(e.tags.name || e.tags.ref || '');
      if (!name && featType === 'highway') continue;
      const geom = e.geometry;
      const step = Math.max(1, Math.floor(geom.length / 12));
      for (let i = 0; i < geom.length; i += step) {
        const g = geom[i];
        if (!g || !Number.isFinite(g.lat) || !Number.isFinite(g.lon)) continue;
        lin.push({
          type: featType,
          name,
          lat: Number(g.lat),
          lon: Number(g.lon)
        });
      }
    }
  }
  return { obs, lin };
}

function buildOverpassQuery(bbox) {
  const box = `${bbox.south.toFixed(4)},${bbox.west.toFixed(4)},${bbox.north.toFixed(4)},${bbox.east.toFixed(4)}`;
  return `[out:json][timeout:45][bbox:${box}];(node["generator:source"="wind"];node["man_made"~"mast|tower"]["height"];way["highway"="motorway"];way["waterway"="river"];);out geom qt;`;
}

async function fetchTileFromOverpass(tileKey, servers, retries = 2) {
  const bounds = obsTileBoundsFromKey(tileKey);
  if (!bounds) return { ok: false, status: 0, error: 'invalid tile key' };
  const query = buildOverpassQuery(bounds);

  let attempt = 0;
  let lastError = '';
  while (attempt < retries) {
    const server = servers[attempt % servers.length];
    try {
      const res = await fetch(server, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`
      });
      if (res.status === 429 || res.status === 504) {
        const retryAfter = Number(res.headers.get('retry-after') || 0);
        return { ok: false, status: res.status, error: `HTTP ${res.status}`, retryAfterSec: retryAfter };
      }
      if (!res.ok) {
        attempt++;
        lastError = `HTTP ${res.status}`;
        await sleep(1200);
        continue;
      }
      const data = await res.json();
      const features = extractFeatures(data && data.elements);
      return { ok: true, status: 200, server, features };
    } catch (e) {
      attempt++;
      lastError = String(e?.message || e);
      await sleep(1200);
    }
  }

  return { ok: false, status: 0, error: lastError || 'fetch failed' };
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeTileFile(outDir, tileKey, features) {
  const bounds = obsTileBoundsFromKey(tileKey);
  if (!bounds) throw new Error(`Ungültiger Tile-Key: ${tileKey}`);
  const dir = path.join(outDir, String(bounds.latI));
  await ensureDir(dir);
  const filePath = path.join(dir, `${bounds.lonI}.json`);
  const payload = {
    version: 1,
    tile: tileKey,
    updatedAt: new Date().toISOString(),
    obs: Array.isArray(features?.obs) ? features.obs : [],
    lin: Array.isArray(features?.lin) ? features.lin : []
  };
  await fs.writeFile(filePath, JSON.stringify(payload), 'utf8');
  return filePath;
}

async function loadManifest(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object') ? obj : {};
  } catch {
    return {};
  }
}

async function saveManifest(filePath, manifest) {
  const out = {
    version: 1,
    generatedAt: new Date().toISOString(),
    grid: {
      tileEdgeNm: VP_OBS_TILE_EDGE_NM,
      stepLatDeg: VP_OBS_TILE_STEP_LAT,
      stepLonDeg: VP_OBS_TILE_STEP_LON
    },
    ...manifest
  };
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(out, null, 2), 'utf8');
}

async function main() {
  const args = parseArgs(process.argv);
  const cwd = process.cwd();
  const outDir = path.resolve(cwd, args.out);
  const manifestPath = path.resolve(cwd, args.manifest);

  let tileKeys = [];
  if (args.bbox) tileKeys.push(...collectTileKeysFromBbox(args.bbox));
  if (args.tiles) tileKeys.push(...args.tiles.split(',').map(normalizeTileKey).filter(Boolean));
  if (args.tilesFile) tileKeys.push(...await readTileKeysFromFile(path.resolve(cwd, args.tilesFile)));
  tileKeys = Array.from(new Set(tileKeys));

  if (!tileKeys.length) {
    printHelp();
    throw new Error('Keine Tiles ausgewählt. Nutze --bbox oder --tiles.');
  }
  if (args.maxTiles > 0) tileKeys = tileKeys.slice(0, args.maxTiles);

  const servers = (args.servers && args.servers.length) ? args.servers : DEFAULT_SERVERS;
  await ensureDir(outDir);

  console.log(`[Tiles] Start: ${tileKeys.length} Tiles, out=${outDir}`);
  const ok = [];
  const failed = [];

  for (let i = 0; i < tileKeys.length; i++) {
    const key = tileKeys[i];
    const b = obsTileBoundsFromKey(key);
    if (!b) {
      failed.push({ tile: key, status: 0, error: 'invalid key' });
      continue;
    }
    const f = path.join(outDir, String(b.latI), `${b.lonI}.json`);
    if (args.skipExisting && !args.force) {
      try {
        await fs.access(f);
        console.log(`[Tiles] ${i + 1}/${tileKeys.length} skip existing ${key}`);
        ok.push({ tile: key, file: f, skipped: true });
        continue;
      } catch {}
    }

    console.log(`[Tiles] ${i + 1}/${tileKeys.length} fetch ${key} ...`);
    const res = await fetchTileFromOverpass(key, servers, args.retries);
    if (!res.ok) {
      failed.push({ tile: key, status: res.status || 0, error: res.error || 'failed' });
      if (res.status === 429 || res.status === 504) {
        const waitMs = Math.max(4000, (Number(res.retryAfterSec || 0) * 1000) || 8000);
        console.warn(`[Tiles] ${key} -> ${res.status}, warte ${(waitMs / 1000).toFixed(1)}s`);
        await sleep(waitMs);
      }
    } else {
      const file = await writeTileFile(outDir, key, res.features);
      ok.push({ tile: key, file, server: res.server });
    }

    if (i < tileKeys.length - 1 && args.delayMs > 0) await sleep(args.delayMs);
  }

  const existingManifest = await loadManifest(manifestPath);
  const generatedTiles = ok.filter(x => !x.skipped).map(x => x.tile);
  const mergedTileList = Array.from(new Set([
    ...(Array.isArray(existingManifest.tiles) ? existingManifest.tiles : []),
    ...generatedTiles
  ])).sort();

  await saveManifest(manifestPath, {
    regions: Array.isArray(existingManifest.regions) ? existingManifest.regions : [],
    tileCount: mergedTileList.length,
    tiles: mergedTileList
  });

  const failedPath = path.resolve(cwd, 'obstacles/failed-tiles.json');
  await fs.writeFile(failedPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    ok: ok.length,
    failed: failed.length,
    failedTiles: failed
  }, null, 2), 'utf8');

  console.log(`[Tiles] Fertig: ok=${ok.length}, failed=${failed.length}`);
  console.log(`[Tiles] Manifest: ${manifestPath}`);
  console.log(`[Tiles] Failed-Report: ${failedPath}`);
  if (failed.length > 0) process.exitCode = 2;
}

main().catch(err => {
  console.error(`[Tiles] ERROR: ${err?.message || err}`);
  process.exit(1);
});

