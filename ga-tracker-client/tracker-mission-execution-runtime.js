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
  let cleanupExecutionRun = null;
  let recoveryDrain = Promise.resolve();
  let lastTelemetryDiagnosticKey = '';
  let lastTelemetryDiagnosticAt = 0;
  const dispatchSimulatorEffect = request => {
    if (!simulatorEffects) {
      return { ok: false, status: 'blocked', error: 'mission_simulator_not_connected', sideEffect: false };
    }
    return simulatorEffects.dispatch(request);
  };
  const completeLocalEffect = request => ({
    ok: true,
    status: 'completed',
    sideEffect: false,
    commandId: request?.commandId || null
  });
  const effectRunner = createTrackerMissionEffectRunner({
    authorityManager,
    applySystemEvent: request => adapter.applySystemEvent(request),
    handlers: {
      'scene.prepare': dispatchSimulatorEffect,
      'scene.boarding': dispatchSimulatorEffect,
      'scene.deboarding': dispatchSimulatorEffect,
      'cargo.pickup_confirmed': completeLocalEffect,
      'cargo.unload_confirmed': completeLocalEffect,
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
    if (String(request.intent || request.action || '').trim().toLowerCase() === 'abort_mission') {
      const validated = adapter.validateIntent(request);
      if (!validated.ok) return validated;
      let cleanup = { ok: true, status: 'simulator_not_connected', cleared: 0, sideEffect: false };
      if (cleanupExecutionRun) {
        try {
          cleanup = await cleanupExecutionRun({
            missionId: validated.snapshot.missionId,
            runId: validated.snapshot.runId,
            commandId: request.commandId,
            reason: String(request.payload?.reason || request.reason || 'mission-execution-abort')
          });
        } catch (error) {
          cleanup = { ok: false, status: 'error', error: error?.code || error?.message || String(error), cleared: 0, sideEffect: false };
        }
        if (!cleanup || cleanup.ok !== true) {
          return {
            ok: false,
            status: cleanup?.status || 'error',
            error: cleanup?.error || 'mission_execution_cleanup_failed',
            sideEffect: cleanup?.sideEffect === true,
            cleanup,
            activeRun: authorityManager.getActiveRun(),
            view: validated.snapshot.view
          };
        }
      }
      const aborted = authorityManager.abortExecutionRun({
        missionId: validated.snapshot.missionId,
        runId: validated.snapshot.runId,
        expectedRevision: validated.snapshot.authorityRevision,
        commandId: request.commandId,
        clientId: request.controllerSession?.clientId || 'tracker-execution-runtime',
        reason: String(request.payload?.reason || request.reason || 'mission-execution-abort')
      });
      if (aborted.ok) {
        log([
          'MISSION_EXECUTION_ABORTED',
          `mission=${aborted.releasedRun?.missionId || validated.snapshot.missionId}`,
          `run=${aborted.releasedRun?.runId || validated.snapshot.runId}`,
          `cleared=${Math.max(0, Number(cleanup?.cleared) || 0)}`,
          `cleanup=${String(cleanup?.status || 'ok').replace(/\s+/g, '_').slice(0, 80)}`,
          `source=${String(request.controllerSession?.role || 'unknown').replace(/\s+/g, '_').slice(0, 40)}`
        ].join(' '));
      }
      return { ...aborted, sideEffect: cleanup?.sideEffect === true, cleanup };
    }
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
    cleanupExecutionRun = typeof simulator.cleanupMission === 'function' ? simulator.cleanupMission : null;
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
    cleanupExecutionRun = null;
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
      if (result?.acceptedEvent) {
        lastTelemetryDiagnosticKey = '';
        lastTelemetryDiagnosticAt = 0;
        logCheckpoint(`telemetry:${result.acceptedEvent.type || 'event'}`);
      } else if (result?.status === 'ignored') {
        const snapshot = authorityManager.getExecutionSnapshot?.();
        const reason = String(result.reason || result.error || 'ignored');
        const diagnosticKey = [
          snapshot?.runId || '',
          snapshot?.state?.phase || '',
          reason,
          sample.simPaused === true ? 'paused' : 'running',
          sample.inMenuOrMap === true ? 'menu' : 'world',
          Number(sample.dialogMode) === 1 ? 'dialog' : 'no-dialog'
        ].join(':');
        const observedAt = Number(sample.observedAt) || Date.now();
        if (diagnosticKey !== lastTelemetryDiagnosticKey || observedAt - lastTelemetryDiagnosticAt >= 15000) {
          lastTelemetryDiagnosticKey = diagnosticKey;
          lastTelemetryDiagnosticAt = observedAt;
          log([
            'MISSION_EXECUTION_TELEMETRY_IGNORED',
            `mission=${snapshot?.missionId || 'none'}`,
            `run=${snapshot?.runId || 'none'}`,
            `phase=${snapshot?.state?.phase || 'unknown'}`,
            `reason=${reason.replace(/\s+/g, '_').slice(0, 80)}`,
            `onGround=${sample.onGround === true ? 1 : 0}`,
            `gsKts=${Number.isFinite(Number(sample.gsKts)) ? Number(sample.gsKts).toFixed(1) : 'n/a'}`,
            `paused=${sample.simPaused === true ? 1 : 0}`,
            `pauseA=${Number.isFinite(Number(sample.simPausedA)) ? Number(sample.simPausedA).toFixed(0) : 'n/a'}`,
            `pauseB=${Number.isFinite(Number(sample.simPausedB)) ? Number(sample.simPausedB).toFixed(0) : 'n/a'}`,
            `pauseFlags=${Math.max(0, Math.round(Number(sample.pauseFlags) || 0))}`,
            `menu=${sample.inMenuOrMap === true ? 1 : 0}`,
            `dialog=${Number(sample.dialogMode) === 1 ? 1 : 0}`
          ].join(' '));
        }
      }
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
