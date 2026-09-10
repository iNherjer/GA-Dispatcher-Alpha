// Generated from map-single-click.js by sync-efb-web-assets.js. Do not edit.
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
/* Shared Standalone airport/navpoint selection and tooltip/panel modes. */
function setMapSingleClickMode(mode) {
  var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
    _ref$persist = _ref.persist,
    persist = _ref$persist === void 0 ? true : _ref$persist;
  var normalized = MAP_SINGLE_CLICK_MODES.includes(mode) ? mode : 'off';
  mapSingleClickMode = normalized;
  window.mapSingleClickMode = normalized;
  pendingMapInfoTapSeq += 1;
  clearMapSingleClickTooltip();
  if (normalized !== 'panels') {
    var _airportInfoPopupLaye, _navaidInfoPopupLayer, _reportingPointInfoPo;
    if (((_airportInfoPopupLaye = airportInfoPopupLayer) === null || _airportInfoPopupLaye === void 0 ? void 0 : _airportInfoPopupLaye._map) === map) map.closePopup(airportInfoPopupLayer);
    if (((_navaidInfoPopupLayer = navaidInfoPopupLayer) === null || _navaidInfoPopupLayer === void 0 ? void 0 : _navaidInfoPopupLayer._map) === map) map.closePopup(navaidInfoPopupLayer);
    if (((_reportingPointInfoPo = reportingPointInfoPopupLayer) === null || _reportingPointInfoPo === void 0 ? void 0 : _reportingPointInfoPo._map) === map) map.closePopup(reportingPointInfoPopupLayer);
  }
  if (persist) localStorage.setItem(MAP_SINGLE_CLICK_MODE_KEY, normalized);
  refreshMapHintMenuUi();
  return normalized;
}
window.getMapSingleClickMode = getMapSingleClickMode;
window.setMapSingleClickMode = setMapSingleClickMode;
window.cycleMapSingleClickMode = function () {
  var currentIndex = MAP_SINGLE_CLICK_MODES.indexOf(getMapSingleClickMode());
  return setMapSingleClickMode(MAP_SINGLE_CLICK_MODES[(currentIndex + 1) % MAP_SINGLE_CLICK_MODES.length]);
};
function getOpenAipAirportTooltip(airport) {
  var _runwayCache;
  var normalized = normalizeOpenAipAirportForPopup(airport);
  var icao = (normalized === null || normalized === void 0 ? void 0 : normalized.icao) || String((airport === null || airport === void 0 ? void 0 : airport.icaoCode) || (airport === null || airport === void 0 ? void 0 : airport.icao) || '').trim().toUpperCase();
  var name = (normalized === null || normalized === void 0 ? void 0 : normalized.name) || String((airport === null || airport === void 0 ? void 0 : airport.name) || icao || 'Flugplatz').trim();
  var runwayText = (typeof formatOpenAipAirportRunways === 'function' ? formatOpenAipAirportRunways(airport) : '') || (icao && typeof runwayCache !== 'undefined' ? String(((_runwayCache = runwayCache) === null || _runwayCache === void 0 ? void 0 : _runwayCache[icao]) || '') : '');
  var runwayLabels = runwayText.split(/\s*(?:\||\n|<br\s*\/?>)\s*/i).map(line => String(line || '').split(/\s+[–—-]\s+/)[0].trim()).filter(label => /^(?:0[1-9]|[12]\d|3[0-6])[LRC]?\s*\/\s*(?:0[1-9]|[12]\d|3[0-6])[LRC]?$/i.test(label)).slice(0, 3);
  var frequencies = typeof getMapContextAirportFrequencies === 'function' ? getMapContextAirportFrequencies(airport, icao) : [];
  return `
        <span class="ga-airport-hover-tooltip">
            <b>${escapePopupText(icao || 'APT')}</b> · ${escapePopupText(name)}
            ${runwayLabels.length ? `<br><span>PISTE&nbsp; ${escapePopupText(runwayLabels.join(' · '))}</span>` : ''}
            ${frequencies.length ? `<br><span>FREQ&nbsp;&nbsp; ${escapePopupText(frequencies[0])}</span>` : ''}
        </span>`;
}
function findNearestAirport(latlng, maxPixels) {
  var _openAipRegionState;
  if (typeof maxPixels === 'undefined') maxPixels = 60;
  if (!map) return null;
  var tapPx = map.latLngToLayerPoint(latlng);
  var best = null,
    bestDist = maxPixels + 1;

  // 1. cachedNavData (OpenAIP airports)
  cachedNavData.forEach(nav => {
    if (nav.type !== 'APT' && !nav.name.startsWith('APT ')) return;
    var navPx = map.latLngToLayerPoint([nav.lat, nav.lng]);
    var d = tapPx.distanceTo(navPx);
    if (d < bestDist) {
      bestDist = d;
      var parts = nav.name.replace('APT ', '').split(' (');
      var icao = String(nav.airportIcao || parts[0] || '').trim().toUpperCase();
      best = {
        icao,
        name: nav.airportName || parts[0].trim(),
        lat: nav.lat,
        lon: nav.lng,
        sourceId: nav.sourceId || '',
        country: nav.country || ''
      };
    }
  });
  if (best) return best;

  // 2. Der Regions-Snapshot ist oft deutlich früher verfügbar als die große
  // globale Airport-Datei. Direkt daraus suchen, damit schon der erste Tap sitzt.
  var regionAirports = Array.isArray((_openAipRegionState = openAipRegionState) === null || _openAipRegionState === void 0 || (_openAipRegionState = _openAipRegionState.payload) === null || _openAipRegionState === void 0 ? void 0 : _openAipRegionState.airports) ? openAipRegionState.payload.airports : [];
  var _iterator = _createForOfIteratorHelper(regionAirports),
    _step;
  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var airport = _step.value;
      var _apt = normalizeOpenAipAirportForPopup(airport);
      if (!_apt) continue;
      var _aptPx = map.latLngToLayerPoint([_apt.lat, _apt.lon]);
      var _d = tapPx.distanceTo(_aptPx);
      if (_d < bestDist) {
        bestDist = _d;
        best = _apt;
      }
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }
  if (best) return best;

  // 3. Lokale Airport-Datenbank. Sie ist auch ohne sichtbares
  // OpenAIP-Overlay geladen und muss deshalb vor einem nahen DME gewinnen
  // können.
  var airportDatabase = getAirportDatabaseForMapClicks();
  if (airportDatabase) {
    var latF = latlng.lat,
      lngF = latlng.lng;
    for (var icao in airportDatabase) {
      var _apt$lon;
      var apt = airportDatabase[icao];
      var aptLat = Number(apt === null || apt === void 0 ? void 0 : apt.lat);
      var aptLon = Number((_apt$lon = apt === null || apt === void 0 ? void 0 : apt.lon) !== null && _apt$lon !== void 0 ? _apt$lon : apt === null || apt === void 0 ? void 0 : apt.lng);
      if (!Number.isFinite(aptLat) || !Number.isFinite(aptLon)) continue;
      if (Math.abs(aptLat - latF) > 0.5 || Math.abs(aptLon - lngF) > 0.5) continue;
      var aptPx = map.latLngToLayerPoint([aptLat, aptLon]);
      var d = tapPx.distanceTo(aptPx);
      if (d < bestDist) {
        var _apt$elevation;
        bestDist = d;
        var aptIcao = String((apt === null || apt === void 0 ? void 0 : apt.icao) || icao || '').trim().toUpperCase();
        best = {
          icao: aptIcao,
          name: apt.name || apt.n || apt.city || aptIcao,
          lat: aptLat,
          lon: aptLon,
          elevation: (_apt$elevation = apt.elevation) !== null && _apt$elevation !== void 0 ? _apt$elevation : null
        };
      }
    }
  }
  return best;
}
function findNearestMapNavigationPoint(latlng, maxPixels) {
  if (!map) return null;
  var tapPx = map.latLngToLayerPoint(latlng);
  var best = null;
  var bestDist = Number(maxPixels) + 1;
  var consider = nav => {
    if ((nav === null || nav === void 0 ? void 0 : nav.type) !== 'NAVAID' && (nav === null || nav === void 0 ? void 0 : nav.type) !== 'RPP') return;
    var lat = Number(nav === null || nav === void 0 ? void 0 : nav.lat);
    var lon = Number(nav === null || nav === void 0 ? void 0 : nav.lng);
    if (![lat, lon].every(Number.isFinite)) return;
    var pointPx = map.latLngToLayerPoint([lat, lon]);
    var distance = tapPx.distanceTo(pointPx);
    if (distance < bestDist) {
      bestDist = distance;
      best = nav;
    }
  };
  (Array.isArray(cachedNavData) ? cachedNavData : []).forEach(consider);

  // Die lokalen OpenAIP-Fallbacks stehen unabhängig von Snapping und
  // Kartenoverlay zur Verfügung. Dadurch funktionieren Tooltip/Tafel auch
  // dann, wenn cachedNavData für die aktuelle Ansicht noch leer ist.
  var viewBounds = getOpenAipNavaidCacheBounds();
  getStaticOpenAipNavaidEntries(viewBounds).forEach(consider);
  getStaticOpenAipReportingPointEntries(viewBounds).forEach(consider);
  return best;
}
function findNearestMapInfoObject(latlng) {
  var radius = getAirportTapRadiusPx(34);
  var airport = findNearestAirport(latlng, radius);
  var navigationPoint = findNearestMapNavigationPoint(latlng, radius);
  if (!airport && !navigationPoint) return null;

  // Während die lokale Airport-Datei noch lädt, darf ein bereits verfügbares
  // DME den Tap nicht vorzeitig verbrauchen. Der asynchrone Retry löst den
  // Treffer unmittelbar nach dem Laden noch einmal auf.
  if (!airport && !getAirportDatabaseForMapClicks() && storedAirportOverlayState.loadPromise) {
    return null;
  }
  if (airport && navigationPoint && map) {
    var tapPx = map.latLngToLayerPoint(latlng);
    var airportPx = map.latLngToLayerPoint([airport.lat, airport.lon]);
    var navaidPx = map.latLngToLayerPoint([navigationPoint.lat, navigationPoint.lng]);
    var airportDistance = tapPx.distanceTo(airportPx);
    var navigationDistance = tapPx.distanceTo(navaidPx);
    // Bei praktisch identischer Position gehört der sichtbare Platz zum
    // Airport; ansonsten entscheidet der näher angetippte Kartenpunkt.
    if (airportDistance <= navigationDistance + 2) {
      return {
        kind: 'airport',
        data: airport
      };
    }
  } else if (airport) {
    return {
      kind: 'airport',
      data: airport
    };
  }
  if (!navigationPoint) return {
    kind: 'airport',
    data: airport
  };
  return {
    kind: navigationPoint.type === 'RPP' ? 'vrp' : 'navaid',
    data: navigationPoint
  };
}
function getMapNavigationPointTooltip(point) {
  if (!point) return '';
  if (point.type === 'RPP') {
    var raw = point !== null && point !== void 0 && point.rppData && typeof point.rppData === 'object' ? point.rppData : point;
    var name = String((raw === null || raw === void 0 ? void 0 : raw.name) || (point === null || point === void 0 ? void 0 : point.name) || 'VFR-Meldepunkt').replace(/^RPP\s+/i, '').trim();
    var airportIcao = String((raw === null || raw === void 0 ? void 0 : raw.airportIcao) || (point === null || point === void 0 ? void 0 : point.rppAirportIcao) || '').trim().toUpperCase();
    return `
            <span class="ga-airport-hover-tooltip ga-map-point-hover-tooltip">
                <b>VRP</b> · ${escapePopupText(name)}
                ${airportIcao ? `<br><span>FLUGPLATZ&nbsp; ${escapePopupText(airportIcao)}</span>` : ''}
            </span>`;
  }
  var nav = normalizeOpenAipNavaidForPopup(point);
  if (!nav) return '';
  var title = nav.identifier || 'NAVAID';
  var frequency = nav.frequencyValue ? `${nav.frequencyValue}${nav.frequencyUnit ? ` ${nav.frequencyUnit}` : ''}` : '';
  return `
        <span class="ga-airport-hover-tooltip ga-map-point-hover-tooltip">
            <b>${escapePopupText(title)}</b> · ${escapePopupText(nav.name)}
            <br><span>${escapePopupText(getOpenAipNavaidTypeLabel(nav.type))}${frequency ? `&nbsp; ${escapePopupText(frequency)}` : ''}</span>
        </span>`;
}
var mapSingleClickTooltipLayer = null;
var mapSingleClickTooltipTimer = null;
function clearMapSingleClickTooltip() {
  if (mapSingleClickTooltipTimer) {
    clearTimeout(mapSingleClickTooltipTimer);
    mapSingleClickTooltipTimer = null;
  }
  if (map && mapSingleClickTooltipLayer && map.hasLayer(mapSingleClickTooltipLayer)) {
    map.removeLayer(mapSingleClickTooltipLayer);
  }
  mapSingleClickTooltipLayer = null;
}
function openMapPointSingleClickTooltip(match) {
  var _match$data, _match$data2, _match$data3, _ref2, _ref3, _normalizedAirport$la, _match$data4, _match$data5, _ref4, _ref5, _ref6, _normalizedAirport$lo, _match$data6, _match$data7, _match$data8;
  if (!map || getMapSingleClickMode() !== 'tooltip' || !match) return false;
  var isAirport = match.kind === 'airport';
  var normalizedAirport = isAirport ? normalizeOpenAipAirportForPopup(match.data) : null;
  if (isAirport && !normalizedAirport) return false;
  var rawCoordinates = ((_match$data = match.data) === null || _match$data === void 0 || (_match$data = _match$data.geometry) === null || _match$data === void 0 ? void 0 : _match$data.coordinates) || ((_match$data2 = match.data) === null || _match$data2 === void 0 || (_match$data2 = _match$data2.navaidData) === null || _match$data2 === void 0 || (_match$data2 = _match$data2.geometry) === null || _match$data2 === void 0 ? void 0 : _match$data2.coordinates) || ((_match$data3 = match.data) === null || _match$data3 === void 0 || (_match$data3 = _match$data3.rppData) === null || _match$data3 === void 0 || (_match$data3 = _match$data3.geometry) === null || _match$data3 === void 0 ? void 0 : _match$data3.coordinates);
  var anchorLat = Number((_ref2 = (_ref3 = (_normalizedAirport$la = normalizedAirport === null || normalizedAirport === void 0 ? void 0 : normalizedAirport.lat) !== null && _normalizedAirport$la !== void 0 ? _normalizedAirport$la : (_match$data4 = match.data) === null || _match$data4 === void 0 ? void 0 : _match$data4.lat) !== null && _ref3 !== void 0 ? _ref3 : (_match$data5 = match.data) === null || _match$data5 === void 0 || (_match$data5 = _match$data5.rppData) === null || _match$data5 === void 0 ? void 0 : _match$data5.lat) !== null && _ref2 !== void 0 ? _ref2 : rawCoordinates === null || rawCoordinates === void 0 ? void 0 : rawCoordinates[1]);
  var anchorLon = Number((_ref4 = (_ref5 = (_ref6 = (_normalizedAirport$lo = normalizedAirport === null || normalizedAirport === void 0 ? void 0 : normalizedAirport.lon) !== null && _normalizedAirport$lo !== void 0 ? _normalizedAirport$lo : (_match$data6 = match.data) === null || _match$data6 === void 0 ? void 0 : _match$data6.lng) !== null && _ref6 !== void 0 ? _ref6 : (_match$data7 = match.data) === null || _match$data7 === void 0 ? void 0 : _match$data7.lon) !== null && _ref5 !== void 0 ? _ref5 : (_match$data8 = match.data) === null || _match$data8 === void 0 || (_match$data8 = _match$data8.rppData) === null || _match$data8 === void 0 ? void 0 : _match$data8.lon) !== null && _ref4 !== void 0 ? _ref4 : rawCoordinates === null || rawCoordinates === void 0 ? void 0 : rawCoordinates[0]);
  if (![anchorLat, anchorLon].every(Number.isFinite)) return false;
  var anchor = L.latLng(anchorLat, anchorLon);
  var content = isAirport ? getOpenAipAirportTooltip(match.data) : getMapNavigationPointTooltip(match.data);
  if (!content) return false;
  clearMapSingleClickTooltip();
  mapSingleClickTooltipLayer = L.tooltip({
    direction: 'top',
    offset: [0, -8],
    opacity: 1,
    className: 'airspace-tooltip ga-airport-tooltip-shell ga-map-point-click-tooltip'
  }).setLatLng(anchor).setContent(content).addTo(map);
  mapSingleClickTooltipTimer = setTimeout(clearMapSingleClickTooltip, 5200);
  return true;
}
function openNearestMapTooltipAt(latlng) {
  if (!map || getMapSingleClickMode() !== 'tooltip') return false;
  return openMapPointSingleClickTooltip(findNearestMapInfoObject(latlng));
}
function openNearestMapInfoAt(latlng) {
  if (getMapSingleClickMode() !== 'panels') return false;
  var match = findNearestMapInfoObject(latlng);
  if (!match) return false;
  if (match.kind === 'airport') {
    openAirportInfoPopup(match.data);
    return true;
  }
  if (match.kind === 'navaid') {
    openNavaidInfoPopup(match.data);
  } else {
    openReportingPointInfoPopup(match.data);
  }
  return true;
}
function resolveMapSingleClickAt(latlng) {
  var mode = getMapSingleClickMode();
  if (mode === 'tooltip') return openNearestMapTooltipAt(latlng);
  if (mode === 'panels') return openNearestMapInfoAt(latlng);
  return false;
}
var pendingMapInfoTapSeq = 0;
function scheduleMapInfoTapResolution(latlng) {
  if (getMapSingleClickMode() === 'off') return;
  var seq = ++pendingMapInfoTapSeq;
  var tap = L.latLng(latlng.lat, latlng.lng);
  var tasks = window.gaMapSingleClickHost ? [window.gaMapSingleClickHost.load(tap)] : [Promise.resolve(ensureOpenAipRegionSnapshot()), Promise.resolve(ensureGlobalAirportsForMapClicks()), Promise.resolve(loadStoredAirportOverlayDatabase()), Promise.resolve(loadOpenAipStaticNavaids()), Promise.resolve(loadOpenAipStaticReportingPoints())];
  var resolved = false;
  var retry = () => {
    if (resolved || seq !== pendingMapInfoTapSeq || !map) return;
    if (resolveMapSingleClickAt(tap)) {
      resolved = true;
      pendingMapInfoTapSeq += 1;
    }
  };
  tasks.forEach(task => task.then(retry, () => {}));
  if (!getAirportDatabaseForMapClicks() || !Array.isArray(window.gaMapSingleClickHost ? cachedNavData : openAipStaticNavaidState.items) || !Array.isArray(window.gaMapSingleClickHost ? cachedNavData : openAipStaticReportingPointState.items)) {
    showMapToast('Flugplatz- und Funkfeuerdaten laden – Auswahl wird automatisch nachgeholt', 2400);
  }
}
var navaidInfoPopupLayer = null;
function getOpenAipPopupSourceLabel(source) {
  var normalized = String(source || '').toLowerCase();
  if (normalized === 'hosted') return 'GA Aviation DB (OpenAIP)';
  if (normalized.startsWith('static')) return 'OpenAIP-Fallback';
  if (normalized.includes('legacy')) return 'OpenAIP Legacy';
  return 'OpenAIP V2';
}
function openNavaidInfoPopup(navaid) {
  if (!map) return;
  var nav = normalizeOpenAipNavaidForPopup(navaid);
  if (!nav) return;
  var title = nav.identifier ? `${escapePopupText(nav.identifier)} · ${escapePopupText(nav.name)}` : escapePopupText(nav.name);
  var typeLabel = getOpenAipNavaidTypeLabel(nav.type);
  var sourceLabel = getOpenAipPopupSourceLabel(nav.source);
  var lines = [`<div style="font-size:11px; line-height:1.65;"><b>Typ:</b> ${escapePopupText(typeLabel)}`, nav.frequencyValue ? `<b>Frequenz:</b> ${escapePopupText(nav.frequencyValue)}${nav.frequencyUnit ? ` ${escapePopupText(nav.frequencyUnit)}` : ''}` : '<b>Frequenz:</b> Keine Angabe', nav.channel ? `<b>Kanal:</b> ${escapePopupText(nav.channel)}` : '', nav.rangeValue ? `<b>Reichweite:</b> ${escapePopupText(nav.rangeValue)}${nav.rangeUnit ? ` ${escapePopupText(nav.rangeUnit)}` : ''}` : '', nav.country ? `<b>Land:</b> ${escapePopupText(nav.country)}` : '', `<b>Position:</b> ${nav.lat.toFixed(5)}, ${nav.lon.toFixed(5)}`, `<span style="color:#666;">Quelle: ${escapePopupText(sourceLabel)}</span></div>`].filter(Boolean).join('<br>');
  var content = `
        <div style="font-family:'Courier New',monospace; min-width:190px; color:#111;">
            <b style="font-size:13px;">${title}</b>
            <hr style="border-color:#ccc; margin:5px 0;">
            ${lines}
        </div>`;
  if (!navaidInfoPopupLayer) navaidInfoPopupLayer = L.popup({
    maxWidth: 285
  });
  navaidInfoPopupLayer.setLatLng([nav.lat, nav.lon]).setContent(content).openOn(map);
}
var reportingPointInfoPopupLayer = null;
function openReportingPointInfoPopup(point) {
  var _raw$geometry, _ref7, _raw$lat, _ref8, _ref9, _raw$lon;
  if (!map || !point) return;
  var raw = point !== null && point !== void 0 && point.rppData && typeof point.rppData === 'object' ? point.rppData : point;
  var coords = raw === null || raw === void 0 || (_raw$geometry = raw.geometry) === null || _raw$geometry === void 0 ? void 0 : _raw$geometry.coordinates;
  var lat = Number((_ref7 = (_raw$lat = raw === null || raw === void 0 ? void 0 : raw.lat) !== null && _raw$lat !== void 0 ? _raw$lat : point === null || point === void 0 ? void 0 : point.lat) !== null && _ref7 !== void 0 ? _ref7 : coords === null || coords === void 0 ? void 0 : coords[1]);
  var lon = Number((_ref8 = (_ref9 = (_raw$lon = raw === null || raw === void 0 ? void 0 : raw.lon) !== null && _raw$lon !== void 0 ? _raw$lon : raw === null || raw === void 0 ? void 0 : raw.lng) !== null && _ref9 !== void 0 ? _ref9 : point === null || point === void 0 ? void 0 : point.lng) !== null && _ref8 !== void 0 ? _ref8 : coords === null || coords === void 0 ? void 0 : coords[0]);
  if (![lat, lon].every(Number.isFinite)) return;
  var name = String((raw === null || raw === void 0 ? void 0 : raw.name) || (point === null || point === void 0 ? void 0 : point.name) || 'VFR-Meldepunkt').replace(/^RPP\s+/i, '').trim();
  var airportIcao = String((raw === null || raw === void 0 ? void 0 : raw.airportIcao) || (point === null || point === void 0 ? void 0 : point.rppAirportIcao) || '').trim().toUpperCase();
  var description = String((raw === null || raw === void 0 ? void 0 : raw.description) || '').trim();
  var sourceLabel = getOpenAipPopupSourceLabel(point === null || point === void 0 ? void 0 : point.rppSource);
  var content = `
        <div style="font-family:'Courier New',monospace; min-width:185px; color:#111;">
            <b style="font-size:13px;">VRP ${escapePopupText(name)}</b>
            <hr style="border-color:#ccc; margin:5px 0;">
            <div style="font-size:11px; line-height:1.65;">
                ${airportIcao ? `<b>Flugplatz:</b> ${escapePopupText(airportIcao)}<br>` : ''}
                <b>Position:</b> ${lat.toFixed(5)}, ${lon.toFixed(5)}
                ${description ? `<br><span style="color:#555;">${escapePopupText(description)}</span>` : ''}
                <br><span style="color:#666;">Quelle: ${escapePopupText(sourceLabel)}</span>
            </div>
        </div>`;
  if (!reportingPointInfoPopupLayer) reportingPointInfoPopupLayer = L.popup({
    maxWidth: 285
  });
  reportingPointInfoPopupLayer.setLatLng([lat, lon]).setContent(content).openOn(map);
}
function normalizeOpenAipAirportForPopup(airport) {
  return window.GAMapNavpointCore.normalizeAirport(airport);
}
