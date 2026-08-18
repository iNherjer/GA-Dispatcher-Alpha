'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createTrackerVoiceService } = require('./tracker-voice-service');

test('OpenAI voice jobs deduplicate by effect ID and never expose the API key', async () => {
  let calls = 0;
  let requestOptions = null;
  const service = createTrackerVoiceService({
    provider: 'openai',
    apiKey: 'sk-super-secret',
    fetchRemote: async (_url, options) => {
      calls += 1;
      requestOptions = options;
      return { ok: true, status: 200, arrayBuffer: async () => Buffer.from('mp3-audio') };
    }
  });

  const first = service.request({ effectId: 'run-42:boarding', text: 'Willkommen an Bord.', speaker: { gender: 'female' } });
  const duplicate = service.request({ effectId: 'run-42:boarding', text: 'Willkommen an Bord.', speaker: { gender: 'female' } });
  assert.equal(first.status, 'pending');
  assert.equal(duplicate.effectId, first.effectId);
  const ready = await service.wait(first.effectId);
  assert.equal(calls, 1);
  assert.equal(ready.status, 'ready');
  assert.equal(ready.contentType, 'audio/mpeg');
  assert.equal(ready.voiceName, 'nova');
  assert.equal(requestOptions.headers.Authorization, 'Bearer sk-super-secret');
  assert.equal(JSON.stringify(ready).includes('sk-super-secret'), false);
  assert.equal(JSON.stringify(service.publicState()).includes('sk-super-secret'), false);
  assert.equal(service.getAudio(first.effectId).body.toString(), 'mp3-audio');
});

test('same effect ID with different content is rejected instead of consuming twice', async () => {
  const service = createTrackerVoiceService({
    provider: 'openai',
    apiKey: 'secret',
    fetchRemote: async () => ({ ok: true, arrayBuffer: async () => Buffer.from('audio') })
  });
  service.request({ effectId: 'run-1:greeting', text: 'Hallo.' });
  assert.throws(
    () => service.request({ effectId: 'run-1:greeting', text: 'Ein anderer Text.' }),
    (error) => error?.code === 'effect_id_conflict' && error?.statusCode === 409
  );
  await service.wait('run-1:greeting');
});

test('Gemini uses an API-key header and wraps raw PCM as browser-friendly WAV', async () => {
  let requestUrl = '';
  let requestOptions = null;
  const service = createTrackerVoiceService({
    provider: 'gemini',
    apiKey: 'gemini-secret',
    fetchRemote: async (url, options) => {
      requestUrl = url;
      requestOptions = options;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ inlineData: { data: Buffer.from([1, 2, 3, 4]).toString('base64'), mimeType: 'audio/L16;codec=pcm;rate=24000' } }] } }]
        })
      };
    }
  });
  service.request({ effectId: 'run-2:arrival', text: 'Wir sind da.', speaker: { gender: 'male' } });
  const ready = await service.wait('run-2:arrival');
  const audio = service.getAudio('run-2:arrival');
  assert.equal(requestUrl.includes('gemini-secret'), false);
  assert.equal(requestOptions.headers['x-goog-api-key'], 'gemini-secret');
  assert.equal(ready.voiceName, 'Charon');
  assert.equal(audio.contentType, 'audio/wav');
  assert.equal(audio.body.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(audio.body.subarray(8, 12).toString('ascii'), 'WAVE');
});

test('only one cockpit client owns playback until release or lease expiry', async () => {
  let clock = 1000;
  const service = createTrackerVoiceService({
    provider: 'openai',
    apiKey: 'secret',
    now: () => clock,
    fetchRemote: async () => ({ ok: true, arrayBuffer: async () => Buffer.from('audio') })
  });
  service.request({ effectId: 'run-3:event', text: 'Test.' });
  await service.wait('run-3:event');
  assert.equal(service.getNextPlayback().effectId, 'run-3:event');
  assert.equal(service.claimPlayback({ effectId: 'run-3:event', clientId: 'efb-a', leaseMs: 5000 }).claimed, true);
  assert.equal(service.getNextPlayback(), null);
  assert.deepEqual(service.claimPlayback({ effectId: 'run-3:event', clientId: 'toolbar-b' }).reason, 'owned');
  clock += 5001;
  assert.equal(service.getNextPlayback().effectId, 'run-3:event');
  assert.equal(service.claimPlayback({ effectId: 'run-3:event', clientId: 'toolbar-b' }).claimed, true);
  assert.throws(
    () => service.releasePlayback({ effectId: 'run-3:event', clientId: 'efb-a', completed: true }),
    (error) => error?.code === 'playback_owner_mismatch'
  );
  const released = service.releasePlayback({ effectId: 'run-3:event', clientId: 'toolbar-b', completed: true });
  assert.equal(released.completed, true);
  assert.equal(service.getNextPlayback(), null);
  assert.equal(service.claimPlayback({ effectId: 'run-3:event', clientId: 'efb-a' }).reason, 'completed');
});

test('voice jobs stay unavailable when no protected key reached the tracker', () => {
  const service = createTrackerVoiceService({ provider: 'gemini', apiKey: '' });
  assert.equal(service.publicState().configured, false);
  assert.throws(
    () => service.request({ effectId: 'run-4:event', text: 'Test.' }),
    (error) => error?.code === 'voice_not_configured' && error?.statusCode === 503
  );
});

test('bounded provider queue still accepts a duplicate without starting another paid job', async () => {
  let releaseProvider;
  let calls = 0;
  const service = createTrackerVoiceService({
    provider: 'openai',
    apiKey: 'secret',
    maxPendingJobs: 1,
    fetchRemote: async () => {
      calls += 1;
      await new Promise((resolve) => { releaseProvider = resolve; });
      return { ok: true, arrayBuffer: async () => Buffer.from('audio') };
    }
  });
  service.request({ effectId: 'run-5:first', text: 'Erster Auftrag.' });
  service.request({ effectId: 'run-5:first', text: 'Erster Auftrag.' });
  assert.throws(
    () => service.request({ effectId: 'run-5:second', text: 'Zweiter Auftrag.' }),
    (error) => error?.code === 'voice_queue_full' && error?.statusCode === 429
  );
  await Promise.resolve();
  assert.equal(calls, 1);
  releaseProvider();
  await service.wait('run-5:first');
});
