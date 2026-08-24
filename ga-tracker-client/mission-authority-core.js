const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const executionCore = require('../mission-execution-core.js');
const locationCore = require('../mission-location-core.js');
const payloadCore = require('../mission-payload-core.js');
const flightRecorderCore = require('../mission-flight-recorder-core.js');

const STATE_SCHEMA = 'ga.mission-authority.v1';
const STATE_VERSION = 1;
const MAX_EVENTS = 120;
const MAX_EFFECTS = 160;
const MAX_RESUME_BYTES = 384 * 1024;
const MAX_EXECUTION_EVENTS = 160;
const EXECUTION_AUTHORITY_WEB = 'web';
const EXECUTION_AUTHORITY_TRACKER = 'tracker';
const EXECUTION_HANDOFF_RECIPE = 'apt';
const EXECUTION_PAYLOAD_RECOVERY_SCHEMA = 'ga.mission-payload-recovery.v1';
const EXECUTION_RUNTIME_CONTEXT_SCHEMA = 'ga.mission-runtime-context.v1';

const TERMINAL_STATES = new Set(['ended', 'closed', 'reset', 'cleared', 'aborted', 'completed']);
const AUTHORITY_COMMANDS = new Set([
  'mission_authority_acquire',
  'mission_authority_takeover',
  'mission_authority_release',
  'mission_snapshot_request',
  'mission_snapshot_update',
  'mission_execution_authority_prepare',
  'mission_execution_authority_commit',
  'mission_execution_authority_rollback'
]);

