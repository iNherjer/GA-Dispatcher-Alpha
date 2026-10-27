const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('./mission-logbook-record-core.js');

const flight = { createdAt: 1790366614664, startTs: 1790365679361, depLabel: 'EDTW', arrLabel: 'EDTF', durationSec: 935, distanceNm: 28.1,
  maxGForce: 1.25, maxBankDeg: 33.8, touchdownVsFpm: 35, telemetryStatus: 'complete', telemetrySampleCount: 1733, cruiseSampleCount: 500, cruiseDurationSec: 270,
  cruiseAltitudeMeanFt: 5818, segmentCount: 1 };
const mission = { mission: 'Fotoflug Schwarzwald', start: 'EDTW', dest: 'EDTL', ac: 'C172', taskDomain: 'media_photo' };

test('builds the same record shape the web app wrote before', () => {
  const r = core.buildRecord({ mission, missionId: 'mission-a', runId: 'run-a', flight, outcome: { status: 'completed', failed: false, requiredTotal: 2, requiredLoaded: 2 },
    comfort: { comfortScore: 81, mood: 'zufrieden', samples: 400, maxG: '1.30', maxBankDeg: 30 }, hasCargo: true });
  assert.equal(r.schemaVersion, 2);
  assert.equal(r.completionId, 'mission-a-1790366614664');
  assert.equal(r.id, r.completionId);
  assert.equal(r.runId, 'run-a');
  assert.equal(r.start, 'EDTW'); assert.equal(r.dest, 'EDTF'); assert.equal(r.plannedDest, 'EDTL');
  assert.equal(r.missionTitle, 'Fotoflug Schwarzwald');
  assert.equal(r.result, 'completed'); assert.equal(r.failed, false);
  assert.equal(r.durationSec, 935); assert.equal(r.distanceNm, 28.1); assert.equal(r.distanceSource, 'gps');
  assert.equal(r.comfort.score, 81); assert.equal(r.comfort.mood, 'zufrieden');
  assert.equal(r.cargo.requiredLoaded, 2);
  assert.equal(r.cruiseAltitudeMeanFt, 5818);
});

test('aborted runs are recorded as aborted and not fulfilled', () => {
  const r = core.buildRecord({ mission, missionId: 'mission-b', runId: 'run-b', flight, status: 'aborted' });
  assert.equal(r.result, 'aborted'); assert.equal(r.failed, true);
  assert.equal(r.cargo, null); assert.equal(r.comfort, null);
});

test('failed cargo, fallbacks and SAR summary', () => {
  const r = core.buildRecord({ mission: { title: 'SAR', dist: '12,5' }, missionId: 'm', flight: { createdAt: 5, sarSearchSummary: { outcome: 'no_contact', text: 'Kein Kontakt.' } },
    outcome: { failed: true, damagedRequired: ['Koffer'] }, hasCargo: true, fallbackStart: 'EDDS', now: 9 });
  assert.equal(r.failed, true); assert.equal(r.result, 'failed');
  assert.equal(r.start, 'EDDS'); assert.equal(r.dest, 'LANDUNG');
  assert.equal(r.distanceNm, 12.5); assert.equal(r.distanceSource, 'planned');
  assert.deepEqual(r.cargo.damagedRequired, ['Koffer']);
  assert.equal(r.sarSearchSummary.text, 'Kein Kontakt.');
  assert.equal(r.runId, undefined);
});
