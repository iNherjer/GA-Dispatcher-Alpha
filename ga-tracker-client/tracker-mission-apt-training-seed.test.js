'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { buildCloudMissionCandidate, CLOUD_MISSION_SEED_SCHEMA } = require('./tracker-mission-cloud.js');
const { bundle } = require('./tracker-mission-training-fixture.js');

function extract(source, name) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, end < 0 ? undefined : end);
}

test('APT training seed keeps the shared procedure in its dedicated APT recipe', () => {
  const source = fs.readFileSync(path.join(__dirname, '../sync.js'), 'utf8');
  const recipe = bundle().executionPoiRecipe;
  const context = {
    ...recipe.voiceContext,
    schema: 'ga.mission-training-authority-context.v1', missionId: 'apt-training-seed', missionMode: 'APT',
    routeWaypoints: [{ lat: 48, lon: 8 }, { lat: 48.2, lon: 8.3 }, { lat: 48, lon: 8 }],
    departure: { lat: 48, lon: 8 }, home: { lat: 48, lon: 8 }, target: { lat: 48, lon: 8 }
  };
  const sandbox = {
    window: { paxVoiceBuildTrainingAuthorityContext: id => id === 'apt-training-seed' ? context : null },
    _activeMissionRuntimeId: () => 'apt-training-seed',
    _safeCloneJson: value => JSON.parse(JSON.stringify(value))
  };
  vm.createContext(sandbox);
  vm.runInContext(extract(source, '_buildMissionAptTrainingExecutionSeed'), sandbox);
  const seed = JSON.parse(JSON.stringify(sandbox._buildMissionAptTrainingExecutionSeed()));
  assert.equal(seed.executionTrainingRecipe.schema, 'ga.mission-training-execution-recipe.v1');
  assert.equal(seed.executionTrainingRecipe.missionMode, 'APT');
  assert.deepEqual(seed.executionTrainingRecipe.trainingRecipe, context.trainingRecipe);
  assert.deepEqual(seed.executionTrainingRecipe.voiceContext.trainingRecipe, context.trainingRecipe);
  assert.deepEqual(seed.executionTrainingRecipe.home, context.home);
  assert.deepEqual(seed.executionTrainingRecipe.target, context.target);
});

test('cloud transport retains the APT training recipe without POI conversion', () => {
  const poiBundle = bundle();
  const recipe = poiBundle.executionPoiRecipe;
  const missionId = 'apt-training-cloud';
  const voiceContext = {
    ...recipe.voiceContext,
    schema: 'ga.mission-training-authority-context.v1', missionId, missionMode: 'APT',
    routeWaypoints: [{ lat: 48, lon: 8 }, { lat: 48.2, lon: 8.3 }, { lat: 48, lon: 8 }],
    departure: { lat: 48, lon: 8 }, home: { lat: 48, lon: 8 }, target: { lat: 48, lon: 8 }
  };
  const executionTrainingRecipe = {
    schema: 'ga.mission-training-execution-recipe.v1', version: 1, missionId, missionMode: 'APT',
    taskDomain: 'training', trainingRecipe: recipe.trainingRecipe, voiceContext,
    home: voiceContext.home, target: voiceContext.target
  };
  const profile = {
    activeMission: { currentMissionData: {
      missionId, missionTitle: 'APT Training', missionType: 'apt', start: 'HOME', dest: 'DEST',
      passenger: { ...recipe.passenger, taskDomain: 'training', trainingPlan: recipe.voiceContext.trainingPlan }
    } },
    activeMissionTrackerSeed: {
      schema: CLOUD_MISSION_SEED_SCHEMA, version: 1, missionId, adapter: 'apt', updatedAt: 1,
      executionTrainingRecipe,
      executionEffectPlan: {
        schema: 'ga.mission-apt-effect-plan.v1', version: 1, recipe: 'apt', missionId, sceneId: 'apt-training-scene',
        effects: { 'scene.prepare': { command: { type: 'mission_scene_spawn', sceneId: 'apt-training-scene', items: [{}] } },
          'scene.boarding': { command: { type: 'mission_scene_boarding', sceneId: 'apt-training-scene', path: [{}, {}] } } }
      }
    }
  };
  const result = buildCloudMissionCandidate(profile);
  assert.equal(result.status, 'ready', JSON.stringify(result));
  assert.equal(result.candidate.bundle.adapter, 'apt');
  assert.deepEqual(result.candidate.bundle.executionTrainingRecipe, executionTrainingRecipe);
  assert.equal(result.candidate.bundle.executionPoiRecipe, undefined);
});

test('APT gate rejects missing or cross-mission training data and leaves ordinary APT eligible', () => {
  const apt = require('./tracker-mission-apt-training.js');
  const value = require('./tracker-mission-apt-training-fixture.js').bundle();
  assert.equal(apt.validateBundle(value), null);
  const wrong = structuredClone(value);
  wrong.executionTrainingRecipe.voiceContext.missionId = 'another-mission';
  assert.equal(apt.validateBundle(wrong), 'apt_training_context_invalid');
  delete value.executionTrainingRecipe;
  assert.equal(apt.validateBundle(value), 'apt_training_recipe_missing');
  value.missionState.currentMissionData = {missionType:'apt',passenger:{taskDomain:'private_outing'}};
  assert.equal(apt.validateBundle(value),null);
});
