'use strict';

const original = require('../mission-training-core.js');
const adapter = require('./tracker-mission-training-task.js').createAdapter();
const voice = require('./tracker-mission-training-voice.js');
const flight = require('../mission-training-flight-core.js');
const coaching = require('./tracker-mission-training-coaching.js');
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
    return { checkpoint, progress: progress(checkpoint), flight: flight.createState(saved?.flight), lastSampleAt: saved?.lastSampleAt ?? null, coaching: saved?.coaching ? JSON.parse(JSON.stringify(saved.coaching)) : null, guidance: saved?.guidance || null };
}
function context(recipe) { return { ...recipe.voiceContext, target: recipe.target, home: recipe.home, trainingRecipe: recipe.trainingRecipe, missionMode:recipe.missionMode || 'POI' }; }
function pause(recipe, state, now, reason = 'Flugdaten unterbrochen oder Simulator pausiert. Laufenden Durchgang neu ansetzen.') {
    const c = coaching.init(state);
    if (!c.suspended) { c.notice = reason; c.pendingNotice = reason; coaching.record(state, reason, now); }
    c.suspended = true;
    const raw = state.checkpoint.procedureState.activeState;
    if (raw.active) state.checkpoint = adapter.action(spec(recipe), state.checkpoint, {type:'abort'}, now).state;
    const next = state.checkpoint.procedureState.activeState;
    next.ready = false; next.startAvailable = false; next.preStartStableSince = 0; next.lastSample = null;
    state.progress = progress(state.checkpoint); state.lastSampleAt = null; state.guidance = coaching.project(recipe,state);
    return state;
}
function observe(recipe, state, sample) {
    if (state.lastSampleAt !== null && sample.observedAt - state.lastSampleAt > 5000) pause(recipe, state, sample.observedAt);
    const c = coaching.init(state);
    const problem = coaching.prepare(recipe,state,sample);
    if (problem) {
        pause(recipe,state,sample.observedAt,problem);
        state.guidance = coaching.project(recipe,state);
        const voices = announce(recipe,state,c.pendingNotice,sample.observedAt); c.pendingNotice='';
        return {state,satisfied:state.progress.requiredComplete,voices};
    }
    c.suspended=false;
    const departure = recipe.voiceContext.departure || recipe.home;
    const departureDistanceNm = geo.distanceNm(sample.lat, sample.lon, departure.lat, departure.lon ?? departure.lng);
    const cues = flight.observe(context(recipe), state.flight, { ...sample, mslFt: sample.altFt }, state.progress, sample.observedAt);
    state.flight = cues.state;
    const result = adapter.observe(spec(recipe), state.checkpoint, { ...sample, departureDistanceNm });
    state.checkpoint = result.state;
    result.events = coaching.after(recipe,state,sample,result.events);
    state.progress = progress(state.checkpoint); state.lastSampleAt = sample.observedAt;
    state.guidance = coaching.project(recipe,state);
    const messages = trainingMessages(recipe,state,result.events,sample.observedAt);
    return { state, satisfied: result.satisfied, voices: [
        ...cues.cues.map(cue => ({ label: cue.label, notBefore: cue.notBefore, resolvedRecipe: {
            schema:'ga.mission-poi-voice-recipe.v1', missionId:recipe.missionId, kind:'poi', enabled:true,
            audioEnabled:recipe.voiceContext.audioEnabled, taskDomain:recipe.taskDomain, prompt:cue.prompt, fallbackText:'', playCue:false,
            speaker:recipe.voiceContext.trainingSpeaker || recipe.voiceContext.speaker,
            textModels:recipe.voiceContext.textModels, ttsModels:recipe.voiceContext.ttsModels,
            ttsHedgeEnabled:recipe.voiceContext.ttsHedgeEnabled, ttsHedgeDelayMs:recipe.voiceContext.ttsHedgeDelayMs } })),
        ...messages
    ] };
}
function action(recipe, state, intent, now) {
    if (intent === 'training_repeat_instruction' || intent === 'poi_status') {
        state.guidance=coaching.project(recipe,state);
        return {state,voices:announce(recipe,state,[state.guidance.notice, state.guidance.instruction, state.guidance.currentInstruction].filter(Boolean).join(' '),now,intent)};
    }
    const type = { training_ready:'ready', training_abort:'abort', training_extra:'optional' }[intent];
    if (!type) throw new TypeError('training_action_invalid');
    const result = adapter.action(spec(recipe), state.checkpoint, {type}, now);
    state.checkpoint = result.state; state.progress = progress(result.state);
    if (intent==='training_abort') {const c=coaching.init(state);c.notice='Durchgang abgebrochen. Nach fünf Sekunden erneut stabilisieren und starten.'; coaching.record(state,c.notice,now);}
    state.guidance=coaching.project(recipe,state);
    return { state, voices:voice.prepare({ ...recipe.voiceContext, speaker:recipe.voiceContext.trainingSpeaker || recipe.voiceContext.speaker }, {action:intent,result},now) };
}
function scope(state) {
    const s=state.checkpoint.procedureState.activeState;
    return `${s.activeIndex}:${s.exercises[s.activeIndex]?.attempts||0}:${s.active?.phase||'preparation'}`;
}
function announce(recipe,state,text,now,action) {
    if(!text)return [];
    coaching.record(state,text,now);
    state.guidance=coaching.project(recipe,state);
    return [{label:'Training',notBefore:now,...(action?{action}:{}),trainingScope:scope(state),resolvedRecipe:{
        schema:'ga.mission-poi-voice-recipe.v1',missionId:recipe.missionId,kind:'poi',enabled:true,audioEnabled:recipe.voiceContext.audioEnabled,
        taskDomain:recipe.taskDomain,prompt:'',fallbackText:text,playCue:false,speaker:recipe.voiceContext.trainingSpeaker||recipe.voiceContext.speaker,
        textModels:recipe.voiceContext.textModels,ttsModels:recipe.voiceContext.ttsModels}}];
}
function trainingMessages(recipe,state,events,now) {
    const c=coaching.init(state),g=state.guidance;
    const has=type=>events.some(e=>e.type===type);
    let text='';
    const pending=c.pendingNotice;c.pendingNotice='';
    if(has('training_required_complete')||has('training_complete'))text=`Pflichtteil abgeschlossen: ${state.progress.completedCount} Übungen erfüllt. Rückkehr frei.${state.progress.optionalAvailable?' Eine Zusatzübung ist im PAX-Menü verfügbar.':''}`;
    else if(has('exercise_repeat_required')){text='Durchgang nicht erfüllt. Neu stabilisieren und starten. '+g.instruction;c.notice=text;}
    else if(has('stall_break_detected'))text='Break erkannt. Jetzt Recovery: Flügel waagerecht, Stallwarnung beenden und Sinkrate stoppen.';
    else if(has('exercise_instruction'))text=g.instruction;
    else if(has('phase_started'))text=g.currentInstruction;
    else if(has('exercise_pass_clean'))text='Übung erfüllt. Der Durchgang bleibt gespeichert. Auf die nächste Einweisung warten.';
    else if(has('training_start_available'))text='Höhe, Kurs und Ausgangslage passen. Jetzt im PAX-Menü Übung starten.';
    else if(has('training_wait_altitude'))text=g.notice||'Sicherheitshöhe herstellen.';
    else if(has('training_values_deviation')||has('training_values_correct')||has('training_caution')) {
        const key=g.rows?.filter(r=>r.status==='error').map(r=>r.id).join(',')||'good';
        if(now-c.lastFeedbackAt>=10000 && (key!==c.lastFeedbackKey || (key!=='good' && now-c.lastFeedbackAt>=30000))) {
            text=key==='good'?`Werte passen. ${g.currentInstruction}`:`Korrektur: ${g.rows.filter(r=>r.status==='error').map(r=>r.label).join('. ')}`;
            c.lastFeedbackAt=now;c.lastFeedbackKey=key;
        }
    }
    return announce(recipe,state,[pending,text].filter(Boolean).join(' '),now);
}
module.exports = { scope, DOMAINS, validate, createState, observe, action, pause, summary:flight.summary, debrief:flight.debrief };
