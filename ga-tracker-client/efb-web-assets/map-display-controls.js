// Generated from map-display-controls.js by sync-efb-web-assets.js. Do not edit.
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
// Original standalone display menu and aircraft settings, shared with the EFB.
var MAP_HINT_DEFAULTS = {
  magentaLine: true,
  weather: true,
  windBarbs: true,
  cloudFields: true,
  vfrIndex: false,
  terrainAvoid: false,
  traffic: true,
  autoZoom: false,
  telemetry: true,
  currentInfo: true,
  nextLeg: true,
  routeProgress: true,
  compass: true,
  lowFps: false
};
var MAP_SINGLE_CLICK_MODE_KEY = 'ga_map_single_click_mode';
var MAP_SINGLE_CLICK_MODES = ['off', 'tooltip', 'panels'];
var MAP_SINGLE_CLICK_MODE_LABELS = {
  off: 'Aus',
  tooltip: 'Tooltip',
  panels: 'Tafeln'
};
var mapSingleClickMode = 'off';
window.mapHints = window.mapHints || _objectSpread({}, MAP_HINT_DEFAULTS);
Object.keys(MAP_HINT_DEFAULTS).forEach(key => {
  if (!(key in window.mapHints)) window.mapHints[key] = MAP_HINT_DEFAULTS[key];
});
var MAP_HINT_SUBMENU_DEFAULTS = {
  weatherMenu: false,
  vfrIndexMenu: false,
  terrainAvoidMenu: false
};
window.mapHintSubmenus = window.mapHintSubmenus || _objectSpread({}, MAP_HINT_SUBMENU_DEFAULTS);
function loadMapHintSettings() {
  Object.keys(MAP_HINT_DEFAULTS).forEach(key => {
    var saved = localStorage.getItem(`ga_map_hint_${key}`);
    if (saved === null) window.mapHints[key] = MAP_HINT_DEFAULTS[key];else window.mapHints[key] = saved !== 'false';
  });
  // Wetter-/Traffic-Flags mit bestehenden Zuständen synchronisieren
  if (typeof window.vpShowMapMetar === 'boolean') window.mapHints.weather = window.vpShowMapMetar;
  if (typeof window.vpTrafficMapVisible === 'boolean') window.mapHints.traffic = window.vpTrafficMapVisible;
  var storedSingleClickMode = String(localStorage.getItem(MAP_SINGLE_CLICK_MODE_KEY) || '').trim().toLowerCase();
  if (MAP_SINGLE_CLICK_MODES.includes(storedSingleClickMode)) {
    mapSingleClickMode = storedSingleClickMode;
  } else {
    // Ein bereits aktivierter alter Ein/Aus-Schalter entspricht der
    // bisherigen Vollansicht; ansonsten bleibt Einzelklick standardmäßig aus.
    mapSingleClickMode = localStorage.getItem('ga_map_hint_airportSingleClick') === 'true' ? 'panels' : 'off';
    localStorage.setItem(MAP_SINGLE_CLICK_MODE_KEY, mapSingleClickMode);
  }
  window.mapSingleClickMode = mapSingleClickMode;
}
function saveMapHintSetting(key) {
  if (!(key in MAP_HINT_DEFAULTS)) return;
  localStorage.setItem(`ga_map_hint_${key}`, String(Boolean(window.mapHints[key])));
}
window.isMapHintEnabled = function (key) {
  if (!(key in MAP_HINT_DEFAULTS)) return true;
  return window.mapHints[key] !== false;
};
function getMapSingleClickMode() {
  return MAP_SINGLE_CLICK_MODES.includes(mapSingleClickMode) ? mapSingleClickMode : 'off';
}
function setMapHintSubmenuOpen(key, open) {
  var ids = {
    weatherMenu: {
      btn: 'btnToggleWeatherMenu',
      panel: 'weatherMenuBlock',
      label: 'Wetter'
    },
    vfrIndexMenu: {
      btn: 'btnToggleVfrIndexMenu',
      panel: 'vfrIndexMenuBlock',
      label: 'VFR-Index'
    },
    terrainAvoidMenu: {
      btn: 'btnToggleTerrainAvoidMenu',
      panel: 'terrainAvoidMenuBlock',
      label: 'Terrain Avoid'
    }
  };
  var meta = ids[key];
  if (!meta) return;
  var panel = document.getElementById(meta.panel);
  var btn = document.getElementById(meta.btn);
  var isOpen = !!open;
  if (window.mapHintSubmenus) window.mapHintSubmenus[key] = isOpen;
  if (panel) panel.style.display = isOpen ? 'block' : 'none';
  if (btn) {
    btn.textContent = key === 'weatherMenu' || key === 'vfrIndexMenu' || key === 'terrainAvoidMenu' ? isOpen ? '▾' : '▸' : `${isOpen ? '▾' : '▸'} ${meta.label}`;
    btn.classList.toggle('active', isOpen);
  }
}
function closeAllMapHintSubmenus() {
  Object.keys(MAP_HINT_SUBMENU_DEFAULTS).forEach(k => setMapHintSubmenuOpen(k, false));
}
function positionMapHintsMenuInViewport() {
  var menu = document.getElementById('mapHintsMenu');
  var btn = document.getElementById('mapHintsBtn');
  if (!menu || !btn || menu.style.display !== 'block') return;
  var openInViewport = typeof window._openFloatingMenuInViewport === 'function' ? window._openFloatingMenuInViewport : typeof _openFloatingMenuInViewport === 'function' ? _openFloatingMenuInViewport : null;
  if (openInViewport) {
    openInViewport(menu, btn, false);
  }
}
window.toggleMapHintSubmenu = function (key, evt) {
  if (evt && typeof evt.stopPropagation === 'function') evt.stopPropagation();
  if (!(key in MAP_HINT_SUBMENU_DEFAULTS)) return;
  var nowOpen = !!(window.mapHintSubmenus && window.mapHintSubmenus[key]);
  Object.keys(MAP_HINT_SUBMENU_DEFAULTS).forEach(k => {
    var nextOpen = k === key ? !nowOpen : false;
    if (key === 'vfrIndexMenu' && k === 'weatherMenu') nextOpen = true;
    if (key === 'weatherMenu' && nowOpen && k === 'vfrIndexMenu') nextOpen = false;
    setMapHintSubmenuOpen(k, nextOpen);
  });
  positionMapHintsMenuInViewport();
};
function refreshMapHintMenuUi() {
  var labels = {
    magentaLine: '🟣 Direkt-Linie',
    weather: '🌤️ Wetter',
    windBarbs: '🪁 Windbarben',
    cloudFields: '☁️ Wolkenfelder',
    vfrIndex: '🧭 VFR-Index',
    terrainAvoid: '🏔️ Terrain Avoid',
    traffic: '✈️ Traffic',
    autoZoom: '🔍 Autozoom',
    telemetry: '📟 Telemetrie',
    currentInfo: '📍 Aktuell',
    nextLeg: '🧭 Wegpunkt-Info',
    routeProgress: '⏱ Route-Leiste',
    compass: '🔵 Kompassscheibe',
    lowFps: '🐢 Low FPS Mode'
  };
  var ids = {
    magentaLine: 'hintToggleMagentaLine',
    weather: 'hintToggleWeather',
    windBarbs: 'hintToggleWindBarbs',
    cloudFields: 'hintToggleCloudFields',
    vfrIndex: 'hintToggleVfrIndex',
    terrainAvoid: 'hintToggleTerrainAvoid',
    traffic: 'hintToggleTraffic',
    autoZoom: 'hintToggleAutoZoom',
    telemetry: 'hintToggleTelemetry',
    currentInfo: 'hintToggleCurrentInfo',
    nextLeg: 'hintToggleNextLeg',
    routeProgress: 'hintToggleRouteProgress',
    compass: 'hintToggleCompass',
    lowFps: 'hintToggleLowFps'
  };
  Object.keys(ids).forEach(key => {
    var btn = document.getElementById(ids[key]);
    if (!btn) return;
    var on = window.mapHints[key] !== false;
    btn.textContent = `${labels[key]} (${on ? 'An' : 'Aus'})`;
    btn.style.background = on ? '#2E8B57' : '#444';
    btn.style.color = '#fff';
  });
  var singleClickButton = document.getElementById('hintToggleAirportSingleClick');
  if (singleClickButton) {
    var singleClickMode = getMapSingleClickMode();
    singleClickButton.textContent = `🛩️ Einzelklick: ${MAP_SINGLE_CLICK_MODE_LABELS[singleClickMode]}`;
    singleClickButton.style.background = singleClickMode === 'panels' ? '#2E8B57' : singleClickMode === 'tooltip' ? '#8a6717' : '#444';
    singleClickButton.style.color = '#fff';
    singleClickButton.setAttribute('aria-label', `Einzelklick für Flugplätze, VRPs und Navaids: ${MAP_SINGLE_CLICK_MODE_LABELS[singleClickMode]}`);
  }
  if (typeof updateSnapButtonUI === 'function') updateSnapButtonUI();
  Object.keys(MAP_HINT_SUBMENU_DEFAULTS).forEach(k => {
    var isOpen = !!(window.mapHintSubmenus && window.mapHintSubmenus[k]);
    setMapHintSubmenuOpen(k, isOpen);
  });
  if (typeof vpUpdateVfrUi === 'function') vpUpdateVfrUi();
  if (typeof updateTerrainAvoidThresholdUi === 'function') updateTerrainAvoidThresholdUi();
  if (typeof updateMapWeatherSourceBtn === 'function') updateMapWeatherSourceBtn();
  if (typeof updateRouteLegLabelModeButton === 'function') updateRouteLegLabelModeButton();
  if (typeof window.refreshMapAutoZoomUi === 'function') window.refreshMapAutoZoomUi();
  if (window.gaMapDisplayAdapter) window.gaMapDisplayAdapter.refreshUi();
  positionMapHintsMenuInViewport();
}
window.toggleMapHint = function (key) {
  if (!(key in MAP_HINT_DEFAULTS)) return;
  if (window.gaMapDisplayAdapter && !window.gaMapDisplayAdapter.supports(key)) return;
  window.mapHints[key] = !(window.mapHints[key] !== false);
  saveMapHintSetting(key);
  if (window.gaMapDisplayAdapter) window.gaMapDisplayAdapter.apply(key);else applyMapHintEffects(key);
  refreshMapHintMenuUi();
};
window.toggleMapHintsMenu = function (force) {
  var menu = document.getElementById('mapHintsMenu');
  var btn = document.getElementById('mapHintsBtn');
  if (!menu) return;
  var isOpen = menu.style.display === 'block';
  var nextOpen = typeof force === 'boolean' ? force : !isOpen;
  if (nextOpen) {
    refreshMapHintMenuUi();
    if (btn) {
      menu.style.display = 'block';
      positionMapHintsMenuInViewport();
    } else {
      menu.style.display = 'block';
    }
    if (typeof window.gaBringMapOverlayToFront === 'function') window.gaBringMapOverlayToFront(menu);
  } else {
    menu.style.display = 'none';
  }
  if (typeof window.gaSetMapFloatingMenuButtonOpen === 'function') {
    window.gaSetMapFloatingMenuButtonOpen('mapHintsBtn', nextOpen);
  } else if (btn) {
    btn.classList.toggle('map-menu-open', nextOpen);
    btn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
  }
  if (!nextOpen) {
    closeAllMapHintSubmenus();
    var planeMenu = document.getElementById('vpPlaneIconMenu');
    if (planeMenu) planeMenu.style.display = 'none';
    var planeBtn = document.getElementById('btnTogglePlaneIconMenu');
    if (planeBtn) planeBtn.classList.remove('active');
  }
};
var PLANE_ICON_COLOR_KEY = 'ga_plane_color';
var PLANE_ICON_SIZE_KEY = 'ga_plane_size';
var PLANE_ICON_DEFAULT_COLOR = '#f2c12e';
var PLANE_ICON_DEFAULT_SIZE = 40;
var PLANE_ICON_MIN_SIZE = 20;
var PLANE_ICON_MAX_SIZE = 100;
function normalizePlaneIconColor(value) {
  var v = String(value || '').trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : null;
}
function normalizePlaneIconSize(value) {
  var n = parseInt(value, 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(PLANE_ICON_MAX_SIZE, Math.max(PLANE_ICON_MIN_SIZE, n));
}
function getCurrentPlaneIconDefaults() {
  var rootStyle = getComputedStyle(document.documentElement);
  var colorCss = normalizePlaneIconColor(rootStyle.getPropertyValue('--plane-color').trim());
  var sizeCss = normalizePlaneIconSize(rootStyle.getPropertyValue('--plane-size'));
  return {
    color: colorCss || PLANE_ICON_DEFAULT_COLOR,
    size: sizeCss || PLANE_ICON_DEFAULT_SIZE
  };
}
function applyPlaneIconSettings() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
    color = _ref.color,
    size = _ref.size,
    _ref$persist = _ref.persist,
    persist = _ref$persist === void 0 ? false : _ref$persist;
  var defaults = getCurrentPlaneIconDefaults();
  var nextColor = normalizePlaneIconColor(color) || defaults.color;
  var nextSize = normalizePlaneIconSize(size) || defaults.size;
  document.documentElement.style.setProperty('--plane-color', nextColor);
  document.documentElement.style.setProperty('--plane-size', `${nextSize}px`);
  if (persist) {
    localStorage.setItem(PLANE_ICON_COLOR_KEY, nextColor);
    localStorage.setItem(PLANE_ICON_SIZE_KEY, String(nextSize));
  }
  var colorPicker = document.getElementById('vpPlaneColorPicker');
  if (colorPicker && colorPicker.value !== nextColor) colorPicker.value = nextColor;
  var sizeSlider = document.getElementById('vpPlaneSizeSlider');
  if (sizeSlider) sizeSlider.value = String(nextSize);
  var sizeLabel = document.getElementById('vpPlaneSizeValue');
  if (sizeLabel) sizeLabel.textContent = `${nextSize} px`;
}
function initPlaneIconSettingsUi() {
  var defaults = getCurrentPlaneIconDefaults();
  var storedColor = normalizePlaneIconColor(localStorage.getItem(PLANE_ICON_COLOR_KEY));
  var storedSize = normalizePlaneIconSize(localStorage.getItem(PLANE_ICON_SIZE_KEY));
  applyPlaneIconSettings({
    color: storedColor || defaults.color,
    size: storedSize || defaults.size
  });
  var colorPicker = document.getElementById('vpPlaneColorPicker');
  if (colorPicker && !colorPicker.dataset.boundPlaneIcon) {
    colorPicker.dataset.boundPlaneIcon = '1';
    colorPicker.addEventListener('input', e => {
      applyPlaneIconSettings({
        color: e.target.value,
        persist: true
      });
    });
  }
  var sizeSlider = document.getElementById('vpPlaneSizeSlider');
  if (sizeSlider && !sizeSlider.dataset.boundPlaneIcon) {
    sizeSlider.dataset.boundPlaneIcon = '1';
    sizeSlider.addEventListener('input', e => {
      applyPlaneIconSettings({
        size: e.target.value,
        persist: true
      });
    });
  }
}
function toggleVpPlaneIconMenu(e) {
  if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
  var menu = document.getElementById('vpPlaneIconMenu');
  var btn = document.getElementById('btnTogglePlaneIconMenu');
  if (!menu || !btn) return;
  var open = menu.style.display === 'block';
  menu.style.display = open ? 'none' : 'block';
  btn.classList.toggle('active', !open);
}
document.addEventListener('click', e => {
  var menu = document.getElementById('mapHintsMenu');
  if (!menu || menu.style.display !== 'block') return;
  var t = e.target;
  if (t && t.closest && (t.closest('#mapHintsMenu') || t.closest('#mapHintsBtn'))) return;
  window.toggleMapHintsMenu(false);
}, true);

