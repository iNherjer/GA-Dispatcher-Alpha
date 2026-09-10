// Generated from checklists.js by sync-efb-web-assets.js. Do not edit.
function _regeneratorValues(e) { if (null != e) { var t = e["function" == typeof Symbol && Symbol.iterator || "@@iterator"], r = 0; if (t) return t.call(e); if ("function" == typeof e.next) return e; if (!isNaN(e.length)) return { next: function next() { return e && r >= e.length && (e = void 0), { value: e && e[r++], done: !e }; } }; } throw new TypeError(typeof e + " is not iterable"); }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i.return) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t.return || t.return(); } finally { if (u) throw o; } } }; }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
(function () {
  'use strict';

  var CUSTOM_STORAGE_KEY = 'ga_checklists_custom_v1';
  var PROGRESS_STORAGE_KEY = 'ga_checklist_progress_v1';
  var UI_STORAGE_KEY = 'ga_checklist_ui_v1';
  var VISIBLE_STORAGE_KEY = 'ga_checklist_visible_v1';
  var ORDER_STORAGE_KEY = 'ga_checklist_order_v1';
  var COMMUNITY_SUBS_KEY = 'ga_checklist_community_subs_v1';
  var COMMUNITY_META_KEY = 'ga_checklist_community_meta_v1';
  var COMMUNITY_CACHE_KEY = 'ga_checklist_community_cache_v1';
  var COMMUNITY_POLL_LOCK_KEY = 'ga_checklist_community_poll_lock_v1';
  var SHARE_PREFIX = 'GA-CHECKLIST-v1:';
  var MAX_CHAPTERS = 20;
  var MAX_ITEMS = 300;
  var MAX_TEXT_LENGTH = 220;
  var ROUTE_TOOLS_PROXY = 'https://ga-proxy.einherjer.workers.dev';
  var TOOL_CACHE_TTL_MS = 4 * 60 * 1000;
  var WEATHER_AI_CACHE_TTL_MS = 12 * 60 * 1000;
  var WEATHER_METAR_RADIUS_NM = 70;
  var NEAREST_CACHE_TTL_MS = 2 * 60 * 1000;
  var NEAREST_RADIUS_NM = 50;
  var NEAREST_MOVE_REFRESH_NM = 3;
  var PLACE_MAP_MODE_KEY = 'ga_route_tool_place_map_mode';
  var COMMUNITY_POLL_INTERVAL_MS = 30 * 60 * 1000;
  var COMMUNITY_POLL_TIMER_MS = 60 * 1000;
  var COMMUNITY_POLL_LOCK_TTL_MS = 2 * 60 * 1000;
  var COMMUNITY_TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  var TRACKER_CHECKLIST_CAPABILITY = 'checklist.library.v1';
  var BUILTIN_CHECKLISTS = [{
    id: 'builtin-vfr-briefing',
    title: 'VFR Briefing',
    source: 'builtin',
    editable: false,
    createdAt: 0,
    updatedAt: 0,
    chapters: [{
      id: 'route',
      title: 'Route',
      items: [{
        id: 'route-start-dest',
        text: 'Start, Ziel und Ausweichplatz geprüft'
      }, {
        id: 'route-track',
        text: 'Kurs, Strecke und ETE plausibel'
      }, {
        id: 'route-altitude',
        text: 'Reiseflughöhe, Mindesthöhen und Terrain geprüft'
      }, {
        id: 'route-airspace',
        text: 'Lufträume, RMZ/TMZ/CTR und ED-R entlang der Route geprüft'
      }, {
        id: 'route-frequencies',
        text: 'Frequenzen und Meldepunkte notiert'
      }]
    }, {
      id: 'weather',
      title: 'Wetter',
      items: [{
        id: 'weather-metar',
        text: 'METAR/TAF für Start, Ziel und Alternates geprüft'
      }, {
        id: 'weather-wind',
        text: 'Wind, Sicht, Wolkenuntergrenzen und Niederschlag bewertet'
      }, {
        id: 'weather-gafor',
        text: 'VFR-Index/GAFOR und Trend entlang der Route geprüft'
      }, {
        id: 'weather-daylight',
        text: 'Tageslicht, Sonnenstand und Reserven berücksichtigt'
      }]
    }, {
      id: 'aircraft',
      title: 'Aircraft',
      items: [{
        id: 'aircraft-fuel',
        text: 'Fuel, Reserve und Verbrauch gerechnet'
      }, {
        id: 'aircraft-wb',
        text: 'Beladung, Schwerpunkt und Performance geprüft'
      }, {
        id: 'aircraft-docs',
        text: 'Dokumente, Karten und Flugplan/Briefing bereit'
      }, {
        id: 'aircraft-emergency',
        text: 'Notverfahren und kritische Frequenzen im Kopf'
      }]
    }]
  }, {
    id: 'builtin-sep-normal-sim',
    title: 'SEP Normal Procedures (Sim)',
    source: 'builtin',
    editable: false,
    createdAt: 0,
    updatedAt: 0,
    chapters: [{
      id: 'before-start',
      title: 'Before Start',
      items: [{
        id: 'before-parking',
        text: 'Parking brake set'
      }, {
        id: 'before-fuel',
        text: 'Fuel selector and quantity checked'
      }, {
        id: 'before-mixture',
        text: 'Mixture rich or as required'
      }, {
        id: 'before-avionics',
        text: 'Avionics off, circuit breakers checked'
      }, {
        id: 'before-brief',
        text: 'Departure brief complete'
      }]
    }, {
      id: 'runup',
      title: 'Run-up',
      items: [{
        id: 'runup-brakes',
        text: 'Brakes hold'
      }, {
        id: 'runup-engine',
        text: 'Engine instruments in green'
      }, {
        id: 'runup-mags',
        text: 'Magnetos checked'
      }, {
        id: 'runup-controls',
        text: 'Flight controls free and correct'
      }, {
        id: 'runup-trim',
        text: 'Trim and flaps set for takeoff'
      }]
    }, {
      id: 'takeoff',
      title: 'Takeoff',
      items: [{
        id: 'takeoff-lights',
        text: 'Lights and transponder set'
      }, {
        id: 'takeoff-runway',
        text: 'Runway, heading and wind confirmed'
      }, {
        id: 'takeoff-power',
        text: 'Full power and engine indications checked'
      }, {
        id: 'takeoff-speed',
        text: 'Airspeed alive'
      }, {
        id: 'takeoff-after',
        text: 'After takeoff climb configuration set'
      }]
    }, {
      id: 'cruise',
      title: 'Cruise',
      items: [{
        id: 'cruise-power',
        text: 'Power, mixture and trim set'
      }, {
        id: 'cruise-nav',
        text: 'Navigation cross-checked'
      }, {
        id: 'cruise-fuel',
        text: 'Fuel and endurance monitored'
      }, {
        id: 'cruise-weather',
        text: 'Weather and terrain escape options reviewed'
      }]
    }]
  }, {
    id: 'builtin-arrival-landing',
    title: 'Arrival/Landing Briefing',
    source: 'builtin',
    editable: false,
    createdAt: 0,
    updatedAt: 0,
    chapters: [{
      id: 'arrival',
      title: 'Arrival',
      items: [{
        id: 'arrival-airport',
        text: 'Airport elevation, runway and circuit direction checked'
      }, {
        id: 'arrival-frequency',
        text: 'Frequency and reporting points ready'
      }, {
        id: 'arrival-weather',
        text: 'Wind, QNH, visibility and cloud base checked'
      }, {
        id: 'arrival-noise',
        text: 'Noise abatement and local restrictions reviewed'
      }]
    }, {
      id: 'approach',
      title: 'Approach',
      items: [{
        id: 'approach-speed',
        text: 'Approach speed and flap plan briefed'
      }, {
        id: 'approach-missed',
        text: 'Go-around path and safe altitude briefed'
      }, {
        id: 'approach-traffic',
        text: 'Traffic scan and radio picture updated'
      }, {
        id: 'approach-landing',
        text: 'Landing distance and runway condition acceptable'
      }]
    }, {
      id: 'after-landing',
      title: 'After Landing',
      items: [{
        id: 'after-runway',
        text: 'Runway vacated and transponder as required'
      }, {
        id: 'after-flaps',
        text: 'Flaps retracted'
      }, {
        id: 'after-lights',
        text: 'Lights and avionics set'
      }, {
        id: 'after-taxi',
        text: 'Taxi route and parking plan confirmed'
      }]
    }]
  }];
  var drawerEl = null;
  var handleEl = null;
  var bodyEl = null;
  var titleEl = null;
  var statusEl = null;
  var customLists = [];
  var progressByChecklist = {};
  var visibilityPrefs = {};
  var checklistOrderPrefs = [];
  var communitySubscriptions = {};
  var communityMeta = [];
  var communityCache = {};
  var kvPullInProgress = false;
  var lastKvPullAt = 0;
  var communityPullInProgress = false;
  var lastCommunityPullAt = 0;
  var trackerPublishTimer = null;
  var trackerLastPublishedHash = '';
  var trackerConnectionToken = '';
  var state = {
    view: 'home',
    selectedId: '',
    activeChapterId: '',
    editorDraft: null,
    editorMode: '',
    statusText: '',
    statusTone: '',
    actionMenuOpen: false,
    nearestMenuKey: '',
    radioAirportMenuKey: '',
    placeInfoAirport: null,
    placeInfoReturn: 'place',
    cargoExpandedItemId: '',
    cargoPayloadRequestedAt: 0,
    cargoPayloadLoading: false,
    missionStoryExpanded: false
  };
  var toolState = {
    weather: {
      key: '',
      updatedAt: 0,
      loading: false,
      data: null,
      error: '',
      controller: null,
      aiKey: '',
      aiUpdatedAt: 0,
      aiLoading: false
    },
    radio: {
      key: '',
      updatedAt: 0,
      loading: false,
      data: null,
      error: '',
      controller: null
    },
    warnings: {
      key: '',
      updatedAt: 0,
      loading: false,
      data: null,
      error: '',
      controller: null
    },
    place: {
      key: '',
      updatedAt: 0,
      loading: false,
      data: null,
      error: '',
      controller: null
    },
    nearest: {
      key: '',
      updatedAt: 0,
      loading: false,
      data: null,
      error: '',
      controller: null,
      origin: null
    },
    airportInfo: {
      key: '',
      updatedAt: 0,
      loading: false,
      data: null,
      error: '',
      controller: null
    }
  };
  var miniMaps = new Map();
  var expandedPlaceMap = null;
  var expandedPlaceMapEl = null;
  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (_) {
      return fallback;
    }
  }
  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function makeId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return `${prefix}_${window.crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
    }
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
  function cleanText(value) {
    var max = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : MAX_TEXT_LENGTH;
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function safeId(value, prefix) {
    var raw = String(value || '').trim().replace(/[^\w:-]/g, '').slice(0, 96);
    return raw || makeId(prefix);
  }
  function escapeHtml(value) {
    return String(value !== null && value !== void 0 ? value : '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeAttr(value) {
    return escapeHtml(value);
  }
  function itemCount(checklist) {
    return ((checklist === null || checklist === void 0 ? void 0 : checklist.chapters) || []).reduce((sum, chapter) => sum + (chapter.items || []).length, 0);
  }
  function sourceLabel(checklist) {
    if ((checklist === null || checklist === void 0 ? void 0 : checklist.source) === 'tracker') return 'Tracker';
    if ((checklist === null || checklist === void 0 ? void 0 : checklist.source) === 'builtin') return 'Standard';
    if ((checklist === null || checklist === void 0 ? void 0 : checklist.source) === 'community') return 'Community';
    return checklist !== null && checklist !== void 0 && checklist.published ? 'Eigene Liste · Veröffentlicht' : 'Eigene Liste';
  }
  function normalizeChapter(chapter, index, preserveIds) {
    var rawItems = Array.isArray(chapter === null || chapter === void 0 ? void 0 : chapter.items) ? chapter.items : [];
    var items = [];
    var _iterator = _createForOfIteratorHelper(rawItems),
      _step;
    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var item = _step.value;
        if (items.length >= MAX_ITEMS) break;
        var text = cleanText(item === null || item === void 0 ? void 0 : item.text);
        if (!text) continue;
        items.push({
          id: preserveIds ? safeId(item === null || item === void 0 ? void 0 : item.id, 'item') : makeId('item'),
          text
        });
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }
    return {
      id: preserveIds ? safeId(chapter === null || chapter === void 0 ? void 0 : chapter.id, 'chap') : makeId('chap'),
      title: cleanText(chapter === null || chapter === void 0 ? void 0 : chapter.title, 64) || `Kapitel ${index + 1}`,
      items
    };
  }
  function sanitizeChecklist(input) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var preserveIds = options.preserveIds !== false;
    var now = Date.now();
    var chapters = [];
    var total = 0;
    var rawChapters = Array.isArray(input === null || input === void 0 ? void 0 : input.chapters) ? input.chapters : [];
    for (var i = 0; i < rawChapters.length && chapters.length < MAX_CHAPTERS; i += 1) {
      var chapter = normalizeChapter(rawChapters[i], chapters.length, preserveIds);
      var room = MAX_ITEMS - total;
      if (room <= 0) break;
      chapter.items = chapter.items.slice(0, room);
      if (!chapter.items.length) continue;
      total += chapter.items.length;
      chapters.push(chapter);
    }
    return {
      id: options.id || (preserveIds ? safeId(input === null || input === void 0 ? void 0 : input.id, 'custom') : makeId('custom')),
      title: cleanText(input === null || input === void 0 ? void 0 : input.title, 96) || 'Checkliste',
      source: options.source || (input === null || input === void 0 ? void 0 : input.source) || 'custom',
      editable: options.editable !== undefined ? !!options.editable : (input === null || input === void 0 ? void 0 : input.editable) !== false,
      createdAt: Number((input === null || input === void 0 ? void 0 : input.createdAt) || now),
      updatedAt: Number((input === null || input === void 0 ? void 0 : input.updatedAt) || now),
      published: !!(input !== null && input !== void 0 && input.published),
      communityId: input !== null && input !== void 0 && input.communityId ? safeId(input.communityId, 'community') : '',
      communityUpdatedAt: Number((input === null || input === void 0 ? void 0 : input.communityUpdatedAt) || 0),
      chapters
    };
  }
  function sanitizeCustomList(input) {
    var sanitized = sanitizeChecklist(input, {
      id: safeId(input === null || input === void 0 ? void 0 : input.id, 'custom'),
      source: 'custom',
      editable: true,
      preserveIds: true
    });
    if (sanitized.published && !sanitized.communityId) sanitized.communityId = sanitized.id;
    return sanitized.chapters.length ? sanitized : null;
  }
  function sanitizeCommunityMeta(input) {
    if (!input || typeof input !== 'object') return null;
    var id = safeId(input.id, 'community');
    var title = cleanText(input.title, 96);
    if (!id || !title) return null;
    return {
      id,
      title,
      updatedAt: Number(input.updatedAt || 0),
      version: Number(input.version || 1),
      chapterCount: Math.max(0, Number(input.chapterCount || 0)),
      itemCount: Math.max(0, Number(input.itemCount || 0))
    };
  }
  function communityChecklistFromRecord(record) {
    var meta = sanitizeCommunityMeta(record);
    if (!meta) return null;
    var sanitized = sanitizeChecklist(record, {
      id: `community:${meta.id}`,
      source: 'community',
      editable: false,
      preserveIds: true
    });
    if (!sanitized.chapters.length) return null;
    sanitized.communityId = meta.id;
    sanitized.updatedAt = meta.updatedAt || sanitized.updatedAt;
    sanitized.communityUpdatedAt = meta.updatedAt || sanitized.updatedAt;
    sanitized.published = true;
    return sanitized;
  }
  function customCommunityIds() {
    return new Set(customLists.filter(c => c.published).map(c => c.communityId || c.id));
  }
  function subscribedCommunityLists() {
    var ownIds = customCommunityIds();
    return Object.keys(communitySubscriptions).filter(id => communitySubscriptions[id] && !ownIds.has(id)).map(id => communityCache[id]).filter(Boolean).sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
  }
  function baseChecklists() {
    var _window$gaChecklistHo, _window$gaChecklistHo2;
    return [].concat(BUILTIN_CHECKLISTS, _toConsumableArray((((_window$gaChecklistHo = window.gaChecklistHost) === null || _window$gaChecklistHo === void 0 || (_window$gaChecklistHo2 = _window$gaChecklistHo.checklists) === null || _window$gaChecklistHo2 === void 0 ? void 0 : _window$gaChecklistHo2.call(_window$gaChecklistHo)) || []).filter(c => !customLists.some(own => own.id === c.id))), _toConsumableArray(customLists.slice().sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))), _toConsumableArray(subscribedCommunityLists()));
  }
  function orderedChecklistIds() {
    var list = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : baseChecklists();
    var ids = list.map(checklist => checklist.id);
    var valid = new Set(ids);
    var ordered = checklistOrderPrefs.filter(id => valid.has(id));
    ids.forEach(id => {
      if (!ordered.includes(id)) ordered.push(id);
    });
    return ordered;
  }
  function sortChecklistsByPreference(list) {
    var order = orderedChecklistIds(list);
    var rank = new Map(order.map((id, index) => [id, index]));
    return list.slice().sort((a, b) => {
      var _rank$get, _rank$get2;
      return ((_rank$get = rank.get(a.id)) !== null && _rank$get !== void 0 ? _rank$get : 9999) - ((_rank$get2 = rank.get(b.id)) !== null && _rank$get2 !== void 0 ? _rank$get2 : 9999);
    });
  }
  function allChecklists() {
    return sortChecklistsByPreference(baseChecklists());
  }
  function visibleChecklists() {
    return allChecklists().filter(isChecklistVisible);
  }
  function getChecklist(id) {
    return allChecklists().find(checklist => checklist.id === id) || null;
  }
  function isChecklistVisible(checklist) {
    if (!checklist) return false;
    if (checklist.source === 'community') return !!communitySubscriptions[checklist.communityId];
    if (Object.prototype.hasOwnProperty.call(visibilityPrefs, checklist.id)) return !!visibilityPrefs[checklist.id];
    return true;
  }
  function setChecklistVisible(id, visible) {
    visibilityPrefs[id] = !!visible;
    writeJson(VISIBLE_STORAGE_KEY, visibilityPrefs);
    saveChecklistOrder();
  }
  function saveChecklistOrder() {
    var ids = orderedChecklistIds();
    checklistOrderPrefs = ids;
    writeJson(ORDER_STORAGE_KEY, checklistOrderPrefs);
  }
  function moveChecklistOrder(id, dir) {
    var ids = orderedChecklistIds();
    var index = ids.indexOf(id);
    var next = index + dir;
    if (index < 0 || next < 0 || next >= ids.length) return false;
    var _ids$splice = ids.splice(index, 1),
      _ids$splice2 = _slicedToArray(_ids$splice, 1),
      item = _ids$splice2[0];
    ids.splice(next, 0, item);
    checklistOrderPrefs = ids;
    writeJson(ORDER_STORAGE_KEY, checklistOrderPrefs);
    return true;
  }
  function loadStateFromStorage() {
    var rawCustom = readJson(CUSTOM_STORAGE_KEY, []);
    customLists = Array.isArray(rawCustom) ? rawCustom.map(sanitizeCustomList).filter(Boolean) : [];
    progressByChecklist = readJson(PROGRESS_STORAGE_KEY, {});
    if (!progressByChecklist || typeof progressByChecklist !== 'object') progressByChecklist = {};
    visibilityPrefs = readJson(VISIBLE_STORAGE_KEY, {});
    if (!visibilityPrefs || typeof visibilityPrefs !== 'object') visibilityPrefs = {};
    var rawOrder = readJson(ORDER_STORAGE_KEY, []);
    checklistOrderPrefs = Array.isArray(rawOrder) ? rawOrder.map(id => String(id || '')).filter(Boolean) : [];
    communitySubscriptions = readJson(COMMUNITY_SUBS_KEY, {});
    if (!communitySubscriptions || typeof communitySubscriptions !== 'object') communitySubscriptions = {};
    var rawMeta = readJson(COMMUNITY_META_KEY, []);
    communityMeta = Array.isArray(rawMeta) ? rawMeta.map(sanitizeCommunityMeta).filter(Boolean) : [];
    var rawCache = readJson(COMMUNITY_CACHE_KEY, {});
    communityCache = {};
    if (rawCache && typeof rawCache === 'object') {
      Object.keys(rawCache).forEach(id => {
        var checklist = communityChecklistFromRecord(rawCache[id]);
        if (checklist) communityCache[id] = checklist;
      });
    }
    var savedUi = readJson(UI_STORAGE_KEY, {});
    state.selectedId = savedUi.selectedId || '';
    state.activeChapterId = savedUi.activeChapterId || '';
  }
  function saveCustomLists() {
    writeJson(CUSTOM_STORAGE_KEY, customLists);
    scheduleCustomChecklistsForTracker();
  }
  function trackerCustomChecklistSnapshot() {
    var checklists = customLists.map(checklist => ({
      id: checklist.id,
      title: checklist.title,
      updatedAt: Number(checklist.updatedAt || 0),
      chapters: (checklist.chapters || []).map(chapter => ({
        id: chapter.id,
        title: chapter.title,
        items: (chapter.items || []).map(item => ({
          id: item.id,
          text: item.text
        }))
      }))
    }));
    return {
      revision: checklists.reduce((latest, checklist) => Math.max(latest, Number(checklist.updatedAt || 0)), 0),
      updatedAt: Date.now(),
      checklists
    };
  }
  function publishCustomChecklistsToTracker() {
    var capabilities = Array.isArray(window.liveTrackerCapabilities) ? window.liveTrackerCapabilities : [];
    if (!capabilities.includes(TRACKER_CHECKLIST_CAPABILITY) || typeof window.sendTrackerCommand !== 'function') return false;
    var library = trackerCustomChecklistSnapshot();
    var contentHash = JSON.stringify(library.checklists);
    if (contentHash === trackerLastPublishedHash) return true;
    var commandId = window.sendTrackerCommand({
      type: 'efb_checklist_library.store',
      library
    });
    if (!commandId) return false;
    trackerLastPublishedHash = contentHash;
    return true;
  }
  function scheduleCustomChecklistsForTracker() {
    var delayMs = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 180;
    if (trackerPublishTimer) clearTimeout(trackerPublishTimer);
    trackerPublishTimer = setTimeout(() => {
      trackerPublishTimer = null;
      publishCustomChecklistsToTracker();
    }, Math.max(0, Number(delayMs) || 0));
  }
  window.gaGetCustomChecklistTrackerSnapshot = trackerCustomChecklistSnapshot;
  function saveProgress() {
    writeJson(PROGRESS_STORAGE_KEY, progressByChecklist);
  }
  function saveCommunityState() {
    writeJson(COMMUNITY_SUBS_KEY, communitySubscriptions);
    writeJson(COMMUNITY_META_KEY, communityMeta);
    var rawCache = {};
    Object.keys(communityCache).forEach(id => {
      var checklist = communityCache[id];
      if (!checklist) return;
      rawCache[id] = {
        id: checklist.communityId || id,
        title: checklist.title,
        updatedAt: checklist.communityUpdatedAt || checklist.updatedAt || Date.now(),
        version: checklist.version || 1,
        chapters: checklist.chapters
      };
    });
    writeJson(COMMUNITY_CACHE_KEY, rawCache);
  }
  function persistUiState() {
    writeJson(UI_STORAGE_KEY, {
      selectedId: state.selectedId,
      activeChapterId: state.activeChapterId
    });
  }
  function setStatus(text) {
    var tone = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
    state.statusText = text || '';
    state.statusTone = tone || '';
    renderStatus();
  }
  function renderStatus() {
    if (!statusEl) return;
    statusEl.className = `map-side-drawer-status${state.statusTone ? ` is-${state.statusTone}` : ''}`;
    statusEl.textContent = state.statusText || '';
  }
  function setTitle(text) {
    if (titleEl) titleEl.textContent = text || 'Kartenwerkzeuge';
  }
  function getRoutePoints() {
    try {
      if (typeof routeWaypoints !== 'undefined' && Array.isArray(routeWaypoints)) {
        return routeWaypoints.map(wp => {
          var _wp$lng;
          return {
            lat: Number(wp === null || wp === void 0 ? void 0 : wp.lat),
            lon: Number((_wp$lng = wp === null || wp === void 0 ? void 0 : wp.lng) !== null && _wp$lng !== void 0 ? _wp$lng : wp === null || wp === void 0 ? void 0 : wp.lon),
            name: (wp === null || wp === void 0 ? void 0 : wp.name) || ''
          };
        }).filter(wp => Number.isFinite(wp.lat) && Number.isFinite(wp.lon));
      }
    } catch (_) {}
    return [];
  }
  function getRouteKey() {
    var pts = getRoutePoints();
    if (pts.length < 1) return 'no-route';
    return pts.map(p => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`).join('|');
  }
  function getLiveAircraftPosition() {
    var maxAgeMs = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 30000;
    var pos = window.lastLiveGpsPos;
    if (!pos || !Number.isFinite(Number(pos.lat)) || !Number.isFinite(Number(pos.lon))) return null;
    var t = Number(pos.t || 0);
    if (t && Date.now() - t > maxAgeMs) return null;
    return {
      lat: Number(pos.lat),
      lon: Number(pos.lon),
      t
    };
  }
  function navBetween(lat1, lon1, lat2, lon2) {
    try {
      if (typeof calcNav === 'function') return calcNav(lat1, lon1, lat2, lon2);
    } catch (_) {}
    var r = 3440.065;
    var toRad = d => d * Math.PI / 180;
    var p1 = toRad(lat1),
      p2 = toRad(lat2);
    var dLat = toRad(lat2 - lat1),
      dLon = toRad(lon2 - lon1);
    var a = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(p1) * Math.cos(p2) * Math.pow(Math.sin(dLon / 2), 2);
    var dist = Math.round(r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
    var y = Math.sin(dLon) * Math.cos(p2);
    var x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
    var brng = Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
    return {
      dist,
      brng
    };
  }
  function fmtNm(value) {
    try {
      if (typeof formatNm === 'function') return formatNm(value);
    } catch (_) {}
    var n = Number(value);
    return Number.isFinite(n) ? (Math.round(n * 10) / 10).toFixed(1) : '0.0';
  }
  function compassFromBearing(brng) {
    var dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
    var n = Number(brng);
    if (!Number.isFinite(n)) return '';
    return dirs[Math.round((n % 360 + 360) % 360 / 45) % 8];
  }
  function routeBounds(points) {
    var padNm = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 8;
    var pts = Array.isArray(points) ? points : getRoutePoints();
    if (!pts.length) return null;
    var minLat = Infinity,
      maxLat = -Infinity,
      minLon = Infinity,
      maxLon = -Infinity;
    pts.forEach(p => {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLon = Math.min(minLon, p.lon);
      maxLon = Math.max(maxLon, p.lon);
    });
    var midLat = (minLat + maxLat) * 0.5;
    var padLat = padNm / 60;
    var padLon = padNm / (60 * Math.max(0.25, Math.cos(midLat * Math.PI / 180)));
    return {
      minLat: Math.max(-89.5, minLat - padLat),
      maxLat: Math.min(89.5, maxLat + padLat),
      minLon: Math.max(-180, minLon - padLon),
      maxLon: Math.min(180, maxLon + padLon)
    };
  }
  function airportFromGlobal(icao) {
    var code = String(icao || '').trim().toUpperCase();
    if (!code || code === 'GPS' || code === 'POI') return null;
    try {
      var apt = typeof globalAirports !== 'undefined' && globalAirports ? globalAirports[code] : null;
      if (!apt) return {
        icao: code,
        name: code,
        lat: NaN,
        lon: NaN
      };
      return normalizeToolAirport(_objectSpread(_objectSpread({}, apt), {}, {
        icao: code
      }));
    } catch (_) {
      return {
        icao: code,
        name: code,
        lat: NaN,
        lon: NaN
      };
    }
  }
  function normalizeToolAirport(input) {
    var _input$geometry, _ref, _input$lat, _ref2, _ref3, _input$lon;
    if (!input) return null;
    var coords = (_input$geometry = input.geometry) === null || _input$geometry === void 0 ? void 0 : _input$geometry.coordinates;
    var lat = Number((_ref = (_input$lat = input.lat) !== null && _input$lat !== void 0 ? _input$lat : input.latitude) !== null && _ref !== void 0 ? _ref : Array.isArray(coords) ? coords[1] : NaN);
    var lon = Number((_ref2 = (_ref3 = (_input$lon = input.lon) !== null && _input$lon !== void 0 ? _input$lon : input.lng) !== null && _ref3 !== void 0 ? _ref3 : input.longitude) !== null && _ref2 !== void 0 ? _ref2 : Array.isArray(coords) ? coords[0] : NaN);
    var icao = String(input.icao || input.icaoCode || input.ident || input.code || input.designator || '').trim().toUpperCase();
    var elevRaw = input.elevation;
    var elev = typeof elevRaw === 'object' && elevRaw ? elevRaw.unit === 1 ? Number(elevRaw.value) : Math.round(Number(elevRaw.value) * 3.28084) : Number(elevRaw);
    return {
      icao,
      name: input.name || input.n || input.title || icao || 'Flugplatz',
      lat,
      lon,
      elevation: Number.isFinite(elev) ? elev : null,
      country: input.country || input.iso_country || input.cc || ''
    };
  }
  function getCurrentAirport(kind) {
    var _fromDb$elevation;
    var isDest = kind === 'dest';
    var icao = '';
    try {
      var rawIcao = isDest ? currentDestICAO : currentStartICAO;
      icao = rawIcao == null ? '' : String(rawIcao).trim().toUpperCase();
      if (icao === 'UNDEFINED' || icao === 'NULL') icao = '';
    } catch (_) {}
    var route = getRoutePoints();
    var wp = isDest ? route[route.length - 1] : route[0];
    var fromDb = airportFromGlobal(icao);
    if (fromDb && Number.isFinite(fromDb.lat) && Number.isFinite(fromDb.lon)) return fromDb;
    var name = '';
    try {
      var rawName = isDest ? currentDName : currentSName;
      name = rawName == null ? '' : String(rawName).trim();
      if (/^(undefined|null)$/i.test(name)) name = '';
    } catch (_) {}
    return {
      icao: icao || '',
      name: name || (wp === null || wp === void 0 ? void 0 : wp.name) || icao || (isDest ? 'Ziel' : 'Start'),
      lat: Number(wp === null || wp === void 0 ? void 0 : wp.lat),
      lon: Number(wp === null || wp === void 0 ? void 0 : wp.lon),
      elevation: (_fromDb$elevation = fromDb === null || fromDb === void 0 ? void 0 : fromDb.elevation) !== null && _fromDb$elevation !== void 0 ? _fromDb$elevation : null,
      country: (fromDb === null || fromDb === void 0 ? void 0 : fromDb.country) || ''
    };
  }
  function getFreqLines(icao) {
    var code = String(icao || '').trim().toUpperCase();
    if (!code) return [];
    try {
      var cached = typeof freqCache !== 'undefined' && freqCache ? freqCache[code] : null;
      if (Array.isArray(cached)) {
        return cached.filter(f => f && (f.value || typeof f === 'string')).map(f => typeof f === 'string' ? {
          label: 'Freq',
          value: f
        } : {
          label: f.label || f.name || 'Freq',
          value: f.value
        });
      }
    } catch (_) {}
    return [];
  }
  function getRunwayText(icao) {
    var code = String(icao || '').trim().toUpperCase();
    if (!code) return '';
    try {
      var raw = typeof runwayCache !== 'undefined' && runwayCache ? runwayCache[code] : '';
      return String(raw || '').replace(/<br\s*\/?>/ig, '\n');
    } catch (_) {
      return '';
    }
  }
  function parseRunwayRows(text) {
    return String(text || '').split(/\s*(?:\n|\|)\s*/).map(line => line.trim()).filter(Boolean).slice(0, 6).map(line => {
      var parts = line.split(/\s+[–-]\s+/);
      return {
        ident: parts[0] || line,
        detail: parts.slice(1).join(' – ') || ''
      };
    });
  }
  function getAipUrlForAirport(apt) {
    if (!(apt !== null && apt !== void 0 && apt.icao) || apt.icao === 'GPS' || apt.icao === 'POI') return '';
    try {
      if (typeof getAipPopupUrl === 'function') return getAipPopupUrl(apt.icao, apt.country || '');
    } catch (_) {}
    return '';
  }
  function abortToolRequest(name) {
    var entry = toolState[name];
    if (entry !== null && entry !== void 0 && entry.controller) {
      try {
        entry.controller.abort();
      } catch (_) {}
    }
    if (entry) entry.controller = null;
  }
  function abortOtherToolRequests(activeName) {
    Object.keys(toolState).forEach(name => {
      if (name !== activeName) abortToolRequest(name);
    });
  }
  function isCacheFresh(entry, key) {
    var ttl = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : TOOL_CACHE_TTL_MS;
    return !!(entry && entry.key === key && entry.data && Date.now() - entry.updatedAt < ttl);
  }
  function fetchJson(_x, _x2) {
    return _fetchJson.apply(this, arguments);
  }
  function _fetchJson() {
    _fetchJson = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(url, signal) {
      var _window$gaChecklistHo10;
      var request, res;
      return _regenerator().w(function (_context) {
        while (1) switch (_context.n) {
          case 0:
            request = ((_window$gaChecklistHo10 = window.gaChecklistHost) === null || _window$gaChecklistHo10 === void 0 ? void 0 : _window$gaChecklistHo10.fetch) || fetch;
            _context.n = 1;
            return request(url, {
              signal,
              cache: 'no-store'
            });
          case 1:
            res = _context.v;
            if (res.ok) {
              _context.n = 2;
              break;
            }
            throw new Error(`HTTP ${res.status}`);
          case 2:
            return _context.a(2, res.json());
        }
      }, _callee);
    }));
    return _fetchJson.apply(this, arguments);
  }
  function setDrawerOpen(open) {
    if (!drawerEl) return;
    drawerEl.classList.toggle('is-open', !!open);
    if (open && typeof window.gaBringMapOverlayToFront === 'function') {
      window.gaBringMapOverlayToFront(drawerEl);
    }
    if (handleEl) handleEl.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function isDrawerOpen() {
    return !!(drawerEl && drawerEl.classList.contains('is-open'));
  }
  function isCommunityUiActive() {
    return isDrawerOpen() && (state.view === 'list' || state.view === 'manager' || state.view === 'home');
  }
  function isNetworkSleeping(label) {
    return typeof window.gaShouldPauseNetwork === 'function' && window.gaShouldPauseNetwork(label);
  }
  function acquireCommunityPollLock() {
    var force = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
    var now = Date.now();
    try {
      var current = JSON.parse(localStorage.getItem(COMMUNITY_POLL_LOCK_KEY) || 'null');
      var owner = current && typeof current.owner === 'string' ? current.owner : '';
      var expiresAt = Number(current && current.expiresAt || 0);
      var lockedByOther = owner && owner !== COMMUNITY_TAB_ID && expiresAt > now;
      if (lockedByOther && !force) return false;
      if (lockedByOther && force && !document.hasFocus()) return false;
      localStorage.setItem(COMMUNITY_POLL_LOCK_KEY, JSON.stringify({
        owner: COMMUNITY_TAB_ID,
        expiresAt: now + COMMUNITY_POLL_LOCK_TTL_MS,
        updatedAt: now
      }));
      return true;
    } catch (_) {
      return true;
    }
  }
  function render() {
    var _window$gaChecklistHo3, _window$gaChecklistHo4, _window$gaChecklistHo5;
    if (!bodyEl) return;
    if (((_window$gaChecklistHo3 = window.gaChecklistHost) === null || _window$gaChecklistHo3 === void 0 || (_window$gaChecklistHo4 = _window$gaChecklistHo3.supportsTool) === null || _window$gaChecklistHo4 === void 0 ? void 0 : _window$gaChecklistHo4.call(_window$gaChecklistHo3, state.view)) === false) {
      setTitle(state.view === 'weather' ? 'Wetter' : 'Kartenwerkzeuge');
      bodyEl.innerHTML = toolTopline(state.view) + renderToolEmpty('Diese Funktion ist im EFB noch nicht verfügbar. Niederschlagsradar ist im Layer-Menü wählbar.');
      return;
    }
    destroyPlaceMiniMaps();
    if (state.view === 'home') renderHome();else if (state.view === 'list') renderList();else if (state.view === 'manager') renderManager();else if (state.view === 'viewer') renderViewer();else if (state.view === 'editor') renderEditor();else if (state.view === 'import') renderImport();else if (state.view === 'weather') renderWeatherTool();else if (state.view === 'radio') renderRadioTool();else if (state.view === 'warnings') renderWarningsTool();else if (state.view === 'place') renderPlaceTool();else if (state.view === 'nearest') renderNearestTool();else if (state.view === 'airport-info') renderAirportInfoTool();else if (state.view === 'cargo') renderCargoTool();else if (state.view === 'mission') renderMissionTool();else renderHome();
    renderStatus();
    if ((_window$gaChecklistHo5 = window.gaChecklistHost) !== null && _window$gaChecklistHo5 !== void 0 && _window$gaChecklistHo5.supportsAction) {
      bodyEl.querySelectorAll('[data-action]').forEach(button => {
        if (window.gaChecklistHost.supportsAction(button.dataset.action) !== false) return;
        button.disabled = true;
        button.title = 'Diese Aktion ist im EFB noch nicht verfügbar.';
      });
    }
  }
  function renderHome() {
    setTitle('Kartenwerkzeuge');
    var count = visibleChecklists().length;
    var live = getLiveAircraftPosition();
    var route = getRoutePoints();
    bodyEl.innerHTML = `
            <div class="checklist-tool-grid">
                <button class="checklist-tool-tile" type="button" data-action="open-list">
                    <span class="checklist-tool-icon" aria-hidden="true">✅</span>
                    <span>
                        <span class="checklist-tool-name">Checklist</span>
                        <span class="checklist-tool-count">${count} sichtbar · ${communityMeta.length} Community</span>
                    </span>
                    <span class="checklist-tool-arrow" aria-hidden="true">›</span>
                </button>
                <button class="checklist-tool-tile mission-tool-home-tile" type="button" data-action="open-tool" data-tool="mission">
                    <span class="checklist-tool-icon" aria-hidden="true">🎯</span>
                    <span>
                        <span class="checklist-tool-name">Mission</span>
                        <span class="checklist-tool-count">${escapeHtml(missionHomeSummary())}</span>
                    </span>
                    <span class="checklist-tool-arrow" aria-hidden="true">›</span>
                </button>
                <button class="checklist-tool-tile compact" type="button" data-action="open-tool" data-tool="weather">
                    <span class="checklist-tool-icon" aria-hidden="true">🌦️</span>
                    <span>
                        <span class="checklist-tool-name">Wetter</span>
                        <span class="checklist-tool-count">${route.length >= 2 ? 'Übersicht • Route' : 'Route planen für Enroute-Wetter'}</span>
                    </span>
                    <span class="checklist-tool-arrow" aria-hidden="true">›</span>
                </button>
                <button class="checklist-tool-tile compact" type="button" data-action="open-tool" data-tool="radio">
                    <span class="checklist-tool-icon" aria-hidden="true">📻</span>
                    <span>
                        <span class="checklist-tool-name">Radio</span>
                        <span class="checklist-tool-count">${route.length >= 2 ? 'Start · Enroute · Ziel' : 'Frequenzen nach Route'}</span>
                    </span>
                    <span class="checklist-tool-arrow" aria-hidden="true">›</span>
                </button>
                <button class="checklist-tool-tile compact" type="button" data-action="open-tool" data-tool="warnings">
                    <span class="checklist-tool-icon" aria-hidden="true">⚠️</span>
                    <span>
                        <span class="checklist-tool-name">Warnungen</span>
                        <span class="checklist-tool-count">${route.length >= 2 ? `${getProblemAirspaces().length || 'Route'} · Lufträume` : 'Route planen für Lufträume'}</span>
                    </span>
                    <span class="checklist-tool-arrow" aria-hidden="true">›</span>
                </button>
                <button class="checklist-tool-tile compact" type="button" data-action="open-tool" data-tool="place">
                    <span class="checklist-tool-icon" aria-hidden="true">🛬</span>
                    <span>
                        <span class="checklist-tool-name">Platz</span>
                        <span class="checklist-tool-count">Start und Ziel · AIP Links</span>
                    </span>
                    <span class="checklist-tool-arrow" aria-hidden="true">›</span>
                </button>
                <button class="checklist-tool-tile compact" type="button" data-action="open-tool" data-tool="nearest">
                    <span class="checklist-tool-icon" aria-hidden="true">📍</span>
                    <span>
                        <span class="checklist-tool-name">Nearest</span>
                        <span class="checklist-tool-count">${live ? '50 NM um Flugzeug' : 'braucht Live-Position'}</span>
                    </span>
                    <span class="checklist-tool-arrow" aria-hidden="true">›</span>
                </button>
                <button class="checklist-tool-tile compact" type="button" data-action="open-tool" data-tool="cargo">
                    <span class="checklist-tool-icon" aria-hidden="true">LDG</span>
                    <span>
                        <span class="checklist-tool-name">Ladung</span>
                        <span class="checklist-tool-count">${cargoHomeSummary()}</span>
                    </span>
                    <span class="checklist-tool-arrow" aria-hidden="true">›</span>
                </button>
            </div>
        `;
  }
  function toolTopline(tool) {
    var label = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'Zurück';
    return `
            <div class="checklist-topline route-tool-topline">
                <button class="checklist-back-btn" type="button" data-action="home">${label}</button>
                <button class="checklist-action-btn" type="button" data-action="refresh-tool" data-tool="${escapeAttr(tool)}">Aktualisieren</button>
            </div>
        `;
  }
  function renderToolEmpty(text) {
    return `<div class="route-tool-empty">${escapeHtml(text)}</div>`;
  }
  function missionText(value) {
    var max = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 560;
    var text = String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
    return Number.isFinite(max) ? text.slice(0, Math.max(0, max)) : text;
  }
  function missionGlobalData() {
    var _md, _md2;
    var md = null;
    try {
      md = typeof currentMissionData !== 'undefined' && currentMissionData && typeof currentMissionData === 'object' ? currentMissionData : null;
    } catch (_) {}
    if (!md && window.currentMissionData && typeof window.currentMissionData === 'object') md = window.currentMissionData;
    var contract = window.activeMissionContract && typeof window.activeMissionContract === 'object' ? window.activeMissionContract : (_md = md) !== null && _md !== void 0 && _md.missionContract && typeof md.missionContract === 'object' ? md.missionContract : null;
    var passenger = window.activePassenger && typeof window.activePassenger === 'object' ? window.activePassenger : (_md2 = md) !== null && _md2 !== void 0 && _md2.passenger && typeof md.passenger === 'object' ? md.passenger : contract !== null && contract !== void 0 && contract.passenger && typeof contract.passenger === 'object' ? contract.passenger : null;
    var freeflightOnly = false;
    try {
      freeflightOnly = typeof window.missionIsFreeflightOnly === 'function' ? !!window.missionIsFreeflightOnly({
        currentMissionData: md,
        activeMissionContract: contract
      }) : false;
    } catch (_) {}
    var accepted = false;
    try {
      accepted = typeof window.isAcceptedOrActiveMissionPresent === 'function' ? !!window.isAcceptedOrActiveMissionPresent() : !!(md && md.sceneAccepted !== false);
    } catch (_) {
      accepted = !!(md && md.sceneAccepted !== false);
    }
    return {
      md,
      contract,
      passenger,
      freeflightOnly,
      accepted,
      exists: !!(md && !freeflightOnly)
    };
  }
  function missionRuntimeText(id) {
    var _document$getElementB;
    var fallback = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
    var text = missionText(((_document$getElementB = document.getElementById(id)) === null || _document$getElementB === void 0 ? void 0 : _document$getElementB.textContent) || '', 360);
    return text || fallback;
  }
  function missionPoiProgress() {
    try {
      if (typeof window.paxVoiceGetPoiMissionProgress === 'function') {
        var progress = window.paxVoiceGetPoiMissionProgress();
        return progress && typeof progress === 'object' ? progress : null;
      }
    } catch (_) {}
    return null;
  }
  function missionRuntimePhaseSnapshot() {
    try {
      if (typeof window.missionRuntimeGetPhaseSnapshot === 'function') {
        var snapshot = window.missionRuntimeGetPhaseSnapshot();
        return snapshot && typeof snapshot === 'object' ? snapshot : null;
      }
    } catch (_) {}
    return null;
  }
  function missionComfortSummary() {
    try {
      if (typeof window.paxVoiceGetComfortSummary === 'function') {
        var summary = window.paxVoiceGetComfortSummary();
        return summary && typeof summary === 'object' ? summary : null;
      }
    } catch (_) {}
    return null;
  }
  function missionCargoOutcome() {
    try {
      if (typeof window.missionCargoEvaluateOutcome === 'function') {
        var outcome = window.missionCargoEvaluateOutcome();
        return outcome && outcome.status !== 'none' ? outcome : null;
      }
    } catch (_) {}
    return null;
  }
  function missionSurveySpec(data) {
    var _data$md, _data$contract;
    try {
      var _window$missionSurvey;
      if (typeof ((_window$missionSurvey = window.missionSurveyPattern) === null || _window$missionSurvey === void 0 ? void 0 : _window$missionSurvey.getActiveSpec) === 'function') {
        var spec = window.missionSurveyPattern.getActiveSpec(data.md, data.passenger);
        if (spec && typeof spec === 'object') return spec;
      }
    } catch (_) {}
    return ((_data$md = data.md) === null || _data$md === void 0 ? void 0 : _data$md.surveyPattern) || ((_data$contract = data.contract) === null || _data$contract === void 0 ? void 0 : _data$contract.surveyPattern) || null;
  }
  function missionPoiChainSpec(data) {
    var _data$md2, _data$contract2;
    try {
      var _window$missionPoiCha;
      if (typeof ((_window$missionPoiCha = window.missionPoiChainRuntime) === null || _window$missionPoiCha === void 0 ? void 0 : _window$missionPoiCha.getActiveSpec) === 'function') {
        var spec = window.missionPoiChainRuntime.getActiveSpec(data.md, data.passenger);
        if (spec && typeof spec === 'object') return spec;
      }
    } catch (_) {}
    return ((_data$md2 = data.md) === null || _data$md2 === void 0 ? void 0 : _data$md2.poiChain) || ((_data$contract2 = data.contract) === null || _data$contract2 === void 0 ? void 0 : _data$contract2.poiChain) || null;
  }
  function missionTaskDomain(data) {
    var _data$passenger, _data$contract3, _data$md3;
    return String(((_data$passenger = data.passenger) === null || _data$passenger === void 0 ? void 0 : _data$passenger.taskDomain) || ((_data$contract3 = data.contract) === null || _data$contract3 === void 0 ? void 0 : _data$contract3.taskDomain) || ((_data$md3 = data.md) === null || _data$md3 === void 0 ? void 0 : _data$md3.taskDomain) || '').trim().toLowerCase();
  }
  function missionDomainLabel() {
    var domain = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    var labels = {
      inspection_infra: 'Infrastruktur-Inspektion',
      infra_chain_recon: 'Infrastruktur-Kette',
      mapping_survey: 'Mapping / Survey',
      search_and_rescue: 'Suche und Rettung',
      fire_watch: 'Feuerbeobachtung',
      training: 'Training',
      club_training_basic: 'Basistraining',
      club_training_advanced: 'Aufbautraining',
      sightseeing_tour: 'Sightseeing',
      news_coverage: 'Reportage',
      science_bio: 'Umweltbeobachtung',
      science_geo: 'Geländebeobachtung',
      cargo_fragile: 'Sensible Fracht',
      medical_transfer: 'Medizintransfer',
      animal_transport: 'Tiertransport',
      charter: 'Charter',
      club_utility: 'Vereinsflug'
    };
    return labels[domain] || missionText(domain.replace(/_/g, ' '), 80) || 'Flugauftrag';
  }
  function missionLiveState() {
    var _ref4, _fd$mslFt, _ref5, _fd$gsKts;
    var fd = window.lastLiveFlightData || {};
    var pos = getLiveAircraftPosition(45000);
    var mslFt = Number((_ref4 = (_fd$mslFt = fd.mslFt) !== null && _fd$mslFt !== void 0 ? _fd$mslFt : fd.altFt) !== null && _ref4 !== void 0 ? _ref4 : pos === null || pos === void 0 ? void 0 : pos.altFt);
    var aglFt = Number(fd.aglFt);
    var gsKts = Number((_ref5 = (_fd$gsKts = fd.gsKts) !== null && _fd$gsKts !== void 0 ? _fd$gsKts : fd.gs) !== null && _ref5 !== void 0 ? _ref5 : pos === null || pos === void 0 ? void 0 : pos.gs);
    var onGround = typeof fd.onGround === 'boolean' ? fd.onGround : Number.isFinite(aglFt) && Number.isFinite(gsKts) ? aglFt < 80 && gsKts < 30 : null;
    return {
      pos,
      mslFt: Number.isFinite(mslFt) ? Math.round(mslFt) : null,
      aglFt: Number.isFinite(aglFt) ? Math.round(aglFt) : null,
      gsKts: Number.isFinite(gsKts) ? Math.round(gsKts) : null,
      onGround,
      trackerLive: !!(pos && (window.liveTrackerConnected || window.simModeActive))
    };
  }
  function missionTargetNav(data, live) {
    var _ref6, _data$md$targetLat, _data$md4, _data$md5, _data$contract4, _ref7, _ref8, _data$md$targetLon, _data$md6, _data$md7, _data$md8, _data$contract5;
    var lat = Number((_ref6 = (_data$md$targetLat = (_data$md4 = data.md) === null || _data$md4 === void 0 ? void 0 : _data$md4.targetLat) !== null && _data$md$targetLat !== void 0 ? _data$md$targetLat : (_data$md5 = data.md) === null || _data$md5 === void 0 || (_data$md5 = _data$md5.bush) === null || _data$md5 === void 0 || (_data$md5 = _data$md5.targetRef) === null || _data$md5 === void 0 ? void 0 : _data$md5.lat) !== null && _ref6 !== void 0 ? _ref6 : (_data$contract4 = data.contract) === null || _data$contract4 === void 0 || (_data$contract4 = _data$contract4.bush) === null || _data$contract4 === void 0 || (_data$contract4 = _data$contract4.targetRef) === null || _data$contract4 === void 0 ? void 0 : _data$contract4.lat);
    var lon = Number((_ref7 = (_ref8 = (_data$md$targetLon = (_data$md6 = data.md) === null || _data$md6 === void 0 ? void 0 : _data$md6.targetLon) !== null && _data$md$targetLon !== void 0 ? _data$md$targetLon : (_data$md7 = data.md) === null || _data$md7 === void 0 ? void 0 : _data$md7.targetLng) !== null && _ref8 !== void 0 ? _ref8 : (_data$md8 = data.md) === null || _data$md8 === void 0 || (_data$md8 = _data$md8.bush) === null || _data$md8 === void 0 || (_data$md8 = _data$md8.targetRef) === null || _data$md8 === void 0 ? void 0 : _data$md8.lon) !== null && _ref7 !== void 0 ? _ref7 : (_data$contract5 = data.contract) === null || _data$contract5 === void 0 || (_data$contract5 = _data$contract5.bush) === null || _data$contract5 === void 0 || (_data$contract5 = _data$contract5.targetRef) === null || _data$contract5 === void 0 ? void 0 : _data$contract5.lon);
    if (!live.pos || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    var nav = navBetween(live.pos.lat, live.pos.lon, lat, lon);
    return Number.isFinite(Number(nav === null || nav === void 0 ? void 0 : nav.dist)) ? nav : null;
  }
  function missionTargetName(data) {
    var _data$md9, _data$md0, _data$md1, _data$contract6, _data$md10;
    return missionText(((_data$md9 = data.md) === null || _data$md9 === void 0 ? void 0 : _data$md9.targetName) || ((_data$md0 = data.md) === null || _data$md0 === void 0 ? void 0 : _data$md0.poiName) || ((_data$md1 = data.md) === null || _data$md1 === void 0 || (_data$md1 = _data$md1.bush) === null || _data$md1 === void 0 || (_data$md1 = _data$md1.targetRef) === null || _data$md1 === void 0 ? void 0 : _data$md1.name) || ((_data$contract6 = data.contract) === null || _data$contract6 === void 0 || (_data$contract6 = _data$contract6.bush) === null || _data$contract6 === void 0 || (_data$contract6 = _data$contract6.targetRef) === null || _data$contract6 === void 0 ? void 0 : _data$contract6.name) || ((_data$md10 = data.md) === null || _data$md10 === void 0 ? void 0 : _data$md10.dest) || 'Missionsziel', 120);
  }
  function missionFormatDuration(sec) {
    var value = Math.max(0, Math.round(Number(sec) || 0));
    var min = Math.floor(value / 60);
    var rest = value % 60;
    return `${min}:${String(rest).padStart(2, '0')}`;
  }
  function missionClampPct(value) {
    return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  }
  function missionProgressRow(label, value, detail) {
    var tone = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : '';
    var pct = missionClampPct(value);
    return `
            <div class="mission-control-progress-row">
                <div class="mission-control-progress-head">
                    <span>${escapeHtml(label)}</span>
                    <b>${escapeHtml(detail)}</b>
                </div>
                <div class="mission-control-progress-track is-${escapeAttr(tone || (pct >= 100 ? 'good' : 'active'))}">
                    <span style="width:${pct}%"></span>
                </div>
            </div>
        `;
  }
  function missionWorkProgressRows(runtimeSnapshot, progress, cargoOutcome) {
    var _runtimeSnapshot$flag;
    var rows = [];
    var runtimeMetrics = Array.isArray(runtimeSnapshot === null || runtimeSnapshot === void 0 ? void 0 : runtimeSnapshot.workProgress) ? runtimeSnapshot.workProgress : [];
    runtimeMetrics.forEach(metric => {
      var tone = metric.satisfied ? 'good' : progress !== null && progress !== void 0 && progress.aborted ? 'danger' : '';
      if (metric.kind === 'count') {
        var activeText = Number(metric.activePct || 0) > 0 && Number(metric.completed || 0) < Number(metric.total || 0) ? ` · aktueller Abschnitt ${Math.round(Number(metric.activePct))}%` : '';
        rows.push(missionProgressRow(metric.label, metric.percent, `${Math.round(Number(metric.completed || 0))} von ${Math.round(Number(metric.total || 0))} erfolgreich${activeText}`, tone));
      } else if (metric.kind === 'duration') {
        rows.push(missionProgressRow(metric.label, metric.percent, `${missionFormatDuration(metric.completedSec)} / ${missionFormatDuration(metric.requiredSec)}${metric.satisfied ? ' · erfüllt' : ''}`, tone));
      } else if (metric.kind === 'distance') {
        rows.push(missionProgressRow(metric.label, metric.percent, `${Number(metric.completedNm || 0).toFixed(1)} / ${Number(metric.requiredNm || 0).toFixed(1)} NM${metric.satisfied ? ' · erfüllt' : ''}`, tone));
      }
    });
    if ((cargoOutcome === null || cargoOutcome === void 0 ? void 0 : cargoOutcome.requiredTotal) > 0) {
      var cargoHasHardFailure = (cargoOutcome.droppedRequired || []).length > 0 || (cargoOutcome.damagedRequired || []).length > 0;
      rows.push(missionProgressRow('Pflichtmanifest', Number(cargoOutcome.requiredLoaded || 0) / Number(cargoOutcome.requiredTotal || 1) * 100, `${cargoOutcome.requiredLoaded || 0}/${cargoOutcome.requiredTotal} an Bord`, cargoHasHardFailure ? 'danger' : ''));
    }
    if (!rows.length && runtimeSnapshot !== null && runtimeSnapshot !== void 0 && (_runtimeSnapshot$flag = runtimeSnapshot.flags) !== null && _runtimeSnapshot$flag !== void 0 && _runtimeSnapshot$flag.taskSatisfied) {
      rows.push(missionProgressRow('Arbeitsauftrag', 100, 'erfolgreich abgeschlossen', 'good'));
    }
    return rows;
  }
  function missionWorkProgressData(runtimeSnapshot, progress, cargoOutcome) {
    var _runtimeSnapshot$flag2;
    var rows = [];
    var runtimeMetrics = Array.isArray(runtimeSnapshot === null || runtimeSnapshot === void 0 ? void 0 : runtimeSnapshot.workProgress) ? runtimeSnapshot.workProgress : [];
    runtimeMetrics.forEach(metric => {
      var tone = metric.satisfied ? 'good' : progress !== null && progress !== void 0 && progress.aborted ? 'danger' : '';
      if (metric.kind === 'count') {
        var activeText = Number(metric.activePct || 0) > 0 && Number(metric.completed || 0) < Number(metric.total || 0) ? ` · aktueller Abschnitt ${Math.round(Number(metric.activePct))}%` : '';
        rows.push({
          label: metric.label,
          percent: metric.percent,
          detail: `${Math.round(Number(metric.completed || 0))} von ${Math.round(Number(metric.total || 0))} erfolgreich${activeText}`,
          tone
        });
      } else if (metric.kind === 'duration') {
        rows.push({
          label: metric.label,
          percent: metric.percent,
          detail: `${missionFormatDuration(metric.completedSec)} / ${missionFormatDuration(metric.requiredSec)}${metric.satisfied ? ' · erfüllt' : ''}`,
          tone
        });
      } else if (metric.kind === 'distance') {
        rows.push({
          label: metric.label,
          percent: metric.percent,
          detail: `${Number(metric.completedNm || 0).toFixed(1)} / ${Number(metric.requiredNm || 0).toFixed(1)} NM${metric.satisfied ? ' · erfüllt' : ''}`,
          tone
        });
      }
    });
    if ((cargoOutcome === null || cargoOutcome === void 0 ? void 0 : cargoOutcome.requiredTotal) > 0) {
      var cargoHasHardFailure = (cargoOutcome.droppedRequired || []).length > 0 || (cargoOutcome.damagedRequired || []).length > 0;
      rows.push({
        label: 'Pflichtmanifest',
        percent: Number(cargoOutcome.requiredLoaded || 0) / Number(cargoOutcome.requiredTotal || 1) * 100,
        detail: `${cargoOutcome.requiredLoaded || 0}/${cargoOutcome.requiredTotal} an Bord`,
        tone: cargoHasHardFailure ? 'danger' : ''
      });
    }
    if (!rows.length && runtimeSnapshot !== null && runtimeSnapshot !== void 0 && (_runtimeSnapshot$flag2 = runtimeSnapshot.flags) !== null && _runtimeSnapshot$flag2 !== void 0 && _runtimeSnapshot$flag2.taskSatisfied) {
      rows.push({
        label: 'Arbeitsauftrag',
        percent: 100,
        detail: 'erfolgreich abgeschlossen',
        tone: 'good'
      });
    }
    return rows;
  }
  function missionCurrentTask(data, active, progress, live) {
    var _progress$surveyPatte, _progress$poiChain, _window$paxVoiceGetDe, _window;
    var runtimeNext = missionRuntimeText('missionRuntimeNextStep');
    if (runtimeNext) return runtimeNext.replace(/^Nächster Schritt:\s*/i, '');
    if (!data.accepted) return 'Mission im Briefing annehmen';
    if (!active) return 'Mission vorbereiten und starten';
    if (progress !== null && progress !== void 0 && progress.aborted) return 'Sicher landen und Mission mit Abweichung abschließen';
    if (progress !== null && progress !== void 0 && progress.satisfied) return 'Zum vorgesehenen Landeplatz zurückkehren und landen';
    if (progress !== null && progress !== void 0 && (_progress$surveyPatte = progress.surveyPattern) !== null && _progress$surveyPatte !== void 0 && _progress$surveyPatte.startedAt) return 'Offenen Mapping-Sektor im Höhenband sauber abfliegen';
    if (progress !== null && progress !== void 0 && (_progress$poiChain = progress.poiChain) !== null && _progress$poiChain !== void 0 && _progress$poiChain.startedAt) return 'Nächsten markierten Inspektionspunkt anfliegen';
    if (progress !== null && progress !== void 0 && progress.hasSignal && (_window$paxVoiceGetDe = (_window = window).paxVoiceGetDebugState) !== null && _window$paxVoiceGetDe !== void 0 && _window$paxVoiceGetDe.call(_window).poiInRadius) return 'Arbeitsprofil im Zielgebiet halten';
    var target = missionTargetName(data);
    if (live.onGround === true) return `Startfreigabe herstellen und nach ${target} abfliegen`;
    return `${target} anfliegen`;
  }
  function missionPhaseModel(runtimeSnapshot, active) {
    if (runtimeSnapshot && Array.isArray(runtimeSnapshot.stages) && runtimeSnapshot.stages.length) {
      return {
        stages: runtimeSnapshot.stages.map(stage => String((stage === null || stage === void 0 ? void 0 : stage.label) || (stage === null || stage === void 0 ? void 0 : stage.id) || 'Phase')),
        current: Math.max(0, Math.min(runtimeSnapshot.stages.length - 1, Number(runtimeSnapshot.currentIndex || 0)))
      };
    }
    return {
      stages: ['Vorbereitung', 'Reiseflug', 'Ankunft', 'Abschluss'],
      current: active ? 1 : 0
    };
  }
  function missionRequirementRows(data, runtimeSnapshot, progress, surveySpec, chainSpec, live, targetNav, cargoOutcome) {
    var _data$md11, _data$md12, _data$md13, _data$md14, _data$md15, _data$md16, _data$contract7, _data$passenger2, _data$passenger3, _data$passenger4, _data$md17, _data$md18, _data$passenger5;
    var rows = [];
    var target = missionTargetName(data);
    var domain = missionTaskDomain(data);
    var start = missionText(((_data$md11 = data.md) === null || _data$md11 === void 0 ? void 0 : _data$md11.start) || '', 12);
    var dest = missionText(((_data$md12 = data.md) === null || _data$md12 === void 0 ? void 0 : _data$md12.dest) || '', 12);
    var isPoi = !!((_data$md13 = data.md) !== null && _data$md13 !== void 0 && _data$md13.isPOI || (_data$md14 = data.md) !== null && _data$md14 !== void 0 && _data$md14.poiName || (_data$md15 = data.md) !== null && _data$md15 !== void 0 && _data$md15.poiPresentation);
    var requiresReturn = runtimeSnapshot ? !!runtimeSnapshot.requiresReturnHome : !!((_data$md16 = data.md) !== null && _data$md16 !== void 0 && (_data$md16 = _data$md16.bush) !== null && _data$md16 !== void 0 && _data$md16.requiresReturnHome || (_data$contract7 = data.contract) !== null && _data$contract7 !== void 0 && (_data$contract7 = _data$contract7.bush) !== null && _data$contract7 !== void 0 && _data$contract7.requiresReturnHome);
    var altitude = Math.max(0, Number((surveySpec === null || surveySpec === void 0 ? void 0 : surveySpec.targetAltFt) || ((_data$passenger2 = data.passenger) === null || _data$passenger2 === void 0 ? void 0 : _data$passenger2.targetAltFt) || 0));
    var altitudeTolerance = Math.max(0, Number((surveySpec === null || surveySpec === void 0 ? void 0 : surveySpec.altitudeToleranceFt) || 0));
    var radius = Math.max(0, Number(((_data$passenger3 = data.passenger) === null || _data$passenger3 === void 0 ? void 0 : _data$passenger3.targetRadiusNm) || 0));
    var dwellMin = Math.max(0, Number(((_data$passenger4 = data.passenger) === null || _data$passenger4 === void 0 ? void 0 : _data$passenger4.targetDwellMin) || 0));
    var add = function add(label, value) {
      var state = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';
      return rows.push({
        label,
        value,
        state
      });
    };
    add('Auftrag', `${missionDomainLabel(domain)} · ${target}`);
    if (start || dest) {
      var routeLabels = isPoi ? [start, target, requiresReturn ? start : ''] : [start, dest || target, requiresReturn && start !== (dest || target) ? start : ''];
      add('Route', routeLabels.filter(Boolean).join(' → '));
    }
    if (radius > 0) {
      var within = Number.isFinite(Number(targetNav === null || targetNav === void 0 ? void 0 : targetNav.dist)) && Number(targetNav.dist) <= radius;
      add('Arbeitsbereich', `Radius ${radius.toFixed(1)} NM${Number.isFinite(Number(targetNav === null || targetNav === void 0 ? void 0 : targetNav.dist)) ? ` · aktuell ${Number(targetNav.dist).toFixed(1)} NM` : ''}`, within ? 'good' : '');
    }
    if (altitude > 0) {
      var deviation = live.mslFt !== null ? live.mslFt - altitude : null;
      var _within = deviation !== null && (altitudeTolerance > 0 ? Math.abs(deviation) <= altitudeTolerance : Math.abs(deviation) <= 150);
      var band = altitudeTolerance > 0 ? ` ±${Math.round(altitudeTolerance)} ft` : '';
      add('Arbeitshöhe', `${Math.round(altitude)} ft MSL${band}${deviation !== null ? ` · ${Math.abs(deviation) <= 50 ? 'im Soll' : `${Math.abs(Math.round(deviation))} ft ${deviation > 0 ? 'zu hoch' : 'zu niedrig'}`}` : ''}`, _within ? 'good' : deviation !== null ? 'warn' : '');
    }
    if (dwellMin > 0 && !surveySpec && !chainSpec) add('Verweilzeit', `${dwellMin} Min. laut Briefing${progress !== null && progress !== void 0 && progress.dwellSec ? ` · ${missionFormatDuration(progress.dwellSec)} erfasst` : ''}`);
    if (surveySpec) {
      var _surveySpec$orbit, _surveySpec$scan, _surveySpec$scan2, _progress$surveyPatte2;
      var surveyLabel = String(surveySpec.type || '').toLowerCase() === 'orbit' ? `${Math.max(1, Number(((_surveySpec$orbit = surveySpec.orbit) === null || _surveySpec$orbit === void 0 ? void 0 : _surveySpec$orbit.requiredTurns) || 3))} vollständige Orbits` : `${Array.isArray((_surveySpec$scan = surveySpec.scan) === null || _surveySpec$scan === void 0 ? void 0 : _surveySpec$scan.lines) ? surveySpec.scan.lines.length : Math.max(1, Number(((_surveySpec$scan2 = surveySpec.scan) === null || _surveySpec$scan2 === void 0 ? void 0 : _surveySpec$scan2.lineCount) || 1))} Mapping-Linien`;
      add('Aufnahmemuster', surveyLabel, progress !== null && progress !== void 0 && (_progress$surveyPatte2 = progress.surveyPattern) !== null && _progress$surveyPatte2 !== void 0 && _progress$surveyPatte2.satisfied ? 'good' : '');
    }
    if (chainSpec) {
      var _progress$poiChain2;
      var total = Array.isArray(chainSpec.points) ? chainSpec.points.filter(point => (point === null || point === void 0 ? void 0 : point.required) !== false).length : 0;
      if (total) add('Inspektionskette', `${total} Pflichtpunkte`, progress !== null && progress !== void 0 && (_progress$poiChain2 = progress.poiChain) !== null && _progress$poiChain2 !== void 0 && _progress$poiChain2.satisfied ? 'good' : '');
    }
    if ((cargoOutcome === null || cargoOutcome === void 0 ? void 0 : cargoOutcome.requiredTotal) > 0) {
      var _cargoOutcome$conditi;
      var cargoHasHardFailure = (cargoOutcome.droppedRequired || []).length > 0 || (cargoOutcome.damagedRequired || []).length > 0;
      var cargoState = cargoHasHardFailure ? 'danger' : Number(cargoOutcome.requiredLoaded || 0) < Number(cargoOutcome.requiredTotal || 0) ? 'warn' : 'good';
      add('Pflichtladung', `${cargoOutcome.requiredLoaded || 0}/${cargoOutcome.requiredTotal} an Bord · Zustand ${(_cargoOutcome$conditi = cargoOutcome.conditionPct) !== null && _cargoOutcome$conditi !== void 0 ? _cargoOutcome$conditi : 100}%`, cargoState);
    }
    var temporal = ((_data$md17 = data.md) === null || _data$md17 === void 0 ? void 0 : _data$md17.missionTemporalContext) || ((_data$md18 = data.md) === null || _data$md18 === void 0 || (_data$md18 = _data$md18.followUpProspect) === null || _data$md18 === void 0 ? void 0 : _data$md18.temporalContext) || ((_data$passenger5 = data.passenger) === null || _data$passenger5 === void 0 ? void 0 : _data$passenger5.missionTemporalContext);
    var stayText = missionText((temporal === null || temporal === void 0 ? void 0 : temporal.stayText) || '', 100);
    if (stayText) add('Zeitkontext', stayText);
    return rows;
  }
  function missionFeedbackItems(data, progress, comfort, cargoOutcome, live, targetNav, surveySpec, active) {
    var _data$passenger6, _data$passenger7;
    var items = [];
    var altitude = Math.max(0, Number((surveySpec === null || surveySpec === void 0 ? void 0 : surveySpec.targetAltFt) || ((_data$passenger6 = data.passenger) === null || _data$passenger6 === void 0 ? void 0 : _data$passenger6.targetAltFt) || 0));
    var tolerance = Math.max(150, Number((surveySpec === null || surveySpec === void 0 ? void 0 : surveySpec.altitudeToleranceFt) || 300));
    var radius = Math.max(0, Number(((_data$passenger7 = data.passenger) === null || _data$passenger7 === void 0 ? void 0 : _data$passenger7.targetRadiusNm) || 0));
    var inWorkArea = radius > 0 && Number.isFinite(Number(targetNav === null || targetNav === void 0 ? void 0 : targetNav.dist)) && Number(targetNav.dist) <= radius;
    if (progress !== null && progress !== void 0 && progress.aborted) items.push({
      tone: 'danger',
      text: 'Der Arbeitsauftrag wurde als fehlgeschlagen markiert. Sicher landen; das Debriefing erklärt die Abweichung.'
    });
    if (inWorkArea && altitude > 0 && live.mslFt !== null && Math.abs(live.mslFt - altitude) > tolerance) {
      var diff = live.mslFt - altitude;
      items.push({
        tone: 'warn',
        text: `Die Arbeitshöhe passt noch nicht: ${Math.abs(Math.round(diff))} ft ${diff > 0 ? 'zu hoch' : 'zu niedrig'}. In dieser Lage zählt die Arbeitszeit nicht zuverlässig weiter.`
      });
    }
    if (Number((progress === null || progress === void 0 ? void 0 : progress.attempts) || 0) > 0) {
      items.push({
        tone: 'warn',
        text: `${Math.round(Number(progress.attempts))} Missionshinweis${Number(progress.attempts) === 1 ? '' : 'e'} wurden bereits ausgelöst. Profil jetzt stabilisieren.`
      });
    }
    var cargoProblems = [].concat(_toConsumableArray((cargoOutcome === null || cargoOutcome === void 0 ? void 0 : cargoOutcome.droppedRequired) || []), _toConsumableArray((cargoOutcome === null || cargoOutcome === void 0 ? void 0 : cargoOutcome.damagedRequired) || [])).filter(Boolean);
    if (cargoProblems.length) items.push({
      tone: 'danger',
      text: `Pflichtladung kritisch: ${cargoProblems.join(', ')}.`
    });else if (((cargoOutcome === null || cargoOutcome === void 0 ? void 0 : cargoOutcome.missingRequired) || []).length) {
      var missing = (cargoOutcome.missingRequired || []).filter(Boolean);
      items.push({
        tone: active ? 'danger' : 'warn',
        text: `${active ? 'Pflichtladung fehlt an Bord' : 'Vor dem Start noch laden'}: ${missing.join(', ')}.`
      });
    } else if (cargoOutcome && Number(cargoOutcome.conditionPct) < 75) items.push({
      tone: 'warn',
      text: `Die Ladung hat Belastung abbekommen und liegt nur noch bei ${Math.round(Number(cargoOutcome.conditionPct))}%. Ruhiger weiterfliegen.`
    });
    if (comfort && Number(comfort.pilotSevere || 0) > 0) {
      items.push({
        tone: 'danger',
        text: `${comfort.pilotSevere} harte${Number(comfort.pilotSevere) === 1 ? 's' : ''} Flugereignis${Number(comfort.pilotSevere) === 1 ? '' : 'se'} hat den Pax-Komfort deutlich belastet.`
      });
    } else if (comfort && Number(comfort.pilotEvents || 0) > 0) {
      items.push({
        tone: 'warn',
        text: `Der Passagier hat ${comfort.pilotEvents} auffällige Flugbewegung${Number(comfort.pilotEvents) === 1 ? '' : 'en'} registriert. Ruhige Kurven und Sinkraten helfen.`
      });
    }
    if (comfort && Number(comfort.weatherEvents || 0) > 0) {
      items.push({
        tone: 'info',
        text: `Das Wetter war spürbar (${comfort.weatherEvents} Ereignis${Number(comfort.weatherEvents) === 1 ? '' : 'se'}), wird aber nicht als Pilotenfehler gewertet.`
      });
    }
    if (!items.length) items.push({
      tone: 'good',
      text: 'Der Auftrag läuft sauber. Keine kritische Abweichung erkannt.'
    });
    return items.slice(0, 4);
  }
  function missionHomeSummary() {
    var _window$gaChecklistHo6;
    if ((_window$gaChecklistHo6 = window.gaChecklistHost) !== null && _window$gaChecklistHo6 !== void 0 && _window$gaChecklistHo6.missionSummary) return window.gaChecklistHost.missionSummary();
    var data = missionGlobalData();
    if (!data.exists) return 'Keine aktive Mission';
    var runtimeSnapshot = missionRuntimePhaseSnapshot();
    var active = runtimeSnapshot ? !!runtimeSnapshot.active : typeof window.missionRuntimeIsActive === 'function' && window.missionRuntimeIsActive();
    var next = missionRuntimeText('missionRuntimeNextStep');
    if (next) return next.replace(/^Nächster Schritt:\s*/i, '').slice(0, 88);
    if (!data.accepted) return 'Entwurf · im Briefing annehmen';
    return active ? `${missionDomainLabel(missionTaskDomain(data))} läuft` : 'Mission liegt bereit';
  }
  function renderMissionTool() {
    var _window$gaChecklistHo7, _window$gaTrackerExec, _window$GAMissionCont, _data$md19, _data$md20, _data$md21, _data$md22, _data$md23, _data$md24, _data$contract8, _cargoOutcome$conditi2, _data$passenger8;
    setTitle('Mission Control');
    var data = missionGlobalData();
    if ((_window$gaChecklistHo7 = window.gaChecklistHost) !== null && _window$gaChecklistHo7 !== void 0 && _window$gaChecklistHo7.missionView && window.GAMissionControlUiCore) {
      var view = window.gaChecklistHost.missionView();
      if (view) {
        var _window$gaMissionCont, _window$gaMissionCont2;
        bodyEl.innerHTML = toolTopline('mission') + window.GAMissionControlUiCore.render(view, {
          storyExpanded: state.missionStoryExpanded,
          control: window.gaTrackerExecutionControl,
          intentPending: window.gaMissionControlIntentPending === true,
          intentStatus: ((_window$gaMissionCont = window.gaMissionControlIntentStatus) === null || _window$gaMissionCont === void 0 ? void 0 : _window$gaMissionCont.text) || '',
          intentTone: ((_window$gaMissionCont2 = window.gaMissionControlIntentStatus) === null || _window$gaMissionCont2 === void 0 ? void 0 : _window$gaMissionCont2.tone) || ''
        });
        return;
      }
    }
    if (!data.exists) {
      bodyEl.innerHTML = `
                ${toolTopline('mission')}
                <div class="mission-control-empty">
                    <span aria-hidden="true">🎯</span>
                    <b>Keine aktive Mission</b>
                    <p>Nach dem Annehmen eines Auftrags erscheinen hier Aufgabe, Bedingungen, Live-Fortschritt, Pax-Stimmung und Ladungszustand.</p>
                </div>
            `;
      return;
    }
    var sharedView = typeof window.gaGetEfbMissionViewSnapshot === 'function' ? window.gaGetEfbMissionViewSnapshot() : null;
    if (sharedView && ((_window$gaTrackerExec = window.gaTrackerExecutionControl) === null || _window$gaTrackerExec === void 0 ? void 0 : _window$gaTrackerExec.executionAuthority) === 'tracker' && typeof ((_window$GAMissionCont = window.GAMissionControlUiCore) === null || _window$GAMissionCont === void 0 ? void 0 : _window$GAMissionCont.render) === 'function') {
      var _window$gaMissionCont3, _window$gaMissionCont4;
      bodyEl.innerHTML = `${toolTopline('mission')}${window.GAMissionControlUiCore.render(sharedView, {
        storyExpanded: state.missionStoryExpanded,
        control: window.gaTrackerExecutionControl || null,
        intentPending: window.gaMissionControlIntentPending === true,
        intentStatus: ((_window$gaMissionCont3 = window.gaMissionControlIntentStatus) === null || _window$gaMissionCont3 === void 0 ? void 0 : _window$gaMissionCont3.text) || '',
        intentTone: ((_window$gaMissionCont4 = window.gaMissionControlIntentStatus) === null || _window$gaMissionCont4 === void 0 ? void 0 : _window$gaMissionCont4.tone) || ''
      })}`;
      return;
    }
    var runtimeSnapshot = missionRuntimePhaseSnapshot();
    var active = runtimeSnapshot ? !!runtimeSnapshot.active : typeof window.missionRuntimeIsActive === 'function' && window.missionRuntimeIsActive();
    var progress = missionPoiProgress();
    var comfort = missionComfortSummary();
    var cargoOutcome = missionCargoOutcome();
    var live = missionLiveState();
    var targetNav = missionTargetNav(data, live);
    var surveySpec = missionSurveySpec(data);
    var chainSpec = missionPoiChainSpec(data);
    var title = missionText(((_data$md19 = data.md) === null || _data$md19 === void 0 ? void 0 : _data$md19.missionTitle) || ((_data$md20 = data.md) === null || _data$md20 === void 0 ? void 0 : _data$md20.mission) || ((_data$md21 = data.md) === null || _data$md21 === void 0 ? void 0 : _data$md21.title) || 'Aktive Mission', 150);
    var story = missionText(((_data$md22 = data.md) === null || _data$md22 === void 0 ? void 0 : _data$md22.missionStory) || ((_data$md23 = data.md) === null || _data$md23 === void 0 ? void 0 : _data$md23.story) || ((_data$md24 = data.md) === null || _data$md24 === void 0 ? void 0 : _data$md24.s) || ((_data$contract8 = data.contract) === null || _data$contract8 === void 0 ? void 0 : _data$contract8.summary) || '', Infinity);
    var runtimeStatus = missionRuntimeText('missionRuntimeStatus', active ? 'Mission aktiv' : data.accepted ? 'Mission liegt bereit' : 'Missionsentwurf');
    var runtimeDetail = missionRuntimeText('missionRuntimeDetail', data.accepted ? 'Missionsdaten geladen.' : 'Mission muss noch angenommen werden.');
    var storyText = story || runtimeDetail;
    var storyExpandable = storyText.length > 160;
    var currentTask = (runtimeSnapshot === null || runtimeSnapshot === void 0 ? void 0 : runtimeSnapshot.nextStep) || missionCurrentTask(data, active, progress, live);
    var phase = missionPhaseModel(runtimeSnapshot, active);
    var progressRows = missionWorkProgressRows(runtimeSnapshot, progress, cargoOutcome);
    var requirements = missionRequirementRows(data, runtimeSnapshot, progress, surveySpec, chainSpec, live, targetNav, cargoOutcome);
    var feedback = missionFeedbackItems(data, progress, comfort, cargoOutcome, live, targetNav, surveySpec, active);
    var cargoHasHardFailure = ((cargoOutcome === null || cargoOutcome === void 0 ? void 0 : cargoOutcome.droppedRequired) || []).length > 0 || ((cargoOutcome === null || cargoOutcome === void 0 ? void 0 : cargoOutcome.damagedRequired) || []).length > 0;
    var taskTone = progress !== null && progress !== void 0 && progress.aborted || active && cargoHasHardFailure ? 'danger' : progress !== null && progress !== void 0 && progress.satisfied ? 'good' : 'active';
    var targetLine = Number.isFinite(Number(targetNav === null || targetNav === void 0 ? void 0 : targetNav.dist)) ? `${Number(targetNav.dist).toFixed(1)} NM · ${String(Math.round(Number(targetNav.brng) || 0)).padStart(3, '0')}°` : live.trackerLive ? 'Zielposition offen' : 'Tracker wartet';
    var altitudeLine = live.mslFt !== null ? `${live.mslFt.toLocaleString('de-DE')} ft MSL` : 'Keine Live-Höhe';
    var comfortScore = comfort ? missionClampPct(comfort.comfortScore) : null;
    var comfortTone = comfortScore === null ? 'muted' : comfortScore >= 72 ? 'good' : comfortScore >= 55 ? 'warn' : 'danger';
    var cargoCondition = cargoOutcome ? missionClampPct((_cargoOutcome$conditi2 = cargoOutcome.conditionPct) !== null && _cargoOutcome$conditi2 !== void 0 ? _cargoOutcome$conditi2 : 100) : null;
    var cargoTone = cargoCondition === null ? 'muted' : cargoHasHardFailure || cargoCondition <= 35 ? 'danger' : Number((cargoOutcome === null || cargoOutcome === void 0 ? void 0 : cargoOutcome.requiredLoaded) || 0) < Number((cargoOutcome === null || cargoOutcome === void 0 ? void 0 : cargoOutcome.requiredTotal) || 0) || cargoCondition < 75 ? 'warn' : 'good';
    var phaseHtml = phase.stages.map((label, index) => `
            <div class="mission-control-phase ${index < phase.current ? 'is-done' : ''} ${index === phase.current ? 'is-current' : ''}">
                <span>${index < phase.current ? '✓' : index + 1}</span>
                <b>${escapeHtml(label)}</b>
            </div>
        `).join('');
    var requirementHtml = requirements.map(row => `
            <div class="mission-control-requirement is-${escapeAttr(row.state || 'neutral')}">
                <span>${escapeHtml(row.label)}</span>
                <b>${escapeHtml(row.value)}</b>
            </div>
        `).join('');
    var feedbackHtml = feedback.map(item => `
            <div class="mission-control-feedback is-${escapeAttr(item.tone)}">
                <span aria-hidden="true">${item.tone === 'danger' ? '!' : item.tone === 'warn' ? '△' : item.tone === 'good' ? '✓' : 'i'}</span>
                <p>${escapeHtml(item.text)}</p>
            </div>
        `).join('');
    bodyEl.innerHTML = `
            ${toolTopline('mission')}
            <section class="mission-control-hero is-${escapeAttr(taskTone)}">
                <div class="mission-control-hero-top">
                    <span class="mission-control-live ${live.trackerLive ? 'is-live' : ''}">${live.trackerLive ? '● LIVE' : '○ STANDBY'}</span>
                    <span>${escapeHtml(runtimeStatus)}</span>
                </div>
                <h3>${escapeHtml(title)}</h3>
                <div class="mission-control-story ${storyExpandable ? state.missionStoryExpanded ? 'is-expanded' : 'is-collapsed' : 'is-static'}">
                    <p id="missionControlStory">${escapeHtml(storyText)}</p>
                    ${storyExpandable ? `
                        <button class="mission-control-story-toggle" type="button" data-action="toggle-mission-story" aria-controls="missionControlStory" aria-expanded="${state.missionStoryExpanded ? 'true' : 'false'}">
                            <span>${state.missionStoryExpanded ? 'Missionstext einklappen' : 'Gesamten Missionstext lesen'}</span>
                            <b aria-hidden="true">${state.missionStoryExpanded ? '⌃' : '⌄'}</b>
                        </button>
                    ` : ''}
                </div>
            </section>
            <section class="mission-control-order is-${escapeAttr(taskTone)}">
                <div class="mission-control-section-kicker">AKTUELLER AUFTRAG</div>
                <div class="mission-control-order-text">${escapeHtml(currentTask)}</div>
                <div class="mission-control-order-detail">${escapeHtml(runtimeDetail)}</div>
            </section>
            <section class="mission-control-card">
                <div class="mission-control-section-kicker">MISSIONSVERLAUF</div>
                <div class="mission-control-phase-rail">${phaseHtml}</div>
            </section>
            <div class="mission-control-metrics">
                <div class="mission-control-metric">
                    <span>ZIEL</span>
                    <b>${escapeHtml(targetLine)}</b>
                    <small>${escapeHtml(missionTargetName(data))}</small>
                </div>
                <div class="mission-control-metric">
                    <span>FLUGHÖHE</span>
                    <b>${escapeHtml(altitudeLine)}</b>
                    <small>${live.aglFt !== null ? `${live.aglFt.toLocaleString('de-DE')} ft AGL` : live.gsKts !== null ? `${live.gsKts} kt GS` : 'Live-Daten offen'}</small>
                </div>
            </div>
            ${progressRows.length ? `
                <section class="mission-control-card">
                    <div class="mission-control-section-kicker">LIVE-FORTSCHRITT</div>
                    ${progressRows.join('')}
                </section>
            ` : ''}
            <section class="mission-control-card">
                <div class="mission-control-section-kicker">BEDINGUNGEN</div>
                <div class="mission-control-requirements">${requirementHtml}</div>
            </section>
            <div class="mission-control-condition-grid">
                <section class="mission-control-condition is-${escapeAttr(comfortTone)}">
                    <span>PAX-STIMMUNG</span>
                    <strong>${comfortScore === null ? '—' : `${comfortScore}%`}</strong>
                    <b>${escapeHtml((comfort === null || comfort === void 0 ? void 0 : comfort.mood) || (data.passenger ? 'Noch ohne Wertung' : 'Kein Pax an Bord'))}</b>
                    <small>${comfort ? `${comfort.pilotEvents || 0} Pilot · ${comfort.weatherEvents || 0} Wetter` : ((_data$passenger8 = data.passenger) === null || _data$passenger8 === void 0 ? void 0 : _data$passenger8.role) || 'Unbegleiteter Auftrag'}</small>
                </section>
                <section class="mission-control-condition is-${escapeAttr(cargoTone)}">
                    <span>LADUNGSZUSTAND</span>
                    <strong>${cargoCondition === null ? '—' : `${cargoCondition}%`}</strong>
                    <b>${cargoOutcome ? cargoHasHardFailure ? 'kritisch' : Number(cargoOutcome.requiredLoaded || 0) < Number(cargoOutcome.requiredTotal || 0) ? 'noch offen' : 'gesichert' : 'Keine Ladung'}</b>
                    <small>${cargoOutcome ? `${cargoOutcome.loadedWeightLbs || 0}/${cargoOutcome.totalWeightLbs || 0} lbs erfasst` : cargoHomeSummary()}</small>
                </section>
            </div>
            <section class="mission-control-card">
                <div class="mission-control-section-kicker">LAGEBERICHT</div>
                <div class="mission-control-feedback-list">${feedbackHtml}</div>
            </section>
            <div class="mission-control-updated">Stand ${new Date().toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })} · aktualisiert sich automatisch</div>
        `;
  }
  window.gaGetEfbMissionViewSnapshot = function () {
    var _data$md25, _data$md26, _data$md27, _data$md28, _data$md29, _data$md30, _data$contract9, _cargoOutcome$conditi3, _data$md31, _data$md32, _data$passenger9;
    var data = missionGlobalData();
    if (!data.exists) return null;
    var runtimeSnapshot = missionRuntimePhaseSnapshot();
    var active = runtimeSnapshot ? !!runtimeSnapshot.active : typeof window.missionRuntimeIsActive === 'function' && window.missionRuntimeIsActive();
    var progress = missionPoiProgress();
    var comfort = missionComfortSummary();
    var cargoOutcome = missionCargoOutcome();
    var live = missionLiveState();
    var targetNav = missionTargetNav(data, live);
    var surveySpec = missionSurveySpec(data);
    var chainSpec = missionPoiChainSpec(data);
    var title = missionText(((_data$md25 = data.md) === null || _data$md25 === void 0 ? void 0 : _data$md25.missionTitle) || ((_data$md26 = data.md) === null || _data$md26 === void 0 ? void 0 : _data$md26.mission) || ((_data$md27 = data.md) === null || _data$md27 === void 0 ? void 0 : _data$md27.title) || 'Aktive Mission', 150);
    var story = missionText(((_data$md28 = data.md) === null || _data$md28 === void 0 ? void 0 : _data$md28.missionStory) || ((_data$md29 = data.md) === null || _data$md29 === void 0 ? void 0 : _data$md29.story) || ((_data$md30 = data.md) === null || _data$md30 === void 0 ? void 0 : _data$md30.s) || ((_data$contract9 = data.contract) === null || _data$contract9 === void 0 ? void 0 : _data$contract9.summary) || '', Infinity);
    var runtimeStatus = missionRuntimeText('missionRuntimeStatus', active ? 'Mission aktiv' : data.accepted ? 'Mission liegt bereit' : 'Missionsentwurf');
    var runtimeDetail = missionRuntimeText('missionRuntimeDetail', data.accepted ? 'Missionsdaten geladen.' : 'Mission muss noch angenommen werden.');
    var currentTask = (runtimeSnapshot === null || runtimeSnapshot === void 0 ? void 0 : runtimeSnapshot.nextStep) || missionCurrentTask(data, active, progress, live);
    var phase = missionPhaseModel(runtimeSnapshot, active);
    var requirements = missionRequirementRows(data, runtimeSnapshot, progress, surveySpec, chainSpec, live, targetNav, cargoOutcome);
    var feedback = missionFeedbackItems(data, progress, comfort, cargoOutcome, live, targetNav, surveySpec, active);
    var cargoHasHardFailure = ((cargoOutcome === null || cargoOutcome === void 0 ? void 0 : cargoOutcome.droppedRequired) || []).length > 0 || ((cargoOutcome === null || cargoOutcome === void 0 ? void 0 : cargoOutcome.damagedRequired) || []).length > 0;
    var taskTone = progress !== null && progress !== void 0 && progress.aborted || active && cargoHasHardFailure ? 'danger' : progress !== null && progress !== void 0 && progress.satisfied ? 'good' : 'active';
    var comfortScore = comfort ? missionClampPct(comfort.comfortScore) : null;
    var comfortTone = comfortScore === null ? 'muted' : comfortScore >= 72 ? 'good' : comfortScore >= 55 ? 'warn' : 'danger';
    var cargoCondition = cargoOutcome ? missionClampPct((_cargoOutcome$conditi3 = cargoOutcome.conditionPct) !== null && _cargoOutcome$conditi3 !== void 0 ? _cargoOutcome$conditi3 : 100) : null;
    var cargoTone = cargoCondition === null ? 'muted' : cargoHasHardFailure || cargoCondition <= 35 ? 'danger' : Number((cargoOutcome === null || cargoOutcome === void 0 ? void 0 : cargoOutcome.requiredLoaded) || 0) < Number((cargoOutcome === null || cargoOutcome === void 0 ? void 0 : cargoOutcome.requiredTotal) || 0) || cargoCondition < 75 ? 'warn' : 'good';
    var domain = missionTaskDomain(data);
    var route = [missionText(((_data$md31 = data.md) === null || _data$md31 === void 0 ? void 0 : _data$md31.start) || '', 12), missionText(((_data$md32 = data.md) === null || _data$md32 === void 0 ? void 0 : _data$md32.dest) || '', 12)].filter(Boolean).join(' -> ');
    return {
      schema: 'ga.efb-mission-view.v1',
      version: 1,
      capturedAt: Date.now(),
      title,
      story,
      status: runtimeStatus,
      detail: runtimeDetail,
      currentTask,
      taskTone,
      active,
      domain,
      domainLabel: missionDomainLabel(domain),
      phase: {
        current: phase.current,
        stages: phase.stages.map((label, index) => ({
          id: `phase-${index + 1}`,
          label
        }))
      },
      target: {
        name: missionTargetName(data),
        distanceNm: Number.isFinite(Number(targetNav === null || targetNav === void 0 ? void 0 : targetNav.dist)) ? Number(targetNav.dist) : null,
        bearingDeg: Number.isFinite(Number(targetNav === null || targetNav === void 0 ? void 0 : targetNav.brng)) ? Number(targetNav.brng) : null,
        route
      },
      flight: live,
      progress: missionWorkProgressData(runtimeSnapshot, progress, cargoOutcome),
      requirements,
      feedback,
      comfort: {
        available: !!comfort,
        score: comfortScore,
        tone: comfortTone,
        state: (comfort === null || comfort === void 0 ? void 0 : comfort.mood) || (data.passenger ? 'Noch ohne Wertung' : 'Kein Pax an Bord'),
        detail: comfort ? `${comfort.pilotEvents || 0} Pilot · ${comfort.weatherEvents || 0} Wetter` : ((_data$passenger9 = data.passenger) === null || _data$passenger9 === void 0 ? void 0 : _data$passenger9.role) || 'Unbegleiteter Auftrag'
      },
      cargo: {
        available: !!cargoOutcome,
        conditionPct: cargoCondition,
        tone: cargoTone,
        state: cargoOutcome ? cargoHasHardFailure ? 'kritisch' : Number(cargoOutcome.requiredLoaded || 0) < Number(cargoOutcome.requiredTotal || 0) ? 'noch offen' : 'gesichert' : 'Keine Ladung',
        detail: cargoOutcome ? `${cargoOutcome.loadedWeightLbs || 0}/${cargoOutcome.totalWeightLbs || 0} lbs erfasst` : cargoHomeSummary(),
        requiredLoaded: Number((cargoOutcome === null || cargoOutcome === void 0 ? void 0 : cargoOutcome.requiredLoaded) || 0),
        requiredTotal: Number((cargoOutcome === null || cargoOutcome === void 0 ? void 0 : cargoOutcome.requiredTotal) || 0)
      }
    };
  };
  function cargoManifestSnapshot() {
    try {
      if (typeof window.missionCargoGetManifestSnapshot === 'function') return window.missionCargoGetManifestSnapshot();
    } catch (_) {}
    try {
      var _window$activeMission;
      var md = typeof currentMissionData !== 'undefined' && currentMissionData ? currentMissionData : null;
      return (md === null || md === void 0 ? void 0 : md.cargoManifest) || ((_window$activeMission = window.activeMissionContract) === null || _window$activeMission === void 0 ? void 0 : _window$activeMission.cargoManifest) || null;
    } catch (_) {
      return null;
    }
  }
  function cargoItems() {
    var manifest = cargoManifestSnapshot();
    return Array.isArray(manifest === null || manifest === void 0 ? void 0 : manifest.items) ? manifest.items : [];
  }
  function cargoHomeSummary() {
    var items = cargoItems();
    if (!items.length) return 'Keine aktive Missionsladung';
    var loaded = items.filter(item => item.status === 'loaded').length;
    var open = items.filter(item => item.status === 'pending').length;
    var dropped = items.filter(item => item.status === 'dropped').length;
    return `${loaded} geladen · ${open} offen${dropped ? ` · ${dropped} abgeworfen` : ''}`;
  }
  function cargoPayloadSnapshot() {
    var _window$aircraftPaylo;
    var snap = (_window$aircraftPaylo = window.aircraftPayloadStatus) === null || _window$aircraftPaylo === void 0 ? void 0 : _window$aircraftPaylo.snapshot;
    if (snap && typeof snap === 'object') return snap;
    var fd = window.lastLiveFlightData || {};
    if (!fd || typeof fd !== 'object') return null;
    if (!Number.isFinite(Number(fd.totalWeightLbs)) && !Number.isFinite(Number(fd.payloadWeightLbs)) && !Number.isFinite(Number(fd.fuelWeightLbs))) return null;
    return {
      totalWeightLbs: Number(fd.totalWeightLbs),
      emptyWeightLbs: Number(fd.emptyWeightLbs),
      payloadWeightLbs: Number(fd.payloadWeightLbs),
      fuelWeightLbs: Number(fd.fuelWeightLbs),
      payloadStationCount: Number(fd.payloadStationCount),
      stations: []
    };
  }
  function cargoPayloadRequest() {
    var _window$aircraftPaylo2, _window$aircraftPaylo3;
    var force = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
    if (state.cargoPayloadLoading) return 'busy';
    if (typeof window.trackerPayloadGet !== 'function') return 'unsupported';
    if (!window.liveTrackerConnected) return 'tracker_offline';
    if (window.simModeActive) return 'sim_mode';
    var fd = window.lastLiveFlightData || {};
    if (Number(fd === null || fd === void 0 ? void 0 : fd.simRunning) === 0) return 'sim_offline';
    var ageMs = Date.now() - Number(((_window$aircraftPaylo2 = window.aircraftPayloadStatus) === null || _window$aircraftPaylo2 === void 0 ? void 0 : _window$aircraftPaylo2.lastSnapshotAt) || 0);
    if (!force && ageMs >= 0 && ageMs < 5000 && (_window$aircraftPaylo3 = window.aircraftPayloadStatus) !== null && _window$aircraftPaylo3 !== void 0 && _window$aircraftPaylo3.snapshot) return 'cached';
    state.cargoPayloadLoading = true;
    state.cargoPayloadRequestedAt = Date.now();
    Promise.resolve(window.trackerPayloadGet({
      maxStations: 12,
      timeoutMs: 12000
    })).catch(() => null).finally(() => {
      state.cargoPayloadLoading = false;
      if (state.view === 'cargo') render();
    });
    return 'started';
  }
  function cargoPayloadSummaryHtml() {
    var snap = cargoPayloadSnapshot();
    if (!snap) {
      var _window$aircraftPaylo4;
      var err = String(((_window$aircraftPaylo4 = window.aircraftPayloadStatus) === null || _window$aircraftPaylo4 === void 0 ? void 0 : _window$aircraftPaylo4.error) || '').trim();
      var fd = window.lastLiveFlightData || {};
      var waiting = state.cargoPayloadLoading;
      var msg = 'Sim-Gewichte: keine Daten.';
      if (!window.liveTrackerConnected) msg = 'Sim-Gewichte: Tracker nicht verbunden.';else if (window.simModeActive) msg = 'Sim-Gewichte: im Sim-Mode deaktiviert.';else if (Number(fd === null || fd === void 0 ? void 0 : fd.simRunning) === 0) msg = 'Sim-Gewichte: Simulator liefert keine Live-Daten.';else if (waiting) msg = 'Sim-Gewichte werden abgerufen ...';else if (err) msg = `Sim-Gewichte: Abruf fehlgeschlagen (${err}).`;else if (state.cargoPayloadRequestedAt > 0 && Date.now() - state.cargoPayloadRequestedAt > 14000) msg = 'Sim-Gewichte: Abruf abgelaufen.';
      return `<div class="route-tool-empty">${escapeHtml(msg)}</div>`;
    }
    var total = Number(snap.totalWeightLbs);
    var empty = Number(snap.emptyWeightLbs);
    var payload = Number(snap.payloadWeightLbs);
    var fuel = Number(snap.fuelWeightLbs);
    var stationCount = Math.max(0, Math.round(Number(snap.payloadStationCount) || 0));
    var stations = Array.isArray(snap.stations) ? snap.stations : [];
    var stationLine = stations.length ? stations.map(row => `S${Math.round(Number(row === null || row === void 0 ? void 0 : row.index) || 0)}:${Math.round(Number(row === null || row === void 0 ? void 0 : row.weightLbs) || 0)}lbs`).join(' · ') : '-';
    return `
            <div class="cargo-tool-summary">
                Sim: Total ${Number.isFinite(total) ? Math.round(total) : '-'} lbs · Leer ${Number.isFinite(empty) ? Math.round(empty) : '-'} lbs · Fuel ${Number.isFinite(fuel) ? Math.round(fuel) : '-'} lbs · Payload ${Number.isFinite(payload) ? Math.round(payload) : '-'} lbs
            </div>
            <div class="cargo-tool-summary">Stationen: ${stationCount || '-'} · ${escapeHtml(stationLine)}</div>
        `;
  }
  function cargoStatusLabel(item) {
    if (item.status === 'loaded') return 'geladen';
    if (item.status === 'unloaded') return 'ausgeladen';
    if (item.status === 'dropped') return 'abgeworfen';
    return 'offen';
  }
  function cargoHealthTone(health) {
    var n = Number(health !== null && health !== void 0 ? health : 100);
    if (n <= 35) return 'danger';
    if (n <= 70) return 'warn';
    return 'good';
  }
  function cargoIsAirborne() {
    try {
      var _ref9, _ref0, _fd$gsKts2, _window$lastLiveGpsPo;
      var fd = window.lastLiveFlightData || {};
      if (typeof fd.onGround === 'boolean') return !fd.onGround;
      var agl = Number(fd.aglFt);
      var gs = Number((_ref9 = (_ref0 = (_fd$gsKts2 = fd.gsKts) !== null && _fd$gsKts2 !== void 0 ? _fd$gsKts2 : fd.gs) !== null && _ref0 !== void 0 ? _ref0 : (_window$lastLiveGpsPo = window.lastLiveGpsPos) === null || _window$lastLiveGpsPo === void 0 ? void 0 : _window$lastLiveGpsPo.gs) !== null && _ref9 !== void 0 ? _ref9 : 0);
      return Number.isFinite(agl) && agl > 80 || typeof window.missionRuntimeIsActive === 'function' && window.missionRuntimeIsActive() && Number.isFinite(gs) && gs > 35;
    } catch (_) {
      return false;
    }
  }
  function cargoIsPassengerItem(item) {
    return !!item && String(item.itemType || '').toLowerCase() === 'passenger';
  }
  function cargoPassengerSceneBusy() {
    var status = window.missionSceneStatus || {};
    return !!(status.boardingPreparing || status.boardingRequested || status.boardingActive || status.deboardingRequested || status.deboardingActive || status.manualPaxRequested || status.manualPaxActive);
  }
  function cargoDetailHtml(item) {
    var _item$healthPct, _window$missionCompli, _window2, _window$missionCompli2, _window3, _window$missionCompli4, _window5, _window$missionCompli5, _window6;
    var health = Math.max(0, Math.min(100, Math.round(Number((_item$healthPct = item.healthPct) !== null && _item$healthPct !== void 0 ? _item$healthPct : 100))));
    var tone = cargoHealthTone(health);
    var isBoardBook = /bordbuch/i.test(`${item.id || ''} ${item.label || ''} ${item.storyName || ''}`);
    var isPassenger = cargoIsPassengerItem(item);
    var passengerBusy = isPassenger && cargoPassengerSceneBusy();
    var airborne = cargoIsAirborne();
    var isUnloaded = item.status === 'unloaded';
    var canComplianceLoad = ((_window$missionCompli = (_window2 = window).missionComplianceCanMutateCargo) === null || _window$missionCompli === void 0 ? void 0 : _window$missionCompli.call(_window2, item.id, 'load')) !== false;
    var canComplianceUnload = ((_window$missionCompli2 = (_window3 = window).missionComplianceCanMutateCargo) === null || _window$missionCompli2 === void 0 ? void 0 : _window$missionCompli2.call(_window3, item.id, 'unload')) !== false;
    var canLoad = canComplianceLoad && !passengerBusy && !airborne && (item.status === 'pending' || isUnloaded) && typeof window.missionCargoLoadItem === 'function';
    var canUnload = canComplianceUnload && !passengerBusy && item.status === 'loaded' && typeof window.missionCargoUnloadItem === 'function';
    var dropMode = canUnload && airborne;
    var expiry = '';
    if (isUnloaded && item.equipmentType === 'expiry') {
      var _window$missionCompli3, _window4;
      var match = String(item.expiresAt || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
      var expiryDay = match ? Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000) : NaN;
      var now = new Date();
      var todayDay = Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
      var daysRemaining = Number.isFinite(expiryDay) ? expiryDay - todayDay : NaN;
      var replaceEligible = !Number.isFinite(daysRemaining) || daysRemaining < 5;
      var replaceLocked = ((_window$missionCompli3 = (_window4 = window).missionComplianceReplacementLocked) === null || _window$missionCompli3 === void 0 ? void 0 : _window$missionCompli3.call(_window4)) === true;
      var relative = Number.isFinite(daysRemaining) ? daysRemaining < 0 ? `seit ${Math.abs(daysRemaining)} ${Math.abs(daysRemaining) === 1 ? 'Tag' : 'Tagen'} abgelaufen` : `noch ${daysRemaining} ${daysRemaining === 1 ? 'Tag' : 'Tage'} gültig` : 'Datum fehlt';
      expiry = `
                <div class="cargo-detail-line">Ablaufdatum: <b>${escapeHtml(item.expiresAt || '--')}</b> · ${escapeHtml(relative)}</div>
                ${replaceEligible ? `<div class="cargo-detail-actions"><button class="checklist-mini-btn" type="button" data-action="cargo-replace" data-item-id="${escapeAttr(item.id)}" ${replaceLocked ? 'disabled aria-disabled="true"' : ''}>${replaceLocked ? 'Austausch gesperrt' : 'Gegen neuen ersetzen'}</button></div>` : ''}
            `;
    }
    var log = item.log || {};
    var startAllowed = ((_window$missionCompli4 = (_window5 = window).missionComplianceBoardBookWriteAllowed) === null || _window$missionCompli4 === void 0 ? void 0 : _window$missionCompli4.call(_window5, 'start', {
      source: 'side-menu'
    })) !== false;
    var landingAllowed = ((_window$missionCompli5 = (_window6 = window).missionComplianceBoardBookWriteAllowed) === null || _window$missionCompli5 === void 0 ? void 0 : _window$missionCompli5.call(_window6, 'landing', {
      source: 'side-menu'
    })) !== false;
    var boardBook = isBoardBook && isUnloaded ? `
            <div class="cargo-detail-actions">
                <button class="checklist-mini-btn" type="button" data-action="cargo-boardbook-time" data-item-id="${escapeAttr(item.id)}" data-field="start" ${startAllowed ? '' : 'disabled aria-disabled="true"'}>Startzeit eintragen</button>
                <button class="checklist-mini-btn" type="button" data-action="cargo-boardbook-time" data-item-id="${escapeAttr(item.id)}" data-field="landing" ${landingAllowed ? '' : 'disabled aria-disabled="true"'}>Landezeit eintragen</button>
            </div>
            <div class="cargo-detail-line">Start: <b>${escapeHtml(log.startTime || '--')}</b> · Landung: <b>${escapeHtml(log.landingTime || '--')}</b></div>
        ` : '';
    var actions = `
            <div class="cargo-detail-actions">
                ${passengerBusy ? '<button class="checklist-mini-btn is-disabled" type="button" disabled aria-disabled="true">... Szene</button>' : ''}
                ${canLoad ? `<button class="checklist-mini-btn primary" type="button" data-action="cargo-load" data-item-id="${escapeAttr(item.id)}">${item.status === 'unloaded' ? 'Wieder laden' : 'Laden'}</button>` : ''}
                ${canUnload ? `<button class="checklist-mini-btn ${dropMode ? 'danger' : 'primary'}" type="button" data-action="cargo-unload" data-item-id="${escapeAttr(item.id)}">${dropMode ? 'Abwerfen' : 'Entladen'}</button>` : ''}
            </div>
        `;
    return `
            <div class="cargo-detail">
                <div class="cargo-health-row">
                    <span>Zustand</span>
                    <span>${health}%</span>
                </div>
                <div class="cargo-health-bar is-${tone}"><span style="width:${health}%"></span></div>
                <div class="cargo-detail-line">Status: <b>${escapeHtml(cargoStatusLabel(item))}</b> · ${item.required ? 'Pflicht' : 'Optional'} · ${Math.round(Number(item.weightLbs) || 0)} lbs</div>
                ${expiry}
                ${boardBook}
                ${actions}
            </div>
        `;
  }
  function renderCargoTool() {
    setTitle('Ladung');
    cargoPayloadRequest(false);
    try {
      if (typeof window.missionCargoApplyCurrentStress === 'function') window.missionCargoApplyCurrentStress();
    } catch (_) {}
    var manifest = cargoManifestSnapshot();
    var items = Array.isArray(manifest === null || manifest === void 0 ? void 0 : manifest.items) ? manifest.items : [];
    var outcome = typeof window.missionCargoEvaluateOutcome === 'function' ? window.missionCargoEvaluateOutcome() : null;
    var summary = outcome ? `${outcome.loadedWeightLbs || 0}/${outcome.totalWeightLbs || 0} lbs · ${outcome.failed ? 'kritisch' : 'ok'}` : cargoHomeSummary();
    if (!items.length) {
      bodyEl.innerHTML = `
                ${toolTopline('cargo')}
                <div class="checklist-topline">
                    <button class="checklist-action-btn" type="button" data-action="cargo-open-modal">Bordbestand verwalten</button>
                </div>
                ${renderToolEmpty('Keine aktive Missionsladung gefunden. Der Bordbestand kann am Boden trotzdem verwaltet werden.')}
            `;
      return;
    }
    var rows = items.map(item => {
      var _item$healthPct2;
      var expanded = state.cargoExpandedItemId === item.id;
      var health = Math.max(0, Math.min(100, Math.round(Number((_item$healthPct2 = item.healthPct) !== null && _item$healthPct2 !== void 0 ? _item$healthPct2 : 100))));
      var passengerBusy = cargoIsPassengerItem(item) && cargoPassengerSceneBusy();
      return `
                <div class="cargo-tool-row ${item.required ? 'is-required' : ''} ${item.status === 'loaded' ? 'is-loaded' : ''} ${item.status === 'dropped' ? 'is-dropped' : ''} ${passengerBusy ? 'is-disabled' : ''}">
                    <button class="cargo-tool-main" type="button" data-action="cargo-toggle-detail" data-item-id="${escapeAttr(item.id)}">
                        <span>
                            <span class="cargo-tool-name">${escapeHtml(item.storyName || item.label || item.id)}</span>
                            <span class="cargo-tool-meta">${item.required ? 'Pflicht' : 'Optional'} · ${Math.round(Number(item.weightLbs) || 0)} lbs · ${cargoStatusLabel(item)} · ${health}%${passengerBusy ? ' · Szene läuft' : ''}</span>
                        </span>
                        <span class="checklist-tool-arrow" aria-hidden="true">${expanded ? '⌃' : '›'}</span>
                    </button>
                    ${expanded ? cargoDetailHtml(item) : ''}
                </div>
            `;
    }).join('');
    var failLine = outcome !== null && outcome !== void 0 && outcome.failed ? `<div class="route-tool-empty cargo-fail-note">Mission wuerde mit Cargo-Fehlschlag enden: ${escapeHtml([].concat(_toConsumableArray(outcome.missingRequired || []), _toConsumableArray(outcome.droppedRequired || []), _toConsumableArray(outcome.notDeliveredRequired || []), _toConsumableArray(outcome.damagedRequired || [])).filter(Boolean).join(', ') || 'Pflichtladung nicht erfuellt')}</div>` : '';
    bodyEl.innerHTML = `
            ${toolTopline('cargo')}
            <div class="checklist-topline">
                <button class="checklist-action-btn" type="button" data-action="cargo-open-modal">Verladefenster öffnen</button>
                <button class="checklist-action-btn" type="button" data-action="cargo-refresh-payload">${state.cargoPayloadLoading ? 'Sim-Gewichte ...' : 'Sim-Gewichte holen'}</button>
            </div>
            <div class="cargo-tool-summary">${escapeHtml(summary)}</div>
            ${cargoPayloadSummaryHtml()}
            ${failLine}
            <div class="cargo-tool-list">${rows}</div>
        `;
  }
  function openTool(tool) {
    var _window$gaChecklistHo8, _window$gaChecklistHo9;
    var force = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    var valid = new Set(['weather', 'radio', 'warnings', 'place', 'nearest', 'cargo', 'mission']);
    if (!valid.has(tool)) return;
    abortOtherToolRequests(tool);
    state.view = tool;
    state.actionMenuOpen = false;
    state.nearestMenuKey = '';
    state.radioAirportMenuKey = '';
    state.cargoExpandedItemId = '';
    state.placeInfoAirport = null;
    state.placeInfoReturn = tool;
    setStatus('');
    render();
    if (((_window$gaChecklistHo8 = window.gaChecklistHost) === null || _window$gaChecklistHo8 === void 0 || (_window$gaChecklistHo9 = _window$gaChecklistHo8.supportsTool) === null || _window$gaChecklistHo9 === void 0 ? void 0 : _window$gaChecklistHo9.call(_window$gaChecklistHo8, tool)) === false) return;
    if (tool === 'weather') ensureWeatherTool(force);
    if (tool === 'radio') ensureRadioTool(force);
    if (tool === 'warnings') ensureWarningsTool(force);
    if (tool === 'place') ensurePlaceTool(force);
    if (tool === 'nearest') ensureNearestTool(force);
  }
  function pickRouteSamplePoints() {
    var maxSamples = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 5;
    var pts = getRoutePoints();
    if (pts.length <= maxSamples) return pts;
    var out = [pts[0]];
    var interiorSlots = maxSamples - 2;
    for (var i = 1; i <= interiorSlots; i += 1) {
      var idx = Math.round(i / (interiorSlots + 1) * (pts.length - 1));
      out.push(pts[idx]);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  function metarToWeather(metar) {
    var _metar$dewp;
    var fallbackCode = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
    var distNm = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
    if (!metar || typeof metar !== 'object') return null;
    var code = String(metar.icaoId || fallbackCode || '').trim().toUpperCase();
    var raw = metar.rawOb || metar.raw || '';
    var temp = Number(metar.temp);
    var dew = Number((_metar$dewp = metar.dewp) !== null && _metar$dewp !== void 0 ? _metar$dewp : metar.dewpoint);
    var rh = Number.isFinite(temp) && Number.isFinite(dew) ? relativeHumidityFromTempDew(temp, dew) : null;
    var hasWindDir = metar.wdir !== undefined && metar.wdir !== null && String(metar.wdir).trim() !== '';
    var windDir = hasWindDir ? String(metar.wdir).toUpperCase() : '';
    var wind = windDir ? `${windDir === 'VRB' ? 'VRB' : `${metar.wdir}°`}/${metar.wspd || 0}${metar.wgst ? `G${metar.wgst}` : ''} kt` : '';
    var source = Number.isFinite(Number(distNm)) ? `METAR nahe ${fmtNm(distNm)} NM` : 'METAR';
    return {
      source,
      station: code,
      raw,
      cat: metar.fltCat || metar.fltcat || '',
      observedAt: metar.obsTime || metar.reportTime || metar.receiptTime || Date.now(),
      wind,
      vis: /\b9999\b/.test(raw) ? '>10 km' : metar.visib ? `${metar.visib} sm` : '',
      clouds: formatMetarClouds(raw) || metar.cover || '',
      wx: metar.wxString || 'NIL',
      temp: Number.isFinite(temp) ? `${Math.round(temp)}°C` : '',
      dew: Number.isFinite(dew) ? `${Math.round(dew)}°C` : '',
      rh: Number.isFinite(rh) ? `${rh}%` : '',
      pressure: parseQnhFromMetar(raw) || formatMetarPressure(metar)
    };
  }
  function weatherFromMetarCache(icao) {
    var code = String(icao || '').trim().toUpperCase();
    if (!code) return null;
    try {
      var _gpsState;
      var entry = typeof gpsState !== 'undefined' && (_gpsState = gpsState) !== null && _gpsState !== void 0 && _gpsState.metarCache ? gpsState.metarCache[code] : null;
      var metar = Array.isArray(entry === null || entry === void 0 ? void 0 : entry.data) ? entry.data[0] : null;
      return metarToWeather(metar, code);
    } catch (_) {
      return null;
    }
  }
  function parseMetarPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload && Array.isArray(payload.results)) return payload.results;
    if (payload && typeof payload.contents === 'string') {
      try {
        var nested = JSON.parse(payload.contents);
        if (Array.isArray(nested)) return nested;
        if (nested && Array.isArray(nested.data)) return nested.data;
      } catch (_) {}
    }
    return [];
  }
  function cacheMetarsForWidgets(metars) {
    var _gpsState2;
    if (!Array.isArray(metars) || typeof gpsState === 'undefined' || !((_gpsState2 = gpsState) !== null && _gpsState2 !== void 0 && _gpsState2.metarCache)) return;
    metars.forEach(m => {
      var code = String((m === null || m === void 0 ? void 0 : m.icaoId) || '').trim().toUpperCase();
      if (!code) return;
      gpsState.metarCache[code] = {
        data: [m],
        isFallback: false,
        foundIcao: code,
        updatedAt: Date.now()
      };
    });
  }
  function fetchRouteMetarsForWeather(_x3, _x4) {
    return _fetchRouteMetarsForWeather.apply(this, arguments);
  }
  function _fetchRouteMetarsForWeather() {
    _fetchRouteMetarsForWeather = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(points, signal) {
      var bounds, src, payload, metars;
      return _regenerator().w(function (_context2) {
        while (1) switch (_context2.n) {
          case 0:
            bounds = routeBounds(points, WEATHER_METAR_RADIUS_NM);
            if (bounds) {
              _context2.n = 1;
              break;
            }
            return _context2.a(2, []);
          case 1:
            src = `https://aviationweather.gov/api/data/metar?bbox=${bounds.minLat},${bounds.minLon},${bounds.maxLat},${bounds.maxLon}&format=json&t=${Date.now()}`;
            _context2.n = 2;
            return fetchJson(`${ROUTE_TOOLS_PROXY}/api/metar?src=${encodeURIComponent(src)}`, signal);
          case 2:
            payload = _context2.v;
            metars = parseMetarPayload(payload).filter(m => m && Number.isFinite(Number(m.lat)) && Number.isFinite(Number(m.lon)));
            cacheMetarsForWidgets(metars);
            return _context2.a(2, metars);
        }
      }, _callee2);
    }));
    return _fetchRouteMetarsForWeather.apply(this, arguments);
  }
  function cachedMetarList() {
    try {
      var _gpsState3;
      if (typeof gpsState === 'undefined' || !((_gpsState3 = gpsState) !== null && _gpsState3 !== void 0 && _gpsState3.metarCache)) return [];
      var out = [];
      Object.values(gpsState.metarCache).forEach(entry => {
        var data = Array.isArray(entry === null || entry === void 0 ? void 0 : entry.data) ? entry.data : [];
        data.forEach(m => {
          if (m && Number.isFinite(Number(m.lat)) && Number.isFinite(Number(m.lon))) out.push(m);
        });
      });
      return out;
    } catch (_) {
      return [];
    }
  }
  function nearestMetarWeatherPoint(lat, lon) {
    var metars = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
    var maxNm = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : WEATHER_METAR_RADIUS_NM;
    var all = [];
    var seen = new Set();
    [].concat(_toConsumableArray(Array.isArray(metars) ? metars : []), _toConsumableArray(cachedMetarList())).forEach(m => {
      var key = String((m === null || m === void 0 ? void 0 : m.icaoId) || (m === null || m === void 0 ? void 0 : m.rawOb) || (m === null || m === void 0 ? void 0 : m.raw) || `${m === null || m === void 0 ? void 0 : m.lat},${m === null || m === void 0 ? void 0 : m.lon}`).trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      all.push(m);
    });
    var best = null;
    var bestDist = Infinity;
    all.forEach(m => {
      var mLat = Number(m === null || m === void 0 ? void 0 : m.lat),
        mLon = Number(m === null || m === void 0 ? void 0 : m.lon);
      if (!Number.isFinite(mLat) || !Number.isFinite(mLon)) return;
      var nav = navBetween(lat, lon, mLat, mLon);
      if (nav.dist < bestDist) {
        bestDist = nav.dist;
        best = m;
      }
    });
    if (!best || bestDist > maxNm) return null;
    return metarToWeather(best, best.icaoId, bestDist);
  }
  function nearestCachedWeatherPoint(lat, lon) {
    try {
      if (typeof vpWeatherData === 'undefined' || !Array.isArray(vpWeatherData)) return null;
      var best = null;
      var bestDist = Infinity;
      vpWeatherData.forEach(zone => {
        var zLat = Number(zone === null || zone === void 0 ? void 0 : zone.stnLat),
          zLon = Number(zone === null || zone === void 0 ? void 0 : zone.stnLon);
        if (!Number.isFinite(zLat) || !Number.isFinite(zLon)) return;
        var nav = navBetween(lat, lon, zLat, zLon);
        if (nav.dist < bestDist) {
          bestDist = nav.dist;
          best = {
            source: 'Kartenwetter',
            station: zone.icao || '',
            cat: zone.fltCat || '',
            observedAt: zone.obsTime || zone.reportTime || Date.now(),
            wind: zone.wdir ? `${zone.wdir}°/${zone.wspd || 0} kt` : '',
            vis: zone.visib ? `${zone.visib}` : '',
            clouds: formatKnownCloudLayers(zone.clouds) || (Array.isArray(zone.clouds) ? `${zone.clouds.length} Layer` : ''),
            wx: zone.wxString || '',
            distNm: bestDist
          };
        }
      });
      return best && bestDist <= 45 ? best : null;
    } catch (_) {
      return null;
    }
  }
  function cloudCoverToOctas(cover) {
    var c = String(cover || '').toUpperCase();
    if (c === 'SKC' || c === 'CLR' || c === 'NSC' || c === 'NCD') return '0/8';
    if (c === 'FEW') return '1-2/8';
    if (c === 'SCT') return '3-4/8';
    if (c === 'BKN') return '5-7/8';
    if (c === 'OVC' || c === 'VV') return '8/8';
    return '';
  }
  function pctToOctas(value) {
    var pct = Number(value);
    if (!Number.isFinite(pct)) return null;
    return Math.max(0, Math.min(8, Math.round(pct / 12.5)));
  }
  function relativeHumidityFromTempDew(tempC, dewC) {
    var t = Number(tempC);
    var d = Number(dewC);
    if (!Number.isFinite(t) || !Number.isFinite(d)) return null;
    var saturation = Math.exp(17.625 * t / (243.04 + t));
    var actual = Math.exp(17.625 * d / (243.04 + d));
    return Math.max(0, Math.min(100, Math.round(actual / saturation * 100)));
  }
  function parseQnhFromMetar(raw) {
    var text = String(raw || '');
    var qnh = text.match(/\bQ(\d{4})\b/);
    if (qnh) return `${Number(qnh[1])} hPa`;
    var alt = text.match(/\bA(\d{4})\b/);
    if (!alt) return '';
    var inHg = Number(alt[1]) / 100;
    if (!Number.isFinite(inHg)) return '';
    return `${Math.round(inHg * 33.8639)} hPa`;
  }
  function formatMetarPressure(metar) {
    var _ref1, _metar$mslp;
    var p = Number((_ref1 = (_metar$mslp = metar === null || metar === void 0 ? void 0 : metar.mslp) !== null && _metar$mslp !== void 0 ? _metar$mslp : metar === null || metar === void 0 ? void 0 : metar.slp) !== null && _ref1 !== void 0 ? _ref1 : metar === null || metar === void 0 ? void 0 : metar.altim);
    if (!Number.isFinite(p)) return '';
    if (p >= 850 && p <= 1100) return `${Math.round(p)} hPa`;
    if (p >= 25 && p <= 33) return `${Math.round(p * 33.8639)} hPa`;
    return '';
  }
  function formatMetarClouds(raw) {
    var text = String(raw || '');
    var layers = [];
    var re = /\b(FEW|SCT|BKN|OVC|VV)(\d{3})\b/g;
    var match;
    while ((match = re.exec(text)) !== null && layers.length < 3) {
      var cover = match[1].toUpperCase();
      var ft = Number(match[2]) * 100;
      layers.push(`${cover} ${cloudCoverToOctas(cover)} ${ft} ft AGL`);
    }
    if (!layers.length && /\b(SKC|CLR|NSC|NCD)\b/.test(text)) return '0/8 keine relevanten Wolken';
    return layers.join(' · ');
  }
  function formatKnownCloudLayers(clouds) {
    if (!Array.isArray(clouds) || !clouds.length) return '';
    return clouds.slice(0, 3).map(c => {
      var _ref10, _c$baseAgl;
      var cover = String(c.type || c.cover || '').toUpperCase();
      var octas = cloudCoverToOctas(cover) || (Number.isFinite(Number(c.cloudPct)) ? `${pctToOctas(c.cloudPct)}/8` : '');
      var base = Number((_ref10 = (_c$baseAgl = c.baseAgl) !== null && _c$baseAgl !== void 0 ? _c$baseAgl : c.baseFt) !== null && _ref10 !== void 0 ? _ref10 : c.baseMsl);
      var suffix = Number.isFinite(base) ? ` ca. ${Math.round(base / 100) * 100} ft` : '';
      return `${cover || 'Layer'} ${octas}${suffix}`.trim();
    }).join(' · ');
  }
  function wxCodeText(code) {
    var precipMm = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
    var rainMm = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
    var snowCm = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
    var c = Number(code);
    if (!Number.isFinite(c)) {
      if (Number(precipMm) > 0 || Number(rainMm) > 0) return 'Niederschlag';
      if (Number(snowCm) > 0) return 'Schnee';
      return '';
    }
    var map = {
      0: 'NIL',
      1: 'überwiegend klar',
      2: 'teilweise bewölkt',
      3: 'bedeckt',
      45: 'Nebel',
      48: 'Nebel/Reif',
      51: 'leichter Sprühregen',
      53: 'Sprühregen',
      55: 'starker Sprühregen',
      56: 'gefrierender Sprühregen',
      57: 'starker gefrierender Sprühregen',
      61: 'leichter Regen',
      63: 'Regen',
      65: 'starker Regen',
      66: 'gefrierender Regen',
      67: 'starker gefrierender Regen',
      71: 'leichter Schnee',
      73: 'Schnee',
      75: 'starker Schnee',
      77: 'Schneekörner',
      80: 'leichte Schauer',
      81: 'Schauer',
      82: 'starke Schauer',
      85: 'leichte Schneeschauer',
      86: 'Schneeschauer',
      95: 'Gewitter',
      96: 'Gewitter/Hagel',
      99: 'starkes Gewitter/Hagel'
    };
    return map[c] || `Wx ${c}`;
  }
  function formatOpenMeteoClouds(om) {
    if (!om) return '';
    if (Array.isArray(om.pressureProfile) && om.pressureProfile.length) {
      var pts = om.pressureProfile.filter(p => Number.isFinite(Number(p.geopotentialFt)) && Number.isFinite(Number(p.cloudPct))).sort((a, b) => Number(a.geopotentialFt) - Number(b.geopotentialFt));
      var layers = [];
      var start = null;
      var cover = [];
      pts.forEach((p, idx) => {
        var cloudy = Number(p.cloudPct) >= 20;
        if (cloudy && !start) {
          start = {
            idx,
            baseFt: Number(p.geopotentialFt)
          };
          cover = [Number(p.cloudPct)];
        } else if (cloudy) {
          cover.push(Number(p.cloudPct));
        } else if (start) {
          var avg = cover.reduce((a, b) => a + b, 0) / Math.max(1, cover.length);
          layers.push(`${pctToOctas(avg)}/8 ca. ${Math.round(start.baseFt / 100) * 100} ft MSL`);
          start = null;
          cover = [];
        }
      });
      if (start) {
        var avg = cover.reduce((a, b) => a + b, 0) / Math.max(1, cover.length);
        layers.push(`${pctToOctas(avg)}/8 ca. ${Math.round(start.baseFt / 100) * 100} ft MSL`);
      }
      if (layers.length) return layers.slice(0, 3).join(' · ');
    }
    var parts = [['low', om.cloudLowPct, '< 6500 ft'], ['mid', om.cloudMidPct, '6500-20000 ft'], ['high', om.cloudHighPct, '> 20000 ft']].filter(_ref11 => {
      var _ref12 = _slicedToArray(_ref11, 2),
        pct = _ref12[1];
      return Number.isFinite(Number(pct)) && Number(pct) >= 10;
    });
    return parts.length ? parts.map(_ref13 => {
      var _ref14 = _slicedToArray(_ref13, 3),
        name = _ref14[0],
        pct = _ref14[1],
        band = _ref14[2];
      return `${name} ${pctToOctas(pct)}/8 ${band}`;
    }).join(' · ') : '0/8 kaum Wolken';
  }
  function weatherFromOpenMeteo(om) {
    if (!om) return null;
    var temp = Number(om.temp2mC);
    var dew = Number(om.dewPoint2mC);
    var rh = Number(om.rh2mPct);
    var pressure = Number(om.mslPressureHpa);
    return {
      source: 'Open-Meteo',
      station: '',
      cat: '',
      observedAt: om.time || Date.now(),
      wind: Number.isFinite(Number(om.wspd)) ? `${Math.round(Number(om.wdir || 0))}°/${Math.round(Number(om.wspd))} kt` : '',
      vis: Number.isFinite(Number(om.visibilityM)) ? `${Math.round(Number(om.visibilityM) / 1000)} km` : '',
      clouds: formatOpenMeteoClouds(om),
      wx: wxCodeText(om.weatherCode, om.precipitationMm, om.rainMm, om.snowfallCm),
      temp: Number.isFinite(temp) ? `${Math.round(temp)}°C` : '',
      dew: Number.isFinite(dew) ? `${Math.round(dew)}°C` : '',
      rh: Number.isFinite(rh) ? `${Math.round(rh)}%` : '',
      pressure: Number.isFinite(pressure) ? `${Math.round(pressure)} hPa` : ''
    };
  }
  function mergeWeatherSources(cached, openMeteo) {
    if (!cached && !openMeteo) return {
      source: 'Keine Daten'
    };
    if (!cached) return openMeteo;
    if (!openMeteo) return cached;
    var merged = _objectSpread(_objectSpread({}, openMeteo), cached);
    ['wind', 'vis', 'clouds', 'wx', 'temp', 'dew', 'rh', 'pressure', 'observedAt'].forEach(key => {
      if (!merged[key] || merged[key] === 'NIL' || merged[key] === '—') merged[key] = openMeteo[key] || merged[key];
    });
    if (openMeteo.source && cached.source && cached.source !== openMeteo.source) {
      merged.source = `${cached.source} + ${openMeteo.source}`;
    }
    return merged;
  }
  function weatherRiskRank(sample) {
    var cat = String((sample === null || sample === void 0 ? void 0 : sample.cat) || '').toUpperCase();
    if (cat === 'LIFR' || cat === 'IFR') return 3;
    if (cat === 'MVFR') return 2;
    var raw = `${(sample === null || sample === void 0 ? void 0 : sample.wx) || ''} ${(sample === null || sample === void 0 ? void 0 : sample.raw) || ''}`.toUpperCase();
    if (/TS|FZ|SN|FG|BKN00|OVC00/.test(raw)) return 3;
    if (/RA|SH|BR|HZ|BKN0[0-2]|OVC0[0-2]/.test(raw)) return 2;
    if (/BKN|OVC|SCT0[0-3]/.test(raw)) return 1;
    return 0;
  }
  function buildWeatherAssessment(rows) {
    var ranks = rows.map(weatherRiskRank);
    var worst = Math.max.apply(Math, [0].concat(_toConsumableArray(ranks)));
    var missing = rows.filter(r => !r.source || r.source === 'Keine Daten').length;
    if (!rows.length) return {
      tone: 'warn',
      label: 'Keine Route',
      text: 'Plane zuerst eine Route, dann kann ich das Wetter entlang der Strecke zusammenfassen.'
    };
    if (worst >= 3) return {
      tone: 'bad',
      label: 'Anspruchsvoll',
      text: 'Es gibt deutliche Warnzeichen wie IFR/LIFR, Gewitter, Nebel oder sehr tiefe Wolken. Für VFR wäre das keine entspannte Lage.'
    };
    if (worst === 2) return {
      tone: 'warn',
      label: 'Genau prüfen',
      text: 'Die Lage ist gemischt: Sicht, Wolken oder Niederschlag können einzelne Abschnitte schwierig machen. Plane Ausweichoptionen ein.'
    };
    if (worst === 1) return {
      tone: 'watch',
      label: 'Beobachten',
      text: 'Grundsätzlich wirkt die Lage brauchbar, aber Wolken oder lokale Wetterzeichen verdienen Aufmerksamkeit.'
    };
    if (missing >= Math.ceil(rows.length / 2)) return {
      tone: 'warn',
      label: 'Daten dünn',
      text: 'Es sind nur wenige automatische Wetterpunkte entlang der Route vorhanden. Für die Simulation lieber konservativ planen.'
    };
    return {
      tone: 'good',
      label: 'Unauffällig',
      text: 'Die automatisch gefundenen Daten zeigen keine groben roten Flaggen. Für die Simulation wirkt die Lage gut planbar.'
    };
  }
  function weatherDateMs(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value > 1e12 ? value : value * 1000;
    if (/^\d+$/.test(String(value))) {
      var numeric = Number(value);
      return numeric > 1e12 ? numeric : numeric * 1000;
    }
    var parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function formatUtcWeatherTime(value) {
    var ms = weatherDateMs(value) || Date.now();
    var date = new Date(ms);
    if (!Number.isFinite(date.getTime())) return '';
    return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')} Z`;
  }
  function formatWeatherAge(value) {
    var ms = weatherDateMs(value);
    if (!ms) return '';
    var ageMin = Math.max(0, Math.round((Date.now() - ms) / 60000));
    if (ageMin < 90) return `${ageMin} min alt`;
    var ageHours = Math.round(ageMin / 60);
    return `${ageHours} h alt`;
  }
  function weatherCardTone(row) {
    if (!(row !== null && row !== void 0 && row.source) || row.source === 'Keine Daten') return 'warn';
    var rank = weatherRiskRank(row);
    if (rank >= 3) return 'bad';
    if (rank === 2) return 'warn';
    if (rank === 1) return 'watch';
    return 'good';
  }
  function weatherBadgeLabel(row) {
    if (!(row !== null && row !== void 0 && row.source) || row.source === 'Keine Daten') return '?';
    var cat = String((row === null || row === void 0 ? void 0 : row.cat) || '').toUpperCase();
    if (cat) return cat === 'VFR' ? 'V' : cat.slice(0, 1);
    var tone = weatherCardTone(row);
    if (tone === 'good') return 'V';
    if (tone === 'watch') return '?';
    return '!';
  }
  function weatherStationTitle(row) {
    var station = String((row === null || row === void 0 ? void 0 : row.station) || '').trim().toUpperCase();
    var name = String((row === null || row === void 0 ? void 0 : row.name) || (row === null || row === void 0 ? void 0 : row.label) || station || 'Wetterpunkt').trim();
    if (station && !name.toUpperCase().includes(station)) return `${name} (${station})`;
    return name || station || 'Wetterpunkt';
  }
  function weatherSourceTitle(row) {
    var source = String((row === null || row === void 0 ? void 0 : row.source) || 'Wetter').split('+')[0].trim().toUpperCase();
    var label = source.includes('METAR') ? 'METAR' : source.includes('OPEN') ? 'Modell' : source || 'Wetter';
    return `${label} from ${formatUtcWeatherTime(row === null || row === void 0 ? void 0 : row.observedAt)}`;
  }
  function renderWeatherFact(label, value) {
    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    if (!value) return '';
    var className = options.danger ? ' route-weather-value is-danger' : ' route-weather-value';
    return `
            <div class="route-weather-row">
                <span class="route-weather-label">${escapeHtml(label)}</span>
                <span class="${className.trim()}">${escapeHtml(value)}</span>
            </div>
        `;
  }
  function renderWeatherStation(row) {
    var tone = weatherCardTone(row);
    var observedAt = (row === null || row === void 0 ? void 0 : row.observedAt) || (row === null || row === void 0 ? void 0 : row.generatedAt);
    var tempParts = [row === null || row === void 0 ? void 0 : row.temp, row === null || row === void 0 ? void 0 : row.dew].filter(Boolean).join(' / ');
    var tempLine = [tempParts, row === null || row === void 0 ? void 0 : row.rh].filter(Boolean).join(', ');
    var wxDanger = weatherRiskRank(row) >= 2;
    return `
            <section class="route-weather-station">
                <h3 class="route-weather-station-title">${escapeHtml(weatherStationTitle(row))}</h3>
                <article class="route-weather-card is-${escapeAttr(tone)}">
                    <div class="route-weather-card-head">
                        <div>
                            <div class="route-weather-card-title">${escapeHtml(weatherSourceTitle(row))}</div>
                            ${formatWeatherAge(observedAt) ? `<div class="route-weather-card-age">${escapeHtml(formatWeatherAge(observedAt))}</div>` : ''}
                        </div>
                        <span class="route-weather-badge">${escapeHtml(weatherBadgeLabel(row))}</span>
                    </div>
                    <div class="route-weather-facts">
                        ${renderWeatherFact('Wind', (row === null || row === void 0 ? void 0 : row.wind) || '—')}
                        ${renderWeatherFact('Temperatur', tempLine)}
                        ${renderWeatherFact('Luftdruck', row === null || row === void 0 ? void 0 : row.pressure)}
                        ${renderWeatherFact('Sichtweite', (row === null || row === void 0 ? void 0 : row.vis) || '—')}
                        ${renderWeatherFact('Wolken', (row === null || row === void 0 ? void 0 : row.clouds) || '—', {
      danger: wxDanger && /BKN|OVC|VV|8\/8|5-7\/8/i.test(String((row === null || row === void 0 ? void 0 : row.clouds) || ''))
    })}
                        ${renderWeatherFact('WX', row !== null && row !== void 0 && row.wx && row.wx !== 'NIL' ? row.wx : 'NIL', {
      danger: wxDanger && (row === null || row === void 0 ? void 0 : row.wx) && row.wx !== 'NIL'
    })}
                    </div>
                    <div class="route-weather-source">${escapeHtml((row === null || row === void 0 ? void 0 : row.source) || 'Keine Daten')}${row !== null && row !== void 0 && row.station ? ` · ${escapeHtml(row.station)}` : ''}</div>
                </article>
            </section>
        `;
  }
  function getGeminiApiKey() {
    try {
      var input = document.getElementById('apiKeyInput');
      return String((input === null || input === void 0 ? void 0 : input.value) || localStorage.getItem('ga_gemini_key') || '').trim();
    } catch (_) {
      return '';
    }
  }
  function weatherAiCacheKey(routeKey, rows) {
    var compact = (rows || []).map(r => [r.label, r.name, r.source, r.station, r.wind, r.vis, r.clouds, r.wx, r.cat].map(v => String(v || '').slice(0, 80)).join('/')).join('|');
    return `wx-ai:${routeKey}:${compact}`;
  }
  function weatherAiPrompt(rows, assessment) {
    var routeLines = rows.map(r => `${r.label} ${r.name || ''}: Quelle ${r.source || 'keine'}, Station ${r.station || '-'}, Wind ${r.wind || '-'}, Sicht ${r.vis || '-'}, Wolken ${r.clouds || '-'}, Wx ${r.wx || '-'}, Kategorie ${r.cat || '-'}`).join('\n');
    return `Du bist der Wetter-Briefer in einem VFR-Flugsimulator. Schreibe auf Deutsch ein kompaktes, pilotisch klingendes Sim-Wetterbriefing entlang der geplanten Route.

Regeln:
- 4 bis 6 kurze Sätze, keine Markdown-Liste.
- Klinge wie ein Briefing vor dem virtuellen Abflug: Gesamtbild, Start, Enroute, Ziel, Auffälligkeiten.
- Nenne konkrete fliegerische Punkte: Wind, Sicht, Wolkenbasis/Bedeckung, Niederschlag/WX, kritische Abschnitte.
- Gib eine einfache Sim-Empfehlung, z.B. Route entspannt, Wolken/Schauer im Auge behalten, Ausweichplatz im Kopf behalten, Höhe anpassen.
- Wenn Daten fehlen oder widersprüchlich sind, sage das deutlich.
- Kein Hinweis auf offizielle Wetterdaten, Behördenbriefing, Rechtslage oder reale Flugfreigabe.
- Nutze einfache Sprache, aber fachlich korrekt und cockpitnah.

Regelbasierte Vorbewertung: ${(assessment === null || assessment === void 0 ? void 0 : assessment.label) || '-'}: ${(assessment === null || assessment === void 0 ? void 0 : assessment.text) || '-'}

Daten:
${routeLines}`;
  }
  function fetchGeminiWeatherText(_x5, _x6, _x7) {
    return _fetchGeminiWeatherText.apply(this, arguments);
  }
  function _fetchGeminiWeatherText() {
    _fetchGeminiWeatherText = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(rows, assessment, signal) {
      var apiKey, payload, options, models, _i, _models, model, _data$candidates, res, data, text, _t;
      return _regenerator().w(function (_context3) {
        while (1) switch (_context3.p = _context3.n) {
          case 0:
            apiKey = getGeminiApiKey();
            if (!(!apiKey || !(rows !== null && rows !== void 0 && rows.length))) {
              _context3.n = 1;
              break;
            }
            return _context3.a(2, null);
          case 1:
            payload = {
              contents: [{
                parts: [{
                  text: weatherAiPrompt(rows, assessment)
                }]
              }],
              generationConfig: {
                temperature: 0.25,
                maxOutputTokens: 260
              }
            };
            options = {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(payload)
            };
            if (signal) options.signal = signal;
            models = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
            _i = 0, _models = models;
          case 2:
            if (!(_i < _models.length)) {
              _context3.n = 10;
              break;
            }
            model = _models[_i];
            _context3.p = 3;
            _context3.n = 4;
            return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, options);
          case 4:
            res = _context3.v;
            if (res.ok) {
              _context3.n = 5;
              break;
            }
            return _context3.a(3, 9);
          case 5:
            _context3.n = 6;
            return res.json();
          case 6:
            data = _context3.v;
            text = String((data === null || data === void 0 || (_data$candidates = data.candidates) === null || _data$candidates === void 0 || (_data$candidates = _data$candidates[0]) === null || _data$candidates === void 0 || (_data$candidates = _data$candidates.content) === null || _data$candidates === void 0 || (_data$candidates = _data$candidates.parts) === null || _data$candidates === void 0 || (_data$candidates = _data$candidates[0]) === null || _data$candidates === void 0 ? void 0 : _data$candidates.text) || '').trim();
            if (!text) {
              _context3.n = 7;
              break;
            }
            if (typeof incrementApiUsage === 'function') {
              try {
                incrementApiUsage(model.includes('lite') ? 'lite' : 'flash');
              } catch (_) {}
            }
            return _context3.a(2, {
              text: text.replace(/\s+/g, ' '),
              source: model
            });
          case 7:
            _context3.n = 9;
            break;
          case 8:
            _context3.p = 8;
            _t = _context3.v;
            if (!((_t === null || _t === void 0 ? void 0 : _t.name) === 'AbortError')) {
              _context3.n = 9;
              break;
            }
            throw _t;
          case 9:
            _i++;
            _context3.n = 2;
            break;
          case 10:
            return _context3.a(2, null);
        }
      }, _callee3, null, [[3, 8]]);
    }));
    return _fetchGeminiWeatherText.apply(this, arguments);
  }
  function maybeGenerateWeatherAi(_x8, _x9, _x0, _x1, _x10) {
    return _maybeGenerateWeatherAi.apply(this, arguments);
  }
  function _maybeGenerateWeatherAi() {
    _maybeGenerateWeatherAi = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(entry, routeKey, rows, assessment, signal) {
      var _entry$data2;
      var force,
        apiKey,
        aiKey,
        ai,
        result,
        _entry$data3,
        _args4 = arguments,
        _t2;
      return _regenerator().w(function (_context4) {
        while (1) switch (_context4.p = _context4.n) {
          case 0:
            force = _args4.length > 5 && _args4[5] !== undefined ? _args4[5] : false;
            apiKey = getGeminiApiKey();
            if (!(!apiKey || !(rows !== null && rows !== void 0 && rows.length))) {
              _context4.n = 1;
              break;
            }
            return _context4.a(2);
          case 1:
            aiKey = weatherAiCacheKey(routeKey, rows);
            ai = ((_entry$data2 = entry.data) === null || _entry$data2 === void 0 ? void 0 : _entry$data2.ai) || {};
            if (!(!force && entry.aiKey === aiKey && Date.now() - entry.aiUpdatedAt < WEATHER_AI_CACHE_TTL_MS && (ai.text || ai.error))) {
              _context4.n = 2;
              break;
            }
            return _context4.a(2);
          case 2:
            entry.aiKey = aiKey;
            entry.aiLoading = true;
            entry.data.ai = _objectSpread(_objectSpread({}, ai), {}, {
              loading: true,
              error: '',
              text: force ? '' : ai.text || '',
              source: ai.source || ''
            });
            if (state.view === 'weather') render();
            _context4.p = 3;
            _context4.n = 4;
            return fetchGeminiWeatherText(rows, assessment, signal);
          case 4:
            result = _context4.v;
            if (result !== null && result !== void 0 && result.text) {
              entry.data.ai = {
                loading: false,
                error: '',
                text: result.text,
                source: result.source
              };
              entry.aiUpdatedAt = Date.now();
            } else {
              entry.data.ai = {
                loading: false,
                error: 'KI-Einschätzung nicht verfügbar.',
                text: '',
                source: ''
              };
              entry.aiUpdatedAt = Date.now();
            }
            _context4.n = 6;
            break;
          case 5:
            _context4.p = 5;
            _t2 = _context4.v;
            if ((_t2 === null || _t2 === void 0 ? void 0 : _t2.name) !== 'AbortError') {
              entry.data.ai = {
                loading: false,
                error: 'KI-Einschätzung konnte nicht geladen werden.',
                text: '',
                source: ''
              };
              entry.aiUpdatedAt = Date.now();
            }
          case 6:
            _context4.p = 6;
            entry.aiLoading = false;
            if ((_entry$data3 = entry.data) !== null && _entry$data3 !== void 0 && (_entry$data3 = _entry$data3.ai) !== null && _entry$data3 !== void 0 && _entry$data3.loading) entry.data.ai.loading = false;
            if (state.view === 'weather') render();
            return _context4.f(6);
          case 7:
            return _context4.a(2);
        }
      }, _callee4, null, [[3, 5, 6, 7]]);
    }));
    return _maybeGenerateWeatherAi.apply(this, arguments);
  }
  function ensureWeatherTool() {
    return _ensureWeatherTool.apply(this, arguments);
  }
  function _ensureWeatherTool() {
    _ensureWeatherTool = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5() {
      var _window$gaChecklistHo11, _window$gaChecklistHo12;
      var force,
        key,
        entry,
        _entry$data4,
        _entry$data5,
        _entry$controller,
        samples,
        routeMetars,
        openMeteo,
        dep,
        dest,
        rows,
        assessment,
        _args5 = arguments,
        _t3,
        _t4,
        _t5;
      return _regenerator().w(function (_context5) {
        while (1) switch (_context5.p = _context5.n) {
          case 0:
            force = _args5.length > 0 && _args5[0] !== undefined ? _args5[0] : false;
            key = getRouteKey();
            entry = toolState.weather;
            if (!(!force && isCacheFresh(entry, key))) {
              _context5.n = 2;
              break;
            }
            _context5.n = 1;
            return maybeGenerateWeatherAi(entry, key, ((_entry$data4 = entry.data) === null || _entry$data4 === void 0 ? void 0 : _entry$data4.rows) || [], ((_entry$data5 = entry.data) === null || _entry$data5 === void 0 ? void 0 : _entry$data5.assessment) || null, null, false);
          case 1:
            return _context5.a(2);
          case 2:
            if (!(entry.loading && entry.key === key && !force)) {
              _context5.n = 3;
              break;
            }
            return _context5.a(2);
          case 3:
            abortToolRequest('weather');
            entry.loading = true;
            entry.key = key;
            entry.error = '';
            entry.controller = ((_window$gaChecklistHo11 = window.gaChecklistHost) === null || _window$gaChecklistHo11 === void 0 || (_window$gaChecklistHo12 = _window$gaChecklistHo11.createAbortController) === null || _window$gaChecklistHo12 === void 0 ? void 0 : _window$gaChecklistHo12.call(_window$gaChecklistHo11)) || new AbortController();
            if (state.view === 'weather') render();
            _context5.p = 4;
            samples = pickRouteSamplePoints(5);
            routeMetars = [];
            if (!samples.length) {
              _context5.n = 8;
              break;
            }
            _context5.p = 5;
            _context5.n = 6;
            return fetchRouteMetarsForWeather(samples, entry.controller.signal);
          case 6:
            routeMetars = _context5.v;
            _context5.n = 8;
            break;
          case 7:
            _context5.p = 7;
            _t3 = _context5.v;
            routeMetars = [];
          case 8:
            openMeteo = [];
            if (!(samples.length && typeof window.fetchOpenMeteoWeatherPoints === 'function')) {
              _context5.n = 12;
              break;
            }
            _context5.p = 9;
            _context5.n = 10;
            return window.fetchOpenMeteoWeatherPoints(samples.map(p => ({
              lat: p.lat,
              lon: p.lon
            })), {
              signal: entry.controller.signal,
              includePressure: true,
              maxConcurrency: 2
            });
          case 10:
            openMeteo = _context5.v;
            _context5.n = 12;
            break;
          case 11:
            _context5.p = 11;
            _t4 = _context5.v;
            openMeteo = [];
          case 12:
            dep = getCurrentAirport('dep');
            dest = getCurrentAirport('dest');
            rows = samples.map((p, idx) => {
              var label = idx === 0 ? 'Start' : idx === samples.length - 1 ? 'Ziel' : `Route ${idx}`;
              var icao = idx === 0 ? dep.icao : idx === samples.length - 1 ? dest.icao : '';
              var cached = weatherFromMetarCache(icao) || nearestMetarWeatherPoint(p.lat, p.lon, routeMetars) || nearestCachedWeatherPoint(p.lat, p.lon);
              var fromOm = weatherFromOpenMeteo(openMeteo[idx]);
              return _objectSpread({
                label,
                name: p.name || icao || label,
                lat: p.lat,
                lon: p.lon,
                generatedAt: Date.now()
              }, mergeWeatherSources(cached, fromOm));
            });
            assessment = buildWeatherAssessment(rows);
            entry.data = {
              rows,
              assessment,
              generatedAt: Date.now(),
              ai: null
            };
            entry.updatedAt = Date.now();
            entry.loading = false;
            if (state.view === 'weather') render();
            _context5.n = 13;
            return maybeGenerateWeatherAi(entry, key, rows, assessment, (_entry$controller = entry.controller) === null || _entry$controller === void 0 ? void 0 : _entry$controller.signal, force);
          case 13:
            _context5.n = 15;
            break;
          case 14:
            _context5.p = 14;
            _t5 = _context5.v;
            if ((_t5 === null || _t5 === void 0 ? void 0 : _t5.name) !== 'AbortError') entry.error = 'Wetterdaten konnten nicht geladen werden.';
          case 15:
            _context5.p = 15;
            entry.loading = false;
            entry.controller = null;
            if (state.view === 'weather') render();
            return _context5.f(15);
          case 16:
            return _context5.a(2);
        }
      }, _callee5, null, [[9, 11], [5, 7], [4, 14, 15, 16]]);
    }));
    return _ensureWeatherTool.apply(this, arguments);
  }
  function renderWeatherTool() {
    setTitle('Wetter');
    var entry = toolState.weather;
    var data = entry.data;
    var rows = (data === null || data === void 0 ? void 0 : data.rows) || [];
    var assessment = data === null || data === void 0 ? void 0 : data.assessment;
    var ai = (data === null || data === void 0 ? void 0 : data.ai) || null;
    var body = rows.length ? rows.map(row => renderWeatherStation(row)).join('') : renderToolEmpty(entry.loading ? 'Wetter wird sparsam geladen...' : 'Keine Route für Wetterübersicht gefunden.');
    bodyEl.innerHTML = `
            ${toolTopline('weather')}
            ${assessment ? `
                <div class="route-tool-summary is-${escapeAttr(assessment.tone)}">
                    <div class="route-tool-summary-label">${escapeHtml(assessment.label)}</div>
                    <div class="route-tool-summary-text">${escapeHtml(assessment.text)}</div>
                </div>
            ` : ''}
            ${ai && (ai.loading || ai.text || ai.error) ? `
                <div class="route-tool-ai">
                    <div class="route-tool-summary-label">KI-Einschätzung</div>
                    <div class="route-tool-summary-text">${escapeHtml(ai.loading ? 'KI formuliert die Lage...' : ai.text || ai.error || '')}</div>
                    ${ai.source ? `<div class="route-tool-row-meta">${escapeHtml(ai.source)}</div>` : ''}
                </div>
            ` : ''}
            ${entry.error ? `<div class="route-tool-warning">${escapeHtml(entry.error)}</div>` : ''}
            <div class="route-tool-list">${body}</div>
        `;
  }
  function airspaceFreqRows() {
    try {
      if (typeof activeAirspaces === 'undefined' || !Array.isArray(activeAirspaces)) return [];
      return activeAirspaces.map((as, idx) => ({
        as,
        idx
      })).filter(row => {
        var _row$as;
        return Array.isArray((_row$as = row.as) === null || _row$as === void 0 ? void 0 : _row$as.frequencies) && row.as.frequencies.length > 0;
      }).slice(0, 18).map(row => ({
        idx: row.idx,
        title: row.as.name || 'Luftraum',
        meta: `Enroute · ${row.as.type === 33 ? 'FIS' : 'Luftraum'}`,
        values: row.as.frequencies.slice(0, 3).map(f => `${f.name || f.label || 'INFO'} ${f.value}`).join(' · ')
      }));
    } catch (_) {
      return [];
    }
  }
  function getProblemAirspaces() {
    try {
      if (typeof activeAirspaces === 'undefined' || !Array.isArray(activeAirspaces)) return [];
      return activeAirspaces.map((as, idx) => ({
        as,
        idx
      })).filter(row => row.as && row.as.type !== 33);
    } catch (_) {
      return [];
    }
  }
  function airspaceStyleForDrawer(as) {
    if (typeof getAirspaceStyle === 'function') return getAirspaceStyle(as);
    return {
      color: 'var(--drawer-warn)',
      icon: '⚠️',
      category: 'Luftraum'
    };
  }
  function airspaceNameForDrawer(as) {
    if (typeof getAirspaceDisplayName === 'function') return getAirspaceDisplayName(as);
    return (as === null || as === void 0 ? void 0 : as.name) || 'Luftraum';
  }
  function formatAirspaceLimit(lim) {
    if (!lim) return '?';
    var value = lim.value;
    if (lim.referenceDatum === 0 && Number(value) === 0) return 'GND';
    if (lim.unit === 6) return `FL ${value}`;
    var unit = lim.unit === 1 ? 'FT' : lim.unit === 0 ? 'M' : '';
    var datum = lim.referenceDatum === 1 ? ' MSL' : lim.referenceDatum === 0 ? ' AGL' : '';
    return `${value} ${unit}${datum}`.trim();
  }
  function airspaceLimitText(as) {
    if (!(as !== null && as !== void 0 && as.lowerLimit) && !(as !== null && as !== void 0 && as.upperLimit)) return '';
    return `${formatAirspaceLimit(as.lowerLimit)} – ${formatAirspaceLimit(as.upperLimit)}`;
  }
  function airspaceFrequencyText(as) {
    var freqs = Array.isArray(as === null || as === void 0 ? void 0 : as.frequencies) ? as.frequencies : [];
    return freqs.slice(0, 3).map(f => `${f.name || f.label || 'INFO'} ${f.value}`).join(' · ');
  }
  function locateButton(action) {
    var attrs = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';
    var label = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'Auf Karte zeigen';
    return `<button class="route-tool-locate-btn" type="button" data-action="${escapeAttr(action)}" ${attrs} title="${escapeAttr(label)}" aria-label="${escapeAttr(label)}">🔎</button>`;
  }
  function ensureWarningsTool() {
    return _ensureWarningsTool.apply(this, arguments);
  }
  function _ensureWarningsTool() {
    _ensureWarningsTool = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee6() {
      var force,
        route,
        entry,
        key,
        hasAirspaces,
        _args6 = arguments,
        _t6;
      return _regenerator().w(function (_context6) {
        while (1) switch (_context6.p = _context6.n) {
          case 0:
            force = _args6.length > 0 && _args6[0] !== undefined ? _args6[0] : false;
            route = getRoutePoints();
            entry = toolState.warnings;
            key = `warnings:${getRouteKey()}:${window._activeAirspacesVersion || 0}`;
            if (!(!route.length || route.length < 2)) {
              _context6.n = 1;
              break;
            }
            entry.data = null;
            entry.error = 'Keine Route. Warnungen werden entlang der geplanten Route bewertet.';
            entry.loading = false;
            if (state.view === 'warnings') render();
            return _context6.a(2);
          case 1:
            if (!(!force && isCacheFresh(entry, key))) {
              _context6.n = 2;
              break;
            }
            return _context6.a(2);
          case 2:
            if (!(entry.loading && !force)) {
              _context6.n = 3;
              break;
            }
            return _context6.a(2);
          case 3:
            abortToolRequest('warnings');
            entry.loading = true;
            entry.key = key;
            entry.error = '';
            if (state.view === 'warnings') render();
            _context6.p = 4;
            hasAirspaces = typeof activeAirspaces !== 'undefined' && Array.isArray(activeAirspaces) && activeAirspaces.length;
            if (!((force || !hasAirspaces) && typeof fetchRouteAirspaces === 'function')) {
              _context6.n = 5;
              break;
            }
            _context6.n = 5;
            return fetchRouteAirspaces(route.map(p => ({
              lat: p.lat,
              lng: p.lon
            })));
          case 5:
            entry.data = {
              count: getProblemAirspaces().length,
              generatedAt: Date.now()
            };
            entry.updatedAt = Date.now();
            entry.key = `warnings:${getRouteKey()}:${window._activeAirspacesVersion || 0}`;
            _context6.n = 7;
            break;
          case 6:
            _context6.p = 6;
            _t6 = _context6.v;
            entry.error = 'Luftraum-Warnungen konnten nicht geladen werden.';
          case 7:
            _context6.p = 7;
            entry.loading = false;
            if (state.view === 'warnings') render();
            return _context6.f(7);
          case 8:
            return _context6.a(2);
        }
      }, _callee6, null, [[4, 6, 7, 8]]);
    }));
    return _ensureWarningsTool.apply(this, arguments);
  }
  function renderWarningsTool() {
    setTitle('Warnungen');
    var entry = toolState.warnings;
    var rows = getProblemAirspaces();
    var list = rows.length ? rows.map(row => {
      var style = airspaceStyleForDrawer(row.as);
      var limit = airspaceLimitText(row.as);
      var freqs = airspaceFrequencyText(row.as);
      return `
                <div class="route-tool-row route-tool-warning-row" style="--airspace-color:${escapeAttr(style.color || 'var(--drawer-warn)')}">
                    <div class="route-tool-row-main">
                        <div class="route-tool-row-title"><span class="route-tool-airspace-dot"></span>${escapeHtml(style.icon || '⚠️')} ${escapeHtml(airspaceNameForDrawer(row.as))}</div>
                        <div class="route-tool-row-meta">${escapeHtml(style.category || 'Luftraum')}${limit ? ` · ${escapeHtml(limit)}` : ''}</div>
                        ${freqs ? `<div class="route-tool-row-value">${escapeHtml(freqs)}</div>` : ''}
                    </div>
                    <div class="route-tool-row-actions">
                        ${locateButton('locate-airspace', `data-as-idx="${escapeAttr(row.idx)}"`, 'Luftraum auf Karte zeigen')}
                    </div>
                </div>
            `;
    }).join('') : renderToolEmpty(entry.loading ? 'Lufträume werden geladen...' : 'Keine problematischen Lufträume entlang der Route gefunden.');
    bodyEl.innerHTML = `
            ${toolTopline('warnings')}
            ${entry.error && !entry.loading ? `<div class="route-tool-warning">${escapeHtml(entry.error)}</div>` : ''}
            <div class="route-tool-list">${list}</div>
        `;
  }
  function distancePointToRouteNm(lat, lon, routePts) {
    if (!routePts.length) return Infinity;
    var best = Infinity;
    routePts.forEach(p => {
      best = Math.min(best, navBetween(lat, lon, p.lat, p.lon).dist);
    });
    return best;
  }
  function fetchRouteOpenAip(_x11, _x12, _x13, _x14) {
    return _fetchRouteOpenAip.apply(this, arguments);
  }
  function _fetchRouteOpenAip() {
    _fetchRouteOpenAip = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee7(path, bounds, limit, signal) {
      var bbox, data;
      return _regenerator().w(function (_context7) {
        while (1) switch (_context7.n) {
          case 0:
            if (bounds) {
              _context7.n = 1;
              break;
            }
            return _context7.a(2, []);
          case 1:
            bbox = `${bounds.minLon},${bounds.minLat},${bounds.maxLon},${bounds.maxLat}`;
            _context7.n = 2;
            return fetchJson(`${ROUTE_TOOLS_PROXY}/api/${path}?bbox=${encodeURIComponent(bbox)}&limit=${limit}&t=${Date.now()}`, signal);
          case 2:
            data = _context7.v;
            return _context7.a(2, Array.isArray(data === null || data === void 0 ? void 0 : data.items) ? data.items : []);
        }
      }, _callee7);
    }));
    return _fetchRouteOpenAip.apply(this, arguments);
  }
  function ensureRadioTool() {
    return _ensureRadioTool.apply(this, arguments);
  }
  function _ensureRadioTool() {
    _ensureRadioTool = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee8() {
      var _window$gaChecklistHo13, _window$gaChecklistHo14;
      var force,
        key,
        entry,
        route,
        dep,
        dest,
        hasAirspaces,
        bounds,
        airports,
        navaids,
        _yield$Promise$all,
        _yield$Promise$all2,
        aptItems,
        navItems,
        _args8 = arguments,
        _t7,
        _t8;
      return _regenerator().w(function (_context8) {
        while (1) switch (_context8.p = _context8.n) {
          case 0:
            force = _args8.length > 0 && _args8[0] !== undefined ? _args8[0] : false;
            key = getRouteKey();
            entry = toolState.radio;
            if (!(!force && isCacheFresh(entry, key))) {
              _context8.n = 1;
              break;
            }
            return _context8.a(2);
          case 1:
            if (!(entry.loading && entry.key === key && !force)) {
              _context8.n = 2;
              break;
            }
            return _context8.a(2);
          case 2:
            abortToolRequest('radio');
            entry.loading = true;
            entry.key = key;
            entry.error = '';
            entry.controller = ((_window$gaChecklistHo13 = window.gaChecklistHost) === null || _window$gaChecklistHo13 === void 0 || (_window$gaChecklistHo14 = _window$gaChecklistHo13.createAbortController) === null || _window$gaChecklistHo14 === void 0 ? void 0 : _window$gaChecklistHo14.call(_window$gaChecklistHo13)) || new AbortController();
            if (state.view === 'radio') render();
            _context8.p = 3;
            route = getRoutePoints();
            dep = getCurrentAirport('dep');
            dest = getCurrentAirport('dest');
            if (dep.icao && typeof fetchAirportFreq === 'function' && !getFreqLines(dep.icao).length) fetchAirportFreq(dep.icao, null, 'dep').catch(() => null);
            if (dest.icao && typeof fetchAirportFreq === 'function' && !getFreqLines(dest.icao).length) fetchAirportFreq(dest.icao, null, 'dest').catch(() => null);
            if (!(route.length >= 2 && typeof fetchRouteAirspaces === 'function')) {
              _context8.n = 7;
              break;
            }
            _context8.p = 4;
            hasAirspaces = typeof activeAirspaces !== 'undefined' && Array.isArray(activeAirspaces) && activeAirspaces.length;
            if (!(force || !hasAirspaces)) {
              _context8.n = 5;
              break;
            }
            _context8.n = 5;
            return fetchRouteAirspaces(route.map(p => ({
              lat: p.lat,
              lng: p.lon
            })));
          case 5:
            _context8.n = 7;
            break;
          case 6:
            _context8.p = 6;
            _t7 = _context8.v;
          case 7:
            bounds = routeBounds(route, 10);
            airports = [];
            navaids = [];
            if (!(bounds && route.length >= 2)) {
              _context8.n = 9;
              break;
            }
            _context8.n = 8;
            return Promise.all([fetchRouteOpenAip('airports', bounds, 120, entry.controller.signal).catch(() => []), fetchRouteOpenAip('navaids', bounds, 120, entry.controller.signal).catch(() => [])]);
          case 8:
            _yield$Promise$all = _context8.v;
            _yield$Promise$all2 = _slicedToArray(_yield$Promise$all, 2);
            aptItems = _yield$Promise$all2[0];
            navItems = _yield$Promise$all2[1];
            airports = aptItems.map(normalizeToolAirport).filter(a => (a === null || a === void 0 ? void 0 : a.icao) && Number.isFinite(a.lat) && Number.isFinite(a.lon) && a.icao !== dep.icao && a.icao !== dest.icao).map(a => _objectSpread(_objectSpread({}, a), {}, {
              routeDist: distancePointToRouteNm(a.lat, a.lon, route)
            })).filter(a => a.routeDist <= 8).sort((a, b) => a.routeDist - b.routeDist).slice(0, 10);
            airports.forEach(a => {
              if (typeof fetchAirportFreq === 'function' && a.icao && !getFreqLines(a.icao).length) {
                fetchAirportFreq(a.icao, null, null).catch(() => null);
              }
            });
            if (airports.length) setTimeout(() => {
              if (state.view === 'radio') render();
            }, 1100);
            navaids = navItems.filter(n => {
              var _n$geometry;
              return n === null || n === void 0 || (_n$geometry = n.geometry) === null || _n$geometry === void 0 ? void 0 : _n$geometry.coordinates;
            }).map(n => {
              var _n$frequency, _n$frequencies;
              var lat = Number(n.geometry.coordinates[1]),
                lon = Number(n.geometry.coordinates[0]);
              var freq = ((_n$frequency = n.frequency) === null || _n$frequency === void 0 ? void 0 : _n$frequency.value) || n.frequency || ((_n$frequencies = n.frequencies) === null || _n$frequencies === void 0 || (_n$frequencies = _n$frequencies[0]) === null || _n$frequencies === void 0 ? void 0 : _n$frequencies.value) || '';
              return {
                name: n.name || n.identifier || 'Funkfeuer',
                ident: n.identifier || n.designator || '',
                lat,
                lon,
                freq,
                routeDist: distancePointToRouteNm(lat, lon, route)
              };
            }).filter(n => Number.isFinite(n.lat) && Number.isFinite(n.lon) && n.routeDist <= 12).sort((a, b) => a.routeDist - b.routeDist).slice(0, 10);
          case 9:
            entry.data = {
              dep,
              dest,
              airports,
              navaids,
              generatedAt: Date.now()
            };
            entry.updatedAt = Date.now();
            _context8.n = 11;
            break;
          case 10:
            _context8.p = 10;
            _t8 = _context8.v;
            if ((_t8 === null || _t8 === void 0 ? void 0 : _t8.name) !== 'AbortError') entry.error = 'Radio-Daten konnten nicht geladen werden.';
          case 11:
            _context8.p = 11;
            entry.loading = false;
            entry.controller = null;
            if (state.view === 'radio') render();
            return _context8.f(11);
          case 12:
            return _context8.a(2);
        }
      }, _callee8, null, [[4, 6], [3, 10, 11, 12]]);
    }));
    return _ensureRadioTool.apply(this, arguments);
  }
  function renderAirportContext(key, apt) {
    if (!(apt !== null && apt !== void 0 && apt.icao)) return '';
    var encoded = encodeURIComponent(JSON.stringify(apt));
    return state.radioAirportMenuKey === key ? `
            <div class="route-tool-context">
                <button class="checklist-mini-btn primary" type="button" data-action="nearest-direct" data-airport="${escapeAttr(encoded)}">Direct To</button>
                <button class="checklist-mini-btn" type="button" data-action="airport-info" data-airport="${escapeAttr(encoded)}">Info</button>
                <button class="checklist-mini-btn" type="button" data-action="locate-airport" data-airport="${escapeAttr(encoded)}">🔎 Karte</button>
            </div>
        ` : '';
  }
  function renderFreqBlock(label, apt) {
    var menuKey = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';
    var freqs = getFreqLines(apt === null || apt === void 0 ? void 0 : apt.icao);
    var heading = apt !== null && apt !== void 0 && apt.icao ? `${label} · ${apt.icao}` : label;
    var key = menuKey || `radio_${String(label || '').toLowerCase()}_${(apt === null || apt === void 0 ? void 0 : apt.icao) || 'none'}`;
    var canOpenMenu = !!(apt !== null && apt !== void 0 && apt.icao);
    return `
            <div class="route-tool-section">
                ${canOpenMenu ? `
                    <button class="route-tool-airport-main route-tool-airport-main-heading" type="button" data-action="radio-airport-menu" data-key="${escapeAttr(key)}">
                        <span>
                            <span class="route-tool-section-title">${escapeHtml(heading)}</span>
                            <span class="route-tool-section-sub">${escapeHtml((apt === null || apt === void 0 ? void 0 : apt.name) || '')}</span>
                        </span>
                        <span class="checklist-tool-arrow" aria-hidden="true">›</span>
                    </button>
                    ${renderAirportContext(key, apt)}
                ` : `
                    <div class="route-tool-section-title">${escapeHtml(heading)}</div>
                    <div class="route-tool-section-sub">${escapeHtml((apt === null || apt === void 0 ? void 0 : apt.name) || '')}</div>
                `}
                ${freqs.length ? freqs.map(f => `<div class="route-tool-freq"><span>${escapeHtml(f.label)}</span><b>${escapeHtml(f.value)}</b></div>`).join('') : renderToolEmpty('Noch keine Frequenzen im Cache. Aktualisieren lädt nach.')}
            </div>
        `;
  }
  function renderRadioTool() {
    var _data$dep, _data$airports, _data$navaids, _data$dest;
    setTitle('Radio');
    var entry = toolState.radio;
    var data = entry.data;
    var airRows = airspaceFreqRows();
    bodyEl.innerHTML = `
            ${toolTopline('radio')}
            ${entry.error ? `<div class="route-tool-warning">${escapeHtml(entry.error)}</div>` : ''}
            ${data ? renderFreqBlock('Start', data.dep, `radio_start_${((_data$dep = data.dep) === null || _data$dep === void 0 ? void 0 : _data$dep.icao) || 'none'}`) : ''}
            <div class="route-tool-section">
                <div class="route-tool-section-title">Enroute / FIS</div>
                ${airRows.length ? airRows.map(r => `
                    <div class="route-tool-row route-tool-locatable-row">
                        <div class="route-tool-row-main">
                            <div class="route-tool-row-title">${escapeHtml(r.title)}</div>
                            <div class="route-tool-row-meta">${escapeHtml(r.meta)}</div>
                            <div class="route-tool-row-value">${escapeHtml(r.values)}</div>
                        </div>
                        <div class="route-tool-row-actions">
                            ${locateButton('locate-airspace', `data-as-idx="${escapeAttr(r.idx)}"`, 'Luftraum auf Karte zeigen')}
                        </div>
                    </div>
                `).join('') : renderToolEmpty(entry.loading ? 'Lufträume/FIS werden geladen...' : 'Keine Enroute-Frequenzen gefunden.')}
            </div>
            <div class="route-tool-section">
                <div class="route-tool-section-title">Plätze entlang der Route</div>
                ${data !== null && data !== void 0 && (_data$airports = data.airports) !== null && _data$airports !== void 0 && _data$airports.length ? data.airports.map(a => {
      var freqs = getFreqLines(a.icao).slice(0, 3);
      var key = `radio_${a.icao}_${Math.round(a.routeDist * 10)}`;
      var open = state.radioAirportMenuKey === key;
      return `<div class="route-tool-row route-tool-radio-airport">
                        <button class="route-tool-airport-main" type="button" data-action="radio-airport-menu" data-key="${escapeAttr(key)}">
                            <span>
                                <span class="route-tool-row-title">${escapeHtml(a.icao)} · ${escapeHtml(a.name)}</span>
                                <span class="route-tool-row-meta">${fmtNm(a.routeDist)} NM neben Route</span>
                            </span>
                            <span class="checklist-tool-arrow" aria-hidden="true">›</span>
                        </button>
                        ${freqs.length ? `<div class="route-tool-radio-freqs">${freqs.map(f => `<span>${escapeHtml(f.label)} <b>${escapeHtml(f.value)}</b></span>`).join('')}</div>` : '<div class="route-tool-row-meta">Frequenzen werden bei Bedarf geladen.</div>'}
                        ${open ? renderAirportContext(key, a) : ''}
                    </div>`;
    }).join('') : renderToolEmpty(entry.loading ? 'Nahe Plätze werden geladen...' : 'Keine nahen Plätze gefunden.')}
            </div>
            <div class="route-tool-section">
                <div class="route-tool-section-title">Funkfeuer</div>
                ${data !== null && data !== void 0 && (_data$navaids = data.navaids) !== null && _data$navaids !== void 0 && _data$navaids.length ? data.navaids.map(n => `<div class="route-tool-row"><div class="route-tool-row-title">${escapeHtml(n.ident || '')} ${escapeHtml(n.name)}</div><div class="route-tool-row-meta">${fmtNm(n.routeDist)} NM neben Route${n.freq ? ` · ${escapeHtml(n.freq)}` : ''}</div></div>`).join('') : renderToolEmpty(entry.loading ? 'Funkfeuer werden geladen...' : 'Keine Funkfeuer entlang der Route gefunden.')}
            </div>
            ${data ? renderFreqBlock('Ziel', data.dest, `radio_dest_${((_data$dest = data.dest) === null || _data$dest === void 0 ? void 0 : _data$dest.icao) || 'none'}`) : renderToolEmpty(entry.loading ? 'Radio-Daten werden geladen...' : 'Keine Radio-Daten.')}
        `;
  }
  function ensurePlaceTool() {
    var force = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
    var key = `${getCurrentAirport('dep').icao}|${getCurrentAirport('dest').icao}|${getRouteKey()}`;
    var entry = toolState.place;
    if (!force && isCacheFresh(entry, key, TOOL_CACHE_TTL_MS)) return;
    entry.key = key;
    entry.updatedAt = Date.now();
    entry.data = {
      dep: getCurrentAirport('dep'),
      dest: getCurrentAirport('dest')
    };
    var airports = [entry.data.dep, entry.data.dest].filter(a => (a === null || a === void 0 ? void 0 : a.icao) && /^[A-Z0-9]{4}$/.test(a.icao));
    airports.forEach((apt, idx) => {
      if (typeof fetchAirportFreq === 'function' && !getFreqLines(apt.icao).length) fetchAirportFreq(apt.icao, null, idx === 0 ? 'dep' : 'dest').catch(() => null);
      if (typeof fetchRunwayDetails === 'function' && !getRunwayText(apt.icao) && Number.isFinite(apt.lat) && Number.isFinite(apt.lon)) {
        var id = `routeToolHiddenRwy_${apt.icao}`;
        var hidden = document.getElementById(id);
        if (!hidden) {
          hidden = document.createElement('div');
          hidden.id = id;
          hidden.style.display = 'none';
          document.body.appendChild(hidden);
        }
        fetchRunwayDetails(apt.lat, apt.lon, id, apt.icao).catch(() => null);
      }
    });
    if (state.view === 'place') setTimeout(() => {
      if (state.view === 'place') render();
    }, 800);
  }
  function placeMapId(label, apt) {
    var raw = `${label}_${(apt === null || apt === void 0 ? void 0 : apt.icao) || (apt === null || apt === void 0 ? void 0 : apt.name) || ''}_${Number((apt === null || apt === void 0 ? void 0 : apt.lat) || 0).toFixed(3)}_${Number((apt === null || apt === void 0 ? void 0 : apt.lon) || 0).toFixed(3)}`;
    return `routeToolMap_${raw.replace(/[^\w-]/g, '_')}`;
  }
  function placeWeatherId(label, apt) {
    var raw = `${label}_${(apt === null || apt === void 0 ? void 0 : apt.icao) || (apt === null || apt === void 0 ? void 0 : apt.name) || ''}_${Number((apt === null || apt === void 0 ? void 0 : apt.lat) || 0).toFixed(3)}_${Number((apt === null || apt === void 0 ? void 0 : apt.lon) || 0).toFixed(3)}`;
    return `routeToolWx_${raw.replace(/[^\w-]/g, '_')}`;
  }
  function getPlaceMapState() {
    var fallback = {
      sat: false,
      vfr: true
    };
    try {
      var value = localStorage.getItem(PLACE_MAP_MODE_KEY);
      if (!value) return fallback;
      if (value === 'sat') return {
        sat: true,
        vfr: true
      };
      if (value === 'vfr') return fallback;
      var parsed = JSON.parse(value);
      return {
        sat: !!(parsed !== null && parsed !== void 0 && parsed.sat),
        vfr: (parsed === null || parsed === void 0 ? void 0 : parsed.vfr) !== false
      };
    } catch (_) {
      return fallback;
    }
  }
  function setPlaceMapState(nextState) {
    var state = {
      sat: !!(nextState !== null && nextState !== void 0 && nextState.sat),
      vfr: (nextState === null || nextState === void 0 ? void 0 : nextState.vfr) !== false
    };
    try {
      localStorage.setItem(PLACE_MAP_MODE_KEY, JSON.stringify(state));
    } catch (_) {}
    miniMaps.forEach(entry => setPlaceMapEntryState(entry, state));
    if (expandedPlaceMap) setPlaceMapEntryState(expandedPlaceMap, state);
    updatePlaceMapModeButtons(state);
  }
  function togglePlaceMapLayer(layer) {
    var state = getPlaceMapState();
    if (layer === 'sat') state.sat = !state.sat;else state.vfr = !state.vfr;
    setPlaceMapState(state);
  }
  function updatePlaceMapModeButtons() {
    var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : getPlaceMapState();
    if (!bodyEl) return;
    bodyEl.querySelectorAll('[data-action="place-map-layer"]').forEach(btn => {
      var active = btn.dataset.layer === 'sat' ? !!state.sat : !!state.vfr;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (expandedPlaceMapEl) {
      expandedPlaceMapEl.querySelectorAll('[data-place-map-modal-layer]').forEach(btn => {
        var active = btn.dataset.placeMapModalLayer === 'sat' ? !!state.sat : !!state.vfr;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
  }
  function makePlaceMapLayers() {
    if (typeof L === 'undefined') return null;
    return {
      topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'OpenTopoMap',
        maxZoom: 17
      }),
      sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri',
        maxZoom: 18
      }),
      aero: L.tileLayer('https://nwy-tiles-api.prod.newaydata.com/tiles/{z}/{x}/{y}.png?path=latest/aero/latest', {
        attribution: 'AeroData / NewayData',
        opacity: 0.68,
        maxNativeZoom: 12,
        maxZoom: 17
      })
    };
  }
  function setPlaceMapEntryState(entry) {
    var state = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : getPlaceMapState();
    if (!(entry !== null && entry !== void 0 && entry.map) || !entry.layers) return;
    var map = entry.map,
      layers = entry.layers;
    [layers.topo, layers.sat, layers.aero].forEach(layer => {
      if (layer && map.hasLayer(layer)) map.removeLayer(layer);
    });
    if (state.sat) {
      layers.sat.addTo(map);
    } else {
      layers.topo.addTo(map);
    }
    if (state.vfr) {
      layers.aero.addTo(map);
    }
    entry.state = {
      sat: !!state.sat,
      vfr: !!state.vfr
    };
  }
  function destroyPlaceMiniMaps() {
    miniMaps.forEach(entry => {
      try {
        entry.map.remove();
      } catch (_) {}
    });
    miniMaps.clear();
  }
  function buildPlaceLeafletMap(el, apt) {
    var _apt$lat, _apt$lon;
    var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    if (!el || typeof L === 'undefined') return null;
    var lat = Number((_apt$lat = apt === null || apt === void 0 ? void 0 : apt.lat) !== null && _apt$lat !== void 0 ? _apt$lat : el.dataset.lat);
    var lon = Number((_apt$lon = apt === null || apt === void 0 ? void 0 : apt.lon) !== null && _apt$lon !== void 0 ? _apt$lon : el.dataset.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      el.textContent = 'Keine Kartenposition';
      return null;
    }
    var interactive = !!options.interactive;
    var map = L.map(el, {
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      tap: interactive,
      attributionControl: false
    });
    var layers = makePlaceMapLayers();
    if (!layers) {
      el.textContent = 'Karte nicht verfügbar';
      return null;
    }
    var entry = {
      map,
      layers,
      state: getPlaceMapState(),
      apt
    };
    setPlaceMapEntryState(entry, getPlaceMapState());
    L.circleMarker([lat, lon], {
      radius: options.markerRadius || 6,
      color: '#101820',
      weight: 2,
      fillColor: '#ffda3a',
      fillOpacity: 1
    }).addTo(map);
    map.setView([lat, lon], options.zoom || 13);
    var resizeTimer = setTimeout(() => {
      if (el.isConnected) map.invalidateSize();
    }, 80);
    map.once('unload', () => clearTimeout(resizeTimer));
    return entry;
  }
  function initPlaceMiniMaps() {
    if (!bodyEl) return;
    bodyEl.querySelectorAll('.route-tool-place-map-host[data-airport]').forEach(el => {
      if (!el.id || miniMaps.has(el.id)) return;
      var apt = decodeAirportDataset(el);
      var entry = buildPlaceLeafletMap(el, apt, {
        zoom: 13,
        markerRadius: 5
      });
      if (entry) miniMaps.set(el.id, entry);
    });
    updatePlaceMapModeButtons();
  }
  function closeExpandedPlaceMap() {
    if (expandedPlaceMap) {
      try {
        expandedPlaceMap.map.remove();
      } catch (_) {}
    }
    expandedPlaceMap = null;
    if (expandedPlaceMapEl) expandedPlaceMapEl.remove();
    expandedPlaceMapEl = null;
  }
  function openExpandedPlaceMap(apt) {
    if (!apt) return;
    closeExpandedPlaceMap();
    var title = `${apt.icao || 'Platz'} · ${apt.name || 'Karte'}`;
    var wrapper = document.createElement('div');
    wrapper.className = 'route-tool-map-modal';
    wrapper.innerHTML = `
            <div class="route-tool-map-modal-panel" role="dialog" aria-modal="true" aria-label="${escapeAttr(title)}">
                <div class="route-tool-map-modal-head">
                    <div>
                        <div class="route-tool-place-label">Kartenausschnitt</div>
                        <div class="route-tool-place-title">${escapeHtml(title)}</div>
                    </div>
                    <div class="route-tool-map-modal-actions">
                        <button class="route-tool-map-toggle" type="button" data-place-map-modal-layer="vfr">VFR</button>
                        <button class="route-tool-map-toggle" type="button" data-place-map-modal-layer="sat">Sat</button>
                        <button class="route-tool-map-close" type="button" aria-label="Karte schließen">×</button>
                    </div>
                </div>
                <div id="routeToolExpandedPlaceMap" class="route-tool-expanded-map"></div>
            </div>
        `;
    document.body.appendChild(wrapper);
    expandedPlaceMapEl = wrapper;
    var mapHost = wrapper.querySelector('#routeToolExpandedPlaceMap');
    expandedPlaceMap = buildPlaceLeafletMap(mapHost, apt, {
      interactive: true,
      zoom: 14,
      markerRadius: 7
    });
    wrapper.addEventListener('click', event => {
      if (event.target === wrapper || event.target.closest('.route-tool-map-close')) {
        closeExpandedPlaceMap();
        return;
      }
      var layerButton = event.target.closest('[data-place-map-modal-layer]');
      if (layerButton) {
        togglePlaceMapLayer(layerButton.dataset.placeMapModalLayer);
      }
    });
    updatePlaceMapModeButtons();
  }
  function placeCard(label, apt) {
    var detailAction = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
    var coords = Number.isFinite(apt === null || apt === void 0 ? void 0 : apt.lat) && Number.isFinite(apt === null || apt === void 0 ? void 0 : apt.lon) ? `${apt.lat.toFixed(4)}, ${apt.lon.toFixed(4)}` : '—';
    var freqs = getFreqLines(apt === null || apt === void 0 ? void 0 : apt.icao).slice(0, 5);
    var rwy = getRunwayText(apt === null || apt === void 0 ? void 0 : apt.icao);
    var rwyRows = parseRunwayRows(rwy);
    var aip = getAipUrlForAirport(apt);
    var mapId = placeMapId(label, apt);
    var wxId = placeWeatherId(label, apt);
    var hasCoords = Number.isFinite(apt === null || apt === void 0 ? void 0 : apt.lat) && Number.isFinite(apt === null || apt === void 0 ? void 0 : apt.lon);
    var encoded = encodeURIComponent(JSON.stringify(apt || {}));
    var mapState = getPlaceMapState();
    return `
            <div class="route-tool-place-card">
                <div class="route-tool-place-head">
                    <div>
                        <div class="route-tool-place-label">${escapeHtml(label)}</div>
                        <div class="route-tool-place-title">${escapeHtml((apt === null || apt === void 0 ? void 0 : apt.icao) || '—')} · ${escapeHtml((apt === null || apt === void 0 ? void 0 : apt.name) || '—')}</div>
                    </div>
                    ${detailAction && apt !== null && apt !== void 0 && apt.icao ? `<button class="checklist-mini-btn route-tool-inline-btn" type="button" data-action="airport-info" data-airport="${escapeAttr(encoded)}">Info</button>` : ''}
                </div>
                <div class="route-tool-place-visual">
                    <div class="route-tool-place-map-shell">
                        <div class="route-tool-place-map-toolbar">
                            <button class="route-tool-map-toggle ${mapState.vfr ? 'is-active' : ''}" type="button" data-action="place-map-layer" data-layer="vfr" aria-pressed="${mapState.vfr ? 'true' : 'false'}">VFR</button>
                            <button class="route-tool-map-toggle ${mapState.sat ? 'is-active' : ''}" type="button" data-action="place-map-layer" data-layer="sat" aria-pressed="${mapState.sat ? 'true' : 'false'}">Sat</button>
                            ${hasCoords ? `<button class="route-tool-map-expand" type="button" data-action="place-map-expand" data-airport="${escapeAttr(encoded)}" aria-label="Karte vergrößern">⛶</button>` : ''}
                        </div>
                        <div id="${escapeAttr(mapId)}" class="route-tool-mini-map route-tool-place-map-host" data-airport="${escapeAttr(encoded)}" data-lat="${escapeAttr(apt === null || apt === void 0 ? void 0 : apt.lat)}" data-lon="${escapeAttr(apt === null || apt === void 0 ? void 0 : apt.lon)}">
                            <span>${hasCoords ? 'Karte lädt…' : 'Keine Kartenposition'}</span>
                        </div>
                    </div>
                    <div class="route-tool-place-facts">
                        <div class="route-tool-place-chip"><span>Koordinaten</span><b>${escapeHtml(coords)}</b></div>
                        <div class="route-tool-place-chip"><span>Elevation</span><b>${(apt === null || apt === void 0 ? void 0 : apt.elevation) != null ? `${Math.round(apt.elevation)} ft` : '—'}</b></div>
                    </div>
                </div>
                <div class="route-tool-place-block">
                    <div class="route-tool-place-block-title">Wetter</div>
                    <div id="${escapeAttr(wxId)}" class="route-tool-weather-widget">Wetter lädt bei Bedarf…</div>
                </div>
                <div class="route-tool-place-block">
                    <div class="route-tool-place-block-title">Pisten</div>
                    ${rwyRows.length ? rwyRows.map(row => `<div class="route-tool-runway-row"><span>${escapeHtml(row.ident)}</span><b>${escapeHtml(row.detail || 'Details offen')}</b></div>`).join('') : renderToolEmpty('Keine Pistendaten im Cache.')}
                </div>
                <div class="route-tool-place-block">
                    <div class="route-tool-place-block-title">Frequenzen</div>
                    ${freqs.length ? `<div class="route-tool-frequency-chips">${freqs.map(f => `<span>${escapeHtml(f.label)} <b>${escapeHtml(f.value)}</b></span>`).join('')}</div>` : renderToolEmpty('Keine Frequenzen im Cache.')}
                </div>
                ${aip ? `<a class="route-tool-link" data-action="airport-aip" data-airport="${escapeAttr(encoded)}" href="${escapeAttr(aip)}" target="_blank" rel="noopener noreferrer">AIP öffnen ↗</a>` : ''}
            </div>
        `;
  }
  function renderPlaceEnhancements() {
    initPlaceMiniMaps();
    Array.from(bodyEl.querySelectorAll('.route-tool-weather-widget')).forEach(el => {
      var _card$querySelector;
      if (el.dataset.loaded === 'true') return;
      var card = el.closest('.route-tool-place-card');
      var title = (card === null || card === void 0 || (_card$querySelector = card.querySelector('.route-tool-place-title')) === null || _card$querySelector === void 0 ? void 0 : _card$querySelector.textContent) || '';
      var code = (title.match(/\b[A-Z0-9]{4}\b/) || [''])[0];
      var mapEl = card === null || card === void 0 ? void 0 : card.querySelector('.route-tool-mini-map');
      var lat = Number(mapEl === null || mapEl === void 0 ? void 0 : mapEl.dataset.lat);
      var lon = Number(mapEl === null || mapEl === void 0 ? void 0 : mapEl.dataset.lon);
      if (typeof loadMetarWidget === 'function') {
        el.dataset.loaded = 'true';
        loadMetarWidget(code || null, el.id, lat, lon, true);
      }
    });
  }
  function renderPlaceTool() {
    setTitle('Platz');
    ensurePlaceTool(false);
    var data = toolState.place.data || {
      dep: getCurrentAirport('dep'),
      dest: getCurrentAirport('dest')
    };
    bodyEl.innerHTML = `
            ${toolTopline('place')}
            ${placeCard('Start', data.dep)}
            ${placeCard('Ziel', data.dest)}
        `;
    setTimeout(renderPlaceEnhancements, 0);
  }
  function ensureNearestTool() {
    return _ensureNearestTool.apply(this, arguments);
  }
  function _ensureNearestTool() {
    _ensureNearestTool = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee9() {
      var _window$gaChecklistHo15, _window$gaChecklistHo16;
      var force,
        origin,
        entry,
        originKey,
        movedNm,
        key,
        b,
        items,
        airports,
        _args9 = arguments,
        _t9;
      return _regenerator().w(function (_context9) {
        while (1) switch (_context9.p = _context9.n) {
          case 0:
            force = _args9.length > 0 && _args9[0] !== undefined ? _args9[0] : false;
            origin = getLiveAircraftPosition();
            entry = toolState.nearest;
            if (origin) {
              _context9.n = 1;
              break;
            }
            abortToolRequest('nearest');
            entry.data = null;
            entry.error = 'Keine frische Live-Position. Nearest nutzt bewusst nicht die Karte als Ersatz für das Flugzeug.';
            entry.loading = false;
            if (state.view === 'nearest') render();
            return _context9.a(2);
          case 1:
            originKey = `${origin.lat.toFixed(2)},${origin.lon.toFixed(2)}`;
            movedNm = entry.origin ? navBetween(entry.origin.lat, entry.origin.lon, origin.lat, origin.lon).dist : Infinity;
            key = `nearest:${originKey}`;
            if (!(!force && isCacheFresh(entry, entry.key, NEAREST_CACHE_TTL_MS) && movedNm < NEAREST_MOVE_REFRESH_NM)) {
              _context9.n = 2;
              break;
            }
            return _context9.a(2);
          case 2:
            if (!(entry.loading && !force)) {
              _context9.n = 3;
              break;
            }
            return _context9.a(2);
          case 3:
            abortToolRequest('nearest');
            entry.loading = true;
            entry.key = key;
            entry.origin = origin;
            entry.error = '';
            entry.controller = ((_window$gaChecklistHo15 = window.gaChecklistHost) === null || _window$gaChecklistHo15 === void 0 || (_window$gaChecklistHo16 = _window$gaChecklistHo15.createAbortController) === null || _window$gaChecklistHo16 === void 0 ? void 0 : _window$gaChecklistHo16.call(_window$gaChecklistHo15)) || new AbortController();
            if (state.view === 'nearest') render();
            _context9.p = 4;
            b = routeBounds([{
              lat: origin.lat,
              lon: origin.lon
            }], NEAREST_RADIUS_NM);
            _context9.n = 5;
            return fetchRouteOpenAip('airports', b, 250, entry.controller.signal);
          case 5:
            items = _context9.v;
            airports = items.map(normalizeToolAirport).filter(a => (a === null || a === void 0 ? void 0 : a.icao) && Number.isFinite(a.lat) && Number.isFinite(a.lon)).map(a => _objectSpread(_objectSpread({}, a), {}, {
              nav: navBetween(origin.lat, origin.lon, a.lat, a.lon)
            })).filter(a => a.nav.dist <= NEAREST_RADIUS_NM).sort((a, b) => a.nav.dist - b.nav.dist).slice(0, 30);
            entry.data = {
              origin,
              airports,
              generatedAt: Date.now()
            };
            entry.updatedAt = Date.now();
            _context9.n = 7;
            break;
          case 6:
            _context9.p = 6;
            _t9 = _context9.v;
            if ((_t9 === null || _t9 === void 0 ? void 0 : _t9.name) !== 'AbortError') entry.error = 'Nearest konnte nicht geladen werden.';
          case 7:
            _context9.p = 7;
            entry.loading = false;
            entry.controller = null;
            if (state.view === 'nearest') render();
            return _context9.f(7);
          case 8:
            return _context9.a(2);
        }
      }, _callee9, null, [[4, 6, 7, 8]]);
    }));
    return _ensureNearestTool.apply(this, arguments);
  }
  function renderNearestTool() {
    var _entry$data;
    setTitle('Nearest');
    var entry = toolState.nearest;
    var airports = ((_entry$data = entry.data) === null || _entry$data === void 0 ? void 0 : _entry$data.airports) || [];
    var list = entry.error && !entry.loading ? '' : airports.length ? airports.map((apt, index) => {
      var key = `${apt.icao}_${index}`;
      var open = state.nearestMenuKey === key;
      var encoded = encodeURIComponent(JSON.stringify(apt));
      return `
                <div class="route-tool-nearest">
                    <button class="route-tool-nearest-main" type="button" data-action="nearest-menu" data-key="${escapeAttr(key)}">
                        <span>
                            <span class="route-tool-row-title">${escapeHtml(apt.icao)} · ${escapeHtml(apt.name)}</span>
                            <span class="route-tool-row-meta">${fmtNm(apt.nav.dist)} NM · ${apt.nav.brng}° ${compassFromBearing(apt.nav.brng)}</span>
                        </span>
                        <span class="checklist-tool-arrow" aria-hidden="true">›</span>
                    </button>
                    ${open ? `
                        <div class="route-tool-context">
                            <button class="checklist-mini-btn primary" type="button" data-action="nearest-direct" data-airport="${escapeAttr(encoded)}">Direct To</button>
                            <button class="checklist-mini-btn" type="button" data-action="airport-info" data-airport="${escapeAttr(encoded)}">Info</button>
                            <button class="checklist-mini-btn" type="button" data-action="locate-airport" data-airport="${escapeAttr(encoded)}">🔎 Karte</button>
                        </div>
                    ` : ''}
                </div>
            `;
    }).join('') : renderToolEmpty(entry.loading ? 'Nearest wird geladen...' : 'Keine Flugplätze im Umkreis von 50 NM gefunden.');
    bodyEl.innerHTML = `
            ${toolTopline('nearest')}
            ${entry.error && !entry.loading ? `<div class="route-tool-warning">${escapeHtml(entry.error)}</div>` : ''}
            <div class="route-tool-list">${list}</div>
        `;
  }
  function decodeAirportDataset(button) {
    try {
      return normalizeToolAirport(JSON.parse(decodeURIComponent(button.dataset.airport || '')));
    } catch (_) {
      return null;
    }
  }
  function renderAirportInfoTool() {
    setTitle('Platz Info');
    var apt = state.placeInfoAirport;
    if (!apt) {
      state.view = 'place';
      renderPlaceTool();
      return;
    }
    ensurePlaceTool(false);
    bodyEl.innerHTML = `
            <div class="checklist-topline route-tool-topline">
                <button class="checklist-back-btn" type="button" data-action="open-tool" data-tool="${escapeAttr(state.placeInfoReturn || 'place')}">Zurück</button>
                <button class="checklist-action-btn" type="button" data-action="nearest-direct" data-airport="${escapeAttr(encodeURIComponent(JSON.stringify(apt)))}">Direct To</button>
            </div>
            ${placeCard('Info', apt, false)}
        `;
    setTimeout(renderPlaceEnhancements, 0);
  }
  function renderList() {
    setTitle('Checklists');
    var cards = visibleChecklists().map(checklist => {
      var progress = checkedCount(checklist.id);
      var total = itemCount(checklist);
      var badge = checklist.published && checklist.source === 'custom' ? '<span class="checklist-badge">PUBLIC</span>' : checklist.source === 'community' ? '<span class="checklist-badge">LIVE</span>' : '';
      return `
                <div class="checklist-list-card ${checklist.source === 'builtin' ? 'is-builtin' : ''}">
                    <button class="checklist-list-main" type="button" data-action="open-checklist" data-id="${escapeAttr(checklist.id)}">
                        <span class="checklist-list-title">${escapeHtml(checklist.title)}${badge}</span>
                        <span class="checklist-list-meta">${sourceLabel(checklist)} · ${checklist.chapters.length} Kapitel · ${itemCount(checklist)} Punkte · ${progress}/${total}</span>
                    </button>
                </div>
            `;
    }).join('') || '<div class="checklist-manager-empty">Keine Checklisten sichtbar. Im Zahnrad-Menü kannst du Listen einblenden.</div>';
    bodyEl.innerHTML = `
            <div class="checklist-topline">
                <button class="checklist-back-btn" type="button" data-action="home">Zurück</button>
                <button class="checklist-action-btn primary" type="button" data-action="new">Neue Checkliste</button>
                <button class="checklist-action-btn" type="button" data-action="import-open">Import</button>
                <button class="checklist-icon-btn" type="button" data-action="manager" title="Checklists verwalten">⚙</button>
            </div>
            <div class="checklist-list">${cards}</div>
        `;
    maybePullCommunity(false);
  }
  function renderManager() {
    setTitle('Checklist Auswahl');
    var builtinRows = BUILTIN_CHECKLISTS.map(checklist => managerRow(checklist, 'toggle-visible')).join('');
    var ownRows = customLists.length ? customLists.map(checklist => managerRow(checklist, 'toggle-visible')).join('') : '<div class="checklist-manager-empty">Noch keine eigenen Checklisten.</div>';
    var visibleRows = visibleChecklists().map((checklist, index, arr) => reorderRow(checklist, index, arr.length)).join('') || '<div class="checklist-manager-empty">Keine sichtbaren Checklisten.</div>';
    var ownIds = customCommunityIds();
    var communityRows = communityMeta.filter(meta => !ownIds.has(meta.id)).map(meta => {
      var subscribed = !!communitySubscriptions[meta.id];
      return `
                <div class="checklist-manager-row">
                    <input type="checkbox" data-action="toggle-community-sub" data-id="${escapeAttr(meta.id)}" ${subscribed ? 'checked' : ''}>
                    <div class="checklist-manager-main">
                        <div class="checklist-manager-name">${escapeHtml(meta.title)}</div>
                        <div class="checklist-manager-meta">Community · ${meta.chapterCount} Kapitel · ${meta.itemCount} Punkte</div>
                    </div>
                    <button class="checklist-mini-btn" type="button" data-action="copy-community" data-id="${escapeAttr(meta.id)}">Kopie</button>
                </div>
            `;
    }).join('') || '<div class="checklist-manager-empty">Keine Community-Listen gefunden.</div>';
    bodyEl.innerHTML = `
            <div class="checklist-topline">
                <button class="checklist-back-btn" type="button" data-action="open-list">Zurück</button>
                <button class="checklist-action-btn" type="button" data-action="refresh-community">Community aktualisieren</button>
            </div>
            <div class="checklist-manager-section">
                <div class="checklist-manager-title">REIHENFOLGE</div>
                ${visibleRows}
            </div>
            <div class="checklist-manager-section">
                <div class="checklist-manager-title">STANDARD</div>
                ${builtinRows}
            </div>
            <div class="checklist-manager-section">
                <div class="checklist-manager-title">EIGENE</div>
                ${ownRows}
            </div>
            <div class="checklist-manager-section">
                <div class="checklist-manager-title">COMMUNITY</div>
                ${communityRows}
            </div>
        `;
    maybePullCommunity(false);
  }
  function reorderRow(checklist, index, total) {
    return `
            <div class="checklist-manager-row checklist-order-row">
                <div class="checklist-manager-main">
                    <div class="checklist-manager-name">${escapeHtml(checklist.title)}</div>
                    <div class="checklist-manager-meta">${sourceLabel(checklist)} · Position ${index + 1}/${total}</div>
                </div>
                <div class="checklist-order-buttons">
                    <button class="checklist-mini-btn" type="button" data-action="move-checklist-order" data-id="${escapeAttr(checklist.id)}" data-dir="-1" ${index === 0 ? 'disabled' : ''}>↑</button>
                    <button class="checklist-mini-btn" type="button" data-action="move-checklist-order" data-id="${escapeAttr(checklist.id)}" data-dir="1" ${index === total - 1 ? 'disabled' : ''}>↓</button>
                </div>
            </div>
        `;
  }
  function managerRow(checklist, action) {
    var checked = isChecklistVisible(checklist);
    var badge = checklist.published ? ' · veröffentlicht' : '';
    return `
            <div class="checklist-manager-row">
                <input type="checkbox" data-action="${action}" data-id="${escapeAttr(checklist.id)}" ${checked ? 'checked' : ''}>
                <div class="checklist-manager-main">
                    <div class="checklist-manager-name">${escapeHtml(checklist.title)}</div>
                    <div class="checklist-manager-meta">${sourceLabel(checklist)}${badge} · ${itemCount(checklist)} Punkte</div>
                </div>
            </div>
        `;
  }
  function checkedCount(checklistId) {
    var progress = progressByChecklist[checklistId] || {};
    return Object.values(progress).filter(Boolean).length;
  }
  function activeChapter(checklist) {
    if (!checklist || !checklist.chapters.length) return null;
    return checklist.chapters.find(chapter => chapter.id === state.activeChapterId) || checklist.chapters[0];
  }
  function renderViewer() {
    var checklist = getChecklist(state.selectedId);
    if (!checklist) {
      state.view = 'list';
      renderList();
      return;
    }
    var chapter = activeChapter(checklist);
    if (!chapter) {
      state.view = 'list';
      renderList();
      return;
    }
    pruneProgress(checklist);
    state.activeChapterId = chapter.id;
    persistUiState();
    setTitle('Checkliste');
    var total = itemCount(checklist);
    var done = checkedCount(checklist.id);
    var tabs = checklist.chapters.map(ch => `
            <button class="checklist-tab ${ch.id === chapter.id ? 'is-active' : ''}" type="button" data-action="tab" data-id="${escapeAttr(ch.id)}">
                ${escapeHtml(ch.title)}
            </button>
        `).join('');
    var rows = chapter.items.map(item => {
      var checked = !!(progressByChecklist[checklist.id] && progressByChecklist[checklist.id][item.id]);
      return `
                <label class="checklist-row ${checked ? 'is-checked' : ''}">
                    <input type="checkbox" data-action="toggle-item" data-item-id="${escapeAttr(item.id)}" ${checked ? 'checked' : ''}>
                    <span class="checklist-row-text">${escapeHtml(item.text)}</span>
                </label>
            `;
    }).join('');
    bodyEl.innerHTML = `
            <div class="checklist-viewer-title">${escapeHtml(checklist.title)}${checklist.published && checklist.source === 'custom' ? '<span class="checklist-badge">PUBLIC</span>' : ''}</div>
            <span class="checklist-progress-meta">${sourceLabel(checklist)} · ${done}/${total} erledigt</span>
            <div class="checklist-viewer-controls">
                <button class="checklist-mini-btn" type="button" data-action="open-list">Zurück</button>
                <button class="checklist-mini-btn" type="button" data-action="reset-progress" data-id="${escapeAttr(checklist.id)}">Reset</button>
                <button class="checklist-icon-btn" type="button" data-action="toggle-actions" title="Aktionen">⚙</button>
            </div>
            ${state.actionMenuOpen ? viewerActionMenu(checklist) : ''}
            <div class="checklist-tabs">${tabs}</div>
            <div class="checklist-rows">${rows}</div>
        `;
  }
  function viewerActionMenu(checklist) {
    var edit = checklist.editable ? `<button class="checklist-mini-btn" type="button" data-action="edit" data-id="${escapeAttr(checklist.id)}">Bearbeiten</button>` : '';
    var del = checklist.editable ? `<button class="checklist-mini-btn danger" type="button" data-action="delete" data-id="${escapeAttr(checklist.id)}">Löschen</button>` : '';
    var unsub = checklist.source === 'community' ? `<button class="checklist-mini-btn danger" type="button" data-action="unsubscribe-community" data-id="${escapeAttr(checklist.communityId)}">Abbestellen</button>` : '';
    var publish = checklist.source === 'custom' ? `
            <label class="checklist-publish-row">
                <input type="checkbox" data-action="toggle-publish-viewer" data-id="${escapeAttr(checklist.id)}" ${checklist.published ? 'checked' : ''}>
                Veröffentlichen
            </label>
        ` : '';
    return `
            <div class="checklist-action-menu">
                ${publish}
                ${edit}
                <button class="checklist-mini-btn" type="button" data-action="copy" data-id="${escapeAttr(checklist.id)}">Als Kopie hinzufügen</button>
                <button class="checklist-mini-btn" type="button" data-action="export" data-id="${escapeAttr(checklist.id)}">Export</button>
                ${unsub}
                ${del}
            </div>
        `;
  }
  function renderEditor() {
    var draft = state.editorDraft;
    if (!draft) {
      state.view = 'list';
      renderList();
      return;
    }
    setTitle(state.editorMode === 'edit' ? 'Checklist bearbeiten' : 'Neue Checkliste');
    var publishRow = `
            <label class="checklist-publish-row">
                <input type="checkbox" data-field="published" ${draft.published ? 'checked' : ''}>
                Veröffentlichen
            </label>
        `;
    var chapters = draft.chapters.map((chapter, chapterIndex) => {
      var items = chapter.items.map((item, itemIndex) => `
                <div class="checklist-editor-item">
                    <textarea class="checklist-editor-textarea" maxlength="${MAX_TEXT_LENGTH}" data-field="item-text" data-chapter-index="${chapterIndex}" data-item-index="${itemIndex}">${escapeHtml(item.text)}</textarea>
                    <div class="checklist-editor-buttons">
                        <button class="checklist-mini-btn" type="button" data-action="move-item" data-chapter-index="${chapterIndex}" data-item-index="${itemIndex}" data-dir="-1" ${itemIndex === 0 ? 'disabled' : ''}>↑</button>
                        <button class="checklist-mini-btn" type="button" data-action="move-item" data-chapter-index="${chapterIndex}" data-item-index="${itemIndex}" data-dir="1" ${itemIndex === chapter.items.length - 1 ? 'disabled' : ''}>↓</button>
                        <button class="checklist-mini-btn" type="button" data-action="duplicate-item" data-chapter-index="${chapterIndex}" data-item-index="${itemIndex}">+</button>
                        <button class="checklist-mini-btn danger" type="button" data-action="delete-item" data-chapter-index="${chapterIndex}" data-item-index="${itemIndex}">×</button>
                    </div>
                </div>
            `).join('');
      return `
                <div class="checklist-editor-chapter">
                    <div class="checklist-editor-chapter-head">
                        <input class="checklist-editor-input" maxlength="64" value="${escapeAttr(chapter.title)}" data-field="chapter-title" data-chapter-index="${chapterIndex}">
                        <div class="checklist-editor-buttons">
                            <button class="checklist-mini-btn" type="button" data-action="move-chapter" data-chapter-index="${chapterIndex}" data-dir="-1" ${chapterIndex === 0 ? 'disabled' : ''}>↑</button>
                            <button class="checklist-mini-btn" type="button" data-action="move-chapter" data-chapter-index="${chapterIndex}" data-dir="1" ${chapterIndex === draft.chapters.length - 1 ? 'disabled' : ''}>↓</button>
                            <button class="checklist-mini-btn" type="button" data-action="duplicate-chapter" data-chapter-index="${chapterIndex}">+</button>
                            <button class="checklist-mini-btn danger" type="button" data-action="delete-chapter" data-chapter-index="${chapterIndex}">×</button>
                        </div>
                    </div>
                    ${items}
                    <button class="checklist-editor-btn checklist-editor-add-row" type="button" data-action="add-item" data-chapter-index="${chapterIndex}">Punkt hinzufügen</button>
                </div>
            `;
    }).join('');
    bodyEl.innerHTML = `
            <div class="checklist-editor-field">
                <label class="checklist-editor-label" for="checklistEditorTitle">Titel</label>
                <input id="checklistEditorTitle" class="checklist-editor-input" maxlength="96" value="${escapeAttr(draft.title)}" data-field="title">
            </div>
            ${publishRow}
            <div class="checklist-editor-actions">
                <button class="checklist-editor-btn primary" type="button" data-action="save-editor">Speichern</button>
                <button class="checklist-editor-btn" type="button" data-action="add-chapter">Kapitel hinzufügen</button>
                <button class="checklist-editor-btn" type="button" data-action="cancel-editor">Zurück</button>
            </div>
            <div class="checklist-editor-chapters">${chapters}</div>
        `;
  }
  function renderImport() {
    setTitle('Checklist Import');
    bodyEl.innerHTML = `
            <textarea id="checklistImportText" class="checklist-import-textarea" spellcheck="false"></textarea>
            <div class="checklist-import-actions">
                <button class="checklist-editor-btn primary" type="button" data-action="import-run">Importieren</button>
                <button class="checklist-editor-btn" type="button" data-action="open-list">Zurück</button>
            </div>
        `;
  }
  function openList() {
    state.view = 'list';
    state.editorDraft = null;
    state.actionMenuOpen = false;
    setStatus('');
    render();
    maybePullKvChecklists();
    maybePullCommunity(false);
  }
  function openChecklist(_x15) {
    return _openChecklist.apply(this, arguments);
  }
  function _openChecklist() {
    _openChecklist = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee0(id) {
      var _checklist$chapters$;
      var chapterId,
        communityId,
        checklist,
        _args0 = arguments;
      return _regenerator().w(function (_context0) {
        while (1) switch (_context0.n) {
          case 0:
            chapterId = _args0.length > 1 && _args0[1] !== undefined ? _args0[1] : '';
            if (!String(id).startsWith('community:')) {
              _context0.n = 1;
              break;
            }
            communityId = String(id).slice('community:'.length);
            _context0.n = 1;
            return ensureCommunityDetail(communityId);
          case 1:
            checklist = getChecklist(id);
            if (checklist) {
              _context0.n = 2;
              break;
            }
            return _context0.a(2);
          case 2:
            state.selectedId = checklist.id;
            state.activeChapterId = chapterId || state.activeChapterId || ((_checklist$chapters$ = checklist.chapters[0]) === null || _checklist$chapters$ === void 0 ? void 0 : _checklist$chapters$.id) || '';
            state.view = 'viewer';
            state.editorDraft = null;
            state.actionMenuOpen = false;
            persistUiState();
            setStatus('');
            render();
          case 3:
            return _context0.a(2);
        }
      }, _callee0);
    }));
    return _openChecklist.apply(this, arguments);
  }
  function makeBlankChecklist() {
    var now = Date.now();
    return {
      id: makeId('custom'),
      title: 'Neue Checkliste',
      source: 'custom',
      editable: true,
      published: false,
      communityId: '',
      createdAt: now,
      updatedAt: now,
      chapters: [{
        id: makeId('chap'),
        title: 'Kapitel 1',
        items: [{
          id: makeId('item'),
          text: ''
        }]
      }]
    };
  }
  function copyChecklistForEditing(source) {
    var now = Date.now();
    return {
      id: makeId('custom'),
      title: `${source.title} Kopie`.slice(0, 96),
      source: 'custom',
      editable: true,
      published: false,
      communityId: '',
      createdAt: now,
      updatedAt: now,
      chapters: source.chapters.map(chapter => ({
        id: makeId('chap'),
        title: chapter.title,
        items: chapter.items.map(item => ({
          id: makeId('item'),
          text: item.text
        }))
      }))
    };
  }
  function openNewEditor() {
    state.editorDraft = makeBlankChecklist();
    state.editorMode = 'new';
    state.view = 'editor';
    state.actionMenuOpen = false;
    setStatus('');
    render();
  }
  function openEditEditor(id) {
    var checklist = getChecklist(id);
    if (!checklist) return;
    state.editorDraft = checklist.editable ? clone(checklist) : copyChecklistForEditing(checklist);
    state.editorMode = checklist.editable ? 'edit' : 'copy';
    state.view = 'editor';
    state.actionMenuOpen = false;
    setStatus('');
    render();
  }
  function validateDraft(draft) {
    var title = cleanText(draft === null || draft === void 0 ? void 0 : draft.title, 96);
    if (!title) return 'Titel fehlt.';
    if (draft !== null && draft !== void 0 && draft.published && !getCredentials()) return 'Veröffentlichen braucht Pilot-ID/PIN Login.';
    var chapters = Array.isArray(draft === null || draft === void 0 ? void 0 : draft.chapters) ? draft.chapters : [];
    if (!chapters.length) return 'Mindestens ein Kapitel nötig.';
    if (chapters.length > MAX_CHAPTERS) return `Maximal ${MAX_CHAPTERS} Kapitel.`;
    var total = 0;
    for (var i = 0; i < chapters.length; i += 1) {
      var _chapters$i, _chapters$i2;
      if (!cleanText((_chapters$i = chapters[i]) === null || _chapters$i === void 0 ? void 0 : _chapters$i.title, 64)) return `Kapitel ${i + 1}: Titel fehlt.`;
      var items = Array.isArray((_chapters$i2 = chapters[i]) === null || _chapters$i2 === void 0 ? void 0 : _chapters$i2.items) ? chapters[i].items : [];
      var nonEmpty = items.filter(item => cleanText(item === null || item === void 0 ? void 0 : item.text));
      if (!nonEmpty.length) return `Kapitel ${i + 1}: Mindestens ein Punkt nötig.`;
      total += nonEmpty.length;
    }
    if (total < 1) return 'Mindestens ein Punkt nötig.';
    if (total > MAX_ITEMS) return `Maximal ${MAX_ITEMS} Punkte.`;
    return '';
  }
  function saveEditorDraft() {
    return _saveEditorDraft.apply(this, arguments);
  }
  function _saveEditorDraft() {
    _saveEditorDraft = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee1() {
      var _sanitized$chapters$;
      var draft, error, previous, now, sanitized, result, _t0;
      return _regenerator().w(function (_context1) {
        while (1) switch (_context1.p = _context1.n) {
          case 0:
            draft = state.editorDraft;
            if (draft) {
              _context1.n = 1;
              break;
            }
            return _context1.a(2);
          case 1:
            error = validateDraft(draft);
            if (!error) {
              _context1.n = 2;
              break;
            }
            setStatus(error, 'error');
            return _context1.a(2);
          case 2:
            previous = customLists.find(item => item.id === draft.id);
            now = Date.now();
            sanitized = sanitizeChecklist(draft, {
              id: safeId(draft.id, 'custom'),
              source: 'custom',
              editable: true,
              preserveIds: true
            });
            sanitized.createdAt = Number(draft.createdAt || now);
            sanitized.updatedAt = now;
            if (sanitized.published && !sanitized.communityId) sanitized.communityId = (previous === null || previous === void 0 ? void 0 : previous.communityId) || sanitized.id;
            upsertCustom(sanitized);
            state.selectedId = sanitized.id;
            state.activeChapterId = ((_sanitized$chapters$ = sanitized.chapters[0]) === null || _sanitized$chapters$ === void 0 ? void 0 : _sanitized$chapters$.id) || '';
            state.view = 'viewer';
            state.editorDraft = null;
            state.editorMode = '';
            state.actionMenuOpen = false;
            persistUiState();
            setStatus('Lokal gespeichert.', 'good');
            render();
            _context1.p = 3;
            if (!sanitized.published) {
              _context1.n = 5;
              break;
            }
            _context1.n = 4;
            return publishCommunityChecklist(sanitized);
          case 4:
            _context1.n = 6;
            break;
          case 5:
            if (!(previous !== null && previous !== void 0 && previous.published)) {
              _context1.n = 6;
              break;
            }
            _context1.n = 6;
            return unpublishCommunityChecklist(previous);
          case 6:
            _context1.n = 7;
            return backupChecklistToKv(sanitized);
          case 7:
            result = _context1.v;
            if (result === 'synced') setStatus(sanitized.published ? 'Gespeichert und veröffentlicht.' : 'Gespeichert und gesichert.', 'good');
            _context1.n = 9;
            break;
          case 8:
            _context1.p = 8;
            _t0 = _context1.v;
            setStatus(`Lokal gespeichert. ${communityStatusMessage(_t0)}`, 'warn');
          case 9:
            return _context1.a(2);
        }
      }, _callee1, null, [[3, 8]]);
    }));
    return _saveEditorDraft.apply(this, arguments);
  }
  function upsertCustom(checklist) {
    var idx = customLists.findIndex(item => item.id === checklist.id);
    if (idx >= 0) customLists[idx] = checklist;else customLists.push(checklist);
    saveCustomLists();
  }
  function deleteChecklist(_x16) {
    return _deleteChecklist.apply(this, arguments);
  }
  function _deleteChecklist() {
    _deleteChecklist = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee10(id) {
      var checklist, _t1, _t10;
      return _regenerator().w(function (_context10) {
        while (1) switch (_context10.p = _context10.n) {
          case 0:
            checklist = getChecklist(id);
            if (!(!checklist || !checklist.editable)) {
              _context10.n = 1;
              break;
            }
            return _context10.a(2);
          case 1:
            if (confirm(`Checkliste "${checklist.title}" löschen?`)) {
              _context10.n = 2;
              break;
            }
            return _context10.a(2);
          case 2:
            customLists = customLists.filter(item => item.id !== id);
            delete progressByChecklist[id];
            delete visibilityPrefs[id];
            saveCustomLists();
            saveProgress();
            writeJson(VISIBLE_STORAGE_KEY, visibilityPrefs);
            if (!checklist.published) {
              _context10.n = 6;
              break;
            }
            _context10.p = 3;
            _context10.n = 4;
            return unpublishCommunityChecklist(checklist);
          case 4:
            _context10.n = 6;
            break;
          case 5:
            _context10.p = 5;
            _t1 = _context10.v;
          case 6:
            if (state.selectedId === id) {
              state.selectedId = '';
              state.activeChapterId = '';
              state.view = 'list';
              persistUiState();
            }
            setStatus('Gelöscht.', 'good');
            render();
            _context10.p = 7;
            _context10.n = 8;
            return saveKvIndex();
          case 8:
            _context10.n = 10;
            break;
          case 9:
            _context10.p = 9;
            _t10 = _context10.v;
            setStatus('Lokal gelöscht, Cloud-Index nicht aktualisiert.', 'warn');
          case 10:
            return _context10.a(2);
        }
      }, _callee10, null, [[7, 9], [3, 5]]);
    }));
    return _deleteChecklist.apply(this, arguments);
  }
  function resetProgress(id) {
    delete progressByChecklist[id];
    saveProgress();
    setStatus('Fortschritt zurückgesetzt.', 'good');
    render();
  }
  function pruneProgress(checklist) {
    var progress = progressByChecklist[checklist.id];
    if (!progress) return;
    var valid = new Set();
    checklist.chapters.forEach(chapter => chapter.items.forEach(item => valid.add(item.id)));
    var changed = false;
    Object.keys(progress).forEach(id => {
      if (!valid.has(id)) {
        delete progress[id];
        changed = true;
      }
    });
    if (changed) saveProgress();
  }
  function toggleItem(itemId, checked) {
    var checklist = getChecklist(state.selectedId);
    if (!checklist) return;
    if (!progressByChecklist[checklist.id]) progressByChecklist[checklist.id] = {};
    if (checked) progressByChecklist[checklist.id][itemId] = true;else delete progressByChecklist[checklist.id][itemId];
    saveProgress();
    render();
  }
  function moveInArray(arr, index, dir) {
    var nextIndex = index + dir;
    if (!Array.isArray(arr) || index < 0 || nextIndex < 0 || index >= arr.length || nextIndex >= arr.length) return false;
    var _arr$splice = arr.splice(index, 1),
      _arr$splice2 = _slicedToArray(_arr$splice, 1),
      item = _arr$splice2[0];
    arr.splice(nextIndex, 0, item);
    return true;
  }
  function duplicateChapter(index) {
    var _draft$chapters;
    var draft = state.editorDraft;
    var chapter = draft === null || draft === void 0 || (_draft$chapters = draft.chapters) === null || _draft$chapters === void 0 ? void 0 : _draft$chapters[index];
    if (!draft || !chapter || draft.chapters.length >= MAX_CHAPTERS) return;
    draft.chapters.splice(index + 1, 0, {
      id: makeId('chap'),
      title: `${chapter.title} Kopie`.slice(0, 64),
      items: chapter.items.map(item => ({
        id: makeId('item'),
        text: item.text
      }))
    });
    render();
  }
  function duplicateItem(chapterIndex, itemIndex) {
    var _state$editorDraft;
    var items = (_state$editorDraft = state.editorDraft) === null || _state$editorDraft === void 0 || (_state$editorDraft = _state$editorDraft.chapters) === null || _state$editorDraft === void 0 || (_state$editorDraft = _state$editorDraft[chapterIndex]) === null || _state$editorDraft === void 0 ? void 0 : _state$editorDraft.items;
    if (!items || !items[itemIndex]) return;
    items.splice(itemIndex + 1, 0, {
      id: makeId('item'),
      text: items[itemIndex].text
    });
    render();
  }
  function addChapter() {
    var draft = state.editorDraft;
    if (!draft || draft.chapters.length >= MAX_CHAPTERS) {
      setStatus(`Maximal ${MAX_CHAPTERS} Kapitel.`, 'error');
      return;
    }
    draft.chapters.push({
      id: makeId('chap'),
      title: `Kapitel ${draft.chapters.length + 1}`,
      items: [{
        id: makeId('item'),
        text: ''
      }]
    });
    render();
  }
  function addItem(chapterIndex) {
    var _state$editorDraft2;
    var chapter = (_state$editorDraft2 = state.editorDraft) === null || _state$editorDraft2 === void 0 || (_state$editorDraft2 = _state$editorDraft2.chapters) === null || _state$editorDraft2 === void 0 ? void 0 : _state$editorDraft2[chapterIndex];
    if (!chapter) return;
    chapter.items.push({
      id: makeId('item'),
      text: ''
    });
    render();
  }
  function deleteChapter(index) {
    var draft = state.editorDraft;
    if (!draft || draft.chapters.length <= 1) {
      setStatus('Mindestens ein Kapitel bleibt nötig.', 'error');
      return;
    }
    draft.chapters.splice(index, 1);
    render();
  }
  function deleteItem(chapterIndex, itemIndex) {
    var _state$editorDraft3;
    var items = (_state$editorDraft3 = state.editorDraft) === null || _state$editorDraft3 === void 0 || (_state$editorDraft3 = _state$editorDraft3.chapters) === null || _state$editorDraft3 === void 0 || (_state$editorDraft3 = _state$editorDraft3[chapterIndex]) === null || _state$editorDraft3 === void 0 ? void 0 : _state$editorDraft3.items;
    if (!items || items.length <= 1) {
      setStatus('Mindestens ein Punkt bleibt nötig.', 'error');
      return;
    }
    items.splice(itemIndex, 1);
    render();
  }
  function encodeUtf8Base64(text) {
    var binary = encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    return btoa(binary);
  }
  function decodeUtf8Base64(text) {
    var binary = atob(text);
    var encoded = '';
    for (var i = 0; i < binary.length; i += 1) encoded += `%${binary.charCodeAt(i).toString(16).padStart(2, '0')}`;
    return decodeURIComponent(encoded);
  }
  function sharePayload(checklist) {
    return {
      version: 1,
      checklist: {
        title: checklist.title,
        chapters: checklist.chapters.map(chapter => ({
          title: chapter.title,
          items: chapter.items.map(item => ({
            text: item.text
          }))
        }))
      }
    };
  }
  function exportChecklist(_x17) {
    return _exportChecklist.apply(this, arguments);
  }
  function _exportChecklist() {
    _exportChecklist = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee11(id) {
      var checklist, code, _t11;
      return _regenerator().w(function (_context11) {
        while (1) switch (_context11.p = _context11.n) {
          case 0:
            checklist = getChecklist(id);
            if (checklist) {
              _context11.n = 1;
              break;
            }
            return _context11.a(2);
          case 1:
            code = SHARE_PREFIX + encodeUtf8Base64(JSON.stringify(sharePayload(checklist)));
            _context11.p = 2;
            if (!(!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function')) {
              _context11.n = 3;
              break;
            }
            throw new Error('clipboard_unavailable');
          case 3:
            _context11.n = 4;
            return navigator.clipboard.writeText(code);
          case 4:
            setStatus('Share-Code kopiert.', 'good');
            _context11.n = 6;
            break;
          case 5:
            _context11.p = 5;
            _t11 = _context11.v;
            window.prompt('Share-Code', code);
            setStatus('Share-Code bereit.', 'good');
          case 6:
            return _context11.a(2);
        }
      }, _callee11, null, [[2, 5]]);
    }));
    return _exportChecklist.apply(this, arguments);
  }
  function decodeShareCode(raw) {
    var code = String(raw || '').trim();
    if (!code) throw new Error('empty');
    if (code.startsWith('{')) {
      var _payload = JSON.parse(code);
      return (_payload === null || _payload === void 0 ? void 0 : _payload.checklist) || _payload;
    }
    if (code.startsWith(SHARE_PREFIX)) code = code.slice(SHARE_PREFIX.length);
    code = code.replace(/\s+/g, '');
    var payload = JSON.parse(decodeUtf8Base64(code));
    return (payload === null || payload === void 0 ? void 0 : payload.checklist) || payload;
  }
  function importChecklist() {
    return _importChecklist.apply(this, arguments);
  }
  function _importChecklist() {
    _importChecklist = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee12() {
      var textarea, _fresh$chapters$, incoming, now, fresh, result, _t12, _t13;
      return _regenerator().w(function (_context12) {
        while (1) switch (_context12.p = _context12.n) {
          case 0:
            textarea = document.getElementById('checklistImportText');
            _context12.p = 1;
            incoming = decodeShareCode((textarea === null || textarea === void 0 ? void 0 : textarea.value) || '');
            now = Date.now();
            fresh = sanitizeChecklist(incoming, {
              id: makeId('custom'),
              source: 'custom',
              editable: true,
              preserveIds: false
            });
            fresh.createdAt = now;
            fresh.updatedAt = now;
            fresh.published = false;
            fresh.communityId = '';
            if (fresh.chapters.length) {
              _context12.n = 2;
              break;
            }
            throw new Error('empty_checklist');
          case 2:
            upsertCustom(fresh);
            state.selectedId = fresh.id;
            state.activeChapterId = ((_fresh$chapters$ = fresh.chapters[0]) === null || _fresh$chapters$ === void 0 ? void 0 : _fresh$chapters$.id) || '';
            state.view = 'viewer';
            persistUiState();
            setStatus('Importiert.', 'good');
            render();
            _context12.p = 3;
            _context12.n = 4;
            return backupChecklistToKv(fresh);
          case 4:
            result = _context12.v;
            if (result === 'synced') setStatus('Importiert und gesichert.', 'good');
            _context12.n = 6;
            break;
          case 5:
            _context12.p = 5;
            _t12 = _context12.v;
            setStatus('Importiert, Cloud nicht erreichbar.', 'warn');
          case 6:
            _context12.n = 8;
            break;
          case 7:
            _context12.p = 7;
            _t13 = _context12.v;
            setStatus('Import-Code ungültig.', 'error');
          case 8:
            return _context12.a(2);
        }
      }, _callee12, null, [[3, 5], [1, 7]]);
    }));
    return _importChecklist.apply(this, arguments);
  }
  function getSyncBaseUrl() {
    try {
      if (typeof SYNC_URL !== 'undefined' && SYNC_URL) return SYNC_URL;
    } catch (_) {}
    return 'https://ga-proxy.einherjer.workers.dev/api/sync/';
  }
  function getProxyBaseUrl() {
    return getSyncBaseUrl().replace(/\/api\/sync\/?$/, '').replace(/\/$/, '');
  }
  function getCommunityApiUrl() {
    var path = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
    return `${getProxyBaseUrl()}/api/checklists/community${path}`;
  }
  function getCredentials() {
    var id = typeof window.getSyncId === 'function' ? window.getSyncId() : localStorage.getItem('ga_sync_id') || localStorage.getItem('ga_saved_id') || '';
    var pin = typeof window.getSyncPin === 'function' ? window.getSyncPin() : localStorage.getItem('ga_sync_pin') || localStorage.getItem('ga_saved_pin') || '';
    var cleanId = String(id || '').trim();
    var cleanPin = String(pin || '').trim();
    if (!cleanId || !cleanPin) return null;
    return {
      id: cleanId,
      pin: cleanPin
    };
  }
  function encodedSyncId(id) {
    return encodeURIComponent(id).replace(/%/g, '_');
  }
  function kvIndexKey() {
    var credentials = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : getCredentials();
    return credentials ? `CHKIDX_${encodedSyncId(credentials.id)}` : '';
  }
  function kvChecklistKey(checklistId) {
    var credentials = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : getCredentials();
    return credentials ? `CHK_${encodedSyncId(credentials.id)}_${safeId(checklistId, 'custom')}` : '';
  }
  function kvFetch(_x18, _x19) {
    return _kvFetch.apply(this, arguments);
  }
  function _kvFetch() {
    _kvFetch = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee13(key, credentials) {
      var url;
      return _regenerator().w(function (_context13) {
        while (1) switch (_context13.n) {
          case 0:
            url = `${getSyncBaseUrl()}${encodeURIComponent(key)}?pin=${encodeURIComponent(credentials.pin)}`;
            return _context13.a(2, fetch(url, {
              headers: {
                'X-Pilot-PIN': credentials.pin
              }
            }));
        }
      }, _callee13);
    }));
    return _kvFetch.apply(this, arguments);
  }
  function kvGet(_x20, _x21) {
    return _kvGet.apply(this, arguments);
  }
  function _kvGet() {
    _kvGet = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee14(key, credentials) {
      var res;
      return _regenerator().w(function (_context14) {
        while (1) switch (_context14.n) {
          case 0:
            _context14.n = 1;
            return kvFetch(key, credentials);
          case 1:
            res = _context14.v;
            if (!(res.status === 404)) {
              _context14.n = 2;
              break;
            }
            return _context14.a(2, null);
          case 2:
            if (res.ok) {
              _context14.n = 3;
              break;
            }
            throw new Error(`kv_get_${res.status}`);
          case 3:
            return _context14.a(2, res.json());
        }
      }, _callee14);
    }));
    return _kvGet.apply(this, arguments);
  }
  function kvPut(_x22, _x23, _x24) {
    return _kvPut.apply(this, arguments);
  }
  function _kvPut() {
    _kvPut = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee15(key, payload, credentials) {
      var url, res;
      return _regenerator().w(function (_context15) {
        while (1) switch (_context15.n) {
          case 0:
            url = `${getSyncBaseUrl()}${encodeURIComponent(key)}?pin=${encodeURIComponent(credentials.pin)}`;
            _context15.n = 1;
            return fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Pilot-PIN': credentials.pin
              },
              body: JSON.stringify(_objectSpread(_objectSpread({}, payload), {}, {
                pin: credentials.pin
              })),
              keepalive: true
            });
          case 1:
            res = _context15.v;
            if (res.ok) {
              _context15.n = 2;
              break;
            }
            throw new Error(`kv_put_${res.status}`);
          case 2:
            return _context15.a(2, res.json());
        }
      }, _callee15);
    }));
    return _kvPut.apply(this, arguments);
  }
  function kvIndexPayload(credentials) {
    return {
      kind: 'checklist-index-v1',
      syncId: credentials.id,
      lastModified: Date.now(),
      entries: customLists.map(checklist => ({
        id: checklist.id,
        title: checklist.title,
        updatedAt: checklist.updatedAt,
        chapterCount: checklist.chapters.length,
        itemCount: itemCount(checklist),
        published: !!checklist.published,
        communityId: checklist.communityId || ''
      }))
    };
  }
  function saveKvIndex() {
    return _saveKvIndex.apply(this, arguments);
  }
  function _saveKvIndex() {
    _saveKvIndex = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee16() {
      var credentials;
      return _regenerator().w(function (_context16) {
        while (1) switch (_context16.n) {
          case 0:
            credentials = getCredentials();
            if (credentials) {
              _context16.n = 1;
              break;
            }
            return _context16.a(2, 'local');
          case 1:
            _context16.n = 2;
            return kvPut(kvIndexKey(credentials), kvIndexPayload(credentials), credentials);
          case 2:
            return _context16.a(2, 'synced');
        }
      }, _callee16);
    }));
    return _saveKvIndex.apply(this, arguments);
  }
  function backupChecklistToKv(_x25) {
    return _backupChecklistToKv.apply(this, arguments);
  }
  function _backupChecklistToKv() {
    _backupChecklistToKv = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee17(checklist) {
      var credentials;
      return _regenerator().w(function (_context17) {
        while (1) switch (_context17.n) {
          case 0:
            credentials = getCredentials();
            if (credentials) {
              _context17.n = 1;
              break;
            }
            return _context17.a(2, 'local');
          case 1:
            _context17.n = 2;
            return kvPut(kvChecklistKey(checklist.id, credentials), {
              kind: 'checklist-v1',
              checklist,
              lastModified: Date.now()
            }, credentials);
          case 2:
            _context17.n = 3;
            return saveKvIndex();
          case 3:
            return _context17.a(2, 'synced');
        }
      }, _callee17);
    }));
    return _backupChecklistToKv.apply(this, arguments);
  }
  function maybePullKvChecklists() {
    return _maybePullKvChecklists.apply(this, arguments);
  }
  function _maybePullKvChecklists() {
    _maybePullKvChecklists = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee18() {
      var force,
        credentials,
        now,
        index,
        remoteLists,
        fetchedRemoteIds,
        failedRemoteIds,
        _iterator2,
        _step2,
        entry,
        payload,
        checklist,
        changed,
        remoteEntries,
        pendingUploads,
        _iterator3,
        _step3,
        _checklist,
        entrySignature,
        nextIndex,
        _args18 = arguments,
        _t14,
        _t15,
        _t16,
        _t17,
        _t18;
      return _regenerator().w(function (_context18) {
        while (1) switch (_context18.p = _context18.n) {
          case 0:
            force = _args18.length > 0 && _args18[0] !== undefined ? _args18[0] : false;
            if (!window.gaChecklistHost) {
              _context18.n = 1;
              break;
            }
            return _context18.a(2);
          case 1:
            credentials = getCredentials();
            if (!(!credentials || kvPullInProgress)) {
              _context18.n = 2;
              break;
            }
            return _context18.a(2);
          case 2:
            now = Date.now();
            if (!(!force && now - lastKvPullAt < 60000)) {
              _context18.n = 3;
              break;
            }
            return _context18.a(2);
          case 3:
            kvPullInProgress = true;
            lastKvPullAt = now;
            _context18.p = 4;
            _context18.n = 5;
            return kvGet(kvIndexKey(credentials), credentials);
          case 5:
            _t14 = _context18.v;
            if (_t14) {
              _context18.n = 6;
              break;
            }
            _t14 = {
              kind: 'checklist-index-v1',
              lastModified: 0,
              entries: []
            };
          case 6:
            index = _t14;
            if (Array.isArray(index.entries)) {
              _context18.n = 7;
              break;
            }
            return _context18.a(2);
          case 7:
            remoteLists = [];
            fetchedRemoteIds = new Set();
            failedRemoteIds = new Set();
            _iterator2 = _createForOfIteratorHelper(index.entries.slice(0, 80));
            _context18.p = 8;
            _iterator2.s();
          case 9:
            if ((_step2 = _iterator2.n()).done) {
              _context18.n = 14;
              break;
            }
            entry = _step2.value;
            _context18.p = 10;
            _context18.n = 11;
            return kvGet(kvChecklistKey(entry.id, credentials), credentials);
          case 11:
            payload = _context18.v;
            checklist = sanitizeCustomList((payload === null || payload === void 0 ? void 0 : payload.checklist) || payload);
            if (checklist) {
              remoteLists.push(checklist);
              fetchedRemoteIds.add(checklist.id);
            }
            _context18.n = 13;
            break;
          case 12:
            _context18.p = 12;
            _t15 = _context18.v;
            failedRemoteIds.add(String((entry === null || entry === void 0 ? void 0 : entry.id) || ''));
          case 13:
            _context18.n = 9;
            break;
          case 14:
            _context18.n = 16;
            break;
          case 15:
            _context18.p = 15;
            _t16 = _context18.v;
            _iterator2.e(_t16);
          case 16:
            _context18.p = 16;
            _iterator2.f();
            return _context18.f(16);
          case 17:
            changed = false;
            remoteLists.forEach(remote => {
              var idx = customLists.findIndex(local => local.id === remote.id);
              if (idx < 0) {
                customLists.push(remote);
                changed = true;
              } else if (Number(remote.updatedAt || 0) > Number(customLists[idx].updatedAt || 0)) {
                customLists[idx] = remote;
                changed = true;
              }
            });
            if (changed) {
              saveCustomLists();
              if (state.view === 'list' || state.view === 'manager' || state.view === 'home') render();
              setStatus('Cloud-Listen aktualisiert.', 'good');
            }

            // Der Cloud-Index war historisch nicht fuer alle bereits lokal
            // vorhandenen Listen vollstaendig. Nach dem nicht-destruktiven Pull
            // wird deshalb nur das hochgeladen, was fehlt oder lokal neuer ist.
            // Fehlgeschlagene Remote-Abrufe werden dabei nie ueberschrieben.
            remoteEntries = new Map(index.entries.map(entry => [String((entry === null || entry === void 0 ? void 0 : entry.id) || ''), entry]));
            pendingUploads = customLists.filter(checklist => {
              var remote = remoteEntries.get(checklist.id);
              if (failedRemoteIds.has(checklist.id)) return false;
              if (!remote || !fetchedRemoteIds.has(checklist.id)) return true;
              return Number(checklist.updatedAt || 0) > Number(remote.updatedAt || 0);
            });
            _iterator3 = _createForOfIteratorHelper(pendingUploads);
            _context18.p = 18;
            _iterator3.s();
          case 19:
            if ((_step3 = _iterator3.n()).done) {
              _context18.n = 21;
              break;
            }
            _checklist = _step3.value;
            _context18.n = 20;
            return kvPut(kvChecklistKey(_checklist.id, credentials), {
              kind: 'checklist-v1',
              checklist: _checklist,
              lastModified: Date.now()
            }, credentials);
          case 20:
            _context18.n = 19;
            break;
          case 21:
            _context18.n = 23;
            break;
          case 22:
            _context18.p = 22;
            _t17 = _context18.v;
            _iterator3.e(_t17);
          case 23:
            _context18.p = 23;
            _iterator3.f();
            return _context18.f(23);
          case 24:
            entrySignature = entries => JSON.stringify((entries || []).map(entry => ({
              id: String((entry === null || entry === void 0 ? void 0 : entry.id) || ''),
              updatedAt: Number((entry === null || entry === void 0 ? void 0 : entry.updatedAt) || 0),
              chapterCount: Number((entry === null || entry === void 0 ? void 0 : entry.chapterCount) || 0),
              itemCount: Number((entry === null || entry === void 0 ? void 0 : entry.itemCount) || 0),
              published: !!(entry !== null && entry !== void 0 && entry.published),
              communityId: String((entry === null || entry === void 0 ? void 0 : entry.communityId) || '')
            })).sort((a, b) => a.id.localeCompare(b.id)));
            nextIndex = kvIndexPayload(credentials);
            if (!(pendingUploads.length || entrySignature(index.entries) !== entrySignature(nextIndex.entries))) {
              _context18.n = 26;
              break;
            }
            _context18.n = 25;
            return kvPut(kvIndexKey(credentials), nextIndex, credentials);
          case 25:
            if (!changed && (state.view === 'list' || state.view === 'manager')) {
              setStatus('Lokale Listen in der Cloud ergänzt.', 'good');
            }
          case 26:
            _context18.n = 28;
            break;
          case 27:
            _context18.p = 27;
            _t18 = _context18.v;
            if (state.view === 'list' || state.view === 'manager') setStatus('Cloud-Listen nicht erreichbar.', 'warn');
          case 28:
            _context18.p = 28;
            kvPullInProgress = false;
            return _context18.f(28);
          case 29:
            return _context18.a(2);
        }
      }, _callee18, null, [[18, 22, 23, 24], [10, 12], [8, 15, 16, 17], [4, 27, 28, 29]]);
    }));
    return _maybePullKvChecklists.apply(this, arguments);
  }
  function maybePullCommunity() {
    return _maybePullCommunity.apply(this, arguments);
  }
  function _maybePullCommunity() {
    _maybePullCommunity = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee19() {
      var force,
        now,
        _window$gaRunWhenAwak,
        _window8,
        res,
        data,
        nextMeta,
        known,
        _args19 = arguments,
        _t19;
      return _regenerator().w(function (_context19) {
        while (1) switch (_context19.p = _context19.n) {
          case 0:
            force = _args19.length > 0 && _args19[0] !== undefined ? _args19[0] : false;
            if (!window.gaChecklistHost) {
              _context19.n = 1;
              break;
            }
            return _context19.a(2);
          case 1:
            if (!communityPullInProgress) {
              _context19.n = 2;
              break;
            }
            return _context19.a(2);
          case 2:
            now = Date.now();
            if (!(!force && !isCommunityUiActive())) {
              _context19.n = 3;
              break;
            }
            return _context19.a(2);
          case 3:
            if (!isNetworkSleeping('checklists.community')) {
              _context19.n = 4;
              break;
            }
            (_window$gaRunWhenAwak = (_window8 = window).gaRunWhenAwake) === null || _window$gaRunWhenAwak === void 0 || _window$gaRunWhenAwak.call(_window8, 'checklists-community', () => maybePullCommunity(true));
            return _context19.a(2);
          case 4:
            if (!(!force && now - lastCommunityPullAt < COMMUNITY_POLL_INTERVAL_MS)) {
              _context19.n = 5;
              break;
            }
            return _context19.a(2);
          case 5:
            if (acquireCommunityPollLock(force)) {
              _context19.n = 6;
              break;
            }
            return _context19.a(2);
          case 6:
            communityPullInProgress = true;
            lastCommunityPullAt = now;
            _context19.p = 7;
            _context19.n = 8;
            return fetch(`${getCommunityApiUrl()}?limit=120&t=${Date.now()}`, {
              cache: 'no-store'
            });
          case 8:
            res = _context19.v;
            if (res.ok) {
              _context19.n = 9;
              break;
            }
            throw new Error(`community_${res.status}`);
          case 9:
            _context19.n = 10;
            return res.json();
          case 10:
            data = _context19.v;
            nextMeta = Array.isArray(data.items) ? data.items.map(sanitizeCommunityMeta).filter(Boolean) : [];
            known = new Set(nextMeta.map(meta => meta.id));
            Object.keys(communitySubscriptions).forEach(id => {
              if (!known.has(id)) {
                delete communitySubscriptions[id];
                delete communityCache[id];
              }
            });
            communityMeta = nextMeta;
            saveCommunityState();
            _context19.n = 11;
            return refreshSubscribedCommunityContent(false);
          case 11:
            if (state.view === 'manager' || state.view === 'list' || state.view === 'home') render();
            _context19.n = 13;
            break;
          case 12:
            _context19.p = 12;
            _t19 = _context19.v;
            if (state.view === 'manager') setStatus('Community nicht erreichbar.', 'warn');
          case 13:
            _context19.p = 13;
            communityPullInProgress = false;
            return _context19.f(13);
          case 14:
            return _context19.a(2);
        }
      }, _callee19, null, [[7, 12, 13, 14]]);
    }));
    return _maybePullCommunity.apply(this, arguments);
  }
  function ensureCommunityDetail(_x26) {
    return _ensureCommunityDetail.apply(this, arguments);
  }
  function _ensureCommunityDetail() {
    _ensureCommunityDetail = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee20(id) {
      var meta, cached, res, data, checklist;
      return _regenerator().w(function (_context20) {
        while (1) switch (_context20.n) {
          case 0:
            meta = communityMeta.find(item => item.id === id);
            cached = communityCache[id];
            if (!(cached && (!meta || Number(cached.communityUpdatedAt || 0) >= Number(meta.updatedAt || 0)))) {
              _context20.n = 1;
              break;
            }
            return _context20.a(2, cached);
          case 1:
            _context20.n = 2;
            return fetch(`${getCommunityApiUrl(`/${encodeURIComponent(id)}`)}?t=${Date.now()}`, {
              cache: 'no-store'
            });
          case 2:
            res = _context20.v;
            if (res.ok) {
              _context20.n = 3;
              break;
            }
            throw new Error(`community_detail_${res.status}`);
          case 3:
            _context20.n = 4;
            return res.json();
          case 4:
            data = _context20.v;
            checklist = communityChecklistFromRecord(data.checklist || data);
            if (checklist) {
              _context20.n = 5;
              break;
            }
            throw new Error('community_detail_invalid');
          case 5:
            communityCache[id] = checklist;
            saveCommunityState();
            pruneProgress(checklist);
            return _context20.a(2, checklist);
        }
      }, _callee20);
    }));
    return _ensureCommunityDetail.apply(this, arguments);
  }
  function refreshSubscribedCommunityContent() {
    return _refreshSubscribedCommunityContent.apply(this, arguments);
  }
  function _refreshSubscribedCommunityContent() {
    _refreshSubscribedCommunityContent = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee21() {
      var force,
        ids,
        _iterator4,
        _step4,
        _loop,
        _args22 = arguments,
        _t21;
      return _regenerator().w(function (_context22) {
        while (1) switch (_context22.p = _context22.n) {
          case 0:
            force = _args22.length > 0 && _args22[0] !== undefined ? _args22[0] : false;
            ids = Object.keys(communitySubscriptions).filter(id => communitySubscriptions[id]);
            _iterator4 = _createForOfIteratorHelper(ids);
            _context22.p = 1;
            _loop = /*#__PURE__*/_regenerator().m(function _loop() {
              var id, meta, cached, _t20;
              return _regenerator().w(function (_context21) {
                while (1) switch (_context21.p = _context21.n) {
                  case 0:
                    id = _step4.value;
                    meta = communityMeta.find(item => item.id === id);
                    cached = communityCache[id];
                    if (!(!force && cached && meta && Number(cached.communityUpdatedAt || 0) >= Number(meta.updatedAt || 0))) {
                      _context21.n = 1;
                      break;
                    }
                    return _context21.a(2, 1);
                  case 1:
                    _context21.p = 1;
                    _context21.n = 2;
                    return ensureCommunityDetail(id);
                  case 2:
                    _context21.n = 4;
                    break;
                  case 3:
                    _context21.p = 3;
                    _t20 = _context21.v;
                  case 4:
                    return _context21.a(2);
                }
              }, _loop, null, [[1, 3]]);
            });
            _iterator4.s();
          case 2:
            if ((_step4 = _iterator4.n()).done) {
              _context22.n = 5;
              break;
            }
            return _context22.d(_regeneratorValues(_loop()), 3);
          case 3:
            if (!_context22.v) {
              _context22.n = 4;
              break;
            }
            return _context22.a(3, 4);
          case 4:
            _context22.n = 2;
            break;
          case 5:
            _context22.n = 7;
            break;
          case 6:
            _context22.p = 6;
            _t21 = _context22.v;
            _iterator4.e(_t21);
          case 7:
            _context22.p = 7;
            _iterator4.f();
            return _context22.f(7);
          case 8:
            return _context22.a(2);
        }
      }, _callee21, null, [[1, 6, 7, 8]]);
    }));
    return _refreshSubscribedCommunityContent.apply(this, arguments);
  }
  function setCommunitySubscribed(_x27, _x28) {
    return _setCommunitySubscribed.apply(this, arguments);
  }
  function _setCommunitySubscribed() {
    _setCommunitySubscribed = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee22(id, subscribed) {
      var _t22;
      return _regenerator().w(function (_context23) {
        while (1) switch (_context23.p = _context23.n) {
          case 0:
            if (!subscribed) {
              _context23.n = 5;
              break;
            }
            communitySubscriptions[id] = true;
            setStatus('Lade Community-Liste...', '');
            _context23.p = 1;
            _context23.n = 2;
            return ensureCommunityDetail(id);
          case 2:
            setStatus('Community-Liste abonniert.', 'good');
            _context23.n = 4;
            break;
          case 3:
            _context23.p = 3;
            _t22 = _context23.v;
            delete communitySubscriptions[id];
            setStatus('Community-Liste nicht erreichbar.', 'error');
          case 4:
            _context23.n = 6;
            break;
          case 5:
            delete communitySubscriptions[id];
            delete communityCache[id];
            setStatus('Community-Liste abbestellt.', 'good');
          case 6:
            saveCommunityState();
            render();
          case 7:
            return _context23.a(2);
        }
      }, _callee22, null, [[1, 3]]);
    }));
    return _setCommunitySubscribed.apply(this, arguments);
  }
  function copyCommunity(_x29) {
    return _copyCommunity.apply(this, arguments);
  }
  function _copyCommunity() {
    _copyCommunity = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee23(id) {
      var checklist, _t23;
      return _regenerator().w(function (_context24) {
        while (1) switch (_context24.p = _context24.n) {
          case 0:
            _context24.p = 0;
            _context24.n = 1;
            return ensureCommunityDetail(id);
          case 1:
            checklist = _context24.v;
            _context24.n = 2;
            return copyChecklistToCustom(checklist);
          case 2:
            _context24.n = 4;
            break;
          case 3:
            _context24.p = 3;
            _t23 = _context24.v;
            setStatus('Community-Kopie nicht möglich.', 'error');
          case 4:
            return _context24.a(2);
        }
      }, _callee23, null, [[0, 3]]);
    }));
    return _copyCommunity.apply(this, arguments);
  }
  function copyChecklistToCustom(_x30) {
    return _copyChecklistToCustom.apply(this, arguments);
  }
  function _copyChecklistToCustom() {
    _copyChecklistToCustom = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee24(source) {
      var _copy$chapters$;
      var copy, _t24;
      return _regenerator().w(function (_context25) {
        while (1) switch (_context25.p = _context25.n) {
          case 0:
            if (source) {
              _context25.n = 1;
              break;
            }
            return _context25.a(2);
          case 1:
            copy = copyChecklistForEditing(source);
            upsertCustom(copy);
            state.selectedId = copy.id;
            state.activeChapterId = ((_copy$chapters$ = copy.chapters[0]) === null || _copy$chapters$ === void 0 ? void 0 : _copy$chapters$.id) || '';
            state.view = 'viewer';
            state.actionMenuOpen = false;
            persistUiState();
            setStatus('Als eigene Kopie hinzugefügt.', 'good');
            render();
            _context25.p = 2;
            _context25.n = 3;
            return backupChecklistToKv(copy);
          case 3:
            _context25.n = 5;
            break;
          case 4:
            _context25.p = 4;
            _t24 = _context25.v;
          case 5:
            return _context25.a(2);
        }
      }, _callee24, null, [[2, 4]]);
    }));
    return _copyChecklistToCustom.apply(this, arguments);
  }
  function publicChecklistPayload(checklist) {
    return {
      id: checklist.communityId || checklist.id,
      title: checklist.title,
      updatedAt: checklist.updatedAt,
      chapters: checklist.chapters.map(chapter => ({
        id: chapter.id,
        title: chapter.title,
        items: chapter.items.map(item => ({
          id: item.id,
          text: item.text
        }))
      }))
    };
  }
  function communityResponseError(_x31, _x32) {
    return _communityResponseError.apply(this, arguments);
  }
  function _communityResponseError() {
    _communityResponseError = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee25(res, fallback) {
      var message, data, text, error, _t25, _t26;
      return _regenerator().w(function (_context26) {
        while (1) switch (_context26.p = _context26.n) {
          case 0:
            message = fallback || `community_${res.status}`;
            _context26.p = 1;
            _context26.n = 2;
            return res.json();
          case 2:
            data = _context26.v;
            message = (data === null || data === void 0 ? void 0 : data.error) || (data === null || data === void 0 ? void 0 : data.message) || message;
            _context26.n = 7;
            break;
          case 3:
            _context26.p = 3;
            _t25 = _context26.v;
            _context26.p = 4;
            _context26.n = 5;
            return res.text();
          case 5:
            text = _context26.v;
            if (text) message = text.slice(0, 180);
            _context26.n = 7;
            break;
          case 6:
            _context26.p = 6;
            _t26 = _context26.v;
          case 7:
            error = new Error(message);
            error.status = res.status;
            return _context26.a(2, error);
        }
      }, _callee25, null, [[4, 6], [1, 3]]);
    }));
    return _communityResponseError.apply(this, arguments);
  }
  function communityStatusMessage(error) {
    var status = Number((error === null || error === void 0 ? void 0 : error.status) || 0);
    var message = String((error === null || error === void 0 ? void 0 : error.message) || '');
    if (status === 401) return 'Community: Pilot-ID/PIN nicht bestätigt.';
    if (status === 403) return 'Community: Nur der Ersteller darf das ändern.';
    if (status === 404 || /not found|unexpected token/i.test(message)) return 'Community-Worker noch nicht aktualisiert.';
    if (status === 503) return 'Community: KV-Binding fehlt im Worker.';
    if (status >= 500) return 'Community-Serverfehler.';
    if (/failed to fetch|network/i.test(message)) return 'Community nicht erreichbar.';
    return 'Community-Änderung fehlgeschlagen.';
  }
  function publishCommunityChecklist(_x33) {
    return _publishCommunityChecklist.apply(this, arguments);
  }
  function _publishCommunityChecklist() {
    _publishCommunityChecklist = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee26(checklist) {
      var credentials, res, data, communityId, idx;
      return _regenerator().w(function (_context27) {
        while (1) switch (_context27.n) {
          case 0:
            credentials = getCredentials();
            if (credentials) {
              _context27.n = 1;
              break;
            }
            throw new Error('publish_requires_login');
          case 1:
            _context27.n = 2;
            return fetch(getCommunityApiUrl(), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Pilot-ID': credentials.id,
                'X-Pilot-PIN': credentials.pin
              },
              body: JSON.stringify({
                action: 'publish',
                checklist: publicChecklistPayload(checklist)
              })
            });
          case 2:
            res = _context27.v;
            if (res.ok) {
              _context27.n = 4;
              break;
            }
            _context27.n = 3;
            return communityResponseError(res, `publish_${res.status}`);
          case 3:
            throw _context27.v;
          case 4:
            _context27.n = 5;
            return res.json();
          case 5:
            data = _context27.v;
            communityId = data.id || checklist.communityId || checklist.id;
            idx = customLists.findIndex(item => item.id === checklist.id);
            if (idx >= 0) {
              customLists[idx].published = true;
              customLists[idx].communityId = communityId;
              customLists[idx].communityUpdatedAt = data.updatedAt ? Number(data.updatedAt) : Date.now();
              saveCustomLists();
            }
            _context27.n = 6;
            return maybePullCommunity(true);
          case 6:
            return _context27.a(2, data);
        }
      }, _callee26);
    }));
    return _publishCommunityChecklist.apply(this, arguments);
  }
  function unpublishCommunityChecklist(_x34) {
    return _unpublishCommunityChecklist.apply(this, arguments);
  }
  function _unpublishCommunityChecklist() {
    _unpublishCommunityChecklist = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee27(checklist) {
      var credentials, id, res;
      return _regenerator().w(function (_context28) {
        while (1) switch (_context28.n) {
          case 0:
            credentials = getCredentials();
            if (!(!credentials || !(checklist.communityId || checklist.id))) {
              _context28.n = 1;
              break;
            }
            throw new Error('unpublish_requires_login');
          case 1:
            id = checklist.communityId || checklist.id;
            _context28.n = 2;
            return fetch(getCommunityApiUrl(), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Pilot-ID': credentials.id,
                'X-Pilot-PIN': credentials.pin
              },
              body: JSON.stringify({
                action: 'unpublish',
                id
              })
            });
          case 2:
            res = _context28.v;
            if (res.ok) {
              _context28.n = 4;
              break;
            }
            _context28.n = 3;
            return communityResponseError(res, `unpublish_${res.status}`);
          case 3:
            throw _context28.v;
          case 4:
            delete communitySubscriptions[id];
            delete communityCache[id];
            communityMeta = communityMeta.filter(meta => meta.id !== id);
            saveCommunityState();
            return _context28.a(2, res.json());
        }
      }, _callee27);
    }));
    return _unpublishCommunityChecklist.apply(this, arguments);
  }
  function setCustomPublished(_x35, _x36) {
    return _setCustomPublished.apply(this, arguments);
  }
  function _setCustomPublished() {
    _setCustomPublished = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee28(id, published) {
      var checklist, idx, previous, _t27;
      return _regenerator().w(function (_context29) {
        while (1) switch (_context29.p = _context29.n) {
          case 0:
            checklist = getChecklist(id);
            if (!(!checklist || checklist.source !== 'custom')) {
              _context29.n = 1;
              break;
            }
            return _context29.a(2);
          case 1:
            if (!(published && !getCredentials())) {
              _context29.n = 2;
              break;
            }
            setStatus('Veröffentlichen braucht Pilot-ID/PIN Login.', 'error');
            render();
            return _context29.a(2);
          case 2:
            idx = customLists.findIndex(item => item.id === id);
            if (!(idx < 0)) {
              _context29.n = 3;
              break;
            }
            return _context29.a(2);
          case 3:
            previous = clone(customLists[idx]);
            customLists[idx].published = !!published;
            if (published && !customLists[idx].communityId) customLists[idx].communityId = customLists[idx].id;
            customLists[idx].updatedAt = Date.now();
            saveCustomLists();
            _context29.p = 4;
            if (!published) {
              _context29.n = 6;
              break;
            }
            _context29.n = 5;
            return publishCommunityChecklist(customLists[idx]);
          case 5:
            setStatus('Veröffentlicht.', 'good');
            _context29.n = 8;
            break;
          case 6:
            _context29.n = 7;
            return unpublishCommunityChecklist(previous);
          case 7:
            customLists[idx].published = false;
            saveCustomLists();
            setStatus('Veröffentlichung entfernt.', 'good');
          case 8:
            _context29.n = 9;
            return backupChecklistToKv(customLists[idx]);
          case 9:
            _context29.n = 11;
            break;
          case 10:
            _context29.p = 10;
            _t27 = _context29.v;
            customLists[idx] = previous;
            saveCustomLists();
            setStatus(communityStatusMessage(_t27), 'error');
          case 11:
            render();
          case 12:
            return _context29.a(2);
        }
      }, _callee28, null, [[4, 10]]);
    }));
    return _setCustomPublished.apply(this, arguments);
  }
  function handleClick(event) {
    var _window$gaChecklistHo0;
    var button = event.target.closest('[data-action]');
    if (!button || !bodyEl.contains(button)) return;
    if (button.disabled || button.getAttribute('aria-disabled') === 'true') return;
    var action = button.dataset.action;
    if ((_window$gaChecklistHo0 = window.gaChecklistHost) !== null && _window$gaChecklistHo0 !== void 0 && _window$gaChecklistHo0.cargoAction && ['cargo-load', 'cargo-unload', 'cargo-replace', 'cargo-boardbook-time'].includes(action)) {
      var itemId = button.dataset.itemId || '';
      button.disabled = true;
      setStatus('Tracker verarbeitet die Aktion …');
      Promise.resolve(window.gaChecklistHost.cargoAction(action, itemId, button.dataset.field)).then(ok => setStatus(ok ? 'Aktion bestätigt.' : 'Aktion konnte nicht ausgeführt werden.', ok ? 'good' : 'warn')).catch(() => setStatus('Tracker-Aktion fehlgeschlagen.', 'warn')).finally(() => render());
      return;
    }
    var id = button.dataset.id || '';
    var chapterIndex = Number(button.dataset.chapterIndex);
    var itemIndex = Number(button.dataset.itemIndex);
    var dir = Number(button.dataset.dir || 0);
    if (action === 'home') {
      abortOtherToolRequests('');
      state.view = 'home';
      state.editorDraft = null;
      state.actionMenuOpen = false;
      state.nearestMenuKey = '';
      state.placeInfoAirport = null;
      setStatus('');
      render();
    } else if (action === 'open-tool') {
      openTool(button.dataset.tool || '', false);
    } else if (action === 'refresh-tool') {
      openTool(button.dataset.tool || state.view, true);
    } else if (action === 'toggle-mission-story') {
      state.missionStoryExpanded = !state.missionStoryExpanded;
      render();
    } else if (action === 'mission-control-open-cargo') {
      var _window$gaTrackerExec2;
      var phase = String(((_window$gaTrackerExec2 = window.gaTrackerExecutionControl) === null || _window$gaTrackerExec2 === void 0 ? void 0 : _window$gaTrackerExec2.phase) || '').toLowerCase();
      var cargoMode = phase === 'on_task' ? 'pickup' : /^(arrival|end_unloading|end_ready|closing)$/.test(phase) ? 'unload' : 'load';
      if (typeof window.openMissionCargoDialog === 'function') window.openMissionCargoDialog(cargoMode);
    } else if (action === 'mission-control-intent') {
      var _window$gaTrackerExec3, _window7;
      var intent = String(button.dataset.missionIntent || '');
      if (!intent || window.gaMissionControlIntentPending === true) return;
      var confirmed = true;
      if (intent === 'abort_mission') {
        var _window$GAMissionCont2;
        var prompt = typeof ((_window$GAMissionCont2 = window.GAMissionControlUiCore) === null || _window$GAMissionCont2 === void 0 ? void 0 : _window$GAMissionCont2.abortConfirmation) === 'function' ? window.GAMissionControlUiCore.abortConfirmation() : 'Mission wirklich abbrechen?';
        try {
          confirmed = window.confirm(prompt);
        } catch (_) {
          confirmed = false;
        }
      }
      if (!confirmed) return;
      var submit = intent === 'abort_mission' && typeof window.gaAbortTrackerMission === 'function' ? window.gaAbortTrackerMission({
        skipConfirm: true,
        reason: 'mission-control'
      }) : (_window$gaTrackerExec3 = (_window7 = window).gaTrackerExecutionSubmitIntent) === null || _window$gaTrackerExec3 === void 0 ? void 0 : _window$gaTrackerExec3.call(_window7, intent);
      Promise.resolve(submit).finally(() => {
        if (state.view === 'mission') render();
      });
    } else if (action === 'open-list') {
      abortOtherToolRequests('');
      openList();
    } else if (action === 'open-checklist') {
      openChecklist(id).catch(() => setStatus('Checkliste nicht erreichbar.', 'error'));
    } else if (action === 'manager') {
      state.view = 'manager';
      state.actionMenuOpen = false;
      setStatus('');
      render();
    } else if (action === 'refresh-community') {
      maybePullCommunity(true);
    } else if (action === 'move-checklist-order') {
      if (moveChecklistOrder(id, dir)) {
        setStatus('Reihenfolge gespeichert.', 'good');
        render();
      }
    } else if (action === 'tab') {
      state.activeChapterId = id;
      persistUiState();
      render();
    } else if (action === 'new') {
      openNewEditor();
    } else if (action === 'edit') {
      openEditEditor(id);
    } else if (action === 'copy') {
      copyChecklistToCustom(getChecklist(id));
    } else if (action === 'copy-community') {
      copyCommunity(id);
    } else if (action === 'delete') {
      deleteChecklist(id);
    } else if (action === 'reset-progress') {
      resetProgress(id);
    } else if (action === 'export') {
      exportChecklist(id);
    } else if (action === 'import-open') {
      state.view = 'import';
      state.actionMenuOpen = false;
      setStatus('');
      render();
    } else if (action === 'import-run') {
      importChecklist();
    } else if (action === 'toggle-actions') {
      state.actionMenuOpen = !state.actionMenuOpen;
      render();
    } else if (action === 'unsubscribe-community') {
      setCommunitySubscribed(id, false);
    } else if (action === 'cancel-editor') {
      if (state.selectedId) openChecklist(state.selectedId);else openList();
    } else if (action === 'save-editor') {
      saveEditorDraft();
    } else if (action === 'add-chapter') {
      addChapter();
    } else if (action === 'move-chapter') {
      var _state$editorDraft4;
      if (moveInArray((_state$editorDraft4 = state.editorDraft) === null || _state$editorDraft4 === void 0 ? void 0 : _state$editorDraft4.chapters, chapterIndex, dir)) render();
    } else if (action === 'duplicate-chapter') {
      duplicateChapter(chapterIndex);
    } else if (action === 'delete-chapter') {
      deleteChapter(chapterIndex);
    } else if (action === 'add-item') {
      addItem(chapterIndex);
    } else if (action === 'move-item') {
      var _state$editorDraft5;
      var items = (_state$editorDraft5 = state.editorDraft) === null || _state$editorDraft5 === void 0 || (_state$editorDraft5 = _state$editorDraft5.chapters) === null || _state$editorDraft5 === void 0 || (_state$editorDraft5 = _state$editorDraft5[chapterIndex]) === null || _state$editorDraft5 === void 0 ? void 0 : _state$editorDraft5.items;
      if (moveInArray(items, itemIndex, dir)) render();
    } else if (action === 'duplicate-item') {
      duplicateItem(chapterIndex, itemIndex);
    } else if (action === 'delete-item') {
      deleteItem(chapterIndex, itemIndex);
    } else if (action === 'nearest-menu') {
      state.nearestMenuKey = state.nearestMenuKey === button.dataset.key ? '' : button.dataset.key || '';
      render();
    } else if (action === 'radio-airport-menu') {
      state.radioAirportMenuKey = state.radioAirportMenuKey === button.dataset.key ? '' : button.dataset.key || '';
      render();
    } else if (action === 'place-map-layer') {
      togglePlaceMapLayer(button.dataset.layer || 'vfr');
    } else if (action === 'place-map-expand') {
      var apt = decodeAirportDataset(button);
      if (!apt) return;
      openExpandedPlaceMap(apt);
    } else if (action === 'nearest-direct') {
      var _apt = decodeAirportDataset(button);
      if (!_apt) return;
      setStatus(`Direct To ${_apt.icao}...`);
      Promise.resolve().then(() => {
        if (typeof applyAirportDirectTo === 'function') {
          var forceGpsStart = typeof isGpsLive === 'function' ? isGpsLive() : !!getLiveAircraftPosition();
          return applyAirportDirectTo(_apt, {
            forceGpsStart
          });
        }
        if (typeof window.confirmAirportDirectTo === 'function') {
          return window.confirmAirportDirectTo(_apt.icao, _apt.lat, _apt.lon, encodeURIComponent(_apt.name || _apt.icao));
        }
        throw new Error('direct_to_unavailable');
      }).then(ok => setStatus(ok === false ? 'Direct To abgebrochen.' : `Direct To ${_apt.icao} aktiv.`, ok === false ? 'warn' : 'good')).catch(() => setStatus('Direct To nicht verfügbar.', 'error'));
    } else if (action === 'locate-airport') {
      var _apt2 = decodeAirportDataset(button);
      if (!_apt2) return;
      if (typeof window.gaFocusAirportOnMap === 'function') {
        window.gaFocusAirportOnMap(_apt2);
        setStatus(`${_apt2.icao || 'Platz'} auf Karte markiert.`, 'good');
      } else {
        setStatus('Kartenfokus nicht verfügbar.', 'error');
      }
    } else if (action === 'locate-airspace') {
      var idx = Number(button.dataset.asIdx);
      if (!Number.isInteger(idx)) return;
      if (typeof window.gaFocusAirspaceOnMap === 'function') {
        var ok = window.gaFocusAirspaceOnMap(idx);
        setStatus(ok === false ? 'Luftraum nicht verfügbar.' : 'Luftraum auf Karte markiert.', ok === false ? 'error' : 'good');
      } else if (typeof toggleAirspaceHighlight === 'function') {
        toggleAirspaceHighlight(idx);
        setStatus('Luftraum markiert.', 'good');
      } else {
        setStatus('Kartenfokus nicht verfügbar.', 'error');
      }
    } else if (action === 'airport-aip') {
      var _window$gaChecklistHo1;
      if ((_window$gaChecklistHo1 = window.gaChecklistHost) !== null && _window$gaChecklistHo1 !== void 0 && _window$gaChecklistHo1.openAip) {
        event.preventDefault();
        var _apt3 = decodeAirportDataset(button);
        if (_apt3) Promise.resolve(window.gaChecklistHost.openAip(_apt3)).then(() => setStatus('AIP im Browser geöffnet.', 'good')).catch(() => setStatus('AIP konnte nicht geöffnet werden.', 'warn'));
      }
    } else if (action === 'airport-info') {
      var _apt4 = decodeAirportDataset(button);
      if (!_apt4) return;
      state.placeInfoAirport = _apt4;
      state.placeInfoReturn = state.view === 'nearest' || state.view === 'radio' ? state.view : 'place';
      state.view = 'airport-info';
      state.nearestMenuKey = '';
      state.radioAirportMenuKey = '';
      setStatus('');
      if (typeof fetchAirportFreq === 'function' && _apt4.icao && !getFreqLines(_apt4.icao).length) {
        fetchAirportFreq(_apt4.icao, null, null).catch(() => null);
      }
      if (typeof fetchRunwayDetails === 'function' && _apt4.icao && !getRunwayText(_apt4.icao) && Number.isFinite(_apt4.lat) && Number.isFinite(_apt4.lon)) {
        var rid = `routeToolHiddenRwy_${_apt4.icao}`;
        var hidden = document.getElementById(rid);
        if (!hidden) {
          hidden = document.createElement('div');
          hidden.id = rid;
          hidden.style.display = 'none';
          document.body.appendChild(hidden);
        }
        fetchRunwayDetails(_apt4.lat, _apt4.lon, rid, _apt4.icao).catch(() => null);
      }
      render();
      setTimeout(() => {
        if (state.view === 'airport-info') render();
      }, 900);
    } else if (action === 'cargo-toggle-detail') {
      var _itemId = button.dataset.itemId || '';
      state.cargoExpandedItemId = state.cargoExpandedItemId === _itemId ? '' : _itemId;
      render();
    } else if (action === 'cargo-load') {
      var _itemId2 = button.dataset.itemId || '';
      var _ok = typeof window.missionCargoLoadItem === 'function' && window.missionCargoLoadItem(_itemId2, {
        render: false
      });
      setStatus(_ok ? 'Ladung als geladen markiert.' : 'Ladung konnte nicht geladen werden.', _ok ? 'good' : 'warn');
      render();
    } else if (action === 'cargo-unload') {
      var _itemId3 = button.dataset.itemId || '';
      var airborne = cargoIsAirborne();
      var _ok2 = typeof window.missionCargoUnloadItem === 'function' && window.missionCargoUnloadItem(_itemId3, {
        render: false,
        drop: airborne
      });
      setStatus(_ok2 ? airborne ? 'Ladung abgeworfen.' : 'Ladung entladen und am Cargo-Spot abgestellt.' : 'Ladung konnte nicht entladen werden.', _ok2 ? 'good' : 'warn');
      render();
    } else if (action === 'cargo-replace') {
      var _itemId4 = button.dataset.itemId || '';
      var _ok3 = typeof window.missionCargoReplaceEquipment === 'function' && window.missionCargoReplaceEquipment(_itemId4);
      setStatus(_ok3 ? 'Gegenstand durch ein neues Exemplar ersetzt.' : 'Austausch derzeit nicht moeglich.', _ok3 ? 'good' : 'warn');
      render();
    } else if (action === 'cargo-open-modal') {
      if (typeof window.openMissionGroundCargoDialog === 'function') {
        var opened = window.openMissionGroundCargoDialog();
        setStatus(opened ? 'Verladefenster geöffnet.' : 'Verladefenster ist nur am Boden und im Stillstand verfügbar.', opened ? 'good' : 'warn');
      } else if (typeof window.openMissionCargoDialog === 'function') {
        window.openMissionCargoDialog('load');
        setStatus('Verladefenster geöffnet.', 'good');
      } else {
        setStatus('Verladefenster nicht verfügbar.', 'error');
      }
    } else if (action === 'cargo-refresh-payload') {
      var req = cargoPayloadRequest(true);
      if (req === 'started') setStatus('Sim-Gewichte werden aktualisiert ...');else if (req === 'tracker_offline') setStatus('Tracker nicht verbunden.', 'warn');else if (req === 'sim_offline') setStatus('Simulator liefert keine Live-Daten.', 'warn');else if (req === 'sim_mode') setStatus('Im Sim-Mode nicht verfügbar.', 'warn');else if (req === 'busy') setStatus('Abruf läuft bereits ...');else if (req === 'cached') setStatus('Sim-Gewichte sind aktuell.', 'good');else setStatus('Sim-Gewichte aktuell nicht verfügbar.', 'warn');
    } else if (action === 'cargo-boardbook-time') {
      var _itemId5 = button.dataset.itemId || '';
      var field = button.dataset.field || 'start';
      var _ok4 = typeof window.missionCargoSetBoardBookTime === 'function' && window.missionCargoSetBoardBookTime(_itemId5, field, {
        source: 'side-menu'
      });
      setStatus(_ok4 ? 'Bordbuch aktualisiert.' : 'Bordbuch konnte nicht aktualisiert werden.', _ok4 ? 'good' : 'warn');
      render();
    }
  }
  function handleInput(event) {
    var field = event.target.dataset.field;
    var draft = state.editorDraft;
    if (!field || !draft) return;
    if (field === 'title') draft.title = event.target.value;
    if (field === 'chapter-title') {
      var chapter = draft.chapters[Number(event.target.dataset.chapterIndex)];
      if (chapter) chapter.title = event.target.value;
    }
    if (field === 'item-text') {
      var _chapter$items;
      var _chapter = draft.chapters[Number(event.target.dataset.chapterIndex)];
      var item = _chapter === null || _chapter === void 0 || (_chapter$items = _chapter.items) === null || _chapter$items === void 0 ? void 0 : _chapter$items[Number(event.target.dataset.itemIndex)];
      if (item) item.text = event.target.value;
    }
  }
  function handleChange(event) {
    var action = event.target.dataset.action;
    var field = event.target.dataset.field;
    if (action === 'toggle-item') {
      toggleItem(event.target.dataset.itemId, event.target.checked);
    } else if (action === 'toggle-visible') {
      setChecklistVisible(event.target.dataset.id, event.target.checked);
      render();
    } else if (action === 'toggle-community-sub') {
      setCommunitySubscribed(event.target.dataset.id, event.target.checked);
    } else if (action === 'toggle-publish-viewer') {
      setCustomPublished(event.target.dataset.id, event.target.checked);
    } else if (field === 'published' && state.editorDraft) {
      state.editorDraft.published = event.target.checked;
    }
  }
  function initDrawerEvents() {
    if (!drawerEl) return;
    ['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick', 'wheel'].forEach(type => {
      drawerEl.addEventListener(type, event => event.stopPropagation(), {
        passive: true
      });
    });
    bodyEl.addEventListener('click', handleClick);
    bodyEl.addEventListener('input', handleInput);
    bodyEl.addEventListener('change', handleChange);
  }
  function init() {
    drawerEl = document.getElementById('mapSideDrawer');
    handleEl = document.getElementById('mapSideDrawerHandle');
    bodyEl = document.getElementById('checklistDrawerBody');
    titleEl = document.getElementById('checklistDrawerTitle');
    statusEl = document.getElementById('checklistDrawerStatus');
    if (!drawerEl || !bodyEl) return;
    loadStateFromStorage();
    initDrawerEvents();
    render();
    scheduleCustomChecklistsForTracker(600);
    maybePullKvChecklists(true);
    setInterval(() => {
      if (document.visibilityState === 'visible') maybePullCommunity(false);
    }, COMMUNITY_POLL_TIMER_MS);
  }
  window.gaChecklistToggleDrawer = function (force) {
    if (!drawerEl) return;
    var nextOpen = typeof force === 'boolean' ? force : !isDrawerOpen();
    setDrawerOpen(nextOpen);
    if (nextOpen) {
      if (state.view === 'list' || state.view === 'manager') maybePullCommunity(false);
      if (state.view === 'list') maybePullKvChecklists();
      if (state.view === 'weather') ensureWeatherTool(false);
      if (state.view === 'radio') ensureRadioTool(false);
      if (state.view === 'place') ensurePlaceTool(false);
      if (state.view === 'nearest') ensureNearestTool(false);
      if (state.view === 'cargo') render();
      if (state.view === 'mission') render();
    }
  };
  window.gaChecklistCloseDrawer = function () {
    setDrawerOpen(false);
  };
  window.gaChecklistPullKv = function () {
    return maybePullKvChecklists(true);
  };
  window.gaChecklistPullCommunity = function () {
    return maybePullCommunity(true);
  };
  window.addEventListener('missioncargochange', () => {
    if (state.view === 'cargo' || state.view === 'mission') render();
  });
  window.addEventListener('missioncargopayloadchange', () => {
    if (state.view === 'cargo') render();
  });
  window.addEventListener('missioncontrolchange', () => {
    if (state.view === 'mission') render();
  });
  window.addEventListener('ga-sleepchange', event => {
    var _event$detail;
    if (event !== null && event !== void 0 && (_event$detail = event.detail) !== null && _event$detail !== void 0 && _event$detail.sleeping) return;
    if (isDrawerOpen()) {
      if (state.view === 'list') maybePullKvChecklists(true);
      if (state.view === 'list' || state.view === 'manager' || state.view === 'home') maybePullCommunity(true);
    }
  });
  window.addEventListener('gatrackercapabilitieschange', event => {
    var _event$detail2;
    var nextToken = String((event === null || event === void 0 || (_event$detail2 = event.detail) === null || _event$detail2 === void 0 ? void 0 : _event$detail2.connectionToken) || '');
    if (nextToken && nextToken !== trackerConnectionToken) {
      trackerConnectionToken = nextToken;
      trackerLastPublishedHash = '';
    }
    scheduleCustomChecklistsForTracker(120);
  });
  setInterval(() => {
    if (document.visibilityState !== 'visible' || !isDrawerOpen() || state.view !== 'mission' || !bodyEl) return;
    var scrollTop = bodyEl.scrollTop;
    renderMissionTool();
    bodyEl.scrollTop = scrollTop;
  }, 1000);
  window.gaChecklistRefresh = function () {
    if (!bodyEl || !isDrawerOpen() || state.view === 'editor' || state.view === 'import') return;
    var scroll = bodyEl.scrollTop;
    render();
    bodyEl.scrollTop = scroll;
  };
  window.gaChecklistCurrentView = function () {
    return state.view;
  };
  window.gaChecklistOpen = function (view) {
    setDrawerOpen(true);
    if (view === 'checklists') openList();else if (view === 'home' || !view) {
      state.view = 'home';
      render();
    } else openTool(view);
  };
  document.addEventListener('DOMContentLoaded', init);
})();
