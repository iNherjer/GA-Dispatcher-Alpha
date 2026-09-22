'use strict';

const core = require('../mission-poi-voice-core.js');

function prepareEvent(context, events, spec = context?.surveySpec || null, now = Date.now()) {
  const event = core.surveyEvent(context, events, spec);
  if (!event) return null;
  const label = event.kind === 'survey_complete'
    ? 'Survey erfüllt'
    : (event.kind.includes('reset') ? 'Survey-Korrektur' : 'Survey-Fortschritt');
  const fallbackCueId = event.kind === 'survey_area_entered' ? 'scan_start'
    : (/^(line_complete|orbit_turn_complete)$/.test(event.kind) ? 'data_lock'
      : (event.kind === 'survey_complete' ? 'handoff' : 'none'));
  // The App resolves _paxMissionAudioCueId before its player runs. The seed
  // supplies that resolved override here; `none` intentionally suppresses it.
  const cueId = String(context.surveyAudioCueIds?.[event.kind] ?? fallbackCueId).trim();
  return {
    kind: event.kind,
    label,
    notBefore: Math.max(0, Number(now) || 0),
    resolvedRecipe: {
      schema: 'ga.mission-poi-voice-recipe.v1', missionId: context.missionId, kind: 'poi',
      enabled: true, audioEnabled: context.audioEnabled, taskDomain: 'mapping_survey',
      prompt: '', fallbackText: event.text, playCue: cueId !== 'none',
      cue: cueId !== 'none' ? { id: cueId, variantSeed: `${spec?.key || spec?.label || ''}|${event.kind}|${event.text}|cue`, gain: .38 } : null,
      speaker: context.speaker, textModels: context.textModels, ttsModels: context.ttsModels,
      ttsHedgeEnabled: context.ttsHedgeEnabled, ttsHedgeDelayMs: context.ttsHedgeDelayMs,
      staticClipKey: event.staticClipKey
    }
  };
}

module.exports = { prepareEvent };
