'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const lifecycle = require('../mission-poi-lifecycle-core.js');
const voice = require('../mission-poi-voice-core.js');
const { bundle } = require('./tracker-mission-training-fixture.js');
const clean = () => ({status:'completed',failed:false,missingRequired:[],droppedRequired:[],damagedRequired:[],notDeliveredRequired:[]});
function evaluate(requiredComplete, cargo = clean(), away = true) {
  const recipe = bundle().executionPoiRecipe;
  const progress = {satisfied:requiredComplete,trainingProcedure:{requiredComplete,completedCount:requiredComplete?1:0,requiredCount:1,exercises:[]}};
  const result = lifecycle.evaluate(recipe,progress,{hadAirbornePhase:true},{lat:away?49:48,lon:8,gsKts:0,aglFt:0,onGround:true},cargo);
  return {recipe,progress,result};
}
function farewell(value) {
  return voice.renderFarewell(value.recipe.voiceContext, {poiProgress:value.progress,cargoOutcome:value.result.outcome,
    record:{missionCargoOutcome:value.result.outcome,missionFailed:value.result.outcome.failed,poiNeedsRideHome:value.result.needsRideHome}});
}
test('unfinished training at an alternate airport reports exercises, not missing cargo', () => {
  const value = evaluate(false);
  assert.equal(value.result.canEndHere,true);
  assert.equal(value.result.needsRideHome,true);
  assert.equal(value.result.outcome.failed,true);
  assert.deepEqual(value.result.outcome.notDeliveredRequired,[]);
  assert.deepEqual(value.result.outcome.taskFailureReasons,['Pflichtübungen wurden nicht abgeschlossen.']);
  const rendered = farewell(value);
  const text = rendered.text || rendered.fallbackText;
  assert.match(text,/Pflichtübungen.*nicht abgeschlossen/);
  assert.match(text,/Startplatz zurück/);
  assert.doesNotMatch(text,/Ladung|Einsatzleitung|Bodenkraefte/);
});
test('completed training at another airport succeeds, without changing cargo requirements', () => {
  const value = evaluate(true);
  assert.equal(value.result.canEndHere,true);
  assert.equal(value.result.outcome.failed,false);
  assert.deepEqual(value.result.outcome.taskFailureReasons,[]);
  const damaged = evaluate(true,{...clean(),failed:true,status:'failed',damagedRequired:['Headset']});
  assert.equal(damaged.result.outcome.failed,true);
  assert.deepEqual(damaged.result.outcome.damagedRequired,['Headset']);
  const text = farewell(damaged).text;
  assert.match(text,/Pflichtübungen sind abgeschlossen/);
  assert.match(text,/Beschädigte Ausrüstung: Headset/);
  assert.doesNotMatch(text,/Einsatzleitung|Bodenkraefte/);
});
test('training normalizes old synthetic task failures without removing a real undelivered item', () => {
  const value = evaluate(true,{...clean(),failed:true,status:'failed',notDeliveredRequired:['POI-Auftrag wurde nicht abgeschlossen.','Unterlagen']});
  assert.equal(value.result.outcome.failed,true);
  assert.deepEqual(value.result.outcome.notDeliveredRequired,['Unterlagen']);
  assert.match(farewell(value).text,/Noch nicht entladene Ausrüstung: Unterlagen/);
});
test('generic POI keeps its existing task outcome contract', () => {
  const recipe = bundle().executionPoiRecipe;
  recipe.taskDomain='media_photo'; delete recipe.trainingRecipe;
  const value = lifecycle.evaluate(recipe,{satisfied:false},{hadAirbornePhase:true},{lat:49,lon:8,gsKts:0,onGround:true},clean());
  assert.deepEqual(value.outcome.notDeliveredRequired,['POI-Auftrag wurde nicht abgeschlossen.']);
  assert.equal(value.outcome.taskFailureReasons,undefined);
});
