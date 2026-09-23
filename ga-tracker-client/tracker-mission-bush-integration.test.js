'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const execution=require('../mission-execution-core.js'),bush=require('../mission-bush-execution-core.js');
const {bundle}=require('./tracker-mission-bush-fixture.js');
const {buildCloudMissionCandidate}=require('./tracker-mission-cloud.js');
const {createMissionAuthorityManager}=require('./mission-authority-core.js');
const {createTrackerMissionExecutionRuntime}=require('./tracker-mission-execution-runtime.js');
const completed=()=>({ok:true,status:'completed',sideEffect:false});
const tick=()=>new Promise(r=>setImmediate(r));
async function settle(){for(let i=0;i<15;i++)await tick();}
function profile(b){return {activeMission:b.missionState,activeMissionTrackerSeed:{schema:'ga.tracker-cloud-mission-seed.v1',version:1,missionId:b.missionId,adapter:b.adapter,executionBushRecipe:b.executionBushRecipe,executionEffectPlan:b.executionEffectPlan,initialCargoManifest:b.runtime.cargoManifest}};}
test('all three Bush strip profiles pass cloud and replay gate; pickup, recon, heli and source mismatch stay closed',()=>{
 for(const name of ['bush_supply_strip','bush_charter_strip','bush_scenic_hopper']){
  const b=bundle(name),p=profile(b);assert.equal(bush.validateBundle(b),null);
  const candidate=buildCloudMissionCandidate(p,{poiExecutionEnabled:true});assert.equal(candidate.status,'ready',JSON.stringify(candidate));
  assert.equal(execution.replay(candidate.candidate.bundle.executionReplay).state.recipe,'apt');
  assert.equal(buildCloudMissionCandidate(p,{poiExecutionEnabled:false}).status,'unsupported');
  for(const mutate of [v=>delete v.activeMissionTrackerSeed.executionBushRecipe,
   v=>v.activeMissionTrackerSeed.executionBushRecipe.spec.requiresReturnHome=true,
   v=>v.activeMission.currentMissionData.bush={...v.activeMission.currentMissionData.bush,profileId:'bush_pickup_strip'},
   v=>v.activeMission.currentMissionData.sarHeli={},
   v=>v.activeMissionTrackerSeed.executionEffectPlan.effects['voice.farewell'].context.supported=false]){
    const bad=structuredClone(p);mutate(bad);assert.notEqual(buildCloudMissionCandidate(bad,{poiExecutionEnabled:true}).status,'ready');
  }
 }
});
async function harness(t,name,restartFile=null){
 const b=bundle(name),directory=restartFile?path.dirname(restartFile):fs.mkdtempSync(path.join(os.tmpdir(),'bush-runtime-'));
 const storageFile=restartFile||path.join(directory,'authority.json');if(!restartFile)t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 let now=100000;
 const manager=createMissionAuthorityManager({storageFile,executionAuthorityEnabled:true,poiExecutionEnabled:true,now:()=>now,idFactory:()=> 'bush-run'});
 if(!restartFile){
  const acquired=manager.acquire({missionId:b.missionId,clientId:'app',stateHash:'web',resumeBundle:b}),run=acquired.activeRun;
  const prepared=manager.prepareExecutionAuthority({missionId:b.missionId,runId:run.runId,clientId:'app',expectedRevision:run.revision,expectedStateHash:run.stateHash,expectedExecutionStateHash:execution.replay(b.executionReplay).stateHash});
  assert.equal(prepared.ok,true,JSON.stringify(prepared));
  assert.equal(manager.commitExecutionAuthority({missionId:b.missionId,runId:run.runId,clientId:'app',expectedRevision:prepared.activeRun.revision,expectedExecutionStateHash:prepared.activeRun.executionStateHash,handoffId:prepared.handoff.handoffId}).ok,true);
 }
 const commands=[],voices=[];
 const runtime=createTrackerMissionExecutionRuntime({enabled:true,authorityManager:manager,getPilotId:()=> 'BUSH-PILOT',now:()=>now,random:()=>1,payloadSyncBeforeStart:completed,
  playBoardingVoice:r=>{voices.push(['boarding',r]);return completed();},playFarewellVoice:r=>{voices.push(['farewell',r]);return completed();}});
 const bridge=runtime.attachSimulator({getLivePosition:()=>({lat:48.3,lon:8.5,altFt:500,hdg:90}),dispatchCommand:c=>{commands.push(c);return c.type==='mission_scene_deboarding'?{ok:true,status:'pending'}:completed();},syncPayloadManifestState:completed,cleanupMission:completed});await settle();
 let serial=0;
 async function intent(intent,payload={},revision){const r=manager.getActiveRun();const out=await runtime.executeIntent({intent,payload,commandId:(restartFile?'restored-':'bush-')+(++serial),missionId:r.missionId,runId:r.runId,expectedRevision:revision??r.revision});await settle();return out;}
 async function sample(patch={}){now+=1000;const out=runtime.observeTelemetry({observedAt:now,lat:48,lon:8,altFt:500,aglFt:0,hdg:90,onGround:true,gsKts:0,...patch});await settle();await runtime.flush();return out;}
 return {b,manager,runtime,bridge,intent,sample,commands,voices,storageFile,advance:ms=>{now+=ms;}};
}
async function start(h){
 await h.sample();for(const action of ['prepare_mission','start_boarding']){const r=await h.intent(action);assert.equal(r.ok,true,JSON.stringify(r));}
 if(h.manager.getExecutionSnapshot().state.manifest.items.some(i=>i.id==='box')){const r=await h.intent('set_manifest_item',{itemId:'box',action:'load'});assert.equal(r.ok,true,JSON.stringify(r));}
 for(const action of ['sign_manifest','confirm_load','start_mission']){const r=await h.intent(action);assert.equal(r.ok,true,JSON.stringify(r));}
}
async function arrive(h){
 for(let i=0;i<4;i++)await h.sample({lat:48.1,lon:8.2,onGround:false,gsKts:90,aglFt:1500,altFt:2000});
 await h.sample({lat:48.3,lon:8.5,gsKts:20});await h.sample({lat:48.3,lon:8.5});
}
for(const name of ['bush_supply_strip','bush_charter_strip','bush_scenic_hopper'])test(`${name}: original A-B boarding, target stop, unload and close`,async t=>{
 const h=await harness(t,name);await start(h);await arrive(h);
 let state=h.manager.getExecutionSnapshot().state;assert.ok(['end_unloading','end_ready'].includes(state.phase),state.phase);
 assert.equal(h.manager.getExecutionSnapshot().location.missionTarget.lat,48.3);
 assert.equal((await h.intent('confirm_unload')).ok,false,'cargo/pax handoff cannot be skipped');
 if(state.manifest.items.some(i=>i.id==='box')){assert.equal((await h.intent('set_manifest_item',{itemId:'box',action:'unload'})).ok,true);}
 state=h.manager.getExecutionSnapshot().state;
 const snap=h.manager.getExecutionSnapshot();
 if(snap.state.cargo.summary.destinationTotal>0){
  assert.equal((await h.intent('sign_manifest')).ok,true);
  const r=await h.intent('confirm_unload');assert.equal(r.ok,true,JSON.stringify(r));
 }else {const r=await h.intent('request_close');assert.equal(r.ok,true,JSON.stringify(r));}
 const deboarding=h.commands.find(c=>c.type==='mission_scene_deboarding');
 if(deboarding){
  assert.equal(h.voices.filter(v=>v[0]==='farewell').length,0);
  assert.equal(h.bridge.handleAck({type:'mission_scene_deboarding_stage',commandId:deboarding.commandId,stage:'cue',status:'ok'}),true);
  await settle();
  assert.ok(h.commands.some(c=>c.type==='mission_scene_deboarding_continue'));
  assert.equal(h.bridge.handleAck({type:'mission_scene_deboarding_ack',commandId:deboarding.commandId,status:'ok'}),true);
 }
 for(let i=0;i<1000&&h.manager.getActiveRun();i++){await settle();await new Promise(r=>setTimeout(r,5));}
 assert.equal(h.manager.getActiveRun(),null,JSON.stringify(h.manager.getExecutionSnapshot()?.state));
 assert.equal(h.voices.filter(v=>v[0]==='farewell').length,1);
 assert.equal(h.manager.getFollowupOutbox('BUSH-PILOT').length,1,'original follow-up seed is committed with completion');
 assert.ok(h.commands.some(c=>c.type==='mission_scene_spawn'));
});
test('Bush ground intents require fresh live observations and the immutable destination',async t=>{
 const h=await harness(t);assert.equal((await h.intent('prepare_mission')).error,'bush_fresh_telemetry_required');
 await start(h);await arrive(h);
 await h.sample({lat:48.3,lon:8.5,simPaused:true});assert.equal((await h.intent('set_manifest_item',{itemId:'box',action:'unload'})).error,'bush_fresh_telemetry_required');
 await h.sample({lat:48.3,lon:8.5,gsKts:15});assert.equal((await h.intent('set_manifest_item',{itemId:'box',action:'unload'})).error,'bush_ground_stop_required');
 await h.sample({lat:48.3,lon:8.5});h.advance(6000);assert.equal((await h.intent('set_manifest_item',{itemId:'box',action:'unload'})).error,'bush_fresh_telemetry_required');
});

