'use strict';

// Worker-only adapter. The original generated detector remains unchanged.
// Mutates only the caller-owned POI checkpoint; no I/O or second authority.
const fireCore = require('../mission-fire-watch-core.js');
const taskCore = require('../mission-poi-task-core.js');
const { prepareFireVoices } = require('./tracker-mission-fire-voice.js');
const finite = value => typeof value === 'number' && Number.isFinite(value);
const point = value => value && finite(value.lat) && finite(value.lon) && Math.abs(value.lat) <= 90 && Math.abs(value.lon) <= 180;

function validateRecipe(recipe) {
    const fs = recipe.fireScenario;
    if (!fs || !['fire', 'false_alarm'].includes(fs.truth) || !point(fs.target)
        || ['searchDwellSec', 'assessmentDwellSec', 'targetAreaNm', 'confirmRangeNm', 'paxAwarenessRangeNm'].some(key => fs[key] != null && (!finite(fs[key]) || fs[key] <= 0 || fs[key] > 86400))) return 'fire_watch_scenario_invalid';
    const error = fireCore.validateScenario(fs);
    if (error) return error;
    return null;
}
function createState(recipe, previous) {
    return fireCore.createState(fireContext(recipe), previous);
}
function resume(state, elapsed) {
    for (const key of ['targetAreaEnteredAt', 'searchStartedAt', 'smokeConfirmedAt']) {
        if (state.scenario[key]) state.scenario[key] += elapsed;
    }
}
function observe(recipe, state, sample) {
    return applyFireResult(recipe, state, fireCore.observe(fireContext(recipe), state.fireState,
        { ...sample, distNm: taskCore.distanceNm(sample.lat, sample.lon, recipe.target.lat, recipe.target.lon) }, sample.observedAt), sample);
}
function fireContext(recipe) {
    return { scenario: recipe.fireScenario, target: recipe.target, passenger: recipe.passenger, runtimeActive: true };
}
function fireProjection(state) {
    const fs = state.fireState.scenario;
    const elapsed = start => start ? Math.max(0, ((state.suspendedAt ?? state.observedAt) - start) / 1000) : 0;
    // Private truth, source locations and unrevealed findings never enter UI progress.
    return { state: fs.state || 'enroute', awarenessDone: !!fs.awarenessDone,
        targetAreaAnnounced: !!fs.targetAreaAnnounced, assessmentComplete: !!fs.assessmentComplete,
        searchSec: elapsed(fs.targetAreaEnteredAt), assessmentSec: elapsed(fs.smokeConfirmedAt),
        searchDwellSec: Number(fs.searchDwellSec || 180), assessmentDwellSec: Number(fs.assessmentDwellSec || 240),
        targetAreaNm: Number(fs.targetAreaNm || 1.5), confirmRangeNm: Number(fs.confirmRangeNm || 2) };
}
function applyFireResult(recipe, state, result, sample) {
    state.fireState = result.state;
    const fs = state.fireState.scenario;
    const distNm = taskCore.distanceNm(sample.lat, sample.lon, recipe.target.lat, recipe.target.lon);
    Object.assign(state.detector, { satisfied: result.satisfied === true,
        atTargetDone: state.fireState.atTargetDone === true, inRadius: distNm <= Number(fs.targetAreaNm || recipe.passenger.targetRadiusNm || 1.5),
        entryDone: !!fs.targetAreaAnnounced, lastTickTime: sample.observedAt,
        dwellSec: fs.targetAreaEnteredAt ? Math.max(0, (sample.observedAt - fs.targetAreaEnteredAt) / 1000) : 0 });
    return { state, effects: result.voices.length ? [{ type: 'fire', voices: result.voices }] : [], changed: true, reason: 'fire_watch_observed', distNm };
}
function fireAction(recipe, previous, action, sample, now) {
    const state = previous;
    if (!state.fireState) throw new TypeError('fire_watch_required');
    // Commands use the same committed checkpoint, then invalidate the observation buffer by revision.
    state.sequence++; state.observedAt = Math.max(now, (state.observedAt || 0) + 1);
    const result = fireCore.action(fireContext(recipe), state.fireState, action, sample, state.observedAt);
    state.fireState = result.state;
    state.detector.satisfied = result.satisfied === true;
    state.detector.atTargetDone = result.state.atTargetDone === true;
    return { poiTask: state, voiceEffects: prepareFireVoices(recipe.voiceContext, result.voices, state.observedAt, action) };
}
module.exports = { validateRecipe, createState, resume, observe, project: fireProjection, action: fireAction };
