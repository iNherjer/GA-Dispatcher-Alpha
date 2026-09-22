import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../mission-fire-watch-core.js';

const frozen = fs.readFileSync(new URL('./fixtures/fire-watch-legacy-20260922.js', import.meta.url), 'utf8');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
function legacy(context, state, sample, now, operation) {
  const voices = [];
  const scenario = clone(state.scenario);
  const normalized = { ...clone(sample || {}) };
  if (normalized.alt == null && normalized.altFt != null) normalized.alt = normalized.altFt;
  const flight = { ...clone(sample || {}) };
  if (flight.mslFt == null && flight.altFt != null) flight.mslFt = flight.altFt;
  const sandbox = {
    currentMissionData: { ...(clone(context.missionData) || {}), fireScenario: scenario },
    window: { lastLiveGpsPos: normalized, lastLiveFlightData: flight, activePassenger: clone(context.passenger || null), missionRuntimeIsActive: () => context.runtimeActive !== false },
    Date: { now: () => now },
    _getDestCoords: () => clone(context.target || null),
    _poiSatisfied: state.satisfied === true, _paxAtTargetDone: state.atTargetDone === true,
    _normalizeSpokenText: text => String(text || '').trim(), _capturePoiNarrativeMemory: () => {}, _showPaxMessage: (text, label) => voices.push({ text, label }),
    _paxVoiceEnabled: false, _paxMissionEpoch: 1, _paxSpeechQueue: Promise.resolve(), _lastSpokenText: '', _lastSpokenSpeaker: null,
    saveMissionState: () => {}, debouncedSaveMissionState: () => {}, _paxLog: () => {}
  };
  sandbox.window.GAMissionBoardingVoiceCore = context.boardingVoiceCore || null;
  vm.createContext(sandbox); vm.runInContext(frozen, sandbox);
  if (operation === 'observe') sandbox._tickFireMissionSearch(flight, sample?.distNm);
  else sandbox.window[operation]();
  return { state: { scenario: clone(sandbox.currentMissionData.fireScenario), satisfied: sandbox._poiSatisfied, atTargetDone: sandbox._paxAtTargetDone }, voices, satisfied: sandbox._poiSatisfied };
}
function compare(context, state, sample, now, operation, legacyBug = false) {
  const frozenName = operation === 'observe' ? operation : ({ fire_position: 'fireMissionPositionReport', fire_no_smoke: 'fireMissionReportNoSmoke', fire_smoke_visible: 'fireMissionReportSmokeVisible' })[operation];
  const oldResult = legacy(context, state, sample, now, frozenName);
  const newResult = operation === 'observe' ? core.observe(context, state, sample, now) : core.action(context, state, operation, sample, now);
  if (legacyBug) {
    assert.deepEqual({ ...newResult.state, satisfied: false, atTargetDone: false }, oldResult.state, 'only the frozen false-alarm completion flags differ');
    assert.equal(newResult.satisfied, true);
  } else assert.deepEqual(newResult, oldResult, operation);
}
const target = { name: 'Waldstück Nord', lat: 48, lon: 8 };
const fire = { enabled: true, type: 'fire_watch', truth: 'fire', extent: 'multi_smoke', target, searchDwellSec: 180, assessmentDwellSec: 240 };
const falseAlarm = { enabled: true, type: 'fire_watch', truth: 'false_alarm', target, searchDwellSec: 180 };
const context = { target, runtimeActive: true, passenger: { targetRadiusNm: 1.5 } };
const near = { lat: 48.01, lon: 8, altFt: 2500, aglFt: 1000, hdg: 0, gsKts: 90 };
const far = { lat: 48.08, lon: 8, altFt: 2500, hdg: 0, gsKts: 90 };
const confirmEdge = { lat: 48.033, lon: 8, altFt: 2500, aglFt: 1000, hdg: 90, gsKts: 90 };
const noPosition = { altFt: 2500, hdg: 0, gsKts: 90 };
assert.equal(core.validateScenario(fire), null);
assert.equal(core.validateScenario(null), 'fire_watch_scenario_missing');
assert.equal(core.validateScenario({ enabled: true, type: 'survey' }), 'fire_watch_scenario_invalid');
assert.deepEqual(core.createState({ scenario: fire }), { scenario: fire, satisfied: false, atTargetDone: false });
assert.throws(() => core.createState({ scenario: null }), /fire_watch_scenario_missing/);
assert.throws(() => core.observe(context, { scenario: null }, near, 1000), /fire_watch_scenario_missing/);
compare(context, { scenario: fire, satisfied: false, atTargetDone: false }, far, 1000, 'observe');
compare(context, { scenario: fire, satisfied: false, atTargetDone: false }, near, 1000, 'observe');
compare(context, { scenario: fire, satisfied: false, atTargetDone: false }, near, 1000, 'fire_smoke_visible');
compare({ ...context, boardingVoiceCore: { normalizeSpokenText: text => `normalisiert: ${String(text).replace(/Zielgebiet/g, 'Gebiet')}` } }, { scenario: fire, satisfied: false, atTargetDone: false }, near, 1000, 'fire_position');
compare(context, { scenario: fire, satisfied: false, atTargetDone: false }, {}, 1000, 'fire_position');
compare(context, { scenario: fire, satisfied: false, atTargetDone: false }, far, 1000, 'fire_no_smoke');
const assessed = { ...fire, state: 'smoke_confirmed', smokeConfirmedAt: 1000, targetAreaEnteredAt: 1000 };
compare(context, { scenario: assessed, satisfied: false, atTargetDone: false }, near, 241000, 'observe');
const elapsedFalseAlarm = { ...falseAlarm, targetAreaEnteredAt: 1000 };
compare(context, { scenario: elapsedFalseAlarm, satisfied: false, atTargetDone: false }, near, 181001, 'fire_no_smoke', true);
let count = 8;
for (const truth of ['fire', 'false_alarm']) for (const stateName of [undefined, 'searching', 'reported_smoke_unconfirmed', 'smoke_confirmed', 'assessment_complete', 'false_alarm_rtb'])
for (const sample of [near, confirmEdge, far, noPosition]) for (const action of ['fire_position', 'fire_no_smoke', 'fire_smoke_visible']) {
  const scenario = { ...(truth === 'fire' ? fire : falseAlarm), ...(stateName ? { state: stateName } : {}), targetAreaEnteredAt: 1000,
    ...(stateName === 'smoke_confirmed' ? { smokeConfirmedAt: 1000 } : {}) };
  const at = action === 'fire_no_smoke' && truth === 'false_alarm' && sample === near ? 181001 : 120000;
  const legacyBug = action === 'fire_no_smoke' && truth === 'false_alarm' && sample === near
    && !['smoke_confirmed', 'assessment_complete', 'false_alarm_rtb'].includes(stateName);
  compare(context, { scenario, satisfied: false, atTargetDone: false }, sample, at, action, legacyBug);
  count++;
}
for (const elapsed of [0, 179999, 180000, 180001, 240000, 240001]) {
  const scenario = { ...fire, state: 'smoke_confirmed', smokeConfirmedAt: 1000, targetAreaEnteredAt: 1000 };
  compare(context, { scenario, satisfied: false, atTargetDone: false }, near, 1000 + elapsed, 'observe');
  count++;
}
console.log(`PASS: ${count} Fire-Watch frozen legacy differential checks across actions, states, ranges and timers; false-alarm completion fix is explicitly isolated.`);
