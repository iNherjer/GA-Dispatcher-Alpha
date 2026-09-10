'use strict';

const farewellVoiceCore = require('../mission-farewell-voice-core.js');

function cleanString(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

function preloadEffectId(runId) {
  const safeRunId = cleanString(runId, 130).replace(/[^A-Za-z0-9._:-]+/g, '-');
  return `prewarm:${safeRunId || 'run'}:farewell`;
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
    kind: 'farewell',
    status: cleanString(values.status, 40) || 'ok',
    text: cleanString(values.text || recipe?.text || recipe?.fallbackText, 4000),
    speaker: farewellVoiceCore.normalizeSpeaker(values.speaker || recipe?.speaker),
    provider: cleanString(values.provider, 40),
    textModel: cleanString(values.textModel, 100),
    model: cleanString(values.model, 100),
    voiceName: cleanString(values.voiceName, 80),
    playback: cleanString(values.playback, 80) || null,
    error: cleanString(values.error, 180) || null
  };
}

function createTrackerMissionFarewellVoice(options = {}) {
  const authorityManager = options.authorityManager;
  const voiceService = options.voiceService;
  const getAudioSettings = typeof options.getAudioSettings === 'function' ? options.getAudioSettings : () => null;
  const getAudioPlaybackCandidates = typeof options.getAudioPlaybackCandidates === 'function'
    ? options.getAudioPlaybackCandidates
    : () => 0;
  const log = typeof options.log === 'function' ? options.log : () => {};
  const playbackClaimTimeoutMs = Math.max(250, Math.min(30000, Number(options.playbackClaimTimeoutMs) || 15000));
  const playbackTimeoutMs = Math.max(1000, Math.min(180000, Number(options.playbackTimeoutMs) || 90000));
  const generationTimeoutMs = Math.max(1000, Math.min(180000, Number(options.generationTimeoutMs) || 75000));
  if (!authorityManager || typeof authorityManager.getActiveRun !== 'function') {
    throw new TypeError('mission_farewell_voice_authority_manager_required');
  }

  const resolveRecipeSource = (request, run) => {
    const plan = object(run.resumeBundle?.executionEffectPlan);
    const effectPlan = object(object(plan.effects)['voice.farewell']);
    const authorityContext = farewellVoiceCore.normalizeContext(request.farewellContext)
      || farewellVoiceCore.normalizeContext(effectPlan.context);
    return (authorityContext
        ? farewellVoiceCore.createRecipeFromContext(authorityContext, request.farewellDynamicContext)
        : null)
      || farewellVoiceCore.normalizeRecipe(request.farewellRecipe)
      || farewellVoiceCore.normalizeRecipe(effectPlan.recipe);
  };

  const resolveRecipe = (request, run) => {
    const recipe = resolveRecipeSource(request, run), settings = getAudioSettings();
    return recipe && settings ? { ...recipe, audioEnabled: settings.enabled && settings.paxEnabled, playCue: recipe.playCue && settings.effectsEnabled } : recipe;
  };

  const voiceRequest = (effectId, recipe, deferPlayback = false) => ({
    effectId,
    kind: 'farewell',
    text: recipe.text,
    prompt: recipe.prompt,
    fallbackText: recipe.fallbackText,
    taskDomain: recipe.taskDomain,
    speaker: recipe.speaker,
    cue: recipe.playCue === true ? recipe.cue : null,
    textModels: recipe.textModels,
    ttsModels: recipe.ttsModels,
    ttsHedgeEnabled: recipe.ttsHedgeEnabled,
    ttsHedgeDelayMs: recipe.ttsHedgeDelayMs,
    synthesizeAudio: recipe.audioEnabled === true,
    deferPlayback
  });

  const prepare = (request = {}) => {
    const run = authorityManager.getActiveRun({ includeBundle: true });
    if (!run?.missionId || !run?.runId || run.executionAuthority !== 'tracker') {
      return { ok: false, status: 'blocked', error: 'mission_execution_authority_web', sideEffect: false };
    }
    if (cleanString(request.missionId) !== cleanString(run.missionId)
        || cleanString(request.runId, 220) !== cleanString(run.runId, 220)) {
      return { ok: false, status: 'blocked', error: 'mission_run_conflict', sideEffect: false };
    }
    const recipe = resolveRecipe(request, run);
    if (!recipe || recipe.missionId && recipe.missionId !== run.missionId || recipe.enabled !== true
        || (!recipe.prompt && !recipe.text && !recipe.fallbackText)) {
      return { ok: true, status: 'skipped', sideEffect: false };
    }
    if (!voiceService || voiceService.publicState?.().configured !== true) {
      return { ok: true, status: 'voice_not_configured', sideEffect: false };
    }
    const effectId = preloadEffectId(run.runId);
    try {
      const job = voiceService.request(voiceRequest(effectId, recipe, true));
      log(`MISSION_FAREWELL_VOICE_PREWARM effect=${effectId} status=${job?.status || 'pending'}`);
      return { ok: true, status: job?.status || 'pending', sideEffect: true, effectId };
    } catch (error) {
      log(`MISSION_FAREWELL_VOICE_PREWARM_ERROR effect=${effectId} reason=${error?.code || error?.message || error}`);
      return { ok: true, status: error?.code || 'voice_request_failed', sideEffect: false };
    }
  };

  const dispatch = async (request = {}) => {
    const effectId = cleanString(request?.effect?.effectId || request.commandId, 220);
    const run = authorityManager.getActiveRun({ includeBundle: true });
    if (!run?.missionId || !run?.runId) return completed(request, { voiceStatus: 'no_active_run' });
    if (run.executionAuthority !== 'tracker') return completed(request, { voiceStatus: 'web_authority' });
    if (cleanString(request.missionId) !== cleanString(run.missionId)
        || cleanString(request.runId, 220) !== cleanString(run.runId, 220)) {
      return { ok: false, status: 'blocked', error: 'mission_run_conflict', terminal: false, sideEffect: false, commandId: effectId };
    }
    const recipe = resolveRecipe(request, run);
    if (!recipe || (recipe.missionId && recipe.missionId !== run.missionId)) {
      log(`MISSION_FAREWELL_VOICE_FALLBACK effect=${effectId} reason=recipe_missing`);
      return completed(request, {
        voiceStatus: 'recipe_missing',
        voiceOutcome: voiceOutcome(null, { status: 'warning', playback: 'not_played', error: 'farewell_recipe_missing' })
      });
    }
    if (recipe.enabled !== true || (!recipe.prompt && !recipe.text && !recipe.fallbackText)) {
      log(`MISSION_FAREWELL_VOICE_SKIPPED effect=${effectId} reason=${recipe.skipReason || 'disabled'}`);
      return completed(request, {
        voiceStatus: recipe.skipReason || 'disabled',
        voiceOutcome: voiceOutcome(recipe, { status: 'skipped', playback: recipe.skipReason || 'disabled' })
      });
    }
    if (!voiceService || voiceService.publicState?.().configured !== true) {
      log(`MISSION_FAREWELL_VOICE_BEST_EFFORT effect=${effectId} reason=voice_not_configured`);
      return completed(request, {
        voiceStatus: 'voice_not_configured',
        voiceOutcome: voiceOutcome(recipe, { status: 'warning', playback: 'not_played', error: 'voice_not_configured' })
      });
    }
    let job;
    let voiceEffectId = effectId;
    try {
      const preparedEffectId = preloadEffectId(run.runId);
      try {
        const prepared = voiceService.get?.(preparedEffectId);
        // Re-request with the current recipe: the service deduplicates identical
        // content, but rejects a stale preload after cargo/outcome changes.
        const needsAudio = prepared?.status === 'ready' && recipe.audioEnabled && !prepared.audioAvailable;
        if (needsAudio) voiceService.cancel?.(preparedEffectId, 'audio_enabled_after_preload');
        if (prepared && !['pending', 'ready'].includes(prepared.status)) {
          throw Object.assign(new Error('farewell_preload_unavailable'), { code: 'effect_id_conflict' });
        }
        voiceService.request(voiceRequest(preparedEffectId, recipe, true));
        voiceEffectId = preparedEffectId;
        voiceService.activatePlayback?.(voiceEffectId);
      } catch (preloadError) {
        log(`MISSION_FAREWELL_VOICE_PREWARM_MISS effect=${preparedEffectId} reason=${preloadError?.code || preloadError?.message}`);
        if (preloadError?.code === 'effect_id_conflict') voiceService.cancel?.(preparedEffectId, 'farewell_preload_stale');
        voiceEffectId = effectId;
        voiceService.request(voiceRequest(effectId, recipe, false));
      }
      let generationTimer = null;
      try {
        job = await Promise.race([
          voiceService.wait(voiceEffectId),
          new Promise(resolve => {
            generationTimer = setTimeout(() => resolve({ status: 'timeout', error: 'farewell_voice_timeout' }), generationTimeoutMs);
          })
        ]);
      } finally {
        if (generationTimer) clearTimeout(generationTimer);
      }
      if (job?.status === 'timeout') voiceService.cancel?.(voiceEffectId, 'farewell_voice_timeout');
    } catch (error) {
      log(`MISSION_FAREWELL_VOICE_BEST_EFFORT effect=${effectId} reason=${error?.code || error?.message || error}`);
      return completed(request, {
        voiceStatus: error?.code || 'voice_request_failed',
        voiceOutcome: voiceOutcome(recipe, { status: 'warning', playback: 'not_played', error: error?.code || 'voice_request_failed' })
      });
    }
    if (!job || job.status !== 'ready' || (recipe.audioEnabled === true && job.audioAvailable !== true)) {
      log(`MISSION_FAREWELL_VOICE_BEST_EFFORT effect=${effectId} reason=${job?.error || job?.status || 'voice_generation_failed'}`);
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
        const claim = await voiceService.waitForPlaybackClaim(voiceEffectId, { timeoutMs: playbackClaimTimeoutMs });
        if (claim?.claimed === true) {
          playback = claim.status === 'completed'
            ? { status: 'completed', completed: true, job: claim.job || null }
            : await voiceService.waitForPlayback(voiceEffectId, { timeoutMs: playbackTimeoutMs });
          if (playback?.status === 'timeout') voiceService.cancel?.(voiceEffectId, 'farewell_voice_playback_timeout');
        } else {
          voiceService.cancel?.(voiceEffectId, 'farewell_voice_unclaimed');
          playback = { status: 'no_audio_claim', completed: false, job: claim?.job || null };
        }
      } else {
        playback = await voiceService.waitForPlayback(voiceEffectId, { timeoutMs: playbackTimeoutMs });
      }
    }
    log(`MISSION_FAREWELL_VOICE_COMPLETE effect=${effectId} job=${job.status} playback=${playback.status} candidates=${candidates}`);
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
      })
    });
  };

  dispatch.prepare = prepare;
  return Object.freeze({ dispatch, prepare });
}

module.exports = { createTrackerMissionFarewellVoice };
