'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const boardingVoiceCore = require('../mission-boarding-voice-core.js');
const { createTrackerMissionBoardingVoice } = require('./tracker-mission-boarding-voice.js');

function run(recipe = {}) {
  return {
    missionId: 'mission-a',
    runId: 'run-a',
    executionAuthority: 'tracker',
    resumeBundle: {
      executionEffectPlan: {
        schema: 'ga.mission-apt-effect-plan.v1',
        effects: {
          'voice.boarding': {
            recipe: boardingVoiceCore.createRecipe({
              missionId: 'mission-a',
              hasPassenger: true,
              prompt: 'Sprich kurz zum Piloten.',
              fallbackText: 'Willkommen an Bord.',
              speaker: { name: 'Mara', gender: 'female' },
              ...recipe
            })
          }
        }
      }
    }
  };
}

function request() {
  return {
    commandId: 'mfx-boarding',
    missionId: 'mission-a',
    runId: 'run-a',
    effect: { effectId: 'mfx-boarding', type: 'voice.boarding' }
  };
}

test('tracker boarding handler creates one central job and does not wait without an audio instance', async () => {
  const calls = [];
  const voiceService = {
    publicState: () => ({ configured: true }),
    request: (value) => calls.push(value),
    wait: async () => ({
      effectId: 'mfx-boarding', status: 'ready', audioAvailable: true, text: 'Hallo.', speaker: {}, provider: 'gemini', model: 'tts', voiceName: 'Kore'
    }),
    waitForPlayback: async () => { throw new Error('must_not_wait'); }
  };
  const handler = createTrackerMissionBoardingVoice({
    authorityManager: { getActiveRun: () => run() },
    voiceService,
    getAudioPlaybackCandidates: () => 0
  });
  const result = await handler.dispatch(request());
  assert.equal(result.ok, true);
  assert.equal(result.voiceStatus, 'no_audio_instance');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, 'boarding');
  assert.equal(calls[0].fallbackText, 'Willkommen an Bord.');
  assert.equal(calls[0].cue.id, 'boarding_pax');
});

test('tracker boarding handler waits for the selected cockpit playback instance', async () => {
  let waited = 0;
  const handler = createTrackerMissionBoardingVoice({
    authorityManager: { getActiveRun: () => run() },
    voiceService: {
      publicState: () => ({ configured: true }),
      request: () => ({}),
      wait: async () => ({ effectId: 'mfx-boarding', status: 'ready', audioAvailable: true, text: 'Hallo.', speaker: {} }),
      waitForPlayback: async () => { waited += 1; return { status: 'completed', completed: true }; }
    },
    getAudioPlaybackCandidates: () => 2
  });
  const result = await handler.dispatch(request());
  assert.equal(waited, 1);
  assert.equal(result.voiceStatus, 'completed');
});

test('missing provider and disabled App voice preserve the best-effort boarding gate', async () => {
  const noProvider = createTrackerMissionBoardingVoice({
    authorityManager: { getActiveRun: () => run() },
    voiceService: { publicState: () => ({ configured: false }) }
  });
  assert.equal((await noProvider.dispatch(request())).voiceStatus, 'voice_not_configured');

  const muted = createTrackerMissionBoardingVoice({
    authorityManager: { getActiveRun: () => run({ audioEnabled: false }) },
    voiceService: {
      publicState: () => ({ configured: true }),
      request: () => ({}),
      wait: async () => ({ effectId: 'mfx-boarding', status: 'ready', audioAvailable: false, text: 'Willkommen an Bord.', speaker: {} })
    }
  });
  assert.equal((await muted.dispatch(request())).voiceStatus, 'audio_disabled');
});
