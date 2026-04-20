#!/usr/bin/env node
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const TOOLS_DIR = path.join(ROOT, 'tools');
const HTML_PATH = path.join(TOOLS_DIR, 'obstacle-tile-workbench.html');
const OBST_DIR = path.join(ROOT, 'obstacles');
const TILE_DIR = path.join(OBST_DIR, 'tiles');
const MANIFEST_PATH = path.join(OBST_DIR, 'manifest.v1.json');
const FAILED_PATH = path.join(OBST_DIR, 'failed-tiles.json');

const TILE_STEP_DEG = 25 / 60;
const STALE_AFTER_MS = 90 * 24 * 60 * 60 * 1000;
const PORT = Number(process.env.OBS_WORKBENCH_PORT || 8788);

const queue = [];
const queueSet = new Set();
let processing = false;
let currentTile = null;
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
  remoteTiles: []
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

function tileToFile(tileKey) {
  const [latI, lonI] = tileKey.split('|');
  return path.join(TILE_DIR, latI, `${lonI}.json`);
}

async function readJsonSafe(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
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

async function getTileGitStatus() {
  const r = await runCmd('git', ['status', '--porcelain', '--', 'obstacles/tiles', 'obstacles/manifest.v1.json', 'obstacles/failed-tiles.json'], { cwd: ROOT });
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

async function collectLocalTileKeysFromFs() {
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
      if (!e.isFile() || !e.name.endsWith('.json')) continue;
      const rel = path.relative(TILE_DIR, full);
      const m = rel.match(/^(-?\d+)[/\\](-?\d+)\.json$/);
      if (!m) continue;
      const key = normalizeTileKey(`${m[1]}|${m[2]}`);
      if (key) out.add(key);
    }
  }
  await walk(TILE_DIR);
  return out;
}

