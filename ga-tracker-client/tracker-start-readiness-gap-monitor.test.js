'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { createReadinessGapMonitor, createLoopDelayProbe } = require('./tracker-start-readiness-gap-monitor');

function fixture(loop = 0) {
  let at = 1000, loopMs = loop;
  const lines = [];
  const loopDelay = { maxMs: () => loopMs, reset: () => {} };
  const monitor = createReadinessGapMonitor({ now: () => at, log: line => lines.push(line), loopDelay, summaryEveryMs: 10000 });
  // Main telemetry every 50 ms (every 3rd frame) while the sim renders.
  const run = (ms, frames = true) => { for (let t = 0; t < ms; t += 50) { at += 50; if (frames) monitor.noteMainTelemetry(); } };
  return { monitor, lines, run, setLoop: ms => { loopMs = ms; }, advance: ms => { at += ms; } };
}

test('on-time 1 Hz packets log nothing', () => {
  const f = fixture(); f.monitor.notePacket();
  for (let n = 0; n < 5; n++) { f.run(1000); assert.equal(f.monitor.notePacket(), null); }
  assert.equal(f.lines.length, 0);
});

test('a late packet while frames keep coming points at the readiness SimConnect link', () => {
  const f = fixture(); f.monitor.notePacket(); f.run(3200);
  assert.equal(f.monitor.notePacket().cause, 'readiness_link');
  assert.match(f.lines[0], /MISSION_START_SOURCE_LATE gapMs=3200 .*likely=readiness_link/);
});

test('silent main telemetry too points at a simulator stall', () => {
  const f = fixture(); f.monitor.notePacket(); f.run(200); f.run(2800, false);
  const late = f.monitor.notePacket();
  assert.equal(late.cause, 'simulator_stall'); assert.equal(late.mainGapMs, 2800);
});

test('a blocked tracker event loop points at the tracker', () => {
  const f = fixture(); f.monitor.notePacket(); f.run(3000); f.setLoop(1800);
  assert.equal(f.monitor.notePacket().cause, 'tracker_busy');
});

test('summary per window and reset after reconnect', () => {
  const f = fixture(); f.monitor.notePacket(); f.run(3000); f.monitor.notePacket();
  for (let n = 0; n < 8; n++) { f.run(1000); f.monitor.notePacket(); }
  assert.ok(f.lines.some(line => /LATE_SUMMARY .*late=1 .*readinessLink=1/.test(line)));
  f.monitor.reset(); f.advance(9000); assert.equal(f.monitor.notePacket(), null, 'first packet after reset has no gap');
});

test('real event-loop probe is available in this Node runtime', () => {
  const probe = createLoopDelayProbe(); assert.ok(probe);
  assert.equal(typeof probe.maxMs(), 'number'); probe.reset(); probe.stop();
});
