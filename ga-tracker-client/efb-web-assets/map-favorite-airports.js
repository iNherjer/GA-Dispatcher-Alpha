// Generated from map-favorite-airports.js by sync-efb-web-assets.js. Do not edit.
/* Favorite airports (max. 10): shared store and discreet map stars for Web and EFB.
   ES5 on purpose; the EFB build targets Coherent (Chrome 49). The store only holds
   presentation data; the Web profile sync carries it as `favoriteAirports`. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.GAFavoriteAirportsCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MAX_FAVORITES = 10;
  function normalizeCode(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
  }
  function finite(value) {
    return typeof value === 'number' && isFinite(value);
  }
  function normalizeEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    var code = normalizeCode(entry.code || entry.icao);
    var apt = entry.apt && typeof entry.apt === 'object' ? entry.apt : {};
    var lat = Number(entry.lat !== undefined ? entry.lat : apt.lat);
    var lon = Number(entry.lon !== undefined ? entry.lon : apt.lon);
    if (!code || !finite(lat) || !finite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    var out = {
      code: code,
      displayCode: String(entry.displayCode || code).slice(0, 16),
      name: String(entry.name || apt.name || code).slice(0, 80),
      lat: Math.round(lat * 1e6) / 1e6,
      lon: Math.round(lon * 1e6) / 1e6
    };
    if (entry.apt && typeof entry.apt === 'object') out.apt = entry.apt;
    return out;
  }
  function normalizeList(list) {
    var out = [],
      seen = {};
    (Array.isArray(list) ? list : []).forEach(function (item) {
      var entry = normalizeEntry(item);
      if (!entry || seen[entry.code] || out.length >= MAX_FAVORITES) return;
      seen[entry.code] = true;
      out.push(entry);
    });
    return out;
  }
  function toggle(list, entry) {
    var current = normalizeList(list);
    var next = normalizeEntry(entry);
    if (!next) return {
      ok: false,
      error: 'invalid_airport',
      list: current
    };
    var index = -1;
    current.forEach(function (item, i) {
      if (item.code === next.code) index = i;
    });
    if (index >= 0) {
      current.splice(index, 1);
      return {
        ok: true,
        added: false,
        list: current
      };
    }
    if (current.length >= MAX_FAVORITES) return {
      ok: false,
      error: 'limit_reached',
      list: current
    };
    current.push(next);
    return {
      ok: true,
      added: true,
      list: current
    };
  }
  return {
    MAX_FAVORITES: MAX_FAVORITES,
    normalizeCode: normalizeCode,
    normalizeList: normalizeList,
    toggle: toggle
  };
});
(function () {
  'use strict';

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  var core = window.GAFavoriteAirportsCore;
  var STORAGE_KEY = 'ga_favorite_airports_v1';
  var CHANGE_EVENT = 'ga-favorite-airports-changed';
  var nativeEfb = !!(document.body && document.body.classList.contains('ga-efb-tracker-host'));
  var favorites = [];
  function emitChange(source) {
    var event;
    try {
      event = new CustomEvent(CHANGE_EVENT, {
        detail: {
          source: source
        }
      });
    } catch (_) {
      event = document.createEvent('CustomEvent');
      event.initCustomEvent(CHANGE_EVENT, false, false, {
        source: source
      });
    }
    window.dispatchEvent(event);
  }
  function load() {
    try {
      favorites = core.normalizeList(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
    } catch (_) {
      favorites = [];
    }
  }
  function store() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch (_) {}
  }
  function sameList(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  load();
  window.GAFavoriteAirports = {
    MAX: core.MAX_FAVORITES,
    list: function list() {
      return favorites.slice();
    },
    has: function has(code) {
      var key = core.normalizeCode(code);
      return favorites.some(function (item) {
        return item.code === key;
      });
    },
    toggle: function toggle(entry) {
      var result = core.toggle(favorites, entry);
      if (!result.ok) return result;
      favorites = result.list;
      store();
      emitChange('local');
      // Web: personal profile sync. EFB has no airport input fields and only reads.
      if (!nativeEfb && typeof window.triggerCloudSave === 'function') {
        try {
          window.triggerCloudSave();
        } catch (_) {}
      }
      return result;
    },
    // Cloud/Tracker data replaces the local list without echoing a save.
    replace: function replace(list, source) {
      var next = core.normalizeList(list);
      if (sameList(next, favorites)) return false;
      favorites = next;
      store();
      emitChange(source || 'sync');
      return true;
    },
    forSync: function forSync() {
      return favorites.map(function (item) {
        var out = {
          code: item.code,
          displayCode: item.displayCode,
          name: item.name,
          lat: item.lat,
          lon: item.lon
        };
        if (item.apt) out.apt = item.apt;
        return out;
      });
    }
  };
  window.addEventListener('storage', function (event) {
    if (event.key !== STORAGE_KEY) return;
    var before = favorites;
    load();
    if (!sameList(before, favorites)) emitChange('storage');
  });

  // ---- Map stars -------------------------------------------------------
  var PANE = 'favoriteAirportPane';
  var STAR_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">' + '<polygon points="12,1.8 15.1,8.4 22.3,9.2 16.9,14.1 18.4,21.2 12,17.6 5.6,21.2 7.1,14.1 1.7,9.2 8.9,8.4" ' + 'fill="#f2c12e" stroke="rgba(0,0,0,0.85)" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  var DODGE_RADIUS_PX = 34;
  var TOUCH_DODGE_MS = 4500;
  var markers = [];
  var boundMap = null;
  var touchDodgeUntil = 0,
    touchPoint = null,
    touchTimer = null;
  var popupLatLng = null;
  function getMap() {
    if (typeof map !== 'undefined' && map && typeof map.addLayer === 'function') return map; // eslint-disable-line no-undef
    return window.map && typeof window.map.addLayer === 'function' ? window.map : null;
  }
  function enabled() {
    return typeof window.isMapHintEnabled !== 'function' || window.isMapHintEnabled('favoriteAirports');
  }
  function ensurePane(m) {
    if (m.getPane(PANE)) return;
    var pane = m.createPane(PANE);
    // Above airport symbols and route, below popups/tooltips; never catches input.
    pane.style.zIndex = '615';
    pane.style.pointerEvents = 'none';
  }
  function clearMarkers() {
    markers.forEach(function (item) {
      if (boundMap) boundMap.removeLayer(item.marker);
    });
    markers = [];
  }
  function escapeHtml(text) {
    return String(text || '').replace(/[&<>"']/g, function (c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c];
    });
  }
  function render() {
    var m = getMap();
    if (!m || typeof L === 'undefined') return;
    bindMap(m);
    clearMarkers();
    if (!enabled()) return;
    ensurePane(m);
    favorites.forEach(function (item) {
      var icon = L.divIcon({
        className: 'ga-fav-airport-icon',
        // Zero-size anchor on the airport; the star itself sits up/right of it.
        // Inline SVG: Coherent font fallback would recolor a text star glyph.
        html: '<span class="ga-fav-airport-star" title="Favorit ' + escapeHtml(item.displayCode) + '">' + STAR_SVG + '</span>',
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });
      var marker = L.marker([item.lat, item.lon], {
        icon: icon,
        pane: PANE,
        interactive: false,
        keyboard: false
      });
      marker.addTo(m);
      markers.push({
        marker: marker,
        item: item
      });
    });
    updateDodge();
  }
  function dodgeAround(point) {
    var m = boundMap;
    markers.forEach(function (entry) {
      var el = entry.marker.getElement && entry.marker.getElement();
      if (!el) return;
      var near = false;
      if (point) {
        var p = m.latLngToContainerPoint([entry.item.lat, entry.item.lon]);
        near = Math.abs(p.x - point.x) <= DODGE_RADIUS_PX && Math.abs(p.y - point.y) <= DODGE_RADIUS_PX;
      }
      if (!near && popupLatLng) {
        near = Math.abs(popupLatLng.lat - entry.item.lat) < 0.004 && Math.abs(popupLatLng.lng - entry.item.lon) < 0.006;
      }
      if (el.classList.contains('is-dodging') !== near) el.classList.toggle('is-dodging', near);
    });
  }
  var lastPointer = null;
  function updateDodge() {
    if (!boundMap) return;
    var point = Date.now() < touchDodgeUntil ? touchPoint : lastPointer;
    dodgeAround(point);
  }
  function bindMap(m) {
    if (boundMap === m) return;
    boundMap = m;
    m.on('mousemove', function (e) {
      lastPointer = e.containerPoint;
      updateDodge();
    });
    m.on('mouseout', function () {
      lastPointer = null;
      updateDodge();
    });
    // Touch/click interaction: move away for a moment where the pilot tapped.
    m.on('mousedown', function (e) {
      touchPoint = e.containerPoint;
      touchDodgeUntil = Date.now() + TOUCH_DODGE_MS;
      updateDodge();
      if (touchTimer) clearTimeout(touchTimer);
      touchTimer = setTimeout(function () {
        touchTimer = null;
        updateDodge();
      }, TOUCH_DODGE_MS + 50);
    });
    m.on('popupopen', function (e) {
      popupLatLng = e.popup && e.popup.getLatLng ? e.popup.getLatLng() : null;
      updateDodge();
    });
    m.on('popupclose', function () {
      popupLatLng = null;
      updateDodge();
    });
    m.on('zoomend moveend', function () {
      updateDodge();
    });
  }
  window.addEventListener(CHANGE_EVENT, render);
  window.gaRenderFavoriteAirportStars = render;

  // The map is created after this script; wait for it without a hard dependency.
  var waitCount = 0;
  var waitTimer = setInterval(function () {
    waitCount++;
    if (getMap()) {
      clearInterval(waitTimer);
      render();
    } else if (waitCount > 600) clearInterval(waitTimer);
  }, 500);

  // ---- EFB: read-only list from the Tracker (cloud profile field) ---------
  if (nativeEfb) {
    var efbBusy = false;
    var pollEfb = function pollEfb() {
      if (efbBusy || document.visibilityState === 'hidden') return;
      efbBusy = true;
      fetch('/api/v1/favorite-airports', {
        cache: 'no-store'
      }).then(function (response) {
        if (!response.ok) throw new Error('favorite_airports_unavailable');
        return response.json();
      }).then(function (body) {
        if (body && Array.isArray(body.airports)) window.GAFavoriteAirports.replace(body.airports, 'tracker');
      }).catch(function () {/* Keep the last known stars while offline. */}).then(function () {
        efbBusy = false;
      });
    };
    setTimeout(pollEfb, 1500);
    setInterval(pollEfb, 30000);
  }
})();
