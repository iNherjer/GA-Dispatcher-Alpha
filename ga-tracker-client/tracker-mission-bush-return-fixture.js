'use strict';
const execution=require('../mission-execution-core.js');
const bush=require('../mission-bush-execution-core.js');
const pickupVoice=require('../mission-bush-pickup-voice-core.js');
const farewell=require('../mission-farewell-voice-core.js');
function bundle(profileId='bush_pickup_strip') {
 const missionId='bush-pickup-runtime-'+profileId, kind=profileId==='bush_pickup_cargo'?'cargo':'passenger';
 const home={kind:'airport',icao:'EDTW',lat:48,lon:8,name:'Home Base'};
 const target={kind:'airport',icao:'EDTF',lat:48.3,lon:8.5,name:'Remote Strip'};
 const spec={profileId,targetMode:'strip_then_return',completionMode:'return_home',requiresReturnHome:true,pickupKind:kind,allowedEndLocations:['home'],homeRef:home,targetRef:target,pickupLabel:'Radio relay case'};
 const story={personName:'Ava Reed',role:'Rangerin',exactWhere:'am Treffpunkt beim Hangar',whyThere:'hat Funkgeräte geprüft',returnReason:'die Basis braucht die Prüfnotizen',boardingCue:'Die Funkgeräte sind wieder ruhig.',departureCue:'Ich habe die Liste dabei.'};
 const passenger={name:'Ava Reed',role:'Rangerin',gender:'female',taskDomain:'bush_pickup_return',urgencyPriority:'normal'};
 const voiceContext={schema:pickupVoice.SCHEMA,version:1,missionId,pickupKind:kind,targetMode:spec.targetMode,requiresReturnHome:true,bush:spec,
  contract:{bush:spec,summary:'Remote pickup and return'},missionData:{missionId,start:target.name,dest:home.name,dist:37,story:'Ranger work and radio check.'},
  passenger:kind==='passenger'?passenger:null,cargoContext:kind==='cargo'?{start:target.name,dest:home.name,dist:'37',paxText:'1 PAX',cargoText:'Radio relay case',story:'Bring the relay case back.',contractSummary:'Remote pickup and return',taskDomain:'bush_pickup_return'}:null,
  baseContext:'Bush pickup return',toneHint:'Calm and personal.',speaker:kind==='passenger'?passenger:{name:'Lademeister',role:'Lademeister',gender:'male',taskDomain:'bush_pickup_return'},storyData:{...story,homePlace:home.name},storyAnchorLine:'STORY-ANKER: Ava Reed',betweenFlightsLine:'FOLLOW-UP-ZWISCHENZEIT: Arbeit draußen',cargoLabel:'Radio relay case',cargoFollowUpLine:'FOLLOW-UP-CARGO-STORY: supply return',weatherText:'',charterContinuation:false};
 const pickupBoarding=kind==='passenger'?{sceneId:'pickup-arrival',personPoint:{worldLat:48.3007,worldLon:8.5012},boardingConfig:{spawn:{forwardM:16,rightM:-8,altOffsetFt:0},target:{forwardM:4.5,rightM:8.5,altOffsetFt:0}},commonFields:{profile:'app_preset',aircraftSlot:'PA-24'}}:null;
 const items=kind==='passenger'?[{id:'pickup-person',itemType:'passenger',label:'Ava Reed',passengerCount:1,required:true,status:'pending',weightLbs:150,healthPct:100,pickupLocation:'target',deliverAtDestination:false,deliverAtHome:true},
  {id:'pickup-cargo',itemType:'cargo',label:'Radio relay case',required:true,status:'pending',weightLbs:18,healthPct:100,pickupLocation:'target',deliverAtDestination:false,deliverAtHome:true}]:[
  {id:'pickup-cargo',itemType:'cargo',label:'Radio relay case',required:true,status:'pending',weightLbs:18,healthPct:100,pickupLocation:'target',deliverAtDestination:false,deliverAtHome:true}];
 const approach={schema:'ga.mission-approach-context.v1',version:1,supported:true,missionId,audioEnabled:false,baseContext:'Bush pickup return',toneHint:'Calm.',mode:kind};
 const goodbye=farewell.createContext({missionId,key:missionId+'|farewell',missionAudioKey:missionId,supported:true,audioEnabled:false,mode:kind,baseContext:'Bush pickup return',toneHint:'Calm.',passenger:{name:'Ava Reed'},speaker:{name:'Ava Reed'},cargo:{label:'Radio relay case'},flight:{start:target.name,dest:home.name}});
 const effects={'scene.prepare':{none:true},'scene.boarding':{none:true},'voice.boarding':{none:true},'scene.deboarding':kind==='cargo'?{none:true}:{command:{type:'mission_scene_deboarding',sceneId:'home-scene',path:[{forwardM:5,rightM:8},{forwardM:15,rightM:-8}],vehicleDeparture:true,vehicleArrival:true,vehicleReturn:true}},
  'scene.arrival':{command:{type:'mission_scene_spawn',sceneId:'pickup-arrival',...target,altFt:500,hdg:90,items:[{kind:'vehicle',objectTitle:'Truck'}]}},'scene.bush_pickup_clear':{command:{type:'mission_scene_clear',sceneId:'bush-pickup-strip',reason:'pickup-confirmed'}},'voice.approach':{context:approach},'voice.farewell':{context:goodbye}};
 const plan={schema:'ga.mission-apt-effect-plan.v1',recipe:'apt',missionId,sceneId:'home-scene',bushPickup:{voiceContext,pickupBoarding},effects};
 const b={version:2,missionId,adapter:'bush_pickup',descriptor:{primaryAdapter:'bush_pickup'},missionState:{currentMissionData:{missionId,missionType:'bush',start:home.name,dest:target.name,targetName:target.name,targetLat:target.lat,targetLon:target.lon,bush:spec,routeWaypoints:[home,target],aptArrivalPlan:{...target,altFt:500,hdg:90}}},runtime:{missionId,startPhase:'planned',runtime:{missionId,phase:'planned',active:false},cargoManifest:{version:6,key:missionId+'-manifest',items}},executionBushRecipe:{schema:bush.SCHEMA,version:1,missionId,kind:'pickup_return',spec,location:{missionTarget:target,arrivalPoint:target},home,voiceContext,pickupBoarding},executionEffectPlan:plan};
 b.executionReplay=execution.createExecutionBundle(b);b.execution=execution.createReplayShadowEnvelope(b.executionReplay,{sourceRevision:0,legacyBundle:b});return b;
}
module.exports={bundle};
