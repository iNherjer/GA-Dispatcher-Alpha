// Direct-To with the mission kept: the detour sits next to the run and never touches it.
const { test } = require('node:test');
const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { createMissionAuthorityManager } = require('./mission-authority-core');
const { createCockpitTools, createNavigationRelay } = require('./tracker-cockpit-tools');
const { createFlightPlanExport } = require('./tracker-flightplan-export');

const missionPoints = [{ lat: 48, lng: 7, name: 'Start', icao: 'EDTL' }, { lat: 48.2, lng: 7.2, name: 'WP' }, { lat: 48.4, lng: 7.4, name: 'Ziel', icao: 'EDTO' }];
const detourPoints = [{ lat: 48.1, lng: 7.1, name: 'Live GPS Position', icao: 'GPS' }, { lat: 47.9, lng: 7.6, name: 'Bremgarten', icao: 'EDTG' }];

function fixture(t, extras = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nav-detour-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const storageFile = path.join(dir, 'mission.json');
  fs.writeFileSync(storageFile, JSON.stringify({ schema: 'ga.mission-authority.v1', version: 1, events: [], activeRun: {
    missionId: 'm', runId: 'run1', ownerClientId: 'app1', executionAuthority: 'tracker', executionRecipe: 'apt', state: 'active', phase: 'active',
    revision: 90, stateHash: 'unchanged', executionStateHash: 'unchanged',
    resumeBundle: { adapter: 'apt', missionState: { currentMissionData: { missionId: 'm', routeWaypoints: missionPoints } } }, ...extras } }));
  const manager = createMissionAuthorityManager({ storageFile });
  const state = { run: () => manager.getActiveRun({ includeBundle: true }), flight: null, connected: false };
  const options = { filename: path.join(dir, 'free.json'), detourFilename: path.join(dir, 'detour.json'),
    getRun: () => state.run(), getRunSummary: () => manager.getActiveRun(), editMissionRoute: request => manager.editNavigationRoute(request),
    getFlight: () => state.flight, isSimulatorConnected: () => state.connected };
  return { dir, manager, state, options, tools: createCockpitTools(options) };
}

async function setDetour(tools, points = detourPoints) {
  const current = tools.navigation();
  return tools.execute({ intent: 'navigation_detour_set', expectedRevision: current.revision, payload: { routeId: current.id, points, departureIcao: 'GPS', destinationIcao: 'EDTG' } });
}

test('detour is flown instead of the mission route and leaves the run unchanged', async t => {
  const f = fixture(t), before = f.manager.getActiveRun({ includeBundle: true });
  const result = await setDetour(f.tools);
  assert.equal(result.ok, true);
  assert.equal(result.navigation.detour, true);
  assert.equal(result.navigation.runId, 'run1');
  assert.deepEqual(result.navigation.points.map(p => p.icao), ['GPS', 'EDTG']);
  assert.deepEqual(result.navigation.missionPoints.map(p => p.name), ['Start', 'WP', 'Ziel']);
  const map = f.tools.snapshot();
  assert.equal(map.detour, true);
  assert.equal(map.route.waypoints.length, 2);
  assert.equal(map.missionRoute.waypoints.length, 3);
  assert.equal(map.routeEdit.detour, true);
  assert.equal(map.missionId, 'm');
  const after = f.manager.getActiveRun({ includeBundle: true });
  assert.deepEqual(after.resumeBundle, before.resumeBundle);
  assert.equal(after.navigationRevision, before.navigationRevision);
  assert.equal(after.revision, before.revision);
  assert.deepEqual(f.tools.version(), { id: result.navigation.id, revision: result.navigation.revision });
});

test('detour edits keep their id, Route Reset returns to the mission route', async t => {
  const f = fixture(t);
  const set = await setDetour(f.tools);
  const edit = await f.tools.execute({ intent: 'navigation_edit', expectedRevision: set.navigation.revision,
    payload: { routeId: set.navigation.id, edit: { action: 'insert', index: 1, point: { lat: 48, lng: 7.3 } } } });
  assert.equal(edit.ok, true);
  assert.equal(edit.navigation.id, set.navigation.id);
  assert.equal(edit.navigation.points.length, 3);
  assert.equal(f.manager.getActiveRun({ includeBundle: true }).navigationRevision || 0, 0);
  const stale = await f.tools.execute({ intent: 'navigation_edit', expectedRevision: set.navigation.revision,
    payload: { routeId: set.navigation.id, edit: { action: 'remove', index: 1 } } });
  assert.equal(stale.error, 'navigation_revision_conflict');
  const reset = await f.tools.execute({ intent: 'navigation_edit', expectedRevision: edit.navigation.revision,
    payload: { routeId: edit.navigation.id, edit: { action: 'reset' } } });
  assert.equal(reset.ok, true);
  assert.equal(reset.navigation.detour, undefined);
  assert.equal(reset.navigation.id, 'run1');
  assert.deepEqual(reset.navigation.points.map(p => p.name), ['Start', 'WP', 'Ziel']);
  assert.equal(fs.existsSync(f.options.detourFilename), false);
});

