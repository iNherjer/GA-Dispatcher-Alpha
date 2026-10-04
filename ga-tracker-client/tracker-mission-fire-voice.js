'use strict';

// Adapt original Fire texts to the existing Tracker Voice effect contract.
function prepareFireVoices(context, voices, now, action) {
    return voices.map(event => ({ ...(action ? { action } : {}), ...(event.label==='Suchhinweis'||event.label==='Wärmebild-Suche'?{fireSearchHint:true,expiresAt:now+30000}:{}), label: event.label, notBefore: now,
        resolvedRecipe: { schema: 'ga.mission-poi-voice-recipe.v1', missionId: context.missionId, kind: 'poi',
            enabled: true, audioEnabled: context.audioEnabled, taskDomain: 'fire_watch',
            prompt: '', fallbackText: event.text, playCue: false, speaker: event.speaker || context.speaker,
            textModels: context.textModels, ttsModels: context.ttsModels,
            ttsHedgeEnabled: context.ttsHedgeEnabled, ttsHedgeDelayMs: context.ttsHedgeDelayMs } }));
}
module.exports = { prepareFireVoices };
