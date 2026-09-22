'use strict';

// Tracker adapter for the standalone survey detector. The detector is generated
// from mission-survey-pattern.js; this file only owns sample continuity and a
// JSON-safe checkpoint shape.
const core = require('../mission-survey-core.js');
const RUNTIME_SCHEMA = 'ga.tracker-survey-task.v1';
const MAX_GAP_MS = 5000;
const MAX_INTERPOLATION_STEPS = 32;

const finite = value => typeof value === 'number' && Number.isFinite(value);
const point = value => finite(value?.lat) && finite(value?.lon)
    && Math.abs(value.lat) <= 90 && Math.abs(value.lon) <= 180;
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function boundedDetector(spec, saved) {
    const raw = saved?.detector;
    if (!raw || typeof raw !== 'object' || raw.schema !== 'ga.surveyPatternRuntime.v1' || raw.specKey !== spec.key) return null;
    const boundedNumber = value => finite(value) && value >= 0 ? value : 0;
    const validArray = (value, limit) => Array.isArray(value) && value.length <= limit;
    const scanRaw = raw.scan && typeof raw.scan === 'object' ? raw.scan : {};
    const orbitRaw = raw.orbit && typeof raw.orbit === 'object' ? raw.orbit : {};
    const completed = validArray(scanRaw.completedLineIds, spec.scan.lines.length)
        ? scanRaw.completedLineIds.filter(id => spec.scan.lines.some(line => String(line.id) === String(id))) : [];
    const scanActiveRaw = scanRaw.active;
    const scanActive = scanActiveRaw && typeof scanActiveRaw === 'object'
        && spec.scan.lines.some(line => String(line.id) === String(scanActiveRaw.lineId))
        && validArray(scanActiveRaw.bins, spec.scan.bins)
        && ['startedAt', 'lastGoodAt', 'badSince', 'lastT'].every(key => finite(scanActiveRaw[key]))
        ? { ...scanActiveRaw, bins: scanActiveRaw.bins.slice(0, spec.scan.bins) } : null;
    const orbitActiveRaw = orbitRaw.active;
    const orbitActive = orbitActiveRaw && typeof orbitActiveRaw === 'object'
        && validArray(orbitActiveRaw.sectors, spec.orbit.sectorsPerTurn)
        && ['startedAt', 'lastGoodAt', 'badSince', 'lastAngle'].every(key => finite(orbitActiveRaw[key]))
        ? { ...orbitActiveRaw, sectors: orbitActiveRaw.sectors.slice(0, spec.orbit.sectorsPerTurn) } : null;
    return {
        schema: raw.schema, specKey: raw.specKey, type: raw.type, startedAt: boundedNumber(raw.startedAt),
        updatedAt: boundedNumber(raw.updatedAt), satisfied: raw.satisfied === true,
        events: Array.isArray(raw.events) ? raw.events.slice(-64) : [],
        scan: { completedLineIds: completed, totalLines: spec.scan.lines.length,
            lastResetReason: String(scanRaw.lastResetReason || '').slice(0, 80), active: scanActive },
        orbit: { completedTurns: Math.max(0, Math.min(spec.orbit.requiredTurns, Math.round(Number(orbitRaw.completedTurns) || 0))),
            requiredTurns: spec.orbit.requiredTurns, lastResetReason: String(orbitRaw.lastResetReason || '').slice(0, 80), active: orbitActive }
    };
}

