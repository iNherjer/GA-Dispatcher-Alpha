// Generated from airport-details.js by sync-efb-web-assets.js. Do not edit.
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i.return) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
// Shared original App runway lookup, formatting and cache. Host changes transport only.
var runwayLookupInflight = new Map();
var runwayEmptyCache = new Map();
var runwayTemporaryCache = new Map();
var RUNWAY_EMPTY_CACHE_MS = 10 * 60 * 1000;
var RUNWAY_TEMPORARY_RETRY_MS = 15 * 1000;
function getOpenAipRunwayCacheKey(airport) {
  return String((airport === null || airport === void 0 ? void 0 : airport.icaoCode) || (airport === null || airport === void 0 ? void 0 : airport.icao) || (airport === null || airport === void 0 ? void 0 : airport.designator) || (airport === null || airport === void 0 ? void 0 : airport.name) || '').trim().toUpperCase();
}
function getReciprocalRunwayDesignator(designator) {
  var match = String(designator || '').trim().toUpperCase().match(/^(\d{1,2})([LRC]?)$/);
  if (!match) return '';
  var number = Number(match[1]);
  if (!Number.isFinite(number) || number < 1 || number > 36) return '';
  var reciprocalNumber = (number + 17) % 36 + 1;
  var side = match[2] === 'L' ? 'R' : match[2] === 'R' ? 'L' : match[2];
  return `${String(reciprocalNumber).padStart(2, '0')}${side}`;
}
function getOpenAipRunwayLengthMeters(runway) {
  var _runway$dimension, _runway$dimension2;
  var length = Number(runway === null || runway === void 0 || (_runway$dimension = runway.dimension) === null || _runway$dimension === void 0 || (_runway$dimension = _runway$dimension.length) === null || _runway$dimension === void 0 ? void 0 : _runway$dimension.value);
  if (!Number.isFinite(length) || length <= 0) return null;
  return Number(runway === null || runway === void 0 || (_runway$dimension2 = runway.dimension) === null || _runway$dimension2 === void 0 || (_runway$dimension2 = _runway$dimension2.length) === null || _runway$dimension2 === void 0 ? void 0 : _runway$dimension2.unit) === 1 ? length * 0.3048 : length;
}
function getOpenAipRunwaySurfaceLabel(runway) {
  var _runway$surface, _runway$surface2, _runway$surface3, _runway$surface4;
  var explicit = String((runway === null || runway === void 0 || (_runway$surface = runway.surface) === null || _runway$surface === void 0 ? void 0 : _runway$surface.name) || (runway === null || runway === void 0 || (_runway$surface2 = runway.surface) === null || _runway$surface2 === void 0 ? void 0 : _runway$surface2.label) || (runway === null || runway === void 0 || (_runway$surface3 = runway.surface) === null || _runway$surface3 === void 0 ? void 0 : _runway$surface3.compositionName) || (runway === null || runway === void 0 || (_runway$surface4 = runway.surface) === null || _runway$surface4 === void 0 ? void 0 : _runway$surface4.mainCompositeName) || '').trim();
  return explicit;
}
function formatOpenAipAirportRunways(airport) {
  var runways = Array.isArray(airport === null || airport === void 0 ? void 0 : airport.runways) ? airport.runways.filter(Boolean) : [];
  if (!runways.length) return '';
  var byDesignator = new Map();
  runways.forEach(runway => {
    var designator = String((runway === null || runway === void 0 ? void 0 : runway.designator) || '').trim().toUpperCase();
    if (designator && !byDesignator.has(designator)) byDesignator.set(designator, runway);
  });
  var used = new Set();
  var lines = [];
  runways.forEach((runway, index) => {
    var _getOpenAipRunwayLeng;
    var designator = String((runway === null || runway === void 0 ? void 0 : runway.designator) || '').trim().toUpperCase();
    var uniqueKey = designator || `index:${index}`;
    if (used.has(uniqueKey)) return;
    var reciprocal = getReciprocalRunwayDesignator(designator);
    var reciprocalRunway = reciprocal ? byDesignator.get(reciprocal) : null;
    used.add(uniqueKey);
    if (reciprocalRunway) used.add(reciprocal);
    var runwayLabel = reciprocalRunway ? `${designator}/${reciprocal}` : designator || 'Piste';
    var lengthMeters = (_getOpenAipRunwayLeng = getOpenAipRunwayLengthMeters(runway)) !== null && _getOpenAipRunwayLeng !== void 0 ? _getOpenAipRunwayLeng : getOpenAipRunwayLengthMeters(reciprocalRunway);
    var surface = getOpenAipRunwaySurfaceLabel(runway) || getOpenAipRunwaySurfaceLabel(reciprocalRunway);
    var details = [];
    if (surface) details.push(surface);
    if (Number.isFinite(lengthMeters)) details.push(`${Math.round(lengthMeters)}m`);
    lines.push(`${runwayLabel}${details.length ? ` – ${details.join(' · ')}` : ''}`);
  });
  return _toConsumableArray(new Set(lines)).slice(0, 8).join('\n');
}
function seedOpenAipAirportRunways(airports) {
  if (typeof runwayCache === 'undefined' || !Array.isArray(airports)) return;
  airports.forEach(airport => {
    var key = getOpenAipRunwayCacheKey(airport);
    if (!key) return;
    var formatted = formatOpenAipAirportRunways(airport);
    if (!formatted) return;
    var cached = String(runwayCache[key] || '');
    if (!cached || cached === 'Keine Daten gefunden') {
      runwayCache[key] = formatted;
    }
  });
}
function findOpenAipAirportInPayloads(payloads, icao, lat, lon) {
  var targetCode = String(icao || '').trim().toUpperCase();
  var nearest = null;
  var nearestDistance = Infinity;
  var _iterator = _createForOfIteratorHelper(payloads),
    _step;
  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var payload = _step.value;
      var _iterator2 = _createForOfIteratorHelper(Array.isArray(payload === null || payload === void 0 ? void 0 : payload.airports) ? payload.airports : []),
        _step2;
      try {
        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
          var _airport$geometry;
          var airport = _step2.value;
          var code = getOpenAipRunwayCacheKey(airport);
          if (targetCode && code === targetCode) return airport;
          var coords = airport === null || airport === void 0 || (_airport$geometry = airport.geometry) === null || _airport$geometry === void 0 ? void 0 : _airport$geometry.coordinates;
          if (!Array.isArray(coords) || coords.length < 2) continue;
          var aptLon = Number(coords[0]);
          var aptLat = Number(coords[1]);
          if (![aptLat, aptLon, lat, lon].every(Number.isFinite)) continue;
          var dLat = aptLat - lat;
          var dLon = (aptLon - lon) * Math.cos(lat * Math.PI / 180);
          var distanceSq = dLat * dLat + dLon * dLon;
          if (distanceSq < nearestDistance) {
            nearestDistance = distanceSq;
            nearest = airport;
          }
        }
      } catch (err) {
        _iterator2.e(err);
      } finally {
        _iterator2.f();
      }
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }
  return nearestDistance <= 0.05 * 0.05 ? nearest : null;
}
window.gaFetchOpenAipAirportRunwayText = /*#__PURE__*/function () {
  var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(icao, lat, lon) {
    var _window$gaAirportDeta;
    var latitude, longitude, lonPadding, bounds, payloads, airport;
    return _regenerator().w(function (_context) {
      while (1) switch (_context.n) {
        case 0:
          latitude = Number(lat);
          longitude = Number(lon);
          if ([latitude, longitude].every(Number.isFinite)) {
            _context.n = 1;
            break;
          }
          return _context.a(2, '');
        case 1:
          lonPadding = 0.45 / Math.max(0.25, Math.abs(Math.cos(latitude * Math.PI / 180)));
          bounds = {
            west: longitude - lonPadding,
            south: latitude - 0.45,
            east: longitude + lonPadding,
            north: latitude + 0.45
          };
          _context.n = 2;
          return (((_window$gaAirportDeta = window.gaAirportDetailsHost) === null || _window$gaAirportDeta === void 0 ? void 0 : _window$gaAirportDeta.snapshots) || getOpenAipSnapshotsForBounds)(bounds, 'airports');
        case 2:
          payloads = _context.v;
          payloads.forEach(payload => seedOpenAipAirportRunways(payload.airports));
          airport = findOpenAipAirportInPayloads(payloads, icao, latitude, longitude);
          return _context.a(2, airport ? formatOpenAipAirportRunways(airport) : '');
      }
    }, _callee);
  }));
  return function (_x, _x2, _x3) {
    return _ref.apply(this, arguments);
  };
}();
function formatOverpassRunwayDetails(data) {
  var elements = Array.isArray(data === null || data === void 0 ? void 0 : data.elements) ? data.elements : [];
  var trans = {
    asphalt: 'Asphalt',
    concrete: 'Beton',
    grass: 'Gras',
    paved: 'Asphalt',
    unpaved: 'Unbefestigt',
    dirt: 'Erde',
    gravel: 'Schotter',
    sand: 'Sand',
    water: 'Wasser'
  };
  var seen = new Set();
  var parts = [];
  var _iterator3 = _createForOfIteratorHelper(elements),
    _step3;
  try {
    for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
      var element = _step3.value;
      var tags = (element === null || element === void 0 ? void 0 : element.tags) || {};
      var ref = String(tags.ref || tags.name || 'Piste').trim();
      var surfaceRaw = String(tags.surface || '').trim();
      var surface = surfaceRaw ? trans[surfaceRaw.toLowerCase()] || surfaceRaw : '';
      var lengthRaw = String(tags.length || '').trim();
      var lengthNumber = Number.parseFloat(lengthRaw.replace(',', '.'));
      var lengthMeters = Number.isFinite(lengthNumber) ? /ft|feet/i.test(lengthRaw) ? lengthNumber * 0.3048 : lengthNumber : null;
      var key = `${ref}|${surface}|${Number.isFinite(lengthMeters) ? Math.round(lengthMeters) : ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      var details = [];
      if (surface) details.push(surface);
      if (Number.isFinite(lengthMeters)) details.push(`${Math.round(lengthMeters)}m`);
      parts.push(`${ref}${details.length ? ` – ${details.join(' · ')}` : ''}`);
    }
  } catch (err) {
    _iterator3.e(err);
  } finally {
    _iterator3.f();
  }
  return parts.slice(0, 8).join('\n');
}
function lookupRunwayDetails(_x4, _x5, _x6) {
  return _lookupRunwayDetails.apply(this, arguments);
}
function _lookupRunwayDetails() {
  _lookupRunwayDetails = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(lat, lon, icaoCode) {
    var openAipText, query, _window$gaAirportDeta2, res, error, data, text, _t, _t2;
    return _regenerator().w(function (_context2) {
      while (1) switch (_context2.p = _context2.n) {
        case 0:
          if (!(typeof window.gaFetchOpenAipAirportRunwayText === 'function')) {
            _context2.n = 5;
            break;
          }
          _context2.p = 1;
          _context2.n = 2;
          return window.gaFetchOpenAipAirportRunwayText(icaoCode, lat, lon);
        case 2:
          openAipText = _context2.v;
          if (!openAipText) {
            _context2.n = 3;
            break;
          }
          return _context2.a(2, {
            status: 'ok',
            text: openAipText,
            source: 'openaip-region'
          });
        case 3:
          _context2.n = 5;
          break;
        case 4:
          _context2.p = 4;
          _t = _context2.v;
        case 5:
          query = `[out:json][timeout:5];nwr["aeroway"="runway"](around:3000,${lat},${lon});out tags;`;
          _context2.p = 6;
          _context2.n = 7;
          return (((_window$gaAirportDeta2 = window.gaAirportDetailsHost) === null || _window$gaAirportDeta2 === void 0 ? void 0 : _window$gaAirportDeta2.fetchWithTimeout) || fetchWithTimeout)(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, 6500);
        case 7:
          res = _context2.v;
          if (res.ok) {
            _context2.n = 8;
            break;
          }
          error = new Error(`overpass_http_${res.status}`);
          error.status = res.status;
          throw error;
        case 8:
          _context2.n = 9;
          return res.json();
        case 9:
          data = _context2.v;
          text = formatOverpassRunwayDetails(data);
          return _context2.a(2, text ? {
            status: 'ok',
            text,
            source: 'overpass'
          } : {
            status: 'empty',
            text: '',
            source: 'overpass'
          });
        case 10:
          _context2.p = 10;
          _t2 = _context2.v;
          return _context2.a(2, {
            status: 'temporary',
            text: '',
            source: 'overpass',
            error: String((_t2 === null || _t2 === void 0 ? void 0 : _t2.message) || _t2)
          });
      }
    }, _callee2, null, [[6, 10], [1, 4]]);
  }));
  return _lookupRunwayDetails.apply(this, arguments);
}
function renderRunwayDetailsResult(domEl, result, icaoCode) {
  if (!domEl || !result) return;
  var hColor = document.body.classList.contains('theme-retro') ? 'var(--piper-yellow)' : 'var(--warn)';
  var summaryText = '';
  if (result.status === 'ok' && result.text) {
    summaryText = result.text;
    domEl.innerHTML = result.text.replace(/\n/g, '<br>');
    domEl.style.color = hColor;
  } else if (result.status === 'empty') {
    summaryText = 'Keine Pisteninformationen vorhanden';
    domEl.innerText = summaryText;
    domEl.style.color = '#888';
  } else {
    summaryText = 'Pistendaten vorübergehend nicht verfügbar · erneut antippen';
    domEl.innerText = summaryText;
    domEl.style.color = '#b7791f';
  }
  if (icaoCode === currentStartICAO && document.getElementById('wikiDepRwyText')) {
    document.getElementById('wikiDepRwyText').innerHTML = `Pisten:<br>${summaryText.replace(/\n/g, '<br>')}`;
  }
  if (icaoCode === currentDestICAO && document.getElementById('wikiDestRwyText')) {
    document.getElementById('wikiDestRwyText').innerHTML = `Pisten:<br>${summaryText.replace(/\n/g, '<br>')}`;
  }
}
function fetchRunwayDetails(_x7, _x8, _x9, _x0) {
  return _fetchRunwayDetails.apply(this, arguments);
}
function _fetchRunwayDetails() {
  _fetchRunwayDetails = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(lat, lon, elementId, icaoCode) {
    var _result, _result2, _result3, _window$gaChecklistHo, _window$gaChecklistHo2;
    var options,
      domEl,
      commitAllowed,
      normalizedIcao,
      lookupKey,
      cachedText,
      emptyCachedAt,
      temporaryCachedAt,
      request,
      result,
      _args3 = arguments;
    return _regenerator().w(function (_context3) {
      while (1) switch (_context3.p = _context3.n) {
        case 0:
          options = _args3.length > 4 && _args3[4] !== undefined ? _args3[4] : {};
          domEl = document.getElementById(elementId);
          if (domEl) {
            _context3.n = 1;
            break;
          }
          return _context3.a(2);
        case 1:
          commitAllowed = () => typeof _dispatchUiCommitAllowed !== 'function' || _dispatchUiCommitAllowed(options);
          if (commitAllowed()) {
            _context3.n = 2;
            break;
          }
          return _context3.a(2);
        case 2:
          normalizedIcao = String(icaoCode || '').trim().toUpperCase();
          lookupKey = normalizedIcao || `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
          cachedText = normalizedIcao ? String(runwayCache[normalizedIcao] || '') : '';
          if (!(cachedText && cachedText !== 'Keine Daten gefunden')) {
            _context3.n = 3;
            break;
          }
          renderRunwayDetailsResult(domEl, {
            status: 'ok',
            text: cachedText,
            source: 'memory'
          }, normalizedIcao);
          return _context3.a(2);
        case 3:
          emptyCachedAt = Number(runwayEmptyCache.get(lookupKey)) || 0;
          if (!(emptyCachedAt && Date.now() - emptyCachedAt < RUNWAY_EMPTY_CACHE_MS)) {
            _context3.n = 4;
            break;
          }
          renderRunwayDetailsResult(domEl, {
            status: 'empty',
            text: '',
            source: 'memory'
          }, normalizedIcao);
          return _context3.a(2);
        case 4:
          if (emptyCachedAt) runwayEmptyCache.delete(lookupKey);
          temporaryCachedAt = Number(runwayTemporaryCache.get(lookupKey)) || 0;
          if (!(temporaryCachedAt && Date.now() - temporaryCachedAt < RUNWAY_TEMPORARY_RETRY_MS)) {
            _context3.n = 5;
            break;
          }
          renderRunwayDetailsResult(domEl, {
            status: 'temporary',
            text: '',
            source: 'memory'
          }, normalizedIcao);
          return _context3.a(2);
        case 5:
          if (temporaryCachedAt) runwayTemporaryCache.delete(lookupKey);
          request = runwayLookupInflight.get(lookupKey);
          if (!request) {
            request = lookupRunwayDetails(Number(lat), Number(lon), normalizedIcao);
            runwayLookupInflight.set(lookupKey, request);
          }
          _context3.p = 6;
          _context3.n = 7;
          return request;
        case 7:
          result = _context3.v;
        case 8:
          _context3.p = 8;
          if (runwayLookupInflight.get(lookupKey) === request) runwayLookupInflight.delete(lookupKey);
          return _context3.f(8);
        case 9:
          if (((_result = result) === null || _result === void 0 ? void 0 : _result.status) === 'ok' && result.text && normalizedIcao) {
            runwayCache[normalizedIcao] = result.text;
            runwayEmptyCache.delete(lookupKey);
            runwayTemporaryCache.delete(lookupKey);
          } else if (((_result2 = result) === null || _result2 === void 0 ? void 0 : _result2.status) === 'empty') {
            runwayEmptyCache.set(lookupKey, Date.now());
            runwayTemporaryCache.delete(lookupKey);
          } else if (((_result3 = result) === null || _result3 === void 0 ? void 0 : _result3.status) === 'temporary') {
            runwayTemporaryCache.set(lookupKey, Date.now());
            console.warn('[Runway] Quelle vorübergehend nicht verfügbar:', normalizedIcao || lookupKey, result.error || result.source);
          }
          if (commitAllowed()) {
            _context3.n = 10;
            break;
          }
          return _context3.a(2);
        case 10:
          domEl = document.getElementById(elementId);
          if (domEl) {
            _context3.n = 11;
            break;
          }
          return _context3.a(2);
        case 11:
          renderRunwayDetailsResult(domEl, result, normalizedIcao);
          (_window$gaChecklistHo = window.gaChecklistHost) === null || _window$gaChecklistHo === void 0 || (_window$gaChecklistHo2 = _window$gaChecklistHo.airportUpdated) === null || _window$gaChecklistHo2 === void 0 || _window$gaChecklistHo2.call(_window$gaChecklistHo);
        case 12:
          return _context3.a(2);
      }
    }, _callee3, null, [[6,, 8, 9]]);
  }));
  return _fetchRunwayDetails.apply(this, arguments);
}
