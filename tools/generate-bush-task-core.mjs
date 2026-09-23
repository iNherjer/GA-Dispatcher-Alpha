import fs from 'node:fs';
import { extractOriginalFunction } from './extract-original-function.mjs';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const runtime=read('mission-runtime-core.js'), cargo=read('mission-cargo-core.js');
const sources=[runtime,cargo,read('sync.js')];
const extract=name=>extractOriginalFunction(sources.find(s=>s.includes(`function ${name}(`)),name);
const names=['_missionCargoIsPassengerItem','_missionBushAreaRef','_missionBushAreaDistanceNm','_missionBushIsPickupMission',
  '_missionBushPickupItems','_missionBushPickupLoadState','_missionBushPickupAtTargetNow','_missionBushPickupReadyForAction',
  '_missionBushUsesPoiTaskRecipe','_missionBushUpdateProgress','_missionBushEffectiveCompletionMode','_missionBushGroundEndReady'];
const functions=names.map(extract).join('\n\n');
const output=`// Generated from mission-runtime-core.js by tools/generate-bush-task-core.mjs.
// Keep app-owned state and geometry behind explicit evaluate() inputs.
(function(root, factory) {
  const api=factory(typeof module==='object'&&module.exports?require('./mission-manifest-core.js'):root.GAMissionManifestCore);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GAMissionBushTaskCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(manifestCore){
'use strict';
const PRODUCTION_PROFILE_IDS=Object.freeze(['bush_supply_strip','bush_charter_strip','bush_scenic_hopper','bush_pickup_strip','bush_pickup_cargo','bush_recon_return']);
function haversineNm(lat1,lon1,lat2,lon2){const p=Math.PI/180,dLat=(lat2-lat1)*p,dLon=(lon2-lon1)*p,a=Math.sin(dLat/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin(dLon/2)**2;return 2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))*3440.065;}
function evaluate(input={}){
  const spec=input.spec||null;let progress=input.progress&&typeof input.progress==='object'?{...input.progress}:null;
  const position=input.position||{};const endReady=input.endReady||{};
  if(!spec||!progress)return{progress,canEndHere:false,pickupReady:false};
  const window={lastLiveGpsPos:position};let poiProgress=input.poiProgress||null;
  const _activeBushMissionSpec=()=>spec;const _activeBushMissionProgress=()=>progress;
  const _persistBushMissionProgress=next=>{progress=next;};const _missionEndReadiness=()=>endReady;
  const _isAtMissionHome=()=>input.atHome===true;const _missionHasReachedEndEligibleFlightPhase=()=>input.endEligibleFlightPhase===true;
  const _missionCargoEnsureManifest=()=>input.manifest||{items:[]};
  const _missionCargoManifestCore=()=>manifestCore;
  const _isAtAptArrivalPoint=()=>input.atArrivalPoint===true;
  const _missionPoiTaskProgressState=()=>poiProgress;
  const _haversineNmLocal=haversineNm;
  const _missionSceneIsBushMission=()=>true;
${functions}
  _missionBushUpdateProgress(position.lat??null,position.lon??null,input.now);
  const pickupReady=_missionBushPickupReadyForAction();
  const canEndHere=_missionBushGroundEndReady(endReady);
  return{progress,canEndHere,pickupReady};
}
function isProductionSupported(spec){return PRODUCTION_PROFILE_IDS.includes(String(spec?.profileId||''));}
return Object.freeze({PRODUCTION_PROFILE_IDS,evaluate,isProductionSupported});
});
`;
const target=new URL('../mission-bush-task-core.js',import.meta.url);
if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8')!==output)throw new Error('Bush task core drifted from original App source');}
else fs.writeFileSync(target,output);
if(process.argv.includes('--freeze-reference')) {
  const referenceNames=['_missionBushAreaRef','_missionBushAreaDistanceNm','_missionBushIsPickupMission',
    '_missionBushPickupItems','_missionBushPickupLoadState','_missionBushPickupAtTargetNow','_missionBushPickupReadyForAction',
    '_missionBushUsesPoiTaskRecipe','_missionBushUpdateProgress','_missionBushEffectiveCompletionMode','_missionBushGroundEndReady'];
  const fixture=`// Frozen original App functions captured for Bush differential tests on 2026-09-23.\n`+
    `export const ORIGINAL_BUSH_FUNCTIONS = ${JSON.stringify(referenceNames.map(extract).join('\n\n'))};\n`;
  fs.mkdirSync(new URL('./fixtures/',import.meta.url),{recursive:true});
  fs.writeFileSync(new URL('./fixtures/bush-runtime-legacy-20260923.js',import.meta.url),fixture);
}
