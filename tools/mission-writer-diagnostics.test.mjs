import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function property(name,within){const line=within.split('\n').find(row=>row.trim().startsWith(name+':'));assert.ok(line,`Missing ${name}`);return line.trim().slice(name.length+1).replace(/,$/,'');}
test('writer evidence survives stored mission and restored snapshot without truncation',()=>{
 const raw='Elena erzählt von den Sensoren. '.repeat(150)+'Die Kabelverbindung bleibt vollständig erhalten.';
 const writer=source.slice(source.indexOf('function sanitizeMissionWriterV5Payload('),source.indexOf('window.sanitizeMissionWriterV5Payload'));
 const env={src:{story:raw},finalStory:'Ersatztext.',finalized:{fallbackReason:'fragmented_story',acceptedRaw:false}};
 const debug=Object.fromEntries(['rawAiStory','writerStory','fallbackReason','writerAccepted'].map(key=>[key,vm.runInNewContext(property(key,writer),env)]));
 assert.equal(debug.rawAiStory,raw);assert.equal(debug.fallbackReason,'fragmented_story');assert.equal(debug.writerAccepted,false);
 const generated=source.slice(source.indexOf('    currentMissionData = {',source.indexOf('async function generateMission(')));
 const saved=JSON.parse(JSON.stringify({_missionWriterV4Debug:vm.runInNewContext(property('_missionWriterV4Debug',generated),{m:{_missionWriterV4Debug:debug}})}));
 const restore=source.slice(0,source.indexOf("console.debug('[MISSION SNAPSHOT] restored:'"));
 const restored=vm.runInNewContext(property('storyDebug',restore),{md:saved,contract:{}});
 assert.equal(restored.rawAiStory,raw);assert.equal(restored.fallbackReason,'fragmented_story');assert.equal(restored.writerAccepted,false);
});
import {load} from './gemini-migration-harness.mjs';
function finalizer(reasons){let fallbacks=0;const env=load({
 _missionWriterV5StoryFallbackReasons:()=>reasons,
 _missionWriterV5ComposeFallbackStory:()=>{fallbacks++;return 'Ersatztext.';},
 _missionWriterV5NewsStoryCanKeepWriterOutput:()=>false,
 _missionWriterV5NormalizeNewsEditorialTerms:s=>s,
 _missionPipelineV4EnsureCargoRouteContext:s=>s
},source,['_missionWriterV5PreservesBushCharterStory','_missionWriterV5FinalizeStory']);return {env,count:()=>fallbacks};}
test('Bush Charter retains long prose and paragraphs despite every legacy semantic warning',()=>{
 const reasons=['fragmented_story','enumerative_story','too_few_sentences','passenger_role_conflict'];
 const h=finalizer(reasons),raw='Elena erinnert sich an die Sensoren. '.repeat(200)+'\n\nSie hatte sich damals mit einer provisorischen Kabelverbindung beholfen.';
 const result=h.env._missionWriterV5FinalizeStory(raw,{mode:'BUSH',profile:{id:'bush_charter_strip'}});
 assert.equal(result.story,raw);assert.equal(result.acceptedRaw,true);assert.equal(result.fallbackReason,'');assert.deepEqual(Array.from(result.diagnosticReasons),reasons);assert.equal(h.count(),0);
 const profile=source.slice(source.indexOf('    if (!isPOI && profile.id === \'bush_charter_strip\'\n'),source.indexOf('    m.profileId = profile.id;'));
 const env={isPOI:false,profile:{id:'bush_charter_strip'},mission:{s:raw,_missionWriterV4Debug:result},m:{s:'Rewritten',passenger:{}}};
 vm.runInNewContext(profile,env);assert.equal(env.m.s,raw);assert.equal(env.m.story,raw);assert.equal(env.m.passenger.storyHint,raw);
});
test('other families and empty text retain their existing fallback path',()=>{
 for(const contract of [{mode:'APT',profile:{id:'apt_charter'}},{mode:'BUSH',profile:{id:'bush_scenic_hopper'}},{mode:'BUSH',profile:{id:'bush_supply_strip'}},{mode:'POI',profile:{id:'bush_charter_strip'},target:{isPOI:true}}]){
  const h=finalizer(['fragmented_story']);assert.equal(h.env._missionWriterV5FinalizeStory('Original',contract).acceptedRaw,false);assert.equal(h.count(),1);
 }
 const h=finalizer(['empty_writer_story']);assert.equal(h.env._missionWriterV5FinalizeStory('',{mode:'BUSH',profile:{id:'bush_charter_strip'}}).acceptedRaw,false);
});
