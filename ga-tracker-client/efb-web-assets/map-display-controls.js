// Generated from map-display-controls.js by sync-efb-web-assets.js. Do not edit.
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
// One viewport veil avoids CSS filters changing fixed positioning or map rendering.
// It is a root sibling of the scaled EFB body, so UI scale cannot crop it.
var DISPLAY_BRIGHTNESS_KEY = 'ga_display_brightness';
function normalizeDisplayBrightness(value) {
  var n = Number(value);
  return value === null || value === '' || !Number.isFinite(n) ? 100 : Math.max(20, Math.min(100, Math.round(n)));
}
function initDisplayBrightness() {
  var veil = document.getElementById('gaDisplayDimmer');
  if (!veil) {
    veil = document.createElement('div');
    veil.id = 'gaDisplayDimmer';
    veil.setAttribute('aria-hidden', 'true');
    veil.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#000;pointer-events:none;z-index:2147483647;';
    document.documentElement.appendChild(veil);
  }
  var saved = null;
  try {
    saved = localStorage.getItem(DISPLAY_BRIGHTNESS_KEY);
  } catch (_) {}
  window.setDisplayBrightness(saved, false);
}
window.setDisplayBrightness = function (value) {
  var persist = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  var brightness = normalizeDisplayBrightness(value);
  var veil = document.getElementById('gaDisplayDimmer');
  if (veil) veil.style.opacity = String(1 - brightness / 100);
  var slider = document.getElementById('displayBrightnessSlider');
  var output = document.getElementById('displayBrightnessValue');
  if (slider) slider.value = String(brightness);
  if (output) output.textContent = brightness + ' %';
  if (persist) {
    try {
      localStorage.setItem(DISPLAY_BRIGHTNESS_KEY, String(brightness));
    } catch (_) {}
  }
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDisplayBrightness);else initDisplayBrightness();

