const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const voice=require('../mission-route-voice-core.js');
function harness(){
 const c=vm.createContext({compactPoiChainForMission:x=>x});
 for(const [file,names] of [
 ['app.js',['compactMissionObjectForQuotaStorage','slimMissionObjectForActiveState','compactRouteWaypointsForQuotaStorage','compactAltWaypointsForQuotaStorage','compactSegmentAltsForQuotaStorage','compactElevationDataForQuotaStorage','compactFreqCacheForQuotaStorage','compactTextForQuotaStorage','compactPassengerForQuotaStorage','compactActiveMissionStateForQuotaStorage']],
 ['sync.js',['_syncJsonClone','_syncCompactMissionObjectCore','_syncStripDeepMissionPlans','_syncCompactFlightDataState','_syncCompactActiveMission']]]){
  const code=fs.readFileSync(file,'utf8');
  for(const name of names){const a=code.indexOf('function '+name+'(');assert.ok(a>=0,name);const b=code.indexOf('\nfunction ',a+1);vm.runInContext(code.slice(a,b),c);}
 }
 return c;
}
const clone=x=>JSON.parse(JSON.stringify(x));
for(const count of [0,1,2,3])test(`local quota and all cloud levels preserve ${count} narrative events and anchors`,()=>{
 const c=harness();
 const events=[{atPercent:20,intent:'Gespräch A'},{geo:{anchorId:'place',lat:48.5,lon:8,radiusNm:2},intent:'Gespräch B'},{atPercent:80,intent:'Gespräch C'}].slice(0,count);
 const idea={schema:'club-idea.v1',narrativeEvents:voice.events(events),geoAnchors:[{id:'place',lat:48.5,lon:8,source:'fixture',name:'Ort'}],passenger:{name:'Ada'},memory:'Zusammenfassung'};
 const state={currentMissionData:{id:'m',clubIdea:idea,missionStory:'Geschichte'},activeMissionContract:{id:'m',clubIdea:idea},routeWaypoints:[{lat:48,lon:8},{lat:49,lon:8}]};
 const local=clone(c.compactActiveMissionStateForQuotaStorage(state));
 assert.deepEqual(local.currentMissionData.clubIdea,idea);
 for(const level of [1,2,3]){
  const downloaded=clone(c._syncCompactActiveMission(local,level));
  const restored=clone(c.compactActiveMissionStateForQuotaStorage(downloaded));
  assert.deepEqual(restored.currentMissionData.clubIdea,idea);
  assert.deepEqual(restored.activeMissionContract.clubIdea,idea);
  const runtime=voice.observe(events,state.routeWaypoints,{}, {now:100000,lat:48.3,lon:8,active:true,onGround:false,enabled:true});
  const transferred=clone({missionState:downloaded,runtime:{missionId:'m',runtime:{routeVoice:runtime.state}}});
  const next=voice.observe(transferred.missionState.currentMissionData.clubIdea.narrativeEvents,state.routeWaypoints,transferred.runtime.runtime.routeVoice,{now:200000,lat:48.3,lon:8,active:true,onGround:false,enabled:true});
  assert.equal(next.event,null,'claimed event must not replay after transfer');
 }
});
