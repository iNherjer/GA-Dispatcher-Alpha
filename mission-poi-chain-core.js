// Generated from the pure POI-chain functions in mission-poi-chain-runtime.js by tools/generate-poi-chain-core.mjs.
// Do not edit by hand. The standalone runtime remains the behavioral reference.
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAMissionPoiChainCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
'use strict';
let activeState = null;
const NM_TO_M = 1852;

const EARTH_RADIUS_NM = 3440.065;

const CORRIDOR_WIDTH_VERSION = 2;

const LEGACY_CORRIDOR_WIDTH_SCALE = 4;

const DEFAULTS = {
        triggerRadiusNm: 0.5,
        maxPoints: 12,
        corridor: {
            enabled: true,
            targetSegmentLengthNm: 0.9,
            minSegmentLengthNm: 0.22,
            maxSegments: 18,
            crossTrackToleranceNm: 0.32,
            minCoverage: 0.62,
            bins: 12,
            startEndTolerance: 0.28,
            resetGraceSec: 10,
            minGroundSpeedKts: 35,
            headingToleranceDeg: 75,
            trimPaddingNm: 0.08
        }
    };

function roundNumber(value, digits = 6) {
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        const p = 10 ** digits;
        return Math.round(n * p) / p;
    }

function clamp(value, min, max) {
        const n = Number(value);
        if (!Number.isFinite(n)) return min;
        return Math.max(min, Math.min(max, n));
    }

function toRad(value) {
        return Number(value) * Math.PI / 180;
    }

function toDeg(value) {
        return Number(value) * 180 / Math.PI;
    }

function haversineNm(lat1, lon1, lat2, lon2) {
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const p1 = toRad(lat1);
        const p2 = toRad(lat2);
        const a = Math.sin(dLat / 2) ** 2
            + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
        return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * EARTH_RADIUS_NM;
    }

function bearingDeg(lat1, lon1, lat2, lon2) {
        const p1 = toRad(lat1);
        const p2 = toRad(lat2);
        const dLon = toRad(lon2 - lon1);
        const y = Math.sin(dLon) * Math.cos(p2);
        const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
        return (toDeg(Math.atan2(y, x)) + 360) % 360;
    }

function angleDiffAbs(a, b) {
        return Math.abs((((Number(a) - Number(b)) % 360) + 540) % 360 - 180);
    }

function localPointNm(lat, lon, originLat, originLon) {
        const avgLat = toRad((Number(lat) + Number(originLat)) / 2);
        return {
            x: (Number(lon) - Number(originLon)) * Math.cos(avgLat) * 60,
            y: (Number(lat) - Number(originLat)) * 60
        };
    }

function projectPointToSegmentNm(lat, lon, segment = null) {
        const start = segment?.start || {};
        const end = segment?.end || {};
        const startLat = Number(start.lat);
        const startLon = Number(start.lon ?? start.lng);
        const endLat = Number(end.lat);
        const endLon = Number(end.lon ?? end.lng);
        if (![startLat, startLon, endLat, endLon, Number(lat), Number(lon)].every(Number.isFinite)) return null;
        const e = localPointNm(endLat, endLon, startLat, startLon);
        const p = localPointNm(lat, lon, startLat, startLon);
        const lenSq = e.x * e.x + e.y * e.y;
        const lenNm = Math.sqrt(lenSq);
        if (!(lenSq > 0)) return null;
        const t = (p.x * e.x + p.y * e.y) / lenSq;
        const cx = t * e.x;
        const cy = t * e.y;
        return {
            t,
            tClamped: clamp(t, 0, 1),
            crossTrackNm: Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2),
            alongNm: clamp(t, 0, 1) * lenNm,
            lengthNm: lenNm,
            bearingDeg: bearingDeg(startLat, startLon, endLat, endLon)
        };
    }

function cleanText(value, maxLen = 140) {
        const s = String(value || '').replace(/\s+/g, ' ').trim();
        return maxLen > 0 && s.length > maxLen ? s.slice(0, maxLen).trim() : s;
    }

