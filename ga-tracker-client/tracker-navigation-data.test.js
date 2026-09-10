'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const { PNG } = require('pngjs');
const { createNavigationCache } = require('./tracker-navigation-cache');
const { createNavigationData, terrainPixel } = require('./tracker-navigation-data');
const { gzipSync } = require('node:zlib');
async function folder(t) { const value = await fs.mkdtemp(path.join(os.tmpdir(), 'ga-nav-cache-')); t.after(() => fs.rm(value, { recursive: true, force: true })); return value; }
test('cache deduplicates concurrent downloads, survives restart and uses valid stale data offline', async t => {
  const directory = await folder(t); let calls = 0, clock = Date.now(), offline = false;
  const fetchRemote = async () => { calls++; if (offline) throw new Error('offline'); return new Response('{"ok":true}'); };
  const options = { directory, fetchRemote, now: () => clock };
  const cache = createNavigationCache(options), read = c => c.get('https://example.test/catalog', { ttlMs: 1000, validate: b => JSON.parse(b) });
  await Promise.all([read(cache), read(cache), read(cache)]); assert.equal(calls, 1);
  assert.equal((await read(createNavigationCache(options))).toString(), '{"ok":true}'); assert.equal(calls, 1);
  clock += 2000; offline = true;
  assert.equal((await read(cache)).toString(), '{"ok":true}'); assert.equal(cache.snapshot().stale, 1);
  await read(cache); assert.equal(calls, 2, 'failed source has a cooldown');
});
test('bounded downloads and disk eviction; invalid responses never replace a valid tile', async t => {
  const directory = await folder(t); let running = 0, peak = 0, invalid = false;
  const cache = createNavigationCache({ directory, maxBytes: 30, concurrency: 2, fetchRemote: async () => {
    running++; peak = Math.max(peak, running); await new Promise(r => setTimeout(r, 10)); running--;
    return new Response(invalid ? 'not-json' : '{"value":123}');
  } });
  const read = key => cache.get('https://example.test/' + key, { ttlMs: -1, validate: b => JSON.parse(b) });
  await Promise.all(['a','b','c','d','e'].map(read)); await cache.trim();
  assert.equal(peak, 2); assert.ok(cache.snapshot().bytes <= 30);
  const before = await read('last'); invalid = true;
  assert.deepEqual(await read('last'), before); assert.ok(cache.snapshot().stale > 0);
  assert.ok(!(await fs.readdir(directory)).some(f => f.endsWith('.tmp')));
});
test('tracker decodes the same Terrarium RGB feet and reuses terrain/obstacle files without network', async t => {
  const directory = await folder(t), png = new PNG({ width: 256, height: 256 });
  for (let i = 0; i < png.data.length; i += 4) { png.data[i] = 128; png.data[i + 1] = 100; png.data[i + 2] = 128; png.data[i + 3] = 255; }
  const image = PNG.sync.write(png), obstacle = { obs: [{ lat: 48, lon: 8, type: 'tower', hFt: 200 }], lin: [{ type: 'powerline', points: [[8,48],[8.01,48.01]] }] };
  let calls = 0;
  const fetchRemote = async url => { calls++; return new Response(url.endsWith('.png') ? image : gzipSync(JSON.stringify({ v: 1, core: obstacle }))); };
  const data = createNavigationData({ directory, fetchRemote }), point = { lat: 48, lon: 8 };
  assert.equal(await data.terrain(point), Math.round(100.5 * 3.28084));
  assert.deepEqual((await data.obstacles([point, point])).obs, obstacle.obs); assert.equal(calls, 2);
  assert.deepEqual((await data.obstacles([point])).lin, obstacle.lin);
  const restored = createNavigationData({ directory, fetchRemote: async () => { throw new Error('must use disk'); } });
  assert.equal(await restored.terrain(point), Math.round(100.5 * 3.28084));
  assert.deepEqual((await restored.obstacles([point])).obs, obstacle.obs);
  assert.deepEqual((await restored.obstacles([point])).lin, obstacle.lin);
  assert.ok(terrainPixel(90, 180).y >= 0);
});
test('missing obstacle tiles are incomplete, missing terrain never becomes zero elevation', async t => {
  const data = createNavigationData({ directory: await folder(t), fetchRemote: async () => new Response('missing', { status: 404 }) });
  assert.equal((await data.obstacles([{ lat: 48, lon: 8 }])).complete, false);
  await assert.rejects(data.terrain({ lat: 48, lon: 8 }), /404/);
});

test('concurrent cache consumers keep their own validator and size limit', async t => {
  let release, entered;
  const started=new Promise(resolve=>entered=resolve);
  const cache=createNavigationCache({directory:await folder(t),fetchRemote:async()=>{
    entered();await new Promise(resolve=>release=resolve);return new Response('{"wrongSchema":true}');
  }});
  const first=cache.get('https://example.test/shared',{validate:b=>JSON.parse(b)});
  await started;
  const invalid=assert.rejects(cache.get('https://example.test/shared',{validate:b=>{if(!Array.isArray(JSON.parse(b).airports))throw Error('invalid_airports');}}),/invalid_airports/);
  const large=assert.rejects(cache.get('https://example.test/shared',{limit:4}),/too_large/);
  release();await Promise.all([first,invalid,large]);
  assert.equal(cache.snapshot().downloads,1);
});
