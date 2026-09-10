// Generated from map-navpoint-core.js by sync-efb-web-assets.js. Do not edit.
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
/* Original standalone navpoint labels, airport enrichment and geographic filters.
 * Shared by the App and the Tracker's local EFB/Toolbar data source. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();else root.GAMapNavpointCore = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function normalizeOpenAipAirportForPopup(airport) {
    var _airport$geometry, _airport$lon;
    var coords = airport === null || airport === void 0 || (_airport$geometry = airport.geometry) === null || _airport$geometry === void 0 ? void 0 : _airport$geometry.coordinates;
    var hasGeometryCoordinates = Array.isArray(coords) && coords.length >= 2;
    var lat = Number(hasGeometryCoordinates ? coords[1] : airport === null || airport === void 0 ? void 0 : airport.lat);
    var lon = Number(hasGeometryCoordinates ? coords[0] : (_airport$lon = airport === null || airport === void 0 ? void 0 : airport.lon) !== null && _airport$lon !== void 0 ? _airport$lon : airport === null || airport === void 0 ? void 0 : airport.lng);
    var icao = String((airport === null || airport === void 0 ? void 0 : airport.icaoCode) || (airport === null || airport === void 0 ? void 0 : airport.icao) || (airport === null || airport === void 0 ? void 0 : airport.designator) || (airport === null || airport === void 0 ? void 0 : airport.name) || '').trim().toUpperCase();
    if (!icao || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    var elevationIsObject = (airport === null || airport === void 0 ? void 0 : airport.elevation) && typeof airport.elevation === 'object';
    var elevationValue = Number(elevationIsObject ? airport.elevation.value : airport === null || airport === void 0 ? void 0 : airport.elevation);
    var elevation = Number.isFinite(elevationValue) ? elevationIsObject && Number(airport.elevation.unit) !== 1 ? Math.round(elevationValue * 3.28084) : elevationValue : null;
    return {
      icao,
      name: String((airport === null || airport === void 0 ? void 0 : airport.name) || icao).trim(),
      lat,
      lon,
      elevation,
      country: String((airport === null || airport === void 0 ? void 0 : airport.country) || (airport === null || airport === void 0 ? void 0 : airport.countryCode) || (airport === null || airport === void 0 ? void 0 : airport.isoCountry) || '').trim(),
      sourceId: String((airport === null || airport === void 0 ? void 0 : airport._id) || (airport === null || airport === void 0 ? void 0 : airport.id) || '').trim()
    };
  }
  function buildOpenAipNavaidCacheEntry(item) {
    var _enrichedItem$geometr, _enrichedItem$lat, _enrichedItem$lon, _enrichedItem$type;
    var source = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'live';
    var byId = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    var sourceId = String((item === null || item === void 0 ? void 0 : item._id) || (item === null || item === void 0 ? void 0 : item.id) || '').trim();
    var staticItem = sourceId && byId instanceof Map ? byId.get(sourceId) : null;
    var enrichedItem = staticItem ? _objectSpread(_objectSpread({}, staticItem), item) : item;
    var coords = enrichedItem === null || enrichedItem === void 0 || (_enrichedItem$geometr = enrichedItem.geometry) === null || _enrichedItem$geometr === void 0 ? void 0 : _enrichedItem$geometr.coordinates;
    var lat = Number((_enrichedItem$lat = enrichedItem === null || enrichedItem === void 0 ? void 0 : enrichedItem.lat) !== null && _enrichedItem$lat !== void 0 ? _enrichedItem$lat : coords === null || coords === void 0 ? void 0 : coords[1]);
    var lon = Number((_enrichedItem$lon = enrichedItem === null || enrichedItem === void 0 ? void 0 : enrichedItem.lon) !== null && _enrichedItem$lon !== void 0 ? _enrichedItem$lon : coords === null || coords === void 0 ? void 0 : coords[0]);
    if (![lat, lon].every(Number.isFinite)) return null;
    var freqVal = '';
    if ((enrichedItem === null || enrichedItem === void 0 ? void 0 : enrichedItem.frequency) !== undefined && (enrichedItem === null || enrichedItem === void 0 ? void 0 : enrichedItem.frequency) !== null) {
      freqVal = typeof enrichedItem.frequency === 'object' && enrichedItem.frequency.value ? enrichedItem.frequency.value : enrichedItem.frequency;
    } else if (Array.isArray(enrichedItem === null || enrichedItem === void 0 ? void 0 : enrichedItem.frequencies) && enrichedItem.frequencies.length > 0) {
      var _enrichedItem$frequen;
      freqVal = ((_enrichedItem$frequen = enrichedItem.frequencies[0]) === null || _enrichedItem$frequen === void 0 ? void 0 : _enrichedItem$frequen.value) || enrichedItem.frequencies[0];
    }
    var identifier = String((enrichedItem === null || enrichedItem === void 0 ? void 0 : enrichedItem.identifier) || (enrichedItem === null || enrichedItem === void 0 ? void 0 : enrichedItem.designator) || '').trim().toUpperCase();
    var name = String((enrichedItem === null || enrichedItem === void 0 ? void 0 : enrichedItem.name) || identifier || 'Navaid').trim();
    var identText = identifier ? ` [${identifier}]` : '';
    var freqText = freqVal ? ` (${freqVal})` : '';
    return {
      name: `${name}${identText}${freqText}`,
      lat,
      lng: lon,
      type: 'NAVAID',
      sourceId,
      navaidIdentifier: identifier,
      navaidType: (_enrichedItem$type = enrichedItem === null || enrichedItem === void 0 ? void 0 : enrichedItem.type) !== null && _enrichedItem$type !== void 0 ? _enrichedItem$type : null,
      navaidSource: source,
      navaidData: _objectSpread(_objectSpread({}, enrichedItem), {}, {
        id: sourceId || (enrichedItem === null || enrichedItem === void 0 ? void 0 : enrichedItem.id) || '',
        lat,
        lon,
        identifier,
        name
      })
    };
  }
  function buildOpenAipReportingPointCacheEntry(item) {
    var _item$geometry, _item$lat, _item$lon;
    var source = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'live';
    var coords = item === null || item === void 0 || (_item$geometry = item.geometry) === null || _item$geometry === void 0 ? void 0 : _item$geometry.coordinates;
    var lat = Number((_item$lat = item === null || item === void 0 ? void 0 : item.lat) !== null && _item$lat !== void 0 ? _item$lat : coords === null || coords === void 0 ? void 0 : coords[1]);
    var lon = Number((_item$lon = item === null || item === void 0 ? void 0 : item.lon) !== null && _item$lon !== void 0 ? _item$lon : coords === null || coords === void 0 ? void 0 : coords[0]);
    var name = String((item === null || item === void 0 ? void 0 : item.name) || '').trim();
    if (!name || ![lat, lon].every(Number.isFinite)) return null;
    return {
      name: `RPP ${name}`,
      lat,
      lng: lon,
      type: 'RPP',
      rppAirportIcao: String((item === null || item === void 0 ? void 0 : item.airportIcao) || extractRppAirportIcao(item) || '').trim().toUpperCase(),
      sourceId: String((item === null || item === void 0 ? void 0 : item._id) || (item === null || item === void 0 ? void 0 : item.id) || '').trim(),
      rppSource: source,
      rppData: _objectSpread(_objectSpread({}, item), {}, {
        id: String((item === null || item === void 0 ? void 0 : item._id) || (item === null || item === void 0 ? void 0 : item.id) || '').trim(),
        name,
        lat,
        lon
      })
    };
  }
  function extractRppAirportIcao(rppItem) {
    if (!rppItem || typeof rppItem !== 'object') return '';
    var readIcao = obj => String((obj === null || obj === void 0 ? void 0 : obj.icao) || (obj === null || obj === void 0 ? void 0 : obj.icaoCode) || (obj === null || obj === void 0 ? void 0 : obj.ident) || (obj === null || obj === void 0 ? void 0 : obj.designator) || (obj === null || obj === void 0 ? void 0 : obj.code) || '').trim().toUpperCase();
    var directCandidates = [rppItem.airport, rppItem.aerodrome, rppItem.relatedAirport, rppItem.location, rppItem.parent];
    for (var _i = 0, _directCandidates = directCandidates; _i < _directCandidates.length; _i++) {
      var c = _directCandidates[_i];
      var icao = readIcao(c);
      if (/^[A-Z]{4}$/.test(icao)) return icao;
    }
    if (Array.isArray(rppItem.airports)) {
      var _iterator = _createForOfIteratorHelper(rppItem.airports),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var a = _step.value;
          var _icao = readIcao(a);
          if (/^[A-Z]{4}$/.test(_icao)) return _icao;
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
    }

    // Fallback: gelegentlich steckt die ICAO nur im Namen/Kommentar.
    var textBlob = [rppItem.name, rppItem.title, rppItem.description, rppItem.note, rppItem.remarks].filter(Boolean).join(' ');
    var m = textBlob.match(/\b[A-Z]{4}\b/);
    return m ? m[0] : '';
  }
  function buildGlobalAirportSnapEntries(bounds, globalAirports) {
    if (!bounds || typeof globalAirports !== 'object' || !globalAirports) return [];
    var west = Number(bounds.west);
    var south = Number(bounds.south);
    var east = Number(bounds.east);
    var north = Number(bounds.north);
    if (![west, south, east, north].every(Number.isFinite) || east <= west || north <= south) return [];
    var padLon = Math.min(0.25, Math.max(0.05, (east - west) * 0.15));
    var padLat = Math.min(0.25, Math.max(0.05, (north - south) * 0.15));
    var entries = [];
    for (var key in globalAirports) {
      var _airport$lon2, _airport$elevation;
      var airport = globalAirports[key];
      var lat = Number(airport === null || airport === void 0 ? void 0 : airport.lat);
      var lon = Number((_airport$lon2 = airport === null || airport === void 0 ? void 0 : airport.lon) !== null && _airport$lon2 !== void 0 ? _airport$lon2 : airport === null || airport === void 0 ? void 0 : airport.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (lat < south - padLat || lat > north + padLat || lon < west - padLon || lon > east + padLon) continue;
      var icao = String((airport === null || airport === void 0 ? void 0 : airport.icao) || key || '').trim().toUpperCase();
      var airportName = String((airport === null || airport === void 0 ? void 0 : airport.name) || (airport === null || airport === void 0 ? void 0 : airport.n) || (airport === null || airport === void 0 ? void 0 : airport.city) || icao || 'Flugplatz').trim();
      entries.push({
        name: `APT ${icao || airportName}`,
        lat,
        lng: lon,
        type: 'APT',
        airportIcao: icao || airportName,
        airportName,
        country: String((airport === null || airport === void 0 ? void 0 : airport.country) || '').trim(),
        elevation: (_airport$elevation = airport === null || airport === void 0 ? void 0 : airport.elevation) !== null && _airport$elevation !== void 0 ? _airport$elevation : null,
        airportSnapSource: 'global-fallback'
      });
    }
    return entries;
  }
  function airportEntry(item) {
    var _item$frequencies$;
    var apt = normalizeOpenAipAirportForPopup(item);
    if (!apt) return null;
    var frequency = Array.isArray(item.frequencies) ? (_item$frequencies$ = item.frequencies[0]) === null || _item$frequencies$ === void 0 ? void 0 : _item$frequencies$.value : '';
    return {
      name: `APT ${apt.icao || apt.name}${frequency ? ` (${frequency})` : ''}`,
      lat: apt.lat,
      lng: apt.lon,
      type: 'APT',
      airportIcao: apt.icao || apt.name,
      airportName: apt.name,
      sourceId: apt.sourceId,
      country: apt.country
    };
  }
  return {
    navaid: buildOpenAipNavaidCacheEntry,
    reportingPoint: buildOpenAipReportingPointCacheEntry,
    airport: airportEntry,
    globalAirports: buildGlobalAirportSnapEntries,
    normalizeAirport: normalizeOpenAipAirportForPopup,
    extractRppAirportIcao
  };
});
