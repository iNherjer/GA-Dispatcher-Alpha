const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
require('../mission-private-outing-core.js');
const v6 = require('../mission-private-episode-v6.js');

const app = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const airport = fs.readFileSync(require.resolve('../airport-weather.js'), 'utf8');
const sample = { icaoId: 'EDDS', lat: 48.69, lon: 9.22, wdir: 240, wspd: 7, temp: 19,
  rawOb: 'METAR EDDS 141220Z 24007KT 9999 FEW030 19/12 Q1025' };

function harness() {
  let now = 1000000;
  let respond = () => new Response(JSON.stringify([sample]));
  const calls = [];
  const c = vm.createContext({ URL, AbortController, setTimeout, clearTimeout,
    Date: class extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){return now;} }, window: {},
    calcNav: (a, b, x, y) => ({ dist: Math.hypot(a - x, b - y) }),
    fetch: async url => {
      const upstream = new URL(new URL(url).searchParams.get('src'));
      calls.push(upstream);
      // Model the real upstream's strict rejection, rather than silently accepting malformed URLs.
      if (upstream.searchParams.has('t')) return new Response('Unexpected query parameter provided', { status: 400 });
      return respond(upstream);
    }
  });
  vm.runInContext(app.slice(app.indexOf('const _missionWxCache ='), app.indexOf('const _dwdWbiStationCache =')), c);
  for (const [source, names] of [[airport, ['_parseMetarPayloadToArray', '_fetchWithTimeout', '_fetchMetarArrayViaVariants']],
    [app, ['_looksLikeIcao', 'fetchMissionWeatherSnapshot', '_summarizeMissionWeather', '_missionPipelineV3WeatherBundle']]]) {
    for (const name of names) {
      const start = source.search(new RegExp('(?:async )?function ' + name + '\\('));
      assert.ok(start >= 0);
      vm.runInContext(source.slice(start, source.indexOf('\n}\n', start) + 2), c);
    }
  }
  return { c, calls, advance: ms => { now += ms; }, respond: fn => { respond = fn; } };
}

test('airport without own METAR uses nearest regional station and reaches the V6 weather input', async () => {
  const h = harness();
  h.respond(url => url.searchParams.has('ids') ? new Response(null, { status: 204 })
    : new Response(JSON.stringify([{ ...sample, icaoId: 'DIST', lat: 47, lon: 7 }, sample])));
  const wx = await h.c.fetchMissionWeatherSnapshot('EDSD', 48.63843, 8.81749);
  assert.equal(h.calls.length, 2);
  assert.ok(h.calls[1].searchParams.has('bbox'));
  assert.equal(wx.station, 'EDDS');
  assert.equal(wx.windKts, 7);
  const weather = h.c._missionPipelineV3WeatherBundle({ dep: wx, dest: wx });
  const input = v6.frame({ route: { startIcao: 'EDTW', targetIcao: 'EDSD', distanceNm: 26.6 }, weather });
  assert.equal(input.flightContext.weather[1].station, 'EDDS');
  assert.equal(input.flightContext.weather[1].airportIcao, 'EDSD');
  assert.equal(input.flightContext.weather[1].windKts, 7);
  assert.equal(v6.flightBindings(input.flightContext)['target.wind'], '7 Knoten');
});

test('successful snapshots expire after ten minutes; each airport has its own cache key', async () => {
  const h = harness();
  await h.c.fetchMissionWeatherSnapshot('EDDS', 48.69, 9.22);
  h.advance(599999);
  await h.c.fetchMissionWeatherSnapshot('EDDS', 48.69, 9.22);
  assert.equal(h.calls.length, 1);
  h.advance(1);
  h.respond(() => new Response(JSON.stringify([{ ...sample, wspd: 12 }])));
  assert.equal((await h.c.fetchMissionWeatherSnapshot('EDDS', 48.69, 9.22)).windKts, 12);
  assert.equal(h.calls.length, 2);
  await h.c.fetchMissionWeatherSnapshot('EDSB', 48.77, 8.08);
  assert.equal(h.calls.length, 3);
});

test('network errors and empty regions recover after a short backoff, without inventing weather', async () => {
  for (const fail of [() => { throw new Error('offline'); }, () => new Response('[]'),
    () => new Response(null, { status: 204 }), () => new Response('bad', { status: 400 })]) {
    const h = harness();
    h.respond(fail);
    assert.equal(await h.c.fetchMissionWeatherSnapshot('EDTW', 48.279, 8.428), null);
    const expectedCalls = h.calls.length;
    assert.ok(expectedCalls === 2 || expectedCalls === 4);
    h.respond(() => new Response(JSON.stringify([sample])));
    h.advance(29999);
    assert.equal(await h.c.fetchMissionWeatherSnapshot('EDTW', 48.279, 8.428), null);
    assert.equal(h.calls.length, expectedCalls);
    h.advance(1);
    assert.equal((await h.c.fetchMissionWeatherSnapshot('EDTW', 48.279, 8.428)).windKts, 7);
    assert.equal(h.calls.length, expectedCalls + 1);
  }
});

test('mission weather cache remains bounded over many different destinations', async () => {
  const h = harness();
  for (let i = 0; i < 140; i++) await h.c.fetchMissionWeatherSnapshot('EDDS', 48 + i / 1000, 9.22);
  assert.equal(vm.runInContext('_missionWxCache.size', h.c), 128);
  h.advance(600000);
  await h.c.fetchMissionWeatherSnapshot('EDDS', 48.69, 9.22);
  assert.equal(vm.runInContext('_missionWxCache.size', h.c), 1);
});

test('all web METAR request builders omit the rejected cache-busting query parameter', () => {
  for (const path of ['app.js', 'airport-weather.js', 'profile.js', 'checklists.js']) {
    const source = fs.readFileSync(require.resolve('../' + path), 'utf8');
    const urls = source.match(/https:\/\/aviationweather\.gov\/api\/data\/metar\?[^`\n]+/g);
    assert.ok(urls?.length, path);
    for (const url of urls) assert.ok(!url.includes('&t='), path + ': ' + url);
  }
});

test('snapshot carries gusts, layers, ceiling, station scope and stale observation without inventing null values', async()=>{
 const h=harness();
 h.respond(()=>new Response(JSON.stringify([{...sample,obsTime:100,wgst:18,wdir:null,wspd:null,temp:null,clouds:[{cover:'FEW',base:1200},{cover:'BKN',base:3500}]}])));
 h.advance(6*3600000);
 const wx=await h.c.fetchMissionWeatherSnapshot('EDDS',48.69,9.22);
 assert.equal(wx.gustKts,18);assert.equal(wx.windKts,null);assert.equal(wx.windDeg,null);
 assert.equal(wx.cloudBaseFtAgl,1200);assert.equal(wx.ceilingFtAgl,3500);
 assert.equal(wx.observedAt,'1970-01-01T00:01:40.000Z');assert.equal(wx.freshness,'stale');assert.equal(wx.stationDistanceNm,0);
 const context=v6.flightContext({weather:h.c._missionPipelineV3WeatherBundle({dep:wx})});
 assert.equal(context.weather[0].freshness,'stale');assert.equal(context.weather[0].ceilingFtAgl,3500);
 assert.equal(v6.flightBindings(context)['start.gust'],'18 Knoten');
});

test('server failures retry once while rate limits do not retry',async()=>{
 for(const status of [503,429]){
  const h=harness();h.respond(()=>new Response('unavailable',{status}));
  assert.equal(await h.c.fetchMissionWeatherSnapshot('EDDS',48.69,9.22),null);
  assert.equal(h.calls.length,status===503?4:2);
 }
});
