const bushCore = require('../mission-bush-execution-core.js');
'use strict';
const cloudSync = require('../cloud-sync-client.js');
const profileClients = new Map();
const poiRuntime = require('./tracker-mission-poi-runtime.js');
const aptTraining = require('./tracker-mission-apt-training.js');

const executionCore = require('../mission-execution-core.js');
const resumeAdapters = require('../mission-resume-adapters-core.js');
const { DEFAULT_SYNC_BASE_URL, getJson, syncUrl } = require('./tracker-efb-checklist-cloud.js');

const CLOUD_MISSION_SEED_SCHEMA = 'ga.tracker-cloud-mission-seed.v1';
const CLOUD_MISSION_PENDING_RUN_ID = 'cloud-pending';
const MAX_PROFILE_RESPONSE_BYTES = require('../cloud-sync-core.js').MAX_BYTES;

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

function buildCloudMissionCandidate(profile = null, options = {}) {
  const source = object(profile);
  const state = object(source.activeMission);
  if (!Object.keys(state).length && source.freeflightNavigation) {
    try { return { ok: true, status: 'navigation', candidate: null, navigation: require('../freeflight-navigation-core').normalize(source.freeflightNavigation) }; }
    catch (error) { return { ok: false, status: 'invalid', code: error.message, candidate: null }; }
  }
  const seed = object(source.activeMissionTrackerSeed);
  if (!Object.keys(state).length || seed.schema !== CLOUD_MISSION_SEED_SCHEMA || Number(seed.version) !== 1) {
    return { ok: true, status: 'empty', candidate: null };
  }
  const missionId = cleanString(seed.missionId);
  if (!missionId || !missionIdentityValues(state).includes(missionId.toLowerCase())) {
    return { ok: false, status: 'invalid', code: 'cloud_mission_identity_mismatch', candidate: null };
  }
  const runtime = plannedRuntime(missionId, state, seed);
  if (runtime.cargoManifest && cleanString(options.pilotId)) runtime.cargoManifest.pilotId = cleanString(options.pilotId);
  const adapter = cleanString(seed.adapter, 80).toLowerCase()
    || resumeAdapters.detectPrimaryAdapter(runtime, state);
  const bushRecon = adapter === 'bush_pickup' && object(seed.executionBushRecipe).kind === 'recon_return';
  if (adapter !== 'apt' && !(['poi', 'survey_pattern', 'poi_chain', 'bush_pickup'].includes(adapter) && options.poiExecutionEnabled === true)) {
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
    ...(adapter === 'bush_pickup' ? {executionBushRecipe:clone(seed.executionBushRecipe || null)} : {}),
    executionEffectPlan: seed.executionEffectPlan ? clone(seed.executionEffectPlan) : null,
    ...(adapter === 'apt' ? { executionTrainingRecipe: clone(seed.executionTrainingRecipe || null) } : {}),
    ...(['poi', 'survey_pattern', 'poi_chain'].includes(adapter) || bushRecon ? { executionPoiRecipe: clone(seed.executionPoiRecipe || null) } : {})
  };
  const validation = resumeAdapters.validateBundle(bundle);
  if (!validation.ok) {
    return { ok: false, status: 'invalid', code: validation.error || 'cloud_mission_bundle_invalid', candidate: null };
  }
  const bushError=bushCore.validateBundle(bundle);
  if(bushError)return {ok:false,status:'unsupported',code:bushError,candidate:null};
  const aptTrainingError = adapter === 'apt' ? aptTraining.validateBundle(bundle) : null;
  if (['poi', 'survey_pattern', 'poi_chain'].includes(adapter) || bushRecon ? (!poiRuntime.hasLifecycle(bundle.executionPoiRecipe) || !!poiRuntime.validateBundle(bundle))
      : (object(bundle.executionEffectPlan).schema !== 'ga.mission-apt-effect-plan.v1' || !!aptTrainingError)) {
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
  const size = resumeAdapters.validateSize(bundle);
  if (!size.ok) return { ok: false, status: 'invalid', code: size.error, bytes: size.bytes, maxBytes: size.maxBytes, candidate: null };
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
      recipe: replay.state.recipe,
      ...(bundle.executionPoiRecipe?.taskDomain === 'infra_chain_recon' ? { chainSpec: clone(bundle.executionPoiRecipe.poiChain) } : {}),
      ...(bundle.executionPoiRecipe?.taskDomain === 'mapping_survey' ? { surveySpec: clone(bundle.executionPoiRecipe.surveyPattern) } : {}),
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
    const key = JSON.stringify([baseUrl, pilotId, pilotPin]);
    let client = options.request ? null : profileClients.get(key);
    if (!client) {
      client = cloudSync.create({
        baseUrl: baseUrl.replace(/\/api\/sync\/?$/, '/api/sync-v2/'), pilotId, pin: pilotPin,
        request: async (url, init) => {
          const result = await request(url, { pin: pilotPin, headers: init.headers, timeoutMs: options.timeoutMs, maxBytes: 96 * 1024 });
          return { ok: result.status >= 200 && result.status < 300, status: result.status, json: async () => result.data };
        }
      });
      if (!options.request) { if (profileClients.size >= 2) profileClients.clear(); profileClients.set(key, client); }
    }
    const result = await client.read(['mission', 'field:lastModified', 'field:freeflightNavigation']);
    response = result.migrated ? { status: 200, data: result.profile } : await request(syncUrl(baseUrl, pilotId, pilotPin), {
      pin: pilotPin, timeoutMs: options.timeoutMs, maxBytes: MAX_PROFILE_RESPONSE_BYTES
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
  return buildCloudMissionCandidate(response.data, { ...options, pilotId });
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
