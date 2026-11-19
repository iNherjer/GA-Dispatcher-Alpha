'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { clearMapTileCache, formatCacheSize, mapTileCacheDirectory, mapTileCacheStats } = require('../lib/map-tile-cache');

function seed(dir) {
  for (const [name, size] of [['topo/9/268/174', 1000], ['terrain/5/1/2', 3000]]) {
    const file = path.join(dir, name + '.tile');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.alloc(size));
    fs.writeFileSync(file.replace(/\.tile$/, '.json'), '{"bytes":' + size + '}');
  }
}

test('map tile cache sits next to the runtimes and counts only tile images', async () => {
  assert.equal(mapTileCacheDirectory('C:\\Local\\VFR Multitool'), path.join('C:\\Local\\VFR Multitool', 'Map Tile Cache'));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-tile-cache-'));
  const dir = mapTileCacheDirectory(root);
  assert.deepEqual(await mapTileCacheStats(dir), { directory: dir, bytes: 0, files: 0 });
  seed(dir);
  const stats = await mapTileCacheStats(dir);
  assert.equal(stats.files, 2);
  assert.equal(stats.bytes, 4000);
  assert.equal(formatCacheSize(4000), '4 KB');
  assert.equal(formatCacheSize(3 * 1024 * 1024 * 1024 / 2), '1,5 GB');
  fs.rmSync(root, { recursive: true, force: true });
});

test('clearing uses a running tracker first and falls back to removing the folder', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-tile-cache-'));
  const dir = mapTileCacheDirectory(root);
  seed(dir);
  let calls = 0;
  const running = { child: {}, clearMapTileCache: async () => { calls += 1; fs.rmSync(dir, { recursive: true, force: true }); return { ok: true }; } };
  const viaTracker = await clearMapTileCache({ directory: dir, trackerProcess: running });
  assert.deepEqual([viaTracker.ok, viaTracker.via, viaTracker.removedFiles, viaTracker.removedBytes, calls], [true, 'tracker', 2, 4000, 1]);
  seed(dir);
  const oldTracker = { child: {}, clearMapTileCache: async () => ({ ok: false, error: 'tracker_http_404' }) };
  const fallback = await clearMapTileCache({ directory: dir, trackerProcess: oldTracker });
  assert.deepEqual([fallback.ok, fallback.via, fallback.removedFiles], [true, 'disk', 2]);
  assert.equal(fs.existsSync(dir), false);
  seed(dir);
  const stopped = await clearMapTileCache({ directory: dir, trackerProcess: { child: null, clearMapTileCache: async () => { throw new Error('not called'); } } });
  assert.deepEqual([stopped.ok, stopped.via], [true, 'disk']);
  fs.rmSync(root, { recursive: true, force: true });
});
