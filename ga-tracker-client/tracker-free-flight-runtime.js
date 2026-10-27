'use strict';
// Wires the free-flight recorder and track store into the tracker lifecycle.
// A flight ends on: 20 s standstill after landing, sim back in the menu, sim closed,
// tracker closed, or (after a hard kill) on the next tracker start.

const { createFlightTrackStore } = require('./tracker-flight-track-store.js');
const { createFreeFlightRecorder } = require('./tracker-free-flight-recorder.js');

function createFreeFlightRuntime(options = {}) {
  const log = typeof options.log === 'function' ? options.log : () => {};
  const isMissionActive = typeof options.isMissionActive === 'function' ? options.isMissionActive : () => false;
  const timers = options.timers || { setTimeout, clearTimeout };
  const simStopDelayMs = Number.isFinite(options.simStopDelayMs) ? options.simStopDelayMs : 10000;
  const recoveryTimeoutMs = Number.isFinite(options.recoveryTimeoutMs) ? options.recoveryTimeoutMs : 120000;
  const store = options.store || createFlightTrackStore({ directory: options.directory, log });

  const recorder = createFreeFlightRecorder({
    journal: store.journal,
    checkpoint: store.checkpoint,
    load: store.pending.load,
    save: store.pending.save,
    log,
    onFlight: entry => {
      try {
        const { track, schema, ...record } = entry;
        store.putTrack({ kind: 'free', runId: entry.runId, completionId: entry.completionId,
          startTs: entry.startTs, endTs: entry.endTs, track, entry: record });
      } catch (error) { log(`FREE_FLIGHT_TRACK_ERROR error=${error.message}`); }
    }
  });

  let simStopTimer = null;
  let recoveryTimer = null;
  let stopped = false;

  const guard = (name, fn) => {
    try { return fn(); } catch (error) { log(`FREE_FLIGHT_ERROR step=${name} error=${error.message}`); return null; }
  };

  const start = () => {
    const recovered = guard('recover', () => recorder.recover());
    if (recovered?.status === 'suspended') {
      // No telemetry from the same flight in time: close it as it was.
      recoveryTimer = timers.setTimeout(() => {
        recoveryTimer = null;
        guard('recover-timeout', () => recorder.finishSuspended());
      }, recoveryTimeoutMs);
      recoveryTimer?.unref?.();
    }
    if (options.backfill !== false) {
      const backfillTimer = timers.setTimeout(() => {
        void Promise.resolve().then(() => store.backfillMissionTracks()).catch(error => log(`FLIGHT_TRACK_BACKFILL_ERROR error=${error.message}`));
      }, Number.isFinite(options.backfillDelayMs) ? options.backfillDelayMs : 30000);
      backfillTimer?.unref?.();
    }
    return recovered;
  };

  const observe = sample => {
    if (stopped) return null;
    if (simStopTimer) { timers.clearTimeout(simStopTimer); simStopTimer = null; }
    const result = guard('observe', () => recorder.observe(sample, { missionActive: isMissionActive() === true }));
    if (recoveryTimer && !recorder.publicState().suspended) { timers.clearTimeout(recoveryTimer); recoveryTimer = null; }
    return result;
  };

  // SimStop also shows up briefly while loading; only a lasting stop ends the flight.
  const simStopped = (isStillStopped = () => true) => {
    if (simStopTimer) timers.clearTimeout(simStopTimer);
    simStopTimer = timers.setTimeout(() => {
      simStopTimer = null;
      if (isStillStopped()) guard('sim-stopped', () => recorder.flush('sim-stopped'));
    }, simStopDelayMs);
    simStopTimer?.unref?.();
  };

  const simClosed = () => {
    if (simStopTimer) { timers.clearTimeout(simStopTimer); simStopTimer = null; }
    return guard('sim-closed', () => recorder.flush('sim-closed'));
  };

  // Synchronous: safe inside process 'exit' and signal handlers.
  const shutdown = (reason = 'tracker-exit') => {
    if (stopped) return null;
    stopped = true;
    if (simStopTimer) timers.clearTimeout(simStopTimer);
    if (recoveryTimer) timers.clearTimeout(recoveryTimer);
    return guard('shutdown', () => recorder.flush(reason));
  };

  const installProcessHandlers = (proc = process) => {
    proc.on('exit', () => shutdown('tracker-exit'));
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
      proc.on(signal, () => {
        shutdown('tracker-exit');
        // Other shutdown handlers (mission flush) exit on their own.
        if (proc.listenerCount(signal) <= 1) proc.exit(0);
      });
    }
  };

  return Object.freeze({
    store,
    recorder,
    start,
    observe,
    simStopped,
    simClosed,
    shutdown,
    installProcessHandlers,
    acknowledge: id => recorder.acknowledge(id),
    pending: () => recorder.pending(),
    publicState: () => recorder.publicState()
  });
}

module.exports = { createFreeFlightRuntime };
