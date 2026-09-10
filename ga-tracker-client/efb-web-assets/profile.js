// Generated from profile.js by sync-efb-web-assets.js. Do not edit.
var _ref34, _localStorage$getItem, _ref35, _localStorage$getItem2, _ref36, _localStorage$getItem3;
function _regeneratorValues(e) { if (null != e) { var t = e["function" == typeof Symbol && Symbol.iterator || "@@iterator"], r = 0; if (t) return t.call(e); if ("function" == typeof e.next) return e; if (!isNaN(e.length)) return { next: function next() { return e && r >= e.length && (e = void 0), { value: e && e[r++], done: !e }; } }; } throw new TypeError(typeof e + " is not iterable"); }
function _regeneratorKeys(e) { var n = Object(e), r = []; for (var t in n) r.unshift(t); return function e() { for (; r.length;) if ((t = r.pop()) in n) return e.value = t, e.done = !1, e; return e.done = !0, e; }; }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i.return) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function gaEfbProfileFont(value) {
  return value.replace(/(\d+(?:\.\d+)?px)\s+(.+)$/, function (_, size, family) {
    return size + ' ' + family.split(',')[0];
  });
}
/* === VERTICAL PROFILE & CANVAS ENGINE (v220) === */
// Both clients run this engine. The EFB supplies only local data transport;
// geometry, weather parsing, drawing and controls remain the standalone code.
function vpCreateAbortController() {
  return window.gaProfileDataProvider ? window.gaProfileDataProvider.createAbortController() : new AbortController();
}
function vpGetProfileTas() {
  var _document$getElementB;
  return window.gaProfileDataProvider ? window.gaProfileDataProvider.tasKts || 115 : parseInt(((_document$getElementB = document.getElementById('tasSlider')) === null || _document$getElementB === void 0 ? void 0 : _document$getElementB.value) || 115);
}
function vpFetchResource(url, options) {
  return window.gaProfileDataProvider ? window.gaProfileDataProvider.fetch(url, options) : fetch(url, options);
}
if (!document.getElementById('vp-err-dot-style')) {
  var style = document.createElement('style');
  style.id = 'vp-err-dot-style';
  style.innerHTML = `.vp-error-dot { position:absolute; top:-4px; right:-4px; width:10px; height:10px; background-color:#ff4444; border-radius:50%; border:1.5px solid #222; z-index:10; box-shadow: 0 0 4px #ff0000; } .vp-btn-relative { position:relative; overflow:visible !important; }`;
  document.head.appendChild(style);
}
window.vpFailedOverpassChunks = [];
window.updateOverpassErrorUI = function () {
  var hasError = window.vpFailedOverpassChunks && window.vpFailedOverpassChunks.length > 0;

  // Error-Dot auf Einzel-Buttons (im Untermenü)
  var btnOb = document.getElementById('btnToggleObstacles');
  var btnLin = document.getElementById('btnToggleLinear');
  [btnOb, btnLin].forEach(btn => {
    if (!btn) return;
    btn.classList.add('vp-btn-relative');
    var dot = btn.querySelector('.vp-error-dot');
    if (hasError) {
      if (!dot) {
        dot = document.createElement('div');
        dot.className = 'vp-error-dot';
        btn.appendChild(dot);
      }
    } else {
      if (dot) dot.remove();
    }
  });

  // Error-Dot auch am Zahnrad-Button sichtbar machen
  var gearDot = document.getElementById('vpSettingsErrorDot');
  if (gearDot) gearDot.style.display = hasError ? 'block' : 'none';
};
window.vpBgNeedsUpdate = true;
window.vpAnimFrameId = null;
window.vpAnimFrameTimerId = null;
window.vpAnimFrameMeta = window.vpAnimFrameMeta || {
  lastPaintMs: 0,
  lastTargetFps: 0
};
window.vpProfilePanActive = false;
window._vpLastScrollLeft = 0;
window._vpProfileRenderTimer = null;
window.vpScheduleProfileRender = function () {
  var reason = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'profile';
  var delayMs = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 50;
  window.vpBgNeedsUpdate = true;
  if (window.gaDebugPush) window.gaDebugPush('profile-render', '[Profile] render scheduled', {
    reason: String(reason || ''),
    delayMs: Number(delayMs || 0)
  });
  if (window._vpProfileRenderTimer) clearTimeout(window._vpProfileRenderTimer);
  window._vpProfileRenderTimer = setTimeout(() => {
    window._vpProfileRenderTimer = null;
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
  }, Math.max(0, Number(delayMs || 0)));
};
window.vpProfilePerfWarn = function (label, t0) {
  var extra = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
  var warnMs = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 120;
  var now = performance && performance.now ? performance.now() : Date.now();
  var durationMs = Math.round((now - Number(t0 || now)) * 10) / 10;
  if (durationMs >= warnMs) {
    var payload = _objectSpread({
      durationMs
    }, extra || {});
    if (window.gaDebugPush) window.gaDebugPush(durationMs >= 250 ? 'perf-warn' : 'perf', `[PERF] ${label}`, payload);
    if (durationMs >= 250) console.warn('[PERF]', label, payload);
  }
  return durationMs;
};
function vpIsMapProfileFrameScheduled() {
  return !!(window.vpAnimFrameId || window.vpAnimFrameTimerId);
}
window.vpIsMapProfileFrameScheduled = vpIsMapProfileFrameScheduled;
function vpRequestMapProfileRaf() {
  if (window.vpAnimFrameId) return;
  window.vpAnimFrameId = requestAnimationFrame(timeMs => {
    window.vpAnimFrameId = null;
    renderMapProfileFrames(timeMs);
  });
}
function vpScheduleMapProfileFrame() {
  var delayMs = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
  if (window.vpAnimFrameId || window.vpAnimFrameTimerId) return;
  var delay = Math.max(0, Number(delayMs) || 0);
  if (delay <= 0) {
    vpRequestMapProfileRaf();
    return;
  }
  window.vpAnimFrameTimerId = setTimeout(() => {
    window.vpAnimFrameTimerId = null;
    vpRequestMapProfileRaf();
  }, delay);
}
function vpRequestMapProfileFrameNow() {
  if (window.vpAnimFrameTimerId) {
    clearTimeout(window.vpAnimFrameTimerId);
    window.vpAnimFrameTimerId = null;
  }
  vpRequestMapProfileRaf();
}
function vpStopMapProfileFrameLoop() {
  if (window.vpAnimFrameTimerId) clearTimeout(window.vpAnimFrameTimerId);
  window.vpAnimFrameTimerId = null;
  if (window.vpAnimFrameId) cancelAnimationFrame(window.vpAnimFrameId);
  window.vpAnimFrameId = null;
}
function vpScheduleNextMapProfileFrame(frameIntervalMs, lastPaintMs) {
  var now = performance && performance.now ? performance.now() : Date.now();
  var elapsedSincePaintMs = Math.max(0, now - (Number(lastPaintMs) || now));
  vpScheduleMapProfileFrame(Math.max(0, Number(frameIntervalMs || 0) - elapsedSincePaintMs));
}
/* =========================================================
   VERTICAL PROFILE (Höhenprofil) ENGINE
   ========================================================= */
var vpElevationData = null;
var vpWeatherData = null;
var vpProfileFastTimeout = null;
var vpProfileSlowTimeout = null;
var globalCities = null;
var globalCitiesLoadPromise = null;
function loadGlobalCities() {
  return _loadGlobalCities.apply(this, arguments);
}
function _loadGlobalCities() {
  _loadGlobalCities = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee10() {
    return _regenerator().w(function (_context10) {
      while (1) switch (_context10.p = _context10.n) {
        case 0:
          if (!Array.isArray(globalCities)) {
            _context10.n = 1;
            break;
          }
          return _context10.a(2);
        case 1:
          if (!globalCitiesLoadPromise) {
            _context10.n = 3;
            break;
          }
          _context10.n = 2;
          return globalCitiesLoadPromise;
        case 2:
          return _context10.a(2);
        case 3:
          globalCitiesLoadPromise = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee1() {
            var res, parsed, _t1;
            return _regenerator().w(function (_context1) {
              while (1) switch (_context1.p = _context1.n) {
                case 0:
                  if (!Array.isArray(window.GLOBAL_CITIES_DATA)) {
                    _context1.n = 1;
                    break;
                  }
                  globalCities = window.GLOBAL_CITIES_DATA;
                  return _context1.a(2);
                case 1:
                  _context1.p = 1;
                  _context1.n = 2;
                  return vpFetchResource('./cities.json', {
                    cache: 'default'
                  });
                case 2:
                  res = _context1.v;
                  if (!res.ok) {
                    _context1.n = 4;
                    break;
                  }
                  _context1.n = 3;
                  return res.json();
                case 3:
                  parsed = _context1.v;
                  globalCities = Array.isArray(parsed) ? parsed : [];
                  _context1.n = 5;
                  break;
                case 4:
                  globalCities = [];
                case 5:
                  _context1.n = 7;
                  break;
                case 6:
                  _context1.p = 6;
                  _t1 = _context1.v;
                  globalCities = [];
                case 7:
                  return _context1.a(2);
              }
            }, _callee1, null, [[1, 6]]);
          }))();
          _context10.p = 4;
          _context10.n = 5;
          return globalCitiesLoadPromise;
        case 5:
          _context10.p = 5;
          globalCitiesLoadPromise = null;
          return _context10.f(5);
        case 6:
          return _context10.a(2);
      }
    }, _callee10, null, [[4,, 5, 6]]);
  }));
  return _loadGlobalCities.apply(this, arguments);
}
var vpZoomLevel = 100; // 100 = full route, 10 = 10% view
var vpHighResData = null; // Higher resolution elevation data for zoom
var vpElevationCache = {}; // Cache to prevent API rate limits (HTTP 429)
var VP_ELEVATION_COOLDOWN_MS = 15 * 60 * 1000;
var vpClimbRate = 500; // ft/min climb rate (configurable)
var vpDescentRate = 500; // ft/min descent rate (configurable)
var vpLandmarks = [];
var vpObstacles = [];
var vpLinearFeatures = [];
var VP_LINEAR_ROUTE_CROSS_NM = 0.35;
var VP_PROFILE_OBS_LATERAL_MAX_NM = 0.5;
var VP_PROFILE_WIND_LATERAL_MAX_NM = 0.8;
var VP_PROFILE_LIN_LATERAL_MAX_NM = 0.6;
// Linear icon style in vertical profile:
// - 'r2f1'  => new road/river style (R2/F1)
// - 'legacy' => previous symbols for quick rollback
var VP_PROFILE_LINEAR_ICON_STYLE = 'r2f1';
var VP_DECLUTTER_COLLISION_PAD_PX = 0;
var VP_POWERLINE_MAST_LATERAL_NM = 0.8;
var VP_POWERLINE_MAST_MATCH_DIST_NM = 1.4;
window.vpElevationFallbackActive = false;
window.vpTerrainElevationSource = 'terrarium';
var VP_OVERPASS_SERVERS = ['https://overpass-api.de/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter', 'https://z.overpass-api.de/api/interpreter'];
var VP_OVERPASS_MIN_REQUERY_MS = 15 * 1000;
var VP_OVERPASS_BASE_COOLDOWN_MS = 15 * 1000;
var VP_OVERPASS_MAX_COOLDOWN_MS = 3 * 60 * 1000;
var VP_OVERPASS_TILE_FAIL_BASE_MS = 45 * 1000;
var VP_OVERPASS_TILE_FAIL_MAX_MS = 8 * 60 * 1000;
var VP_OVERPASS_STATE_STORAGE_KEY = 'ga_overpass_state_v1';
var VP_OBS_POOL_STORAGE_KEY = 'ga_obs_pool_v1';
var VP_OBS_POOL_MAX_OBS = 12000;
var VP_OBS_POOL_MAX_LIN = 60000;
var VP_OBS_POOL_TTL_MS = 0; // 0 = rolling cache ohne Zeitablauf
var VP_OBS_POOL_PERSIST_MAX_OBS = 2500;
var VP_OBS_POOL_PERSIST_MAX_LIN = 5000;
var VP_OBS_POOL_MAX_BYTES = 650000;
var VP_OBS_COMBO_PREFIX = 'ga_obs_combo_';
var VP_OBS_COMBO_MAX_ENTRIES = 8;
var VP_OBS_TILE_COVERAGE_KEY = 'ga_obs_tile_cov_v1';
var VP_OBS_TILE_EDGE_NM = 25;
var VP_OBS_TILE_STEP_LAT = VP_OBS_TILE_EDGE_NM / 60; // ~0.4167°
var VP_OBS_TILE_STEP_LON = VP_OBS_TILE_EDGE_NM / 60; // global fixer Raster-Schritt
var VP_OBS_TILE_TTL_MS = 0; // 0 = rolling cache ohne Zeitablauf
var VP_OBS_TILE_INTER_REQUEST_MS = 3200;
var VP_OBS_TILE_MAX_PER_PASS = 1;
var VP_OBS_TILE_MAX_PER_PASS_FORCE = 2;
var VP_OBS_TILE_INTER_REQUEST_LONG_MS = 4200;
var VP_OBS_TILE_DEFERRED_RETRY_MS = 5000;
var VP_OBS_HOSTED_PARALLELISM = 6;
var VP_OBS_HOSTED_MAX_PER_PASS = 36;
var VP_OBS_HOSTED_ENABLED = localStorage.getItem('ga_obs_hosted_enabled') !== 'false';
var VP_OBS_HOSTED_MISS_TTL_MS = 30 * 60 * 1000;
var VP_OBS_HOSTED_TIMEOUT_MS = 2200;
var VP_ROUTE_STATS_HEAVY_FEATURE_LIMIT = 14000;
var VP_OBS_HOSTED_ENDPOINTS = ['./obstacles/core-tiles/{latI}/{lonI}.json.gz', './obstacles/core-tiles/{latI}/{lonI}.json', './obstacles/tiles/{latI}/{lonI}.json', 'https://ga-proxy.einherjer.workers.dev/api/obstacles/tile'];
var VP_PROFILE_FPS_IDLE = 2;
var VP_PROFILE_FPS_ACTIVE = 12;
var VP_PROFILE_FPS_ACTIVE_LOW = 8;
var VP_PROFILE_FPS_INTERACT = 30;
var VP_PROFILE_FPS_INTERACT_LOW = 16;
var VP_OBS_TILE_FAILED_KEY = 'ga_obs_tile_failed_v1';
var VP_OBS_TILE_FAILED_MAX = 1200;
var vpOverpassStateHydrated = false;
var vpOverpassState = {
  cooldownUntil: 0,
  backoffLevel: 0,
  lastFailureAt: 0,
  lastFailureStatus: 0,
  lastSuccessAt: 0
};
window.vpOverpassInFlight = window.vpOverpassInFlight || new Map();
window.vpOverpassRouteLastSuccess = window.vpOverpassRouteLastSuccess || {};
window.vpOverpassGlobalInFlight = window.vpOverpassGlobalInFlight || null;
window.vpOverpassTileBackoff = window.vpOverpassTileBackoff || new Map();
var vpObsPoolHydrated = false;
var vpObsPoolPersistTimer = null;
var vpObsTileCoverageHydrated = false;
var vpObsTileCoveragePersistTimer = null;
var vpObsTileFailedHydrated = false;
var vpObsTileFailedPersistTimer = null;
var vpObsPool = {
  obs: new Map(),
  lin: new Map()
};
var vpObsPoolTileIndex = {
  obs: new Map(),
  lin: new Map()
};
function vpInferRoadKindFromText(ref, name) {
  var highwayTag = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';
  var txt = `${String(ref || '')} ${String(name || '')}`.toUpperCase();
  var hw = String(highwayTag || '').toLowerCase();
  if (/\bA\s*\d+\b/.test(txt) || hw === 'motorway' || hw === 'motorway_link') return 'motorway';
  if (/\bB\s*\d+\b/.test(txt) || hw === 'trunk' || hw === 'trunk_link' || hw === 'primary' || hw === 'primary_link') return 'bundesstrasse';
  return 'road_minor';
}
function vpLinearPriority(feat) {
  var t = String((feat === null || feat === void 0 ? void 0 : feat.type) || '').toLowerCase();
  var k = String((feat === null || feat === void 0 ? void 0 : feat.lineKind) || '').toLowerCase();
  if (t === 'highway') {
    if (k === 'motorway') return 80;
    if (k === 'bundesstrasse') return 68;
    return 58;
  }
  if (t === 'river') return 62;
  if (t === 'powerline') {
    if (k === 'line') return 40;
    if (k === 'minor_line') return 28;
    if (k === 'cable') return 20;
    return 34;
  }
  return 10;
}
function vpBoxesOverlap(a, b) {
  var pad = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
  if (!a || !b) return false;
  return a.l < b.r + pad && a.r > b.l - pad && a.t < b.b + pad && a.b > b.t - pad;
}
var vpObsTileCoverage = new Map();
var vpObsTileFailed = new Map();
var vpObsHostedMissCache = new Map();
window.vpObsTileConfig = {
  storageKey: VP_OBS_TILE_COVERAGE_KEY,
  stepLat: VP_OBS_TILE_STEP_LAT,
  stepLon: VP_OBS_TILE_STEP_LON
};
window.vpObsTileFailConfig = {
  storageKey: VP_OBS_TILE_FAILED_KEY,
  maxEntries: VP_OBS_TILE_FAILED_MAX
};

// Traffic im Profil
window.vpTrafficProfileVisible = true;
function fetchProfileLandmarks(_x) {
  return _fetchProfileLandmarks.apply(this, arguments);
} // GPS-zentrierte Städte/Airports laden (ohne Flugplan, aus RAM)
function _fetchProfileLandmarks() {
  _fetchProfileLandmarks = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee11(elevData) {
    var minL, maxL, minLo, maxLo, landmarks, _loop9, k, _t10, _t11;
    return _regenerator().w(function (_context12) {
      while (1) switch (_context12.n) {
        case 0:
          if (!(!elevData || elevData.length < 2)) {
            _context12.n = 1;
            break;
          }
          return _context12.a(2, []);
        case 1:
          minL = 90, maxL = -90, minLo = 180, maxLo = -180;
          elevData.forEach(p => {
            if (p.lat < minL) minL = p.lat;
            if (p.lat > maxL) maxL = p.lat;
            if (p.lon < minLo) minLo = p.lon;
            if (p.lon > maxLo) maxLo = p.lon;
          });
          minL -= 0.1;
          maxL += 0.1;
          minLo -= 0.15;
          maxLo += 0.15;
          landmarks = [];
          _context12.n = 2;
          return loadGlobalAirports();
        case 2:
          _loop9 = /*#__PURE__*/_regenerator().m(function _loop9() {
            var a, bestD, bestDistNM;
            return _regenerator().w(function (_context11) {
              while (1) switch (_context11.n) {
                case 0:
                  a = globalAirports[k];
                  if (a.lat > minL && a.lat < maxL && a.lon > minLo && a.lon < maxLo) {
                    bestD = Infinity, bestDistNM = 0;
                    elevData.forEach(ep => {
                      var d = calcNav(a.lat, a.lon, ep.lat, ep.lon).dist;
                      if (d < bestD) {
                        bestD = d;
                        bestDistNM = ep.distNM;
                      }
                    });
                    if (bestD < 3.5) landmarks.push({
                      name: a.icao,
                      type: 'apt',
                      pop: 100000000,
                      distNM: bestDistNM
                    });
                  }
                case 1:
                  return _context11.a(2);
              }
            }, _loop9);
          });
          _t10 = _regeneratorKeys(globalAirports);
        case 3:
          if ((_t11 = _t10()).done) {
            _context12.n = 5;
            break;
          }
          k = _t11.value;
          return _context12.d(_regeneratorValues(_loop9()), 4);
        case 4:
          _context12.n = 3;
          break;
        case 5:
          _context12.n = 6;
          return loadGlobalCities();
        case 6:
          if (globalCities && globalCities.length > 0) {
            globalCities.forEach(c => {
              if (c.lat > minL && c.lat < maxL && c.lon > minLo && c.lon < maxLo) {
                var bestD = Infinity,
                  bestDistNM = 0;
                elevData.forEach(ep => {
                  var d = calcNav(c.lat, c.lon, ep.lat, ep.lon).dist;
                  if (d < bestD) {
                    bestD = d;
                    bestDistNM = ep.distNM;
                  }
                });
                if (bestD < 3.5) {
                  var cType = c.pop >= 15000 ? 'city' : 'town';
                  landmarks.push({
                    name: c.name,
                    type: cType,
                    pop: c.pop || 5000,
                    distNM: bestDistNM
                  });
                }
              }
            });
          }
          return _context12.a(2, landmarks.sort((a, b) => b.pop - a.pop));
      }
    }, _callee11);
  }));
  return _fetchProfileLandmarks.apply(this, arguments);
}
function updateGpsCities(_x2, _x3) {
  return _updateGpsCities.apply(this, arguments);
}
function _updateGpsCities() {
  _updateGpsCities = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee12(lat, lon) {
    var landmarks, k, a, nav;
    return _regenerator().w(function (_context13) {
      while (1) switch (_context13.n) {
        case 0:
          _context13.n = 1;
          return loadGlobalCities();
        case 1:
          _context13.n = 2;
          return loadGlobalAirports();
        case 2:
          landmarks = [];
          if (globalCities && globalCities.length > 0) {
            globalCities.forEach(c => {
              if (Math.abs(c.lat - lat) > 0.22 || Math.abs(c.lon - lon) > 0.33) return;
              var nav = calcNav(lat, lon, c.lat, c.lon);
              if (nav.dist > 15) return;
              landmarks.push({
                name: c.name,
                type: c.pop >= 15000 ? 'city' : 'town',
                pop: c.pop || 5000,
                distNM: nav.dist
              });
            });
          }
          if (typeof globalAirports !== 'undefined' && globalAirports) {
            for (k in globalAirports) {
              a = globalAirports[k];
              nav = calcNav(lat, lon, a.lat, a.lon);
              if (nav.dist <= 10) landmarks.push({
                name: a.icao,
                type: 'apt',
                pop: 100000000,
                distNM: nav.dist
              });
            }
          }
          vpLandmarks = landmarks.sort((a, b) => b.pop - a.pop);
          window.vpBgNeedsUpdate = true;
          if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
        case 3:
          return _context13.a(2);
      }
    }, _callee12);
  }));
  return _updateGpsCities.apply(this, arguments);
}
window.updateGpsCities = updateGpsCities;

// Helfer zum Entdoppeln von Hindernissen (nimmt das höchste in einem engen Fenster)
function deduplicateFeatures(features) {
  var buckets = {};
  var _iterator = _createForOfIteratorHelper(Array.isArray(features) ? features : []),
    _step;
  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var f = _step.value;
      if (!f || !Number.isFinite(Number(f.distNM))) continue;
      var t = String(f.type || '').toLowerCase();
      var typeGroup = t === 'wind' ? 'wind' : t === 'power_tower' ? 'power_tower' : 'mast';
      var bIdx = Math.floor(Number(f.distNM) / 0.35);
      var key = `${typeGroup}|${bIdx}`;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(f);
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }
  var final = [];
  for (var k in buckets) {
    buckets[k].sort((a, b) => Number(b.hFt || 0) - Number(a.hFt || 0));
    var rep = _objectSpread(_objectSpread({}, buckets[k][0]), {}, {
      count: buckets[k].length
    });
    final.push(rep);
  }
  return final.sort((a, b) => Number(a.distNM || 0) - Number(b.distNM || 0));
}
function vpHydrateOverpassState() {
  if (vpOverpassStateHydrated) return;
  vpOverpassStateHydrated = true;
  try {
    var raw = localStorage.getItem(VP_OVERPASS_STATE_STORAGE_KEY);
    if (!raw) return;
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    vpOverpassState = {
      cooldownUntil: Number(parsed.cooldownUntil || 0),
      backoffLevel: Math.max(0, Number(parsed.backoffLevel || 0)),
      lastFailureAt: Number(parsed.lastFailureAt || 0),
      lastFailureStatus: Number(parsed.lastFailureStatus || 0),
      lastSuccessAt: Number(parsed.lastSuccessAt || 0)
    };
  } catch (_) {}
}
function vpPersistOverpassState() {
  try {
    localStorage.setItem(VP_OVERPASS_STATE_STORAGE_KEY, JSON.stringify(vpOverpassState));
  } catch (_) {}
}
function vpGetOverpassCooldownRemainingMs() {
  var now = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Date.now();
  vpHydrateOverpassState();
  var until = Number(vpOverpassState.cooldownUntil || 0);
  return Math.max(0, until - now);
}
function vpIsOverpassCoolingDown() {
  var now = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Date.now();
  return vpGetOverpassCooldownRemainingMs(now) > 0;
}
function vpGetTileBackoffRemainingMs(tileKey) {
  var now = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Date.now();
  var m = window.vpOverpassTileBackoff && window.vpOverpassTileBackoff.get(tileKey);
  if (!m) return 0;
  var until = Number(m.until || 0);
  return Math.max(0, until - now);
}
function vpIsTileBackoffActive(tileKey) {
  var now = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Date.now();
  return vpGetTileBackoffRemainingMs(tileKey, now) > 0;
}
function vpMarkTileBackoff(tileKey) {
  if (typeof tileKey !== 'string' || !tileKey) return 0;
  if (!window.vpOverpassTileBackoff) window.vpOverpassTileBackoff = new Map();
  var now = Date.now();
  var prev = window.vpOverpassTileBackoff.get(tileKey);
  var tries = Math.min(8, Number(prev && prev.tries || 0) + 1);
  var ms = Math.min(VP_OVERPASS_TILE_FAIL_MAX_MS, Math.round(VP_OVERPASS_TILE_FAIL_BASE_MS * Math.pow(1.7, Math.max(0, tries - 1))));
  var jitter = Math.round((Math.random() - 0.5) * 0.16 * ms);
  var until = now + Math.max(15 * 1000, ms + jitter);
  window.vpOverpassTileBackoff.set(tileKey, {
    tries,
    until
  });
  return Math.max(0, until - now);
}
function vpClearTileBackoff(tileKey) {
  if (!window.vpOverpassTileBackoff) return;
  window.vpOverpassTileBackoff.delete(tileKey);
}
function vpMinTileBackoffRemainingMs(tileKeys) {
  var now = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Date.now();
  var min = Infinity;
  if (!Array.isArray(tileKeys)) return 0;
  var _iterator2 = _createForOfIteratorHelper(tileKeys),
    _step2;
  try {
    for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
      var key = _step2.value;
      var rem = vpGetTileBackoffRemainingMs(key, now);
      if (rem > 0 && rem < min) min = rem;
    }
  } catch (err) {
    _iterator2.e(err);
  } finally {
    _iterator2.f();
  }
  return Number.isFinite(min) ? min : 0;
}
function vpMarkOverpassSuccess() {
  vpHydrateOverpassState();
  vpOverpassState.backoffLevel = 0;
  vpOverpassState.cooldownUntil = 0;
  vpOverpassState.lastSuccessAt = Date.now();
  vpPersistOverpassState();
}
function vpApplyOverpassBackoff(statusCode) {
  var retryAfterSec = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  vpHydrateOverpassState();
  vpOverpassState.backoffLevel = Math.min(6, Number(vpOverpassState.backoffLevel || 0) + 1);
  var baseMs = statusCode === 429 ? Math.max(VP_OVERPASS_BASE_COOLDOWN_MS, 20 * 1000) : VP_OVERPASS_BASE_COOLDOWN_MS;
  var exp = Math.pow(1.7, Math.max(0, vpOverpassState.backoffLevel - 1));
  var retryAfterMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : 0;
  var cooldownMs = Math.min(VP_OVERPASS_MAX_COOLDOWN_MS, Math.max(baseMs * exp, retryAfterMs));
  var jitterMs = Math.floor(Math.random() * 1200);
  vpOverpassState.cooldownUntil = Date.now() + cooldownMs + jitterMs;
  vpOverpassState.lastFailureAt = Date.now();
  vpOverpassState.lastFailureStatus = Number(statusCode || 0);
  vpPersistOverpassState();
  return cooldownMs + jitterMs;
}
function vpObsKey(item) {
  var lat = Number(item && item.lat);
  var lon = Number(item && item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
  var t = String(item.type || 'obs');
  return `${t}|${lat.toFixed(4)}|${lon.toFixed(4)}`;
}
function vpLinKey(item) {
  var lat = Number(item && item.lat);
  var lon = Number(item && item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
  var t = String(item.type || 'lin');
  var n = String(item.name || '').slice(0, 48);
  var k = String(item.lineKind || '').slice(0, 24);
  return `${t}|${k}|${n}|${lat.toFixed(4)}|${lon.toFixed(4)}`;
}
function vpIndexObsPoolEntry(kind, key, item) {
  var idx = kind === 'obs' ? vpObsPoolTileIndex.obs : vpObsPoolTileIndex.lin;
  if (!idx || !key || !item) return;
  var tileKey = String(item.tileKey || vpObsTileKey(item.lat, item.lon) || '');
  if (!tileKey) return;
  var set = idx.get(tileKey);
  if (!set) {
    set = new Set();
    idx.set(tileKey, set);
  }
  set.add(key);
}
function vpRebuildObsPoolTileIndex() {
  vpObsPoolTileIndex.obs.clear();
  vpObsPoolTileIndex.lin.clear();
  var _iterator3 = _createForOfIteratorHelper(vpObsPool.obs.entries()),
    _step3;
  try {
    for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
      var _step3$value = _slicedToArray(_step3.value, 2),
        key = _step3$value[0],
        item = _step3$value[1];
      vpIndexObsPoolEntry('obs', key, item);
    }
  } catch (err) {
    _iterator3.e(err);
  } finally {
    _iterator3.f();
  }
  var _iterator4 = _createForOfIteratorHelper(vpObsPool.lin.entries()),
    _step4;
  try {
    for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
      var _step4$value = _slicedToArray(_step4.value, 2),
        _key = _step4$value[0],
        _item = _step4$value[1];
      vpIndexObsPoolEntry('lin', _key, _item);
    }
  } catch (err) {
    _iterator4.e(err);
  } finally {
    _iterator4.f();
  }
}
function vpGetObsPoolCandidates(kind, tileKeys) {
  var pool = kind === 'obs' ? vpObsPool.obs : vpObsPool.lin;
  var idx = kind === 'obs' ? vpObsPoolTileIndex.obs : vpObsPoolTileIndex.lin;
  if (!pool || !idx || !tileKeys || !tileKeys.size) return [];
  var out = [];
  var _iterator5 = _createForOfIteratorHelper(tileKeys),
    _step5;
  try {
    for (_iterator5.s(); !(_step5 = _iterator5.n()).done;) {
      var tileKey = _step5.value;
      var keys = idx.get(tileKey);
      if (!keys || !keys.size) continue;
      var _iterator6 = _createForOfIteratorHelper(keys),
        _step6;
      try {
        for (_iterator6.s(); !(_step6 = _iterator6.n()).done;) {
          var key = _step6.value;
          var item = pool.get(key);
          if (!item) {
            keys.delete(key);
            continue;
          }
          var currentTile = String(item.tileKey || vpObsTileKey(item.lat, item.lon) || '');
          if (currentTile !== tileKey) {
            keys.delete(key);
            vpIndexObsPoolEntry(kind, key, item);
            continue;
          }
          out.push(item);
        }
      } catch (err) {
        _iterator6.e(err);
      } finally {
        _iterator6.f();
      }
      if (!keys.size) idx.delete(tileKey);
    }
  } catch (err) {
    _iterator5.e(err);
  } finally {
    _iterator5.f();
  }
  return out;
}
function vpTrimTimedMap(mapObj, maxEntries) {
  if (!mapObj || mapObj.size <= maxEntries) return false;
  var arr = Array.from(mapObj.entries());
  arr.sort((a, b) => Number(b[1].ts || 0) - Number(a[1].ts || 0));
  mapObj.clear();
  for (var i = 0; i < Math.min(maxEntries, arr.length); i++) mapObj.set(arr[i][0], arr[i][1]);
  return true;
}
function vpTrimLinearMapFairByTile(mapObj, maxEntries) {
  if (!mapObj || mapObj.size <= maxEntries) return false;
  var entries = Array.from(mapObj.entries());
  var byTile = new Map();
  for (var _i = 0, _entries = entries; _i < _entries.length; _i++) {
    var it = _entries[_i];
    var v = it[1] || {};
    var tk = String(v.tileKey || '');
    if (!byTile.has(tk)) byTile.set(tk, []);
    byTile.get(tk).push(it);
  }

  // Fair + robust: pro Tile nach Timestamp sortieren und dann round-robin ziehen.
  var groups = Array.from(byTile.values()).map(group => group.slice().sort((a, b) => Number(b[1] && b[1].ts || 0) - Number(a[1] && a[1].ts || 0)));
  var idx = new Array(groups.length).fill(0);
  var keep = [];
  while (keep.length < maxEntries) {
    var progressed = false;
    for (var gi = 0; gi < groups.length && keep.length < maxEntries; gi++) {
      var arr = groups[gi];
      var pos = idx[gi];
      if (pos >= arr.length) continue;
      keep.push(arr[pos]);
      idx[gi] = pos + 1;
      progressed = true;
    }
    if (!progressed) break;
  }
  mapObj.clear();
  var _iterator7 = _createForOfIteratorHelper(keep.slice(0, maxEntries)),
    _step7;
  try {
    for (_iterator7.s(); !(_step7 = _iterator7.n()).done;) {
      var _step7$value = _slicedToArray(_step7.value, 2),
        k = _step7$value[0],
        _v = _step7$value[1];
      mapObj.set(k, _v);
    }
  } catch (err) {
    _iterator7.e(err);
  } finally {
    _iterator7.f();
  }
  return true;
}
function vpTrimMapNewest(mapObj, keepCount) {
  if (!mapObj) return;
  var arr = Array.from(mapObj.entries());
  arr.sort((a, b) => Number(b[1].ts || 0) - Number(a[1].ts || 0));
  mapObj.clear();
  for (var i = 0; i < Math.min(keepCount, arr.length); i++) mapObj.set(arr[i][0], arr[i][1]);
}
function vpTakeNewestValues(mapObj, keepCount) {
  if (!mapObj || keepCount <= 0) return [];
  return Array.from(mapObj.values()).sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0)).slice(0, keepCount);
}
function vpPruneObsPool() {
  var now = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Date.now();
  var ttl = VP_OBS_POOL_TTL_MS;
  var changed = false;
  if (ttl > 0) {
    var _iterator8 = _createForOfIteratorHelper(vpObsPool.obs.entries()),
      _step8;
    try {
      for (_iterator8.s(); !(_step8 = _iterator8.n()).done;) {
        var _step8$value = _slicedToArray(_step8.value, 2),
          k = _step8$value[0],
          v = _step8$value[1];
        if (!v || !Number(v.ts) || now - Number(v.ts) > ttl) {
          vpObsPool.obs.delete(k);
          changed = true;
        }
      }
    } catch (err) {
      _iterator8.e(err);
    } finally {
      _iterator8.f();
    }
    var _iterator9 = _createForOfIteratorHelper(vpObsPool.lin.entries()),
      _step9;
    try {
      for (_iterator9.s(); !(_step9 = _iterator9.n()).done;) {
        var _step9$value = _slicedToArray(_step9.value, 2),
          _k = _step9$value[0],
          _v2 = _step9$value[1];
        if (!_v2 || !Number(_v2.ts) || now - Number(_v2.ts) > ttl) {
          vpObsPool.lin.delete(_k);
          changed = true;
        }
      }
    } catch (err) {
      _iterator9.e(err);
    } finally {
      _iterator9.f();
    }
  }
  changed = vpTrimTimedMap(vpObsPool.obs, VP_OBS_POOL_MAX_OBS) || changed;
  changed = vpTrimLinearMapFairByTile(vpObsPool.lin, VP_OBS_POOL_MAX_LIN) || changed;
  if (changed) vpRebuildObsPoolTileIndex();
}
function vpEncodeObsPoolWithBudget() {
  var obsArr = vpTakeNewestValues(vpObsPool.obs, VP_OBS_POOL_PERSIST_MAX_OBS);
  var linArr = vpTakeNewestValues(vpObsPool.lin, VP_OBS_POOL_PERSIST_MAX_LIN);
  var obsCount = Math.min(obsArr.length, VP_OBS_POOL_PERSIST_MAX_OBS);
  var linCount = Math.min(linArr.length, VP_OBS_POOL_PERSIST_MAX_LIN);
  var raw = '';
  while (true) {
    var payload = {
      obs: obsArr.slice(0, obsCount),
      lin: linArr.slice(0, linCount)
    };
    raw = JSON.stringify(payload);
    if (raw.length <= VP_OBS_POOL_MAX_BYTES) return {
      raw,
      obsCount,
      linCount
    };
    if (obsCount <= 200 && linCount <= 400) return {
      raw,
      obsCount,
      linCount
    };
    if (linCount > 400) {
      linCount = Math.max(400, Math.floor(linCount * 0.65));
    } else if (obsCount > 200) {
      obsCount = Math.max(200, Math.floor(obsCount * 0.65));
    } else {
      return {
        raw,
        obsCount,
        linCount
      };
    }
  }
}
function vpHydrateObsPool() {
  if (vpObsPoolHydrated) return;
  vpObsPoolHydrated = true;
  try {
    var raw = localStorage.getItem(VP_OBS_POOL_STORAGE_KEY);
    if (!raw) return;
    var parsed = JSON.parse(raw);
    var obs = Array.isArray(parsed && parsed.obs) ? parsed.obs : [];
    var lin = Array.isArray(parsed && parsed.lin) ? parsed.lin : [];
    var _iterator0 = _createForOfIteratorHelper(obs),
      _step0;
    try {
      for (_iterator0.s(); !(_step0 = _iterator0.n()).done;) {
        var item = _step0.value;
        var key = vpObsKey(item);
        if (!key) continue;
        var entry = {
          ts: Number(item.ts || 0),
          type: item.type || 'mast',
          hFt: Number(item.hFt || 0),
          elevFt: Number(item.elevFt || 0),
          lat: Number(item.lat),
          lon: Number(item.lon),
          tileKey: String(item.tileKey || vpObsTileKey(item.lat, item.lon) || '')
        };
        vpObsPool.obs.set(key, entry);
      }
    } catch (err) {
      _iterator0.e(err);
    } finally {
      _iterator0.f();
    }
    var _iterator1 = _createForOfIteratorHelper(lin),
      _step1;
    try {
      for (_iterator1.s(); !(_step1 = _iterator1.n()).done;) {
        var _item2 = _step1.value;
        var _key2 = vpLinKey(_item2);
        if (!_key2) continue;
        var _entry = {
          ts: Number(_item2.ts || 0),
          type: _item2.type || 'linear',
          name: String(_item2.name || ''),
          lineKind: String(_item2.lineKind || ''),
          lat: Number(_item2.lat),
          lon: Number(_item2.lon),
          tileKey: String(_item2.tileKey || vpObsTileKey(_item2.lat, _item2.lon) || '')
        };
        vpObsPool.lin.set(_key2, _entry);
      }
    } catch (err) {
      _iterator1.e(err);
    } finally {
      _iterator1.f();
    }
    vpPruneObsPool();
    vpRebuildObsPoolTileIndex();
  } catch (_) {}
}
function vpPersistObsPoolSoon() {
  if (vpObsPoolPersistTimer) return;
  vpObsPoolPersistTimer = setTimeout(() => {
    vpObsPoolPersistTimer = null;
    var perf = window.gaPerfStart ? window.gaPerfStart('Overpass persist obs pool', {
      obs: vpObsPool.obs ? vpObsPool.obs.size : 0,
      lin: vpObsPool.lin ? vpObsPool.lin.size : 0
    }) : null;
    try {
      vpPruneObsPool();
      var packed = vpEncodeObsPoolWithBudget();
      // Wichtig: Nur die persistierte Snapshot-Groesse begrenzen.
      // Den RAM-Pool nicht auf Persist-Größe zusammenschrumpfen, sonst
      // verschwinden nach Routenwechseln visuell Features "zufaellig".
      localStorage.setItem(VP_OBS_POOL_STORAGE_KEY, packed.raw);
      if (window.vpWeatherDebug) window.vpWeatherDebug.overpassTileCoverageEntries = vpObsTileCoverage.size;
      if (window.gaPerfEnd) window.gaPerfEnd(perf, {
        ok: true,
        bytes: packed.raw.length,
        obs: packed.obsCount,
        lin: packed.linCount
      });
    } catch (_) {
      try {
        // Fallback: kleiner Snapshot nur fuer Persistenz, RAM-Pool bleibt erhalten.
        var obsSnapshot = Array.from(vpObsPool.obs.values()).sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0)).slice(0, 1200);
        var linSnapshot = Array.from(vpObsPool.lin.values()).sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0)).slice(0, 800);
        var fallbackRaw = JSON.stringify({
          obs: obsSnapshot,
          lin: linSnapshot
        });
        localStorage.setItem(VP_OBS_POOL_STORAGE_KEY, fallbackRaw);
        if (window.gaPerfEnd) window.gaPerfEnd(perf, {
          ok: true,
          fallback: true,
          bytes: fallbackRaw.length
        });
      } catch (_) {
        if (window.gaPerfEnd) window.gaPerfEnd(perf, {
          ok: false
        });
      }
    }
  }, 400);
}
function vpListObsComboKeys() {
  var keys = [];
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.startsWith(VP_OBS_COMBO_PREFIX)) keys.push(k);
    }
  } catch (_) {}
  return keys;
}
function vpReadObsComboTs(key) {
  try {
    var raw = localStorage.getItem(key);
    if (!raw) return 0;
    var parsed = JSON.parse(raw);
    return Number(parsed && parsed.ts) || 0;
  } catch (_) {
    return 0;
  }
}
function vpPruneObsComboRouteCache() {
  var maxEntries = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : VP_OBS_COMBO_MAX_ENTRIES;
  var keys = vpListObsComboKeys();
  if (keys.length <= maxEntries) return 0;
  var victims = keys.map(k => ({
    k,
    ts: vpReadObsComboTs(k)
  })).sort((a, b) => a.ts - b.ts).slice(0, Math.max(0, keys.length - maxEntries));
  var removed = 0;
  var _iterator10 = _createForOfIteratorHelper(victims),
    _step10;
  try {
    for (_iterator10.s(); !(_step10 = _iterator10.n()).done;) {
      var v = _step10.value;
      try {
        localStorage.removeItem(v.k);
        removed++;
      } catch (_) {}
    }
  } catch (err) {
    _iterator10.e(err);
  } finally {
    _iterator10.f();
  }
  return removed;
}
function vpStoreObsComboRouteCache(cacheKey, obs, lin) {
  var perf = window.gaPerfStart ? window.gaPerfStart('Overpass store combo cache', {
    obs: Array.isArray(obs) ? obs.length : 0,
    lin: Array.isArray(lin) ? lin.length : 0
  }) : null;
  var key = `${VP_OBS_COMBO_PREFIX}${cacheKey}`;
  var payload = JSON.stringify({
    ts: Date.now(),
    obs: obs || [],
    lin: lin || []
  });
  try {
    vpPruneObsComboRouteCache(VP_OBS_COMBO_MAX_ENTRIES - 1);
    localStorage.setItem(key, payload);
    vpPruneObsComboRouteCache(VP_OBS_COMBO_MAX_ENTRIES);
    if (window.gaPerfEnd) window.gaPerfEnd(perf, {
      ok: true,
      bytes: payload.length
    });
    return true;
  } catch (e) {
    // Quota voll: alte Route-Caches aggressiv aufraeumen und einmal retry.
    try {
      vpPruneObsComboRouteCache(6);
      localStorage.setItem(key, payload);
      vpPruneObsComboRouteCache(VP_OBS_COMBO_MAX_ENTRIES);
      if (window.gaPerfEnd) window.gaPerfEnd(perf, {
        ok: true,
        retry: true,
        bytes: payload.length
      });
      return true;
    } catch (_) {
      if (window.vpWeatherDebug) {
        window.vpWeatherDebug.lastGlobalErrorAt = Date.now();
        window.vpWeatherDebug.lastGlobalErrorMsg = e && e.message ? e.message : 'obs combo cache persist failed';
      }
      if (window.gaPerfEnd) window.gaPerfEnd(perf, {
        ok: false,
        bytes: payload.length
      });
      return false;
    }
  }
}
function vpRememberObstacleData(obsArr, linArr) {
  var tileKey = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';
  var perf = window.gaPerfStart ? window.gaPerfStart('Overpass remember obstacle data', {
    obs: Array.isArray(obsArr) ? obsArr.length : 0,
    lin: Array.isArray(linArr) ? linArr.length : 0,
    tileKey: String(tileKey || '')
  }) : null;
  vpHydrateObsPool();
  var now = Date.now();
  var fallbackTileKey = typeof tileKey === 'string' && tileKey ? tileKey : '';
  if (Array.isArray(obsArr)) {
    var _iterator11 = _createForOfIteratorHelper(obsArr),
      _step11;
    try {
      for (_iterator11.s(); !(_step11 = _iterator11.n()).done;) {
        var item = _step11.value;
        var key = vpObsKey(item);
        if (!key) continue;
        var tk = String((item === null || item === void 0 ? void 0 : item.tileKey) || fallbackTileKey || vpObsTileKey(item === null || item === void 0 ? void 0 : item.lat, item === null || item === void 0 ? void 0 : item.lon) || '');
        var entry = {
          ts: now,
          type: item.type || 'mast',
          hFt: Number(item.hFt || 0),
          elevFt: Number(item.elevFt || 0),
          lat: Number(item.lat),
          lon: Number(item.lon),
          tileKey: tk
        };
        vpObsPool.obs.set(key, entry);
        vpIndexObsPoolEntry('obs', key, entry);
      }
    } catch (err) {
      _iterator11.e(err);
    } finally {
      _iterator11.f();
    }
  }
  if (Array.isArray(linArr)) {
    var _iterator12 = _createForOfIteratorHelper(linArr),
      _step12;
    try {
      for (_iterator12.s(); !(_step12 = _iterator12.n()).done;) {
        var _item3 = _step12.value;
        var _key3 = vpLinKey(_item3);
        if (!_key3) continue;
        var _tk = String((_item3 === null || _item3 === void 0 ? void 0 : _item3.tileKey) || fallbackTileKey || vpObsTileKey(_item3 === null || _item3 === void 0 ? void 0 : _item3.lat, _item3 === null || _item3 === void 0 ? void 0 : _item3.lon) || '');
        var _entry2 = {
          ts: now,
          type: _item3.type || 'linear',
          name: String(_item3.name || ''),
          lineKind: String(_item3.lineKind || ''),
          lat: Number(_item3.lat),
          lon: Number(_item3.lon),
          tileKey: _tk
        };
        vpObsPool.lin.set(_key3, _entry2);
        vpIndexObsPoolEntry('lin', _key3, _entry2);
      }
    } catch (err) {
      _iterator12.e(err);
    } finally {
      _iterator12.f();
    }
  }
  var trimmedObs = vpTrimTimedMap(vpObsPool.obs, VP_OBS_POOL_MAX_OBS);
  var trimmedLin = vpTrimLinearMapFairByTile(vpObsPool.lin, VP_OBS_POOL_MAX_LIN);
  if (trimmedObs || trimmedLin) vpRebuildObsPoolTileIndex();
  vpPersistObsPoolSoon();
  if (window.gaPerfEnd) window.gaPerfEnd(perf, {
    obsPool: vpObsPool.obs ? vpObsPool.obs.size : 0,
    linPool: vpObsPool.lin ? vpObsPool.lin.size : 0
  });
}
function vpObsTileKey(lat, lon) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return '';
  var latI = Math.floor((Number(lat) + 90) / VP_OBS_TILE_STEP_LAT);
  var lonI = Math.floor((Number(lon) + 180) / VP_OBS_TILE_STEP_LON);
  return `${latI}|${lonI}`;
}
function vpObsTileBoundsFromKey(key) {
  var parts = String(key || '').split('|');
  if (parts.length < 2) return null;
  var latI = Number(parts[0]);
  var lonI = Number(parts[1]);
  if (!Number.isFinite(latI) || !Number.isFinite(lonI)) return null;
  var south = latI * VP_OBS_TILE_STEP_LAT - 90;
  var west = lonI * VP_OBS_TILE_STEP_LON - 180;
  return {
    south,
    west,
    north: south + VP_OBS_TILE_STEP_LAT,
    east: west + VP_OBS_TILE_STEP_LON
  };
}
function vpCollectRouteTileKeys(elevData) {
  var set = new Set();
  if (!Array.isArray(elevData)) return set;
  var _iterator13 = _createForOfIteratorHelper(elevData),
    _step13;
  try {
    for (_iterator13.s(); !(_step13 = _iterator13.n()).done;) {
      var p = _step13.value;
      if (!p || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lon))) continue;
      set.add(vpObsTileKey(p.lat, p.lon));
    }
  } catch (err) {
    _iterator13.e(err);
  } finally {
    _iterator13.f();
  }
  return set;
}
function vpExpandObsTileKeys(keys) {
  var radius = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
  var out = new Set();
  var r = Math.max(0, Math.floor(Number(radius) || 0));
  if (!keys || typeof keys[Symbol.iterator] !== 'function') return out;
  var _iterator14 = _createForOfIteratorHelper(keys),
    _step14;
  try {
    for (_iterator14.s(); !(_step14 = _iterator14.n()).done;) {
      var key = _step14.value;
      var parts = String(key || '').split('|');
      if (parts.length < 2) continue;
      var latI = Number(parts[0]);
      var lonI = Number(parts[1]);
      if (!Number.isFinite(latI) || !Number.isFinite(lonI)) continue;
      for (var dy = -r; dy <= r; dy++) {
        for (var dx = -r; dx <= r; dx++) {
          out.add(`${latI + dy}|${lonI + dx}`);
        }
      }
    }
  } catch (err) {
    _iterator14.e(err);
  } finally {
    _iterator14.f();
  }
  return out;
}
function vpHydrateObsTileCoverage() {
  if (vpObsTileCoverageHydrated) return;
  vpObsTileCoverageHydrated = true;
  try {
    var raw = localStorage.getItem(VP_OBS_TILE_COVERAGE_KEY);
    if (!raw) return;
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    var now = Date.now();
    var _iterator15 = _createForOfIteratorHelper(parsed),
      _step15;
    try {
      for (_iterator15.s(); !(_step15 = _iterator15.n()).done;) {
        var item = _step15.value;
        if (!item || typeof item.k !== 'string') continue;
        var ts = Number(item.ts || 0);
        if (!ts) continue;
        if (VP_OBS_TILE_TTL_MS > 0 && now - ts > VP_OBS_TILE_TTL_MS) continue;
        vpObsTileCoverage.set(item.k, {
          ts,
          src: String(item.src || 'unknown'),
          usedTs: Number(item.usedTs || 0)
        });
      }
    } catch (err) {
      _iterator15.e(err);
    } finally {
      _iterator15.f();
    }
  } catch (_) {}
}
function vpPersistObsTileCoverageSoon() {
  if (vpObsTileCoveragePersistTimer) return;
  vpObsTileCoveragePersistTimer = setTimeout(() => {
    vpObsTileCoveragePersistTimer = null;
    try {
      var now = Date.now();
      var payload = [];
      var _iterator16 = _createForOfIteratorHelper(vpObsTileCoverage.entries()),
        _step16;
      try {
        for (_iterator16.s(); !(_step16 = _iterator16.n()).done;) {
          var _step16$value = _slicedToArray(_step16.value, 2),
            k = _step16$value[0],
            meta = _step16$value[1];
          var ts = Number(meta && meta.ts || 0);
          if (!ts) continue;
          if (VP_OBS_TILE_TTL_MS > 0 && now - ts > VP_OBS_TILE_TTL_MS) continue;
          payload.push({
            k,
            ts,
            src: String(meta && meta.src || 'unknown'),
            usedTs: Number(meta && meta.usedTs || 0)
          });
        }
      } catch (err) {
        _iterator16.e(err);
      } finally {
        _iterator16.f();
      }
      localStorage.setItem(VP_OBS_TILE_COVERAGE_KEY, JSON.stringify(payload));
      if (window.vpNotifyObsTileCoverageChanged) window.vpNotifyObsTileCoverageChanged();
    } catch (_) {}
  }, 400);
}
function vpHydrateObsTileFailed() {
  if (vpObsTileFailedHydrated) return;
  vpObsTileFailedHydrated = true;
  try {
    var raw = localStorage.getItem(VP_OBS_TILE_FAILED_KEY);
    if (!raw) return;
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    var _iterator17 = _createForOfIteratorHelper(parsed),
      _step17;
    try {
      for (_iterator17.s(); !(_step17 = _iterator17.n()).done;) {
        var item = _step17.value;
        if (!item || typeof item.k !== 'string') continue;
        var ts = Number(item.ts || 0);
        if (!ts) continue;
        vpObsTileFailed.set(item.k, {
          ts,
          status: Number(item.status || 0),
          src: String(item.src || ''),
          attempts: Number(item.attempts || 1)
        });
      }
    } catch (err) {
      _iterator17.e(err);
    } finally {
      _iterator17.f();
    }
    vpSyncFailedOverpassChunksFromTileStore();
  } catch (_) {}
}
function vpPersistObsTileFailedSoon() {
  if (vpObsTileFailedPersistTimer) return;
  vpObsTileFailedPersistTimer = setTimeout(() => {
    vpObsTileFailedPersistTimer = null;
    try {
      var payload = Array.from(vpObsTileFailed.entries()).sort((a, b) => Number(b[1] && b[1].ts || 0) - Number(a[1] && a[1].ts || 0)).slice(0, VP_OBS_TILE_FAILED_MAX).map(_ref => {
        var _ref2 = _slicedToArray(_ref, 2),
          k = _ref2[0],
          v = _ref2[1];
        return {
          k,
          ts: Number(v && v.ts || 0),
          status: Number(v && v.status || 0),
          src: String(v && v.src || ''),
          attempts: Number(v && v.attempts || 1)
        };
      });
      localStorage.setItem(VP_OBS_TILE_FAILED_KEY, JSON.stringify(payload));
      if (window.vpNotifyObsTileCoverageChanged) window.vpNotifyObsTileCoverageChanged();
    } catch (_) {}
  }, 400);
}
function vpSyncFailedOverpassChunksFromTileStore() {
  var list = Array.from(vpObsTileFailed.keys()).slice(0, 200).map(k => ({
    tileKey: k
  }));
  window.vpFailedOverpassChunks = list;
  if (typeof window.updateOverpassErrorUI === 'function') window.updateOverpassErrorUI();
}
function vpMarkTileFailed(tileKey) {
  var status = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  var src = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';
  vpHydrateObsTileFailed();
  if (typeof tileKey !== 'string' || !tileKey) return;
  var prev = vpObsTileFailed.get(tileKey);
  vpObsTileFailed.set(tileKey, {
    ts: Date.now(),
    status: Number(status || 0),
    src: String(src || prev && prev.src || ''),
    attempts: Number(prev && prev.attempts || 0) + 1
  });
  while (vpObsTileFailed.size > VP_OBS_TILE_FAILED_MAX) {
    var oldestKey = null;
    var oldestTs = Infinity;
    var _iterator18 = _createForOfIteratorHelper(vpObsTileFailed.entries()),
      _step18;
    try {
      for (_iterator18.s(); !(_step18 = _iterator18.n()).done;) {
        var _step18$value = _slicedToArray(_step18.value, 2),
          k = _step18$value[0],
          v = _step18$value[1];
        var ts = Number(v && v.ts || 0);
        if (ts < oldestTs) {
          oldestTs = ts;
          oldestKey = k;
        }
      }
    } catch (err) {
      _iterator18.e(err);
    } finally {
      _iterator18.f();
    }
    if (!oldestKey) break;
    vpObsTileFailed.delete(oldestKey);
  }
  vpSyncFailedOverpassChunksFromTileStore();
  vpPersistObsTileFailedSoon();
}
function vpClearTileFailed(tileKey) {
  vpHydrateObsTileFailed();
  if (typeof tileKey !== 'string' || !tileKey) return;
  if (vpObsTileFailed.delete(tileKey)) {
    vpSyncFailedOverpassChunksFromTileStore();
    vpPersistObsTileFailedSoon();
  }
}
function vpGetRouteTileCoverageProbe(elevData) {
  vpHydrateObsTileCoverage();
  var keys = vpCollectRouteTileKeys(elevData);
  var now = Date.now();
  var missing = [];
  var touchedUsage = false;
  var _iterator19 = _createForOfIteratorHelper(keys),
    _step19;
  try {
    for (_iterator19.s(); !(_step19 = _iterator19.n()).done;) {
      var key = _step19.value;
      var meta = vpObsTileCoverage.get(key);
      var ts = Number(meta && meta.ts || 0);
      if (!ts) {
        missing.push(key);
        continue;
      }
      // Legacy/Provisional marker aus altem Route-Cache nicht als "wirklich geladen" behandeln.
      // Dadurch werden diese Tiles automatisch erneut gegen Overpass validiert.
      if (String(meta && meta.src || '') === 'route-cache') {
        missing.push(key);
        continue;
      }
      if (VP_OBS_TILE_TTL_MS > 0 && now - ts > VP_OBS_TILE_TTL_MS) {
        missing.push(key);
        continue;
      }
      if (meta && meta.usedTs !== now) {
        meta.usedTs = now;
        vpObsTileCoverage.set(key, meta);
        touchedUsage = true;
      }
    }
  } catch (err) {
    _iterator19.e(err);
  } finally {
    _iterator19.f();
  }
  if (touchedUsage) vpPersistObsTileCoverageSoon();
  if (window.vpWeatherDebug) {
    window.vpWeatherDebug.overpassTileCoverageEntries = vpObsTileCoverage.size;
    window.vpWeatherDebug.overpassTileLastMissingCount = missing.length;
    window.vpWeatherDebug.overpassTileLastMissingSample = missing.slice(0, 10).join(', ');
  }
  return {
    total: keys.size,
    missing
  };
}
function vpMarkRouteTilesCovered(elevData) {
  var source = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'unknown';
  vpHydrateObsTileCoverage();
  var keys = vpCollectRouteTileKeys(elevData);
  vpMarkTileKeysCovered(keys, source);
}
function vpMarkTileKeysCovered(keys) {
  var source = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'unknown';
  vpHydrateObsTileCoverage();
  var now = Date.now();
  var src = String(source || 'unknown');
  if (!keys) return;
  var _iterator20 = _createForOfIteratorHelper(keys),
    _step20;
  try {
    for (_iterator20.s(); !(_step20 = _iterator20.n()).done;) {
      var key = _step20.value;
      if (typeof key !== 'string' || !key) continue;
      var prev = vpObsTileCoverage.get(key);
      vpObsTileCoverage.set(key, {
        ts: now,
        src,
        usedTs: Number(prev && prev.usedTs || 0)
      });
    }
  } catch (err) {
    _iterator20.e(err);
  } finally {
    _iterator20.f();
  }
  if (window.vpWeatherDebug) window.vpWeatherDebug.overpassTileCoverageEntries = vpObsTileCoverage.size;
  vpPersistObsTileCoverageSoon();
}
function vpProjectObsPoolToRoute(elevData) {
  var perf = window.gaPerfStart ? window.gaPerfStart('Overpass project pool to route', {
    routePoints: Array.isArray(elevData) ? elevData.length : 0,
    obsPool: vpObsPool && vpObsPool.obs ? vpObsPool.obs.size : 0,
    linPool: vpObsPool && vpObsPool.lin ? vpObsPool.lin.size : 0
  }) : null;
  vpHydrateObsPool();
  if (!Array.isArray(elevData) || elevData.length < 2) {
    if (window.gaPerfEnd) window.gaPerfEnd(perf, {
      status: 'no-route'
    });
    return {
      obs: [],
      lin: []
    };
  }
  var obsSeed = [];
  var linSeed = [];
  var maxRouteSamples = 900;
  var stride = elevData.length > maxRouteSamples ? Math.ceil(elevData.length / maxRouteSamples) : 1;
  var routeSamples = stride <= 1 ? elevData : elevData.filter((_, idx) => idx % stride === 0 || idx === elevData.length - 1);
  var routeTileKeys = vpCollectRouteTileKeys(elevData);
  var candidateTileKeys = vpExpandObsTileKeys(routeTileKeys, 1);
  var obsCandidates = vpGetObsPoolCandidates('obs', candidateTileKeys);
  var linCandidates = vpGetObsPoolCandidates('lin', candidateTileKeys);
  var obsChecked = 0;
  var obsSkippedTile = 0;
  var obsSkippedBounds = 0;
  var linChecked = 0;
  var linSkippedTile = 0;
  var linSkippedBounds = 0;
  var routeLats = routeSamples.map(p => Number(p && p.lat)).filter(Number.isFinite);
  var routeLons = routeSamples.map(p => Number(p && p.lon)).filter(Number.isFinite);
  var midLat = routeLats.length ? routeLats.reduce((sum, v) => sum + v, 0) / routeLats.length : 51;
  var lonNmFactor = Math.max(8, 60 * Math.cos(midLat * Math.PI / 180));
  var latNmFactor = 60;
  var maxLateralNm = Math.max(VP_PROFILE_WIND_LATERAL_MAX_NM, VP_PROFILE_OBS_LATERAL_MAX_NM, VP_PROFILE_LIN_LATERAL_MAX_NM);
  var latPad = Math.max(0.04, (maxLateralNm + 2) / latNmFactor);
  var lonPad = Math.max(0.04, (maxLateralNm + 2) / lonNmFactor);
  var routeBounds = routeLats.length && routeLons.length ? {
    minLat: Math.min.apply(Math, _toConsumableArray(routeLats)) - latPad,
    maxLat: Math.max.apply(Math, _toConsumableArray(routeLats)) + latPad,
    minLon: Math.min.apply(Math, _toConsumableArray(routeLons)) - lonPad,
    maxLon: Math.max.apply(Math, _toConsumableArray(routeLons)) + lonPad
  } : null;
  var metricRouteSamples = routeSamples.filter(p => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon))).map(p => ({
    p,
    x: Number(p.lon) * lonNmFactor,
    y: Number(p.lat) * latNmFactor
  }));
  var isInRouteBounds = (lat, lon) => {
    if (!routeBounds) return true;
    return lat >= routeBounds.minLat && lat <= routeBounds.maxLat && lon >= routeBounds.minLon && lon <= routeBounds.maxLon;
  };
  var resolveTileKey = item => {
    var lat = Number(item && item.lat);
    var lon = Number(item && item.lon);
    return String(vpObsTileKey(lat, lon) || (item === null || item === void 0 ? void 0 : item.tileKey) || '');
  };
  var nearestOnRoute = (lat, lon) => {
    var x = Number(lon) * lonNmFactor;
    var y = Number(lat) * latNmFactor;
    var best = metricRouteSamples[0];
    var bestD2 = Infinity;
    var _iterator21 = _createForOfIteratorHelper(metricRouteSamples),
      _step21;
    try {
      for (_iterator21.s(); !(_step21 = _iterator21.n()).done;) {
        var ep = _step21.value;
        var dx = x - ep.x;
        var dy = y - ep.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = ep;
        }
      }
    } catch (err) {
      _iterator21.e(err);
    } finally {
      _iterator21.f();
    }
    return {
      bestPt: best && best.p || routeSamples[0] || elevData[0],
      bestD: Math.sqrt(bestD2)
    };
  };
  var _iterator22 = _createForOfIteratorHelper(obsCandidates),
    _step22;
  try {
    for (_iterator22.s(); !(_step22 = _iterator22.n()).done;) {
      var item = _step22.value;
      var lat = Number(item && item.lat);
      var lon = Number(item && item.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        obsSkippedBounds++;
        continue;
      }
      if (!isInRouteBounds(lat, lon)) {
        obsSkippedBounds++;
        continue;
      }
      var tileKey = resolveTileKey(item);
      if (candidateTileKeys.size && tileKey && !candidateTileKeys.has(tileKey)) {
        obsSkippedTile++;
        continue;
      }
      obsChecked++;
      var _nearestOnRoute = nearestOnRoute(lat, lon),
        bestPt = _nearestOnRoute.bestPt,
        bestD = _nearestOnRoute.bestD;
      var obsType = String((item === null || item === void 0 ? void 0 : item.type) || '').toLowerCase();
      var obsLateralMax = obsType === 'wind' ? VP_PROFILE_WIND_LATERAL_MAX_NM : VP_PROFILE_OBS_LATERAL_MAX_NM;
      if (bestD > obsLateralMax) continue;
      obsSeed.push({
        type: item.type || 'mast',
        hFt: Number(item.hFt || 0),
        distNM: bestPt.distNM,
        lateralNM: Number(bestD || 0),
        elevFt: Number(item.elevFt || 0),
        groundElevFt: Number(bestPt.elevFt || 0),
        lat,
        lon,
        tileKey
      });
    }
  } catch (err) {
    _iterator22.e(err);
  } finally {
    _iterator22.f();
  }
  var _iterator23 = _createForOfIteratorHelper(linCandidates),
    _step23;
  try {
    for (_iterator23.s(); !(_step23 = _iterator23.n()).done;) {
      var _item4 = _step23.value;
      var _lat = Number(_item4 && _item4.lat);
      var _lon = Number(_item4 && _item4.lon);
      if (!Number.isFinite(_lat) || !Number.isFinite(_lon)) {
        linSkippedBounds++;
        continue;
      }
      if (!isInRouteBounds(_lat, _lon)) {
        linSkippedBounds++;
        continue;
      }
      var _tileKey = resolveTileKey(_item4);
      if (candidateTileKeys.size && _tileKey && !candidateTileKeys.has(_tileKey)) {
        linSkippedTile++;
        continue;
      }
      linChecked++;
      var _nearestOnRoute2 = nearestOnRoute(_lat, _lon),
        _bestPt = _nearestOnRoute2.bestPt,
        _bestD = _nearestOnRoute2.bestD;
      if (_bestD > VP_PROFILE_LIN_LATERAL_MAX_NM) continue;
      var rawKind = String(_item4.lineKind || '');
      var inferredKind = String(_item4.type || '').toLowerCase() === 'highway' && !rawKind ? vpInferRoadKindFromText('', String(_item4.name || ''), '') : rawKind;
      linSeed.push({
        type: _item4.type || 'linear',
        name: String(_item4.name || ''),
        lineKind: inferredKind,
        distNM: _bestPt.distNM,
        lateralNM: Number(_bestD || 0),
        lat: _lat,
        lon: _lon,
        tileKey: _tileKey
      });
    }
  } catch (err) {
    _iterator23.e(err);
  } finally {
    _iterator23.f();
  }
  var compactLinSeed = (() => {
    // Nur fast identische Nachbarn zusammenfassen:
    // gleiche Art, nahezu gleiche Distanz/Lateral und (wenn vorhanden) gleicher Name.
    // Wichtig: Unbenannte Flüsse nicht global "wegfalten".
    var out = [];
    var sorted = linSeed.slice().sort((a, b) => Number(a.distNM || 0) - Number(b.distNM || 0));
    var _iterator24 = _createForOfIteratorHelper(sorted),
      _step24;
    try {
      for (_iterator24.s(); !(_step24 = _iterator24.n()).done;) {
        var cur = _step24.value;
        if (!out.length) {
          out.push(cur);
          continue;
        }
        var prev = out[out.length - 1];
        var sameType = String(prev.type || '') === String(cur.type || '');
        if (!sameType) {
          out.push(cur);
          continue;
        }
        var sameLineKind = String(prev.lineKind || '') === String(cur.lineKind || '');
        if (!sameLineKind) {
          out.push(cur);
          continue;
        }
        var pName = String(prev.name || '').trim().toLowerCase();
        var cName = String(cur.name || '').trim().toLowerCase();
        var bothNamed = !!pName && !!cName;
        var sameName = bothNamed && pName === cName;
        var sameTile = String(prev.tileKey || '') === String(cur.tileKey || '') && !!String(cur.tileKey || '');
        var dDist = Math.abs(Number(prev.distNM || 0) - Number(cur.distNM || 0));
        var dLat = Math.abs(Number(prev.lateralNM || 0) - Number(cur.lateralNM || 0));
        if (bothNamed) {
          if (sameName && dDist <= 0.35) continue;
          out.push(cur);
          continue;
        }

        // Unbenannte Features nur innerhalb desselben Tiles und sehr engem Fenster deduplizieren.
        if (sameTile && dDist <= 0.12 && dLat <= 0.08) continue;
        out.push(cur);
      }
    } catch (err) {
      _iterator24.e(err);
    } finally {
      _iterator24.f();
    }
    return out;
  })();
  var out = {
    obs: deduplicateFeatures(obsSeed),
    lin: compactLinSeed
  };
  if (window.gaPerfEnd) window.gaPerfEnd(perf, {
    routeSamples: routeSamples.length,
    stride,
    routeTiles: routeTileKeys.size,
    candidateTiles: candidateTileKeys.size,
    obsCandidates: obsCandidates.length,
    linCandidates: linCandidates.length,
    obsChecked,
    obsSkippedTile,
    obsSkippedBounds,
    linChecked,
    linSkippedTile,
    linSkippedBounds,
    obs: out.obs.length,
    lin: out.lin.length
  });
  return out;
}
function vpEstimateObstacleDisplayStats(obsArr) {
  var src = Array.isArray(obsArr) ? obsArr : [];
  var byType = {
    wind: 0,
    mast: 0,
    power_tower: 0,
    other: 0
  };
  var displayable = 0;
  if (!vpShowObstacles) return {
    total: src.length,
    displayable: 0,
    byType
  };
  var _iterator25 = _createForOfIteratorHelper(src),
    _step25;
  try {
    for (_iterator25.s(); !(_step25 = _iterator25.n()).done;) {
      var o = _step25.value;
      var t = String((o === null || o === void 0 ? void 0 : o.type) || '').toLowerCase();
      if (t === 'power_tower' && !vpShowPowerInfra) continue;
      displayable++;
      if (t === 'wind') byType.wind++;else if (t === 'mast' || t === 'tower') byType.mast++;else if (t === 'power_tower') byType.power_tower++;else byType.other++;
    }
  } catch (err) {
    _iterator25.e(err);
  } finally {
    _iterator25.f();
  }
  return {
    total: src.length,
    displayable,
    byType
  };
}
function vpEstimateLinearDisplayStats(linArr, _obsArr) {
  var src = Array.isArray(linArr) ? linArr : [];
  var majorRoadRx = /\b(A|B)\s?\d+\b/i;
  var isMajorRoadFeature = feat => {
    if (!feat || feat.type !== 'highway') return false;
    var n = String(feat.name || '').trim();
    if (!n) return false;
    if (majorRoadRx.test(n)) return true;
    var low = n.toLowerCase();
    return low.includes('autobahn') || low.includes('bundesstraße') || low.includes('bundesstrasse');
  };
  var isLinearTypeEnabled = feat => {
    if (!feat) return false;
    if (feat.type === 'highway') return !!vpShowRoads;
    if (feat.type === 'river') return !!vpShowRivers;
    if (feat.type === 'powerline') return !!vpShowPowerInfra;
    return false;
  };
  var clusterLinearFeatures = arr => {
    var inArr = Array.isArray(arr) ? arr.slice().sort((a, b) => Number(a.distNM || 0) - Number(b.distNM || 0)) : [];
    var out = [];
    var i = 0;
    while (i < inArr.length) {
      var base = inArr[i];
      var type = String(base.type || '');
      var thr = type === 'river' ? 0.8 : type === 'highway' ? 0.35 : 0.3;
      var sumDist = Number(base.distNM || 0);
      var sumLat = Number(base.lat || 0);
      var sumLon = Number(base.lon || 0);
      var cnt = 1;
      var bestName = String(base.name || '');
      var j = i + 1;
      while (j < inArr.length) {
        var cur = inArr[j];
        if (String(cur.type || '') !== type) break;
        if (Math.abs(Number(cur.distNM || 0) - Number(inArr[j - 1].distNM || 0)) > thr) break;
        sumDist += Number(cur.distNM || 0);
        sumLat += Number(cur.lat || 0);
        sumLon += Number(cur.lon || 0);
        cnt++;
        if (!bestName && String(cur.name || '').trim()) bestName = String(cur.name || '');
        j++;
      }
      out.push(_objectSpread(_objectSpread({}, base), {}, {
        name: bestName || String(base.name || ''),
        distNM: sumDist / cnt,
        lat: sumLat / cnt,
        lon: sumLon / cnt,
        count: cnt
      }));
      i = j;
    }
    return out;
  };
  var isRouteCrossingLinear = feat => Number((feat === null || feat === void 0 ? void 0 : feat.lateralNM) || 999) <= VP_LINEAR_ROUTE_CROSS_NM;
  var filtered = src.filter(isLinearTypeEnabled);
  filtered = filtered.filter(feat => {
    if (feat.type === 'highway') return isMajorRoadFeature(feat);
    if (feat.type === 'river') {
      var n = String(feat.name || '').toLowerCase();
      if (n.includes('wassertret') || n.includes('kneipp') || n.includes('wasserspiel')) return false;
    }
    return true;
  });
  var clustered = clusterLinearFeatures(filtered);
  var byType = {
    highway: 0,
    river: 0,
    powerline: 0
  };
  var displayable = 0;
  var _iterator26 = _createForOfIteratorHelper(clustered),
    _step26;
  try {
    for (_iterator26.s(); !(_step26 = _iterator26.n()).done;) {
      var feat = _step26.value;
      if (!isRouteCrossingLinear(feat)) continue;
      displayable++;
      if (feat.type === 'highway') byType.highway++;else if (feat.type === 'river') byType.river++;else if (feat.type === 'powerline') byType.powerline++;
    }
  } catch (err) {
    _iterator26.e(err);
  } finally {
    _iterator26.f();
  }
  return {
    total: src.length,
    filtered: filtered.length,
    clustered: clustered.length,
    displayable,
    byType
  };
}
function vpEstimateLinearDisplayStatsLight(linArr) {
  var src = Array.isArray(linArr) ? linArr : [];
  var byType = {
    highway: 0,
    river: 0,
    powerline: 0
  };
  var displayable = 0;
  var maxScan = Math.min(src.length, 16000);
  var step = src.length > maxScan ? Math.ceil(src.length / maxScan) : 1;
  for (var i = 0; i < src.length; i += step) {
    var feat = src[i];
    if (!feat) continue;
    var type = String(feat.type || '');
    if (type === 'highway') byType.highway++;else if (type === 'river') byType.river++;else if (type === 'powerline') byType.powerline++;
    if (Number(feat.lateralNM || 999) <= VP_LINEAR_ROUTE_CROSS_NM) displayable++;
  }
  var factor = step > 1 ? step : 1;
  return {
    total: src.length,
    filtered: null,
    clustered: null,
    displayable: Math.round(displayable * factor),
    byType: {
      highway: Math.round(byType.highway * factor),
      river: Math.round(byType.river * factor),
      powerline: Math.round(byType.powerline * factor)
    },
    sampled: step > 1
  };
}
function vpLogRouteFeatureStats(sourceTag, cacheKey, obsArr, linArr) {
  var perf = null;
  try {
    perf = window.gaPerfStart ? window.gaPerfStart('Overpass route stats', {
      sourceTag: String(sourceTag || 'n/a'),
      obs: Array.isArray(obsArr) ? obsArr.length : 0,
      lin: Array.isArray(linArr) ? linArr.length : 0
    }) : null;
    var obsStats = vpEstimateObstacleDisplayStats(obsArr);
    var linTotal = Array.isArray(linArr) ? linArr.length : 0;
    var heavyStats = linTotal > VP_ROUTE_STATS_HEAVY_FEATURE_LIMIT;
    var linStats = heavyStats ? vpEstimateLinearDisplayStatsLight(linArr) : vpEstimateLinearDisplayStats(linArr, obsArr);
    var tileCounts = new Map();
    var acc = (arr, kind) => {
      if (!Array.isArray(arr)) return;
      var maxScan = heavyStats ? Math.min(arr.length, 12000) : arr.length;
      var step = arr.length > maxScan ? Math.ceil(arr.length / maxScan) : 1;
      for (var i = 0; i < arr.length; i += step) {
        var f = arr[i];
        var tk = String((f === null || f === void 0 ? void 0 : f.tileKey) || vpObsTileKey(f === null || f === void 0 ? void 0 : f.lat, f === null || f === void 0 ? void 0 : f.lon) || '?');
        var prev = tileCounts.get(tk) || {
          obs: 0,
          lin: 0
        };
        if (kind === 'obs') prev.obs += step;else prev.lin += step;
        tileCounts.set(tk, prev);
      }
    };
    acc(obsArr, 'obs');
    acc(linArr, 'lin');
    var tileSummary = Array.from(tileCounts.entries()).sort((a, b) => b[1].obs + b[1].lin - (a[1].obs + a[1].lin)).slice(0, 12).map(_ref3 => {
      var _ref4 = _slicedToArray(_ref3, 2),
        k = _ref4[0],
        v = _ref4[1];
      return `${k}:o${v.obs}/l${v.lin}`;
    }).join(', ');
    var tileMore = Math.max(0, tileCounts.size - 12);
    var routeTileKeys = Array.from(vpCollectRouteTileKeys(Array.isArray(vpElevationData) ? vpElevationData : []));
    var routeTileSet = new Set(routeTileKeys);
    var featureTileSet = new Set(tileCounts.keys());
    var routeWithFeatures = routeTileKeys.filter(k => featureTileSet.has(k));
    var routeWithoutFeatures = routeTileKeys.filter(k => !featureTileSet.has(k));
    vpHydrateObsTileCoverage();
    var covBySrc = new Map();
    for (var _i2 = 0, _routeTileKeys = routeTileKeys; _i2 < _routeTileKeys.length; _i2++) {
      var key = _routeTileKeys[_i2];
      var meta = vpObsTileCoverage.get(key);
      var src = String(meta && meta.src || 'none');
      covBySrc.set(src, Number(covBySrc.get(src) || 0) + 1);
    }
    var covSummary = Array.from(covBySrc.entries()).sort((a, b) => b[1] - a[1]).map(_ref5 => {
      var _ref6 = _slicedToArray(_ref5, 2),
        k = _ref6[0],
        v = _ref6[1];
      return `${k}:${v}`;
    }).join(', ');
    var noDataSample = routeWithoutFeatures.slice(0, 8).join(', ');
    var sig = [String(sourceTag || ''), String(cacheKey || ''), String(obsStats.total), String(obsStats.displayable), String(linStats.total), String(linStats.displayable), String(linStats.clustered), String(obsStats.byType.wind), String(obsStats.byType.mast), String(obsStats.byType.power_tower), String(linStats.byType.highway), String(linStats.byType.river), String(linStats.byType.powerline), String(tileSummary), String(tileCounts.size), String(routeTileSet.size), String(routeWithFeatures.length), String(routeWithoutFeatures.length), String(covSummary), String(noDataSample)].join('|');
    if (window._vpLastRouteFeatureStatsSig === sig) {
      if (window.gaPerfEnd) window.gaPerfEnd(perf, {
        heavyStats,
        skipped: 'duplicate'
      });
      return;
    }
    window._vpLastRouteFeatureStatsSig = sig;
    console.log(`[Overpass] Route-Stats (${sourceTag || 'n/a'}${heavyStats ? ':light' : ''}) | core-found obs=${obsStats.total} lin=${linStats.total} ` + `| display obs=${obsStats.displayable} (wind ${obsStats.byType.wind}, mast ${obsStats.byType.mast}, pwrTower ${obsStats.byType.power_tower}) ` + `lin=${linStats.displayable}/${linStats.clustered} (road ${linStats.byType.highway}, river ${linStats.byType.river}, power ${linStats.byType.powerline}) ` + `| tiles core [${tileSummary || '-'}${tileMore > 0 ? `, +${tileMore} more` : ''}] ` + `| route-tiles ${routeTileSet.size} (feat ${routeWithFeatures.length}, empty ${routeWithoutFeatures.length}) ` + `| coverage [${covSummary || '-'}]` + `${noDataSample ? ` | empty-sample [${noDataSample}]` : ''}`);
    if (window.gaPerfEnd) window.gaPerfEnd(perf, {
      heavyStats
    });
  } catch (err) {
    if (window.gaPerfEnd) {
      window.gaPerfEnd(perf, {
        ok: false,
        message: err && err.message ? String(err.message) : 'route stats failed'
      });
    }
  }
}
function vpExtractOverpassTileFeatures(elements) {
  var obs = [];
  var lin = [];
  if (!Array.isArray(elements)) return {
    obs,
    lin
  };
  var _iterator27 = _createForOfIteratorHelper(elements),
    _step27;
  try {
    for (_iterator27.s(); !(_step27 = _iterator27.n()).done;) {
      var e = _step27.value;
      if (e.type === 'node' && Number.isFinite(e.lat) && Number.isFinite(e.lon)) {
        var isWind = e.tags && e.tags['generator:source'] === 'wind';
        var powerTag = e.tags ? String(e.tags.power || '').toLowerCase() : '';
        var isPowerTower = powerTag === 'tower' || powerTag === 'pole';
        var hRaw = e.tags && e.tags.height ? String(e.tags.height).replace(',', '.') : isWind ? '120' : isPowerTower ? '25' : '50';
        var hMeter = parseFloat(hRaw);
        var minHeightM = isPowerTower ? 18 : 30;
        if (!Number.isFinite(hMeter) || hMeter < minHeightM) continue;
        obs.push({
          type: isWind ? 'wind' : isPowerTower ? 'power_tower' : 'mast',
          hFt: Math.round(hMeter * 3.28084),
          elevFt: 0,
          lat: Number(e.lat),
          lon: Number(e.lon)
        });
        continue;
      }
      if (e.type === 'way' && Array.isArray(e.geometry) && e.tags) {
        var _powerTag = String(e.tags.power || '').toLowerCase();
        var isPowerLine = _powerTag === 'line' || _powerTag === 'minor_line' || _powerTag === 'cable';
        var featType = e.tags.highway ? 'highway' : e.tags.waterway ? 'river' : isPowerLine ? 'powerline' : '';
        if (!featType) continue;
        var refTxt = String(e.tags.ref || '');
        var name = String(e.tags.name || e.tags.ref || e.tags.operator || '');
        var roadKind = featType === 'highway' ? vpInferRoadKindFromText(refTxt, name, String(e.tags.highway || '')) : '';
        if (!name && featType === 'highway') continue;
        var geom = e.geometry;
        var step = Math.max(1, Math.floor(geom.length / 12));
        for (var i = 0; i < geom.length; i += step) {
          var g = geom[i];
          if (!g || !Number.isFinite(g.lat) || !Number.isFinite(g.lon)) continue;
          lin.push({
            type: featType,
            name,
            lineKind: isPowerLine ? _powerTag : roadKind,
            lat: Number(g.lat),
            lon: Number(g.lon)
          });
        }
      }
    }
  } catch (err) {
    _iterator27.e(err);
  } finally {
    _iterator27.f();
  }
  return {
    obs,
    lin
  };
}
function vpParseHostedObstaclePayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (Array.isArray(payload.elements)) return vpExtractOverpassTileFeatures(payload.elements);
  var coreObj = payload.core && typeof payload.core === 'object' ? payload.core : null;
  var obsIn = Array.isArray(payload.obs) ? payload.obs : Array.isArray(coreObj && coreObj.obs) ? coreObj.obs : Array.isArray(payload.features && payload.features.obs) ? payload.features.obs : [];
  var linIn = Array.isArray(payload.lin) ? payload.lin : Array.isArray(coreObj && coreObj.lin) ? coreObj.lin : Array.isArray(payload.features && payload.features.lin) ? payload.features.lin : [];
  var obs = [];
  var lin = [];
  var _iterator28 = _createForOfIteratorHelper(obsIn),
    _step28;
  try {
    for (_iterator28.s(); !(_step28 = _iterator28.n()).done;) {
      var e = _step28.value;
      var lat = Number(e && e.lat);
      var lon = Number(e && e.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      var hFt = Math.max(0, Math.round(Number(e.hFt || 0)));
      obs.push({
        type: String(e.type || 'mast'),
        hFt,
        elevFt: Math.max(0, Math.round(Number(e.elevFt || 0))),
        lat,
        lon
      });
    }
  } catch (err) {
    _iterator28.e(err);
  } finally {
    _iterator28.f();
  }
  var _iterator29 = _createForOfIteratorHelper(linIn),
    _step29;
  try {
    for (_iterator29.s(); !(_step29 = _iterator29.n()).done;) {
      var _e = _step29.value;
      var _lat2 = Number(_e && _e.lat);
      var _lon2 = Number(_e && _e.lon);
      if (!Number.isFinite(_lat2) || !Number.isFinite(_lon2)) continue;
      lin.push({
        type: String(_e.type || 'linear'),
        name: String(_e.name || ''),
        lineKind: String(_e.lineKind || _e.power || _e.powerTag || ''),
        lat: _lat2,
        lon: _lon2
      });
    }
  } catch (err) {
    _iterator29.e(err);
  } finally {
    _iterator29.f();
  }
  return {
    obs,
    lin
  };
}
function vpGetHostedMissRemainingMs(tileKey) {
  var now = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Date.now();
  var entry = vpObsHostedMissCache.get(tileKey);
  if (!entry) return 0;
  return Math.max(0, Number(entry.until || 0) - now);
}
function vpMarkHostedMiss(tileKey) {
  var status = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  var ttlMs = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : VP_OBS_HOSTED_MISS_TTL_MS;
  if (!tileKey) return;
  var jitter = Math.floor(Math.random() * 2000);
  vpObsHostedMissCache.set(tileKey, {
    status: Number(status || 0),
    until: Date.now() + Math.max(60 * 1000, ttlMs) + jitter
  });
}
function vpClearHostedMiss(tileKey) {
  if (!tileKey) return;
  vpObsHostedMissCache.delete(tileKey);
}
function vpFetchHostedObstacleTile(_x4, _x5) {
  return _vpFetchHostedObstacleTile.apply(this, arguments);
}
function _vpFetchHostedObstacleTile() {
  _vpFetchHostedObstacleTile = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee13(tileKey, signal) {
    var b, _String$split$map, _String$split$map2, latI, lonI, dbg, endpoints, timeoutMs, _iterator74, _step74, _loop0, _ret3, _t13;
    return _regenerator().w(function (_context15) {
      while (1) switch (_context15.p = _context15.n) {
        case 0:
          if (VP_OBS_HOSTED_ENABLED) {
            _context15.n = 1;
            break;
          }
          return _context15.a(2, {
            ok: false,
            status: 0,
            src: '',
            hostedSkipped: true
          });
        case 1:
          if (!(vpGetHostedMissRemainingMs(tileKey) > 0)) {
            _context15.n = 2;
            break;
          }
          return _context15.a(2, {
            ok: false,
            status: 0,
            src: 'hosted-miss-cache',
            hostedSkipped: true
          });
        case 2:
          b = vpObsTileBoundsFromKey(tileKey);
          if (b) {
            _context15.n = 3;
            break;
          }
          return _context15.a(2, {
            ok: false,
            status: 0,
            src: ''
          });
        case 3:
          _String$split$map = String(tileKey).split('|').map(Number), _String$split$map2 = _slicedToArray(_String$split$map, 2), latI = _String$split$map2[0], lonI = _String$split$map2[1];
          dbg = window.vpWeatherDebug;
          endpoints = VP_OBS_HOSTED_ENDPOINTS.slice();
          timeoutMs = VP_OBS_HOSTED_TIMEOUT_MS;
          _iterator74 = _createForOfIteratorHelper(endpoints);
          _context15.p = 4;
          _loop0 = /*#__PURE__*/_regenerator().m(function _loop0() {
            var endpoint, ctrl, timer, onAbort, isLocalStaticEndpoint, url, u, res, payload, ds, sourceKind, features, obsCount, linCount, src, host, _t12;
            return _regenerator().w(function (_context14) {
              while (1) switch (_context14.p = _context14.n) {
                case 0:
                  endpoint = _step74.value;
                  if (!(signal && signal.aborted)) {
                    _context14.n = 1;
                    break;
                  }
                  throw new DOMException('Aborted', 'AbortError');
                case 1:
                  ctrl = null;
                  timer = null;
                  onAbort = null;
                  _context14.p = 2;
                  isLocalStaticEndpoint = endpoint.includes('./obstacles/core-tiles/') || endpoint.includes('./obstacles/tiles/');
                  ctrl = vpCreateAbortController();
                  if (signal) {
                    onAbort = () => ctrl.abort();
                    if (signal.aborted) ctrl.abort();else signal.addEventListener('abort', onAbort, {
                      once: true
                    });
                  }
                  timer = setTimeout(() => ctrl.abort(), timeoutMs);
                  url = '';
                  if (endpoint.includes('{latI}') || endpoint.includes('{lonI}')) {
                    url = endpoint.split('{latI}').join(encodeURIComponent(String(latI))).split('{lonI}').join(encodeURIComponent(String(lonI)));
                  } else {
                    u = new URL(endpoint);
                    u.searchParams.set('layer', 'core');
                    u.searchParams.set('tile', tileKey);
                    u.searchParams.set('lat_i', String(latI));
                    u.searchParams.set('lon_i', String(lonI));
                    u.searchParams.set('south', b.south.toFixed(5));
                    u.searchParams.set('west', b.west.toFixed(5));
                    u.searchParams.set('north', b.north.toFixed(5));
                    u.searchParams.set('east', b.east.toFixed(5));
                    u.searchParams.set('v', '3');
                    url = u.toString();
                  }
                  if (dbg) dbg.hostedTileRequests = Number(dbg.hostedTileRequests || 0) + 1;
                  _context14.n = 3;
                  return vpFetchResource(url, {
                    signal: ctrl.signal
                  });
                case 3:
                  res = _context14.v;
                  if (!(res.status === 404 || res.status === 204)) {
                    _context14.n = 5;
                    break;
                  }
                  if (dbg) dbg.hostedTileMisses = Number(dbg.hostedTileMisses || 0) + 1;
                  if (!isLocalStaticEndpoint) {
                    _context14.n = 4;
                    break;
                  }
                  return _context14.a(2, 0);
                case 4:
                  vpMarkHostedMiss(tileKey, res.status);
                  return _context14.a(2, {
                    v: {
                      ok: false,
                      status: res.status,
                      src: endpoint,
                      hostedMiss: true
                    }
                  });
                case 5:
                  if (res.ok) {
                    _context14.n = 6;
                    break;
                  }
                  if (res.status === 400 || res.status === 403) vpMarkHostedMiss(tileKey, res.status, 5 * 60 * 1000);
                  if (dbg) dbg.hostedTileErrors = Number(dbg.hostedTileErrors || 0) + 1;
                  return _context14.a(2, 0);
                case 6:
                  if (!(url.endsWith('.gz') && !window.gaProfileDataProvider)) {
                    _context14.n = 8;
                    break;
                  }
                  ds = new DecompressionStream('gzip');
                  _context14.n = 7;
                  return new Response(res.body.pipeThrough(ds)).json();
                case 7:
                  payload = _context14.v;
                  _context14.n = 10;
                  break;
                case 8:
                  _context14.n = 9;
                  return res.json();
                case 9:
                  payload = _context14.v;
                case 10:
                  sourceKind = String(payload && payload.sourceKind || '').toLowerCase();
                  features = vpParseHostedObstaclePayload(payload);
                  if (features) {
                    _context14.n = 11;
                    break;
                  }
                  if (dbg) dbg.hostedTileErrors = Number(dbg.hostedTileErrors || 0) + 1;
                  return _context14.a(2, 0);
                case 11:
                  obsCount = Array.isArray(features.obs) ? features.obs.length : 0;
                  linCount = Array.isArray(features.lin) ? features.lin.length : 0; // Lokale Split-Tiles koennen vereinzelt als leere Platzhalter vorliegen.
                  // Diese nicht als "ok" akzeptieren, damit Worker/Overpass nachgeladen wird.
                  if (!(isLocalStaticEndpoint && obsCount + linCount === 0)) {
                    _context14.n = 12;
                    break;
                  }
                  if (dbg) dbg.hostedTileMisses = Number(dbg.hostedTileMisses || 0) + 1;
                  return _context14.a(2, 0);
                case 12:
                  vpClearHostedMiss(tileKey);
                  if (dbg) {
                    dbg.hostedTileHits = Number(dbg.hostedTileHits || 0) + 1;
                    if (sourceKind === 'legacy') dbg.hostedTileLegacyHits = Number(dbg.hostedTileLegacyHits || 0) + 1;else dbg.hostedTileCoreHits = Number(dbg.hostedTileCoreHits || 0) + 1;
                  }
                  src = endpoint;
                  try {
                    host = new URL(endpoint).host;
                    src = `${host}:hosted${sourceKind === 'legacy' ? ':legacy' : ':split'}`;
                  } catch (_) {}
                  return _context14.a(2, {
                    v: {
                      ok: true,
                      features,
                      src,
                      hosted: true
                    }
                  });
                case 13:
                  _context14.p = 13;
                  _t12 = _context14.v;
                  if (!(_t12 && _t12.name === 'AbortError')) {
                    _context14.n = 14;
                    break;
                  }
                  if (!(signal && signal.aborted)) {
                    _context14.n = 14;
                    break;
                  }
                  throw _t12;
                case 14:
                  if (dbg) dbg.hostedTileErrors = Number(dbg.hostedTileErrors || 0) + 1;
                case 15:
                  _context14.p = 15;
                  if (timer) clearTimeout(timer);
                  if (signal && onAbort) signal.removeEventListener('abort', onAbort);
                  return _context14.f(15);
                case 16:
                  return _context14.a(2);
              }
            }, _loop0, null, [[2, 13, 15, 16]]);
          });
          _iterator74.s();
        case 5:
          if ((_step74 = _iterator74.n()).done) {
            _context15.n = 9;
            break;
          }
          return _context15.d(_regeneratorValues(_loop0()), 6);
        case 6:
          _ret3 = _context15.v;
          if (!(_ret3 === 0)) {
            _context15.n = 7;
            break;
          }
          return _context15.a(3, 8);
        case 7:
          if (!_ret3) {
            _context15.n = 8;
            break;
          }
          return _context15.a(2, _ret3.v);
        case 8:
          _context15.n = 5;
          break;
        case 9:
          _context15.n = 11;
          break;
        case 10:
          _context15.p = 10;
          _t13 = _context15.v;
          _iterator74.e(_t13);
        case 11:
          _context15.p = 11;
          _iterator74.f();
          return _context15.f(11);
        case 12:
          return _context15.a(2, {
            ok: false,
            status: 0,
            src: '',
            hostedMiss: false
          });
      }
    }, _callee13, null, [[4, 10, 11, 12]]);
  }));
  return _vpFetchHostedObstacleTile.apply(this, arguments);
}
function vpFetchObstacleTile(_x6, _x7) {
  return _vpFetchObstacleTile.apply(this, arguments);
}
function _vpFetchObstacleTile() {
  _vpFetchObstacleTile = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee14(tileKey, signal) {
    var tileIndex,
      options,
      preferOverpass,
      hosted,
      _args16 = arguments;
    return _regenerator().w(function (_context16) {
      while (1) switch (_context16.n) {
        case 0:
          tileIndex = _args16.length > 2 && _args16[2] !== undefined ? _args16[2] : 0;
          options = _args16.length > 3 && _args16[3] !== undefined ? _args16[3] : {};
          preferOverpass = !!(options && options.preferOverpass);
          if (preferOverpass) {
            _context16.n = 2;
            break;
          }
          _context16.n = 1;
          return vpFetchHostedObstacleTile(tileKey, signal);
        case 1:
          hosted = _context16.v;
          if (!(hosted && hosted.ok)) {
            _context16.n = 2;
            break;
          }
          return _context16.a(2, hosted);
        case 2:
          _context16.n = 3;
          return vpFetchOverpassTile(tileKey, signal, tileIndex);
        case 3:
          return _context16.a(2, _context16.v);
      }
    }, _callee14);
  }));
  return _vpFetchObstacleTile.apply(this, arguments);
}
function vpFetchHostedTilesParallel(_x8, _x9) {
  return _vpFetchHostedTilesParallel.apply(this, arguments);
}
function _vpFetchHostedTilesParallel() {
  _vpFetchHostedTilesParallel = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee16(tileKeys, signal) {
    var options,
      keys,
      concurrency,
      results,
      cursor,
      worker,
      workers,
      workerCount,
      i,
      _args18 = arguments;
    return _regenerator().w(function (_context18) {
      while (1) switch (_context18.n) {
        case 0:
          options = _args18.length > 2 && _args18[2] !== undefined ? _args18[2] : {};
          keys = Array.from(new Set((Array.isArray(tileKeys) ? tileKeys : []).filter(Boolean)));
          if (keys.length) {
            _context18.n = 1;
            break;
          }
          return _context18.a(2, new Map());
        case 1:
          concurrency = Math.max(1, Math.min(12, Number(options && options.concurrency || VP_OBS_HOSTED_PARALLELISM)));
          results = new Map();
          cursor = 0;
          worker = /*#__PURE__*/function () {
            var _ref41 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee15() {
              var idx, tileKey, res, _t14;
              return _regenerator().w(function (_context17) {
                while (1) switch (_context17.p = _context17.n) {
                  case 0:
                    if (!(cursor < keys.length)) {
                      _context17.n = 9;
                      break;
                    }
                    if (!(signal && signal.aborted)) {
                      _context17.n = 1;
                      break;
                    }
                    throw new DOMException('Aborted', 'AbortError');
                  case 1:
                    idx = cursor++;
                    tileKey = keys[idx];
                    if (tileKey) {
                      _context17.n = 2;
                      break;
                    }
                    return _context17.a(3, 0);
                  case 2:
                    if (window.vpSetObsTileLoading) window.vpSetObsTileLoading(tileKey, true);
                    if (window.vpSetObsTileDeferred) window.vpSetObsTileDeferred(tileKey, false);
                    _context17.p = 3;
                    _context17.n = 4;
                    return vpFetchHostedObstacleTile(tileKey, signal);
                  case 4:
                    res = _context17.v;
                    results.set(tileKey, res || {
                      ok: false,
                      status: 0,
                      src: ''
                    });
                    _context17.n = 7;
                    break;
                  case 5:
                    _context17.p = 5;
                    _t14 = _context17.v;
                    if (!(_t14 && _t14.name === 'AbortError')) {
                      _context17.n = 6;
                      break;
                    }
                    throw _t14;
                  case 6:
                    results.set(tileKey, {
                      ok: false,
                      status: 0,
                      src: ''
                    });
                  case 7:
                    _context17.p = 7;
                    if (window.vpSetObsTileLoading) window.vpSetObsTileLoading(tileKey, false);
                    return _context17.f(7);
                  case 8:
                    _context17.n = 0;
                    break;
                  case 9:
                    return _context17.a(2);
                }
              }, _callee15, null, [[3, 5, 7, 8]]);
            }));
            return function worker() {
              return _ref41.apply(this, arguments);
            };
          }();
          workers = [];
          workerCount = Math.min(concurrency, keys.length);
          for (i = 0; i < workerCount; i++) workers.push(worker());
          _context18.n = 2;
          return Promise.all(workers);
        case 2:
          return _context18.a(2, results);
      }
    }, _callee16);
  }));
  return _vpFetchHostedTilesParallel.apply(this, arguments);
}
function vpFetchOverpassTile(_x0, _x1) {
  return _vpFetchOverpassTile.apply(this, arguments);
}
function _vpFetchOverpassTile() {
  _vpFetchOverpassTile = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee17(tileKey, signal) {
    var tileIndex,
      b,
      bbox,
      query,
      retries,
      attempt,
      serverUrl,
      res,
      retryAfter,
      cooldownMs,
      json,
      features,
      src,
      _args19 = arguments,
      _t15;
    return _regenerator().w(function (_context19) {
      while (1) switch (_context19.p = _context19.n) {
        case 0:
          tileIndex = _args19.length > 2 && _args19[2] !== undefined ? _args19[2] : 0;
          b = vpObsTileBoundsFromKey(tileKey);
          if (b) {
            _context19.n = 1;
            break;
          }
          return _context19.a(2, {
            ok: false,
            cooldown: false
          });
        case 1:
          if (window.vpSetObsTileDeferred) window.vpSetObsTileDeferred(tileKey, false);
          if (window.vpSetObsTileLoading) window.vpSetObsTileLoading(tileKey, true);
          bbox = `${b.south.toFixed(4)},${b.west.toFixed(4)},${b.north.toFixed(4)},${b.east.toFixed(4)}`;
          query = `[out:json][timeout:45][bbox:${bbox}];(node["generator:source"="wind"];node["man_made"~"mast|tower"]["height"];node["power"~"tower|pole"];way["highway"~"motorway|motorway_link|trunk|trunk_link|primary|primary_link"];way["waterway"~"river|canal"];way["power"~"line|minor_line|cable"];);out geom qt;`;
          retries = 1;
          attempt = 0;
          _context19.p = 2;
        case 3:
          if (!(retries > 0)) {
            _context19.n = 16;
            break;
          }
          if (!(signal && signal.aborted)) {
            _context19.n = 4;
            break;
          }
          throw new DOMException('Aborted', 'AbortError');
        case 4:
          window.vpServerOffset = (window.vpServerOffset || 0) + 1;
          serverUrl = VP_OVERPASS_SERVERS[(tileIndex + attempt + window.vpServerOffset) % VP_OVERPASS_SERVERS.length];
          attempt++;
          _context19.p = 5;
          _context19.n = 6;
          return vpFetchResource(serverUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `data=${encodeURIComponent(query)}`,
            signal
          });
        case 6:
          res = _context19.v;
          if (!(res.status === 429)) {
            _context19.n = 7;
            break;
          }
          if (window.vpWeatherDebug) window.vpWeatherDebug.overpass429Count += 1;
          retryAfter = Number(res.headers.get('retry-after') || 0);
          cooldownMs = vpApplyOverpassBackoff(429, retryAfter);
          console.warn(`[Overpass] Tile ${tileKey}: 429. Cooldown ${(cooldownMs / 60000).toFixed(1)} min.`);
          return _context19.a(2, {
            ok: false,
            cooldown: true,
            status: 429,
            src: serverUrl
          });
        case 7:
          if (!(res.status === 504)) {
            _context19.n = 8;
            break;
          }
          if (window.vpWeatherDebug) window.vpWeatherDebug.overpass504Count += 1;
          console.warn(`[Overpass] Tile ${tileKey}: 504 (tile-lokales Backoff).`);
          return _context19.a(2, {
            ok: false,
            cooldown: false,
            status: 504,
            src: serverUrl,
            tileBackoff: true
          });
        case 8:
          if (res.ok) {
            _context19.n = 10;
            break;
          }
          retries--;
          _context19.n = 9;
          return new Promise(r => setTimeout(r, 1500));
        case 9:
          return _context19.a(3, 3);
        case 10:
          _context19.n = 11;
          return res.json();
        case 11:
          json = _context19.v;
          if (!(!json || !Array.isArray(json.elements))) {
            _context19.n = 12;
            break;
          }
          console.warn(`[Overpass] Tile ${tileKey}: Antwort unvollständig (kein elements[]).`);
          return _context19.a(2, {
            ok: false,
            cooldown: false,
            status: 520,
            src: serverUrl
          });
        case 12:
          features = vpExtractOverpassTileFeatures(json && json.elements);
          src = serverUrl;
          try {
            src = new URL(serverUrl).host;
          } catch (_) {}
          return _context19.a(2, {
            ok: true,
            features,
            src
          });
        case 13:
          _context19.p = 13;
          _t15 = _context19.v;
          if (!(_t15 && _t15.name === 'AbortError')) {
            _context19.n = 14;
            break;
          }
          throw _t15;
        case 14:
          retries--;
          if (!(retries > 0)) {
            _context19.n = 15;
            break;
          }
          _context19.n = 15;
          return new Promise(r => setTimeout(r, 1200));
        case 15:
          _context19.n = 3;
          break;
        case 16:
          return _context19.a(2, {
            ok: false,
            cooldown: false,
            status: 0,
            src: ''
          });
        case 17:
          _context19.p = 17;
          if (window.vpSetObsTileLoading) window.vpSetObsTileLoading(tileKey, false);
          return _context19.f(17);
        case 18:
          return _context19.a(2);
      }
    }, _callee17, null, [[5, 13], [2,, 17, 18]]);
  }));
  return _vpFetchOverpassTile.apply(this, arguments);
}
function fetchProfileObstacles(_x10, _x11) {
  return _fetchProfileObstacles.apply(this, arguments);
} // GPS-zentrierte Hindernisse laden (ohne Flugplan, Tile-Modus: Center + 8 Nachbartiles)
function _fetchProfileObstacles() {
  _fetchProfileObstacles = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee18(elevData, signal) {
    var routeCacheKey,
      forceNetwork,
      remainingMs,
      remainingMin,
      seededCd,
      probe,
      allKeys,
      toLoadAll,
      nowTs,
      readyKeys,
      blockedKeys,
      maxPerPass,
      toLoad,
      deferredTileKeys,
      interDelayMs,
      nextTileRetryMs,
      usedServers,
      loadedTileKeys,
      failedTileKeys,
      hostedLoadedCount,
      hostedAttemptCount,
      latestSeededProjection,
      obsPoolProjectionDirty,
      overpassCandidates,
      hostedBatchSize,
      hostedKeys,
      hostedResMap,
      hostedMissKeys,
      hostedObsBatch,
      hostedLinBatch,
      _iterator75,
      _step75,
      _loop1,
      hostedKeySet,
      seededHosted,
      seeded,
      sourceLabelNoOp,
      _loop10,
      _ret4,
      i,
      seededFinal,
      sourceLabel,
      _args22 = arguments,
      _t16;
    return _regenerator().w(function (_context22) {
      while (1) switch (_context22.p = _context22.n) {
        case 0:
          routeCacheKey = _args22.length > 2 && _args22[2] !== undefined ? _args22[2] : '';
          forceNetwork = _args22.length > 3 && _args22[3] !== undefined ? _args22[3] : false;
          if (!(!elevData || elevData.length < 2)) {
            _context22.n = 1;
            break;
          }
          return _context22.a(2, null);
        case 1:
          if (!(!forceNetwork && vpIsOverpassCoolingDown())) {
            _context22.n = 2;
            break;
          }
          remainingMs = vpGetOverpassCooldownRemainingMs();
          remainingMin = Math.max(1, Math.ceil(remainingMs / 60000));
          if (window.vpWeatherDebug) window.vpWeatherDebug.overpassCooldownSkips += 1;
          console.warn(`[Overpass] Cooldown aktiv (${remainingMin} min). Nutze Cache/Bestand, kein Netz-Request.`);
          seededCd = vpProjectObsPoolToRoute(elevData);
          return _context22.a(2, {
            obs: seededCd.obs || [],
            lin: seededCd.lin || [],
            source: 'cooldown-cache',
            loadedTileKeys: [],
            failedTileKeys: []
          });
        case 2:
          if (window.vpWeatherDebug) window.vpWeatherDebug.overpassRequests += 1;
          probe = vpGetRouteTileCoverageProbe(elevData);
          allKeys = Array.from(vpCollectRouteTileKeys(elevData));
          toLoadAll = forceNetwork ? allKeys : probe.missing.slice();
          nowTs = Date.now();
          readyKeys = toLoadAll.filter(k => forceNetwork || !vpIsTileBackoffActive(k, nowTs));
          blockedKeys = toLoadAll.filter(k => !readyKeys.includes(k));
          maxPerPass = forceNetwork ? VP_OBS_TILE_MAX_PER_PASS_FORCE : VP_OBS_TILE_MAX_PER_PASS;
          toLoad = [];
          deferredTileKeys = [];
          interDelayMs = VP_OBS_TILE_INTER_REQUEST_MS;
          nextTileRetryMs = vpMinTileBackoffRemainingMs(blockedKeys, nowTs);
          usedServers = new Set();
          loadedTileKeys = [];
          failedTileKeys = [];
          hostedLoadedCount = 0;
          hostedAttemptCount = 0;
          latestSeededProjection = null;
          obsPoolProjectionDirty = true; // Phase 1: Hosted-Tiles parallel laden (schnell), Overpass erst danach.
          overpassCandidates = readyKeys.slice();
          if (!(readyKeys.length > 0)) {
            _context22.n = 11;
            break;
          }
          hostedBatchSize = Math.min(VP_OBS_HOSTED_MAX_PER_PASS, readyKeys.length);
          hostedKeys = readyKeys.slice(0, hostedBatchSize);
          hostedAttemptCount = hostedKeys.length;
          if (!(hostedKeys.length > 0)) {
            _context22.n = 11;
            break;
          }
          _context22.n = 3;
          return vpFetchHostedTilesParallel(hostedKeys, signal, {
            concurrency: VP_OBS_HOSTED_PARALLELISM
          });
        case 3:
          hostedResMap = _context22.v;
          hostedMissKeys = [];
          hostedObsBatch = [];
          hostedLinBatch = [];
          _iterator75 = _createForOfIteratorHelper(hostedKeys);
          _context22.p = 4;
          _loop1 = /*#__PURE__*/_regenerator().m(function _loop1() {
            var key, res;
            return _regenerator().w(function (_context20) {
              while (1) switch (_context20.n) {
                case 0:
                  key = _step75.value;
                  res = hostedResMap.get(key);
                  if (res && res.ok) {
                    vpClearTileFailed(key);
                    vpClearTileBackoff(key);
                    if (res.src) usedServers.add(res.src);
                    if (res.features) {
                      (res.features.obs || []).forEach(item => hostedObsBatch.push(_objectSpread(_objectSpread({}, item), {}, {
                        tileKey: String(item && item.tileKey || key)
                      })));
                      (res.features.lin || []).forEach(item => hostedLinBatch.push(_objectSpread(_objectSpread({}, item), {}, {
                        tileKey: String(item && item.tileKey || key)
                      })));
                    }
                    vpMarkTileKeysCovered([key], res.src || 'hosted');
                    loadedTileKeys.push(key);
                    hostedLoadedCount++;
                  } else {
                    hostedMissKeys.push(key);
                  }
                case 1:
                  return _context20.a(2);
              }
            }, _loop1);
          });
          _iterator75.s();
        case 5:
          if ((_step75 = _iterator75.n()).done) {
            _context22.n = 7;
            break;
          }
          return _context22.d(_regeneratorValues(_loop1()), 6);
        case 6:
          _context22.n = 5;
          break;
        case 7:
          _context22.n = 9;
          break;
        case 8:
          _context22.p = 8;
          _t16 = _context22.v;
          _iterator75.e(_t16);
        case 9:
          _context22.p = 9;
          _iterator75.f();
          return _context22.f(9);
        case 10:
          if (hostedObsBatch.length || hostedLinBatch.length) {
            vpRememberObstacleData(hostedObsBatch, hostedLinBatch);
            obsPoolProjectionDirty = true;
          }
          hostedKeySet = new Set(hostedKeys);
          overpassCandidates = hostedMissKeys.concat(readyKeys.filter(k => !hostedKeySet.has(k)));
          if (hostedLoadedCount > 0) {
            seededHosted = vpProjectObsPoolToRoute(elevData);
            latestSeededProjection = seededHosted;
            obsPoolProjectionDirty = false;
            requestAnimationFrame(() => {
              if (signal && signal.aborted) return;
              vpObstacles = seededHosted.obs || [];
              vpLinearFeatures = seededHosted.lin || [];
              window.vpBgNeedsUpdate = true;
              if (typeof window.vpScheduleProfileRender === 'function') window.vpScheduleProfileRender('overpass-hosted-seed', 80);else if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
            });
          }
        case 11:
          toLoad = overpassCandidates.slice(0, Math.max(1, maxPerPass));
          deferredTileKeys = overpassCandidates.slice(toLoad.length).concat(blockedKeys);
          interDelayMs = overpassCandidates.length > maxPerPass ? VP_OBS_TILE_INTER_REQUEST_LONG_MS : VP_OBS_TILE_INTER_REQUEST_MS;
          if (window.vpWeatherDebug) {
            window.vpWeatherDebug.overpassLastDeferredCount = deferredTileKeys.length;
            if (deferredTileKeys.length > 0) {
              window.vpWeatherDebug.overpassDeferredRuns = Number(window.vpWeatherDebug.overpassDeferredRuns || 0) + 1;
              window.vpWeatherDebug.overpassDeferredTilesTotal = Number(window.vpWeatherDebug.overpassDeferredTilesTotal || 0) + deferredTileKeys.length;
            }
          }
          if (window.vpSetObsTileDeferred) {
            window.vpSetObsTileDeferred('__RESET__', false);
            if (deferredTileKeys.length > 0) window.vpSetObsTileDeferred(deferredTileKeys, true);
          }
          if (toLoad.length) {
            _context22.n = 12;
            break;
          }
          seeded = !obsPoolProjectionDirty && latestSeededProjection ? latestSeededProjection : vpProjectObsPoolToRoute(elevData);
          sourceLabelNoOp = usedServers.size > 0 ? Array.from(usedServers).join(',') : 'tile-cache';
          return _context22.a(2, {
            obs: seeded.obs || [],
            lin: seeded.lin || [],
            source: sourceLabelNoOp,
            loadedTileKeys,
            failedTileKeys: [],
            deferredTileKeys: deferredTileKeys || [],
            nextTileRetryMs
          });
        case 12:
          console.log(`[Overpass] Tile-Modus: hosted ${hostedLoadedCount}/${hostedAttemptCount} ok, overpass ${toLoad.length}/${overpassCandidates.length} jetzt laden, ${deferredTileKeys.length} defer${routeCacheKey ? ` [${routeCacheKey.slice(0, 24)}]` : ''}.`);
          _loop10 = /*#__PURE__*/_regenerator().m(function _loop10() {
            var remainSec, tileKey, res, waitMs, j, seededLive;
            return _regenerator().w(function (_context21) {
              while (1) switch (_context21.n) {
                case 0:
                  if (!(signal && signal.aborted)) {
                    _context21.n = 1;
                    break;
                  }
                  throw new DOMException('Aborted', 'AbortError');
                case 1:
                  if (!(!forceNetwork && vpIsOverpassCoolingDown())) {
                    _context21.n = 2;
                    break;
                  }
                  remainSec = Math.ceil(vpGetOverpassCooldownRemainingMs() / 1000);
                  console.warn(`[Overpass] Tile-Queue pausiert (Cooldown ${remainSec}s).`);
                  failedTileKeys.push.apply(failedTileKeys, _toConsumableArray(toLoad.slice(i)));
                  return _context21.a(2, 0);
                case 2:
                  tileKey = toLoad[i];
                  _context21.n = 3;
                  return vpFetchObstacleTile(tileKey, signal, i, {
                    preferOverpass: !!forceNetwork
                  });
                case 3:
                  res = _context21.v;
                  if (!(!res || !res.ok)) {
                    _context21.n = 5;
                    break;
                  }
                  vpMarkTileFailed(tileKey, Number(res && res.status || 0), String(res && res.src || ''));
                  if (res && res.tileBackoff) {
                    waitMs = vpMarkTileBackoff(tileKey);
                    console.warn(`[Overpass] Tile ${tileKey} pausiert für ${(waitMs / 1000).toFixed(0)}s.`);
                  }
                  if (window.vpSetObsTileDeferred) window.vpSetObsTileDeferred(tileKey, false);
                  failedTileKeys.push(tileKey);
                  if (!(res && res.cooldown)) {
                    _context21.n = 4;
                    break;
                  }
                  failedTileKeys.push.apply(failedTileKeys, _toConsumableArray(toLoad.slice(i + 1)));
                  for (j = i + 1; j < toLoad.length; j++) vpMarkTileFailed(toLoad[j], Number(res && res.status || 0), String(res && res.src || ''));
                  return _context21.a(2, 0);
                case 4:
                  return _context21.a(2, 1);
                case 5:
                  vpClearTileFailed(tileKey);
                  vpClearTileBackoff(tileKey);
                  if (window.vpSetObsTileDeferred) window.vpSetObsTileDeferred(tileKey, false);
                  if (res.src) usedServers.add(res.src);
                  if (res.features) {
                    vpRememberObstacleData(res.features.obs || [], res.features.lin || [], tileKey);
                    obsPoolProjectionDirty = true;
                  }
                  vpMarkTileKeysCovered([tileKey], res.src || 'overpass');
                  loadedTileKeys.push(tileKey);
                  vpMarkOverpassSuccess();
                  if (i < toLoad.length - 1) {
                    seededLive = vpProjectObsPoolToRoute(elevData);
                    latestSeededProjection = seededLive;
                    obsPoolProjectionDirty = false;
                    requestAnimationFrame(() => {
                      if (signal && signal.aborted) return;
                      vpObstacles = seededLive.obs || [];
                      vpLinearFeatures = seededLive.lin || [];
                      window.vpBgNeedsUpdate = true;
                      if (typeof window.vpScheduleProfileRender === 'function') window.vpScheduleProfileRender('overpass-live-seed', 80);else if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
                    });
                  }
                  if (!(i < toLoad.length - 1)) {
                    _context21.n = 6;
                    break;
                  }
                  _context21.n = 6;
                  return new Promise(r => setTimeout(r, interDelayMs));
                case 6:
                  return _context21.a(2);
              }
            }, _loop10);
          });
          i = 0;
        case 13:
          if (!(i < toLoad.length)) {
            _context22.n = 17;
            break;
          }
          return _context22.d(_regeneratorValues(_loop10()), 14);
        case 14:
          _ret4 = _context22.v;
          if (!(_ret4 === 0)) {
            _context22.n = 15;
            break;
          }
          return _context22.a(3, 17);
        case 15:
          if (!(_ret4 === 1)) {
            _context22.n = 16;
            break;
          }
          return _context22.a(3, 16);
        case 16:
          i++;
          _context22.n = 13;
          break;
        case 17:
          if (failedTileKeys.length > 0) {
            window.vpFailedOverpassChunks = failedTileKeys.map(k => ({
              tileKey: k
            }));
          } else {
            window.vpFailedOverpassChunks = [];
          }
          if (typeof window.updateOverpassErrorUI === 'function') window.updateOverpassErrorUI();
          seededFinal = !obsPoolProjectionDirty && latestSeededProjection ? latestSeededProjection : vpProjectObsPoolToRoute(elevData);
          vpObstacles = seededFinal.obs || [];
          vpLinearFeatures = seededFinal.lin || [];
          sourceLabel = usedServers.size > 0 ? Array.from(usedServers).join(',') : 'tile-cache';
          window.vpLastObsTileSource = sourceLabel;
          console.log(`[Overpass] Tile-Queue fertig. geladen=${loadedTileKeys.length}, failed=${failedTileKeys.length}, deferred=${deferredTileKeys.length}`);
          return _context22.a(2, {
            obs: vpObstacles,
            lin: vpLinearFeatures,
            source: sourceLabel,
            loadedTileKeys,
            failedTileKeys,
            deferredTileKeys,
            nextTileRetryMs
          });
      }
    }, _callee18, null, [[4, 8, 9, 10]]);
  }));
  return _fetchProfileObstacles.apply(this, arguments);
}
function fetchGpsObstacles(_x12, _x13) {
  return _fetchGpsObstacles.apply(this, arguments);
}
function _fetchGpsObstacles() {
  _fetchGpsObstacles = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee19(lat, lon) {
    var centerKey, _centerKey$split$map, _centerKey$split$map2, latI, lonI, tileKeys, dy, dx, probe, missing, hostedBatchSize, hostedKeys, hostedResults, hostedOk, _iterator76, _step76, key, _res, _res$features5, _res$features6, restHosted, overpassKeys, i, tileKey, res, _res$features3, _res$features4, rawObs, _iterator77, _step77, item, nav, buckets, finalObs, _i32, _Object$keys, k, group, rep, _t17, _t18;
    return _regenerator().w(function (_context23) {
      while (1) switch (_context23.p = _context23.n) {
        case 0:
          centerKey = vpObsTileKey(lat, lon);
          _centerKey$split$map = centerKey.split('|').map(Number), _centerKey$split$map2 = _slicedToArray(_centerKey$split$map, 2), latI = _centerKey$split$map2[0], lonI = _centerKey$split$map2[1];
          tileKeys = [];
          for (dy = -1; dy <= 1; dy++) {
            for (dx = -1; dx <= 1; dx++) {
              tileKeys.push(`${latI + dy}|${lonI + dx}`);
            }
          }
          probe = vpGetRouteTileCoverageProbe(tileKeys.map(k => {
            var b = vpObsTileBoundsFromKey(k);
            return b ? {
              lat: (b.south + b.north) / 2,
              lon: (b.west + b.east) / 2
            } : null;
          }).filter(Boolean));
          missing = probe.missing || [];
          if (!(!vpIsOverpassCoolingDown() && missing.length > 0)) {
            _context23.n = 11;
            break;
          }
          hostedBatchSize = Math.min(VP_OBS_HOSTED_MAX_PER_PASS, missing.length);
          hostedKeys = missing.slice(0, hostedBatchSize);
          _context23.n = 1;
          return vpFetchHostedTilesParallel(hostedKeys, null, {
            concurrency: VP_OBS_HOSTED_PARALLELISM
          });
        case 1:
          hostedResults = _context23.v;
          hostedOk = new Set();
          _iterator76 = _createForOfIteratorHelper(hostedKeys);
          try {
            for (_iterator76.s(); !(_step76 = _iterator76.n()).done;) {
              key = _step76.value;
              _res = hostedResults.get(key);
              if (_res && _res.ok) {
                hostedOk.add(key);
                vpClearTileFailed(key);
                vpClearTileBackoff(key);
                vpRememberObstacleData(((_res$features5 = _res.features) === null || _res$features5 === void 0 ? void 0 : _res$features5.obs) || [], ((_res$features6 = _res.features) === null || _res$features6 === void 0 ? void 0 : _res$features6.lin) || [], key);
                vpMarkTileKeysCovered([key], _res.src || 'gps-hosted');
              }
            }
          } catch (err) {
            _iterator76.e(err);
          } finally {
            _iterator76.f();
          }
          restHosted = missing.filter(k => !hostedOk.has(k));
          overpassKeys = restHosted.slice(0, Math.max(1, VP_OBS_TILE_MAX_PER_PASS));
          i = 0;
        case 2:
          if (!(i < overpassKeys.length)) {
            _context23.n = 11;
            break;
          }
          tileKey = overpassKeys[i];
          _context23.p = 3;
          _context23.n = 4;
          return vpFetchOverpassTile(tileKey, null, i);
        case 4:
          res = _context23.v;
          if (!(res && res.ok)) {
            _context23.n = 5;
            break;
          }
          vpClearTileFailed(tileKey);
          vpClearTileBackoff(tileKey);
          vpRememberObstacleData(((_res$features3 = res.features) === null || _res$features3 === void 0 ? void 0 : _res$features3.obs) || [], ((_res$features4 = res.features) === null || _res$features4 === void 0 ? void 0 : _res$features4.lin) || [], tileKey);
          vpMarkTileKeysCovered([tileKey], res.src || 'gps-overpass');
          vpMarkOverpassSuccess();
          _context23.n = 7;
          break;
        case 5:
          if (!(res && res.cooldown)) {
            _context23.n = 6;
            break;
          }
          vpMarkTileFailed(tileKey, Number(res.status || 0), String(res.src || ''));
          return _context23.a(3, 11);
        case 6:
          vpMarkTileFailed(tileKey, Number(res && res.status || 0), String(res && res.src || ''));
          if (res && res.tileBackoff) vpMarkTileBackoff(tileKey);
        case 7:
          _context23.n = 9;
          break;
        case 8:
          _context23.p = 8;
          _t17 = _context23.v;
          vpMarkTileFailed(tileKey, 0, '');
          console.warn('[GPS-Obs] Tile-Fehler:', _t17);
        case 9:
          if (!(i < overpassKeys.length - 1)) {
            _context23.n = 10;
            break;
          }
          _context23.n = 10;
          return new Promise(r => setTimeout(r, VP_OBS_TILE_INTER_REQUEST_MS));
        case 10:
          i++;
          _context23.n = 2;
          break;
        case 11:
          vpHydrateObsPool();
          rawObs = [];
          _iterator77 = _createForOfIteratorHelper(vpObsPool.obs.values());
          _context23.p = 12;
          _iterator77.s();
        case 13:
          if ((_step77 = _iterator77.n()).done) {
            _context23.n = 17;
            break;
          }
          item = _step77.value;
          if (!(!item || !Number.isFinite(item.lat) || !Number.isFinite(item.lon))) {
            _context23.n = 14;
            break;
          }
          return _context23.a(3, 16);
        case 14:
          nav = calcNav(lat, lon, item.lat, item.lon);
          if (!(!Number.isFinite(nav.dist) || nav.dist > 22)) {
            _context23.n = 15;
            break;
          }
          return _context23.a(3, 16);
        case 15:
          rawObs.push({
            type: item.type || 'mast',
            hFt: Number(item.hFt || 0),
            distNM: nav.dist,
            elevFt: Number(item.elevFt || 0),
            groundElevFt: 0,
            lat: Number(item.lat),
            lon: Number(item.lon)
          });
        case 16:
          _context23.n = 13;
          break;
        case 17:
          _context23.n = 19;
          break;
        case 18:
          _context23.p = 18;
          _t18 = _context23.v;
          _iterator77.e(_t18);
        case 19:
          _context23.p = 19;
          _iterator77.f();
          return _context23.f(19);
        case 20:
          buckets = {};
          rawObs.forEach(obs => {
            var bIdx = Math.floor(obs.distNM / 0.5);
            if (!buckets[bIdx]) buckets[bIdx] = [];
            buckets[bIdx].push(obs);
          });
          finalObs = [];
          for (_i32 = 0, _Object$keys = Object.keys(buckets); _i32 < _Object$keys.length; _i32++) {
            k = _Object$keys[_i32];
            group = buckets[k].sort((a, b) => b.hFt - a.hFt);
            rep = group[0];
            rep.count = group.length;
            finalObs.push(rep);
          }
          vpObstacles = finalObs;
          window.vpBgNeedsUpdate = true;
          if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
          console.log(`[GPS-Obs] ${finalObs.length} Hindernisse aus Tile-Cache/Netz (${missing.length} fehlende Tiles geprüft).`);
        case 21:
          return _context23.a(2);
      }
    }, _callee19, null, [[12, 18, 19, 20], [3, 8]]);
  }));
  return _fetchGpsObstacles.apply(this, arguments);
}
window.fetchGpsObstacles = fetchGpsObstacles;
function vpIsSarHeliProfileMission() {
  try {
    return !!(typeof currentMissionData !== 'undefined' && currentMissionData && typeof window.missionIsSarHeliMission === 'function' && window.missionIsSarHeliMission(currentMissionData));
  } catch (_) {
    return false;
  }
}
function vpRouteWaypointDistances() {
  var points = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : routeWaypoints;
  if (!Array.isArray(points) || points.length < 1 || typeof calcNav !== 'function') return [];
  var out = [0];
  var total = 0;
  for (var i = 1; i < points.length; i++) {
    var _prev$lng, _curr$lng;
    var prev = points[i - 1] || {};
    var curr = points[i] || {};
    var pLat = Number(prev.lat);
    var pLon = Number((_prev$lng = prev.lng) !== null && _prev$lng !== void 0 ? _prev$lng : prev.lon);
    var cLat = Number(curr.lat);
    var cLon = Number((_curr$lng = curr.lng) !== null && _curr$lng !== void 0 ? _curr$lng : curr.lon);
    if (![pLat, pLon, cLat, cLon].every(Number.isFinite)) {
      out.push(total);
      continue;
    }
    var nav = calcNav(pLat, pLon, cLat, cLon);
    total += Number.isFinite(Number(nav === null || nav === void 0 ? void 0 : nav.dist)) ? Math.max(0, Number(nav.dist)) : 0;
    out.push(total);
  }
  return out;
}
function vpSampleElevationFtAtDist() {
  var _first$elevFt, _last$elevFt;
  var elevationData = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  var distNm = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  var fallbackFt = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
  if (!Array.isArray(elevationData) || elevationData.length < 1) return Math.round(Number(fallbackFt) || 0);
  var dist = Number(distNm);
  if (!Number.isFinite(dist)) return Math.round(Number(fallbackFt) || 0);
  var first = elevationData[0];
  var last = elevationData[elevationData.length - 1];
  if (dist <= Number((first === null || first === void 0 ? void 0 : first.distNM) || 0)) return Math.round(Number((_first$elevFt = first === null || first === void 0 ? void 0 : first.elevFt) !== null && _first$elevFt !== void 0 ? _first$elevFt : fallbackFt) || 0);
  if (dist >= Number((last === null || last === void 0 ? void 0 : last.distNM) || 0)) return Math.round(Number((_last$elevFt = last === null || last === void 0 ? void 0 : last.elevFt) !== null && _last$elevFt !== void 0 ? _last$elevFt : fallbackFt) || 0);
  for (var i = 0; i < elevationData.length - 1; i++) {
    var _a$elevFt, _b$elevFt;
    var a = elevationData[i] || {};
    var b = elevationData[i + 1] || {};
    var ad = Number(a.distNM);
    var bd = Number(b.distNM);
    if (!Number.isFinite(ad) || !Number.isFinite(bd) || dist < ad || dist > bd) continue;
    var f = (dist - ad) / Math.max(0.001, bd - ad);
    var ae = Number((_a$elevFt = a.elevFt) !== null && _a$elevFt !== void 0 ? _a$elevFt : fallbackFt) || 0;
    var be = Number((_b$elevFt = b.elevFt) !== null && _b$elevFt !== void 0 ? _b$elevFt : ae) || ae;
    return Math.round(ae + f * (be - ae));
  }
  return Math.round(Number(fallbackFt) || 0);
}
function vpWaypointAltitudeFt() {
  var _ref7, _point$altFt;
  var point = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
  var distNm = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  var elevationData = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  var explicit = Number((_ref7 = (_point$altFt = point === null || point === void 0 ? void 0 : point.altFt) !== null && _point$altFt !== void 0 ? _point$altFt : point === null || point === void 0 ? void 0 : point.elevationFt) !== null && _ref7 !== void 0 ? _ref7 : point === null || point === void 0 ? void 0 : point.elevation);
  if (Number.isFinite(explicit)) return Math.max(0, Math.round(explicit));
  return Math.max(0, vpSampleElevationFtAtDist(elevationData, distNm, 0));
}
function vpApplySarHeliAltitudeConstraints() {
  var _vpElevationData, _document$getElementB2, _document$getElementB3;
  var cacheKey = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  if (!vpIsSarHeliProfileMission()) return false;
  if (!Array.isArray(routeWaypoints) || routeWaypoints.length < 3 || !Array.isArray(vpElevationData) || vpElevationData.length < 2) return false;
  if (Array.isArray(vpAltWaypoints) && vpAltWaypoints.length > 0 && window._vpAutoSarHeliAltRouteKey !== cacheKey) return false;
  if (window._vpAutoSarHeliAltRouteKey === cacheKey && Array.isArray(vpAltWaypoints) && vpAltWaypoints.length >= 3) return true;
  var distances = vpRouteWaypointDistances(routeWaypoints);
  var totalDist = Number(((_vpElevationData = vpElevationData[vpElevationData.length - 1]) === null || _vpElevationData === void 0 ? void 0 : _vpElevationData.distNM) || distances[distances.length - 1] || 0);
  var incidentIdx = routeWaypoints.findIndex(wp => (wp === null || wp === void 0 ? void 0 : wp.isSarHeliIncident) || (wp === null || wp === void 0 ? void 0 : wp.simHoldAction) === 'sar_heli_recovery');
  var targetIdx = incidentIdx >= 0 ? incidentIdx : 1;
  var hospitalIdxRaw = routeWaypoints.findIndex(wp => wp === null || wp === void 0 ? void 0 : wp.isSarHeliHospital);
  var hospitalIdx = hospitalIdxRaw >= 0 ? hospitalIdxRaw : routeWaypoints.length - 1;
  var targetDist = Number(distances[targetIdx]);
  var hospitalDist = Number(distances[hospitalIdx]);
  if (!Number.isFinite(targetDist) || targetDist <= 0.05 || !Number.isFinite(hospitalDist) || hospitalDist <= targetDist) return false;
  var startAlt = vpWaypointAltitudeFt(routeWaypoints[0], 0, vpElevationData);
  var targetAlt = vpWaypointAltitudeFt(routeWaypoints[targetIdx], targetDist, vpElevationData);
  var hospitalAlt = vpWaypointAltitudeFt(routeWaypoints[hospitalIdx], Math.min(totalDist, hospitalDist), vpElevationData);
  var constraints = [{
    distNM: 0,
    altFt: startAlt
  }, {
    distNM: Math.max(0, Math.min(totalDist, targetDist)),
    altFt: targetAlt
  }, {
    distNM: Math.max(0, totalDist),
    altFt: hospitalAlt
  }].filter((wp, idx, arr) => idx === 0 || Math.abs(wp.distNM - arr[idx - 1].distNM) > 0.05);
  if (constraints.length < 3) return false;
  var cruiseAlt = parseInt(((_document$getElementB2 = document.getElementById('altMapInput')) === null || _document$getElementB2 === void 0 ? void 0 : _document$getElementB2.textContent) || ((_document$getElementB3 = document.getElementById('altSlider')) === null || _document$getElementB3 === void 0 ? void 0 : _document$getElementB3.value) || 4500);
  var medLegNm = Math.max(0, hospitalDist - targetDist);
  var lowMedicalCruise = Math.ceil((Math.max(targetAlt, hospitalAlt) + 1200) / 100) * 100;
  var hospitalLegAlt = medLegNm > 0 && medLegNm <= 18 ? Math.min(cruiseAlt, Math.max(lowMedicalCruise, Math.max(targetAlt, hospitalAlt) + 500)) : cruiseAlt;
  vpAltWaypoints = constraints.map(wp => ({
    distNM: Math.round(wp.distNM * 100) / 100,
    altFt: Math.round(wp.altFt)
  }));
  vpSegmentAlts = [];
  for (var i = 0; i < vpAltWaypoints.length - 1; i++) {
    vpSegmentAlts.push(i === 1 ? hospitalLegAlt : cruiseAlt);
  }
  window._vpAutoSarHeliAltRouteKey = cacheKey;
  return true;
}
function vpRouteWaypointLabel(index) {
  var _currentMissionData;
  var point = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
  var wp = point || (Array.isArray(routeWaypoints) ? routeWaypoints[index] : null) || {};
  var isLast = Array.isArray(routeWaypoints) && index === routeWaypoints.length - 1;
  var missionLikePoi = !!(typeof currentMissionData !== 'undefined' && currentMissionData && (currentMissionData.poiName || currentMissionData.poiPresentation || typeof missionUsesPoiTaskRecipe === 'function' && missionUsesPoiTaskRecipe(currentMissionData)));
  var isSarHeliFinal = !!(isLast && (wp.isSarHeliHospital || vpIsSarHeliProfileMission()));
  if (index === 0) return currentStartICAO || 'DEP';
  if (isSarHeliFinal) return String(wp.name || ((_currentMissionData = currentMissionData) === null || _currentMissionData === void 0 || (_currentMissionData = _currentMissionData.sarHeli) === null || _currentMissionData === void 0 || (_currentMissionData = _currentMissionData.hospitalRef) === null || _currentMissionData === void 0 ? void 0 : _currentMissionData.name) || currentDestICAO || 'HOSP').replace(/^🏥\s*/, '');
  if (isLast) return missionLikePoi ? currentStartICAO || 'HOME' : currentDestICAO || 'DEST';
  return wp.name ? String(wp.name).replace(/^RPP\s+/i, '').replace(/^APT\s+/i, '').replace(/^🚁\s*/, '').split(' ')[0] : `WP${index}`;
}
window.vpHardReloadRouteProfile = function () {
  var reason = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'route-change';
  if (!Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return false;
  if (vpProfileFastTimeout) {
    clearTimeout(vpProfileFastTimeout);
    vpProfileFastTimeout = null;
  }
  if (vpProfileSlowTimeout) {
    clearTimeout(vpProfileSlowTimeout);
    vpProfileSlowTimeout = null;
  }
  if (window.vpFetchController) {
    try {
      window.vpFetchController.abort();
    } catch (_) {}
    window.vpFetchController = null;
  }

  // Route edits need a data reload, not only a canvas repaint.
  vpElevationData = null;
  window.vpElevationData = null;
  vpHighResData = null;
  vpAltWaypoints = [];
  vpSegmentAlts = [];
  vpZoomLevel = 100;
  window._lastVpRouteKey = null;
  window._lastLmRouteKey = null;
  window._lastObsRouteKey = null;
  window._lastWetterRouteKey = null;
  window._lastWetterCoverageKey = null;
  window._lastWetterRouteNm = 0;
  window._vpAutoSarHeliAltRouteKey = null;
  window.vpBgNeedsUpdate = true;
  var zd = document.getElementById('vpZoomDisplay');
  if (zd) zd.textContent = '0%';
  var status = document.getElementById('verticalProfileStatus');
  if (status) status.textContent = 'Lade Terrain...';
  var mapTable = document.getElementById('mapTableOverlay');
  if (mapTable && mapTable.classList.contains('active')) {
    vpMapProfileVisible = true;
    var strip = document.getElementById('mapProfileStrip');
    var btn = document.getElementById('vpToggleBtn');
    if (strip) strip.style.display = '';
    if (btn) {
      btn.textContent = '📊 Profil (An)';
      btn.style.background = '#2E8B57';
    }
    if (typeof initProfileResize === 'function') initProfileResize();
    if (typeof map !== 'undefined' && map && typeof map.invalidateSize === 'function') {
      setTimeout(() => map.invalidateSize(), 80);
    }
  }
  if (window.gaDebugPush) window.gaDebugPush('profile', 'Route profile hard reload', {
    reason
  });
  triggerVerticalProfileUpdate();
  if (typeof renderMapProfile === 'function') renderMapProfile();
  return true;
};
function triggerVerticalProfileUpdate() {
  if (vpProfileFastTimeout) clearTimeout(vpProfileFastTimeout);
  if (window.vpFetchController) window.vpFetchController.abort();
  window.vpFetchController = vpCreateAbortController();
  var currentSignal = window.vpFetchController.signal;
  var forceOverpassReload = window._vpForceOverpassOnce === true;
  window._vpForceOverpassOnce = false;
  window.vpBgNeedsUpdate = true;
  vpProfileFastTimeout = setTimeout(/*#__PURE__*/_asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4() {
    var cacheKey, zd, status, mapTable, btnLm, lmStr, fetchWetter, fetchOverpass, wxInfo, terrainInfo, elevCount, bC, bO, _t2;
    return _regenerator().w(function (_context4) {
      while (1) switch (_context4.p = _context4.n) {
        case 0:
          if (!(!routeWaypoints || routeWaypoints.length < 2)) {
            _context4.n = 1;
            break;
          }
          return _context4.a(2);
        case 1:
          cacheKey = routeWaypoints.map(p => `${(p.lat || 0).toFixed(4)},${(p.lng || p.lon || 0).toFixed(4)}`).join('|');
          if (window._lastVpRouteKey !== cacheKey) {
            vpAltWaypoints = [];
            vpSegmentAlts = [];
            vpHighResData = null;
            vpZoomLevel = 100;
            // Hindernisse/Linear-Features nicht hart leeren:
            // bis neue Route-Daten da sind, bleibt die letzte Darstellung sichtbar.
            if (typeof renderWeatherMarkers === 'function') renderWeatherMarkers();
            zd = document.getElementById('vpZoomDisplay');
            if (zd) zd.textContent = '0%';
            window._lastVpRouteKey = cacheKey;
          }
          status = document.getElementById('verticalProfileStatus');
          if (status) status.textContent = 'Lade Terrain...';
          _context4.p = 2;
          _context4.n = 3;
          return fetchRouteElevation(routeWaypoints, currentSignal);
        case 3:
          vpElevationData = _context4.v;
          if (!Array.isArray(vpElevationData)) vpElevationData = [];
          window.vpBgNeedsUpdate = true;
          window.vpElevationData = vpElevationData;
          if (vpElevationData.length >= 2 && typeof window.gaPushMissionAuthorityProfile === 'function') {
            window.gaPushMissionAuthorityProfile('terrain-profile-ready');
          }
          if (typeof vpApplySarHeliAltitudeConstraints === 'function') {
            vpApplySarHeliAltitudeConstraints(cacheKey);
          }
          if (document.getElementById('verticalProfileCanvas') && typeof renderVerticalProfile === 'function') {
            renderVerticalProfile('verticalProfileCanvas');
          }
          mapTable = document.getElementById('mapTableOverlay');
          if (mapTable && mapTable.classList.contains('active') && (typeof vpMapProfileVisible === 'undefined' || vpMapProfileVisible) && typeof renderMapProfile === 'function') {
            renderMapProfile();
          }

          // 2. Städte / Landmarks (Lokale JSON, blitzschnell)
          if (!(window._lastLmRouteKey !== cacheKey)) {
            _context4.n = 7;
            break;
          }
          btnLm = document.getElementById('btnToggleLandmarks');
          if (btnLm) btnLm.classList.add('vp-loading-pulse');
          lmStr = localStorage.getItem('ga_lms_' + cacheKey);
          if (!lmStr) {
            _context4.n = 4;
            break;
          }
          try {
            vpLandmarks = JSON.parse(lmStr);
            window._lastLmRouteKey = cacheKey;
          } catch (e) {
            vpLandmarks = [];
          }
          _context4.n = 6;
          break;
        case 4:
          _context4.n = 5;
          return fetchProfileLandmarks(vpElevationData);
        case 5:
          vpLandmarks = _context4.v;
          if (vpLandmarks !== null) {
            try {
              localStorage.setItem('ga_lms_' + cacheKey, JSON.stringify(vpLandmarks));
              window._lastLmRouteKey = cacheKey;
            } catch (e) {}
          }
        case 6:
          if (btnLm) btnLm.classList.remove('vp-loading-pulse');
        case 7:
          if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
          if (status) status.textContent = 'Lade Wetter & Umgebung...';

          // 3. PARALLELER FETCH: Wetter & Overpass
          fetchWetter = /*#__PURE__*/function () {
            var _ref9 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee() {
              var needsProfileWeather, weatherRouteKey, weatherCoveragePoints, weatherCoverageKey, weatherSrcCacheKey, nowTs, maxAgeMs, isFresh, currentRouteNm, lastRouteNm, routeDeltaNm, sameCoverage, sameExactRoute, canReuseByCoverage, weatherCacheReusable, btnCl, prevWeatherData, nextWeatherData;
              return _regenerator().w(function (_context) {
                while (1) switch (_context.n) {
                  case 0:
                    needsProfileWeather = vpShowClouds || vpShowIsobars || vpShowWindComponents;
                    if (needsProfileWeather) {
                      _context.n = 1;
                      break;
                    }
                    vpWeatherDebugEvent('Wetter-Fetch übersprungen (keine aktive Wetterdarstellung)');
                    return _context.a(2);
                  case 1:
                    weatherRouteKey = vpBuildElevationRouteKey(routeWaypoints, 5);
                    weatherCoveragePoints = routeWaypoints.map(p => {
                      var _p$lng;
                      return {
                        lat: Number(p && p.lat),
                        lon: Number(p && ((_p$lng = p.lng) !== null && _p$lng !== void 0 ? _p$lng : p.lon))
                      };
                    }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
                    weatherCoverageKey = vpBuildCoverageKeyFromPoints(weatherCoveragePoints, 0.1);
                    weatherSrcCacheKey = vpGetWeatherSourceCacheKey();
                    nowTs = Date.now();
                    maxAgeMs = vpWeatherSource === 'metar' ? VP_METAR_ROUTE_CACHE_TTL_MS : 5 * 60 * 1000;
                    isFresh = nowTs - Number(window._lastWeatherFetchAt || 0) < maxAgeMs;
                    currentRouteNm = Array.isArray(vpElevationData) && vpElevationData.length > 0 ? Number(vpElevationData[vpElevationData.length - 1].distNM || 0) : 0;
                    lastRouteNm = Number(window._lastWetterRouteNm || 0);
                    routeDeltaNm = Math.abs(currentRouteNm - lastRouteNm);
                    sameCoverage = !!weatherCoverageKey && weatherCoverageKey === window._lastWetterCoverageKey;
                    sameExactRoute = window._lastWetterRouteKey === weatherRouteKey;
                    canReuseByCoverage = sameCoverage && routeDeltaNm <= 8;
                    weatherCacheReusable = (sameExactRoute || canReuseByCoverage) && window._lastWeatherSourceKey === weatherSrcCacheKey && vpWeatherData && isFresh; // Wetter nur dann skippen, wenn Quelle gleich, Daten frisch und Route/Gebiet relevant gleich.
                    if (!weatherCacheReusable) {
                      _context.n = 2;
                      break;
                    }
                    if (!sameExactRoute && canReuseByCoverage) {
                      vpWeatherDebugEvent(`Wetter-Fetch übersprungen (Coverage gleich, ΔDist ${routeDeltaNm.toFixed(1)} NM)`);
                    }
                    window.vpBgNeedsUpdate = true;
                    if (typeof renderWeatherMarkers === 'function') renderWeatherMarkers();
                    return _context.a(2);
                  case 2:
                    btnCl = document.getElementById('btnToggleClouds');
                    if (btnCl) btnCl.classList.add('vp-loading-pulse');
                    prevWeatherData = Array.isArray(vpWeatherData) ? vpWeatherData : null;
                    _context.n = 3;
                    return fetchRouteWeather(routeWaypoints, vpElevationData, currentSignal);
                  case 3:
                    nextWeatherData = _context.v;
                    if (Array.isArray(nextWeatherData) && nextWeatherData.length > 0) {
                      vpWeatherData = nextWeatherData;
                    } else if (prevWeatherData && prevWeatherData.length > 0) {
                      vpWeatherDebugEvent('Wetter-Fetch leer/failed -> letzter gültiger Stand bleibt aktiv');
                      vpWeatherData = prevWeatherData;
                    } else {
                      vpWeatherData = nextWeatherData;
                    }
                    window._lastWetterRouteKey = weatherRouteKey; // Cache-Key merken
                    window._lastWetterCoverageKey = weatherCoverageKey;
                    window._lastWetterRouteNm = currentRouteNm;
                    window._lastWeatherSourceKey = vpGetWeatherSourceCacheKey();
                    window._lastWeatherFetchAt = Date.now();
                    if (btnCl) btnCl.classList.remove('vp-loading-pulse');
                    if (status && vpWeatherSource === 'openmeteo') {
                      status.textContent = window.vpWeatherFallbackMode === 'openmeteo_to_metar' ? 'Open-Meteo nicht verfügbar – Fallback: METAR' : window.vpWeatherFallbackMode === 'metar_to_openmeteo' ? 'METAR nicht verfügbar – Fallback: Open-Meteo' : 'Open-Meteo aktiv';
                    }
                    window.vpBgNeedsUpdate = true;
                    if (typeof renderWeatherMarkers === 'function') renderWeatherMarkers();
                    if (typeof window.scheduleMapWeatherOverlayUpdate === 'function') window.scheduleMapWeatherOverlayUpdate(true);
                  case 4:
                    return _context.a(2);
                }
              }, _callee);
            }));
            return function fetchWetter() {
              return _ref9.apply(this, arguments);
            };
          }();
          fetchOverpass = /*#__PURE__*/function () {
            var _ref0 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3() {
              var needsObsNow, needsLinNow, now, tileProbe, hasRouteComboCache, comboRaw, combo, obs, lin, lastSuccessAt, comboRawFast, comboFast, cObs, cLin, comboSparseLin, routeTileCount, linTileSet, comboFastUsable, inflightKey, runner, _t;
              return _regenerator().w(function (_context3) {
                while (1) switch (_context3.p = _context3.n) {
                  case 0:
                    if (!(!vpShowObstacles && !vpShowLinear)) {
                      _context3.n = 1;
                      break;
                    }
                    return _context3.a(2);
                  case 1:
                    needsObsNow = !!vpShowObstacles;
                    needsLinNow = !!vpShowLinear;
                    now = Date.now();
                    tileProbe = vpGetRouteTileCoverageProbe(vpElevationData);
                    hasRouteComboCache = false;
                    try {
                      comboRaw = localStorage.getItem('ga_obs_combo_' + cacheKey);
                      if (comboRaw) {
                        combo = JSON.parse(comboRaw);
                        obs = Array.isArray(combo && combo.obs) ? combo.obs : [];
                        lin = Array.isArray(combo && combo.lin) ? combo.lin : [];
                        hasRouteComboCache = (!needsObsNow || obs.length > 0) && (!needsLinNow || lin.length > 0);
                      }
                    } catch (_) {}
                    lastSuccessAt = Number(window.vpOverpassRouteLastSuccess && window.vpOverpassRouteLastSuccess[cacheKey] || 0);
                    if (!(!forceOverpassReload && hasRouteComboCache && tileProbe.missing.length === 0 && lastSuccessAt > 0 && now - lastSuccessAt < VP_OVERPASS_MIN_REQUERY_MS)) {
                      _context3.n = 2;
                      break;
                    }
                    if (window.vpWeatherDebug) window.vpWeatherDebug.overpassRouteThrottleSkips += 1;
                    console.log(`[Overpass] Route-Guard aktiv (${Math.ceil((VP_OVERPASS_MIN_REQUERY_MS - (now - lastSuccessAt)) / 1000)}s Rest), nutze Bestand.`);
                    return _context3.a(2);
                  case 2:
                    if (!(!forceOverpassReload && tileProbe.total > 0 && tileProbe.missing.length === 0)) {
                      _context3.n = 9;
                      break;
                    }
                    if (window.vpSetObsTileDeferred) window.vpSetObsTileDeferred('__RESET__', false);
                    comboRawFast = localStorage.getItem('ga_obs_combo_' + cacheKey);
                    if (!comboRawFast) {
                      _context3.n = 7;
                      break;
                    }
                    _context3.p = 3;
                    comboFast = JSON.parse(comboRawFast);
                    cObs = Array.isArray(comboFast && comboFast.obs) ? comboFast.obs : [];
                    cLin = Array.isArray(comboFast && comboFast.lin) ? comboFast.lin : [];
                    comboSparseLin = false;
                    if (needsLinNow && cLin.length > 0) {
                      routeTileCount = vpCollectRouteTileKeys(vpElevationData).size;
                      linTileSet = new Set(cLin.map(f => String(f && f.tileKey || '')).filter(Boolean));
                      comboSparseLin = routeTileCount >= 8 && linTileSet.size <= 2;
                      if (comboSparseLin) {
                        console.warn(`[Overpass] Route-Combo-Cache wirkt zu dünn (${linTileSet.size}/${routeTileCount} Lin-Tiles) -> Refetch statt Fast-Cache.`);
                      }
                    }
                    comboFastUsable = (!needsObsNow || cObs.length > 0) && (!needsLinNow || cLin.length > 0) && !comboSparseLin;
                    if (!comboFastUsable) {
                      _context3.n = 4;
                      break;
                    }
                    vpObstacles = cObs;
                    vpLinearFeatures = cLin;
                    vpLogRouteFeatureStats('route-cache-combo-fast', cacheKey, vpObstacles, vpLinearFeatures);
                    window._lastObsRouteKey = cacheKey;
                    window.vpOverpassRouteLastSuccess[cacheKey] = Date.now();
                    if (window.vpWeatherDebug) window.vpWeatherDebug.overpassTileCoverageHits += 1;
                    window.vpBgNeedsUpdate = true;
                    if (typeof window.vpScheduleProfileRender === 'function') window.vpScheduleProfileRender('overpass-route-cache-fast', 50);else if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
                    console.log('[Overpass] Route vollständig im Tile-Cache. Nutze Route-Combo-Cache.');
                    return _context3.a(2);
                  case 4:
                    console.warn('[Overpass] Route-Combo-Cache unvollständig -> Refetch-Prüfung läuft.');
                    _context3.n = 6;
                    break;
                  case 5:
                    _context3.p = 5;
                    _t = _context3.v;
                  case 6:
                    _context3.n = 8;
                    break;
                  case 7:
                    console.log('[Overpass] Coverage vollständig, aber kein Route-Combo-Cache vorhanden -> Tile-Refresh wird erzwungen.');
                  case 8:
                    _context3.n = 10;
                    break;
                  case 9:
                    if (!forceOverpassReload && tileProbe.missing.length > 0) {
                      if (window.vpWeatherDebug) window.vpWeatherDebug.overpassTileCoverageMisses += 1;
                      console.log(`[Overpass] Tile-Cache unvollständig: ${tileProbe.missing.length}/${tileProbe.total} Tiles fehlen.`);
                    }
                  case 10:
                    inflightKey = `obs|${cacheKey}`;
                    if (!(window.vpOverpassInFlight && window.vpOverpassInFlight.has(inflightKey))) {
                      _context3.n = 12;
                      break;
                    }
                    if (window.vpWeatherDebug) window.vpWeatherDebug.overpassInFlightJoins += 1;
                    _context3.n = 11;
                    return window.vpOverpassInFlight.get(inflightKey);
                  case 11:
                    return _context3.a(2);
                  case 12:
                    if (!(window.vpOverpassGlobalInFlight && window.vpOverpassGlobalInFlight.promise)) {
                      _context3.n = 16;
                      break;
                    }
                    if (!(window.vpOverpassGlobalInFlight.key === inflightKey)) {
                      _context3.n = 14;
                      break;
                    }
                    if (window.vpWeatherDebug) window.vpWeatherDebug.overpassInFlightJoins += 1;
                    _context3.n = 13;
                    return window.vpOverpassGlobalInFlight.promise;
                  case 13:
                    _context3.n = 15;
                    break;
                  case 14:
                    console.log('[Overpass] Globaler Request läuft bereits, nutze vorerst Cache/Pool-Daten.');
                  case 15:
                    return _context3.a(2);
                  case 16:
                    runner = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2() {
                      var btnOb, routeTileCount, isLinearCoverageWeak, obStr, hasUsableCache, cached, weakLinearCoverage, seeded, seededObsOk, seededLinOk, forceFullTileReload, mustRefetch, forceNetReload, result, deferredWait, retryMs;
                      return _regenerator().w(function (_context2) {
                        while (1) switch (_context2.n) {
                          case 0:
                            btnOb = document.getElementById('btnToggleObstacles');
                            if (btnOb) btnOb.classList.add('vp-loading-pulse');
                            vpSetLinearLoadingPulse(true);
                            routeTileCount = vpCollectRouteTileKeys(vpElevationData).size;
                            isLinearCoverageWeak = features => {
                              if (!needsLinNow) return false;
                              if (!Array.isArray(features) || features.length === 0) return true;
                              var linTileSet = new Set(features.map(f => String(f && f.tileKey || '')).filter(Boolean));
                              return routeTileCount >= 8 && linTileSet.size <= 2;
                            }; // FIX: Kombinierter Cache für Hindernisse UND Flüsse/Autobahnen
                            obStr = localStorage.getItem('ga_obs_combo_' + cacheKey);
                            hasUsableCache = false;
                            if (obStr) {
                              try {
                                cached = JSON.parse(obStr);
                                vpObstacles = cached.obs || [];
                                vpLinearFeatures = cached.lin || [];
                                vpLogRouteFeatureStats('route-cache-combo', cacheKey, vpObstacles, vpLinearFeatures);
                                window._lastObsRouteKey = cacheKey;
                                hasUsableCache = (!needsObsNow || vpObstacles.length > 0) && (!needsLinNow || vpLinearFeatures.length > 0);
                                vpRememberObstacleData(vpObstacles, vpLinearFeatures);
                                window.vpBgNeedsUpdate = true; // <--- FIX: Redraw nach Laden aus Cache erzwingen
                              } catch (e) {
                                vpObstacles = [];
                                vpLinearFeatures = [];
                              }
                            }
                            weakLinearCoverage = false;
                            if (!forceOverpassReload && needsLinNow && Array.isArray(vpLinearFeatures) && vpLinearFeatures.length > 0) {
                              weakLinearCoverage = isLinearCoverageWeak(vpLinearFeatures);
                              if (weakLinearCoverage) {
                                console.warn(`[Overpass] Linear-Coverage verdächtig dünn -> erzwinge Refetch.`);
                              }
                            }
                            if (!hasUsableCache) {
                              seeded = vpProjectObsPoolToRoute(vpElevationData);
                              seededObsOk = !needsObsNow || Array.isArray(seeded.obs) && seeded.obs.length > 0;
                              seededLinOk = !needsLinNow || Array.isArray(seeded.lin) && seeded.lin.length > 0;
                              if (seeded.obs && seeded.obs.length || seeded.lin && seeded.lin.length) {
                                vpObstacles = seeded.obs || [];
                                vpLinearFeatures = seeded.lin || [];
                                vpLogRouteFeatureStats('pool-seed', cacheKey, vpObstacles, vpLinearFeatures);
                                hasUsableCache = seededObsOk && seededLinOk;
                                weakLinearCoverage = !forceOverpassReload && isLinearCoverageWeak(vpLinearFeatures);
                                window.vpBgNeedsUpdate = true;
                                if (typeof window.vpScheduleProfileRender === 'function') window.vpScheduleProfileRender('overpass-pool-seed', 80);else if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
                                if (!weakLinearCoverage && tileProbe.total > 0 && tileProbe.missing.length === 0) {
                                  try {
                                    vpStoreObsComboRouteCache(cacheKey, vpObstacles, vpLinearFeatures);
                                    window._lastObsRouteKey = cacheKey;
                                    window.vpOverpassRouteLastSuccess[cacheKey] = Date.now();
                                  } catch (_) {}
                                }
                              }
                            }

                            // Wichtig: Nicht nur auf "Key existiert" prüfen.
                            // Wenn der Route-Cache leer/kaputt ist oder keine nutzbaren Daten
                            // enthält, müssen wir trotzdem live nachladen.
                            forceFullTileReload = !forceOverpassReload && !hasRouteComboCache && !hasUsableCache && tileProbe.total > 0 && tileProbe.missing.length === 0;
                            mustRefetch = forceOverpassReload || forceFullTileReload || !hasUsableCache || weakLinearCoverage || tileProbe.missing.length > 0;
                            if (!mustRefetch) {
                              _context2.n = 2;
                              break;
                            }
                            // Bei verdächtig dünner Linear-Coverage immer echten Netz-Reload forcieren.
                            // Sonst landen wir in einem Cache-Loop mit denselben "leeren" Lin-Tiles.
                            forceNetReload = forceOverpassReload || forceFullTileReload || weakLinearCoverage;
                            _context2.n = 1;
                            return fetchProfileObstacles(vpElevationData, currentSignal, cacheKey, forceNetReload);
                          case 1:
                            result = _context2.v;
                            if (result !== null) {
                              vpObstacles = result.obs || [];
                              vpLinearFeatures = result.lin || [];
                              vpLogRouteFeatureStats('network-merge', cacheKey, vpObstacles, vpLinearFeatures);
                              window.vpBgNeedsUpdate = true; // FIX: Garantiert, dass der Hintergrund nach dem finalen Fetch aktualisiert wird
                              window.vpOverpassRouteLastSuccess[cacheKey] = Date.now();
                              // Do not overwrite per-tile source metadata with an aggregated route source label.
                              // fetchProfileObstacles() already marks each loaded tile individually (hosted/overpass).
                              try {
                                vpStoreObsComboRouteCache(cacheKey, vpObstacles, vpLinearFeatures);
                                window._lastObsRouteKey = cacheKey;
                              } catch (e) {}
                              if (!forceOverpassReload && result && Array.isArray(result.deferredTileKeys) && result.deferredTileKeys.length > 0) {
                                deferredWait = Math.max(VP_OBS_TILE_DEFERRED_RETRY_MS, Number(result.nextTileRetryMs || 0) + 800);
                                if (window._vpOverpassDeferredRefreshTimer) clearTimeout(window._vpOverpassDeferredRefreshTimer);
                                window._vpOverpassDeferredRefreshTimer = setTimeout(() => {
                                  window._vpOverpassDeferredRefreshTimer = null;
                                  if (!routeWaypoints || routeWaypoints.length < 2) return;
                                  if (window._lastVpRouteKey !== cacheKey) return;
                                  if (vpIsOverpassCoolingDown()) return;
                                  if (typeof triggerVerticalProfileUpdate === 'function') triggerVerticalProfileUpdate();
                                }, deferredWait);
                              }
                              if (!forceOverpassReload && result && Array.isArray(result.failedTileKeys) && result.failedTileKeys.length > 0) {
                                retryMs = Math.max(VP_OBS_TILE_DEFERRED_RETRY_MS, vpGetOverpassCooldownRemainingMs() + 1200);
                                if (window._vpOverpassFailedRefreshTimer) clearTimeout(window._vpOverpassFailedRefreshTimer);
                                window._vpOverpassFailedRefreshTimer = setTimeout(() => {
                                  window._vpOverpassFailedRefreshTimer = null;
                                  if (!routeWaypoints || routeWaypoints.length < 2) return;
                                  if (window._lastVpRouteKey !== cacheKey) return;
                                  if (vpIsOverpassCoolingDown()) return;
                                  if (typeof triggerVerticalProfileUpdate === 'function') triggerVerticalProfileUpdate();
                                }, retryMs);
                              }
                            }
                          case 2:
                            if (btnOb) btnOb.classList.remove('vp-loading-pulse');
                            vpSetLinearLoadingPulse(false);
                          case 3:
                            return _context2.a(2);
                        }
                      }, _callee2);
                    }))();
                    if (window.vpOverpassInFlight) window.vpOverpassInFlight.set(inflightKey, runner);
                    window.vpOverpassGlobalInFlight = {
                      key: inflightKey,
                      promise: runner
                    };
                    _context3.p = 17;
                    _context3.n = 18;
                    return runner;
                  case 18:
                    _context3.p = 18;
                    if (window.vpOverpassInFlight) window.vpOverpassInFlight.delete(inflightKey);
                    if (window.vpOverpassGlobalInFlight && window.vpOverpassGlobalInFlight.promise === runner) {
                      window.vpOverpassGlobalInFlight = null;
                    }
                    return _context3.f(18);
                  case 19:
                    return _context3.a(2);
                }
              }, _callee3, null, [[17,, 18, 19], [3, 5]]);
            }));
            return function fetchOverpass() {
              return _ref0.apply(this, arguments);
            };
          }(); // Führe beide schweren Netzwerk-Tasks parallel aus
          _context4.n = 8;
          return Promise.all([fetchWetter(), fetchOverpass()]);
        case 8:
          if (Array.isArray(vpElevationData) && vpElevationData.length >= 2 && typeof window.gaPushMissionAuthorityProfile === 'function') {
            window.gaPushMissionAuthorityProfile('profile-features-ready');
          }
          if (typeof window.scheduleMapWeatherOverlayUpdate === 'function') window.scheduleMapWeatherOverlayUpdate(true);
          if (status) {
            wxInfo = vpWeatherSource === 'openmeteo' ? window.vpWeatherFallbackMode === 'openmeteo_to_metar' ? ' • Fallback METAR' : ' • Open-Meteo' : window.vpWeatherFallbackMode === 'metar_to_openmeteo' ? ' • Fallback Open-Meteo' : ' • METAR';
            terrainInfo = window.vpElevationFallbackActive ? ' • Terrain Fallback' : '';
            elevCount = Array.isArray(vpElevationData) ? vpElevationData.length : 0;
            status.textContent = elevCount + ' Punkte & API-Daten geladen' + wxInfo + terrainInfo;
          }
          _context4.n = 10;
          break;
        case 9:
          _context4.p = 9;
          _t2 = _context4.v;
          if (_t2 && _t2.name !== 'AbortError') console.error('Profile Fetch Error:', _t2);
          if (status) status.textContent = 'API Error / Abgebrochen';
        case 10:
          _context4.p = 10;
          bC = document.getElementById('btnToggleClouds');
          if (bC) bC.classList.remove('vp-loading-pulse');
          bO = document.getElementById('btnToggleObstacles');
          if (bO) bO.classList.remove('vp-loading-pulse');
          vpSetLinearLoadingPulse(false);
          if (typeof window.vpScheduleProfileRender === 'function') window.vpScheduleProfileRender('profile-fetch-final', 40);else if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
          return _context4.f(10);
        case 11:
          return _context4.a(2);
      }
    }, _callee4, null, [[2, 9, 10, 11]]);
  })), 150); // Nur noch 150ms Debounce statt fast 3 Sekunden!
}
window.vpForceOverpassRefresh = function () {
  if (!window._lastVpRouteKey || !routeWaypoints || routeWaypoints.length < 2) return;
  window._vpForceOverpassOnce = true;
  window._lastObsRouteKey = null;
  triggerVerticalProfileUpdate();
};
function fetchRouteElevation(_x14, _x15) {
  return _fetchRouteElevation.apply(this, arguments);
}
function _fetchRouteElevation() {
  _fetchRouteElevation = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee20(routePts, signal) {
    var cacheKey, coarseKey, coarseMemKey, exactStored, coarseCached, _vpBuildInterpolatedR, interpolated, samplePts, approxProfile, terrariumData, lats, lons, res, data, finalData, _t19, _t20;
    return _regenerator().w(function (_context24) {
      while (1) switch (_context24.p = _context24.n) {
        case 0:
          if (!(!routePts || routePts.length < 2)) {
            _context24.n = 1;
            break;
          }
          return _context24.a(2, []);
        case 1:
          cacheKey = vpBuildElevationRouteKey(routePts, 4);
          coarseKey = vpBuildElevationRouteKey(routePts, 3);
          coarseMemKey = 'q3|' + coarseKey;
          if (!vpElevationCache[cacheKey]) {
            _context24.n = 2;
            break;
          }
          window.vpElevationFallbackActive = false;
          window.vpTerrainElevationSource = 'terrarium-cache';
          return _context24.a(2, vpElevationCache[cacheKey]);
        case 2:
          exactStored = vpGetStoredElevationCache(cacheKey, false);
          if (!exactStored) {
            _context24.n = 3;
            break;
          }
          vpElevationCache[cacheKey] = exactStored;
          window.vpElevationFallbackActive = false;
          window.vpTerrainElevationSource = 'terrarium-cache';
          return _context24.a(2, exactStored);
        case 3:
          coarseCached = vpElevationCache[coarseMemKey] || vpGetStoredElevationCache(coarseKey, true);
          if (!coarseCached) {
            _context24.n = 4;
            break;
          }
          vpElevationCache[coarseMemKey] = coarseCached;
          vpRecordElevationFallback('coarse route cache');
          return _context24.a(2, coarseCached);
        case 4:
          _vpBuildInterpolatedR = vpBuildInterpolatedRoutePoints(routePts), interpolated = _vpBuildInterpolatedR.interpolated, samplePts = _vpBuildInterpolatedR.samplePts;
          approxProfile = vpBuildApproxElevationProfile(interpolated);
          _context24.p = 5;
          _context24.n = 6;
          return vpFetchElevationFromTerrarium(samplePts, signal);
        case 6:
          terrariumData = _context24.v;
          if (!(terrariumData && terrariumData.length === samplePts.length)) {
            _context24.n = 7;
            break;
          }
          return _context24.a(2, vpPersistElevationResult(cacheKey, coarseKey, terrariumData, 'terrarium'));
        case 7:
          _context24.n = 10;
          break;
        case 8:
          _context24.p = 8;
          _t19 = _context24.v;
          if (!(_t19 && _t19.name === 'AbortError')) {
            _context24.n = 9;
            break;
          }
          return _context24.a(2, null);
        case 9:
          vpWeatherDebugSetError(_t19, 'terrarium elevation');
        case 10:
          if (!vpIsElevationCoolingDown()) {
            _context24.n = 11;
            break;
          }
          vpRecordElevationFallback('terrarium unavailable + openmeteo cooldown');
          return _context24.a(2, approxProfile);
        case 11:
          lats = samplePts.map(p => p.lat.toFixed(4)).join(',');
          lons = samplePts.map(p => p.lon.toFixed(4)).join(',');
          _context24.p = 12;
          if (window.vpWeatherDebug) window.vpWeatherDebug.elevationNetworkRequests += 1;
          _context24.n = 13;
          return vpFetchResource('https://api.open-meteo.com/v1/elevation?latitude=' + lats + '&longitude=' + lons, {
            signal
          });
        case 13:
          res = _context24.v;
          if (res.ok) {
            _context24.n = 14;
            break;
          }
          if (res.status === 429) vpRecordElevation429();
          throw new Error('Elevation API error: ' + res.status);
        case 14:
          _context24.n = 15;
          return res.json();
        case 15:
          data = _context24.v;
          if (!(!data.elevation || data.elevation.length !== samplePts.length)) {
            _context24.n = 16;
            break;
          }
          throw new Error('Invalid elevation response');
        case 16:
          finalData = samplePts.map((p, i) => ({
            distNM: p.distNM,
            elevFt: Math.round(data.elevation[i] * 3.28084),
            lat: p.lat,
            lon: p.lon
          }));
          vpPersistElevationResult(cacheKey, coarseKey, finalData, 'openmeteo');
          if (window.vpWeatherDebug) window.vpWeatherDebug.lastElevationSuccessAt = Date.now();
          return _context24.a(2, finalData);
        case 17:
          _context24.p = 17;
          _t20 = _context24.v;
          if (!(_t20 && _t20.name === 'AbortError')) {
            _context24.n = 18;
            break;
          }
          return _context24.a(2, null);
        case 18:
          vpWeatherDebugSetError(_t20, 'elevation');
          vpRecordElevationFallback(_t20 && _t20.message ? _t20.message : 'elevation fetch failed');
          return _context24.a(2, approxProfile);
      }
    }, _callee20, null, [[12, 17], [5, 8]]);
  }));
  return _fetchRouteElevation.apply(this, arguments);
}
function fetchRouteWeatherMetar(_x16, _x17, _x18) {
  return _fetchRouteWeatherMetar.apply(this, arguments);
}
function _fetchRouteWeatherMetar() {
  _fetchRouteWeatherMetar = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee26(routePts, elevData, signal) {
    var options,
      fastFail,
      perRequestTimeoutMs,
      retries,
      totalDist,
      activeMetars,
      vpQuant,
      vpBuildMetarChunkKey,
      vpGetMetarChunkCache,
      vpSetMetarChunkCache,
      vpBuildPrefetchGridChunks,
      parseMetarJsonText,
      skipDirectMetarFetch,
      fetchWithTimeout,
      _fetchWithTimeout,
      vpProxyIsCoolingDown,
      vpProxyMarkFailed,
      vpProxyMarkOk,
      safeFetchMetarJson,
      _safeFetchMetarJson,
      CHUNK_NM,
      chunkDefs,
      _loop11,
      d,
      nowTs,
      fetchChunkData,
      promises,
      results,
      allEmpty,
      allFromCache,
      _iterator80,
      _step80,
      c,
      hasAnyMetarResult,
      nowPrefetch,
      prefetchKey,
      lastPrefetchAt,
      lastPrefetchKey,
      nearDefs,
      farDefs,
      primaryKeys,
      prefetchDefs,
      runPrefetch,
      seen,
      totalInChunks,
      stepNM,
      zones,
      _loop12,
      targetDist,
      _args32 = arguments;
    return _regenerator().w(function (_context32) {
      while (1) switch (_context32.n) {
        case 0:
          _safeFetchMetarJson = function _safeFetchMetarJson3() {
            _safeFetchMetarJson = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee25(urlObj) {
              var retryCount,
                proxyDefs,
                infraBlocked,
                i,
                r,
                txt,
                arr,
                activeProxies,
                _iterator82,
                _step82,
                proxy,
                pr,
                ptxt,
                _arr,
                _args29 = arguments,
                _t23,
                _t24,
                _t25;
              return _regenerator().w(function (_context29) {
                while (1) switch (_context29.p = _context29.n) {
                  case 0:
                    retryCount = _args29.length > 1 && _args29[1] !== undefined ? _args29[1] : retries;
                    proxyDefs = [{
                      key: 'ga_worker',
                      mk: u => `https://ga-proxy.einherjer.workers.dev/api/metar?src=${encodeURIComponent(u)}`
                    }, {
                      key: 'codetabs',
                      mk: u => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`
                    }];
                    infraBlocked = false;
                    i = 0;
                  case 1:
                    if (!(i < retryCount)) {
                      _context29.n = 27;
                      break;
                    }
                    if (!(signal && signal.aborted)) {
                      _context29.n = 2;
                      break;
                    }
                    throw new DOMException('Aborted', 'AbortError');
                  case 2:
                    if (skipDirectMetarFetch) {
                      _context29.n = 9;
                      break;
                    }
                    _context29.p = 3;
                    _context29.n = 4;
                    return fetchWithTimeout(urlObj);
                  case 4:
                    r = _context29.v;
                    if (!(r.ok && r.status !== 204)) {
                      _context29.n = 6;
                      break;
                    }
                    _context29.n = 5;
                    return r.text();
                  case 5:
                    txt = _context29.v;
                    arr = parseMetarJsonText(txt);
                    if (!arr) {
                      _context29.n = 6;
                      break;
                    }
                    return _context29.a(2, arr);
                  case 6:
                    if (![400, 401, 403, 404].includes(r.status)) {
                      _context29.n = 7;
                      break;
                    }
                    return _context29.a(3, 27);
                  case 7:
                    _context29.n = 9;
                    break;
                  case 8:
                    _context29.p = 8;
                    _t23 = _context29.v;
                  case 9:
                    activeProxies = proxyDefs.filter(p => !vpProxyIsCoolingDown(p.key));
                    if (!(activeProxies.length === 0)) {
                      _context29.n = 11;
                      break;
                    }
                    window.vpMetarLastInfraBlockAt = Date.now();
                    infraBlocked = true;
                    vpWeatherDebugEvent('METAR proxies in cooldown -> skip network');
                    if (!(i < retryCount - 1)) {
                      _context29.n = 10;
                      break;
                    }
                    _context29.n = 10;
                    return new Promise(res => setTimeout(res, fastFail ? 120 : 300));
                  case 10:
                    return _context29.a(3, 26);
                  case 11:
                    _iterator82 = _createForOfIteratorHelper(activeProxies);
                    _context29.p = 12;
                    _iterator82.s();
                  case 13:
                    if ((_step82 = _iterator82.n()).done) {
                      _context29.n = 22;
                      break;
                    }
                    proxy = _step82.value;
                    _context29.p = 14;
                    _context29.n = 15;
                    return fetchWithTimeout(proxy.mk(urlObj));
                  case 15:
                    pr = _context29.v;
                    if (!(!pr.ok || pr.status === 204)) {
                      _context29.n = 16;
                      break;
                    }
                    if ([400, 401, 403, 404, 408, 429].includes(pr.status) || pr.status >= 500) {
                      vpProxyMarkFailed(proxy.key);
                    }
                    return _context29.a(3, 21);
                  case 16:
                    _context29.n = 17;
                    return pr.text();
                  case 17:
                    ptxt = _context29.v;
                    _arr = parseMetarJsonText(ptxt);
                    if (!_arr) {
                      _context29.n = 18;
                      break;
                    }
                    vpProxyMarkOk(proxy.key);
                    return _context29.a(2, _arr);
                  case 18:
                    vpProxyMarkFailed(proxy.key);
                    if (![400, 401, 403, 404].includes(pr.status)) {
                      _context29.n = 19;
                      break;
                    }
                    return _context29.a(3, 21);
                  case 19:
                    _context29.n = 21;
                    break;
                  case 20:
                    _context29.p = 20;
                    _t24 = _context29.v;
                    vpProxyMarkFailed(proxy.key);
                  case 21:
                    _context29.n = 13;
                    break;
                  case 22:
                    _context29.n = 24;
                    break;
                  case 23:
                    _context29.p = 23;
                    _t25 = _context29.v;
                    _iterator82.e(_t25);
                  case 24:
                    _context29.p = 24;
                    _iterator82.f();
                    return _context29.f(24);
                  case 25:
                    if (!(i < retryCount - 1)) {
                      _context29.n = 26;
                      break;
                    }
                    _context29.n = 26;
                    return new Promise(res => setTimeout(res, fastFail ? 250 : 600));
                  case 26:
                    i++;
                    _context29.n = 1;
                    break;
                  case 27:
                    return _context29.a(2, infraBlocked ? null : []);
                }
              }, _callee25, null, [[14, 20], [12, 23, 24, 25], [3, 8]]);
            }));
            return _safeFetchMetarJson.apply(this, arguments);
          };
          safeFetchMetarJson = function _safeFetchMetarJson2(_x58) {
            return _safeFetchMetarJson.apply(this, arguments);
          };
          vpProxyMarkOk = function _vpProxyMarkOk(key) {
            if (!key) return;
            if (key === 'ga_worker') return;
            vpMetarProxyBackoff.delete(key);
          };
          vpProxyMarkFailed = function _vpProxyMarkFailed(key) {
            if (!key) return;
            if (key === 'ga_worker') return;
            vpMetarProxyBackoff.set(key, Date.now() + VP_METAR_PROXY_FAIL_COOLDOWN_MS);
          };
          vpProxyIsCoolingDown = function _vpProxyIsCoolingDown(key) {
            var now = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Date.now();
            if (key === 'ga_worker') return false;
            var until = Number(vpMetarProxyBackoff.get(key) || 0);
            return until > now;
          };
          _fetchWithTimeout = function _fetchWithTimeout3() {
            _fetchWithTimeout = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee24(urlObj) {
              var ctrl, timer, onAbort;
              return _regenerator().w(function (_context28) {
                while (1) switch (_context28.p = _context28.n) {
                  case 0:
                    ctrl = vpCreateAbortController();
                    timer = null;
                    onAbort = null;
                    if (signal) {
                      onAbort = () => ctrl.abort();
                      if (signal.aborted) ctrl.abort();else signal.addEventListener('abort', onAbort, {
                        once: true
                      });
                    }
                    timer = setTimeout(() => ctrl.abort(), perRequestTimeoutMs);
                    _context28.p = 1;
                    _context28.n = 2;
                    return vpFetchResource(urlObj, {
                      signal: ctrl.signal
                    });
                  case 2:
                    return _context28.a(2, _context28.v);
                  case 3:
                    _context28.p = 3;
                    if (timer) clearTimeout(timer);
                    if (signal && onAbort) signal.removeEventListener('abort', onAbort);
                    return _context28.f(3);
                  case 4:
                    return _context28.a(2);
                }
              }, _callee24, null, [[1,, 3, 4]]);
            }));
            return _fetchWithTimeout.apply(this, arguments);
          };
          fetchWithTimeout = function _fetchWithTimeout2(_x57) {
            return _fetchWithTimeout.apply(this, arguments);
          };
          parseMetarJsonText = function _parseMetarJsonText(text) {
            if (typeof text !== 'string') return null;
            var trimmed = text.trim();
            if (!trimmed) return null;
            try {
              var parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed)) return parsed;
              if (parsed && Array.isArray(parsed.data)) return parsed.data;
              if (parsed && Array.isArray(parsed.results)) return parsed.results;
              if (parsed && typeof parsed.contents === 'string') {
                var nested = JSON.parse(parsed.contents);
                return Array.isArray(nested) ? nested : null;
              }
            } catch (_) {}
            return null;
          };
          vpBuildPrefetchGridChunks = function _vpBuildPrefetchGridC(eData, radiusNm) {
            if (!Array.isArray(eData) || eData.length < 2) return [];
            var minLat = 90,
              maxLat = -90,
              minLon = 180,
              maxLon = -180;
            var _iterator79 = _createForOfIteratorHelper(eData),
              _step79;
            try {
              for (_iterator79.s(); !(_step79 = _iterator79.n()).done;) {
                var p = _step79.value;
                if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
                minLat = Math.min(minLat, p.lat);
                maxLat = Math.max(maxLat, p.lat);
                minLon = Math.min(minLon, p.lon);
                maxLon = Math.max(maxLon, p.lon);
              }
            } catch (err) {
              _iterator79.e(err);
            } finally {
              _iterator79.f();
            }
            if (!Number.isFinite(minLat) || minLat > maxLat) return [];
            var padDeg = Math.max(0.2, Number(radiusNm || 0) / 60);
            var c = VP_METAR_PREFETCH_CELL_DEG;
            var minLatQ = Math.floor((minLat - padDeg) / c) * c;
            var maxLatQ = Math.ceil((maxLat + padDeg) / c) * c;
            var minLonQ = Math.floor((minLon - padDeg) / c) * c;
            var maxLonQ = Math.ceil((maxLon + padDeg) / c) * c;
            var defs = [];
            var seen = new Set();
            for (var la = minLatQ; la < maxLatQ - 1e-8; la += c) {
              for (var lo = minLonQ; lo < maxLonQ - 1e-8; lo += c) {
                var minLa = Math.max(-89.8, la);
                var maxLa = Math.min(89.8, la + c);
                var minLo = Math.max(-179.8, lo);
                var maxLo = Math.min(179.8, lo + c);
                var key = vpBuildMetarChunkKey(minLa, minLo, maxLa, maxLo);
                if (!key || seen.has(key)) continue;
                seen.add(key);
                defs.push({
                  minLat: minLa,
                  minLon: minLo,
                  maxLat: maxLa,
                  maxLon: maxLo,
                  key
                });
              }
            }
            return defs;
          };
          vpSetMetarChunkCache = function _vpSetMetarChunkCache(key, arr) {
            var now = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : Date.now();
            if (!key || !Array.isArray(arr)) return;
            vpMetarChunkCache.set(key, {
              ts: now,
              data: arr,
              empty: arr.length === 0
            });
            if (vpMetarChunkCache.size <= VP_METAR_CHUNK_CACHE_MAX) return;
            var drop = vpMetarChunkCache.size - VP_METAR_CHUNK_CACHE_MAX;
            var oldest = Array.from(vpMetarChunkCache.entries()).sort((a, b) => Number(a[1] && a[1].ts || 0) - Number(b[1] && b[1].ts || 0)).slice(0, Math.max(1, drop));
            var _iterator78 = _createForOfIteratorHelper(oldest),
              _step78;
            try {
              for (_iterator78.s(); !(_step78 = _iterator78.n()).done;) {
                var _step78$value = _slicedToArray(_step78.value, 1),
                  k = _step78$value[0];
                vpMetarChunkCache.delete(k);
              }
            } catch (err) {
              _iterator78.e(err);
            } finally {
              _iterator78.f();
            }
          };
          vpGetMetarChunkCache = function _vpGetMetarChunkCache(key) {
            var now = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Date.now();
            var allowStale = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
            if (!key) return null;
            var entry = vpMetarChunkCache.get(key);
            if (!entry || !Array.isArray(entry.data)) return null;
            var ttl = entry.empty ? VP_METAR_CHUNK_EMPTY_TTL_MS : VP_METAR_CHUNK_CACHE_TTL_MS;
            var age = now - Number(entry.ts || 0);
            if (age > ttl && !allowStale) return null;
            return entry.data;
          };
          vpBuildMetarChunkKey = function _vpBuildMetarChunkKey(minLat, minLon, maxLat, maxLon) {
            return [vpQuant(minLat).toFixed(2), vpQuant(minLon).toFixed(2), vpQuant(maxLat).toFixed(2), vpQuant(maxLon).toFixed(2)].join('|');
          };
          vpQuant = function _vpQuant(v) {
            var step = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0.25;
            if (!Number.isFinite(v) || !Number.isFinite(step) || step <= 0) return Number(v || 0);
            return Math.round(v / step) * step;
          };
          options = _args32.length > 3 && _args32[3] !== undefined ? _args32[3] : {};
          if (!(!routePts || routePts.length < 2 || !elevData || elevData.length < 2)) {
            _context32.n = 1;
            break;
          }
          return _context32.a(2, null);
        case 1:
          fastFail = !!(options && options.fastFail);
          perRequestTimeoutMs = fastFail ? 3200 : 6500;
          retries = fastFail ? 1 : 2;
          totalDist = elevData[elevData.length - 1].distNM;
          activeMetars = [];
          skipDirectMetarFetch = true; // METAR FIX: Route in parallele 60-NM-Blöcke schneiden, um AviationWeather API-Schnittlimits (Max Stations) zu umgehen!
          CHUNK_NM = 60;
          chunkDefs = [];
          _loop11 = /*#__PURE__*/_regenerator().m(function _loop11(d) {
            var cMinLat, cMaxLat, cMinLon, cMaxLon;
            return _regenerator().w(function (_context30) {
              while (1) switch (_context30.n) {
                case 0:
                  cMinLat = 90, cMaxLat = -90, cMinLon = 180, cMaxLon = -180;
                  elevData.forEach(p => {
                    if (p.distNM >= d && p.distNM < d + CHUNK_NM) {
                      if (p.lat < cMinLat) cMinLat = p.lat;
                      if (p.lat > cMaxLat) cMaxLat = p.lat;
                      if (p.lon < cMinLon) cMinLon = p.lon;
                      if (p.lon > cMaxLon) cMaxLon = p.lon;
                    }
                  });
                  if (!(cMinLat === 90)) {
                    _context30.n = 1;
                    break;
                  }
                  return _context30.a(2, 1);
                case 1:
                  // Puffer hinzufügen (ca. 45 NM)
                  cMinLat -= 0.8;
                  cMaxLat += 0.8;
                  cMinLon -= 0.8;
                  cMaxLon += 0.8;
                  chunkDefs.push({
                    minLat: cMinLat,
                    minLon: cMinLon,
                    maxLat: cMaxLat,
                    maxLon: cMaxLon,
                    key: vpBuildMetarChunkKey(cMinLat, cMinLon, cMaxLat, cMaxLon)
                  });
                case 2:
                  return _context30.a(2);
              }
            }, _loop11);
          });
          d = 0;
        case 2:
          if (!(d < totalDist)) {
            _context32.n = 5;
            break;
          }
          return _context32.d(_regeneratorValues(_loop11(d)), 3);
        case 3:
          if (!_context32.v) {
            _context32.n = 4;
            break;
          }
          return _context32.a(3, 4);
        case 4:
          d += CHUNK_NM;
          _context32.n = 2;
          break;
        case 5:
          nowTs = Date.now();
          fetchChunkData = /*#__PURE__*/function () {
            var _ref42 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee21(chunk) {
              var bypassCache,
                cached,
                url,
                arr,
                _stale,
                safeArr,
                stale,
                _args25 = arguments;
              return _regenerator().w(function (_context25) {
                while (1) switch (_context25.n) {
                  case 0:
                    bypassCache = _args25.length > 1 && _args25[1] !== undefined ? _args25[1] : false;
                    if (bypassCache) {
                      _context25.n = 1;
                      break;
                    }
                    cached = vpGetMetarChunkCache(chunk.key, nowTs);
                    if (!Array.isArray(cached)) {
                      _context25.n = 1;
                      break;
                    }
                    return _context25.a(2, {
                      arr: cached,
                      fromCache: true
                    });
                  case 1:
                    url = `https://aviationweather.gov/api/data/metar?bbox=${chunk.minLat},${chunk.minLon},${chunk.maxLat},${chunk.maxLon}&format=json&t=${Date.now()}`;
                    _context25.n = 2;
                    return safeFetchMetarJson(url, retries);
                  case 2:
                    arr = _context25.v;
                    if (!(arr === null)) {
                      _context25.n = 4;
                      break;
                    }
                    _stale = vpGetMetarChunkCache(chunk.key, nowTs, true);
                    if (!(Array.isArray(_stale) && _stale.length > 0)) {
                      _context25.n = 3;
                      break;
                    }
                    return _context25.a(2, {
                      arr: _stale,
                      fromCache: true,
                      staleFallback: true
                    });
                  case 3:
                    return _context25.a(2, {
                      arr: [],
                      fromCache: false,
                      infraBlocked: true
                    });
                  case 4:
                    safeArr = Array.isArray(arr) ? arr : [];
                    vpSetMetarChunkCache(chunk.key, safeArr, Date.now());
                    if (!(safeArr.length > 0)) {
                      _context25.n = 5;
                      break;
                    }
                    return _context25.a(2, {
                      arr: safeArr,
                      fromCache: false
                    });
                  case 5:
                    stale = vpGetMetarChunkCache(chunk.key, nowTs, true);
                    if (!(Array.isArray(stale) && stale.length > 0)) {
                      _context25.n = 6;
                      break;
                    }
                    return _context25.a(2, {
                      arr: stale,
                      fromCache: true,
                      staleFallback: true
                    });
                  case 6:
                    return _context25.a(2, {
                      arr: safeArr,
                      fromCache: false
                    });
                }
              }, _callee21);
            }));
            return function fetchChunkData(_x59) {
              return _ref42.apply(this, arguments);
            };
          }();
          promises = chunkDefs.map(/*#__PURE__*/function () {
            var _ref43 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee22(chunk) {
              var cached;
              return _regenerator().w(function (_context26) {
                while (1) switch (_context26.n) {
                  case 0:
                    cached = vpGetMetarChunkCache(chunk.key, nowTs);
                    if (!Array.isArray(cached)) {
                      _context26.n = 1;
                      break;
                    }
                    return _context26.a(2, {
                      arr: cached,
                      fromCache: true
                    });
                  case 1:
                    return _context26.a(2, fetchChunkData(chunk, false));
                }
              }, _callee22);
            }));
            return function (_x60) {
              return _ref43.apply(this, arguments);
            };
          }());
          _context32.n = 6;
          return Promise.all(promises);
        case 6:
          results = _context32.v;
          allEmpty = results.length > 0 && results.every(item => !item || !Array.isArray(item.arr) || item.arr.length === 0);
          allFromCache = results.length > 0 && results.every(item => !!(item && item.fromCache));
          if (!(allEmpty && allFromCache)) {
            _context32.n = 8;
            break;
          }
          vpWeatherDebugEvent('METAR cache-only empty result -> force refresh');
          _iterator80 = _createForOfIteratorHelper(chunkDefs);
          try {
            for (_iterator80.s(); !(_step80 = _iterator80.n()).done;) {
              c = _step80.value;
              vpMetarChunkCache.delete(c.key);
            }
          } catch (err) {
            _iterator80.e(err);
          } finally {
            _iterator80.f();
          }
          _context32.n = 7;
          return Promise.all(chunkDefs.map(c => fetchChunkData(c, true)));
        case 7:
          results = _context32.v;
        case 8:
          if (!(signal && signal.aborted)) {
            _context32.n = 9;
            break;
          }
          throw new DOMException('Aborted', 'AbortError');
        case 9:
          hasAnyMetarResult = results.some(item => item && Array.isArray(item.arr) && item.arr.length > 0); // Stage-2 Cache-Aufbau: größere Zone im Hintergrund nachziehen (sehr konservativ).
          try {
            nowPrefetch = Date.now();
            prefetchKey = `pf|${vpBuildElevationRouteKey(routePts, 2)}`;
            lastPrefetchAt = Number(window.vpMetarPrefetchLastRunAt || 0);
            lastPrefetchKey = String(window.vpMetarPrefetchLastKey || '');
            if (hasAnyMetarResult && vpMetarProxyBackoff.size === 0 && (prefetchKey !== lastPrefetchKey || nowPrefetch - lastPrefetchAt > VP_METAR_PREFETCH_MIN_INTERVAL_MS)) {
              window.vpMetarPrefetchLastKey = prefetchKey;
              window.vpMetarPrefetchLastRunAt = nowPrefetch;
              nearDefs = vpBuildPrefetchGridChunks(elevData, VP_METAR_PREFETCH_NEAR_NM);
              farDefs = vpBuildPrefetchGridChunks(elevData, VP_METAR_PREFETCH_FAR_NM);
              primaryKeys = new Set(chunkDefs.map(c => c.key));
              prefetchDefs = farDefs.filter(d => !primaryKeys.has(d.key)).filter(d => !Array.isArray(vpGetMetarChunkCache(d.key, nowPrefetch))).filter(d => !vpMetarPrefetchInFlight.has(d.key)).slice(0, VP_METAR_PREFETCH_MAX_CHUNKS);
              if (prefetchDefs.length > 0) {
                runPrefetch = /*#__PURE__*/function () {
                  var _ref44 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee23() {
                    var _iterator81, _step81, _d3, url, arr, safeArr, _t21, _t22;
                    return _regenerator().w(function (_context27) {
                      while (1) switch (_context27.p = _context27.n) {
                        case 0:
                          _iterator81 = _createForOfIteratorHelper(prefetchDefs);
                          _context27.p = 1;
                          _iterator81.s();
                        case 2:
                          if ((_step81 = _iterator81.n()).done) {
                            _context27.n = 12;
                            break;
                          }
                          _d3 = _step81.value;
                          if (!(signal && signal.aborted)) {
                            _context27.n = 3;
                            break;
                          }
                          return _context27.a(2);
                        case 3:
                          if (!vpMetarPrefetchInFlight.has(_d3.key)) {
                            _context27.n = 4;
                            break;
                          }
                          return _context27.a(3, 11);
                        case 4:
                          vpMetarPrefetchInFlight.add(_d3.key);
                          _context27.p = 5;
                          url = `https://aviationweather.gov/api/data/metar?bbox=${_d3.minLat},${_d3.minLon},${_d3.maxLat},${_d3.maxLon}&format=json&t=${Date.now()}`;
                          _context27.n = 6;
                          return safeFetchMetarJson(url, 1);
                        case 6:
                          arr = _context27.v;
                          if (!(arr === null)) {
                            _context27.n = 7;
                            break;
                          }
                          return _context27.a(3, 11);
                        case 7:
                          safeArr = Array.isArray(arr) ? arr : [];
                          vpSetMetarChunkCache(_d3.key, safeArr, Date.now());
                          _context27.n = 9;
                          break;
                        case 8:
                          _context27.p = 8;
                          _t21 = _context27.v;
                        case 9:
                          _context27.p = 9;
                          vpMetarPrefetchInFlight.delete(_d3.key);
                          return _context27.f(9);
                        case 10:
                          _context27.n = 11;
                          return new Promise(r => setTimeout(r, 500));
                        case 11:
                          _context27.n = 2;
                          break;
                        case 12:
                          _context27.n = 14;
                          break;
                        case 13:
                          _context27.p = 13;
                          _t22 = _context27.v;
                          _iterator81.e(_t22);
                        case 14:
                          _context27.p = 14;
                          _iterator81.f();
                          return _context27.f(14);
                        case 15:
                          vpWeatherDebugEvent(`METAR prefetch near/far queued: near=${nearDefs.length} far=${prefetchDefs.length}`);
                        case 16:
                          return _context27.a(2);
                      }
                    }, _callee23, null, [[5, 8, 9, 10], [1, 13, 14, 15]]);
                  }));
                  return function runPrefetch() {
                    return _ref44.apply(this, arguments);
                  };
                }();
                setTimeout(() => {
                  runPrefetch().catch(() => {});
                }, 0);
              }
            }
          } catch (_) {}
          seen = new Set();
          totalInChunks = 0;
          results.forEach((item, idx) => {
            var arr = item && Array.isArray(item.arr) ? item.arr : [];
            var fromCache = !!(item && item.fromCache);
            var fromStale = !!(item && item.staleFallback);
            if (arr && arr.length) {
              console.log(`[Wetter] Chunk ${idx + 1}: ${arr.length} METAR-Stationen geliefert${fromStale ? ' (stale-cache)' : fromCache ? ' (cache)' : ''}.`);
              totalInChunks += arr.length;

              // BULK CACHE: Füttert die Widgets sofort mit den heruntergeladenen Daten!
              var useBulk = typeof gpsState !== 'undefined' && gpsState.metarCache;
              arr.forEach(m => {
                if (m && m.icaoId && !seen.has(m.icaoId)) {
                  seen.add(m.icaoId);
                  activeMetars.push(m);
                  if (useBulk) {
                    gpsState.metarCache[m.icaoId] = {
                      data: [m],
                      isFallback: false,
                      foundIcao: m.icaoId
                    };
                  }
                }
              });
            } else {
              console.log(`[Wetter] Chunk ${idx + 1}: 0 Stationen${fromCache ? ' (cache)' : ' (Leerer Bereich oder Fehler)'}.`);
            }
          });
          console.log(`[Wetter] Gesamt nach Duplikat-Filterung: ${activeMetars.length} einzigartige Stationen für dieses Flugprofil.`);
          if (!(!activeMetars || activeMetars.length === 0)) {
            _context32.n = 10;
            break;
          }
          return _context32.a(2, null);
        case 10:
          stepNM = 15;
          zones = [];
          _loop12 = /*#__PURE__*/_regenerator().m(function _loop12() {
            var bestPt, minDiff, _iterator83, _step83, pt, diff, closestMetar, minMetarDist, _ref45, _closestMetar$mslp, clouds, raw, stnElevFt, cloudRegex, match, lowestBase, agl, msl, hasRain, hasSnow, hasTS, metarFltCat, estimatedCloud, mslPressureRaw, mslPressureHpa, pressureProfile, pressureAnomalyFt, base1000, wkt, wdir, visuals, _c, _d4, f;
            return _regenerator().w(function (_context31) {
              while (1) switch (_context31.n) {
                case 0:
                  bestPt = elevData[0];
                  minDiff = Infinity;
                  _iterator83 = _createForOfIteratorHelper(elevData);
                  try {
                    for (_iterator83.s(); !(_step83 = _iterator83.n()).done;) {
                      pt = _step83.value;
                      diff = Math.abs(pt.distNM - targetDist);
                      if (diff < minDiff) {
                        minDiff = diff;
                        bestPt = pt;
                      }
                    }
                  } catch (err) {
                    _iterator83.e(err);
                  } finally {
                    _iterator83.f();
                  }
                  closestMetar = null, minMetarDist = Infinity;
                  activeMetars.forEach(m => {
                    var d = calcNav(bestPt.lat, bestPt.lon, m.lat, m.lon).dist;
                    if (d < minMetarDist) {
                      minMetarDist = d;
                      closestMetar = m;
                    }
                  });
                  if (closestMetar && minMetarDist < 45) {
                    clouds = [];
                    raw = closestMetar.rawOb || "";
                    stnElevFt = closestMetar.elev ? closestMetar.elev * 3.28084 : 0;
                    cloudRegex = /(FEW|SCT|BKN|OVC|VV)(\d{3})/g;
                    lowestBase = Infinity;
                    while ((match = cloudRegex.exec(raw)) !== null) {
                      agl = parseInt(match[2], 10) * 100;
                      msl = Math.round(agl + stnElevFt);
                      if (msl < lowestBase) lowestBase = msl;
                      clouds.push({
                        type: match[1],
                        baseAgl: agl,
                        baseMsl: msl
                      });
                    }
                    hasRain = /\b(-|\+)?(RA|DZ|SH|SHRA)\b/i.test(raw);
                    hasSnow = /\b(-|\+)?(SN|SG|PL|SHSN)\b/i.test(raw);
                    hasTS = /\b(-|\+)?(TS|TSRA|CB)\b/i.test(raw);
                    metarFltCat = closestMetar.fltcat || closestMetar.fltCat || "VFR";
                    if (clouds.length === 0) {
                      estimatedCloud = vpBuildTempDewCloudLayer({
                        tempC: closestMetar.temp,
                        dewPointC: closestMetar.dewp,
                        windKt: closestMetar.wspd,
                        terrainFt: stnElevFt,
                        fltCat: metarFltCat,
                        hasRain,
                        hasSnow,
                        raw,
                        source: 'metar_temp_dew'
                      });
                      if (estimatedCloud) {
                        clouds.push(estimatedCloud);
                        lowestBase = estimatedCloud.baseMsl;
                      }
                    }
                    mslPressureRaw = Number((_ref45 = (_closestMetar$mslp = closestMetar.mslp) !== null && _closestMetar$mslp !== void 0 ? _closestMetar$mslp : closestMetar.slp) !== null && _ref45 !== void 0 ? _ref45 : closestMetar.altim);
                    mslPressureHpa = Number.isFinite(mslPressureRaw) && mslPressureRaw >= 850 && mslPressureRaw <= 1100 ? mslPressureRaw : null;
                    pressureProfile = [];
                    if (Number.isFinite(mslPressureHpa)) {
                      pressureAnomalyFt = (mslPressureHpa - VP_STD_MSL_PRESSURE_HPA) * 27;
                      base1000 = Number(VP_OM_LEVEL_DEFAULT_FT[1000] || 360);
                      wkt = Number(closestMetar.wspd);
                      wdir = Number(closestMetar.wdir);
                      pressureProfile.push({
                        hPa: 1000,
                        geopotentialFt: base1000 + pressureAnomalyFt,
                        windKt: Number.isFinite(wkt) ? wkt : null,
                        windDirDeg: Number.isFinite(wdir) ? wdir : null
                      });
                    }
                    visuals = {
                      puffs: [],
                      drops: [],
                      flashes: []
                    };
                    if (clouds.length > 0) {
                      for (_c = 0; _c < 25; _c++) visuals.puffs.push({
                        x: Math.random(),
                        y: Math.random(),
                        r: Math.random(),
                        op: Math.random()
                      });
                    }
                    if (hasRain || hasSnow) {
                      for (_d4 = 0; _d4 < 120; _d4++) visuals.drops.push({
                        x: Math.random(),
                        y: Math.random(),
                        spd: Math.random()
                      });
                    }
                    if (hasTS) {
                      for (f = 0; f < 2; f++) visuals.flashes.push({
                        x: Math.random(),
                        pts: [Math.random(), Math.random(), Math.random(), Math.random()]
                      });
                    }

                    // IMMER pushen, damit auch wolkenlose Stationen als Marker auf der Karte landen!
                    zones.push({
                      distNM: bestPt.distNM,
                      icao: closestMetar.icaoId,
                      stnDist: Math.round(minMetarDist),
                      clouds: clouds,
                      lowestBase: lowestBase !== Infinity ? lowestBase : 5000,
                      weather: {
                        hasRain,
                        hasSnow,
                        hasTS
                      },
                      visuals: visuals,
                      stnLat: closestMetar.lat,
                      stnLon: closestMetar.lon,
                      fltCat: metarFltCat,
                      raw: raw,
                      wdir: closestMetar.wdir,
                      wspd: closestMetar.wspd,
                      mslPressureHpa: mslPressureHpa,
                      pressureProfile: pressureProfile,
                      wxSource: 'metar'
                    });
                  }
                case 1:
                  return _context31.a(2);
              }
            }, _loop12);
          });
          targetDist = 0;
        case 11:
          if (!(targetDist <= totalDist)) {
            _context32.n = 13;
            break;
          }
          return _context32.d(_regeneratorValues(_loop12()), 12);
        case 12:
          targetDist += stepNM;
          _context32.n = 11;
          break;
        case 13:
          return _context32.a(2, zones.length > 0 ? zones : null);
      }
    }, _callee26);
  }));
  return _fetchRouteWeatherMetar.apply(this, arguments);
}
var VP_OM_PRESSURE_LEVELS = [1000, 925, 850, 700, 600, 500];
var VP_OM_LEVEL_DEFAULT_FT = {
  1000: 360,
  925: 2500,
  850: 5000,
  700: 10000,
  600: 14000,
  500: 18200
};
var VP_STD_MSL_PRESSURE_HPA = 1013.25;
var VP_OM_CACHE_TTL_MS = 30 * 60 * 1000;
var VP_OM_STALE_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
var VP_OM_COOLDOWN_MS = 15 * 60 * 1000;
var VP_OM_DAILY_LIMIT_STORAGE_KEY = 'ga_om_daily_limit_until_v1';
var VP_METAR_RECOVERY_PROBE_MS = 2 * 60 * 1000;
var VP_METAR_ROUTE_CACHE_TTL_MS = 30 * 60 * 1000;
var VP_METAR_ROUTE_CACHE_MAX = 24;
var VP_METAR_FAIL_COOLDOWN_MS = 4 * 60 * 1000;
var VP_METAR_FAIL_COOLDOWN_SOFT_MS = 45 * 1000;
var VP_METAR_CHUNK_CACHE_TTL_MS = 30 * 60 * 1000;
var VP_METAR_CHUNK_EMPTY_TTL_MS = 20 * 1000;
var VP_METAR_CHUNK_CACHE_MAX = 420;
var VP_METAR_PROXY_FAIL_COOLDOWN_MS = 30 * 1000;
var VP_METAR_PREFETCH_NEAR_NM = 80;
var VP_METAR_PREFETCH_FAR_NM = 150;
var VP_METAR_PREFETCH_CELL_DEG = 1.6;
var VP_METAR_PREFETCH_MAX_CHUNKS = 2;
var VP_METAR_PREFETCH_MIN_INTERVAL_MS = 3 * 60 * 1000;
var VP_OM_CACHE_STORAGE_KEY = 'ga_om_cache_v2';
var VP_OM_CACHE_MAX_ENTRIES = 900;
var VP_OM_COORD_STEP_BASE = 0.05; // ~3 NM
var VP_OM_COORD_STEP_PRESS = 0.075; // ~4-5 NM
var VP_HDG_WEATHER_CHUNK_CACHE_TTL_MS = 30 * 60 * 1000;
var VP_HDG_WEATHER_CHUNK_CACHE_MAX = 80;
var VP_HDG_WEATHER_COVERAGE_STEP_DEG = 0.25;
var VP_WEATHER_AUTO_FALLBACK_DEFAULT = true;
var vpOpenMeteoPointCache = new Map();
var vpOpenMeteoPointInFlight = new Map();
var vpMetarChunkCache = new Map();
var vpMetarProxyBackoff = new Map();
var vpMetarPrefetchInFlight = new Set();
var vpHdgWeatherChunkCache = new Map();
var vpOmCacheHydrated = false;
var vpOmCachePersistTimer = null;
var vpMetarRouteCache = new Map();
window.vpOpenMeteoDailyLimitUntil = Number(localStorage.getItem(VP_OM_DAILY_LIMIT_STORAGE_KEY) || 0);
window.vpWeatherFallbackActive = false;
window.vpWeatherFallbackMode = 'none'; // none | openmeteo_to_metar | metar_to_openmeteo
window.vpWeatherAutoFallbackFrom = null; // metar | null
window.vpWeatherFallbackSince = 0;
window.vpMetarRecoveryProbeAt = 0;
window.vpMetarDownUntil = Number(window.vpMetarDownUntil || 0);
window.vpWeatherDebug = window.vpWeatherDebug || {
  sessionStartedAt: Date.now(),
  openMeteoNetworkRequests: 0,
  elevationNetworkRequests: 0,
  openMeteoBatchCalls: 0,
  openMeteoBatchPoints: 0,
  openMeteoCacheHits: 0,
  openMeteoCacheMisses: 0,
  openMeteoStaleCacheHits: 0,
  openMeteoCooldownSkips: 0,
  cacheHydratedEntries: 0,
  cachePersistWrites: 0,
  cachePersistErrors: 0,
  profileRouteFetches: 0,
  mapOverlayFetches: 0,
  hdgFetches: 0,
  hdgSkippedNoAreaChange: 0,
  fallbackToMetarCount: 0,
  fallbackToOpenMeteoCount: 0,
  fallbackLastAt: 0,
  fallbackLastReason: '',
  elevationFallbackCount: 0,
  lastElevationFallbackAt: 0,
  lastElevationFallbackReason: '',
  openMeteoErrors: 0,
  lastErrorAt: 0,
  lastErrorMsg: '',
  openMeteo429Count: 0,
  last429At: 0,
  openMeteoDailyLimitCount: 0,
  openMeteoDailyLimitUntil: Number(window.vpOpenMeteoDailyLimitUntil || 0),
  elevation429Count: 0,
  lastElevation429At: 0,
  overpassRequests: 0,
  overpass429Count: 0,
  overpass504Count: 0,
  overpassCooldownSkips: 0,
  overpassRouteThrottleSkips: 0,
  overpassInFlightJoins: 0,
  hostedTileRequests: 0,
  hostedTileHits: 0,
  hostedTileCoreHits: 0,
  hostedTileLegacyHits: 0,
  hostedTileMisses: 0,
  hostedTileErrors: 0,
  overpassTileCoverageHits: 0,
  overpassTileCoverageMisses: 0,
  overpassTileCoverageEntries: 0,
  overpassTileLastMissingCount: 0,
  overpassTileLastMissingSample: '',
  overpassDeferredRuns: 0,
  overpassDeferredTilesTotal: 0,
  overpassLastDeferredCount: 0,
  globalErrors: 0,
  globalWarnings: 0,
  unhandledRejections: 0,
  lastGlobalErrorAt: 0,
  lastGlobalErrorMsg: '',
  debugHooksInstalled: false,
  lastSuccessAt: 0,
  lastElevationSuccessAt: 0,
  recentEvents: []
};
function vpWeatherDebugEvent(message) {
  var dbg = window.vpWeatherDebug;
  if (!dbg) return;
  var ts = Date.now();
  dbg.recentEvents.push({
    ts,
    message: String(message || '')
  });
  if (dbg.recentEvents.length > 40) dbg.recentEvents = dbg.recentEvents.slice(-40);
}
function vpWeatherDebugSetError(err) {
  var context = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  var dbg = window.vpWeatherDebug;
  if (!dbg) return;
  dbg.openMeteoErrors += 1;
  dbg.lastErrorAt = Date.now();
  var msg = err && (err.message || String(err));
  dbg.lastErrorMsg = context ? `${context}: ${msg}` : msg || 'unbekannter Fehler';
  vpWeatherDebugEvent(`ERR ${dbg.lastErrorMsg}`);
}
window.vpWeatherDebugSetError = vpWeatherDebugSetError;
function vpBuildElevationRouteKey(routePts) {
  var precision = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 4;
  return (routePts || []).map(p => `${Number(p.lat || 0).toFixed(precision)},${Number(p.lng || p.lon || 0).toFixed(precision)}`).join('|');
}
function vpGetStoredElevationCache(key) {
  var coarse = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  try {
    var prefix = coarse ? 'ga_elev_cache_q3_' : 'ga_elev_cache_';
    var stored = localStorage.getItem(prefix + key);
    if (!stored) return null;
    var data = JSON.parse(stored);
    return Array.isArray(data) && data.length >= 2 ? data : null;
  } catch (_) {
    return null;
  }
}
function vpSetStoredElevationCache(key, data) {
  var coarse = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
  try {
    var prefix = coarse ? 'ga_elev_cache_q3_' : 'ga_elev_cache_';
    localStorage.setItem(prefix + key, JSON.stringify(data));
  } catch (_) {}
}
function vpIsElevationCoolingDown() {
  var _window$vpWeatherDebu;
  var now = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Date.now();
  var last429 = Number(((_window$vpWeatherDebu = window.vpWeatherDebug) === null || _window$vpWeatherDebu === void 0 ? void 0 : _window$vpWeatherDebu.lastElevation429At) || 0);
  return last429 > 0 && now - last429 < VP_ELEVATION_COOLDOWN_MS;
}
function vpRecordElevation429() {
  var dbg = window.vpWeatherDebug;
  if (!dbg) return;
  dbg.elevation429Count += 1;
  dbg.lastElevation429At = Date.now();
  vpWeatherDebugEvent('Elevation 429 rate limit');
}
function vpRecordElevationFallback(reason) {
  window.vpElevationFallbackActive = true;
  window.vpTerrainElevationSource = 'fallback';
  var dbg = window.vpWeatherDebug;
  if (!dbg) return;
  dbg.elevationFallbackCount += 1;
  dbg.lastElevationFallbackAt = Date.now();
  dbg.lastElevationFallbackReason = String(reason || 'fallback');
  vpWeatherDebugEvent(`terrain fallback -> ${dbg.lastElevationFallbackReason}`);
}
function vpPersistElevationResult(cacheKey, coarseKey, data) {
  var source = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 'terrarium';
  if (!Array.isArray(data) || data.length < 2) return data;
  var coarseMemKey = 'q3|' + coarseKey;
  vpElevationCache[cacheKey] = data;
  vpElevationCache[coarseMemKey] = data;
  vpSetStoredElevationCache(cacheKey, data, false);
  vpSetStoredElevationCache(coarseKey, data, true);
  window.vpElevationFallbackActive = false;
  window.vpTerrainElevationSource = source;
  if (window.vpWeatherDebug) window.vpWeatherDebug.lastElevationSuccessAt = Date.now();
  return data;
}
function vpGetTerrariumZoom() {
  return typeof TAWS_TILE_ZOOM === 'number' && TAWS_TILE_ZOOM > 0 ? TAWS_TILE_ZOOM : 10;
}
function vpDecodeTerrariumFt(imageData, px, py) {
  if (!imageData || !imageData.data) return 0;
  var idx = (py * 256 + px) * 4;
  var r = imageData.data[idx];
  var g = imageData.data[idx + 1];
  var b = imageData.data[idx + 2];
  var elevM = r * 256 + g + b / 256 - 32768;
  return Math.round(elevM * 3.28084);
}
function vpFetchElevationFromTerrarium(_x19, _x20) {
  return _vpFetchElevationFromTerrarium.apply(this, arguments);
}
function _vpFetchElevationFromTerrarium() {
  _vpFetchElevationFromTerrarium = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee27(samplePts, signal) {
    var zoom, tileMap, _iterator84, _step84, p, _tawsLatLonToPixel2, tile, key, loads, result, _iterator85, _step85, _tileMap$get, _p4, _tawsLatLonToPixel3, _tile, px, py, _key6, imageData, _t26, _t27;
    return _regenerator().w(function (_context33) {
      while (1) switch (_context33.p = _context33.n) {
        case 0:
          if (!(!Array.isArray(samplePts) || samplePts.length < 2)) {
            _context33.n = 1;
            break;
          }
          return _context33.a(2, null);
        case 1:
          if (!window.gaProfileDataProvider) {
            _context33.n = 2;
            break;
          }
          return _context33.a(2, window.gaProfileDataProvider.terrain(samplePts, signal, 'ROUTE'));
        case 2:
          if (!(typeof _tawsLatLonToPixel !== 'function' || typeof _tawsLoadTile !== 'function')) {
            _context33.n = 3;
            break;
          }
          return _context33.a(2, null);
        case 3:
          zoom = vpGetTerrariumZoom();
          tileMap = new Map();
          _iterator84 = _createForOfIteratorHelper(samplePts);
          _context33.p = 4;
          _iterator84.s();
        case 5:
          if ((_step84 = _iterator84.n()).done) {
            _context33.n = 8;
            break;
          }
          p = _step84.value;
          if (!(signal && signal.aborted)) {
            _context33.n = 6;
            break;
          }
          throw new DOMException('Aborted', 'AbortError');
        case 6:
          _tawsLatLonToPixel2 = _tawsLatLonToPixel(p.lat, p.lon, zoom), tile = _tawsLatLonToPixel2.tile;
          key = `${zoom}/${tile.x}/${tile.y}`;
          if (!tileMap.has(key)) tileMap.set(key, {
            x: tile.x,
            y: tile.y
          });
        case 7:
          _context33.n = 5;
          break;
        case 8:
          _context33.n = 10;
          break;
        case 9:
          _context33.p = 9;
          _t26 = _context33.v;
          _iterator84.e(_t26);
        case 10:
          _context33.p = 10;
          _iterator84.f();
          return _context33.f(10);
        case 11:
          loads = [];
          tileMap.forEach((tile, key) => {
            loads.push(_tawsLoadTile(tile.x, tile.y, zoom).then(imageData => {
              tileMap.set(key, _objectSpread(_objectSpread({}, tile), {}, {
                imageData
              }));
            }).catch(() => {
              tileMap.set(key, _objectSpread(_objectSpread({}, tile), {}, {
                imageData: null
              }));
            }));
          });
          _context33.n = 12;
          return Promise.all(loads);
        case 12:
          if (!(signal && signal.aborted)) {
            _context33.n = 13;
            break;
          }
          throw new DOMException('Aborted', 'AbortError');
        case 13:
          result = [];
          _iterator85 = _createForOfIteratorHelper(samplePts);
          _context33.p = 14;
          _iterator85.s();
        case 15:
          if ((_step85 = _iterator85.n()).done) {
            _context33.n = 18;
            break;
          }
          _p4 = _step85.value;
          _tawsLatLonToPixel3 = _tawsLatLonToPixel(_p4.lat, _p4.lon, zoom), _tile = _tawsLatLonToPixel3.tile, px = _tawsLatLonToPixel3.px, py = _tawsLatLonToPixel3.py;
          _key6 = `${zoom}/${_tile.x}/${_tile.y}`;
          imageData = ((_tileMap$get = tileMap.get(_key6)) === null || _tileMap$get === void 0 ? void 0 : _tileMap$get.imageData) || null;
          if (imageData) {
            _context33.n = 16;
            break;
          }
          return _context33.a(2, null);
        case 16:
          result.push({
            distNM: _p4.distNM,
            elevFt: Math.max(0, vpDecodeTerrariumFt(imageData, px, py)),
            lat: _p4.lat,
            lon: _p4.lon
          });
        case 17:
          _context33.n = 15;
          break;
        case 18:
          _context33.n = 20;
          break;
        case 19:
          _context33.p = 19;
          _t27 = _context33.v;
          _iterator85.e(_t27);
        case 20:
          _context33.p = 20;
          _iterator85.f();
          return _context33.f(20);
        case 21:
          return _context33.a(2, result);
      }
    }, _callee27, null, [[14, 19, 20, 21], [4, 9, 10, 11]]);
  }));
  return _vpFetchElevationFromTerrarium.apply(this, arguments);
}
function vpBuildInterpolatedRoutePoints(routePts) {
  var interpolated = [];
  var cumulativeDist = 0;
  for (var i = 0; i < routePts.length - 1; i++) {
    var p1 = routePts[i],
      p2 = routePts[i + 1];
    var lat1 = p1.lat,
      lon1 = p1.lng || p1.lon;
    var lat2 = p2.lat,
      lon2 = p2.lng || p2.lon;
    var segDist = calcNav(lat1, lon1, lat2, lon2).dist;
    var steps = Math.max(1, Math.round(segDist));
    for (var j = 0; j <= steps; j++) {
      if (i > 0 && j === 0) continue;
      var f = j / steps;
      interpolated.push({
        lat: lat1 + (lat2 - lat1) * f,
        lon: lon1 + (lon2 - lon1) * f,
        distNM: cumulativeDist + segDist * f
      });
    }
    cumulativeDist += segDist;
  }
  var samplePts = interpolated;
  if (interpolated.length > 100) {
    samplePts = [];
    for (var _i3 = 0; _i3 < 100; _i3++) {
      var idx = Math.round(_i3 * (interpolated.length - 1) / 99);
      samplePts.push(interpolated[idx]);
    }
  }
  return {
    interpolated,
    samplePts
  };
}
function vpBuildApproxElevationProfile(interpolated) {
  if (!Array.isArray(interpolated) || interpolated.length < 2) return [];
  var totalDist = interpolated[interpolated.length - 1].distNM || 1;
  var depElevFt = Number.isFinite(currentDepElev) ? Number(currentDepElev) : 0;
  var destElevFt = Number.isFinite(currentDestElev) ? Number(currentDestElev) : depElevFt;
  return interpolated.map(p => {
    var t = totalDist > 0 ? p.distNM / totalDist : 0;
    var smoothBias = Math.sin(t * Math.PI) * 120;
    return {
      distNM: p.distNM,
      elevFt: Math.max(0, Math.round(depElevFt + (destElevFt - depElevFt) * t + smoothBias)),
      lat: p.lat,
      lon: p.lon
    };
  });
}
function vpIsOpenMeteoCoolingDown() {
  var _window$vpWeatherDebu2;
  var now = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Date.now();
  var dailyUntil = Number(window.vpOpenMeteoDailyLimitUntil || 0);
  if (dailyUntil > now) return true;
  var last429 = Number(((_window$vpWeatherDebu2 = window.vpWeatherDebug) === null || _window$vpWeatherDebu2 === void 0 ? void 0 : _window$vpWeatherDebu2.last429At) || 0);
  return last429 > 0 && now - last429 < VP_OM_COOLDOWN_MS;
}
window.vpIsOpenMeteoCoolingDown = vpIsOpenMeteoCoolingDown;
function vpNextUtcMidnightMs() {
  var now = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Date.now();
  var d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 10, 0);
}
function vpLooksLikeDailyOpenMeteoLimit(text) {
  return /daily\s+api\s+request\s+limit|try\s+again\s+tomorrow|daily\s+limit/i.test(String(text || ''));
}
function vpSetOpenMeteoDailyLimit() {
  var untilMs = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : vpNextUtcMidnightMs();
  var reason = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'daily limit';
  var until = Math.max(Date.now() + VP_OM_COOLDOWN_MS, Number(untilMs || 0));
  window.vpOpenMeteoDailyLimitUntil = Math.max(Number(window.vpOpenMeteoDailyLimitUntil || 0), until);
  try {
    localStorage.setItem(VP_OM_DAILY_LIMIT_STORAGE_KEY, String(window.vpOpenMeteoDailyLimitUntil));
  } catch (_) {}
  if (window.vpWeatherDebug) {
    window.vpWeatherDebug.openMeteoDailyLimitCount += 1;
    window.vpWeatherDebug.openMeteoDailyLimitUntil = window.vpOpenMeteoDailyLimitUntil;
    window.vpWeatherDebug.last429At = Date.now();
  }
  vpSetWeatherFallbackMode('openmeteo_to_metar', `openmeteo daily limit: ${reason}`);
  vpWeatherDebugEvent(`Open-Meteo daily limit until ${vpFormatDebugTs(window.vpOpenMeteoDailyLimitUntil)}`);
}
function vpRecordOpenMeteo429Text() {
  var text = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  var context = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  var dbg = window.vpWeatherDebug;
  if (dbg) {
    dbg.openMeteo429Count += 1;
    dbg.last429At = Date.now();
  }
  if (vpLooksLikeDailyOpenMeteoLimit(text)) {
    vpSetOpenMeteoDailyLimit(vpNextUtcMidnightMs(), context || text || '429');
  } else {
    vpWeatherDebugEvent(`Open-Meteo 429 rate limit${context ? ` (${context})` : ''}`);
  }
}
window.vpRecordOpenMeteo429FromResponse = /*#__PURE__*/function () {
  var _ref10 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5(res) {
    var context,
      text,
      _args5 = arguments,
      _t3;
    return _regenerator().w(function (_context5) {
      while (1) switch (_context5.p = _context5.n) {
        case 0:
          context = _args5.length > 1 && _args5[1] !== undefined ? _args5[1] : '';
          text = '';
          _context5.p = 1;
          _context5.n = 2;
          return res.clone().text();
        case 2:
          text = _context5.v;
          _context5.n = 4;
          break;
        case 3:
          _context5.p = 3;
          _t3 = _context5.v;
        case 4:
          vpRecordOpenMeteo429Text(text, context);
          return _context5.a(2, text);
      }
    }, _callee5, null, [[1, 3]]);
  }));
  return function (_x21) {
    return _ref10.apply(this, arguments);
  };
}();
window.vpIsOpenMeteoDailyLimited = function () {
  var now = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Date.now();
  return Number(window.vpOpenMeteoDailyLimitUntil || 0) > now;
};
function vpIsOpenMeteoDisplayActive() {
  var fbMode = String(window.vpWeatherFallbackMode || 'none');
  if (fbMode === 'openmeteo_to_metar') return false;
  if (fbMode === 'metar_to_openmeteo') return !vpIsOpenMeteoCoolingDown();
  if (vpWeatherSource !== 'openmeteo') return false;
  return !vpIsOpenMeteoCoolingDown();
}
window.vpIsOpenMeteoDisplayActive = vpIsOpenMeteoDisplayActive;
function vpGetWeatherSourceCacheKey() {
  var src = window.vpWeatherSource || vpWeatherSource || 'metar';
  var mode = String(window.vpWeatherFallbackMode || 'none');
  return `${src}:${mode}`;
}
function vpIsWeatherAutoFallbackEnabled() {
  try {
    var raw = localStorage.getItem('ga_weather_auto_fallback');
    if (raw === null) return VP_WEATHER_AUTO_FALLBACK_DEFAULT;
    return raw === 'true' || raw === '1';
  } catch (_) {
    return VP_WEATHER_AUTO_FALLBACK_DEFAULT;
  }
}
function vpSetWeatherFallbackMode(mode) {
  var reason = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
  var normalized = mode === 'openmeteo_to_metar' || mode === 'metar_to_openmeteo' ? mode : 'none';
  var prev = String(window.vpWeatherFallbackMode || 'none');
  window.vpWeatherFallbackMode = normalized;
  window.vpWeatherFallbackActive = normalized !== 'none';
  if (window.vpWeatherFallbackActive && (!Number.isFinite(window.vpWeatherFallbackSince) || window.vpWeatherFallbackSince <= 0)) {
    window.vpWeatherFallbackSince = Date.now();
  }
  if (!window.vpWeatherFallbackActive) {
    window.vpWeatherFallbackSince = 0;
    window.vpMetarRecoveryProbeAt = 0;
  }
  if (prev !== normalized && window.vpWeatherDebug) {
    var dbg = window.vpWeatherDebug;
    dbg.fallbackLastAt = Date.now();
    if (normalized === 'openmeteo_to_metar') dbg.fallbackToMetarCount += 1;
    if (normalized === 'metar_to_openmeteo') dbg.fallbackToOpenMeteoCount += 1;
  }
  if (reason && window.vpWeatherDebug) {
    window.vpWeatherDebug.fallbackLastAt = Date.now();
    window.vpWeatherDebug.fallbackLastReason = reason;
  }
  if (prev !== normalized || reason) {
    var suffix = reason ? ` (${reason})` : '';
    vpWeatherDebugEvent(`fallback mode -> ${normalized}${suffix}`);
    try {
      console.info(`[Wetter] Fallback-Modus: ${normalized}${suffix}`);
    } catch (_) {}
  }
}
function vpBuildMetarRouteCacheKey(routePts, elevData) {
  if (Array.isArray(elevData) && elevData.length >= 2) return `e3:${vpBuildElevationRouteKey(elevData, 3)}`;
  return `r3:${vpBuildElevationRouteKey(routePts || [], 3)}`;
}
function vpGetMetarRouteCache(routeKey) {
  var now = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Date.now();
  if (!routeKey) return null;
  var entry = vpMetarRouteCache.get(routeKey);
  if (!entry || !Array.isArray(entry.data)) return null;
  if (now - Number(entry.ts || 0) > VP_METAR_ROUTE_CACHE_TTL_MS) {
    vpMetarRouteCache.delete(routeKey);
    return null;
  }
  return entry.data;
}
function vpSetMetarRouteCache(routeKey, data) {
  var now = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : Date.now();
  if (!routeKey || !Array.isArray(data) || data.length === 0) return;
  vpMetarRouteCache.set(routeKey, {
    ts: now,
    data
  });
  if (vpMetarRouteCache.size <= VP_METAR_ROUTE_CACHE_MAX) return;
  var oldest = Array.from(vpMetarRouteCache.entries()).sort((a, b) => Number(a[1] && a[1].ts || 0) - Number(b[1] && b[1].ts || 0)).slice(0, Math.max(1, vpMetarRouteCache.size - VP_METAR_ROUTE_CACHE_MAX));
  var _iterator30 = _createForOfIteratorHelper(oldest),
    _step30;
  try {
    for (_iterator30.s(); !(_step30 = _iterator30.n()).done;) {
      var _step30$value = _slicedToArray(_step30.value, 1),
        k = _step30$value[0];
      vpMetarRouteCache.delete(k);
    }
  } catch (err) {
    _iterator30.e(err);
  } finally {
    _iterator30.f();
  }
}
function vpMarkMetarFailure() {
  var reason = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'metar unavailable';
  var cooldownMs = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : VP_METAR_FAIL_COOLDOWN_MS;
  var cdMs = Math.max(10 * 1000, Number(cooldownMs || VP_METAR_FAIL_COOLDOWN_MS));
  var until = Date.now() + cdMs;
  window.vpMetarDownUntil = Math.max(Number(window.vpMetarDownUntil || 0), until);
  vpSetWeatherFallbackMode('metar_to_openmeteo', reason);
}
function vpClearMetarFailure() {
  window.vpMetarDownUntil = 0;
}
function vpIsMetarCoolingDown() {
  var now = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Date.now();
  return Number(window.vpMetarDownUntil || 0) > now;
}
function vpHasUsableOpenMeteoRouteData(zones) {
  if (!Array.isArray(zones) || zones.length === 0) return false;
  return zones.some(z => z && Number.isFinite(Number(z.stnLat)) && Number.isFinite(Number(z.stnLon)) && (Array.isArray(z.pressureProfile) && z.pressureProfile.length >= 1 || Number.isFinite(Number(z.cloudTotalPct)) || Number.isFinite(Number(z.wspd))));
}
function vpProbeMetarRecovery(_x22, _x23, _x24) {
  return _vpProbeMetarRecovery.apply(this, arguments);
}
function _vpProbeMetarRecovery() {
  _vpProbeMetarRecovery = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee28(routePts, elevData, signal) {
    var metar, _t28;
    return _regenerator().w(function (_context34) {
      while (1) switch (_context34.p = _context34.n) {
        case 0:
          if (!(!routePts || routePts.length < 2 || !elevData || elevData.length < 2)) {
            _context34.n = 1;
            break;
          }
          return _context34.a(2, false);
        case 1:
          _context34.p = 1;
          _context34.n = 2;
          return fetchRouteWeatherMetar(routePts, elevData, signal, {
            fastFail: true
          });
        case 2:
          metar = _context34.v;
          return _context34.a(2, !!(Array.isArray(metar) && metar.length > 0));
        case 3:
          _context34.p = 3;
          _t28 = _context34.v;
          if (!(_t28 && _t28.name === 'AbortError')) {
            _context34.n = 4;
            break;
          }
          throw _t28;
        case 4:
          return _context34.a(2, false);
      }
    }, _callee28, null, [[1, 3]]);
  }));
  return _vpProbeMetarRecovery.apply(this, arguments);
}
function vpInstallGlobalDebugHooks() {
  var dbg = window.vpWeatherDebug;
  if (!dbg || dbg.debugHooksInstalled) return;
  dbg.debugHooksInstalled = true;
  window.addEventListener('error', ev => {
    var msg = ev && (ev.message || ev.error && ev.error.message) || 'window error';
    dbg.globalErrors += 1;
    dbg.lastGlobalErrorAt = Date.now();
    dbg.lastGlobalErrorMsg = `error: ${msg}`;
    vpWeatherDebugEvent(`GLOBAL ERR ${msg}`);
  });
  window.addEventListener('unhandledrejection', ev => {
    var reason = ev && ev.reason;
    var msg = reason && (reason.message || String(reason)) || 'unhandled rejection';
    dbg.unhandledRejections += 1;
    dbg.lastGlobalErrorAt = Date.now();
    dbg.lastGlobalErrorMsg = `rejection: ${msg}`;
    vpWeatherDebugEvent(`UNHANDLED ${msg}`);
  });
  var origWarn = console.warn ? console.warn.bind(console) : null;
  var origError = console.error ? console.error.bind(console) : null;
  if (origWarn) {
    console.warn = function () {
      for (var _len = arguments.length, args = new Array(_len), _key4 = 0; _key4 < _len; _key4++) {
        args[_key4] = arguments[_key4];
      }
      try {
        dbg.globalWarnings += 1;
        var msg = args.map(a => {
          if (typeof a === 'string') return a;
          if (a && a.message) return a.message;
          try {
            return JSON.stringify(a);
          } catch (_) {
            return String(a);
          }
        }).join(' ').slice(0, 220);
        vpWeatherDebugEvent(`WARN ${msg}`);
      } catch (_) {}
      return origWarn.apply(void 0, args);
    };
  }
  if (origError) {
    console.error = function () {
      for (var _len2 = arguments.length, args = new Array(_len2), _key5 = 0; _key5 < _len2; _key5++) {
        args[_key5] = arguments[_key5];
      }
      try {
        dbg.globalErrors += 1;
        var msg = args.map(a => {
          if (typeof a === 'string') return a;
          if (a && a.message) return a.message;
          try {
            return JSON.stringify(a);
          } catch (_) {
            return String(a);
          }
        }).join(' ').slice(0, 260);
        dbg.lastGlobalErrorAt = Date.now();
        dbg.lastGlobalErrorMsg = msg;
        vpWeatherDebugEvent(`ERROR ${msg}`);
      } catch (_) {}
      return origError.apply(void 0, args);
    };
  }
}
function vpFormatDebugTs(ts) {
  if (!Number.isFinite(ts) || ts <= 0) return '-';
  try {
    return new Date(ts).toLocaleString();
  } catch (_) {
    return String(ts);
  }
}
function vpApproxStorageBytes(key) {
  try {
    var raw = localStorage.getItem(key);
    return raw ? raw.length * 2 : 0;
  } catch (_) {
    return 0;
  }
}
function vpApproxStorageBytesByPrefix(prefix) {
  var total = 0;
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      var raw = localStorage.getItem(k);
      if (raw) total += raw.length * 2;
    }
  } catch (_) {}
  return total;
}
function vpFormatBytes(bytes) {
  var b = Number(bytes || 0);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}
var vpStorageEstimateSnapshot = null;
var vpStorageEstimateInFlight = false;
function vpRequestStorageEstimate() {
  if (vpStorageEstimateInFlight || !navigator.storage || typeof navigator.storage.estimate !== 'function') return;
  var now = Date.now();
  if (vpStorageEstimateSnapshot && now - Number(vpStorageEstimateSnapshot.ts || 0) < 60000) return;
  vpStorageEstimateInFlight = true;
  Promise.resolve(navigator.storage.estimate()).then(estimate => {
    vpStorageEstimateSnapshot = {
      ts: Date.now(),
      usage: Number((estimate === null || estimate === void 0 ? void 0 : estimate.usage) || 0),
      quota: Number((estimate === null || estimate === void 0 ? void 0 : estimate.quota) || 0)
    };
  }).catch(() => {}).then(() => {
    vpStorageEstimateInFlight = false;
  });
}
function vpStorageCategoryForKey() {
  var key = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  var k = String(key || '');
  if (k === 'ga_pinboard') return 'Pinnwand/Flugarchiv';
  if (k === 'ga_logbook' || k === 'last_icao_dest') return 'Logbuch';
  if (/^ga_(?:active_mission|active_passenger|pending_mission_debrief)/.test(k)) return 'Aktive Mission';
  if (/debug|trace|snapshot/i.test(k)) return 'Debug/Snapshots';
  if (/^ga_(?:obs_|om_|lms_|vfr_overlay_|metar_|weather_)/.test(k)) return 'Wetter/Obstacle-Caches';
  if (/^ga_/.test(k)) return 'App-Einstellungen';
  return 'Sonstige';
}
function vpCollectLocalStorageInventory() {
  var entries = [];
  var groups = new Map();
  var totalBytes = 0;
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key) continue;
      var raw = localStorage.getItem(key) || '';
      // localStorage speichert DOMStrings; UTF-16 ist fuer die Quota-Diagnose
      // die nuetzlichere Naeherung als die UTF-8-Netzwerkgroesse.
      var bytes = (key.length + raw.length) * 2;
      var category = vpStorageCategoryForKey(key);
      entries.push({
        key,
        bytes,
        chars: raw.length,
        category
      });
      totalBytes += bytes;
      groups.set(category, Number(groups.get(category) || 0) + bytes);
    }
  } catch (_) {}
  entries.sort((a, b) => b.bytes - a.bytes || a.key.localeCompare(b.key));
  var groupEntries = Array.from(groups.entries()).map(_ref11 => {
    var _ref12 = _slicedToArray(_ref11, 2),
      category = _ref12[0],
      bytes = _ref12[1];
    return {
      category,
      bytes
    };
  }).sort((a, b) => b.bytes - a.bytes || a.category.localeCompare(b.category));
  return {
    totalBytes,
    entries,
    groups: groupEntries
  };
}
function vpPinboardStorageStats() {
  try {
    var raw = localStorage.getItem('ga_pinboard') || '[]';
    var notes = JSON.parse(raw);
    if (!Array.isArray(notes)) return null;
    var pinnedFlights = 0;
    var recordedFlights = 0;
    var trackPoints = 0;
    notes.forEach(note => {
      if ((note === null || note === void 0 ? void 0 : note.type) === 'flight') pinnedFlights++;
      if ((note === null || note === void 0 ? void 0 : note.type) === 'flight_record') {
        var _note$flightRecord;
        recordedFlights++;
        if (Array.isArray(note === null || note === void 0 || (_note$flightRecord = note.flightRecord) === null || _note$flightRecord === void 0 ? void 0 : _note$flightRecord.track)) trackPoints += note.flightRecord.track.length;
      }
    });
    return {
      notes: notes.length,
      pinnedFlights,
      recordedFlights,
      trackPoints
    };
  } catch (_) {
    return null;
  }
}
function vpBuildStorageDiagnosticsLines() {
  vpRequestStorageEstimate();
  var inventory = vpCollectLocalStorageInventory();
  var pinboard = vpPinboardStorageStats();
  var lines = ['Lokaler Browser-Speicher'];
  lines.push(`- localStorage gesamt: ca. ${vpFormatBytes(inventory.totalBytes)} | Keys: ${inventory.entries.length} | Berechnung: UTF-16 inkl. Keynamen`);
  if (vpStorageEstimateSnapshot) {
    var usage = Number(vpStorageEstimateSnapshot.usage || 0);
    var quota = Number(vpStorageEstimateSnapshot.quota || 0);
    var pct = quota > 0 ? (usage / quota * 100).toFixed(1) : '-';
    lines.push(`- Origin-Schaetzung: ${vpFormatBytes(usage)} / ${vpFormatBytes(quota)} (${pct}%) | umfasst ggf. auch IndexedDB/CacheStorage; localStorage-Limit separat`);
  } else {
    lines.push('- Origin-Schaetzung: noch nicht verfuegbar');
  }
  if (pinboard) {
    lines.push(`- Pinnwand-Inhalt: ${pinboard.notes} Zettel | gepinnte Missionen ${pinboard.pinnedFlights} | Legacy-Flugtracks ${pinboard.recordedFlights} mit ${pinboard.trackPoints} Punkten`);
  }
  var cloudUpload = window.gaLastCloudUploadDiagnostics;
  if (cloudUpload && typeof cloudUpload === 'object') {
    var fmtChars = value => Number.isFinite(Number(value)) ? `${(Number(value) / 1024).toFixed(1)} KiB` : '-';
    lines.push(`- Cloud-Upload: ${cloudUpload.status || '-'} | raw=${fmtChars(cloudUpload.rawChars)} | kompakt=${fmtChars(cloudUpload.uploadChars)} | Limit=${fmtChars(cloudUpload.limitChars)} | Zeitpunkt=${vpFormatDebugTs(cloudUpload.at)}`);
    var componentText = Object.entries(cloudUpload.uploadComponents || {}).filter(_ref13 => {
      var _ref14 = _slicedToArray(_ref13, 2),
        value = _ref14[1];
      return Number(value) >= 0;
    }).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 8).map(_ref15 => {
      var _ref16 = _slicedToArray(_ref15, 2),
        key = _ref16[0],
        value = _ref16[1];
      return `${key}=${fmtChars(value)}`;
    }).join(' | ');
    if (componentText) lines.push(`- Cloud-Komponenten kompakt: ${componentText}`);
  }
  var groupSummary = inventory.groups.slice(0, 8).map(group => `${group.category} ${vpFormatBytes(group.bytes)}`).join(' | ');
  lines.push(`- Gruppen: ${groupSummary || '-'}`);
  lines.push('- Groesste Keys:');
  if (!inventory.entries.length) {
    lines.push('  * -');
  } else {
    inventory.entries.slice(0, 15).forEach((entry, index) => {
      var share = inventory.totalBytes > 0 ? (entry.bytes / inventory.totalBytes * 100).toFixed(1) : '0.0';
      var safeKey = String(entry.key || '').replace(/[\r\n\t]/g, ' ').slice(0, 100);
      lines.push(`  * ${index + 1}. ${safeKey}: ${vpFormatBytes(entry.bytes)} (${share}%) | ${entry.category}`);
    });
  }
  return lines;
}
try {
  window.vpCollectLocalStorageInventory = vpCollectLocalStorageInventory;
  window.vpBuildStorageDiagnosticsReport = () => vpBuildStorageDiagnosticsLines().join('\n');
} catch (_) {}
vpRequestStorageEstimate();
function vpBuildDisplayDiagnosticsLines() {
  var _screen$orientation, _screen$orientation2, _document$body;
  var fmt = function fmt(value) {
    var digits = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '-';
  };
  var fmtRect = rect => {
    if (!rect) return '-';
    return `${fmt(rect.width)}x${fmt(rect.height)} @ ${fmt(rect.left)},${fmt(rect.top)}`;
  };
  var media = query => {
    try {
      return window.matchMedia && window.matchMedia(query).matches ? '1' : '0';
    } catch (_) {
      return '-';
    }
  };
  var cssVar = name => {
    try {
      return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '-';
    } catch (_) {
      return '-';
    }
  };
  var storageValue = key => {
    try {
      return localStorage.getItem(key) || '-';
    } catch (_) {
      return '-';
    }
  };
  var rectOf = selector => {
    try {
      var node = document.querySelector(selector);
      return node ? node.getBoundingClientRect() : null;
    } catch (_) {
      return null;
    }
  };
  var vv = window.visualViewport || null;
  var dpr = Number(window.devicePixelRatio || 1);
  var innerW = Number(window.innerWidth || 0);
  var innerH = Number(window.innerHeight || 0);
  var visualW = Number((vv === null || vv === void 0 ? void 0 : vv.width) || innerW);
  var visualH = Number((vv === null || vv === void 0 ? void 0 : vv.height) || innerH);
  var ua = String(navigator.userAgent || '');
  var isQuest = /Quest|OculusBrowser|Meta Quest|VR/i.test(ua);
  var appScaleRaw = storageValue('ga_ui_scale_percent');
  var appScale = Number(appScaleRaw === '-' ? 100 : appScaleRaw);
  var cssPixelBudgetW = Math.round(visualW * dpr);
  var cssPixelBudgetH = Math.round(visualH * dpr);
  var layoutLabel = innerW < 740 ? 'phone-like' : innerW < 1024 ? 'tablet-like' : 'desktop-like';
  var pixelLabel = cssPixelBudgetW < 1000 ? 'sehr niedrig' : cssPixelBudgetW < 1500 ? 'niedrig' : cssPixelBudgetW < 2200 ? 'mittel' : 'hoch';
  var lines = [];
  lines.push('Display / Viewport Diagnose');
  lines.push(`- Zeitpunkt: ${vpFormatDebugTs(Date.now())}`);
  lines.push(`- Layout-Breite: ${layoutLabel} | inner=${fmt(innerW)}x${fmt(innerH)} CSS px | outer=${fmt(window.outerWidth)}x${fmt(window.outerHeight)}`);
  lines.push(`- VisualViewport: ${fmt(visualW, 1)}x${fmt(visualH, 1)} CSS px | scale=${fmt(vv === null || vv === void 0 ? void 0 : vv.scale, 3)} | offset=${fmt(vv === null || vv === void 0 ? void 0 : vv.offsetLeft, 1)},${fmt(vv === null || vv === void 0 ? void 0 : vv.offsetTop, 1)}`);
  lines.push(`- devicePixelRatio: ${fmt(dpr, 3)} | geschaetztes Pixelbudget=${cssPixelBudgetW}x${cssPixelBudgetH} (${pixelLabel})`);
  lines.push(`- Screen: ${fmt(screen.width)}x${fmt(screen.height)} CSS px | avail=${fmt(screen.availWidth)}x${fmt(screen.availHeight)} | orientation=${((_screen$orientation = screen.orientation) === null || _screen$orientation === void 0 ? void 0 : _screen$orientation.type) || '-'} ${fmt((_screen$orientation2 = screen.orientation) === null || _screen$orientation2 === void 0 ? void 0 : _screen$orientation2.angle)}`);
  lines.push(`- Document: client=${fmt(document.documentElement.clientWidth)}x${fmt(document.documentElement.clientHeight)} | bodyZoom=${((_document$body = document.body) === null || _document$body === void 0 || (_document$body = _document$body.style) === null || _document$body === void 0 ? void 0 : _document$body.zoom) || '-'} | --ga-ui-scale=${cssVar('--ga-ui-scale')} | savedScale=${appScaleRaw}`);
  lines.push(`- Elemente: container=${fmtRect(rectOf('.container'))} | map=${fmtRect(rectOf('#map'))} | settings=${fmtRect(rectOf('#settingsPanel'))}`);
  lines.push(`- Eingabe/Media: maxTouch=${navigator.maxTouchPoints || 0} | pointerCoarse=${media('(pointer: coarse)')} | hoverNone=${media('(hover: none)')} | standalone=${media('(display-mode: standalone)')}`);
  lines.push(`- Browser: ${ua.slice(0, 220) || '-'}`);
  var warnings = [];
  if (isQuest && innerW < 900) warnings.push('Quest meldet nur phone/tablet-artige CSS-Breite; Meta-Fenster wirkt vermutlich niedriger aufgeloest.');
  if (isQuest && dpr <= 1.15) warnings.push('Quest DPR ist nahe 1; es gibt wenig physische Pixel pro CSS-Pixel.');
  if (Number.isFinite(appScale) && appScale !== 100) warnings.push('Seitengroesse ist nicht 100%; CSS-Zoom kann vorhandene Pixel-Unschaerfe sichtbar verstaerken.');
  if (vv && Number.isFinite(Number(vv.scale)) && Math.abs(Number(vv.scale) - 1) > 0.02) warnings.push('VisualViewport ist skaliert; Browser/Page-Zoom ist aktiv.');
  if (warnings.length) {
    lines.push('- Hinweise:');
    warnings.forEach(w => lines.push(`  * ${w}`));
  } else {
    lines.push('- Hinweise: keine offensichtliche App-seitige Zusatzskalierung erkannt.');
  }
  lines.push('- Grenze: Eine Website kann das Meta-2D-Fenster groesser oder kleiner layouten, aber nicht erzwingen, dass Horizon OS mehr Pixel fuer dieses Fenster alloziert.');
  return lines;
}
window.vpBuildDisplayDiagnosticsReport = function () {
  return vpBuildDisplayDiagnosticsLines().join('\n');
};
window.vpBuildWeatherDebugReport = function () {
  var _missionSnap, _missionSnap2, _missionSnap3, _missionSnap4, _missionSnap5, _sceneDbg$lastTargetS, _window$missionAptArr, _window$missionTarget, _window$missionSceneS, _ref25, _sceneDbg$sceneAccept, _missionSnap6, _missionSnap7, _cargoManifest, _runtimeSnapshot$runt, _runtimeSnapshot$runt2, _runtimeSnapshot$runt3, _window$GAMissionCont, _window$missionSceneS2, _window$missionSceneS3, _window$missionSceneS4, _window$missionSceneS5, _window$missionSceneS6, _window$missionSceneS7, _window$missionSceneS8, _window$missionSceneS9, _window$missionSceneS0, _window$missionSceneS1, _window$missionSceneS10, _window$missionSceneS11, _window$missionSceneS12, _window$missionSceneS13, _window$missionSceneS14, _window$missionSceneS15, _window$missionSceneS16;
  vpHydrateObsTileCoverage();
  vpHydrateObsTileFailed();
  var dbg = window.vpWeatherDebug || {};
  var cacheTotal = vpOpenMeteoPointCache ? vpOpenMeteoPointCache.size : 0;
  var hit = Number(dbg.openMeteoCacheHits || 0);
  var miss = Number(dbg.openMeteoCacheMisses || 0);
  var hitRate = hit + miss > 0 ? (hit / (hit + miss) * 100).toFixed(1) : '0.0';
  var approxCalls = Number(dbg.openMeteoNetworkRequests || 0);
  var lines = [];
  var redactDebugSecrets = function redactDebugSecrets() {
    var value = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    return String(value || '').replace(/([?&](?:key|api_key|apikey|token|access_token|auth|authorization)=)[^&\s"']+/ig, '$1[redacted]').replace(/(AIza[0-9A-Za-z_-]{20,})/g, '[redacted-google-api-key]');
  };
  var flattenText = function flattenText(value) {
    var maxLen = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 260;
    return redactDebugSecrets(String(value || '').replace(/\s+/g, ' ').trim()).slice(0, maxLen);
  };
  var collectConsoleLogs = () => {
    if (typeof window.gaGetDebugLogs !== 'function') return [];
    try {
      var logs = window.gaGetDebugLogs();
      return Array.isArray(logs) ? logs : [];
    } catch (_) {
      return [];
    }
  };
  var isImportantConsoleLog = entry => {
    var level = String((entry === null || entry === void 0 ? void 0 : entry.level) || '').toLowerCase();
    var msg = String((entry === null || entry === void 0 ? void 0 : entry.msg) || '');
    return /error|warn|rejection|exception|failed|fail|invalid|fallback|mission|scene|dispatch|planner|gemini|target|ack|paxvoice|tts|textgen|fetch|gps|websocket/i.test(`${level} ${msg}`);
  };
  var isPriorityMissionConsoleLog = entry => {
    var level = String((entry === null || entry === void 0 ? void 0 : entry.level) || '').toLowerCase();
    var msg = String((entry === null || entry === void 0 ? void 0 : entry.msg) || '');
    var hay = `${level} ${msg}`;
    return /paxvoice|tts|textgen|\[fetch\]|fetch-(slow|error)|generativelanguage|websocketrelais|gps/.test(hay.toLowerCase());
  };
  lines.push.apply(lines, _toConsumableArray(vpBuildDisplayDiagnosticsLines()));
  lines.push('');
  lines.push(`Session seit: ${vpFormatDebugTs(dbg.sessionStartedAt)}`);
  var fbMode = String(window.vpWeatherFallbackMode || 'none');
  var fbLabel = fbMode === 'openmeteo_to_metar' ? ' (Fallback METAR aktiv)' : fbMode === 'metar_to_openmeteo' ? ' (Fallback OPEN-METEO aktiv)' : '';
  lines.push(`Quelle aktiv: ${(window.vpWeatherSource || 'metar').toUpperCase()}${fbLabel}`);
  lines.push(`Terrain Quelle: ${(window.vpTerrainElevationSource || 'terrarium').toUpperCase()}${window.vpElevationFallbackActive ? ' (Fallback aktiv)' : ''}`);
  lines.push(`Refresh Intervall: 30 min`);
  if (typeof window.gaPerfBaselineSummaryText === 'function') {
    lines.push('');
    try {
      lines.push(window.gaPerfBaselineSummaryText());
    } catch (err) {
      lines.push(`Performance Baseline: Debug-Fehler (${(err === null || err === void 0 ? void 0 : err.message) || err})`);
    }
  }
  if (typeof window.missionFollowupBuildDebugReport === 'function') {
    lines.push('');
    try {
      lines.push(window.missionFollowupBuildDebugReport());
    } catch (err) {
      lines.push(`Follow-up Requests: Debug-Fehler (${(err === null || err === void 0 ? void 0 : err.message) || err})`);
    }
  }
  lines.push('');
  lines.push.apply(lines, _toConsumableArray(vpBuildStorageDiagnosticsLines()));
  lines.push('');
  lines.push('Wetter / Open-Meteo kurz');
  lines.push(`- Requests: OM ${approxCalls}, Elevation ${dbg.elevationNetworkRequests || 0}, Batches ${dbg.openMeteoBatchCalls || 0}/${dbg.openMeteoBatchPoints || 0} Punkte`);
  lines.push(`- Cache: Hit/Miss ${hit}/${miss} (${hitRate}%), RAM ${cacheTotal}/${VP_OM_CACHE_MAX_ENTRIES}, HDG ${vpHdgWeatherChunkCache.size}/${VP_HDG_WEATHER_CHUNK_CACHE_MAX}, METAR ${vpMetarChunkCache.size}/${VP_METAR_CHUNK_CACHE_MAX}`);
  lines.push(`- 429/Cooldown: OM ${dbg.openMeteo429Count || 0}${window.vpIsOpenMeteoDailyLimited && window.vpIsOpenMeteoDailyLimited() ? ` Tageslimit bis ${vpFormatDebugTs(Number(window.vpOpenMeteoDailyLimitUntil || 0))}` : ''}, Elevation ${dbg.elevation429Count || 0}, OM cooldown ${vpIsOpenMeteoCoolingDown() ? 'ja' : 'nein'}, METAR cooldown ${vpIsMetarCoolingDown() ? 'ja' : 'nein'}`);
  lines.push(`- Fallback: Modus ${fbMode}, zu METAR ${dbg.fallbackToMetarCount || 0}, zu OPEN-METEO ${dbg.fallbackToOpenMeteoCount || 0}, letzter ${vpFormatDebugTs(dbg.fallbackLastAt)}${dbg.fallbackLastReason ? ` (${dbg.fallbackLastReason})` : ''}`);
  lines.push(`- Letzter Wetterfehler: ${vpFormatDebugTs(dbg.lastErrorAt)}${dbg.lastErrorMsg ? ` (${dbg.lastErrorMsg})` : ''} | Erfolg ${vpFormatDebugTs(dbg.lastSuccessAt)}`);
  lines.push('');
  lines.push('OSM / Overpass kurz');
  var poiDbg = window.gaPoiTileDebug && typeof window.gaPoiTileDebug === 'object' ? window.gaPoiTileDebug : {};
  if (typeof window.gaGetAviationDataStatus === 'function') {
    try {
      var aviationStatus = window.gaGetAviationDataStatus();
      var hosted = (aviationStatus === null || aviationStatus === void 0 ? void 0 : aviationStatus.hosted) || {};
      var aviationOverlay = (aviationStatus === null || aviationStatus === void 0 ? void 0 : aviationStatus.overlay) || {};
      var formatDeg = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value).toFixed(2) : '-';
      lines.push(`- Aviation Data: Modus ${String((aviationStatus === null || aviationStatus === void 0 ? void 0 : aviationStatus.mode) || 'unbekannt')}` + ` | aktiv ${String((aviationStatus === null || aviationStatus === void 0 ? void 0 : aviationStatus.activeSource) || 'none')}` + ` | Dataset ${String((hosted === null || hosted === void 0 ? void 0 : hosted.datasetVersion) || '-')}` + ` | Packs Netz/Cache ${Number(hosted === null || hosted === void 0 ? void 0 : hosted.packRequests) || 0}/${Number(hosted === null || hosted === void 0 ? void 0 : hosted.packCacheHits) || 0}` + ` | RAM ${Number(hosted === null || hosted === void 0 ? void 0 : hosted.packCacheEntries) || 0} (${((Number(hosted === null || hosted === void 0 ? void 0 : hosted.packCacheBytes) || 0) / (1024 * 1024)).toFixed(1)} MB)`);
      lines.push(`- Aviation Fallback: zu V2 ${Number(hosted === null || hosted === void 0 ? void 0 : hosted.fallbackCount) || 0}` + ` | letzter ${vpFormatDebugTs(hosted === null || hosted === void 0 ? void 0 : hosted.lastFallbackAt)}` + `${hosted !== null && hosted !== void 0 && hosted.lastFallbackReason ? ` (${hosted.lastFallbackReason})` : ''}` + ` | Hosted Fehler ${(hosted === null || hosted === void 0 ? void 0 : hosted.lastError) || '-'}` + ` | Hosted Erfolg ${vpFormatDebugTs(hosted === null || hosted === void 0 ? void 0 : hosted.lastSuccessAt)}`);
      lines.push(`- Aviation Overlay: ${aviationOverlay !== null && aviationOverlay !== void 0 && aviationOverlay.enabled ? 'An' : 'Aus'}` + ` | Zoom ${Number.isFinite(Number(aviationOverlay === null || aviationOverlay === void 0 ? void 0 : aviationOverlay.zoom)) ? Number(aviationOverlay.zoom) : '-'}` + ` (min ${Number(aviationOverlay === null || aviationOverlay === void 0 ? void 0 : aviationOverlay.minZoom) || '-'})` + ` | View ${formatDeg(aviationOverlay === null || aviationOverlay === void 0 ? void 0 : aviationOverlay.viewWidthDeg)}°×${formatDeg(aviationOverlay === null || aviationOverlay === void 0 ? void 0 : aviationOverlay.viewHeightDeg)}°` + ` | Coverage ${formatDeg(aviationOverlay === null || aviationOverlay === void 0 ? void 0 : aviationOverlay.coverageWidthDeg)}°×${formatDeg(aviationOverlay === null || aviationOverlay === void 0 ? void 0 : aviationOverlay.coverageHeightDeg)}°` + ` | Airspaces Payload/Layer ${Number(aviationOverlay === null || aviationOverlay === void 0 ? void 0 : aviationOverlay.payloadAirspaces) || 0}/${Number(aviationOverlay === null || aviationOverlay === void 0 ? void 0 : aviationOverlay.renderedAirspaceLayers) || 0}`);
    } catch (_) {}
  }
  if (typeof window.gaGetOpenAipStaticNavaidStatus === 'function') {
    try {
      var navStatus = window.gaGetOpenAipStaticNavaidStatus();
      var generatedAt = Date.parse((navStatus === null || navStatus === void 0 ? void 0 : navStatus.generatedAt) || '');
      lines.push(`- OpenAIP Navaid-Fallback: ${navStatus !== null && navStatus !== void 0 && navStatus.loaded ? 'geladen' : 'nicht geladen'}` + ` | ${Number(navStatus === null || navStatus === void 0 ? void 0 : navStatus.count) || 0} Einträge` + ` | Datensatz ${Number.isFinite(generatedAt) ? vpFormatDebugTs(generatedAt) : '-'}` + ` | aktiv ${String((navStatus === null || navStatus === void 0 ? void 0 : navStatus.activeSource) || 'none')} (${Number(navStatus === null || navStatus === void 0 ? void 0 : navStatus.activeCount) || 0})` + `${navStatus !== null && navStatus !== void 0 && navStatus.lastError ? ` | Fehler ${navStatus.lastError}` : ''}`);
    } catch (_) {}
  }
  if (typeof window.gaGetOpenAipStaticReportingPointStatus === 'function') {
    try {
      var rppStatus = window.gaGetOpenAipStaticReportingPointStatus();
      var _generatedAt = Date.parse((rppStatus === null || rppStatus === void 0 ? void 0 : rppStatus.generatedAt) || '');
      lines.push(`- OpenAIP VRP-Fallback: ${rppStatus !== null && rppStatus !== void 0 && rppStatus.loaded ? 'geladen' : 'nicht geladen'}` + ` | ${Number(rppStatus === null || rppStatus === void 0 ? void 0 : rppStatus.count) || 0} Einträge` + ` | Datensatz ${Number.isFinite(_generatedAt) ? vpFormatDebugTs(_generatedAt) : '-'}` + ` | aktiv ${String((rppStatus === null || rppStatus === void 0 ? void 0 : rppStatus.activeSource) || 'none')} (${Number(rppStatus === null || rppStatus === void 0 ? void 0 : rppStatus.activeCount) || 0})` + `${rppStatus !== null && rppStatus !== void 0 && rppStatus.lastError ? ` | Fehler ${rppStatus.lastError}` : ''}`);
    } catch (_) {}
  }
  if (typeof window.getOpenTopoTileStatus === 'function') {
    try {
      var topoStatus = window.getOpenTopoTileStatus();
      lines.push(`- OpenTopoMap Tiles: Primary ok/Fehler/Timeout ${Number(topoStatus === null || topoStatus === void 0 ? void 0 : topoStatus.primaryLoaded) || 0}/${Number(topoStatus === null || topoStatus === void 0 ? void 0 : topoStatus.primaryErrors) || 0}/${Number(topoStatus === null || topoStatus === void 0 ? void 0 : topoStatus.primaryTimeouts) || 0}` + ` | Backup Abruf/ok/Fehler ${Number(topoStatus === null || topoStatus === void 0 ? void 0 : topoStatus.fallbackRequests) || 0}/${Number(topoStatus === null || topoStatus === void 0 ? void 0 : topoStatus.fallbackLoaded) || 0}/${Number(topoStatus === null || topoStatus === void 0 ? void 0 : topoStatus.fallbackErrors) || 0}`);
    } catch (_) {}
  }
  lines.push(`- Overpass Requests: ${dbg.overpassRequests || 0}, 429/504 ${dbg.overpass429Count || 0}/${dbg.overpass504Count || 0}, Cooldown-Skips ${dbg.overpassCooldownSkips || 0}, Inflight-Joins ${dbg.overpassInFlightJoins || 0}`);
  lines.push(`- Hosted Tiles Req/Hit/Miss/Err: ${dbg.hostedTileRequests || 0}/${dbg.hostedTileHits || 0}/${dbg.hostedTileMisses || 0}/${dbg.hostedTileErrors || 0} | CORE split/legacy ${dbg.hostedTileCoreHits || 0}/${dbg.hostedTileLegacyHits || 0}`);
  lines.push(`- POI Tiles Req/Hit/Miss/Err: ${poiDbg.requests || 0}/${poiDbg.hits || 0}/${poiDbg.misses || 0}/${poiDbg.errors || 0} | split/legacy ${poiDbg.splitHits || 0}/${poiDbg.legacyHits || 0} | fallback ${poiDbg.fallbackHits || 0}${poiDbg.lastSource ? ` last=${poiDbg.lastSource}` : ''}`);
  lines.push(`- Tile Cache: coverage ${vpObsTileCoverage.size}, failed ${vpObsTileFailed.size}, POI RAM ${poiDbg.cacheEntries || 0}, route-guard skips ${dbg.overpassRouteThrottleSkips || 0}`);
  if (vpObsTileFailed.size > 0) {
    var sample = Array.from(vpObsTileFailed.entries()).sort((a, b) => Number(b[1] && b[1].ts || 0) - Number(a[1] && a[1].ts || 0)).slice(0, 6).map(_ref17 => {
      var _ref18 = _slicedToArray(_ref17, 2),
        k = _ref18[0],
        v = _ref18[1];
      return `${k}${v && v.status ? `:${v.status}` : ''}`;
    }).join(', ');
    lines.push(`- Failed Sample: ${sample}`);
  }
  lines.push(`- Tile-Cache Hit/Miss: ${dbg.overpassTileCoverageHits || 0}/${dbg.overpassTileCoverageMisses || 0}`);
  lines.push(`- Deferred Tiles: ${dbg.overpassLastDeferredCount || 0} (Runs: ${dbg.overpassDeferredRuns || 0}, Summe: ${dbg.overpassDeferredTilesTotal || 0})`);
  lines.push(`- Letzter Tile-Miss: ${dbg.overpassTileLastMissingCount || 0}${dbg.overpassTileLastMissingSample ? ` (${dbg.overpassTileLastMissingSample})` : ''}`);
  lines.push(`- Tiles Overlay (Karte): ${window.vpObsTileOverlayEnabled ? 'An' : 'Aus'}`);
  var srcCounter = {};
  var _iterator31 = _createForOfIteratorHelper(vpObsTileCoverage.values()),
    _step31;
  try {
    for (_iterator31.s(); !(_step31 = _iterator31.n()).done;) {
      var meta = _step31.value;
      var src = String(meta && meta.src || 'unknown');
      srcCounter[src] = (srcCounter[src] || 0) + 1;
    }
  } catch (err) {
    _iterator31.e(err);
  } finally {
    _iterator31.f();
  }
  var srcSummary = Object.keys(srcCounter).sort((a, b) => srcCounter[b] - srcCounter[a]).slice(0, 4).map(k => `${k}:${srcCounter[k]}`).join(' | ');
  lines.push(`- Tile-Quellen: ${srcSummary || '-'}`);
  var overpassCdRem = Math.ceil(vpGetOverpassCooldownRemainingMs() / 1000);
  lines.push(`- Overpass Cooldown aktiv: ${vpIsOverpassCoolingDown() ? `Ja (${overpassCdRem}s)` : 'Nein'}`);
  var rollingPoolBytes = vpApproxStorageBytes(VP_OBS_POOL_STORAGE_KEY);
  var rollingTileBytes = vpApproxStorageBytes(VP_OBS_TILE_COVERAGE_KEY);
  var rollingFailBytes = vpApproxStorageBytes(VP_OBS_TILE_FAILED_KEY);
  var rollingComboBytes = vpApproxStorageBytesByPrefix(VP_OBS_COMBO_PREFIX);
  var rollingComboCount = vpListObsComboKeys().length;
  var rollingTotalBytes = rollingPoolBytes + rollingTileBytes + rollingFailBytes;
  lines.push(`- Rolling Cache Größe: ${vpFormatBytes(rollingTotalBytes)} (Pool ${vpFormatBytes(rollingPoolBytes)}, Tiles ${vpFormatBytes(rollingTileBytes)}, Failed ${vpFormatBytes(rollingFailBytes)})`);
  lines.push(`- Route-Cache (ga_obs_combo_*): ${rollingComboCount} Einträge, ${vpFormatBytes(rollingComboBytes)}`);
  lines.push('');
  lines.push('Allgemeine App-Fehler');
  lines.push(`- Global Errors: ${dbg.globalErrors || 0}`);
  lines.push(`- Global Warnings: ${dbg.globalWarnings || 0}`);
  lines.push(`- Unhandled Rejections: ${dbg.unhandledRejections || 0}`);
  lines.push(`- Letzter globaler Fehler: ${vpFormatDebugTs(dbg.lastGlobalErrorAt)}${dbg.lastGlobalErrorMsg ? ` (${dbg.lastGlobalErrorMsg})` : ''}`);
  lines.push('');
  lines.push('Mission Snapshot');
  var missionSnap = window.vpMissionDebugSnapshot || null;
  if (!missionSnap) {
    try {
      missionSnap = JSON.parse(localStorage.getItem('ga_mission_debug_snapshot') || 'null');
    } catch (_) {
      missionSnap = null;
    }
  }
  if (!missionSnap) {
    lines.push('- (keine aktive Mission oder noch kein Snapshot)');
  } else {
    var _missionSnap$contract, _missionSnap$contract2, _window$isMissionPipe, _window, _missionSnap$contract3, _missionSnap$contract4, _missionSnap$contract5, _missionSnap$contract6, _missionSnap$contract7, _missionSnap$contract8, _missionSnap$targetSc, _missionSnap$contract9;
    var p = missionSnap.passenger || {};
    lines.push(`- Zeit: ${vpFormatDebugTs(missionSnap.ts)}`);
    lines.push(`- Modus/Kategorie: ${missionSnap.mode || '?'} / ${missionSnap.category || '?'}`);
    if (missionSnap.requestedCategory) lines.push(`- Gewählt: ${missionSnap.requestedCategory}`);
    lines.push(`- Mission: ${missionSnap.mission || 'n/a'}`);
    lines.push(`- Ziel: ${missionSnap.target || 'n/a'}`);
    if (missionSnap.targetCoords) lines.push(`- Ziel-Koordinaten: ${missionSnap.targetCoords}`);
    var truth = missionSnap.missionTruth || ((_missionSnap$contract = missionSnap.contract) === null || _missionSnap$contract === void 0 ? void 0 : _missionSnap$contract.missionTruth) || null;
    if (truth !== null && truth !== void 0 && truth.mainTarget) {
      var mt = truth.mainTarget;
      var mtPos = Number.isFinite(Number(mt.lat)) && Number.isFinite(Number(mt.lon)) ? `${Number(mt.lat).toFixed(5)}, ${Number(mt.lon).toFixed(5)}` : '-';
      lines.push(`- Main Target: ${mt.name || '-'} | ${mt.kind || '-'} | ${mtPos} | Δ=${Number.isFinite(Number(mt.distanceFromPoiM)) ? Math.round(Number(mt.distanceFromPoiM)) : 0}m`);
    }
    if (truth !== null && truth !== void 0 && truth.sceneAnchor) {
      var sa = truth.sceneAnchor;
      var saPos = Number.isFinite(Number(sa.lat)) && Number.isFinite(Number(sa.lon)) ? `${Number(sa.lat).toFixed(5)}, ${Number(sa.lon).toFixed(5)}` : '-';
      var cues = Array.isArray(truth.visibleCues) && truth.visibleCues.length ? ` | cues=${truth.visibleCues.join(', ')}` : '';
      lines.push(`- Scene Anchor: ${sa.kind || '-'} | ${saPos} | reason=${sa.reason || '-'}${cues}`);
    }
    var aptArrival = missionSnap.aptArrivalPlan || ((_missionSnap$contract2 = missionSnap.contract) === null || _missionSnap$contract2 === void 0 ? void 0 : _missionSnap$contract2.aptArrivalPlan) || (truth === null || truth === void 0 ? void 0 : truth.arrivalScene) || null;
    if (aptArrival) {
      var pos = Number.isFinite(Number(aptArrival.lat)) && Number.isFinite(Number(aptArrival.lon)) ? `${Number(aptArrival.lat).toFixed(5)}, ${Number(aptArrival.lon).toFixed(5)}` : '-';
      var conf = Number.isFinite(Number(aptArrival.confidence)) ? Number(aptArrival.confidence).toFixed(2) : '-';
      var itemCount = Array.isArray(aptArrival.items) ? aptArrival.items.length : 0;
      lines.push(`- APT Arrival Plan: ${aptArrival.roleLabel || aptArrival.role || '-'} | ${aptArrival.anchorType || '-'} | ${pos} | source=${aptArrival.source || '-'} | conf=${conf} | items=${itemCount}`);
      if (aptArrival.expectedBy || aptArrival.visibleCue) {
        lines.push(`- APT Erwartung: ${aptArrival.expectedBy || '-'} | cue=${aptArrival.visibleCue || '-'}`);
      }
    }
    lines.push(`- Quelle: ${missionSnap.source || 'n/a'}`);
    var aiUsage = missionSnap.aiUsage && typeof missionSnap.aiUsage === 'object' ? missionSnap.aiUsage : null;
    if (aiUsage && Number.isFinite(Number(aiUsage.calls)) && Number(aiUsage.calls) > 0) {
      var promptTokens = Number(aiUsage.promptTokens || 0);
      var completionTokens = Number(aiUsage.completionTokens || 0);
      var totalTokens = Number(aiUsage.totalTokens || 0);
      var tokenBits = [`calls=${Number(aiUsage.calls)}`, Number(aiUsage.openaiTextCalls || 0) ? `openai=${Number(aiUsage.openaiTextCalls)}` : '', totalTokens ? `tokens=${totalTokens}` : '', promptTokens || completionTokens ? `in/out=${promptTokens}/${completionTokens}` : '', Number(aiUsage.cachedTokens || 0) ? `cached=${Number(aiUsage.cachedTokens)}` : '', Number(aiUsage.reasoningTokens || 0) ? `reasoning=${Number(aiUsage.reasoningTokens)}` : ''].filter(Boolean);
      lines.push(`- AI Usage: ${tokenBits.join(' | ')} | Kosten: Tokenbasis, kein Rechnungsbetrag in API-Antwort`);
      var modelBits = Object.entries(aiUsage.models || {}).map(_ref19 => {
        var _ref20 = _slicedToArray(_ref19, 2),
          model = _ref20[0],
          count = _ref20[1];
        return `${flattenText(model, 36)}×${count}`;
      }).slice(0, 6);
      if (modelBits.length) lines.push(`- AI Usage Modelle: ${modelBits.join(' | ')}`);
      var eventBits = (Array.isArray(aiUsage.events) ? aiUsage.events : []).slice(0, 6).map(event => {
        var usage = (event === null || event === void 0 ? void 0 : event.usage) || {};
        var total = Number(usage.totalTokens || 0);
        var status = event !== null && event !== void 0 && event.status && event.status !== 'ok' ? `/${event.status}` : '';
        return `${flattenText((event === null || event === void 0 ? void 0 : event.promptVersion) || '-', 28)}:${flattenText((event === null || event === void 0 ? void 0 : event.model) || '-', 24)}${status}${total ? ` ${total}t` : ''}`;
      });
      if (eventBits.length) lines.push(`- AI Usage Calls: ${eventBits.join(' | ')}`);
    }
    if (missionSnap.poiSource) lines.push(`- POI-Fundquelle: ${missionSnap.poiSource}`);
    if (missionSnap.poiLookup && typeof missionSnap.poiLookup === 'object') {
      var lk = missionSnap.poiLookup;
      var srcBits = [];
      if (lk.engine) srcBits.push(String(lk.engine));
      if (lk.lastSource) srcBits.push(`last=${String(lk.lastSource)}`);
      if (typeof lk.includeCore === 'boolean') srcBits.push(`core=${lk.includeCore ? 'on' : 'off'}`);
      if (Number.isFinite(Number(lk.tileKeys))) srcBits.push(`tiles=${Number(lk.tileKeys)}`);
      if (Number.isFinite(Number(lk.features))) srcBits.push(`features=${Number(lk.features)}`);
      if (Number.isFinite(Number(lk.candidates))) srcBits.push(`candidates=${Number(lk.candidates)}`);
      if (Number.isFinite(Number(lk.requestsDelta))) srcBits.push(`reqΔ=${Number(lk.requestsDelta)}`);
      if (Number.isFinite(Number(lk.splitHitsDelta))) srcBits.push(`splitΔ=${Number(lk.splitHitsDelta)}`);
      if (Number.isFinite(Number(lk.legacyHitsDelta))) srcBits.push(`legacyΔ=${Number(lk.legacyHitsDelta)}`);
      if (Number.isFinite(Number(lk.fallbackHitsDelta))) srcBits.push(`fallbackΔ=${Number(lk.fallbackHitsDelta)}`);
      if (Number.isFinite(Number(lk.errorsDelta))) srcBits.push(`errΔ=${Number(lk.errorsDelta)}`);
      if (lk.featureSourceKind) srcBits.push(`featSrc=${String(lk.featureSourceKind)}`);
      if (lk.featureLayer) srcBits.push(`featLayer=${String(lk.featureLayer)}`);
      lines.push(`- POI-Lookup: ${srcBits.join(' | ')}`);
    }
    lines.push(`- Picker-Profil: ${missionSnap.profile || 'auto'} | Aktiv: ${missionSnap.appliedProfile || 'auto'}`);
    var pipelineMode = String(missionSnap.missionPipelineMode || (window.getMissionPipelineMode ? window.getMissionPipelineMode() : (_window$isMissionPipe = (_window = window).isMissionPipelineV2Enabled) !== null && _window$isMissionPipe !== void 0 && _window$isMissionPipe.call(_window) ? 'v2' : 'v3')).toUpperCase();
    lines.push(`- Mission Pipeline: ${pipelineMode}`);
    var writerMode = String(missionSnap.missionWriterMode || (window.getMissionWriterMode ? window.getMissionWriterMode() : '') || '').toUpperCase();
    if (writerMode) lines.push(`- Mission Writer: ${writerMode}`);
    var poiChainDebug = window.gaPoiChainDebug && typeof window.gaPoiChainDebug === 'object' ? window.gaPoiChainDebug : {};
    var poiChainForce = typeof window.getPoiChainDebugForceValue === 'function' ? window.getPoiChainDebugForceValue() : '';
    var poiChainSpec = missionSnap.poiChain || ((_missionSnap$contract3 = missionSnap.contract) === null || _missionSnap$contract3 === void 0 ? void 0 : _missionSnap$contract3.poiChain) || null;
    if (poiChainForce || poiChainDebug.last || poiChainSpec) {
      var _poiChainSpec$points;
      var chainBits = [`Force=${poiChainForce || 'aus'}`];
      if (poiChainSpec !== null && poiChainSpec !== void 0 && poiChainSpec.label) chainBits.push(`Mission=${flattenText(poiChainSpec.label, 70)}`);
      if (Number.isFinite(Number(poiChainSpec === null || poiChainSpec === void 0 || (_poiChainSpec$points = poiChainSpec.points) === null || _poiChainSpec$points === void 0 ? void 0 : _poiChainSpec$points.length))) chainBits.push(`Punkte=${Number(poiChainSpec.points.length)}`);
      var last = poiChainDebug.last || null;
      if (last && typeof last === 'object') {
        if (last.ok) {
          chainBits.push(`last=ok`);
          if (last.theme) chainBits.push(`theme=${String(last.theme)}`);
          if (Number.isFinite(Number(last.points))) chainBits.push(`found=${Number(last.points)}`);
        } else {
          chainBits.push(`last=${last.status || 'no_chain'}`);
          if (last.forced) chainBits.push('forced=yes');
        }
        if (Number.isFinite(Number(last.tileKeys))) chainBits.push(`tiles=${Number(last.tileKeys)}`);
        if (Number.isFinite(Number(last.features))) chainBits.push(`features=${Number(last.features)}`);
        if (Number.isFinite(Number(last.fetchMs))) chainBits.push(`fetch=${Math.round(Number(last.fetchMs))}ms`);
        if (Number.isFinite(Number(last.buildMs))) chainBits.push(`build=${Math.round(Number(last.buildMs))}ms`);
        if (Number.isFinite(Number(last.totalMs))) chainBits.push(`total=${Math.round(Number(last.totalMs))}ms`);
      }
      lines.push(`- POI-Ketten-Debug: ${chainBits.join(' | ')}`);
      var chainDetail = missionSnap.poiChainDebug || null;
      if (chainDetail && typeof chainDetail === 'object') {
        var guide = chainDetail.guide || {};
        var overlay = chainDetail.overlay || {};
        var trace = overlay.trace || {};
        var route = chainDetail.routeWaypoints || {};
        var guideBits = [];
        if (guide.name) guideBits.push(`guide=${flattenText(guide.name, 70)}`);
        if (guide.groupKey) guideBits.push(`group=${flattenText(guide.groupKey, 80)}`);
        if (Number.isFinite(Number(guide.guidePointCount))) guideBits.push(`guidePts=${Number(guide.guidePointCount)}`);
        if (Number.isFinite(Number(trace.count))) guideBits.push(`tracePts=${Number(trace.count)}`);
        if (Number.isFinite(Number(overlay.widthNm))) guideBits.push(`width=${Number(overlay.widthNm)}NM`);
        if (Number.isFinite(Number(route.count))) guideBits.push(`routeWpt=${Number(route.count)}`);
        if (guideBits.length) lines.push(`- POI-Ketten-Geometrie: ${guideBits.join(' | ')}`);
        var pointSummary = Array.isArray(chainDetail.points) ? chainDetail.points.slice(0, 8).map(point => {
          var order = Number.isFinite(Number(point.orderT)) ? `t=${Number(point.orderT)}` : 't=-';
          var xtrk = Number.isFinite(Number(point.distCorridorNm)) ? `x=${Number(point.distCorridorNm)}NM` : 'x=-';
          var prev = Number.isFinite(Number(point.distanceFromPrevNm)) ? `prev=${Number(point.distanceFromPrevNm)}NM` : 'prev=-';
          var pos = Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)) ? `${Number(point.lat).toFixed(5)},${Number(point.lon).toFixed(5)}` : '-';
          return `${Number(point.index || 0) + 1}:${flattenText(point.name || '-', 36)}[${order},${xtrk},${prev}]@${pos}`;
        }).join(' | ') : '';
        if (pointSummary) lines.push(`- POI-Ketten-Punkte: ${pointSummary}`);
        if (Array.isArray(trace.first) && trace.first.length) {
          var firstTrace = trace.first.map(point => `${Number(point.lat).toFixed(5)},${Number(point.lon).toFixed(5)}`).join(' > ');
          var lastTrace = Array.isArray(trace.last) && trace.last.length ? trace.last.map(point => `${Number(point.lat).toFixed(5)},${Number(point.lon).toFixed(5)}`).join(' > ') : '';
          lines.push(`- POI-Ketten-Trace: start ${firstTrace}${lastTrace ? ` | ende ${lastTrace}` : ''}`);
        }
      }
    }
    var planV2 = missionSnap.missionPlanV2 || ((_missionSnap$contract4 = missionSnap.contract) === null || _missionSnap$contract4 === void 0 ? void 0 : _missionSnap$contract4.missionPlanV2) || (missionSnap.restored ? null : window.gaMissionPipelineV2Last) || null;
    if (planV2 && typeof planV2 === 'object') {
      var _planV2$debug, _planV2$debug2, _planV2$debug3, _planV2$debug4;
      var p2 = planV2.plan || {};
      var needTypes = Array.isArray(planV2.needs) ? planV2.needs.map(n => n.type || '?').join(',') : '-';
      var resolvedTypes = planV2.resolvedNeeds && typeof planV2.resolvedNeeds === 'object' ? Object.keys(planV2.resolvedNeeds).join(',') : '-';
      var planVersion = String(planV2.pipelineVersion || '');
      var planLabel = planVersion.includes('mission-v4') ? 'Pipeline V4 Plan' : planVersion.includes('mission-v3') ? 'Pipeline V3' : pipelineMode === 'V4' && (_planV2$debug = planV2.debug) !== null && _planV2$debug !== void 0 && _planV2$debug.v4DirectFallback ? 'Pipeline V2 Fallback-Plan' : 'Pipeline V2';
      lines.push(`- ${planLabel} Status: ${planV2.status || '-'} | needs=${needTypes || '-'} | resolved=${resolvedTypes || '-'}`);
      if ((_planV2$debug2 = planV2.debug) !== null && _planV2$debug2 !== void 0 && _planV2$debug2.v4DirectFallback) {
        var directBits = [`direct=${planV2.debug.v4DirectStatus || 'unknown'}`, planV2.debug.v4DirectParseMode ? `parse=${planV2.debug.v4DirectParseMode}` : '', planV2.debug.v4DirectSource ? `source=${planV2.debug.v4DirectSource}` : '', planV2.debug.v4DirectError ? `error=${flattenText(planV2.debug.v4DirectError, 180)}` : ''].filter(Boolean);
        lines.push(`- V4 Planner Fallback: ${directBits.join(' | ')}`);
      }
      if (p2.primaryObjective) lines.push(`- ${planLabel} Plan: ${p2.taskDomain || '-'} | ${p2.sceneKind || '-'} | ${String(p2.primaryObjective).replace(/\s+/g, ' ').slice(0, 180)}`);
      if (Array.isArray(p2.objectFamilies) && p2.objectFamilies.length) lines.push(`- ${planLabel} Objekte: ${p2.objectFamilies.slice(0, 8).join(', ')}`);
      if (p2.placementPolicy) lines.push(`- ${planLabel} Platzierung: ${flattenText(p2.placementPolicy, 220)}`);
      if (Array.isArray(p2.localFacts) && p2.localFacts.length) lines.push(`- ${planLabel} Fakten: ${p2.localFacts.slice(0, 4).join(' | ')}`);
      if (Array.isArray(p2.weatherHooks) && p2.weatherHooks.length) lines.push(`- ${planLabel} Wetter: ${p2.weatherHooks.slice(0, 3).join(' | ')}`);
      if (Array.isArray(p2.mustMention) && p2.mustMention.length) lines.push(`- ${planLabel} Muss nennen: ${p2.mustMention.slice(0, 5).join(' | ')}`);
      if (Array.isArray(p2.mustAvoid) && p2.mustAvoid.length) lines.push(`- ${planLabel} Vermeiden: ${p2.mustAvoid.slice(0, 5).join(' | ')}`);
      if (p2.realismBrief) lines.push(`- ${planLabel} Realismus: ${String(p2.realismBrief).replace(/\s+/g, ' ').slice(0, 180)}`);
      if (Array.isArray((_planV2$debug3 = planV2.debug) === null || _planV2$debug3 === void 0 ? void 0 : _planV2$debug3.toolCalls) && planV2.debug.toolCalls.length) lines.push(`- ${planLabel} Tools: ${planV2.debug.toolCalls.map(c => c.name || '?').slice(0, 6).join(', ')}`);
      if ((_planV2$debug4 = planV2.debug) !== null && _planV2$debug4 !== void 0 && _planV2$debug4.fallbackError) lines.push(`- ${planLabel} Fallback-Fehler: ${flattenText(planV2.debug.fallbackError, 220)}`);
    }
    if ((_missionSnap$contract5 = missionSnap.contract) !== null && _missionSnap$contract5 !== void 0 && _missionSnap$contract5.summary) lines.push(`- Contract: ${missionSnap.contract.summary}`);
    lines.push(`- PAX/Cargo: ${missionSnap.paxText || 'n/a'} | ${missionSnap.cargoText || 'n/a'}`);
    lines.push(`- Passenger: ${p.name || '?'} (${p.role || '?'}) | gender=${p.gender || 'n/a'}`);
    lines.push(`- Role/Task: ${p.roleProfile || 'general_passenger_v1'} | ${p.taskDomain || 'general'}`);
    lines.push(`- Toleranzen: g=${p.gTolerance || 'mittel'} | bank=${p.bankTolerance || 'mittel'}`);
    lines.push(`- Sensitivität: cargo=${p.cargoSensitivity || 'mittel'} | magen=${p.stomachSensitivity || 'mittel'} | comfortPriority=${p.comfortPriority || 'mittel'} | urgency=${p.urgencyPriority || 'mittel'}`);
    lines.push(`- POI-Parameter: alt=${Number(p.targetAltFt || 0)} ft | radius=${Number(p.targetRadiusNm || 0)} NM | dwell=${Number(p.targetDwellMin || 0)} min`);
    if (missionSnap.story) lines.push(`- Story: ${String(missionSnap.story).replace(/\s+/g, ' ').trim()}`);
    if (missionSnap.storyDebug && typeof missionSnap.storyDebug === 'object') {
      var sd = missionSnap.storyDebug;
      var storyBits = [];
      if (sd.source) storyBits.push(`source=${String(sd.source)}`);
      if (sd.writerMode) storyBits.push(`mode=${String(sd.writerMode).toUpperCase()}`);
      if (sd.stage) storyBits.push(`stage=${String(sd.stage)}`);
      if (Number.isFinite(Number(sd.rawStoryLength))) storyBits.push(`raw=${Number(sd.rawStoryLength)}`);
      if (Number.isFinite(Number(sd.writerLength))) storyBits.push(`writer=${Number(sd.writerLength)}`);
      if (Number.isFinite(Number(sd.preparedLength))) storyBits.push(`prepared=${Number(sd.preparedLength)}`);
      if (Number.isFinite(Number(sd.fallbackLength))) storyBits.push(`fallback=${Number(sd.fallbackLength)}`);
      if (typeof sd.storyChangedByFinalize === 'boolean') storyBits.push(`finalizeChanged=${sd.storyChangedByFinalize ? 'ja' : 'nein'}`);
      if (typeof sd.endpointNoteAdded === 'boolean') storyBits.push(`endpointNote=${sd.endpointNoteAdded ? 'ja' : 'nein'}`);
      if (typeof sd.passengerNoteAdded === 'boolean') storyBits.push(`paxNote=${sd.passengerNoteAdded ? 'ja' : 'nein'}`);
      if (typeof sd.writerComplete === 'boolean') storyBits.push(`complete=${sd.writerComplete ? 'ja' : 'nein'}`);
      if (typeof sd.writerUsable === 'boolean') storyBits.push(`usable=${sd.writerUsable ? 'ja' : 'nein'}`);
      if (typeof sd.writerAccepted === 'boolean') storyBits.push(`accepted=${sd.writerAccepted ? 'ja' : 'nein'}`);
      if (sd.fallbackReason) storyBits.push(`fallback=${String(sd.fallbackReason)}`);
      if (typeof sd.postSanitizerFallbackEver === 'boolean') storyBits.push(`postFallback=${sd.postSanitizerFallbackEver ? 'ja' : 'nein'}`);
      if (typeof sd.finalLooksEnumerative === 'boolean') storyBits.push(`enumerativ=${sd.finalLooksEnumerative ? 'ja' : 'nein'}`);
      if (Number.isFinite(Number(sd.finalSentenceCount))) storyBits.push(`sentences=${Number(sd.finalSentenceCount)}`);
      if (storyBits.length) lines.push(`- Story-Debug: ${storyBits.join(' | ')}`);
      if (sd.effectiveSource && sd.effectiveSource !== sd.source) {
        lines.push(`- Story effektive Quelle: ${flattenText(sd.effectiveSource, 320)}`);
      }
      var rawAiStory = String(sd.rawAiStory || sd.rawStoryPreview || '').replace(/\s+/g, ' ').trim();
      if (rawAiStory) {
        lines.push(`- Story KI-Rohtext: ${flattenText(rawAiStory, 2400)}`);
      }
      var writerStory = String(sd.writerStory || '').replace(/\s+/g, ' ').trim();
      if (writerStory && writerStory !== rawAiStory) {
        lines.push(`- Story nach Writer-Prüfung: ${flattenText(writerStory, 2400)}`);
      }
      var postSanitizerRuns = Array.isArray(sd.postSanitizerRuns) ? sd.postSanitizerRuns : sd.postSanitizer && typeof sd.postSanitizer === 'object' ? [sd.postSanitizer] : [];
      postSanitizerRuns.forEach((run, index) => {
        var fallbackReasons = Array.isArray(run === null || run === void 0 ? void 0 : run.fallbackReasons) ? run.fallbackReasons.filter(Boolean) : [];
        var stage = (run === null || run === void 0 ? void 0 : run.stage) || 'post_sanitizer';
        var runNo = Number.isFinite(Number(run === null || run === void 0 ? void 0 : run.run)) ? Number(run.run) : index + 1;
        var inputShape = `${Number((run === null || run === void 0 ? void 0 : run.inputLength) || 0)}/${Number((run === null || run === void 0 ? void 0 : run.inputSentenceCount) || 0)}`;
        var outputShape = `${Number((run === null || run === void 0 ? void 0 : run.outputLength) || 0)}/${Number((run === null || run === void 0 ? void 0 : run.outputSentenceCount) || 0)}`;
        var fallbackShape = run !== null && run !== void 0 && run.usedFallback ? ` | lokal=${Number((run === null || run === void 0 ? void 0 : run.fallbackLength) || 0)}/${Number((run === null || run === void 0 ? void 0 : run.fallbackSentenceCount) || 0)}` : '';
        lines.push(`- Story Post-Sanitizer #${runNo}: ${stage} | fallback=${run !== null && run !== void 0 && run.usedFallback ? 'ja' : 'nein'} | changed=${run !== null && run !== void 0 && run.storyChanged ? 'ja' : 'nein'} | in=${inputShape} -> out=${outputShape}${fallbackShape} | reason=${fallbackReasons.join(',') || '-'}`);
        var profileDecision = run !== null && run !== void 0 && run.profilePassengerDecision && typeof run.profilePassengerDecision === 'object' ? run.profilePassengerDecision : null;
        if (profileDecision) {
          var decisionReasons = Array.isArray(profileDecision.reasons) ? profileDecision.reasons.filter(Boolean) : [];
          lines.push(`  Profil-PAX-Prüfung: accepted=${profileDecision.accepted ? 'ja' : 'nein'} | reason=${decisionReasons.join(',') || '-'} | story/pax/cargo=${profileDecision.storyActivity || '-'}/${profileDecision.passengerActivity || '-'}/${profileDecision.cargoActivity || '-'}`);
        }
        var originalDecision = run !== null && run !== void 0 && run.originalPassengerDecision && typeof run.originalPassengerDecision === 'object' ? run.originalPassengerDecision : null;
        if (originalDecision) {
          var _decisionReasons = Array.isArray(originalDecision.reasons) ? originalDecision.reasons.filter(Boolean) : [];
          lines.push(`  Original-PAX-Prüfung: accepted=${originalDecision.accepted ? 'ja' : 'nein'} | reason=${_decisionReasons.join(',') || '-'} | story/pax/cargo=${originalDecision.storyActivity || '-'}/${originalDecision.passengerActivity || '-'}/${originalDecision.cargoActivity || '-'}`);
        }
        if (run !== null && run !== void 0 && run.usedFallback && run !== null && run !== void 0 && run.fallbackStory) {
          lines.push(`  Lokaler Fallback: ${flattenText(run.fallbackStory, 2400)}`);
        }
        if (run !== null && run !== void 0 && run.storyChanged && run !== null && run !== void 0 && run.outputStory) {
          lines.push(`  Post-Ausgabe: ${flattenText(run.outputStory, 2400)}`);
        }
      });
    }
    var textPassenger = window.activePassenger && typeof window.activePassenger === 'object' ? window.activePassenger : ((_missionSnap$contract6 = missionSnap.contract) === null || _missionSnap$contract6 === void 0 ? void 0 : _missionSnap$contract6.passenger) || ((_missionSnap$contract7 = missionSnap.contract) === null || _missionSnap$contract7 === void 0 ? void 0 : _missionSnap$contract7.missionPassenger) || {};
    if (textPassenger !== null && textPassenger !== void 0 && textPassenger.greetingText) lines.push(`- Greeting Text: ${flattenText(textPassenger.greetingText, 420)}`);
    if (textPassenger !== null && textPassenger !== void 0 && textPassenger.enrouteText) lines.push(`- Enroute Text: ${flattenText(textPassenger.enrouteText, 360)}`);
    if (textPassenger !== null && textPassenger !== void 0 && textPassenger.arrivalText || textPassenger !== null && textPassenger !== void 0 && textPassenger.farewellText) lines.push(`- Arrival/Farewell Text: ${flattenText(textPassenger.arrivalText || textPassenger.farewellText, 360)}`);
    var sceneIntent = missionSnap.sceneIntent || ((_missionSnap$contract8 = missionSnap.contract) === null || _missionSnap$contract8 === void 0 ? void 0 : _missionSnap$contract8.sceneIntent) || ((_missionSnap$targetSc = missionSnap.targetSceneDebug) === null || _missionSnap$targetSc === void 0 ? void 0 : _missionSnap$targetSc.sceneIntent) || null;
    if (sceneIntent && typeof sceneIntent === 'object') {
      if (sceneIntent.summary) lines.push(`- SceneIntent Summary: ${flattenText(sceneIntent.summary, 360)}`);
      if (sceneIntent.environment) lines.push(`- SceneIntent Umgebung: ${flattenText(sceneIntent.environment, 260)}`);
      if (Array.isArray(sceneIntent.visibleIdeas) && sceneIntent.visibleIdeas.length) lines.push(`- SceneIntent Sichtbar: ${sceneIntent.visibleIdeas.slice(0, 8).map(v => flattenText(v, 80)).join(' | ')}`);
      if (sceneIntent.notes) lines.push(`- SceneIntent Notes: ${flattenText(sceneIntent.notes, 260)}`);
    } else if (typeof sceneIntent === 'string' && sceneIntent.trim()) {
      lines.push(`- SceneIntent Text: ${flattenText(sceneIntent, 420)}`);
    }
    var geoCtx = missionSnap.targetGeoContext || ((_missionSnap$contract9 = missionSnap.contract) === null || _missionSnap$contract9 === void 0 ? void 0 : _missionSnap$contract9.targetGeoContext) || null;
    if (geoCtx && typeof geoCtx === 'object') {
      var geoBits = [];
      if (geoCtx.geometryMode) geoBits.push(`mode=${geoCtx.geometryMode}`);
      if (geoCtx.primaryKind) geoBits.push(`kind=${geoCtx.primaryKind}`);
      if (geoCtx.source) geoBits.push(`source=${geoCtx.source}`);
      if (Number.isFinite(Number(geoCtx.confidence))) geoBits.push(`conf=${Number(geoCtx.confidence).toFixed(2)}`);
      if (Array.isArray(geoCtx.visualLandmarks) && geoCtx.visualLandmarks.length) geoBits.push(`landmarks=${geoCtx.visualLandmarks.slice(0, 4).map(x => (x === null || x === void 0 ? void 0 : x.name) || (x === null || x === void 0 ? void 0 : x.kind) || x).join(',')}`);
      if (geoBits.length) lines.push(`- TargetGeoContext: ${geoBits.join(' | ')}`);
      if (geoCtx.anchors && typeof geoCtx.anchors === 'object') {
        var anchorSummary = Object.entries(geoCtx.anchors).filter(_ref21 => {
          var _ref22 = _slicedToArray(_ref21, 2),
            a = _ref22[1];
          return a === null || a === void 0 ? void 0 : a.present;
        }).sort((a, b) => {
          var _a$, _b$;
          return Number(((_a$ = a[1]) === null || _a$ === void 0 ? void 0 : _a$.distM) || 999999) - Number(((_b$ = b[1]) === null || _b$ === void 0 ? void 0 : _b$.distM) || 999999);
        }).slice(0, 8).map(_ref23 => {
          var _ref24 = _slicedToArray(_ref23, 2),
            k = _ref24[0],
            a = _ref24[1];
          return `${k}:${Math.round(Number(a.distM) || 0)}m/${Math.round(Number(a.bearingDeg) || 0)}deg${a.name ? `:${flattenText(a.name, 34)}` : ''}`;
        }).join(' | ');
        if (anchorSummary) lines.push(`- TargetGeoContext Anchors: ${anchorSummary}`);
      }
    }
    if (missionSnap.narrativeGuard) lines.push(`- Narrative Guard: ${flattenText(JSON.stringify(missionSnap.narrativeGuard), 420)}`);
  }
  lines.push('');
  lines.push('Mission Scene Debug');
  var sceneDbg = window.gaMissionSceneDebug && typeof window.gaMissionSceneDebug === 'object' ? window.gaMissionSceneDebug : {};
  var missionSceneDbg = ((_missionSnap = missionSnap) === null || _missionSnap === void 0 ? void 0 : _missionSnap.targetSceneDebug) || {};
  var aiRequested = sceneDbg.aiRequested || missionSceneDbg.aiRequested || null;
  var aiNormalized = sceneDbg.aiNormalized || missionSceneDbg.aiNormalized || null;
  var contractTargetScene = sceneDbg.contractTargetScene || missionSceneDbg.contractTargetScene || ((_missionSnap2 = missionSnap) === null || _missionSnap2 === void 0 ? void 0 : _missionSnap2.targetScene) || null;
  var sceneTruth = sceneDbg.missionTruth || ((_missionSnap3 = missionSnap) === null || _missionSnap3 === void 0 ? void 0 : _missionSnap3.missionTruth) || ((_missionSnap4 = missionSnap) === null || _missionSnap4 === void 0 || (_missionSnap4 = _missionSnap4.contract) === null || _missionSnap4 === void 0 ? void 0 : _missionSnap4.missionTruth) || null;
  var sceneComposer = sceneDbg.sceneComposer || ((_missionSnap5 = missionSnap) === null || _missionSnap5 === void 0 ? void 0 : _missionSnap5.targetSceneComposerDebug) || null;
  var targetCommandHasMapPoints = Array.isArray((_sceneDbg$lastTargetS = sceneDbg.lastTargetSceneCommand) === null || _sceneDbg$lastTargetS === void 0 ? void 0 : _sceneDbg$lastTargetS.mapPoints) && sceneDbg.lastTargetSceneCommand.mapPoints.length > 0;
  var targetPreview = !targetCommandHasMapPoints && typeof window.missionTargetSceneDebugPreview === 'function' ? window.missionTargetSceneDebugPreview('debug-report-preview') : null;
  var startEndPreview = typeof window.missionStartEndSceneDebugPreview === 'function' ? window.missionStartEndSceneDebugPreview('debug-report-preview') : null;
  var aptArrivalPreview = typeof window.missionAptArrivalDebugPreview === 'function' ? window.missionAptArrivalDebugPreview('debug-report-preview') : null;
  var appResolved = sceneDbg.appResolvedTargetScene || (targetPreview === null || targetPreview === void 0 ? void 0 : targetPreview.appResolved) || null;
  var appResolvedAptArrival = sceneDbg.appResolvedAptArrivalScene || null;
  var lastTargetCommand = sceneDbg.lastTargetSceneCommand || null;
  var lastAptArrivalCommand = sceneDbg.lastAptArrivalSceneCommand || null;
  var previewTargetCommand = (targetPreview === null || targetPreview === void 0 ? void 0 : targetPreview.command) || null;
  var plannedStartCommand = (startEndPreview === null || startEndPreview === void 0 ? void 0 : startEndPreview.start) || null;
  var plannedEndCommand = (startEndPreview === null || startEndPreview === void 0 ? void 0 : startEndPreview.end) || null;
  var plannedAptArrivalCommand = (aptArrivalPreview === null || aptArrivalPreview === void 0 ? void 0 : aptArrivalPreview.command) || null;
  var lastStartCommand = sceneDbg.lastStartSceneCommand || null;
  var lastEndCommand = sceneDbg.lastEndSceneCommand || null;
  var lastSmokeCommand = sceneDbg.lastSmokeCommand || null;
  var lastAck = sceneDbg.lastAck || ((_window$missionAptArr = window.missionAptArrivalSceneStatus) === null || _window$missionAptArr === void 0 ? void 0 : _window$missionAptArr.lastAck) || ((_window$missionTarget = window.missionTargetSceneStatus) === null || _window$missionTarget === void 0 ? void 0 : _window$missionTarget.lastAck) || ((_window$missionSceneS = window.missionSceneStatus) === null || _window$missionSceneS === void 0 ? void 0 : _window$missionSceneS.lastAck) || null;
  var sceneAccepted = (_ref25 = (_sceneDbg$sceneAccept = sceneDbg.sceneAccepted) !== null && _sceneDbg$sceneAccept !== void 0 ? _sceneDbg$sceneAccept : (_missionSnap6 = missionSnap) === null || _missionSnap6 === void 0 ? void 0 : _missionSnap6.sceneAccepted) !== null && _ref25 !== void 0 ? _ref25 : null;
  var sceneStatus = sceneDbg.sceneCompositionStatus || ((_missionSnap7 = missionSnap) === null || _missionSnap7 === void 0 ? void 0 : _missionSnap7.sceneCompositionStatus) || '-';
  lines.push(`- Plan/Sim Status: accepted=${sceneAccepted === null ? '-' : sceneAccepted ? 'ja' : 'nein'} | composition=${sceneStatus} | targetCommand=${lastTargetCommand ? 'ja' : 'nein'} | ack=${lastAck ? 'ja' : 'nein'}${!lastTargetCommand ? ' | Modus=Plan/Preview' : ''}`);
  if (sceneComposer && typeof sceneComposer === 'object') {
    var toolNames = Array.isArray(sceneComposer.toolCalls) ? sceneComposer.toolCalls.map(c => c.name || '?').slice(0, 5).join(',') : '-';
    lines.push(`- Scene Composer: ${sceneComposer.source || '-'} | prompt=${sceneComposer.promptVersion || '-'} | tools=${toolNames || '-'} | error=${sceneComposer.error || '-'}`);
    if (Array.isArray(sceneComposer.localizationNotes) && sceneComposer.localizationNotes.length) lines.push(`- Scene Composer Lokalisierung: ${sceneComposer.localizationNotes.slice(0, 4).map(n => flattenText(n, 90)).join(' | ')}`);
    if (Array.isArray(sceneComposer.validationNotes) && sceneComposer.validationNotes.length) lines.push(`- Scene Composer Validierung: ${sceneComposer.validationNotes.slice(0, 4).map(n => flattenText(n, 90)).join(' | ')}`);
  }
  var fmtSceneSpec = (label, spec) => {
    if (!spec || typeof spec !== 'object') {
      lines.push(`- ${label}: -`);
      return;
    }
    var roles = Array.isArray(spec.roles) ? spec.roles.join(',') : '-';
    var features = Array.isArray(spec.features) ? spec.features.join(',') : '-';
    var req = Array.isArray(spec.requirements) ? spec.requirements.map(r => {
      var place = r.placement ? `@${String(r.placement).replace(/\s+/g, ' ').slice(0, 34)}` : '';
      var arr = r.arrangement ? `/${r.arrangement}` : '';
      var off = Number.isFinite(Number(r.forwardM)) && Number.isFinite(Number(r.rightM)) ? `[f${Math.round(Number(r.forwardM))},r${Math.round(Number(r.rightM))}]` : '';
      return `${r.feature || '?'}x${r.count || 1}${arr}${place}${off}`;
    }).join(',') : '-';
    var notes = spec.notes ? ` | notes=${String(spec.notes).replace(/\s+/g, ' ').slice(0, 120)}` : '';
    lines.push(`- ${label}: kind=${spec.kind || spec.type || '?'} | preset=${spec.preset || '-'} | density=${spec.density || '-'} | layout=${spec.layout || '-'} | features=${features} | req=${req} | roles=${roles}${notes}`);
  };
  var fmtItem = it => {
    var _it$geoAnchor$distM, _it$geoAnchor$bearing, _it$worldAvoidance;
    var off = Number.isFinite(Number(it.forwardM)) && Number.isFinite(Number(it.rightM)) ? ` f=${Math.round(Number(it.forwardM))} r=${Math.round(Number(it.rightM))}` : '';
    var anchor = it.geoAnchor ? ` anchor=${it.geoAnchor.tag || '-'}:${it.geoAnchor.name || '-'} ${(_it$geoAnchor$distM = it.geoAnchor.distM) !== null && _it$geoAnchor$distM !== void 0 ? _it$geoAnchor$distM : '-'}m/${(_it$geoAnchor$bearing = it.geoAnchor.bearingDeg) !== null && _it$geoAnchor$bearing !== void 0 ? _it$geoAnchor$bearing : '-'}deg` : '';
    var avoid = (_it$worldAvoidance = it.worldAvoidance) !== null && _it$worldAvoidance !== void 0 && _it$worldAvoidance.adjusted ? ` adjusted=${it.worldAvoidance.zone || 'yes'}` : '';
    var placement = it.placement ? ` place=${it.placement}${it.placementOverride ? ':ai-offset' : ''}` : '';
    var candidates = Array.isArray(it.candidates) && it.candidates.length ? ` candidates=${it.candidates.slice(0, 3).join('/')}` : '';
    return `${it.n || '?'}:${it.kind || '?'} "${it.label || ''}" title="${it.title || '-'}"${off}${placement}${anchor}${avoid}${candidates}`;
  };
  var fmtCommand = (label, cmd) => {
    var _cmd$smokeSites, _cmd$fireSites;
    if (!cmd || typeof cmd !== 'object') {
      lines.push(`- ${label}: -`);
      return;
    }
    var pos = Number.isFinite(Number(cmd.lat)) && Number.isFinite(Number(cmd.lon)) ? `${Number(cmd.lat).toFixed(5)}, ${Number(cmd.lon).toFixed(5)}` : '-';
    var itemSummary = Array.isArray(cmd.items) ? cmd.items.slice(0, 10).map(fmtItem).join(' | ') : '';
    var pointSummary = Array.isArray(cmd.mapPoints) ? cmd.mapPoints.slice(0, 10).map(pt => {
      var pos = Number.isFinite(Number(pt.lat)) && Number.isFinite(Number(pt.lon)) ? `${Number(pt.lat).toFixed(5)},${Number(pt.lon).toFixed(5)}` : '-';
      var off = Number.isFinite(Number(pt.forwardM)) && Number.isFinite(Number(pt.rightM)) ? `[f${Math.round(Number(pt.forwardM))},r${Math.round(Number(pt.rightM))}]` : '';
      return `${pt.label || pt.kind || '?'}@${pos}${off}`;
    }).join(' | ') : '';
    lines.push(`- ${label}: ${cmd.type || '?'} id=${cmd.commandId || '-'} reason=${cmd.reason || '-'} scene=${cmd.sceneId || '-'} kind=${cmd.targetSceneKind || '-'} pos=${pos} alt=${Number.isFinite(Number(cmd.altFt)) ? Math.round(Number(cmd.altFt)) : '-'} hdg=${Number.isFinite(Number(cmd.hdg)) ? Math.round(Number(cmd.hdg)) : '-'}`);
    if (cmd.itemCount || itemSummary) lines.push(`  items=${cmd.itemCount || 0}: ${itemSummary || '-'}`);
    if (pointSummary) lines.push(`  points=${Array.isArray(cmd.mapPoints) ? cmd.mapPoints.length : 0}: ${pointSummary}`);
    if (cmd.smokeSites != null || cmd.fireSites != null) lines.push(`  smokeSites=${(_cmd$smokeSites = cmd.smokeSites) !== null && _cmd$smokeSites !== void 0 ? _cmd$smokeSites : '-'} fireSites=${(_cmd$fireSites = cmd.fireSites) !== null && _cmd$fireSites !== void 0 ? _cmd$fireSites : '-'} smoke="${cmd.objectTitle || '-'}" fire="${cmd.fireObjectTitle || '-'}"`);
  };
  fmtSceneSpec('KI-Anforderung raw', aiRequested);
  fmtSceneSpec('KI normalisiert', aiNormalized);
  fmtSceneSpec('Contract', contractTargetScene);
  if (sceneTruth !== null && sceneTruth !== void 0 && sceneTruth.mainTarget) {
    var _mt = sceneTruth.mainTarget;
    var _sa = sceneTruth.sceneAnchor || {};
    var _mtPos = Number.isFinite(Number(_mt.lat)) && Number.isFinite(Number(_mt.lon)) ? `${Number(_mt.lat).toFixed(5)}, ${Number(_mt.lon).toFixed(5)}` : '-';
    var _saPos = Number.isFinite(Number(_sa.lat)) && Number.isFinite(Number(_sa.lon)) ? `${Number(_sa.lat).toFixed(5)}, ${Number(_sa.lon).toFixed(5)}` : '-';
    lines.push(`- MissionTruth: main=${_mt.kind || '-'} ${_mtPos} | anchor=${_sa.kind || '-'} ${_saPos} | cues=${Array.isArray(sceneTruth.visibleCues) ? sceneTruth.visibleCues.join(',') : '-'}`);
  }
  if (sceneTruth !== null && sceneTruth !== void 0 && sceneTruth.arrivalScene) {
    var ar = sceneTruth.arrivalScene;
    var arPos = Number.isFinite(Number(ar.lat)) && Number.isFinite(Number(ar.lon)) ? `${Number(ar.lat).toFixed(5)}, ${Number(ar.lon).toFixed(5)}` : '-';
    var _conf = Number.isFinite(Number(ar.confidence)) ? Number(ar.confidence).toFixed(2) : '-';
    lines.push(`- MissionTruth Arrival: ${ar.roleLabel || ar.role || '-'} | ${ar.anchorType || '-'} ${arPos} | source=${ar.source || '-'} | conf=${_conf}`);
  }
  if (appResolved && typeof appResolved === 'object') {
    var point = appResolved.point || {};
    var pointText = Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)) ? `${Number(point.lat).toFixed(5)}, ${Number(point.lon).toFixed(5)} alt=${Math.round(Number(point.altFt || 0))}ft` : '-';
    lines.push(`- App resolved: kind=${appResolved.resolvedKind || '-'} | scene=${appResolved.sceneId || '-'} | point=${pointText} | items=${appResolved.itemCount || 0}`);
    if (Array.isArray(appResolved.items) && appResolved.items.length) {
      lines.push(`  resolvedItems=${appResolved.items.slice(0, 10).map(fmtItem).join(' | ')}`);
    }
  } else {
    lines.push('- App resolved: -');
  }
  if (appResolvedAptArrival && typeof appResolvedAptArrival === 'object') {
    var _point = appResolvedAptArrival.point || {};
    var _pointText = Number.isFinite(Number(_point.lat)) && Number.isFinite(Number(_point.lon)) ? `${Number(_point.lat).toFixed(5)}, ${Number(_point.lon).toFixed(5)} alt=${Math.round(Number(_point.altFt || 0))}ft` : '-';
    lines.push(`- App resolved APT Arrival: role=${appResolvedAptArrival.roleLabel || appResolvedAptArrival.role || '-'} | scene=${appResolvedAptArrival.sceneId || '-'} | point=${_pointText} | items=${appResolvedAptArrival.itemCount || 0}`);
  } else {
    lines.push('- App resolved APT Arrival: -');
  }
  fmtCommand('App -> Sim Zielszene', lastTargetCommand);
  fmtCommand('App -> Sim APT Arrival', lastAptArrivalCommand);
  fmtCommand('Plan Startszene', plannedStartCommand);
  fmtCommand('Plan Endszene', plannedEndCommand);
  fmtCommand('Plan APT Arrival', plannedAptArrivalCommand);
  fmtCommand('App -> Sim Startszene', lastStartCommand);
  fmtCommand('App -> Sim Endszene', lastEndCommand);
  fmtCommand('App -> Sim Smoke/Fire', lastSmokeCommand);
  var targetPointCommand = targetCommandHasMapPoints ? lastTargetCommand : previewTargetCommand;
  var scenePointCount = [targetPointCommand, lastAptArrivalCommand || plannedAptArrivalCommand, plannedStartCommand, plannedEndCommand, lastSmokeCommand].reduce((sum, cmd) => sum + (Array.isArray(cmd === null || cmd === void 0 ? void 0 : cmd.mapPoints) ? cmd.mapPoints.length : 0), 0);
  var hasPreviewPoints = Boolean(previewTargetCommand && !targetCommandHasMapPoints || plannedStartCommand || plannedEndCommand || plannedAptArrivalCommand);
  lines.push(`- Scene Punkte Overlay: ${window.vpMissionSceneDebugOverlayEnabled ? 'An' : 'Aus'} | Punkte=${scenePointCount}${hasPreviewPoints ? ' (Preview)' : ''}`);
  if (lastAck && typeof lastAck === 'object') {
    var _lastAck$spawned, _lastAck$cleared;
    var byKind = lastAck.spawnedByKind ? JSON.stringify(lastAck.spawnedByKind) : '-';
    lines.push(`- Letztes ACK: ${lastAck.type || '?'} status=${lastAck.status || '-'} spawned=${(_lastAck$spawned = lastAck.spawned) !== null && _lastAck$spawned !== void 0 ? _lastAck$spawned : '-'} cleared=${(_lastAck$cleared = lastAck.cleared) !== null && _lastAck$cleared !== void 0 ? _lastAck$cleared : '-'} byKind=${byKind} error=${lastAck.error || '-'}`);
  } else {
    lines.push('- Letztes ACK: -');
  }
  var sceneEvents = Array.isArray(sceneDbg.events) ? sceneDbg.events.slice(-5) : [];
  if (sceneEvents.length) {
    lines.push('- Scene Events:');
    sceneEvents.forEach(ev => lines.push(`  ${vpFormatDebugTs(ev.ts)} :: ${ev.event}`));
  }
  lines.push('');
  lines.push('Cargo / Bordbestand Diagnose');
  var cargoDbg = typeof window.missionCargoDebugSnapshot === 'function' ? window.missionCargoDebugSnapshot() : null;
  if (!cargoDbg) {
    lines.push('- (Cargo-Diagnose noch nicht verfügbar)');
  } else {
    var hasCargoNumber = value => value !== null && typeof value !== 'undefined' && String(value).trim() !== '' && Number.isFinite(Number(value));
    var fmtCargoPos = function fmtCargoPos() {
      var pos = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      return pos && hasCargoNumber(pos.lat) && hasCargoNumber(pos.lon) ? `${Number(pos.lat).toFixed(6)}, ${Number(pos.lon).toFixed(6)}${hasCargoNumber(pos.altFt) ? ` @ ${Math.round(Number(pos.altFt))} ft` : ''}` : '-';
    };
    var cargoPositionDistanceM = function cargoPositionDistanceM() {
      var a = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      var b = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
      if (!a || !b) return null;
      var lat1 = Number(a.lat) * Math.PI / 180;
      var lat2 = Number(b.lat) * Math.PI / 180;
      var dLat = lat2 - lat1;
      var dLon = (Number(b.lon) - Number(a.lon)) * Math.PI / 180;
      if (![lat1, lat2, dLat, dLon].every(Number.isFinite)) return null;
      var h = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(dLon / 2), 2);
      return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
    };
    var rawSimDeltaM = cargoPositionDistanceM(cargoDbg.rawPos, cargoDbg.simPos);
    lines.push(`- Quelle: ${cargoDbg.source || '-'} | Sim=${cargoDbg.simMode ? 'ja' : 'nein'} | Tracker=${cargoDbg.trackerConnected ? 'verbunden' : 'getrennt'}`);
    lines.push(`- Debug-Slew-Schutz: ${cargoDbg.motionProtectionEnabled ? 'aktiv (Pax-Komfort und Cargo-Stressschaden deaktiviert)' : 'aus'}`);
    lines.push(`- Cargo-Flugzeugposition: ${fmtCargoPos(cargoDbg.cargoPos)}`);
    lines.push(`- Sim-Position: ${fmtCargoPos(cargoDbg.simPos)}`);
    lines.push(`- Raw-Live-Position: ${fmtCargoPos(cargoDbg.rawPos)}${Number.isFinite(rawSimDeltaM) ? ` | Δ zur Sim-Position ${Math.round(rawSimDeltaM)} m` : ''}`);
    var objectActions = Array.isArray(cargoDbg.objectActions) ? cargoDbg.objectActions : [];
    lines.push(`- Objekt-Aktionen: ${objectActions.length ? objectActions.map(action => `${action.objectKey || '-'}:${action.desiredVisible ? 'sichtbar' : 'an Bord'}@r${action.revision || 0}${action.pendingCommandId ? `(${action.pendingCommandId})` : ''}`).join(' | ') : 'keine offen'}`);
    var cargoItems = Array.isArray(cargoDbg.items) ? cargoDbg.items : [];
    if (!cargoItems.length) {
      lines.push('- Bordbestand: keine Items');
    } else {
      lines.push('- Bordbestand:');
      cargoItems.forEach(item => {
        var itemPos = hasCargoNumber(item.unloadLat) && hasCargoNumber(item.unloadLon) ? `${Number(item.unloadLat).toFixed(6)}, ${Number(item.unloadLon).toFixed(6)}` : '-';
        var distance = hasCargoNumber(item.distanceM) ? `${Math.round(Number(item.distanceM))} m` : '-';
        lines.push(`  ${item.id || '?'} "${item.label || ''}" | status=${item.status || '-'} | ablage=${itemPos} | dist=${distance} | laden=${item.reloadAllowed ? 'ja' : 'nein'}`);
      });
    }
  }
  lines.push('');
  lines.push('PAX / Boarding / Voice Diagnose');
  var phaseDbg = typeof window.gaMissionPhaseDebugGet === 'function' ? window.gaMissionPhaseDebugGet() : window.gaMissionPhaseDebug || {};
  var phaseEvents = Array.isArray(phaseDbg === null || phaseDbg === void 0 ? void 0 : phaseDbg.events) ? phaseDbg.events : [];
  var paxFlowKinds = new Set(['runtime_reset', 'runtime_phase', 'start_phase', 'scene_command', 'scene_ack', 'boarding_command', 'boarding_result', 'boarding_wait_timeout', 'boarding_reset', 'boarding_reused', 'boarding_blocked', 'start_boarding_attempt', 'start_boarding_blocked', 'start_boarding_failed', 'start_boarding_complete', 'mission_start_attempt', 'mission_start_blocked', 'mission_start_active', 'pax_manifest_status', 'pax_manifest_load_blocked', 'pax_manifest_unload_blocked', 'voice_reset', 'voice_boarding_attempt', 'voice_boarding_result', 'voice_greeting_attempt', 'voice_greeting_result', 'tracker_connection', 'resume_restore', 'resume_conflict', 'resume_suppressed', 'resume_snapshot_clear']);
  var paxFlowEvents = phaseEvents.filter(entry => paxFlowKinds.has(String((entry === null || entry === void 0 ? void 0 : entry.kind) || ''))).slice(-80);
  var runtimeSnapshot = (() => {
    try {
      return JSON.parse(localStorage.getItem('ga_active_mission_runtime') || 'null');
    } catch (_) {
      return null;
    }
  })();
  var cargoManifest = null;
  try {
    var _missionData$missionC, _window$activeMission;
    var missionData = typeof currentMissionData !== 'undefined' && currentMissionData && typeof currentMissionData === 'object' ? currentMissionData : null;
    cargoManifest = (missionData === null || missionData === void 0 ? void 0 : missionData.cargoManifest) || (missionData === null || missionData === void 0 || (_missionData$missionC = missionData.missionContract) === null || _missionData$missionC === void 0 ? void 0 : _missionData$missionC.cargoManifest) || ((_window$activeMission = window.activeMissionContract) === null || _window$activeMission === void 0 ? void 0 : _window$activeMission.cargoManifest) || null;
  } catch (_) {
    cargoManifest = null;
  }
  var passengerItems = Array.isArray((_cargoManifest = cargoManifest) === null || _cargoManifest === void 0 ? void 0 : _cargoManifest.items) ? cargoManifest.items.filter(item => String((item === null || item === void 0 ? void 0 : item.itemType) || '').toLowerCase() === 'passenger') : [];
  var voiceState = null;
  try {
    voiceState = typeof window.paxVoiceGetDebugState === 'function' ? window.paxVoiceGetDebugState() : null;
  } catch (_) {
    voiceState = null;
  }
  var awmQueueState = null;
  try {
    awmQueueState = typeof window.awmGetAudioQueueDebugState === 'function' ? window.awmGetAudioQueueDebugState() : null;
  } catch (_) {
    awmQueueState = null;
  }
  var runtimePhase = typeof window.missionRuntimePhase === 'function' ? window.missionRuntimePhase() : (runtimeSnapshot === null || runtimeSnapshot === void 0 || (_runtimeSnapshot$runt = runtimeSnapshot.runtime) === null || _runtimeSnapshot$runt === void 0 ? void 0 : _runtimeSnapshot$runt.phase) || (runtimeSnapshot === null || runtimeSnapshot === void 0 ? void 0 : runtimeSnapshot.startPhase) || '-';
  lines.push(`- Historie: persistent=${phaseDbg !== null && phaseDbg !== void 0 && phaseDbg.persistenceEnabled ? 'ja' : 'nein'} | wiederhergestellt=${Number((phaseDbg === null || phaseDbg === void 0 ? void 0 : phaseDbg.restoredEventCount) || 0)} | Events gesamt=${phaseEvents.length} | PAX-relevant=${paxFlowEvents.length}`);
  lines.push(`- Runtime: phase=${runtimePhase || '-'} | startPhase=${(runtimeSnapshot === null || runtimeSnapshot === void 0 ? void 0 : runtimeSnapshot.startPhase) || '-'} | active=${runtimeSnapshot !== null && runtimeSnapshot !== void 0 && (_runtimeSnapshot$runt2 = runtimeSnapshot.runtime) !== null && _runtimeSnapshot$runt2 !== void 0 && _runtimeSnapshot$runt2.active ? '1' : '0'} | closing=${runtimeSnapshot !== null && runtimeSnapshot !== void 0 && (_runtimeSnapshot$runt3 = runtimeSnapshot.runtime) !== null && _runtimeSnapshot$runt3 !== void 0 && _runtimeSnapshot$runt3.closingPending ? '1' : '0'} | missionId=${(runtimeSnapshot === null || runtimeSnapshot === void 0 ? void 0 : runtimeSnapshot.missionId) || '-'}`);
  lines.push(`- Tracker: connected=${window.liveTrackerConnected ? '1' : '0'} | version=${window.liveTrackerVersionLabel || '-'} | code=${Number.isFinite(Number(window.liveTrackerVersionCode)) ? Number(window.liveTrackerVersionCode) : '-'} | missionUi=${((_window$GAMissionCont = window.GAMissionControlUiCore) === null || _window$GAMissionCont === void 0 ? void 0 : _window$GAMissionCont.BUILD_ID) || '-'} | relay=${window.liveGpsRelayCode || '-'} | telemetry=${window.liveTrackerTelemetryMode || 'unknown'}${window.liveTrackerTelemetryReason ? `:${window.liveTrackerTelemetryReason}` : ''} | since=${vpFormatDebugTs(window.liveTrackerTelemetrySince)}`);
  var hibPos = window.liveTrackerLastKnownPosition;
  var wakeReq = window.gaLastTrackerWakeRequest;
  var wakeAck = window.gaLastTrackerWakeAck;
  lines.push(`- Tracker HIB/Wake: lastPos=${Number.isFinite(Number(hibPos === null || hibPos === void 0 ? void 0 : hibPos.lat)) && Number.isFinite(Number(hibPos === null || hibPos === void 0 ? void 0 : hibPos.lon)) ? `${Number(hibPos.lat).toFixed(5)},${Number(hibPos.lon).toFixed(5)}@${vpFormatDebugTs(hibPos.t)}` : '-'} | wakeReq=${(wakeReq === null || wakeReq === void 0 ? void 0 : wakeReq.reason) || '-'}@${vpFormatDebugTs(wakeReq === null || wakeReq === void 0 ? void 0 : wakeReq.at)} | wakeAck=${(wakeAck === null || wakeAck === void 0 ? void 0 : wakeAck.status) || '-'}${wakeAck !== null && wakeAck !== void 0 && wakeAck.blockedReason ? `:${wakeAck.blockedReason}` : ''}@${vpFormatDebugTs(wakeAck === null || wakeAck === void 0 ? void 0 : wakeAck.receivedAt)}`);
  lines.push(`- Startszene: id=${((_window$missionSceneS2 = window.missionSceneStatus) === null || _window$missionSceneS2 === void 0 ? void 0 : _window$missionSceneS2.sceneId) || '-'} | spawned=${(_window$missionSceneS3 = window.missionSceneStatus) !== null && _window$missionSceneS3 !== void 0 && _window$missionSceneS3.spawned ? '1' : '0'}(${Number(((_window$missionSceneS4 = window.missionSceneStatus) === null || _window$missionSceneS4 === void 0 ? void 0 : _window$missionSceneS4.spawnedCount) || 0)}) | spawnReq=${(_window$missionSceneS5 = window.missionSceneStatus) !== null && _window$missionSceneS5 !== void 0 && _window$missionSceneS5.spawnRequested ? '1' : '0'} | clearReq=${(_window$missionSceneS6 = window.missionSceneStatus) !== null && _window$missionSceneS6 !== void 0 && _window$missionSceneS6.clearRequested ? '1' : '0'} | respawn=${(_window$missionSceneS7 = window.missionSceneStatus) !== null && _window$missionSceneS7 !== void 0 && _window$missionSceneS7.respawnAfterClear ? '1' : '0'}:${((_window$missionSceneS8 = window.missionSceneStatus) === null || _window$missionSceneS8 === void 0 ? void 0 : _window$missionSceneS8.respawnAfterClearReason) || '-'} | block=${((_window$missionSceneS9 = window.missionSceneStatus) === null || _window$missionSceneS9 === void 0 ? void 0 : _window$missionSceneS9.blockReason) || '-'}`);
  lines.push(`- Boarding: preparing=${(_window$missionSceneS0 = window.missionSceneStatus) !== null && _window$missionSceneS0 !== void 0 && _window$missionSceneS0.boardingPreparing ? '1' : '0'} | requested=${(_window$missionSceneS1 = window.missionSceneStatus) !== null && _window$missionSceneS1 !== void 0 && _window$missionSceneS1.boardingRequested ? '1' : '0'} | active=${(_window$missionSceneS10 = window.missionSceneStatus) !== null && _window$missionSceneS10 !== void 0 && _window$missionSceneS10.boardingActive ? '1' : '0'} | complete=${(_window$missionSceneS11 = window.missionSceneStatus) !== null && _window$missionSceneS11 !== void 0 && _window$missionSceneS11.boardingComplete ? '1' : '0'} | personBoarded=${(_window$missionSceneS12 = window.missionSceneStatus) !== null && _window$missionSceneS12 !== void 0 && _window$missionSceneS12.personBoarded ? '1' : '0'} | voiceComplete=${(_window$missionSceneS13 = window.missionSceneStatus) !== null && _window$missionSceneS13 !== void 0 && _window$missionSceneS13.boardingVoiceComplete ? '1' : '0'} | error=${((_window$missionSceneS14 = window.missionSceneStatus) === null || _window$missionSceneS14 === void 0 ? void 0 : _window$missionSceneS14.boardingError) || '-'}`);
  if ((_window$missionSceneS15 = window.missionSceneStatus) !== null && _window$missionSceneS15 !== void 0 && _window$missionSceneS15.lastCommand) lines.push(`- Startszene letzter Command: ${flattenText(JSON.stringify(window.missionSceneStatus.lastCommand), 520)}`);
  if ((_window$missionSceneS16 = window.missionSceneStatus) !== null && _window$missionSceneS16 !== void 0 && _window$missionSceneS16.lastAck) lines.push(`- Startszene letztes ACK: ${flattenText(JSON.stringify(window.missionSceneStatus.lastAck), 760)}`);
  if (passengerItems.length) {
    lines.push(`- Manifest PAX: ${passengerItems.map(item => `${item.id || '?'}=${item.status || '?'} count=${Number(item.passengerCount || 1)} load=${vpFormatDebugTs(item.loadedAt)} unload=${vpFormatDebugTs(item.unloadedAt)}`).join(' | ')}`);
  } else {
    lines.push('- Manifest PAX: (kein Passenger-Item)');
  }
  if (voiceState) {
    var _voiceState$missionEp;
    lines.push(`- Voice: enabled=${voiceState.voiceEnabled ? '1' : '0'} | effects=${voiceState.audioEffectsEnabled ? '1' : '0'} | apiKey=${voiceState.hasApiKey ? '1' : '0'} | hasPassenger=${voiceState.hasPassenger ? '1' : '0'} | pax=${flattenText(voiceState.passengerName || '-', 80)}`);
    lines.push(`- Voice Audio: context=${voiceState.audioContextState || '-'} | gain=${Number.isFinite(Number(voiceState.masterGain)) ? Number(voiceState.masterGain).toFixed(2) : '-'} | epoch=${(_voiceState$missionEp = voiceState.missionEpoch) !== null && _voiceState$missionEp !== void 0 ? _voiceState$missionEp : '-'} | playback=${voiceState.playbackActive ? '1' : '0'} | prepared=${Array.isArray(voiceState.preparedAudio) ? voiceState.preparedAudio.length : 0}`);
    if (awmQueueState) {
      lines.push(`- AWM Queue: wp=${awmQueueState.wpEnabled ? '1' : '0'} | airspace=${awmQueueState.airspaceEnabled ? '1' : '0'} | freq=${awmQueueState.frequencyEnabled ? '1' : '0'} | terrain=${awmQueueState.terrainEnabled ? '1' : '0'} | context=${awmQueueState.audioContextState || '-'} | clips=${awmQueueState.clipsLoaded ? 'ready' : awmQueueState.clipsLoading ? 'loading' : 'not-loaded'}(${Number(awmQueueState.loadedClipCount || 0)}) | depth=${Number(awmQueueState.queueDepth || 0)} | busy=${awmQueueState.queueBusy ? '1' : '0'} | paxHold=${Number(awmQueueState.priorityHolds || 0)} | playback=${awmQueueState.playbackActive ? '1' : '0'} | enqueued=${Number(awmQueueState.enqueuedCount || 0)} (WP ${Number(awmQueueState.waypointEnqueuedCount || 0)}) | started=${Number(awmQueueState.segmentsStartedCount || 0)} | lastEnqueue=${awmQueueState.lastEnqueuedKey || '-'}@${vpFormatDebugTs(awmQueueState.lastEnqueuedAt)} | lastStart=${awmQueueState.lastStartedKey || '-'}@${vpFormatDebugTs(awmQueueState.lastStartedAt)}`);
    }
    lines.push(`- Voice Flags: boarding=${voiceState.boardingDone ? '1' : '0'} | greeting=${voiceState.greetingDone ? '1' : '0'} | target=${voiceState.atTargetDone ? '1' : '0'} | farewell=${voiceState.farewellDone ? '1' : '0'} | endLock=${voiceState.missionEndVoiceActive ? '1' : '0'}`);
    var recentVoiceLog = Array.isArray(voiceState.recentLog) ? voiceState.recentLog.slice(0, 30).reverse() : [];
    if (recentVoiceLog.length) {
      lines.push('- Voice Verlauf:');
      recentVoiceLog.forEach(entry => lines.push(`  ${entry.at ? vpFormatDebugTs(entry.at) : entry.ts || '-'} [${entry.type || 'event'}] ${flattenText(entry.msg, 520)}`));
    }
  } else {
    lines.push('- Voice: Debug-State nicht verfügbar');
  }
  if (paxFlowEvents.length) {
    lines.push('- Persistenter PAX-Flow:');
    paxFlowEvents.forEach(entry => {
      var payload = entry !== null && entry !== void 0 && entry.payload && typeof entry.payload === 'object' ? ` | ${flattenText(JSON.stringify(entry.payload), 900)}` : '';
      lines.push(`  ${vpFormatDebugTs(entry.ts)} :: ${entry.kind}${payload}`);
    });
  } else {
    lines.push('- Persistenter PAX-Flow: (noch keine Ereignisse)');
  }
  lines.push('');
  lines.push('Konsolenfehler / relevante Logs');
  var consoleLogs = collectConsoleLogs();
  var importantLogs = consoleLogs.filter(isImportantConsoleLog);
  var priorityLogs = consoleLogs.filter(isPriorityMissionConsoleLog);
  var dedupedLogSet = new Set();
  var mergedImportantLogs = [];
  [].concat(_toConsumableArray(importantLogs), _toConsumableArray(priorityLogs)).forEach(entry => {
    var key = `${(entry === null || entry === void 0 ? void 0 : entry.ts) || ''}|${(entry === null || entry === void 0 ? void 0 : entry.level) || ''}|${(entry === null || entry === void 0 ? void 0 : entry.msg) || ''}`;
    if (dedupedLogSet.has(key)) return;
    dedupedLogSet.add(key);
    mergedImportantLogs.push(entry);
  });
  var importantLogTail = mergedImportantLogs.slice(-32);
  if (!importantLogTail.length) {
    lines.push('- (keine relevanten Console-Warnungen/Fehler im Ringbuffer)');
  } else {
    importantLogTail.forEach(entry => {
      var extra = entry.extra ? ` | ${flattenText(JSON.stringify(entry.extra), 260)}` : '';
      lines.push(`- ${vpFormatDebugTs(entry.ts)} [${entry.level || 'log'}] ${flattenText(entry.msg, 520)}${extra}`);
    });
  }
  lines.push('');
  lines.push('Recent Events');
  var events = Array.isArray(dbg.recentEvents) ? dbg.recentEvents.slice(-8) : [];
  if (!events.length) lines.push('- (keine)');else events.forEach(ev => lines.push(`- ${vpFormatDebugTs(ev.ts)} :: ${ev.message}`));
  return lines.join('\n');
};
window.vpRefreshWeatherDebugReport = function () {
  var body = document.getElementById('weatherDebugBody');
  if (!body) return;
  try {
    body.textContent = window.vpBuildWeatherDebugReport ? window.vpBuildWeatherDebugReport() : 'Debug-Daten nicht verfügbar';
    if (typeof window.missionFollowupInit === 'function') window.missionFollowupInit();
    if (typeof window.updatePoiChainDebugForceButtonUi === 'function') window.updatePoiChainDebugForceButtonUi();
    if (typeof window.missionDebugUpdateMotionProtectionButtonUi === 'function') window.missionDebugUpdateMotionProtectionButtonUi();
  } catch (err) {
    var msg = err && (err.stack || err.message || String(err));
    body.textContent = `Debug-Report Fehler:\n${msg || 'unknown'}`;
    if (typeof window.gaDebugPush === 'function') {
      try {
        window.gaDebugPush('debug-error', '[DEBUG REPORT] build failed', {
          message: msg || 'unknown'
        });
      } catch (_) {}
    }
  }
};
window.vpCopyWeatherDebugReport = /*#__PURE__*/_asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee6() {
  var btn, oldText, text, _document$getElementB4, body, ta, ok, _t4;
  return _regenerator().w(function (_context6) {
    while (1) switch (_context6.p = _context6.n) {
      case 0:
        btn = document.getElementById('btnCopyWeatherDebug');
        oldText = btn ? btn.textContent : '';
        text = '';
        _context6.p = 1;
        text = window.vpBuildWeatherDebugReport ? window.vpBuildWeatherDebugReport() : ((_document$getElementB4 = document.getElementById('weatherDebugBody')) === null || _document$getElementB4 === void 0 ? void 0 : _document$getElementB4.textContent) || '';
        body = document.getElementById('weatherDebugBody');
        if (body && text) body.textContent = text;
        if (text.trim()) {
          _context6.n = 2;
          break;
        }
        throw new Error('empty_debug_report');
      case 2:
        if (!(navigator.clipboard && typeof navigator.clipboard.writeText === 'function')) {
          _context6.n = 4;
          break;
        }
        _context6.n = 3;
        return navigator.clipboard.writeText(text);
      case 3:
        _context6.n = 5;
        break;
      case 4:
        ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', 'readonly');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand && document.execCommand('copy');
        ta.remove();
        if (ok) {
          _context6.n = 5;
          break;
        }
        throw new Error('clipboard_unavailable');
      case 5:
        if (btn) {
          btn.textContent = 'Kopiert';
          setTimeout(() => {
            btn.textContent = oldText || 'Kopieren';
          }, 1200);
        }
        _context6.n = 7;
        break;
      case 6:
        _context6.p = 6;
        _t4 = _context6.v;
        if (btn) {
          btn.textContent = 'Fehler';
          setTimeout(() => {
            btn.textContent = oldText || 'Kopieren';
          }, 1600);
        }
        console.warn('[Debug] Copy failed:', _t4);
        alert(`Debug-Log konnte nicht kopiert werden: ${(_t4 === null || _t4 === void 0 ? void 0 : _t4.message) || _t4}`);
      case 7:
        return _context6.a(2);
    }
  }, _callee6, null, [[1, 6]]);
}));
window.vpBuildMissionPhaseDebugReport = function () {
  var fmt = ts => vpFormatDebugTs(ts);
  var lines = [];
  var dbg = typeof window.gaMissionPhaseDebugGet === 'function' ? window.gaMissionPhaseDebugGet() : window.gaMissionPhaseDebug || null;
  var missionSnap = window.vpMissionDebugSnapshot || (() => {
    try {
      return JSON.parse(localStorage.getItem('ga_mission_debug_snapshot') || 'null');
    } catch (_) {
      return null;
    }
  })();
  var events = Array.isArray(dbg === null || dbg === void 0 ? void 0 : dbg.events) ? dbg.events : [];
  var contract = missionSnap !== null && missionSnap !== void 0 && missionSnap.contract && typeof missionSnap.contract === 'object' ? missionSnap.contract : null;
  var bush = contract !== null && contract !== void 0 && contract.bush && typeof contract.bush === 'object' ? contract.bush : null;
  var missionType = String((contract === null || contract === void 0 ? void 0 : contract.missionType) || (missionSnap === null || missionSnap === void 0 ? void 0 : missionSnap.mode) || '').trim().toLowerCase();
  var poiRecipeId = typeof window.missionPoiRecipeId === 'function' && contract ? String(window.missionPoiRecipeId(contract) || '').trim().toLowerCase() : '';
  var bushRecipeId = typeof window._bushRecipeIdFromSpec === 'function' && bush ? String(window._bushRecipeIdFromSpec(bush) || '').trim().toLowerCase() : '';
  var sarHeliProgress = (_currentMissionData2 => {
    try {
      if (typeof window.missionSarHeliProgressSnapshot === 'function') return window.missionSarHeliProgressSnapshot();
    } catch (_) {}
    return typeof currentMissionData !== 'undefined' && (_currentMissionData2 = currentMissionData) !== null && _currentMissionData2 !== void 0 && _currentMissionData2.sarHeliProgress ? currentMissionData.sarHeliProgress : null;
  })();
  var lastRuntimePhaseEntry = _toConsumableArray(events).reverse().find(e => (e === null || e === void 0 ? void 0 : e.kind) === 'runtime_phase');
  var lastStartPhaseEntry = _toConsumableArray(events).reverse().find(e => (e === null || e === void 0 ? void 0 : e.kind) === 'start_phase');
  var lastBushProgressEntry = _toConsumableArray(events).reverse().find(e => (e === null || e === void 0 ? void 0 : e.kind) === 'bush_progress');
  var lastGroundActionEntry = _toConsumableArray(events).reverse().find(e => (e === null || e === void 0 ? void 0 : e.kind) === 'ground_action');
  var lastDialogEntry = _toConsumableArray(events).reverse().find(e => (e === null || e === void 0 ? void 0 : e.kind) === 'dialog');
  var finalOutcomeEntry = _toConsumableArray(events).reverse().find(e => {
    var _e$payload, _e$payload2;
    return (e === null || e === void 0 ? void 0 : e.kind) === 'trigger' && ((e === null || e === void 0 || (_e$payload = e.payload) === null || _e$payload === void 0 ? void 0 : _e$payload.name) === 'missionCargoFinalizeMissionOutcome' || (e === null || e === void 0 || (_e$payload2 = e.payload) === null || _e$payload2 === void 0 ? void 0 : _e$payload2.name) === '_missionSceneFinishRuntimeAfterDeboard:outcome');
  });
  var completionEntry = _toConsumableArray(events).reverse().find(e => {
    var _e$payload3;
    return (e === null || e === void 0 ? void 0 : e.kind) === 'trigger' && (e === null || e === void 0 || (_e$payload3 = e.payload) === null || _e$payload3 === void 0 ? void 0 : _e$payload3.name) === 'completeSimMissionEnd';
  });
  var hasEvent = (kind, predicate) => events.some(entry => {
    if (kind && (entry === null || entry === void 0 ? void 0 : entry.kind) !== kind) return false;
    return typeof predicate === 'function' ? !!predicate(entry.payload || {}, entry) : true;
  });
  var recipeFlow = (() => {
    if (bushRecipeId === 'pickup_return') return 'A -> B (Landung/Pickup) -> A';
    if (bushRecipeId === 'poi_on_task_return' || poiRecipeId === 'poi_on_task_return') return 'A -> B (POI/on-task ohne Landung) -> A';
    if (poiRecipeId === 'poi_sar_heli') return 'A -> B (Fundstelle: Hover/Landung/Patient) -> C (Klinik)';
    if (poiRecipeId === 'poi_on_task' || poiRecipeId === 'poi_flyover' || poiRecipeId === 'poi_fire_watch' || poiRecipeId === 'poi_search_and_rescue' || poiRecipeId === 'poi_training') {
      return 'A -> B (POI/on-task ohne Landung) -> A';
    }
    return 'A -> B';
  })();
  var validation = {
    targetReached: hasEvent('ground_action', p => p.atTarget === true) || hasEvent('sar_heli_progress', p => p.targetConfirmed === true) || !!(sarHeliProgress !== null && sarHeliProgress !== void 0 && sarHeliProgress.targetConfirmed),
    taskEntered: hasEvent(null, (_, entry) => {
      var _entry$payload, _entry$payload2, _entry$payload3, _entry$payload4, _entry$payload5, _entry$payload6, _entry$payload7, _entry$payload8;
      return entry.kind === 'bush_progress' && (((_entry$payload = entry.payload) === null || _entry$payload === void 0 ? void 0 : _entry$payload.to) === 'on_task' || ((_entry$payload2 = entry.payload) === null || _entry$payload2 === void 0 ? void 0 : _entry$payload2.to) === 'pickup_ready' || ((_entry$payload3 = entry.payload) === null || _entry$payload3 === void 0 ? void 0 : _entry$payload3.to) === 'pickup_loading' || ((_entry$payload4 = entry.payload) === null || _entry$payload4 === void 0 ? void 0 : _entry$payload4.to) === 'pickup_complete') || entry.kind === 'ground_action' && ['on_task', 'pickup_ready', 'pickup_loading', 'pickup_complete'].includes(String(((_entry$payload5 = entry.payload) === null || _entry$payload5 === void 0 ? void 0 : _entry$payload5.phase) || '')) || entry.kind === 'sar_heli_progress' && (((_entry$payload6 = entry.payload) === null || _entry$payload6 === void 0 ? void 0 : _entry$payload6.targetConfirmed) || ((_entry$payload7 = entry.payload) === null || _entry$payload7 === void 0 ? void 0 : _entry$payload7.holdReady) || ((_entry$payload8 = entry.payload) === null || _entry$payload8 === void 0 ? void 0 : _entry$payload8.patientLoaded));
    }) || !!(sarHeliProgress !== null && sarHeliProgress !== void 0 && sarHeliProgress.targetConfirmed || sarHeliProgress !== null && sarHeliProgress !== void 0 && sarHeliProgress.holdReadyAnnounced || sarHeliProgress !== null && sarHeliProgress !== void 0 && sarHeliProgress.patientLoaded),
    returnLegReached: hasEvent(null, (_, entry) => {
      var _entry$payload9, _entry$payload0, _entry$payload1;
      return entry.kind === 'bush_progress' && ((_entry$payload9 = entry.payload) === null || _entry$payload9 === void 0 ? void 0 : _entry$payload9.to) === 'return_leg' || entry.kind === 'ground_action' && String(((_entry$payload0 = entry.payload) === null || _entry$payload0 === void 0 ? void 0 : _entry$payload0.phase) || '') === 'return_leg' || entry.kind === 'sar_heli_progress' && ((_entry$payload1 = entry.payload) === null || _entry$payload1 === void 0 ? void 0 : _entry$payload1.patientLoaded) === true;
    }) || !!(sarHeliProgress !== null && sarHeliProgress !== void 0 && sarHeliProgress.patientLoaded),
    readyToCloseReached: hasEvent(null, (_, entry) => {
      var _entry$payload10, _entry$payload11, _entry$payload12;
      return entry.kind === 'bush_progress' && ((_entry$payload10 = entry.payload) === null || _entry$payload10 === void 0 ? void 0 : _entry$payload10.to) === 'ready_to_close' || entry.kind === 'ground_action' && String(((_entry$payload11 = entry.payload) === null || _entry$payload11 === void 0 ? void 0 : _entry$payload11.phase) || '') === 'ready_to_close' || entry.kind === 'sar_heli_progress' && ((_entry$payload12 = entry.payload) === null || _entry$payload12 === void 0 ? void 0 : _entry$payload12.readyToClose) === true;
    }) || !!(sarHeliProgress !== null && sarHeliProgress !== void 0 && sarHeliProgress.readyToClose),
    simEndTriggered: hasEvent('trigger', p => p.name === 'completeSimMissionEnd'),
    farewellTriggered: hasEvent('trigger', p => p.name === '_triggerPaxFarewellAndWaitForDeboard:started'),
    deboardingStarted: hasEvent('trigger', p => p.name === 'missionSceneStartDeboardingAfterFarewell' || p.name === 'finishMissionCargoUnloadAndEnd:start-bush-home-deboarding'),
    outcomeFinalized: hasEvent('trigger', p => p.name === 'missionCargoFinalizeMissionOutcome' || p.name === '_missionSceneFinishRuntimeAfterDeboard:outcome'),
    resetAfterClose: hasEvent('trigger', p => Number(p.runtimeActive || 0) === 0 && Number(p.closingPending || 0) === 1) || hasEvent('start_phase', p => p.trigger === 'clear-start-phase')
  };
  var validationFlag = ok => ok ? '1' : '0';
  var finalOutcomePayload = finalOutcomeEntry !== null && finalOutcomeEntry !== void 0 && finalOutcomeEntry.payload && typeof finalOutcomeEntry.payload === 'object' ? finalOutcomeEntry.payload : {};
  var completionPayload = completionEntry !== null && completionEntry !== void 0 && completionEntry.payload && typeof completionEntry.payload === 'object' ? completionEntry.payload : {};
  lines.push(`Session seit: ${fmt((dbg === null || dbg === void 0 ? void 0 : dbg.sessionStartedAt) || (dbg === null || dbg === void 0 ? void 0 : dbg.ts) || Date.now())}`);
  lines.push('Phasen-Log');
  if (missionSnap) {
    lines.push(`- Mission: ${missionSnap.mission || 'n/a'}`);
    lines.push(`- Ziel: ${missionSnap.target || 'n/a'}`);
    lines.push(`- Modus/Kategorie: ${missionSnap.mode || '?'} / ${missionSnap.category || '?'}`);
  } else {
    lines.push('- Mission: -');
  }
  lines.push(`- Events: ${events.length}`);
  lines.push(`- Ablauf-Rezept: ${recipeFlow}`);
  lines.push(`- Rezept-ID: Bush=${bushRecipeId || '-'} | POI=${poiRecipeId || '-'}`);
  if (bush) {
    lines.push(`- Bush-Contract: profile=${bush.profileId || '-'} | targetMode=${bush.targetMode || '-'} | completionMode=${bush.completionMode || '-'} | returnHome=${bush.requiresReturnHome ? '1' : '0'}`);
  } else if (missionType === 'poi') {
    var _missionSnap$passenge, _missionSnap$passenge2, _missionSnap$passenge3;
    lines.push(`- POI-Contract: dwell=${Number((missionSnap === null || missionSnap === void 0 || (_missionSnap$passenge = missionSnap.passenger) === null || _missionSnap$passenge === void 0 ? void 0 : _missionSnap$passenge.targetDwellMin) || 0)} min | radius=${Number((missionSnap === null || missionSnap === void 0 || (_missionSnap$passenge2 = missionSnap.passenger) === null || _missionSnap$passenge2 === void 0 ? void 0 : _missionSnap$passenge2.targetRadiusNm) || 0)} NM | alt=${Number((missionSnap === null || missionSnap === void 0 || (_missionSnap$passenge3 = missionSnap.passenger) === null || _missionSnap$passenge3 === void 0 ? void 0 : _missionSnap$passenge3.targetAltFt) || 0)} ft`);
  }
  lines.push('');
  lines.push('Debug-Protokoll');
  lines.push(`- Ziel erreicht: ${validationFlag(validation.targetReached)}`);
  lines.push(`- Task-/Dialog-Phase erreicht: ${validationFlag(validation.taskEntered)}`);
  lines.push(`- Return-Leg erreicht: ${validationFlag(validation.returnLegReached)}`);
  lines.push(`- Ready-to-close erreicht: ${validationFlag(validation.readyToCloseReached)}`);
  lines.push(`- Sim-Ende getriggert: ${validationFlag(validation.simEndTriggered)}${completionPayload.distanceNm ? ` | distanceNm=${completionPayload.distanceNm}` : ''}`);
  lines.push(`- Farewell getriggert: ${validationFlag(validation.farewellTriggered)}`);
  lines.push(`- Deboarding gestartet: ${validationFlag(validation.deboardingStarted)}`);
  lines.push(`- Outcome finalisiert: ${validationFlag(validation.outcomeFinalized)}${typeof finalOutcomePayload.failed !== 'undefined' ? ` | failed=${finalOutcomePayload.failed ? '1' : '0'}` : ''}`);
  lines.push(`- Reset/Close-Pfad gesehen: ${validationFlag(validation.resetAfterClose)}`);
  if (lastRuntimePhaseEntry !== null && lastRuntimePhaseEntry !== void 0 && lastRuntimePhaseEntry.payload) {
    lines.push(`- Letzte Runtime-Phase: ${lastRuntimePhaseEntry.payload.from || '-'} -> ${lastRuntimePhaseEntry.payload.to || '-'}`);
  }
  if (lastStartPhaseEntry !== null && lastStartPhaseEntry !== void 0 && lastStartPhaseEntry.payload) {
    lines.push(`- Letzte Start-Phase: ${lastStartPhaseEntry.payload.from || '-'} -> ${lastStartPhaseEntry.payload.to || '-'}`);
  }
  if (lastBushProgressEntry !== null && lastBushProgressEntry !== void 0 && lastBushProgressEntry.payload) {
    lines.push(`- Letzter Bush-Status: ${lastBushProgressEntry.payload.from || '-'} -> ${lastBushProgressEntry.payload.to || '-'} | ready=${lastBushProgressEntry.payload.pickupReady ? '1' : '0'} completed=${lastBushProgressEntry.payload.pickupCompleted ? '1' : '0'} confirmed=${lastBushProgressEntry.payload.pickupConfirmed ? '1' : '0'} home=${lastBushProgressEntry.payload.returnHomeQualified ? '1' : '0'}`);
  }
  if (lastGroundActionEntry !== null && lastGroundActionEntry !== void 0 && lastGroundActionEntry.payload) {
    lines.push(`- Letzte Bodenaktion: action=${lastGroundActionEntry.payload.action || '-'} | phase=${lastGroundActionEntry.payload.phase || '-'} | reason=${lastGroundActionEntry.payload.reason || '-'} | atTarget=${lastGroundActionEntry.payload.atTarget ? '1' : '0'} | groundStill=${lastGroundActionEntry.payload.groundStill ? '1' : '0'}`);
  }
  if (lastDialogEntry !== null && lastDialogEntry !== void 0 && lastDialogEntry.payload) {
    lines.push(`- Letzter Dialog: mode=${lastDialogEntry.payload.mode || '-'} | trigger=${lastDialogEntry.payload.trigger || '-'} | phase=${lastDialogEntry.payload.phase || '-'}`);
  }
  if (finalOutcomePayload.requiredStatus) {
    lines.push(`- Outcome requiredStatus: ${typeof finalOutcomePayload.requiredStatus === 'string' ? finalOutcomePayload.requiredStatus : JSON.stringify(finalOutcomePayload.requiredStatus)}`);
  }
  lines.push('');
  lines.push('Trigger / Phasen / Aktionen');
  if (!events.length) {
    lines.push('- (keine Einträge)');
    return lines.join('\n');
  }
  events.slice(-120).forEach(entry => {
    var payload = entry !== null && entry !== void 0 && entry.payload && typeof entry.payload === 'object' ? entry.payload : {};
    var kind = String((entry === null || entry === void 0 ? void 0 : entry.kind) || 'event');
    if (kind === 'runtime_phase') {
      lines.push(`- ${fmt(entry.ts)} :: runtime ${payload.from || '-'} -> ${payload.to || '-'} | trigger=${payload.trigger || '-'}`);
      return;
    }
    if (kind === 'start_phase') {
      lines.push(`- ${fmt(entry.ts)} :: start ${payload.from || '-'} -> ${payload.to || '-'} | trigger=${payload.trigger || '-'}`);
      return;
    }
    if (kind === 'bush_progress') {
      lines.push(`- ${fmt(entry.ts)} :: bush ${payload.from || '-'} -> ${payload.to || '-'} | ready=${payload.pickupReady ? '1' : '0'} completed=${payload.pickupCompleted ? '1' : '0'} confirmed=${payload.pickupConfirmed ? '1' : '0'} home=${payload.returnHomeQualified ? '1' : '0'}`);
      return;
    }
    if (kind === 'ground_action') {
      lines.push(`- ${fmt(entry.ts)} :: action=${payload.action || '-'} phase=${payload.phase || '-'} | trigger=${payload.trigger || '-'} | groundStill=${payload.groundStill ? '1' : '0'} atTarget=${payload.atTarget ? '1' : '0'} reason=${payload.reason || '-'} bush=${payload.bushStatus || '-'}`);
      return;
    }
    if (kind === 'dialog') {
      lines.push(`- ${fmt(entry.ts)} :: dialog=${payload.mode || '-'} | trigger=${payload.trigger || '-'} | phase=${payload.phase || '-'}${payload.poiGroundEndReady ? ' | poiReady=1' : ''}`);
      return;
    }
    if (kind === 'trigger') {
      var rest = Object.keys(payload).filter(k => k !== 'name' && payload[k] !== null && payload[k] !== undefined && payload[k] !== '').map(k => `${k}=${typeof payload[k] === 'boolean' ? payload[k] ? '1' : '0' : String(payload[k])}`).join(' | ');
      lines.push(`- ${fmt(entry.ts)} :: trigger=${payload.name || '-'}${rest ? ` | ${rest}` : ''}`);
      return;
    }
    lines.push(`- ${fmt(entry.ts)} :: ${kind} ${JSON.stringify(payload)}`);
  });
  return lines.join('\n');
};
window.vpCopyMissionPhaseDebugReport = /*#__PURE__*/_asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee7() {
  var btn, oldText, text, ta, ok, _t5;
  return _regenerator().w(function (_context7) {
    while (1) switch (_context7.p = _context7.n) {
      case 0:
        btn = document.getElementById('btnCopyMissionPhaseDebug');
        oldText = btn ? btn.textContent : '';
        _context7.p = 1;
        text = window.vpBuildMissionPhaseDebugReport ? window.vpBuildMissionPhaseDebugReport() : '';
        if (text.trim()) {
          _context7.n = 2;
          break;
        }
        throw new Error('empty_phase_debug_report');
      case 2:
        if (!(navigator.clipboard && typeof navigator.clipboard.writeText === 'function')) {
          _context7.n = 4;
          break;
        }
        _context7.n = 3;
        return navigator.clipboard.writeText(text);
      case 3:
        _context7.n = 5;
        break;
      case 4:
        ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', 'readonly');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand && document.execCommand('copy');
        ta.remove();
        if (ok) {
          _context7.n = 5;
          break;
        }
        throw new Error('clipboard_unavailable');
      case 5:
        if (btn) {
          btn.textContent = 'Phasen-Log kopiert';
          setTimeout(() => {
            btn.textContent = oldText || 'Phasen-Log';
          }, 1400);
        }
        _context7.n = 7;
        break;
      case 6:
        _context7.p = 6;
        _t5 = _context7.v;
        if (btn) {
          btn.textContent = 'Fehler';
          setTimeout(() => {
            btn.textContent = oldText || 'Phasen-Log';
          }, 1400);
        }
        throw _t5;
      case 7:
        return _context7.a(2);
    }
  }, _callee7, null, [[1, 6]]);
}));
window.vpClearObstacleRollingCache = function () {
  try {
    localStorage.removeItem(VP_OBS_POOL_STORAGE_KEY);
    localStorage.removeItem(VP_OBS_TILE_COVERAGE_KEY);
    localStorage.removeItem(VP_OBS_TILE_FAILED_KEY);
    localStorage.removeItem(VP_OVERPASS_STATE_STORAGE_KEY);
    var toDelete = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('ga_obs_combo_')) toDelete.push(k);
    }
    toDelete.forEach(k => localStorage.removeItem(k));
  } catch (_) {}
  try {
    vpObsPool.obs.clear();
    vpObsPool.lin.clear();
    vpObsTileCoverage.clear();
    vpObsTileFailed.clear();
    if (window.vpOverpassTileBackoff instanceof Map) window.vpOverpassTileBackoff.clear();
    window.vpFailedOverpassChunks = [];
    vpObstacles = [];
    vpLinearFeatures = [];
    window._lastObsRouteKey = null;
    window.vpOverpassRouteLastSuccess = {};
    if (window.vpSetObsTileDeferred) window.vpSetObsTileDeferred('__RESET__', false);
    if (window.updateOverpassErrorUI) window.updateOverpassErrorUI();
    if (window.vpNotifyObsTileCoverageChanged) window.vpNotifyObsTileCoverageChanged();
    window.vpBgNeedsUpdate = true;
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
  } catch (_) {}
  console.log('[Overpass] Rolling Cache geleert (Pool/Tiles/Failed/Route-Cache).');
};
window.vpToggleWeatherDebugPanel = function (forceState) {
  var panel = document.getElementById('weatherDebugPanel');
  if (!panel) return;
  var show = typeof forceState === 'boolean' ? forceState : panel.style.display === 'none' || !panel.style.display;
  panel.style.display = show ? 'block' : 'none';
  if (show) {
    window.vpUpdateObsTileOverlayButtonUi && window.vpUpdateObsTileOverlayButtonUi();
    window.updateMissionPipelineV2ButtonUi && window.updateMissionPipelineV2ButtonUi();
    window.updateMissionWriterModeButtonUi && window.updateMissionWriterModeButtonUi();
    window.updateOpenAipDataModeButtonUi && window.updateOpenAipDataModeButtonUi();
    window.missionDebugUpdateMotionProtectionButtonUi && window.missionDebugUpdateMotionProtectionButtonUi();
    window.vpRefreshWeatherDebugReport && window.vpRefreshWeatherDebugReport();
  }
};
if (!window.gaProfileDataProvider) vpInstallGlobalDebugHooks();
function vpCoverageToCloudType(coveragePct) {
  if (coveragePct >= 88) return 'OVC';
  if (coveragePct >= 62) return 'BKN';
  if (coveragePct >= 30) return 'SCT';
  return 'FEW';
}
function vpEstimateCloudBaseFtFromTempDewProfile() {
  var _parts$tempC, _parts$dewPointC, _parts$windKt, _parts$rhPct;
  var parts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var tempC = Number((_parts$tempC = parts.tempC) !== null && _parts$tempC !== void 0 ? _parts$tempC : parts.temp2mC);
  var dewC = Number((_parts$dewPointC = parts.dewPointC) !== null && _parts$dewPointC !== void 0 ? _parts$dewPointC : parts.dewPoint2mC);
  if (!Number.isFinite(tempC) || !Number.isFinite(dewC)) return null;
  var spreadC = Math.max(0, tempC - dewC);
  var windKtRaw = Number((_parts$windKt = parts.windKt) !== null && _parts$windKt !== void 0 ? _parts$windKt : parts.wind);
  var windKt = Number.isFinite(windKtRaw) ? Math.max(0, Math.min(30, windKtRaw)) : 0;
  var rh = Number((_parts$rhPct = parts.rhPct) !== null && _parts$rhPct !== void 0 ? _parts$rhPct : parts.rh2mPct);
  var windBoost = 1 + windKt / 30 * 0.85;
  if (Number.isFinite(rh)) {
    if (rh >= 97) windBoost -= 0.22;else if (rh >= 93) windBoost -= 0.12;else if (rh >= 88) windBoost -= 0.06;
  }
  windBoost = Math.max(1.0, Math.min(1.9, windBoost));
  var spreadWeight = spreadC <= 2.5 ? 1.0 : spreadC <= 4.0 ? 0.65 : 0.35;
  var effBoost = 1 + (windBoost - 1) * spreadWeight;
  return spreadC * 400 * effBoost;
}
function vpBuildTempDewCloudLayer() {
  var _parts$rhPct2, _parts$tempC2, _parts$dewPointC2;
  var parts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var baseAglRaw = vpEstimateCloudBaseFtFromTempDewProfile(parts);
  if (!Number.isFinite(baseAglRaw)) return null;
  var raw = String(parts.raw || '').toUpperCase();
  var fltCat = String(parts.fltCat || '').toUpperCase();
  var wxCode = Number(parts.weatherCode);
  var coveragePct = Number(parts.coveragePct);
  var lowCloudPct = Number(parts.lowCloudPct);
  var rh = Number((_parts$rhPct2 = parts.rhPct) !== null && _parts$rhPct2 !== void 0 ? _parts$rhPct2 : parts.rh2mPct);
  var tempC = Number((_parts$tempC2 = parts.tempC) !== null && _parts$tempC2 !== void 0 ? _parts$tempC2 : parts.temp2mC);
  var dewC = Number((_parts$dewPointC2 = parts.dewPointC) !== null && _parts$dewPointC2 !== void 0 ? _parts$dewPointC2 : parts.dewPoint2mC);
  var spreadC = Number.isFinite(tempC) && Number.isFinite(dewC) ? Math.max(0, tempC - dewC) : null;
  var hasPrecip = !!(parts.hasRain || parts.hasSnow || /\b(-|\+)?(RA|DZ|SN|SG|PL|SH|SHRA|SHSN)\b/i.test(raw));
  var hasFogMist = /\b(FG|BR|HZ|FU|MIFG|BCFG|PRFG|VCFG)\b/i.test(raw) || wxCode === 45 || wxCode === 48;
  var clearToken = /\b(CAVOK|NSC|SKC|CLR)\b/i.test(raw);
  var nonVfr = ['MVFR', 'IFR', 'LIFR'].includes(fltCat);
  var moist = Number.isFinite(rh) && rh >= 88 || Number.isFinite(spreadC) && spreadC <= 3.5;
  var cloudyCoverage = Number.isFinite(lowCloudPct) ? lowCloudPct >= 35 : Number.isFinite(coveragePct) && coveragePct >= 55;
  if (clearToken && !nonVfr && !hasPrecip && !hasFogMist) return null;
  if (!nonVfr && !hasPrecip && !hasFogMist && !cloudyCoverage && !moist) return null;
  var typeCoverage = Number.isFinite(lowCloudPct) ? lowCloudPct : Number.isFinite(coveragePct) ? coveragePct : null;
  if (!Number.isFinite(typeCoverage)) {
    if (fltCat === 'LIFR' || fltCat === 'IFR' || hasFogMist) typeCoverage = 88;else if (fltCat === 'MVFR' || hasPrecip) typeCoverage = 68;else if (moist) typeCoverage = 45;else typeCoverage = 30;
  }
  var terrainFt = Number(parts.terrainFt);
  var baseAgl = Math.round(Math.max(0, Math.min(15000, baseAglRaw)));
  var baseMsl = Math.round((Number.isFinite(terrainFt) ? terrainFt : 0) + baseAgl);
  return {
    type: vpCoverageToCloudType(typeCoverage),
    baseAgl,
    baseMsl,
    source: String(parts.source || 'temp_dew_spread'),
    estimated: true
  };
}
function vpBucketCloudForLevel(level, lowPct, midPct, highPct) {
  if (level >= 900) return lowPct;
  if (level >= 700) return midPct;
  return highPct;
}
function vpEstimatePressureLevelFt(levelHpa, mslPressureHpa) {
  var level = Number(levelHpa);
  if (!Number.isFinite(level) || level <= 0) return null;
  var p0 = Number.isFinite(mslPressureHpa) && mslPressureHpa > 700 && mslPressureHpa < 1085 ? mslPressureHpa : VP_STD_MSL_PRESSURE_HPA;
  var ratio = Math.max(0.0001, Math.min(1.2, level / p0));
  // ISA-Näherung: Hoehe der Druckfläche relativ zu lokalem MSL-Druck.
  var altFt = 145366.45 * (1 - Math.pow(ratio, 0.190284));
  return Math.max(0, Math.min(30000, altFt));
}
function vpInterpolateRoutePointAtDist(elevData, targetDist) {
  if (!elevData || elevData.length < 2) return null;
  for (var i = 0; i < elevData.length - 1; i++) {
    var a = elevData[i];
    var b = elevData[i + 1];
    if (targetDist < a.distNM || targetDist > b.distNM) continue;
    var seg = b.distNM - a.distNM || 1;
    var f = (targetDist - a.distNM) / seg;
    return {
      distNM: targetDist,
      lat: a.lat + (b.lat - a.lat) * f,
      lon: a.lon + (b.lon - a.lon) * f,
      elevFt: Math.round(a.elevFt + (b.elevFt - a.elevFt) * f)
    };
  }
  var last = elevData[elevData.length - 1];
  return {
    distNM: last.distNM,
    lat: last.lat,
    lon: last.lon,
    elevFt: last.elevFt
  };
}
function vpSampleRouteWeatherPoints(elevData) {
  var stepNM = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 5;
  if (!elevData || elevData.length < 2) return [];
  var totalDist = elevData[elevData.length - 1].distNM;
  if (totalDist <= 0) return [elevData[0]];

  // 5 NM Zielraster; harte Kappung für API/Render-Performance.
  var effStep = Math.max(2.5, stepNM);
  var maxPoints = 40;
  var idealCount = Math.floor(totalDist / effStep) + 1;
  if (idealCount > maxPoints) effStep = totalDist / (maxPoints - 1);
  var points = [];
  for (var d = 0; d <= totalDist + 0.01; d += effStep) {
    var pt = vpInterpolateRoutePointAtDist(elevData, Math.min(d, totalDist));
    if (pt) points.push(pt);
  }
  if (points.length === 0 || points[points.length - 1].distNM < totalDist - 0.1) {
    var last = elevData[elevData.length - 1];
    points.push({
      distNM: totalDist,
      lat: last.lat,
      lon: last.lon,
      elevFt: last.elevFt
    });
  }
  return points;
}
function vpQuantizeCoord(value, step) {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return value;
  return Math.round(value / step) * step;
}
function vpBuildOpenMeteoCacheKey(includePressure, lat, lon) {
  var step = includePressure ? VP_OM_COORD_STEP_PRESS : VP_OM_COORD_STEP_BASE;
  var latQ = vpQuantizeCoord(lat, step);
  var lonQ = vpQuantizeCoord(lon, step);
  return `${includePressure ? 'p4' : 'b4'}|${latQ.toFixed(3)}|${lonQ.toFixed(3)}`;
}
function vpHydrateOpenMeteoCache() {
  if (vpOmCacheHydrated) return;
  vpOmCacheHydrated = true;
  try {
    var raw = localStorage.getItem(VP_OM_CACHE_STORAGE_KEY);
    if (!raw) return;
    var payload = JSON.parse(raw);
    if (!payload || !Array.isArray(payload.entries)) return;
    var now = Date.now();
    var _iterator32 = _createForOfIteratorHelper(payload.entries),
      _step32;
    try {
      for (_iterator32.s(); !(_step32 = _iterator32.n()).done;) {
        var item = _step32.value;
        if (!item || typeof item.key !== 'string' || !item.data || !Number.isFinite(item.ts)) continue;
        if (now - item.ts > VP_OM_CACHE_TTL_MS) continue;
        vpOpenMeteoPointCache.set(item.key, {
          ts: item.ts,
          data: item.data
        });
      }
    } catch (err) {
      _iterator32.e(err);
    } finally {
      _iterator32.f();
    }
    if (window.vpWeatherDebug) {
      window.vpWeatherDebug.cacheHydratedEntries += vpOpenMeteoPointCache.size;
      vpWeatherDebugEvent(`cache hydrate: ${vpOpenMeteoPointCache.size} entries`);
    }
  } catch (e) {
    // still offline-first if cache payload is malformed
    if (window.vpWeatherDebug) window.vpWeatherDebug.cachePersistErrors += 1;
  }
}
function vpPruneOpenMeteoCache() {
  var now = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Date.now();
  var _iterator33 = _createForOfIteratorHelper(vpOpenMeteoPointCache.entries()),
    _step33;
  try {
    for (_iterator33.s(); !(_step33 = _iterator33.n()).done;) {
      var _step33$value = _slicedToArray(_step33.value, 2),
        k = _step33$value[0],
        v = _step33$value[1];
      if (!v || !Number.isFinite(v.ts) || now - v.ts > VP_OM_CACHE_TTL_MS) vpOpenMeteoPointCache.delete(k);
    }
  } catch (err) {
    _iterator33.e(err);
  } finally {
    _iterator33.f();
  }
  if (vpOpenMeteoPointCache.size <= VP_OM_CACHE_MAX_ENTRIES) return;
  var entries = Array.from(vpOpenMeteoPointCache.entries()).sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));
  var drop = vpOpenMeteoPointCache.size - VP_OM_CACHE_MAX_ENTRIES;
  for (var i = 0; i < drop; i++) vpOpenMeteoPointCache.delete(entries[i][0]);
}
function vpSchedulePersistOpenMeteoCache() {
  if (vpOmCachePersistTimer) return;
  vpOmCachePersistTimer = setTimeout(() => {
    vpOmCachePersistTimer = null;
    try {
      vpPruneOpenMeteoCache();
      var entries = Array.from(vpOpenMeteoPointCache.entries()).slice(-VP_OM_CACHE_MAX_ENTRIES).map(_ref28 => {
        var _ref29 = _slicedToArray(_ref28, 2),
          key = _ref29[0],
          v = _ref29[1];
        return {
          key,
          ts: v.ts,
          data: v.data
        };
      });
      localStorage.setItem(VP_OM_CACHE_STORAGE_KEY, JSON.stringify({
        ts: Date.now(),
        entries
      }));
      if (window.vpWeatherDebug) window.vpWeatherDebug.cachePersistWrites += 1;
    } catch (e) {
      // localStorage may be full or blocked; continue with in-memory cache only
      if (window.vpWeatherDebug) {
        window.vpWeatherDebug.cachePersistErrors += 1;
        vpWeatherDebugSetError(e, 'cache persist');
      }
    }
  }, 1200);
}
function vpGetNearestHourlyIndex(hourlyTimes) {
  if (!Array.isArray(hourlyTimes) || hourlyTimes.length === 0) return 0;
  var now = Math.floor(Date.now() / 1000);
  var bestIdx = 0;
  var bestDiff = Infinity;
  for (var i = 0; i < hourlyTimes.length; i++) {
    var t = Number(hourlyTimes[i]);
    if (!Number.isFinite(t)) continue;
    var diff = Math.abs(t - now);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
  }
  return bestIdx;
}
function vpGetHourlyAt(hourly, key, idx) {
  if (!hourly || !Array.isArray(hourly[key])) return null;
  var v = Number(hourly[key][idx]);
  return Number.isFinite(v) ? v : null;
}
function vpFetchOpenMeteoPoint(_x25, _x26) {
  return _vpFetchOpenMeteoPoint.apply(this, arguments);
}
function _vpFetchOpenMeteoPoint() {
  _vpFetchOpenMeteoPoint = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee30(lat, lon) {
    var _ref46,
      signal,
      _ref46$includePressur,
      includePressure,
      cacheKey,
      keyParts,
      latQ,
      lonQ,
      now,
      cached,
      inFlight,
      loadPromise,
      _args36 = arguments;
    return _regenerator().w(function (_context36) {
      while (1) switch (_context36.p = _context36.n) {
        case 0:
          _ref46 = _args36.length > 2 && _args36[2] !== undefined ? _args36[2] : {}, signal = _ref46.signal, _ref46$includePressur = _ref46.includePressure, includePressure = _ref46$includePressur === void 0 ? false : _ref46$includePressur;
          if (!(!Number.isFinite(lat) || !Number.isFinite(lon))) {
            _context36.n = 1;
            break;
          }
          return _context36.a(2, null);
        case 1:
          vpHydrateOpenMeteoCache();
          cacheKey = vpBuildOpenMeteoCacheKey(includePressure, lat, lon);
          keyParts = cacheKey.split('|');
          latQ = Number(keyParts[1]);
          lonQ = Number(keyParts[2]);
          now = Date.now();
          vpPruneOpenMeteoCache(now);
          cached = vpOpenMeteoPointCache.get(cacheKey);
          if (!(cached && now - cached.ts < VP_OM_CACHE_TTL_MS)) {
            _context36.n = 2;
            break;
          }
          if (window.vpWeatherDebug) window.vpWeatherDebug.openMeteoCacheHits += 1;
          return _context36.a(2, cached.data);
        case 2:
          if (!vpIsOpenMeteoCoolingDown(now)) {
            _context36.n = 4;
            break;
          }
          if (!(cached && now - cached.ts < VP_OM_STALE_CACHE_TTL_MS)) {
            _context36.n = 3;
            break;
          }
          if (window.vpWeatherDebug) {
            window.vpWeatherDebug.openMeteoCacheHits += 1;
            window.vpWeatherDebug.openMeteoStaleCacheHits += 1;
          }
          return _context36.a(2, cached.data);
        case 3:
          if (window.vpWeatherDebug) window.vpWeatherDebug.openMeteoCooldownSkips += 1;
          return _context36.a(2, null);
        case 4:
          if (window.vpWeatherDebug) window.vpWeatherDebug.openMeteoCacheMisses += 1;
          inFlight = vpOpenMeteoPointInFlight.get(cacheKey);
          if (!inFlight) {
            _context36.n = 5;
            break;
          }
          if (window.vpWeatherDebug) window.vpWeatherDebug.openMeteoCacheHits += 1;
          return _context36.a(2, inFlight);
        case 5:
          loadPromise = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee29() {
            var _vpGetHourlyAt, _vpGetHourlyAt2, _vpGetHourlyAt3, _vpGetHourlyAt4, _vpGetHourlyAt7, _vpGetHourlyAt8, _vpGetHourlyAt9, _vpGetHourlyAt0, _vpGetHourlyAt1;
            var hourlyVars, url, res, _window$vpRecordOpenM, _window3, data, idx, lowPct, midPct, highPct, totalCloudPct, mslPressureHpa, pressureAnomalyFt, pressureProfile, _iterator86, _step86, _vpGetHourlyAt5, _vpGetHourlyAt6, level, geoM, cloudLevel, wsLevel, wdLevel, mslEstimatedFt, geopotentialFt, sample;
            return _regenerator().w(function (_context35) {
              while (1) switch (_context35.n) {
                case 0:
                  hourlyVars = ['pressure_msl', 'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high', 'precipitation', 'rain', 'snowfall', 'wind_speed_10m', 'wind_direction_10m', 'temperature_2m', 'dew_point_2m', 'relative_humidity_2m', 'visibility', 'weather_code'];
                  if (includePressure) {
                    VP_OM_PRESSURE_LEVELS.forEach(level => {
                      hourlyVars.push(`geopotential_height_${level}hPa`);
                      hourlyVars.push(`cloud_cover_${level}hPa`);
                      hourlyVars.push(`wind_speed_${level}hPa`);
                      hourlyVars.push(`wind_direction_${level}hPa`);
                    });
                  }
                  url = `https://api.open-meteo.com/v1/forecast?latitude=${latQ}&longitude=${lonQ}&hourly=${encodeURIComponent(hourlyVars.join(','))}&forecast_hours=6&models=best_match&wind_speed_unit=kn&timeformat=unixtime&timezone=UTC`;
                  if (window.vpWeatherDebug) window.vpWeatherDebug.openMeteoNetworkRequests += 1;
                  _context35.n = 1;
                  return vpFetchResource(url, {
                    signal
                  });
                case 1:
                  res = _context35.v;
                  if (res.ok) {
                    _context35.n = 3;
                    break;
                  }
                  if (!(res.status === 429)) {
                    _context35.n = 2;
                    break;
                  }
                  _context35.n = 2;
                  return (_window$vpRecordOpenM = (_window3 = window).vpRecordOpenMeteo429FromResponse) === null || _window$vpRecordOpenM === void 0 ? void 0 : _window$vpRecordOpenM.call(_window3, res, 'point forecast');
                case 2:
                  throw new Error(`Open-Meteo HTTP ${res.status}`);
                case 3:
                  _context35.n = 4;
                  return res.json();
                case 4:
                  data = _context35.v;
                  if (!(!data || !data.hourly || !Array.isArray(data.hourly.time))) {
                    _context35.n = 5;
                    break;
                  }
                  throw new Error('Open-Meteo hourly fehlt');
                case 5:
                  idx = vpGetNearestHourlyIndex(data.hourly.time);
                  lowPct = (_vpGetHourlyAt = vpGetHourlyAt(data.hourly, 'cloud_cover_low', idx)) !== null && _vpGetHourlyAt !== void 0 ? _vpGetHourlyAt : 0;
                  midPct = (_vpGetHourlyAt2 = vpGetHourlyAt(data.hourly, 'cloud_cover_mid', idx)) !== null && _vpGetHourlyAt2 !== void 0 ? _vpGetHourlyAt2 : 0;
                  highPct = (_vpGetHourlyAt3 = vpGetHourlyAt(data.hourly, 'cloud_cover_high', idx)) !== null && _vpGetHourlyAt3 !== void 0 ? _vpGetHourlyAt3 : 0;
                  totalCloudPct = (_vpGetHourlyAt4 = vpGetHourlyAt(data.hourly, 'cloud_cover', idx)) !== null && _vpGetHourlyAt4 !== void 0 ? _vpGetHourlyAt4 : Math.max(lowPct, midPct, highPct);
                  mslPressureHpa = vpGetHourlyAt(data.hourly, 'pressure_msl', idx);
                  pressureAnomalyFt = Number.isFinite(mslPressureHpa) ? (VP_STD_MSL_PRESSURE_HPA - mslPressureHpa) * 27 : 0;
                  pressureProfile = [];
                  if (includePressure) {
                    _iterator86 = _createForOfIteratorHelper(VP_OM_PRESSURE_LEVELS);
                    try {
                      for (_iterator86.s(); !(_step86 = _iterator86.n()).done;) {
                        level = _step86.value;
                        geoM = vpGetHourlyAt(data.hourly, `geopotential_height_${level}hPa`, idx);
                        cloudLevel = vpGetHourlyAt(data.hourly, `cloud_cover_${level}hPa`, idx);
                        wsLevel = vpGetHourlyAt(data.hourly, `wind_speed_${level}hPa`, idx);
                        wdLevel = vpGetHourlyAt(data.hourly, `wind_direction_${level}hPa`, idx);
                        mslEstimatedFt = vpEstimatePressureLevelFt(level, mslPressureHpa);
                        geopotentialFt = void 0;
                        if (Number.isFinite(geoM)) {
                          // Modellhoehen behalten, aber mit lokalem Druckanomalie-Offset leicht regional variieren.
                          geopotentialFt = geoM * 3.28084 + pressureAnomalyFt * 0.75;
                        } else {
                          geopotentialFt = Number.isFinite(mslEstimatedFt) ? mslEstimatedFt : VP_OM_LEVEL_DEFAULT_FT[level];
                        }
                        geopotentialFt = Math.max(0, Math.min(30000, geopotentialFt));
                        pressureProfile.push({
                          hPa: level,
                          geopotentialFt: Number(geopotentialFt.toFixed(1)),
                          cloudPct: Math.max(0, Math.min(100, Number.isFinite(cloudLevel) ? cloudLevel : vpBucketCloudForLevel(level, lowPct, midPct, highPct))),
                          windKt: Math.max(0, Number.isFinite(wsLevel) ? wsLevel : (_vpGetHourlyAt5 = vpGetHourlyAt(data.hourly, 'wind_speed_10m', idx)) !== null && _vpGetHourlyAt5 !== void 0 ? _vpGetHourlyAt5 : 0),
                          windDirDeg: ((Number.isFinite(wdLevel) ? wdLevel : (_vpGetHourlyAt6 = vpGetHourlyAt(data.hourly, 'wind_direction_10m', idx)) !== null && _vpGetHourlyAt6 !== void 0 ? _vpGetHourlyAt6 : 0) + 360) % 360
                        });
                      }
                    } catch (err) {
                      _iterator86.e(err);
                    } finally {
                      _iterator86.f();
                    }
                    pressureProfile.sort((a, b) => a.geopotentialFt - b.geopotentialFt);
                  }
                  sample = {
                    lat: latQ,
                    lon: lonQ,
                    mslPressureHpa: mslPressureHpa,
                    cloudTotalPct: totalCloudPct,
                    cloudLowPct: lowPct,
                    cloudMidPct: midPct,
                    cloudHighPct: highPct,
                    cloudBaseM: null,
                    precipitationMm: (_vpGetHourlyAt7 = vpGetHourlyAt(data.hourly, 'precipitation', idx)) !== null && _vpGetHourlyAt7 !== void 0 ? _vpGetHourlyAt7 : 0,
                    rainMm: (_vpGetHourlyAt8 = vpGetHourlyAt(data.hourly, 'rain', idx)) !== null && _vpGetHourlyAt8 !== void 0 ? _vpGetHourlyAt8 : 0,
                    snowfallCm: (_vpGetHourlyAt9 = vpGetHourlyAt(data.hourly, 'snowfall', idx)) !== null && _vpGetHourlyAt9 !== void 0 ? _vpGetHourlyAt9 : 0,
                    wspd: (_vpGetHourlyAt0 = vpGetHourlyAt(data.hourly, 'wind_speed_10m', idx)) !== null && _vpGetHourlyAt0 !== void 0 ? _vpGetHourlyAt0 : 0,
                    wdir: (_vpGetHourlyAt1 = vpGetHourlyAt(data.hourly, 'wind_direction_10m', idx)) !== null && _vpGetHourlyAt1 !== void 0 ? _vpGetHourlyAt1 : 0,
                    temp2mC: vpGetHourlyAt(data.hourly, 'temperature_2m', idx),
                    dewPoint2mC: vpGetHourlyAt(data.hourly, 'dew_point_2m', idx),
                    rh2mPct: vpGetHourlyAt(data.hourly, 'relative_humidity_2m', idx),
                    visibilityM: vpGetHourlyAt(data.hourly, 'visibility', idx),
                    weatherCode: vpGetHourlyAt(data.hourly, 'weather_code', idx),
                    pressureProfile
                  };
                  vpOpenMeteoPointCache.set(cacheKey, {
                    ts: now,
                    data: sample
                  });
                  vpSchedulePersistOpenMeteoCache();
                  if (window.vpWeatherDebug) window.vpWeatherDebug.lastSuccessAt = Date.now();
                  return _context35.a(2, sample);
              }
            }, _callee29);
          }))();
          vpOpenMeteoPointInFlight.set(cacheKey, loadPromise);
          _context36.p = 6;
          _context36.n = 7;
          return loadPromise;
        case 7:
          return _context36.a(2, _context36.v);
        case 8:
          _context36.p = 8;
          vpOpenMeteoPointInFlight.delete(cacheKey);
          return _context36.f(8);
        case 9:
          return _context36.a(2);
      }
    }, _callee30, null, [[6,, 8, 9]]);
  }));
  return _vpFetchOpenMeteoPoint.apply(this, arguments);
}
window.fetchOpenMeteoWeatherPoints = /*#__PURE__*/function () {
  var _ref30 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee9(points) {
    var _ref31,
      signal,
      _ref31$includePressur,
      includePressure,
      _ref31$maxConcurrency,
      maxConcurrency,
      out,
      cursor,
      workers,
      limit,
      w,
      _args9 = arguments;
    return _regenerator().w(function (_context9) {
      while (1) switch (_context9.n) {
        case 0:
          _ref31 = _args9.length > 1 && _args9[1] !== undefined ? _args9[1] : {}, signal = _ref31.signal, _ref31$includePressur = _ref31.includePressure, includePressure = _ref31$includePressur === void 0 ? false : _ref31$includePressur, _ref31$maxConcurrency = _ref31.maxConcurrency, maxConcurrency = _ref31$maxConcurrency === void 0 ? 6 : _ref31$maxConcurrency;
          if (!(!Array.isArray(points) || points.length === 0)) {
            _context9.n = 1;
            break;
          }
          return _context9.a(2, []);
        case 1:
          if (window.vpWeatherDebug) {
            window.vpWeatherDebug.openMeteoBatchCalls += 1;
            window.vpWeatherDebug.openMeteoBatchPoints += points.length;
          }
          out = new Array(points.length);
          cursor = 0;
          workers = [];
          limit = Math.max(1, Math.min(maxConcurrency, points.length));
          for (w = 0; w < limit; w++) {
            workers.push(_asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee8() {
              var i, p, _t6;
              return _regenerator().w(function (_context8) {
                while (1) switch (_context8.p = _context8.n) {
                  case 0:
                    if (!true) {
                      _context8.n = 7;
                      break;
                    }
                    i = cursor++;
                    if (!(i >= points.length)) {
                      _context8.n = 1;
                      break;
                    }
                    return _context8.a(3, 7);
                  case 1:
                    if (!(signal && signal.aborted)) {
                      _context8.n = 2;
                      break;
                    }
                    throw new DOMException('Aborted', 'AbortError');
                  case 2:
                    _context8.p = 2;
                    p = points[i];
                    _context8.n = 3;
                    return vpFetchOpenMeteoPoint(p.lat, p.lon, {
                      signal,
                      includePressure
                    });
                  case 3:
                    out[i] = _context8.v;
                    _context8.n = 6;
                    break;
                  case 4:
                    _context8.p = 4;
                    _t6 = _context8.v;
                    if (!(_t6 && _t6.name === 'AbortError')) {
                      _context8.n = 5;
                      break;
                    }
                    throw _t6;
                  case 5:
                    vpWeatherDebugSetError(_t6, 'point fetch');
                    out[i] = null;
                  case 6:
                    _context8.n = 0;
                    break;
                  case 7:
                    return _context8.a(2);
                }
              }, _callee8, null, [[2, 4]]);
            }))());
          }
          _context9.n = 2;
          return Promise.all(workers);
        case 2:
          return _context9.a(2, out);
      }
    }, _callee9);
  }));
  return function (_x27) {
    return _ref30.apply(this, arguments);
  };
}();
function vpDeriveCloudLayersFromPressureProfile(pressureProfile) {
  var terrainFt = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
  if (!Array.isArray(pressureProfile) || pressureProfile.length === 0) return [];
  var pts = pressureProfile.filter(p => Number.isFinite(p.geopotentialFt) && Number.isFinite(p.cloudPct)).sort((a, b) => a.geopotentialFt - b.geopotentialFt);
  if (!pts.length) return [];
  var layers = [];
  var segStart = null;
  var segCover = [];
  for (var i = 0; i < pts.length; i++) {
    var p = pts[i];
    var cloudy = p.cloudPct >= 20;
    if (cloudy && !segStart) {
      segStart = {
        idx: i,
        baseFt: p.geopotentialFt
      };
      segCover = [p.cloudPct];
      continue;
    }
    if (cloudy && segStart) {
      segCover.push(p.cloudPct);
      continue;
    }
    if (!cloudy && segStart) {
      var topPt = pts[Math.max(segStart.idx, i - 1)];
      var avgCov = segCover.reduce((a, b) => a + b, 0) / Math.max(1, segCover.length);
      var baseMsl = Math.round(segStart.baseFt);
      var topMsl = Math.max(baseMsl + 400, Math.round(topPt.geopotentialFt));
      layers.push({
        type: vpCoverageToCloudType(avgCov),
        baseAgl: Math.max(0, baseMsl - terrainFt),
        baseMsl,
        topMsl
      });
      segStart = null;
      segCover = [];
    }
  }
  if (segStart) {
    var _topPt = pts[pts.length - 1];
    var _avgCov = segCover.reduce((a, b) => a + b, 0) / Math.max(1, segCover.length);
    var _baseMsl = Math.round(segStart.baseFt);
    var _topMsl = Math.max(_baseMsl + 400, Math.round(_topPt.geopotentialFt));
    layers.push({
      type: vpCoverageToCloudType(_avgCov),
      baseAgl: Math.max(0, _baseMsl - terrainFt),
      baseMsl: _baseMsl,
      topMsl: _topMsl
    });
  }
  return layers;
}
function fetchRouteWeatherOpenMeteo(_x28, _x29, _x30) {
  return _fetchRouteWeatherOpenMeteo.apply(this, arguments);
}
function _fetchRouteWeatherOpenMeteo() {
  _fetchRouteWeatherOpenMeteo = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee31(routePts, elevData, signal) {
    var sampled, samples, zones, _loop13, i;
    return _regenerator().w(function (_context38) {
      while (1) switch (_context38.n) {
        case 0:
          if (!(!routePts || routePts.length < 2 || !elevData || elevData.length < 2)) {
            _context38.n = 1;
            break;
          }
          return _context38.a(2, null);
        case 1:
          if (window.vpWeatherDebug) window.vpWeatherDebug.profileRouteFetches += 1;
          sampled = vpSampleRouteWeatherPoints(elevData, 5);
          if (!(!sampled || sampled.length < 3)) {
            _context38.n = 2;
            break;
          }
          return _context38.a(2, null);
        case 2:
          _context38.n = 3;
          return window.fetchOpenMeteoWeatherPoints(sampled, {
            signal,
            includePressure: true,
            maxConcurrency: 6
          });
        case 3:
          samples = _context38.v;
          if (!(signal && signal.aborted)) {
            _context38.n = 4;
            break;
          }
          throw new DOMException('Aborted', 'AbortError');
        case 4:
          zones = [];
          _loop13 = /*#__PURE__*/_regenerator().m(function _loop13() {
            var pt, sample, pressureProfile, clouds, lowestBase, hasRain, hasSnow, hasTS, estimatedCloud, visuals, c, d, cloudRef, fltCat;
            return _regenerator().w(function (_context37) {
              while (1) switch (_context37.n) {
                case 0:
                  pt = sampled[i];
                  sample = samples[i];
                  if (sample) {
                    _context37.n = 1;
                    break;
                  }
                  return _context37.a(2, 1);
                case 1:
                  pressureProfile = Array.isArray(sample.pressureProfile) ? sample.pressureProfile : [];
                  clouds = vpDeriveCloudLayersFromPressureProfile(pressureProfile, pt.elevFt || 0);
                  lowestBase = Infinity;
                  clouds.forEach(c => {
                    if (c.baseMsl < lowestBase) lowestBase = c.baseMsl;
                  });
                  hasRain = (sample.rainMm || 0) > 0.1 || (sample.precipitationMm || 0) > 0.25;
                  hasSnow = (sample.snowfallCm || 0) > 0.05;
                  hasTS = false;
                  estimatedCloud = vpBuildTempDewCloudLayer({
                    temp2mC: sample.temp2mC,
                    dewPoint2mC: sample.dewPoint2mC,
                    rh2mPct: sample.rh2mPct,
                    windKt: sample.wspd,
                    terrainFt: pt.elevFt || 0,
                    lowCloudPct: sample.cloudLowPct,
                    coveragePct: sample.cloudTotalPct,
                    weatherCode: sample.weatherCode,
                    hasRain,
                    hasSnow,
                    source: 'openmeteo_temp_dew'
                  });
                  if (estimatedCloud && (!Number.isFinite(lowestBase) || estimatedCloud.baseMsl < lowestBase - 500)) {
                    clouds.unshift(estimatedCloud);
                    lowestBase = estimatedCloud.baseMsl;
                  }
                  visuals = {
                    puffs: [],
                    drops: [],
                    flashes: []
                  };
                  if (clouds.length) for (c = 0; c < 25; c++) visuals.puffs.push({
                    x: Math.random(),
                    y: Math.random(),
                    r: Math.random(),
                    op: Math.random()
                  });
                  if (hasRain || hasSnow) for (d = 0; d < 110; d++) visuals.drops.push({
                    x: Math.random(),
                    y: Math.random(),
                    spd: Math.random()
                  });
                  cloudRef = Math.max(sample.cloudLowPct || 0, sample.cloudMidPct || 0, sample.cloudHighPct || 0);
                  fltCat = cloudRef > 85 ? 'IFR' : cloudRef > 65 ? 'MVFR' : 'VFR';
                  zones.push({
                    distNM: pt.distNM,
                    icao: `OM${String(i + 1).padStart(2, '0')}`,
                    stnDist: 0,
                    clouds,
                    lowestBase: lowestBase !== Infinity ? lowestBase : 5000,
                    weather: {
                      hasRain,
                      hasSnow,
                      hasTS
                    },
                    visuals,
                    stnLat: pt.lat,
                    stnLon: pt.lon,
                    fltCat: fltCat,
                    raw: `OPEN-METEO CLOUD ${Math.round(sample.cloudTotalPct || 0)}%`,
                    wdir: Math.round(sample.wdir || 0),
                    wspd: Math.round(sample.wspd || 0),
                    mslPressureHpa: sample.mslPressureHpa,
                    pressureProfile: pressureProfile,
                    wxSource: 'openmeteo'
                  });
                case 2:
                  return _context37.a(2);
              }
            }, _loop13);
          });
          i = 0;
        case 5:
          if (!(i < sampled.length)) {
            _context38.n = 8;
            break;
          }
          return _context38.d(_regeneratorValues(_loop13()), 6);
        case 6:
          if (!_context38.v) {
            _context38.n = 7;
            break;
          }
          return _context38.a(3, 7);
        case 7:
          i++;
          _context38.n = 5;
          break;
        case 8:
          if (!(zones.length < 3)) {
            _context38.n = 9;
            break;
          }
          return _context38.a(2, null);
        case 9:
          return _context38.a(2, zones);
      }
    }, _callee31);
  }));
  return _fetchRouteWeatherOpenMeteo.apply(this, arguments);
}
function fetchRouteWeather(_x31, _x32, _x33) {
  return _fetchRouteWeather.apply(this, arguments);
} // Globale Debug-Funktion für die Entwicklerkonsole
function _fetchRouteWeather() {
  _fetchRouteWeather = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee32(routePts, elevData, signal) {
    var options,
      source,
      autoFallback,
      metarRouteKey,
      _window$vpIsOpenMeteo2,
      _window5,
      _window$vpIsOpenMeteo,
      _window4,
      _metar,
      om,
      metar,
      now,
      cachedMetar,
      probeDue,
      recovered,
      omCd,
      metarData,
      metarInfraBlockedRecently,
      _om,
      _args39 = arguments,
      _t29,
      _t30,
      _t31,
      _t32,
      _t33;
    return _regenerator().w(function (_context39) {
      while (1) switch (_context39.p = _context39.n) {
        case 0:
          options = _args39.length > 3 && _args39[3] !== undefined ? _args39[3] : {};
          vpWeatherDebugEvent('fetchRouteWeather dispatch');
          source = String(options.source || window.vpWeatherSource || localStorage.getItem('ga_weather_source') || 'metar').toLowerCase() === 'openmeteo' ? 'openmeteo' : 'metar';
          autoFallback = typeof options.autoFallback === 'boolean' ? options.autoFallback : vpIsWeatherAutoFallbackEnabled();
          metarRouteKey = vpBuildMetarRouteCacheKey(routePts, elevData);
          if (!(source === 'openmeteo')) {
            _context39.n = 10;
            break;
          }
          if (!vpIsOpenMeteoCoolingDown()) {
            _context39.n = 2;
            break;
          }
          vpSetWeatherFallbackMode('openmeteo_to_metar', (_window$vpIsOpenMeteo = (_window4 = window).vpIsOpenMeteoDailyLimited) !== null && _window$vpIsOpenMeteo !== void 0 && _window$vpIsOpenMeteo.call(_window4) ? 'openmeteo daily limit' : 'openmeteo cooldown after 429');
          _context39.n = 1;
          return fetchRouteWeatherMetar(routePts, elevData, signal, {
            fastFail: false
          });
        case 1:
          _metar = _context39.v;
          if (Array.isArray(_metar) && _metar.length > 0) vpSetMetarRouteCache(metarRouteKey, _metar);
          return _context39.a(2, _metar);
        case 2:
          _context39.p = 2;
          _context39.n = 3;
          return fetchRouteWeatherOpenMeteo(routePts, elevData, signal);
        case 3:
          om = _context39.v;
          if (!vpHasUsableOpenMeteoRouteData(om)) {
            _context39.n = 4;
            break;
          }
          vpSetWeatherFallbackMode('none');
          return _context39.a(2, om);
        case 4:
          _context39.n = 7;
          break;
        case 5:
          _context39.p = 5;
          _t29 = _context39.v;
          if (!(_t29 && _t29.name === 'AbortError')) {
            _context39.n = 6;
            break;
          }
          throw _t29;
        case 6:
          console.warn('[Wetter] Open-Meteo fehlgeschlagen, Fallback auf METAR:', _t29);
          vpWeatherDebugSetError(_t29, 'openmeteo route');
        case 7:
          if (!(!autoFallback && !((_window$vpIsOpenMeteo2 = (_window5 = window).vpIsOpenMeteoDailyLimited) !== null && _window$vpIsOpenMeteo2 !== void 0 && _window$vpIsOpenMeteo2.call(_window5)))) {
            _context39.n = 8;
            break;
          }
          vpSetWeatherFallbackMode('none', 'auto fallback disabled');
          vpWeatherDebugEvent('OM failed/incomplete, no METAR fallback (auto fallback disabled)');
          return _context39.a(2, null);
        case 8:
          vpSetWeatherFallbackMode('openmeteo_to_metar', 'openmeteo failed/incomplete');
          _context39.n = 9;
          return fetchRouteWeatherMetar(routePts, elevData, signal, {
            fastFail: false
          });
        case 9:
          metar = _context39.v;
          if (Array.isArray(metar) && metar.length > 0) vpSetMetarRouteCache(metarRouteKey, metar);
          return _context39.a(2, metar);
        case 10:
          now = Date.now();
          cachedMetar = vpGetMetarRouteCache(metarRouteKey, now);
          if (!(Array.isArray(cachedMetar) && cachedMetar.length > 0)) {
            _context39.n = 11;
            break;
          }
          vpSetWeatherFallbackMode('none');
          return _context39.a(2, cachedMetar);
        case 11:
          if (!vpIsMetarCoolingDown(now)) {
            _context39.n = 25;
            break;
          }
          if (autoFallback) {
            _context39.n = 12;
            break;
          }
          vpSetWeatherFallbackMode('none', 'auto fallback disabled');
          vpWeatherDebugEvent('METAR cooldown, no OM fallback (auto fallback disabled)');
          return _context39.a(2, null);
        case 12:
          probeDue = now - Number(window.vpMetarRecoveryProbeAt || 0) >= VP_METAR_RECOVERY_PROBE_MS;
          if (!probeDue) {
            _context39.n = 18;
            break;
          }
          window.vpMetarRecoveryProbeAt = now;
          _context39.p = 13;
          _context39.n = 14;
          return vpProbeMetarRecovery(routePts, elevData, signal);
        case 14:
          recovered = _context39.v;
          if (recovered) {
            vpClearMetarFailure();
            vpSetWeatherFallbackMode('none', 'metar recovered');
          } else {
            vpSetWeatherFallbackMode('metar_to_openmeteo', 'metar cooldown active');
          }
          _context39.n = 17;
          break;
        case 15:
          _context39.p = 15;
          _t30 = _context39.v;
          if (!(_t30 && _t30.name === 'AbortError')) {
            _context39.n = 16;
            break;
          }
          throw _t30;
        case 16:
          vpSetWeatherFallbackMode('metar_to_openmeteo', 'metar cooldown active');
        case 17:
          _context39.n = 19;
          break;
        case 18:
          vpSetWeatherFallbackMode('metar_to_openmeteo', 'metar cooldown active');
        case 19:
          if (vpIsOpenMeteoCoolingDown(now)) {
            _context39.n = 25;
            break;
          }
          _context39.p = 20;
          _context39.n = 21;
          return fetchRouteWeatherOpenMeteo(routePts, elevData, signal);
        case 21:
          omCd = _context39.v;
          if (!vpHasUsableOpenMeteoRouteData(omCd)) {
            _context39.n = 22;
            break;
          }
          return _context39.a(2, omCd);
        case 22:
          _context39.n = 25;
          break;
        case 23:
          _context39.p = 23;
          _t31 = _context39.v;
          if (!(_t31 && _t31.name === 'AbortError')) {
            _context39.n = 24;
            break;
          }
          throw _t31;
        case 24:
          vpWeatherDebugSetError(_t31, 'metar cooldown openmeteo fallback');
        case 25:
          metarData = null;
          _context39.p = 26;
          _context39.n = 27;
          return fetchRouteWeatherMetar(routePts, elevData, signal, {
            fastFail: true
          });
        case 27:
          metarData = _context39.v;
          _context39.n = 30;
          break;
        case 28:
          _context39.p = 28;
          _t32 = _context39.v;
          if (!(_t32 && _t32.name === 'AbortError')) {
            _context39.n = 29;
            break;
          }
          throw _t32;
        case 29:
          vpWeatherDebugSetError(_t32, 'metar route');
        case 30:
          if (!(Array.isArray(metarData) && metarData.length > 0)) {
            _context39.n = 31;
            break;
          }
          if (window.vpWeatherAutoFallbackFrom === 'metar') window.vpWeatherAutoFallbackFrom = null;
          vpClearMetarFailure();
          vpSetMetarRouteCache(metarRouteKey, metarData);
          vpSetWeatherFallbackMode('none');
          return _context39.a(2, metarData);
        case 31:
          if (autoFallback) {
            _context39.n = 32;
            break;
          }
          vpSetWeatherFallbackMode('none', 'auto fallback disabled');
          vpWeatherDebugEvent('METAR failed, no OM fallback (auto fallback disabled)');
          return _context39.a(2, metarData);
        case 32:
          metarInfraBlockedRecently = Date.now() - Number(window.vpMetarLastInfraBlockAt || 0) < 20 * 1000;
          vpMarkMetarFailure(metarInfraBlockedRecently ? 'metar infra blocked' : 'metar unavailable', metarInfraBlockedRecently ? VP_METAR_FAIL_COOLDOWN_SOFT_MS : VP_METAR_FAIL_COOLDOWN_MS);
          vpWeatherDebugEvent('METAR leer/failed -> versuche Open-Meteo Fallback');
          try {
            console.warn('[Wetter] METAR fehlgeschlagen, versuche Open-Meteo Fallback...');
          } catch (_) {}
          if (vpIsOpenMeteoCoolingDown()) {
            _context39.n = 39;
            break;
          }
          _context39.p = 33;
          _context39.n = 34;
          return fetchRouteWeatherOpenMeteo(routePts, elevData, signal);
        case 34:
          _om = _context39.v;
          if (!vpHasUsableOpenMeteoRouteData(_om)) {
            _context39.n = 35;
            break;
          }
          window.vpWeatherAutoFallbackFrom = 'metar';
          vpSetWeatherFallbackMode('metar_to_openmeteo', 'metar unavailable');
          vpWeatherDebugEvent('METAR -> OPEN-METEO auto fallback aktiv');
          return _context39.a(2, _om);
        case 35:
          vpWeatherDebugEvent('Open-Meteo Fallback lieferte keine verwertbaren Zonen');
          _context39.n = 38;
          break;
        case 36:
          _context39.p = 36;
          _t33 = _context39.v;
          if (!(_t33 && _t33.name === 'AbortError')) {
            _context39.n = 37;
            break;
          }
          throw _t33;
        case 37:
          vpWeatherDebugSetError(_t33, 'metar fallback openmeteo route');
        case 38:
          _context39.n = 40;
          break;
        case 39:
          vpWeatherDebugEvent('Open-Meteo Fallback wegen Cooldown/Tageslimit uebersprungen');
        case 40:
          vpSetWeatherFallbackMode('metar_to_openmeteo', 'metar unavailable');
          return _context39.a(2, metarData);
      }
    }, _callee32, null, [[33, 36], [26, 28], [20, 23], [13, 15], [2, 5]]);
  }));
  return _fetchRouteWeather.apply(this, arguments);
}
window.debugCloudProfile = function () {
  console.log("=== MANUELLER CLOUD DEBUG START ===");
  if (!routeWaypoints || routeWaypoints.length < 2) {
    console.warn("Bitte erst einen Flugauftrag generieren (Route fehlt).");
    return;
  }
  triggerVerticalProfileUpdate();
  console.log("Update angetriggert. Bitte das Profil-Canvas öffnen und die Logs beobachten.");
};
function vpDrawTerrainCover(ctx, xOf, yOf, elevData, viewMinX, viewMaxX, zoomFactor, maxAlt) {
  if (!elevData || elevData.length < 2) return;
  ctx.save();
  var prng = s => {
    var x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };

  // 1. WÄLDER (Dunkelgrüne Tannenzacken)
  ctx.fillStyle = '#1c3614';
  ctx.beginPath();
  for (var i = 0; i < elevData.length - 1; i++) {
    var p1 = elevData[i];
    var p2 = elevData[i + 1];
    var startX = xOf(p1.distNM);
    var endX = xOf(p2.distNM);
    if (endX < viewMinX || startX > viewMaxX) continue;
    var dist = p2.distNM - p1.distNM;
    if (dist === 0) continue;
    var slope = Math.abs(p2.elevFt - p1.elevFt) / dist;
    var isForest = p1.elevFt > 200 && p1.elevFt < 4500 && (slope > 80 || prng(i) > 0.5);
    if (isForest) {
      // PERFORMANCE & OPTIK FIX: Verhindert den "Blob" beim Rauszoomen
      var pixelDist = endX - startX;
      var maxTrees = Math.max(1, Math.floor(pixelDist / 6)); // Max 1 Baum alle 6 Pixel
      var numTrees = Math.min(Math.max(1, Math.floor(dist * 15)), maxTrees);
      for (var t = 0; t < numTrees; t++) {
        var seed = i * 100 + t;
        if (prng(seed + 0.1) > 0.7) continue;
        var f = t / numTrees;
        var tx = startX + f * (endX - startX);
        var altFt = p1.elevFt + f * (p2.elevFt - p1.elevFt);
        var ty = yOf(altFt);

        // Bäume skalieren sanft runter, bleiben aber knackig
        var scale = Math.min(1, zoomFactor / 2.5);
        var treeHeight = Math.max(3, (5 + prng(seed + 0.2) * 8) * scale);
        var treeWidth = Math.max(2, (4 + prng(seed + 0.3) * 4) * scale);
        ctx.moveTo(tx - treeWidth / 2, ty + 2);
        ctx.lineTo(tx, ty - treeHeight);
        ctx.lineTo(tx + treeWidth / 2, ty + 2);
      }
    }
  }
  ctx.fill();

  // 2. ECHTE FLÜSSE UND AUTOBAHNEN (Linear Features aus Overpass / HDG-Korridor)
  // Im HDG-Modus: vpHdgLinearFeatures (entlang Heading gefiltert), sonst Route-Daten
  var _linRaw = vpMode === 'HDG' && typeof vpHdgLinearFeatures !== 'undefined' && vpHdgLinearFeatures.length > 0 ? vpHdgLinearFeatures : typeof vpLinearFeatures !== 'undefined' ? vpLinearFeatures : [];
  var majorRoadRx = /\b(A|B)\s?\d+\b/i;
  var isMajorRoadFeature = feat => {
    if (!feat || feat.type !== 'highway') return false;
    var kind = String(feat.lineKind || '').toLowerCase();
    if (kind === 'motorway' || kind === 'bundesstrasse') return true;
    var n = String(feat.name || '').trim();
    if (!n) return false;
    if (majorRoadRx.test(n)) return true; // Axx / Bxx
    var low = n.toLowerCase();
    return low.includes('autobahn') || low.includes('bundesstraße') || low.includes('bundesstrasse');
  };
  var isLinearTypeEnabled = feat => {
    if (!feat) return false;
    if (feat.type === 'highway') return !!vpShowRoads;
    if (feat.type === 'river') return !!vpShowRivers;
    if (feat.type === 'powerline') return !!vpShowPowerInfra;
    return false;
  };
  // Nähe-Clustering für überlappende Features: sauberer, weniger Clutter.
  var clusterLinearFeatures = arr => {
    var src = Array.isArray(arr) ? arr.slice().sort((a, b) => Number(a.distNM || 0) - Number(b.distNM || 0)) : [];
    var out = [];
    var i = 0;
    while (i < src.length) {
      var base = src[i];
      var type = String(base.type || '');
      var lineKind = String(base.lineKind || '');
      var thr = type === 'river' ? 0.8 : type === 'highway' ? 0.35 : 0.3;
      var sumDist = Number(base.distNM || 0);
      var sumLat = Number(base.lat || 0);
      var sumLon = Number(base.lon || 0);
      var cnt = 1;
      var bestName = String(base.name || '');
      var j = i + 1;
      while (j < src.length) {
        var cur = src[j];
        if (String(cur.type || '') !== type) break;
        if (String(cur.lineKind || '') !== lineKind) break;
        if (Math.abs(Number(cur.distNM || 0) - Number(src[j - 1].distNM || 0)) > thr) break;
        sumDist += Number(cur.distNM || 0);
        sumLat += Number(cur.lat || 0);
        sumLon += Number(cur.lon || 0);
        cnt++;
        if (!bestName && String(cur.name || '').trim()) bestName = String(cur.name || '');
        j++;
      }
      out.push(_objectSpread(_objectSpread({}, base), {}, {
        name: bestName || String(base.name || ''),
        distNM: sumDist / cnt,
        lat: sumLat / cnt,
        lon: sumLon / cnt,
        count: cnt
      }));
      i = j;
    }
    return out;
  };
  var _linSrc = [];
  var _iterator34 = _createForOfIteratorHelper(_linRaw),
    _step34;
  try {
    for (_iterator34.s(); !(_step34 = _iterator34.n()).done;) {
      var _feat3 = _step34.value;
      if (!isLinearTypeEnabled(_feat3)) continue;
      if (Number((_feat3 === null || _feat3 === void 0 ? void 0 : _feat3.lateralNM) || 999) > VP_LINEAR_ROUTE_CROSS_NM) continue;
      var _d2 = Number((_feat3 === null || _feat3 === void 0 ? void 0 : _feat3.distNM) || NaN);
      if (!Number.isFinite(_d2)) continue;
      var _px5 = xOf(_d2);
      if (_px5 < viewMinX - 80 || _px5 > viewMaxX + 80) continue;
      if (_feat3.type === 'highway' && !isMajorRoadFeature(_feat3)) continue;
      if (_feat3.type === 'river') {
        var n = String(_feat3.name || '').toLowerCase();
        if (n.includes('wassertret') || n.includes('kneipp') || n.includes('wasserspiel')) continue;
      }
      _linSrc.push(_feat3);
    }
  } catch (err) {
    _iterator34.e(err);
  } finally {
    _iterator34.f();
  }
  _linSrc = clusterLinearFeatures(_linSrc);
  if ((vpShowRoads || vpShowRivers || vpShowPowerInfra) && _linSrc.length > 0) {
    var _window$lastLiveGpsPo;
    var getElevY = dNM => {
      for (var _i4 = 0; _i4 < elevData.length - 1; _i4++) {
        if (dNM >= elevData[_i4].distNM && dNM <= elevData[_i4 + 1].distNM) {
          var _f2 = (dNM - elevData[_i4].distNM) / (elevData[_i4 + 1].distNM - elevData[_i4].distNM);
          return yOf(elevData[_i4].elevFt + _f2 * (elevData[_i4 + 1].elevFt - elevData[_i4].elevFt));
        }
      }
      return yOf(elevData[elevData.length - 1].elevFt);
    };

    // Declutter mit Prioritäten (ausgezoomt dynamisch reduzieren)
    var occupied = [];
    var reserveBox = (l, r, t, b, prio) => occupied.push({
      l,
      r,
      t,
      b,
      prio: Number(prio || 0)
    });
    var collidesWithHigher = (box, prio) => {
      for (var _i5 = 0, _occupied = occupied; _i5 < _occupied.length; _i5++) {
        var occ = _occupied[_i5];
        if (occ.prio >= prio && vpBoxesOverlap(box, occ, VP_DECLUTTER_COLLISION_PAD_PX)) return true;
      }
      return false;
    };

    // Blocker aus höchsten Prioritäten vorbereiten: Flugplätze > Städte > Windräder/hohe Türme > Strommasten
    if (Array.isArray(vpLandmarks) && vpLandmarks.length > 0) {
      var _iterator35 = _createForOfIteratorHelper(vpLandmarks),
        _step35;
      try {
        for (_iterator35.s(); !(_step35 = _iterator35.n()).done;) {
          var lm = _step35.value;
          var d = Number((lm === null || lm === void 0 ? void 0 : lm.distNM) || NaN);
          if (!Number.isFinite(d)) continue;
          var px = xOf(d);
          if (px < viewMinX - 80 || px > viewMaxX + 80) continue;
          var py = getElevY(d);
          var lt = String((lm === null || lm === void 0 ? void 0 : lm.type) || '').toLowerCase();
          var prio = lt === 'apt' ? 120 : lt === 'city' ? 110 : 102;
          reserveBox(px - 12, px + 12, py - 16, py + 14, prio);
        }
      } catch (err) {
        _iterator35.e(err);
      } finally {
        _iterator35.f();
      }
    }
    if (Array.isArray(vpObstacles) && vpObstacles.length > 0) {
      var _iterator36 = _createForOfIteratorHelper(deduplicateFeatures(vpObstacles)),
        _step36;
      try {
        for (_iterator36.s(); !(_step36 = _iterator36.n()).done;) {
          var obs = _step36.value;
          var _d = Number((obs === null || obs === void 0 ? void 0 : obs.distNM) || NaN);
          if (!Number.isFinite(_d)) continue;
          var _px = xOf(_d);
          if (_px < viewMinX - 80 || _px > viewMaxX + 80) continue;
          var _py = getElevY(_d);
          var _t7 = String((obs === null || obs === void 0 ? void 0 : obs.type) || '').toLowerCase();
          var h = Number((obs === null || obs === void 0 ? void 0 : obs.hFt) || 0);
          var _prio = 92; // hoher Turm
          if (_t7 === 'wind') _prio = 100;else if (_t7 === 'power_tower') _prio = 84;else if (h >= 700) _prio = 96;
          reserveBox(_px - 8, _px + 8, _py - 18, _py + 10, _prio);
        }
      } catch (err) {
        _iterator36.e(err);
      } finally {
        _iterator36.f();
      }
    }
    var linCandidates = _linSrc.slice().sort((a, b) => {
      var pa = vpLinearPriority(a);
      var pb = vpLinearPriority(b);
      if (pb !== pa) return pb - pa;
      return Number(a.distNM || 0) - Number(b.distNM || 0);
    });
    var _linRender = [];
    var _iterator37 = _createForOfIteratorHelper(linCandidates),
      _step37;
    try {
      for (_iterator37.s(); !(_step37 = _iterator37.n()).done;) {
        var _feat2 = _step37.value;
        var type = String((_feat2 === null || _feat2 === void 0 ? void 0 : _feat2.type) || '').toLowerCase();
        var _prio2 = vpLinearPriority(_feat2);
        var _px4 = xOf(Number((_feat2 === null || _feat2 === void 0 ? void 0 : _feat2.distNM) || 0));
        var _py4 = getElevY(Number((_feat2 === null || _feat2 === void 0 ? void 0 : _feat2.distNM) || 0));
        if (_px4 < viewMinX - 50 || _px4 > viewMaxX + 50) continue;
        var boxHalfW = type === 'river' ? 6 : type === 'highway' ? 5 : 7;
        var boxHalfH = type === 'river' ? 5 : type === 'highway' ? 4 : 6;
        var box = {
          l: _px4 - boxHalfW,
          r: _px4 + boxHalfW,
          t: _py4 - boxHalfH,
          b: _py4 + boxHalfH
        };
        if (collidesWithHigher(box, _prio2)) continue;
        _linRender.push(_feat2);
        reserveBox(box.l, box.r, box.t, box.b, _prio2);
      }

      // PERFORMANCE FIX: Layout nur 1x pro Zoom-Stufe, maxAlt UND aktueller Route berechnen!
    } catch (err) {
      _iterator37.e(err);
    } finally {
      _iterator37.f();
    }
    var routeKey = window._lastVpRouteKey || 'none';
    // Im HDG-Modus: Cache-Key enthält Heading → wird bei Kursänderung invalidiert
    var layoutKey = vpMode === 'HDG' ? 'hdg_lin_' + (((_window$lastLiveGpsPo = window.lastLiveGpsPos) === null || _window$lastLiveGpsPo === void 0 ? void 0 : _window$lastLiveGpsPo.hdg) || 0).toFixed(0) + '_' + zoomFactor.toFixed(2) : routeKey + '_' + zoomFactor.toFixed(2) + '_' + (maxAlt || 0).toFixed(0);

    // Neu berechnen, wenn sich der Cache-Key ändert ODER die Features noch keine Render-Daten haben
    if (!window._vpLinearLayouts || window._vpLinearLayouts.key !== layoutKey || _linRender.length > 0 && !_linRender[0]._render) {
      var occupiedSigns = [];
      var _iterator38 = _createForOfIteratorHelper(_linRender),
        _step38;
      try {
        for (_iterator38.s(); !(_step38 = _iterator38.n()).done;) {
          var feat = _step38.value;
          var _px2 = xOf(feat.distNM);
          var _py2 = getElevY(feat.distNM);
          feat._render = {
            px: _px2,
            py: _py2,
            drawName: false,
            labelY: 0,
            tw: 0
          };
          if (feat.name && zoomFactor >= 1.2 && feat.type !== 'powerline') {
            ctx.font = gaEfbProfileFont(feat.type === 'river' ? 'bold 8px Arial' : 'bold 7px Arial');
            var tw = ctx.measureText(feat.name).width;
            feat._render.tw = tw;
            var labelY = feat.type === 'river' ? _py2 + 15 : feat.type === 'powerline' ? _py2 - 20 : _py2 - 14;
            var collision = true,
              attempts = 0;
            while (collision && attempts < 4) {
              collision = false;
              var _iterator39 = _createForOfIteratorHelper(occupiedSigns),
                _step39;
              try {
                for (_iterator39.s(); !(_step39 = _iterator39.n()).done;) {
                  var occ = _step39.value;
                  if (_px2 - tw / 2 - 3 < occ.r && _px2 + tw / 2 + 3 > occ.l && labelY < occ.b && labelY + 10 > occ.t) {
                    collision = true;
                    break;
                  }
                }
              } catch (err) {
                _iterator39.e(err);
              } finally {
                _iterator39.f();
              }
              if (collision) {
                labelY += feat.type === 'river' ? 10 : -12;
                attempts++;
              }
            }
            if (!collision) {
              occupiedSigns.push({
                l: _px2 - tw / 2 - 2,
                r: _px2 + tw / 2 + 2,
                t: labelY,
                b: labelY + 10
              });
              feat._render.drawName = true;
              // FIX: Wir merken uns nur den Pixel-Abstand zum Boden, nicht die absolute Höhe!
              feat._render.labelYOffset = labelY - _py2;
            }
          }
        }
      } catch (err) {
        _iterator38.e(err);
      } finally {
        _iterator38.f();
      }
      window._vpLinearLayouts = {
        key: layoutKey,
        occ: occupiedSigns
      };
      window.vpLinearOccupied = occupiedSigns;
    }

    // NUR NOCH ZEICHNEN (mit weichem Culling)
    for (var _i6 = 0, _linRender2 = _linRender; _i6 < _linRender2.length; _i6++) {
      var _feat = _linRender2[_i6];
      if (!_feat._render) continue;

      // FIX: X und Y live berechnen, damit Schilder mit der Bodenlinie wandern
      var _px3 = xOf(_feat.distNM);
      var _py3 = getElevY(_feat.distNM);
      if (_px3 < viewMinX - 50 || _px3 > viewMaxX + 50) continue;
      if (_feat.type === 'river') {
        if (VP_PROFILE_LINEAR_ICON_STYLE === 'r2f1') {
          // F1+: Doppelwelle mit "eingeschnittenem" Unterzug fürs Terrain-Gefühl
          ctx.strokeStyle = 'rgba(8, 34, 68, 0.42)';
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(_px3 - 7.3, _py3 + 4.2);
          ctx.quadraticCurveTo(_px3 - 5.8, _py3 + 2.6, _px3 - 4.4, _py3 + 4.2);
          ctx.quadraticCurveTo(_px3 - 3.0, _py3 + 5.8, _px3 - 1.6, _py3 + 4.2);
          ctx.quadraticCurveTo(_px3 - 0.2, _py3 + 2.6, _px3 + 1.2, _py3 + 4.2);
          ctx.quadraticCurveTo(_px3 + 2.6, _py3 + 5.8, _px3 + 4.0, _py3 + 4.2);
          ctx.quadraticCurveTo(_px3 + 5.4, _py3 + 2.6, _px3 + 7.1, _py3 + 4.2);
          ctx.stroke();

          // Hauptwasserlauf
          ctx.strokeStyle = '#61b6ff';
          ctx.lineWidth = 1.25;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(_px3 - 7.2, _py3 + 0.4);
          ctx.quadraticCurveTo(_px3 - 5.8, _py3 - 1.2, _px3 - 4.4, _py3 + 0.4);
          ctx.quadraticCurveTo(_px3 - 3.0, _py3 + 2.0, _px3 - 1.6, _py3 + 0.4);
          ctx.quadraticCurveTo(_px3 - 0.2, _py3 - 1.2, _px3 + 1.2, _py3 + 0.4);
          ctx.quadraticCurveTo(_px3 + 2.6, _py3 + 2.0, _px3 + 4.0, _py3 + 0.4);
          ctx.quadraticCurveTo(_px3 + 5.4, _py3 - 1.2, _px3 + 7.0, _py3 + 0.4);
          ctx.stroke();
          ctx.strokeStyle = '#c8ebff';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(_px3 - 7.2, _py3 + 2.8);
          ctx.quadraticCurveTo(_px3 - 5.8, _py3 + 1.3, _px3 - 4.4, _py3 + 2.8);
          ctx.quadraticCurveTo(_px3 - 3.0, _py3 + 4.3, _px3 - 1.6, _py3 + 2.8);
          ctx.quadraticCurveTo(_px3 - 0.2, _py3 + 1.3, _px3 + 1.2, _py3 + 2.8);
          ctx.quadraticCurveTo(_px3 + 2.6, _py3 + 4.3, _px3 + 4.0, _py3 + 2.8);
          ctx.quadraticCurveTo(_px3 + 5.4, _py3 + 1.3, _px3 + 7.0, _py3 + 2.8);
          ctx.stroke();
        } else {
          // legacy river icon
          ctx.fillStyle = '#3498db';
          ctx.beginPath();
          ctx.moveTo(_px3 - 4, _py3 - 1);
          ctx.lineTo(_px3 - 2, _py3 + 5);
          ctx.lineTo(_px3 + 2, _py3 + 5);
          ctx.lineTo(_px3 + 4, _py3 - 1);
          ctx.fill();
        }
        if (_feat._render.drawName) {
          var _labelY = _py3 + _feat._render.labelYOffset;
          ctx.fillStyle = '#3498db';
          ctx.font = gaEfbProfileFont('bold 8px Arial');
          ctx.textAlign = 'center';
          gaEfbCanvasFillText(ctx, _feat.name, _px3, _labelY + 8);
        }
      } else if (_feat.type === 'highway') {
        if (VP_PROFILE_LINEAR_ICON_STYLE === 'r2f1') {
          // R2: Double-Lane hell
          ctx.strokeStyle = '#cfd6e5';
          ctx.lineWidth = 1.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(_px3 - 7.2, _py3 - 1.2);
          ctx.lineTo(_px3 + 7.2, _py3 - 1.2);
          ctx.stroke();
          ctx.strokeStyle = '#aeb9cf';
          ctx.beginPath();
          ctx.moveTo(_px3 - 7.2, _py3 + 1.8);
          ctx.lineTo(_px3 + 7.2, _py3 + 1.8);
          ctx.stroke();
          ctx.strokeStyle = '#fff2be';
          ctx.lineWidth = 0.95;
          ctx.beginPath();
          ctx.moveTo(_px3 - 3.8, _py3 + 0.3);
          ctx.lineTo(_px3 - 2.1, _py3 + 0.3);
          ctx.moveTo(_px3 - 0.8, _py3 + 0.3);
          ctx.lineTo(_px3 + 0.9, _py3 + 0.3);
          ctx.moveTo(_px3 + 2.2, _py3 + 0.3);
          ctx.lineTo(_px3 + 3.9, _py3 + 0.3);
          ctx.stroke();
        } else {
          // legacy road icon
          ctx.fillStyle = '#555';
          ctx.fillRect(_px3 - 3, _py3 - 2, 6, 4);
          ctx.fillStyle = '#f2c12e';
          ctx.fillRect(_px3 - 1, _py3 - 1, 2, 2);
        }
        if (_feat._render.drawName) {
          var _labelY2 = _py3 + _feat._render.labelYOffset;
          ctx.fillStyle = '#1a73e8';
          ctx.fillRect(_px3 - _feat._render.tw / 2 - 2, _labelY2, _feat._render.tw + 4, 10);
          ctx.fillStyle = '#fff';
          ctx.font = gaEfbProfileFont('bold 7px Arial');
          ctx.textAlign = 'center';
          gaEfbCanvasFillText(ctx, _feat.name, _px3, _labelY2 + 8);
        }
      } else if (_feat.type === 'powerline') {
        var lineKind = String(_feat.lineKind || '').toLowerCase();
        var isCable = lineKind === 'cable';
        var isMajor = lineKind === 'line' || !lineKind && VP_PROFILE_LINEAR_ICON_STYLE === 'r2f1';
        if (isCable) {
          // Kabel: eher schlank/diskret, ohne hohe Masten
          ctx.strokeStyle = 'rgba(198, 228, 255, 0.9)';
          ctx.lineWidth = 1.0;
          ctx.setLineDash([2.2, 1.8]);
          ctx.beginPath();
          ctx.moveTo(_px3 - 8.2, _py3 - 1.6);
          ctx.quadraticCurveTo(_px3, _py3 + 1.6, _px3 + 8.2, _py3 - 1.6);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(236, 246, 255, 0.9)';
          ctx.beginPath();
          ctx.arc(_px3, _py3 + 0.4, 0.9, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Freileitung: major/minor visuell unterscheiden
          var poleH = isMajor ? 8 : 6.6;
          var wireY = isMajor ? -4.8 : -3.8;
          var sagY = isMajor ? 0.8 : 0.4;
          var poleStroke = isMajor ? 'rgba(220, 236, 255, 0.96)' : 'rgba(190, 222, 248, 0.92)';
          var wireStroke = isMajor ? 'rgba(240, 248, 255, 0.96)' : 'rgba(211, 235, 255, 0.9)';
          var boltStroke = isMajor ? '#ffd85f' : '#bfe7ff';
          ctx.strokeStyle = poleStroke;
          ctx.lineWidth = isMajor ? 1.05 : 0.95;
          ctx.beginPath();
          ctx.moveTo(_px3 - 8, _py3 + 8);
          ctx.lineTo(_px3 - 8, _py3 - poleH);
          ctx.moveTo(_px3 + 8, _py3 + 8);
          ctx.lineTo(_px3 + 8, _py3 - poleH);
          ctx.stroke();
          ctx.strokeStyle = wireStroke;
          ctx.lineWidth = isMajor ? 1.1 : 0.95;
          ctx.beginPath();
          ctx.moveTo(_px3 - 7.6, _py3 + wireY);
          ctx.quadraticCurveTo(_px3, _py3 + sagY, _px3 + 7.6, _py3 + wireY);
          if (isMajor) {
            ctx.moveTo(_px3 - 7.1, _py3 + wireY - 1.6);
            ctx.quadraticCurveTo(_px3, _py3 + sagY - 1.6, _px3 + 7.1, _py3 + wireY - 1.6);
          }
          ctx.stroke();
          ctx.strokeStyle = boltStroke;
          ctx.lineWidth = 1;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(_px3 + 0.5, _py3 - 3.4);
          ctx.lineTo(_px3 - 1.1, _py3 + 0.2);
          ctx.lineTo(_px3 + 1.4, _py3 + 0.2);
          ctx.lineTo(_px3 - 0.2, _py3 + 4.1);
          ctx.stroke();
        }
        if (_feat._render.drawName) {
          var _labelY3 = _py3 + _feat._render.labelYOffset;
          ctx.fillStyle = '#7d2632';
          ctx.fillRect(_px3 - _feat._render.tw / 2 - 2, _labelY3, _feat._render.tw + 4, 10);
          ctx.fillStyle = '#fff';
          ctx.font = gaEfbProfileFont('bold 7px Arial');
          ctx.textAlign = 'center';
          gaEfbCanvasFillText(ctx, _feat.name, _px3, _labelY3 + 8);
        }
      }
      if (Number(_feat.count || 1) > 1) {
        ctx.fillStyle = 'rgba(236, 239, 244, 0.95)';
        ctx.font = gaEfbProfileFont('bold 8px Arial');
        ctx.textAlign = 'center';
        gaEfbCanvasFillText(ctx, '×' + String(_feat.count), _px3, _py3 + 12);
      }
    }
  }
  ctx.restore();
}
function vpDrawLandmarks(ctx, xOf, yOf, elevData, totalDist, isDarkTheme, zoomFactor, maxAlt) {
  var _window$lastLiveGpsPo2;
  var lmOverride = arguments.length > 8 && arguments[8] !== undefined ? arguments[8] : null;
  var _landmarks = lmOverride !== null ? lmOverride : vpLandmarks;
  if (!_landmarks || _landmarks.length === 0) return;
  var lmPrio = lm => {
    var t = String((lm === null || lm === void 0 ? void 0 : lm.type) || '').toLowerCase();
    if (t === 'apt') return 3;
    if (t === 'city') return 2;
    return 1;
  };
  var lmOrdered = _landmarks.slice().sort((a, b) => {
    var dp = lmPrio(b) - lmPrio(a);
    if (dp) return dp;
    return Number((b === null || b === void 0 ? void 0 : b.pop) || 0) - Number((a === null || a === void 0 ? void 0 : a.pop) || 0);
  });
  var getElevY = dNM => {
    if (!elevData || elevData.length < 2) return yOf(0);
    for (var i = 0; i < elevData.length - 1; i++) {
      if (dNM >= elevData[i].distNM && dNM <= elevData[i + 1].distNM) {
        var f = (dNM - elevData[i].distNM) / (elevData[i + 1].distNM - elevData[i].distNM);
        return yOf(elevData[i].elevFt + f * (elevData[i + 1].elevFt - elevData[i].elevFt));
      }
    }
    return yOf(elevData[elevData.length - 1].elevFt);
  };

  // PERFORMANCE FIX: Kollisionen nur 1x pro Zoom-Stufe, maxAlt UND aktueller Route berechnen
  var routeKey = window._lastVpRouteKey || 'none';
  var layoutKey = routeKey + '_' + zoomFactor.toFixed(2) + '_' + (maxAlt || 0).toFixed(0) + '_' + (vpShowRoads ? 'R1' : 'R0') + '_' + (vpShowRivers ? 'V1' : 'V0') + '_' + (vpShowPowerInfra ? 'P1' : 'P0');

  // Im HDG-Modus: kein Layout-Cache, immer neu berechnen (distNM ändert sich mit Kurs)
  var isHdgLm = lmOverride !== null;
  var hdgLmKey = isHdgLm ? 'hdg_' + (((_window$lastLiveGpsPo2 = window.lastLiveGpsPos) === null || _window$lastLiveGpsPo2 === void 0 ? void 0 : _window$lastLiveGpsPo2.hdg) || 0).toFixed(0) + '_' + zoomFactor.toFixed(2) : null;
  var effectiveLayoutKey = isHdgLm ? hdgLmKey : layoutKey;
  if (!window._vpLandmarkLayouts || window._vpLandmarkLayouts.key !== effectiveLayoutKey || _landmarks.length > 0 && !_landmarks[0]._render) {
    var globalOccupiedX = [];
    var nmPerPx = totalDist / (xOf(totalDist) - xOf(0));
    var edgePad = Math.min(2.5, totalDist * 0.05);
    ctx.font = gaEfbProfileFont(`bold ${zoomFactor >= 1.5 ? 10 : 8}px Arial`); // Setup für measureText
    var _iterator40 = _createForOfIteratorHelper(lmOrdered),
      _step40;
    try {
      for (_iterator40.s(); !(_step40 = _iterator40.n()).done;) {
        var lm = _step40.value;
        lm._render = null;
        if (lm.distNM < edgePad || lm.distNM > totalDist - edgePad) continue;
        var px = xOf(lm.distNM);
        var icon = lm.type === 'apt' ? '🛫' : lm.type === 'city' ? '🏢' : '🏘️';
        var fontSize = zoomFactor >= 1.5 ? 10 : 8;
        var iconScale = 1.0;
        if (lm.type !== 'apt') {
          var p = Math.max(5000, Math.min(1000000, lm.pop || 5000));
          var logPop = Math.log10(p);
          var factor = (logPop - 3.7) / 2.3;
          iconScale = Math.min(zoomFactor >= 1.5 ? 2.5 : 1.5, 0.5 + Math.max(0, Math.min(1, factor)) * 2.0);
        } else iconScale = 1.2;
        var iconFontSize = Math.max(8, Math.round(11 * iconScale));
        var iconOffsetY = Math.round(iconFontSize * 0.55);
        var textWidth = ctx.measureText(lm.name).width;
        var reqWidth = Math.max(textWidth, iconFontSize + 4) + 6;
        var shiftAttempts = 0,
          currentDistNM = lm.distNM,
          currentPx = px,
          currentPy = getElevY(lm.distNM);
        var collision = true,
          finalMinX = void 0,
          finalMaxX = void 0;
        while (collision && shiftAttempts < 12) {
          collision = false;
          finalMinX = currentPx - reqWidth / 2;
          finalMaxX = currentPx + reqWidth / 2;
          var boxT = currentPy - iconOffsetY - iconFontSize;
          var boxB = currentPy + 20;
          var _iterator41 = _createForOfIteratorHelper(globalOccupiedX),
            _step41;
          try {
            for (_iterator41.s(); !(_step41 = _iterator41.n()).done;) {
              var _occ = _step41.value;
              if (finalMinX < _occ.maxX && finalMaxX > _occ.minX) {
                collision = true;
                break;
              }
            }
          } catch (err) {
            _iterator41.e(err);
          } finally {
            _iterator41.f();
          }
          if (!collision && window.vpLinearOccupied) {
            var _iterator42 = _createForOfIteratorHelper(window.vpLinearOccupied),
              _step42;
            try {
              for (_iterator42.s(); !(_step42 = _iterator42.n()).done;) {
                var occ = _step42.value;
                if (finalMinX < occ.r && finalMaxX > occ.l && boxT < occ.b && boxB > occ.t) {
                  collision = true;
                  break;
                }
              }
            } catch (err) {
              _iterator42.e(err);
            } finally {
              _iterator42.f();
            }
          }
          if (collision) {
            shiftAttempts++;
            var shiftPx = (shiftAttempts % 2 !== 0 ? -1 : 1) * Math.ceil(shiftAttempts / 2) * 8;
            currentDistNM = lm.distNM + shiftPx * nmPerPx;
            currentPx = xOf(currentDistNM);
            currentPy = getElevY(currentDistNM);
          }
        }
        if (!collision) {
          globalOccupiedX.push({
            minX: finalMinX,
            maxX: finalMaxX,
            t: currentPy - iconOffsetY - iconFontSize,
            b: currentPy + 20
          });
          // FIX: Wir cachen nur die Distanz (inkl. Ausweich-Shift), die Pixelhöhe wird im Render-Loop LIVE berechnet!
          lm._render = {
            distNM: currentDistNM,
            icon,
            iconFontSize,
            iconOffsetY,
            fontSize
          };
        }
      }
    } catch (err) {
      _iterator40.e(err);
    } finally {
      _iterator40.f();
    }
    window._vpLandmarkLayouts = {
      key: effectiveLayoutKey,
      occ: globalOccupiedX
    };
    window.vpLandmarkOccupiedX = globalOccupiedX;
  }

  // NUR NOCH ZEICHNEN (Schnell, ohne jegliche Kollisions-Logik)
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  var viewMinX = -Infinity,
    viewMaxX = Infinity;
  if (ctx.canvas && (ctx.canvas.id === 'mapProfileCanvasBg' || ctx.canvas.id === 'mapProfileCanvas')) {
    var sc = document.getElementById('mapProfileScroll');
    if (sc) {
      viewMinX = sc.scrollLeft - 100;
      viewMaxX = sc.scrollLeft + sc.clientWidth + 100;
    }
  }
  var _iterator43 = _createForOfIteratorHelper(lmOrdered),
    _step43;
  try {
    for (_iterator43.s(); !(_step43 = _iterator43.n()).done;) {
      var _lm = _step43.value;
      if (!_lm._render) continue;

      // FIX: X und Y Pixel in Echtzeit anhand der aktuellen Skalierung berechnen
      var _px6 = xOf(_lm._render.distNM);
      var py = getElevY(_lm._render.distNM);
      if (_px6 < viewMinX || _px6 > viewMaxX) continue;
      ctx.font = gaEfbProfileFont(_lm._render.iconFontSize + 'px Arial');
      ctx.fillStyle = '#ffffff';
      gaEfbCanvasFillText(ctx, _lm._render.icon, _px6, py - _lm._render.iconOffsetY);
      if (!window.vpIsFastRendering) {
        ctx.font = gaEfbProfileFont(`bold ${_lm._render.fontSize}px Arial`);
        ctx.fillStyle = isDarkTheme ? 'rgba(190, 180, 160, 0.7)' : 'rgba(70, 60, 40, 0.7)';
        gaEfbCanvasFillText(ctx, _lm.name, _px6, py + 10);
      }
    }
  } catch (err) {
    _iterator43.e(err);
  } finally {
    _iterator43.f();
  }
  ctx.restore();
}
function vpDrawObstacles(ctx, xOf, yOf, totalDist, zoomFactor, elevData) {
  var timeMs = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : 0;
  var obsOverride = arguments.length > 7 && arguments[7] !== undefined ? arguments[7] : null;
  if (obsOverride !== null) {
    var _orig = vpObstacles;
    vpObstacles = obsOverride;
    var r = vpDrawObstacles(ctx, xOf, yOf, totalDist, zoomFactor, elevData, timeMs, null);
    vpObstacles = _orig;
    return r;
  }
  if (!vpObstacles || vpObstacles.length === 0) return;
  var obsToDraw = deduplicateFeatures(vpObstacles);
  if (!obsToDraw.length) return;
  var edgePad = Math.min(1.0, totalDist * 0.02);
  var activeLin = vpMode === 'HDG' && Array.isArray(window.vpHdgLinearFeatures) && window.vpHdgLinearFeatures.length > 0 ? window.vpHdgLinearFeatures : Array.isArray(vpLinearFeatures) ? vpLinearFeatures : [];
  var isLikelyPowerTower = obs => {
    var t = String((obs === null || obs === void 0 ? void 0 : obs.type) || '').toLowerCase();
    if (t === 'power_tower') return true;
    if (!(t === 'mast' || t === 'tower')) return false;
    var oDist = Number((obs === null || obs === void 0 ? void 0 : obs.distNM) || NaN);
    var oLat = Number((obs === null || obs === void 0 ? void 0 : obs.lateralNM) || 999);
    if (!Number.isFinite(oDist)) return false;
    var _iterator44 = _createForOfIteratorHelper(activeLin),
      _step44;
    try {
      for (_iterator44.s(); !(_step44 = _iterator44.n()).done;) {
        var feat = _step44.value;
        if (String((feat === null || feat === void 0 ? void 0 : feat.type) || '').toLowerCase() !== 'powerline') continue;
        var fDist = Number((feat === null || feat === void 0 ? void 0 : feat.distNM) || NaN);
        var fLat = Number((feat === null || feat === void 0 ? void 0 : feat.lateralNM) || 999);
        if (!Number.isFinite(fDist)) continue;
        if (Math.abs(fDist - oDist) <= VP_POWERLINE_MAST_MATCH_DIST_NM && (oLat <= VP_POWERLINE_MAST_LATERAL_NM || fLat <= VP_POWERLINE_MAST_LATERAL_NM)) {
          return true;
        }
      }
    } catch (err) {
      _iterator44.e(err);
    } finally {
      _iterator44.f();
    }
    return false;
  };
  var getElevY = dNM => {
    if (!elevData || elevData.length < 2) return yOf(0);
    var low = 0,
      high = elevData.length - 2;
    while (low <= high) {
      var mid = low + high >> 1;
      if (dNM < elevData[mid].distNM) high = mid - 1;else if (dNM > elevData[mid + 1].distNM) low = mid + 1;else {
        var p1 = elevData[mid],
          p2 = elevData[mid + 1];
        var f = (dNM - p1.distNM) / (p2.distNM - p1.distNM || 1);
        return yOf(p1.elevFt + f * (p2.elevFt - p1.elevFt));
      }
    }
    return yOf(elevData[elevData.length - 1].elevFt);
  };
  var viewMinX = -Infinity,
    viewMaxX = Infinity;
  if (ctx.canvas.id === 'mapProfileCanvas') {
    var sc = document.getElementById('mapProfileScroll');
    if (sc) {
      viewMinX = sc.scrollLeft - 200;
      viewMaxX = sc.scrollLeft + sc.clientWidth + 200;
    }
  }
  ctx.save();

  // 1. Alle Masten zeichnen und Label-Positionen sammeln
  var rawLabels = [];
  var _iterator45 = _createForOfIteratorHelper(obsToDraw),
    _step45;
  try {
    for (_iterator45.s(); !(_step45 = _iterator45.n()).done;) {
      var obs = _step45.value;
      if (obs.distNM < edgePad || obs.distNM > totalDist - edgePad) continue;
      if (!vpShowPowerInfra && String((obs === null || obs === void 0 ? void 0 : obs.type) || '').toLowerCase() === 'power_tower') continue;
      var _px7 = xOf(obs.distNM);
      if (_px7 < viewMinX || _px7 > viewMaxX) continue; // CULLING
      var pyGround = getElevY(obs.distNM);
      var trueHeightPx = Math.abs(yOf(obs.hFt) - yOf(0));

      // Der Mast steckt leicht im Boden (vorher tiefer), wirkt dadurch etwas höher aufgesetzt
      var pyRoot = pyGround + 6;
      if (obs.type === 'wind') {
        // FIX: Die "echte" sichtbare Länge ist die Höhe über Grund PLUS die 8px im Boden!
        var visualTotalHeight = trueHeightPx + 8;

        // Blätter sind jetzt immer ca. 45% des ECHTEN sichtbaren Mastes (mindestens 4px)
        var _r = Math.max(4, visualTotalHeight * 0.45);

        // Die Nabe sitzt so, dass das obere Blatt genau an der echten Spitze kratzt
        var pyTop = pyGround - trueHeightPx;
        var pyHub = pyTop + _r;
        ctx.beginPath();
        ctx.moveTo(_px7, pyRoot);
        ctx.lineTo(_px7, pyHub);
        ctx.strokeStyle = 'rgba(230, 230, 230, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#f5f5f5';
        ctx.strokeStyle = 'rgba(150, 150, 150, 0.6)';
        ctx.lineWidth = 0.5;
        var rotSpeed = 0.0015;
        var rotOffset = (obs.distNM * 137 + timeMs * rotSpeed) % (Math.PI * 2);
        for (var i = 0; i < 3; i++) {
          var a = rotOffset + (i * 120 - 90) * Math.PI / 180;
          ctx.beginPath();
          ctx.moveTo(_px7, pyHub);
          ctx.lineTo(_px7 + Math.cos(a - 0.2) * _r * 0.25, pyHub + Math.sin(a - 0.2) * _r * 0.25);
          ctx.lineTo(_px7 + Math.cos(a) * _r, pyHub + Math.sin(a) * _r);
          ctx.lineTo(_px7 + Math.cos(a + 0.2) * _r * 0.25, pyHub + Math.sin(a + 0.2) * _r * 0.25);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        // Nabe wächst proportional mit
        ctx.beginPath();
        ctx.arc(_px7, pyHub, Math.max(1.5, _r * 0.15), 0, Math.PI * 2);
        ctx.fillStyle = '#ccc';
        ctx.fill();
      } else {
        // Normale Masten/Türme: dynamisch skalieren wie Windrad-Symbolik,
        // aber bewusst nur 50% der visuellen Gesamtgröße.
        var _visualTotalHeight = trueHeightPx + 8;
        var obsType = String((obs === null || obs === void 0 ? void 0 : obs.type) || '').toLowerCase();
        var isPowerTower = obsType === 'power_tower' || isLikelyPowerTower(obs);
        var mastVisualHeight = isPowerTower ? Math.max(10, _visualTotalHeight * 0.75) : Math.max(7, _visualTotalHeight * 0.5);
        var _pyTop = pyRoot - mastVisualHeight;
        if (isPowerTower) {
          // A3: technischer Strommast (ohne Bodenstrich)
          var halfW = Math.max(2.8, mastVisualHeight * 0.17);
          var armYTop = _pyTop + Math.max(1.6, mastVisualHeight * 0.24);
          var armYMid = _pyTop + Math.max(3.0, mastVisualHeight * 0.5);
          var _pyBase = pyRoot - 0.8; // kein sichtbarer Bodenstrich
          ctx.strokeStyle = 'rgba(214, 228, 245, 0.98)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(_px7 - halfW, _pyBase);
          ctx.lineTo(_px7 - 0.9, _pyTop);
          ctx.moveTo(_px7 + halfW, _pyBase);
          ctx.lineTo(_px7 + 0.9, _pyTop);
          ctx.moveTo(_px7 - halfW * 1.02, armYTop);
          ctx.lineTo(_px7 + halfW * 1.02, armYTop);
          ctx.moveTo(_px7 - halfW * 0.72, armYMid);
          ctx.lineTo(_px7 + halfW * 0.72, armYMid);
          ctx.moveTo(_px7 - halfW * 0.9, armYTop);
          ctx.lineTo(_px7 - halfW * 1.22, armYTop + 1.1);
          ctx.moveTo(_px7 + halfW * 0.9, armYTop);
          ctx.lineTo(_px7 + halfW * 1.22, armYTop + 1.1);
          ctx.stroke();
        } else {
          // A1: allgemeiner Turm/Mast (feines Gitter)
          var _halfW = Math.max(2.5, mastVisualHeight * 0.16);
          var armY1 = _pyTop + Math.max(1.6, mastVisualHeight * 0.26);
          var armY2 = _pyTop + Math.max(2.8, mastVisualHeight * 0.52);
          var armY3 = _pyTop + Math.max(3.8, mastVisualHeight * 0.75);
          ctx.strokeStyle = 'rgba(220, 236, 255, 0.96)';
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(_px7 - _halfW, pyRoot);
          ctx.lineTo(_px7, _pyTop);
          ctx.moveTo(_px7 + _halfW, pyRoot);
          ctx.lineTo(_px7, _pyTop);
          ctx.moveTo(_px7 - _halfW * 0.72, armY1);
          ctx.lineTo(_px7 + _halfW * 0.72, armY1);
          ctx.moveTo(_px7 - _halfW * 0.55, armY2);
          ctx.lineTo(_px7 + _halfW * 0.55, armY2);
          ctx.moveTo(_px7 - _halfW * 0.42, armY3);
          ctx.lineTo(_px7 + _halfW * 0.42, armY3);
          ctx.stroke();
        }

        // ANIMATION: Blinklicht – Strommast etwas amber, sonst rot.
        var blink = 0.3 + 0.6 * (Math.sin(timeMs * 0.005 + obs.distNM * 50) * 0.5 + 0.5);
        var beaconR = Math.max(2, mastVisualHeight * 0.16);
        var beaconColor = isPowerTower ? `rgba(255, 170, 70, ${blink})` : `rgba(217, 56, 41, ${blink})`;
        ctx.beginPath();
        ctx.arc(_px7, _pyTop, beaconR, 0, Math.PI * 2);
        ctx.fillStyle = beaconColor;
        ctx.fill();
      }
      rawLabels.push({
        x: _px7,
        yBase: pyRoot,
        count: obs.count || 1
      });
    }
  } catch (err) {
    _iterator45.e(err);
  } finally {
    _iterator45.f();
  }
  if (window.vpIsFastRendering) {
    ctx.restore();
    return;
  } // Performance-Culling

  // 2. Labels abhängig vom Zoom/Pixelabstand clustern
  rawLabels.sort((a, b) => a.x - b.x);
  var clusters = [];
  var MIN_LABEL_DIST = 16;
  for (var _i7 = 0, _rawLabels = rawLabels; _i7 < _rawLabels.length; _i7++) {
    var lbl = _rawLabels[_i7];
    if (clusters.length === 0) {
      clusters.push({
        sumX: lbl.x,
        sumY: lbl.yBase,
        count: lbl.count,
        items: 1
      });
    } else {
      var last = clusters[clusters.length - 1];
      var avgX = last.sumX / last.items;
      if (lbl.x - avgX < MIN_LABEL_DIST) {
        last.sumX += lbl.x;
        last.sumY += lbl.yBase;
        last.count += lbl.count;
        last.items += 1;
      } else {
        clusters.push({
          sumX: lbl.x,
          sumY: lbl.yBase,
          count: lbl.count,
          items: 1
        });
      }
    }
  }

  // 3. Cluster-Labels zeichnen (ohne Schatten, reine Schrift)
  ctx.fillStyle = '#d93829';
  ctx.font = gaEfbProfileFont('bold 8px Arial');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (var _i8 = 0, _clusters = clusters; _i8 < _clusters.length; _i8++) {
    var cl = _clusters[_i8];
    if (cl.count <= 1) continue;
    var px = cl.sumX / cl.items;
    var pyBase = cl.sumY / cl.items;
    var collision = false;
    var textWidth = 18;
    var minX = px - textWidth / 2;
    var maxX = px + textWidth / 2;
    if (window.vpLandmarkOccupiedX) {
      var _iterator46 = _createForOfIteratorHelper(window.vpLandmarkOccupiedX),
        _step46;
      try {
        for (_iterator46.s(); !(_step46 = _iterator46.n()).done;) {
          var occ = _step46.value;
          if (minX < occ.maxX + 2 && maxX > occ.minX - 2) {
            collision = true;
            break;
          }
        }
      } catch (err) {
        _iterator46.e(err);
      } finally {
        _iterator46.f();
      }
    }
    if (!collision) {
      gaEfbCanvasFillText(ctx, '×' + cl.count, px, pyBase + 2);
    }
  }
  ctx.restore();
}
function vpDrawClouds(ctx, xOf, yOf, padTop, plotH, totalDist, isDarkTheme, elevData) {
  if (!vpWeatherData || vpWeatherData.length === 0) return;
  var getElevY = dNM => {
    if (!elevData || elevData.length < 2) return yOf(0);
    for (var i = 0; i < elevData.length - 1; i++) {
      if (dNM >= elevData[i].distNM && dNM <= elevData[i + 1].distNM) {
        var f = (dNM - elevData[i].distNM) / (elevData[i + 1].distNM - elevData[i].distNM);
        return yOf(elevData[i].elevFt + f * (elevData[i + 1].elevFt - elevData[i].elevFt));
      }
    }
    return yOf(elevData[elevData.length - 1].elevFt);
  };

  // KEIN Culling für Layer 1 (Wird nativ von der GPU gescrollt)
  var viewMinX = -Infinity,
    viewMaxX = Infinity;
  // Stabiler, deterministischer Pseudo-Zufallsgenerator gegen Flackern
  var prng = s => {
    var x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };
  ctx.save();
  var _loop = function _loop(i) {
    var zone = vpWeatherData[i];
    var prevDist = i > 0 ? (zone.distNM + vpWeatherData[i - 1].distNM) / 2 : Math.max(0, zone.distNM - totalDist * 0.05);
    var nextDist = i < vpWeatherData.length - 1 ? (zone.distNM + vpWeatherData[i + 1].distNM) / 2 : Math.min(totalDist, zone.distNM + totalDist * 0.05);
    var startX = xOf(prevDist),
      endX = xOf(nextDist),
      width = endX - startX,
      midX = startX + width / 2;
    if (endX < viewMinX || startX > viewMaxX) return 1; // continue
    // CULLING
    // 3. WOLKEN (PUFFS) – Zoom-adaptiv, isolierte Zellen für FEW/SCT
    if (zone.clouds && zone.clouds.length > 0) {
      zone.clouds.forEach((c, cIdx) => {
        var baseY = yOf(c.baseMsl);
        var thicknessFt = 600,
          baseColor = isDarkTheme ? 210 : 255;
        var coverage = 1.0,
          radiusMult = 1.0,
          numCells = 4;
        // Logik für isolierte Grüppchen (mehr Zellen = kleinere Wölkchen)
        if (c.type === 'FEW') {
          thicknessFt = 800;
          coverage = 0.22;
          radiusMult = 0.35;
          numCells = 16;
        } else if (c.type === 'SCT') {
          thicknessFt = 1500;
          baseColor -= 15;
          coverage = 0.45;
          radiusMult = 0.6;
          numCells = 10;
        } else if (c.type === 'BKN') {
          thicknessFt = 3000;
          baseColor -= 40;
          coverage = 0.80;
          radiusMult = 0.9;
          numCells = 6;
        } else if (c.type === 'OVC' || c.type === 'VV') {
          thicknessFt = 5000;
          baseColor -= 70;
          coverage = 1.0;
        }
        if (zone.weather && zone.weather.hasTS) {
          thicknessFt = Math.max(thicknessFt, 12000);
          baseColor -= 60;
          coverage = 1.0;
          radiusMult = 1.1;
          numCells = 4;
        }
        if (Number.isFinite(c.topMsl) && c.topMsl > c.baseMsl + 150) thicknessFt = Math.max(400, c.topMsl - c.baseMsl);
        var topY = yOf(c.baseMsl + thicknessFt),
          layerHeight = baseY - topY;
        if (baseY < padTop - 20 || topY > padTop + plotH + 20) return;
        // Zoom-abhängige Skalierung: Beim Rauszoomen wird 'width' klein -> Wolken werden winzig!
        var maxRadiusY = Math.abs(yOf(1000) - yOf(0));
        var maxRadiusX = width * (2.5 / numCells);
        var maxR = Math.max(2, Math.min(maxRadiusY, maxRadiusX)) * radiusMult;
        var seedBase = i * 100 + cIdx * 10;
        ctx.save();
        ctx.beginPath();
        ctx.rect(startX - 2000, 0, width + 4000, baseY);
        ctx.clip();
        var numPuffs = c.type === 'FEW' ? 40 : 60;
        for (var p = 0; p < numPuffs; p++) {
          var pxRand = prng(seedBase + p + 0.1);
          var cellIndex = Math.floor(pxRand * numCells);
          var cellActive = prng(seedBase + cellIndex * 77) < coverage;
          if (!cellActive) continue;
          var localPx = pxRand;
          // Bei FEW/SCT zwingen wir die Puffs in die Mitte der Zelle (0.2 bis 0.8), um Gaps zu garantieren!
          if (c.type === 'FEW' || c.type === 'SCT') {
            var cellStart = cellIndex / numCells;
            var puffInCell = prng(seedBase + p + 0.5);
            localPx = cellStart + (0.2 + puffInCell * 0.6) / numCells;
          }
          var pyRand = prng(seedBase + p + 0.2);
          var prRand = prng(seedBase + p + 0.3);
          var opRand = prng(seedBase + p + 0.4);
          // OVC überlappt stark, FEW/SCT bleiben strikt in ihrer Zone
          var px = c.type === 'FEW' || c.type === 'SCT' ? startX + localPx * width : startX + (localPx * 1.2 - 0.1) * width;
          var py = baseY - pyRand * layerHeight;
          var pr = 2 + prRand * maxR;
          var cVal = Math.floor(baseColor - opRand * 30);
          var alpha = c.type === 'FEW' ? 0.15 + opRand * 0.2 : c.type === 'SCT' ? 0.3 + opRand * 0.3 : 0.5 + opRand * 0.4;
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${cVal},${cVal},${cVal},${alpha})`;

          // Performance-Fix: Weiche Ränder deaktivieren, während UI-Interaktion ODER Fast-Render-Modus aktiv ist!
          var isDragging = typeof vpDraggingWP !== 'undefined' && vpDraggingWP >= 0 || typeof vpDraggingSegment !== 'undefined' && !!vpDraggingSegment || typeof vpResizeActive !== 'undefined' && vpResizeActive || window.vpUIInteractionActive === true || window.vpIsFastRendering === true;
          if (!isDragging) {
            ctx.shadowColor = `rgba(${cVal},${cVal},${cVal},${alpha})`;
            ctx.shadowBlur = 4 + prRand * 8;
          } else {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
          }
          ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle = isDarkTheme ? '#ccc' : '#222';
        ctx.font = gaEfbProfileFont('bold 8px Arial');
        ctx.textAlign = 'center';
        gaEfbCanvasFillText(ctx, c.type, midX, baseY + 12);
      });
    }
  };
  for (var i = 0; i < vpWeatherData.length; i++) {
    if (_loop(i)) continue;
  }

  // METAR STATIONEN & GRENZEN BEI 16000 FT (Dezentes Debugging-Overlay)
  var lastIcao = null;
  var lastDist = 0;
  for (var _i9 = 0; _i9 < vpWeatherData.length; _i9++) {
    var zone = vpWeatherData[_i9];
    if (zone.icao !== lastIcao) {
      var bDist = _i9 === 0 ? 0 : (lastDist + zone.distNM) / 2;
      var bx = xOf(bDist);
      if (bx >= viewMinX - 100 && bx <= viewMaxX + 100) {
        ctx.beginPath();
        ctx.moveTo(bx, yOf(16500));
        ctx.lineTo(bx, yOf(15500));
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = gaEfbProfileFont('bold 9px Arial');
        ctx.textAlign = 'left';
        var distText = zone.stnDist !== undefined ? ` (${zone.stnDist} NM)` : '';
        gaEfbCanvasFillText(ctx, '📡 ' + zone.icao + distText, bx + 4, yOf(16000));
      }
      lastIcao = zone.icao;
    }
    lastDist = zone.distNM;
  }
  ctx.restore();
}
function vpGetCloudLayerProfile(cloudType, hasTS) {
  var profile = {
    thicknessFt: 1800,
    density: 0.55,
    topAlpha: 0.22,
    bottomAlpha: 0.36,
    ridgeStrength: 0.35
  };
  if (cloudType === 'FEW') {
    profile.thicknessFt = 900;
    profile.density = 0.32;
    profile.topAlpha = 0.12;
    profile.bottomAlpha = 0.2;
    profile.ridgeStrength = 0.22;
  } else if (cloudType === 'SCT') {
    profile.thicknessFt = 1700;
    profile.density = 0.46;
    profile.topAlpha = 0.16;
    profile.bottomAlpha = 0.28;
    profile.ridgeStrength = 0.3;
  } else if (cloudType === 'BKN') {
    profile.thicknessFt = 3200;
    profile.density = 0.72;
    profile.topAlpha = 0.2;
    profile.bottomAlpha = 0.42;
    profile.ridgeStrength = 0.4;
  } else if (cloudType === 'OVC' || cloudType === 'VV') {
    profile.thicknessFt = 5200;
    profile.density = 0.9;
    profile.topAlpha = 0.24;
    profile.bottomAlpha = 0.5;
    profile.ridgeStrength = 0.46;
  }
  if (hasTS) {
    profile.thicknessFt = Math.max(profile.thicknessFt, 12000);
    profile.density = Math.min(1, profile.density + 0.12);
    profile.topAlpha = Math.min(0.38, profile.topAlpha + 0.08);
    profile.bottomAlpha = Math.min(0.62, profile.bottomAlpha + 0.1);
    profile.ridgeStrength = Math.min(0.62, profile.ridgeStrength + 0.12);
  }
  return profile;
}
function vpRoundedRectPath(ctx, x, y, w, h, r) {
  var rr = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
function vpDrawCloudsPro(ctx, xOf, yOf, padTop, plotH, totalDist, isDarkTheme, elevData) {
  if (!vpWeatherData || vpWeatherData.length === 0) return;
  var prng = s => {
    var x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };
  var viewMinX = -Infinity;
  var viewMaxX = Infinity;
  ctx.save();
  for (var i = 0; i < vpWeatherData.length; i++) {
    var zone = vpWeatherData[i];
    var prevDist = i > 0 ? (zone.distNM + vpWeatherData[i - 1].distNM) / 2 : Math.max(0, zone.distNM - totalDist * 0.05);
    var nextDist = i < vpWeatherData.length - 1 ? (zone.distNM + vpWeatherData[i + 1].distNM) / 2 : Math.min(totalDist, zone.distNM + totalDist * 0.05);
    var startX = xOf(prevDist);
    var endX = xOf(nextDist);
    var width = endX - startX;
    var midX = startX + width / 2;
    if (width <= 1 || endX < viewMinX || startX > viewMaxX) continue;
    if (!zone.clouds || zone.clouds.length === 0) continue;
    var hasTS = !!(zone.weather && zone.weather.hasTS);
    for (var cIdx = 0; cIdx < zone.clouds.length; cIdx++) {
      var c = zone.clouds[cIdx];
      var profile = vpGetCloudLayerProfile(c.type, hasTS);
      var topFt = Number.isFinite(c.topMsl) && c.topMsl > c.baseMsl + 150 ? c.topMsl : c.baseMsl + profile.thicknessFt;
      var baseY = yOf(c.baseMsl);
      var topY = yOf(topFt);
      var layerTop = Math.min(baseY, topY);
      var layerBottom = Math.max(baseY, topY);
      var layerHeight = layerBottom - layerTop;
      if (layerBottom < padTop - 20 || layerTop > padTop + plotH + 20 || layerHeight < 2) continue;
      var left = startX - width * 0.04;
      var bandW = width * 1.08;
      var radius = Math.max(6, Math.min(16, Math.abs(yOf(500) - yOf(0)) * 0.65));
      var seed = (i + 1) * 103.7 + (cIdx + 1) * 71.9 + c.baseMsl * 0.001;
      var grayTop = Math.round((isDarkTheme ? 165 : 230) - profile.density * 28 - (hasTS ? 18 : 0));
      var grayBottom = Math.round((isDarkTheme ? 120 : 188) - profile.density * 35 - (hasTS ? 24 : 0));
      var grad = ctx.createLinearGradient(0, layerTop, 0, layerBottom);
      grad.addColorStop(0, `rgba(${grayTop},${grayTop},${grayTop},${profile.topAlpha})`);
      grad.addColorStop(0.45, `rgba(${grayTop - 8},${grayTop - 8},${grayTop - 8},${profile.topAlpha + 0.05})`);
      grad.addColorStop(1, `rgba(${grayBottom},${grayBottom},${grayBottom},${profile.bottomAlpha})`);
      vpRoundedRectPath(ctx, left, layerTop, bandW, layerHeight, radius);
      ctx.fillStyle = grad;
      ctx.fill();

      // Strukturierte Oberkante: klare Schichtkontur statt Blob-Rand
      var ridgeSteps = Math.max(8, Math.min(46, Math.round(bandW / 13)));
      ctx.beginPath();
      for (var s = 0; s <= ridgeSteps; s++) {
        var t = s / ridgeSteps;
        var x = left + t * bandW;
        var wave = Math.sin(t * (2.6 + profile.ridgeStrength) * Math.PI * 2 + seed) * (1.8 + layerHeight * 0.025);
        var noise = (prng(seed + s * 1.37) - 0.5) * (2.2 + layerHeight * 0.03);
        var y = layerTop + 2 + wave + noise;
        if (s === 0) ctx.moveTo(x, y);else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = isDarkTheme ? `rgba(240,245,255,${0.18 + profile.ridgeStrength * 0.22})` : `rgba(120,130,145,${0.16 + profile.ridgeStrength * 0.18})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Dezente Schichtstruktur innen
      var stripeCount = Math.max(1, Math.round(2 + profile.density * 2));
      for (var k = 1; k <= stripeCount; k++) {
        var sy = layerTop + layerHeight * k / (stripeCount + 1);
        var wobble = (prng(seed + k * 11.1) - 0.5) * 2.4;
        ctx.beginPath();
        ctx.moveTo(left + 4, sy + wobble);
        ctx.lineTo(left + bandW - 4, sy - wobble);
        ctx.strokeStyle = isDarkTheme ? `rgba(220,228,240,${0.06 + profile.density * 0.08})` : `rgba(95,105,122,${0.05 + profile.density * 0.07})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      if (width > 34) {
        var topFL = Math.round(topFt / 100);
        var baseFL = Math.round(c.baseMsl / 100);
        ctx.fillStyle = isDarkTheme ? 'rgba(205,215,230,0.82)' : 'rgba(35,42,52,0.78)';
        ctx.font = gaEfbProfileFont('bold 8px Arial');
        ctx.textAlign = 'center';
        gaEfbCanvasFillText(ctx, `${c.type} FL${baseFL}-${topFL}`, midX, Math.min(layerBottom + 12, padTop + plotH + 10));
      }
    }
  }
  ctx.restore();
}
function vpClipWeatherColumnToSky(ctx, startX, endX, prevDist, nextDist, getElevY) {
  var width = Math.max(1, endX - startX);
  var steps = Math.max(10, Math.min(48, Math.round(width / 12)));
  ctx.beginPath();
  ctx.moveTo(startX, -2000);
  ctx.lineTo(endX, -2000);
  for (var s = steps; s >= 0; s--) {
    var t = s / steps;
    var x = startX + t * width;
    var dNM = prevDist + t * (nextDist - prevDist);
    var gy = getElevY(dNM);
    ctx.lineTo(x, gy);
  }
  ctx.closePath();
  ctx.clip();
}
function vpDrawAnimatedWeather(ctx, xOf, yOf, totalDist, elevData, timeMs, viewMinX, viewMaxX) {
  if (!vpWeatherData || vpWeatherData.length === 0) return;
  var getElevY = dNM => {
    if (!elevData || elevData.length < 2) return yOf(0);
    var low = 0,
      high = elevData.length - 2;
    while (low <= high) {
      var mid = low + high >> 1;
      if (dNM < elevData[mid].distNM) high = mid - 1;else if (dNM > elevData[mid + 1].distNM) low = mid + 1;else {
        var p1 = elevData[mid],
          p2 = elevData[mid + 1];
        var f = (dNM - p1.distNM) / (p2.distNM - p1.distNM || 1);
        return yOf(p1.elevFt + f * (p2.elevFt - p1.elevFt));
      }
    }
    return yOf(elevData[elevData.length - 1].elevFt);
  };
  ctx.save();
  for (var i = 0; i < vpWeatherData.length; i++) {
    var zone = vpWeatherData[i];
    if (!zone.weather || !zone.weather.hasRain && !zone.weather.hasSnow && !zone.weather.hasTS) continue;
    var prevDist = i > 0 ? (zone.distNM + vpWeatherData[i - 1].distNM) / 2 : Math.max(0, zone.distNM - totalDist * 0.05);
    var nextDist = i < vpWeatherData.length - 1 ? (zone.distNM + vpWeatherData[i + 1].distNM) / 2 : Math.min(totalDist, zone.distNM + totalDist * 0.05);
    var startX = xOf(prevDist);
    var endX = xOf(nextDist);
    var width = endX - startX;
    if (endX < viewMinX || startX > viewMaxX) continue; // CULLING

    var baseY = yOf(zone.lowestBase);

    // 1. REGEN & SCHNEE ANIMIERT
    if ((zone.weather.hasRain || zone.weather.hasSnow) && zone.visuals && zone.visuals.drops) {
      // Niederschlag hinter Gelände halten, damit Tropfen am Boden "enden".
      ctx.save();
      vpClipWeatherColumnToSky(ctx, startX, endX, prevDist, nextDist, getElevY);
      ctx.beginPath();

      // FIX: Virtuelles Fall-Band (von ganz oben nach ganz unten auf dem Bildschirm)
      var virtualTop = -100;
      var virtualBottom = 500;
      var virtualFallDist = virtualBottom - virtualTop;
      for (var d = 0; d < zone.visuals.drops.length; d++) {
        var drop = zone.visuals.drops[d];
        var dropX = startX + drop.x * width;
        var dNM = prevDist + drop.x * (nextDist - prevDist);
        var groundY = getElevY(dNM);
        if (baseY >= groundY) continue;

        // Unabhängige, konstante Fall-Animation
        var speed = zone.weather.hasSnow ? 0.01 + drop.spd * 0.01 : 0.05 + drop.spd * 0.03;
        var currentYOffset = (drop.y * virtualFallDist + timeMs * speed) % virtualFallDist;
        var sy = virtualTop + currentYOffset;

        // CULLING: Tropfen nur zeichnen, wenn er sich zwischen Wolke und Boden befindet!
        if (sy < baseY || sy > groundY) continue;
        if (zone.weather.hasSnow) {
          var sway = Math.sin(timeMs * 0.002 + d) * 4 * drop.spd;
          var snowDrift = currentYOffset * 0.15;
          var rawSx = dropX + sway - snowDrift;
          // FIX: Zwingt den Schnee durch Modulo-Wrap immer in der exakten Stations-Breite (Zone) zu bleiben!
          var sx = startX + ((rawSx - startX) % width + width) % width;
          ctx.moveTo(sx, sy);
          ctx.arc(sx, sy, 0.8 + drop.spd, 0, Math.PI * 2);
        } else {
          var tailLength = 6 + drop.spd * 8;
          var windSlant = 2 + drop.spd * 4;
          var driftRatio = windSlant / tailLength;
          var rawX = dropX - currentYOffset * driftRatio;
          // FIX: Zwingt den Regen durch Modulo-Wrap immer in der exakten Stations-Breite (Zone) zu bleiben!
          var currentX = startX + ((rawX - startX) % width + width) % width;
          ctx.moveTo(currentX, sy);
          ctx.lineTo(currentX - windSlant, sy + tailLength);
        }
      }
      ctx.fillStyle = zone.weather.hasSnow ? 'rgba(255,255,255,0.8)' : 'rgba(120, 180, 255, 0.6)';
      ctx.strokeStyle = zone.weather.hasSnow ? 'rgba(255,255,255,0.8)' : 'rgba(100, 160, 255, 0.5)';
      ctx.lineWidth = zone.weather.hasSnow ? 1 : 1.5;
      if (zone.weather.hasSnow) ctx.fill();else ctx.stroke();
      ctx.restore();
    }

    // 2. BLITZE ANIMIERT
    if (zone.weather.hasTS && zone.visuals && zone.visuals.flashes) {
      var flashCycle = timeMs % 5000; // Ein Blitz-Zyklus dauert 5 Sekunden
      var hasActiveFlash = false;
      ctx.beginPath();
      for (var f = 0; f < zone.visuals.flashes.length; f++) {
        var flash = zone.visuals.flashes[f];
        var flashTimeStart = flash.x * 4500; // Zufälliger Start im Zyklus

        // Blitz leuchtet für knackige 120ms
        if (flashCycle > flashTimeStart && flashCycle < flashTimeStart + 120) {
          hasActiveFlash = true;
          var fx = startX + width * 0.2 + flash.x * width * 0.6;
          var _groundY = getElevY(prevDist + flash.x * (nextDist - prevDist));
          if (baseY < _groundY) {
            var stepY = (_groundY - baseY) / 4;
            ctx.moveTo(fx, baseY);
            ctx.lineTo(fx + (flash.pts[0] - 0.5) * 20, baseY + stepY);
            ctx.lineTo(fx + (flash.pts[1] - 0.5) * 20, baseY + stepY * 2);
            ctx.lineTo(fx + (flash.pts[2] - 0.5) * 20, baseY + stepY * 3);
            ctx.lineTo(fx + (flash.pts[3] - 0.5) * 20, _groundY);
          }
        }
      }
      if (hasActiveFlash) {
        ctx.strokeStyle = 'rgba(255, 230, 100, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}
function vpDrawAnimatedWeatherPro(ctx, xOf, yOf, totalDist, elevData, timeMs, viewMinX, viewMaxX) {
  if (!vpWeatherData || vpWeatherData.length === 0) return;
  var prng = s => {
    var x = Math.sin(s) * 10000;
    return x - Math.floor(x);
  };
  var getElevY = dNM => {
    if (!elevData || elevData.length < 2) return yOf(0);
    var low = 0,
      high = elevData.length - 2;
    while (low <= high) {
      var mid = low + high >> 1;
      if (dNM < elevData[mid].distNM) high = mid - 1;else if (dNM > elevData[mid + 1].distNM) low = mid + 1;else {
        var p1 = elevData[mid];
        var p2 = elevData[mid + 1];
        var f = (dNM - p1.distNM) / (p2.distNM - p1.distNM || 1);
        return yOf(p1.elevFt + f * (p2.elevFt - p1.elevFt));
      }
    }
    return yOf(elevData[elevData.length - 1].elevFt);
  };
  ctx.save();
  for (var i = 0; i < vpWeatherData.length; i++) {
    var zone = vpWeatherData[i];
    if (!zone.weather || !zone.weather.hasRain && !zone.weather.hasSnow && !zone.weather.hasTS) continue;
    var prevDist = i > 0 ? (zone.distNM + vpWeatherData[i - 1].distNM) / 2 : Math.max(0, zone.distNM - totalDist * 0.05);
    var nextDist = i < vpWeatherData.length - 1 ? (zone.distNM + vpWeatherData[i + 1].distNM) / 2 : Math.min(totalDist, zone.distNM + totalDist * 0.05);
    var startX = xOf(prevDist);
    var endX = xOf(nextDist);
    var width = endX - startX;
    if (width <= 1 || endX < viewMinX || startX > viewMaxX) continue;
    var baseFt = zone.lowestBase && Number.isFinite(zone.lowestBase) ? zone.lowestBase : 4500;
    var baseY = yOf(baseFt);
    var hasSnow = !!zone.weather.hasSnow;
    var hasRain = !!zone.weather.hasRain && !hasSnow;
    var hasTS = !!zone.weather.hasTS;
    if (hasSnow || hasRain) {
      ctx.save();
      vpClipWeatherColumnToSky(ctx, startX, endX, prevDist, nextDist, getElevY);
      var colTop = baseY - 6;
      var steps = 10;
      ctx.beginPath();
      ctx.moveTo(startX, colTop);
      ctx.lineTo(endX, colTop);
      for (var s = steps; s >= 0; s--) {
        var t = s / steps;
        var x = startX + t * width;
        var dNM = prevDist + t * (nextDist - prevDist);
        var gy = getElevY(dNM);
        ctx.lineTo(x, gy);
      }
      ctx.closePath();
      var columnGrad = ctx.createLinearGradient(0, colTop, 0, colTop + 220);
      if (hasSnow) {
        columnGrad.addColorStop(0, 'rgba(214,230,255,0.16)');
        columnGrad.addColorStop(1, 'rgba(190,215,255,0.03)');
      } else {
        columnGrad.addColorStop(0, 'rgba(95,155,230,0.18)');
        columnGrad.addColorStop(1, 'rgba(80,130,210,0.04)');
      }
      ctx.fillStyle = columnGrad;
      ctx.fill();
      var drops = zone.visuals && zone.visuals.drops && zone.visuals.drops.length > 0 ? zone.visuals.drops : null;
      var sampleCount = drops ? Math.min(drops.length, hasSnow ? 90 : 115) : hasSnow ? 80 : 100;
      ctx.beginPath();
      for (var d = 0; d < sampleCount; d++) {
        var drop = drops ? drops[d] : {
          x: prng(i * 193 + d * 17.1),
          y: prng(i * 219 + d * 11.7),
          spd: prng(i * 251 + d * 7.3)
        };
        var fracX = drop.x;
        var _dNM = prevDist + fracX * (nextDist - prevDist);
        var groundY = getElevY(_dNM);
        if (groundY <= baseY + 2) continue;
        var span = groundY - colTop + 16;
        var speed = hasSnow ? 0.017 + drop.spd * 0.011 : 0.062 + drop.spd * 0.046;
        var y = colTop + (drop.y * span + timeMs * speed) % span;
        if (y < baseY || y > groundY) continue;
        if (hasSnow) {
          var sway = Math.sin(timeMs * 0.0012 + d * 0.8) * (2.5 + drop.spd * 2.4);
          var sx = startX + fracX * width + sway;
          sx = startX + ((sx - startX) % width + width) % width;
          var r = 0.8 + drop.spd * 1.1;
          ctx.moveTo(sx + r, y);
          ctx.arc(sx, y, r, 0, Math.PI * 2);
        } else {
          var slant = 2.5 + drop.spd * 5;
          var tail = 7 + drop.spd * 9;
          var rx = startX + fracX * width - timeMs * 0.01 * (0.1 + drop.spd);
          rx = startX + ((rx - startX) % width + width) % width;
          ctx.moveTo(rx, y);
          ctx.lineTo(rx - slant, y + tail);
        }
      }
      if (hasSnow) {
        ctx.fillStyle = 'rgba(245,250,255,0.84)';
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(120,185,255,0.56)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.restore();
    }
    if (hasTS) {
      var tsLeft = startX + width * 0.12;
      var tsRight = endX - width * 0.12;
      var tsWidth = Math.max(8, tsRight - tsLeft);
      var tsTop = baseY - 10;
      var pulse = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(timeMs * 0.003 + i * 0.8));

      // Konvektionskern als vertikaler Gefahrenvorhang
      var _steps = 12;
      ctx.beginPath();
      ctx.moveTo(tsLeft, tsTop);
      ctx.lineTo(tsRight, tsTop);
      for (var _s = _steps; _s >= 0; _s--) {
        var _t8 = _s / _steps;
        var _x34 = tsLeft + _t8 * tsWidth;
        var _dNM2 = prevDist + (_x34 - startX) / Math.max(1, width) * (nextDist - prevDist);
        var _gy = getElevY(_dNM2);
        ctx.lineTo(_x34, _gy);
      }
      ctx.closePath();
      var tsGrad = ctx.createLinearGradient(0, tsTop, 0, tsTop + 260);
      tsGrad.addColorStop(0, `rgba(255,120,60,${0.12 + pulse * 0.16})`);
      tsGrad.addColorStop(0.5, `rgba(255,80,45,${0.08 + pulse * 0.14})`);
      tsGrad.addColorStop(1, 'rgba(255,60,45,0.02)');
      ctx.fillStyle = tsGrad;
      ctx.fill();
      ctx.beginPath();
      var ridgeSteps = Math.max(8, Math.round(tsWidth / 14));
      for (var _s2 = 0; _s2 <= ridgeSteps; _s2++) {
        var _t9 = _s2 / ridgeSteps;
        var _x35 = tsLeft + _t9 * tsWidth;
        var _y = tsTop + Math.sin(_t9 * Math.PI * 2 * 2.4 + i * 1.2) * (2 + pulse * 3);
        if (_s2 === 0) ctx.moveTo(_x35, _y);else ctx.lineTo(_x35, _y);
      }
      ctx.strokeStyle = `rgba(255,190,90,${0.34 + pulse * 0.3})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      var flashes = zone.visuals && zone.visuals.flashes && zone.visuals.flashes.length > 0 ? zone.visuals.flashes : [{
        x: 0.4,
        pts: [0.45, 0.55, 0.4, 0.6]
      }];
      var cycle = timeMs % 4400;
      var hasActiveFlash = false;
      ctx.beginPath();
      for (var f = 0; f < flashes.length; f++) {
        var flash = flashes[f];
        var start = flash.x * 3600 % 3600 + 220;
        if (cycle < start || cycle > start + 150) continue;
        var fx = tsLeft + tsWidth * (0.08 + flash.x * 0.84);
        var _dNM3 = prevDist + (fx - startX) / Math.max(1, width) * (nextDist - prevDist);
        var _gy2 = getElevY(_dNM3);
        if (_gy2 <= tsTop) continue;
        hasActiveFlash = true;
        var seg = (_gy2 - tsTop) / 4;
        ctx.moveTo(fx, tsTop);
        ctx.lineTo(fx + (flash.pts[0] - 0.5) * 18, tsTop + seg);
        ctx.lineTo(fx + (flash.pts[1] - 0.5) * 18, tsTop + seg * 2);
        ctx.lineTo(fx + (flash.pts[2] - 0.5) * 18, tsTop + seg * 3);
        ctx.lineTo(fx + (flash.pts[3] - 0.5) * 18, _gy2);
      }
      if (hasActiveFlash) {
        ctx.strokeStyle = `rgba(255,235,150,${0.72 + pulse * 0.24})`;
        ctx.lineWidth = 1.8;
        ctx.shadowColor = 'rgba(255,220,130,0.6)';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  }
  ctx.restore();
}
function vpFindNearestWeatherZone(distNM) {
  if (!vpWeatherData || vpWeatherData.length === 0) return null;
  var best = null;
  var minDiff = Infinity;
  var _iterator47 = _createForOfIteratorHelper(vpWeatherData),
    _step47;
  try {
    for (_iterator47.s(); !(_step47 = _iterator47.n()).done;) {
      var z = _step47.value;
      var d = Math.abs((z.distNM || 0) - distNM);
      if (d < minDiff) {
        minDiff = d;
        best = z;
      }
    }
  } catch (err) {
    _iterator47.e(err);
  } finally {
    _iterator47.f();
  }
  return best;
}
function vpGetRouteBearingAtDist(elevData, distNM) {
  if (!elevData || elevData.length < 2 || !Number.isFinite(distNM)) return null;
  for (var i = 0; i < elevData.length - 1; i++) {
    var _a = elevData[i],
      _b = elevData[i + 1];
    if (distNM < _a.distNM || distNM > _b.distNM) continue;
    if (!Number.isFinite(_a.lat) || !Number.isFinite(_a.lon) || !Number.isFinite(_b.lat) || !Number.isFinite(_b.lon)) return null;
    return calcNav(_a.lat, _a.lon, _b.lat, _b.lon).brng;
  }
  var a = elevData[elevData.length - 2],
    b = elevData[elevData.length - 1];
  if (!a || !b) return null;
  return calcNav(a.lat, a.lon, b.lat, b.lon).brng;
}
function vpInterpolateWindAtAltitude(zone, targetAltFt) {
  if (!zone || !Array.isArray(zone.pressureProfile) || zone.pressureProfile.length === 0) return null;
  var pts = zone.pressureProfile.filter(p => Number.isFinite(p.geopotentialFt) && Number.isFinite(p.windKt) && Number.isFinite(p.windDirDeg)).sort((a, b) => a.geopotentialFt - b.geopotentialFt);
  if (!pts.length) return null;
  if (targetAltFt <= pts[0].geopotentialFt) return {
    windKt: pts[0].windKt,
    windDirDeg: pts[0].windDirDeg
  };
  if (targetAltFt >= pts[pts.length - 1].geopotentialFt) {
    var p = pts[pts.length - 1];
    return {
      windKt: p.windKt,
      windDirDeg: p.windDirDeg
    };
  }
  for (var i = 0; i < pts.length - 1; i++) {
    var a = pts[i],
      b = pts[i + 1];
    if (targetAltFt < a.geopotentialFt || targetAltFt > b.geopotentialFt) continue;
    var f = (targetAltFt - a.geopotentialFt) / Math.max(1, b.geopotentialFt - a.geopotentialFt);
    var aRad = a.windDirDeg * Math.PI / 180;
    var bRad = b.windDirDeg * Math.PI / 180;
    var aU = -a.windKt * Math.sin(aRad),
      aV = -a.windKt * Math.cos(aRad);
    var bU = -b.windKt * Math.sin(bRad),
      bV = -b.windKt * Math.cos(bRad);
    var u = aU + (bU - aU) * f;
    var v = aV + (bV - aV) * f;
    var windKt = Math.sqrt(u * u + v * v);
    var windDirDeg = (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360;
    return {
      windKt,
      windDirDeg,
      u,
      v
    };
  }
  return null;
}
function vpComputeTailwindComponent(windKt, windDirFromDeg, trackDeg) {
  if (!Number.isFinite(windKt) || !Number.isFinite(windDirFromDeg) || !Number.isFinite(trackDeg)) return null;
  var windRad = windDirFromDeg * Math.PI / 180;
  var u = -windKt * Math.sin(windRad); // East
  var v = -windKt * Math.cos(windRad); // North
  var tr = trackDeg * Math.PI / 180;
  var tx = Math.sin(tr),
    ty = Math.cos(tr);
  return u * tx + v * ty; // >0 tailwind, <0 headwind
}
var VP_ISOBAR_RELIEF_GAIN_DEFAULT = 5.5;
var VP_ISOBAR_RELIEF_GAIN_LOW = 10.5;
var VP_ISOBAR_RELIEF_GAIN_TINY = 15;
var VP_ISOBAR_RELIEF_MAX_DELTA_FT = 1800;
function vpBuildIsobarReliefStats() {
  var stats = {};
  if (!Array.isArray(vpWeatherData) || vpWeatherData.length < 2) return stats;
  var _iterator48 = _createForOfIteratorHelper(VP_OM_PRESSURE_LEVELS),
    _step48;
  try {
    var _loop2 = function _loop2() {
      var level = _step48.value;
      var vals = [];
      var _iterator49 = _createForOfIteratorHelper(vpWeatherData),
        _step49;
      try {
        for (_iterator49.s(); !(_step49 = _iterator49.n()).done;) {
          var zone = _step49.value;
          if (!Array.isArray(zone.pressureProfile)) continue;
          var p = zone.pressureProfile.find(pp => pp.hPa === level && Number.isFinite(pp.geopotentialFt));
          if (!p) continue;
          vals.push(p.geopotentialFt);
        }
      } catch (err) {
        _iterator49.e(err);
      } finally {
        _iterator49.f();
      }
      if (vals.length < 2) return 1; // continue
      var min = Math.min.apply(Math, vals);
      var max = Math.max.apply(Math, vals);
      var spread = Math.max(0, max - min);
      var mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      var gain = VP_ISOBAR_RELIEF_GAIN_DEFAULT;
      if (spread < 70) gain = VP_ISOBAR_RELIEF_GAIN_TINY;else if (spread < 180) gain = VP_ISOBAR_RELIEF_GAIN_LOW;
      var maxDelta = Math.max(220, Math.min(VP_ISOBAR_RELIEF_MAX_DELTA_FT, spread * gain));
      stats[level] = {
        mean,
        gain,
        maxDelta
      };
    };
    for (_iterator48.s(); !(_step48 = _iterator48.n()).done;) {
      if (_loop2()) continue;
    }
  } catch (err) {
    _iterator48.e(err);
  } finally {
    _iterator48.f();
  }
  return stats;
}
function vpMapIsobarDisplayFt(level, rawFt, reliefStats) {
  if (!Number.isFinite(rawFt)) return rawFt;
  var s = reliefStats ? reliefStats[level] : null;
  if (!s) return rawFt;
  var amplified = s.mean + (rawFt - s.mean) * s.gain;
  var delta = Math.max(-s.maxDelta, Math.min(s.maxDelta, amplified - s.mean));
  return s.mean + delta;
}
function vpDrawIsobars(ctx, xOf, yOf, padTop, plotH, viewMinX, viewMaxX, rightX) {
  if (!vpShowIsobars || !vpWeatherData || vpWeatherData.length < 2) return;
  var hasPressureData = vpWeatherData.some(z => Array.isArray(z.pressureProfile) && z.pressureProfile.length > 0);
  if (!hasPressureData) return;
  var hasOpenMeteoProfiles = vpWeatherData.some(z => z && z.wxSource === 'openmeteo');
  var levels = hasOpenMeteoProfiles ? VP_OM_PRESSURE_LEVELS : [1000];
  var reliefStats = vpBuildIsobarReliefStats();
  ctx.save();
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 1;
  ctx.font = gaEfbProfileFont('9px Arial');
  ctx.textAlign = 'right';
  var usedLabelYs = [];
  var _iterator50 = _createForOfIteratorHelper(levels),
    _step50;
  try {
    var _loop3 = function _loop3() {
        var level = _step50.value;
        var pts = [];
        var lastLabel = null;
        var _iterator51 = _createForOfIteratorHelper(vpWeatherData),
          _step51;
        try {
          for (_iterator51.s(); !(_step51 = _iterator51.n()).done;) {
            var zone = _step51.value;
            if (!Array.isArray(zone.pressureProfile)) continue;
            var p = zone.pressureProfile.find(pp => pp.hPa === level && Number.isFinite(pp.geopotentialFt));
            if (!p) continue;
            var x = xOf(zone.distNM);
            var y = yOf(vpMapIsobarDisplayFt(level, p.geopotentialFt, reliefStats));
            if (x < viewMinX - 60 || x > viewMaxX + 60 || y < padTop - 20 || y > padTop + plotH + 20) continue;
            pts.push({
              x,
              y,
              distNM: zone.distNM,
              level
            });
            lastLabel = {
              x,
              y
            };
          }
        } catch (err) {
          _iterator51.e(err);
        } finally {
          _iterator51.f();
        }
        if (pts.length < 2) return 0; // continue

        // Sanfte Kurve statt strikt gerader Segmente zwischen den Samples.
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (var i = 1; i < pts.length; i++) {
          var prev = pts[i - 1];
          var cur = pts[i];
          var midX = (prev.x + cur.x) * 0.5;
          var midY = (prev.y + cur.y) * 0.5;
          ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
        }
        var last = pts[pts.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.strokeStyle = 'rgba(140,170,210,0.35)';
        ctx.stroke();
        if (!lastLabel) return 0; // continue
        var ly = Math.max(padTop + 10, Math.min(padTop + plotH - 4, lastLabel.y + 3));
        var collide = true;
        var guard = 0;
        while (collide && guard < 8) {
          collide = usedLabelYs.some(v => Math.abs(v - ly) < 12);
          if (collide) ly += 11;
          guard++;
        }
        usedLabelYs.push(ly);
        ctx.fillStyle = 'rgba(180,205,235,0.82)';
        var label = !hasOpenMeteoProfiles && level === 1000 ? 'QNH' : `${level} hPa`;
        gaEfbCanvasFillText(ctx, label, rightX, ly);
      },
      _ret;
    for (_iterator50.s(); !(_step50 = _iterator50.n()).done;) {
      _ret = _loop3();
      if (_ret === 0) continue;
    }
  } catch (err) {
    _iterator50.e(err);
  } finally {
    _iterator50.f();
  }
  ctx.restore();
}
function vpDrawWindComponentsOnIsobars(ctx, xOf, yOf, elevData, viewMinX, viewMaxX, padTop, plotH) {
  if (!vpShowWindComponents || !vpWeatherData || vpWeatherData.length === 0) return;
  var hasOpenMeteoProfiles = vpWeatherData.some(z => z && z.wxSource === 'openmeteo');
  var levels = hasOpenMeteoProfiles ? VP_OM_PRESSURE_LEVELS : [1000];
  var reliefStats = vpBuildIsobarReliefStats();
  ctx.save();
  ctx.font = gaEfbProfileFont('bold 8px Arial');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  var minLabelDxPx = 82;
  var minShownComponentKt = 2;
  var _iterator52 = _createForOfIteratorHelper(levels),
    _step52;
  try {
    var _loop4 = function _loop4() {
      var level = _step52.value;
      var points = [];
      for (var i = 0; i < vpWeatherData.length; i++) {
        var zone = vpWeatherData[i];
        if (!Array.isArray(zone.pressureProfile)) continue;
        var p = zone.pressureProfile.find(pp => pp.hPa === level && Number.isFinite(pp.geopotentialFt) && Number.isFinite(pp.windKt) && Number.isFinite(pp.windDirDeg));
        if (!p) continue;
        var x = xOf(zone.distNM);
        var y = yOf(vpMapIsobarDisplayFt(level, p.geopotentialFt, reliefStats));
        if (x < viewMinX + 12 || x > viewMaxX - 12 || y < padTop + 8 || y > padTop + plotH - 8) continue;
        var track = vpGetRouteBearingAtDist(elevData, zone.distNM);
        if (!Number.isFinite(track)) continue;
        var comp = vpComputeTailwindComponent(p.windKt, p.windDirDeg, track);
        if (!Number.isFinite(comp)) continue;
        points.push({
          x,
          y,
          comp
        });
      }
      if (points.length < 2) return 1; // continue
      var lastLabelX = -Infinity;
      for (var _i0 = 0; _i0 < points.length; _i0++) {
        var pt = points[_i0];
        if (pt.x - lastLabelX < minLabelDxPx) continue;
        var c = Math.round(pt.comp);
        if (Math.abs(c) < minShownComponentKt) continue;
        var prev = points[Math.max(0, _i0 - 1)];
        var next = points[Math.min(points.length - 1, _i0 + 1)];
        var dx = next.x - prev.x;
        var dy = next.y - prev.y;
        var l = Math.max(1, Math.hypot(dx, dy));
        var nx = -dy / l;
        var ny = dx / l;
        var isTail = c > 0;
        var txt = isTail ? `${Math.abs(c)} \u2192` : `\u2190 ${Math.abs(c)}`;
        var tx = pt.x + nx * 8;
        var ty = pt.y + ny * 8;
        ctx.lineWidth = 2.4;
        ctx.strokeStyle = 'rgba(0,0,0,0.62)';
        ctx.strokeText(txt, tx, ty);
        ctx.fillStyle = isTail ? 'rgba(136,255,184,0.96)' : 'rgba(255,172,160,0.96)';
        gaEfbCanvasFillText(ctx, txt, tx, ty);
        lastLabelX = pt.x;
      }
    };
    for (_iterator52.s(); !(_step52 = _iterator52.n()).done;) {
      if (_loop4()) continue;
    }
  } catch (err) {
    _iterator52.e(err);
  } finally {
    _iterator52.f();
  }
  ctx.restore();
}
function computeFlightProfile(elevationData, cruiseAltFt, climbRateFpm, descentRateFpm, tasKts) {
  if (!elevationData || elevationData.length < 2) return null;
  var depElevFt = elevationData[0].elevFt;
  var destElevFt = elevationData[elevationData.length - 1].elevFt;
  var totalDistNM = elevationData[elevationData.length - 1].distNM;
  var climbFt = Math.max(0, cruiseAltFt - depElevFt);
  var climbTimeMin = climbFt / climbRateFpm;
  var climbDistNM = climbTimeMin / 60 * tasKts * 0.85;
  var descentFt = Math.max(0, cruiseAltFt - destElevFt);
  var descentTimeMin = descentFt / descentRateFpm;
  var descentDistNM = descentTimeMin / 60 * tasKts * 0.9;
  var tocDistNM = Math.min(climbDistNM, totalDistNM * 0.4);
  var todDistNM = Math.max(totalDistNM - descentDistNM, totalDistNM * 0.6);
  var profile = [];
  var _iterator53 = _createForOfIteratorHelper(elevationData),
    _step53;
  try {
    for (_iterator53.s(); !(_step53 = _iterator53.n()).done;) {
      var pt = _step53.value;
      var altFt = void 0;
      if (pt.distNM <= tocDistNM) {
        var f = tocDistNM > 0 ? pt.distNM / tocDistNM : 1;
        altFt = depElevFt + (cruiseAltFt - depElevFt) * f;
      } else if (pt.distNM >= todDistNM) {
        var _f3 = totalDistNM - todDistNM > 0 ? (pt.distNM - todDistNM) / (totalDistNM - todDistNM) : 1;
        altFt = cruiseAltFt - (cruiseAltFt - destElevFt) * _f3;
      } else {
        altFt = cruiseAltFt;
      }
      profile.push({
        distNM: pt.distNM,
        altFt: Math.round(altFt)
      });
    }
  } catch (err) {
    _iterator53.e(err);
  } finally {
    _iterator53.f();
  }
  return {
    profile,
    tocDistNM,
    todDistNM
  };
}
function getCachedAirspaceIntersections(elevData, totalDist) {
  // Im HDG-Modus ändert sich elevData[0] mit jeder Position → Cache-Key muss mitlaufen
  var isHdg = typeof vpMode !== 'undefined' && vpMode === 'HDG';
  var hdgPosKey = isHdg && elevData[0] ? `_${(elevData[0].lat || 0).toFixed(2)}_${(elevData[0].lon || 0).toFixed(2)}` : '';
  var asCacheKey = (window._lastVpRouteKey || 'none') + '_v' + (window._activeAirspacesVersion || 0) + hdgPosKey;
  if (window._vpAsCache && window._vpAsCache.key === asCacheKey && window._vpAsCache.elevLength === elevData.length) {
    return window._vpAsCache.items;
  }
  var baseStepNm = elevData.length > 1 ? Math.max(0.05, Math.abs((elevData[1].distNM || 0) - (elevData[0].distNM || 0))) : 0.25;
  // Mikro-Splitter zusammenführen, aber echte mehrfach-Durchflüge getrennt lassen.
  var mergeGapNm = Math.max(0.12, baseStepNm * 0.35);
  var minIntervalNm = Math.max(0.06, baseStepNm * 0.22);
  var items = [];
  var _loop5 = function _loop5() {
      var as = activeAirspaces[asIdx];
      if (as.type === 33) return 0; // continue
      var band = getAirspaceVerticalBandFt(as, 0);
      if (!band) return 0; // continue
      var lowerFt = band.baseLowerFt;
      var upperFt = band.baseUpperFt;
      var isLowerAgl = band.isLowerAgl;
      var isUpperAgl = band.isUpperAgl;
      var polys = [];
      if (as.geometry) {
        if (as.geometry.type === 'Polygon') polys.push(as.geometry.coordinates[0]);else if (as.geometry.type === 'MultiPolygon') as.geometry.coordinates.forEach(mc => polys.push(mc[0]));
      }
      if (polys.length === 0) return 0; // continue
      var pointInsideAnyPoly = pt => {
        for (var _i1 = 0, _polys = polys; _i1 < _polys.length; _i1++) {
          var poly = _polys[_i1];
          if (vpPointInPoly(pt, poly)) return true;
        }
        return false;
      };
      var segmentCrossFractions = (ptA, ptB) => {
        var vals = [];
        for (var _i10 = 0, _polys2 = polys; _i10 < _polys2.length; _i10++) {
          var poly = _polys2[_i10];
          for (var ei = 0, ej = poly.length - 1; ei < poly.length; ej = ei++) {
            var ax = poly[ej][0],
              ay = poly[ej][1],
              bx = poly[ei][0],
              by = poly[ei][1];
            var d1x = ptB.lon - ptA.lon,
              d1y = ptB.lat - ptA.lat;
            var d2x = bx - ax,
              d2y = by - ay;
            var cross = d1x * d2y - d1y * d2x;
            if (Math.abs(cross) < 1e-12) continue;
            var t = ((ax - ptA.lon) * d2y - (ay - ptA.lat) * d2x) / cross;
            var u = ((ax - ptA.lon) * d1y - (ay - ptA.lat) * d1x) / cross;
            if (t >= 0 && t <= 1 && u >= 0 && u <= 1) vals.push(t);
          }
        }
        vals.sort((a, b) => a - b);
        var unique = [];
        for (var _i11 = 0, _vals = vals; _i11 < _vals.length; _i11++) {
          var _t0 = _vals[_i11];
          if (!unique.length || Math.abs(_t0 - unique[unique.length - 1]) > 1e-5) unique.push(_t0);
        }
        return unique;
      };
      var intervals = [];
      var openStart = null;
      var openInterval = dist => {
        if (openStart === null) openStart = dist;
      };
      var closeInterval = dist => {
        if (openStart !== null && dist > openStart + 1e-4) intervals.push({
          min: openStart,
          max: dist
        });
        openStart = null;
      };
      for (var i = 0; i < elevData.length - 1; i++) {
        var a = elevData[i];
        var b = elevData[i + 1];
        var segLen = b.distNM - a.distNM;
        if (segLen <= 1e-6) continue;
        var cuts = [0].concat(_toConsumableArray(segmentCrossFractions(a, b)), [1]);
        for (var c = 0; c < cuts.length - 1; c++) {
          var t0 = cuts[c],
            t1 = cuts[c + 1];
          if (t1 - t0 <= 1e-6) continue;
          var mid = (t0 + t1) * 0.5;
          var probe = {
            lat: a.lat + (b.lat - a.lat) * mid,
            lon: a.lon + (b.lon - a.lon) * mid
          };
          var inside = pointInsideAnyPoly(probe);
          var d0 = a.distNM + segLen * t0;
          var d1 = a.distNM + segLen * t1;
          if (inside) {
            openInterval(d0);
            if (c === cuts.length - 2) closeInterval(d1);
          } else {
            closeInterval(d0);
          }
        }
      }
      if (openStart !== null) closeInterval(totalDist);
      if (intervals.length === 0) return 0; // continue

      // 1) Zu kleine Fragmente verwerfen
      var filtered = intervals.map(iv => ({
        min: Number(iv.min || 0),
        max: Number(iv.max || 0)
      })).filter(iv => Number.isFinite(iv.min) && Number.isFinite(iv.max) && iv.max > iv.min + minIntervalNm).sort((a, b) => a.min - b.min);
      if (filtered.length === 0) return 0; // continue

      // 2) Fast angrenzende Intervalle zusammenführen (numerisches Flattern am Rand)
      var merged = [];
      var _iterator54 = _createForOfIteratorHelper(filtered),
        _step54;
      try {
        for (_iterator54.s(); !(_step54 = _iterator54.n()).done;) {
          var iv = _step54.value;
          if (merged.length === 0) {
            merged.push({
              min: iv.min,
              max: iv.max
            });
            continue;
          }
          var prev = merged[merged.length - 1];
          if (iv.min <= prev.max + mergeGapNm) {
            prev.max = Math.max(prev.max, iv.max);
          } else {
            merged.push({
              min: iv.min,
              max: iv.max
            });
          }
        }
      } catch (err) {
        _iterator54.e(err);
      } finally {
        _iterator54.f();
      }
      var eps = elevData.length > 1 ? Math.max(0.05, (elevData[1].distNM - elevData[0].distNM) * 0.5) : 0.5;
      var _loop6 = function _loop6() {
        var interval = merged[runIdx];
        var asMinDist = interval.min;
        var asMaxDist = interval.max;
        var relevantPts = elevData.filter(p => p.distNM >= asMinDist - eps && p.distNM <= asMaxDist + eps);
        if (relevantPts.length < 1) return 1; // continue
        items.push({
          asIdx,
          as,
          runIdx,
          lowerFt,
          upperFt,
          isLowerAgl,
          isUpperAgl,
          asMinDist,
          asMaxDist,
          relevantPts
        });
      };
      for (var runIdx = 0; runIdx < merged.length; runIdx++) {
        if (_loop6()) continue;
      }
    },
    _ret2;
  for (var asIdx = 0; asIdx < activeAirspaces.length; asIdx++) {
    _ret2 = _loop5();
    if (_ret2 === 0) continue;
  }
  window._vpAsCache = {
    key: asCacheKey,
    elevLength: elevData.length,
    items: items
  };
  return items;
}
function renderVerticalProfile(canvasId) {
  var _document$getElementB5, _document$getElementB6;
  var canvas = document.getElementById(canvasId);
  if (!canvas || !vpElevationData || vpElevationData.length < 2) return;
  var container = canvas.parentElement;
  var displayWidth = container.clientWidth || 400;
  var displayHeight = Math.round(displayWidth * 0.4);
  var dpr = window.devicePixelRatio || 1;
  var targetW = displayWidth * dpr;
  var targetH = displayHeight * dpr;
  var ctx = canvas.getContext('2d');

  // Performance Fix für das kleine Diagramm
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
    canvas.style.width = '100%';
    canvas.style.maxWidth = displayWidth + 'px';
    canvas.style.height = 'auto';
    ctx.scale(dpr, dpr);
  } else {
    ctx.clearRect(0, 0, displayWidth, displayHeight);
  }
  var padLeft = 45,
    padRight = 15,
    padTop = 20,
    padBottom = 30;
  var plotW = displayWidth - padLeft - padRight;
  var plotH = displayHeight - padTop - padBottom;
  var cruiseAlt = parseInt(((_document$getElementB5 = document.getElementById('altMapInput')) === null || _document$getElementB5 === void 0 ? void 0 : _document$getElementB5.textContent) || ((_document$getElementB6 = document.getElementById('altSlider')) === null || _document$getElementB6 === void 0 ? void 0 : _document$getElementB6.value) || 4500);
  var tas = vpGetProfileTas();
  var totalDist = vpElevationData[vpElevationData.length - 1].distNM;
  var maxTerrain = Math.max.apply(Math, _toConsumableArray(vpElevationData.map(p => p.elevFt)));
  var maxCloudAlt = 0;
  if (vpShowClouds && vpWeatherData) {
    vpWeatherData.forEach(zone => {
      if (zone.clouds) zone.clouds.forEach(c => {
        if (c.baseMsl > maxCloudAlt) maxCloudAlt = c.baseMsl;
      });
    });
  }
  var autoMaxAlt = Math.max(cruiseAlt + 2500, maxTerrain + 1000);
  var maxAlt = vpMaxAltOverride > 0 ? vpMaxAltOverride : autoMaxAlt;
  var minAlt = 0;
  var fpResult = computeFlightProfile(vpElevationData, cruiseAlt, vpClimbRate, vpDescentRate, tas);
  var xOf = distNM => padLeft + distNM / totalDist * plotW;
  var yOf = altFt => padTop + plotH - (altFt - minAlt) / (maxAlt - minAlt) * plotH;

  // Background
  ctx.fillStyle = '#eef6ff';
  ctx.fillRect(0, 0, displayWidth, displayHeight);

  // Sky gradient
  var skyGrad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
  skyGrad.addColorStop(0, '#87CEEB');
  skyGrad.addColorStop(0.5, '#c8e6f8');
  skyGrad.addColorStop(1, '#e8f4f8');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(padLeft, padTop, plotW, plotH);
  if (vpShowClouds) {
    if (vpWeatherRenderMode === 'abstrakt' || vpWeatherRenderMode === 'pro') vpDrawCloudsPro(ctx, xOf, yOf, padTop, plotH, totalDist, typeof zoomFactor !== 'undefined', typeof elevData !== 'undefined' ? elevData : vpElevationData);else vpDrawClouds(ctx, xOf, yOf, padTop, plotH, totalDist, typeof zoomFactor !== 'undefined', typeof elevData !== 'undefined' ? elevData : vpElevationData);
  }

  // Airspace blocks
  var occupiedASLabels = [];
  if (vpAirspaceMode !== 0 && typeof activeAirspaces !== 'undefined' && activeAirspaces.length > 0) {
    var cachedAirspaces = getCachedAirspaceIntersections(vpElevationData, totalDist);
    var _iterator55 = _createForOfIteratorHelper(cachedAirspaces),
      _step55;
    try {
      var _loop7 = function _loop7() {
        var item = _step55.value;
        var asIdx = item.asIdx,
          as = item.as,
          lowerFt = item.lowerFt,
          upperFt = item.upperFt,
          isLowerAgl = item.isLowerAgl,
          isUpperAgl = item.isUpperAgl,
          asMinDist = item.asMinDist,
          asMaxDist = item.asMaxDist,
          relevantPts = item.relevantPts;
        var style = getAirspaceStyle(as);
        var x1 = xOf(asMinDist),
          x2 = xOf(asMaxDist);
        ctx.fillStyle = vpHexToRgba(style.color, 0.15);
        ctx.strokeStyle = vpHexToRgba(style.color, 0.4);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        // Airspace-Form zeichnen: MSL → exaktes Rechteck (kein Sampling-Artefakt),
        // AGL → Gelände-folgendes Polygon
        ctx.beginPath();
        if (!isLowerAgl && !isUpperAgl) {
          // Reines MSL-Rechteck — exakt von asMinDist bis asMaxDist
          var ry1 = yOf(Math.min(upperFt, maxAlt));
          var ry2 = yOf(Math.max(lowerFt, minAlt));
          ctx.moveTo(xOf(asMinDist), ry1);
          ctx.lineTo(xOf(asMaxDist), ry1);
          ctx.lineTo(xOf(asMaxDist), ry2);
          ctx.lineTo(xOf(asMinDist), ry2);
        } else {
          // AGL-Polygon entlang Geländeprofil
          for (var i = 0; i < relevantPts.length; i++) {
            var p = relevantPts[i];
            var realUpper = isUpperAgl ? p.elevFt + upperFt : upperFt;
            var y = yOf(Math.min(realUpper, maxAlt));
            if (i === 0) ctx.moveTo(xOf(p.distNM), y);else ctx.lineTo(xOf(p.distNM), y);
          }
          for (var _i12 = relevantPts.length - 1; _i12 >= 0; _i12--) {
            var _p = relevantPts[_i12];
            var realLower = isLowerAgl ? _p.elevFt + lowerFt : lowerFt;
            ctx.lineTo(xOf(_p.distNM), yOf(Math.max(realLower, minAlt)));
          }
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        var sumUpper = 0;
        relevantPts.forEach(p => sumUpper += isUpperAgl ? p.elevFt + upperFt : upperFt);
        var avgUpper = relevantPts.length ? sumUpper / relevantPts.length : upperFt;
        var labelY = yOf(Math.min(avgUpper, maxAlt));
        labelY = Math.max(padTop + 15, labelY);
        var displayName = getAirspaceDisplayName(as);
        ctx.font = gaEfbProfileFont('bold 8px Arial');
        var tw = ctx.measureText(displayName).width;
        var tLeft = (x1 + x2) / 2 - tw / 2,
          tRight = tLeft + tw;
        var collision = false;
        var _iterator56 = _createForOfIteratorHelper(occupiedASLabels),
          _step56;
        try {
          for (_iterator56.s(); !(_step56 = _iterator56.n()).done;) {
            var occ = _step56.value;
            if (tLeft < occ.r && tRight > occ.l && labelY < occ.b && labelY + 20 > occ.t) {
              collision = true;
              break;
            }
          }
        } catch (err) {
          _iterator56.e(err);
        } finally {
          _iterator56.f();
        }
        if (!collision) {
          occupiedASLabels.push({
            l: tLeft - 5,
            r: tRight + 5,
            t: labelY - 5,
            b: labelY + 20
          });
          ctx.fillStyle = vpHexToRgba(style.color, 0.7);
          ctx.textAlign = 'center';
          gaEfbCanvasFillText(ctx, displayName, (x1 + x2) / 2, labelY + 10);
          ctx.font = gaEfbProfileFont('7px Arial');
          gaEfbCanvasFillText(ctx, formatAsLimit(as.lowerLimit) + ' – ' + formatAsLimit(as.upperLimit), (x1 + x2) / 2, labelY + 19);
        }
      };
      for (_iterator55.s(); !(_step55 = _iterator55.n()).done;) {
        _loop7();
      }
    } catch (err) {
      _iterator55.e(err);
    } finally {
      _iterator55.f();
    }
  }
  ctx.textAlign = 'left';

  // Safety line (terrain + 1000ft)
  ctx.beginPath();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(200, 80, 0, 0.5)';
  ctx.lineWidth = 1;
  for (var i = 0; i < vpElevationData.length; i++) {
    var x = xOf(vpElevationData[i].distNM),
      y = yOf(vpElevationData[i].elevFt + 1000);
    if (i === 0) ctx.moveTo(x, y);else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Terrain polygon
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(0));
  for (var _i13 = 0; _i13 < vpElevationData.length; _i13++) ctx.lineTo(xOf(vpElevationData[_i13].distNM), yOf(vpElevationData[_i13].elevFt));
  ctx.lineTo(xOf(totalDist), yOf(0));
  ctx.closePath();
  var terrainGrad = ctx.createLinearGradient(0, yOf(maxTerrain), 0, yOf(0));
  terrainGrad.addColorStop(0, '#8B7355');
  terrainGrad.addColorStop(0.3, '#6B8E23');
  terrainGrad.addColorStop(0.7, '#228B22');
  terrainGrad.addColorStop(1, '#2E8B57');
  ctx.fillStyle = terrainGrad;
  ctx.fill();
  ctx.beginPath();
  for (var _i14 = 0; _i14 < vpElevationData.length; _i14++) {
    var _x36 = xOf(vpElevationData[_i14].distNM),
      _y2 = yOf(vpElevationData[_i14].elevFt);
    if (_i14 === 0) ctx.moveTo(_x36, _y2);else ctx.lineTo(_x36, _y2);
  }
  ctx.strokeStyle = '#3a5a20';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (vpShowLandmarks) vpDrawLandmarks(ctx, xOf, yOf, typeof elevData !== 'undefined' ? elevData : vpElevationData, totalDist, typeof zoomFactor !== 'undefined', typeof zoomFactor !== 'undefined' ? zoomFactor : 1.0, maxAlt);
  if (vpShowObstacles) vpDrawObstacles(ctx, xOf, yOf, totalDist, typeof zoomFactor !== 'undefined' ? zoomFactor : 1.0, typeof elevData !== 'undefined' ? elevData : vpElevationData);

  // Flight profile
  if (fpResult && fpResult.profile) {
    ctx.beginPath();
    for (var _i15 = 0; _i15 < fpResult.profile.length; _i15++) {
      var _x37 = xOf(fpResult.profile[_i15].distNM),
        _y3 = yOf(fpResult.profile[_i15].altFt) + 2;
      if (_i15 === 0) ctx.moveTo(_x37, _y3);else ctx.lineTo(_x37, _y3);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    for (var _i16 = 0; _i16 < fpResult.profile.length; _i16++) {
      var _x38 = xOf(fpResult.profile[_i16].distNM),
        _y4 = yOf(fpResult.profile[_i16].altFt);
      if (_i16 === 0) ctx.moveTo(_x38, _y4);else ctx.lineTo(_x38, _y4);
    }
    ctx.strokeStyle = '#d93829';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // TOC
    ctx.beginPath();
    ctx.arc(xOf(fpResult.tocDistNM), yOf(cruiseAlt), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#d93829';
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.font = gaEfbProfileFont('bold 9px Arial');
    ctx.textAlign = 'center';
    gaEfbCanvasFillText(ctx, 'TOC', xOf(fpResult.tocDistNM), yOf(cruiseAlt) - 7);

    // TOD
    ctx.beginPath();
    ctx.arc(xOf(fpResult.todDistNM), yOf(cruiseAlt), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#d93829';
    ctx.fill();
    ctx.fillStyle = '#333';
    gaEfbCanvasFillText(ctx, 'TOD', xOf(fpResult.todDistNM), yOf(cruiseAlt) - 7);
    ctx.textAlign = 'left';
  }

  // Waypoint markers
  var wpCumDist = 0;
  for (var _i17 = 0; _i17 < routeWaypoints.length; _i17++) {
    if (_i17 > 0) {
      var prev = routeWaypoints[_i17 - 1],
        curr = routeWaypoints[_i17];
      wpCumDist += calcNav(prev.lat, prev.lng || prev.lon, curr.lat, curr.lng || curr.lon).dist;
    }
    var _x39 = xOf(wpCumDist);
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.moveTo(_x39, padTop);
    ctx.lineTo(_x39, padTop + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
    var wpLabel = typeof vpRouteWaypointLabel === 'function' ? vpRouteWaypointLabel(_i17, routeWaypoints[_i17]) : _i17 === 0 ? currentStartICAO || 'DEP' : routeWaypoints[_i17].name || 'WP' + _i17;
    if (wpLabel.length > 8) wpLabel = wpLabel.substring(0, 7) + '…';
    ctx.save();
    ctx.translate(_x39, padTop + plotH + 4);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = '#333';
    ctx.font = gaEfbProfileFont('bold 8px Arial');
    ctx.textAlign = 'left';
    gaEfbCanvasFillText(ctx, wpLabel, 0, 0);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(_x39, padTop + 3, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = _i17 === 0 ? '#44ff44' : _i17 === routeWaypoints.length - 1 ? '#ff4444' : '#fdfd86';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Y axis
  ctx.fillStyle = '#fff';
  ctx.font = gaEfbProfileFont('bold 10px Arial');
  ctx.textAlign = 'right';
  var altStep = maxAlt > 6000 ? 2000 : maxAlt > 3000 ? 1000 : 500;
  for (var alt = 0; alt <= maxAlt; alt += altStep) {
    var _y5 = yOf(alt);
    if (_y5 < padTop - 5 || _y5 > padTop + plotH + 5) continue;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 0.5;
    ctx.moveTo(padLeft, _y5);
    ctx.lineTo(padLeft + plotW, _y5);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = gaEfbProfileFont('bold 10px Arial');
    gaEfbCanvasFillText(ctx, alt >= 1000 ? (alt / 1000).toFixed(alt % 1000 === 0 ? 0 : 1) + 'k' : alt + '', padLeft - 4, _y5 + 3);
  }
  ctx.save();
  ctx.translate(8, padTop + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#888';
  ctx.font = gaEfbProfileFont('bold 8px Arial');
  ctx.textAlign = 'center';
  gaEfbCanvasFillText(ctx, 'ALT (ft)', 0, 0);
  ctx.restore();

  // X axis
  ctx.textAlign = 'center';
  var distStep = totalDist > 100 ? 20 : totalDist > 50 ? 10 : 5;
  for (var d = 0; d <= totalDist; d += distStep) {
    ctx.fillStyle = '#888';
    ctx.font = gaEfbProfileFont('8px Arial');
    gaEfbCanvasFillText(ctx, d + '', xOf(d), padTop + plotH + 22);
  }
  ctx.fillStyle = '#888';
  ctx.font = gaEfbProfileFont('bold 8px Arial');
  gaEfbCanvasFillText(ctx, 'NM', padLeft + plotW + 8, padTop + plotH + 22);

  // Border
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = 1;
  ctx.strokeRect(padLeft, padTop, plotW, plotH);

  // Cruise altitude label & line
  ctx.fillStyle = 'rgba(217, 56, 41, 0.8)';
  ctx.font = gaEfbProfileFont('bold 9px Arial');
  ctx.textAlign = 'left';
  gaEfbCanvasFillText(ctx, 'CRZ ' + cruiseAlt + ' ft', padLeft + 4, yOf(cruiseAlt) - 4);
  ctx.beginPath();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = 'rgba(217, 56, 41, 0.3)';
  ctx.lineWidth = 1;
  ctx.moveTo(padLeft, yOf(cruiseAlt));
  ctx.lineTo(padLeft + plotW, yOf(cruiseAlt));
  ctx.stroke();
  ctx.setLineDash([]);

  // Peak elevation marker
  var peakPt = vpElevationData.reduce((max, p) => p.elevFt > max.elevFt ? p : max);
  ctx.fillStyle = '#333';
  ctx.font = gaEfbProfileFont('10px Arial');
  ctx.textAlign = 'center';
  gaEfbCanvasFillText(ctx, '▲', xOf(peakPt.distNM), yOf(peakPt.elevFt) - 3);
  ctx.font = gaEfbProfileFont('bold 8px Arial');
  gaEfbCanvasFillText(ctx, peakPt.elevFt + ' ft', xOf(peakPt.distNM), yOf(peakPt.elevFt) - 12);

  // Auto-update things that depend on the completed elevation data
  if (typeof renderAirspaceWarningsList === 'function') renderAirspaceWarningsList();
  if (typeof vpMapProfileVisible !== 'undefined' && vpMapProfileVisible && vpElevationData) {
    var mainAlt = document.getElementById('altSlider');
    var mapAlt = document.getElementById('altSliderMap');
    var mapDisplay = document.getElementById('altMapDisplay');
    if (mainAlt && mapAlt) {
      mapAlt.value = mainAlt.value;
    }
    if (mainAlt && mapDisplay) {
      mapDisplay.textContent = mainAlt.value;
    }
    renderMapProfile();
  }
}
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
  for (var _i18 = 0, _polys3 = polys; _i18 < _polys3.length; _i18++) {
    var poly = _polys3[_i18];
    if (vpPointInPoly({
      lat,
      lon
    }, poly)) return true;
  }
  return false;
}
function vpHexToRgba(hex, alpha) {
  if (!hex || hex.charAt(0) !== '#') return 'rgba(0,0,0,' + alpha + ')';
  var r = parseInt(hex.slice(1, 3), 16) || 0;
  var g = parseInt(hex.slice(3, 5), 16) || 0;
  var b = parseInt(hex.slice(5, 7), 16) || 0;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

/* =========================================================
   MAP TABLE PROFILE STRIP
   ========================================================= */
var vpMapProfileVisible = true;
function vpCanRunVisibleMapProfileWork() {
  var mapTable = document.getElementById('mapTableOverlay');
  return !document.hidden && !!(mapTable && mapTable.classList.contains('active')) && vpMapProfileVisible;
}
function vpPauseMapProfileWork() {
  var reason = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'hidden';
  vpStopMapProfileFrameLoop();
  if (typeof vpMode !== 'undefined' && vpMode === 'HDG') {
    vpHdgRefreshPending = true;
    if (vpHdgWeatherAbortController && !vpHdgWeatherAbortController.signal.aborted) {
      vpHdgWeatherAbortController.abort();
    }
  }
  if (window.gaDebugPush) window.gaDebugPush('profile', 'Map profile paused', {
    reason: String(reason || '')
  });
}
function vpResumeMapProfile() {
  var reason = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'visible';
  window.vpBgNeedsUpdate = true;
  if (!vpCanRunVisibleMapProfileWork()) return false;

  // Explizite Sichtbarkeits-/Routenereignisse umgehen den FPS-Timer bewusst.
  vpRequestMapProfileFrameNow();
  if (typeof vpMode !== 'undefined' && vpMode === 'HDG') {
    vpQueueHdgProfileUpdate({
      force: true,
      reason
    });
  }
  if (window.gaDebugPush) window.gaDebugPush('profile', 'Map profile resumed', {
    reason: String(reason || '')
  });
  return true;
}
window.vpPauseMapProfile = vpPauseMapProfileWork;
window.vpResumeMapProfile = vpResumeMapProfile;
function toggleMapProfile() {
  vpMapProfileVisible = !vpMapProfileVisible;
  var strip = document.getElementById('mapProfileStrip');
  var btn = document.getElementById('vpToggleBtn');
  if (strip) strip.style.display = vpMapProfileVisible ? '' : 'none';
  if (btn) {
    btn.textContent = vpMapProfileVisible ? '📊 Profil (An)' : '📊 Profil (Aus)';
    btn.style.background = vpMapProfileVisible ? '#2E8B57' : '#444';
  }
  if (vpMapProfileVisible) {
    renderMapProfile();
    vpResumeMapProfile('profile-toggle');
    // Marker wieder anzeigen, falls er existiert
    if (vpPositionLeafletMarker && map) vpPositionLeafletMarker.addTo(map);
  } else {
    vpPauseMapProfileWork('profile-toggle');
    // Marker von der Karte entfernen, wenn Profil ausgeblendet
    if (vpPositionLeafletMarker && map) map.removeLayer(vpPositionLeafletMarker);
  }
  // Invalidate map size since space changed
  if (typeof map !== 'undefined' && map) setTimeout(() => map.invalidateSize(), 100);
}
function vpEnsureMapProfileVisible() {
  var reason = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'route';
  vpMapProfileVisible = true;
  var strip = document.getElementById('mapProfileStrip');
  var btn = document.getElementById('vpToggleBtn');
  if (strip) strip.style.display = '';
  if (btn) {
    btn.textContent = '📊 Profil (An)';
    btn.style.background = '#2E8B57';
  }
  if (typeof initProfileResize === 'function') initProfileResize();
  if (typeof map !== 'undefined' && map && typeof map.invalidateSize === 'function') {
    setTimeout(() => map.invalidateSize(), 80);
  }
  var hasRoute = typeof routeWaypoints !== 'undefined' && Array.isArray(routeWaypoints) && routeWaypoints.length >= 2;
  if (hasRoute && typeof triggerVerticalProfileUpdate === 'function') {
    triggerVerticalProfileUpdate();
  } else if (document.getElementById('verticalProfileCanvas') && typeof renderVerticalProfile === 'function') {
    renderVerticalProfile('verticalProfileCanvas');
  }
  if (typeof renderMapProfile === 'function') renderMapProfile();
  vpResumeMapProfile(reason);
  if (window.gaDebugPush) window.gaDebugPush('profile', 'Map profile ensured visible', {
    reason,
    hasRoute
  });
}
window.vpEnsureMapProfileVisible = vpEnsureMapProfileVisible;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) vpPauseMapProfileWork('document-hidden');else vpResumeMapProfile('document-visible');
});
function syncAltFromMap(val) {
  var mainSlider = document.getElementById('altSlider');
  if (mainSlider) mainSlider.value = val;
  document.getElementById('altMapDisplay').textContent = val;
  handleSliderChange('alt', val);
  renderMapProfile();
  if (typeof renderAirspaceWarningsList === 'function') renderAirspaceWarningsList();
}

// Globale Fast-Render Steuerung (Nun in app.js definiert)

var vpHighResFetchTimeout = null;
function vpZoom(delta) {
  window.activateFastRender();
  vpZoomLevel = Math.max(10, Math.min(100, vpZoomLevel + delta));
  var zd = document.getElementById('vpZoomDisplay');
  if (zd) zd.textContent = Math.round((100 - vpZoomLevel) / 90 * 100) + '%';

  // Ruckelfrei mit der Interaktions-Framerate rendern statt bei jedem Event
  if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();

  // High-Res API Debounce
  if (vpHighResFetchTimeout) clearTimeout(vpHighResFetchTimeout);
  if (vpZoomLevel < 100 && routeWaypoints && routeWaypoints.length >= 2) {
    vpHighResFetchTimeout = setTimeout(() => {
      fetchHighResElevation().then(() => {
        if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
      });
    }, 400);
  } else if (vpZoomLevel === 100) {
    vpHighResData = null;
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
  }
}
function fetchHighResElevation() {
  return _fetchHighResElevation.apply(this, arguments);
}
function _fetchHighResElevation() {
  _fetchHighResElevation = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee33() {
    var routeKey, requestedRoute, isCurrent, interpolated, cumulativeDist, i, p1, p2, lat1, lon1, lat2, lon2, segDist, steps, j, f, samplePts, _i33, idx, lats, lons, terrariumData, res, data, _t34;
    return _regenerator().w(function (_context40) {
      while (1) switch (_context40.p = _context40.n) {
        case 0:
          if (!(!routeWaypoints || routeWaypoints.length < 2)) {
            _context40.n = 1;
            break;
          }
          return _context40.a(2);
        case 1:
          routeKey = () => routeWaypoints.map(p => {
            var _p$lng2;
            return `${p.lat},${(_p$lng2 = p.lng) !== null && _p$lng2 !== void 0 ? _p$lng2 : p.lon}`;
          }).join('|');
          requestedRoute = routeKey();
          isCurrent = () => vpZoomLevel < 100 && routeKey() === requestedRoute;
          interpolated = [];
          cumulativeDist = 0;
          i = 0;
        case 2:
          if (!(i < routeWaypoints.length - 1)) {
            _context40.n = 8;
            break;
          }
          p1 = routeWaypoints[i], p2 = routeWaypoints[i + 1];
          lat1 = p1.lat, lon1 = p1.lng || p1.lon;
          lat2 = p2.lat, lon2 = p2.lng || p2.lon;
          segDist = calcNav(lat1, lon1, lat2, lon2).dist; // Higher resolution: every 0.25 NM instead of 1 NM
          steps = Math.max(1, Math.round(segDist * 4));
          j = 0;
        case 3:
          if (!(j <= steps)) {
            _context40.n = 6;
            break;
          }
          if (!(i > 0 && j === 0)) {
            _context40.n = 4;
            break;
          }
          return _context40.a(3, 5);
        case 4:
          f = j / steps;
          interpolated.push({
            lat: lat1 + (lat2 - lat1) * f,
            lon: lon1 + (lon2 - lon1) * f,
            distNM: cumulativeDist + segDist * f
          });
        case 5:
          j++;
          _context40.n = 3;
          break;
        case 6:
          cumulativeDist += segDist;
        case 7:
          i++;
          _context40.n = 2;
          break;
        case 8:
          // Resample to max 100 points
          samplePts = interpolated;
          if (interpolated.length > 100) {
            samplePts = [];
            for (_i33 = 0; _i33 < 100; _i33++) {
              idx = Math.round(_i33 * (interpolated.length - 1) / 99);
              samplePts.push(interpolated[idx]);
            }
          }
          lats = samplePts.map(p => p.lat.toFixed(5)).join(',');
          lons = samplePts.map(p => p.lon.toFixed(5)).join(',');
          _context40.p = 9;
          _context40.n = 10;
          return vpFetchElevationFromTerrarium(samplePts);
        case 10:
          terrariumData = _context40.v;
          if (isCurrent()) {
            _context40.n = 11;
            break;
          }
          return _context40.a(2);
        case 11:
          if (!(terrariumData && terrariumData.length === samplePts.length)) {
            _context40.n = 12;
            break;
          }
          vpHighResData = terrariumData;
          window.vpTerrainElevationSource = 'terrarium';
          return _context40.a(2);
        case 12:
          if (!vpIsElevationCoolingDown()) {
            _context40.n = 13;
            break;
          }
          return _context40.a(2);
        case 13:
          if (window.vpWeatherDebug) window.vpWeatherDebug.elevationNetworkRequests += 1;
          _context40.n = 14;
          return vpFetchResource('https://api.open-meteo.com/v1/elevation?latitude=' + lats + '&longitude=' + lons);
        case 14:
          res = _context40.v;
          if (!(res.status === 429)) {
            _context40.n = 15;
            break;
          }
          vpRecordElevation429();
          return _context40.a(2);
        case 15:
          if (res.ok) {
            _context40.n = 16;
            break;
          }
          return _context40.a(2);
        case 16:
          _context40.n = 17;
          return res.json();
        case 17:
          data = _context40.v;
          if (isCurrent()) {
            _context40.n = 18;
            break;
          }
          return _context40.a(2);
        case 18:
          if (!(!data.elevation || data.elevation.length !== samplePts.length)) {
            _context40.n = 19;
            break;
          }
          return _context40.a(2);
        case 19:
          vpHighResData = samplePts.map((p, i) => ({
            distNM: p.distNM,
            elevFt: Math.round(data.elevation[i] * 3.28084),
            lat: p.lat,
            lon: p.lon
          }));
          window.vpTerrainElevationSource = 'openmeteo';
          _context40.n = 21;
          break;
        case 20:
          _context40.p = 20;
          _t34 = _context40.v;
          console.error('High-res elevation fetch error:', _t34);
        case 21:
          return _context40.a(2);
      }
    }, _callee33, null, [[9, 20]]);
  }));
  return _fetchHighResElevation.apply(this, arguments);
}
function renderMapProfile() {
  // Sicherheitsnetz: explizite Render-Aufrufe sollen den statischen Layer
  // immer neu zeichnen, damit Karten-Edits und Menü-Toggles sichtbar werden.
  window.vpBgNeedsUpdate = true;
  vpRequestMapProfileFrameNow();
}
function vpGetMapProfileElevationData(isHdgMode) {
  if (isHdgMode) {
    return Array.isArray(vpHdgElevData) && vpHdgElevData.length >= 2 ? vpHdgElevData : null;
  }
  if (vpZoomLevel < 100 && Array.isArray(vpHighResData) && vpHighResData.length >= 2) {
    return vpHighResData;
  }
  if (Array.isArray(vpElevationData) && vpElevationData.length >= 2) {
    return vpElevationData;
  }
  if (Array.isArray(window.vpElevationData) && window.vpElevationData.length >= 2) {
    vpElevationData = window.vpElevationData;
    return vpElevationData;
  }
  return null;
}
function vpIsProfileLowFpsMode() {
  try {
    if (typeof window.isLowFpsMode === 'function') return !!window.isLowFpsMode();
    if (typeof window.isMapHintEnabled === 'function') return !!window.isMapHintEnabled('lowFps');
    if (document.body && document.body.classList.contains('low-fps-mode')) return true;
    return localStorage.getItem('ga_map_hint_lowFps') === 'true';
  } catch (_) {
    return false;
  }
}
function vpGetMapProfileTargetFps(isHdgMode) {
  var lowFpsMode = vpIsProfileLowFpsMode();
  var isInteracting = !!(window.vpIsFastRendering || window.vpUIInteractionActive === true || window.vpProfilePanActive === true || window.vpDraggingPosMarker === true || typeof vpResizeActive !== 'undefined' && vpResizeActive || typeof vpDraggingWP !== 'undefined' && vpDraggingWP >= 0 || typeof vpDraggingSegment !== 'undefined' && !!vpDraggingSegment);
  if (isInteracting) return lowFpsMode ? VP_PROFILE_FPS_INTERACT_LOW : VP_PROFILE_FPS_INTERACT;
  var obsSrc = isHdgMode ? vpHdgObstacles : vpObstacles;
  var hasObstacleAnim = vpShowObstacles && Array.isArray(obsSrc) && obsSrc.length > 0;
  var hasWeatherAnim = !!vpShowClouds;
  var hasAirspacePulse = typeof vpHighlightPulseIdx !== 'undefined' && vpHighlightPulseIdx >= 0;
  var hasTrafficAnim = !!(window.vpTrafficProfileVisible && window.vpTrafficData && window.vpTrafficData.length);
  var hasPrediction = !!(window.vpPredictionData && window.vpPredictionData.length);
  var hasActiveAnimation = hasObstacleAnim || hasWeatherAnim || hasAirspacePulse || hasTrafficAnim || hasPrediction || isHdgMode;
  if (!hasActiveAnimation) return VP_PROFILE_FPS_IDLE;
  return lowFpsMode ? VP_PROFILE_FPS_ACTIVE_LOW : VP_PROFILE_FPS_ACTIVE;
}

// ─── TRAFFIC PROJEKTION AUF ROUTE ────────────────────────────────────────────
function vpProjectTrafficOnRoute(elevData) {
  var _window$vpTrafficData;
  if (!((_window$vpTrafficData = window.vpTrafficData) !== null && _window$vpTrafficData !== void 0 && _window$vpTrafficData.length) || !(elevData !== null && elevData !== void 0 && elevData.length)) return [];
  var MAX_LAT_NM = 5;
  var result = [];
  var _iterator57 = _createForOfIteratorHelper(window.vpTrafficData),
    _step57;
  try {
    for (_iterator57.s(); !(_step57 = _iterator57.n()).done;) {
      var ac = _step57.value;
      var bestDist = Infinity,
        bestDistNM = 0;
      var _iterator58 = _createForOfIteratorHelper(elevData),
        _step58;
      try {
        for (_iterator58.s(); !(_step58 = _iterator58.n()).done;) {
          var ep = _step58.value;
          if (ep.lat == null) continue;
          var d = calcNav(ac.lat, ac.lon, ep.lat, ep.lon).dist;
          if (d < bestDist) {
            bestDist = d;
            bestDistNM = ep.distNM;
          }
        }
      } catch (err) {
        _iterator58.e(err);
      } finally {
        _iterator58.f();
      }
      if (bestDist <= MAX_LAT_NM) {
        result.push({
          id: ac.id,
          callsign: ac.callsign,
          projDistNM: bestDistNM,
          altFt: ac.alt,
          lateralNM: bestDist
        });
      }
    }
  } catch (err) {
    _iterator57.e(err);
  } finally {
    _iterator57.f();
  }
  return result;
}

// ─── TRAFFIC PROJEKTION AUF HEADING (HDG-MODUS) ──────────────────────────────
function vpProjectTrafficOnHeading() {
  var _window$vpTrafficData2;
  if (!((_window$vpTrafficData2 = window.vpTrafficData) !== null && _window$vpTrafficData2 !== void 0 && _window$vpTrafficData2.length) || !window.lastLiveGpsPos) return [];
  var _window$lastLiveGpsPo3 = window.lastLiveGpsPos,
    oLat = _window$lastLiveGpsPo3.lat,
    oLon = _window$lastLiveGpsPo3.lon,
    oHdg = _window$lastLiveGpsPo3.hdg;
  var gs = typeof smoothedGS !== 'undefined' && smoothedGS > 20 ? smoothedGS : 80;
  var hdgRad = oHdg * Math.PI / 180;
  var hdgSin = Math.sin(hdgRad),
    hdgCos = Math.cos(hdgRad);
  var MAX_LAT_NM = 5;
  var minAlongNM = -(VP_HDG_LOOKBACK_MIN * gs / 60);
  var maxAlongNM = VP_HDG_LOOKAHEAD_MIN * gs / 60;
  var result = [];
  var _iterator59 = _createForOfIteratorHelper(window.vpTrafficData),
    _step59;
  try {
    for (_iterator59.s(); !(_step59 = _iterator59.n()).done;) {
      var ac = _step59.value;
      var dLatNM = (ac.lat - oLat) * 60;
      var dLonNM = (ac.lon - oLon) * 60 * Math.cos(oLat * Math.PI / 180);
      var along = dLonNM * hdgSin + dLatNM * hdgCos; // NM entlang Heading
      var cross = Math.abs(-dLonNM * hdgCos + dLatNM * hdgSin); // NM quer
      if (cross > MAX_LAT_NM || along < minAlongNM || along > maxAlongNM) continue;
      // Im HDG-Modus: distNM speichert Minuten (gleich wie vpHdgElevData)
      var timeMin = VP_HDG_LOOKBACK_MIN + along / (gs / 60);
      result.push({
        id: ac.id,
        callsign: ac.callsign,
        projDistNM: timeMin,
        altFt: ac.alt,
        lateralNM: cross
      });
    }
  } catch (err) {
    _iterator59.e(err);
  } finally {
    _iterator59.f();
  }
  return result;
}

// ─── TRAFFIC IM VERTIKALPROFIL ZEICHNEN ──────────────────────────────────────
function vpDrawTrafficInProfile(fgCtx, xOf, yOf, elevData, isHdgMode, viewMinX, viewMaxX) {
  var _ref33, _window$lastLiveGpsPo4, _window$lastLiveGpsPo5;
  if (!window.vpTrafficProfileVisible) return;
  var traffic = isHdgMode ? vpProjectTrafficOnHeading() : vpProjectTrafficOnRoute(elevData);
  if (!traffic.length) return;
  var ownAlt = (_ref33 = (_window$lastLiveGpsPo4 = (_window$lastLiveGpsPo5 = window.lastLiveGpsPos) === null || _window$lastLiveGpsPo5 === void 0 ? void 0 : _window$lastLiveGpsPo5.alt) !== null && _window$lastLiveGpsPo4 !== void 0 ? _window$lastLiveGpsPo4 : vpLiveAltFt) !== null && _ref33 !== void 0 ? _ref33 : 0;
  var _iterator60 = _createForOfIteratorHelper(traffic),
    _step60;
  try {
    for (_iterator60.s(); !(_step60 = _iterator60.n()).done;) {
      var ac = _step60.value;
      var tx = xOf(ac.projDistNM);
      var ty = yOf(ac.altFt);
      if (tx < viewMinX - 30 || tx > viewMaxX + 30) continue;
      var relAlt = Math.round((ac.altFt - ownAlt) / 100) * 100;
      var relAltStr = (relAlt >= 0 ? '+' : '') + relAlt;
      var relAltColor = Math.abs(relAlt) < 300 ? '#ff8800' : relAlt > 0 ? '#44ff44' : '#888888';
      fgCtx.save();
      fgCtx.translate(tx, ty);

      // Flugzeug-Silhouette (Seitenansicht, schaut nach rechts)
      fgCtx.fillStyle = '#00ccff';
      fgCtx.strokeStyle = 'rgba(0,0,0,0.6)';
      fgCtx.lineWidth = 0.5;

      // Rumpf
      fgCtx.beginPath();
      fgCtx.ellipse(0, 0, 7, 2, 0, 0, Math.PI * 2);
      fgCtx.fill();
      fgCtx.stroke();

      // Tragfläche (oben)
      fgCtx.beginPath();
      fgCtx.moveTo(-7, -1);
      fgCtx.lineTo(5, -1);
      fgCtx.lineTo(4, 1.5);
      fgCtx.lineTo(-6, 1.5);
      fgCtx.closePath();
      fgCtx.fill();
      fgCtx.stroke();

      // Leitwerk (hinten oben)
      fgCtx.beginPath();
      fgCtx.moveTo(-7, -1);
      fgCtx.lineTo(-4, -4);
      fgCtx.lineTo(-2, -1);
      fgCtx.closePath();
      fgCtx.fill();
      fgCtx.stroke();

      // Relative Höhe
      fgCtx.fillStyle = relAltColor;
      fgCtx.font = gaEfbProfileFont('bold 8px monospace');
      fgCtx.textAlign = 'center';
      gaEfbCanvasFillText(fgCtx, relAltStr, 0, -11);

      // Callsign (wenn vorhanden)
      if (ac.callsign) {
        fgCtx.fillStyle = 'rgba(0, 200, 255, 0.75)';
        fgCtx.font = gaEfbProfileFont('7px monospace');
        gaEfbCanvasFillText(fgCtx, ac.callsign, 0, 14);
      }
      fgCtx.restore();
    }
  } catch (err) {
    _iterator60.e(err);
  } finally {
    _iterator60.f();
  }
}
window.vpToggleTrafficProfile = function () {
  window.vpTrafficProfileVisible = !window.vpTrafficProfileVisible;
  updateTrafficProfileBtn();
};
function renderMapProfileFrames(timeMs) {
  var _document$getElementB7, _document$getElementB8, _window$vpLiveRouteDi;
  var frameT0 = performance && performance.now ? performance.now() : Date.now();
  if (!vpCanRunVisibleMapProfileWork()) {
    vpStopMapProfileFrameLoop();
    return;
  }
  var fgCanvas = document.getElementById('mapProfileCanvas');
  var bgCanvas = document.getElementById('mapProfileCanvasBg');
  var scrollContainer = document.getElementById('mapProfileScroll');
  var wrapper = document.getElementById('vpCanvasWrapper');
  if (!fgCanvas || !bgCanvas || !scrollContainer || !wrapper) {
    vpScheduleMapProfileFrame(250);
    return;
  }
  var isHdgMode = typeof vpMode !== 'undefined' && vpMode === 'HDG';
  var perfMeta = window.vpAnimFrameMeta || (window.vpAnimFrameMeta = {
    lastPaintMs: 0,
    lastTargetFps: 0
  });
  var targetFps = vpGetMapProfileTargetFps(isHdgMode);
  var frameIntervalMs = 1000 / Math.max(1, targetFps);
  var nowMs = Number.isFinite(timeMs) ? timeMs : performance.now();
  var elapsedMs = nowMs - (Number(perfMeta.lastPaintMs) || 0);
  if (!window.vpBgNeedsUpdate && elapsedMs < frameIntervalMs) {
    vpScheduleMapProfileFrame(frameIntervalMs - elapsedMs);
    return;
  }
  var elevData = vpGetMapProfileElevationData(isHdgMode);
  if (!elevData || elevData.length < 2) {
    window.vpBgNeedsUpdate = true;
    perfMeta.lastNoElevationMs = nowMs;
    vpScheduleMapProfileFrame(250);
    return;
  }
  perfMeta.lastPaintMs = nowMs;
  perfMeta.lastTargetFps = targetFps;
  var containerHeight = scrollContainer.clientHeight || 100;
  var baseWidth = scrollContainer.clientWidth || 600;
  var zoomFactor = 100 / vpZoomLevel;

  // Virtuelle Breite für die Scrollbar
  var virtualWidth = Math.round(baseWidth * zoomFactor);
  if (wrapper.style.width !== virtualWidth + 'px') wrapper.style.width = virtualWidth + 'px';

  // Canvas bleibt immer exakt so groß wie der sichtbare Bildschirm! (Kein iOS Absturz mehr)
  var dpr = window.devicePixelRatio || 1;
  var targetW = baseWidth * dpr;
  var targetH = containerHeight * dpr;
  var padLeft = 33,
    padRight = 16,
    padTop = 12,
    padBottom = 22;
  var plotW = virtualWidth - padLeft - padRight;
  var plotH = containerHeight - padTop - padBottom;
  var cruiseAlt = parseInt(((_document$getElementB7 = document.getElementById('altMapInput')) === null || _document$getElementB7 === void 0 ? void 0 : _document$getElementB7.textContent) || ((_document$getElementB8 = document.getElementById('altSlider')) === null || _document$getElementB8 === void 0 ? void 0 : _document$getElementB8.value) || 4500);
  var tas = vpGetProfileTas();
  var totalDist = elevData[elevData.length - 1].distNM;
  var maxTerrain = Math.max.apply(Math, _toConsumableArray(elevData.map(p => p.elevFt)));
  var autoMaxAlt = Math.max(cruiseAlt + 2500, maxTerrain + 1000);
  var currentMaxAlt = vpMaxAltOverride > 0 ? vpMaxAltOverride : autoMaxAlt;

  // PERFORMANCE & UX FIX: Y-Achse während des Ziehens einfrieren!
  var isDragging = typeof vpDraggingWP !== 'undefined' && vpDraggingWP >= 0 || typeof vpDraggingSegment !== 'undefined' && !!vpDraggingSegment || window.vpDraggingPosMarker === true;
  if (isDragging) {
    if (!window._vpFrozenMaxAlt) window._vpFrozenMaxAlt = currentMaxAlt;
    currentMaxAlt = window._vpFrozenMaxAlt;
  } else {
    window._vpFrozenMaxAlt = null;
  }
  var maxAlt = currentMaxAlt;
  var minAlt = 0;
  var fpResult = typeof computeFlightProfile === 'function' ? computeFlightProfile(elevData, cruiseAlt, vpClimbRate, vpDescentRate, tas) : null;
  var xOf = distNM => padLeft + distNM / totalDist * plotW;
  var yOf = altFt => padTop + plotH - (altFt - minAlt) / (maxAlt - minAlt) * plotH;
  var maxScroll = Math.max(0, virtualWidth - baseWidth);
  var viewXRaw = scrollContainer.scrollLeft;
  var viewX = Math.min(viewXRaw, maxScroll);

  // Zwinge die Scrollbar sofort zurück, falls wir durch Auszoomen im Nichts gelandet sind
  if (viewXRaw > maxScroll) {
    scrollContainer.scrollLeft = maxScroll;
  }
  if (viewX !== window._vpLastScrollLeft) {
    window.vpBgNeedsUpdate = true;
    window._vpLastScrollLeft = viewX;
  }

  // Hardwarebeschleunigtes Mitführen der Leinwände (GPU Magic)
  bgCanvas.style.transform = `translateX(${viewX}px)`;
  fgCanvas.style.transform = `translateX(${viewX}px)`;
  var viewMinX = viewX - 50;
  var viewMaxX = viewX + baseWidth + 50;

  // NEU: Luftraum-Render-Logik als wiederverwendbare Funktion (für BG und FG)
  var drawAirspaces = (targetCtx, isFg) => {
    var occupiedASLabels = [];
    if (typeof activeAirspaces !== 'undefined' && activeAirspaces.length > 0) {
      var cachedAirspaces = getCachedAirspaceIntersections(elevData, totalDist);
      var _iterator61 = _createForOfIteratorHelper(cachedAirspaces),
        _step61;
      try {
        var _loop8 = function _loop8() {
          var item = _step61.value;
          var asIdx = item.asIdx,
            as = item.as,
            lowerFt = item.lowerFt,
            upperFt = item.upperFt,
            isLowerAgl = item.isLowerAgl,
            isUpperAgl = item.isUpperAgl,
            asMinDist = item.asMinDist,
            asMaxDist = item.asMaxDist,
            relevantPts = item.relevantPts;
          var style = getAirspaceStyle(as);
          var x1 = xOf(asMinDist),
            x2 = xOf(asMaxDist);
          var isHighlighted = !!isFg && typeof vpHighlightPulseIdx !== 'undefined' && vpHighlightPulseIdx >= 0 && asIdx === vpHighlightPulseIdx;
          var phase = typeof vpPulsePhase !== 'undefined' ? vpPulsePhase : 0;
          var pulseOpacity = isHighlighted ? 0.2 + 0.4 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2)) : isFg ? 0.22 : 0.15;
          var strokeOpacity = isHighlighted ? 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2)) : 0.5;
          var lineW = isHighlighted ? 2 + 2 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2)) : 2;
          targetCtx.fillStyle = vpHexToRgba(style.color, pulseOpacity);
          targetCtx.strokeStyle = vpHexToRgba(style.color, strokeOpacity);
          targetCtx.lineWidth = lineW;
          targetCtx.setLineDash(isHighlighted ? [] : [3, 3]);

          // Airspace-Form zeichnen: MSL → exaktes Rechteck, AGL → Gelände-Polygon
          targetCtx.beginPath();
          if (!isLowerAgl && !isUpperAgl) {
            var ry1 = yOf(Math.min(upperFt, maxAlt));
            var ry2 = yOf(Math.max(lowerFt, minAlt));
            targetCtx.moveTo(xOf(asMinDist), ry1);
            targetCtx.lineTo(xOf(asMaxDist), ry1);
            targetCtx.lineTo(xOf(asMaxDist), ry2);
            targetCtx.lineTo(xOf(asMinDist), ry2);
          } else {
            for (var i = 0; i < relevantPts.length; i++) {
              var p = relevantPts[i];
              var realUpper = isUpperAgl ? p.elevFt + upperFt : upperFt;
              var y = yOf(Math.min(realUpper, maxAlt));
              if (i === 0) targetCtx.moveTo(xOf(p.distNM), y);else targetCtx.lineTo(xOf(p.distNM), y);
            }
            for (var _i19 = relevantPts.length - 1; _i19 >= 0; _i19--) {
              var _p2 = relevantPts[_i19];
              var realLower = isLowerAgl ? _p2.elevFt + lowerFt : lowerFt;
              targetCtx.lineTo(xOf(_p2.distNM), yOf(Math.max(realLower, minAlt)));
            }
          }
          targetCtx.closePath();
          targetCtx.fill();
          targetCtx.stroke();
          targetCtx.setLineDash([]);
          var sumUpper = 0;
          relevantPts.forEach(p => sumUpper += isUpperAgl ? p.elevFt + upperFt : upperFt);
          var avgUpper = sumUpper / relevantPts.length;
          var labelY = yOf(Math.min(avgUpper, maxAlt));
          labelY = Math.max(padTop + 15, labelY);
          if (!window.vpIsFastRendering && (zoomFactor >= 1.5 || x2 - x1 > 40 || isHighlighted)) {
            var displayName = getAirspaceDisplayName(as);
            targetCtx.font = gaEfbProfileFont(isHighlighted ? 'bold 11px Arial' : 'bold 10px Arial');
            var tw = targetCtx.measureText(displayName).width;
            var tLeft = (x1 + x2) / 2 - tw / 2,
              tRight = tLeft + tw;
            var collision = false;
            if (!isHighlighted) {
              var _iterator62 = _createForOfIteratorHelper(occupiedASLabels),
                _step62;
              try {
                for (_iterator62.s(); !(_step62 = _iterator62.n()).done;) {
                  var occ = _step62.value;
                  if (tLeft < occ.r && tRight > occ.l && labelY < occ.b && labelY + 25 > occ.t) {
                    collision = true;
                    break;
                  }
                }
              } catch (err) {
                _iterator62.e(err);
              } finally {
                _iterator62.f();
              }
            }
            if (!collision) {
              if (!isHighlighted) occupiedASLabels.push({
                l: tLeft - 5,
                r: tRight + 5,
                t: labelY - 5,
                b: labelY + 25
              });
              targetCtx.fillStyle = vpHexToRgba(style.color, isHighlighted ? 0.9 : 0.6);
              targetCtx.textAlign = 'center';
              gaEfbCanvasFillText(targetCtx, displayName, (x1 + x2) / 2, labelY + 12);
              if (zoomFactor >= 2 || isHighlighted) {
                targetCtx.font = gaEfbProfileFont('9px Arial');
                gaEfbCanvasFillText(targetCtx, formatAsLimit(as.lowerLimit) + ' – ' + formatAsLimit(as.upperLimit), (x1 + x2) / 2, labelY + 23);
              }
            }
          }
        };
        for (_iterator61.s(); !(_step61 = _iterator61.n()).done;) {
          _loop8();
        }
      } catch (err) {
        _iterator61.e(err);
      } finally {
        _iterator61.f();
      }
    }
    targetCtx.textAlign = 'left';
  };

  // =======================================================
  // LAYER 1: STATISCHER HINTERGRUND
  // =======================================================
  var needsBgRender = window.vpBgNeedsUpdate || bgCanvas.width !== targetW || bgCanvas.height !== targetH;
  if (needsBgRender) {
    var bgT0 = performance && performance.now ? performance.now() : Date.now();
    if (bgCanvas.width !== targetW || bgCanvas.height !== targetH) {
      bgCanvas.width = targetW;
      bgCanvas.height = targetH;
      bgCanvas.style.width = baseWidth + 'px';
      bgCanvas.style.height = containerHeight + 'px';
    }
    var bgCtx = bgCanvas.getContext('2d');
    bgCtx.save();
    bgCtx.scale(dpr, dpr);
    bgCtx.translate(-viewX, 0); // Vektor-Koordinatensystem anpassen

    bgCtx.clearRect(viewX, 0, baseWidth, containerHeight);
    bgCtx.fillStyle = '#1a1a1a';
    bgCtx.fillRect(viewX, 0, baseWidth, containerHeight);
    var skyGrad = bgCtx.createLinearGradient(0, padTop, 0, padTop + plotH);
    skyGrad.addColorStop(0, '#1a2a3a');
    skyGrad.addColorStop(0.5, '#1a2030');
    skyGrad.addColorStop(1, '#151a20');
    bgCtx.fillStyle = skyGrad;
    bgCtx.fillRect(viewX, padTop, baseWidth, plotH);

    // Wolken explizit weit nach hinten: direkt nach dem Himmel zeichnen,
    // damit Landschaft, Landmarken und Hindernisse klar davor liegen.
    if (vpShowClouds) {
      if (vpWeatherRenderMode === 'abstrakt' || vpWeatherRenderMode === 'pro') vpDrawCloudsPro(bgCtx, xOf, yOf, padTop, plotH, totalDist, true, elevData);else vpDrawClouds(bgCtx, xOf, yOf, padTop, plotH, totalDist, true, elevData);
    }

    // Aufruf für Layer 1 (Statischer Hintergrund)
    if (vpAirspaceMode === 1) {
      drawAirspaces(bgCtx, false);
    }
    bgCtx.beginPath();
    bgCtx.setLineDash([4, 4]);
    bgCtx.strokeStyle = 'rgba(200, 120, 40, 0.4)';
    bgCtx.lineWidth = 1;
    for (var i = 0; i < elevData.length; i++) {
      var x = xOf(elevData[i].distNM),
        y = yOf(elevData[i].elevFt + 1000);
      if (i === 0) bgCtx.moveTo(x, y);else bgCtx.lineTo(x, y);
    }
    bgCtx.stroke();
    bgCtx.setLineDash([]);
    bgCtx.beginPath();
    bgCtx.moveTo(xOf(0), yOf(0));
    for (var _i20 = 0; _i20 < elevData.length; _i20++) bgCtx.lineTo(xOf(elevData[_i20].distNM), yOf(elevData[_i20].elevFt));
    bgCtx.lineTo(xOf(totalDist), yOf(0));
    bgCtx.closePath();
    var terrainGrad = bgCtx.createLinearGradient(0, yOf(maxTerrain), 0, yOf(0));
    terrainGrad.addColorStop(0, '#6B5B3C');
    terrainGrad.addColorStop(0.3, '#3B5B23');
    terrainGrad.addColorStop(0.7, '#1B5B22');
    terrainGrad.addColorStop(1, '#1E5B37');
    bgCtx.fillStyle = terrainGrad;
    bgCtx.fill();
    bgCtx.beginPath();
    for (var _i21 = 0; _i21 < elevData.length; _i21++) {
      var _x40 = xOf(elevData[_i21].distNM),
        _y6 = yOf(elevData[_i21].elevFt);
      if (_i21 === 0) bgCtx.moveTo(_x40, _y6);else bgCtx.lineTo(_x40, _y6);
    }
    bgCtx.strokeStyle = '#4a7a30';
    bgCtx.lineWidth = 1.5;
    bgCtx.stroke();

    // WÄLDER UND FLÜSSE GENERIEREN
    vpDrawTerrainCover(bgCtx, xOf, yOf, elevData, viewMinX, viewMaxX, zoomFactor, maxAlt);

    // Landmarken werden im Vordergrund gezeichnet (Top-Priorität),
    // damit Hindernisse/Linears dahinter liegen dürfen.

    bgCtx.textAlign = 'right';
    var altStep = maxAlt > 6000 ? 2000 : maxAlt > 3000 ? 1000 : 500;
    for (var alt = 0; alt <= maxAlt; alt += altStep) {
      var _y7 = yOf(alt);
      if (_y7 < padTop - 3 || _y7 > padTop + plotH + 3) continue;
      bgCtx.beginPath();
      bgCtx.strokeStyle = 'rgba(255,255,255,0.05)';
      bgCtx.lineWidth = 0.5;
      bgCtx.moveTo(viewX + padLeft, _y7);
      bgCtx.lineTo(viewX + baseWidth, _y7);
      bgCtx.stroke();
      bgCtx.fillStyle = '#fff';
      bgCtx.font = gaEfbProfileFont('bold 10px Arial');
      gaEfbCanvasFillText(bgCtx, alt >= 1000 ? (alt / 1000).toFixed(0) + 'k' : alt + '', viewX + padLeft - 3, _y7 + 3);
    }
    if (!isHdgMode) {
      vpDrawIsobars(bgCtx, xOf, yOf, padTop, plotH, viewMinX, viewMaxX, viewX + baseWidth - 4);
    }
    bgCtx.textAlign = 'center';
    if (isHdgMode) {
      // X-Achse in Minuten (HDG-Modus)
      var hdgHdgVal = window.lastLiveGpsPos ? Math.round(window.lastLiveGpsPos.hdg) : 0;
      var acX = xOf(VP_HDG_LOOKBACK_MIN);
      // Flugzeug-Trennlinie (senkrecht, gestrichelt)
      bgCtx.beginPath();
      bgCtx.setLineDash([3, 4]);
      bgCtx.strokeStyle = 'rgba(100,200,255,0.3)';
      bgCtx.lineWidth = 1;
      bgCtx.moveTo(acX, padTop);
      bgCtx.lineTo(acX, padTop + plotH);
      bgCtx.stroke();
      bgCtx.setLineDash([]);
      // Minuten-Ticks
      var tickStep = totalDist > 12 ? 5 : 2;
      for (var m = 0; m <= Math.ceil(totalDist); m += tickStep) {
        var _x41 = xOf(m);
        var label = m < VP_HDG_LOOKBACK_MIN ? `-${Math.round(VP_HDG_LOOKBACK_MIN - m)}m` : m === VP_HDG_LOOKBACK_MIN ? 'NOW' : `+${Math.round(m - VP_HDG_LOOKBACK_MIN)}m`;
        bgCtx.fillStyle = m === VP_HDG_LOOKBACK_MIN ? '#64c8ff' : '#666';
        bgCtx.font = gaEfbProfileFont(m === VP_HDG_LOOKBACK_MIN ? 'bold 8px Arial' : '8px Arial');
        gaEfbCanvasFillText(bgCtx, label, _x41, containerHeight - 1);
      }
      // Mode-Label oben links
      bgCtx.fillStyle = '#64c8ff';
      bgCtx.font = gaEfbProfileFont('bold 9px Arial');
      bgCtx.textAlign = 'left';
      gaEfbCanvasFillText(bgCtx, `HDG ${hdgHdgVal}°`, viewX + padLeft + 4, padTop + 10);
    } else {
      var distStep = totalDist > 150 ? 25 : totalDist > 80 ? 10 : 5;
      for (var d = distStep; d < totalDist; d += distStep) {
        bgCtx.fillStyle = '#666';
        bgCtx.font = gaEfbProfileFont('8px Arial');
        gaEfbCanvasFillText(bgCtx, d + '', xOf(d), containerHeight - 1);
      }
    }
    var peakPt = elevData.reduce((max, p) => p.elevFt > max.elevFt ? p : max);
    bgCtx.fillStyle = '#aaa';
    bgCtx.font = gaEfbProfileFont('11px Arial');
    bgCtx.textAlign = 'center';
    gaEfbCanvasFillText(bgCtx, '▲', xOf(peakPt.distNM), yOf(peakPt.elevFt) - 3);
    bgCtx.font = gaEfbProfileFont('bold 9px Arial');
    gaEfbCanvasFillText(bgCtx, peakPt.elevFt + ' ft', xOf(peakPt.distNM), yOf(peakPt.elevFt) - 13);
    bgCtx.strokeStyle = '#333';
    bgCtx.lineWidth = 1;
    bgCtx.strokeRect(padLeft, padTop, plotW, plotH);
    bgCtx.restore();
    window.vpBgNeedsUpdate = false;
    if (window.vpProfilePerfWarn) {
      window.vpProfilePerfWarn('Profile map background render', bgT0, {
        elevPoints: Array.isArray(elevData) ? elevData.length : 0,
        width: Math.round(baseWidth),
        height: Math.round(containerHeight),
        zoomFactor: Math.round(zoomFactor * 100) / 100
      }, 90);
    }
  }

  // =======================================================
  // LAYER 2: DYNAMISCHER VORDERGRUND 
  // =======================================================
  if (fgCanvas.width !== targetW || fgCanvas.height !== targetH) {
    fgCanvas.width = targetW;
    fgCanvas.height = targetH;
    fgCanvas.style.width = baseWidth + 'px';
    fgCanvas.style.height = containerHeight + 'px';
  }
  var fgCtx = fgCanvas.getContext('2d');
  fgCtx.save();
  fgCtx.scale(dpr, dpr);
  fgCtx.translate(-viewX, 0);
  fgCtx.clearRect(viewX, 0, baseWidth, containerHeight);

  // Aufruf für Layer 2 (Dynamischer Vordergrund)
  if (vpAirspaceMode === 2) {
    drawAirspaces(fgCtx, true);
  }
  if (vpShowObstacles) {
    var obsSrc = isHdgMode ? vpHdgObstacles : vpObstacles;
    if (obsSrc && obsSrc.length > 0) {
      var obsT0 = performance && performance.now ? performance.now() : Date.now();
      vpDrawObstacles(fgCtx, xOf, yOf, totalDist, zoomFactor, elevData, timeMs, obsSrc);
      if (window.vpProfilePerfWarn) {
        window.vpProfilePerfWarn('Profile map obstacles render', obsT0, {
          obs: Array.isArray(obsSrc) ? obsSrc.length : 0,
          lin: Array.isArray(vpLinearFeatures) ? vpLinearFeatures.length : 0,
          zoomFactor: Math.round(zoomFactor * 100) / 100
        }, 90);
      }
    }
  }
  if (vpShowClouds) {
    if (vpWeatherRenderMode === 'abstrakt' || vpWeatherRenderMode === 'pro') vpDrawAnimatedWeatherPro(fgCtx, xOf, yOf, totalDist, elevData, timeMs, viewMinX, viewMaxX);else vpDrawAnimatedWeather(fgCtx, xOf, yOf, totalDist, elevData, timeMs, viewMinX, viewMaxX);
  }
  if (!isHdgMode) vpDrawWindComponentsOnIsobars(fgCtx, xOf, yOf, elevData, viewMinX, viewMaxX, padTop, plotH);

  // Im HDG-Modus: Fluglinie einblenden wenn Flugzeug ≤2 NM von der geplanten Route entfernt
  // X-Achse: NM-Offset vom aktuellen Standort → Minuten umrechnen (offsetNM / gs * 60)
  if (isHdgMode && typeof vpLiveGpsFraction === 'number' && vpLiveGpsFraction >= 0 && ((_window$vpLiveRouteDi = window.vpLiveRouteDistNM) !== null && _window$vpLiveRouteDi !== void 0 ? _window$vpLiveRouteDi : 999) <= 2.0 && typeof vpElevationData !== 'undefined' && vpElevationData && vpElevationData.length >= 2 && typeof computeFlightProfile === 'function') {
    var routeElevData = vpElevationData;
    var routeTotalDist = routeElevData[routeElevData.length - 1].distNM;
    var tasHdg = vpGetProfileTas();
    var fpRoute = computeFlightProfile(routeElevData, cruiseAlt, vpClimbRate, vpDescentRate, tasHdg);
    if (fpRoute && fpRoute.profile) {
      var _window$lastLiveGpsPo6;
      var liveDistNM = vpLiveGpsFraction * routeTotalDist;
      var gs = (((_window$lastLiveGpsPo6 = window.lastLiveGpsPos) === null || _window$lastLiveGpsPo6 === void 0 ? void 0 : _window$lastLiveGpsPo6.gs) > 20 ? window.lastLiveGpsPos.gs : null) || tasHdg;
      var hdgTotalMin = VP_HDG_LOOKBACK_MIN + VP_HDG_LOOKAHEAD_MIN;
      var _drawHdgFpLine = (offsetY, style, width) => {
        fgCtx.beginPath();
        var started = false;
        var _iterator63 = _createForOfIteratorHelper(fpRoute.profile),
          _step63;
        try {
          for (_iterator63.s(); !(_step63 = _iterator63.n()).done;) {
            var pt = _step63.value;
            var offsetNM = pt.distNM - liveDistNM;
            var minAxis = VP_HDG_LOOKBACK_MIN + offsetNM / gs * 60;
            if (minAxis < -0.5 || minAxis > hdgTotalMin + 0.5) {
              started = false;
              continue;
            }
            var _x42 = xOf(minAxis);
            if (_x42 < viewMinX - 60 || _x42 > viewMaxX + 60) {
              started = false;
              continue;
            }
            var _y8 = yOf(pt.altFt) + offsetY;
            if (!started) {
              fgCtx.moveTo(_x42, _y8);
              started = true;
            } else {
              fgCtx.lineTo(_x42, _y8);
            }
          }
        } catch (err) {
          _iterator63.e(err);
        } finally {
          _iterator63.f();
        }
        fgCtx.strokeStyle = style;
        fgCtx.lineWidth = width;
        fgCtx.stroke();
      };
      _drawHdgFpLine(1, 'rgba(0,0,0,0.3)', 3);
      _drawHdgFpLine(0, '#ff4444', 2);
    }
  }

  // Fluglinie (Climb/Cruise/Descend) und Route-Waypoint-Marker nur im RTE-Modus
  // Im HDG-Modus wären distNM-Werte (NM) falsch durch xOf() das Minuten erwartet
  if (!isHdgMode) {
    if (fpResult && fpResult.profile) {
      fgCtx.beginPath();
      var shStarted = false;
      for (var _i22 = 0; _i22 < fpResult.profile.length; _i22++) {
        var _x43 = xOf(fpResult.profile[_i22].distNM);
        if (_x43 < viewMinX - 100 && _i22 < fpResult.profile.length - 1 && xOf(fpResult.profile[_i22 + 1].distNM) < viewMinX) continue;
        if (_x43 > viewMaxX + 100 && _i22 > 0 && xOf(fpResult.profile[_i22 - 1].distNM) > viewMaxX) continue;
        var _y9 = yOf(fpResult.profile[_i22].altFt) + 1;
        if (!shStarted) {
          fgCtx.moveTo(_x43, _y9);
          shStarted = true;
        } else {
          fgCtx.lineTo(_x43, _y9);
        }
      }
      fgCtx.strokeStyle = 'rgba(0,0,0,0.3)';
      fgCtx.lineWidth = 3;
      fgCtx.stroke();
      fgCtx.beginPath();
      var rdStarted = false;
      for (var _i23 = 0; _i23 < fpResult.profile.length; _i23++) {
        var _x44 = xOf(fpResult.profile[_i23].distNM);
        if (_x44 < viewMinX - 100 && _i23 < fpResult.profile.length - 1 && xOf(fpResult.profile[_i23 + 1].distNM) < viewMinX) continue;
        if (_x44 > viewMaxX + 100 && _i23 > 0 && xOf(fpResult.profile[_i23 - 1].distNM) > viewMaxX) continue;
        var _y0 = yOf(fpResult.profile[_i23].altFt);
        if (!rdStarted) {
          fgCtx.moveTo(_x44, _y0);
          rdStarted = true;
        } else {
          fgCtx.lineTo(_x44, _y0);
        }
      }
      fgCtx.strokeStyle = '#ff4444';
      fgCtx.lineWidth = 2;
      fgCtx.stroke();
    }
  }

  // CRZ-Höhenlinie (gestrichelt, horizontal) – in beiden Modi
  fgCtx.beginPath();
  fgCtx.setLineDash([6, 4]);
  fgCtx.strokeStyle = 'rgba(255, 68, 68, 0.3)';
  fgCtx.lineWidth = 1;
  fgCtx.moveTo(Math.max(padLeft, viewMinX), yOf(cruiseAlt));
  fgCtx.lineTo(Math.min(padLeft + plotW, viewMaxX), yOf(cruiseAlt));
  fgCtx.stroke();
  fgCtx.setLineDash([]);
  fgCtx.fillStyle = 'rgba(255, 68, 68, 0.7)';
  fgCtx.font = gaEfbProfileFont('bold 10px Arial');
  fgCtx.textAlign = 'left';
  gaEfbCanvasFillText(fgCtx, 'CRZ ' + cruiseAlt + ' ft', Math.max(padLeft + 4, viewMinX + 4), yOf(cruiseAlt) - 4);

  // Im HDG-Modus: "JETZT"-Linie bei VP_HDG_LOOKBACK_MIN (Flugzeugposition)
  if (isHdgMode) {
    var nowX = xOf(VP_HDG_LOOKBACK_MIN);
    if (nowX >= viewMinX && nowX <= viewMaxX) {
      fgCtx.beginPath();
      fgCtx.setLineDash([3, 4]);
      fgCtx.strokeStyle = 'rgba(255,255,255,0.18)';
      fgCtx.lineWidth = 1;
      fgCtx.moveTo(nowX, padTop);
      fgCtx.lineTo(nowX, padTop + plotH);
      fgCtx.stroke();
      fgCtx.setLineDash([]);
      fgCtx.fillStyle = 'rgba(255,255,255,0.35)';
      fgCtx.font = gaEfbProfileFont('8px Arial');
      fgCtx.textAlign = 'center';
      gaEfbCanvasFillText(fgCtx, 'NOW', nowX, padTop + plotH + 12);
    }
  }

  // Route-Waypoint-Marker nur im RTE-Modus (Positionen in NM, im HDG unbrauchbar)
  if (!isHdgMode) {
    var wpCumDist = 0;
    for (var _i24 = 0; _i24 < routeWaypoints.length; _i24++) {
      if (_i24 > 0) wpCumDist += calcNav(routeWaypoints[_i24 - 1].lat, routeWaypoints[_i24 - 1].lng || routeWaypoints[_i24 - 1].lon, routeWaypoints[_i24].lat, routeWaypoints[_i24].lng || routeWaypoints[_i24].lon).dist;
      var _x45 = xOf(wpCumDist);
      if (_x45 < viewMinX - 40 || _x45 > viewMaxX + 40) continue;
      fgCtx.beginPath();
      fgCtx.setLineDash([2, 3]);
      fgCtx.strokeStyle = 'rgba(255,255,255,0.2)';
      fgCtx.lineWidth = 1;
      fgCtx.moveTo(_x45, padTop);
      fgCtx.lineTo(_x45, padTop + plotH);
      fgCtx.stroke();
      fgCtx.setLineDash([]);
      var wpLabel = typeof vpRouteWaypointLabel === 'function' ? vpRouteWaypointLabel(_i24, routeWaypoints[_i24]) : _i24 === 0 ? currentStartICAO || 'DEP' : routeWaypoints[_i24].name || 'WP' + _i24;
      if (!zoomFactor || zoomFactor < 2) {
        if (wpLabel.length > 6) wpLabel = wpLabel.substring(0, 5) + '…';
      } else {
        if (wpLabel.length > 12) wpLabel = wpLabel.substring(0, 11) + '…';
      }
      fgCtx.beginPath();
      fgCtx.arc(_x45, padTop + plotH + 3, 3, 0, Math.PI * 2);
      fgCtx.fillStyle = _i24 === 0 ? '#44ff44' : _i24 === routeWaypoints.length - 1 ? '#ff4444' : '#ffcc00';
      fgCtx.fill();
      fgCtx.fillStyle = '#bbb';
      fgCtx.font = gaEfbProfileFont(zoomFactor >= 2 ? 'bold 11px Arial' : 'bold 9px Arial');
      fgCtx.textAlign = 'center';
      gaEfbCanvasFillText(fgCtx, wpLabel, _x45, padTop + plotH + 16);
    }
  }

  // A: SCRUB-MARKER (Magenta Linie bei Hover)
  // Scrub-Marker nur im RTE-Modus (in HDG-Modus ist Position live-GPS-gesteuert)
  if (!isHdgMode && typeof vpPositionFraction === 'number' && vpPositionFraction >= 0) {
    var posX = xOf(vpPositionFraction * totalDist);
    if (posX >= viewMinX - 20 && posX <= viewMaxX + 20) {
      fgCtx.beginPath();
      fgCtx.strokeStyle = '#ff00ff';
      fgCtx.lineWidth = 1.5;
      fgCtx.moveTo(posX, padTop);
      fgCtx.lineTo(posX, padTop + plotH);
      fgCtx.stroke();
      fgCtx.beginPath();
      fgCtx.moveTo(posX, padTop + plotH + 2);
      fgCtx.lineTo(posX - 5, padTop + plotH + 10);
      fgCtx.lineTo(posX + 5, padTop + plotH + 10);
      fgCtx.closePath();
      fgCtx.fillStyle = '#ff00ff';
      fgCtx.fill();
    }
  }

  // B: LIVE-GPS-MARKER (Das Flugzeug)
  var _showLiveMarker = isHdgMode ? window.lastLiveGpsPos != null : typeof vpLiveGpsFraction === 'number' && vpLiveGpsFraction >= 0;
  if (_showLiveMarker) {
    var _window$lastLiveGpsPo7, _window$lastLiveGpsPo8;
    var liveX = isHdgMode ? xOf(VP_HDG_LOOKBACK_MIN) // Im HDG-Modus: leicht eingerückt vom linken Rand
    : xOf(vpLiveGpsFraction * totalDist);
    var _liveAlt = isHdgMode ? (_window$lastLiveGpsPo7 = (_window$lastLiveGpsPo8 = window.lastLiveGpsPos) === null || _window$lastLiveGpsPo8 === void 0 ? void 0 : _window$lastLiveGpsPo8.alt) !== null && _window$lastLiveGpsPo7 !== void 0 ? _window$lastLiveGpsPo7 : 0 : vpLiveAltFt;
    if (liveX >= viewMinX - 50 && liveX <= viewMaxX + 50) {
      var liveY = yOf(_liveAlt);

      // CSS Variablen auslesen
      var rootStyle = getComputedStyle(document.documentElement);
      var planeColor = rootStyle.getPropertyValue('--plane-color').trim() || '#f2c12e';
      var planeSizePx = parseInt(rootStyle.getPropertyValue('--plane-size')) || 40;
      fgCtx.save();
      fgCtx.translate(liveX, liveY);

      // Pitch-Rotation: Steig-/Sinkwinkel aus VS/GS berechnen
      // smoothedVS in ft/min → ft/s (/60), smoothedGS in kts → ft/s (*1.6878)
      var _vsPitch = typeof smoothedVS !== 'undefined' ? smoothedVS : 0;
      var _gsPitch = typeof smoothedGS !== 'undefined' && smoothedGS > 20 ? smoothedGS : 80;
      var _pitchRad = Math.atan2(_vsPitch / 60, _gsPitch * 1.6878);
      fgCtx.rotate(_pitchRad);

      // Berechnung der Skalierung (Basisbreite Path: 504.91)
      var baseScale = planeSizePx / 504.91;

      // Im Profil schaut das Flugzeug immer nach rechts (Richtung Zukunft).
      // sx=1: Nase bei x=504 → rechts, Heck bei x=0 → links (korrekte Ausrichtung).
      // Kein Flip basierend auf Heading — das Profil hat immer Vergangenheit links.
      fgCtx.scale(baseScale, baseScale);
      fgCtx.fillStyle = planeColor;

      // Side-View Path (ViewBox 504.91 x 184.69, Zentrum: 252.45, 92.35)
      var sideViewPath = new Path2D("M504.83,54.71l-.57-2.37a1.12,1.12,0,0,0-.84-.84,1.14,1.14,0,0,0-1.13.35,108.13,108.13,0,0,0-7.76,9.95,42.45,42.45,0,0,0-6.15,11.54,20.33,20.33,0,0,0-2.53-.45c-1.13-2.15-6.44-3.5-15.36-3.92-12.18-.81-42.61-3.25-51.64-4a13.91,13.91,0,0,1-3.4-.72l-.53-.2a15,15,0,0,1-1.62-.77c-5.49-3.07-19.3-10.65-29.11-14.65-7.6-3.09-12.88-5.24-18.9-6.51l-.8-.16a71.07,71.07,0,0,0-12.43-1.21,161,161,0,0,0-20.61,1.63v-.86a1.45,1.45,0,0,0-1.62-1.43c-2.38.28-6.23,1.11-7.08,3.5L320,44c-2.6-2-6.49-2.07-8.85-1.92a2,2,0,0,0-1.88,2.22l.15,1.42c-13.69,1.51-38.55,6-65.14,11.22l-.07-1.22A4.24,4.24,0,0,0,243,52.92l-17-16.46a.46.46,0,0,0-.65,0,.47.47,0,0,0,0,.65l17,16.46a3.36,3.36,0,0,1,1,2.22l.07,1.35c-19.92,3.91-40.74,8.21-58.51,11.94l-.22-4a4.17,4.17,0,0,0-1.29-2.83l-17-16.46a.46.46,0,0,0-.64.66l17,16.46a3.3,3.3,0,0,1,1,2.22l.23,4.2c-15.46,3.25-28.52,6.07-36.53,7.8a18.29,18.29,0,0,1-17.05-5.25L73.68,12.1a9.11,9.11,0,0,0-5-2.7V5.7A.68.68,0,0,0,68,5H67V1.89A1.89,1.89,0,0,0,65.08,0a1.89,1.89,0,0,0-1.89,1.89V5H62.13a.68.68,0,0,0-.67.68v4.55L38.14,15.42a4.46,4.46,0,0,0-1.16.41,4.74,4.74,0,0,0-1,.69,1.66,1.66,0,0,0-.45.69h0L24,18.84a.46.46,0,0,0,.06.92h.07l11.35-1.61a1.58,1.58,0,0,0,.82,1l.07,0a4.28,4.28,0,0,1,2.17,2.37l26.85,72a24.81,24.81,0,0,0-2.32,5.77L0,110.9l1.15.32c.18,0,18.4,5,48.57,5.2h0l17.32-4.16a1.51,1.51,0,0,1,1.34.31c1.35,1.13,5.76,3.21,20.08,4.44l.41,0-1.62,2.45a2.43,2.43,0,0,0,3.49,3.29l6.64-5c7.72.7,16.8,1.57,26.24,2.47,15.52,1.48,31.57,3,42.88,4,18.77,1.55,54.16,4.95,61,5.6l-19.28,7.63,39.35.54,3.63,6.59a1.32,1.32,0,0,0,1.52.63l1.57-.47a1.31,1.31,0,0,0,.8-1.84l-2.4-4.84,13.36.19.8,2.92,9.31-2.57,36.25,2v4.57l5.11,3.2c-3.29.8-18.46,4.51-24.31,6.06-6.22,1.65-9.95,2.88-9.29,6.17.41,2.05,2.4,3.68,4.29,5,3.29,2.3,6.84,3.11,10.19,3.73s6.52,1.17,9.34,1.65l5.46.93a13.62,13.62,0,0,0,27,1.79c.42-.06.87-.13,1.33-.22a41.71,41.71,0,0,0,10.61-3.56l.16-.07c2.56-1.25,6.42-3.13,5.92-6.53-.69-4.67-5.09-7.72-8.63-10.16-5.13-3.55-14.6-4.94-18.2-5.36v-7.41c3.37-.32,39.35-3.77,51.17-5.41,12.27-1.71,32.66-6.86,37-9.86.82.14,5.58.81,9.48-1.56v3.31l1.82,1.81a.78.78,0,0,0,1.34-.55v-5.27l7.93-1.18v.82l-7.77,7.73,7.05,3.51a11.14,11.14,0,0,1-3.52,1.38c-1.71.33-18.72-.25-26-.51a2.13,2.13,0,0,0-1.82,3.35l5.63,8.07a5.22,5.22,0,0,0,3.56,2.17,53.38,53.38,0,0,1,9.85,2.13L430,151.4a36.46,36.46,0,0,0,9.37,2.64,13.18,13.18,0,0,0,24.92-.47c.83-.36,1.67-.76,2.51-1.19l.49-.25c2.2-1.11,5.52-2.79,4.68-5.72a11.89,11.89,0,0,0-3.26-4.68l-.33-.34a45.54,45.54,0,0,0-7.27-6.28,29.74,29.74,0,0,0-7.87-3.61,56.48,56.48,0,0,0-5.57-1.47l-1.82-9.58,1.25-.19c4.59-.7,9.32-1.42,13.94-2.31,1.52-.3,3.07-.54,4.58-.78s3-.48,4.51-.77l.18,0c2.9-.56,5.89-1.13,8.24-3.11a21.78,21.78,0,0,0,7.26-11.85,64.85,64.85,0,0,0,1.29-8.49,37.13,37.13,0,0,0,15.63-8.15,2.93,2.93,0,0,0,1-2.35,3,3,0,0,0-1.22-2.31,43,43,0,0,0-6.18-3.8l8.32-19.79A2.86,2.86,0,0,0,504.83,54.71ZM321.27,80.13a3.12,3.12,0,0,1-2.14,1.07l-24,1.61a3.13,3.13,0,0,1-3-1.78l-6.32-13.25a3.11,3.11,0,0,1,2.16-4.4l29.13-6.25A3.13,3.13,0,0,1,320.84,60L322,77.86A3.09,3.09,0,0,1,321.27,80.13Zm67.42-6.44-21.6-30c5.14,1.29,10.06,3.29,16.65,6h0c9.75,4,23.52,11.53,29,14.59.34.19.68.36,1,.52-3.91,5.23-13.17,9.1-18.45,11a5.69,5.69,0,0,1-1.91.33A5.83,5.83,0,0,1,388.69,73.69Zm4.68,3h0Zm-.35,0-.33,0Zm-.4,0-.27,0Zm-.35,0-.31-.07Zm-.38-.09-.27-.07Zm-.34-.09-.31-.1Zm-.38-.13-.25-.1Zm-.33-.13-.29-.14Zm-.35-.17-.24-.13Zm-.31-.17-.28-.18Zm-.33-.21a1.88,1.88,0,0,1-.23-.16A1.88,1.88,0,0,0,389.85,75.56Zm-.3-.21-.26-.21Zm-14-.4a5.12,5.12,0,0,1-4.27,2.83l-36.16,2.38a5.21,5.21,0,0,1-3.89-1.38A5.16,5.16,0,0,1,329.57,75l-.26-15.32a5.33,5.33,0,0,1,4.77-5.4l23.15-2.51a9.58,9.58,0,0,1,9.11,4.31l9,13.75A5.11,5.11,0,0,1,375.58,75Zm12.87-.67a3.17,3.17,0,0,1-.21-.27A3.17,3.17,0,0,0,388.45,74.28Zm.27.32-.21-.25Zm0,0,.24.24Zm.53.51-.23-.21Zm4.19,1.53h0Zm1.81-.28.25-.08Zm-1.55.27h0Zm.26,0h0Zm.26,0,.14,0Zm.26,0,.15,0Zm.26,0,.15,0Zm.25-.07.17,0Zm44.66,54.37-3.46-1.25,5.23-4.35,1.93,2.46Z");

      // Zentrierung: immer -252.45 (unabhaengig von Spiegelung)
      // Beweis: path-Center (252.45, 92.35) → translate(-252.45,-92.35) → (0,0) → scale → (0,0) → an liveX,liveY ✓
      fgCtx.translate(-252.45, -92.35);
      fgCtx.strokeStyle = '#000';
      fgCtx.lineWidth = 32;
      fgCtx.lineJoin = 'round';
      fgCtx.lineCap = 'round';
      fgCtx.stroke(sideViewPath);
      fgCtx.fill(sideViewPath);
      fgCtx.restore();
    }
  }

  // C: PREDICTION VECTORS im Vertikalprofil
  var _predAvail = window.vpPredictionData && window.vpPredictionData.length > 0 && (isHdgMode || typeof vpLiveGpsFraction === 'number' && vpLiveGpsFraction >= 0);
  if (_predAvail) {
    var _window$lastLiveGpsPo9, _window$lastLiveGpsPo0;
    var baseDist = isHdgMode ? VP_HDG_LOOKBACK_MIN : vpLiveGpsFraction * totalDist;
    var baseX = xOf(baseDist);
    // Im HDG-Modus: Live-GPS-Hoehe verwenden (vpLiveAltFt kommt vom Route-Marker)
    var _predBaseAlt = isHdgMode ? (_window$lastLiveGpsPo9 = (_window$lastLiveGpsPo0 = window.lastLiveGpsPos) === null || _window$lastLiveGpsPo0 === void 0 ? void 0 : _window$lastLiveGpsPo0.alt) !== null && _window$lastLiveGpsPo9 !== void 0 ? _window$lastLiveGpsPo9 : vpLiveAltFt : vpLiveAltFt;
    var baseY = yOf(_predBaseAlt);

    // Punkte filtern die noch innerhalb der Route liegen
    // Im HDG-Modus: distNMAhead in Minuten umrechnen
    var _gs4pred = typeof smoothedGS !== 'undefined' && smoothedGS > 20 ? smoothedGS : 80;
    var ptOffset = pt => isHdgMode ? pt.min : pt.distNMAhead;
    var visiblePts = window.vpPredictionData.filter(pt => baseDist + ptOffset(pt) <= totalDist + 1);
    if (visiblePts.length > 0) {
      // Gestrichelte Linie vom Flugzeug durch alle Prediction-Punkte
      fgCtx.save();
      fgCtx.setLineDash([5, 4]);
      fgCtx.lineWidth = 1.5;
      fgCtx.beginPath();
      fgCtx.moveTo(baseX, baseY);
      var _iterator64 = _createForOfIteratorHelper(visiblePts),
        _step64;
      try {
        for (_iterator64.s(); !(_step64 = _iterator64.n()).done;) {
          var pt = _step64.value;
          var px = xOf(baseDist + ptOffset(pt));
          var py = yOf(pt.altFt);
          fgCtx.lineTo(px, py);
        }
      } catch (err) {
        _iterator64.e(err);
      } finally {
        _iterator64.f();
      }
      fgCtx.strokeStyle = 'rgba(255,255,255,0.55)';
      fgCtx.stroke();
      fgCtx.setLineDash([]);

      // Zeitmarker + Labels
      var _iterator65 = _createForOfIteratorHelper(visiblePts),
        _step65;
      try {
        for (_iterator65.s(); !(_step65 = _iterator65.n()).done;) {
          var _pt = _step65.value;
          var _px8 = xOf(baseDist + ptOffset(_pt));
          var _py5 = yOf(_pt.altFt);

          // Culling: nur sichtbaren Bereich rendern
          if (_px8 < viewMinX - 30 || _px8 > viewMaxX + 30) continue;
          var tc = _pt.threat === 'red' ? '#ff2222' : _pt.threat === 'amber' ? '#ffaa00' : _pt.asColor || '#ffffff';

          // Kreis
          fgCtx.beginPath();
          fgCtx.arc(_px8, _py5, 3.5, 0, Math.PI * 2);
          fgCtx.fillStyle = tc;
          fgCtx.fill();
          fgCtx.strokeStyle = 'rgba(0,0,0,0.6)';
          fgCtx.lineWidth = 1;
          fgCtx.stroke();

          // Zeitlabel oben
          fgCtx.fillStyle = tc;
          fgCtx.font = gaEfbProfileFont('bold 9px Arial');
          fgCtx.textAlign = 'center';
          gaEfbCanvasFillText(fgCtx, _pt.min + 'm', _px8, _py5 - 8);

          // Höhe unten (nur wenn genug Platz)
          if (zoomFactor >= 1.5 || window.vpPredictionData.length <= 3) {
            fgCtx.fillStyle = 'rgba(255,255,255,0.6)';
            fgCtx.font = gaEfbProfileFont('8px Arial');
            gaEfbCanvasFillText(fgCtx, Math.round(_pt.altFt) + 'ft', _px8, _py5 + 14);
          }
        }
      } catch (err) {
        _iterator65.e(err);
      } finally {
        _iterator65.f();
      }
      fgCtx.restore();
    }
  }

  // Altitude-Waypoint-Diamanten nur im RTE-Modus (distNM = Route-NM, im HDG unbrauchbar)
  if (!isHdgMode && vpAltWaypoints.length > 0) {
    for (var _i25 = 0; _i25 < vpAltWaypoints.length; _i25++) {
      var wp = vpAltWaypoints[_i25],
        wx = xOf(wp.distNM),
        wy = yOf(wp.altFt);
      if (wx < viewMinX - 20 || wx > viewMaxX + 20) continue;
      fgCtx.beginPath();
      fgCtx.setLineDash([2, 3]);
      fgCtx.strokeStyle = 'rgba(255,0,255,0.3)';
      fgCtx.lineWidth = 1;
      fgCtx.moveTo(wx, wy);
      fgCtx.lineTo(wx, padTop + plotH);
      fgCtx.stroke();
      fgCtx.setLineDash([]);
      fgCtx.beginPath();
      fgCtx.moveTo(wx, wy - 7);
      fgCtx.lineTo(wx + 6, wy);
      fgCtx.lineTo(wx, wy + 7);
      fgCtx.lineTo(wx - 6, wy);
      fgCtx.closePath();
      fgCtx.fillStyle = '#ff00ff';
      fgCtx.fill();
      fgCtx.strokeStyle = '#fff';
      fgCtx.lineWidth = 1;
      fgCtx.stroke();
      fgCtx.fillStyle = '#ff00ff';
      fgCtx.font = gaEfbProfileFont('bold 9px Arial');
      fgCtx.textAlign = 'center';
      gaEfbCanvasFillText(fgCtx, wp.altFt + ' ft', wx, wy - 11);
    }
  }

  // D: TRAFFIC IM PROFIL
  vpDrawTrafficInProfile(fgCtx, xOf, yOf, elevData, isHdgMode, viewMinX, viewMaxX);

  // E: Vordergrund-Puls fuer den aktuell gewarnten Luftraum.
  // Zeichnet das bereits vorhandene Band nochmals im FG, damit der Blinkeffekt
  // auch bei statischem BG-Cache sichtbar bleibt.
  if (typeof vpHighlightPulseIdx !== 'undefined' && vpHighlightPulseIdx >= 0) {
    var phase = typeof vpPulsePhase !== 'undefined' ? vpPulsePhase : 0;
    var pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2));
    var cachedAirspaces = getCachedAirspaceIntersections(elevData, totalDist);
    var item = cachedAirspaces.find(it => it.asIdx === vpHighlightPulseIdx);
    if (item && item.as) {
      var as = item.as,
        lowerFt = item.lowerFt,
        upperFt = item.upperFt,
        isLowerAgl = item.isLowerAgl,
        isUpperAgl = item.isUpperAgl,
        relevantPts = item.relevantPts;
      var _style = getAirspaceStyle(as);
      fgCtx.save();
      fgCtx.fillStyle = vpHexToRgba(_style.color, 0.14 + 0.24 * pulse);
      fgCtx.strokeStyle = vpHexToRgba(_style.color, 0.65 + 0.30 * pulse);
      fgCtx.lineWidth = 2.2 + 1.8 * pulse;
      fgCtx.setLineDash([]);
      fgCtx.beginPath();
      if (!isLowerAgl && !isUpperAgl) {
        var x1 = xOf(item.asMinDist),
          x2 = xOf(item.asMaxDist);
        var ry1 = yOf(Math.min(upperFt, maxAlt));
        var ry2 = yOf(Math.max(lowerFt, minAlt));
        fgCtx.moveTo(x1, ry1);
        fgCtx.lineTo(x2, ry1);
        fgCtx.lineTo(x2, ry2);
        fgCtx.lineTo(x1, ry2);
      } else {
        for (var _i26 = 0; _i26 < relevantPts.length; _i26++) {
          var p = relevantPts[_i26];
          var realUpper = isUpperAgl ? p.elevFt + upperFt : upperFt;
          var _y1 = yOf(Math.min(realUpper, maxAlt));
          if (_i26 === 0) fgCtx.moveTo(xOf(p.distNM), _y1);else fgCtx.lineTo(xOf(p.distNM), _y1);
        }
        for (var _i27 = relevantPts.length - 1; _i27 >= 0; _i27--) {
          var _p3 = relevantPts[_i27];
          var realLower = isLowerAgl ? _p3.elevFt + lowerFt : lowerFt;
          fgCtx.lineTo(xOf(_p3.distNM), yOf(Math.max(realLower, minAlt)));
        }
      }
      fgCtx.closePath();
      fgCtx.fill();
      fgCtx.stroke();
      fgCtx.restore();
    }
  }

  // Top-Priorität: Landmarken (Apt/City) bewusst über dem Hindernis-Layer
  if (vpShowLandmarks) {
    var lmOverride = isHdgMode ? vpHdgLandmarks : null;
    vpDrawLandmarks(fgCtx, xOf, yOf, elevData, totalDist, true, zoomFactor, maxAlt, lmOverride);
  }
  fgCtx.restore();
  if (needsBgRender && window.vpProfilePerfWarn) {
    window.vpProfilePerfWarn('Profile map frame render', frameT0, {
      bg: true,
      elevPoints: Array.isArray(elevData) ? elevData.length : 0
    }, 120);
  }
  vpScheduleNextMapProfileFrame(frameIntervalMs, perfMeta.lastPaintMs);
}

// Removed arbitrary setTimeout hook in favor of synchronous hooks within renderVerticalProfile

/* =========================================================
   RESIZE HANDLE (Map / Profile split)
   ========================================================= */
var vpResizeActive = false;
function initProfileResize() {
  var handle = document.getElementById('profileResizeHandle');
  var strip = document.getElementById('mapProfileStrip');
  var maptable = document.querySelector('.maptable-content');
  if (!handle || !strip || !maptable) return;
  var startY = 0,
    startH = 0;
  function onStart(e) {
    window.activateFastRender();
    vpResizeActive = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startH = strip.offsetHeight;
    document.body.style.cursor = 'ns-resize';
    e.preventDefault();
  }
  function onMove(e) {
    if (!vpResizeActive) return;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    var delta = startY - clientY; // pulling up = bigger profile
    var newH = startH + delta;
    var totalH = maptable.offsetHeight;
    var maxFraction = document.body.classList.contains('map-is-fullscreen') ? 0.75 : 0.6;
    newH = Math.max(60, Math.min(totalH * maxFraction, newH));
    strip.style.height = newH + 'px';
    if (typeof map !== 'undefined' && map) map.invalidateSize();
    renderMapProfile();
  }
  function onEnd() {
    if (!vpResizeActive) return;
    vpResizeActive = false;
    document.body.style.cursor = '';
  }
  handle.addEventListener('mousedown', onStart);
  handle.addEventListener('touchstart', onStart, {
    passive: false
  });
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, {
    passive: false
  });
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchend', onEnd);
}

/* =========================================================
   POSITION MARKER (Magenta triangle + Leaflet marker sync)
   ========================================================= */
var vpPositionFraction = -1; // -1 = hidden scrub marker
var vpLiveGpsFraction = -1; // -1 = hidden live aircraft
var vpLiveAltFt = 0;
var vpLiveHdg = 0;
var vpPositionLeafletMarker = null;
function vpUpdatePosition(fraction) {
  vpPositionFraction = fraction;

  // Weckt nur die Foreground-Schleife, falls sie schläft.
  if (typeof vpMapProfileVisible !== 'undefined' && vpMapProfileVisible) vpRequestMapProfileFrameNow();

  // Update Leaflet marker on map
  if (!vpElevationData || vpElevationData.length < 2) return;
  var totalDist = vpElevationData[vpElevationData.length - 1].distNM;
  var targetDist = fraction * totalDist;

  // Find the interpolated lat/lon at this distance
  var lat, lon;
  for (var i = 0; i < vpElevationData.length - 1; i++) {
    if (vpElevationData[i + 1].distNM >= targetDist) {
      var segLen = vpElevationData[i + 1].distNM - vpElevationData[i].distNM;
      var f = segLen > 0 ? (targetDist - vpElevationData[i].distNM) / segLen : 0;
      lat = vpElevationData[i].lat + (vpElevationData[i + 1].lat - vpElevationData[i].lat) * f;
      lon = vpElevationData[i].lon + (vpElevationData[i + 1].lon - vpElevationData[i].lon) * f;
      break;
    }
  }
  if (!lat) {
    lat = vpElevationData[vpElevationData.length - 1].lat;
    lon = vpElevationData[vpElevationData.length - 1].lon;
  }
  if (typeof map !== 'undefined' && map && typeof L !== 'undefined') {
    if (!vpPositionLeafletMarker) {
      var magentaIcon = L.divIcon({
        className: 'vp-pos-marker',
        html: '<div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:14px solid #ff00ff;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.6));"></div>',
        iconSize: [16, 14],
        iconAnchor: [8, 14]
      });
      vpPositionLeafletMarker = L.marker([lat, lon], {
        icon: magentaIcon,
        interactive: false,
        zIndexOffset: 5000
      });
      // Nur zur Map hinzufügen, wenn Profil sichtbar ist
      if (vpMapProfileVisible) vpPositionLeafletMarker.addTo(map);
    } else {
      vpPositionLeafletMarker.setLatLng([lat, lon]);
      // Sicherstellen, dass Sichtbarkeit synchron ist
      if (vpMapProfileVisible) {
        if (!map.hasLayer(vpPositionLeafletMarker)) vpPositionLeafletMarker.addTo(map);
      } else {
        if (map.hasLayer(vpPositionLeafletMarker)) map.removeLayer(vpPositionLeafletMarker);
      }
    }
  }
}
function vpUpdateLiveAircraft(fraction, altFt, hdg) {
  vpLiveGpsFraction = fraction;
  vpLiveAltFt = altFt;
  vpLiveHdg = hdg;
  if (vpCanRunVisibleMapProfileWork()) vpRequestMapProfileFrameNow();
}

/* =========================================================
   ALTITUDE WAYPOINTS (Click to set, drag to move)
   ========================================================= */
var vpAltWaypoints = []; // [{distNM, altFt}] - fixed anchor points
var vpSegmentAlts = []; // vpSegmentAlts[i] = cruise altitude between vpAltWaypoints[i] and [i+1]
var vpDraggingWP = -1;
var vpDraggingSegment = null; // { segIndex, origAlt }
var vpCanvasClickHandler = null;
function getExactAltAtDist(distNM, profObj, fallbackAlt) {
  if (!profObj || !profObj.profile || profObj.profile.length === 0) return fallbackAlt;
  var prof = profObj.profile;
  if (distNM <= prof[0].distNM) return prof[0].altFt;
  if (distNM >= prof[prof.length - 1].distNM) return prof[prof.length - 1].altFt;
  for (var j = 0; j < prof.length - 1; j++) {
    if (distNM >= prof[j].distNM && distNM <= prof[j + 1].distNM) {
      var f = (distNM - prof[j].distNM) / (prof[j + 1].distNM - prof[j].distNM || 1);
      return prof[j].altFt + f * (prof[j + 1].altFt - prof[j].altFt);
    }
  }
  return fallbackAlt;
}
function initAltWaypoints() {
  var canvas = document.getElementById('mapProfileCanvas');
  if (!canvas || vpCanvasClickHandler) return;
  vpCanvasClickHandler = true;

  // === SHARED HELPERS for mouse & touch ===
  function vpGetCanvasMetrics() {
    var _document$getElementB9, _document$getElementB0;
    var elevData = vpZoomLevel < 100 && vpHighResData ? vpHighResData : vpElevationData;
    if (!elevData || elevData.length < 2) return null;
    var rect = canvas.getBoundingClientRect();
    var scrollContainer = document.getElementById('mapProfileScroll');
    var viewX = scrollContainer ? scrollContainer.scrollLeft : 0;
    var containerHeight = (scrollContainer === null || scrollContainer === void 0 ? void 0 : scrollContainer.clientHeight) || 100;
    var baseWidth = (scrollContainer === null || scrollContainer === void 0 ? void 0 : scrollContainer.clientWidth) || 600;
    var zoomFactor = 100 / vpZoomLevel;
    var virtualWidth = Math.round(baseWidth * zoomFactor);
    var totalDist = elevData[elevData.length - 1].distNM;
    var cruiseAlt = parseInt(((_document$getElementB9 = document.getElementById('altMapInput')) === null || _document$getElementB9 === void 0 ? void 0 : _document$getElementB9.textContent) || ((_document$getElementB0 = document.getElementById('altSlider')) === null || _document$getElementB0 === void 0 ? void 0 : _document$getElementB0.value) || 4500);
    var maxTerrain = Math.max.apply(Math, _toConsumableArray(elevData.map(p => p.elevFt)));
    var autoMaxAlt = Math.max(cruiseAlt + 2500, maxTerrain + 1000);
    var maxAlt = vpMaxAltOverride > 0 ? vpMaxAltOverride : autoMaxAlt;
    var padLeft = 33,
      padRight = 16,
      padTop = 12,
      padBottom = 22;
    var plotW = virtualWidth - padLeft - padRight;
    var plotH = containerHeight - padTop - padBottom;
    return {
      elevData,
      rect,
      viewX,
      containerHeight,
      baseWidth,
      virtualWidth,
      zoomFactor,
      totalDist,
      cruiseAlt,
      maxTerrain,
      maxAlt,
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotW,
      plotH
    };
  }
  function vpClientToCanvas(clientX, clientY, m) {
    // FIX: Koordinaten 1:1 in CSS-Pixeln berechnen
    var cssX = clientX - m.rect.left;
    var cssY = clientY - m.rect.top;
    return {
      mx: cssX + m.viewX,
      my: cssY
    };
  }
  function vpHitTestWaypoint(mx, my, m) {
    for (var i = 0; i < vpAltWaypoints.length; i++) {
      var wp = vpAltWaypoints[i];
      var wpx = m.padLeft + wp.distNM / m.totalDist * m.plotW;
      var wpy = m.padTop + m.plotH - wp.altFt / m.maxAlt * m.plotH;
      if (Math.abs(mx - wpx) < 26 && Math.abs(my - wpy) < 26) return i;
    }
    return -1;
  }
  function vpHitTestFlightLine(mx, my, m) {
    var mouseDistNM = (mx - m.padLeft) / m.plotW * m.totalDist;
    if (mouseDistNM < 0 || mouseDistNM > m.totalDist) return null;
    var tas = vpGetProfileTas();
    var profObj = typeof computeFlightProfile === 'function' ? computeFlightProfile(m.elevData, m.cruiseAlt, vpClimbRate, vpDescentRate, tas) : null;
    var altAtMouse = getExactAltAtDist(mouseDistNM, profObj, m.cruiseAlt);
    var lineY = m.padTop + m.plotH - altAtMouse / m.maxAlt * m.plotH;
    if (Math.abs(my - lineY) < 32) return mouseDistNM;
    return null;
  }
  function vpHitTestMagenta(mx, m) {
    if (typeof vpPositionFraction !== 'number' || vpPositionFraction < 0) return false;
    var posX = m.padLeft + vpPositionFraction * m.totalDist / m.totalDist * m.plotW;
    return Math.abs(mx - posX) < 18;
  }
  function vpFindSegmentIdx(mouseDistNM) {
    var segIdx = -1;
    if (vpAltWaypoints.length === 0) {
      segIdx = -1;
    } else if (vpAltWaypoints.length === 1) {
      segIdx = -2;
    } else {
      if (mouseDistNM <= vpAltWaypoints[0].distNM) {
        segIdx = -3;
      } else if (mouseDistNM >= vpAltWaypoints[vpAltWaypoints.length - 1].distNM) {
        segIdx = -4;
      } else {
        for (var k = 0; k < vpAltWaypoints.length - 1; k++) {
          if (mouseDistNM >= vpAltWaypoints[k].distNM && mouseDistNM <= vpAltWaypoints[k + 1].distNM) {
            segIdx = k;
            break;
          }
        }
      }
    }
    return segIdx;
  }
  function vpRemoveWaypoint(clickDistNM, totalDist) {
    if (vpAltWaypoints.length === 0) return false;
    var nearestIdx = -1,
      nearestDist = Infinity;
    for (var i = 0; i < vpAltWaypoints.length; i++) {
      var d = Math.abs(vpAltWaypoints[i].distNM - clickDistNM);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    if (nearestIdx >= 0 && nearestDist < totalDist * 0.05) {
      vpAltWaypoints.splice(nearestIdx, 1);
      if (vpSegmentAlts.length > 0) {
        if (nearestIdx > 0 && nearestIdx < vpSegmentAlts.length) {
          var merged = Math.round((vpSegmentAlts[nearestIdx - 1] + vpSegmentAlts[nearestIdx]) / 2);
          vpSegmentAlts.splice(nearestIdx - 1, 2, merged);
        } else if (nearestIdx < vpSegmentAlts.length) {
          vpSegmentAlts.splice(nearestIdx, 1);
        } else if (vpSegmentAlts.length > 0) {
          vpSegmentAlts.splice(vpSegmentAlts.length - 1, 1);
        }
      }
      if (vpAltWaypoints.length < 2) vpSegmentAlts = [];
      renderMapProfile(); // Zeichnet sofort!

      // FIX: Schwere DOM/Luftraum-Berechnungen asynchron ausführen, damit der Klick nicht einfriert!
      setTimeout(() => {
        if (typeof renderAirspaceWarningsList === 'function') renderAirspaceWarningsList();
      }, 50);
      return true;
    }
    return false;
  }
  function vpAddWaypoint(clickDistNM, exactAlt, cruiseAlt, totalDist) {
    if (clickDistNM < 0 || clickDistNM > totalDist) return;
    var _iterator66 = _createForOfIteratorHelper(vpAltWaypoints),
      _step66;
    try {
      for (_iterator66.s(); !(_step66 = _iterator66.n()).done;) {
        var wp = _step66.value;
        if (Math.abs(wp.distNM - clickDistNM) < totalDist * 0.03) return;
      }
    } catch (err) {
      _iterator66.e(err);
    } finally {
      _iterator66.f();
    }
    var insertIdx = vpAltWaypoints.length;
    for (var k = 0; k < vpAltWaypoints.length; k++) {
      if (clickDistNM < vpAltWaypoints[k].distNM) {
        insertIdx = k;
        break;
      }
    }
    vpAltWaypoints.splice(insertIdx, 0, {
      distNM: clickDistNM,
      altFt: exactAlt
    });
    if (vpSegmentAlts.length > 0 && insertIdx < vpSegmentAlts.length) {
      vpSegmentAlts.splice(insertIdx, 1, exactAlt, exactAlt);
    } else if (vpSegmentAlts.length > 0 && insertIdx >= vpSegmentAlts.length) {
      vpSegmentAlts.push(exactAlt);
    } else if (vpAltWaypoints.length >= 2 && vpSegmentAlts.length === 0) {
      vpSegmentAlts = [];
      for (var _k2 = 0; _k2 < vpAltWaypoints.length - 1; _k2++) {
        vpSegmentAlts.push(exactAlt);
      }
    }
    renderMapProfile(); // Zeichnet sofort!

    // FIX: Entkoppeln, um Ruckler zu vermeiden!
    setTimeout(() => {
      if (typeof renderAirspaceWarningsList === 'function') renderAirspaceWarningsList();
    }, 50);
  }
  function vpHandleDoubleHit(mx, my, m) {
    // 1. Try removing existing waypoint
    var wpIdx = vpHitTestWaypoint(mx, my, m);
    if (wpIdx >= 0) {
      var wp = vpAltWaypoints[wpIdx];
      vpRemoveWaypoint(wp.distNM, m.totalDist);
      return true;
    }
    // 2. Try adding new waypoint on flight line
    var clickDistNM = vpHitTestFlightLine(mx, my, m);
    if (clickDistNM !== null) {
      var tas = vpGetProfileTas();
      var profObj = typeof computeFlightProfile === 'function' ? computeFlightProfile(m.elevData, m.cruiseAlt, vpClimbRate, vpDescentRate, tas) : null;
      var exactAlt = getExactAltAtDist(clickDistNM, profObj, m.cruiseAlt);
      exactAlt = Math.round(exactAlt / 100) * 100;
      vpAddWaypoint(clickDistNM, exactAlt, m.cruiseAlt, m.totalDist);
      return true;
    }
    return false;
  }
  function vpHandleDragMove(clientX, clientY, dragStartX, dragStartY, dragOrigWP) {
    var m = vpGetCanvasMetrics();
    if (!m) return;
    var deltaY = dragStartY - clientY;
    var altChange = deltaY / m.plotH * m.maxAlt;
    if (vpDraggingWP >= 0) {
      var deltaX = clientX - dragStartX;
      var distChange = deltaX / m.plotW * m.totalDist;
      var newDist = dragOrigWP.distNM + distChange;
      newDist = Math.max(0, Math.min(m.totalDist, newDist));
      var newAlt = Math.round((dragOrigWP.altFt + altChange) / 100) * 100;
      newAlt = Math.max(0, Math.min(m.maxAlt, newAlt));
      vpAltWaypoints[vpDraggingWP].distNM = newDist;
      vpAltWaypoints[vpDraggingWP].altFt = newAlt;
    } else if (vpDraggingSegment) {
      var seg = vpDraggingSegment;
      var _newAlt = Math.max(0, Math.round((seg.origAlt + altChange) / 100) * 100);
      if (seg.segIdx >= 0 && seg.segIdx < vpSegmentAlts.length) {
        vpSegmentAlts[seg.segIdx] = _newAlt;
      } else if (seg.segIdx === -1) {
        var newGlobalAlt = Math.max(1500, Math.min(13500, _newAlt));
        var altMap = document.getElementById('altMapInput');
        if (altMap && altMap.textContent != newGlobalAlt) {
          altMap.textContent = newGlobalAlt;
        }
      } else if (seg.segIdx === -2 || seg.segIdx === -3) {
        if (vpAltWaypoints.length > 0) vpAltWaypoints[0].altFt = _newAlt;
      } else if (seg.segIdx === -4) {
        if (vpAltWaypoints.length > 0) vpAltWaypoints[vpAltWaypoints.length - 1].altFt = _newAlt;
      }
    } else if (window.vpDraggingPosMarker) {
      var _vpClientToCanvas = vpClientToCanvas(clientX, clientY, m),
        mx = _vpClientToCanvas.mx;
      var frac = (mx - m.padLeft) / m.plotW;
      frac = Math.max(0, Math.min(1, frac));
      vpUpdatePosition(frac);
    }
  }
  function vpHandleDragEnd() {
    if (vpDraggingWP >= 0 || vpDraggingSegment || window.vpDraggingPosMarker) {
      var needsSave = vpDraggingWP >= 0 || !!vpDraggingSegment;

      // Bei globaler Höhenänderung einmalig am Ende synchronisieren
      if (vpDraggingSegment && vpDraggingSegment.segIdx === -1) {
        var finalAlt = parseInt(document.getElementById('altMapInput').textContent) || 4500;
        syncAltFromInput(finalAlt);
      }
      if (vpDraggingWP >= 0) vpAltWaypoints.sort((a, b) => a.distNM - b.distNM);
      vpDraggingWP = -1;
      vpDraggingSegment = null;
      window.vpDraggingPosMarker = false;
      dragOrigWP = null;

      // 1. Priorität: Vordergrund (Rote Linie) sofort einrasten lassen
      renderMapProfile();

      // 2. Priorität: UI-Logik (Mini-Profil) und Background-Schatten sanft nachladen (150ms)
      setTimeout(() => {
        if (typeof renderVerticalProfile === 'function') renderVerticalProfile('verticalProfileCanvas');
        window.vpBgNeedsUpdate = true; // Stellt die Wolkenschatten nach dem Drag wieder her
      }, 150);

      // 3. Priorität: Schwere Daten-Logik (Lufträume & JSON-Speichern) ins Backend schieben (300ms)
      setTimeout(() => {
        if (typeof renderAirspaceWarningsList === 'function') renderAirspaceWarningsList();
        if (needsSave) window.debouncedSaveMissionState();
      }, 300);
    }
  }

  // === STATE ===
  var vpWasDragging = false;
  window.vpDraggingPosMarker = false;
  var dragStartY = 0,
    dragStartX = 0,
    dragOrigWP = null;
  var lastTapTime = 0;
  var vpIsPanning = false;
  var vpPanStartScrollLeft = 0;
  var vpPanStartX = 0;
  var initialPinchDist = null;
  var initialTwoFingerY = null;

  // === DOUBLE CLICK: remove/add waypoint ===
  canvas.addEventListener('dblclick', e => {
    if (typeof vpMode !== 'undefined' && vpMode === 'HDG') return; // Nur im RTE-Modus
    var m = vpGetCanvasMetrics();
    if (!m) return;
    var _vpClientToCanvas2 = vpClientToCanvas(e.clientX, e.clientY, m),
      mx = _vpClientToCanvas2.mx,
      my = _vpClientToCanvas2.my;
    if (vpHandleDoubleHit(mx, my, m)) window.debouncedSaveMissionState();
  });

  // === CLICK: no more single-click creation ===
  canvas.addEventListener('click', e => {
    // Logic removed to prevent accidental creation on iPhone
  });

  // === HOVER CURSOR ===
  canvas.addEventListener('mousemove', e => {
    if (vpDraggingWP >= 0 || vpDraggingSegment || window.vpDraggingPosMarker) return;
    var m = vpGetCanvasMetrics();
    if (!m) return;
    var _vpClientToCanvas3 = vpClientToCanvas(e.clientX, e.clientY, m),
      mx = _vpClientToCanvas3.mx,
      my = _vpClientToCanvas3.my;
    var cursor = 'default';
    if (vpHitTestMagenta(mx, m)) cursor = 'ew-resize';else if (vpHitTestWaypoint(mx, my, m) >= 0) cursor = 'move';else if ((typeof vpMode === 'undefined' || vpMode !== 'HDG') && vpHitTestFlightLine(mx, my, m) !== null) cursor = 'ns-resize';
    canvas.style.cursor = cursor;
  });

  // === MOUSEDOWN: start drag ===
  canvas.addEventListener('mousedown', e => {
    vpWasDragging = false;
    var m = vpGetCanvasMetrics();
    if (!m) return;
    var _vpClientToCanvas4 = vpClientToCanvas(e.clientX, e.clientY, m),
      mx = _vpClientToCanvas4.mx,
      my = _vpClientToCanvas4.my;
    dragStartX = e.clientX;
    dragStartY = e.clientY;

    // Priority 1: Magenta marker drag (nur im RTE-Modus)
    var _isHdgNow = typeof vpMode !== 'undefined' && vpMode === 'HDG';
    if (!_isHdgNow && vpHitTestMagenta(mx, m)) {
      window.vpDraggingPosMarker = true;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Priority 2: Waypoint drag
    var wpIdx = vpHitTestWaypoint(mx, my, m);
    if (wpIdx >= 0) {
      vpDraggingWP = wpIdx;
      dragOrigWP = _objectSpread({}, vpAltWaypoints[wpIdx]);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Priority 3: Flight line segment drag (nur im ROUTE-Modus)
    if (typeof vpMode !== 'undefined' && vpMode === 'HDG') return; // Keine Höhenlinien-Interaktion im HDG-Modus
    var mouseDistNM = vpHitTestFlightLine(mx, my, m);
    if (mouseDistNM !== null) {
      e.preventDefault();
      e.stopPropagation();
      var segIdx = vpFindSegmentIdx(mouseDistNM);

      // FIX: Exakte, physikalische Höhe an der angeklickten Stelle berechnen
      var tas = vpGetProfileTas();
      var profObj = typeof computeFlightProfile === 'function' ? computeFlightProfile(m.elevData, m.cruiseAlt, vpClimbRate, vpDescentRate, tas) : null;
      var exactAltAtClick = typeof getExactAltAtDist === 'function' ? getExactAltAtDist(mouseDistNM, profObj, m.cruiseAlt) : m.cruiseAlt;
      exactAltAtClick = Math.round(exactAltAtClick / 100) * 100;
      vpDraggingSegment = {
        segIdx,
        origAlt: exactAltAtClick,
        origCruiseAlt: m.cruiseAlt
      };
      return;
    }
  });

  // === MOUSEMOVE: drag ===
  document.addEventListener('mousemove', e => {
    if (vpDraggingWP < 0 && !vpDraggingSegment && !window.vpDraggingPosMarker) return;
    if (Math.abs(e.clientX - dragStartX) > 2 || Math.abs(e.clientY - dragStartY) > 2) vpWasDragging = true;
    vpHandleDragMove(e.clientX, e.clientY, dragStartX, dragStartY, dragOrigWP);
  });

  // === MOUSEUP: end drag ===
  document.addEventListener('mouseup', () => vpHandleDragEnd());

  // === TOUCH EVENTS ===
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      initialPinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      initialTwoFingerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      return;
    }
    var touch = e.touches[0];
    vpWasDragging = false;
    vpIsPanning = false;
    window.vpProfilePanActive = false;
    var m = vpGetCanvasMetrics();
    if (!m) return;
    var _vpClientToCanvas5 = vpClientToCanvas(touch.clientX, touch.clientY, m),
      mx = _vpClientToCanvas5.mx,
      my = _vpClientToCanvas5.my;
    dragStartX = touch.clientX;
    dragStartY = touch.clientY;
    var now = Date.now();
    if (now - lastTapTime < 300) {
      e.preventDefault();
      if (typeof vpMode === 'undefined' || vpMode !== 'HDG') {
        // Nur im RTE-Modus
        if (vpHandleDoubleHit(mx, my, m)) window.debouncedSaveMissionState();
      }
      lastTapTime = 0;
      return;
    }
    lastTapTime = now;
    var _isHdgNow2 = typeof vpMode !== 'undefined' && vpMode === 'HDG';
    if (!_isHdgNow2 && vpHitTestMagenta(mx, m)) {
      e.preventDefault();
      window.vpDraggingPosMarker = true;
      return;
    }
    var wpIdx = vpHitTestWaypoint(mx, my, m);
    if (wpIdx >= 0) {
      e.preventDefault();
      vpDraggingWP = wpIdx;
      dragOrigWP = _objectSpread({}, vpAltWaypoints[wpIdx]);
      return;
    }
    if (typeof vpMode !== 'undefined' && vpMode === 'HDG') return; // Keine Höhenlinien-Interaktion im HDG-Modus
    var mouseDistNM = vpHitTestFlightLine(mx, my, m);
    if (mouseDistNM !== null) {
      e.preventDefault();
      var segIdx = vpFindSegmentIdx(mouseDistNM);
      var origSegAlt = segIdx >= 0 && segIdx < vpSegmentAlts.length ? vpSegmentAlts[segIdx] : m.cruiseAlt;
      vpDraggingSegment = {
        segIdx,
        origAlt: origSegAlt,
        origCruiseAlt: m.cruiseAlt
      };
      return;
    }
    if (vpZoomLevel < 100) {
      e.preventDefault();
      vpIsPanning = true;
      window.vpProfilePanActive = true;
      var scrollContainer = document.getElementById('mapProfileScroll');
      vpPanStartScrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
      vpPanStartX = touch.clientX;
    }
  }, {
    passive: false
  });
  canvas.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && initialPinchDist !== null && initialTwoFingerY !== null) {
      e.preventDefault();

      // X-Achse: Pinch-to-Zoom
      var currentDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      var distDiff = currentDist - initialPinchDist;
      if (Math.abs(distDiff) > 10) {
        var zoomDelta = distDiff > 0 ? -3 : 3;
        vpZoom(zoomDelta);
        initialPinchDist = currentDist;
      }

      // Y-Achse: Zwei-Finger vertikaler Wisch (Direct Manipulation des Bodens)
      var currentTwoFingerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      var yDiff = currentTwoFingerY - initialTwoFingerY;
      if (Math.abs(yDiff) > 15) {
        // Wischen nach UNTEN (yDiff > 0): User drückt Boden weg -> Stauchen (MaxAlt wird GRÖSSER)
        // Wischen nach OBEN (yDiff < 0): User zieht Boden her -> Dehnen (MaxAlt wird KLEINER)
        var yDelta = yDiff > 0 ? 1000 : -1000;
        vpChangeYAxis(yDelta);
        initialTwoFingerY = currentTwoFingerY;
      }
      return;
    }
    if (vpIsPanning) {
      e.preventDefault();
      var _touch = e.touches[0];
      var deltaX = vpPanStartX - _touch.clientX;
      var scrollContainer = document.getElementById('mapProfileScroll');
      if (scrollContainer) scrollContainer.scrollLeft = vpPanStartScrollLeft + deltaX;
      return;
    }
    if (vpDraggingWP < 0 && !vpDraggingSegment && !window.vpDraggingPosMarker) return;
    e.preventDefault();
    var touch = e.touches[0];
    if (Math.abs(touch.clientX - dragStartX) > 3 || Math.abs(touch.clientY - dragStartY) > 3) vpWasDragging = true;
    vpHandleDragMove(touch.clientX, touch.clientY, dragStartX, dragStartY, dragOrigWP);
  }, {
    passive: false
  });
  canvas.addEventListener('touchend', e => {
    if (e.touches.length < 2) {
      initialPinchDist = null;
      initialTwoFingerY = null;
    }
    if (vpIsPanning) {
      vpIsPanning = false;
      window.vpProfilePanActive = false;
      return;
    }
    window.vpProfilePanActive = false;
    if (vpDraggingWP >= 0 || vpDraggingSegment || window.vpDraggingPosMarker) vpHandleDragEnd();
  });
  canvas.addEventListener('touchcancel', e => {
    initialPinchDist = null;
    initialTwoFingerY = null;
    vpIsPanning = false;
    vpWasDragging = false;
    window.vpProfilePanActive = false;
    if (vpDraggingWP >= 0 || vpDraggingSegment || window.vpDraggingPosMarker) vpHandleDragEnd();
  });

  // === MOUSE WHEEL ZOOM & PAN (Multi-Achsen) ===
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    if (typeof window.activateFastRender === 'function') window.activateFastRender();
    if (e.ctrlKey) {
      var yDelta = e.deltaY > 0 ? 1000 : -1000;
      vpChangeYAxis(yDelta);
    } else if (e.shiftKey) {
      // FIX: OS wandelt Shift+Scroll oft in deltaX um!
      var wheelDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      var zoomDelta = wheelDelta > 0 ? 5 : -5;
      vpZoom(zoomDelta);
    } else {
      var scrollContainer = document.getElementById('mapProfileScroll');
      if (scrollContainer) {
        var panDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        scrollContainer.scrollLeft += panDelta;
      }
    }
  }, {
    passive: false
  });
}

// Override computeFlightProfile to use altitude waypoints + segment altitudes
var _origComputeProfile = computeFlightProfile;
computeFlightProfile = function computeFlightProfile(elevationData, cruiseAltFt, climbRateFpm, descentRateFpm, tasKts) {
  if (!elevationData || elevationData.length < 2) return null;
  if (vpAltWaypoints.length === 0) return _origComputeProfile(elevationData, cruiseAltFt, climbRateFpm, descentRateFpm, tasKts);
  tasKts = tasKts || vpGetProfileTas();
  climbRateFpm = climbRateFpm || 500;
  descentRateFpm = descentRateFpm || 500;
  var totalDistNM = elevationData[elevationData.length - 1].distNM;
  var depElevFt = elevationData[0].elevFt;
  var destElevFt = elevationData[elevationData.length - 1].elevFt;
  var wps = vpAltWaypoints;

  // Ensure vpSegmentAlts has the right length
  while (vpSegmentAlts.length < wps.length - 1) {
    vpSegmentAlts.push(cruiseAltFt);
  }
  while (vpSegmentAlts.length > Math.max(0, wps.length - 1)) {
    vpSegmentAlts.pop();
  }
  var profile = [];

  // Climb: from departure to first WP altitude
  var firstWpAlt = wps[0].altFt;
  var climbFt = Math.max(0, firstWpAlt - depElevFt);
  var climbDistNM = Math.max(0.5, climbFt / climbRateFpm / 60 * tasKts * 0.85);
  var tocDistNM = Math.min(climbDistNM, wps[0].distNM);

  // Descent: from last WP altitude to destination
  var lastWpAlt = wps[wps.length - 1].altFt;
  var descentFt = Math.max(0, lastWpAlt - destElevFt);
  var descentDistNM = Math.max(0.5, descentFt / descentRateFpm / 60 * tasKts * 0.9);
  var todDistNM = Math.max(totalDistNM - descentDistNM, wps[wps.length - 1].distNM);
  var _iterator67 = _createForOfIteratorHelper(elevationData),
    _step67;
  try {
    for (_iterator67.s(); !(_step67 = _iterator67.n()).done;) {
      var pt = _step67.value;
      var d = pt.distNM;
      var altFt = cruiseAltFt;
      if (d <= wps[0].distNM) {
        // CLIMB ZONE: departure → first WP
        if (d < tocDistNM) {
          var f = tocDistNM > 0 ? d / tocDistNM : 1;
          altFt = depElevFt + f * (firstWpAlt - depElevFt);
        } else {
          altFt = firstWpAlt;
        }
      } else if (d >= wps[wps.length - 1].distNM) {
        // DESCENT ZONE: last WP → destination
        if (d > todDistNM) {
          var rem = totalDistNM - todDistNM;
          var _f4 = rem > 0 ? (d - todDistNM) / rem : 1;
          altFt = lastWpAlt - _f4 * (lastWpAlt - destElevFt);
        } else {
          altFt = lastWpAlt;
        }
      } else if (wps.length === 1) {
        // Only 1 WP — hold at that altitude
        altFt = wps[0].altFt;
      } else {
        // MIDDLE: between two consecutive waypoints
        for (var i = 0; i < wps.length - 1; i++) {
          if (d >= wps[i].distNM && d <= wps[i + 1].distNM) {
            var segAlt = vpSegmentAlts[i] !== undefined ? vpSegmentAlts[i] : Math.max(wps[i].altFt, wps[i + 1].altFt);
            var segDist = wps[i + 1].distNM - wps[i].distNM;
            var transitionDist = Math.min(segDist * 0.15, 3); // 15% of segment or max 3nm

            var distFromLeft = d - wps[i].distNM;
            var distFromRight = wps[i + 1].distNM - d;
            if (distFromLeft < transitionDist && wps[i].altFt !== segAlt) {
              // Transition from WP[i].alt to segAlt
              var _f5 = transitionDist > 0 ? distFromLeft / transitionDist : 1;
              altFt = wps[i].altFt + _f5 * (segAlt - wps[i].altFt);
            } else if (distFromRight < transitionDist && wps[i + 1].altFt !== segAlt) {
              // Transition from segAlt to WP[i+1].alt
              var _f6 = transitionDist > 0 ? distFromRight / transitionDist : 1;
              altFt = wps[i + 1].altFt + _f6 * (segAlt - wps[i + 1].altFt);
            } else {
              altFt = segAlt;
            }
            break;
          }
        }
      }
      profile.push({
        distNM: pt.distNM,
        altFt: Math.round(altFt)
      });
    }
  } catch (err) {
    _iterator67.e(err);
  } finally {
    _iterator67.f();
  }
  return {
    profile,
    tocDistNM,
    todDistNM
  };
};

// Init altitude waypoints when map table canvas is ready

setTimeout(() => initAltWaypoints(), 2000);
// === VERTICAL PROFILE CONTROLS (V49) ===
var vpMaxAltOverride = 0; // 0 = Auto-Scaling
var vpShowClouds = localStorage.getItem('ga_show_clouds') !== 'false'; // Default: true
var vpWeatherSource = localStorage.getItem('ga_weather_source') === 'openmeteo' ? 'openmeteo' : 'metar';
window.vpWeatherSource = vpWeatherSource;
var _storedWeatherRenderMode = localStorage.getItem('ga_weather_render_mode');
var vpWeatherRenderMode = _storedWeatherRenderMode === 'abstrakt' || _storedWeatherRenderMode === 'pro' ? 'abstrakt' : 'classic';
var vpShowIsobars = localStorage.getItem('ga_show_isobars') !== 'false';
var vpShowWindComponents = localStorage.getItem('ga_show_wind_components') !== 'false';
var vpWeatherRefreshTimer = null;
var vpWeatherLastAutoRefreshAt = 0;
var vpShowLandmarks = localStorage.getItem('ga_show_landmarks') !== 'false';
var vpShowObstacles = localStorage.getItem('ga_show_obstacles') !== 'false';
var _legacyShowLinear = localStorage.getItem('ga_show_linear');
var vpShowRoads = ((_ref34 = (_localStorage$getItem = localStorage.getItem('ga_show_roads')) !== null && _localStorage$getItem !== void 0 ? _localStorage$getItem : _legacyShowLinear) !== null && _ref34 !== void 0 ? _ref34 : 'true') !== 'false';
var vpShowRivers = ((_ref35 = (_localStorage$getItem2 = localStorage.getItem('ga_show_rivers')) !== null && _localStorage$getItem2 !== void 0 ? _localStorage$getItem2 : _legacyShowLinear) !== null && _ref35 !== void 0 ? _ref35 : 'true') !== 'false';
var vpShowPowerInfra = ((_ref36 = (_localStorage$getItem3 = localStorage.getItem('ga_show_power')) !== null && _localStorage$getItem3 !== void 0 ? _localStorage$getItem3 : _legacyShowLinear) !== null && _ref36 !== void 0 ? _ref36 : 'true') !== 'false';
var vpShowLinear = vpShowRoads || vpShowRivers || vpShowPowerInfra;
var vpAirspaceMode = parseInt(localStorage.getItem('ga_show_airspaces') || '1'); // 0=Off, 1=Bg, 2=Fg

function vpSyncLinearMasterFlag() {
  vpShowLinear = !!(vpShowRoads || vpShowRivers || vpShowPowerInfra);
}
function vpToggleStatusText(on) {
  return on ? 'An' : 'Aus';
}
function updateVpToggleBtn(id, on, label) {
  var btn = document.getElementById(id);
  if (!btn) return;
  btn.classList.toggle('active', !!on);
  btn.textContent = `${label} (${vpToggleStatusText(on)})`;
}
function updateLinearButtons() {
  updateVpToggleBtn('btnToggleRoads', vpShowRoads, '🛣️ Straßen');
  updateVpToggleBtn('btnToggleRivers', vpShowRivers, '🌊 Flüsse');
  updateVpToggleBtn('btnTogglePower', vpShowPowerInfra, '⚡ Strom');
  var blin = document.getElementById('btnToggleLinear');
  if (blin) blin.classList.toggle('active', vpShowLinear);
}
function vpSetLinearLoadingPulse(on) {
  var ids = ['btnToggleLinear', 'btnToggleRoads', 'btnToggleRivers', 'btnTogglePower'];
  for (var _i28 = 0, _ids = ids; _i28 < _ids.length; _i28++) {
    var id = _ids[_i28];
    var el = document.getElementById(id);
    if (!el) continue;
    if (on) el.classList.add('vp-loading-pulse');else el.classList.remove('vp-loading-pulse');
  }
}
function updateAirspaceBtn() {
  var btn = document.getElementById('btnToggleAirspaces');
  if (!btn) return;
  btn.classList.toggle('active', vpAirspaceMode !== 0);
  if (vpAirspaceMode === 1) btn.textContent = '🛡️ Lufträume (An · BG)';else if (vpAirspaceMode === 2) btn.textContent = '🛡️ Lufträume (An · FG)';else btn.textContent = '🛡️ Lufträume (Aus)';
}
function updateWeatherSourceBtn() {
  var btn = document.getElementById('btnToggleWeatherSource');
  if (!btn) return;
  var isOpenMeteo = vpWeatherSource === 'openmeteo';
  btn.classList.toggle('active', isOpenMeteo);
  btn.textContent = `🌐 Quelle: ${isOpenMeteo ? 'OPEN METEO' : 'METAR'}`;
  btn.title = isOpenMeteo ? 'Aktuell: Open-Meteo (nochmal klicken = METAR)' : 'Aktuell: METAR (nochmal klicken = Open-Meteo)';
}
function updateIsobarsBtn() {
  var btn = document.getElementById('btnToggleIsobars');
  if (!btn) return;
  btn.classList.toggle('active', vpShowIsobars);
  btn.textContent = `🧭 Isobaren (${vpShowIsobars ? 'An' : 'Aus'})`;
}
function updateWindComponentsBtn() {
  var btn = document.getElementById('btnToggleWindComponents');
  if (!btn) return;
  btn.classList.toggle('active', vpShowWindComponents);
  btn.textContent = `💨 Windkomponenten (${vpShowWindComponents ? 'An' : 'Aus'})`;
}
function updateCloudsBtn() {
  updateVpToggleBtn('btnToggleClouds', vpShowClouds, '⛅ Wolken');
}
function updateLandmarksBtn() {
  updateVpToggleBtn('btnToggleLandmarks', vpShowLandmarks, '🏙️ Städte');
}
function updateObstaclesBtn() {
  updateVpToggleBtn('btnToggleObstacles', vpShowObstacles, '🗼 Hindernisse');
}
function updateTrafficProfileBtn() {
  updateVpToggleBtn('btnToggleTrafficProfile', !!window.vpTrafficProfileVisible, '📡 Traffic');
}
function ensureWeatherRefreshTimer() {
  if (vpWeatherRefreshTimer) clearInterval(vpWeatherRefreshTimer);
  vpWeatherRefreshTimer = setInterval(() => {
    var now = Date.now();
    if (routeWaypoints && routeWaypoints.length >= 2) {
      if (typeof window.gaShouldPauseNetwork === 'function' && window.gaShouldPauseNetwork('profile-weather')) {
        var _window$gaRunWhenAwak, _window2;
        (_window$gaRunWhenAwak = (_window2 = window).gaRunWhenAwake) === null || _window$gaRunWhenAwak === void 0 || _window$gaRunWhenAwak.call(_window2, 'profile-weather', () => {
          if (typeof triggerVerticalProfileUpdate === 'function') triggerVerticalProfileUpdate();
          if (typeof window.scheduleMapWeatherOverlayUpdate === 'function') window.scheduleMapWeatherOverlayUpdate(true);
        });
        return;
      }
      var profileWeatherNeeded = vpShowClouds || vpShowIsobars || vpShowWindComponents;
      var mapWeatherNeeded = !!(window.mapHints && window.mapHints.weather !== false);
      var mapWeatherSource = String(window.vpMapWeatherSource || localStorage.getItem('ga_map_weather_source') || 'metar').toLowerCase() === 'openmeteo' ? 'openmeteo' : 'metar';
      var openMeteoRefreshNeeded = profileWeatherNeeded && vpWeatherSource === 'openmeteo' || mapWeatherNeeded && mapWeatherSource === 'openmeteo';
      if (openMeteoRefreshNeeded && now - vpWeatherLastAutoRefreshAt >= 15 * 60 * 1000) {
        vpWeatherLastAutoRefreshAt = now;
        if (profileWeatherNeeded && vpWeatherSource === 'openmeteo' && typeof triggerVerticalProfileUpdate === 'function') triggerVerticalProfileUpdate();
        if (window.vpWeatherFallbackMode !== 'openmeteo_to_metar' && !vpIsOpenMeteoCoolingDown() && typeof window.scheduleMapWeatherOverlayUpdate === 'function') {
          window.scheduleMapWeatherOverlayUpdate(true);
        }
      }
      if (window.vpWeatherAutoFallbackFrom === 'metar' && window.vpWeatherFallbackMode === 'metar_to_openmeteo') {
        var lastProbe = Number(window.vpMetarRecoveryProbeAt || 0);
        if (now - lastProbe >= VP_METAR_RECOVERY_PROBE_MS) {
          window.vpMetarRecoveryProbeAt = now;
          vpProbeMetarRecovery(routeWaypoints, vpElevationData || [], null).then(ok => {
            if (!ok) return;
            vpWeatherSource = 'metar';
            window.vpWeatherSource = 'metar';
            localStorage.setItem('ga_weather_source', 'metar');
            window.vpWeatherAutoFallbackFrom = null;
            vpSetWeatherFallbackMode('none', 'metar recovered');
            if (typeof updateWeatherSourceBtn === 'function') updateWeatherSourceBtn();
            if (typeof renderWeatherMarkers === 'function') renderWeatherMarkers();
            if (typeof window.scheduleMapWeatherOverlayUpdate === 'function') window.scheduleMapWeatherOverlayUpdate(true);
            if (typeof triggerVerticalProfileUpdate === 'function') triggerVerticalProfileUpdate();
          }).catch(() => {});
        }
      }
    }
  }, 60 * 1000);
}
function updateWeatherRenderModeBtn() {
  var btn = document.getElementById('btnToggleWeatherRenderMode');
  if (!btn) return;
  var isAbstrakt = vpWeatherRenderMode === 'abstrakt' || vpWeatherRenderMode === 'pro';
  btn.classList.toggle('active', isAbstrakt);
  btn.textContent = '🌦️ Wetterstil: ' + (isAbstrakt ? 'Abstrakt' : 'Classic');
  btn.title = isAbstrakt ? 'Aktuell: abstrakter Wetterstil (nochmal klicken = Classic)' : 'Aktuell: klassischer Wetterstil (nochmal klicken = Abstrakt)';
}
document.addEventListener('DOMContentLoaded', () => {
  updateCloudsBtn();
  updateWeatherSourceBtn();
  updateWeatherRenderModeBtn();
  updateIsobarsBtn();
  updateWindComponentsBtn();
  updateLandmarksBtn();
  updateObstaclesBtn();
  vpSyncLinearMasterFlag();
  updateLinearButtons();
  updateAirspaceBtn(); // NEU
  updateTrafficProfileBtn();
  ensureWeatherRefreshTimer();
});
function vpChangeAlt(delta) {
  var val = parseInt(document.getElementById('altMapInput').textContent) || 4500;
  val = Math.max(1500, Math.min(13500, val + delta));
  syncAltFromInput(val);
}
function syncAltFromInput(val) {
  val = parseInt(val) || 4500;
  var inp = document.getElementById('altMapInput');
  if (inp) inp.textContent = val;
  var mainSlider = document.getElementById('altSlider');
  if (mainSlider) mainSlider.value = val;
  handleSliderChange('alt', val); // handleSliderChange übernimmt jetzt den direkten Render
}
function vpChangeRate(delta) {
  var val = parseInt(document.getElementById('rateMapInput').textContent) || 500;
  val = Math.max(200, Math.min(1500, val + delta));
  syncRateFromInput(val);
}
function syncRateFromInput(val) {
  val = parseInt(val) || 500;
  var inp = document.getElementById('rateMapInput');
  inp.innerText = val;
  handleRateChange(val);
}
function vpChangeYAxis(delta) {
  window.activateFastRender();
  if (vpMaxAltOverride === 0) {
    var _document$getElementB1;
    var _elevData = typeof vpZoomLevel !== 'undefined' && vpZoomLevel < 100 && vpHighResData ? vpHighResData : vpElevationData;
    if (!_elevData) return;
    var cruiseAlt = parseInt(((_document$getElementB1 = document.getElementById('altMapInput')) === null || _document$getElementB1 === void 0 ? void 0 : _document$getElementB1.textContent) || 4500);
    var maxTerrain = Math.max.apply(Math, _toConsumableArray(_elevData.map(p => p.elevFt)));
    vpMaxAltOverride = Math.max(cruiseAlt + 2500, maxTerrain + 1000);
    vpMaxAltOverride = Math.ceil(vpMaxAltOverride / 1000) * 1000;
  }
  vpMaxAltOverride = Math.max(3000, vpMaxAltOverride + delta);
  document.getElementById('yAxisDisplay').textContent = vpMaxAltOverride / 1000 + 'k';

  // Performance-Rendering!
  if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
}
function vpResetYAxis() {
  window.activateFastRender();
  vpMaxAltOverride = 0;
  document.getElementById('yAxisDisplay').textContent = 'AUTO';
  renderMapProfile();
  if (document.getElementById('verticalProfileCanvas')) renderVerticalProfile('verticalProfileCanvas');
}
function vpToggleClouds() {
  vpShowClouds = !vpShowClouds;
  localStorage.setItem('ga_show_clouds', vpShowClouds);
  updateCloudsBtn();
  if (vpShowClouds && window._lastVpRouteKey) {
    triggerVerticalProfileUpdate();
  } else {
    window.vpBgNeedsUpdate = true;
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
  }
}
function vpToggleWeatherSource() {
  vpWeatherSource = vpWeatherSource === 'metar' ? 'openmeteo' : 'metar';
  window.vpWeatherSource = vpWeatherSource;
  localStorage.setItem('ga_weather_source', vpWeatherSource);
  // Quelle wechselt global: alte Daten sofort invalidieren, damit keine
  // veralteten OM/METAR-Labels bis zum nächsten Fetch sichtbar bleiben.
  vpWeatherData = null;
  window._lastWetterRouteKey = null;
  window._lastWetterCoverageKey = null;
  window._lastWetterRouteNm = 0;
  window._lastWeatherSourceKey = null;
  updateWeatherSourceBtn();
  window.vpBgNeedsUpdate = true;
  window.vpWeatherAutoFallbackFrom = null;
  vpSetWeatherFallbackMode('none', 'manual source toggle');
  if (typeof renderWeatherMarkers === 'function') renderWeatherMarkers();
  var mapWeatherSource = String(window.vpMapWeatherSource || localStorage.getItem('ga_map_weather_source') || 'metar').toLowerCase() === 'openmeteo' ? 'openmeteo' : 'metar';
  if (mapWeatherSource === 'metar' && typeof window.scheduleMapWeatherOverlayUpdate === 'function') window.scheduleMapWeatherOverlayUpdate(false);
  if (window._lastVpRouteKey) triggerVerticalProfileUpdate();else if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
  ensureWeatherRefreshTimer();
}
function vpToggleWeatherRenderMode() {
  vpWeatherRenderMode = vpWeatherRenderMode === 'classic' ? 'abstrakt' : 'classic';
  localStorage.setItem('ga_weather_render_mode', vpWeatherRenderMode);
  updateWeatherRenderModeBtn();
  window.vpBgNeedsUpdate = true;
  if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
}
function vpToggleIsobars() {
  vpShowIsobars = !vpShowIsobars;
  localStorage.setItem('ga_show_isobars', vpShowIsobars);
  updateIsobarsBtn();
  window.vpBgNeedsUpdate = true;
  if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
}
function vpToggleWindComponents() {
  vpShowWindComponents = !vpShowWindComponents;
  localStorage.setItem('ga_show_wind_components', vpShowWindComponents);
  updateWindComponentsBtn();
  window.vpBgNeedsUpdate = true;
  if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
}
function vpToggleLandmarks() {
  vpShowLandmarks = !vpShowLandmarks;
  localStorage.setItem('ga_show_landmarks', vpShowLandmarks);
  updateLandmarksBtn();
  if (vpShowLandmarks && window._lastVpRouteKey) {
    localStorage.removeItem('ga_lms_' + window._lastVpRouteKey);
    window._lastLmRouteKey = null; // Zwingt zum erneuten Fetch
    triggerVerticalProfileUpdate();
  } else {
    window.vpBgNeedsUpdate = true; // FIX: Hintergrund zum Löschen zwingen
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
  }
}
function vpToggleObstacles() {
  vpShowObstacles = !vpShowObstacles;
  localStorage.setItem('ga_show_obstacles', vpShowObstacles);
  updateObstaclesBtn();

  // FIX: Nur neu abfragen, wenn für die aktuelle Route noch nie geladen wurde!
  if (vpShowObstacles && window._lastVpRouteKey && window._lastObsRouteKey !== window._lastVpRouteKey) {
    triggerVerticalProfileUpdate();
  } else {
    window.vpBgNeedsUpdate = true;
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
  }
}
function vpToggleLinearFeatures() {
  var next = !vpShowLinear;
  vpShowRoads = next;
  vpShowRivers = next;
  vpShowPowerInfra = next;
  vpSyncLinearMasterFlag();
  localStorage.setItem('ga_show_linear', vpShowLinear);
  localStorage.setItem('ga_show_roads', vpShowRoads);
  localStorage.setItem('ga_show_rivers', vpShowRivers);
  localStorage.setItem('ga_show_power', vpShowPowerInfra);
  updateLinearButtons();

  // FIX: Nur neu abfragen, wenn für die aktuelle Route noch nie geladen wurde!
  if (vpShowLinear && window._lastVpRouteKey && window._lastObsRouteKey !== window._lastVpRouteKey) {
    triggerVerticalProfileUpdate();
  } else {
    window.vpBgNeedsUpdate = true;
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
  }
}
function vpToggleRoads() {
  vpShowRoads = !vpShowRoads;
  vpSyncLinearMasterFlag();
  localStorage.setItem('ga_show_roads', vpShowRoads);
  localStorage.setItem('ga_show_linear', vpShowLinear);
  updateLinearButtons();
  if (vpShowLinear && window._lastVpRouteKey && window._lastObsRouteKey !== window._lastVpRouteKey) triggerVerticalProfileUpdate();else {
    window.vpBgNeedsUpdate = true;
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
  }
}
function vpToggleRivers() {
  vpShowRivers = !vpShowRivers;
  vpSyncLinearMasterFlag();
  localStorage.setItem('ga_show_rivers', vpShowRivers);
  localStorage.setItem('ga_show_linear', vpShowLinear);
  updateLinearButtons();
  if (vpShowLinear && window._lastVpRouteKey && window._lastObsRouteKey !== window._lastVpRouteKey) triggerVerticalProfileUpdate();else {
    window.vpBgNeedsUpdate = true;
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
  }
}
function vpTogglePower() {
  vpShowPowerInfra = !vpShowPowerInfra;
  vpSyncLinearMasterFlag();
  localStorage.setItem('ga_show_power', vpShowPowerInfra);
  localStorage.setItem('ga_show_linear', vpShowLinear);
  updateLinearButtons();
  if ((vpShowLinear || vpShowObstacles) && window._lastVpRouteKey && window._lastObsRouteKey !== window._lastVpRouteKey) triggerVerticalProfileUpdate();else {
    window.vpBgNeedsUpdate = true;
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
  }
}
function vpToggleAirspaces() {
  vpAirspaceMode = (vpAirspaceMode + 1) % 3;
  localStorage.setItem('ga_show_airspaces', vpAirspaceMode);
  updateAirspaceBtn();
  window.vpBgNeedsUpdate = true; // Zwingt den Hintergrund zum Update
  if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
}

// === PROMPT-EINGABE für ALT / V/S (V57) ===
window.retryFailedOverpassChunks = /*#__PURE__*/_asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee0() {
  var chunks, fromStore, remainingMin, btnOb, tileKeys, failedAgain, i, tileKey, res, _res$features, _res$features2, k, seeded;
  return _regenerator().w(function (_context0) {
    while (1) switch (_context0.n) {
      case 0:
        vpHydrateObsTileFailed();
        chunks = window.vpFailedOverpassChunks;
        if (!chunks || chunks.length === 0) {
          fromStore = Array.from(vpObsTileFailed.keys()).slice(0, 120).map(k => ({
            tileKey: k
          }));
          chunks = fromStore;
        }
        if (!(!chunks || chunks.length === 0)) {
          _context0.n = 1;
          break;
        }
        return _context0.a(2);
      case 1:
        if (!(window.vpOverpassGlobalInFlight && window.vpOverpassGlobalInFlight.promise)) {
          _context0.n = 2;
          break;
        }
        console.warn('[Overpass] Retry blockiert: Es läuft bereits ein Overpass-Request.');
        return _context0.a(2);
      case 2:
        if (!vpIsOverpassCoolingDown()) {
          _context0.n = 3;
          break;
        }
        remainingMin = Math.max(1, Math.ceil(vpGetOverpassCooldownRemainingMs() / 60000));
        console.warn(`[Overpass] Retry blockiert: Cooldown noch ${remainingMin} min aktiv.`);
        return _context0.a(2);
      case 3:
        console.log(`[Overpass] Starte manuellen Retry für ${chunks.length} fehlgeschlagene Tiles...`);
        window.vpFailedOverpassChunks = [];
        if (typeof window.updateOverpassErrorUI === 'function') window.updateOverpassErrorUI();
        btnOb = document.getElementById('btnToggleObstacles');
        if (btnOb) btnOb.classList.add('vp-loading-pulse');
        tileKeys = chunks.map(c => c && typeof c.tileKey === 'string' ? c.tileKey : '').filter(Boolean);
        failedAgain = [];
        i = 0;
      case 4:
        if (!(i < tileKeys.length)) {
          _context0.n = 9;
          break;
        }
        tileKey = tileKeys[i];
        _context0.n = 5;
        return vpFetchObstacleTile(tileKey, null, i, {
          preferOverpass: true
        });
      case 5:
        res = _context0.v;
        if (!(res && res.ok)) {
          _context0.n = 6;
          break;
        }
        vpRememberObstacleData(((_res$features = res.features) === null || _res$features === void 0 ? void 0 : _res$features.obs) || [], ((_res$features2 = res.features) === null || _res$features2 === void 0 ? void 0 : _res$features2.lin) || [], tileKey);
        vpMarkTileKeysCovered([tileKey], res.src || 'overpass-retry');
        vpClearTileFailed(tileKey);
        vpMarkOverpassSuccess();
        _context0.n = 7;
        break;
      case 6:
        vpMarkTileFailed(tileKey, Number(res && res.status || 0), String(res && res.src || ''));
        failedAgain.push({
          tileKey
        });
        if (!(res && res.cooldown)) {
          _context0.n = 7;
          break;
        }
        for (k = i + 1; k < tileKeys.length; k++) failedAgain.push({
          tileKey: tileKeys[k]
        });
        return _context0.a(3, 9);
      case 7:
        if (!(i < tileKeys.length - 1)) {
          _context0.n = 8;
          break;
        }
        _context0.n = 8;
        return new Promise(r => setTimeout(r, VP_OBS_TILE_INTER_REQUEST_MS));
      case 8:
        i++;
        _context0.n = 4;
        break;
      case 9:
        window.vpFailedOverpassChunks = failedAgain;
        if (Array.isArray(vpElevationData) && vpElevationData.length > 1) {
          seeded = vpProjectObsPoolToRoute(vpElevationData);
          vpObstacles = seeded.obs || [];
          vpLinearFeatures = seeded.lin || [];
        }
        window.vpBgNeedsUpdate = true;
        if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
        if (btnOb) btnOb.classList.remove('vp-loading-pulse');
        if (typeof window.updateOverpassErrorUI === 'function') window.updateOverpassErrorUI();
      case 10:
        return _context0.a(2);
    }
  }, _callee0);
}));
window.vpRetryFailedObsTiles = function () {
  return window.retryFailedOverpassChunks ? window.retryFailedOverpassChunks() : Promise.resolve();
};
window.promptForAlt = function () {
  var current = document.getElementById('altMapInput').textContent;
  var res = prompt("Gewünschte Flughöhe (ALT) eingeben:", current);
  if (res !== null && !isNaN(parseInt(res))) {
    var val = parseInt(res);
    val = Math.max(1500, Math.min(13500, val));
    syncAltFromInput(val);
  }
};
window.promptForRate = function () {
  var current = document.getElementById('rateMapInput').textContent;
  var res = prompt("Gewünschte Steig-/Sinkrate (V/S) in ft/min eingeben:", current);
  if (res !== null && !isNaN(parseInt(res))) {
    var val = parseInt(res);
    val = Math.max(200, Math.min(1500, val));
    syncRateFromInput(val);
  }
};

/* =========================================================
   2D SIMULATOR EXPORT (Vollständige Welt)
   ========================================================= */
window.exportFor2DSim = function () {
  var _document$getElementB10;
  if (!vpElevationData || vpElevationData.length < 2) {
    alert("Bitte generiere zuerst eine Route im Dispatcher!");
    return;
  }
  var NM_TO_M = 1852;
  var FT_TO_M = 0.3048;
  var waypoints = [];

  // 1. Start-Landebahn generieren
  waypoints.push({
    x: 0,
    elevation: vpElevationData[0].elevFt * FT_TO_M,
    type: "runway",
    length: 1200
  });

  // 2. Wegpunkte / Topographie
  for (var i = 1; i < vpElevationData.length - 1; i++) {
    waypoints.push({
      x: vpElevationData[i].distNM * NM_TO_M,
      elevation: vpElevationData[i].elevFt * FT_TO_M,
      type: "terrain"
    });
  }

  // 3. Ziel-Landebahn generieren
  var totalDistM = vpElevationData[vpElevationData.length - 1].distNM * NM_TO_M;
  waypoints.push({
    x: totalDistM,
    elevation: vpElevationData[vpElevationData.length - 1].elevFt * FT_TO_M,
    type: "runway",
    length: 1200
  });

  // 3b. Höhenprofil berechnen und zu jedem Wegpunkt hinzufügen
  var _exportCruiseAlt = parseInt(((_document$getElementB10 = document.getElementById('altMapInput')) === null || _document$getElementB10 === void 0 ? void 0 : _document$getElementB10.textContent) || 4500);
  var _exportTas = vpGetProfileTas();
  var _exportProf = typeof computeFlightProfile === 'function' ? computeFlightProfile(vpElevationData, _exportCruiseAlt, vpClimbRate, vpDescentRate, _exportTas) : null;
  if (_exportProf && _exportProf.profile && _exportProf.profile.length > 0) {
    waypoints.forEach(wp => {
      var distNM = wp.x / NM_TO_M;
      var altFt = _exportCruiseAlt;
      for (var _j = 0; _j < _exportProf.profile.length - 1; _j++) {
        var _p0 = _exportProf.profile[_j],
          _p1 = _exportProf.profile[_j + 1];
        if (distNM >= _p0.distNM && distNM <= _p1.distNM) {
          var _f = _p1.distNM > _p0.distNM ? (distNM - _p0.distNM) / (_p1.distNM - _p0.distNM) : 0;
          altFt = _p0.altFt + _f * (_p1.altFt - _p0.altFt);
          break;
        }
      }
      wp.alt = Math.round(altFt); // Reiseflughöhe in Fuß
    });
  }

  // 3c. Dispatcher-Wegpunkte (gesetzt im Vertical Profile) extrahieren
  var altWaypoints = [];
  if (typeof vpAltWaypoints !== 'undefined' && vpAltWaypoints.length > 0) {
    altWaypoints = vpAltWaypoints.map(wp => ({
      x: wp.distNM * NM_TO_M,
      altFt: wp.altFt
    }));
  }

  // 4. Wetter-Zonen (Regen, Schnee, Wolken)
  var weatherZones = [];
  var cloudBaseMeters = 1500;
  if (typeof vpWeatherData !== 'undefined' && vpWeatherData) {
    if (vpWeatherData.length > 0 && vpWeatherData[0].lowestBase !== Infinity) {
      cloudBaseMeters = vpWeatherData[0].lowestBase * FT_TO_M;
    }
    vpWeatherData.forEach(zone => {
      weatherZones.push({
        x: zone.distNM * NM_TO_M,
        icao: zone.icao,
        hasRain: zone.weather ? zone.weather.hasRain : false,
        hasSnow: zone.weather ? zone.weather.hasSnow : false,
        hasTS: zone.weather ? zone.weather.hasTS : false,
        clouds: zone.clouds ? zone.clouds.map(c => ({
          type: c.type,
          baseM: c.baseMsl * FT_TO_M
        })) : []
      });
    });
  }

  // 5. Hindernisse (Windräder, Masten)
  var obstacles = [];
  if (typeof vpObstacles !== 'undefined' && vpObstacles) {
    vpObstacles.forEach(obs => {
      obstacles.push({
        x: obs.distNM * NM_TO_M,
        type: obs.type,
        // 'wind' oder 'mast'
        heightM: obs.hFt * FT_TO_M
      });
    });
  }

  // 6. Lineare Features (Flüsse, Autobahnen, Stromtrassen)
  var linearFeatures = [];
  if (typeof vpLinearFeatures !== 'undefined' && vpLinearFeatures) {
    vpLinearFeatures.forEach(feat => {
      linearFeatures.push({
        x: feat.distNM * NM_TO_M,
        type: feat.type,
        // 'river' | 'highway' | 'powerline'
        name: feat.name
      });
    });
  }

  // 7. Städte & Flughäfen
  var landmarks = [];
  if (typeof vpLandmarks !== 'undefined' && vpLandmarks) {
    vpLandmarks.forEach(lm => {
      landmarks.push({
        x: lm.distNM * NM_TO_M,
        type: lm.type,
        // 'apt', 'city', 'town'
        name: lm.name
      });
    });
  }

  // 7b. Lufträume (Airspaces) extrahieren
  var airspaces = [];
  if (typeof activeAirspaces !== 'undefined' && activeAirspaces.length > 0 && typeof getCachedAirspaceIntersections === 'function') {
    var totalDistNM = vpElevationData[vpElevationData.length - 1].distNM;
    var cachedAS = getCachedAirspaceIntersections(vpElevationData, totalDistNM);
    cachedAS.forEach(item => {
      // Nur relevante Lufträume exportieren (z.B. keine unendlichen FIRs)
      var asName = item.as.name || "Luftraum";
      // Wir berechnen die absolute MSL Höhe in Metern für den Simulator
      var lowerM = item.lowerFt * FT_TO_M;
      var upperM = item.upperFt * FT_TO_M;
      airspaces.push({
        name: asName,
        type: item.as.type,
        isCTR: asName.includes("CTR") || asName.includes("Control Zone"),
        startX: item.asMinDist * NM_TO_M,
        endX: item.asMaxDist * NM_TO_M,
        lowerM: lowerM,
        upperM: upperM,
        isLowerAgl: item.isLowerAgl
      });
    });
  }

  // 8. JSON zusammensetzen (Update!)
  var simData = {
    weather: {
      windVX: -5,
      windVY: 0,
      oat: 15,
      qnh: 1013,
      cloudBase: Math.round(cloudBaseMeters)
    },
    waypoints: waypoints,
    weatherZones: weatherZones,
    obstacles: obstacles,
    linearFeatures: linearFeatures,
    landmarks: landmarks,
    airspaces: airspaces,
    altWaypoints: altWaypoints
  };
  var jsonString = JSON.stringify(simData);

  // 9. MAGIC TRANSFER: Ab in den localStorage und Simulator öffnen!
  try {
    localStorage.setItem('autoSimFlightPlan', jsonString);
    // Öffnet den Simulator in einem neuen Tab (Pfad ggf. anpassen, falls game.html woanders liegt)
    window.open('game.html', '_blank');
  } catch (e) {
    alert("Fehler beim Transfer! Bitte Cookies/Local Storage im Browser erlauben.");
    console.error(e);
  }
};

/* =========================================================
   HDG-MODUS: Heading-basiertes Vertikalprofil (v1)
   Zeigt Terrain, Lufträume, Städte entlang der aktuellen
   Flugrichtung — ohne neue API-Calls.
   X-Achse = Minuten voraus/zurück (totalDist = Minuten).
   Flugzeug steht bei distNM = VP_HDG_LOOKBACK_MIN (leicht eingerückt).
   ========================================================= */

var VP_HDG_LOOKBACK_MIN = 2; // Minuten hinter dem Flugzeug (Gelände dahinter)
var VP_HDG_LOOKAHEAD_MIN = 15; // Minuten voraus (Standard)
var VP_HDG_SAMPLES = 80; // Anzahl Terrain-Sample-Punkte (gesamt)

var vpMode = 'ROUTE'; // 'ROUTE' | 'HDG'
var vpHdgElevData = null; // [{distNM (=Minuten), elevFt, lat, lon}]
var vpHdgLandmarks = [];
var vpHdgObstacles = [];
var vpHdgLinearFeatures = [];
var vpHdgUpdateTimer = null;
var vpHdgUpdateInFlight = false;
var vpHdgRefreshPending = false;
var vpHdgPendingReason = '';
var vpHdgCycleGeneration = 0;
var vpHdgLastUpdate = {
  lat: 0,
  lon: 0,
  hdg: -999
};
var vpHdgLastTurnSample = {
  hdg: -999,
  ts: 0
};
var vpHdgWeatherTurnRate = 0;
var vpHdgWeatherFetchTs = 0;
var vpHdgWeatherInFlight = false;
var vpHdgWeatherAbortController = null;
var vpHdgWeatherLastSignature = '';
var vpHdgWeatherCoverageKey = '';
var vpHdgWeatherLastHardRefreshTs = 0;

// ── Toggle ──────────────────────────────────────────────
function vpToggleMode() {
  var btn = document.getElementById('btnToggleVpMode');
  var hasGps = window.lastLiveGpsPos && typeof smoothedGS !== 'undefined' && smoothedGS > 20;
  if (vpMode === 'ROUTE') {
    if (!hasGps) {
      // Kein GPS → Button kurz blinken lassen
      if (btn) {
        btn.style.background = '#833';
        setTimeout(() => btn.style.background = '', 600);
      }
      return;
    }
    vpMode = 'HDG';
    if (btn) {
      btn.textContent = 'HDG';
      btn.classList.add('active');
    }
    startHdgCycle();
  } else {
    stopHdgCycle();
    if (btn) {
      btn.textContent = 'RTE';
      btn.classList.remove('active');
    }
    // _hdgAutoActivated bleibt true → kein sofortiger Re-Trigger durch GPS-Tick
    // Reset passiert erst beim GPS-Disconnect (in sync.js onclose)
  }
}

// Öffentliche Sicherheitsfunktion: garantiert Rückkehr in den ROUTE-Modus.
window.vpEnsureRouteMode = function () {
  if (vpMode !== 'HDG') return;
  stopHdgCycle();
  var btn = document.getElementById('btnToggleVpMode');
  if (btn) {
    btn.textContent = 'RTE';
    btn.classList.remove('active');
  }
};
function startHdgCycle() {
  vpHdgCycleGeneration += 1;
  vpWeatherData = null;
  vpHdgWeatherLastSignature = '';
  vpHdgWeatherFetchTs = 0;
  vpHdgWeatherCoverageKey = '';
  vpHdgWeatherLastHardRefreshTs = 0;
  vpHdgLastTurnSample = {
    hdg: -999,
    ts: 0
  };
  vpHdgRefreshPending = true;
  vpHdgPendingReason = 'hdg-start';
  vpQueueHdgProfileUpdate({
    force: true,
    reason: 'hdg-start'
  });
  if (vpHdgUpdateTimer) clearInterval(vpHdgUpdateTimer);
  vpHdgUpdateTimer = setInterval(() => vpQueueHdgProfileUpdate({
    reason: 'hdg-cycle'
  }), 1000);
}
function stopHdgCycle() {
  vpHdgCycleGeneration += 1;
  clearInterval(vpHdgUpdateTimer);
  vpHdgUpdateTimer = null;
  vpHdgElevData = null;
  vpHdgLandmarks = [];
  vpHdgObstacles = [];
  vpHdgLinearFeatures = [];
  if (vpHdgWeatherAbortController) {
    vpHdgWeatherAbortController.abort();
    vpHdgWeatherAbortController = null;
  }
  vpHdgWeatherInFlight = false;
  vpHdgWeatherLastSignature = '';
  vpHdgWeatherFetchTs = 0;
  vpHdgWeatherCoverageKey = '';
  vpHdgWeatherLastHardRefreshTs = 0;
  vpHdgRefreshPending = false;
  vpHdgPendingReason = '';
  vpMode = 'ROUTE';
  window.vpBgNeedsUpdate = true;
  if (window._lastVpRouteKey && typeof triggerVerticalProfileUpdate === 'function') {
    triggerVerticalProfileUpdate();
  }
}
function vpHdgAngleDelta(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.abs((a - b + 540) % 360 - 180);
}
function vpClonePressureProfile(list) {
  if (!Array.isArray(list)) return [];
  return list.map(p => ({
    hPa: p.hPa,
    geopotentialFt: Number.isFinite(p.geopotentialFt) ? p.geopotentialFt : null,
    cloudPct: Number.isFinite(p.cloudPct) ? p.cloudPct : null,
    windKt: Number.isFinite(p.windKt) ? p.windKt : null,
    windDirDeg: Number.isFinite(p.windDirDeg) ? p.windDirDeg : null
  }));
}
function vpCloneClouds(list) {
  if (!Array.isArray(list)) return [];
  return list.map(c => ({
    type: c.type,
    baseAgl: c.baseAgl,
    baseMsl: c.baseMsl,
    topMsl: c.topMsl,
    source: c.source || null,
    estimated: !!c.estimated
  }));
}
function vpLerpCircularDeg(a, b, t) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.isFinite(b) ? b : a;
  var da = (b - a + 540) % 360 - 180;
  return (a + da * t + 360) % 360;
}
function vpBuildCoverageKeyFromPoints(points) {
  var stepDeg = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0.1;
  if (!Array.isArray(points) || points.length === 0) return '';
  var picks = [0, Math.floor(points.length * 0.25), Math.floor(points.length * 0.5), Math.floor(points.length * 0.75), points.length - 1];
  var chunks = [];
  for (var _i29 = 0, _picks = picks; _i29 < _picks.length; _i29++) {
    var idx = _picks[_i29];
    var p = points[Math.max(0, Math.min(points.length - 1, idx))];
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    var latQ = vpQuantizeCoord(p.lat, stepDeg);
    var lonQ = vpQuantizeCoord(p.lon, stepDeg);
    chunks.push(`${latQ.toFixed(2)},${lonQ.toFixed(2)}`);
  }
  return chunks.join('|');
}
function vpBlendHdgWeatherZones(prevZones, nextZones, alpha) {
  if (!Array.isArray(nextZones) || nextZones.length === 0) return nextZones;
  if (!Array.isArray(prevZones) || prevZones.length === 0) return nextZones;
  var t = Math.max(0, Math.min(1, alpha));
  var maxMatchDeltaMin = 2.4;
  return nextZones.map(nz => {
    var best = null;
    var bestD = Infinity;
    var _iterator68 = _createForOfIteratorHelper(prevZones),
      _step68;
    try {
      for (_iterator68.s(); !(_step68 = _iterator68.n()).done;) {
        var pz = _step68.value;
        var d = Math.abs((pz.distNM || 0) - (nz.distNM || 0));
        if (d < bestD) {
          bestD = d;
          best = pz;
        }
      }
    } catch (err) {
      _iterator68.e(err);
    } finally {
      _iterator68.f();
    }
    if (!best || bestD > maxMatchDeltaMin) return nz;
    var out = _objectSpread({}, nz);
    if (Number.isFinite(best.lowestBase) && Number.isFinite(nz.lowestBase)) {
      out.lowestBase = best.lowestBase + (nz.lowestBase - best.lowestBase) * t;
    }
    if (Number.isFinite(best.wspd) && Number.isFinite(nz.wspd)) {
      out.wspd = best.wspd + (nz.wspd - best.wspd) * t;
    }
    if (Number.isFinite(best.wdir) && Number.isFinite(nz.wdir)) {
      out.wdir = vpLerpCircularDeg(best.wdir, nz.wdir, t);
    }
    if (Number.isFinite(best.mslPressureHpa) && Number.isFinite(nz.mslPressureHpa)) {
      out.mslPressureHpa = best.mslPressureHpa + (nz.mslPressureHpa - best.mslPressureHpa) * t;
    }
    if (Array.isArray(best.clouds) && Array.isArray(nz.clouds) && best.clouds.length === nz.clouds.length) {
      out.clouds = nz.clouds.map((c, i) => {
        var p = best.clouds[i];
        return _objectSpread(_objectSpread({}, c), {}, {
          baseAgl: Number.isFinite(p.baseAgl) && Number.isFinite(c.baseAgl) ? p.baseAgl + (c.baseAgl - p.baseAgl) * t : c.baseAgl,
          baseMsl: Number.isFinite(p.baseMsl) && Number.isFinite(c.baseMsl) ? p.baseMsl + (c.baseMsl - p.baseMsl) * t : c.baseMsl,
          topMsl: Number.isFinite(p.topMsl) && Number.isFinite(c.topMsl) ? p.topMsl + (c.topMsl - p.topMsl) * t : c.topMsl
        });
      });
    }
    if (Array.isArray(best.pressureProfile) && Array.isArray(nz.pressureProfile)) {
      var bestByLevel = new Map(best.pressureProfile.map(p => [p.hPa, p]));
      out.pressureProfile = nz.pressureProfile.map(p => {
        var q = bestByLevel.get(p.hPa);
        if (!q) return p;
        return _objectSpread(_objectSpread({}, p), {}, {
          geopotentialFt: Number.isFinite(q.geopotentialFt) && Number.isFinite(p.geopotentialFt) ? q.geopotentialFt + (p.geopotentialFt - q.geopotentialFt) * t : p.geopotentialFt,
          cloudPct: Number.isFinite(q.cloudPct) && Number.isFinite(p.cloudPct) ? q.cloudPct + (p.cloudPct - q.cloudPct) * t : p.cloudPct,
          windKt: Number.isFinite(q.windKt) && Number.isFinite(p.windKt) ? q.windKt + (p.windKt - q.windKt) * t : p.windKt,
          windDirDeg: Number.isFinite(q.windDirDeg) && Number.isFinite(p.windDirDeg) ? vpLerpCircularDeg(q.windDirDeg, p.windDirDeg, t) : p.windDirDeg
        });
      });
    }
    return out;
  });
}
function vpConvertHdgWeatherZonesToMinutes(zonesNm, gs) {
  if (!Array.isArray(zonesNm)) return [];
  var k = Math.max(15, gs) / 60;
  return zonesNm.map(z => _objectSpread(_objectSpread({}, z), {}, {
    distNM: (z.distNM || 0) / k,
    clouds: vpCloneClouds(z.clouds),
    pressureProfile: vpClonePressureProfile(z.pressureProfile)
  }));
}
function vpGetHdgWeatherChunkCache(key) {
  var now = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Date.now();
  if (!key) return null;
  var entry = vpHdgWeatherChunkCache.get(key);
  if (!entry || !Array.isArray(entry.zones)) return null;
  if (now - Number(entry.ts || 0) > VP_HDG_WEATHER_CHUNK_CACHE_TTL_MS) {
    vpHdgWeatherChunkCache.delete(key);
    return null;
  }
  return entry.zones.map(z => _objectSpread(_objectSpread({}, z), {}, {
    clouds: vpCloneClouds(z.clouds),
    pressureProfile: vpClonePressureProfile(z.pressureProfile)
  }));
}
function vpSetHdgWeatherChunkCache(key, zones) {
  var now = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : Date.now();
  if (!key || !Array.isArray(zones) || zones.length === 0) return;
  vpHdgWeatherChunkCache.set(key, {
    ts: now,
    zones: zones.map(z => _objectSpread(_objectSpread({}, z), {}, {
      clouds: vpCloneClouds(z.clouds),
      pressureProfile: vpClonePressureProfile(z.pressureProfile)
    }))
  });
  if (vpHdgWeatherChunkCache.size <= VP_HDG_WEATHER_CHUNK_CACHE_MAX) return;
  var stale = Array.from(vpHdgWeatherChunkCache.entries()).sort((a, b) => Number(a[1] && a[1].ts || 0) - Number(b[1] && b[1].ts || 0)).slice(0, Math.max(1, vpHdgWeatherChunkCache.size - VP_HDG_WEATHER_CHUNK_CACHE_MAX));
  stale.forEach(_ref38 => {
    var _ref39 = _slicedToArray(_ref38, 1),
      k = _ref39[0];
    return vpHdgWeatherChunkCache.delete(k);
  });
}
function vpUpdateHdgWeather(_x46, _x47, _x48, _x49, _x50, _x51) {
  return _vpUpdateHdgWeather.apply(this, arguments);
}
function _vpUpdateHdgWeather() {
  _vpUpdateHdgWeather = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee34(lat, lon, hdg, gs, dHdg, dPos) {
    var weatherNeeded, now, dtSec, dTurn, highTurn, mediumTurn, signature, sigHeadingDelta, k, elevNm, routePts, coverageKey, hdgChunkKey, cachedZonesNm, zonesMin, blendAlpha, areaChanged, refreshDue, minFetchIntervalMs, signal, zonesNm, _zonesMin, _blendAlpha, _t35;
    return _regenerator().w(function (_context41) {
      while (1) switch (_context41.p = _context41.n) {
        case 0:
          if (vpCanRunVisibleMapProfileWork()) {
            _context41.n = 1;
            break;
          }
          return _context41.a(2);
        case 1:
          weatherNeeded = vpShowClouds || vpShowIsobars || vpShowWindComponents;
          if (!(!weatherNeeded || !Array.isArray(vpHdgElevData) || vpHdgElevData.length < 2)) {
            _context41.n = 2;
            break;
          }
          return _context41.a(2);
        case 2:
          if (!vpHdgWeatherInFlight) {
            _context41.n = 3;
            break;
          }
          return _context41.a(2);
        case 3:
          if (!(!Number.isFinite(gs) || gs < 20)) {
            _context41.n = 4;
            break;
          }
          return _context41.a(2);
        case 4:
          now = Date.now();
          dtSec = vpHdgLastTurnSample.ts > 0 ? (now - vpHdgLastTurnSample.ts) / 1000 : 1;
          dTurn = vpHdgAngleDelta(hdg, vpHdgLastTurnSample.hdg);
          vpHdgWeatherTurnRate = dtSec > 0.05 ? dTurn / dtSec : vpHdgWeatherTurnRate;
          vpHdgLastTurnSample = {
            hdg,
            ts: now
          };
          highTurn = vpHdgWeatherTurnRate > 6;
          mediumTurn = vpHdgWeatherTurnRate > 2.5;
          signature = [(lat || 0).toFixed(3), (lon || 0).toFixed(3), Math.round(hdg || 0), Math.round(gs || 0), vpWeatherSource].join('|');
          sigHeadingDelta = vpHdgWeatherLastSignature ? vpHdgAngleDelta(Math.round(hdg || 0), Number(vpHdgWeatherLastSignature.split('|')[2] || 0)) : 999;
          if (!(signature === vpHdgWeatherLastSignature && dPos < 0.0015 && sigHeadingDelta < 2)) {
            _context41.n = 5;
            break;
          }
          return _context41.a(2);
        case 5:
          k = gs / 60;
          elevNm = vpHdgElevData.map(p => ({
            distNM: Math.max(0, (p.distNM || 0) * k),
            elevFt: p.elevFt,
            lat: p.lat,
            lon: p.lon
          }));
          routePts = elevNm.map(p => ({
            lat: p.lat,
            lon: p.lon,
            lng: p.lon
          }));
          if (!(routePts.length < 2)) {
            _context41.n = 6;
            break;
          }
          return _context41.a(2);
        case 6:
          coverageKey = vpBuildCoverageKeyFromPoints(routePts, VP_HDG_WEATHER_COVERAGE_STEP_DEG);
          hdgChunkKey = `${window.vpWeatherSource || vpWeatherSource || 'metar'}:${coverageKey || 'none'}`;
          cachedZonesNm = vpGetHdgWeatherChunkCache(hdgChunkKey, now);
          if (!cachedZonesNm) {
            _context41.n = 7;
            break;
          }
          zonesMin = vpConvertHdgWeatherZonesToMinutes(cachedZonesNm, gs);
          blendAlpha = mediumTurn ? 0.34 : 0.46;
          vpWeatherData = vpBlendHdgWeatherZones(vpWeatherData, zonesMin, blendAlpha);
          vpHdgWeatherLastSignature = signature;
          vpHdgWeatherCoverageKey = coverageKey;
          vpHdgWeatherLastHardRefreshTs = now;
          window.vpBgNeedsUpdate = true;
          return _context41.a(2);
        case 7:
          areaChanged = !!coverageKey && coverageKey !== vpHdgWeatherCoverageKey;
          refreshDue = now - vpHdgWeatherLastHardRefreshTs >= VP_OM_CACHE_TTL_MS;
          if (!(!areaChanged && !refreshDue)) {
            _context41.n = 8;
            break;
          }
          if (window.vpWeatherDebug) window.vpWeatherDebug.hdgSkippedNoAreaChange += 1;
          return _context41.a(2);
        case 8:
          minFetchIntervalMs = areaChanged ? highTurn ? 3500 : 2400 : VP_OM_CACHE_TTL_MS;
          if (!(now - vpHdgWeatherFetchTs < minFetchIntervalMs)) {
            _context41.n = 9;
            break;
          }
          if (window.vpWeatherDebug) window.vpWeatherDebug.hdgSkippedNoAreaChange += 1;
          return _context41.a(2);
        case 9:
          if (!(!areaChanged && highTurn && dHdg < 5 && dPos < 0.0035)) {
            _context41.n = 10;
            break;
          }
          if (window.vpWeatherDebug) window.vpWeatherDebug.hdgSkippedNoAreaChange += 1;
          return _context41.a(2);
        case 10:
          if (vpHdgWeatherAbortController) vpHdgWeatherAbortController.abort();
          vpHdgWeatherAbortController = vpCreateAbortController();
          signal = vpHdgWeatherAbortController.signal;
          vpHdgWeatherInFlight = true;
          vpHdgWeatherFetchTs = now;
          _context41.p = 11;
          if (window.vpWeatherDebug) window.vpWeatherDebug.hdgFetches += 1;
          _context41.n = 12;
          return fetchRouteWeather(routePts, elevNm, signal);
        case 12:
          zonesNm = _context41.v;
          if (!(signal.aborted || vpMode !== 'HDG' || !vpCanRunVisibleMapProfileWork())) {
            _context41.n = 13;
            break;
          }
          return _context41.a(2);
        case 13:
          if (!(!Array.isArray(zonesNm) || zonesNm.length === 0)) {
            _context41.n = 14;
            break;
          }
          return _context41.a(2);
        case 14:
          vpSetHdgWeatherChunkCache(hdgChunkKey, zonesNm, now);
          _zonesMin = vpConvertHdgWeatherZonesToMinutes(zonesNm, gs);
          _blendAlpha = highTurn ? 0.24 : mediumTurn ? 0.34 : 0.46;
          vpWeatherData = vpBlendHdgWeatherZones(vpWeatherData, _zonesMin, _blendAlpha);
          vpHdgWeatherLastSignature = signature;
          vpHdgWeatherCoverageKey = coverageKey;
          vpHdgWeatherLastHardRefreshTs = now;
          window.vpBgNeedsUpdate = true;
          _context41.n = 17;
          break;
        case 15:
          _context41.p = 15;
          _t35 = _context41.v;
          if (!(_t35 && _t35.name === 'AbortError')) {
            _context41.n = 16;
            break;
          }
          return _context41.a(2);
        case 16:
          console.warn('[HDG] Wetter-Update fehlgeschlagen:', _t35);
          vpWeatherDebugSetError(_t35, 'hdg update');
        case 17:
          _context41.p = 17;
          vpHdgWeatherInFlight = false;
          return _context41.f(17);
        case 18:
          return _context41.a(2);
      }
    }, _callee34, null, [[11, 15, 17, 18]]);
  }));
  return _vpUpdateHdgWeather.apply(this, arguments);
}
function vpQueueHdgProfileUpdate() {
  var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var force = options.force === true;
  var reason = String(options.reason || 'hdg-cycle');
  if (vpMode !== 'HDG') return;
  if (!vpCanRunVisibleMapProfileWork()) {
    if (force) {
      vpHdgRefreshPending = true;
      vpHdgPendingReason = reason;
    }
    return;
  }
  if (vpHdgUpdateInFlight) {
    if (force) {
      vpHdgRefreshPending = true;
      vpHdgPendingReason = reason;
    }
    return;
  }
  var runForced = force || vpHdgRefreshPending;
  var runReason = vpHdgPendingReason || reason;
  vpHdgRefreshPending = false;
  vpHdgPendingReason = '';
  void updateHdgProfile({
    force: runForced,
    reason: runReason
  }).catch(e => {
    console.warn('[HDG] Profil-Update fehlgeschlagen:', e);
    if (window.gaDebugPush) window.gaDebugPush('profile', '[HDG] Profile update failed', {
      reason: runReason,
      error: String(e && e.message || e)
    });
  });
}
function updateHdgProfile() {
  return _updateHdgProfile.apply(this, arguments);
} // ── Terrain-Sampling entlang der Flugrichtung ────────────
function _updateHdgProfile() {
  _updateHdgProfile = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee35() {
    var options,
      force,
      runGeneration,
      _window$lastLiveGpsPo1,
      lat,
      lon,
      hdg,
      alt,
      gs,
      dHdg,
      dPos,
      nextElevData,
      pendingReason,
      _args42 = arguments;
    return _regenerator().w(function (_context42) {
      while (1) switch (_context42.p = _context42.n) {
        case 0:
          options = _args42.length > 0 && _args42[0] !== undefined ? _args42[0] : {};
          force = options.force === true;
          if (!(vpMode !== 'HDG' || !vpCanRunVisibleMapProfileWork())) {
            _context42.n = 1;
            break;
          }
          if (force) vpHdgRefreshPending = true;
          return _context42.a(2);
        case 1:
          if (window.lastLiveGpsPos) {
            _context42.n = 2;
            break;
          }
          return _context42.a(2);
        case 2:
          runGeneration = vpHdgCycleGeneration;
          vpHdgUpdateInFlight = true;
          _context42.p = 3;
          _window$lastLiveGpsPo1 = window.lastLiveGpsPos, lat = _window$lastLiveGpsPo1.lat, lon = _window$lastLiveGpsPo1.lon, hdg = _window$lastLiveGpsPo1.hdg, alt = _window$lastLiveGpsPo1.alt;
          gs = typeof smoothedGS !== 'undefined' && smoothedGS > 20 ? smoothedGS : 80; // Change-Detection: nur updaten wenn Kurs/Position sich nennenswert geändert hat.
          // Sichtbarwerden und explizite Refreshes dürfen diese Schwelle einmalig umgehen.
          dHdg = Math.abs((hdg - vpHdgLastUpdate.hdg + 540) % 360 - 180);
          dPos = Math.abs(lat - vpHdgLastUpdate.lat) + Math.abs(lon - vpHdgLastUpdate.lon);
          if (!(!force && vpHdgElevData && dHdg < 2 && dPos < 0.003)) {
            _context42.n = 4;
            break;
          }
          return _context42.a(2);
        case 4:
          vpHdgLastUpdate = {
            lat,
            lon,
            hdg
          };
          _context42.n = 5;
          return generateHdgProfile(lat, lon, hdg, alt, gs);
        case 5:
          nextElevData = _context42.v;
          if (!(runGeneration !== vpHdgCycleGeneration || vpMode !== 'HDG' || !vpCanRunVisibleMapProfileWork())) {
            _context42.n = 6;
            break;
          }
          return _context42.a(2);
        case 6:
          if (Array.isArray(nextElevData) && nextElevData.length >= 2) vpHdgElevData = nextElevData;
          _context42.n = 7;
          return vpUpdateHdgWeather(lat, lon, hdg, gs, dHdg, dPos);
        case 7:
          if (!(runGeneration !== vpHdgCycleGeneration || vpMode !== 'HDG' || !vpCanRunVisibleMapProfileWork())) {
            _context42.n = 8;
            break;
          }
          return _context42.a(2);
        case 8:
          computeHdgLandmarks(lat, lon, hdg, gs);
          computeHdgObstacles(lat, lon, hdg, gs);
          computeHdgLinearFeatures(lat, lon, hdg, gs);
          window.vpBgNeedsUpdate = true;
          vpRequestMapProfileFrameNow();
        case 9:
          _context42.p = 9;
          vpHdgUpdateInFlight = false;
          if (vpHdgRefreshPending && vpMode === 'HDG' && vpCanRunVisibleMapProfileWork()) {
            pendingReason = vpHdgPendingReason || 'hdg-pending';
            vpHdgRefreshPending = false;
            vpHdgPendingReason = '';
            vpQueueHdgProfileUpdate({
              force: true,
              reason: pendingReason
            });
          }
          return _context42.f(9);
        case 10:
          return _context42.a(2);
      }
    }, _callee35, null, [[3,, 9, 10]]);
  }));
  return _updateHdgProfile.apply(this, arguments);
}
function generateHdgProfile(_x52, _x53, _x54, _x55, _x56) {
  return _generateHdgProfile.apply(this, arguments);
} // ── Landmarks (Städte & Airports) entlang Heading ────────
function _generateHdgProfile() {
  _generateHdgProfile = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee36(lat, lon, hdg, alt, gs) {
    var totalMin, totalNM, stepNM, backNM, points, i, ahead, bearing, dist, pt, timeMin, tileSet, tilePromises, _i34, _points, p, z, n, tx, latRad, ty, key, result, _i35, _points2, _p5, elevFt, _t36;
    return _regenerator().w(function (_context43) {
      while (1) switch (_context43.p = _context43.n) {
        case 0:
          if (!(!window.gaProfileDataProvider && typeof sampleTerrainElevation !== 'function')) {
            _context43.n = 1;
            break;
          }
          return _context43.a(2, null);
        case 1:
          if (!(vpMode !== 'HDG' || !vpCanRunVisibleMapProfileWork())) {
            _context43.n = 2;
            break;
          }
          return _context43.a(2, null);
        case 2:
          totalMin = VP_HDG_LOOKBACK_MIN + VP_HDG_LOOKAHEAD_MIN;
          totalNM = gs * (totalMin / 60);
          stepNM = totalNM / VP_HDG_SAMPLES;
          backNM = gs * (VP_HDG_LOOKBACK_MIN / 60);
          points = [];
          for (i = 0; i <= VP_HDG_SAMPLES; i++) {
            ahead = i * stepNM - backNM; // negativ = hinter dem Flugzeug
            bearing = ahead >= 0 ? hdg : (hdg + 180) % 360;
            dist = Math.abs(ahead);
            pt = typeof getDestinationPoint === 'function' ? getDestinationPoint(lat, lon, dist, bearing) : {
              lat,
              lon
            }; // distNM speichern wir in Minuten (i * totalMin / samples)
            timeMin = i * totalMin / VP_HDG_SAMPLES;
            points.push({
              lat: pt.lat,
              lon: pt.lon,
              distNM: timeMin
            });
          }
          if (!window.gaProfileDataProvider) {
            _context43.n = 3;
            break;
          }
          return _context43.a(2, window.gaProfileDataProvider.terrain(points, undefined, 'HDG'));
        case 3:
          // Tiles parallel vorladen (normalerweise 1-3 Tiles)
          tileSet = new Set();
          tilePromises = [];
          for (_i34 = 0, _points = points; _i34 < _points.length; _i34++) {
            p = _points[_i34];
            z = 10;
            n = Math.pow(2, z);
            tx = Math.floor((p.lon + 180) / 360 * n);
            latRad = p.lat * Math.PI / 180;
            ty = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
            key = `${z}/${tx}/${ty}`;
            if (!tileSet.has(key) && typeof _tawsLoadTile === 'function') {
              tileSet.add(key);
              tilePromises.push(_tawsLoadTile(tx, ty, z).catch(() => null));
            }
          }
          if (!tilePromises.length) {
            _context43.n = 4;
            break;
          }
          _context43.n = 4;
          return Promise.all(tilePromises);
        case 4:
          if (!(vpMode !== 'HDG' || !vpCanRunVisibleMapProfileWork())) {
            _context43.n = 5;
            break;
          }
          return _context43.a(2, null);
        case 5:
          // Höhen sampeln (synchron aus Cache)
          result = [];
          _i35 = 0, _points2 = points;
        case 6:
          if (!(_i35 < _points2.length)) {
            _context43.n = 11;
            break;
          }
          _p5 = _points2[_i35];
          if (!(result.length % 8 === 0 && (vpMode !== 'HDG' || !vpCanRunVisibleMapProfileWork()))) {
            _context43.n = 7;
            break;
          }
          return _context43.a(2, null);
        case 7:
          _context43.p = 7;
          _context43.n = 8;
          return sampleTerrainElevation(_p5.lat, _p5.lon);
        case 8:
          elevFt = _context43.v;
          result.push({
            distNM: _p5.distNM,
            elevFt: Math.max(0, elevFt),
            lat: _p5.lat,
            lon: _p5.lon
          });
          _context43.n = 10;
          break;
        case 9:
          _context43.p = 9;
          _t36 = _context43.v;
          result.push({
            distNM: _p5.distNM,
            elevFt: 0,
            lat: _p5.lat,
            lon: _p5.lon
          });
        case 10:
          _i35++;
          _context43.n = 6;
          break;
        case 11:
          return _context43.a(2, result);
      }
    }, _callee36, null, [[7, 9]]);
  }));
  return _generateHdgProfile.apply(this, arguments);
}
function computeHdgLandmarks(lat, lon, hdg, gs) {
  vpHdgLandmarks = [];
  var cities = Array.isArray(window.GLOBAL_CITIES_DATA) ? window.GLOBAL_CITIES_DATA : Array.isArray(globalCities) ? globalCities : [];
  var airports = typeof globalAirports !== 'undefined' && globalAirports ? Object.values(globalAirports) : [];
  var totalMin = VP_HDG_LOOKBACK_MIN + VP_HDG_LOOKAHEAD_MIN;
  var totalNM = gs * (totalMin / 60);
  var backNM = gs * (VP_HDG_LOOKBACK_MIN / 60);
  var found = [];

  // Städte
  var _iterator69 = _createForOfIteratorHelper(cities),
    _step69;
  try {
    for (_iterator69.s(); !(_step69 = _iterator69.n()).done;) {
      var c = _step69.value;
      if (!c.lat || !c.lon) continue;
      if (typeof calcNav !== 'function') break;
      var nav = calcNav(lat, lon, c.lat, c.lon);
      if (nav.dist > totalNM + 5) continue; // Grob-Filter
      // Winkel zur Heading-Linie prüfen
      var angleOff = Math.abs((nav.brng - hdg + 540) % 360 - 180);
      if (angleOff > 20 || nav.dist > totalNM + 3) continue;
      // Seitliche Abweichung prüfen (max 4 NM)
      var sideDevNM = nav.dist * Math.sin(angleOff * Math.PI / 180);
      if (Math.abs(sideDevNM) > 4) continue;
      // Distanz entlang Heading → Minuten
      var alongNM = nav.dist * Math.cos(angleOff * Math.PI / 180);
      var alongMin = alongNM / gs * 60;
      var timeMin = VP_HDG_LOOKBACK_MIN + (nav.brng === hdg ? alongMin : -alongMin);
      if (timeMin < 0 || timeMin > totalMin) continue;
      found.push({
        name: c.name || c.n,
        type: 'city',
        pop: c.pop || 0,
        distNM: timeMin
      });
    }

    // Airports
  } catch (err) {
    _iterator69.e(err);
  } finally {
    _iterator69.f();
  }
  var _iterator70 = _createForOfIteratorHelper(airports),
    _step70;
  try {
    for (_iterator70.s(); !(_step70 = _iterator70.n()).done;) {
      var a = _step70.value;
      if (!a.lat || !a.lon) continue;
      if (typeof calcNav !== 'function') break;
      var _nav = calcNav(lat, lon, a.lat, a.lon);
      if (_nav.dist > totalNM + 5) continue;
      var _angleOff = Math.abs((_nav.brng - hdg + 540) % 360 - 180);
      if (_angleOff > 20 || _nav.dist > totalNM + 3) continue;
      var _sideDevNM = _nav.dist * Math.sin(_angleOff * Math.PI / 180);
      if (Math.abs(_sideDevNM) > 4) continue;
      var _alongNM = _nav.dist * Math.cos(_angleOff * Math.PI / 180);
      var _alongMin = _alongNM / gs * 60;
      var _timeMin = VP_HDG_LOOKBACK_MIN + (_nav.brng === hdg ? _alongMin : -_alongMin);
      if (_timeMin < 0 || _timeMin > totalMin) continue;
      found.push({
        name: a.icao || a.name,
        type: 'apt',
        pop: 999999,
        distNM: _timeMin
      });
    }

    // Sortieren nach Entfernung, max. 12 Landmarks
  } catch (err) {
    _iterator70.e(err);
  } finally {
    _iterator70.f();
  }
  found.sort((a, b) => b.pop - a.pop);
  vpHdgLandmarks = found.slice(0, 12);
}

// ── Hindernisse aus Cache filtern ────────────────────────
function computeHdgObstacles(lat, lon, hdg, gs) {
  vpHdgObstacles = [];
  if (!vpObstacles || vpObstacles.length === 0) return;
  var totalMin = VP_HDG_LOOKBACK_MIN + VP_HDG_LOOKAHEAD_MIN;
  var totalNM = gs * (totalMin / 60);
  var backNM = gs * (VP_HDG_LOOKBACK_MIN / 60);
  var _iterator71 = _createForOfIteratorHelper(vpObstacles),
    _step71;
  try {
    for (_iterator71.s(); !(_step71 = _iterator71.n()).done;) {
      var obs = _step71.value;
      if (!obs.lat || !obs.lon) continue;
      if (typeof calcNav !== 'function') break;
      var nav = calcNav(lat, lon, obs.lat, obs.lon);
      if (nav.dist > totalNM + 3) continue;
      var angleOff = Math.abs((nav.brng - hdg + 540) % 360 - 180);
      if (angleOff > 20) continue;
      var sideDevNM = nav.dist * Math.sin(angleOff * Math.PI / 180);
      if (Math.abs(sideDevNM) > 3) continue;
      var alongNM = nav.dist * Math.cos(angleOff * Math.PI / 180);
      var alongMin = alongNM / gs * 60;
      // angleOff ≤ 20° → Hindernis liegt voraus (Heading-Korridor)
      var timeMin = VP_HDG_LOOKBACK_MIN + alongMin;
      if (timeMin < 0 || timeMin > totalMin) continue;
      vpHdgObstacles.push(_objectSpread(_objectSpread({}, obs), {}, {
        distNM: timeMin,
        groundElevFt: obs.elevFt
      }));
    }
  } catch (err) {
    _iterator71.e(err);
  } finally {
    _iterator71.f();
  }
}

// ── Lineare Features (Straßen, Flüsse, Stromtrassen) entlang Heading ──
function computeHdgLinearFeatures(lat, lon, hdg, gs) {
  vpHdgLinearFeatures = [];
  if (!vpLinearFeatures || vpLinearFeatures.length === 0) return;
  var totalMin = VP_HDG_LOOKBACK_MIN + VP_HDG_LOOKAHEAD_MIN;
  var totalNM = gs * (totalMin / 60);
  var _iterator72 = _createForOfIteratorHelper(vpLinearFeatures),
    _step72;
  try {
    for (_iterator72.s(); !(_step72 = _iterator72.n()).done;) {
      var lin = _step72.value;
      if (!lin.lat || !lin.lon) continue;
      if (typeof calcNav !== 'function') break;
      var nav = calcNav(lat, lon, lin.lat, lin.lon);
      if (nav.dist > totalNM + 3) continue;
      var angleOff = Math.abs((nav.brng - hdg + 540) % 360 - 180);
      if (angleOff > 25) continue; // etwas breiterer Korridor für Straßen/Flüsse
      var sideDevNM = nav.dist * Math.sin(angleOff * Math.PI / 180);
      if (Math.abs(sideDevNM) > 5) continue;
      var alongNM = nav.dist * Math.cos(angleOff * Math.PI / 180);
      var timeMin = VP_HDG_LOOKBACK_MIN + alongNM / gs * 60;
      if (timeMin < 0 || timeMin > totalMin) continue;
      vpHdgLinearFeatures.push(_objectSpread(_objectSpread({}, lin), {}, {
        distNM: timeMin
      }));
    }
  } catch (err) {
    _iterator72.e(err);
  } finally {
    _iterator72.f();
  }
}

// Shared live-profile projection, taken from the standalone GPS display path.
function _headingDiffDeg(a, b) {
  return Math.abs((a - b + 540) % 360 - 180);
}
function _profileSegmentCourseDeg(ed, i) {
  var _a$lon, _b$lon;
  var i0 = Math.max(0, i - 1);
  var i1 = Math.min(ed.length - 1, i + 1);
  if (i0 === i1) return null;
  var a = ed[i0],
    b = ed[i1];
  var aLon = (_a$lon = a.lon) !== null && _a$lon !== void 0 ? _a$lon : a.lng;
  var bLon = (_b$lon = b.lon) !== null && _b$lon !== void 0 ? _b$lon : b.lng;
  if (!Number.isFinite(a === null || a === void 0 ? void 0 : a.lat) || !Number.isFinite(aLon) || !Number.isFinite(b === null || b === void 0 ? void 0 : b.lat) || !Number.isFinite(bLon)) return null;
  var refLat = (a.lat + b.lat) * 0.5 * Math.PI / 180;
  var dLon = (bLon - aLon) * Math.cos(refLat);
  var dLat = b.lat - a.lat;
  if (Math.abs(dLon) < 1e-9 && Math.abs(dLat) < 1e-9) return null;
  return (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360;
}
function _profileIdxScore(ed, i, lat, lon, hdg) {
  var _p$lon;
  var p = ed[i];
  var pLon = (_p$lon = p.lon) !== null && _p$lon !== void 0 ? _p$lon : p.lng;
  var dLat = lat - p.lat;
  var dLon = lon - pLon;
  var distNm = Math.sqrt(dLat * dLat + dLon * dLon) * 59.9;
  var score = distNm;
  if (Number.isFinite(hdg)) {
    var segCourse = _profileSegmentCourseDeg(ed, i);
    if (Number.isFinite(segCourse)) {
      var diff = _headingDiffDeg(hdg, segCourse);
      if (diff > 20) {
        // Gegenkurs-Segmente in Nähe bekommen eine klare, aber nicht harte Strafe.
        score += Math.min(2.5, (diff - 20) / 160 * 2.5);
      }
    }
  }
  return {
    score,
    distNm
  };
}
function _getAirspaceColorForPredPoint(pt) {
  if (typeof activeAirspaces === 'undefined' || !activeAirspaces.length) return null;
  if (typeof getAirspaceVerticalBandFt === 'undefined' || typeof isPointInsideAirspace === 'undefined') return null;
  var _iterator73 = _createForOfIteratorHelper(activeAirspaces),
    _step73;
  try {
    for (_iterator73.s(); !(_step73 = _iterator73.n()).done;) {
      var _pt$terrainFt;
      var as = _step73.value;
      if (!as.geometry || !as.lowerLimit || !as.upperLimit) continue;
      if (as.type === 33) continue; // FIS überspringen
      var terrainBase = Number((_pt$terrainFt = pt.terrainFt) !== null && _pt$terrainFt !== void 0 ? _pt$terrainFt : window.lastLiveTerrainFt) || 0;
      var band = getAirspaceVerticalBandFt(as, terrainBase);
      if (!band) continue;
      if (pt.alt < band.lowerFt - 500 || pt.alt > band.upperFt + 500) continue;
      if (isPointInsideAirspace(as, pt.lat, pt.lon)) return typeof getAirspaceStyle === 'function' ? getAirspaceStyle(as).color : '#f2c12e';
    }
  } catch (err) {
    _iterator73.e(err);
  } finally {
    _iterator73.f();
  }
  return null;
}
function vpUpdateLiveProfilePosition(lat, lon, alt, hdg, liveMapVisualActive) {
  // --- ICON B: HÖHENPROFIL ---
  // Richtungssensitives Lock-on: verhindert Sprünge zwischen nahen Hin-/Rück-Segmenten.
  if (typeof vpElevationData !== 'undefined' && vpElevationData && vpElevationData.length > 2) {
    var _ed$bestIdx$elevFt;
    var ed = vpElevationData;
    var totalDist = ed[ed.length - 1].distNM;
    var routeSig = `${ed.length}:${Math.round(totalDist * 10)}`;
    if (routeSig !== vpProfileLockSig) {
      vpProfileLockSig = routeSig;
      vpProfileLockIdx = -1;
    }
    var coarseStep = Math.max(1, Math.floor(ed.length / 8));
    var coarseIdx = 0,
      coarseBest = Infinity;
    for (var i = 0; i < ed.length; i += coarseStep) {
      var _p$lon2;
      var p = ed[i];
      var pLon = (_p$lon2 = p.lon) !== null && _p$lon2 !== void 0 ? _p$lon2 : p.lng;
      var dLat = lat - p.lat;
      var dLon = lon - pLon;
      var d2 = dLat * dLat + dLon * dLon;
      if (d2 < coarseBest) {
        coarseBest = d2;
        coarseIdx = i;
      }
    }
    var localWindow = Math.max(40, coarseStep * 4);
    var hasLock = Number.isFinite(vpProfileLockIdx) && vpProfileLockIdx >= 0 && vpProfileLockIdx < ed.length;
    var searchLo = Math.max(0, coarseIdx - coarseStep);
    var searchHi = Math.min(ed.length - 1, coarseIdx + coarseStep);
    if (hasLock) {
      searchLo = Math.max(0, vpProfileLockIdx - localWindow);
      searchHi = Math.min(ed.length - 1, vpProfileLockIdx + localWindow);
    }
    var bestIdx = searchLo;
    var bestScore = Infinity;
    var bestDistNm = Infinity;
    for (var _i30 = searchLo; _i30 <= searchHi; _i30++) {
      var s = _profileIdxScore(ed, _i30, lat, lon, hdg);
      if (s.score < bestScore) {
        bestScore = s.score;
        bestDistNm = s.distNm;
        bestIdx = _i30;
      }
    }

    // Wenn Lock-Fenster zu weit weg liegt, einmal global neu einloggen.
    if (hasLock && bestDistNm > 2.2) {
      var globalBestIdx = 0;
      var globalBestScore = Infinity;
      var globalBestDistNm = Infinity;
      for (var _i31 = 0; _i31 < ed.length; _i31 += 1) {
        var _s3 = _profileIdxScore(ed, _i31, lat, lon, hdg);
        if (_s3.score < globalBestScore) {
          globalBestScore = _s3.score;
          globalBestDistNm = _s3.distNm;
          globalBestIdx = _i31;
        }
      }
      bestIdx = globalBestIdx;
      bestDistNm = globalBestDistNm;
    }
    vpProfileLockIdx = bestIdx;
    window.vpLiveRouteDistNM = bestDistNm;

    // Terrain-Höhe weiterhin intern vorhalten (z.B. für Warnlogik),
    // Telemetrie zeigt aber MSL-Höhe.
    var terrainFt = bestDistNm < 10 ? (_ed$bestIdx$elevFt = ed[bestIdx].elevFt) !== null && _ed$bestIdx$elevFt !== void 0 ? _ed$bestIdx$elevFt : 0 : 0;
    window.lastLiveTerrainFt = terrainFt;
    var mslFt = Math.max(0, Math.round(alt));
    var aglEl = liveMapVisualActive ? document.getElementById('teleAGL') : null;
    if (aglEl) {
      aglEl.textContent = mslFt;
      aglEl.style.color = mslFt < 1500 ? '#ff4444' : mslFt < 3000 ? '#ffcc44' : '#8ec5ff';
    }
    if (bestDistNm < 10) {
      // ~10 NM Schwelle für Icon-Anzeige
      if (typeof vpUpdateLiveAircraft === 'function') {
        vpUpdateLiveAircraft(ed[bestIdx].distNM / totalDist, alt, hdg);
      }
    } else {
      window.vpLiveRouteDistNM = 999;
      if (typeof vpUpdateLiveAircraft === 'function') {
        vpUpdateLiveAircraft(-1, alt, hdg); // -1 = ausblenden
      }
    }
  }
}
