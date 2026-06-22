(function(root) {
    'use strict';

    const host = root || (typeof globalThis !== 'undefined' ? globalThis : {});
    const NM_TO_M = 1852;
    const EARTH_RADIUS_NM = 3440.065;

    const DEFAULTS = {
        triggerRadiusNm: 0.5,
        maxPoints: 12
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

    function createInitialState(spec) {
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
            events: []
        };
    }

    function hydrateState(spec, progress = null) {
        const state = createInitialState(spec);
        if (!progress || typeof progress !== 'object') return state;
        const completed = Array.isArray(progress.completedPointIds) ? progress.completedPointIds : [];
        state.completedPointIds = new Set(completed.map(String));
        state.startedAt = Number(progress.startedAt || 0);
        state.updatedAt = Number(progress.updatedAt || 0);
        state.currentIndex = Math.max(0, Math.min(spec.points.length - 1, Number(progress.currentIndex || 0) || 0));
        while (state.currentIndex < spec.points.length && state.completedPointIds.has(spec.points[state.currentIndex].id)) {
            state.currentIndex += 1;
        }
        state.satisfied = !!progress.satisfied || spec.points.every(point => !point.required || state.completedPointIds.has(point.id));
        state.areaEntered = !!progress.areaEntered || state.completedPointIds.size > 0 || !!state.startedAt;
        state.lastPointId = cleanText(progress.lastPointId || '', 180);
        return state;
    }

    function snapshotState(state = activeState) {
        if (!state) return null;
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
            lastPointId: state.lastPointId || ''
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
        L.marker([point.lat, point.lon], {
            pane: paneName,
            icon: L.divIcon({
                className: '',
                html: `<div style="background:${bg};color:#fff;font-size:11px;font-weight:700;padding:3px 6px;border-radius:4px;border:1px solid rgba(255,255,255,.45);white-space:nowrap;">${text}</div>`,
                iconAnchor: [10, 10]
            }),
            interactive: false
        }).addTo(layer);
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
        L.polyline(edgeLatLngs, {
            ...common,
            color: '#2f250b',
            weight: 4,
            opacity: 0.58
        }).addTo(layer);
        L.polyline(edgeLatLngs, {
            ...common,
            color: '#ffe58a',
            weight: 2,
            opacity: 0.9
        }).addTo(layer);
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
        L.polyline(latLngs, {
            pane: paneName,
            color: '#ffcc4d',
            weight,
            opacity: 0.26,
            lineCap: 'round',
            lineJoin: 'round',
            smoothFactor: 1.4,
            interactive: false
        }).addTo(layer);
        L.polyline(latLngs, {
            pane: paneName,
            color: '#ffe58a',
            weight: Math.max(3, Math.round(weight * 0.45)),
            opacity: 0.16,
            lineCap: 'round',
            lineJoin: 'round',
            smoothFactor: 1.4,
            interactive: false
        }).addTo(layer);
        const edgeOffsetNm = widthNm / 2;
        drawCorridorEdge(layer, corridorEdgeLatLngs(tracePoints, edgeOffsetNm), paneName);
        drawCorridorEdge(layer, corridorEdgeLatLngs(tracePoints, -edgeOffsetNm), paneName);
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
        const visiblePoints = points.filter((point, idx) => {
            const completed = progressState?.completedPointIds instanceof Set && progressState.completedPointIds.has(point.id);
            return completed || idx === currentIdx || !spec.sequenceRequired;
        });
        if (points.length < 2 && spec.overlay?.start && spec.overlay?.end) {
            const start = spec.overlay.start;
            const end = spec.overlay.end;
            const startLat = Number(start.lat);
            const startLon = Number(start.lon);
            const endLat = Number(end.lat);
            const endLon = Number(end.lon);
            if ([startLat, startLon, endLat, endLon].every(Number.isFinite)) {
                L.polyline([[startLat, startLon], [endLat, endLon]], {
                    pane: ensureOverlayPane(),
                    color: '#f2c94c',
                    weight: 4,
                    opacity: 0.45,
                    dashArray: '10,8',
                    interactive: false
                }).bindTooltip(spec.overlay.label || spec.label, { permanent: false }).addTo(layer);
            }
        }
        for (let i = 0; i < visiblePoints.length - 1; i++) {
            const a = visiblePoints[i];
            const b = visiblePoints[i + 1];
            L.polyline([[a.lat, a.lon], [b.lat, b.lon]], {
                pane: ensureOverlayPane(),
                color: '#ff6b57',
                weight: 4,
                opacity: 0.72,
                dashArray: null,
                interactive: false
            }).addTo(layer);
        }
        points.forEach((point, idx) => {
            const completed = progressState?.completedPointIds instanceof Set && progressState.completedPointIds.has(point.id);
            const current = !completed && idx === currentIdx;
            if (!completed && !current && spec.sequenceRequired) return;
            const label = `${idx + 1}/${points.length} ${point.name}`;
            L.circle([point.lat, point.lon], {
                pane: ensureOverlayPane(),
                radius: point.triggerRadiusNm * NM_TO_M,
                color: completed ? '#24d26b' : (current ? '#ff4d4d' : '#5f6b82'),
                weight: completed || current ? 3 : 2,
                opacity: completed || current ? 0.75 : 0.35,
                fillColor: completed ? '#24d26b' : (current ? '#ff4d4d' : '#182538'),
                fillOpacity: completed ? 0.08 : (current ? 0.06 : 0.03),
                dashArray: null
            }).bindTooltip(`${label} · ${point.triggerRadiusNm.toFixed(2)} NM`, { permanent: false }).addTo(layer);
            L.circleMarker([point.lat, point.lon], {
                pane: ensureOverlayPane(),
                radius: current ? 8 : 6,
                ...pointStyle(point, idx, progressState)
            }).bindTooltip(label, { permanent: false }).addTo(layer);
            drawMarkerLabel(layer, point, idx, spec, progressState);
        });
        return true;
    }

    function tickState(specRaw, stateRaw, sampleRaw = {}) {
        const spec = normalizeSpec(specRaw);
        if (!spec) return { handled: false, state: stateRaw || null, events: [], satisfied: false, progress: null };
        const state = stateRaw || createInitialState(spec);
        if (state.specKey !== spec.key) return tickState(spec, createInitialState(spec), sampleRaw);
        if (state.satisfied) return { handled: true, state, events: [], satisfied: true, progress: snapshotState(state) };
        const lat = Number(sampleRaw.lat);
        const lon = Number(sampleRaw.lon);
        const nowMs = Number(sampleRaw.nowMs || sampleRaw.now || Date.now());
        const events = [];
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return { handled: true, state, events, satisfied: !!state.satisfied, progress: snapshotState(state) };
        }
        let idx = Math.max(0, Math.min(spec.points.length - 1, Number(state.currentIndex || 0) || 0));
        while (idx < spec.points.length && state.completedPointIds.has(spec.points[idx].id)) idx += 1;
        state.currentIndex = idx;
        const current = spec.points[idx] || null;
        if (!current) {
            state.satisfied = true;
            events.push({ type: 'chain_complete' });
        } else {
            const distNm = haversineNm(lat, lon, current.lat, current.lon);
            if (distNm <= current.triggerRadiusNm) {
                if (!state.startedAt) state.startedAt = nowMs;
                state.areaEntered = true;
                state.completedPointIds.add(current.id);
                state.lastPointId = current.id;
                const nextIndex = idx + 1;
                const nextPoint = spec.points[nextIndex] || null;
                state.currentIndex = nextPoint ? nextIndex : spec.points.length;
                events.push({
                    type: 'point_complete',
                    point: current,
                    pointIndex: idx,
                    nextPoint,
                    nextIndex: nextPoint ? nextIndex : null,
                    distNm: roundNumber(distNm, 3)
                });
                const requiredDone = spec.points.every(point => !point.required || state.completedPointIds.has(point.id));
                if (requiredDone) {
                    state.satisfied = true;
                    events.push({ type: 'chain_complete', point: current });
                } else if (nextPoint) {
                    events.push({ type: 'next_point_revealed', point: nextPoint, pointIndex: nextIndex });
                }
            }
        }
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
            nowMs: Number(input.nowMs || Date.now())
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
            bearingDeg
        }
    };

    host.missionPoiChainRuntime = api;
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleInitialOverlayRefresh, { once: true });
        else scheduleInitialOverlayRefresh();
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
