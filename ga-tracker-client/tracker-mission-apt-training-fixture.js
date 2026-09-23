'use strict';
const source = require('./tracker-mission-training-fixture.js');
const execution = require('../mission-execution-core.js');
function bundle() {
  const b = source.bundle();
  const r = b.executionPoiRecipe;
  b.adapter = 'apt'; b.descriptor.primaryAdapter = 'apt';
  Object.assign(b.missionState.currentMissionData, {missionType:'apt', dest:'DEST', destLat:48.6, destLon:9});
  const voiceContext = {...r.voiceContext, schema:'ga.mission-training-authority-context.v1', missionMode:'APT',
    missionData:b.missionState.currentMissionData, target:{lat:48.6,lon:9},home:r.home,
    routeWaypoints:[r.home,{lat:48.6,lon:9}]};
  b.executionTrainingRecipe = {schema:'ga.mission-training-execution-recipe.v1',version:1,missionId:b.missionId,
    missionMode:'APT',taskDomain:'training',home:r.home,target:voiceContext.target,trainingRecipe:r.trainingRecipe,voiceContext};
  delete b.executionPoiRecipe;
  b.executionEffectPlan.schema = 'ga.mission-apt-effect-plan.v1'; b.executionEffectPlan.recipe = 'apt';
  b.executionEffectPlan.effects['scene.prepare'] = {command:{type:'mission_scene_spawn',sceneId:'training-scene',items:[{kind:'person_boarder_1',objectTitle:'Tarmac_Male'}]}};
  b.executionEffectPlan.effects['scene.boarding'] = {command:{type:'mission_scene_boarding',sceneId:'training-scene',path:[{forwardM:16,rightM:-8},{forwardM:4,rightM:8}]}};
  b.executionEffectPlan.effects['voice.farewell'] = {trainingContextRef:true};
  b.executionReplay = execution.createExecutionBundle(b);
  b.execution = execution.createReplayShadowEnvelope(b.executionReplay,{sourceRevision:0,legacyBundle:b});
  return b;
}
module.exports = {missionId:source.missionId,bundle};