function validateSpec(raw) {
    const finiteNumber = value => value !== null && value !== '' && Number.isFinite(Number(value));
    const rawCenter = raw?.center || raw?.target || raw?.anchor || {};
    const rawLat = rawCenter.lat ?? raw?.targetLat;
    const rawLon = rawCenter.lon ?? rawCenter.lng ?? raw?.targetLon;
    if (!finiteNumber(rawLat) || !finiteNumber(rawLon) || Math.abs(Number(rawLat)) > 90 || Math.abs(Number(rawLon)) > 180) return 'survey_spec_location_invalid';
    for (const key of ['targetAltFt', 'altitudeToleranceFt']) {
        if (Object.hasOwn(raw || {}, key) && !finiteNumber(raw[key])) return 'survey_spec_parameters_invalid';
    }
    const spec = core.normalizeSpec(raw);
    if (!spec || !point(spec.center)) return 'survey_spec_invalid';
    const numberFields = spec.type === 'orbit'
        ? ['radiusNm', 'radialToleranceNm', 'requiredTurns', 'sectorsPerTurn', 'minTurnCoverage', 'resetGraceSec', 'minGroundSpeedKts', 'minTurnSec']
        : ['lineCount', 'lineLengthNm', 'lineSpacingNm', 'crossTrackToleranceNm', 'headingToleranceDeg', 'minCoverage', 'bins', 'startEndTolerance', 'resetGraceSec', 'minGroundSpeedKts'];
    const rawSettings = spec.type === 'orbit' ? raw?.orbit : raw?.scan;
    if (rawSettings && typeof rawSettings !== 'object') return 'survey_spec_parameters_invalid';
    if (rawSettings && numberFields.some(key => Object.hasOwn(rawSettings, key) && !finiteNumber(rawSettings[key]))) return 'survey_spec_parameters_invalid';
    if (spec.type !== 'orbit' && Array.isArray(rawSettings?.lines)) {
        if (rawSettings.lines.length !== spec.scan.lineCount) return 'survey_spec_lines_invalid';
        const rawIds = new Set();
        for (const line of rawSettings.lines) {
            const start = line?.start || {}, end = line?.end || {};
            const startLat = start.lat, startLon = start.lon, endLat = end.lat, endLon = end.lon;
            if (!line || !String(line.id || '').trim() || rawIds.has(String(line.id))
                || ![startLat, startLon, endLat, endLon].every(finiteNumber)
                || Math.abs(Number(startLat)) > 90 || Math.abs(Number(endLat)) > 90
                || Math.abs(Number(startLon)) > 180 || Math.abs(Number(endLon)) > 180
                || core.haversineNm(Number(startLat), Number(startLon), Number(endLat), Number(endLon)) <= 0.0001) return 'survey_spec_lines_invalid';
            rawIds.add(String(line.id));
        }
    }
    if (!finite(spec.targetAltFt) || !finite(spec.altitudeToleranceFt)) return 'survey_spec_parameters_invalid';
    const lines = spec.scan?.lines;
    if (!Array.isArray(lines) || lines.length !== spec.scan.lineCount) return 'survey_spec_lines_invalid';
    const ids = new Set();
    for (const line of lines) {
        if (!line || !String(line.id || '').trim() || ids.has(String(line.id)) || !point(line.start) || !point(line.end)
            || core.haversineNm(line.start.lat, line.start.lon, line.end.lat, line.end.lon) <= 0.0001) return 'survey_spec_lines_invalid';
        ids.add(String(line.id));
    }
    return null;
}

function normalizeSample(raw = {}) {
    const number = value => finite(value) ? value : NaN;
    return {
        observedAt: number(raw.observedAt), lat: number(raw.lat), lon: number(raw.lon),
        altFt: number(raw.altFt), gsKts: number(raw.gsKts),
        headingDeg: number(raw.headingDeg ?? raw.hdg),
        onGround: raw.onGround === true, simPaused: raw.simPaused === true,
        inMenuOrMap: raw.inMenuOrMap === true,
        slewMode: raw.slewMode === true || raw.slewActive === true || raw.isSlewActive === true
    };
}

