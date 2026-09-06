'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createClient, inferRole } = require('./tracker-cockpit-session-client');

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ message: { payload } })
  };
}

test('cockpit client registers, heartbeats audio preference and releases its ephemeral session', async () => {
  const calls = [];
  let audioEnabled = true;
  const fetchRemote = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body, keepalive: init.keepalive });
    if (url.endsWith('/cockpit/sessions')) return response({
      session: { sessionId: 'session-1', expiresAt: Date.now() + 45000, audioPlaybackEnabled: body.audioPlaybackEnabled },
      sessionToken: 'token-1',
      heartbeatAfterMs: 999999
    });
    if (url.endsWith('/heartbeat')) return response({
      session: { sessionId: 'session-1', expiresAt: Date.now() + 45000, audioPlaybackEnabled: body.audioPlaybackEnabled }
    });
    return response({ releasedSessionId: 'session-1' });
  };
  const client = createClient({ role: 'web', clientId: 'web-one', fetchRemote, getAudioPlaybackEnabled: () => audioEnabled });
  await client.start();
  assert.deepEqual(client.authEnvelope(), { sessionId: 'session-1', sessionToken: 'token-1' });
  assert.equal(calls[0].body.audioPlaybackEnabled, true);
  audioEnabled = false;
  await client.heartbeat();
  assert.equal(calls[1].body.audioPlaybackEnabled, false);
  await client.stop();
  assert.equal(calls[2].keepalive, true);
});

test('toolbar role is inferred explicitly from the tracker-hosted URL', () => {
  const previousLocation = globalThis.location;
  globalThis.location = { search: '?host=toolbar', pathname: '/efb/v1/' };
  assert.equal(inferRole({ dataset: { role: 'auto' } }), 'toolbar');
  globalThis.location = previousLocation;
});

test('cockpit client sends revision-bound intents and reads the shared mission control snapshot', async () => {
  const calls = [];
  const fetchRemote = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, method: init.method || 'GET', body });
    if (url.endsWith('/cockpit/sessions')) return response({
      session: { sessionId: 'session-intent', expiresAt: Date.now() + 45000 },
      sessionToken: 'token-intent',
      heartbeatAfterMs: 999999
    });
    if (url.endsWith('/mission/intents')) return response({
      ok: true,
      status: 'ok',
      activeRun: { missionId: 'mission-a', runId: 'run-a', revision: 8 }
    });
    if (url.endsWith('/mission')) return response({
      missionId: 'mission-a',
      control: { executionAuthority: 'tracker', authorityRevision: 8 }
    });
    throw new Error(`unexpected:${url}`);
  };
  const client = createClient({ role: 'efb', clientId: 'efb-intent', fetchRemote });
  const intent = await client.submitIntent({
    commandId: 'cmd-start',
    intent: 'start_mission',
    missionId: 'mission-a',
    runId: 'run-a',
    expectedRevision: 7,
    payload: {}
  });
  assert.equal(intent.ok, true);
  const request = calls.find(call => call.url.endsWith('/mission/intents'));
  assert.equal(request.body.sessionId, 'session-intent');
  assert.equal(request.body.sessionToken, 'token-intent');
  assert.equal(request.body.expectedRevision, 7);
  const snapshot = await client.missionSnapshot();
  assert.equal(snapshot.control.authorityRevision, 8);
  await client.stop();
});

test('cockpit client retries one stale UI intent with the latest tracker revision', async () => {
  const intentBodies = [];
  const fetchRemote = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    if (url.endsWith('/cockpit/sessions')) return response({
      session: { sessionId: 'session-retry', expiresAt: Date.now() + 45000 },
      sessionToken: 'token-retry', heartbeatAfterMs: 999999
    });
    if (url.endsWith('/mission/intents')) {
      intentBodies.push(body);
      if (intentBodies.length === 1) return response({ ok: false, status: 'conflict', error: 'mission_revision_conflict' });
      return response({ ok: true, status: 'ok' });
    }
    if (url.endsWith('/mission')) return response({
      missionId: 'mission-retry',
      control: {
        executionAuthority: 'tracker', missionId: 'mission-retry', runId: 'run-retry',
        authorityRevision: 12, allowedActions: ['sign_manifest']
      }
    });
    if (url.endsWith('/cockpit/sessions/release')) return response({ released: true });
    throw new Error(`unexpected:${url}`);
  };
  const client = createClient({ role: 'efb', clientId: 'efb-retry', fetchRemote });
  const result = await client.submitIntent({
    commandId: 'sign-old', intent: 'sign_manifest', missionId: 'mission-retry',
    runId: 'run-retry', expectedRevision: 11, payload: {}
  });
  assert.equal(result.ok, true);
  assert.equal(intentBodies.length, 2);
  assert.equal(intentBodies[1].expectedRevision, 12);
  assert.match(intentBodies[1].commandId, /^sign-old:retry:/);
  await client.stop();
});

