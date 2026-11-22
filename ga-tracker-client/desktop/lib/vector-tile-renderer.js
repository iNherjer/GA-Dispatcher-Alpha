'use strict';

// Vector map tiles for the MSFS EFB, drawn by the desktop app.
//
// Coherent GT (EFB) has no WebGL and crashed with a canvas vector renderer
// (tracker v553). The desktop app runs Electron with WebGL, so a hidden
// offscreen window draws the web app's "VFR Vektor (OSM)" style with MapLibre
// and cuts it into ordinary 256 px JPEG tiles. The tracker fetches them over a
// private loopback server (port and random token are handed to the tracker
// child process, like the media bridge) and serves them to the EFB through its
// existing tile path with disk cache. The EFB only ever sees raster tiles.

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const TILE_PATTERN = /^\/vector-tile\/(vfr)\/(\d{1,2})\/(\d{1,8})\/(\d{1,8})\.png$/;
const MIN_ZOOM = 3;
const MAX_ZOOM = 16;
// Tiles per block side and margin in px: one render gives 16 tiles, labels at
// the block edge are placed as on a larger map.
const BLOCK_TILES = 4;
const BLOCK_MARGIN = 256;
const MAX_CACHED_BLOCKS = 48;
const MAX_QUEUE = 24;
const IDLE_CLOSE_MS = 10 * 60 * 1000;
const TILE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function blockFor(z, x, y) {
  const n = Math.min(BLOCK_TILES, 2 ** z);
  const x0 = Math.floor(x / n) * n;
  const y0 = Math.floor(y / n) * n;
  return { z, x0, y0, n, index: (y - y0) * n + (x - x0), key: `${z}/${x0}/${y0}` };
}

function parseTilePath(url) {
  const match = TILE_PATTERN.exec(String(url || '').split('?')[0]);
  if (!match) return null;
  const z = Number(match[2]), x = Number(match[3]), y = Number(match[4]);
  const limit = 2 ** z;
  if (z < MIN_ZOOM || z > MAX_ZOOM || x >= limit || y >= limit) return null;
  return { style: match[1], z, x, y };
}

