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

test('tracker boarding handler releases the mission gate when no cockpit claims ready audio', async () => {
  let playbackWaits = 0;
  let cancelled = null;
  const handler = createTrackerMissionBoardingVoice({
    authorityManager: { getActiveRun: () => run() },
    voiceService: {
      publicState: () => ({ configured: true }),
      request: () => ({}),
      wait: async () => ({ effectId: 'mfx-boarding', status: 'ready', audioAvailable: true, text: 'Hallo.', speaker: {} }),
      waitForPlaybackClaim: async () => ({ status: 'timeout', claimed: false }),
      waitForPlayback: async () => { playbackWaits += 1; return { status: 'completed', completed: true }; },
      cancel: (effectId, reason) => { cancelled = { effectId, reason }; }
    },
    getAudioPlaybackCandidates: () => 2
  });
  const result = await handler.dispatch(request());
  assert.equal(playbackWaits, 0);
  assert.equal(result.ok, true);
  assert.equal(result.voiceStatus, 'no_audio_claim');
  assert.equal(result.voiceOutcome.status, 'warning');
  assert.equal(result.voiceOutcome.error, 'voice_playback_unclaimed');
  assert.deepEqual(cancelled, { effectId: 'mfx-boarding', reason: 'boarding_voice_unclaimed' });
});

