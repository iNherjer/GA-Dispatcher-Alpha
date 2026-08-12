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
