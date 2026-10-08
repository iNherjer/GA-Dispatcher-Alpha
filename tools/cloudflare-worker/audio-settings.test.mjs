import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker-merged-full.js';
test('audio settings authenticate independently of mission sync and retain only their own record', async () => {
  const store = new Map([['pilotA', JSON.stringify({ pin: '1111', mission: { id: 'keep' } })]]);
  const profile = store.get('pilotA');
  const env = { GA_SYNC_KV: { get: async key => store.get(key) || null, put: async (key, value) => store.set(key, value) } };
  const call = (method, payload, pin = '1111', id = 'pilotA') => worker.fetch(new Request('https://example.test/api/audio-settings/' + id, {
    method, headers: { 'X-Pilot-ID': 'pilotA', 'X-Pilot-PIN': pin, 'Content-Type': 'application/json' },
    ...(payload ? { body: JSON.stringify(payload) } : {})
  }), env, {});
  assert.equal((await call('GET', null, 'wrong')).status, 401);
  assert.equal((await call('GET', null, '1111', 'pilotB')).status, 403);
  const record = { schema: 'ga.audio-control.v1', revision: 1, updatedAt: 100,
    target: { mode: 'app', deviceId: 'phone', name: 'Telefon' }, settings: { volume: 0.4, enabled: true, audioStyle: 'intercom' } };
  assert.equal((await call('POST', record)).status, 200);
  const loaded = await (await call('GET')).json();
  assert.equal(loaded.record.target.deviceId, 'phone');
  assert.equal(loaded.record.settings.volume, 0.4);
  assert.equal(loaded.record.settings.audioStyle, 'intercom');
  assert.equal(store.get('pilotA'), profile);
  assert.equal((await call('POST', { ...record, revision: -1 })).status, 400);
});