// Original route leg labels: angle, size, distance and planned-speed duration.
var routeLegLabelMarkers = [];
var ROUTE_LEG_LABEL_MODE_KEY = 'ga_route_leg_label_mode';
var ROUTE_LEG_LABEL_MODES = ['distance', 'duration', 'both'];
var routeLegLabelMode = ROUTE_LEG_LABEL_MODES.includes(localStorage.getItem(ROUTE_LEG_LABEL_MODE_KEY)) ? localStorage.getItem(ROUTE_LEG_LABEL_MODE_KEY) : 'distance';
function ensureRouteLegLabelPane() {
  if (!map) return;
  if (map.getPane('routeLegLabelPane')) return;
  var pane = map.createPane('routeLegLabelPane');
  pane.style.zIndex = '350'; // Unter der Route (Overlay-Pane ~400)
  pane.style.pointerEvents = 'none';
}
function clearRouteLegLabels() {
  if (!map || !routeLegLabelMarkers.length) return;
  routeLegLabelMarkers.forEach(m => map.removeLayer(m));
  routeLegLabelMarkers = [];
}
function getLegScreenAngle(p1, p2) {
  var a = map.latLngToLayerPoint([p1.lat, p1.lng || p1.lon]);
  var b = map.latLngToLayerPoint([p2.lat, p2.lng || p2.lon]);
  var angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return angle;
}
function formatNm(value) {
  var n = Number(value);
  if (!Number.isFinite(n)) return '0.0';
  return (Math.round(n * 10) / 10).toFixed(1);
}
function formatLegDurationMinutes(distNm) {
  var speedKts = Math.max(1, getTasForRouteEstimate());
  var dist = Number(distNm);
  if (!Number.isFinite(dist) || dist <= 0) return '0 min';
  var minutes = Math.max(1, Math.round(dist / speedKts * 60));
  return `${minutes} min`;
}
function getRouteLegLabelDetail(nav) {
  var distText = `${formatNm(nav.dist)} NM`;
  var durationText = formatLegDurationMinutes(nav.dist);
  if (routeLegLabelMode === 'duration') return durationText;
  if (routeLegLabelMode === 'both') return `${distText} / ${durationText}`;
  return distText;
}
function getRouteLegLabelWidthPx(detailText, fontSize) {
  var minWidth = routeLegLabelMode === 'both' ? 108 : 68;
  var textWidth = Math.ceil(String(detailText || '').length * fontSize * 0.62) + 18;
  return Math.max(minWidth, textWidth);
}
function updateRouteLegLabelModeButton() {
  var btn = document.getElementById('routeLegLabelModeBtn');
  if (!btn) return;
  var labels = {
    distance: 'Distanz',
    duration: 'Dauer',
    both: 'Distanz + Dauer'
  };
  btn.textContent = `📏 Legs: ${labels[routeLegLabelMode] || labels.distance}`;
  btn.title = 'Leg-Anzeige wechseln: Distanz, Dauer oder beides. Dauer basiert auf dem Speed-Setting im Hauptmenü.';
}
window.cycleRouteLegLabelMode = function () {
  var currentIdx = ROUTE_LEG_LABEL_MODES.indexOf(routeLegLabelMode);
  routeLegLabelMode = ROUTE_LEG_LABEL_MODES[(currentIdx + 1) % ROUTE_LEG_LABEL_MODES.length] || 'distance';
  localStorage.setItem(ROUTE_LEG_LABEL_MODE_KEY, routeLegLabelMode);
  updateRouteLegLabelModeButton();
  renderRouteLegLabels();
};
function renderRouteLegLabels() {
  clearRouteLegLabels();
  if (!map || !routeWaypoints || routeWaypoints.length < 2) return;
  ensureRouteLegLabelPane();
  var zoom = map.getZoom ? map.getZoom() : 10;
  var fontSize = Math.max(9, Math.min(14, Math.round(9 + (zoom - 6) / 7 * 5)));
  var gap = Math.max(7, Math.round(fontSize * 0.4) + 4);
  for (var i = 0; i < routeWaypoints.length - 1; i++) {
    var p1 = routeWaypoints[i];
    var p2 = routeWaypoints[i + 1];
    if (!routeLegShouldRenderOnMainMap(p1, p2)) continue;
    var nav = calcNav(p1.lat, p1.lng || p1.lon, p2.lat, p2.lng || p2.lon);
    var midLat = (p1.lat + p2.lat) / 2;
    var midLng = ((p1.lng || p1.lon) + (p2.lng || p2.lon)) / 2;
    var angle = getLegScreenAngle(p1, p2).toFixed(1);
    var detailText = getRouteLegLabelDetail(nav);
    var labelWidth = getRouteLegLabelWidthPx(detailText, fontSize);
    var html = `
            <div class="route-leg-label" style="transform: translate(-50%, -50%) rotate(${angle}deg); --leg-fz:${fontSize}px; --leg-gap:${gap}px; --leg-w:${labelWidth}px;">
                <div class="route-leg-course">${nav.brng}°</div>
                <div class="route-leg-detail">${detailText}</div>
            </div>
        `;
    var labelIcon = L.divIcon({
      className: 'route-leg-label-icon',
      html,
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });
    var marker = L.marker([midLat, midLng], {
      icon: labelIcon,
      interactive: false,
      pane: 'routeLegLabelPane'
    }).addTo(map);
    routeLegLabelMarkers.push(marker);
  }
}
function routeLegShouldRenderOnMainMap() {
  var p1 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
  var p2 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
  var hasPoiChain = !!(typeof currentMissionData !== 'undefined' && currentMissionData && currentMissionData.poiChain);
  if (!hasPoiChain) return true;
  return true;
}
function getTasForRouteEstimate() {
  var _document$getElementB;
  if (window.gaProfileDataProvider && Number.isFinite(window.gaProfileDataProvider.tasKts)) return window.gaProfileDataProvider.tasKts;
  return parseInt(((_document$getElementB = document.getElementById('tasSlider')) === null || _document$getElementB === void 0 ? void 0 : _document$getElementB.value) || 160, 10) || 160;
}
