'use strict';

const executionCore = require('../mission-execution-core.js');
const locationCore = require('../mission-location-core.js');

const AIRBORNE_EVIDENCE_MS = 2000;
const GROUND_STILL_EVIDENCE_MS = 3000;
const GROUND_STILL_MAX_GS_KTS = 3;
const SYSTEM_EVENT_TYPES = new Set([
  'BOARDING_STARTED',
  'BOARDING_CONFIRMED',
  'FAREWELL_STARTED',
  'FAREWELL_COMPLETED',
  'MISSION_CLOSED'
]);
const INTENT_EVENT_TYPES = Object.freeze({
  prepare_mission: 'PREPARE_REQUESTED',
  confirm_load: 'LOAD_CONFIRMED',
  start_mission: 'MISSION_STARTED',
  confirm_unload: 'UNLOAD_CONFIRMED',
  request_close: 'CLOSE_REQUESTED'
});
const DEFERRED_INTENTS = new Set([
  'confirm_pickup',
  'request_pax_interaction',
  'request_voice_playback',
  'submit_compliance_evidence',
  'abort_mission',
  'reset_mission'
]);

function cleanString(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function errorResult(error, details = {}) {
  return { ok: false, status: 'blocked', error, sideEffect: false, ...details };
}

function createTrackerMissionExecutionAdapter(options = {}) {
  const authorityManager = options.authorityManager;
  if (!authorityManager || typeof authorityManager.getExecutionSnapshot !== 'function'
      || typeof authorityManager.applyExecutionEvent !== 'function') {
    throw new TypeError('mission_execution_authority_manager_required');
  }
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const observations = {
    runKey: null,
    airborneCandidateAt: null,
    groundStillCandidateAt: null
  };

  const current = () => authorityManager.getExecutionSnapshot();

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

  const normalizedCargo = (snapshot, mutator) => {
    const cargo = clone(snapshot.state.cargo);
    mutator(cargo);
    return executionCore.normalizeState({ ...snapshot.state, cargo }).cargo;
  };

  const setManifestItem = (snapshot, request) => {
    const payload = safeObject(request.payload);
    const itemId = cleanString(payload.itemId || payload.id, 120).toLowerCase();
    const action = cleanString(payload.action || payload.status, 30).toLowerCase();
    if (!itemId) return errorResult('mission_manifest_item_id_required');
    if (!['load', 'loaded', 'unload', 'unloaded'].includes(action)) {
      return errorResult('mission_manifest_item_action_invalid');
    }
    const item = snapshot.state.cargo.items.find(candidate => candidate.id === itemId);
    if (!item) return errorResult('mission_manifest_item_not_found');
    if (item.itemType === 'passenger') return errorResult('mission_manifest_item_scene_required');

    const load = action === 'load' || action === 'loaded';
    if (load) {
      if (!['prepare', 'boarding'].includes(snapshot.state.phase) || item.pickup !== 'departure') {
        return errorResult('mission_manifest_load_not_allowed');
      }
      if (item.status === 'loaded') {
        return {
          ok: true,
          status: 'noop',
          sideEffect: false,
          executionAuthority: 'tracker',
          activeRun: authorityManager.getActiveRun(),
          view: snapshot.view
        };
      }
      if (item.status !== 'pending') return errorResult('mission_manifest_item_state_conflict');
    } else {
      if (!['end_unloading', 'end_ready'].includes(snapshot.state.phase)
          || !snapshot.state.flags.groundStill
          || item.delivery !== 'destination') {
        return errorResult('mission_manifest_unload_not_allowed');
      }
      if (item.status === 'unloaded' || item.status === 'handed_off') {
        return {
          ok: true,
          status: 'noop',
          sideEffect: false,
          executionAuthority: 'tracker',
          activeRun: authorityManager.getActiveRun(),
          view: snapshot.view
        };
      }
      if (item.status !== 'loaded') return errorResult('mission_manifest_item_state_conflict');
    }

    const cargo = normalizedCargo(snapshot, nextCargo => {
      const nextItem = nextCargo.items.find(candidate => candidate.id === itemId);
      nextItem.status = load ? 'loaded' : 'unloaded';
      nextCargo.signatureScope = null;
    });
    return submitEvent(
      snapshot,
      'CARGO_STATE_CHANGED',
      { cargo },
      `${snapshot.runId}:intent:${cleanString(request.commandId, 120)}`,
      `intent:set_manifest_item:${load ? 'load' : 'unload'}`
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
    if (snapshot.state.cargo.signatureScope === scope) {
      return {
        ok: true,
        status: 'noop',
        sideEffect: false,
        executionAuthority: 'tracker',
        activeRun: authorityManager.getActiveRun(),
        view: snapshot.view
      };
    }
    const cargo = normalizedCargo(snapshot, nextCargo => {
      nextCargo.signatureScope = scope;
    });
    return submitEvent(
      snapshot,
      'CARGO_STATE_CHANGED',
      { cargo },
      `${snapshot.runId}:intent:${cleanString(request.commandId, 120)}`,
      `intent:sign_manifest:${scope}`
    );
  };

  const executeIntent = (request = {}) => {
    const commandId = cleanString(request.commandId, 220);
    const intent = cleanString(request.intent || request.action, 80).toLowerCase();
    if (!commandId) return errorResult('command_id_required');
    const validated = validateSnapshot(request);
    if (!validated.ok) return validated;
    const snapshot = validated.snapshot;
    if (!snapshot.view.allowedActions.includes(intent)) {
      return errorResult('mission_intent_not_allowed_in_state', {
        activeRun: authorityManager.getActiveRun(),
        view: snapshot.view
      });
    }
    if (DEFERRED_INTENTS.has(intent)) {
      return errorResult('mission_intent_not_migrated', {
        activeRun: authorityManager.getActiveRun(),
        view: snapshot.view
      });
    }
    if (intent === 'set_manifest_item') return setManifestItem(snapshot, request);
    if (intent === 'sign_manifest') return signManifest(snapshot, request);
    const eventType = INTENT_EVENT_TYPES[intent];
    if (!eventType) return errorResult('mission_intent_not_supported');
    const eventPayload = ['LOAD_CONFIRMED', 'UNLOAD_CONFIRMED'].includes(eventType)
      ? { cargo: snapshot.state.cargo }
      : {};
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
    if (type === 'BOARDING_CONFIRMED' && snapshot.state.phase !== 'boarding') {
      return errorResult('mission_boarding_not_started', { view: snapshot.view });
    }
    if (type === 'MISSION_CLOSED' && snapshot.state.phase !== 'closing') {
      return errorResult('mission_close_not_requested', { view: snapshot.view });
    }
    const payload = type === 'BOARDING_CONFIRMED' ? { cargo: snapshot.state.cargo } : {};
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
  };

  const observeTelemetry = (sample = {}) => {
    const validated = validateSnapshot(sample);
    if (!validated.ok) return validated;
    const snapshot = validated.snapshot;
    resetObservationIfNeeded(snapshot);
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
        {},
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
          { atDestination: destination.atDestination === true },
          `${snapshot.runId}:telemetry:ground-still:${snapshot.executionRevision + 1}`,
          'telemetry:ground_still'
        );
        return { ...applied, destination };
      }
      return { ok: true, status: 'pending', reason: 'ground_still_evidence', sideEffect: false, destination, view: snapshot.view };
    }
    if (onGround === true && snapshot.state.flags.groundStill && gsKts <= GROUND_STILL_MAX_GS_KTS
        && destination.atDestination === true
        && !['end_unloading', 'end_ready', 'closing', 'closed'].includes(snapshot.state.phase)) {
      const applied = submitEvent(
        snapshot,
        'GROUND_STILL',
        { atDestination: true },
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
    observeTelemetry
  });
}

module.exports = {
  AIRBORNE_EVIDENCE_MS,
  GROUND_STILL_EVIDENCE_MS,
  GROUND_STILL_MAX_GS_KTS,
  SYSTEM_EVENT_TYPES,
  createTrackerMissionExecutionAdapter
};
