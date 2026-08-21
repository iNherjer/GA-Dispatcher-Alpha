'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const boardingVoiceCore = require('../mission-boarding-voice-core.js');
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
  assert.equal(ready.voiceName, boardingVoiceCore.voiceCandidates('openai', { gender: 'female' })[0]);
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
  assert.equal(ready.voiceName, boardingVoiceCore.voiceCandidates('gemini', { gender: 'male' })[0]);
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

test('boarding recipe generates text once, validates it and then synthesizes the shared audio', async () => {
  const requests = [];
  const service = createTrackerVoiceService({
    provider: 'gemini',
    apiKey: 'secret',
    fetchRemote: async (url, options) => {
      requests.push({ url, body: JSON.parse(options.body) });
      if (url.includes('gemini-3-flash-preview')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ candidates: [{ content: { parts: [{ text: 'Hallo — wir sind bereit...' }] } }] })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ inlineData: { data: Buffer.from([1, 2]).toString('base64'), mimeType: 'audio/L16;rate=24000' } }] } }]
        })
      };
    }
  });
  service.request({
    effectId: 'run-6:boarding',
    kind: 'boarding',
    prompt: 'Boarding prompt',
    fallbackText: 'Fallback.',
    speaker: { name: 'Mara', gender: 'female' }
  });
  const ready = await service.wait('run-6:boarding');
  assert.equal(ready.status, 'ready');
  assert.equal(ready.text, 'Hallo, wir sind bereit.');
  assert.equal(ready.textModel, 'gemini-3-flash-preview');
  assert.equal(requests.length, 2);
  assert.match(requests[1].body.contents[0].parts[0].text, /Hallo, wir sind bereit\./);
});

test('boarding job exposes the deterministic App cue as a separate prelude stream', async () => {
  const cueDirectory = path.join(__dirname, '..', 'audio-cues');
  const variantSeed = boardingVoiceCore.boardingCueVariantSeed('boarding_pax', 'boarding:mission-cue');
  const service = createTrackerVoiceService({
    provider: 'openai',
    apiKey: 'secret',
    audioCueDirectory: cueDirectory,
    fetchRemote: async () => ({ ok: true, arrayBuffer: async () => Buffer.from('voice-audio') })
  });
  service.request({
    effectId: 'run-cue:boarding',
    kind: 'boarding',
    text: 'Willkommen.',
    cue: { id: 'boarding_pax', variantSeed, gain: 0.38 }
  });
  const ready = await service.wait('run-cue:boarding');
  assert.equal(ready.cue.id, 'boarding_pax');
  assert.equal(ready.cue.audioAvailable, true);
  assert.equal(ready.cue.gain, 0.38);
  const cue = service.getCueAudio('run-cue:boarding');
  assert.equal(cue.contentType, 'audio/mpeg');
  assert.ok(cue.body.length > 0);
});

test('farewell accepts the App prompt without inventing a fallback and preserves its cue kind', async () => {
  const service = createTrackerVoiceService({
    provider: 'openai',
    apiKey: 'secret',
    audioCueDirectory: path.join(__dirname, '..', 'audio-cues'),
    fetchRemote: async url => {
      assert.match(url, /chat\/completions$/);
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Danke fuers Mitnehmen.' } }] }) };
    }
  });
  service.request({
    effectId: 'run-cue:farewell',
    kind: 'farewell',
    prompt: 'Verabschiede dich beim Piloten.',
    synthesizeAudio: false,
    cue: { id: 'deboarding_pax', variantSeed: 'farewell-seed', gain: 0.38 }
  });
  const ready = await service.wait('run-cue:farewell');
  assert.equal(ready.kind, 'farewell');
  assert.equal(ready.text, 'Danke fuers Mitnehmen.');
  assert.equal(ready.cue.id, 'deboarding_pax');
  assert.equal(ready.cue.audioAvailable, true);
});