function createState(specRaw, saved = null) {
    const error = validateSpec(specRaw);
    if (error) throw new TypeError(error);
    const spec = core.normalizeSpec(specRaw);
    if (saved && (saved.schema !== RUNTIME_SCHEMA || saved.specKey !== spec.key)) {
        throw new TypeError('survey_runtime_identity_mismatch');
    }
    if (saved && (saved.observedAt !== null && (!finite(saved.observedAt) || saved.observedAt < 0))) {
        throw new TypeError('survey_runtime_state_invalid');
    }
    const detector = core.hydrateRuntimeState(spec, boundedDetector(spec, saved));
    return {
        schema: RUNTIME_SCHEMA,
        specKey: spec.key,
        observedAt: saved?.observedAt ?? null,
        detector: core.serializeState(detector),
        progress: core.snapshotState(detector),
        previousSample: point(saved?.previousSample) && finite(saved.previousSample.observedAt)
            && finite(saved.previousSample.altFt) && finite(saved.previousSample.gsKts) && finite(saved.previousSample.headingDeg)
            ? normalizeSample(saved.previousSample) : null
    };
}

function resetActive(detector, reason, events) {
    if (detector.scan?.active) {
        detector.scan.lastResetReason = reason;
        events.push({ type: 'line_reset_discontinuity', lineId: String(detector.scan.active.lineId || ''), reason });
        detector.scan.active = null;
    }
    if (detector.orbit?.active) {
        detector.orbit.lastResetReason = reason;
        events.push({ type: 'orbit_reset_discontinuity', reason });
        detector.orbit.active = null;
    }
}

function endpointIsCreditEligible(spec, sample) {
    if (!point(sample) || !finite(sample.altFt) || !finite(sample.gsKts) || sample.gsKts <= 0) return false;
    if (!core.sampleAltitudeOk(spec, sample)) return false;
    const minGs = spec.type === 'orbit' ? spec.orbit.minGroundSpeedKts : spec.scan.minGroundSpeedKts;
    return sample.gsKts >= minGs;
}

function physicallyPlausible(previous, sample) {
    const elapsedMs = sample.observedAt - previous.observedAt;
    if (!(elapsedMs > 0 && elapsedMs <= MAX_GAP_MS)) return false;
    const distance = core.haversineNm(previous.lat, previous.lon, sample.lat, sample.lon);
    // 2.25x reported speed plus 0.04 NM GPS tolerance admits ordinary turns,
    // but rejects teleports and line-sized jumps at survey speeds.
    const maxGs = Math.max(previous.gsKts, sample.gsKts, 1);
    const maxDistance = maxGs * (elapsedMs / 3600000) * 2.25 + 0.04;
    return distance <= maxDistance;
}

function interpolate(previous, current) {
    const elapsedMs = current.observedAt - previous.observedAt;
    const distance = core.haversineNm(previous.lat, previous.lon, current.lat, current.lon);
    const intervalMs = Math.max(250, Math.min(1000, elapsedMs / Math.max(1, Math.ceil(distance / 0.025))));
    const steps = Math.min(MAX_INTERPOLATION_STEPS, Math.max(1, Math.ceil(elapsedMs / intervalMs)));
    const samples = [];
    for (let index = 1; index < steps; index++) {
        const t = index / steps;
        const heading = finite(previous.headingDeg) && finite(current.headingDeg)
            ? previous.headingDeg + ((((current.headingDeg - previous.headingDeg) % 360) + 540) % 360 - 180) * t
            : NaN;
        const lonDelta = ((((current.lon - previous.lon) % 360) + 540) % 360) - 180;
        const lon = ((previous.lon + lonDelta * t + 540) % 360) - 180;
        samples.push({ observedAt: previous.observedAt + elapsedMs * t,
            lat: previous.lat + (current.lat - previous.lat) * t,
            lon,
            altFt: previous.altFt + (current.altFt - previous.altFt) * t,
            gsKts: previous.gsKts + (current.gsKts - previous.gsKts) * t,
            headingDeg: heading });
    }
    return samples;
}

