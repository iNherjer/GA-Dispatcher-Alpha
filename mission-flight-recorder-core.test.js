'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const core = require('./mission-flight-recorder-core.js');

test('flight recorder uses the App arming, airborne and aggregate thresholds', () => {
  let state = core.createState();
  const sample = (at, overrides = {}) => ({
    observedAt: at,
    lat: 48 + at / 100000000,
    lon: 8,
    altFt: 1200,
    aglFt: 5,
    gsKts: 8,
    onGround: true,
    bankDeg: 0,
    gForce: 1,
    vsFpm: 0,
    ...overrides
  });
  state = core.observe(state, sample(1000)).state;
  state = core.observe(state, sample(2900)).state;
  assert.equal(state.active, true);
  for (let index = 0; index < 10; index += 1) {
    state = core.observe(state, sample(4000 + index * 1000, {
      lat: 48 + index * 0.002,
      altFt: 2500 + index * 10,
      aglFt: 700,
      gsKts: 105,
      onGround: false,
      bankDeg: index === 6 ? -38 : 4,
      gForce: index === 6 ? 1.72 : 1.02,
      vsFpm: index < 5 ? 600 : -700,
      distanceToTargetNm: 20
    })).state;
  }
  assert.equal(state.hadAirbornePhase, true);
  assert.equal(state.maxBankDeg, 38);
  assert.equal(state.maxGForce, 1.72);
  const record = core.buildRecord(state, { now: 23000, depLabel: 'EDTW', arrLabel: 'EDTL' });
  assert.equal(record.depLabel, 'EDTW');
  assert.equal(record.arrLabel, 'EDTL');
  assert.equal(record.maxBankDeg, 38);
  assert.equal(record.maxGForce, 1.72);
  assert.equal(record.telemetryStatus, 'complete');
});

test('paused time is excluded and an implausible ground reposition resets the recorder', () => {
  let state = core.createState({
    active: true,
    startTs: 1000,
    lastUpdateTs: 5000,
    hadAirbornePhase: true,
    airborneEvidenceSec: 20,
    gsSamples: 10,
    lastPosition: { lat: 48, lon: 8 }
  });
  state = core.observe(state, {
    observedAt: 6000, lat: 48, lon: 8, altFt: 1500, aglFt: 500,
    gsKts: 90, onGround: false, simPaused: true
  }).state;
  const resumed = core.observe(state, {
    observedAt: 60000, lat: 48.001, lon: 8, altFt: 1500, aglFt: 500,
    gsKts: 90, onGround: false
  }).state;
  assert.equal(resumed.airborneEvidenceSec, 20);
  const reset = core.observe(resumed, {
    observedAt: 61000, lat: 49, lon: 9, altFt: 100, aglFt: 0,
    gsKts: 0, onGround: true
  });
  assert.equal(reset.status, 'reposition_reset');
  assert.equal(reset.state.active, false);
});

test('Farewell cargo outcome applies the App stress formula and projects passenger handoff', () => {
  const record = { maxGForce: 2.4, maxBankDeg: 60, maxDescentFpm: -1900, touchdownVsFpm: -700 };
  const outcome = core.evaluateFarewellOutcome({
    items: [
      { id: 'pax', itemType: 'passenger', required: true, status: 'loaded', deliverAtDestination: true, healthPct: 100 },
      { id: 'camera', itemType: 'cargo', required: true, status: 'unloaded', deliverAtDestination: true, healthPct: 100, storyName: 'Kamera' }
    ]
  }, record);
  assert.equal(outcome.notDeliveredRequired.length, 0);
  assert.equal(outcome.requiredLoaded, 2);
  assert.ok(outcome.stressDamagePct > 0);
});

test('mission record merges landed segments without losing the final touchdown', () => {
  const merged = core.mergeRecords([{
    depLabel: 'EDTW', arrLabel: 'EDTL', startTs: 1000, endTs: 61000,
    durationSec: 60, distanceNm: 10.2, distanceSource: 'gps', avgGs: 92, maxGs: 110,
    maxAltFt: 3200, touchdownVsFpm: -180, maxBankDeg: 22, maxGForce: 1.2,
    avgGForce: 1.01, maxClimbFpm: 800, maxDescentFpm: -900, minEnrouteAglFt: 700,
    cruiseAltitudeMeanFt: 2800, cruiseAltitudeStdDevFt: 80, cruiseAltitudeRangeFt: 240,
    telemetrySampleCount: 60, bankSampleCount: 58, gForceSampleCount: 58,
    enrouteSampleCount: 40, aglSampleCount: 40, cruiseSampleCount: 30, cruiseDurationSec: 30,
    telemetryStatus: 'complete'
  }, {
    depLabel: 'EDTL', arrLabel: 'EDNY', startTs: 90000, endTs: 180000,
    durationSec: 90, distanceNm: 18.4, distanceSource: 'gps', avgGs: 104, maxGs: 128,
    maxAltFt: 4500, touchdownVsFpm: -260, maxBankDeg: 35, maxGForce: 1.35,
    avgGForce: 1.03, maxClimbFpm: 1100, maxDescentFpm: -1200, minEnrouteAglFt: 520,
    cruiseAltitudeMeanFt: 4100, cruiseAltitudeStdDevFt: 120, cruiseAltitudeRangeFt: 360,
    telemetrySampleCount: 90, bankSampleCount: 88, gForceSampleCount: 88,
    enrouteSampleCount: 65, aglSampleCount: 65, cruiseSampleCount: 50, cruiseDurationSec: 50,
    telemetryStatus: 'complete'
  }]);
  assert.equal(merged.segmentCount, 2);
  assert.equal(merged.durationSec, 150);
  assert.equal(merged.distanceNm, 28.6);
  assert.equal(merged.depLabel, 'EDTW');
  assert.equal(merged.arrLabel, 'EDNY');
  assert.equal(merged.touchdownVsFpm, -260);
  assert.equal(merged.maxAltFt, 4500);
  assert.equal(merged.telemetrySampleCount, 150);
  assert.equal(merged.telemetryStatus, 'complete');
});
