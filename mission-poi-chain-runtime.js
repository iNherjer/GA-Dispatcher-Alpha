(function(root) {
    'use strict';

    const host = root || (typeof globalThis !== 'undefined' ? globalThis : {});
    const NM_TO_M = 1852;
    const EARTH_RADIUS_NM = 3440.065;

    const DEFAULTS = {
        triggerRadiusNm: 0.5,
        maxPoints: 12,
        corridor: {
            enabled: true,
            targetSegmentLengthNm: 0.9,
            minSegmentLengthNm: 0.22,
            maxSegments: 18,
            crossTrackToleranceNm: 0.24,
            minCoverage: 0.78,
            bins: 12,
            startEndTolerance: 0.18,
            resetGraceSec: 7,
            minGroundSpeedKts: 35,
            headingToleranceDeg: 70
        }
    };

    let activeState = null;
    let activeSpecKey = '';
    let overlayLayer = null;

    function activeMissionDataFromHost() {
        try {
            if (typeof currentMissionData !== 'undefined' && currentMissionData && typeof currentMissionData === 'object') return currentMissionData;
        } catch (_) {}
        return host.currentMissionData && typeof host.currentMissionData === 'object' ? host.currentMissionData : null;
    }

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

    function normalizeCorridor(raw = {}, overlay = null, guide = null, points = []) {
        const cfg = raw?.corridor && typeof raw.corridor === 'object' ? raw.corridor : {};
        if (cfg.enabled === false) return null;
        const trace = corridorTraceFromRaw(raw, overlay, guide, points);
        const traceInfo = polylineDistanceSamples(trace);
        if (traceInfo.points.length < 2 || !(traceInfo.totalNm > 0.25)) return null;
        const widthTol = Number(overlay?.widthNm || 0) > 0 ? Number(overlay.widthNm) / 2 : 0;
        const crossTrackToleranceNm = Math.max(
            0.06,
            Math.min(0.8, Number(cfg.crossTrackToleranceNm || widthTol || DEFAULTS.corridor.crossTrackToleranceNm))
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
        const overlay = raw.overlay && typeof raw.overlay === 'object' ? raw.overlay : null;
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

    function getMissionSpec(missionData = null, passenger = null) {
        const md = missionData || activeMissionDataFromHost();
        const contract = md?.missionContract || host.activeMissionContract || null;
        const raw = md?.poiChain || contract?.poiChain || passenger?.poiChain || null;
        return normalizeSpec(raw);
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

    function getMapInstance() {
        try {
            if (typeof map !== 'undefined' && map) return map;
        } catch (_) {}
        return host.map || null;
    }

    function ensureOverlayPane(mapInstance = null) {
        const m = mapInstance || getMapInstance();
        if (!m || typeof m.getPane !== 'function') return undefined;
        const name = 'poiChainOverlayPane';
        let pane = m.getPane(name);
        if (!pane && typeof m.createPane === 'function') pane = m.createPane(name);
        if (pane) {
            pane.style.zIndex = '610';
            pane.style.pointerEvents = 'none';
        }
        return name;
    }

    function ensureOverlayLayer() {
        const mapInstance = getMapInstance();
        if (!mapInstance || typeof L === 'undefined') return null;
        const paneName = ensureOverlayPane(mapInstance);
        if (!overlayLayer) overlayLayer = L.layerGroup([], paneName ? { pane: paneName } : undefined);
        if (typeof mapInstance.hasLayer !== 'function' || !mapInstance.hasLayer(overlayLayer)) {
            try { overlayLayer.addTo(mapInstance); } catch (_) { return null; }
        }
        return overlayLayer;
    }

    function makeOverlayLayerPassive(layer) {
        if (!layer || typeof layer !== 'object') return layer;
        if (layer.options && typeof layer.options === 'object') {
            layer.options.interactive = false;
            layer.options.bubblingMouseEvents = false;
            layer.options.keyboard = false;
            layer.options.className = `${layer.options.className || ''} poi-chain-passive-overlay`.trim();
        }
        const applyDomPassThrough = () => {
            try {
                const el = typeof layer.getElement === 'function' ? layer.getElement() : null;
                if (!el) return;
                el.style.pointerEvents = 'none';
                el.setAttribute('aria-hidden', 'true');
            } catch (_) {}
        };
        try {
            if (typeof layer.on === 'function') layer.on('add', applyDomPassThrough);
        } catch (_) {}
        applyDomPassThrough();
        return layer;
    }

    function addPassiveOverlayLayer(leafletLayer, targetLayer) {
        makeOverlayLayerPassive(leafletLayer);
        const added = leafletLayer.addTo(targetLayer);
        makeOverlayLayerPassive(added || leafletLayer);
        return added || leafletLayer;
    }

    function clearOverlay() {
        const mapInstance = getMapInstance();
        if (overlayLayer && mapInstance && typeof mapInstance.removeLayer === 'function') {
            try { mapInstance.removeLayer(overlayLayer); } catch (_) {}
        }
        overlayLayer = null;
    }

    function pointStyle(point, idx, state) {
        const completed = state?.completedPointIds instanceof Set && state.completedPointIds.has(point.id);
        const current = !completed && Number(state?.currentIndex || 0) === idx;
        if (completed) return { color: '#24d26b', fillColor: '#24d26b', weight: 3, opacity: 0.95, fillOpacity: 0.92 };
        if (current) return { color: '#ff4d4d', fillColor: '#ff4d4d', weight: 4, opacity: 0.98, fillOpacity: 0.88 };
        return { color: '#5f6b82', fillColor: '#182538', weight: 2, opacity: 0.45, fillOpacity: 0.35 };
    }

    function drawMarkerLabel(layer, point, idx, spec, state) {
        if (!layer || typeof L === 'undefined') return;
        const paneName = ensureOverlayPane();
        const completed = state?.completedPointIds instanceof Set && state.completedPointIds.has(point.id);
        const current = !completed && Number(state?.currentIndex || 0) === idx;
        if (!completed && !current) return;
        const bg = completed ? 'rgba(20,95,52,.88)' : 'rgba(120,18,24,.9)';
        const text = completed ? `${idx + 1} ✓` : `${idx + 1}`;
        const marker = L.marker([point.lat, point.lon], {
            pane: paneName,
            icon: L.divIcon({
                className: '',
                html: `<div style="background:${bg};color:#fff;font-size:11px;font-weight:700;padding:3px 6px;border-radius:4px;border:1px solid rgba(255,255,255,.45);white-space:nowrap;">${text}</div>`,
                iconAnchor: [10, 10]
            }),
            interactive: false,
            keyboard: false,
            bubblingMouseEvents: false
        });
        addPassiveOverlayLayer(marker, layer);
    }

    function corridorStrokeWeightPx(trace, widthNm, layer) {
        const mapRef = layer?._map || (typeof map !== 'undefined' ? map : null);
        const zoom = Number(mapRef?.getZoom?.());
        const sample = Array.isArray(trace) && trace.length
            ? trace[Math.floor(trace.length / 2)]
            : null;
        const lat = Number(sample?.lat);
        if (!Number.isFinite(zoom) || !Number.isFinite(lat)) return 18;
        const metersPerPixel = (40075016.686 * Math.cos(lat * Math.PI / 180)) / (256 * Math.pow(2, zoom));
        if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return 18;
        const px = (Number(widthNm || 0.5) * NM_TO_M) / metersPerPixel;
        return Math.max(10, Math.min(64, Math.round(px)));
    }

    function corridorEdgeLatLngs(trace, offsetNm) {
        const points = (Array.isArray(trace) ? trace : [])
            .map(point => ({
                lat: Number(point?.lat),
                lon: Number(point?.lon ?? point?.lng)
            }))
            .filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lon));
        if (points.length < 2 || !Number.isFinite(Number(offsetNm))) return [];
        return points.map((point, idx) => {
            const prev = points[Math.max(0, idx - 1)];
            const next = points[Math.min(points.length - 1, idx + 1)];
            const refLat = (prev.lat + next.lat + point.lat) / 3;
            const eastNm = (next.lon - prev.lon) * 60 * Math.max(0.08, Math.abs(Math.cos(toRad(refLat))));
            const northNm = (next.lat - prev.lat) * 60;
            const len = Math.hypot(eastNm, northNm);
            if (!Number.isFinite(len) || len <= 0.0001) return [point.lat, point.lon];
            const normalEast = -northNm / len;
            const normalNorth = eastNm / len;
            const lat = point.lat + (normalNorth * offsetNm) / 60;
            const lonScale = 60 * Math.max(0.08, Math.abs(Math.cos(toRad(point.lat))));
            const lon = point.lon + (normalEast * offsetNm) / lonScale;
            return [roundNumber(lat), roundNumber(lon)];
        }).filter(pair => pair.every(Number.isFinite));
    }

    function drawCorridorEdge(layer, edgeLatLngs, paneName) {
        if (!Array.isArray(edgeLatLngs) || edgeLatLngs.length < 2) return;
        const common = {
            pane: paneName,
            lineCap: 'round',
            lineJoin: 'round',
            smoothFactor: 1.4,
            interactive: false
        };
        addPassiveOverlayLayer(L.polyline(edgeLatLngs, {
            ...common,
            color: '#2f250b',
            weight: 4,
            opacity: 0.58
        }), layer);
        addPassiveOverlayLayer(L.polyline(edgeLatLngs, {
            ...common,
            color: '#ffe58a',
            weight: 2,
            opacity: 0.9
        }), layer);
    }

    function drawCorridorHint(layer, points, spec) {
        if (!layer || typeof L === 'undefined') return;
        const paneName = ensureOverlayPane();
        const trace = Array.isArray(spec?.overlay?.trace) && spec.overlay.trace.length >= 2
            ? spec.overlay.trace
            : points;
        if (!Array.isArray(trace) || trace.length < 2) return;
        const widthNm = Math.max(0.3, Math.min(10, Number(spec?.overlay?.widthNm || 0.5)));
        const tracePoints = trace
            .map(point => ({ lat: Number(point?.lat), lon: Number(point?.lon ?? point?.lng) }))
            .filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lon));
        const latLngs = tracePoints.map(point => [point.lat, point.lon]);
        if (latLngs.length < 2) return;
        const weight = corridorStrokeWeightPx(trace, widthNm, layer);
        addPassiveOverlayLayer(L.polyline(latLngs, {
            pane: paneName,
            color: '#ffcc4d',
            weight,
            opacity: 0.26,
            lineCap: 'round',
            lineJoin: 'round',
            smoothFactor: 1.4,
            interactive: false
        }), layer);
        addPassiveOverlayLayer(L.polyline(latLngs, {
            pane: paneName,
            color: '#ffe58a',
            weight: Math.max(3, Math.round(weight * 0.45)),
            opacity: 0.16,
            lineCap: 'round',
            lineJoin: 'round',
            smoothFactor: 1.4,
            interactive: false
        }), layer);
        const edgeOffsetNm = widthNm / 2;
        drawCorridorEdge(layer, corridorEdgeLatLngs(tracePoints, edgeOffsetNm), paneName);
        drawCorridorEdge(layer, corridorEdgeLatLngs(tracePoints, -edgeOffsetNm), paneName);
    }

    function drawCorridorSegmentProgress(layer, spec = null, progressState = null) {
        if (!layer || typeof L === 'undefined') return;
        const segments = Array.isArray(spec?.corridor?.segments) ? spec.corridor.segments : [];
        if (!segments.length) return;
        const paneName = ensureOverlayPane();
        const completed = progressState?.corridor?.completedSegmentIds instanceof Set
            ? progressState.corridor.completedSegmentIds
            : new Set();
        const currentIdx = Math.max(0, Number(progressState?.corridor?.currentSegmentIndex || 0) || 0);
        segments.forEach((segment, idx) => {
            const done = completed.has(String(segment.id || ''));
            const active = !done && idx === currentIdx;
            const startLat = Number(segment.start?.lat);
            const startLon = Number(segment.start?.lon ?? segment.start?.lng);
            const endLat = Number(segment.end?.lat);
            const endLon = Number(segment.end?.lon ?? segment.end?.lng);
            if (![startLat, startLon, endLat, endLon].every(Number.isFinite)) return;
            addPassiveOverlayLayer(L.polyline([[startLat, startLon], [endLat, endLon]], {
                pane: paneName,
                color: done ? '#24d26b' : (active ? '#ff4d4d' : '#d7b34a'),
                weight: active ? 6 : 4,
                opacity: done ? 0.88 : (active ? 0.92 : 0.28),
                dashArray: done || active ? null : '8,8',
                lineCap: 'round',
                lineJoin: 'round',
                interactive: false
            }), layer);
        });
    }

    function drawOverlay(specRaw = null, progressState = activeState) {
        const spec = normalizeSpec(specRaw);
        if (!spec) {
            clearOverlay();
            return false;
        }
        const layer = ensureOverlayLayer();
        if (!layer || typeof L === 'undefined') return false;
        if (typeof layer.clearLayers === 'function') layer.clearLayers();
        const points = spec.points || [];
        const currentIdx = Math.max(0, Math.min(points.length - 1, Number(progressState?.currentIndex || 0) || 0));
        drawCorridorHint(layer, points, spec);
        drawCorridorSegmentProgress(layer, spec, progressState);
        const revealCurrentPoint = !!(progressState?.areaEntered || (progressState?.completedPointIds instanceof Set && progressState.completedPointIds.size > 0));
        const visiblePoints = points.filter((point, idx) => {
            const completed = progressState?.completedPointIds instanceof Set && progressState.completedPointIds.has(point.id);
            return completed || (revealCurrentPoint && idx === currentIdx) || !spec.sequenceRequired;
        });
        if (points.length < 2 && spec.overlay?.start && spec.overlay?.end) {
            const start = spec.overlay.start;
            const end = spec.overlay.end;
            const startLat = Number(start.lat);
            const startLon = Number(start.lon);
            const endLat = Number(end.lat);
            const endLon = Number(end.lon);
            if ([startLat, startLon, endLat, endLon].every(Number.isFinite)) {
                const fallbackLine = L.polyline([[startLat, startLon], [endLat, endLon]], {
                    pane: ensureOverlayPane(),
                    color: '#f2c94c',
                    weight: 4,
                    opacity: 0.45,
                    dashArray: '10,8',
                    interactive: false
                }).bindTooltip(spec.overlay.label || spec.label, { permanent: false, interactive: false });
                addPassiveOverlayLayer(fallbackLine, layer);
            }
        }
        for (let i = 0; i < visiblePoints.length - 1; i++) {
            const a = visiblePoints[i];
            const b = visiblePoints[i + 1];
            addPassiveOverlayLayer(L.polyline([[a.lat, a.lon], [b.lat, b.lon]], {
                pane: ensureOverlayPane(),
                color: '#ff6b57',
                weight: 4,
                opacity: 0.72,
                dashArray: null,
                interactive: false
            }), layer);
        }
        points.forEach((point, idx) => {
            const completed = progressState?.completedPointIds instanceof Set && progressState.completedPointIds.has(point.id);
            const current = !completed && idx === currentIdx;
            if (!completed && (!current || !revealCurrentPoint) && spec.sequenceRequired) return;
            const label = `${idx + 1}/${points.length} ${point.name}`;
            const radiusCircle = L.circle([point.lat, point.lon], {
                pane: ensureOverlayPane(),
                radius: point.triggerRadiusNm * NM_TO_M,
                color: completed ? '#24d26b' : (current ? '#ff4d4d' : '#5f6b82'),
                weight: completed || current ? 3 : 2,
                opacity: completed || current ? 0.75 : 0.35,
                fillColor: completed ? '#24d26b' : (current ? '#ff4d4d' : '#182538'),
                fillOpacity: completed ? 0.08 : (current ? 0.06 : 0.03),
                dashArray: null,
                interactive: false,
                bubblingMouseEvents: false
            }).bindTooltip(`${label} · ${point.triggerRadiusNm.toFixed(2)} NM`, { permanent: false, interactive: false });
            addPassiveOverlayLayer(radiusCircle, layer);
            const pointMarker = L.circleMarker([point.lat, point.lon], {
                pane: ensureOverlayPane(),
                radius: current ? 8 : 6,
                ...pointStyle(point, idx, progressState),
                interactive: false,
                bubblingMouseEvents: false
            }).bindTooltip(label, { permanent: false, interactive: false });
            addPassiveOverlayLayer(pointMarker, layer);
            drawMarkerLabel(layer, point, idx, spec, progressState);
        });
        return true;
    }

    function sampleFromInput(input = {}) {
        const flightData = input.flightData || {};
        const gps = host.lastLiveGpsPos || {};
        return {
            lat: Number(input.lat),
            lon: Number(input.lon),
            headingDeg: Number(
                input.headingDeg
                ?? flightData.hdg
                ?? flightData.heading
                ?? flightData.trackDeg
                ?? flightData.trkDeg
                ?? gps.hdg
            ),
            gsKts: Number(
                input.gsKts
                ?? flightData.gs
                ?? flightData.gsKts
                ?? flightData.groundSpeed
                ?? gps.gs
            ),
            nowMs: Number(input.nowMs || input.now || Date.now())
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
        drawOverlay(spec, state);
        return { handled: true, state, events, satisfied: !!state.satisfied, progress: snapshotState(state) };
    }

    function tick(input = {}) {
        const spec = getMissionSpec(input.missionData || null, input.passenger || null);
        if (!spec) {
            if (activeSpecKey) reset('no-active-chain');
            return { handled: false, events: [], satisfied: false, progress: null };
        }
        if (!activeState || activeSpecKey !== spec.key || activeState.specKey !== spec.key) {
            activeState = createInitialState(spec);
            activeSpecKey = spec.key;
        }
        const fd = input.flightData || {};
        const sample = {
            lat: Number(input.lat ?? fd.lat),
            lon: Number(input.lon ?? fd.lon ?? fd.lng),
            headingDeg: Number(input.headingDeg ?? fd.hdg ?? fd.heading ?? fd.trackDeg ?? fd.trkDeg),
            gsKts: Number(input.gsKts ?? fd.gs ?? fd.gsKts ?? fd.groundSpeed),
            nowMs: Number(input.nowMs || Date.now()),
            flightData: fd
        };
        const result = tickState(spec, activeState, sample);
        activeState = result.state;
        drawOverlay(spec, activeState);
        return { ...result, spec, progress: snapshotState(activeState) };
    }

    function restoreProgress(progress = null, missionData = null, passenger = null) {
        const spec = getMissionSpec(missionData, passenger);
        if (!spec || !progress) return false;
        activeState = hydrateState(spec, progress);
        activeSpecKey = spec.key;
        drawOverlay(spec, activeState);
        return true;
    }

    function reset() {
        activeState = null;
        activeSpecKey = '';
        clearOverlay();
    }

    function refreshOverlay(missionData = null, passenger = null) {
        const spec = getMissionSpec(missionData, passenger);
        if (!spec) {
            clearOverlay();
            return false;
        }
        if (!activeState || activeSpecKey !== spec.key) {
            activeState = createInitialState(spec);
            activeSpecKey = spec.key;
        }
        return drawOverlay(spec, activeState);
    }

    function refreshActiveMissionOverlay() {
        const md = activeMissionDataFromHost();
        if (!md) return false;
        try {
            return refreshOverlay(md, host.activePassenger || md?.passenger || null);
        } catch (_) {
            return false;
        }
    }

    function scheduleInitialOverlayRefresh() {
        if (typeof setTimeout !== 'function') return;
        [0, 150, 750, 2000].forEach(delay => {
            setTimeout(refreshActiveMissionOverlay, delay);
        });
    }

    const api = {
        defaults: DEFAULTS,
        normalizeSpec,
        getActiveSpec: getMissionSpec,
        tick,
        tickState,
        restoreProgress,
        reset,
        refreshOverlay,
        refreshActiveMissionOverlay,
        snapshot: () => snapshotState(activeState),
        _test: {
            normalizeSpec,
            createInitialState,
            hydrateState,
            snapshotState,
            tickState,
            haversineNm,
            bearingDeg,
            projectPointToSegmentNm,
            normalizeCorridor
        }
    };

    host.missionPoiChainRuntime = api;
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleInitialOverlayRefresh, { once: true });
        else scheduleInitialOverlayRefresh();
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
