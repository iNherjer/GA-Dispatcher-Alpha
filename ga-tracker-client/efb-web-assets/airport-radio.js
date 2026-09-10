// Generated from airport-radio.js by sync-efb-web-assets.js. Do not edit.
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i.return) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
// Standalone frequency matching, priorities and labels shared with EFB.
function fetchAirportFreq(_x, _x2, _x3) {
  return _fetchAirportFreq.apply(this, arguments);
}
function _fetchAirportFreq() {
  _fetchAirportFreq = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(icao, elementId, type) {
    var _window$gaChecklistHo;
    var airportHint,
      options,
      fetch,
      el,
      commitAllowed,
      proxy,
      icaoQuery,
      hintSourceId,
      freqLabelMap,
      pickIcao,
      items,
      _globalAirports,
      _globalAirports2,
      _airport$lon,
      directAirport,
      resolvedAirport,
      airport,
      lat,
      lon,
      lonPadding,
      directSearchIdent,
      res,
      data,
      _airportHint$lon,
      exactById,
      exact,
      nearest,
      hintLat,
      hintLon,
      nearestNm,
      _iterator,
      _step,
      _candidate$geometry,
      candidate,
      coords,
      candidateLon,
      candidateLat,
      nm,
      strictIcaoSearch,
      apt,
      ev,
      elevFt,
      prio,
      bestF,
      bestScore,
      bestFreqValue,
      labeledFreqs,
      lines,
      _window$gaChecklistHo2,
      _window$gaChecklistHo3,
      _args = arguments,
      _t,
      _t2;
    return _regenerator().w(function (_context) {
      while (1) switch (_context.p = _context.n) {
        case 0:
          airportHint = _args.length > 3 && _args[3] !== undefined ? _args[3] : null;
          options = _args.length > 4 && _args[4] !== undefined ? _args[4] : {};
          fetch = ((_window$gaChecklistHo = window.gaChecklistHost) === null || _window$gaChecklistHo === void 0 ? void 0 : _window$gaChecklistHo.fetch) || window.fetch.bind(window);
          el = document.getElementById(elementId);
          commitAllowed = () => typeof _dispatchUiCommitAllowed !== 'function' || _dispatchUiCommitAllowed(options);
          if (commitAllowed()) {
            _context.n = 1;
            break;
          }
          return _context.a(2, null);
        case 1:
          if (el) el.innerText = '📻 Sucht Frequenz...';
          proxy = 'https://ga-proxy.einherjer.workers.dev';
          icaoQuery = String(icao || '').trim().toUpperCase();
          hintSourceId = String((airportHint === null || airportHint === void 0 ? void 0 : airportHint.sourceId) || (airportHint === null || airportHint === void 0 ? void 0 : airportHint.id) || (airportHint === null || airportHint === void 0 ? void 0 : airportHint._id) || '').trim();
          freqLabelMap = {
            'TWR': 'Turm',
            'TOWER': 'Turm',
            'GND': 'Rollkontrolle',
            'GROUND': 'Rollkontrolle',
            'ATIS': 'Information',
            'INFO': 'Information',
            'RADIO': 'Radio',
            'CTAF': 'Radio',
            'UNICOM': 'Radio',
            'MULTICOM': 'Radio',
            'APP': 'Anflug',
            'APPROACH': 'Anflug',
            'DEP': 'Abflug',
            'DEPARTURE': 'Abflug',
            'FIS': 'FIS',
            'APRON': 'Vorfeld',
            'AWOS': 'AWOS'
          };
          pickIcao = apt => String((apt === null || apt === void 0 ? void 0 : apt.icao) || (apt === null || apt === void 0 ? void 0 : apt.icaoCode) || (apt === null || apt === void 0 ? void 0 : apt.ident) || (apt === null || apt === void 0 ? void 0 : apt.code) || (apt === null || apt === void 0 ? void 0 : apt.designator) || (apt === null || apt === void 0 ? void 0 : apt.gpsCode) || (apt === null || apt === void 0 ? void 0 : apt.localCode) || '').trim().toUpperCase();
          _context.p = 2;
          items = [];
          if (!(typeof window.gaGetAviationCollectionForBounds === 'function')) {
            _context.n = 6;
            break;
          }
          if (!(!airportHint && (!globalAirports || Object.keys(globalAirports).length === 0))) {
            _context.n = 4;
            break;
          }
          _context.n = 3;
          return loadGlobalAirports();
        case 3:
          if (commitAllowed()) {
            _context.n = 4;
            break;
          }
          return _context.a(2, null);
        case 4:
          directAirport = (_globalAirports = globalAirports) === null || _globalAirports === void 0 ? void 0 : _globalAirports[icaoQuery];
          resolvedAirport = directAirport ? {
            code: icaoQuery,
            airport: directAirport
          } : typeof getBestAirportSearchResult === 'function' ? getBestAirportSearchResult(icaoQuery, {
            auto: true
          }) : null;
          airport = directAirport || (resolvedAirport !== null && resolvedAirport !== void 0 && resolvedAirport.code ? (_globalAirports2 = globalAirports) === null || _globalAirports2 === void 0 ? void 0 : _globalAirports2[resolvedAirport.code] : null) || airportHint;
          lat = Number(airport === null || airport === void 0 ? void 0 : airport.lat);
          lon = Number((_airport$lon = airport === null || airport === void 0 ? void 0 : airport.lon) !== null && _airport$lon !== void 0 ? _airport$lon : airport === null || airport === void 0 ? void 0 : airport.lng);
          if (!(Number.isFinite(lat) && Number.isFinite(lon))) {
            _context.n = 6;
            break;
          }
          lonPadding = 0.4 / Math.max(0.25, Math.abs(Math.cos(lat * Math.PI / 180)));
          _context.n = 5;
          return window.gaGetAviationCollectionForBounds('airports', {
            west: Math.max(-180, lon - lonPadding),
            south: Math.max(-90, lat - 0.4),
            east: Math.min(180, lon + lonPadding),
            north: Math.min(90, lat + 0.4)
          });
        case 5:
          items = _context.v;
          if (commitAllowed()) {
            _context.n = 6;
            break;
          }
          return _context.a(2, null);
        case 6:
          directSearchIdent = (typeof airportRealIcao === 'function' ? airportRealIcao(airportHint || {}) : '') || icaoQuery;
          if (!(!items.length && /^[A-Z0-9]{2,8}$/.test(directSearchIdent) && !directSearchIdent.startsWith('OA-'))) {
            _context.n = 11;
            break;
          }
          _context.n = 7;
          return fetch(`${proxy}/api/airports?search=${encodeURIComponent(directSearchIdent)}&limit=25&t=${Date.now()}`);
        case 7:
          res = _context.v;
          if (commitAllowed()) {
            _context.n = 8;
            break;
          }
          return _context.a(2, null);
        case 8:
          _context.n = 9;
          return res.json();
        case 9:
          data = _context.v;
          if (commitAllowed()) {
            _context.n = 10;
            break;
          }
          return _context.a(2, null);
        case 10:
          items = Array.isArray(data === null || data === void 0 ? void 0 : data.items) ? data.items : [];
        case 11:
          if (!(items.length > 0)) {
            _context.n = 23;
            break;
          }
          exactById = hintSourceId ? items.find(apt => String((apt === null || apt === void 0 ? void 0 : apt.id) || (apt === null || apt === void 0 ? void 0 : apt._id) || '').trim() === hintSourceId) : null;
          exact = exactById || items.find(apt => pickIcao(apt) === icaoQuery);
          nearest = null;
          hintLat = Number(airportHint === null || airportHint === void 0 ? void 0 : airportHint.lat);
          hintLon = Number((_airportHint$lon = airportHint === null || airportHint === void 0 ? void 0 : airportHint.lon) !== null && _airportHint$lon !== void 0 ? _airportHint$lon : airportHint === null || airportHint === void 0 ? void 0 : airportHint.lng);
          if (!(!exact && Number.isFinite(hintLat) && Number.isFinite(hintLon))) {
            _context.n = 21;
            break;
          }
          nearestNm = Infinity;
          _iterator = _createForOfIteratorHelper(items);
          _context.p = 12;
          _iterator.s();
        case 13:
          if ((_step = _iterator.n()).done) {
            _context.n = 17;
            break;
          }
          candidate = _step.value;
          coords = candidate === null || candidate === void 0 || (_candidate$geometry = candidate.geometry) === null || _candidate$geometry === void 0 ? void 0 : _candidate$geometry.coordinates;
          if (!(!Array.isArray(coords) || coords.length < 2)) {
            _context.n = 14;
            break;
          }
          return _context.a(3, 16);
        case 14:
          candidateLon = Number(coords[0]);
          candidateLat = Number(coords[1]);
          if (!(!Number.isFinite(candidateLat) || !Number.isFinite(candidateLon))) {
            _context.n = 15;
            break;
          }
          return _context.a(3, 16);
        case 15:
          nm = calcNav(hintLat, hintLon, candidateLat, candidateLon).dist;
          if (nm < nearestNm) {
            nearestNm = nm;
            nearest = candidate;
          }
        case 16:
          _context.n = 13;
          break;
        case 17:
          _context.n = 19;
          break;
        case 18:
          _context.p = 18;
          _t = _context.v;
          _iterator.e(_t);
        case 19:
          _context.p = 19;
          _iterator.f();
          return _context.f(19);
        case 20:
          if (nearestNm > 3) nearest = null;
        case 21:
          // Für 4-stellige ICAO-Abfragen nur exakte Treffer zulassen
          strictIcaoSearch = /^[A-Z0-9]{4}$/.test(icaoQuery) && !airportHint;
          apt = exact || nearest || (!strictIcaoSearch ? items[0] : null);
          if (apt) {
            _context.n = 22;
            break;
          }
          if (el) el.innerText = '';
          freqCache[icaoQuery] = [];
          return _context.a(2, null);
        case 22:
          // Elevation aus OpenAIP (unit 0 = Meter, 1 = Fuß)
          if (apt.elevation != null) {
            ev = apt.elevation.value;
            elevFt = apt.elevation.unit === 1 ? ev : Math.round(ev * 3.28084);
            if (type === 'dep') {
              currentDepElev = elevFt;
            }
            if (type === 'dest') {
              currentDestElev = elevFt;
            }
          }
          if (!(apt.frequencies && apt.frequencies.length > 0)) {
            _context.n = 23;
            break;
          }
          // Bestimme die relevanteste Frequenz (Tower > Info > Radio)
          prio = {
            'TOWER': 1,
            'TWR': 1,
            'INFO': 2,
            'INFORMATION': 2,
            'ATIS': 2,
            'RADIO': 3,
            'CTAF': 3,
            'UNICOM': 3,
            'MULTICOM': 3,
            'APP': 4,
            'APPROACH': 4
          };
          bestF = apt.frequencies[0];
          bestScore = 99;
          apt.frequencies.forEach(f => {
            var n = (f.name || '').toUpperCase().trim();
            var score = prio[n] || 99;
            if (score < bestScore) {
              bestScore = score;
              bestF = f;
            }
          });

          // Speichere NUR den Zahlenwert für die Routen-Tabelle
          bestFreqValue = bestF.value;
          if (type === 'dep') currentDepFreq = bestFreqValue;
          if (type === 'dest') currentDestFreq = bestFreqValue;
          if (typeof updateRoutePerformance === 'function') updateRoutePerformance();

          // Für die Detail-Anzeige auf der Karte alle formatieren
          labeledFreqs = apt.frequencies.map(f => {
            var fName = (f.name || '').toUpperCase().trim();
            var label = freqLabelMap[fName] || f.name || 'Freq';
            return {
              label: label,
              value: f.value
            };
          });
          lines = labeledFreqs.map(lf => `📻 ${lf.label}: ${lf.value}`);
          if (el) el.innerHTML = lines.join('<br>');
          freqCache[icaoQuery] = labeledFreqs;
          return _context.a(2, bestFreqValue);
        case 23:
          if (el) el.innerText = '';
          freqCache[icaoQuery] = []; // Mark as fetched but empty
          _context.n = 26;
          break;
        case 24:
          _context.p = 24;
          _t2 = _context.v;
          if (commitAllowed()) {
            _context.n = 25;
            break;
          }
          return _context.a(2, null);
        case 25:
          if (el) el.innerText = '';
          freqCache[icaoQuery] = []; // Mark as fetched but empty
        case 26:
          _context.p = 26;
          (_window$gaChecklistHo2 = window.gaChecklistHost) === null || _window$gaChecklistHo2 === void 0 || (_window$gaChecklistHo3 = _window$gaChecklistHo2.airportUpdated) === null || _window$gaChecklistHo3 === void 0 || _window$gaChecklistHo3.call(_window$gaChecklistHo2);
          return _context.f(26);
        case 27:
          return _context.a(2, null);
      }
    }, _callee, null, [[12, 18, 19, 20], [2, 24, 26, 27]]);
  }));
  return _fetchAirportFreq.apply(this, arguments);
}
