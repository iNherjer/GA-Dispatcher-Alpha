'use strict';

// Tracker boundary for the generated POI-chain detector. It owns only bounded
// JSON checkpoints and telemetry continuity; point and corridor rules stay in
// mission-poi-chain-core.js.
const core = require('../mission-poi-chain-core.js');
const RUNTIME_SCHEMA = 'ga.tracker-poi-chain-task.v1';
const MAX_GAP_MS = 5000;
const MAX_INTERPOLATION_STEPS = 32;

const finite = value => typeof value === 'number' && Number.isFinite(value);
const point = value => finite(value?.lat) && finite(value?.lon)
    && Math.abs(value.lat) <= 90 && Math.abs(value.lon) <= 180;
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function validateSpec(raw) {
    const number = value => value !== null && value !== '' && Number.isFinite(Number(value));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.enabled === false) return 'poi_chain_spec_invalid';
    if (!Array.isArray(raw.points) || raw.points.length < 2 || raw.points.length > 12) return 'poi_chain_spec_points_invalid';
    const ids = new Set();
    for (const [index, item] of raw.points.entries()) {
        const id = String(item?.id || `chain-point-${index + 1}`).trim();
        const lon = item?.lon ?? item?.lng;
        if (!id || ids.has(id) || !number(item?.lat) || !number(lon)
            || Math.abs(Number(item.lat)) > 90 || Math.abs(Number(lon)) > 180
            || (item?.triggerRadiusNm != null && item.triggerRadiusNm !== '' && !number(item.triggerRadiusNm))) return 'poi_chain_spec_points_invalid';
        ids.add(id);
    }
    const corridor = raw.corridor;
    if (corridor != null && (typeof corridor !== 'object' || Array.isArray(corridor))) return 'poi_chain_spec_corridor_invalid';
    const numeric = ['targetSegmentLengthNm', 'minSegmentLengthNm', 'maxSegments', 'crossTrackToleranceNm',
        'minCoverage', 'bins', 'startEndTolerance', 'resetGraceSec', 'minGroundSpeedKts', 'headingToleranceDeg', 'trimPaddingNm'];
    if (corridor && numeric.some(key => Object.hasOwn(corridor, key) && !number(corridor[key]))) return 'poi_chain_spec_corridor_invalid';
    const trace = raw.overlay?.trace ?? raw.corridorTrace;
    if (trace != null && (!Array.isArray(trace) || trace.length > 80 || trace.some(item => !number(item?.lat)
        || !number(item?.lon ?? item?.lng) || Math.abs(Number(item.lat)) > 90 || Math.abs(Number(item.lon ?? item.lng)) > 180))) return 'poi_chain_spec_trace_invalid';
    const spec = core.normalizeSpec(raw);
    if (!spec || spec.points.length < 2 || spec.points.length > 12 || (spec.corridor?.segments?.length || 0) > 40) return 'poi_chain_spec_invalid';
    return null;
}

