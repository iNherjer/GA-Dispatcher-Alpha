'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const farewellVoiceCore = require('../mission-farewell-voice-core.js');
const { createTrackerMissionFarewellVoice } = require('./tracker-mission-farewell-voice.js');

function activeRun(recipe = {}) {
  return {
    missionId: 'mission-farewell',
    runId: 'run-farewell',
    executionAuthority: 'tracker',
    resumeBundle: {
      executionEffectPlan: {
        schema: 'ga.mission-apt-effect-plan.v1',
        effects: {
          'voice.farewell': {
            recipe: farewellVoiceCore.createRecipe({
              missionId: 'mission-farewell',
              prompt: 'Verabschiede dich beim Piloten.',
              speaker: { name: 'Mara', role: 'Passagier', gender: 'female' },
              cueId: 'deboarding_pax',
              missionAudioKey: 'farewell:mission-farewell',
              ...recipe
            })
          }
        }
      }
    }
  };
}

function authorityContext(overrides = {}) {
  return farewellVoiceCore.createContext({
    missionId: 'mission-farewell',
    missionAudioKey: 'farewell:mission-farewell',
    key: 'farewell:mission-farewell',
    mode: 'passenger',
    baseContext: 'ROLLE: Mara (Fotografin)\nAUSGABE: Nur gesprochener Text.',
    taskDomain: 'charter',
    speaker: { name: 'Mara', role: 'Fotografin', gender: 'female', taskDomain: 'charter' },
    passenger: { role: 'Fotografin', gTolerance: 'niedrig', bankTolerance: 'niedrig' },
    aptFarewellHint: 'Wir stehen am Vorfeld; dort wartet der Abholer.',
    playCue: true,
    cueId: 'deboarding_pax',
    ...overrides
  });
}

function activeRunWithContext(context, recipe = {}) {
  const run = activeRun({ prompt: 'Veralteter Prompt aus dem Handoff.', ...recipe });
  run.resumeBundle.executionEffectPlan.effects['voice.farewell'].context = context;
  return run;
}

function request() {
  return {
    commandId: 'mfx-farewell',
    missionId: 'mission-farewell',
    runId: 'run-farewell',
    effect: { effectId: 'mfx-farewell', type: 'voice.farewell' }
  };
}

test('farewell uses one selected-device job with the App deboarding cue before TTS', async () => {
  const requests = [];
  let playbackWaits = 0;
  const handler = createTrackerMissionFarewellVoice({
    authorityManager: { getActiveRun: () => activeRun() },
    voiceService: {
      publicState: () => ({ configured: true }),
      request: value => requests.push(value),
      wait: async () => ({
        effectId: 'mfx-farewell',
        status: 'ready',
        audioAvailable: true,
        text: 'Danke fuers Mitnehmen.',
        speaker: { name: 'Mara', gender: 'female' },
        provider: 'gemini',
        model: 'tts',
        voiceName: 'Kore'
      }),
      waitForPlayback: async () => {
        playbackWaits += 1;
        return { status: 'completed', completed: true };
      }
    },
    getAudioPlaybackCandidates: () => 2
  });
  const result = await handler.dispatch(request());
  assert.equal(result.ok, true);
  assert.equal(result.voiceOutcome.kind, 'farewell');
  assert.equal(result.voiceOutcome.text, 'Danke fuers Mitnehmen.');
  assert.equal(result.voiceStatus, 'completed');
  assert.equal(playbackWaits, 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].kind, 'farewell');
  assert.equal(requests[0].cue.id, 'deboarding_pax');
  assert.equal(requests[0].cue.gain, 0.38);
});

test('touchdown prewarm generates once and stays silent until Farewell dispatch', async () => {
  const requests = [];
  const activations = [];
  const jobs = new Map();
  const voiceService = {
    publicState: () => ({ configured: true }),
    request: value => {
      requests.push(value);
      const existing = jobs.get(value.effectId);
      if (existing) return existing;
      const job = { effectId: value.effectId, status: 'ready', audioAvailable: true, text: 'Vorbereitet.', speaker: value.speaker };
      jobs.set(value.effectId, job);
      return job;
    },
    activatePlayback: effectId => {
      activations.push(effectId);
      return { activated: true, job: jobs.get(effectId) };
    },
    wait: async effectId => jobs.get(effectId),
    waitForPlayback: async () => ({ status: 'completed', completed: true })
  };
  const handler = createTrackerMissionFarewellVoice({
    authorityManager: { getActiveRun: () => activeRun() },
    voiceService,
    getAudioPlaybackCandidates: () => 1
  });
  const dynamic = { record: { durationSec: 1200, distanceNm: 40, maxAltFt: 5000, touchdownVsFpm: -160 } };
  const prepared = handler.prepare({
    missionId: 'mission-farewell',
    runId: 'run-farewell',
    farewellDynamicContext: dynamic
  });
  assert.equal(prepared.ok, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].deferPlayback, true);
  assert.equal(activations.length, 0);

  const result = await handler.dispatch({ ...request(), farewellDynamicContext: dynamic });
  assert.equal(result.voiceStatus, 'completed');
  assert.equal(requests.length, 2);
  assert.equal(requests[1].effectId, requests[0].effectId);
  assert.equal(activations[0], requests[0].effectId);
});