// Original standalone display menu and aircraft settings, shared with the EFB.
var MAP_HINT_DEFAULTS = {
  magentaLine: true,
  weather: true,
  windBarbs: true,
  cloudFields: true,
  vfrIndex: false,
  terrainAvoid: false,
  traffic: true,
  favoriteAirports: true,
  autoZoom: false,
  zoomControl: false,
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

// UI language (i18n-core.js, web only). In the EFB there is no GAI18n: the German text is used.
function _mdcText(key, german, vars) {
  if (typeof window !== 'undefined' && window.GAI18n) return window.GAI18n.t(key, vars, german);
  return String(german).replace(/\{([a-zA-Z0-9_]+)\}/g, (m, n) => vars && Object.prototype.hasOwnProperty.call(vars, n) ? String(vars[n]) : m);
}
function _mdcOnOff(on) {
  return on ? _mdcText('map.on', 'An') : _mdcText('map.off', 'Aus');
}
function _mdcSingleClickLabel(mode) {
  return _mdcText(`map.singleClick.${mode}`, MAP_SINGLE_CLICK_MODE_LABELS[mode]);
}
window.mapHints = window.mapHints || _objectSpread({}, MAP_HINT_DEFAULTS);
Object.keys(MAP_HINT_DEFAULTS).forEach(key => {
  if (!(key in window.mapHints)) window.mapHints[key] = MAP_HINT_DEFAULTS[key];
});
var MAP_HINT_SUBMENU_DEFAULTS = {
  weatherMenu: false,
  vfrIndexMenu: false,
  terrainAvoidMenu: false,
  infoWindowsMenu: false,
  clockMenu: false
};
window.mapHintSubmenus = window.mapHintSubmenus || _objectSpread({}, MAP_HINT_SUBMENU_DEFAULTS);
function loadMapHintSettings() {
  Object.keys(MAP_HINT_DEFAULTS).forEach(key => {
    var saved = null;
    try {
      saved = localStorage.getItem(`ga_map_hint_${key}`);
    } catch (_) {}
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
  try {
    localStorage.setItem(`ga_map_hint_${key}`, String(Boolean(window.mapHints[key])));
  } catch (_) {}
  if (window.gaPersistMapHintSetting) window.gaPersistMapHintSetting(key, Boolean(window.mapHints[key]));
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
    },
    infoWindowsMenu: {
      btn: 'btnToggleInfoWindowsMenu',
      panel: 'infoWindowsMenuBlock',
      label: 'Info Fenster'
    },
    clockMenu: {
      btn: 'btnToggleClockMenu',
      panel: 'clockMenuBlock',
      label: 'Zeit'
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
    btn.textContent = isOpen ? '▾' : '▸';
    btn.classList.toggle('active', isOpen);
    btn.setAttribute('aria-expanded', String(isOpen));
  }
}
function closeAllMapHintSubmenus() {
  Object.keys(MAP_HINT_SUBMENU_DEFAULTS).forEach(k => setMapHintSubmenuOpen(k, false));
}
function positionMapHintsMenuInViewport() {
  var menu = document.getElementById('mapHintsMenu');
  var btn = document.getElementById('mapHintsBtn');
  if (!menu || !btn || menu.style.display !== 'block') return;
  var openInViewport = typeof window._positionFloatingMenuInViewport === 'function' ? window._positionFloatingMenuInViewport : typeof window._openFloatingMenuInViewport === 'function' ? window._openFloatingMenuInViewport : typeof _openFloatingMenuInViewport === 'function' ? _openFloatingMenuInViewport : null;
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
  document.body.classList.toggle('map-drag-zoom-enabled', window.mapHints.zoomControl === true);
  var labels = {
    magentaLine: '🟣 Direkt-Linie',
    weather: '🌤️ Wetter',
    windBarbs: '🪁 Windbarben',
    cloudFields: '☁️ Wolkenfelder',
    vfrIndex: '🧭 VFR-Index',
    terrainAvoid: '🏔️ Terrain Avoid',
    traffic: '✈️ Traffic',
    favoriteAirports: '⭐ Favoriten',
    autoZoom: '🔍 Autozoom',
    zoomControl: '🔎 Zoomsteuerung',
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
    favoriteAirports: 'hintToggleFavoriteAirports',
    autoZoom: 'hintToggleAutoZoom',
    zoomControl: 'hintToggleZoomControl',
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
    btn.textContent = `${_mdcText(`map.hint.${key}`, labels[key])} (${_mdcOnOff(on)})`;
    btn.style.background = on ? '#2E8B57' : '#444';
    btn.style.color = '#fff';
  });
  var singleClickButton = document.getElementById('hintToggleAirportSingleClick');
  if (singleClickButton) {
    var singleClickMode = getMapSingleClickMode();
    singleClickButton.textContent = _mdcText('map.singleClick.button', '🛩️ Einzelklick: {mode}', {
      mode: _mdcSingleClickLabel(singleClickMode)
    });
    singleClickButton.style.background = singleClickMode === 'panels' ? '#2E8B57' : singleClickMode === 'tooltip' ? '#8a6717' : '#444';
    singleClickButton.style.color = '#fff';
    singleClickButton.setAttribute('aria-label', _mdcText('map.singleClick.aria', 'Einzelklick für Flugplätze, VRPs und Navaids: {mode}', {
      mode: _mdcSingleClickLabel(singleClickMode)
    }));
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
  if (key === 'zoomControl') window.dispatchEvent(new Event('ga-map-zoom-control-changed'));
  if (key === 'favoriteAirports' && typeof window.gaRenderFavoriteAirportStars === 'function') window.gaRenderFavoriteAirportStars();
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
      var open = window._openFloatingMenuInViewport;
      if (typeof open === 'function') open(menu, btn, false);else {
        menu.style.display = 'block';
        positionMapHintsMenuInViewport();
      }
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
    var trafficMenu = document.getElementById('vpTrafficIconMenu');
    if (trafficMenu) trafficMenu.style.display = 'none';
    var trafficBtn = document.getElementById('btnToggleTrafficIconMenu');
    if (trafficBtn) trafficBtn.classList.remove('active');
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
var PLANE_ICON_KIND_KEY = 'ga_plane_icon_kind';
var PLANE_ICON_KINDS = ['classic', 'single', 'twin', 'jet', 'heavy', 'heli'];
var PLANE_ICON_KIND_LABELS = {
  classic: 'Klassik',
  single: '1-mot',
  twin: '2-mot',
  jet: 'Jet',
  heavy: 'Heavy',
  heli: 'Heli'
};
function normalizePlaneIconKind(value) {
  return PLANE_ICON_KINDS.includes(value) ? value : null;
}
function readGlobalPlaneIcon() {
  var color = null,
    size = null,
    kind = null;
  try {
    color = normalizePlaneIconColor(localStorage.getItem(PLANE_ICON_COLOR_KEY));
    size = normalizePlaneIconSize(localStorage.getItem(PLANE_ICON_SIZE_KEY));
    kind = normalizePlaneIconKind(localStorage.getItem(PLANE_ICON_KIND_KEY));
  } catch (_) {}
  return {
    color: color || PLANE_ICON_DEFAULT_COLOR,
    size: size || PLANE_ICON_DEFAULT_SIZE,
    kind: kind || 'classic'
  };
}
window.getGlobalPlaneIcon = readGlobalPlaneIcon;

// The aircraft profile (preset) may bring its own icon. app.js provides it:
// window.gaActivePlaneIconProfile() -> { id, name, icon: { custom, kind, color, size } } | null
function activePlaneIconProfile() {
  try {
    var profile = typeof window.gaActivePlaneIconProfile === 'function' ? window.gaActivePlaneIconProfile() : null;
    return profile && profile.icon && profile.icon.custom === true ? profile : null;
  } catch (_) {
    return null;
  }
}

// Icon, colour and size that apply right now, and where they come from.
window.getOwnPlaneIcon = function () {
  var global = readGlobalPlaneIcon();
  var profile = activePlaneIconProfile();
  if (!profile) return _objectSpread(_objectSpread({}, global), {}, {
    source: 'global'
  });
  return {
    color: normalizePlaneIconColor(profile.icon.color) || global.color,
    size: normalizePlaneIconSize(profile.icon.size) || global.size,
    kind: normalizePlaneIconKind(profile.icon.kind) || global.kind,
    source: 'profile',
    profileId: profile.id,
    profileName: profile.name
  };
};
var appliedPlaneIconKind = null;
function renderPlaneIconUi(icon) {
  var colorPicker = document.getElementById('vpPlaneColorPicker');
  if (colorPicker && colorPicker.value !== icon.color) colorPicker.value = icon.color;
  var sizeSlider = document.getElementById('vpPlaneSizeSlider');
  if (sizeSlider) sizeSlider.value = String(icon.size);
  var sizeLabel = document.getElementById('vpPlaneSizeValue');
  if (sizeLabel) sizeLabel.textContent = `${icon.size} px`;
  document.querySelectorAll('#vpPlaneKindOptions [data-plane-kind]').forEach(btn => {
    var active = btn.dataset.planeKind === icon.kind;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  var source = document.getElementById('vpPlaneIconSource');
  if (source) {
    var _window$GAI18n, _window$GAI18n2, _window$GAI18n3, _window$GAI18n3$phras, _window$GAI18n4, _window$GAI18n4$phras;
    var text = icon.source === 'profile' ? (typeof ((_window$GAI18n = window.GAI18n) === null || _window$GAI18n === void 0 ? void 0 : _window$GAI18n.phrase) === 'function' ? window.GAI18n.phrase('Profil-Icon') : 'Profil-Icon') + ` · ${icon.profileName || ''}` : typeof ((_window$GAI18n2 = window.GAI18n) === null || _window$GAI18n2 === void 0 ? void 0 : _window$GAI18n2.phrase) === 'function' ? window.GAI18n.phrase('Globales Icon') : 'Globales Icon';
    source.textContent = text;
    source.dataset.source = icon.source;
    source.title = icon.source === 'profile' ? ((_window$GAI18n3 = window.GAI18n) === null || _window$GAI18n3 === void 0 || (_window$GAI18n3$phras = _window$GAI18n3.phrase) === null || _window$GAI18n3$phras === void 0 ? void 0 : _window$GAI18n3$phras.call(_window$GAI18n3, 'Änderungen werden im Flugzeug-Profil gespeichert.')) || 'Änderungen werden im Flugzeug-Profil gespeichert.' : ((_window$GAI18n4 = window.GAI18n) === null || _window$GAI18n4 === void 0 || (_window$GAI18n4$phras = _window$GAI18n4.phrase) === null || _window$GAI18n4$phras === void 0 ? void 0 : _window$GAI18n4$phras.call(_window$GAI18n4, 'Gilt für alle Profile ohne eigenes Icon.')) || 'Gilt für alle Profile ohne eigenes Icon.';
  }
}

// Apply the icon that applies right now (call after a profile change).
window.applyOwnPlaneIcon = function () {
  var icon = window.getOwnPlaneIcon();
  document.documentElement.style.setProperty('--plane-color', icon.color);
  document.documentElement.style.setProperty('--plane-size', `${icon.size}px`);
  window.gaOwnPlaneIconKind = icon.kind;
  renderPlaneIconUi(icon);
  if (appliedPlaneIconKind !== icon.kind) {
    appliedPlaneIconKind = icon.kind;
    if (typeof window.refreshOwnPlaneIcon === 'function') window.refreshOwnPlaneIcon();
  }
  window.vpBgNeedsUpdate = true;
  return icon;
};

// Changes from the map menu go to the profile when it uses its own icon,
// otherwise to the global setting.
function applyPlaneIconSettings() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
    color = _ref.color,
    size = _ref.size,
    kind = _ref.kind,
    _ref$persist = _ref.persist,
    persist = _ref$persist === void 0 ? false : _ref$persist;
  var patch = {};
  if (normalizePlaneIconColor(color)) patch.color = normalizePlaneIconColor(color);
  if (normalizePlaneIconSize(size)) patch.size = normalizePlaneIconSize(size);
  if (normalizePlaneIconKind(kind)) patch.kind = normalizePlaneIconKind(kind);
  if (persist && Object.keys(patch).length) {
    var profile = activePlaneIconProfile();
    if (profile && typeof window.gaSavePlaneIconProfile === 'function') {
      window.gaSavePlaneIconProfile(profile.id, patch);
    } else {
      try {
        if (patch.color) localStorage.setItem(PLANE_ICON_COLOR_KEY, patch.color);
        if (patch.size) localStorage.setItem(PLANE_ICON_SIZE_KEY, String(patch.size));
        if (patch.kind) localStorage.setItem(PLANE_ICON_KIND_KEY, patch.kind);
      } catch (_) {}
    }
  }
  return window.applyOwnPlaneIcon();
}
function buildPlaneKindOptions() {
  var box = document.getElementById('vpPlaneKindOptions');
  var pres = window.GAMapLivePresentation;
  if (!box || box.dataset.built === '1' || !pres || typeof pres.aircraftHtml !== 'function') return;
  box.dataset.built = '1';
  box.innerHTML = PLANE_ICON_KINDS.map(kind => {
    var _window$GAI18n5, _window$GAI18n5$phras;
    var label = ((_window$GAI18n5 = window.GAI18n) === null || _window$GAI18n5 === void 0 || (_window$GAI18n5$phras = _window$GAI18n5.phrase) === null || _window$GAI18n5$phras === void 0 ? void 0 : _window$GAI18n5$phras.call(_window$GAI18n5, PLANE_ICON_KIND_LABELS[kind])) || PLANE_ICON_KIND_LABELS[kind];
    return `<button type="button" class="vp-plane-kind" data-plane-kind="${kind}" aria-pressed="false" title="${label}">` + `<span class="vp-plane-kind-preview" style="--plane-size:26px">${pres.aircraftHtml(kind)}</span>` + `<span class="vp-plane-kind-label">${label}</span></button>`;
  }).join('');
  box.querySelectorAll('[data-plane-kind]').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation();
    applyPlaneIconSettings({
      kind: btn.dataset.planeKind,
      persist: true
    });
  }));
}
function initPlaneIconSettingsUi() {
  buildPlaneKindOptions();
  window.applyOwnPlaneIcon();
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
  initTrafficIconSettingsUi();
  initIconShadowSettingsUi();
}

// Traffic icons: size and black outline, shown next to the aircraft icon menu.
var TRAFFIC_ICON_SIZE_KEY = 'ga_traffic_icon_size';
var TRAFFIC_ICON_OUTLINE_KEY = 'ga_traffic_icon_outline';
var TRAFFIC_ICON_DEFAULT_SIZE = 28;
var TRAFFIC_ICON_DEFAULT_OUTLINE = 1.5;
var TRAFFIC_ICON_MIN_SIZE = 16;
var TRAFFIC_ICON_MAX_SIZE = 56;
var TRAFFIC_ICON_MAX_OUTLINE = 3;
var trafficIconSettings = {
  size: TRAFFIC_ICON_DEFAULT_SIZE,
  outline: TRAFFIC_ICON_DEFAULT_OUTLINE
};
function normalizeTrafficIconSize(value) {
  var n = parseInt(value, 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(TRAFFIC_ICON_MAX_SIZE, Math.max(TRAFFIC_ICON_MIN_SIZE, n));
}
function normalizeTrafficIconOutline(value) {
  if (value === null || value === undefined || value === '') return null;
  var n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(TRAFFIC_ICON_MAX_OUTLINE, Math.max(0, Math.round(n * 2) / 2));
}
window.getTrafficIconSettings = function () {
  return {
    size: trafficIconSettings.size,
    outline: trafficIconSettings.outline
  };
};
function applyTrafficIconSettings() {
  var _normalizeTrafficIcon, _normalizeTrafficIcon2;
  var _ref2 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
    size = _ref2.size,
    outline = _ref2.outline,
    _ref2$persist = _ref2.persist,
    persist = _ref2$persist === void 0 ? false : _ref2$persist;
  var nextSize = (_normalizeTrafficIcon = normalizeTrafficIconSize(size)) !== null && _normalizeTrafficIcon !== void 0 ? _normalizeTrafficIcon : trafficIconSettings.size;
  var nextOutline = (_normalizeTrafficIcon2 = normalizeTrafficIconOutline(outline)) !== null && _normalizeTrafficIcon2 !== void 0 ? _normalizeTrafficIcon2 : trafficIconSettings.outline;
  var changed = nextSize !== trafficIconSettings.size || nextOutline !== trafficIconSettings.outline;
  trafficIconSettings = {
    size: nextSize,
    outline: nextOutline
  };
  if (persist) {
    try {
      localStorage.setItem(TRAFFIC_ICON_SIZE_KEY, String(nextSize));
      localStorage.setItem(TRAFFIC_ICON_OUTLINE_KEY, String(nextOutline));
    } catch (_) {}
  }
  var sizeSlider = document.getElementById('vpTrafficSizeSlider');
  if (sizeSlider) sizeSlider.value = String(nextSize);
  var sizeLabel = document.getElementById('vpTrafficSizeValue');
  if (sizeLabel) sizeLabel.textContent = `${nextSize} px`;
  var outlineSlider = document.getElementById('vpTrafficOutlineSlider');
  if (outlineSlider) outlineSlider.value = String(nextOutline);
  var outlineLabel = document.getElementById('vpTrafficOutlineValue');
  if (outlineLabel) outlineLabel.textContent = `${nextOutline.toFixed(1)} px`;
  if (changed && typeof window.refreshTrafficIcons === 'function') window.refreshTrafficIcons();
}
function initTrafficIconSettingsUi() {
  var storedSize = null,
    storedOutline = null;
  try {
    storedSize = normalizeTrafficIconSize(localStorage.getItem(TRAFFIC_ICON_SIZE_KEY));
    storedOutline = normalizeTrafficIconOutline(localStorage.getItem(TRAFFIC_ICON_OUTLINE_KEY));
  } catch (_) {}
  applyTrafficIconSettings({
    size: storedSize !== null && storedSize !== void 0 ? storedSize : TRAFFIC_ICON_DEFAULT_SIZE,
    outline: storedOutline !== null && storedOutline !== void 0 ? storedOutline : TRAFFIC_ICON_DEFAULT_OUTLINE
  });
  var sizeSlider = document.getElementById('vpTrafficSizeSlider');
  if (sizeSlider && !sizeSlider.dataset.boundTrafficIcon) {
    sizeSlider.dataset.boundTrafficIcon = '1';
    sizeSlider.addEventListener('input', e => applyTrafficIconSettings({
      size: e.target.value,
      persist: true
    }));
  }
  var outlineSlider = document.getElementById('vpTrafficOutlineSlider');
  if (outlineSlider && !outlineSlider.dataset.boundTrafficIcon) {
    outlineSlider.dataset.boundTrafficIcon = '1';
    outlineSlider.addEventListener('input', e => applyTrafficIconSettings({
      outline: e.target.value,
      persist: true
    }));
  }
}

// Shadow of the aircraft icons (own and traffic): on/off, darkest value, sharpness.
var ICON_SHADOW_KEY = 'ga_icon_shadow_v2'; // slider positions, 0.5 = calibrated default
var ICON_SHADOW_DEFAULT = {
  on: true,
  dark: 0.5,
  sharp: 0.5,
  reach: 0.5
};
var iconShadowSettings = _objectSpread({}, ICON_SHADOW_DEFAULT);
function normalizeIconShadow(value) {
  var v = value && typeof value === 'object' ? value : {};
  var unit = (n, d) => Number.isFinite(Number(n)) ? Math.min(1, Math.max(0, Math.round(Number(n) * 100) / 100)) : d;
  return {
    on: v.on !== false,
    dark: unit(v.dark, ICON_SHADOW_DEFAULT.dark),
    sharp: unit(v.sharp, ICON_SHADOW_DEFAULT.sharp),
    reach: unit(v.reach, ICON_SHADOW_DEFAULT.reach)
  };
}
window.getIconShadowSettings = function () {
  return _objectSpread({}, iconShadowSettings);
};
function applyIconShadowSettings() {
  var patch = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var persist = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  iconShadowSettings = normalizeIconShadow(_objectSpread(_objectSpread({}, iconShadowSettings), patch));
  if (persist) {
    try {
      localStorage.setItem(ICON_SHADOW_KEY, JSON.stringify(iconShadowSettings));
    } catch (_) {}
  }
  var on = document.getElementById('vpIconShadowCheck');
  if (on) on.checked = iconShadowSettings.on;
  var dark = document.getElementById('vpIconShadowDark');
  if (dark) {
    dark.value = String(Math.round(iconShadowSettings.dark * 100));
    dark.disabled = !iconShadowSettings.on;
  }
  var darkLabel = document.getElementById('vpIconShadowDarkValue');
  if (darkLabel) darkLabel.textContent = `${Math.round(iconShadowSettings.dark * 100)} %`;
  var sharp = document.getElementById('vpIconShadowSharp');
  if (sharp) {
    sharp.value = String(Math.round(iconShadowSettings.sharp * 100));
    sharp.disabled = !iconShadowSettings.on;
  }
  var sharpLabel = document.getElementById('vpIconShadowSharpValue');
  if (sharpLabel) sharpLabel.textContent = `${Math.round(iconShadowSettings.sharp * 100)} %`;
  var reach = document.getElementById('vpIconShadowReach');
  if (reach) {
    reach.value = String(Math.round(iconShadowSettings.reach * 100));
    reach.disabled = !iconShadowSettings.on;
  }
  var reachLabel = document.getElementById('vpIconShadowReachValue');
  if (reachLabel) reachLabel.textContent = `${Math.round(iconShadowSettings.reach * 100)} %`;
  if (typeof window.refreshOwnPlaneShadow === 'function') window.refreshOwnPlaneShadow();
  if (typeof window.refreshTrafficIcons === 'function') window.refreshTrafficIcons();
}
function initIconShadowSettingsUi() {
  var stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(ICON_SHADOW_KEY) || 'null');
  } catch (_) {}
  applyIconShadowSettings(stored || {});
  var on = document.getElementById('vpIconShadowCheck');
  if (on && !on.dataset.boundShadow) {
    on.dataset.boundShadow = '1';
    on.addEventListener('change', e => applyIconShadowSettings({
      on: e.target.checked
    }, true));
  }
  var _loop = function _loop() {
    var _arr$_i = _slicedToArray(_arr[_i], 2),
      id = _arr$_i[0],
      key = _arr$_i[1];
    var input = document.getElementById(id);
    if (input && !input.dataset.boundShadow) {
      input.dataset.boundShadow = '1';
      input.addEventListener('input', e => applyIconShadowSettings({
        [key]: Number(e.target.value) / 100
      }, true));
    }
  };
  for (var _i = 0, _arr = [['vpIconShadowDark', 'dark'], ['vpIconShadowSharp', 'sharp'], ['vpIconShadowReach', 'reach']]; _i < _arr.length; _i++) {
    _loop();
  }
}
function toggleVpTrafficIconMenu(e) {
  if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
  var menu = document.getElementById('vpTrafficIconMenu');
  var btn = document.getElementById('btnToggleTrafficIconMenu');
  if (!menu || !btn) return;
  var open = menu.style.display === 'block';
  menu.style.display = open ? 'none' : 'block';
  btn.classList.toggle('active', !open);
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
  var mode = labels[routeLegLabelMode] ? routeLegLabelMode : 'distance';
  btn.textContent = _mdcText('map.legs.button', '📏 Legs: {mode}', {
    mode: _mdcText(`map.legs.${mode}`, labels[mode])
  });
  btn.title = _mdcText('map.legs.title', 'Leg-Anzeige wechseln: Distanz, Dauer oder beides. Dauer basiert auf dem Speed-Setting im Hauptmenü.');
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

// Language switch (web): redraw the menu labels. Display only.
if (typeof window !== 'undefined' && window.GAI18n && typeof window.GAI18n.onChange === 'function') {
  window.GAI18n.onChange(() => {
    try {
      refreshMapHintMenuUi();
    } catch (_) {}
    try {
      updateRouteLegLabelModeButton();
    } catch (_) {}
  });
}