test('original App seed builds all strip profiles, including cargo-only without passenger approach voice',async()=>{
 const vm=require('node:vm');const {extractOriginalFunction}=await import('../tools/extract-original-function.mjs');
 const source=fs.readFileSync(path.join(__dirname,'../sync.js'),'utf8');
 for(const name of ['bush_supply_strip','bush_charter_strip','bush_scenic_hopper']){
  const b=bundle(name),effects=b.executionEffectPlan.effects;
  const sandbox={currentMissionData:b.missionState.currentMissionData,window:{GAMissionBushExecutionCore:bush,
   paxVoiceBuildBoardingEffectRecipe:()=>effects['voice.boarding'].recipe,
   paxVoiceBuildApproachAuthorityContext:()=>effects['voice.approach']?.context||null,
   paxVoiceBuildFarewellAuthorityContext:()=>effects['voice.farewell'].context},
   _activeMissionRuntimeId:()=>b.missionId,_activeBushMissionSpec:()=>b.executionBushRecipe.spec,
   _safeCloneJson:(v,f=null)=>v==null?f:structuredClone(v),_targetPointForMission:()=>b.executionBushRecipe.location.missionTarget,
   _aptArrivalPointForRuntime:()=>b.executionBushRecipe.location.arrivalPoint,
   _missionSceneBuildSpawnEffectCommand:()=>effects['scene.prepare'],
   _missionSceneBuildBoardingEffectCommand:()=>effects['scene.boarding'].command,
   _missionSceneBuildDeboardingEffectCommand:()=>effects['scene.deboarding'].command,
   _missionAptArrivalBuildEffectCommand:()=>effects['scene.arrival'].command};
  vm.createContext(sandbox);vm.runInContext(extractOriginalFunction(source,'_buildMissionAptExecutionEffectPlan')+'\n'+extractOriginalFunction(source,'_buildMissionBushExecutionSeed'),sandbox);
  const seed=sandbox._buildMissionBushExecutionSeed();assert.ok(seed,name);
  assert.equal(bush.validateBundle({...b,...seed}),null);
  assert.equal(seed.executionBushRecipe.location.missionTarget.lat,48.3);
  if(name==='bush_supply_strip')assert.equal(seed.executionEffectPlan.effects['voice.approach'],undefined);
  sandbox.currentMissionData.sarHeli={};assert.equal(sandbox._buildMissionBushExecutionSeed(),null);
 }
});

