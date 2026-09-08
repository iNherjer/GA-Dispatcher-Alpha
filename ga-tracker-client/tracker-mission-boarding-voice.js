'use strict';

const boardingVoiceCore = require('../mission-boarding-voice-core.js');
const { observeFlightVoice } = require('./tracker-flight-voice-core.js');
const locationCore = require('../mission-location-core.js');
const { createTrackerMissionCargoAudio } = require('./tracker-mission-cargo-audio.js');
const { buildApproachPrompt } = require('./tracker-mission-approach-voice.js');

function cleanString(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function completed(request, details = {}) {
  return {
    ok: true,
    status: 'completed',
    sideEffect: details.sideEffect === true,
    commandId: cleanString(request?.commandId || request?.effect?.effectId, 220) || null,
    ...details
  };
}

function voiceOutcome(recipe, values = {}) {
  return {
    schema: 'ga.mission-voice-outcome.v1',
    kind: recipe?.kind || 'boarding',
    ...(recipe?.wrongStartActive === true ? { wrongStartActive: true } : {}),
    status: cleanString(values.status, 40) || 'ok',
    text: cleanString(values.text || recipe?.fallbackText, 4000),
    speaker: boardingVoiceCore.normalizeSpeaker(values.speaker || recipe?.speaker),
    provider: cleanString(values.provider, 40),
    textModel: cleanString(values.textModel, 100),
    model: cleanString(values.model, 100),
    voiceName: cleanString(values.voiceName, 80),
    playback: cleanString(values.playback, 80) || null,
    error: cleanString(values.error, 180) || null
  };
}

function createTrackerMissionBoardingVoice(options = {}) {
  const authorityManager = options.authorityManager;
  const voiceService = options.voiceService;
  const getAudioPlaybackCandidates = typeof options.getAudioPlaybackCandidates === 'function'
    ? options.getAudioPlaybackCandidates
    : () => 0;
  const log = typeof options.log === 'function' ? options.log : () => {};
  const playbackClaimTimeoutMs = Math.max(250, Math.min(30000, Number(options.playbackClaimTimeoutMs) || 15000));
  const playbackTimeoutMs = Math.max(1000, Math.min(180000, Number(options.playbackTimeoutMs) || 90000));
  const generationTimeoutMs = Math.max(1000, Math.min(180000, Number(options.generationTimeoutMs) || 75000));
  if (!authorityManager || typeof authorityManager.getActiveRun !== 'function') {
    throw new TypeError('mission_boarding_voice_authority_manager_required');
  }

  const cargoAudio = createTrackerMissionCargoAudio({ authorityManager, voiceService, getAudioPlaybackCandidates });
  const dispatch = async (request = {}) => {
    const effectId = cleanString(request?.effect?.effectId || request.commandId, 220);
    const run = authorityManager.getActiveRun({ includeBundle: true });
    if (!run?.missionId || !run?.runId) return completed(request, { voiceStatus: 'no_active_run' });
    if (run.executionAuthority !== 'tracker') return completed(request, { voiceStatus: 'web_authority' });
    if (cleanString(request.missionId) !== cleanString(run.missionId)
        || cleanString(request.runId, 220) !== cleanString(run.runId, 220)) {
      return { ok: false, status: 'blocked', error: 'mission_run_conflict', terminal: false, sideEffect: false, commandId: effectId };
    }
    if (request.effect?.type === 'voice.cargo') return cargoAudio(request);
    const plan = object(run.resumeBundle?.executionEffectPlan);
    let recipe = boardingVoiceCore.normalizeRecipe(object(object(plan.effects)['voice.boarding']).recipe);
    const flightContext = object(object(plan.effects)['voice.approach']).context;
    if (request.effect?.type === 'voice.boarding' && flightContext?.supported && flightContext.departure) {
      const telemetry = request.livePosition || authorityManager.getExecutionRuntimeContext?.({ missionId: run.missionId, runId: run.runId })?.latestTelemetry;
      if (telemetry?.lat != null && telemetry?.lon != null) {
        const departure = flightContext.departure;
        const distance = locationCore.haversineNm(telemetry.lat, telemetry.lon, Number(departure.lat), Number(departure.lng ?? departure.lon));
        if (Number.isFinite(distance) && distance > 1) {
          const prompt = observeFlightVoice(flightContext, {}, { wrongLocationDistanceNm: distance }).wrongLocationPrompt;
          if (prompt) recipe = { ...recipe, prompt, fallbackText: '', wrongStartActive: true, playCue: false };
        }
      }
    }
    if (request.effect?.type === 'voice.flight') {
      let payload = object(request.effect.payload);
      if (payload.kind === 'cargo_event' && flightContext?.supported) {
        payload = observeFlightVoice(flightContext, {}, { cargoEvent: { type: 'dropped_required', item: payload.item } }).effects[0] || {};
      }
      if (!flightContext?.supported || !['comfort', 'wrong_start', 'off_destination', 'landing_roll', 'cargo_event'].includes(payload.kind) || !payload.prompt) return completed(request);
      await new Promise(resolve => setTimeout(resolve, Math.max(0, Number(payload.delayMs) || 0)));
      const current = authorityManager.getExecutionSnapshot?.();
      if (current && (current.runId !== run.runId || !current.state.flags.active || current.state.flags.closingPending || current.state.flags.farewellStarted)) return completed(request);
      recipe = { ...recipe, ...flightContext, enabled: true, kind: payload.kind, prompt: payload.prompt, fallbackText: '', playCue: false };
    }
    if (request.effect?.type === 'voice.approach') {
      const context = object(object(plan.effects)['voice.approach']).context;
      const prompt = buildApproachPrompt(context, object(request.effect?.payload?.flightData));
      if (!prompt) return completed(request, { voiceStatus: 'approach_context_missing' });
      // Standalone cancels this delay for mission end, not for touchdown itself.
      await new Promise(resolve => setTimeout(resolve, 2000));
      const current = authorityManager.getExecutionSnapshot?.();
      if (current && (current.runId !== run.runId || !current.state?.flags?.active
          || current.state?.phase === 'closing' || current.state?.flags?.closingPending
          || current.state?.flags?.farewellStarted
          || current.state?.flags?.farewellCompleted || current.state?.flags?.unloadConfirmed
          || current.state?.effects?.some(effect => effect.type === 'scene.deboarding'))) {
        return completed(request, { voiceStatus: 'approach_cancelled' });
      }
      recipe = { ...recipe, ...context, kind: 'approach', enabled: true, prompt, fallbackText: '', playCue: false };
    }
    if (!recipe || (recipe.missionId && recipe.missionId !== run.missionId)) {
      log(`MISSION_BOARDING_VOICE_FALLBACK effect=${effectId} reason=recipe_missing`);
      return completed(request, { voiceStatus: 'recipe_missing' });
    }
    if (recipe.enabled !== true || (!recipe.prompt && !recipe.fallbackText)) {
      log(`MISSION_BOARDING_VOICE_SKIPPED effect=${effectId} reason=${recipe.skipReason || 'disabled'}`);
      return completed(request, {
        voiceStatus: recipe.skipReason || 'disabled',
        voiceOutcome: voiceOutcome(recipe, { status: 'skipped', playback: recipe.skipReason || 'disabled' })
      });
    }
    if (!voiceService || voiceService.publicState?.().configured !== true) {
      log(`MISSION_BOARDING_VOICE_BEST_EFFORT effect=${effectId} reason=voice_not_configured`);
      return completed(request, {
        voiceStatus: 'voice_not_configured',
        voiceOutcome: voiceOutcome(recipe, { status: 'warning', playback: 'not_played', error: 'voice_not_configured' })
      });
    }
    let job;
    const cancelAtMissionEnd = request.effect?.type === 'voice.approach'
      || (request.effect?.type === 'voice.flight' && request.effect?.payload?.kind === 'landing_roll');
    const isPlaybackAllowed = () => {
      const current = authorityManager.getExecutionSnapshot?.();
      return !current || (current.runId === run.runId && current.state.flags.active
        && !current.state.flags.closingPending && !current.state.flags.farewellStarted
        && !current.state.flags.farewellCompleted && !current.state.flags.unloadConfirmed
        && current.state.phase !== 'closing');
    };
    try {
      voiceService.request({
        deferPlayback: cancelAtMissionEnd,
        ...(cancelAtMissionEnd ? { isPlaybackAllowed } : {}),
        effectId,
        kind: recipe.kind || 'boarding',
        prompt: recipe.prompt,
        fallbackText: recipe.fallbackText,
        taskDomain: recipe.taskDomain,
        speaker: recipe.speaker,
        cue: recipe.playCue === true ? recipe.cue : null,
        textModels: recipe.textModels,
        ttsModels: recipe.ttsModels,
        ttsHedgeEnabled: recipe.ttsHedgeEnabled,
        ttsHedgeDelayMs: recipe.ttsHedgeDelayMs,
        synthesizeAudio: recipe.audioEnabled === true
      });
      let generationTimer = null;
      let endMonitor = null;
      try {
        job = await Promise.race([
          voiceService.wait(effectId),
          ...(cancelAtMissionEnd ? [new Promise(resolve => {
            endMonitor = setInterval(() => {
              if (!isPlaybackAllowed()) {
                voiceService.cancel?.(effectId, 'mission_end');
                resolve({ status: 'cancelled', error: 'mission_end' });
              }
            }, 100);
          })] : []),
          new Promise(resolve => {
            generationTimer = setTimeout(() => resolve({ status: 'timeout', error: 'boarding_voice_timeout' }), generationTimeoutMs);
          })
        ]);
      } finally {
        if (generationTimer) clearTimeout(generationTimer);
        if (endMonitor) clearInterval(endMonitor);
      }
      if (job?.status === 'timeout') voiceService.cancel?.(effectId, 'boarding_voice_timeout');
    } catch (error) {
      log(`MISSION_BOARDING_VOICE_BEST_EFFORT effect=${effectId} reason=${error?.code || error?.message || error}`);
      return completed(request, {
        voiceStatus: error?.code || 'voice_request_failed',
        voiceOutcome: voiceOutcome(recipe, { status: 'warning', playback: 'not_played', error: error?.code || 'voice_request_failed' })
      });
    }
    if (cancelAtMissionEnd) {
      if (!isPlaybackAllowed()) {
        voiceService.cancel?.(effectId, 'mission_end');
        return completed(request, { voiceStatus: 'mission_end' });
      }
      voiceService.activatePlayback?.(effectId);
    }
    if (!job || job.status !== 'ready' || (recipe.audioEnabled === true && job.audioAvailable !== true)) {
      log(`MISSION_BOARDING_VOICE_BEST_EFFORT effect=${effectId} reason=${job?.error || job?.status || 'voice_generation_failed'}`);
      return completed(request, {
        voiceStatus: job?.error || job?.status || 'voice_generation_failed',
        voiceOutcome: voiceOutcome(recipe, { status: 'warning', playback: 'not_played', error: job?.error || 'voice_generation_failed' })
      });
    }
    const candidates = recipe.audioEnabled === true
      ? Math.max(0, Math.round(Number(getAudioPlaybackCandidates()) || 0))
      : 0;
    let playback = { status: recipe.audioEnabled === true ? (candidates > 0 ? 'pending' : 'no_audio_instance') : 'audio_disabled', completed: false };
    if (recipe.audioEnabled === true && candidates > 0 && typeof voiceService.waitForPlayback === 'function') {
      if (typeof voiceService.waitForPlaybackClaim === 'function') {
        const claim = await voiceService.waitForPlaybackClaim(effectId, { timeoutMs: playbackClaimTimeoutMs });
        if (claim?.claimed === true) {
          playback = claim.status === 'completed'
            ? { status: 'completed', completed: true, job: claim.job || null }
            : await voiceService.waitForPlayback(effectId, { timeoutMs: playbackTimeoutMs });
          if (playback?.status === 'timeout') voiceService.cancel?.(effectId, 'boarding_voice_playback_timeout');
        } else {
          voiceService.cancel?.(effectId, 'boarding_voice_unclaimed');
          playback = { status: 'no_audio_claim', completed: false, job: claim?.job || null };
        }
      } else {
        playback = await voiceService.waitForPlayback(effectId, { timeoutMs: playbackTimeoutMs });
      }
    }
    log(`MISSION_BOARDING_VOICE_COMPLETE effect=${effectId} job=${job.status} playback=${playback.status} candidates=${candidates}`);
    return completed(request, {
      sideEffect: true,
      voiceStatus: playback.status,
      voiceOutcome: voiceOutcome(recipe, {
        status: ['timeout', 'no_audio_claim', 'released', 'failed', 'cancelled', 'expired'].includes(playback.status) ? 'warning' : 'ok',
        text: job.text,
        speaker: job.speaker,
        provider: job.provider,
        textModel: job.textModel,
        model: job.model,
        voiceName: job.voiceName,
        playback: playback.status,
        error: playback.status === 'timeout'
          ? 'voice_playback_timeout'
          : (playback.status === 'no_audio_claim' ? 'voice_playback_unclaimed'
            : (playback.status === 'released' ? 'voice_playback_failed' : null))
      }),
      voiceJob: {
        effectId: job.effectId,
        text: job.text,
        speaker: job.speaker,
        provider: job.provider,
        textModel: job.textModel,
        model: job.model,
        voiceName: job.voiceName,
        playback: playback.status
      }
    });
  };

  return Object.freeze({ dispatch });
}

module.exports = { createTrackerMissionBoardingVoice };