function boundedDetector(spec, saved) {
    const raw = saved?.detector;
    if (!raw || typeof raw !== 'object' || raw.schema !== 'ga.poiChainProgress.v1' || raw.specKey !== spec.key) return null;
    const validArray = (value, max) => Array.isArray(value) && value.length <= max;
    const validPoints = validArray(raw.completedPointIds, spec.points.length)
        ? raw.completedPointIds.filter(id => spec.points.some(point => String(point.id) === String(id))) : [];
    const runtimeSpec = core.normalizeSpec(spec);
    const runtimeSegments = runtimeSpec?.corridor?.segments || spec.corridor?.segments || [];
    const runtimeBins = runtimeSpec?.corridor?.bins || spec.corridor?.bins || 0;
    const segmentCount = runtimeSegments.length;
    const corridorRaw = raw.corridor && typeof raw.corridor === 'object' ? raw.corridor : {};
    const validSegments = validArray(corridorRaw.completedSegmentIds, segmentCount)
        ? corridorRaw.completedSegmentIds.filter(id => runtimeSegments.some(segment => String(segment.id) === String(id))) : [];
    const active = corridorRaw.active;
    const activeValid = active && typeof active === 'object'
        && runtimeSegments.some(segment => String(segment.id) === String(active.segmentId || ''))
        && validArray(active.bins, runtimeBins)
        && active.bins.every(bin => Number.isInteger(Number(bin)) && Number(bin) >= 0 && Number(bin) < runtimeBins)
        && ['startedAt', 'lastGoodAt', 'badSince', 'lastT'].every(key => finite(Number(active[key])));
    return {
        schema: 'ga.poiChainProgress.v1', specKey: spec.key,
        startedAt: finite(Number(raw.startedAt)) && Number(raw.startedAt) >= 0 ? Number(raw.startedAt) : 0,
        updatedAt: finite(Number(raw.updatedAt)) && Number(raw.updatedAt) >= 0 ? Number(raw.updatedAt) : 0,
        currentIndex: Math.max(0, Math.min(spec.points.length, Math.round(Number(raw.currentIndex) || 0))),
        completedPointIds: validPoints, satisfied: raw.satisfied === true, areaEntered: raw.areaEntered === true,
        lastPointId: String(raw.lastPointId || '').slice(0, 180),
        corridor: {
            completedSegmentIds: validSegments,
            currentSegmentIndex: Math.max(0, Math.min(segmentCount, Math.round(Number(corridorRaw.currentSegmentIndex) || 0))),
            lastResetReason: String(corridorRaw.lastResetReason || '').slice(0, 80), satisfied: corridorRaw.satisfied === true,
            active: activeValid ? { segmentId: String(active.segmentId), direction: active.direction === 'reverse' ? 'reverse' : 'forward',
                bins: active.bins.map(Number), totalBins: runtimeBins, startedAt: Number(active.startedAt),
                lastGoodAt: Number(active.lastGoodAt), badSince: Number(active.badSince), lastT: Number(active.lastT), endCap: active.endCap === true } : null
        }
    };
}

function normalizeSample(raw = {}) {
    const number = value => finite(value) ? value : NaN;
    return { observedAt: number(raw.observedAt), lat: number(raw.lat), lon: number(raw.lon ?? raw.lng),
        gsKts: number(raw.gsKts ?? raw.gs), headingDeg: number(raw.headingDeg ?? raw.hdg),
        onGround: raw.onGround === true, simPaused: raw.simPaused === true, inMenuOrMap: raw.inMenuOrMap === true,
        slewMode: raw.slewMode === true || raw.slewActive === true || raw.isSlewActive === true };
}

function createState(specRaw, saved = null) {
    const error = validateSpec(specRaw);
    if (error) throw new TypeError(error);
    const spec = core.normalizeSpec(specRaw);
    if (saved && (saved.schema !== RUNTIME_SCHEMA || saved.specKey !== spec.key)) throw new TypeError('poi_chain_runtime_identity_mismatch');
    if (saved && saved.observedAt !== null && (!finite(saved.observedAt) || saved.observedAt < 0)) throw new TypeError('poi_chain_runtime_state_invalid');
    const detector = core.hydrateRuntimeState(spec, boundedDetector(spec, saved));
    return { schema: RUNTIME_SCHEMA, specKey: spec.key, observedAt: saved?.observedAt ?? null,
        detector: core.serializeState(detector), progress: core.snapshotState(detector),
        previousSample: point(saved?.previousSample) && finite(saved.previousSample.observedAt)
            && finite(saved.previousSample.gsKts) ? normalizeSample(saved.previousSample) : null };
}

function resetActive(detector, reason, events) {
    const active = detector?.corridor?.active;
    if (!active) return;
    detector.corridor.lastResetReason = String(reason || 'discontinuous').slice(0, 80);
    events.push({ type: 'corridor_segment_reset_discontinuity', reason: detector.corridor.lastResetReason,
        segmentId: String(active.segmentId || '') });
    detector.corridor.active = null;
}

function plausible(previous, current) {
    const elapsed = current.observedAt - previous.observedAt;
    if (!(elapsed > 0 && elapsed <= MAX_GAP_MS) || !point(previous) || !point(current)
        || !finite(previous.gsKts) || !finite(current.gsKts) || previous.gsKts <= 0 || current.gsKts <= 0) return false;
    const maxDistance = Math.max(previous.gsKts, current.gsKts, 1) * (elapsed / 3600000) * 2.25 + 0.04;
    return core.haversineNm(previous.lat, previous.lon, current.lat, current.lon) <= maxDistance;
}

