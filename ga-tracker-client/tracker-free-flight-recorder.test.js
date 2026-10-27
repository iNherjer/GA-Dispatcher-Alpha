const test = require('node:test');
const assert = require('node:assert/strict');
const { createFreeFlightRecorder, ENTRY_SCHEMA } = require('./tracker-free-flight-recorder.js');
const trackCodec = require('../flight-track-codec-core.js');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createFlightTrackStore } = require('./tracker-flight-track-store.js');

function tempStore() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'free-flight-'));
  return createFlightTrackStore({ directory });
}
function storeOptions(store) {
  return { journal: store.journal, checkpoint: store.checkpoint, load: store.pending.load, save: store.pending.save };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 30));

// 2 Hz telemetry along a heading; phases describe ground speed, climb and ground state.
function flight(phases, { t0 = Date.UTC(2026, 9, 27, 8, 0, 0), lat = 48.2, lon = 9.1 } = {}) {
  const out = [];
  let t = t0, alt = 1700, hdg = 90;
  for (const p of phases) {
    for (let i = 0; i < p.sec * 2; i += 1) {
      hdg += (p.turn || 0) / 2;
      const m = (p.gs * 0.514444) / 2;
      lat += (m * Math.cos(hdg * Math.PI / 180)) / 111195;
      lon += (m * Math.sin(hdg * Math.PI / 180)) / (111195 * Math.cos(lat * Math.PI / 180));
      alt = p.ground ? 1700 : Math.max(1720, alt + (p.vs || 0) / 120);
      t += 500;
      out.push({
        observedAt: t, lat, lon, altFt: alt, aglFt: alt - 1700, gsKts: p.gs,
        onGround: !!p.ground, vsFpm: p.vs || 0, bankDeg: p.turn ? 20 : 0, gForce: 1,
        touchdownFpm: p.ground ? -120 : null, simPaused: !!p.paused, inMenuOrMap: false
      });
    }
  }
  return out;
}

const taxi = { sec: 60, gs: 12, ground: true };
const roll = { sec: 20, gs: 55, ground: true };
const climb = { sec: 300, gs: 80, vs: 600 };
const cruise = { sec: 600, gs: 105, turn: 0.2 };
const descent = { sec: 300, gs: 90, vs: -600 };
const rollout = { sec: 20, gs: 25, ground: true };
const stop = { sec: 30, gs: 0, ground: true };

function run(rec, samples, context = {}) {
  const results = samples.map(s => rec.observe(s, typeof context === 'function' ? context(s) : context));
  return results.filter(r => r.status === 'recorded').map(r => r.entry);
}

test('a full flight becomes one free logbook entry with a track', () => {
  const saved = [];
  const rec = createFreeFlightRecorder({ save: v => saved.push(v) });
  const entries = run(rec, flight([taxi, roll, climb, cruise, descent, rollout, stop]));
  assert.equal(entries.length, 1);
  const e = entries[0];
  assert.equal(e.schema, ENTRY_SCHEMA);
  assert.equal(e.kind, 'free');
  assert.equal(e.endReason, 'landed');
  assert.ok(e.durationSec > 1200 && e.durationSec < 1500, `duration ${e.durationSec}`);
  assert.ok(e.distanceNm > 30, `distance ${e.distanceNm}`);
  assert.ok(e.maxAltFt > 4500 && e.maxAltFt < 4800, `maxAlt ${e.maxAltFt}`);
  assert.ok(e.depPosition && e.arrPosition);
  assert.equal(e.depLabel, undefined);
  const decoded = trackCodec.decodeTrack(e.track);
  assert.ok(decoded.length > 5 && decoded.length < 200);
  assert.equal(e.track.marks.touchdowns.length, 1);
  assert.deepEqual(rec.pending().map(p => p.completionId), [e.completionId]);
  assert.equal(saved.at(-1).pending.length, 1);
  assert.equal(rec.publicState().recording, false);
});

test('taxi without takeoff records nothing', () => {
  const rec = createFreeFlightRecorder();
  const entries = run(rec, flight([taxi, { sec: 200, gs: 0, ground: true }, taxi, stop]));
  assert.equal(entries.length, 0);
  assert.equal(rec.pending().length, 0);
});

test('touch-and-go stays one flight until standstill', () => {
  const rec = createFreeFlightRecorder();
  const entries = run(rec, flight([taxi, roll, climb, descent, { sec: 15, gs: 60, ground: true }, climb, descent, rollout, stop]));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].track.marks.touchdowns.length, 2);
});

test('a mission starting mid-flight takes over and the free flight is dropped', () => {
  const rec = createFreeFlightRecorder();
  const samples = flight([taxi, roll, climb, cruise, descent, rollout, stop]);
  const missionFrom = samples[400].observedAt;
  const entries = run(rec, samples, s => ({ missionActive: s.observedAt >= missionFrom }));
  assert.equal(entries.length, 0);
  assert.equal(rec.publicState().recording, false);
});

