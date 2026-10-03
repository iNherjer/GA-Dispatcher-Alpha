const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const voice=require('../mission-route-voice-core.js');
function harness(){
 const c=vm.createContext({window:{},compactPoiChainForMission:x=>x});
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
 const idea={schema:'sightseeing-idea.v1',narrativeEvents:voice.events(events),visits:[{placeId:'place',factIds:['fact'],place:{id:'place',lat:48.5,lon:8,source:'fixture',name:'Ort',facts:[{id:'fact',text:'Belegte Beschreibung'}]}}],passenger:{name:'Ada'},memory:'Zusammenfassung'};
 const state={currentMissionData:{id:'m',sightseeingIdea:idea,missionStory:'Geschichte'},activeMissionContract:{id:'m',sightseeingIdea:idea},routeWaypoints:[{lat:48,lon:8},{lat:49,lon:8}]};
 const local=clone(c.compactActiveMissionStateForQuotaStorage(state));
 assert.deepEqual(local.currentMissionData.sightseeingIdea,idea);
 for(const level of [1,2,3]){
  const downloaded=clone(c._syncCompactActiveMission(local,level));
  const restored=clone(c.compactActiveMissionStateForQuotaStorage(downloaded));
  assert.deepEqual(restored.currentMissionData.sightseeingIdea,idea);
  assert.deepEqual(restored.activeMissionContract.sightseeingIdea,idea);
  const runtime=voice.observe(events,state.routeWaypoints,{}, {now:100000,lat:48.3,lon:8,active:true,onGround:false,enabled:true});
  const transferred=clone({missionState:downloaded,runtime:{missionId:'m',runtime:{routeVoice:runtime.state}}});
  const next=voice.observe(transferred.missionState.currentMissionData.sightseeingIdea.narrativeEvents,state.routeWaypoints,transferred.runtime.runtime.routeVoice,{now:200000,lat:48.3,lon:8,active:true,onGround:false,enabled:true});
  assert.equal(next.event,null,'claimed event must not replay after transfer');
 }
});

test('POI sightseeing local group and personal narrative survive all cloud compact levels',()=>{
 const c=harness();
 const knowledgeBriefing={schema:'knowledge-briefing.v1',idea:{profileId:'sightseeing_tour',storyLine:'mixed',focus:'Lokale Baugeschichte'},knowledgeFacts:[{id:'landmark-0-0',fact:'Belegter Ortsfakt',source:'https://example.org/Ort'}],observationPlaces:[{name:'Ort',lat:48.51,lon:8.01,source:'https://example.org/Ort',facts:[{text:'Belegter Ortsfakt'}]}]};
 const knowledgeContext={status:'accept',facts:[{text:'Belegter Ortsfakt'}],extraFacts:[{text:'Weiteres Detail',source:'https://example.org/Ort'}]};
 knowledgeBriefing.knowledgeContext=knowledgeContext;
 const state={currentMissionData:{id:'poi',knowledgeBriefing,knowledgeContext,missionStory:'Bevorstehender Flug'},activeMissionContract:{id:'poi',knowledgeBriefing,knowledgeContext},routeWaypoints:[{lat:48,lon:8},{lat:48.5,lon:8}]};
 for(const level of [1,2,3]){
  const restored=clone(c.compactActiveMissionStateForQuotaStorage(clone(c._syncCompactActiveMission(c.compactActiveMissionStateForQuotaStorage(state),level))));
  assert.deepEqual(restored.currentMissionData.knowledgeBriefing,knowledgeBriefing);
  assert.deepEqual(restored.activeMissionContract.knowledgeBriefing,knowledgeBriefing);
  assert.deepEqual(restored.currentMissionData.knowledgeBriefing.knowledgeContext,knowledgeContext);
  const paxEnv=vm.createContext({window:{},currentMissionData:restored.currentMissionData});
  const code=fs.readFileSync('passenger-voice.js','utf8'),start=code.indexOf('function _activePoiKnowledgeContext('),end=code.indexOf('\nfunction ',start+1);
  vm.runInContext(code.slice(start,end),paxEnv);
  assert.deepEqual(clone(paxEnv._activePoiKnowledgeContext()),knowledgeContext);
 }
});
