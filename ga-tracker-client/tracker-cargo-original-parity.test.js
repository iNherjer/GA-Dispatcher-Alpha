'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createCargoVisualQueue } = require('./tracker-cargo-visual-queue.generated');
const original = fs.readFileSync(path.join(__dirname, 'fixtures/standalone-cargo-visual-queue-v423.txt'), 'utf8');
function harness(legacy) {
  let now = 0, id = 0;
  const timers = new Map(), sent = [];
  const setTimeout = (fn, delay) => { const key = ++id; timers.set(key, { at: now + delay, fn }); return key; };
  const clearTimeout = key => timers.delete(key);
  const advance = to => {
    while (true) {
      const next = [...timers].filter(([, t]) => t.at <= to).sort((a,b) => a[1].at-b[1].at || a[0]-b[0])[0];
      if (!next) break;
      timers.delete(next[0]); now = next[1].at; next[1].fn();
    }
    now = to;
  };
  const send = visible => (item, options) => {
    const commandId = `cmd-${sent.length}`;
    sent.push(JSON.parse(JSON.stringify({ at: now, item, options, visible, commandId })));
    return commandId;
  };
  let queue;
  if (legacy) {
    const context = {
      window: { liveTrackerConnected: true }, _MISSION_CARGO_OBJECT_ACTION_QUEUE: new Map(),
      missionCargoObjectActionRevision: 0, MISSION_CARGO_OBJECT_ACTION_DEBOUNCE_MS: 180,
      _missionCargoStableObjectKey: item => item.id, _missionCargoIsPassengerItem: () => false,
      _missionCargoSpawnVisibleItem: send(true), _missionCargoRemoveVisibleItem: send(false),
      setTimeout, clearTimeout, Date: { now: () => now }
    };
    vm.runInNewContext(original, context);
    queue = { enqueue: context._missionCargoQueueVisibleItemState,
      cancel: context._missionCargoCancelVisibleItemActions, resolveAck: context.window.missionCargoResolveVisibleItemAck };
  } else queue = createCargoVisualQueue({ getObjectKey: item => item.id, spawn: send(true), remove: send(false),
    setTimeout, clearTimeout, now: () => now });
  return { queue, advance, sent };
}
for (const immediate of [false, true]) test(`original parity: 100 rapid clicks, independent items and late ACKs (immediate=${immediate})`, () => {
  const runs = [harness(true), harness(false)];
  for (const h of runs) {
    for (let i=0;i<100;i++) {
      h.advance(i*13);
      h.queue.enqueue({ id: `item-${i%3}`, label: 'Fracht' }, i%2===0, { immediate });
      if (i%7===0 && h.sent.length) h.queue.resolveAck({ type: 'mission_scene_object_spawn_ack', commandId: h.sent[0].commandId, objectRevision: 1 });
    }
    h.advance(2000);
  }
  assert.deepEqual(runs[1].sent, runs[0].sent);
  for (let item=0;item<3;item++) {
    const last = runs[1].sent.filter(entry => entry.item.id===`item-${item}`).at(-1);
    const finalClick = Array.from({length:100},(_,i)=>i).filter(i=>i%3===item).at(-1);
    assert.equal(last.visible, finalClick%2===0);
  }
});

test('original parity: cancel discards queued work and old ACK cannot discard new target', () => {
  const runs = [harness(true), harness(false)];
  for (const h of runs) {
    h.queue.enqueue({ id: 'a' }, true, { immediate: true }); h.advance(0);
    h.queue.enqueue({ id: 'a' }, false); h.queue.cancel(); h.advance(1000);
    assert.equal(h.sent.length, 1);
    h.queue.enqueue({ id: 'a' }, false);
    h.queue.resolveAck({ type: 'mission_scene_object_spawn_ack', commandId: 'cmd-0', objectRevision: 1 });
    h.advance(2000); assert.equal(h.sent.at(-1).visible, false);
  }
  assert.deepEqual(runs[1].sent,runs[0].sent);
});
