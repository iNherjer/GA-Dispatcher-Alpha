// Generated from map-context-popup.js by sync-efb-web-assets.js. Do not edit.
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i.return) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
// Shared standalone popup implementation; host adapters supply local data only.
var MAP_CONTEXT_LONG_PRESS_MS = 650;
var MAP_CONTEXT_MOVE_TOLERANCE_PX = 12;
var MAP_CONTEXT_RELEVANT_AIRSPACE_TYPES = new Set([0, 1, 2, 3, 4, 5, 6, 7, 26, 27, 28, 33]);
var mapContextPressState = null;
var mapContextSuppressClickUntil = 0;
var mapContextLastOpen = {
  at: 0,
  lat: NaN,
  lon: NaN
};
var mapContextRequestSeq = 0;
var mapContextInfoState = null;
var mapContextPopupLayer = null;
var mapContextPointLayer = null;
var mapContextAirspaceHighlightLayer = null;
var mapContextObjectHighlightLayer = null;
function clearMapContextPress() {
  var _mapContextPressState;
  if ((_mapContextPressState = mapContextPressState) !== null && _mapContextPressState !== void 0 && _mapContextPressState.timer) clearTimeout(mapContextPressState.timer);
  mapContextPressState = null;
}
function clearMapContextPointLayer() {
  if (map && mapContextPointLayer && map.hasLayer(mapContextPointLayer)) {
    map.removeLayer(mapContextPointLayer);
  }
  mapContextPointLayer = null;
}
function clearMapContextAirspaceHighlight() {
  if (map && mapContextAirspaceHighlightLayer && map.hasLayer(mapContextAirspaceHighlightLayer)) {
    map.removeLayer(mapContextAirspaceHighlightLayer);
  }
  mapContextAirspaceHighlightLayer = null;
}
function clearMapContextObjectHighlight() {
  if (map && mapContextObjectHighlightLayer && map.hasLayer(mapContextObjectHighlightLayer)) {
    map.removeLayer(mapContextObjectHighlightLayer);
  }
  mapContextObjectHighlightLayer = null;
}
function dismissMapContextInfo() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
    _ref$closePopup = _ref.closePopup,
    closePopup = _ref$closePopup === void 0 ? false : _ref$closePopup,
    _ref$clearHighlight = _ref.clearHighlight,
    clearHighlight = _ref$clearHighlight === void 0 ? true : _ref$clearHighlight;
  mapContextRequestSeq += 1;
  mapContextInfoState = null;
  clearMapContextPress();
  clearMapContextPointLayer();
  if (clearHighlight) {
    clearMapContextAirspaceHighlight();
    clearMapContextObjectHighlight();
  }
  if (closePopup && map && mapContextPopupLayer) {
    map.closePopup(mapContextPopupLayer);
  }
}
function mapContextPointInRing(lat, lon, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  var inside = false;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    var _ring$i, _ring$i2, _ring$j, _ring$j2;
    var xi = Number((_ring$i = ring[i]) === null || _ring$i === void 0 ? void 0 : _ring$i[0]);
    var yi = Number((_ring$i2 = ring[i]) === null || _ring$i2 === void 0 ? void 0 : _ring$i2[1]);
    var xj = Number((_ring$j = ring[j]) === null || _ring$j === void 0 ? void 0 : _ring$j[0]);
    var yj = Number((_ring$j2 = ring[j]) === null || _ring$j2 === void 0 ? void 0 : _ring$j2[1]);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    var crosses = yi > lat !== yj > lat && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}