async function loadRemoteTilesFromOriginMain() {
  const show = await runCmd('git', ['show', 'origin/main:obstacles/manifest.v1.json'], { cwd: ROOT });
  if (show.code !== 0) {
    return {
      ok: false,
      message: (show.stderr || show.stdout || '').trim() || 'Konnte origin/main Manifest nicht lesen'
    };
  }
  let parsed = null;
  try {
    parsed = JSON.parse(String(show.stdout || '{}'));
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

  const remoteRes = await loadRemoteTilesFromOriginMain();
  if (!remoteRes.ok) {
    lastRepoSync = {
      ...lastRepoSync,
      ok: false,
      checkedAt: Date.now(),
      message: remoteRes.message || 'Remote-Tiles konnten nicht gelesen werden'
    };
    return lastRepoSync;
  }

  const localTiles = await collectLocalTileKeysFromFs();
  const remoteTiles = remoteRes.tiles;

  const missingInRepo = [];
  for (const k of localTiles) if (!remoteTiles.has(k)) missingInRepo.push(k);
  const missingLocal = [];
  for (const k of remoteTiles) if (!localTiles.has(k)) missingLocal.push(k);
  missingInRepo.sort();
  missingLocal.sort();

  lastRepoSync = {
    ok: true,
    checkedAt: Date.now(),
    message: 'Repo-Sync geprüft',
    remoteRef: 'origin/main',
    remoteTileCount: remoteTiles.size,
    localTileCount: localTiles.size,
    missingInRepoCount: missingInRepo.length,
    missingLocalCount: missingLocal.length,
    missingInRepoSample: missingInRepo.slice(0, 20),
    missingLocalSample: missingLocal.slice(0, 20),
    missingInRepoTiles: missingInRepo,
    remoteTiles: Array.from(remoteTiles)
  };
  return lastRepoSync;
}

async function collectTileState() {
  const manifest = await readJsonSafe(MANIFEST_PATH, {
    version: 1,
    generatedAt: new Date().toISOString(),
    grid: { tileEdgeNm: 25, stepLatDeg: TILE_STEP_DEG, stepLonDeg: TILE_STEP_DEG },
    regions: [],
    tileCount: 0,
    tiles: []
  });

  const failedData = await readJsonSafe(FAILED_PATH, { failedTiles: [] });
  const failedMap = {};
  for (const item of Array.isArray(failedData.failedTiles) ? failedData.failedTiles : []) {
    const key = normalizeTileKey(item && item.tile);
    if (!key) continue;
    failedMap[key] = {
      status: Number(item.status || 0),
      error: String(item.error || ''),
      at: Date.now()
    };
  }

  const loadedMap = {};
  const now = Date.now();
  const seen = new Set();
  for (const key of Array.isArray(manifest.tiles) ? manifest.tiles : []) {
    const tileKey = normalizeTileKey(key);
    if (!tileKey || seen.has(tileKey)) continue;
    seen.add(tileKey);
    const file = tileToFile(tileKey);
    if (!existsSync(file)) continue;
    try {
      const st = await fs.stat(file);
      const mtimeMs = Number(st.mtimeMs || 0);
      loadedMap[tileKey] = {
        mtimeMs,
        stale: (now - mtimeMs) > STALE_AFTER_MS,
        bytes: Number(st.size || 0)
      };
    } catch (_) {
      // ignore unreadable file
    }
  }

  const recent = {};
  for (const [k, v] of lastResults.entries()) recent[k] = v;

  return {
    ok: true,
    root: ROOT,
    port: PORT,
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
      generatedAt: manifest.generatedAt || null,
      tileCount: Number(manifest.tileCount || Object.keys(loadedMap).length || 0)
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
  const cmd = ['tools/generate-obstacle-tiles.mjs', '--tiles', tileKey, '--force', '--delay-ms', '1000'];
  const run = await runCmd('node', cmd, { cwd: ROOT });

  const failedData = await readJsonSafe(FAILED_PATH, { failedTiles: [] });
  const failedSet = new Set(
    (Array.isArray(failedData.failedTiles) ? failedData.failedTiles : [])
      .map(x => normalizeTileKey(x && x.tile))
      .filter(Boolean)
  );
  const file = tileToFile(tileKey);
  const hasFile = existsSync(file);
  const ok = hasFile && !failedSet.has(tileKey);

  lastResults.set(tileKey, {
    ok,
    at: Date.now(),
    durationMs: Date.now() - startedAt,
    code: run.code,
    message: ok
      ? 'Tile geladen und gespeichert'
      : ((run.stderr && run.stderr.trim()) || (run.stdout && run.stdout.trim().split('\n').slice(-2).join(' | ')) || 'Tile-Load fehlgeschlagen')
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
      } catch (err) {
        lastResults.set(next, {
          ok: false,
          at: Date.now(),
          durationMs: 0,
          code: 1,
          message: `Interner Fehler: ${String(err && err.message || err)}`
        });
      } finally {
        currentTile = null;
      }
    }
  } finally {
    processing = false;
    currentTile = null;
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

  const add = await runCmd('git', ['add', 'obstacles/tiles', 'obstacles/manifest.v1.json', 'obstacles/failed-tiles.json'], { cwd: ROOT });
  if (add.code !== 0) {
    return { ok: false, step: 'add', message: (add.stderr || add.stdout || '').trim() || 'git add failed' };
  }

  const staged = await runCmd('git', ['diff', '--cached', '--name-only', '--', 'obstacles/tiles', 'obstacles/manifest.v1.json', 'obstacles/failed-tiles.json'], { cwd: ROOT });
  if (staged.code !== 0) {
    return { ok: false, code: 500, step: 'staged_list', message: (staged.stderr || staged.stdout || '').trim() || 'staged diff fehlgeschlagen' };
  }
  const stagedFiles = String(staged.stdout || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (stagedFiles.length === 0) {
    return { ok: true, message: 'Keine neuen Tile-Änderungen zum Pushen.', stagedFiles: [] };
  }

  const msg = `Update hosted obstacle tiles (${new Date().toISOString().slice(0, 19).replace('T', ' ')})`;
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
  console.log(`[Tile-Workbench] Root: ${ROOT}`);
});
