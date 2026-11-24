// Generated from airport-weather.js by sync-efb-web-assets.js. Do not edit.
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i.return) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
// UI language (i18n-core.js, web only). In the EFB there is no GAI18n: the German text is used.
function _awText(key, german, vars) {
  var i18n = typeof window !== 'undefined' ? window.GAI18n : null;
  if (i18n) return i18n.t(key, vars, german);
  return String(german).replace(/\{([a-zA-Z0-9_]+)\}/g, function (m, n) {
    return vars && Object.prototype.hasOwnProperty.call(vars, n) ? String(vars[n]) : m;
  });
}
function getAirportWeatherCache() {
  var _window$gaAirportWeat;
  return ((_window$gaAirportWeat = window.gaAirportWeatherHost) === null || _window$gaAirportWeat === void 0 ? void 0 : _window$gaAirportWeat.cache) || gpsState;
}
// Shared standalone airport METAR widget and station cache.
function _parseMetarPayloadToArray(txt) {
  if (typeof txt !== 'string') return null;
  var t = txt.trim();
  if (!t) return null;
  try {
    var parsed = JSON.parse(t);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.data)) return parsed.data;
    if (parsed && Array.isArray(parsed.results)) return parsed.results;
    if (parsed && typeof parsed.contents === 'string') {
      var nested = JSON.parse(parsed.contents);
      return Array.isArray(nested) ? nested : null;
    }
  } catch (_) {}
  return null;
}
function _fetchWithTimeout(_x) {
  return _fetchWithTimeout2.apply(this, arguments);
}
function _fetchWithTimeout2() {
  _fetchWithTimeout2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(url) {
    var _window$gaAirportWeat2;
    var timeoutMs,
      controller,
      timeoutId,
      _args2 = arguments;
    return _regenerator().w(function (_context2) {
      while (1) switch (_context2.p = _context2.n) {
        case 0:
          timeoutMs = _args2.length > 1 && _args2[1] !== undefined ? _args2[1] : 2500;
          if (!((_window$gaAirportWeat2 = window.gaAirportWeatherHost) !== null && _window$gaAirportWeat2 !== void 0 && _window$gaAirportWeat2.fetchWithTimeout)) {
            _context2.n = 1;
            break;
          }
          return _context2.a(2, window.gaAirportWeatherHost.fetchWithTimeout(url, timeoutMs));
        case 1:
          controller = new AbortController();
          timeoutId = setTimeout(() => controller.abort(), Math.max(250, Number(timeoutMs) || 2500));
          _context2.p = 2;
          _context2.n = 3;
          return fetch(url, {
            signal: controller.signal
          });
        case 3:
          return _context2.a(2, _context2.v);
        case 4:
          _context2.p = 4;
          clearTimeout(timeoutId);
          return _context2.f(4);
        case 5:
          return _context2.a(2);
      }
    }, _callee2, null, [[2,, 4, 5]]);
  }));
  return _fetchWithTimeout2.apply(this, arguments);
}
function _fetchMetarArrayViaVariants(_x2) {
  return _fetchMetarArrayViaVariants2.apply(this, arguments);
}
function _fetchMetarArrayViaVariants2() {
  _fetchMetarArrayViaVariants2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(sourceUrl) {
    var _ref8,
      _ref8$includeCodeTabs,
      includeCodeTabs,
      _ref8$includeDirect,
      includeDirect,
      _ref8$retries,
      retries,
      _ref8$timeoutMs,
      timeoutMs,
      _ref8$retryDelayMs,
      retryDelayMs,
      _ref8$retryErrorsOnly,
      retryErrorsOnly,
      variants,
      maxRetries,
      attempt,
      retryable,
      _iterator2,
      _step2,
      url,
      res,
      txt,
      arr,
      _args3 = arguments,
      _t,
      _t2;
    return _regenerator().w(function (_context3) {
      while (1) switch (_context3.p = _context3.n) {
        case 0:
          _ref8 = _args3.length > 1 && _args3[1] !== undefined ? _args3[1] : {}, _ref8$includeCodeTabs = _ref8.includeCodeTabs, includeCodeTabs = _ref8$includeCodeTabs === void 0 ? false : _ref8$includeCodeTabs, _ref8$includeDirect = _ref8.includeDirect, includeDirect = _ref8$includeDirect === void 0 ? false : _ref8$includeDirect, _ref8$retries = _ref8.retries, retries = _ref8$retries === void 0 ? 1 : _ref8$retries, _ref8$timeoutMs = _ref8.timeoutMs, timeoutMs = _ref8$timeoutMs === void 0 ? 2500 : _ref8$timeoutMs, _ref8$retryDelayMs = _ref8.retryDelayMs, retryDelayMs = _ref8$retryDelayMs === void 0 ? 0 : _ref8$retryDelayMs, _ref8$retryErrorsOnly = _ref8.retryErrorsOnly, retryErrorsOnly = _ref8$retryErrorsOnly === void 0 ? false : _ref8$retryErrorsOnly;
          variants = [];
          if (includeDirect) variants.push(sourceUrl);
          variants.push(`https://ga-proxy.einherjer.workers.dev/api/metar?src=${encodeURIComponent(sourceUrl)}`);
          if (includeCodeTabs) variants.push(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(sourceUrl)}`);
          maxRetries = Math.max(1, Number(retries) || 1);
          attempt = 0;
        case 1:
          if (!(attempt < maxRetries)) {
            _context3.n = 17;
            break;
          }
          retryable = false;
          _iterator2 = _createForOfIteratorHelper(variants);
          _context3.p = 2;
          _iterator2.s();
        case 3:
          if ((_step2 = _iterator2.n()).done) {
            _context3.n = 11;
            break;
          }
          url = _step2.value;
          _context3.p = 4;
          _context3.n = 5;
          return _fetchWithTimeout(url, timeoutMs);
        case 5:
          res = _context3.v;
          if (!(!res.ok || res.status === 204)) {
            _context3.n = 6;
            break;
          }
          if (res.status >= 500) retryable = true;
          return _context3.a(3, 10);
        case 6:
          _context3.n = 7;
          return res.text();
        case 7:
          txt = _context3.v;
          arr = _parseMetarPayloadToArray(txt);
          if (!(Array.isArray(arr) && arr.length)) {
            _context3.n = 8;
            break;
          }
          return _context3.a(2, arr);
        case 8:
          _context3.n = 10;
          break;
        case 9:
          _context3.p = 9;
          _t = _context3.v;
          retryable = true;
        case 10:
          _context3.n = 3;
          break;
        case 11:
          _context3.n = 13;
          break;
        case 12:
          _context3.p = 12;
          _t2 = _context3.v;
          _iterator2.e(_t2);
        case 13:
          _context3.p = 13;
          _iterator2.f();
          return _context3.f(13);
        case 14:
          if (!(retryErrorsOnly && !retryable)) {
            _context3.n = 15;
            break;
          }
          return _context3.a(3, 17);
        case 15:
          if (!(attempt < maxRetries - 1 && retryDelayMs > 0)) {
            _context3.n = 16;
            break;
          }
          _context3.n = 16;
          return new Promise(resolve => setTimeout(resolve, retryDelayMs));
        case 16:
          attempt++;
          _context3.n = 1;
          break;
        case 17:
          return _context3.a(2, null);
      }
    }, _callee3, null, [[4, 9], [2, 12, 13, 14]]);
  }));
  return _fetchMetarArrayViaVariants2.apply(this, arguments);
}
var METAR_MEMORY_CACHE_TTL_MS = 10 * 60 * 1000;
var metarMemoryCachePruneTimer = null;
function _isFreshMetarMemoryEntry(entry) {
  var now = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Date.now();
  var cachedAt = Number(entry === null || entry === void 0 ? void 0 : entry.cachedAt);
  return Number.isFinite(cachedAt) && cachedAt > 0 && now - cachedAt < METAR_MEMORY_CACHE_TTL_MS;
}
function _scheduleMetarMemoryCachePrune() {
  var _getAirportWeatherCac, _getAirportWeatherCac2;
  if (metarMemoryCachePruneTimer) {
    clearTimeout(metarMemoryCachePruneTimer);
    metarMemoryCachePruneTimer = null;
  }
  var expiries = [].concat(_toConsumableArray(Object.values(((_getAirportWeatherCac = getAirportWeatherCache()) === null || _getAirportWeatherCac === void 0 ? void 0 : _getAirportWeatherCac.metarCache) || {}).map(entry => Number(entry === null || entry === void 0 ? void 0 : entry.cachedAt) + METAR_MEMORY_CACHE_TTL_MS)), _toConsumableArray((Array.isArray((_getAirportWeatherCac2 = getAirportWeatherCache()) === null || _getAirportWeatherCac2 === void 0 ? void 0 : _getAirportWeatherCac2.metarRegionCache) ? getAirportWeatherCache().metarRegionCache : []).map(entry => Number(entry === null || entry === void 0 ? void 0 : entry.cachedAt) + METAR_MEMORY_CACHE_TTL_MS))).filter(Number.isFinite);
  if (!expiries.length) return;
  var nextExpiry = Math.min.apply(Math, _toConsumableArray(expiries));
  metarMemoryCachePruneTimer = setTimeout(() => {
    metarMemoryCachePruneTimer = null;
    _pruneMetarMemoryCache();
  }, Math.max(250, nextExpiry - Date.now() + 25));
}
function _pruneMetarMemoryCache() {
  var now = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Date.now();
  if (!getAirportWeatherCache().metarCache || typeof getAirportWeatherCache().metarCache !== 'object') {
    getAirportWeatherCache().metarCache = {};
  }
  Object.keys(getAirportWeatherCache().metarCache).forEach(key => {
    if (!_isFreshMetarMemoryEntry(getAirportWeatherCache().metarCache[key], now)) {
      delete getAirportWeatherCache().metarCache[key];
    }
  });
  getAirportWeatherCache().metarRegionCache = (Array.isArray(getAirportWeatherCache().metarRegionCache) ? getAirportWeatherCache().metarRegionCache : []).filter(entry => _isFreshMetarMemoryEntry(entry, now));
  _scheduleMetarMemoryCachePrune();
}
function _getMetarMemoryEntry(key) {
  var _getAirportWeatherCac3;
  var normalizedKey = String(key || '').trim().toUpperCase();
  if (!normalizedKey) return null;
  var entry = (_getAirportWeatherCac3 = getAirportWeatherCache().metarCache) === null || _getAirportWeatherCac3 === void 0 ? void 0 : _getAirportWeatherCac3[normalizedKey];
  if (!_isFreshMetarMemoryEntry(entry)) {
    if (entry) delete getAirportWeatherCache().metarCache[normalizedKey];
    return null;
  }
  return entry;
}
function _setMetarMemoryEntry(key, entry) {
  var normalizedKey = String(key || '').trim().toUpperCase();
  if (!normalizedKey || !entry) return null;
  var cachedEntry = _objectSpread(_objectSpread({}, entry), {}, {
    cachedAt: Number(entry.cachedAt) || Date.now()
  });
  getAirportWeatherCache().metarCache[normalizedKey] = cachedEntry;
  _scheduleMetarMemoryCachePrune();
  return cachedEntry;
}
function _storeMetarRegion(data, bounds) {
  var candidates = (Array.isArray(data) ? data : []).filter(item => item && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)));
  if (!candidates.length || !bounds) return;
  var cachedAt = Date.now();
  var entry = {
    data: candidates,
    bounds: {
      latMin: Number(bounds.latMin),
      lonMin: Number(bounds.lonMin),
      latMax: Number(bounds.latMax),
      lonMax: Number(bounds.lonMax)
    },
    cachedAt
  };
  getAirportWeatherCache().metarRegionCache = (Array.isArray(getAirportWeatherCache().metarRegionCache) ? getAirportWeatherCache().metarRegionCache : []).filter(region => {
    if (!_isFreshMetarMemoryEntry(region, cachedAt)) return false;
    var current = region.bounds || {};
    return !(Number(current.latMin) === entry.bounds.latMin && Number(current.lonMin) === entry.bounds.lonMin && Number(current.latMax) === entry.bounds.latMax && Number(current.lonMax) === entry.bounds.lonMax);
  });
  getAirportWeatherCache().metarRegionCache.push(entry);
  candidates.forEach(station => {
    var stationIcao = String(station.icaoId || station.icao || '').trim().toUpperCase();
    if (!stationIcao) return;
    var stationEntry = {
      data: [station],
      isFallback: false,
      foundIcao: stationIcao,
      cachedAt
    };
    _setMetarMemoryEntry(stationIcao, stationEntry);
    _setMetarMemoryEntry(`STATION:${stationIcao}`, stationEntry);
  });
  _scheduleMetarMemoryCachePrune();
}
function _getCachedMetarRegionForPoint(lat, lon) {
  var pointLat = Number(lat);
  var pointLon = Number(lon);
  if (![pointLat, pointLon].every(Number.isFinite)) return null;
  _pruneMetarMemoryCache();
  return (Array.isArray(getAirportWeatherCache().metarRegionCache) ? getAirportWeatherCache().metarRegionCache : []).filter(entry => {
    var bounds = (entry === null || entry === void 0 ? void 0 : entry.bounds) || {};
    return pointLat >= Number(bounds.latMin) && pointLat <= Number(bounds.latMax) && pointLon >= Number(bounds.lonMin) && pointLon <= Number(bounds.lonMax);
  }).sort((a, b) => Number(b.cachedAt) - Number(a.cachedAt))[0] || null;
}
function _selectMetarForAirport(candidates, icao, lat, lon) {
  var items = (Array.isArray(candidates) ? candidates : []).filter(item => item && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)));
  if (!items.length) return null;
  var requestedIcao = String(icao || '').trim().toUpperCase();
  var direct = items.find(item => String(item.icaoId || item.icao || '').trim().toUpperCase() === requestedIcao);
  if (direct) return {
    station: direct,
    isFallback: false
  };
  var closest = items[0];
  var minDist = calcNav(lat, lon, Number(closest.lat), Number(closest.lon)).dist;
  for (var index = 1; index < items.length; index += 1) {
    var distance = calcNav(lat, lon, Number(items[index].lat), Number(items[index].lon)).dist;
    if (distance < minDist) {
      minDist = distance;
      closest = items[index];
    }
  }
  return {
    station: closest,
    isFallback: true
  };
}
function _escapeMetarWidgetText(value) {
  return String(value !== null && value !== void 0 ? value : '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function _getMetarRunwayVisualData(runwayText) {
  var match = String(runwayText || '').match(/(?:^|\s|\n|<br\s*\/?>)(0[1-9]|[12]\d|3[0-6])([LRC]?)\s*\/\s*((?:0[1-9]|[12]\d|3[0-6])[LRC]?)/);
  if (!match) return null;
  return {
    headingDeg: parseInt(match[1], 10) * 10,
    end1: `${match[1]}${match[2]}`,
    end2: match[3]
  };
}
function _renderMetarCompassTicks() {
  var ticks = '';
  for (var heading = 0; heading < 360; heading += 5) {
    var isCardinal = heading % 90 === 0;
    var isLong = heading % 10 === 0;
    var length = isCardinal ? 8 : isLong ? 5 : 3;
    var strokeWidth = isCardinal ? 2 : 1;
    var color = isCardinal ? '#111' : '#888';
    ticks += `<line x1="80" y1="2" x2="80" y2="${2 + length}" stroke="${color}" stroke-width="${strokeWidth}" transform="rotate(${heading} 80 80)"></line>`;
    if (heading % 30 !== 0) continue;
    var angleRad = (heading - 90) * Math.PI / 180;
    var tx = 80 + 61 * Math.cos(angleRad);
    var ty = 80 + 61 * Math.sin(angleRad);
    var label = isCardinal ? heading === 0 ? 'N' : heading === 90 ? _awText('mapContext.compass.east', 'O') : heading === 180 ? 'S' : 'W' : String(heading / 10);
    ticks += `<text x="${tx}" y="${ty}" font-family="sans-serif" font-size="${isCardinal ? 14 : 10}" fill="${isCardinal ? '#111' : '#333'}" font-weight="bold" text-anchor="middle" dominant-baseline="central">${label}</text>`;
  }
  return ticks;
}
function _renderMetarRunwayLayer(runway) {
  var _window$gaAirportPopu;
  var isMini = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  if (!runway) return '';
  if ((_window$gaAirportPopu = window.gaAirportPopupHost) !== null && _window$gaAirportPopu !== void 0 && _window$gaAirportPopu.renderRunway) return window.gaAirportPopupHost.renderRunway(runway, isMini);
  var width = isMini ? '15px' : '26px';
  var height = isMini ? '60px' : '105px';
  var fontSize = isMini ? '8px' : '10px';
  return `
        <div style="position:absolute;top:50%;left:50%;width:${width};height:${height};background:#444;border:1px solid #111;border-radius:3px;transform:translate(-50%,-50%) rotate(${runway.headingDeg}deg);transform-origin:center center;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:3px 0;box-sizing:border-box;z-index:5;box-shadow:0 2px 4px rgba(0,0,0,.4);">
            <div style="width:100%;text-align:center;font-size:${fontSize};line-height:1;color:#fff;font-weight:bold;transform:rotate(180deg);font-family:sans-serif;">${_escapeMetarWidgetText(runway.end2)}</div>
            <div style="width:2px;flex-grow:1;margin:3px 0;background:repeating-linear-gradient(to bottom,#d4d4d4 0,#d4d4d4 6px,transparent 6px,transparent 12px);"></div>
            <div style="width:100%;text-align:center;font-size:${fontSize};line-height:1;color:#fff;font-weight:bold;font-family:sans-serif;">${_escapeMetarWidgetText(runway.end1)}</div>
        </div>`;
}
window.renderAirportMetarLoadingWidget = function (icao, runwayText) {
  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var responsiveEmbed = (options === null || options === void 0 ? void 0 : options.responsiveEmbed) !== false;
  var runway = _getMetarRunwayVisualData(runwayText);
  var weatherFont = "'Courier New', Courier, monospace";
  var valueStyle = 'color:#111;font-size:13px;font-weight:bold;white-space:nowrap;';
  var labelStyle = 'color:#666;font-size:8px;font-weight:bold;letter-spacing:1px;';
  return `
        <div class="ga-weather-card ga-weather-card-loading"
             data-ga-metar-loading="true"
             style="background:#f0eada;border-radius:12px;padding:10px;border:3px solid #c2bba8;box-shadow:0 4px 8px rgba(0,0,0,.2),inset 0 2px 5px rgba(255,255,255,.5);font-family:Arial,sans-serif;color:#333;position:relative;overflow:hidden;">
            <div style="position:absolute;top:6px;left:6px;width:6px;height:6px;background:#ddd;border-radius:50%;box-shadow:inset 0 0 2px #555;"></div>
            <div style="position:absolute;bottom:6px;right:6px;width:6px;height:6px;background:#ddd;border-radius:50%;box-shadow:inset 0 0 2px #555;"></div>
            <div style="position:absolute;top:6px;right:6px;width:6px;height:6px;background:#ddd;border-radius:50%;box-shadow:inset 0 0 2px #555;"></div>
            <div style="position:absolute;bottom:6px;left:6px;width:6px;height:6px;background:#ddd;border-radius:50%;box-shadow:inset 0 0 2px #555;"></div>
            <div style="color:#8a1a12;font-size:12px;font-weight:bold;margin-bottom:5px;border-bottom:2px dashed #c2bba8;padding-bottom:4px;font-family:${weatherFont};display:flex;justify-content:space-between;align-items:center;gap:6px;letter-spacing:.5px;">
                <span>▶ STATION: ${_escapeMetarWidgetText(String(icao || '').trim().toUpperCase())}</span>
                <span class="ga-weather-loading-status" style="color:#8a6b12;font-size:10px;padding:1px 5px;border:2px solid #c69b28;border-radius:4px;background:rgba(255,255,255,.7);">${_awText('airportWx.loadingShort', 'LÄDT')}</span>
            </div>
            <div class="ga-weather-layout${responsiveEmbed ? ' ga-weather-layout-responsive' : ''}"
                 style="display:flex;justify-content:space-between;align-items:stretch;gap:5px;${responsiveEmbed ? 'flex-direction:column;' : ''}">
                <div style="display:flex;flex-direction:column;gap:3px;font-family:${weatherFont};flex-shrink:1;min-width:0;">
                    <div><div style="${labelStyle}">WIND</div><div style="${valueStyle}color:#1a73e8;">${_awText('airportWx.loading', 'WIRD GELADEN')}</div></div>
                    <div style="display:flex;gap:7px;">
                        <div><div style="${labelStyle}">VIS</div><div style="${valueStyle}">--</div></div>
                        <div><div style="${labelStyle}">WX</div><div style="${valueStyle}">--</div></div>
                    </div>
                    <div style="display:flex;gap:7px;">
                        <div><div style="${labelStyle}">TEMP</div><div style="${valueStyle}">--</div></div>
                        <div><div style="${labelStyle}">DEWP</div><div style="${valueStyle}">--</div></div>
                    </div>
                    <div style="display:flex;gap:7px;">
                        <div><div style="${labelStyle}">QNH</div><div style="${valueStyle}">--</div></div>
                        <div><div style="${labelStyle}">COVER</div><div style="${valueStyle}">--</div></div>
                    </div>
                </div>
                <div class="ga-weather-windrose"
                     aria-label="${runway ? _awText('airportWx.runway', 'Piste {rwy}', {
    rwy: `${_escapeMetarWidgetText(runway.end1)}/${_escapeMetarWidgetText(runway.end2)}`
  }) : _awText('airportWx.runwayLoading', 'Piste wird geladen')}"
                     style="position:relative;width:min(100%,148px);height:auto;aspect-ratio:1;flex:0 1 auto;align-self:center;margin:2px auto 0;border:4px solid #a8a291;border-radius:50%;background:#fcfaf5;box-shadow:inset 0 2px 8px rgba(0,0,0,.1),0 2px 6px rgba(0,0,0,.2);">
                    <svg viewBox="0 0 160 160" style="position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;">
                        ${_renderMetarCompassTicks()}
                    </svg>
                    ${_renderMetarRunwayLayer(runway)}
                </div>
            </div>
        </div>`;
};
function awLoadMetarWidget(_x3, _x4, _x5, _x6) {
  return _awLoadMetarWidget.apply(this, arguments);
} // Shared weather source and forecast cursor for all weather widgets.
function _awLoadMetarWidget() {
  _awLoadMetarWidget = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(icao, containerId, lat, lon) {
    var forceModern,
      options,
      container,
      loadOptions,
      commitAllowed,
      requestedRunwayIcao,
      isRetro,
      isOps1940,
      hasCoordinates,
      icaoNorm,
      looksLikeIcao,
      weatherLocationLabel,
      metarDataList,
      isFallback,
      foundIcao,
      cacheKey,
      cachedEntry,
      cachedRegion,
      cachedRegionSelection,
      directUrl,
      mainData,
      latMin,
      latMax,
      lonMin,
      lonMax,
      bbox,
      fbUrl,
      fbData,
      selection,
      cacheEntry,
      _container$querySelec,
      _container,
      loadingCard,
      status,
      windValue,
      metar,
      raw,
      temp,
      dewp,
      catColor,
      catText,
      cover,
      visib,
      wx,
      qnhStr,
      qMatch,
      aMatch,
      wdir,
      wspd,
      wgst,
      isVRB,
      windText,
      isMini,
      isResponsiveEmbed,
      runwayIcao,
      retries,
      headerText,
      modernHeaderText,
      runwayText,
      _window$gaAirportPopu2,
      _ref9,
      rwyHdg,
      rwy1,
      rwy2,
      svgTicks,
      i,
      isCard,
      isLong,
      len,
      sw,
      col,
      angleRad,
      tx,
      ty,
      _angleRad,
      _tx,
      _ty,
      letter,
      arrowHtml,
      rwyHtmlModern,
      rwyW,
      rwyH,
      rwyFSize,
      cSize,
      cHeight,
      gap,
      fVal,
      fLbl,
      rowGap,
      pPad,
      weatherFont,
      weatherOuterFont,
      rawTextSafe,
      miniDecoded,
      _container$querySelec2,
      _container2,
      _loadingCard,
      _status,
      _windValue,
      _isRetro,
      _isOps,
      _args4 = arguments,
      _t3;
    return _regenerator().w(function (_context4) {
      while (1) switch (_context4.p = _context4.n) {
        case 0:
          forceModern = _args4.length > 4 && _args4[4] !== undefined ? _args4[4] : false;
          options = _args4.length > 5 && _args4[5] !== undefined ? _args4[5] : {};
          container = document.getElementById(containerId);
          if (container) {
            _context4.n = 1;
            break;
          }
          return _context4.a(2);
        case 1:
          loadOptions = options && typeof options === 'object' ? options : {};
          commitAllowed = () => (!loadOptions.weatherCommit || loadOptions.weatherCommit()) && (typeof _dispatchUiCommitAllowed !== 'function' || _dispatchUiCommitAllowed(loadOptions));
          if (commitAllowed()) {
            _context4.n = 2;
            break;
          }
          return _context4.a(2);
        case 2:
          requestedRunwayIcao = String(loadOptions.runwayIcao || '').trim().toUpperCase(); // Zwingt das Widget ins "Modern"-Design, auch wenn das Retro-Theme aktiv ist (wichtig für Karten-Popups)
          isRetro = !forceModern && document.body.classList.contains('theme-retro');
          isOps1940 = !forceModern && document.body.classList.contains('theme-ops1940');
          if (!loadOptions.preserveLoadingContent || !String(container.innerHTML || '').trim()) {
            if (isRetro || isOps1940) {
              container.style.boxShadow = 'none';
              container.style.background = 'transparent';
              container.innerHTML = '<div style="padding:20px; text-align:center; color:#555; font-family: \'Caveat\', cursive; font-size:22px; transform: rotate(-1deg);">' + _awText('airportWx.searching', 'Sucht lokales Wetter...') + '</div>';
            } else {
              container.style.boxShadow = '';
              container.style.background = '';
              container.innerHTML = '<div style="padding:20px; text-align:center; color:#888; font-size:12px; background:#1a1a1a; border-radius:6px;">' + _awText('airportWx.searching', 'Sucht lokales Wetter...') + '</div>';
            }
          }
          hasCoordinates = Number.isFinite(Number(lat)) && Number.isFinite(Number(lon));
          if (!(icao === 'POI' || !icao && !hasCoordinates)) {
            _context4.n = 3;
            break;
          }
          container.style.display = 'none';
          return _context4.a(2);
        case 3:
          icaoNorm = String(icao || '').trim().toUpperCase();
          looksLikeIcao = /^[A-Z0-9]{4}$/.test(icaoNorm);
          weatherLocationLabel = icaoNorm || 'diesem Platz';
          container.style.display = 'block';
          _context4.p = 4;
          metarDataList = [];
          isFallback = false;
          foundIcao = icaoNorm; // Zehn Minuten gültiger In-Memory-Cache. Neben exakten Platz-/Koordinaten-
          // Schlüsseln werden komplette METAR-Regionen gehalten, damit ein weiterer
          // Flugplatz im selben Gebiet seine Station sofort und eindeutig wiederverwenden kann.
          _pruneMetarMemoryCache();
          cacheKey = (icaoNorm || 'COORDS') + (hasCoordinates ? `_${Number(lat).toFixed(2)}_${Number(lon).toFixed(2)}` : '');
          cachedEntry = _getMetarMemoryEntry(cacheKey) || _getMetarMemoryEntry(icaoNorm);
          if (!cachedEntry) {
            _context4.n = 5;
            break;
          }
          metarDataList = cachedEntry.data;
          isFallback = cachedEntry.isFallback;
          foundIcao = cachedEntry.foundIcao;
          _context4.n = 13;
          break;
        case 5:
          cachedRegion = hasCoordinates ? _getCachedMetarRegionForPoint(lat, lon) : null;
          cachedRegionSelection = cachedRegion ? _selectMetarForAirport(cachedRegion.data, icaoNorm, lat, lon) : null;
          if (!(cachedRegionSelection !== null && cachedRegionSelection !== void 0 && cachedRegionSelection.station)) {
            _context4.n = 6;
            break;
          }
          metarDataList = [cachedRegionSelection.station];
          isFallback = cachedRegionSelection.isFallback;
          foundIcao = String(cachedRegionSelection.station.icaoId || cachedRegionSelection.station.icao || icaoNorm).trim().toUpperCase();
          _context4.n = 9;
          break;
        case 6:
          if (!looksLikeIcao) {
            _context4.n = 9;
            break;
          }
          directUrl = `https://aviationweather.gov/api/data/metar?ids=${icaoNorm}&format=json`;
          _context4.n = 7;
          return _fetchMetarArrayViaVariants(directUrl, {
            includeCodeTabs: true,
            includeDirect: false,
            retries: 2,
            timeoutMs: 3500,
            retryDelayMs: 350
          });
        case 7:
          mainData = _context4.v;
          if (commitAllowed()) {
            _context4.n = 8;
            break;
          }
          return _context4.a(2);
        case 8:
          if (Array.isArray(mainData)) metarDataList = mainData;
        case 9:
          if (!((!metarDataList || metarDataList.length === 0) && hasCoordinates)) {
            _context4.n = 12;
            break;
          }
          latMin = lat - 0.6, latMax = lat + 0.6;
          lonMin = lon - 0.8, lonMax = lon + 0.8;
          bbox = [latMin, lonMin, latMax, lonMax].map(coord => coord.toFixed(5)).join(',');
          fbUrl = `https://aviationweather.gov/api/data/metar?bbox=${bbox}&format=json`;
          _context4.n = 10;
          return _fetchMetarArrayViaVariants(fbUrl, {
            includeCodeTabs: true,
            includeDirect: false,
            retries: 2,
            timeoutMs: 3500,
            retryDelayMs: 350
          });
        case 10:
          fbData = _context4.v;
          if (commitAllowed()) {
            _context4.n = 11;
            break;
          }
          return _context4.a(2);
        case 11:
          if (Array.isArray(fbData)) {
            _storeMetarRegion(fbData, {
              latMin,
              lonMin,
              latMax,
              lonMax
            });
            try {
              selection = _selectMetarForAirport(fbData, icaoNorm, lat, lon);
              if (selection !== null && selection !== void 0 && selection.station) {
                metarDataList = [selection.station];
                foundIcao = String(selection.station.icaoId || selection.station.icao || icaoNorm).trim().toUpperCase();
                isFallback = selection.isFallback;
              }
            } catch (parseErr) {
              console.error("Failed to process fallback METAR JSON", parseErr);
            }
          }
        case 12:
          // Ergebnis in den Cache legen
          cacheEntry = {
            data: metarDataList,
            isFallback,
            foundIcao,
            cachedAt: Date.now()
          };
          _setMetarMemoryEntry(cacheKey, cacheEntry);
          // Dieselbe Station kann in Karte und Wetterübersicht leicht
          // abweichende Koordinaten haben. Der ICAO-Alias vermeidet dann
          // eine zweite identische METAR-Abfrage.
          if (icaoNorm && Array.isArray(metarDataList) && metarDataList.length > 0) {
            _setMetarMemoryEntry(icaoNorm, cacheEntry);
          }
          if (foundIcao && Array.isArray(metarDataList) && metarDataList.length > 0) {
            _setMetarMemoryEntry(`STATION:${foundIcao}`, {
              data: metarDataList,
              isFallback: false,
              foundIcao,
              cachedAt: cacheEntry.cachedAt
            });
          }
        case 13:
          if (commitAllowed()) {
            _context4.n = 14;
            break;
          }
          return _context4.a(2);
        case 14:
          container = document.getElementById(containerId);
          if (container) {
            _context4.n = 15;
            break;
          }
          return _context4.a(2);
        case 15:
          if (!Array.isArray(metarDataList)) metarDataList = [];
          metarDataList = metarDataList.filter(m => m && typeof m === 'object');
          if (!(!metarDataList || metarDataList.length === 0)) {
            _context4.n = 17;
            break;
          }
          loadingCard = (_container$querySelec = (_container = container).querySelector) === null || _container$querySelec === void 0 ? void 0 : _container$querySelec.call(_container, '[data-ga-metar-loading="true"]');
          if (!(loadOptions.preserveLoadingContent && loadingCard)) {
            _context4.n = 16;
            break;
          }
          status = loadingCard.querySelector('.ga-weather-loading-status');
          if (status) {
            status.textContent = 'KEIN METAR';
            status.style.color = '#a61b12';
            status.style.borderColor = '#c85b51';
          }
          windValue = loadingCard.querySelector('.ga-weather-layout > div > div:first-child > div:last-child');
          if (windValue) {
            windValue.textContent = '--';
            windValue.style.color = '#555';
          }
          loadingCard.removeAttribute('data-ga-metar-loading');
          return _context4.a(2);
        case 16:
          if (isRetro) {
            container.innerHTML = `
                    <div style="padding:15px; text-align:center; font-family: 'Caveat', cursive; transform: rotate(1deg);">
                        <div style="color:#d93829; font-weight:bold; font-size: 22px; margin-bottom:5px;">${_awText('airportWx.noMetarNear', 'Kein METAR in der Nähe von {place}', {
              place: weatherLocationLabel
            })}</div>
                        <div style="font-size:18px; color:#555; margin-bottom:12px;">${_awText('airportWx.noAuto', 'Kein automatisches Wetter verfügbar.')}</div>
                        ${looksLikeIcao ? `<a data-ga-airport-weather="${icaoNorm}" href="https://metar-taf.com/de/${icaoNorm}" target="_blank" style="display:inline-block; color:#0b1f65; font-size:20px; font-weight:bold; text-decoration:underline;">${_awText('airportWx.manualSearch', 'Manuell suchen ➔')}</a>` : ''}
                    </div>`;
          } else {
            container.innerHTML = `
                    <div style="background:#1a1a1a; border-radius:6px; padding:15px; text-align:center; border: 1px solid #333;">
                        <div style="color:#d93829; font-weight:bold; margin-bottom:5px;">${_awText('airportWx.noMetarNear', 'Kein METAR in der Nähe von {place}', {
              place: weatherLocationLabel
            })}</div>
                        <div style="font-size:11px; color:#888; margin-bottom:12px;">${_awText('airportWx.noAutoArea', 'Für diesen Bereich steht kein automatisches Wetter zur Verfügung.')}</div>
                        ${looksLikeIcao ? `<a data-ga-airport-weather="${icaoNorm}" href="https://metar-taf.com/de/${icaoNorm}" target="_blank" style="display:inline-block; background:#4da6ff; color:#111; padding:6px 12px; border-radius:4px; text-decoration:none; font-size:12px; font-weight:bold; transition: background 0.2s;">${_awText('airportWx.manualSearch', 'Manuell suchen ➔')}</a>` : ''}
                    </div>`;
          }
          return _context4.a(2);
        case 17:
          metar = metarDataList[0];
          if (!(!metar || typeof metar !== 'object')) {
            _context4.n = 18;
            break;
          }
          container.innerHTML = `<div style="padding:10px; text-align:center; color:#d93829; font-size:12px; background:#1a1a1a;">${_awText('airportWx.noUsable', 'Kein verwertbares METAR für {icao} gefunden.', {
            icao
          })}</div>`;
          return _context4.a(2);
        case 18:
          if (loadOptions.onMetar) loadOptions.onMetar(metar);
          raw = typeof metar.rawOb === 'string' ? metar.rawOb : typeof metar.raw === 'string' ? metar.raw : "";
          temp = metar.temp != null ? metar.temp + '°C' : '--';
          dewp = metar.dewp != null ? metar.dewp + '°C' : '--';
          catColor = "#fff";
          catText = metar.fltCat || "N/A";
          if (catText === "VFR") catColor = "#33ff33";else if (catText === "MVFR") catColor = "#4da6ff";else if (catText === "IFR") catColor = "#ff3333";else if (catText === "LIFR") catColor = "#ff33ff";
          cover = metar.cover || "--";
          if (cover === "Clear") cover = "CLR";
          visib = awMetarVisibility(metar) || '--';
          wx = metar.wxString ? metar.wxString.replace(/,/g, ' ') : 'NIL';
          qnhStr = "--";
          qMatch = raw.match ? raw.match(/Q(\d{4})/) : null;
          aMatch = raw.match ? raw.match(/A(\d{4})/) : null;
          if (qMatch) qnhStr = qMatch[1] + ' hPa';else if (aMatch) qnhStr = Math.round(parseInt(aMatch[1]) / 100 * 33.8639) + ' hPa';
          wdir = metar.wdir, wspd = metar.wspd || 0, wgst = metar.wgst ? `G${metar.wgst}` : '';
          isVRB = raw.match ? /VRB\d{2,3}KT/.test(raw) : wdir === "VRB";
          windText = isVRB ? `VRB / ${wspd}${wgst} kt` : `${wdir}° / ${wspd}${wgst} kt`;
          if (wspd === 0) windText = "Calm (0 kt)";
          isMini = containerId.startsWith('wxPopup');
          isResponsiveEmbed = !isMini && Boolean(loadOptions.responsiveEmbed); // Bei einem METAR-Fallback bleibt die Pistenvisualisierung am
          // angefragten Flugplatz. Nur das Wetter stammt von der Ersatzstation.
          runwayIcao = requestedRunwayIcao || (looksLikeIcao ? icaoNorm : foundIcao); // Für Vollansicht: auf Pisten-Daten warten; für Mini-Popup direkt aus Cache lesen
          retries = 0;
          if (!(!isMini && !loadOptions.skipRunwayWait)) {
            _context4.n = 22;
            break;
          }
        case 19:
          if (!(runwayIcao && !runwayCache[runwayIcao] && retries < 15)) {
            _context4.n = 22;
            break;
          }
          _context4.n = 20;
          return new Promise(r => setTimeout(r, 200));
        case 20:
          if (commitAllowed()) {
            _context4.n = 21;
            break;
          }
          return _context4.a(2);
        case 21:
          retries++;
          _context4.n = 19;
          break;
        case 22:
          if (commitAllowed()) {
            _context4.n = 23;
            break;
          }
          return _context4.a(2);
        case 23:
          container = document.getElementById(containerId);
          if (container) {
            _context4.n = 24;
            break;
          }
          return _context4.a(2);
        case 24:
          headerText = isFallback ? `Nearest: ${foundIcao}` : `Station: ${icaoNorm}`;
          modernHeaderText = isFallback ? `▶ NEAREST: ${foundIcao}` : `▶ STATION: ${icaoNorm}`;
          runwayText = runwayIcao ? runwayCache[runwayIcao] : '';
          if (isRetro) {
            container.innerHTML = `
                <div style="font-family: 'Caveat', cursive; color: #222; padding: 5px; position:relative;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid rgba(0,0,0,0.5); padding-bottom: 2px; margin-bottom: 12px;">
                        <span style="font-size: 24px; font-weight: bold; color: #0b1f65; transform: rotate(-1deg); display: inline-block;">${headerText}</span>
                        <span style="font-size: 18px; font-weight: bold; color: ${catColor}; border: 2px solid ${catColor}; padding: 0 6px; border-radius: 3px; transform: rotate(2deg); display: inline-block; box-shadow: 1px 1px 0 rgba(0,0,0,0.1);">${catText}</span>
                    </div>
                    <div style="font-size: 17px; line-height: 1.25; margin-bottom: 15px; color: #333; padding-left: 12px; border-left: 2px solid rgba(0,0,0,0.2); transform: rotate(0.5deg);">
                        ${raw}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                        <div style="font-size: 20px; line-height: 1.3; display: flex; flex-direction: column; gap: 2px;">
                            <div><span style="color:#666; font-size: 16px;">Wind:</span> <b style="color:#1a73e8; font-size:22px;">${windText}</b></div>
                            <div><span style="color:#666; font-size: 16px;">Vis:</span> <b>${visib}</b> <span style="color:#666; font-size: 16px; margin-left:8px;">Wx:</span> <b>${wx}</b></div>
                            <div><span style="color:#666; font-size: 16px;">Temp:</span> <b>${temp}</b> <span style="color:#666; font-size: 16px; margin-left:8px;">Dew:</span> <b>${dewp}</b></div>
                            <div><span style="color:#666; font-size: 16px;">QNH:</span> <b>${qnhStr}</b> <span style="color:#666; font-size: 16px; margin-left:8px;">Cloud:</span> <b>${cover}</b></div>
                        </div>
                        ${awPaperWindRose(isVRB ? null : wdir, wspd, runwayText, windText)}
                    </div>
                </div>`;
          } else {
            _ref9 = _getMetarRunwayVisualData(runwayText) || {}, rwyHdg = _ref9.headingDeg, rwy1 = _ref9.end1, rwy2 = _ref9.end2;
            svgTicks = '';
            for (i = 0; i < 360; i += 5) {
              isCard = i % 90 === 0, isLong = i % 10 === 0;
              len = isCard ? 8 : isLong ? 5 : 3, sw = isCard ? 2 : 1, col = isCard ? '#111' : '#888';
              svgTicks += `<line x1="80" y1="2" x2="80" y2="${2 + len}" stroke="${col}" stroke-width="${sw}" transform="rotate(${i} 80 80)" />`;
              if (i % 30 === 0 && !isCard) {
                angleRad = (i - 90) * Math.PI / 180, tx = 80 + 61 * Math.cos(angleRad), ty = 80 + 61 * Math.sin(angleRad);
                svgTicks += `<text x="${tx}" y="${ty}" font-family="sans-serif" font-size="10" fill="#333" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${i} ${tx} ${ty})">${i / 10}</text>`;
              } else if (isCard) {
                _angleRad = (i - 90) * Math.PI / 180, _tx = 80 + 61 * Math.cos(_angleRad), _ty = 80 + 61 * Math.sin(_angleRad);
                letter = i === 0 ? 'N' : i === 90 ? _awText('mapContext.compass.east', 'O') : i === 180 ? 'S' : 'W';
                svgTicks += `<text x="${_tx}" y="${_ty}" font-family="sans-serif" font-size="14" fill="#111" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${i} ${_tx} ${_ty})">${letter}</text>`;
              }
            }
            arrowHtml = '';
            if (!isVRB && wspd > 0 && wdir !== null && wdir !== "VRB") {
              arrowHtml = `
                <svg viewBox="0 0 160 160" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:10; pointer-events:none;">
                    <g transform="rotate(${wdir} 80 80)">
                        <line x1="80" y1="6" x2="80" y2="70" stroke="#1a73e8" stroke-width="4" stroke-linecap="round"/>
                        <polygon points="72,55 80,80 88,55" fill="#1a73e8" />
                    </g>
                </svg>`;
            }
            rwyHtmlModern = '';
            if (rwy1 && rwy2) {
              rwyW = isMini ? '15px' : '26px';
              rwyH = isMini ? '60px' : '105px';
              rwyFSize = isMini ? '8px' : '10px';
              rwyHtmlModern = `
                <div style="position:absolute; top:50%; left:50%; width:${rwyW}; height:${rwyH}; background:#444; border:1px solid #111; border-radius: 3px; transform: translate(-50%, -50%) rotate(${rwyHdg}deg); transform-origin: center center; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding: 3px 0; box-sizing: border-box; z-index:5; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">
                    <div style="width:100%; text-align:center; font-size:${rwyFSize}; line-height:1; color:#fff; font-weight:bold; transform: rotate(180deg); font-family: sans-serif;">${rwy2}</div>
                    <div style="width:2px; flex-grow:1; margin: 3px 0; background: repeating-linear-gradient(to bottom, #d4d4d4 0, #d4d4d4 6px, transparent 6px, transparent 12px);"></div>
                    <div style="width:100%; text-align:center; font-size:${rwyFSize}; line-height:1; color:#fff; font-weight:bold; font-family: sans-serif;">${rwy1}</div>
                </div>`;
            }
            if (rwy1 && rwy2 && (_window$gaAirportPopu2 = window.gaAirportPopupHost) !== null && _window$gaAirportPopu2 !== void 0 && _window$gaAirportPopu2.renderRunway) rwyHtmlModern = window.gaAirportPopupHost.renderRunway({
              headingDeg: rwyHdg,
              end1: rwy1,
              end2: rwy2
            }, isMini);
            cSize = isMini ? '90px' : isResponsiveEmbed ? 'min(100%, 148px)' : '160px';
            cHeight = isResponsiveEmbed ? 'auto' : cSize;
            gap = isMini ? 4 : isResponsiveEmbed ? 3 : 8;
            fVal = isMini ? 12 : isResponsiveEmbed ? 13 : 15;
            fLbl = isMini ? 9 : isResponsiveEmbed ? 8 : 10;
            rowGap = isResponsiveEmbed ? 7 : 12;
            pPad = isMini ? '10px' : isResponsiveEmbed ? '10px' : '15px 15px 20px 15px';
            weatherFont = isOps1940 ? "'Caveat', cursive" : "'Courier New', Courier, monospace";
            weatherOuterFont = isOps1940 ? "'Caveat', cursive" : "'Arial', sans-serif";
            rawTextSafe = raw && raw.trim() ? raw : _awText('airportWx.noRaw', 'RAW nicht verfügbar');
            miniDecoded = `${visib} · ${wx} · ${temp} / ${dewp} · ${cover}`;
            container.innerHTML = `
                <div class="ga-weather-card${isMini ? ' ga-weather-card-mini' : ''}" style="${isMini ? 'background:none; border:none; box-shadow:none; padding:4px 0;' : `background:#f0eada; border-radius:12px; padding:${pPad}; border: 3px solid #c2bba8; box-shadow: 0 4px 8px rgba(0,0,0,0.2), inset 0 2px 5px rgba(255,255,255,0.5);`} font-family:${weatherOuterFont}; color: #333; position:relative; overflow:hidden;">

                    ${!isMini ? `
                    <div style="position:absolute; top:6px; left:6px; width:6px; height:6px; background:#ddd; border-radius:50%; box-shadow: inset 0 0 2px #555;"></div>
                    <div style="position:absolute; bottom:6px; right:6px; width:6px; height:6px; background:#ddd; border-radius:50%; box-shadow: inset 0 0 2px #555;"></div>
                    <div style="position:absolute; top:6px; right:6px; width:6px; height:6px; background:#ddd; border-radius:50%; box-shadow: inset 0 0 2px #555;"></div>
                    <div style="position:absolute; bottom:6px; left:6px; width:6px; height:6px; background:#ddd; border-radius:50%; box-shadow: inset 0 0 2px #555;"></div>
                    ` : ''}

                    <div style="color:#8a1a12; font-size:${isResponsiveEmbed ? 12 : 14}px; font-weight:bold; margin-bottom:${isMini ? 6 : isResponsiveEmbed ? 5 : 12}px; ${isMini ? '' : 'border-bottom:2px dashed #c2bba8;'} padding-bottom:${isMini ? 0 : isResponsiveEmbed ? 4 : 8}px; font-family:${weatherFont}; display:flex; justify-content:space-between; align-items:center; letter-spacing:0.5px;">
                        <span class="ga-weather-station">${modernHeaderText}</span>
                        <span class="ga-weather-category" data-category="${_escapeMetarWidgetText(catText)}" style="color:${catColor}; font-size:${isResponsiveEmbed ? 12 : 14}px; padding:${isResponsiveEmbed ? '1px 5px' : '2px 8px'}; border:2px solid ${catColor}; border-radius:4px; background:rgba(255,255,255,0.7); box-shadow:0 1px 2px rgba(0,0,0,0.1);">${catText}</span>
                    </div>
                    ${!isMini && !isResponsiveEmbed ? `<div style="background:#e6e0ce; color:#333; font-family:${weatherFont}; padding:10px; border-radius:4px; font-size:11.5px; margin-bottom:18px; border: 1px inset #c2bba8; line-height: 1.4; letter-spacing: 0.5px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">${rawTextSafe}</div>` : ''}
                    ${isMini ? `<div style="background:#ece6d6; color:#2f2f2f; font-family:${weatherFont}; padding:6px 8px; border-radius:4px; font-size:10px; margin-bottom:8px; border:1px solid #c8c0ac; line-height:1.35; word-break:break-word;">${rawTextSafe}<br><span style="color:#555;">${miniDecoded}</span></div>` : ''}
                    <div class="ga-weather-layout${isResponsiveEmbed ? ' ga-weather-layout-responsive' : ''}" style="display:flex; justify-content:space-between; align-items:${isResponsiveEmbed ? 'stretch' : 'center'}; gap:${isResponsiveEmbed ? 5 : 8}px;${isResponsiveEmbed ? ' flex-direction:column;' : ''}">
                        <div style="display:flex; flex-direction:column; gap:${gap}px; font-family:${weatherFont}; flex-shrink: 1; min-width: 0;">
                            <div><div class="ga-weather-field-label" style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">WIND</div><div class="ga-weather-wind-value" style="color:#1a73e8; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${windText}</div></div>
                            ${!isMini ? `
                            <div style="display:flex; gap:${rowGap}px;">
                                <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">VIS</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${visib}</div></div>
                                <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">WX</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${wx}</div></div>
                            </div>
                            <div style="display:flex; gap:${rowGap}px;">
                                <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">TEMP</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${temp}</div></div>
                                <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">DEWP</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${dewp}</div></div>
                            </div>` : ''}
                            <div style="display:flex; gap:${rowGap}px;">
                                <div><div class="ga-weather-field-label" style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">QNH</div><div class="ga-weather-pressure-value" style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${qnhStr}</div></div>
                                ${!isMini ? `<div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">COVER</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${cover}</div></div>` : ''}
                            </div>
                        </div>
                        <div class="ga-weather-windrose" style="position:relative; width:${cSize}; height:${cHeight}; aspect-ratio:1; flex:${isResponsiveEmbed ? '0 1 auto' : '0 0 auto'}; align-self:${isResponsiveEmbed ? 'center' : 'auto'}; ${isMini ? 'margin-left:auto;' : isResponsiveEmbed ? 'margin:2px auto 0;' : ''} border:4px solid #a8a291; border-radius:50%; background:#fcfaf5; box-shadow:inset 0 2px 8px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.2);">
                            <svg viewBox="0 0 160 160" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:1; pointer-events:none;">
                                ${svgTicks}
                            </svg>
                            ${rwyHtmlModern}
                            ${arrowHtml}
                        </div>
                    </div>
                </div>`;
          }
          _context4.n = 29;
          break;
        case 25:
          _context4.p = 25;
          _t3 = _context4.v;
          console.error("METAR fetch error:", _t3);
          if (commitAllowed()) {
            _context4.n = 26;
            break;
          }
          return _context4.a(2);
        case 26:
          container = document.getElementById(containerId);
          if (container) {
            _context4.n = 27;
            break;
          }
          return _context4.a(2);
        case 27:
          _loadingCard = (_container$querySelec2 = (_container2 = container).querySelector) === null || _container$querySelec2 === void 0 ? void 0 : _container$querySelec2.call(_container2, '[data-ga-metar-loading="true"]');
          if (!(loadOptions.preserveLoadingContent && _loadingCard)) {
            _context4.n = 28;
            break;
          }
          _status = _loadingCard.querySelector('.ga-weather-loading-status');
          if (_status) {
            _status.textContent = 'METAR FEHLER';
            _status.style.color = '#a61b12';
            _status.style.borderColor = '#c85b51';
          }
          _windValue = _loadingCard.querySelector('.ga-weather-layout > div > div:first-child > div:last-child');
          if (_windValue) {
            _windValue.textContent = '--';
            _windValue.style.color = '#555';
          }
          _loadingCard.removeAttribute('data-ga-metar-loading');
          return _context4.a(2);
        case 28:
          _isRetro = document.body.classList.contains('theme-retro');
          _isOps = document.body.classList.contains('theme-ops1940');
          if (_isRetro || _isOps) {
            container.innerHTML = `<div style="padding:10px; text-align:center; color:#d93829; font-family: 'Caveat', cursive; font-size:20px; transform: rotate(-1deg);">${_awText('airportWx.loadError', 'Fehler beim Laden des METARs:')} <br/>${_t3.message || _t3}</div>`;
          } else {
            container.innerHTML = `<div style="padding:10px; text-align:center; color:#d93829; font-size:12px; background:#1a1a1a;">${_awText('airportWx.loadError', 'Fehler beim Laden des METARs:')} <br/>${_t3.message || _t3}</div>`;
          }
        case 29:
          return _context4.a(2);
      }
    }, _callee4, null, [[4, 25]]);
  }));
  return _awLoadMetarWidget.apply(this, arguments);
}
var AW_SOURCE_KEY = 'ga_briefing_weather_source';
var AW_SOURCES = {
  dwd: 'DWD ICON-EU',
  openmeteo: 'Open-Meteo',
  metar: 'METAR'
};
var AW_HOUR = 3600000;
var awWidgetLoads = new Map();
var awWeatherHour = null;
var awWeatherReloadTimer = null;
var awSigmetCache = new Map();
var AW_SIGMET_ROOT = 'https://mapservices.weather.noaa.gov/vector/rest/services/aviation/awc_aviation_weather/MapServer/';
var AW_SIGMET_FIELDS = {
  111: 'hazard,severity,valid_time_from,valid_time_to,min_ft_msl,max_ft_msl,raw_text',
  112: 'hazard,qualifier,validtimef,validtimet,base,top,rawsigmet'
};
function awWeatherSource() {
  var saved = localStorage.getItem(AW_SOURCE_KEY);
  return Object.prototype.hasOwnProperty.call(AW_SOURCES, saved) ? saved : 'dwd';
}
function awWeatherValidAt() {
  return awWeatherSource() === 'dwd' ? awWeatherHour : null;
}
function awWeatherSourceControl(observedAt) {
  var _awWeatherValidAt;
  var source = awWeatherSource();
  var sources = Object.keys(AW_SOURCES);
  var next = AW_SOURCES[sources[(sources.indexOf(source) + 1) % sources.length]];
  var change = _awText('airportWx.nextSource', 'Wetterquelle wechseln zu {source}', {
    source: next
  });
  var term = (_awWeatherValidAt = awWeatherValidAt()) !== null && _awWeatherValidAt !== void 0 ? _awWeatherValidAt : Number.isFinite(observedAt) && observedAt > 1e12 ? observedAt : Math.floor(Date.now() / AW_HOUR) * AW_HOUR;
  var clock = new Date(term).toISOString().slice(11, 16) + ' UTC';
  return '<div class="ga-briefing-weather-source"><button type="button" class="ga-skin-control ga-weather-source-cycle" data-aw-source title="' + _escapeMetarWidgetText(change) + '" aria-label="' + _escapeMetarWidgetText(AW_SOURCES[source] + ' · ' + change) + '">' + AW_SOURCES[source] + '</button>' + (source === 'dwd' ? '<span class="ga-weather-stepper" data-aw-term="' + term + '">' + '<button type="button" class="ga-skin-control" data-aw-step="-1" aria-label="' + _escapeMetarWidgetText(_awText('airportWx.hourEarlier', 'Eine Stunde zurück')) + '">−</button>' + '<button type="button" class="ga-skin-control ga-weather-step-clock' + (awWeatherHour !== null ? ' is-preview' : '') + '" data-aw-step="0" title="' + _escapeMetarWidgetText(_awText('airportWx.backToLive', 'Zurück zu Live')) + '">' + clock + '</button>' + '<button type="button" class="ga-skin-control" data-aw-step="1" aria-label="' + _escapeMetarWidgetText(_awText('airportWx.hourLater', 'Eine Stunde vor')) + '">+</button></span>' : '') + '</div>';
}
function awReloadWidgets() {
  window.dispatchEvent(new Event('ga:briefing-weather-source'));
  awWidgetLoads.forEach((state, id) => {
    if (state.container === document.getElementById(id)) loadMetarWidget.apply(void 0, _toConsumableArray(state.args));else {
      state.controller.abort();
      awWidgetLoads.delete(id);
    }
  });
}
document.addEventListener('click', event => {
  var _event$target, _event$target$closest, _awNumber;
  var button = (_event$target = event.target) === null || _event$target === void 0 || (_event$target$closest = _event$target.closest) === null || _event$target$closest === void 0 ? void 0 : _event$target$closest.call(_event$target, '[data-aw-source], [data-aw-step]');
  if (!button) return;
  if (button.hasAttribute('data-aw-source')) {
    clearTimeout(awWeatherReloadTimer);
    var sources = Object.keys(AW_SOURCES);
    localStorage.setItem(AW_SOURCE_KEY, sources[(sources.indexOf(awWeatherSource()) + 1) % sources.length]);
    awWeatherReloadTimer = setTimeout(awReloadWidgets, 0);
    return;
  }
  if (awWeatherSource() !== 'dwd') return;
  var step = Number(button.dataset.awStep);
  if (step === 0) {
    clearTimeout(awWeatherReloadTimer);
    awWeatherHour = null;
    awWeatherReloadTimer = setTimeout(awReloadWidgets, 0);
    return;
  }
  var current = Math.floor(Date.now() / AW_HOUR) * AW_HOUR;
  var shown = (_awNumber = awNumber(button.parentElement.dataset.awTerm)) !== null && _awNumber !== void 0 ? _awNumber : current;
  var target = (awWeatherHour !== null && awWeatherHour !== void 0 ? awWeatherHour : shown) + step * AW_HOUR;
  var validAt = Math.max(current - 3 * AW_HOUR, Math.min(current + 12 * AW_HOUR, target));
  if (validAt === awWeatherHour) return;
  clearTimeout(awWeatherReloadTimer);
  awWeatherHour = validAt;
  var label = new Date(validAt).toISOString().slice(11, 16) + ' UTC';
  document.querySelectorAll('.ga-weather-step-clock').forEach(clock => {
    clock.textContent = label;
    clock.classList.add('is-preview');
  });
  awWeatherReloadTimer = setTimeout(awReloadWidgets, 240);
}, true); // The map drawer stops clicks from bubbling to the document.

function awNumber(value) {
  return value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value);
}
function awMetarVisibility(metar) {
  var raw = metar.rawOb || metar.raw || '';
  var metric = /(?:^|\s)(?:\d{3}|VRB)\d{2,3}(?:G\d{2,3})?(?:KT|MPS|KMH)\s+(?:\d{3}V\d{3}\s+)?(\d{4})(?:NDV)?(?=\s|$)/.exec(raw);
  if ((metric === null || metric === void 0 ? void 0 : metric[1]) === '9999' || /\bCAVOK\b/.test(raw)) return '≥10 km';
  if (metric) return (Number(metric[1]) / 1000).toFixed(1) + ' km';
  return metar.visib != null ? metar.visib + ' sm' : '';
}
function awMetarCloudBases(metar) {
  var layers = new Map();
  (Array.isArray(metar.clouds) ? metar.clouds : []).forEach(layer => {
    var base = awNumber(layer.base);
    if (/^(FEW|SCT|BKN|OVC|VV)$/.test(layer.cover) && base !== null && base >= 0) {
      layers.set(layer.cover + base, {
        cover: layer.cover,
        base
      });
    }
  });
  var raw = metar.rawOb || metar.raw || '';
  var matches = /\b(FEW|SCT|BKN|OVC|VV)(\d{3})(?:CB|TCU)?\b/g;
  var match;
  while (match = matches.exec(raw)) {
    var base = Number(match[2]) * 100;
    layers.set(match[1] + base, {
      cover: match[1],
      base
    });
  }
  return Array.from(layers.values()).sort((a, b) => a.base - b.base);
}
function awModelCloudBases(sample, elevationFt) {
  var _awNumber2, _layers$;
  var ground = (_awNumber2 = awNumber(elevationFt)) !== null && _awNumber2 !== void 0 ? _awNumber2 : awNumber(sample.modelTerrainMslM) === null ? null : sample.modelTerrainMslM * 3.28084;
  var profile = (sample.pressureProfile || []).filter(row => Number.isFinite(row.cloudPct) && Number.isFinite(row.geopotentialFt) && (ground === null || row.geopotentialFt >= ground));
  var layers = vpDeriveCloudLayersFromPressureProfile(profile, ground !== null && ground !== void 0 ? ground : 0);
  var height = mslFt => Number.isFinite(mslFt) ? {
    mslFt,
    aglFt: ground !== null && mslFt >= ground ? mslFt - ground : null
  } : null;
  var ceilingM = awNumber(sample.ceilingMslM);
  var ceilingFt = ceilingM !== null && ceilingM > 0 && ceilingM < 15000 && (sample.cloudTotalPct == null || sample.cloudTotalPct > 50) ? ceilingM * 3.28084 : null;
  var profileBaseFt = (_layers$ = layers[0]) === null || _layers$ === void 0 ? void 0 : _layers$.baseMsl;
  // A higher sampled layer cannot establish the lowest base when CEILING is below it.
  var hasDistinctBase = ceilingFt === null || profileBaseFt <= ceilingFt - 10;
  return {
    base: hasDistinctBase ? height(profileBaseFt) : null,
    ceiling: height(ceilingFt)
  };
}
function awMetarCloudHeights(metar) {
  var layers = awMetarCloudBases(metar);
  var base = layers.find(layer => layer.cover !== 'VV');
  var ceiling = layers.find(layer => /^(BKN|OVC|VV)$/.test(layer.cover));
  return {
    base: base ? {
      aglFt: base.base
    } : null,
    ceiling: ceiling ? {
      aglFt: ceiling.base
    } : null
  };
}
function awEstimateFlightCategory(visibilityM, ceilingFtAgl, hasNoCeiling) {
  if (!Number.isFinite(visibilityM) || visibilityM < 0 || !Number.isFinite(ceilingFtAgl) && !hasNoCeiling) return '';
  // AWC categories use statute miles for visibility and feet AGL for ceiling.
  var miles = visibilityM / 1609.344;
  var ceiling = Number.isFinite(ceilingFtAgl) ? ceilingFtAgl : Infinity;
  return awFlightCategoryThresholds(miles, ceiling);
}
function awFlightCategoryThresholds(miles, ceiling) {
  if (miles < 1 || ceiling < 500) return 'LIFR';
  if (miles < 3 || ceiling < 1000) return 'IFR';
  if (miles <= 5 || ceiling <= 3000) return 'MVFR';
  return 'VFR';
}
function awModelFlightCategory(sample, ceiling) {
  var visibility = awNumber(sample.visibilityM);
  var totalCover = awNumber(sample.cloudTotalPct);
  var cat = awEstimateFlightCategory(visibility, ceiling === null || ceiling === void 0 ? void 0 : ceiling.aglFt, !ceiling && totalCover !== null && totalCover <= 50);
  var limit = visibility === null && Number.isFinite(ceiling === null || ceiling === void 0 ? void 0 : ceiling.aglFt) ? awFlightCategoryThresholds(Infinity, ceiling.aglFt) : '';
  return {
    cat,
    ceilingCategory: limit === 'VFR' ? '' : limit
  };
}
function awFlightCategoryBadge(category, estimated, ceilingCategory) {
  var cat = String(category || ceilingCategory || '').toUpperCase();
  if (!/^(VFR|MVFR|IFR|LIFR)$/.test(cat)) return '';
  var ceilingOnly = !category && !!ceilingCategory;
  var text = ceilingOnly && cat !== 'LIFR' ? '≤ ' + cat : cat;
  var label = ceilingOnly ? _awText('airportWx.categoryCeilingOnly', 'Obergrenze anhand des Ceilings. Sichtweite fehlt.') : estimated ? _awText('airportWx.categoryEstimate', 'Aus Sichtweite und Ceiling geschätzt') : _awText('airportWx.categoryMetar', 'Wetterkategorie aus METAR');
  return '<span class="route-weather-badge is-' + cat.toLowerCase() + '" title="' + _escapeMetarWidgetText(label) + '" aria-label="' + text + ' · ' + _escapeMetarWidgetText(label) + '">' + text + '</span>';
}
function awReadModelWeather(_x7, _x8, _x9) {
  return _awReadModelWeather.apply(this, arguments);
}
function _awReadModelWeather() {
  _awReadModelWeather = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5(source, points, signal) {
    var validAt,
      options,
      output,
      samples,
      missing,
      _samples,
      _args5 = arguments,
      _t4;
    return _regenerator().w(function (_context5) {
      while (1) switch (_context5.p = _context5.n) {
        case 0:
          validAt = _args5.length > 3 && _args5[3] !== undefined ? _args5[3] : null;
          options = {
            signal,
            includePressure: true,
            includeContour: true,
            maxConcurrency: 2,
            validAt
          };
          output = points.map(() => null);
          if (!(source === 'dwd' && (window.GA_DWD_WEATHER_URL || window.fetchStaticDwdWeatherPoints))) {
            _context5.n = 4;
            break;
          }
          _context5.p = 1;
          _context5.n = 2;
          return window.fetchDwdWeatherPoints(points, options);
        case 2:
          samples = _context5.v;
          samples.forEach((sample, i) => {
            if (sample) output[i] = {
              source: 'dwd',
              sample
            };
          });
          _context5.n = 4;
          break;
        case 3:
          _context5.p = 3;
          _t4 = _context5.v;
          if (!(signal !== null && signal !== void 0 && signal.aborted || (_t4 === null || _t4 === void 0 ? void 0 : _t4.name) === 'AbortError')) {
            _context5.n = 4;
            break;
          }
          throw _t4;
        case 4:
          if (!(source === 'dwd' && validAt !== null)) {
            _context5.n = 5;
            break;
          }
          return _context5.a(2, output);
        case 5:
          missing = points.map((point, i) => output[i] ? null : {
            point,
            i
          }).filter(Boolean);
          if (!missing.length) {
            _context5.n = 7;
            break;
          }
          _context5.n = 6;
          return window.fetchOpenMeteoWeatherPoints(missing.map(row => row.point), options);
        case 6:
          _samples = _context5.v;
          _samples.forEach((sample, i) => {
            if (sample) output[missing[i].i] = {
              source: 'openmeteo',
              sample
            };
          });
        case 7:
          return _context5.a(2, output);
      }
    }, _callee5, null, [[1, 3]]);
  }));
  return _awReadModelWeather.apply(this, arguments);
}
function awWeatherSymbols(code) {
  var metarWx = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  var symbols = [];
  var add = (weatherCode, prefix) => {
    var name = vpSignificantWeatherSymbol(weatherCode);
    if (!name || symbols.some(item => item.name === name)) return;
    var label = _awText('map.profile.weatherMarker.' + name, VP_WEATHER_MARKER_NAMES[name]);
    var column = VP_WMO_WEATHER_CODES.indexOf(weatherCode);
    symbols.push({
      name,
      label: prefix + label,
      icon: '<span aria-hidden="true" class="ga-briefing-wmo" style="background-image:url(\'' + vpWmoWeatherSpriteUrl() + '\');background-size:' + VP_WMO_WEATHER_CODES.length * 22 + 'px 22px;background-position:' + -column * 22 + 'px 0"></span>'
    });
  };
  if (code != null) add(Number(code), '');
  var codes = {
    TS: 95,
    FZDZ: 56,
    FZRA: 66,
    FZFG: 48,
    SHSN: 85,
    SHRA: 81,
    SN: 73,
    RA: 63,
    DZ: 53,
    FG: 45,
    SG: 77
  };
  var other = {
    BR: 'Dunst',
    HZ: 'Trockener Dunst',
    FU: 'Rauch',
    DU: 'Staub',
    SA: 'Sand',
    VA: 'Vulkanasche',
    GR: 'Hagel',
    GS: 'Graupel oder kleiner Hagel',
    PL: 'Eiskörner',
    IC: 'Eiskristalle',
    SQ: 'Böenlinie',
    FC: 'Trichterwolke',
    UP: 'Unbekannter Niederschlag',
    DS: 'Staubsturm',
    SS: 'Sandsturm',
    PO: 'Staub- oder Sandwirbel'
  };
  String(metarWx).split(/[\s,]+/).filter(Boolean).forEach(group => {
    var parts = group.match(/FZDZ|FZRA|FZFG|SHSN|SHRA|TS|[A-Z]{2}/g) || [];
    parts.forEach(part => {
      if (Object.prototype.hasOwnProperty.call(codes, part)) add(codes[part], group + ' · ');else if (Object.prototype.hasOwnProperty.call(other, part) && !symbols.some(item => item.name === part)) {
        symbols.push({
          name: part,
          label: group + ' · ' + other[part],
          text: part
        });
      }
    });
  });
  return symbols;
}
function awWarningTime(value) {
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
  return Date.parse(String(value || '').replace(/^(\d{4})\/(\d\d)\/(\d\d) (\d\d:\d\d:\d\d)\+00$/, '$1-$2-$3T$4Z'));
}
function awFetchSigmetLayer(id) {
  var cached = awSigmetCache.get(id);
  if (cached && cached.until > Date.now()) return cached.promise;
  var url = AW_SIGMET_ROOT + id + '/query?where=1%3D1&outFields=' + AW_SIGMET_FIELDS[id] + '&f=geojson&outSR=4326';
  var entry = {
    until: Date.now() + 5 * 60000
  };
  entry.promise = _fetchWithTimeout(url, 6500).then(/*#__PURE__*/function () {
    var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(response) {
      var data;
      return _regenerator().w(function (_context) {
        while (1) switch (_context.n) {
          case 0:
            if (response.ok) {
              _context.n = 1;
              break;
            }
            throw new Error('SIGMET HTTP ' + response.status);
          case 1:
            _context.n = 2;
            return response.json();
          case 2:
            data = _context.v;
            if (Array.isArray(data.features)) {
              _context.n = 3;
              break;
            }
            throw new Error('SIGMET GeoJSON');
          case 3:
            return _context.a(2, data.features);
        }
      }, _callee);
    }));
    return function (_x0) {
      return _ref.apply(this, arguments);
    };
  }()).catch(() => {
    entry.until = Date.now() + 60000;
    return [];
  });
  awSigmetCache.set(id, entry);
  return entry.promise;
}
function awWarningContains(geometry, lat, lon) {
  function contains(ring) {
    if (!Array.isArray(ring) || ring.length < 3) return false;
    var wrap = delta => (delta + 540) % 360 - 180;
    var origin = ring[0][0];
    var targetX = wrap(lon - origin);
    var inside = false;
    var previous = ring[ring.length - 1];
    var _iterator = _createForOfIteratorHelper(ring),
      _step;
    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var point = _step.value;
        var x1 = wrap(previous[0] - origin);
        var x2 = wrap(point[0] - origin);
        var y1 = previous[1],
          y2 = point[1];
        if (y1 > lat !== y2 > lat && x1 + (x2 - x1) * (lat - y1) / (y2 - y1) > targetX) inside = !inside;
        previous = point;
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }
    return inside;
  }
  var polygons = (geometry === null || geometry === void 0 ? void 0 : geometry.type) === 'Polygon' ? [geometry.coordinates] : (geometry === null || geometry === void 0 ? void 0 : geometry.type) === 'MultiPolygon' ? geometry.coordinates : [];
  return polygons.some(rings => rings.length && contains(rings[0]) && !rings.slice(1).some(contains));
}
function awReadPointSigmets(_x1) {
  return _awReadPointSigmets.apply(this, arguments);
}
function _awReadPointSigmets() {
  _awReadPointSigmets = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee6(points) {
    var isConus, international, conus, _yield$Promise$all, _yield$Promise$all2, world, us, now, active;
    return _regenerator().w(function (_context6) {
      while (1) switch (_context6.n) {
        case 0:
          if (points.length) {
            _context6.n = 1;
            break;
          }
          return _context6.a(2, []);
        case 1:
          isConus = p => p.lat >= 24 && p.lat <= 50 && p.lon >= -127 && p.lon <= -65;
          international = awFetchSigmetLayer(112);
          conus = points.some(isConus) ? awFetchSigmetLayer(111) : Promise.resolve([]);
          _context6.n = 2;
          return Promise.all([international, conus]);
        case 2:
          _yield$Promise$all = _context6.v;
          _yield$Promise$all2 = _slicedToArray(_yield$Promise$all, 2);
          world = _yield$Promise$all2[0];
          us = _yield$Promise$all2[1];
          now = Date.now();
          active = world.concat(us).filter(feature => {
            var _p$validtimef, _p$validtimet;
            var p = feature.properties || {};
            return awWarningTime((_p$validtimef = p.validtimef) !== null && _p$validtimef !== void 0 ? _p$validtimef : p.valid_time_from) <= now && now < awWarningTime((_p$validtimet = p.validtimet) !== null && _p$validtimet !== void 0 ? _p$validtimet : p.valid_time_to);
          });
          return _context6.a(2, points.map(point => {
            var seen = new Set();
            return active.filter(feature => awWarningContains(feature.geometry, point.lat, point.lon)).map(feature => {
              var _p$base, _p$top, _p$validtimet2;
              var p = feature.properties;
              return {
                hazard: p.hazard,
                qualifier: p.qualifier || p.severity,
                message: p.rawsigmet || p.raw_text,
                base: (_p$base = p.base) !== null && _p$base !== void 0 ? _p$base : p.min_ft_msl,
                top: (_p$top = p.top) !== null && _p$top !== void 0 ? _p$top : p.max_ft_msl,
                end: awWarningTime((_p$validtimet2 = p.validtimet) !== null && _p$validtimet2 !== void 0 ? _p$validtimet2 : p.valid_time_to)
              };
            }).filter(item => {
              var key = item.message || [item.hazard, item.qualifier, item.base, item.top, item.end].join('|');
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
          }));
      }
    }, _callee6);
  }));
  return _awReadPointSigmets.apply(this, arguments);
}
function awWeatherWarnings(symbols, sigmets) {
  var names = {
    ICE: 'Vereisung',
    ICING: 'Vereisung',
    TURB: 'Turbulenz',
    TS: 'Gewitter',
    CONV: 'Gewitter',
    VA: 'Vulkanasche',
    TC: 'Tropischer Wirbelsturm',
    DS: 'Staubsturm',
    SS: 'Sandsturm',
    MTW: 'Gebirgswelle'
  };
  var icons = {
    ICE: '❄',
    ICING: '❄',
    TURB: '↝',
    TS: 'ϟ',
    CONV: 'ϟ',
    VA: '▲',
    TC: '↻',
    DS: '◌',
    SS: '◌',
    MTW: '≈'
  };
  var details = (icon, name, label, text) => '<details class="ga-briefing-weather-warning"><summary title="' + _escapeMetarWidgetText(label) + '" aria-label="' + _escapeMetarWidgetText(label) + '">' + icon + '<span>' + _escapeMetarWidgetText(name) + '</span></summary><span>' + _escapeMetarWidgetText(text || label) + '</span></details>';
  var rows = (symbols || []).map(item => details(item.icon || '⚠', item.label, item.label));
  (sigmets || []).forEach(warning => {
    var code = String(warning.hazard || '').trim().toUpperCase();
    var band = [warning.base, warning.top].map(awNumber);
    var levels = band.every(value => value !== null) ? ' · ' + band[0] + '–' + band[1] + ' ft MSL' : '';
    var name = 'SIGMET · ' + (names[code] || code || '⚠');
    var label = name + levels + ' · bis ' + new Date(warning.end).toISOString().slice(11, 16) + ' UTC';
    rows.push(details(icons[code] || '⚠', name, label, [label, warning.message || warning.qualifier].filter(Boolean).join(' · ')));
  });
  return rows.length ? '<div class="ga-briefing-weather-warnings">' + rows.join('') + '</div>' : '';
}
function awPaperWindRose(wdir, wspd, runwayText, windText) {
  var runway = _getMetarRunwayVisualData(runwayText);
  var svgTicks = `
        <circle cx="80" cy="80" r="70" stroke="#444" stroke-width="1.5" fill="none" stroke-dasharray="30.65 6" transform="rotate(2.45 80 80)"/>
        <circle cx="80" cy="80" r="3" fill="#444" />`;

  // Füge N, O, S, W und 30-Grad-Schritte rotierend hinzu
  for (var i = 0; i < 360; i += 30) {
    var angleRad = (i - 90) * Math.PI / 180;
    var radius = 61;
    var tx = 80 + radius * Math.cos(angleRad);
    var ty = 80 + radius * Math.sin(angleRad);

    // dx="-2" gleicht den kursiven Schwung (Slant) von Caveat aus, der sonst wie eine Rechtsrotation wirkt
    if (i % 90 === 0) {
      var letter = i === 0 ? 'N' : i === 90 ? _awText('mapContext.compass.east', 'O') : i === 180 ? 'S' : 'W';
      svgTicks += `<text x="${tx}" y="${ty}" dx="-2" font-family="'Caveat', cursive" font-size="22" fill="#222" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${i} ${tx} ${ty})">${letter}</text>`;
    } else {
      svgTicks += `<text x="${tx}" y="${ty}" dx="-1.5" font-family="'Caveat', cursive" font-size="14" fill="#666" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${i} ${tx} ${ty})">${i / 10}</text>`;
    }
  }
  var rwyHtml = '';
  if (runway) {
    // Piste wurde oben und unten gekürzt (y="29", height="102") um Abstand zu den Zahlen zu gewinnen
    rwyHtml = `
            <g transform="translate(80,80) rotate(${runway.headingDeg}) translate(-80,-80)">
                <rect x="68" y="29" width="24" height="102" fill="none" stroke="#222" stroke-width="1.5" stroke-dasharray="30 4 15 4"/>
                <text x="80" y="43" font-family="'Caveat', cursive" font-size="14" fill="#111" font-weight="bold" text-anchor="middle" transform="rotate(180 80 39)">${runway.end2}</text>
                <text x="80" y="125" font-family="'Caveat', cursive" font-size="14" fill="#111" font-weight="bold" text-anchor="middle">${runway.end1}</text>
            </g>`;
  }
  var arrowHtml = '';
  if (awNumber(wdir) !== null && wspd > 0) {
    arrowHtml = `
        <g transform="rotate(${wdir} 80 80)">
            <path d="M 80 10 C 77 30, 83 50, 80 65" stroke="#1a73e8" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <path d="M 74 54 L 80 68 L 86 52" stroke="#1a73e8" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </g>`;
  }
  var label = [windText || 'Windrose', runway && _awText('airportWx.runway', 'Piste {rwy}', {
    rwy: runway.end1 + '/' + runway.end2
  })].filter(Boolean).join(' · ');
  return `<div class="ga-paper-windrose" role="img" aria-label="${_escapeMetarWidgetText(label)}">
        <svg viewBox="0 0 160 160" aria-hidden="true">${svgTicks}${rwyHtml}${arrowHtml}</svg>
    </div>`;
}
function awBriefingWindRose(wdir, speed, runwayText, windText) {
  var runway = _getMetarRunwayVisualData(runwayText);
  var dir = awNumber(wdir);
  var arrow = dir !== null && speed > 0.4 ? '<g transform="rotate(' + dir + ' 80 80)"><path d="M80 6V66" stroke="#1a73e8" stroke-width="4"/><path d="M72 54L80 79L88 54Z" fill="#1a73e8"/></g>' : '';
  var label = [windText || 'Windrose', runway && _awText('airportWx.runway', 'Piste {rwy}', {
    rwy: runway.end1 + '/' + runway.end2
  })].filter(Boolean).join(' · ');
  return '<div class="ga-briefing-windrose" role="img" aria-label="' + _escapeMetarWidgetText(label) + '">' + _renderMetarRunwayLayer(runway, true) + '<svg viewBox="0 0 160 160" aria-hidden="true">' + _renderMetarCompassTicks() + arrow + '</svg></div>';
}
function awModelFields(result, elevationFt) {
  var source = result.source,
    sample = result.sample;
  var dir = awNumber(sample.wdir);
  var speed = awNumber(sample.wspd);
  var value = (n, unit) => awNumber(n) !== null ? Math.round(n) + ' ' + unit : '';
  var cloudParts = [sample.cloudLowPct, sample.cloudMidPct, sample.cloudHighPct];
  var clouds = cloudParts.some(pct => awNumber(pct) !== null) ? cloudParts.map(pct => value(pct, '%') || '–').join(' / ') : '';
  var visibility = awNumber(sample.visibilityM);
  var precipitation = awNumber(sample.precipitationMm);
  var _awModelCloudBases = awModelCloudBases(sample, elevationFt),
    base = _awModelCloudBases.base,
    ceiling = _awModelCloudBases.ceiling;
  var _awModelFlightCategor = awModelFlightCategory(sample, ceiling),
    cat = _awModelFlightCategor.cat,
    ceilingCategory = _awModelFlightCategor.ceilingCategory;
  var symbols = awWeatherSymbols(sample.weatherCode);
  return {
    source: AW_SOURCES[source],
    observedAt: sample.contourValidAt,
    windDeg: dir,
    windKt: speed,
    wind: speed === 0 ? '0 kt' : [value(dir, '°'), value(speed, 'kt')].filter(Boolean).join(' / '),
    vis: visibility === null ? '' : (visibility / 1000).toFixed(1) + ' km',
    temp: value(sample.temp2mC, '°C'),
    dew: value(sample.dewPoint2mC, '°C'),
    rh: value(sample.rh2mPct, '%'),
    pressure: value(sample.mslPressureHpa, 'hPa'),
    clouds,
    base,
    ceiling,
    cat,
    ceilingCategory,
    wx: symbols.map(item => item.label).join(' · '),
    precipitation: precipitation > 0 ? precipitation + ' mm/h' : '',
    symbols
  };
}
function awCloudHeightValue(feet) {
  return Number.isFinite(feet) ? String(Math.round(feet / 10) * 10) : '';
}
function awCloudHeightText(height) {
  return [['MSL', height === null || height === void 0 ? void 0 : height.mslFt], ['AGL', height === null || height === void 0 ? void 0 : height.aglFt]].filter(_ref2 => {
    var _ref3 = _slicedToArray(_ref2, 2),
      feet = _ref3[1];
    return Number.isFinite(feet);
  }).map(_ref4 => {
    var _ref5 = _slicedToArray(_ref4, 2),
      reference = _ref5[0],
      feet = _ref5[1];
    return awCloudHeightValue(feet) + ' ft ' + reference;
  }).join(' · ');
}
var AW_HEIGHT_REFERENCE_KEY = 'ga_briefing_cloud_height_reference';
function awCloudHeightToggleLabel(reference) {
  return _awText('airportWx.heightReferenceToggle', '{current} · zu {next} wechseln', {
    current: reference.toUpperCase(),
    next: reference === 'msl' ? 'AGL' : 'MSL'
  });
}
function awCloudHeightBlock(weather) {
  var rows = [[_awText('airportWx.base', 'Wolkenbasis'), weather.base], [_awText('airportWx.ceiling', 'Ceiling'), weather.ceiling]];
  var preferred = localStorage.getItem(AW_HEIGHT_REFERENCE_KEY) === 'agl' ? 'agl' : 'msl';
  var content = rows.map(_ref6 => {
    var _ref7 = _slicedToArray(_ref6, 2),
      label = _ref7[0],
      height = _ref7[1];
    var msl = awCloudHeightValue(height === null || height === void 0 ? void 0 : height.mslFt);
    var agl = awCloudHeightValue(height === null || height === void 0 ? void 0 : height.aglFt);
    if (!msl && !agl) return '';
    var active = msl && agl ? preferred : msl ? 'msl' : 'agl';
    var unit = active.toUpperCase();
    var toggleLabel = _escapeMetarWidgetText(awCloudHeightToggleLabel(active));
    var control = msl && agl ? '<button type="button" class="ga-skin-control ga-cloud-height-toggle" data-cloud-height-reference="' + active + '" title="' + toggleLabel + '" aria-label="' + toggleLabel + '">' + unit + '</button>' : unit;
    return '<div class="ga-briefing-cloud-height-row"><span>' + _escapeMetarWidgetText(label) + '</span><b data-cloud-height-msl="' + msl + '" data-cloud-height-agl="' + agl + '"><span>' + (active === 'msl' ? msl : agl) + ' ft</span> ' + control + '</b></div>';
  }).join('');
  return content ? '<div class="ga-briefing-cloud-heights">' + content + '</div>' : '';
}
document.addEventListener('click', event => {
  var _event$target2, _event$target2$closes;
  var button = (_event$target2 = event.target) === null || _event$target2 === void 0 || (_event$target2$closes = _event$target2.closest) === null || _event$target2$closes === void 0 ? void 0 : _event$target2$closes.call(_event$target2, '[data-cloud-height-reference]');
  if (!button) return;
  var reference = button.dataset.cloudHeightReference === 'msl' ? 'agl' : 'msl';
  localStorage.setItem(AW_HEIGHT_REFERENCE_KEY, reference);
  var label = awCloudHeightToggleLabel(reference);
  document.querySelectorAll('[data-cloud-height-reference]').forEach(control => {
    var field = control.parentElement;
    field.firstElementChild.textContent = field.getAttribute('data-cloud-height-' + reference) + ' ft';
    control.dataset.cloudHeightReference = reference;
    control.textContent = reference.toUpperCase();
    control.title = label;
    control.setAttribute('aria-label', label);
  });
}, true); // The map drawer stops clicks from bubbling to the document.

