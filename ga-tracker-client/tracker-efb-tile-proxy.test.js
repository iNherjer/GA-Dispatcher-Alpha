'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createTrackerEfbTileProxy,
  parseTrackerEfbTilePath,
  tileUrl
} = require('./tracker-efb-tile-proxy');

test('tile path parser only accepts allowlisted layers and valid slippy-map coordinates', () => {
  assert.deepEqual(parseTrackerEfbTilePath('/api/v1/map-tile/topo/8/133/88.png'), {
    layer: 'topo', z: 8, x: 133, y: 88
  });
  assert.equal(parseTrackerEfbTilePath('/api/v1/map-tile/unknown/8/133/88.png'), null);
  assert.equal(parseTrackerEfbTilePath('/api/v1/map-tile/topo/8/999/88.png'), null);
  assert.equal(parseTrackerEfbTilePath('/api/v1/map-tile/topo/21/1/1.png'), null);
  assert.equal(tileUrl('https://{s}.example/{z}/{x}/{y}{r}.png', { z: 3, x: 4, y: 5 }),
    'https://a.example/3/4/5.png');
});

test('tile proxy enforces its byte-bounded LRU cache', async () => {
  let fetchCount = 0;
  const body = Buffer.alloc(1536 * 1024, 1);
  const proxy = createTrackerEfbTileProxy({
    maxEntries: 16,
    maxCacheBytes: 4 * 1024 * 1024,
    fetchRemote: async () => {
      fetchCount += 1;
      return {
        ok: true,
        headers: { get: () => 'image/png' },
        arrayBuffer: async () => body
      };
    }
  });
  await proxy.get({ layer: 'topo', z: 3, x: 1, y: 1 });
  await proxy.get({ layer: 'topo', z: 3, x: 2, y: 1 });
  await proxy.get({ layer: 'topo', z: 3, x: 3, y: 1 });
  assert.ok(proxy.cacheBytes <= 4 * 1024 * 1024);
  assert.equal(proxy.cacheSize, 2);
  await proxy.get({ layer: 'topo', z: 3, x: 1, y: 1 });
  assert.equal(fetchCount, 4);
});

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { cacheTtlMs, defaultTileCacheDirectory, DISK_CACHE_MIN_TTL_MS, DISK_CACHE_MAX_TTL_MS } = require('./tracker-efb-tile-proxy');

function upstream(responses) {
  const calls = [];
  return {
    calls,
    fetchRemote: async (url, init) => {
      calls.push({ url, headers: { ...(init && init.headers) } });
      const next = responses.length > 1 ? responses.shift() : responses[0];
      if (next instanceof Error) throw next;
      const headers = { 'content-type': 'image/png', ...(next.headers || {}) };
      return {
        ok: next.status === 200,
        status: next.status,
        headers: { get: (name) => headers[String(name).toLowerCase()] || null },
        arrayBuffer: async () => next.body || Buffer.alloc(0)
      };
    }
  };
}

function tempDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'ga-tile-cache-')); }

test('disk cache lives in LocalAppData and keeps tiles between 7 and 30 days', () => {
  assert.equal(defaultTileCacheDirectory({ LOCALAPPDATA: 'C:\\Users\\x\\AppData\\Local' }),
    path.join('C:\\Users\\x\\AppData\\Local', 'VFR Multitool', 'Map Tile Cache'));
  assert.equal(cacheTtlMs('public, max-age=60'), DISK_CACHE_MIN_TTL_MS);
  assert.equal(cacheTtlMs('max-age=31536000'), DISK_CACHE_MAX_TTL_MS);
  assert.equal(cacheTtlMs('max-age=864000'), 864000 * 1000);
  assert.equal(cacheTtlMs(''), DISK_CACHE_MIN_TTL_MS);
});

