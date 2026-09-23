'use strict';

const execution = require('../mission-execution-core.js');
const poi = require('./tracker-mission-poi-runtime.js');
const voice = require('../mission-poi-voice-core.js');
const boarding = require('../mission-boarding-voice-core.js');

const missionId = 'training-integration';

function bundle() {
  const passenger = { name: 'Mia', targetRadiusNm: 1.2, targetAltFt: 3000, targetDwellMin: 0,
    taskDomain: 'training', trainingPlan: { mode: 'airwork', focus: ['Wenden'] } };
  const trainingCore = require('../mission-training-core.js').create({}, { now: () => 0 });
  const trainingRecipe = trainingCore.normalizeRecipe({ schema: 'ga.trainingRecipe.v1', key: 'training-integration-recipe',
    requiredCount: 1, minDepartureDistanceNm: 5,
    exercises: [
      { id: 'turn1', type: 'turn_180', targetBankDeg: 30, stableSec: 1 },
      { id: 'turn2', type: 'turn_180', targetBankDeg: 30, stableSec: 1 }
    ] });
  Object.assign(passenger, { trainingRecipe });
  const context = { schema: voice.CONTEXT_SCHEMA, version: 1, missionId, taskDomain: 'training', strict: true,
    audioEnabled: false, baseContext: 'Flugtraining im Übungsgebiet.', passenger, speaker: passenger,
    trainingRecipe, trainingPlan: passenger.trainingPlan, departure: { lat: 48, lon: 8 },
    routeWaypoints: [{ lat: 48, lon: 8 }, { lat: 48.3, lon: 8.5 }, { lat: 48, lon: 8 }] };
  const value = { version: 2, missionId, adapter: 'poi', descriptor: { primaryAdapter: 'poi' },
    executionPoiRecipe: { schema: poi.RECIPE_SCHEMA, version: 1, missionId, taskDomain: 'training',
      target: { lat: 48.3, lon: 8.5 }, home: { lat: 48, lon: 8 }, passenger, strict: true, trackingActive: true,
      trainingRecipe, lifecycle: { schema: require('../mission-poi-lifecycle-core.js').SCHEMA }, voiceContext: context },
    missionState: { currentMissionData: { missionId, missionType: 'poi', taskDomain: 'training', trainingRecipe,
      poiName: 'Übungsgebiet Süd', targetName: 'Übungsgebiet Süd', start: 'HOME', startLat: 48, startLon: 8,
      dest: 'Übungsgebiet Süd', passenger } },
    runtime: { missionId, startPhase: 'planned', lastLiveFlightData: { onGround: true, gsKts: 0 },
      runtime: { missionId, phase: 'planned', active: false }, cargoManifest: { version: 6,
        key: 'training-manifest', items: [
          { id: 'camera', label: 'Kamera', itemType: 'cargo', required: true, status: 'pending', weightLbs: 2, healthPct: 100 }
        ] } },
    executionEffectPlan: { schema: 'ga.mission-poi-effect-plan.v1', recipe: 'poi', missionId, sceneId: 'training-scene', effects: {
      'scene.prepare': { none: true }, 'scene.boarding': { none: true }, 'scene.deboarding': { none: true }, 'scene.target': { none: true },
      'voice.boarding': { recipe: boarding.createRecipe({ missionId, prompt: 'Bereit für das Training.', audioEnabled: false }) },
      'voice.approach': { context: { ...context, supported: true, mode: 'passenger' } },
      'voice.farewell': { poiContextRef: true }
    } } };
  value.executionReplay = execution.createExecutionBundle(value);
  value.execution = execution.createReplayShadowEnvelope(value.executionReplay, { sourceRevision: 0, legacyBundle: value });
  return value;
}

module.exports = { missionId, bundle };