test('restart retains original Bush progress and cargo, but requires fresh ground telemetry',async t=>{
 const h=await harness(t);await start(h);await arrive(h);
 assert.equal((await h.intent('set_manifest_item',{itemId:'box',action:'unload'})).ok,true);
 const before=h.manager.getExecutionSnapshot();
 await h.runtime.flush();
 const restored=await harness(t,'bush_supply_strip',h.storageFile);
 assert.deepEqual(restored.manager.getExecutionSnapshot().state.bushTask,before.state.bushTask);
 assert.equal(restored.manager.getExecutionSnapshot().state.manifest.items[0].status,'unloaded');
 assert.equal((await restored.intent('sign_manifest')).error,'bush_fresh_telemetry_required');
 await restored.sample({lat:47,lon:7});
 assert.equal((await restored.intent('confirm_unload')).ok,false);
 restored.advance(10000);await restored.sample({lat:48.3,lon:8.5});
 const signed=await restored.intent('sign_manifest');assert.equal(signed.ok,true,JSON.stringify(signed));
 const oldRevision=restored.manager.getActiveRun().revision;
 assert.equal((await restored.intent('open_cargo_window')).ok,true);
 assert.equal((await restored.intent('confirm_unload',{},oldRevision-1)).error,'mission_revision_conflict');
 assert.equal((await restored.intent('confirm_unload')).ok,true);
});

