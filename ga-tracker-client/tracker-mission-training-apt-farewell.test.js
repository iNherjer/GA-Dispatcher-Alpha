'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const poiVoice = require('../mission-poi-voice-core.js');
const flight = require('../mission-training-flight-core.js');
const { createTrackerMissionFarewellVoice } = require('./tracker-mission-farewell-voice.js');

const missionId = 'apt-training-farewell';
const context = {
  schema: 'ga.mission-training-authority-context.v1', version: 1, missionId, missionMode: 'APT',
  taskDomain: 'training', strict: true, audioEnabled: false,
  baseContext: 'ROLLE: Mara (Fluglehrerin)\nAUSGABE: Nur gesprochener Text.',
  passenger: { name: 'Mara', role: 'Fluglehrerin', taskDomain: 'training', gTolerance: 'normal', bankTolerance: 'normal' },
  speaker: { name: 'Mara', role: 'Fluglehrerin', gender: 'female', taskDomain: 'training' },
  trainingPlan: { mode: 'airwork', trigger: 'half_route', focus: ['Steep Turns'] },
  missionData: { dest: 'EDTX' }, farewellCueId: 'none'
};
const progress = {
  exercises: [{ id: 'turn-1', label: 'Steilkurven', type: 'turn_180', status: 'complete',
    summary: { maxAltitudeDeviationFt: 42, rolloutHeadingErrorDeg: 2.5 } }]
};
const flightState = flight.createState({ eval: { active: true, samples: 8, minAltFt: 2400, maxAltFt: 2525,
  maxAbsBankDeg: 37, maxGForce: 1.42, maxClimbFpm: 420, maxDescentFpm: -610, aoaSamples: 3,
  maxAoaDeg: 12.4, stallEvents: 1 } });

function activeRun() {
  return {
    missionId, runId: 'apt-training-run', executionAuthority: 'tracker', executionRecipe: 'apt',
    resumeBundle: {
      executionTrainingRecipe: { missionId, voiceContext: context },
      executionEffectPlan: { effects: { 'voice.farewell': { trainingContextRef: true } } }
    }
  };
}

function request() {
  return { commandId: 'apt-training-farewell-effect', missionId, runId: 'apt-training-run',
    effect: { effectId: 'apt-training-farewell-effect', type: 'voice.farewell' } };
}

test('generator keeps the APT training farewell renderer aligned with the original prompt', () => {
  execFileSync(process.execPath, ['tools/generate-poi-voice-core.mjs', '--check'], { cwd: path.join(__dirname, '..') });
});

test('APT training farewell uses original evaluation and procedure facts without POI semantics', async () => {
  const requests = [];
  const handler = createTrackerMissionFarewellVoice({
    authorityManager: {
      getActiveRun: () => activeRun(),
      getExecutionSnapshot: () => ({ state: { trainingTask: { state: { flight: flightState, progress } } } })
    },
    voiceService: {
      publicState: () => ({ configured: true }),
      request: value => requests.push(value),
      wait: async () => ({ status: 'ready', audioAvailable: false, text: 'Danke fuer den Trainingsflug.', speaker: context.speaker })
    }
  });
  const result = await handler.dispatch({ ...request(), farewellDynamicContext: {
    record: { durationSec: 1800, distanceNm: 54.2, maxAltFt: 5000, poiNeedsRideHome: true },
    liveWeather: { windKts: 8, windDeg: 240, visKm: 20 }
  } });
  assert.equal(result.ok, true);
  assert.equal(result.voiceStatus, 'audio_disabled');
  assert.equal(requests.length, 1);
  assert.match(requests[0].prompt, /Trainingsdaten \(Übungsabschnitt\): Höhenvariation 125 ft, max Bank 37°, max G 1\.42g, max Steigen 420 ft\/min, max Sinken 610 ft\/min, max AOA 12\.4°, Stall-Events 1\./);
  assert.match(requests[0].prompt, /Trainingsprozedur: 1\/1 Uebungen sauber abgeschlossen\. Steilkurven: 42 ft Hoehenabweichung, Rollout 2\.5 Grad\./);
  assert.match(requests[0].prompt, /Da du hier als Instruktor unterwegs bist: Gib ein kurzes, konkretes Trainingsfazit/);
  assert.doesNotMatch(requests[0].prompt, /von hier noch nach Hause fliegen/);
});

test('APT training context is accepted only by the additive training renderer', () => {
  assert.equal(poiVoice.validateContext(context), 'poi_voice_context_identity_invalid');
  assert.equal(poiVoice.validateTrainingFarewellContext(context), null);
  assert.throws(() => poiVoice.renderFarewell(context, {}), /poi_voice_context_identity_invalid/);
});
