'use strict';
const { isMsfsMenuPosition } = require('./tracker-telemetry-hibernate-core');
const { haversineNm } = require('../mission-location-core');
const START_INTENTS = new Set(['prepare_mission', 'start_boarding', 'confirm_load', 'start_mission']);
// Camera enum values 2..8 are live aircraft views, including external/VR views.
// Waiting, world map, hangar, menu, cinematics and transitions are not ready.
function createMissionStartReadiness({ now = Date.now, stableMs = 3000, maxAgeMs = 2500 } = {}) {
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
    if (!previous || value.observedAt <= previous.observedAt || value.observedAt - previous.observedAt > maxAgeMs
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
function projectStartReadiness(control, readiness, now = Date.now()) {
  if (!control || !readiness) return control;
  if ((readiness.ready || readiness.worldReady) && (!Number.isFinite(readiness.observedAt) || now - readiness.observedAt < 0 || now - readiness.observedAt > 2500)) readiness = { ...readiness, ready: false, worldReady: false, reason: 'telemetry_stale' };
  const allowedActions = (control.allowedActions || []).filter(action => readiness.ready || !START_INTENTS.has(action));
  return { ...control, startReadiness: readiness, allowedActions,
    nextStep: START_INTENTS.has(control.nextStep) && !readiness.ready ? null : control.nextStep };
}
module.exports = { createMissionStartReadiness, projectStartReadiness, START_INTENTS };
