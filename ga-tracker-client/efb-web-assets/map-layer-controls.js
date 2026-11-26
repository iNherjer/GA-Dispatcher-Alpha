// Generated from map-layer-controls.js by sync-efb-web-assets.js. Do not edit.
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i.return) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
// Shared Standalone click-only layer menu and viewport bounds.
function configureMapLayerControl(map, layerControl) {
  if (layerControl && layerControl._container) {
    var portalLayerControl = function portalLayerControl(open) {
      if (nativeEfb) {
        lc.classList.toggle('ga-layer-menu-open', open);
        return;
      }
      if (open && mapFrame) {
        mapFrame.appendChild(lc);
        lc.classList.add('ga-layer-menu-open');
      } else if (controlParent) {
        controlParent.appendChild(lc);
        lc.classList.remove('ga-layer-menu-open');
      }
    };
    var fitMapLayerControl = function fitMapLayerControl() {
      var rect = lc.getBoundingClientRect();
      var list = lc.querySelector('.leaflet-control-layers-list');
      var bottom = Math.min(window.innerHeight, map.getContainer().getBoundingClientRect().bottom);
      var scale = nativeEfb && window.GAEfbUiScale;
      var logical = value => scale ? scale.delta(value) : value;
      lc.style.maxWidth = Math.max(120, Math.min(320, logical(window.innerWidth) - 24)) + 'px';
      if (list) {
        list.style.maxHeight = Math.max(40, logical(bottom - Math.max(0, rect.top)) - 30) + 'px';
        list.style.overflowY = 'auto';
      }
    };
    var lc = layerControl._container;
    var controlParent = lc.parentElement;
    var mapFrame = map.getContainer().parentElement;
    var nativeEfb = document.body.classList.contains('ga-efb-tracker-host');
    // Coherent can lose the paint surfaces of sibling controls when a live
    // Leaflet control is reparented. Keep a stable parent in the EFB.
    if (nativeEfb && mapFrame) mapFrame.appendChild(lc);
    window.addEventListener('resize', fitMapLayerControl);
    if (nativeEfb) window.addEventListener('ga-efb-layout-change', fitMapLayerControl);
    var bringLayerControlToFront = () => {
      if (nativeEfb) {
        if (typeof bringMapOverlayToFront === 'function') bringMapOverlayToFront(lc);
        return;
      }
      if (lc.classList.contains('ga-layer-menu-open')) {
        window.gaMapOverlayZ = Math.max(130500, Number(window.gaMapOverlayZ) || 130500) + 1;
        lc.style.zIndex = String(window.gaMapOverlayZ);
        return;
      }
      var controlCorner = lc.closest('.leaflet-top, .leaflet-bottom') || lc.parentElement;
      var controlRoot = lc.closest('.leaflet-control-container');
      if (controlCorner && controlCorner.style) {
        controlCorner.style.position = controlCorner.style.position || 'relative';
        controlCorner.style.pointerEvents = 'auto';
      }
      if (controlRoot && controlRoot.style) {
        controlRoot.style.position = controlRoot.style.position || 'relative';
      }
      lc.style.position = lc.style.position || 'relative';
      if (typeof bringMapOverlayToFront === 'function') {
        bringMapOverlayToFront(controlRoot, controlCorner, lc);
        return;
      }
      window.gaMapOverlayZ = Math.max(130500, Number(window.gaMapOverlayZ) || 130500) + 1;
      if (controlRoot && controlRoot.style) controlRoot.style.zIndex = String(window.gaMapOverlayZ);
      if (controlCorner && controlCorner.style) controlCorner.style.zIndex = String(window.gaMapOverlayZ);
      lc.style.zIndex = String(window.gaMapOverlayZ);
    };
    // Hover-Verhalten robust deaktivieren: Leaflet nutzt je nach Version
    // mouseover/mouseout oder mouseenter/mouseleave.
    var expandFn = typeof layerControl.expand === 'function' ? layerControl.expand : typeof layerControl._expand === 'function' ? layerControl._expand : null;
    var collapseFn = typeof layerControl.collapse === 'function' ? layerControl.collapse : typeof layerControl._collapse === 'function' ? layerControl._collapse : null;
    var origExpand = expandFn ? expandFn.bind(layerControl) : null;
    var origCollapse = collapseFn ? collapseFn.bind(layerControl) : null;

    // Harte Absicherung: Expand nur aus unserem Klick-Flow erlauben.
    layerControl._allowManualExpand = false;
    if (origExpand) {
      layerControl.expand = function () {
        if (!this._allowManualExpand) return this;
        bringLayerControlToFront();
        var out = origExpand();
        portalLayerControl(true);
        fitMapLayerControl();
        bringLayerControlToFront();
        return out;
      };
      layerControl._expand = layerControl.expand;
    }
    if (origCollapse) {
      layerControl.collapse = function () {
        var result = origCollapse();
        portalLayerControl(false);
        return result;
      };
      layerControl._collapse = layerControl.collapse;
    }
    if (expandFn) {
      L.DomEvent.off(lc, 'mouseover', expandFn, layerControl);
      L.DomEvent.off(lc, 'mouseenter', expandFn, layerControl);
      L.DomEvent.off(lc, 'pointerenter', expandFn, layerControl);
    }
    if (collapseFn) {
      L.DomEvent.off(lc, 'mouseout', collapseFn, layerControl);
      L.DomEvent.off(lc, 'mouseleave', collapseFn, layerControl);
      L.DomEvent.off(lc, 'pointerleave', collapseFn, layerControl);
    }
    var toggle = lc.querySelector('.leaflet-control-layers-toggle');
    if (toggle) {
      // Falls Touch-Click expand bereits von Leaflet gebunden ist, entfernen
      if (expandFn) {
        L.DomEvent.off(toggle, 'click', expandFn, layerControl);
        L.DomEvent.off(toggle, 'focus', expandFn, layerControl);
      }
      L.DomEvent.on(toggle, 'click', L.DomEvent.stop);
      L.DomEvent.on(toggle, 'pointerdown', bringLayerControlToFront);
      L.DomEvent.on(toggle, 'mousedown', bringLayerControlToFront);
      L.DomEvent.on(toggle, 'click', () => {
        bringLayerControlToFront();
        var isOpen = L.DomUtil.hasClass(lc, 'leaflet-control-layers-expanded');
        if (isOpen && typeof layerControl.collapse === 'function') {
          layerControl.collapse();
        } else if (!isOpen && typeof layerControl.expand === 'function') {
          layerControl._allowManualExpand = true;
          layerControl.expand();
          layerControl._allowManualExpand = false;
        }
      });
    }
    L.DomEvent.on(lc, 'pointerdown', bringLayerControlToFront);
    L.DomEvent.on(lc, 'click', bringLayerControlToFront);
    if (!map._layersOutsideCloseBound) {
      document.addEventListener('click', e => {
        var isOpen = L.DomUtil.hasClass(lc, 'leaflet-control-layers-expanded');
        if (!isOpen) return;
        if (lc.contains(e.target)) return;
        if (typeof layerControl.collapse === 'function') layerControl.collapse();
      }, true);
      map._layersOutsideCloseBound = true;
    }
  }
}
var GA_MAP_WEATHER_REFRESH_MS = 5 * 60 * 1000;
function observeMapWeatherVisibility(map, onChange) {
  var board = map.getContainer().closest('#mapTableOverlay');
  document.addEventListener('visibilitychange', onChange);
  if (board) {
    var open = board.classList.contains('active');
    new MutationObserver(() => {
      var next = board.classList.contains('active');
      if (next === open) return;
      open = next;
      onChange();
    }).observe(board, {
      attributes: true,
      attributeFilter: ['class']
    });
  }
  return () => !document.hidden && (!board || board.classList.contains('active'));
}
function createMapRadarOverlay(map, pane) {
  var overlay = L.layerGroup();
  var framePath = '';
  var request = null;
  var refreshTimer;
  function showFrame(path) {
    if (!active() || !path || framePath === path) return;
    overlay.clearLayers();
    framePath = path;
    L.tileLayer('https://tilecache.rainviewer.com' + path + '/256/{z}/{x}/{y}/2/1_1.png', {
      pane,
      opacity: 0.65,
      maxNativeZoom: 7,
      attribution: 'Radar © RainViewer'
    }).addTo(overlay);
  }
  function refresh() {
    return _refresh.apply(this, arguments);
  }
  function _refresh() {
    _refresh = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee() {
      var controller, timeout, _data$radar, fetchRadar, response, data, frames, newest, _t;
      return _regenerator().w(function (_context) {
        while (1) switch (_context.p = _context.n) {
          case 0:
            if (!(!active() || request)) {
              _context.n = 1;
              break;
            }
            return _context.a(2);
          case 1:
            controller = window.gaProfileDataProvider ? window.gaProfileDataProvider.createAbortController() : new AbortController();
            timeout = setTimeout(() => controller.abort(), 12000);
            request = controller;
            _context.p = 2;
            fetchRadar = typeof window.gaMapRadarFetch === 'function' ? window.gaMapRadarFetch : fetch;
            _context.n = 3;
            return fetchRadar('https://api.rainviewer.com/public/weather-maps.json', {
              signal: controller.signal,
              cache: 'no-cache'
            });
          case 3:
            response = _context.v;
            if (response.ok) {
              _context.n = 4;
              break;
            }
            throw new Error('Radar HTTP ' + response.status);
          case 4:
            _context.n = 5;
            return response.json();
          case 5:
            data = _context.v;
            if (!(request !== controller)) {
              _context.n = 6;
              break;
            }
            return _context.a(2);
          case 6:
            frames = Array.isArray(data === null || data === void 0 || (_data$radar = data.radar) === null || _data$radar === void 0 ? void 0 : _data$radar.past) ? data.radar.past : [];
            newest = frames[frames.length - 1];
            if (/^\/v2\/radar\/[a-zA-Z0-9_/-]+$/.test((newest === null || newest === void 0 ? void 0 : newest.path) || '')) showFrame(newest.path);
            _context.n = 9;
            break;
          case 7:
            _context.p = 7;
            _t = _context.v;
            if (!(request !== controller)) {
              _context.n = 8;
              break;
            }
            return _context.a(2);
          case 8:
            console.warn('[RainViewer]', _t);
          case 9:
            _context.p = 9;
            clearTimeout(timeout);
            if (request === controller) {
              request = null;
              refreshTimer = setTimeout(refresh, GA_MAP_WEATHER_REFRESH_MS);
            }
            return _context.f(9);
          case 10:
            return _context.a(2);
        }
      }, _callee, null, [[2, 7, 9, 10]]);
    }));
    return _refresh.apply(this, arguments);
  }
  function sync() {
    clearTimeout(refreshTimer);
    var previousRequest = request;
    request = null;
    previousRequest === null || previousRequest === void 0 || previousRequest.abort();
    if (active()) {
      void refresh();
    } else {
      overlay.clearLayers();
      framePath = '';
    }
  }
  var visible = observeMapWeatherVisibility(map, sync);
  var active = () => map.hasLayer(overlay) && visible();
  overlay.on('add remove', () => {
    localStorage.setItem('ga_radar_active', String(map.hasLayer(overlay)));
    sync();
  });
  if (localStorage.getItem('ga_radar_active') === 'true') overlay.addTo(map);
  return overlay;
}

