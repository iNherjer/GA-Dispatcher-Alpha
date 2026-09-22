// Generated from mission-survey-pattern.js by sync-efb-web-assets.js. Do not edit.
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
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
  var DEFAULTS = {
    altitudeToleranceFt: 300,
    scan: {
      lineCount: 4,
      lineLengthNm: 1.6,
      lineSpacingNm: 0.35,
      crossTrackToleranceNm: 0.10,
      headingToleranceDeg: 35,
      minCoverage: 0.82,
      bins: 24,
      startEndTolerance: 0.18,
      resetGraceSec: 5,
      minGroundSpeedKts: 45
    },
    orbit: {
      radiusNm: 0.55,
      radialToleranceNm: 0.12,
      requiredTurns: 3,
      sectorsPerTurn: 36,
      minTurnCoverage: 0.86,
      resetGraceSec: 5,
      minGroundSpeedKts: 45,
      minTurnSec: 45
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
    var _state$scan, _state$scan2, _state$orbit;
    var spec = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var state = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    if (!spec) return '';
    var completedLines = (state === null || state === void 0 || (_state$scan = state.scan) === null || _state$scan === void 0 ? void 0 : _state$scan.completedLineIds) instanceof Set ? Array.from(state.scan.completedLineIds).map(String).sort().join(',') : '';
    return [spec.key, spec.type, state !== null && state !== void 0 && state.satisfied ? 1 : 0, String((state === null || state === void 0 || (_state$scan2 = state.scan) === null || _state$scan2 === void 0 || (_state$scan2 = _state$scan2.active) === null || _state$scan2 === void 0 ? void 0 : _state$scan2.lineId) || ''), completedLines, Math.max(0, Number((state === null || state === void 0 || (_state$orbit = state.orbit) === null || _state$orbit === void 0 ? void 0 : _state$orbit.completedTurns) || 0))].join('|');
  }
  function activeMissionDataFromHost() {
    try {
      if (typeof currentMissionData !== 'undefined' && currentMissionData && typeof currentMissionData === 'object') {
        return currentMissionData;
      }
    } catch (_) {}
    return host.currentMissionData && typeof host.currentMissionData === 'object' ? host.currentMissionData : null;
  }
  function clamp(value, min, max) {
    var n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }
  function roundNumber(value) {
    var digits = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 6;
    var n = Number(value);
    if (!Number.isFinite(n)) return null;
    var p = Math.pow(10, digits);
    return Math.round(n * p) / p;
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
  function destinationPoint(lat, lon, distNm, bearing) {
    var lat1 = toRad(lat);
    var lon1 = toRad(lon);
    var brng = toRad(bearing);
    var d = Number(distNm) / EARTH_RADIUS_NM;
    var lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
    var lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    return {
      lat: toDeg(lat2),
      lon: toDeg(lon2)
    };
  }
  function angleDiffAbs(a, b) {
    return Math.abs(((Number(a) - Number(b)) % 360 + 540) % 360 - 180);
  }
  function signedAngleDelta(fromDeg, toDeg) {
    return ((Number(toDeg) - Number(fromDeg)) % 360 + 540) % 360 - 180;
  }
  function interpolateLine(line, tRaw) {
    var t = clamp(tRaw, 0, 1);
    return {
      lat: Number(line.start.lat) + (Number(line.end.lat) - Number(line.start.lat)) * t,
      lon: Number(line.start.lon) + (Number(line.end.lon) - Number(line.start.lon)) * t
    };
  }
  function localPointNm(lat, lon, originLat, originLon) {
    var avgLat = toRad((Number(lat) + Number(originLat)) / 2);
    return {
      x: (Number(lon) - Number(originLon)) * Math.cos(avgLat) * 60,
      y: (Number(lat) - Number(originLat)) * 60
    };
  }
  function localPointToLatLonNm(point, origin) {
    var originLat = Number(origin === null || origin === void 0 ? void 0 : origin.lat);
    var originLon = Number(origin === null || origin === void 0 ? void 0 : origin.lon);
    if (!Number.isFinite(originLat) || !Number.isFinite(originLon)) return null;
    var lat = originLat + Number((point === null || point === void 0 ? void 0 : point.y) || 0) / 60;
    var lonScale = Math.max(0.01, Math.cos(toRad(originLat)) * 60);
    var lon = originLon + Number((point === null || point === void 0 ? void 0 : point.x) || 0) / lonScale;
    return {
      lat,
      lon
    };
  }
  function projectPointToLineNm(lat, lon, line) {
    var start = (line === null || line === void 0 ? void 0 : line.start) || {};
    var end = (line === null || line === void 0 ? void 0 : line.end) || {};
    var sx = 0;
    var sy = 0;
    var e = localPointNm(end.lat, end.lon, start.lat, start.lon);
    var p = localPointNm(lat, lon, start.lat, start.lon);
    var vx = e.x - sx;
    var vy = e.y - sy;
    var lenSq = vx * vx + vy * vy;
    var lenNm = Math.sqrt(lenSq);
    if (!(lenSq > 0)) return null;
    var t = ((p.x - sx) * vx + (p.y - sy) * vy) / lenSq;
    var cx = sx + t * vx;
    var cy = sy + t * vy;
    var crossTrackNm = Math.sqrt(Math.pow(p.x - cx, 2) + Math.pow(p.y - cy, 2));
    return {
      t,
      crossTrackNm,
      alongNm: clamp(t, 0, 1) * lenNm,
      lengthNm: lenNm,
      bearingDeg: bearingDeg(start.lat, start.lon, end.lat, end.lon)
    };
  }
  function buildScanLines(center) {
    var scan = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var lineCount = Math.max(1, Math.min(8, Math.round(Number(scan.lineCount || DEFAULTS.scan.lineCount))));
    var lineLengthNm = Math.max(0.4, Math.min(5, Number(scan.lineLengthNm || DEFAULTS.scan.lineLengthNm)));
    var lineSpacingNm = Math.max(0.12, Math.min(1.2, Number(scan.lineSpacingNm || DEFAULTS.scan.lineSpacingNm)));
    var halfLen = lineLengthNm / 2;
    var mid = (lineCount - 1) / 2;
    var lines = [];
    for (var i = 0; i < lineCount; i++) {
      var offsetNm = (i - mid) * lineSpacingNm;
      var base = Math.abs(offsetNm) > 0.0001 ? destinationPoint(center.lat, center.lon, Math.abs(offsetNm), offsetNm >= 0 ? 90 : 270) : _objectSpread({}, center);
      var north = destinationPoint(base.lat, base.lon, halfLen, 0);
      var south = destinationPoint(base.lat, base.lon, halfLen, 180);
      lines.push({
        id: `S${i + 1}`,
        label: `Survey-Linie ${i + 1}`,
        start: {
          lat: roundNumber(north.lat),
          lon: roundNumber(north.lon)
        },
        end: {
          lat: roundNumber(south.lat),
          lon: roundNumber(south.lon)
        }
      });
    }
    return lines;
  }
  function normalizeType(value) {
    var s = String(value || '').toLowerCase();
    if (s === 'orbit' || s === 'circle' || s === 'turns') return 'orbit';
    return 'north_south_scan';
  }
  function normalizeSpec() {
    var _centerSrc$lat, _ref, _centerSrc$lon;
    var raw = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    if (!raw || typeof raw !== 'object') return null;
    if (raw.enabled === false) return null;
    var taskDomain = String(raw.taskDomain || raw.domain || '').toLowerCase();
    if (taskDomain && taskDomain !== 'mapping_survey') return null;
    var centerSrc = raw.center || raw.target || raw.anchor || {};
    var lat = Number((_centerSrc$lat = centerSrc.lat) !== null && _centerSrc$lat !== void 0 ? _centerSrc$lat : raw.targetLat);
    var lon = Number((_ref = (_centerSrc$lon = centerSrc.lon) !== null && _centerSrc$lon !== void 0 ? _centerSrc$lon : centerSrc.lng) !== null && _ref !== void 0 ? _ref : raw.targetLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    var type = normalizeType(raw.type || raw.patternType);
    var center = {
      lat: roundNumber(lat),
      lon: roundNumber(lon)
    };
    var scan = _objectSpread(_objectSpread({}, DEFAULTS.scan), raw.scan && typeof raw.scan === 'object' ? raw.scan : {});
    var orbit = _objectSpread(_objectSpread({}, DEFAULTS.orbit), raw.orbit && typeof raw.orbit === 'object' ? raw.orbit : {});
    scan.lineCount = Math.max(1, Math.min(8, Math.round(Number(scan.lineCount || DEFAULTS.scan.lineCount))));
    scan.lineLengthNm = Math.max(0.4, Math.min(5, Number(scan.lineLengthNm || DEFAULTS.scan.lineLengthNm)));
    scan.lineSpacingNm = Math.max(0.12, Math.min(1.2, Number(scan.lineSpacingNm || DEFAULTS.scan.lineSpacingNm)));
    scan.crossTrackToleranceNm = Math.max(0.03, Math.min(0.5, Number(scan.crossTrackToleranceNm || DEFAULTS.scan.crossTrackToleranceNm)));
    scan.headingToleranceDeg = Math.max(5, Math.min(90, Number(scan.headingToleranceDeg || DEFAULTS.scan.headingToleranceDeg)));
    scan.minCoverage = Math.max(0.35, Math.min(1, Number(scan.minCoverage || DEFAULTS.scan.minCoverage)));
    scan.bins = Math.max(8, Math.min(80, Math.round(Number(scan.bins || DEFAULTS.scan.bins))));
    scan.startEndTolerance = Math.max(0.05, Math.min(0.4, Number(scan.startEndTolerance || DEFAULTS.scan.startEndTolerance)));
    scan.resetGraceSec = Math.max(1, Math.min(20, Number(scan.resetGraceSec || DEFAULTS.scan.resetGraceSec)));
    scan.minGroundSpeedKts = Math.max(0, Math.min(120, Number(scan.minGroundSpeedKts || DEFAULTS.scan.minGroundSpeedKts)));
    orbit.radiusNm = Math.max(0.2, Math.min(2.5, Number(orbit.radiusNm || DEFAULTS.orbit.radiusNm)));
    orbit.radialToleranceNm = Math.max(0.04, Math.min(0.5, Number(orbit.radialToleranceNm || DEFAULTS.orbit.radialToleranceNm)));
    orbit.requiredTurns = Math.max(1, Math.min(6, Math.round(Number(orbit.requiredTurns || DEFAULTS.orbit.requiredTurns))));
    orbit.sectorsPerTurn = Math.max(12, Math.min(90, Math.round(Number(orbit.sectorsPerTurn || DEFAULTS.orbit.sectorsPerTurn))));
    orbit.minTurnCoverage = Math.max(0.45, Math.min(1, Number(orbit.minTurnCoverage || DEFAULTS.orbit.minTurnCoverage)));
    orbit.resetGraceSec = Math.max(1, Math.min(20, Number(orbit.resetGraceSec || DEFAULTS.orbit.resetGraceSec)));
    orbit.minGroundSpeedKts = Math.max(0, Math.min(120, Number(orbit.minGroundSpeedKts || DEFAULTS.orbit.minGroundSpeedKts)));
    orbit.minTurnSec = Math.max(0, Math.min(240, Number(orbit.minTurnSec || DEFAULTS.orbit.minTurnSec)));
    if (!Array.isArray(scan.lines) || scan.lines.length !== scan.lineCount) {
      scan.lines = buildScanLines(center, scan);
    } else {
      scan.lines = scan.lines.map((line, idx) => {
        var _line$start, _line$start2, _line$end, _line$end2;
        return {
          id: String(line.id || `S${idx + 1}`),
          label: String(line.label || `Survey-Linie ${idx + 1}`),
          start: {
            lat: roundNumber((_line$start = line.start) === null || _line$start === void 0 ? void 0 : _line$start.lat),
            lon: roundNumber((_line$start2 = line.start) === null || _line$start2 === void 0 ? void 0 : _line$start2.lon)
          },
          end: {
            lat: roundNumber((_line$end = line.end) === null || _line$end === void 0 ? void 0 : _line$end.lat),
            lon: roundNumber((_line$end2 = line.end) === null || _line$end2 === void 0 ? void 0 : _line$end2.lon)
          }
        };
      }).filter(line => Number.isFinite(line.start.lat) && Number.isFinite(line.start.lon) && Number.isFinite(line.end.lat) && Number.isFinite(line.end.lon));
      scan.lineCount = scan.lines.length || scan.lineCount;
    }
    var targetAltFt = Math.max(0, Math.round(Number(raw.targetAltFt || 0)));
    var altitudeToleranceFt = Math.max(100, Math.min(1000, Math.round(Number(raw.altitudeToleranceFt || DEFAULTS.altitudeToleranceFt))));
    var key = String(raw.key || ['survey', type, roundNumber(center.lat, 5), roundNumber(center.lon, 5), targetAltFt, type === 'orbit' ? orbit.radiusNm : `${scan.lineCount}x${scan.lineLengthNm}x${scan.lineSpacingNm}`].join(':'));
    return {
      schema: 'ga.surveyPattern.v1',
      enabled: true,
      key,
      taskDomain: 'mapping_survey',
      type,
      label: String(raw.label || (type === 'orbit' ? 'Survey-Orbit' : 'Nord-Sued-Scan')),
      targetLabel: String(raw.targetLabel || raw.targetName || 'Zielgebiet'),
      center,
      targetAltFt,
      altitudeToleranceFt,
      scan,
      orbit
    };
  }
  function setFromArray(value) {
    return new Set(Array.isArray(value) ? value.map(String).filter(Boolean) : []);
  }
  function createInitialState(spec) {
    var normalized = normalizeSpec(spec);
    if (!normalized) return null;
    return {
      schema: 'ga.surveyPatternProgress.v1',
      specKey: normalized.key,
      type: normalized.type,
      startedAt: 0,
      updatedAt: 0,
      satisfied: false,
      events: [],
      scan: {
        completedLineIds: new Set(),
        active: null,
        lastResetReason: '',
        totalLines: normalized.scan.lines.length
      },
      orbit: {
        completedTurns: 0,
        active: null,
        lastResetReason: '',
        requiredTurns: normalized.orbit.requiredTurns
      }
    };
  }
  function hydrateState(spec) {
    var _saved$updatedAt;
    var saved = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var normalized = normalizeSpec(spec);
    if (!normalized) return null;
    var state = createInitialState(normalized);
    if (!saved || typeof saved !== 'object') return state;
    state.startedAt = Number(saved.startedAt || 0);
    state.updatedAt = Number((_saved$updatedAt = saved.updatedAt) !== null && _saved$updatedAt !== void 0 ? _saved$updatedAt : 0);
    state.satisfied = !!saved.satisfied;
    if (saved.scan && typeof saved.scan === 'object') {
      state.scan.completedLineIds = setFromArray(saved.scan.completedLineIds);
      state.scan.lastResetReason = String(saved.scan.lastResetReason || '');
      state.scan.totalLines = normalized.scan.lines.length;
    }
    if (saved.orbit && typeof saved.orbit === 'object') {
      state.orbit.completedTurns = Math.max(0, Math.round(Number(saved.orbit.completedTurns || 0)));
      state.orbit.lastResetReason = String(saved.orbit.lastResetReason || '');
      state.orbit.requiredTurns = normalized.orbit.requiredTurns;
    }
    return state;
  }
  function snapshotState() {
    var _state$scan3, _state$scan4, _state$orbit2, _state$updatedAt;
    var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : activeState;
    if (!state || typeof state !== 'object') return null;
    var scanCompleted = Array.from(((_state$scan3 = state.scan) === null || _state$scan3 === void 0 ? void 0 : _state$scan3.completedLineIds) || []);
    var activeScan = ((_state$scan4 = state.scan) === null || _state$scan4 === void 0 ? void 0 : _state$scan4.active) || null;
    var activeOrbit = ((_state$orbit2 = state.orbit) === null || _state$orbit2 === void 0 ? void 0 : _state$orbit2.active) || null;
    return {
      schema: 'ga.surveyPatternProgress.v1',
      specKey: String(state.specKey || ''),
      type: String(state.type || ''),
      startedAt: Number(state.startedAt || 0),
      updatedAt: Number((_state$updatedAt = state.updatedAt) !== null && _state$updatedAt !== void 0 ? _state$updatedAt : 0),
      satisfied: !!state.satisfied,
      scan: state.scan ? {
        completedLineIds: scanCompleted,
        completedCount: scanCompleted.length,
        totalLines: Math.max(0, Number(state.scan.totalLines || 0)),
        activeLineId: (activeScan === null || activeScan === void 0 ? void 0 : activeScan.lineId) || '',
        activeCoverage: (activeScan === null || activeScan === void 0 ? void 0 : activeScan.bins) instanceof Set ? Math.round(activeScan.bins.size / Math.max(1, Number(activeScan.totalBins || 1)) * 100) / 100 : 0,
        lastResetReason: String(state.scan.lastResetReason || '')
      } : null,
      orbit: state.orbit ? {
        completedTurns: Math.max(0, Number(state.orbit.completedTurns || 0)),
        requiredTurns: Math.max(0, Number(state.orbit.requiredTurns || 0)),
        activeCoverage: (activeOrbit === null || activeOrbit === void 0 ? void 0 : activeOrbit.sectors) instanceof Set ? Math.round(activeOrbit.sectors.size / Math.max(1, Number(activeOrbit.totalSectors || 1)) * 100) / 100 : 0,
        lastResetReason: String(state.orbit.lastResetReason || '')
      } : null
    };
  }
  function sampleAltitudeOk(spec, sample) {
    var target = Number(spec.targetAltFt || 0);
    var alt = Number(sample.altFt);
    if (!(target > 0) || !Number.isFinite(alt)) return true;
    return Math.abs(alt - target) <= Number(spec.altitudeToleranceFt || DEFAULTS.altitudeToleranceFt);
  }
  function sampleSpeedOk(minGroundSpeedKts, sample) {
    var gs = Number(sample.gsKts);
    if (!Number.isFinite(gs) || gs <= 0) return true;
    return gs >= Number(minGroundSpeedKts || 0);
  }
  function headingMatchesLine(spec, projection, sample) {
    var hdg = Number(sample.headingDeg);
    if (!Number.isFinite(hdg)) return true;
    var tol = Number(spec.scan.headingToleranceDeg || DEFAULTS.scan.headingToleranceDeg);
    var b = Number(projection.bearingDeg || 180);
    return Math.min(angleDiffAbs(hdg, b), angleDiffAbs(hdg, (b + 180) % 360)) <= tol;
  }
  function sampleFromInput() {
    var _ref2, _ref3, _ref4, _ref5, _input$altFt, _ref6, _ref7, _ref8, _ref9, _input$headingDeg, _ref0, _ref1, _ref10, _input$gsKts, _input$nowMs;
    var input = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var flightData = input.flightData || {};
    var gps = host.lastLiveGpsPos || {};
    return {
      lat: Number(input.lat),
      lon: Number(input.lon),
      altFt: Number((_ref2 = (_ref3 = (_ref4 = (_ref5 = (_input$altFt = input.altFt) !== null && _input$altFt !== void 0 ? _input$altFt : flightData.mslFt) !== null && _ref5 !== void 0 ? _ref5 : flightData.altFt) !== null && _ref4 !== void 0 ? _ref4 : flightData.altitudeFt) !== null && _ref3 !== void 0 ? _ref3 : gps.mslFt) !== null && _ref2 !== void 0 ? _ref2 : gps.altFt),
      headingDeg: Number((_ref6 = (_ref7 = (_ref8 = (_ref9 = (_input$headingDeg = input.headingDeg) !== null && _input$headingDeg !== void 0 ? _input$headingDeg : flightData.hdg) !== null && _ref9 !== void 0 ? _ref9 : flightData.heading) !== null && _ref8 !== void 0 ? _ref8 : flightData.trackDeg) !== null && _ref7 !== void 0 ? _ref7 : flightData.trkDeg) !== null && _ref6 !== void 0 ? _ref6 : gps.hdg),
      gsKts: Number((_ref0 = (_ref1 = (_ref10 = (_input$gsKts = input.gsKts) !== null && _input$gsKts !== void 0 ? _input$gsKts : flightData.gs) !== null && _ref10 !== void 0 ? _ref10 : flightData.gsKts) !== null && _ref1 !== void 0 ? _ref1 : flightData.groundSpeed) !== null && _ref0 !== void 0 ? _ref0 : gps.gs),
      nowMs: Number((_input$nowMs = input.nowMs) !== null && _input$nowMs !== void 0 ? _input$nowMs : Date.now())
    };
  }
  function findLineCandidate(spec, state, sample) {
    var completed = state.scan.completedLineIds || new Set();
    var best = null;
    var _iterator = _createForOfIteratorHelper(spec.scan.lines),
      _step;
    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var line = _step.value;
        if (!line || completed.has(String(line.id))) continue;
        var projection = projectPointToLineNm(sample.lat, sample.lon, line);
        if (!projection) continue;
        var withinSegment = projection.t >= -0.08 && projection.t <= 1.08;
        if (!withinSegment) continue;
        var cross = Number(projection.crossTrackNm);
        if (!Number.isFinite(cross)) continue;
        if (!best || cross < best.projection.crossTrackNm) {
          best = {
            line,
            projection
          };
        }
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }
    return best;
  }
  function makeScanResetEvent(reason, lineId) {
    return {
      type: reason === 'altitude' ? 'line_reset_altitude' : 'line_reset_offtrack',
      lineId: String(lineId || ''),
      reason
    };
  }
  function sampleInsideScanArea(spec, sample) {
    if (!(spec !== null && spec !== void 0 && spec.scan) || !Number.isFinite(Number(sample === null || sample === void 0 ? void 0 : sample.lat)) || !Number.isFinite(Number(sample === null || sample === void 0 ? void 0 : sample.lon))) return false;
    var p = localPointNm(sample.lat, sample.lon, spec.center.lat, spec.center.lon);
    var halfLength = Number(spec.scan.lineLengthNm || DEFAULTS.scan.lineLengthNm) / 2 + 0.25;
    var halfWidth = (Math.max(1, Number(spec.scan.lineCount || 1)) - 1) * Number(spec.scan.lineSpacingNm || DEFAULTS.scan.lineSpacingNm) / 2 + 0.25;
    return Math.abs(p.y) <= halfLength && Math.abs(p.x) <= halfWidth;
  }
  function tickScanState(spec, state, sample, events) {
    var _sample$nowMs;
    var now = Number((_sample$nowMs = sample.nowMs) !== null && _sample$nowMs !== void 0 ? _sample$nowMs : Date.now());
    if (!Number.isFinite(sample.lat) || !Number.isFinite(sample.lon)) return;
    if (!state.startedAt && sampleInsideScanArea(spec, sample)) {
      state.startedAt = now;
      events.push({
        type: 'survey_area_entered',
        mode: 'scan'
      });
    }
    var altOk = sampleAltitudeOk(spec, sample);
    var speedOk = sampleSpeedOk(spec.scan.minGroundSpeedKts, sample);
    var candidate = findLineCandidate(spec, state, sample);
    var validCandidate = !!(candidate && candidate.projection.crossTrackNm <= spec.scan.crossTrackToleranceNm && altOk && speedOk && headingMatchesLine(spec, candidate.projection, sample));
    var active = state.scan.active;
    if (!active && validCandidate) {
      var _t = clamp(candidate.projection.t, 0, 1);
      var edge = Number(spec.scan.startEndTolerance || DEFAULTS.scan.startEndTolerance);
      if (_t <= edge || _t >= 1 - edge) {
        active = {
          lineId: String(candidate.line.id),
          direction: _t <= 0.5 ? 'forward' : 'reverse',
          bins: new Set(),
          totalBins: spec.scan.bins,
          startedAt: now,
          lastGoodAt: now,
          badSince: 0,
          lastT: _t,
          endCap: false
        };
        state.scan.active = active;
        if (!state.startedAt) state.startedAt = now;
        events.push({
          type: 'line_started',
          lineId: active.lineId
        });
      }
    }
    active = state.scan.active;
    if (!active) return;
    var sameLine = validCandidate && String(candidate.line.id) === String(active.lineId);
    var badReason = !altOk ? 'altitude' : !speedOk || !sameLine ? 'offtrack' : '';
    if (!sameLine || !altOk || !speedOk) {
      if (!active.badSince) active.badSince = now;
      var graceMs = Number(spec.scan.resetGraceSec || DEFAULTS.scan.resetGraceSec) * 1000;
      if (now - active.badSince >= graceMs) {
        var resetReason = badReason || 'offtrack';
        state.scan.lastResetReason = resetReason;
        events.push(makeScanResetEvent(resetReason, active.lineId));
        state.scan.active = null;
      }
      return;
    }
    var t = clamp(candidate.projection.t, 0, 1);
    var movedBack = active.direction === 'forward' ? t < Number(active.lastT || 0) - 0.22 : t > Number(active.lastT || 1) + 0.22;
    if (movedBack) {
      state.scan.lastResetReason = 'offtrack';
      events.push(makeScanResetEvent('offtrack', active.lineId));
      state.scan.active = null;
      return;
    }
    active.badSince = 0;
    active.lastGoodAt = now;
    active.lastT = t;
    var bin = Math.min(spec.scan.bins - 1, Math.max(0, Math.floor(clamp(t, 0, 0.999) * spec.scan.bins)));
    active.bins.add(bin);
    if (active.direction === 'forward' && t >= 1 - spec.scan.startEndTolerance || active.direction === 'reverse' && t <= spec.scan.startEndTolerance) {
      active.endCap = true;
    }
    var coverage = active.bins.size / Math.max(1, Number(active.totalBins || spec.scan.bins));
    if (active.endCap && coverage >= spec.scan.minCoverage) {
      state.scan.completedLineIds.add(String(active.lineId));
      events.push({
        type: 'line_complete',
        lineId: active.lineId,
        completedCount: state.scan.completedLineIds.size,
        totalLines: spec.scan.lines.length
      });
      state.scan.active = null;
      if (state.scan.completedLineIds.size >= spec.scan.lines.length) {
        state.satisfied = true;
        events.push({
          type: 'survey_complete',
          mode: 'scan'
        });
      }
    }
  }
  function makeOrbitResetEvent(reason) {
    return {
      type: reason === 'altitude' ? 'orbit_reset_altitude' : 'orbit_reset_offtrack',
      reason
    };
  }
  function tickOrbitState(spec, state, sample, events) {
    var _sample$nowMs2, _active$startedAt;
    var now = Number((_sample$nowMs2 = sample.nowMs) !== null && _sample$nowMs2 !== void 0 ? _sample$nowMs2 : Date.now());
    if (!Number.isFinite(sample.lat) || !Number.isFinite(sample.lon)) return;
    var altOk = sampleAltitudeOk(spec, sample);
    var speedOk = sampleSpeedOk(spec.orbit.minGroundSpeedKts, sample);
    var distNm = haversineNm(spec.center.lat, spec.center.lon, sample.lat, sample.lon);
    var radialOk = Math.abs(distNm - spec.orbit.radiusNm) <= spec.orbit.radialToleranceNm;
    if (!state.startedAt && distNm <= spec.orbit.radiusNm + spec.orbit.radialToleranceNm) {
      state.startedAt = now;
      events.push({
        type: 'survey_area_entered',
        mode: 'orbit'
      });
    }
    var valid = altOk && speedOk && radialOk;
    var active = state.orbit.active;
    if (!active && valid) {
      active = {
        sectors: new Set(),
        totalSectors: spec.orbit.sectorsPerTurn,
        startedAt: now,
        lastGoodAt: now,
        badSince: 0,
        lastAngle: bearingDeg(spec.center.lat, spec.center.lon, sample.lat, sample.lon),
        direction: 0
      };
      state.orbit.active = active;
      if (!state.startedAt) state.startedAt = now;
      events.push({
        type: 'orbit_started'
      });
    }
    active = state.orbit.active;
    if (!active) return;
    if (!valid) {
      if (!active.badSince) active.badSince = now;
      var graceMs = Number(spec.orbit.resetGraceSec || DEFAULTS.orbit.resetGraceSec) * 1000;
      if (now - active.badSince >= graceMs) {
        var reason = !altOk ? 'altitude' : 'offtrack';
        state.orbit.lastResetReason = reason;
        events.push(makeOrbitResetEvent(reason));
        state.orbit.active = null;
      }
      return;
    }
    active.badSince = 0;
    active.lastGoodAt = now;
    var angle = bearingDeg(spec.center.lat, spec.center.lon, sample.lat, sample.lon);
    var delta = signedAngleDelta(active.lastAngle, angle);
    if (!active.direction && Math.abs(delta) > 2) active.direction = delta > 0 ? 1 : -1;
    if (active.direction && delta * active.direction < -18) {
      state.orbit.lastResetReason = 'offtrack';
      events.push(makeOrbitResetEvent('offtrack'));
      state.orbit.active = null;
      return;
    }
    active.lastAngle = angle;
    var sector = Math.min(spec.orbit.sectorsPerTurn - 1, Math.max(0, Math.floor(angle / 360 * spec.orbit.sectorsPerTurn)));
    active.sectors.add(sector);
    var coverage = active.sectors.size / Math.max(1, Number(active.totalSectors || spec.orbit.sectorsPerTurn));
    var elapsedSec = (now - Number((_active$startedAt = active.startedAt) !== null && _active$startedAt !== void 0 ? _active$startedAt : now)) / 1000;
    if (coverage >= spec.orbit.minTurnCoverage && elapsedSec >= spec.orbit.minTurnSec) {
      state.orbit.completedTurns += 1;
      events.push({
        type: 'orbit_turn_complete',
        completedTurns: state.orbit.completedTurns,
        requiredTurns: spec.orbit.requiredTurns
      });
      state.orbit.active = null;
      if (state.orbit.completedTurns >= spec.orbit.requiredTurns) {
        state.satisfied = true;
        events.push({
          type: 'survey_complete',
          mode: 'orbit'
        });
      }
    }
  }
  function tickState(specRaw, stateRaw, sampleRaw) {
    var _sample$nowMs3;
    var spec = normalizeSpec(specRaw);
    if (!spec) return {
      handled: false,
      state: stateRaw || null,
      events: [],
      satisfied: false,
      progress: null
    };
    var state = stateRaw || createInitialState(spec);
    if (state.specKey !== spec.key) {
      return tickState(spec, createInitialState(spec), sampleRaw);
    }
    if (state.satisfied) {
      return {
        handled: true,
        state,
        events: [],
        satisfied: true,
        progress: snapshotState(state)
      };
    }
    var sample = sampleRaw !== null && sampleRaw !== void 0 && sampleRaw.flightData ? sampleFromInput(sampleRaw) : sampleRaw;
    var events = [];
    if (spec.type === 'orbit') tickOrbitState(spec, state, sample, events);else tickScanState(spec, state, sample, events);
    state.updatedAt = Number((_sample$nowMs3 = sample === null || sample === void 0 ? void 0 : sample.nowMs) !== null && _sample$nowMs3 !== void 0 ? _sample$nowMs3 : Date.now());
    state.events = events;
    return {
      handled: true,
      state,
      events,
      satisfied: !!state.satisfied,
      progress: snapshotState(state)
    };
  }
  function getMissionSpec() {
    var missionData = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var passenger = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var md = missionData || activeMissionDataFromHost();
    var contract = (md === null || md === void 0 ? void 0 : md.missionContract) || host.activeMissionContract || null;
    var raw = (md === null || md === void 0 ? void 0 : md.surveyPattern) || (contract === null || contract === void 0 ? void 0 : contract.surveyPattern) || (passenger === null || passenger === void 0 ? void 0 : passenger.surveyPattern) || null;
    if (!raw && typeof host.attachMissionSurveyPattern === 'function' && md) {
      try {
        host.attachMissionSurveyPattern(md, contract, passenger || (md === null || md === void 0 ? void 0 : md.passenger) || host.activePassenger || null);
        raw = (md === null || md === void 0 ? void 0 : md.surveyPattern) || (contract === null || contract === void 0 ? void 0 : contract.surveyPattern) || (passenger === null || passenger === void 0 ? void 0 : passenger.surveyPattern) || null;
      } catch (_) {}
    }
    return normalizeSpec(raw);
  }
  function getMapInstance() {
    try {
      if (typeof map !== 'undefined' && map) return map;
    } catch (_) {}
    return host.map || null;
  }
  function ensureOverlayLayer() {
    var mapInstance = getMapInstance();
    if (!mapInstance || typeof L === 'undefined') return null;
    if (!overlayLayer) overlayLayer = L.layerGroup();
    if (!mapInstance.hasLayer(overlayLayer)) overlayLayer.addTo(mapInstance);
    return overlayLayer;
  }
  function clearOverlay() {
    var mapInstance = getMapInstance();
    if (overlayLayer && mapInstance) {
      try {
        mapInstance.removeLayer(overlayLayer);
      } catch (_) {}
    }
    overlayLayer = null;
    lastOverlayVisualKey = '';
  }
  function lineStyleFor(lineId, state) {
    var _state$scan5, _state$scan6;
    var completed = (state === null || state === void 0 || (_state$scan5 = state.scan) === null || _state$scan5 === void 0 ? void 0 : _state$scan5.completedLineIds) instanceof Set && state.scan.completedLineIds.has(String(lineId));
    var active = String((state === null || state === void 0 || (_state$scan6 = state.scan) === null || _state$scan6 === void 0 || (_state$scan6 = _state$scan6.active) === null || _state$scan6 === void 0 ? void 0 : _state$scan6.lineId) || '') === String(lineId);
    if (completed) return {
      color: '#2fd46f',
      weight: 7,
      opacity: 0.96,
      dashArray: null
    };
    if (active) return {
      color: '#f2c94c',
      weight: 7,
      opacity: 0.96,
      dashArray: null
    };
    return {
      color: '#ff4d4d',
      weight: 6,
      opacity: 0.9,
      dashArray: null
    };
  }
  function connectorStyleFor() {
    return {
      color: '#ff6b57',
      weight: 5,
      opacity: 0.72,
      dashArray: null,
      interactive: false
    };
  }
  function scanConnectorArc(lineA, lineB, center) {
    var end = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 'south';
    var aPt = end === 'north' ? lineA.start : lineA.end;
    var bPt = end === 'north' ? lineB.start : lineB.end;
    if (!aPt || !bPt) return [];
    var a = localPointNm(aPt.lat, aPt.lon, center.lat, center.lon);
    var b = localPointNm(bPt.lat, bPt.lon, center.lat, center.lon);
    var cx = (a.x + b.x) / 2;
    var cy = (a.y + b.y) / 2;
    var rx = Math.abs(b.x - a.x) / 2;
    if (!(rx > 0.01)) return [[aPt.lat, aPt.lon], [bPt.lat, bPt.lon]];
    var bulgeSign = end === 'north' ? 1 : -1;
    var leftToRight = a.x <= b.x;
    var points = [];
    var steps = 14;
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      var x = leftToRight ? a.x + (b.x - a.x) * t : a.x - (a.x - b.x) * t;
      var yOffset = Math.sqrt(Math.max(0, rx * rx - (x - cx) * (x - cx))) * bulgeSign;
      var ll = localPointToLatLonNm({
        x,
        y: cy + yOffset
      }, center);
      if (ll) points.push([ll.lat, ll.lon]);
    }
    return points;
  }
  function drawScanConnectors(layer, spec) {
    var _spec$scan;
    var lines = Array.isArray(spec === null || spec === void 0 || (_spec$scan = spec.scan) === null || _spec$scan === void 0 ? void 0 : _spec$scan.lines) ? spec.scan.lines : [];
    if (!layer || typeof L === 'undefined' || lines.length < 2) return;
    for (var i = 0; i < lines.length - 1; i++) {
      var end = i % 2 === 0 ? 'south' : 'north';
      var points = scanConnectorArc(lines[i], lines[i + 1], spec.center, end);
      if (points.length >= 2) L.polyline(points, connectorStyleFor()).addTo(layer);
    }
  }
  function drawOverlay() {
    var specRaw = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var progressState = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : activeState;
    var spec = normalizeSpec(specRaw);
    if (!spec) {
      clearOverlay();
      return false;
    }
    var layer = ensureOverlayLayer();
    if (!layer || typeof L === 'undefined') return false;
    layer.clearLayers();
    var label = spec.targetAltFt > 0 ? `${spec.label} · ${spec.targetAltFt} ft` : spec.label;
    if (spec.type === 'orbit') {
      var _progressState$orbit;
      var done = (progressState === null || progressState === void 0 || (_progressState$orbit = progressState.orbit) === null || _progressState$orbit === void 0 ? void 0 : _progressState$orbit.completedTurns) >= spec.orbit.requiredTurns;
      L.circle([spec.center.lat, spec.center.lon], {
        radius: spec.orbit.radiusNm * NM_TO_M,
        color: done ? '#2fd46f' : '#ff4d4d',
        weight: 5,
        opacity: 0.9,
        fillColor: '#2d8cff',
        fillOpacity: 0.04,
        dashArray: done ? null : '14,9'
      }).bindTooltip(`${label} · ${spec.orbit.requiredTurns} Kreise`, {
        permanent: false
      }).addTo(layer);
    } else {
      drawScanConnectors(layer, spec);
      var _iterator2 = _createForOfIteratorHelper(spec.scan.lines),
        _step2;
      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          var line = _step2.value;
          var style = lineStyleFor(line.id, progressState);
          L.polyline([[line.start.lat, line.start.lon], [line.end.lat, line.end.lon]], style).bindTooltip(`${line.label} · ${label}`, {
            permanent: false
          }).addTo(layer);
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }
    }
    if (spec.targetAltFt > 0) {
      L.marker([spec.center.lat, spec.center.lon], {
        icon: L.divIcon({
          className: '',
          html: `<div style="background:rgba(12,18,28,0.82);color:#fff;font-size:11px;padding:3px 7px;border-radius:4px;border:1px solid rgba(255,255,255,.35);white-space:nowrap;">Survey · ${spec.targetAltFt} ft</div>`,
          iconAnchor: [42, 4]
        }),
        interactive: false
      }).addTo(layer);
    }
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
  function tick() {
    var input = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var spec = getMissionSpec(input.missionData || null, input.passenger || null);
    if (!spec) {
      if (activeSpecKey) reset('no-active-survey');
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
    var result = tickState(spec, activeState, sampleFromInput(input));
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

  // Authority projection is presentation-only: never tick or overwrite local mission state.
  function renderAuthorityProjection(specRaw, progress) {
    var _progress$scan;
    var spec = normalizeSpec(specRaw);
    if (!spec) {
      clearOverlay();
      return false;
    }
    var state = hydrateState(spec, progress);
    if (progress !== null && progress !== void 0 && (_progress$scan = progress.scan) !== null && _progress$scan !== void 0 && _progress$scan.activeLineId) state.scan.active = {
      lineId: progress.scan.activeLineId
    };
    return renderOverlayIfNeeded(spec, state);
  }
  function refreshOverlay() {
    var _host$gaTrackerExecut, _host$gaTrackerExecut2;
    var missionData = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    var passenger = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    if (((_host$gaTrackerExecut = host.gaTrackerExecutionControl) === null || _host$gaTrackerExecut === void 0 ? void 0 : _host$gaTrackerExecut.executionAuthority) === 'tracker') return renderAuthorityProjection(host.gaTrackerExecutionControl.surveySpec, (_host$gaTrackerExecut2 = host.gaTrackerExecutionControl.poiTask) === null || _host$gaTrackerExecut2 === void 0 ? void 0 : _host$gaTrackerExecut2.surveyPattern);
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
    if (((_host$gaTrackerExecut3 = host.gaTrackerExecutionControl) === null || _host$gaTrackerExecut3 === void 0 ? void 0 : _host$gaTrackerExecut3.executionAuthority) === 'tracker') return renderAuthorityProjection(host.gaTrackerExecutionControl.surveySpec, (_host$gaTrackerExecut4 = host.gaTrackerExecutionControl.poiTask) === null || _host$gaTrackerExecut4 === void 0 ? void 0 : _host$gaTrackerExecut4.surveyPattern);
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
    getActiveSpec: getMissionSpec,
    normalizeSpec,
    tick,
    restoreProgress,
    reset,
    refreshOverlay,
    refreshActiveMissionOverlay,
    renderAuthorityProjection,
    snapshot: () => snapshotState(activeState),
    _test: {
      normalizeSpec,
      createInitialState,
      hydrateState,
      snapshotState,
      tickState,
      buildScanLines,
      destinationPoint,
      haversineNm,
      bearingDeg,
      interpolateLine,
      projectPointToLineNm,
      overlayVisualKey
    }
  };
  host.missionSurveyPattern = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleInitialOverlayRefresh, {
      once: true
    });else scheduleInitialOverlayRefresh();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
