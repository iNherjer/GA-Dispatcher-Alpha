import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { declaration } from './gemini-migration-harness.mjs';
const sync=fs.readFileSync(new URL('../sync.js',import.meta.url),'utf8'),app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function fixture(){
 const values=new Map(), writes=[], messages=[];let busy=false,epoch=0,mission={missionId:'new-bush',missionType:'bush'},confirmCount=0;
 const env={window:{gaIsDispatchBusy:()=>busy,gaDispatchGeneration:()=>epoch},localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>{values.set(k,String(v));writes.push(k);},removeItem:k=>values.delete(k)},getSyncId:()=> 'TEST',document:{getElementById:()=>({checked:true})},console:{error(){},warn(){}},Date,JSON,setTimeout:()=>0,clearTimeout:()=>{},SYNC_PENDING_UPLOAD_KEY:'pending',localSyncTime:1,lastSyncedPayloadStr:'',updateSyncStatus:s=>messages.push(s),queueActiveMissionCloudSave:()=>{},setNavComLed:()=>{},flashSyncIndicator:()=>{},_syncHomebasePush:async()=>({ok:true}),_syncActiveMissionPayload:()=>mission,_syncTrackerMissionSeedPayload:m=>({missionId:m.missionId}),_syncFreeflightNavigationPayload:()=>null,_missionLogbookForSync:()=>['local-log'],getGroupName:()=> 'local-group',getGroupNick:()=> 'nick',getAircraftPresetsForSync:()=>[],_syncOnboardEquipmentPayload:()=>[],_syncFollowupPayload:()=>[],_syncPayloadComponentChars:()=>({}),confirm:()=>{confirmCount++;return false;}};
 const context=vm.createContext(env);
 for(const name of ['_syncMissionIdentityValues','_syncMissionStatesShareIdentity','_syncStoredAcceptedMission','_syncTrackerRestoreBlocked','_syncLocalMissionChoiceKey','_syncLocalMissionChoice','_syncSetLocalMissionChoice','_syncMissionRestoreBlocked','_syncReadPendingUpload','_syncMarkPendingUpload','_syncClearPendingUpload','triggerCloudSave'])vm.runInContext(declaration(sync,name),context);
 env.window.gaMissionExternalRestoreBlocked=context._syncMissionRestoreBlocked;
 return {env,context,values,writes,messages,setBusy:v=>busy=v,next:()=>epoch++,setMission:v=>mission=v,confirms:()=>confirmCount};
}
test('generation and stale generation block external restore across mission families',async()=>{
 for(const family of ['bush','poi','apt']){
  const f=fixture();vm.runInContext(declaration(app,'restoreMissionState'),f.context);f.setBusy(true);
  assert.equal(await f.context.restoreMissionState({missionType:family},{source:'tracker-execution-observer'}),false);
  assert.equal(await f.context.restoreMissionState({missionType:family},{source:'cloud'}),false);assert.equal(f.writes.length,0);
  f.setBusy(false);const epoch=0;f.next();assert.equal(f.context._syncMissionRestoreBlocked(epoch),true);
 }
});
test('local file restoration begun before generation cannot commit after generation finishes',async()=>{
 const f=fixture();vm.runInContext(declaration(app,'restoreMissionState'),f.context);let resolve;
 f.env.window.resolveActiveMissionStorageState=()=>new Promise(r=>resolve=r);
 const result=f.context.restoreMissionState({localStorageFallbackId:'old'},{source:'cloud'});
 f.setBusy(true);f.next();f.setBusy(false);resolve({missionType:'poi'});
 assert.equal(await result,false);assert.equal(f.writes.length,0);
});
test('delayed tracker snapshot cannot write after a new generation',async()=>{
 const f=fixture();let resolve;f.env.window.lastTrackerMissionAuthority={activeRun:{missionId:'old-poi',runId:'old-run'}};
 Object.assign(f.env,{_trackerSupportsMissionAuthority:()=>true,_missionAuthorityClientId:()=> 'browser',_sendMissionAuthorityRequest:()=>new Promise(r=>resolve=r)});
 const start=sync.indexOf('window.resumeTrackerMissionOnThisDevice = async function('),end=sync.indexOf('\n};',start);
 vm.runInContext(sync.slice(start,end+3),f.context);const result=f.env.window.resumeTrackerMissionOnThisDevice();
 f.next();f.setBusy(true);f.setBusy(false);resolve({status:'ok',authoritativeRun:{missionId:'old-poi',runId:'old-run'},resumeBundle:{}});
 assert.equal(await result,false);assert.equal(f.writes.length,0);
});
test('busy cloud and tracker ingress do not mutate the mission',async()=>{
 const f=fixture();f.setBusy(true);
 for(const name of ['_syncApplyActiveMissionFromCloud','_applyTrackerExecutionControl']){vm.runInContext(declaration(sync,name),f.context);assert.equal(await f.context[name]({missionId:'old'}),false);}
 assert.equal(f.writes.length,0);
});







