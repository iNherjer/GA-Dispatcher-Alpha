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
