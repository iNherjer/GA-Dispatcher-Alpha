'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const execution=require('../mission-execution-core.js'),bush=require('../mission-bush-execution-core.js'),pickupVoice=require('../mission-bush-pickup-voice-core.js');
const {bundle}=require('./tracker-mission-bush-return-fixture.js');
const {createMissionAuthorityManager}=require('./mission-authority-core.js');
const {createTrackerMissionExecutionRuntime}=require('./tracker-mission-execution-runtime.js');
const completed=()=>({ok:true,status:'completed',sideEffect:false}); const tick=()=>new Promise(r=>setImmediate(r)); async function settle(){for(let i=0;i<12;i++)await tick();}
let harnessSerial=0;
async function harness(t,profile,restartFile=null,options={}){
 const b=bundle(profile),directory=restartFile?path.dirname(restartFile):fs.mkdtempSync(path.join(os.tmpdir(),'bush-pickup-'));const storageFile=restartFile||path.join(directory,'authority.json');if(!restartFile)t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));let now=Date.now();options.configureBundle?.(b);
 const manager=createMissionAuthorityManager({storageFile,executionAuthorityEnabled:true,poiExecutionEnabled:true,now:()=>now,idFactory:()=> 'pickup-run'});
 if(!restartFile){const acquired=manager.acquire({missionId:b.missionId,clientId:'app',stateHash:'web',resumeBundle:b}),run=acquired.activeRun;const prepared=manager.prepareExecutionAuthority({missionId:b.missionId,runId:run.runId,clientId:'app',expectedRevision:run.revision,expectedStateHash:run.stateHash,expectedExecutionStateHash:execution.replay(b.executionReplay).stateHash});assert.equal(prepared.ok,true,JSON.stringify(prepared));assert.equal(manager.commitExecutionAuthority({missionId:b.missionId,runId:run.runId,clientId:'app',expectedRevision:prepared.activeRun.revision,expectedExecutionStateHash:prepared.activeRun.executionStateHash,handoffId:prepared.handoff.handoffId}).ok,true);}
 const commands=[],voices=[],logs=[];const runtime=createTrackerMissionExecutionRuntime({enabled:true,log:line=>logs.push(line),authorityManager:manager,getPilotId:()=> 'PICKUP-PILOT',now:()=>now,payloadSyncBeforeStart:completed,playBoardingVoice:r=>{voices.push(r);return options.playBoardingVoice?.(r) || completed();},playFarewellVoice:r=>{voices.push(r);return completed();}});
 const bridge=runtime.attachSimulator({getLivePosition:()=>({lat:48,lon:8,altFt:500,hdg:90}),dispatchCommand:c=>{commands.push(c);return c.type==='mission_scene_manual_pax'||c.type==='mission_scene_boarding'||c.type==='mission_scene_deboarding'?{ok:true,status:'pending'}:completed();},syncPayloadManifestState:completed,cleanupMission:completed});await settle();let serial=0;const session=++harnessSerial;
 async function intent(action,payload={},expectedRevision){const r=manager.getActiveRun();const result=await runtime.executeIntent({intent:action,payload,commandId:'pickup-'+session+'-'+(++serial),missionId:r.missionId,runId:r.runId,expectedRevision:expectedRevision??r.revision});await settle();return result;}
 async function sample(patch={}){now+=1000;const out=runtime.observeTelemetry({observedAt:now,lat:48,lon:8,altFt:500,aglFt:0,hdg:90,onGround:true,gsKts:0,slewActive:true,slewMode:true,isSlewActive:true,slewTelemetryStatus:'error',...patch});assert.equal(out.ok,true,JSON.stringify(out));await settle();await runtime.flush();return out;}
 return {b,manager,runtime,bridge,intent,sample,commands,voices,logs,storageFile,advance:ms=>now+=ms};
}
async function start(h){await h.sample();for(const action of ['prepare_mission','start_boarding'])assert.equal((await h.intent(action)).ok,true);const items=h.manager.getExecutionSnapshot().state.manifest.items;for(const item of items.filter(i=>i.pickupLocation!=='target')){if(item.itemType==='passenger'){const r=await h.intent('request_pax_interaction',{action:'load',itemId:item.id});assert.equal(r.ok,true,JSON.stringify(r));const cmd=h.commands.findLast(c=>c.type==='mission_scene_manual_pax');assert.ok(cmd,JSON.stringify(h.commands));assert.equal(h.bridge.handleAck({type:'mission_scene_manual_pax_ack',commandId:cmd.commandId,status:'ok'}),true);await settle();}else assert.equal((await h.intent('set_manifest_item',{itemId:item.id,action:'load'})).ok,true);}assert.equal((await h.intent('sign_manifest')).ok,true);assert.equal((await h.intent('confirm_load')).ok,true);assert.equal((await h.intent('start_mission')).ok,true);}
async function target(h){for(let i=0;i<4;i++)await h.sample({lat:48.3,lon:8.5,altFt:1800,aglFt:1200,onGround:false,gsKts:80});await h.sample({lat:48.3,lon:8.5,altFt:500,aglFt:0,onGround:true,gsKts:0});await h.sample({lat:48.3,lon:8.5});}
for(const profile of ['bush_pickup_strip','bush_pickup_cargo'])test(`${profile} pickup moves through return, home unload and close`,async t=>{
 const h=await harness(t,profile),kind=profile.endsWith('cargo')?'cargo':'passenger';assert.equal(bush.validateBundle(h.b),null);assert.equal(pickupVoice.validateContext(h.b.executionBushRecipe.voiceContext,h.b.missionId),null);assert.deepEqual(h.b.executionEffectPlan.bushPickup.voiceContext,h.b.executionBushRecipe.voiceContext);
 await start(h);const prestageSample=await h.sample({lat:48.28,lon:8.47,altFt:1800,aglFt:1200,onGround:false,gsKts:80});assert.ok(h.commands.some(c=>c.type==='mission_scene_spawn'&&c.sceneId==='pickup-arrival'),JSON.stringify({profile,sample:prestageSample,commands:h.commands,state:h.manager.getExecutionSnapshot()?.state,effects:h.manager.getExecutionSnapshot()?.state.effects}));await target(h);
 assert.equal(h.manager.getExecutionSnapshot().state.phase,'on_task');assert.equal(h.manager.getExecutionSnapshot().state.bushTask.pickupReady,true);
 if(kind==='passenger'){const loaded=await h.intent('request_pax_interaction',{action:'load',itemId:'pickup-person'});assert.equal(loaded.ok,true,JSON.stringify(loaded));const command=h.commands.findLast(c=>c.type==='mission_scene_boarding');assert.ok(command,JSON.stringify({commands:h.commands,state:h.manager.getExecutionSnapshot().state}));assert.equal(h.manager.getExecutionSnapshot().state.manifest.items.find(i=>i.id==='pickup-person').status,'pending');assert.equal(h.bridge.handleAck({type:'mission_scene_boarding_ack',commandId:command.commandId,status:'ok'}),true);await settle();await h.runtime.flush();assert.equal(h.manager.getExecutionSnapshot().state.manifest.items.find(i=>i.id==='pickup-person').status,'loaded',JSON.stringify(h.manager.getExecutionSnapshot().state));const afterAck=structuredClone(h.manager.getExecutionSnapshot().state);assert.equal(h.bridge.handleAck({type:'mission_scene_boarding_ack',commandId:command.commandId,status:'ok'}),false,'duplicate ACK after completion is ignored');assert.deepEqual(h.manager.getExecutionSnapshot().state,afterAck,'duplicate ACK has no state effects');assert.equal((await h.intent('set_manifest_item',{itemId:'pickup-cargo',action:'load'})).ok,true);}
 else assert.equal((await h.intent('set_manifest_item',{itemId:'pickup-cargo',action:'load'})).ok,true);
 const signed=await h.intent('sign_manifest');assert.equal(signed.ok,true,JSON.stringify({signed,state:h.manager.getExecutionSnapshot()?.state}));const confirmed=await h.intent('confirm_pickup');assert.equal(confirmed.ok,true,JSON.stringify({confirmed,state:h.manager.getExecutionSnapshot()?.state}));let snap=h.manager.getExecutionSnapshot();assert.equal(snap.state.phase,'return_leg');assert.equal(snap.state.progress.pickupCompleted,true);assert.equal(snap.location.missionTarget.lat,48);assert.ok(h.commands.some(c=>c.type==='mission_scene_clear'));
 const staleRevision=h.manager.getActiveRun().revision-1;assert.equal((await h.intent('confirm_pickup',{},staleRevision)).error,'mission_revision_conflict','a stale second controller cannot repeat pickup confirmation');
 for(let i=0;i<4;i++)await h.sample({lat:48,lon:8,altFt:1800,aglFt:1200,onGround:false,gsKts:80});await h.sample({lat:48,lon:8,altFt:500,aglFt:0,onGround:true,gsKts:0});await h.sample({lat:48,lon:8});snap=h.manager.getExecutionSnapshot();for(const stage of kind==='cargo'?['cargo_pickup_boarding','cargo_pickup_departure']:['pickup_boarding','pickup_departure'])assert.equal(h.voices.filter(r=>r.effect?.type==='voice.bush'&&r.effect.payload.stage===stage).length,1,JSON.stringify({stage,logs:h.logs.filter(line=>/BUSH_VOICE/.test(line)),effects:snap.state.effects.filter(e=>e.type==='voice.bush').map(e=>({stage:e.payload.stage,status:e.status}))}));assert.ok(['end_unloading','end_ready'].includes(snap.state.phase),snap.state.phase);
 for(const item of snap.state.manifest.items.filter(i=>i.deliverAtHome&&i.status==='loaded'&&i.itemType==='cargo'))assert.equal((await h.intent('set_manifest_item',{itemId:item.id,action:'unload'})).ok,true);
 if(h.manager.getExecutionSnapshot().state.phase==='end_unloading'){assert.equal((await h.intent('sign_manifest')).ok,true);assert.equal((await h.intent('confirm_unload')).ok,true);}else assert.equal((await h.intent('request_close')).ok,true);
 const deboarding=h.commands.findLast(c=>c.type==='mission_scene_deboarding');if(deboarding){assert.equal(deboarding.coordinateFarewell,true);assert.equal(h.bridge.handleAck({type:'mission_scene_deboarding_stage',commandId:deboarding.commandId,stage:'cue',status:'ok'}),true);await settle();assert.ok(h.commands.some(c=>c.type==='mission_scene_deboarding_continue'));assert.equal(h.bridge.handleAck({type:'mission_scene_deboarding_ack',commandId:deboarding.commandId,status:'ok'}),true);await settle();}
 for(let i=0;i<1000&&h.manager.getActiveRun();i++){await settle();await new Promise(r=>setTimeout(r,2));}assert.equal(h.manager.getActiveRun(),null,JSON.stringify(h.manager.getExecutionSnapshot()?.state));
});
test('cargo pickup plan accepts null boarding recipe while explicit empty initial scene phases remain gated',async t=>{const h=await harness(t,'bush_pickup_cargo');assert.equal(h.b.executionEffectPlan.bushPickup.pickupBoarding,null);await h.sample();assert.equal((await h.intent('prepare_mission')).ok,true);assert.equal((await h.intent('start_boarding')).ok,true);assert.ok(!h.commands.some(c=>c.type==='mission_scene_spawn'&&c.sceneId==='home-scene'));});
test('pickup confirmation survives restart with home return anchor; intents need fresh telemetry and startup does not replay pickup',async t=>{
 const h=await harness(t,'bush_pickup_cargo');await start(h);await h.sample({lat:48.28,lon:8.47,altFt:1800,aglFt:1200,onGround:false,gsKts:80});await target(h);
 assert.equal(h.manager.getExecutionSnapshot().state.bushTask.pickupReady,true);assert.equal((await h.intent('set_manifest_item',{itemId:'pickup-cargo',action:'load'})).ok,true);assert.equal((await h.intent('sign_manifest')).ok,true);
 const revisionBeforeConfirmation=h.manager.getActiveRun().revision;assert.equal((await h.intent('confirm_pickup')).ok,true);await h.sample({lat:48.3,lon:8.5});assert.equal(h.voices.filter(r=>r.effect?.payload?.stage==='cargo_pickup_boarding').length,1);const before=h.manager.getExecutionSnapshot();assert.equal(before.state.phase,'return_leg');assert.equal(before.state.manifest.items.find(i=>i.id==='pickup-cargo').status,'loaded');assert.equal(before.location.missionTarget.lat,48);assert.equal(before.location.missionTarget.lon,8);
 assert.equal((await h.intent('confirm_pickup',{},revisionBeforeConfirmation)).error,'mission_revision_conflict','second controller cannot repeat pickup confirmation from an older revision');
 await h.runtime.flush();const restored=await harness(t,'bush_pickup_cargo',h.storageFile);assert.deepEqual(restored.manager.getExecutionSnapshot().state.bushTask,before.state.bushTask);assert.equal(restored.manager.getExecutionSnapshot().state.phase,'return_leg');assert.deepEqual(restored.manager.getExecutionSnapshot().location.missionTarget,before.location.missionTarget);assert.equal(restored.manager.getExecutionSnapshot().state.manifest.items.find(i=>i.id==='pickup-cargo').status,'loaded');
 assert.equal((await restored.intent('request_pax_interaction',{action:'load',itemId:'not-a-pax'})).error,'bush_fresh_telemetry_required');assert.deepEqual(restored.commands.filter(c=>['mission_scene_spawn','mission_scene_boarding'].includes(c.type)),[],'recovery does not respawn arrival/pickup boarding');assert.equal(restored.voices.length,0,'recovery does not replay boarding voice');
 restored.advance(10000);await restored.sample({lat:48.29,lon:8.48,altFt:1800,aglFt:1200,onGround:false,gsKts:80});assert.equal(restored.manager.getExecutionSnapshot().state.phase,'return_leg');assert.deepEqual(restored.commands.filter(c=>c.type==='mission_scene_boarding'),[]);assert.equal(restored.voices.filter(r=>r.effect?.payload?.stage==='cargo_pickup_boarding').length,0,'completed pickup voice never replays');assert.equal(restored.voices.filter(r=>r.effect?.payload?.stage==='cargo_pickup_departure').length,1,'new airborne sample releases the pending departure voice');
 for(let i=0;i<4;i++)await restored.sample({lat:48.29,lon:8.48,altFt:1800,aglFt:1200,onGround:false,gsKts:80});assert.equal(restored.voices.filter(r=>r.effect?.payload?.stage==='cargo_pickup_departure').length,1,'departure voice does not repeat');
});

