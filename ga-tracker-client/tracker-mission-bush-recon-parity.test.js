'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const bushTask=require('../mission-bush-task-core.js');
const poiTask=require('../mission-poi-task-core.js');
const poiVoice=require('../mission-poi-voice-core.js');
const poiRuntime=require('./tracker-mission-poi-runtime.js');
const followup=require('./tracker-mission-followup.js');
const {extractOriginalFunction}=require('../tools/extract-original-function.mjs');

const bushSpec={profileId:'bush_recon_return',recipeId:'poi_on_task_return',targetMode:'area_then_return',
  completionMode:'return_home',requiresReturnHome:true,allowedEndLocations:['home'],
  homeRef:{lat:48,lon:8,name:'Basis'},targetRef:{lat:48.3,lon:8.5,name:'Remote Strip'},
  areaRef:{lat:48.3,lon:8.5,radiusNm:1.5},success:{minAreaTimeSec:0,minAreaTrackNm:0}};
const outcome={schema:'ga.bushReconOutcome.v1',outcome:'minor_service',type:'minor_service',label:'Kleiner Servicebedarf',
  followUpKind:'bush_supply_strip',followUpLabel:'Bush Service Run',resultText:'Am Remote Strip ist eine kleine Bodenprüfung nötig.',
  revealAfter:'inspection_complete',hiddenFromWriter:true,createdAt:1000};
function voiceContext(){return {schema:poiVoice.CONTEXT_SCHEMA,version:1,missionId:'bush-recon-test',taskDomain:'inspection_infra',strict:false,
  baseContext:'Technischer Flugauftrag.',toneHint:'Ruhig und sachlich.',audioEnabled:false,
  passenger:{name:'Mia',role:'Technische Prüferin',taskDomain:'inspection_infra',targetRadiusNm:1.5,targetAltFt:1000,targetDwellMin:1},
  bush:bushSpec,bushReconOutcome:outcome,missionData:{missionType:'bush',targetName:'Remote Strip',bush:bushSpec,bushReconOutcome:outcome},
  followUpDeboardingHint:'Erwähne den späteren Materialflug nur als natürliche nächste Teamentscheidung.',
  speaker:{name:'Mia',gender:'female'},start:'Basis',dest:'Basis',flight:{depLabel:'Basis',arrLabel:'Basis'}};}
function originalBushProgress(input){
  const source=fs.readFileSync(path.join(__dirname,'../tools/fixtures/bush-runtime-legacy-20260923.js'),'utf8');
  const extracted=source.match(/export const ORIGINAL_BUSH_FUNCTIONS = (.*);\s*$/s);
  const functions=JSON.parse(extracted[1]);
  let progress={...input.progress};
  const window={lastLiveGpsPos:input.position};
  const context={window,Date,Number,Math,JSON,isFinite,flightRecorder:{hadAirbornePhase:true}};
  context._missionSceneIsBushMission=()=>true;context._activeBushMissionSpec=()=>input.spec;
  context._activeBushMissionProgress=()=>progress;context._persistBushMissionProgress=value=>{progress=value;};
  context._missionEndReadiness=()=>input.endReady;context._missionCargoEnsureManifest=()=>({items:[]});
  context._missionCargoIsPassengerItem=()=>false;context._isAtMissionHome=()=>input.atHome===true;
  context._isAtAptArrivalPoint=()=>false;context._missionHasReachedEndEligibleFlightPhase=()=>true;
  context._missionPoiTaskProgressState=()=>input.poiProgress;
  context._haversineNmLocal=(a,b,c,d)=>{const p=Math.PI/180,x=(c-a)*p,y=(d-b)*p,q=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;return 2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q))*3440.065;};
  vm.runInNewContext(functions,context);
  context._missionBushUpdateProgress(input.position.lat,input.position.lon,input.now);
  return {progress,canEndHere:context._missionBushGroundEndReady(input.endReady)};
}

test('Recon is an explicit POI recipe specialization and unrelated Bush profiles remain gated',()=>{
  const recipe={schema:'ga.mission-poi-execution-recipe.v1',version:1,missionId:'bush-recon-test',taskDomain:'inspection_infra',
    target:{lat:48.3,lon:8.5},home:{lat:48,lon:8},strict:false,trackingActive:true,
    passenger:{targetRadiusNm:1.5,targetAltFt:1000,targetDwellMin:1},voiceContext:voiceContext(),bush:bushSpec,
    lifecycle:{schema:'ga.mission-poi-lifecycle.v1'}};
  assert.equal(poiVoice.validateContext(recipe.voiceContext,recipe.missionId),null);
  assert.equal(poiRuntime.validateRecipe(recipe),null);
  const other={...recipe,bush:{...bushSpec,profileId:'bush_supply_strip',targetMode:'strip',completionMode:'unload_at_target',requiresReturnHome:false,allowedEndLocations:['target']}};
  assert.equal(poiRuntime.validateRecipe(other),'poi_recipe_bush_contract_invalid');
  const noVoiceBush={...recipe,voiceContext:{...recipe.voiceContext,bush:null,bushReconOutcome:null}};
  assert.equal(poiRuntime.validateRecipe(noVoiceBush),'poi_recipe_bush_voice_context_mismatch');
});

