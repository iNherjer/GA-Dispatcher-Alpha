'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createAudioAssetCache, audioAssetPath } = require('./tracker-audio-asset-cache');
test('concurrent requests download once; persisted audio works offline after restart', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ga-audio-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  let requests = 0;
  const cache = createAudioAssetCache({ directory, version: 'test', fetchRemote: async () => {
    requests++; return new Response(Buffer.from('audio'), { headers: { 'content-type': 'audio/mpeg' } });
  } });
  const clips = await Promise.all([cache.read('audio-cues/boarding_pax.mp3'), cache.read('audio-cues/boarding_pax.mp3')]);
  assert.equal(requests, 1); assert.equal(clips[0].bytes.toString(), 'audio');
  const offline = createAudioAssetCache({ directory, version: 'test', fetchRemote: async () => { throw new Error('offline'); } });
  assert.equal((await offline.read('audio-cues/boarding_pax.mp3')).cached, true);
});
test('rejects path escapes, unexpected content and oversized downloads without caching failures', async t => {
  for (const asset of ['../secret.mp3', 'audio-cues/../../secret.mp3', 'https://example.com/x.mp3', 'audio-cues/x.mp3?x=1']) assert.throws(() => audioAssetPath(asset));
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ga-audio-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  let type = 'text/html';
  const cache = createAudioAssetCache({ directory, version: 'test', maxBytes: 2, fetchRemote: async () => new Response('large', { headers: { 'content-type': type } }) });
  await assert.rejects(cache.read('audio-cues/a.mp3'), /content_type/);
  type = 'audio/mpeg'; await assert.rejects(cache.read('audio-cues/a.mp3'), /too_large/);
  assert.deepEqual(await fs.readdir(directory), []);
});
