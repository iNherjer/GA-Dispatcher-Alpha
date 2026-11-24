'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { gzipSync } = require('node:zlib');
const { createProfileData, resourceUrl, profilePoints } = require('./tracker-profile-data');
const { createTrackerDwdWeather } = require('./tracker-dwd-weather');
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

test('satellite bridge extracts the advertised frame and restricts raster requests to the known products', async () => {
  const time = '2026-11-23T15:30:00Z';
  const calls = [];
  const profile = createProfileData({ cache: { async get(input, options) {
    const url = new URL(input);
    calls.push(url);
    if (url.searchParams.get('request') === 'GetCapabilities') {
      const xml = Buffer.from('<Layer><Name>clm</Name><Dimension name="time" units="ISO8601" default="' + time + '"/></Layer>');
      options.validate(xml);
      return xml;
    }
    return Buffer.alloc(33);
  }}});
  const meta = await profile.resource('https://view.eumetsat.int/geoserver/msg_fes/wms?request=GetCapabilities');
  assert.deepEqual(meta, { time });
  await profile.satelliteTile('clouds', time, 6, 33, 21);
  assert.equal(calls[1].origin, 'https://view.eumetsat.int');
  assert.equal(calls[1].searchParams.get('layers'), 'msg_fes:clm');
  assert.equal(calls[1].searchParams.get('time'), time);
  assert.equal(calls[1].searchParams.get('bbox').split(',').every(value => Number.isFinite(Number(value))), true);
  await assert.rejects(profile.satelliteTile('clouds', time, 7, 33, 21), /invalid_profile_satellite_tile/);
  await assert.rejects(profile.satelliteTile('other', time, 6, 33, 21), /invalid_profile_satellite_tile/);
  assert.throws(() => resourceUrl('https://view.eumetsat.int/geoserver/msg_fes/wms?request=GetMap'), /invalid_profile_resource/);
});

test('DWD companion requests are restricted to the loopback weather route and bounded point lists', () => {
  const url = 'http://127.0.0.1:54582/api/dwd-icon-eu?points=52.52544%2C13.39233&profile=1';
  assert.equal(resourceUrl(url).localDwd, true);
  assert.throws(() => resourceUrl(url.replace('54582', '8080')), /invalid_profile_resource/);
  assert.throws(() => resourceUrl(url.replace('52.52544%2C13.39233', 'invalid')), /invalid_profile_resource/);
  assert.throws(() => resourceUrl(url + '&url=https://example.com'), /invalid_profile_resource/);
});

test('hosted DWD points use a fixed internal route and validate the forecast hour', () => {
  const url = '/api/v1/dwd-icon-eu?points=48.4,7.8&profile=1';
  assert.deepEqual(resourceUrl(url).staticDwd, { points: [{ lat: 48.4, lon: 7.8 }], profile: true, validAt: null, probe: false });
  assert.equal(resourceUrl('/api/v1/dwd-icon-eu?points=0,0').staticDwd.probe, true);
  for (const invalid of ['https://example.com' + url, url + '&valid=1', url + '&host=localhost', url.replace('48.4', '91')]) {
    assert.throws(() => resourceUrl(invalid), /invalid_profile_resource/);
  }
});

test('hosted DWD decoding shares tile requests and refreshes the manifest after publication', async () => {
  const hour = Math.floor(Date.now() / 3600000) * 3600000;
  const calls = [];
  const stale = '2026112412-2026112400', fresh = '2026112412-2026112403';
  const bytes = Buffer.alloc(2);
  bytes.writeInt16LE(62);
  const query = createTrackerDwdWeather(async (input, options) => {
    const url = new URL(input);
    calls.push(url.pathname);
    assert.equal(url.origin, 'https://ga-dwd-alpha.einherjer.workers.dev');
    assert.equal(options.redirect, 'error');
    if (url.pathname === '/manifest.json') return Response.json({ version: 1, source: 'dwd-icon-eu',
      bounds: [48, 7, 49, 8], tileDegrees: 1, samplesPerDegree: 1, levels: [], encoding: {},
      fields: { map: [['clcl', null]], profile: [['clcl', null]] },
      terms: [{ key: url.searchParams.get('dwd').startsWith('retry-') ? fresh : stale, validAt: hour, runAt: hour - 3600000 }] });
    if (url.pathname.includes(stale)) return new Response(null, { status: 404 });
    return new Response(gzipSync(bytes));
  });
  assert.equal((await query({ probe: true })).available, true);
  const req = { points: [point, { lat: 0, lon: 0 }], profile: false, validAt: null };
  const [first, second] = await Promise.all([query(req), query(req)]);
  assert.deepEqual(first, second);
  assert.equal(first.samples[0].cloudLowPct, 62);
  assert.equal(first.samples[1], null);
  assert.equal(first.validAt, hour);
  await query(req);
  assert.deepEqual(calls, ['/manifest.json', `/v1/${stale}/48-7-map.bin.gz`, '/manifest.json', `/v1/${fresh}/48-7-map.bin.gz`]);
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
