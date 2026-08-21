'use strict';

const complianceCore = require('../mission-compliance-domain-core.js');

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

function voiceOutcome(kind, text, speaker, values = {}) {
  return {
    schema: 'ga.mission-voice-outcome.v1',
    kind,
    status: cleanString(values.status, 40) || 'ok',
    text: cleanString(values.text || text, 4000),
    speaker: object(values.speaker || speaker),
    provider: cleanString(values.provider, 40),
    textModel: cleanString(values.textModel, 100),
    model: cleanString(values.model, 100),
    voiceName: cleanString(values.voiceName, 80),
    playback: cleanString(values.playback, 80) || null,
    error: cleanString(values.error, 180) || null
  };
}

function createTrackerMissionComplianceVoice(options = {}) {
  const authorityManager = options.authorityManager;
  const voiceService = options.voiceService;
  const getAudioPlaybackCandidates = typeof options.getAudioPlaybackCandidates === 'function'
    ? options.getAudioPlaybackCandidates
    : () => 0;
  const log = typeof options.log === 'function' ? options.log : () => {};
  const timeoutMs = Math.max(1000, Math.min(180000, Number(options.timeoutMs) || 75000));
  if (!authorityManager || typeof authorityManager.getActiveRun !== 'function') {
    throw new TypeError('mission_compliance_voice_authority_manager_required');
  }

  const dispatch = async (request = {}) => {
    const effect = object(request.effect);
    const payload = object(effect.payload);
    const effectId = cleanString(effect.effectId || request.commandId, 220);
    const effectType = cleanString(effect.type, 100).toLowerCase();
    const kind = effectType === 'voice.compliance_result' ? 'compliance_result' : 'compliance_request';
    const text = cleanString(payload.text, 4000);
    const speaker = {
      ...complianceCore.INSPECTOR_SPEAKER,
      ...object(payload.speaker)
    };
    const run = authorityManager.getActiveRun({ includeBundle: false });
    if (!run?.missionId || !run?.runId) return completed(request, { voiceStatus: 'no_active_run' });
    if (run.executionAuthority !== 'tracker') return completed(request, { voiceStatus: 'web_authority' });
    if (cleanString(request.missionId) !== cleanString(run.missionId)
        || cleanString(request.runId, 220) !== cleanString(run.runId, 220)) {
      return { ok: false, status: 'blocked', error: 'mission_run_conflict', terminal: false, sideEffect: false, commandId: effectId };
    }
    if (!text) {
      log(`MISSION_COMPLIANCE_VOICE_BEST_EFFORT effect=${effectId} reason=text_missing`);
      return completed(request, {
        voiceStatus: 'text_missing',
        voiceOutcome: voiceOutcome(kind, text, speaker, { status: 'warning', playback: 'not_played', error: 'compliance_voice_text_missing' })
      });
    }
    if (!voiceService || voiceService.publicState?.().configured !== true) {
      log(`MISSION_COMPLIANCE_VOICE_BEST_EFFORT effect=${effectId} reason=voice_not_configured`);
      return completed(request, {
        voiceStatus: 'voice_not_configured',
        voiceOutcome: voiceOutcome(kind, text, speaker, { status: 'warning', playback: 'not_played', error: 'voice_not_configured' })
      });
    }
    let job;
    try {
      voiceService.request({
        effectId,
        kind: 'direct',
        text,
        taskDomain: speaker.taskDomain,
        speaker,
        synthesizeAudio: true
      });
      let timer = null;
      try {
        job = await Promise.race([
          voiceService.wait(effectId),
          new Promise(resolve => {
            timer = setTimeout(() => resolve({ status: 'timeout', error: 'compliance_voice_timeout' }), timeoutMs);
          })
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
      if (job?.status === 'timeout') voiceService.cancel?.(effectId, 'compliance_voice_timeout');
    } catch (error) {
      log(`MISSION_COMPLIANCE_VOICE_BEST_EFFORT effect=${effectId} reason=${error?.code || error?.message || error}`);
      return completed(request, {
        voiceStatus: error?.code || 'voice_request_failed',
        voiceOutcome: voiceOutcome(kind, text, speaker, { status: 'warning', playback: 'not_played', error: error?.code || 'voice_request_failed' })
      });
    }
    if (!job || job.status !== 'ready' || job.audioAvailable !== true) {
      log(`MISSION_COMPLIANCE_VOICE_BEST_EFFORT effect=${effectId} reason=${job?.error || job?.status || 'voice_generation_failed'}`);
      return completed(request, {
        voiceStatus: job?.error || job?.status || 'voice_generation_failed',
        voiceOutcome: voiceOutcome(kind, text, speaker, { status: 'warning', playback: 'not_played', error: job?.error || 'voice_generation_failed' })
      });
    }
    const candidates = Math.max(0, Math.round(Number(getAudioPlaybackCandidates()) || 0));
    let playback = { status: candidates > 0 ? 'pending' : 'no_audio_instance', completed: false };
    if (candidates > 0 && typeof voiceService.waitForPlayback === 'function') {
      playback = await voiceService.waitForPlayback(effectId, { timeoutMs });
    }
    log(`MISSION_COMPLIANCE_VOICE_COMPLETE effect=${effectId} job=${job.status} playback=${playback.status} candidates=${candidates}`);
    return completed(request, {
      sideEffect: true,
      voiceStatus: playback.status,
      voiceOutcome: voiceOutcome(kind, text, speaker, {
        status: playback.status === 'timeout' ? 'warning' : 'ok',
        text: job.text,
        speaker: job.speaker,
        provider: job.provider,
        textModel: job.textModel,
        model: job.model,
        voiceName: job.voiceName,
        playback: playback.status,
        error: playback.status === 'timeout' ? 'voice_playback_timeout' : null
      })
    });
  };

  return Object.freeze({ dispatch });
}

module.exports = { createTrackerMissionComplianceVoice };