function interpolate(previous, current) {
    const elapsed = current.observedAt - previous.observedAt;
    const distance = core.haversineNm(previous.lat, previous.lon, current.lat, current.lon);
    const interval = Math.max(250, Math.min(1000, elapsed / Math.max(1, Math.ceil(distance / 0.025))));
    const steps = Math.min(MAX_INTERPOLATION_STEPS, Math.max(1, Math.ceil(elapsed / interval)));
    const samples = [];
    for (let index = 1; index < steps; index++) {
        const t = index / steps;
        const heading = finite(previous.headingDeg) && finite(current.headingDeg)
            ? previous.headingDeg + ((((current.headingDeg - previous.headingDeg) % 360) + 540) % 360 - 180) * t : NaN;
        const delta = ((((current.lon - previous.lon) % 360) + 540) % 360) - 180;
        samples.push({ observedAt: previous.observedAt + elapsed * t, lat: previous.lat + (current.lat - previous.lat) * t,
            lon: ((previous.lon + delta * t + 540) % 360) - 180, gsKts: previous.gsKts + (current.gsKts - previous.gsKts) * t,
            headingDeg: heading });
    }
    return samples;
}

function result(state, events, changed, reason, eventBatches = events.length ? [events] : []) {
    return { state, events, eventBatches, changed, reason, progress: state.progress, satisfied: !!state.progress?.satisfied };
}

function observe(specRaw, previous, rawSample, facts = {}) {
    const state = createState(specRaw, previous);
    const sample = normalizeSample(rawSample);
    if (!finite(sample.observedAt) || sample.observedAt < 0) return result(state, [], false, 'poi_chain_telemetry_invalid');
    if (state.observedAt !== null && sample.observedAt <= state.observedAt) return result(state, [], false, 'poi_chain_telemetry_stale');
    if (facts.active !== true || facts.trackingActive !== true || facts.ending === true) return result(state, [], false, 'poi_chain_task_inactive');
    const spec = core.normalizeSpec(specRaw), detector = core.hydrateRuntimeState(spec, state.detector), events = [], eventBatches = [];
    state.observedAt = sample.observedAt;
    const discontinuity = sample.simPaused || sample.inMenuOrMap || sample.slewMode || sample.onGround || facts.suspended === true || facts.disconnected === true;
    if (discontinuity || !point(sample)) {
        resetActive(detector, discontinuity ? (sample.slewMode ? 'slew' : sample.onGround ? 'ground' : 'suspended') : 'invalid_telemetry', events);
        state.detector = core.serializeState(detector); state.progress = core.snapshotState(detector); state.previousSample = null;
        return result(state, events, true, discontinuity ? 'poi_chain_task_discontinuous' : 'poi_chain_telemetry_invalid', events.length ? [events] : []);
    }
    const prior = state.previousSample;
    if (prior && sample.observedAt - prior.observedAt > MAX_GAP_MS) resetActive(detector, 'long_gap', events);
    if (prior && sample.observedAt - prior.observedAt <= MAX_GAP_MS && !plausible(prior, sample)) resetActive(detector, 'teleport', events);
    const mayFill = prior && plausible(prior, sample);
    if (mayFill) for (const synthetic of interpolate(prior, sample)) {
        const tick = core.tickState(spec, detector, { ...synthetic, nowMs: synthetic.observedAt });
        eventBatches.push(tick.events);
        events.push(...tick.events);
    }
    const tick = core.tickState(spec, detector, { ...sample, nowMs: sample.observedAt });
    eventBatches.push(tick.events);
    events.push(...tick.events);
    state.detector = core.serializeState(detector); state.progress = core.snapshotState(detector); state.previousSample = clone(sample);
    return result(state, events, true, mayFill ? 'poi_chain_task_interpolated' : 'poi_chain_task_observed', eventBatches);
}

function suspend(specRaw, previous, reason = 'suspended') {
    const state = createState(specRaw, previous), spec = core.normalizeSpec(specRaw), detector = core.hydrateRuntimeState(spec, state.detector), events = [];
    resetActive(detector, reason, events);
    state.detector = core.serializeState(detector); state.progress = core.snapshotState(detector); state.previousSample = null;
    return result(state, events, events.length > 0, 'poi_chain_task_suspended', events.length ? [events] : []);
}

module.exports = { RUNTIME_SCHEMA, MAX_GAP_MS, MAX_INTERPOLATION_STEPS, validateSpec, createState, observe, suspend };
