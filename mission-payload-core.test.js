'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const payloadCore = require('./mission-payload-core.js');

function standardBaseline() {
  return {
    payloadAdapter: 'msfs_payload_stations',
    aircraft: { title: 'Standard test aircraft' },
    totalWeightLbs: 2100,
    emptyWeightLbs: 1450,
    fuelWeightLbs: 300,
    payloadWeightLbs: 170,
    payloadStationCount: 6,
    sampledStationCount: 6,
    stations: [
      { index: 1, weightLbs: 170 },
      { index: 2, weightLbs: 0 },
      { index: 3, weightLbs: 0 },
      { index: 4, weightLbs: 0 },
      { index: 5, weightLbs: 0 },
      { index: 6, weightLbs: 0 }
    ]
  };
}

function snapshotFromPlan(baseline, plan) {
  return {
    ...baseline,
    stations: baseline.stations.map(row => ({
      ...row,
      weightLbs: plan.stations.find(target => target.index === row.index)?.weightLbs ?? row.weightLbs
    }))
  };
}

test('authoritative payload outcomes retain only bounded UI and verification facts', () => {
  const outcome = payloadCore.normalizeOutcome({
    status: 'warning',
    override: true,
    adapter: 'msfs_payload_stations',
    error: 'payload_unstable_aircraft_override',
    plan: {
      missionWeightLbs: 222,
      paxWeightLbs: 180,
      cargoWeightLbs: 42,
      payloadWeightLbs: 392,
      snapshot: { aircraft: { title: 'private raw simulator title' } },
      assignments: [{ label: 'private cargo label' }],
      stations: Array.from({ length: 28 }, (_, index) => ({
        index: index + 1,
        baselineWeightLbs: index === 0 ? 170 : 0,
        missionExtraLbs: index === 1 ? 180 : 0,
        weightLbs: index === 0 ? 170 : (index === 1 ? 180 : 0)
      }))
    },
    verification: {
      status: 'unstable',
      reason: 'station_mismatch',
      check: { checked: 20, maxDeltaLbs: 180, mismatches: Array.from({ length: 50 }, () => ({ private: true })) },
      pa24Check: { checked: 7, mismatches: [{ private: true }] },
      pa24ReassertAttempts: 1,
      maxStations: 28
    },
    updatedAt: 1234
  });

  assert.equal(outcome.schema, 'ga.mission-payload-outcome.v1');
  assert.equal(outcome.status, 'warning');
  assert.equal(outcome.override, true);
  assert.equal(outcome.plan.stations.length, 20);
  assert.equal(outcome.verification.mismatchCount, 40);
  assert.equal(outcome.verification.pa24MismatchCount, 1);
  assert.equal(outcome.verification.maxStations, 20);
  assert.doesNotMatch(JSON.stringify(outcome), /private|snapshot|assignments|mismatches/);
});

test('payload presentation reuses the exact App status copy', () => {
  const pending = payloadCore.projectOutcome({ status: 'pending' });
  assert.equal(pending.presentation.className, 'is-pending');
  assert.equal(pending.presentation.message, 'Aktueller Ladezustand wird an den Simulator uebertragen ...');

  const stable = payloadCore.projectOutcome({ status: 'ok', verification: { status: 'ok' } });
  assert.equal(stable.presentation.message, 'Sim-Zuladung stabil uebernommen.');

  const unstable = payloadCore.projectOutcome({
    status: 'warning',
    error: 'payload_unstable_aircraft_override',
    plan: { missionWeightLbs: 222, stations: [{ index: 2, weightLbs: 180 }] },
    verification: { status: 'unstable' }
  });
  assert.equal(unstable.presentation.className, 'is-warn');
  assert.match(unstable.presentation.message, /Missionszuladung: 222 lbs\./);
  assert.match(unstable.presentation.message, /Zielwerte: S2 180 lbs\./);
  assert.match(unstable.presentation.message, /Weight-&-Balance/);

  const pa24 = payloadCore.projectOutcome({ status: 'warning', error: 'pa24_no_free_seat' });
  assert.equal(pa24.presentation.message, 'In der Comanche ist kein freier Sitz fuer die geplante Zuladung vorhanden.');
});

