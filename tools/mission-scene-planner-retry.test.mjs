import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {extractOriginalFunction} from './extract-original-function.mjs';
const source=fs.readFileSync('app.js','utf8');
test('explicit placement catalogue offers only arrangements implemented by its validator',()=>{
 const env=vm.createContext({window:{},missionSceneTargetKindCatalog:()=>({}),missionSceneTargetFeatureCatalog:()=>({}),scenePlannerV3CleanText:x=>x});
 vm.runInContext(extractOriginalFunction(source,'scenePlannerV3AssetCatalog'),env);
 assert.deepEqual(Array.from(env.scenePlannerV3AssetCatalog({explicitPlacement:true}).arrangements),['cluster','line']);
 assert.ok(env.scenePlannerV3AssetCatalog().arrangements.includes('scattered'));
});
test('POI context is fetched once; remaining rounds plan or repair, final rejection retains evidence',async()=>{
 const payloads=[];let calls=0;
 const env=vm.createContext({window:{MissionReporterSceneCore:{enabled:()=>true,correctionOptions:()=>[],VERSION:'poi-placement.v3'},MISSION_SCENE_ASSETS:{}},AbortController,setTimeout,clearTimeout,
 normalizeMissionType:()=> 'poi',sanitizeMissionSceneIntentSpec:x=>x,getSelectedAiModelProfile:()=> 'default',scenePlannerV3Prompt:()=> 'prompt',scenePlannerV3ToolDeclarations:()=>[],scenePlannerV3ExecuteTool:async()=>({complete:true}),incrementApiUsage:()=>{},
 _missionPipelineV3ExtractFunctionCalls:d=>d.calls||[],_missionPipelineV3ExtractText:d=>d.text,_missionPipelineV3ParseJsonText:JSON.parse,
 sanitizeScenePlannerV3Result:()=>{throw Error('reporter_scene_invalid: test clearance');},MISSION_SCENE_PLANNER_V3_VERSION:'test',
 fetch:async(_url,opts)=>{payloads.push(JSON.parse(opts.body));return {ok:true,json:async()=>++calls===1?{calls:[{name:'get_scene_context_bundle'}],candidates:[{content:{role:'model',parts:[]}}]}:{text:JSON.stringify({targetScene:{kind:'event_site',placementIntent:{use:'settlement_space'},requirements:[]}})}};}});
 vm.runInContext(source.slice(source.indexOf('async function composeMissionScenePlanV3WithGemini'),source.indexOf('async function composeMissionTargetSceneWithGemini')),env);
 const result=await env.composeMissionScenePlanV3WithGemini({missionData:{isPOI:true},missionContract:{},passenger:{},apiKey:'test'});
 assert.equal(calls,5);assert.equal(payloads[0].toolConfig.functionCallingConfig.mode,'ANY');assert.ok(payloads.slice(1).every(p=>p.toolConfig.functionCallingConfig.mode==='NONE'));
 assert.equal(result.debug.attempts.length,4);assert.equal(result.debug.aiRaw.kind,'event_site');assert.equal(result.debug.toolCalls.length,1);assert.match(result.debug.error,/test clearance/);
});
test('debug report prefers current mission planner failure over pre-acceptance snapshot',()=>{
 const text=fs.readFileSync('profile.js','utf8');const start=text.indexOf('    const activeSceneMission =');const end=text.indexOf('\n    const targetCommandHasMapPoints',start);
 const env=vm.createContext({currentMissionData:{targetSceneComposerDebug:{error:'current failure'}},sceneDbg:{sceneComposer:{error:'stale scene'}},missionSnap:{targetSceneComposerDebug:{error:'stale snapshot'}}});
 vm.runInContext(text.slice(start,end)+'\nglobalThis.result=sceneComposer;',env);assert.equal(env.result.error,'current failure');
});