test('delayed cloud idle/silent responses cannot commit after a generation finished',async()=>{
 for(const name of ['checkCloudAfterIdle','silentSyncLoad']){
  const f=fixture();let resolve;Object.assign(f.env,{idleCheckInProgress:false,_syncHomebasePull:async()=>({ok:true}),_syncReadProfileResponse:()=>new Promise(r=>resolve=r)});
  vm.runInContext(declaration(sync,name),f.context);const result=f.context[name]();
  f.next();f.setBusy(true);f.setBusy(false);resolve({ok:true,json:async()=>({lastModified:9,activeMission:{missionId:'old'}})});
  await result;assert.equal(f.writes.length,0);
 }
});
test('manual cloud download is blocked during generation before asking or fetching',async()=>{
 const f=fixture();f.setBusy(true);vm.runInContext(declaration(sync,'forceSyncLoad'),f.context);await f.context.forceSyncLoad();assert.equal(f.confirms(),0);assert.equal(f.writes.length,0);
});





test('local draft blocks every mission ingress and cloud upload until accepted or rejected',async()=>{
 const f=fixture();f.env.window.gaMissionDraftActive=()=>true;
 for(const family of ['bush','poi','apt']) assert.equal(f.context._syncMissionRestoreBlocked(null,{missionId:family}),true);
 const result=await f.context.triggerCloudSave(true,{skipHomebase:true});
 assert.equal(result.reason,'local-mission-draft');assert.equal(f.writes.length,0);assert.equal(f.confirms(),0);
});
test('confirmed mission-only updates preserve profile data with revision CAS',async()=>{
 const f=fixture();let sent,opts;
 f.context._syncSetLocalMissionChoice('shared',{missionOnly:true});
 f.env._syncProfileClient=()=>({read:async()=>({migrated:true,revision:7,profile:{activeMission:{missionId:'new-bush'},logbook:['remote'],groupName:'remote'}}),write:async(p,o)=>{sent=p;opts=o;return{revision:8,lastModified:123};}});
 const result=await f.context.triggerCloudSave(true,{skipHomebase:true});assert.equal(result.ok,true);
 assert.equal(sent.activeMission.missionId,'new-bush');assert.deepEqual(sent.logbook,['remote']);assert.equal(sent.groupName,'remote');assert.equal(opts.expectedRevision,7);assert.equal(opts.force,false);
});
test('mission-only update cancels if generation completed during cloud read',async()=>{
 const f=fixture();let writes=0;f.context._syncSetLocalMissionChoice('shared',{missionOnly:true});
 f.env._syncProfileClient=()=>({read:async()=>{f.next();return{migrated:true,revision:7,profile:{}};},write:async()=>writes++});
 const result=await f.context.triggerCloudSave(true,{skipHomebase:true});assert.equal(result.reason,'mission-changed-during-upload');assert.equal(writes,0);
});

for (const remote of [{missionId:'other-apt'},null]) test(`old accepted mission cannot replace ${remote ? 'a new Cloud mission' : 'a cleared Cloud slot'} with a freshly read revision`,async()=> {
 const f=fixture();let writes=0;f.context._syncSetLocalMissionChoice('shared',{missionOnly:true});
 f.env._syncProfileClient=()=>({read:async()=>({migrated:true,revision:23,profile:{activeMission:remote}}),write:async()=>writes++});
 const result=await f.context.triggerCloudSave(true,{skipHomebase:true});assert.equal(result.reason,'cloud-mission-replaced');assert.equal(writes,0);
});

test('an upload delayed by local full-snapshot resolution stops when opening cloud reconciliation begins',async()=> {
 const f=fixture();f.values.set('ga_active_mission',JSON.stringify({localStorageFallbackId:'backup'}));let release,writes=0;
 f.env.window.resolveActiveMissionStorageState=()=>new Promise(r=>release=r);f.env._syncProfileClient=()=>({write:async()=>writes++});
 const result=f.context.triggerCloudSave(true,{skipHomebase:true});f.env.window.gaCloudOpeningPending=true;release({missionId:'old'});
 assert.equal((await result).reason,'mission-changed-during-upload');assert.equal(writes,0);
});
