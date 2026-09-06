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
  // Semantically unchanged mission polls must not reset banner/toolbar/cargo
  // DOM. Coherent otherwise renders a visible blink and loses scroll/touch.
  var missionPresentationSignature = '';
  var mapRevision = 0;
  var routeSignature = '';
  var planeMarker = null;
  var planeHeading = null;
  var routeLayer = null;
  var geometryLayer = null;
  var previewLayer = null;
  var routeRenderer = null;
  var geometryRenderer = null;
  var previewLine = null;
  var drawingLayer = null;
  var drawingRenderer = null;
  var measureLayer = null;
  var baseLayers = {};
  var overlayLayers = {};
  var layerControl = null;
  var firstRouteFit = false;
  var firstFlightCenter = false;
  var pollTimer = 0;
  var missionPollTimer = 0;
  var trackerOnline = false;
  var profileZoom = 0;
  var profileYAxis = 0;
  var profileCruiseOverride = null;
  var profileVerticalRate = 500;
  var profileResizeActive = false;
  var contextPickActive = false;
  var mapContextPopup = null;
  var mapContextPointLayer = null;
  var mapContextRequestSeq = 0;
  var mapContextState = null;
  var mapContextPress = null;
  var mapContextSuppressClickUntil = 0;
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
  var tileHealthReported = {};
  var drawerView = 'mission';
  var drawerChecklistId = '';
  var trackerChecklistLibrary = { revision: 0, checklists: [] };
  var checklistLibrarySignature = '';
  var efbUiObserver = null;
  var efbUiRefreshTimer = 0;
  var drawerInteractionActive = false;
  var drawerInteractionTimer = 0;
  var drawerInputGeneration = 0;
  var drawerRefreshPending = false;
  var missionIntentPending = false;
  var missionIntentStatus = '';
  var missionIntentTone = '';
  var missionStoryExpanded = false;
  var missionBannerDismissedKey = '';
  var cargoManagerOpen = false;
  var cargoManagerSignature = '';
  var cargoSignatureAnimationEndsAt = 0;
  var cargoSignatureAnimationScope = '';
  var cargoSignatureAnimationTimer = 0;
  var EFB_CHECKLIST_PROGRESS_KEY = 'ga_efb_tracker_checklist_progress_v1';
  var EFB_PROFILE_HEIGHT_KEY = 'ga_efb_tracker_profile_height_v1';
  var EFB_OVERLAY_PANES = {
    aero: 'gaVfrPane',
    dfs: 'gaOfficialChartPane',
    faa: 'gaOfficialChartPane',
    dwd: 'gaWeatherPane'
  };
  var efbChecklistProgress = readEfbChecklistProgress();
  var EFB_BUILTIN_CHECKLISTS = [
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
    var source = {};
    var normalized;
    try { source = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}'); }
    catch (_) { source = {}; }
    normalized = API.normalizePreferences(source);
    normalized.theme = 'classic';
    normalized.fontScale = clamp(Number(source.fontScale) || 1.1, 0.9, 1.3);
    return normalized;
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
    var button = document.querySelector('.ga-efb-host-display-menu .ga-efb-host-menu-trigger');
    if (!button) return;
    var hidden = Object.keys(infoBoxState).filter(function (id) { return infoBoxState[id].hidden === true; }).length;
    button.firstChild.nodeValue = hidden ? 'Anzeige (' + hidden + ')' : 'Anzeige';
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

  function coherentText(value) {
    return String(value == null ? '' : value)
      .replace(/A\u0308/g, 'Ä')
      .replace(/O\u0308/g, 'Ö')
      .replace(/U\u0308/g, 'Ü')
      .replace(/a\u0308/g, 'ä')
      .replace(/o\u0308/g, 'ö')
      .replace(/u\u0308/g, 'ü')
      .replace(/\u00b7/g, ' | ')
      .replace(/[\u2013\u2014\u2212]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/\u00b0/g, ' deg')
      .replace(/\u2032/g, ' ft')
      .replace(/\u2194/g, ' <-> ')
      .replace(/\u2192/g, ' -> ')
      .replace(/\u2190/g, ' <- ')
      .replace(/[\u2022\u25cf]/g, ' - ')
      .replace(/[\u2713\u2714]/g, 'OK')
      .replace(/\u00d7/g, 'x')
      .replace(/\u00f7/g, '/')
      .replace(/[\u2191\u25b2]/g, '^')
      .replace(/[\u2193\u25bc]/g, 'v')
      .replace(/[\uFE0E\uFE0F\u200D]/g, '')
      .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
      .replace(/[\u2190-\u21FF\u2300-\u23FF\u25A0-\u27BF]/g, '');
  }

  function drawerEscape(value) {
    return coherentText(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function nodeInsideSvg(node) {
    var current = node && node.parentNode;
    while (current && current !== document.body) {
      if (String(current.nodeName || '').toLowerCase() === 'svg') return true;
      current = current.parentNode;
    }
    return false;
  }

  function normalizeCoherentGlyphs(root) {
    if (!root) return;
    var nodes = root.querySelectorAll ? root.querySelectorAll('*') : [];
    var elements = root.nodeType === 1 ? [root] : [];
    for (var index = 0; index < nodes.length; index += 1) elements.push(nodes[index]);
    elements.forEach(function (element) {
      var tag = String(element.nodeName || '').toUpperCase();
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG' || nodeInsideSvg(element)) return;
      for (var child = element.firstChild; child; child = child.nextSibling) {
        if (child.nodeType !== 3 || !child.nodeValue) continue;
        var normalized = coherentText(child.nodeValue);
        if (normalized !== child.nodeValue) child.nodeValue = normalized;
      }
    });
  }

  function fontScaleElements() {
    var all = document.body && document.body.querySelectorAll ? document.body.querySelectorAll('*') : [];
    var result = document.body ? [document.body] : [];
    for (var index = 0; index < all.length; index += 1) {
      var tag = String(all[index].nodeName || '').toUpperCase();
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'SVG' || nodeInsideSvg(all[index])) continue;
      result.push(all[index]);
    }
    return result;
  }

  function syncFontScaleControls() {
    var label = document.querySelector('.ga-efb-font-size-hint');
    if (label) label.textContent = 'Schriftgröße: ' + Math.round(preferences.fontScale * 100) + '%';
  }

  function applyEfbFontScale() {
    var nextScale = clamp(Number(preferences.fontScale) || 1.1, 0.9, 1.3);
    var elements = fontScaleElements();
    elements.forEach(function (element) {
      if (!element.hasAttribute('data-ga-efb-font-base')) return;
      var stored = Number(element.getAttribute('data-ga-efb-font-base'));
      if (isFiniteNumber(stored)) element.style.fontSize = stored + 'px';
    });
    elements.forEach(function (element) {
      if (element.hasAttribute('data-ga-efb-font-base')) return;
      var computed = parseFloat(window.getComputedStyle(element).fontSize);
      if (!isFiniteNumber(computed) || computed <= 0) return;
      element.setAttribute('data-ga-efb-font-base', String(Math.round(computed * 100) / 100));
    });
    elements.forEach(function (element) {
      if (!element.hasAttribute('data-ga-efb-font-base')) return;
      var base = Number(element.getAttribute('data-ga-efb-font-base'));
      if (isFiniteNumber(base)) element.style.fontSize = Math.round(base * nextScale * 10) / 10 + 'px';
    });
    document.body.setAttribute('data-ga-efb-font-scale', String(Math.round(nextScale * 100)));
    syncFontScaleControls();
  }

  function setEfbFontScale(value) {
    preferences.fontScale = clamp(Math.round((Number(value) || 1.1) * 10) / 10, 0.9, 1.3);
    savePreferences();
    applyEfbFontScale();
    report('info', 'font-scale', String(Math.round(preferences.fontScale * 100)), 'EFB-Schriftgroesse aktualisiert');
  }

  function scheduleEfbUiRefresh() {
    if (efbUiRefreshTimer) return;
    efbUiRefreshTimer = window.setTimeout(function () {
      efbUiRefreshTimer = 0;
      normalizeCoherentGlyphs(document.body);
      applyEfbFontScale();
    }, 40);
  }

  function setupEfbUiCompatibility() {
    normalizeCoherentGlyphs(document.body);
    applyEfbFontScale();
    if (typeof window.MutationObserver !== 'function' || efbUiObserver) return;
    efbUiObserver = new window.MutationObserver(function (mutations) {
      var hasTextContent = mutations.some(function (mutation) {
        for (var index = 0; index < mutation.addedNodes.length; index += 1) {
          var node = mutation.addedNodes[index];
          if (node.nodeType === 3 && String(node.nodeValue || '').trim()) return true;
          if (node.nodeType === 1 && String(node.textContent || '').trim()) return true;
        }
        return false;
      });
      if (hasTextContent) scheduleEfbUiRefresh();
    });
    efbUiObserver.observe(document.body, { childList: true, subtree: true });
  }

  function checklistItems(checklist) {
    var items = [];
    (checklist && checklist.sections || []).forEach(function (section, sectionIndex) {
      var sectionId = String(section.id || 'section-' + (sectionIndex + 1));
      (section.items || []).forEach(function (item, itemIndex) {
        var text = item && typeof item === 'object' ? item.text : item;
        var itemId = item && typeof item === 'object' ? item.id : 'item-' + (itemIndex + 1);
        items.push({
          key: checklist.id + ':' + sectionId + ':' + String(itemId || 'item-' + (itemIndex + 1)),
          text: text,
          section: section.title
        });
      });
    });
    return items;
  }

  function allEfbChecklists() {
    var custom = trackerChecklistLibrary && Array.isArray(trackerChecklistLibrary.checklists)
      ? trackerChecklistLibrary.checklists
      : [];
    return EFB_BUILTIN_CHECKLISTS.concat(custom);
  }

  function checklistDoneCount(checklist) {
    return checklistItems(checklist).filter(function (item) { return efbChecklistProgress[item.key] === true; }).length;
  }

  function missionStatusMarkup() {
    var mission = missionSnapshot && missionSnapshot.available !== false ? missionSnapshot : null;
    if (!mission || !mission.missionId) {
      return window.GAMissionControlUiCore && typeof window.GAMissionControlUiCore.renderEmpty === 'function'
        ? window.GAMissionControlUiCore.renderEmpty()
        : '<div class="ga-efb-drawer-empty"><strong>Keine aktive Mission</strong><span>Der Tracker meldet aktuell keine priorisierte Mission.</span></div>';
    }
    if (window.GAMissionControlUiCore && typeof window.GAMissionControlUiCore.render === 'function') {
      return window.GAMissionControlUiCore.render(mission.view && typeof mission.view === 'object' ? mission.view : mission, {
        storyExpanded: missionStoryExpanded,
        control: mission.control && typeof mission.control === 'object' ? mission.control : null,
        intentPending: missionIntentPending,
        intentStatus: missionIntentStatus,
        intentTone: missionIntentTone
      });
    }
    var view = mission.view && typeof mission.view === 'object' ? mission.view : mission;
    var target = view.target && typeof view.target === 'object' ? view.target : {};
    var live = view.flight && typeof view.flight === 'object' ? view.flight : {};
    var phase = view.phase && typeof view.phase === 'object' ? view.phase : {};
    var stages = Array.isArray(phase.stages) ? phase.stages : [];
    var phaseCurrent = Math.max(0, Math.min(stages.length - 1, Math.round(Number(phase.current) || 0)));
    var targetLine = target.distanceNm != null
      ? formatNumber(target.distanceNm, 1) + ' NM | ' + leftPad(Math.round(Number(target.bearingDeg) || 0), 3) + ' deg'
      : (live.trackerLive ? 'Zielposition offen' : 'Tracker wartet');
    var altitudeLine = live.mslFt != null ? Math.round(Number(live.mslFt) || 0) + ' ft MSL' : 'Keine Live-Höhe';
    var altitudeDetail = live.aglFt != null
      ? Math.round(Number(live.aglFt) || 0) + ' ft AGL'
      : (live.gsKts != null ? Math.round(Number(live.gsKts) || 0) + ' kt GS' : 'Live-Daten offen');
    var phaseHtml = stages.map(function (stage, index) {
      var label = stage && typeof stage === 'object' ? stage.label : stage;
      return '<div class="ga-efb-mission-phase' + (index < phaseCurrent ? ' is-done' : '') + (index === phaseCurrent ? ' is-current' : '') + '">'
        + '<span>' + (index < phaseCurrent ? 'OK' : String(index + 1)) + '</span><b>' + drawerEscape(label || 'Phase') + '</b></div>';
    }).join('');
    var progressHtml = (Array.isArray(view.progress) ? view.progress : []).map(function (row) {
      var pct = clamp(Math.round(Number(row.percent) || 0), 0, 100);
      return '<div class="ga-efb-mission-progress"><div><span>' + drawerEscape(row.label) + '</span><b>' + drawerEscape(row.detail) + '</b></div>'
        + '<i class="is-' + drawerEscape(row.tone || 'active') + '"><span style="width:' + pct + '%"></span></i></div>';
    }).join('');
    var requirementsHtml = (Array.isArray(view.requirements) ? view.requirements : []).map(function (row) {
      return '<div class="ga-efb-mission-requirement is-' + drawerEscape(row.tone || 'neutral') + '"><span>'
        + drawerEscape(row.label) + '</span><b>' + drawerEscape(row.detail) + '</b></div>';
    }).join('');
    var feedbackHtml = (Array.isArray(view.feedback) ? view.feedback : []).map(function (row) {
      return '<div class="ga-efb-mission-feedback is-' + drawerEscape(row.tone || 'info') + '"><span>'
        + (row.tone === 'danger' || row.tone === 'warn' ? '!' : (row.tone === 'good' ? 'OK' : 'i'))
        + '</span><p>' + drawerEscape(row.detail) + '</p></div>';
    }).join('');
    var comfort = view.comfort && typeof view.comfort === 'object' ? view.comfort : {};
    var cargo = view.cargo && typeof view.cargo === 'object' ? view.cargo : {};
    var voice = mission.voice && typeof mission.voice === 'object' ? mission.voice : {};
    var voiceSpeaker = voice.speaker && typeof voice.speaker === 'object' ? voice.speaker : {};
    var voiceHtml = voice.text
      ? '<section class="ga-efb-mission-section"><small>LETZTE ANSAGE</small><div class="ga-efb-mission-feedback-list"><div class="ga-efb-mission-feedback is-info"><span>i</span><p>'
        + (voiceSpeaker.name ? '<b>' + drawerEscape(voiceSpeaker.name) + ':</b> ' : '')
        + drawerEscape(voice.text) + '</p></div></div></section>'
      : '';
    var control = mission.control && typeof mission.control === 'object' ? mission.control : null;
    var allowedActions = control && Array.isArray(control.allowedActions) ? control.allowedActions : [];
    var canIntent = !!(control && control.executionAuthority === 'tracker');
    var actionLabels = {
      activate_cloud_mission: 'Mission aus der Cloud beginnen',
      prepare_mission: 'Mission vorbereiten',
      start_boarding: 'Boarding und Verladen beginnen',
      start_mission: 'Mission starten',
      request_close: 'Mission beenden'
    };
    var primaryActions = ['activate_cloud_mission', 'prepare_mission', 'start_boarding', 'start_mission', 'request_close'];
    var actionHtml = primaryActions.filter(function (intent) {
      return allowedActions.indexOf(intent) >= 0;
    }).map(function (intent) {
      return '<button type="button" data-efb-drawer-action="mission-intent" data-mission-intent="' + drawerEscape(intent) + '"'
        + (missionIntentPending ? ' disabled' : '') + '>' + drawerEscape(actionLabels[intent] || intent) + '</button>';
    }).join('');
    var abortHtml = allowedActions.indexOf('abort_mission') >= 0
      ? '<div class="ga-efb-mission-actions is-danger"><button type="button" data-efb-drawer-action="mission-intent" data-mission-intent="abort_mission"'
        + (missionIntentPending ? ' disabled' : '') + '>Mission abbrechen</button></div>'
      : '';
    var conditions = '<div class="ga-efb-mission-conditions">'
      + '<section class="is-' + drawerEscape(comfort.tone || 'muted') + '"><span>PAX-STIMMUNG</span><strong>'
      + (comfort.score == null ? '--' : drawerEscape(comfort.score) + '%') + '</strong><b>' + drawerEscape(comfort.state || 'Keine Wertung')
      + '</b><small>' + drawerEscape(comfort.detail || '') + '</small></section>'
      + '<section class="is-' + drawerEscape(cargo.tone || 'muted') + '"><span>LADUNGSZUSTAND</span><strong>'
      + (cargo.conditionPct == null ? '--' : drawerEscape(cargo.conditionPct) + '%') + '</strong><b>' + drawerEscape(cargo.state || 'Keine Ladung')
      + '</b><small>' + drawerEscape(cargo.detail || '') + '</small></section></div>';
    return '<div class="ga-efb-mission-control">'
      + '<section class="ga-efb-mission-hero is-' + drawerEscape(view.taskTone || 'active') + '">'
      + '<div><span class="ga-efb-mission-live"><i></i>' + (live.trackerLive ? 'LIVE' : 'TRACKER') + '</span><span>' + drawerEscape(view.status || mission.state || 'Mission aktiv') + '</span></div>'
      + '<h3>' + drawerEscape(view.title || mission.title || mission.missionId) + '</h3>'
      + (view.story ? '<p>' + drawerEscape(view.story) + '</p>' : '') + '</section>'
      + '<section class="ga-efb-mission-order is-' + drawerEscape(view.taskTone || 'active') + '"><small>AKTUELLER AUFTRAG</small><strong>'
      + drawerEscape(view.currentTask || 'Missionsstatus prüfen') + '</strong><span>' + drawerEscape(view.detail || '') + '</span></section>'
      + (phaseHtml ? '<section class="ga-efb-mission-section"><small>MISSIONSVERLAUF</small><div class="ga-efb-mission-phases">' + phaseHtml + '</div></section>' : '')
      + '<div class="ga-efb-mission-metrics"><section><span>ZIEL</span><b id="gaEfbMissionTargetLine">' + drawerEscape(targetLine) + '</b><small>' + drawerEscape(target.name || '') + '</small></section>'
      + '<section><span>FLUGHÖHE</span><b id="gaEfbMissionAltitude">' + drawerEscape(altitudeLine) + '</b><small id="gaEfbMissionAltitudeDetail">' + drawerEscape(altitudeDetail) + '</small></section></div>'
      + (progressHtml ? '<section class="ga-efb-mission-section"><small>LIVE-FORTSCHRITT</small>' + progressHtml + '</section>' : '')
      + (requirementsHtml ? '<section class="ga-efb-mission-section"><small>BEDINGUNGEN</small><div class="ga-efb-mission-requirements">' + requirementsHtml + '</div></section>' : '')
      + conditions
      + voiceHtml
      + (canIntent ? '<section class="ga-efb-mission-section"><small>BEDIENUNG</small>'
        + '<div class="ga-efb-mission-actions"><button type="button" data-efb-drawer-action="open-cargo">Verlade-Manager öffnen</button></div>'
        + (actionHtml ? '<div class="ga-efb-mission-actions">' + actionHtml + '</div>' : '')
        + abortHtml
        + (missionIntentStatus ? '<p class="ga-efb-mission-intent-status">' + drawerEscape(missionIntentStatus) + '</p>' : '')
        + '</section>' : '')
      + (feedbackHtml ? '<section class="ga-efb-mission-section"><small>LAGEBERICHT</small><div class="ga-efb-mission-feedback-list">' + feedbackHtml + '</div></section>' : '')
      + '<div class="ga-efb-mission-footer">' + (canIntent ? 'Tracker-Controller' : 'Nur Lesen') + ' | Mission und Fortschritt kommen vom Tracker | ' + drawerEscape(mission.sceneCount || 0) + ' Szenen</div>'
      + '</div>';
  }

  function requestMissionIntent(intent, payload) {
    if (intent === 'abort_mission') {
      var confirmed = false;
      try {
        var prompt = window.GAMissionControlUiCore && typeof window.GAMissionControlUiCore.abortConfirmation === 'function'
          ? window.GAMissionControlUiCore.abortConfirmation()
          : 'Mission wirklich abbrechen?';
        confirmed = window.confirm(prompt);
      } catch (_) {}
      if (!confirmed) return Promise.resolve(false);
    }
    return submitMissionIntent(intent, payload);
  }

  function submitMissionIntent(intent, payload) {
    var client = window.gaCockpitSessionClient;
    var control = missionSnapshot && missionSnapshot.control;
    if (missionIntentPending || !client || typeof client.submitIntent !== 'function' || !control) return Promise.resolve(false);
    missionIntentPending = true;
    var pendingPresentation = window.GAMissionControlUiCore && typeof window.GAMissionControlUiCore.formatIntentResult === 'function'
      ? window.GAMissionControlUiCore.formatIntentResult({ pending: true })
      : { tone: 'info', text: 'Tracker verarbeitet die Aktion ...' };
    missionIntentStatus = pendingPresentation.text;
    missionIntentTone = pendingPresentation.tone;
    renderSideDrawer(true);
    renderCargoManager();
    renderMissionActionBanner(missionSnapshot);
    renderMissionToolbar(missionSnapshot);
    var commandId = 'efb-intent-' + String(intent || 'action').replace(/[^a-z0-9_-]/gi, '-') + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    return client.submitIntent({
      commandId: commandId,
      intent: intent,
      missionId: control.missionId,
      runId: control.runId,
      expectedRevision: Number(control.authorityRevision || 0),
      payload: payload || {}
    }).then(function (result) {
      var presentation = window.GAMissionControlUiCore && typeof window.GAMissionControlUiCore.formatIntentResult === 'function'
        ? window.GAMissionControlUiCore.formatIntentResult(result)
        : { tone: result && result.ok === true ? 'good' : 'danger', text: result && result.ok === true ? 'Aktion bestaetigt.' : 'Aktion abgelehnt.' };
      missionIntentStatus = presentation.text;
      missionIntentTone = presentation.tone;
      return fetchJson('/api/v1/mission').then(function (envelope) {
        renderMissionPayload(safePayload(envelope));
        return result && result.ok === true;
      }).catch(function () { return result && result.ok === true; });
    }).catch(function (error) {
      var presentation = window.GAMissionControlUiCore && typeof window.GAMissionControlUiCore.formatIntentResult === 'function'
        ? window.GAMissionControlUiCore.formatIntentResult({ ok: false, error: error && error.message || 'mission_intent_failed' })
        : { tone: 'danger', text: 'Tracker-Aktion fehlgeschlagen.' };
      missionIntentStatus = presentation.text;
      missionIntentTone = presentation.tone;
      return false;
    }).then(function (ok) {
      missionIntentPending = false;
      renderSideDrawer(true);
      renderCargoManager();
      renderMissionActionBanner(missionSnapshot);
      renderMissionToolbar(missionSnapshot);
      return ok;
    });
  }

  function cargoStatusLabel(value) {
    var labels = {
      pending: 'offen',
      loaded: 'an Bord',
      unloaded: 'entladen',
      handed_off: 'übergeben',
      dropped: 'abgeworfen',
      lost: 'verloren'
    };
    return labels[String(value || '').toLowerCase()] || String(value || 'offen');
  }

  function cargoTypeLabel(item) {
    if (item && item.itemType === 'passenger') return 'PAX';
    if (item && (item.itemType === 'equipment' || item.persistentEquipment === true)) return 'Ausrüstung';
    return 'Fracht';
  }

  function cargoBlockerLabel(value) {
    var labels = {
      departure_manifest_incomplete: 'Pflichtladung für den Abflug noch offen',
      departure_signature_missing: 'Abflugmanifest noch nicht unterschrieben',
      boarding_not_confirmed: 'Boarding noch nicht bestätigt',
      load_not_confirmed: 'Verladung noch nicht bestätigt',
      pickup_manifest_incomplete: 'Pickup am Ziel noch offen',
      destination_unload_incomplete: 'Pflichtladung noch zu entladen',
      arrival_signature_missing: 'Ankunftsmanifest noch nicht unterschrieben',
      arrival_unload_not_confirmed: 'Entladung noch nicht bestätigt',
      compliance_inspection_active: 'Bordkontrolle noch aktiv',
      compliance_remediation_required: 'Beanstandung noch zu beheben',
      task_aborted: 'Auftrag wurde abgebrochen',
      cargo_failure: 'Ladungsschaden erkannt'
    };
    var key = String(value || '').toLowerCase();
    return labels[key] || key.replace(/_/g, ' ');
  }

  function cargoInteractionHint(phase) {
    var normalized = String(phase || '').toLowerCase();
    if (normalized === 'planned' && missionSnapshot && missionSnapshot.cloudPending === true) {
      return 'Mission zuerst ueber das Kartenbanner aus der Cloud beginnen. Danach gibt der Tracker die Verladung frei.';
    }
    if (normalized === 'planned') return 'Mission zuerst im Missionsmenü vorbereiten. Danach gibt der Tracker die Verladung frei.';
    if (normalized === 'boarded') return 'Die Verladung ist abgeschlossen. Starte die Mission im Missionsmenü.';
    if (/^(active|enroute|return_leg)$/.test(normalized)) {
      return 'Ladung ist während des Flugabschnitts gesperrt. Entladen wird erst nach erkannter Landung am Missionsziel und Stillstand freigegeben.';
    }
    if (normalized === 'on_task') return 'Der Tracker hat die Bodenaktion am Ziel noch nicht freigegeben. Position und Stillstand werden weiter geprüft.';
    if (normalized === 'closing') return 'Der Tracker schließt die Mission gerade ab. Ladungsaktionen sind gesperrt.';
    return 'Im aktuellen Tracker-Missionsstand ist keine Ladungsaktion freigegeben.';
  }

  function cargoManagerItems(mission, control) {
    var manifest = mission && mission.manifest && typeof mission.manifest === 'object' ? mission.manifest : {};
    if (Array.isArray(manifest.items) && manifest.items.length) return manifest.items;
    return control && control.cargo && Array.isArray(control.cargo.items) ? control.cargo.items : [];
  }

  function cargoDateLabel(value) {
    var timestamp = Number(value || 0);
    if (!timestamp) return '--';
    try {
      return new Intl.DateTimeFormat('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      }).format(new Date(timestamp));
    } catch (_) {
      return new Date(timestamp).toLocaleString();
    }
  }

  function projectedCargoModel(mission) {
    return mission && mission.ui && mission.ui.schema === 'ga.mission-apt-ui.v1'
      && mission.ui.cargo && mission.ui.cargo.presentation === 'app-cargo-dialog-v1'
      ? mission.ui.cargo
      : null;
  }

  function cargoActionAttributes(action, kind) {
    if (!action || action.disabled === true || !action.intent) return '';
    var attributes = ' data-efb-cargo-action="' + drawerEscape(kind || 'intent') + '" data-mission-intent="'
      + drawerEscape(action.intent) + '"';
    if (action.followupIntent) attributes += ' data-mission-followup-intent="' + drawerEscape(action.followupIntent) + '"';
    if (kind === 'item') {
      attributes += ' data-mission-item-id="' + drawerEscape(action.itemId || '') + '" data-mission-item-action="'
        + drawerEscape(action.action || '') + '"';
    }
    return attributes;
  }

  function appCargoPayloadMarkup(payload, mode) {
    var source = payload && typeof payload === 'object' ? payload : {};
    var summary = source.summary && typeof source.summary === 'object' ? source.summary : null;
    var status = source.message
      ? '<div class="mission-cargo-payload-message ' + drawerEscape(source.className || 'is-warn') + '">'
        + drawerEscape(source.message) + '</div>'
      : '';
    if (!summary || !summary.adapter) return status;
    var pounds = function (value) {
      return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
        ? Math.round(Number(value))
        : '&mdash;';
    };
    if (summary.isPa24 === true) {
      return '<div class="mission-cargo-payload-summary is-pa24"><div class="mission-cargo-payload-metrics">'
        + '<span><small>Max. Gewicht</small><strong>' + pounds(summary.maximumWeightLbs) + ' lbs</strong></span>'
        + '<span><small>PAX</small><strong>' + pounds(summary.paxWeightLbs) + ' lbs</strong></span>'
        + '<span><small>Payload</small><strong>' + pounds(summary.cargoWeightLbs) + ' lbs</strong></span>'
        + '<span><small>Fuel</small><strong>' + pounds(summary.fuelWeightLbs) + ' lbs</strong></span>'
        + '<span class="is-half"><small>Gesamt</small><strong>' + pounds(summary.totalWeightLbs) + ' lbs</strong></span>'
        + '<span class="is-half"><small>Leer</small><strong>' + pounds(summary.emptyWeightLbs) + ' lbs</strong></span>'
        + '</div>' + status + '</div>';
    }
    var stationList = (Array.isArray(summary.stations) ? summary.stations : []).map(function (row) {
      var hasBase = row.baselineWeightLbs !== null && row.baselineWeightLbs !== undefined && row.baselineWeightLbs !== '';
      var hasExtra = row.missionExtraLbs !== null && row.missionExtraLbs !== undefined && row.missionExtraLbs !== '';
      var hasWeight = row.weightLbs !== null && row.weightLbs !== undefined && row.weightLbs !== '';
      var detail = hasBase && hasExtra && Number.isFinite(Number(row.baselineWeightLbs)) && Number.isFinite(Number(row.missionExtraLbs))
        ? ' (Basis ' + Math.round(Number(row.baselineWeightLbs)) + ' + ' + Math.round(Number(row.missionExtraLbs)) + ' lbs)'
        : '';
      return 'S' + Math.round(Number(row.index) || 0) + ': ' + (hasWeight && Number.isFinite(Number(row.weightLbs)) ? Math.round(Number(row.weightLbs)) : '-') + ' lbs' + detail;
    }).join(' &middot; ');
    var list = function (values) {
      return (Array.isArray(values) ? values : []).length ? values.map(function (value) { return 'S' + value; }).join('/') : '-';
    };
    return '<div class="mission-cargo-payload-summary">'
      + '<div>Sim aktuell: Gesamt ' + pounds(summary.totalWeightLbs) + ' lbs &middot; Leer ' + pounds(summary.emptyWeightLbs)
      + ' lbs &middot; Fuel ' + pounds(summary.fuelWeightLbs) + ' lbs</div>'
      + '<div>Nutzlaststationen: ' + drawerEscape(summary.payloadStationCount || 0) + ' &middot; Verteilung: Copilot S'
      + drawerEscape(summary.copilotIndex || '-') + ' &middot; Ruecksitze ' + drawerEscape(list(summary.rearSeatIndices))
      + ' &middot; Cargo ' + drawerEscape(list(summary.cargoIndices)) + '</div>'
      + '<div>Mission-Plan (' + (mode === 'unload' ? 'Entladen' : 'Verladen') + '): Pax ' + pounds(summary.paxWeightLbs)
      + ' lbs &middot; Cargo ' + pounds(summary.cargoWeightLbs) + ' lbs &middot; Zusatz ' + pounds(summary.missionWeightLbs) + ' lbs</div>'
      + '<div>Stationen: ' + (stationList || '-') + '</div>' + status + '</div>';
  }

  function appCargoManagerMarkup(mission, model) {
    var signature = model.signature && typeof model.signature === 'object' ? model.signature : {};
    var localSignatureAnimation = signature.signed === true
      && (signature.animating === true
        || (cargoSignatureAnimationScope === String(signature.scope || '')
          && cargoSignatureAnimationEndsAt > Date.now()));
    if (!signature.signed) {
      cargoSignatureAnimationEndsAt = 0;
      cargoSignatureAnimationScope = '';
    }
    var rows = (Array.isArray(model.items) ? model.items : []).map(function (item) {
      var action = item && item.action && typeof item.action === 'object' ? Object.assign({ itemId: item.id }, item.action) : null;
      var stationAction = item && item.stationAction && typeof item.stationAction === 'object'
        ? Object.assign({ itemId: item.id }, item.stationAction)
        : null;
      var canInteract = action && action.disabled !== true && action.intent;
      var rowClasses = String(item && item.rowClasses || '');
      var attributes = canInteract ? cargoActionAttributes(action, 'item') : '';
      var disabled = action && action.disabled === true ? ' aria-disabled="true"' : '';
      var title = action && action.label ? ' title="' + drawerEscape(action.label) + '"' : '';
      var expiryDetail = item && item.equipmentDetail && item.equipmentDetail.kind === 'expiry'
        ? '<span class="mission-cargo-sheet-item-date">Gültig bis ' + drawerEscape(String(item.equipmentDetail.text || '')
          .replace(/^Ablaufdatum:\s*/, '').split(' \u00b7 ')[0]) + '</span>'
        : '';
      var stationButton = stationAction
        ? '<button type="button" class="mission-cargo-sheet-action"'
          + ((missionIntentPending || stationAction.disabled === true) ? ' disabled' : '')
          + cargoActionAttributes(stationAction, 'item') + '>' + drawerEscape(stationAction.label || '') + '</button>'
        : '';
      return '<tr class="' + drawerEscape(rowClasses) + '"' + disabled + attributes + title + '>'
        + '<td>' + drawerEscape(item.index || 0) + '</td>'
        + '<td><span>' + drawerEscape(item.label || item.id || '') + '</span>' + expiryDetail + '</td>'
        + '<td>' + drawerEscape(item.typeLabel || '') + '</td>'
        + '<td>' + drawerEscape(item.weightLbs || 0) + ' lbs</td>'
        + '<td><span class="mission-cargo-sheet-station">' + drawerEscape(item.station || '-') + '</span>' + stationButton + '</td>'
        + '<td><div class="mission-cargo-sheet-status"><span>' + drawerEscape(item.statusLabel || 'offen') + '</span>'
        + (action && action.label ? '<span class="mission-cargo-sheet-status-hint">' + drawerEscape(action.label) + '</span>' : '')
        + '</div></td></tr>';
    }).join('') || '<tr><td colspan="6">Keine Ladung fuer diese Mission.</td></tr>';
    var signatureDate = signature.signed ? cargoDateLabel(signature.at) : 'noch offen';
    var signatureState = localSignatureAnimation ? 'wird eingetragen' : String(signature.stateText || '');
    var signatureAction = signature.clickable === true && !localSignatureAnimation
      ? {
          intent: signature.action || (signature.signed ? 'clear_manifest_signature' : 'sign_manifest'),
          disabled: false
        }
      : null;
    var signatureMarkup = signature.visible === true
      ? '<div class="mission-cargo-signature' + (signature.signed ? ' is-signed' : '')
        + (localSignatureAnimation ? ' is-animating' : '')
        + (signatureAction ? ' is-clickable' : '') + '"' + cargoActionAttributes(signatureAction, 'intent') + '>'
        + '<div class="mission-cargo-signature-line">' + (signature.signed
          ? '<span class="mission-cargo-signature-name">' + drawerEscape(signature.name || 'Tracker') + '</span>'
          : '&nbsp;') + '</div>'
        + '<div class="mission-cargo-signature-meta">Unterschrift Pilot &middot; ' + drawerEscape(signatureDate) + ' &middot; '
        + drawerEscape(signatureState) + '</div></div>'
      : '';
    var primary = model.actions && model.actions.primary ? Object.assign({}, model.actions.primary) : null;
    if (primary && localSignatureAnimation) {
      primary.intent = '';
      primary.action = '';
      primary.label = 'Unterschrift wird eingetragen ...';
      primary.disabled = true;
    }
    var secondary = model.actions && model.actions.secondary ? model.actions.secondary : null;
    function actionButton(action) {
      if (!action) return '';
      var localClose = action.action === 'close' && !action.intent;
      var attributes = localClose
        ? ' data-efb-cargo-action="close"'
        : cargoActionAttributes(action, 'intent');
      return '<button type="button" class="' + drawerEscape(action.className || 'mission-cargo-primary') + '"'
        + ((missionIntentPending || action.disabled === true) ? ' disabled' : '') + attributes + '>'
        + drawerEscape(action.label || '') + '</button>';
    }
    var payload = appCargoPayloadMarkup(model.payload, model.mode);
    var intentStatus = missionIntentStatus
      ? '<div class="mission-cargo-summary ' + (/abgelehnt|fehlgeschlagen/i.test(missionIntentStatus) ? 'mission-cargo-error' : '') + '">'
        + drawerEscape(missionIntentStatus) + '</div>'
      : '';
    var compliance = model.compliance && model.compliance.active === true
      ? '<div class="mission-cargo-summary mission-cargo-compliance"><strong>BEHOERDENKONTROLLE</strong><span>'
        + drawerEscape(model.compliance.message || '') + '</span></div>'
      : '';
    return (model.modeHint ? '<div class="mission-cargo-summary mission-cargo-tracker-lock">' + drawerEscape(model.modeHint) + '</div>' : '')
      + intentStatus
      + compliance
      + '<div class="mission-cargo-copy">' + drawerEscape(model.copy || '') + '</div>'
      + '<div class="mission-cargo-clipboard"><div class="mission-cargo-sheet-title">Frachtgutliste</div>'
      + '<div class="mission-cargo-sheet-meta"><span><b>Flugzeug Kennung:</b> ' + drawerEscape(model.meta && model.meta.aircraft || 'N/A') + '</span>'
      + '<span><b>Pilot-ID:</b> ' + drawerEscape(model.meta && model.meta.pilot || 'Tracker') + '</span>'
      + '<span><b>Datum:</b> ' + drawerEscape(cargoDateLabel(model.meta && model.meta.dateAt)) + '</span></div>'
      + '<table class="mission-cargo-sheet-table"><thead><tr><th>#</th><th>Position</th><th>Typ</th><th>Gewicht</th><th>Station</th><th>Status</th></tr></thead>'
      + '<tbody>' + rows + '</tbody></table>' + signatureMarkup + '</div>'
      + payload
      + '<div class="mission-cargo-summary"><span>' + drawerEscape(model.summary && model.summary.left || '') + '</span><span>'
      + drawerEscape(model.summary && model.summary.right || '') + '</span></div>'
      + '<div class="mission-cargo-actions">' + actionButton(secondary) + actionButton(primary) + '</div>';
  }

  function cargoPayloadStatusMarkup(control) {
    var payload = control && control.payload && typeof control.payload === 'object' ? control.payload : null;
    var presentation = payload && payload.presentation && typeof payload.presentation === 'object'
      ? payload.presentation
      : null;
    var message = presentation ? String(presentation.message || '').trim() : '';
    if (!message) return '';
    var className = ['is-pending', 'is-ok', 'is-warn'].indexOf(String(presentation.className || '')) >= 0
      ? String(presentation.className)
      : 'is-warn';
    return '<div class="mission-cargo-payload-message ' + className + '">' + drawerEscape(message) + '</div>';
  }

  function cargoItemAction(item, control, allowedActions) {
    if (!item || !control) return null;
    var phase = String(control.phase || '').toLowerCase();
    var status = String(item.status || 'pending').toLowerCase();
    if (item.itemType === 'passenger') {
      if (/^(end_unloading|end_ready)$/.test(phase) && status === 'loaded'
          && String(item.delivery || 'destination') === 'destination'
          && allowedActions.indexOf('request_pax_interaction') >= 0) {
        return { intent: 'request_pax_interaction', action: 'deboard', label: 'Aussteigen lassen' };
      }
      return null;
    }
    if (allowedActions.indexOf('set_manifest_item') < 0) return null;
    var departureItem = String(item.pickup || 'departure') !== 'target';
    var arrivalItem = String(item.delivery || 'destination') === 'destination';
    var equipmentItem = item.persistentEquipment === true;
    if (/^(prepare|boarding)$/.test(phase) && departureItem && (status === 'pending' || status === 'unloaded')) {
      return { intent: 'set_manifest_item', action: 'load', label: 'Verladen' };
    }
    if (/^(prepare|boarding)$/.test(phase) && departureItem && status === 'loaded') {
      return { intent: 'set_manifest_item', action: 'unload', label: 'Ausladen' };
    }
    if (/^(active|enroute|return_leg)$/.test(phase) && status === 'loaded') {
      return { intent: 'set_manifest_item', action: 'unload', label: 'Abwerfen' };
    }
    if (phase === 'on_task' && status === 'pending' && String(item.pickup || '') === 'target') {
      return { intent: 'set_manifest_item', action: 'load', label: 'Aufnehmen' };
    }
    if (/^(end_unloading|end_ready)$/.test(phase) && status === 'loaded' && (arrivalItem || equipmentItem)) {
      return { intent: 'set_manifest_item', action: 'unload', label: 'Entladen' };
    }
    if (/^(end_unloading|end_ready)$/.test(phase) && (status === 'pending' || status === 'unloaded') && (arrivalItem || equipmentItem)) {
      return { intent: 'set_manifest_item', action: 'load', label: 'Wieder laden' };
    }
    return null;
  }

  function cargoManagerMarkup() {
    var mission = missionSnapshot && missionSnapshot.available !== false ? missionSnapshot : null;
    var control = mission && mission.control && typeof mission.control === 'object' ? mission.control : null;
    if (!mission || !mission.missionId || !control) {
      return '<div class="mission-cargo-empty"><strong>Keine aktive Tracker-Mission</strong><br>Eine Frachtgutliste steht zur Verfügung, sobald der Tracker eine Mission übernommen hat.</div>';
    }
    var exactModel = projectedCargoModel(mission);
    if (exactModel) return appCargoManagerMarkup(mission, exactModel);
    var manifest = mission.manifest && typeof mission.manifest === 'object' ? mission.manifest : {};
    var items = cargoManagerItems(mission, control);
    var allowedActions = Array.isArray(control.allowedActions) ? control.allowedActions : [];
    var phase = String(control.phase || '').toLowerCase();
    var projectedCargo = mission.ui && mission.ui.schema === 'ga.mission-apt-ui.v1'
      && mission.ui.cargo && typeof mission.ui.cargo === 'object'
      ? mission.ui.cargo
      : null;
    var projectedItemActions = new Map((projectedCargo && Array.isArray(projectedCargo.items) ? projectedCargo.items : []).map(function (item) {
      return [String(item && item.id || ''), item && item.action || null];
    }));
    var interactiveItems = 0;
    var rows = items.map(function (item, index) {
      var action = projectedCargo
        ? (projectedItemActions.get(String(item && item.id || '')) || null)
        : cargoItemAction(item, control, allowedActions);
      if (action) interactiveItems += 1;
      var label = item && (item.label || item.storyName || item.id) || 'Position ' + String(index + 1);
      var type = cargoTypeLabel(item);
      var weight = item && item.itemType === 'passenger'
        ? String(Math.max(1, Number(item.passengerCount) || 1)) + ' PAX'
        : (Number(item && item.weightLbs) > 0 ? Math.round(Number(item.weightLbs)) + ' lbs' : '--');
      var status = cargoStatusLabel(item && item.status);
      var rowClass = 'is-' + drawerEscape(String(item && item.status || 'pending').toLowerCase());
      if (action) rowClass += ' is-interactive';
      return '<tr class="' + rowClass + '"><td>' + String(index + 1) + '</td><td><strong>' + drawerEscape(label) + '</strong>'
        + (item && item.station ? '<span class="mission-cargo-sheet-station">' + drawerEscape(item.station) + '</span>' : '')
        + '</td><td>' + drawerEscape(type) + '</td><td>' + drawerEscape(weight) + '</td><td><span class="mission-cargo-sheet-status"><b>'
        + drawerEscape(status) + '</b>'
        + (action ? '<button type="button" class="mission-cargo-sheet-action" data-efb-cargo-action="item" data-mission-intent="'
          + drawerEscape(action.intent) + '" data-mission-item-id="' + drawerEscape(item.id) + '" data-mission-item-action="'
          + drawerEscape(action.action) + '"' + (missionIntentPending ? ' disabled' : '') + '>' + drawerEscape(action.label) + '</button>' : '')
        + '</span></td></tr>';
    }).join('');
    var directActions = projectedCargo && Array.isArray(projectedCargo.directActions) ? projectedCargo.directActions : [
      { intent: 'sign_manifest', label: 'Manifest unterschreiben', className: 'mission-cargo-secondary' },
      { intent: 'clear_manifest_signature', label: 'Zurück zur Liste', className: 'mission-cargo-secondary' },
      { intent: 'confirm_load', label: 'Verladung bestätigen', className: 'mission-cargo-primary' },
      { intent: 'confirm_pickup', label: 'Pickup bestätigen', className: 'mission-cargo-primary' },
      { intent: 'confirm_unload', label: 'Entladung bestätigen', className: 'mission-cargo-primary' }
    ].filter(function (action) { return allowedActions.indexOf(action.intent) >= 0; });
    var actions = directActions.map(function (action) {
      return '<button type="button" class="' + action.className + '" data-efb-cargo-action="intent" data-mission-intent="'
        + action.intent + '"' + (action.followupIntent ? ' data-mission-followup-intent="' + drawerEscape(action.followupIntent) + '"' : '')
        + (missionIntentPending ? ' disabled' : '') + '>' + action.label + '</button>';
    }).join('');
    var lockHint = projectedCargo
      ? String(projectedCargo.lockHint || '')
      : (interactiveItems === 0 && directActions.length === 0 ? cargoInteractionHint(phase) : '');
    var signatureScope = String(manifest.signatureScope || (control.cargo && control.cargo.signatureScope) || '');
    var signatureLabels = { departure: 'Abflugmanifest unterschrieben', pickup: 'Pickup-Manifest unterschrieben', arrival: 'Ankunftsmanifest unterschrieben' };
    var summary = control.cargo && control.cargo.summary || {};
    var payloadStatus = cargoPayloadStatusMarkup(control);
    var projectedBlockers = projectedCargo && Array.isArray(projectedCargo.blockingReasons) ? projectedCargo.blockingReasons : null;
    var blocker = projectedBlockers && projectedBlockers.length
      ? projectedBlockers.join(' | ')
      : (Array.isArray(control.blockingReasons) && control.blockingReasons.length
        ? control.blockingReasons.map(cargoBlockerLabel).join(' | ')
        : 'Keine offenen Tracker-Sperren');
    var mode = /^(prepare|boarding|boarded)$/.test(phase)
      ? 'Abflug und Boarding'
      : (phase === 'on_task' ? 'Auftrag am Ziel' : (/^(end_unloading|end_ready)$/.test(phase) ? 'Ankunft und Entladung' : 'Synchroner Missionsstand'));
    return '<div class="mission-cargo-copy">' + drawerEscape(mode) + '. Jede Änderung wird direkt an den Tracker gesendet und auf allen verbundenen Ansichten aktualisiert.</div>'
      + '<div class="mission-cargo-clipboard"><div class="mission-cargo-sheet-title">Frachtgutliste</div>'
      + '<div class="mission-cargo-sheet-meta"><span>Mission: ' + drawerEscape(mission.missionId) + '</span><span>Phase: ' + drawerEscape(phase || '--')
      + '</span><span>Stand: ' + drawerEscape(control.authorityRevision || mission.revision || 0) + '</span></div>'
      + '<table class="mission-cargo-sheet-table"><thead><tr><th>#</th><th>Position</th><th>Typ</th><th>Gewicht</th><th>Status</th></tr></thead><tbody>'
      + (rows || '<tr><td colspan="5">Keine Ladungspositionen für diese Mission.</td></tr>') + '</tbody></table>'
      + '<div class="mission-cargo-signature' + (signatureScope ? ' is-signed' : '') + '"><div class="mission-cargo-signature-line"><span class="mission-cargo-signature-name">'
      + drawerEscape(signatureLabels[signatureScope] || 'Unterschrift ausstehend') + '</span></div><div class="mission-cargo-signature-meta">Tracker-Manifest</div></div></div>'
      + '<div class="mission-cargo-summary"><span>' + drawerEscape(Number(summary.loaded || 0)) + ' geladen / '
      + drawerEscape(Number(summary.unloaded || 0)) + ' entladen</span><span>' + drawerEscape(blocker) + '</span></div>'
      + payloadStatus
      + (lockHint ? '<div class="ga-efb-cargo-lock-hint">' + drawerEscape(lockHint) + '</div>' : '')
      + (missionIntentStatus ? '<div class="mission-cargo-copy ga-efb-cargo-intent-status">' + drawerEscape(missionIntentStatus) + '</div>' : '')
      + (actions ? '<div class="mission-cargo-actions">' + actions + '</div>' : '');
  }

  function ensureCargoManager() {
    var existing = byId('gaEfbCargoManager');
    if (existing) return existing;
    var overlay = document.createElement('div');
    overlay.id = 'gaEfbCargoManager';
    overlay.className = 'mission-cargo-overlay ga-efb-cargo-manager';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '<section class="mission-cargo-panel" role="dialog" aria-modal="true" aria-labelledby="gaEfbCargoTitle">'
      + '<div class="mission-cargo-head"><div><div id="gaEfbCargoKicker" class="mission-cargo-kicker">Bodenservice</div><div id="gaEfbCargoTitle" class="mission-cargo-title">Verladung</div></div>'
      + '<button type="button" class="mission-cargo-close" data-efb-cargo-action="close" title="Schliessen">&times;</button></div>'
      + '<div id="gaEfbCargoBody"></div></section>';
    overlay.addEventListener('click', function (event) {
      var actionNode = event.target && event.target.closest ? event.target.closest('[data-efb-cargo-action]') : null;
      if (!actionNode) {
        if (event.target === overlay) closeCargoManager();
        return;
      }
      var action = actionNode.getAttribute('data-efb-cargo-action');
      if (action === 'close') closeCargoManager();
      if (action === 'intent' || action === 'item') {
        var intent = actionNode.getAttribute('data-mission-intent') || '';
        var followupIntent = actionNode.getAttribute('data-mission-followup-intent') || '';
        var payload = {};
        if (action === 'item') {
          payload.itemId = actionNode.getAttribute('data-mission-item-id') || '';
          payload.action = actionNode.getAttribute('data-mission-item-action') || '';
        }
        if (intent === 'request_pax_interaction') payload.action = 'deboard';
        var requested = requestMissionIntent(intent, payload);
        if (intent === 'clear_manifest_signature') {
          cargoSignatureAnimationEndsAt = 0;
          cargoSignatureAnimationScope = '';
        }
        if (followupIntent && requested && typeof requested.then === 'function') {
          requested.then(function (ok) {
            if (ok) return requestMissionIntent(followupIntent, {});
            return false;
          });
        } else if (intent === 'sign_manifest' && requested && typeof requested.then === 'function') {
          requested.then(function (ok) {
            if (!ok) return false;
            var exactModel = projectedCargoModel(missionSnapshot);
            cargoSignatureAnimationScope = String(exactModel && exactModel.signature && exactModel.signature.scope || '');
            cargoSignatureAnimationEndsAt = Date.now() + 1600;
            if (cargoSignatureAnimationTimer) window.clearTimeout(cargoSignatureAnimationTimer);
            cargoSignatureAnimationTimer = window.setTimeout(function () {
              cargoSignatureAnimationTimer = 0;
              cargoSignatureAnimationEndsAt = 0;
              renderCargoManager();
            }, 1640);
            cargoManagerSignature = '';
            renderCargoManager();
            return true;
          });
        }
      }
      event.preventDefault();
      event.stopPropagation();
    });
    ['pointerdown', 'mousedown', 'touchstart', 'dblclick', 'wheel'].forEach(function (type) {
      overlay.addEventListener(type, function (event) { event.stopPropagation(); }, false);
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function renderCargoManager() {
    var overlay = byId('gaEfbCargoManager');
    if (!overlay || !cargoManagerOpen) return;
    var body = byId('gaEfbCargoBody');
    if (!body) return;
    var exactModel = projectedCargoModel(missionSnapshot);
    setText('gaEfbCargoKicker', exactModel && exactModel.header ? exactModel.header.kicker : 'Tracker Mission Control');
    setText('gaEfbCargoTitle', exactModel && exactModel.header ? exactModel.header.title : 'Verlade-Manager');
    var markup = cargoManagerMarkup();
    if (markup === cargoManagerSignature) return;
    var scrollTop = body.scrollTop;
    cargoManagerSignature = markup;
    body.innerHTML = markup;
    body.scrollTop = scrollTop;
  }

  function openCargoManager() {
    var overlay = ensureCargoManager();
    if (!overlay) return;
    cargoManagerOpen = true;
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
    renderCargoManager();
    report('info', 'cargo-manager', 'open', 'Eigenständiger Verlade-Manager geöffnet');
  }

  function closeCargoManager() {
    var overlay = byId('gaEfbCargoManager');
    cargoManagerOpen = false;
    if (!overlay) return;
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    report('info', 'cargo-manager', 'close', 'Verlade-Manager geschlossen');
  }

  function checklistListMarkup() {
    return '<div class="ga-efb-checklist-list">' + allEfbChecklists().map(function (checklist) {
      var total = checklistItems(checklist).length;
      var done = checklistDoneCount(checklist);
      return '<button type="button" data-efb-drawer-action="open-checklist" data-checklist-id="' + drawerEscape(checklist.id) + '">'
        + '<strong>' + drawerEscape(checklist.title) + (checklist.source === 'custom' ? '<em>EIGEN</em>' : '') + '</strong>'
        + '<span>' + done + ' / ' + total + ' erledigt</span>'
        + '</button>';
    }).join('') + '</div>';
  }

  function selectedChecklistMarkup() {
    var checklist = null;
    allEfbChecklists().some(function (candidate) {
      if (candidate.id !== drawerChecklistId) return false;
      checklist = candidate;
      return true;
    });
    if (!checklist) return checklistListMarkup();
    var html = '<button type="button" class="ga-efb-drawer-back" data-efb-drawer-action="checklist-list">&lt; Alle Checklisten</button>';
    html += '<div class="ga-efb-checklist-detail"><h3>' + drawerEscape(checklist.title) + '</h3>';
    checklist.sections.forEach(function (section, sectionIndex) {
      html += '<section><h4>' + drawerEscape(section.title) + '</h4>';
      section.items.forEach(function (item, itemIndex) {
        var text = item && typeof item === 'object' ? item.text : item;
        var sectionId = section.id || 'section-' + (sectionIndex + 1);
        var itemId = item && typeof item === 'object' ? item.id : 'item-' + (itemIndex + 1);
        var key = checklist.id + ':' + sectionId + ':' + itemId;
        var checked = efbChecklistProgress[key] === true;
        html += '<button type="button" class="ga-efb-check-row' + (checked ? ' is-checked' : '') + '" data-efb-check-row="' + drawerEscape(key)
          + '" role="checkbox" aria-checked="' + (checked ? 'true' : 'false') + '"><i aria-hidden="true"></i><span>' + drawerEscape(text) + '</span></button>';
      });
      html += '</section>';
    });
    return html + '</div>';
  }

  function restoreDrawerScroll(body, scrollTop) {
    if (!body) return;
    var target = Math.max(0, Number(scrollTop) || 0);
    var generation = drawerInputGeneration;
    var apply = function () {
      if (generation !== drawerInputGeneration) return;
      body.scrollTop = target;
    };
    apply();
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(apply);
    window.setTimeout(apply, 90);
  }

  function renderSideDrawer(preserveScroll) {
    var body = byId('checklistDrawerBody');
    var title = byId('checklistDrawerTitle');
    var status = byId('checklistDrawerStatus');
    if (!body) return;
    var scrollTop = preserveScroll ? body.scrollTop : 0;
    if (title) title.textContent = drawerView === 'mission' ? 'Mission Control' : 'Checklisten';
    if (status) {
      var trackerControl = missionSnapshot && missionSnapshot.control && missionSnapshot.control.executionAuthority === 'tracker';
      status.textContent = drawerView === 'mission'
        ? (trackerControl ? 'Live vom Tracker | Steuerung aktiv' : 'Live vom Tracker | nur Lesen')
        : 'Fortschritt bleibt lokal in diesem EFB';
    }
    var tabs = '<div class="ga-efb-drawer-tabs">'
      + '<button type="button" data-efb-drawer-action="mission" class="' + (drawerView === 'mission' ? 'active' : '') + '">Mission</button>'
      + '<button type="button" data-efb-drawer-action="checklists" class="' + (drawerView === 'checklists' ? 'active' : '') + '">Checklisten</button>'
      + '</div>';
    body.innerHTML = tabs + (drawerView === 'mission' ? missionStatusMarkup() : (drawerChecklistId ? selectedChecklistMarkup() : checklistListMarkup()));
    if (preserveScroll) restoreDrawerScroll(body, scrollTop);
  }

  function flushPendingDrawerRefresh() {
    drawerInteractionActive = false;
    drawerInteractionTimer = 0;
    if (!drawerRefreshPending) return;
    drawerRefreshPending = false;
    renderSideDrawer(true);
  }

  function scheduleDrawerInteractionEnd() {
    if (drawerInteractionTimer) window.clearTimeout(drawerInteractionTimer);
    drawerInteractionTimer = window.setTimeout(flushPendingDrawerRefresh, 260);
  }

  function beginDrawerInteraction() {
    drawerInputGeneration += 1;
    drawerInteractionActive = true;
    if (drawerInteractionTimer) window.clearTimeout(drawerInteractionTimer);
    drawerInteractionTimer = 0;
  }

  function noteDrawerScroll() {
    drawerInteractionActive = true;
    scheduleDrawerInteractionEnd();
  }

  function requestSideDrawerRefresh() {
    if (drawerInteractionActive) {
      drawerRefreshPending = true;
      return;
    }
    renderSideDrawer(true);
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
      var checkNode = event.target && event.target.closest ? event.target.closest('[data-efb-check-row]') : null;
      if (checkNode) {
        var checkKey = checkNode.getAttribute('data-efb-check-row') || '';
        if (checkKey) {
          efbChecklistProgress[checkKey] = efbChecklistProgress[checkKey] !== true;
          saveEfbChecklistProgress();
          renderSideDrawer(true);
          report('info', 'checklist-action', efbChecklistProgress[checkKey] ? 'checked' : 'unchecked', 'Checklistenpunkt aktualisiert', checkKey);
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      var actionNode = event.target && event.target.closest ? event.target.closest('[data-efb-drawer-action]') : null;
      if (!actionNode) return;
      var action = actionNode.getAttribute('data-efb-drawer-action');
      if (action === 'mission-intent') {
        var intent = actionNode.getAttribute('data-mission-intent') || '';
        var payload = {};
        if (intent === 'set_manifest_item') {
          payload.itemId = actionNode.getAttribute('data-mission-item-id') || '';
          payload.action = actionNode.getAttribute('data-mission-item-action') || '';
        }
        if (intent === 'request_pax_interaction') payload.action = 'deboard';
        requestMissionIntent(intent, payload);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (action === 'open-cargo') {
        openCargoManager();
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (action === 'toggle-mission-story') {
        missionStoryExpanded = !missionStoryExpanded;
        renderSideDrawer(true);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (action === 'mission') { drawerView = 'mission'; drawerChecklistId = ''; }
      if (action === 'checklists' || action === 'checklist-list') { drawerView = 'checklists'; drawerChecklistId = ''; }
      if (action === 'open-checklist') { drawerView = 'checklists'; drawerChecklistId = actionNode.getAttribute('data-checklist-id') || ''; }
      renderSideDrawer();
      event.preventDefault();
      event.stopPropagation();
    });
    ['pointerdown', 'mousedown', 'touchstart', 'click', 'dblclick', 'wheel'].forEach(function (type) {
      drawer.addEventListener(type, function (event) { event.stopPropagation(); }, false);
    });
    ['pointerdown', 'mousedown', 'touchstart', 'wheel'].forEach(function (type) {
      body.addEventListener(type, function () {
        beginDrawerInteraction();
        if (type === 'wheel') scheduleDrawerInteractionEnd();
      }, false);
    });
    body.addEventListener('scroll', noteDrawerScroll, false);
    ['pointerup', 'pointercancel', 'mouseup', 'touchend', 'touchcancel'].forEach(function (type) {
      window.addEventListener(type, scheduleDrawerInteractionEnd, false);
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

  function applyTheme() {
    ['classic', 'retro', 'navcom', 'ops1940', 'win95'].forEach(function (id) { document.body.classList.remove('theme-' + id); });
    document.body.classList.add('theme-classic');
    preferences.theme = 'classic';
    savePreferences();
    if (map) window.setTimeout(function () { map.invalidateSize(false); }, 50);
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

  function closeHostMenus(except) {
    Array.prototype.forEach.call(document.querySelectorAll('.ga-efb-host-menu.is-open'), function (menu) {
      if (menu === except) return;
      menu.classList.remove('is-open');
      var trigger = menu.querySelector('.ga-efb-host-menu-trigger');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
      var panel = menu._gaHostMenuPanel || menu.querySelector('.ga-efb-host-menu-panel');
      if (panel) {
        panel.classList.remove('is-open');
        panel.style.position = '';
        panel.style.top = '';
        panel.style.right = '';
        panel.style.bottom = '';
        panel.style.left = '';
        if (panel.parentNode !== menu) menu.appendChild(panel);
      }
    });
  }

  function openHostMenuPanel(wrapper, trigger, panel) {
    document.body.appendChild(panel);
    panel.classList.add('is-open');
    panel.style.position = 'fixed';
    panel.style.top = '0px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.left = '0px';
    var triggerRect = trigger.getBoundingClientRect();
    var panelWidth = panel.offsetWidth || 180;
    var panelHeight = panel.offsetHeight || 180;
    var margin = 8;
    var gap = 7;
    var left = wrapper.classList.contains('ga-efb-host-tools-menu')
      ? triggerRect.right - panelWidth
      : triggerRect.left;
    left = Math.max(margin, Math.min(window.innerWidth - panelWidth - margin, left));
    var top = triggerRect.bottom + gap;
    if (top + panelHeight > window.innerHeight - margin) {
      top = Math.max(margin, triggerRect.top - panelHeight - gap);
    }
    panel.style.left = Math.round(left) + 'px';
    panel.style.top = Math.round(top) + 'px';
  }

  function makeHostMenu(className, label, items) {
    var wrapper = document.createElement('div');
    wrapper.className = 'ga-efb-host-menu ' + className;
    var trigger = makeButton('pb-btn ga-efb-host-menu-trigger', label, function () {
      var open = !wrapper.classList.contains('is-open');
      closeHostMenus(wrapper);
      wrapper.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) openHostMenuPanel(wrapper, trigger, panel);
    });
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    var panel = document.createElement('div');
    panel.className = 'ga-efb-host-menu-panel';
    items.forEach(function (item) {
      if (item.hint) {
        var hint = document.createElement('div');
        hint.className = 'ga-efb-host-menu-hint' + (item.className ? ' ' + item.className : '');
        hint.textContent = item.label;
        panel.appendChild(hint);
        return;
      }
      var entry = makeButton('ga-efb-host-menu-item', item.label, function () {
        closeHostMenus();
        item.action();
      });
      if (item.className) entry.classList.add(item.className);
      panel.appendChild(entry);
    });
    wrapper.appendChild(trigger);
    wrapper.appendChild(panel);
    wrapper._gaHostMenuPanel = panel;
    return wrapper;
  }

  function toggleLayerMenu() {
    var control = document.querySelector('.leaflet-control-layers');
    if (!control) return;
    control.classList.toggle('leaflet-control-layers-expanded');
    report('info', 'toolbar', 'layers', 'Layerauswahl umgeschaltet');
  }

  function toggleUtilityTool(tool) {
    if (typeof window.toggleMapUtilityTool === 'function') {
      return window.toggleMapUtilityTool(tool);
    }
    if (typeof window.isMapUtilityToolOpen === 'function' &&
        window.isMapUtilityToolOpen(tool) &&
        typeof window.closeMapUtilityTool === 'function') {
      window.closeMapUtilityTool(tool);
      return false;
    }
    if (typeof window.openMapUtilityTool === 'function') {
      window.openMapUtilityTool(tool);
      return true;
    }
    return false;
  }

  function configureOriginalChrome() {
    var overlay = byId('mapTableOverlay');
    if (overlay) overlay.classList.add('active');
    setText('navStationLabel', 'NAV STATION (KARTENTISCH) | HOST 0.7.4');

    var toolbarRow = byId('mapToolbarInner');
    var actions = toolbarRow && toolbarRow.lastElementChild;
    var profileButton = byId('vpToggleBtn');
    if (actions && profileButton) {
      actions.classList.add('ga-efb-host-actions');
      var displayMenu = makeHostMenu('ga-efb-host-display-menu', 'Anzeige', [
        { label: 'Infofenster einblenden', action: showAllInfoBoxes },
        { label: 'Kartenlayer', action: toggleLayerMenu },
        { label: 'Schrift kleiner (-)', action: function () { setEfbFontScale(preferences.fontScale - 0.1); } },
        { label: 'Schriftgröße: ' + Math.round(preferences.fontScale * 100) + '%', hint: true, className: 'ga-efb-font-size-hint' },
        { label: 'Schrift größer (+)', action: function () { setEfbFontScale(preferences.fontScale + 0.1); } },
        { label: 'Schrift Standard (110%)', action: function () { setEfbFontScale(1.1); } },
        { label: 'Was ist hier: Karte kurz halten', hint: true }
      ]);
      profileButton.insertAdjacentElement('afterend', displayMenu);
      var missionMenu = makeHostMenu('ga-efb-host-mission-menu', 'Mission', [
        { label: 'Missionsstatus', action: function () { openSideDrawer('mission'); } },
        { label: 'Verlade-Manager', action: openCargoManager },
        { label: 'Checklisten', action: function () { openSideDrawer('checklists'); } }
      ]);
      displayMenu.insertAdjacentElement('afterend', missionMenu);
      var toolsMenu = makeHostMenu('ga-efb-host-tools-menu', 'Werkzeuge', [
        { label: 'Werkzeugleiste', action: function () { window.toggleMapToolRail(); } },
        { label: 'Zeichnen', action: function () { setDrawMode('pen'); } },
        { label: 'Strecke messen', action: function () { setDrawMode('measure'); } },
        { label: 'Uhr / Timer', action: function () { toggleUtilityTool('stopwatch'); } },
        { label: 'Rechner', action: function () { toggleUtilityTool('calculator'); } },
        { label: 'E6B Flight Computer', action: function () { toggleUtilityTool('e6b'); } }
      ]);
      missionMenu.insertAdjacentElement('afterend', toolsMenu);
      actions.appendChild(makeButton('ga-efb-host-state', 'Tracker wird verbunden', function () {}));
      if (!document.body.getAttribute('data-ga-host-menu-bound')) {
        document.body.setAttribute('data-ga-host-menu-bound', '1');
        document.addEventListener('click', function (event) {
          if (event.target && event.target.closest &&
              (event.target.closest('.ga-efb-host-menu') || event.target.closest('.ga-efb-host-menu-panel'))) return;
          closeHostMenus();
        });
      }
    }
    setupMissionActionBanner();

    var reset = actions && actions.querySelector('button[onclick="resetMainRoute()"]');
    if (reset) { reset.textContent = 'Route'; reset.disabled = true; reset.title = 'Read-only: Die Route kommt aus dem Tracker'; }
    var closeButtons = actions && actions.querySelectorAll('.pb-btn.close');
    if (closeButtons) Array.prototype.forEach.call(closeButtons, function (button) {
      if (button.parentNode) button.parentNode.removeChild(button);
    });
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
    applyTheme();
    setupInfoBoxes();
    setupSideDrawer();
    setupProfileResize();
  }

  function tileTemplateUrl(template, layer, coords) {
    var data = {
      r: L.Browser && L.Browser.retina ? '@2x' : '',
      s: layer && typeof layer._getSubdomain === 'function' ? layer._getSubdomain(coords) : '',
      x: coords.x,
      y: coords.y,
      z: coords.z
    };
    return L.Util.template(template, data);
  }

  function reportTileHealth(definition, state, sourceLabel, details) {
    var key = String(definition.id || 'layer') + ':' + state;
    var readyKey = String(definition.id || 'layer') + ':ready';
    if (state !== 'ready' && tileHealthReported[readyKey]) return;
    if (tileHealthReported[key]) return;
    tileHealthReported[key] = true;
    report(state === 'ready' ? 'info' : 'warn', 'map-tile', String(definition.id || 'layer'),
      state === 'ready' ? 'Kartenquelle sichtbar' : 'Kartenquelle nicht darstellbar',
      'source=' + String(sourceLabel || 'unknown') + (details ? ' ' + details : ''));
  }

  function createResilientTileLayer(definition, options) {
    var sources = [];
    [
      { url: definition.url, label: 'direct' },
      { url: definition.fallbackUrl, label: 'backup' },
      { url: definition.localUrl, label: 'tracker-proxy' }
    ].forEach(function (candidate) {
      var source = String(candidate.url || '').trim();
      var duplicate = sources.some(function (entry) { return entry.url === source; });
      if (source && !duplicate) sources.push({ url: source, label: candidate.label });
    });
    if (sources.length < 2 || !L.TileLayer || typeof L.TileLayer.extend !== 'function') {
      return L.tileLayer(sources.length ? sources[0].url : definition.url, options);
    }
    var ResilientLayer = L.TileLayer.extend({
      createTile: function (coords, done) {
        var layer = this;
        var tile = document.createElement('img');
        var sourceIndex = 0;
        var settled = false;
        var timeout = 0;
        tile.alt = '';
        tile.className = 'ga-efb-map-tile ga-efb-map-tile-' + String(definition.id || 'layer');
        tile.setAttribute('role', 'presentation');
        tile.setAttribute('decoding', 'async');

        function clearTimer() {
          if (!timeout) return;
          window.clearTimeout(timeout);
          timeout = 0;
        }
        function finish(error) {
          if (settled) return;
          settled = true;
          clearTimer();
          tile.onload = null;
          tile.onerror = null;
          var source = sources[sourceIndex] || {};
          if (error) reportTileHealth(definition, 'failed', source.label, String(error.message || error));
          else reportTileHealth(definition, 'ready', source.label, 'fallbacks=' + sourceIndex);
          done(error, tile);
        }
        function loadSource(index) {
          sourceIndex = index;
          clearTimer();
          tile.src = tileTemplateUrl(sources[sourceIndex].url, layer, coords);
          timeout = window.setTimeout(function () {
            if (sourceIndex + 1 < sources.length) loadSource(sourceIndex + 1);
            else finish(new Error('map_tile_timeout'));
          }, sourceIndex === 0 ? 5000 : 7000);
        }
        tile.onload = function () { finish(null); };
        tile.onerror = function () {
          if (sourceIndex + 1 < sources.length) loadSource(sourceIndex + 1);
          else finish(new Error('map_tile_failed'));
        };
        loadSource(0);
        return tile;
      }
    });
    return new ResilientLayer(sources[0].url, options);
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
    // The native EFB map renders direct HTTPS image tiles correctly, while the
    // same images served through the loopback proxy remain black in some
    // Coherent builds. Use the proven direct path first and retain the bounded
    // tracker proxy only as the final fallback.
    return createResilientTileLayer(definition, options);
  }

  function createStablePane(name, zIndex) {
    var pane = map.createPane(name);
    pane.style.zIndex = String(zIndex);
    pane.style.pointerEvents = 'none';
    return pane;
  }

  function overlayPaneName(definition) {
    var id = String(definition && definition.id || '').toLowerCase();
    return EFB_OVERLAY_PANES[id] || 'gaVfrPane';
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
    createStablePane('gaVfrPane', 280);
    createStablePane('gaOfficialChartPane', 310);
    createStablePane('gaWeatherPane', 340);
    createStablePane('gaRoutePane', 430);
    createStablePane('gaGeometryPane', 440);
    createStablePane('gaPreviewPane', 445);
    createStablePane('gaDrawingPane', 450);
    createStablePane('gaAircraftPane', 500);
    routeRenderer = L.svg ? L.svg({ pane: 'gaRoutePane' }) : null;
    geometryRenderer = L.svg ? L.svg({ pane: 'gaGeometryPane' }) : null;
    drawingRenderer = L.svg ? L.svg({ pane: 'gaDrawingPane' }) : null;

    var baseControl = {};
    var overlayControl = {};
    API.BASE_LAYERS.forEach(function (definition) {
      var layer = createTileLayer(definition, 'gaBasePane');
      baseLayers[definition.id] = layer;
      baseControl[definition.label] = layer;
    });
    API.OVERLAY_LAYERS.forEach(function (definition) {
      var layer = createTileLayer(definition, overlayPaneName(definition));
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
    map.on('contextmenu', function (event) {
      clearMapContextPress();
      mapContextSuppressClickUntil = Date.now() + 900;
      openMapContextInfo(event.latlng, 'contextmenu');
    });
    map.on('popupclose', function (event) {
      if (mapContextPopup && event && event.popup && event.popup !== mapContextPopup) return;
      mapContextPopup = null;
      mapContextState = null;
      mapContextRequestSeq += 1;
      if (mapContextPointLayer) {
        try { map.removeLayer(mapContextPointLayer); } catch (_) {}
        mapContextPointLayer = null;
      }
      document.body.classList.remove('ga-efb-context-open');
    });
    bindMapContextLongPress();
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
    var previousRouteLayer = routeLayer;
    var previousGeometryLayer = geometryLayer;
    var previousPreviewLayer = previewLayer;
    routeLayer = L.layerGroup();
    geometryLayer = L.layerGroup();
    previewLayer = L.layerGroup();
    previewLine = null;
    var waypoints = snapshot.route.waypoints;
    var latlngs = waypoints.map(function (point) { return [point.lat, point.lon]; });
    L.polyline(latlngs, { color: '#ff4444', opacity: 1, weight: 7, dashArray: '10,10', pane: 'gaRoutePane', renderer: routeRenderer || undefined }).addTo(routeLayer);
    waypoints.forEach(function (point, index) {
      var marker = L.marker([point.lat, point.lon], { icon: markerIcon(index), pane: 'gaRoutePane' }).addTo(routeLayer);
      marker.bindTooltip(point.name || ('WP ' + (index + 1)), { direction: 'top', offset: [0, -8], className: 'ga-route-label' });
    });
    var target = snapshot.missionGeometry && snapshot.missionGeometry.target;
    if (target) L.marker([target.lat, target.lon], { icon: targetIcon(), pane: 'gaGeometryPane' }).bindTooltip(target.name || 'Missionsziel').addTo(geometryLayer);
    var chain = snapshot.missionGeometry && snapshot.missionGeometry.poiChain || [];
    if (chain.length > 1) L.polyline(chain.map(function (point) { return [point.lat, point.lon]; }), { color: '#f2c12e', weight: 3, dashArray: '4,6', pane: 'gaGeometryPane', renderer: geometryRenderer || undefined }).addTo(geometryLayer);
    [previousRouteLayer, previousGeometryLayer, previousPreviewLayer].forEach(function (layer) {
      if (!layer || !map) return;
      try { layer.clearLayers(); } catch (_) {}
      try { map.removeLayer(layer); } catch (_) {}
    });
    routeLayer.addTo(map);
    geometryLayer.addTo(map);
    previewLayer.addTo(map);
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
      if (mapSnapshot && normalized.missionId !== mapSnapshot.missionId) profileCruiseOverride = null;
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
      ? [profile.mode || 'unknown', profile.terrainAvailable ? 'terrain' : 'no-terrain', profile.points ? profile.points.length : 0,
        profile.obstacles ? profile.obstacles.length : 0, profile.airspaces ? profile.airspaces.length : 0].join(':')
      : 'missing';
    if (profileDiagnostic !== lastProfileDiagnostic) {
      lastProfileDiagnostic = profileDiagnostic;
      report(profile && profile.terrainAvailable ? 'info' : 'warn', 'map-profile', profile ? profile.mode || 'unknown' : 'missing',
        profile && profile.terrainAvailable ? 'Terrainprofil vom Tracker aktiv' : 'Trackerprofil enthaelt noch keine Terraindaten',
        profile ? 'points=' + (profile.points ? profile.points.length : 0) +
          ' obstacles=' + (profile.obstacles ? profile.obstacles.length : 0) +
          ' airspaces=' + (profile.airspaces ? profile.airspaces.length : 0) : '');
    }
  }

  function missionRenderSignature(payload) {
    if (!payload) return 'none';
    var view = payload.view && typeof payload.view === 'object' ? payload.view : {};
    var flightView = view.flight && typeof view.flight === 'object' ? view.flight : {};
    return JSON.stringify({
      missionId: payload.missionId || '',
      runId: payload.runId || '',
      state: payload.state || '',
      phase: payload.phase || '',
      sceneCount: payload.sceneCount || 0,
      title: view.title || payload.title || '',
      story: view.story || payload.story || '',
      status: view.status || '',
      detail: view.detail || '',
      currentTask: view.currentTask || '',
      taskTone: view.taskTone || '',
      active: view.active !== false,
      domain: view.domain || '',
      domainLabel: view.domainLabel || '',
      phaseView: view.phase || null,
      target: view.target && typeof view.target === 'object' ? {
        name: view.target.name || '',
        route: view.target.route || ''
      } : null,
      progress: view.progress || [],
      requirements: view.requirements || [],
      feedback: view.feedback || [],
      voice: payload.voice || null,
      comfort: view.comfort || null,
      cargo: view.cargo || null,
      manifest: payload.manifest || null,
      ui: payload.ui || null,
      control: payload.control && typeof payload.control === 'object' ? {
        missionId: payload.control.missionId || '',
        runId: payload.control.runId || '',
        executionAuthority: payload.control.executionAuthority || '',
        phase: payload.control.phase || '',
        subphase: payload.control.subphase || '',
        nextStep: payload.control.nextStep || '',
        flags: payload.control.flags || null,
        cargo: payload.control.cargo || null,
        payload: payload.control.payload || null,
        voice: payload.control.voice || null,
        blockingReasons: payload.control.blockingReasons || [],
        allowedActions: payload.control.allowedActions || []
      } : null,
      trackerLive: flightView.trackerLive === true
    });
  }

  function missionActionBannerModel(payload) {
    if (!payload || payload.available === false || !payload.missionId) return null;
    var view = payload.view && typeof payload.view === 'object' ? payload.view : {};
    var control = payload.control && typeof payload.control === 'object' ? payload.control : null;
    if (!control || control.executionAuthority !== 'tracker') return null;
    var projected = payload.ui && payload.ui.schema === 'ga.mission-apt-ui.v1'
      && payload.ui.banner && typeof payload.ui.banner === 'object'
      ? payload.ui.banner
      : null;
    if (projected) return Object.assign({}, projected);
    var allowedActions = control && Array.isArray(control.allowedActions) ? control.allowedActions : [];
    var phase = String(control.phase || payload.phase || payload.state || '').toLowerCase();
    var task = String(view.currentTask || view.status || 'Mission fortsetzen');
    var model = null;
    if (allowedActions.indexOf('activate_cloud_mission') >= 0) {
      model = { kicker: 'Cloud-Mission bereit', text: task, button: 'Mission beginnen', kind: 'intent', intent: 'activate_cloud_mission', className: 'is-begin-action' };
    } else if (allowedActions.indexOf('request_close') >= 0) {
      model = { kicker: 'Mission abschließen', text: task, button: 'Mission beenden', kind: 'intent', intent: 'request_close', className: 'is-final-action' };
    } else if (allowedActions.indexOf('prepare_mission') >= 0) {
      model = { kicker: 'Mission bereit', text: task, button: 'Mission beginnen', kind: 'intent', intent: 'prepare_mission', className: 'is-begin-action' };
    } else if (allowedActions.indexOf('start_mission') >= 0) {
      model = { kicker: 'Mission startbereit', text: task, button: 'Mission starten', kind: 'intent', intent: 'start_mission', className: 'is-begin-action' };
    } else {
      var cargoAction = ['set_manifest_item', 'sign_manifest', 'clear_manifest_signature', 'confirm_load', 'confirm_pickup', 'confirm_unload'].some(function (intent) {
        return allowedActions.indexOf(intent) >= 0;
      });
      var manifestItems = payload.manifest && Array.isArray(payload.manifest.items) ? payload.manifest.items : [];
      var hasArrivalPassenger = manifestItems.some(function (item) {
        return item && item.itemType === 'passenger' && item.status === 'loaded' && item.delivery === 'destination';
      });
      var arrivalPaxAction = /^(end_unloading|end_ready)$/.test(phase)
        && hasArrivalPassenger
        && allowedActions.indexOf('request_pax_interaction') >= 0;
      if (cargoAction || arrivalPaxAction) {
        var arrival = /^(end_unloading|end_ready)$/.test(phase);
        model = {
          kicker: arrival ? 'Ankunftsaktion bereit' : (phase === 'on_task' ? 'Aktion am Ziel' : 'Boarding und Verladung'),
          text: task,
          button: arrival ? 'Entladung öffnen' : 'Verladung öffnen',
          kind: 'cargo',
          intent: '',
          className: arrival ? 'is-end-ready' : 'is-begin-action'
        };
      }
    }
    if (!model) return null;
    model.missionId = String(payload.missionId);
    model.revision = Number(control.authorityRevision || payload.revision || 0);
    model.key = [model.missionId, model.revision, phase, model.kind, model.intent].join(':');
    return model;
  }

  function setupMissionActionBanner() {
    var banner = byId('missionStartBanner');
    if (!banner || banner.getAttribute('data-ga-tracker-bound') === '1') return banner;
    banner.setAttribute('data-ga-tracker-bound', '1');
    window.openMissionToolbarCargo = function () {
      if (missionIntentPending) return false;
      openCargoManager();
      return false;
    };
    window.requestMissionRuntimeReset = function (options) {
      if (missionIntentPending) return Promise.resolve(false);
      var settings = options && typeof options === 'object' ? options : {};
      return requestMissionIntent('abort_mission', { reason: String(settings.reason || 'efb-toolbar-reset') });
    };
    window.handleMissionStartBannerAction = function () {
      var model = banner._gaMissionActionModel;
      if (!model || missionIntentPending) return false;
      if (model.kind === 'cargo') openCargoManager();
      else if (model.intent) requestMissionIntent(model.intent, {});
      else return false;
      report('info', 'mission-action-banner', model.kind, 'Missionsaktion über Kartenbanner ausgelöst', model.intent || 'cargo');
      return false;
    };
    window.dismissMissionStartBanner = function () {
      var model = banner._gaMissionActionModel;
      missionBannerDismissedKey = model ? model.key : '';
      banner.style.display = 'none';
      report('info', 'mission-action-banner', 'dismiss', 'Missionsbanner ausgeblendet', model ? model.key : '');
      return false;
    };
    return banner;
  }

  function missionToolbarProjection(payload) {
    var banner = missionActionBannerModel(payload);
    if (window.GAMissionControlUiCore && typeof window.GAMissionControlUiCore.missionToolbarModel === 'function') {
      return window.GAMissionControlUiCore.missionToolbarModel(payload, { banner: banner });
    }
    if (!payload || !payload.control || payload.control.executionAuthority !== 'tracker') return null;
    var allowed = Array.isArray(payload.control.allowedActions) ? payload.control.allowedActions : [];
    var active = !!(payload.missionId && payload.runId && allowed.indexOf('abort_mission') >= 0);
    return {
      primary: banner ? {
        kind: banner.kind,
        intent: banner.intent || '',
        label: banner.button || 'Mission fortsetzen',
        title: banner.text || banner.kicker || 'Aktuelle Missionsaktion ausführen',
        disabled: banner.disabled === true
      } : null,
      cargo: { visible: active, label: 'Verladung', title: 'Verlade-Manager mit dem aktuellen Tracker-Stand öffnen', disabled: false },
      reset: { visible: active, label: 'Mission Reset', title: 'Mission auf allen Ansichten zurücksetzen', disabled: false }
    };
  }

  function renderMissionToolbar(payload) {
    var model = missionToolbarProjection(payload);
    var primaryButton = byId('mapMissionToggleBtn');
    var cargoButton = byId('mapGroundCargoBtn');
    var resetButton = byId('mapMissionResetBtn');
    var primary = model && model.primary;
    if (primaryButton) {
      primaryButton.style.display = primary ? 'inline-flex' : 'none';
      if (primary) {
        var prefix = primary.kind === 'cargo' ? '📦 ' : (primary.intent === 'request_close' ? '■ ' : '▶ ');
        primaryButton.textContent = prefix + primary.label;
        primaryButton.title = primary.title;
        primaryButton.disabled = missionIntentPending || primary.disabled === true;
        primaryButton.classList.toggle('is-active', primary.intent === 'request_close');
      } else {
        primaryButton.classList.remove('is-active');
      }
    }
    if (cargoButton) {
      cargoButton.style.display = model && model.cargo && model.cargo.visible ? 'inline-flex' : 'none';
      cargoButton.disabled = missionIntentPending || !!(model && model.cargo && model.cargo.disabled);
      cargoButton.textContent = '📦 ' + String(model && model.cargo && model.cargo.label || 'Verladung');
      cargoButton.title = String(model && model.cargo && model.cargo.title || 'Verlade-Manager öffnen');
    }
    if (resetButton) {
      resetButton.style.display = model && model.reset && model.reset.visible ? 'inline-flex' : 'none';
      resetButton.disabled = missionIntentPending || !!(model && model.reset && model.reset.disabled);
      resetButton.textContent = '↺ ' + String(model && model.reset && model.reset.label || 'Mission Reset');
      resetButton.title = String(model && model.reset && model.reset.title || 'Mission zurücksetzen') + ' (mit Rückfrage)';
    }
  }

  function renderMissionActionBanner(payload) {
    var banner = setupMissionActionBanner();
    if (!banner) return;
    var model = missionActionBannerModel(payload);
    banner._gaMissionActionModel = model;
    banner.classList.remove('is-begin-action');
    banner.classList.remove('is-end-ready');
    banner.classList.remove('is-final-action');
    if (!model || model.key === missionBannerDismissedKey) {
      banner.style.display = 'none';
      return;
    }
    if (model.begin === true || model.className === 'is-begin-action') banner.classList.add('is-begin-action');
    if (model.endReady === true || model.className === 'is-end-ready') banner.classList.add('is-end-ready');
    if (model.final === true || model.className === 'is-final-action') banner.classList.add('is-final-action');
    banner.style.display = 'flex';
    banner.setAttribute('data-mission-id', model.missionId);
    banner.setAttribute('aria-label', model.kicker + ': ' + model.text + '. ' + model.button);
    setText('missionStartBannerKicker', model.kicker);
    setText('missionStartBannerText', missionIntentPending ? 'Tracker verarbeitet die Aktion ...' : model.text);
    setText('missionStartBannerBtn', missionIntentPending ? 'Bitte warten ...' : model.button);
    var button = byId('missionStartBannerBtn');
    if (button) button.disabled = missionIntentPending || model.disabled === true;
    var close = banner.querySelector ? banner.querySelector('.mission-start-banner-close') : null;
    if (close) close.style.display = model.closeHidden === true ? 'none' : '';
  }

  function updateMissionLiveFields(view) {
    if (!view || typeof view !== 'object') return;
    if (window.GAMissionControlUiCore && typeof window.GAMissionControlUiCore.projectLiveFields === 'function') {
      var shared = window.GAMissionControlUiCore.projectLiveFields(view);
      setText('gaEfbMissionTargetLine', coherentText(shared.targetLine));
      setText('gaEfbMissionAltitude', coherentText(shared.altitudeLine));
      setText('gaEfbMissionAltitudeDetail', coherentText(shared.altitudeDetail));
      return;
    }
    var target = view.target && typeof view.target === 'object' ? view.target : {};
    var live = view.flight && typeof view.flight === 'object' ? view.flight : {};
    var targetLine = target.distanceNm != null
      ? formatNumber(target.distanceNm, 1) + ' NM | ' + leftPad(Math.round(Number(target.bearingDeg) || 0), 3) + ' deg'
      : (live.trackerLive ? 'Zielposition offen' : 'Tracker wartet');
    var altitudeLine = live.mslFt != null ? Math.round(Number(live.mslFt) || 0) + ' ft MSL' : 'Keine Live-Höhe';
    var altitudeDetail = live.aglFt != null
      ? Math.round(Number(live.aglFt) || 0) + ' ft AGL'
      : (live.gsKts != null ? Math.round(Number(live.gsKts) || 0) + ' kt GS' : 'Live-Daten offen');
    setText('gaEfbMissionTargetLine', targetLine);
    setText('gaEfbMissionAltitude', altitudeLine);
    setText('gaEfbMissionAltitudeDetail', altitudeDetail);
  }

  function renderMissionPayload(payload) {
    var next = payload && payload.available === true ? payload : null;
    var view = next && next.view && typeof next.view === 'object' ? next.view : {};
    var signature = missionRenderSignature(next);
    var presentationSignature = JSON.stringify({
      mission: signature,
      intentPending: missionIntentPending === true,
      intentStatus: missionIntentStatus || '',
      intentTone: missionIntentTone || '',
      cargoManagerOpen: cargoManagerOpen === true
    });
    missionSnapshot = next;
    if (presentationSignature !== missionPresentationSignature) {
      missionPresentationSignature = presentationSignature;
      renderMissionActionBanner(next);
      renderMissionToolbar(next);
      renderCargoManager();
    }
    var drawer = byId('mapSideDrawer');
    var drawerOpen = drawer && drawer.classList.contains('is-open') && drawerView === 'mission';
    if (signature === missionSignature) {
      if (drawerOpen) updateMissionLiveFields(view);
      return;
    }
    missionSignature = signature;
    var button = document.querySelector('.ga-efb-host-mission');
    if (button) button.textContent = next && next.missionId ? 'Mission: ' + String(next.phase || next.state || 'aktiv').slice(0, 14) : 'Mission';
    if (drawerOpen) requestSideDrawerRefresh();
    report('info', 'mission-panel', next ? 'active' : 'empty', next ? 'Missionsstatus vom Tracker aktualisiert' : 'Keine aktive Tracker-Mission', next ? String(next.missionId || '') : '');
  }

  function renderChecklistPayload(payload) {
    var next = payload && payload.available === true && Array.isArray(payload.checklists)
      ? payload
      : { revision: 0, updatedAt: 0, checklists: [] };
    var signature = [next.revision || 0, JSON.stringify(next.checklists)].join('|');
    trackerChecklistLibrary = next;
    if (signature === checklistLibrarySignature) return;
    checklistLibrarySignature = signature;
    if (drawerChecklistId && !allEfbChecklists().some(function (checklist) { return checklist.id === drawerChecklistId; })) {
      drawerChecklistId = '';
    }
    var drawer = byId('mapSideDrawer');
    if (drawer && drawer.classList.contains('is-open') && drawerView === 'checklists') {
      requestSideDrawerRefresh();
    }
    report('info', 'checklist-library', 'loaded', 'Eigene Checklisten vom Tracker geladen', 'count=' + next.checklists.length + ' revision=' + (next.revision || 0));
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
    if (bar) bar.style.display = 'grid';
    setInfoBoxAvailability('liveNextWpBox', !!next);
    var distance = routeProgressTarget === 'route' ? navigation.remainingDistanceNm : selected.distanceNm;
    var gs = flight ? flight.gsKts : 0;
    var context = mapSnapshot && mapSnapshot.context || {};
    setText('routeProgressPos', context.position || (formatNumber(navigation.routeDistanceNm, 1) + ' NM'));
    setText('routeProgressDst', formatNumber(distance, 1) + ' NM');
    setText('routeProgressEta', etaText(distance, gs));
    setText('routeProgressDur', durationText(distance, gs));
    setText('routeProgressFreq', context.frequency || '--');
    setText('currentFreqValue', context.frequency || '\u2014');
    setText('currentFreqSource', context.frequencySource || '');
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

  function profileTerrainAt(points, distanceNm) {
    if (!points || !points.length) return 0;
    if (distanceNm <= points[0].distanceNm) return Math.max(0, finite(points[0].terrainFt) || 0);
    for (var index = 1; index < points.length; index += 1) {
      var previous = points[index - 1];
      var next = points[index];
      if (distanceNm > next.distanceNm) continue;
      var span = Math.max(0.001, next.distanceNm - previous.distanceNm);
      var progress = clamp((distanceNm - previous.distanceNm) / span, 0, 1);
      var first = Math.max(0, finite(previous.terrainFt) || 0);
      var second = Math.max(0, finite(next.terrainFt) || 0);
      return first + (second - first) * progress;
    }
    return Math.max(0, finite(points[points.length - 1].terrainFt) || 0);
  }

  function colorWithAlpha(color, alpha) {
    var value = String(color || '').replace('#', '');
    if (value.length === 3) value = value.charAt(0) + value.charAt(0) + value.charAt(1) + value.charAt(1) + value.charAt(2) + value.charAt(2);
    if (!/^[0-9a-f]{6}$/i.test(value)) return 'rgba(77,166,255,' + alpha + ')';
    return 'rgba(' + parseInt(value.slice(0, 2), 16) + ',' + parseInt(value.slice(2, 4), 16) + ',' + parseInt(value.slice(4, 6), 16) + ',' + alpha + ')';
  }

  function setupProfileResize() {
    var handle = byId('profileResizeHandle');
    var strip = byId('mapProfileStrip');
    if (!handle || !strip || handle.getAttribute('data-ga-resize-bound') === '1') return;
    handle.setAttribute('data-ga-resize-bound', '1');
    try {
      var savedHeight = Number(localStorage.getItem(EFB_PROFILE_HEIGHT_KEY));
      if (savedHeight >= 90) {
        strip.style.height = savedHeight + 'px';
        strip.style.flexBasis = savedHeight + 'px';
      }
    } catch (_) {}
    var startY = 0;
    var startHeight = 0;
    function clientY(event) {
      var source = event && event.touches && event.touches.length ? event.touches[0] : event;
      return source ? Number(source.clientY) : 0;
    }
    function begin(event) {
      if (event.preventDefault) event.preventDefault();
      startY = clientY(event);
      startHeight = strip.getBoundingClientRect().height;
      profileResizeActive = true;
      document.body.classList.add('ga-profile-resizing');
      try { if (event.pointerId != null && handle.setPointerCapture) handle.setPointerCapture(event.pointerId); } catch (_) {}
    }
    function move(event) {
      if (!profileResizeActive) return;
      if (event.preventDefault) event.preventDefault();
      var hostHeight = document.documentElement.clientHeight || window.innerHeight || 700;
      var nextHeight = clamp(startHeight + startY - clientY(event), 90, Math.max(120, hostHeight * 0.65));
      strip.style.height = Math.round(nextHeight) + 'px';
      strip.style.flexBasis = Math.round(nextHeight) + 'px';
      if (map) map.invalidateSize(false);
      renderProfile();
    }
    function finish(event) {
      if (!profileResizeActive) return;
      profileResizeActive = false;
      document.body.classList.remove('ga-profile-resizing');
      try { localStorage.setItem(EFB_PROFILE_HEIGHT_KEY, String(Math.round(strip.getBoundingClientRect().height))); } catch (_) {}
      try { if (event && event.pointerId != null && handle.releasePointerCapture) handle.releasePointerCapture(event.pointerId); } catch (_) {}
      if (map) map.invalidateSize(false);
      renderProfile();
      report('info', 'map-profile', 'resize', 'Profilhoehe geaendert', String(Math.round(strip.getBoundingClientRect().height)));
    }
    if (window.PointerEvent) {
      handle.addEventListener('pointerdown', begin, false);
      handle.addEventListener('pointermove', move, false);
      handle.addEventListener('pointerup', finish, false);
      handle.addEventListener('pointercancel', finish, false);
    } else {
      handle.addEventListener('mousedown', begin, false);
      window.addEventListener('mousemove', move, false);
      window.addEventListener('mouseup', finish, false);
      handle.addEventListener('touchstart', begin, false);
      window.addEventListener('touchmove', move, false);
      window.addEventListener('touchend', finish, false);
    }
  }

  function renderProfile() {
    var wrapper = byId('vpCanvasWrapper');
    var scroll = byId('mapProfileScroll');
    var background = byId('mapProfileCanvasBg');
    var foreground = byId('mapProfileCanvas');
    if (!wrapper || !background || !foreground || document.body.classList.contains('profile-hidden')) return;
    var viewportWidth = Math.max(280, scroll ? scroll.clientWidth : wrapper.clientWidth || 0);
    var width = Math.round(viewportWidth * (1 + profileZoom / 100));
    wrapper.style.width = width + 'px';
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
    var airspaces = profile.airspaces || [];
    var obstacles = profile.obstacles || [];
    var maxDistance = Math.max(1, finite(profile.totalDistanceNm) || finite(points[points.length - 1].distanceNm) || 1);
    var cruiseAltitude = profileCruiseOverride == null ? Math.max(0, finite(profile.cruiseAltitudeFt) || 0) : profileCruiseOverride;
    var maxAlt = Math.max(cruiseAltitude, flight ? flight.altFt : 0, 1000);
    points.forEach(function (point) { maxAlt = Math.max(maxAlt, point.plannedAltFt || 0, point.terrainFt || 0); });
    airspaces.forEach(function (entry) {
      var middle = (entry.startDistanceNm + entry.endDistanceNm) / 2;
      var terrain = entry.upperAgl ? profileTerrainAt(points, middle) : 0;
      maxAlt = Math.max(maxAlt, (entry.upperFt || 0) + terrain);
    });
    obstacles.forEach(function (entry) { maxAlt = Math.max(maxAlt, profileTerrainAt(points, entry.distanceNm) + (entry.heightFt || 0)); });
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
    airspaces.forEach(function (entry) {
      var middle = (entry.startDistanceNm + entry.endDistanceNm) / 2;
      var terrain = profileTerrainAt(points, middle);
      var lower = Math.max(0, entry.lowerFt || 0) + (entry.lowerAgl ? terrain : 0);
      var upper = Math.max(lower, Math.max(0, entry.upperFt || 0) + (entry.upperAgl ? terrain : 0));
      var firstX = x(entry.startDistanceNm);
      var lastX = x(entry.endDistanceNm);
      bg.fillStyle = colorWithAlpha(entry.color, 0.16);
      bg.strokeStyle = colorWithAlpha(entry.color, 0.68);
      bg.lineWidth = 1;
      bg.fillRect(firstX, y(upper), Math.max(1, lastX - firstX), Math.max(1, y(lower) - y(upper)));
      bg.strokeRect(firstX, y(upper), Math.max(1, lastX - firstX), Math.max(1, y(lower) - y(upper)));
      if (lastX - firstX > 45) {
        bg.fillStyle = colorWithAlpha(entry.color, 0.92);
        bg.textAlign = 'center';
        bg.font = '8px Arial';
        bg.fillText(String(entry.name || entry.type || 'Luftraum').slice(0, 18), (firstX + lastX) / 2, y(upper) + 10);
      }
    });
    if (profile.terrainAvailable) {
      fg.beginPath(); fg.moveTo(x(points[0].distanceNm), y(0));
      points.forEach(function (point) { fg.lineTo(x(point.distanceNm), y(point.terrainFt || 0)); });
      fg.lineTo(x(points[points.length - 1].distanceNm), y(0)); fg.closePath();
      fg.fillStyle = 'rgba(62,112,54,.9)'; fg.fill();
    }
    fg.beginPath();
    points.forEach(function (point, index) {
      var planned = profileCruiseOverride == null ? point.plannedAltFt : Math.min(point.plannedAltFt || cruiseAltitude, cruiseAltitude);
      if (index > 0 && index < points.length - 1 && profileCruiseOverride != null) planned = cruiseAltitude;
      if (index === 0) fg.moveTo(x(point.distanceNm), y(planned)); else fg.lineTo(x(point.distanceNm), y(planned));
    });
    fg.strokeStyle = '#ff4a4a'; fg.lineWidth = 2.5; fg.stroke();
    obstacles.forEach(function (entry) {
      var obstacleX = x(entry.distanceNm);
      var ground = profileTerrainAt(points, entry.distanceNm);
      var topAltitude = ground + Math.max(0, entry.heightFt || 0);
      var groundY = y(ground);
      var trueTopY = y(topAltitude);
      var topY = Math.min(groundY - 8, trueTopY);
      var type = String(entry.type || 'obstacle').toLowerCase();
      fg.save();
      fg.strokeStyle = '#fff4cf';
      fg.fillStyle = '#ffb52e';
      fg.lineWidth = 1.4;
      fg.shadowColor = 'rgba(0,0,0,.8)';
      fg.shadowBlur = 2;
      if (type === 'wind' || type.indexOf('wind') >= 0) {
        var hubY = Math.min(groundY - 5, topY + 4);
        var radius = Math.max(4, Math.min(8, (groundY - topY) * 0.42));
        fg.beginPath(); fg.moveTo(obstacleX, groundY); fg.lineTo(obstacleX, hubY); fg.stroke();
        for (var blade = 0; blade < 3; blade += 1) {
          var angle = (-90 + blade * 120) * Math.PI / 180;
          fg.beginPath(); fg.moveTo(obstacleX, hubY); fg.lineTo(obstacleX + Math.cos(angle) * radius, hubY + Math.sin(angle) * radius); fg.stroke();
        }
        fg.beginPath(); fg.arc(obstacleX, hubY, 1.8, 0, Math.PI * 2); fg.fill();
      } else if (type === 'power_tower' || type.indexOf('power') >= 0) {
        var half = Math.max(3, Math.min(6, (groundY - topY) * 0.22));
        fg.beginPath(); fg.moveTo(obstacleX, topY); fg.lineTo(obstacleX - half, groundY); fg.moveTo(obstacleX, topY); fg.lineTo(obstacleX + half, groundY); fg.moveTo(obstacleX - half, groundY); fg.lineTo(obstacleX + half, groundY); fg.stroke();
        [0.3, 0.58].forEach(function (fraction) {
          var crossY = topY + (groundY - topY) * fraction;
          fg.beginPath(); fg.moveTo(obstacleX - half - 2, crossY); fg.lineTo(obstacleX + half + 2, crossY); fg.stroke();
        });
      } else {
        fg.beginPath(); fg.moveTo(obstacleX, groundY); fg.lineTo(obstacleX, topY); fg.stroke();
        fg.beginPath(); fg.moveTo(obstacleX - 3, topY + 4); fg.lineTo(obstacleX, topY); fg.lineTo(obstacleX + 3, topY + 4); fg.stroke();
        if ((entry.heightFt || 0) >= 250) {
          var middleY = topY + (groundY - topY) * 0.46;
          fg.beginPath(); fg.moveTo(obstacleX - 4, middleY); fg.lineTo(obstacleX + 4, middleY); fg.stroke();
        }
      }
      if ((entry.heightFt || 0) >= 180 && width > 520) {
        fg.shadowBlur = 0;
        fg.fillStyle = '#ffcf54';
        fg.font = '7px Arial';
        fg.textAlign = 'center';
        fg.fillText(Math.round(entry.heightFt) + 'ft', obstacleX, Math.max(8, topY - 3));
      }
      fg.restore();
    });
    fg.fillStyle = '#b8cbd5'; fg.font = '8px Arial'; fg.textAlign = 'center';
    points.forEach(function (point) { fg.fillText(String(point.name || '').slice(0, 8), x(point.distanceNm), height - 4); });
    var position = mapSnapshot && mapSnapshot.navigation ? mapSnapshot.navigation.routeDistanceNm : 0;
    if (flight) {
      fg.fillStyle = '#f2dc32';
      fg.beginPath(); fg.moveTo(x(position), y(flight.altFt) - 5); fg.lineTo(x(position) - 6, y(flight.altFt) + 5); fg.lineTo(x(position) + 6, y(flight.altFt) + 5); fg.closePath(); fg.fill();
    }
    setText('altMapInput', Math.round(cruiseAltitude));
    setText('rateMapInput', Math.round(profileVerticalRate));
    setText('yAxisDisplay', profileYAxis > 0 ? profileYAxis : 'AUTO');
    setText('vpZoomDisplay', profileZoom + '%');
  }

  function setDrawMode(mode) {
    if (mode && contextPickActive) {
      contextPickActive = false;
      var contextButton = document.querySelector('.ga-efb-host-context');
      if (contextButton) {
        contextButton.classList.remove('active');
        contextButton.textContent = 'Was ist hier';
      }
    }
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

  function nearestProfilePoint(latlng) {
    var profile = mapSnapshot && mapSnapshot.profile;
    var points = profile && profile.points || [];
    var best = null;
    var bestDistance = Infinity;
    points.forEach(function (point) {
      if (!isFiniteNumber(point.lat) || !isFiniteNumber(point.lon)) return;
      var distance = map.distance(latlng, [point.lat, point.lon]);
      if (distance >= bestDistance) return;
      bestDistance = distance;
      best = point;
    });
    return best;
  }

  function mapContextRadiusNm(latlng) {
    if (!map || !latlng) return 3;
    try {
      var anchor = map.latLngToContainerPoint(latlng);
      var edge = map.containerPointToLatLng(L.point(anchor.x + 38, anchor.y));
      return clamp(map.distance(latlng, edge) / 1852, 0.25, 12);
    } catch (_) { return 3; }
  }

  function mapContextNumber(value) {
    return value === null || typeof value === 'undefined' || value === '' ? null : finite(value);
  }

  function mapContextHeightMarkup(data, loading) {
    var context = data || {};
    var terrainFtValue = finite(context.terrainFt);
    var terrainFt = Math.max(0, terrainFtValue == null ? 0 : terrainFtValue);
    var ownAltitudeValue = finite(context.currentAltitudeFt);
    var ownAltitudeFt = Math.max(0, ownAltitudeValue == null ? (finite(flight && flight.altFt) || 0) : ownAltitudeValue);
    var airspaces = context.airspaces && context.airspaces.length ? context.airspaces : [];
    var cloud = context.cloud || null;
    var highest = Math.max(5000, terrainFt + 1500, ownAltitudeFt + 1000, finite(cloud && cloud.topFt) || 0);
    airspaces.forEach(function (entry) { highest = Math.max(highest, (finite(entry.upperFt) || 0) + 500); });
    var step = highest <= 15000 ? 1000 : (highest <= 25000 ? 2500 : 5000);
    var maxFt = Math.min(60000, Math.ceil(highest * 1.08 / step) * step);
    function top(value) { return clamp(100 - Math.max(0, Number(value) || 0) / maxFt * 100, 0, 100); }
    var ticks = '';
    for (var index = 0; index <= 4; index += 1) {
      var value = maxFt * index / 4;
      ticks += '<span style="bottom:' + (index * 25) + '%">' + (value >= 10000 ? Math.round(value / 1000) + 'k' : Math.round(value).toLocaleString('de-DE')) + '</span>';
    }
    var bandLabels = '';
    var bands = airspaces.map(function (entry, index) {
      var lower = Math.max(0, finite(entry.lowerFt) || 0);
      var upper = Math.max(lower + 100, finite(entry.upperFt) || maxFt);
      var bandTop = top(upper);
      var bandHeight = Math.max(2.8, top(lower) - bandTop);
      var label = entry.type === 4 ? 'CTR' : (entry.classLetter || entry.descriptor || 'AS');
      var fullName = String(entry.name || 'Luftraum');
      var nameParts = fullName.split('\u00b7');
      var shortName = String(nameParts.length > 1 ? nameParts.slice(1).join(' ') : fullName).trim().slice(0, 16);
      var labelTop = clamp(bandTop + (bandHeight / 2), 2, 98);
      bandLabels += '<span class="ga-efb-context-height-airspace-label" style="top:' + labelTop.toFixed(2) + '%;--ga-context-color:' + drawerEscape(entry.color || '#4da6ff') + '" title="' + drawerEscape(fullName) + '">' +
        '<b><i>' + (index + 1) + '</i>' + drawerEscape(label) + '</b><small>' + drawerEscape(shortName) + '</small></span>';
      return '<i class="ga-efb-context-height-airspace" style="top:' + bandTop.toFixed(2) + '%;height:' + bandHeight.toFixed(2) + '%;--ga-context-color:' + drawerEscape(entry.color || '#4da6ff') + '" title="' + drawerEscape(fullName) + '"></i>';
    }).join('');
    var cloudMarkup = '';
    if (cloud && finite(cloud.baseFt) != null && finite(cloud.topFt) != null) {
      var cloudTop = top(cloud.topFt);
      var cloudHeight = Math.max(2, top(cloud.baseFt) - cloudTop);
      cloudMarkup = '<i class="ga-efb-context-height-cloud" style="top:' + cloudTop.toFixed(2) + '%;height:' + cloudHeight.toFixed(2) + '%"><b>' + drawerEscape(cloud.type || 'CLD') + '</b></i>';
    }
    var weather = context.weather || {};
    var precipitation = (finite(weather.rainMm) || 0) > 0.1 || (finite(weather.snowfallCm) || 0) > 0.05
      ? '<i class="ga-efb-context-height-precipitation" style="top:' + (cloud && finite(cloud.baseFt) != null ? top(cloud.baseFt).toFixed(2) : '48') + '%"></i>'
      : '';
    var terrainHeight = Math.max(2.2, 100 - top(terrainFt));
    var ownship = ownAltitudeFt > 0
      ? '<i class="ga-efb-context-height-ownship" style="top:' + top(ownAltitudeFt).toFixed(2) + '%" title="Eigene Hoehe ' + Math.round(ownAltitudeFt) + ' ft"></i>'
      : '';
    var feature = context.feature;
    var featureHeight = feature && finite(feature.elevationFt) != null ? feature.elevationFt : terrainFt;
    var featureMarker = feature
      ? '<i class="ga-efb-context-height-feature" style="top:' + top(featureHeight).toFixed(2) + '%"><b>' + (feature.kind === 'airport' ? 'APT' : (feature.kind === 'vrp' ? 'VRP' : 'NAV')) + '</b></i>'
      : '';
    return '<div class="ga-efb-context-height' + (loading ? ' is-loading' : '') + '">' +
      '<div class="ga-efb-context-height-title">HOEHE<small>FT MSL</small></div>' +
      '<div class="ga-efb-context-height-scale">' + ticks + '</div>' +
      '<div class="ga-efb-context-height-plot">' + cloudMarkup + precipitation + bands + bandLabels + ownship + featureMarker +
        '<i class="ga-efb-context-height-terrain" style="height:' + terrainHeight.toFixed(2) + '%"></i>' +
        '<em style="bottom:' + Math.min(94, terrainHeight + 1).toFixed(2) + '%">' + (terrainFtValue == null ? 'GND' : Math.round(terrainFt) + ' ft') + '</em>' +
        (loading ? '<span class="ga-efb-context-loading">LAEDT</span>' : '') +
      '</div></div>';
  }

  function mapContextFlightCategory(data) {
    var weather = data && data.weather || {};
    var visibilityM = mapContextNumber(weather.visibilityM);
    var terrainFt = mapContextNumber(data && data.terrainFt) || 0;
    var cloudBaseFt = mapContextNumber(data && data.cloud && data.cloud.baseFt);
    var ceilingAglFt = cloudBaseFt == null ? null : Math.max(0, cloudBaseFt - terrainFt);
    if ((visibilityM != null && visibilityM < 1600) || (ceilingAglFt != null && ceilingAglFt < 500)) return 'LIFR';
    if ((visibilityM != null && visibilityM < 5000) || (ceilingAglFt != null && ceilingAglFt < 1000)) return 'IFR';
    if ((visibilityM != null && visibilityM < 8000) || (ceilingAglFt != null && ceilingAglFt < 3000)) return 'MVFR';
    return 'VFR';
  }

  function mapContextAirportWidgetMarkup(feature, data, loading) {
    var title = [feature.icao, feature.name].filter(Boolean).join(' | ');
    var distance = mapContextNumber(feature.distanceNm);
    var bearing = mapContextNumber(feature.bearingDeg);
    var positionText = distance == null ? 'AM KARTENPUNKT' : distance.toFixed(2) + ' NM | ' + leftPad(Math.round(bearing || 0), 3) + ' deg';
    var runways = feature.runways && feature.runways.length
      ? feature.runways.map(function (runway) {
        var details = [];
        if (mapContextNumber(runway.lengthM) != null) details.push(Math.round(runway.lengthM) + ' m');
        if (runway.surface) details.push(runway.surface);
        return '<div class="ga-efb-airport-row"><b>RWY</b><strong>' + drawerEscape(runway.designator || 'Piste') + '</strong><span>' + drawerEscape(details.join(' | ') || 'Details nicht verfuegbar') + '</span></div>';
      }).join('')
      : '<div class="ga-efb-airport-row is-muted"><b>RWY</b><span>Keine Pistendetails verfuegbar</span></div>';
    var frequencies = feature.frequencies && feature.frequencies.length
      ? feature.frequencies.map(function (entry) {
        return '<div class="ga-efb-airport-row"><b>COM</b><strong>' + drawerEscape(entry.label || 'FREQ') + '</strong><span>' + drawerEscape(entry.value || '-') + '</span></div>';
      }).join('')
      : '<div class="ga-efb-airport-row is-muted"><b>COM</b><span>Keine Frequenzdaten verfuegbar</span></div>';
    return '<section class="ga-efb-context-airport-widget"><header><small>FLUGPLATZ | VOLLANSICHT</small><strong>' + drawerEscape(title || 'Flugplatz') + '</strong></header>' +
      '<div class="ga-efb-airport-sheet"><div class="ga-efb-airport-identity"><b>' + drawerEscape(feature.icao || 'APT') + '</b><span>' + drawerEscape(feature.name || 'Flugplatz') + '</span></div>' +
      '<div class="ga-efb-airport-metrics"><span><small>HOEHE</small><b>' + (mapContextNumber(feature.elevationFt) == null ? '-' : Math.round(feature.elevationFt) + ' ft MSL') + '</b></span>' +
      '<span><small>ENTFERNUNG</small><b>' + drawerEscape(positionText) + '</b></span></div>' + runways + frequencies + '</div>' +
      mapContextWeatherMarkup(data, loading, feature) + '</section>';
  }

  function mapContextFeatureMarkup(feature, data, loading) {
    if (!feature) return '';
    if (feature.kind === 'airport') return mapContextAirportWidgetMarkup(feature, data, loading);
    var title = feature.kind === 'airport'
      ? [feature.icao, feature.name].filter(Boolean).join(' | ')
      : [feature.identifier, feature.name].filter(Boolean).join(' | ');
    var details = [];
    if (finite(feature.distanceNm) != null) details.push(feature.distanceNm.toFixed(2) + ' NM | ' + leftPad(Math.round(feature.bearingDeg || 0), 3) + ' deg');
    if (feature.typeLabel) details.push(feature.typeLabel);
    if (finite(feature.elevationFt) != null) details.push(Math.round(feature.elevationFt) + ' ft MSL');
    if (feature.airportIcao) details.push('Zugehoeriger Flugplatz ' + feature.airportIcao);
    if (feature.description) details.push(feature.description);
    if (feature.runways && feature.runways.length) {
      details.push('RWY ' + feature.runways.map(function (runway) {
        var suffix = [];
        if (finite(runway.lengthM) != null) suffix.push(Math.round(runway.lengthM) + ' m');
        if (runway.surface) suffix.push(runway.surface);
        return runway.designator + (suffix.length ? ' | ' + suffix.join(' | ') : '');
      }).join('; '));
    }
    if (feature.frequencies && feature.frequencies.length) {
      details.push(feature.frequencies.map(function (entry) { return entry.label + ' ' + entry.value; }).join(' | '));
    }
    if (feature.channel) details.push('Kanal ' + feature.channel);
    return '<section class="ga-efb-context-feature"><small>' + drawerEscape(feature.kindLabel || 'OBJEKT AM PUNKT') + '</small>' +
      '<strong>' + drawerEscape(title || 'Luftfahrtobjekt') + '</strong>' +
      details.map(function (detail) { return '<span>' + drawerEscape(detail) + '</span>'; }).join('') + '</section>';
  }

  function mapContextAirspacesMarkup(data, loading) {
    if (loading) return '<div class="ga-efb-context-muted ga-efb-context-busy">Luftraeume werden am Kartenpunkt geprueft...</div>';
    var airspaces = data && data.airspaces || [];
    if (!airspaces.length) {
      var available = data && data.sources && data.sources.aviation && data.sources.aviation.available;
      return '<div class="ga-efb-context-muted">' + (available ? 'Kein relevanter OpenAIP-Luftraum an diesem Punkt gefunden.' : 'Luftraumdaten derzeit nicht verfuegbar.') + '</div>';
    }
    return '<div class="ga-efb-context-airspaces">' + airspaces.map(function (entry, index) {
      var frequencies = entry.frequencies && entry.frequencies.length
        ? '<span class="ga-efb-context-airspace-frequencies">' + entry.frequencies.map(function (frequency) {
          return '<i><em>' + drawerEscape(frequency.label) + '</em><b>' + drawerEscape(frequency.value) + '</b></i>';
        }).join('') + '</span>'
        : '<small>FUNK -</small>';
      return '<span style="--ga-context-color:' + drawerEscape(entry.color || '#4da6ff') + '"><b><i>' + (index + 1) + '</i>' + drawerEscape(entry.name || 'Luftraum') + '</b>' +
        '<small>' + drawerEscape((entry.category || 'Luftraum') + ' | ' + (entry.lowerLabel || '?') + '-' + (entry.upperLabel || '?')) + '</small>' +
        frequencies + (entry.activation ? '<small>' + drawerEscape(entry.activation) + '</small>' : '') + '</span>';
    }).join('') + '<div class="ga-efb-context-source">Zeiten ggf. in AIP/NOTAM pruefen.</div></div>';
  }

  function mapContextWeatherMarkup(data, loading, airportFeature) {
    if (loading) return '<div class="ga-efb-context-muted ga-efb-context-busy">Punktwetter wird geladen...</div>';
    var weather = data && data.weather;
    if (!weather) return '<div class="ga-efb-context-muted">Punktwetter derzeit nicht verfuegbar.</div>';
    var windDir = mapContextNumber(weather.wdir);
    var windKt = mapContextNumber(weather.wspd);
    var visibility = mapContextNumber(weather.visibilityM);
    var pressure = mapContextNumber(weather.pressureMslHpa);
    var dewPoint = mapContextNumber(weather.dewPoint2mC);
    var category = mapContextFlightCategory(data);
    var windText = windDir != null && windKt != null
      ? (windKt <= 0.4 ? 'CALM | 0 kt' : leftPad(Math.round(windDir), 3) + ' deg / ' + Math.round(windKt) + ' kt')
      : '-';
    var runway = airportFeature && airportFeature.runways && airportFeature.runways[0];
    var runwayMatch = runway && String(runway.designator || '').toUpperCase().match(/^(0?[1-9]|[12][0-9]|3[0-6])([LRC]?)\s*\/\s*(0?[1-9]|[12][0-9]|3[0-6])([LRC]?)$/);
    var runwayLayer = '';
    if (runwayMatch) {
      var runwayHeading = parseInt(runwayMatch[1], 10) * 10;
      var runwayEnd1 = leftPad(parseInt(runwayMatch[1], 10), 2) + runwayMatch[2];
      var runwayEnd2 = leftPad(parseInt(runwayMatch[3], 10), 2) + runwayMatch[4];
      runwayLayer = '<g class="ga-efb-context-runway" transform="rotate(' + runwayHeading + ' 50 50)">' +
        '<rect x="42" y="14" width="16" height="72" rx="2"></rect>' +
        '<line x1="50" y1="25" x2="50" y2="75"></line>' +
        '<text x="50" y="23" transform="rotate(180 50 20)">' + drawerEscape(runwayEnd2) + '</text>' +
        '<text x="50" y="83">' + drawerEscape(runwayEnd1) + '</text></g>';
    }
    var windLayer = windDir != null && windKt > 0.4
      ? '<g class="ga-efb-context-wind-arrow" transform="rotate(' + windDir + ' 50 50)"><line x1="50" y1="8" x2="50" y2="45"></line><polygon points="44,38 50,53 56,38"></polygon></g>'
      : '<text class="ga-efb-context-calm" x="50" y="54">CALM</text>';
    var rose = '<div class="ga-efb-context-windrose"><svg viewBox="0 0 100 100" aria-hidden="true">' +
      runwayLayer + windLayer +
      '<text class="ga-efb-context-cardinal" x="50" y="10">N</text><text class="ga-efb-context-cardinal" x="91" y="53">O</text>' +
      '<text class="ga-efb-context-cardinal" x="50" y="96">S</text><text class="ga-efb-context-cardinal" x="9" y="53">W</text></svg></div>';
    return '<div class="ga-efb-context-weather"><header><b>' + (airportFeature ? 'PUNKTWETTER | ' + drawerEscape(airportFeature.icao || 'APT') : 'PUNKTWETTER') + '</b><span class="ga-efb-flight-category is-' + category.toLowerCase() + '">' + category + '</span></header><div class="ga-efb-context-weather-body">' +
      '<div class="ga-efb-context-weather-values">' +
        '<span><small>WIND</small><b class="is-wind">' + drawerEscape(windText) + '</b></span>' +
        '<span><small>SICHT</small><b>' + (visibility == null ? '-' : (visibility / 1000 >= 10 ? Math.round(visibility / 1000) : (visibility / 1000).toFixed(1)) + ' km') + '</b></span>' +
        '<span><small>TEMP</small><b>' + (finite(weather.temp2mC) == null ? '-' : Math.round(weather.temp2mC) + ' C') + '</b></span>' +
        '<span><small>TAUPUNKT</small><b>' + (dewPoint == null ? '-' : Math.round(dewPoint) + ' C') + '</b></span>' +
        '<span><small>QNH</small><b>' + (pressure == null ? '-' : Math.round(pressure) + ' hPa') + '</b></span>' +
        '<span><small>BEDECKUNG</small><b>' + (finite(weather.cloudTotalPct) == null ? '-' : Math.round(weather.cloudTotalPct) + ' %') + '</b></span>' +
        '<span class="is-wide"><small>WOLKEN L/M/H</small><b>' + [weather.cloudLowPct, weather.cloudMidPct, weather.cloudHighPct].map(function (value) { return finite(value) == null ? '-' : Math.round(value); }).join('/') + ' %</b></span>' +
      '</div>' + rose + '</div><footer>OPEN-METEO | AKTUELLER STUNDENWERT AM KARTENPUNKT</footer></div>';
  }

  function bindMapContextClose() {
    window.setTimeout(function () {
      var close = document.querySelector('.ga-efb-context-close');
      if (!close) return;
      close.onclick = function (event) {
        if (event && event.preventDefault) event.preventDefault();
        if (event && event.stopPropagation) event.stopPropagation();
        if (map) map.closePopup();
      };
    }, 0);
  }

  function renderMapContextInfo(state) {
    if (!state || state !== mapContextState || !mapContextPopup) return;
    var data = state.data || {};
    var terrainFt = finite(data.terrainFt);
    var terrainText = terrainFt == null
      ? (state.loading ? 'wird geladen...' : 'nicht verfuegbar')
      : Math.round(terrainFt) + ' ft MSL / ' + Math.round(terrainFt / 3.28084) + ' m';
    var airportFeature = data.feature && data.feature.kind === 'airport';
    var details = mapContextFeatureMarkup(data.feature, data, state.loading) +
      '<section><h4>LUFTRAEUME</h4>' + mapContextAirspacesMarkup(data, state.loading) + '</section>' +
      '<section><h4>PUNKT</h4><div class="ga-efb-context-summary"><span><b>Gelaende</b><strong>' + drawerEscape(terrainText) + '</strong></span>' +
      '<span><b>Position</b><strong>' + state.latlng.lat.toFixed(5) + ', ' + state.latlng.lng.toFixed(5) + '</strong></span></div></section>' +
      (airportFeature ? '' : '<section><h4>WETTER</h4>' + mapContextWeatherMarkup(data, state.loading, null) + '</section>');
    if (state.error) details += '<section><div class="ga-efb-context-error">Live-Daten konnten nicht geladen werden. Der Kartenpunkt bleibt unveraendert.</div></section>';
    var aviationSource = data.sources && data.sources.aviation && data.sources.aviation.name || 'OPENAIP';
    var weatherSource = data.sources && data.sources.weather && data.sources.weather.name || 'OPEN-METEO';
    var sourceDurations = data.sources ? [data.sources.aviation, data.sources.terrain, data.sources.weather]
      .map(function (entry) { return entry && mapContextNumber(entry.durationMs); })
      .filter(function (value) { return value != null; }) : [];
    var sourceDuration = sourceDurations.length ? Math.max.apply(Math, sourceDurations) : null;
    var sourceText = state.loading ? 'LIVE-DATEN WERDEN GELADEN' : drawerEscape(aviationSource + ' + ' + weatherSource + (sourceDuration == null ? '' : ' | ' + sourceDuration + ' ms'));
    var mapHeight = map && map.getContainer ? Number(map.getContainer().clientHeight) : 0;
    var bodyHeight = Math.max(210, Math.min(520, (mapHeight > 0 ? mapHeight : 420) - 88));
    var html = '<div class="ga-efb-context-panel"><header><small>WAS IST HIER?</small><strong>' + state.latlng.lat.toFixed(5) + ', ' + state.latlng.lng.toFixed(5) + '</strong><button type="button" class="ga-efb-context-close" aria-label="Schliessen">X</button></header>' +
      '<div class="ga-efb-context-body" style="height:' + bodyHeight + 'px;min-height:' + bodyHeight + 'px;max-height:' + bodyHeight + 'px">' + mapContextHeightMarkup(data, state.loading) + '<div class="ga-efb-context-details">' + details + '</div></div>' +
      '<footer>' + (state.source === 'longpress' ? 'LANGDRUCK' : 'KARTENAUSWAHL') + ' | ' + sourceText + '</footer></div>';
    mapContextPopup.setContent(html);
    try { mapContextPopup.update(); } catch (_) {}
    bindMapContextClose();
  }

  function openMapContextInfo(latlng, source) {
    if (!map || !latlng || !isFiniteNumber(latlng.lat) || !isFiniteNumber(latlng.lng)) return;
    closeHostMenus();
    mapContextRequestSeq += 1;
    var requestSeq = mapContextRequestSeq;
    var state = { requestSeq: requestSeq, source: source, latlng: L.latLng(latlng.lat, latlng.lng), loading: true, data: {}, error: '' };
    mapContextState = state;
    if (mapContextPopup) try { map.closePopup(mapContextPopup); } catch (_) {}
    if (mapContextPointLayer) try { map.removeLayer(mapContextPointLayer); } catch (_) {}
    mapContextPointLayer = L.circleMarker(state.latlng, {
      radius: 7, color: '#ffffff', weight: 2, fillColor: '#00d9ff', fillOpacity: 0.92,
      interactive: false, className: 'ga-efb-context-point'
    }).addTo(map);
    mapContextPopup = L.popup({
      minWidth: 420,
      maxWidth: 580,
      maxHeight: 680,
      offset: L.point(0, 70),
      autoPan: true,
      autoPanPaddingTopLeft: L.point(10, 12),
      autoPanPaddingBottomRight: L.point(10, 12),
      keepInView: true,
      className: 'ga-efb-context-popup'
    }).setLatLng(state.latlng).setContent('').openOn(map);
    document.body.classList.add('ga-efb-context-open');
    renderMapContextInfo(state);
    var radiusNm = mapContextRadiusNm(state.latlng);
    var url = '/api/v1/map-context?lat=' + encodeURIComponent(state.latlng.lat.toFixed(6)) +
      '&lon=' + encodeURIComponent(state.latlng.lng.toFixed(6)) + '&radiusNm=' + encodeURIComponent(radiusNm.toFixed(2));
    fetchJson(url).then(function (response) {
      if (!mapContextState || mapContextState.requestSeq !== requestSeq) return;
      var payload = safePayload(response);
      state.loading = false;
      state.data = payload && payload.available !== false ? payload : {};
      state.error = payload && payload.available !== false ? '' : 'unavailable';
      renderMapContextInfo(state);
      report('info', 'map-context', 'loaded', 'Live-Kartenkontext geladen', state.latlng.lat.toFixed(5) + ',' + state.latlng.lng.toFixed(5));
    }).catch(function (error) {
      if (!mapContextState || mapContextState.requestSeq !== requestSeq) return;
      state.loading = false;
      state.error = String(error && error.message || error || 'context_error');
      renderMapContextInfo(state);
      report('warn', 'map-context', 'load-error', 'Live-Kartenkontext nicht verfuegbar', state.error);
    });
    report('info', 'map-context', 'open', 'Kartenkontext am gedrueckten Punkt angefordert', state.latlng.lat.toFixed(5) + ',' + state.latlng.lng.toFixed(5));
  }

  function toggleMapContextPick() {
    contextPickActive = !contextPickActive;
    var button = document.querySelector('.ga-efb-host-context');
    if (button) {
      button.classList.toggle('active', contextPickActive);
      button.textContent = contextPickActive ? 'Was ist hier (An)' : 'Was ist hier';
    }
    if (contextPickActive) setDrawMode('');
    if (map) map.getContainer().style.cursor = contextPickActive ? 'help' : '';
    report('info', 'map-context', contextPickActive ? 'enabled' : 'disabled', 'Was-ist-hier-Modus umgeschaltet');
  }

  function clearMapContextPress() {
    if (mapContextPress && mapContextPress.timer) window.clearTimeout(mapContextPress.timer);
    mapContextPress = null;
  }

  function mapContextInputType(event) {
    var eventType = String(event && event.type || '');
    return eventType.indexOf('touch') === 0
      ? 'touch'
      : (eventType.indexOf('pointer') === 0 ? 'pointer' : 'mouse');
  }

  function mapContextEventPoint(event) {
    if (!event) return null;
    var inputType = mapContextInputType(event);
    var source = event;
    if (inputType === 'touch') {
      source = event.touches && event.touches.length
        ? event.touches[0]
        : (event.changedTouches && event.changedTouches.length ? event.changedTouches[0] : null);
    }
    if (!source) return null;
    var x = Number(source.clientX);
    var y = Number(source.clientY);
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null;
    var inputId = inputType === 'touch'
      ? (source.identifier == null ? 0 : source.identifier)
      : (inputType === 'pointer' ? (event.pointerId == null ? 0 : event.pointerId) : 0);
    return { x: x, y: y, key: inputType + ':' + inputId, inputType: inputType };
  }

  function bindMapContextLongPress() {
    if (!map) return;
    var container = map.getContainer();
    if (!container || container.getAttribute('data-ga-context-longpress') === '1') return;
    container.setAttribute('data-ga-context-longpress', '1');
    function begin(event) {
      var input = mapContextEventPoint(event);
      if (!input) return;
      if (drawMode || event.isPrimary === false) {
        clearMapContextPress();
        return;
      }
      if (input.inputType === 'touch' && event.touches && event.touches.length !== 1) {
        clearMapContextPress();
        return;
      }
      if (input.inputType !== 'touch' && event.button != null && event.button !== 0) return;
      if (event.target && event.target.closest && event.target.closest('.leaflet-control, button, input, .map-draw-rail, .map-draw-menu')) return;
      if (mapContextPress
        && Date.now() - mapContextPress.startedAt < 80
        && Math.hypot(input.x - mapContextPress.x, input.y - mapContextPress.y) < 3) return;
      clearMapContextPress();
      var rect = container.getBoundingClientRect();
      var start = { x: input.x, y: input.y, key: input.key, inputType: input.inputType, startedAt: Date.now() };
      start.timer = window.setTimeout(function () {
        if (!mapContextPress || mapContextPress.key !== start.key) return;
        var point = L.point(start.x - rect.left, start.y - rect.top);
        mapContextSuppressClickUntil = Date.now() + 900;
        clearMapContextPress();
        openMapContextInfo(map.containerPointToLatLng(point), 'longpress');
      }, 650);
      mapContextPress = start;
    }
    function move(event) {
      if (event && event.touches && event.touches.length !== 1) {
        clearMapContextPress();
        return;
      }
      var input = mapContextEventPoint(event);
      if (!mapContextPress) return;
      if (!input) {
        if (mapContextPress.inputType === mapContextInputType(event)) clearMapContextPress();
        return;
      }
      if (mapContextPress.key !== input.key) return;
      if (Math.hypot(input.x - mapContextPress.x, input.y - mapContextPress.y) > 16) clearMapContextPress();
    }
    function end(event) {
      if (!mapContextPress) return;
      var input = mapContextEventPoint(event);
      if ((input && mapContextPress.key === input.key)
        || (!input && mapContextPress.inputType === mapContextInputType(event))) clearMapContextPress();
    }
    container.addEventListener('pointerdown', begin, true);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', end, true);
    container.addEventListener('mousedown', begin, true);
    window.addEventListener('mousemove', move, true);
    window.addEventListener('mouseup', end, true);
    container.addEventListener('touchstart', begin, true);
    window.addEventListener('touchmove', move, true);
    window.addEventListener('touchend', end, true);
    window.addEventListener('touchcancel', end, true);
    container.addEventListener('click', function (event) {
      if (Date.now() >= mapContextSuppressClickUntil) return;
      if (event.preventDefault) event.preventDefault();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }, true);
  }

  function handleMapClick(event) {
    if (Date.now() < mapContextSuppressClickUntil) return;
    if (contextPickActive) {
      openMapContextInfo(event.latlng, 'pick-mode');
      return;
    }
    if (drawMode !== 'measure') return;
    drawPoints.push(event.latlng);
    var group = measureLayer;
    if (drawLine) group.removeLayer(drawLine);
    drawLine = L.polyline(drawPoints, { color: '#f2c12e', weight: 3, dashArray: '5,5', pane: 'gaDrawingPane', renderer: drawingRenderer || undefined }).addTo(group);
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
      var containerPoint = map.mouseEventToContainerPoint(source);
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
    drawLine = L.polyline(drawPoints, { color: drawColor, weight: drawWeight, lineCap: 'round', lineJoin: 'round', smoothFactor: 0, noClip: true, pane: 'gaDrawingPane', renderer: drawingRenderer || undefined }).addTo(drawingLayer);
    drawHistory.push({ layer: drawLine, group: drawingLayer });
    drawStrokeActive = true;
    try { if (event.pointerId != null && map.getContainer().setPointerCapture) map.getContainer().setPointerCapture(event.pointerId); } catch (_) {}
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
    try { if (event && event.pointerId != null && map.getContainer().releasePointerCapture) map.getContainer().releasePointerCapture(event.pointerId); } catch (_) {}
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
    var checklistRequest = fetchJson('/api/v1/checklists').catch(function () { return null; });
    Promise.all([
      fetchJson('/api/v1/status'),
      fetchJson('/api/v1/snapshot'),
      fetchJson('/api/v1/map'),
      checklistRequest
    ]).then(function (responses) {
      trackerOnline = true;
      var status = safePayload(responses[0]);
      setTrackerState(status && status.simulatorConnected ? 'Tracker + Simulator verbunden' : 'Tracker verbunden | warte auf Simulator', false);
      renderFlight(safePayload(responses[1]));
      renderMapPayload(safePayload(responses[2]));
      if (responses[3]) renderChecklistPayload(safePayload(responses[3]));
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

  function pollMission() {
    fetchJson('/api/v1/mission').then(function (envelope) {
      renderMissionPayload(safePayload(envelope));
      missionPollTimer = window.setTimeout(pollMission, missionIntentPending || cargoManagerOpen ? 300 : 550);
    }).catch(function () {
      missionPollTimer = window.setTimeout(pollMission, 1000);
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
      report('info', 'tool-action', 'toggle-' + tool, 'Kartenwerkzeug umgeschaltet');
      toggleUtilityTool(tool);
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
  window.vpZoom = function (delta) { profileZoom = clamp(profileZoom + Number(delta || 0), 0, 200); renderProfile(); };
  window.vpChangeYAxis = function (delta) { profileYAxis = Math.max(1000, (profileYAxis || 6000) + Number(delta || 0)); renderProfile(); };
  window.vpResetYAxis = function () { profileYAxis = 0; renderProfile(); };
  window.vpChangeAlt = function (delta) {
    var profile = mapSnapshot && mapSnapshot.profile;
    var current = profileCruiseOverride == null ? finite(profile && profile.cruiseAltitudeFt) || 4500 : profileCruiseOverride;
    profileCruiseOverride = clamp(Math.round(current + Number(delta || 0)), 500, 18000);
    renderProfile();
  };
  window.vpChangeRate = function (delta) {
    profileVerticalRate = clamp(Math.round(profileVerticalRate + Number(delta || 0)), 100, 2500);
    renderProfile();
  };
  window.promptForAlt = function () {
    if (typeof window.prompt !== 'function') return;
    var profile = mapSnapshot && mapSnapshot.profile;
    var current = profileCruiseOverride == null ? finite(profile && profile.cruiseAltitudeFt) || 4500 : profileCruiseOverride;
    var value = finite(window.prompt('Reiseflughoehe in ft MSL', String(Math.round(current))));
    if (value == null) return;
    profileCruiseOverride = clamp(Math.round(value), 500, 18000);
    renderProfile();
  };
  window.promptForRate = function () {
    if (typeof window.prompt !== 'function') return;
    var value = finite(window.prompt('Steig-/Sinkrate in ft/min', String(Math.round(profileVerticalRate))));
    if (value == null) return;
    profileVerticalRate = clamp(Math.round(value), 100, 2500);
    renderProfile();
  };
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
      setupEfbUiCompatibility();
      setFollow(preferences.follow);
      var bootStatus = byId('gaEfbBootStatus');
      if (bootStatus) bootStatus.style.display = 'none';
      report('info', 'boot', 'host-ready', 'Kartentisch und Karte bereit');
      notifyParentState('ready', { stage: 'host-ready' });
      poll();
      pollMission();
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
  window.addEventListener('beforeunload', function () {
    if (pollTimer) window.clearTimeout(pollTimer);
    if (missionPollTimer) window.clearTimeout(missionPollTimer);
    if (efbUiRefreshTimer) window.clearTimeout(efbUiRefreshTimer);
    if (efbUiObserver) efbUiObserver.disconnect();
  });
})();
