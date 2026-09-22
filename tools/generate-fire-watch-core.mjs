import fs from 'node:fs';
import { extractOriginalFunction } from './extract-original-function.mjs';

const sourcePath = new URL('../passenger-voice.js', import.meta.url);
const targetPath = new URL('../mission-fire-watch-core.js', import.meta.url);
const source = fs.readFileSync(sourcePath, 'utf8');
const helperNames = [
  '_normalizeSpokenTextLegacy', '_normalizeSpokenText', '_bearingDeg', '_relativeClockPos', '_haversineNm',
  '_fireScenario', '_fireMissionRuntimeActive', '_fireTarget', '_fireRound',
  '_fireMissionContext', '_fireVectorLine', '_fireShortVector', '_fireDistanceSpeak',
  '_fireBearingSpeak', '_fireSmokeSourceCount', '_fireAssessmentText', '_fireReturnClearanceText',
  '_fireRemainingSearchText', '_fireRecordObservation', '_fireMissionAwarenessTick',
  '_fireHasObservation', '_tickFireMissionSearch'
];
const actionNames = ['fireMissionPositionReport', 'fireMissionReportNoSmoke', 'fireMissionReportSmokeVisible'];
const extract = name => extractOriginalFunction(source, name);
const extractAction = name => {
  const needle = `window.${name} = function()`;
  const start = source.indexOf(needle);
  if (start < 0) throw new Error(`Missing original action: ${name}`);
  const converted = (source.slice(0, start) + `function ${name}()` + source.slice(start + needle.length))
    .replace(/\n    if \(window\.gaTrackerExecutionHandlesMission\?\.\(\)\) return window\.gaTrackerExecutionSubmitIntent\?\.\('[^']+'\);/g, '');
  return extractOriginalFunction(converted, name);
};
const original = helperNames.map(extract).concat(actionNames.map(extractAction)).join('\n\n');
const output = `// Generated from the Fire-Watch functions in passenger-voice.js by tools/generate-fire-watch-core.mjs.
// Do not edit by hand. passenger-voice.js remains the legacy behavioral reference.
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAMissionFireWatchCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
'use strict';
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
function validateScenario(scenario) {
  if (scenario == null) return 'fire_watch_scenario_missing';
  if (typeof scenario !== 'object' || Array.isArray(scenario) || scenario.enabled !== true || scenario.type !== 'fire_watch') return 'fire_watch_scenario_invalid';
  return null;
}
function createState(context = {}, previous = null) {
  const scenario = clone(previous?.scenario ?? context.scenario ?? null);
  const error = validateScenario(scenario);
  if (error) throw new TypeError(error);
  return { scenario, satisfied: previous?.satisfied === true, atTargetDone: previous?.atTargetDone === true };
}
function run(context = {}, inputState = {}, sample = {}, now = Date.now(), operation = 'observe') {
  const voices = [];
  const initial = createState(context, inputState);
  let _poiSatisfied = initial.satisfied, _paxAtTargetDone = initial.atTargetDone;
  let currentMissionData = clone(context.missionData || {});
  const inherited = initial.scenario;
  currentMissionData.fireScenario = clone(inherited);
  const normalizedSample = { ...(sample?.position || sample || {}) };
  if (normalizedSample.alt == null && normalizedSample.altFt != null) normalizedSample.alt = normalizedSample.altFt;
  const normalizedFlight = { ...(sample?.flight || sample || {}) };
  if (normalizedFlight.mslFt == null && normalizedFlight.altFt != null) normalizedFlight.mslFt = normalizedFlight.altFt;
  const window = {
    lastLiveGpsPos: clone(normalizedSample), lastLiveFlightData: clone(normalizedFlight),
    activePassenger: clone(context.passenger || null),
    missionRuntimeIsActive: () => context.runtimeActive !== false
  };
  const Date = { now: () => Number(now) };
  const _getDestCoords = () => clone(context.target || null);
  window.GAMissionBoardingVoiceCore = context.boardingVoiceCore || null;
  const _firePersistState = () => {};
  const _fireSpeakText = (text, label = 'Feuerwache') => { const clean = _normalizeSpokenText(text); if (clean) voices.push({ text: String(clean), label: String(label) }); };
${original}
  if (operation === 'observe') _tickFireMissionSearch(window.lastLiveFlightData, sample?.distNm);
  else if (operation === 'fire_position') fireMissionPositionReport();
  else if (operation === 'fire_no_smoke') fireMissionReportNoSmoke();
  else if (operation === 'fire_smoke_visible') fireMissionReportSmokeVisible();
  else throw new TypeError('fire_watch_action_invalid');
  const state = { scenario: clone(currentMissionData.fireScenario), satisfied: _poiSatisfied, atTargetDone: _paxAtTargetDone };
  return { state, voices, satisfied: state.satisfied };
}
function observe(context, state, sample, now) { return run(context, state, sample, now, 'observe'); }
function action(context, state, actionName, sample, now) { return run(context, state, sample, now, String(actionName || '')); }
return Object.freeze({ observe, action, createState, validateScenario });
});
`;
if (process.argv.includes('--check')) {
  if (!fs.existsSync(targetPath) || fs.readFileSync(targetPath, 'utf8') !== output) throw new Error('mission-fire-watch-core.js drifted from passenger-voice.js');
} else fs.writeFileSync(targetPath, output);
