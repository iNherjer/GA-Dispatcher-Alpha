'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const {createForCompletedRun,service,mergeRequests}=require('./tracker-mission-followup.js');
const privateCore=require('../mission-private-return-core.js');
const now=Date.now();const copy=x=>JSON.parse(JSON.stringify(x));
const mission={missionId:'outing',missionType:'apt',mission:'Ausstellung',start:'EDTW',dest:'EDTF',initialStartLat:48.27,initialStartLon:8.42,initialTargetLat:48.02,initialTargetLon:7.83,
 passenger:{name:'Sina',role:'Schwester',taskDomain:'private_outing'},privateOuting:{schema:'private-outing.v1',taskDomain:'private_outing',occasion:'Ausstellung',companion:{name:'Sina',relationship:'Schwester'},luggage:{label:'Tasche'}}};
function completed() {return {phase:'closed',flags:{closed:true,groundStill:true},cargo:{summary:{failed:false}},flight:{missionRecord:{createdAt:now,durationSec:600,telemetrySampleCount:100,distanceNm:20,distanceSource:'gps'},destination:{atDestination:true}}};}
test('private followup requires real completion evidence and has the original route/person/id',()=>{
 const run={missionId:'outing',executionAuthority:'tracker',resumeBundle:{missionState:{currentMissionData:mission}}};
 const result=createForCompletedRun(run,completed(),now);assert.equal(result.requests.length,1);assert.equal(result.requests[0].id,'private-return-outing');
 assert.equal(result.requests[0].passenger.name,'Sina');assert.equal(result.requests[0].route.homeRef.icao,'EDTW');
 for(const modify of [c=>c.flight.missionRecord.distanceSource='planned',c=>c.flight.destination.atDestination=false,c=>c.flight.missionRecord.distanceNm=0,c=>c.cargo.summary.failed=true]) {const c=completed();modify(c);assert.equal(createForCompletedRun(run,c,now).requests.length,0);}
 assert.throws(()=>createForCompletedRun(run,{...completed(),phase:'active'},now),/unconfirmed/);
 const dismissed={...result.requests[0],status:'dismissed',updatedAt:now+1000};
 assert.equal(mergeRequests([dismissed],result.requests,now+2000)[0].status,'dismissed');
});
test('headless service produces the same private request as the frozen original App module',()=>{
 class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const storage=new Map();const c={Date:Clock,console,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))},document:{readyState:'loading',addEventListener(){},getElementById(){return null;}},setTimeout(){},MissionPrivateReturnCore:{...privateCore,request:(md,record)=>privateCore.request(md,record,now)}};c.window=c;vm.createContext(c);
 vm.runInContext(fs.readFileSync(require.resolve('../tools/fixtures/followup-legacy-20260916.js'),'utf8'),c);
 const record={missionId:'outing',completionId:'done',endedAt:now,result:'completed',privateOutingEvidence:{flown:true,atTarget:true,groundStill:true}};
 c.missionFollowupMaybeCreateFromCompletedMission(copy(mission),{failed:false},{completionRecord:record});
 const api=service([],now);api.create(copy(mission),{failed:false},{completionRecord:record});
 assert.deepEqual(copy(api.requests()),copy(c.missionFollowupGetForSync()));
});


test('completion and followup outbox commit atomically, survive restart, and remain pilot-scoped', t => {
 const os=require('node:os'),path=require('node:path');
 const {createMissionAuthorityManager}=require('./mission-authority-core.js');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'followup-atomic-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const storageFile=path.join(dir,'authority.json');let fail=false;
 const options={storageFile,executionAuthorityEnabled:true,now:()=>now,fs:{...fs,renameSync(...args){if(fail)throw Error('disk unavailable');return fs.renameSync(...args);}}};
 let manager=createMissionAuthorityManager(options);
 manager.acquire({missionId:'outing',clientId:'app',resumeBundle:{missionState:{currentMissionData:mission}}});
 const stored=JSON.parse(fs.readFileSync(storageFile,'utf8'));
 stored.activeRun.executionAuthority='tracker';
 stored.activeRun.executionState={phase:'closed',flags:{closed:true,groundStill:true},effects:[],manifest:{items:[]}};
 // A charter followup exercises the same completion transaction without private-flight proof fixtures.
 stored.activeRun.resumeBundle.missionState.currentMissionData={...mission,privateOuting:null,_appliedProfile:'apt_charter',passenger:{name:'Sina',taskDomain:'apt_charter'}};
 fs.writeFileSync(storageFile,JSON.stringify(stored));manager=createMissionAuthorityManager(options);
 fail=true;assert.equal(manager.finalizeExecutionRun({pilotId:'PILOT'}).ok,false);
 assert.ok(manager.getActiveRun());assert.deepEqual(manager.getFollowupOutbox('PILOT'),[]);
 fail=false;assert.equal(manager.finalizeExecutionRun({pilotId:'PILOT'}).ok,true);
 assert.equal(manager.getFollowupOutbox('PILOT').length,1);
 manager=createMissionAuthorityManager(options);assert.equal(manager.getActiveRun(),null);
 const entry=manager.getFollowupOutbox('PILOT')[0];assert.ok(entry);
 assert.deepEqual(manager.getFollowupOutbox('OTHER'),[]);
 manager.acknowledgeFollowupOutbox(entry.id,'OTHER');assert.equal(manager.getFollowupOutbox('PILOT').length,1);
 fail=true;assert.equal(manager.acknowledgeFollowupOutbox(entry.id,'PILOT'),false);
 assert.equal(manager.getFollowupOutbox('PILOT').length,1);
 fail=false;assert.equal(manager.acknowledgeFollowupOutbox(entry.id,'PILOT'),true);
 manager=createMissionAuthorityManager(options);assert.deepEqual(manager.getFollowupOutbox('PILOT'),[]);
});

test('infrastructure completion preserves the seeded finding and original followup family',()=>{
 for(const [outcome,kind] of [['clear',null],['monitor','infra_recheck'],['minor_damage','infra_damage_mapping'],['blocked_access','infra_damage_mapping']]) {
  const md={...copy(mission),missionType:'poi',privateOuting:null,_appliedProfile:'inspection_infra',poiName:'Strommast',passenger:{name:'Sina',taskDomain:'inspection_infra'},infraInspectionOutcome:{outcome,createdAt:now-10000}};
  const run={missionId:md.missionId,executionAuthority:'tracker',resumeBundle:{missionState:{currentMissionData:md}}};
  const result=createForCompletedRun(run,completed(),now);
  assert.equal(result.requests.length,kind?1:0,outcome);
  if(kind){assert.equal(result.requests[0].followUpKind,kind);assert.equal(result.requests[0].infraInspectionOutcome?.outcome||result.requests[0].narrativeMemory?.infraInspectionOutcome?.outcome,outcome);}
 }
});
