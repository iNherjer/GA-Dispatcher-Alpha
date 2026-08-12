(function () {
  'use strict';

  var API = window.GAMapShellCore;
  var L = window.L;
  var PREFERENCES_KEY = 'ga_efb_tracker_kartentisch_v1';
  var INFO_BOX_STORAGE_KEY = 'ga_efb_tracker_info_boxes_v1';
  var map = null;
  var flight = null;
  var mapSnapshot = null;
  var missionSnapshot = null;
  var missionSignature = '';
  var mapRevision = 0;
  var routeSignature = '';
  var planeMarker = null;
  var planeHeading = null;
  var routeLayer = null;
  var geometryLayer = null;
  var previewLayer = null;
  var previewLine = null;
  var drawingLayer = null;
  var measureLayer = null;
  var baseLayers = {};
  var overlayLayers = {};
  var layerControl = null;
  var firstRouteFit = false;
  var firstFlightCenter = false;
  var pollTimer = 0;
  var trackerOnline = false;
  var profileZoom = 0;
  var profileYAxis = 0;
  var drawMode = '';
  var drawPoints = [];
  var drawLine = null;
  var drawStrokeActive = false;
  var drawLastContainerPoint = null;
  var drawHistory = [];
  var drawColor = '#ff3b30';
  var drawWeight = 5;
  var routeProgressTarget = 'wpt';
  var previewWaypointIndex = null;
  var lastParentState = '';
  var preferences = readPreferences();
  var infoBoxState = readInfoBoxState();
  var lastProfileDiagnostic = '';
  var drawerView = 'mission';
  var drawerChecklistId = '';
  var EFB_CHECKLIST_PROGRESS_KEY = 'ga_efb_tracker_checklist_progress_v1';
  var efbChecklistProgress = readEfbChecklistProgress();
  var EFB_CHECKLISTS = [
    { id: 'vfr-briefing', title: 'VFR Briefing', sections: [
      { title: 'Route', items: ['Start, Ziel und Ausweichplatz geprueft', 'Kurs, Strecke und ETE plausibel', 'Reiseflughoehe und Terrain geprueft', 'Luftraeume und Frequenzen notiert'] },
      { title: 'Wetter', items: ['METAR/TAF geprueft', 'Wind, Sicht und Wolkenuntergrenze bewertet', 'Tageslicht und Reserven beruecksichtigt'] },
      { title: 'Aircraft', items: ['Fuel und Reserve gerechnet', 'Beladung und Schwerpunkt geprueft', 'Dokumente und Notverfahren bereit'] }
    ] },
    { id: 'sep-normal', title: 'SEP Normal Procedures', sections: [
      { title: 'Before Start', items: ['Parking brake set', 'Fuel selector and quantity checked', 'Avionics off, circuit breakers checked', 'Departure brief complete'] },
      { title: 'Run-up / Takeoff', items: ['Engine instruments in green', 'Flight controls free and correct', 'Trim and flaps set', 'Runway, heading and wind confirmed'] },
      { title: 'Cruise', items: ['Power, mixture and trim set', 'Navigation cross-checked', 'Fuel and endurance monitored'] }
    ] },
    { id: 'arrival', title: 'Arrival / Landing', sections: [
      { title: 'Arrival', items: ['Airport elevation, runway and circuit checked', 'Frequency and reporting points ready', 'Wind, QNH and visibility checked'] },
      { title: 'Approach', items: ['Approach speed and flap plan briefed', 'Go-around path and safe altitude briefed', 'Landing distance acceptable'] },
      { title: 'After Landing', items: ['Runway vacated', 'Flaps retracted', 'Taxi and parking plan confirmed'] }
    ] }
  ];

  function byId(id) { return document.getElementById(id); }
  function setText(id, value) { var node = byId(id); if (node) node.textContent = String(value == null ? '' : value); }
  function isFiniteNumber(value) { return typeof value === 'number' && isFinite(value); }
  function finite(value) { var number = Number(value); return isFiniteNumber(number) ? number : null; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function safePayload(envelope) { return envelope && envelope.message && envelope.message.payload || null; }
  function formatNumber(value, digits) { var number = finite(value); return number == null ? '--' : number.toFixed(digits); }
  function leftPad(value, length) { var result = String(value); while (result.length < length) result = '0' + result; return result; }
  function pad2(value) { return leftPad(Math.max(0, Math.round(value)), 2); }
  function radians(value) { return Number(value) * Math.PI / 180; }
  function distanceNmBetween(a, b) {
    if (!a || !b) return null;
    if (map) return map.distance([a.lat, a.lon], [b.lat, b.lon]) / 1852;
    var lat1 = radians(a.lat);
    var lat2 = radians(b.lat);
    var dLat = lat2 - lat1;
    var dLon = radians(Number(b.lon) - Number(a.lon));
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 3440.065 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  }
  function bearingBetween(a, b) {
    if (!a || !b) return 0;
    var lat1 = radians(a.lat);
    var lat2 = radians(b.lat);
    var dLon = radians(Number(b.lon) - Number(a.lon));
    var y = Math.sin(dLon) * Math.cos(lat2);
    var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  function report(level, event, stage, message, details) {
    if (typeof window.__gaEfbReport === 'function') window.__gaEfbReport(level, event, stage, message, details);
  }
  function boot(stage, message, error) {
    if (typeof window.__gaEfbBoot === 'function') window.__gaEfbBoot(stage, message, error);
    else report(error ? 'error' : 'info', 'boot', stage, message);
  }
  function etaText(distanceNm, gsKts) {
    if (!(distanceNm >= 0) || !(gsKts > 1)) return '--:--';
    var date = new Date(Date.now() + distanceNm / gsKts * 3600000);
    return pad2(date.getHours()) + ':' + pad2(date.getMinutes());
  }
  function durationText(distanceNm, gsKts) {
    if (!(distanceNm >= 0) || !(gsKts > 1)) return '--';
    var minutes = Math.round(distanceNm / gsKts * 60);
    return minutes < 60 ? minutes + ' MIN' : Math.floor(minutes / 60) + ':' + pad2(minutes % 60) + ' H';
  }

  function readPreferences() {
    try { return API.normalizePreferences(JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}')); }
    catch (_) { return API.normalizePreferences(); }
  }

  function savePreferences() {
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences)); } catch (_) {}
  }

  function readInfoBoxState() {
    var result = {};
    ['liveTelemetryBox', 'liveCurrentBox', 'liveNextWpBox'].forEach(function (id) {
      result[id] = { hidden: false, top: '', left: '' };
    });
    try {
      var source = JSON.parse(localStorage.getItem(INFO_BOX_STORAGE_KEY) || '{}');
      Object.keys(result).forEach(function (id) {
        var item = source && source[id];
        if (!item || typeof item !== 'object') return;
        result[id].hidden = item.hidden === true;
        result[id].top = typeof item.top === 'string' ? item.top : '';
        result[id].left = typeof item.left === 'string' ? item.left : '';
      });
    } catch (_) {}
    return result;
  }

  function readEfbChecklistProgress() {
    try {
      var source = JSON.parse(localStorage.getItem(EFB_CHECKLIST_PROGRESS_KEY) || '{}');
      return source && typeof source === 'object' ? source : {};
    } catch (_) { return {}; }
  }

  function saveEfbChecklistProgress() {
    try { localStorage.setItem(EFB_CHECKLIST_PROGRESS_KEY, JSON.stringify(efbChecklistProgress)); } catch (_) {}
  }

  function saveInfoBoxState() {
    try { localStorage.setItem(INFO_BOX_STORAGE_KEY, JSON.stringify(infoBoxState)); } catch (_) {}
  }

  function infoBoxVisible(id) {
    return !infoBoxState[id] || infoBoxState[id].hidden !== true;
  }

  function updateInfoRestoreButton() {
    var button = document.querySelector('.ga-efb-host-infos');
    if (!button) return;
    var hidden = Object.keys(infoBoxState).filter(function (id) { return infoBoxState[id].hidden === true; }).length;
    button.textContent = hidden ? 'Anzeige (' + hidden + ')' : 'Anzeige';
    button.classList.toggle('active', hidden > 0);
  }

  function setInfoBoxAvailability(id, available) {
    var node = byId(id);
    if (node) node.style.display = available && infoBoxVisible(id) ? 'block' : 'none';
  }

  function showAllInfoBoxes() {
    Object.keys(infoBoxState).forEach(function (id) { infoBoxState[id].hidden = false; });
    saveInfoBoxState();
    setInfoBoxAvailability('liveTelemetryBox', !!flight);
    setInfoBoxAvailability('liveCurrentBox', !!flight);
    setInfoBoxAvailability('liveNextWpBox', !!(mapSnapshot && mapSnapshot.navigation));
    updateInfoRestoreButton();
    report('info', 'info-box', 'restore-all', 'Infofenster wieder eingeblendet');
  }

  function hideInfoBox(id) {
    if (!infoBoxState[id]) return;
    infoBoxState[id].hidden = true;
    saveInfoBoxState();
    setInfoBoxAvailability(id, false);
    updateInfoRestoreButton();
    report('info', 'info-box', 'close-' + id, 'Infofenster ausgeblendet');
  }

  function resetInfoBoxPosition(node) {
    if (!node || !infoBoxState[node.id]) return;
    infoBoxState[node.id].top = '';
    infoBoxState[node.id].left = '';
    saveInfoBoxState();
    node.classList.remove('tele-dragged');
    var defaults = {
      liveTelemetryBox: { top: '10px', left: '50%', transform: 'translateX(-50%)' },
      liveCurrentBox: { top: '10px', left: 'calc(50% - 230px)', transform: 'none' },
      liveNextWpBox: { top: '10px', left: 'calc(50% + 128px)', transform: 'none' }
    };
    var initial = defaults[node.id];
    if (initial) {
      node.style.top = initial.top;
      node.style.left = initial.left;
      node.style.right = 'auto';
      node.style.transform = initial.transform;
    }
  }

  function bindInfoBoxDrag(node) {
    if (!node || node.getAttribute('data-ga-drag-bound') === '1') return;
    node.setAttribute('data-ga-drag-bound', '1');
    var saved = infoBoxState[node.id];
    if (saved && saved.top && saved.left) {
      node.style.top = saved.top;
      node.style.left = saved.left;
      node.style.right = 'auto';
      node.style.transform = 'none';
      node.classList.add('tele-dragged');
    }
    var dragging = false;
    var startX = 0;
    var startY = 0;
    var startTop = 0;
    var startLeft = 0;
    function eventPoint(event) {
      var source = event && event.touches && event.touches.length ? event.touches[0] : event;
      return source ? { x: Number(source.clientX) || 0, y: Number(source.clientY) || 0 } : null;
    }
    function begin(event) {
      if (event.target && event.target.closest && event.target.closest('button')) return;
      if (event.button != null && event.button !== 0) return;
      var point = eventPoint(event);
      if (!point) return;
      if (event.preventDefault) event.preventDefault();
      if (event.stopPropagation) event.stopPropagation();
      dragging = true;
      startX = point.x;
      startY = point.y;
      startTop = node.offsetTop;
      startLeft = node.offsetLeft;
      node.classList.add('tele-dragging');
      try { if (event.pointerId != null && node.setPointerCapture) node.setPointerCapture(event.pointerId); } catch (_) {}
    }
    function move(event) {
      if (!dragging) return;
      var point = eventPoint(event);
      if (!point) return;
      if (event.preventDefault) event.preventDefault();
      if (event.stopPropagation) event.stopPropagation();
      var parent = node.parentElement;
      var maxLeft = Math.max(5, parent.clientWidth - node.offsetWidth - 5);
      var maxTop = Math.max(5, parent.clientHeight - node.offsetHeight - 5);
      var left = clamp(startLeft + point.x - startX, 5, maxLeft);
      var top = clamp(startTop + point.y - startY, 5, maxTop);
      node.style.top = Math.round(top) + 'px';
      node.style.left = Math.round(left) + 'px';
      node.style.right = 'auto';
      node.style.transform = 'none';
      node.classList.add('tele-dragged');
    }
    function end(event) {
      if (!dragging) return;
      dragging = false;
      node.classList.remove('tele-dragging');
      if (infoBoxState[node.id]) {
        infoBoxState[node.id].top = node.style.top;
        infoBoxState[node.id].left = node.style.left;
        saveInfoBoxState();
      }
      try { if (event && event.pointerId != null && node.releasePointerCapture) node.releasePointerCapture(event.pointerId); } catch (_) {}
    }
    if (window.PointerEvent) {
      node.addEventListener('pointerdown', begin, false);
      node.addEventListener('pointermove', move, false);
      node.addEventListener('pointerup', end, false);
      node.addEventListener('pointercancel', end, false);
    } else {
      node.addEventListener('mousedown', begin, false);
      window.addEventListener('mousemove', move, false);
      window.addEventListener('mouseup', end, false);
      node.addEventListener('touchstart', begin, false);
      window.addEventListener('touchmove', move, false);
      window.addEventListener('touchend', end, false);
    }
    node.addEventListener('dblclick', function (event) {
      if (event.target && event.target.closest && event.target.closest('button')) return;
      resetInfoBoxPosition(node);
    });
  }

  function setupInfoBoxes() {
    Object.keys(infoBoxState).forEach(function (id) {
      var node = byId(id);
      if (!node) return;
      var close = makeButton('ga-info-box-close', 'X', function () { hideInfoBox(id); });
      close.title = 'Infofenster schliessen';
      close.setAttribute('aria-label', 'Infofenster schliessen');
      node.appendChild(close);
      bindInfoBoxDrag(node);
    });
    updateInfoRestoreButton();
  }

  function drawerEscape(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function checklistItems(checklist) {
    var items = [];
    (checklist && checklist.sections || []).forEach(function (section, sectionIndex) {
      (section.items || []).forEach(function (text, itemIndex) {
        items.push({ key: checklist.id + ':' + sectionIndex + ':' + itemIndex, text: text, section: section.title });
      });
    });
    return items;
  }

  function checklistDoneCount(checklist) {
    return checklistItems(checklist).filter(function (item) { return efbChecklistProgress[item.key] === true; }).length;
  }

  function missionStatusMarkup() {
    var mission = missionSnapshot && missionSnapshot.available !== false ? missionSnapshot : null;
    if (!mission || !mission.missionId) {
      return '<div class="ga-efb-drawer-empty"><strong>Keine aktive Mission</strong><span>Der Tracker meldet aktuell keine priorisierte Mission.</span></div>';
    }
    var route = mission.route && typeof mission.route === 'object' ? mission.route : {};
    var cargo = mission.cargo && typeof mission.cargo === 'object' ? mission.cargo : {};
    var title = mission.title || mission.name || mission.missionId;
    var state = mission.state || (mission.active ? 'active' : 'unknown');
    var phase = mission.phase || mission.runtimePhase || mission.startPhase || '--';
    var routeText = [route.start || route.departure || '', route.destination || route.end || ''].filter(Boolean).join(' -> ');
    var cargoText = '';
    if (cargo.total != null || cargo.required != null) {
      cargoText = '<div><dt>Cargo</dt><dd>' + drawerEscape(cargo.loaded || 0) + ' / ' + drawerEscape(cargo.required != null ? cargo.required : cargo.total) + ' geladen</dd></div>';
    }
    return '<div class="ga-efb-mission-card">'
      + '<div class="ga-efb-mission-live"><span></span>TRACKER-WAHRHEIT</div>'
      + '<h3>' + drawerEscape(title) + '</h3>'
      + '<div class="ga-efb-mission-id">' + drawerEscape(mission.missionId) + '</div>'
      + '<dl>'
      + '<div><dt>Status</dt><dd>' + drawerEscape(state) + '</dd></div>'
      + '<div><dt>Phase</dt><dd>' + drawerEscape(phase) + '</dd></div>'
      + (routeText ? '<div><dt>Route</dt><dd>' + drawerEscape(routeText) + '</dd></div>' : '')
      + '<div><dt>Szenen</dt><dd>' + drawerEscape(mission.sceneCount || 0) + '</dd></div>'
      + cargoText
      + '</dl>'
      + '<p>Read-only: Fortschritt und Missionshoheit kommen direkt vom Tracker.</p>'
      + '</div>';
  }

  function checklistListMarkup() {
    return '<div class="ga-efb-checklist-list">' + EFB_CHECKLISTS.map(function (checklist) {
      var total = checklistItems(checklist).length;
      var done = checklistDoneCount(checklist);
      return '<button type="button" data-efb-drawer-action="open-checklist" data-checklist-id="' + drawerEscape(checklist.id) + '">'
        + '<strong>' + drawerEscape(checklist.title) + '</strong>'
        + '<span>' + done + ' / ' + total + ' erledigt</span>'
        + '</button>';
    }).join('') + '</div>';
  }

  function selectedChecklistMarkup() {
    var checklist = null;
    EFB_CHECKLISTS.some(function (candidate) {
      if (candidate.id !== drawerChecklistId) return false;
      checklist = candidate;
      return true;
    });
    if (!checklist) return checklistListMarkup();
    var html = '<button type="button" class="ga-efb-drawer-back" data-efb-drawer-action="checklist-list">&lt; Alle Checklisten</button>';
    html += '<div class="ga-efb-checklist-detail"><h3>' + drawerEscape(checklist.title) + '</h3>';
    checklist.sections.forEach(function (section, sectionIndex) {
      html += '<section><h4>' + drawerEscape(section.title) + '</h4>';
      section.items.forEach(function (text, itemIndex) {
        var key = checklist.id + ':' + sectionIndex + ':' + itemIndex;
        html += '<label><input type="checkbox" data-efb-check-item="' + drawerEscape(key) + '"'
          + (efbChecklistProgress[key] === true ? ' checked' : '') + '><span>' + drawerEscape(text) + '</span></label>';
      });
      html += '</section>';
    });
    return html + '</div>';
  }

  function renderSideDrawer() {
    var body = byId('checklistDrawerBody');
    var title = byId('checklistDrawerTitle');
    var status = byId('checklistDrawerStatus');
    if (!body) return;
    if (title) title.textContent = drawerView === 'mission' ? 'Missionsstatus' : 'Checklisten';
    if (status) status.textContent = drawerView === 'mission' ? 'Live vom Tracker | nur Lesen' : 'Fortschritt bleibt lokal in diesem EFB';
    var tabs = '<div class="ga-efb-drawer-tabs">'
      + '<button type="button" data-efb-drawer-action="mission" class="' + (drawerView === 'mission' ? 'active' : '') + '">Mission</button>'
      + '<button type="button" data-efb-drawer-action="checklists" class="' + (drawerView === 'checklists' ? 'active' : '') + '">Checklisten</button>'
      + '</div>';
    body.innerHTML = tabs + (drawerView === 'mission' ? missionStatusMarkup() : (drawerChecklistId ? selectedChecklistMarkup() : checklistListMarkup()));
  }

  function openSideDrawer(view) {
    var drawer = byId('mapSideDrawer');
    var handle = byId('mapSideDrawerHandle');
    if (!drawer) return;
    if (view === 'mission' || view === 'checklists') drawerView = view;
    drawer.classList.add('is-open');
    if (handle) handle.setAttribute('aria-expanded', 'true');
    renderSideDrawer();
    report('info', 'side-drawer', 'open-' + drawerView, 'EFB-Seitenmenue geoeffnet');
  }

  function setupSideDrawer() {
    var drawer = byId('mapSideDrawer');
    var body = byId('checklistDrawerBody');
    if (!drawer || !body) return;
    drawer.style.display = 'block';
    window.gaChecklistToggleDrawer = function (force) {
      var next = typeof force === 'boolean' ? force : !drawer.classList.contains('is-open');
      drawer.classList.toggle('is-open', next);
      var handle = byId('mapSideDrawerHandle');
      if (handle) handle.setAttribute('aria-expanded', next ? 'true' : 'false');
      if (next) renderSideDrawer();
      report('info', 'side-drawer', next ? 'open-' + drawerView : 'close', 'EFB-Seitenmenue umgeschaltet');
    };
    body.addEventListener('click', function (event) {
      var actionNode = event.target && event.target.closest ? event.target.closest('[data-efb-drawer-action]') : null;
      if (!actionNode) return;
      var action = actionNode.getAttribute('data-efb-drawer-action');
      if (action === 'mission') { drawerView = 'mission'; drawerChecklistId = ''; }
      if (action === 'checklists' || action === 'checklist-list') { drawerView = 'checklists'; drawerChecklistId = ''; }
      if (action === 'open-checklist') { drawerView = 'checklists'; drawerChecklistId = actionNode.getAttribute('data-checklist-id') || ''; }
      renderSideDrawer();
      event.preventDefault();
      event.stopPropagation();
    });
    body.addEventListener('change', function (event) {
      var key = event.target && event.target.getAttribute ? event.target.getAttribute('data-efb-check-item') : '';
      if (!key) return;
      efbChecklistProgress[key] = event.target.checked === true;
      saveEfbChecklistProgress();
      renderSideDrawer();
    });
    ['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick', 'wheel'].forEach(function (type) {
      drawer.addEventListener(type, function (event) { event.stopPropagation(); }, false);
    });
    renderSideDrawer();
  }

  function notifyParent(state, detail) {
    if (typeof window.__gaEfbNotifyParent === 'function') {
      window.__gaEfbNotifyParent(state, detail || {});
      return;
    }
    try {
      window.parent.postMessage({
        type: 'ga-efb-kartentisch',
        state: state,
        channel: String(window.__gaEfbChannel || '')
      }, '*');
    } catch (_) {}
  }

  function notifyParentState(state, detail) {
    if (lastParentState === state) return;
    lastParentState = state;
    notifyParent(state, detail || {});
  }

  function closeHost(reason) {
    // Das Original-Markup entfernt diese Klassen vor toggleMapTable(). Falls
    // der Parent die Nachricht nicht annimmt, darf die Seite nicht leer werden.
    if (document.body) document.body.classList.add('map-is-fullscreen');
    document.documentElement.classList.add('map-is-fullscreen');
    report('info', 'close', reason || 'button', 'Schliessen an EFB-Host gemeldet');
    notifyParent('close', { stage: reason || 'button' });
    return false;
  }

  function applyTheme(theme) {
    var ids = API.THEMES.map(function (entry) { return entry.id; });
    ids.forEach(function (id) { document.body.classList.remove('theme-' + id); });
    document.body.classList.add('theme-' + theme);
    preferences.theme = theme;
    var entry = null;
    API.THEMES.some(function (candidate) { if (candidate.id !== theme) return false; entry = candidate; return true; });
    var button = document.querySelector('.ga-efb-host-design');
    if (button) button.textContent = 'Design: ' + (entry ? entry.label : theme);
    savePreferences();
    if (map) window.setTimeout(function () { map.invalidateSize(false); }, 50);
  }

  function cycleTheme() {
    var index = -1;
    API.THEMES.some(function (entry, candidateIndex) {
      if (entry.id !== preferences.theme) return false;
      index = candidateIndex;
      return true;
    });
    var next = API.THEMES[(index + 1) % API.THEMES.length];
    applyTheme(next.id);
  }

  function setTrackerState(text, error) {
    var node = document.querySelector('.ga-efb-host-state');
    if (!node) return;
    node.textContent = text;
    node.classList.toggle('error', !!error);
  }

  function makeButton(className, label, callback) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      callback();
    });
    return button;
  }

  function toggleLayerMenu() {
    var control = document.querySelector('.leaflet-control-layers');
    if (!control) return;
    control.classList.toggle('leaflet-control-layers-expanded');
    report('info', 'toolbar', 'layers', 'Layerauswahl umgeschaltet');
  }

  function configureOriginalChrome() {
    var overlay = byId('mapTableOverlay');
    if (overlay) overlay.classList.add('active');
    setText('navStationLabel', 'NAV STATION (KARTENTISCH) | HOST 0.4.9');

    var toolbarRow = byId('mapToolbarInner');
    var actions = toolbarRow && toolbarRow.lastElementChild;
    var profileButton = byId('vpToggleBtn');
    if (actions && profileButton) {
      var design = makeButton('pb-btn ga-efb-host-design', 'Design', cycleTheme);
      profileButton.insertAdjacentElement('afterend', design);
      var infos = makeButton('pb-btn ga-efb-host-infos', 'Anzeige', showAllInfoBoxes);
      design.insertAdjacentElement('afterend', infos);
      var missionButton = makeButton('pb-btn ga-efb-host-mission', 'Mission', function () { openSideDrawer('mission'); });
      infos.insertAdjacentElement('afterend', missionButton);
      var checklistButton = makeButton('pb-btn ga-efb-host-checklists', 'Checklisten', function () { openSideDrawer('checklists'); });
      missionButton.insertAdjacentElement('afterend', checklistButton);
      var layerButton = makeButton('pb-btn ga-efb-host-layers', 'Layer', toggleLayerMenu);
      checklistButton.insertAdjacentElement('afterend', layerButton);
      layerButton.insertAdjacentElement('afterend', makeButton('pb-btn ga-efb-host-tools', 'Werkzeuge', function () {
        window.toggleMapToolRail();
      }));
      actions.appendChild(makeButton('ga-efb-host-state', 'Tracker wird verbunden', function () {}));
    }

    var reset = actions && actions.querySelector('button[onclick="resetMainRoute()"]');
    if (reset) { reset.textContent = 'Route read-only'; reset.disabled = true; reset.title = 'Die Route kommt aus dem Tracker'; }
    var closeButtons = actions && actions.querySelectorAll('.pb-btn.close');
    if (closeButtons) Array.prototype.forEach.call(closeButtons, function (button) { button.textContent = 'X'; });
    setText('mapToolbarToggle', '^');
    setText('autoFollowBtn', 'FOLLOW');
    setText('mapDrawFloatingBtn', 'TOOLS');
    setText('mapToolPen', 'PEN');
    setText('mapToolEraser', 'DEL');
    setText('mapToolSettings', 'SET');
    setText('mapToolDrawClear', 'CLR');
    setText('mapToolMeasure', 'NM');
    setText('mapToolStopwatch', 'TMR');
    setText('mapToolCalculator', 'CALC');
    setText('mapToolE6B', 'E6B');
    setText('nextLegPrevBtn', '<');
    setText('nextLegNextBtn', '>');

    var keypad = byId('mapCalculatorDevice');
    if (keypad) {
      var replacements = { backspace: 'DEL', percent: '%', equals: '=', clear: 'C' };
      Object.keys(replacements).forEach(function (key) {
        var button = keypad.querySelector('[data-calc="' + key + '"]');
        if (button) button.textContent = replacements[key];
      });
      Array.prototype.forEach.call(keypad.querySelectorAll('[data-calc="operator"]'), function (button) {
        button.textContent = button.getAttribute('data-op') || button.textContent;
      });
    }

    document.body.classList.toggle('toolbar-collapsed', preferences.toolbarCollapsed);
    document.body.classList.toggle('profile-hidden', !preferences.profileVisible);
    syncProfileButton();
    applyTheme(preferences.theme);
    setupInfoBoxes();
    setupSideDrawer();
  }

  function createTileLayer(definition, paneName) {
    var options = {};
    Object.keys(definition.options || {}).forEach(function (key) { options[key] = definition.options[key]; });
    options.pane = paneName;
    options.updateWhenIdle = true;
    options.updateWhenZooming = false;
    options.keepBuffer = 2;
    options.className = 'ga-efb-map-tile ga-efb-map-tile-' + String(definition.id || 'layer');
    if (definition.kind === 'wms' && L.tileLayer.wms) return L.tileLayer.wms(definition.url, options);
    return L.tileLayer(definition.localUrl || definition.url, options);
  }

  function createStablePane(name, zIndex) {
    var pane = map.createPane(name);
    pane.style.zIndex = String(zIndex);
    pane.style.pointerEvents = 'none';
    return pane;
  }

  function updateBaseOpacity() {
    var opacity = API.baseLayerOpacity(preferences);
    Object.keys(baseLayers).forEach(function (id) {
      if (map && map.hasLayer(baseLayers[id])) baseLayers[id].setOpacity(opacity);
    });
  }

  function initializeMap() {
    if (!L || !API || map) return;
    map = L.map('map', {
      center: [API.DEFAULT_CENTER.lat, API.DEFAULT_CENTER.lon],
      zoom: API.DEFAULT_CENTER.zoom,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false
    });

    createStablePane('gaBasePane', 200);
    createStablePane('gaAeroPane', 250);
    createStablePane('gaRoutePane', 430);
    createStablePane('gaGeometryPane', 440);
    createStablePane('gaPreviewPane', 445);
    createStablePane('gaDrawingPane', 450);
    createStablePane('gaAircraftPane', 500);

    var baseControl = {};
    var overlayControl = {};
    API.BASE_LAYERS.forEach(function (definition) {
      var layer = createTileLayer(definition, 'gaBasePane');
      baseLayers[definition.id] = layer;
      baseControl[definition.label] = layer;
    });
    API.OVERLAY_LAYERS.forEach(function (definition) {
      var layer = createTileLayer(definition, 'gaAeroPane');
      overlayLayers[definition.id] = layer;
      overlayControl[definition.label] = layer;
    });
    (baseLayers[preferences.baseLayer] || baseLayers.topo).addTo(map);
    preferences.overlays.forEach(function (id) { if (overlayLayers[id]) overlayLayers[id].addTo(map); });
    updateBaseOpacity();
    layerControl = L.control.layers(baseControl, overlayControl, { collapsed: true, position: 'topright' }).addTo(map);
    routeLayer = L.layerGroup().addTo(map);
    geometryLayer = L.layerGroup().addTo(map);
    previewLayer = L.layerGroup().addTo(map);
    drawingLayer = L.layerGroup().addTo(map);
    measureLayer = L.layerGroup().addTo(map);
    map.on('baselayerchange', function (event) {
      Object.keys(baseLayers).some(function (id) {
        if (baseLayers[id] !== event.layer) return false;
        preferences.baseLayer = id;
        return true;
      });
      updateBaseOpacity();
      savePreferences();
    });
    map.on('overlayadd overlayremove', function () {
      preferences.overlays = Object.keys(overlayLayers).filter(function (id) { return map.hasLayer(overlayLayers[id]); });
      updateBaseOpacity();
      savePreferences();
    });
    map.on('dragstart', function () { if (preferences.follow) setFollow(false); });
    map.on('click', handleMapClick);
    bindMapDrawingInput();
    window.addEventListener('resize', function () {
      map.invalidateSize(false);
      renderProfile();
    });
    buildCompass();
    window.setTimeout(function () { map.invalidateSize(false); }, 60);
  }

  function setFollow(value) {
    preferences.follow = !!value;
    savePreferences();
    var button = byId('autoFollowBtn');
    if (button) {
      button.classList.toggle('active', preferences.follow);
      button.textContent = preferences.follow ? 'FOLLOW ON' : 'FOLLOW';
    }
    if (preferences.follow && flight && map) map.panTo([flight.lat, flight.lon], { animate: false });
  }

  function planeIcon(heading) {
    return L.divIcon({
      className: 'ga-efb-plane-icon',
      html: '<img alt="" src="/efb/v1/assets/aircraft-marker.svg" style="transform:rotate(' + Math.round(heading) + 'deg)">',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
  }

  function renderFlight(payload) {
    var normalized = API.normalizeFlightSnapshot(payload);
    if (!normalized) return;
    var previous = flight;
    flight = normalized;
    if (!planeMarker) {
      planeMarker = L.marker([flight.lat, flight.lon], { icon: planeIcon(flight.headingDeg), pane: 'gaAircraftPane', zIndexOffset: 2000 }).addTo(map);
      planeHeading = flight.headingDeg;
    } else {
      var moved = !previous || map.distance([previous.lat, previous.lon], [flight.lat, flight.lon]) >= 0.5;
      if (moved) planeMarker.setLatLng([flight.lat, flight.lon]);
      var headingDelta = planeHeading == null ? 360 : Math.abs(((flight.headingDeg - planeHeading + 540) % 360) - 180);
      if (headingDelta >= 1) {
        planeMarker.setIcon(planeIcon(flight.headingDeg));
        planeHeading = flight.headingDeg;
      }
    }
    if (preferences.follow) {
      if (!firstFlightCenter || map.getZoom() < 8) {
        map.setView([flight.lat, flight.lon], 10, { animate: false });
        firstFlightCenter = true;
      } else if (map.distance(map.getCenter(), [flight.lat, flight.lon]) >= 5) {
        map.panTo([flight.lat, flight.lon], { animate: false });
      }
    }
    setText('teleGS', flight.gsKts);
    setText('teleVS', '--');
    setText('teleAGL', flight.altFt);
    setText('currentPosRef', flight.lat.toFixed(4) + ', ' + flight.lon.toFixed(4) + ' | ' + flight.altFt + ' ft');
    var telemetry = byId('liveTelemetryBox');
    var current = byId('liveCurrentBox');
    setInfoBoxAvailability('liveTelemetryBox', !!telemetry);
    setInfoBoxAvailability('liveCurrentBox', !!current);
    updateCompass();
    renderProgress();
    renderProfile();
  }

  function markerIcon(index) {
    return L.divIcon({ className: 'ga-route-waypoint', html: String(index + 1), iconSize: [18, 18], iconAnchor: [9, 9] });
  }

  function targetIcon() {
    return L.divIcon({ className: 'ga-mission-target', html: 'T', iconSize: [22, 22], iconAnchor: [11, 11] });
  }

  function renderRoute(snapshot) {
    routeLayer.clearLayers();
    geometryLayer.clearLayers();
    if (previewLayer) previewLayer.clearLayers();
    previewLine = null;
    var waypoints = snapshot.route.waypoints;
    var latlngs = waypoints.map(function (point) { return [point.lat, point.lon]; });
    L.polyline(latlngs, { color: '#ff4444', opacity: 1, weight: 7, dashArray: '10,10', pane: 'gaRoutePane' }).addTo(routeLayer);
    waypoints.forEach(function (point, index) {
      var marker = L.marker([point.lat, point.lon], { icon: markerIcon(index), pane: 'gaRoutePane' }).addTo(routeLayer);
      marker.bindTooltip(point.name || ('WP ' + (index + 1)), { direction: 'top', offset: [0, -8], className: 'ga-route-label' });
    });
    var target = snapshot.missionGeometry && snapshot.missionGeometry.target;
    if (target) L.marker([target.lat, target.lon], { icon: targetIcon(), pane: 'gaGeometryPane' }).bindTooltip(target.name || 'Missionsziel').addTo(geometryLayer);
    var chain = snapshot.missionGeometry && snapshot.missionGeometry.poiChain || [];
    if (chain.length > 1) L.polyline(chain.map(function (point) { return [point.lat, point.lon]; }), { color: '#f2c12e', weight: 3, dashArray: '4,6', pane: 'gaGeometryPane' }).addTo(geometryLayer);
    if (!firstRouteFit && latlngs.length > 1 && !flight) {
      map.fitBounds(L.latLngBounds(latlngs), { padding: [35, 35] });
      firstRouteFit = true;
    }
  }

  function mapRouteSignature(snapshot) {
    var parts = [String(snapshot.missionId || '')];
    (snapshot.route && snapshot.route.waypoints || []).forEach(function (point) {
      parts.push(['w', point.id || point.name || '', point.lat, point.lon].join(':'));
    });
    var target = snapshot.missionGeometry && snapshot.missionGeometry.target;
    if (target) parts.push(['t', target.id || target.name || '', target.lat, target.lon].join(':'));
    (snapshot.missionGeometry && snapshot.missionGeometry.poiChain || []).forEach(function (point) {
      parts.push(['c', point.id || point.name || '', point.lat, point.lon].join(':'));
    });
    return parts.join('|');
  }

  function renderMapPayload(payload) {
    if (!payload || payload.available !== true) return;
    var normalized = API.normalizeTrackerMapSnapshot(payload);
    if (!normalized) return;
    var nextRouteSignature = mapRouteSignature(normalized);
    if (!mapSnapshot || nextRouteSignature !== routeSignature) {
      previewWaypointIndex = null;
      mapSnapshot = normalized;
      mapRevision = normalized.revision;
      routeSignature = nextRouteSignature;
      renderRoute(normalized);
    } else {
      mapSnapshot = normalized;
      mapRevision = normalized.revision;
    }
    renderProgress();
    updateCompass();
    renderProfile();
    var profile = normalized.profile;
    var profileDiagnostic = profile
      ? [profile.mode || 'unknown', profile.terrainAvailable ? 'terrain' : 'no-terrain', profile.points ? profile.points.length : 0].join(':')
      : 'missing';
    if (profileDiagnostic !== lastProfileDiagnostic) {
      lastProfileDiagnostic = profileDiagnostic;
      report(profile && profile.terrainAvailable ? 'info' : 'warn', 'map-profile', profile ? profile.mode || 'unknown' : 'missing',
        profile && profile.terrainAvailable ? 'Terrainprofil vom Tracker aktiv' : 'Trackerprofil enthaelt noch keine Terraindaten',
        profile ? 'points=' + (profile.points ? profile.points.length : 0) : '');
    }
  }

  function renderMissionPayload(payload) {
    var next = payload && payload.available === true ? payload : null;
    var signature = next ? [next.missionId || '', next.runId || '', next.revision || '', next.state || '', next.phase || next.runtimePhase || '', next.sceneCount || 0].join('|') : 'none';
    if (signature === missionSignature) return;
    missionSignature = signature;
    missionSnapshot = next;
    var button = document.querySelector('.ga-efb-host-mission');
    if (button) button.textContent = next && next.missionId ? 'Mission: ' + String(next.phase || next.state || 'aktiv').slice(0, 14) : 'Mission';
    var drawer = byId('mapSideDrawer');
    if (drawer && drawer.classList.contains('is-open') && drawerView === 'mission') renderSideDrawer();
    report('info', 'mission-panel', next ? 'active' : 'empty', next ? 'Missionsstatus vom Tracker aktualisiert' : 'Keine aktive Tracker-Mission', next ? String(next.missionId || '') : '');
  }

  function automaticWaypointIndex() {
    var navigation = mapSnapshot && mapSnapshot.navigation;
    var route = mapSnapshot && mapSnapshot.route;
    if (!navigation || !route || !route.waypoints || !route.waypoints.length) return 0;
    return clamp(Math.round(Number(navigation.activeLegIndex) || 0) + 1, 0, route.waypoints.length - 1);
  }

  function selectedWaypointNavigation() {
    var route = mapSnapshot && mapSnapshot.route;
    var navigation = mapSnapshot && mapSnapshot.navigation;
    var waypoints = route && route.waypoints || [];
    if (!navigation || !waypoints.length) return null;
    var automaticIndex = automaticWaypointIndex();
    var selectedIndex = previewWaypointIndex == null ? automaticIndex : clamp(previewWaypointIndex, 0, waypoints.length - 1);
    var waypoint = waypoints[selectedIndex];
    var position = flight ? { lat: flight.lat, lon: flight.lon } : null;
    var distance = position ? distanceNmBetween(position, waypoint) : null;
    var bearing = position ? bearingBetween(position, waypoint) : null;
    if (selectedIndex === automaticIndex) {
      if (distance == null) distance = navigation.distanceToNextNm;
      if (bearing == null) bearing = navigation.bearingToNextDeg;
    }
    return {
      automaticIndex: automaticIndex,
      selectedIndex: selectedIndex,
      waypoint: waypoint,
      distanceNm: distance == null ? 0 : distance,
      bearingDeg: bearing == null ? 0 : bearing,
      manual: previewWaypointIndex != null
    };
  }

  function renderPreviewLine(selected) {
    if (!previewLayer) return;
    if (!selected || !selected.manual || !flight) {
      if (previewLine) previewLayer.removeLayer(previewLine);
      previewLine = null;
      return;
    }
    var points = [
      [flight.lat, flight.lon],
      [selected.waypoint.lat, selected.waypoint.lon]
    ];
    if (!previewLine) {
      previewLine = L.polyline(points, {
        color: '#44d9ff',
        opacity: 0.9,
        weight: 3,
        dashArray: '6,7',
        pane: 'gaPreviewPane'
      }).addTo(previewLayer);
    } else {
      previewLine.setLatLngs(points);
    }
  }

  function renderProgress() {
    var navigation = mapSnapshot && mapSnapshot.navigation;
    var route = mapSnapshot && mapSnapshot.route;
    var bar = byId('routeProgressBar');
    var next = byId('liveNextWpBox');
    if (!navigation || !route) {
      if (bar) bar.style.display = 'none';
      setInfoBoxAvailability('liveNextWpBox', false);
      if (previewLine && previewLayer) previewLayer.removeLayer(previewLine);
      previewLine = null;
      return;
    }
    var selected = selectedWaypointNavigation();
    if (bar) bar.style.display = 'flex';
    setInfoBoxAvailability('liveNextWpBox', !!next);
    var distance = routeProgressTarget === 'route' ? navigation.remainingDistanceNm : selected.distanceNm;
    var gs = flight ? flight.gsKts : 0;
    setText('routeProgressPos', formatNumber(navigation.routeDistanceNm, 1) + ' NM');
    setText('routeProgressDst', formatNumber(distance, 1) + ' NM');
    setText('routeProgressEta', etaText(distance, gs));
    setText('routeProgressDur', durationText(distance, gs));
    setText('routeProgressFreq', '--');
    Array.prototype.forEach.call(document.querySelectorAll('.route-progress-target'), function (node) {
      node.textContent = routeProgressTarget === 'route' ? 'RTE' : 'WPT';
    });
    setText('nextWpName', selected.waypoint.name || selected.waypoint.id || 'NEXT');
    setText('nextWpCourse', leftPad(Math.round(selected.bearingDeg || 0), 3) + ' deg');
    setText('nextWpDist', formatNumber(selected.distanceNm, 1));
    var previousButton = byId('nextLegPrevBtn');
    var nextButton = byId('nextLegNextBtn');
    if (previousButton) previousButton.disabled = selected.selectedIndex <= 0;
    if (nextButton) nextButton.disabled = selected.selectedIndex >= route.waypoints.length - 1;
    renderPreviewLine(selected);
  }

  function createSvg(name, attributes) {
    var node = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.keys(attributes || {}).forEach(function (key) { node.setAttribute(key, String(attributes[key])); });
    return node;
  }

  function buildCompass() {
    var svg = byId('compassSvg');
    if (!svg) return;
    svg.innerHTML = '';
    svg.appendChild(createSvg('circle', { cx: 150, cy: 150, r: 146, fill: 'rgba(5,18,28,.94)', stroke: '#8aa3b2', 'stroke-width': 3 }));
    for (var degree = 0; degree < 360; degree += 5) {
      var major = degree % 30 === 0;
      var tick = createSvg('line', { x1: 150, y1: 8, x2: 150, y2: major ? 28 : degree % 10 === 0 ? 22 : 17, stroke: major ? '#fff' : '#9eb1bd', 'stroke-width': major ? 3 : 1.5, transform: 'rotate(' + degree + ' 150 150)' });
      svg.appendChild(tick);
      if (major) {
        var label = createSvg('text', { x: 150, y: 44, fill: '#fff', 'font-size': 18, 'font-weight': 700, 'text-anchor': 'middle', transform: 'rotate(' + degree + ' 150 150)' });
        var cardinal = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[degree];
        label.textContent = cardinal || leftPad(degree / 10, 2);
        svg.appendChild(label);
      }
    }
    var cdi = byId('compassCdiSvg');
    if (cdi) {
      cdi.innerHTML = '';
      cdi.appendChild(createSvg('line', { x1: -48, y1: 6, x2: 48, y2: 6, stroke: '#c3d2da', 'stroke-width': 2 }));
      [-36, -18, 0, 18, 36].forEach(function (x) { cdi.appendChild(createSvg('circle', { cx: x, cy: 6, r: 2.5, fill: '#8aa3b2' })); });
      cdi.appendChild(createSvg('line', { id: 'gaCompassCdiNeedle', x1: 0, y1: -8, x2: 0, y2: 22, stroke: '#ff3d3d', 'stroke-width': 4 }));
    }
    var wrap = byId('compassRoseWrap');
    if (wrap) { wrap.style.display = 'block'; wrap.addEventListener('click', function () { wrap.classList.toggle('compass-minimized'); }); }
  }

  function updateCompass() {
    var heading = flight ? flight.headingDeg : 0;
    var disc = byId('compassDisc');
    if (disc) disc.style.transform = 'rotate(' + (-heading) + 'deg)';
    var needle = byId('gaCompassCdiNeedle');
    var xte = mapSnapshot && mapSnapshot.navigation ? mapSnapshot.navigation.crossTrackNm : 0;
    if (needle) needle.setAttribute('transform', 'translate(' + clamp(xte / 2 * 36, -42, 42) + ' 0)');
  }

  function ensureProfileEmpty(text) {
    var strip = byId('mapProfileStrip');
    if (!strip) return;
    var node = strip.querySelector('.ga-profile-empty');
    if (!node) { node = document.createElement('div'); node.className = 'ga-profile-empty'; strip.appendChild(node); }
    node.textContent = text || '';
    node.style.display = text ? 'flex' : 'none';
  }

  function prepareCanvas(canvas, width, height) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    var context = canvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return context;
  }

  function renderProfile() {
    var wrapper = byId('vpCanvasWrapper');
    var background = byId('mapProfileCanvasBg');
    var foreground = byId('mapProfileCanvas');
    if (!wrapper || !background || !foreground || document.body.classList.contains('profile-hidden')) return;
    var width = Math.max(280, wrapper.clientWidth || 0);
    var height = Math.max(68, wrapper.clientHeight || 0);
    var bg = prepareCanvas(background, width, height);
    var fg = prepareCanvas(foreground, width, height);
    bg.clearRect(0, 0, width, height);
    fg.clearRect(0, 0, width, height);
    bg.fillStyle = 'rgba(4,17,27,.96)';
    bg.fillRect(0, 0, width, height);
    var profile = mapSnapshot && mapSnapshot.profile;
    if (!profile || !profile.points || profile.points.length < 2) {
      ensureProfileEmpty('Planprofil noch nicht vom Tracker empfangen');
      return;
    }
    ensureProfileEmpty('');
    var points = profile.points;
    var maxDistance = Math.max(1, finite(profile.totalDistanceNm) || finite(points[points.length - 1].distanceNm) || 1);
    var maxAlt = Math.max(profile.cruiseAltitudeFt || 0, flight ? flight.altFt : 0, 1000);
    points.forEach(function (point) { maxAlt = Math.max(maxAlt, point.plannedAltFt || 0, point.terrainFt || 0); });
    maxAlt = profileYAxis > 0 ? profileYAxis : Math.ceil((maxAlt + 800) / 1000) * 1000;
    var left = 32, right = 8, top = 7, bottom = 17;
    var plotWidth = width - left - right, plotHeight = height - top - bottom;
    function x(distance) { return left + clamp(distance / maxDistance, 0, 1) * plotWidth; }
    function y(altitude) { return top + plotHeight - clamp(altitude / maxAlt, 0, 1) * plotHeight; }
    bg.strokeStyle = 'rgba(122,157,176,.22)';
    bg.fillStyle = '#8aa1ad';
    bg.font = '9px monospace';
    bg.textAlign = 'right';
    for (var row = 0; row <= 4; row += 1) {
      var altitude = maxAlt * row / 4;
      var rowY = y(altitude);
      bg.beginPath(); bg.moveTo(left, rowY); bg.lineTo(width - right, rowY); bg.stroke();
      bg.fillText(Math.round(altitude / 1000) + 'k', left - 4, rowY + 3);
    }
    if (profile.terrainAvailable) {
      fg.beginPath(); fg.moveTo(x(points[0].distanceNm), y(0));
      points.forEach(function (point) { fg.lineTo(x(point.distanceNm), y(point.terrainFt || 0)); });
      fg.lineTo(x(points[points.length - 1].distanceNm), y(0)); fg.closePath();
      fg.fillStyle = 'rgba(62,112,54,.9)'; fg.fill();
    }
    fg.beginPath();
    points.forEach(function (point, index) { if (index === 0) fg.moveTo(x(point.distanceNm), y(point.plannedAltFt)); else fg.lineTo(x(point.distanceNm), y(point.plannedAltFt)); });
    fg.strokeStyle = '#ff4a4a'; fg.lineWidth = 2.5; fg.stroke();
    fg.fillStyle = '#b8cbd5'; fg.font = '8px Arial'; fg.textAlign = 'center';
    points.forEach(function (point) { fg.fillText(String(point.name || '').slice(0, 8), x(point.distanceNm), height - 4); });
    var position = mapSnapshot && mapSnapshot.navigation ? mapSnapshot.navigation.routeDistanceNm : 0;
    if (flight) {
      fg.fillStyle = '#f2dc32';
      fg.beginPath(); fg.moveTo(x(position), y(flight.altFt) - 5); fg.lineTo(x(position) - 6, y(flight.altFt) + 5); fg.lineTo(x(position) + 6, y(flight.altFt) + 5); fg.closePath(); fg.fill();
    }
    setText('altMapInput', Math.round(profile.cruiseAltitudeFt || 0));
    setText('yAxisDisplay', profileYAxis > 0 ? profileYAxis : 'AUTO');
    setText('vpZoomDisplay', profileZoom + '%');
  }

  function setDrawMode(mode) {
    drawMode = mode;
    ['mapToolPen', 'mapToolMeasure'].forEach(function (id) { var button = byId(id); if (button) button.classList.remove('active'); });
    if (mode === 'pen') byId('mapToolPen').classList.add('active');
    if (mode === 'measure') byId('mapToolMeasure').classList.add('active');
    document.body.classList.toggle('map-drawing-active', mode === 'pen' || mode === 'measure');
    if (map) {
      map.getContainer().style.cursor = mode ? 'crosshair' : '';
      if (map.dragging) {
        if (mode === 'pen') map.dragging.disable();
        else map.dragging.enable();
      }
    }
    drawPoints = [];
    drawLine = null;
    drawStrokeActive = false;
    drawLastContainerPoint = null;
    report('info', 'draw-action', mode ? 'mode-' + mode : 'mode-off', mode ? 'Zeichenmodus aktiv' : 'Zeichenmodus beendet');
  }

  function handleMapClick(event) {
    if (drawMode !== 'measure') return;
    drawPoints.push(event.latlng);
    var group = measureLayer;
    if (drawLine) group.removeLayer(drawLine);
    drawLine = L.polyline(drawPoints, { color: '#f2c12e', weight: 3, dashArray: '5,5', pane: 'gaDrawingPane' }).addTo(group);
    if (drawPoints.length === 1) drawHistory.push({ layer: drawLine, group: group });
    else if (drawHistory.length) drawHistory[drawHistory.length - 1].layer = drawLine;
    if (drawPoints.length > 1) {
      var metres = 0;
      for (var index = 1; index < drawPoints.length; index += 1) metres += map.distance(drawPoints[index - 1], drawPoints[index]);
      drawLine.bindTooltip((metres / 1852).toFixed(2) + ' NM', { permanent: true, direction: 'center', className: 'ga-route-label' }).openTooltip();
    }
    report('info', 'draw-action', 'measure-point', 'Messpunkt gesetzt', String(drawPoints.length));
  }

  function drawEventPoint(event) {
    var source = event && event.touches && event.touches.length ? event.touches[0] : event;
    if (!source || !map) return null;
    try {
      var container = map.getContainer();
      var rect = container && container.getBoundingClientRect ? container.getBoundingClientRect() : null;
      if (!container || !rect || !(rect.width > 0) || !(rect.height > 0)) return null;
      // Coherent may render the EFB document at a scaled CSS size. Leaflet's
      // mouseEvent helper assumes a 1:1 viewport and therefore produces the
      // visible horizontal offset reported in MSFS. Convert through the actual
      // rendered rectangle before asking Leaflet for the geographic position.
      var renderedX = Number(source.clientX) - rect.left;
      var renderedY = Number(source.clientY) - rect.top;
      var localX = renderedX * (container.clientWidth || rect.width) / rect.width;
      var localY = renderedY * (container.clientHeight || rect.height) / rect.height;
      var containerPoint = L.point(localX, localY);
      return {
        latlng: map.containerPointToLatLng(containerPoint),
        container: containerPoint
      };
    } catch (_) { return null; }
  }

  function isMapDrawingSurface(event) {
    var target = event && event.target;
    if (!target || !target.closest) return true;
    return !target.closest('.leaflet-control, .map-draw-rail, .map-draw-menu, button, input, select');
  }

  function beginPenStroke(event) {
    if (drawMode !== 'pen' || !isMapDrawingSurface(event)) return;
    if (event.button != null && event.button !== 0) return;
    var point = drawEventPoint(event);
    if (!point) return;
    if (event.preventDefault) event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();
    drawPoints = [point.latlng];
    drawLastContainerPoint = point.container;
    drawLine = L.polyline(drawPoints, { color: drawColor, weight: drawWeight, lineCap: 'round', lineJoin: 'round', pane: 'gaDrawingPane' }).addTo(drawingLayer);
    drawHistory.push({ layer: drawLine, group: drawingLayer });
    drawStrokeActive = true;
    try { if (event.pointerId != null && event.target.setPointerCapture) event.target.setPointerCapture(event.pointerId); } catch (_) {}
    report('info', 'draw-action', 'pen-start', 'Freihandlinie begonnen');
  }

  function movePenStroke(event) {
    if (!drawStrokeActive || drawMode !== 'pen') return;
    var point = drawEventPoint(event);
    if (!point) return;
    if (drawLastContainerPoint && point.container.distanceTo && point.container.distanceTo(drawLastContainerPoint) < 2) return;
    if (event.preventDefault) event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();
    drawPoints.push(point.latlng);
    drawLastContainerPoint = point.container;
    drawLine.setLatLngs(drawPoints);
  }

  function endPenStroke(event) {
    if (!drawStrokeActive) return;
    if (event && event.preventDefault) event.preventDefault();
    if (event && event.stopPropagation) event.stopPropagation();
    try { if (event && event.pointerId != null && event.target.releasePointerCapture) event.target.releasePointerCapture(event.pointerId); } catch (_) {}
    report('info', 'draw-action', 'pen-end', 'Freihandlinie abgeschlossen', String(drawPoints.length));
    drawStrokeActive = false;
    drawPoints = [];
    drawLine = null;
    drawLastContainerPoint = null;
  }

  function bindMapDrawingInput() {
    if (!map) return;
    var container = map.getContainer();
    if (!container || container.getAttribute('data-ga-draw-bound') === '1') return;
    container.setAttribute('data-ga-draw-bound', '1');
    if (window.PointerEvent) {
      container.addEventListener('pointerdown', beginPenStroke, false);
      container.addEventListener('pointermove', movePenStroke, false);
      container.addEventListener('pointerup', endPenStroke, false);
      container.addEventListener('pointercancel', endPenStroke, false);
    } else {
      container.addEventListener('mousedown', beginPenStroke, false);
      window.addEventListener('mousemove', movePenStroke, false);
      window.addEventListener('mouseup', endPenStroke, false);
      container.addEventListener('touchstart', beginPenStroke, false);
      container.addEventListener('touchmove', movePenStroke, false);
      container.addEventListener('touchend', endPenStroke, false);
    }
  }

  function clearDrawings() {
    drawingLayer.clearLayers();
    measureLayer.clearLayers();
    drawHistory = [];
    setDrawMode('');
    report('info', 'draw-action', 'clear-all', 'Zeichnungen und Messungen geloescht');
  }

  function eraseLastDrawing() {
    var entry = drawHistory.pop();
    if (entry && entry.group && entry.layer) {
      entry.group.removeLayer(entry.layer);
      if (entry.layer === drawLine) {
        drawLine = null;
        drawPoints = [];
      }
    }
    report('info', 'draw-action', 'erase-last', entry ? 'Letzte Zeichnung geloescht' : 'Keine Zeichnung zum Loeschen');
  }

  function fetchJson(url) {
    return fetch(url, { cache: 'no-store' }).then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    });
  }

  function poll() {
    Promise.all([
      fetchJson('/api/v1/status'),
      fetchJson('/api/v1/snapshot'),
      fetchJson('/api/v1/map'),
      fetchJson('/api/v1/mission')
    ]).then(function (responses) {
      trackerOnline = true;
      var status = safePayload(responses[0]);
      setTrackerState(status && status.simulatorConnected ? 'Tracker + Simulator verbunden' : 'Tracker verbunden | warte auf Simulator', false);
      renderFlight(safePayload(responses[1]));
      renderMapPayload(safePayload(responses[2]));
      renderMissionPayload(safePayload(responses[3]));
      notifyParentState('live');
      pollTimer = window.setTimeout(poll, 1000);
    }).catch(function () {
      trackerOnline = false;
      setTrackerState('Tracker nicht erreichbar', true);
      notifyParentState('error');
      report('warn', 'poll', 'tracker-unreachable', 'Snapshot-Polling fehlgeschlagen');
      pollTimer = window.setTimeout(poll, 1800);
    });
  }

  function syncProfileButton() {
    var button = byId('vpToggleBtn');
    if (button) button.textContent = preferences.profileVisible ? 'Profil (An)' : 'Profil (Aus)';
  }

  window.toggleMapToolbar = function () {
    preferences.toolbarCollapsed = !preferences.toolbarCollapsed;
    document.body.classList.toggle('toolbar-collapsed', preferences.toolbarCollapsed);
    setText('mapToolbarToggle', preferences.toolbarCollapsed ? 'v' : '^');
    savePreferences();
    window.setTimeout(function () { if (map) map.invalidateSize(false); }, 310);
  };
  window.toggleMapProfile = function () {
    preferences.profileVisible = !preferences.profileVisible;
    document.body.classList.toggle('profile-hidden', !preferences.profileVisible);
    syncProfileButton();
    savePreferences();
    window.setTimeout(function () { if (map) map.invalidateSize(false); renderProfile(); }, 30);
  };
  window.showSettingsHelp = function (topic, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    var normalized = String(topic || '').toLowerCase();
    var text = normalized.indexOf('drawer') >= 0
      ? 'Mission und Checklisten kommen im EFB direkt vom Tracker. Änderungen erfolgen weiterhin in der verbundenen App.'
      : 'Der EFB-Kartentisch zeigt Route, Flugzeugposition und Tracker-Status. Layer und Anzeigen lassen sich über die obere Leiste umschalten.';
    var status = byId('checklistDrawerStatus');
    if (status) status.textContent = text;
    report('info', 'help', normalized || 'map', text);
    return false;
  };
  window.toggleAutoFollow = function () { setFollow(!preferences.follow); };
  window.toggleMapToolRail = function (event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    var stack = byId('mapDrawToolStack');
    if (stack) stack.classList.toggle('open');
    var button = byId('mapDrawFloatingBtn');
    if (button) button.classList.toggle('active', stack && stack.classList.contains('open'));
    report('info', 'tool-action', stack && stack.classList.contains('open') ? 'rail-open' : 'rail-close', 'Kartenwerkzeugleiste umgeschaltet');
  };
  window.activateMapDrawTool = function (tool, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    if (tool === 'stopwatch' || tool === 'calculator' || tool === 'e6b') {
      report('info', 'tool-action', 'open-' + tool, 'Kartenwerkzeug angefordert');
      if (window.openMapUtilityTool) window.openMapUtilityTool(tool);
      return;
    }
    if (tool === 'drawClear') {
      clearDrawings();
      return;
    }
    if (tool === 'eraser') {
      eraseLastDrawing();
      return;
    }
    setDrawMode(drawMode === tool ? '' : tool);
  };
  window.toggleMapDrawSettingsMenu = function () {
    var menu = byId('mapDrawMenu');
    if (!menu) return;
    menu.classList.toggle('open');
    report('info', 'draw-action', menu.classList.contains('open') ? 'settings-open' : 'settings-close', 'Stift-Einstellungen umgeschaltet');
  };
  window.setMapDrawColor = function (value) {
    drawColor = String(value || '#ff3b30');
    report('info', 'draw-action', 'color', 'Stiftfarbe geaendert');
  };
  window.setMapDrawWeight = function (value) {
    drawWeight = clamp(Number(value) || 5, 2, 18);
    report('info', 'draw-action', 'weight', 'Stiftbreite geaendert', String(drawWeight));
  };
  window.toggleRouteProgressTarget = function () { routeProgressTarget = routeProgressTarget === 'wpt' ? 'route' : 'wpt'; renderProgress(); };
  window.stepLiveNextLegPreview = function (delta, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    var route = mapSnapshot && mapSnapshot.route;
    var waypoints = route && route.waypoints || [];
    if (!waypoints.length) return;
    var current = previewWaypointIndex == null ? automaticWaypointIndex() : previewWaypointIndex;
    previewWaypointIndex = clamp(current + Number(delta || 0), 0, waypoints.length - 1);
    renderProgress();
    report('info', 'waypoint-preview', 'select', 'Wegpunktvorschau umgeschaltet', String(previewWaypointIndex));
  };
  window.vpZoom = function (delta) { profileZoom = clamp(profileZoom + Number(delta || 0), 0, 90); renderProfile(); };
  window.vpChangeYAxis = function (delta) { profileYAxis = Math.max(1000, (profileYAxis || 6000) + Number(delta || 0)); renderProfile(); };
  window.vpResetYAxis = function () { profileYAxis = 0; renderProfile(); };
  window.vpChangeAlt = function () {};
  window.vpChangeRate = function () {};
  window.promptForAlt = function () {};
  window.promptForRate = function () {};
  window.resetMainRoute = function () {};
  window.minimizeWin95OverlayWindow = function () {};
  window.closeWin95OverlayWindow = function () { return closeHost('window-close'); };
  window.toggleMapTable = function () { return closeHost('toggle-map-table'); };

  function init() {
    boot('host-init', 'Kartentisch wird initialisiert', false);
    try {
      if (!API || !L) {
        setTrackerState('Kartentisch-Module fehlen', true);
        boot('host-missing-modules', 'Kartentisch-Module fehlen', true);
        notifyParentState('error', { stage: 'host-missing-modules' });
        return;
      }
      configureOriginalChrome();
      boot('host-chrome', 'Kartentisch-Oberflaeche bereit', false);
      initializeMap();
      if (!map) throw new Error('Leaflet-Karte wurde nicht initialisiert.');
      setFollow(preferences.follow);
      var bootStatus = byId('gaEfbBootStatus');
      if (bootStatus) bootStatus.style.display = 'none';
      report('info', 'boot', 'host-ready', 'Kartentisch und Karte bereit');
      notifyParentState('ready', { stage: 'host-ready' });
      poll();
    } catch (error) {
      var message = error && error.message || String(error);
      setTrackerState('Kartentisch konnte nicht starten', true);
      boot('host-init-error', message, true);
      report('error', 'host-init', 'exception', message, error && error.stack || '');
      notifyParentState('error', { stage: 'host-init-error', message: message });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.addEventListener('beforeunload', function () { if (pollTimer) window.clearTimeout(pollTimer); });
})();