test('a stalled boarding voice request times out, is cancelled and still releases the boarding gate', async () => {
  let cancelled = null;
  const handler = createTrackerMissionBoardingVoice({
    authorityManager: { getActiveRun: () => run() },
    voiceService: {
      publicState: () => ({ configured: true }),
      request: () => ({}),
      wait: () => new Promise(() => {}),
      cancel: (effectId, reason) => { cancelled = { effectId, reason }; }
    },
    generationTimeoutMs: 10
  });

  const result = await handler.dispatch(request());
  assert.equal(result.ok, true);
  assert.equal(result.status, 'completed');
  assert.equal(result.voiceStatus, 'boarding_voice_timeout');
  assert.equal(result.voiceOutcome.status, 'warning');
  assert.deepEqual(cancelled, { effectId: 'mfx-boarding', reason: 'boarding_voice_timeout' });
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

test('APT approach uses live flight data and the selected passenger settings without a boarding cue', async () => {
  const active = run();
  active.resumeBundle.executionEffectPlan.effects['voice.approach'] = { context: {
    supported: true, mode: 'passenger', missionId: active.missionId, enabled: true, audioEnabled: false,
    baseContext: 'Passagier Mara.', dest: 'EDTL', passenger: { bankTolerance: 'niedrig' },
    briefingWeather: {}, speaker: { name: 'Mara', gender: 'female' }
  } };
  const calls = [];
  const handler = createTrackerMissionBoardingVoice({
    authorityManager: { getActiveRun: () => active, getExecutionSnapshot: () => ({ runId: active.runId, state: { phase: 'enroute', flags: { active: true } } }) },
    voiceService: {
      publicState: () => ({ configured: true }), request: value => calls.push(value),
      wait: async () => ({ status: 'ready', text: 'Wir sind gleich da.', speaker: { name: 'Mara' } })
    }
  });
  const result = await handler.dispatch({ ...request(), effect: { effectId: 'mfx-approach', type: 'voice.approach', payload: { flightData: { bankDeg: 38 } } } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, 'approach');
  assert.equal(calls[0].cue, null);
  assert.match(calls[0].prompt, /Wir nähern uns EDTL/);
  assert.match(calls[0].prompt, /Kurven haben mich/);
  assert.equal(result.voiceOutcome.kind, 'approach');
  assert.equal(result.voiceOutcome.text, 'Wir sind gleich da.');
});

test('late generated landing-roll speech is cancelled when farewell starts', async () => {
  const active = run();
  active.resumeBundle.executionEffectPlan.effects['voice.approach'] = { context: { supported: true, audioEnabled: true } };
  const state = { runId: active.runId, state: { phase: 'active', flags: { active: true } } };
  let finishGeneration;
  let generatedRequest;
  let cancelled;
  const handler = createTrackerMissionBoardingVoice({
    authorityManager: { getActiveRun: () => active, getExecutionSnapshot: () => state },
    voiceService: { publicState: () => ({ configured: true }),
      request: value => { generatedRequest = value; },
      wait: () => new Promise(resolve => { finishGeneration = resolve; }),
      cancel: id => { cancelled = id; }, activatePlayback: () => { throw new Error('late playback'); } }
  });
  const pending = handler.dispatch({ ...request(), effect: { effectId: 'late-roll', type: 'voice.flight',
    payload: { kind: 'landing_roll', prompt: 'Ankunft', delayMs: 0 } } });
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(generatedRequest.deferPlayback, true);
  state.state.flags.farewellStarted = true;
  assert.equal(generatedRequest.isPlaybackAllowed(), false);
  finishGeneration({ status: 'ready', audioAvailable: true, text: 'Ankunft' });
  assert.equal((await pending).voiceStatus, 'mission_end');
  assert.equal(cancelled, 'late-roll');
});

test('fresh boarding uses current simulator position before mission telemetry is active', async () => {
  const active = run();
  active.resumeBundle.executionEffectPlan.effects['voice.approach'] = { context: { supported: true,
    departure: { lat: 48, lon: 8 }, passenger: {}, start: 'EDTW', baseContext: 'Passagier' } };
  let recipe;
  const handler = createTrackerMissionBoardingVoice({ authorityManager: { getActiveRun: () => active },
    voiceService: { publicState: () => ({ configured: true }), request: value => { recipe = value; },
      wait: async () => ({ status: 'ready', audioAvailable: true, text: 'Anderer Startort' }) } });
  const result = await handler.dispatch({ ...request(), livePosition: { lat: 49, lon: 8 } });
  assert.equal(result.voiceOutcome.wrongStartActive, true);
  assert.equal(recipe.cue, null);
  assert.match(recipe.prompt, /EDTW/);
});

test('tracker audio settings override a muted App recipe without changing the standalone recipe', async () => {
  const source = run({ audioEnabled: false }), requests = [];
  const original = JSON.stringify(source);
  const handler = createTrackerMissionBoardingVoice({ authorityManager: { getActiveRun: () => source },
    getAudioSettings: () => ({ enabled: true, paxEnabled: true, effectsEnabled: false }), getAudioPlaybackCandidates: () => 0,
    voiceService: { publicState: () => ({ configured: true }), request: value => requests.push(value),
      wait: async () => ({ status: 'ready', audioAvailable: true, text: 'Hallo.' }) } });
  await handler.dispatch(request());
  assert.equal(requests[0].synthesizeAudio, true);
  assert.equal(requests[0].cue, null);
  assert.equal(JSON.stringify(source), original);
});

test('boarding prewarm generates silently and reuses the same run job at playback', async () => {
  const jobs = new Map(), activated = [], waited = []; let generated = 0;
  const service = {
    publicState: () => ({configured:true}), get: id => jobs.get(id),
    request: value => {
      if (!jobs.has(value.effectId)) { generated++; jobs.set(value.effectId, {...value,status:'pending'}); }
      return jobs.get(value.effectId);
    },
    activatePlayback: id => activated.push(id),
    wait: async id => { waited.push(id); return {...jobs.get(id),status:'ready',audioAvailable:true,text:'Willkommen.'}; }
  };
  const handler = createTrackerMissionBoardingVoice({authorityManager:{getActiveRun:()=>run()},voiceService:service});
  await handler.prepare(request());
  await handler.prepare(request());
  assert.equal(generated,1);
  assert.deepEqual(activated,[]);
  assert.deepEqual(waited,[],'preparation does not wait for generation or playback');
  assert.equal(jobs.get('boarding-preload:run-a').deferPlayback,true);
  const result = await handler.dispatch(request());
  assert.equal(result.ok,true);
  assert.equal(generated,1,'boarding must reuse the in-flight generation');
  assert.deepEqual(activated,['boarding-preload:run-a']);
  assert.deepEqual(waited,['boarding-preload:run-a']);
});

test('changed boarding recipe discards prewarm and uses the current effect', async () => {
  const sent = [], cancelled = []; let prepared = false;
  const service = {
    publicState:()=>({configured:true}),get:()=>prepared ? {status:'ready'} : null,
    request: value => { if (prepared && value.effectId.startsWith('boarding-preload:')) throw Object.assign(new Error('changed'),{code:'effect_id_conflict'}); sent.push(value);prepared=true; },
    cancel:(id)=>cancelled.push(id),
    wait:async id=>({effectId:id,status:'ready',audioAvailable:true,text:'Aktueller Text.'})
  };
  const handler=createTrackerMissionBoardingVoice({authorityManager:{getActiveRun:()=>run()},voiceService:service});
  await handler.prepare(request());
  const result=await handler.dispatch(request());
  assert.equal(result.ok,true);
  assert.deepEqual(cancelled,['boarding-preload:run-a']);
  assert.equal(sent[1].effectId,'mfx-boarding');
  assert.equal(sent[1].deferPlayback,false);
});
