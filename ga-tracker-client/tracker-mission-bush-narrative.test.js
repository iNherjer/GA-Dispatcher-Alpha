'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const execution=require('../mission-execution-core.js'),narrative=require('../mission-bush-narrative-core.js');
const {createTrackerMissionExecutionAdapter}=require('./tracker-mission-execution-adapter.js');
const {bundle}=require('./tracker-mission-bush-fixture.js');
const {createMissionAuthorityManager}=require('./mission-authority-core.js');
const {createTrackerMissionExecutionRuntime}=require('./tracker-mission-execution-runtime.js');
const completed=()=>({ok:true,status:'completed',sideEffect:false});
const tick=()=>new Promise(r=>setImmediate(r));
async function settle(){for(let i=0;i<15;i++)await tick();}
async function harness(t,name,restartFile=null, configure=null){
 const b=bundle(name); if(configure)configure(b); const directory=restartFile?path.dirname(restartFile):fs.mkdtempSync(path.join(os.tmpdir(),'bush-runtime-'));
 const storageFile=restartFile||path.join(directory,'authority.json');if(!restartFile)t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 let now=100000;
 const manager=createMissionAuthorityManager({storageFile,executionAuthorityEnabled:true,poiExecutionEnabled:true,now:()=>now,idFactory:()=> 'bush-run'});
 if(!restartFile){
  const acquired=manager.acquire({missionId:b.missionId,clientId:'app',stateHash:'web',resumeBundle:b}),run=acquired.activeRun;
  const prepared=manager.prepareExecutionAuthority({missionId:b.missionId,runId:run.runId,clientId:'app',expectedRevision:run.revision,expectedStateHash:run.stateHash,expectedExecutionStateHash:execution.replay(b.executionReplay).stateHash});
  assert.equal(prepared.ok,true,JSON.stringify(prepared));
  assert.equal(manager.commitExecutionAuthority({missionId:b.missionId,runId:run.runId,clientId:'app',expectedRevision:prepared.activeRun.revision,expectedExecutionStateHash:prepared.activeRun.executionStateHash,handoffId:prepared.handoff.handoffId}).ok,true);
 }
 const commands=[],voices=[];let voiceHandler=null;
 const runtime=createTrackerMissionExecutionRuntime({enabled:true,authorityManager:manager,getPilotId:()=> 'BUSH-PILOT',now:()=>now,random:()=>1,payloadSyncBeforeStart:completed,
  playBoardingVoice:r=>{voices.push(['boarding',r]);if(voiceHandler)return voiceHandler(r);return {...completed(),voiceOutcome:{schema:'ga.mission-voice-outcome.v1',kind:r.effect.payload.kind||'boarding',status:'ok',playback:'completed',text:r.effect.payload.fallbackText||'Hallo',speaker:{name:'Mia'}}};},playFarewellVoice:r=>{voices.push(['farewell',r]);return completed();}});
 const bridge=runtime.attachSimulator({getLivePosition:()=>({lat:48.3,lon:8.5,altFt:500,hdg:90}),dispatchCommand:c=>{commands.push(c);return c.type==='mission_scene_deboarding'?{ok:true,status:'pending'}:completed();},syncPayloadManifestState:completed,cleanupMission:completed});await settle();
 let serial=0;
 async function intent(intent,payload={},revision){const r=manager.getActiveRun();const out=await runtime.executeIntent({intent,payload,commandId:(restartFile?'restored-':'bush-')+(++serial),missionId:r.missionId,runId:r.runId,expectedRevision:revision??r.revision});await settle();return out;}
 async function sample(patch={}){now+=1000;const out=runtime.observeTelemetry({observedAt:now,lat:48,lon:8,altFt:500,aglFt:0,hdg:90,onGround:true,gsKts:0,slewActive:true,slewMode:true,isSlewActive:true,slewTelemetryStatus:'error',...patch});await settle();await runtime.flush();return out;}
 return {b,manager,runtime,bridge,intent,sample,commands,voices,storageFile,setVoiceHandler:fn=>voiceHandler=fn,advance:ms=>{now+=ms;}};
}
async function start(h){
 await h.sample();for(const action of ['prepare_mission','start_boarding']){const r=await h.intent(action);assert.equal(r.ok,true,JSON.stringify(r));}
 if(h.manager.getExecutionSnapshot().state.manifest.items.some(i=>i.id==='box')){const r=await h.intent('set_manifest_item',{itemId:'box',action:'load'});assert.equal(r.ok,true,JSON.stringify(r));}
 for(const action of ['sign_manifest','confirm_load','start_mission']){const r=await h.intent(action);assert.equal(r.ok,true,JSON.stringify(r));}
}

