(function initMissionResumeAdapters(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAMissionResumeAdapters = api;
})(typeof window !== 'undefined' ? window : null, function createMissionResumeAdapters() {
  'use strict';

  const SCHEMA = 'ga.mission-resume.v2';
  const VERSION = 2;
  const PRIMARY_ADAPTERS = Object.freeze([
    'apt',
    'poi',
    'survey_pattern',
    'poi_chain',
    'training',
    'bush_pickup',
    'sar_heli'
  ]);

  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function missionDataFromState(state = null) {
    const value = object(state);
    return object(value.currentMissionData || value);
  }

  function explicitMissionMode(missionState = null) {
    const state = object(missionState);
    const mission = missionDataFromState(state);
    const contract = object(mission.missionContract || state.activeMissionContract);
    const contractV4 = object(
      mission.missionContractV4
      || mission._missionContractV4
      || contract.missionContractV4
      || contract._missionContractV4
    );
    const candidates = [
      mission.missionType,
      mission.mode,
      object(mission.missionContext).mode,
      object(object(mission.missionPlanV4).plan).missionType,
      object(object(mission.missionPlanV2).plan).missionType,
      contract.missionType,
      contract.mode,
      object(contract.route).mode,
      contractV4.mode,
      contractV4.missionType,
      object(contractV4.route).mode
    ];
    for (const value of candidates) {
      const normalized = String(value || '').trim().toLowerCase();
      if (!normalized) continue;
      if (normalized === 'poi' || /^poi[:_\s-]/.test(normalized) || normalized === 'point-of-interest') return 'poi';
      if (normalized === 'bush' || /^bush[:_\s-]/.test(normalized)) return 'bush';
      if (normalized === 'apt' || normalized === 'a-b' || normalized === 'a_b' || normalized === 'ab'
        || normalized === 'airport' || /^apt[:_\s-]/.test(normalized)) return 'apt';
    }
    return '';
  }

  function hasLegacyPoiSignal(runtimeSnapshot = null, missionState = null) {
    const runtime = object(runtimeSnapshot);
    const progress = object(runtime.poiProgress);
    const state = object(missionState);
    const mission = missionDataFromState(state);
    const contract = object(mission.missionContract || state.activeMissionContract);
    const progressed = !!(
      progress.satisfied
      || progress.aborted
      || progress.manualConfirmed
      || progress.atTargetDone
      || Number(progress.dwellSec) > 0
      || Number(progress.attempts) > 0
    );
    return !!(
      state.isPOI === true
      || mission.isPOI === true
      || mission.poiPresentation === true
      || mission.poiName
      || contract.isPOI === true
      || contract.poiPresentation === true
      || contract.poiName
      || String(mission.dest || state.currentDestICAO || '').trim().toUpperCase() === 'POI'
      || progressed
    );
  }

  function detectPrimaryAdapter(runtimeSnapshot = null, missionState = null) {
    const runtime = object(runtimeSnapshot);
    const progress = object(runtime.poiProgress);
    const mission = missionDataFromState(missionState);
    const contract = object(mission.missionContract || object(missionState).activeMissionContract);
    if (progress.sarHeli || mission.sarHeli || contract.sarHeli) return 'sar_heli';
    if (progress.surveyPattern || mission.surveyPattern || contract.surveyPattern) return 'survey_pattern';
    if (progress.poiChain || mission.poiChain || contract.poiChain) return 'poi_chain';
    if (progress.trainingProcedure || mission.trainingProcedure || contract.trainingProcedure) return 'training';
    if (runtime.bushProgress || mission.bush || mission.bushProgress || contract.bush) return 'bush_pickup';
    const explicitMode = explicitMissionMode(missionState);
    if (explicitMode === 'poi') return 'poi';
    if (explicitMode === 'bush') return 'bush_pickup';
    if (explicitMode === 'apt') return 'apt';
    if (hasLegacyPoiSignal(runtime, missionState)) return 'poi';
    return 'apt';
  }

  function detectFacets(runtimeSnapshot = null, missionState = null) {
    const runtime = object(runtimeSnapshot);
    const mission = missionDataFromState(missionState);
    const contract = object(mission.missionContract || object(missionState).activeMissionContract);
    const facets = [];
    if (runtime.cargoManifest || mission.cargoManifest || contract.cargoManifest) facets.push('cargo');
    if (runtime.complianceInspection || mission.complianceInspection || contract.complianceInspection) facets.push('compliance');
    if (runtime.flightRecorder) facets.push('flight_recorder');
    if (runtime.comfort) facets.push('passenger_comfort');
    return facets;
  }

  function createDescriptor(runtimeSnapshot = null, missionState = null) {
    const runtime = object(runtimeSnapshot);
    const missionId = String(runtime.missionId || runtime.runtime?.missionId || '').trim();
    return {
      schema: SCHEMA,
      version: VERSION,
      missionId,
      primaryAdapter: detectPrimaryAdapter(runtime, missionState),
      facets: detectFacets(runtime, missionState)
    };
  }

  function validateBundle(bundle = null) {
    const value = object(bundle);
    const runtime = object(value.runtime);
    const descriptor = object(value.descriptor);
    const missionId = String(value.missionId || descriptor.missionId || '').trim();
    const runtimeMissionId = String(runtime.missionId || runtime.runtime?.missionId || '').trim();
    const primaryAdapter = String(descriptor.primaryAdapter || value.adapter || '').trim();
    if (Number(value.version) !== VERSION) return { ok: false, error: 'resume_version_unsupported' };
    if (!missionId || !runtimeMissionId || missionId !== runtimeMissionId) return { ok: false, error: 'resume_mission_mismatch' };
    if (!value.missionState || typeof value.missionState !== 'object') return { ok: false, error: 'resume_mission_state_missing' };
    if (!PRIMARY_ADAPTERS.includes(primaryAdapter)) return { ok: false, error: 'resume_adapter_unsupported' };
    return { ok: true, missionId, primaryAdapter, facets: Array.isArray(descriptor.facets) ? descriptor.facets.slice() : [] };
  }

  return Object.freeze({
    PRIMARY_ADAPTERS,
    SCHEMA,
    VERSION,
    createDescriptor,
    detectFacets,
    explicitMissionMode,
    hasLegacyPoiSignal,
    detectPrimaryAdapter,
    validateBundle
  });
});
