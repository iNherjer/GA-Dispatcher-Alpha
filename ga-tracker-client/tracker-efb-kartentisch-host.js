(function () {
  'use strict';

  var API = window.GAMapShellCore;
  var L = window.L;
  var PREFERENCES_KEY = 'ga_efb_tracker_kartentisch_v1';
  var INFO_BOX_STORAGE_KEY = 'ga_efb_tracker_info_boxes_v1';
  var map = null, warningProfileAirspace = null, warningProfileTimer = null;
  window.awmDisplayTrackerWarning = function(warning) {
    if (warning.kind !== 'airspace') return true;
    if (!byId('awmFreqBanner')) return false;
    var presentation = window.GANavigationWarningPresentation;
    presentation.showFrequency(warning.airspace, presentation.style(warning.airspace).color);
    return true;
  };
  window.awmHighlightTrackerAirspace = function(airspace) {
    if (!map) return false;
    var presentation = window.GANavigationWarningPresentation;
    presentation.pulseOnMap(airspace, presentation.style(airspace).color, map, L);
    warningProfileAirspace = airspace;
    clearInterval(warningProfileTimer);
    var endAt = Date.now() + 6000;
    warningProfileTimer = setInterval(function() {
      if (Date.now() >= endAt) { clearInterval(warningProfileTimer); warningProfileAirspace = null; }
      renderProfile();
    }, 450);
    renderProfile();
    return true;
  };
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
  var liveTrail = null;
  var liveTrailPoints = [];
  var liveTrailSession = '';
  var liveTrailSaveTimer = 0;
  var TRAIL_STORAGE_KEY = 'ga_efb_live_trail_v1';
  var routeLayer = null;
  var geometryLayer = null;
  var previewLayer = null;
  var routeRenderer = null;
  var geometryRenderer = null;
  var previewLine = null;
  var baseLayers = {};
  var overlayLayers = {};
  var layerControl = null;
  var firstRouteFit = false;
  var pollTimer = 0;
  var missionPollTimer = 0;
  var auxiliaryPollTimers = {};
  var pollingClosed = false;
  var trackerOnline = false;
  var contextPickActive = false;
  var mapContextPress = null;
  var mapContextSuppressClickUntil = 0;
  var routeProgressTarget = 'wpt';
  var previewWaypointIndex = null;
  var lastParentState = '';
  var preferences = readPreferences();
  var infoBoxState = readInfoBoxState();
  var lastProfileDiagnostic = '';
  var tileHealthReported = {};
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
  var missionBannerDismissedKey = '';
  var cargoManagerOpen = false;
  var cargoManagerSignature = '';
  var cargoSignatureAnimationEndsAt = 0;
  var cargoSignatureAnimationScope = '';
  var cargoSignatureAnimationTimer = 0;
  var EFB_OVERLAY_PANES = {
    aero: 'gaVfrPane',
    dfs: 'gaOfficialChartPane',
    faa: 'gaOfficialChartPane',
    dwd: 'gaWeatherPane'
  };
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
    normalized.fontScale = clamp(Number(source.fontScale) || 1, 0.9, 1.3);
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

  function saveInfoBoxState() {
    try { localStorage.setItem(INFO_BOX_STORAGE_KEY, JSON.stringify(infoBoxState)); } catch (_) {}
  }

  function infoBoxVisible(id) {
    return window.isMapHintEnabled(infoBoxHintKey(id));
  }

  function updateInfoRestoreButton() { refreshMapHintMenuUi(); }

  function setInfoBoxAvailability(id, available) {
    var node = byId(id);
    if (node) node.style.display = available && infoBoxVisible(id) ? 'block' : 'none';
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
      bindInfoBoxDrag(node);
    });
    updateInfoRestoreButton();
  }

  function coherentText(value) {
    var text=String(value == null ? '' : value);
    return text.normalize ? text.normalize('NFC') : text;
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
        // Shared UI labels and symbols must survive intact. Dynamic tracker
        // messages use coherentText at their explicit rendering boundary.
        var normalized = child.nodeValue.normalize ? child.nodeValue.normalize('NFC') : child.nodeValue;
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
    var text = 'Schriftgröße: ' + Math.round(preferences.fontScale * 100) + '%';
    if (label && label.textContent !== text) label.textContent = text;
  }

  function applyEfbFontScale() {
    var nextScale = clamp(Number(preferences.fontScale) || 1, 0.9, 1.3);
    var elements = fontScaleElements();
    if (nextScale === 1) {
      elements.forEach(function (element) {
        if (element.hasAttribute('data-ga-efb-font-original')) {
          element.style.fontSize = element.getAttribute('data-ga-efb-font-original');
          element.removeAttribute('data-ga-efb-font-original');
          element.removeAttribute('data-ga-efb-font-base');
        }
      });
      document.body.setAttribute('data-ga-efb-font-scale', '100');
      syncFontScaleControls();
      return;
    }
    elements.forEach(function (element) {
      if (!element.hasAttribute('data-ga-efb-font-original')) element.setAttribute('data-ga-efb-font-original', element.style.fontSize || '');
    });
    elements.forEach(function (element) {
      element.style.fontSize = element.getAttribute('data-ga-efb-font-original') || '';
      element.removeAttribute('data-ga-efb-font-base');
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
    preferences.fontScale = clamp(Math.round((Number(value) || 1) * 10) / 10, 0.9, 1.3);
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

  var missionIntentQueue = null;
  function submitMissionIntent(intent, payload) {
    if (!missionIntentQueue) missionIntentQueue = window.GAMissionControlUiCore.createIntentQueue(function () {
      missionIntentPending = missionIntentQueue.size() > 0;
      renderCargoManager();
      renderMissionToolbar(missionSnapshot);
    });
    var control = missionSnapshot && missionSnapshot.control;
    if (!control) return Promise.resolve(false);
    var runId = control.runId;
    var missionId = control.missionId;
    var data = payload || {};
    var key = [missionId, runId, intent, data.itemId || '', data.action || ''].join('|');
    var execute = function (value) {
      var current = missionSnapshot && missionSnapshot.control;
      if (!current || current.runId !== runId || current.missionId !== missionId) return false;
      return executeMissionIntent(intent, value);
    };
    // This host and the intent adapter ship together in the same tracker build.
    var batch = intent === 'set_manifest_item' && data.itemId
      && ['prepare', 'boarding', 'boarded', 'end_unloading', 'end_ready', 'on_task'].includes(control.phase)
      ? { group: [missionId, runId, control.phase].join('|'), value: data,
          execute: function (items) { return execute({ items: items }); } } : null;
    return missionIntentQueue.enqueue(key, data.itemId, function () { return execute(data); }, batch);
  }

  function executeMissionIntent(intent, payload) {
    var client = window.gaCockpitSessionClient;
    var control = missionSnapshot && missionSnapshot.control;
    if (!client || typeof client.submitIntent !== 'function' || !control) return Promise.resolve(false);
    missionIntentPending = true;
    window.gaMissionControlIntentPending = true;
    var pendingPresentation = window.GAMissionControlUiCore && typeof window.GAMissionControlUiCore.formatIntentResult === 'function'
      ? window.GAMissionControlUiCore.formatIntentResult({ pending: true })
      : { tone: 'info', text: 'Tracker verarbeitet die Aktion ...' };
    missionIntentStatus = pendingPresentation.text;
    missionIntentTone = pendingPresentation.tone;
    window.gaMissionControlIntentStatus = pendingPresentation;
    renderSideDrawer(true);
    renderCargoManager();
    renderMissionActionBanner(missionSnapshot);
    renderMissionToolbar(missionSnapshot);
    var commandId = 'efb-intent-' + String(intent || 'action').replace(/[^a-z0-9_-]/gi, '-') + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    var opensCargoAfterBoarding = intent === 'start_boarding';
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
      var finalize = function () {
        var ok = result && result.ok === true;
        // Mirror the App flow for the device that started boarding.  Opening
        // the manager is a local presentation choice; all cargo mutations
        // continue to use the authoritative tracker intent path.
        if (ok && opensCargoAfterBoarding && !(missionSnapshot && missionSnapshot.control && missionSnapshot.control.cargoWindowCloseId)) openCargoManager(true);
        return ok;
      };
      return fetchJson('/api/v1/mission').then(function (envelope) {
        renderMissionPayload(safePayload(envelope));
        return finalize();
      }).catch(function () { return finalize(); });
    }).catch(function (error) {
      var presentation = window.GAMissionControlUiCore && typeof window.GAMissionControlUiCore.formatIntentResult === 'function'
        ? window.GAMissionControlUiCore.formatIntentResult({ ok: false, error: error && error.message || 'mission_intent_failed' })
        : { tone: 'danger', text: 'Tracker-Aktion fehlgeschlagen.' };
      missionIntentStatus = presentation.text;
      missionIntentTone = presentation.tone;
      return false;
    }).then(function (ok) {
      missionIntentPending = false;
      window.gaMissionControlIntentPending = false;
      window.gaMissionControlIntentStatus = {text:missionIntentStatus,tone:missionIntentTone};
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
    var model = mission && mission.ui && mission.ui.schema === 'ga.mission-apt-ui.v1'
      && mission.ui.cargo && mission.ui.cargo.presentation === 'app-cargo-dialog-v1'
      ? mission.ui.cargo
      : null;
    if (model && model.afterSignatureAnimation && model.signature
        && Date.now() >= Number(model.signature.at) + 1600) return model.afterSignatureAnimation;
    return model;
  }

  function cargoActionAttributes(action, kind) {
    if (!action || action.disabled === true || !action.intent) return '';
    if (missionIntentPending && (action.intent !== 'set_manifest_item'
      || (missionIntentQueue && missionIntentQueue.pendingItemIds().indexOf(action.itemId) >= 0))) return '';
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
    // Use the committed signature time on every interface, including remote signing.
    var signatureAt = Number(signature.at) || 0;
    var signatureAge = Date.now() - signatureAt;
    var signatureEndsAt = signature.signed === true && signatureAt > 0
      && signatureAge >= -5000 && signatureAge < 1600 ? signatureAt + 1600 : 0;
    if (signatureEndsAt !== cargoSignatureAnimationEndsAt) {
      if (cargoSignatureAnimationTimer) window.clearTimeout(cargoSignatureAnimationTimer);
      cargoSignatureAnimationTimer = 0;
      cargoSignatureAnimationEndsAt = signatureEndsAt;
      cargoSignatureAnimationScope = String(signature.scope || '');
      if (signatureEndsAt) cargoSignatureAnimationTimer = window.setTimeout(function () {
        cargoSignatureAnimationTimer = 0;
        renderCargoManager();
      }, Math.max(0, signatureEndsAt - Date.now()));
    }
    var localSignatureAnimation = signature.signed === true && signatureEndsAt > Date.now();
    var rows = (Array.isArray(model.items) ? model.items : []).map(function (item) {
      var action = item && item.action && typeof item.action === 'object' ? Object.assign({ itemId: item.id }, item.action) : null;
      var stationAction = item && item.stationAction && typeof item.stationAction === 'object'
        ? Object.assign({ itemId: item.id }, item.stationAction)
        : null;
      var canInteract = action && action.disabled !== true && action.intent;
      var queued = missionIntentQueue && missionIntentQueue.pendingItemIds().indexOf(item.id) >= 0;
      if (queued) canInteract = false;
      var rowClasses = String(item && item.rowClasses || '');
      var attributes = canInteract ? cargoActionAttributes(action, 'item') : '';
      if (queued) rowClasses = rowClasses.replace(/\bis-interactive\b/g, '').trim();
      var disabled = queued || action && action.disabled === true ? ' aria-disabled="true"' : '';
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
    }).join('') || '<tr><td colspan="6">Keine Ladung für diese Mission.</td></tr>';
    var signatureDate = signature.signed ? cargoDateLabel(signature.at) : 'noch offen';
    var signatureState = localSignatureAnimation ? 'wird eingetragen'
      : (signature.signed ? 'Klick: Signatur löschen' : String(signature.stateText || ''));
    var signatureAction = signature.clickable === true && !localSignatureAnimation && !missionIntentPending
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
    var intentStatus = missionIntentTone === 'danger' && missionIntentStatus
      ? '<div class="mission-cargo-summary ' + (/abgelehnt|fehlgeschlagen/i.test(missionIntentStatus) ? 'mission-cargo-error' : '') + '">'
        + drawerEscape(missionIntentStatus) + '</div>'
      : '';
    var compliance = model.compliance && model.compliance.active === true
      ? '<div class="mission-cargo-summary mission-cargo-compliance-summary">'
        + drawerEscape(model.compliance.message || 'Behördenkontrolle läuft.') + '</div>'
      : '';
    return (model.modeHint ? '<div class="mission-cargo-summary ' + drawerEscape(model.modeHintClassName || '') + '">' + drawerEscape(model.modeHint) + '</div>' : '')
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
    overlay.innerHTML = '<div id="gaEfbCargoBody" class="mission-cargo-panel" role="dialog" aria-modal="true" aria-labelledby="gaEfbCargoTitle"></div>';
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
        if (intent === 'request_pax_interaction' && !payload.action) payload.action = 'deboard';
        if (intent === 'confirm_unload' && action !== 'item') {
          if (!window.confirm('Entladung abschließen und Mission beenden?\n\nDanach startet der Missionsabschluss mit Farewell/Endszene.')) return;
        }
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
    var header = exactModel && exactModel.header || {};
    var markup = '<div class="mission-cargo-head"><div><div class="mission-cargo-kicker">'
      + drawerEscape(header.kicker || 'Bodenservice') + '</div><div id="gaEfbCargoTitle" class="mission-cargo-title">'
      + drawerEscape(header.title || 'Verladung') + '</div></div>'
      + '<button class="mission-cargo-close" data-efb-cargo-action="close" title="Schliessen">&times;</button></div>'
      + cargoManagerMarkup();
    if (markup === cargoManagerSignature) return;
    var scroll = [body, body.querySelector('.mission-cargo-clipboard'), body.querySelector('.mission-cargo-list')]
      .map(function (node) { return node ? { top: node.scrollTop, left: node.scrollLeft } : null; });
    cargoManagerSignature = markup;
    body.innerHTML = markup;
    normalizeCoherentGlyphs(body);
    applyEfbFontScale();
    var signatureName = body.querySelector('.mission-cargo-signature.is-animating .mission-cargo-signature-name');
    if (signatureName && exactModel && exactModel.signature) {
      signatureName.style.animationDelay = '-' + Math.max(0, Date.now() - Number(exactModel.signature.at)) + 'ms';
    }
    [body, body.querySelector('.mission-cargo-clipboard'), body.querySelector('.mission-cargo-list')]
      .forEach(function (node, index) { if (node && scroll[index]) { node.scrollTop = scroll[index].top; node.scrollLeft = scroll[index].left; } });
  }

  function openCargoManager(fromTracker) {
    var overlay = ensureCargoManager();
    if (!overlay) return;
    cargoManagerOpen = true;
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
    renderCargoManager();
    if (fromTracker !== true && missionSnapshot && missionSnapshot.control && missionSnapshot.control.executionAuthority === 'tracker') {
      var phase = missionSnapshot.control.phase;
      submitMissionIntent('open_cargo_window', { mode: /^(end_|closing)/.test(phase) ? 'unload' : 'load' });
    }
    report('info', 'cargo-manager', 'open', 'Eigenständiger Verlade-Manager geöffnet');
  }

  function closeCargoManager(fromTracker) {
    var control = missionSnapshot && missionSnapshot.control;
    if (fromTracker !== true && control && control.executionAuthority === 'tracker') {
      return submitMissionIntent('close_cargo_window', {});
    }
    var overlay = byId('gaEfbCargoManager');
    cargoManagerOpen = false;
    if (!overlay) return;
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    report('info', 'cargo-manager', 'close', 'Verlade-Manager geschlossen');
  }

  function renderSideDrawer() {
    if (window.gaChecklistRefresh) window.gaChecklistRefresh();
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

  function openSideDrawer(view) { window.gaChecklistOpen(view || 'home'); }

  function submitCockpitTool(intent, payload) {
    var client = window.gaCockpitSessionClient;
    if (!client || !client.submitTool) return Promise.reject(new Error('Tracker nicht verbunden.'));
    return client.submitTool({ commandId: 'tool-' + intent + '-' + Date.now() + '-' + Math.random().toString(36).slice(2),
      intent: intent, expectedRevision: mapSnapshot && mapSnapshot.navigationOnly ? mapSnapshot.revision : 0,
      payload: payload || {} });
  }

  window.trackerPayloadGet = function() {
    window.aircraftPayloadStatus = window.aircraftPayloadStatus || {};
    window.aircraftPayloadStatus.error = null;
    return submitCockpitTool('read_payload').then(function(result) {
      if (!result || !result.ok || !result.snapshot) throw new Error(result && result.error || 'Gewichtsabruf fehlgeschlagen.');
      window.aircraftPayloadStatus.snapshot = result.snapshot;
      window.aircraftPayloadStatus.lastSnapshotAt = Date.now();
      return result;
    }).catch(function(error) { window.aircraftPayloadStatus.error = error.message; throw error; });
  };
  window.applyAirportDirectTo = function(airport, options) {
    var control = missionSnapshot && missionSnapshot.control;
    if (control && control.runId && control.phase !== 'closed' && !missionSnapshot.cloudPending) {
      if (control.executionAuthority !== 'tracker') {
        window.alert('Auf dem Tracker läuft eine andere Mission. Übernimm oder beende diese Mission, bevor du eine neue Route startest.');
        return Promise.resolve(false);
      }
      if (!window.confirm('Mission ' + control.missionId + ' läuft noch.\n\nMission ausdrücklich abbrechen und Direct-to starten?')) return Promise.resolve(false);
      return submitMissionIntent('abort_mission', {}).then(function(ok) {
        if (ok) window.alert('Die Tracker-Mission wurde abgebrochen. Du kannst Direct-to jetzt erneut starten.');
        return false;
      });
    }
    return submitCockpitTool('airport_direct_to', {airport: airport, forceGpsStart: !!(options && options.forceGpsStart)}).then(function(result) {
      if (!result || !result.ok) {
        var messages = { live_position_required: 'Ohne bestehenden Flugplan brauche ich eine aktive Tracker-Verbindung, damit die aktuelle GPS-Position als Start gesetzt werden kann.',
          mission_authority_conflict: 'Auf dem Tracker läuft eine Mission. Beende diese Mission, bevor du eine neue Route startest.',
          navigation_revision_conflict: 'Die Route wurde in einer anderen Ansicht geändert. Bitte erneut auswählen.' };
        window.alert(messages[result && result.error] || 'Direct To nicht verfügbar.');
        return false;
      }
      renderMapPayload(Object.assign({available: true}, result.map));
      return true;
    });
  };

  function setupSideDrawer() {
    var drawer = byId('mapSideDrawer'), body = byId('checklistDrawerBody');
    if (!drawer || !body) return;
    drawer.style.display = 'block';
    Object.assign(window.gaChecklistHost, {
      openAip: function(airport) { return submitCockpitTool('open_airport_aip', {icao: airport.icao, country: airport.country}).then(function(result) {
        if (!result || !result.ok) throw new Error('AIP konnte nicht geöffnet werden.');
      }); },
      checklists: function() { return trackerChecklistLibrary.checklists.map(function(list) {
        return { id:list.id, title:list.title, source:'tracker', editable:false, updatedAt:list.updatedAt,
          chapters:(list.sections || []).map(function(section) { return {id:section.id,title:section.title,items:section.items}; }) };
      }); },
      missionView: function() { return missionSnapshot && missionSnapshot.available !== false && (missionSnapshot.view || missionSnapshot) || null; },
      missionSummary: function() { var view = missionSnapshot && missionSnapshot.view; return view && (view.taskText || view.title) || 'Keine aktive Mission'; },
      cargoAction: function(action, itemId, field) {
        if (action === 'cargo-boardbook-time') return submitMissionIntent('set_boardbook_time', {itemId:itemId,field:field});
        return submitMissionIntent('set_manifest_item', {itemId:itemId,action:action==='cargo-load'?'load':action==='cargo-replace'?'replace':'unload'});
      }
    });
    window.gaAirportPopupHost = {openAip: window.gaChecklistHost.openAip,
      openWeather: function(data) { return submitCockpitTool('open_airport_weather', data).then(function(result) {
        if (!result || !result.ok) throw new Error('Browser nicht erreichbar');
        return result;
      }); }
    };
    window.gaTrackerExecutionSubmitIntent = submitMissionIntent;
    window.gaAbortTrackerMission = function() {return submitMissionIntent('abort_mission');};
    window.openMissionCargoDialog = function() { openCargoManager(); return true; };
    window.missionCargoGetManifestSnapshot = function() {
      var model = projectedCargoModel(missionSnapshot);
      return missionSnapshot && missionSnapshot.manifest || {items:[]};
    };
    window.missionCargoLoadItem = window.missionCargoUnloadItem = function() {return false;};
    window.missionComplianceBoardBookWriteAllowed = function(field) {
      var control=missionSnapshot && missionSnapshot.control;
      var manifest=missionSnapshot && missionSnapshot.manifest || {}, item=(manifest.items || []).find(function(row){return row.id==='bordbuch';});
      var action=window.GAMissionManifestCore.boardBookActionState(item, manifest, {missionAvailable:!!(control && control.missionId),currentFlightId:(control && control.flightEvents || {}).flightId});
      return !!(control && control.allowedActions && control.allowedActions.indexOf('set_boardbook_time')>=0 && action.allowed && action.field===field);
    };
    window.missionComplianceReplacementLocked = function() {return true;};
    window.missionComplianceCanMutateCargo = function(itemId, action) {
      var model=projectedCargoModel(missionSnapshot),item=model && model.items && model.items.find(function(row){return row.id===itemId;});
      return !!(item && item.action && !item.action.disabled && item.action.action===action);
    };
    ['pointerdown','mousedown','touchstart','click','dblclick','wheel'].forEach(function(type){drawer.addEventListener(type,function(event){event.stopPropagation();});});
    ['pointerdown','mousedown','touchstart','wheel'].forEach(function(type){body.addEventListener(type,function(){beginDrawerInteraction();if(type==='wheel')scheduleDrawerInteractionEnd();});});
    body.addEventListener('scroll',noteDrawerScroll);
    ['pointerup','pointercancel','mouseup','touchend','touchcancel'].forEach(function(type){window.addEventListener(type,scheduleDrawerInteractionEnd);});
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
    var theme = mapSnapshot && mapSnapshot.context && mapSnapshot.context.theme || localStorage.getItem('ga_theme') || 'classic';
    if (['classic', 'retro', 'navcom', 'ops1940', 'win95'].indexOf(theme) < 0) theme = 'classic';
    document.body.classList.add('theme-' + theme);
    if (theme === 'navcom') document.body.classList.add('theme-retro');
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

  function closeHostMenus() { window.toggleMapHintsMenu(false); }

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

  function infoBoxHintKey(id) {
    return { liveTelemetryBox: 'telemetry', liveCurrentBox: 'currentInfo', liveNextWpBox: 'nextLeg' }[id];
  }

  function configureDisplayControls() {
    // Preserve existing EFB choices once; subsequent changes use the original keys.
    Object.keys(infoBoxState).forEach(function(id) {
      var key = infoBoxHintKey(id);
      if (key && localStorage.getItem('ga_map_hint_' + key) === null && infoBoxState[id].hidden) {
        localStorage.setItem('ga_map_hint_' + key, 'false');
      }
    });
    window.gaMapDisplayAdapter = {
      supports: function(key) {
        return ['magentaLine', 'telemetry', 'currentInfo', 'nextLeg', 'routeProgress', 'compass', 'lowFps', 'autoZoom', 'terrainAvoid'].indexOf(key) >= 0;
      },
      apply: function(key) {
        if (['telemetry', 'currentInfo', 'nextLeg'].indexOf(key) >= 0) {
          Object.keys(infoBoxState).forEach(function(id) {
            setInfoBoxAvailability(id, id === 'liveNextWpBox' ? !!(mapSnapshot && mapSnapshot.navigation) : !!flight);
          });
        }
        if (key === 'compass') byId('compassRoseWrap').classList.toggle('compass-hint-off', !window.isMapHintEnabled(key));
        if (key === 'routeProgress') {
          byId('routeProgressBar').classList.toggle('route-progress-hidden', !window.isMapHintEnabled(key));
          syncToolbarLayout();
          if (map) map.invalidateSize(false);
        }
        if (key === 'magentaLine') renderProgress();
        if (key === 'autoZoom') {
          window.resetMapAutoZoomState();
          window.refreshMapAutoZoomUi();
        }
        if (key === 'terrainAvoid') window.setTerrainAvoidOverlayEnabled(window.isMapHintEnabled(key), { skipPersist: true, silent: true });
        if (key === 'lowFps') {
          var on = window.isMapHintEnabled(key);
          document.body.classList.toggle('low-fps-mode', on);
          if (routeLayer) routeLayer.eachLayer(function(layer) {
            if (layer instanceof L.Polyline) layer.setStyle({ dashArray: on ? null : '10,10' });
          });
          var element = planeMarker && planeMarker.getElement();
          if (element) element.classList.toggle('low-fps-plane', on);
          renderProfile();
        }
      },
      refreshUi: function() {
        // These original renderers still need migration. Never expose a working-
        // looking toggle that only changes its label or invent a replacement.
        ['hintToggleWeather',
          'btnToggleWeatherMenu', 'hintToggleTraffic'
        ].forEach(function(id) {
          var control = byId(id);
          if (!control) return;
          control.disabled = true;
          control.title = 'Die Standalone-Funktion ist im EFB noch nicht übernommen.';
        });
      }
    };
    loadMapHintSettings();
    loadTerrainAvoidSettings();
    initPlaneIconSettingsUi();
    ['telemetry', 'currentInfo', 'nextLeg', 'routeProgress', 'compass', 'lowFps', 'autoZoom', 'terrainAvoid'].forEach(window.gaMapDisplayAdapter.apply);
    refreshMapHintMenuUi();
  }

  function configureOriginalChrome() {
    document.body.classList.toggle('ga-efb-embedded', window.parent !== window);
    var overlay = byId('mapTableOverlay');
    if (overlay) overlay.classList.add('active');
    setText('navStationLabel', 'NAV STATION (KARTENTISCH) | HOST 0.7.8');

    var toolbarRow = byId('mapToolbarInner');
    var actions = toolbarRow && toolbarRow.lastElementChild;
    var profileButton = byId('vpToggleBtn');
    if (actions && profileButton) {
      actions.classList.add('ga-efb-host-actions');
      actions.appendChild(makeButton('ga-efb-host-state', 'Tracker wird verbunden', function () {}));

    }
    setupMissionActionBanner();

    var reset = actions && actions.querySelector('button[onclick="resetMainRoute()"]');
    if (reset) { reset.disabled = true; reset.title = 'Zwischenwegpunkte zurücksetzen'; }
    var closeButtons = actions && actions.querySelectorAll('.pb-btn.close');
    if (closeButtons) Array.prototype.forEach.call(closeButtons, function (button) {
      if (button.parentNode) button.parentNode.removeChild(button);
    });
    syncToolbarLayout();

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
      z: layer && typeof layer._getZoomForUrl === 'function' ? layer._getZoomForUrl() : coords.z
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
        // Resolve the native zoom now: the map can zoom again before a retry.
        var sourceUrls = sources.map(function (source, index) {
          return index === 0 ? layer.getTileUrl(coords) : tileTemplateUrl(source.url, layer, coords);
        });
        var sourceIndex = 0;
        var settled = false;
        var timeout = 0;
        tile.alt = '';
        tile.className = 'ga-efb-map-tile ga-efb-map-tile-' + String(definition.id || 'layer');
        tile.setAttribute('role', 'presentation');
        tile.setAttribute('decoding', 'async');
        if (layer.options.crossOrigin || layer.options.crossOrigin === '') {
          tile.crossOrigin = layer.options.crossOrigin === true ? '' : layer.options.crossOrigin;
        }
        if (typeof layer.options.referrerPolicy === 'string') tile.referrerPolicy = layer.options.referrerPolicy;
        // Panning/zooming must cancel obsolete fallback requests, not keep a
        // queue of invisible tiles competing with the current map and telemetry.
        tile._gaCancelTile = function () {
          if (settled) return;
          settled = true;
          clearTimer();
          tile.onload = null;
          tile.onerror = null;
          tile.src = L.Util.emptyImageUrl;
        };

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
          if (settled) return;
          sourceIndex = index;
          clearTimer();
          tile.src = sourceUrls[sourceIndex];
          timeout = window.setTimeout(function () {
            if (sourceIndex + 1 < sources.length) loadSource(sourceIndex + 1);
            else finish(new Error('map_tile_timeout'));
          }, sourceIndex === 0 ? 4500 : 7000);
        }
        tile.onload = function () { finish(null); };
        tile.onerror = function () {
          if (settled) return;
          if (sourceIndex + 1 < sources.length) loadSource(sourceIndex + 1);
          else finish(new Error('map_tile_failed'));
        };
        loadSource(0);
        return tile;
      }
    });
    var resilient = new ResilientLayer(sources[0].url, options);
    resilient.on('tileunload', function (event) {
      if (event.tile && event.tile._gaCancelTile) event.tile._gaCancelTile();
    });
    return resilient;
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
    overlayLayers.radar = createMapRadarOverlay(map, 'gaWeatherPane');
    overlayControl['🌧️ Wetterradar (Niederschlag)'] = overlayLayers.radar;
    (baseLayers[preferences.baseLayer] || baseLayers.topo).addTo(map);
    preferences.overlays.forEach(function (id) { if (overlayLayers[id]) overlayLayers[id].addTo(map); });
    updateBaseOpacity();
    layerControl = L.control.layers(baseControl, overlayControl, { collapsed: true, position: 'topright' }).addTo(map);
    configureMapLayerControl(map, layerControl);
    routeLayer = L.layerGroup().addTo(map);
    geometryLayer = L.layerGroup().addTo(map);
    previewLayer = L.layerGroup().addTo(map);
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
    window.map = map;
    bindAutoFollowMapInteractionHandlers();
    map.on('moveend zoomend', function () { window.scheduleTerrainAvoidOverlayUpdate(true); clearTimeout(snapTimer); snapTimer = setTimeout(refreshSnapCandidates, 600); });
    setInterval(refreshSnapCandidates, 60000);
    refreshSnapCandidates();
    map.on('click', handleMapClick);
    map.on('contextmenu', function (event) {
      clearMapContextPress();
      mapContextSuppressClickUntil = Date.now() + 900;
      openMapContextInfo(event.latlng, 'contextmenu');
    });
    map.on('popupclose', window.gaMapContextPopupClosed);
    bindMapContextLongPress();
    window.map = map;
    window.renderMainRoute = function() { if(mapSnapshot) renderRoute(mapSnapshot); };
    window.gaMapDrawingHost = {
      pathOptions: {pane: 'gaDrawingPane', renderer: L.svg({pane:'gaDrawingPane'})},
      changed: function(active) {
        map.getPane('gaRoutePane').style.pointerEvents = active ? 'none' : '';
        if(active && contextPickActive) toggleMapContextPick();
      }
    };
    bindMapDrawEvents();
    ensureMapDrawLayer();
    initMapDrawFloatingButton();
    window.addEventListener('resize', function () {
      syncToolbarLayout();
      map.invalidateSize(false);
      renderProfile();
      positionMapHintsMenuInViewport();
      renderRouteLegLabels();
    });
    map.on('zoomend', function() { renderRouteLegLabels(); });
    buildCompass();
    window.setTimeout(function () { map.invalidateSize(false); }, 60);
  }

  window.gaMapFollowChanged = function(value) {
    preferences.follow = value;
    savePreferences();
  };

  function setFollow(value) {
    toggleAutoFollow(!!value);
  }

  function planeIcon() {
    return L.divIcon({
      className: 'live-plane-marker',
      html: window.GAMapLivePresentation.aircraftHtml(),
      iconSize: [0, 0],
      iconAnchor: [0, 0]
    });
  }

  function rotatePlane(heading) {
    var element = planeMarker && planeMarker.getElement();
    var svg = element && element.querySelector('svg');
    if (svg) svg.style.transform = 'rotate(' + heading + 'deg)';
  }

  function saveLiveTrail() {
    window.clearTimeout(liveTrailSaveTimer);
    liveTrailSaveTimer = 0;
    if (!liveTrailSession) return;
    try { sessionStorage.setItem(TRAIL_STORAGE_KEY, JSON.stringify({sessionId: liveTrailSession, points: liveTrailPoints})); } catch (_) {}
  }

  function clearLiveTrail() {
    liveTrailPoints = [];
    if (liveTrail) liveTrail.setLatLngs([]);
    window.clearTimeout(liveTrailSaveTimer);
    liveTrailSaveTimer = 0;
    try { sessionStorage.removeItem(TRAIL_STORAGE_KEY); } catch (_) {}
  }

  function syncLiveTrailSession(payload) {
    var id = String(payload.viewSessionId || '');
    if (id !== liveTrailSession) {
      var saved = null;
      try { saved = JSON.parse(sessionStorage.getItem(TRAIL_STORAGE_KEY)); } catch (_) {}
      clearLiveTrail();
      liveTrailSession = id;
      liveTrailPoints = window.GAMapLivePresentation.restoreTrail(saved, id);
      if (liveTrail) liveTrail.setLatLngs(liveTrailPoints);
    }
    if (payload.available === false) clearLiveTrail();
  }

  function recordLiveTrail(lat, lon) {
    var next = window.GAMapLivePresentation.appendTrailPoint(liveTrailPoints, lat, lon, function(a,b) { return map.distance(a,b); });
    var trimmed = next && next !== liveTrailPoints;
    if (next) liveTrailPoints = next;
    if (!liveTrail && liveTrailPoints.length) liveTrail = L.polyline(liveTrailPoints,
      Object.assign({}, window.GAMapLivePresentation.TRAIL_STYLE, {pane:'gaRoutePane',renderer:routeRenderer || undefined})).addTo(map);
    else if (liveTrail && next) {
      if (trimmed) liveTrail.setLatLngs(liveTrailPoints);
      else liveTrail.addLatLng(liveTrailPoints[liveTrailPoints.length - 1]);
    }
    // Snapshot/render remains immediate. Bound synchronous storage work to once
    // per two seconds and flush on pagehide for a view reload.
    if (next && !liveTrailSaveTimer && liveTrailSession) liveTrailSaveTimer = window.setTimeout(saveLiveTrail, 2000);
  }

  var localNavigationState = {};
  function refreshLocalNavigation() {
    if (!mapSnapshot) return;
    var points = mapSnapshot.route.waypoints;
    localNavigationState.selectedIndex = previewWaypointIndex;
    mapSnapshot.navigation = flight ? window.GAMapNavigationGeometry.buildNavigation(flight, points,
      window.GAMapNavigationGeometry.buildLegs(points), localNavigationState) : null;
    if (mapSnapshot.navigation) previewWaypointIndex = localNavigationState.selectedIndex;
  }
  function renderFlight(payload) {
    if (!payload) { disconnectFlight(); return; }
    syncLiveTrailSession(payload);
    var normalized = API.normalizeFlightSnapshot(payload);
    if (!normalized || !normalized.capturedAt || Date.now() - normalized.capturedAt > 15000) {
      disconnectFlight();
      return;
    }
    if (flight && flight.capturedAt === normalized.capturedAt) return;
    var previous = flight;
    flight = normalized;
    refreshLocalNavigation();
    window.lastLiveFlightData = payload.flight || {};
    window.lastLiveTerrainFt = Number.isFinite(Number(payload.flight && payload.flight.aglFt))
      ? flight.altFt - Number(payload.flight.aglFt) : null;
    if(Array.isArray(payload.traffic)) window.vpTrafficData = window.GAMapLivePresentation.filterTraffic(payload.traffic, payload);
    recordLiveTrail(flight.lat, flight.lon);
    if (!planeMarker) {
      planeMarker = L.marker([flight.lat, flight.lon], { icon: planeIcon(), pane: 'gaAircraftPane', zIndexOffset: 9999, interactive: false }).addTo(map);
      planeMarker.getElement().classList.toggle('low-fps-plane', window.isMapHintEnabled('lowFps'));
      planeHeading = flight.headingDeg;
      rotatePlane(flight.headingDeg);
    } else {
      var moved = !previous || map.distance([previous.lat, previous.lon], [flight.lat, flight.lon]) >= 0.5;
      if (moved) planeMarker.setLatLng([flight.lat, flight.lon]);
      var headingDelta = planeHeading == null ? 360 : Math.abs(((flight.headingDeg - planeHeading + 540) % 360) - 180);
      if (headingDelta >= 1) {
        rotatePlane(flight.headingDeg);
        planeHeading = flight.headingDeg;
      }
    }
    renderProfile();
    if (preferences.follow) {
      updateAutoFollowFromTelemetry(getAutoFollowLiveSample());
    }
    updateStandaloneTelemetry(flight);
    setText('currentPosRef', mapSnapshot && mapSnapshot.context.currentPosition || 'Position aktiv');
    var telemetry = byId('liveTelemetryBox');
    var current = byId('liveCurrentBox');
    setInfoBoxAvailability('liveTelemetryBox', !!telemetry);
    setInfoBoxAvailability('liveCurrentBox', !!current);
    updateCompass();
    renderProgress();
  }

  function targetIcon() {
    return L.divIcon({ className: 'ga-mission-target', html: 'T', iconSize: [22, 22], iconAnchor: [11, 11] });
  }

  var snapMode = true, snapCandidates = [], snapCoverage = null, snapLoadedAt = 0;
  var snapRequest = 0, snapPending = false, snapDirty = false, snapTimer = null;
  window.updateSnapButtonUI = function() {
    ['snapBtn', 'hintToggleSnapping'].forEach(function(id) {
      var button = byId(id); if (!button) return;
      button.disabled = false;
      button.innerText = snapMode ? '🧲 Snapping (An)' : '🧲 Snapping (Aus)';
      button.style.background = snapMode ? '#4da6ff' : '#444'; button.style.color = '#fff';
      button.title = 'Wegpunkte an Flugplätzen, Funkfeuern und Meldepunkten einrasten';
    });
  };
  window.toggleSnapMode = function() {
    snapMode = !snapMode; window.updateSnapButtonUI();
    if (!snapMode) { snapCandidates = []; snapCoverage = null; snapRequest++; }
    else refreshSnapCandidates();
  };
  function refreshSnapCandidates() {
    if (!map || !snapMode || map.getZoom() < 6) { snapCandidates = []; snapCoverage = null; return; }
    if (snapPending) { snapDirty = true; return; }
    var b = map.getBounds(), now = Date.now();
    if (snapCoverage && now - snapLoadedAt < 300000 && b.getWest() >= snapCoverage.west && b.getEast() <= snapCoverage.east &&
        b.getSouth() >= snapCoverage.south && b.getNorth() <= snapCoverage.north) return;
    var bounds = { west: Math.max(-180, b.getWest() - .1), east: Math.min(180, b.getEast() + .1),
      south: Math.max(-85, b.getSouth() - .1), north: Math.min(85, b.getNorth() + .1) };
    if (bounds.west >= bounds.east || bounds.south >= bounds.north) return;
    var sequence = ++snapRequest; snapPending = true;
    window.gaFetchNavpoints(bounds).then(function(entries) {
      if (sequence !== snapRequest || !snapMode) return;
      snapCandidates = Array.isArray(entries) ? entries : []; snapCoverage = bounds; snapLoadedAt = now;
    }).catch(function(error) { console.warn('[EFB Snapping]', error.message); })
      .then(function() { snapPending = false; if (snapDirty) { snapDirty = false; clearTimeout(snapTimer); snapTimer = setTimeout(refreshSnapCandidates, 600); } });
  }
  function snappedPoint(pos) {
    if (!snapMode || !map || map.getZoom() < 6) return null;
    return window.GAMapRouteEditCore.snap(pos, snapCandidates.filter(function(p) { return p.type === 'APT' || map.getZoom() >= 8; }),
      function(p) { return map.latLngToLayerPoint([p.lat, p.lng == null ? p.lon : p.lng]); });
  }
  var navigationDragging = false;
  var navigationClient = window.GAMapNavigationClient.create({
    request: function(intent, payload, revision) {
      return window.gaCockpitSessionClient.submitTool({ intent: intent, payload: payload, expectedRevision: revision,
        commandId: 'nav-' + Date.now() + '-' + Math.random().toString(36).slice(2) });
    },
    render: function(nav, pending) {
      if (!mapSnapshot || nav.id !== (mapSnapshot.routeEdit && mapSnapshot.routeEdit.id)) return;
      var next = Object.assign({}, mapSnapshot, { route: Object.assign({}, mapSnapshot.route, { waypoints: nav.points }) });
      var signature = mapRouteSignature(next);
      if (signature !== routeSignature) { mapSnapshot = next; routeSignature = signature; renderRoute(next); refreshLocalNavigation(); renderProgress(); updateCompass(); renderProfile(); }
    },
    error: function() { window.alert('Die Route wurde inzwischen geändert oder die Verbindung ist unterbrochen. Bitte die aktuelle Route prüfen.'); },
    refresh: function() { fetchJson('/api/v1/map', 5000).then(function(value) { renderMapPayload(safePayload(value)); }).catch(function() {}); }
  });
  function routeInsert(event) {
    if (mapDrawState.enabled || measureMode || navigationDragging || !mapSnapshot) return;
    var points = mapSnapshot.route.waypoints;
    var index = window.GAMapRouteEditCore.insertionIndex(points, event.latlng, function(a, b) {
      return map.distance([a.lat, a.lng == null ? a.lon : a.lng], [b.lat, b.lng == null ? b.lon : b.lng]);
    });
    navigationClient.edit({ action: 'insert', index: index, point: { lat: event.latlng.lat, lng: event.latlng.lng } });
    if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
  }
  window.removeRouteWaypoint = function(index) { navigationClient.edit({ action: 'remove', index: index }); };

  function renderRoute(snapshot) {
    var previousRouteLayer = routeLayer;
    var previousGeometryLayer = geometryLayer;
    var previousPreviewLayer = previewLayer;
    routeLayer = L.layerGroup();
    geometryLayer = L.layerGroup();
    previewLayer = L.layerGroup();
    previewLine = null;
    var waypoints = snapshot.route.waypoints;
    var latlngs = waypoints.map(function (point) { return [point.lat, point.lng == null ? point.lon : point.lng]; });
    var routeLine = L.polyline(latlngs, { color: '#ff4444', opacity: 1, weight: 7, dashArray: window.isMapHintEnabled('lowFps') ? null : '10,10', pane: 'gaRoutePane', renderer: routeRenderer || undefined }).addTo(routeLayer);
    var routeHitbox = null;
    if (!measureMode && !mapDrawState.enabled && snapshot.routeEdit && snapshot.routeEdit.editable) {
      routeLine.on('click', routeInsert);
      routeHitbox = L.polyline(latlngs, { weight: 44, opacity: 0, interactive: true, bubblingMouseEvents: false, pane: 'gaRoutePane' }).addTo(routeLayer).on('click', routeInsert);
    }
    waypoints.forEach(function (point, index) {
      var canDrag = !measureMode && !mapDrawState.enabled && snapshot.routeEdit && snapshot.routeEdit.editable && index > 0 && index < waypoints.length - 1 && !point.isPOI && !point.isPoiChainEndpoint && !point.isPoiChainReturnHome;
      var marker = L.marker([point.lat, point.lng == null ? point.lon : point.lng], { icon: L.divIcon(window.GAMapRouteEditCore.markerOptions(index, waypoints.length, point.isPOI)), pane: 'gaRoutePane', interactive: !measureMode && !mapDrawState.enabled, draggable: !!canDrag }).addTo(routeLayer);
      if (canDrag) {

        marker.on('dragstart', function() { navigationDragging = true; });
        marker.on('drag', function(event) {
          var raw = event.latlng || marker.getLatLng(), closest = snappedPoint(raw);
          marker.setLatLng(closest ? [closest.lat, closest.lng] : raw);
          var line = waypoints.map(function(p) { return [p.lat, p.lng == null ? p.lon : p.lng]; });
          line[index] = marker.getLatLng(); routeLine.setLatLngs(line);
          if (routeHitbox) routeHitbox.setLatLngs(line);
        });
        marker.on('dragend', function() {
          navigationDragging = false;
          if (!mapSnapshot) return;
          var pos = marker.getLatLng(), closest = snappedPoint(pos);
          var point = closest ? { lat: closest.lat, lng: closest.lng, name: closest.name, rppAirportIcao: closest.rppAirportIcao || '' } : { lat: pos.lat, lng: pos.lng };
          if (!navigationClient.edit({ action: 'move', index: index, point: point })) renderRoute(mapSnapshot);
        });
      }
      if (index === 0 || index === waypoints.length - 1) {
        window.bindRouteAirportPopup(marker, index === 0, marker.getLatLng());
      } else if (point.isPOI) {
        marker.bindPopup('<div style="text-align:center; color:#b266ff;"><b>' + escapeHtml(point.name) + '</b></div>');
      } else {
        marker.bindPopup('');
        marker.on('popupopen', function() {
          var info = window.gaMapContextHost.cachedFeature(marker.getLatLng());
          var airport = info && info.kind === 'airport' && window.getMapContextFeatureDistancePx(info, marker.getLatLng()) <= window.getAirportTapRadiusPx(18) ? info : null;
          var infoButton = airport ? '<button data-route-airport-info style="margin-top:5px; margin-right:4px; background:#235ea7; color:#fff; border:none; padding:4px 8px; cursor:pointer; border-radius:2px;">ℹ️ Info</button>' : '';
          var content = document.createElement('div');
          content.innerHTML = window.GAMapRouteEditCore.popup(point.name, index, infoButton);
          // Preserve the protected waypoint gate for routes this surface cannot edit.
          if (!canDrag) Array.from(content.querySelectorAll('[onclick]')).forEach(function(button){button.remove();});
          var infoControl = content.querySelector('[data-route-airport-info]');
          if(infoControl) infoControl.onclick = function(){window.openAirportInfoPopup({icao:airport.icao,name:airport.name,lat:airport.lat,lon:airport.lon,elevation:airport.elevationFt,country:airport.country});};
          marker.getPopup().setContent(content);
        });
      }
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
    var parts = [String(snapshot.missionId || ''), String(snapshot.routeEdit && snapshot.routeEdit.id), String(snapshot.routeEdit && snapshot.routeEdit.editable)];
    (snapshot.route && snapshot.route.waypoints || []).forEach(function (point) {
      parts.push(['w', point.id || '', point.name || '', point.lat, point.lng == null ? point.lon : point.lng, !!point.isPOI, !!point.isPoiChainEndpoint, !!point.isPoiChainReturnHome].join(':'));
    });
    var target = snapshot.missionGeometry && snapshot.missionGeometry.target;
    if (target) parts.push(['t', target.id || target.name || '', target.lat, target.lon].join(':'));
    (snapshot.missionGeometry && snapshot.missionGeometry.poiChain || []).forEach(function (point) {
      parts.push(['c', point.id || '', point.name || '', point.lat, point.lng == null ? point.lon : point.lng, !!point.isPOI, !!point.isPoiChainEndpoint, !!point.isPoiChainReturnHome].join(':'));
    });
    return parts.join('|');
  }

  function clearMapRoute() {
    if (!mapSnapshot) return;
    mapSnapshot = null; mapRevision = null; routeSignature = ''; localNavigationState = {};
    previewWaypointIndex = null; previewLine = null;
    [routeLayer, geometryLayer, previewLayer].forEach(function(layer){if(layer)layer.clearLayers();});
    navigationClient.receive({id:'',revision:0,editable:false,points:[],resetPoints:[]});
    var reset = document.querySelector('button[onclick="resetMainRoute()"]');
    if(reset)reset.disabled=true;
    renderProgress(); updateCompass(); renderProfile();
  }
  function renderMapPayload(payload) {
    if (payload && payload.available === false) { clearMapRoute(); return; }
    if (!payload || payload.available !== true || navigationDragging) return;
    var normalized = API.normalizeTrackerMapSnapshot(payload);
    if (!normalized) return;
    if (normalized.routeEdit) navigationClient.receive({ id: normalized.routeEdit.id, revision: normalized.routeEdit.revision,
      editable: normalized.routeEdit.editable, resetPoints: normalized.routeEdit.resetPoints, points: normalized.route.waypoints, context: normalized.context,
      missionId: normalized.missionId, runId: normalized.runId });
    if (navigationClient.pending()) return;
    var resetControl = document.querySelector('button[onclick="resetMainRoute()"]');
    if (resetControl) resetControl.disabled = !(normalized.routeEdit && normalized.routeEdit.editable);
    var nextRouteSignature = mapRouteSignature(normalized);
    if (!mapSnapshot || nextRouteSignature !== routeSignature) {
      previewWaypointIndex = null;
      if (!mapSnapshot || (mapSnapshot.routeEdit && mapSnapshot.routeEdit.id) !== (normalized.routeEdit && normalized.routeEdit.id)) localNavigationState = {};
      mapSnapshot = normalized;
      mapRevision = normalized.revision;
      routeSignature = nextRouteSignature;
      renderRoute(normalized);
    } else {
      mapSnapshot = normalized;
      mapRevision = normalized.revision;
    }
    refreshLocalNavigation();
    var theme = normalized.context && normalized.context.theme;
    if (theme && !document.body.classList.contains('theme-' + theme)) applyTheme();
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
    // A canonical null banner is an explicit UI decision.  Falling back in
    // that case resurrected the old airborne "Verladung öffnen" banner even
    // though the shared App UI core intentionally hides it.
    if (payload.ui && payload.ui.schema === 'ga.mission-apt-ui.v1') {
      return payload.ui.banner && typeof payload.ui.banner === 'object'
        ? Object.assign({}, payload.ui.banner)
        : null;
    }
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
      var confirmed = false;
      try {
        confirmed = window.confirm('Mission wirklich zurücksetzen? Fortschritt und missionsspezifische Ladung werden zurückgesetzt; der Auftrag bleibt zum Neustart erhalten.');
      } catch (_) {}
      if (!confirmed) return Promise.resolve(false);
      return submitMissionIntent('abort_mission', { reason: String(settings.reason || 'efb-toolbar-reset') });
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

  var boardBookRemindersSeen = [], boardBookReminderTimer = null;
  function renderBoardBookReminder(control) {
    var reminder = window.GAMissionControlUiCore.boardBookReminder(control), host = window.GANavigationWarningPresentation.getBannerHost();
    if (!reminder || !host || boardBookRemindersSeen.indexOf(reminder.key) >= 0) return;
    var banner = byId('missionBoardBookReminder');
    if (!banner) {
      banner = document.createElement('section'); banner.id = 'missionBoardBookReminder';
      banner.className = 'awm-freq-entry mission-boardbook-reminder'; banner.setAttribute('role', 'status'); host.appendChild(banner);
    }
    banner.innerHTML = window.GAMissionControlUiCore.boardBookReminderMarkup(reminder.field);
    function dismiss() { banner.hidden = true; if (!Array.from(host.children).some(function(child) { return !child.hidden; })) host.style.display = 'none'; }
    banner.onclick = function(event) { event.stopPropagation(); if (!event.target.closest('button')) dismiss(); };
    banner.querySelector('button').onclick = function(event) {
      event.stopPropagation();
      submitMissionIntent('set_boardbook_time', { itemId: 'bordbuch', field: reminder.field, source: 'banner' }).then(function(ok) { if (ok) dismiss(); });
    };
    banner.hidden = false; host.style.display = 'block';
    boardBookRemindersSeen.push(reminder.key); boardBookRemindersSeen = boardBookRemindersSeen.slice(-32);
    clearTimeout(boardBookReminderTimer); boardBookReminderTimer = setTimeout(dismiss, 15000);
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
    setText('missionStartBannerText', model.text);
    setText('missionStartBannerBtn', model.button);
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
    var previousControl = missionSnapshot && missionSnapshot.control;
    var nextControl = next && next.control;
    var openBoardingDialog = nextControl && !nextControl.cargoWindowCloseId && nextControl.executionAuthority === 'tracker' && nextControl.phase === 'boarding'
      && (!previousControl || previousControl.phase !== 'boarding' || previousControl.runId !== nextControl.runId);
    var signature = missionRenderSignature(next);
    var presentationSignature = JSON.stringify({
      mission: signature,
      intentPending: missionIntentPending === true,
      intentStatus: missionIntentStatus || '',
      intentTone: missionIntentTone || '',
      cargoManagerOpen: cargoManagerOpen === true
    });
    missionSnapshot = next;
    window.gaTrackerExecutionControl = next && next.control || null;
    if (nextControl && nextControl.cargoWindowCloseId
        && (!previousControl || previousControl.cargoWindowCloseId !== nextControl.cargoWindowCloseId)) closeCargoManager(true);
    if (nextControl && nextControl.cargoWindowOpenId && (!previousControl || previousControl.cargoWindowOpenId !== nextControl.cargoWindowOpenId)) openCargoManager(true);
    else if (openBoardingDialog) openCargoManager(true);
    renderBoardBookReminder(nextControl);
    if (presentationSignature !== missionPresentationSignature) {
      missionPresentationSignature = presentationSignature;
      renderMissionActionBanner(next);
      renderMissionToolbar(next);
      renderCargoManager();
    }
    var drawer = byId('mapSideDrawer');
    var drawerOpen = drawer && drawer.classList.contains('is-open') && window.gaChecklistCurrentView() === 'mission';
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
    if (window.gaChecklistCurrentView && ['home','list','manager','viewer'].indexOf(window.gaChecklistCurrentView()) >= 0) requestSideDrawerRefresh();
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
    if (selectedIndex === navigation.selectedWaypointIndex) {
      distance = navigation.distanceToNextNm;
      bearing = navigation.bearingToNextDeg;
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
    if (!selected || !selected.waypoint || !flight || !window.isMapHintEnabled('magentaLine')) {
      if (previewLine) previewLayer.removeLayer(previewLine);
      previewLine = null;
      return;
    }
    var points = [
      [flight.lat, flight.lon],
      [selected.waypoint.lat, selected.waypoint.lon]
    ];
    if (!previewLine) {
      previewLine = L.polyline(points, Object.assign({}, window.GAMapLivePresentation.DIRECT_LINE_STYLE, {pane:'gaPreviewPane'})).addTo(previewLayer);
    } else {
      previewLine.setLatLngs(points);
    }
  }

  var telemetryPrevious = null;
  function updateStandaloneTelemetry(sample) {
    var altitude = Math.max(0, Math.round(sample.altFt));
    setText('teleAGL', altitude);
    var altitudeNode = byId('teleAGL');
    if (altitudeNode) altitudeNode.style.color = altitude < 1500 ? '#ff4444' : (altitude < 3000 ? '#ffcc44' : '#8ec5ff');
    var timestamp = sample.capturedAt || Date.now();
    if (!telemetryPrevious || timestamp < telemetryPrevious.timestamp) {
      telemetryPrevious = { timestamp: timestamp, altitude: sample.altFt };
      return;
    }
    var dt = (timestamp - telemetryPrevious.timestamp) / 1000;
    if (dt <= 1) return;
    var vs = (sample.altFt - telemetryPrevious.altitude) / dt * 60;
    setText('teleGS', Number(sample.gsKts).toFixed(1));
    setText('teleVS', Math.round(vs));
    var node = byId('teleVS');
    if (node) node.style.color = vs > 100 ? 'var(--green)' : (vs < -100 ? 'var(--red)' : '#fff');
    telemetryPrevious = { timestamp: timestamp, altitude: sample.altFt };
  }

  function renderProgress() {
    var currentContext = mapSnapshot && mapSnapshot.context || {};
    setText('currentPosRef', currentContext.currentPosition || 'Position aktiv');
    setText('currentFreqValue', currentContext.frequency || '\u2014');
    setText('currentFreqSource', currentContext.frequencySource || '');
    var navigation = mapSnapshot && mapSnapshot.navigation;
    var route = mapSnapshot && mapSnapshot.route;
    var bar = byId('routeProgressBar');
    var next = byId('liveNextWpBox');
    if (!navigation || !route) {
      if (bar) bar.style.display = 'none';
      syncToolbarLayout();
      setInfoBoxAvailability('liveNextWpBox', false);
      if (previewLine && previewLayer) previewLayer.removeLayer(previewLine);
      previewLine = null;
      return;
    }
    var selected = selectedWaypointNavigation();
    if (bar) bar.style.display = 'grid';
    syncToolbarLayout();
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
    var labels = context.waypointLabels || [];
    var label = labels.filter(function (item) { return item.lat === selected.waypoint.lat && item.lon === selected.waypoint.lon; })[0];
    var name = label && label.name || selected.waypoint.name || selected.waypoint.id || 'NEXT';
    setText('nextWpName', name);
    if (label && label.frequency && byId('nextWpName')) {
      byId('nextWpName').innerHTML = drawerEscape(name) + '<div style="font-size:11px;color:#9fd3ff;margin-top:1px;line-height:1.1;">' + drawerEscape(label.frequency) + '</div>';
    }
    setText('nextWpCourse', leftPad(Math.round(selected.bearingDeg || 0), 3) + '\u00b0');
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

  var compassPresentation = window.GAMapLivePresentation.createCompass(document);
  function buildCompass() {
    compassPresentation.buildRose();
    compassPresentation.buildFixed();
    var wrap = byId('compassRoseWrap');
    if (wrap) { wrap.style.display = 'block'; wrap.addEventListener('click', function () { wrap.classList.toggle('compass-minimized'); }); }
  }

  function updateCompass() {
    compassPresentation.updateHeading(flight ? flight.headingDeg : 0);
    var navigation = mapSnapshot && mapSnapshot.navigation;
    if (navigation) {
      var selected = selectedWaypointNavigation();
      compassPresentation.updateInstruments(selected.bearingDeg, navigation.inboundBearingDeg, navigation.crossTrackNm);
    } else {
      var bug = byId('compassBugGroup');
      if (bug) bug.style.display = 'none';
      var cdi = byId('compassCdiSvg');
      if (cdi) cdi.style.display = 'none';
    }
  }

  function ensureProfileEmpty(text) {
    var strip = byId('mapProfileStrip');
    if (!strip) return;
    var node = strip.querySelector('.ga-profile-empty');
    if (!node) { node = document.createElement('div'); node.className = 'ga-profile-empty'; strip.appendChild(node); }
    node.textContent = text || '';
    node.style.display = text ? 'flex' : 'none';
  }

  function setupProfileResize() {
    initProfileResize();
  }

  function renderProfile() {
    window.liveActiveWpIndex = previewWaypointIndex;
    if (window.gaEfbProfile) window.gaEfbProfile.update(mapSnapshot, flight, map);
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

  function openMapContextInfo(latlng, source) {
    if (!map || !latlng) return;
    window.gaOpenMapContextInfo(latlng, source);
  }

  function toggleMapContextPick() {
    contextPickActive = !contextPickActive;
    var button = document.querySelector('.ga-efb-host-context');
    if (button) {
      button.classList.toggle('active', contextPickActive);
      button.textContent = contextPickActive ? 'Was ist hier (An)' : 'Was ist hier';
    }
    if (contextPickActive) { toggleMapDrawMode(false); if (measureMode) toggleMeasureMode(); }
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
      if (mapDrawState.enabled || measureMode || event.isPrimary === false) {
        clearMapContextPress();
        return;
      }
      if (input.inputType === 'touch' && event.touches && event.touches.length !== 1) {
        clearMapContextPress();
        return;
      }
      if (input.inputType !== 'touch' && event.button != null && event.button !== 0) return;
      if (event.target && event.target.closest && event.target.closest('.leaflet-popup, .leaflet-control, button, input, .map-draw-rail, .map-draw-menu')) return;
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
      if (Math.hypot(input.x - mapContextPress.x, input.y - mapContextPress.y) > 12) clearMapContextPress();
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
      if (event.target && event.target.closest && event.target.closest('.ga-map-context-popup')) return;
      if (event.preventDefault) event.preventDefault();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }, true);
  }

  function handleMapClick(event) {
    if (Date.now() < mapContextSuppressClickUntil || isMapUiClickTarget(event.originalEvent)) return;
    if (handleMapDrawMapClick(event)) return;
    if (measureMode) { addMeasurePoint(event.latlng); return; }
    if (contextPickActive) { openMapContextInfo(event.latlng, 'pick-mode'); return; }
    dismissMapContextInfo({ clearHighlight: true });
    if (getMapSingleClickMode() !== 'off') {
      pendingMapInfoTapSeq += 1;
      if (!resolveMapSingleClickAt(event.latlng)) scheduleMapInfoTapResolution(event.latlng);
    }
  }

  function fetchJson(url, timeoutMs) {
    return window.GATrackerCockpitSessionClient.requestJson(fetch, url, { cache: 'no-store' }, timeoutMs || 15000).then(function (result) {
      if (!result.response.ok) throw new Error('HTTP ' + result.response.status);
      return result.body;
    });
  }

  var localFlightRevision = null;
  function disconnectFlight() {
    flight = null;
    telemetryPrevious = null;
    localNavigationState = {};
    window.lastLiveTerrainFt = null;
    window.gaEfbProfile.disconnected();
    refreshLocalNavigation();
    ['liveTelemetryBox','liveCurrentBox','liveNextWpBox'].forEach(function(id){setInfoBoxAvailability(id,false);});
    if (planeMarker) { map.removeLayer(planeMarker); planeMarker = null; }
    updateCompass();
    renderProgress();
  }
  function poll() {
    if (pollingClosed) return;
    fetchJson('/api/v1/snapshot' + (localFlightRevision == null ? '' : '?after=' + localFlightRevision), 2500).then(function (envelope) {
      if (pollingClosed) return;
      if (!trackerOnline) setTrackerState('Tracker verbunden', false);
      trackerOnline = true;
      var payload = safePayload(envelope);
      localFlightRevision = !payload || payload.localRevision == null ? null : payload.localRevision;
      renderFlight(payload);
      notifyParentState('live');
      // Current trackers hold the next request until a fresh source sample.
      // Older hosts retain bounded polling instead of creating a busy loop.
      pollTimer = window.setTimeout(poll, localFlightRevision == null ? 1000 : 0);
    }).catch(function () {
      if (pollingClosed) return;
      trackerOnline = false;
      disconnectFlight();
      setTrackerState('Tracker nicht erreichbar', true);
      notifyParentState('error');
      report('warn', 'poll', 'tracker-unreachable', 'Snapshot-Polling fehlgeschlagen');
      pollTimer = window.setTimeout(poll, 1800);
    });
  }

  function pollAuxiliary(url, receive, interval) {
    if (pollingClosed) return;
    fetchJson(url, 5000).then(function (envelope) {
      if (!pollingClosed) receive(safePayload(envelope));
    }).catch(function () {}).then(function () {
      if (!pollingClosed) auxiliaryPollTimers[url] = window.setTimeout(function () { pollAuxiliary(url, receive, interval); }, interval);
    });
  }

  function pollMission() {
    if (pollingClosed) return;
    fetchJson('/api/v1/mission', 5000).then(function (envelope) {
      if (pollingClosed) return;
      renderMissionPayload(safePayload(envelope));
      missionPollTimer = window.setTimeout(pollMission, missionIntentPending || cargoManagerOpen ? 300 : 550);
    }).catch(function () {
      if (pollingClosed) return;
      missionPollTimer = window.setTimeout(pollMission, 1000);
    });
  }

  function syncProfileButton() {
    var button = byId('vpToggleBtn');
    if (button) button.textContent = preferences.profileVisible ? '\uD83D\uDCCA Profil (An)' : '\uD83D\uDCCA Profil (Aus)';
  }

  function syncToolbarLayout() {
    var collapsed = !!preferences.toolbarCollapsed;
    var bar = byId('routeProgressBar');
    var visible = !!(bar && bar.style.display !== 'none' && mapSnapshot && mapSnapshot.navigation && mapSnapshot.route);
    document.body.classList.toggle('toolbar-collapsed', collapsed);
    document.body.classList.toggle('route-progress-visible', visible);
    if (visible) document.body.style.setProperty('--route-progress-height', Math.round(bar.getBoundingClientRect().height) + 'px');
    var button = byId('mapToolbarToggle');
    if (button) {
      button.textContent = collapsed ? '\u25bc' : '\u25b2';
      button.setAttribute('aria-expanded', String(!collapsed));
      button.setAttribute('aria-label', collapsed ? 'Menüleiste einblenden' : 'Menüleiste ausblenden');
    }
  }

  window.toggleMapToolbar = function () {
    preferences.toolbarCollapsed = !preferences.toolbarCollapsed;
    closeHostMenus();
    syncToolbarLayout();
    savePreferences();
    window.setTimeout(function () {
      syncToolbarLayout();
      if (map) map.invalidateSize(false);
    }, 310);
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
  window.toggleRouteProgressTarget = function () { routeProgressTarget = routeProgressTarget === 'wpt' ? 'route' : 'wpt'; renderProgress(); };
  window.stepLiveNextLegPreview = function (delta, event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    var route = mapSnapshot && mapSnapshot.route;
    var waypoints = route && route.waypoints || [];
    if (!waypoints.length) return;
    var current = previewWaypointIndex == null ? automaticWaypointIndex() : previewWaypointIndex;
    previewWaypointIndex = clamp(current + Number(delta || 0), 0, waypoints.length - 1);
    window.liveActiveWpIndex = previewWaypointIndex;
    // Like the App preview button, evaluate the selected waypoint immediately.
    localNavigationState.lastAdvanceAt = 0;
    refreshLocalNavigation();
    renderProgress(); updateCompass(); renderProfile();
    report('info', 'waypoint-preview', 'select', 'Wegpunktvorschau umgeschaltet', String(previewWaypointIndex));
  };
  window.resetMainRoute = function () { navigationClient.edit({ action: 'reset' }); };
  window.minimizeWin95OverlayWindow = function () {};
  window.closeWin95OverlayWindow = function () { return closeHost('window-close'); };
  window.toggleMapTable = function () { return closeHost('toggle-map-table'); };

  window.addEventListener('pagehide', saveLiveTrail);
  document.addEventListener('visibilitychange', function() { if (document.hidden) saveLiveTrail(); });

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
      configureDisplayControls();
      setupEfbUiCompatibility();
      setFollow(preferences.follow);
      var bootStatus = byId('gaEfbBootStatus');
      if (bootStatus) bootStatus.style.display = 'none';
      report('info', 'boot', 'host-ready', 'Kartentisch und Karte bereit');
      notifyParentState('ready', { stage: 'host-ready' });
      poll();
      pollAuxiliary('/api/v1/status', function (status) {
        if (trackerOnline) setTrackerState(status && status.simulatorConnected ? 'Tracker + Simulator verbunden' : 'Tracker verbunden | warte auf Simulator', false);
      }, 1000);
      pollAuxiliary('/api/v1/map', renderMapPayload, 1000);
      pollAuxiliary('/api/v1/checklists', renderChecklistPayload, 10000);
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
    pollingClosed = true;
    Object.keys(auxiliaryPollTimers).forEach(function (url) { window.clearTimeout(auxiliaryPollTimers[url]); });
    if (pollTimer) window.clearTimeout(pollTimer);
    if (missionPollTimer) window.clearTimeout(missionPollTimer);
    if (efbUiRefreshTimer) window.clearTimeout(efbUiRefreshTimer);
    if (efbUiObserver) efbUiObserver.disconnect();
  });
})();
