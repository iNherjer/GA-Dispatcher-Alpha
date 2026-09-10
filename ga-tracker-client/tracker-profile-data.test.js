'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { gzipSync } = require('node:zlib');
const { createProfileData, resourceUrl, profilePoints } = require('./tracker-profile-data');
const point = { lat: 48.4, lon: 7.8, distNM: 0 };

test('profile transport uses the original public datasets and canonical cache URLs', () => {
  const metar = 'https://aviationweather.gov/api/data/metar?format=json&t=123&bbox=48,7,49,8';
  assert.equal(resourceUrl('https://ga-proxy.einherjer.workers.dev/api/metar?src=' + encodeURIComponent(metar)).url,
    resourceUrl(metar.replace('t=123', 't=999')).url);
  assert.match(resourceUrl('./obstacles/core-tiles/331/450.json.gz').url, /inherjer.github.io/);
  assert.equal(resourceUrl('https://api.open-meteo.com/v1/elevation?latitude=48&longitude=7').ttlMs, 15552000000);
  for (const url of ['file:///tmp/test', 'http://127.0.0.1:1234/', 'https://example.com/', 'https://inherjer.github.io/secret.json', 'https://user:pass@aviationweather.gov/api/data/metar']) {
    assert.throws(() => resourceUrl(url), /invalid_profile/);
  }
  const query = '[out:json][timeout:45][bbox:48,7,48.4,7.4];(node["generator:source"="wind"];);out geom qt;';
  assert.equal(new URL(resourceUrl('https://overpass-api.de/api/interpreter', 'data=' + encodeURIComponent(query)).url).searchParams.get('data'), query);
  assert.throws(() => profilePoints(Array(2049).fill(point)), /invalid_profile_points/);
  assert.throws(() => profilePoints([{ ...point, lat: NaN }]), /invalid_profile_points/);
});

test('hosted gzip is decoded exactly once before crossing the local JSON boundary', async () => {
  const expected = { obs: [{ lat: 48.4, lon: 7.8, hFt: 300 }], lin: [] };
  const profile = createProfileData({ cache: { get: async (_url, options) => {
    const bytes = gzipSync(JSON.stringify(expected)); options.validate(bytes); return bytes;
  } } });
  assert.deepEqual(await profile.resource('./obstacles/core-tiles/331/450.json.gz'), expected);
});

test('terrain batches preserve sample order and reserve network capacity even on failures', async () => {
  let active = 0, maximum = 0, calls = 0;
  const releases = [];
  const profile = createProfileData({ terrain: p => {
    active++; calls++; maximum = Math.max(maximum, active);
    return new Promise((resolve, reject) => releases.push(() => {
      active--; if (p.distNM === 0) reject(new Error('tile failed')); else resolve(500 + p.distNM);
    }));
  } });
  const first = profile.terrain([point, { ...point, distNM: 1 }]);
  const second = profile.terrain([{ ...point, distNM: 2 }]);
  const firstCheck = assert.rejects(first, /tile failed/);
  await new Promise(setImmediate); releases.shift()(); await new Promise(setImmediate);
  assert.equal(calls, 2, 'second batch must wait for the other worker to drain');
  releases.shift()(); await firstCheck; await new Promise(setImmediate);
  releases.shift()(); assert.deepEqual(await second, [{ ...point, distNM: 2, elevFt: 502 }]);
  assert.equal(maximum, 2);
});

test('cancelled queued work does not sample terrain; missing heights never become sea level', async () => {
  let calls = 0;
  const profile = createProfileData({ terrain: async () => { calls++; return undefined; } });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(profile.terrain([point], { signal: controller.signal }), /aborted/);
  assert.equal(calls, 0);
  await assert.rejects(profile.terrain([point]), /terrain_unavailable/);
});