test('sim stop keeps a flight that flew, but not a ground-only session', () => {
  const rec = createFreeFlightRecorder();
  run(rec, flight([taxi, roll, climb, cruise]));
  const e = rec.flush('sim-stopped');
  assert.equal(e.endReason, 'sim-stopped');
  assert.equal(e.track.marks.touchdowns.length, 0);
  run(rec, flight([taxi]));
  assert.equal(rec.flush('sim-stopped'), null);
});

test('repositioning after landing closes the flight', () => {
  const rec = createFreeFlightRecorder();
  const samples = flight([taxi, roll, climb, descent, { sec: 5, gs: 20, ground: true }]);
  const last = samples.at(-1);
  const jump = Array.from({ length: 10 }, (_, i) => ({ ...last, observedAt: last.observedAt + 500 * (i + 1), lat: last.lat + 0.5, gsKts: 0 }));
  const entries = run(rec, samples.concat(jump));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].endReason, 'reposition');
});

test('pending entries survive a restart until the web app acknowledges them', () => {
  let stored = null;
  const io = { load: () => stored, save: v => { stored = JSON.parse(JSON.stringify(v)); } };
  const first = createFreeFlightRecorder(io);
  const [entry] = run(first, flight([taxi, roll, climb, descent, rollout, stop]));
  const second = createFreeFlightRecorder(io);
  assert.deepEqual(second.pending().map(e => e.completionId), [entry.completionId]);
  assert.equal(second.acknowledge(entry.completionId), true);
  assert.equal(createFreeFlightRecorder(io).pending().length, 0);
});

test('paused stretches do not end the flight', () => {
  const rec = createFreeFlightRecorder();
  const entries = run(rec, flight([taxi, roll, climb, { sec: 120, gs: 0, paused: true }, cruise, descent, rollout, stop]));
  assert.equal(entries.length, 1);
});

test('placed in the air without moving is not a flight', () => {
  const rec = createFreeFlightRecorder();
  const hover = flight([{ sec: 5, gs: 25 }, { sec: 120, gs: 0 }]).map(s => ({ ...s, altFt: 4000, aglFt: 2300, lat: 48.2, lon: 9.1 }));
  run(rec, hover);
  assert.equal(rec.flush('sim-stopped'), null);
});

test('tracker killed mid-flight: next start closes the flight from the journal', async () => {
  const store = tempStore();
  const first = createFreeFlightRecorder(storeOptions(store));
  run(first, flight([taxi, roll, climb, cruise]));
  await settle(); // journal written asynchronously; no flush, like a killed process
  const second = createFreeFlightRecorder(storeOptions(store));
  assert.equal(second.recover().status, 'suspended');
  const far = flight([taxi], { lat: 52, lon: 13 });
  run(second, far);
  const [entry] = second.pending();
  assert.equal(entry.endReason, 'tracker-restart');
  assert.ok(entry.durationSec > 900, `duration ${entry.durationSec}`);
  assert.equal(second.publicState().suspended, false);
});

test('tracker restarted in flight: the same flight continues to the landing', async () => {
  const store = tempStore();
  const samples = flight([taxi, roll, climb, cruise, descent, rollout, stop]);
  const cut = 2000;
  const first = createFreeFlightRecorder(storeOptions(store));
  run(first, samples.slice(0, cut));
  await settle();
  const second = createFreeFlightRecorder(storeOptions(store));
  second.recover();
  const entries = run(second, samples.slice(cut + 20));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].endReason, 'landed');
  assert.ok(entries[0].durationSec > 1200, `duration ${entries[0].durationSec}`);
  assert.equal(second.pending().length, 1);
});

test('restart without telemetry: the old flight can be closed on its own', async () => {
  const store = tempStore();
  run(createFreeFlightRecorder(storeOptions(store)), flight([taxi, roll, climb]));
  await settle();
  const second = createFreeFlightRecorder(storeOptions(store));
  second.recover();
  assert.equal(second.finishSuspended().endReason, 'tracker-restart');
  assert.equal(createFreeFlightRecorder(storeOptions(store)).recover().status, 'none');
});

test('killed while still taxiing: nothing is recovered', async () => {
  const store = tempStore();
  run(createFreeFlightRecorder(storeOptions(store)), flight([taxi]));
  await settle();
  const second = createFreeFlightRecorder(storeOptions(store));
  assert.equal(second.recover().status, 'suspended');
  assert.equal(second.finishSuspended(), null);
  assert.equal(second.pending().length, 0);
});

test('tracker shutdown flushes the journal and keeps the flight', () => {
  const store = tempStore();
  const rec = createFreeFlightRecorder(storeOptions(store));
  run(rec, flight([taxi, roll, climb, cruise]));
  assert.equal(rec.flush('tracker-exit').endReason, 'tracker-exit');
  assert.equal(createFreeFlightRecorder(storeOptions(store)).pending().length, 1);
  assert.equal(createFreeFlightRecorder(storeOptions(store)).recover().status, 'none');
});
