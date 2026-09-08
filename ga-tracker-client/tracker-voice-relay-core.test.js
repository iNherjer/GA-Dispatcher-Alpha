'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { handleVoiceRelay } = require('./tracker-voice-relay-core');
const { isTrustedMissionIntentEnvelope } = require('./tracker-relay-routing-core');
test('voice relay transfers exact bounded audio chunks and cannot proxy arbitrary URLs or generate audio', () => {
  const bytes = Buffer.alloc(800000, 73);
  const service = { getAudio: () => ({ body: bytes, contentType: 'audio/wav' }) };
  const chunks = [];
  for (let offset = 0; offset < bytes.length;) {
    const result = handleVoiceRelay(service, { action: 'audio', effectId: 'boarding', clientId: 'phone', offset });
    const chunk = Buffer.from(result.data, 'base64');
    assert.ok(chunk.length <= 24 * 1024);
    chunks.push(chunk); offset += chunk.length;
  }
  assert.deepEqual(Buffer.concat(chunks), bytes);
  for (const offset of [-1, 1.5, bytes.length]) assert.throws(() => handleVoiceRelay(service, { action: 'audio', clientId: 'x', offset }));
  assert.throws(() => handleVoiceRelay(service, { action: 'generate', clientId: 'x' }));
  assert.throws(() => handleVoiceRelay(service, { action: 'http://example.org', clientId: 'x' }));
  assert.equal(isTrustedMissionIntentEnvelope({}, { type: 'mission_voice_playback' }, '1234'), false);
  assert.equal(isTrustedMissionIntentEnvelope({ pin: '1234' }, { type: 'mission_voice_playback' }, '1234'), true);
});

test('shared audio settings use revision checks through the existing authenticated relay command', () => {
  const { createAudioControl } = require('./tracker-audio-control-core');
  const audio = createAudioControl();
  assert.equal(handleVoiceRelay(null, { action: 'settings', clientId: 'tab' }, audio).target.mode, 'pc');
  const changed = handleVoiceRelay(null, { action: 'settings_update', clientId: 'tab', expectedRevision: 0,
    target: { mode: 'app', deviceId: 'persistent-phone' } }, audio);
  assert.equal(changed.ok, true);
  assert.equal(handleVoiceRelay(null, { action: 'settings_update', clientId: 'other-tab', expectedRevision: 0,
    target: { mode: 'pc' } }, audio).error, 'audio_revision_conflict');
  assert.throws(() => handleVoiceRelay(null, { action: 'settings', clientId: 'tab' }), /unavailable/);
});