test('Terrain Avoid shares validated Terrarium tiles with height samples and the persistent cache', async t => {
  const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
  const { PNG } = require('pngjs');
  const { createNavigationData, terrainPixel } = require('./tracker-navigation-data');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ga-terrain-overlay-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const png = new PNG({ width: 256, height: 256 });
  for (let i = 0; i < png.data.length; i += 4) png.data.set([128, 100, 0, 255], i);
  const bytes = PNG.sync.write(png); let calls = 0;
  const data = createNavigationData({ directory, fetchRemote: async () => { calls++; return new Response(bytes); } });
  const profile = createProfileData(data), coords = terrainPixel(point.lat, point.lon);
  const [tile, height] = await Promise.all([profile.terrainTile(coords.zoom, coords.x, coords.y), data.terrain(point)]);
  assert.deepEqual(tile, bytes);
  assert.equal(height, 328);
  assert.equal(calls, 1, 'renderer and warning/profile samples must share a cache key');
  const restored = createProfileData(createNavigationData({ directory, fetchRemote: async () => { throw Error('offline'); } }));
  assert.deepEqual(await restored.terrainTile(coords.zoom, coords.x, coords.y), bytes);
  for (const xyz of [[14, 0, 0], [2, 4, 0], [2, 0, -1], [1.5, 0, 0]]) await assert.rejects(profile.terrainTile(...xyz), /invalid_terrain_tile_coordinates/);
  assert.equal(calls, 1);
  const invalid = createProfileData({ cache: {get: async (_url, options) => options.validate(Buffer.from('not a tile'))} });
  await assert.rejects(invalid.terrainTile(0, 0, 0), /invalid_terrain_tile/);
});

test('sidebar and radar transport accept only fixed read-only public endpoints', () => {
  assert.equal(resourceUrl('https://api.rainviewer.com/public/weather-maps.json').ttlMs, 300000);
  const airport = resourceUrl('https://ga-proxy.einherjer.workers.dev/api/airports?search=EDTL&limit=25&t=1');
  assert.equal(airport.ttlMs, 3600000);
  assert.equal(airport.url, resourceUrl('https://ga-proxy.einherjer.workers.dev/api/airports?limit=25&search=EDTL&t=9').url);
  assert.equal(resourceUrl('https://ga-proxy.einherjer.workers.dev/api/navaids?bbox=7,48,8,49').ttlMs, 3600000);
  for (const url of ['https://api.rainviewer.com/private', 'https://ga-proxy.einherjer.workers.dev/api/admin', 'https://other.example/api/airports']) assert.throws(() => resourceUrl(url), /invalid_profile_resource/);
});

test('airport details use the shared cached aviation source with bounded coordinates',async()=>{
  const requests=[],expected=[{airports:[{icaoCode:'EDTL',runways:[{designator:'03'}]}]}];
  const profile=createProfileData({aviation:{getAirportSnapshots:async request=>{requests.push(request);return expected;}}});
  assert.deepEqual(await profile.airports([{lat:48,lon:7,distNM:0},{lat:49,lon:8,distNM:0}]),expected);
  assert.deepEqual(requests[0].bounds,{west:7,south:48,east:8,north:49});
  await assert.rejects(profile.airports([{lat:48,lon:7,distNM:0},{lat:52,lon:8,distNM:0}]),/invalid_profile/);
  await assert.rejects(profile.airports([{lat:48,lon:7,distNM:0}]),/invalid_profile/);assert.equal(requests.length,1);
});

test('popup aviation transport preserves raw geometry and quantities and bounds its request', async()=>{
  const expected={airspaces:[{geometry:{type:'Polygon',coordinates:[[[7,48],[8,48],[8,49],[7,48]]]},lowerLimit:{value:0,unit:1,referenceDatum:0}}],airports:[{elevation:{value:500,unit:1}}],navaids:[],reportingPoints:[]};
  const calls=[],profile=createProfileData({aviation:{getPopupSnapshot:async request=>{calls.push(request);return expected;}}});
  const bounds=[{lat:48,lon:7,distNM:0},{lat:49,lon:8,distNM:0}];
  assert.deepEqual(await profile.aviation(bounds),expected);
  assert.deepEqual(calls[0].bounds,{west:7,south:48,east:8,north:49});
  for(const points of [[bounds[0]],bounds.slice().reverse(),[bounds[0],{lat:51,lon:8,distNM:0}]])await assert.rejects(profile.aviation(points),/invalid_profile/);
  assert.equal(calls.length,1);
});
