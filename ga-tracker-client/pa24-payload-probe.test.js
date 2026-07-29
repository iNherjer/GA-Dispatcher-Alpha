'use strict';

const assert = require('assert');
const {
  chooseFreeSeatAndCharacter,
  chooseProbeValue,
  detectPa24Aircraft,
  payloadSummary
} = require('./pa24-payload-probe-core');

assert.equal(detectPa24Aircraft({ title: 'A2A Comanche 250' }).detected, true);
assert.equal(detectPa24Aircraft({ model: 'PA-24-250' }).detected, true);
assert.equal(detectPa24Aircraft({ title: 'Cessna 172 Skyhawk' }).detected, false);

assert.equal(chooseProbeValue(0, { min: 0, max: 200, delta: 5 }), 5);
assert.equal(chooseProbeValue(198, { min: 0, max: 200, delta: 5 }), 193);
assert.equal(chooseProbeValue(200, { min: 0, max: 200, delta: 5 }), 195);

assert.deepEqual(
  chooseFreeSeatAndCharacter({
    Seat1Character: 1,
    Seat2Character: 2,
    Seat3Character: 0,
    Seat4Character: 0
  }),
  {
    seat: 4,
    character: 4,
    available: true,
    occupiedCharacters: [1, 2]
  }
);

assert.equal(
  chooseFreeSeatAndCharacter({
    Seat1Character: 1,
    Seat2Character: 2,
    Seat3Character: 3,
    Seat4Character: 4
  }).available,
  false
);

const summary = payloadSummary({
  at: '2026-07-29T00:00:00.000Z',
  aircraft: { title: 'A2A Comanche' },
  lvars: {
    Seat1Character: 1,
    Seat2Character: 2,
    Seat3Character: 0,
    Seat4Character: 0,
    BaggageWeight: 40,
    PayloadWeight: 210
  },
  sim: {
    totalWeightLbs: 2500,
    emptyWeightLbs: 1735,
    fuelWeightLbs: 555,
    payloadStationCount: 3,
    payloadStations: [
      { index: 1, weightLbs: 170 },
      { index: 2, weightLbs: 40 },
      { index: 3, weightLbs: 0 },
      { index: 4, weightLbs: 999 }
    ]
  }
});
assert.equal(summary.simPayloadWeightLbs, 210);
assert.deepEqual(summary.seats, [1, 2, 0, 0]);

console.log('PA24 payload probe self-test: OK');
