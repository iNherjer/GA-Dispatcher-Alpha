'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createTrackerVoiceClient } = require('./tracker-voice-client');

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ message: { payload } })
  };
}

test('browser voice client waits for one tracker job and downloads its shared audio', async () => {
  const calls = [];
  let pollCount = 0;
  const client = createTrackerVoiceClient({
    baseUrl: 'http://127.0.0.1:49880/api/v1/',
    clientId: 'web-a',
    pollIntervalMs: 25,
    delay: async () => {},
    fetchRemote: async (url, options = {}) => {
      calls.push({ url, options });
      if (url.endsWith('/voice/jobs') && options.method === 'POST') return jsonResponse(202, { effectId: 'run:hello', status: 'pending' });
      if (url.endsWith('/voice/jobs/run%3Ahello')) {
        pollCount += 1;
        return jsonResponse(200, pollCount > 1
          ? { effectId: 'run:hello', status: 'ready', audioAvailable: true, contentType: 'audio/mpeg', provider: 'openai', model: 'tts', voiceName: 'nova' }
          : { effectId: 'run:hello', status: 'pending' });
      }
      if (url.endsWith('/voice/jobs/run%3Ahello/audio')) {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'audio/mpeg' },
          arrayBuffer: async () => Buffer.from('audio')
        };
      }
      throw new Error(`Unexpected URL: ${url}`);
    }
  });

  const audio = await client.requestAudio({ effectId: 'run:hello', text: 'Hallo.' });
  assert.equal(audio.trackerEffectId, 'run:hello');
  assert.equal(Buffer.from(audio.b64, 'base64').toString(), 'audio');
  assert.equal(audio.sourceLabel, 'Tracker TTS');
  assert.equal(calls.filter((entry) => entry.url.endsWith('/voice/jobs') && entry.options.method === 'POST').length, 1);
});

test('browser voice client claims and completes playback with its stable client ID', async () => {
  const payloads = [];
  const client = createTrackerVoiceClient({
    clientId: 'toolbar-a',
    fetchRemote: async (url, options) => {
      payloads.push({ url, body: JSON.parse(options.body) });
      return jsonResponse(200, url.endsWith('/claim') ? { claimed: true } : { released: true, completed: true });
    }
  });
  assert.equal((await client.claimPlayback('run:event')).claimed, true);
  assert.equal((await client.releasePlayback('run:event', true)).completed, true);
  assert.deepEqual(payloads.map((entry) => entry.body.clientId), ['toolbar-a', 'toolbar-a']);
});

test('browser voice client falls back quietly when tracker voice is not configured', async () => {
  const client = createTrackerVoiceClient({
    clientId: 'web-a',
    fetchRemote: async () => ({ ok: false, status: 503, json: async () => ({ error: 'voice_unavailable' }) })
  });
  assert.equal(await client.requestAudio({ effectId: 'run:event', text: 'Test.' }), null);
});