async function confirmTestPickup(h, profile) {
 if (profile === 'bush_pickup_strip') {
  assert.equal((await h.intent('request_pax_interaction', {action:'load', itemId:'pickup-person'})).ok, true);
  const command=h.commands.findLast(c=>c.type==='mission_scene_boarding');
  assert.ok(command);
  assert.equal(h.bridge.handleAck({type:'mission_scene_boarding_ack', commandId:command.commandId, status:'ok'}), true);
  await settle(); await h.runtime.flush();
 }
 for (const [action,payload] of [['set_manifest_item',{itemId:'pickup-cargo',action:'load'}], ['sign_manifest',{}], ['confirm_pickup',{}]])
  assert.equal((await h.intent(action,payload)).ok,true,action);
}
const airborneReturn={lat:48.24,lon:8.4,altFt:1800,aglFt:1200,onGround:false,gsKts:80};
for (const profile of ['bush_pickup_strip','bush_pickup_cargo']) test(`${profile} real voice ACK retains stage texts across checkpoint restart`, async t=>{
 const options={playBoardingVoice:r=>({ok:true,status:'completed',voiceOutcome:{
  schema:'ga.mission-voice-outcome.v1',kind:'boarding',status:'ok',playback:'completed',
  text:`${r.effect.payload.stage} Die Funkgeräte wurden draußen geprüft.`,
  speaker:{name:'Ava Reed',taskDomain:'bush_pickup_return'}
 }})};
 const h=await harness(t,profile,null,options);
 await start(h); await target(h); await confirmTestPickup(h,profile);
 for(let i=0;i<4;i++)await h.sample(airborneReturn);
 const before=h.manager.getExecutionSnapshot().state;
 const stages=profile.endsWith('cargo')?['cargo_pickup_boarding','cargo_pickup_departure']:['pickup_boarding','pickup_departure'];
 assert.deepEqual((before.voice.bushHistory || []).map(row=>row.stage),stages);
 for(const row of before.voice.bushHistory)assert.equal(row.text,`${row.stage} Die Funkgeräte wurden draußen geprüft.`);
 assert.ok(JSON.stringify(before.voice.bushMemory).includes(stages[0]));
 assert.ok(JSON.stringify(before.voice.bushMemory).includes(stages[1]));
 const departure=h.voices.find(r=>r.effect.type==='voice.bush'&&r.effect.payload.stage===stages[1]);
 assert.ok(JSON.stringify(departure.resolvedRecipe).includes(`${stages[0]} Die Funkgeräte wurden draußen geprüft.`),'departure recipe uses the acknowledged boarding text');
 h.runtime.detachSimulator();
 const restored=await harness(t,profile,h.storageFile,options);
 assert.deepEqual(restored.manager.getExecutionSnapshot().state.voice.bushHistory,before.voice.bushHistory);
 assert.deepEqual(restored.manager.getExecutionSnapshot().state.voice.bushMemory,before.voice.bushMemory);
 assert.equal(restored.voices.length,0,'startup never replays completed stage voices');
 restored.advance(10000);
 for(let i=0;i<4;i++)await restored.sample(airborneReturn);
 assert.equal(restored.voices.filter(r=>r.effect.type==='voice.bush').length,0,'fresh telemetry never replays completed stage voices');
});
for(const schema of ['charter-idea.v1','apt-news-idea.v1']) test(`${schema} pickup conversation waits for occupied return leg and remains claimed after restart`,async t=>{
 const options={configureBundle:b=>{
  const home=b.executionBushRecipe.home,visited=b.executionBushRecipe.location.missionTarget;
  const idea={schema,narrativeEvents:[{atPercent:20,intent:'Gespräch über den bereits erlebten Aufenthalt.'}],continuation:{pickupRequired:true,visited,home}};
  const mission=b.missionState.currentMissionData;
  mission[schema==='charter-idea.v1'?'charterIdea':'aptNewsIdea']=idea;
  mission.routeWaypoints=[home,visited,home];
  Object.assign(b.executionEffectPlan.effects['voice.approach'].context,{narrativeEvents:idea.narrativeEvents,audioEnabled:true,speaker:{narrativeSchema:schema}});
 }};
 const h=await harness(t,'bush_pickup_strip',null,options);
 await start(h);
 const routeEffects=controller=>controller.manager.getExecutionSnapshot().state.effects.filter(e=>e.type==='voice.flight'&&e.payload.kind==='route_story');
 for(let i=0;i<6;i++)await h.sample({...airborneReturn,lat:48.15,lon:8.25});
 assert.equal(routeEffects(h).length,0,'empty outbound leg must not consume conversation');
 h.runtime.detachSimulator();
 const occupied=await harness(t,'bush_pickup_strip',h.storageFile,options);
 occupied.advance(10000);
 assert.equal(routeEffects(occupied).length,0,'checkpoint contains no premature claim');
 await target(occupied); await confirmTestPickup(occupied,'bush_pickup_strip');
 occupied.advance(60000);
 for(let i=0;i<6;i++)await occupied.sample(airborneReturn);
 const events=routeEffects(occupied);
 assert.equal(events.length,1); assert.equal(events[0].payload.narrativeEventId,'route-story-0'); assert.equal(events[0].status,'completed');
 assert.equal(occupied.voices.filter(r=>r.effect.type==='voice.flight'&&r.effect.payload.kind==='route_story').length,1);
 const snapshot=occupied.manager.getExecutionSnapshot();
 const routeState=occupied.manager.getExecutionRuntimeContext({missionId:snapshot.missionId,runId:snapshot.runId}).flightVoiceState.routeVoice;
 assert.ok(Math.abs(routeState.percent-20)<1,JSON.stringify(routeState));
 occupied.runtime.detachSimulator();
 const restored=await harness(t,'bush_pickup_strip',h.storageFile,options);
 restored.advance(80000);
 for(let i=0;i<6;i++)await restored.sample(airborneReturn);
 assert.equal(routeEffects(restored).length,1);
 assert.equal(restored.voices.filter(r=>r.effect.type==='voice.flight'&&r.effect.payload.kind==='route_story').length,0,'completed conversation never repeats after checkpoint restart');
});
