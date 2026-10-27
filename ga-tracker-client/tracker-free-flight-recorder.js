'use strict';
// Records flights without a mission run, from first movement to standstill after landing.
// Stats come from the shared mission flight recorder, the track from the shared codec.
// Concept: docs/Flugbuch Kruemelweg Konzept.md

const recorderCore = require('../mission-flight-recorder-core.js');
const trackCodec = require('../flight-track-codec-core.js');

const ENTRY_SCHEMA = 'ga.free-flight-entry.v1';
const DEFAULTS = Object.freeze({
  stillSec: 20,          // standstill after landing that ends the flight
  groundIdleSec: 180,    // taxi without takeoff: give up after this long standing still
  maxSamples: 60000,     // ~8 h at 2 Hz; older samples are thinned beyond this
  maxPending: 20,        // finished flights waiting for the web app
  minDistanceNm: 0.3,    // placed in the air without moving is no flight
  checkpointMs: 15000,   // crash checkpoint interval while recording
  resumeNm: 3,           // after a tracker restart: same flight if this close ...
  resumeGapMs: 15 * 60 * 1000 // ... and back within this time
});
const NOOP_JOURNAL = Object.freeze({ begin() {}, append() {}, end() {}, read: () => [], flushSync() {} });
const NOOP_CHECKPOINT = Object.freeze({ save() {}, load: () => null, clear() {} });

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function position(sample) {
  const lat = finite(sample?.lat), lon = finite(sample?.lon);
  return lat === null || lon === null ? null : { lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5 };
}

