'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../mission-training-voice-core.js');
const { prepare } = require('./tracker-mission-training-voice.js');
const fixture = fs.readFileSync(require.resolve('../tools/fixtures/training-voice-legacy-20260923.js'), 'utf8');
const context = { missionId: 'training-test', taskDomain: 'training', speaker: { name: 'Instructor' }, audioEnabled: true };
function legacy(input) {
    const voices = [];
    const box = { currentMissionData: null, window: { activePassenger: null, missionTrainingProcedure: {
        signalReady: () => input.result, abortExercise: () => input.result, requestOptionalExercise: () => input.result
    } }, _paxLog() {}, _refreshTrainingProcedureMenu() {}, _refreshPaxWidgetVisibility() {},
    _speakerSnapshotForMissionVoice: () => context.speaker, _paxMissionAudioKey: kind => kind + ':' + context.missionId,
    _paxTryPlayStaticTrainingVoice: kind => kind,
    _speakPreparedText: (key,text,speaker,label,options={}) => voices.push({key,text,speaker,label,staticClipKey: options.tryStaticAudio?.(0)||null}),
    _trainingProcedureControlSpeak: (text,label) => voices.push({text:String(text).replace(/\s+/g,' ').trim(),label,speaker:context.speaker,staticClipKey:null}) };
    vm.createContext(box); vm.runInContext(fixture, box);
    if (input.action) box[{ training_ready:'paxTrainingProcedureReady',training_abort:'paxTrainingProcedureAbort',training_extra:'paxTrainingProcedureRequestExtra' }[input.action]]();
    else box._handleTrainingProcedureEvents(input.events || [], null);
    return JSON.parse(JSON.stringify(voices));
}
const events = [
    ...['training_complete','training_required_complete','training_ready_available','training_start_available','training_values_correct','training_values_deviation','training_optional_started','stall_break_detected','training_wait_altitude','exercise_started','training_started','unknown'].map(type=>({type})),
    ...['constant_bank_360','turn_180','altitude_step_hold','stall_recovery'].flatMap(exerciseType=>[30,45].map(targetBankDeg=>({type:'exercise_instruction',exerciseType,targetBankDeg,exerciseId:'ex'}))),
    ...['altitude','heading','bank','speed','rollout_soon','rollout','leveloff','stall_setup','stall_hold_altitude','stall_wings_level','stall_recovery','stall_stop_sink','stall_secondary','unknown'].map(caution=>({type:'training_caution',caution})),
    ...['altitude','heading','bank','speed','unknown'].map(reason=>({type:'exercise_repeat_required',reason})),
    ...['constant_bank_360','turn_180','altitude_step_hold','stall_recovery'].map(exerciseType=>({type:'exercise_pass_clean',exerciseType})),
    ...['altitude_change','hold_final','hold_initial','entry','rollout','approach','hold_to_break','recovery'].map(phase=>({type:'phase_started',phase}))
];
test('Training events and every pair preserve frozen original priority, text, speaker and clip key',()=>{
    for (const event of events) assert.deepEqual(core.render(context,{events:[event]}),legacy({events:[event]}));
    for (const a of events) for (const b of events) assert.deepEqual(core.render(context,{events:[a,b]}),legacy({events:[a,b]}));
});
test('Training controls preserve original success and rejection text',()=>{
    for (const action of ['training_ready','training_abort','training_extra']) for (const reason of ['required_complete','departure_distance','not_stable','not_briefed','required_open','active','no_optional_left','no_active']) for (const ok of [true,false]) {
        const input={action,result:{ok,reason}};
        assert.deepEqual(core.render(context,input),legacy(input));
    }
});
test('Training voice adapter creates ordered effects without mutating context or playing audio',()=>{
    const input={events:[{type:'training_complete'},{type:'training_caution',caution:'bank'}]};
    const before=JSON.stringify({context,input}); const effects=prepare(context,input,1234);
    assert.equal(effects.length,1); assert.equal(effects[0].notBefore,1234);
    assert.equal(effects[0].resolvedRecipe.staticClipKey,'training_complete');
    assert.equal(effects[0].resolvedRecipe.fallbackText,legacy(input)[0].text);
    assert.equal(effects[0].resolvedRecipe.prompt,''); assert.equal(effects[0].resolvedRecipe.playCue,false);
    assert.equal(JSON.stringify({context,input}),before);
});
