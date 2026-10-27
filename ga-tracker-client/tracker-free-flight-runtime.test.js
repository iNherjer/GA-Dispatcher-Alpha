const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { createFreeFlightRuntime } = require('./tracker-free-flight-runtime.js');

function fakeTimers() {
  const list = new Map(); let id = 0;
  return { setTimeout: (fn, ms) => { list.set(++id, { fn, ms }); return id; }, clearTimeout: t => list.delete(t),
    runAll: () => { for (const [k, t] of [...list]) { list.delete(k); t.fn(); } }, size: () => list.size };
}
function samples(phases, t0 = 1790000000000) {
  const out = []; let t = t0, lat = 48, alt = 1500;
  for (const p of phases) for (let i = 0; i < p.sec * 2; i += 1) {
    t += 500; lat += (p.gs * 0.514444 / 2) / 111195; alt = p.ground ? 1500 : alt + (p.vs || 0) / 120;
    out.push({ observedAt: t, lat, lon: 9, altFt: alt, aglFt: alt - 1500, gsKts: p.gs, onGround: !!p.ground, vsFpm: p.vs || 0 });
  }
  return out;
}
const flown = samples([{ sec: 30, gs: 15, ground: true }, { sec: 20, gs: 55, ground: true }, { sec: 300, gs: 85, vs: 500 }]);
function runtime(extra = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-runtime-'));
  const timers = fakeTimers();
  return { rt: createFreeFlightRuntime({ directory, timers, backfill: false, ...extra }), timers, directory };
}

test('a lasting sim stop ends the flight and stores its track', () => {
  const { rt, timers } = runtime();
  rt.start();
  flown.forEach(s => rt.observe(s));
  rt.simStopped(() => true);
  timers.runAll();
  const [entry] = rt.pending();
  assert.equal(entry.endReason, 'sim-stopped');
  assert.equal(rt.store.getTrack(entry.runId).kind, 'free');
});

test('a short sim stop while loading does not end the flight', () => {
  const { rt, timers } = runtime();
  flown.forEach(s => rt.observe(s));
  rt.simStopped(() => true);
  rt.observe({ ...flown.at(-1), observedAt: flown.at(-1).observedAt + 500 });
  timers.runAll();
  assert.equal(rt.pending().length, 0);
  rt.simStopped(() => false);
  timers.runAll();
  assert.equal(rt.pending().length, 0);
});

test('sim closed and tracker exit end the flight at once', () => {
  const a = runtime(); flown.forEach(s => a.rt.observe(s));
  assert.equal(a.rt.simClosed().endReason, 'sim-closed');
  const b = runtime(); flown.forEach(s => b.rt.observe(s));
  const proc = new EventEmitter(); proc.exit = () => { proc.exited = true; };
  b.rt.installProcessHandlers(proc);
  proc.emit('SIGTERM');
  assert.equal(b.rt.pending()[0].endReason, 'tracker-exit');
  assert.equal(proc.exited, true);
  proc.emit('exit');
  assert.equal(b.rt.pending().length, 1);
});

test('no free flight while a mission run is active', () => {
  const { rt } = runtime({ isMissionActive: () => true });
  flown.forEach(s => rt.observe(s));
  assert.equal(rt.simClosed(), null);
});

test('recovered flight without telemetry is closed after the timeout', async () => {
  const { rt, directory } = runtime();
  flown.forEach(s => rt.observe(s));
  await new Promise(r => setTimeout(r, 30));
  const timers = fakeTimers();
  const next = createFreeFlightRuntime({ directory, timers, backfill: false });
  assert.equal(next.start().status, 'suspended');
  timers.runAll();
  assert.equal(next.pending()[0].endReason, 'tracker-restart');
});
