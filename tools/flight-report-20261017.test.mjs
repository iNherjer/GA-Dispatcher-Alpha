import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { declaration } from './gemini-migration-harness.mjs';
const require = createRequire(import.meta.url);
const sync = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
const arrival = fs.readFileSync(new URL('../mission-arrival-core.js', import.meta.url), 'utf8');
const { planPickupReception } = require('../ga-tracker-client/tracker-arrival-reception-core.js');
function arrivalFixture() {
  const c = vm.createContext({ Map, console, window: {} });
  vm.runInContext(arrival, c);
  const origin = { lat: 48.02278, lon: 7.8325 };
  const point = (east, north) => c.offsetAptArrivalLatLon(origin.lat, origin.lon, 0, north, east);
  const rectangle = (x1, y1, x2, y2) => [[x1,y1],[x2,y1],[x2,y2],[x1,y2],[x1,y1]].map(([x,y]) => point(x,y));
  return { c, origin, point, rectangle };
}
test('arrival placement rejects a safe anchor whose reception actor or vehicle overlaps a runway', () => {
  const { c, origin, point, rectangle } = arrivalFixture();
  const plan = { ...origin, airportLat: origin.lat, airportLon: origin.lon, hdg: 0,
    role: 'media_pickup', items: [{ kind: 'arrival_person_editor', role: 'person.ground_crew', forwardM: 0, rightM: 15 }] };
  const ctx = { parkingPositions: [{ ...point(0,0), id: 'unsafe' }, { ...point(-50,0), id: 'safe' }], aprons: [],
    avoidZones: [{ type: 'runway', bufferM: 0, polygon: rectangle(10,-100,30,100) }] };
  assert.equal(c.aptArrivalBlockedZone(ctx, point(0,0)), null);
  assert.equal(c.aptArrivalSceneFits(ctx, point(0,0), plan), false);
  const result = c.pickAptArrivalOsmPlacement(ctx, plan);
  assert.equal(result.sourceId, 'safe');
  assert.equal(result.alternates.parking.length, 1);
  assert.equal(result.alternates.parking[0].sourceId, 'safe');
});
test('recorded Freiburg reception coordinates reproduce the old unverified representative fallback', () => {
  const { c } = arrivalFixture();
  const anchor = c.representativeAptArrivalAnchor(48.0227775574,7.8324999809,237);
  const editor = c.offsetAptArrivalLatLon(anchor.lat,anchor.lon,237,1,3);
  assert.ok(Math.abs(editor.lat-48.02317336175902)<0.000001);
  assert.ok(Math.abs(editor.lon-7.832548049571594)<0.000001);
});
test('arrival uses complete scene footprints and rejects actors outside an apron', () => {
  const { c, origin, point, rectangle } = arrivalFixture();
  const apron = { id: 'apron', polygon: rectangle(-25,-25,25,25) };
  const ctx = { parkingPositions: [], aprons: [apron], avoidZones: [] };
  const plan = { airportLat: origin.lat, airportLon: origin.lon, hdg: 0,
    items: [{ kind: 'arrival_vehicle', role: 'vehicle.van', forwardM: 0, rightM: 7 }] };
  assert.equal(c.aptArrivalSceneFits(ctx, point(20,0), plan, apron), false);
  const result = c.pickAptArrivalOsmPlacement(ctx, plan);
  assert.ok(result); assert.equal(c.aptArrivalSceneFits(ctx, result.point, plan, apron), true);
});
test('unavailable airport geometry does not authorize a representative point as a safe scene', async () => {
  const { c, origin } = arrivalFixture();
  c.fetchAptArrivalGeoContext = async () => null;
  const plan = { ...origin, role: 'media_pickup', source: 'airport-representative-offset' };
  const result = await c.resolveAptArrivalPlanPlacement(plan);
  assert.equal(result.snapStatus.spawnAllowed, false);
  assert.equal(result.snapStatus.reason, 'overpass_unavailable');
});
test('new standard APT plans start unverified and cannot spawn before the placement resolver succeeds', () => {
  const { c, origin } = arrivalFixture();
  c.normalizeAptArrivalRole = () => ({ role: 'media_pickup', personRole: 'person.ground_crew', vehicleRole: 'vehicle.van' });
  c.normalizeMissionType = () => 'apt';
  const plan = c.buildAptArrivalPlan({ dest: { ...origin, icao: 'EDTF' }, missionType: 'apt' });
  assert.equal(plan.snapStatus.status, 'pending');
  assert.equal(plan.snapStatus.spawnAllowed, false);
});
test('only explicitly assigned media reception joins its vehicle and never adds manifest PAX', () => {
  const { c } = arrivalFixture();
  const items = c.buildAptArrivalSceneItems({ role: 'media_pickup', personRole: 'person.ground_crew', vehicleRole: 'vehicle.van' });
  const actors = items.map((item, i) => ({ ...item, objectId: i+1, lat: 48, lon: 8, altFt: 800 }));
  actors.push({ objectId: 100, kind: 'arrival_person_1', lat: 48, lon: 8, altFt: 800 });
  actors.push({ objectId: 101, kind: 'person_boarder_1', departWithPickupVehicle: true, lat: 48, lon: 8, altFt: 800 });
  const routes = planPickupReception({ objects: actors }, actors[0]);
  assert.deepEqual(Array.from(routes, p => p.person.kind), ['arrival_person_editor', 'arrival_person_camera']);
  assert.ok(routes.every(p => p.walkMs >= 1200 && p.target.altFt === 800));
  assert.equal(planPickupReception({ objects: actors }, null).length, 0);
});
test('Quest debrief sends terminal mission IDs and revision over the authenticated relay and retains retry on failure', async () => {
  const sent = []; let cleanup = 0, response = { status: 'error', error: 'offline' };
  const debrief = { missionId: 'finished', runId: 'flight-run', revision: 97, closedAt: null };
  const c = vm.createContext({ window: { lastTrackerMissionAuthority: { activeRun: null, debrief }, liveTrackerConnected: true,
    sendTrackerCommand() {}, gaCockpitSessionClient: { submitIntent() { throw Error('Quest loopback must not be called'); } } },
    _sendMissionAuthorityRequest: async request => { sent.push(request); return response; },
    _missionAuthorityClientId: () => 'quest-browser', TRACKER_ACK_SUCCESS: new Set(['ok', 'noop']),
    _completeMissionCloseCleanupLocal: () => { cleanup++; return true; }, Date, Math });
  const start = sync.indexOf('window.completeMissionCloseCleanup = function('), end = sync.indexOf('\n};', start);
  vm.runInContext(sync.slice(start, end+3), c);
  const record = { missionId: 'finished', runId: 'flight-run' };
  assert.equal(await c.window.completeMissionCloseCleanup(record), false);
  assert.equal(cleanup, 0); assert.equal(debrief.closedAt, null);
  response = { status: 'ok' };
  assert.equal(await c.window.completeMissionCloseCleanup(record), true);
  assert.equal(cleanup, 1);
  assert.equal(sent[1].type, 'mission_execution_intent');
  assert.equal(sent[1].expectedRevision, 97); assert.equal(sent[1].runId, 'flight-run');
});
test('a delayed cloud copy cannot restore a completed Tracker mission, including after reload', async () => {
  for (const persisted of [false,true]) {
    let outcome;
    const record = { missionId: 'finished', runId: 'finished-run' };
    const c = vm.createContext({ window: { lastTrackerMissionAuthority: persisted ? null : { activeRun: null, debrief: record } },
      _syncMissionRestoreBlocked: () => false, getSyncId: () => 'PILOT',
      localStorage: { getItem: () => persisted ? JSON.stringify(record) : null },
      _syncRecordCloudMissionPullOutcome: (status, details) => { outcome = { status, ...details }; } });
    for (const name of ['_syncMissionIdentityValues','_syncMissionStatesShareIdentity','_syncApplyActiveMissionFromCloud']) {
      vm.runInContext(declaration(sync, name), c);
    }
    assert.equal(await c._syncApplyActiveMissionFromCloud({ missionId: 'finished' }, { authoritativeOpening: true }), true);
    assert.equal(outcome.terminal, true); assert.equal(outcome.cloudMatchesTracker, true);
  }
});
test('background views do not write, pull or open cloud conflict prompts', async () => {
  const c = vm.createContext({ document: { hidden: true } });
  for (const name of ['triggerCloudSave','silentSyncLoad','checkCloudAfterIdle']) vm.runInContext(declaration(sync,name),c);
  assert.equal((await c.triggerCloudSave(true)).reason, 'background-view');
  assert.equal(await c.silentSyncLoad(), false);
  await c.checkCloudAfterIdle();
});
test('a second browser tab cannot borrow the first tab revision acknowledgement', () => {
  const storage = new Map([['ga_sync_revision_v2:PILOT','10']]);
  function tab() {
    const c = vm.createContext({ window: { GACloudSyncClient: { create: options => ({
      acknowledge: options.setRevision, knownRevision: options.getRevision }) } },
      localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v) },
      getSyncId: () => 'PILOT', getSyncPin: () => 'pin', SYNC_URL: 'https://test/api/sync/' });
    vm.runInContext('let _profileSyncSession=null;' + declaration(sync,'_syncProfileClient') + '\n'
      + declaration(sync,'_syncProfileIsNewer'),c);
    return c;
  }
  const a=tab(), b=tab(); a._syncProfileClient(); b._syncProfileClient();
  a._syncProfileClient().acknowledge(11);
  assert.equal(b._syncProfileClient().knownRevision(),10);
  assert.equal(b._syncProfileIsNewer({_syncRevision:11}),true);
  assert.equal(a._syncProfileIsNewer({_syncRevision:11}),false);
});
