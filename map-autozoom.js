// Standalone follow and autozoom, shared with the tracker-hosted EFB.
const MAP_AUTOZOOM_LOOKAHEAD_KEY = 'ga_map_autozoom_lookahead_min';
const MAP_AUTOZOOM_DEFAULT_LOOKAHEAD_MIN = 8;
const MAP_AUTOZOOM_MIN_LOOKAHEAD_MIN = 2;
const MAP_AUTOZOOM_MAX_LOOKAHEAD_MIN = 25;
const MAP_AUTOZOOM_MIN_ZOOM = 8;
const MAP_AUTOZOOM_MAX_ZOOM = 18;
const MAP_AUTOZOOM_ZOOM_SNAP = 0.01;
const MAP_AUTOZOOM_TARGET_CHANGE_DELTA = 0.08;
const MAP_AUTOZOOM_MIN_STEP = 0.02;
const MAP_AUTOZOOM_MIN_APPLY_DELTA = 0.015;
const MAP_AUTOZOOM_SMOOTH_INTERVAL_MS = 300;
const MAP_AUTOZOOM_SMOOTH_LOW_FPS_INTERVAL_MS = 650;
const MAP_AUTOZOOM_SMOOTH_DURATION_S = 0.42;
const MAP_AUTOZOOM_SMOOTH_LOW_FPS_DURATION_S = 0.75;
const MAP_AUTOZOOM_SMOOTH_MAX_STEP = 0.22;
const MAP_AUTOZOOM_SMOOTH_LOW_FPS_MAX_STEP = 0.16;
const MAP_AUTOZOOM_SMOOTH_STEP_FRACTION = 0.28;
const MAP_AUTOZOOM_SMOOTH_LOW_FPS_STEP_FRACTION = 0.2;
const MAP_AUTOZOOM_TARGET_APPROACH_MIN = 5;
const MAP_AUTOZOOM_POI_APPROACH_ZOOM = 13.4;
const MAP_AUTOZOOM_WAYPOINT_APPROACH_ZOOM = 12.5;
const MAP_AUTOZOOM_TARGET_APPROACH_CENTER_TARGET_WEIGHT = 1 / 3;
const MAP_AUTOZOOM_POI_FOCUS_RELEASE_PROGRESS = 0.5;
const MAP_AUTOZOOM_SPEED_STAGES = [
    { max: 18, zoom: 15, label: 'Boden' },
    { max: 60, zoom: 14, label: 'Langsam/niedrig' },
    { max: 95, zoom: 13, label: 'Abflug/Anflug' },
    { max: 130, zoom: 12, label: 'Route' },
    { max: 170, zoom: 11, label: 'Reise' },
    { max: Infinity, zoom: 10, label: 'Schnell/hoch' }
];
const MAP_AUTOZOOM_ALTITUDE_STAGES = [
    { max: 250, zoom: 15, label: 'Boden' },
    { max: 1500, zoom: 14, label: 'Langsam/niedrig' },
    { max: 3000, zoom: 13, label: 'Abflug/Anflug' },
    { max: 5500, zoom: 12, label: 'Route' },
    { max: 9000, zoom: 11, label: 'Reise' },
    { max: Infinity, zoom: 10, label: 'Schnell/hoch' }
];
let lastMapAutoZoomAppliedAt = 0;
let lastMapAutoZoomTargetZoom = null;
let lastMapAutoZoomSample = null;
let mapAutoFollowProgrammaticMoveUntil = 0;
let autoFollowMapInteractionBound = false;
let mapAutoZoomFractionalZoomConfigured = false;
let mapAutoZoomManualHoldZoom = null;
let mapAutoZoomManualHoldTargetZoom = null;
let mapAutoZoomManualHoldPhase = '';
let mapAutoZoomUserZoomIntentUntil = 0;
let mapAutoZoomPoiFocusLock = null;
let mapAutoZoomSmoothTimer = null;

function _clampMapAutoZoomNumber(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
}

function quantizeMapAutoZoom(zoom) {
    const n = Number(zoom);
    if (!Number.isFinite(n)) return n;
    return Math.round(n / MAP_AUTOZOOM_ZOOM_SNAP) * MAP_AUTOZOOM_ZOOM_SNAP;
}

function clampAutoZoomToRange(zoom, minZoom, maxZoom) {
    let min = Number.isFinite(Number(minZoom)) ? Number(minZoom) : MAP_AUTOZOOM_MIN_ZOOM;
    let max = Number.isFinite(Number(maxZoom)) ? Number(maxZoom) : MAP_AUTOZOOM_MAX_ZOOM;
    if (max < min) max = min;
    return quantizeMapAutoZoom(_clampMapAutoZoomNumber(zoom, min, max));
}

function sanitizeMapAutoZoomVisibilityCap(zoom) {
    const n = Number(zoom);
    if (!Number.isFinite(n)) return null;
    const q = quantizeMapAutoZoom(n);
    if (q < MAP_AUTOZOOM_MIN_ZOOM) return null;
    return Math.min(MAP_AUTOZOOM_MAX_ZOOM, q);
}

function normalizeMapAutoZoomLookaheadMinutes(value) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return MAP_AUTOZOOM_DEFAULT_LOOKAHEAD_MIN;
    return Math.round(_clampMapAutoZoomNumber(n, MAP_AUTOZOOM_MIN_LOOKAHEAD_MIN, MAP_AUTOZOOM_MAX_LOOKAHEAD_MIN));
}

window.getMapAutoZoomLookaheadMinutes = function() {
    return normalizeMapAutoZoomLookaheadMinutes(localStorage.getItem(MAP_AUTOZOOM_LOOKAHEAD_KEY));
};

window.setMapAutoZoomLookaheadMinutes = function(value, options = {}) {
    const lookaheadMin = normalizeMapAutoZoomLookaheadMinutes(value);
    if (options.persist !== false) {
        localStorage.setItem(MAP_AUTOZOOM_LOOKAHEAD_KEY, String(lookaheadMin));
    }
    lastMapAutoZoomAppliedAt = 0;
    lastMapAutoZoomTargetZoom = null;
    if (typeof window.refreshMapAutoZoomUi === 'function') window.refreshMapAutoZoomUi();
    return lookaheadMin;
};

window.getMapAutoZoomStrength = window.getMapAutoZoomLookaheadMinutes;
window.setMapAutoZoomStrength = window.setMapAutoZoomLookaheadMinutes;

function isMapAutoZoomEnabled() {
    if (typeof window.isMapHintEnabled === 'function') return window.isMapHintEnabled('autoZoom');
    return localStorage.getItem('ga_map_hint_autoZoom') === 'true';
}

function getMapAutoZoomAglFt(altFt) {
    const fd = window.lastLiveFlightData || {};
    const rawAgl = Number(fd.aglFt ?? fd.agl ?? fd.heightAboveGroundFt ?? fd.radioAltFt);
    if (Number.isFinite(rawAgl)) return Math.max(0, rawAgl);

    const terrainFt = Number(window.lastLiveTerrainFt);
    const mslFt = Number(altFt);
    if (Number.isFinite(mslFt) && Number.isFinite(terrainFt) && terrainFt > 0) {
        return Math.max(0, mslFt - terrainFt);
    }
    return null;
}