test('compact Bush handoff preserves the original follow-up stay window and continuation context',async()=>{
 const vm=require('node:vm'),{extractOriginalFunction}=await import('../tools/extract-original-function.mjs');
 const {createForCompletedRun}=require('./tracker-mission-followup.js');
 const source=fs.readFileSync(path.join(__dirname,'../sync.js'),'utf8');
 const context={window:{GAMissionBushExecutionCore:bush}};vm.createContext(context);
 vm.runInContext(extractOriginalFunction(source,'_syncCompactMissionObjectCore'),context);
 for(const name of ['bush_supply_strip','bush_charter_strip','bush_scenic_hopper']){
  const md=bundle(name).missionState.currentMissionData,now=Date.now();
  Object.assign(md,{missionTemporalContext:{sourceKind:name,stayDays:3,followUpEligibleAt:now+3*86400000,createdAt:now-1000},
   followUpContext:{story:'Erstauftrag'},followUpProspect:{label:'Bereits besprochener Rückflug'},followUpContinuation:{parentRequestId:'previous'}});
  const compact=context._syncCompactMissionObjectCore(md);
  for(const key of ['missionTemporalContext','followUpContext','followUpProspect','followUpContinuation'])assert.deepEqual(compact[key],md[key]);
  delete md.followUpContext;delete md.followUpContinuation;delete compact.followUpContext;delete compact.followUpContinuation;
  const control={phase:'closed',flags:{closed:true,groundStill:true},cargo:{summary:{failed:false}},flight:{missionRecord:{createdAt:now},destination:{atDestination:true}}};
  const run=mission=>({missionId:md.missionId,executionAuthority:'tracker',resumeBundle:{missionState:{currentMissionData:mission}}});
  const original=createForCompletedRun(run(md),control,now),restored=createForCompletedRun(run(compact),control,now);
  assert.equal(original.requests.length,1,JSON.stringify(original));assert.deepEqual(restored,original);
 }
});

test('navigation edits and invalid/slew samples cannot move the Bush destination or authorize arrival unloading',async t=>{
 const h=await harness(t);await start(h);
 const original=h.manager.getExecutionSnapshot().location;
 assert.equal(h.manager.editNavigationRoute({routeId:'bush-run',expectedRevision:0,edit:{action:'insert',index:1,point:{lat:49,lng:9}}}).ok,true);
 assert.deepEqual(h.manager.getExecutionSnapshot().location,original);
 await arrive(h);
 for(const patch of [{lat:null,lon:8.5},{lat:48.3,lon:8.5,slewActive:true}]){
  await h.sample(patch);assert.equal((await h.intent('set_manifest_item',{itemId:'box',action:'unload'})).error,'bush_fresh_telemetry_required');
 }
 await h.sample({lat:47,lon:7});assert.equal((await h.intent('set_manifest_item',{itemId:'box',action:'unload'})).error,'bush_target_required');
 await h.sample({lat:48.3,lon:8.5});h.runtime.detachSimulator(h.bridge);
 assert.equal((await h.intent('set_manifest_item',{itemId:'box',action:'unload'})).error,'bush_fresh_telemetry_required');
});
