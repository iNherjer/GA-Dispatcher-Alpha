'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const voice = require('../mission-poi-voice-core');
const poi = require('./tracker-mission-poi-runtime');
const training = require('./tracker-mission-training-runtime');
const { bundle } = require('./tracker-mission-training-fixture');
function extract(source, name) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\nfunction ', start + 1);
  const block = source.slice(start, end < 0 ? undefined : end);
  return block.slice(0, block.lastIndexOf('\n}') + 2);
}
test('original App seed exports complete Training with no target scene and preserves recipe identity after key reordering', () => {
  const b = bundle(), recipe = b.executionPoiRecipe;
  const sandbox = { currentMissionData:b.missionState.currentMissionData, window:{activePassenger:recipe.passenger,
    missionTrainingProcedure:{getActiveRecipe:()=>recipe.trainingRecipe}, paxVoiceBuildPoiAuthorityContext:()=>recipe.voiceContext,
    paxVoiceGetPoiMissionProgress:()=>({trackingActive:true})},
    _activeMissionRuntimeId:()=>b.missionId, _targetPointForMission:()=>recipe.target, _missionHomePointForRuntime:()=>recipe.home,
    _safeCloneJson:v=>JSON.parse(JSON.stringify(v)), _buildMissionAptExecutionEffectPlan:()=>({effects:{}}),
    _missionTargetSceneKind:()=>{throw Error('training must not create target scene');} };
  vm.createContext(sandbox);
  vm.runInContext(extract(fs.readFileSync(path.join(__dirname,'../sync.js'),'utf8'),'_buildMissionPoiExecutionSeed'),sandbox);
  const seed=JSON.parse(JSON.stringify(sandbox._buildMissionPoiExecutionSeed()));
  assert.equal(poi.validateRecipe(seed.executionPoiRecipe),null);
  assert.deepEqual(seed.executionPoiRecipe.trainingRecipe,recipe.trainingRecipe);
  assert.deepEqual(seed.executionEffectPlan.effects['scene.target'],{none:true});
  // Object key ordering after transport must not revoke the same recipe.
  seed.executionPoiRecipe.voiceContext.trainingRecipe=Object.fromEntries(Object.entries(recipe.trainingRecipe).reverse());
  assert.equal(poi.validateRecipe(seed.executionPoiRecipe),null);
});
test('flat Tracker altitude feeds original training evaluation and final debrief', () => {
  const recipe=bundle().executionPoiRecipe;
  let state=training.createState(recipe);
  const sample={lat:48.3,lon:8.5,altFt:3000,aglFt:3000,bankDeg:0,gForce:1,gsKts:90,hdg:0,vsFpm:0,observedAt:10000};
  state=training.observe(recipe,state,sample).state;
  for (let i=1;i<8;i++) state=training.observe(recipe,state,{...sample,altFt:3100,observedAt:10000+i*1000}).state;
  assert.equal(training.summary(state.flight).altVar,100);
  const result=voice.renderFarewell(recipe.voiceContext,{record:{durationSec:600},poiProgress:{trainingSummary:training.summary(state.flight),trainingProcedure:state.progress}});
  assert.match(result.prompt,/Höhenvariation 100 ft/);
  assert.match(result.prompt,/Instruktor/);
});
