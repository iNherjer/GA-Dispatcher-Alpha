'use strict';

const original = require('../mission-training-core.js');
const adapter = require('./tracker-mission-training-task.js').createAdapter();
const voice = require('./tracker-mission-training-voice.js');
const flight = require('../mission-training-flight-core.js');
const geo = require('../mission-poi-task-core.js');
const DOMAINS = ['training', 'club_training_basic', 'club_training_advanced'];
const { canonicalStringify } = require('../mission-execution-core.js');
function spec(recipe) {
    return { passenger: { ...recipe.voiceContext.passenger, taskDomain: recipe.taskDomain, trainingRecipe: recipe.trainingRecipe,
        trainingPlan: recipe.voiceContext.trainingPlan }, missionData: { missionId: recipe.missionId } };
}
function validate(recipe) {
    const r = recipe.trainingRecipe;
    if (!r || r.schema !== 'ga.trainingRecipe.v1' || !r.key || !Array.isArray(r.exercises) || !r.exercises.length
        || r.exercises.length > 8 || r.exercises.some(ex => !ex.id || !['constant_bank_360','turn_180','altitude_step_hold','stall_recovery'].includes(ex.type))) return 'training_recipe_invalid';
    if (!recipe.voiceContext || canonicalStringify(recipe.voiceContext.trainingRecipe) !== canonicalStringify(r)) return 'training_voice_recipe_mismatch';
    const ctx = recipe.voiceContext;
    if (!ctx.trainingPlan || typeof ctx.trainingPlan !== 'object' || !Array.isArray(ctx.routeWaypoints) || ctx.routeWaypoints.length < 2
        || ctx.routeWaypoints.some(p => !Number.isFinite(p?.lat) || !Number.isFinite(p?.lon ?? p?.lng))) return 'training_flight_context_invalid';
    try { adapter.createState(spec(recipe)); } catch (_) { return 'training_recipe_invalid'; }
    return null;
}
function progress(checkpoint) {
    const core = original.create({}, { now: () => 0 });
    core.importFullState(checkpoint.procedureState);
    return core.snapshot();
}
function createState(recipe, saved) {
    const checkpoint = adapter.createState(spec(recipe), saved?.checkpoint || null);
    return { checkpoint, progress: progress(checkpoint), flight: flight.createState(saved?.flight), lastSampleAt: saved?.lastSampleAt ?? null };
}
function context(recipe) { return { ...recipe.voiceContext, target: recipe.target, home: recipe.home, trainingRecipe: recipe.trainingRecipe }; }
function pause(recipe, state, now) {
    const raw = state.checkpoint.procedureState.activeState;
    if (raw.active) state.checkpoint = adapter.action(spec(recipe), state.checkpoint, {type:'abort'}, now).state;
    const next = state.checkpoint.procedureState.activeState;
    next.ready = false; next.startAvailable = false; next.preStartStableSince = 0; next.lastSample = null;
    state.progress = progress(state.checkpoint); state.lastSampleAt = null;
    return state;
}
function observe(recipe, state, sample) {
    if (state.lastSampleAt !== null && sample.observedAt - state.lastSampleAt > 5000) pause(recipe, state, sample.observedAt);
    const departure = recipe.voiceContext.departure || recipe.home;
    const departureDistanceNm = geo.distanceNm(sample.lat, sample.lon, departure.lat, departure.lon ?? departure.lng);
    const cues = flight.observe(context(recipe), state.flight, { ...sample, mslFt: sample.altFt }, state.progress, sample.observedAt);
    state.flight = cues.state;
    const result = adapter.observe(spec(recipe), state.checkpoint, { ...sample, departureDistanceNm });
    state.checkpoint = result.state; state.progress = result.progress; state.lastSampleAt = sample.observedAt;
    return { state, satisfied: result.satisfied, voices: [
        ...cues.cues.map(cue => ({ label: cue.label, notBefore: cue.notBefore, resolvedRecipe: {
            schema:'ga.mission-poi-voice-recipe.v1', missionId:recipe.missionId, kind:'poi', enabled:true,
            audioEnabled:recipe.voiceContext.audioEnabled, taskDomain:recipe.taskDomain, prompt:cue.prompt, fallbackText:'', playCue:false,
            speaker:recipe.voiceContext.trainingSpeaker || recipe.voiceContext.speaker,
            textModels:recipe.voiceContext.textModels, ttsModels:recipe.voiceContext.ttsModels,
            ttsHedgeEnabled:recipe.voiceContext.ttsHedgeEnabled, ttsHedgeDelayMs:recipe.voiceContext.ttsHedgeDelayMs } })),
        ...voice.prepare({ ...recipe.voiceContext, speaker:recipe.voiceContext.trainingSpeaker || recipe.voiceContext.speaker }, { events:result.events, recipe:recipe.trainingRecipe },sample.observedAt)
    ] };
}
function action(recipe, state, intent, now) {
    const type = { training_ready:'ready', training_abort:'abort', training_extra:'optional' }[intent];
    if (!type) throw new TypeError('training_action_invalid');
    const result = adapter.action(spec(recipe), state.checkpoint, {type}, now);
    state.checkpoint = result.state; state.progress = progress(result.state);
    return { state, voices:voice.prepare({ ...recipe.voiceContext, speaker:recipe.voiceContext.trainingSpeaker || recipe.voiceContext.speaker }, {action:intent,result},now) };
}
module.exports = { DOMAINS, validate, createState, observe, action, pause, summary:flight.summary, debrief:flight.debrief };
