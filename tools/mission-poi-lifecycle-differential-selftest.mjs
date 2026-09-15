import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import lifecycle from '../mission-poi-lifecycle-core.js';
import voice from '../mission-poi-voice-core.js';
import location from '../mission-location-core.js';
const frozen=fs.readFileSync(new URL('./fixtures/poi-lifecycle-legacy-20260915.js',import.meta.url),'utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
let count=0;
for (const domain of voice.DOMAINS) for (const dwell of [0,2]) for(const progress of [{},{satisfied:true},{aborted:true},{manualConfirmed:true},{atTargetDone:true}])
for(const recorder of [{},{maxAglFt:199},{maxAglFt:200},{hadAirbornePhase:true},{airborneEvidenceSec:9},{airborneEvidenceSec:10}])
for(const position of [{lat:48,lon:8},{lat:48.3,lon:8.5},{lat:49,lon:9}])
for(const ground of [{onGround:false,gsKts:90},{onGround:true,gsKts:0},{onGround:true,gsKts:8},{onGround:true,gsKts:8,parkingBrake:true}]) {
  const recipe={taskDomain:domain,passenger:{targetDwellMin:dwell},trackingActive:true,target:{lat:48.3,lon:8.5},home:{lat:48,lon:8}};
  const sample={...position,...ground,aglFt:0};
  const state={hasSignal:true,trackingActive:true,...progress};
  const sandbox={window:{activePassenger:{taskDomain:domain},lastLiveFlightData:sample,lastLiveGpsPos:sample,
    GAMissionLocationCore:location,missionPoiRecipeId:()=>dwell===0?'poi_flyover':'poi_on_task'},
    currentMissionData:{missionContract:{taskDomain:domain}},flightRecorder:recorder,
    _missionSceneIsPoiMission:()=>true,_missionSceneIsBushMission:()=>false,_missionSceneIsSarHeliMission:()=>false,
    _missionPoiProgressState:()=>state,_aptArrivalPointForRuntime:()=>null,_missionBushReturnHomeRuntimePoint:()=>null,
    _targetPointForMission:()=>recipe.target,_distanceToMissionHomeNm:(lat,lon)=>location.haversineNm(lat,lon,48,8)};
  vm.createContext(sandbox);vm.runInContext(frozen,sandbox);
  const readiness=sandbox._missionEndReadiness();
  const endedAtHome=sandbox._missionPoiEndedAtHome(readiness);
  const freeEnd=sandbox._missionPoiGroundEndReady(readiness);
  const expected={readiness,flightEligible:sandbox._missionHasReachedEndEligibleFlightPhase(),canEndHere:readiness.ready||freeEnd,
    endedAtHome,needsRideHome:freeEnd&&!endedAtHome,status:sandbox._missionPoiRuntimeStatus(readiness),
    outcome:sandbox._missionOutcomeApplyPoiProgress(null,{endedAtHome,needsRideHome:freeEnd&&!endedAtHome})};
  assert.deepEqual(lifecycle.evaluate(recipe,progress,recorder,sample),clone(expected));count++;
}
let farewells=0;
for(const domain of voice.DOMAINS) for(const progress of [{},{satisfied:true},{aborted:true},{manualConfirmed:true}])
for(const failed of [false,true]) for(const needsRideHome of [false,true]) for(const protection of [false,true]) {
  const context={schema:voice.CONTEXT_SCHEMA,version:1,missionId:'parity',taskDomain:domain,strict:true,audioEnabled:false,
    passenger:{role:'Fachkraft',gTolerance:'niedrig',bankTolerance:'niedrig'},baseContext:'Originale Persona.',toneHint:' Deutsch.',
    motionProtectionEnabled:protection,professionalMeta:{},followUpDeboardingHint:' Folgeauftrag.',storyFocusSubject:'das Objekt'};
  const record={durationSec:720,distanceNm:20,maxAltFt:3300,maxBankDeg:48,maxGForce:1.8,maxDescentFpm:-1600,touchdownVsFpm:-550,
    missionFailed:failed,poiNeedsRideHome:needsRideHome,missionCargoOutcome:{status:failed?'failed':'completed',failed,
      missingRequired:[],droppedRequired:[],notDeliveredRequired:failed?['POI-Auftrag wurde nicht abgeschlossen.']:[],damagedRequired:[]}};
  const dynamic={record,poiProgress:progress,liveWeather:{windKts:25,windDeg:180,visKm:4},weatherMismatchHint:' Wetter-Abweichung.'};
  const sandbox={window:{activePassenger:context.passenger,lastLiveFlightData:dynamic.liveWeather,paxVoiceGetPoiMissionProgress:()=>progress},
    _missionHasPax:()=>true,_speakerSnapshotForActivePax:()=>context.speaker,_paxMissionAudioKey:kind=>kind+':'+context.missionId,
    _baseContext:()=>context.baseContext,_toneHint:()=>context.toneHint,_paxDebugMotionProtectionEnabled:()=>protection,
    _consumeWeatherMismatchEasteregg:()=>dynamic.weatherMismatchHint,_activeAptTrainingPlan:()=>null,
    _isPOIMission:()=>true,_poiAborted:progress.aborted===true,_bushPickupNarrativeHint:()=>'',_bushReconOutcomeHintLine:()=>'',
    _followUpDeboardingHintLine:()=>context.followUpDeboardingHint,_activeTaskDomain:()=>domain,
    _professionalRoleMeta:()=>context.professionalMeta,_activeMissionStoryFrame:()=>({focusSubject:context.storyFocusSubject})};
  vm.createContext(sandbox);vm.runInContext(frozen,sandbox);
  const prepared=sandbox._farewellPreparedContext(record);
  assert.deepEqual(voice.renderFarewell(context,dynamic),{prompt:prepared.prompt||'',text:prepared.text||'',fallbackText:''});farewells++;
}
console.log(`PASS: ${count} frozen-original lifecycle comparisons and ${farewells} exact farewell prompt/fallback comparisons.`);
let stressCases=0;
for (const protection of [false,true]) for(const previousDamage of [0,25,85])
for(const gForce of [1,1.45,2,4]) for(const bankDeg of [0,45,-65,90])
for(const vsFpm of [0,-1300,-2000]) for(const touchdownVsFpm of [0,-450,-900]) {
  const manifest={maxStressDamagePct:previousDamage,items:[
    {id:'camera',required:true,status:'loaded',healthPct:80},
    {id:'pax',itemType:'passenger',status:'loaded',healthPct:100},
    {id:'ground',status:'unloaded',healthPct:95}, {id:'missing',status:'pending',healthPct:100}]};
  const originalManifest=clone(manifest);
  const recorder={maxGForce:1.6,maxBankDeg:30,maxDescentFpm:-500};
  const sample={gForce,bankDeg,vsFpm};
  const record={touchdownVsFpm};
  const sandbox={window:{lastLiveFlightData:sample},flightRecorder:recorder,
    _missionDebugMotionProtectionEnabled:()=>protection,_missionCargoEnsureManifest:()=>originalManifest,_missionCargoPersistManifest:()=>{}};
  vm.createContext(sandbox);vm.runInContext(frozen,sandbox);
  assert.deepEqual(lifecycle.applyStress(manifest,recorder,sample,record,protection),clone(sandbox._missionCargoApplyStressSnapshot(record)));
  assert.equal(manifest.items[0].healthPct,80,'prewarm/stress input remains private');stressCases++;
}
console.log(`PASS: ${stressCases} frozen-original cargo stress comparisons.`);
