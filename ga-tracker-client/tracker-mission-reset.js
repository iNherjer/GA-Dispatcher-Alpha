'use strict';

const executionCore = require('../mission-execution-core.js');

// Rebuild a planned seed from the retained order, never from a progressed replay.
// This is local Tracker state: no browser, cloud fetch or simulator write.
function plannedResetBundle(run) {
  const bundle = JSON.parse(JSON.stringify(run.resumeBundle));
  const manifest = executionCore.normalizeManifest(run.executionState?.manifest || bundle.runtime?.cargoManifest);
  for (const item of manifest.items) {
    const inherited = item.persistentEquipment === true && item.persistentEquipmentInherited === true && item.status === 'loaded';
    item.status = inherited ? 'loaded' : 'pending';
    item.loadedAt = inherited ? item.loadedAt : 0;
    item.unloadedAt = item.droppedAt = item.handedOffAt = 0;
    item.handoffComplete = false;
    item.persistentEquipmentInherited = inherited;
    item.droppedLat = item.droppedLon = item.droppedAltFt = null;
    item.unloadLat = item.unloadLon = item.unloadAltFt = null;
    item.healthPct = 100;
    item.log = {};
  }
  manifest.dispatchSignature = null;
  manifest.maxStressDamagePct = 0;
  delete manifest.flightEvents;
  bundle.runtime = {
    missionId: run.missionId,
    startPhase: 'planned',
    runtime: { missionId: run.missionId, phase: 'planned', active: false },
    cargoManifest: manifest
  };
  const missionState = bundle.missionState || {};
  for (const value of [missionState, missionState.currentMissionData, missionState.activeMissionContract,
    missionState.currentMissionData?.missionContract]) {
    if (!value || typeof value !== 'object') continue;
    value.missionResult = '';
    value.missionFailed = false;
    value.missionOutcome = value.cargoOutcome = null;
    value.poiEndedAtHome = value.poiNeedsRideHome = false;
    for (const key of ['missionCompletionState', 'missionCompletionId', 'missionCompletionRecord',
      'bushProgress', 'sarHeliProgress', 'poiChainProgress', 'complianceInspection',
      'activeMissionRuntimeMissionId', 'activeMissionRuntimeStartedAt', 'activeMissionRuntimeSavedAt', 'activeMissionRuntimePhase']) delete value[key];
    if (value.cargoManifest) value.cargoManifest = JSON.parse(JSON.stringify(manifest));
  }
  for (const passenger of [missionState.activePassenger, missionState.currentMissionData?.passenger,
    missionState.activeMissionContract?.passenger, missionState.currentMissionData?.missionContract?.passenger]) {
    if (passenger) delete passenger.poiChainProgress;
  }
  bundle.executionReplay = executionCore.createExecutionBundle(bundle);
  bundle.execution = executionCore.createReplayShadowEnvelope(bundle.executionReplay, { legacyBundle: bundle });
  return bundle;
}

module.exports = { plannedResetBundle };
