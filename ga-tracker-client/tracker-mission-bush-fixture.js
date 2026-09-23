'use strict';
const execution=require('../mission-execution-core.js');
const bush=require('../mission-bush-execution-core.js');
const boarding=require('../mission-boarding-voice-core.js');
const farewell=require('../mission-farewell-voice-core.js');
function bundle(profile='bush_supply_strip') {
 const missionId='bush-test', home={kind:'airport',icao:'EDTW',lat:48,lon:8,name:'Basis'}, target={kind:'airport',icao:'EDTF',lat:48.3,lon:8.5,name:'Zielstrip'};
 const spec={profileId:profile,targetMode:'strip',completionMode:bush.PROFILES[profile],requiresReturnHome:false,allowedEndLocations:['target'],homeRef:home,targetRef:target};
 const passenger=profile!=='bush_supply_strip';
 const cargo=profile!=='bush_scenic_hopper';
 const items=[...(cargo?[{id:'box',itemType:'cargo',label:'Versorgung',required:true,deliverAtDestination:true,status:'pending',weightLbs:12,healthPct:100}]:[]),
 ...(passenger?[{id:'pax',itemType:'passenger',label:'Gast',passengerCount:1,required:true,deliverAtDestination:profile==='bush_charter_strip',status:'pending',weightLbs:150,healthPct:100}]:[])];
 const path=[{forwardM:16,rightM:-8},{forwardM:4.5,rightM:8.5}];
 const voice=farewell.createContext({missionId,key:missionId+'|farewell',missionAudioKey:missionId,supported:true,audioEnabled:false,mode:passenger?'passenger':'cargo',baseContext:'Bush-Auftrag am Zielstrip.',toneHint:'Ruhig und persönlich.',passenger:{name:'Mia'},speaker:{name:'Mia'},cargo:{label:'Versorgung'},flight:{start:'Basis',dest:'Zielstrip'}});
 const b={version:2,missionId,adapter:'bush_pickup',descriptor:{primaryAdapter:'bush_pickup'},
  missionState:{currentMissionData:{missionId,missionType:'bush',start:'HOME',dest:'STRIP',targetName:target.name,targetLat:target.lat,targetLon:target.lon,bush:spec,routeWaypoints:[home,target],aptArrivalPlan:{...target,altFt:500,hdg:90}}},
  runtime:{missionId,startPhase:'planned',runtime:{missionId,phase:'planned',active:false},cargoManifest:{version:6,key:'bush-manifest',items}},
  executionBushRecipe:{schema:bush.SCHEMA,version:1,missionId,kind:'strip_target',spec,location:{missionTarget:target,arrivalPoint:target}},
  executionEffectPlan:{schema:'ga.mission-apt-effect-plan.v1',recipe:'apt',missionId,sceneId:'bush-scene',effects:{
   'scene.prepare':{command:{type:'mission_scene_spawn',sceneId:'bush-scene',items:[{kind:'vehicle',objectTitle:'Truck'}]}},
   'scene.boarding':{command:{type:'mission_scene_boarding',sceneId:'bush-scene',boarderCount:passenger?1:0,path}},
   'scene.deboarding':{command:{type:'mission_scene_deboarding',sceneId:'bush-scene',boarderCount:passenger?1:0,path}},
   'scene.arrival':{command:{type:'mission_scene_spawn',sceneId:'bush-arrival',...target,altFt:500,hdg:90,items:[{kind:'vehicle',objectTitle:'Truck'}]}},
   'voice.boarding':{recipe:boarding.createRecipe({missionId,prompt:'Bereit für den Bush-Flug.',audioEnabled:false})},
   'voice.approach':{context:{schema:'ga.mission-approach-context.v1',version:1,supported:true,missionId,audioEnabled:false,baseContext:voice.baseContext,toneHint:voice.toneHint,mode:passenger?'passenger':'cargo'}},
   'voice.farewell':{context:voice}
  }}};
 if(!passenger)delete b.executionEffectPlan.effects['voice.approach'];
 b.executionReplay=execution.createExecutionBundle(b);b.execution=execution.createReplayShadowEnvelope(b.executionReplay,{sourceRevision:0,legacyBundle:b});return b;
}
module.exports={bundle};