test('cancelled Farewell jobs cannot surface as late playback after the mission-end lock', async () => {
  let releaseProvider;
  const service = createTrackerVoiceService({
    provider: 'openai',
    apiKey: 'secret',
    fetchRemote: async () => {
      await new Promise(resolve => { releaseProvider = resolve; });
      return { ok: true, arrayBuffer: async () => Buffer.from('late-audio') };
    }
  });
  service.request({ effectId: 'run-late:farewell', kind: 'farewell', text: 'Zu spaet.' });
  while (typeof releaseProvider !== 'function') await new Promise(resolve => setImmediate(resolve));
  assert.equal(service.cancel('run-late:farewell', 'farewell_voice_timeout').cancelled, true);
  releaseProvider();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(service.getNextPlayback(), null);
  assert.equal(service.get('run-late:farewell'), null);
});

test('ready audio and completed playback survive a tracker restart without another provider call', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-voice-cache-'));
  const storageFile = path.join(directory, 'voice.json');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let calls = 0;
  const fetchRemote = async () => {
    calls += 1;
    return { ok: true, status: 200, arrayBuffer: async () => Buffer.from('audio') };
  };
  const first = createTrackerVoiceService({ provider: 'openai', apiKey: 'secret', storageFile, fetchRemote });
  first.request({ effectId: 'run-7:boarding', text: 'Hallo.', speaker: { gender: 'female' } });
  await first.wait('run-7:boarding');
  first.claimPlayback({ effectId: 'run-7:boarding', clientId: 'efb-a' });
  first.releasePlayback({ effectId: 'run-7:boarding', clientId: 'efb-a', completed: true });
  assert.equal(calls, 1);

  const second = createTrackerVoiceService({ provider: 'openai', apiKey: 'secret', storageFile, fetchRemote });
  const restored = second.request({ effectId: 'run-7:boarding', text: 'Hallo.', speaker: { gender: 'female' } });
  assert.equal(restored.status, 'ready');
  assert.equal(restored.playback.status, 'completed');
  assert.equal(calls, 1);
  assert.equal(second.getAudio('run-7:boarding').body.toString(), 'audio');
});

test('playback waiter resolves on success and on a best-effort failed local playback', async () => {
  const service = createTrackerVoiceService({
    provider: 'openai',
    apiKey: 'secret',
    fetchRemote: async () => ({ ok: true, arrayBuffer: async () => Buffer.from('audio') })
  });
  service.request({ effectId: 'run-8:boarding', text: 'Hallo.' });
  await service.wait('run-8:boarding');
  service.claimPlayback({ effectId: 'run-8:boarding', clientId: 'efb-a' });
  const waiting = service.waitForPlayback('run-8:boarding', { timeoutMs: 5000 });
  service.releasePlayback({ effectId: 'run-8:boarding', clientId: 'efb-a', completed: false });
  assert.equal((await waiting).status, 'released');
});

test('muted boarding still generates and persists the canonical text without a TTS call', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-voice-text-cache-'));
  const storageFile = path.join(directory, 'voice.json');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  let calls = 0;
  const fetchRemote = async (url) => {
    calls += 1;
    assert.match(url, /chat\/completions$/);
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Wir sind bereit.' } }] }) };
  };
  const first = createTrackerVoiceService({ provider: 'openai', apiKey: 'secret', storageFile, fetchRemote });
  first.request({
    effectId: 'run-9:boarding',
    kind: 'boarding',
    prompt: 'Boarding prompt',
    fallbackText: 'Fallback.',
    synthesizeAudio: false
  });
  const ready = await first.wait('run-9:boarding');
  assert.equal(ready.status, 'ready');
  assert.equal(ready.text, 'Wir sind bereit.');
  assert.equal(ready.audioAvailable, false);
  assert.equal(calls, 1);

  const second = createTrackerVoiceService({ provider: 'openai', apiKey: 'secret', storageFile, fetchRemote });
  assert.equal(second.request({
    effectId: 'run-9:boarding',
    kind: 'boarding',
    prompt: 'Boarding prompt',
    fallbackText: 'Fallback.',
    synthesizeAudio: false
  }).text, 'Wir sind bereit.');
  assert.equal(calls, 1);
});
