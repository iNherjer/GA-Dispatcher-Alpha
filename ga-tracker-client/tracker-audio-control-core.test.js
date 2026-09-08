'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAudioControl } = require('./tracker-audio-control-core');
test('PC is default; one selected app may play; stale updates cannot steal audio', async () => {
  const saved = [];
  const audio = createAudioControl({ now: () => 100, cloud: { save: async value => saved.push(value), load: async () => null } });
  assert.equal(audio.canPlay('pc', 'boarding'), true);
  assert.equal(audio.canPlay('phone', 'boarding'), false);
  assert.equal(audio.update({ expectedRevision: 0, target: { mode: 'app', deviceId: 'phone', name: 'iPhone' } }).ok, true);
  assert.equal(audio.canPlay('pc', 'boarding'), false);
  assert.equal(audio.canPlay('phone', 'boarding'), true);
  assert.equal(audio.update({ expectedRevision: 0, target: { mode: 'pc' } }).error, 'audio_revision_conflict');
  audio.update({ expectedRevision: 1, settings: { effectsEnabled: false, volume: 0.4 } });
  assert.equal(audio.canPlay('phone', 'cargo'), false);
  await audio.flush();
  assert.equal(saved.at(-1).target.deviceId, 'phone');
});
test('late cloud restore cannot overwrite a new local selection', async () => {
  let resolve;
  const audio = createAudioControl({ now: () => 10, cloud: { load: () => new Promise(r => { resolve = r; }), save: async () => {} } });
  const pending = audio.restore();
  audio.update({ expectedRevision: 0, target: { mode: 'app', deviceId: 'tablet' } });
  resolve({ updatedAt: 100, revision: 8, target: { mode: 'pc' } }); await pending;
  assert.equal(audio.snapshot().target.deviceId, 'tablet');
});
test('rapid settings changes coalesce cloud writes without losing the last volume', async () => {
  const saved = [];
  const audio = createAudioControl({ cloud: { save: async value => saved.push(value), load: async () => null } });
  for (let revision = 0; revision < 20; revision++) {
    assert.equal(audio.update({ expectedRevision: revision, settings: { volume: revision / 20 } }).ok, true);
  }
  await audio.flush();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].settings.volume, 0.95);
  audio.close();
});
