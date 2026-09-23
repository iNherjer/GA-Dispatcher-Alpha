'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {setTimeout:delay}=require('node:timers/promises');
const execution=require('../mission-execution-core.js');
const {bundle}=require('./tracker-mission-bush-fixture.js');
const {createTrackerMissionProcess}=require('./tracker-mission-process.js');

const completed=()=>({ok:true,status:'completed',sideEffect:false});
async function until(predicate,message='condition did not become true'){
  for(let n=0;n<400;n++){if(predicate())return;await delay(10);}
  assert.fail(message);
}

test('Bush supply strip stays in the real mission process; restart restores task state but requires fresh ground telemetry',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'bush-mission-process-'));
  const storageFile=path.join(directory,'authority.json');
  const b=bundle('bush_supply_strip');
  let host=null;
  const createHost=()=>createTrackerMissionProcess({enabled:true,pilotId:'bush-process-test',flightLogDirectory:directory,
    authority:{storageFile,executionAuthorityEnabled:true,poiExecutionEnabled:true},
    playBoardingVoice:completed,playFarewellVoice:completed});
  t.after(async()=>{try{await host?.close();}finally{fs.rmSync(directory,{recursive:true,force:true});}});
  host=await createHost();
  assert.notEqual(host.runtime.publicState().processId,process.pid);
  const acquired=await host.authorityManager.acquire({missionId:b.missionId,clientId:'app',stateHash:'bush-app-state',resumeBundle:b});
  assert.equal(acquired.ok,true,JSON.stringify(acquired));
  let run=acquired.activeRun;
  const prepared=await host.authorityManager.prepareExecutionAuthority({missionId:b.missionId,runId:run.runId,clientId:'app',
    expectedRevision:run.revision,expectedStateHash:run.stateHash,expectedExecutionStateHash:execution.replay(b.executionReplay).stateHash});
  assert.equal(prepared.ok,true,JSON.stringify(prepared));
  const committed=await host.authorityManager.commitExecutionAuthority({missionId:b.missionId,runId:run.runId,clientId:'app',
    expectedRevision:prepared.activeRun.revision,expectedExecutionStateHash:prepared.activeRun.executionStateHash,handoffId:prepared.handoff.handoffId});
  assert.equal(committed.ok,true,JSON.stringify(committed));
  host.runtime.attachSimulator({getLivePosition:()=>({lat:48,lon:8,altFt:500,hdg:90}),dispatchCommand:completed,
    syncPayloadBeforeStart:completed,syncPayloadManifestState:completed,cleanupMission:completed});
  await until(()=>host.runtime.publicState().simulatorAttached);

  async function telemetry(patch={}){
    const observedAt=Date.now();
    host.runtime.observeTelemetry({observedAt,lat:48,lon:8,altFt:500,aglFt:0,hdg:90,onGround:true,gsKts:0,...patch});
    await until(()=>!host.runtime.publicState().telemetry.inFlight&&!host.runtime.publicState().telemetry.pending,'worker telemetry did not settle');
    await host.runtime.flush();
    return observedAt;
  }
  let serial=0;
  async function intent(name,payload={}){
    run=host.authorityManager.getActiveRun();
    return host.runtime.executeIntent({intent:name,payload,commandId:`bush-process-${++serial}`,
      missionId:run.missionId,runId:run.runId,expectedRevision:run.revision});
  }
  async function settleEffects(){await until(()=>host.runtime.publicState().effects.pendingEffects.length===0,'mission effects did not settle');}

  await telemetry();
  for(const action of ['prepare_mission','start_boarding']){
    const result=await intent(action);assert.equal(result.ok,true,JSON.stringify(result));await settleEffects();
  }
  let result=await intent('set_manifest_item',{itemId:'box',action:'load'});
  assert.equal(result.ok,true,JSON.stringify(result));await settleEffects();
  for(const action of ['sign_manifest','confirm_load','start_mission']){
    result=await intent(action);assert.equal(result.ok,true,JSON.stringify(result));await settleEffects();
  }
  assert.equal(host.authorityManager.getExecutionSnapshot().state.flags.started,true);

  await telemetry({lat:48.05,lon:8.08,altFt:1800,aglFt:1300,onGround:false,gsKts:90});
  await delay(2100);
  await telemetry({lat:48.18,lon:8.3,altFt:2400,aglFt:1900,onGround:false,gsKts:85});
  await telemetry({lat:48.3,lon:8.5,altFt:700,aglFt:200,onGround:false,gsKts:35});
  await telemetry({lat:48.3,lon:8.5,altFt:500,aglFt:0,onGround:true,gsKts:0});
  await telemetry({lat:48.3,lon:8.5,altFt:500,aglFt:0,onGround:true,gsKts:0});
  let snapshot=host.authorityManager.getExecutionSnapshot();
  assert.equal(snapshot.state.bushTask.progress.status,'ready_to_close',JSON.stringify(snapshot.state.bushTask));
  assert.equal(snapshot.state.bushTask.canEndHere,true);
  assert.ok(['end_unloading','end_ready'].includes(snapshot.state.phase),snapshot.state.phase);
  const workerPid=host.runtime.publicState().processId;
  assert.notEqual(workerPid,process.pid);
  assert.equal(host.authorityManager.getActiveRun().runId,run.runId);

  await host.close();
  host=await createHost();
  await until(()=>host.runtime.publicState().processAvailable);
  snapshot=host.authorityManager.getExecutionSnapshot();
  assert.equal(host.runtime.publicState().processId===workerPid,false,'restart must create a new mission process');
  assert.equal(host.authorityManager.getActiveRun().runId,run.runId);
  assert.equal(snapshot.state.bushTask.progress.status,'ready_to_close');
  assert.equal(snapshot.state.bushTask.canEndHere,true);
  assert.ok(['end_unloading','end_ready'].includes(snapshot.state.phase),snapshot.state.phase);
  host.runtime.attachSimulator({getLivePosition:()=>({lat:48.3,lon:8.5,altFt:500,hdg:90}),dispatchCommand:completed,
    syncPayloadManifestState:completed,cleanupMission:completed});
  await until(()=>host.runtime.publicState().simulatorAttached);
  result=await intent('set_manifest_item',{itemId:'box',action:'unload'});
  assert.equal(result.error,'bush_fresh_telemetry_required',JSON.stringify(result));
  assert.equal(host.authorityManager.getExecutionSnapshot().state.bushTask.progress.status,'ready_to_close');

  await telemetry({lat:48.3,lon:8.5,altFt:500,aglFt:0,onGround:true,gsKts:0});
  result=await intent('set_manifest_item',{itemId:'box',action:'unload'});
  assert.equal(result.ok,true,JSON.stringify(result));
  await settleEffects();
  assert.equal(host.runtime.publicState().processAvailable,true);
  assert.equal(host.authorityManager.getActiveRun().runId,run.runId);
  snapshot=host.authorityManager.getExecutionSnapshot();
  assert.equal(snapshot.state.manifest.items.find(item=>item.id==='box').status,'unloaded');
});
