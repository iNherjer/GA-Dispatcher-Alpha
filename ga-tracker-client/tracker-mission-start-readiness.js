'use strict';
const { isMsfsMenuPosition } = require('./tracker-telemetry-hibernate-core');
const { haversineNm } = require('../mission-location-core');
const START_INTENTS = new Set(['prepare_mission', 'start_boarding', 'confirm_load', 'start_mission']);
// A loaded simulator delivers the 1 Hz readiness packet late right after a
// flight loads. 2.5 s made start flicker between "waiting for data" and a
// restarted stillness check. Pause, menu and SimStop still revoke at once
// through their own system events, independent of this age.
const START_READINESS_MAX_AGE_MS = 6000;
// Camera enum values 2..8 are live aircraft views, including external/VR views.
// Waiting, world map, hangar, menu, cinematics and transitions are not ready.
function createMissionStartReadiness({ now = Date.now, stableMs = 3000, maxAgeMs = START_READINESS_MAX_AGE_MS } = {}) {
  let sample = null, since = null, anchor = null, reason = 'simulator_not_ready';
  const reset = () => { sample = null; since = null; anchor = null; reason = 'simulator_not_ready'; };
  const observe = value => {
    const at = now();
    const previous = sample;
    sample = value;
    reason = !value || typeof value.observedAt !== 'number' || !Number.isFinite(value.observedAt)
      || at - value.observedAt < 0 || at - value.observedAt > maxAgeMs ? 'telemetry_stale'
      : value.simRunning !== 1 || value.simPaused === true || value.inMenuOrMap === true
        || value.slewActive !== false ? 'simulator_not_ready'
      : !Number.isInteger(value.cameraState) || value.cameraState < 2 || value.cameraState > 8 ? 'cockpit_not_loaded'
      : !['lat', 'lon', 'altFt'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key]))
        || Math.abs(value.lat) > 90 || Math.abs(value.lon) > 180
        || isMsfsMenuPosition(value.lat, value.lon, { paused: true }) ? 'position_not_ready'
      : value.onGround !== true ? 'ground_required'
      : typeof value.gsKts !== 'number' || !Number.isFinite(value.gsKts) || value.gsKts < 0 || value.gsKts > 0.5 ? 'ground_stop_required'
      : '';
    if (reason) { since = null; anchor = null; return snapshot(); }
    // The same packet again (a system event re-emits the last position, or two
    // packets land in one millisecond) is no new evidence, but no reset either.
    if (!previous || value.observedAt < previous.observedAt || value.observedAt - previous.observedAt > maxAgeMs
        || !anchor || haversineNm(anchor.lat, anchor.lon, value.lat, value.lon) * 1852 > 3) {
      since = value.observedAt; anchor = { lat: value.lat, lon: value.lon };
    }
    return snapshot();
  };
  const snapshot = () => {
    const age = sample && now() - sample.observedAt;
    const fresh = sample && typeof age === 'number' && Number.isFinite(age) && age >= 0 && age <= maxAgeMs;
    const stableForMs = fresh && since !== null ? Math.max(0, sample.observedAt - since) : 0;
    const worldReady = Boolean(fresh && !['telemetry_stale', 'simulator_not_ready', 'cockpit_not_loaded', 'position_not_ready'].includes(reason));
    return { worldReady, ready: Boolean(fresh && !reason && stableForMs >= stableMs),
      reason: !fresh ? 'telemetry_stale' : reason || (stableForMs < stableMs ? 'ground_stabilizing' : ''),
      stableForMs, observedAt: sample?.observedAt ?? null, cameraState: sample?.cameraState ?? null };
  };
  return { observe, snapshot, reset };
}
// The last start (phase boarded: signed, loaded, confirmed) also follows the
// pilot: taxiing for TAXI_AUTOSTART_ROLL_MS without a break starts the mission.
// Only the stillness requirement is waived; simulator, cockpit, position and
// ground evidence stay as strict as for the button. The countdown is counted in
// readiness packets (1 Hz), so every client shows the same number.
const TAXI_AUTOSTART_ROLL_MS = 3000;
const TAXI_AUTOSTART_MIN_KTS = 1;
const TAXI_AUTOSTART_NOTICE_MS = 3000;
function createTaxiAutoStart({ now = Date.now, rollMs = TAXI_AUTOSTART_ROLL_MS, minKts = TAXI_AUTOSTART_MIN_KTS,
  noticeMs = TAXI_AUTOSTART_NOTICE_MS } = {}) {
  let runId = null, rollingSince = null, rollingAt = null, pending = false, startedUntil = 0, startedRunId = null;
  const clearCount = () => { rollingSince = null; rollingAt = null; };
  const reset = () => { runId = null; clearCount(); pending = false; startedUntil = 0; startedRunId = null; };
  // context: { runId, phase, startAllowed } from the unprojected execution view.
  const observe = (sample, readiness, context = {}) => {
    const run = context.runId || null;
    if (run !== runId) { clearCount(); pending = false; runId = run; }
    if (!run || context.phase !== 'boarded' || context.startAllowed !== true || pending) {
      clearCount(); return { due: false, snapshot: snapshot() };
    }
    const rolling = Boolean(readiness && readiness.worldReady === true && readiness.reason === 'ground_stop_required'
      && sample && sample.onGround === true && typeof sample.gsKts === 'number' && Number.isFinite(sample.gsKts)
      && sample.gsKts >= minKts && Number.isFinite(sample.observedAt));
    if (!rolling) { clearCount(); return { due: false, snapshot: snapshot() }; }
    if (rollingSince === null || sample.observedAt < rollingAt || sample.observedAt - rollingAt > START_READINESS_MAX_AGE_MS) rollingSince = sample.observedAt;
    rollingAt = sample.observedAt;
    const due = rollingAt - rollingSince >= rollMs;
    if (due) pending = true;
    return { due, snapshot: snapshot() };
  };
  // The start command itself decides; a failed start returns to the countdown.
  const settle = (ok, run) => {
    pending = false; clearCount();
    if (ok && run) { startedRunId = run; startedUntil = now() + noticeMs; }
  };
  const snapshot = () => {
    if (startedRunId && now() < startedUntil) return { status: 'started', runId: startedRunId };
    if (pending) return { status: 'starting', runId, remainingS: 0 };
    if (rollingSince === null) return null;
    const rolledMs = Math.max(0, rollingAt - rollingSince);
    return { status: 'counting', runId, rolledMs, remainingS: Math.max(1, Math.ceil((rollMs - rolledMs) / 1000)) };
  };
  return { observe, settle, snapshot, reset };
}
function projectStartReadiness(control, readiness, now = Date.now()) {
  if (!control || !readiness) return control;
  if ((readiness.ready || readiness.worldReady) && (!Number.isFinite(readiness.observedAt) || now - readiness.observedAt < 0 || now - readiness.observedAt > START_READINESS_MAX_AGE_MS)) readiness = { ...readiness, ready: false, worldReady: false, reason: 'telemetry_stale' };
  const allowedActions = (control.allowedActions || []).filter(action => readiness.ready || !START_INTENTS.has(action));
  return { ...control, startReadiness: readiness, allowedActions,
    nextStep: START_INTENTS.has(control.nextStep) && !readiness.ready ? null : control.nextStep };
}
module.exports = { createMissionStartReadiness, createTaxiAutoStart, projectStartReadiness, START_INTENTS, START_READINESS_MAX_AGE_MS,
  TAXI_AUTOSTART_ROLL_MS, TAXI_AUTOSTART_MIN_KTS, TAXI_AUTOSTART_NOTICE_MS };
