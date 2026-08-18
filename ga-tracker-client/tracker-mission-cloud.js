'use strict';

const executionCore = require('../mission-execution-core.js');
const resumeAdapters = require('../mission-resume-adapters-core.js');
const { DEFAULT_SYNC_BASE_URL, getJson, syncUrl } = require('./tracker-efb-checklist-cloud.js');

const CLOUD_MISSION_SEED_SCHEMA = 'ga.tracker-cloud-mission-seed.v1';
const CLOUD_MISSION_PENDING_RUN_ID = 'cloud-pending';
const MAX_PROFILE_RESPONSE_BYTES = 384 * 1024;

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cleanString(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

function missionDataFromState(state = null) {
  const source = object(state);
  return object(source.currentMissionData || source);
}

function missionIdentityValues(state = null) {
  const source = object(state);
  const mission = missionDataFromState(source);
  const contract = object(source.activeMissionContract || mission.missionContract);
  return [
    source.missionId,
    source.missionKey,
    source.id,
    mission.missionId,
    mission.missionKey,
    mission.id,
    contract.missionId,
    contract.missionKey,
    contract.id
  ].map(value => cleanString(value).toLowerCase()).filter(Boolean);
}

function missionTitle(state = null, missionId = '') {
  const source = object(state);
  const mission = missionDataFromState(source);
  const contract = object(source.activeMissionContract || mission.missionContract);
  return cleanString(
    mission.missionTitle || mission.mission || mission.title || mission.name
      || contract.missionTitle || contract.title || missionId || 'Cloud-Mission',
    150
  );
}

function initialCargoManifest(state = null, seed = null) {
  const source = object(state);
  const mission = missionDataFromState(source);
  const contract = object(source.activeMissionContract || mission.missionContract);
  return clone(
    object(seed).initialCargoManifest
      || source.cargoManifest
      || mission.cargoManifest
      || contract.cargoManifest
      || null
  );
}

function plannedRuntime(missionId, state, seed) {
  return {
    version: 1,
    missionId,
    startedAt: 0,
    savedAt: Math.max(0, Number(object(seed).updatedAt) || 0),
    reason: 'tracker-cloud-activation',
    startPhase: 'planned',
    runtime: {
      missionId,
      phase: 'planned',
      startedAt: 0,
      active: false,
      manual: false,
      armed: false,
      closingPending: false,
      closingReason: ''
    },
    cargoManifest: initialCargoManifest(state, seed),
    complianceInspection: null,
    poiProgress: null,
    bushProgress: null,
    flightRecorder: null
  };
}

function buildCloudMissionCandidate(profile = null) {
  const source = object(profile);
  const state = object(source.activeMission);
  const seed = object(source.activeMissionTrackerSeed);
  if (!Object.keys(state).length || seed.schema !== CLOUD_MISSION_SEED_SCHEMA || Number(seed.version) !== 1) {
    return { ok: true, status: 'empty', candidate: null };
  }
  const missionId = cleanString(seed.missionId);
  if (!missionId || !missionIdentityValues(state).includes(missionId.toLowerCase())) {
    return { ok: false, status: 'invalid', code: 'cloud_mission_identity_mismatch', candidate: null };
  }
  const runtime = plannedRuntime(missionId, state, seed);
  const adapter = cleanString(seed.adapter, 80).toLowerCase()
    || resumeAdapters.detectPrimaryAdapter(runtime, state);
  if (adapter !== 'apt') {
    return { ok: false, status: 'unsupported', code: 'cloud_mission_recipe_not_enabled', candidate: null };
  }
  const descriptor = object(seed.descriptor).missionId
    ? clone(seed.descriptor)
    : resumeAdapters.createDescriptor(runtime, state);
  const bundle = {
    version: 2,
    missionId,
    adapter,
    descriptor,
    savedAt: Math.max(0, Number(seed.updatedAt) || Number(source.lastModified) || 0),
    mapProfile: seed.mapProfile ? clone(seed.mapProfile) : null,
    efbMission: seed.efbMission ? clone(seed.efbMission) : null,
    missionState: clone(state),
    runtime,
    executionEffectPlan: seed.executionEffectPlan ? clone(seed.executionEffectPlan) : null
  };
  const validation = resumeAdapters.validateBundle(bundle);
  if (!validation.ok) {
    return { ok: false, status: 'invalid', code: validation.error || 'cloud_mission_bundle_invalid', candidate: null };
  }
  if (object(bundle.executionEffectPlan).schema !== 'ga.mission-apt-effect-plan.v1') {
    return { ok: false, status: 'invalid', code: 'cloud_mission_effect_plan_missing', candidate: null };
  }
  bundle.executionReplay = executionCore.createExecutionBundle(bundle);
  bundle.execution = executionCore.createReplayShadowEnvelope(bundle.executionReplay, {
    sourceRevision: 0,
    legacyBundle: bundle
  });
  const replay = executionCore.replay(bundle.executionReplay);
  if (!bundle.execution || !replay.ok || replay.state.phase !== 'planned' || replay.state.revision !== 0) {
    return { ok: false, status: 'invalid', code: 'cloud_mission_execution_seed_invalid', candidate: null };
  }
  const candidate = {
    missionId,
    runId: CLOUD_MISSION_PENDING_RUN_ID,
    title: missionTitle(state, missionId),
    updatedAt: Math.max(0, Number(seed.updatedAt) || Number(source.lastModified) || 0),
    bundle,
    control: {
      schema: 'ga.mission-execution-control.v1',
      version: 1,
      missionId,
      runId: CLOUD_MISSION_PENDING_RUN_ID,
      executionAuthority: 'tracker',
      recipe: 'apt',
      authorityRevision: 0,
      executionRevision: 0,
      executionStateHash: replay.stateHash,
      updatedAt: Math.max(0, Number(seed.updatedAt) || Number(source.lastModified) || 0),
      phase: 'planned',
      subphase: 'cloud_ready',
      flags: clone(replay.state.flags),
      progress: clone(replay.state.progress),
      cargo: clone(replay.state.cargo),
      allowedActions: ['activate_cloud_mission'],
      blockingReasons: [],
      nextStep: 'activate_cloud_mission',
      cloudPending: true
    }
  };
  return { ok: true, status: 'ready', candidate };
}

async function fetchTrackerCloudMission(syncId, pin, options = {}) {
  const pilotId = cleanString(syncId, 180);
  const pilotPin = cleanString(pin, 180);
  if (!pilotId || !pilotPin) {
    return { ok: false, status: 'error', code: 'credentials_missing', candidate: null };
  }
  const request = typeof options.request === 'function' ? options.request : getJson;
  const baseUrl = options.baseUrl || DEFAULT_SYNC_BASE_URL;
  let response;
  try {
    response = await request(syncUrl(baseUrl, pilotId, pilotPin), {
      pin: pilotPin,
      timeoutMs: options.timeoutMs,
      maxBytes: MAX_PROFILE_RESPONSE_BYTES
    });
  } catch (error) {
    return { ok: false, status: 'error', code: 'sync_unavailable', message: error?.message || String(error), candidate: null };
  }
  if (response?.status === 404) return { ok: true, status: 'empty', candidate: null };
  if (response?.status === 401 || response?.status === 403) {
    return { ok: false, status: 'error', code: 'sync_unauthorized', candidate: null };
  }
  if (response?.status !== 200 || !response?.data || typeof response.data !== 'object') {
    return { ok: false, status: 'error', code: 'sync_profile_invalid', candidate: null };
  }
  return buildCloudMissionCandidate(response.data);
}

module.exports = {
  CLOUD_MISSION_PENDING_RUN_ID,
  CLOUD_MISSION_SEED_SCHEMA,
  MAX_PROFILE_RESPONSE_BYTES,
  buildCloudMissionCandidate,
  fetchTrackerCloudMission,
  missionIdentityValues,
  missionTitle
};
