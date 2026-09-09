'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createNavigationWarnings } = require('./tracker-navigation-warnings');
const { projectTrackerMapSnapshot } = require('./tracker-efb-map-snapshot-core');
const core = require('../navigation-warning-core');
const flush = () => new Promise(resolve => setImmediate(resolve));
const ctr = { id: 'lahr', name: 'CTR Test', type: 4, lowerLimit: { value: 0, unit: 1, referenceDatum: 1 },
  upperLimit: { value: 10000, unit: 1, referenceDatum: 1 }, frequencies: [{ value: '122.500', primary: true }],
  geometry: { type: 'Polygon', coordinates: [[[.015,-.1],[.3,-.1],[.3,.1],[.015,.1],[.015,-.1]]] } };
function fixture(options = {}) {
  let clock = 100000; const jobs = [], cancelled = [], samples = [];
  const data = { cache: { snapshot: () => ({ bytes: 100, files: 1, maxBytes: 4096 }) },
    terrain: async point => { samples.push(point); return 100; }, airspaces: async () => [ctr],
    obstacles: async () => ({ complete: true, obs: [] }), ...options.data };
  const engine = createNavigationWarnings({ data, voice: { enqueueWarning: job => jobs.push(job), cancel: id => cancelled.push(id) },
    now: () => clock, getSettings: () => ({}), ...options, data });
  const point = { lat: 0, lon: 0, alt: 1500, agl: 1400, gs: 120, vs: 0, hdg: 90 };
  return { engine, jobs, cancelled, samples, data, point, advance(ms) { clock += ms; },
    async tick(patch = {}, ms = 1500) { clock += ms; engine.observe({ ...point, ...patch }); await flush(); } };
}
test('fresh tracker telemetry alone generates standalone airspace/frequency and terrain warnings', async () => {
  const f = fixture();
  for (let i = 0; i < 7; i++) await f.tick();
  assert.equal(f.jobs.length, 1); assert.equal(f.jobs[0].kind, 'airspace');
  assert.ok(f.jobs[0].clips.includes('aw-freq'));
  assert.equal(f.engine.snapshot().status, 'ready');
  const snapshot = f.engine.snapshot();
  assert.equal(snapshot.events[0].airspace.id, 'lahr');
  assert.ok(!JSON.stringify(snapshot).includes('coordinates'), 'no geometry or audio bytes sent in telemetry');
  assert.ok(JSON.stringify(snapshot).length < 1500);
  f.data.terrain = async () => 1200;
  await f.tick(); assert.equal(f.jobs.at(-1).kind, 'terrain');
  await f.tick(); assert.equal(f.jobs.filter(j => j.kind === 'terrain').length, 1, 'cooldown');
  f.advance(11000); assert.equal(f.engine.snapshot().status, 'stale');
});
test('slow data never blocks observation or emits warnings for an old position', async () => {
  let resolveHeight; const height = new Promise(resolve => { resolveHeight = resolve; });
  const f = fixture({ data: { terrain: () => height, obstacles: () => new Promise(() => {}) } });
  assert.equal(f.engine.observe(f.point), undefined);
  f.advance(1000); f.engine.observe({ ...f.point, lon: .001 });
  f.advance(3000); resolveHeight(1400); await flush();
  assert.equal(f.jobs.length, 0, 'do not announce a result that took over three seconds');
  f.engine.observe(f.point); await flush();
  assert.equal(f.jobs[0].kind, 'terrain', 'obstacle downloads must not hold terrain checks');
});
test('reset/legacy handoff cancels queued warnings and rejects old async results', async () => {
  const f = fixture({ data: { terrain: async () => 1400 } });
  await f.tick(); assert.equal(f.jobs.length, 1);
  const revision = f.engine.snapshot().revision;
  f.engine.setEnabled(false);
  assert.equal(f.cancelled[0], f.jobs[0].effectId);
  assert.equal(f.engine.snapshot().active, false); assert.equal(f.engine.snapshot().status, 'standalone');
  await f.tick(); assert.equal(f.jobs.length, 1);
  assert.ok(f.engine.snapshot().revision > revision);
  f.engine.setEnabled(true); await f.tick({ paused: true });
  assert.equal(f.engine.snapshot().status, 'paused'); assert.equal(f.jobs.length, 1);
  await f.tick(); assert.equal(f.jobs.length, 2);
  const pending = new Promise(resolve => { f.resolve = resolve; }); f.data.terrain = () => pending;
  await f.tick(); f.engine.reset(); f.resolve(1400); await flush();
  assert.equal(f.jobs.length, 2);
});
test('missing data is explicit and does not fabricate a terrain warning', async () => {
  const f = fixture({ data: { terrain: async () => { throw Error('offline'); }, airspaces: async () => { throw Error('offline'); } } });
  await f.tick(); assert.equal(f.jobs.length, 0); assert.equal(f.engine.snapshot().status, 'partial');
  assert.match(f.engine.snapshot().health, /Geländedaten.*Luftraumdaten/);
});
test('waypoint calls use the route saved in the tracker without an App client', async () => {
  const run = { missionId: 'test-mission', runId: 'test-run', resumeBundle: { missionState: { currentMissionData: {
    routeWaypoints: [{ lat: 0, lon: 0 }, { lat: 0, lon: 1, name: 'Zwischenpunkt' }, { lat: 0, lon: 2 }]
  } } } };
  const map = projectTrackerMapSnapshot(run);
  const f = fixture({ getRoute: () => ({ id: map.runId, points: map.route.waypoints }) });
  await f.tick({ lon: .1, gs: 0 }); await f.tick({ lon: .995, gs: 0 });
  assert.equal(f.jobs.length, 1); assert.equal(f.jobs[0].kind, 'waypoint');
  assert.match(f.jobs[0].text, /Zwischenpunkt erreicht/);
  await f.tick({ lon: .995, gs: 0 }); assert.equal(f.jobs.length, 1);
});