function createVectorTileRenderer({ BrowserWindow, log = () => {}, styleFile, pageFile } = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const stylePath = styleFile || path.join(__dirname, 'vector-render', 'vfr-vector.json');
  const pagePath = pageFile || path.join(__dirname, 'vector-render', 'render.html');
  let server = null;
  let win = null;
  let ready = null;
  let idleTimer = null;
  let failures = 0;
  const blocks = new Map();
  const queue = [];
  let busy = false;

  function closeWindow(reason) {
    clearTimeout(idleTimer);
    idleTimer = null;
    ready = null;
    if (win && !win.isDestroyed()) win.destroy();
    win = null;
    if (reason) log(`VECTOR_RENDER_WINDOW_CLOSED reason=${reason}`);
  }

  function scheduleIdleClose() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => closeWindow('idle'), IDLE_CLOSE_MS);
  }

  function ensureWindow() {
    if (ready) return ready;
    const size = BLOCK_TILES * 256 + 2 * BLOCK_MARGIN;
    win = new BrowserWindow({
      show: false,
      width: size,
      height: size,
      useContentSize: true,
      paintWhenInitiallyHidden: true,
      skipTaskbar: true,
      webPreferences: {
        offscreen: true,
        // Own session: no cookies or request filters of the app window.
        partition: 'vector-render',
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false
      }
    });
    win.webContents.setFrameRate(30);
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', (event) => event.preventDefault());
    win.webContents.on('render-process-gone', (_event, details) => {
      log(`VECTOR_RENDER_PROCESS_GONE reason=${details && details.reason}`);
      closeWindow('');
    });
    const current = win;
    ready = (async () => {
      await current.loadFile(pagePath);
      const style = JSON.parse(await fs.promises.readFile(stylePath, 'utf8'));
      await current.webContents.executeJavaScript(`window.gaVectorInit(${JSON.stringify(style)})`, true);
      log('VECTOR_RENDER_READY');
      return current;
    })();
    ready.catch((error) => {
      log(`VECTOR_RENDER_INIT_ERROR error=${String(error && error.message || error).slice(0, 160)}`);
      if (win === current) closeWindow('');
    });
    return ready;
  }

  async function renderBlock(block) {
    const target = await ensureWindow();
    const started = Date.now();
    const result = await target.webContents.executeJavaScript(
      `window.gaVectorRenderBlock(${block.z}, ${block.x0}, ${block.y0}, ${block.n}, ${BLOCK_MARGIN})`, true);
    if (!result || !Array.isArray(result.tiles) || result.tiles.length !== block.n * block.n) throw new Error('vector_render_empty');
    log(`VECTOR_RENDER_BLOCK z=${block.z} x=${block.x0} y=${block.y0} ms=${Date.now() - started} complete=${result.complete === true}`);
    return { complete: result.complete === true, tiles: result.tiles.map((tile) => Buffer.from(tile, 'base64')) };
  }

  function pump() {
    if (busy || !queue.length) return;
    busy = true;
    const job = queue.shift();
    renderBlock(job.block).then((value) => {
      failures = 0;
      job.resolve(value);
    }, (error) => {
      failures += 1;
      if (failures >= 3) closeWindow('failures');
      job.reject(error);
    }).finally(() => {
      busy = false;
      scheduleIdleClose();
      pump();
    });
  }

  function getBlock(block) {
    const cached = blocks.get(block.key);
    if (cached) {
      blocks.delete(block.key);
      blocks.set(block.key, cached);
      return cached;
    }
    if (queue.length >= MAX_QUEUE) {
      // The EFB has moved on: drop the oldest waiting block, not the newest.
      const dropped = queue.shift();
      blocks.delete(dropped.block.key);
      dropped.reject(new Error('vector_render_queue_full'));
    }
    const pending = new Promise((resolve, reject) => {
      queue.push({ block, resolve, reject });
      pump();
    });
    blocks.set(block.key, pending);
    // Incomplete pictures (a source timed out) are not kept.
    pending.then((value) => { if (!value.complete) blocks.delete(block.key); }, () => blocks.delete(block.key));
    while (blocks.size > MAX_CACHED_BLOCKS) blocks.delete(blocks.keys().next().value);
    return pending;
  }

  async function tile(z, x, y) {
    const block = blockFor(z, x, y);
    const value = await getBlock(block);
    return { body: value.tiles[block.index], complete: value.complete };
  }

  function authorised(request) {
    const provided = Buffer.from(String(request.headers['x-ga-render-token'] || ''));
    const expected = Buffer.from(token);
    return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
  }

  return {
    async start() {
      server = http.createServer(async (request, response) => {
        request.resume();
        const fail = (status, error) => {
          response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          response.end(JSON.stringify({ ok: false, error }));
        };
        if (request.method !== 'GET' || !authorised(request)) return fail(403, 'vector_render_access_denied');
        if (request.url === '/vector-tile/status') {
          response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          response.end(JSON.stringify({ ok: true, styles: ['vfr'], minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM }));
          return;
        }
        const requested = parseTilePath(request.url);
        if (!requested) return fail(404, 'vector_tile_unknown');
        try {
          const result = await tile(requested.z, requested.x, requested.y);
          response.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Content-Length': result.body.length,
            // An incomplete picture is served but must not be kept for a week.
            'Cache-Control': result.complete ? `public, max-age=${TILE_MAX_AGE_SECONDS}` : 'no-store'
          });
          response.end(result.body);
        } catch (error) {
          if (!response.headersSent) fail(503, String(error && error.message || 'vector_render_failed').slice(0, 80));
        }
      });
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
      return { port: server.address().port, token };
    },
    async close() {
      for (const job of queue.splice(0)) job.reject(new Error('vector_render_closed'));
      closeWindow('');
      if (server) await new Promise((resolve) => server.close(resolve));
      server = null;
    },
    tile
  };
}

module.exports = { BLOCK_TILES, MAX_ZOOM, MIN_ZOOM, blockFor, createVectorTileRenderer, parseTilePath };
