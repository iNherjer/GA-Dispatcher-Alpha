'use strict';

const executionCore = require('../mission-execution-core.js');
const locationCore = require('../mission-location-core.js');
const manifestCore = require('../mission-manifest-core.js');
const complianceCore = require('../mission-compliance-domain-core.js');
const farewellVoiceCore = require('../mission-farewell-voice-core.js');
const flightRecorderCore = require('../mission-flight-recorder-core.js');

const AIRBORNE_EVIDENCE_MS = 2000;
const GROUND_STILL_EVIDENCE_MS = 3000;
const GROUND_STILL_MAX_GS_KTS = 3;
const RELOAD_MAX_DISTANCE_M = 45;
const RUNTIME_CONTEXT_PERSIST_INTERVAL_MS = 5000;
const COMPLIANCE_REQUESTED_ITEM_IDS = new Set(['bordbuch', 'fire-extinguisher', 'first-aid']);
const SYSTEM_EVENT_TYPES = new Set([
  'BOARDING_STARTED',
  'BOARDING_SCENE_CONFIRMED',
  'BOARDING_CONFIRMED',
  'LOAD_CONFIRMED',
  'PAX_DEBOARDING_CONFIRMED',
  'FAREWELL_STARTED',
  'FAREWELL_COMPLETED',
  'COMPLIANCE_INSPECTORS_WAITING',
  'COMPLIANCE_REQUEST_COMPLETED',
  'COMPLIANCE_RESULT_COMPLETED',
  'COMPLIANCE_RELEASED',
  'MISSION_CLOSED'
]);
const INTENT_EVENT_TYPES = Object.freeze({
  prepare_mission: 'PREPARE_REQUESTED',
  start_boarding: 'BOARDING_STARTED',
  confirm_load: 'LOAD_CONFIRMATION_REQUESTED',
  start_mission: 'MISSION_STARTED',
  confirm_pickup: 'PICKUP_CONFIRMED',
  confirm_unload: 'UNLOAD_CONFIRMED',
  request_close: 'CLOSE_REQUESTED'
});
const DEFERRED_INTENTS = new Set([
  'request_voice_playback',
  'abort_mission',
  'reset_mission'
]);

