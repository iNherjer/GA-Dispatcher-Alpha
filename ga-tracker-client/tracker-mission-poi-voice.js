'use strict';
const core = require('../mission-poi-voice-core.js');

function prepareCue(context, cue, memory, now = Date.now(), randomValue = Math.random()) {
  const rendered = core.render(context, cue, memory, randomValue);
  return { cue: { ...cue, inspectionOutcome: rendered.memory.inspectionOutcome,
    notBefore: now + Math.max(0, Number(cue.delayMs) || 0),
    resolvedRecipe: {
      schema: 'ga.mission-poi-voice-recipe.v1', missionId: context.missionId, kind: 'poi',
      enabled: !!rendered.prompt, audioEnabled: context.audioEnabled,
      taskDomain: context.taskDomain, prompt: rendered.prompt || '', fallbackText: '', playCue: false,
      speaker: context.speaker, textModels: context.textModels, ttsModels: context.ttsModels,
      ttsHedgeEnabled: context.ttsHedgeEnabled, ttsHedgeDelayMs: context.ttsHedgeDelayMs
    } }, memory: rendered.memory };
}

function recordGeneratedText(authorityManager, request, text) {
  const snapshot = authorityManager.getExecutionSnapshot();
  const effect = snapshot?.state.effects.find(entry => entry.effectId === request.effect.effectId);
  if (!snapshot || snapshot.missionId !== request.missionId || snapshot.runId !== request.runId
      || effect?.type !== 'voice.poi') return { ok: false, error: 'mission_run_conflict' };
  if (effect.payload.resolvedText) return { ok: true, status: 'noop' };
  return authorityManager.applyExecutionEvent({ missionId: snapshot.missionId, runId: snapshot.runId,
    expectedRevision: snapshot.authorityRevision, expectedExecutionRevision: snapshot.executionRevision,
    expectedExecutionStateHash: snapshot.executionStateHash,
    event: { type: 'POI_VOICE_TEXT_READY', eventId: `${effect.effectId}:text-ready`,
      sequence: snapshot.executionRevision + 1, occurredAt: Date.now(),
      payload: { effectId: effect.effectId, text: String(text || '').slice(0, 4000) } } });
}

module.exports = { prepareCue, recordGeneratedText };

function prepareAction(context, action, detector, sample, target, memory = {}) {
  const rendered = core.renderAction(context, action, detector,
    { ...sample, mslFt: sample?.altFt ?? sample?.alt ?? sample?.mslFt }, target, memory);
  return { action, ...(rendered.memory ? { memory: rendered.memory } : {}), label: rendered.label, notBefore: Date.now(), resolvedRecipe: {
    schema: 'ga.mission-poi-voice-recipe.v1', missionId: context.missionId, kind: 'poi',
    enabled: true, audioEnabled: context.audioEnabled, taskDomain: context.taskDomain,
    prompt: rendered.prompt, fallbackText: rendered.fallbackText, playCue: false,
    speaker: context.speaker, textModels: context.textModels, ttsModels: context.ttsModels,
    ttsHedgeEnabled: context.ttsHedgeEnabled, ttsHedgeDelayMs: context.ttsHedgeDelayMs
  } };
}
module.exports.prepareAction = prepareAction;