function clampAutoZoomForMap(zoom, options = {}) {
    let minZoom = MAP_AUTOZOOM_MIN_ZOOM;
    let maxZoom = MAP_AUTOZOOM_MAX_ZOOM;
    const respectMapMax = options.respectMapMax === true;
    if (typeof map !== 'undefined' && map) {
        const mapMin = Number(typeof map.getMinZoom === 'function' ? map.getMinZoom() : NaN);
        const mapMax = Number(typeof map.getMaxZoom === 'function' ? map.getMaxZoom() : NaN);
        if (Number.isFinite(mapMin)) minZoom = Math.max(minZoom, mapMin);
        if (respectMapMax && Number.isFinite(mapMax) && mapMax > minZoom) maxZoom = Math.min(maxZoom, mapMax);
    }
    if (minZoom > maxZoom) minZoom = maxZoom;
    return clampAutoZoomToRange(zoom, minZoom, maxZoom);
}

function ensureMapAutoZoomFractionalZoom() {
    if (mapAutoZoomFractionalZoomConfigured) return;
    if (typeof map === 'undefined' || !map || !map.options) return;
    map.options.zoomSnap = Math.min(Number(map.options.zoomSnap) || 1, MAP_AUTOZOOM_ZOOM_SNAP);
    map.options.zoomDelta = Math.min(Number(map.options.zoomDelta) || 1, 0.25);
    const currentMaxZoom = Number(map.options.maxZoom);
    if (!Number.isFinite(currentMaxZoom) || currentMaxZoom < MAP_AUTOZOOM_MAX_ZOOM) {
        map.options.maxZoom = MAP_AUTOZOOM_MAX_ZOOM;
    }
    mapAutoZoomFractionalZoomConfigured = true;
}

function clearMapAutoZoomSmoothTimer() {
    if (!mapAutoZoomSmoothTimer) return;
    try { clearTimeout(mapAutoZoomSmoothTimer); } catch (_) {}
    mapAutoZoomSmoothTimer = null;
}

function getMapAutoZoomSmoothIntervalMs(lowFpsMode) {
    return lowFpsMode ? MAP_AUTOZOOM_SMOOTH_LOW_FPS_INTERVAL_MS : MAP_AUTOZOOM_SMOOTH_INTERVAL_MS;
}

function getMapAutoZoomSmoothDurationS(lowFpsMode) {
    return lowFpsMode ? MAP_AUTOZOOM_SMOOTH_LOW_FPS_DURATION_S : MAP_AUTOZOOM_SMOOTH_DURATION_S;
}

function computeMapAutoZoomSmoothStep(zoomDelta, lowFpsMode) {
    const delta = Math.max(0, Number(zoomDelta) || 0);
    if (delta <= 0) return 0;
    const fraction = lowFpsMode ? MAP_AUTOZOOM_SMOOTH_LOW_FPS_STEP_FRACTION : MAP_AUTOZOOM_SMOOTH_STEP_FRACTION;
    const maxStep = lowFpsMode ? MAP_AUTOZOOM_SMOOTH_LOW_FPS_MAX_STEP : MAP_AUTOZOOM_SMOOTH_MAX_STEP;
    const minStep = Math.min(delta, MAP_AUTOZOOM_MIN_STEP);
    return Math.min(delta, Math.min(maxStep, Math.max(minStep, delta * fraction)));
}

function _mapAutoZoomStageForValue(value, stages) {
    const n = Number(value);
    const safeValue = Number.isFinite(n) ? Math.max(0, n) : 0;
    return stages.find(stage => safeValue < stage.max) || stages[stages.length - 1];
}

function _mapAutoZoomPhaseForZoom(zoom) {
    if (zoom >= 15) return 'Boden';
    if (zoom >= 14) return 'Langsam/niedrig';
    if (zoom >= 13) return 'Abflug/Anflug';
    if (zoom >= 12) return 'Route';
    if (zoom >= 11) return 'Reise';
    return 'Schnell/hoch';
}

function _mapAutoZoomSmoothstep(value) {
    const t = _clampMapAutoZoomNumber(value, 0, 1);
    return t * t * (3 - 2 * t);
}

function _mapAutoZoomLerp(a, b, t) {
    return a + (b - a) * _clampMapAutoZoomNumber(t, 0, 1);
}

function getMapAutoZoomPlanReference() {
    const tas = Number(window.gaProfileDataProvider?.tasKts ?? document.getElementById('tasSlider')?.value);
    const mapAlt = Number(document.getElementById('altMapInput')?.textContent);
    const sliderAlt = Number(document.getElementById('altSlider')?.value);
    const cruiseAlt = Number.isFinite(mapAlt) ? mapAlt : sliderAlt;
    return {
        tasKts: Number.isFinite(tas) ? _clampMapAutoZoomNumber(tas, 80, 300) : 115,
        cruiseAltFt: Number.isFinite(cruiseAlt) ? Math.max(1000, cruiseAlt) : 4500
    };
}

function _mapAutoZoomPointAt(lat, lon, distNm, bearingDeg) {
    if (typeof getDestinationPoint === 'function') {
        try { return getDestinationPoint(lat, lon, distNm, bearingDeg); } catch (_) {}
    }
    const rNm = 3440.065;
    const lat1 = lat * Math.PI / 180;
    const lon1 = lon * Math.PI / 180;
    const brng = bearingDeg * Math.PI / 180;
    const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(distNm / rNm)
        + Math.cos(lat1) * Math.sin(distNm / rNm) * Math.cos(brng)
    );
    const lon2 = lon1 + Math.atan2(
        Math.sin(brng) * Math.sin(distNm / rNm) * Math.cos(lat1),
        Math.cos(distNm / rNm) - Math.sin(lat1) * Math.sin(lat2)
    );
    return { lat: lat2 * 180 / Math.PI, lon: lon2 * 180 / Math.PI };
}

function _mapAutoZoomWaypointTarget(idx, lat, lon, options = {}) {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return null;
    if (typeof calcNav !== 'function') return null;
    const wpIdx = typeof clampLiveWpIndex === 'function' ? clampLiveWpIndex(idx) : Number(idx);
    if (!Number.isFinite(wpIdx)) return null;
    const wp = routeWaypoints[wpIdx];
    const wpLon = wp?.lng ?? wp?.lon;
    if (!wp || !Number.isFinite(Number(wp.lat)) || !Number.isFinite(Number(wpLon))) return null;
    let nav = null;
    try { nav = calcNav(lat, lon, Number(wp.lat), Number(wpLon)); } catch (_) {}
    const distNm = Number(nav?.dist);
    const brng = Number(nav?.brng);
    return {
        lat: Number(wp.lat),
        lon: Number(wpLon),
        distNm: Number.isFinite(distNm) ? distNm : null,
        brng: Number.isFinite(brng) ? brng : null,
        idx: wpIdx,
        name: typeof getWpDisplayName === 'function' ? getWpDisplayName(wpIdx) : (wp.name || `WP ${wpIdx}`),
        isPoi: wp.isPOI === true || String(wp.icao || '').toUpperCase() === 'POI',
        focusLocked: options.focusLocked === true,
        focusLockRawIdx: Number.isFinite(Number(options.rawIdx)) ? Number(options.rawIdx) : null,
        focusLockEtaMin: Number.isFinite(Number(options.etaMin)) ? Number(options.etaMin) : null,
        focusLockProgress: Number.isFinite(Number(options.progress)) ? Number(options.progress) : null
    };
}

