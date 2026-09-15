import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import voice from '../mission-poi-voice-core.js';
const frozen = fs.readFileSync(new URL('./fixtures/poi-actions-legacy-20260915.js', import.meta.url), 'utf8');
let count = 0;
for (const domain of voice.DOMAINS) for (const action of ['poi_status', 'poi_orientation'])
for (const detector of [{}, {inRadius:true,dwellSec:35}, {satisfied:true,dwellSec:120}, {aborted:true}])
for (const pos of [{}, {lat:48,lon:8}, {lat:48.29,lon:8.5}, {lat:48.3,lon:8.5}])
for (const mslFt of [undefined,2700,3100]) for (const fact of ['', 'Bestätigte Brücke am Fluss.'])
for (const map of ['', 'GROBER KARTENBEZUG: Brücke liegt 3 NM nördlich von Stadt.']) {
 const context = { schema:voice.CONTEXT_SCHEMA,version:1,missionId:'parity',taskDomain:domain,strict:true,
  audioEnabled:false,baseContext:'Original-Persona.',toneHint:' Deutsch.',passenger:{targetRadiusNm:1.5,targetDwellMin:2,targetAltFt:3000},
  missionData:{poiName:'Brücke'},mapPlaceOrientationLine:map,targetFacts:fact?[fact]:[] };
 const sample = {...pos,mslFt,hdg:0,windKts:20,visKm:8};
 const target = {lat:48.3,lon:8.5};
 let original;
 const sandbox = { window:{activePassenger:context.passenger,lastLiveGpsPos:sample,lastLiveFlightData:sample},
  currentMissionData:context.missionData,_activeMissionData:()=>context.missionData,_getDestCoords:()=>target,
  _isPOIMission:()=>true,_activeTaskDomain:()=>domain,_poiChainActiveSpec:()=>null,_poiChainProgressSummary:()=>'',
  _paxCityDatasetAvailable:()=>true,_paxMapPlaceOrientationLine:()=>map,_paxNearLandmarkOrientationLine:()=>fact?`NAHBEREICH-ZUSATZ: ${fact}`:'',
  _baseContext:()=>context.baseContext,_toneHint:()=>context.toneHint,
  _poiSatisfied:detector.satisfied===true,_poiAborted:detector.aborted===true,_poiInRadius:detector.inRadius===true,_poiDwellSec:detector.dwellSec||0,
  _missionActionSpeak:(prompt,label,fallbackText)=>{original={prompt:prompt||'',label,fallbackText};} };
 vm.createContext(sandbox);vm.runInContext(frozen,sandbox);
 if(action==='poi_status')sandbox._poiMissionStatusAction();else sandbox._poiMissionOrientationAction(true);
 assert.deepEqual(voice.renderAction(context,action,detector,sample,target),original);
 count++;
}
console.log(`PASS: ${count} frozen-original manual POI action comparisons (prompt, label, fallback).`);
