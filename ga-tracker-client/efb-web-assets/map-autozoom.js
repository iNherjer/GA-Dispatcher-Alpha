// Generated from map-autozoom.js by sync-efb-web-assets.js. Do not edit.
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
// Standalone follow and autozoom, shared with the tracker-hosted EFB.
var MAP_AUTOZOOM_LOOKAHEAD_KEY = 'ga_map_autozoom_lookahead_min';
var MAP_AUTOZOOM_DEFAULT_LOOKAHEAD_MIN = 8;
var MAP_AUTOZOOM_MIN_LOOKAHEAD_MIN = 2;
var MAP_AUTOZOOM_MAX_LOOKAHEAD_MIN = 25;
var MAP_AUTOZOOM_MIN_ZOOM = 8;
var MAP_AUTOZOOM_MAX_ZOOM = 18;
var MAP_AUTOZOOM_ZOOM_SNAP = 0.01;
var MAP_AUTOZOOM_TARGET_CHANGE_DELTA = 0.08;
var MAP_AUTOZOOM_MIN_STEP = 0.02;
var MAP_AUTOZOOM_MIN_APPLY_DELTA = 0.015;
var MAP_AUTOZOOM_SMOOTH_INTERVAL_MS = 300;
var MAP_AUTOZOOM_SMOOTH_LOW_FPS_INTERVAL_MS = 650;
var MAP_AUTOZOOM_SMOOTH_DURATION_S = 0.42;
var MAP_AUTOZOOM_SMOOTH_LOW_FPS_DURATION_S = 0.75;
var MAP_AUTOZOOM_SMOOTH_MAX_STEP = 0.22;
var MAP_AUTOZOOM_SMOOTH_LOW_FPS_MAX_STEP = 0.16;
var MAP_AUTOZOOM_SMOOTH_STEP_FRACTION = 0.28;
var MAP_AUTOZOOM_SMOOTH_LOW_FPS_STEP_FRACTION = 0.2;
var MAP_AUTOZOOM_TARGET_APPROACH_MIN = 5;
var MAP_AUTOZOOM_POI_APPROACH_ZOOM = 13.4;
var MAP_AUTOZOOM_WAYPOINT_APPROACH_ZOOM = 12.5;
var MAP_AUTOZOOM_TARGET_APPROACH_CENTER_TARGET_WEIGHT = 1 / 3;
var MAP_AUTOZOOM_POI_FOCUS_RELEASE_PROGRESS = 0.5;
var MAP_AUTOZOOM_SPEED_STAGES = [{
  max: 18,
  zoom: 15,
  label: 'Boden'
}, {
  max: 60,
  zoom: 14,
  label: 'Langsam/niedrig'
}, {
  max: 95,
  zoom: 13,
  label: 'Abflug/Anflug'
}, {
  max: 130,
  zoom: 12,
  label: 'Route'
}, {
  max: 170,
  zoom: 11,
  label: 'Reise'
}, {
  max: Infinity,
  zoom: 10,
  label: 'Schnell/hoch'
}];
var MAP_AUTOZOOM_ALTITUDE_STAGES = [{
  max: 250,
  zoom: 15,
  label: 'Boden'
}, {
  max: 1500,
  zoom: 14,
  label: 'Langsam/niedrig'
}, {
  max: 3000,
  zoom: 13,
  label: 'Abflug/Anflug'
}, {
  max: 5500,
  zoom: 12,
  label: 'Route'
}, {
  max: 9000,
  zoom: 11,
  label: 'Reise'
}, {
  max: Infinity,
  zoom: 10,
  label: 'Schnell/hoch'
}];
var lastMapAutoZoomAppliedAt = 0;
var lastMapAutoZoomTargetZoom = null;
var lastMapAutoZoomSample = null;
var mapAutoFollowProgrammaticMoveUntil = 0;
var autoFollowMapInteractionBound = false;
var mapAutoZoomFractionalZoomConfigured = false;
var mapAutoZoomManualHoldZoom = null;
var mapAutoZoomManualHoldTargetZoom = null;
var mapAutoZoomManualHoldPhase = '';
var mapAutoZoomUserZoomIntentUntil = 0;
var mapAutoZoomPoiFocusLock = null;
var mapAutoZoomSmoothTimer = null;
function _clampMapAutoZoomNumber(value, min, max) {
  var n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
function quantizeMapAutoZoom(zoom) {
  var n = Number(zoom);
  if (!Number.isFinite(n)) return n;
  return Math.round(n / MAP_AUTOZOOM_ZOOM_SNAP) * MAP_AUTOZOOM_ZOOM_SNAP;
}
function clampAutoZoomToRange(zoom, minZoom, maxZoom) {
  var min = Number.isFinite(Number(minZoom)) ? Number(minZoom) : MAP_AUTOZOOM_MIN_ZOOM;
  var max = Number.isFinite(Number(maxZoom)) ? Number(maxZoom) : MAP_AUTOZOOM_MAX_ZOOM;
  if (max < min) max = min;
  return quantizeMapAutoZoom(_clampMapAutoZoomNumber(zoom, min, max));
}
function sanitizeMapAutoZoomVisibilityCap(zoom) {
  var n = Number(zoom);
  if (!Number.isFinite(n)) return null;
  var q = quantizeMapAutoZoom(n);
  if (q < MAP_AUTOZOOM_MIN_ZOOM) return null;
  return Math.min(MAP_AUTOZOOM_MAX_ZOOM, q);
}
function normalizeMapAutoZoomLookaheadMinutes(value) {
  var n = parseInt(value, 10);
  if (!Number.isFinite(n)) return MAP_AUTOZOOM_DEFAULT_LOOKAHEAD_MIN;
  return Math.round(_clampMapAutoZoomNumber(n, MAP_AUTOZOOM_MIN_LOOKAHEAD_MIN, MAP_AUTOZOOM_MAX_LOOKAHEAD_MIN));
}
window.getMapAutoZoomLookaheadMinutes = function () {
  return normalizeMapAutoZoomLookaheadMinutes(localStorage.getItem(MAP_AUTOZOOM_LOOKAHEAD_KEY));
};
window.setMapAutoZoomLookaheadMinutes = function (value) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var lookaheadMin = normalizeMapAutoZoomLookaheadMinutes(value);
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
  var _ref, _ref2, _fd$aglFt;
  var fd = window.lastLiveFlightData || {};
  var rawAgl = Number((_ref = (_ref2 = (_fd$aglFt = fd.aglFt) !== null && _fd$aglFt !== void 0 ? _fd$aglFt : fd.agl) !== null && _ref2 !== void 0 ? _ref2 : fd.heightAboveGroundFt) !== null && _ref !== void 0 ? _ref : fd.radioAltFt);
  if (Number.isFinite(rawAgl)) return Math.max(0, rawAgl);
  var terrainFt = Number(window.lastLiveTerrainFt);
  var mslFt = Number(altFt);
  if (Number.isFinite(mslFt) && Number.isFinite(terrainFt) && terrainFt > 0) {
    return Math.max(0, mslFt - terrainFt);
  }
  return null;
}
function clampAutoZoomForMap(zoom) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var minZoom = MAP_AUTOZOOM_MIN_ZOOM;
  var maxZoom = MAP_AUTOZOOM_MAX_ZOOM;
  var respectMapMax = options.respectMapMax === true;
  if (typeof map !== 'undefined' && map) {
    var mapMin = Number(typeof map.getMinZoom === 'function' ? map.getMinZoom() : NaN);
    var mapMax = Number(typeof map.getMaxZoom === 'function' ? map.getMaxZoom() : NaN);
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
  var currentMaxZoom = Number(map.options.maxZoom);
  if (!Number.isFinite(currentMaxZoom) || currentMaxZoom < MAP_AUTOZOOM_MAX_ZOOM) {
    map.options.maxZoom = MAP_AUTOZOOM_MAX_ZOOM;
  }
  mapAutoZoomFractionalZoomConfigured = true;
}
function clearMapAutoZoomSmoothTimer() {
  if (!mapAutoZoomSmoothTimer) return;
  try {
    clearTimeout(mapAutoZoomSmoothTimer);
  } catch (_) {}
  mapAutoZoomSmoothTimer = null;
}
function getMapAutoZoomSmoothIntervalMs(lowFpsMode) {
  return lowFpsMode ? MAP_AUTOZOOM_SMOOTH_LOW_FPS_INTERVAL_MS : MAP_AUTOZOOM_SMOOTH_INTERVAL_MS;
}
function getMapAutoZoomSmoothDurationS(lowFpsMode) {
  return lowFpsMode ? MAP_AUTOZOOM_SMOOTH_LOW_FPS_DURATION_S : MAP_AUTOZOOM_SMOOTH_DURATION_S;
}
function computeMapAutoZoomSmoothStep(zoomDelta, lowFpsMode) {
  var delta = Math.max(0, Number(zoomDelta) || 0);
  if (delta <= 0) return 0;
  var fraction = lowFpsMode ? MAP_AUTOZOOM_SMOOTH_LOW_FPS_STEP_FRACTION : MAP_AUTOZOOM_SMOOTH_STEP_FRACTION;
  var maxStep = lowFpsMode ? MAP_AUTOZOOM_SMOOTH_LOW_FPS_MAX_STEP : MAP_AUTOZOOM_SMOOTH_MAX_STEP;
  var minStep = Math.min(delta, MAP_AUTOZOOM_MIN_STEP);
  return Math.min(delta, Math.min(maxStep, Math.max(minStep, delta * fraction)));
}
function _mapAutoZoomStageForValue(value, stages) {
  var n = Number(value);
  var safeValue = Number.isFinite(n) ? Math.max(0, n) : 0;
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
  var t = _clampMapAutoZoomNumber(value, 0, 1);
  return t * t * (3 - 2 * t);
}
function _mapAutoZoomLerp(a, b, t) {
  return a + (b - a) * _clampMapAutoZoomNumber(t, 0, 1);
}
function getMapAutoZoomPlanReference() {
  var _window$gaProfileData, _window$gaProfileData2, _document$getElementB, _document$getElementB2, _document$getElementB3;
  var tas = Number((_window$gaProfileData = (_window$gaProfileData2 = window.gaProfileDataProvider) === null || _window$gaProfileData2 === void 0 ? void 0 : _window$gaProfileData2.tasKts) !== null && _window$gaProfileData !== void 0 ? _window$gaProfileData : (_document$getElementB = document.getElementById('tasSlider')) === null || _document$getElementB === void 0 ? void 0 : _document$getElementB.value);
  var mapAlt = Number((_document$getElementB2 = document.getElementById('altMapInput')) === null || _document$getElementB2 === void 0 ? void 0 : _document$getElementB2.textContent);
  var sliderAlt = Number((_document$getElementB3 = document.getElementById('altSlider')) === null || _document$getElementB3 === void 0 ? void 0 : _document$getElementB3.value);
  var cruiseAlt = Number.isFinite(mapAlt) ? mapAlt : sliderAlt;
  return {
    tasKts: Number.isFinite(tas) ? _clampMapAutoZoomNumber(tas, 80, 300) : 115,
    cruiseAltFt: Number.isFinite(cruiseAlt) ? Math.max(1000, cruiseAlt) : 4500
  };
}
function _mapAutoZoomPointAt(lat, lon, distNm, bearingDeg) {
  if (typeof getDestinationPoint === 'function') {
    try {
      return getDestinationPoint(lat, lon, distNm, bearingDeg);
    } catch (_) {}
  }
  var rNm = 3440.065;
  var lat1 = lat * Math.PI / 180;
  var lon1 = lon * Math.PI / 180;
  var brng = bearingDeg * Math.PI / 180;
  var lat2 = Math.asin(Math.sin(lat1) * Math.cos(distNm / rNm) + Math.cos(lat1) * Math.sin(distNm / rNm) * Math.cos(brng));
  var lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(distNm / rNm) * Math.cos(lat1), Math.cos(distNm / rNm) - Math.sin(lat1) * Math.sin(lat2));
  return {
    lat: lat2 * 180 / Math.PI,
    lon: lon2 * 180 / Math.PI
  };
}
function _mapAutoZoomWaypointTarget(idx, lat, lon) {
  var _wp$lng, _nav, _nav2;
  var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return null;
  if (typeof calcNav !== 'function') return null;
  var wpIdx = typeof clampLiveWpIndex === 'function' ? clampLiveWpIndex(idx) : Number(idx);
  if (!Number.isFinite(wpIdx)) return null;
  var wp = routeWaypoints[wpIdx];
  var wpLon = (_wp$lng = wp === null || wp === void 0 ? void 0 : wp.lng) !== null && _wp$lng !== void 0 ? _wp$lng : wp === null || wp === void 0 ? void 0 : wp.lon;
  if (!wp || !Number.isFinite(Number(wp.lat)) || !Number.isFinite(Number(wpLon))) return null;
  var nav = null;
  try {
    nav = calcNav(lat, lon, Number(wp.lat), Number(wpLon));
  } catch (_) {}
  var distNm = Number((_nav = nav) === null || _nav === void 0 ? void 0 : _nav.dist);
  var brng = Number((_nav2 = nav) === null || _nav2 === void 0 ? void 0 : _nav2.brng);
  return {
    lat: Number(wp.lat),
    lon: Number(wpLon),
    distNm: Number.isFinite(distNm) ? distNm : null,
    brng: Number.isFinite(brng) ? brng : null,
    idx: wpIdx,
    name: typeof getWpDisplayName === 'function' ? getWpDisplayName(wpIdx) : wp.name || `WP ${wpIdx}`,
    isPoi: wp.isPOI === true || String(wp.icao || '').toUpperCase() === 'POI',
    focusLocked: options.focusLocked === true,
    focusLockRawIdx: Number.isFinite(Number(options.rawIdx)) ? Number(options.rawIdx) : null,
    focusLockEtaMin: Number.isFinite(Number(options.etaMin)) ? Number(options.etaMin) : null,
    focusLockProgress: Number.isFinite(Number(options.progress)) ? Number(options.progress) : null
  };
}
function _mapAutoZoomRouteTarget(lat, lon) {
  if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return null;
  var autoWpIdx = typeof clampLiveWpIndex === 'function' ? clampLiveWpIndex((Number.isFinite(Number(liveNextLegIndex)) ? liveNextLegIndex : 0) + 1) : 1;
  var wpIdx = liveActiveWpIndex == null ? autoWpIdx : typeof clampLiveWpIndex === 'function' ? clampLiveWpIndex(liveActiveWpIndex) : liveActiveWpIndex;
  return _mapAutoZoomWaypointTarget(wpIdx, lat, lon);
}
function _mapAutoZoomRouteKeySnapshot() {
  if (typeof routeKeyForLiveNav === 'function') {
    try {
      return routeKeyForLiveNav();
    } catch (_) {}
  }
  if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints)) return '';
  return routeWaypoints.map((wp, i) => {
    var _ref3, _wp$lng2;
    var wpLon = (_ref3 = (_wp$lng2 = wp === null || wp === void 0 ? void 0 : wp.lng) !== null && _wp$lng2 !== void 0 ? _wp$lng2 : wp === null || wp === void 0 ? void 0 : wp.lon) !== null && _ref3 !== void 0 ? _ref3 : 0;
    return `${i}:${Number((wp === null || wp === void 0 ? void 0 : wp.lat) || 0).toFixed(4)},${Number(wpLon || 0).toFixed(4)}`;
  }).join('|');
}
function _mapAutoZoomSegmentProgress(fromPoint, toPoint, point) {
  var _fromPoint$lon, _toPoint$lon, _point$lon;
  var fromLat = Number(fromPoint === null || fromPoint === void 0 ? void 0 : fromPoint.lat);
  var fromLon = Number((_fromPoint$lon = fromPoint === null || fromPoint === void 0 ? void 0 : fromPoint.lon) !== null && _fromPoint$lon !== void 0 ? _fromPoint$lon : fromPoint === null || fromPoint === void 0 ? void 0 : fromPoint.lng);
  var toLat = Number(toPoint === null || toPoint === void 0 ? void 0 : toPoint.lat);
  var toLon = Number((_toPoint$lon = toPoint === null || toPoint === void 0 ? void 0 : toPoint.lon) !== null && _toPoint$lon !== void 0 ? _toPoint$lon : toPoint === null || toPoint === void 0 ? void 0 : toPoint.lng);
  var pointLat = Number(point === null || point === void 0 ? void 0 : point.lat);
  var pointLon = Number((_point$lon = point === null || point === void 0 ? void 0 : point.lon) !== null && _point$lon !== void 0 ? _point$lon : point === null || point === void 0 ? void 0 : point.lng);
  if (!Number.isFinite(fromLat) || !Number.isFinite(fromLon) || !Number.isFinite(toLat) || !Number.isFinite(toLon) || !Number.isFinite(pointLat) || !Number.isFinite(pointLon)) return null;
  var refLat = (fromLat + toLat + pointLat) / 3;
  var cosRef = Math.cos(refLat * Math.PI / 180);
  var ax = fromLon * cosRef * 60;
  var ay = fromLat * 60;
  var bx = toLon * cosRef * 60;
  var by = toLat * 60;
  var px = pointLon * cosRef * 60;
  var py = pointLat * 60;
  var abx = bx - ax;
  var aby = by - ay;
  var denom = abx * abx + aby * aby;
  if (denom <= 0.000001) return null;
  return _clampMapAutoZoomNumber(((px - ax) * abx + (py - ay) * aby) / denom, 0, 1);
}
function _mapAutoZoomRefreshPoiFocusLock(routeTarget, routeKey) {
  if (!(routeTarget !== null && routeTarget !== void 0 && routeTarget.isPoi) || !Number.isFinite(Number(routeTarget.idx))) return;
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
  var _mapAutoZoomPoiFocusL;
  if (!rawRouteTarget) {
    mapAutoZoomPoiFocusLock = null;
    return null;
  }
  var routeKey = _mapAutoZoomRouteKeySnapshot();
  if ((_mapAutoZoomPoiFocusL = mapAutoZoomPoiFocusLock) !== null && _mapAutoZoomPoiFocusL !== void 0 && _mapAutoZoomPoiFocusL.routeKey && routeKey && mapAutoZoomPoiFocusLock.routeKey !== routeKey) {
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
  var lock = mapAutoZoomPoiFocusLock;
  if (!lock || !Number.isFinite(Number(lock.idx))) return rawRouteTarget;
  var rawIdx = Number(rawRouteTarget.idx);
  if (!Number.isFinite(rawIdx) || rawIdx <= Number(lock.idx)) {
    mapAutoZoomPoiFocusLock = null;
    return rawRouteTarget;
  }
  var aircraftPoint = {
    lat: Number(lat),
    lon: Number(lon)
  };
  var poiPoint = {
    lat: Number(lock.lat),
    lon: Number(lock.lon)
  };
  var progress = _mapAutoZoomSegmentProgress(poiPoint, rawRouteTarget, aircraftPoint);
  var poiTarget = _mapAutoZoomWaypointTarget(lock.idx, lat, lon, {
    focusLocked: true,
    rawIdx,
    progress
  }) || _objectSpread(_objectSpread({}, poiPoint), {}, {
    idx: lock.idx,
    name: lock.name || `WP ${lock.idx}`,
    isPoi: true,
    focusLocked: true,
    focusLockRawIdx: rawIdx,
    focusLockProgress: progress
  });
  var distNm = Number(poiTarget.distNm);
  var gs = Number(gsKts);
  var etaAwayMin = Number.isFinite(distNm) && Number.isFinite(gs) && gs > 5 ? distNm / Math.max(gs, 1) * 60 : null;
  poiTarget.focusLockEtaMin = Number.isFinite(etaAwayMin) ? etaAwayMin : null;
  poiTarget.focusLockProgress = Number.isFinite(progress) ? progress : null;
  var releaseByEta = Number.isFinite(etaAwayMin) && etaAwayMin >= MAP_AUTOZOOM_TARGET_APPROACH_MIN;
  var releaseByProgress = Number.isFinite(progress) && progress >= MAP_AUTOZOOM_POI_FOCUS_RELEASE_PROGRESS;
  if (releaseByEta || releaseByProgress) {
    mapAutoZoomPoiFocusLock = null;
    return _objectSpread(_objectSpread({}, rawRouteTarget), {}, {
      focusLockReleased: releaseByEta ? 'eta' : 'progress',
      focusLockReleasedEtaMin: Number.isFinite(etaAwayMin) ? etaAwayMin : null,
      focusLockReleasedProgress: Number.isFinite(progress) ? progress : null
    });
  }
  return poiTarget;
}
function _mapAutoZoomRouteStart(lat, lon) {
  var _wp$lng3, _nav3;
  if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 1) return null;
  if (typeof calcNav !== 'function') return null;
  var wp = routeWaypoints[0];
  var wpLon = (_wp$lng3 = wp === null || wp === void 0 ? void 0 : wp.lng) !== null && _wp$lng3 !== void 0 ? _wp$lng3 : wp === null || wp === void 0 ? void 0 : wp.lon;
  if (!wp || !Number.isFinite(Number(wp.lat)) || !Number.isFinite(Number(wpLon))) return null;
  var nav = null;
  try {
    nav = calcNav(lat, lon, Number(wp.lat), Number(wpLon));
  } catch (_) {}
  var distNm = Number((_nav3 = nav) === null || _nav3 === void 0 ? void 0 : _nav3.dist);
  return {
    lat: Number(wp.lat),
    lon: Number(wpLon),
    distNm: Number.isFinite(distNm) ? distNm : null,
    name: typeof getWpDisplayName === 'function' ? getWpDisplayName(0) : wp.name || 'Start'
  };
}
function _mapAutoZoomZoomForRadius(lat, lon, radiusNm) {
  var paddingPx = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 90;
  if (typeof L === 'undefined' || typeof map === 'undefined' || !map || typeof map.getBoundsZoom !== 'function') {
    var safeRadius = Math.max(0.15, Number(radiusNm) || 1);
    return clampAutoZoomForMap(15 - Math.log2(safeRadius));
  }
  var radius = Math.max(0.12, Number(radiusNm) || 0.5);
  var points = [[lat, lon], _mapAutoZoomPointAt(lat, lon, radius, 0), _mapAutoZoomPointAt(lat, lon, radius, 90), _mapAutoZoomPointAt(lat, lon, radius, 180), _mapAutoZoomPointAt(lat, lon, radius, 270)].map(p => Array.isArray(p) ? p : [p.lat, p.lon]);
  try {
    var bounds = L.latLngBounds(points);
    var padding = typeof L.point === 'function' ? L.point(paddingPx, paddingPx) : [paddingPx, paddingPx];
    return quantizeMapAutoZoom(map.getBoundsZoom(bounds, false, padding));
  } catch (_) {
    var _safeRadius = Math.max(0.15, Number(radiusNm) || 1);
    return clampAutoZoomForMap(15 - Math.log2(_safeRadius));
  }
}
function _mapAutoZoomZoomForPoints(points) {
  var paddingPx = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 110;
  if (typeof L === 'undefined' || typeof map === 'undefined' || !map || typeof map.getBoundsZoom !== 'function') return null;
  var validPoints = (Array.isArray(points) ? points : []).map(p => Array.isArray(p) ? p : [p === null || p === void 0 ? void 0 : p.lat, p === null || p === void 0 ? void 0 : p.lon]).filter(p => Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]))).map(p => [Number(p[0]), Number(p[1])]);
  if (validPoints.length < 2) return null;
  try {
    var bounds = L.latLngBounds(validPoints);
    var padding = typeof L.point === 'function' ? L.point(paddingPx, paddingPx) : [paddingPx, paddingPx];
    return quantizeMapAutoZoom(map.getBoundsZoom(bounds, false, padding));
  } catch (_) {
    return null;
  }
}
function _mapAutoZoomZoomForPointsAroundCenter(points, center) {
  var _center$lat, _ref4, _center$lon;
  var paddingPx = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 110;
  var centerLat = Number((_center$lat = center === null || center === void 0 ? void 0 : center.lat) !== null && _center$lat !== void 0 ? _center$lat : Array.isArray(center) ? center[0] : NaN);
  var centerLon = Number((_ref4 = (_center$lon = center === null || center === void 0 ? void 0 : center.lon) !== null && _center$lon !== void 0 ? _center$lon : center === null || center === void 0 ? void 0 : center.lng) !== null && _ref4 !== void 0 ? _ref4 : Array.isArray(center) ? center[1] : NaN);
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLon)) return _mapAutoZoomZoomForPoints(points, paddingPx);
  var validPoints = (Array.isArray(points) ? points : []).map(p => Array.isArray(p) ? p : [p === null || p === void 0 ? void 0 : p.lat, p === null || p === void 0 ? void 0 : p.lon]).filter(p => Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]))).map(p => [Number(p[0]), Number(p[1])]);
  if (validPoints.length < 2) return null;
  var centeredPoints = [[centerLat, centerLon]];
  validPoints.forEach(p => {
    centeredPoints.push(p);
    centeredPoints.push([centerLat * 2 - p[0], centerLon * 2 - p[1]]);
  });
  return _mapAutoZoomZoomForPoints(centeredPoints, paddingPx);
}
function _mapAutoZoomWeightedCenterBetweenPoints(fromPoint, toPoint, toWeight) {
  var _fromPoint$lat, _ref5, _fromPoint$lon2, _toPoint$lat, _ref6, _toPoint$lon2;
  var fromLat = Number((_fromPoint$lat = fromPoint === null || fromPoint === void 0 ? void 0 : fromPoint.lat) !== null && _fromPoint$lat !== void 0 ? _fromPoint$lat : Array.isArray(fromPoint) ? fromPoint[0] : NaN);
  var fromLon = Number((_ref5 = (_fromPoint$lon2 = fromPoint === null || fromPoint === void 0 ? void 0 : fromPoint.lon) !== null && _fromPoint$lon2 !== void 0 ? _fromPoint$lon2 : fromPoint === null || fromPoint === void 0 ? void 0 : fromPoint.lng) !== null && _ref5 !== void 0 ? _ref5 : Array.isArray(fromPoint) ? fromPoint[1] : NaN);
  var toLat = Number((_toPoint$lat = toPoint === null || toPoint === void 0 ? void 0 : toPoint.lat) !== null && _toPoint$lat !== void 0 ? _toPoint$lat : Array.isArray(toPoint) ? toPoint[0] : NaN);
  var toLon = Number((_ref6 = (_toPoint$lon2 = toPoint === null || toPoint === void 0 ? void 0 : toPoint.lon) !== null && _toPoint$lon2 !== void 0 ? _toPoint$lon2 : toPoint === null || toPoint === void 0 ? void 0 : toPoint.lng) !== null && _ref6 !== void 0 ? _ref6 : Array.isArray(toPoint) ? toPoint[1] : NaN);
  if (!Number.isFinite(fromLat) || !Number.isFinite(fromLon) || !Number.isFinite(toLat) || !Number.isFinite(toLon)) return null;
  var t = _clampMapAutoZoomNumber(toWeight, 0, 1);
  return {
    lat: fromLat + (toLat - fromLat) * t,
    lon: fromLon + (toLon - fromLon) * t
  };
}
function computeMapAutoZoomTargetZoom(lat, lon, gsKts, altFt) {
  var hdgDeg = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : null;
  var gs = _clampMapAutoZoomNumber(gsKts, 0, 240);
  var fd = window.lastLiveFlightData || {};
  var onGround = fd.onGround === true || fd.simOnGround === true || Number(fd.simOnGround) === 1;
  var aglFt = getMapAutoZoomAglFt(altFt);
  var mslFt = Number(altFt);
  var altitudeRefFt = Number.isFinite(aglFt) ? aglFt : Number.isFinite(mslFt) ? Math.max(0, mslFt) : 0;
  var hasAglReference = Number.isFinite(aglFt);
  var speedStage = _mapAutoZoomStageForValue(gs, MAP_AUTOZOOM_SPEED_STAGES);
  var altitudeStage = _mapAutoZoomStageForValue(altitudeRefFt, MAP_AUTOZOOM_ALTITUDE_STAGES);
  var grounded = onGround || gs < 8 || hasAglReference && gs < 18 && altitudeRefFt < 250 || !hasAglReference && gs < 18;
  var planRef = getMapAutoZoomPlanReference();
  var lookaheadMin = window.getMapAutoZoomLookaheadMinutes();
  var plannedLookaheadNm = Math.max(2, planRef.tasKts * (lookaheadMin / 60));
  var cruiseSpeedT = _mapAutoZoomSmoothstep(gs / Math.max(60, planRef.tasKts));
  var cruiseAltT = _mapAutoZoomSmoothstep(altitudeRefFt / Math.max(1000, planRef.cruiseAltFt));
  var cruiseProgress = _clampMapAutoZoomNumber(cruiseSpeedT * 0.58 + cruiseAltT * 0.42, 0, 1);
  var cruiseLookaheadCapNm = _mapAutoZoomLerp(Math.max(2.5, plannedLookaheadNm * 0.55), plannedLookaheadNm, cruiseProgress);
  var rawRouteTarget = Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) ? _mapAutoZoomRouteTarget(Number(lat), Number(lon)) : null;
  var routeTarget = Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) ? _mapAutoZoomResolveFocusTarget(Number(lat), Number(lon), rawRouteTarget, gs) : null;
  var routeStart = Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) ? _mapAutoZoomRouteStart(Number(lat), Number(lon)) : null;
  var routeDistNm = Number(routeTarget === null || routeTarget === void 0 ? void 0 : routeTarget.distNm);
  var startDistNm = Number(routeStart === null || routeStart === void 0 ? void 0 : routeStart.distNm);
  var hdg = Number.isFinite(Number(hdgDeg)) ? Number(hdgDeg) : Number.isFinite(Number(routeTarget === null || routeTarget === void 0 ? void 0 : routeTarget.brng)) ? Number(routeTarget.brng) : null;
  var lookaheadNm = _clampMapAutoZoomNumber(gs * (lookaheadMin / 60), 0.35, Math.max(0.35, cruiseLookaheadCapNm));
  var routeEtaMin = Number.isFinite(routeDistNm) && gs > 5 ? routeDistNm / Math.max(gs, 1) * 60 : null;
  var targetApproachLeadNm = Math.max(0.8, gs * (MAP_AUTOZOOM_TARGET_APPROACH_MIN / 60));
  var targetApproachActive = Number.isFinite(routeEtaMin) ? routeEtaMin <= MAP_AUTOZOOM_TARGET_APPROACH_MIN : Number.isFinite(routeDistNm) && routeDistNm <= targetApproachLeadNm;
  var departureT = Number.isFinite(startDistNm) ? _mapAutoZoomSmoothstep((startDistNm - 2) / 14) : cruiseProgress;
  var departureLookaheadNm = _mapAutoZoomLerp(3.8, Math.max(lookaheadNm, cruiseLookaheadCapNm), departureT);
  var routeLastIdx = typeof routeWaypoints !== 'undefined' && Array.isArray(routeWaypoints) && routeWaypoints.length > 0 ? routeWaypoints.length - 1 : null;
  var routeTargetIsFinal = routeLastIdx !== null && Number.isFinite(Number(routeTarget === null || routeTarget === void 0 ? void 0 : routeTarget.idx)) && Number(routeTarget.idx) === routeLastIdx;
  var nearDeparture = !Number.isFinite(startDistNm) || startDistNm <= 4.5;
  var nearArrival = routeTargetIsFinal && Number.isFinite(routeDistNm) && routeDistNm <= 6.5;
  var nearPatternAirport = nearDeparture || nearArrival;
  var patternCandidate = nearArrival || (altitudeRefFt < 1800 || gs < 75) && nearPatternAirport;
  var phase = 'Strecke';
  var requiredRadiusNm = Math.max(2, lookaheadNm);
  var minModeZoom = MAP_AUTOZOOM_MIN_ZOOM;
  var maxModeZoom = 14.25;
  var targetVisibilityMaxZoom = null;
  var routeTargetPoint = routeTarget ? {
    lat: routeTarget.lat,
    lon: routeTarget.lon
  } : null;
  var aircraftPoint = {
    lat: Number(lat),
    lon: Number(lon)
  };
  var targetApproachViewCenter = targetApproachActive && routeTargetPoint ? _mapAutoZoomWeightedCenterBetweenPoints(aircraftPoint, routeTargetPoint, MAP_AUTOZOOM_TARGET_APPROACH_CENTER_TARGET_WEIGHT) : null;
  if (grounded) {
    phase = 'Taxi';
    requiredRadiusNm = 0.28;
    minModeZoom = 17;
    maxModeZoom = MAP_AUTOZOOM_MAX_ZOOM;
  } else if (routeTarget !== null && routeTarget !== void 0 && routeTarget.isPoi && targetApproachActive) {
    phase = 'POI';
    requiredRadiusNm = Math.max(1.1, Math.min(8, routeDistNm + 0.9));
    minModeZoom = MAP_AUTOZOOM_POI_APPROACH_ZOOM;
    maxModeZoom = MAP_AUTOZOOM_POI_APPROACH_ZOOM;
    targetVisibilityMaxZoom = _mapAutoZoomZoomForPointsAroundCenter([[lat, lon], [routeTarget.lat, routeTarget.lon]], targetApproachViewCenter || aircraftPoint, 120);
  } else if (patternCandidate) {
    phase = 'Platzrunde';
    var lowAltT = _mapAutoZoomSmoothstep(altitudeRefFt / 1800);
    requiredRadiusNm = _mapAutoZoomLerp(1.4, 4.8, lowAltT);
    if (Number.isFinite(routeDistNm) && routeDistNm <= 6.5) requiredRadiusNm = Math.max(requiredRadiusNm, routeDistNm + 0.6);
    minModeZoom = 12.4;
    maxModeZoom = 12.4;
  } else if (altitudeRefFt < 2200 || gs < 85) {
    phase = 'Abflug';
    var _lowAltT = _mapAutoZoomSmoothstep(altitudeRefFt / 2200);
    var localRadiusNm = _mapAutoZoomLerp(3.8, 6.2, _lowAltT);
    requiredRadiusNm = Math.max(localRadiusNm, departureLookaheadNm);
    if (Number.isFinite(routeDistNm) && routeDistNm <= Math.max(8, lookaheadNm * 1.05)) {
      requiredRadiusNm = Math.max(requiredRadiusNm, routeDistNm + 1.0);
      targetVisibilityMaxZoom = _mapAutoZoomZoomForPointsAroundCenter([[lat, lon], [routeTarget.lat, routeTarget.lon]], aircraftPoint, 115);
    }
    requiredRadiusNm = _clampMapAutoZoomNumber(requiredRadiusNm, 3.8, 45);
    minModeZoom = 10.75;
    maxModeZoom = _mapAutoZoomLerp(15.5, 13.25, departureT);
  } else if (Number.isFinite(routeDistNm) && targetApproachActive) {
    phase = routeTarget !== null && routeTarget !== void 0 && routeTarget.isPoi ? 'POI' : 'Wegpunkt';
    requiredRadiusNm = Math.max(1.1, Math.min(8, routeDistNm + 0.9));
    var approachZoom = routeTarget !== null && routeTarget !== void 0 && routeTarget.isPoi ? MAP_AUTOZOOM_POI_APPROACH_ZOOM : MAP_AUTOZOOM_WAYPOINT_APPROACH_ZOOM;
    minModeZoom = approachZoom;
    maxModeZoom = approachZoom;
    targetVisibilityMaxZoom = _mapAutoZoomZoomForPointsAroundCenter([[lat, lon], [routeTarget.lat, routeTarget.lon]], targetApproachViewCenter || aircraftPoint, 115);
  } else {
    if (Number.isFinite(routeDistNm) && routeDistNm <= Math.max(8, lookaheadNm * 1.15)) {
      requiredRadiusNm = Math.max(requiredRadiusNm, routeDistNm + 1.2);
      targetVisibilityMaxZoom = _mapAutoZoomZoomForPointsAroundCenter([[lat, lon], [routeTarget.lat, routeTarget.lon]], aircraftPoint, 110);
    }
    requiredRadiusNm = Math.max(requiredRadiusNm, departureLookaheadNm);
    requiredRadiusNm = _clampMapAutoZoomNumber(requiredRadiusNm, 2.2, 85);
  }
  var targetViewCenter = targetApproachViewCenter;
  var radiusZoom = _mapAutoZoomZoomForRadius(Number(lat), Number(lon), requiredRadiusNm, phase === 'Taxi' ? 70 : 95);
  var usableVisibilityCapZoom = sanitizeMapAutoZoomVisibilityCap(targetVisibilityMaxZoom);
  var hasVisibilityCapZoom = usableVisibilityCapZoom !== null && Number.isFinite(usableVisibilityCapZoom);
  var hasRawVisibilityCapZoom = targetVisibilityMaxZoom !== null && Number.isFinite(targetVisibilityMaxZoom);
  var visibleMaxZoom = hasVisibilityCapZoom ? Math.min(maxModeZoom, usableVisibilityCapZoom) : maxModeZoom;
  var visibleMinZoom = Math.min(minModeZoom, visibleMaxZoom);
  var clampedTargetZoom = clampAutoZoomToRange(radiusZoom, visibleMinZoom, visibleMaxZoom);
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
    poiFocusLocked: (routeTarget === null || routeTarget === void 0 ? void 0 : routeTarget.focusLocked) === true,
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
window.refreshMapAutoZoomUi = function () {
  var lookaheadMin = window.getMapAutoZoomLookaheadMinutes();
  var slider = document.getElementById('mapAutoZoomStrengthSlider');
  if (slider && slider.value !== String(lookaheadMin)) slider.value = String(lookaheadMin);
  var value = document.getElementById('mapAutoZoomStrengthValue');
  if (value) value.textContent = `${lookaheadMin} min`;
  var block = document.getElementById('mapAutoZoomMenuBlock');
  if (block) block.style.opacity = isMapAutoZoomEnabled() ? '1' : '0.62';
  var status = document.getElementById('mapAutoZoomStatus');
  if (status) {
    if (!isMapAutoZoomEnabled()) {
      status.textContent = 'Aus';
    } else if (!isAutoFollow) {
      status.textContent = 'Follow aus';
    } else if (lastMapAutoZoomSample) {
      var currentZoom = Number.isFinite(lastMapAutoZoomSample.currentZoom) ? `Z${lastMapAutoZoomSample.currentZoom.toFixed(1)}` : 'Z--';
      var targetZoom = Number.isFinite(lastMapAutoZoomSample.targetZoom) ? lastMapAutoZoomSample.targetZoom.toFixed(1) : '--';
      var phase = lastMapAutoZoomSample.phase || lastMapAutoZoomSample.targetPhase || '';
      var hold = lastMapAutoZoomSample.manualHoldZoom ? ` manuell Z${lastMapAutoZoomSample.manualHoldZoom.toFixed(1)}` : '';
      status.textContent = `${currentZoom} -> Z${targetZoom}${phase ? ` ${phase}` : ''}${hold}`;
    } else {
      status.textContent = 'Bereit';
    }
  }
};
window.resetMapAutoZoomState = function () {
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
function markAutoFollowProgrammaticMapMove() {
  var now = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Date.now();
  var durationMs = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 700;
  mapAutoFollowProgrammaticMoveUntil = Math.max(mapAutoFollowProgrammaticMoveUntil, now + durationMs);
}
function isAutoFollowProgrammaticMapMove() {
  var now = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Date.now();
  return now < mapAutoFollowProgrammaticMoveUntil;
}
function markMapAutoZoomUserZoomIntent() {
  var now = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Date.now();
  var durationMs = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1800;
  if (!isAutoFollow || !isMapAutoZoomEnabled()) return;
  mapAutoZoomUserZoomIntentUntil = Math.max(mapAutoZoomUserZoomIntentUntil, now + durationMs);
}
function hasMapAutoZoomUserZoomIntent() {
  var now = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Date.now();
  return now < mapAutoZoomUserZoomIntentUntil;
}
function rememberMapAutoZoomManualZoom() {
  var _lastMapAutoZoomSampl, _lastMapAutoZoomSampl2;
  var now = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Date.now();
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var userIntent = options.userIntent === true || hasMapAutoZoomUserZoomIntent(now);
  if (!isAutoFollow || !userIntent && isAutoFollowProgrammaticMapMove(now)) return;
  if (!isMapAutoZoomEnabled()) return;
  if (typeof map === 'undefined' || !map || typeof map.getZoom !== 'function') return;
  var zoom = Number(map.getZoom());
  if (!Number.isFinite(zoom)) return;
  mapAutoZoomManualHoldZoom = zoom;
  mapAutoZoomManualHoldTargetZoom = Number.isFinite(Number((_lastMapAutoZoomSampl = lastMapAutoZoomSample) === null || _lastMapAutoZoomSampl === void 0 ? void 0 : _lastMapAutoZoomSampl.targetZoom)) ? Number(lastMapAutoZoomSample.targetZoom) : zoom;
  mapAutoZoomManualHoldPhase = String(((_lastMapAutoZoomSampl2 = lastMapAutoZoomSample) === null || _lastMapAutoZoomSampl2 === void 0 ? void 0 : _lastMapAutoZoomSampl2.phase) || '');
  clearMapAutoZoomSmoothTimer();
  if (typeof window.refreshMapAutoZoomUi === 'function') window.refreshMapAutoZoomUi();
}
function shouldHoldManualMapAutoZoom(sample) {
  if (!sample || !Number.isFinite(Number(mapAutoZoomManualHoldZoom))) return false;
  var targetZoom = Number(sample.targetZoom);
  var holdTargetZoom = Number(mapAutoZoomManualHoldTargetZoom);
  var targetMoved = Number.isFinite(targetZoom) && Number.isFinite(holdTargetZoom) && Math.abs(targetZoom - holdTargetZoom) >= 0.75;
  var phaseChanged = mapAutoZoomManualHoldPhase && sample.phase && mapAutoZoomManualHoldPhase !== sample.phase;
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
  var center = sample === null || sample === void 0 ? void 0 : sample.viewCenter;
  var lat = Number(center === null || center === void 0 ? void 0 : center.lat);
  var lon = Number(center === null || center === void 0 ? void 0 : center.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
  return [fallbackLat, fallbackLon];
}
function shouldUseMapAutoZoomViewCenter(sample, fallbackLat, fallbackLon) {
  var center = getMapAutoZoomViewCenter(sample, fallbackLat, fallbackLon);
  return Math.abs(Number(center[0]) - Number(fallbackLat)) > 0.000001 || Math.abs(Number(center[1]) - Number(fallbackLon)) > 0.000001;
}
function getAutoFollowLiveSample() {
  var _fd$gsKts, _fd$gsKts2, _ref7, _ref8, _pos$hdg, _ref9, _ref0, _pos$hdg2;
  var pos = window.lastLiveGpsPos || {};
  var lat = Number(pos.lat);
  var lon = Number(pos.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  var fd = window.lastLiveFlightData || {};
  var alt = Number.isFinite(Number(pos.alt)) ? Number(pos.alt) : Number.isFinite(Number(fd.mslFt)) ? Number(fd.mslFt) : 0;
  var gs = Number.isFinite(Number((_fd$gsKts = fd.gsKts) !== null && _fd$gsKts !== void 0 ? _fd$gsKts : fd.gs)) ? Number((_fd$gsKts2 = fd.gsKts) !== null && _fd$gsKts2 !== void 0 ? _fd$gsKts2 : fd.gs) : Number.isFinite(Number(pos.gs)) ? Number(pos.gs) : smoothedGS;
  return {
    lat,
    lon,
    alt,
    gs: Number.isFinite(gs) ? gs : 0,
    hdg: Number.isFinite(Number((_ref7 = (_ref8 = (_pos$hdg = pos.hdg) !== null && _pos$hdg !== void 0 ? _pos$hdg : fd.hdg) !== null && _ref8 !== void 0 ? _ref8 : fd.headingDeg) !== null && _ref7 !== void 0 ? _ref7 : fd.heading)) ? Number((_ref9 = (_ref0 = (_pos$hdg2 = pos.hdg) !== null && _pos$hdg2 !== void 0 ? _pos$hdg2 : fd.hdg) !== null && _ref0 !== void 0 ? _ref0 : fd.headingDeg) !== null && _ref9 !== void 0 ? _ref9 : fd.heading) : null,
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
  var delayMs = getMapAutoZoomSmoothIntervalMs(lowFpsMode);
  mapAutoZoomSmoothTimer = setTimeout(() => {
    mapAutoZoomSmoothTimer = null;
    if (!isAutoFollow || !isMapAutoZoomEnabled()) return;
    var sample = getAutoFollowLiveSample();
    if (!sample) return;
    maybeApplyMapAutoZoom(sample.lat, sample.lon, sample.alt, sample.gs, sample.hdg, Date.now(), sample.lowFpsMode, {
      continuation: true
    });
  }, delayMs);
}
function maybeApplyMapAutoZoom(lat, lon, altFt, gsKts, hdgDeg, now, lowFpsMode) {
  var options = arguments.length > 7 && arguments[7] !== undefined ? arguments[7] : {};
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
  var currentZoom = Number(map.getZoom());
  if (!Number.isFinite(currentZoom)) {
    clearMapAutoZoomSmoothTimer();
    return false;
  }
  var sinceLastAutoZoom = now - lastMapAutoZoomAppliedAt;
  var force = options.force === true;
  var sample = computeMapAutoZoomTargetZoom(lat, lon, gsKts, altFt, hdgDeg);
  sample.currentZoom = currentZoom;
  sample.t = now;
  lastMapAutoZoomSample = sample;
  var recoveringInvalidZoom = currentZoom < MAP_AUTOZOOM_MIN_ZOOM - 0.25 && sample.targetZoom >= MAP_AUTOZOOM_MIN_ZOOM;
  if (recoveringInvalidZoom) sample.recoveringInvalidZoom = true;
  if (!force && !recoveringInvalidZoom && shouldHoldManualMapAutoZoom(sample)) {
    clearMapAutoZoomSmoothTimer();
    if (typeof window.refreshMapAutoZoomUi === 'function') window.refreshMapAutoZoomUi();
    return false;
  }
  var targetZoomChanged = lastMapAutoZoomTargetZoom !== null && Math.abs(sample.targetZoom - lastMapAutoZoomTargetZoom) >= MAP_AUTOZOOM_TARGET_CHANGE_DELTA;
  var zoomDelta = Math.abs(sample.targetZoom - currentZoom);
  var minZoomDelta = force ? 0 : MAP_AUTOZOOM_MIN_APPLY_DELTA;
  if (!force && !recoveringInvalidZoom && !targetZoomChanged && zoomDelta < minZoomDelta) {
    if (typeof window.refreshMapAutoZoomUi === 'function') window.refreshMapAutoZoomUi();
    return false;
  }
  var minIntervalMs = getMapAutoZoomSmoothIntervalMs(lowFpsMode);
  if (!force && !recoveringInvalidZoom && !targetZoomChanged && sinceLastAutoZoom < minIntervalMs) {
    if (zoomDelta >= MAP_AUTOZOOM_MIN_APPLY_DELTA) scheduleMapAutoZoomSmoothContinuation(lowFpsMode);
    return false;
  }
  try {
    var appliedZoom = sample.targetZoom;
    if (!force && !recoveringInvalidZoom) {
      var direction = sample.targetZoom >= currentZoom ? 1 : -1;
      var step = direction * computeMapAutoZoomSmoothStep(zoomDelta, lowFpsMode);
      appliedZoom = clampAutoZoomForMap(currentZoom + step);
    }
    sample.appliedZoom = appliedZoom;
    var viewCenter = getMapAutoZoomViewCenter(sample, lat, lon);
    sample.appliedCenter = {
      lat: viewCenter[0],
      lon: viewCenter[1]
    };
    var animationDurationS = getMapAutoZoomSmoothDurationS(lowFpsMode);
    var moveGuardMs = force ? 700 : Math.ceil(animationDurationS * 1000) + 350;
    markAutoFollowProgrammaticMapMove(now, moveGuardMs);
    var animatedViewOptions = force || recoveringInvalidZoom ? {
      animate: false
    } : {
      animate: true,
      duration: animationDurationS,
      easeLinearity: 0.16
    };
    if (typeof map.setView === 'function') {
      map.setView(viewCenter, appliedZoom, animatedViewOptions);
    } else if (typeof map.setZoom === 'function') {
      map.setZoom(appliedZoom, animatedViewOptions);
      if (typeof map.panTo === 'function') map.panTo(viewCenter, animatedViewOptions);
    }
    lastMapAutoZoomAppliedAt = now;
    lastMapAutoZoomTargetZoom = sample.targetZoom;
    var remainingZoomDelta = Math.abs(sample.targetZoom - appliedZoom);
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
function applyAutoFollowViewNow() {
  var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  if (!isAutoFollow || typeof map === 'undefined' || !map) return false;
  var sample = options.sample || getAutoFollowLiveSample();
  if (!sample) return false;
  var now = Number.isFinite(Number(sample.now)) ? Number(sample.now) : Date.now();
  var lowFpsMode = typeof sample.lowFpsMode === 'boolean' ? sample.lowFpsMode : isLowFpsModeActive();
  var autoZoomApplied = maybeApplyMapAutoZoom(sample.lat, sample.lon, sample.alt, sample.gs, sample.hdg, now, lowFpsMode, {
    force: options.forceZoom === true
  });
  if (autoZoomApplied) {
    var followCenter = getMapAutoZoomViewCenter(lastMapAutoZoomSample, sample.lat, sample.lon);
    lastAutoFollowPanAt = now;
    lastAutoFollowPanPos = followCenter;
    return true;
  }
  var useAutoZoomCenter = isMapAutoZoomEnabled() && shouldUseMapAutoZoomViewCenter(lastMapAutoZoomSample, sample.lat, sample.lon);
  var autoZoomViewCenter = useAutoZoomCenter ? getMapAutoZoomViewCenter(lastMapAutoZoomSample, sample.lat, sample.lon) : [sample.lat, sample.lon];
  if (useAutoZoomCenter && typeof map.panTo === 'function') {
    markAutoFollowProgrammaticMapMove(now, options.animate === true ? 900 : 700);
    map.panTo(autoZoomViewCenter, {
      animate: options.animate === true && !lowFpsMode
    });
    lastAutoFollowPanAt = now;
    lastAutoFollowPanPos = autoZoomViewCenter;
    return true;
  }
  if (options.panFallback === false) return false;
  if (typeof map.panTo === 'function') {
    markAutoFollowProgrammaticMapMove(now, options.animate === true ? 900 : 700);
    map.panTo(autoZoomViewCenter, {
      animate: options.animate === true
    });
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
  if (e !== null && e !== void 0 && e.originalEvent) markMapAutoZoomUserZoomIntent();
}
function handleAutoFollowManualMapZoom(e) {
  var now = Date.now();
  var userIntent = hasMapAutoZoomUserZoomIntent(now) || !!(e !== null && e !== void 0 && e.originalEvent);
  if (!userIntent && isAutoFollowProgrammaticMapMove(now)) return;
  rememberMapAutoZoomManualZoom(now, {
    userIntent
  });
  if (userIntent) mapAutoZoomUserZoomIntentUntil = Math.max(mapAutoZoomUserZoomIntentUntil, now + 250);
}
function bindAutoFollowMapDomInteractionHandlers() {
  if (typeof map.getContainer !== 'function') return;
  var container = map.getContainer();
  if (!container || container._gaAutoFollowInteractionBound) return;
  container._gaAutoFollowInteractionBound = true;
  container.addEventListener('wheel', () => markMapAutoZoomUserZoomIntent(), {
    passive: true,
    capture: true
  });
  container.addEventListener('dblclick', () => markMapAutoZoomUserZoomIntent(), {
    passive: true,
    capture: true
  });
  container.addEventListener('touchstart', evt => {
    if (evt && evt.touches && evt.touches.length >= 2) markMapAutoZoomUserZoomIntent();
  }, {
    passive: true,
    capture: true
  });
  container.addEventListener('click', evt => {
    var target = evt === null || evt === void 0 ? void 0 : evt.target;
    if (target && typeof target.closest === 'function' && target.closest('.leaflet-control-zoom-in, .leaflet-control-zoom-out')) {
      markMapAutoZoomUserZoomIntent();
    }
  }, {
    passive: true,
    capture: true
  });
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
function toggleAutoFollow() {
  var forceState = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
  var nextState = typeof forceState === 'boolean' ? forceState : !isAutoFollow;
  isAutoFollow = nextState;
  if (isAutoFollow) {
    lastAutoFollowPanAt = 0;
    lastAutoFollowPanPos = null;
    if (typeof window.resetMapAutoZoomState === 'function') window.resetMapAutoZoomState();
  }
  var btn = document.getElementById('autoFollowBtn');
  if (btn) {
    btn.style.background = isAutoFollow ? 'var(--blue)' : '#666';
    btn.innerHTML = isAutoFollow ? '🎯' : '📍';
  }
  if (typeof window.gaMapFollowChanged === 'function') window.gaMapFollowChanged(isAutoFollow);
  if (isAutoFollow) applyAutoFollowViewNow({
    forceZoom: true
  });
  if (typeof window.refreshMapAutoZoomUi === 'function') window.refreshMapAutoZoomUi();
}

// Shared telemetry-time pan gates, including the original low-FPS distance gate.
function updateAutoFollowFromTelemetry(_ref1) {
  var lat = _ref1.lat,
    lon = _ref1.lon,
    alt = _ref1.alt,
    autoFollowGs = _ref1.gs,
    hdg = _ref1.hdg,
    now = _ref1.now,
    lowFpsMode = _ref1.lowFpsMode;
  if (isAutoFollow) {
    var autoFollowViewApplied = applyAutoFollowViewNow({
      sample: {
        lat,
        lon,
        alt,
        gs: autoFollowGs,
        hdg,
        now,
        lowFpsMode
      },
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
      var movedM = lastAutoFollowPanPos ? map.distance(lastAutoFollowPanPos, [lat, lon]) : Number.POSITIVE_INFINITY;
      var canPanByTime = now - lastAutoFollowPanAt >= 320;
      var canPanByDist = movedM >= 45;
      if (canPanByTime && canPanByDist) {
        markAutoFollowProgrammaticMapMove(now);
        map.panTo([lat, lon], {
          animate: false
        });
        lastAutoFollowPanAt = now;
        lastAutoFollowPanPos = [lat, lon];
      }
    }
  }
}
