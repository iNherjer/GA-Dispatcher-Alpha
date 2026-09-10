// Generated from map-airport-popup.js by sync-efb-web-assets.js. Do not edit.
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
// Shared standalone popup implementation; host adapters supply local data only.
function _buildAptPopup(label, name, elev, icaoForRunways) {
  var options = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
  var rwCacheKey = icaoForRunways || (label === 'DEP' ? currentStartICAO : currentDestICAO);
  var wxContainerId = options.wxContainerId || (label === 'DEP' ? 'wxPopupDep' : 'wxPopupDest');
  var runwayContainerId = options.runwayContainerId || null;
  var freqContainerId = options.freqContainerId || null;
  var countryCode = options.countryCode || '';
  var compactLayout = Boolean(options.compactLayout);
  var dividerMargin = compactLayout ? '2px 0' : '5px 0';
  var detailLineHeight = compactLayout ? '1.28' : '1.7';
  var titleHtml = options.title || `<b style="font-size:13px;">${label}: ${name || '–'}</b>`;
  var showDirectTo = Boolean(options.showDirectTo && icaoForRunways && Number.isFinite(options.lat) && Number.isFinite(options.lon));
  var aipUrl = icaoForRunways ? getAipPopupUrl(icaoForRunways, countryCode) : null;
  var showAip = Boolean(aipUrl);
  var icaoSafe = sanitizeAipIcaoKey(icaoForRunways || '');
  var icaoEsc = escapeJsSingleQuoted(icaoSafe);
  var countryEsc = escapeJsSingleQuoted(String(countryCode || '').toUpperCase());
  var opacityPct = Math.round((typeof getAipCurrentOpacity === 'function' ? getAipCurrentOpacity(icaoSafe) : 0.65) * 100);
  var html = `<div class="${compactLayout ? 'ga-airport-popup-compact' : ''}" style="font-family:'Courier New',monospace; min-width:${compactLayout ? '0' : '190px'}; color:#111;">`;
  html += titleHtml;
  if (elev != null) {
    var elevRnd = Math.round(elev);
    var tpa = elevRnd + 1000;
    html += `<hr style="border-color:#ccc; margin:${dividerMargin};">`;
    html += `<div style="font-size:11px; line-height:${detailLineHeight};">`;
    html += compactLayout ? `<span class="ga-airport-altitude-line">📍 <b>${elevRnd} ft<span class="ga-airport-altitude-desktop-only"> MSL</span></b> · 🔄 <span class="ga-airport-altitude-desktop-only">TPA </span><b><span class="ga-airport-altitude-desktop-only">~</span>${tpa} ft</b></span>` : `📍 Platz: <b>${elevRnd} ft MSL</b><br>🔄 Platzrunde: <b>~${tpa} ft MSL</b>`;
    html += `</div>`;
  }
  var runwayHtml = (() => {
    if (!rwCacheKey || typeof runwayCache === 'undefined' || !runwayCache[rwCacheKey] || runwayCache[rwCacheKey] === 'Keine Daten gefunden') {
      return runwayContainerId ? `<div id="${runwayContainerId}" style="font-size:11px; line-height:${detailLineHeight}; color:#666;">Pisten laden…</div>` : '';
    }
    var rwys = runwayCache[rwCacheKey].split(/\s*(?:\||\n|<br\s*\/?>)\s*/i).filter(r => r.trim());
    if (rwys.length === 0) return '';
    var lines = compactLayout ? `🛫 ${rwys.join('<br>🛫 ')}` : `🛫 Pisten:<br>${rwys.map(r => `&nbsp;&nbsp;${r}`).join('<br>')}`;
    return runwayContainerId ? `<div id="${runwayContainerId}" style="font-size:11px; line-height:${detailLineHeight};">${lines}</div>` : `<div style="font-size:11px; line-height:${detailLineHeight};">${lines}</div>`;
  })();
  if (runwayHtml) {
    html += `<hr style="border-color:#ccc; margin:${dividerMargin};">`;
    html += runwayHtml;
  }
  if (icaoForRunways) {
    html += `<hr style="border-color:#ccc; margin:${dividerMargin};">`;
    var freqBody = buildPopupFrequencyLines(icaoForRunways);
    html += freqContainerId ? `<div id="${freqContainerId}" style="font-size:11px; line-height:${compactLayout ? '1.25' : '1.6'};">${freqBody}</div>` : `<div style="font-size:11px; line-height:${compactLayout ? '1.25' : '1.6'};">${freqBody}</div>`;
  }
  if (showAip) {
    var _window$gaAirportPopu;
    html += `<hr style="border-color:#ccc; margin:${dividerMargin};">`;
    html += `<a data-ga-airport-aip="${escapePopupText(icaoSafe)}" data-country="${escapePopupText(countryCode)}" href="${aipUrl}" target="_blank" rel="noopener noreferrer" style="display:block; font-size:11px; text-decoration:none; color:#0b1f65; font-weight:bold;">📄 AIP VFR ${(_window$gaAirportPopu = window.gaAirportPopupHost) !== null && _window$gaAirportPopu !== void 0 && _window$gaAirportPopu.openAip ? 'im PC-Browser öffnen' : 'öffnen'} ↗</a>`;
    if (typeof AIP_CHART_UI_ENABLED !== 'undefined' && AIP_CHART_UI_ENABLED) {
      html += `<div style="margin-top:6px; border:1px solid #ddd; border-radius:5px; padding:6px; background:#f8f8f8;">`;
      html += `<div class="aip-overlay-status" data-aip-icao="${icaoSafe}" style="font-size:10px; color:#444; margin-bottom:6px;">Overlay aus</div>`;
      html += `<button onclick="window.loadAipChartOverlay('${icaoEsc}','${countryEsc}')" style="display:block; width:100%; background:#235ea7; color:#fff; border:none; padding:6px 8px; cursor:pointer; border-radius:3px; font-size:11px; margin-bottom:4px;">🗺️ Overlay laden</button>`;
      html += `<button class="aip-calibrate-btn" data-aip-icao="${icaoSafe}" onclick="window.startAipChartCalibration('${icaoEsc}')" style="display:block; width:100%; background:#7c4d9e; color:#fff; border:none; padding:6px 8px; cursor:pointer; border-radius:3px; font-size:11px; margin-bottom:6px;">🎯 Kalibrieren (2 Punkte)</button>`;
      html += `<div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">`;
      html += `<span style="font-size:10px; color:#555; min-width:64px;">Transparenz</span>`;
      html += `<input class="aip-opacity-slider" data-aip-icao="${icaoSafe}" type="range" min="15" max="100" value="${opacityPct}" oninput="window.setAipChartOpacity(this.value, '${icaoEsc}'); this.nextElementSibling.textContent=this.value+'%';" style="flex:1;">`;
      html += `<span class="aip-opacity-value" data-aip-icao="${icaoSafe}" style="font-size:10px; color:#222; min-width:34px; text-align:right;">${opacityPct}%</span>`;
      html += `</div>`;
      html += `<button onclick="window.clearAipChartOverlay()" style="display:block; width:100%; background:#666; color:#fff; border:none; padding:5px 8px; cursor:pointer; border-radius:3px; font-size:10px;">Overlay aus</button>`;
      html += `</div>`;
    }
  }
  html += `<hr style="border-color:#ccc; margin:${dividerMargin};">`;
  html += `<div id="${wxContainerId}" style="min-height:${compactLayout ? '24px' : '36px'};">`;
  html += `<div style="font-size:10px; color:#aaa; text-align:center; padding:${compactLayout ? '4px' : '8px'} 0;">Wetter lädt…</div>`;
  html += `</div>`;
  if (showDirectTo) {
    var encodedName = encodeURIComponent(options.directToName || name || icaoForRunways);
    html += `<button onclick="window.confirmAirportDirectTo('${icaoForRunways}', ${Number(options.lat)}, ${Number(options.lon)}, '${encodedName}')" style="margin-top:${compactLayout ? '4px' : '8px'}; width:100%; background:#1f7a45; color:#fff; border:none; padding:${compactLayout ? '6px 8px' : '8px 10px'}; cursor:pointer; border-radius:4px; font-weight:bold;">✈️ Direct To</button>`;
  }
  html += `</div>`;
  return html;
}
function getAirportDisplayName(apt) {
  return (apt === null || apt === void 0 ? void 0 : apt.name) || (apt === null || apt === void 0 ? void 0 : apt.n) || (apt === null || apt === void 0 ? void 0 : apt.city) || (apt === null || apt === void 0 ? void 0 : apt.icao) || 'Flugplatz';
}
function normalizeAirportForMap(apt) {
  var _apt$lon, _apt$elevation;
  if (!apt) return null;
  return {
    icao: String(apt.icao || apt.ident || '').trim().toUpperCase(),
    name: getAirportDisplayName(apt),
    lat: Number(apt.lat),
    lon: Number((_apt$lon = apt.lon) !== null && _apt$lon !== void 0 ? _apt$lon : apt.lng),
    elevation: (_apt$elevation = apt.elevation) !== null && _apt$elevation !== void 0 ? _apt$elevation : null,
    country: apt.country || apt.iso_country || apt.cc || '',
    sourceId: String(apt.sourceId || apt._id || apt.id || '').trim()
  };
}
var AIRPORT_INFO_POPUP_CACHE_TTL_MS = 15 * 60 * 1000;
var AIRPORT_INFO_POPUP_CACHE_MAX = 32;
var airportInfoPopupCache = new Map();
var airportInfoPopupLayer = null;
function getAirportInfoPopupCacheKey(apt) {
  if (!apt) return '';
  if (apt.icao) return `icao:${apt.icao}`;
  if (apt.sourceId) return `source:${apt.sourceId}`;
  return `pos:${apt.lat.toFixed(5)},${apt.lon.toFixed(5)}`;
}
function rememberAirportInfoPopupEntry(key, entry) {
  airportInfoPopupCache.delete(key);
  airportInfoPopupCache.set(key, entry);
  while (airportInfoPopupCache.size > AIRPORT_INFO_POPUP_CACHE_MAX) {
    var oldestKey = airportInfoPopupCache.keys().next().value;
    if (!oldestKey) break;
    airportInfoPopupCache.delete(oldestKey);
  }
}
function updateAirportInfoPopupFrequency(entry, icao) {
  if (!entry || !entry.content || !icao) return;
  var el = entry.content.querySelector(`#${entry.freqId}`);
  if (!el) return;
  el.innerHTML = buildPopupFrequencyLines(icao);
}
function openAirportInfoPopup(airport) {
  if (!map) return;
  var apt = normalizeAirportForMap(airport);
  if (!apt || !apt.icao || !Number.isFinite(apt.lat) || !Number.isFinite(apt.lon)) return;
  var cacheKey = getAirportInfoPopupCacheKey(apt);
  var now = Date.now();
  var entry = airportInfoPopupCache.get(cacheKey);
  if (entry && now - entry.createdAt >= AIRPORT_INFO_POPUP_CACHE_TTL_MS) {
    airportInfoPopupCache.delete(cacheKey);
    entry = null;
  }
  var popupIdSafe = apt.icao.replace(/[^a-zA-Z0-9_-]/g, '_');
  var runwayId = `wxRwy_${popupIdSafe}`;
  var freqId = `wxFreq_${popupIdSafe}`;
  // Prefix "wxPopup" erzwingt im Widget die gleiche kompakte Start/Ziel-Darstellung
  var wxId = `wxPopupApt_${popupIdSafe}`;
  if (!entry) {
    var _apt$elevation2, _globalAirports$apt$i, _globalAirports;
    var elev = (_apt$elevation2 = apt.elevation) !== null && _apt$elevation2 !== void 0 ? _apt$elevation2 : (_globalAirports$apt$i = (_globalAirports = globalAirports) === null || _globalAirports === void 0 || (_globalAirports = _globalAirports[apt.icao]) === null || _globalAirports === void 0 ? void 0 : _globalAirports.elevation) !== null && _globalAirports$apt$i !== void 0 ? _globalAirports$apt$i : null;
    var countryCode = getAirportCountryCode(apt.icao, apt.country);
    var title = `<b style="font-size:13px;">${apt.icao}</b><div style="font-size:11px; color:#555; margin-top:2px;">${apt.name}</div>`;
    var content = document.createElement('div');
    content.innerHTML = _buildAptPopup('APT', apt.name, elev, apt.icao, {
      title,
      wxContainerId: wxId,
      runwayContainerId: runwayId,
      freqContainerId: freqId,
      countryCode,
      showDirectTo: true,
      directToName: apt.name,
      lat: apt.lat,
      lon: apt.lon
    });
    entry = {
      createdAt: now,
      content,
      runwayId,
      freqId,
      wxId,
      loadingStarted: false
    };
  }
  rememberAirportInfoPopupEntry(cacheKey, entry);
  if (!airportInfoPopupLayer) airportInfoPopupLayer = L.popup({
    maxWidth: 290
  });
  airportInfoPopupLayer
  // Immer am kanonischen Flugplatz statt am zufälligen Klickpunkt verankern.
  .setLatLng([apt.lat, apt.lon]).setContent(entry.content).openOn(map);
  if (typeof refreshAipOverlayPopupUi === 'function') setTimeout(() => refreshAipOverlayPopupUi(apt.icao), 0);
  updateAirportInfoPopupFrequency(entry, apt.icao);

  // Pisten dürfen nach einem temporären Quellenfehler beim nächsten Öffnen
  // erneut versucht werden; positive und echte Leerdaten werden separat gecacht.
  if (typeof fetchRunwayDetails === 'function') {
    fetchRunwayDetails(apt.lat, apt.lon, entry.runwayId, apt.icao);
  }

  // Frequenzen und Wetter pro Popup-Eintrag nur einmal starten. Derselbe
  // Flugplatz behält seinen DOM- und Ladezustand über Folgeklicks.
  if (entry.loadingStarted) return;
  entry.loadingStarted = true;
  if (typeof fetchAirportFreq === 'function') {
    var hasCachedFrequencies = typeof freqCache !== 'undefined' && Object.prototype.hasOwnProperty.call(freqCache, apt.icao);
    if (!hasCachedFrequencies) {
      fetchAirportFreq(apt.icao, null, null).finally(() => updateAirportInfoPopupFrequency(entry, apt.icao));
    }
  }
  if (typeof loadMetarWidget === 'function') {
    loadMetarWidget(apt.icao, entry.wxId, apt.lat, apt.lon, true);
  }
}
function getOpenAipNavaidTypeLabel(type) {
  var labels = {
    0: 'DME',
    1: 'TACAN',
    2: 'NDB',
    3: 'VOR',
    4: 'VOR/DME',
    5: 'VORTAC',
    6: 'DVOR',
    7: 'DVOR/DME',
    8: 'DVORTAC'
  };
  var key = Number(type);
  return Object.prototype.hasOwnProperty.call(labels, key) ? labels[key] : 'Funkfeuer';
}
function normalizeOpenAipNavaidForPopup(navaid) {
  var _item$geometry, _ref, _item$lat, _ref2, _ref3, _item$lon, _item$frequency, _frequency$value, _item$range$value, _item$range, _item$range2, _item$range3, _ref4, _item$type;
  var source = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  var raw = navaid !== null && navaid !== void 0 && navaid.navaidData && typeof navaid.navaidData === 'object' ? navaid.navaidData : navaid;
  if (!raw) return null;
  var sourceId = String((raw === null || raw === void 0 ? void 0 : raw._id) || (raw === null || raw === void 0 ? void 0 : raw.id) || (navaid === null || navaid === void 0 ? void 0 : navaid.sourceId) || '').trim();
  var staticItem = sourceId && typeof openAipStaticNavaidState !== 'undefined' && openAipStaticNavaidState.byId instanceof Map ? openAipStaticNavaidState.byId.get(sourceId) : null;
  var item = staticItem ? _objectSpread(_objectSpread({}, staticItem), raw) : raw;
  var coords = item === null || item === void 0 || (_item$geometry = item.geometry) === null || _item$geometry === void 0 ? void 0 : _item$geometry.coordinates;
  var lat = Number((_ref = (_item$lat = item === null || item === void 0 ? void 0 : item.lat) !== null && _item$lat !== void 0 ? _item$lat : navaid === null || navaid === void 0 ? void 0 : navaid.lat) !== null && _ref !== void 0 ? _ref : coords === null || coords === void 0 ? void 0 : coords[1]);
  var lon = Number((_ref2 = (_ref3 = (_item$lon = item === null || item === void 0 ? void 0 : item.lon) !== null && _item$lon !== void 0 ? _item$lon : item === null || item === void 0 ? void 0 : item.lng) !== null && _ref3 !== void 0 ? _ref3 : navaid === null || navaid === void 0 ? void 0 : navaid.lng) !== null && _ref2 !== void 0 ? _ref2 : coords === null || coords === void 0 ? void 0 : coords[0]);
  if (![lat, lon].every(Number.isFinite)) return null;
  var frequency = (_item$frequency = item === null || item === void 0 ? void 0 : item.frequency) !== null && _item$frequency !== void 0 ? _item$frequency : Array.isArray(item === null || item === void 0 ? void 0 : item.frequencies) ? item.frequencies[0] : null;
  var frequencyValue = typeof frequency === 'object' ? String((_frequency$value = frequency === null || frequency === void 0 ? void 0 : frequency.value) !== null && _frequency$value !== void 0 ? _frequency$value : '').trim() : String(frequency !== null && frequency !== void 0 ? frequency : '').trim();
  var frequencyUnitCode = Number(typeof frequency === 'object' ? frequency === null || frequency === void 0 ? void 0 : frequency.unit : NaN);
  var frequencyUnit = frequencyUnitCode === 1 ? 'kHz' : frequencyUnitCode === 2 ? 'MHz' : '';
  var rangeValue = typeof (item === null || item === void 0 ? void 0 : item.range) === 'object' ? String((_item$range$value = (_item$range = item.range) === null || _item$range === void 0 ? void 0 : _item$range.value) !== null && _item$range$value !== void 0 ? _item$range$value : '').trim() : String((_item$range2 = item === null || item === void 0 ? void 0 : item.range) !== null && _item$range2 !== void 0 ? _item$range2 : '').trim();
  var rangeUnit = Number(item === null || item === void 0 || (_item$range3 = item.range) === null || _item$range3 === void 0 ? void 0 : _item$range3.unit) === 2 ? 'NM' : '';
  var identifier = String((item === null || item === void 0 ? void 0 : item.identifier) || (item === null || item === void 0 ? void 0 : item.designator) || (navaid === null || navaid === void 0 ? void 0 : navaid.navaidIdentifier) || '').trim().toUpperCase();
  return {
    id: sourceId,
    name: String((item === null || item === void 0 ? void 0 : item.name) || identifier || 'Funkfeuer').trim(),
    identifier,
    type: (_ref4 = (_item$type = item === null || item === void 0 ? void 0 : item.type) !== null && _item$type !== void 0 ? _item$type : navaid === null || navaid === void 0 ? void 0 : navaid.navaidType) !== null && _ref4 !== void 0 ? _ref4 : null,
    country: String((item === null || item === void 0 ? void 0 : item.country) || '').trim().toUpperCase(),
    frequencyValue,
    frequencyUnit,
    channel: String((item === null || item === void 0 ? void 0 : item.channel) || '').trim().toUpperCase(),
    rangeValue,
    rangeUnit,
    lat,
    lon,
    source: String(source || (navaid === null || navaid === void 0 ? void 0 : navaid.navaidSource) || 'live')
  };
}
function escapePopupText(v) {
  return String(v !== null && v !== void 0 ? v : '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeJsSingleQuoted(v) {
  return String(v !== null && v !== void 0 ? v : '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '').replace(/\n/g, ' ');
}
function sanitizeAipIcaoKey(icao) {
  return String(icao || '').trim().toUpperCase();
}
function abbreviateMapFrequencyLabel(label) {
  var replacements = [[/\bFLIGHT\s+INFORMATION\s+SERVICE\b/gi, 'FIS'], [/\bCLEARANCE\s+DELIVERY\b/gi, 'CLR DEL'], [/\bROLLKONTROLLE\b/gi, 'GND'], [/\bGROUND\b/gi, 'GND'], [/\bTOWER\b/gi, 'TWR'], [/\bTURM\b/gi, 'TWR'], [/\bRADIO\b/gi, 'RDO'], [/\bINFORMATION\b/gi, 'INFO'], [/\bAPPROACH\b/gi, 'APP'], [/\bANFLUG\b/gi, 'APP'], [/\bDEPARTURE\b/gi, 'DEP'], [/\bABFLUG\b/gi, 'DEP'], [/\bAPRON\b/gi, 'APR'], [/\bVORFELD\b/gi, 'APR'], [/\bCLEARANCE\b/gi, 'CLR'], [/\bDELIVERY\b/gi, 'DEL']];
  var result = String(label || 'FREQ').trim();
  replacements.forEach(_ref5 => {
    var _ref6 = _slicedToArray(_ref5, 2),
      pattern = _ref6[0],
      replacement = _ref6[1];
    result = result.replace(pattern, replacement);
  });
  return result.replace(/\s+/g, ' ').trim().toUpperCase() || 'FREQ';
}
function buildPopupFrequencyLines(icao) {
  if (!icao || typeof freqCache === 'undefined' || !Array.isArray(freqCache[icao])) {
    return '<span style="color:#666;">Frequenzen laden…</span>';
  }
  if (freqCache[icao].length === 0) {
    return '<span style="color:#666;">Keine Frequenzen verfügbar</span>';
  }
  return freqCache[icao].slice(0, 6).map(f => `
            <span class="ga-popup-frequency-row">
                <span class="ga-popup-frequency-label">📻 ${escapePopupText(abbreviateMapFrequencyLabel(f.label || 'Freq'))}</span>
                <span class="ga-popup-frequency-value">${escapePopupText(f.value || '--')}</span>
            </span>`).join('');
}
function updatePopupFrequencyBlock(containerId, icao) {
  if (!containerId || !icao) return;
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = buildPopupFrequencyLines(icao);
}
function getAirportTapRadiusPx() {
  var basePx = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 34;
  if (!map || !map.getZoom) return basePx;
  var z = map.getZoom();
  // Beim Rauszoomen deutlich kleinerer Clickspot, beim Reinzoomen komfortabel.
  // z=7 -> ~10px, z=10 -> ~19px, z=14 -> ~34px
  var scaled = 10 + (z - 7) / 7 * (basePx - 10);
  var coarsePointer = Boolean(typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches || Number(navigator.maxTouchPoints) > 0);
  var minimum = coarsePointer ? Math.min(basePx, 28) : 8;
  return Math.max(minimum, Math.min(basePx, Math.round(scaled)));
}

// Only the EFB host delegates external pages to the authenticated PC tool.
// Standalone keeps its normal browser links.
document.addEventListener('click', function (event) {
  var _event$target, _event$target$closest, _window$gaAirportPopu2;
  var link = (_event$target = event.target) === null || _event$target === void 0 || (_event$target$closest = _event$target.closest) === null || _event$target$closest === void 0 ? void 0 : _event$target$closest.call(_event$target, '[data-ga-airport-aip], [data-ga-airport-weather]');
  if (!link || !((_window$gaAirportPopu2 = window.gaAirportPopupHost) !== null && _window$gaAirportPopu2 !== void 0 && _window$gaAirportPopu2.openAip)) return;
  event.preventDefault();
  event.stopPropagation();
  if (link.dataset.opening === 'true') return;
  link.dataset.opening = 'true';
  var original = link.dataset.linkLabel || link.textContent;
  link.dataset.linkLabel = original;
  link.textContent = 'Browser wird geöffnet…';
  Promise.resolve().then(() => window.gaAirportPopupHost[link.dataset.gaAirportWeather ? 'openWeather' : 'openAip']({
    icao: link.dataset.gaAirportWeather || link.dataset.gaAirportAip,
    country: link.dataset.country
  })).then(() => {
    link.textContent = original;
  }, () => {
    link.textContent = 'Öffnen fehlgeschlagen – erneut versuchen';
  }).finally(() => {
    delete link.dataset.opening;
  });
});
function bindRouteAirportPopup(marker, isStart, latlng) {
  if (isStart) {
    marker.bindPopup('');
    marker.on('popupopen', () => {
      var depCountry = getAirportCountryCode(currentStartICAO);
      marker.getPopup().setContent(_buildAptPopup('DEP', currentSName, currentDepElev, currentStartICAO, {
        runwayContainerId: 'wxPopupDepRwy',
        freqContainerId: 'wxPopupDepFreq',
        countryCode: depCountry,
        showDirectTo: currentStartICAO && currentStartICAO !== 'GPS' && currentStartICAO !== currentDestICAO,
        directToName: currentSName,
        lat: latlng.lat,
        lon: latlng.lng || latlng.lon
      }));
      marker.getPopup().update();
      var depIcao = currentStartICAO;
      if (depIcao && typeof refreshAipOverlayPopupUi === 'function') setTimeout(() => refreshAipOverlayPopupUi(depIcao), 0);
      if (depIcao && depIcao !== 'GPS' && typeof fetchRunwayDetails === 'function') {
        fetchRunwayDetails(latlng.lat, latlng.lng || latlng.lon, 'wxPopupDepRwy', depIcao);
      }
      if (depIcao && depIcao !== 'GPS' && typeof fetchAirportFreq === 'function') {
        updatePopupFrequencyBlock('wxPopupDepFreq', depIcao);
        fetchAirportFreq(depIcao, null, null).finally(() => updatePopupFrequencyBlock('wxPopupDepFreq', depIcao));
      }
      if (depIcao && typeof loadMetarWidget === 'function') {
        loadMetarWidget(depIcao, 'wxPopupDep', latlng.lat, latlng.lng || latlng.lon, true);
      }
    });
  } else {
    marker.bindPopup('');
    marker.on('popupopen', () => {
      var missionLikePoi = !!(currentMissionData && (currentMissionData.poiName || currentMissionData.poiPresentation || typeof missionUsesPoiTaskRecipe === 'function' && missionUsesPoiTaskRecipe(currentMissionData)));
      var icao = missionLikePoi ? currentStartICAO : currentDestICAO;
      var elev = missionLikePoi ? currentDepElev : currentDestElev;
      var destCountry = getAirportCountryCode(icao);
      marker.getPopup().setContent(_buildAptPopup('DEST', currentDName, elev, icao, {
        runwayContainerId: 'wxPopupDestRwy',
        freqContainerId: 'wxPopupDestFreq',
        countryCode: destCountry,
        showDirectTo: Boolean(icao && icao !== currentDestICAO),
        directToName: currentDName,
        lat: latlng.lat,
        lon: latlng.lng || latlng.lon
      }));
      marker.getPopup().update();
      if (icao && typeof refreshAipOverlayPopupUi === 'function') setTimeout(() => refreshAipOverlayPopupUi(icao), 0);
      if (icao && typeof fetchRunwayDetails === 'function') {
        fetchRunwayDetails(latlng.lat, latlng.lng || latlng.lon, 'wxPopupDestRwy', icao);
      }
      if (icao && icao !== 'GPS' && typeof fetchAirportFreq === 'function') {
        updatePopupFrequencyBlock('wxPopupDestFreq', icao);
        fetchAirportFreq(icao, null, null).finally(() => updatePopupFrequencyBlock('wxPopupDestFreq', icao));
      }
      if (icao && typeof loadMetarWidget === 'function') {
        loadMetarWidget(icao, 'wxPopupDest', latlng.lat, latlng.lng || latlng.lon, true);
      }
    });
  }
}
