'use strict';

const boardingVoiceCore = require('../mission-boarding-voice-core.js');

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
    kind: 'boarding',
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
  const playbackTimeoutMs = Math.max(1000, Math.min(180000, Number(options.playbackTimeoutMs) || 120000));
  if (!authorityManager || typeof authorityManager.getActiveRun !== 'function') {
    throw new TypeError('mission_boarding_voice_authority_manager_required');
  }

  const dispatch = async (request = {}) => {
    const effectId = cleanString(request?.effect?.effectId || request.commandId, 220);
    const run = authorityManager.getActiveRun({ includeBundle: true });
    if (!run?.missionId || !run?.runId) return completed(request, { voiceStatus: 'no_active_run' });
    if (run.executionAuthority !== 'tracker') return completed(request, { voiceStatus: 'web_authority' });
    if (cleanString(request.missionId) !== cleanString(run.missionId)
        || cleanString(request.runId, 220) !== cleanString(run.runId, 220)) {
      return { ok: false, status: 'blocked', error: 'mission_run_conflict', terminal: false, sideEffect: false, commandId: effectId };
    }
    const plan = object(run.resumeBundle?.executionEffectPlan);
    const recipe = boardingVoiceCore.normalizeRecipe(object(object(plan.effects)['voice.boarding']).recipe);
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
    try {
      voiceService.request({
        effectId,
        kind: 'boarding',
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
      job = await voiceService.wait(effectId);
    } catch (error) {
      log(`MISSION_BOARDING_VOICE_BEST_EFFORT effect=${effectId} reason=${error?.code || error?.message || error}`);
      return completed(request, {
        voiceStatus: error?.code || 'voice_request_failed',
        voiceOutcome: voiceOutcome(recipe, { status: 'warning', playback: 'not_played', error: error?.code || 'voice_request_failed' })
      });
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
      playback = await voiceService.waitForPlayback(effectId, { timeoutMs: playbackTimeoutMs });
    }
    log(`MISSION_BOARDING_VOICE_COMPLETE effect=${effectId} job=${job.status} playback=${playback.status} candidates=${candidates}`);
    return completed(request, {
      sideEffect: true,
      voiceStatus: playback.status,
      voiceOutcome: voiceOutcome(recipe, {
        status: playback.status === 'timeout' ? 'warning' : 'ok',
        text: job.text,
        speaker: job.speaker,
        provider: job.provider,
        textModel: job.textModel,
        model: job.model,
        voiceName: job.voiceName,
        playback: playback.status,
        error: playback.status === 'timeout' ? 'voice_playback_timeout' : null
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
