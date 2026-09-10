// Generated from airport-weather.js by sync-efb-web-assets.js. Do not edit.
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
  _fetchWithTimeout2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(url) {
    var _window$gaAirportWeat2;
    var timeoutMs,
      controller,
      timeoutId,
      _args = arguments;
    return _regenerator().w(function (_context) {
      while (1) switch (_context.p = _context.n) {
        case 0:
          timeoutMs = _args.length > 1 && _args[1] !== undefined ? _args[1] : 2500;
          if (!((_window$gaAirportWeat2 = window.gaAirportWeatherHost) !== null && _window$gaAirportWeat2 !== void 0 && _window$gaAirportWeat2.fetchWithTimeout)) {
            _context.n = 1;
            break;
          }
          return _context.a(2, window.gaAirportWeatherHost.fetchWithTimeout(url, timeoutMs));
        case 1:
          controller = new AbortController();
          timeoutId = setTimeout(() => controller.abort(), Math.max(250, Number(timeoutMs) || 2500));
          _context.p = 2;
          _context.n = 3;
          return fetch(url, {
            signal: controller.signal
          });
        case 3:
          return _context.a(2, _context.v);
        case 4:
          _context.p = 4;
          clearTimeout(timeoutId);
          return _context.f(4);
        case 5:
          return _context.a(2);
      }
    }, _callee, null, [[2,, 4, 5]]);
  }));
  return _fetchWithTimeout2.apply(this, arguments);
}
function _fetchMetarArrayViaVariants(_x2) {
  return _fetchMetarArrayViaVariants2.apply(this, arguments);
}
function _fetchMetarArrayViaVariants2() {
  _fetchMetarArrayViaVariants2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(sourceUrl) {
    var _ref,
      _ref$includeCodeTabs,
      includeCodeTabs,
      _ref$includeDirect,
      includeDirect,
      _ref$retries,
      retries,
      _ref$timeoutMs,
      timeoutMs,
      _ref$retryDelayMs,
      retryDelayMs,
      variants,
      maxRetries,
      attempt,
      _iterator,
      _step,
      url,
      res,
      txt,
      arr,
      _args2 = arguments,
      _t,
      _t2;
    return _regenerator().w(function (_context2) {
      while (1) switch (_context2.p = _context2.n) {
        case 0:
          _ref = _args2.length > 1 && _args2[1] !== undefined ? _args2[1] : {}, _ref$includeCodeTabs = _ref.includeCodeTabs, includeCodeTabs = _ref$includeCodeTabs === void 0 ? false : _ref$includeCodeTabs, _ref$includeDirect = _ref.includeDirect, includeDirect = _ref$includeDirect === void 0 ? false : _ref$includeDirect, _ref$retries = _ref.retries, retries = _ref$retries === void 0 ? 1 : _ref$retries, _ref$timeoutMs = _ref.timeoutMs, timeoutMs = _ref$timeoutMs === void 0 ? 2500 : _ref$timeoutMs, _ref$retryDelayMs = _ref.retryDelayMs, retryDelayMs = _ref$retryDelayMs === void 0 ? 0 : _ref$retryDelayMs;
          variants = [];
          if (includeDirect) variants.push(sourceUrl);
          variants.push(`https://ga-proxy.einherjer.workers.dev/api/metar?src=${encodeURIComponent(sourceUrl)}`);
          if (includeCodeTabs) variants.push(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(sourceUrl)}`);
          maxRetries = Math.max(1, Number(retries) || 1);
          attempt = 0;
        case 1:
          if (!(attempt < maxRetries)) {
            _context2.n = 16;
            break;
          }
          _iterator = _createForOfIteratorHelper(variants);
          _context2.p = 2;
          _iterator.s();
        case 3:
          if ((_step = _iterator.n()).done) {
            _context2.n = 11;
            break;
          }
          url = _step.value;
          _context2.p = 4;
          _context2.n = 5;
          return _fetchWithTimeout(url, timeoutMs);
        case 5:
          res = _context2.v;
          if (!(!res.ok || res.status === 204)) {
            _context2.n = 6;
            break;
          }
          return _context2.a(3, 10);
        case 6:
          _context2.n = 7;
          return res.text();
        case 7:
          txt = _context2.v;
          arr = _parseMetarPayloadToArray(txt);
          if (!(Array.isArray(arr) && arr.length)) {
            _context2.n = 8;
            break;
          }
          return _context2.a(2, arr);
        case 8:
          _context2.n = 10;
          break;
        case 9:
          _context2.p = 9;
          _t = _context2.v;
        case 10:
          _context2.n = 3;
          break;
        case 11:
          _context2.n = 13;
          break;
        case 12:
          _context2.p = 12;
          _t2 = _context2.v;
          _iterator.e(_t2);
        case 13:
          _context2.p = 13;
          _iterator.f();
          return _context2.f(13);
        case 14:
          if (!(attempt < maxRetries - 1 && retryDelayMs > 0)) {
            _context2.n = 15;
            break;
          }
          _context2.n = 15;
          return new Promise(resolve => setTimeout(resolve, retryDelayMs));
        case 15:
          attempt++;
          _context2.n = 1;
          break;
        case 16:
          return _context2.a(2, null);
      }
    }, _callee2, null, [[4, 9], [2, 12, 13, 14]]);
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
    var label = isCardinal ? heading === 0 ? 'N' : heading === 90 ? 'O' : heading === 180 ? 'S' : 'W' : String(heading / 10);
    ticks += `<text x="${tx}" y="${ty}" font-family="sans-serif" font-size="${isCardinal ? 14 : 10}" fill="${isCardinal ? '#111' : '#333'}" font-weight="bold" text-anchor="middle" dominant-baseline="central">${label}</text>`;
  }
  return ticks;
}
function _renderMetarRunwayLayer(runway) {
  var isMini = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  if (!runway) return '';
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
                <span class="ga-weather-loading-status" style="color:#8a6b12;font-size:10px;padding:1px 5px;border:2px solid #c69b28;border-radius:4px;background:rgba(255,255,255,.7);">LÄDT</span>
            </div>
            <div class="ga-weather-layout${responsiveEmbed ? ' ga-weather-layout-responsive' : ''}"
                 style="display:flex;justify-content:space-between;align-items:stretch;gap:5px;${responsiveEmbed ? 'flex-direction:column;' : ''}">
                <div style="display:flex;flex-direction:column;gap:3px;font-family:${weatherFont};flex-shrink:1;min-width:0;">
                    <div><div style="${labelStyle}">WIND</div><div style="${valueStyle}color:#1a73e8;">WIRD GELADEN</div></div>
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
                     aria-label="${runway ? `Piste ${_escapeMetarWidgetText(runway.end1)}/${_escapeMetarWidgetText(runway.end2)}` : 'Piste wird geladen'}"
                     style="position:relative;width:min(100%,148px);height:auto;aspect-ratio:1;flex:0 1 auto;align-self:center;margin:2px auto 0;border:4px solid #a8a291;border-radius:50%;background:#fcfaf5;box-shadow:inset 0 2px 8px rgba(0,0,0,.1),0 2px 6px rgba(0,0,0,.2);">
                    <svg viewBox="0 0 160 160" style="position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;">
                        ${_renderMetarCompassTicks()}
                    </svg>
                    ${_renderMetarRunwayLayer(runway)}
                </div>
            </div>
        </div>`;
};
function loadMetarWidget(_x3, _x4, _x5, _x6) {
  return _loadMetarWidget.apply(this, arguments);
}
function _loadMetarWidget() {
  _loadMetarWidget = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(icao, containerId, lat, lon) {
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
      visMatch,
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
      rwyHdg,
      rwy1,
      rwy2,
      rData,
      match,
      headerText,
      modernHeaderText,
      svgTicks,
      i,
      angleRad,
      radius,
      tx,
      ty,
      letter,
      rwyHtml,
      arrowHtml,
      _svgTicks,
      _i,
      isCard,
      isLong,
      len,
      sw,
      col,
      _angleRad,
      _tx,
      _ty,
      _angleRad2,
      _tx2,
      _ty2,
      _letter,
      _arrowHtml,
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
      _args3 = arguments,
      _t3;
    return _regenerator().w(function (_context3) {
      while (1) switch (_context3.p = _context3.n) {
        case 0:
          forceModern = _args3.length > 4 && _args3[4] !== undefined ? _args3[4] : false;
          options = _args3.length > 5 && _args3[5] !== undefined ? _args3[5] : {};
          container = document.getElementById(containerId);
          if (container) {
            _context3.n = 1;
            break;
          }
          return _context3.a(2);
        case 1:
          loadOptions = options && typeof options === 'object' ? options : {};
          commitAllowed = () => typeof _dispatchUiCommitAllowed !== 'function' || _dispatchUiCommitAllowed(loadOptions);
          if (commitAllowed()) {
            _context3.n = 2;
            break;
          }
          return _context3.a(2);
        case 2:
          requestedRunwayIcao = String(loadOptions.runwayIcao || '').trim().toUpperCase(); // Zwingt das Widget ins "Modern"-Design, auch wenn das Retro-Theme aktiv ist (wichtig für Karten-Popups)
          isRetro = !forceModern && document.body.classList.contains('theme-retro');
          isOps1940 = !forceModern && document.body.classList.contains('theme-ops1940');
          if (!loadOptions.preserveLoadingContent || !String(container.innerHTML || '').trim()) {
            if (isRetro || isOps1940) {
              container.style.boxShadow = 'none';
              container.style.background = 'transparent';
              container.innerHTML = '<div style="padding:20px; text-align:center; color:#555; font-family: \'Caveat\', cursive; font-size:22px; transform: rotate(-1deg);">Sucht lokales Wetter...</div>';
            } else {
              container.style.boxShadow = '';
              container.style.background = '';
              container.innerHTML = '<div style="padding:20px; text-align:center; color:#888; font-size:12px; background:#1a1a1a; border-radius:6px;">Sucht lokales Wetter...</div>';
            }
          }
          hasCoordinates = Number.isFinite(Number(lat)) && Number.isFinite(Number(lon));
          if (!(icao === 'POI' || !icao && !hasCoordinates)) {
            _context3.n = 3;
            break;
          }
          container.style.display = 'none';
          return _context3.a(2);
        case 3:
          icaoNorm = String(icao || '').trim().toUpperCase();
          looksLikeIcao = /^[A-Z0-9]{4}$/.test(icaoNorm);
          weatherLocationLabel = icaoNorm || 'diesem Platz';
          container.style.display = 'block';
          _context3.p = 4;
          metarDataList = [];
          isFallback = false;
          foundIcao = icaoNorm; // Zehn Minuten gültiger In-Memory-Cache. Neben exakten Platz-/Koordinaten-
          // Schlüsseln werden komplette METAR-Regionen gehalten, damit ein weiterer
          // Flugplatz im selben Gebiet seine Station sofort und eindeutig wiederverwenden kann.
          _pruneMetarMemoryCache();
          cacheKey = (icaoNorm || 'COORDS') + (hasCoordinates ? `_${Number(lat).toFixed(2)}_${Number(lon).toFixed(2)}` : '');
          cachedEntry = _getMetarMemoryEntry(cacheKey) || _getMetarMemoryEntry(icaoNorm);
          if (!cachedEntry) {
            _context3.n = 5;
            break;
          }
          metarDataList = cachedEntry.data;
          isFallback = cachedEntry.isFallback;
          foundIcao = cachedEntry.foundIcao;
          _context3.n = 13;
          break;
        case 5:
          cachedRegion = hasCoordinates ? _getCachedMetarRegionForPoint(lat, lon) : null;
          cachedRegionSelection = cachedRegion ? _selectMetarForAirport(cachedRegion.data, icaoNorm, lat, lon) : null;
          if (!(cachedRegionSelection !== null && cachedRegionSelection !== void 0 && cachedRegionSelection.station)) {
            _context3.n = 6;
            break;
          }
          metarDataList = [cachedRegionSelection.station];
          isFallback = cachedRegionSelection.isFallback;
          foundIcao = String(cachedRegionSelection.station.icaoId || cachedRegionSelection.station.icao || icaoNorm).trim().toUpperCase();
          _context3.n = 9;
          break;
        case 6:
          if (!looksLikeIcao) {
            _context3.n = 9;
            break;
          }
          directUrl = `https://aviationweather.gov/api/data/metar?ids=${icaoNorm}&format=json&t=${Date.now()}`;
          _context3.n = 7;
          return _fetchMetarArrayViaVariants(directUrl, {
            includeCodeTabs: true,
            includeDirect: false,
            retries: 2,
            timeoutMs: 3500,
            retryDelayMs: 350
          });
        case 7:
          mainData = _context3.v;
          if (commitAllowed()) {
            _context3.n = 8;
            break;
          }
          return _context3.a(2);
        case 8:
          if (Array.isArray(mainData)) metarDataList = mainData;
        case 9:
          if (!((!metarDataList || metarDataList.length === 0) && hasCoordinates)) {
            _context3.n = 12;
            break;
          }
          latMin = lat - 0.6, latMax = lat + 0.6;
          lonMin = lon - 0.8, lonMax = lon + 0.8;
          fbUrl = `https://aviationweather.gov/api/data/metar?bbox=${latMin},${lonMin},${latMax},${lonMax}&format=json&t=${Date.now()}`;
          _context3.n = 10;
          return _fetchMetarArrayViaVariants(fbUrl, {
            includeCodeTabs: true,
            includeDirect: false,
            retries: 2,
            timeoutMs: 3500,
            retryDelayMs: 350
          });
        case 10:
          fbData = _context3.v;
          if (commitAllowed()) {
            _context3.n = 11;
            break;
          }
          return _context3.a(2);
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
            _context3.n = 14;
            break;
          }
          return _context3.a(2);
        case 14:
          container = document.getElementById(containerId);
          if (container) {
            _context3.n = 15;
            break;
          }
          return _context3.a(2);
        case 15:
          if (!Array.isArray(metarDataList)) metarDataList = [];
          metarDataList = metarDataList.filter(m => m && typeof m === 'object');
          if (!(!metarDataList || metarDataList.length === 0)) {
            _context3.n = 17;
            break;
          }
          loadingCard = (_container$querySelec = (_container = container).querySelector) === null || _container$querySelec === void 0 ? void 0 : _container$querySelec.call(_container, '[data-ga-metar-loading="true"]');
          if (!(loadOptions.preserveLoadingContent && loadingCard)) {
            _context3.n = 16;
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
          return _context3.a(2);
        case 16:
          if (isRetro) {
            container.innerHTML = `
                    <div style="padding:15px; text-align:center; font-family: 'Caveat', cursive; transform: rotate(1deg);">
                        <div style="color:#d93829; font-weight:bold; font-size: 22px; margin-bottom:5px;">Kein METAR in der Nähe von ${weatherLocationLabel}</div>
                        <div style="font-size:18px; color:#555; margin-bottom:12px;">Kein automatisches Wetter verfügbar.</div>
                        ${looksLikeIcao ? `<a data-ga-airport-weather="${icaoNorm}" href="https://metar-taf.com/de/${icaoNorm}" target="_blank" style="display:inline-block; color:#0b1f65; font-size:20px; font-weight:bold; text-decoration:underline;">Manuell suchen ➔</a>` : ''}
                    </div>`;
          } else {
            container.innerHTML = `
                    <div style="background:#1a1a1a; border-radius:6px; padding:15px; text-align:center; border: 1px solid #333;">
                        <div style="color:#d93829; font-weight:bold; margin-bottom:5px;">Kein METAR in der Nähe von ${weatherLocationLabel}</div>
                        <div style="font-size:11px; color:#888; margin-bottom:12px;">Für diesen Bereich steht kein automatisches Wetter zur Verfügung.</div>
                        ${looksLikeIcao ? `<a data-ga-airport-weather="${icaoNorm}" href="https://metar-taf.com/de/${icaoNorm}" target="_blank" style="display:inline-block; background:#4da6ff; color:#111; padding:6px 12px; border-radius:4px; text-decoration:none; font-size:12px; font-weight:bold; transition: background 0.2s;">Manuell suchen ➔</a>` : ''}
                    </div>`;
          }
          return _context3.a(2);
        case 17:
          metar = metarDataList[0];
          if (!(!metar || typeof metar !== 'object')) {
            _context3.n = 18;
            break;
          }
          container.innerHTML = `<div style="padding:10px; text-align:center; color:#d93829; font-size:12px; background:#1a1a1a;">Kein verwertbares METAR für ${icao} gefunden.</div>`;
          return _context3.a(2);
        case 18:
          raw = typeof metar.rawOb === 'string' ? metar.rawOb : typeof metar.raw === 'string' ? metar.raw : "";
          temp = metar.temp != null ? metar.temp + '°C' : '--';
          dewp = metar.dewp != null ? metar.dewp + '°C' : '--';
          catColor = "#fff";
          catText = metar.fltCat || "N/A";
          if (catText === "VFR") catColor = "#33ff33";else if (catText === "MVFR") catColor = "#4da6ff";else if (catText === "IFR") catColor = "#ff3333";else if (catText === "LIFR") catColor = "#ff33ff";
          cover = metar.cover || "--";
          if (cover === "Clear") cover = "CLR";
          visib = metar.visib !== undefined && metar.visib !== null ? metar.visib + ' sm' : '--';
          visMatch = raw.match(/\s(\d{4})\s/);
          if (raw.includes(' 9999 ')) visib = '> 10 km';else if (visMatch && !visMatch[1].startsWith('0000')) visib = parseInt(visMatch[1], 10) + ' m';
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
            _context3.n = 22;
            break;
          }
        case 19:
          if (!(runwayIcao && !runwayCache[runwayIcao] && retries < 15)) {
            _context3.n = 22;
            break;
          }
          _context3.n = 20;
          return new Promise(r => setTimeout(r, 200));
        case 20:
          if (commitAllowed()) {
            _context3.n = 21;
            break;
          }
          return _context3.a(2);
        case 21:
          retries++;
          _context3.n = 19;
          break;
        case 22:
          if (commitAllowed()) {
            _context3.n = 23;
            break;
          }
          return _context3.a(2);
        case 23:
          container = document.getElementById(containerId);
          if (container) {
            _context3.n = 24;
            break;
          }
          return _context3.a(2);
        case 24:
          rwyHdg = 0;
          rwy1 = "";
          rwy2 = "";
          rData = runwayIcao ? runwayCache[runwayIcao] : null;
          if (rData && !rData.includes('Keine Daten')) {
            match = rData.match(/(?:^|\s|\n|<br\s*\/?>)(0[1-9]|[12]\d|3[0-6])([LRC]?)\s*\/\s*((?:0[1-9]|[12]\d|3[0-6])[LRC]?)/);
            if (match) {
              rwyHdg = parseInt(match[1], 10) * 10;
              rwy1 = match[1] + match[2];
              rwy2 = match[3];
            }
          }
          headerText = isFallback ? `Nearest: ${foundIcao}` : `Station: ${icaoNorm}`;
          modernHeaderText = isFallback ? `▶ NEAREST: ${foundIcao}` : `▶ STATION: ${icaoNorm}`;
          if (isRetro) {
            svgTicks = `
                <circle cx="80" cy="80" r="70" stroke="#444" stroke-width="1.5" fill="none" stroke-dasharray="30.65 6" transform="rotate(2.45 80 80)"/>
                <circle cx="80" cy="80" r="3" fill="#444" />`; // Füge N, O, S, W und 30-Grad-Schritte rotierend hinzu
            for (i = 0; i < 360; i += 30) {
              angleRad = (i - 90) * Math.PI / 180;
              radius = 61;
              tx = 80 + radius * Math.cos(angleRad);
              ty = 80 + radius * Math.sin(angleRad); // dx="-2" gleicht den kursiven Schwung (Slant) von Caveat aus, der sonst wie eine Rechtsrotation wirkt
              if (i % 90 === 0) {
                letter = i === 0 ? 'N' : i === 90 ? 'O' : i === 180 ? 'S' : 'W';
                svgTicks += `<text x="${tx}" y="${ty}" dx="-2" font-family="'Caveat', cursive" font-size="22" fill="#222" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${i} ${tx} ${ty})">${letter}</text>`;
              } else {
                svgTicks += `<text x="${tx}" y="${ty}" dx="-1.5" font-family="'Caveat', cursive" font-size="14" fill="#666" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${i} ${tx} ${ty})">${i / 10}</text>`;
              }
            }
            rwyHtml = '';
            if (rwy1 && rwy2) {
              // Piste wurde oben und unten gekürzt (y="29", height="102") um Abstand zu den Zahlen zu gewinnen
              rwyHtml = `
                    <g transform="translate(80,80) rotate(${rwyHdg}) translate(-80,-80)">
                        <rect x="68" y="29" width="24" height="102" fill="none" stroke="#222" stroke-width="1.5" stroke-dasharray="30 4 15 4"/>
                        <text x="80" y="43" font-family="'Caveat', cursive" font-size="14" fill="#111" font-weight="bold" text-anchor="middle" transform="rotate(180 80 39)">${rwy2}</text>
                        <text x="80" y="125" font-family="'Caveat', cursive" font-size="14" fill="#111" font-weight="bold" text-anchor="middle">${rwy1}</text>
                    </g>`;
            }
            arrowHtml = '';
            if (!isVRB && wspd > 0 && wdir !== null && wdir !== "VRB") {
              arrowHtml = `
                <g transform="rotate(${wdir} 80 80)">
                    <path d="M 80 10 C 77 30, 83 50, 80 65" stroke="#1a73e8" stroke-width="2.5" fill="none" stroke-linecap="round"/>
                    <path d="M 74 54 L 80 68 L 86 52" stroke="#1a73e8" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </g>`;
            }
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
                        <div style="position:relative; width: 130px; height: 130px; flex-shrink: 0;">
                            <svg viewBox="0 0 160 160" style="width:100%; height:100%; overflow:visible;">
                                ${svgTicks}${rwyHtml}${arrowHtml}
                            </svg>
                        </div>
                    </div>
                </div>`;
          } else {
            _svgTicks = '';
            for (_i = 0; _i < 360; _i += 5) {
              isCard = _i % 90 === 0, isLong = _i % 10 === 0;
              len = isCard ? 8 : isLong ? 5 : 3, sw = isCard ? 2 : 1, col = isCard ? '#111' : '#888';
              _svgTicks += `<line x1="80" y1="2" x2="80" y2="${2 + len}" stroke="${col}" stroke-width="${sw}" transform="rotate(${_i} 80 80)" />`;
              if (_i % 30 === 0 && !isCard) {
                _angleRad = (_i - 90) * Math.PI / 180, _tx = 80 + 61 * Math.cos(_angleRad), _ty = 80 + 61 * Math.sin(_angleRad);
                _svgTicks += `<text x="${_tx}" y="${_ty}" font-family="sans-serif" font-size="10" fill="#333" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${_i} ${_tx} ${_ty})">${_i / 10}</text>`;
              } else if (isCard) {
                _angleRad2 = (_i - 90) * Math.PI / 180, _tx2 = 80 + 61 * Math.cos(_angleRad2), _ty2 = 80 + 61 * Math.sin(_angleRad2);
                _letter = _i === 0 ? 'N' : _i === 90 ? 'O' : _i === 180 ? 'S' : 'W';
                _svgTicks += `<text x="${_tx2}" y="${_ty2}" font-family="sans-serif" font-size="14" fill="#111" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${_i} ${_tx2} ${_ty2})">${_letter}</text>`;
              }
            }
            _arrowHtml = '';
            if (!isVRB && wspd > 0 && wdir !== null && wdir !== "VRB") {
              _arrowHtml = `
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
            cSize = isMini ? '90px' : isResponsiveEmbed ? 'min(100%, 148px)' : '160px';
            cHeight = isResponsiveEmbed ? 'auto' : cSize;
            gap = isMini ? 4 : isResponsiveEmbed ? 3 : 8;
            fVal = isMini ? 12 : isResponsiveEmbed ? 13 : 15;
            fLbl = isMini ? 9 : isResponsiveEmbed ? 8 : 10;
            rowGap = isResponsiveEmbed ? 7 : 12;
            pPad = isMini ? '10px' : isResponsiveEmbed ? '10px' : '15px 15px 20px 15px';
            weatherFont = isOps1940 ? "'Caveat', cursive" : "'Courier New', Courier, monospace";
            weatherOuterFont = isOps1940 ? "'Caveat', cursive" : "'Arial', sans-serif";
            rawTextSafe = raw && raw.trim() ? raw : 'RAW nicht verfügbar';
            miniDecoded = `${visib} · ${wx} · ${temp} / ${dewp} · ${cover}`;
            container.innerHTML = `
                <div class="ga-weather-card" style="${isMini ? 'background:none; border:none; box-shadow:none; padding:4px 0;' : `background:#f0eada; border-radius:12px; padding:${pPad}; border: 3px solid #c2bba8; box-shadow: 0 4px 8px rgba(0,0,0,0.2), inset 0 2px 5px rgba(255,255,255,0.5);`} font-family:${weatherOuterFont}; color: #333; position:relative; overflow:hidden;">

                    ${!isMini ? `
                    <div style="position:absolute; top:6px; left:6px; width:6px; height:6px; background:#ddd; border-radius:50%; box-shadow: inset 0 0 2px #555;"></div>
                    <div style="position:absolute; bottom:6px; right:6px; width:6px; height:6px; background:#ddd; border-radius:50%; box-shadow: inset 0 0 2px #555;"></div>
                    <div style="position:absolute; top:6px; right:6px; width:6px; height:6px; background:#ddd; border-radius:50%; box-shadow: inset 0 0 2px #555;"></div>
                    <div style="position:absolute; bottom:6px; left:6px; width:6px; height:6px; background:#ddd; border-radius:50%; box-shadow: inset 0 0 2px #555;"></div>
                    ` : ''}

                    <div style="color:#8a1a12; font-size:${isResponsiveEmbed ? 12 : 14}px; font-weight:bold; margin-bottom:${isMini ? 6 : isResponsiveEmbed ? 5 : 12}px; ${isMini ? '' : 'border-bottom:2px dashed #c2bba8;'} padding-bottom:${isMini ? 0 : isResponsiveEmbed ? 4 : 8}px; font-family:${weatherFont}; display:flex; justify-content:space-between; align-items:center; letter-spacing:0.5px;">
                        <span>${modernHeaderText}</span>
                        <span style="color:${catColor}; font-size:${isResponsiveEmbed ? 12 : 14}px; padding:${isResponsiveEmbed ? '1px 5px' : '2px 8px'}; border:2px solid ${catColor}; border-radius:4px; background:rgba(255,255,255,0.7); box-shadow:0 1px 2px rgba(0,0,0,0.1);">${catText}</span>
                    </div>
                    ${!isMini && !isResponsiveEmbed ? `<div style="background:#e6e0ce; color:#333; font-family:${weatherFont}; padding:10px; border-radius:4px; font-size:11.5px; margin-bottom:18px; border: 1px inset #c2bba8; line-height: 1.4; letter-spacing: 0.5px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">${rawTextSafe}</div>` : ''}
                    ${isMini ? `<div style="background:#ece6d6; color:#2f2f2f; font-family:${weatherFont}; padding:6px 8px; border-radius:4px; font-size:10px; margin-bottom:8px; border:1px solid #c8c0ac; line-height:1.35; word-break:break-word;">${rawTextSafe}<br><span style="color:#555;">${miniDecoded}</span></div>` : ''}
                    <div class="ga-weather-layout${isResponsiveEmbed ? ' ga-weather-layout-responsive' : ''}" style="display:flex; justify-content:space-between; align-items:${isResponsiveEmbed ? 'stretch' : 'center'}; gap:${isResponsiveEmbed ? 5 : 8}px;${isResponsiveEmbed ? ' flex-direction:column;' : ''}">
                        <div style="display:flex; flex-direction:column; gap:${gap}px; font-family:${weatherFont}; flex-shrink: 1; min-width: 0;">
                            <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">WIND</div><div style="color:#1a73e8; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${windText}</div></div>
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
                                <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">QNH</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${qnhStr}</div></div>
                                ${!isMini ? `<div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">COVER</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${cover}</div></div>` : ''}
                            </div>
                        </div>
                        <div class="ga-weather-windrose" style="position:relative; width:${cSize}; height:${cHeight}; aspect-ratio:1; flex:${isResponsiveEmbed ? '0 1 auto' : '0 0 auto'}; align-self:${isResponsiveEmbed ? 'center' : 'auto'}; ${isMini ? 'margin-left:auto;' : isResponsiveEmbed ? 'margin:2px auto 0;' : ''} border:4px solid #a8a291; border-radius:50%; background:#fcfaf5; box-shadow:inset 0 2px 8px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.2);">
                            <svg viewBox="0 0 160 160" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:1; pointer-events:none;">
                                ${_svgTicks}
                            </svg>
                            ${rwyHtmlModern}
                            ${_arrowHtml}
                        </div>
                    </div>
                </div>`;
          }
          _context3.n = 29;
          break;
        case 25:
          _context3.p = 25;
          _t3 = _context3.v;
          console.error("METAR fetch error:", _t3);
          if (commitAllowed()) {
            _context3.n = 26;
            break;
          }
          return _context3.a(2);
        case 26:
          container = document.getElementById(containerId);
          if (container) {
            _context3.n = 27;
            break;
          }
          return _context3.a(2);
        case 27:
          _loadingCard = (_container$querySelec2 = (_container2 = container).querySelector) === null || _container$querySelec2 === void 0 ? void 0 : _container$querySelec2.call(_container2, '[data-ga-metar-loading="true"]');
          if (!(loadOptions.preserveLoadingContent && _loadingCard)) {
            _context3.n = 28;
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
          return _context3.a(2);
        case 28:
          _isRetro = document.body.classList.contains('theme-retro');
          _isOps = document.body.classList.contains('theme-ops1940');
          if (_isRetro || _isOps) {
            container.innerHTML = `<div style="padding:10px; text-align:center; color:#d93829; font-family: 'Caveat', cursive; font-size:20px; transform: rotate(-1deg);">Fehler beim Laden des METARs: <br/>${_t3.message || _t3}</div>`;
          } else {
            container.innerHTML = `<div style="padding:10px; text-align:center; color:#d93829; font-size:12px; background:#1a1a1a;">Fehler beim Laden des METARs: <br/>${_t3.message || _t3}</div>`;
          }
        case 29:
          return _context3.a(2);
      }
    }, _callee3, null, [[4, 25]]);
  }));
  return _loadMetarWidget.apply(this, arguments);
}