function _mapAutoZoomRouteTarget(lat, lon) {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return null;
    const autoWpIdx = typeof clampLiveWpIndex === 'function'
        ? clampLiveWpIndex((Number.isFinite(Number(liveNextLegIndex)) ? liveNextLegIndex : 0) + 1)
        : 1;
    const wpIdx = liveActiveWpIndex == null
        ? autoWpIdx
        : (typeof clampLiveWpIndex === 'function' ? clampLiveWpIndex(liveActiveWpIndex) : liveActiveWpIndex);
    return _mapAutoZoomWaypointTarget(wpIdx, lat, lon);
}

function _mapAutoZoomRouteKeySnapshot() {
    if (typeof routeKeyForLiveNav === 'function') {
        try { return routeKeyForLiveNav(); } catch (_) {}
    }
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints)) return '';
    return routeWaypoints.map((wp, i) => {
        const wpLon = wp?.lng ?? wp?.lon ?? 0;
        return `${i}:${Number(wp?.lat || 0).toFixed(4)},${Number(wpLon || 0).toFixed(4)}`;
    }).join('|');
}

function _mapAutoZoomSegmentProgress(fromPoint, toPoint, point) {
    const fromLat = Number(fromPoint?.lat);
    const fromLon = Number(fromPoint?.lon ?? fromPoint?.lng);
    const toLat = Number(toPoint?.lat);
    const toLon = Number(toPoint?.lon ?? toPoint?.lng);
    const pointLat = Number(point?.lat);
    const pointLon = Number(point?.lon ?? point?.lng);
    if (!Number.isFinite(fromLat) || !Number.isFinite(fromLon)
        || !Number.isFinite(toLat) || !Number.isFinite(toLon)
        || !Number.isFinite(pointLat) || !Number.isFinite(pointLon)) return null;
    const refLat = (fromLat + toLat + pointLat) / 3;
    const cosRef = Math.cos(refLat * Math.PI / 180);
    const ax = fromLon * cosRef * 60;
    const ay = fromLat * 60;
    const bx = toLon * cosRef * 60;
    const by = toLat * 60;
    const px = pointLon * cosRef * 60;
    const py = pointLat * 60;
    const abx = bx - ax;
    const aby = by - ay;
    const denom = abx * abx + aby * aby;
    if (denom <= 0.000001) return null;
    return _clampMapAutoZoomNumber(((px - ax) * abx + (py - ay) * aby) / denom, 0, 1);
}

function _mapAutoZoomRefreshPoiFocusLock(routeTarget, routeKey) {
    if (!routeTarget?.isPoi || !Number.isFinite(Number(routeTarget.idx))) return;
    mapAutoZoomPoiFocusLock = {
        idx: Number(routeTarget.idx),
        lat: Number(routeTarget.lat),
        lon: Number(routeTarget.lon),
        name: routeTarget.name,
        routeKey,
        acquiredAt: Date.now()
    };
}

function _mapAutoZoomResolveFocusTarget(lat, lon, rawRouteTarget, gsKts) {
    if (!rawRouteTarget) {
        mapAutoZoomPoiFocusLock = null;
        return null;
    }
    const routeKey = _mapAutoZoomRouteKeySnapshot();
    if (mapAutoZoomPoiFocusLock?.routeKey && routeKey && mapAutoZoomPoiFocusLock.routeKey !== routeKey) {
        mapAutoZoomPoiFocusLock = null;
    }
    if (rawRouteTarget.isPoi) {
        _mapAutoZoomRefreshPoiFocusLock(rawRouteTarget, routeKey);
        return rawRouteTarget;
    }
    if (typeof liveActiveWpIndex !== 'undefined' && liveActiveWpIndex != null) {
        mapAutoZoomPoiFocusLock = null;
        return rawRouteTarget;
    }
    const lock = mapAutoZoomPoiFocusLock;
    if (!lock || !Number.isFinite(Number(lock.idx))) return rawRouteTarget;

    const rawIdx = Number(rawRouteTarget.idx);
    if (!Number.isFinite(rawIdx) || rawIdx <= Number(lock.idx)) {
        mapAutoZoomPoiFocusLock = null;
        return rawRouteTarget;
    }

    const aircraftPoint = { lat: Number(lat), lon: Number(lon) };
    const poiPoint = { lat: Number(lock.lat), lon: Number(lock.lon) };
    const progress = _mapAutoZoomSegmentProgress(poiPoint, rawRouteTarget, aircraftPoint);
    const poiTarget = _mapAutoZoomWaypointTarget(lock.idx, lat, lon, {
        focusLocked: true,
        rawIdx,
        progress
    }) || {
        ...poiPoint,
        idx: lock.idx,
        name: lock.name || `WP ${lock.idx}`,
        isPoi: true,
        focusLocked: true,
        focusLockRawIdx: rawIdx,
        focusLockProgress: progress
    };
    const distNm = Number(poiTarget.distNm);
    const gs = Number(gsKts);
    const etaAwayMin = Number.isFinite(distNm) && Number.isFinite(gs) && gs > 5
        ? (distNm / Math.max(gs, 1)) * 60
        : null;
    poiTarget.focusLockEtaMin = Number.isFinite(etaAwayMin) ? etaAwayMin : null;
    poiTarget.focusLockProgress = Number.isFinite(progress) ? progress : null;

    const releaseByEta = Number.isFinite(etaAwayMin) && etaAwayMin >= MAP_AUTOZOOM_TARGET_APPROACH_MIN;
    const releaseByProgress = Number.isFinite(progress) && progress >= MAP_AUTOZOOM_POI_FOCUS_RELEASE_PROGRESS;
    if (releaseByEta || releaseByProgress) {
        mapAutoZoomPoiFocusLock = null;
        return {
            ...rawRouteTarget,
            focusLockReleased: releaseByEta ? 'eta' : 'progress',
            focusLockReleasedEtaMin: Number.isFinite(etaAwayMin) ? etaAwayMin : null,
            focusLockReleasedProgress: Number.isFinite(progress) ? progress : null
        };
    }
    return poiTarget;
}

function _mapAutoZoomRouteStart(lat, lon) {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 1) return null;
    if (typeof calcNav !== 'function') return null;
    const wp = routeWaypoints[0];
    const wpLon = wp?.lng ?? wp?.lon;
    if (!wp || !Number.isFinite(Number(wp.lat)) || !Number.isFinite(Number(wpLon))) return null;
    let nav = null;
    try { nav = calcNav(lat, lon, Number(wp.lat), Number(wpLon)); } catch (_) {}
    const distNm = Number(nav?.dist);
    return {
        lat: Number(wp.lat),
        lon: Number(wpLon),
        distNm: Number.isFinite(distNm) ? distNm : null,
        name: typeof getWpDisplayName === 'function' ? getWpDisplayName(0) : (wp.name || 'Start')
    };
}

function _mapAutoZoomZoomForRadius(lat, lon, radiusNm, paddingPx = 90) {
    if (typeof L === 'undefined' || typeof map === 'undefined' || !map || typeof map.getBoundsZoom !== 'function') {
        const safeRadius = Math.max(0.15, Number(radiusNm) || 1);
        return clampAutoZoomForMap(15 - Math.log2(safeRadius));
    }
    const radius = Math.max(0.12, Number(radiusNm) || 0.5);
    const points = [
        [lat, lon],
        _mapAutoZoomPointAt(lat, lon, radius, 0),
        _mapAutoZoomPointAt(lat, lon, radius, 90),
        _mapAutoZoomPointAt(lat, lon, radius, 180),
        _mapAutoZoomPointAt(lat, lon, radius, 270)
    ].map(p => Array.isArray(p) ? p : [p.lat, p.lon]);
    try {
        const bounds = L.latLngBounds(points);
        const padding = typeof L.point === 'function' ? L.point(paddingPx, paddingPx) : [paddingPx, paddingPx];
        return quantizeMapAutoZoom(map.getBoundsZoom(bounds, false, padding));
    } catch (_) {
        const safeRadius = Math.max(0.15, Number(radiusNm) || 1);
        return clampAutoZoomForMap(15 - Math.log2(safeRadius));
    }
}

