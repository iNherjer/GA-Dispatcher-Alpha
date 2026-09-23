'use strict';

const voiceCore = require('../mission-poi-voice-core.js');
const clone = value => JSON.parse(JSON.stringify(value));
const finite = value => typeof value === 'number' && Number.isFinite(value);
function point(value) {
    return !!value && finite(value.lat) && finite(value.lon)
        && Math.abs(value.lat) <= 90 && Math.abs(value.lon) <= 180;
}

function validateRecipe(recipe) {
    if (!recipe || recipe.taskDomain !== 'search_and_rescue') return 'sar_recipe_domain_invalid';
    if (recipe.sarHeli || recipe.bush || recipe.passenger?.sarHeli || recipe.passenger?.bush)
        return 'sar_recipe_specialized_task_invalid';
    const report = recipe.sarReport;
    if (!report || report.schema !== 'ga.sar-report.v1' || !point(report.confirmCoords)
        || (report.confirmCoords.name != null && typeof report.confirmCoords.name !== 'string')
        || !finite(report.confirmRangeNm) || report.confirmRangeNm < 0.25 || report.confirmRangeNm > 0.8)
        return 'sar_report_recipe_invalid';
    const paxRadius = Math.max(0.25, Number(recipe.passenger?.targetRadiusNm || 0) || 1.5);
    const expectedRange = Math.max(0.25, Math.min(0.8, paxRadius * 0.7));
    if (report.confirmRangeNm !== expectedRange) return 'sar_report_range_mismatch';
    const context = recipe.voiceContext;
    if (!context || context.missionId !== recipe.missionId || context.taskDomain !== recipe.taskDomain
        || context.strict !== recipe.strict || !context.passenger
        || ['targetRadiusNm', 'targetAltFt', 'targetDwellMin'].some(key => context.passenger[key] !== recipe.passenger?.[key]))
        return 'sar_voice_context_mismatch';
    if (!context.sarReport || context.sarReport.schema !== report.schema
        || context.sarReport.confirmRangeNm !== report.confirmRangeNm
        || context.sarReport.confirmCoords?.lat !== report.confirmCoords.lat
        || context.sarReport.confirmCoords?.lon !== report.confirmCoords.lon
        || String(context.sarReport.confirmCoords?.name || '') !== String(report.confirmCoords.name || ''))
        return 'sar_voice_report_context_mismatch';
    return voiceCore.validateContext(context, recipe.missionId);
}

function action(recipe, previous, sample, now, memory = {}) {
    const error = validateRecipe(recipe);
    if (error) throw new TypeError(error);
    if (!previous || previous.schema !== 'ga.tracker-poi-runtime.v1'
        || previous.missionId !== recipe.missionId || !previous.detector)
        throw new TypeError('sar_poi_state_invalid');
    if (previous.suspendedAt !== null) throw new TypeError('sar_report_position_unavailable');
    if (previous.detector.satisfied || previous.detector.aborted)
        throw new TypeError('sar_report_task_terminal');
    const observedAt = Number(sample?.observedAt);
    const requestAt = Number(now);
    if (!finite(observedAt) || !finite(requestAt) || observedAt < (Number(previous.observedAt) || 0)
        || requestAt - observedAt < 0 || requestAt - observedAt > 5000 || !point(sample)
        || sample.onGround !== false || sample.simPaused === true || sample.inMenuOrMap === true
        || sample.slewActive === true || sample.slewMode === true || sample.isSlewActive === true)
        throw new TypeError('sar_report_position_unavailable');

    const state = clone(previous);
    const detector = state.detector;
    const distNm = require('../mission-poi-task-core.js').distanceNm(
        sample.lat, sample.lon, recipe.sarReport.confirmCoords.lat, recipe.sarReport.confirmCoords.lon);
    const nearEnough = distNm <= recipe.sarReport.confirmRangeNm;
    const reportContext = {
        ...recipe.sarReport,
        targetName: recipe.sarReport.confirmCoords.name || 'Zielgebiet',
        confirmDistNm: distNm,
        confirmRangeNm: recipe.sarReport.confirmRangeNm,
        nearEnough
    };
    let voice = voiceCore.renderSarReport(recipe.voiceContext, reportContext, detector, memory);
    state.sequence = (Number(state.sequence) || 0) + 1;
    state.observedAt = Math.max(requestAt, (Number(state.observedAt) || 0) + 1);
    if (nearEnough) {
        const dwellRequired = Math.max(0, Number(recipe.passenger.targetDwellMin || 0) * 60);
        Object.assign(detector, {
            inRadius: true, entryDone: true, satisfied: true, manualConfirmed: true, atTargetDone: true,
            dwellSec: Math.max(Number(detector.dwellSec) || 0, dwellRequired),
            enteredAt: detector.enteredAt || state.observedAt,
            lastTickTime: state.observedAt
        });
        voice = { ...voice, sarSearchOutcome: voice.memory?.sarSearchOutcome || null };
    }
    return {
        action: 'poi_report_found',
        poiTask: state,
        voiceEffects: [{ action: 'poi_report_found', label: voice.label,
            sarSearchOutcome: voice.memory?.sarSearchOutcome || null,
            memory: voice.memory,
            resolvedRecipe: {
                schema: 'ga.mission-poi-voice-recipe.v1', missionId: recipe.missionId, kind: 'poi',
                enabled: true, audioEnabled: recipe.voiceContext.audioEnabled, taskDomain: recipe.taskDomain,
                prompt: voice.prompt || '', fallbackText: voice.fallbackText || '', playCue: false,
                speaker: recipe.voiceContext.speaker, textModels: recipe.voiceContext.textModels,
                ttsModels: recipe.voiceContext.ttsModels,
                ttsHedgeEnabled: recipe.voiceContext.ttsHedgeEnabled,
                ttsHedgeDelayMs: recipe.voiceContext.ttsHedgeDelayMs
            } }]
    };
}

module.exports = { validateRecipe, action };