test('direct failure text and unavailable voice remain best effort', async () => {
  const directRequests = [];
  const direct = createTrackerMissionFarewellVoice({
    authorityManager: { getActiveRun: () => activeRun({
      prompt: '',
      text: 'Der Auftrag ist heute nicht abgeschlossen.',
      playCue: false,
      audioEnabled: false
    }) },
    voiceService: {
      publicState: () => ({ configured: true }),
      request: value => directRequests.push(value),
      wait: async () => ({ status: 'ready', audioAvailable: false, text: 'Der Auftrag ist heute nicht abgeschlossen.', speaker: {} })
    }
  });
  assert.equal((await direct.dispatch(request())).voiceStatus, 'audio_disabled');
  assert.equal(directRequests[0].text, 'Der Auftrag ist heute nicht abgeschlossen.');

  const unavailable = createTrackerMissionFarewellVoice({
    authorityManager: { getActiveRun: () => activeRun() },
    voiceService: { publicState: () => ({ configured: false }) }
  });
  const result = await unavailable.dispatch(request());
  assert.equal(result.ok, true);
  assert.equal(result.voiceStatus, 'voice_not_configured');
  assert.equal(result.voiceOutcome.status, 'warning');
});

test('hosted EFB farewell is built from current tracker flight data instead of the stale handoff recipe', async () => {
  const requests = [];
  const context = authorityContext();
  const handler = createTrackerMissionFarewellVoice({
    authorityManager: { getActiveRun: () => activeRunWithContext(context) },
    voiceService: {
      publicState: () => ({ configured: true }),
      request: value => requests.push(value),
      wait: async () => ({
        status: 'ready',
        audioAvailable: true,
        text: 'Danke fuers Mitnehmen.',
        speaker: context.speaker
      })
    },
    getAudioPlaybackCandidates: () => 0
  });
  const result = await handler.dispatch({
    ...request(),
    farewellContext: context,
    farewellDynamicContext: {
      record: {
        durationSec: 1800,
        distanceNm: 82.14,
        maxAltFt: 6500,
        maxBankDeg: 31.2,
        maxGForce: 1.24,
        maxDescentFpm: -700,
        touchdownVsFpm: -180
      },
      liveWeather: { windKts: 7, windDeg: 260, visKm: 20 }
    }
  });
  assert.equal(result.ok, true);
  assert.equal(requests.length, 1);
  assert.match(requests[0].prompt, /30 min, 82\.1 NM, max 6500 ft/);
  assert.doesNotMatch(requests[0].prompt, /Veralteter Prompt/);
});

test('unsupported special farewell context fails closed and cannot fall back to a generic handoff prompt', async () => {
  let voiceRequests = 0;
  const context = authorityContext({
    supported: false,
    unsupportedReason: 'farewell_context_training_not_migrated'
  });
  const handler = createTrackerMissionFarewellVoice({
    authorityManager: { getActiveRun: () => activeRunWithContext(context) },
    voiceService: {
      publicState: () => ({ configured: true }),
      request: () => { voiceRequests += 1; }
    }
  });
  const result = await handler.dispatch({
    ...request(),
    farewellContext: context,
    farewellDynamicContext: { record: { durationSec: 1200, distanceNm: 40 } }
  });
  assert.equal(result.ok, true);
  assert.equal(result.voiceStatus, 'farewell_context_training_not_migrated');
  assert.equal(result.voiceOutcome.status, 'skipped');
  assert.equal(voiceRequests, 0);
});

test('an explicit current App close recipe keeps precedence over tracker context', async () => {
  const requests = [];
  const context = authorityContext();
  const handler = createTrackerMissionFarewellVoice({
    authorityManager: { getActiveRun: () => activeRunWithContext(context) },
    voiceService: {
      publicState: () => ({ configured: true }),
      request: value => requests.push(value),
      wait: async () => ({ status: 'ready', audioAvailable: true, text: 'App aktuell.', speaker: context.speaker })
    },
    getAudioPlaybackCandidates: () => 0
  });
  const result = await handler.dispatch({
    ...request(),
    farewellRecipe: farewellVoiceCore.createRecipe({
      missionId: 'mission-farewell',
      prompt: 'Aktueller App-Prompt.',
      speaker: context.speaker,
      audioEnabled: true
    }),
    farewellContext: context,
    farewellDynamicContext: { record: { durationSec: 1800, distanceNm: 82.14, maxAltFt: 6500 } }
  });
  assert.equal(result.ok, true);
  assert.equal(requests[0].prompt, 'Aktueller App-Prompt.');
});
