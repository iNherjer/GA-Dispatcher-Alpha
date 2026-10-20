// Web app behaviour for an interrupted tracker run (simulator closed, tracker restarted or offline).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'sync.js'), 'utf8');
const uiCore = require('../ga-tracker-client/mission-control-ui-core.js');

function slice(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(end > start, endMarker);
  return source.slice(start, end);
}

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf('\n}\n', start) + 3);
}

function sandbox(storage = new Map()) {
  const debug = [];
  const elements = new Map();
  const timers = [];
  const zoneRenders = [];
  const context = {
    console, JSON, Array, String, Number, Date, Math, Boolean,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    localStorage: {
      getItem: key => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    document: { getElementById: id => elements.get(id) || null },
    _missionPhaseDebugPush: (name, detail) => debug.push({ name, detail }),
    _updateMissionRuntimeUi: () => { context.uiUpdates += 1; },
    GAMissionControlUiCore: uiCore,
    MissionResumeZoneMap: { render: (map, L, zone) => zoneRenders.push(zone) },
    map: {},
    L: {},
    uiUpdates: 0,
    lastTrackerDisconnectAt: 0,
    missionExecutionIntentPromise: null,
    debug, elements, storage, timers, zoneRenders
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(slice('const TRACKER_CARGO_AUTO_OPENED_RUNS_KEY', 'function _applyTrackerExecutionControl('), context);
  vm.runInContext(functionSource('_rememberTrackerTelemetryMode'), context);
  vm.runInContext(functionSource('_trackerMissionBannerModel'), context);
  vm.runInContext(`this.api = { _trackerSimulatorDisconnected, _trackerMissionInterrupted, _trackerInterruptionView,
    _syncTrackerMissionInterruption, _rememberTrackerTelemetryMode, _trackerMissionBannerModel, _trackerCargoAutoOpenedRuns,
    setDisconnectAt: value => { lastTrackerDisconnectAt = value; } };`, context);
  return context;
}

const boardingControl = (interruption = null, over = {}) => ({
  executionAuthority: 'tracker',
  missionId: 'mission-a',
  runId: 'run-a',
  phase: 'boarding',
  authorityRevision: 33,
  allowedActions: interruption ? uiCore.interruptionModel ? ['abort_mission', 'resume_mission'] : [] : ['abort_mission', 'set_manifest_item'],
  flags: {},
  interruption,
  ...over
});
const record = (status, sinceAgoMs, zone = { lat: 48.2, lon: 8.4, radiusNm: 1, airborne: false }) => ({
  status, since: Date.now() - sinceAgoMs, zone, cause: 'simulator_disconnected' });

function connect(context, telemetry = { telemetryMode: 'active' }) {
  context.liveTrackerConnected = true;
  context.api._rememberTrackerTelemetryMode(telemetry);
}

test('the tracker record drives the interruption; started runs only', () => {
  const c = sandbox();
  connect(c);
  assert.equal(c.api._trackerMissionInterrupted(boardingControl()), false);
  const control = boardingControl(record('awaiting_decision', 30000));
  assert.equal(c.api._trackerMissionInterrupted(control), true);
  const view = c.api._trackerInterruptionView(control);
  assert.equal(view.status, 'awaiting_decision');
  assert.equal(view.visible, true);
  assert.deepEqual(JSON.parse(JSON.stringify(view.primary)), { intent: 'resume_mission', label: 'Mission fortsetzen' });
  // Fallback for trackers without a record: closed simulator, link state only.
  c.api._rememberTrackerTelemetryMode({ telemetryMode: 'hibernate', telemetryHibernateReason: 'sim_disconnected', telemetryModeSince: Date.now() - 20000 });
  const fallback = c.api._trackerInterruptionView(boardingControl());
  assert.equal(fallback.status, 'simulator_disconnected');
  assert.equal(fallback.resetAvailable, true);
  c.api._rememberTrackerTelemetryMode({ telemetryMode: 'hibernate', telemetryHibernateReason: 'menu_zero' });
  assert.equal(c.api._trackerMissionInterrupted(boardingControl()), false, 'world map / menu is not an interruption');
  for (const phase of ['planned', 'closed']) {
    c.api._rememberTrackerTelemetryMode({ telemetryMode: 'hibernate', telemetryHibernateReason: 'sim_disconnected' });
    assert.equal(c.api._trackerMissionInterrupted(boardingControl(null, { phase })), false, phase);
  }
  assert.equal(c.api._trackerMissionInterrupted(boardingControl(null, { executionAuthority: 'web' })), false);
});

test('tracker offline shows its own hint after the display delay', () => {
  const c = sandbox();
  c.liveTrackerConnected = false;
  c.api.setDisconnectAt(Date.now() - 2000);
  const early = c.api._trackerInterruptionView(boardingControl());
  assert.equal(early.status, 'tracker_offline');
  assert.equal(early.visible, false, 'relay switches do not flash the banner');
  assert.equal(c.api._trackerMissionBannerModel(boardingControl()), null);
  c.api.setDisconnectAt(Date.now() - 20000);
  const banner = c.api._trackerMissionBannerModel(boardingControl());
  assert.equal(banner.kicker, 'Tracker getrennt');
  assert.match(banner.text, /Tracker starten/);
  assert.equal(banner.buttonHidden, true);
  assert.equal(banner.secondary, null, 'no reset without the tracker');
});

test('banner offers resume with reset as the alternative, then waiting and zone guidance', () => {
  const c = sandbox();
  connect(c, { telemetryMode: 'hibernate', telemetryHibernateReason: 'sim_disconnected', telemetryModeSince: Date.now() - 30000 });
  const decision = c.api._trackerMissionBannerModel(boardingControl(record('awaiting_decision', 30000)));
  assert.equal(decision.kind, 'intent');
  assert.equal(decision.intent, 'resume_mission');
  assert.equal(decision.button, 'Mission fortsetzen');
  assert.deepEqual(JSON.parse(JSON.stringify(decision.secondary)), { action: 'reset', label: 'Mission zurücksetzen' });
  assert.equal(decision.className, 'is-interrupted');
  assert.match(decision.text, /MSFS starten und einen Flug laden/);
  assert.match(decision.text, /Alternativ die Mission zurücksetzen/);

  const fresh = c.api._trackerMissionBannerModel(boardingControl(record('awaiting_decision', 1000)));
  assert.equal(fresh, null, 'short gaps stay silent');
  assert.ok(c.timers.some(timer => timer.ms > 13000 && timer.ms <= 15050), 'and re-check after the delay');

  connect(c);
  const waiting = c.api._trackerMissionBannerModel(boardingControl(record('resuming', 60000), { allowedActions: ['abort_mission'] }));
  assert.equal(waiting.kind, 'interruption');
  assert.equal(waiting.buttonHidden, true);
  assert.match(waiting.text, /nicht in der Weltkarte/);

  c.lastLiveGpsPos = { lat: 49.2, lon: 8.4 };
  const zone = c.api._trackerMissionBannerModel(boardingControl(record('awaiting_zone', 90000,
    { lat: 48.2, lon: 8.4, radiusNm: 5, airborne: true }), { phase: 'enroute', allowedActions: ['abort_mission', 'resume_teleport'] }));
  assert.equal(zone.intent, 'resume_teleport');
  assert.equal(zone.button, 'An Unterbrechungspunkt versetzen');
  assert.match(zone.text, /Noch 60,\d NM, Kurs 180°/);
});

test('zone is drawn while interrupted, removed on resume, and the resume is announced once', () => {
  const c = sandbox();
  connect(c);
  let closed = 0;
  c.elements.set('missionCargoOverlay', { style: { display: 'flex' } });
  c.closeMissionCargoDialog = options => { closed += 1; assert.equal(options.trackerProjection, true, 'local close sends no tracker intent'); };
  const airZone = { lat: 48.2, lon: 8.4, radiusNm: 5, airborne: true };
  c.gaTrackerExecutionControl = boardingControl(record('awaiting_zone', 90000, airZone), { phase: 'enroute', allowedActions: ['abort_mission'] });
  assert.equal(c.api._syncTrackerMissionInterruption('test'), true);
  assert.equal(closed, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(c.zoneRenders.at(-1))), airZone);
  const updates = c.uiUpdates;
  c.api._syncTrackerMissionInterruption('test');
  assert.equal(c.uiUpdates, updates, 'unchanged state does not repeat');
  assert.equal(closed, 1);

  c.gaTrackerExecutionControl = boardingControl(null, { phase: 'enroute', allowedActions: ['abort_mission'] });
  assert.equal(c.api._syncTrackerMissionInterruption('test'), false);
  assert.equal(c.zoneRenders.at(-1), null, 'zone removed when the tracker clears the interruption');
  const notice = c.api._trackerMissionBannerModel(c.gaTrackerExecutionControl);
  assert.equal(notice.kicker, 'Mission wieder aufgenommen');
  assert.equal(notice.kind, 'notice');
  assert.deepEqual(c.debug.map(entry => entry.detail.status), ['awaiting_zone', null]);
});

test('loading dialog presentation history survives a reload', () => {
  const storage = new Map();
  const first = sandbox(storage);
  assert.equal(first.gaRememberTrackerCargoAutoOpenedRun('mission-a:run-a'), true);
  assert.equal(first.gaRememberTrackerCargoAutoOpenedRun('mission-a:run-a'), false);
  assert.equal(first.gaRememberTrackerCargoAutoOpenedRun(''), false);
  const reloaded = sandbox(storage);
  assert.deepEqual(Array.from(reloaded.api._trackerCargoAutoOpenedRuns()), ['mission-a:run-a']);
  for (let i = 0; i < 40; i += 1) reloaded.gaRememberTrackerCargoAutoOpenedRun(`m:${i}`);
  assert.equal(reloaded.api._trackerCargoAutoOpenedRuns().length, 32);
  storage.set('ga_tracker_cargo_auto_opened_runs_v1', '{broken');
  assert.deepEqual(Array.from(sandbox(storage).api._trackerCargoAutoOpenedRuns()), []);
});

test('projection wiring keeps automatic dialogs and reminders off while interrupted', () => {
  const apply = functionSource('_applyTrackerExecutionControl');
  assert.match(apply, /const simulatorInterrupted = _trackerMissionInterrupted\(control\);/);
  assert.match(apply, /const openBoardingDialog = !simulatorInterrupted &&/);
  assert.match(apply, /if \(!simulatorInterrupted\) \{\s*try \{ window\.missionCargoApplyTrackerFlightReminders/);
  assert.match(apply, /interruption: control\.interruption \|\| null/, 'interruption changes are never swallowed by the fast path');
  assert.match(apply, /_syncTrackerMissionInterruption\(reason\)/);
  const statusIndex = source.indexOf('if (data.trackerStatusOnly === true && data.source === \'tracker\' && data.telemetryMode)');
  const authorityIndex = source.indexOf('_handleTrackerMissionAuthoritySnapshot(data.trackerMissionAuthority, source);');
  assert.ok(statusIndex > 0 && statusIndex < authorityIndex, 'simulator state is applied before the mission projection');
  assert.match(source, /window\.handleMissionStartBannerSecondaryAction = async function/);
});

test('a tracker-run mission is remembered across reloads and never shows local execution meanwhile', () => {
  const storage = new Map();
  const first = sandbox(storage);
  first._normalizeMissionRuntimeId = value => String(value || '');
  first._activeMissionRuntimeId = () => 'mission-a';
  vm.runInContext('_rememberTrackerExecutionRun({ executionAuthority: "tracker", missionId: "mission-a", runId: "run-a" });', first);
  assert.equal(JSON.parse(storage.get('ga_tracker_execution_run_v1')).runId, 'run-a');

  // Reload before the tracker sent its projection.
  const reloaded = sandbox(storage);
  reloaded._activeMissionRuntimeId = () => 'mission-a';
  assert.equal(reloaded.gaMissionAwaitsTrackerProjection(), true);
  reloaded.simModeActive = true;
  assert.equal(reloaded.gaMissionAwaitsTrackerProjection(), false, 'sim mode keeps its own local runtime');
  reloaded.simModeActive = false;
  reloaded.gaTrackerExecutionControl = boardingControl();
  assert.equal(reloaded.gaMissionAwaitsTrackerProjection(), false, 'the tracker projection takes over');
  reloaded.gaTrackerExecutionControl = null;
  reloaded._activeMissionRuntimeId = () => 'another-mission';
  assert.equal(reloaded.gaMissionAwaitsTrackerProjection(), false, 'a newly generated mission is not affected');
  vm.runInContext('_forgetTrackerExecutionRun();', reloaded);
  assert.equal(storage.has('ga_tracker_execution_run_v1'), false);
});

test('outside the simulator mode a mission never starts locally', () => {
  const c = sandbox();
  const alerts = [];
  c.alert = text => alerts.push(text);
  c._activeMissionRuntimeId = () => 'mission-a';
  c._trackerSupportsMissionIntents = () => false;
  let trackerAuthority = false;
  c._missionExecutionAuthorityIsTracker = () => trackerAuthority;
  vm.runInContext(functionSource('_missionLocalExecutionBlocked'), c);
  assert.equal(c._missionLocalExecutionBlocked('prepare'), true);
  assert.match(alerts.at(-1), /Missionen werden vom Tracker ausgeführt/);
  assert.equal(c.debug.at(-1).name, 'mission_local_execution_blocked');
  c.simModeActive = true;
  assert.equal(c._missionLocalExecutionBlocked('prepare'), false, 'sim mode stays local');
  c.simModeActive = false;
  trackerAuthority = true;
  assert.equal(c._missionLocalExecutionBlocked('prepare'), false, 'tracker-run missions use their intents');
  const wiring = ['window.startMissionBoarding = async function', 'window.manualMissionStart = function'];
  for (const marker of wiring) {
    const start = source.indexOf(marker);
    assert.ok(source.slice(start, start + 2500).includes('_missionLocalExecutionBlocked('), marker);
  }
  assert.match(source, /if \(_missionLocalExecutionBlocked\('prepare'\)\) return false;/);
  const cargo = fs.readFileSync(path.join(__dirname, '..', 'mission-cargo-core.js'), 'utf8');
  assert.match(cargo, /window\.openMissionCargoDialog = function\(mode = 'load', options = \{\}\) \{\n\s*\/\/[^\n]*\n\s*if \(window\.gaMissionAwaitsTrackerProjection\?\.\(\)\) return false;/);
});
