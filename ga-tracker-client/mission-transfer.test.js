'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const core = require('../mission-transfer-core');
function browserCore() {
  const context = { crypto: require('node:crypto').webcrypto, TextEncoder, TextDecoder, setInterval, clearInterval,
    btoa: value => Buffer.from(value, 'binary').toString('base64'), atob: value => Buffer.from(value, 'base64').toString('binary') };
  vm.runInNewContext(fs.readFileSync(require.resolve('../mission-transfer-core'), 'utf8'), context);
  return context.GAMissionTransfer;
}
function harness(options = {}) {
  let time = 1, online = true;
  const queue = [], messages = [], errors = [], frames = [];
  const push = (from, frame) => {
    if (!online) return false;
    assert.ok(Buffer.byteLength(JSON.stringify(frame)) < 70 * 1024);
    frames.push(frame); queue.push({ from, frame }); return true;
  };
  const common = { now: () => time, onError: (id, error) => errors.push({ id, error }), retryMs: 200, ttl: options.ttl || 2000 };
  const app = browserCore().create({ ...common, role: 'app', peer: 'phone', sendFrame: frame => push('app', frame) });
  const tracker = core.create({ ...common, role: 'tracker', sendFrame: frame => push('tracker', frame) });
  const otherApp = core.create({ ...common, role: 'app', peer: 'tablet', sendFrame: () => { throw Error('wrong recipient'); } });
  return { app, tracker, frames, messages, errors, queue,
    close() { app.close(); tracker.close(); otherApp.close(); },
    online(value) { online = value; },
    async pump(count = 100) {
      for (let i = 0; i < count; i++) {
        await new Promise(resolve => setTimeout(resolve, 2));
        time += 100; app.tick(); tracker.tick();
        const batch = queue.splice(0).reverse();
        for (const { from, frame } of batch) {
          if (options.drop?.(frame, from)) continue;
          const target = from === 'app' ? tracker : app;
          if (from === 'tracker') assert.equal((await otherApp.receive(frame)).message, undefined);
          const received = await target.receive(frame);
          if (received.message) messages.push(received.message);
          // Simulate identical packets arriving via two relays.
          assert.equal((await target.receive(frame)).message, undefined);
        }
      }
    }
  };
}
function message(direction) {
  return { type: 'gps', syncId: 'test', pin: '1234', [direction === 'app' ? 'trackerCommand' : 'trackerAck']:
    { type: direction === 'app' ? 'mission_authority_acquire' : 'mission_authority_snapshot_ack', commandId: 'command', missionTransferPeer: 'phone',
      resumeBundle: { text: 'ä🛩️完整'.repeat(60000), cargo: { loaded: 12, health: 63 }, phase: 'enroute' } } };
}
test('browser/Node lossless transfers both directions, out-of-order, duplicate and foreign-device isolation', async () => {
  const h = harness(); try {
    const a = message('app'), t = message('tracker');
    assert.equal(h.app.enqueue(a, 'phone'), true); assert.equal(h.tracker.enqueue(t, 'phone'), true);
    await h.pump(19);
    assert.equal(h.messages.length, 2); assert.equal(h.errors.length, 0);
    assert.deepEqual(h.messages.map(v => JSON.stringify(v)).sort(), [JSON.stringify(a), JSON.stringify(t)].sort());
  } finally { h.close(); }
});
test('lost chunk and final receipt recover across temporary disconnect without replaying business action', async () => {
  let lost = false, lostDone = false;
  const h = harness({ drop: f => {
    if (f.kind === 'chunk' && f.index === 2 && !lost) { lost = true; return true; }
    if (f.kind === 'done' && !lostDone) { lostDone = true; return true; }
    return false;
  } });
  try {
    h.app.enqueue(message('app'), 'phone'); await h.pump(3);
    h.online(false); await h.pump(3); h.online(true); await h.pump(13);
    assert.equal(h.messages.length, 1); assert.equal(h.errors.length, 0); assert.equal(lostDone, true);
  } finally { h.close(); }
});
test('corrupted payload never reaches mission logic and returns an explicit error', async () => {
  const h = harness({ drop: f => { if (f.kind === 'chunk' && f.index === 0) f.data = f.data.replace(/^./, 'A'); return false; } });
  try { h.app.enqueue(message('app'), 'phone'); await h.pump(25);
    assert.equal(h.messages.length, 0); assert.equal(h.errors[0].error, 'mission_transfer_invalid');
  } finally { h.close(); }
});
test('allocation bounds and protocol validation reject excessive transfers', async () => {
  const h = harness(); try {
    const huge = message('app'); huge.trackerCommand.resumeBundle.text = 'x'.repeat(core.MAX_BYTES);
    assert.equal(h.app.enqueue(huge, 'phone'), false); assert.equal(h.errors[0].error, 'mission_transfer_too_large');
    const packet = { type: core.TYPE, kind: 'chunk', peer: 'phone', direction: 'to-app', id: 'a'.repeat(32), hash: 'b'.repeat(64), bytes: core.MAX_BYTES + 1, count: 1, index: 0, data: 'AAAA' };
    assert.equal((await h.app.receive(packet)).message, undefined); assert.equal(h.frames.length, 0);
  } finally { h.close(); }
});

test('disconnected transfer expires with correlated error', async () => {
  const h = harness(); try {
    h.online(false); h.app.enqueue(message('app'), 'phone'); await h.pump(23);
    assert.equal(h.messages.length, 0); assert.deepEqual(h.errors, [{ id: 'command', error: 'mission_transfer_timeout' }]);
  } finally { h.close(); }
});
test('12 MiB resume reserve fits below relay frame limit without truncation', async () => {
  const h = harness({ ttl: 30000 }); try {
    const payload = message('tracker'); payload.trackerAck.resumeBundle.text = 'x'.repeat(12 * 1024 * 1024);
    h.tracker.enqueue(payload, 'phone'); await h.pump(150);
    assert.equal(h.errors.length, 0); assert.equal(h.messages.length, 1);
    assert.equal(JSON.stringify(h.messages[0]), JSON.stringify(payload));
  } finally { h.close(); }
});

test('transfer failures retain ACK type so the requesting App resolves its waiter', async () => {
  let time = 0, failure;
  const tx = core.create({ role: 'tracker', now: () => time, ttl: 1, sendFrame: () => false,
    onError: (id, error, type) => { failure = { id, error, type }; } });
  try {
    tx.enqueue(message('tracker'), 'phone'); time = 2; tx.tick();
    assert.deepEqual(failure, { id: 'command', error: 'mission_transfer_timeout', type: 'mission_authority_snapshot_ack' });
  } finally { tx.close(); }
});
