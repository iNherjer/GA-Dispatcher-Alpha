'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { createTrackerFlightLogStore, SUMMARY_SCHEMA } = require('./tracker-flight-log-store.js');

test('tracker flight log keeps raw telemetry local and writes only a compact completion model', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-flight-log-'));
  const store = createTrackerFlightLogStore({ directory, now: () => 9000 });
  store.recordSample({
    missionId: 'mission/one', runId: 'run:one', phase: 'enroute',
    sample: { observedAt: 1000, lat: 48, lon: 8, altFt: 3200, gsKts: 102, onGround: false, secret: 'must-not-leak' },
    destination: { atDestination: false, dMissionNm: 12.4 }
  });
  store.recordSegment({
    missionId: 'mission/one', runId: 'run:one', reason: 'stable-landing',
    record: { depLabel: 'EDTW', arrLabel: 'EDTL', durationSec: 60, segmentCount: 1 },
    missionRecord: { durationSec: 60, segmentCount: 1 }
  });
  const finalized = store.finalize({
    missionId: 'mission/one', runId: 'run:one', status: 'completed', endedAt: 8000,
    record: { depLabel: 'EDTW', arrLabel: 'EDNY', durationSec: 150, distanceNm: 28.6, segmentCount: 2 }
  });
  assert.equal(finalized.summary.schema, SUMMARY_SCHEMA);
  assert.equal(finalized.summary.record.segmentCount, 2);
  assert.equal((await store.flush()).ok, true);
  const raw = fs.readFileSync(finalized.rawFilename, 'utf8');
  assert.match(raw, /"type":"telemetry"/);
  assert.match(raw, /"type":"segment_completed"/);
  assert.doesNotMatch(raw, /must-not-leak/);
  const summary = JSON.parse(fs.readFileSync(finalized.filename, 'utf8'));
  assert.equal(summary.record.distanceNm, 28.6);
  assert.equal(Object.hasOwn(summary, 'samples'), false);
});

test('slow raw-log I/O never blocks telemetry; queued samples retain order and errors are observable', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-flight-log-async-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const writes = [], callbacks = [], errors = [];
  const store = createTrackerFlightLogStore({ directory, log: text => errors.push(text), fs: {
    ...fs, appendFileSync: () => assert.fail('synchronous append in telemetry path'),
    appendFile: (file, text, encoding, callback) => { writes.push(text); callbacks.push(callback); }
  } });
  for (let n = 1; n <= 3; n++) assert.equal(store.recordSample({ missionId: 'm', runId: 'r', sample: { observedAt: n } }).ok, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes.length, 1);
  store.recordSample({ missionId: 'm', runId: 'r', sample: { observedAt: 4 } });
  assert.equal(writes.length, 1, 'a stalled append must not start a concurrent write');
  callbacks.shift()(null);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes.length, 2);
  callbacks.shift()(new Error('disk unavailable'));
  assert.equal((await store.flush()).ok, false);
  assert.equal(store.publicState().pendingBytes, 0);
  assert.match(errors[0], /disk unavailable/);
  assert.deepEqual(writes.join('').trim().split('\n').map(line => JSON.parse(line)).filter(row => row.type === 'telemetry').map(row => row.sample.observedAt), [1, 2, 3, 4]);
});
