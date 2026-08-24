'use strict';

const executionCore = require('../mission-execution-core.js');
const manifestCore = require('../mission-manifest-core.js');
const payloadCore = require('../mission-payload-core.js');

const STANDARD_VERIFY_DELAYS_MS = Object.freeze([900, 2400]);
const PA24_VERIFY_DELAYS_MS = Object.freeze([350, 650]);
const PA24_SEAT_REASSERT_DELAY_MS = 220;

function cleanString(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function payloadOutcome(details = {}) {
  return payloadCore.normalizeOutcome({
    status: details.payloadStatus,
    override: details.payloadOverride,
    adapter: details.payloadAdapter,
    error: details.payloadError,
    plan: details.payloadPlan,
    verification: details.payloadVerification,
    weightAndBalance: details.snapshot || details.payloadSnapshot
  });
}

function warningResult(error, details = {}) {
  const result = {
    ok: true,
    status: 'completed',
    sideEffect: details.sideEffect === true,
    payloadOverride: true,
    payloadStatus: 'warning',
    payloadError: cleanString(error) || 'payload_sync_failed',
    ...details
  };
  result.payloadOutcome = payloadOutcome(result);
  return result;
}

function supersededResult(details = {}) {
  return {
    ok: true,
    status: 'superseded',
    sideEffect: details.sideEffect === true,
    payloadOutcome: null,
    ...details
  };
}

function createTrackerMissionPayloadHandler(options = {}) {
  const readSnapshot = typeof options.readSnapshot === 'function' ? options.readSnapshot : null;
  const applyStations = typeof options.applyStations === 'function' ? options.applyStations : null;
  const applyPa24State = typeof options.applyPa24State === 'function' ? options.applyPa24State : null;
  const reassertPa24Seats = typeof options.reassertPa24Seats === 'function' ? options.reassertPa24Seats : null;
  const recordRecovery = typeof options.recordRecovery === 'function' ? options.recordRecovery : null;
  const getRecovery = typeof options.getRecovery === 'function' ? options.getRecovery : null;
  const getPreviousRecovery = typeof options.getPreviousRecovery === 'function' ? options.getPreviousRecovery : null;
  const wait = typeof options.sleep === 'function'
    ? options.sleep
    : milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  const log = typeof options.log === 'function' ? options.log : () => {};
  const clock = typeof options.now === 'function' ? options.now : () => Date.now();
  const payloadSyncDebounceMs = Number.isFinite(Number(options.payloadSyncDebounceMs))
    ? Math.max(0, Number(options.payloadSyncDebounceMs))
    : payloadCore.PAYLOAD_SYNC_DEBOUNCE_MS;
  const payloadSyncMaxWaitMs = Number.isFinite(Number(options.payloadSyncMaxWaitMs))
    ? Math.max(0, Number(options.payloadSyncMaxWaitMs))
    : payloadCore.PAYLOAD_SYNC_MAX_WAIT_MS;

  if (!readSnapshot || !applyStations || !applyPa24State || !reassertPa24Seats) {
    throw new TypeError('tracker_mission_payload_handler_simulator_adapter_required');
  }

  const recoveryRequest = (request, action, details = {}) => ({
    missionId: cleanString(request.missionId),
    runId: cleanString(request.runId, 220),
    commandId: cleanString(request.commandId, 220),
    action,
    ...details
  });

  const plannerOptionsFor = (manifest, payloadContext = {}) => ({
    fallbackPaxCount: Number.isFinite(Number(payloadContext.fallbackPaxCount))
      ? Math.max(0, Math.round(Number(payloadContext.fallbackPaxCount)))
      : (Array.isArray(manifest.items) ? manifest.items : [])
        .filter(item => manifestCore.isPassengerItem(item) && item.status === 'loaded')
        .reduce((sum, item) => sum + Math.max(1, Math.round(Number(item.passengerCount) || 1)), 0),
    fallbackPaxWeightLbs: Number.isFinite(Number(payloadContext.fallbackPaxWeightLbs))
      ? Math.max(1, Number(payloadContext.fallbackPaxWeightLbs))
      : 180,
    isPassengerItem: manifestCore.isPassengerItem
  });

  const compatiblePriorBaseline = (previous = {}, liveBaseline = null) => {
    const entry = safeObject(previous);
    const recovery = safeObject(entry.recovery);
    const baseline = payloadCore.normalizeSnapshot(recovery.baseline);
    if (!baseline || !liveBaseline || recovery.writeAttempted !== true || recovery.restored === true) return null;
    if (baseline.payloadAdapter !== liveBaseline.payloadAdapter
        || baseline.payloadStationCount !== liveBaseline.payloadStationCount) return null;
    const previousTitle = cleanString(safeObject(baseline.aircraft).title, 240);
    const liveTitle = cleanString(safeObject(liveBaseline.aircraft).title, 240);
    if (previousTitle && liveTitle && previousTitle !== liveTitle) return null;
    return {
      baseline,
      missionId: cleanString(entry.missionId),
      runId: cleanString(entry.runId, 220)
    };
  };

  const resolvePayloadBaseline = async (request = {}) => {
    let currentRecovery = null;
    if (getRecovery) currentRecovery = await getRecovery(recoveryRequest(request, 'get'));
    const currentBaseline = payloadCore.normalizeSnapshot(safeObject(currentRecovery).baseline);
    if (currentBaseline) return { baseline: currentBaseline, currentRecovery, source: 'current-recovery' };

    const liveBaseline = payloadCore.normalizeSnapshot(await readSnapshot(20));
    if (!liveBaseline) return { baseline: null, currentRecovery: null, source: 'none' };
    let prior = null;
    if (getPreviousRecovery) {
      const previous = await getPreviousRecovery(recoveryRequest(request, 'previous'));
      prior = compatiblePriorBaseline(previous, liveBaseline);
    }
    if (prior) {
      log(`MISSION_PAYLOAD_BASELINE_CARRYOVER mission=${cleanString(request.missionId) || 'none'} previous=${prior.missionId || 'unknown'}`);
      return { baseline: prior.baseline, currentRecovery: null, source: 'previous-recovery', previous: prior };
    }
    return { baseline: liveBaseline, currentRecovery: null, source: 'live-snapshot' };
  };

  const runPayloadSync = async (request = {}, syncContext = {}) => {
    const isCurrent = typeof syncContext.isCurrent === 'function' ? syncContext.isCurrent : () => true;
    const manifest = safeObject(request.manifest);
    const effectPayload = safeObject(request.effect?.payload);
    const payloadContext = safeObject(request.payloadContext || effectPayload.payloadContext);
    const expectedManifestHash = cleanString(effectPayload.manifestStateHash, 180);
    const actualManifestHash = executionCore.hashValue(executionCore.normalizeManifest(manifest));
    if (!Array.isArray(manifest.items)) {
      return warningResult('payload_manifest_missing', { sideEffect: false });
    }
    if (expectedManifestHash && expectedManifestHash !== actualManifestHash) {
      return warningResult('payload_manifest_state_changed', {
        sideEffect: false,
        expectedManifestHash,
        actualManifestHash
      });
    }

    const plannerOptions = plannerOptionsFor(manifest, payloadContext);

    let baselineResolution;
    try {
      baselineResolution = await resolvePayloadBaseline(request);
    } catch (error) {
      return warningResult(error?.code || error?.message || error, { sideEffect: false });
    }
    let baseline = baselineResolution?.baseline || null;
    if (!baseline) return warningResult('no_baseline', { sideEffect: false });
    if (recordRecovery) {
      let captured;
      if (baselineResolution?.currentRecovery) {
        captured = { ok: true, status: 'noop', recovery: baselineResolution.currentRecovery };
      } else {
        try {
          captured = await recordRecovery(recoveryRequest(request, 'capture', { baseline }));
        } catch (error) {
          captured = { ok: false, error: error?.code || error?.message || String(error) };
        }
      }
      if (!captured?.ok) {
        return warningResult(captured?.error || 'mission_payload_recovery_persist_failed', { sideEffect: false });
      }
      baseline = payloadCore.normalizeSnapshot(captured.recovery?.baseline) || baseline;
    }
    const detachedInheritedEquipment = safeObject(safeObject(effectPayload.transition).detachedInheritedEquipment);
    if (detachedInheritedEquipment.id && recordRecovery) {
      let adjusted;
      try {
        adjusted = await recordRecovery(recoveryRequest(request, 'detach_inherited', {
          item: detachedInheritedEquipment
        }));
      } catch (error) {
        adjusted = { ok: false, error: error?.code || error?.message || String(error) };
      }
      if (!adjusted?.ok) {
        return warningResult(adjusted?.error || 'mission_payload_equipment_baseline_adjust_failed', { sideEffect: false });
      }
      baseline = payloadCore.normalizeSnapshot(adjusted.recovery?.baseline) || baseline;
    }
    plannerOptions.fuelWeightLbs = baseline.fuelWeightLbs;

    const plan = payloadCore.buildPlanFromManifest(manifest, baseline, plannerOptions);
    if (plan?.error) {
      log(`MISSION_PAYLOAD_WARNING mission=${cleanString(request.missionId) || 'none'} error=${plan.error} adapter=${plan.payloadAdapter || baseline.payloadAdapter}`);
      return warningResult(plan.error, { sideEffect: false, payloadPlan: plan });
    }
    if (!plan || !Array.isArray(plan.stations) || !plan.stations.length) {
      return warningResult('no_plan', { sideEffect: false });
    }
    if (!isCurrent()) return supersededResult({ sideEffect: false, payloadPlan: plan });

    const isPa24 = (plan.payloadAdapter || baseline.payloadAdapter) === payloadCore.PA24_ADAPTER;
    let applied;
    if (recordRecovery) {
      let attempted;
      try {
        attempted = await recordRecovery(recoveryRequest(request, 'write_attempted'));
      } catch (error) {
        attempted = { ok: false, error: error?.code || error?.message || String(error) };
      }
      if (!attempted?.ok) {
        return warningResult(attempted?.error || 'mission_payload_recovery_persist_failed', {
          sideEffect: false,
          payloadAdapter: plan.payloadAdapter || baseline.payloadAdapter,
          payloadPlan: plan
        });
      }
    }
    try {
      applied = isPa24
        ? await applyPa24State(plan.pa24State, baseline.pa24)
        : await applyStations(plan.stations.map(row => ({ index: row.index, weightLbs: row.weightLbs })));
      if (!isCurrent()) return supersededResult({ sideEffect: true, payloadPlan: plan, applied });
      if (isPa24 && plan.pa24State) {
        await wait(PA24_SEAT_REASSERT_DELAY_MS);
        if (!isCurrent()) return supersededResult({ sideEffect: true, payloadPlan: plan, applied });
        await reassertPa24Seats(plan.pa24State, { reason: 'pa24-payload-seat-post-write' });
      }
    } catch (error) {
      return warningResult(error?.code || error?.message || error, {
        sideEffect: true,
        payloadAdapter: plan.payloadAdapter || baseline.payloadAdapter,
        payloadPlan: plan
      });
    }

    const delays = isPa24 ? PA24_VERIFY_DELAYS_MS : STANDARD_VERIFY_DELAYS_MS;
    let lastSnapshot = null;
    let stationCheck = null;
    let pa24Check = null;
    let pa24ReassertAttempts = 0;
    try {
      for (const delayMs of delays) {
        await wait(delayMs);
        if (!isCurrent()) return supersededResult({ sideEffect: true, payloadPlan: plan, applied });
        lastSnapshot = payloadCore.normalizeSnapshot(await readSnapshot(baseline.sampledStationCount || baseline.payloadStationCount || 12));
        if (!isCurrent()) return supersededResult({ sideEffect: true, payloadPlan: plan, applied, snapshot: lastSnapshot });
        stationCheck = payloadCore.comparePayloadStations(lastSnapshot, plan.stations, 1, plannerOptions);
        pa24Check = isPa24 && plan.pa24State
          ? payloadCore.comparePa24State(lastSnapshot, plan.pa24State, 1, plannerOptions)
          : null;
        if (stationCheck.ok && (!pa24Check || pa24Check.ok)) continue;
        if (stationCheck.ok && pa24Check && !pa24Check.ok && pa24ReassertAttempts < 1) {
          pa24ReassertAttempts += 1;
          await reassertPa24Seats(plan.pa24State, { reason: 'pa24-payload-seat-verify-retry' });
          if (!isCurrent()) return supersededResult({ sideEffect: true, payloadPlan: plan, applied, snapshot: lastSnapshot });
          continue;
        }
        break;
      }
    } catch (error) {
      return warningResult(error?.code || error?.message || error, {
        sideEffect: true,
        payloadAdapter: plan.payloadAdapter || baseline.payloadAdapter,
        payloadPlan: plan,
        payloadVerification: { status: 'unstable', check: stationCheck, pa24Check, pa24ReassertAttempts }
      });
    }

    const stable = stationCheck?.ok === true && (!pa24Check || pa24Check.ok === true);
    const payloadVerification = {
      status: stable ? 'ok' : 'unstable',
      reason: stable ? 'stable' : (pa24Check?.reason || stationCheck?.reason || 'payload_unstable'),
      check: stationCheck,
      pa24Check,
      pa24ReassertAttempts,
      maxStations: baseline.sampledStationCount || baseline.payloadStationCount || 12
    };
    if (!stable) {
      log(`MISSION_PAYLOAD_WARNING mission=${cleanString(request.missionId) || 'none'} error=payload_unstable_aircraft_override adapter=${plan.payloadAdapter || baseline.payloadAdapter}`);
      return warningResult('payload_unstable_aircraft_override', {
        sideEffect: true,
        payloadAdapter: plan.payloadAdapter || baseline.payloadAdapter,
        payloadPlan: plan,
        payloadVerification,
        applied
      });
    }
    log(`MISSION_PAYLOAD_SYNCED mission=${cleanString(request.missionId) || 'none'} adapter=${plan.payloadAdapter || baseline.payloadAdapter} missionWeightLbs=${Number(plan.missionWeightLbs) || 0}`);
    const result = {
      ok: true,
      status: 'completed',
      sideEffect: true,
      payloadOverride: false,
      payloadStatus: 'ok',
      payloadAdapter: plan.payloadAdapter || baseline.payloadAdapter,
      payloadPlan: plan,
      payloadVerification,
      applied,
      snapshot: lastSnapshot
    };
    result.payloadOutcome = payloadOutcome(result);
    return result;
  };

  const syncQueue = {
    timer: null,
    revision: 0,
    settledRevision: 0,
    burstStartedAt: 0,
    lastRequestedAt: 0,
    pendingRequest: null,
    pendingReason: '',
    forceImmediate: false,
    running: false,
    runningPromise: null,
    waiters: [],
    lastResult: { ok: true, status: 'idle', sideEffect: false, payloadOutcome: null }
  };
  let schedulingGeneration = 0;
  let recoveryPreparation = Promise.resolve();

  const prepareRecoveryForScheduledRequest = async (request = {}) => {
    if (!recordRecovery) return { ok: true };
    let recovery = null;
    try {
      const baselineResolution = await resolvePayloadBaseline(request);
      recovery = baselineResolution.currentRecovery;
      if (!recovery?.baseline) {
        const baseline = baselineResolution.baseline;
        if (!baseline) return { ok: false, error: 'no_baseline' };
        const captured = await recordRecovery(recoveryRequest(request, 'capture', { baseline }));
        if (!captured?.ok) return { ok: false, error: captured?.error || 'mission_payload_recovery_persist_failed' };
        recovery = captured.recovery || recovery;
      }
      const detachedInheritedEquipment = safeObject(
        safeObject(safeObject(request.effect).payload).transition
      ).detachedInheritedEquipment;
      if (safeObject(detachedInheritedEquipment).id) {
        const detached = await recordRecovery(recoveryRequest(request, 'detach_inherited', {
          item: detachedInheritedEquipment
        }));
        if (!detached?.ok) {
          return { ok: false, error: detached?.error || 'mission_payload_equipment_baseline_adjust_failed' };
        }
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.code || error?.message || String(error) };
    }
  };

  const resolveQueueWaiters = (revision, result) => {
    const settledRevision = Math.max(0, Math.round(Number(revision) || 0));
    if (settledRevision >= syncQueue.settledRevision) {
      syncQueue.settledRevision = settledRevision;
      syncQueue.lastResult = result;
    }
    const pending = syncQueue.waiters.splice(0);
    for (const waiter of pending) {
      if (waiter.revision <= settledRevision) waiter.resolve(result);
      else syncQueue.waiters.push(waiter);
    }
  };

  const waitForQueueRevision = revision => {
    if (revision <= syncQueue.settledRevision) return Promise.resolve(syncQueue.lastResult);
    return new Promise(resolve => syncQueue.waiters.push({ revision, resolve }));
  };

  const flushPayloadSyncQueue = async () => {
    if (syncQueue.running) return syncQueue.runningPromise || syncQueue.lastResult;
    if (syncQueue.revision <= syncQueue.settledRevision || !syncQueue.pendingRequest) return syncQueue.lastResult;
    if (syncQueue.timer) clearTimeout(syncQueue.timer);
    syncQueue.timer = null;
    const revision = syncQueue.revision;
    const request = syncQueue.pendingRequest;
    const reason = syncQueue.pendingReason || 'payload-manifest-state';
    syncQueue.pendingRequest = null;
    syncQueue.pendingReason = '';
    syncQueue.burstStartedAt = 0;
    syncQueue.lastRequestedAt = 0;
    syncQueue.forceImmediate = false;
    syncQueue.running = true;
    const operation = runPayloadSync(request, {
      isCurrent: () => syncQueue.revision === revision
    }).catch(error => warningResult(error?.code || error?.message || error, { sideEffect: true }));
    syncQueue.runningPromise = operation;
    let result;
    try {
      result = await operation;
      if (syncQueue.revision !== revision && result?.status !== 'superseded') {
        result = supersededResult({
          sideEffect: result?.sideEffect === true,
          reason: 'newer_payload_state_pending',
          revision,
          payloadPlan: result?.payloadPlan || null
        });
      }
      return result;
    } finally {
      syncQueue.running = false;
      syncQueue.runningPromise = null;
      resolveQueueWaiters(revision, result || warningResult('payload_sync_failed', { sideEffect: true }));
      if (syncQueue.revision > revision && syncQueue.revision > syncQueue.settledRevision) armPayloadSyncQueue();
      log(`MISSION_PAYLOAD_QUEUE_FLUSH mission=${cleanString(request.missionId) || 'none'} revision=${revision} reason=${cleanString(reason, 100) || 'payload'}`);
    }
  };

  const armPayloadSyncQueue = () => {
    if (syncQueue.timer) clearTimeout(syncQueue.timer);
    syncQueue.timer = null;
    if (syncQueue.running || syncQueue.revision <= syncQueue.settledRevision || !syncQueue.pendingRequest) return false;
    const delayMs = payloadCore.payloadSyncDelayMs(
      clock(),
      syncQueue.burstStartedAt,
      syncQueue.lastRequestedAt,
      syncQueue.forceImmediate,
      { debounceMs: payloadSyncDebounceMs, maxWaitMs: payloadSyncMaxWaitMs }
    );
    syncQueue.timer = setTimeout(() => {
      syncQueue.timer = null;
      flushPayloadSyncQueue().catch(() => {});
    }, delayMs);
    return true;
  };

  const enqueuePayloadSync = (request = {}, options = {}) => {
    const timestamp = clock();
    syncQueue.revision += 1;
    syncQueue.pendingRequest = request;
    syncQueue.pendingReason = cleanString(options.reason || request.effect?.payload?.operation, 120) || 'payload-manifest-state';
    syncQueue.lastRequestedAt = timestamp;
    if (!syncQueue.burstStartedAt) syncQueue.burstStartedAt = timestamp;
    if (options.immediate === true) syncQueue.forceImmediate = true;
    const pending = waitForQueueRevision(syncQueue.revision);
    armPayloadSyncQueue();
    return pending;
  };

  const schedulePayloadSync = (request = {}, options = {}) => {
    const generation = schedulingGeneration;
    const prepared = recoveryPreparation.then(() => prepareRecoveryForScheduledRequest(request));
    recoveryPreparation = prepared.then(() => null, () => null);
    return prepared.then(result => {
      if (generation !== schedulingGeneration) {
        return {
          ok: true,
          status: 'cancelled',
          reason: 'payload_sync_cancelled',
          sideEffect: false,
          payloadOutcome: null
        };
      }
      if (!result?.ok) return warningResult(result?.error || 'mission_payload_recovery_persist_failed', { sideEffect: false });
      return enqueuePayloadSync(request, options);
    });
  };

  const cancelPayloadSyncQueue = async (reason = 'mission-execution-abort') => {
    schedulingGeneration += 1;
    await recoveryPreparation;
    if (syncQueue.timer) clearTimeout(syncQueue.timer);
    syncQueue.timer = null;
    const active = syncQueue.runningPromise;
    syncQueue.revision += 1;
    syncQueue.pendingRequest = null;
    syncQueue.pendingReason = '';
    syncQueue.burstStartedAt = 0;
    syncQueue.lastRequestedAt = 0;
    syncQueue.forceImmediate = false;
    const cancelled = {
      ok: true,
      status: 'cancelled',
      reason: cleanString(reason, 180) || 'cancelled',
      sideEffect: false,
      payloadOutcome: null,
      revision: syncQueue.revision
    };
    syncQueue.settledRevision = syncQueue.revision;
    syncQueue.lastResult = cancelled;
    syncQueue.waiters.splice(0).forEach(waiter => waiter.resolve(cancelled));
    if (active) {
      await Promise.race([
        Promise.resolve(active).catch(() => null),
        wait(2600)
      ]);
    }
    return cancelled;
  };

  const syncBeforeStart = request => schedulePayloadSync(request, {
    immediate: true,
    reason: 'payload-sync-before-start'
  });

  const scheduleManifestSync = request => schedulePayloadSync(request, {
    immediate: false,
    reason: 'payload-sync-manifest-state'
  });

  const restoreForAbort = async (request = {}) => {
    await cancelPayloadSyncQueue(request.reason || 'mission-execution-abort');
    if (!getRecovery || !recordRecovery) {
      return { ok: false, status: 'error', error: 'mission_payload_recovery_store_unavailable', sideEffect: false };
    }
    let recovery;
    try {
      recovery = await getRecovery(recoveryRequest(request, 'get'));
    } catch (error) {
      return { ok: false, status: 'error', error: error?.code || error?.message || String(error), sideEffect: false };
    }
    if (!recovery?.baseline || recovery.writeAttempted !== true || recovery.restored === true) {
      return {
        ok: true,
        status: recovery?.restored === true ? 'already_restored' : 'noop',
        sideEffect: false,
        restored: recovery?.restored === true
      };
    }

    const manifest = safeObject(request.manifest);
    const plannerOptions = plannerOptionsFor(manifest, safeObject(request.payloadContext));
    const baseline = payloadCore.normalizeSnapshot(recovery.baseline);
    if (!baseline) {
      return { ok: false, status: 'error', error: 'mission_payload_baseline_missing', sideEffect: false };
    }
    plannerOptions.fuelWeightLbs = baseline.fuelWeightLbs;
    let current;
    try {
      current = payloadCore.normalizeSnapshot(await readSnapshot(baseline.sampledStationCount || baseline.payloadStationCount || 20));
    } catch (error) {
      return { ok: false, status: 'error', error: error?.code || error?.message || String(error), sideEffect: false };
    }
    const restorePlan = payloadCore.buildRestorePlan(manifest, baseline, current, plannerOptions);
    if (!restorePlan?.ok) {
      return {
        ok: false,
        status: 'error',
        error: restorePlan?.error || 'mission_payload_restore_plan_failed',
        sideEffect: false,
        restorePlan
      };
    }
    if (!Array.isArray(restorePlan.stations) || (!restorePlan.stations.length && !restorePlan.pa24State)) {
      const completed = await recordRecovery(recoveryRequest(request, 'restored'));
      return completed?.ok
        ? { ok: true, status: 'noop', sideEffect: false, restored: true, restorePlan }
        : { ok: false, status: 'error', error: completed?.error || 'mission_payload_recovery_persist_failed', sideEffect: false, restorePlan };
    }

    let attempt;
    try {
      attempt = await recordRecovery(recoveryRequest(request, 'restore_attempt'));
    } catch (error) {
      attempt = { ok: false, error: error?.code || error?.message || String(error) };
    }
    if (!attempt?.ok) {
      return { ok: false, status: 'error', error: attempt?.error || 'mission_payload_recovery_persist_failed', sideEffect: false, restorePlan };
    }

    const isPa24 = restorePlan.payloadAdapter === payloadCore.PA24_ADAPTER || !!restorePlan.pa24State;
    let applied = null;
    let readback = null;
    let sideEffect = false;
    try {
      sideEffect = true;
      applied = isPa24
        ? await applyPa24State(restorePlan.pa24State, current?.pa24)
        : await applyStations(restorePlan.stations.map(row => ({ index: row.index, weightLbs: row.weightLbs })));
      if (isPa24) await wait(350);
      readback = payloadCore.normalizeSnapshot(await readSnapshot(restorePlan.maxStations || baseline.sampledStationCount || 20));
      const completed = await recordRecovery(recoveryRequest(request, 'restored'));
      if (!completed?.ok) throw Object.assign(new Error(completed?.error || 'mission_payload_recovery_persist_failed'), { code: completed?.error });
    } catch (error) {
      const errorCode = error?.code || error?.message || String(error) || 'mission_payload_restore_failed';
      try {
        await recordRecovery(recoveryRequest(request, 'restore_failed', { error: errorCode }));
      } catch (_) {}
      log(`MISSION_PAYLOAD_RESTORE_ERROR mission=${cleanString(request.missionId) || 'none'} error=${cleanString(errorCode)}`);
      return { ok: false, status: 'error', error: cleanString(errorCode), sideEffect, restorePlan, applied, readback };
    }
    const stationCheck = payloadCore.comparePayloadStations(readback, restorePlan.stations, 1, plannerOptions);
    const pa24Check = isPa24 && restorePlan.pa24State
      ? payloadCore.comparePa24State(readback, restorePlan.pa24State, 1, plannerOptions)
      : null;
    log(`MISSION_PAYLOAD_RESTORED mission=${cleanString(request.missionId) || 'none'} adapter=${restorePlan.payloadAdapter || baseline.payloadAdapter} source=${restorePlan.source || 'unknown'}`);
    return {
      ok: true,
      status: 'ok',
      sideEffect,
      restored: true,
      restorePlan,
      applied,
      readback,
      verification: { stationCheck, pa24Check }
    };
  };

  return Object.freeze({
    cancelPayloadSyncQueue,
    getQueueState: () => ({
      revision: syncQueue.revision,
      settledRevision: syncQueue.settledRevision,
      running: syncQueue.running,
      queued: !!syncQueue.pendingRequest
    }),
    restoreForAbort,
    scheduleManifestSync,
    syncBeforeStart
  });
}

module.exports = {
  PA24_SEAT_REASSERT_DELAY_MS,
  PA24_VERIFY_DELAYS_MS,
  STANDARD_VERIFY_DELAYS_MS,
  createTrackerMissionPayloadHandler,
  payloadOutcome
};
