(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAMissionControlUiCore = api;
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var ACTION_LABELS = Object.freeze({
    activate_cloud_mission: 'Mission aus der Cloud beginnen',
    prepare_mission: 'Mission vorbereiten',
    start_boarding: 'Boarding und Verladen beginnen',
    start_mission: 'Mission starten',
    request_close: 'Mission beenden'
  });
  var PRIMARY_ACTIONS = Object.freeze([
    'activate_cloud_mission',
    'prepare_mission',
    'start_boarding',
    'start_mission',
    'request_close'
  ]);

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeTone(value, fallback) {
    var tone = String(value || fallback || 'active').toLowerCase();
    return /^(active|good|warn|danger|muted|neutral|info)$/.test(tone) ? tone : String(fallback || 'active');
  }

  function clampPct(value) {
    return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  }

  function valueOf(row, first, second, fallback) {
    if (row && row[first] != null && row[first] !== '') return row[first];
    if (row && row[second] != null && row[second] !== '') return row[second];
    return fallback == null ? '' : fallback;
  }

  function formatNumber(value, digits) {
    var number = Number(value);
    return Number.isFinite(number) ? number.toFixed(digits) : '';
  }

  function padHeading(value) {
    var text = String(Math.round(Number(value) || 0));
    while (text.length < 3) text = '0' + text;
    return text;
  }

  function formatTime(value) {
    var date = new Date(Number(value) || Date.now());
    try {
      return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (_) {
      return date.toTimeString().slice(0, 8);
    }
  }

  function projectLiveFields(viewInput) {
    var view = viewInput && typeof viewInput === 'object' ? viewInput : {};
    var flight = view.flight && typeof view.flight === 'object' ? view.flight : {};
    var target = view.target && typeof view.target === 'object' ? view.target : {};
    return {
      targetLine: target.distanceNm != null && Number.isFinite(Number(target.distanceNm))
        ? formatNumber(target.distanceNm, 1) + ' NM · ' + padHeading(target.bearingDeg) + '°'
        : (flight.trackerLive ? 'Zielposition offen' : 'Tracker wartet'),
      altitudeLine: flight.mslFt != null && Number.isFinite(Number(flight.mslFt))
        ? Math.round(Number(flight.mslFt)).toLocaleString('de-DE') + ' ft MSL'
        : 'Keine Live-Höhe',
      altitudeDetail: flight.aglFt != null && Number.isFinite(Number(flight.aglFt))
        ? Math.round(Number(flight.aglFt)).toLocaleString('de-DE') + ' ft AGL'
        : (flight.gsKts != null && Number.isFinite(Number(flight.gsKts)) ? Math.round(Number(flight.gsKts)) + ' kt GS' : 'Live-Daten offen')
    };
  }

  function missionToolbarModel(input, options) {
    var envelope = input && typeof input === 'object' ? input : {};
    var settings = options && typeof options === 'object' ? options : {};
    var control = settings.control && typeof settings.control === 'object'
      ? settings.control
      : (envelope.control && typeof envelope.control === 'object'
        ? envelope.control
        : (envelope.executionAuthority ? envelope : null));
    if (!control || control.executionAuthority !== 'tracker') return null;
    var allowed = Array.isArray(control.allowedActions) ? control.allowedActions : [];
    var phase = String(control.phase || envelope.phase || envelope.state || '').toLowerCase();
    var missionId = String(control.missionId || envelope.missionId || '');
    var runId = String(control.runId || envelope.runId || '');
    var banner = settings.banner && typeof settings.banner === 'object'
      ? settings.banner
      : (envelope.ui && envelope.ui.banner && typeof envelope.ui.banner === 'object'
        ? envelope.ui.banner
        : null);
    var primary = null;
    if (banner && (banner.kind === 'intent' || banner.kind === 'cargo')) {
      var bannerIntent = String(banner.intent || '');
      var bannerCargoMode = String(banner.cargoMode || (/^(end_unloading|end_ready)$/.test(phase) ? 'unload' : (phase === 'on_task' ? 'pickup' : 'load')));
      primary = {
        kind: banner.kind,
        intent: bannerIntent,
        cargoMode: bannerCargoMode,
        label: banner.kind === 'cargo'
          ? (bannerCargoMode === 'unload' ? 'Entladung' : (bannerCargoMode === 'pickup' ? 'Pickup' : 'Verladung'))
          : (bannerIntent === 'request_close' ? 'Mission beenden'
            : (bannerIntent === 'start_boarding' ? 'Boarding' : String(banner.button || ACTION_LABELS[bannerIntent] || 'Mission fortsetzen'))),
        title: String(banner.text || banner.kicker || 'Aktuelle Missionsaktion ausführen'),
        disabled: banner.disabled === true
      };
    } else {
      var intent = '';
      PRIMARY_ACTIONS.some(function (candidate) {
        if (allowed.indexOf(candidate) < 0) return false;
        intent = candidate;
        return true;
      });
      if (intent) {
        primary = {
          kind: 'intent',
          intent: intent,
          cargoMode: '',
          label: intent === 'request_close' ? 'Mission beenden'
            : (intent === 'start_boarding' ? 'Boarding' : (ACTION_LABELS[intent] || intent)),
          title: ACTION_LABELS[intent] || 'Aktuelle Missionsaktion ausführen',
          disabled: false
        };
      }
    }
    var activeRun = !!(missionId && runId && allowed.indexOf('abort_mission') >= 0);
    return {
      schema: 'ga.mission-toolbar.v1',
      missionId: missionId,
      runId: runId,
      phase: phase,
      primary: primary,
      cargo: {
        visible: activeRun,
        mode: /^(end_unloading|end_ready)$/.test(phase) ? 'unload' : (phase === 'on_task' ? 'pickup' : 'load'),
        label: 'Verladung',
        title: 'Verlade-Manager mit dem aktuellen Tracker-Stand öffnen',
        disabled: false
      },
      reset: {
        visible: activeRun,
        intent: 'abort_mission',
        label: 'Mission Reset',
        title: 'Mission auf allen Ansichten zurücksetzen',
        disabled: false
      }
    };
  }

  function renderEmpty() {
    return '<div class="mission-control-empty">'
      + '<span aria-hidden="true">&#9678;</span>'
      + '<b>Keine aktive Mission</b>'
      + '<p>Nach dem Annehmen eines Auftrags erscheinen hier Aufgabe, Bedingungen, Live-Fortschritt, Pax-Stimmung und Ladungszustand.</p>'
      + '</div>';
  }

  function renderActions(control, options) {
    var settings = options || {};
    var allowed = control && Array.isArray(control.allowedActions) ? control.allowedActions : [];
    if (!control || control.executionAuthority !== 'tracker') return '';
    var disabled = settings.intentPending === true ? ' disabled' : '';
    var actionHtml = PRIMARY_ACTIONS.filter(function (intent) {
      return allowed.indexOf(intent) >= 0;
    }).map(function (intent) {
      return '<button type="button" data-action="mission-control-intent" data-efb-drawer-action="mission-intent" data-mission-intent="'
        + escapeHtml(intent) + '"' + disabled + '>' + escapeHtml(ACTION_LABELS[intent] || intent) + '</button>';
    }).join('');
    var abortHtml = allowed.indexOf('abort_mission') >= 0
      ? '<div class="mission-control-actions is-danger"><button type="button" data-action="mission-control-intent" data-efb-drawer-action="mission-intent" data-mission-intent="abort_mission"'
        + disabled + '>Mission abbrechen</button></div>'
      : '';
    var status = String(settings.intentStatus || '');
    var statusTone = safeTone(settings.intentTone || (/abgelehnt|fehlgeschlagen|nicht verfuegbar|nicht verfügbar/i.test(status) ? 'danger' : 'info'), 'info');
    return '<section class="mission-control-card mission-control-operations">'
      + '<div class="mission-control-section-kicker">BEDIENUNG</div>'
      + '<div class="mission-control-actions"><button type="button" data-action="mission-control-open-cargo" data-efb-drawer-action="open-cargo"'
      + disabled + '>Verlade-Manager öffnen</button></div>'
      + (actionHtml ? '<div class="mission-control-actions">' + actionHtml + '</div>' : '')
      + abortHtml
      + (status ? '<p class="mission-control-intent-status is-' + statusTone + '">' + escapeHtml(status) + '</p>' : '')
      + '</section>';
  }

  function render(viewInput, options) {
    var view = viewInput && viewInput.view && typeof viewInput.view === 'object' ? viewInput.view : viewInput;
    var settings = options || {};
    if (!view || typeof view !== 'object') return renderEmpty();
    var flight = view.flight && typeof view.flight === 'object' ? view.flight : {};
    var target = view.target && typeof view.target === 'object' ? view.target : {};
    var phase = view.phase && typeof view.phase === 'object' ? view.phase : {};
    var stages = Array.isArray(phase.stages) ? phase.stages : [];
    var current = Math.max(0, Math.min(Math.max(0, stages.length - 1), Math.round(Number(phase.current) || 0)));
    var story = String(view.story || view.detail || '');
    var storyExpandable = story.length > 160;
    var expanded = settings.storyExpanded === true;
    var taskTone = safeTone(view.taskTone, 'active');
    var liveFields = projectLiveFields(view);
    var targetLine = liveFields.targetLine;
    var altitudeLine = liveFields.altitudeLine;
    var altitudeDetail = liveFields.altitudeDetail;
    var phaseHtml = stages.map(function (stage, index) {
      var label = stage && typeof stage === 'object' ? stage.label : stage;
      return '<div class="mission-control-phase' + (index < current ? ' is-done' : '') + (index === current ? ' is-current' : '') + '">'
        + '<span>' + (index < current ? '&#10003;' : String(index + 1)) + '</span><b>' + escapeHtml(label || 'Phase') + '</b></div>';
    }).join('');
    var progressHtml = (Array.isArray(view.progress) ? view.progress : []).map(function (row) {
      var pct = clampPct(row && row.percent);
      var tone = safeTone(row && row.tone, pct >= 100 ? 'good' : 'active');
      return '<div class="mission-control-progress-row"><div class="mission-control-progress-head"><span>'
        + escapeHtml(row && row.label) + '</span><b>' + escapeHtml(valueOf(row, 'detail', 'value', '')) + '</b></div>'
        + '<div class="mission-control-progress-track is-' + tone + '"><span style="width:' + pct + '%"></span></div></div>';
    }).join('');
    var requirementsHtml = (Array.isArray(view.requirements) ? view.requirements : []).map(function (row) {
      return '<div class="mission-control-requirement is-' + safeTone(valueOf(row, 'state', 'tone', 'neutral'), 'neutral') + '"><span>'
        + escapeHtml(row && row.label) + '</span><b>' + escapeHtml(valueOf(row, 'value', 'detail', '')) + '</b></div>';
    }).join('');
    var feedbackHtml = (Array.isArray(view.feedback) ? view.feedback : []).map(function (row) {
      var tone = safeTone(row && row.tone, 'info');
      var icon = tone === 'danger' ? '!' : (tone === 'warn' ? '&#9651;' : (tone === 'good' ? '&#10003;' : 'i'));
      return '<div class="mission-control-feedback is-' + tone + '"><span aria-hidden="true">' + icon + '</span><p>'
        + escapeHtml(valueOf(row, 'text', 'detail', '')) + '</p></div>';
    }).join('');
    var comfort = view.comfort && typeof view.comfort === 'object' ? view.comfort : {};
    var cargo = view.cargo && typeof view.cargo === 'object' ? view.cargo : {};
    var control = settings.control || (viewInput && viewInput.control) || null;
    return '<div class="mission-control-shared" data-mission-control-schema="ga.efb-mission-view.v1">'
      + '<section class="mission-control-hero is-' + taskTone + '"><div class="mission-control-hero-top">'
      + '<span class="mission-control-live' + (flight.trackerLive ? ' is-live' : '') + '">' + (flight.trackerLive ? '&#9679; LIVE' : '&#9675; STANDBY') + '</span>'
      + '<span>' + escapeHtml(view.status || 'Mission aktiv') + '</span></div><h3>' + escapeHtml(view.title || 'Aktive Mission') + '</h3>'
      + '<div class="mission-control-story ' + (storyExpandable ? (expanded ? 'is-expanded' : 'is-collapsed') : 'is-static') + '"><p id="missionControlStory">'
      + escapeHtml(story) + '</p>'
      + (storyExpandable ? '<button class="mission-control-story-toggle" type="button" data-action="toggle-mission-story" data-efb-drawer-action="toggle-mission-story" aria-controls="missionControlStory" aria-expanded="'
        + (expanded ? 'true' : 'false') + '"><span>' + (expanded ? 'Missionstext einklappen' : 'Gesamten Missionstext lesen') + '</span><b aria-hidden="true">'
        + (expanded ? '&#8963;' : '&#8964;') + '</b></button>' : '')
      + '</div></section>'
      + '<section class="mission-control-order is-' + taskTone + '"><div class="mission-control-section-kicker">AKTUELLER AUFTRAG</div>'
      + '<div class="mission-control-order-text">' + escapeHtml(view.currentTask || 'Missionsstatus prüfen') + '</div>'
      + '<div class="mission-control-order-detail">' + escapeHtml(view.detail || '') + '</div></section>'
      + (phaseHtml ? '<section class="mission-control-card"><div class="mission-control-section-kicker">MISSIONSVERLAUF</div><div class="mission-control-phase-rail">' + phaseHtml + '</div></section>' : '')
      + '<div class="mission-control-metrics"><div class="mission-control-metric"><span>ZIEL</span><b id="gaEfbMissionTargetLine">' + escapeHtml(targetLine) + '</b><small>'
      + escapeHtml(target.name || '') + '</small></div><div class="mission-control-metric"><span>FLUGHÖHE</span><b id="gaEfbMissionAltitude">'
      + escapeHtml(altitudeLine) + '</b><small id="gaEfbMissionAltitudeDetail">' + escapeHtml(altitudeDetail) + '</small></div></div>'
      + (progressHtml ? '<section class="mission-control-card"><div class="mission-control-section-kicker">LIVE-FORTSCHRITT</div>' + progressHtml + '</section>' : '')
      + (requirementsHtml ? '<section class="mission-control-card"><div class="mission-control-section-kicker">BEDINGUNGEN</div><div class="mission-control-requirements">' + requirementsHtml + '</div></section>' : '')
      + '<div class="mission-control-condition-grid"><section class="mission-control-condition is-' + safeTone(comfort.tone, 'muted') + '"><span>PAX-STIMMUNG</span><strong>'
      + (comfort.score == null ? '—' : escapeHtml(comfort.score) + '%') + '</strong><b>' + escapeHtml(comfort.state || 'Keine Wertung') + '</b><small>'
      + escapeHtml(comfort.detail || '') + '</small></section><section class="mission-control-condition is-' + safeTone(cargo.tone, 'muted') + '"><span>LADUNGSZUSTAND</span><strong>'
      + (cargo.conditionPct == null ? '—' : escapeHtml(cargo.conditionPct) + '%') + '</strong><b>' + escapeHtml(cargo.state || 'Keine Ladung') + '</b><small>'
      + escapeHtml(cargo.detail || '') + '</small></section></div>'
      + renderActions(control, settings)
      + (feedbackHtml ? '<section class="mission-control-card"><div class="mission-control-section-kicker">LAGEBERICHT</div><div class="mission-control-feedback-list">' + feedbackHtml + '</div></section>' : '')
      + '<div class="mission-control-updated">Stand ' + escapeHtml(formatTime(view.capturedAt || settings.now)) + ' · aktualisiert sich automatisch</div>'
      + '</div>';
  }

  function formatIntentResult(result) {
    var value = result && typeof result === 'object' ? result : {};
    if (value.pending === true) return { tone: 'info', text: 'Tracker verarbeitet die Aktion ...' };
    if (value.ok === true || /^(ok|noop|accepted)$/.test(String(value.status || '').toLowerCase())) {
      return { tone: 'good', text: 'Aktion bestätigt. Der Missionsstand wurde auf allen Ansichten aktualisiert.' };
    }
    var error = String(value.error || value.status || '').toLowerCase();
    if (error === 'mission_revision_conflict') {
      return { tone: 'warn', text: 'Eine andere Ansicht war schneller. Der aktuelle Missionsstand wurde übernommen.' };
    }
    if (error === 'cockpit_session_unavailable' || error === 'mission_execution_authority_web') {
      return { tone: 'danger', text: 'Der Tracker ist für diese Aktion noch nicht erreichbar.' };
    }
    if (/not_allowed|not_ready|invalid_phase|blocked|manifest/.test(error)) {
      return { tone: 'warn', text: 'Diese Aktion ist im aktuellen Missionsschritt nicht verfügbar.' };
    }
    return { tone: 'danger', text: 'Die Tracker-Aktion konnte nicht ausgeführt werden. Bitte den aktuellen Missionsstand erneut prüfen.' };
  }

  function abortConfirmation() {
    return 'Mission wirklich abbrechen?\n\nDer Tracker beendet die Mission auf allen verbundenen Ansichten und entfernt ihre Sim-Objekte. Der Flug wird nicht als abgeschlossen gewertet.';
  }

  return Object.freeze({
    ACTION_LABELS: ACTION_LABELS,
    render: render,
    renderEmpty: renderEmpty,
    projectLiveFields: projectLiveFields,
    missionToolbarModel: missionToolbarModel,
    formatIntentResult: formatIntentResult,
    abortConfirmation: abortConfirmation
  });
}));