test('payload queue timing keeps the App 500 ms quiet window and 2 s burst cap', () => {
  assert.equal(payloadCore.payloadSyncDelayMs(1000, 1000, 1000, false), 500);
  assert.equal(payloadCore.payloadSyncDelayMs(1700, 1000, 1700, false), 500);
  assert.equal(payloadCore.payloadSyncDelayMs(2900, 1000, 2900, false), 100);
  assert.equal(payloadCore.payloadSyncDelayMs(1200, 1000, 1200, true), 0);
  assert.equal(payloadCore.payloadSyncDelayMs(1200, 1000, 1200, false, {
    debounceMs: 75,
    maxWaitMs: 250
  }), 50);
});

test('PA24 character selectors without payload weight do not consume passenger seats', () => {
  const baseline = {
    ...standardBaseline(),
    payloadAdapter: payloadCore.PA24_ADAPTER,
    payloadStationCount: 20,
    sampledStationCount: 20,
    stations: Array.from({ length: 20 }, (_, index) => ({ index: index + 1, weightLbs: index === 0 ? 170 : 0 })),
    pa24: {
      // Accu-Sim retains these template selections even when the rear seats
      // are empty.  They must not be interpreted as three real passengers.
      seats: { 1: 1, 2: 2, 3: 3, 4: 4 },
      // Character weights are profile values and can remain non-zero even
      // when the corresponding payload stations above are empty.
      characterWeights: { 1: 170, 2: 180, 3: 165, 4: 155 },
      baggageWeightLbs: 10,
      totalWeightLbs: 2400,
      grossWeightLbs: 3000
    }
  };
  const manifest = { items: [
    { id: 'pax', itemType: 'passenger', status: 'loaded', passengerCount: 1, weightLbs: 180 },
    { id: 'bag', itemType: 'cargo', status: 'loaded', weightLbs: 16 }
  ] };
  const plan = payloadCore.buildPlanFromManifest(manifest, baseline, { isPassengerItem: item => item.itemType === 'passenger' });
  assert.equal(plan.error, undefined);
  assert.equal(plan.boardedPaxCount, 1);
  assert.equal(plan.pa24State.seats[2], 2);
  assert.equal(plan.pa24State.characterWeights[2], 180);
  assert.equal(plan.pa24State.baggageWeightLbs, 26);
});

test('inherited equipment detaches from standard and PA24 baselines exactly once', () => {
  const item = {
    id: 'survival-kit',
    itemType: 'cargo',
    label: 'Survival Kit',
    weightLbs: 20,
    persistentEquipment: true,
    persistentEquipmentInherited: true
  };
  const standard = standardBaseline();
  standard.totalWeightLbs += 20;
  standard.payloadWeightLbs += 20;
  standard.stations[4].weightLbs = 20;
  const detachedStandard = payloadCore.detachInheritedEquipmentFromBaseline(item, standard);
  assert.equal(detachedStandard.changed, true);
  assert.equal(detachedStandard.removedLbs, 20);
  assert.equal(detachedStandard.baseline.stations[4].weightLbs, 0);
  assert.equal(detachedStandard.baseline.totalWeightLbs, standard.totalWeightLbs - 20);

  const pa24 = {
    ...standard,
    payloadAdapter: payloadCore.PA24_ADAPTER,
    payloadStationCount: 20,
    sampledStationCount: 20,
    stations: Array.from({ length: 20 }, (_, index) => ({
      index: index + 1,
      weightLbs: index === 0 ? 170 : (index === 4 ? 12 : 0)
    })),
    pa24: {
      seats: { 1: 1, 2: 0, 3: 0, 4: 0 },
      characterWeights: { 1: 170, 2: 170, 3: 162, 4: 170 },
      baggageWeightLbs: 12,
      grossWeightLbs: 3000
    }
  };
  const detachedPa24 = payloadCore.detachInheritedEquipmentFromBaseline(item, pa24);
  assert.equal(detachedPa24.changed, true);
  assert.equal(detachedPa24.removedLbs, 12);
  assert.equal(detachedPa24.baseline.pa24.baggageWeightLbs, 0);
  assert.equal(detachedPa24.baseline.stations[4].weightLbs, 0);

  const alreadyDetached = payloadCore.detachInheritedEquipmentFromBaseline({
    ...item,
    persistentEquipmentInherited: false
  }, detachedStandard.baseline);
  assert.equal(alreadyDetached.changed, false);
  assert.deepEqual(alreadyDetached.baseline, detachedStandard.baseline);
});

