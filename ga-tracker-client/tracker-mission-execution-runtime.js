'use strict';

const { createTrackerMissionExecutionAdapter } = require('./tracker-mission-execution-adapter.js');
const { createTrackerMissionEffectRunner } = require('./tracker-mission-effect-runner.js');
const { createTrackerMissionSimulatorEffects } = require('./tracker-mission-simulator-effects.js');

function createTrackerMissionExecutionRuntime(options = {}) {
  const authorityManager = options.authorityManager;
  const enabled = options.enabled === true;
  const log = typeof options.log === 'function' ? options.log : () => {};
  if (!authorityManager || typeof authorityManager.getActiveRun !== 'function') {
    throw new TypeError('mission_execution_runtime_authority_manager_required');
  }
  if (!enabled) {
    return Object.freeze({
      enabled: false,
      executionAuthority: 'web',
      executeIntent: null,
      attachSimulator: () => null,
      detachSimulator: () => false,
      observeTelemetry: () => ({ ok: false, status: 'blocked', error: 'mission_execution_runtime_disabled', sideEffect: false }),
      publicState: () => ({ enabled: false, executionAuthority: 'web', simulatorAttached: false })
    });
  }

  const adapter = createTrackerMissionExecutionAdapter({ authorityManager });
  let simulatorEffects = null;
  let recoveryDrain = Promise.resolve();
  const dispatchSimulatorEffect = request => {
    if (!simulatorEffects) {
      return { ok: false, status: 'blocked', error: 'mission_simulator_not_connected', sideEffect: false };
    }
    return simulatorEffects.dispatch(request);
  };
  const effectRunner = createTrackerMissionEffectRunner({
    authorityManager,
    applySystemEvent: request => adapter.applySystemEvent(request),
    handlers: {
      'scene.prepare': dispatchSimulatorEffect,
      'scene.boarding': dispatchSimulatorEffect,
      'mission.close_requested': dispatchSimulatorEffect
    }
  });

  const logCheckpoint = (reason = 'runtime') => {
    const snapshot = authorityManager.getExecutionSnapshot?.();
    if (!snapshot) return false;
    const effects = Array.isArray(snapshot.state?.effects) ? snapshot.state.effects : [];
    log([
      'MISSION_EXECUTION_CHECKPOINT',
      `mission=${snapshot.missionId || 'none'}`,
      `run=${snapshot.runId || 'none'}`,
      `reason=${String(reason || 'runtime').replace(/\s+/g, '_').slice(0, 100)}`,
      `authorityRevision=${Number(snapshot.authorityRevision) || 0}`,
      `executionRevision=${Number(snapshot.executionRevision) || 0}`,
      `phase=${snapshot.state?.phase || 'unknown'}`,
      `stateHash=${snapshot.executionStateHash || 'none'}`,
      `effectsRequested=${effects.filter(effect => effect.status === 'requested').length}`,
      `effectsCompleted=${effects.filter(effect => effect.status === 'completed').length}`,
      `effectsFailed=${effects.filter(effect => effect.status === 'failed').length}`
    ].join(' '));
    return true;
  };

  const finalizeIfClosed = (effectId = 'runtime') => {
    const snapshot = authorityManager.getExecutionSnapshot?.();
    if (snapshot?.state?.phase !== 'closed'
        || snapshot.state.effects.some(effect => effect.status === 'requested')
        || typeof authorityManager.finalizeExecutionRun !== 'function') return null;
    const finalized = authorityManager.finalizeExecutionRun({
      commandId: `${effectId}:finalize`,
      reason: 'tracker-execution-close-ack'
    });
    if (!finalized.ok) log(`MISSION_EXECUTION_FINALIZE_ERROR error=${finalized.error || finalized.status || 'unknown'}`);
    else log(`MISSION_EXECUTION_FINALIZED mission=${finalized.releasedRun?.missionId || ''} run=${finalized.releasedRun?.runId || ''}`);
    return finalized;
  };

  const executeIntent = async (request = {}) => {
    await recoveryDrain;
    const result = adapter.executeIntent(request);
    if (!result.ok) return result;
    const effects = await effectRunner.drain();
    logCheckpoint(`intent:${request.intent || 'unknown'}`);
    finalizeIfClosed(request.commandId || 'intent');
    return {
      ...result,
      activeRun: authorityManager.getActiveRun(),
      effectDispatch: {
        status: effects.status,
        pendingCount: effects.pendingCount
      }
    };
  };

  const attachSimulator = (simulator = {}) => {
    const bridge = createTrackerMissionSimulatorEffects({
      authorityManager,
      getLivePosition: simulator.getLivePosition,
      dispatchCommand: simulator.dispatchCommand,
      acknowledgeEffect: async request => {
        const acknowledged = await effectRunner.acknowledge(request);
        if (acknowledged.ok) {
          await effectRunner.drain();
          logCheckpoint(`effect-ack:${request.status || 'unknown'}`);
          finalizeIfClosed(request.effectId);
        }
        return acknowledged;
      },
      log
    });
    simulatorEffects = bridge;
    recoveryDrain = effectRunner.drain().then((result) => {
      if (!result.ok && !['mission_execution_authority_web', 'no_active_run'].includes(result.error)) {
        log(`MISSION_EFFECT_RECOVERY status=${result.status || 'error'} error=${result.error || ''}`);
      }
    }).catch(error => log(`MISSION_EFFECT_RECOVERY_ERROR error=${error?.message || error}`));
    return bridge;
  };

  const detachSimulator = (bridge = null) => {
    if (bridge && simulatorEffects !== bridge) return false;
    simulatorEffects = null;
    return true;
  };

  return Object.freeze({
    enabled: true,
    executionAuthority: 'tracker',
    executeIntent,
    attachSimulator,
    detachSimulator,
    observeTelemetry: sample => {
      const result = adapter.observeTelemetry(sample);
      if (result?.acceptedEvent) logCheckpoint(`telemetry:${result.acceptedEvent.type || 'event'}`);
      return result;
    },
    publicState: () => ({
      enabled: true,
      executionAuthority: authorityManager.getActiveRun()?.executionAuthority || 'web',
      simulatorAttached: Boolean(simulatorEffects),
      effects: effectRunner.publicState()
    })
  });
}

module.exports = {
  createTrackerMissionExecutionRuntime
};