test('original POI dwell resolves Recon, Bush progress returns home only, and POI task outcome parity holds',()=>{
  const pax={targetRadiusNm:1.5,targetAltFt:1000,targetDwellMin:1};
  let poiState=poiTask.createState();
  let taskResult;
  for(let now=1000;now<=36000;now+=5000){
    taskResult=poiTask.observe(poiState,{pax,distNm:0,now,flightData:{mslFt:1000,gs:80,hdg:90},taskDomain:'inspection_infra',
      strict:false,etaMin:0,effectiveGs:80,clockPos:'12 Uhr',taskItemState:{blockingItems:[],reason:'ok'}});
    poiState=taskResult.state;
  }
  assert.equal(poiState.satisfied,true);
  const poiProgress={hasSignal:true,trackingActive:true,satisfied:poiState.satisfied,aborted:poiState.aborted,
    manualConfirmed:poiState.manualConfirmed,atTargetDone:poiState.atTargetDone,dwellSec:poiState.dwellSec,attempts:poiState.attempts};
  const atTarget={spec:bushSpec,progress:{status:'on_task'},manifest:{items:[]},position:{lat:48.3,lon:8.5},now:36000,
    endReady:{atTarget:true,groundStill:false},atHome:false,atArrivalPoint:false,poiProgress};
  const actual=bushTask.evaluate(atTarget);
  const expected=originalBushProgress(atTarget);
  assert.deepEqual({...actual.progress},{...expected.progress});
  assert.equal(actual.progress.status,'return_leg');
  const awayStop=bushTask.evaluate({...atTarget,progress:actual.progress,endReady:{atTarget:true,groundStill:true}});
  assert.equal(awayStop.canEndHere,false,'Recon task completion does not authorize an away landing');
  const homeStop=bushTask.evaluate({...atTarget,progress:awayStop.progress,position:{lat:48,lon:8},atHome:true,
    endReady:{atTarget:false,groundStill:true,onGround:true,gs:0}});
  const homeExpected=originalBushProgress({...atTarget,progress:awayStop.progress,position:{lat:48,lon:8},atHome:true,
    endReady:{atTarget:false,groundStill:true,onGround:true,gs:0}});
  assert.deepEqual({...homeStop.progress},{...homeExpected.progress});
  assert.equal(homeStop.progress.status,'ready_to_close');
  assert.equal(homeStop.canEndHere,true);
});

test('original Recon outcome reaches farewell prompt and follow-up builder; POI memory retains the spoken result',()=>{
  const context=voiceContext();
  const originalSource=fs.readFileSync(path.join(__dirname,'../passenger-voice.js'),'utf8');
  const sandbox={currentMissionData:context.missionData};
  vm.createContext(sandbox);
  vm.runInContext([extractOriginalFunction(originalSource,'_activeBushReconOutcome'),
    extractOriginalFunction(originalSource,'_bushReconOutcomeHintLine')].join('\n'),sandbox);
  const hint=sandbox._bushReconOutcomeHintLine('farewell');
  const farewell=poiVoice.renderFarewell(context,{record:{simulated:true,durationSec:600,distanceNm:42,maxAltFt:3500}},{entry:'Der Recon wurde vor Ort aufgenommen.'});
  assert.ok(farewell.prompt.includes(hint));
  assert.ok(farewell.prompt.includes(outcome.resultText));
  assert.ok(farewell.prompt.includes('Erwähne den späteren Materialflug'));
  const memory=poiVoice.captureMemory({},'Zielgebiet','Der Recon über Remote Strip hat die Markierung und Zufahrt geprüft.','inspection_infra');
  assert.match(memory.entry,/Recon über Remote Strip/);

  const now=1000000;
const mission={missionId:'bush-recon-test',missionType:'bush',_appliedProfile:'bush_recon_return',start:'XHOM',bush:{...bushSpec,homeRef:{...bushSpec.homeRef,icao:'XHOM'},targetRef:{...bushSpec.targetRef,icao:'XSTR'}},
    passenger:{name:'Mia',role:'Technische Prüferin',taskDomain:'inspection_infra'},bushReconOutcome:outcome};
  const completed=followup.createForCompletedRun({missionId:mission.missionId,executionAuthority:'tracker',
    resumeBundle:{missionState:{currentMissionData:mission}}},
    {phase:'closed',flags:{closed:true,groundStill:true},cargo:{summary:{failed:false}},
      flight:{missionRecord:{createdAt:now,missionCargoOutcome:{failed:false}},destination:{atDestination:true}}},now);
  assert.equal(completed.requests.length,1,JSON.stringify(completed));
  assert.equal(completed.requests[0].sourceKind,'bush_recon_return');
  assert.equal(completed.requests[0].followUpKind,'bush_supply_strip');
  assert.equal(completed.requests[0].reconOutcome.outcome,'minor_service');
});