// EUMETView provides georeferenced PNGs. The mask style codes clouds as white,
// clear land/water as green/blue and missing observations as black.
var GA_SAT_WMS = 'https://view.eumetsat.int/geoserver';
var GA_SAT_RETRY_MS = 60000;
var GA_SAT_PRODUCTS = {
  clouds: {
    workspace: 'msg_fes',
    layer: 'clm',
    maxNativeZoom: 6
  },
  infrared: {
    workspace: 'mtg_fd',
    layer: 'ir105_hrfi',
    maxNativeZoom: 7
  }
};
function createMapSatelliteOverlay(map, pane, onChange) {
  var enabled = localStorage.getItem('ga_satellite_clouds_enabled') === 'true';
  var mode = localStorage.getItem('ga_satellite_clouds_mode') === 'infrared' ? 'infrared' : 'clouds';
  var layer = null;
  var time = '';
  var state = 'loading';
  var timer;
  var request = null;
  var CloudTile = L.TileLayer.WMS.extend({
    createTile(coords, done) {
      var tile = document.createElement('canvas');
      var size = this.getTileSize();
      tile.width = size.x;
      tile.height = size.y;
      var image = new Image();
      image.crossOrigin = 'anonymous';
      var releaseImage = () => {
        image.onload = image.onerror = null;
        delete tile.cancelSatelliteTile;
      };
      image.onload = () => {
        try {
          var ctx = tile.getContext('2d', {
            willReadFrequently: true
          });
          ctx.drawImage(image, 0, 0, size.x, size.y);
          var pixels = ctx.getImageData(0, 0, size.x, size.y);
          var rgba = pixels.data;
          for (var i = 0; i < rgba.length; i += 4) {
            // Preserve coverage at interpolated boundaries. Only
            // white contributes across all three color channels.
            rgba[i + 3] *= Math.min(rgba[i], rgba[i + 1], rgba[i + 2]) / 255;
            rgba[i] = rgba[i + 1] = rgba[i + 2] = 255;
          }
          ctx.putImageData(pixels, 0, 0);
          done(null, tile);
        } catch (error) {
          done(error, tile);
        } finally {
          releaseImage();
        }
      };
      image.onerror = () => {
        releaseImage();
        done(new Error('EUMETView tile failed'), tile);
      };
      tile.cancelSatelliteTile = () => {
        releaseImage();
        if (!image.complete) image.removeAttribute('src');
      };
      image.src = this.getTileUrl(coords);
      return tile;
    }
  });
  var boardVisible = observeMapWeatherVisibility(map, sync);
  var visible = () => enabled && boardVisible();
  var removeLayer = () => {
    if (layer) map.removeLayer(layer);
    layer = null;
    time = '';
  };
  function showFrame(stamp) {
    if (!visible()) return;
    if (layer && stamp === time && state !== 'unavailable') return;
    removeLayer();
    var product = GA_SAT_PRODUCTS[mode];
    var options = _objectSpread(_objectSpread({
      layers: product.workspace + ':' + product.layer,
      version: '1.3.0',
      format: 'image/png',
      transparent: true
    }, stamp ? {
      time: stamp
    } : {}), {}, {
      pane,
      opacity: mode === 'clouds' ? 0.58 : 0.46,
      maxNativeZoom: product.maxNativeZoom,
      noWrap: true,
      updateWhenIdle: true,
      bounds: [[-64, -72], [68, 72]],
      attribution: 'Satellit © EUMETSAT'
    });
    var endpoint = GA_SAT_WMS + '/' + product.workspace + '/' + product.layer + '/wms';
    var tiles = window.gaMapSatelliteTileUrl ? L.tileLayer(window.gaMapSatelliteTileUrl(mode, stamp, '{z}', '{x}', '{y}'), options) : mode === 'clouds' ? new CloudTile(endpoint, options) : L.tileLayer.wms(endpoint, options);
    layer = tiles;
    time = stamp;
    state = 'loading';
    var loadedTile = false;
    tiles.on('tileabort tileunload', event => {
      var _event$tile$cancelSat, _event$tile;
      return (_event$tile$cancelSat = (_event$tile = event.tile).cancelSatelliteTile) === null || _event$tile$cancelSat === void 0 ? void 0 : _event$tile$cancelSat.call(_event$tile);
    });
    tiles.on('tileload', () => {
      loadedTile = true;
    });
    tiles.on('load', () => {
      if (layer !== tiles) return;
      state = loadedTile ? 'ready' : 'unavailable';
      if (!loadedTile && visible() && !request) {
        clearTimeout(timer);
        timer = setTimeout(refresh, GA_SAT_RETRY_MS);
      }
      onChange();
    });
    tiles.addTo(map);
    onChange();
  }
  function refresh() {
    return _refresh2.apply(this, arguments);
  }
  function _refresh2() {
    _refresh2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2() {
      var product, layerName, controller, timeout, url, fetchMetadata, response, data, xml, entry, nextDimension, stamp, _t2, _t3;
      return _regenerator().w(function (_context2) {
        while (1) switch (_context2.p = _context2.n) {
          case 0:
            if (!(!visible() || request)) {
              _context2.n = 1;
              break;
            }
            return _context2.a(2);
          case 1:
            product = GA_SAT_PRODUCTS[mode];
            layerName = product.workspace + ':' + product.layer;
            controller = window.gaProfileDataProvider ? window.gaProfileDataProvider.createAbortController() : new AbortController();
            timeout = setTimeout(() => controller.abort(), 12000);
            request = controller;
            _context2.p = 2;
            url = GA_SAT_WMS + '/' + product.workspace + '/' + product.layer + '/wms?service=WMS&version=1.3.0&request=GetCapabilities';
            fetchMetadata = window.gaMapSatelliteFetch || fetch;
            _context2.n = 3;
            return fetchMetadata(url, {
              signal: controller.signal,
              cache: 'no-cache'
            });
          case 3:
            response = _context2.v;
            if (response.ok) {
              _context2.n = 4;
              break;
            }
            throw new Error('EUMETView HTTP ' + response.status);
          case 4:
            if (!window.gaMapSatelliteFetch) {
              _context2.n = 8;
              break;
            }
            _context2.n = 5;
            return response.json();
          case 5:
            data = _context2.v;
            if (!(request !== controller || !visible())) {
              _context2.n = 6;
              break;
            }
            return _context2.a(2);
          case 6:
            if (Number.isFinite(Date.parse(data === null || data === void 0 ? void 0 : data.time))) {
              _context2.n = 7;
              break;
            }
            throw new Error('EUMETView time unavailable');
          case 7:
            showFrame(data.time);
            return _context2.a(2);
          case 8:
            _t2 = new DOMParser();
            _context2.n = 9;
            return response.text();
          case 9:
            xml = _t2.parseFromString.call(_t2, _context2.v, 'application/xml');
            if (!(request !== controller || !visible())) {
              _context2.n = 10;
              break;
            }
            return _context2.a(2);
          case 10:
            entry = _toConsumableArray(xml.getElementsByTagNameNS('*', 'Layer')).find(node => _toConsumableArray(node.children).some(child => child.localName === 'Name' && [layerName, product.layer].includes(child.textContent.trim())));
            nextDimension = _toConsumableArray((entry === null || entry === void 0 ? void 0 : entry.children) || []).find(child => child.localName === 'Dimension' && child.getAttribute('name') === 'time');
            stamp = nextDimension === null || nextDimension === void 0 ? void 0 : nextDimension.getAttribute('default');
            if (Number.isFinite(Date.parse(stamp))) {
              _context2.n = 11;
              break;
            }
            throw new Error('EUMETView time unavailable');
          case 11:
            showFrame(stamp);
            _context2.n = 14;
            break;
          case 12:
            _context2.p = 12;
            _t3 = _context2.v;
            if (!(request !== controller || !visible())) {
              _context2.n = 13;
              break;
            }
            return _context2.a(2);
          case 13:
            if (!window.gaMapSatelliteTileUrl && (!layer || state === 'unavailable')) showFrame('');
            if (!layer) state = 'unavailable';
            console.warn('[EUMETView]', _t3);
          case 14:
            _context2.p = 14;
            clearTimeout(timeout);
            if (request === controller) {
              request = null;
              if (visible()) timer = setTimeout(refresh, time && state !== 'unavailable' ? GA_MAP_WEATHER_REFRESH_MS : GA_SAT_RETRY_MS);
              onChange();
            }
            return _context2.f(14);
          case 15:
            return _context2.a(2);
        }
      }, _callee2, null, [[2, 12, 14, 15]]);
    }));
    return _refresh2.apply(this, arguments);
  }
  function sync() {
    clearTimeout(timer);
    var previousRequest = request;
    request = null;
    previousRequest === null || previousRequest === void 0 || previousRequest.abort();
    removeLayer();
    state = 'loading';
    if (visible()) void refresh();
    onChange();
  }
  return {
    get enabled() {
      return enabled;
    },
    get mode() {
      return mode;
    },
    get time() {
      return time;
    },
    get state() {
      return state;
    },
    sync,
    toggle() {
      enabled = !enabled;
      localStorage.setItem('ga_satellite_clouds_enabled', String(enabled));
      sync();
    },
    setMode(value) {
      if (value === mode || !Object.prototype.hasOwnProperty.call(GA_SAT_PRODUCTS, value)) return;
      mode = value;
      localStorage.setItem('ga_satellite_clouds_mode', mode);
      sync();
    }
  };
}
function installMapWeatherQuickControls(map, layerControl, _radar, satellitePane, _weather) {
  var list = layerControl._container.querySelector('.leaflet-control-layers-list');
  var panel = document.createElement('div');
  panel.className = 'ga-map-weather-quick';
  var tiles = document.createElement('div');
  tiles.className = 'ga-map-weather-tiles';
  panel.appendChild(tiles);
  var cloud = '<path d="M6.5 16a4 4 0 1 1 .8-7.9 5.3 5.3 0 0 1 10.2 1.2A3.4 3.4 0 1 1 18 16z"/>';
  var icons = {
    satellite: cloud,
    radar: cloud + '<path d="m8 19-1 2m6-2-1 2m6-2-1 2"/>',
    vfr: '<path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="m9 4 0 14m6-12v14" /><path d="M5.5 10v5" stroke="#6ccc8e"/><path d="M12 9v5" stroke="#f0ce55"/><path d="M18.5 8v5" stroke="#ed887e"/>',
    weather: '<path d="M3 8h12a2.5 2.5 0 1 0-2.5-2.5M3 12h16a2 2 0 1 1-2 2M3 16h8a2.5 2.5 0 1 1-2.5 2.5"/>'
  };
  var buttons = {};
  var linked = false;
  try {
    linked = localStorage.getItem('ga_map_weather_sat_radar_linked') === 'true';
  } catch (_) {}
  function setPair(on) {
    if (_satellite.enabled !== on) _satellite.toggle();
    if (map.hasLayer(_radar) !== on) on ? _radar.addTo(map) : map.removeLayer(_radar);
  }
  var actions = {
    satellite: () => linked ? setPair(!_satellite.enabled) : _satellite.toggle(),
    radar: () => linked ? setPair(!map.hasLayer(_radar)) : map.hasLayer(_radar) ? map.removeLayer(_radar) : _radar.addTo(map),
    vfr: _weather.toggleVfr,
    weather: () => _weather.toggleFields()
  };
  var text = (key, fallback) => {
    var _window$GAI18n$t, _window$GAI18n;
    return (_window$GAI18n$t = (_window$GAI18n = window.GAI18n) === null || _window$GAI18n === void 0 ? void 0 : _window$GAI18n.t('map.quickWeather.' + key, null, fallback)) !== null && _window$GAI18n$t !== void 0 ? _window$GAI18n$t : fallback;
  };
  var labels = {
    satellite: 'Satellit',
    radar: 'Radar',
    vfr: 'VFR-Index',
    weather: 'Wetter'
  };
  for (var _i = 0, _Object$entries = Object.entries(actions); _i < _Object$entries.length; _i++) {
    var _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2),
      key = _Object$entries$_i[0],
      action = _Object$entries$_i[1];
    var button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' + icons[key] + '</svg><span></span>';
    button.addEventListener('click', action);
    tiles.appendChild(button);
    buttons[key] = button;
  }
  var chainOpen = '<path d="M9.5 14.5 8 16a3 3 0 0 1-4.2-4.2l2.6-2.6a3 3 0 0 1 4 -.3"/><path d="M14.5 9.5 16 8a3 3 0 0 1 4.2 4.2l-2.6 2.6a3 3 0 0 1-4 .3"/>';
  var chainClosed = '<path d="M10 13.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-1 1"/><path d="M14 10.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l1-1"/>';
  var chain = document.createElement('button');
  chain.type = 'button';
  chain.className = 'ga-map-weather-link';
  chain.addEventListener('click', () => {
    linked = !linked;
    try {
      localStorage.setItem('ga_map_weather_sat_radar_linked', String(linked));
    } catch (_) {}
    if (linked && _satellite.enabled !== map.hasLayer(_radar)) setPair(true);
    refresh();
  });
  tiles.appendChild(chain);
  var options = document.createElement('div');
  options.className = 'ga-map-satellite-options';
  var mode = document.createElement('select');
  mode.add(new Option('', 'clouds'));
  mode.add(new Option('', 'infrared'));
  mode.addEventListener('change', () => _satellite.setMode(mode.value));
  var status = document.createElement('span');
  status.setAttribute('role', 'status');
  options.appendChild(mode);
  options.appendChild(status);
  panel.appendChild(options);
  if (_weather.installOptions) _weather.installOptions(panel);
  list.insertBefore(panel, list.firstChild);
  function refresh() {
    var states = {
      satellite: _satellite.enabled,
      radar: map.hasLayer(_radar),
      vfr: _weather.isVfrOn(),
      weather: _weather.fieldsState()
    };
    for (var _i2 = 0, _Object$entries2 = Object.entries(buttons); _i2 < _Object$entries2.length; _i2++) {
      var _Object$entries2$_i = _slicedToArray(_Object$entries2[_i2], 2),
        _key = _Object$entries2$_i[0],
        _button = _Object$entries2$_i[1];
      _button.lastElementChild.textContent = text(_key, labels[_key]);
      _button.setAttribute('aria-pressed', String(states[_key]));
    }
    chain.setAttribute('aria-pressed', String(linked));
    chain.title = linked ? text('linkOn', 'Satellit und Radar gekoppelt – Kette öffnen für Einzelschaltung') : text('linkOff', 'Satellit und Radar koppeln');
    chain.setAttribute('aria-label', chain.title);
    chain.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + (linked ? chainClosed : chainOpen) + '</svg>';
    buttons.weather.title = text('weatherTitle', 'Windbarben und Wolkenfelder');
    if (_weather.vfrTitle) buttons.vfr.title = _weather.vfrTitle;
    mode.setAttribute('aria-label', text('mode', 'Satellitendarstellung'));
    mode.options[0].textContent = text('clouds', 'Nur Wolken');
    mode.options[1].textContent = text('infrared', 'Infrarotbild');
    mode.value = _satellite.mode;
    options.hidden = !_satellite.enabled;
    var timeLabel = _satellite.time ? _satellite.time.slice(11, 16) + ' UTC' : '';
    status.title = _satellite.time;
    status.textContent = _satellite.state === 'unavailable' ? text('unavailable', 'Nicht verfügbar') : _satellite.state === 'loading' ? text('loading', 'Lädt …') : timeLabel || text('latest', 'Letztes Bild');
  }
  var _satellite = createMapSatelliteOverlay(map, satellitePane, refresh);
  _radar.on('add remove', refresh);
  window.addEventListener('ga:languagechange', refresh);
  window.refreshMapWeatherQuickControls = refresh;
  _satellite.sync();
}
