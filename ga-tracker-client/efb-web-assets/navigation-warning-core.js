// Generated from navigation-warning-core.js by sync-efb-web-assets.js. Do not edit.
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
(function (root, factory) {
  var api = factory(typeof module === 'object' && module.exports ? require('./navigation-warning-audio') : root && root.GANavigationWarningAudio);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GANavigationWarnings = api;
})(typeof window !== 'undefined' ? window : null, function (audio) {
  'use strict';

  // Extracted standalone rules; no DOM, network or playback dependencies.
  function vpPointInPoly(pt, polygon) {
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      var xi = polygon[i][0],
        yi = polygon[i][1];
      var xj = polygon[j][0],
        yj = polygon[j][1];
      var intersect = yi > pt.lat !== yj > pt.lat && pt.lon < (xj - xi) * (pt.lat - yi) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }
  function airspaceLimitToFt(lim) {
    if (!lim) return null;
    if (lim.referenceDatum === 0 && lim.value === 0) return 0;
    if (lim.unit === 6) return lim.value * 100;
    if (lim.unit === 1) return lim.value;
    if (lim.unit === 0) return Math.round(lim.value * 3.28084);
    return lim.value;
  }
  function getAirspaceVerticalBandFt(as, terrainFt) {
    if (!(as !== null && as !== void 0 && as.lowerLimit) || !(as !== null && as !== void 0 && as.upperLimit)) return null;
    var baseLowerFt = airspaceLimitToFt(as.lowerLimit);
    var baseUpperFt = airspaceLimitToFt(as.upperLimit);
    if (baseLowerFt === null || baseUpperFt === null) return null;
    var groundFt = Number(terrainFt) || 0;
    var isLowerAgl = !!(as._lowerIsAgl || as.lowerLimit.referenceDatum === 0);
    var isUpperAgl = !!(as._upperIsAgl || as.upperLimit.referenceDatum === 0);
    var lowerFt = isLowerAgl ? groundFt + baseLowerFt : baseLowerFt;
    var upperFt = isUpperAgl ? groundFt + baseUpperFt : baseUpperFt;
    return {
      lowerFt,
      upperFt,
      baseLowerFt,
      baseUpperFt,
      isLowerAgl,
      isUpperAgl
    };
  }
  function isPointInsideAirspace(as, lat, lon) {
    if (!(as !== null && as !== void 0 && as.geometry)) return false;
    var polys = [];
    if (as.geometry.type === 'Polygon') polys.push(as.geometry.coordinates[0]);else if (as.geometry.type === 'MultiPolygon') as.geometry.coordinates.forEach(mc => polys.push(mc[0]));
    for (var _i = 0, _polys = polys; _i < _polys.length; _i++) {
      var poly = _polys[_i];
      if (vpPointInPoly({
        lat,
        lon
      }, poly)) return true;
    }
    return false;
  }
  function _awTypeKey(as) {
    var t = as.type,
      cls = as.icaoClass;
    if (t === 4) return 'aw-ctr'; // CTR (Kontrollzone)
    if (cls === 2) return 'aw-charlie'; // Class C
    if (cls === 3 || t === 0) return 'aw-delta'; // Class D
    if (t === 7 || t === 26) return 'aw-ctr'; // TMA / CTA → wie CTR ansagen
    if (t === 5 || t === 27) return 'aw-tmz'; // TMZ
    if ((t === 6 || t === 28) && /\bPARA\b/i.test(as.name || '')) return 'aw-para'; // Fallschirmgebiet
    if (t === 6 || t === 28) return 'aw-rmz'; // RMZ
    if (t === 1) return 'aw-edr'; // ED-R Restricted (Buchstaben E-D-R)
    return null; // Danger/Prohibited/FIS → kein Sprach-Alert
  }
  function _awTypeClips(as) {
    var key = _awTypeKey(as);
    return key ? [key] : [];
  }
  function _awMinKey(min) {
    var n = Math.round(min);
    var k = ['', 'aw-1min', 'aw-2min', 'aw-3min', 'aw-4min', 'aw-5min', 'aw-6min', 'aw-7min', 'aw-8min', 'aw-9min', 'aw-10min'];
    return n >= 1 && n <= 10 ? k[n] : null;
  }
  function _awFreqToClips(valueStr, isSquawk) {
    var prefix = isSquawk ? 'aw-sqwk' : 'aw-freq';
    var clips = [prefix];
    // Trailing-Nullen nach dem Komma entfernen (130.000 → 130)
    var s = valueStr.toString().trim().replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
    var _iterator = _createForOfIteratorHelper(s),
      _step;
    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var ch = _step.value;
        if (ch >= '0' && ch <= '9') clips.push(_awDigitClip(parseInt(ch, 10)));else if (ch === '.' || ch === ',') clips.push('aw-komma');
        // Sonstige Zeichen (Leerzeichen, Bindestrich) überspringen
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }
    return clips.filter(Boolean);
  }
  function calcNav(lat1, lon1, lat2, lon2) {
    var R = 3440,
      dLat = (lat2 - lat1) * Math.PI / 180,
      dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
    var y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180),
      x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    return {
      dist,
      brng: Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360)
    };
  }
  function getDestinationPoint(lat, lon, distNM, bearing) {
    var R = 3440.065,
      lat1 = lat * Math.PI / 180,
      lon1 = lon * Math.PI / 180,
      brng = bearing * Math.PI / 180;
    var lat2 = Math.asin(Math.sin(lat1) * Math.cos(distNM / R) + Math.cos(lat1) * Math.sin(distNM / R) * Math.cos(brng));
    var lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(distNM / R) * Math.cos(lat1), Math.cos(distNM / R) - Math.sin(lat1) * Math.sin(lat2));
    return {
      lat: lat2 * 180 / Math.PI,
      lon: lon2 * 180 / Math.PI
    };
  }
  function legDistanceToSegmentNm(lat, lon, a, b) {
    var refLat = (a.lat + b.lat + lat) / 3;
    var cosRef = Math.cos(refLat * Math.PI / 180);
    var ax = (a.lng || a.lon) * cosRef * 60;
    var ay = a.lat * 60;
    var bx = (b.lng || b.lon) * cosRef * 60;
    var by = b.lat * 60;
    var px = lon * cosRef * 60;
    var py = lat * 60;
    var abx = bx - ax,
      aby = by - ay;
    var apx = px - ax,
      apy = py - ay;
    var denom = abx * abx + aby * aby;
    var t = denom > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / denom)) : 0;
    var cx = ax + t * abx,
      cy = ay + t * aby;
    return Math.hypot(px - cx, py - cy);
  }
  function _awDigitClip(d) {
    return Number.isInteger(d) && d >= 0 && d <= 9 ? d === 2 ? 'aw-zwo' : `aw-d${d}` : null;
  }
  function digits(s) {
    return String(s).split('').map(c => _awDigitClip(parseInt(c, 10))).filter(Boolean);
  }
  function frequencyClips(as) {
    var _as$frequencies, _as$frequencies2;
    var enabled = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
    var primary = enabled && (((_as$frequencies = as.frequencies) === null || _as$frequencies === void 0 ? void 0 : _as$frequencies.find(f => f.primary)) || ((_as$frequencies2 = as.frequencies) === null || _as$frequencies2 === void 0 ? void 0 : _as$frequencies2[0]));
    return primary !== null && primary !== void 0 && primary.value ? _awFreqToClips(primary.value, /XPDR|SQK|SQUAWK|TRANSP/.test((primary.name || '').toUpperCase())) : [];
  }
  function waypointClips(brng, dist) {
    return ['aw-wp-erreicht', 'aw-neuer-kurs'].concat(_toConsumableArray(digits(String(Math.round(brng)).padStart(3, '0'))), ['aw-grad', 'aw-fuer'], _toConsumableArray(digits(String(Math.round(dist)))), ['aw-meilen']);
  }
  function normalizeAirspaceNameForFreq(name) {
    return String(name || '').toUpperCase().replace(/\b(TMA|CTR|CTA|TMZ|RMZ|FIS|HX)\b/g, ' ').replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function inferAirspaceLimitIsAgl(as, lim, boundary) {
    if (!as || !lim) return false;
    if (lim.referenceDatum === 0) return true;
    if (lim.referenceDatum !== 1) return false;
    var t = as.type;
    var isTypicalLowAirspace = [0, 4, 5, 6, 7, 26, 27, 28].includes(t);
    if (!isTypicalLowAirspace) return false;
    var value = Number(lim.value);
    if (!Number.isFinite(value)) return false;

    // OpenAIP liefert "GND" vereinzelt als 0 FT MSL statt 0 FT AGL.
    if (boundary === 'lower' && value === 0) return true;

    // Obergrenze nur bei TMZ/RMZ heuristisch auf AGL drehen.
    // Für CTR/TMA/CTA nie auto-AGL, sonst werden legitime MSL-Decken verfälscht.
    if (boundary === 'upper' && lim.unit !== 6 && value > 0) {
      var canAutoUpperAgl = [5, 6, 27, 28].includes(t);
      if (!canAutoUpperAgl) return false;
      var lower = as.lowerLimit || null;
      var lowerLooksGnd = !!lower && Number(lower.value) === 0 && (lower.referenceDatum === 0 || lower.referenceDatum === 1);
      var upperFt = lim.unit === 1 ? value : lim.unit === 0 ? value * 3.28084 : value;
      if (lowerLooksGnd && upperFt <= 4000) return true;
    }
    return false;
  }
  function applyAirspaceLimitHeuristics(as) {
    if (!as) return;
    var lowerIsAgl = inferAirspaceLimitIsAgl(as, as.lowerLimit, 'lower');
    var upperIsAgl = inferAirspaceLimitIsAgl(as, as.upperLimit, 'upper');
    as._lowerIsAgl = !!lowerIsAgl;
    as._upperIsAgl = !!upperIsAgl;
    if (as.lowerLimit && lowerIsAgl) as.lowerLimit.referenceDatum = 0;
    if (as.upperLimit && upperIsAgl) as.upperLimit.referenceDatum = 0;
  }
  function getAirspaceStableId(airspace) {
    var fallback = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
    return String((airspace === null || airspace === void 0 ? void 0 : airspace._id) || (airspace === null || airspace === void 0 ? void 0 : airspace.id) || fallback || '').trim();
  }
  function relevantAirspace(as) {
    return !!as && [0, 1, 2, 3, 4, 5, 6, 7, 26, 27, 28, 33].includes(as.type) && (as.type !== 0 || as.icaoClass === 2 || as.icaoClass === 3);
  }
  // Same input preparation for route warnings and the tracker flight-path query.
  // Copy mutable limits/frequencies so cached database objects remain untouched.
  function prepareAirspaces(items) {
    var added = new Set();
    var intersecting = items.filter(relevantAirspace).filter((as, index) => {
      var _as$type;
      var id = getAirspaceStableId(as, `${as.name || 'airspace'}:${(_as$type = as.type) !== null && _as$type !== void 0 ? _as$type : 'x'}:${index}`);
      if (added.has(id)) return false;
      added.add(id);
      return true;
    }).map(as => _objectSpread(_objectSpread({}, as), {}, {
      lowerLimit: as.lowerLimit && _objectSpread({}, as.lowerLimit),
      upperLimit: as.upperLimit && _objectSpread({}, as.upperLimit),
      frequencies: as.frequencies && as.frequencies.map(f => _objectSpread({}, f))
    }));
    var sortOrder = {
      3: 1,
      1: 2,
      2: 3,
      4: 4,
      0: 5,
      5: 8,
      7: 6,
      26: 7,
      27: 8,
      6: 9,
      28: 9,
      33: 10
    };
    intersecting.sort((a, b) => (sortOrder[a.type] || 99) - (sortOrder[b.type] || 99));

    // Deduplicate by name: type 0 (icaoClass 3) and type 4 often represent the same CTR in OpenAIP
    // Keep type 4, but inherit frequencies from the duplicate if type 4 has none
    var byName = new Map();
    var _iterator2 = _createForOfIteratorHelper(intersecting),
      _step2;
    try {
      for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
        var as = _step2.value;
        // Deduplizierungs-Key:
        // • Typ 0 / Typ 4 (Airspace/CTR): Name + Klasse + untere Grenze — fasst OpenAIP-Duplikate
        //   desselben CTRs zusammen (type 0 ↔ type 4 mit gleichen Grenzen).
        // • Alle anderen Typen (TMA, TMZ, RMZ …): stabile OpenAIP-ID verwenden — jeder Sektor bleibt erhalten,
        //   auch wenn mehrere Sektoren denselben Namen tragen (z.B. Stuttgart TMA Außenring Nord/Süd).
        var lowerVal = as.lowerLimit && as.lowerLimit.value !== undefined ? as.lowerLimit.value : 0;
        var isCtrlDup = as.type === 0 || as.type === 4;
        var stableId = getAirspaceStableId(as);
        var key = isCtrlDup ? (as.name || stableId) + '_' + (as.icaoClass || as.type) + '_' + lowerVal : stableId || (as.name || 'x') + '_' + (as.icaoClass || as.type) + '_' + lowerVal;
        if (!byName.has(key)) {
          byName.set(key, as);
        } else {
          var existing = byName.get(key);
          if (as.type === 4 && existing.type !== 4) {
            var _existing$frequencies;
            if ((!as.frequencies || as.frequencies.length === 0) && ((_existing$frequencies = existing.frequencies) === null || _existing$frequencies === void 0 ? void 0 : _existing$frequencies.length) > 0) as.frequencies = existing.frequencies;
            byName.set(key, as);
          } else if (existing.type === 4 && as.type !== 4) {
            var _as$frequencies3;
            if ((!existing.frequencies || existing.frequencies.length === 0) && ((_as$frequencies3 = as.frequencies) === null || _as$frequencies3 === void 0 ? void 0 : _as$frequencies3.length) > 0) existing.frequencies = as.frequencies;
          }
        }
      }
    } catch (err) {
      _iterator2.e(err);
    } finally {
      _iterator2.f();
    }
    var activeAirspaces = _toConsumableArray(byName.values());

    // Zusätzlicher Frequenz-Fallback:
    // Wenn ein CTR/TMA/CTA-Eintrag ohne Frequenz durchrutscht, versuche aus
    // gleich benannten/intersektierenden Sektoren die Frequenzen zu übernehmen.
    var byNormNameWithFreq = new Map();
    var _iterator3 = _createForOfIteratorHelper(intersecting),
      _step3;
    try {
      for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
        var src = _step3.value;
        if (!(src !== null && src !== void 0 && src.frequencies) || src.frequencies.length === 0) continue;
        var norm = normalizeAirspaceNameForFreq(src.name);
        if (!norm) continue;
        if (!byNormNameWithFreq.has(norm)) byNormNameWithFreq.set(norm, src.frequencies);
      }
    } catch (err) {
      _iterator3.e(err);
    } finally {
      _iterator3.f();
    }
    activeAirspaces.forEach(as => {
      if (as !== null && as !== void 0 && as.frequencies && as.frequencies.length > 0) return;
      var isCtaCtrFamily = [0, 4, 7, 26].includes(as === null || as === void 0 ? void 0 : as.type);
      if (!isCtaCtrFamily) return;
      var norm = normalizeAirspaceNameForFreq(as.name);
      var fallbackFreqs = norm ? byNormNameWithFreq.get(norm) : null;
      if (fallbackFreqs && fallbackFreqs.length > 0) {
        as.frequencies = fallbackFreqs;
      }
    });

    // AGL-/GND-Heuristik auf gematchte Airspaces anwenden.
    activeAirspaces.forEach(as => applyAirspaceLimitHeuristics(as));
    return activeAirspaces;
  }
  function getAirspaceApproxCenter(as) {
    var _as$geometry$coordina;
    if (!(as !== null && as !== void 0 && as.geometry)) return null;
    var pts = [];
    if (as.geometry.type === 'Polygon' && Array.isArray((_as$geometry$coordina = as.geometry.coordinates) === null || _as$geometry$coordina === void 0 ? void 0 : _as$geometry$coordina[0])) {
      as.geometry.coordinates[0].forEach(c => Array.isArray(c) && c.length >= 2 && pts.push(c));
    } else if (as.geometry.type === 'MultiPolygon') {
      as.geometry.coordinates.forEach(poly => {
        if (Array.isArray(poly === null || poly === void 0 ? void 0 : poly[0])) poly[0].forEach(c => Array.isArray(c) && c.length >= 2 && pts.push(c));
      });
    }
    if (!pts.length) return null;
    var sumLon = 0,
      sumLat = 0;
    pts.forEach(p => {
      sumLon += Number(p[0]) || 0;
      sumLat += Number(p[1]) || 0;
    });
    return {
      lon: sumLon / pts.length,
      lat: sumLat / pts.length
    };
  }
  function approxNmBetween(lat1, lon1, lat2, lon2) {
    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return Infinity;
    var meanLatRad = (lat1 + lat2) * 0.5 * Math.PI / 180;
    var dLatNm = (lat2 - lat1) * 60;
    var dLonNm = (lon2 - lon1) * 60 * Math.cos(meanLatRad);
    return Math.hypot(dLatNm, dLonNm);
  }
  function pickAirportForAirspaceFallback(as, globalAirports) {
    if (!as || !globalAirports) return null;
    var center = getAirspaceApproxCenter(as);
    var asNorm = normalizeAirspaceNameForFreq(as.name);
    var tokens = asNorm.split(' ').filter(t => t.length >= 4);
    if (!tokens.length && !center) return null;
    var best = null;
    var bestScore = Infinity;
    var _loop = function _loop() {
        var apt = globalAirports[key];
        var icao = String((apt === null || apt === void 0 ? void 0 : apt.icao) || key || '').trim().toUpperCase();
        if (!icao) return 0; // continue
        var aptNorm = normalizeAirspaceNameForFreq(`${apt.name || ''} ${apt.city || ''} ${icao}`);
        var nameHit = tokens.length ? tokens.some(t => aptNorm.includes(t) || asNorm.includes(icao)) : true;
        if (!nameHit) return 0; // continue
        var distScore = 0;
        if (center && Number.isFinite(apt.lat) && Number.isFinite(apt.lon)) {
          var nm = approxNmBetween(center.lat, center.lon, Number(apt.lat), Number(apt.lon));
          if (!Number.isFinite(nm) || nm > 40) return 0; // continue
          distScore = nm;
        }
        var score = distScore;
        if (score < bestScore) {
          bestScore = score;
          best = {
            icao,
            apt
          };
        }
      },
      _ret;
    for (var key in globalAirports) {
      _ret = _loop();
      if (_ret === 0) continue;
    }
    return best;
  }
  function fillAirportFrequencies(airspaces, airports) {
    var _iterator4 = _createForOfIteratorHelper(airspaces),
      _step4;
    try {
      for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
        var _pick$apt;
        var as = _step4.value;
        if (as.frequencies && as.frequencies.length || ![0, 4, 7, 26].includes(as.type)) continue;
        var pick = pickAirportForAirspaceFallback(as, airports);
        if (pick !== null && pick !== void 0 && (_pick$apt = pick.apt) !== null && _pick$apt !== void 0 && (_pick$apt = _pick$apt.frequencies) !== null && _pick$apt !== void 0 && _pick$apt.length) as.frequencies = pick.apt.frequencies.map(f => _objectSpread({}, f));
      }
    } catch (err) {
      _iterator4.e(err);
    } finally {
      _iterator4.f();
    }
    return airspaces;
  }
  function createAirspaceDetector() {
    var _awState = new Map(),
      _awTypeChain = new Map(),
      _AW_CHAIN_GAP = 45000;
    return {
      reset() {
        _awState.clear();
        _awTypeChain.clear();
      },
      evaluate(_ref) {
        var _ref$airspaces = _ref.airspaces,
          activeAirspaces = _ref$airspaces === void 0 ? [] : _ref$airspaces,
          _ref$points = _ref.points,
          predPoints = _ref$points === void 0 ? [] : _ref$points,
          _ref$gps = _ref.gps,
          gps = _ref$gps === void 0 ? null : _ref$gps,
          _ref$lastTerrainFt = _ref.lastTerrainFt,
          lastTerrainFt = _ref$lastTerrainFt === void 0 ? 0 : _ref$lastTerrainFt,
          _ref$now = _ref.now,
          now = _ref$now === void 0 ? Date.now() : _ref$now,
          _ref$readFreq = _ref.readFreq,
          readFreq = _ref$readFreq === void 0 ? true : _ref$readFreq;
        var events = [];
        var PERSIST = 5000;
        var STICKY = 3000;
        var getTerrainForPoint = pt => {
          var _pt$terrainFt;
          return Number((_pt$terrainFt = pt === null || pt === void 0 ? void 0 : pt.terrainFt) !== null && _pt$terrainFt !== void 0 ? _pt$terrainFt : lastTerrainFt) || 0;
        };

        // ── Pass 1: Schnittstellen für alle Lufträume berechnen ───────────────────
        var crossings = [];
        var _iterator5 = _createForOfIteratorHelper(activeAirspaces),
          _step5;
        try {
          for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
            var _as = _step5.value;
            if (!_as.geometry) continue;
            if (_as.type === 33) continue;
            var _typeKey = _awTypeKey(_as) || 'aw-ctr';
            var bandBase = getAirspaceVerticalBandFt(_as, 0);
            if (!bandBase) continue;
            var lowerFt = bandBase.baseLowerFt;
            var upperFt = bandBase.baseUpperFt;
            var lowerIsAgl = bandBase.isLowerAgl;
            var upperIsAgl = bandBase.isUpperAgl;
            var _earliest = null,
              _earliest2 = null,
              _insideNow = false;

            // insideNow: Flugzeug befindet sich JETZT in diesem Luftraum (GPS-Position, nicht Prediction)
            // Nur so wird sichergestellt, dass der zweite Luftraum erst angesagt wird wenn der erste
            // tatsächlich durchflogen wird — nicht schon 1 Minute vorher.
            var _gps = gps;
            if (_gps && _gps.alt !== undefined && _gps.lat !== undefined) {
              var bandNow = getAirspaceVerticalBandFt(_as, getTerrainForPoint(_gps));
              if (!bandNow) continue;
              var _gAlt = _gps.alt; // bereits in Feet (sync.js)
              if (_gAlt >= bandNow.lowerFt - 200 && _gAlt <= bandNow.upperFt + 200) {
                if (isPointInsideAirspace(_as, _gps.lat, _gps.lon)) _insideNow = true;
              }
            }
            var _iterator7 = _createForOfIteratorHelper(predPoints),
              _step7;
            try {
              for (_iterator7.s(); !(_step7 = _iterator7.n()).done;) {
                var pt = _step7.value;
                var bandPt = getAirspaceVerticalBandFt(_as, getTerrainForPoint(pt));
                if (!bandPt) continue;
                if (pt.alt < bandPt.lowerFt - 500 || pt.alt > bandPt.upperFt + 300) continue;
                if (!isPointInsideAirspace(_as, pt.lat, pt.lon)) continue;
                if (pt.min <= 5 && (_earliest === null || pt.min < _earliest)) _earliest = pt.min;
                if (pt.min <= 2 && (_earliest2 === null || pt.min < _earliest2)) _earliest2 = pt.min;
              }
            } catch (err) {
              _iterator7.e(err);
            } finally {
              _iterator7.f();
            }
            if (_earliest === null && _earliest2 === null && !_insideNow) continue;
            var _asKey = `${_as.type}_${_as.name || 'x'}_${Math.round(lowerFt)}`;
            crossings.push({
              as: _as,
              typeKey: _typeKey,
              lowerFt,
              upperFt,
              lowerIsAgl,
              upperIsAgl,
              earliest5: _earliest,
              earliest2: _earliest2,
              insideNow: _insideNow,
              asKey: _asKey
            });
          }

          // ── Pass 2: Nächsten noch nicht eingetretenen Luftraum bestimmen ──────────
          // Lufträume in denen man schon drin ist dürfen weiterhin passieren.
          // Von den noch nicht eingetretenen: nur den nächsten warnen (blockiert weiter entfernte).
        } catch (err) {
          _iterator5.e(err);
        } finally {
          _iterator5.f();
        }
        var unentered = crossings.filter(c => !c.insideNow).sort((a, b) => {
          var _a$earliest, _a$earliest2, _b$earliest, _b$earliest2;
          return Math.min((_a$earliest = a.earliest5) !== null && _a$earliest !== void 0 ? _a$earliest : 99, (_a$earliest2 = a.earliest2) !== null && _a$earliest2 !== void 0 ? _a$earliest2 : 99) - Math.min((_b$earliest = b.earliest5) !== null && _b$earliest !== void 0 ? _b$earliest : 99, (_b$earliest2 = b.earliest2) !== null && _b$earliest2 !== void 0 ? _b$earliest2 : 99);
        });
        var nearestKey = unentered.length > 0 ? unentered[0].asKey : null;

        // Gleiche-Klasse Ketten-Update:
        // • Alle aktuell sichtbaren typeKeys als aktiv markieren
        // • Falls das Flugzeug gerade in einer ANDEREN Klasse ist → Kette der restlichen Klassen brechen
        var insideTypeKeys = new Set(crossings.filter(c => c.insideNow && c.typeKey).map(c => c.typeKey));
        for (var _i2 = 0, _crossings = crossings; _i2 < _crossings.length; _i2++) {
          var c = _crossings[_i2];
          if (!c.typeKey) continue;
          if (!_awTypeChain.has(c.typeKey)) _awTypeChain.set(c.typeKey, {
            lastActiveMs: 0,
            warnedAt: 0
          });
          _awTypeChain.get(c.typeKey).lastActiveMs = now;
        }
        // Wenn drin in einer Klasse, breche Ketten aller anderen (bereits-gewarnte) Klassen
        if (insideTypeKeys.size > 0) {
          var _iterator6 = _createForOfIteratorHelper(_awTypeChain),
            _step6;
          try {
            for (_iterator6.s(); !(_step6 = _iterator6.n()).done;) {
              var _step6$value = _slicedToArray(_step6.value, 2),
                tk = _step6$value[0],
                ch = _step6$value[1];
              if (!insideTypeKeys.has(tk) && ch.warnedAt > 0) {
                ch.warnedAt = 0; // Kette unterbrochen durch andere Klasse
              }
            }
          } catch (err) {
            _iterator6.e(err);
          } finally {
            _iterator6.f();
          }
        }

        // ── Pass 3: Warnungen ausspielen ──────────────────────────────────────────
        for (var _i3 = 0, _crossings2 = crossings; _i3 < _crossings2.length; _i3++) {
          var _c = _crossings2[_i3];
          var as = _c.as,
            typeKey = _c.typeKey,
            earliest5 = _c.earliest5,
            earliest2 = _c.earliest2,
            insideNow = _c.insideNow,
            asKey = _c.asKey;
          var in5 = earliest5 !== null;
          var in2 = earliest2 !== null;

          // Gleiche-Klasse Ketten-Unterdrückung:
          // Wenn wir bereits für diesen typeKey gewarnt haben UND die Kette noch aktiv ist
          // (kein langer Gap ohne Luftraum dieser Klasse), die Warnung unterdrücken.
          var chainSuppressed = false;
          if (!insideNow && typeKey) {
            var _ch = _awTypeChain.get(typeKey);
            if (_ch && _ch.warnedAt > 0 && now - _ch.lastActiveMs < _AW_CHAIN_GAP) {
              chainSuppressed = true;
            }
          }

          // Nur warnen wenn: bereits drin ODER nächster uneingetretener Luftraum UND nicht Ketten-unterdrückt
          var allowed = (insideNow || asKey === nearestKey) && !chainSuppressed;
          if (!_awState.has(asKey)) _awState.set(asKey, {
            t5: false,
            t2: false,
            firstSeen5: 0,
            firstSeen2: 0,
            lastSeen5: 0,
            lastSeen2: 0
          });
          var st = _awState.get(asKey);
          if (!allowed) {
            // Timer zurücksetzen damit Warnung feuert sobald Luftraum als nächstes drankommt
            if (st.lastSeen5 && now - st.lastSeen5 > STICKY) {
              st.t5 = false;
              st.firstSeen5 = 0;
              st.lastSeen5 = 0;
            }
            if (st.lastSeen2 && now - st.lastSeen2 > STICKY) {
              st.t2 = false;
              st.firstSeen2 = 0;
              st.lastSeen2 = 0;
            }
            continue;
          }

          // 2-min Warnung
          if (in2) {
            st.lastSeen2 = now;
            if (!st.firstSeen2) st.firstSeen2 = now;
            if (!st.t2 && now - st.firstSeen2 >= PERSIST) {
              st.t2 = true;
              events.push({
                as,
                asKey,
                kind: 'airspace',
                minutes: Math.round(earliest2),
                level: 2,
                clips: ['aw-achtung'].concat(_toConsumableArray(_awTypeClips(as)), ['aw-in', _awMinKey(Math.round(earliest2)) || 'aw-2min'], _toConsumableArray(frequencyClips(as, readFreq)))
              });
              // Kette starten: gleiche Klasse dahinter nicht nochmals ansagen
              if (typeKey && _awTypeChain.has(typeKey)) _awTypeChain.get(typeKey).warnedAt = now;
            }
          } else if (st.lastSeen2 && now - st.lastSeen2 > STICKY) {
            st.t2 = false;
            st.firstSeen2 = 0;
            st.lastSeen2 = 0;
          }

          // 5-min Warnung (nur wenn kein 2-min Schnitt aktiv)
          if (in5 && !in2) {
            st.lastSeen5 = now;
            if (!st.firstSeen5) st.firstSeen5 = now;
            if (!st.t5 && now - st.firstSeen5 >= PERSIST) {
              st.t5 = true;
              events.push({
                as,
                asKey,
                kind: 'airspace',
                minutes: Math.round(earliest5),
                level: 5,
                clips: ['aw-achtung'].concat(_toConsumableArray(_awTypeClips(as)), ['aw-in', _awMinKey(Math.round(earliest5)) || 'aw-5min'], _toConsumableArray(frequencyClips(as, readFreq)))
              });
              // Kette starten: gleiche Klasse dahinter nicht nochmals ansagen
              if (typeKey && _awTypeChain.has(typeKey)) _awTypeChain.get(typeKey).warnedAt = now;
            }
          } else if (!in2 && st.lastSeen5 && now - st.lastSeen5 > STICKY) {
            st.t5 = false;
            st.firstSeen5 = 0;
            st.lastSeen5 = 0;
          }
        }
        return events;
      }
    };
  }
  function terrainThreat(terrainFt, aircraftFt) {
    if (!Number.isFinite(terrainFt)) return 'unknown';
    return aircraftFt - terrainFt < 500 ? 'red' : aircraftFt - terrainFt < 1000 ? 'amber' : 'green';
  }
  function createTerrainDetector() {
    var lastAlert = 0;
    return {
      evaluate(points, gs) {
        var now = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : Date.now();
        var immediate = points.some(p => p.min <= 0.25 && terrainThreat(p.terrainFt, p.alt) === 'red');
        if (!immediate || gs > 5 && gs < 75 || now - lastAlert <= 15000) return [];
        lastAlert = now;
        return [{
          kind: 'terrain',
          text: 'Terrain voraus',
          clips: ['taws-whoop', 'taws-alert']
        }];
      },
      reset() {
        lastAlert = 0;
      }
    };
  }
  function predictions(gps, gs, vs) {
    return [0.25, 1, 2, 3, 4, 5, 10].map(min => _objectSpread(_objectSpread({}, getDestinationPoint(gps.lat, gps.lon, gs * min / 60, gps.hdg)), {}, {
      min,
      alt: Math.max(0, gps.alt + vs * min)
    }));
  }
  function predictionBounds(points) {
    var padding = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0.08;
    return {
      west: Math.min.apply(Math, _toConsumableArray(points.map(p => p.lon))) - padding,
      east: Math.max.apply(Math, _toConsumableArray(points.map(p => p.lon))) + padding,
      south: Math.max(-90, Math.min.apply(Math, _toConsumableArray(points.map(p => p.lat))) - padding),
      north: Math.min(90, Math.max.apply(Math, _toConsumableArray(points.map(p => p.lat))) + padding)
    };
  }
  function createWaypointDetector() {
    var routeKey = '',
      index = 1;
    return {
      evaluate(gps) {
        var _target$lng, _previous$lng, _target$lng2, _next$lng;
        var route = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
        var identity = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';
        if (route.length < 2) {
          routeKey = '';
          return [];
        }
        var key = identity + ':' + route.map(p => {
          var _p$lng;
          return `${p.lat.toFixed(4)},${((_p$lng = p.lng) !== null && _p$lng !== void 0 ? _p$lng : p.lon).toFixed(4)}`;
        }).join('|');
        if (key !== routeKey) {
          routeKey = key;
          var best = Infinity;
          for (var i = 0; i < route.length - 1; i++) {
            var d = legDistanceToSegmentNm(gps.lat, gps.lon, route[i], route[i + 1]);
            if (d < best) {
              best = d;
              index = i + 1;
            }
          }
        }
        var target = route[index],
          previous = route[index - 1];
        var nav = calcNav(gps.lat, gps.lon, target.lat, (_target$lng = target.lng) !== null && _target$lng !== void 0 ? _target$lng : target.lon);
        var inbound = calcNav(previous.lat, (_previous$lng = previous.lng) !== null && _previous$lng !== void 0 ? _previous$lng : previous.lon, target.lat, (_target$lng2 = target.lng) !== null && _target$lng2 !== void 0 ? _target$lng2 : target.lon).brng;
        var angle = ((nav.brng - inbound + 540) % 360 - 180) * Math.PI / 180;
        var along = nav.dist * Math.cos(angle),
          cross = Math.abs(nav.dist * Math.sin(angle));
        if (along > 0.5 || along < -0.5 || cross > 2.5 || index >= route.length - 1) return [];
        var reached = target;
        index++;
        var next = route[index],
          course = calcNav(gps.lat, gps.lon, next.lat, (_next$lng = next.lng) !== null && _next$lng !== void 0 ? _next$lng : next.lon);
        return [{
          kind: 'waypoint',
          waypointIndex: index,
          text: `Wegpunkt ${reached.name || index} erreicht · Kurs ${course.brng}° · ${Math.round(course.dist)} NM`,
          clips: waypointClips(course.brng, course.dist)
        }];
      },
      reset() {
        routeKey = '';
      }
    };
  }
  return Object.assign({
    getDestinationPoint,
    fillAirportFrequencies,
    getAirspaceApproxCenter,
    approxNmBetween,
    pickAirportForAirspaceFallback,
    prepareAirspaces,
    relevantAirspace,
    normalizeAirspaceNameForFreq,
    inferAirspaceLimitIsAgl,
    applyAirspaceLimitHeuristics,
    createAirspaceDetector,
    createTerrainDetector,
    createWaypointDetector,
    terrainThreat,
    predictions,
    predictionBounds,
    frequencyClips,
    waypointClips,
    getAirspaceVerticalBandFt,
    isPointInsideAirspace,
    calcNav
  }, audio);
});