function _mapAutoZoomZoomForPoints(points, paddingPx = 110) {
    if (typeof L === 'undefined' || typeof map === 'undefined' || !map || typeof map.getBoundsZoom !== 'function') return null;
    const validPoints = (Array.isArray(points) ? points : [])
        .map(p => Array.isArray(p) ? p : [p?.lat, p?.lon])
        .filter(p => Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
        .map(p => [Number(p[0]), Number(p[1])]);
    if (validPoints.length < 2) return null;
    try {
        const bounds = L.latLngBounds(validPoints);
        const padding = typeof L.point === 'function' ? L.point(paddingPx, paddingPx) : [paddingPx, paddingPx];
        return quantizeMapAutoZoom(map.getBoundsZoom(bounds, false, padding));
    } catch (_) {
        return null;
    }
}

function _mapAutoZoomZoomForPointsAroundCenter(points, center, paddingPx = 110) {
    const centerLat = Number(center?.lat ?? (Array.isArray(center) ? center[0] : NaN));
    const centerLon = Number(center?.lon ?? center?.lng ?? (Array.isArray(center) ? center[1] : NaN));
    if (!Number.isFinite(centerLat) || !Number.isFinite(centerLon)) return _mapAutoZoomZoomForPoints(points, paddingPx);
    const validPoints = (Array.isArray(points) ? points : [])
        .map(p => Array.isArray(p) ? p : [p?.lat, p?.lon])
        .filter(p => Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
        .map(p => [Number(p[0]), Number(p[1])]);
    if (validPoints.length < 2) return null;
    const centeredPoints = [[centerLat, centerLon]];
    validPoints.forEach(p => {
        centeredPoints.push(p);
        centeredPoints.push([centerLat * 2 - p[0], centerLon * 2 - p[1]]);
    });
    return _mapAutoZoomZoomForPoints(centeredPoints, paddingPx);
}

function _mapAutoZoomWeightedCenterBetweenPoints(fromPoint, toPoint, toWeight) {
    const fromLat = Number(fromPoint?.lat ?? (Array.isArray(fromPoint) ? fromPoint[0] : NaN));
    const fromLon = Number(fromPoint?.lon ?? fromPoint?.lng ?? (Array.isArray(fromPoint) ? fromPoint[1] : NaN));
    const toLat = Number(toPoint?.lat ?? (Array.isArray(toPoint) ? toPoint[0] : NaN));
    const toLon = Number(toPoint?.lon ?? toPoint?.lng ?? (Array.isArray(toPoint) ? toPoint[1] : NaN));
    if (!Number.isFinite(fromLat) || !Number.isFinite(fromLon) || !Number.isFinite(toLat) || !Number.isFinite(toLon)) return null;
    const t = _clampMapAutoZoomNumber(toWeight, 0, 1);
    return {
        lat: fromLat + (toLat - fromLat) * t,
        lon: fromLon + (toLon - fromLon) * t
    };
}

function computeMapAutoZoomTargetZoom(lat, lon, gsKts, altFt, hdgDeg = null) {
    const gs = _clampMapAutoZoomNumber(gsKts, 0, 240);
    const fd = window.lastLiveFlightData || {};
    const onGround = fd.onGround === true || fd.simOnGround === true || Number(fd.simOnGround) === 1;
    const aglFt = getMapAutoZoomAglFt(altFt);
    const mslFt = Number(altFt);
    const altitudeRefFt = Number.isFinite(aglFt)
        ? aglFt
        : (Number.isFinite(mslFt) ? Math.max(0, mslFt) : 0);
    const hasAglReference = Number.isFinite(aglFt);
    const speedStage = _mapAutoZoomStageForValue(gs, MAP_AUTOZOOM_SPEED_STAGES);
    const altitudeStage = _mapAutoZoomStageForValue(altitudeRefFt, MAP_AUTOZOOM_ALTITUDE_STAGES);
    const grounded = onGround || gs < 8 || (hasAglReference && gs < 18 && altitudeRefFt < 250) || (!hasAglReference && gs < 18);
    const planRef = getMapAutoZoomPlanReference();
    const lookaheadMin = window.getMapAutoZoomLookaheadMinutes();
    const plannedLookaheadNm = Math.max(2, planRef.tasKts * (lookaheadMin / 60));
    const cruiseSpeedT = _mapAutoZoomSmoothstep(gs / Math.max(60, planRef.tasKts));
    const cruiseAltT = _mapAutoZoomSmoothstep(altitudeRefFt / Math.max(1000, planRef.cruiseAltFt));
    const cruiseProgress = _clampMapAutoZoomNumber(cruiseSpeedT * 0.58 + cruiseAltT * 0.42, 0, 1);
    const cruiseLookaheadCapNm = _mapAutoZoomLerp(Math.max(2.5, plannedLookaheadNm * 0.55), plannedLookaheadNm, cruiseProgress);
    const rawRouteTarget = Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) ? _mapAutoZoomRouteTarget(Number(lat), Number(lon)) : null;
    const routeTarget = Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))
        ? _mapAutoZoomResolveFocusTarget(Number(lat), Number(lon), rawRouteTarget, gs)
        : null;
    const routeStart = Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) ? _mapAutoZoomRouteStart(Number(lat), Number(lon)) : null;
    const routeDistNm = Number(routeTarget?.distNm);
    const startDistNm = Number(routeStart?.distNm);
    const hdg = Number.isFinite(Number(hdgDeg)) ? Number(hdgDeg)
        : (Number.isFinite(Number(routeTarget?.brng)) ? Number(routeTarget.brng) : null);
    const lookaheadNm = _clampMapAutoZoomNumber(gs * (lookaheadMin / 60), 0.35, Math.max(0.35, cruiseLookaheadCapNm));
    const routeEtaMin = Number.isFinite(routeDistNm) && gs > 5
        ? (routeDistNm / Math.max(gs, 1)) * 60
        : null;
    const targetApproachLeadNm = Math.max(0.8, gs * (MAP_AUTOZOOM_TARGET_APPROACH_MIN / 60));
    const targetApproachActive = Number.isFinite(routeEtaMin)
        ? routeEtaMin <= MAP_AUTOZOOM_TARGET_APPROACH_MIN
        : (Number.isFinite(routeDistNm) && routeDistNm <= targetApproachLeadNm);
    const departureT = Number.isFinite(startDistNm) ? _mapAutoZoomSmoothstep((startDistNm - 2) / 14) : cruiseProgress;
    const departureLookaheadNm = _mapAutoZoomLerp(3.8, Math.max(lookaheadNm, cruiseLookaheadCapNm), departureT);
    const routeLastIdx = (typeof routeWaypoints !== 'undefined' && Array.isArray(routeWaypoints) && routeWaypoints.length > 0)
        ? routeWaypoints.length - 1
        : null;
    const routeTargetIsFinal = routeLastIdx !== null
        && Number.isFinite(Number(routeTarget?.idx))
        && Number(routeTarget.idx) === routeLastIdx;
    const nearDeparture = !Number.isFinite(startDistNm) || startDistNm <= 4.5;
    const nearArrival = routeTargetIsFinal && Number.isFinite(routeDistNm) && routeDistNm <= 6.5;
    const nearPatternAirport = nearDeparture || nearArrival;
    const patternCandidate = nearArrival || ((altitudeRefFt < 1800 || gs < 75) && nearPatternAirport);

    let phase = 'Strecke';
    let requiredRadiusNm = Math.max(2, lookaheadNm);
    let minModeZoom = MAP_AUTOZOOM_MIN_ZOOM;
    let maxModeZoom = 14.25;
    let targetVisibilityMaxZoom = null;
    const routeTargetPoint = routeTarget ? { lat: routeTarget.lat, lon: routeTarget.lon } : null;
    const aircraftPoint = { lat: Number(lat), lon: Number(lon) };
    const targetApproachViewCenter = targetApproachActive && routeTargetPoint
        ? _mapAutoZoomWeightedCenterBetweenPoints(
            aircraftPoint,
            routeTargetPoint,
            MAP_AUTOZOOM_TARGET_APPROACH_CENTER_TARGET_WEIGHT
        )
        : null;

    if (grounded) {
        phase = 'Taxi';
        requiredRadiusNm = 0.28;
        minModeZoom = 17;
        maxModeZoom = MAP_AUTOZOOM_MAX_ZOOM;
    } else if (routeTarget?.isPoi && targetApproachActive) {
        phase = 'POI';
        requiredRadiusNm = Math.max(1.1, Math.min(8, routeDistNm + 0.9));
        minModeZoom = MAP_AUTOZOOM_POI_APPROACH_ZOOM;
        maxModeZoom = MAP_AUTOZOOM_POI_APPROACH_ZOOM;
        targetVisibilityMaxZoom = _mapAutoZoomZoomForPointsAroundCenter(
            [[lat, lon], [routeTarget.lat, routeTarget.lon]],
            targetApproachViewCenter || aircraftPoint,
            120
        );
    } else if (patternCandidate) {
        phase = 'Platzrunde';
        const lowAltT = _mapAutoZoomSmoothstep(altitudeRefFt / 1800);
        requiredRadiusNm = _mapAutoZoomLerp(1.4, 4.8, lowAltT);
        if (Number.isFinite(routeDistNm) && routeDistNm <= 6.5) requiredRadiusNm = Math.max(requiredRadiusNm, routeDistNm + 0.6);
        minModeZoom = 12.4;
        maxModeZoom = 12.4;
    } else if (altitudeRefFt < 2200 || gs < 85) {
        phase = 'Abflug';
        const lowAltT = _mapAutoZoomSmoothstep(altitudeRefFt / 2200);
        const localRadiusNm = _mapAutoZoomLerp(3.8, 6.2, lowAltT);
        requiredRadiusNm = Math.max(localRadiusNm, departureLookaheadNm);
        if (Number.isFinite(routeDistNm) && routeDistNm <= Math.max(8, lookaheadNm * 1.05)) {
            requiredRadiusNm = Math.max(requiredRadiusNm, routeDistNm + 1.0);
            targetVisibilityMaxZoom = _mapAutoZoomZoomForPointsAroundCenter(
                [[lat, lon], [routeTarget.lat, routeTarget.lon]],
                aircraftPoint,
                115
            );
        }
        requiredRadiusNm = _clampMapAutoZoomNumber(requiredRadiusNm, 3.8, 45);
        minModeZoom = 10.75;
        maxModeZoom = _mapAutoZoomLerp(15.5, 13.25, departureT);
    } else if (Number.isFinite(routeDistNm) && targetApproachActive) {
        phase = routeTarget?.isPoi ? 'POI' : 'Wegpunkt';
        requiredRadiusNm = Math.max(1.1, Math.min(8, routeDistNm + 0.9));
        const approachZoom = routeTarget?.isPoi
            ? MAP_AUTOZOOM_POI_APPROACH_ZOOM
            : MAP_AUTOZOOM_WAYPOINT_APPROACH_ZOOM;
        minModeZoom = approachZoom;
        maxModeZoom = approachZoom;
        targetVisibilityMaxZoom = _mapAutoZoomZoomForPointsAroundCenter(
            [[lat, lon], [routeTarget.lat, routeTarget.lon]],
            targetApproachViewCenter || aircraftPoint,
            115
        );
    } else {
        if (Number.isFinite(routeDistNm) && routeDistNm <= Math.max(8, lookaheadNm * 1.15)) {
            requiredRadiusNm = Math.max(requiredRadiusNm, routeDistNm + 1.2);
            targetVisibilityMaxZoom = _mapAutoZoomZoomForPointsAroundCenter(
                [[lat, lon], [routeTarget.lat, routeTarget.lon]],
                aircraftPoint,
                110
            );
        }
        requiredRadiusNm = Math.max(requiredRadiusNm, departureLookaheadNm);
        requiredRadiusNm = _clampMapAutoZoomNumber(requiredRadiusNm, 2.2, 85);
    }

    const targetViewCenter = targetApproachViewCenter;
    const radiusZoom = _mapAutoZoomZoomForRadius(Number(lat), Number(lon), requiredRadiusNm, phase === 'Taxi' ? 70 : 95);
    const usableVisibilityCapZoom = sanitizeMapAutoZoomVisibilityCap(targetVisibilityMaxZoom);
    const hasVisibilityCapZoom = usableVisibilityCapZoom !== null && Number.isFinite(usableVisibilityCapZoom);
    const hasRawVisibilityCapZoom = targetVisibilityMaxZoom !== null && Number.isFinite(targetVisibilityMaxZoom);
    const visibleMaxZoom = hasVisibilityCapZoom
        ? Math.min(maxModeZoom, usableVisibilityCapZoom)
        : maxModeZoom;
    const visibleMinZoom = Math.min(minModeZoom, visibleMaxZoom);
    const clampedTargetZoom = clampAutoZoomToRange(radiusZoom, visibleMinZoom, visibleMaxZoom);

    return {
        targetZoom: clampedTargetZoom,
        baseZoom: clampedTargetZoom,
        phase,
        targetPhase: _mapAutoZoomPhaseForZoom(clampedTargetZoom),
        speedStage: speedStage.label,
        altitudeStage: altitudeStage.label,
        onGround: grounded,
        gs,
        hdg: Number.isFinite(hdg) ? Math.round(hdg) : null,
        aglFt: Number.isFinite(aglFt) ? Math.round(aglFt) : null,
        altitudeRefFt: Math.round(altitudeRefFt),
        planTasKts: Math.round(planRef.tasKts),
        planCruiseAltFt: Math.round(planRef.cruiseAltFt),
        lookaheadMin,
        lookaheadNm: Math.round(lookaheadNm * 10) / 10,
        targetApproachMin: MAP_AUTOZOOM_TARGET_APPROACH_MIN,
        targetApproachLeadNm: Math.round(targetApproachLeadNm * 10) / 10,
        targetApproachActive,
        routeTargetIsFinal,
        nearDeparture,
        nearArrival,
        nearPatternAirport,
        poiFocusLocked: routeTarget?.focusLocked === true,
        poiFocusReleaseProgress: MAP_AUTOZOOM_POI_FOCUS_RELEASE_PROGRESS,
        plannedLookaheadNm: Math.round(plannedLookaheadNm * 10) / 10,
        cruiseProgress: Math.round(cruiseProgress * 100) / 100,
        departureProgress: Math.round(departureT * 100) / 100,
        targetVisibilityMaxZoom: hasRawVisibilityCapZoom ? targetVisibilityMaxZoom : null,
        usableVisibilityCapZoom: hasVisibilityCapZoom ? usableVisibilityCapZoom : null,
        radiusZoom: Number.isFinite(Number(radiusZoom)) ? Math.round(Number(radiusZoom) * 10) / 10 : null,
        modeMinZoom: Math.round(visibleMinZoom * 10) / 10,
        modeMaxZoom: Math.round(visibleMaxZoom * 10) / 10,
        viewCenter: targetViewCenter ? {
            lat: Number(targetViewCenter.lat),
            lon: Number(targetViewCenter.lon),
            reason: 'target-approach'
        } : null,
        requiredRadiusNm: Math.round(requiredRadiusNm * 10) / 10,
        routeTarget: routeTarget ? {
            idx: routeTarget.idx,
            name: routeTarget.name,
            distNm: Number.isFinite(routeDistNm) ? Math.round(routeDistNm * 10) / 10 : null,
            etaMin: Number.isFinite(routeEtaMin) ? Math.round(routeEtaMin * 10) / 10 : null,
            isPoi: routeTarget.isPoi,
            focusLocked: routeTarget.focusLocked === true,
            focusLockRawIdx: Number.isFinite(Number(routeTarget.focusLockRawIdx)) ? Number(routeTarget.focusLockRawIdx) : null,
            focusLockEtaMin: Number.isFinite(Number(routeTarget.focusLockEtaMin)) ? Math.round(Number(routeTarget.focusLockEtaMin) * 10) / 10 : null,
            focusLockProgress: Number.isFinite(Number(routeTarget.focusLockProgress)) ? Math.round(Number(routeTarget.focusLockProgress) * 100) / 100 : null,
            focusLockReleased: routeTarget.focusLockReleased || null,
            focusLockReleasedEtaMin: Number.isFinite(Number(routeTarget.focusLockReleasedEtaMin)) ? Math.round(Number(routeTarget.focusLockReleasedEtaMin) * 10) / 10 : null,
            focusLockReleasedProgress: Number.isFinite(Number(routeTarget.focusLockReleasedProgress)) ? Math.round(Number(routeTarget.focusLockReleasedProgress) * 100) / 100 : null
        } : null,
        rawRouteTarget: rawRouteTarget ? {
            idx: rawRouteTarget.idx,
            name: rawRouteTarget.name,
            isPoi: rawRouteTarget.isPoi
        } : null,
        routeStart: routeStart ? {
            name: routeStart.name,
            distNm: Number.isFinite(startDistNm) ? Math.round(startDistNm * 10) / 10 : null
        } : null
    };
}

