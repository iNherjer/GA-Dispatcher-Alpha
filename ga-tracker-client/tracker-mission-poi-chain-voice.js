'use strict';
const voice = require('../mission-poi-voice-core.js');
const { stableHash: hash } = require('../mission-boarding-voice-core.js');
const seeded = (seed, min, max) => { const a = Math.round(min), b = Math.round(max); return a + hash(seed) % (b - a + 1); };
// These are the resolved original audio-catalog properties supplied by the App.
// Speech priority/text and pre/post burst options come from original functions.
function clips(context, sounds) {
  return sounds.flatMap(({ id, seed, options }) => {
    if (id === 'none') return [];
    const def = context.chainAudioDefinitions?.[id];
    if (!def) throw new TypeError('poi_chain_audio_definition_missing');
    const cueSeed = `${seed}|${id}`;
    const count = seeded(`${cueSeed}|count`, options.minCount || 1, options.maxCount || options.minCount || 1);
    const variant = (options.variantScope || def.variantScope || 'mission') === 'event' ? (options.variantSeed || cueSeed) : (options.variantSeed || 'mission');
    const missionKey = String(context.missionAudioKey || `farewell:${context.missionId}`).split(':').slice(1).join(':');
    return Array.from({ length: count }, (_, index) => ({ id,
      variantSeed: `cue-variant-${id}:${missionKey}|${variant}`,
      gain: options.gain ?? def.gain,
      delayMs: index === 0 ? (options.firstDelayMs ?? options.minDelayMs ?? 0)
        : seeded(`${cueSeed}|delay|${index}`, options.minDelayMs || 0, options.maxDelayMs ?? options.minDelayMs ?? 0) }));
  });
}
function prepareEvents(context, events, spec = context.chainSpec, now = Date.now()) {
  return voice.chainEvents(context, events, spec).map(event => ({
    kind: event.key.split(':')[0], label: event.label, notBefore: now,
    resolvedRecipe: { schema: 'ga.mission-poi-voice-recipe.v1', missionId: context.missionId,
      kind: 'poi', enabled: true, audioEnabled: context.audioEnabled, taskDomain: 'infra_chain_recon',
      prompt: '', fallbackText: event.text, playCue: true, cue: null,
      cueSequence: { before: clips(context, event.sounds.before), after: clips(context, event.sounds.after) },
      speaker: event.speaker, textModels: context.textModels, ttsModels: context.ttsModels,
      ttsHedgeEnabled: context.ttsHedgeEnabled, ttsHedgeDelayMs: context.ttsHedgeDelayMs }
  }));
}
module.exports = { prepareEvents };
