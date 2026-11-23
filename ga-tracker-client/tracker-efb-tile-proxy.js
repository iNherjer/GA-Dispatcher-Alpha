'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const MAX_TILE_BYTES = 2 * 1024 * 1024;
const DEFAULT_TILE_CACHE_ENTRIES = 192;
const DEFAULT_TILE_CACHE_BYTES = 32 * 1024 * 1024;
const DEFAULT_TILE_TIMEOUT_MS = 9000;
// Local disk cache (FSPM-style): tiles are served from the PC until they are
// old, then revalidated. At least 7 days (OSM tile policy), at most 30 days.
const DEFAULT_DISK_CACHE_BYTES = 1024 * 1024 * 1024;
const DISK_CACHE_MIN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DISK_CACHE_MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DISK_CACHE_DIRNAME = 'Map Tile Cache';
// Stable app identification with a contact link (OSM tile usage policy).
const TILE_USER_AGENT = 'VFR-Multitool-Tracker-EFB/1.1 (+https://github.com/iNherjer/GA-Dispatcher-Alpha)';

// Outside the synced Documents folder: next to the runtimes in LocalAppData.
function defaultTileCacheDirectory(env = process.env) {
  const base = String(env.VFR_MULTITOOL_LOCAL_APP_DATA_DIR || env.LOCALAPPDATA || '').trim() || os.tmpdir();
  return path.join(base, 'VFR Multitool', DISK_CACHE_DIRNAME);
}

function cacheTtlMs(cacheControl) {
  const match = /max-age\s*=\s*(\d+)/i.exec(String(cacheControl || ''));
  const seconds = match ? Number(match[1]) : 0;
  return Math.max(DISK_CACHE_MIN_TTL_MS, Math.min(DISK_CACHE_MAX_TTL_MS, seconds * 1000));
}

const TILE_SOURCES = Object.freeze({
  topo: Object.freeze({
    urls: Object.freeze([
      'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      'https://backup.opentopomap.org/{z}/{x}/{y}.png'
    ])
  }),
  osm: Object.freeze({
    urls: Object.freeze(['https://tile.openstreetmap.org/{z}/{x}/{y}.png'])
  }),
  'osm-de': Object.freeze({
    urls: Object.freeze(['https://tile.openstreetmap.de/{z}/{x}/{y}.png'])
  }),
  'osm-swiss': Object.freeze({
    urls: Object.freeze(['https://tile.osm.ch/osm-swiss-style/{z}/{x}/{y}.png'])
  }),
  cyclosm: Object.freeze({
    urls: Object.freeze(['https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png'])
  }),
  'nasa-bluemarble': Object.freeze({
    urls: Object.freeze(['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg']),
    maxZoom: 8
  }),
  'nasa-night': Object.freeze({
    urls: Object.freeze(['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png']),
    maxZoom: 8
  }),
  'esri-topo': Object.freeze({
    urls: Object.freeze(['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'])
  }),
  'basemap-de': Object.freeze({
    urls: Object.freeze(['https://sgx.geodatenzentrum.de/wmts_basemapde/tile/1.0.0/de_basemapde_web_raster_farbe/default/GLOBAL_WEBMERCATOR/{z}/{y}/{x}.png'])
  }),
  swisstopo: Object.freeze({
    urls: Object.freeze(['https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg'])
  }),
  terrain: Object.freeze({
    urls: Object.freeze(['https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}'])
  }),
  satellite: Object.freeze({
    urls: Object.freeze(['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'])
  }),
  dark: Object.freeze({
    urls: Object.freeze(['https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'])
  }),
  light: Object.freeze({
    urls: Object.freeze(['https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'])
  }),
  aero: Object.freeze({
    urls: Object.freeze(['https://nwy-tiles-api.prod.newaydata.com/tiles/{z}/{x}/{y}.png?path=latest/aero/latest'])
  }),
  dfs: Object.freeze({
    urls: Object.freeze(['https://secais.dfs.de/static-maps/icao500/tiles/{z}/{x}/{y}.png'])
  }),
  // "VFR Vektor (OSM)" drawn by the desktop app (desktop/lib/vector-tile-renderer.js):
  // Coherent has no WebGL, the desktop app does. Only available while the desktop
  // app started this tracker and handed over its loopback port and token.
  'vfr-vector': Object.freeze({
    desktopRender: 'vfr',
    urls: Object.freeze([]),
    minZoom: 3,
    maxZoom: 16
  })
});