function mapContextPointInPolygon(lat, lon, rings) {
  if (!Array.isArray(rings) || !mapContextPointInRing(lat, lon, rings[0])) return false;
  for (var i = 1; i < rings.length; i += 1) {
    if (mapContextPointInRing(lat, lon, rings[i])) return false;
  }
  return true;
}
function mapContextPointInAirspace(airspace, lat, lon) {
  var geometry = airspace === null || airspace === void 0 ? void 0 : airspace.geometry;
  if (!geometry) return false;
  if (geometry.type === 'Polygon') {
    return mapContextPointInPolygon(lat, lon, geometry.coordinates);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some(rings => mapContextPointInPolygon(lat, lon, rings));
  }
  return false;
}
function getMapContextAirspaceId(airspace) {
  var _airspace$type;
  var fallbackIndex = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  return String((airspace === null || airspace === void 0 ? void 0 : airspace._id) || (airspace === null || airspace === void 0 ? void 0 : airspace.id) || `${(airspace === null || airspace === void 0 ? void 0 : airspace.name) || 'airspace'}:${(_airspace$type = airspace === null || airspace === void 0 ? void 0 : airspace.type) !== null && _airspace$type !== void 0 ? _airspace$type : 'x'}:${fallbackIndex}`);
}
function mapContextAirspaceStyle(airspace) {
  if (typeof getAirspaceStyle === 'function') {
    try {
      var style = getAirspaceStyle(airspace);
      if (style) {
        var currentColor = String(style.mapColor || style.color || '').toLowerCase();
        var _type = Number(airspace === null || airspace === void 0 ? void 0 : airspace.type);
        var grayPalette = new Set(['#888', '#888888', '#aaa', '#aaaaaa', '#94a3b8']);
        if (grayPalette.has(currentColor)) {
          var contextualColor = _type === 33 ? '#22a65a' : _type === 0 || _type === 4 ? '#3b82f6' : '#64748b';
          return _objectSpread(_objectSpread({}, style), {}, {
            color: contextualColor,
            mapColor: contextualColor
          });
        }
        return style;
      }
    } catch (_) {}
  }
  var type = Number(airspace === null || airspace === void 0 ? void 0 : airspace.type);
  if (type === 33) return {
    color: '#22a65a',
    mapColor: '#22a65a',
    icon: '📡',
    category: 'FIS'
  };
  if (type === 3) return {
    color: '#ef4444',
    mapColor: '#ef4444',
    icon: '⛔',
    category: 'Prohibited'
  };
  if (type === 1 || type === 2) return {
    color: '#f97316',
    mapColor: '#f97316',
    icon: '⛔',
    category: 'Restricted / Danger'
  };
  if (type === 4 || type === 0) return {
    color: '#3b82f6',
    mapColor: '#3b82f6',
    icon: '⚠️',
    category: 'CTR / Airspace'
  };
  if (type === 7 || type === 26) return {
    color: '#0ea5e9',
    mapColor: '#0ea5e9',
    icon: '⚠️',
    category: 'TMA / CTA'
  };
  if (type === 5 || type === 27) return {
    color: '#a855f7',
    mapColor: '#a855f7',
    icon: '📡',
    category: 'TMZ'
  };
  if (type === 6 || type === 28) return {
    color: '#22d3ee',
    mapColor: '#22d3ee',
    icon: '📡',
    category: 'RMZ'
  };
  return {
    color: '#94a3b8',
    mapColor: '#94a3b8',
    icon: '◈',
    category: 'Luftraum'
  };
}
function getMapContextAirspaceDescriptor(airspace) {
  var type = Number(airspace === null || airspace === void 0 ? void 0 : airspace.type);
  var rawClass = airspace === null || airspace === void 0 ? void 0 : airspace.icaoClass;
  var classIndex = rawClass === null || rawClass === undefined || rawClass === '' ? NaN : Number(rawClass);
  var classWords = ['ALPHA', 'BRAVO', 'CHARLY', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF'];
  var classWord = Number.isInteger(classIndex) ? classWords[classIndex] || '' : '';
  var classLetter = Number.isInteger(classIndex) && classIndex >= 0 && classIndex <= 6 ? 'ABCDEFG'[classIndex] : '';
  if (type === 1) return 'ED-R';
  if (type === 2) return 'ED-D';
  if (type === 3) return 'ED-P';
  if (type === 4) return ['CTR', classLetter].filter(Boolean).join(' ');
  if (type === 7) return ['TMA', classWord].filter(Boolean).join(' ');
  if (type === 26) return ['CTA', classWord].filter(Boolean).join(' ');
  if (type === 5 || type === 27) return 'TMZ';
  if (type === 6 || type === 28) return 'RMZ';
  if (type === 33) return 'FIS';
  return classWord || 'LUFTRAUM';
}
function getMapContextAirspaceDisplayTitle(airspace) {
  var descriptor = getMapContextAirspaceDescriptor(airspace);
  var rawName = String((airspace === null || airspace === void 0 ? void 0 : airspace.name) || '').trim();
  if (!rawName) return descriptor;
  var typeToken = descriptor.split(/\s+/)[0];
  var typePrefix = new RegExp(`^${typeToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s·:_-]*`, 'i');
  var cleanedName = rawName.replace(typePrefix, '').trim();
  return cleanedName ? `${descriptor} · ${cleanedName}` : descriptor;
}
function isMapContextGenericEchoArea(airspace) {
  var rawName = String((airspace === null || airspace === void 0 ? void 0 : airspace.name) || '').trim();
  return Number(airspace === null || airspace === void 0 ? void 0 : airspace.type) === 0 && Number(airspace === null || airspace === void 0 ? void 0 : airspace.icaoClass) === 4 && /^(?:ECHO[\s·:_-]*)?AREA$/i.test(rawName);
}
function getMapContextAirspaceClassLetter(airspace) {
  var rawClass = airspace === null || airspace === void 0 ? void 0 : airspace.icaoClass;
  if (rawClass === null || rawClass === undefined || rawClass === '') return '';
  var classIndex = Number(rawClass);
  return Number.isInteger(classIndex) && classIndex >= 0 && classIndex <= 6 ? 'ABCDEFG'[classIndex] : '';
}
function mapContextFormatLimit(limit) {
  if (!limit) return '?';
  if (typeof window.formatAsLimit === 'function') {
    try {
      return window.formatAsLimit(limit);
    } catch (_) {}
  }
  var value = Number(limit.value);
  if (limit.referenceDatum === 0 && value === 0) return 'GND';
  if (Number(limit.unit) === 6) return `FL ${value}`;
  var unit = Number(limit.unit) === 1 ? 'FT' : 'M';
  var datum = limit.referenceDatum === 1 ? ' MSL' : limit.referenceDatum === 0 ? ' AGL' : '';
  return `${value} ${unit}${datum}`;
}
function mapContextLimitToFt(limit) {
  if (!limit) return Infinity;
  var value = Number(limit.value);
  if (!Number.isFinite(value)) return Infinity;
  if (Number(limit.unit) === 6) return value * 100;
  if (Number(limit.unit) === 0) return value * 3.28084;
  return value;
}
function mapContextAirspaceFrequencyText(airspace) {
  var frequencies = Array.isArray(airspace === null || airspace === void 0 ? void 0 : airspace.frequencies) ? airspace.frequencies : [];
  var values = frequencies.filter(item => item && item.value !== undefined && item.value !== null && item.value !== '').map(item => {
    var name = String(item.name || item.label || 'Frequenz').trim();
    var unitCode = Number(item.unit);
    var unit = unitCode === 1 ? ' kHz' : unitCode === 2 ? ' MHz' : '';
    return {
      label: abbreviateMapFrequencyLabel(name),
      value: `${item.value}${unit}`
    };
  });
  return values.filter((item, index, items) => items.findIndex(candidate => candidate.label === item.label && candidate.value === item.value) === index).slice(0, 3);
}
function mapContextAirspaceActivationText(airspace) {
  var candidates = [airspace === null || airspace === void 0 ? void 0 : airspace.hoursOfOperation, airspace === null || airspace === void 0 ? void 0 : airspace.operatingHours, airspace === null || airspace === void 0 ? void 0 : airspace.activation, airspace === null || airspace === void 0 ? void 0 : airspace.activity];
  var explicit = candidates.find(value => typeof value === 'string' && value.trim());
  if (explicit) return explicit.trim();
  if ((airspace === null || airspace === void 0 ? void 0 : airspace.byNotam) === true) return 'Aktivierung per NOTAM';
  if (/\bHX\b/i.test(String((airspace === null || airspace === void 0 ? void 0 : airspace.name) || ''))) return 'HX – Aktivierung in AIP/NOTAM prüfen';
  return '';
}
function normalizeMapContextAirspaces(items, latlng) {
  var byId = new Map();
  (Array.isArray(items) ? items : []).forEach((airspace, index) => {
    if (!(airspace !== null && airspace !== void 0 && airspace.geometry) || !MAP_CONTEXT_RELEVANT_AIRSPACE_TYPES.has(Number(airspace.type))) return;
    if (isMapContextGenericEchoArea(airspace)) return;
    if (!mapContextPointInAirspace(airspace, latlng.lat, latlng.lng)) return;
    var normalized = _objectSpread(_objectSpread({}, airspace), {}, {
      lowerLimit: airspace.lowerLimit ? _objectSpread({}, airspace.lowerLimit) : null,
      upperLimit: airspace.upperLimit ? _objectSpread({}, airspace.upperLimit) : null
    });
    if (typeof applyAirspaceLimitHeuristics === 'function') {
      try {
        applyAirspaceLimitHeuristics(normalized);
      } catch (_) {}
    }
    var id = getMapContextAirspaceId(normalized, index);
    if (!byId.has(id)) {
      normalized.__mapContextId = id;
      byId.set(id, normalized);
    }
  });
  return _toConsumableArray(byId.values()).sort((a, b) => {
    var lowerDelta = mapContextLimitToFt(a.lowerLimit) - mapContextLimitToFt(b.lowerLimit);
    if (Number.isFinite(lowerDelta) && lowerDelta !== 0) return lowerDelta;
    return String(a.name || '').localeCompare(String(b.name || ''), 'de');
  });
}
function getMapContextQueryBounds(latlng) {
  var latPad = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0.025;
  var lonPad = latPad / Math.max(0.25, Math.cos(latlng.lat * Math.PI / 180));
  return {
    west: Math.max(-180, latlng.lng - lonPad),
    south: Math.max(-90, latlng.lat - latPad),
    east: Math.min(180, latlng.lng + lonPad),
    north: Math.min(90, latlng.lat + latPad)
  };
}
function fetchMapContextAirspaces(_x) {
  return _fetchMapContextAirspaces.apply(this, arguments);
}
function _fetchMapContextAirspaces() {
  _fetchMapContextAirspaces = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(latlng) {
    var bounds, items;
    return _regenerator().w(function (_context) {
      while (1) switch (_context.n) {
        case 0:
          bounds = getMapContextQueryBounds(latlng);
          items = null;
          if (!(!window.gaMapContextHost && typeof openAipRegionState !== 'undefined' && openAipRegionState.payload && openAipCoverageContainsBounds(openAipRegionState.coverage, bounds) && isOpenAipSnapshotCollectionAvailable(typeof openAipRegionState !== 'undefined' && openAipRegionState.payload, 'airspaces'))) {
            _context.n = 1;
            break;
          }
          items = (typeof openAipRegionState !== 'undefined' && openAipRegionState.payload).airspaces;
          _context.n = 3;
          break;
        case 1:
          if (!(typeof window.gaGetAviationCollectionForBounds === 'function')) {
            _context.n = 3;
            break;
          }
          _context.n = 2;
          return window.gaGetAviationCollectionForBounds('airspaces', bounds);
        case 2:
          items = _context.v;
        case 3:
          return _context.a(2, normalizeMapContextAirspaces(items, latlng));
      }
    }, _callee);
  }));
  return _fetchMapContextAirspaces.apply(this, arguments);
}
function mapContextElevationToFt(elevation) {
  var _elevation$value;
  if (elevation == null) return null;
  var value = Number((_elevation$value = elevation === null || elevation === void 0 ? void 0 : elevation.value) !== null && _elevation$value !== void 0 ? _elevation$value : elevation);
  if (!Number.isFinite(value)) return null;
  return Number(elevation === null || elevation === void 0 ? void 0 : elevation.unit) === 1 ? value : value * 3.28084;
}
function getMapContextAirportFrequencies(airport, icao) {
  var _freqCache;
  var direct = Array.isArray(airport === null || airport === void 0 ? void 0 : airport.frequencies) ? airport.frequencies : [];
  var cached = typeof freqCache !== 'undefined' && Array.isArray((_freqCache = freqCache) === null || _freqCache === void 0 ? void 0 : _freqCache[icao]) ? freqCache[icao] : [];
  return [].concat(_toConsumableArray(direct), _toConsumableArray(cached)).map(entry => {
    var _entry$value;
    if (entry === null || entry === undefined) return '';
    if (typeof entry !== 'object') return String(entry).trim();
    var name = String(entry.name || entry.label || 'Freq').trim();
    var value = String((_entry$value = entry.value) !== null && _entry$value !== void 0 ? _entry$value : '').trim();
    if (!value) return '';
    var unitCode = Number(entry.unit);
    var unit = unitCode === 1 ? ' kHz' : unitCode === 2 ? ' MHz' : '';
    return `${abbreviateMapFrequencyLabel(name)}: ${value}${unit}`;
  }).filter(Boolean).filter((value, index, values) => values.indexOf(value) === index).slice(0, 4);
}
function normalizeMapContextAirportFeature(airport) {
  var _raw$geometry, _ref2, _raw$lat, _ref3, _ref4, _ref5, _raw$lon, _raw$elevation;
  if (!airport) return null;
  var raw = airport !== null && airport !== void 0 && airport.airportData && typeof airport.airportData === 'object' ? airport.airportData : airport;
  var coords = raw === null || raw === void 0 || (_raw$geometry = raw.geometry) === null || _raw$geometry === void 0 ? void 0 : _raw$geometry.coordinates;
  var lat = Number((_ref2 = (_raw$lat = raw === null || raw === void 0 ? void 0 : raw.lat) !== null && _raw$lat !== void 0 ? _raw$lat : airport === null || airport === void 0 ? void 0 : airport.lat) !== null && _ref2 !== void 0 ? _ref2 : coords === null || coords === void 0 ? void 0 : coords[1]);
  var lon = Number((_ref3 = (_ref4 = (_ref5 = (_raw$lon = raw === null || raw === void 0 ? void 0 : raw.lon) !== null && _raw$lon !== void 0 ? _raw$lon : raw === null || raw === void 0 ? void 0 : raw.lng) !== null && _ref5 !== void 0 ? _ref5 : airport === null || airport === void 0 ? void 0 : airport.lon) !== null && _ref4 !== void 0 ? _ref4 : airport === null || airport === void 0 ? void 0 : airport.lng) !== null && _ref3 !== void 0 ? _ref3 : coords === null || coords === void 0 ? void 0 : coords[0]);
  if (![lat, lon].every(Number.isFinite)) return null;
  var icao = String((raw === null || raw === void 0 ? void 0 : raw.icaoCode) || (raw === null || raw === void 0 ? void 0 : raw.icao) || (raw === null || raw === void 0 ? void 0 : raw.designator) || (airport === null || airport === void 0 ? void 0 : airport.icao) || (airport === null || airport === void 0 ? void 0 : airport.airportIcao) || '').trim().toUpperCase();
  var name = String((raw === null || raw === void 0 ? void 0 : raw.name) || (airport === null || airport === void 0 ? void 0 : airport.name) || (airport === null || airport === void 0 ? void 0 : airport.airportName) || icao || 'Flugplatz').trim();
  var sourceId = String((raw === null || raw === void 0 ? void 0 : raw._id) || (raw === null || raw === void 0 ? void 0 : raw.id) || (airport === null || airport === void 0 ? void 0 : airport.sourceId) || '').trim();
  var country = String((raw === null || raw === void 0 ? void 0 : raw.country) || (raw === null || raw === void 0 ? void 0 : raw.countryCode) || (raw === null || raw === void 0 ? void 0 : raw.isoCountry) || (airport === null || airport === void 0 ? void 0 : airport.country) || '').trim().toUpperCase();
  var elevationFt = mapContextElevationToFt((_raw$elevation = raw === null || raw === void 0 ? void 0 : raw.elevation) !== null && _raw$elevation !== void 0 ? _raw$elevation : airport === null || airport === void 0 ? void 0 : airport.elevation);
  var runways = typeof formatOpenAipAirportRunways === 'function' ? formatOpenAipAirportRunways(raw) : '';
  if (!runways && icao && typeof runwayCache !== 'undefined') {
    var _runwayCache;
    var cached = String(((_runwayCache = runwayCache) === null || _runwayCache === void 0 ? void 0 : _runwayCache[icao]) || '').trim();
    if (cached && cached !== 'Keine Daten gefunden') runways = cached;
  }
  return {
    id: `airport:${sourceId || icao || `${lat.toFixed(5)},${lon.toFixed(5)}`}`,
    kind: 'airport',
    sourceId,
    icao,
    name,
    country,
    lat,
    lon,
    elevationFt: Number.isFinite(elevationFt) ? Math.round(elevationFt) : null,
    frequencies: getMapContextAirportFrequencies(raw, icao),
    runways: String(runways || '').split(/\s*(?:\||\n|<br\s*\/?>)\s*/i).filter(Boolean).slice(0, 3)
  };
}
function normalizeMapContextNavaidFeature(navaid) {
  var nav = typeof normalizeOpenAipNavaidForPopup === 'function' ? normalizeOpenAipNavaidForPopup(navaid) : null;
  if (!nav) return null;
  var raw = navaid !== null && navaid !== void 0 && navaid.navaidData && typeof navaid.navaidData === 'object' ? navaid.navaidData : navaid;
  var elevationFt = mapContextElevationToFt(raw === null || raw === void 0 ? void 0 : raw.elevation);
  return {
    id: `navaid:${nav.id || `${nav.lat.toFixed(5)},${nav.lon.toFixed(5)}`}`,
    kind: 'navaid',
    sourceId: nav.id,
    identifier: nav.identifier,
    name: nav.name,
    typeLabel: getOpenAipNavaidTypeLabel(nav.type),
    lat: nav.lat,
    lon: nav.lon,
    elevationFt: Number.isFinite(elevationFt) ? Math.round(elevationFt) : null,
    frequencies: nav.frequencyValue ? [`${nav.frequencyValue}${nav.frequencyUnit ? ` ${nav.frequencyUnit}` : ''}`] : [],
    channel: nav.channel,
    range: nav.rangeValue ? `${nav.rangeValue}${nav.rangeUnit ? ` ${nav.rangeUnit}` : ''}` : ''
  };
}
function normalizeMapContextReportingPointFeature(point) {
  var _raw$geometry2, _ref6, _raw$lat2, _ref7, _ref8, _ref9, _raw$lon2;
  if (!point) return null;
  var raw = point !== null && point !== void 0 && point.rppData && typeof point.rppData === 'object' ? point.rppData : point;
  var coords = raw === null || raw === void 0 || (_raw$geometry2 = raw.geometry) === null || _raw$geometry2 === void 0 ? void 0 : _raw$geometry2.coordinates;
  var lat = Number((_ref6 = (_raw$lat2 = raw === null || raw === void 0 ? void 0 : raw.lat) !== null && _raw$lat2 !== void 0 ? _raw$lat2 : point === null || point === void 0 ? void 0 : point.lat) !== null && _ref6 !== void 0 ? _ref6 : coords === null || coords === void 0 ? void 0 : coords[1]);
  var lon = Number((_ref7 = (_ref8 = (_ref9 = (_raw$lon2 = raw === null || raw === void 0 ? void 0 : raw.lon) !== null && _raw$lon2 !== void 0 ? _raw$lon2 : raw === null || raw === void 0 ? void 0 : raw.lng) !== null && _ref9 !== void 0 ? _ref9 : point === null || point === void 0 ? void 0 : point.lon) !== null && _ref8 !== void 0 ? _ref8 : point === null || point === void 0 ? void 0 : point.lng) !== null && _ref7 !== void 0 ? _ref7 : coords === null || coords === void 0 ? void 0 : coords[0]);
  if (![lat, lon].every(Number.isFinite)) return null;
  var name = String((raw === null || raw === void 0 ? void 0 : raw.name) || (point === null || point === void 0 ? void 0 : point.name) || 'VFR-Meldepunkt').replace(/^RPP\s+/i, '').trim();
  var airportIcao = String((raw === null || raw === void 0 ? void 0 : raw.airportIcao) || (point === null || point === void 0 ? void 0 : point.rppAirportIcao) || (typeof extractRppAirportIcao === 'function' ? extractRppAirportIcao(raw) : '') || '').trim().toUpperCase();
  var sourceId = String((raw === null || raw === void 0 ? void 0 : raw._id) || (raw === null || raw === void 0 ? void 0 : raw.id) || (point === null || point === void 0 ? void 0 : point.sourceId) || '').trim();
  return {
    id: `vrp:${sourceId || `${lat.toFixed(5)},${lon.toFixed(5)}`}`,
    kind: 'vrp',
    sourceId,
    name: name || 'VFR-Meldepunkt',
    airportIcao,
    description: String((raw === null || raw === void 0 ? void 0 : raw.description) || '').trim(),
    lat,
    lon,
    elevationFt: null
  };
}
function getMapContextFeatureDistancePx(feature, latlng) {
  if (!map || !feature) return Infinity;
  var point = map.latLngToLayerPoint([feature.lat, feature.lon]);
  return point.distanceTo(map.latLngToLayerPoint(latlng));
}
function findCachedMapContextFeature(latlng) {
  var _window$gaMapContextH;
  if ((_window$gaMapContextH = window.gaMapContextHost) !== null && _window$gaMapContextH !== void 0 && _window$gaMapContextH.cachedFeature) return window.gaMapContextHost.cachedFeature(latlng);
  var radius = getAirportTapRadiusPx(38);
  var candidates = [];
  var airport = findNearestAirport(latlng, radius);
  var normalizedAirport = normalizeMapContextAirportFeature(airport);
  if (normalizedAirport) candidates.push(normalizedAirport);
  var navigationPoint = findNearestMapNavigationPoint(latlng, radius);
  if ((navigationPoint === null || navigationPoint === void 0 ? void 0 : navigationPoint.type) === 'NAVAID') {
    var normalizedNavaid = normalizeMapContextNavaidFeature(navigationPoint);
    if (normalizedNavaid) candidates.push(normalizedNavaid);
  } else if ((navigationPoint === null || navigationPoint === void 0 ? void 0 : navigationPoint.type) === 'RPP') {
    var normalizedReportingPoint = normalizeMapContextReportingPointFeature(navigationPoint);
    if (normalizedReportingPoint) candidates.push(normalizedReportingPoint);
  }
  candidates.sort((a, b) => getMapContextFeatureDistancePx(a, latlng) - getMapContextFeatureDistancePx(b, latlng));
  return candidates[0] || null;
}
function findNearestMapContextFeature(items, latlng) {
  var _map$filter$sort$;
  var fallback = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
  var radius = getAirportTapRadiusPx(38);
  var candidates = (Array.isArray(items) ? items : []).filter(Boolean);
  if (fallback) candidates.push(fallback);
  var unique = new Map();
  candidates.forEach(feature => {
    var _current$frequencies, _feature$frequencies, _current$runways, _feature$runways;
    var current = unique.get(feature.id);
    var shouldReplace = !current || !((_current$frequencies = current.frequencies) !== null && _current$frequencies !== void 0 && _current$frequencies.length) && ((_feature$frequencies = feature.frequencies) === null || _feature$frequencies === void 0 ? void 0 : _feature$frequencies.length) || !((_current$runways = current.runways) !== null && _current$runways !== void 0 && _current$runways.length) && ((_feature$runways = feature.runways) === null || _feature$runways === void 0 ? void 0 : _feature$runways.length);
    if (shouldReplace) unique.set(feature.id, feature);
  });
  return ((_map$filter$sort$ = _toConsumableArray(unique.values()).map(feature => ({
    feature,
    distance: getMapContextFeatureDistancePx(feature, latlng)
  })).filter(entry => entry.distance <= radius).sort((a, b) => a.distance - b.distance)[0]) === null || _map$filter$sort$ === void 0 ? void 0 : _map$filter$sort$.feature) || null;
}
function fetchMapContextNearbyFeature(_x2) {
  return _fetchMapContextNearbyFeature.apply(this, arguments);
}
function _fetchMapContextNearbyFeature() {
  _fetchMapContextNearbyFeature = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(latlng) {
    var _payload, _payload2, _payload3;
    var cachedFeature, bounds, payload, hasRegionAirports, hasRegionNavaids, hasRegionReportingPoints, candidates;
    return _regenerator().w(function (_context2) {
      while (1) switch (_context2.n) {
        case 0:
          cachedFeature = findCachedMapContextFeature(latlng);
          bounds = getMapContextQueryBounds(latlng, 0.04);
          payload = null;
          hasRegionAirports = !window.gaMapContextHost && typeof openAipRegionState !== 'undefined' && openAipRegionState.payload && openAipCoverageContainsBounds(openAipRegionState.coverage, bounds) && isOpenAipSnapshotCollectionAvailable(typeof openAipRegionState !== 'undefined' && openAipRegionState.payload, 'airports');
          hasRegionNavaids = !window.gaMapContextHost && typeof openAipRegionState !== 'undefined' && openAipRegionState.payload && openAipCoverageContainsBounds(openAipRegionState.coverage, bounds) && isOpenAipSnapshotCollectionAvailable(typeof openAipRegionState !== 'undefined' && openAipRegionState.payload, 'navaids');
          hasRegionReportingPoints = !window.gaMapContextHost && typeof openAipRegionState !== 'undefined' && openAipRegionState.payload && openAipCoverageContainsBounds(openAipRegionState.coverage, bounds) && isOpenAipSnapshotCollectionAvailable(typeof openAipRegionState !== 'undefined' && openAipRegionState.payload, 'reportingPoints');
          if (!(hasRegionAirports && hasRegionNavaids && hasRegionReportingPoints)) {
            _context2.n = 1;
            break;
          }
          payload = typeof openAipRegionState !== 'undefined' && openAipRegionState.payload;
          _context2.n = 3;
          break;
        case 1:
          if (!(typeof window.gaGetAviationSnapshotForBounds === 'function')) {
            _context2.n = 3;
            break;
          }
          _context2.n = 2;
          return window.gaGetAviationSnapshotForBounds(bounds, ['airports', 'navaids', 'reportingPoints']);
        case 2:
          payload = _context2.v;
        case 3:
          candidates = [];
          (Array.isArray((_payload = payload) === null || _payload === void 0 ? void 0 : _payload.airports) ? payload.airports : []).forEach(item => {
            var feature = normalizeMapContextAirportFeature(item);
            if (feature) candidates.push(feature);
          });
          (Array.isArray((_payload2 = payload) === null || _payload2 === void 0 ? void 0 : _payload2.navaids) ? payload.navaids : []).forEach(item => {
            var feature = normalizeMapContextNavaidFeature(item);
            if (feature) candidates.push(feature);
          });
          (Array.isArray((_payload3 = payload) === null || _payload3 === void 0 ? void 0 : _payload3.reportingPoints) ? payload.reportingPoints : []).forEach(item => {
            var feature = normalizeMapContextReportingPointFeature(item);
            if (feature) candidates.push(feature);
          });
          return _context2.a(2, findNearestMapContextFeature(candidates, latlng, cachedFeature));
      }
    }, _callee2);
  }));
  return _fetchMapContextNearbyFeature.apply(this, arguments);
}
function fetchMapContextTerrainFt(_x3) {
  return _fetchMapContextTerrainFt.apply(this, arguments);
}
function _fetchMapContextTerrainFt() {
  _fetchMapContextTerrainFt = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(latlng) {
    var _window$gaMapContextH4;
    var terrainFt, _terrainFt, url, response, data, meters, _t;
    return _regenerator().w(function (_context3) {
      while (1) switch (_context3.p = _context3.n) {
        case 0:
          if (!((_window$gaMapContextH4 = window.gaMapContextHost) !== null && _window$gaMapContextH4 !== void 0 && _window$gaMapContextH4.terrain)) {
            _context3.n = 1;
            break;
          }
          return _context3.a(2, window.gaMapContextHost.terrain(latlng));
        case 1:
          if (!(typeof fetchPoiTerrainElevationFt === 'function')) {
            _context3.n = 3;
            break;
          }
          _context3.n = 2;
          return fetchPoiTerrainElevationFt(latlng.lat, latlng.lng);
        case 2:
          terrainFt = _context3.v;
          return _context3.a(2, Number.isFinite(Number(terrainFt)) ? Math.round(Number(terrainFt)) : null);
        case 3:
          if (!(typeof sampleTerrainElevation === 'function')) {
            _context3.n = 8;
            break;
          }
          _context3.p = 4;
          _context3.n = 5;
          return sampleTerrainElevation(latlng.lat, latlng.lng);
        case 5:
          _terrainFt = _context3.v;
          if (!Number.isFinite(Number(_terrainFt))) {
            _context3.n = 6;
            break;
          }
          return _context3.a(2, Math.round(Number(_terrainFt)));
        case 6:
          _context3.n = 8;
          break;
        case 7:
          _context3.p = 7;
          _t = _context3.v;
        case 8:
          url = `https://api.open-meteo.com/v1/elevation?latitude=${encodeURIComponent(latlng.lat)}&longitude=${encodeURIComponent(latlng.lng)}`;
          _context3.n = 9;
          return fetch(url);
        case 9:
          response = _context3.v;
          if (response.ok) {
            _context3.n = 10;
            break;
          }
          throw new Error(`elevation_http_${response.status}`);
        case 10:
          _context3.n = 11;
          return response.json();
        case 11:
          data = _context3.v;
          meters = Array.isArray(data === null || data === void 0 ? void 0 : data.elevation) ? Number(data.elevation[0]) : Number(data === null || data === void 0 ? void 0 : data.elevation);
          return _context3.a(2, Number.isFinite(meters) ? Math.round(meters * 3.28084) : null);
      }
    }, _callee3, null, [[4, 7]]);
  }));
  return _fetchMapContextTerrainFt.apply(this, arguments);
}
function fetchMapContextWeather(_x4) {
  return _fetchMapContextWeather.apply(this, arguments);
}
function _fetchMapContextWeather() {
  _fetchMapContextWeather = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(latlng) {
    var samples;
    return _regenerator().w(function (_context4) {
      while (1) switch (_context4.n) {
        case 0:
          if (!(typeof window.fetchOpenMeteoWeatherPoints !== 'function')) {
            _context4.n = 1;
            break;
          }
          return _context4.a(2, null);
        case 1:
          _context4.n = 2;
          return window.fetchOpenMeteoWeatherPoints([{
            lat: latlng.lat,
            lon: latlng.lng
          }], {
            includePressure: true,
            maxConcurrency: 1
          });
        case 2:
          samples = _context4.v;
          return _context4.a(2, Array.isArray(samples) ? samples[0] || null : null);
      }
    }, _callee4);
  }));
  return _fetchMapContextWeather.apply(this, arguments);
}
function getMapContextRunwayWindroseData(feature) {
  var runwayText = Array.isArray(feature === null || feature === void 0 ? void 0 : feature.runways) ? feature.runways.join('\n') : String((feature === null || feature === void 0 ? void 0 : feature.runways) || '');
  var match = runwayText.match(/(?:^|\s|\n|<br\s*\/?>)(0[1-9]|[12]\d|3[0-6])([LRC]?)\s*\/\s*((?:0[1-9]|[12]\d|3[0-6])[LRC]?)/);
  if (!match) return null;
  return {
    headingDeg: parseInt(match[1], 10) * 10,
    end1: `${match[1]}${match[2]}`,
    end2: match[3]
  };
}
function renderMapContextWeather(state) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var runway = (options === null || options === void 0 ? void 0 : options.runway) || null;
  if (state.loading.weather && !runway) {
    return '<div class="ga-map-context-loading">Punktwetter wird geladen…</div>';
  }
  var weather = state.weather;
  if (!weather && !runway) {
    return '<div class="ga-map-context-muted">Punktwetter derzeit nicht verfügbar.</div>';
  }
  var windDir = Number(weather === null || weather === void 0 ? void 0 : weather.wdir);
  var windKt = Number(weather === null || weather === void 0 ? void 0 : weather.wspd);
  var totalCloud = Number(weather === null || weather === void 0 ? void 0 : weather.cloudTotalPct);
  var lowCloud = Number(weather === null || weather === void 0 ? void 0 : weather.cloudLowPct);
  var midCloud = Number(weather === null || weather === void 0 ? void 0 : weather.cloudMidPct);
  var highCloud = Number(weather === null || weather === void 0 ? void 0 : weather.cloudHighPct);
  var tempC = Number(weather === null || weather === void 0 ? void 0 : weather.temp2mC);
  var visibilityM = Number(weather === null || weather === void 0 ? void 0 : weather.visibilityM);
  var windText = Number.isFinite(windDir) && Number.isFinite(windKt) ? windKt <= 0.4 ? 'CALM · 0 kt' : `${Math.round(windDir).toString().padStart(3, '0')}° / ${Math.round(windKt)} kt` : state.loading.weather ? 'WIRD GELADEN' : '–';
  var visibilityKm = Number.isFinite(visibilityM) ? visibilityM / 1000 : null;
  var roseTicks = '';
  for (var heading = 0; heading < 360; heading += 30) {
    var angleRad = (heading - 90) * Math.PI / 180;
    var tx = 80 + 61 * Math.cos(angleRad);
    var ty = 80 + 61 * Math.sin(angleRad);
    var label = heading === 0 ? 'N' : heading === 90 ? 'O' : heading === 180 ? 'S' : heading === 270 ? 'W' : String(heading / 10);
    var fontSize = heading % 90 === 0 ? 15 : 10;
    var tickLength = heading % 90 === 0 ? 9 : 6;
    roseTicks += `
            <line x1="80" y1="3" x2="80" y2="${3 + tickLength}" stroke="${heading % 90 === 0 ? '#111' : '#777'}"
                  stroke-width="${heading % 90 === 0 ? 2.5 : 1.5}" transform="rotate(${heading} 80 80)"></line>
            <text x="${tx.toFixed(2)}" y="${ty.toFixed(2)}" font-family="sans-serif" font-size="${fontSize}"
                  fill="#222" font-weight="800" text-anchor="middle" dominant-baseline="central">${label}</text>`;
  }
  var windArrow = Number.isFinite(windDir) && Number.isFinite(windKt) && windKt > 0.4 ? `
        <g transform="rotate(${windDir} 80 80)">
            <line x1="80" y1="7" x2="80" y2="66" stroke="#1a73e8" stroke-width="4" stroke-linecap="round"></line>
            <polygon points="72,54 80,79 88,54" fill="#1a73e8"></polygon>
        </g>` : '';
  var calmLabel = Number.isFinite(windKt) && windKt <= 0.4 ? '<text x="80" y="84" font-family="sans-serif" font-size="14" fill="#1a73e8" font-weight="900" text-anchor="middle">CALM</text>' : '';
  var runwayLayer = runway ? `
        <g transform="translate(80,80) rotate(${Number(runway.headingDeg) || 0}) translate(-80,-80)">
            <rect x="68" y="29" width="24" height="102" rx="3" fill="#444" stroke="#111" stroke-width="1.5"></rect>
            <line x1="80" y1="47" x2="80" y2="113" stroke="#d4d4d4" stroke-width="2"
                  stroke-dasharray="6 6"></line>
            <text x="80" y="43" font-family="sans-serif" font-size="10" fill="#fff" font-weight="900"
                  text-anchor="middle" transform="rotate(180 80 39)">${escapePopupText(runway.end2)}</text>
            <text x="80" y="126" font-family="sans-serif" font-size="10" fill="#fff" font-weight="900"
                  text-anchor="middle">${escapePopupText(runway.end1)}</text>
        </g>` : '';
  var sourceText = runway ? `Piste ${runway.end1}/${runway.end2} aus internen Daten · ${weather ? 'Wind am Kartenpunkt' : state.loading.weather ? 'Wind wird ergänzt…' : 'Wind derzeit nicht verfügbar'}` : 'Aktueller Stundenwert am Kartenpunkt';
  var ariaLabel = runway ? `Piste ${runway.end1}/${runway.end2}; Wind ${windText}` : `Windrose ${windText}`;
  return `
        <div class="ga-map-context-weather-card">
            <div class="ga-map-context-weather-header">
                <b>${runway ? 'PISTE · PUNKTWETTER' : 'PUNKTWETTER'}</b>
                <span>OPEN‑METEO</span>
            </div>
            <div class="ga-map-context-weather-layout">
                <div class="ga-map-context-weather-values">
                    <span><small>WIND</small><b class="is-wind">${escapePopupText(windText)}</b></span>
                    <span><small>SICHT</small><b>${Number.isFinite(visibilityKm) ? `${visibilityKm >= 10 ? Math.round(visibilityKm) : visibilityKm.toFixed(1)} km` : '–'}</b></span>
                    <span><small>TEMP</small><b>${Number.isFinite(tempC) ? `${Math.round(tempC)} °C` : '–'}</b></span>
                    <span><small>BEDECKUNG</small><b>${Number.isFinite(totalCloud) ? `${Math.round(totalCloud)} %` : '–'}</b></span>
                    <span class="is-wide"><small>WOLKEN L/M/H</small><b>${[lowCloud, midCloud, highCloud].some(Number.isFinite) ? `${Number.isFinite(lowCloud) ? Math.round(lowCloud) : '–'}/${Number.isFinite(midCloud) ? Math.round(midCloud) : '–'}/${Number.isFinite(highCloud) ? Math.round(highCloud) : '–'} %` : '–'}</b></span>
                </div>
                <div class="ga-map-context-windrose" aria-label="${escapePopupText(ariaLabel)}">
                    <svg viewBox="0 0 160 160" aria-hidden="true">
                        ${roseTicks}
                        ${runwayLayer}
                        ${windArrow}
                        ${calmLabel}
                    </svg>
                </div>
            </div>
            <div class="ga-map-context-weather-source">${escapePopupText(sourceText)}</div>
        </div>`;
}
function renderMapContextAirspaces(state) {
  if (state.loading.airspaces) {
    return '<div class="ga-map-context-loading">Lufträume werden geprüft…</div>';
  }
  if (!Array.isArray(state.airspaces) || state.airspaces.length === 0) {
    return '<div class="ga-map-context-muted">Kein relevanter OpenAIP-Luftraum an diesem Punkt gefunden.</div>';
  }
  var cards = state.airspaces.map(airspace => {
    var id = String(airspace.__mapContextId || '');
    var style = mapContextAirspaceStyle(airspace);
    var name = getMapContextAirspaceDisplayTitle(airspace);
    var lower = mapContextFormatLimit(airspace.lowerLimit);
    var upper = mapContextFormatLimit(airspace.upperLimit);
    var frequencies = mapContextAirspaceFrequencyText(airspace);
    var frequencyRows = frequencies.length ? frequencies.map(frequency => `
                <span class="ga-map-context-frequency-row">
                    <span class="ga-map-context-frequency-label">${escapePopupText(frequency.label)}</span>
                    <span class="ga-map-context-frequency-value">${escapePopupText(frequency.value)}</span>
                </span>`).join('') : `
                <span class="ga-map-context-frequency-row">
                    <span class="ga-map-context-frequency-label">FUNK</span>
                    <span class="ga-map-context-frequency-value">—</span>
                </span>`;
    var activation = mapContextAirspaceActivationText(airspace);
    var selected = state.selectedAirspaceId === id;
    return `
            <button type="button" class="ga-map-context-airspace${selected ? ' is-selected' : ''}"
                    data-map-context-airspace-id="${escapePopupText(id)}"
                    aria-pressed="${selected ? 'true' : 'false'}"
                    style="--ga-map-context-airspace-color:${escapePopupText(style.mapColor || style.color || '#4da6ff')}">
                <span class="ga-map-context-airspace-title"><i></i><b>${escapePopupText(name)}</b></span>
                <span class="ga-map-context-airspace-meta">${escapePopupText(style.category || 'Luftraum')}; ${escapePopupText(lower)}–${escapePopupText(upper)}</span>
                <span class="ga-map-context-airspace-meta ga-map-context-airspace-frequency">${frequencyRows}</span>
                ${activation ? `<span class="ga-map-context-airspace-meta">${escapePopupText(activation)}</span>` : ''}
                ${selected ? '<span class="ga-map-context-airspace-action">Markiert · erneut antippen zum Lösen</span>' : ''}
            </button>`;
  }).join('');
  return `${cards}<div class="ga-map-context-source">Zeiten ggf. in AIP/NOTAM prüfen.</div>`;
}
function mapContextLimitMslFt(airspace, limit, boundary, terrainFt) {
  var valueFt = mapContextLimitToFt(limit);
  if (!Number.isFinite(valueFt)) return null;
  var isAgl = Boolean(boundary === 'lower' ? (airspace === null || airspace === void 0 ? void 0 : airspace._lowerIsAgl) || (limit === null || limit === void 0 ? void 0 : limit.referenceDatum) === 0 : (airspace === null || airspace === void 0 ? void 0 : airspace._upperIsAgl) || (limit === null || limit === void 0 ? void 0 : limit.referenceDatum) === 0);
  return valueFt + (isAgl ? Math.max(0, Number(terrainFt) || 0) : 0);
}
function getMapContextCurrentAltitudeFt() {
  var _window$lastLiveGpsPo, _window$lastLiveGpsPo2, _window$lastLiveFligh, _window$lastLiveGpsPo3;
  var value = Number((_window$lastLiveGpsPo = (_window$lastLiveGpsPo2 = window.lastLiveGpsPos) === null || _window$lastLiveGpsPo2 === void 0 ? void 0 : _window$lastLiveGpsPo2.alt) !== null && _window$lastLiveGpsPo !== void 0 ? _window$lastLiveGpsPo : (_window$lastLiveFligh = window.lastLiveFlightData) === null || _window$lastLiveFligh === void 0 ? void 0 : _window$lastLiveFligh.mslFt);
  if (!Number.isFinite(value) || value < 0) return null;
  var telemetryAt = Number(window.gaLastTrackerTelemetryAt || ((_window$lastLiveGpsPo3 = window.lastLiveGpsPos) === null || _window$lastLiveGpsPo3 === void 0 ? void 0 : _window$lastLiveGpsPo3.t) || 0);
  var liveMode = Boolean(window.simModeActive || window.liveTrackerConnected);
  if (!liveMode && (!telemetryAt || Date.now() - telemetryAt > 15000)) return null;
  return Math.round(value);
}
function getMapContextAirspaceClassPriority(airspace) {
  if (Number(airspace === null || airspace === void 0 ? void 0 : airspace.type) === 33) return null;
  var rawClass = airspace === null || airspace === void 0 ? void 0 : airspace.icaoClass;
  if (rawClass === null || rawClass === undefined || rawClass === '') return null;
  var classIndex = Number(rawClass);
  return Number.isInteger(classIndex) && classIndex >= 0 && classIndex <= 6 ? classIndex : null;
}
function getMapContextEffectiveHeightBands(rawBands) {
  var minimumSegmentFt = 20;
  return rawBands.flatMap(band => {
    var bandPriority = getMapContextAirspaceClassPriority(band.airspace);
    if (!Number.isInteger(bandPriority)) return [band];
    var blockers = rawBands.filter(other => other !== band && Number.isInteger(getMapContextAirspaceClassPriority(other.airspace)) && getMapContextAirspaceClassPriority(other.airspace) < bandPriority && other.upperFt > band.lowerFt && other.lowerFt < band.upperFt).sort((a, b) => a.lowerFt - b.lowerFt);
    var segments = [band];
    blockers.forEach(blocker => {
      segments = segments.flatMap(segment => {
        var overlapLower = Math.max(segment.lowerFt, blocker.lowerFt);
        var overlapUpper = Math.min(segment.upperFt, blocker.upperFt);
        if (overlapUpper <= overlapLower) return [segment];
        var remaining = [];
        if (overlapLower - segment.lowerFt >= minimumSegmentFt) {
          remaining.push(_objectSpread(_objectSpread({}, segment), {}, {
            upperFt: overlapLower,
            upperLimit: blocker.lowerLimit,
            effective: true
          }));
        }
        if (segment.upperFt - overlapUpper >= minimumSegmentFt) {
          remaining.push(_objectSpread(_objectSpread({}, segment), {}, {
            lowerFt: overlapUpper,
            lowerLimit: blocker.upperLimit,
            effective: true
          }));
        }
        return remaining;
      });
    });
    return segments;
  });
}
function getMapContextHeightBandData(state) {
  var _state$feature;
  var terrainFt = Math.max(0, Number(state.terrainFt) || 0);
  var stateAltitude = state === null || state === void 0 ? void 0 : state.currentAltitudeFt;
  var currentAltitudeFt = stateAltitude !== null && stateAltitude !== undefined && Number.isFinite(Number(stateAltitude)) ? Math.max(0, Number(stateAltitude)) : getMapContextCurrentAltitudeFt();
  var rawBands = (Array.isArray(state.airspaces) ? state.airspaces : []).map(airspace => {
    var lowerFt = mapContextLimitMslFt(airspace, airspace.lowerLimit, 'lower', terrainFt);
    var upperFt = mapContextLimitMslFt(airspace, airspace.upperLimit, 'upper', terrainFt);
    return {
      airspace,
      lowerFt,
      upperFt,
      lowerLimit: airspace.lowerLimit,
      upperLimit: airspace.upperLimit
    };
  });
  var finiteCeilings = rawBands.flatMap(band => [band.lowerFt, band.upperFt]).filter(Number.isFinite);
  if (Number.isFinite(Number((_state$feature = state.feature) === null || _state$feature === void 0 ? void 0 : _state$feature.elevationFt))) {
    finiteCeilings.push(Number(state.feature.elevationFt));
  }
  finiteCeilings.push(terrainFt);
  if (Number.isFinite(currentAltitudeFt)) finiteCeilings.push(currentAltitudeFt);
  var highest = Math.max.apply(Math, [4000].concat(_toConsumableArray(finiteCeilings)));
  var step = highest <= 10000 ? 1000 : highest <= 25000 ? 2500 : 5000;
  var maxFt = Math.min(60000, Math.max(5000, Math.ceil(highest * 1.12 / step) * step));
  var normalizedBands = rawBands.map(band => {
    var lowerFt = Number.isFinite(band.lowerFt) ? Math.max(0, band.lowerFt) : terrainFt;
    var upperFt = Number.isFinite(band.upperFt) ? Math.max(lowerFt + 100, band.upperFt) : maxFt;
    return _objectSpread(_objectSpread({}, band), {}, {
      lowerFt,
      upperFt: Math.min(maxFt, upperFt)
    });
  });
  var bands = getMapContextEffectiveHeightBands(normalizedBands);
  return {
    terrainFt,
    currentAltitudeFt,
    maxFt,
    bands
  };
}
function formatMapContextBandTick(valueFt) {
  var rounded = Math.round(Number(valueFt) || 0);
  if (rounded === 0) return 'MSL';
  if (rounded >= 10000 && rounded % 1000 === 0) return `${rounded / 1000}k`;
  return rounded.toLocaleString('de-DE');
}
function getMapContextHeightScaleTicks(bands, maxFt) {
  var transitions = [];
  bands.forEach(band => {
    [{
      valueFt: band.lowerFt,
      limit: band.lowerLimit
    }, {
      valueFt: band.upperFt,
      limit: band.upperLimit
    }].forEach(_ref0 => {
      var valueFt = _ref0.valueFt,
        limit = _ref0.limit;
      if (!Number.isFinite(valueFt) || valueFt <= 0 || valueFt >= maxFt) return;
      var isFlightLevel = Number(limit === null || limit === void 0 ? void 0 : limit.unit) === 6 && Number.isFinite(Number(limit === null || limit === void 0 ? void 0 : limit.value));
      transitions.push({
        valueFt,
        label: isFlightLevel ? `FL${Math.round(Number(limit.value))}` : formatMapContextBandTick(valueFt),
        transition: true
      });
    });
  });
  var uniqueTransitions = [];
  transitions.sort((a, b) => b.valueFt - a.valueFt).forEach(entry => {
    if (uniqueTransitions.some(item => Math.abs(item.valueFt - entry.valueFt) < 80)) return;
    uniqueTransitions.push(entry);
  });
  var mergeDistanceFt = Math.max(100, maxFt * 0.012);
  var baseTicks = [1, 0.75, 0.5, 0.25, 0].map(ratio => ({
    valueFt: maxFt * ratio,
    label: formatMapContextBandTick(maxFt * ratio),
    transition: false
  })).filter(base => !uniqueTransitions.some(entry => Math.abs(entry.valueFt - base.valueFt) < mergeDistanceFt));
  return [].concat(_toConsumableArray(baseTicks), uniqueTransitions).sort((a, b) => b.valueFt - a.valueFt);
}
function getMapContextHeightBandLayer(airspace) {
  var type = Number(airspace === null || airspace === void 0 ? void 0 : airspace.type);
  if (type === 33) return 2;
  if (type === 0) return 3;
  if (type === 7 || type === 26) return 4;
  if (type === 4 || type === 5 || type === 6 || type === 27 || type === 28) return 5;
  if (type === 1 || type === 2 || type === 3) return 6;
  return 3;
}
function getMapContextCloudVisualProfile(type) {
  var hasTS = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  var normalizedType = String(type || '').toUpperCase();
  if (typeof vpGetCloudLayerProfile === 'function') {
    try {
      return vpGetCloudLayerProfile(normalizedType, hasTS);
    } catch (_) {}
  }
  var profiles = {
    FEW: {
      thicknessFt: 900,
      density: 0.32,
      topAlpha: 0.12,
      bottomAlpha: 0.2,
      ridgeStrength: 0.22
    },
    SCT: {
      thicknessFt: 1700,
      density: 0.46,
      topAlpha: 0.16,
      bottomAlpha: 0.28,
      ridgeStrength: 0.3
    },
    BKN: {
      thicknessFt: 3200,
      density: 0.72,
      topAlpha: 0.2,
      bottomAlpha: 0.42,
      ridgeStrength: 0.4
    },
    OVC: {
      thicknessFt: 5200,
      density: 0.9,
      topAlpha: 0.24,
      bottomAlpha: 0.5,
      ridgeStrength: 0.46
    },
    VV: {
      thicknessFt: 5200,
      density: 0.9,
      topAlpha: 0.24,
      bottomAlpha: 0.5,
      ridgeStrength: 0.46
    }
  };
  var profile = _objectSpread({}, profiles[normalizedType] || profiles.SCT);
  if (hasTS) {
    profile.thicknessFt = Math.max(profile.thicknessFt, 12000);
    profile.density = Math.min(1, profile.density + 0.12);
    profile.topAlpha = Math.min(0.38, profile.topAlpha + 0.08);
    profile.bottomAlpha = Math.min(0.62, profile.bottomAlpha + 0.1);
    profile.ridgeStrength = Math.min(0.62, profile.ridgeStrength + 0.12);
  }
  return profile;
}
function getMapContextCloudCoverage(type) {
  var normalizedType = String(type || '').toUpperCase();
  if (normalizedType === 'FEW') return 22;
  if (normalizedType === 'SCT') return 45;
  if (normalizedType === 'BKN') return 80;
  if (normalizedType === 'OVC' || normalizedType === 'VV') return 100;
  return 50;
}
function getMapContextAtmosphereData(state, terrainFt) {
  var weather = state === null || state === void 0 ? void 0 : state.weather;
  if (!weather) {
    return {
      clouds: [],
      hasRain: false,
      hasSnow: false,
      precipitationMm: 0,
      lowestBaseFt: null
    };
  }
  var pressureProfile = Array.isArray(weather.pressureProfile) ? weather.pressureProfile : [];
  var clouds = [];
  if (typeof vpDeriveCloudLayersFromPressureProfile === 'function') {
    try {
      clouds = vpDeriveCloudLayersFromPressureProfile(pressureProfile, terrainFt);
    } catch (_) {
      clouds = [];
    }
  }
  var precipitationMm = Math.max(0, Number(weather.precipitationMm) || 0, Number(weather.rainMm) || 0);
  var hasTS = [95, 96, 99].includes(Number(weather.weatherCode));
  var hasRain = (Number(weather.rainMm) || 0) > 0.1 || precipitationMm > 0.25;
  var hasSnow = (Number(weather.snowfallCm) || 0) > 0.05;
  var estimatedCloud = typeof vpBuildTempDewCloudLayer === 'function' ? vpBuildTempDewCloudLayer({
    temp2mC: weather.temp2mC,
    dewPoint2mC: weather.dewPoint2mC,
    rh2mPct: weather.rh2mPct,
    windKt: weather.wspd,
    terrainFt,
    lowCloudPct: weather.cloudLowPct,
    coveragePct: weather.cloudTotalPct,
    weatherCode: weather.weatherCode,
    hasRain,
    hasSnow,
    source: 'map_context_openmeteo'
  }) : null;
  var pressureLowestBase = clouds.reduce((lowest, cloud) => {
    var baseFt = Number(cloud === null || cloud === void 0 ? void 0 : cloud.baseMsl);
    return Number.isFinite(baseFt) ? Math.min(lowest, baseFt) : lowest;
  }, Infinity);
  if (estimatedCloud && (!Number.isFinite(pressureLowestBase) || estimatedCloud.baseMsl < pressureLowestBase - 500)) {
    clouds.unshift(estimatedCloud);
  }
  clouds = clouds.map(cloud => {
    var baseMsl = Number(cloud === null || cloud === void 0 ? void 0 : cloud.baseMsl);
    if (!Number.isFinite(baseMsl)) return null;
    var type = String((cloud === null || cloud === void 0 ? void 0 : cloud.type) || 'SCT').toUpperCase();
    var visualProfile = getMapContextCloudVisualProfile(type, hasTS);
    var measuredTopMsl = Number(cloud === null || cloud === void 0 ? void 0 : cloud.topMsl);
    var topMsl = Number.isFinite(measuredTopMsl) && measuredTopMsl > baseMsl + 150 ? measuredTopMsl : baseMsl + visualProfile.thicknessFt;
    return {
      type,
      baseMsl,
      topMsl,
      coveragePct: getMapContextCloudCoverage(type),
      density: visualProfile.density,
      topAlpha: visualProfile.topAlpha,
      bottomAlpha: visualProfile.bottomAlpha,
      ridgeStrength: visualProfile.ridgeStrength,
      hasTS
    };
  }).filter(Boolean).sort((a, b) => a.baseMsl - b.baseMsl);
  var lowestBaseFt = clouds.length ? clouds.reduce((lowest, cloud) => Math.min(lowest, cloud.baseMsl), Infinity) : null;
  return {
    clouds,
    hasRain,
    hasSnow,
    hasTS,
    precipitationMm,
    lowestBaseFt
  };
}
function renderMapContextAtmosphere(atmosphere, maxFt, terrainFt) {
  if (!atmosphere || !Number.isFinite(maxFt) || maxFt <= 0) return '';
  var cloudLayers = (Array.isArray(atmosphere.clouds) ? atmosphere.clouds : []).map((cloud, cloudIndex) => {
    var baseFt = Math.max(terrainFt, Number(cloud.baseMsl) || 0);
    var topFt = Math.max(baseFt + 100, Number(cloud.topMsl) || baseFt);
    if (baseFt >= maxFt || topFt <= 0) return '';
    var visibleBaseFt = Math.min(maxFt, baseFt);
    var visibleTopFt = Math.min(maxFt, topFt);
    var topPct = Math.max(0, Math.min(100, 100 - visibleTopFt / maxFt * 100));
    var bottomPct = Math.max(0, Math.min(100, 100 - visibleBaseFt / maxFt * 100));
    var heightPct = Math.max(1.2, bottomPct - topPct);
    var type = String(cloud.type || 'SCT').toLowerCase();
    var coveragePct = Math.max(15, Math.min(100, Number(cloud.coveragePct) || 50));
    var density = Math.max(0.2, Math.min(1, Number(cloud.density) || coveragePct / 100));
    var ridgeStrength = Math.max(0.15, Math.min(0.7, Number(cloud.ridgeStrength) || 0.3));
    var grayTop = Math.round(218 - density * 72 - (cloud.hasTS ? 18 : 0));
    var grayBottom = Math.round(170 - density * 105 - (cloud.hasTS ? 24 : 0));
    var topAlpha = Math.min(0.92, 0.46 + (Number(cloud.topAlpha) || 0.16) + density * 0.16);
    var bottomAlpha = Math.min(0.98, 0.52 + (Number(cloud.bottomAlpha) || 0.28) + density * 0.12);
    var highlightAlpha = Math.min(0.88, topAlpha + 0.11);
    var massWidth = Math.round(120 + density * 70);
    var delaySeconds = -(cloudIndex * 1.73 + baseFt * 0.00037) % 7;
    return `
            <span class="ga-map-context-height-cloud is-${escapePopupText(type)}${cloud.hasTS ? ' has-thunderstorm' : ''}"
                  style="top:${topPct.toFixed(2)}%;height:${heightPct.toFixed(2)}%;
                         --ga-map-context-cloud-density:${density.toFixed(2)};
                         --ga-map-context-cloud-ridge:${ridgeStrength.toFixed(2)};
                         --ga-map-context-cloud-mass-width:${massWidth}%;
                         --ga-map-context-cloud-top:rgba(${grayTop},${grayTop},${grayTop},${topAlpha.toFixed(2)});
                         --ga-map-context-cloud-bottom:rgba(${grayBottom},${grayBottom},${grayBottom},${bottomAlpha.toFixed(2)});
                         --ga-map-context-cloud-highlight:rgba(255,255,255,${highlightAlpha.toFixed(2)});
                         --ga-map-context-cloud-delay:${delaySeconds.toFixed(2)}s"
                  aria-hidden="true">
                <span class="ga-map-context-height-cloud-mass">
                    <span class="ga-map-context-height-cloud-core"></span>
                    <span class="ga-map-context-height-cloud-lobe is-top is-a"></span>
                    <span class="ga-map-context-height-cloud-lobe is-top is-b"></span>
                    <span class="ga-map-context-height-cloud-lobe is-top is-c"></span>
                    <span class="ga-map-context-height-cloud-lobe is-bottom is-a"></span>
                    <span class="ga-map-context-height-cloud-lobe is-bottom is-b"></span>
                    <span class="ga-map-context-height-cloud-lobe is-bottom is-c"></span>
                </span>
            </span>`;
  }).join('');
  var precipitation = '';
  var rainSplashes = '';
  if (atmosphere.hasRain || atmosphere.hasSnow) {
    var fallbackBaseFt = Math.max(terrainFt + 1200, maxFt * 0.55);
    var precipBaseFt = Math.min(maxFt, Math.max(terrainFt + 150, Number(atmosphere.lowestBaseFt) || fallbackBaseFt));
    var topPct = Math.max(0, Math.min(100, 100 - precipBaseFt / maxFt * 100));
    var heightPct = Math.max(1.5, 100 - topPct);
    var intensity = Math.max(0.42, Math.min(0.92, 0.42 + (Number(atmosphere.precipitationMm) || 0) * 0.15));
    precipitation = `
            <span class="ga-map-context-height-precipitation${atmosphere.hasRain ? ' is-rain' : ''}${atmosphere.hasSnow ? ' is-snow' : ''}"
                  style="top:${topPct.toFixed(2)}%;height:${heightPct.toFixed(2)}%;--ga-map-context-precip-opacity:${intensity.toFixed(2)}"
                  aria-hidden="true"></span>`;
    if (atmosphere.hasRain) {
      var terrainHeightPct = Math.max(2.2, Math.min(92, terrainFt / maxFt * 100));
      var terrainTopPct = Math.max(1, Math.min(98, 100 - terrainHeightPct));
      var terrainContour = [{
        x: 18,
        y: 2,
        delay: 0.08,
        scale: 0.92
      }, {
        x: 37,
        y: 18,
        delay: 0.54,
        scale: 0.76
      }, {
        x: 58,
        y: 4,
        delay: 0.31,
        scale: 1.0
      }, {
        x: 78,
        y: 15,
        delay: 0.73,
        scale: 0.82
      }, {
        x: 97,
        y: 2,
        delay: 0.42,
        scale: 0.9
      }];
      rainSplashes = `
                <span class="ga-map-context-height-rain-splashes"
                      style="--ga-map-context-splash-opacity:${Math.min(1, intensity + 0.18).toFixed(2)}"
                      aria-hidden="true">
                    ${terrainContour.map(point => {
        var groundPct = terrainTopPct + terrainHeightPct * point.y / 100;
        return `
                            <span class="ga-map-context-height-rain-splash"
                                  style="left:${point.x}%;top:${groundPct.toFixed(2)}%;
                                         --ga-map-context-splash-delay:-${point.delay.toFixed(2)}s;
                                         --ga-map-context-splash-scale:${point.scale.toFixed(2)};
                                         --ga-map-context-splash-start-scale:${(point.scale * 0.55).toFixed(2)};
                                         --ga-map-context-splash-end-scale:${(point.scale * 1.28).toFixed(2)}">
                                <i></i>
                            </span>`;
      }).join('')}
                </span>`;
    }
  }
  if (!cloudLayers && !precipitation) return '';
  return `
        <div class="ga-map-context-height-atmosphere" aria-hidden="true">
            ${cloudLayers}
            ${precipitation}
            ${rainSplashes}
        </div>`;
}
function renderMapContextHeightBand(state) {
  var _state$feature2, _state$feature3, _state$feature4;
  var _getMapContextHeightB = getMapContextHeightBandData(state),
    terrainFt = _getMapContextHeightB.terrainFt,
    currentAltitudeFt = _getMapContextHeightB.currentAltitudeFt,
    maxFt = _getMapContextHeightB.maxFt,
    bands = _getMapContextHeightB.bands;
  state.heightBandMaxFt = maxFt;
  var ticks = getMapContextHeightScaleTicks(bands, maxFt).map(tick => `
        <span class="ga-map-context-height-tick${tick.transition ? ' is-transition' : ''}"
              style="top:${Math.max(0, Math.min(100, 100 - tick.valueFt / maxFt * 100)).toFixed(2)}%">
            ${escapePopupText(tick.label)}
        </span>`).join('');
  var airspaceBands = bands.map(band => {
    var airspace = band.airspace;
    var id = String(airspace.__mapContextId || '');
    var style = mapContextAirspaceStyle(airspace);
    var name = getMapContextAirspaceDisplayTitle(airspace);
    var classLetter = getMapContextAirspaceClassLetter(airspace);
    var isControlZone = Number(airspace === null || airspace === void 0 ? void 0 : airspace.type) === 4;
    var shortLabel = isControlZone ? 'CTR' : classLetter || getMapContextAirspaceDescriptor(airspace).split(/\s+/)[0];
    var topPct = Math.max(0, Math.min(100, 100 - band.upperFt / maxFt * 100));
    var bottomPct = Math.max(0, Math.min(100, 100 - band.lowerFt / maxFt * 100));
    var heightPct = Math.max(2.8, bottomPct - topPct);
    var classSizePx = Math.max(16, Math.min(29, 13 + heightPct * 0.58));
    var selected = state.selectedAirspaceId === id;
    return `
            <button type="button"
                    class="ga-map-context-height-airspace${selected ? ' is-selected' : ''}"
                    data-map-context-airspace-id="${escapePopupText(id)}"
                    aria-label="${escapePopupText(`${name}, ${mapContextFormatLimit(airspace.lowerLimit)} bis ${mapContextFormatLimit(airspace.upperLimit)}`)}"
                    aria-pressed="${selected ? 'true' : 'false'}"
                    title="${escapePopupText(`${name} · ${mapContextFormatLimit(airspace.lowerLimit)}–${mapContextFormatLimit(airspace.upperLimit)}`)}"
                    style="top:${topPct.toFixed(2)}%;height:${heightPct.toFixed(2)}%;--ga-map-context-airspace-color:${escapePopupText(style.mapColor || style.color || '#4da6ff')};--ga-map-context-class-size:${classSizePx.toFixed(1)}px;--ga-map-context-band-layer:${getMapContextHeightBandLayer(airspace)}">
                ${classLetter || isControlZone ? `<span class="ga-map-context-height-class-letter${isControlZone ? ' is-ctr' : ''}">${escapePopupText(shortLabel)}</span>` : `<span class="ga-map-context-height-airspace-label">${escapePopupText(shortLabel)}</span>`}
            </button>`;
  }).join('');
  var terrainHeightPct = Math.max(2.2, Math.min(92, terrainFt / maxFt * 100));
  var terrainTopPct = Math.max(1, Math.min(98, 100 - terrainHeightPct));
  var terrainLabel = state.terrainFt != null && Number.isFinite(Number(state.terrainFt)) ? `${Math.round(terrainFt).toLocaleString('de-DE')}′` : 'GND';
  var featureElevation = Number.isFinite(Number((_state$feature2 = state.feature) === null || _state$feature2 === void 0 ? void 0 : _state$feature2.elevationFt)) ? Number(state.feature.elevationFt) : terrainFt;
  var featureTopPct = Math.max(1, Math.min(98, 100 - featureElevation / maxFt * 100));
  var featureMarkerLabel = ((_state$feature3 = state.feature) === null || _state$feature3 === void 0 ? void 0 : _state$feature3.kind) === 'airport' ? 'Flugplatz markieren' : ((_state$feature4 = state.feature) === null || _state$feature4 === void 0 ? void 0 : _state$feature4.kind) === 'vrp' ? 'VFR-Meldepunkt markieren' : 'Navaid markieren';
  var featureMarker = state.feature ? `
        <button type="button"
                class="ga-map-context-height-feature${state.selectedFeatureId === state.feature.id ? ' is-selected' : ''}"
                data-map-context-feature-id="${escapePopupText(state.feature.id)}"
                aria-label="${escapePopupText(featureMarkerLabel)}"
                style="top:${featureTopPct.toFixed(2)}%">
            <span>${state.feature.kind === 'airport' ? 'APT' : state.feature.kind === 'vrp' ? 'VRP' : 'NAV'}</span>
        </button>` : '';
  var ownAltitudeTopPct = Number.isFinite(currentAltitudeFt) ? Math.max(1, Math.min(99, 100 - currentAltitudeFt / maxFt * 100)) : null;
  var ownAltitudeMarker = Number.isFinite(ownAltitudeTopPct) ? `
        <span class="ga-map-context-height-ownship"
              data-map-context-own-altitude
              style="top:${ownAltitudeTopPct.toFixed(2)}%"
              role="img"
              aria-label="Eigene Flughöhe ${Math.round(currentAltitudeFt)} Fuß MSL"
              title="Eigene Flughöhe · ${Math.round(currentAltitudeFt).toLocaleString('de-DE')} ft MSL"></span>` : '';
  var loading = state.loading.airspaces || state.loading.terrain;
  var atmosphere = renderMapContextAtmosphere(getMapContextAtmosphereData(state, terrainFt), maxFt, terrainFt);
  return `
        <div class="ga-map-context-height-band${loading ? ' is-loading' : ''}">
            <div class="ga-map-context-height-title">HÖHE <small>FT MSL</small></div>
            <div class="ga-map-context-height-plot">
                <div class="ga-map-context-height-sky"></div>
                ${atmosphere}
                <div class="ga-map-context-height-scale">${ticks}</div>
                ${ownAltitudeMarker}
                <div class="ga-map-context-height-stack">
                    ${airspaceBands}
                    ${featureMarker}
                    <div class="ga-map-context-height-terrain" style="height:${terrainHeightPct.toFixed(2)}%"></div>
                    <span class="ga-map-context-height-ground-label" style="top:${terrainTopPct.toFixed(2)}%">${escapePopupText(terrainLabel)}</span>
                </div>
                ${loading ? '<span class="ga-map-context-height-loading">lädt…</span>' : ''}
            </div>
        </div>`;
}
function getMapContextAirportWidgetConfig(state) {
  var feature = state === null || state === void 0 ? void 0 : state.feature;
  if (!feature || feature.kind !== 'airport' || !feature.icao) return null;
  var safeIcao = String(feature.icao).replace(/[^a-zA-Z0-9_-]/g, '_');
  var prefix = `gaMapContextApt_${state.requestSeq}_${safeIcao}`;
  return {
    runwayId: `${prefix}_runways`,
    freqId: `${prefix}_frequencies`,
    wxId: `${prefix}_weather`
  };
}
function buildMapContextAirportWidget(state, selected) {
  var feature = state.feature;
  var config = getMapContextAirportWidgetConfig(state);
  var title = [feature.icao, feature.name].filter(Boolean).join(' · ');
  if (!config || typeof _buildAptPopup !== 'function') {
    var _feature$runways2, _feature$frequencies2;
    var details = [];
    if (Number.isFinite(Number(feature.elevationFt))) details.push(`${Math.round(Number(feature.elevationFt))} ft MSL`);
    if ((_feature$runways2 = feature.runways) !== null && _feature$runways2 !== void 0 && _feature$runways2.length) details.push(`RWY ${feature.runways.join('; ')}`);
    if ((_feature$frequencies2 = feature.frequencies) !== null && _feature$frequencies2 !== void 0 && _feature$frequencies2.length) details.push(feature.frequencies.join('; '));
    return `
            <button type="button" class="ga-map-context-feature${selected ? ' is-selected' : ''}"
                    data-map-context-feature-id="${escapePopupText(feature.id)}"
                    aria-pressed="${selected ? 'true' : 'false'}">
                <span class="ga-map-context-feature-kind">FLUGPLATZ</span>
                <b>${escapePopupText(title || 'Flugplatz')}</b>
                ${details.map(detail => `<span>${escapePopupText(detail)}</span>`).join('')}
                ${selected ? '<span class="ga-map-context-feature-action">Karte + Höhenband markiert</span>' : ''}
            </button>`;
  }
  var countryCode = typeof getAirportCountryCode === 'function' ? getAirportCountryCode(feature.icao, feature.country) : feature.country;
  var widgetTitle = `
        <b style="font-size:13px;">${escapePopupText(feature.icao)}</b>
        <div style="font-size:11px; color:#445; margin-top:2px;">${escapePopupText(feature.name)}</div>`;
  var widgetHtml = _buildAptPopup('APT', feature.name, feature.elevationFt, feature.icao, {
    title: widgetTitle,
    wxContainerId: config.wxId,
    runwayContainerId: config.runwayId,
    freqContainerId: config.freqId,
    countryCode,
    showDirectTo: true,
    directToName: feature.name,
    lat: feature.lat,
    lon: feature.lon,
    compactLayout: true
  });
  return `
        <div class="ga-map-context-airport-block">
            <button type="button" class="ga-map-context-feature ga-map-context-feature-selector${selected ? ' is-selected' : ''}"
                    data-map-context-feature-id="${escapePopupText(feature.id)}"
                    aria-pressed="${selected ? 'true' : 'false'}">
                <span class="ga-map-context-feature-kind">FLUGPLATZ · VOLLANSICHT</span>
                <b>${escapePopupText(title)}</b>
                ${selected ? '<span class="ga-map-context-feature-action">Markiert · erneut antippen zum Lösen</span>' : ''}
            </button>
            <div class="ga-map-context-airport-full"
                 style="min-width:0;overflow:hidden;padding:5px;color:#10202d;background:#edf7fb;border:1px solid rgba(250,204,21,.72);border-radius:7px;">
                ${widgetHtml}
            </div>
        </div>`;
}
function captureMapContextAirportWidgetState(state) {
  var config = getMapContextAirportWidgetConfig(state);
  if (!config) return;
  var weatherElement = document.getElementById(config.wxId);
  if (!weatherElement) return;
  if (weatherElement.querySelector('[data-ga-metar-loading="true"]')) return;
  var html = String(weatherElement.innerHTML || '').trim();
  if (html && !/(Wetter lädt|Sucht lokales Wetter|Punktwetter wird geladen)/i.test(html)) {
    state.airportWidgetWeatherHtml = html;
  }
}
function renderMapContextAirportWeatherPlaceholder(state) {
  var feature = state === null || state === void 0 ? void 0 : state.feature;
  var runwayText = Array.isArray(feature === null || feature === void 0 ? void 0 : feature.runways) ? feature.runways.join('\n') : '';
  if (typeof window.renderAirportMetarLoadingWidget === 'function') {
    return window.renderAirportMetarLoadingWidget(feature === null || feature === void 0 ? void 0 : feature.icao, runwayText, {
      responsiveEmbed: true
    });
  }
  return '<div class="ga-map-context-loading" data-ga-metar-loading="true">METAR wird geladen…</div>';
}
function hydrateMapContextAirportWidget(state) {
  var _feature$runways3;
  var feature = state === null || state === void 0 ? void 0 : state.feature;
  var config = getMapContextAirportWidgetConfig(state);
  if (!feature || !config || state !== mapContextInfoState) return;
  var weatherElement = document.getElementById(config.wxId);
  if (feature.icao && (_feature$runways3 = feature.runways) !== null && _feature$runways3 !== void 0 && _feature$runways3.length && typeof runwayCache !== 'undefined' && !runwayCache[feature.icao]) {
    runwayCache[feature.icao] = feature.runways.join('\n');
  }
  if (state.airportWidgetWeatherHtml) {
    if (weatherElement) weatherElement.innerHTML = state.airportWidgetWeatherHtml;
  } else if (weatherElement) {
    weatherElement.innerHTML = renderMapContextAirportWeatherPlaceholder(state);
  }
  if (typeof updatePopupFrequencyBlock === 'function') {
    updatePopupFrequencyBlock(config.freqId, feature.icao);
  }
  if (typeof refreshAipOverlayPopupUi === 'function') {
    refreshAipOverlayPopupUi(feature.icao);
  }
  if (state.airportWidgetLoadingStarted) return;
  state.airportWidgetLoadingStarted = true;
  if (typeof fetchRunwayDetails === 'function') {
    fetchRunwayDetails(feature.lat, feature.lon, config.runwayId, feature.icao);
  }
  if (typeof fetchAirportFreq === 'function') {
    var hasCachedFrequencies = typeof freqCache !== 'undefined' && Object.prototype.hasOwnProperty.call(freqCache, feature.icao);
    if (!hasCachedFrequencies) {
      fetchAirportFreq(feature.icao, null, null).finally(() => {
        if (state === mapContextInfoState) {
          updatePopupFrequencyBlock(config.freqId, feature.icao);
        }
      });
    }
  }
  if (typeof loadMetarWidget === 'function' && !state.airportWidgetWeatherHtml) {
    loadMetarWidget(feature.icao, config.wxId, feature.lat, feature.lon, true, {
      preserveLoadingContent: true,
      skipRunwayWait: true,
      responsiveEmbed: true,
      runwayIcao: feature.icao
    });
  }
}
function renderMapContextFeature(state) {
  var _feature$frequencies3;
  if (state.loading.feature && !state.feature) {
    return '<div class="ga-map-context-loading">Objekte am Punkt werden geprüft…</div>';
  }
  var feature = state.feature;
  if (!feature) return '';
  var selected = state.selectedFeatureId === feature.id;
  if (feature.kind === 'airport') {
    return buildMapContextAirportWidget(state, selected);
  }
  var isReportingPoint = feature.kind === 'vrp';
  var title = isReportingPoint ? feature.name : [feature.identifier, feature.name].filter(Boolean).join(' · ');
  var details = isReportingPoint ? [feature.airportIcao ? `Zugehöriger Flugplatz ${feature.airportIcao}` : '', feature.description].filter(Boolean) : [feature.typeLabel, (_feature$frequencies3 = feature.frequencies) !== null && _feature$frequencies3 !== void 0 && _feature$frequencies3.length ? `Funk ${feature.frequencies.join('; ')}` : '', feature.channel ? `Kanal ${feature.channel}` : '', feature.range ? `Reichweite ${feature.range}` : ''].filter(Boolean);
  return `
        <button type="button" class="ga-map-context-feature${selected ? ' is-selected' : ''}"
                data-map-context-feature-id="${escapePopupText(feature.id)}"
                aria-pressed="${selected ? 'true' : 'false'}">
            <span class="ga-map-context-feature-kind">${isReportingPoint ? 'VRP · VFR-MELDEPUNKT' : 'NAVAID'}</span>
            <b>${escapePopupText(title || (isReportingPoint ? 'VFR-Meldepunkt' : 'Navaid'))}</b>
            ${details.map(detail => `<span>${escapePopupText(detail)}</span>`).join('')}
            ${selected ? '<span class="ga-map-context-feature-action">Markiert · erneut antippen zum Lösen</span>' : ''}
        </button>`;
}
function positionMapContextPopupBesideAnchor(state) {
  if (!state || state.popupPositioned || state.popupPositionScheduled) return;
  state.popupPositionScheduled = true;
  window.requestAnimationFrame(() => {
    var _mapContextPopupLayer, _mapContextPopupLayer2, _mapContextPopupLayer3;
    if (!state || state !== mapContextInfoState || !((_mapContextPopupLayer = mapContextPopupLayer) !== null && _mapContextPopupLayer !== void 0 && _mapContextPopupLayer._container)) return;
    state.popupPositionScheduled = false;
    if (state.popupPositioned) return;
    state.popupPositioned = true;
    var popupElement = mapContextPopupLayer._container;
    var wrapper = popupElement.querySelector('.leaflet-popup-content-wrapper');
    var width = Number(mapContextPopupLayer._containerWidth) || popupElement.offsetWidth;
    var height = (wrapper === null || wrapper === void 0 ? void 0 : wrapper.offsetHeight) || popupElement.offsetHeight;
    mapContextPopupLayer.options.offset = L.point(Math.round(width / 2 + 16), Math.round(height / 2));
    (_mapContextPopupLayer2 = (_mapContextPopupLayer3 = mapContextPopupLayer).update) === null || _mapContextPopupLayer2 === void 0 || _mapContextPopupLayer2.call(_mapContextPopupLayer3);
    window.requestAnimationFrame(() => {
      var _map$getContainer, _map, _mapContextPopupLayer4, _mapContextPopupLayer5, _mapElement$getBoundi;
      if (state !== mapContextInfoState || !mapContextPopupLayer) return;
      var mapElement = (_map$getContainer = (_map = map).getContainer) === null || _map$getContainer === void 0 ? void 0 : _map$getContainer.call(_map);
      var popupRect = (_mapContextPopupLayer4 = mapContextPopupLayer._container) === null || _mapContextPopupLayer4 === void 0 || (_mapContextPopupLayer5 = _mapContextPopupLayer4.getBoundingClientRect) === null || _mapContextPopupLayer5 === void 0 ? void 0 : _mapContextPopupLayer5.call(_mapContextPopupLayer4);
      var mapRect = mapElement === null || mapElement === void 0 || (_mapElement$getBoundi = mapElement.getBoundingClientRect) === null || _mapElement$getBoundi === void 0 ? void 0 : _mapElement$getBoundi.call(mapElement);
      if (!popupRect || !mapRect) return;
      var padding = 4;
      var panX = 0;
      var panY = 0;
      if (popupRect.right > mapRect.right - padding) {
        panX = popupRect.right - (mapRect.right - padding);
      } else if (popupRect.left < mapRect.left + padding) {
        panX = popupRect.left - (mapRect.left + padding);
      }
      if (popupRect.bottom > mapRect.bottom - padding) {
        panY = popupRect.bottom - (mapRect.bottom - padding);
      } else if (popupRect.top < mapRect.top + padding) {
        panY = popupRect.top - (mapRect.top + padding);
      }
      if (panX || panY) {
        var nextCenterPoint = map.getSize().divideBy(2).add(L.point(Math.round(panX), Math.round(panY)));
        map.setView(map.containerPointToLatLng(nextCenterPoint), map.getZoom(), {
          animate: false
        });
      }
    });
  });
}
function renderMapContextInfoPopup(state) {
  var _state$content$queryS, _state$content, _map2, _map2$getContainer, _mapContextPopupLayer6, _mapContextPopupLayer7;
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  if (!state || state !== mapContextInfoState || !state.content) return;
  var preserveDetailsScroll = Boolean(options.preserveDetailsScroll);
  var previousDetailsScrollTop = preserveDetailsScroll ? Number((_state$content$queryS = (_state$content = state.content).querySelector) === null || _state$content$queryS === void 0 || (_state$content$queryS = _state$content$queryS.call(_state$content, '.ga-map-context-details')) === null || _state$content$queryS === void 0 ? void 0 : _state$content$queryS.scrollTop) : null;
  captureMapContextAirportWidgetState(state);
  var mapHeight = Number((_map2 = map) === null || _map2 === void 0 || (_map2$getContainer = _map2.getContainer) === null || _map2$getContainer === void 0 || (_map2$getContainer = _map2$getContainer.call(_map2)) === null || _map2$getContainer === void 0 ? void 0 : _map2$getContainer.clientHeight);
  if (Number.isFinite(mapHeight) && mapHeight > 0) {
    state.content.style.setProperty('--ga-map-context-map-height', `${Math.round(mapHeight)}px`);
  }
  var terrain = state.loading.terrain ? '<div class="ga-map-context-loading">Topografie wird geladen…</div>' : state.terrainFt != null && Number.isFinite(Number(state.terrainFt)) ? `<div class="ga-map-context-summary"><span><b>Gelände</b> ${Math.round(Number(state.terrainFt))} ft MSL / ${Math.round(Number(state.terrainFt) / 3.28084)} m</span></div>` : '<div class="ga-map-context-muted">Geländehöhe nicht verfügbar.</div>';
  state.content.innerHTML = `
        <div class="ga-map-context-panel">
            <div class="ga-map-context-heading">
                <span class="ga-map-context-kicker">WAS IST HIER?</span>
                <b>${state.latlng.lat.toFixed(5)}, ${state.latlng.lng.toFixed(5)}</b>
            </div>
            <div class="ga-map-context-body">
                ${renderMapContextHeightBand(state)}
                <div class="ga-map-context-details">
                    ${renderMapContextFeature(state)}
                    <section>
                        <h4>Lufträume</h4>
                        ${renderMapContextAirspaces(state)}
                    </section>
                    <section>
                        <h4>Punkt</h4>
                        ${terrain}
                    </section>
                    <section>
                        <h4>Wetter</h4>
                        ${renderMapContextWeather(state)}
                    </section>
                </div>
            </div>
        </div>`;
  hydrateMapContextAirportWidget(state);
  (_mapContextPopupLayer6 = mapContextPopupLayer) === null || _mapContextPopupLayer6 === void 0 || (_mapContextPopupLayer7 = _mapContextPopupLayer6.update) === null || _mapContextPopupLayer7 === void 0 || _mapContextPopupLayer7.call(_mapContextPopupLayer6);
  positionMapContextPopupBesideAnchor(state);
  if (preserveDetailsScroll && Number.isFinite(previousDetailsScrollTop)) {
    var restoreDetailsScroll = () => {
      var _state$content$queryS2, _state$content2;
      if (state !== mapContextInfoState || !state.content) return;
      var details = (_state$content$queryS2 = (_state$content2 = state.content).querySelector) === null || _state$content$queryS2 === void 0 ? void 0 : _state$content$queryS2.call(_state$content2, '.ga-map-context-details');
      if (!details) return;
      var maximum = Math.max(0, details.scrollHeight - details.clientHeight);
      details.scrollTop = Math.min(previousDetailsScrollTop, maximum);
    };
    restoreDetailsScroll();
    window.requestAnimationFrame(restoreDetailsScroll);
  }
}
function highlightMapContextAirspace(airspaceId) {
  var _state$airspaces, _window$gaMapContextH2, _mapContextAirspaceHi, _mapContextAirspaceHi2, _mapContextPointLayer, _mapContextPointLayer2;
  var state = mapContextInfoState;
  if (!state || !map) return;
  var airspace = (_state$airspaces = state.airspaces) === null || _state$airspaces === void 0 ? void 0 : _state$airspaces.find(item => String(item.__mapContextId) === String(airspaceId));
  if (!(airspace !== null && airspace !== void 0 && airspace.geometry)) return;
  if (state.selectedAirspaceId === String(airspaceId)) {
    clearMapContextAirspaceHighlight();
    state.selectedAirspaceId = '';
    renderMapContextInfoPopup(state, {
      preserveDetailsScroll: true
    });
    return;
  }
  clearMapContextAirspaceHighlight();
  clearMapContextObjectHighlight();
  if (typeof window.gaClearRouteToolMapFocus === 'function') window.gaClearRouteToolMapFocus();
  var style = mapContextAirspaceStyle(airspace);
  mapContextAirspaceHighlightLayer = L.geoJSON(airspace.geometry, {
    pane: ((_window$gaMapContextH2 = window.gaMapContextHost) === null || _window$gaMapContextH2 === void 0 ? void 0 : _window$gaMapContextH2.pane) || GA_MAP_OVERLAY_PANES.localAviation.name,
    interactive: false,
    style: {
      color: style.mapColor || style.color || '#4da6ff',
      weight: 4,
      opacity: 1,
      fillColor: style.mapColor || style.color || '#4da6ff',
      fillOpacity: 0.24,
      dashArray: '8,5',
      className: 'ga-map-context-airspace-highlight'
    }
  }).addTo(map);
  (_mapContextAirspaceHi = (_mapContextAirspaceHi2 = mapContextAirspaceHighlightLayer).bringToFront) === null || _mapContextAirspaceHi === void 0 || _mapContextAirspaceHi.call(_mapContextAirspaceHi2);
  (_mapContextPointLayer = mapContextPointLayer) === null || _mapContextPointLayer === void 0 || (_mapContextPointLayer2 = _mapContextPointLayer.bringToFront) === null || _mapContextPointLayer2 === void 0 || _mapContextPointLayer2.call(_mapContextPointLayer);
  state.selectedAirspaceId = String(airspaceId);
  state.selectedFeatureId = '';
  renderMapContextInfoPopup(state, {
    preserveDetailsScroll: true
  });
}
function highlightMapContextFeature(featureId) {
  var _window$gaMapContextH3, _mapContextObjectHigh, _mapContextObjectHigh2, _mapContextPointLayer3, _mapContextPointLayer4;
  var state = mapContextInfoState;
  var feature = state === null || state === void 0 ? void 0 : state.feature;
  if (!state || !map || !feature || String(feature.id) !== String(featureId)) return;
  if (state.selectedFeatureId === String(featureId)) {
    clearMapContextObjectHighlight();
    state.selectedFeatureId = '';
    renderMapContextInfoPopup(state, {
      preserveDetailsScroll: true
    });
    return;
  }
  clearMapContextAirspaceHighlight();
  clearMapContextObjectHighlight();
  if (typeof window.gaClearRouteToolMapFocus === 'function') window.gaClearRouteToolMapFocus();
  mapContextObjectHighlightLayer = L.circleMarker([feature.lat, feature.lon], {
    pane: ((_window$gaMapContextH3 = window.gaMapContextHost) === null || _window$gaMapContextH3 === void 0 ? void 0 : _window$gaMapContextH3.pane) || GA_MAP_OVERLAY_PANES.localAviation.name,
    radius: feature.kind === 'airport' ? 13 : 11,
    color: '#facc15',
    weight: 4,
    opacity: 1,
    fillColor: feature.kind === 'airport' ? '#f59e0b' : feature.kind === 'vrp' ? '#facc15' : '#22d3ee',
    fillOpacity: 0.32,
    interactive: false,
    className: 'ga-map-context-object-highlight'
  }).addTo(map);
  (_mapContextObjectHigh = (_mapContextObjectHigh2 = mapContextObjectHighlightLayer).bringToFront) === null || _mapContextObjectHigh === void 0 || _mapContextObjectHigh.call(_mapContextObjectHigh2);
  (_mapContextPointLayer3 = mapContextPointLayer) === null || _mapContextPointLayer3 === void 0 || (_mapContextPointLayer4 = _mapContextPointLayer3.bringToFront) === null || _mapContextPointLayer4 === void 0 || _mapContextPointLayer4.call(_mapContextPointLayer3);
  state.selectedFeatureId = String(featureId);
  state.selectedAirspaceId = '';
  renderMapContextInfoPopup(state, {
    preserveDetailsScroll: true
  });
}
window.gaUpdateMapContextOwnAltitude = function (altitudeFt) {
  var _mapContextPopupLayer8, _state$content3, _state$content3$query;
  var state = mapContextInfoState;
  if (!state || ((_mapContextPopupLayer8 = mapContextPopupLayer) === null || _mapContextPopupLayer8 === void 0 ? void 0 : _mapContextPopupLayer8._map) !== map) return;
  var value = Number(altitudeFt);
  var hasValue = altitudeFt !== null && altitudeFt !== undefined && altitudeFt !== '';
  state.currentAltitudeFt = hasValue && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
  var nextBandData = getMapContextHeightBandData(state);
  var marker = (_state$content3 = state.content) === null || _state$content3 === void 0 || (_state$content3$query = _state$content3.querySelector) === null || _state$content3$query === void 0 ? void 0 : _state$content3$query.call(_state$content3, '[data-map-context-own-altitude]');
  if (Number(state.heightBandMaxFt) !== Number(nextBandData.maxFt) || Number.isFinite(nextBandData.currentAltitudeFt) && !marker || !Number.isFinite(nextBandData.currentAltitudeFt) && marker) {
    renderMapContextInfoPopup(state);
    return;
  }
  if (!marker || !Number.isFinite(nextBandData.currentAltitudeFt)) return;
  var topPct = Math.max(1, Math.min(99, 100 - nextBandData.currentAltitudeFt / nextBandData.maxFt * 100));
  marker.style.top = `${topPct.toFixed(2)}%`;
  marker.setAttribute('aria-label', `Eigene Flughöhe ${Math.round(nextBandData.currentAltitudeFt)} Fuß MSL`);
  marker.title = `Eigene Flughöhe · ${Math.round(nextBandData.currentAltitudeFt).toLocaleString('de-DE')} ft MSL`;
};
function openMapContextInfo(latlng) {
  var _map$getContainer2, _map3;
  var source = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'longpress';
  if (!map || !latlng || !Number.isFinite(latlng.lat) || !Number.isFinite(latlng.lng)) return;
  var now = Date.now();
  var duplicate = now - mapContextLastOpen.at < 900 && Math.abs(latlng.lat - mapContextLastOpen.lat) < 0.0001 && Math.abs(latlng.lng - mapContextLastOpen.lon) < 0.0001;
  if (duplicate) return;
  mapContextLastOpen = {
    at: now,
    lat: latlng.lat,
    lon: latlng.lng
  };
  mapContextSuppressClickUntil = now + 900;
  mapContextRequestSeq += 1;
  var requestSeq = mapContextRequestSeq;
  clearMapContextPointLayer();
  clearMapContextAirspaceHighlight();
  clearMapContextObjectHighlight();
  if (typeof window.gaClearRouteToolMapFocus === 'function') window.gaClearRouteToolMapFocus();
  var content = document.createElement('div');
  var cachedFeature = findCachedMapContextFeature(latlng);
  var state = {
    requestSeq,
    source,
    latlng: L.latLng(latlng.lat, latlng.lng),
    content,
    loading: {
      airspaces: true,
      terrain: true,
      weather: true,
      feature: true
    },
    airspaces: [],
    terrainFt: null,
    weather: null,
    feature: cachedFeature,
    currentAltitudeFt: getMapContextCurrentAltitudeFt(),
    selectedAirspaceId: '',
    selectedFeatureId: '',
    popupPositioned: false,
    popupPositionScheduled: false
  };
  mapContextInfoState = state;
  content.addEventListener('click', event => {
    var _event$target, _event$target$closest, _event$target2, _event$target2$closes;
    var airspaceButton = (_event$target = event.target) === null || _event$target === void 0 || (_event$target$closest = _event$target.closest) === null || _event$target$closest === void 0 ? void 0 : _event$target$closest.call(_event$target, '[data-map-context-airspace-id]');
    var featureButton = (_event$target2 = event.target) === null || _event$target2 === void 0 || (_event$target2$closes = _event$target2.closest) === null || _event$target2$closes === void 0 ? void 0 : _event$target2$closes.call(_event$target2, '[data-map-context-feature-id]');
    if (airspaceButton) {
      event.preventDefault();
      event.stopPropagation();
      highlightMapContextAirspace(airspaceButton.dataset.mapContextAirspaceId || '');
    } else if (featureButton) {
      event.preventDefault();
      event.stopPropagation();
      highlightMapContextFeature(featureButton.dataset.mapContextFeatureId || '');
    }
  });
  mapContextPointLayer = L.circleMarker(state.latlng, {
    radius: 7,
    color: '#ffffff',
    weight: 2,
    fillColor: '#00d9ff',
    fillOpacity: 0.92,
    interactive: false,
    className: 'ga-map-context-point'
  }).addTo(map);
  if (!mapContextPopupLayer) {
    mapContextPopupLayer = L.popup({
      className: 'ga-map-context-popup',
      minWidth: 248,
      maxWidth: 500,
      maxHeight: 680,
      offset: [160, 190],
      autoPan: false,
      autoPanPadding: [18, 18]
    });
  }
  mapContextPopupLayer.setLatLng(state.latlng).setContent(content).openOn(map);
  (_map$getContainer2 = (_map3 = map).getContainer) === null || _map$getContainer2 === void 0 || (_map$getContainer2 = _map$getContainer2.call(_map3)) === null || _map$getContainer2 === void 0 || _map$getContainer2.classList.add('ga-map-context-open');
  renderMapContextInfoPopup(state);
  window.setTimeout(() => {
    var _mapContextPopupLayer9;
    if (state !== mapContextInfoState || ((_mapContextPopupLayer9 = mapContextPopupLayer) === null || _mapContextPopupLayer9 === void 0 ? void 0 : _mapContextPopupLayer9._map) !== map) return;
    state.popupPositioned = false;
    state.popupPositionScheduled = false;
    positionMapContextPopupBesideAnchor(state);
  }, 800);
  var settle = (section, value) => {
    if (!mapContextInfoState || mapContextInfoState.requestSeq !== requestSeq) return;
    state.loading[section] = false;
    if (section === 'airspaces') state.airspaces = Array.isArray(value) ? value : [];
    if (section === 'terrain') state.terrainFt = value != null && Number.isFinite(Number(value)) ? Number(value) : null;
    if (section === 'weather') state.weather = value || null;
    if (section === 'feature') state.feature = value || state.feature || null;
    renderMapContextInfoPopup(state);
  };
  Promise.resolve(fetchMapContextAirspaces(state.latlng)).then(value => settle('airspaces', value)).catch(error => {
    console.warn('[Map Context] Luftraumabfrage fehlgeschlagen:', error);
    settle('airspaces', []);
  });
  Promise.resolve(fetchMapContextTerrainFt(state.latlng)).then(value => settle('terrain', value)).catch(error => {
    console.warn('[Map Context] Terrainabfrage fehlgeschlagen:', error);
    settle('terrain', null);
  });
  Promise.resolve(fetchMapContextWeather(state.latlng)).then(value => settle('weather', value)).catch(error => {
    console.warn('[Map Context] Wetterabfrage fehlgeschlagen:', error);
    settle('weather', null);
  });
  Promise.resolve(fetchMapContextNearbyFeature(state.latlng)).then(value => settle('feature', value)).catch(error => {
    console.warn('[Map Context] Objektabfrage fehlgeschlagen:', error);
    settle('feature', cachedFeature);
  });
}
window.gaOpenMapContextInfo = openMapContextInfo;
window.gaMapContextPopupClosed = function (event) {
  var _map$getContainer3;
  if (event.popup !== mapContextPopupLayer) return;
  dismissMapContextInfo();
  (_map$getContainer3 = map.getContainer()) === null || _map$getContainer3 === void 0 || _map$getContainer3.classList.remove('ga-map-context-open');
};
