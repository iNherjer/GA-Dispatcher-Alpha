import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import voice from '../mission-poi-voice-core.js';
const frozen = fs.readFileSync(new URL('./fixtures/poi-actions-legacy-20260915.js', import.meta.url), 'utf8');
const frozenSurvey = fs.readFileSync(new URL('./fixtures/poi-actions-survey-legacy-20260922.js', import.meta.url), 'utf8');
const mappingVariants = [
  { name: 'scan-ready', spec: { type: 'scan', targetAltFt: 3200, scan: { lines: [{ id: 'L1' }, { id: 'L2' }, { id: 'L3' }] } }, progress: null },
  { name: 'scan-active', spec: { type: 'scan', targetAltFt: 3200, altitudeToleranceFt: 200, scan: { lines: [{ id: 'L1' }, { id: 'L2' }, { id: 'L3' }] } }, progress: { startedAt: 1, scan: { completedLineIds: ['L1'], active: { lineId: 'L2' }, activeCoverage: .5 } } },
  { name: 'scan-complete', spec: { type: 'scan', targetAltFt: 3200, scan: { lines: [{ id: 'L1' }, { id: 'L2' }] } }, progress: { startedAt: 1, satisfied: true, scan: { completedLineIds: ['L1', 'L2'] } } },
  { name: 'orbit-ready', spec: { type: 'orbit', targetAltFt: 2800, orbit: { requiredTurns: 3, radiusNm: .65 } }, progress: null },
  { name: 'orbit-active', spec: { type: 'orbit', targetAltFt: 2800, altitudeToleranceFt: 150, orbit: { requiredTurns: 4, radiusNm: .7 } }, progress: { startedAt: 1, orbit: { completedTurns: 2, active: true, activeCoverage: .75 } } },
  { name: 'orbit-complete', spec: { type: 'orbit', targetAltFt: 2800, orbit: { requiredTurns: 2, radiusNm: .6 } }, progress: { startedAt: 1, satisfied: true, orbit: { completedTurns: 2 } } }
];
let count = 0;
for (const domain of voice.DOMAINS) for (const action of ['poi_status', 'poi_orientation'])
for (const mapping of domain === 'mapping_survey' ? mappingVariants : [null])
for (const detector of [{}, {inRadius:true,dwellSec:35}, {satisfied:true,dwellSec:120}, {aborted:true}])
for (const pos of [{}, {lat:48,lon:8}, {lat:48.29,lon:8.5}, {lat:48.3,lon:8.5}])
for (const mslFt of [undefined,2700,3100]) for (const fact of ['', 'Bestätigte Brücke am Fluss.'])
for (const map of ['', 'GROBER KARTENBEZUG: Brücke liegt 3 NM nördlich von Stadt.']) {
 const context = { schema:voice.CONTEXT_SCHEMA,version:1,missionId:'parity',taskDomain:domain,knowledgeContext:domain==='sightseeing_tour'?{status:'accept',title:'Testobjekt',facts:['Ein regionales Testobjekt mit vielen markanten historischen Gebäudeteilen.']}:null,strict:true,
  audioEnabled:false,baseContext:'Original-Persona.',toneHint:' Deutsch.',passenger:{targetRadiusNm:1.5,targetDwellMin:2,targetAltFt:3000,...(mapping ? {surveyPattern:true} : {})},
  missionData:{poiName:'Brücke'},mapPlaceOrientationLine:map,targetFacts:fact?[fact]:[],surveySpec:mapping?.spec };
 const sample = {...pos,mslFt,hdg:0,windKts:20,visKm:8};
 const target = {lat:48.3,lon:8.5};
 let original;
 const sandbox = { window:{activePassenger:context.passenger,lastLiveGpsPos:sample,lastLiveFlightData:sample,
    missionSurveyPattern:{getActiveSpec:()=>mapping?.spec||null,snapshot:()=>mapping?.progress||null}},
  currentMissionData:context.missionData,_activeMissionData:()=>context.missionData,_getDestCoords:()=>target,
  _isPOIMission:()=>true,_activeTaskDomain:()=>domain,_poiChainActiveSpec:()=>null,_poiChainProgressSummary:()=>'',
  _paxCityDatasetAvailable:()=>true,_paxMapPlaceOrientationLine:()=>map,_paxNearLandmarkOrientationLine:()=>fact?`NAHBEREICH-ZUSATZ: ${fact}`:'',
  _baseContext:()=>context.baseContext,_toneHint:()=>context.toneHint,
  _poiSatisfied:detector.satisfied===true,_poiAborted:detector.aborted===true,_poiInRadius:detector.inRadius===true,_poiDwellSec:detector.dwellSec||0,
  _missionActionSpeak:(prompt,label,fallbackText)=>{original={prompt:prompt||'',label,fallbackText};},
  _paxSpeakTextDirect:(fallbackText,label)=>{original={prompt:'',label,fallbackText};} };
 vm.createContext(sandbox);vm.runInContext(frozen + frozenSurvey,sandbox);
 if(action==='poi_status')sandbox._poiMissionStatusAction();else sandbox._poiMissionOrientationAction(true);
 assert.deepEqual(voice.renderAction(context,action,{...detector,...(mapping ? {surveyProgress:mapping.progress} : {})},sample,target),original,
   `${domain}:${mapping?.name||'standard'}:${action}`);
 count++;
}
console.log(`PASS: ${count} frozen-original manual POI action comparisons (prompt, label, fallback).`);
