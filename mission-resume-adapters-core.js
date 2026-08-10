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
    if (runtime.poiProgress || mission.isPOI || mission.poiName || mission.targetName) return 'poi';
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
    detectPrimaryAdapter,
    validateBundle
  });
});