function normalizePoint(raw = null, idx = 0) {
        if (!raw || typeof raw !== 'object') return null;
        const lat = Number(raw.lat);
        const lon = Number(raw.lon ?? raw.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return {
            id: cleanText(raw.id || `chain-point-${idx + 1}`, 180),
            index: Number.isFinite(Number(raw.index)) ? Number(raw.index) : idx,
            name: cleanText(raw.name || raw.label || `Kettenpunkt ${idx + 1}`, 120),
            lat: roundNumber(lat),
            lon: roundNumber(lon),
            category: cleanText(raw.category || 'poi', 80),
            triggerRadiusNm: Math.max(0.15, Math.min(2.5, Number(raw.triggerRadiusNm || DEFAULTS.triggerRadiusNm))),
            required: raw.required !== false,
            revealState: idx === 0 ? 'visible' : cleanText(raw.revealState || 'hidden', 40),
            orderT: Number.isFinite(Number(raw.orderT)) ? Math.max(0, Math.min(1, Number(raw.orderT))) : null,
            distCorridorNm: Number.isFinite(Number(raw.distCorridorNm)) ? Math.max(0, Number(raw.distCorridorNm)) : null,
            distanceFromPrevNm: Math.max(0, Number(raw.distanceFromPrevNm || 0) || 0),
            bearingFromPrevDeg: raw.bearingFromPrevDeg === null ? null : Math.round(Number(raw.bearingFromPrevDeg || 0)),
            tags: raw.tags && typeof raw.tags === 'object' ? raw.tags : {}
        };
    }

function normalizeHiddenOutcome(raw = null) {
        if (!raw || typeof raw !== 'object') return null;
        return {
            schema: cleanText(raw.schema || 'ga.poiChainOutcome.v1', 80),
            outcome: cleanText(raw.outcome || '', 40),
            followUpKind: cleanText(raw.followUpKind || '', 80),
            followUpProfileId: cleanText(raw.followUpProfileId || '', 80),
            followUpCategory: cleanText(raw.followUpCategory || '', 80),
            pointId: cleanText(raw.pointId || '', 180),
            pointIndex: Number.isFinite(Number(raw.pointIndex)) ? Number(raw.pointIndex) : null,
            pointName: cleanText(raw.pointName || '', 120),
            findingKind: cleanText(raw.findingKind || '', 80),
            findingHint: cleanText(raw.findingHint || '', 260),
            paxFindingText: cleanText(raw.paxFindingText || '', 300),
            hiddenFromWriter: raw.hiddenFromWriter !== false,
            revealAfter: cleanText(raw.revealAfter || 'point_complete', 80),
            createdAt: Number(raw.createdAt || 0)
        };
    }

function normalizeTracePoint(raw = null) {
        const lat = Number(raw?.lat);
        const lon = Number(raw?.lon ?? raw?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return { lat: roundNumber(lat), lon: roundNumber(lon) };
    }

function dedupeTracePoints(points = []) {
        return (Array.isArray(points) ? points : [])
            .map(normalizeTracePoint)
            .filter(Boolean)
            .filter((point, idx, list) => {
                const prev = idx > 0 ? list[idx - 1] : null;
                return !prev || Math.abs(point.lat - prev.lat) > 0.000001 || Math.abs(point.lon - prev.lon) > 0.000001;
            });
    }

function corridorTraceFromRaw(raw = {}, overlay = null, guide = null, points = []) {
        const overlayTrace = dedupeTracePoints(overlay?.trace || raw?.corridor?.trace || raw?.corridorTrace || []);
        if (overlayTrace.length >= 2) return overlayTrace;
        const endpoints = dedupeTracePoints([
            overlay?.start || guide?.start,
            overlay?.end || guide?.end
        ]);
        if (endpoints.length >= 2) return endpoints;
        return dedupeTracePoints(points);
    }

function normalizeCorridorWidthNm(overlay = null) {
        const declaredWidthNm = Math.max(0.3, Math.min(10, Number(overlay?.widthNm || 0.5)));
        const widthVersion = Number(overlay?.widthVersion || 0);
        const scale = widthVersion >= CORRIDOR_WIDTH_VERSION
            ? 1
            : LEGACY_CORRIDOR_WIDTH_SCALE;
        return Math.max(0.3, Math.min(10, declaredWidthNm * scale));
    }

function polylineDistanceSamples(trace = []) {
        const points = dedupeTracePoints(trace);
        if (points.length < 2) return { points, distances: [0], totalNm: 0 };
        const distances = [0];
        let totalNm = 0;
        for (let i = 1; i < points.length; i++) {
            totalNm += haversineNm(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
            distances.push(totalNm);
        }
        return { points, distances, totalNm };
    }

function interpolateTraceAtNm(traceInfo, distNm) {
        const points = traceInfo?.points || [];
        const distances = traceInfo?.distances || [];
        const totalNm = Number(traceInfo?.totalNm || 0);
        if (points.length < 2 || !(totalNm > 0)) return null;
        const d = clamp(distNm, 0, totalNm);
        for (let i = 1; i < points.length; i++) {
            const prevD = Number(distances[i - 1] || 0);
            const nextD = Number(distances[i] || 0);
            if (d > nextD && i < points.length - 1) continue;
            const span = Math.max(0.000001, nextD - prevD);
            const t = clamp((d - prevD) / span, 0, 1);
            return {
                lat: roundNumber(points[i - 1].lat + (points[i].lat - points[i - 1].lat) * t),
                lon: roundNumber(points[i - 1].lon + (points[i].lon - points[i - 1].lon) * t)
            };
        }
        return points[points.length - 1] || null;
    }

function projectPointToTraceNm(point = null, traceInfo = null) {
        const lat = Number(point?.lat);
        const lon = Number(point?.lon ?? point?.lng);
        const trace = Array.isArray(traceInfo?.points) ? traceInfo.points : [];
        const distances = Array.isArray(traceInfo?.distances) ? traceInfo.distances : [];
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || trace.length < 2) return null;
        let best = null;
        for (let i = 1; i < trace.length; i++) {
            const start = trace[i - 1];
            const end = trace[i];
            const projection = projectPointToSegmentNm(lat, lon, { start, end });
            if (!projection) continue;
            const prevD = Number(distances[i - 1] || 0);
            const alongNm = prevD + projection.tClamped * Number(projection.lengthNm || 0);
            const candidate = {
                alongNm,
                crossTrackNm: projection.crossTrackNm,
                t: projection.t,
                segmentIndex: i - 1
            };
            if (!best || candidate.crossTrackNm < best.crossTrackNm) best = candidate;
        }
        return best;
    }

function sliceTraceInfoBetweenNm(traceInfo = null, startNm = 0, endNm = 0) {
        const points = Array.isArray(traceInfo?.points) ? traceInfo.points : [];
        const distances = Array.isArray(traceInfo?.distances) ? traceInfo.distances : [];
        const totalNm = Number(traceInfo?.totalNm || 0);
        if (points.length < 2 || !(totalNm > 0)) return traceInfo;
        const a = clamp(Math.min(startNm, endNm), 0, totalNm);
        const b = clamp(Math.max(startNm, endNm), 0, totalNm);
        if (!(b - a > 0.25)) return traceInfo;
        const sliced = [];
        const start = interpolateTraceAtNm(traceInfo, a);
        const end = interpolateTraceAtNm(traceInfo, b);
        if (start) sliced.push(start);
        for (let i = 1; i < points.length - 1; i++) {
            const d = Number(distances[i] || 0);
            if (d > a && d < b) sliced.push(points[i]);
        }
        if (end) sliced.push(end);
        return polylineDistanceSamples(dedupeTracePoints(sliced));
    }

function trimTraceInfoToChainPoints(traceInfo = null, points = [], cfg = {}) {
        const traceTotal = Number(traceInfo?.totalNm || 0);
        const usablePoints = (Array.isArray(points) ? points : []).filter(point => point && point.required !== false);
        if (usablePoints.length < 2 || !(traceTotal > 0.5)) return traceInfo;
        const first = usablePoints[0];
        const last = usablePoints[usablePoints.length - 1];
        let startNm = Number.isFinite(Number(first.orderT)) ? Number(first.orderT) * traceTotal : NaN;
        let endNm = Number.isFinite(Number(last.orderT)) ? Number(last.orderT) * traceTotal : NaN;
        if (!Number.isFinite(startNm)) {
            const projection = projectPointToTraceNm(first, traceInfo);
            if (projection) startNm = projection.alongNm;
        }
        if (!Number.isFinite(endNm)) {
            const projection = projectPointToTraceNm(last, traceInfo);
            if (projection) endNm = projection.alongNm;
        }
        if (!Number.isFinite(startNm) || !Number.isFinite(endNm) || Math.abs(endNm - startNm) < 0.5) return traceInfo;
        const paddingNm = Math.max(0, Math.min(0.3, Number(cfg.trimPaddingNm || DEFAULTS.corridor.trimPaddingNm)));
        return sliceTraceInfoBetweenNm(traceInfo, startNm - paddingNm, endNm + paddingNm);
    }

function normalizeCorridor(raw = {}, overlay = null, guide = null, points = []) {
        const cfg = raw?.corridor && typeof raw.corridor === 'object' ? raw.corridor : {};
        if (cfg.enabled === false) return null;
        const trace = corridorTraceFromRaw(raw, overlay, guide, points);
        let traceInfo = polylineDistanceSamples(trace);
        traceInfo = trimTraceInfoToChainPoints(traceInfo, points, cfg);
        if (traceInfo.points.length < 2 || !(traceInfo.totalNm > 0.25)) return null;
        const widthTol = Number(overlay?.widthNm || 0) > 0 ? Number(overlay.widthNm) / 2 : 0;
        const configuredTol = Number(cfg.crossTrackToleranceNm);
        const crossTrackToleranceNm = Math.max(
            0.06,
            Math.min(
                5,
                Number.isFinite(configuredTol) && configuredTol > 0
                    ? configuredTol
                    : Math.max(widthTol, DEFAULTS.corridor.crossTrackToleranceNm)
            )
        );
        const targetLen = Math.max(0.35, Math.min(2.5, Number(cfg.targetSegmentLengthNm || DEFAULTS.corridor.targetSegmentLengthNm)));
        const maxSegments = Math.max(1, Math.min(40, Math.round(Number(cfg.maxSegments || DEFAULTS.corridor.maxSegments))));
        const segmentCount = Math.max(1, Math.min(maxSegments, Math.ceil(traceInfo.totalNm / targetLen)));
        const minSegmentLengthNm = Math.max(0.08, Math.min(0.8, Number(cfg.minSegmentLengthNm || DEFAULTS.corridor.minSegmentLengthNm)));
        const segments = [];
        for (let i = 0; i < segmentCount; i++) {
            const startD = (traceInfo.totalNm * i) / segmentCount;
            const endD = (traceInfo.totalNm * (i + 1)) / segmentCount;
            const start = interpolateTraceAtNm(traceInfo, startD);
            const end = interpolateTraceAtNm(traceInfo, endD);
            if (!start || !end) continue;
            const lengthNm = haversineNm(start.lat, start.lon, end.lat, end.lon);
            if (!(lengthNm >= minSegmentLengthNm)) continue;
            segments.push({
                id: cleanText(`C${segments.length + 1}`, 40),
                index: segments.length,
                label: cleanText(`Korridorsegment ${segments.length + 1}`, 80),
                start,
                end,
                lengthNm: Math.round(lengthNm * 1000) / 1000
            });
        }
        if (!segments.length) return null;
        return {
            schema: 'ga.poiChainCorridor.v1',
            enabled: true,
            required: cfg.required !== false,
            trace: traceInfo.points,
            totalLengthNm: Math.round(traceInfo.totalNm * 100) / 100,
            crossTrackToleranceNm,
            minCoverage: Math.max(0.35, Math.min(1, Number(cfg.minCoverage || DEFAULTS.corridor.minCoverage))),
            bins: Math.max(6, Math.min(60, Math.round(Number(cfg.bins || DEFAULTS.corridor.bins)))),
            startEndTolerance: Math.max(0.05, Math.min(0.45, Number(cfg.startEndTolerance || DEFAULTS.corridor.startEndTolerance))),
            resetGraceSec: Math.max(1, Math.min(30, Number(cfg.resetGraceSec || DEFAULTS.corridor.resetGraceSec))),
            minGroundSpeedKts: Math.max(0, Math.min(140, Number(cfg.minGroundSpeedKts || DEFAULTS.corridor.minGroundSpeedKts))),
            headingToleranceDeg: Math.max(10, Math.min(120, Number(cfg.headingToleranceDeg || DEFAULTS.corridor.headingToleranceDeg))),
            segments
        };
    }

function normalizeSpec(raw = null) {
        if (!raw || typeof raw !== 'object') return null;
        if (raw.enabled === false) return null;
        const points = (Array.isArray(raw.points) ? raw.points : [])
            .map(normalizePoint)
            .filter(Boolean)
            .slice(0, Math.max(2, Number(raw.maxRuntimePoints || DEFAULTS.maxPoints) || DEFAULTS.maxPoints));
        if (points.length < 2) return null;
        const label = cleanText(raw.label || raw.title || 'POI-Kette', 120);
        const theme = cleanText(raw.theme || 'poi_chain', 80);
        const key = cleanText(raw.key || [
            'poi-chain',
            theme,
            roundNumber(points[0].lat, 5),
            roundNumber(points[0].lon, 5),
            points.length,
            label
        ].join(':'), 220);
        const guide = raw.guide && typeof raw.guide === 'object' ? raw.guide : null;
        const rawOverlay = raw.overlay && typeof raw.overlay === 'object' ? raw.overlay : null;
        const overlay = rawOverlay ? {
            ...rawOverlay,
            widthNm: normalizeCorridorWidthNm(rawOverlay),
            widthVersion: CORRIDOR_WIDTH_VERSION
        } : null;
        const corridor = normalizeCorridor(raw, overlay, guide, points);
        return {
            schema: 'ga.poiChainRuntime.v1',
            key,
            kind: 'poi_chain',
            mode: cleanText(raw.mode || 'progressive_reveal', 80),
            theme,
            label,
            guide: guide ? {
                type: cleanText(guide.type || '', 80),
                name: cleanText(guide.name || guide.namePattern || '', 120),
                start: guide.start || overlay?.start || null,
                end: guide.end || overlay?.end || null,
                guidePointCount: Number(guide.guidePointCount || 0)
            } : null,
            overlay: overlay ? {
                type: cleanText(overlay.type || 'corridor_hint', 80),
                label: cleanText(overlay.label || label, 120),
                start: overlay.start || guide?.start || null,
                end: overlay.end || guide?.end || null,
                radiusNm: Math.max(0.2, Math.min(8, Number(overlay.radiusNm || 1.5))),
                widthNm: Math.max(0.3, Math.min(10, Number(overlay.widthNm || 0.5))),
                widthVersion: CORRIDOR_WIDTH_VERSION,
                trace: (Array.isArray(overlay.trace) ? overlay.trace : [])
                    .map(point => {
                        const lat = Number(point?.lat);
                        const lon = Number(point?.lon ?? point?.lng);
                        return Number.isFinite(lat) && Number.isFinite(lon) ? { lat: roundNumber(lat), lon: roundNumber(lon) } : null;
                    })
                    .filter(Boolean)
                    .slice(0, 80)
            } : null,
            points,
            corridor,
            hiddenOutcome: normalizeHiddenOutcome(raw.hiddenOutcome),
            sequenceRequired: raw.sequenceRequired !== false,
            completionMode: raw.completionMode || 'all_required',
            fallbackAllowed: raw.fallbackAllowed !== false,
            dispatch: raw.dispatch || null
        };
    }

function setFromArray(value) {
        return new Set(Array.isArray(value) ? value.map(String).filter(Boolean) : []);
    }

function corridorRequired(spec = null) {
        return !!(spec?.corridor?.required && Array.isArray(spec.corridor.segments) && spec.corridor.segments.length);
    }

function requiredPointsDone(spec = null, state = null) {
        const completed = state?.completedPointIds instanceof Set ? state.completedPointIds : new Set();
        const points = Array.isArray(spec?.points) ? spec.points : [];
        return points.every(point => point?.required === false || completed.has(String(point.id || '')));
    }

function corridorDone(spec = null, state = null) {
        if (!corridorRequired(spec)) return true;
        const completed = state?.corridor?.completedSegmentIds instanceof Set ? state.corridor.completedSegmentIds : new Set();
        return spec.corridor.segments.every(segment => completed.has(String(segment.id || '')));
    }

function createInitialState(spec) {
        const totalSegments = Array.isArray(spec?.corridor?.segments) ? spec.corridor.segments.length : 0;
        return {
            schema: 'ga.poiChainProgress.v1',
            specKey: spec.key,
            startedAt: 0,
            updatedAt: 0,
            currentIndex: 0,
            completedPointIds: new Set(),
            satisfied: false,
            areaEntered: false,
            lastPointId: '',
            corridor: {
                completedSegmentIds: new Set(),
                currentSegmentIndex: 0,
                active: null,
                lastResetReason: '',
                totalSegments,
                satisfied: !corridorRequired(spec)
            },
            events: []
        };
    }

function hydrateState(spec, progress = null) {
        const state = createInitialState(spec);
        if (!progress || typeof progress !== 'object') return state;
        state.completedPointIds = setFromArray(progress.completedPointIds);
        state.startedAt = Number(progress.startedAt || 0);
        state.updatedAt = Number(progress.updatedAt || 0);
        state.currentIndex = Math.max(0, Math.min(spec.points.length - 1, Number(progress.currentIndex || 0) || 0));
        while (state.currentIndex < spec.points.length && state.completedPointIds.has(spec.points[state.currentIndex].id)) {
            state.currentIndex += 1;
        }
        if (progress.corridor && typeof progress.corridor === 'object') {
            state.corridor.completedSegmentIds = setFromArray(progress.corridor.completedSegmentIds);
            state.corridor.lastResetReason = cleanText(progress.corridor.lastResetReason || '', 80);
            state.corridor.currentSegmentIndex = Math.max(0, Math.min(
                Math.max(0, state.corridor.totalSegments),
                Number(progress.corridor.currentSegmentIndex || progress.corridor.completedCount || 0) || 0
            ));
            while (
                state.corridor.currentSegmentIndex < state.corridor.totalSegments
                && state.corridor.completedSegmentIds.has(spec.corridor?.segments?.[state.corridor.currentSegmentIndex]?.id)
            ) {
                state.corridor.currentSegmentIndex += 1;
            }
            state.corridor.satisfied = !!progress.corridor.satisfied || corridorDone(spec, state);
        }
        state.satisfied = requiredPointsDone(spec, state) && corridorDone(spec, state);
        state.areaEntered = !!progress.areaEntered || state.completedPointIds.size > 0 || !!state.startedAt;
        state.lastPointId = cleanText(progress.lastPointId || '', 180);
        return state;
    }

function snapshotState(state = activeState) {
        if (!state) return null;
        const corridorCompleted = Array.from(state.corridor?.completedSegmentIds || []);
        const activeCorridor = state.corridor?.active || null;
        const activeCoverage = activeCorridor?.bins instanceof Set
            ? Math.round((activeCorridor.bins.size / Math.max(1, Number(activeCorridor.totalBins || 1))) * 100) / 100
            : 0;
        return {
            schema: 'ga.poiChainProgress.v1',
            specKey: state.specKey,
            startedAt: Number(state.startedAt || 0),
            updatedAt: Number(state.updatedAt || 0),
            currentIndex: Math.max(0, Number(state.currentIndex || 0) || 0),
            completedPointIds: Array.from(state.completedPointIds || []),
            completedCount: state.completedPointIds instanceof Set ? state.completedPointIds.size : 0,
            satisfied: !!state.satisfied,
            areaEntered: !!state.areaEntered,
            lastPointId: state.lastPointId || '',
            corridor: state.corridor ? {
                completedSegmentIds: corridorCompleted,
                completedCount: corridorCompleted.length,
                totalSegments: Math.max(0, Number(state.corridor.totalSegments || 0)),
                currentSegmentIndex: Math.max(0, Number(state.corridor.currentSegmentIndex || 0) || 0),
                activeSegmentId: activeCorridor?.segmentId || '',
                activeCoverage,
                lastResetReason: cleanText(state.corridor.lastResetReason || '', 80),
                satisfied: !!state.corridor.satisfied
            } : null
        };
    }

function sampleSpeedOk(minGroundSpeedKts, sample) {
        const gs = Number(sample.gsKts);
        if (!Number.isFinite(gs) || gs <= 0) return true;
        return gs >= Number(minGroundSpeedKts || 0);
    }

function headingMatchesSegment(corridor = {}, projection = null, sample = null, direction = '') {
        const hdg = Number(sample?.headingDeg);
        if (!Number.isFinite(hdg)) return true;
        const b = Number(projection?.bearingDeg);
        if (!Number.isFinite(b)) return true;
        const expected = direction === 'reverse' ? (b + 180) % 360 : b;
        return angleDiffAbs(hdg, expected) <= Number(corridor.headingToleranceDeg || DEFAULTS.corridor.headingToleranceDeg);
    }

function findSegmentProjection(segment = null, sample = null) {
        if (!segment || !Number.isFinite(Number(sample?.lat)) || !Number.isFinite(Number(sample?.lon))) return null;
        const projection = projectPointToSegmentNm(sample.lat, sample.lon, segment);
        if (!projection) return null;
        return { segment, projection };
    }

function sampleNearCorridor(spec = null, sample = null) {
        const corridor = spec?.corridor || null;
        const segments = Array.isArray(corridor?.segments) ? corridor.segments : [];
        if (!segments.length) return false;
        const tol = Number(corridor.crossTrackToleranceNm || DEFAULTS.corridor.crossTrackToleranceNm) + 0.25;
        return segments.some(segment => {
            const projection = projectPointToSegmentNm(sample?.lat, sample?.lon, segment);
            return !!(projection && projection.t >= -0.15 && projection.t <= 1.15 && projection.crossTrackNm <= tol);
        });
    }

function makeCorridorResetEvent(reason = 'offtrack', segment = null) {
        return {
            type: reason === 'speed' ? 'corridor_segment_reset_speed' : 'corridor_segment_reset_offtrack',
            reason,
            segment,
            segmentId: cleanText(segment?.id || '', 80)
        };
    }

function tickCorridorState(spec = null, state = null, sample = null, events = []) {
        if (!corridorRequired(spec) || !state?.corridor) {
            if (state?.corridor) state.corridor.satisfied = true;
            return;
        }
        const corridor = spec.corridor;
        const segments = corridor.segments || [];
        const now = Number(sample?.nowMs || Date.now());
        if (!Number.isFinite(sample?.lat) || !Number.isFinite(sample?.lon)) return;
        if (!state.areaEntered && sampleNearCorridor(spec, sample)) {
            state.areaEntered = true;
            if (!state.startedAt) state.startedAt = now;
            events.push({ type: 'chain_corridor_entered' });
        }

        let idx = Math.max(0, Math.min(segments.length, Number(state.corridor.currentSegmentIndex || 0) || 0));
        while (idx < segments.length && state.corridor.completedSegmentIds.has(String(segments[idx]?.id || ''))) idx += 1;
        state.corridor.currentSegmentIndex = idx;
        const segment = segments[idx] || null;
        if (!segment) {
            state.corridor.satisfied = true;
            return;
        }

        const candidate = findSegmentProjection(segment, sample);
        const projection = candidate?.projection || null;
        const withinSegment = !!(projection && projection.t >= -0.08 && projection.t <= 1.08);
        const inCorridor = !!(withinSegment && projection.crossTrackNm <= corridor.crossTrackToleranceNm);
        const speedOk = sampleSpeedOk(corridor.minGroundSpeedKts, sample);
        let active = state.corridor.active;

        if (!active && inCorridor && speedOk) {
            const t = clamp(projection.t, 0, 1);
            const edge = Number(corridor.startEndTolerance || DEFAULTS.corridor.startEndTolerance);
            if (t <= edge || t >= 1 - edge) {
                const direction = t <= 0.5 ? 'forward' : 'reverse';
                if (headingMatchesSegment(corridor, projection, sample, direction)) {
                    active = {
                        segmentId: String(segment.id || ''),
                        direction,
                        bins: new Set(),
                        totalBins: corridor.bins,
                        startedAt: now,
                        lastGoodAt: now,
                        badSince: 0,
                        lastT: t,
                        endCap: false
                    };
                    state.corridor.active = active;
                    if (!state.startedAt) state.startedAt = now;
                    state.areaEntered = true;
                    events.push({ type: 'corridor_segment_started', segment, segmentIndex: idx });
                }
            }
        }

        active = state.corridor.active;
        if (!active) return;

        const sameSegment = inCorridor && String(active.segmentId || '') === String(segment.id || '');
        const headingOk = sameSegment && headingMatchesSegment(corridor, projection, sample, active.direction);
        const valid = sameSegment && speedOk && headingOk;
        if (!valid) {
            if (!active.badSince) active.badSince = now;
            const graceMs = Number(corridor.resetGraceSec || DEFAULTS.corridor.resetGraceSec) * 1000;
            if ((now - active.badSince) >= graceMs) {
                const reason = !speedOk ? 'speed' : 'offtrack';
                state.corridor.lastResetReason = reason;
                events.push(makeCorridorResetEvent(reason, segment));
                state.corridor.active = null;
            }
            return;
        }

        const t = clamp(projection.t, 0, 1);
        const movedBack = active.direction === 'forward'
            ? t < Number(active.lastT || 0) - 0.22
            : t > Number(active.lastT || 1) + 0.22;
        if (movedBack) {
            state.corridor.lastResetReason = 'offtrack';
            events.push(makeCorridorResetEvent('offtrack', segment));
            state.corridor.active = null;
            return;
        }
        active.badSince = 0;
        active.lastGoodAt = now;
        active.lastT = t;
        const bin = Math.min(corridor.bins - 1, Math.max(0, Math.floor(clamp(t, 0, 0.999) * corridor.bins)));
        active.bins.add(bin);
        if ((active.direction === 'forward' && t >= 1 - corridor.startEndTolerance)
            || (active.direction === 'reverse' && t <= corridor.startEndTolerance)) {
            active.endCap = true;
        }
        const coverage = active.bins.size / Math.max(1, Number(active.totalBins || corridor.bins));
        if (active.endCap && coverage >= corridor.minCoverage) {
            state.corridor.completedSegmentIds.add(String(segment.id || ''));
            events.push({
                type: 'corridor_segment_complete',
                segment,
                segmentIndex: idx,
                completedCount: state.corridor.completedSegmentIds.size,
                totalSegments: segments.length
            });
            state.corridor.active = null;
            state.corridor.currentSegmentIndex = idx + 1;
            if (state.corridor.completedSegmentIds.size >= segments.length) {
                state.corridor.satisfied = true;
                events.push({ type: 'chain_corridor_complete', totalSegments: segments.length });
            }
        }
    }

function tickState(specRaw, stateRaw, sampleRaw = {}) {
        const spec = normalizeSpec(specRaw);
        if (!spec) return { handled: false, state: stateRaw || null, events: [], satisfied: false, progress: null };
        const state = stateRaw || createInitialState(spec);
        if (state.specKey !== spec.key) return tickState(spec, createInitialState(spec), sampleRaw);
        if (!state.corridor) state.corridor = createInitialState(spec).corridor;
        state.satisfied = requiredPointsDone(spec, state) && corridorDone(spec, state);
        if (state.satisfied) return { handled: true, state, events: [], satisfied: true, progress: snapshotState(state) };
        const sample = sampleFromInput(sampleRaw);
        const lat = Number(sample.lat);
        const lon = Number(sample.lon);
        const nowMs = Number(sample.nowMs || Date.now());
        const events = [];
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return { handled: true, state, events, satisfied: !!state.satisfied, progress: snapshotState(state) };
        }
        const wasSatisfied = !!state.satisfied;
        tickCorridorState(spec, state, sample, events);
        let idx = Math.max(0, Math.min(spec.points.length - 1, Number(state.currentIndex || 0) || 0));
        while (idx < spec.points.length && state.completedPointIds.has(spec.points[idx].id)) idx += 1;
        state.currentIndex = idx;
        const current = spec.points[idx] || null;
        if (!current) {
            state.currentIndex = spec.points.length;
        } else {
            const distNm = haversineNm(lat, lon, current.lat, current.lon);
            if (distNm <= current.triggerRadiusNm) {
                if (!state.startedAt) state.startedAt = nowMs;
                state.areaEntered = true;
                state.completedPointIds.add(current.id);
                state.lastPointId = current.id;
                const nextIndex = idx + 1;
                const nextPoint = spec.points[nextIndex] || null;
                const hiddenOutcome = spec.hiddenOutcome
                    && String(spec.hiddenOutcome.pointId || '') === String(current.id || '')
                    && String(spec.hiddenOutcome.revealAfter || 'point_complete').toLowerCase() === 'point_complete'
                    ? spec.hiddenOutcome
                    : null;
                state.currentIndex = nextPoint ? nextIndex : spec.points.length;
                events.push({
                    type: 'point_complete',
                    point: current,
                    pointIndex: idx,
                    nextPoint,
                    nextIndex: nextPoint ? nextIndex : null,
                    hiddenOutcome,
                    findingText: hiddenOutcome?.paxFindingText || hiddenOutcome?.findingHint || '',
                    findingHint: hiddenOutcome?.findingHint || '',
                    finding: hiddenOutcome?.findingKind || '',
                    distNm: roundNumber(distNm, 3)
                });
                if (!requiredPointsDone(spec, state) && nextPoint) {
                    events.push({ type: 'next_point_revealed', point: nextPoint, pointIndex: nextIndex });
                }
            }
        }
        const pointsDone = requiredPointsDone(spec, state);
        const corridorComplete = corridorDone(spec, state);
        if (state.corridor) state.corridor.satisfied = corridorComplete;
        state.satisfied = pointsDone && corridorComplete;
        if (state.satisfied && !wasSatisfied) events.push({ type: 'chain_complete' });
        state.updatedAt = nowMs;
        state.events = events;
        return { handled: true, state, events, satisfied: !!state.satisfied, progress: snapshotState(state) };
    }

// The app runtime's version also reads browser globals. The core accepts only
// the normalized input supplied by its caller.
function sampleFromInput(input = {}) {
  return { lat: Number(input.lat), lon: Number(input.lon ?? input.lng),
    headingDeg: Number(input.headingDeg ?? input.hdg), gsKts: Number(input.gsKts ?? input.gs),
    nowMs: Number(input.nowMs ?? input.now) };
}

function serializeState(state) {
  const out = snapshotState(state);
  if (!out) return null;
  const active = state?.corridor?.active;
  if (active && typeof active === 'object') {
    out.corridor.active = {
      segmentId: String(active.segmentId || ''), direction: active.direction === 'reverse' ? 'reverse' : 'forward',
      bins: active.bins instanceof Set ? Array.from(active.bins) : [], totalBins: Number(active.totalBins || 0),
      startedAt: Number(active.startedAt || 0), lastGoodAt: Number(active.lastGoodAt || 0),
      badSince: Number(active.badSince || 0), lastT: Number(active.lastT || 0), endCap: active.endCap === true
    };
  }
  return out;
}

function hydrateRuntimeState(specRaw, saved) {
  const spec = specRaw?.schema === 'ga.poiChainRuntime.v1' ? specRaw : normalizeSpec(specRaw);
  if (!spec) return null;
  const state = hydrateState(spec, saved);
  const runtimeSpec = normalizeSpec(spec);
  const active = saved?.corridor?.active;
  const segment = runtimeSpec?.corridor?.segments?.find(item => String(item.id) === String(active?.segmentId || ''));
  const bins = Array.isArray(active?.bins) ? active.bins : null;
  if (segment && bins && bins.length <= runtimeSpec.corridor.bins
      && ['startedAt', 'lastGoodAt', 'badSince', 'lastT'].every(key => Number.isFinite(Number(active[key])))) {
    const legalBins = bins.map(Number).filter(bin => Number.isInteger(bin) && bin >= 0 && bin < runtimeSpec.corridor.bins);
    if (legalBins.length === bins.length) state.corridor.active = {
      segmentId: String(segment.id), direction: active.direction === 'reverse' ? 'reverse' : 'forward', bins: new Set(legalBins),
      totalBins: runtimeSpec.corridor.bins, startedAt: Number(active.startedAt), lastGoodAt: Number(active.lastGoodAt),
      badSince: Number(active.badSince), lastT: Number(active.lastT), endCap: active.endCap === true
    };
  }
  // tickState re-normalizes the original spec before testing corridorDone.
  // Preserve that effective completion predicate on a JSON restore as well;
  // the initial normalized spec can have fewer segments than that tick view.
  state.corridor.satisfied = corridorDone(runtimeSpec, state);
  state.satisfied = requiredPointsDone(runtimeSpec, state) && state.corridor.satisfied;
  return state;
}

return { NM_TO_M, EARTH_RADIUS_NM, DEFAULTS, normalizeSpec, createInitialState, hydrateState,
  hydrateRuntimeState, serializeState, snapshotState, tickState, tickCorridorState, haversineNm };
});
