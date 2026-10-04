// Generated from mission-fire-search-map.js by sync-efb-web-assets.js. Do not edit.
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
// Shared display only: draws the search area and explicitly revealed findings.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;else root.MissionFireSearchMap = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var layers = new WeakMap();
  function area(target, radiusNm) {
    if (!target || !Number.isFinite(target.lat) || !Number.isFinite(target.lon) || Math.abs(target.lat) > 90 || Math.abs(target.lon) > 180 || !Number.isFinite(radiusNm) || radiusNm <= 0 || radiusNm > 50) return null;
    return {
      center: {
        lat: target.lat,
        lon: target.lon
      },
      radiusM: radiusNm * 1852
    };
  }
  function fromScenario(fs, phase) {
    var _fs$search;
    var spec = !['closing', 'closed'].includes(phase) && fs !== null && fs !== void 0 && fs.enabled && fs.type === 'fire_watch' ? area(fs.target, Number(fs.targetAreaNm || 1.5)) : null;
    return spec ? _objectSpread(_objectSpread({}, spec), {}, {
      findings: ((_fs$search = fs.search) === null || _fs$search === void 0 ? void 0 : _fs$search.findings) || []
    }) : null;
  }
  function fromControl(c) {
    var _c$flags, _c$poiTask;
    return (c === null || c === void 0 ? void 0 : c.recipe) === 'poi' && c.phase !== 'closed' && ((_c$flags = c.flags) === null || _c$flags === void 0 ? void 0 : _c$flags.closed) !== true ? ((_c$poiTask = c.poiTask) === null || _c$poiTask === void 0 || (_c$poiTask = _c$poiTask.fireWatch) === null || _c$poiTask === void 0 ? void 0 : _c$poiTask.searchArea) || null : null;
  }
  // Stable, smooth hand-drawn variation; no jitter on polling or session restore.
  function waxPath(spec) {
    var offset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    var closed = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    var phase = (spec.center.lat * 17 + spec.center.lon * 23) % 6.283185307;
    var points = [],
      count = closed ? 144 : 156;
    for (var i = 0; i <= count; i++) {
      var angle = 0.55 + (closed ? Math.PI * 2 : Math.PI * 2 + 0.52) * i / count - (closed ? 0 : 0.13);
      var wobble = 0.012 * Math.sin(3 * angle + phase) + 0.007 * Math.sin(7 * angle - phase) + 0.003 * Math.sin(13 * angle + phase);
      var end = closed ? 0 : 0.014 * Math.pow(Math.abs(i / count - 0.5) * 2, 8);
      var distance = spec.radiusM * (1 + wobble + offset + end) / 6371008.8;
      var lat = spec.center.lat * Math.PI / 180,
        lon = spec.center.lon * Math.PI / 180;
      var nextLat = Math.asin(Math.sin(lat) * Math.cos(distance) + Math.cos(lat) * Math.sin(distance) * Math.cos(angle));
      var nextLon = lon + Math.atan2(Math.sin(angle) * Math.sin(distance) * Math.cos(lat), Math.cos(distance) - Math.sin(lat) * Math.sin(nextLat));
      points.push([nextLat * 180 / Math.PI, (nextLon * 180 / Math.PI + 540) % 360 - 180]);
    }
    return points;
  }
  function render(map, L, spec) {
    if (!map || !L) return;
    var valid = spec && area(spec.center, spec.radiusM / 1852),
      findings = ((spec === null || spec === void 0 ? void 0 : spec.findings) || []).filter(p => area(p, 1) && ['smoke', 'heat_suspicion'].includes(p.kind)).map(p => ({
        id: p.id,
        lat: p.lat,
        lon: p.lon,
        kind: p.kind
      })),
      signature = JSON.stringify({
        valid,
        findings
      }),
      previous = layers.get(map);
    if ((previous === null || previous === void 0 ? void 0 : previous.signature) === signature) return;
    if (previous) map.removeLayer(previous.layer);
    layers.delete(map);
    if (!valid) return;
    var layer = L.layerGroup(),
      point = [valid.center.lat, valid.center.lon],
      label = 'Verdachts-Suchgebiet · ' + (valid.radiusM / 1852).toFixed(1).replace('.', ',') + ' NM Radius';
    L.polygon(waxPath(valid, 0, true), {
      stroke: false,
      fillColor: '#e53935',
      fillOpacity: 0.045,
      interactive: false
    }).addTo(layer);
    var options = {
      interactive: false,
      lineCap: 'round',
      lineJoin: 'round',
      smoothFactor: 0.3
    };
    L.polyline(waxPath(valid), _objectSpread(_objectSpread({}, options), {}, {
      color: '#d83430',
      weight: 8,
      opacity: 0.17
    })).addTo(layer);
    L.polyline(waxPath(valid, 0.002), _objectSpread(_objectSpread({}, options), {}, {
      color: '#e53935',
      weight: 3.8,
      opacity: 0.85
    })).bindTooltip(label, {
      permanent: false
    }).addTo(layer);
    L.polyline(waxPath(valid, -0.002), _objectSpread(_objectSpread({}, options), {}, {
      color: '#b82023',
      weight: 1.2,
      opacity: 0.42,
      dashArray: '7,3,2,6'
    })).addTo(layer);
    L.polyline(waxPath(valid, 0.002), _objectSpread(_objectSpread({}, options), {}, {
      color: '#ffd4bc',
      weight: 0.9,
      opacity: 0.55,
      dashArray: '1,9,2,13'
    })).addTo(layer);
    L.circleMarker(point, {
      radius: 4,
      color: '#e53935',
      weight: 2,
      fillColor: '#fff',
      fillOpacity: 1,
      interactive: false
    }).bindTooltip('Bezugspunkt des Suchgebiets', {
      permanent: false
    }).addTo(layer);
    var _iterator = _createForOfIteratorHelper(findings),
      _step;
    try {
      var _loop = function _loop() {
        var finding = _step.value;
        var latScale = 111195,
          lonScale = 111195 * Math.cos(finding.lat * Math.PI / 180),
          size = Math.max(35, Math.min(90, valid.radiusM * 0.025));
        var _loop2 = function _loop2() {
          var direction = _arr[_i];
          var path = Array.from({
            length: 13
          }, (_, i) => {
            var t = (i / 12 - 0.5) * 2;
            return [finding.lat + (t * size + Math.sin(i * 0.7) * size * 0.025) / latScale, finding.lon + (direction * t * size + Math.sin(i * 0.9) * size * 0.02) / lonScale];
          });
          L.polyline(path, _objectSpread(_objectSpread({}, options), {}, {
            color: '#d83430',
            weight: 8,
            opacity: 0.17
          })).addTo(layer);
          L.polyline(path, _objectSpread(_objectSpread({}, options), {}, {
            color: '#e53935',
            weight: 3.8,
            opacity: 0.9
          })).bindTooltip(finding.kind === 'smoke' ? 'Rauchquelle erkannt' : 'Wärmeverdacht · Brand nicht bestätigt', {
            permanent: false
          }).addTo(layer);
          L.polyline(path, _objectSpread(_objectSpread({}, options), {}, {
            color: '#ffd4bc',
            weight: 0.9,
            opacity: 0.55,
            dashArray: '1,9,2,13'
          })).addTo(layer);
        };
        for (var _i = 0, _arr = [-1, 1]; _i < _arr.length; _i++) {
          _loop2();
        }
      };
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        _loop();
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }
    layer.addTo(map);
    layers.set(map, {
      signature,
      layer
    });
  }
  return {
    area,
    fromScenario,
    fromControl,
    waxPath,
    render
  };
});
