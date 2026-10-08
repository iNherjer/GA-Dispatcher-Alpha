import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { declaration } from './gemini-migration-harness.mjs';
const source = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
const mission = id => ({currentMissionData:{missionId:id,title:`Auftrag ${id}`},mStory:'vollständiges Briefing'});
function fixture({draft=false, remote=mission('new'), offline=false}={}) {
 let pilot='TEST', epoch=1, busy=false;
 const values=new Map([['ga_active_mission',JSON.stringify(mission('old'))],['ga_sync_pending_upload_v1',JSON.stringify({pilotId:'TEST',generation:1})]]);
 const calls=[], notice={hidden:true,textContent:''};
 const env={window:{gaMissionDraftActive:()=>draft,gaDispatchGeneration:()=>epoch,gaIsDispatchBusy:()=>busy,
   gaResetMissionPresentation:()=>calls.push('presentation'),storeActiveMissionStateSafely:m=>{values.set('ga_active_mission',JSON.stringify(m));calls.push('store');return true;}},
 document:{getElementById:id=>id==='missionDraftCloudNotice'?notice:{checked:true,style:{},classList:{contains:()=>false}}},
 localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)},
 getSyncId:()=>pilot,Date,JSON,console:{warn(){},info(){}},setTimeout:()=>{throw Error('unexpected deferred upload');},clearTimeout:()=>calls.push('cancel-timer'),
 SYNC_PENDING_UPLOAD_KEY:'ga_sync_pending_upload_v1',activeMissionCloudSaveTimer:99,activeMissionCloudSavePromise:null,localSyncTime:0,
 _syncHomebasePull:async()=>calls.push('homebase-read'),_syncReadProfileResponse:async()=>{calls.push('profile-read');if(offline)throw Error('offline');return{ok:true,json:async()=>({activeMission:remote,_syncRevision:23,lastModified:123})};},
 _syncProfileIsNewer:()=>false,_syncActiveMissionPayload:()=>JSON.parse(values.get('ga_active_mission')||'null'),
 _syncActiveTrackerRunForCloudPull:()=>{throw Error('opening must not defer to old tracker');},
 _missionIsFreeflightOnly:()=>false,_syncActiveMissionIsExpired:()=>false,_syncMissionStateIsDraft:()=>false,
 _syncConfirmReplaceRunningLocalMission:()=>{throw Error('opening must not ask to replace app presentation');},
 restoreMissionState:async(m,o)=>{assert.equal(o.presentationOnly,true);assert.equal(o.resumeRuntime,false);calls.push('restore');return true;},
 _syncApplyOnboardEquipmentFromCloud:()=>calls.push('equipment'),_syncApplyFollowupsFromCloud:()=>{},
 setLastSyncedPayload:()=>calls.push('ack'),_syncScheduleLegacyPinboardCleanup:()=>{},updateGroupBadgeUI:()=>{},renderLog:()=>{},
 updateSyncStatus:()=>{},flashSyncIndicator:()=>{},currentMissionData:mission('old').currentMissionData,routeWaypoints:[],
 confirm:()=>{throw Error('unexpected confirm');},triggerCloudSave:()=>{throw Error('unexpected upload');}};
 const context=vm.createContext(env);
 for(const name of ['_syncMissionIdentityValues','_syncMissionStatesShareIdentity','_syncStoredAcceptedMission','_syncTrackerRestoreBlocked','_syncMissionRestoreBlocked','_syncDraftCloudNotice','_syncMissionTitleForPrompt','_syncClearPendingUpload','_syncReadPendingUpload','_syncRecordCloudMissionPullOutcome','_syncApplyActiveMissionFromCloud','silentSyncLoad','syncPendingUploadThenLoad'])vm.runInContext(declaration(source,name),context);
 return{env,context,values,calls,notice,epoch:()=>epoch++,pilot:()=>pilot='OTHER',busy:()=>busy=true,setDraft:v=>draft=v};
}
test('opening reads first and replaces old accepted mission even at an already known revision',async()=>{
 const f=fixture();assert.equal(await f.context.syncPendingUploadThenLoad(),true);
 assert.equal(JSON.parse(f.values.get('ga_active_mission')).currentMissionData.missionId,'new');
 assert.ok(f.calls.indexOf('profile-read')<f.calls.indexOf('store'));assert.equal(f.values.has('ga_sync_pending_upload_v1'),false);
 assert.equal(f.env.window.gaCloudOpeningPending,false);assert.equal(f.env.window.gaCloudMissionCheckedPilot,'TEST');
 assert.equal(f.context._syncTrackerRestoreBlocked(mission('old')),true);assert.equal(f.context._syncTrackerRestoreBlocked(mission('new')),false);
});
test('empty cloud clears accepted app mission and blocks resurrection from old tracker',async()=>{
 const f=fixture({remote:null});assert.equal(await f.context.syncPendingUploadThenLoad(),true);
 assert.equal(f.values.has('ga_active_mission'),false);assert.equal(f.env.currentMissionData,null);assert.ok(f.calls.includes('presentation'));
 assert.equal(f.context._syncTrackerRestoreBlocked(mission('old')),true);
});
test('open draft only reads cloud and shows the other activated mission without acknowledging or applying it',async()=>{
 const f=fixture({draft:true});const before=[...f.values];assert.equal(await f.context.syncPendingUploadThenLoad(),true);
 assert.deepEqual([...f.values],before);assert.deepEqual(f.calls,['cancel-timer','homebase-read','profile-read']);
 assert.equal(f.notice.hidden,false);assert.match(f.notice.textContent,/Auftrag new/);assert.equal(f.env.window.gaCloudMissionCheckedPilot,undefined);
});
test('draft notice uses mission identity rather than unrelated profile revision',async()=>{
 const f=fixture({draft:true,remote:mission('old')});await f.context.syncPendingUploadThenLoad();assert.equal(f.notice.hidden,true);assert.equal(f.notice.textContent,'');
});
test('draft receives notice when shared mission was cleared',async()=>{
 const f=fixture({draft:true,remote:null});await f.context.syncPendingUploadThenLoad();assert.match(f.notice.textContent,/entfernt/);assert.equal(f.values.has('ga_active_mission'),true);
});
for(const change of ['epoch','pilot','busy']) test(`late cloud response after ${change} change cannot overwrite mission or consume pending upload`,async()=>{
 const f=fixture();f.env._syncReadProfileResponse=async()=>{f[change]();return{ok:true,json:async()=>({activeMission:mission('late'),lastModified:9})};};
 await f.context.syncPendingUploadThenLoad();assert.equal(JSON.parse(f.values.get('ga_active_mission')).currentMissionData.missionId,'old');assert.equal(f.values.has('ga_sync_pending_upload_v1'),true);assert.ok(!f.calls.includes('ack'));
});
test('offline opening keeps accepted local mission and pending marker intact',async()=>{
 const f=fixture({offline:true});const before=[...f.values];await f.context.syncPendingUploadThenLoad();assert.deepEqual([...f.values],before);assert.equal(f.env.window.gaCloudOpeningPending,false);
});
test('simultaneous opening and visibility wake share one read',async()=>{
 const f=fixture();let release;f.env._syncReadProfileResponse=()=>new Promise(r=>release=r);
 const a=f.context.syncPendingUploadThenLoad(),b=f.context.syncPendingUploadThenLoad();assert.equal(f.context._syncTrackerRestoreBlocked(mission('old')),true);
 release({ok:true,json:async()=>({activeMission:mission('new'),lastModified:7})});await Promise.all([a,b]);assert.equal(f.calls.filter(x=>x==='restore').length,1);
});