function chapters(b){
 const home={lat:48,lon:8},target={lat:48.3,lon:8.5},speaker={name:'Mia'};
 const frame=narrative.frame({start:home,target,passenger:speaker,features:[{id:'lake',name:'See',kind:'lake',lat:48.12,lon:8.2}]});
 const plan=narrative.validate({persona:'Herzlich',memory:'Geschichte',events:[{id:'first',kind:'fixed',atAirborneSeconds:90,text:'Eine Werkstattgeschichte.'},{id:'later',kind:'fixed',atAirborneSeconds:300,text:'Eine neue Geschichte.'},{id:'lake',kind:'geo',anchorId:'lake',radiusNm:1,text:'Ein Freund hat mir am See etwas erzählt.'}]},frame);
 assert.ok(plan);
 b.missionState.currentMissionData.bushNarrative=plan;
 Object.assign(b.executionEffectPlan.effects['voice.approach'].context,{bushNarrative:plan,audioEnabled:true,passenger:speaker,speaker,departure:home});
 b.executionReplay=execution.createExecutionBundle(b);b.execution=execution.createReplayShadowEnvelope(b.executionReplay,{legacyBundle:b});
}
test('Bush chapters fire from tracker telemetry, yield to pause/slew and retain claims on runtime reload',async t=>{
 const h=await harness(t,'bush_scenic_hopper',null,chapters);await start(h);
 const pos={lat:48.12,lon:8.2,onGround:false,gsKts:90,aglFt:1500,altFt:2000,slewActive:false,slewMode:false,isSlewActive:false};
 await h.sample({...pos,simPaused:true});assert.equal(h.voices.filter(v=>v[1].effect.payload.kind==='bush_story').length,0);
 await h.sample({...pos,slewActive:true});assert.equal(h.voices.filter(v=>v[1].effect.payload.kind==='bush_story').length,0);
 await h.sample(pos);assert.equal(h.voices.filter(v=>v[1].effect.payload.kind==='bush_story').length,1);
 const beforePause=h.manager.getExecutionRuntimeContext({missionId:h.b.missionId,runId:'bush-run'}).flightVoiceState.bushNarrative.airborneSeconds;
 await h.sample({...pos,simPaused:true});h.advance(120000);await h.sample({...pos,simPaused:true});await h.sample(pos);
 assert.equal(h.manager.getExecutionRuntimeContext({missionId:h.b.missionId,runId:'bush-run'}).flightVoiceState.bushNarrative.airborneSeconds,beforePause);
 assert.equal(h.manager.getExecutionSnapshot().state.effects.find(e=>e.payload.kind==='bush_story').payload.narrativeEventId,'lake');
 for(let i=0;i<101;i++)await h.sample({...pos,lat:48.05,lon:8.07});
 assert.equal(h.voices.filter(v=>v[1].effect.payload.kind==='bush_story').length,2);
 h.runtime.detachSimulator();
 const before=h.manager.getExecutionRuntimeContext({missionId:h.b.missionId,runId:'bush-run'}).flightVoiceState.bushNarrative;
 assert.deepEqual(before.done,['lake','first']);
 assert.equal(h.manager.getExecutionSnapshot().state.voice.bushChapters.length,2);
 assert.match(narrative.continuityHint(h.b.missionState.currentMissionData.bushNarrative,h.manager.getExecutionSnapshot().state.voice.bushChapters),/Eine Werkstattgeschichte/);
 const after=execution.normalizeState(h.manager.getExecutionSnapshot().state);assert.ok(after.effects.some(e=>e.payload.narrativeEventId==='first'));
});

test('central mission voice lane never overlaps simultaneous story and weather effects',async t=>{
 const h=await harness(t,'bush_scenic_hopper',null,chapters);await start(h);
 let active=0,peak=0,releases=[],played=[];
 h.setVoiceHandler(async r=>{active++;peak=Math.max(peak,active);played.push(r.effect.payload.kind);await new Promise(resolve=>releases.push(resolve));active--;return completed();});
 const adapter=createTrackerMissionExecutionAdapter({enabled:true,authorityManager:h.manager});
 for(const [i,kind] of ['bush_story','weather_preset'].entries()){
  assert.equal(adapter.applySystemEvent({missionId:h.b.missionId,runId:'bush-run',type:'APT_FLIGHT_VOICE_REQUESTED',eventId:'serial-'+i,payload:{kind,fallbackText:'Test',triggerAt:200000}}).ok,true);
 }
 h.runtime.detachSimulator();h.runtime.attachSimulator({getLivePosition:()=>({lat:48.1,lon:8.2}),dispatchCommand:completed,syncPayloadManifestState:completed});await settle();assert.deepEqual(played,['bush_story']);assert.equal(peak,1);
 releases.shift()();await settle();assert.deepEqual(played,['bush_story','weather_preset']);assert.equal(peak,1);
 releases.shift()();await settle();h.runtime.detachSimulator();
});


test('real Bush weather observation retains menu baseline, confirms after return and never speaks during slew',async t=>{
 const h=await harness(t,'bush_scenic_hopper',null,chapters);await start(h);
 const pos={lat:48.05,lon:8.07,onGround:false,gsKts:90,aglFt:1500,altFt:2000,slewActive:false,slewMode:false,isSlewActive:false,tempC:10,windKts:3,visKm:10};
 for(let i=0;i<10;i++)await h.sample(pos);
 await h.sample({...pos,inMenuOrMap:true,tempC:30});h.advance(30000);
 assert.equal(h.voices.filter(v=>v[1].effect.payload.kind==='weather_preset').length,0);
 for(let i=0;i<6;i++)await h.sample({...pos,tempC:30});
 assert.equal(h.voices.filter(v=>v[1].effect.payload.kind==='weather_preset').length,1);
 h.advance(120000);for(let i=0;i<10;i++)await h.sample({...pos,tempC:30});
 for(let i=0;i<6;i++)await h.sample({...pos,tempC:-12,slewActive:true});
 for(let i=0;i<6;i++)await h.sample({...pos,tempC:-12});
 assert.equal(h.voices.filter(v=>v[1].effect.payload.kind==='weather_preset').length,1);
 h.runtime.detachSimulator();
});