window.refreshMapAutoZoomUi = function() {
    const lookaheadMin = window.getMapAutoZoomLookaheadMinutes();
    const slider = document.getElementById('mapAutoZoomStrengthSlider');
    if (slider && slider.value !== String(lookaheadMin)) slider.value = String(lookaheadMin);

    const value = document.getElementById('mapAutoZoomStrengthValue');
    if (value) value.textContent = `${lookaheadMin} min`;

    const block = document.getElementById('mapAutoZoomMenuBlock');
    if (block) block.style.opacity = isMapAutoZoomEnabled() ? '1' : '0.62';

    const status = document.getElementById('mapAutoZoomStatus');
    if (status) {
        if (!isMapAutoZoomEnabled()) {
            status.textContent = 'Aus';
        } else if (!isAutoFollow) {
            status.textContent = 'Follow aus';
        } else if (lastMapAutoZoomSample) {
            const currentZoom = Number.isFinite(lastMapAutoZoomSample.currentZoom)
                ? `Z${lastMapAutoZoomSample.currentZoom.toFixed(1)}`
                : 'Z--';
            const targetZoom = Number.isFinite(lastMapAutoZoomSample.targetZoom)
                ? lastMapAutoZoomSample.targetZoom.toFixed(1)
                : '--';
            const phase = lastMapAutoZoomSample.phase || lastMapAutoZoomSample.targetPhase || '';
            const hold = lastMapAutoZoomSample.manualHoldZoom ? ` manuell Z${lastMapAutoZoomSample.manualHoldZoom.toFixed(1)}` : '';
            status.textContent = `${currentZoom} -> Z${targetZoom}${phase ? ` ${phase}` : ''}${hold}`;
        } else {
            status.textContent = 'Bereit';
        }
    }
};

