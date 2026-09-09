'use strict';
const { PNG } = require('pngjs');
const { promisify } = require('node:util');
const gunzip = promisify(require('node:zlib').gunzip);
const { createNavigationCache } = require('./tracker-navigation-cache');
const { createTrackerEfbMapContextProvider } = require('./tracker-efb-map-context');
const { predictionBounds } = require('../navigation-warning-core');
const TERRAIN_BASE = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/';
const OBSTACLE_BASE = 'https://inherjer.github.io/GA-Dispatcher-Alpha/obstacles/core-tiles/';
const DAY = 86400000;
function terrainPixel(lat, lon, zoom = 10) {
  const n = 2 ** zoom, radians = Math.max(-85.051128, Math.min(85.051128, lat)) * Math.PI / 180;
  const x = (((lon + 180) % 360 + 360) % 360) / 360 * n;
  const y = Math.min(n - 1e-9, Math.max(0, (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2 * n));
  return { x: Math.floor(x), y: Math.floor(y), px: Math.floor((x % 1) * 256), py: Math.floor((y % 1) * 256), zoom };
}
function validatePng(bytes) {
  if (bytes.length < 33 || bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a'
      || bytes.readUInt32BE(16) !== 256 || bytes.readUInt32BE(20) !== 256) throw new Error('invalid_terrain_tile');
}
async function obstacleJson(bytes) {
  const decoded = bytes[0] === 31 && bytes[1] === 139 ? await gunzip(bytes, { maxOutputLength: 16 * 1024 ** 2 }) : bytes;
  const value = JSON.parse(decoded.toString('utf8'));
  if (!Array.isArray(value.obs || value.core?.obs || value.features?.obs)) throw new Error('invalid_obstacle_tile');
  const core = value.core || value.features || value;
  if (core.lin != null && !Array.isArray(core.lin)) throw new Error('invalid_obstacle_lines');
  return core;
}
function createNavigationData(options) {
  const cache = createNavigationCache(options), images = new Map(), obstacleTiles = new Map();
  const jsonFetch = async url => {
    const mutable = /latest\.json$|\/v1\/|\/api\//.test(url);
    const ttlMs = url.includes('/v1/forecast') ? 300000 : url.includes('/v1/elevation') ? 180 * DAY : mutable ? 3600000 : 180 * DAY;
    const bytes = await cache.get(url, { ttlMs,
      validate: bytes => { JSON.parse(bytes.toString('utf8')); } });
    return new Response(bytes, { headers: { 'Content-Type': 'application/json' } });
  };
  const aviation = createTrackerEfbMapContextProvider({ fetchRemote: jsonFetch });
  async function image(tile) {
    const key = `${tile.zoom}/${tile.x}/${tile.y}`;
    if (images.has(key)) return images.get(key);
    let decoded;
    const decode = bytes => new Promise((resolve, reject) => new PNG({ checkCRC: true }).parse(bytes, (error, result) => error ? reject(error) : resolve(result.data)));
    const pending = cache.get(TERRAIN_BASE + key + '.png', { ttlMs: 180 * DAY, limit: 1024 * 1024, validate: async bytes => { validatePng(bytes); decoded = await decode(bytes); } })
      .then(() => decoded)
      .catch(async error => { images.delete(key); await cache.invalidate(TERRAIN_BASE + key + '.png'); throw error; });
    images.set(key, pending);
    while (images.size > 64) images.delete(images.keys().next().value);
    return pending;
  }
  async function terrain(point) {
    const tile = terrainPixel(point.lat, point.lon), rgba = await image(tile), i = (tile.py * 256 + tile.px) * 4;
    return Math.round((rgba[i] * 256 + rgba[i + 1] + rgba[i + 2] / 256 - 32768) * 3.28084);
  }
  async function obstacles(points) {
    const keys = new Set();
    for (const point of points) {
      const latI = Math.floor((point.lat + 90) / (25 / 60)), lonI = Math.floor((point.lon + 180) / (25 / 60));
      keys.add(`${latI}/${lonI}`);
    }
    const results = await Promise.allSettled([...keys].slice(0, 36).map(key => {
      const old = obstacleTiles.get(key);
      if (old && Date.now() - old.at < DAY) return old.value;
      const value = cache.get(OBSTACLE_BASE + key + '.json.gz', { ttlMs: 14 * DAY, validate: obstacleJson })
        .then(obstacleJson).catch(error => { obstacleTiles.delete(key); throw error; });
      obstacleTiles.set(key, { at: Date.now(), value });
      while (obstacleTiles.size > 48) obstacleTiles.delete(obstacleTiles.keys().next().value);
      return value;
    }));
    return { obs: results.flatMap(r => r.status === 'fulfilled' ? r.value.obs : []),
      lin: results.flatMap(r => r.status === 'fulfilled' ? r.value.lin || [] : []),
      complete: keys.size <= 36 && results.every(r => r.status === 'fulfilled'), tiles: results.length };
  }
  return { cache, aviation, terrain, obstacles, async airspaces(points) {
    const bounds = predictionBounds(points);
    return aviation.getAirspaces({ lat: points[0].lat, lon: points[0].lon, radiusNm: 12, bounds });
  } };
}
module.exports = { createNavigationData, terrainPixel, validatePng, obstacleJson };
