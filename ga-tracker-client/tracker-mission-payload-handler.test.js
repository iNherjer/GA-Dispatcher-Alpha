'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const executionCore = require('../mission-execution-core.js');
const payloadCore = require('../mission-payload-core.js');
const { createTrackerMissionPayloadHandler } = require('./tracker-mission-payload-handler.js');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createRecoveryStore() {
  let recovery = null;
  return {
    get value() { return clone(recovery); },
    get: async () => clone(recovery),
    record: async request => {
      if (request.action === 'capture') {
        if (!recovery) {
          recovery = {
            baseline: clone(request.baseline),
            writeAttempted: false,
            restoreAttempts: 0,
            detachedInheritedEquipmentIds: [],
            restored: false,
            lastError: null
          };
        }
      } else if (!recovery) {
        return { ok: false, error: 'mission_payload_baseline_missing' };
      } else if (request.action === 'write_attempted') {
        recovery.writeAttempted = true;
        recovery.restored = false;
      } else if (request.action === 'restore_attempt') {
        recovery.restoreAttempts += 1;
        recovery.lastError = null;
      } else if (request.action === 'restored') {
        recovery.restored = true;
        recovery.lastError = null;
      } else if (request.action === 'restore_failed') {
        recovery.restored = false;
        recovery.lastError = request.error;
      } else if (request.action === 'detach_inherited') {
        const itemId = String(request.item?.id || '');
        if (!itemId) return { ok: false, error: 'mission_payload_equipment_id_required' };
        if (!recovery.detachedInheritedEquipmentIds.includes(itemId)) {
          const detached = payloadCore.detachInheritedEquipmentFromBaseline(request.item, recovery.baseline);
          recovery.baseline = clone(detached.baseline);
          recovery.detachedInheritedEquipmentIds.push(itemId);
        }
      }
      return { ok: true, status: 'ok', recovery: clone(recovery) };
    }
  };
}

function effectFor(manifest, payloadContext = null) {
  const normalized = executionCore.normalizeManifest(manifest);
  return {
    type: 'payload.sync_before_start',
    payload: {
      manifestStateHash: executionCore.hashValue(normalized),
      payloadContext
    }
  };
}

function manifestEffectFor(manifest, transition = null) {
  const effect = effectFor(manifest);
  effect.type = 'payload.sync_manifest_state';
  effect.payload.transition = transition;
  return effect;
}