window.resetMapAutoZoomState = function() {
    lastMapAutoZoomAppliedAt = 0;
    lastMapAutoZoomTargetZoom = null;
    lastMapAutoZoomSample = null;
    mapAutoZoomManualHoldZoom = null;
    mapAutoZoomManualHoldTargetZoom = null;
    mapAutoZoomManualHoldPhase = '';
    mapAutoZoomUserZoomIntentUntil = 0;
    mapAutoZoomPoiFocusLock = null;
    clearMapAutoZoomSmoothTimer();
};

function markAutoFollowProgrammaticMapMove(now = Date.now(), durationMs = 700) {
    mapAutoFollowProgrammaticMoveUntil = Math.max(mapAutoFollowProgrammaticMoveUntil, now + durationMs);
}

function isAutoFollowProgrammaticMapMove(now = Date.now()) {
    return now < mapAutoFollowProgrammaticMoveUntil;
}

function markMapAutoZoomUserZoomIntent(now = Date.now(), durationMs = 1800) {
    if (!isAutoFollow || !isMapAutoZoomEnabled()) return;
    mapAutoZoomUserZoomIntentUntil = Math.max(mapAutoZoomUserZoomIntentUntil, now + durationMs);
}

function hasMapAutoZoomUserZoomIntent(now = Date.now()) {
    return now < mapAutoZoomUserZoomIntentUntil;
}

function rememberMapAutoZoomManualZoom(now = Date.now(), options = {}) {
    const userIntent = options.userIntent === true || hasMapAutoZoomUserZoomIntent(now);
    if (!isAutoFollow || (!userIntent && isAutoFollowProgrammaticMapMove(now))) return;
    if (!isMapAutoZoomEnabled()) return;
    if (typeof map === 'undefined' || !map || typeof map.getZoom !== 'function') return;
    const zoom = Number(map.getZoom());
    if (!Number.isFinite(zoom)) return;
    mapAutoZoomManualHoldZoom = zoom;
    mapAutoZoomManualHoldTargetZoom = Number.isFinite(Number(lastMapAutoZoomSample?.targetZoom))
        ? Number(lastMapAutoZoomSample.targetZoom)
        : zoom;
    mapAutoZoomManualHoldPhase = String(lastMapAutoZoomSample?.phase || '');
    clearMapAutoZoomSmoothTimer();
    if (typeof window.refreshMapAutoZoomUi === 'function') window.refreshMapAutoZoomUi();
}