test('restore planning mirrors App baseline and persistent-equipment reset rules', () => {
  const baseline = standardBaseline();
  const manifest = { items: [
    { id: 'pax', itemType: 'passenger', status: 'loaded', passengerCount: 1, weightLbs: 180 },
    { id: 'box', itemType: 'cargo', status: 'loaded', weightLbs: 42 }
  ] };
  const current = snapshotFromPlan(baseline, payloadCore.buildPlanFromManifest(manifest, baseline));
  const restore = payloadCore.buildRestorePlan(manifest, baseline, current);
  assert.equal(restore.ok, true);
  assert.equal(restore.source, 'baseline');
  assert.deepEqual(restore.stations, baseline.stations);

  const persistentManifest = { items: [
    { id: 'kit', itemType: 'cargo', status: 'loaded', weightLbs: 20, persistentEquipment: true },
    { id: 'box', itemType: 'cargo', status: 'loaded', weightLbs: 42 }
  ] };
  const persistentCurrent = snapshotFromPlan(
    baseline,
    payloadCore.buildPlanFromManifest(persistentManifest, baseline)
  );
  const persistentRestore = payloadCore.buildRestorePlan(persistentManifest, baseline, persistentCurrent);
  const expectedPersistent = payloadCore.estimatePersistentStationsFromBaseline(persistentManifest, baseline);
  assert.equal(persistentRestore.source, 'current-minus-mission');
  assert.deepEqual(persistentRestore.stations, expectedPersistent);
});

test('restore planning retains App current-snapshot fallback when station layouts changed', () => {
  const baseline = standardBaseline();
  const currentBaseline = {
    ...baseline,
    payloadStationCount: 4,
    sampledStationCount: 4,
    stations: baseline.stations.slice(0, 4)
  };
  const manifest = { items: [{ id: 'box', itemType: 'cargo', status: 'loaded', weightLbs: 42 }] };
  const current = snapshotFromPlan(currentBaseline, payloadCore.buildPlanFromManifest(manifest, currentBaseline));
  const restore = payloadCore.buildRestorePlan(manifest, baseline, current);
  assert.equal(restore.source, 'current-minus-mission');
  assert.deepEqual(restore.stations, currentBaseline.stations);
});

test('PA24 restore plan carries baseline seats, character weights, and baggage', () => {
  const baseline = {
    ...standardBaseline(),
    payloadAdapter: payloadCore.PA24_ADAPTER,
    payloadStationCount: 20,
    sampledStationCount: 20,
    stations: Array.from({ length: 20 }, (_, index) => ({
      index: index + 1,
      weightLbs: index === 0 ? 170 : (index === 2 ? 162 : (index === 4 ? 10 : 0))
    })),
    pa24: {
      seats: { 1: 1, 2: 0, 3: 3, 4: 0 },
      characterWeights: { 1: 170, 2: 170, 3: 162, 4: 170 },
      baggageWeightLbs: 10,
      grossWeightLbs: 3000
    }
  };
  const manifest = { items: [
    { id: 'pax', itemType: 'passenger', status: 'loaded', passengerCount: 1, weightLbs: 180 },
    { id: 'docs', itemType: 'cargo', status: 'loaded', weightLbs: 20 }
  ] };
  const restore = payloadCore.buildRestorePlan(manifest, baseline, baseline);
  assert.equal(restore.ok, true);
  assert.equal(restore.payloadAdapter, payloadCore.PA24_ADAPTER);
  assert.equal(restore.source, 'pa24-baseline');
  assert.deepEqual(restore.pa24State, payloadCore.pa24StateFromSnapshot(baseline));
  assert.equal(restore.stations.find(row => row.index === 3).weightLbs, 162);
  assert.equal(restore.stations.find(row => row.index === 5).weightLbs, 10);
});
