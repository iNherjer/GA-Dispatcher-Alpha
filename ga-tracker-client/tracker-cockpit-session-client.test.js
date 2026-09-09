'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { createClient, inferRole, requestJson } = require('./tracker-cockpit-session-client');

test('Coherent without AbortController still releases timed-out HTTP requests', async () => {
  const sandbox = { setTimeout, clearTimeout };
  vm.createContext(sandbox); vm.runInContext(requestJson.toString(), sandbox);
  await assert.rejects(sandbox.requestJson(() => new Promise(() => {}), '/test', {}, 20), /tracker_request_timeout/);
});

for (const stage of ['headers', 'body']) test(`HTTP deadline includes stalled ${stage}, aborts and ignores late results`, async () => {
  let finish, signal, applied = false;
  const pending = new Promise(resolve => { finish = resolve; });
  const fetchRemote = async (_url, init) => {
    signal = init.signal;
    return stage === 'headers' ? pending : { ok: true, json: () => pending };
  };
  await assert.rejects(requestJson(fetchRemote, '/test', {}, 20).then(() => { applied = true; }), /tracker_request_timeout/);
  assert.equal(signal.aborted, true);
  finish(stage === 'headers' ? response({ old: true }) : { old: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(applied, false);
  assert.equal((await requestJson(async () => response({ fresh: true }), '/test')).body.message.payload.fresh, true);
});

test('a timed-out mission intent is not blindly repeated and subsequent commands remain usable', async t => {
  const sent = [];
  const client = createClient({ role: 'efb', requestTimeoutMs: 20, fetchRemote: async (url, init) => {
    if (url.endsWith('/cockpit/sessions')) return response({ session: { sessionId: 's' }, sessionToken: 't', heartbeatAfterMs: 999999 });
    if (url.endsWith('/mission/intents')) {
      sent.push(JSON.parse(init.body).commandId);
      if (sent.length === 1) return new Promise(() => {});
      return response({ ok: true });
    }
    return response({});
  } });
  t.after(() => client.stop());
  await assert.rejects(client.submitIntent({ commandId: 'first' }), /tracker_request_timeout/);
  assert.deepEqual(sent, ['first']);
  assert.equal((await client.submitIntent({ commandId: 'second' })).ok, true);
});

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

test('cockpit client rebinds one rejected intent to the authoritative run of the same mission', async () => {
  const intentBodies = [];
  const fetchRemote = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    if (url.endsWith('/cockpit/sessions')) return response({
      session: { sessionId: 'session-run-retry', expiresAt: Date.now() + 45000 },
      sessionToken: 'token-run-retry', heartbeatAfterMs: 999999
    });
    if (url.endsWith('/mission/intents')) {
      intentBodies.push(body);
      if (intentBodies.length === 1) return response({ ok: false, status: 'conflict', error: 'mission_run_conflict' });
      return response({ ok: true, status: 'ok' });
    }
    if (url.endsWith('/mission')) return response({
      missionId: 'mission-retry',
      control: {
        executionAuthority: 'tracker', missionId: 'mission-retry', runId: 'run-current',
        authorityRevision: 4, allowedActions: ['prepare_mission']
      }
    });
    if (url.endsWith('/cockpit/sessions/release')) return response({ released: true });
    throw new Error(`unexpected:${url}`);
  };
  const client = createClient({ role: 'efb', clientId: 'efb-run-retry', fetchRemote });
  const result = await client.submitIntent({
    commandId: 'prepare-old', intent: 'prepare_mission', missionId: 'mission-retry',
    runId: 'run-stale', expectedRevision: 3, payload: {}
  });
  assert.equal(result.ok, true);
  assert.equal(intentBodies.length, 2);
  assert.equal(intentBodies[1].runId, 'run-current');
  assert.equal(intentBodies[1].expectedRevision, 4);
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
    if (url.includes('/voice/playback/next?clientId=')) return response({ available: true, job: { effectId: 'run-a:boarding' } });
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
    if (url.includes('/voice/playback/next?clientId=')) return response({
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

test('new cockpit with no saved volume is audible and uses decoded cue then speech', async (t) => {
  const previousStorage = globalThis.localStorage;
  const previousDocument = globalThis.document;
  globalThis.document = {};
  globalThis.localStorage = { getItem: () => null };
  t.after(() => { globalThis.localStorage = previousStorage; globalThis.document = previousDocument; });
  const sources = [], gains = [], releases = [];
  class Context {
    constructor() { this.state = 'running'; this.destination = {}; }
    async resume() {}
    decodeAudioData(bytes, resolve) { resolve({ duration: 1 }); }
    createGain() { const gain = { gain: { value: 0 }, connect() {}, disconnect() {} }; gains.push(gain); return gain; }
    createBufferSource() { const source = { connect() {}, disconnect() {}, start() {}, stop() {} }; sources.push(source); return source; }
  }
  const client = createClient({
    role: 'efb', clientId: 'decoded', AudioContext: Context, listenForVoice: true,
    getAudioPlaybackEnabled: () => true,
    fetchRemote: async (url, init = {}) => {
      if (url.endsWith('/cockpit/sessions')) return response({ session: { sessionId: 's', expiresAt: Date.now() + 45000 }, sessionToken: 't', heartbeatAfterMs: 999999 });
      if (url.includes('/voice/playback/next?clientId=')) return response({ available: true, job: { effectId: 'decoded-job', cue: { audioAvailable: true, gain: 0.38 } } });
      if (url.endsWith('/voice/playback/claim')) return response({ claimed: true });
      if (url.endsWith('/voice/playback/release')) { releases.push(JSON.parse(init.body)); return response({ released: true }); }
      if (/\/(audio|cue)$/.test(url)) return { ok: true, arrayBuffer: async () => new ArrayBuffer(2) };
      return response({});
    }
  });
  t.after(() => client.stop());
  await client.start();
  assert.equal(await client.unlockAudioPlayback(), true);
  const playback = client.pollVoice();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sources.length, 1);
  assert.equal(gains[0].gain.value, 0.38);
  sources[0].onended();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sources.length, 2);
  assert.equal(gains[1].gain.value, 1, 'absent preference must not mean muted');
  sources[1].onended();
  await playback;
  assert.equal(releases.length, 1);
  assert.equal(releases[0].completed, true);
});

test('cue-only playback decodes the cargo sound and never requests a speech track', async t => {
  const urls = [], gains = [], releases = [];
  class Context {
    constructor() { this.state = 'running'; this.destination = {}; }
    async resume() {}
    decodeAudioData(bytes, resolve) { resolve({ duration: 1 }); }
    createGain() { const gain = { gain: { value: 0 }, connect() {}, disconnect() {} }; gains.push(gain); return gain; }
    createBufferSource() { const source = { connect() {}, disconnect() {}, stop() {}, start() { queueMicrotask(() => source.onended?.()); } }; return source; }
  }
  const client = createClient({ role: 'efb', clientId: 'cargo-decoded', AudioContext: Context, listenForVoice: true,
    getAudioPlaybackEnabled: () => true, fetchRemote: async (url, init = {}) => {
      urls.push(url);
      if (url.endsWith('/cockpit/sessions')) return response({ session: { sessionId: 's', expiresAt: Date.now() + 45000 }, sessionToken: 't', heartbeatAfterMs: 999999 });
      if (url.includes('/voice/playback/next?clientId=')) return response({ available: true, job: { effectId: 'cargo-job', kind: 'cargo', audioAvailable: false, cue: { audioAvailable: true, gain: 0.62 } } });
      if (url.endsWith('/voice/playback/claim')) return response({ claimed: true });
      if (url.endsWith('/voice/playback/release')) { releases.push(JSON.parse(init.body)); return response({ released: true }); }
      if (url.endsWith('/cue')) return { ok: true, arrayBuffer: async () => new ArrayBuffer(2) };
      return response({});
    }
  });
  t.after(() => client.stop());
  await client.start(); await client.unlockAudioPlayback(); await client.pollVoice();
  assert.equal(urls.some(url => url.endsWith('/audio')), false);
  assert.equal(gains.length, 1);
  assert.equal(gains[0].gain.value, 0.62);
  assert.equal(releases[0].completed, true);
});

test('remote App plays tracker audio through relay without a loopback session', async t => {
  const { handleVoiceRelay } = require('./tracker-voice-relay-core');
  const previousAvailable = globalThis.gaTrackerVoiceRelayAvailable;
  const previousRequest = globalThis.gaTrackerVoiceRelayRequest;
  const bytes = Buffer.alloc(80000, 42), calls = [];
  let completed = false, staticRequests = 0;
  globalThis.gaTrackerVoiceRelayAvailable = () => true;
  globalThis.gaTrackerVoiceRelayRequest = async command => {
    calls.push(command);
    return handleVoiceRelay({
      getNextPlayback: () => completed ? null : { effectId: 'remote-job', cue: { audioAvailable: true, assetName: 'boarding_pax.mp3', gain: 0.38 } },
      claimPlayback: () => ({ claimed: true }),
      releasePlayback: value => { completed = value.completed; return { released: true }; },
      getAudio: () => ({ body: bytes, contentType: 'audio/wav' })
    }, command);
  };
  class Context {
    constructor() { this.state = 'running'; this.destination = {}; }
    async resume() {}
    decodeAudioData(buffer, resolve) { assert.deepEqual(Buffer.from(buffer), bytes); resolve({ duration: 1 }); }
    createGain() { return { gain: {}, connect() {}, disconnect() {} }; }
    createBufferSource() { const source = { connect() {}, disconnect() {}, stop() {}, start() { queueMicrotask(() => source.onended?.()); } }; return source; }
  }
  const client = createClient({ role: 'web', clientId: 'phone', AudioContext: Context, listenForVoice: true,
    getAudioPlaybackEnabled: () => true, fetchRemote: async (url, init) => {
      assert.equal(url, 'https://inherjer.github.io/GA-Dispatcher-Alpha/audio-cues/boarding_pax.mp3');
      assert.equal(init.cache, 'force-cache'); staticRequests++;
      return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length) };
    } });
  t.after(async () => { await client.stop(); globalThis.gaTrackerVoiceRelayAvailable = previousAvailable; globalThis.gaTrackerVoiceRelayRequest = previousRequest; });
  await client.start(); await client.pollVoice();
  assert.equal(completed, true);
  assert.equal(staticRequests, 1);
  assert.equal(calls.filter(call => call.action === 'cue').length, 0);
  assert.equal(calls.filter(call => call.action === 'audio').length, 4);
});

test('a non-progressing HTMLAudio player releases promptly and stops claiming later jobs', async t => {
  const calls = [];
  class StalledAudio { constructor() { this.currentTime = 0; } async play() {} pause() {} }
  const client = createClient({ role: 'efb', clientId: 'stalled-efb', Audio: StalledAudio,
    listenForVoice: true, getAudioPlaybackEnabled: () => true,
    fetchRemote: async (url, init = {}) => {
      const body = init.body ? JSON.parse(init.body) : {};
      calls.push({ url, body });
      if (url.endsWith('/cockpit/sessions')) return response({ session: { sessionId: 'stalled', expiresAt: Date.now() + 45000 }, sessionToken: 't' });
      if (url.includes('/playback/next')) return response({ available: true, job: { effectId: 'stalled-job', kind: 'cargo', cue: { audioAvailable: true } } });
      if (url.endsWith('/claim')) return response({ claimed: true });
      return response({ released: true });
    } });
  t.after(() => client.stop());
  await client.start(); await client.pollVoice();
  await new Promise(resolve => setTimeout(resolve, 5100));
  assert.ok(calls.some(call => call.url.endsWith('/release') && call.body.retryable === true));
  const before = calls.filter(call => call.url.endsWith('/claim')).length;
  await client.pollVoice();
  assert.equal(calls.filter(call => call.url.endsWith('/claim')).length, before);
});

test('Web cockpit keeps the client identity used by an earlier relay join', () => {
  const before = globalThis.gaTrackerAudioRelayClientId;
  globalThis.gaTrackerAudioRelayClientId = () => 'web-early-join';
  try { assert.equal(createClient({ role: 'web' }).clientId, 'web-early-join'); }
  finally { globalThis.gaTrackerAudioRelayClientId = before; }
});

test('switching to relay stops heartbeats for the obsolete local session and can register locally again', async t => {
  const previous = globalThis.gaTrackerVoiceRelayAvailable;
  let relay = false;
  globalThis.gaTrackerVoiceRelayAvailable = () => relay;
  t.after(() => { globalThis.gaTrackerVoiceRelayAvailable = previous; });
  const calls = [];
  const client = createClient({ role: 'web', clientId: 'switch', listenForVoice: () => false,
    fetchRemote: async url => { calls.push(url); return response({ session: { sessionId: 'local', expiresAt: Date.now() + 45000 }, sessionToken: 'token' }); } });
  t.after(() => client.stop());
  await client.register();
  assert.ok(client.authEnvelope());
  relay = true;
  await client.heartbeat(); await client.heartbeat();
  assert.equal(client.authEnvelope(), null);
  assert.equal(calls.length, 1);
  relay = false;
  await client.heartbeat();
  assert.equal(calls.length, 2);
  assert.ok(client.authEnvelope());
});