function observe(specRaw, previous, rawSample, facts = {}) {
    const spec = core.normalizeSpec(specRaw);
    const state = createState(spec, previous);
    const unchanged = reason => ({ state, events: [], changed: false, reason, progress: state.progress,
        satisfied: !!state.progress?.satisfied });
    const sample = normalizeSample(rawSample);
    if (!finite(sample.observedAt) || sample.observedAt < 0) return unchanged('survey_telemetry_invalid');
    if (state.observedAt !== null && sample.observedAt <= state.observedAt) return unchanged('survey_telemetry_stale');
    if (facts.active !== true || facts.trackingActive !== true || facts.ending === true) return unchanged('survey_task_inactive');
    const detector = core.hydrateRuntimeState(spec, state.detector);
    const events = [];
    const discontinuity = sample.simPaused || sample.inMenuOrMap || sample.slewMode || sample.onGround
        || facts.suspended === true || facts.disconnected === true;
    state.observedAt = sample.observedAt;
    if (discontinuity) {
        resetActive(detector, sample.simPaused || sample.inMenuOrMap || facts.suspended || facts.disconnected ? 'suspended'
            : sample.slewMode ? 'slew' : 'ground', events);
        state.detector = core.serializeState(detector);
        state.progress = core.snapshotState(detector);
        state.previousSample = null;
        return { state, events, changed: true, reason: 'survey_task_discontinuous', progress: state.progress,
            satisfied: !!state.progress?.satisfied };
    }
    if (!point(sample) || !finite(sample.altFt) || !finite(sample.gsKts) || sample.gsKts <= 0 || !finite(sample.headingDeg)) {
        resetActive(detector, 'invalid_telemetry', events);
        state.detector = core.serializeState(detector);
        state.progress = core.snapshotState(detector);
        state.previousSample = null;
        return { state, events, changed: true, reason: 'survey_telemetry_invalid', progress: state.progress,
            satisfied: !!state.progress?.satisfied };
    }
    const prior = state.previousSample;
    if (prior && sample.observedAt - prior.observedAt > MAX_GAP_MS) resetActive(detector, 'long_gap', events);
    const mayFill = prior && endpointIsCreditEligible(spec, prior) && endpointIsCreditEligible(spec, sample)
        && physicallyPlausible(prior, sample);
    // Both endpoints claim to be usable survey flight, but the implied path is
    // impossible for their groundspeed. Treat this as a teleport rather than
    // allowing an old active line/orbit to bridge it.
    if (prior && endpointIsCreditEligible(spec, prior) && endpointIsCreditEligible(spec, sample)
        && !physicallyPlausible(prior, sample) && sample.observedAt - prior.observedAt <= MAX_GAP_MS) {
        resetActive(detector, 'teleport', events);
    }
    if (mayFill) {
        for (const synthetic of interpolate(prior, sample)) {
            const tick = core.tickState(spec, detector, { ...synthetic, nowMs: synthetic.observedAt });
            detector.events = tick.events;
            events.push(...tick.events);
        }
    }
    // Always give the original algorithm the actual observation. An invalid
    // altitude/speed endpoint is never interpolated, so its own grace/reset
    // behavior remains observable rather than being hidden by breadcrumbs.
    const tick = core.tickState(spec, detector, { ...sample, nowMs: sample.observedAt });
    detector.events = tick.events;
    events.push(...tick.events);
    state.detector = core.serializeState(detector);
    state.progress = core.snapshotState(detector);
    state.previousSample = clone(sample);
    return { state, events, changed: true, reason: mayFill ? 'survey_task_interpolated' : 'survey_task_observed',
        progress: state.progress, satisfied: !!state.progress?.satisfied };
}

function suspend(specRaw, previous, reason = 'suspended') {
    const spec = core.normalizeSpec(specRaw);
    const state = createState(spec, previous);
    const detector = core.hydrateRuntimeState(spec, state.detector);
    const events = [];
    resetActive(detector, String(reason || 'suspended'), events);
    state.detector = core.serializeState(detector);
    state.progress = core.snapshotState(detector);
    state.previousSample = null;
    return { state, events, changed: events.length > 0, reason: 'survey_task_suspended',
        progress: state.progress, satisfied: !!state.progress?.satisfied };
}

module.exports = { RUNTIME_SCHEMA, MAX_GAP_MS, MAX_INTERPOLATION_STEPS, validateSpec, createState, observe, suspend };
