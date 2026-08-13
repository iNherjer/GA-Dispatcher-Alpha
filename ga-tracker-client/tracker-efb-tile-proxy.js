'use strict';

const MAX_TILE_BYTES = 2 * 1024 * 1024;
const DEFAULT_TILE_CACHE_ENTRIES = 192;
const DEFAULT_TILE_CACHE_BYTES = 32 * 1024 * 1024;
const DEFAULT_TILE_TIMEOUT_MS = 9000;

const TILE_SOURCES = Object.freeze({
  topo: Object.freeze({
    urls: Object.freeze([
      'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      'https://backup.opentopomap.org/{z}/{x}/{y}.png'
    ])
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
  })
});

function sanitize(value, limit = 180) {
  return String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').slice(0, limit);
}

function parseTrackerEfbTilePath(pathname = '') {
  const match = String(pathname || '').match(/^\/api\/v1\/map-tile\/([a-z][a-z0-9-]*)\/(\d{1,2})\/(\d{1,8})\/(\d{1,8})\.png$/);
  if (!match || !Object.hasOwn(TILE_SOURCES, match[1])) return null;
  const z = Number(match[2]);
  const x = Number(match[3]);
  const y = Number(match[4]);
  const limit = 2 ** z;
  if (!Number.isSafeInteger(z) || z < 0 || z > 20
    || !Number.isSafeInteger(x) || x < 0 || x >= limit
    || !Number.isSafeInteger(y) || y < 0 || y >= limit) return null;
  return { layer: match[1], z, x, y };
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

  async function fetchTile(tile) {
    const source = TILE_SOURCES[tile.layer];
    let lastError = null;
    for (const template of source.urls) {
      const upstreamUrl = tileUrl(template, tile);
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        const response = await fetchRemote(upstreamUrl, {
          headers: {
            Accept: 'image/avif,image/webp,image/apng,image/png,image/*,*/*;q=0.8',
            'User-Agent': 'VFR-Multitool-Tracker-EFB/1.0'
          },
          redirect: 'follow',
          signal: controller?.signal
        });
        if (!response || response.ok !== true) throw new Error(`upstream_http_${Number(response?.status) || 0}`);
        const contentType = String(response.headers?.get?.('content-type') || 'image/png').split(';')[0].trim().toLowerCase();
        if (!contentType.startsWith('image/')) throw new Error(`upstream_content_type_${contentType || 'missing'}`);
        const body = Buffer.from(await response.arrayBuffer());
        if (!body.length || body.length > MAX_TILE_BYTES) throw new Error(`upstream_tile_size_${body.length}`);
        const result = { body, contentType, upstreamUrl };
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
    const key = `${tile.layer}/${tile.z}/${tile.x}/${tile.y}`;
    const cached = cache.get(key);
    if (cached) {
      touch(key, cached);
      return { ...cached, cache: 'hit' };
    }
    if (inflight.has(key)) return inflight.get(key);
    const pending = fetchTile(tile).then((result) => {
      touch(key, result);
      return { ...result, cache: 'miss' };
    }).finally(() => inflight.delete(key));
    inflight.set(key, pending);
    return pending;
  }

  return {
    get,
    get cacheSize() { return cache.size; },
    get cacheBytes() { return cacheBytes; }
  };
}

module.exports = {
  DEFAULT_TILE_CACHE_BYTES,
  DEFAULT_TILE_CACHE_ENTRIES,
  MAX_TILE_BYTES,
  TILE_SOURCES,
  createTrackerEfbTileProxy,
  parseTrackerEfbTilePath,
  tileUrl
};