// Desktop vector renderer endpoint from the environment the desktop app sets
// for its tracker child process (like the media bridge).
function desktopRenderEndpoint(env = process.env) {
  const port = Number(env.VFR_MULTITOOL_MAP_RENDER_PORT);
  const token = String(env.VFR_MULTITOOL_MAP_RENDER_TOKEN || '').trim();
  if (!Number.isInteger(port) || port <= 0 || port > 65535 || !/^[0-9a-f]{64}$/.test(token)) return null;
  return { port, token };
}

// A renderer answer marked no-store (a source timed out while drawing) is
// served once but kept neither in memory nor on disk.
function isNoStore(cacheControl) {
  return /(^|,)\s*no-store\s*(,|$)/i.test(String(cacheControl || ''));
}

function sanitize(value, limit = 180) {
  return String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').slice(0, limit);
}

// Colour set of the desktop-rendered vector map (efb-app/map-shell-core.js
// encodeVectorStyle): six colours and four numbers in fixed order.
const VECTOR_STYLE_VARIANT_PATTERN = /^[0-9a-f]{6}\.\d{1,3}\.[0-9a-f]{6}\.\d{1,3}\.[0-9a-f]{6}\.[0-9a-f]{6}\.[0-9a-f]{6}\.[0-9a-f]{6}\.\d{1,3}\.\d{1,3}$/;

function vectorStyleVariant(search = '') {
  const match = /(?:^|[?&])s=([^&]*)/.exec(String(search || ''));
  const value = match ? decodeURIComponent(match[1]).toLowerCase() : '';
  return VECTOR_STYLE_VARIANT_PATTERN.test(value) ? value : '';
}

function parseTrackerEfbTilePath(pathname = '', search = '') {
  const match = String(pathname || '').match(/^\/api\/v1\/map-tile\/([a-z][a-z0-9-]*)\/(\d{1,2})\/(\d{1,8})\/(\d{1,8})\.png$/);
  if (!match || !Object.hasOwn(TILE_SOURCES, match[1])) return null;
  const z = Number(match[2]);
  const x = Number(match[3]);
  const y = Number(match[4]);
  const limit = 2 ** z;
  const maxZoom = Number(TILE_SOURCES[match[1]].maxZoom) || 20;
  const minZoom = Number(TILE_SOURCES[match[1]].minZoom) || 0;
  if (!Number.isSafeInteger(z) || z < minZoom || z > maxZoom
    || !Number.isSafeInteger(x) || x < 0 || x >= limit
    || !Number.isSafeInteger(y) || y < 0 || y >= limit) return null;
  const tile = { layer: match[1], z, x, y };
  // Only desktop-rendered maps know colour sets; anything else is ignored.
  const variant = TILE_SOURCES[match[1]].desktopRender ? vectorStyleVariant(search) : '';
  if (variant) tile.variant = variant;
  return tile;
}

function tileUrl(template, tile) {
  const subdomains = ['a', 'b', 'c'];
  const subdomain = subdomains[Math.abs(tile.x + tile.y) % subdomains.length];
  return String(template)
    .replace(/\{s\}/g, subdomain)
    .replace(/\{z\}/g, String(tile.z))
    .replace(/\{x\}/g, String(tile.x))
    .replace(/\{y\}/g, String(tile.y))
    .replace(/\{r\}/g, '');
}

