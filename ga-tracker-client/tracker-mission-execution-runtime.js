'use strict';

const { observeFlightVoice } = require('./tracker-flight-voice-core.js');
const locationCore = require('../mission-location-core.js');
const farewellVoiceCore = require('../mission-farewell-voice-core.js');
const { createTrackerMissionExecutionAdapter } = require('./tracker-mission-execution-adapter.js');
const { createTrackerMissionEffectRunner } = require('./tracker-mission-effect-runner.js');
const { createTrackerMissionSimulatorEffects } = require('./tracker-mission-simulator-effects.js');

function createTrackerMissionExecutionRuntime(options = {}) {
  const authorityManager = options.authorityManager;
  const enabled = options.enabled === true;
  const log = typeof options.log === 'function' ? options.log : () => {};
  const onAuthorityChanged = typeof options.onAuthorityChanged === 'function'
    ? options.onAuthorityChanged
    : () => {};
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

  const adapter = createTrackerMissionExecutionAdapter({
    authorityManager,
    flightLog: options.flightLog
  });
  let simulatorEffects = null;
  let simulatorPayloadSyncBeforeStart = null;
  let simulatorPayloadSyncManifestState = null;
  let cancelSimulatorPayloadSync = null;
  let cleanupExecutionRun = null;
  let recoveryDrain = Promise.resolve();
  let effectRunner = null;
  let autoCloseAfterUnloadRunId = '';
  let autoClosePromise = null;
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
  const missingEffectHandler = type => request => ({
    ok: false,
    status: 'blocked',
    error: `${type}_handler_missing`,
    terminal: false,
    sideEffect: false,
    commandId: request?.commandId || null
  });
  const fallbackPayloadOutcome = (result = {}, error = null) => ({
    schema: 'ga.mission-payload-outcome.v1',
    status: error || result?.ok !== true ? 'warning' : 'ok',
    override: Boolean(error || result?.ok !== true),
    adapter: null,
    error: error
      ? String(error?.code || error?.message || error).trim().slice(0, 180)
      : (result?.ok !== true ? String(result?.error || 'payload_sync_failed').trim().slice(0, 180) : null),
    plan: null,
    verification: null,
    updatedAt: null
  });
  const configuredPayloadSyncBeforeStart = typeof options.payloadSyncBeforeStart === 'function'
    ? options.payloadSyncBeforeStart
    : null;
  const payloadSyncBeforeStart = request => {
    const handler = simulatorPayloadSyncBeforeStart || configuredPayloadSyncBeforeStart;
    if (!handler) return missingEffectHandler('mission_payload_sync')(request);
    const snapshot = authorityManager.getExecutionSnapshot?.() || null;
    return handler({
      ...request,
      manifest: snapshot?.manifest || snapshot?.state?.manifest || null,
      payloadContext: request?.effect?.payload?.payloadContext || null
    });
  };
  const payloadSyncManifestState = request => {
    const handler = simulatorPayloadSyncManifestState;
    if (!handler) return missingEffectHandler('mission_payload_manifest_sync')(request);
    const snapshot = authorityManager.getExecutionSnapshot?.() || null;
    const scheduled = Promise.resolve(handler({
      ...request,
      manifest: snapshot?.manifest || snapshot?.state?.manifest || null,
      payloadContext: request?.effect?.payload?.payloadContext || null
    }));
    scheduled.then(async result => {
      const status = String(result?.status || '').trim().toLowerCase();
      if (status === 'cancelled') return;
      const acknowledged = await effectRunner.acknowledge({
        effectId: request.effect?.effectId || request.commandId,
        status: 'completed',
        ...(status !== 'superseded'
          ? { result: result?.payloadOutcome || fallbackPayloadOutcome(result) }
          : {})
      });
      if (!acknowledged.ok) {
        log(`MISSION_PAYLOAD_EFFECT_ACK_ERROR effect=${request.effect?.effectId || request.commandId || ''} error=${acknowledged.error || acknowledged.status || 'unknown'}`);
        return;
      }
      await effectRunner.drain();
      logCheckpoint(`payload-ack:${status || 'completed'}`);
      await maybeAutoCloseConfirmedUnload(`payload-ack:${status || 'completed'}`);
      finalizeIfClosed(request.effect?.effectId || request.commandId || 'payload');
    }).catch(async error => {
      const effectId = request.effect?.effectId || request.commandId;
      log(`MISSION_PAYLOAD_EFFECT_ERROR effect=${effectId || ''} error=${error?.code || error?.message || error}`);
      const acknowledged = await effectRunner.acknowledge({
        effectId,
        status: 'completed',
        result: fallbackPayloadOutcome({}, error)
      });
      if (acknowledged.ok) {
        await effectRunner.drain();
        logCheckpoint('payload-ack:error');
        await maybeAutoCloseConfirmedUnload('payload-ack:error');
        finalizeIfClosed(effectId || 'payload');
      }
    });
    return {
      ok: true,
      status: 'pending',
      sideEffect: false,
      commandId: request.commandId || request.effect?.effectId || null
    };
  };
  let getSimulatorPosition = () => null;
  const playBoardingVoice = typeof options.playBoardingVoice === 'function'
    ? request => options.playBoardingVoice({ ...request, livePosition: getSimulatorPosition() })
    : missingEffectHandler('mission_boarding_voice');
  const configuredFarewellVoice = typeof options.playFarewellVoice === 'function'
    ? options.playFarewellVoice
    : completeLocalEffect;
  const playFarewellVoice = request => configuredFarewellVoice({
    ...request,
    farewellRecipe: adapter.getFarewellVoiceRecipe?.() || null,
    farewellContext: adapter.getFarewellAuthorityContext?.() || null,
    farewellDynamicContext: adapter.getFarewellDynamicContext?.() || null
  });
  const configuredPrepareFarewellVoice = typeof options.prepareFarewellVoice === 'function'
    ? options.prepareFarewellVoice
    : (typeof options.playFarewellVoice?.prepare === 'function' ? options.playFarewellVoice.prepare : null);
  const prepareFarewellVoice = request => configuredPrepareFarewellVoice?.({
    ...request,
    farewellRecipe: adapter.getFarewellVoiceRecipe?.() || null,
    farewellContext: adapter.getFarewellAuthorityContext?.() || null,
    farewellDynamicContext: adapter.getFarewellDynamicContext?.() || null
  });
  const playComplianceVoice = typeof options.playComplianceVoice === 'function'
    ? options.playComplianceVoice
    : completeLocalEffect;
  const recordAuthoritySanction = typeof options.recordAuthoritySanction === 'function'
    ? options.recordAuthoritySanction
    : completeLocalEffect;
  const releaseComplianceLogically = async request => {
    const delayMs = Math.max(0, Math.min(5000, Number(request?.effect?.payload?.delayMs) || 900));
    if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
    return completeLocalEffect(request);
  };
  // Voice rendering/playback has its own persistent ACK gate. It must not hold
  // the effect pump while independent manifest/payload changes are waiting.
  const voiceOperations = new Map();
  const backgroundVoice = handler => request => {
    const id = request.effect.effectId;
    if (!voiceOperations.has(id)) {
      const operation = Promise.resolve().then(() => handler(request)).catch(error => ({
        ok: true, status: 'completed', voiceOutcome: { schema: 'ga.mission-voice-outcome.v1', status: 'warning',
          kind: request.effect.type.replace('voice.', ''), playback: 'failed', error: error?.message || 'voice_effect_failed' }
      }));
      voiceOperations.set(id, operation);
      operation.then(async result => {
        const current = authorityManager.getExecutionSnapshot?.();
        if (current?.runId !== request.runId || current?.missionId !== request.missionId || result?.status === 'pending') return;
        await effectRunner.acknowledge({ effectId: id, status: result?.ok === true ? 'completed' : 'failed', result: result?.voiceOutcome });
        logCheckpoint('voice-ack');
        await effectRunner.drain();
        await maybeAutoCloseConfirmedUnload('voice-ack');
        finalizeIfClosed(id);
      }).catch(error => {
        log(`MISSION_VOICE_EFFECT_ERROR effect=${id} error=${error?.message || error}`);
      }).then(() => { voiceOperations.delete(id); });
    }
    return { ok: true, status: 'pending', sideEffect: true, commandId: id };
  };
  effectRunner = createTrackerMissionEffectRunner({
    log,
    authorityManager,
    applySystemEvent: request => adapter.applySystemEvent(request),
    handlers: {
      'scene.prepare': dispatchSimulatorEffect,
      'scene.boarding': dispatchSimulatorEffect,
      'voice.boarding': backgroundVoice(playBoardingVoice),
      'voice.cargo': backgroundVoice(request => authorityManager.getActiveRun({ includeBundle: true })?.resumeBundle?.executionEffectPlan?.cargoAudio
        ? playBoardingVoice(request) : completeLocalEffect(request)),
      'voice.flight': backgroundVoice(playBoardingVoice),
      'voice.approach': backgroundVoice(playBoardingVoice),
      'voice.farewell': backgroundVoice(playFarewellVoice),
      'voice.compliance_request': backgroundVoice(playComplianceVoice),
      'voice.compliance_result': backgroundVoice(playComplianceVoice),
      'payload.sync_before_start': payloadSyncBeforeStart,
      'payload.sync_manifest_state': payloadSyncManifestState,
      'scene.cargo_item_transition': dispatchSimulatorEffect,
      'scene.manual_pax': dispatchSimulatorEffect,
      'scene.deboarding': dispatchSimulatorEffect,
      'scene.deboarding_continue': dispatchSimulatorEffect,
      'scene.compliance_visit': dispatchSimulatorEffect,
      'scene.compliance_departure': dispatchSimulatorEffect,
      'compliance.logical_release': releaseComplianceLogically,
      'crewboard.authority_sanction': recordAuthoritySanction,
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
    try {
      onAuthorityChanged(reason, snapshot);
    } catch (error) {
      log(`MISSION_EXECUTION_NOTIFY_ERROR reason=${String(reason || 'runtime').replace(/\s+/g, '_').slice(0, 100)} error=${error?.message || error}`);
    }
    return true;
  };

  const finalizeIfClosed = (effectId = 'runtime') => {
    const snapshot = authorityManager.getExecutionSnapshot?.();
    if (snapshot?.state?.phase !== 'closed'
        || snapshot.state.effects.some(effect => effect.status === 'requested')
        || typeof authorityManager.finalizeExecutionRun !== 'function') return null;
    const flightRecord = adapter.finalizeFlightLog?.({ status: 'completed' }) || null;
    const finalized = authorityManager.finalizeExecutionRun({
      commandId: `${effectId}:finalize`,
      reason: 'tracker-execution-close-ack'
    });
    if (!finalized.ok) log(`MISSION_EXECUTION_FINALIZE_ERROR error=${finalized.error || finalized.status || 'unknown'}`);
    else {
      log(`MISSION_EXECUTION_FINALIZED mission=${finalized.releasedRun?.missionId || ''} run=${finalized.releasedRun?.runId || ''} segments=${Math.max(0, Number(flightRecord?.segmentCount || 0))}`);
      try {
        onAuthorityChanged(`finalized:${effectId}`, null);
      } catch (error) {
        log(`MISSION_EXECUTION_NOTIFY_ERROR reason=finalized error=${error?.message || error}`);
      }
    }
    return finalized;
  };

  const maybeAutoCloseConfirmedUnload = async (reason = 'arrival-effects') => {
    if (!autoCloseAfterUnloadRunId) return { ok: true, status: 'noop' };
    if (autoClosePromise) return autoClosePromise;
    autoClosePromise = (async () => {
      const snapshot = authorityManager.getExecutionSnapshot?.();
      if (!snapshot || snapshot.runId !== autoCloseAfterUnloadRunId) {
        autoCloseAfterUnloadRunId = '';
        return { ok: true, status: 'noop' };
      }
      if (!snapshot.state?.flags?.unloadConfirmed
          || !Array.isArray(snapshot.view?.allowedActions)
          || !snapshot.view.allowedActions.includes('request_close')) {
        return { ok: true, status: 'pending' };
      }
      const closed = adapter.executeIntent({
        commandId: `${snapshot.runId}:auto-close-after-unload`,
        intent: 'request_close',
        missionId: snapshot.missionId,
        runId: snapshot.runId,
        expectedRevision: snapshot.authorityRevision,
        reason: `auto-close:${reason}`
      });
      if (!closed.ok) return closed;
      autoCloseAfterUnloadRunId = '';
      await effectRunner.drain();
      logCheckpoint(`auto-close:${reason}`);
      finalizeIfClosed(`${snapshot.runId}:auto-close-after-unload`);
      return closed;
    })();
    try {
      return await autoClosePromise;
    } finally {
      autoClosePromise = null;
    }
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
      } else if (typeof authorityManager.getExecutionPayloadRecovery === 'function') {
        const recovery = authorityManager.getExecutionPayloadRecovery({
          missionId: validated.snapshot.missionId,
          runId: validated.snapshot.runId
        });
        if (recovery?.writeAttempted === true && recovery?.restored !== true) {
          cleanup = {
            ok: false,
            status: 'blocked',
            error: 'mission_payload_restore_simulator_not_connected',
            cleared: 0,
            sideEffect: false,
            payloadRestore: { status: 'pending', restored: false }
          };
          return {
            ok: false,
            status: cleanup.status,
            error: cleanup.error,
            sideEffect: false,
            cleanup,
            activeRun: authorityManager.getActiveRun(),
            view: validated.snapshot.view
          };
        }
      }
      adapter.finalizeFlightLog?.({ status: 'aborted' });
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
          `payloadRestore=${String(cleanup?.payloadRestore?.status || 'noop').replace(/\s+/g, '_').slice(0, 80)}`,
          `source=${String(request.controllerSession?.role || 'unknown').replace(/\s+/g, '_').slice(0, 40)}`
        ].join(' '));
      }
      return { ...aborted, sideEffect: cleanup?.sideEffect === true, cleanup };
    }
    const result = adapter.executeIntent(request);
    if (!result.ok) return result;
    if (request.intent === 'prepare_mission' && typeof options.prepareBoardingVoice === 'function') {
      // Preparation is best-effort and must never delay the intent ACK.
      Promise.resolve().then(() => options.prepareBoardingVoice({
        missionId: request.missionId, runId: request.runId, livePosition: getSimulatorPosition()
      })).catch(error => log(`MISSION_BOARDING_PREWARM_ERROR error=${error?.message || error}`));
    }
    if (String(request.intent || request.action || '').trim().toLowerCase() === 'confirm_unload') {
      autoCloseAfterUnloadRunId = String(result.activeRun?.runId || authorityManager.getActiveRun()?.runId || '');
    }
    const drainEffects = async () => {
      const effects = await effectRunner.drain();
      logCheckpoint(`intent:${request.intent || 'unknown'}`);
      await maybeAutoCloseConfirmedUnload(`intent:${request.intent || 'unknown'}`);
      finalizeIfClosed(request.commandId || 'intent');
      return effects;
    };
    if (request.deferEffects === true) {
      Promise.resolve().then(drainEffects).catch(error => {
        log(`MISSION_EFFECT_DEFERRED_ERROR intent=${request.intent || 'unknown'} error=${error?.code || error?.message || error}`);
      });
      return {
        ...result,
        activeRun: authorityManager.getActiveRun(),
        effectDispatch: {
          status: 'scheduled',
          pendingCount: effectRunner.publicState().pendingEffects.length
        }
      };
    }
    const effects = await drainEffects();
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
    getSimulatorPosition = typeof simulator.getLivePosition === 'function' ? simulator.getLivePosition : () => null;
    simulatorPayloadSyncBeforeStart = typeof simulator.syncPayloadBeforeStart === 'function'
      ? simulator.syncPayloadBeforeStart
      : null;
    simulatorPayloadSyncManifestState = typeof simulator.syncPayloadManifestState === 'function'
      ? simulator.syncPayloadManifestState
      : null;
    cancelSimulatorPayloadSync = typeof simulator.cancelPayloadSync === 'function'
      ? simulator.cancelPayloadSync
      : null;
    const bridge = createTrackerMissionSimulatorEffects({
      getCargoRevision: adapter.getCargoRevision, onCargoRevision: adapter.setCargoRevision,
      authorityManager,
      getLivePosition: simulator.getLivePosition,
      dispatchCommand: simulator.dispatchCommand,
      acknowledgeEffect: async request => {
        const acknowledged = await effectRunner.acknowledge(request);
        if (acknowledged.ok) {
          await effectRunner.drain();
          logCheckpoint(`effect-ack:${request.status || 'unknown'}`);
          await maybeAutoCloseConfirmedUnload(`effect-ack:${request.status || 'unknown'}`);
          finalizeIfClosed(request.effectId);
        }
        return acknowledged;
      },
      onStage: async stage => {
        if (stage?.effectType === 'scene.compliance_visit'
            && stage?.stage === 'visitors_at_aircraft') {
          const waiting = adapter.applySystemEvent({
            type: 'COMPLIANCE_INSPECTORS_WAITING',
            eventId: `${stage.effectId}:visitors-at-aircraft`,
            missionId: stage.missionId,
            runId: stage.runId,
            payload: {
              sceneFallback: ['fallback', 'error'].includes(String(stage.simulatorAck?.status || '').toLowerCase())
            }
          });
          if (!waiting.ok) {
            if (waiting.status === 'noop') return true;
            log(`MISSION_COMPLIANCE_STAGE_ERROR effect=${stage.effectId || ''} error=${waiting.error || waiting.status || 'unknown'}`);
            return false;
          }
          await effectRunner.drain();
          logCheckpoint('compliance-stage:visitors-at-aircraft');
          return true;
        }
        if (stage?.effectType !== 'scene.deboarding'
            || stage?.coordinateFarewell !== true
            || stage?.stage !== 'cue') return false;
        const started = adapter.applySystemEvent({
          type: 'FAREWELL_STARTED',
          eventId: `${stage.effectId}:farewell-cue`,
          missionId: stage.missionId,
          runId: stage.runId
        });
        if (!started.ok) {
          if (started.status === 'noop') return true;
          log(`MISSION_FAREWELL_STAGE_ERROR effect=${stage.effectId || ''} error=${started.error || started.status || 'unknown'}`);
          return false;
        }
        await effectRunner.drain();
        logCheckpoint('deboarding-stage:farewell-cue');
        return true;
      },
      log
    });
    simulatorEffects = bridge;
    cleanupExecutionRun = typeof simulator.cleanupMission === 'function' ? simulator.cleanupMission : null;
    recoveryDrain = effectRunner.drain().then((result) => {
      if (!result.ok && !['mission_execution_authority_web', 'no_active_run'].includes(result.error)) {
        log(`MISSION_EFFECT_RECOVERY status=${result.status || 'error'} error=${result.error || ''}`);
      }
      return maybeAutoCloseConfirmedUnload('effect-recovery');
    }).catch(error => log(`MISSION_EFFECT_RECOVERY_ERROR error=${error?.message || error}`));
    return bridge;
  };

  const detachSimulator = (bridge = null) => {
    if (bridge && simulatorEffects !== bridge) return false;
    getSimulatorPosition = () => null;
    simulatorEffects?.cancelPending?.({ preserveManual: true });
    simulatorEffects = null;
    simulatorPayloadSyncBeforeStart = null;
    simulatorPayloadSyncManifestState = null;
    if (cancelSimulatorPayloadSync) {
      Promise.resolve(cancelSimulatorPayloadSync('simulator-detached')).catch(error => {
        log(`MISSION_PAYLOAD_CANCEL_ERROR error=${error?.code || error?.message || error}`);
      });
    }
    cancelSimulatorPayloadSync = null;
    effectRunner.releasePending();
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
      if (result?.ok && result.status !== 'ignored') {
        const snapshot = authorityManager.getExecutionSnapshot?.();
        const run = authorityManager.getActiveRun({ includeBundle: true });
        const context = run?.resumeBundle?.executionEffectPlan?.effects?.['voice.approach']?.context;
        if (snapshot && context?.supported && context.mode === 'passenger') {
          const previous = { ...adapter.getFlightVoiceState() };
          const flights = snapshot.state.effects.filter(effect => effect.type === 'voice.flight');
          const comfort = flights.filter(effect => effect.payload.kind === 'comfort');
          previous.count = Math.max(Number(previous.count) || 0, comfort.length);
          previous.lastAt = Math.max(Number(previous.lastAt) || 0, ...comfort.map(effect => Number(effect.payload.triggerAt) || 0));
          previous.offDestLastAt = Math.max(Number(previous.offDestLastAt) || 0, ...flights.filter(effect => effect.payload.kind === 'off_destination').map(effect => Number(effect.payload.triggerAt) || 0));
          previous.landingRollTriggered = previous.landingRollTriggered || flights.some(effect => effect.payload.kind === 'landing_roll');
          previous.wrongStartContinueDone = previous.wrongStartContinueDone || flights.some(effect => effect.payload.kind === 'wrong_start');
          const departure = context.departure;
          const departureDistanceNm = departure ? locationCore.haversineNm(Number(sample.lat), Number(sample.lon), Number(departure.lat), Number(departure.lng ?? departure.lon)) : null;
          const triggerAt = Number(sample.observedAt) || Date.now();
          const detected = observeFlightVoice(context, previous, {
            now: triggerAt, active: snapshot.state.flags.active,
            ending: snapshot.state.flags.closingPending || snapshot.state.flags.farewellStarted || snapshot.state.flags.farewellCompleted || snapshot.state.flags.unloadConfirmed,
            greetingDone: snapshot.state.flags.boardingConfirmed,
            approachDone: !!snapshot.state.voice.approach || snapshot.state.effects.some(effect => effect.type === 'voice.approach')
              || (result.destination?.dMissionNm != null && Number(result.destination.dMissionNm) <= 4)
              || (result.destination?.dMissionNm != null && Number(result.destination.dMissionNm) <= 4.5 && adapter.hasNewLandingApproachCandidate()),
            wrongStartActive: snapshot.state.voice.boarding?.wrongStartActive,
            motionProtectionEnabled: context.motionProtectionEnabled,
            comfortPending: comfort.some(effect => effect.status === 'requested'),
            touchdown: result.acceptedEvent?.type === 'TOUCHDOWN',
            offDestinationLanding: sample.onGround === true && Number(sample.gsKts) <= 3
              && snapshot.state.flags.groundStill && result.destination?.atDestination !== true
              && adapter.hasRecordedAirbornePhase(),
            destinationDistanceNm: result.destination?.dArrivalNm ?? result.destination?.dMissionNm,
            departureDistanceNm, lat: sample.lat, lon: sample.lon, flightData: sample
          });
          for (const effect of detected.effects) adapter.applySystemEvent({ missionId: snapshot.missionId, runId: snapshot.runId,
            type: 'APT_FLIGHT_VOICE_REQUESTED', eventId: `flight-voice:${effect.kind}:${triggerAt}`, payload: { ...effect, triggerAt } });
          adapter.setFlightVoiceState(detected.state, detected.effects.length > 0);
          if (detected.effects.length) effectRunner.drain().catch(error => log(`MISSION_FLIGHT_VOICE_ERROR ${error?.message || error}`));
        }
      }
      const distance = result?.destination?.dMissionNm;
      if (result?.ok && result.status !== 'ignored'
          && distance != null && Number.isFinite(Number(distance))
          && (Number(distance) <= 4
            || (Number(distance) <= 4.5 && adapter.hasNewLandingApproachCandidate()))) {
        const snapshot = authorityManager.getExecutionSnapshot?.();
        if (snapshot?.state?.flags?.active && snapshot.state.phase !== 'closing'
            && !snapshot.state.flags.closingPending
            && !snapshot.state.flags.farewellStarted && !snapshot.state.flags.farewellCompleted
            && !snapshot.state.flags.unloadConfirmed
            && !snapshot.state.effects.some(effect => effect.type === 'scene.deboarding') && !snapshot.state.voice?.approach
            && !snapshot.state.effects.some(effect => effect.type === 'voice.approach')) {
          const run = authorityManager.getActiveRun({ includeBundle: true });
          const context = run?.resumeBundle?.executionEffectPlan?.effects?.['voice.approach']?.context;
          if (context?.supported && context.mode === 'passenger') {
            const flightData = {};
            for (const key of ['gForce', 'bankDeg', 'windKts', 'windDeg', 'windGustKts', 'tempC', 'visKm', 'precipRateMmH', 'turbulencePct']) {
              if (sample[key] != null && Number.isFinite(Number(sample[key]))) flightData[key] = Number(sample[key]);
            }
            for (const key of ['precipActive', 'inCloud']) if (typeof sample[key] === 'boolean') flightData[key] = sample[key];
            const approach = adapter.applySystemEvent({ missionId: snapshot.missionId, runId: snapshot.runId,
              type: 'APT_APPROACH_VOICE_REQUESTED', eventId: 'apt-approach', payload: { flightData, weatherMismatchUsed: !!farewellVoiceCore.weatherMismatchHint({ ...context, briefingWeather: context.briefingWeather || {} }, flightData) } });
            if (approach?.ok) {
              logCheckpoint('telemetry:APT_APPROACH_VOICE_REQUESTED');
              effectRunner.drain().catch(error => log(`MISSION_APPROACH_VOICE_ERROR error=${error?.message || error}`));
            }
          }
        }
      }
      if (result?.acceptedEvent) {
        lastTelemetryDiagnosticKey = '';
        lastTelemetryDiagnosticAt = 0;
        logCheckpoint(`telemetry:${result.acceptedEvent.type || 'event'}`);
        const nearFarewellTarget = result.destination?.atDestination === true
          || (Number.isFinite(Number(result.destination?.dArrivalNm)) && Number(result.destination.dArrivalNm) <= 1.2)
          || (Number.isFinite(Number(result.destination?.dMissionNm)) && Number(result.destination.dMissionNm) <= 1.2);
        if (result.acceptedEvent.type === 'TOUCHDOWN'
            && nearFarewellTarget
            && configuredPrepareFarewellVoice) {
          const run = authorityManager.getActiveRun();
          try {
            const prepared = prepareFarewellVoice({ missionId: run?.missionId, runId: run?.runId });
            if (prepared && typeof prepared.catch === 'function') {
              prepared.catch(error => log(`MISSION_FAREWELL_VOICE_PREWARM_ERROR reason=${error?.code || error?.message || error}`));
            }
          } catch (error) {
            log(`MISSION_FAREWELL_VOICE_PREWARM_ERROR reason=${error?.code || error?.message || error}`);
          }
        }
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
