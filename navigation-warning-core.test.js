'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const core = require('./navigation-warning-core');
function space(name = 'CTR', type = 4, lower = 0) {
  return { name, type, lowerLimit: { value: lower, unit: 1, referenceDatum: 1 }, upperLimit: { value: 10000, unit: 1, referenceDatum: 1 },
    geometry: { type: 'Polygon', coordinates: [[[0,0],[2,0],[2,2],[0,2],[0,0]]] }, frequencies: [{ value: '122.500', primary: true }] };
}
test('prediction uses the standalone heading, speed and vertical-rate flight path at every horizon', () => {
  const app = fs.readFileSync('app.js', 'utf8');
  const start = app.indexOf('function getDestinationPoint('), end = app.indexOf('\n}', start) + 2;
  const reference = {};
  vm.createContext(reference); vm.runInContext(app.slice(start, end), reference);
  for (const hdg of [0, 90, 225, 359]) for (const gs of [45, 120, 240]) for (const vs of [-1200, 0, 700]) {
    const point = { lat: 48.38, lon: 7.84, alt: 1500, hdg };
    const predicted = core.predictions(point, gs, vs);
    assert.deepEqual(predicted.map(p => p.min), [.25,1,2,3,4,5,10]);
    for (const p of predicted) {
      const expected = reference.getDestinationPoint(point.lat, point.lon, gs * p.min / 60, hdg);
      assert.equal(p.lat, expected.lat); assert.equal(p.lon, expected.lon);
      assert.equal(p.alt, Math.max(0, point.alt + vs * p.min));
    }
  }
});
function legacy() {
  const source = fs.readFileSync('taws.js', 'utf8'), calls = [];
  const sandbox = { window: {}, activeAirspaces: [], Date: { now: () => sandbox.now }, now: 1000,
    _awmAirspaceWarn: true, _awLoaded: true, _tawsAudioCtx: {}, _awmReadFreq: true,
    _awBuffers: { 'aw-zwo': {} }, _awState: new Map(), _awTypeChain: new Map(), _AW_CHAIN_GAP: 45000,
    getAirspaceVerticalBandFt: core.getAirspaceVerticalBandFt, isPointInsideAirspace: core.isPointInsideAirspace,
    _awPulseOnMap() {}, _awPulseOnProfileBand() {}, _awShowFreqBanner() {}, console: { log() {} },
    _awPlaySequence: clips => calls.push([...clips]) };
  vm.createContext(sandbox);
  for (const name of ['_awTypeKey','_awTypeClips','_awMinKey','_awDigitClip','_awFreqToClips','_awGetFreqClips']) {
    const start = source.indexOf('function ' + name + '('), end = source.indexOf('\n}', start) + 2;
    vm.runInContext(source.slice(start, end), sandbox);
  }
  vm.runInContext(fs.readFileSync('tools/fixtures/standalone-airspace-warning-reference.js', 'utf8'), sandbox);
  return { evaluate(input) { calls.length = 0; sandbox.now = input.now; sandbox.activeAirspaces = input.airspaces;
    sandbox.window.lastLiveGpsPos = input.gps; sandbox.window.lastLiveTerrainFt = input.lastTerrainFt;
    sandbox.checkAirspaceWarnings(input.points); return calls.map(value => Array.from(value)); } };
}
test('airspace persistence, vertical margins, nearest-first and class chains match frozen standalone', () => {
  for (const scenario of ['approach', 'glance', 'inside', 'agl', 'stacked', 'chain', 'freq']) {
    const actual = core.createAirspaceDetector(), reference = legacy();
    const first = space(), second = space('Delta', 0, scenario === 'stacked' ? 8000 : 0);
    second.geometry.coordinates[0] = [[2,0],[4,0],[4,2],[2,2],[2,0]];
    if (scenario === 'agl') { first.lowerLimit.referenceDatum = 0; first.lowerLimit.value = 1500; }
    if (scenario === 'freq') first.frequencies = [{ name: 'Squawk', value: '7000' }, { primary: true, value: '120.250' }];
    let count = 0;
    for (let t = 1000; t < 80000; t += 1000) {
      const inside = scenario === 'inside' || (scenario === 'chain' && t > 25000);
      const input = { now: t, airspaces: [first, second], lastTerrainFt: scenario === 'agl' ? 1000 : 0,
        gps: { lat: 1, lon: inside ? 1 : -0.1, alt: 2000 },
        points: [{ lat: 1, lon: scenario === 'glance' && t % 4000 ? -1 : 1, alt: 2000, min: t < 18000 ? 5 : 2 },
          { lat: 1, lon: 3, alt: 2000, min: 5 }] };
      const expected = reference.evaluate(input), result = actual.evaluate(input).map(e => e.clips);
      assert.deepEqual(result, expected, scenario + ' at ' + t); count += result.length;
    }
    if (scenario === 'approach') assert.ok(count > 0);
  }
});
test('terrain warning preserves 15s horizon, 500ft red, 75kt landing suppression and 15s cooldown', () => {
  const detector = core.createTerrainDetector();
  assert.equal(core.terrainThreat(null, 100), 'unknown');
  assert.equal(core.terrainThreat(1000, 1500), 'amber');
  assert.equal(core.terrainThreat(1000, 2000), 'green');
  assert.deepEqual(detector.evaluate([{ min: 1, alt: 1100, terrainFt: 1000 }], 100, 20000), []);
  assert.deepEqual(detector.evaluate([{ min: .25, alt: 1100, terrainFt: 1000 }], 70, 20000), []);
  assert.equal(detector.evaluate([{ min: .25, alt: 1100, terrainFt: 1000 }], 100, 20000).length, 1);
  assert.equal(detector.evaluate([{ min: .25, alt: 1100, terrainFt: 1000 }], 100, 30000).length, 0);
  assert.equal(detector.evaluate([{ min: .25, alt: 1100, terrainFt: 1000 }], 100, 36000).length, 1);
});
test('waypoint trigger advances only once, at the standalone 0.5NM / 2.5NM line', () => {
  const detector = core.createWaypointDetector(), route = [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 0, lon: 2 }];
  assert.equal(detector.evaluate({ lat: 0, lon: .1 }, route, 'run').length, 0);
  assert.equal(detector.evaluate({ lat: .1, lon: .999 }, route, 'run').length, 0);
  const result = detector.evaluate({ lat: 0, lon: .995 }, route, 'run');
  assert.equal(result.length, 1); assert.equal(result[0].waypointIndex, 2);
  assert.equal(detector.evaluate({ lat: 0, lon: .995 }, route, 'run').length, 0);
});
test('frequency and voice-pack paths stay declarative; whoop is generated without a download', () => {
  assert.deepEqual(core.frequencyClips(space()), ['aw-freq','aw-d1','aw-zwo','aw-zwo','aw-komma','aw-d5']);
  assert.deepEqual(core.frequencyClips(space(), false), []);
  assert.equal(core.assetPath('aw-d1', 'ava-en'), 'audio-warnings/voices/ava-en/aw-d1.mp3');
  assert.throws(() => core.assetPath('../../key', '')); assert.throws(() => core.assetPath('aw-d1', '../'));
  assert.equal(Buffer.from(core.whoopWav()).toString('ascii', 0, 4), 'RIFF');
});
