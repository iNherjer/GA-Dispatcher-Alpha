// Generated from map-search.js by sync-efb-web-assets.js. Do not edit.
// Map search (magnifier in the map table toolbar): airfields, navaids and VFR reporting points.
// Airfields use the same catalog search as the DEP/DEST fields (app.js), navaids the static
// OpenAIP file (map.js loader), reporting points the open flightmaps file.
// Selecting a hit centres the map with about 10 NM on screen and highlights the spot until
// the next click on the map. Plain ES5-style syntax on purpose (EFB/Coherent safe).
// The EFB has neither app.js nor map.js: its host provides window.gaMapSearchAirports
// (query, limit) and window.gaMapSearchLoadNavaids(), plus window.GA_MAP_SEARCH_OFM_URL.
(function () {
  'use strict';

  function ofmPointsUrl() {
    return window.GA_MAP_SEARCH_OFM_URL || './data/ofm-reporting-points.json';
  }
  var VIEW_HALF_NM = 5;
  var MAX_AIRPORTS = 6;
  var MAX_NAVAIDS = 4;
  var MAX_POINTS = 3;
  // OpenAIP navaid types (0 DME, 1 TACAN, 2 NDB, 3 VOR, 4 VOR/DME, 5 VORTAC, 6 DVOR, 7 DVOR/DME, 8 DVORTAC).
  var NAVAID_TYPE_LABELS = ['DME', 'TACAN', 'NDB', 'VOR', 'VOR/DME', 'VORTAC', 'DVOR', 'DVOR/DME', 'DVORTAC'];
  var state = {
    wrap: null,
    panel: null,
    input: null,
    list: null,
    results: [],
    activeIndex: -1,
    timer: 0,
    requestId: 0,
    highlight: null,
    highlightMap: null,
    selectedAt: 0,
    pointerStart: null,
    mapBound: null,
    ofmPoints: null,
    ofmPromise: null
  };
  function t(key, german, vars) {
    var i18n = window.GAI18n;
    if (i18n && typeof i18n.t === 'function') return i18n.t(key, vars, german);
    return String(german).replace(/\{([a-zA-Z0-9_]+)\}/g, function (m, n) {
      return vars && Object.prototype.hasOwnProperty.call(vars, n) ? String(vars[n]) : m;
    });
  }
  function getMap() {
    try {
      return typeof map !== 'undefined' && map ? map : null;
    } catch (_) {
      return null;
    }
  }
  function normText(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function wordsStartWith(text, needle) {
    if (!needle) return false;
    var hay = normText(text);
    if (!hay) return false;
    if (hay.indexOf(needle) === 0) return true;
    return (' ' + hay).indexOf(' ' + needle) !== -1;
  }
  function num(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  }
  function recordLatLon(apt) {
    if (!apt) return null;
    var lat = num(apt.lat !== undefined ? apt.lat : apt.latitude);
    var lon = num(apt.lon !== undefined ? apt.lon : apt.lng !== undefined ? apt.lng : apt.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      lat: lat,
      lon: lon
    };
  }

  // ---- Data sources ------------------------------------------------------------------

  function searchHostAirports(raw) {
    return Promise.resolve(window.gaMapSearchAirports(raw, MAX_AIRPORTS)).then(function (items) {
      var out = [];
      (items || []).forEach(function (item) {
        var lat = num(item && item.lat);
        var lon = num(item && item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || out.length >= MAX_AIRPORTS) return;
        // Same rule as the web list: OpenAIP ids are not shown as a code.
        var code = String(item.code || '');
        if (code === 'OHNE ICAO' || /^OA-/i.test(code)) code = '';
        out.push({
          kind: 'airport',
          code: code,
          name: item.name || item.code || '',
          meta: [item.typeLabel || t('map.search.kindAirport', 'Flugplatz'), item.city, item.country].filter(Boolean).join(' · '),
          lat: lat,
          lon: lon,
          favorite: !!item.favorite
        });
      });
      return out;
    }).catch(function () {
      return [];
    });
  }
  function searchAirports(raw) {
    if (typeof searchAirportCatalogCandidates !== 'function') {
      return typeof window.gaMapSearchAirports === 'function' ? searchHostAirports(raw) : Promise.resolve([]);
    }
    var codeLike = typeof isAirportCodeLike === 'function' ? isAirportCodeLike(raw) : false;
    return searchAirportCatalogCandidates(raw, 'mapSearch', MAX_AIRPORTS + 2, {
      allTypes: true,
      exact: codeLike
    }).then(function (results) {
      if (typeof airportAutocompleteResultsForQuery === 'function') results = airportAutocompleteResultsForQuery(results || [], raw);
      if (typeof sortAirportResultsByFavorite === 'function') results = sortAirportResultsByFavorite(results || []);
      var out = [];
      (results || []).forEach(function (result) {
        var pos = recordLatLon(result && result.apt);
        if (!pos || out.length >= MAX_AIRPORTS) return;
        var typeLabel = '';
        try {
          var group = window.gaAirportTypes && window.gaAirportTypes.groupForRecord && window.gaAirportTypes.groupForRecord(result.apt);
          typeLabel = group && group.shortLabel || '';
        } catch (_) {}
        // Fields without ICAO ("OHNE ICAO", OpenAIP ids) show only their name.
        var code = String(result.displayCode || result.code || '');
        if (code === 'OHNE ICAO' || /^OA-/i.test(code)) code = '';
        out.push({
          kind: 'airport',
          code: code,
          name: result.name || result.code,
          meta: [result.fuzzy ? t('map.search.similar', 'Ähnlicher Treffer') : '', typeLabel || t('map.search.kindAirport', 'Flugplatz'), result.city, result.country].filter(Boolean).join(' · '),
          lat: pos.lat,
          lon: pos.lon,
          favorite: typeof airportResultIsFavorite === 'function' ? airportResultIsFavorite(result) : false
        });
      });
      return out;
    }).catch(function () {
      return [];
    });
  }
  function loadNavaids() {
    if (typeof loadOpenAipStaticNavaids === 'function') return loadOpenAipStaticNavaids();
    if (typeof window.gaMapSearchLoadNavaids === 'function') return Promise.resolve(window.gaMapSearchLoadNavaids());
    return null;
  }
  function searchNavaids(raw) {
    if (typeof loadOpenAipStaticNavaids !== 'function' && typeof window.gaMapSearchLoadNavaids !== 'function') return Promise.resolve([]);
    var needle = normText(raw);
    var ident = String(raw || '').trim().toUpperCase();
    if (needle.length < 2) return Promise.resolve([]);
    return loadNavaids().then(function (items) {
      var scored = [];
      (items || []).forEach(function (item) {
        var id = String(item && item.identifier || '').toUpperCase();
        var score = 0;
        if (id && id === ident) score = 100;else if (id && ident.length >= 2 && id.indexOf(ident) === 0) score = 60;else if (needle.length >= 3 && wordsStartWith(item && item.name, needle)) score = 40;
        if (!score) return;
        var lat = num(item.lat);
        var lon = num(item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        scored.push({
          score: score,
          item: item,
          lat: lat,
          lon: lon
        });
      });
      scored.sort(function (a, b) {
        return b.score - a.score;
      });
      return scored.slice(0, MAX_NAVAIDS).map(function (entry) {
        var item = entry.item;
        var freq = item.frequency && item.frequency.value ? String(item.frequency.value) : '';
        var typeLabel = NAVAID_TYPE_LABELS[Number(item.type)] || t('map.search.kindNavaid', 'Funkfeuer');
        return {
          kind: 'navaid',
          code: String(item.identifier || '').toUpperCase(),
          name: item.name || item.identifier || '',
          meta: [typeLabel, freq, item.country].filter(Boolean).join(' · '),
          lat: entry.lat,
          lon: entry.lon
        };
      });
    }).catch(function () {
      return [];
    });
  }
  function loadOfmPoints() {
    if (state.ofmPoints) return Promise.resolve(state.ofmPoints);
    if (state.ofmPromise) return state.ofmPromise;
    state.ofmPromise = fetch(ofmPointsUrl(), {
      cache: 'default'
    }).then(function (response) {
      return response.ok ? response.json() : null;
    }).then(function (data) {
      state.ofmPoints = data && Array.isArray(data.points) ? data.points : [];
      return state.ofmPoints;
    }).catch(function () {
      state.ofmPoints = [];
      return state.ofmPoints;
    }).then(function (points) {
      state.ofmPromise = null;
      return points;
    });
    return state.ofmPromise;
  }
  function searchReportingPoints(raw) {
    var needle = normText(raw);
    if (needle.length < 3) return Promise.resolve([]);
    // "EDTW N" or "EDTW NOVEMBER": airfield code plus point name.
    var parts = needle.split(' ');
    var airportFilter = parts.length > 1 && /^[a-z0-9]{4}$/.test(parts[0]) ? parts[0].toUpperCase() : '';
    var nameNeedle = airportFilter ? parts.slice(1).join(' ') : needle;
    return loadOfmPoints().then(function (points) {
      var out = [];
      for (var i = 0; i < points.length && out.length < MAX_POINTS; i += 1) {
        var p = points[i];
        if (!p) continue;
        var airport = String(p.airport || '').toUpperCase();
        if (airportFilter && airport !== airportFilter) continue;
        var match = wordsStartWith(p.name, nameNeedle) || airportFilter && normText(p.id).indexOf(nameNeedle) === 0;
        if (!match) continue;
        var lat = num(p.lat);
        var lon = num(p.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        out.push({
          kind: 'point',
          code: String(p.id || '').toUpperCase(),
          name: p.name || p.id || '',
          meta: [t('map.search.kindPoint', 'Meldepunkt'), airport].filter(Boolean).join(' · '),
          lat: lat,
          lon: lon
        });
      }
      return out;
    }).catch(function () {
      return [];
    });
  }

  // ---- Panel -------------------------------------------------------------------------

  function ensurePanel() {
    if (state.panel) return state.panel;
    var wrap = document.getElementById('mapSearchWrap');
    if (!wrap) return null;
    var panel = document.createElement('div');
    panel.id = 'mapSearchPanel';
    panel.className = 'map-search-panel';
    panel.hidden = true;
    var input = document.createElement('input');
    input.type = 'search';
    input.id = 'mapSearchInput';
    input.className = 'map-search-input';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('enterkeyhint', 'search');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', 'mapSearchResults');
    input.maxLength = 64;
    var list = document.createElement('div');
    list.id = 'mapSearchResults';
    list.className = 'map-search-results';
    list.setAttribute('role', 'listbox');
    panel.appendChild(input);
    panel.appendChild(list);
    wrap.appendChild(panel);
    input.addEventListener('input', function () {
      queueSearch();
    });
    input.addEventListener('keydown', onKeydown);
    // Map shortcuts (arrow-key zoom etc.) must not see the typing.
    input.addEventListener('keyup', function (event) {
      event.stopPropagation();
    });
    document.addEventListener('mousedown', onOutsidePointer, true);
    document.addEventListener('touchstart', onOutsidePointer, true);
    state.wrap = wrap;
    state.panel = panel;
    state.input = input;
    state.list = list;
    return panel;
  }
  function onOutsidePointer(event) {
    if (!state.panel || state.panel.hidden) return;
    if (state.wrap && state.wrap.contains(event.target)) return;
    closePanel();
  }
  function setButtonOpen(open) {
    var btn = document.getElementById('mapSearchBtn');
    if (!btn) return;
    btn.classList.toggle('map-menu-open', !!open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    // The header has a backdrop filter (own stacking layer): lift it above the map while open.
    var header = btn.closest('.pinboard-header');
    if (header) header.classList.toggle('map-search-open', !!open);
  }
  function openPanel() {
    var panel = ensurePanel();
    if (!panel) return;
    state.input.placeholder = t('map.search.placeholder', 'Flugplatz, Funkfeuer, Meldepunkt …');
    state.input.setAttribute('aria-label', t('map.search.aria', 'Auf der Karte suchen'));
    panel.hidden = false;
    setButtonOpen(true);
    try {
      state.input.focus();
      state.input.select();
    } catch (_) {}
    if (String(state.input.value || '').trim()) queueSearch();
    // Warm up the navaid and reporting point files while the user types.
    var navaidLoad = loadNavaids();
    if (navaidLoad && typeof navaidLoad.catch === 'function') navaidLoad.catch(function () {});
    loadOfmPoints();
  }
  function closePanel() {
    if (!state.panel) return;
    state.panel.hidden = true;
    setButtonOpen(false);
    if (state.timer) clearTimeout(state.timer);
    state.requestId += 1;
  }
  function togglePanel() {
    var panel = ensurePanel();
    if (!panel) return;
    if (panel.hidden) openPanel();else closePanel();
  }
  function renderStatus(text) {
    state.results = [];
    state.activeIndex = -1;
    state.list.innerHTML = '';
    if (!text) return;
    var status = document.createElement('div');
    status.className = 'map-search-status';
    status.setAttribute('role', 'status');
    status.textContent = text;
    state.list.appendChild(status);
  }
  var KIND_ICONS = {
    airport: '✈',
    navaid: '◈',
    point: '▲'
  };
  function renderResults(results) {
    state.results = results;
    state.list.innerHTML = '';
    if (!results.length) {
      renderStatus(t('map.search.none', 'Nichts gefunden'));
      return;
    }
    results.forEach(function (result, index) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'map-search-option map-search-kind-' + result.kind + (result.favorite ? ' is-favorite' : '');
      button.setAttribute('role', 'option');
      button.dataset.index = String(index);
      var icon = document.createElement('span');
      icon.className = 'map-search-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = result.favorite ? '★' : KIND_ICONS[result.kind] || '•';
      var code = document.createElement('span');
      code.className = 'map-search-code';
      code.textContent = result.code || '';
      var name = document.createElement('span');
      name.className = 'map-search-name';
      name.textContent = result.name || '';
      var meta = document.createElement('span');
      meta.className = 'map-search-meta';
      meta.textContent = result.meta || '';
      button.appendChild(icon);
      button.appendChild(code);
      button.appendChild(name);
      button.appendChild(meta);
      button.addEventListener('mousedown', function (event) {
        event.preventDefault();
      });
      button.addEventListener('click', function () {
        selectResult(result);
      });
      button.addEventListener('mouseenter', function () {
        setActive(index);
      });
      state.list.appendChild(button);
    });
    setActive(0);
  }
  function setActive(index) {
    var options = state.list.querySelectorAll('.map-search-option');
    if (!options.length) {
      state.activeIndex = -1;
      return;
    }
    var next = Math.max(0, Math.min(options.length - 1, index));
    for (var i = 0; i < options.length; i += 1) options[i].classList.toggle('is-active', i === next);
    state.activeIndex = next;
    try {
      options[next].scrollIntoView({
        block: 'nearest'
      });
    } catch (_) {}
  }
  function queueSearch() {
    if (state.timer) clearTimeout(state.timer);
    var raw = String(state.input.value || '').trim();
    var requestId = state.requestId + 1;
    state.requestId = requestId;
    if (raw.length < 2) {
      renderStatus('');
      return;
    }
    renderStatus(t('map.search.searching', 'Suche …'));
    state.timer = setTimeout(function () {
      Promise.all([searchAirports(raw), searchNavaids(raw), searchReportingPoints(raw)]).then(function (groups) {
        if (requestId !== state.requestId || String(state.input.value || '').trim() !== raw) return;
        var airports = groups[0];
        var navaids = groups[1];
        var points = groups[2];
        // An exact navaid identifier ("WLD") goes first, otherwise airfields lead.
        var ident = raw.toUpperCase();
        var exactNavaid = navaids.filter(function (n) {
          return n.code === ident;
        });
        var exactAirport = airports.filter(function (a) {
          return String(a.code).toUpperCase() === ident;
        });
        var ordered = exactAirport.length ? airports.concat(navaids, points) : exactNavaid.length ? navaids.concat(airports, points) : airports.concat(navaids, points);
        renderResults(ordered);
      });
    }, 220);
  }
  function onKeydown(event) {
    event.stopPropagation();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(state.activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(state.activeIndex - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      var result = state.results[state.activeIndex];
      if (result) selectResult(result);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closePanel();
    }
  }

  // ---- Map: centre and highlight ------------------------------------------------------

  function clearHighlight() {
    if (state.highlight && state.highlightMap) {
      try {
        state.highlightMap.removeLayer(state.highlight);
      } catch (_) {}
    }
    state.highlight = null;
    state.highlightMap = null;
  }
  function bindMapClickClear(targetMap) {
    if (state.mapBound === targetMap) return;
    state.mapBound = targetMap;
    var container = targetMap.getContainer();
    // A click (not a drag) anywhere on the map ends the highlight, markers included.
    // mousedown/touchstart as well: Coherent (EFB) has no pointer events.
    function markStart(event) {
      var point = event.touches && event.touches[0] ? event.touches[0] : event;
      state.pointerStart = {
        x: point.clientX,
        y: point.clientY
      };
    }
    container.addEventListener('pointerdown', markStart, true);
    container.addEventListener('mousedown', markStart, true);
    container.addEventListener('touchstart', markStart, true);
    container.addEventListener('click', function (event) {
      if (!state.highlight) return;
      if (Date.now() - state.selectedAt < 400) return;
      var start = state.pointerStart;
      if (start && Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y) > 8) return;
      clearHighlight();
    }, true);
  }
  function selectResult(result) {
    var targetMap = getMap();
    closePanel();
    if (!targetMap || !window.L || !result) return;
    // Direct-To-Modus: der Treffer wird Start bzw. Ziel statt nur angezeigt.
    if (typeof window.gaMapSearchPick === 'function') {
      var picked = false;
      try {
        picked = window.gaMapSearchPick(result) === true;
      } catch (_) {}
      if (picked) {
        clearHighlight();
        return;
      }
    }
    var lat = result.lat;
    var lon = result.lon;
    // Searching means looking elsewhere: stop following the aircraft.
    try {
      if (typeof isAutoFollow !== 'undefined' && isAutoFollow && typeof toggleAutoFollow === 'function') toggleAutoFollow(false);
    } catch (_) {}
    try {
      if (typeof markMapAutoZoomUserZoomIntent === 'function') markMapAutoZoomUserZoomIntent(Date.now(), 2500);
    } catch (_) {}
    var dLat = VIEW_HALF_NM / 60;
    var dLon = VIEW_HALF_NM / (60 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
    var bounds = L.latLngBounds([lat - dLat, lon - dLon], [lat + dLat, lon + dLon]);
    try {
      targetMap.fitBounds(bounds, {
        padding: [0, 0],
        animate: true,
        maxZoom: 14
      });
    } catch (_) {
      targetMap.setView([lat, lon], 12);
    }
    clearHighlight();
    var icon = L.divIcon({
      className: 'map-search-highlight',
      html: '<span class="map-search-highlight-ring"></span><span class="map-search-highlight-ring is-delayed"></span><span class="map-search-highlight-dot"></span>',
      iconSize: [64, 64],
      iconAnchor: [32, 32]
    });
    var marker = L.marker([lat, lon], {
      icon: icon,
      interactive: false,
      keyboard: false,
      zIndexOffset: 2000
    });
    var label = [result.code, result.name].filter(Boolean);
    if (label.length === 2 && String(label[0]).toUpperCase() === String(label[1]).toUpperCase()) label = [label[0]];
    marker.bindTooltip(label.join(' · '), {
      permanent: true,
      direction: 'top',
      offset: [0, -30],
      className: 'map-search-highlight-label'
    });
    marker.addTo(targetMap);
    state.highlight = marker;
    state.highlightMap = targetMap;
    state.selectedAt = Date.now();
    bindMapClickClear(targetMap);
  }
  window.gaToggleMapSearch = togglePanel;
  window.gaCloseMapSearch = closePanel;
  window.gaClearMapSearchHighlight = clearHighlight;
})();
