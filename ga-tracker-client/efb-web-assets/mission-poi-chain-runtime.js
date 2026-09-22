// Generated from mission-poi-chain-runtime.js by sync-efb-web-assets.js. Do not edit.
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
(function (root) {
  'use strict';

  var host = root || (typeof globalThis !== 'undefined' ? globalThis : {});
  var NM_TO_M = 1852;
  var EARTH_RADIUS_NM = 3440.065;
  var CORRIDOR_WIDTH_VERSION = 2;
  var LEGACY_CORRIDOR_WIDTH_SCALE = 4;
  var DEFAULTS = {
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
  var activeState = null;
  var activeSpecKey = '';
  var overlayLayer = null;
  var lastOverlayVisualKey = '';
  function canRenderOverlayNow() {
    if (typeof document === 'undefined') return true;
    if (document.hidden) return false;
    var board = document.getElementById('mapTableOverlay');
    return !board || board.classList.contains('active');
  }
  function overlayVisualKey() {
    var _state$corridor, _state$corridor2, _state$corridor3;
    var spec = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var state = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    if (!spec) return '';
    var completedPoints = (state === null || state === void 0 ? void 0 : state.completedPointIds) instanceof Set ? Array.from(state.completedPointIds).map(String).sort().join(',') : '';
    var completedSegments = (state === null || state === void 0 || (_state$corridor = state.corridor) === null || _state$corridor === void 0 ? void 0 : _state$corridor.completedSegmentIds) instanceof Set ? Array.from(state.corridor.completedSegmentIds).map(String).sort().join(',') : '';
    return [spec.key, Math.max(0, Number((state === null || state === void 0 ? void 0 : state.currentIndex) || 0)), state !== null && state !== void 0 && state.areaEntered ? 1 : 0, state !== null && state !== void 0 && state.satisfied ? 1 : 0, completedPoints, Math.max(0, Number((state === null || state === void 0 || (_state$corridor2 = state.corridor) === null || _state$corridor2 === void 0 ? void 0 : _state$corridor2.currentSegmentIndex) || 0)), state !== null && state !== void 0 && (_state$corridor3 = state.corridor) !== null && _state$corridor3 !== void 0 && _state$corridor3.satisfied ? 1 : 0, completedSegments].join('|');
  }
  function activeMissionDataFromHost() {
    try {
      if (typeof currentMissionData !== 'undefined' && currentMissionData && typeof currentMissionData === 'object') return currentMissionData;
    } catch (_) {}
    return host.currentMissionData && typeof host.currentMissionData === 'object' ? host.currentMissionData : null;
  }
  function roundNumber(value) {
    var digits = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 6;
    var n = Number(value);
    if (!Number.isFinite(n)) return null;
    var p = Math.pow(10, digits);
    return Math.round(n * p) / p;
  }
  function clamp(value, min, max) {
    var n = Number(value);
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
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var p1 = toRad(lat1);
    var p2 = toRad(lat2);
    var a = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(p1) * Math.cos(p2) * Math.pow(Math.sin(dLon / 2), 2);
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * EARTH_RADIUS_NM;
  }
  function bearingDeg(lat1, lon1, lat2, lon2) {
    var p1 = toRad(lat1);
    var p2 = toRad(lat2);
    var dLon = toRad(lon2 - lon1);
    var y = Math.sin(dLon) * Math.cos(p2);
    var x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }
  function angleDiffAbs(a, b) {
    return Math.abs(((Number(a) - Number(b)) % 360 + 540) % 360 - 180);
  }
  function localPointNm(lat, lon, originLat, originLon) {
    var avgLat = toRad((Number(lat) + Number(originLat)) / 2);
    return {
      x: (Number(lon) - Number(originLon)) * Math.cos(avgLat) * 60,
      y: (Number(lat) - Number(originLat)) * 60
    };
  }
  function projectPointToSegmentNm(lat, lon) {
    var _start$lon, _end$lon;
    var segment = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    var start = (segment === null || segment === void 0 ? void 0 : segment.start) || {};
    var end = (segment === null || segment === void 0 ? void 0 : segment.end) || {};
    var startLat = Number(start.lat);
    var startLon = Number((_start$lon = start.lon) !== null && _start$lon !== void 0 ? _start$lon : start.lng);
    var endLat = Number(end.lat);
    var endLon = Number((_end$lon = end.lon) !== null && _end$lon !== void 0 ? _end$lon : end.lng);
    if (![startLat, startLon, endLat, endLon, Number(lat), Number(lon)].every(Number.isFinite)) return null;
    var e = localPointNm(endLat, endLon, startLat, startLon);
    var p = localPointNm(lat, lon, startLat, startLon);
    var lenSq = e.x * e.x + e.y * e.y;
    var lenNm = Math.sqrt(lenSq);
    if (!(lenSq > 0)) return null;
    var t = (p.x * e.x + p.y * e.y) / lenSq;
    var cx = t * e.x;
    var cy = t * e.y;
    return {
      t,
      tClamped: clamp(t, 0, 1),
      crossTrackNm: Math.sqrt(Math.pow(p.x - cx, 2) + Math.pow(p.y - cy, 2)),
      alongNm: clamp(t, 0, 1) * lenNm,
      lengthNm: lenNm,
      bearingDeg: bearingDeg(startLat, startLon, endLat, endLon)
    };
  }
  function cleanText(value) {
    var maxLen = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 140;
    var s = String(value || '').replace(/\s+/g, ' ').trim();
    return maxLen > 0 && s.length > maxLen ? s.slice(0, maxLen).trim() : s;
  }
  function normalizePoint() {
    var _raw$lon;
    var raw = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var idx = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    if (!raw || typeof raw !== 'object') return null;
    var lat = Number(raw.lat);
    var lon = Number((_raw$lon = raw.lon) !== null && _raw$lon !== void 0 ? _raw$lon : raw.lng);
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
  function normalizeHiddenOutcome() {
    var raw = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
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
  function normalizeTracePoint() {
    var _raw$lon2;
    var raw = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var lat = Number(raw === null || raw === void 0 ? void 0 : raw.lat);
    var lon = Number((_raw$lon2 = raw === null || raw === void 0 ? void 0 : raw.lon) !== null && _raw$lon2 !== void 0 ? _raw$lon2 : raw === null || raw === void 0 ? void 0 : raw.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      lat: roundNumber(lat),
      lon: roundNumber(lon)
    };
  }
  function dedupeTracePoints() {
    var points = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
    return (Array.isArray(points) ? points : []).map(normalizeTracePoint).filter(Boolean).filter((point, idx, list) => {
      var prev = idx > 0 ? list[idx - 1] : null;
      return !prev || Math.abs(point.lat - prev.lat) > 0.000001 || Math.abs(point.lon - prev.lon) > 0.000001;
    });
  }
  function corridorTraceFromRaw() {
    var _raw$corridor;
    var raw = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var overlay = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var guide = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    var points = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
    var overlayTrace = dedupeTracePoints((overlay === null || overlay === void 0 ? void 0 : overlay.trace) || (raw === null || raw === void 0 || (_raw$corridor = raw.corridor) === null || _raw$corridor === void 0 ? void 0 : _raw$corridor.trace) || (raw === null || raw === void 0 ? void 0 : raw.corridorTrace) || []);
    if (overlayTrace.length >= 2) return overlayTrace;
    var endpoints = dedupeTracePoints([(overlay === null || overlay === void 0 ? void 0 : overlay.start) || (guide === null || guide === void 0 ? void 0 : guide.start), (overlay === null || overlay === void 0 ? void 0 : overlay.end) || (guide === null || guide === void 0 ? void 0 : guide.end)]);
    if (endpoints.length >= 2) return endpoints;
    return dedupeTracePoints(points);
  }
  function normalizeCorridorWidthNm() {
    var overlay = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var declaredWidthNm = Math.max(0.3, Math.min(10, Number((overlay === null || overlay === void 0 ? void 0 : overlay.widthNm) || 0.5)));
    var widthVersion = Number((overlay === null || overlay === void 0 ? void 0 : overlay.widthVersion) || 0);
    var scale = widthVersion >= CORRIDOR_WIDTH_VERSION ? 1 : LEGACY_CORRIDOR_WIDTH_SCALE;
    return Math.max(0.3, Math.min(10, declaredWidthNm * scale));
  }
  function polylineDistanceSamples() {
    var trace = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
    var points = dedupeTracePoints(trace);
    if (points.length < 2) return {
      points,
      distances: [0],
      totalNm: 0
    };
    var distances = [0];
    var totalNm = 0;
    for (var i = 1; i < points.length; i++) {
      totalNm += haversineNm(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
      distances.push(totalNm);
    }
    return {
      points,
      distances,
      totalNm
    };
  }
  function interpolateTraceAtNm(traceInfo, distNm) {
    var points = (traceInfo === null || traceInfo === void 0 ? void 0 : traceInfo.points) || [];
    var distances = (traceInfo === null || traceInfo === void 0 ? void 0 : traceInfo.distances) || [];
    var totalNm = Number((traceInfo === null || traceInfo === void 0 ? void 0 : traceInfo.totalNm) || 0);
    if (points.length < 2 || !(totalNm > 0)) return null;
    var d = clamp(distNm, 0, totalNm);
    for (var i = 1; i < points.length; i++) {
      var prevD = Number(distances[i - 1] || 0);
      var nextD = Number(distances[i] || 0);
      if (d > nextD && i < points.length - 1) continue;
      var span = Math.max(0.000001, nextD - prevD);
      var t = clamp((d - prevD) / span, 0, 1);
      return {
        lat: roundNumber(points[i - 1].lat + (points[i].lat - points[i - 1].lat) * t),
        lon: roundNumber(points[i - 1].lon + (points[i].lon - points[i - 1].lon) * t)
      };
    }
    return points[points.length - 1] || null;
  }
  function projectPointToTraceNm() {
    var _point$lon;
    var point = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var traceInfo = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var lat = Number(point === null || point === void 0 ? void 0 : point.lat);
    var lon = Number((_point$lon = point === null || point === void 0 ? void 0 : point.lon) !== null && _point$lon !== void 0 ? _point$lon : point === null || point === void 0 ? void 0 : point.lng);
    var trace = Array.isArray(traceInfo === null || traceInfo === void 0 ? void 0 : traceInfo.points) ? traceInfo.points : [];
    var distances = Array.isArray(traceInfo === null || traceInfo === void 0 ? void 0 : traceInfo.distances) ? traceInfo.distances : [];
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || trace.length < 2) return null;
    var best = null;
    for (var i = 1; i < trace.length; i++) {
      var start = trace[i - 1];
      var end = trace[i];
      var projection = projectPointToSegmentNm(lat, lon, {
        start,
        end
      });
      if (!projection) continue;
      var prevD = Number(distances[i - 1] || 0);
      var alongNm = prevD + projection.tClamped * Number(projection.lengthNm || 0);
      var candidate = {
        alongNm,
        crossTrackNm: projection.crossTrackNm,
        t: projection.t,
        segmentIndex: i - 1
      };
      if (!best || candidate.crossTrackNm < best.crossTrackNm) best = candidate;
    }
    return best;
  }
  function sliceTraceInfoBetweenNm() {
    var traceInfo = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var startNm = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    var endNm = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
    var points = Array.isArray(traceInfo === null || traceInfo === void 0 ? void 0 : traceInfo.points) ? traceInfo.points : [];
    var distances = Array.isArray(traceInfo === null || traceInfo === void 0 ? void 0 : traceInfo.distances) ? traceInfo.distances : [];
    var totalNm = Number((traceInfo === null || traceInfo === void 0 ? void 0 : traceInfo.totalNm) || 0);
    if (points.length < 2 || !(totalNm > 0)) return traceInfo;
    var a = clamp(Math.min(startNm, endNm), 0, totalNm);
    var b = clamp(Math.max(startNm, endNm), 0, totalNm);
    if (!(b - a > 0.25)) return traceInfo;
    var sliced = [];
    var start = interpolateTraceAtNm(traceInfo, a);
    var end = interpolateTraceAtNm(traceInfo, b);
    if (start) sliced.push(start);
    for (var i = 1; i < points.length - 1; i++) {
      var d = Number(distances[i] || 0);
      if (d > a && d < b) sliced.push(points[i]);
    }
    if (end) sliced.push(end);
    return polylineDistanceSamples(dedupeTracePoints(sliced));
  }
  function trimTraceInfoToChainPoints() {
    var traceInfo = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var points = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    var cfg = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    var traceTotal = Number((traceInfo === null || traceInfo === void 0 ? void 0 : traceInfo.totalNm) || 0);
    var usablePoints = (Array.isArray(points) ? points : []).filter(point => point && point.required !== false);
    if (usablePoints.length < 2 || !(traceTotal > 0.5)) return traceInfo;
    var first = usablePoints[0];
    var last = usablePoints[usablePoints.length - 1];
    var startNm = Number.isFinite(Number(first.orderT)) ? Number(first.orderT) * traceTotal : NaN;
    var endNm = Number.isFinite(Number(last.orderT)) ? Number(last.orderT) * traceTotal : NaN;
    if (!Number.isFinite(startNm)) {
      var projection = projectPointToTraceNm(first, traceInfo);
      if (projection) startNm = projection.alongNm;
    }
    if (!Number.isFinite(endNm)) {
      var _projection = projectPointToTraceNm(last, traceInfo);
      if (_projection) endNm = _projection.alongNm;
    }
    if (!Number.isFinite(startNm) || !Number.isFinite(endNm) || Math.abs(endNm - startNm) < 0.5) return traceInfo;
    var paddingNm = Math.max(0, Math.min(0.3, Number(cfg.trimPaddingNm || DEFAULTS.corridor.trimPaddingNm)));
    return sliceTraceInfoBetweenNm(traceInfo, startNm - paddingNm, endNm + paddingNm);
  }
  function normalizeCorridor() {
    var raw = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var overlay = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var guide = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    var points = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
    var cfg = raw !== null && raw !== void 0 && raw.corridor && typeof raw.corridor === 'object' ? raw.corridor : {};
    if (cfg.enabled === false) return null;
    var trace = corridorTraceFromRaw(raw, overlay, guide, points);
    var traceInfo = polylineDistanceSamples(trace);
    traceInfo = trimTraceInfoToChainPoints(traceInfo, points, cfg);
    if (traceInfo.points.length < 2 || !(traceInfo.totalNm > 0.25)) return null;
    var widthTol = Number((overlay === null || overlay === void 0 ? void 0 : overlay.widthNm) || 0) > 0 ? Number(overlay.widthNm) / 2 : 0;
    var configuredTol = Number(cfg.crossTrackToleranceNm);
    var crossTrackToleranceNm = Math.max(0.06, Math.min(5, Number.isFinite(configuredTol) && configuredTol > 0 ? configuredTol : Math.max(widthTol, DEFAULTS.corridor.crossTrackToleranceNm)));
    var targetLen = Math.max(0.35, Math.min(2.5, Number(cfg.targetSegmentLengthNm || DEFAULTS.corridor.targetSegmentLengthNm)));
    var maxSegments = Math.max(1, Math.min(40, Math.round(Number(cfg.maxSegments || DEFAULTS.corridor.maxSegments))));
    var segmentCount = Math.max(1, Math.min(maxSegments, Math.ceil(traceInfo.totalNm / targetLen)));
    var minSegmentLengthNm = Math.max(0.08, Math.min(0.8, Number(cfg.minSegmentLengthNm || DEFAULTS.corridor.minSegmentLengthNm)));
    var segments = [];
    for (var i = 0; i < segmentCount; i++) {
      var startD = traceInfo.totalNm * i / segmentCount;
      var endD = traceInfo.totalNm * (i + 1) / segmentCount;
      var start = interpolateTraceAtNm(traceInfo, startD);
      var end = interpolateTraceAtNm(traceInfo, endD);
      if (!start || !end) continue;
      var lengthNm = haversineNm(start.lat, start.lon, end.lat, end.lon);
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
  function normalizeSpec() {
    var raw = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    if (!raw || typeof raw !== 'object') return null;
    if (raw.enabled === false) return null;
    var points = (Array.isArray(raw.points) ? raw.points : []).map(normalizePoint).filter(Boolean).slice(0, Math.max(2, Number(raw.maxRuntimePoints || DEFAULTS.maxPoints) || DEFAULTS.maxPoints));
    if (points.length < 2) return null;
    var label = cleanText(raw.label || raw.title || 'POI-Kette', 120);
    var theme = cleanText(raw.theme || 'poi_chain', 80);
    var key = cleanText(raw.key || ['poi-chain', theme, roundNumber(points[0].lat, 5), roundNumber(points[0].lon, 5), points.length, label].join(':'), 220);
    var guide = raw.guide && typeof raw.guide === 'object' ? raw.guide : null;
    var rawOverlay = raw.overlay && typeof raw.overlay === 'object' ? raw.overlay : null;
    var overlay = rawOverlay ? _objectSpread(_objectSpread({}, rawOverlay), {}, {
      widthNm: normalizeCorridorWidthNm(rawOverlay),
      widthVersion: CORRIDOR_WIDTH_VERSION
    }) : null;
    var corridor = normalizeCorridor(raw, overlay, guide, points);
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
        start: guide.start || (overlay === null || overlay === void 0 ? void 0 : overlay.start) || null,
        end: guide.end || (overlay === null || overlay === void 0 ? void 0 : overlay.end) || null,
        guidePointCount: Number(guide.guidePointCount || 0)
      } : null,
      overlay: overlay ? {
        type: cleanText(overlay.type || 'corridor_hint', 80),
        label: cleanText(overlay.label || label, 120),
        start: overlay.start || (guide === null || guide === void 0 ? void 0 : guide.start) || null,
        end: overlay.end || (guide === null || guide === void 0 ? void 0 : guide.end) || null,
        radiusNm: Math.max(0.2, Math.min(8, Number(overlay.radiusNm || 1.5))),
        widthNm: Math.max(0.3, Math.min(10, Number(overlay.widthNm || 0.5))),
        widthVersion: CORRIDOR_WIDTH_VERSION,
        trace: (Array.isArray(overlay.trace) ? overlay.trace : []).map(point => {
          var _point$lon2;
          var lat = Number(point === null || point === void 0 ? void 0 : point.lat);
          var lon = Number((_point$lon2 = point === null || point === void 0 ? void 0 : point.lon) !== null && _point$lon2 !== void 0 ? _point$lon2 : point === null || point === void 0 ? void 0 : point.lng);
          return Number.isFinite(lat) && Number.isFinite(lon) ? {
            lat: roundNumber(lat),
            lon: roundNumber(lon)
          } : null;
        }).filter(Boolean).slice(0, 80)
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
  function getMissionSpec() {
    var missionData = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var passenger = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var md = missionData || activeMissionDataFromHost();
    var contract = (md === null || md === void 0 ? void 0 : md.missionContract) || host.activeMissionContract || null;
    var raw = (md === null || md === void 0 ? void 0 : md.poiChain) || (contract === null || contract === void 0 ? void 0 : contract.poiChain) || (passenger === null || passenger === void 0 ? void 0 : passenger.poiChain) || null;
    return normalizeSpec(raw);
  }
  function setFromArray(value) {
    return new Set(Array.isArray(value) ? value.map(String).filter(Boolean) : []);
  }
  function corridorRequired() {
    var _spec$corridor;
    var spec = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    return !!(spec !== null && spec !== void 0 && (_spec$corridor = spec.corridor) !== null && _spec$corridor !== void 0 && _spec$corridor.required && Array.isArray(spec.corridor.segments) && spec.corridor.segments.length);
  }
  function requiredPointsDone() {
    var spec = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var state = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var completed = (state === null || state === void 0 ? void 0 : state.completedPointIds) instanceof Set ? state.completedPointIds : new Set();
    var points = Array.isArray(spec === null || spec === void 0 ? void 0 : spec.points) ? spec.points : [];
    return points.every(point => (point === null || point === void 0 ? void 0 : point.required) === false || completed.has(String(point.id || '')));
  }
  function corridorDone() {
    var _state$corridor4;
    var spec = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var state = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    if (!corridorRequired(spec)) return true;
    var completed = (state === null || state === void 0 || (_state$corridor4 = state.corridor) === null || _state$corridor4 === void 0 ? void 0 : _state$corridor4.completedSegmentIds) instanceof Set ? state.corridor.completedSegmentIds : new Set();
    return spec.corridor.segments.every(segment => completed.has(String(segment.id || '')));
  }
  function createInitialState(spec) {
    var _spec$corridor2;
    var totalSegments = Array.isArray(spec === null || spec === void 0 || (_spec$corridor2 = spec.corridor) === null || _spec$corridor2 === void 0 ? void 0 : _spec$corridor2.segments) ? spec.corridor.segments.length : 0;
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
  function hydrateState(spec) {
    var progress = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var state = createInitialState(spec);
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
      state.corridor.currentSegmentIndex = Math.max(0, Math.min(Math.max(0, state.corridor.totalSegments), Number(progress.corridor.currentSegmentIndex || progress.corridor.completedCount || 0) || 0));
      while (state.corridor.currentSegmentIndex < state.corridor.totalSegments && state.corridor.completedSegmentIds.has((_spec$corridor3 = spec.corridor) === null || _spec$corridor3 === void 0 || (_spec$corridor3 = _spec$corridor3.segments) === null || _spec$corridor3 === void 0 || (_spec$corridor3 = _spec$corridor3[state.corridor.currentSegmentIndex]) === null || _spec$corridor3 === void 0 ? void 0 : _spec$corridor3.id)) {
        var _spec$corridor3;
        state.corridor.currentSegmentIndex += 1;
      }
      state.corridor.satisfied = !!progress.corridor.satisfied || corridorDone(spec, state);
    }
    state.satisfied = requiredPointsDone(spec, state) && corridorDone(spec, state);
    state.areaEntered = !!progress.areaEntered || state.completedPointIds.size > 0 || !!state.startedAt;
    state.lastPointId = cleanText(progress.lastPointId || '', 180);
    return state;
  }
  function snapshotState() {
    var _state$corridor5, _state$corridor6;
    var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : activeState;
    if (!state) return null;
    var corridorCompleted = Array.from(((_state$corridor5 = state.corridor) === null || _state$corridor5 === void 0 ? void 0 : _state$corridor5.completedSegmentIds) || []);
    var activeCorridor = ((_state$corridor6 = state.corridor) === null || _state$corridor6 === void 0 ? void 0 : _state$corridor6.active) || null;
    var activeCoverage = (activeCorridor === null || activeCorridor === void 0 ? void 0 : activeCorridor.bins) instanceof Set ? Math.round(activeCorridor.bins.size / Math.max(1, Number(activeCorridor.totalBins || 1)) * 100) / 100 : 0;
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
        activeSegmentId: (activeCorridor === null || activeCorridor === void 0 ? void 0 : activeCorridor.segmentId) || '',
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
  function ensureOverlayPane() {
    var mapInstance = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var m = mapInstance || getMapInstance();
    if (!m || typeof m.getPane !== 'function') return undefined;
    var name = 'poiChainOverlayPane';
    var pane = m.getPane(name);
    if (!pane && typeof m.createPane === 'function') pane = m.createPane(name);
    if (pane) {
      pane.style.zIndex = '610';
      pane.style.pointerEvents = 'none';
    }
    return name;
  }
  function ensureOverlayLayer() {
    var mapInstance = getMapInstance();
    if (!mapInstance || typeof L === 'undefined') return null;
    var paneName = ensureOverlayPane(mapInstance);
    if (!overlayLayer) overlayLayer = L.layerGroup([], paneName ? {
      pane: paneName
    } : undefined);
    if (typeof mapInstance.hasLayer !== 'function' || !mapInstance.hasLayer(overlayLayer)) {
      try {
        overlayLayer.addTo(mapInstance);
      } catch (_) {
        return null;
      }
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
    var applyDomPassThrough = () => {
      try {
        var el = typeof layer.getElement === 'function' ? layer.getElement() : null;
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
    var added = leafletLayer.addTo(targetLayer);
    makeOverlayLayerPassive(added || leafletLayer);
    return added || leafletLayer;
  }
  function clearOverlay() {
    var mapInstance = getMapInstance();
    if (overlayLayer && mapInstance && typeof mapInstance.removeLayer === 'function') {
      try {
        mapInstance.removeLayer(overlayLayer);
      } catch (_) {}
    }
    overlayLayer = null;
    lastOverlayVisualKey = '';
  }
  function pointStyle(point, idx, state) {
    var completed = (state === null || state === void 0 ? void 0 : state.completedPointIds) instanceof Set && state.completedPointIds.has(point.id);
    var current = !completed && Number((state === null || state === void 0 ? void 0 : state.currentIndex) || 0) === idx;
    if (completed) return {
      color: '#24d26b',
      fillColor: '#24d26b',
      weight: 3,
      opacity: 0.95,
      fillOpacity: 0.92
    };
    if (current) return {
      color: '#ff4d4d',
      fillColor: '#ff4d4d',
      weight: 4,
      opacity: 0.98,
      fillOpacity: 0.88
    };
    return {
      color: '#5f6b82',
      fillColor: '#182538',
      weight: 2,
      opacity: 0.45,
      fillOpacity: 0.35
    };
  }
  function drawMarkerLabel(layer, point, idx, spec, state) {
    if (!layer || typeof L === 'undefined') return;
    var paneName = ensureOverlayPane();
    var completed = (state === null || state === void 0 ? void 0 : state.completedPointIds) instanceof Set && state.completedPointIds.has(point.id);
    var current = !completed && Number((state === null || state === void 0 ? void 0 : state.currentIndex) || 0) === idx;
    if (!completed && !current) return;
    var bg = completed ? 'rgba(20,95,52,.88)' : 'rgba(120,18,24,.9)';
    var text = completed ? `${idx + 1} ✓` : `${idx + 1}`;
    var marker = L.marker([point.lat, point.lon], {
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
    var _mapRef$getZoom;
    var mapRef = (layer === null || layer === void 0 ? void 0 : layer._map) || (typeof map !== 'undefined' ? map : null);
    var zoom = Number(mapRef === null || mapRef === void 0 || (_mapRef$getZoom = mapRef.getZoom) === null || _mapRef$getZoom === void 0 ? void 0 : _mapRef$getZoom.call(mapRef));
    var sample = Array.isArray(trace) && trace.length ? trace[Math.floor(trace.length / 2)] : null;
    var lat = Number(sample === null || sample === void 0 ? void 0 : sample.lat);
    if (!Number.isFinite(zoom) || !Number.isFinite(lat)) return 18;
    var metersPerPixel = 40075016.686 * Math.cos(lat * Math.PI / 180) / (256 * Math.pow(2, zoom));
    if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return 18;
    var px = Number(widthNm || 0.5) * NM_TO_M / metersPerPixel;
    return Math.max(10, Math.min(320, Math.round(px)));
  }
  function corridorEdgeLatLngs(trace, offsetNm) {
    var points = (Array.isArray(trace) ? trace : []).map(point => {
      var _point$lon3;
      return {
        lat: Number(point === null || point === void 0 ? void 0 : point.lat),
        lon: Number((_point$lon3 = point === null || point === void 0 ? void 0 : point.lon) !== null && _point$lon3 !== void 0 ? _point$lon3 : point === null || point === void 0 ? void 0 : point.lng)
      };
    }).filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lon));
    if (points.length < 2 || !Number.isFinite(Number(offsetNm))) return [];
    return points.map((point, idx) => {
      var prev = points[Math.max(0, idx - 1)];
      var next = points[Math.min(points.length - 1, idx + 1)];
      var refLat = (prev.lat + next.lat + point.lat) / 3;
      var eastNm = (next.lon - prev.lon) * 60 * Math.max(0.08, Math.abs(Math.cos(toRad(refLat))));
      var northNm = (next.lat - prev.lat) * 60;
      var len = Math.hypot(eastNm, northNm);
      if (!Number.isFinite(len) || len <= 0.0001) return [point.lat, point.lon];
      var normalEast = -northNm / len;
      var normalNorth = eastNm / len;
      var lat = point.lat + normalNorth * offsetNm / 60;
      var lonScale = 60 * Math.max(0.08, Math.abs(Math.cos(toRad(point.lat))));
      var lon = point.lon + normalEast * offsetNm / lonScale;
      return [roundNumber(lat), roundNumber(lon)];
    }).filter(pair => pair.every(Number.isFinite));
  }
  function drawCorridorEdge(layer, edgeLatLngs, paneName) {
    if (!Array.isArray(edgeLatLngs) || edgeLatLngs.length < 2) return;
    var common = {
      pane: paneName,
      lineCap: 'round',
      lineJoin: 'round',
      smoothFactor: 1.4,
      interactive: false
    };
    addPassiveOverlayLayer(L.polyline(edgeLatLngs, _objectSpread(_objectSpread({}, common), {}, {
      color: '#2f250b',
      weight: 4,
      opacity: 0.58
    })), layer);
    addPassiveOverlayLayer(L.polyline(edgeLatLngs, _objectSpread(_objectSpread({}, common), {}, {
      color: '#ffe58a',
      weight: 2,
      opacity: 0.9
    })), layer);
  }
  function drawCorridorHint(layer, points, spec) {
    var _spec$overlay, _spec$overlay2;
    if (!layer || typeof L === 'undefined') return;
    var paneName = ensureOverlayPane();
    var trace = Array.isArray(spec === null || spec === void 0 || (_spec$overlay = spec.overlay) === null || _spec$overlay === void 0 ? void 0 : _spec$overlay.trace) && spec.overlay.trace.length >= 2 ? spec.overlay.trace : points;
    if (!Array.isArray(trace) || trace.length < 2) return;
    var widthNm = Math.max(0.3, Math.min(10, Number((spec === null || spec === void 0 || (_spec$overlay2 = spec.overlay) === null || _spec$overlay2 === void 0 ? void 0 : _spec$overlay2.widthNm) || 0.5)));
    var tracePoints = trace.map(point => {
      var _point$lon4;
      return {
        lat: Number(point === null || point === void 0 ? void 0 : point.lat),
        lon: Number((_point$lon4 = point === null || point === void 0 ? void 0 : point.lon) !== null && _point$lon4 !== void 0 ? _point$lon4 : point === null || point === void 0 ? void 0 : point.lng)
      };
    }).filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lon));
    var latLngs = tracePoints.map(point => [point.lat, point.lon]);
    if (latLngs.length < 2) return;
    var weight = corridorStrokeWeightPx(trace, widthNm, layer);
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
    var edgeOffsetNm = widthNm / 2;
    drawCorridorEdge(layer, corridorEdgeLatLngs(tracePoints, edgeOffsetNm), paneName);
    drawCorridorEdge(layer, corridorEdgeLatLngs(tracePoints, -edgeOffsetNm), paneName);
  }
  function drawCorridorSegmentProgress(layer) {
    var _spec$corridor4, _progressState$corrid, _progressState$corrid2;
    var spec = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var progressState = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    if (!layer || typeof L === 'undefined') return;
    var segments = Array.isArray(spec === null || spec === void 0 || (_spec$corridor4 = spec.corridor) === null || _spec$corridor4 === void 0 ? void 0 : _spec$corridor4.segments) ? spec.corridor.segments : [];
    if (!segments.length) return;
    var paneName = ensureOverlayPane();
    var completed = (progressState === null || progressState === void 0 || (_progressState$corrid = progressState.corridor) === null || _progressState$corrid === void 0 ? void 0 : _progressState$corrid.completedSegmentIds) instanceof Set ? progressState.corridor.completedSegmentIds : new Set();
    var currentIdx = Math.max(0, Number((progressState === null || progressState === void 0 || (_progressState$corrid2 = progressState.corridor) === null || _progressState$corrid2 === void 0 ? void 0 : _progressState$corrid2.currentSegmentIndex) || 0) || 0);
    segments.forEach((segment, idx) => {
      var _segment$start, _segment$start$lon, _segment$start2, _segment$start3, _segment$end, _segment$end$lon, _segment$end2, _segment$end3;
      var done = completed.has(String(segment.id || ''));
      var active = !done && idx === currentIdx;
      var startLat = Number((_segment$start = segment.start) === null || _segment$start === void 0 ? void 0 : _segment$start.lat);
      var startLon = Number((_segment$start$lon = (_segment$start2 = segment.start) === null || _segment$start2 === void 0 ? void 0 : _segment$start2.lon) !== null && _segment$start$lon !== void 0 ? _segment$start$lon : (_segment$start3 = segment.start) === null || _segment$start3 === void 0 ? void 0 : _segment$start3.lng);
      var endLat = Number((_segment$end = segment.end) === null || _segment$end === void 0 ? void 0 : _segment$end.lat);
      var endLon = Number((_segment$end$lon = (_segment$end2 = segment.end) === null || _segment$end2 === void 0 ? void 0 : _segment$end2.lon) !== null && _segment$end$lon !== void 0 ? _segment$end$lon : (_segment$end3 = segment.end) === null || _segment$end3 === void 0 ? void 0 : _segment$end3.lng);
      if (![startLat, startLon, endLat, endLon].every(Number.isFinite)) return;
      addPassiveOverlayLayer(L.polyline([[startLat, startLon], [endLat, endLon]], {
        pane: paneName,
        color: done ? '#24d26b' : active ? '#ff4d4d' : '#d7b34a',
        weight: active ? 6 : 4,
        opacity: done ? 0.88 : active ? 0.92 : 0.28,
        dashArray: done || active ? null : '8,8',
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false
      }), layer);
    });
  }
  function drawOverlay() {
    var _spec$overlay3, _spec$overlay4;
    var specRaw = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var progressState = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : activeState;
    var spec = normalizeSpec(specRaw);
    if (!spec) {
      clearOverlay();
      return false;
    }
    var layer = ensureOverlayLayer();
    if (!layer || typeof L === 'undefined') return false;
    if (typeof layer.clearLayers === 'function') layer.clearLayers();
    var points = spec.points || [];
    var currentIdx = Math.max(0, Math.min(points.length - 1, Number((progressState === null || progressState === void 0 ? void 0 : progressState.currentIndex) || 0) || 0));
    drawCorridorHint(layer, points, spec);
    drawCorridorSegmentProgress(layer, spec, progressState);
    var revealCurrentPoint = !!(progressState !== null && progressState !== void 0 && progressState.areaEntered || (progressState === null || progressState === void 0 ? void 0 : progressState.completedPointIds) instanceof Set && progressState.completedPointIds.size > 0);
    var visiblePoints = points.filter((point, idx) => {
      var completed = (progressState === null || progressState === void 0 ? void 0 : progressState.completedPointIds) instanceof Set && progressState.completedPointIds.has(point.id);
      return completed || revealCurrentPoint && idx === currentIdx || !spec.sequenceRequired;
    });
    if (points.length < 2 && (_spec$overlay3 = spec.overlay) !== null && _spec$overlay3 !== void 0 && _spec$overlay3.start && (_spec$overlay4 = spec.overlay) !== null && _spec$overlay4 !== void 0 && _spec$overlay4.end) {
      var start = spec.overlay.start;
      var end = spec.overlay.end;
      var startLat = Number(start.lat);
      var startLon = Number(start.lon);
      var endLat = Number(end.lat);
      var endLon = Number(end.lon);
      if ([startLat, startLon, endLat, endLon].every(Number.isFinite)) {
        var fallbackLine = L.polyline([[startLat, startLon], [endLat, endLon]], {
          pane: ensureOverlayPane(),
          color: '#f2c94c',
          weight: 4,
          opacity: 0.45,
          dashArray: '10,8',
          interactive: false
        }).bindTooltip(spec.overlay.label || spec.label, {
          permanent: false,
          interactive: false
        });
        addPassiveOverlayLayer(fallbackLine, layer);
      }
    }
    for (var i = 0; i < visiblePoints.length - 1; i++) {
      var a = visiblePoints[i];
      var b = visiblePoints[i + 1];
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
      var completed = (progressState === null || progressState === void 0 ? void 0 : progressState.completedPointIds) instanceof Set && progressState.completedPointIds.has(point.id);
      var current = !completed && idx === currentIdx;
      if (!completed && (!current || !revealCurrentPoint) && spec.sequenceRequired) return;
      var label = `${idx + 1}/${points.length} ${point.name}`;
      var radiusCircle = L.circle([point.lat, point.lon], {
        pane: ensureOverlayPane(),
        radius: point.triggerRadiusNm * NM_TO_M,
        color: completed ? '#24d26b' : current ? '#ff4d4d' : '#5f6b82',
        weight: completed || current ? 3 : 2,
        opacity: completed || current ? 0.75 : 0.35,
        fillColor: completed ? '#24d26b' : current ? '#ff4d4d' : '#182538',
        fillOpacity: completed ? 0.08 : current ? 0.06 : 0.03,
        dashArray: null,
        interactive: false,
        bubblingMouseEvents: false
      }).bindTooltip(`${label} · ${point.triggerRadiusNm.toFixed(2)} NM`, {
        permanent: false,
        interactive: false
      });
      addPassiveOverlayLayer(radiusCircle, layer);
      var pointMarker = L.circleMarker([point.lat, point.lon], _objectSpread(_objectSpread({
        pane: ensureOverlayPane(),
        radius: current ? 8 : 6
      }, pointStyle(point, idx, progressState)), {}, {
        interactive: false,
        bubblingMouseEvents: false
      })).bindTooltip(label, {
        permanent: false,
        interactive: false
      });
      addPassiveOverlayLayer(pointMarker, layer);
      drawMarkerLabel(layer, point, idx, spec, progressState);
    });
    return true;
  }
  function renderOverlayIfNeeded(spec, state) {
    var force = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    if (!canRenderOverlayNow()) return false;
    var visualKey = overlayVisualKey(spec, state);
    if (!force && visualKey && visualKey === lastOverlayVisualKey) return false;
    var rendered = drawOverlay(spec, state);
    if (rendered) lastOverlayVisualKey = visualKey;
    return rendered;
  }
  function sampleFromInput() {
    var _ref, _ref2, _ref3, _ref4, _input$headingDeg, _ref5, _ref6, _ref7, _input$gsKts;
    var input = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var flightData = input.flightData || {};
    var gps = host.lastLiveGpsPos || {};
    return {
      lat: Number(input.lat),
      lon: Number(input.lon),
      headingDeg: Number((_ref = (_ref2 = (_ref3 = (_ref4 = (_input$headingDeg = input.headingDeg) !== null && _input$headingDeg !== void 0 ? _input$headingDeg : flightData.hdg) !== null && _ref4 !== void 0 ? _ref4 : flightData.heading) !== null && _ref3 !== void 0 ? _ref3 : flightData.trackDeg) !== null && _ref2 !== void 0 ? _ref2 : flightData.trkDeg) !== null && _ref !== void 0 ? _ref : gps.hdg),
      gsKts: Number((_ref5 = (_ref6 = (_ref7 = (_input$gsKts = input.gsKts) !== null && _input$gsKts !== void 0 ? _input$gsKts : flightData.gs) !== null && _ref7 !== void 0 ? _ref7 : flightData.gsKts) !== null && _ref6 !== void 0 ? _ref6 : flightData.groundSpeed) !== null && _ref5 !== void 0 ? _ref5 : gps.gs),
      nowMs: Number(input.nowMs || input.now || Date.now())
    };
  }
  function sampleSpeedOk(minGroundSpeedKts, sample) {
    var gs = Number(sample.gsKts);
    if (!Number.isFinite(gs) || gs <= 0) return true;
    return gs >= Number(minGroundSpeedKts || 0);
  }
  function headingMatchesSegment() {
    var corridor = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var projection = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var sample = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    var direction = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : '';
    var hdg = Number(sample === null || sample === void 0 ? void 0 : sample.headingDeg);
    if (!Number.isFinite(hdg)) return true;
    var b = Number(projection === null || projection === void 0 ? void 0 : projection.bearingDeg);
    if (!Number.isFinite(b)) return true;
    var expected = direction === 'reverse' ? (b + 180) % 360 : b;
    return angleDiffAbs(hdg, expected) <= Number(corridor.headingToleranceDeg || DEFAULTS.corridor.headingToleranceDeg);
  }
  function findSegmentProjection() {
    var segment = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var sample = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    if (!segment || !Number.isFinite(Number(sample === null || sample === void 0 ? void 0 : sample.lat)) || !Number.isFinite(Number(sample === null || sample === void 0 ? void 0 : sample.lon))) return null;
    var projection = projectPointToSegmentNm(sample.lat, sample.lon, segment);
    if (!projection) return null;
    return {
      segment,
      projection
    };
  }
  function sampleNearCorridor() {
    var spec = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var sample = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var corridor = (spec === null || spec === void 0 ? void 0 : spec.corridor) || null;
    var segments = Array.isArray(corridor === null || corridor === void 0 ? void 0 : corridor.segments) ? corridor.segments : [];
    if (!segments.length) return false;
    var tol = Number(corridor.crossTrackToleranceNm || DEFAULTS.corridor.crossTrackToleranceNm) + 0.25;
    return segments.some(segment => {
      var projection = projectPointToSegmentNm(sample === null || sample === void 0 ? void 0 : sample.lat, sample === null || sample === void 0 ? void 0 : sample.lon, segment);
      return !!(projection && projection.t >= -0.15 && projection.t <= 1.15 && projection.crossTrackNm <= tol);
    });
  }
  function makeCorridorResetEvent() {
    var reason = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'offtrack';
    var segment = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    return {
      type: reason === 'speed' ? 'corridor_segment_reset_speed' : 'corridor_segment_reset_offtrack',
      reason,
      segment,
      segmentId: cleanText((segment === null || segment === void 0 ? void 0 : segment.id) || '', 80)
    };
  }
  function tickCorridorState() {
    var spec = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var state = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var sample = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    var events = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
    if (!corridorRequired(spec) || !(state !== null && state !== void 0 && state.corridor)) {
      if (state !== null && state !== void 0 && state.corridor) state.corridor.satisfied = true;
      return;
    }
    var corridor = spec.corridor;
    var segments = corridor.segments || [];
    var now = Number((sample === null || sample === void 0 ? void 0 : sample.nowMs) || Date.now());
    if (!Number.isFinite(sample === null || sample === void 0 ? void 0 : sample.lat) || !Number.isFinite(sample === null || sample === void 0 ? void 0 : sample.lon)) return;
    if (!state.areaEntered && sampleNearCorridor(spec, sample)) {
      state.areaEntered = true;
      if (!state.startedAt) state.startedAt = now;
      events.push({
        type: 'chain_corridor_entered'
      });
    }
    var idx = Math.max(0, Math.min(segments.length, Number(state.corridor.currentSegmentIndex || 0) || 0));
    while (idx < segments.length && state.corridor.completedSegmentIds.has(String(((_segments$idx = segments[idx]) === null || _segments$idx === void 0 ? void 0 : _segments$idx.id) || ''))) {
      var _segments$idx;
      idx += 1;
    }
    state.corridor.currentSegmentIndex = idx;
    var segment = segments[idx] || null;
    if (!segment) {
      state.corridor.satisfied = true;
      return;
    }
    var candidate = findSegmentProjection(segment, sample);
    var projection = (candidate === null || candidate === void 0 ? void 0 : candidate.projection) || null;
    var withinSegment = !!(projection && projection.t >= -0.08 && projection.t <= 1.08);
    var inCorridor = !!(withinSegment && projection.crossTrackNm <= corridor.crossTrackToleranceNm);
    var speedOk = sampleSpeedOk(corridor.minGroundSpeedKts, sample);
    var active = state.corridor.active;
    if (!active && inCorridor && speedOk) {
      var _t = clamp(projection.t, 0, 1);
      var edge = Number(corridor.startEndTolerance || DEFAULTS.corridor.startEndTolerance);
      if (_t <= edge || _t >= 1 - edge) {
        var direction = _t <= 0.5 ? 'forward' : 'reverse';
        if (headingMatchesSegment(corridor, projection, sample, direction)) {
          active = {
            segmentId: String(segment.id || ''),
            direction,
            bins: new Set(),
            totalBins: corridor.bins,
            startedAt: now,
            lastGoodAt: now,
            badSince: 0,
            lastT: _t,
            endCap: false
          };
          state.corridor.active = active;
          if (!state.startedAt) state.startedAt = now;
          state.areaEntered = true;
          events.push({
            type: 'corridor_segment_started',
            segment,
            segmentIndex: idx
          });
        }
      }
    }
    active = state.corridor.active;
    if (!active) return;
    var sameSegment = inCorridor && String(active.segmentId || '') === String(segment.id || '');
    var headingOk = sameSegment && headingMatchesSegment(corridor, projection, sample, active.direction);
    var valid = sameSegment && speedOk && headingOk;
    if (!valid) {
      if (!active.badSince) active.badSince = now;
      var graceMs = Number(corridor.resetGraceSec || DEFAULTS.corridor.resetGraceSec) * 1000;
      if (now - active.badSince >= graceMs) {
        var reason = !speedOk ? 'speed' : 'offtrack';
        state.corridor.lastResetReason = reason;
        events.push(makeCorridorResetEvent(reason, segment));
        state.corridor.active = null;
      }
      return;
    }
    var t = clamp(projection.t, 0, 1);
    var movedBack = active.direction === 'forward' ? t < Number(active.lastT || 0) - 0.22 : t > Number(active.lastT || 1) + 0.22;
    if (movedBack) {
      state.corridor.lastResetReason = 'offtrack';
      events.push(makeCorridorResetEvent('offtrack', segment));
      state.corridor.active = null;
      return;
    }
    active.badSince = 0;
    active.lastGoodAt = now;
    active.lastT = t;
    var bin = Math.min(corridor.bins - 1, Math.max(0, Math.floor(clamp(t, 0, 0.999) * corridor.bins)));
    active.bins.add(bin);
    if (active.direction === 'forward' && t >= 1 - corridor.startEndTolerance || active.direction === 'reverse' && t <= corridor.startEndTolerance) {
      active.endCap = true;
    }
    var coverage = active.bins.size / Math.max(1, Number(active.totalBins || corridor.bins));
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
        events.push({
          type: 'chain_corridor_complete',
          totalSegments: segments.length
        });
      }
    }
  }
  function tickState(specRaw, stateRaw) {
    var sampleRaw = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    var spec = normalizeSpec(specRaw);
    if (!spec) return {
      handled: false,
      state: stateRaw || null,
      events: [],
      satisfied: false,
      progress: null
    };
    var state = stateRaw || createInitialState(spec);
    if (state.specKey !== spec.key) return tickState(spec, createInitialState(spec), sampleRaw);
    if (!state.corridor) state.corridor = createInitialState(spec).corridor;
    state.satisfied = requiredPointsDone(spec, state) && corridorDone(spec, state);
    if (state.satisfied) return {
      handled: true,
      state,
      events: [],
      satisfied: true,
      progress: snapshotState(state)
    };
    var sample = sampleFromInput(sampleRaw);
    var lat = Number(sample.lat);
    var lon = Number(sample.lon);
    var nowMs = Number(sample.nowMs || Date.now());
    var events = [];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return {
        handled: true,
        state,
        events,
        satisfied: !!state.satisfied,
        progress: snapshotState(state)
      };
    }
    var wasSatisfied = !!state.satisfied;
    tickCorridorState(spec, state, sample, events);
    var idx = Math.max(0, Math.min(spec.points.length - 1, Number(state.currentIndex || 0) || 0));
    while (idx < spec.points.length && state.completedPointIds.has(spec.points[idx].id)) idx += 1;
    state.currentIndex = idx;
    var current = spec.points[idx] || null;
    if (!current) {
      state.currentIndex = spec.points.length;
    } else {
      var distNm = haversineNm(lat, lon, current.lat, current.lon);
      if (distNm <= current.triggerRadiusNm) {
        if (!state.startedAt) state.startedAt = nowMs;
        state.areaEntered = true;
        state.completedPointIds.add(current.id);
        state.lastPointId = current.id;
        var nextIndex = idx + 1;
        var nextPoint = spec.points[nextIndex] || null;
        var hiddenOutcome = spec.hiddenOutcome && String(spec.hiddenOutcome.pointId || '') === String(current.id || '') && String(spec.hiddenOutcome.revealAfter || 'point_complete').toLowerCase() === 'point_complete' ? spec.hiddenOutcome : null;
        state.currentIndex = nextPoint ? nextIndex : spec.points.length;
        events.push({
          type: 'point_complete',
          point: current,
          pointIndex: idx,
          nextPoint,
          nextIndex: nextPoint ? nextIndex : null,
          hiddenOutcome,
          findingText: (hiddenOutcome === null || hiddenOutcome === void 0 ? void 0 : hiddenOutcome.paxFindingText) || (hiddenOutcome === null || hiddenOutcome === void 0 ? void 0 : hiddenOutcome.findingHint) || '',
          findingHint: (hiddenOutcome === null || hiddenOutcome === void 0 ? void 0 : hiddenOutcome.findingHint) || '',
          finding: (hiddenOutcome === null || hiddenOutcome === void 0 ? void 0 : hiddenOutcome.findingKind) || '',
          distNm: roundNumber(distNm, 3)
        });
        if (!requiredPointsDone(spec, state) && nextPoint) {
          events.push({
            type: 'next_point_revealed',
            point: nextPoint,
            pointIndex: nextIndex
          });
        }
      }
    }
    var pointsDone = requiredPointsDone(spec, state);
    var corridorComplete = corridorDone(spec, state);
    if (state.corridor) state.corridor.satisfied = corridorComplete;
    state.satisfied = pointsDone && corridorComplete;
    if (state.satisfied && !wasSatisfied) events.push({
      type: 'chain_complete'
    });
    state.updatedAt = nowMs;
    state.events = events;
    return {
      handled: true,
      state,
      events,
      satisfied: !!state.satisfied,
      progress: snapshotState(state)
    };
  }
  function tick() {
    var _input$lat, _ref8, _input$lon, _ref9, _ref0, _ref1, _input$headingDeg2, _ref10, _ref11, _input$gsKts2;
    var input = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var spec = getMissionSpec(input.missionData || null, input.passenger || null);
    if (!spec) {
      if (activeSpecKey) reset('no-active-chain');
      return {
        handled: false,
        events: [],
        satisfied: false,
        progress: null
      };
    }
    if (!activeState || activeSpecKey !== spec.key || activeState.specKey !== spec.key) {
      activeState = createInitialState(spec);
      activeSpecKey = spec.key;
    }
    var fd = input.flightData || {};
    var sample = {
      lat: Number((_input$lat = input.lat) !== null && _input$lat !== void 0 ? _input$lat : fd.lat),
      lon: Number((_ref8 = (_input$lon = input.lon) !== null && _input$lon !== void 0 ? _input$lon : fd.lon) !== null && _ref8 !== void 0 ? _ref8 : fd.lng),
      headingDeg: Number((_ref9 = (_ref0 = (_ref1 = (_input$headingDeg2 = input.headingDeg) !== null && _input$headingDeg2 !== void 0 ? _input$headingDeg2 : fd.hdg) !== null && _ref1 !== void 0 ? _ref1 : fd.heading) !== null && _ref0 !== void 0 ? _ref0 : fd.trackDeg) !== null && _ref9 !== void 0 ? _ref9 : fd.trkDeg),
      gsKts: Number((_ref10 = (_ref11 = (_input$gsKts2 = input.gsKts) !== null && _input$gsKts2 !== void 0 ? _input$gsKts2 : fd.gs) !== null && _ref11 !== void 0 ? _ref11 : fd.gsKts) !== null && _ref10 !== void 0 ? _ref10 : fd.groundSpeed),
      nowMs: Number(input.nowMs || Date.now()),
      flightData: fd
    };
    var result = tickState(spec, activeState, sample);
    activeState = result.state;
    renderOverlayIfNeeded(spec, activeState);
    return _objectSpread(_objectSpread({}, result), {}, {
      spec,
      progress: snapshotState(activeState)
    });
  }
  function restoreProgress() {
    var progress = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var missionData = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var passenger = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    var spec = getMissionSpec(missionData, passenger);
    if (!spec || !progress) return false;
    activeState = hydrateState(spec, progress);
    activeSpecKey = spec.key;
    renderOverlayIfNeeded(spec, activeState, true);
    return true;
  }
  function reset() {
    activeState = null;
    activeSpecKey = '';
    clearOverlay();
  }

  // Tracker owns progress; this path only draws its committed projection.
  function renderAuthorityProjection(specRaw, progress) {
    var spec = normalizeSpec(specRaw);
    if (!spec) {
      clearOverlay();
      return false;
    }
    var state = hydrateState(spec, progress);
    if (progress) {
      state.satisfied = progress.satisfied === true;
      if (progress.corridor) {
        state.corridor.satisfied = progress.corridor.satisfied === true;
        state.corridor.totalSegments = progress.corridor.totalSegments;
        if (progress.corridor.activeSegmentId) state.corridor.active = {
          segmentId: progress.corridor.activeSegmentId
        };
      }
    }
    return renderOverlayIfNeeded(spec, state);
  }
  function refreshOverlay() {
    var _host$gaTrackerExecut, _host$gaTrackerExecut2;
    var missionData = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var passenger = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    if (((_host$gaTrackerExecut = host.gaTrackerExecutionControl) === null || _host$gaTrackerExecut === void 0 ? void 0 : _host$gaTrackerExecut.executionAuthority) === 'tracker') return renderAuthorityProjection(host.gaTrackerExecutionControl.chainSpec, (_host$gaTrackerExecut2 = host.gaTrackerExecutionControl.poiTask) === null || _host$gaTrackerExecut2 === void 0 ? void 0 : _host$gaTrackerExecut2.poiChain);
    var spec = getMissionSpec(missionData, passenger);
    if (!spec) {
      clearOverlay();
      return false;
    }
    if (!activeState || activeSpecKey !== spec.key) {
      activeState = createInitialState(spec);
      activeSpecKey = spec.key;
    }
    return renderOverlayIfNeeded(spec, activeState, true);
  }
  function refreshActiveMissionOverlay() {
    var _host$gaTrackerExecut3, _host$gaTrackerExecut4;
    if (((_host$gaTrackerExecut3 = host.gaTrackerExecutionControl) === null || _host$gaTrackerExecut3 === void 0 ? void 0 : _host$gaTrackerExecut3.executionAuthority) === 'tracker') return renderAuthorityProjection(host.gaTrackerExecutionControl.chainSpec, (_host$gaTrackerExecut4 = host.gaTrackerExecutionControl.poiTask) === null || _host$gaTrackerExecut4 === void 0 ? void 0 : _host$gaTrackerExecut4.poiChain);
    var md = activeMissionDataFromHost();
    if (!md) return false;
    try {
      return refreshOverlay(md, host.activePassenger || (md === null || md === void 0 ? void 0 : md.passenger) || null);
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
  var api = {
    defaults: DEFAULTS,
    normalizeSpec,
    getActiveSpec: getMissionSpec,
    tick,
    tickState,
    restoreProgress,
    reset,
    refreshOverlay,
    renderAuthorityProjection,
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
      normalizeCorridorWidthNm,
      normalizeCorridor,
      overlayVisualKey
    }
  };
  host.missionPoiChainRuntime = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleInitialOverlayRefresh, {
      once: true
    });else scheduleInitialOverlayRefresh();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