test('disk cache serves a fresh tile from disk after a restart without asking upstream', async () => {
  const dir = tempDir();
  const tile = { layer: 'topo', z: 9, x: 268, y: 174 };
  const first = upstream([{ status: 200, body: Buffer.from('tile-one'), headers: { etag: '"a1"', 'cache-control': 'max-age=604800' } }]);
  const proxy = createTrackerEfbTileProxy({ cacheDir: dir, fetchRemote: first.fetchRemote });
  assert.equal((await proxy.get(tile)).cache, 'miss');
  await new Promise((resolve) => setTimeout(resolve, 50));
  const second = upstream([new Error('must not be called')]);
  const restarted = createTrackerEfbTileProxy({ cacheDir: dir, fetchRemote: second.fetchRemote });
  const hit = await restarted.get(tile);
  assert.equal(hit.cache, 'disk');
  assert.equal(hit.body.toString(), 'tile-one');
  assert.equal(second.calls.length, 0);
  const stats = await restarted.stats();
  assert.equal(stats.files, 1);
  assert.equal(stats.bytes, 8);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('expired disk tiles are revalidated with etag and served stale when upstream fails', async () => {
  const dir = tempDir();
  const tile = { layer: 'topo', z: 9, x: 268, y: 175 };
  let clock = 1000;
  const first = upstream([{ status: 200, body: Buffer.from('old'), headers: { etag: '"v1"', 'last-modified': 'Mon, 01 Nov 2026 00:00:00 GMT' } }]);
  await createTrackerEfbTileProxy({ cacheDir: dir, now: () => clock, fetchRemote: first.fetchRemote }).get(tile);
  await new Promise((resolve) => setTimeout(resolve, 50));
  clock += DISK_CACHE_MIN_TTL_MS + 1;
  const revalidate = upstream([{ status: 304 }]);
  const proxy = createTrackerEfbTileProxy({ cacheDir: dir, now: () => clock, fetchRemote: revalidate.fetchRemote });
  const result = await proxy.get(tile);
  assert.equal(result.cache, 'revalidated');
  assert.equal(result.body.toString(), 'old');
  assert.equal(revalidate.calls[0].headers['If-None-Match'], '"v1"');
  assert.equal(revalidate.calls[0].headers['If-Modified-Since'], 'Mon, 01 Nov 2026 00:00:00 GMT');
  await new Promise((resolve) => setTimeout(resolve, 50));
  clock += DISK_CACHE_MIN_TTL_MS + 1;
  const offline = upstream([new Error('offline')]);
  const stale = await createTrackerEfbTileProxy({ cacheDir: dir, now: () => clock, fetchRemote: offline.fetchRemote }).get(tile);
  assert.equal(stale.cache, 'stale');
  assert.equal(stale.body.toString(), 'old');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('disk cache evicts the oldest tiles above its limit and clear removes everything', async () => {
  const dir = tempDir();
  let clock = 0;
  // Tiles above 2 MiB are rejected; 1.5 MiB tiles fill the 16 MiB limit quickly.
  const small = Buffer.alloc(1536 * 1024, 3);
  const filler = upstream([{ status: 200, body: small }]);
  const limited = createTrackerEfbTileProxy({ cacheDir: dir, maxDiskBytes: 16 * 1024 * 1024, now: () => ++clock, fetchRemote: filler.fetchRemote, maxEntries: 16 });
  for (let x = 0; x < 14; x += 1) {
    await limited.get({ layer: 'terrain', z: 5, x, y: 1 });
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  await new Promise((resolve) => setTimeout(resolve, 150));
  const stats = await limited.stats();
  assert.ok(stats.bytes <= 16 * 1024 * 1024, 'cache stays within its limit');
  assert.ok(stats.files < 14, 'oldest tiles were evicted');
  assert.equal(fs.existsSync(path.join(dir, 'terrain', '5', '13', '1.tile')), true, 'newest tile kept');
  assert.equal(fs.existsSync(path.join(dir, 'terrain', '5', '0', '1.tile')), false, 'oldest tile evicted');
  const cleared = await limited.clear();
  assert.equal(cleared.ok, true);
  assert.ok(cleared.removedBytes > 0);
  assert.equal(fs.existsSync(dir), false);
  assert.equal((await limited.stats()).bytes, 0);
  assert.equal(limited.cacheSize, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});