function awBoardFacts(rows) {
  return rows.filter(row => row[1]).map(row => '<div><small>' + _escapeMetarWidgetText(row[0]) + '</small> <b>' + _escapeMetarWidgetText(row[1]) + '</b></div>').join('');
}
function awBriefingAirport(icao) {
  if (!/^[A-Z0-9]{4}$/.test(icao || '')) return null;
  return typeof globalAirports !== 'undefined' && globalAirports ? globalAirports[icao] : null;
}
function awBriefingRunwayText(icao, airport) {
  if (!/^[A-Z0-9]{4}$/.test(icao || '')) return '';
  return typeof formatOpenAipAirportRunways === 'function' && formatOpenAipAirportRunways(airport) || typeof runwayCache !== 'undefined' && runwayCache[icao] || '';
}
function loadMetarWidget(_x10, _x11, _x12, _x13) {
  return _loadMetarWidget.apply(this, arguments);
}
function _loadMetarWidget() {
  _loadMetarWidget = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee7(icao, containerId, lat, lon) {
    var _awNumber3, _awNumber4, _prior$controller, _window$gaProfileData, _window$gaProfileData2;
    var forceModern,
      options,
      container,
      airportCode,
      airport,
      latValue,
      lonValue,
      hasPoint,
      _awWidgetLoads$get,
      source,
      validAt,
      prior,
      controller,
      paper,
      compact,
      pointKey,
      reuse,
      state,
      isCurrent,
      contentId,
      layout,
      widget,
      content,
      details,
      alerts,
      point,
      symbols,
      sigmets,
      committed,
      updateAlerts,
      finish,
      heights,
      _ref0,
      _ref1,
      result,
      weather,
      hours,
      title,
      fields,
      badge,
      heading,
      rose,
      renderRose,
      updateRose,
      _args7 = arguments,
      _t5,
      _t6;
    return _regenerator().w(function (_context7) {
      while (1) switch (_context7.p = _context7.n) {
        case 0:
          forceModern = _args7.length > 4 && _args7[4] !== undefined ? _args7[4] : false;
          options = _args7.length > 5 && _args7[5] !== undefined ? _args7[5] : {};
          container = document.getElementById(containerId);
          if (!(!container || typeof _dispatchUiCommitAllowed === 'function' && !_dispatchUiCommitAllowed(options))) {
            _context7.n = 1;
            break;
          }
          return _context7.a(2);
        case 1:
          awWidgetLoads.forEach((load, id) => {
            if (load.container !== document.getElementById(id)) {
              load.controller.abort();
              awWidgetLoads.delete(id);
            }
          });
          airportCode = String(icao || '').toUpperCase();
          airport = options.airport || awBriefingAirport(airportCode);
          latValue = (_awNumber3 = awNumber(lat)) !== null && _awNumber3 !== void 0 ? _awNumber3 : awNumber(airport === null || airport === void 0 ? void 0 : airport.lat);
          lonValue = (_awNumber4 = awNumber(lon)) !== null && _awNumber4 !== void 0 ? _awNumber4 : awNumber(airport === null || airport === void 0 ? void 0 : airport.lon);
          hasPoint = latValue !== null && lonValue !== null;
          if (!(icao === 'POI' || !icao && !hasPoint)) {
            _context7.n = 2;
            break;
          }
          (_awWidgetLoads$get = awWidgetLoads.get(containerId)) === null || _awWidgetLoads$get === void 0 || _awWidgetLoads$get.controller.abort();
          awWidgetLoads.delete(containerId);
          container.style.display = 'none';
          return _context7.a(2);
        case 2:
          source = awWeatherSource();
          validAt = awWeatherValidAt();
          prior = awWidgetLoads.get(containerId);
          prior === null || prior === void 0 || (_prior$controller = prior.controller) === null || _prior$controller === void 0 || _prior$controller.abort();
          controller = ((_window$gaProfileData = window.gaProfileDataProvider) === null || _window$gaProfileData === void 0 || (_window$gaProfileData2 = _window$gaProfileData.createAbortController) === null || _window$gaProfileData2 === void 0 ? void 0 : _window$gaProfileData2.call(_window$gaProfileData)) || new AbortController();
          paper = !forceModern && (document.body.classList.contains('theme-retro') || document.body.classList.contains('theme-ops1940'));
          compact = Boolean(options.contextCompact);
          pointKey = JSON.stringify([airportCode, latValue, lonValue, forceModern, paper, compact]);
          reuse = (prior === null || prior === void 0 ? void 0 : prior.container) === container && prior.pointKey === pointKey;
          state = {
            container,
            controller,
            pointKey,
            args: [icao, containerId, lat, lon, forceModern, options]
          };
          awWidgetLoads.set(containerId, state);
          isCurrent = () => awWidgetLoads.get(containerId) === state && container === document.getElementById(containerId) && source === awWeatherSource() && validAt === awWeatherValidAt() && (typeof _dispatchUiCommitAllowed !== 'function' || _dispatchUiCommitAllowed(options));
          contentId = containerId + 'Content';
          container.style.display = 'block';
          container.style.boxShadow = paper ? 'none' : '';
          container.style.background = paper ? 'transparent' : '';
          if (!reuse || !container.querySelector('.ga-briefing-weather-widget')) {
            layout = paper ? ' is-paper' : compact ? ' is-context ga-map-context-weather-card' : '';
            container.innerHTML = '<div class="ga-briefing-weather-widget' + layout + '">' + awWeatherSourceControl() + '<div id="' + contentId + '"></div><div class="ga-briefing-weather-details"></div>' + '<div class="ga-briefing-weather-alerts"></div></div>';
          }
          widget = container.firstElementChild;
          content = document.getElementById(contentId);
          details = container.querySelector('.ga-briefing-weather-details');
          alerts = container.querySelector('.ga-briefing-weather-alerts');
          point = {
            lat: latValue,
            lon: lonValue
          };
          symbols = [], sigmets = null, committed = false;
          updateAlerts = () => {
            if (committed && isCurrent()) alerts.innerHTML = awWeatherWarnings(symbols, sigmets);
          };
          finish = observedAt => {
            widget.querySelector('.ga-briefing-weather-source').outerHTML = awWeatherSourceControl(observedAt);
            widget.removeAttribute('aria-busy');
            committed = true;
            updateAlerts();
          };
          widget.setAttribute('aria-busy', 'true');
          if (hasPoint && validAt === null) awReadPointSigmets([point]).then(rows => {
            sigmets = rows[0];
            updateAlerts();
          });
          if (!(source === 'metar')) {
            _context7.n = 4;
            break;
          }
          heights = '';
          _context7.n = 3;
          return awLoadMetarWidget(icao, contentId, lat, lon, forceModern, _objectSpread(_objectSpread({}, options), {}, {
            weatherCommit: isCurrent,
            preserveLoadingContent: true,
            onMetar(metar) {
              heights = awCloudHeightBlock(awMetarCloudHeights(metar));
              symbols = awWeatherSymbols(null, metar.wxString);
            }
          }));
        case 3:
          if (isCurrent()) {
            details.innerHTML = heights;
            finish();
          }
          return _context7.a(2);
        case 4:
          if (!content.firstChild) content.textContent = _awText('airportWx.searching', 'Sucht lokales Wetter...');
          _context7.p = 5;
          if (!hasPoint) {
            _context7.n = 7;
            break;
          }
          _context7.n = 6;
          return awReadModelWeather(source, [point], controller.signal, validAt);
        case 6:
          _t5 = _context7.v;
          _context7.n = 8;
          break;
        case 7:
          _t5 = [];
        case 8:
          _ref0 = _t5;
          _ref1 = _slicedToArray(_ref0, 1);
          result = _ref1[0];
          if (isCurrent()) {
            _context7.n = 9;
            break;
          }
          return _context7.a(2);
        case 9:
          details.innerHTML = '';
          if (result) {
            _context7.n = 10;
            break;
          }
          content.textContent = validAt === null ? _awText('airportWx.noAuto', 'Kein automatisches Wetter verfügbar.') : _awText('airportWx.noForecastHour', 'Für diese Stunde fehlen DWD-Daten.');
          finish();
          return _context7.a(2);
        case 10:
          weather = awModelFields(result, airport === null || airport === void 0 ? void 0 : airport.elevation);
          hours = Number.isFinite(weather.observedAt) ? ' · ' + new Date(weather.observedAt).toISOString().slice(11, 16) + ' UTC' : '';
          title = source === result.source ? source === 'dwd' ? '' : hours.slice(3) : weather.source + hours + ' · Fallback';
          fields = [['Wind', weather.wind], [_awText('mapContext.wx.visibility', 'Sicht'), weather.vis], [_awText('cl.wx.temperature', 'Temperatur'), [weather.temp, weather.dew, weather.rh].filter(Boolean).join(' / ')], [_awText('cl.wx.pressure', 'Luftdruck'), weather.pressure], [_awText('mapContext.wx.cloudLevels', 'Wolken L/M/H'), weather.clouds], [_awText('airportWx.precipitation', 'Niederschlag'), weather.precipitation], ['WX', weather.wx]];
          badge = awFlightCategoryBadge(weather.cat, true, weather.ceilingCategory);
          heading = title || badge ? '<div class="ga-briefing-model-heading"><b>' + _escapeMetarWidgetText(title) + '</b>' + badge + '</div>' : '';
          content.innerHTML = '<div class="ga-briefing-model-weather">' + heading + '<div class="ga-briefing-weather-layout"><div>' + awBoardFacts(fields) + '</div><div data-aw-board-rose></div></div>' + awCloudHeightBlock(weather) + '</div>';
          symbols = weather.symbols;
          rose = content.querySelector('[data-aw-board-rose]');
          renderRose = paper ? awPaperWindRose : awBriefingWindRose;
          updateRose = () => {
            rose.innerHTML = renderRose(weather.windDeg, weather.windKt, awBriefingRunwayText(airportCode, airport), weather.wind);
          };
          updateRose();
          finish(weather.observedAt);
          if (!(/^[A-Z0-9]{4}$/.test(airportCode) && !awBriefingRunwayText(airportCode, airport) && typeof readAirportRunwayDetails === 'function')) {
            _context7.n = 12;
            break;
          }
          _context7.n = 11;
          return readAirportRunwayDetails(latValue, lonValue, airportCode).catch(() => null);
        case 11:
          if (isCurrent()) updateRose();
        case 12:
          _context7.n = 14;
          break;
        case 13:
          _context7.p = 13;
          _t6 = _context7.v;
          if (isCurrent()) {
            content.textContent = _awText('airportWx.noAuto', 'Kein automatisches Wetter verfügbar.');
            details.innerHTML = '';
            finish();
          }
        case 14:
          return _context7.a(2);
      }
    }, _callee7, null, [[5, 13]]);
  }));
  return _loadMetarWidget.apply(this, arguments);
}