function shouldHoldManualMapAutoZoom(sample) {
    if (!sample || !Number.isFinite(Number(mapAutoZoomManualHoldZoom))) return false;
    const targetZoom = Number(sample.targetZoom);
    const holdTargetZoom = Number(mapAutoZoomManualHoldTargetZoom);
    const targetMoved = Number.isFinite(targetZoom)
        && Number.isFinite(holdTargetZoom)
        && Math.abs(targetZoom - holdTargetZoom) >= 0.75;
    const phaseChanged = mapAutoZoomManualHoldPhase
        && sample.phase
        && mapAutoZoomManualHoldPhase !== sample.phase;
    if (targetMoved || phaseChanged) {
        mapAutoZoomManualHoldZoom = null;
        mapAutoZoomManualHoldTargetZoom = null;
        mapAutoZoomManualHoldPhase = '';
        return false;
    }
    sample.manualHoldZoom = Number(mapAutoZoomManualHoldZoom);
    return true;
}

function getMapAutoZoomViewCenter(sample, fallbackLat, fallbackLon) {
    const center = sample?.viewCenter;
    const lat = Number(center?.lat);
    const lon = Number(center?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
    return [fallbackLat, fallbackLon];
}

function shouldUseMapAutoZoomViewCenter(sample, fallbackLat, fallbackLon) {
    const center = getMapAutoZoomViewCenter(sample, fallbackLat, fallbackLon);
    return Math.abs(Number(center[0]) - Number(fallbackLat)) > 0.000001
        || Math.abs(Number(center[1]) - Number(fallbackLon)) > 0.000001;
}

function getAutoFollowLiveSample() {
    const pos = window.lastLiveGpsPos || {};
    const lat = Number(pos.lat);
    const lon = Number(pos.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const fd = window.lastLiveFlightData || {};
    const alt = Number.isFinite(Number(pos.alt)) ? Number(pos.alt)
        : (Number.isFinite(Number(fd.mslFt)) ? Number(fd.mslFt) : 0);
    const gs = Number.isFinite(Number(fd.gsKts ?? fd.gs)) ? Number(fd.gsKts ?? fd.gs)
        : (Number.isFinite(Number(pos.gs)) ? Number(pos.gs) : smoothedGS);
    return {
        lat,
        lon,
        alt,
        gs: Number.isFinite(gs) ? gs : 0,
        hdg: Number.isFinite(Number(pos.hdg ?? fd.hdg ?? fd.headingDeg ?? fd.heading)) ? Number(pos.hdg ?? fd.hdg ?? fd.headingDeg ?? fd.heading) : null,
        now: Date.now(),
        lowFpsMode: isLowFpsModeActive()
    };
}

function scheduleMapAutoZoomSmoothContinuation(lowFpsMode) {
    if (!isAutoFollow || !isMapAutoZoomEnabled()) {
        clearMapAutoZoomSmoothTimer();
        return;
    }
    clearMapAutoZoomSmoothTimer();
    const delayMs = getMapAutoZoomSmoothIntervalMs(lowFpsMode);
    mapAutoZoomSmoothTimer = setTimeout(() => {
        mapAutoZoomSmoothTimer = null;
        if (!isAutoFollow || !isMapAutoZoomEnabled()) return;
        const sample = getAutoFollowLiveSample();
        if (!sample) return;
        maybeApplyMapAutoZoom(sample.lat, sample.lon, sample.alt, sample.gs, sample.hdg, Date.now(), sample.lowFpsMode, {
            continuation: true
        });
    }, delayMs);
}

function maybeApplyMapAutoZoom(lat, lon, altFt, gsKts, hdgDeg, now, lowFpsMode, options = {}) {
    if (!isMapAutoZoomEnabled() || !isAutoFollow) {
        clearMapAutoZoomSmoothTimer();
        return false;
    }
    if (typeof map === 'undefined' || !map || typeof map.getZoom !== 'function') {
        clearMapAutoZoomSmoothTimer();
        return false;
    }
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
        clearMapAutoZoomSmoothTimer();
        return false;
    }

    ensureMapAutoZoomFractionalZoom();
    const currentZoom = Number(map.getZoom());
    if (!Number.isFinite(currentZoom)) {
        clearMapAutoZoomSmoothTimer();
        return false;
    }

    const sinceLastAutoZoom = now - lastMapAutoZoomAppliedAt;
    const force = options.force === true;
    const sample = computeMapAutoZoomTargetZoom(lat, lon, gsKts, altFt, hdgDeg);
    sample.currentZoom = currentZoom;
    sample.t = now;
    lastMapAutoZoomSample = sample;
    const recoveringInvalidZoom = currentZoom < MAP_AUTOZOOM_MIN_ZOOM - 0.25
        && sample.targetZoom >= MAP_AUTOZOOM_MIN_ZOOM;
    if (recoveringInvalidZoom) sample.recoveringInvalidZoom = true;

    if (!force && !recoveringInvalidZoom && shouldHoldManualMapAutoZoom(sample)) {
        clearMapAutoZoomSmoothTimer();
        if (typeof window.refreshMapAutoZoomUi === 'function') window.refreshMapAutoZoomUi();
        return false;
    }

    const targetZoomChanged = lastMapAutoZoomTargetZoom !== null
        && Math.abs(sample.targetZoom - lastMapAutoZoomTargetZoom) >= MAP_AUTOZOOM_TARGET_CHANGE_DELTA;
    const zoomDelta = Math.abs(sample.targetZoom - currentZoom);
    const minZoomDelta = force ? 0 : MAP_AUTOZOOM_MIN_APPLY_DELTA;
    if (!force && !recoveringInvalidZoom && !targetZoomChanged && zoomDelta < minZoomDelta) {
        if (typeof window.refreshMapAutoZoomUi === 'function') window.refreshMapAutoZoomUi();
        return false;
    }

    const minIntervalMs = getMapAutoZoomSmoothIntervalMs(lowFpsMode);
    if (!force && !recoveringInvalidZoom && !targetZoomChanged && sinceLastAutoZoom < minIntervalMs) {
        if (zoomDelta >= MAP_AUTOZOOM_MIN_APPLY_DELTA) scheduleMapAutoZoomSmoothContinuation(lowFpsMode);
        return false;
    }

    try {
        let appliedZoom = sample.targetZoom;
        if (!force && !recoveringInvalidZoom) {
            const direction = sample.targetZoom >= currentZoom ? 1 : -1;
            const step = direction * computeMapAutoZoomSmoothStep(zoomDelta, lowFpsMode);
            appliedZoom = clampAutoZoomForMap(currentZoom + step);
        }
        sample.appliedZoom = appliedZoom;
        const viewCenter = getMapAutoZoomViewCenter(sample, lat, lon);
        sample.appliedCenter = { lat: viewCenter[0], lon: viewCenter[1] };
        const animationDurationS = getMapAutoZoomSmoothDurationS(lowFpsMode);
        const moveGuardMs = force ? 700 : Math.ceil(animationDurationS * 1000) + 350;
        markAutoFollowProgrammaticMapMove(now, moveGuardMs);
        const animatedViewOptions = (force || recoveringInvalidZoom)
            ? { animate: false }
            : { animate: true, duration: animationDurationS, easeLinearity: 0.16 };
        if (typeof map.setView === 'function') {
            map.setView(viewCenter, appliedZoom, animatedViewOptions);
        } else if (typeof map.setZoom === 'function') {
            map.setZoom(appliedZoom, animatedViewOptions);
            if (typeof map.panTo === 'function') map.panTo(viewCenter, animatedViewOptions);
        }
        lastMapAutoZoomAppliedAt = now;
        lastMapAutoZoomTargetZoom = sample.targetZoom;
        const remainingZoomDelta = Math.abs(sample.targetZoom - appliedZoom);
        if (!force && !recoveringInvalidZoom && remainingZoomDelta > MAP_AUTOZOOM_MIN_APPLY_DELTA) {
            scheduleMapAutoZoomSmoothContinuation(lowFpsMode);
        } else {
            clearMapAutoZoomSmoothTimer();
        }
        if (typeof window.refreshMapAutoZoomUi === 'function') window.refreshMapAutoZoomUi();
        return true;
    } catch (err) {
        console.warn('[Map Autozoom] Zoom update failed:', err && err.message ? err.message : err);
        return false;
    }
}

function applyAutoFollowViewNow(options = {}) {
    if (!isAutoFollow || typeof map === 'undefined' || !map) return false;
    const sample = options.sample || getAutoFollowLiveSample();
    if (!sample) return false;
    const now = Number.isFinite(Number(sample.now)) ? Number(sample.now) : Date.now();
    const lowFpsMode = typeof sample.lowFpsMode === 'boolean' ? sample.lowFpsMode : isLowFpsModeActive();
    const autoZoomApplied = maybeApplyMapAutoZoom(sample.lat, sample.lon, sample.alt, sample.gs, sample.hdg, now, lowFpsMode, {
        force: options.forceZoom === true
    });
    if (autoZoomApplied) {
        const followCenter = getMapAutoZoomViewCenter(lastMapAutoZoomSample, sample.lat, sample.lon);
        lastAutoFollowPanAt = now;
        lastAutoFollowPanPos = followCenter;
        return true;
    }
    const useAutoZoomCenter = isMapAutoZoomEnabled() && shouldUseMapAutoZoomViewCenter(lastMapAutoZoomSample, sample.lat, sample.lon);
    const autoZoomViewCenter = useAutoZoomCenter
        ? getMapAutoZoomViewCenter(lastMapAutoZoomSample, sample.lat, sample.lon)
        : [sample.lat, sample.lon];
    if (useAutoZoomCenter && typeof map.panTo === 'function') {
        markAutoFollowProgrammaticMapMove(now, options.animate === true ? 900 : 700);
        map.panTo(autoZoomViewCenter, { animate: options.animate === true && !lowFpsMode });
        lastAutoFollowPanAt = now;
        lastAutoFollowPanPos = autoZoomViewCenter;
        return true;
    }
    if (options.panFallback === false) return false;
    if (typeof map.panTo === 'function') {
        markAutoFollowProgrammaticMapMove(now, options.animate === true ? 900 : 700);
        map.panTo(autoZoomViewCenter, { animate: options.animate === true });
        lastAutoFollowPanAt = now;
        lastAutoFollowPanPos = autoZoomViewCenter;
        return true;
    }
    return false;
}

function handleAutoFollowManualMapDrag() {
    if (!isAutoFollow) return;
    toggleAutoFollow(false);
}

function handleAutoFollowManualMapZoomStart(e) {
    if (e?.originalEvent) markMapAutoZoomUserZoomIntent();
}

function handleAutoFollowManualMapZoom(e) {
    const now = Date.now();
    const userIntent = hasMapAutoZoomUserZoomIntent(now) || !!e?.originalEvent;
    if (!userIntent && isAutoFollowProgrammaticMapMove(now)) return;
    rememberMapAutoZoomManualZoom(now, { userIntent });
    if (userIntent) mapAutoZoomUserZoomIntentUntil = Math.max(mapAutoZoomUserZoomIntentUntil, now + 250);
}

function bindAutoFollowMapDomInteractionHandlers() {
    if (typeof map.getContainer !== 'function') return;
    const container = map.getContainer();
    if (!container || container._gaAutoFollowInteractionBound) return;
    container._gaAutoFollowInteractionBound = true;
    container.addEventListener('wheel', () => markMapAutoZoomUserZoomIntent(), { passive: true, capture: true });
    container.addEventListener('dblclick', () => markMapAutoZoomUserZoomIntent(), { passive: true, capture: true });
    container.addEventListener('touchstart', (evt) => {
        if (evt && evt.touches && evt.touches.length >= 2) markMapAutoZoomUserZoomIntent();
    }, { passive: true, capture: true });
    container.addEventListener('click', (evt) => {
        const target = evt?.target;
        if (target && typeof target.closest === 'function' && target.closest('.leaflet-control-zoom-in, .leaflet-control-zoom-out')) {
            markMapAutoZoomUserZoomIntent();
        }
    }, { passive: true, capture: true });
}

function bindAutoFollowMapInteractionHandlers() {
    if (autoFollowMapInteractionBound || typeof map === 'undefined' || !map || typeof map.on !== 'function') return;
    autoFollowMapInteractionBound = true;
    bindAutoFollowMapDomInteractionHandlers();
    map.on('dragstart', handleAutoFollowManualMapDrag);
    map.on('zoomstart', handleAutoFollowManualMapZoomStart);
    map.on('zoomend', handleAutoFollowManualMapZoom);
}


function isLowFpsModeActive() {
    if (typeof window.isMapHintEnabled === 'function') return window.isMapHintEnabled('lowFps');
    return localStorage.getItem('ga_map_hint_lowFps') === 'true';
}


function toggleAutoFollow(forceState = null) {
    const nextState = (typeof forceState === 'boolean') ? forceState : !isAutoFollow;
    isAutoFollow = nextState;
    if (isAutoFollow) {
        lastAutoFollowPanAt = 0;
        lastAutoFollowPanPos = null;
        if (typeof window.resetMapAutoZoomState === 'function') window.resetMapAutoZoomState();
    }
    const btn = document.getElementById('autoFollowBtn');
    if (btn) {
        btn.style.background = isAutoFollow ? 'var(--blue)' : '#666';
        btn.innerHTML = isAutoFollow ? '🎯' : '📍';
    }
    if (typeof window.gaMapFollowChanged === 'function') window.gaMapFollowChanged(isAutoFollow);
    if (isAutoFollow) applyAutoFollowViewNow({ forceZoom: true });
    if (typeof window.refreshMapAutoZoomUi === 'function') window.refreshMapAutoZoomUi();
}


// Shared telemetry-time pan gates, including the original low-FPS distance gate.
function updateAutoFollowFromTelemetry({lat, lon, alt, gs: autoFollowGs, hdg, now, lowFpsMode}) {
    if (isAutoFollow) {
        const autoFollowViewApplied = applyAutoFollowViewNow({
            sample: { lat, lon, alt, gs: autoFollowGs, hdg, now, lowFpsMode },
            panFallback: false
        });
        if (autoFollowViewApplied) {
            // handled by applyAutoFollowViewNow()
        } else if (!lowFpsMode) {
            markAutoFollowProgrammaticMapMove(now);
            map.panTo([lat, lon]);
            lastAutoFollowPanAt = now;
            lastAutoFollowPanPos = [lat, lon];
        } else {
            const movedM = lastAutoFollowPanPos ? map.distance(lastAutoFollowPanPos, [lat, lon]) : Number.POSITIVE_INFINITY;
            const canPanByTime = (now - lastAutoFollowPanAt) >= 320;
            const canPanByDist = movedM >= 45;
            if (canPanByTime && canPanByDist) {
                markAutoFollowProgrammaticMapMove(now);
                map.panTo([lat, lon], { animate: false });
                lastAutoFollowPanAt = now;
                lastAutoFollowPanPos = [lat, lon];
            }
        }
    }
}