function cleanString(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

function jsonClone(value) {
  if (value == null) return null;
  return JSON.parse(JSON.stringify(value));
}

function safeResumeBundle(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  let cloned;
  try {
    cloned = jsonClone(value);
  } catch (_) {
    return null;
  }
  const bytes = Buffer.byteLength(JSON.stringify(cloned), 'utf8');
  if (bytes > MAX_RESUME_BYTES) {
    const error = new Error(`resume_bundle_too_large:${bytes}`);
    error.code = 'resume_bundle_too_large';
    throw error;
  }
  return cloned;
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizePayloadRecoveryBaseline(value) {
  const normalized = payloadCore.normalizeSnapshot(value);
  if (!normalized) return null;
  const aircraft = safeObject(normalized.aircraft);
  return {
    payloadAdapter: cleanString(normalized.payloadAdapter, 80) || 'msfs_payload_stations',
    aircraft: Object.keys(aircraft).length ? {
      title: cleanString(aircraft.title, 240) || null,
      model: cleanString(aircraft.model, 240) || null,
      type: cleanString(aircraft.type, 120) || null
    } : null,
    pa24: normalized.pa24 ? jsonClone(normalized.pa24) : null,
    totalWeightLbs: Number.isFinite(Number(normalized.totalWeightLbs)) ? Number(normalized.totalWeightLbs) : null,
    emptyWeightLbs: Number.isFinite(Number(normalized.emptyWeightLbs)) ? Number(normalized.emptyWeightLbs) : null,
    fuelWeightLbs: Number.isFinite(Number(normalized.fuelWeightLbs)) ? Number(normalized.fuelWeightLbs) : null,
    payloadWeightLbs: Number.isFinite(Number(normalized.payloadWeightLbs)) ? Number(normalized.payloadWeightLbs) : null,
    payloadStationCount: normalized.payloadStationCount,
    sampledStationCount: normalized.sampledStationCount,
    stations: normalized.stations.map(row => ({ index: row.index, weightLbs: row.weightLbs }))
  };
}

function normalizeExecutionPayloadRecovery(value) {
  const source = safeObject(value);
  const baseline = normalizePayloadRecoveryBaseline(source.baseline);
  if (!baseline) return null;
  return {
    schema: EXECUTION_PAYLOAD_RECOVERY_SCHEMA,
    baseline,
    capturedAt: Number(source.capturedAt || 0) || null,
    writeAttempted: source.writeAttempted === true,
    writeAttemptedAt: Number(source.writeAttemptedAt || 0) || null,
    restoreAttempts: Math.max(0, Math.min(100, Math.round(Number(source.restoreAttempts) || 0))),
    lastRestoreAttemptAt: Number(source.lastRestoreAttemptAt || 0) || null,
    restored: source.restored === true,
    restoredAt: Number(source.restoredAt || 0) || null,
    detachedInheritedEquipmentIds: Array.from(new Set(
      (Array.isArray(source.detachedInheritedEquipmentIds) ? source.detachedInheritedEquipmentIds : [])
        .map(value => cleanString(value, 120))
        .filter(Boolean)
    )).slice(0, 80),
    lastError: cleanString(source.lastError, 240) || null
  };
}

function normalizeFlightRecord(value) {
  const source = safeObject(value);
  if (!Object.keys(source).length) return null;
  const numberOrNull = value => value == null || value === '' || !Number.isFinite(Number(value))
    ? null
    : Number(value);
  return {
    depLabel: cleanString(source.depLabel, 180) || 'START',
    arrLabel: cleanString(source.arrLabel, 180) || 'LANDUNG',
    startTs: numberOrNull(source.startTs),
    endTs: numberOrNull(source.endTs),
    createdAt: numberOrNull(source.createdAt),
    durationSec: numberOrNull(source.durationSec),
    distanceNm: numberOrNull(source.distanceNm),
    distanceSource: cleanString(source.distanceSource, 40) || 'unavailable',
    avgGs: numberOrNull(source.avgGs),
    maxGs: numberOrNull(source.maxGs),
    maxAltFt: numberOrNull(source.maxAltFt),
    touchdownVsFpm: numberOrNull(source.touchdownVsFpm),
    maxBankDeg: numberOrNull(source.maxBankDeg),
    maxGForce: numberOrNull(source.maxGForce),
    avgGForce: numberOrNull(source.avgGForce),
    maxClimbFpm: numberOrNull(source.maxClimbFpm),
    maxDescentFpm: numberOrNull(source.maxDescentFpm),
    minEnrouteAglFt: numberOrNull(source.minEnrouteAglFt),
    cruiseAltitudeMeanFt: numberOrNull(source.cruiseAltitudeMeanFt),
    cruiseAltitudeStdDevFt: numberOrNull(source.cruiseAltitudeStdDevFt),
    cruiseAltitudeRangeFt: numberOrNull(source.cruiseAltitudeRangeFt),
    telemetrySampleCount: numberOrNull(source.telemetrySampleCount),
    bankSampleCount: numberOrNull(source.bankSampleCount),
    gForceSampleCount: numberOrNull(source.gForceSampleCount),
    enrouteSampleCount: numberOrNull(source.enrouteSampleCount),
    aglSampleCount: numberOrNull(source.aglSampleCount),
    cruiseSampleCount: numberOrNull(source.cruiseSampleCount),
    cruiseDurationSec: numberOrNull(source.cruiseDurationSec),
    telemetryStatus: cleanString(source.telemetryStatus, 40) || 'unavailable',
    segmentCount: Math.max(1, Math.round(Number(source.segmentCount) || 1))
  };
}

function normalizeExecutionRuntimeContext(value) {
  const source = safeObject(value);
  if (source.schema !== EXECUTION_RUNTIME_CONTEXT_SCHEMA || Number(source.version) !== 1) return null;
  const latest = safeObject(source.latestTelemetry);
  const numberOrNull = value => value == null || value === '' || !Number.isFinite(Number(value))
    ? null
    : Number(value);
  const arrivalFlightRecord = normalizeFlightRecord(source.arrivalFlightRecord);
  const missionFlightRecord = normalizeFlightRecord(source.missionFlightRecord);
  const rawDestination = safeObject(source.latestDestination);
  return {
    schema: EXECUTION_RUNTIME_CONTEXT_SCHEMA,
    version: 1,
    missionId: cleanString(source.missionId, 180),
    runId: cleanString(source.runId, 220),
    flightRecorder: flightRecorderCore.createState(source.flightRecorder),
    arrivalFlightRecord,
    missionFlightRecord,
    lastFinalizedSegmentStartTs: Math.max(0, Math.round(Number(source.lastFinalizedSegmentStartTs) || 0)) || null,
    segmentDepartureLabel: cleanString(source.segmentDepartureLabel, 180) || null,
    recorderLowSpeedSince: Math.max(0, Math.round(Number(source.recorderLowSpeedSince) || 0)) || null,
    latestDestination: {
      atDestination: rawDestination.atDestination === true,
      hasAptArrival: rawDestination.hasAptArrival === true,
      dArrivalNm: numberOrNull(rawDestination.dArrivalNm),
      dMissionNm: numberOrNull(rawDestination.dMissionNm),
      reason: cleanString(rawDestination.reason, 80) || null
    },
    latestTelemetry: {
      observedAt: Math.max(0, Math.round(Number(latest.observedAt) || 0)),
      lat: numberOrNull(latest.lat),
      lon: numberOrNull(latest.lon),
      altFt: numberOrNull(latest.altFt),
      aglFt: numberOrNull(latest.aglFt),
      hdg: numberOrNull(latest.hdg),
      gsKts: numberOrNull(latest.gsKts),
      onGround: typeof latest.onGround === 'boolean' ? latest.onGround : null,
      bankDeg: numberOrNull(latest.bankDeg),
      gForce: numberOrNull(latest.gForce),
      vsFpm: numberOrNull(latest.vsFpm),
      touchdownFpm: numberOrNull(latest.touchdownFpm),
      windKts: numberOrNull(latest.windKts),
      windDeg: numberOrNull(latest.windDeg),
      windGustKts: numberOrNull(latest.windGustKts),
      tempC: numberOrNull(latest.tempC),
      visKm: numberOrNull(latest.visKm),
      precipRateMmH: numberOrNull(latest.precipRateMmH),
      precipActive: latest.precipActive === true,
      inCloud: latest.inCloud === true,
      turbulencePct: numberOrNull(latest.turbulencePct),
      simPaused: latest.simPaused === true,
      inMenuOrMap: latest.inMenuOrMap === true,
      parkingBrake: typeof latest.parkingBrake === 'boolean' ? latest.parkingBrake : null
    },
    updatedAt: Math.max(0, Math.round(Number(source.updatedAt) || 0)) || null
  };
}

function executionLocationProjection(resumeBundle = null) {
  const bundle = safeObject(resumeBundle);
  const missionState = safeObject(bundle.missionState);
  const missionData = safeObject(missionState.currentMissionData);
  const contract = safeObject(missionState.activeMissionContract);
  const arrivalCandidates = [missionData.aptArrivalPlan, contract.aptArrivalPlan];
  const arrivalPoint = arrivalCandidates
    .map(candidate => locationCore.normalizePoint(candidate))
    .find(Boolean) || null;
  const routeCandidates = [
    missionData.routeWaypoints,
    missionData.missionRouteWaypoints,
    missionState.routeWaypoints,
    missionState.missionRouteWaypoints,
    contract.routeWaypoints,
    contract.missionRouteWaypoints
  ];
  let missionTarget = null;
  for (const route of routeCandidates) {
    if (!Array.isArray(route) || !route.length) continue;
    const points = route.map(point => locationCore.normalizePoint(point)).filter(Boolean);
    if (!points.length) continue;
    missionTarget = points[points.length - 1];
    break;
  }
  const policyCandidates = [missionData.executionLocationPolicy, contract.executionLocationPolicy];
  const policy = policyCandidates.find(candidate => safeObject(candidate).schema === locationCore.APT_POLICY_SCHEMA) || null;
  return locationCore.normalizeAptLocation({ arrivalPoint, missionTarget, policy });
}

function publicExecutionHandoff(value = null) {
  const handoff = safeObject(value);
  const handoffId = cleanString(handoff.handoffId, 220);
  if (!handoffId) return null;
  return {
    handoffId,
    status: cleanString(handoff.status, 40) || 'prepared',
    recipe: cleanString(handoff.recipe, 80) || null,
    phase: cleanString(handoff.phase, 100) || null,
    authorityRevision: Math.max(0, Math.round(Number(handoff.authorityRevision) || 0)),
    stateHash: cleanString(handoff.stateHash, 180) || null,
    executionStateHash: cleanString(handoff.executionStateHash, 180) || null,
    preparedAt: Number(handoff.preparedAt || 0) || null
  };
}

function executionProjection(resumeBundle = null) {
  const bundle = safeObject(resumeBundle);
  const replayBundle = safeObject(bundle.executionReplay);
  const browserEnvelope = safeObject(bundle.execution);
  if (replayBundle.schema !== executionCore.BUNDLE_SCHEMA) {
    return { ok: false, error: 'mission_execution_replay_required' };
  }
  if (browserEnvelope.schema !== executionCore.SHADOW_SCHEMA
      || Number(browserEnvelope.version) !== executionCore.CORE_VERSION) {
    return { ok: false, error: 'mission_execution_shadow_required' };
  }
  const replay = executionCore.replay(replayBundle);
  if (!replay.ok) return { ok: false, error: replay.error || 'mission_execution_replay_invalid' };
  const recipe = cleanString(replayBundle.recipe || replay.state?.recipe || bundle.adapter, 80).toLowerCase();
  const trackerEnvelope = executionCore.createReplayShadowEnvelope(replayBundle, {
    sourceRevision: Math.max(0, Math.round(Number(browserEnvelope.sourceRevision) || 0)),
    legacyBundle: bundle,
    legacyComparison: 'compared'
  });
  if (!trackerEnvelope) return { ok: false, error: 'mission_execution_projection_failed' };
  const parityMatches = cleanString(browserEnvelope.missionId) === cleanString(trackerEnvelope.missionId)
    && cleanString(browserEnvelope.stateHash, 180) === cleanString(trackerEnvelope.stateHash, 180)
    && cleanString(browserEnvelope.replaySemanticHash, 180) === cleanString(trackerEnvelope.replaySemanticHash, 180)
    && cleanString(browserEnvelope.legacyStateHash, 180) === cleanString(trackerEnvelope.legacyStateHash, 180)
    && executionCore.canonicalStringify(browserEnvelope.allowedActions) === executionCore.canonicalStringify(trackerEnvelope.allowedActions)
    && executionCore.canonicalStringify(browserEnvelope.blockingReasons) === executionCore.canonicalStringify(trackerEnvelope.blockingReasons)
    && executionCore.canonicalStringify(browserEnvelope.cargo) === executionCore.canonicalStringify(trackerEnvelope.cargo)
    && executionCore.canonicalStringify(browserEnvelope.workflows) === executionCore.canonicalStringify(trackerEnvelope.workflows)
    && executionCore.canonicalStringify(browserEnvelope.effects) === executionCore.canonicalStringify(trackerEnvelope.effects);
  const legacyDriftFields = Array.from(new Set([
    ...(Array.isArray(browserEnvelope.legacyDriftFields) ? browserEnvelope.legacyDriftFields : []),
    ...(Array.isArray(trackerEnvelope.legacyDriftFields) ? trackerEnvelope.legacyDriftFields : [])
  ].map(field => cleanString(field, 100)).filter(Boolean)));
  if (!parityMatches) return { ok: false, error: 'mission_execution_shadow_drift' };
  if (legacyDriftFields.length) {
    return { ok: false, error: 'mission_execution_legacy_drift', driftFields: legacyDriftFields };
  }
  return {
    ok: true,
    recipe,
    phase: cleanString(replay.state?.phase, 100).toLowerCase(),
    state: replay.state,
    stateHash: cleanString(replay.stateHash, 180),
    stateRevision: Math.max(0, Math.round(Number(replay.state?.revision) || 0)),
    allowedActions: Array.isArray(replay.view?.allowedActions) ? replay.view.allowedActions.slice() : [],
    blockingReasons: Array.isArray(replay.view?.blockingReasons) ? replay.view.blockingReasons.slice() : []
  };
}

function publicEffect(effect = {}) {
  return {
    commandId: cleanString(effect.commandId, 220),
    type: cleanString(effect.type, 120),
    sceneId: cleanString(effect.sceneId, 220) || null,
    status: cleanString(effect.status, 60) || 'requested',
    requestedAt: Number(effect.requestedAt || 0) || null,
    completedAt: Number(effect.completedAt || 0) || null,
    error: cleanString(effect.error, 240) || null
  };
}

function effectAckSummary(ack = {}) {
  if (!ack || typeof ack !== 'object' || Array.isArray(ack)) return null;
  const numberOrNull = value => Number.isFinite(Number(value)) ? Number(value) : null;
  return {
    type: cleanString(ack.type, 140),
    commandId: cleanString(ack.commandId, 220),
    sceneId: cleanString(ack.sceneId, 220) || null,
    missionId: cleanString(ack.missionId) || null,
    status: cleanString(ack.status, 60) || 'ok',
    error: cleanString(ack.error, 240) || null,
    action: cleanString(ack.action, 80) || null,
    stage: cleanString(ack.stage, 80) || null,
    spawned: numberOrNull(ack.spawned),
    cleared: numberOrNull(ack.cleared),
    boarded: numberOrNull(ack.boarded),
    deboarded: numberOrNull(ack.deboarded),
    removed: numberOrNull(ack.removed),
    cargoRemoved: numberOrNull(ack.cargoRemoved),
    routeSent: ack.routeSent === true || ack.routeSent === 1,
    routeSentCount: numberOrNull(ack.routeSentCount),
    vehicleDeparture: ack.vehicleDeparture === true || ack.vehicleDeparture === 1,
    durationMs: numberOrNull(ack.durationMs)
  };
}

function publicRun(run, options = {}) {
  if (!run?.missionId || !run?.runId) return null;
  const result = {
    missionId: cleanString(run.missionId),
    runId: cleanString(run.runId, 220),
    ownerClientId: cleanString(run.ownerClientId, 220) || 'unknown',
    authority: 'tracker',
    executionAuthority: run.executionAuthority === EXECUTION_AUTHORITY_TRACKER
      ? EXECUTION_AUTHORITY_TRACKER
      : EXECUTION_AUTHORITY_WEB,
    executionRecipe: cleanString(run.executionRecipe, 80) || null,
    executionRevision: Math.max(0, Math.round(Number(run.executionRevision) || 0)),
    executionStateHash: cleanString(run.executionStateHash, 180) || null,
    executionHandoff: publicExecutionHandoff(run.executionHandoff),
    state: cleanString(run.state, 60) || 'active',
    active: run.active !== false,
    phase: cleanString(run.phase, 100) || null,
    revision: Math.max(1, Math.round(Number(run.revision) || 1)),
    stateHash: cleanString(run.stateHash, 160) || null,
    acquiredAt: Number(run.acquiredAt || 0) || null,
    updatedAt: Number(run.updatedAt || 0) || null,
    lastCommandType: cleanString(run.lastCommandType, 140) || null,
    lastReason: cleanString(run.lastReason, 240) || null,
    lastSnapshotSequence: Math.max(0, Math.round(Number(run.lastSnapshotSequence) || 0)),
    effectCount: Array.isArray(run.effects) ? run.effects.length : 0,
    lastEffect: Array.isArray(run.effects) && run.effects.length ? publicEffect(run.effects[run.effects.length - 1]) : null
  };
  if (options.includeBundle === true) result.resumeBundle = jsonClone(run.resumeBundle);
  if (options.includeEffects === true) result.effects = (Array.isArray(run.effects) ? run.effects : []).slice(-40).map(publicEffect);
  return result;
}

function publicExecutionSnapshot(run) {
  if (!run?.missionId || !run?.runId || !run.executionState) return null;
  const state = executionCore.normalizeState(run.executionState);
  const view = executionCore.deriveView(state);
  const runtime = normalizeExecutionRuntimeContext(run.executionRuntimeContext);
  let missionFlightRecord = runtime?.missionFlightRecord || null;
  const currentSegmentRecord = runtime?.flightRecorder?.active === true
    && Number(runtime.flightRecorder.startTs || 0) !== Number(runtime.lastFinalizedSegmentStartTs || 0)
    ? flightRecorderCore.buildRecord(runtime.flightRecorder, {
        now: runtime.latestTelemetry?.observedAt || runtime.updatedAt || Date.now(),
        depLabel: runtime.segmentDepartureLabel || missionFlightRecord?.arrLabel || 'START',
        arrLabel: runtime.latestDestination?.atDestination === true ? (runtime.arrivalFlightRecord?.arrLabel || 'LANDUNG') : 'ZWISCHENLANDUNG'
      })
    : null;
  if (currentSegmentRecord) {
    currentSegmentRecord.startTs = runtime.flightRecorder.startTs || null;
    currentSegmentRecord.endTs = runtime.latestTelemetry?.observedAt || runtime.updatedAt || null;
    currentSegmentRecord.createdAt = currentSegmentRecord.endTs;
    currentSegmentRecord.segmentCount = 1;
    missionFlightRecord = flightRecorderCore.mergeRecords([missionFlightRecord, currentSegmentRecord].filter(Boolean));
  }
  const exposeFlight = runtime && /^(end_unloading|end_ready|closing|closed)$/.test(state.phase);
  const exposeCompletionRecord = /^(closing|closed)$/.test(state.phase);
  return {
    schema: 'ga.mission-execution-control.v1',
    version: 1,
    missionId: cleanString(run.missionId),
    runId: cleanString(run.runId, 220),
    executionAuthority: run.executionAuthority === EXECUTION_AUTHORITY_TRACKER
      ? EXECUTION_AUTHORITY_TRACKER
      : EXECUTION_AUTHORITY_WEB,
    recipe: cleanString(run.executionRecipe || state.recipe, 80).toLowerCase() || null,
    authorityRevision: Math.max(1, Math.round(Number(run.revision) || 1)),
    executionRevision: Math.max(0, Math.round(Number(run.executionRevision) || 0)),
    executionStateHash: cleanString(run.executionStateHash, 180) || null,
    updatedAt: Number(run.updatedAt || 0) || null,
    phase: state.phase,
    subphase: state.subphase,
    flags: jsonClone(state.flags),
    progress: jsonClone(state.progress),
    manifest: jsonClone(state.manifest),
    flightEvents: jsonClone(view.flightEvents),
    payload: jsonClone(view.payload),
    voice: jsonClone(view.voice),
    workflows: jsonClone(view.workflows),
    authoritySanction: jsonClone(
      [...state.effects].reverse().find(effect => effect.type === 'crewboard.authority_sanction')?.payload?.record || null
    ),
    flight: exposeFlight ? {
      missionRecord: exposeCompletionRecord ? jsonClone(missionFlightRecord) : null,
      arrivalRecord: exposeCompletionRecord ? jsonClone(runtime.arrivalFlightRecord) : null,
      segmentCount: exposeCompletionRecord ? Math.max(0, Number(missionFlightRecord?.segmentCount || 0)) : 0,
      destination: jsonClone(runtime.latestDestination)
    } : null,
    cargo: {
      signatureScope: state.cargo.signatureScope,
      summary: jsonClone(state.cargo.summary),
      items: state.cargo.items.map(item => ({
        id: item.id,
        itemType: item.itemType,
        status: item.status,
        required: item.required,
        pickup: item.pickup,
        delivery: item.delivery,
        passengerCount: item.passengerCount,
        weightLbs: item.weightLbs,
        healthPct: item.healthPct
      }))
    },
    allowedActions: view.allowedActions.slice(),
    blockingReasons: view.blockingReasons.slice(),
    nextStep: view.nextStep
  };
}

function commandType(command = {}) {
  return cleanString(command.type || command.command, 140).toLowerCase();
}

function isMissionCommand(command = {}) {
  const type = commandType(command);
  return type === 'mission_lifecycle' || /^mission_(scene|smoke)_/.test(type);
}

function isLegacyCleanupCommand(command = {}) {
  const type = commandType(command);
  const state = cleanString(command.state, 60).toLowerCase();
  if (type === 'mission_lifecycle' && TERMINAL_STATES.has(state)) return true;
  return type === 'mission_scene_clear' || type === 'mission_scene_clear_all' || type === 'mission_smoke_clear';
}

function newState() {
  return {
    schema: STATE_SCHEMA,
    version: STATE_VERSION,
    activeRun: null,
    lastRun: null,
    events: []
  };
}

function normalizeStoredRun(run) {
  if (!run?.missionId || !run?.runId) return null;
  return {
    ...publicRun(run, { includeBundle: true }),
    executionState: run.executionState ? executionCore.normalizeState(run.executionState) : null,
    executionWebStateHash: cleanString(run.executionWebStateHash, 180) || null,
    executionAppliedEvents: Math.max(0, Math.round(Number(run.executionAppliedEvents) || 0)),
    executionPayloadRecovery: normalizeExecutionPayloadRecovery(run.executionPayloadRecovery),
    executionRuntimeContext: normalizeExecutionRuntimeContext(run.executionRuntimeContext),
    effects: (Array.isArray(run.effects) ? run.effects : []).slice(-MAX_EFFECTS).map(effect => ({
      ...publicEffect(effect),
      managerSessionId: cleanString(effect.managerSessionId, 160),
      ack: effectAckSummary(effect.ack)
    }))
  };
}

function createMissionAuthorityManager(options = {}) {
  const storageFile = cleanString(options.storageFile, 2000);
  const io = options.fs || fs;
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const idFactory = typeof options.idFactory === 'function'
    ? options.idFactory
    : () => `run-${Date.now().toString(36)}-${crypto.randomBytes(7).toString('hex')}`;
  const managerSessionId = `tracker-${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}`;
  const log = typeof options.log === 'function' ? options.log : () => {};
  const executionAuthorityEnabled = options.executionAuthorityEnabled === true;
  let state = newState();

  const addEvent = (kind, payload = {}) => {
    state.events.push({
      at: now(),
      kind: cleanString(kind, 100),
      missionId: cleanString(payload.missionId),
      runId: cleanString(payload.runId, 220),
      clientId: cleanString(payload.clientId, 220),
      commandId: cleanString(payload.commandId, 220),
      reason: cleanString(payload.reason, 240)
    });
    state.events = state.events.slice(-MAX_EVENTS);
  };

  const persist = () => {
    if (!storageFile) return true;
    try {
      const directory = path.dirname(storageFile);
      const temporaryFile = `${storageFile}.tmp`;
      io.mkdirSync(directory, { recursive: true });
      io.writeFileSync(temporaryFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
      io.renameSync(temporaryFile, storageFile);
      return true;
    } catch (error) {
      log(`MISSION_AUTHORITY_PERSIST_ERROR ${error?.message || error}`);
      return false;
    }
  };

  const load = () => {
    if (!storageFile || !io.existsSync(storageFile)) return;
    try {
      const parsed = JSON.parse(io.readFileSync(storageFile, 'utf8'));
      if (parsed?.schema !== STATE_SCHEMA || Number(parsed?.version) !== STATE_VERSION) return;
      state = {
        schema: STATE_SCHEMA,
        version: STATE_VERSION,
        activeRun: normalizeStoredRun(parsed.activeRun),
        lastRun: normalizeStoredRun(parsed.lastRun),
        events: Array.isArray(parsed.events) ? parsed.events.slice(-MAX_EVENTS) : []
      };
      log(`MISSION_AUTHORITY_LOADED active=${state.activeRun?.missionId || 'none'} run=${state.activeRun?.runId || 'none'}`);
    } catch (error) {
      log(`MISSION_AUTHORITY_LOAD_ERROR ${error?.message || error}`);
      state = newState();
    }
  };

  const activeMatches = (command = {}, options = {}) => {
    const active = state.activeRun;
    if (!active) return { ok: false, error: 'no_active_run' };
    const missionId = cleanString(command.missionId);
    const runId = cleanString(command.runId, 220);
    const clientId = cleanString(command.clientId, 220);
    if (missionId && missionId !== active.missionId) return { ok: false, error: 'mission_authority_conflict' };
    if (runId && runId !== active.runId) return { ok: false, error: 'mission_run_conflict' };
    if (options.requireOwner === true) {
      if (!runId || !clientId) return { ok: false, error: 'mission_authority_credentials_required' };
      if (clientId !== active.ownerClientId) return { ok: false, error: 'mission_authority_owner_mismatch' };
    }
    return { ok: true, activeRun: active };
  };

  const acquire = (request = {}) => {
    const missionId = cleanString(request.missionId);
    const clientId = cleanString(request.clientId, 220) || 'unknown-client';
    if (!missionId) return { ok: false, status: 'error', error: 'mission_id_required', activeRun: publicRun(state.activeRun) };
    if (state.activeRun) {
      const requestedRunId = cleanString(request.runId, 220);
      const sameRun = state.activeRun.missionId === missionId
        && (!requestedRunId || requestedRunId === state.activeRun.runId);
      const sameOwner = state.activeRun.ownerClientId === clientId;
      if (sameRun && sameOwner) {
        state.activeRun.updatedAt = now();
        addEvent('acquire_resume', { missionId, runId: state.activeRun.runId, clientId, commandId: request.commandId });
        persist();
        return {
          ok: true,
          status: 'ok',
          resumed: true,
          activeRun: publicRun(state.activeRun)
        };
      }
      addEvent('acquire_conflict', { missionId, runId: requestedRunId, clientId, commandId: request.commandId });
      persist();
      return { ok: false, status: 'conflict', error: 'mission_authority_conflict', activeRun: publicRun(state.activeRun) };
    }
    const timestamp = now();
    const runId = cleanString(request.runId, 220) || idFactory();
    const initialResumeBundle = safeResumeBundle(request.resumeBundle);
    const initialExecution = executionProjection(initialResumeBundle);
    state.activeRun = {
      missionId,
      runId,
      ownerClientId: clientId,
      authority: 'tracker',
      executionAuthority: EXECUTION_AUTHORITY_WEB,
      executionRecipe: initialExecution.ok
        ? initialExecution.recipe
        : cleanString(initialResumeBundle?.adapter || initialResumeBundle?.descriptor?.primaryAdapter, 80).toLowerCase() || null,
      executionRevision: initialExecution.ok ? initialExecution.stateRevision : 0,
      executionStateHash: initialExecution.ok ? initialExecution.stateHash : null,
      executionState: initialExecution.ok ? initialExecution.state : null,
      executionWebStateHash: null,
      executionAppliedEvents: 0,
      executionPayloadRecovery: null,
      executionRuntimeContext: null,
      executionHandoff: null,
      state: cleanString(request.state, 60).toLowerCase() || 'active',
      active: true,
      phase: cleanString(request.phase || request.missionPhase, 100).toLowerCase() || 'planned',
      revision: 1,
      stateHash: cleanString(request.stateHash, 160) || null,
      acquiredAt: timestamp,
      updatedAt: timestamp,
      lastCommandType: 'mission_authority_acquire',
      lastReason: cleanString(request.reason, 240) || 'mission-start',
      lastSnapshotSequence: 0,
      resumeBundle: initialResumeBundle,
      effects: []
    };
    addEvent('acquired', { missionId, runId, clientId, commandId: request.commandId, reason: request.reason });
    persist();
    return {
      ok: true,
      status: 'ok',
      resumed: false,
      activeRun: publicRun(state.activeRun)
    };
  };

  const takeover = (request = {}) => {
    const active = state.activeRun;
    if (!active) return { ok: false, status: 'error', error: 'no_active_run', activeRun: null };
    const missionId = cleanString(request.missionId);
    const runId = cleanString(request.runId, 220);
    const clientId = cleanString(request.clientId, 220);
    const expectedRevision = Math.max(0, Math.round(Number(request.expectedRevision) || 0));
    if (!clientId) return { ok: false, status: 'error', error: 'client_id_required', activeRun: publicRun(active) };
    if (missionId !== active.missionId || runId !== active.runId) {
      return { ok: false, status: 'conflict', error: 'mission_run_conflict', activeRun: publicRun(active) };
    }
    if (expectedRevision && expectedRevision !== active.revision) {
      return { ok: false, status: 'conflict', error: 'mission_revision_conflict', activeRun: publicRun(active) };
    }
    if (active.executionAuthority === EXECUTION_AUTHORITY_TRACKER) {
      return { ok: false, status: 'conflict', error: 'mission_execution_authority_tracker', activeRun: publicRun(active) };
    }
    const previousOwner = active.ownerClientId;
    active.ownerClientId = clientId;
    active.revision += 1;
    active.updatedAt = now();
    active.lastCommandType = 'mission_authority_takeover';
    active.lastReason = cleanString(request.reason, 240) || 'device-handoff';
    active.executionHandoff = null;
    addEvent('takeover', { missionId, runId, clientId, commandId: request.commandId, reason: `from:${previousOwner}` });
    persist();
    return {
      ok: true,
      status: 'ok',
      previousOwnerClientId: previousOwner,
      activeRun: publicRun(active)
    };
  };

  const validate = (command = {}) => {
    const type = commandType(command);
    if (AUTHORITY_COMMANDS.has(type)) return { ok: true, protocol: true, activeRun: publicRun(state.activeRun) };
    if (!isMissionCommand(command)) return { ok: true, missionScoped: false, activeRun: publicRun(state.activeRun) };
    if (!state.activeRun) {
      if (isLegacyCleanupCommand(command)) return { ok: true, legacyCleanup: true, activeRun: null };
      if (command.runId) return { ok: false, status: 'conflict', error: 'no_active_run', activeRun: null };
      const implicit = acquire({
        missionId: command.missionId,
        clientId: cleanString(command.clientId, 220) || 'legacy-client',
        state: command.state || 'active',
        phase: command.missionPhase || 'prepare',
        commandId: command.commandId,
        reason: 'legacy-implicit-acquire'
      });
      return implicit.ok
        ? { ok: true, legacyImplicit: true, activeRun: implicit.activeRun }
        : { ok: false, status: implicit.status, error: implicit.error, activeRun: implicit.activeRun };
    }
    const missionId = cleanString(command.missionId);
    if (!missionId || missionId !== state.activeRun.missionId) {
      return { ok: false, status: 'conflict', error: 'mission_authority_conflict', activeRun: publicRun(state.activeRun) };
    }
    if (state.activeRun.executionAuthority === EXECUTION_AUTHORITY_TRACKER && !isLegacyCleanupCommand(command)) {
      return {
        ok: false,
        status: 'blocked',
        error: 'mission_execution_authority_tracker',
        sideEffect: false,
        activeRun: publicRun(state.activeRun)
      };
    }
    const hasAuthorityEnvelope = Boolean(command.runId || command.clientId);
    if (!hasAuthorityEnvelope) {
      if (state.activeRun.ownerClientId === 'legacy-client') {
        return { ok: true, legacy: true, activeRun: publicRun(state.activeRun) };
      }
      return { ok: false, status: 'conflict', error: 'mission_authority_owned_by_versioned_client', activeRun: publicRun(state.activeRun) };
    }
    if (!command.runId && cleanString(command.clientId, 220) === state.activeRun.ownerClientId) {
      return { ok: true, ownerRebind: true, activeRun: publicRun(state.activeRun) };
    }
    const match = activeMatches(command, { requireOwner: true });
    if (!match.ok) return { ok: false, status: 'conflict', error: match.error, activeRun: publicRun(state.activeRun) };
    const commandId = cleanString(command.commandId, 220);
    const duplicateEffect = commandId && /^mission_(scene|smoke)_/.test(type)
      ? match.activeRun.effects.find(effect => effect.commandId === commandId)
      : null;
    if (duplicateEffect) {
      if (!duplicateEffect.completedAt && duplicateEffect.managerSessionId !== managerSessionId) {
        return { ok: true, effectRetry: true, activeRun: publicRun(match.activeRun) };
      }
      return {
        ok: false,
        status: cleanString(duplicateEffect.ack?.status || duplicateEffect.status, 60) || 'noop',
        error: cleanString(duplicateEffect.ack?.error || duplicateEffect.error, 240),
        duplicate: true,
        effect: publicEffect(duplicateEffect),
        replayAck: effectAckSummary(duplicateEffect.ack),
        activeRun: publicRun(match.activeRun)
      };
    }
    return { ok: true, activeRun: publicRun(match.activeRun) };
  };

  const updateSnapshot = (request = {}) => {
    const match = activeMatches(request, { requireOwner: true });
    if (!match.ok) return { ok: false, status: 'conflict', error: match.error, activeRun: publicRun(state.activeRun) };
    const active = match.activeRun;
    if (active.executionAuthority === EXECUTION_AUTHORITY_TRACKER) {
      return { ok: false, status: 'conflict', error: 'mission_execution_authority_tracker', activeRun: publicRun(active) };
    }
    const snapshotSequence = Math.max(0, Math.round(Number(request.snapshotSequence) || 0));
    if (snapshotSequence && snapshotSequence <= active.lastSnapshotSequence) {
      return { ok: true, status: 'noop', reason: 'stale_snapshot', activeRun: publicRun(active) };
    }
    let resumeBundle;
    try {
      resumeBundle = safeResumeBundle(request.resumeBundle);
    } catch (error) {
      return { ok: false, status: 'error', error: error.code || error.message, activeRun: publicRun(active) };
    }
    if (resumeBundle) {
      active.resumeBundle = resumeBundle;
      const projected = executionProjection(resumeBundle);
      active.executionRecipe = projected.ok
        ? projected.recipe
        : cleanString(resumeBundle.adapter || resumeBundle.descriptor?.primaryAdapter, 80).toLowerCase() || active.executionRecipe;
      active.executionRevision = projected.ok ? projected.stateRevision : 0;
      active.executionStateHash = projected.ok ? projected.stateHash : null;
      active.executionState = projected.ok ? projected.state : null;
    }
    active.executionHandoff = null;
    if (snapshotSequence) active.lastSnapshotSequence = snapshotSequence;
    active.state = cleanString(request.state, 60).toLowerCase() || active.state;
    active.phase = cleanString(request.phase || request.missionPhase, 100).toLowerCase() || active.phase;
    active.stateHash = cleanString(request.stateHash, 160) || active.stateHash;
    active.revision += 1;
    active.updatedAt = now();
    active.lastCommandType = 'mission_snapshot_update';
    active.lastReason = cleanString(request.reason, 240) || 'runtime-snapshot';
    addEvent('snapshot', { missionId: active.missionId, runId: active.runId, clientId: active.ownerClientId, commandId: request.commandId });
    persist();
    return { ok: true, status: 'ok', activeRun: publicRun(active) };
  };

  const prepareExecutionAuthority = (request = {}) => {
    const match = activeMatches(request, { requireOwner: true });
    if (!match.ok) return { ok: false, status: 'conflict', error: match.error, activeRun: publicRun(state.activeRun) };
    const active = match.activeRun;
    if (active.executionAuthority !== EXECUTION_AUTHORITY_WEB) {
      return { ok: false, status: 'noop', error: 'mission_execution_authority_already_tracker', activeRun: publicRun(active) };
    }
    if (!Object.hasOwn(request, 'expectedRevision') || !Number.isSafeInteger(Number(request.expectedRevision))) {
      return { ok: false, status: 'error', error: 'expected_revision_required', activeRun: publicRun(active) };
    }
    if (Number(request.expectedRevision) !== active.revision) {
      return { ok: false, status: 'conflict', error: 'mission_revision_conflict', activeRun: publicRun(active) };
    }
    const expectedStateHash = cleanString(request.expectedStateHash, 180);
    if (!expectedStateHash) return { ok: false, status: 'error', error: 'expected_state_hash_required', activeRun: publicRun(active) };
    if (!active.stateHash || expectedStateHash !== active.stateHash) {
      return { ok: false, status: 'conflict', error: 'mission_state_hash_conflict', activeRun: publicRun(active) };
    }
    const projected = executionProjection(active.resumeBundle);
    if (!projected.ok) {
      return {
        ok: false,
        status: 'blocked',
        error: projected.error,
        driftFields: projected.driftFields || [],
        activeRun: publicRun(active)
      };
    }
    if (projected.recipe !== EXECUTION_HANDOFF_RECIPE) {
      return { ok: false, status: 'blocked', error: 'mission_execution_recipe_not_enabled', activeRun: publicRun(active) };
    }
    if (projected.phase !== 'planned' || projected.stateRevision !== 0 || projected.state.effects.length !== 0) {
      return { ok: false, status: 'blocked', error: 'mission_execution_handoff_phase_not_safe', activeRun: publicRun(active) };
    }
    const expectedExecutionStateHash = cleanString(request.expectedExecutionStateHash, 180);
    if (!expectedExecutionStateHash) {
      return { ok: false, status: 'error', error: 'expected_execution_state_hash_required', activeRun: publicRun(active) };
    }
    if (expectedExecutionStateHash !== projected.stateHash) {
      return { ok: false, status: 'conflict', error: 'mission_execution_state_hash_conflict', activeRun: publicRun(active) };
    }
    const previousState = jsonClone(state);
    const handoffId = `execution-handoff-${crypto.randomBytes(12).toString('hex')}`;
    active.executionRecipe = projected.recipe;
    active.executionRevision = projected.stateRevision;
    active.executionStateHash = projected.stateHash;
    active.executionState = projected.state;
    active.executionHandoff = {
      handoffId,
      status: 'prepared',
      recipe: projected.recipe,
      phase: projected.phase,
      authorityRevision: active.revision,
      stateHash: active.stateHash,
      executionStateHash: projected.stateHash,
      preparedAt: now()
    };
    active.revision += 1;
    active.updatedAt = now();
    active.lastCommandType = 'mission_execution_authority_prepare';
    active.lastReason = cleanString(request.reason, 240) || 'execution-authority-prepare';
    addEvent('execution_authority_prepared', {
      missionId: active.missionId,
      runId: active.runId,
      clientId: active.ownerClientId,
      commandId: request.commandId,
      reason: projected.recipe
    });
    if (!persist()) {
      state = previousState;
      return {
        ok: false,
        status: 'error',
        error: 'mission_execution_persist_failed',
        sideEffect: false,
        activeRun: publicRun(state.activeRun)
      };
    }
    return {
      ok: true,
      status: 'ok',
      executionAuthority: EXECUTION_AUTHORITY_WEB,
      sideEffect: false,
      handoff: publicExecutionHandoff(active.executionHandoff),
      activeRun: publicRun(active)
    };
  };

  const commitExecutionAuthority = (request = {}) => {
    const match = activeMatches(request, { requireOwner: true });
    if (!match.ok) return { ok: false, status: 'conflict', error: match.error, activeRun: publicRun(state.activeRun) };
    const active = match.activeRun;
    if (!executionAuthorityEnabled) {
      return {
        ok: false,
        status: 'blocked',
        error: 'mission_execution_authority_not_enabled',
        sideEffect: false,
        activeRun: publicRun(active)
      };
    }
    if (active.executionAuthority !== EXECUTION_AUTHORITY_WEB) {
      return {
        ok: true,
        status: 'noop',
        executionAuthority: EXECUTION_AUTHORITY_TRACKER,
        sideEffect: false,
        activeRun: publicRun(active)
      };
    }
    const handoff = safeObject(active.executionHandoff);
    if (!cleanString(handoff.handoffId, 220) || cleanString(request.handoffId, 220) !== handoff.handoffId) {
      return { ok: false, status: 'conflict', error: 'mission_execution_handoff_conflict', activeRun: publicRun(active) };
    }
    if (!Object.hasOwn(request, 'expectedRevision')
        || !Number.isSafeInteger(Number(request.expectedRevision))
        || Number(request.expectedRevision) !== active.revision) {
      return { ok: false, status: 'conflict', error: 'mission_revision_conflict', activeRun: publicRun(active) };
    }
    const projected = executionProjection(active.resumeBundle);
    if (!projected.ok || projected.recipe !== EXECUTION_HANDOFF_RECIPE) {
      return {
        ok: false,
        status: 'blocked',
        error: projected.error || 'mission_execution_recipe_not_enabled',
        activeRun: publicRun(active)
      };
    }
    if (cleanString(request.expectedExecutionStateHash, 180) !== projected.stateHash
        || handoff.executionStateHash !== projected.stateHash
        || handoff.stateHash !== active.stateHash) {
      return { ok: false, status: 'conflict', error: 'mission_execution_state_hash_conflict', activeRun: publicRun(active) };
    }
    const previousState = jsonClone(state);
    active.executionAuthority = EXECUTION_AUTHORITY_TRACKER;
    active.executionRecipe = projected.recipe;
    active.executionRevision = projected.stateRevision;
    active.executionStateHash = projected.stateHash;
    active.executionState = projected.state;
    active.executionWebStateHash = active.stateHash;
    active.executionAppliedEvents = 0;
    active.executionRuntimeContext = null;
    active.executionHandoff = null;
    active.phase = projected.phase;
    active.stateHash = projected.stateHash;
    active.revision += 1;
    active.updatedAt = now();
    active.lastCommandType = 'mission_execution_authority_commit';
    active.lastReason = cleanString(request.reason, 240) || 'execution-authority-commit';
    addEvent('execution_authority_committed', {
      missionId: active.missionId,
      runId: active.runId,
      clientId: active.ownerClientId,
      commandId: request.commandId,
      reason: projected.recipe
    });
    if (!persist()) {
      state = previousState;
      return {
        ok: false,
        status: 'error',
        error: 'mission_execution_persist_failed',
        sideEffect: false,
        activeRun: publicRun(state.activeRun)
      };
    }
    return {
      ok: true,
      status: 'ok',
      executionAuthority: EXECUTION_AUTHORITY_TRACKER,
      sideEffect: false,
      activeRun: publicRun(active)
    };
  };

  const rollbackExecutionAuthority = (request = {}) => {
    const match = activeMatches(request, { requireOwner: true });
    if (!match.ok) return { ok: false, status: 'conflict', error: match.error, activeRun: publicRun(state.activeRun) };
    const active = match.activeRun;
    if (active.executionAuthority !== EXECUTION_AUTHORITY_TRACKER) {
      return {
        ok: true,
        status: 'noop',
        executionAuthority: EXECUTION_AUTHORITY_WEB,
        sideEffect: false,
        activeRun: publicRun(active)
      };
    }
    if (!Object.hasOwn(request, 'expectedRevision')
        || !Number.isSafeInteger(Number(request.expectedRevision))
        || Number(request.expectedRevision) !== active.revision) {
      return { ok: false, status: 'conflict', error: 'mission_revision_conflict', activeRun: publicRun(active) };
    }
    if (cleanString(request.expectedStateHash, 180) !== active.stateHash) {
      return { ok: false, status: 'conflict', error: 'mission_state_hash_conflict', activeRun: publicRun(active) };
    }
    if (Math.max(0, Math.round(Number(active.executionAppliedEvents) || 0)) !== 0 || !active.executionWebStateHash) {
      return { ok: false, status: 'blocked', error: 'mission_execution_rollback_not_safe', activeRun: publicRun(active) };
    }
    const previousState = jsonClone(state);
    active.executionAuthority = EXECUTION_AUTHORITY_WEB;
    active.stateHash = active.executionWebStateHash;
    active.executionWebStateHash = null;
    active.executionHandoff = null;
    active.executionRuntimeContext = null;
    active.revision += 1;
    active.updatedAt = now();
    active.lastCommandType = 'mission_execution_authority_rollback';
    active.lastReason = cleanString(request.reason, 240) || 'execution-authority-rollback';
    addEvent('execution_authority_rolled_back', {
      missionId: active.missionId,
      runId: active.runId,
      clientId: active.ownerClientId,
      commandId: request.commandId
    });
    if (!persist()) {
      state = previousState;
      return {
        ok: false,
        status: 'error',
        error: 'mission_execution_persist_failed',
        sideEffect: false,
        activeRun: publicRun(state.activeRun)
      };
    }
    return {
      ok: true,
      status: 'ok',
      executionAuthority: EXECUTION_AUTHORITY_WEB,
      sideEffect: false,
      activeRun: publicRun(active)
    };
  };

  const applyExecutionEvent = (request = {}) => {
    const active = state.activeRun;
    if (!active) return { ok: false, status: 'conflict', error: 'no_active_run', activeRun: null };
    if (cleanString(request.missionId) !== active.missionId || cleanString(request.runId, 220) !== active.runId) {
      return { ok: false, status: 'conflict', error: 'mission_run_conflict', activeRun: publicRun(active) };
    }
    if (active.executionAuthority !== EXECUTION_AUTHORITY_TRACKER) {
      return { ok: false, status: 'blocked', error: 'mission_execution_authority_web', activeRun: publicRun(active) };
    }
    if (active.executionRecipe !== EXECUTION_HANDOFF_RECIPE) {
      return { ok: false, status: 'blocked', error: 'mission_execution_recipe_not_enabled', activeRun: publicRun(active) };
    }
    const rawEvent = safeObject(request.event);
    const eventId = cleanString(rawEvent.eventId || rawEvent.id, 220);
    if (!eventId) return { ok: false, status: 'error', error: 'mission_execution_event_id_required', activeRun: publicRun(active) };
    const currentState = executionCore.normalizeState(active.executionState);
    if (currentState.processedEventIds.includes(eventId)) {
      const priorEvent = (Array.isArray(safeObject(active.resumeBundle).executionReplay?.events)
        ? active.resumeBundle.executionReplay.events
        : []).find(item => cleanString(item?.eventId || item?.id, 220) === eventId);
      const duplicateEvent = executionCore.normalizeEvent(rawEvent, Number(priorEvent?.sequence) || 0);
      if (!priorEvent || !duplicateEvent
          || executionCore.canonicalStringify(priorEvent) !== executionCore.canonicalStringify(duplicateEvent)) {
        return { ok: false, status: 'conflict', error: 'mission_execution_event_id_conflict', activeRun: publicRun(active) };
      }
      return {
        ok: true,
        status: 'noop',
        duplicate: true,
        stateChanged: false,
        externalSideEffect: false,
        activeRun: publicRun(active),
        view: executionCore.deriveView(currentState)
      };
    }
    if (!Object.hasOwn(request, 'expectedRevision')
        || !Number.isSafeInteger(Number(request.expectedRevision))
        || Number(request.expectedRevision) !== active.revision) {
      return { ok: false, status: 'conflict', error: 'mission_revision_conflict', activeRun: publicRun(active) };
    }
    if (!Object.hasOwn(request, 'expectedExecutionRevision')
        || !Number.isSafeInteger(Number(request.expectedExecutionRevision))
        || Number(request.expectedExecutionRevision) !== active.executionRevision) {
      return { ok: false, status: 'conflict', error: 'mission_execution_revision_conflict', activeRun: publicRun(active) };
    }
    if (cleanString(request.expectedExecutionStateHash, 180) !== active.executionStateHash) {
      return { ok: false, status: 'conflict', error: 'mission_execution_state_hash_conflict', activeRun: publicRun(active) };
    }
    const event = executionCore.normalizeEvent(rawEvent, active.executionRevision + 1);
    if (!event) return { ok: false, status: 'error', error: 'mission_execution_event_invalid', activeRun: publicRun(active) };
    if (event.sequence !== active.executionRevision + 1) {
      return { ok: false, status: 'conflict', error: 'mission_execution_event_sequence_conflict', activeRun: publicRun(active) };
    }
    const nextState = executionCore.reduce(currentState, event);
    const currentHash = executionCore.stateHash(currentState);
    const nextHash = executionCore.stateHash(nextState);
    if (nextHash === currentHash) {
      return { ok: false, status: 'blocked', error: 'mission_execution_transition_blocked', activeRun: publicRun(active) };
    }
    const currentReplay = executionCore.normalizeBundle(safeObject(active.resumeBundle).executionReplay);
    if (!currentReplay) {
      return { ok: false, status: 'blocked', error: 'mission_execution_replay_required', activeRun: publicRun(active) };
    }
    if (currentReplay.events.length >= MAX_EXECUTION_EVENTS) {
      return { ok: false, status: 'blocked', error: 'mission_execution_event_log_full', activeRun: publicRun(active) };
    }
    const nextReplay = executionCore.normalizeBundle({
      ...currentReplay,
      events: currentReplay.events.concat(event)
    });
    if (!nextReplay) return { ok: false, status: 'error', error: 'mission_execution_replay_invalid', activeRun: publicRun(active) };
    const nextResumeBundle = jsonClone(active.resumeBundle);
    nextResumeBundle.executionReplay = nextReplay;
    nextResumeBundle.execution = executionCore.createReplayShadowEnvelope(nextReplay, {
      sourceRevision: active.revision + 1,
      legacyComparison: 'tracker_authority'
    });
    let persistedResumeBundle;
    try {
      persistedResumeBundle = safeResumeBundle(nextResumeBundle);
    } catch (error) {
      return { ok: false, status: 'error', error: error.code || error.message, activeRun: publicRun(active) };
    }
    const previousState = jsonClone(state);
    const previousEffectIds = new Set(currentState.effects.map(effect => effect.effectId));
    active.resumeBundle = persistedResumeBundle;
    active.executionState = nextState;
    active.executionRevision = nextState.revision;
    active.executionStateHash = nextHash;
    active.executionAppliedEvents = Math.max(0, Math.round(Number(active.executionAppliedEvents) || 0)) + 1;
    active.phase = nextState.phase;
    active.stateHash = nextHash;
    active.revision += 1;
    active.updatedAt = now();
    active.lastCommandType = 'mission_execution_event';
    active.lastReason = cleanString(request.reason || event.type, 240) || 'mission-execution-event';
    addEvent('execution_event', {
      missionId: active.missionId,
      runId: active.runId,
      clientId: cleanString(request.clientId, 220) || 'tracker-core',
      commandId: request.commandId,
      reason: event.type
    });
    if (!persist()) {
      state = previousState;
      return {
        ok: false,
        status: 'error',
        error: 'mission_execution_persist_failed',
        stateChanged: false,
        externalSideEffect: false,
        activeRun: publicRun(state.activeRun)
      };
    }
    return {
      ok: true,
      status: 'ok',
      stateChanged: true,
      externalSideEffect: false,
      acceptedEvent: { eventId: event.eventId, type: event.type, sequence: event.sequence },
      effects: nextState.effects.filter(effect => !previousEffectIds.has(effect.effectId)),
      view: executionCore.deriveView(nextState),
      activeRun: publicRun(active)
    };
  };

  const requestSnapshot = (request = {}) => {
    const active = state.activeRun;
    if (!active) return { ok: false, status: 'noop', error: 'no_active_run', activeRun: null, resumeBundle: null };
    const missionId = cleanString(request.missionId);
    const runId = cleanString(request.runId, 220);
    if ((missionId && missionId !== active.missionId) || (runId && runId !== active.runId)) {
      return { ok: false, status: 'conflict', error: 'mission_run_conflict', activeRun: publicRun(active), resumeBundle: null };
    }
    return { ok: true, status: active.resumeBundle ? 'ok' : 'noop', activeRun: publicRun(active), resumeBundle: jsonClone(active.resumeBundle) };
  };

  const getExecutionSnapshot = () => {
    const active = state.activeRun;
    if (!active?.missionId || !active?.runId || !active.executionState) return null;
    const executionState = executionCore.normalizeState(active.executionState);
    return {
      schema: 'ga.mission-execution-authority-snapshot.v1',
      missionId: active.missionId,
      runId: active.runId,
      executionAuthority: active.executionAuthority === EXECUTION_AUTHORITY_TRACKER
        ? EXECUTION_AUTHORITY_TRACKER
        : EXECUTION_AUTHORITY_WEB,
      recipe: cleanString(active.executionRecipe || executionState.recipe, 80).toLowerCase() || null,
      authorityRevision: Math.max(1, Math.round(Number(active.revision) || 1)),
      executionRevision: Math.max(0, Math.round(Number(active.executionRevision) || 0)),
      executionStateHash: cleanString(active.executionStateHash, 180) || null,
      updatedAt: Number(active.updatedAt || 0) || null,
      location: executionLocationProjection(active.resumeBundle),
      state: jsonClone(executionState),
      view: executionCore.deriveView(executionState)
    };
  };

  const finalizeExecutionRun = (request = {}) => {
    const active = state.activeRun;
    if (!active) return { ok: true, status: 'noop', activeRun: null, releasedRun: publicRun(state.lastRun) };
    if (active.executionAuthority !== EXECUTION_AUTHORITY_TRACKER) {
      return { ok: false, status: 'blocked', error: 'mission_execution_authority_web', activeRun: publicRun(active) };
    }
    const executionState = executionCore.normalizeState(active.executionState);
    if (executionState.phase !== 'closed' || executionState.flags.closed !== true) {
      return { ok: false, status: 'blocked', error: 'mission_execution_not_closed', activeRun: publicRun(active) };
    }
    if (executionState.effects.some(effect => effect.status === 'requested')) {
      return { ok: false, status: 'blocked', error: 'mission_execution_effects_pending', activeRun: publicRun(active) };
    }
    const previousState = jsonClone(state);
    active.active = false;
    active.state = 'completed';
    active.phase = 'closed';
    active.revision += 1;
    active.updatedAt = now();
    active.lastCommandType = 'mission_execution_finalize';
    active.lastReason = cleanString(request.reason, 240) || 'tracker-execution-closed';
    state.lastRun = normalizeStoredRun(active);
    state.activeRun = null;
    addEvent('execution_finalized', {
      missionId: active.missionId,
      runId: active.runId,
      clientId: cleanString(request.clientId, 220) || 'tracker-execution-runtime',
      commandId: request.commandId,
      reason: active.lastReason
    });
    if (!persist()) {
      state = previousState;
      return {
        ok: false,
        status: 'error',
        error: 'mission_execution_persist_failed',
        activeRun: publicRun(state.activeRun)
      };
    }
    return { ok: true, status: 'ok', outcome: 'completed', releasedRun: publicRun(state.lastRun), activeRun: null };
  };

  const abortExecutionRun = (request = {}) => {
    const active = state.activeRun;
    if (!active) return { ok: true, status: 'noop', outcome: 'aborted', activeRun: null, releasedRun: publicRun(state.lastRun) };
    if (active.executionAuthority !== EXECUTION_AUTHORITY_TRACKER) {
      return { ok: false, status: 'blocked', error: 'mission_execution_authority_web', activeRun: publicRun(active) };
    }
    const missionId = cleanString(request.missionId);
    const runId = cleanString(request.runId, 220);
    if (missionId !== active.missionId || runId !== active.runId) {
      return { ok: false, status: 'conflict', error: 'mission_run_conflict', activeRun: publicRun(active) };
    }
    if (!Object.hasOwn(request, 'expectedRevision')
        || !Number.isSafeInteger(Number(request.expectedRevision))
        || Number(request.expectedRevision) < 0) {
      return { ok: false, status: 'error', error: 'expected_revision_required', activeRun: publicRun(active) };
    }
    if (Number(request.expectedRevision) !== Number(active.revision)) {
      return { ok: false, status: 'conflict', error: 'mission_revision_conflict', activeRun: publicRun(active) };
    }
    const executionState = executionCore.normalizeState(active.executionState);
    if (!executionCore.deriveView(executionState).allowedActions.includes('abort_mission')) {
      return { ok: false, status: 'blocked', error: 'mission_intent_not_allowed_in_state', activeRun: publicRun(active) };
    }
    const previousState = jsonClone(state);
    active.active = false;
    active.state = 'aborted';
    active.phase = 'closed';
    active.revision += 1;
    active.updatedAt = now();
    active.lastCommandType = 'mission_execution_abort';
    active.lastReason = cleanString(request.reason, 240) || 'tracker-execution-aborted';
    state.lastRun = normalizeStoredRun(active);
    state.activeRun = null;
    addEvent('execution_aborted', {
      missionId: active.missionId,
      runId: active.runId,
      clientId: cleanString(request.clientId, 220) || 'tracker-execution-runtime',
      commandId: request.commandId,
      reason: active.lastReason
    });
    if (!persist()) {
      state = previousState;
      return {
        ok: false,
        status: 'error',
        error: 'mission_execution_persist_failed',
        activeRun: publicRun(state.activeRun)
      };
    }
    return { ok: true, status: 'ok', outcome: 'aborted', releasedRun: publicRun(state.lastRun), activeRun: null };
  };

  const release = (request = {}) => {
    const match = activeMatches(request, { requireOwner: true });
    if (!match.ok) return { ok: false, status: 'conflict', error: match.error, activeRun: publicRun(state.activeRun) };
    const active = match.activeRun;
    let resumeBundle;
    try {
      resumeBundle = safeResumeBundle(request.resumeBundle);
    } catch (error) {
      return { ok: false, status: 'error', error: error.code || error.message, activeRun: publicRun(state.activeRun) };
    }
    if (resumeBundle) active.resumeBundle = resumeBundle;
    const outcome = cleanString(request.outcome || request.state, 60).toLowerCase() || 'aborted';
    active.active = false;
    active.state = outcome === 'completed' ? 'completed' : 'ended';
    active.phase = 'closed';
    active.revision += 1;
    active.updatedAt = now();
    active.lastCommandType = 'mission_authority_release';
    active.lastReason = cleanString(request.reason, 240) || outcome;
    state.lastRun = normalizeStoredRun(active);
    state.activeRun = null;
    addEvent('released', { missionId: active.missionId, runId: active.runId, clientId: active.ownerClientId, commandId: request.commandId, reason: outcome });
    persist();
    return { ok: true, status: 'ok', outcome, releasedRun: publicRun(state.lastRun), activeRun: null };
  };

  const releaseLegacy = (request = {}) => {
    const active = state.activeRun;
    const missionId = cleanString(request.missionId);
    if (!active) return { ok: true, status: 'noop', outcome: 'ended', activeRun: null };
    if (!missionId || missionId !== active.missionId) {
      return { ok: false, status: 'conflict', error: 'mission_authority_conflict', activeRun: publicRun(active) };
    }
    active.active = false;
    active.state = 'ended';
    active.phase = 'closed';
    active.revision += 1;
    active.updatedAt = now();
    active.lastCommandType = 'mission_lifecycle';
    active.lastReason = cleanString(request.reason, 240) || 'legacy-terminal-lifecycle';
    state.lastRun = normalizeStoredRun(active);
    state.activeRun = null;
    addEvent('released_legacy', { missionId, runId: active.runId, clientId: active.ownerClientId, commandId: request.commandId, reason: request.state });
    persist();
    return { ok: true, status: 'ok', outcome: cleanString(request.state, 60) || 'ended', releasedRun: publicRun(state.lastRun), activeRun: null };
  };

  const recordCommand = (command = {}) => {
    const active = state.activeRun;
    if (!active || cleanString(command.missionId) !== active.missionId) return publicRun(active);
    const type = commandType(command);
    const stateValue = cleanString(command.state, 60).toLowerCase();
    const phase = cleanString(command.missionPhase, 100).toLowerCase();
    if (stateValue && !TERMINAL_STATES.has(stateValue)) active.state = stateValue;
    if (phase) active.phase = phase;
    active.lastCommandType = type || active.lastCommandType;
    active.lastReason = cleanString(command.reason, 240) || active.lastReason;
    active.revision += 1;
    active.updatedAt = now();
    const commandId = cleanString(command.commandId, 220);
    if (commandId && /^mission_(scene|smoke)_/.test(type)) {
      const exists = active.effects.some(effect => effect.commandId === commandId);
      if (!exists) {
        active.effects.push({
          commandId,
          type,
          sceneId: cleanString(command.sceneId, 220) || null,
          status: 'requested',
          requestedAt: now(),
          completedAt: null,
          error: null,
          managerSessionId,
          ack: null
        });
        active.effects = active.effects.slice(-MAX_EFFECTS);
      } else {
        const existing = active.effects.find(effect => effect.commandId === commandId);
        if (existing && !existing.completedAt && existing.managerSessionId !== managerSessionId) {
          existing.status = 'requested';
          existing.requestedAt = now();
          existing.completedAt = null;
          existing.error = null;
          existing.managerSessionId = managerSessionId;
          existing.ack = null;
        }
      }
    }
    persist();
    return publicRun(active);
  };

  const recordEffectAck = (ack = {}) => {
    const active = state.activeRun;
    const commandId = cleanString(ack.commandId, 220);
    if (!active || !commandId) return false;
    const effect = active.effects.find(item => item.commandId === commandId);
    if (!effect) return false;
    const expectedAckType = effect.type === 'mission_scene_clear_all'
      ? 'mission_scene_clear_ack'
      : `${effect.type}_ack`;
    if (cleanString(ack.type, 140).toLowerCase() !== expectedAckType) return false;
    effect.status = cleanString(ack.status, 60) || 'ok';
    effect.error = cleanString(ack.error, 240) || null;
    effect.completedAt = now();
    effect.ack = effectAckSummary(ack);
    active.updatedAt = now();
    persist();
    return true;
  };

  const beginExecutionEffectDispatch = (command = {}) => {
    const active = state.activeRun;
    const commandId = cleanString(command.commandId, 220);
    const type = commandType(command);
    if (!active || !commandId) {
      return { ok: false, status: 'blocked', error: !active ? 'no_active_run' : 'mission_effect_command_id_required', sideEffect: false };
    }
    if (active.executionAuthority !== EXECUTION_AUTHORITY_TRACKER) {
      return { ok: false, status: 'blocked', error: 'mission_execution_authority_web', sideEffect: false };
    }
    if (cleanString(command.missionId) !== active.missionId || cleanString(command.runId, 220) !== active.runId) {
      return { ok: false, status: 'conflict', error: 'mission_run_conflict', sideEffect: false };
    }
    if (!/^mission_(scene|smoke)_/.test(type)) {
      return { ok: false, status: 'blocked', error: 'mission_effect_command_not_allowed', sideEffect: false };
    }
    const existing = active.effects.find(effect => effect.commandId === commandId) || null;
    if (existing?.completedAt) {
      return {
        ok: true,
        status: 'completed',
        duplicate: true,
        sideEffect: false,
        effect: publicEffect(existing),
        replayAck: effectAckSummary(existing.ack)
      };
    }
    if (existing && existing.managerSessionId !== managerSessionId) {
      return {
        ok: false,
        status: 'blocked',
        error: 'mission_effect_recovery_confirmation_required',
        recoveryRequired: true,
        sideEffect: false,
        effect: publicEffect(existing)
      };
    }
    if (existing) {
      return { ok: true, status: 'pending', duplicate: true, sideEffect: false, effect: publicEffect(existing) };
    }
    recordCommand(command);
    const recorded = active.effects.find(effect => effect.commandId === commandId) || null;
    return { ok: true, status: 'ok', sideEffect: false, effect: publicEffect(recorded) };
  };

  const getExecutionPayloadRecovery = (request = {}) => {
    const active = state.activeRun;
    if (!active?.missionId || !active?.runId) return null;
    const missionId = cleanString(request.missionId);
    const runId = cleanString(request.runId, 220);
    if ((missionId && missionId !== active.missionId) || (runId && runId !== active.runId)) return null;
    return jsonClone(normalizeExecutionPayloadRecovery(active.executionPayloadRecovery));
  };

  // A terminal run is retained locally so that the first payload write of a
  // replacement run can use its original baseline instead of treating a
  // stranded mission load as the new aircraft baseline.
  const getLastExecutionPayloadRecovery = (request = {}) => {
    const previous = state.lastRun;
    if (!previous?.missionId || !previous?.runId) return null;
    const missionId = cleanString(request.missionId);
    const runId = cleanString(request.runId, 220);
    if (missionId === previous.missionId && runId === previous.runId) return null;
    const recovery = normalizeExecutionPayloadRecovery(previous.executionPayloadRecovery);
    if (!recovery) return null;
    return {
      missionId: previous.missionId,
      runId: previous.runId,
      recovery: jsonClone(recovery)
    };
  };

  const recordExecutionPayloadRecovery = (request = {}) => {
    const match = activeMatches(request);
    if (!match.ok) return { ok: false, status: 'conflict', error: match.error, recovery: null };
    const active = match.activeRun;
    if (!cleanString(request.missionId) || !cleanString(request.runId, 220)) {
      return { ok: false, status: 'error', error: 'mission_payload_recovery_credentials_required', recovery: null };
    }
    if (active.executionAuthority !== EXECUTION_AUTHORITY_TRACKER) {
      return { ok: false, status: 'blocked', error: 'mission_execution_authority_web', recovery: null };
    }
    const action = cleanString(request.action, 60).toLowerCase();
    const current = normalizeExecutionPayloadRecovery(active.executionPayloadRecovery);
    const timestamp = now();
    let next = current;
    let changed = false;
    if (action === 'capture') {
      if (current) {
        return { ok: true, status: 'noop', recovery: jsonClone(current) };
      }
      const baseline = normalizePayloadRecoveryBaseline(request.baseline);
      if (!baseline) return { ok: false, status: 'error', error: 'mission_payload_baseline_required', recovery: null };
      next = normalizeExecutionPayloadRecovery({
        baseline,
        capturedAt: timestamp,
        writeAttempted: false,
        restoreAttempts: 0,
        detachedInheritedEquipmentIds: [],
        restored: false
      });
      changed = true;
    } else {
      if (!current) return { ok: false, status: 'error', error: 'mission_payload_baseline_missing', recovery: null };
      if (action === 'write_attempted') {
        if (!current.writeAttempted || current.restored) {
          next = { ...current, writeAttempted: true, writeAttemptedAt: timestamp, restored: false, restoredAt: null, lastError: null };
          changed = true;
        }
      } else if (action === 'restore_attempt') {
        next = {
          ...current,
          restoreAttempts: Math.min(100, current.restoreAttempts + 1),
          lastRestoreAttemptAt: timestamp,
          lastError: null
        };
        changed = true;
      } else if (action === 'restored') {
        if (!current.restored || current.lastError) {
          next = { ...current, restored: true, restoredAt: timestamp, lastError: null };
          changed = true;
        }
      } else if (action === 'restore_failed') {
        next = { ...current, restored: false, restoredAt: null, lastError: cleanString(request.error, 240) || 'mission_payload_restore_failed' };
        changed = true;
      } else if (action === 'detach_inherited') {
        const item = safeObject(request.item);
        const itemId = cleanString(item.id, 120);
        if (!itemId) return { ok: false, status: 'error', error: 'mission_payload_equipment_id_required', recovery: jsonClone(current) };
        if (current.detachedInheritedEquipmentIds.includes(itemId)) {
          return { ok: true, status: 'noop', recovery: jsonClone(current) };
        }
        const detached = payloadCore.detachInheritedEquipmentFromBaseline({
          ...item,
          id: itemId,
          persistentEquipment: true,
          persistentEquipmentInherited: true
        }, current.baseline);
        if (!detached?.baseline) {
          return { ok: false, status: 'error', error: 'mission_payload_equipment_baseline_adjust_failed', recovery: jsonClone(current) };
        }
        next = {
          ...current,
          baseline: detached.baseline,
          detachedInheritedEquipmentIds: current.detachedInheritedEquipmentIds.concat(itemId).slice(-80)
        };
        changed = true;
      } else {
        return { ok: false, status: 'error', error: 'mission_payload_recovery_action_invalid', recovery: jsonClone(current) };
      }
    }
    if (!changed) return { ok: true, status: 'noop', recovery: jsonClone(current) };
    const previousRecovery = active.executionPayloadRecovery;
    active.executionPayloadRecovery = normalizeExecutionPayloadRecovery(next);
    if (!persist()) {
      active.executionPayloadRecovery = previousRecovery;
      return {
        ok: false,
        status: 'error',
        error: 'mission_payload_recovery_persist_failed',
        recovery: jsonClone(normalizeExecutionPayloadRecovery(previousRecovery))
      };
    }
    log(`MISSION_PAYLOAD_RECOVERY action=${action} mission=${active.missionId} run=${active.runId}`);
    return { ok: true, status: 'ok', recovery: jsonClone(active.executionPayloadRecovery) };
  };

  const getExecutionRuntimeContext = (request = {}) => {
    const active = state.activeRun;
    if (!active?.missionId || !active?.runId) return null;
    const missionId = cleanString(request.missionId);
    const runId = cleanString(request.runId, 220);
    if ((missionId && missionId !== active.missionId) || (runId && runId !== active.runId)) return null;
    return jsonClone(normalizeExecutionRuntimeContext(active.executionRuntimeContext));
  };

  const recordExecutionRuntimeContext = (request = {}) => {
    const match = activeMatches(request);
    if (!match.ok) return { ok: false, status: 'conflict', error: match.error, context: null };
    const active = match.activeRun;
    if (!cleanString(request.missionId) || !cleanString(request.runId, 220)) {
      return { ok: false, status: 'error', error: 'mission_runtime_context_credentials_required', context: null };
    }
    if (active.executionAuthority !== EXECUTION_AUTHORITY_TRACKER) {
      return { ok: false, status: 'blocked', error: 'mission_execution_authority_web', context: null };
    }
    const normalized = normalizeExecutionRuntimeContext({
      ...safeObject(request.context),
      schema: EXECUTION_RUNTIME_CONTEXT_SCHEMA,
      version: 1,
      missionId: active.missionId,
      runId: active.runId,
      updatedAt: now()
    });
    if (!normalized) return { ok: false, status: 'error', error: 'mission_runtime_context_invalid', context: null };
    const previous = active.executionRuntimeContext;
    if (executionCore.canonicalStringify(previous) === executionCore.canonicalStringify(normalized)) {
      return { ok: true, status: 'noop', context: jsonClone(normalized) };
    }
    active.executionRuntimeContext = normalized;
    if (!persist()) {
      active.executionRuntimeContext = previous;
      return {
        ok: false,
        status: 'error',
        error: 'mission_runtime_context_persist_failed',
        context: jsonClone(normalizeExecutionRuntimeContext(previous))
      };
    }
    return { ok: true, status: 'ok', context: jsonClone(normalized) };
  };

  load();

  return {
    acquire,
    applyExecutionEvent,
    commitExecutionAuthority,
    takeover,
    validate,
    updateSnapshot,
    prepareExecutionAuthority,
    requestSnapshot,
    rollbackExecutionAuthority,
    release,
    releaseLegacy,
    beginExecutionEffectDispatch,
    recordCommand,
    recordEffectAck,
    getExecutionPayloadRecovery,
    getLastExecutionPayloadRecovery,
    recordExecutionPayloadRecovery,
    getExecutionRuntimeContext,
    recordExecutionRuntimeContext,
    getExecutionSnapshot,
    abortExecutionRun,
    finalizeExecutionRun,
    getPublicSnapshot(options = {}) {
      return {
        schema: STATE_SCHEMA,
        version: STATE_VERSION,
        activeRun: publicRun(state.activeRun, { includeBundle: options.includeBundle === true }),
        execution: publicExecutionSnapshot(state.activeRun),
        lastRun: publicRun(state.lastRun, { includeBundle: options.includeBundle === true }),
        lastExecution: publicExecutionSnapshot(state.lastRun),
        updatedAt: Number(state.activeRun?.updatedAt || state.lastRun?.updatedAt || 0) || null
      };
    },
    getActiveRun(options = {}) {
      return publicRun(state.activeRun, {
        includeBundle: options.includeBundle === true,
        includeEffects: options.includeEffects === true
      });
    },
    isAuthorityCommand(command = {}) {
      return AUTHORITY_COMMANDS.has(commandType(command));
    }
  };
}

module.exports = {
  EXECUTION_AUTHORITY_TRACKER,
  EXECUTION_AUTHORITY_WEB,
  EXECUTION_PAYLOAD_RECOVERY_SCHEMA,
  EXECUTION_RUNTIME_CONTEXT_SCHEMA,
  STATE_SCHEMA,
  STATE_VERSION,
  createMissionAuthorityManager,
  isMissionCommand
};