async function waitUntil(predicate, attempts = 80) {
  for (let index = 0; index < attempts; index += 1) {
    if (predicate()) return true;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  return false;
}

function standardBaseline() {
  return {
    payloadAdapter: 'msfs_payload_stations',
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

function pa24Baseline() {
  return {
    ...standardBaseline(),
    payloadAdapter: 'pa24_accusim',
    totalWeightLbs: 2400,
    emptyWeightLbs: 1735,
    payloadWeightLbs: 180,
    payloadStationCount: 20,
    sampledStationCount: 20,
    stations: Array.from({ length: 20 }, (_, index) => ({
      index: index + 1,
      weightLbs: index === 0 ? 170 : (index === 4 ? 10 : 0)
    })),
    pa24: {
      seats: { 1: 1, 2: 0, 3: 0, 4: 0 },
      characterWeights: { 1: 170, 2: 170, 3: 162, 4: 170 },
      baggageWeightLbs: 10,
      payloadWeightLbs: 180,
      totalWeightLbs: 2410,
      emptyWeightLbs: 1735,
      grossWeightLbs: 3000
    }
  };
}

test('standard payload uses the shared app plan and both legacy verification delays', async () => {
  const manifest = { items: [
    { id: 'pax', itemType: 'passenger', status: 'loaded', passengerCount: 1, weightLbs: 180 },
    { id: 'box', itemType: 'cargo', status: 'loaded', weightLbs: 42, label: 'Kiste' }
  ] };
  let snapshot = standardBaseline();
  const waits = [];
  const applied = [];
  const handler = createTrackerMissionPayloadHandler({
    readSnapshot: async () => clone(snapshot),
    applyStations: async stations => {
      applied.push(clone(stations));
      snapshot = {
        ...snapshot,
        stations: snapshot.stations.map(row => ({
          ...row,
          weightLbs: stations.find(target => target.index === row.index)?.weightLbs ?? row.weightLbs
        }))
      };
      return { changed: stations.length, stations };
    },
    applyPa24State: async () => { throw new Error('unexpected_pa24_write'); },
    reassertPa24Seats: async () => { throw new Error('unexpected_pa24_reassert'); },
    sleep: async milliseconds => { waits.push(milliseconds); }
  });

  const result = await handler.syncBeforeStart({ missionId: 'apt-standard', manifest, effect: effectFor(manifest) });
  assert.equal(result.ok, true);
  assert.equal(result.payloadStatus, 'ok');
  assert.equal(result.payloadOverride, false);
  assert.equal(applied.length, 1);
  assert.deepEqual(waits, [900, 2400]);
  assert.equal(result.payloadPlan.missionWeightLbs, 222);
  assert.equal(result.payloadVerification.status, 'ok');
  assert.equal(result.payloadOutcome.schema, 'ga.mission-payload-outcome.v1');
  assert.equal(result.payloadOutcome.status, 'ok');
  assert.equal(result.payloadOutcome.plan.missionWeightLbs, 222);
  assert.doesNotMatch(JSON.stringify(result.payloadOutcome), /snapshot|assignments/);
});

test('PA24 payload preserves post-write seat reassert and one verification retry', async () => {
  const manifest = { items: [
    { id: 'pax', itemType: 'passenger', status: 'loaded', passengerCount: 1, weightLbs: 180 },
    { id: 'docs', itemType: 'cargo', status: 'loaded', weightLbs: 20, label: 'Unterlagen' }
  ] };
  let snapshot = pa24Baseline();
  let verificationRead = 0;
  const waits = [];
  const reassertions = [];
  const handler = createTrackerMissionPayloadHandler({
    readSnapshot: async () => {
      if (snapshot.pa24.seats[2] > 0) verificationRead += 1;
      const current = clone(snapshot);
      if (verificationRead === 1) current.pa24.seats[2] = 0;
      return current;
    },
    applyStations: async () => { throw new Error('unexpected_standard_write'); },
    applyPa24State: async state => {
      snapshot.pa24 = { ...snapshot.pa24, ...clone(state) };
      snapshot.stations = snapshot.stations.map(row => {
        if (row.index === 2) return { ...row, weightLbs: state.characterWeights[state.seats[2]] };
        if (row.index === 5) return { ...row, weightLbs: state.baggageWeightLbs };
        return row;
      });
      return { changed: 4, state };
    },
    reassertPa24Seats: async (state, options) => {
      reassertions.push(options.reason);
      snapshot.pa24.seats = clone(state.seats);
      return { status: 'ok' };
    },
    sleep: async milliseconds => { waits.push(milliseconds); }
  });

  const result = await handler.syncBeforeStart({ missionId: 'apt-pa24', manifest, effect: effectFor(manifest) });
  assert.equal(result.ok, true);
  assert.equal(result.payloadStatus, 'ok');
  assert.deepEqual(waits, [220, 350, 650]);
  assert.deepEqual(reassertions, ['pa24-payload-seat-post-write', 'pa24-payload-seat-verify-retry']);
  assert.equal(result.payloadVerification.pa24ReassertAttempts, 1);
});

test('aircraft refusal and invalid plans keep the App payload override semantics', async () => {
  const manifest = { items: [
    { id: 'pax', itemType: 'passenger', status: 'loaded', passengerCount: 1, weightLbs: 180 }
  ] };
  const overweight = { ...pa24Baseline(), totalWeightLbs: 2950 };
  let applyCalls = 0;
  const invalidHandler = createTrackerMissionPayloadHandler({
    readSnapshot: async () => clone(overweight),
    applyStations: async () => { applyCalls += 1; },
    applyPa24State: async () => { applyCalls += 1; },
    reassertPa24Seats: async () => {},
    sleep: async () => {}
  });
  const invalid = await invalidHandler.syncBeforeStart({ missionId: 'apt-overweight', manifest, effect: effectFor(manifest) });
  assert.equal(invalid.ok, true);
  assert.equal(invalid.status, 'completed');
  assert.equal(invalid.payloadOverride, true);
  assert.equal(invalid.payloadError, 'pa24_gross_weight_exceeded');
  assert.equal(invalid.payloadOutcome.status, 'warning');
  assert.equal(invalid.payloadOutcome.override, true);
  assert.equal(applyCalls, 0);

  const refusedHandler = createTrackerMissionPayloadHandler({
    readSnapshot: async () => clone(standardBaseline()),
    applyStations: async () => { throw new Error('aircraft_refused_payload'); },
    applyPa24State: async () => {},
    reassertPa24Seats: async () => {},
    sleep: async () => {}
  });
  const refused = await refusedHandler.syncBeforeStart({ missionId: 'apt-refused', manifest, effect: effectFor(manifest) });
  assert.equal(refused.ok, true);
  assert.equal(refused.status, 'completed');
  assert.equal(refused.payloadOverride, true);
  assert.equal(refused.payloadError, 'aircraft_refused_payload');
});

test('manifest hash mismatch never writes stale payload values', async () => {
  const manifest = { items: [{ id: 'box', itemType: 'cargo', status: 'loaded', weightLbs: 20 }] };
  let writes = 0;
  const handler = createTrackerMissionPayloadHandler({
    readSnapshot: async () => standardBaseline(),
    applyStations: async () => { writes += 1; },
    applyPa24State: async () => { writes += 1; },
    reassertPa24Seats: async () => { writes += 1; },
    sleep: async () => {}
  });
  const effect = effectFor(manifest);
  effect.payload.manifestStateHash = 'mex1-stale';
  const result = await handler.syncBeforeStart({ missionId: 'apt-stale', manifest, effect });
  assert.equal(result.ok, true);
  assert.equal(result.payloadOverride, true);
  assert.equal(result.payloadError, 'payload_manifest_state_changed');
  assert.equal(writes, 0);
});

test('incremental payload queue coalesces rapid manifest changes to the latest App state', async () => {
  const firstManifest = { items: [
    { id: 'box-a', itemType: 'cargo', status: 'loaded', weightLbs: 20 }
  ] };
  const latestManifest = { items: [
    ...firstManifest.items,
    { id: 'box-b', itemType: 'cargo', status: 'loaded', weightLbs: 30 }
  ] };
  let snapshot = standardBaseline();
  const writes = [];
  const handler = createTrackerMissionPayloadHandler({
    readSnapshot: async () => clone(snapshot),
    applyStations: async stations => {
      writes.push(clone(stations));
      snapshot.stations = snapshot.stations.map(row => ({
        ...row,
        weightLbs: stations.find(target => target.index === row.index)?.weightLbs ?? row.weightLbs
      }));
      return { stations };
    },
    applyPa24State: async () => { throw new Error('unexpected_pa24_write'); },
    reassertPa24Seats: async () => {},
    sleep: async () => {},
    payloadSyncDebounceMs: 10,
    payloadSyncMaxWaitMs: 40
  });

  const first = handler.scheduleManifestSync({
    missionId: 'apt-queue',
    runId: 'run-queue',
    manifest: firstManifest,
    effect: manifestEffectFor(firstManifest, { action: 'load', itemId: 'box-a' })
  });
  const latest = handler.scheduleManifestSync({
    missionId: 'apt-queue',
    runId: 'run-queue',
    manifest: latestManifest,
    effect: manifestEffectFor(latestManifest, { action: 'load', itemId: 'box-b' })
  });
  const [firstResult, latestResult] = await Promise.all([first, latest]);
  assert.equal(writes.length, 1);
  assert.equal(firstResult.payloadPlan.missionWeightLbs, 50);
  assert.equal(latestResult.payloadPlan.missionWeightLbs, 50);
  assert.equal(handler.getQueueState().queued, false);
});

test('a newer manifest supersedes an in-flight verification and writes from the first baseline', async () => {
  const firstManifest = { items: [
    { id: 'box-a', itemType: 'cargo', status: 'loaded', weightLbs: 20 }
  ] };
  const latestManifest = { items: [
    ...firstManifest.items,
    { id: 'box-b', itemType: 'cargo', status: 'loaded', weightLbs: 30 }
  ] };
  const original = standardBaseline();
  let snapshot = clone(original);
  let releaseVerification = null;
  let blockVerification = true;
  const recovery = createRecoveryStore();
  const writes = [];
  const handler = createTrackerMissionPayloadHandler({
    readSnapshot: async () => clone(snapshot),
    applyStations: async stations => {
      writes.push(clone(stations));
      snapshot.stations = snapshot.stations.map(row => ({
        ...row,
        weightLbs: stations.find(target => target.index === row.index)?.weightLbs ?? row.weightLbs
      }));
      return { stations };
    },
    applyPa24State: async () => { throw new Error('unexpected_pa24_write'); },
    reassertPa24Seats: async () => {},
    recordRecovery: recovery.record,
    getRecovery: recovery.get,
    sleep: async () => {
      if (!blockVerification) return;
      await new Promise(resolve => { releaseVerification = resolve; });
      blockVerification = false;
    },
    payloadSyncDebounceMs: 0,
    payloadSyncMaxWaitMs: 0
  });

  const first = handler.scheduleManifestSync({
    missionId: 'apt-single-flight',
    runId: 'run-single-flight',
    manifest: firstManifest,
    effect: manifestEffectFor(firstManifest, { action: 'load', itemId: 'box-a' })
  });
  assert.equal(await waitUntil(() => writes.length === 1 && typeof releaseVerification === 'function'), true);
  const latest = handler.scheduleManifestSync({
    missionId: 'apt-single-flight',
    runId: 'run-single-flight',
    manifest: latestManifest,
    effect: manifestEffectFor(latestManifest, { action: 'load', itemId: 'box-b' })
  });
  releaseVerification();
  const [firstResult, latestResult] = await Promise.all([first, latest]);
  assert.equal(firstResult.status, 'superseded');
  assert.equal(latestResult.payloadStatus, 'ok');
  assert.equal(latestResult.payloadPlan.missionWeightLbs, 50);
  assert.equal(writes.length, 2);
  assert.deepEqual(recovery.value.baseline.stations, original.stations);
});

test('all inherited-equipment detachments survive debounce coalescing and repeated effects', async () => {
  const original = standardBaseline();
  original.totalWeightLbs += 30;
  original.payloadWeightLbs += 30;
  original.stations[4].weightLbs = 30;
  let snapshot = clone(original);
  const recovery = createRecoveryStore();
  const writes = [];
  const kit = {
    id: 'kit', itemType: 'cargo', status: 'unloaded', weightLbs: 20,
    persistentEquipment: true, persistentEquipmentInherited: false
  };
  const extinguisher = {
    id: 'extinguisher', itemType: 'cargo', status: 'unloaded', weightLbs: 10,
    persistentEquipment: true, persistentEquipmentInherited: false
  };
  const firstManifest = { items: [kit, { ...extinguisher, status: 'loaded', persistentEquipmentInherited: true }] };
  const latestManifest = { items: [kit, extinguisher] };
  const transition = item => ({
    action: 'unload',
    itemId: item.id,
    detachedInheritedEquipment: { ...item, status: 'loaded', persistentEquipmentInherited: true }
  });
  const handler = createTrackerMissionPayloadHandler({
    readSnapshot: async () => clone(snapshot),
    applyStations: async stations => {
      writes.push(clone(stations));
      snapshot.stations = snapshot.stations.map(row => ({
        ...row,
        weightLbs: stations.find(target => target.index === row.index)?.weightLbs ?? row.weightLbs
      }));
      return { stations };
    },
    applyPa24State: async () => { throw new Error('unexpected_pa24_write'); },
    reassertPa24Seats: async () => {},
    recordRecovery: recovery.record,
    getRecovery: recovery.get,
    sleep: async () => {},
    payloadSyncDebounceMs: 10,
    payloadSyncMaxWaitMs: 40
  });

  await Promise.all([
    handler.scheduleManifestSync({
      missionId: 'apt-equipment', runId: 'run-equipment', manifest: firstManifest,
      effect: manifestEffectFor(firstManifest, transition({ ...kit, persistentEquipmentInherited: true }))
    }),
    handler.scheduleManifestSync({
      missionId: 'apt-equipment', runId: 'run-equipment', manifest: latestManifest,
      effect: manifestEffectFor(latestManifest, transition({ ...extinguisher, persistentEquipmentInherited: true }))
    })
  ]);
  assert.equal(writes.length, 1);
  assert.deepEqual(recovery.value.detachedInheritedEquipmentIds, ['kit', 'extinguisher']);
  assert.equal(recovery.value.baseline.stations[4].weightLbs, 0);

  await handler.scheduleManifestSync({
    missionId: 'apt-equipment', runId: 'run-equipment', manifest: latestManifest,
    effect: manifestEffectFor(latestManifest, transition({ ...kit, persistentEquipmentInherited: true }))
  });
  assert.equal(recovery.value.baseline.stations[4].weightLbs, 0);
  assert.deepEqual(recovery.value.detachedInheritedEquipmentIds, ['kit', 'extinguisher']);
});

test('simulator detach cancels a queued payload write without acknowledging stale state', async () => {
  const manifest = { items: [
    { id: 'box', itemType: 'cargo', status: 'loaded', weightLbs: 20 }
  ] };
  let writes = 0;
  const handler = createTrackerMissionPayloadHandler({
    readSnapshot: async () => standardBaseline(),
    applyStations: async () => { writes += 1; },
    applyPa24State: async () => { writes += 1; },
    reassertPa24Seats: async () => { writes += 1; },
    sleep: async () => {},
    payloadSyncDebounceMs: 100,
    payloadSyncMaxWaitMs: 200
  });
  const queued = handler.scheduleManifestSync({
    missionId: 'apt-cancel',
    runId: 'run-cancel',
    manifest,
    effect: manifestEffectFor(manifest, { action: 'load', itemId: 'box' })
  });
  await handler.cancelPayloadSyncQueue('simulator-detached');
  const result = await queued;
  assert.equal(result.status, 'cancelled');
  assert.equal(result.payloadOutcome, null);
  assert.equal(writes, 0);
  assert.equal(handler.getQueueState().queued, false);
});

test('standard payload keeps the first baseline and restores it before abort', async () => {
  const manifest = { items: [
    { id: 'pax', itemType: 'passenger', status: 'loaded', passengerCount: 1, weightLbs: 180 },
    { id: 'box', itemType: 'cargo', status: 'loaded', weightLbs: 42 }
  ] };
  const original = standardBaseline();
  let snapshot = clone(original);
  const recovery = createRecoveryStore();
  const writes = [];
  const handler = createTrackerMissionPayloadHandler({
    readSnapshot: async () => clone(snapshot),
    applyStations: async stations => {
      writes.push(clone(stations));
      snapshot.stations = snapshot.stations.map(row => ({
        ...row,
        weightLbs: stations.find(target => target.index === row.index)?.weightLbs ?? row.weightLbs
      }));
      return { stations: clone(stations) };
    },
    applyPa24State: async () => { throw new Error('unexpected_pa24_write'); },
    reassertPa24Seats: async () => { throw new Error('unexpected_pa24_reassert'); },
    recordRecovery: recovery.record,
    getRecovery: recovery.get,
    sleep: async () => {}
  });

  const request = { missionId: 'apt-restore-standard', runId: 'run-1', manifest, effect: effectFor(manifest) };
  assert.equal((await handler.syncBeforeStart(request)).payloadStatus, 'ok');
  const firstLoadedStations = clone(snapshot.stations);
  assert.notDeepEqual(firstLoadedStations, original.stations);
  assert.equal(recovery.value.writeAttempted, true);
  assert.deepEqual(recovery.value.baseline.stations, original.stations);

  // A repeated effect must target the first baseline, not add mission weight a second time.
  assert.equal((await handler.syncBeforeStart(request)).payloadStatus, 'ok');
  assert.deepEqual(snapshot.stations, firstLoadedStations);

  const restored = await handler.restoreForAbort({
    missionId: request.missionId,
    runId: request.runId,
    manifest
  });
  assert.equal(restored.ok, true);
  assert.equal(restored.restored, true);
  assert.deepEqual(snapshot.stations, original.stations);
  assert.equal(recovery.value.restored, true);
  assert.equal(writes.length, 3);
});

test('a replacement mission uses the last unresolved compatible baseline instead of adding stale mission cargo', async () => {
  const original = standardBaseline();
  const staleMissionLoad = clone(original);
  staleMissionLoad.stations = staleMissionLoad.stations.map(row => ({
    ...row,
    weightLbs: row.index === 2 ? 90 : row.weightLbs
  }));
  const nextManifest = { items: [
    { id: 'new-mission-box', itemType: 'cargo', status: 'loaded', weightLbs: 42 }
  ] };
  const recovery = createRecoveryStore();
  let snapshot = clone(staleMissionLoad);
  const writes = [];
  const handler = createTrackerMissionPayloadHandler({
    readSnapshot: async () => clone(snapshot),
    applyStations: async stations => {
      writes.push(clone(stations));
      snapshot.stations = snapshot.stations.map(row => ({
        ...row,
        weightLbs: stations.find(target => target.index === row.index)?.weightLbs ?? row.weightLbs
      }));
      return { stations: clone(stations) };
    },
    applyPa24State: async () => { throw new Error('unexpected_pa24_write'); },
    reassertPa24Seats: async () => { throw new Error('unexpected_pa24_reassert'); },
    recordRecovery: recovery.record,
    getRecovery: recovery.get,
    getPreviousRecovery: async () => ({
      missionId: 'apt-old',
      runId: 'run-old',
      recovery: { baseline: clone(original), writeAttempted: true, restored: false }
    }),
    sleep: async () => {}
  });

  const request = {
    missionId: 'apt-new',
    runId: 'run-new',
    manifest: nextManifest,
    effect: effectFor(nextManifest)
  };
  const result = await handler.syncBeforeStart(request);
  assert.equal(result.payloadStatus, 'ok');
  assert.equal(result.payloadPlan.missionWeightLbs, 42);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].find(row => row.index === 2).weightLbs, 0);
  assert.equal(writes[0].filter(row => row.index !== 1).reduce((sum, row) => sum + row.weightLbs, 0), 42);
  assert.equal(recovery.value.baseline.stations.find(row => row.index === 2).weightLbs, 0);
  assert.equal(snapshot.stations.find(row => row.index === 2).weightLbs, 0);
  assert.equal(snapshot.stations.filter(row => row.index !== 1).reduce((sum, row) => sum + row.weightLbs, 0), 42);
});

test('PA24 abort restore reapplies baseline seats, characters, and baggage', async () => {
  const manifest = { items: [
    { id: 'pax', itemType: 'passenger', status: 'loaded', passengerCount: 1, weightLbs: 180 },
    { id: 'docs', itemType: 'cargo', status: 'loaded', weightLbs: 20 }
  ] };
  const original = pa24Baseline();
  let snapshot = clone(original);
  const recovery = createRecoveryStore();
  const handler = createTrackerMissionPayloadHandler({
    readSnapshot: async () => clone(snapshot),
    applyStations: async () => { throw new Error('unexpected_standard_write'); },
    applyPa24State: async state => {
      snapshot.pa24 = {
        ...snapshot.pa24,
        ...clone(state),
        seats: { ...snapshot.pa24.seats, ...clone(state.seats) },
        characterWeights: { ...snapshot.pa24.characterWeights, ...clone(state.characterWeights) }
      };
      snapshot.stations = snapshot.stations.map(row => {
        if (row.index >= 2 && row.index <= 4) {
          const character = Number(state.seats[row.index] || 0);
          return { ...row, weightLbs: character > 0 ? Number(state.characterWeights[character] || 0) : 0 };
        }
        if (row.index === 5) return { ...row, weightLbs: state.baggageWeightLbs };
        return row;
      });
      return { state: clone(state) };
    },
    reassertPa24Seats: async state => {
      snapshot.pa24.seats = { ...snapshot.pa24.seats, ...clone(state.seats) };
      return { status: 'ok' };
    },
    recordRecovery: recovery.record,
    getRecovery: recovery.get,
    sleep: async () => {}
  });
  const request = { missionId: 'apt-restore-pa24', runId: 'run-pa24', manifest, effect: effectFor(manifest) };
  assert.equal((await handler.syncBeforeStart(request)).payloadStatus, 'ok');
  assert.notDeepEqual(snapshot.pa24.seats, original.pa24.seats);
  const restored = await handler.restoreForAbort({ missionId: request.missionId, runId: request.runId, manifest });
  assert.equal(restored.ok, true);
  assert.deepEqual(snapshot.pa24.seats, original.pa24.seats);
  assert.deepEqual(snapshot.pa24.characterWeights, original.pa24.characterWeights);
  assert.equal(snapshot.pa24.baggageWeightLbs, original.pa24.baggageWeightLbs);
  assert.equal(recovery.value.restored, true);
});

test('failed payload restore remains retryable and does not mark the baseline restored', async () => {
  const manifest = { items: [{ id: 'box', itemType: 'cargo', status: 'loaded', weightLbs: 42 }] };
  let snapshot = standardBaseline();
  let rejectRestore = false;
  const recovery = createRecoveryStore();
  const handler = createTrackerMissionPayloadHandler({
    readSnapshot: async () => clone(snapshot),
    applyStations: async stations => {
      if (rejectRestore) throw new Error('sim_restore_refused');
      snapshot = {
        ...snapshot,
        stations: snapshot.stations.map(row => ({
          ...row,
          weightLbs: stations.find(target => target.index === row.index)?.weightLbs ?? row.weightLbs
        }))
      };
      return { stations };
    },
    applyPa24State: async () => {},
    reassertPa24Seats: async () => {},
    recordRecovery: recovery.record,
    getRecovery: recovery.get,
    sleep: async () => {}
  });
  const request = { missionId: 'apt-restore-retry', runId: 'run-retry', manifest, effect: effectFor(manifest) };
  assert.equal((await handler.syncBeforeStart(request)).payloadStatus, 'ok');
  rejectRestore = true;
  const failed = await handler.restoreForAbort({ missionId: request.missionId, runId: request.runId, manifest });
  assert.equal(failed.ok, false);
  assert.equal(failed.error, 'sim_restore_refused');
  assert.equal(recovery.value.restored, false);
  assert.equal(recovery.value.lastError, 'sim_restore_refused');
  rejectRestore = false;
  const retried = await handler.restoreForAbort({ missionId: request.missionId, runId: request.runId, manifest });
  assert.equal(retried.ok, true);
  assert.equal(recovery.value.restored, true);
  assert.equal(recovery.value.restoreAttempts, 2);
});
