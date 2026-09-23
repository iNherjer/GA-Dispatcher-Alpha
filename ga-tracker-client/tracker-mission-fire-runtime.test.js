'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const poi = require('./tracker-mission-poi-runtime.js');
const voice = require('../mission-poi-voice-core.js');
const recipe = (truth = 'fire') => ({ schema: poi.RECIPE_SCHEMA, version: 1, missionId: 'fire-test', taskDomain: 'fire_watch',
 target: { lat: 48, lon: 8 }, home: { lat: 47, lon: 8 }, strict: true, trackingActive: true,
 passenger: { targetRadiusNm: 1.5, targetAltFt: 3000, targetDwellMin: 10 },
 fireScenario: { enabled: true, type: 'fire_watch', truth, target: { lat: 48, lon: 8 }, state: 'enroute', searchDwellSec: 180, assessmentDwellSec: 240 },
 voiceContext: { schema: voice.CONTEXT_SCHEMA, version: 1, missionId: 'fire-test', taskDomain: 'fire_watch', strict: true, baseContext: 'Feuerwache', audioEnabled: false,
 passenger: { targetRadiusNm: 1.5, targetAltFt: 3000, targetDwellMin: 10 }, speaker: { name: 'Mia' } } });
const sample = observedAt => ({ observedAt, lat: 48.001, lon: 8, altFt: 2000, aglFt: 1000, gsKts: 90, hdg: 0 });
const facts = { active: true, trackingActive: true };
test('fire gate requires original scenario and stays separate from generic POI task', () => {
 const r = recipe(); assert.equal(poi.validateRecipe(r), null);
 for (const fs of [null, {}, {...r.fireScenario,truth:'unknown'}, {...r.fireScenario,searchDwellSec:-1}, {...r.fireScenario,target:{lat:null,lon:8}}]) assert.ok(poi.validateRecipe({...r,fireScenario:fs}));
 const first = poi.observe(r,null,sample(1000),facts);
 assert.equal(first.state.detector.satisfied,false);
 assert.equal(first.effects[0].type,'fire');
 assert.equal(first.effects[0].voices.length,2);
 // No generic cargo/altitude abort: fire search precedes the common task in the original.
 assert.equal(first.state.detector.aborted,false);
 assert.equal(poi.project(first.state).fireWatch.state,'searching');
 assert.equal(JSON.stringify(poi.project(first.state)).includes('"truth"'),false);
});
test('fire assessment keeps original interval but freezes offline time on recovery', () => {
 const r=recipe(); let state=poi.observe(r,null,sample(1000),facts).state;
 state=poi.fireAction(r,state,'fire_smoke_visible',sample(2000),2000).poiTask;
 assert.equal(state.fireState.scenario.state,'smoke_confirmed');
 state=poi.observe(r,state,sample(3000),facts).state;
 state=poi.suspend(r,state);
 state=poi.observe(r,state,sample(603000),facts).state;
 assert.equal(state.detector.satisfied,false);
 state=poi.observe(r,state,sample(842000),facts).state;
 assert.equal(state.detector.satisfied,true);
 assert.equal(state.fireState.scenario.state,'assessment_complete');
});
test('manual false-alarm report after elapsed search immediately completes the task', () => {
 const r=recipe('false_alarm');let state=poi.observe(r,null,sample(1000),facts).state;
 state=poi.observe(r,state,sample(181000),facts).state;
 assert.equal(state.detector.satisfied,false);
 const result=poi.fireAction(r,state,'fire_no_smoke',sample(181001),181001);
 assert.equal(result.poiTask.detector.satisfied,true);
 assert.equal(result.poiTask.detector.atTargetDone,true);
 assert.match(result.voiceEffects[0].resolvedRecipe.fallbackText,/Rueckflug freigegeben/);
 assert.equal(result.voiceEffects[0].resolvedRecipe.prompt,'');
});
test('false-alarm early report finishes once search time elapses; real fire never auto-confirms', () => {
 for(const truth of ['fire','false_alarm']) {
 const r=recipe(truth);let state=poi.observe(r,null,sample(1000),facts).state;
 state=poi.fireAction(r,state,'fire_no_smoke',sample(2000),2000).poiTask;
 state=poi.observe(r,state,sample(182000),facts).state;
 assert.equal(state.detector.satisfied,truth==='false_alarm');
 }
});

test('awareness waits for the actual approach distance supplied by the POI caller', () => {
 const result = poi.observe(recipe(), null, {...sample(1000), lat: 48.2}, facts);
 assert.equal(result.state.fireState.scenario.awarenessDone, undefined);
 assert.deepEqual(result.effects, []);
});
test('App seed carries original fire sources and makes no generic target scene or false-alarm smoke', async () => {
 const fs = require('node:fs'), vm = require('node:vm');
 const {extractOriginalFunction} = await import('../tools/extract-original-function.mjs');
 const builder = extractOriginalFunction(fs.readFileSync(require('node:path').join(__dirname,'../sync.js'),'utf8'),'_buildMissionPoiExecutionSeed');
 for (const truth of ['fire','false_alarm']) {
 const r = recipe(truth); r.fireScenario.smoke = {lat:48,lon:8,altFt:500,sites:[{lat:48,lon:8,altFt:500,count:3,radiusM:80}]};
 r.fireScenario.fire = {enabled:true,sites:[{lat:48,lon:8,altFt:501}]};
 const context = {currentMissionData:{fireScenario:r.fireScenario},window:{activePassenger:r.passenger,paxVoiceBuildPoiAuthorityContext:()=>r.voiceContext,paxVoiceGetPoiMissionProgress:()=>({trackingActive:true})},
 _activeMissionRuntimeId:()=>r.missionId,_targetPointForMission:()=>r.target,_missionHomePointForRuntime:()=>r.home,_activeFireScenario:()=>r.fireScenario,_ensureFireSmokeSites:()=>{},
 _safeCloneJson:value=>JSON.parse(JSON.stringify(value)),_buildMissionAptExecutionEffectPlan:()=>({effects:{}}),_missionTargetSceneKind:()=>{throw Error('generic scene must not run for fire');}};
 vm.createContext(context);vm.runInContext(builder,context);const seed=context._buildMissionPoiExecutionSeed();
 assert.equal(poi.validateRecipe(seed.executionPoiRecipe),null);
 assert.equal(seed.executionEffectPlan.effects['scene.target'].none,true);
 const smoke=seed.executionEffectPlan.effects['smoke.spawn']?.command;
 assert.equal(!!smoke,truth==='fire');
 if(smoke) assert.deepEqual(JSON.parse(JSON.stringify(smoke.sites)),r.fireScenario.smoke.sites);
 }
});
