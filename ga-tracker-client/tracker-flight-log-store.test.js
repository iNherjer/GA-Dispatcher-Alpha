'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { createTrackerFlightLogStore, SUMMARY_SCHEMA } = require('./tracker-flight-log-store.js');

test('tracker flight log keeps raw telemetry local and writes only a compact completion model', () => {
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
  const raw = fs.readFileSync(finalized.rawFilename, 'utf8');
  assert.match(raw, /"type":"telemetry"/);
  assert.match(raw, /"type":"segment_completed"/);
  assert.doesNotMatch(raw, /must-not-leak/);
  const summary = JSON.parse(fs.readFileSync(finalized.filename, 'utf8'));
  assert.equal(summary.record.distanceNm, 28.6);
  assert.equal(Object.hasOwn(summary, 'samples'), false);
});
