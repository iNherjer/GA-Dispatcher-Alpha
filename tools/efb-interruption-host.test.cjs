// EFB/toolbar host behaviour for an interrupted tracker run.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const uiCore = require('../ga-tracker-client/mission-control-ui-core.js');

const host = fs.readFileSync(path.join(__dirname, '..', 'ga-tracker-client', 'tracker-efb-kartentisch-host.js'), 'utf8');
const between = (start, end) => {
  const a = host.indexOf(start), b = host.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, start);
  return host.slice(a, b);
};

function sandbox() {
  const timers = [];
  const reports = [];
  const context = {
    Date, Math, JSON, Array, Object, String, isFinite,
    window: { GAMissionControlUiCore: uiCore },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {},
    flight: null,
    missionSnapshot: null,
    missionPresentationSignature: 'x',
    renderMissionPayload: () => { context.rerenders += 1; },
    report: (...args) => reports.push(args),
    rerenders: 0, timers, reports
  };
  vm.createContext(context);
  vm.runInContext(between('  var interruptionRecheckTimer = null;', '  function missionRenderSignature(payload) {'), context);
  vm.runInContext(between('  function missionActionBannerModel(payload) {', '  function setupMissionActionBanner() {'), context);
  vm.runInContext('this.api = { interruptionView, missionActionBannerModel, trackInterruptionResume };', context);
  return context;
}

const control = (interruption, allowedActions) => ({ executionAuthority: 'tracker', missionId: 'm', runId: 'r', phase: 'enroute',
  flags: { active: true }, allowedActions, interruption });
const payload = (ctl, extra = {}) => ({ available: true, missionId: 'm', runId: 'r', control: ctl, ...extra });
const zone = { lat: 48.02, lon: 7.83, radiusNm: 5, airborne: true };

test('EFB banner shows the interruption choice and blocks a cloud mission replacement', () => {
  const c = sandbox();
  const interrupted = payload(control({ status: 'awaiting_decision', since: Date.now() - 30000, zone }, ['abort_mission', 'resume_mission']),
    { authoritySnapshot: { pendingCloudMission: { missionId: 'new', title: 'Neue Mission' } } });
  const model = c.api.missionActionBannerModel(interrupted);
  assert.equal(model.kind, 'intent');
  assert.equal(model.intent, 'resume_mission');
  assert.equal(model.button, 'Mission fortsetzen');
  assert.equal(model.className, 'is-interrupted');
  assert.match(model.text, /Szenen und Zuladung im laufenden Cockpit/, 'the EFB runs inside the simulator');
  assert.equal(model.interruption.resetAvailable, true);
  assert.equal(c.window.gaTrackerMissionInterrupted(), false, 'helpers read the current snapshot');
  c.missionSnapshot = interrupted;
  assert.equal(c.window.gaTrackerMissionInterrupted(), true);
  assert.equal(c.window.gaTrackerInterruptionModel().status, 'awaiting_decision');
});

test('EFB stays silent during the display delay and re-checks afterwards', () => {
  const c = sandbox();
  const model = c.api.missionActionBannerModel(payload(control({ status: 'awaiting_decision', since: Date.now() - 2000, zone }, ['abort_mission', 'resume_mission'])));
  assert.equal(model, null);
  assert.equal(c.timers.length, 1);
  assert.ok(c.timers[0].ms > 12000 && c.timers[0].ms <= 13100);
  c.timers[0].fn();
  assert.equal(c.rerenders, 1);
  assert.equal(c.missionPresentationSignature, '', 'forces a fresh presentation');
});

test('EFB zone guidance offers the teleport and live distance', () => {
  const c = sandbox();
  c.flight = { lat: 48.28, lon: 8.43 };
  const model = c.api.missionActionBannerModel(payload(control({ status: 'awaiting_zone', since: Date.now() - 90000, zone }, ['abort_mission', 'resume_teleport'])));
  assert.equal(model.intent, 'resume_teleport');
  assert.match(model.text, /Noch 28,\d NM, Kurs 23\d°/);
});

test('EFB announces the resume once when the tracker clears the record on the same run', () => {
  const c = sandbox();
  const interrupted = payload(control({ status: 'awaiting_zone', since: Date.now() - 90000, zone }, ['abort_mission']));
  assert.equal(c.api.trackInterruptionResume(interrupted).status, 'awaiting_zone');
  const resumed = payload(control(null, ['abort_mission', 'pax_wellbeing']));
  assert.equal(c.api.trackInterruptionResume(resumed), null);
  const notice = c.api.missionActionBannerModel(resumed);
  assert.equal(notice.kicker, 'Mission wieder aufgenommen');
  assert.equal(notice.buttonHidden, true);
  assert.equal(c.reports.filter(entry => entry[1] === 'mission-interruption').length, 1);
  // An aborted/closed run is not announced as resumed.
  const d = sandbox();
  d.api.trackInterruptionResume(interrupted);
  d.api.trackInterruptionResume(payload({ ...control(null, []), phase: 'closed', flags: { closed: true } }));
  assert.equal(d.reports.length, 0);
});

test('EFB render wiring keeps mission windows, reminders and the manual flight plan away while interrupted', () => {
  const render = between('  function renderMissionPayload(payload) {', '  function renderChecklistPayload(payload) {');
  assert.match(render, /var interruptionNow = trackInterruptionResume\(next\);/);
  assert.match(render, /var openBoardingDialog = !interruptionNow &&/);
  assert.match(render, /if \(interruptionNow\) \{[\s\S]*?closeCargoManager\(true\)/);
  assert.match(render, /if \(!interruptionNow\) renderBoardBookReminder\(nextControl\);/);
  assert.match(render, /MissionResumeZoneMap\.render\(map, window\.L, window\.MissionResumeZoneMap\.fromControl\(nextControl\)\)/);
  assert.match(between('  function flightPlanTransferMarkup() {', '  function transferCurrentMissionFlightPlan('), /if \(interruptionView\(missionSnapshot\)\) return '';/);
  assert.match(between('  function offerCloudMissionReplacement(payload, force) {', '  function renderDebrief('), /if \(interruptionView\(payload\)\) return;/);
  const banner = between('  function renderMissionActionBanner(payload) {', '  function updateMissionLiveFields(');
  assert.match(banner, /var planning = interrupted \? null : preflightPlanningModel\(payload, true\);/);
  for (const label of ['Restroute an Avionik senden', 'Mission neustarten', 'Mission abbrechen']) assert.ok(banner.includes(label), label);
});
