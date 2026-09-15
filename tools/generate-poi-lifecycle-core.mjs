import { extractOriginalFunction } from './extract-original-function.mjs';
import fs from 'node:fs';
const sources = ['mission-runtime-core.js', 'sync.js', 'mission-cargo-core.js'].map(file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'));
const names = ['_missionEndReadiness', '_missionPoiGroundEndReady', '_missionPoiEndedAtHome',
  '_missionHasReachedEndEligibleFlightPhase', '_isAtMissionHome', '_missionOutcomeApplyPoiProgress', '_missionPoiRuntimeStatus'];
const extract = name => extractOriginalFunction(sources.find(source => source.includes(`function ${name}(`)), name);
const output = `// Generated from the original App lifecycle functions. Do not edit by hand.
(function(root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./mission-location-core.js') : root.GAMissionLocationCore);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAMissionPoiLifecycleCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(locationCore) {
'use strict';
const SCHEMA = 'ga.mission-poi-lifecycle.v1';
function evaluate(recipe, progress = {}, recorder = {}, sample = {}, outcome = null) {
  const currentMissionData = { missionContract: { taskDomain: recipe.taskDomain } };
  const flightRecorder = recorder;
  const window = { lastLiveFlightData: sample, lastLiveGpsPos: sample,
    GAMissionLocationCore: locationCore, activePassenger: { ...recipe.passenger, taskDomain: recipe.taskDomain },
    missionPoiRecipeId: () => recipe.passenger.targetDwellMin === 0 ? 'poi_flyover' : 'poi_on_task' };
  const _missionSceneIsPoiMission = () => true;
  const _missionSceneIsBushMission = () => false;
  const _missionSceneIsSarHeliMission = () => false;
  const _missionPoiProgressState = () => ({ hasSignal: true, trackingActive: recipe.trackingActive, ...progress });
  const _aptArrivalPointForRuntime = () => null;
  const _missionBushReturnHomeRuntimePoint = () => null;
  const _targetPointForMission = () => recipe.target;
  const _distanceToMissionHomeNm = (lat, lon) => locationCore.haversineNm(lat, lon, recipe.home.lat, recipe.home.lon);
${names.map(extract).join('\n\n')}
  const readiness = _missionEndReadiness();
  const canEndHere = _missionPoiGroundEndReady(readiness);
  const endedAtHome = _missionPoiEndedAtHome(readiness);
  const needsRideHome = canEndHere && !endedAtHome;
  return { readiness, flightEligible: _missionHasReachedEndEligibleFlightPhase(), canEndHere: readiness.ready || canEndHere, endedAtHome, needsRideHome,
    status: _missionPoiRuntimeStatus(readiness),
    outcome: _missionOutcomeApplyPoiProgress(outcome, { endedAtHome, needsRideHome }) };
}
function applyStress(manifest, recorder = {}, sample = {}, record = null, motionProtectionEnabled = false) {
  const copy = JSON.parse(JSON.stringify(manifest));
  const flightRecorder = recorder;
  const window = { lastLiveFlightData: sample };
  const _missionDebugMotionProtectionEnabled = () => motionProtectionEnabled;
  const _missionCargoEnsureManifest = () => copy;
  const _missionCargoPersistManifest = () => {};
${['_missionCargoStressDamage', '_missionCargoApplyStressSnapshot'].map(extract).join('\n\n')}
  return _missionCargoApplyStressSnapshot(record);
}
return Object.freeze({ SCHEMA, evaluate, applyStress });
});
`;
const target = new URL('../mission-poi-lifecycle-core.js', import.meta.url);
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8') !== output) throw new Error('POI lifecycle core drifted from App source');
} else fs.writeFileSync(target, output);
