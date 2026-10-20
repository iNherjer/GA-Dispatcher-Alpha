'use strict';

// Simulator interruption of a started tracker run.
//
// The record lives beside the deterministic execution state (like the payload
// recovery baseline), so App/Tracker state hashes and replay stay untouched.
// While it exists, mission logic, effects and scoring pause. Resuming is an
// explicit decision unless the simulator obviously continued (short gap,
// plausible position); rebuilding happens only in a running cockpit, and an
// airborne interruption ends in a resume zone around the last valid point.

const SCHEMA = 'ga.mission-interruption.v1';
const AIR_RADIUS_NM = 5;
const GROUND_RADIUS_NM = 1;
const AIR_DWELL_MS = 10000;
const GROUND_DWELL_MS = 5000;
const AUTO_RESUME_GAP_MS = 90000;
const MAX_HISTORY = 8;
const STATUSES = Object.freeze(['awaiting_decision', 'resuming', 'awaiting_zone']);
const CAUSES = Object.freeze(['simulator_disconnected', 'tracker_restart']);
const NOT_INTERRUPTIBLE_PHASES = new Set(['planned', 'closing', 'closed']);
const ACTIONS_BY_STATUS = Object.freeze({
  awaiting_decision: Object.freeze(['abort_mission', 'resume_mission']),
  resuming: Object.freeze(['abort_mission']),
  awaiting_zone: Object.freeze(['abort_mission'])
});
// Intents the runtime accepts while a run is interrupted.
const INTERRUPTION_INTENTS = new Set(['abort_mission', 'resume_mission', 'resume_teleport', 'close_debrief', 'close_cargo_window']);

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 0) {
  const number = finite(value);
  if (number === null) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function haversineNm(lat1, lon1, lat2, lon2) {
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function bearingDeg(lat1, lon1, lat2, lon2) {
  const toRad = value => value * Math.PI / 180;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2))
    - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function validCoordinate(lat, lon) {
  return lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    // MSFS reports 0/0 in menus and while loading.
    && !(Math.abs(lat) < 0.01 && Math.abs(lon) < 0.01);
}

// A sample that describes the aircraft in a running simulation.
function validSample(sample) {
  if (!sample || typeof sample !== 'object') return false;
  if (sample.simPaused === true || sample.paused === true || sample.isPaused === true
      || sample.inMenuOrMap === true || sample.simRunning === 0
      || sample.slewActive === true || sample.slewMode === true || sample.isSlewActive === true) return false;
  if (typeof sample.onGround !== 'boolean') return false;
  return validCoordinate(finite(sample.lat), finite(sample.lon ?? sample.lng));
}

function positionFromSample(sample) {
  if (!sample || typeof sample !== 'object') return null;
  const lat = finite(sample.lat);
  const lon = finite(sample.lon ?? sample.lng);
  if (!validCoordinate(lat, lon) || typeof sample.onGround !== 'boolean') return null;
  return {
    lat: round(lat, 6),
    lon: round(lon, 6),
    altFt: round(sample.altFt),
    aglFt: round(sample.aglFt),
    hdg: round(sample.hdg),
    gsKts: round(sample.gsKts, 1),
    iasKts: round(sample.iasKts, 1),
    vsFpm: round(sample.vsFpm),
    onGround: sample.onGround,
    observedAt: Math.max(0, Math.round(finite(sample.observedAt) || 0)) || null
  };
}

function normalizePosition(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const position = positionFromSample(raw);
  if (!position) return null;
  position.observedAt = Math.max(0, Math.round(finite(raw.observedAt) || 0)) || null;
  return position;
}

function zoneFor(position) {
  if (!position) return null;
  return {
    lat: position.lat,
    lon: position.lon,
    radiusNm: position.onGround ? GROUND_RADIUS_NM : AIR_RADIUS_NM,
    airborne: !position.onGround
  };
}

function normalize(raw) {
  if (!raw || typeof raw !== 'object' || raw.schema !== SCHEMA) return null;
  const status = STATUSES.includes(raw.status) ? raw.status : null;
  if (!status) return null;
  const position = normalizePosition(raw.position);
  const timestamp = value => Math.max(0, Math.round(finite(value) || 0)) || null;
  return {
    schema: SCHEMA,
    status,
    cause: CAUSES.includes(raw.cause) ? raw.cause : 'simulator_disconnected',
    since: timestamp(raw.since) || 0,
    phase: String(raw.phase || '').trim().toLowerCase().slice(0, 40) || null,
    position,
    zone: zoneFor(position),
    autoResumeUntil: timestamp(raw.autoResumeUntil),
    decidedAt: timestamp(raw.decidedAt),
    decidedBy: String(raw.decidedBy || '').trim().toLowerCase().slice(0, 24) || null,
    rebuiltAt: timestamp(raw.rebuiltAt)
  };
}

function normalizeHistory(raw) {
  return (Array.isArray(raw) ? raw : []).filter(entry => entry && typeof entry === 'object').slice(-MAX_HISTORY).map(entry => ({
    since: Math.max(0, Math.round(finite(entry.since) || 0)),
    resumedAt: Math.max(0, Math.round(finite(entry.resumedAt) || 0)),
    cause: CAUSES.includes(entry.cause) ? entry.cause : 'simulator_disconnected',
    airborne: entry.airborne === true,
    mode: ['zone', 'ground', 'auto', 'teleport'].includes(entry.mode) ? entry.mode : 'zone'
  }));
}

function interruptible(executionState) {
  if (!executionState || typeof executionState !== 'object') return false;
  const phase = String(executionState.phase || 'planned').toLowerCase();
  return !NOT_INTERRUPTIBLE_PHASES.has(phase) && executionState.flags?.closed !== true
    && executionState.flags?.closingPending !== true;
}

function create({ cause = 'simulator_disconnected', phase = null, position = null, now = Date.now() } = {}) {
  const normalizedPosition = normalizePosition(position);
  // A short gap may resume on its own when the simulator obviously continued.
  const autoResumeUntil = normalizedPosition?.observedAt ? normalizedPosition.observedAt + AUTO_RESUME_GAP_MS : null;
  return normalize({
    schema: SCHEMA,
    status: 'awaiting_decision',
    cause,
    since: now,
    phase,
    position: normalizedPosition,
    autoResumeUntil
  });
}

function plausibleContinuation(record, sample, now = Date.now()) {
  if (!record || record.status !== 'awaiting_decision' || !record.position?.observedAt) return false;
  if (!record.autoResumeUntil || now > record.autoResumeUntil || !validSample(sample)) return false;
  const gapSec = Math.max(0, (now - record.position.observedAt) / 1000);
  // Taxi speed bound on the ground, cruise bound once either state is airborne.
  const groundOnly = record.position.onGround && sample.onGround === true;
  const speedKts = Math.max(Number(record.position.gsKts) || 0, finite(sample.gsKts) || 0, groundOnly ? 30 : 150);
  const reachableNm = Math.max(0.3, speedKts * gapSec / 3600 * 1.5);
  return haversineNm(record.position.lat, record.position.lon, Number(sample.lat), Number(sample.lon ?? sample.lng)) <= reachableNm;
}

function decide(record, { by = 'web', now = Date.now() } = {}) {
  if (!record || record.status !== 'awaiting_decision') return null;
  return normalize({ ...record, status: 'resuming', decidedAt: now, decidedBy: by, autoResumeUntil: null });
}

// Scenes and payload are back. Without a known position there is no zone.
function rebuilt(record, now = Date.now()) {
  if (!record || record.status !== 'resuming') return null;
  return normalize({ ...record, status: 'awaiting_zone', rebuiltAt: now });
}

// Pure zone evaluation. `dwell` is in-memory runtime state, never persisted.
function evaluateZone(record, sample, dwell = null, now = Date.now()) {
  if (!record || record.status !== 'awaiting_zone') return { reached: false, inside: false, dwell: null, distanceNm: null };
  if (!record.zone) return { reached: true, inside: true, dwell: null, distanceNm: 0 };
  if (!validSample(sample)) return { reached: false, inside: false, dwell: null, distanceNm: null };
  const distanceNm = haversineNm(record.zone.lat, record.zone.lon, Number(sample.lat), Number(sample.lon ?? sample.lng));
  const stateMatches = record.zone.airborne ? sample.onGround === false : sample.onGround === true;
  const inside = stateMatches && distanceNm <= record.zone.radiusNm;
  if (!inside) return { reached: false, inside: false, dwell: null, distanceNm };
  const since = dwell?.since && dwell.since <= now ? dwell.since : now;
  const requiredMs = record.zone.airborne ? AIR_DWELL_MS : GROUND_DWELL_MS;
  return { reached: now - since >= requiredMs, inside: true, dwell: { since }, distanceNm };
}

function historyEntry(record, mode, now = Date.now()) {
  return normalizeHistory([{ since: record?.since, resumedAt: now, cause: record?.cause, airborne: record?.zone?.airborne === true, mode }])[0];
}

function filterAllowedActions(actions, record) {
  if (!record) return Array.isArray(actions) ? actions.slice() : [];
  const allowed = ACTIONS_BY_STATUS[record.status] || ACTIONS_BY_STATUS.awaiting_decision;
  const result = allowed.filter(action => action !== 'abort_mission' || (actions || []).includes('abort_mission'));
  if (record.status === 'awaiting_zone' && record.zone?.airborne) result.push('resume_teleport');
  return result.sort();
}

function publicProjection(record, history = []) {
  if (!record) return null;
  return {
    schema: SCHEMA,
    status: record.status,
    cause: record.cause,
    since: record.since,
    phase: record.phase,
    airborne: record.zone?.airborne === true,
    zone: record.zone ? { ...record.zone } : null,
    position: record.position ? { lat: record.position.lat, lon: record.position.lon, altFt: record.position.altFt,
      hdg: record.position.hdg, gsKts: record.position.gsKts, onGround: record.position.onGround } : null,
    autoResumeUntil: record.autoResumeUntil,
    decidedAt: record.decidedAt,
    decidedBy: record.decidedBy,
    rebuiltAt: record.rebuiltAt,
    count: normalizeHistory(history).length + 1
  };
}

// Teleport target: the last valid airborne state, never below 500 ft AGL.
function teleportTarget(record) {
  if (!record?.zone?.airborne || !record.position) return null;
  const position = record.position;
  const agl = finite(position.aglFt);
  const alt = finite(position.altFt);
  if (alt === null) return null;
  const altFt = agl !== null && agl < 500 ? alt + (500 - agl) : alt;
  const airspeedKts = Math.max(60, Math.min(250, finite(position.iasKts) || finite(position.gsKts) || 90));
  return { lat: position.lat, lon: position.lon, altFt: Math.round(altFt), hdg: finite(position.hdg) || 0, airspeedKts: Math.round(airspeedKts) };
}

module.exports = {
  SCHEMA,
  AIR_RADIUS_NM,
  GROUND_RADIUS_NM,
  AIR_DWELL_MS,
  GROUND_DWELL_MS,
  AUTO_RESUME_GAP_MS,
  INTERRUPTION_INTENTS,
  haversineNm,
  bearingDeg,
  validSample,
  positionFromSample,
  normalize,
  normalizeHistory,
  interruptible,
  create,
  plausibleContinuation,
  decide,
  rebuilt,
  evaluateZone,
  historyEntry,
  filterAllowedActions,
  publicProjection,
  teleportTarget
};
