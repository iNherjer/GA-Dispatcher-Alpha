import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import core from '../mission-comfort-core.js';
import {extractOriginalFunction} from './extract-original-function.mjs';
const source=fs.readFileSync(new URL('../passenger-voice.js',import.meta.url),'utf8');
const original=['_createMissionComfortScore','_missionComfortScoreState','_cargoMissionFocus','_missionScoreRegisterEvent','_recordMissionComfortSample','_missionComfortSummary'].map(n=>extractOriginalFunction(source,n)).join('\n');
let cases=0;
for(const cargoText of ['', 'Kamera', 'Wartungsunterlagen']) for(const protection of [false,true]) {
 const context={cargoText,paxText:'1 PAX',missionData:{},taskDomain:'inspection_infra',motionProtectionEnabled:protection};
 const sandbox={Date:{now:()=>1000},_missionComfortScore:null,_activeMissionData:()=>context.missionData,
 _activeTaskDomain:()=>context.taskDomain,_activeCargoText:()=>cargoText,_activePaxText:()=>context.paxText,
 _paxDebugMotionProtectionEnabled:()=>protection};
 vm.createContext(sandbox);vm.runInContext(original,sandbox);
 let state=null;
 for(let i=0;i<100;i++) {
  const sample={gForce:[1,1.7,1.9,1.9,1][i%5],bankDeg:[0,34,46,0][i%4],vsFpm:i%3?-2500:0,
   windKts:i%4?35:0,windGustKts:52,turbulencePct:i%2?80:0,precipRateMmH:i%3?5:0};
  sandbox._recordMissionComfortSample(sample);
  const actual=core.evaluate(state,sample,context,1000);state=JSON.parse(JSON.stringify(actual.state));
  assert.deepEqual(actual.summary,JSON.parse(JSON.stringify(sandbox._missionComfortSummary())));cases++;
 }
}
console.log(`Original comfort parity: ${cases} samples, edge counting, serialized restore, debug protection`);