function cleanString(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatLogTime(timestamp) {
  return new Date(Number(timestamp) || Date.now()).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}

function seededInt(min, max, seed = '') {
  let hash = 2166136261;
  for (const character of String(seed)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return min + ((hash >>> 0) % (max - min + 1));
}

function replacementExpiryDate(seed, issuedAt) {
  const date = new Date(Number(issuedAt) || Date.now());
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + seededInt(21, 42, seed));
  return date.toISOString().slice(0, 10);
}

function errorResult(error, details = {}) {
  return { ok: false, status: 'blocked', error, sideEffect: false, ...details };
}

function noopResult(authorityManager, snapshot, details = {}) {
  return {
    ok: true,
    status: 'noop',
    sideEffect: false,
    executionAuthority: 'tracker',
    activeRun: authorityManager.getActiveRun(),
    view: snapshot.view,
    ...details
  };
}

function createTrackerMissionExecutionAdapter(options = {}) {
  const authorityManager = options.authorityManager;
  if (!authorityManager || typeof authorityManager.getExecutionSnapshot !== 'function'
      || typeof authorityManager.applyExecutionEvent !== 'function') {
    throw new TypeError('mission_execution_authority_manager_required');
  }
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const random = typeof options.random === 'function' ? options.random : () => Math.random();
  const flightLog = options.flightLog && typeof options.flightLog === 'object' ? options.flightLog : null;
  const observations = {
    runKey: null,
    airborneCandidateAt: null,
    groundStillCandidateAt: null,
    lastPosition: null,
    farewellVoiceRecipe: null,
    flightRecorder: flightRecorderCore.createState(),
    arrivalFlightRecord: null,
    missionFlightRecord: null,
    lastFinalizedSegmentStartTs: null,
    segmentDepartureLabel: null,
    recorderLowSpeedSince: null,
    latestTelemetry: null,
    latestDestination: null,
    lastGpsTick: null,
    smoothedVsFpm: 0,
    runtimeContextPersistedAt: 0
  };

  const current = () => authorityManager.getExecutionSnapshot();

  const farewellAuthorityContext = () => {
    const run = authorityManager.getActiveRun?.({ includeBundle: true }) || null;
    const plan = safeObject(run?.resumeBundle?.executionEffectPlan);
    return farewellVoiceCore.normalizeContext(
      safeObject(safeObject(plan.effects)['voice.farewell']).context
    );
  };

  const missionFlightLabels = () => {
    const flight = safeObject(farewellAuthorityContext()?.flight);
    const run = authorityManager.getActiveRun?.({ includeBundle: true }) || null;
    const missionState = safeObject(run?.resumeBundle?.missionState);
    const mission = safeObject(missionState.currentMissionData || missionState);
    return {
      depLabel: cleanString(flight.depLabel || mission.start, 180) || 'START',
      arrLabel: cleanString(flight.arrLabel || mission.dest, 180) || 'LANDUNG'
    };
  };

  const boardBookEndpointLabel = field => {
    const labels = missionFlightLabels();
    return field === 'landing' ? labels.arrLabel : labels.depLabel;
  };

  const segmentLabels = destination => {
    const flight = missionFlightLabels();
    return {
      depLabel: cleanString(observations.segmentDepartureLabel || flight.depLabel, 180) || 'START',
      arrLabel: destination?.atDestination === true
        ? (cleanString(flight.arrLabel, 180) || 'LANDUNG')
        : 'ZWISCHENLANDUNG'
    };
  };

  const buildSegmentRecord = (state, observedAt, destination = observations.latestDestination) => {
    const recorder = flightRecorderCore.createState(state);
    const labels = segmentLabels(destination);
    const record = flightRecorderCore.buildRecord(recorder, {
      now: observedAt,
      depLabel: labels.depLabel,
      arrLabel: labels.arrLabel
    });
    if (!record) return null;
    return {
      ...record,
      startTs: recorder.startTs || null,
      endTs: observedAt || null,
      createdAt: observedAt || null,
      segmentCount: 1
    };
  };

  const finalizeSegment = (snapshot, record, reason = 'stable-landing') => {
    if (!record?.startTs || Number(record.startTs) === Number(observations.lastFinalizedSegmentStartTs || 0)) return null;
    observations.missionFlightRecord = flightRecorderCore.mergeRecords([
      observations.missionFlightRecord,
      record
    ].filter(Boolean));
    observations.lastFinalizedSegmentStartTs = Number(record.startTs);
    observations.segmentDepartureLabel = cleanString(record.arrLabel, 180) || observations.segmentDepartureLabel;
    try {
      flightLog?.recordSegment?.({
        missionId: snapshot.missionId,
        runId: snapshot.runId,
        reason,
        record,
        missionRecord: observations.missionFlightRecord
      });
    } catch (_) {}
    return record;
  };

  const missionRecord = (snapshot = current(), observedAt = null) => {
    if (!snapshot) return observations.missionFlightRecord;
    const at = Math.max(0, Math.round(Number(observedAt || observations.latestTelemetry?.observedAt || now()) || 0));
    const currentSegment = Number(observations.flightRecorder?.startTs || 0) !== Number(observations.lastFinalizedSegmentStartTs || 0)
      ? buildSegmentRecord(observations.flightRecorder, at)
      : null;
    return flightRecorderCore.mergeRecords([
      observations.missionFlightRecord,
      currentSegment
    ].filter(Boolean));
  };

  const persistRuntimeContext = (snapshot, force = false) => {
    if (typeof authorityManager.recordExecutionRuntimeContext !== 'function') return { ok: true, status: 'unavailable' };
    const observedAt = Math.max(0, Math.round(Number(observations.latestTelemetry?.observedAt || now()) || 0));
    if (!force && observations.runtimeContextPersistedAt > 0
        && observedAt - observations.runtimeContextPersistedAt < RUNTIME_CONTEXT_PERSIST_INTERVAL_MS) {
      return { ok: true, status: 'deferred' };
    }
    const result = authorityManager.recordExecutionRuntimeContext({
      missionId: snapshot.missionId,
      runId: snapshot.runId,
      context: {
        flightRecorder: observations.flightRecorder,
        arrivalFlightRecord: observations.arrivalFlightRecord,
        missionFlightRecord: observations.missionFlightRecord,
        lastFinalizedSegmentStartTs: observations.lastFinalizedSegmentStartTs,
        segmentDepartureLabel: observations.segmentDepartureLabel,
        recorderLowSpeedSince: observations.recorderLowSpeedSince,
        latestTelemetry: observations.latestTelemetry,
        latestDestination: observations.latestDestination
      }
    });
    if (result?.ok) observations.runtimeContextPersistedAt = observedAt;
    return result;
  };

  const getFarewellDynamicContext = () => {
    const snapshot = current();
    if (!snapshot) return null;
    resetObservationIfNeeded(snapshot);
    persistRuntimeContext(snapshot, true);
    const authorityContext = farewellAuthorityContext();
    const flight = missionFlightLabels();
    const currentAt = Math.max(0, Math.round(Number(observations.latestTelemetry?.observedAt || now()) || 0));
    const currentRecord = flightRecorderCore.buildRecord(observations.flightRecorder, {
      now: currentAt,
      depLabel: cleanString(observations.segmentDepartureLabel || flight.depLabel, 180) || 'START',
      arrLabel: cleanString(flight.arrLabel, 180) || 'LANDUNG'
    }) || {};
    if (Object.keys(currentRecord).length) {
      currentRecord.startTs = observations.flightRecorder.startTs || null;
      currentRecord.endTs = currentAt;
      currentRecord.createdAt = currentAt;
      currentRecord.segmentCount = 1;
    }
    const record = { ...(observations.arrivalFlightRecord || currentRecord) };
    const latest = safeObject(observations.latestTelemetry);
    const stressRecord = {
      ...record,
      maxGForce: Math.max(Number(record.maxGForce || 1), Number(latest.gForce || 1)),
      maxBankDeg: Math.max(Math.abs(Number(record.maxBankDeg || 0)), Math.abs(Number(latest.bankDeg || 0))),
      maxDescentFpm: Math.min(Number(record.maxDescentFpm || 0), Number(latest.vsFpm || 0)),
      touchdownVsFpm: record.touchdownVsFpm != null ? record.touchdownVsFpm : latest.touchdownFpm
    };
    const cargoOutcome = flightRecorderCore.evaluateFarewellOutcome(
      snapshot.state.manifest,
      stressRecord,
      { motionProtectionEnabled: authorityContext?.motionProtectionEnabled === true }
    );
    record.missionCargoOutcome = cargoOutcome;
    record.missionFailed = cargoOutcome.failed === true;
    return {
      record,
      cargoOutcome,
      missionFailed: cargoOutcome.failed === true,
      liveWeather: observations.latestTelemetry || null
    };
  };

  const validateSnapshot = (request = {}) => {
    const snapshot = current();
    if (!snapshot) return errorResult('no_active_run', { activeRun: null });
    if (snapshot.executionAuthority !== 'tracker') {
      return errorResult('mission_execution_authority_web', { activeRun: authorityManager.getActiveRun() });
    }
    if (snapshot.recipe !== 'apt') {
      return errorResult('mission_execution_recipe_not_enabled', { activeRun: authorityManager.getActiveRun() });
    }
    const missionId = cleanString(request.missionId);
    const runId = cleanString(request.runId, 220);
    if ((missionId && missionId !== snapshot.missionId) || (runId && runId !== snapshot.runId)) {
      return errorResult('mission_run_conflict', { activeRun: authorityManager.getActiveRun() });
    }
    if (Object.hasOwn(request, 'expectedRevision')
        && Number(request.expectedRevision) !== snapshot.authorityRevision) {
      return {
        ok: false,
        status: 'conflict',
        error: 'mission_revision_conflict',
        sideEffect: false,
        activeRun: authorityManager.getActiveRun()
      };
    }
    return { ok: true, snapshot };
  };

  const validateIntent = (request = {}) => {
    const commandId = cleanString(request.commandId, 220);
    const intent = cleanString(request.intent || request.action, 80).toLowerCase();
    if (!commandId) return errorResult('command_id_required');
    const validated = validateSnapshot(request);
    if (!validated.ok) return validated;
    if (!validated.snapshot.view.allowedActions.includes(intent)) {
      return errorResult('mission_intent_not_allowed_in_state', {
        activeRun: authorityManager.getActiveRun(),
        view: validated.snapshot.view
      });
    }
    return { ok: true, intent, snapshot: validated.snapshot };
  };

  const submitEvent = (snapshot, type, payload, eventId, reason) => {
    const result = authorityManager.applyExecutionEvent({
      missionId: snapshot.missionId,
      runId: snapshot.runId,
      expectedRevision: snapshot.authorityRevision,
      expectedExecutionRevision: snapshot.executionRevision,
      expectedExecutionStateHash: snapshot.executionStateHash,
      clientId: 'tracker-execution-adapter',
      commandId: cleanString(eventId, 220),
      reason: cleanString(reason || type, 240),
      event: {
        eventId: cleanString(eventId, 220),
        type,
        sequence: snapshot.executionRevision + 1,
        occurredAt: Math.max(0, Math.round(Number(now()) || 0)),
        payload: safeObject(payload)
      }
    });
    return {
      ...result,
      executionAuthority: 'tracker',
      sideEffect: false,
      effectsPending: Array.isArray(result.effects) ? result.effects : []
    };
  };

  const complianceAllowsItem = (snapshot, itemId) => {
    const compliance = safeObject(snapshot.state.workflows?.complianceInspection);
    if (compliance.selected !== true || compliance.released === true) return true;
    if (!COMPLIANCE_REQUESTED_ITEM_IDS.has(String(itemId || ''))) return true;
    return !['result_playing', 'departing'].includes(String(compliance.phase || ''));
  };

  const reloadFacts = item => {
    const position = safeObject(observations.lastPosition);
    const itemLat = finite(item?.unloadLat);
    const itemLon = finite(item?.unloadLon);
    const currentLat = finite(position.lat);
    const currentLon = finite(position.lon);
    // App parity: an old/unpositioned unload remains reloadable. Once the
    // unload has coordinates, however, a current tracker position is required.
    if (itemLat == null || itemLon == null || (itemLat === 0 && itemLon === 0)) {
      return { reloadAllowed: true, reloadDistanceM: null, reloadAllowedDistanceM: RELOAD_MAX_DISTANCE_M };
    }
    if (currentLat == null || currentLon == null) {
      return { reloadAllowed: false, reloadDistanceM: null, reloadAllowedDistanceM: RELOAD_MAX_DISTANCE_M };
    }
    const distanceM = locationCore.haversineNm(currentLat, currentLon, itemLat, itemLon) * 1852;
    return {
      reloadAllowed: Number.isFinite(distanceM) && distanceM <= RELOAD_MAX_DISTANCE_M,
      reloadDistanceM: distanceM,
      reloadAllowedDistanceM: RELOAD_MAX_DISTANCE_M
    };
  };

  const setManifestItem = (snapshot, request) => {
    const payload = safeObject(request.payload);
    const itemId = cleanString(payload.itemId || payload.id, 120);
    const action = cleanString(payload.action || payload.status, 30).toLowerCase();
    if (!itemId) return errorResult('mission_manifest_item_id_required');
    if (!['load', 'loaded', 'unload', 'unloaded'].includes(action)) {
      return errorResult('mission_manifest_item_action_invalid');
    }
    const manifest = executionCore.normalizeManifest(snapshot.state.manifest);
    const item = manifest.items.find(candidate => candidate.id === itemId);
    if (!item) return errorResult('mission_manifest_item_not_found');
    if (item.itemType === 'passenger') return errorResult('mission_manifest_item_scene_required');

    const load = action === 'load' || action === 'loaded';
    const detachedInheritedEquipment = !load
      && item.persistentEquipment === true
      && item.persistentEquipmentInherited === true
      ? {
          id: item.id,
          weightLbs: Math.max(0, Number(item.weightLbs || 0)),
          label: cleanString(item.label, 180) || null,
          storyName: cleanString(item.storyName, 180) || null,
          objectTitle: cleanString(item.objectTitle, 180) || null,
          itemType: item.itemType || 'cargo',
          persistentEquipment: true,
          persistentEquipmentInherited: true
        }
      : null;
    const departurePhase = ['prepare', 'boarding'].includes(snapshot.state.phase);
    const arrivalPhase = ['end_unloading', 'end_ready'].includes(snapshot.state.phase)
      && snapshot.state.flags.groundStill;
    const pickupPhase = snapshot.state.phase === 'on_task' && snapshot.state.flags.groundStill;
    const departureItem = item.pickupLocation !== 'target';
    const arrivalItem = item.deliverAtDestination !== false;
    const equipmentItem = item.persistentEquipment === true;
    const airborneDrop = !load
      && snapshot.state.flags.active === true
      && snapshot.state.flags.onGround === false
      && ['active', 'enroute', 'return_leg'].includes(snapshot.state.phase)
      && item.status === 'loaded'
      && item.itemType !== 'passenger';
    const mutableHere = (departurePhase && departureItem)
      || (pickupPhase && item.pickupLocation === 'target')
      || (arrivalPhase && (arrivalItem || equipmentItem))
      || airborneDrop;
    if (!mutableHere) {
      return errorResult(load ? 'mission_manifest_load_not_allowed' : 'mission_manifest_unload_not_allowed');
    }
    const transitionContext = {
      now: now(),
      groundHandlingAllowed: snapshot.state.flags.groundStill === true,
      complianceAllowed: complianceAllowsItem(snapshot, itemId),
      missionActive: snapshot.state.flags.active === true,
      airborne: airborneDrop,
      atTarget: snapshot.state.phase === 'on_task' && snapshot.state.flags.groundStill === true,
      position: observations.lastPosition,
      ...reloadFacts(item)
    };
    const plan = manifestCore.planItemTransition(manifest, {
      action: load ? 'load' : 'unload',
      itemId
    }, transitionContext);
    if (plan?.ok !== true) {
      if (plan?.error === 'manifest_item_already_loaded' || plan?.error === 'manifest_item_not_loaded') {
        return noopResult(authorityManager, snapshot);
      }
      return errorResult(plan?.error || 'mission_manifest_item_state_conflict', { transition: plan || null });
    }
    if (plan.requiresEffect) return errorResult('mission_manifest_item_scene_required', { requiresEffect: plan.requiresEffect });
    const committed = manifestCore.commitItemTransition(manifest, plan);
    if (committed?.ok !== true) return errorResult(committed?.error || 'mission_manifest_item_state_conflict');
    return submitEvent(
      snapshot,
      'CARGO_STATE_CHANGED',
      {
        manifest,
        payloadTransition: {
          action: committed.action === 'drop'
            ? 'drop'
            : (load ? (committed.previousStatus === 'unloaded' ? 'reload' : 'load') : 'unload'),
          itemId,
          detachedInheritedEquipment
        }
      },
      `${snapshot.runId}:intent:${cleanString(request.commandId, 120)}`,
      `intent:set_manifest_item:${load ? 'load' : 'unload'}`
    );
  };

  const clearManifestSignature = (snapshot, request) => {
    const manifest = executionCore.normalizeManifest(snapshot.state.manifest);
    const scope = manifest.dispatchSignature?.scope || null;
    if (!scope) return noopResult(authorityManager, snapshot);
    const allowedScope = (['prepare', 'boarding'].includes(snapshot.state.phase) && scope === 'departure')
      || (snapshot.state.phase === 'on_task' && snapshot.state.flags.groundStill && scope === 'pickup')
      || (['end_unloading', 'end_ready'].includes(snapshot.state.phase)
        && snapshot.state.flags.groundStill
        && scope === 'arrival');
    if (!allowedScope) return errorResult('mission_manifest_signature_clear_not_allowed');
    const mode = scope === 'arrival' ? 'unload' : (scope === 'pickup' ? 'pickup' : 'load');
    const plan = manifestCore.planSignatureTransition(manifest, { action: 'clear', mode });
    if (plan?.ok !== true) return errorResult(plan?.error || 'mission_manifest_signature_clear_not_allowed');
    const committed = manifestCore.commitSignatureTransition(manifest, plan);
    if (committed?.ok !== true) return errorResult(committed?.error || 'mission_manifest_signature_clear_failed');
    return submitEvent(
      snapshot,
      'CARGO_STATE_CHANGED',
      { manifest },
      `${snapshot.runId}:intent:${cleanString(request.commandId, 120)}`,
      `intent:clear_manifest_signature:${scope}`
    );
  };

  const signManifest = (snapshot, request) => {
    let scope = null;
    if (['prepare', 'boarding'].includes(snapshot.state.phase)) {
      if (snapshot.state.cargo.summary.departureTotal === 0) {
        return errorResult('mission_manifest_signature_not_required');
      }
      if (!snapshot.state.cargo.summary.departureReady) {
        return errorResult('mission_manifest_departure_incomplete');
      }
      scope = 'departure';
    } else if (snapshot.state.phase === 'on_task' && snapshot.state.flags.groundStill) {
      if (snapshot.state.cargo.summary.pickupTotal === 0) {
        return errorResult('mission_manifest_signature_not_required');
      }
      if (!snapshot.state.cargo.summary.pickupReady) {
        return errorResult('mission_manifest_pickup_incomplete');
      }
      scope = 'pickup';
    } else if (['end_unloading', 'end_ready'].includes(snapshot.state.phase)
        && snapshot.state.flags.groundStill) {
      if (snapshot.state.cargo.summary.destinationTotal === 0) {
        return errorResult('mission_manifest_signature_not_required');
      }
      if (snapshot.state.cargo.summary.destinationRemaining > 0) {
        return errorResult('mission_manifest_destination_incomplete');
      }
      scope = 'arrival';
    } else {
      return errorResult('mission_manifest_signature_not_allowed');
    }
    const manifest = executionCore.normalizeManifest(snapshot.state.manifest);
    const mode = scope === 'arrival' ? 'unload' : (scope === 'pickup' ? 'pickup' : 'load');
    if (manifestCore.signatureMatchesMode(manifest.dispatchSignature, mode)) {
      return {
        ok: true,
        status: 'noop',
        sideEffect: false,
        executionAuthority: 'tracker',
        activeRun: authorityManager.getActiveRun(),
        view: snapshot.view
      };
    }
    const signature = safeObject(request.payload).signature;
    const plan = manifestCore.planSignatureTransition(manifest, {
      action: 'sign',
      mode,
      signature: {
        by: cleanString(signature?.by, 180) || 'Tracker',
        at: now(),
        aircraft: cleanString(signature?.aircraft, 180),
        note: cleanString(signature?.note, 500)
      }
    }, { atHome: false });
    if (plan?.ok !== true) return errorResult(plan?.error || 'mission_manifest_signature_failed');
    const committed = manifestCore.commitSignatureTransition(manifest, plan);
    if (committed?.ok !== true) return errorResult(committed?.error || 'mission_manifest_signature_failed');
    return submitEvent(
      snapshot,
      'CARGO_STATE_CHANGED',
      { manifest },
      `${snapshot.runId}:intent:${cleanString(request.commandId, 120)}`,
      `intent:sign_manifest:${scope}`
    );
  };

  const setBoardBookTime = (snapshot, request) => {
    const payload = safeObject(request.payload);
    const itemId = cleanString(payload.itemId || 'bordbuch', 120);
    const field = cleanString(payload.field || payload.action, 20).toLowerCase() === 'landing' ? 'landing' : 'start';
    const manifest = executionCore.normalizeManifest(snapshot.state.manifest);
    const compliance = safeObject(snapshot.state.workflows?.complianceInspection);
    const runtimeFlightEvents = safeObject(snapshot.state.flightEvents);
    const currentFlightId = cleanString(runtimeFlightEvents.flightId || manifest.flightEvents?.flightId, 220)
      || `${cleanString(manifest.key, 180) || snapshot.missionId}|flight`;
    const initial = manifestCore.boardBookActionState(
      manifest.items.find(item => item.id === itemId),
      manifest,
      { currentFlightId, missionAvailable: true }
    );
    if (initial.field !== field) return errorResult('manifest_boardbook_field_not_current');
    const complianceAllowed = compliance.selected !== true || compliance.released === true
      || !['request_playing', 'evidence_open', 'result_playing', 'departing'].includes(String(compliance.phase || ''))
      || (compliance.phase === 'evidence_open'
        && compliance.remediationRequired === true
        && Array.isArray(compliance.missingFields)
        && compliance.missingFields.includes(field));
    const timestamp = Number(runtimeFlightEvents[`${field}At`] || manifest.flightEvents?.[`${field}At`] || 0) || now();
    const plan = manifestCore.planBoardBookEntry(manifest, {
      itemId,
      field,
      source: 'tracker'
    }, {
      currentFlightId,
      timestamp,
      formattedTime: formatLogTime(timestamp),
      endpointLabel: boardBookEndpointLabel(field),
      loggedAt: now(),
      complianceAllowed
    });
    if (plan?.ok !== true) return errorResult(plan?.error || 'manifest_boardbook_write_failed');
    const committed = manifestCore.commitMetadataTransition(manifest, plan);
    if (committed?.ok !== true) return errorResult(committed?.error || 'manifest_boardbook_write_failed');
    return submitEvent(
      snapshot,
      'CARGO_STATE_CHANGED',
      { manifest },
      `${snapshot.runId}:intent:${cleanString(request.commandId, 120)}`,
      `intent:set_boardbook_time:${field}`
    );
  };

  const replaceEquipment = (snapshot, request) => {
    const itemId = cleanString(safeObject(request.payload).itemId, 120);
    const manifest = executionCore.normalizeManifest(snapshot.state.manifest);
    const timestamp = now();
    const seed = `${snapshot.runId}|${itemId}|${timestamp}`;
    const serialId = `${itemId.replace(/[^a-z0-9]+/gi, '-').toUpperCase()}-${Math.round(timestamp).toString(36).toUpperCase()}-${seededInt(1000, 9999, seed)}`;
    const compliance = safeObject(snapshot.state.workflows?.complianceInspection);
    const plan = manifestCore.planEquipmentReplacement(manifest, { itemId }, {
      now: timestamp,
      thresholdDays: manifestCore.EQUIPMENT_REPLACE_THRESHOLD_DAYS,
      complianceAllowed: compliance.selected !== true || compliance.released === true,
      offboardInventoryAvailable: false,
      serialId,
      expiresAt: replacementExpiryDate(seed, timestamp)
    });
    if (plan?.ok !== true) return errorResult(plan?.error || 'manifest_equipment_replace_failed');
    const committed = manifestCore.commitMetadataTransition(manifest, plan);
    if (committed?.ok !== true) return errorResult(committed?.error || 'manifest_equipment_replace_failed');
    return submitEvent(
      snapshot,
      'CARGO_STATE_CHANGED',
      { manifest },
      `${snapshot.runId}:intent:${cleanString(request.commandId, 120)}`,
      `intent:replace_equipment:${itemId}`
    );
  };

  const submitComplianceEvidence = (snapshot, request) => {
    const compliance = complianceCore.normalizeState(snapshot.state.workflows?.complianceInspection, {
      missionKey: snapshot.missionId,
      flightId: snapshot.state.flightEvents?.flightId
    });
    if (compliance.selected !== true || compliance.phase !== 'evidence_open') {
      return errorResult('mission_compliance_evidence_not_open');
    }
    const manifest = executionCore.normalizeManifest(snapshot.state.manifest);
    let result = complianceCore.evaluateEvidence(compliance, manifest, { now: now() });
    if (result.blockingUnload?.length) {
      return errorResult('mission_compliance_items_still_loaded', {
        blockingUnload: result.blockingUnload,
        message: `Fuer die Kontrolle noch ausladen: ${result.blockingUnload.join(', ')}.`
      });
    }
    if (result.missingLogFields?.length) {
      const nextCompliance = {
        ...compliance,
        remediation: { required: true, missingFields: result.missingLogFields },
        revision: compliance.revision + 1
      };
      const applied = submitEvent(
        snapshot,
        'COMPLIANCE_EVENT',
        { state: nextCompliance, action: 'log_remediation_required' },
        `${snapshot.runId}:intent:${cleanString(request.commandId, 120)}`,
        'intent:submit_compliance_evidence:remediation'
      );
      return {
        ...applied,
        status: applied.ok ? 'remediation_required' : applied.status,
        missingLogFields: result.missingLogFields,
        message: `Bordbuch nachtragen: ${result.missingLogFields.includes('start') ? 'Startzeit' : ''}${result.missingLogFields.length > 1 ? ' und ' : ''}${result.missingLogFields.includes('landing') ? 'Landezeit' : ''}.`
      };
    }
    result = complianceCore.completeEvidenceResult(result, now());
    const nextCompliance = {
      ...compliance,
      phase: 'result_playing',
      phaseAt: now(),
      revision: compliance.revision + 1,
      remediation: { required: false, missingFields: [] },
      result,
      resultText: complianceCore.resultVoiceText(result)
    };
    return submitEvent(
      snapshot,
      'COMPLIANCE_EVENT',
      {
        state: nextCompliance,
        action: 'evidence_complete',
        sanction: complianceCore.createSanctionRecord(nextCompliance, result, now())
      },
      `${snapshot.runId}:intent:${cleanString(request.commandId, 120)}`,
      'intent:submit_compliance_evidence:complete'
    );
  };

  const executeIntent = (request = {}) => {
    const validated = validateIntent(request);
    if (!validated.ok) return validated;
    const commandId = cleanString(request.commandId, 220);
    const intent = validated.intent;
    const snapshot = validated.snapshot;
    resetObservationIfNeeded(snapshot);
    if (DEFERRED_INTENTS.has(intent)) {
      return errorResult('mission_intent_not_migrated', {
        activeRun: authorityManager.getActiveRun(),
        view: snapshot.view
      });
    }
    if (intent === 'set_manifest_item') return setManifestItem(snapshot, request);
    if (intent === 'sign_manifest') return signManifest(snapshot, request);
    if (intent === 'clear_manifest_signature') return clearManifestSignature(snapshot, request);
    if (intent === 'set_boardbook_time') return setBoardBookTime(snapshot, request);
    if (intent === 'replace_equipment') return replaceEquipment(snapshot, request);
    if (intent === 'submit_compliance_evidence') return submitComplianceEvidence(snapshot, request);
    if (intent === 'request_pax_interaction') {
      const action = cleanString(safeObject(request.payload).action, 40).toLowerCase();
      if (action !== 'deboard') return errorResult('mission_pax_interaction_not_migrated', { view: snapshot.view });
      const deboardingPending = snapshot.state.effects.some(effect => (
        effect.type === 'scene.deboarding' && effect.status === 'requested'
      ));
      if (deboardingPending) return noopResult(authorityManager, snapshot, { pending: true });
      return submitEvent(
        snapshot,
        'PAX_DEBOARDING_REQUESTED',
        { position: observations.lastPosition },
        `${snapshot.runId}:intent:${commandId}`,
        'intent:request_pax_interaction:deboard'
      );
    }
    const eventType = INTENT_EVENT_TYPES[intent];
    if (!eventType) return errorResult('mission_intent_not_supported');
    if (eventType === 'UNLOAD_CONFIRMED' && snapshot.state.flags.unloadConfirmed) {
      return noopResult(authorityManager, snapshot, { confirmed: true });
    }
    if (eventType === 'CLOSE_REQUESTED' && snapshot.state.phase === 'closing') {
      return noopResult(authorityManager, snapshot, { closing: true });
    }
    const intentPayload = safeObject(request.payload);
    if (eventType === 'CLOSE_REQUESTED') {
      const farewellVoiceRecipe = farewellVoiceCore.normalizeRecipe(intentPayload.farewellVoiceRecipe);
      if (farewellVoiceRecipe && (!farewellVoiceRecipe.missionId || farewellVoiceRecipe.missionId === snapshot.missionId)) {
        observations.farewellVoiceRecipe = farewellVoiceRecipe;
      }
    }
    const rawPayloadContext = safeObject(intentPayload.payloadContext);
    const payloadContext = eventType === 'LOAD_CONFIRMATION_REQUESTED' && (
      Number.isFinite(Number(rawPayloadContext.fallbackPaxCount))
      || Number.isFinite(Number(rawPayloadContext.fallbackPaxWeightLbs))
    ) ? {
        fallbackPaxCount: Math.max(0, Math.min(6, Math.round(Number(rawPayloadContext.fallbackPaxCount) || 0))),
        fallbackPaxWeightLbs: Math.max(1, Math.round(Number(rawPayloadContext.fallbackPaxWeightLbs) || 180))
      } : null;
    const eventPayload = ['LOAD_CONFIRMATION_REQUESTED', 'UNLOAD_CONFIRMED'].includes(eventType)
      ? {
          manifest: snapshot.state.manifest,
          ...(payloadContext ? { payloadContext } : {})
        }
      : (eventType === 'CLOSE_REQUESTED' ? { position: observations.lastPosition } : {});
    return submitEvent(
      snapshot,
      eventType,
      eventPayload,
      `${snapshot.runId}:intent:${commandId}`,
      `intent:${intent}`
    );
  };

  const applySystemEvent = (request = {}) => {
    const type = cleanString(request.type, 100).toUpperCase().replace(/[\s.-]+/g, '_');
    const sourceEventId = cleanString(request.eventId || request.id, 160);
    if (!SYSTEM_EVENT_TYPES.has(type)) return errorResult('mission_system_event_not_allowed');
    if (!sourceEventId) return errorResult('mission_system_event_id_required');
    const validated = validateSnapshot(request);
    if (!validated.ok) return validated;
    const snapshot = validated.snapshot;
    const normalizedEventId = `${snapshot.runId}:system:${sourceEventId}`;
    if (snapshot.state.processedEventIds.includes(normalizedEventId)) {
      return {
        ok: true,
        status: 'noop',
        duplicate: true,
        sideEffect: false,
        executionAuthority: 'tracker',
        activeRun: authorityManager.getActiveRun(),
        view: snapshot.view
      };
    }
    if (['BOARDING_SCENE_CONFIRMED', 'BOARDING_CONFIRMED'].includes(type) && snapshot.state.phase !== 'boarding') {
      return errorResult('mission_boarding_not_started', { view: snapshot.view });
    }
    const requiredEffectType = {
      BOARDING_SCENE_CONFIRMED: 'scene.boarding',
      BOARDING_CONFIRMED: 'voice.boarding',
      LOAD_CONFIRMED: 'payload.sync_before_start',
      PAX_DEBOARDING_CONFIRMED: 'scene.deboarding',
      FAREWELL_STARTED: 'scene.deboarding',
      FAREWELL_COMPLETED: 'voice.farewell',
      COMPLIANCE_INSPECTORS_WAITING: 'scene.compliance_visit',
      COMPLIANCE_REQUEST_COMPLETED: 'voice.compliance_request',
      COMPLIANCE_RESULT_COMPLETED: 'voice.compliance_result'
    }[type];
    if (requiredEffectType && !snapshot.state.effects.some(effect => (
      effect.type === requiredEffectType && effect.status === 'requested'
    ))) {
      return errorResult('mission_system_effect_not_pending', { requiredEffectType, view: snapshot.view });
    }
    if (type === 'COMPLIANCE_RELEASED' && !snapshot.state.effects.some(effect => (
      (effect.type === 'scene.compliance_visit' || effect.type === 'compliance.logical_release'
        || effect.type === 'scene.compliance_departure')
      && effect.status === 'requested'
    ))) {
      return errorResult('mission_system_effect_not_pending', {
        requiredEffectType: 'scene.compliance_visit|compliance.logical_release|scene.compliance_departure',
        view: snapshot.view
      });
    }
    if (type === 'MISSION_CLOSED' && snapshot.state.phase !== 'closing') {
      return errorResult('mission_close_not_requested', { view: snapshot.view });
    }
    const payload = ['BOARDING_SCENE_CONFIRMED', 'BOARDING_CONFIRMED', 'LOAD_CONFIRMED', 'PAX_DEBOARDING_CONFIRMED'].includes(type)
      ? { manifest: snapshot.state.manifest }
      : (type === 'COMPLIANCE_INSPECTORS_WAITING'
        ? { sceneFallback: safeObject(request.payload).sceneFallback === true }
        : {});
    return submitEvent(
      snapshot,
      type,
      payload,
      normalizedEventId,
      `system:${type.toLowerCase()}`
    );
  };

  const resetObservationIfNeeded = snapshot => {
    const runKey = `${snapshot.missionId}:${snapshot.runId}`;
    if (observations.runKey === runKey) return;
    observations.runKey = runKey;
    observations.airborneCandidateAt = null;
    observations.groundStillCandidateAt = null;
    const persisted = typeof authorityManager.getExecutionRuntimeContext === 'function'
      ? authorityManager.getExecutionRuntimeContext({ missionId: snapshot.missionId, runId: snapshot.runId })
      : null;
    observations.flightRecorder = flightRecorderCore.createState(persisted?.flightRecorder);
    observations.arrivalFlightRecord = persisted?.arrivalFlightRecord || null;
    observations.missionFlightRecord = persisted?.missionFlightRecord || null;
    observations.lastFinalizedSegmentStartTs = Math.max(0, Number(persisted?.lastFinalizedSegmentStartTs || 0)) || null;
    observations.segmentDepartureLabel = cleanString(persisted?.segmentDepartureLabel, 180) || null;
    observations.recorderLowSpeedSince = Math.max(0, Number(persisted?.recorderLowSpeedSince || 0)) || null;
    observations.latestTelemetry = persisted?.latestTelemetry || null;
    observations.latestDestination = persisted?.latestDestination || null;
    observations.lastPosition = observations.latestTelemetry
      && finite(observations.latestTelemetry.lat) != null
      && finite(observations.latestTelemetry.lon) != null
      ? {
          lat: finite(observations.latestTelemetry.lat),
          lon: finite(observations.latestTelemetry.lon),
          altFt: finite(observations.latestTelemetry.altFt),
          hdg: finite(observations.latestTelemetry.hdg)
        }
      : null;
    observations.farewellVoiceRecipe = null;
    observations.lastGpsTick = null;
    observations.smoothedVsFpm = 0;
    observations.runtimeContextPersistedAt = Math.max(0, Number(persisted?.updatedAt || 0));
  };

  const updateAppTelemetrySmoothing = sample => {
    const observedAt = Math.max(0, Math.round(finite(sample.observedAt, now())));
    const lat = finite(sample.lat);
    const lon = finite(sample.lon != null ? sample.lon : sample.lng);
    const altFt = finite(sample.altFt);
    if (lat == null || lon == null || altFt == null) return observations.smoothedVsFpm;
    const previous = observations.lastGpsTick;
    if (!previous) {
      observations.lastGpsTick = { observedAt, lat, lon, altFt };
      return observations.smoothedVsFpm;
    }
    const dtSec = (observedAt - previous.observedAt) / 1000;
    if (dtSec > 1) {
      const verticalSpeed = ((altFt - previous.altFt) / dtSec) * 60;
      observations.smoothedVsFpm = observations.smoothedVsFpm === 0
        ? verticalSpeed
        : observations.smoothedVsFpm * 0.7 + verticalSpeed * 0.3;
      observations.lastGpsTick = { observedAt, lat, lon, altFt };
    }
    return observations.smoothedVsFpm;
  };

  const observeTelemetry = (sample = {}) => {
    const validated = validateSnapshot(sample);
    if (!validated.ok) return validated;
    const snapshot = validated.snapshot;
    resetObservationIfNeeded(snapshot);
    const smoothedVsFpm = updateAppTelemetrySmoothing(sample);
    if (!snapshot.state.flags.started || snapshot.state.flags.closed) {
      return errorResult('mission_telemetry_not_active', { view: snapshot.view });
    }
    const observedAt = Math.max(0, Math.round(finite(sample.observedAt, now())));
    const onGround = typeof sample.onGround === 'boolean' ? sample.onGround : null;
    const gsKts = Math.max(0, finite(sample.gsKts, Number.POSITIVE_INFINITY));
    const destination = locationCore.resolveAptDestination(snapshot.location, {
      lat: sample.lat,
      lon: sample.lon != null ? sample.lon : sample.lng
    });
    if (onGround == null) return errorResult('mission_telemetry_on_ground_required', { view: snapshot.view });
    const recorderBefore = observations.flightRecorder;
    const recorded = flightRecorderCore.observe(recorderBefore, {
      ...sample,
      gsKts: finite(sample.gsKts, 0),
      vsFpm: smoothedVsFpm,
      distanceToTargetNm: destination.hasAptArrival ? destination.dArrivalNm : destination.dMissionNm
    });
    observations.flightRecorder = recorded.state;
    observations.latestTelemetry = {
      observedAt,
      lat: finite(sample.lat),
      lon: finite(sample.lon != null ? sample.lon : sample.lng),
      altFt: finite(sample.altFt),
      aglFt: finite(sample.aglFt),
      hdg: finite(sample.hdg),
      gsKts: finite(sample.gsKts),
      onGround,
      bankDeg: finite(sample.bankDeg),
      gForce: finite(sample.gForce),
      vsFpm: finite(sample.vsFpm != null ? sample.vsFpm : sample.vs),
      touchdownFpm: finite(sample.touchdownFpm),
      windKts: finite(sample.windKts),
      windDeg: finite(sample.windDeg),
      windGustKts: finite(sample.windGustKts),
      tempC: finite(sample.tempC),
      visKm: finite(sample.visKm),
      precipRateMmH: finite(sample.precipRateMmH),
      precipActive: sample.precipActive === true,
      inCloud: sample.inCloud === true,
      turbulencePct: finite(sample.turbulencePct),
      simPaused: sample.simPaused === true,
      inMenuOrMap: sample.inMenuOrMap === true,
      parkingBrake: typeof sample.parkingBrake === 'boolean' ? sample.parkingBrake : null
    };
    observations.latestDestination = {
      atDestination: destination.atDestination === true,
      hasAptArrival: destination.hasAptArrival === true,
      dArrivalNm: finite(destination.dArrivalNm),
      dMissionNm: finite(destination.dMissionNm),
      reason: cleanString(destination.reason, 80) || null
    };
    try {
      flightLog?.recordSample?.({
        missionId: snapshot.missionId,
        runId: snapshot.runId,
        sample: observations.latestTelemetry,
        destination: observations.latestDestination,
        phase: snapshot.state.phase
      });
    } catch (_) {}
    if (recorded.status === 'reposition_reset') {
      const repositionRecord = buildSegmentRecord(recorderBefore, observedAt, observations.latestDestination);
      if (repositionRecord) finalizeSegment(snapshot, repositionRecord, 'ground-reposition');
    }
    const touchdownObserved = recorderBefore?.wasOnGround === false && onGround === true;
    if (touchdownObserved) {
      const arrivalRecord = buildSegmentRecord(observations.flightRecorder, observedAt, observations.latestDestination);
      if (arrivalRecord) observations.arrivalFlightRecord = arrivalRecord;
    }
    const aglFt = Math.max(0, finite(sample.aglFt, 0));
    const landingCandidate = observations.flightRecorder.hadAirbornePhase === true
      && gsKts < 18
      && aglFt < 140;
    if (landingCandidate) {
      if (observations.recorderLowSpeedSince == null) observations.recorderLowSpeedSince = observedAt;
      if (observedAt - observations.recorderLowSpeedSince >= 5000) {
        const segment = observations.arrivalFlightRecord
          && Number(observations.arrivalFlightRecord.startTs || 0) === Number(observations.flightRecorder.startTs || 0)
          ? observations.arrivalFlightRecord
          : buildSegmentRecord(observations.flightRecorder, observedAt, observations.latestDestination);
        if (segment) finalizeSegment(snapshot, segment, 'stable-landing');
        observations.flightRecorder = flightRecorderCore.createState();
        observations.recorderLowSpeedSince = null;
      }
    } else {
      observations.recorderLowSpeedSince = null;
    }
    persistRuntimeContext(snapshot, recorded.status === 'started'
      || recorded.status === 'reposition_reset'
      || touchdownObserved
      || (landingCandidate && observations.flightRecorder.active !== true));
    if (finite(sample.lat) != null && finite(sample.lon != null ? sample.lon : sample.lng) != null) {
      observations.lastPosition = {
          lat: finite(sample.lat),
          lon: finite(sample.lon != null ? sample.lon : sample.lng),
          altFt: finite(sample.altFt),
          hdg: finite(sample.hdg)
        };
    }
    if (sample.simPaused === true || sample.inMenuOrMap === true) {
      observations.airborneCandidateAt = null;
      observations.groundStillCandidateAt = null;
      return { ok: true, status: 'ignored', reason: 'simulation_not_running', sideEffect: false, destination, view: snapshot.view };
    }

    if (onGround === false && snapshot.state.flags.onGround !== false) {
      observations.groundStillCandidateAt = null;
      if (observations.airborneCandidateAt == null) {
        observations.airborneCandidateAt = observedAt;
        return { ok: true, status: 'pending', reason: 'airborne_evidence', sideEffect: false, destination, view: snapshot.view };
      }
      if (observedAt - observations.airborneCandidateAt >= AIRBORNE_EVIDENCE_MS) {
        observations.airborneCandidateAt = null;
        return submitEvent(
          snapshot,
          'AIRBORNE',
          {},
          `${snapshot.runId}:telemetry:airborne:${snapshot.executionRevision + 1}`,
          'telemetry:airborne'
        );
      }
      return { ok: true, status: 'pending', reason: 'airborne_evidence', sideEffect: false, destination, view: snapshot.view };
    }
    observations.airborneCandidateAt = null;

    if (onGround === true && snapshot.state.flags.onGround === false) {
      observations.groundStillCandidateAt = gsKts <= GROUND_STILL_MAX_GS_KTS ? observedAt : null;
      return submitEvent(
        snapshot,
        'TOUCHDOWN',
        {
          atDestination: destination.atDestination === true,
          recordLandingEvent: (
            Number.isFinite(Number(destination.dArrivalNm)) && Number(destination.dArrivalNm) <= 1.2
          ) || (
            Number.isFinite(Number(destination.dMissionNm)) && Number(destination.dMissionNm) <= 1.2
          )
        },
        `${snapshot.runId}:telemetry:touchdown:${snapshot.executionRevision + 1}`,
        'telemetry:touchdown'
      );
    }

    if (onGround === true && !snapshot.state.flags.groundStill && gsKts <= GROUND_STILL_MAX_GS_KTS) {
      if (observations.groundStillCandidateAt == null) {
        observations.groundStillCandidateAt = observedAt;
        return { ok: true, status: 'pending', reason: 'ground_still_evidence', sideEffect: false, destination, view: snapshot.view };
      }
      if (observedAt - observations.groundStillCandidateAt >= GROUND_STILL_EVIDENCE_MS) {
        observations.groundStillCandidateAt = null;
        const applied = submitEvent(
          snapshot,
          'GROUND_STILL',
          {
            atDestination: destination.atDestination === true,
            ...(destination.atDestination === true ? { complianceRoll: random() } : {})
          },
          `${snapshot.runId}:telemetry:ground-still:${snapshot.executionRevision + 1}`,
          'telemetry:ground_still'
        );
        return { ...applied, destination };
      }
      return { ok: true, status: 'pending', reason: 'ground_still_evidence', sideEffect: false, destination, view: snapshot.view };
    }
    if (onGround === true && snapshot.state.flags.groundStill && gsKts <= GROUND_STILL_MAX_GS_KTS
        && destination.atDestination === true
        && snapshot.state.progress.airborneSeen === true
        && !['end_unloading', 'end_ready', 'closing', 'closed'].includes(snapshot.state.phase)) {
      const applied = submitEvent(
        snapshot,
        'GROUND_STILL',
        { atDestination: true, complianceRoll: random() },
        `${snapshot.runId}:telemetry:destination-confirmed:${snapshot.executionRevision + 1}`,
        'telemetry:destination_confirmed'
      );
      return { ...applied, destination };
    }
    observations.groundStillCandidateAt = null;
    return { ok: true, status: 'noop', reason: 'no_telemetry_transition', sideEffect: false, destination, view: snapshot.view };
  };

  return Object.freeze({
    applySystemEvent,
    executeIntent,
    getFarewellAuthorityContext: farewellAuthorityContext,
    getFarewellDynamicContext,
    getFarewellVoiceRecipe: () => observations.farewellVoiceRecipe,
    getMissionFlightRecord: () => missionRecord(),
    finalizeFlightLog: (details = {}) => {
      const snapshot = current();
      if (!snapshot) return null;
      const at = Math.max(0, Math.round(Number(observations.latestTelemetry?.observedAt || now()) || 0));
      const pending = Number(observations.flightRecorder?.startTs || 0) !== Number(observations.lastFinalizedSegmentStartTs || 0)
        ? buildSegmentRecord(observations.flightRecorder, at, observations.latestDestination)
        : null;
      if (pending) finalizeSegment(snapshot, pending, details.status === 'aborted' ? 'mission-aborted' : 'mission-complete');
      persistRuntimeContext(snapshot, true);
      const record = observations.missionFlightRecord;
      try {
        flightLog?.finalize?.({
          missionId: snapshot.missionId,
          runId: snapshot.runId,
          status: cleanString(details.status, 40) || 'completed',
          endedAt: at,
          record
        });
      } catch (_) {}
      return record;
    },
    validateIntent,
    observeTelemetry
  });
}

module.exports = {
  AIRBORNE_EVIDENCE_MS,
  GROUND_STILL_EVIDENCE_MS,
  GROUND_STILL_MAX_GS_KTS,
  RUNTIME_CONTEXT_PERSIST_INTERVAL_MS,
  SYSTEM_EVENT_TYPES,
  createTrackerMissionExecutionAdapter
};