test('detour survives a tracker restart and is deleted when the mission ends', async t => {
  const f = fixture(t);
  await setDetour(f.tools);
  const restarted = createCockpitTools(f.options);
  assert.equal(restarted.navigation().detour, true);
  f.state.run = () => null;
  const ended = createCockpitTools({ ...f.options, getRunSummary: () => null });
  assert.equal(ended.navigation().detour, undefined);
  assert.equal(fs.existsSync(f.options.detourFilename), false);
});

test('a detour of another run is never shown', async t => {
  const f = fixture(t);
  await setDetour(f.tools);
  const other = createCockpitTools({ ...f.options, getRun: () => ({ ...f.state.run(), runId: 'run2' }), getRunSummary: () => ({ runId: 'run2' }) });
  assert.equal(other.navigation().detour, undefined);
});

test('EFB airport Direct-To: keepMission creates a detour, without it the mission stays protected', async t => {
  const f = fixture(t);
  const airport = { icao: 'EDTG', name: 'Bremgarten', lat: 47.9, lon: 7.6 };
  const blocked = await f.tools.execute({ intent: 'airport_direct_to', expectedRevision: 0, payload: { airport } });
  assert.equal(blocked.error, 'mission_authority_conflict');
  f.state.connected = true;
  f.state.flight = { lat: 48.1, lon: 7.1, capturedAt: Date.now() };
  const kept = await f.tools.execute({ intent: 'airport_direct_to', expectedRevision: 0, payload: { airport, keepMission: true } });
  assert.equal(kept.ok, true);
  assert.equal(kept.navigation.detour, true);
  assert.deepEqual(kept.navigation.points.map(p => [p.lat, p.icao]), [[48.1, 'GPS'], [47.9, 'EDTG']]);
  // A second Direct-To replaces only the detour.
  const again = await f.tools.execute({ intent: 'airport_direct_to', expectedRevision: kept.navigation.revision,
    payload: { airport: { icao: 'EDTF', name: 'Freiburg', lat: 48.02, lon: 7.83 }, keepMission: true } });
  assert.equal(again.ok, true);
  assert.notEqual(again.navigation.id, kept.navigation.id);
  assert.equal(again.navigation.points[1].icao, 'EDTF');
});

test('without a mission there is no detour', async t => {
  const tools = createCockpitTools({ getRun: () => null, getFlight: () => null });
  const result = await tools.execute({ intent: 'navigation_detour_set', expectedRevision: 0, payload: { routeId: '', points: detourPoints } });
  assert.equal(result.error, 'navigation_detour_requires_mission');
});

test('inspection lock also blocks a detour', async t => {
  const f = fixture(t);
  const locked = createCockpitTools({ ...f.options, getCompliance: () => ({ selected: true, phase: 'inspectors_waiting' }) });
  const current = locked.navigation();
  const result = await locked.execute({ intent: 'navigation_detour_set', expectedRevision: current.revision, payload: { routeId: current.id, points: detourPoints } });
  assert.equal(result.error, 'navigation_mission_locked');
});

test('flight plan export sends the detour with mission identity', async t => {
  const f = fixture(t);
  const set = await setDetour(f.tools);
  const result = await f.tools.execute({ intent: 'flightplan_export', payload: { missionId: 'm', runId: 'run1', navigationRevision: set.navigation.revision } });
  assert.equal(result.ok, true);
  assert.equal(result.plan.detour, true);
  assert.equal(result.plan.missionId, 'm');
  assert.equal(result.plan.destinationIcao, 'EDTG');
  assert.equal(result.plan.points.length, 2);
  assert.throws(() => createFlightPlanExport(f.state.run(), { missionId: 'm', runId: 'run1' }, { runId: 'other', points: detourPoints }), /flightplan_route_invalid/);
});

test('relay accepts the detour intent', async t => {
  const f = fixture(t);
  let broadcasts = 0;
  const relay = createNavigationRelay(f.tools, () => broadcasts++);
  const result = await relay({ clientId: 'web', commandId: 'd1', intent: 'navigation_detour_set', expectedRevision: 0, payload: { routeId: 'run1', points: detourPoints } });
  assert.equal(result.ok, true);
  assert.equal(broadcasts, 1);
});
