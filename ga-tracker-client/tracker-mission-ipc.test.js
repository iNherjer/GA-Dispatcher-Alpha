'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createMissionIpc, missionRequestTimeout } = require('./tracker-mission-ipc.js');

test('voice callbacks survive the normal RPC deadline, while ordinary stalled requests expire', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const left = new EventEmitter(), right = new EventEmitter();
  for (const [channel, peer] of [[left, right], [right, left]]) {
    channel.connected = true;
    channel.send = (message, done) => queueMicrotask(() => { peer.emit('message', message); done?.(); });
  }
  let finishVoice;
  const server = createMissionIpc(right, {
    callback: () => new Promise(resolve => { finishVoice = resolve; }),
    authority: () => new Promise(() => {})
  });
  const client = createMissionIpc(left, {}, { timeoutForRequest: missionRequestTimeout });
  t.after(() => { client.close(); server.close(); });
  const voice = client.request('callback', 'playBoardingVoice', []);
  const stalled = assert.rejects(client.request('authority', 'getActiveRun', []), /response_timeout/);
  await Promise.resolve();
  t.mock.timers.tick(31000);
  await stalled;
  finishVoice({ ok: true, status: 'completed' });
  assert.equal((await voice).ok, true);
});


test('state patches preserve array changes, nested deletions and shared immutable bundles', () => {
  const { difference, applyDifference } = require('./tracker-mission-ipc.js');
  const bundle = { route: [{ lat: 48, lon: 8 }], description: 'immutable' };
  const before = { active: { bundle, revision: 1, old: true }, effects: [{ id: 'a' }], status: null };
  const after = { active: { bundle, revision: 2 }, effects: [{ id: 'b' }, { id: 'c' }], status: { ready: true } };
  const patch = difference(before, after);
  assert.ok(patch.every(change => !change.path.includes('bundle')));
  assert.deepEqual(applyDifference(structuredClone(before), patch), after);
  assert.deepEqual(difference(after, structuredClone(after)), []);
});
