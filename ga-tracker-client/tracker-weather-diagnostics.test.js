'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createWeatherDiagnostics, voiceVisibilityHint, INTERVAL_MS, METAR_INTERVAL_MS } = require('./tracker-weather-diagnostics');

function harness(rows = []) {
  let t = 1000;
  const logs = [], urls = [];
  const diag = createWeatherDiagnostics({
    now: () => t, log: line => logs.push(line),
    fetch: async url => { urls.push(url); return { ok: true, json: async () => rows }; }
  });
  return { diag, logs, urls, advance: ms => { t += ms; }, flush: () => new Promise(resolve => setImmediate(resolve)) };
}
const fog = { lat: 49.63, lon: 2.61, altFt: 3000, aglFt: 2700, onGround: false, visMeters: 138600, inCloud: false,
  precipState: 2, precipLabel: 'kein Niederschlag', tempC: -3.5, windKts: 4, windDeg: 270, hasMission: true,
  weatherPreset: { index: 0, name: 'Live' } };

test('logs raw simulator weather with the passenger visibility hint and the nearest METAR', async () => {
  const h = harness([
    { icaoId: 'LFOB', lat: 49.45, lon: 2.11, visib: '1/2', wxString: 'FG', fltCat: 'LIFR', temp: -3, dewp: -3, rawOb: 'LFOB 262030Z 00000KT 0800 FG VV002 M03/M03 Q1031' },
    { icaoId: 'LFPG', lat: 49.01, lon: 2.55, visib: '6+', fltCat: 'VFR', temp: -2, dewp: -6, rawOb: 'LFPG ...' }
  ]);
  h.diag.observe(fog); await h.flush();
  assert.match(h.logs[0], /^SIM_WEATHER reason=interval visM=138600 visKm=138\.6 cloud=0 precip=2\(kein Niederschlag\)/);
  assert.match(h.logs[0], /preset=0:"Live" mission=1 voiceHint="Sicht 138\.6 km \(ausgezeichnet\)"$/);
  assert.match(h.urls[0], /bbox=49\.03,1\.71,50\.23,3\.51$/);
  assert.match(h.logs[1], /^SIM_WEATHER_METAR station=LFOB distNm=\d+(\.\d)? visib=1\/2sm wx=FG cat=LIFR temp=-3 dewp=-3 spread=0 raw="LFOB 262030Z/);
});

test('interval, immediate change line and METAR throttle', async () => {
  const h = harness([]);
  h.diag.observe(fog); await h.flush();
  h.advance(5000); h.diag.observe(fog);
  assert.equal(h.logs.filter(l => l.startsWith('SIM_WEATHER ')).length, 1, 'nothing new within the minute');
  h.advance(6000); h.diag.observe({ ...fog, visMeters: 900, inCloud: true });
  assert.match(h.logs.at(-1), /reason=change:6\|0\|2>0\|1\|2 visM=900 visKm=0\.9 cloud=1/);
  h.advance(INTERVAL_MS); h.diag.observe({ ...fog, visMeters: 900, inCloud: true }); await h.flush();
  assert.match(h.logs.filter(l => l.startsWith('SIM_WEATHER ')).at(-1), /reason=interval/);
  assert.equal(h.urls.length, 1, 'METAR at most every 10 min');
  h.advance(METAR_INTERVAL_MS); h.diag.observe(fog); await h.flush();
  assert.equal(h.urls.length, 2);
  assert.ok(h.logs.includes('SIM_WEATHER_METAR station=none'));
});

test('quiet on the ground without mission, in menus and without position', () => {
  const h = harness();
  h.diag.observe({ ...fog, hasMission: false, onGround: true });
  h.diag.observe({ ...fog, inMenu: true });
  h.diag.observe({ ...fog, lat: 0, lon: 0 });
  assert.deepEqual(h.logs, []);
  assert.equal(voiceVisibilityHint(2.5), 'Sicht 2.5 km (sehr schlecht)');
  assert.equal(voiceVisibilityHint(null), '');
});
