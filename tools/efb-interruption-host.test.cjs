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

test('reset and abort from the interruption banner always ask first', () => {
  const banner = between('  function renderMissionActionBanner(payload) {', '  function updateMissionLiveFields(');
  assert.match(banner, /id: 'restart', label: 'Mission neustarten', run: function \(\) \{ return window\.requestMissionRuntimeReset\(/,
    'restart uses the existing EFB confirmation dialog');
  assert.match(banner, /id: 'abort', label: 'Mission abbrechen', run: function \(\) \{\s*if \(!window\.confirm\(window\.GAMissionControlUiCore\.abortConfirmation\(\)\)\) return false;/);
  const reset = between('    window.requestMissionRuntimeReset = function (options) {', '    window.handleMissionStartBannerAction = function () {');
  assert.match(reset, /gaEfbResetConfirm/);
  assert.match(reset, /if \(!accepted \|\| !current/);
  const web = fs.readFileSync(path.join(__dirname, '..', 'sync.js'), 'utf8');
  const secondary = web.slice(web.indexOf('window.handleMissionStartBannerSecondaryAction = async function'), web.indexOf('window.handleMissionStartBannerAction = async function'));
  assert.match(secondary, /window\.requestMissionRuntimeReset\?\.\(\{ reason: 'mission-reset-interrupted' \}\)/);
  assert.doesNotMatch(secondary, /skipConfirm/, 'the web reset keeps its critical-action confirmation');
  const abort = web.slice(web.indexOf('window.gaAbortTrackerMission = '), web.indexOf('window.requestMissionRuntimeReset = async function'));
  assert.match(abort, /options\.skipConfirm !== true && !_confirmMissionCriticalAction\(options\.confirmAction \|\| 'abort', options\)/);
});

test('the World Map keeps the flight planning ("Flugsicherung") before and after the decision; avionics only in the cockpit', () => {
  const banner = between('  function renderMissionActionBanner(payload) {', '  function updateMissionLiveFields(');
  assert.match(banner, /var cockpitRunning = !!\(interruptionReadiness && interruptionReadiness\.worldReady === true\) \|\| liveFlying;/);
  assert.match(banner, /var liveFlying = !!\(flight && Date\.now\(\) - flight\.capturedAt <= 5000 && flight\.onGround === false && flight\.gsKts >= 40\);/,
    'a lagging readiness projection does not keep the World Map send in the flying cockpit');
  assert.match(host, /if \(startAt && target === 'atc'\) exportPayload\.airStart = true;/);
  assert.match(banner, /if \(!arrivalZone && !cockpitRunning && Date\.now\(\) < flightPlanAtcReadyUntil\) \{/, 'no decision-status gate');
  assert.match(banner, /if \(!arrivalZone && cockpitRunning && interruptionModel\.status !== 'awaiting_decision'/);
  assert.ok(banner.includes("'Flugplan an Flugsicherung senden'"));
  // Directly in the resume prompt: first, primary, and it resumes before sending.
  assert.match(banner, /label: \(decide \? 'Mission fortsetzen und ' : ''\)/);
  assert.match(banner, /submitMissionIntent\('resume_mission', \{ reason: 'efb-interruption-resume-atc' \}\)\)\.then\(function \(result\) \{\s*return result === true \? transferResumeFlightPlan\('atc', true\) : false;/);
  assert.match(banner, /interruptionButtons\.sort\(/);
  assert.match(banner, /entry\.primary \? 'mission-start-banner-btn' : 'mission-start-banner-btn is-secondary'/);
  assert.match(host, /pending\.trigger === 'interruption-resume'[\s\S]{0,200}die Mission wird im Cockpit fortgesetzt/);
});