function createFreeFlightRecorder(options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const load = typeof options.load === 'function' ? options.load : () => null;
  const save = typeof options.save === 'function' ? options.save : () => {};
  const log = typeof options.log === 'function' ? options.log : () => {};
  const onFlight = typeof options.onFlight === 'function' ? options.onFlight : () => {};
  const journal = { ...NOOP_JOURNAL, ...(options.journal || {}) };
  const checkpoint = { ...NOOP_CHECKPOINT, ...(options.checkpoint || {}) };

  let state = recorderCore.createState();
  let samples = [];
  let stillSince = 0;
  let firstPosition = null;
  let pending = [];
  let lastCheckpointAt = 0;
  let suspended = null; // flight found after a tracker restart, waiting for telemetry
  try {
    const stored = load();
    if (Array.isArray(stored?.pending)) pending = stored.pending.filter(e => e?.schema === ENTRY_SCHEMA).slice(-opts.maxPending);
  } catch (_) {}

  const persist = () => { try { save({ schema: 'ga.free-flight-pending.v1', pending }); } catch (_) {} };

  const reset = () => {
    state = recorderCore.createState();
    samples = [];
    stillSince = 0;
    firstPosition = null;
    lastCheckpointAt = 0;
    journal.end();
    checkpoint.clear();
  };

  const saveCheckpoint = now => {
    lastCheckpointAt = now;
    checkpoint.save({ schema: 'ga.free-flight-active.v1', state, stillSince, firstPosition, savedAt: now });
  };

  const compact = sample => ({
    observedAt: finite(sample.observedAt),
    lat: finite(sample.lat), lon: finite(sample.lon),
    altFt: finite(sample.altFt), aglFt: finite(sample.aglFt),
    onGround: sample.onGround === true,
    simPaused: sample.simPaused === true, inMenuOrMap: sample.inMenuOrMap === true
  });

  const pushSample = sample => {
    const row = compact(sample);
    if (!samples.length) journal.begin();
    samples.push(row);
    journal.append(row);
    // Very long sessions: thin the older half instead of growing without bound.
    if (samples.length > opts.maxSamples) {
      const half = samples.length >> 1;
      samples = samples.slice(0, half).filter((_, i) => i % 2 === 0).concat(samples.slice(half));
    }
  };

  const finish = (endTs, reason) => {
    const record = recorderCore.buildRecord(state, { now: endTs });
    const track = record ? trackCodec.encodeTrack(samples) : null;
    const startTs = state.startTs;
    const lastPosition = position(samples[samples.length - 1]);
    reset();
    if (!record || !track || !(record.distanceNm >= opts.minDistanceNm)) {
      log(`FREE_FLIGHT_DISCARDED reason=${reason} flight=${record ? 'yes' : 'no'} distanceNm=${record?.distanceNm ?? null}`);
      return null;
    }
    delete record.depLabel;
    delete record.arrLabel;
    const id = `free-${startTs}`;
    const entry = {
      schema: ENTRY_SCHEMA,
      kind: 'free',
      completionId: id,
      runId: id,
      startTs,
      endTs,
      createdAt: endTs,
      endReason: reason,
      depPosition: firstPositionOf(track),
      arrPosition: lastPosition,
      ...record,
      track
    };
    pending = pending.filter(e => e.completionId !== id).concat(entry).slice(-opts.maxPending);
    persist();
    log(`FREE_FLIGHT_RECORDED id=${id} durationSec=${record.durationSec} distanceNm=${record.distanceNm} points=${track.n}`);
    try { onFlight(entry); } catch (_) {}
    return entry;
  };

  const firstPositionOf = track => {
    try {
      const first = trackCodec.decodeTrack(track)[0];
      return first ? { lat: first.lat, lon: first.lon } : firstPosition;
    } catch (_) { return firstPosition; }
  };

  // sample: tracker telemetry (observedAt, lat, lon, altFt, aglFt, gsKts, onGround, vsFpm, bankDeg, gForce, touchdownFpm, simPaused, inMenuOrMap)
  // context.missionActive: a mission run owns this flight; free recording stops and discards.
  const observe = (sample = {}, context = {}) => {
    const now = finite(sample.observedAt);
    if (now === null) return { status: 'invalid' };
    if (context.missionActive === true) {
      if (suspended) finishSuspended('tracker-restart');
      if (state.active) { log('FREE_FLIGHT_DISCARDED reason=mission-started'); reset(); }
      return { status: 'mission' };
    }
    if (suspended) resumeOrFinishSuspended(sample, now);
    const before = state;
    const wasAirborne = state.hadAirbornePhase;
    const result = recorderCore.observe(state, sample);
    if (result.status === 'reposition_reset') {
      // Repositioned on the ground: a finished flight before the jump is kept.
      let ended = null;
      if (before.active && before.hadAirbornePhase) ended = finish(before.lastUpdateTs || now, 'reposition');
      else reset();
      state = result.state;
      return { status: ended ? 'recorded' : 'reset', entry: ended };
    }
    state = result.state;
    if (!state.active) return { status: result.status };
    if (!firstPosition) firstPosition = position(sample);
    pushSample(sample);
    if (!lastCheckpointAt || state.hadAirbornePhase !== wasAirborne || now - lastCheckpointAt >= opts.checkpointMs) saveCheckpoint(now);
    if (result.status === 'paused') return { status: 'paused' };

    const gs = finite(sample.gsKts);
    const still = sample.onGround === true && gs !== null && gs <= 2;
    if (!still) { stillSince = 0; return { status: 'recording' }; }
    if (!stillSince) stillSince = now;
    const stillFor = (now - stillSince) / 1000;
    if (state.hadAirbornePhase && stillFor >= opts.stillSec) {
      const entry = finish(now, 'landed');
      return { status: entry ? 'recorded' : 'reset', entry };
    }
    if (!state.hadAirbornePhase && stillFor >= opts.groundIdleSec) {
      log('FREE_FLIGHT_DISCARDED reason=no-takeoff');
      reset();
      return { status: 'reset' };
    }
    return { status: 'recording' };
  };

  // Sim stopped or tracker shutting down: keep a flight that already flew.
  const flush = (reason = 'sim-stopped', at = null) => {
    if (suspended) return finishSuspended('tracker-restart');
    if (!state.active || !state.hadAirbornePhase) { if (state.active) reset(); return null; }
    journal.flushSync();
    return finish(finite(at) ?? (state.lastUpdateTs || Date.now()), reason);
  };

  // Tracker start: pick up a flight that was running when the tracker stopped unexpectedly.
  const recover = () => {
    const saved = checkpoint.load();
    const savedState = saved?.schema === 'ga.free-flight-active.v1' ? recorderCore.createState(saved.state) : null;
    const savedSamples = savedState?.active ? journal.read() : [];
    if (!savedState?.active || !savedSamples.length) { journal.end(); checkpoint.clear(); return { status: 'none' }; }
    suspended = { state: savedState, samples: savedSamples, stillSince: Number(saved.stillSince) || 0, firstPosition: saved.firstPosition || null };
    log(`FREE_FLIGHT_RECOVERED samples=${savedSamples.length} airborne=${savedState.hadAirbornePhase ? 1 : 0}`);
    return { status: 'suspended', airborne: savedState.hadAirbornePhase };
  };

  const restoreSuspended = () => {
    state = suspended.state;
    samples = suspended.samples;
    stillSince = suspended.stillSince;
    firstPosition = suspended.firstPosition;
    suspended = null;
  };

  const finishSuspended = reason => {
    if (!suspended) return null;
    const airborne = suspended.state.hadAirbornePhase;
    restoreSuspended();
    if (!airborne) { reset(); return null; }
    return finish(state.lastUpdateTs || samples[samples.length - 1]?.observedAt || Date.now(), reason);
  };

  // Same aircraft close to where it was and soon after: continue; otherwise close the old flight.
  const resumeOrFinishSuspended = (sample, now) => {
    const last = suspended.samples[suspended.samples.length - 1];
    const lat = finite(sample.lat), lon = finite(sample.lon);
    const near = last && lat !== null && lon !== null
      && trackCodec.distanceM({ lat: last.lat, lon: last.lon }, { lat, lon }) / 1852 <= opts.resumeNm
      && now - Number(last.observedAt || 0) <= opts.resumeGapMs;
    if (near) { restoreSuspended(); log('FREE_FLIGHT_RESUMED'); return null; }
    return finishSuspended('tracker-restart');
  };

  const acknowledge = completionId => {
    const before = pending.length;
    pending = pending.filter(e => e.completionId !== completionId);
    if (pending.length !== before) persist();
    return before !== pending.length;
  };

  return Object.freeze({
    observe,
    flush,
    recover,
    finishSuspended: () => finishSuspended('tracker-restart'),
    acknowledge,
    pending: () => pending.slice(),
    publicState: () => ({
      recording: state.active,
      suspended: !!suspended,
      airborneSeen: state.hadAirbornePhase,
      startTs: state.active ? state.startTs : null,
      samples: samples.length,
      pending: pending.map(e => e.completionId)
    })
  });
}

module.exports = { ENTRY_SCHEMA, DEFAULTS, createFreeFlightRecorder };