function createTrackerEfbTileProxy(options = {}) {
  const fetchRemote = typeof options.fetchRemote === 'function' ? options.fetchRemote : globalThis.fetch;
  if (typeof fetchRemote !== 'function') throw new Error('Der EFB-Kachelproxy benoetigt eine Fetch-Implementierung.');
  const log = typeof options.log === 'function' ? options.log : () => {};
  const maxEntries = Math.max(16, Math.min(512, Number(options.maxEntries) || DEFAULT_TILE_CACHE_ENTRIES));
  const maxCacheBytes = Math.max(4 * 1024 * 1024, Math.min(64 * 1024 * 1024,
    Number(options.maxCacheBytes) || DEFAULT_TILE_CACHE_BYTES));
  const timeoutMs = Math.max(1500, Math.min(20000, Number(options.timeoutMs) || DEFAULT_TILE_TIMEOUT_MS));
  const cache = new Map();
  let cacheBytes = 0;
  const inflight = new Map();
  const readyLayers = new Set();
  const lastErrorAt = new Map();
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const diskDir = options.cacheDir ? path.resolve(String(options.cacheDir)) : '';
  const maxDiskBytes = Math.max(16 * 1024 * 1024, Number(options.maxDiskBytes) || DEFAULT_DISK_CACHE_BYTES);
  let diskBytes = 0;
  let diskFiles = 0;
  let diskGeneration = 0;
  let evicting = null;
  let diskErrorLogged = false;
  const diskStats = { hits: 0, revalidated: 0, stale: 0, writes: 0 };
  const renderEndpoint = options.renderEndpoint === undefined ? desktopRenderEndpoint() : options.renderEndpoint;
  let renderActivityRequest = Promise.resolve();
  // Drawing a 4×4 block takes about a second, a few more when the queue is long.
  const renderTimeoutMs = Math.max(timeoutMs, 25000);

  function setDesktopRenderActive(active) {
    if (!renderEndpoint) return;
    renderActivityRequest = renderActivityRequest.then(() => fetchRemote(
      `http://127.0.0.1:${renderEndpoint.port}/vector-tile/active/${active ? 1 : 0}`, {
        method: 'POST',
        headers: { 'X-GA-Render-Token': renderEndpoint.token },
        redirect: 'error',
        signal: AbortSignal.timeout(2000)
      }
    )).catch(error => log(`EFB_VECTOR_ACTIVITY_ERROR error=${sanitize(error?.message || error)}`));
  }

  function diskError(stage, error) {
    if (diskErrorLogged) return;
    diskErrorLogged = true;
    log(`EFB_TILE_CACHE_ERROR stage=${stage} error=${sanitize(error && error.message || error)}`);
  }

  function diskPaths(tile) {
    // Every colour set of the vector map has its own folder.
    const folder = tile.variant ? `${tile.layer}~${tile.variant}` : tile.layer;
    const dir = path.join(diskDir, folder, String(tile.z), String(tile.x));
    return { dir, body: path.join(dir, `${tile.y}.tile`), meta: path.join(dir, `${tile.y}.json`) };
  }

  async function walkDisk(visit) {
    async function walk(dir, depth) {
      let entries = [];
      try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch (_) { return; }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory() && depth < 3) await walk(full, depth + 1);
        else if (entry.isFile() && entry.name.endsWith('.json')) await visit(full);
      }
    }
    await walk(diskDir, 0);
  }

  async function readMeta(file) {
    try { return JSON.parse(await fs.promises.readFile(file, 'utf8')); } catch (_) { return null; }
  }

  // Total size on start; the cache only grows through this process afterwards.
  const scanned = !diskDir ? Promise.resolve() : walkDisk(async (file) => {
    const meta = await readMeta(file);
    if (!meta) return;
    diskBytes += Number(meta.bytes) || 0;
    diskFiles += 1;
  }).catch((error) => diskError('scan', error));

  async function readDisk(tile) {
    if (!diskDir) return null;
    const files = diskPaths(tile);
    const meta = await readMeta(files.meta);
    if (!meta || !String(meta.contentType || '').startsWith('image/')) return null;
    try {
      const body = await fs.promises.readFile(files.body);
      if (!body.length || body.length > MAX_TILE_BYTES) return null;
      return { body, contentType: meta.contentType, meta };
    } catch (_) { return null; }
  }

  async function writeDisk(tile, result, headerInfo, previous) {
    if (!diskDir) return;
    const generation = diskGeneration;
    const files = diskPaths(tile);
    const fetchedAt = now();
    const meta = {
      contentType: result.contentType,
      bytes: result.body.length,
      fetchedAt,
      expiresAt: fetchedAt + cacheTtlMs(headerInfo.cacheControl),
      etag: headerInfo.etag || '',
      lastModified: headerInfo.lastModified || ''
    };
    try {
      await fs.promises.mkdir(files.dir, { recursive: true });
      if (generation !== diskGeneration) return;
      const suffix = `.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
      await fs.promises.writeFile(files.body + suffix, result.body);
      await fs.promises.rename(files.body + suffix, files.body);
      await fs.promises.writeFile(files.meta + suffix, JSON.stringify(meta));
      await fs.promises.rename(files.meta + suffix, files.meta);
      if (generation !== diskGeneration) return;
      diskBytes += meta.bytes - (previous ? Number(previous.meta.bytes) || 0 : 0);
      if (!previous) diskFiles += 1;
      diskStats.writes += 1;
      if (diskBytes > maxDiskBytes) void evictDisk();
    } catch (error) { diskError('write', error); }
  }

  async function touchDisk(tile, previous, headerInfo) {
    const files = diskPaths(tile);
    const fetchedAt = now();
    const meta = Object.assign({}, previous.meta, {
      fetchedAt,
      expiresAt: fetchedAt + cacheTtlMs(headerInfo.cacheControl || ''),
      etag: headerInfo.etag || previous.meta.etag || '',
      lastModified: headerInfo.lastModified || previous.meta.lastModified || ''
    });
    try { await fs.promises.writeFile(files.meta, JSON.stringify(meta)); } catch (error) { diskError('touch', error); }
  }

  // Oldest tiles go first until the cache is back at 90 % of its limit.
  function evictDisk() {
    if (evicting) return evicting;
    evicting = (async () => {
      const items = [];
      await walkDisk(async (file) => {
        const meta = await readMeta(file);
        items.push({ file, bytes: meta ? Number(meta.bytes) || 0 : 0, fetchedAt: meta ? Number(meta.fetchedAt) || 0 : 0 });
      });
      items.sort((a, b) => a.fetchedAt - b.fetchedAt);
      let total = items.reduce((sum, item) => sum + item.bytes, 0);
      let files = items.length;
      for (const item of items) {
        if (total <= maxDiskBytes * 0.9) break;
        await fs.promises.rm(item.file, { force: true }).catch(() => {});
        await fs.promises.rm(item.file.replace(/\.json$/, '.tile'), { force: true }).catch(() => {});
        total -= item.bytes;
        files -= 1;
      }
      diskBytes = total;
      diskFiles = files;
      log(`EFB_TILE_CACHE_EVICT bytes=${total} files=${files}`);
    })().catch((error) => diskError('evict', error)).finally(() => { evicting = null; });
    return evicting;
  }

  function touch(key, value) {
    const previous = cache.get(key);
    if (previous) cacheBytes -= previous.body.length;
    cache.delete(key);
    cache.set(key, value);
    cacheBytes += value.body.length;
    while (cache.size > maxEntries || cacheBytes > maxCacheBytes) {
      const oldestKey = cache.keys().next().value;
      const oldest = cache.get(oldestKey);
      cache.delete(oldestKey);
      cacheBytes -= oldest?.body?.length || 0;
    }
  }

  async function fetchTile(tile, previous) {
    const source = TILE_SOURCES[tile.layer];
    let lastError = null;
    const local = source.desktopRender ? renderEndpoint : null;
    if (source.desktopRender && !local) throw new Error('desktop_renderer_unavailable');
    const templates = local
      ? [`http://127.0.0.1:${local.port}/vector-tile/${source.desktopRender}/{z}/{x}/{y}.png`]
      : source.urls;
    for (const template of templates) {
      const upstreamUrl = tileUrl(template, tile) + (local && tile.variant ? `?s=${tile.variant}` : '');
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), local ? renderTimeoutMs : timeoutMs) : null;
      try {
        const headers = {
          Accept: 'image/avif,image/webp,image/apng,image/png,image/*,*/*;q=0.8',
          'User-Agent': TILE_USER_AGENT
        };
        if (local) headers['X-GA-Render-Token'] = local.token;
        // Expired disk copy: ask the server whether it is still current.
        if (previous && previous.meta.etag) headers['If-None-Match'] = previous.meta.etag;
        if (previous && previous.meta.lastModified) headers['If-Modified-Since'] = previous.meta.lastModified;
        const response = await fetchRemote(upstreamUrl, {
          headers,
          redirect: 'follow',
          signal: controller?.signal
        });
        const header = (name) => String(response?.headers?.get?.(name) || '');
        const headerInfo = { cacheControl: header('cache-control'), etag: header('etag'), lastModified: header('last-modified') };
        if (previous && Number(response?.status) === 304) {
          return { body: previous.body, contentType: previous.contentType, upstreamUrl, headerInfo, notModified: true };
        }
        if (!response || response.ok !== true) throw new Error(`upstream_http_${Number(response?.status) || 0}`);
        const contentType = String(response.headers?.get?.('content-type') || 'image/png').split(';')[0].trim().toLowerCase();
        if (!contentType.startsWith('image/')) throw new Error(`upstream_content_type_${contentType || 'missing'}`);
        const body = Buffer.from(await response.arrayBuffer());
        if (!body.length || body.length > MAX_TILE_BYTES) throw new Error(`upstream_tile_size_${body.length}`);
        const result = { body, contentType, upstreamUrl, headerInfo };
        if (!readyLayers.has(tile.layer)) {
          readyLayers.add(tile.layer);
          log(`EFB_TILE_PROXY_READY layer=${tile.layer} bytes=${body.length}`);
        }
        return result;
      } catch (error) {
        lastError = error;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    const now = Date.now();
    if (now - Number(lastErrorAt.get(tile.layer) || 0) >= 60000) {
      lastErrorAt.set(tile.layer, now);
      log(`EFB_TILE_PROXY_ERROR layer=${tile.layer} z=${tile.z} x=${tile.x} y=${tile.y} error=${sanitize(lastError?.message || lastError)}`);
    }
    throw lastError || new Error('tile_upstream_unavailable');
  }

  async function get(tile) {
    const key = `${tile.layer}${tile.variant ? '~' + tile.variant : ''}/${tile.z}/${tile.x}/${tile.y}`;
    const cached = cache.get(key);
    if (cached) {
      touch(key, cached);
      return { ...cached, cache: 'hit' };
    }
    if (inflight.has(key)) return inflight.get(key);
    const pending = (async () => {
      const disk = await readDisk(tile);
      if (disk && Number(disk.meta.expiresAt) > now()) {
        diskStats.hits += 1;
        const hit = { body: disk.body, contentType: disk.contentType };
        touch(key, hit);
        return { ...hit, cache: 'disk' };
      }
      let result;
      try {
        result = await fetchTile(tile, disk);
      } catch (error) {
        // Offline or upstream down: an old copy is better than no map.
        if (!disk) throw error;
        diskStats.stale += 1;
        const stale = { body: disk.body, contentType: disk.contentType };
        touch(key, stale);
        return { ...stale, cache: 'stale' };
      }
      const fresh = { body: result.body, contentType: result.contentType, upstreamUrl: result.upstreamUrl };
      if (isNoStore(result.headerInfo && result.headerInfo.cacheControl)) return { ...fresh, cache: 'no-store' };
      touch(key, fresh);
      if (result.notModified) {
        diskStats.revalidated += 1;
        void touchDisk(tile, disk, result.headerInfo);
        return { ...fresh, cache: 'revalidated' };
      }
      void writeDisk(tile, fresh, result.headerInfo, disk);
      return { ...fresh, cache: 'miss' };
    })().finally(() => inflight.delete(key));
    inflight.set(key, pending);
    return pending;
  }

  async function stats() {
    await scanned;
    return { enabled: !!diskDir, directory: diskDir, bytes: diskBytes, files: diskFiles, maxBytes: maxDiskBytes,
      memoryEntries: cache.size, memoryBytes: cacheBytes, ...diskStats };
  }

  // Removes every cached tile (disk and memory). Running fetches finish but do
  // not write into the emptied cache.
  async function clear() {
    await scanned;
    if (evicting) await evicting;
    diskGeneration += 1;
    const removedBytes = diskBytes;
    const removedFiles = diskFiles;
    cache.clear();
    cacheBytes = 0;
    if (diskDir) await fs.promises.rm(diskDir, { recursive: true, force: true });
    diskBytes = 0;
    diskFiles = 0;
    log(`EFB_TILE_CACHE_CLEARED bytes=${removedBytes} files=${removedFiles}`);
    return { ok: true, removedBytes, removedFiles };
  }

  return {
    get,
    stats,
    clear,
    // EFB menu: the desktop vector map is offered only with a renderer.
    desktopRenderAvailable: () => !!renderEndpoint,
    setDesktopRenderActive,
    ready: () => scanned,
    get cacheSize() { return cache.size; },
    get cacheBytes() { return cacheBytes; },
    get diskBytes() { return diskBytes; }
  };
}

module.exports = {
  TILE_USER_AGENT,
  DEFAULT_DISK_CACHE_BYTES,
  DISK_CACHE_MAX_TTL_MS,
  DISK_CACHE_MIN_TTL_MS,
  DEFAULT_TILE_CACHE_BYTES,
  DEFAULT_TILE_CACHE_ENTRIES,
  MAX_TILE_BYTES,
  TILE_SOURCES,
  cacheTtlMs,
  createTrackerEfbTileProxy,
  desktopRenderEndpoint,
  defaultTileCacheDirectory,
  parseTrackerEfbTilePath,
  tileUrl
};
