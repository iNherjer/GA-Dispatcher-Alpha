'use strict';

const core = require('../mission-training-voice-core.js');

// Worker creates effect descriptions; the shared parent audio bridge owns playback.
function prepare(context, input, now) {
    return core.render(context, input).map(voice => ({
        ...(input.action ? { action: input.action } : {}),
        label: voice.label, notBefore: now,
        resolvedRecipe: {
            schema: 'ga.mission-poi-voice-recipe.v1', missionId: context.missionId, kind: 'poi',
            enabled: true, audioEnabled: context.audioEnabled, taskDomain: context.taskDomain,
            prompt: '', fallbackText: voice.text, playCue: false,
            speaker: voice.speaker, staticClipKey: voice.staticClipKey,
            textModels: context.textModels, ttsModels: context.ttsModels,
            ttsHedgeEnabled: context.ttsHedgeEnabled, ttsHedgeDelayMs: context.ttsHedgeDelayMs
        }
    }));
}
module.exports = { prepare };