test('a turn reloads the current prediction corridor immediately and warns like standalone once covered', async () => {
  const east = { ...ctr, id: 'east', name: 'East CTR', geometry: { type: 'Polygon',
    coordinates: [[[.095,-.01],[.13,-.01],[.13,.01],[.095,.01],[.095,-.01]]] } };
  const requests = []; let finish;
  const f = fixture({ data: { airspaces: async points => {
    requests.push(core.predictionBounds(points));
    if (requests.length === 1) return [];
    return new Promise(resolve => { finish = resolve; });
  } } });
  await f.tick({ hdg: 0 });
  assert.equal(f.engine.snapshot().status, 'ready');
  await f.tick({ hdg: 90 });
  assert.equal(requests.length, 2, 'turn does not wait for the old thirty-second refresh');
  assert.ok(requests[0].east < .095 && requests[1].east > .13);
  assert.equal(f.engine.snapshot().status, 'partial', 'missing current coverage must not be reported ready');
  assert.equal(f.jobs.length, 0);
  finish([east]); await flush();
  const reference = core.createAirspaceDetector(), expected = [];
  for (let i = 0; i < 7; i++) {
    await f.tick();
    const input = { airspaces: [east], points: core.predictions(f.point, 120, 0).map(p => ({ ...p, terrainFt: 100 })),
      gps: f.point, lastTerrainFt: 100, now: f.engine.snapshot().lastGoodAt };
    expected.push(...reference.evaluate(input).map(e => e.clips));
  }
  assert.ok(expected.length > 0);
  assert.deepEqual(f.jobs.map(j => j.clips), expected);
  assert.equal(f.engine.snapshot().status, 'ready');
  assert.equal(requests.length, 2, 'unchanged covered flight path reuses geometry');
});

test('speed changes extend coverage, failures back off, and cold ground data loads without flight alerts', async () => {
  const requests = [];
  const f = fixture({ data: { airspaces: async points => { requests.push(points); return [ctr]; } } });
  await f.tick({ gs: 0, vs: 0 });
  assert.equal(requests.length, 1); assert.ok(f.samples.length > 0);
  assert.equal(f.jobs.length, 0, 'prewarming must not announce boarding/parked predictions');
  assert.ok(f.samples.every(p => p.lat === 0 && p.lon === 0));
  await f.tick({ gs: 60 });
  assert.equal(requests.length, 2);
  await f.tick({ gs: 240, vs: -600 });
  assert.equal(requests.length, 3, 'longer prediction must not be clipped to old slow-flight coverage');
  assert.ok(Math.abs(requests[2].at(-1).alt - Math.max(0, 1500 - 600 * 10)) < .001);

  let attempts = 0;
  const failing = fixture({ data: { airspaces: async () => { attempts++; throw Error('offline'); } } });
  for (let i = 0; i < 6; i++) await failing.tick({ hdg: i * 45 });
  assert.equal(attempts, 1); assert.equal(failing.engine.snapshot().status, 'partial');
  assert.equal(failing.jobs.length, 0);
  await failing.tick({}, 3000); assert.equal(attempts, 2);
});

test('a delayed height response from before a turn cannot announce the abandoned path', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const f = fixture({ data: { terrain: () => pending } });
  await f.tick({ hdg: 90 });
  await f.tick({ hdg: 0 }, 500);
  finish(1450); await flush();
  assert.equal(f.jobs.length, 0);
  f.data.terrain = async () => 100;
  await f.tick({ hdg: 0 }); assert.equal(f.jobs.length, 0);
});
