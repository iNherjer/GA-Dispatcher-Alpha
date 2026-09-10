// Generated from map-prediction.js by sync-efb-web-assets.js. Do not edit.
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
/* Standalone prediction points and Leaflet presentation shared by App/EFB.
 * Terrain data is supplied by the host; this renderer never emits warnings. */
(function (root, factory) {
  var api = factory(typeof module === 'object' && module.exports ? require('./navigation-warning-core') : root.GANavigationWarnings);
  if (typeof module === 'object' && module.exports) module.exports = api;else root.GAMapPrediction = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (navigation) {
  function points(gps, gs, vs) {
    return [1, 2, 5, 10].map(min => {
      var distNM = gs * (min / 60);
      var pt = navigation.getDestinationPoint(gps.lat, gps.lon, distNM, gps.hdg);
      var alt = Math.max(0, gps.alt + vs * min);
      return {
        lat: pt.lat,
        lon: pt.lon,
        min,
        distNMAhead: distNM,
        altFt: alt,
        alt,
        threat: 'green'
      };
    });
  }
  function applyTerrain(predictions, results, airspaceColor) {
    predictions.forEach((point, i) => {
      var result = results[i];
      if (!result) return;
      point.threat = result.threat;
      point.terrainFt = result.terrainFt;
      point.asColor = result.threat === 'green' && airspaceColor ? airspaceColor(point) || null : null;
    });
  }
  function createLayer(L, map) {
    var pathOptions = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    var line = null,
      markers = [];
    function colorize(predictions, airspaceColor) {
      var worst = 'green';
      var _iterator = _createForOfIteratorHelper(predictions),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var point = _step.value;
          if (point.threat === 'red') {
            worst = 'red';
            break;
          }
          if (point.threat === 'amber') worst = 'amber';
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
      if (line) line.setStyle({
        color: worst === 'red' ? '#ff2222' : worst === 'amber' ? '#ffaa00' : '#ffffff'
      });
      markers.forEach((marker, i) => {
        var point = predictions[i];
        // The original map still colors airspace when terrain is unknown;
        // the profile's asColor stays limited to confirmed green terrain.
        var color = (point === null || point === void 0 ? void 0 : point.threat) === 'red' ? '#ff2222' : (point === null || point === void 0 ? void 0 : point.threat) === 'amber' ? '#ffaa00' : (point === null || point === void 0 ? void 0 : point.asColor) || point && airspaceColor && airspaceColor(point) || '#ffffff';
        marker.setStyle({
          color,
          fillColor: color
        });
      });
    }
    function render(gps, predictions) {
      var coords = [[gps.lat, gps.lon]].concat(_toConsumableArray(predictions.map(p => [p.lat, p.lon])));
      if (!line) line = L.polyline(coords, _objectSpread(_objectSpread({}, pathOptions), {}, {
        color: '#ffffff',
        weight: 2,
        opacity: 0.7,
        dashArray: '8, 6',
        interactive: false
      })).addTo(map);else line.setLatLngs(coords);
      while (markers.length < predictions.length) {
        var marker = L.circleMarker([0, 0], _objectSpread(_objectSpread({}, pathOptions), {}, {
          radius: 4,
          color: '#ffffff',
          fillColor: '#ffffff',
          fillOpacity: 0.9,
          weight: 1.5,
          interactive: false
        })).addTo(map);
        marker.bindTooltip('', {
          permanent: true,
          direction: 'top',
          offset: [0, -8],
          className: 'prediction-tooltip'
        });
        markers.push(marker);
      }
      predictions.forEach((p, i) => {
        markers[i].setLatLng([p.lat, p.lon]);
        markers[i].setTooltipContent(`${p.min}m`);
      });
      // Keep the last terrain colors until the next lookup completes,
      // as in Standalone, instead of flashing white on each position update.
    }
    function clear() {
      if (line) line.remove();
      line = null;
      markers.forEach(marker => marker.remove());
      markers = [];
    }
    return {
      render,
      colorize,
      clear
    };
  }
  return {
    points,
    applyTerrain,
    createLayer
  };
});
