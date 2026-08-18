'use strict';

const DEFAULT_ACK_LEASE_MS = 30000;
const DEFAULT_RETRY_DELAY_MS = 2000;
const MAX_DRAIN_EFFECTS = 16;
const APT_EFFECT_FOLLOW_UPS = Object.freeze({
  'scene.prepare': 'BOARDING_STARTED',
  'scene.boarding': 'BOARDING_CONFIRMED',
  'mission.close_requested': 'MISSION_CLOSED'
});

function cleanString(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function publicEffect(effect = {}) {
  return {
    effectId: cleanString(effect.effectId, 220),
    type: cleanString(effect.type, 100).toLowerCase(),
    status: cleanString(effect.status, 40).toLowerCase() || 'requested',
    sourceEventId: cleanString(effect.sourceEventId, 220) || null,
    payload: safeObject(effect.payload)
  };
}

function errorResult(error, details = {}) {
  return { ok: false, status: 'blocked', error, sideEffect: false, ...details };
}

function createTrackerMissionEffectRunner(options = {}) {
  const authorityManager = options.authorityManager;
  const applySystemEvent = typeof options.applySystemEvent === 'function' ? options.applySystemEvent : null;
  if (!authorityManager || typeof authorityManager.getExecutionSnapshot !== 'function'
      || typeof authorityManager.applyExecutionEvent !== 'function') {
    throw new TypeError('mission_effect_authority_manager_required');
  }
  const handlers = safeObject(options.handlers);
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const ackLeaseMs = Math.max(5000, Math.min(5 * 60 * 1000, Number(options.ackLeaseMs) || DEFAULT_ACK_LEASE_MS));
  const retryDelayMs = Math.max(250, Math.min(60000, Number(options.retryDelayMs) || DEFAULT_RETRY_DELAY_MS));
  const pendingDispatches = new Map();
  const retryAfter = new Map();
  let running = null;

  const executionSnapshot = () => {
    const snapshot = authorityManager.getExecutionSnapshot();
    if (!snapshot) return errorResult('no_active_run');
    if (snapshot.executionAuthority !== 'tracker') return errorResult('mission_execution_authority_web');
    if (snapshot.recipe !== 'apt') return errorResult('mission_execution_recipe_not_enabled');
    return { ok: true, snapshot };
  };

  const requestedEffects = snapshot => snapshot.state.effects
    .map(publicEffect)
    .filter(effect => effect.effectId && effect.status === 'requested');

  const effectById = (snapshot, effectId) => snapshot.state.effects
    .map(publicEffect)
    .find(effect => effect.effectId === effectId) || null;

  const handlerFor = type => {
    const configured = handlers[type];
    if (typeof configured === 'function') return configured;
    if (configured && typeof configured.dispatch === 'function') return configured.dispatch;
    return null;
  };

  const applyEffectAck = (effect, status) => {
    const validated = executionSnapshot();
    if (!validated.ok) return validated;
    const snapshot = validated.snapshot;
    const currentEffect = effectById(snapshot, effect.effectId);
    if (!currentEffect) return errorResult('mission_effect_not_found');
    if (currentEffect.status !== 'requested') {
      return {
        ok: true,
        status: 'noop',
        duplicate: true,
        sideEffect: false,
        effect: currentEffect,
        activeRun: authorityManager.getActiveRun(),
        view: snapshot.view
      };
    }
    return authorityManager.applyExecutionEvent({
      missionId: snapshot.missionId,
      runId: snapshot.runId,
      expectedRevision: snapshot.authorityRevision,
      expectedExecutionRevision: snapshot.executionRevision,
      expectedExecutionStateHash: snapshot.executionStateHash,
      clientId: 'tracker-effect-runner',
      commandId: `${effect.effectId}:ack`,
      reason: `effect:${effect.type}:${status}`,
      event: {
        eventId: `${effect.effectId}:ack:${status}`,
        type: 'EFFECT_ACKNOWLEDGED',
        sequence: snapshot.executionRevision + 1,
        occurredAt: Math.max(0, Math.round(Number(now()) || 0)),
        payload: { effectId: effect.effectId, status }
      }
    });
  };

  const applyFollowUp = effect => {
    const followUpType = APT_EFFECT_FOLLOW_UPS[effect.type] || null;
    if (!followUpType) return { ok: true, status: 'noop', sideEffect: false };
    if (!applySystemEvent) return errorResult('mission_effect_follow_up_handler_required');
    const snapshot = authorityManager.getExecutionSnapshot();
    if (!snapshot) return errorResult('no_active_run');
    return applySystemEvent({
      type: followUpType,
      eventId: `${effect.effectId}:complete`,
      missionId: snapshot.missionId,
      runId: snapshot.runId,
      expectedRevision: snapshot.authorityRevision
    });
  };

  const acknowledge = async (request = {}) => {
    const effectId = cleanString(request.effectId, 220);
    const resultStatus = cleanString(request.status, 40).toLowerCase();
    if (!effectId) return errorResult('mission_effect_id_required');
    if (!['ok', 'completed', 'error', 'failed'].includes(resultStatus)) {
      return errorResult('mission_effect_ack_status_invalid');
    }
    const validated = executionSnapshot();
    if (!validated.ok) return validated;
    const effect = effectById(validated.snapshot, effectId);
    if (!effect) return errorResult('mission_effect_not_found');
    if (effect.status !== 'requested') {
      pendingDispatches.delete(effectId);
      retryAfter.delete(effectId);
      return { ok: true, status: 'noop', duplicate: true, sideEffect: false, effect };
    }
    const completed = resultStatus === 'ok' || resultStatus === 'completed';
    if (completed) {
      const followUp = await applyFollowUp(effect);
      if (!followUp.ok) return { ...followUp, effect };
    }
    const acknowledged = applyEffectAck(effect, completed ? 'completed' : 'failed');
    if (acknowledged.ok) {
      pendingDispatches.delete(effectId);
      retryAfter.delete(effectId);
    }
    return { ...acknowledged, effect, sideEffect: false };
  };

  const pumpOnce = async () => {
    const validated = executionSnapshot();
    if (!validated.ok) return validated;
    const snapshot = validated.snapshot;
    const effect = requestedEffects(snapshot)[0] || null;
    if (!effect) return { ok: true, status: 'noop', sideEffect: false, pendingCount: 0, view: snapshot.view };
    const handler = handlerFor(effect.type);
    if (!handler) return errorResult('mission_effect_handler_missing', { effect, pendingCount: requestedEffects(snapshot).length });
    const timestamp = now();
    const pending = pendingDispatches.get(effect.effectId);
    if (pending && pending.expiresAt > timestamp) {
      return { ok: true, status: 'pending', sideEffect: false, effect, commandId: effect.effectId };
    }
    if (Number(retryAfter.get(effect.effectId) || 0) > timestamp) {
      return { ok: true, status: 'retry_wait', sideEffect: false, effect, retryAt: retryAfter.get(effect.effectId) };
    }
    pendingDispatches.delete(effect.effectId);
    let dispatched;
    try {
      dispatched = safeObject(await handler({
        schema: 'ga.mission-effect-dispatch.v1',
        commandId: effect.effectId,
        missionId: snapshot.missionId,
        runId: snapshot.runId,
        effect
      }));
    } catch (error) {
      retryAfter.set(effect.effectId, timestamp + retryDelayMs);
      return {
        ok: false,
        status: 'error',
        error: cleanString(error?.code || error?.message || error, 180) || 'mission_effect_dispatch_failed',
        dispatchAttempted: true,
        sideEffect: true,
        effect
      };
    }
    const dispatchStatus = cleanString(dispatched.status, 40).toLowerCase();
    if (dispatched.ok === true && dispatchStatus === 'pending') {
      pendingDispatches.set(effect.effectId, { expiresAt: timestamp + ackLeaseMs });
      return { ok: true, status: 'pending', dispatchAttempted: true, sideEffect: true, effect, commandId: effect.effectId };
    }
    if (dispatched.ok === true) {
      const acknowledged = await acknowledge({ effectId: effect.effectId, status: 'completed' });
      return { ...acknowledged, dispatchAttempted: true, sideEffect: true };
    }
    if (dispatched.terminal === true) {
      const acknowledged = await acknowledge({ effectId: effect.effectId, status: 'failed' });
      return { ...acknowledged, dispatchAttempted: true, sideEffect: true };
    }
    retryAfter.set(effect.effectId, timestamp + retryDelayMs);
    return {
      ok: false,
      status: 'error',
      error: cleanString(dispatched.error, 180) || 'mission_effect_dispatch_failed',
      dispatchAttempted: true,
      sideEffect: true,
      effect
    };
  };

  const pump = async () => {
    if (running) return running;
    running = pumpOnce();
    try {
      return await running;
    } finally {
      running = null;
    }
  };

  const drain = async (maxEffects = MAX_DRAIN_EFFECTS) => {
    const limit = Math.max(1, Math.min(MAX_DRAIN_EFFECTS, Math.round(Number(maxEffects) || MAX_DRAIN_EFFECTS)));
    const results = [];
    for (let index = 0; index < limit; index += 1) {
      const result = await pump();
      results.push(result);
      if (!result.ok || result.status === 'noop' || result.status === 'pending' || result.status === 'retry_wait') break;
    }
    const snapshot = authorityManager.getExecutionSnapshot();
    return {
      ok: results.every(result => result.ok),
      status: results.at(-1)?.status || 'noop',
      results,
      pendingCount: snapshot ? requestedEffects(snapshot).length : 0,
      activeRun: authorityManager.getActiveRun()
    };
  };

  const publicState = () => {
    const snapshot = authorityManager.getExecutionSnapshot();
    return {
      schema: 'ga.mission-effect-runner.v1',
      authority: snapshot?.executionAuthority || 'none',
      recipe: snapshot?.recipe || null,
      pendingEffects: snapshot ? requestedEffects(snapshot) : [],
      awaitingAck: Array.from(pendingDispatches.keys())
    };
  };

  return Object.freeze({
    acknowledge,
    drain,
    publicState,
    pump
  });
}

module.exports = {
  APT_EFFECT_FOLLOW_UPS,
  DEFAULT_ACK_LEASE_MS,
  DEFAULT_RETRY_DELAY_MS,
  MAX_DRAIN_EFFECTS,
  createTrackerMissionEffectRunner
};