test('cockpit audio can be unlocked by a user gesture before a voice job arrives', async () => {
  const instances = [];
  class UnlockAudio {
    constructor(url) { this.url = url; this.volume = 1; instances.push(this); }
    async play() { this.played = true; }
    pause() { this.paused = true; }
  }
  const client = createClient({
    role: 'efb', clientId: 'efb-unlock', fetchRemote: async () => response({}),
    getAudioPlaybackEnabled: () => true, Audio: UnlockAudio
  });
  assert.equal(await client.unlockAudioPlayback(), true);
  assert.equal(instances.length, 1);
  assert.match(instances[0].url, /^data:audio\/wav;base64,/);
  assert.equal(instances[0].played, true);
  assert.equal(instances[0].paused, true);
  await client.stop();
});

test('an enabled cockpit audio instance claims and completes the next shared tracker voice job', async () => {
  const calls = [];
  const audioInstances = [];
  class FakeAudio {
    constructor(url) {
      this.url = url;
      this.volume = 1;
      this.onended = null;
      this.onerror = null;
      audioInstances.push(this);
    }
    async play() { calls.push({ kind: 'play', url: this.url }); }
    pause() {}
  }
  const fetchRemote = async (url, init = {}) => {
    calls.push({ kind: 'fetch', url, body: init.body ? JSON.parse(init.body) : null });
    if (url.endsWith('/cockpit/sessions')) return response({
      session: { sessionId: 'session-audio', expiresAt: Date.now() + 45000, audioPlaybackEnabled: true },
      sessionToken: 'token-audio',
      heartbeatAfterMs: 999999
    });
    if (url.endsWith('/voice/playback/next')) return response({ available: true, job: { effectId: 'run-a:boarding' } });
    if (url.endsWith('/voice/playback/claim')) return response({ claimed: true });
    if (url.endsWith('/voice/playback/release')) return response({ released: true, completed: true });
    throw new Error(`unexpected:${url}`);
  };
  const client = createClient({
    role: 'toolbar',
    clientId: 'toolbar-audio',
    fetchRemote,
    getAudioPlaybackEnabled: () => true,
    listenForVoice: true,
    Audio: FakeAudio
  });
  await client.start();
  await client.pollVoice();
  assert.equal(audioInstances.length, 1);
  assert.match(audioInstances[0].url, /voice\/jobs\/run-a%3Aboarding\/audio$/);
  assert.equal(calls.some(call => call.body?.clientId === 'toolbar-audio' && call.url.endsWith('/claim')), true);
  audioInstances[0].onended();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.some(call => call.body?.completed === true && call.url.endsWith('/release')), true);
  await client.stop();
});

test('cockpit playback keeps the App order: boarding cue first, then the central voice', async () => {
  const calls = [];
  const audioInstances = [];
  class FakeAudio {
    constructor(url) {
      this.url = url;
      this.volume = 1;
      this.onended = null;
      this.onerror = null;
      audioInstances.push(this);
    }
    async play() { calls.push({ kind: 'play', url: this.url, volume: this.volume }); }
    pause() {}
  }
  const fetchRemote = async (url, init = {}) => {
    calls.push({ kind: 'fetch', url, body: init.body ? JSON.parse(init.body) : null });
    if (url.endsWith('/cockpit/sessions')) return response({
      session: { sessionId: 'session-cue', expiresAt: Date.now() + 45000, audioPlaybackEnabled: true },
      sessionToken: 'token-cue',
      heartbeatAfterMs: 999999
    });
    if (url.endsWith('/voice/playback/next')) return response({
      available: true,
      job: { effectId: 'run-cue:boarding', cue: { id: 'boarding_pax', audioAvailable: true, gain: 0.38 } }
    });
    if (url.endsWith('/voice/playback/claim')) return response({ claimed: true });
    if (url.endsWith('/voice/playback/release')) return response({ released: true, completed: true });
    throw new Error(`unexpected:${url}`);
  };
  const client = createClient({
    role: 'efb',
    clientId: 'efb-cue',
    fetchRemote,
    getAudioPlaybackEnabled: () => true,
    listenForVoice: true,
    Audio: FakeAudio
  });
  await client.start();
  await client.pollVoice();
  assert.equal(audioInstances.length, 2);
  const voice = audioInstances.find(item => item.url.endsWith('/audio'));
  const cue = audioInstances.find(item => item.url.endsWith('/cue'));
  assert.ok(voice);
  assert.ok(cue);
  assert.equal(calls.filter(call => call.kind === 'play').length, 1);
  assert.match(calls.find(call => call.kind === 'play').url, /\/cue$/);
  assert.equal(calls.find(call => call.kind === 'play').volume, 0.38);
  cue.onended();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(calls.filter(call => call.kind === 'play')[1].url, /\/audio$/);
  voice.onended();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.some(call => call.body?.completed === true && call.url.endsWith('/release')), true);
  await client.stop();
});
