(function (root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAMissionControlUiCore = api;
}(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  var BUILD_ID = 'tracker-mission-ui-20261118-02';

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

  // Cargo needs a loaded aircraft. MSFS main menu, World Map, hangar and loading
  // screens report worldReady=false; without readiness data (no sim view) stay as before.
  function cargoWorldAvailable(control) {
    var readiness = control && control.startReadiness;
    if (!readiness || typeof readiness !== 'object') return true;
    if (readiness.worldReady === true) return true;
    if (['simulator_not_ready', 'cockpit_not_loaded', 'position_not_ready'].indexOf(readiness.reason) >= 0) return false;
    // A briefly stale sample in a live camera view (2..8) is not a menu.
    var camera = readiness.cameraState;
    return readiness.reason === 'telemetry_stale' && typeof camera === 'number' && camera >= 2 && camera <= 8;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Display only: models and tracker views stay German (some callers compare them); the
  // rendered HTML and returned dialog texts are translated when English is selected.
  function i18nApi() {
    var host = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
    var api = host && host.GAI18n;
    return api && typeof api.phrase === 'function' && typeof api.getLanguage === 'function' ? api : null;
  }
  function numberLocale() {
    var api = i18nApi();
    return api && typeof api.locale === 'function' ? api.locale() : 'de-DE';
  }
  function dot(value) { return String(value).replace(',', '.'); }
  var PLACE_EN = { 'am Startplatz': 'at the departure airfield', 'am Zielplatz': 'at the destination airfield', 'am Speicherpunkt': 'at the save point' };
  var TASK_LABELS_EN = { 'POI-Auftrag': 'POI task', 'Auftrag im Zielgebiet': 'Task in the target area', 'Recon-/Arbeitsauftrag im Zielgebiet': 'Recon/work task in the target area',
    'Feuerbeobachtung': 'Fire watch', 'Suchauftrag': 'Search task', 'Trainingsaufgabe': 'Training task', 'Flyover-Auftrag': 'Flyover task' };
  function lowerFirst(value) {
    var text = String(value);
    return /^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
  }
  function taskLabel(german) {
    var key = Object.keys(TASK_LABELS_EN).filter(function (k) { return k.toLowerCase() === String(german).toLowerCase(); })[0];
    return key ? TASK_LABELS_EN[key] : String(german);
  }
  // Sentences the interruption model and the tracker mission view build from numbers.
  var DISPLAY_PATTERNS = [
    [/^ Noch ([\d,.]+) NM, Kurs (\d{3})°\.$/, function (m) { return ' ' + dot(m[1]) + ' NM to go, course ' + m[2] + '°.'; }],
    [/^Zum Fortsetzen an den Speicherpunkt fliegen \(([\d,.]+) NM Zone\)\. Die Mission läuft weiter, sobald du dort 10 Sekunden normal fliegst\.([\s\S]*)$/,
      function (m) { return 'To continue, fly to the save point (' + dot(m[1]) + ' NM zone). The mission continues once you have flown normally there for 10 seconds.' + displayText(m[2]); }],
    [/^Flugzeug (am Startplatz|am Zielplatz|am Speicherpunkt)( .+?)? abstellen \(innerhalb ([\d,.]+) NM\)\. Die Mission läuft weiter, sobald es dort 5 Sekunden am Boden steht\.([\s\S]*)$/,
      function (m) { return 'Park the aircraft ' + PLACE_EN[m[1]] + (m[2] || '') + ' (within ' + dot(m[3]) + ' NM). The mission continues once it has stood on the ground there for 5 seconds.' + displayText(m[4]); }],
    [/^(\d+) geladen \/ (\d+) entladen$/, function (m) { return m[1] + ' loaded / ' + m[2] + ' unloaded'; }],
    [/^(\d+) Positionen noch offen$/, function (m) { return m[1] + (m[1] === '1' ? ' item still open' : ' items still open'); }],
    [/^(\d+)\/(\d+) an Bord · Zustand (\d+)%$/, function (m) { return m[1] + '/' + m[2] + ' on board · condition ' + m[3] + '%'; }],
    [/^(\d+)\/(\d+) an Bord$/, function (m) { return m[1] + '/' + m[2] + ' on board'; }],
    [/^(\d+) Pilot · (\d+) Wetter$/, function (m) { return m[1] + ' pilot · ' + m[2] + ' weather'; }],
    [/^(\d+)\/(\d+) Übungen erfüllt · ([\s\S]+)$/, function (m) { return m[1] + '/' + m[2] + ' exercises done · ' + displayText(m[3]); }],
    [/^(\d+)\/(\d+) erfüllte Übungen · ([\s\S]+)$/, function (m) { return m[1] + '/' + m[2] + ' exercises done · ' + displayText(m[3]); }],
    [/^(\d+:\d\d) \/ (\d+:\d\d)( · erfüllt| · Sichtung im PAX-Menü melden)?$/, function (m) {
      return m[1] + ' / ' + m[2] + (m[3] ? (m[3] === ' · erfüllt' ? ' · done' : ' · report sightings in the PAX menu') : ''); }],
    [/^(\d+)\/(\d+) abgeschlossen · laufender Abschnitt (\d+)%$/, function (m) { return m[1] + '/' + m[2] + ' complete · current section ' + m[3] + '%'; }],
    [/^(\d+)\/(\d+) dokumentiert$/, function (m) { return m[1] + '/' + m[2] + ' documented'; }],
    [/^(\d+)\/(\d+) Abschnitte · laufend (\d+)%$/, function (m) { return m[1] + '/' + m[2] + ' sections · current ' + m[3] + '%'; }],
    [/^Beschädigt: ([\s\S]+)\.$/, function (m) { return 'Damaged: ' + m[1] + '.'; }],
    [/^Abgeworfen: ([\s\S]+)\.$/, function (m) { return 'Dropped: ' + m[1] + '.'; }],
    [/^Noch nicht geladen: ([\s\S]+)\.$/, function (m) { return 'Not loaded yet: ' + m[1] + '.'; }],
    [/^([\s\S]+): nicht an Bord; entladen zählt in der bestehenden POI-Prüfung nicht als fehlend\.$/, function (m) {
      return m[1] + ': not on board; unloaded items do not count as missing in the POI check.'; }],
    [/^Ladung bei (\d+) %\. Ruhiger weiterfliegen\.$/, function (m) { return 'Cargo at ' + m[1] + ' %. Fly more smoothly.'; }],
    [/^([\s\S]+) bei (\d+) %: Pflichtladung zerstört, der Auftrag ist so nicht mehr erfüllbar\.$/, function (m) {
      return m[1] + ' at ' + m[2] + ' %: required cargo destroyed, the task can no longer be completed.'; }],
    [/^([\s\S]+) bei (\d+) %: kaputt\. Keine Pflichtladung, der Auftrag hängt nicht daran\.$/, function (m) {
      return m[1] + ' at ' + m[2] + ' %: broken. Not required cargo, the task does not depend on it.'; }],
    [/^([\s\S]+) bei (\d+) %: da ist wohl etwas zu Bruch gegangen\. Bei 35 % ist Pflichtladung verloren\.$/, function (m) {
      return m[1] + ' at ' + m[2] + ' %: something seems to have broken. At 35 % required cargo is lost.'; }],
    [/^(\d+) auffällige Flugbewegungen, davon (\d+) schwer\.$/, function (m) { return m[1] + ' noticeable flight movements, ' + m[2] + ' of them severe.'; }],
    [/^(\d+) Wetterereignisse; getrennt von Pilotenereignissen gewertet\.$/, function (m) { return m[1] + ' weather events; rated separately from pilot events.'; }],
    [/^Radius ([\d.]+) NM · aktuell (unbekannt|[\d.]+ NM)$/, function (m) { return 'Radius ' + m[1] + ' NM · now ' + (m[2] === 'unbekannt' ? 'unknown' : m[2]); }],
    [/^(\d+) ft MSL( ± \d+ ft)? · aktuell (unbekannt|-?\d+ ft MSL)$/, function (m) { return m[1] + ' ft MSL' + (m[2] || '') + ' · now ' + (m[3] === 'unbekannt' ? 'unknown' : m[3]); }],
    [/^(\d+:\d\d) erforderlich$/, function (m) { return m[1] + ' required'; }],
    [/^(\d+) Kreise bei ([\d.]+) NM Radius$/, function (m) { return m[1] + ' circles at ' + m[2] + ' NM radius'; }],
    [/^(\d+) Scanlinien vollständig abfliegen$/, function (m) { return 'Fly all ' + m[1] + ' scan lines completely'; }],
    [/^Nächster Punkt: ([\s\S]+) · Radius ([\d.]+) NM$/, function (m) { return 'Next point: ' + m[1] + ' · radius ' + m[2] + ' NM'; }],
    [/^Suchgebiet ([\d.]+) NM · Sichtung über PAX melden$/, function (m) { return 'Search area ' + m[1] + ' NM · report sightings via PAX'; }],
    [/^([\s\S]+) anfliegen$/, function (m) { return 'Fly to ' + m[1]; }],
    // Loading manager and mission banner (mission-apt-ui-core.js, mission-cargo-core.js).
    [/^(\d+) Sek\.$/, function (m) { return m[1] + ' s'; }],
    [/^Du stehst am Ziel\. ([\d.]+) NM zum Empfangspunkt\.$/, function (m) { return 'You are at the destination. ' + m[1] + ' NM to the reception point.'; }],
    [/^seit (\d+) (Tag|Tagen) abgelaufen$/, function (m) { return 'expired ' + m[1] + (m[1] === '1' ? ' day ago' : ' days ago'); }],
    [/^noch (\d+) (Tag|Tage) g(?:ue|ü)ltig$/, function (m) { return 'valid for ' + m[1] + (m[1] === '1' ? ' more day' : ' more days'); }],
    [/^Gültig bis ([\s\S]+)$/, function (m) { return 'Valid until ' + m[1]; }],
    [/^Pickup ist nur im Stillstand am (Zielplatz|Zielstrip) m(?:oe|ö)glich\.$/, function (m) {
      return 'Pickup is only possible when stationary at the ' + (m[1] === 'Zielplatz' ? 'destination airfield' : 'destination strip') + '.'; }],
    [/^Hier l(?:ae|ä)dst du ([\s\S]+) am (Zielplatz|Zielstrip) ein\. Erst nach Unterschrift und Best(?:ae|ä)tigung wird der R(?:ue|ü)ckflug freigegeben\.$/, function (m) {
      var what = { 'wartenden Pickup-Gast und seine Begleitfracht': 'the waiting pickup guest and their accompanying cargo', 'Rueckholfracht': 'the return cargo', 'wartenden Pickup-Gast': 'the waiting pickup guest' }[m[1]] || m[1];
      return 'Here you load ' + what + ' at the ' + (m[2] === 'Zielplatz' ? 'destination airfield' : 'destination strip') + '. The return flight is released only after signing and confirming.'; }],
    [/^Pickup am (Zielplatz|Zielstrip)$/, function (m) { return 'Pickup at the ' + (m[1] === 'Zielplatz' ? 'destination airfield' : 'destination strip'); }],
    [/^(\d+) Pflicht-Items noch zu entladen$/, function (m) { return m[1] + ' required items still to unload'; }],
    [/^(\d+) Pflicht-Items offen$/, function (m) { return m[1] + ' required items open'; }],
    [/^(\d+) Pickup-Items offen$/, function (m) { return m[1] + ' pickup items open'; }],
    [/^(\d+) Bord-Items an Bord$/, function (m) { return m[1] + ' onboard items on board'; }],
    [/^(\d+) lbs an Bord$/, function (m) { return m[1] + ' lbs on board'; }],
    [/^(\d+) lbs entladen$/, function (m) { return m[1] + ' lbs unloaded'; }],
    [/^Distanz (\d+) m$/, function (m) { return 'Distance ' + m[1] + ' m'; }],
    [/^(Gesamt|Leer|Fuel|Pax|Cargo|Zusatz) (\S+) lbs$/, function (m) { return displayText(m[1]) + ' ' + m[2] + ' lbs'; }],
    [/^(Abflug und Boarding|Auftrag am Ziel|Ankunft und Entladung|Synchroner Missionsstand)\. Jede Änderung wird direkt an den Tracker gesendet und auf allen verbundenen Ansichten aktualisiert\.$/, function (m) {
      return displayText(m[1]) + '. Every change is sent straight to the tracker and updated on all connected views.'; }],
    [/^Die automatische Sim-Zuladung ist bei diesem Flugzeug nicht moeglich\.(?: Missionszuladung: (\d+) lbs\.)?(?: Zielwerte: ([\s\S]+?)\.)? Wenn du die Zuladung im Simulator abbilden moechtest, setze diese Werte bitte manuell im Weight-&-Balance- oder Tablet-Menue\. Die Mission kann trotzdem gestartet werden\.$/, function (m) {
      return 'Automatic sim payload is not possible for this aircraft.' + (m[1] ? ' Mission payload: ' + m[1] + ' lbs.' : '') + (m[2] ? ' Target values: ' + m[2] + '.' : '')
        + ' If you want the payload in the simulator, please set these values manually in the weight & balance or tablet menu. The mission can still be started.'; }],
    [/^Sim-Zuladung noch nicht synchron \(([^)]+)\)\.$/, function (m) { return 'Sim payload not in sync yet (' + m[1] + ').'; }],
    [/^Sim-Gewichte nicht verfügbar \(([^)]+)\)\.$/, function (m) { return 'Sim weights not available (' + m[1] + ').'; }],
    [/^Accu-Sim Comanche · Sitze S2\/S3\/S4 · Baggage S5 \(max\. (\d+) lbs\)$/, function (m) { return 'Accu-Sim Comanche · seats S2/S3/S4 · baggage S5 (max. ' + m[1] + ' lbs)'; }],
    // POI status lines (mission-poi-lifecycle-core.js _missionPoiRuntimeStatus, mission outcome).
    [/^(POI-Auftrag|Auftrag im Zielgebiet|Recon-\/Arbeitsauftrag im Zielgebiet|Feuerbeobachtung|Suchauftrag|Trainingsaufgabe|Flyover-Auftrag) wurde nicht abgeschlossen\.$/, function (m) { return taskLabel(m[1]) + ' was not completed.'; }],
    [/^(POI-Auftrag|Auftrag im Zielgebiet|Recon-\/Arbeitsauftrag im Zielgebiet|Feuerbeobachtung|Suchauftrag|Trainingsaufgabe|Flyover-Auftrag) wurde im Zielgebiet abgebrochen\.$/, function (m) { return taskLabel(m[1]) + ' was aborted in the target area.'; }],
    [/^(POI-Auftrag|Auftrag im Zielgebiet|Recon-\/Arbeitsauftrag im Zielgebiet|Feuerbeobachtung|Suchauftrag|Trainingsaufgabe|Flyover-Auftrag)-Status noch nicht sicher verfügbar\.$/, function (m) { return taskLabel(m[1]) + ' status not reliably available yet.'; }],
    [/^(POI-Auftrag|Auftrag im Zielgebiet|Recon-\/Arbeitsauftrag im Zielgebiet|Feuerbeobachtung|Suchauftrag|Trainingsaufgabe|Flyover-Auftrag) fehlgeschlagen\.$/, function (m) { return taskLabel(m[1]) + ' failed.'; }],
    [/^(POI-Auftrag|Auftrag im Zielgebiet|Recon-\/Arbeitsauftrag im Zielgebiet|Feuerbeobachtung|Suchauftrag|Trainingsaufgabe|Flyover-Auftrag) erfüllt\. ([\s\S]+)$/, function (m) { return taskLabel(m[1]) + ' done. ' + displayText(m[2]); }],
    [/^(POI-Auftrag|Auftrag im Zielgebiet|Recon-\/Arbeitsauftrag im Zielgebiet|Feuerbeobachtung|Suchauftrag|Trainingsaufgabe|Flyover-Auftrag) noch offen\. Arbeitszeit im Zielgebiet: (\d+)s(?: · Hinweise: (\d+))?\.$/, function (m) {
      return taskLabel(m[1]) + ' still open. Work time in the target area: ' + m[2] + 's' + (m[3] ? ' · hints: ' + m[3] : '') + '.'; }],
    [/^Nächster Schritt: Zielgebiet anfliegen und ([\s\S]+) erfuellen$/, function (m) { return 'Next step: fly to the target area and complete the ' + lowerFirst(taskLabel(m[1])); }],
    [/^Nächster Schritt: (POI-Auftrag|Auftrag im Zielgebiet|Recon-\/Arbeitsauftrag im Zielgebiet|Feuerbeobachtung|Suchauftrag|Trainingsaufgabe|Flyover-Auftrag) sauber erfuellen und danach landen$/, function (m) { return 'Next step: complete the ' + lowerFirst(taskLabel(m[1])) + ' cleanly and then land'; }],
    [/^SAR-Heli: Patient am medizinischen Ziel ([\s\S]+) uebergeben\.$/, function (m) { return 'SAR heli: patient handed over at the medical destination ' + m[1] + '.'; }],
    [/^SAR-Heli: Patient aufgenommen\. Medizinisches Ziel: ([\s\S]+)\.$/, function (m) { return 'SAR heli: patient on board. Medical destination: ' + m[1] + '.'; }],
    [/^Training Pflichtteil abgeschlossen\. Pflichtuebungen: (\d+)\/(\d+)(?:, optionale Uebungen offen: (\d+))?\.$/, function (m) {
      return 'Required training part complete. Required exercises: ' + m[1] + '/' + m[2] + (m[3] ? ', optional exercises open: ' + m[3] : '') + '.'; }],
    [/^Trainingshoehe erreicht\. Pflichtuebungen offen: (\d+)\/(\d+)\.$/, function (m) { return 'Training altitude reached. Required exercises open: ' + m[1] + '/' + m[2] + '.'; }],
    [/^Training wartet auf passende Trainingshoehe\. Pflichtuebungen offen: (\d+)\/(\d+)\.$/, function (m) { return 'Training is waiting for a suitable training altitude. Required exercises open: ' + m[1] + '/' + m[2] + '.'; }],
    [/^Training offen\. Pflichtuebungen abgeschlossen: (\d+)\/(\d+)(?:, aktuell: ([\s\S]+))?\.$/, function (m) {
      return 'Training open. Required exercises complete: ' + m[1] + '/' + m[2] + (m[3] ? ', current: ' + displayText(m[3]) : '') + '.'; }],
    [/^Nächster Schritt: Trainingsuebung fliegen: ([\s\S]+)$/, function (m) { return 'Next step: fly the training exercise: ' + displayText(m[1]); }],
    [/^Infrastruktur-Kette erfüllt\. Alle (\d+) Punkte sind abgeschlossen\.$/, function (m) { return 'Infrastructure chain done. All ' + m[1] + ' points are complete.'; }],
    [/^Infrastruktur-Kette offen\. Punkte abgeschlossen: (\d+)\/(\d+)\.$/, function (m) { return 'Infrastructure chain open. Points complete: ' + m[1] + '/' + m[2] + '.'; }],
    [/^Nächster Schritt: nächsten markierten Punkt anfliegen: ([\s\S]+)$/, function (m) { return 'Next step: fly to the next marked point: ' + m[1]; }],
    [/^Mapping\/Survey offen\. (Kreise|Linien) abgeschlossen: (\d+)\/(\d+)\.$/, function (m) { return 'Mapping/survey open. ' + (m[1] === 'Kreise' ? 'Circles' : 'Lines') + ' complete: ' + m[2] + '/' + m[3] + '.'; }]
  ];
  function displayText(value) {
    var source = value == null ? '' : String(value);
    var api = i18nApi();
    if (!api || !source || api.getLanguage() === 'de') return source;
    var exact = api.phrase(source);
    if (exact !== source) return exact;
    for (var i = 0; i < DISPLAY_PATTERNS.length; i++) {
      var build = DISPLAY_PATTERNS[i][1];
      var match = DISPLAY_PATTERNS[i][0].exec(source);
      if (match) return build(match);
    }
    // "Kicker: sentence" as joined by the interruption view, or "Label: value".
    var joined = /^([^:]{2,60}): ([\s\S]+)$/.exec(source);
    if (joined) {
      var left = api.phrase(joined[1]);
      if (left !== joined[1]) {
        var right = displayText(joined[2]);
        // "Next step: end mission" (the German imperative is capitalised as a button text).
        return left + ': ' + (left === 'Next step' ? lowerFirst(right) : right);
      }
    }
    var label = /^([^:]{2,60}):$/.exec(source);
    if (label && api.phrase(label[1]) !== label[1]) return api.phrase(label[1]) + ':';
    // "Pflicht · 12 lbs · geladen": translate each part on its own.
    if (source.indexOf(' · ') > 0) {
      var parts = source.split(' · ');
      var changed = false;
      var shown = parts.map(function (part) { var out = displayText(part); if (out !== part) changed = true; return out; });
      if (changed) return shown.join(' · ');
    }
    return source;
  }

  // Translates an already rendered subtree (loading manager, EFB banner) in place.
  // Every text node remembers its German source, so switching back restores it.
  var DOM_ATTRIBUTES = ['title', 'aria-label', 'placeholder'];
  function translateTextValue(raw) {
    // Keep surrounding spaces and "·" separators of text split by <b> tags.
    var parts = /^([\s·]*)([\s\S]*?)([\s·]*)$/.exec(String(raw));
    var core = parts ? parts[2] : '';
    if (!core || !/[A-Za-zÄÖÜäöüß]/.test(core)) return raw;
    var out = displayText(core);
    return out === core ? raw : parts[1] + out + parts[3];
  }
  function translateDom(rootNode) {
    if (!rootNode || typeof rootNode !== 'object') return rootNode;
    var stack = [rootNode];
    while (stack.length) {
      var node = stack.pop();
      if (node.nodeType === 3) {
        var current = node.nodeValue;
        var german = node.__gaI18nShown !== undefined && current === node.__gaI18nShown ? node.__gaI18nGerman : current;
        var shownText = translateTextValue(german);
        node.__gaI18nGerman = german;
        node.__gaI18nShown = shownText;
        if (shownText !== current) node.nodeValue = shownText;
        continue;
      }
      if (node.nodeType !== 1 && node.nodeType !== 11) continue;
      if (node.nodeType === 1) {
        var tag = String(node.tagName || '').toUpperCase();
        if (tag === 'SCRIPT' || tag === 'STYLE') continue;
        var memory = node.__gaI18nAttributes || (node.__gaI18nAttributes = {});
        for (var a = 0; a < DOM_ATTRIBUTES.length; a++) {
          var name = DOM_ATTRIBUTES[a];
          if (!node.hasAttribute || !node.hasAttribute(name)) continue;
          var value = node.getAttribute(name);
          var entry = memory[name];
          var source = entry && value === entry.shown ? entry.german : value;
          var shownValue = translateTextValue(source);
          memory[name] = { german: source, shown: shownValue };
          if (shownValue !== value) node.setAttribute(name, shownValue);
        }
      }
      for (var child = node.firstChild; child; child = child.nextSibling) stack.push(child);
    }
    return rootNode;
  }
  function dt(value) { return escapeHtml(displayText(value)); }

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
      return date.toLocaleTimeString(numberLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
        : displayText(flight.trackerLive ? 'Zielposition offen' : 'Tracker wartet'),
      altitudeLine: flight.mslFt != null && Number.isFinite(Number(flight.mslFt))
        ? Math.round(Number(flight.mslFt)).toLocaleString(numberLocale()) + ' ft MSL'
        : displayText('Keine Live-Höhe'),
      altitudeDetail: flight.aglFt != null && Number.isFinite(Number(flight.aglFt))
        ? Math.round(Number(flight.aglFt)).toLocaleString(numberLocale()) + ' ft AGL'
        : (flight.gsKts != null && Number.isFinite(Number(flight.gsKts)) ? Math.round(Number(flight.gsKts)) + ' kt GS' : displayText('Live-Daten offen'))
    };
  }

  var INTERRUPTION_DEBOUNCE_MS = 15000;
  var RESUMED_NOTICE_TEXT = 'Speicherstand erfolgreich geladen: Szenen und Zuladung sind wieder da. Bewertung, Ansagen und Aufgaben laufen ab hier weiter.';

  function interruptionDistance(zone, live) {
    if (!zone || !live) return null;
    var lat = Number(live.lat), lon = Number(live.lon != null ? live.lon : live.lng);
    if (!isFinite(lat) || !isFinite(lon)) return null;
    var toRad = function (value) { return value * Math.PI / 180; };
    var dLat = toRad(zone.lat - lat), dLon = toRad(zone.lon - lon);
    var a = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(toRad(lat)) * Math.cos(toRad(zone.lat)) * Math.pow(Math.sin(dLon / 2), 2);
    var distanceNm = 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(a)));
    var y = Math.sin(dLon) * Math.cos(toRad(zone.lat));
    var x = Math.cos(toRad(lat)) * Math.sin(toRad(zone.lat)) - Math.sin(toRad(lat)) * Math.cos(toRad(zone.lat)) * Math.cos(dLon);
    var bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    return { distanceNm: distanceNm, bearingDeg: bearing };
  }

  function formatNm(value) {
    return (Math.round(value * 10) / 10).toFixed(1).replace('.', ',');
  }

  // Shared presentation of a tracker-side simulator interruption for App, EFB
  // and toolbar. `simulatorConnected` is the viewer's knowledge (null = unknown).
  function interruptionModel(control, options) {
    var settings = options && typeof options === 'object' ? options : {};
    var record = control && control.executionAuthority === 'tracker' && control.interruption && typeof control.interruption === 'object'
      ? control.interruption : null;
    if (!record) return null;
    var now = Number(settings.now) || Date.now();
    var status = String(record.status || '');
    var zone = record.zone && isFinite(Number(record.zone.lat)) && isFinite(Number(record.zone.lon)) ? record.zone : null;
    var age = Math.max(0, now - (Number(record.since) || now));
    // A short SimConnect/tracker gap usually resumes on its own; do not flash the UI.
    var debounced = status === 'awaiting_decision' && age < INTERRUPTION_DEBOUNCE_MS;
    var allowed = Array.isArray(control.allowedActions) ? control.allowedActions : [];
    var navigation = zone ? interruptionDistance(zone, settings.livePosition) : null;
    var whereText = navigation ? ' Noch ' + formatNm(navigation.distanceNm) + ' NM, Kurs ' + ('00' + Math.round(navigation.bearingDeg) % 360).slice(-3) + '°.' : '';
    var model = {
      key: [control.missionId || '', control.runId || '', 'interruption', status].join(':'),
      status: status,
      visible: !debounced,
      recheckInMs: debounced ? INTERRUPTION_DEBOUNCE_MS - age : 0,
      kicker: 'Mission unterbrochen',
      text: '',
      primary: null,
      zone: zone ? { lat: Number(zone.lat), lon: Number(zone.lon), radiusNm: Number(zone.radiusNm) || 5, airborne: zone.airborne === true,
        kind: zone.kind === 'departure' || zone.kind === 'destination' ? zone.kind : '', label: String(zone.label || '') } : null,
      distanceNm: navigation ? navigation.distanceNm : null,
      bearingDeg: navigation ? navigation.bearingDeg : null,
      resetAvailable: allowed.indexOf('abort_mission') >= 0,
      abortAvailable: allowed.indexOf('abort_mission') >= 0
    };
    // Continuing is the default: the running cockpit resumes on its own. Only
    // restart/abort are choices; there is no "continue" button any more.
    if (status === 'awaiting_decision' || status === 'resuming') {
      model.kicker = 'Mission wieder aufnehmen';
      // The EFB offers "Speicherstand laden"; other views continue by flying.
      model.text = settings.simulatorConnected === false
        ? 'Die laufende Mission wurde gespeichert. Zum Fortfahren MSFS starten und einen Flug laden.'
        : (settings.canLoadSave === true ? 'Die laufende Mission wurde gespeichert. Möchtest du fortfahren?'
          : 'Die laufende Mission wurde gespeichert. Zum Fortfahren den Flug im Simulator starten.');
    } else if (status === 'awaiting_zone') {
      var insideZone = !!(model.zone && navigation && navigation.distanceNm <= model.zone.radiusNm);
      model.kicker = 'Zum Speicherpunkt';
      if (model.zone && model.zone.airborne) {
        model.text = 'Zum Fortsetzen an den Speicherpunkt fliegen (' + formatNm(model.zone.radiusNm) + ' NM Zone). Die Mission läuft weiter, sobald du dort 10 Sekunden normal fliegst.' + whereText;
        if (allowed.indexOf('resume_teleport') >= 0) model.primary = { intent: 'resume_teleport', label: 'An Speicherpunkt versetzen' };
      } else if (insideZone) {
        // Already there (e.g. on the departure field): no "go back" instruction.
        model.kicker = 'Speicherstand wird geladen';
        model.text = 'Flugzeug steht am Speicherpunkt. Die Mission läuft gleich weiter.';
      } else {
        var place = model.zone && model.zone.kind === 'departure' ? 'am Startplatz' + (model.zone.label ? ' ' + model.zone.label : '')
          : (model.zone && model.zone.kind === 'destination' ? 'am Zielplatz' + (model.zone.label ? ' ' + model.zone.label : '') : 'am Speicherpunkt');
        if (model.zone && model.zone.kind) model.kicker = model.zone.kind === 'departure' ? 'Zurück zum Startplatz' : 'Zurück zum Zielplatz';
        model.text = 'Flugzeug ' + place + ' abstellen (innerhalb ' + formatNm(model.zone ? model.zone.radiusNm : 1) + ' NM). Die Mission läuft weiter, sobald es dort 5 Sekunden am Boden steht.' + whereText;
      }
    } else {
      return null;
    }
    return model;
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
    // An interrupted run only offers its resume choice plus reset/abort.
    var interruption = settings.interruption && typeof settings.interruption === 'object' ? settings.interruption : null;
    var interrupted = settings.interrupted === true || !!interruption;
    if (interrupted) {
      primary = interruption && interruption.visible !== false && interruption.primary ? {
        kind: 'intent',
        intent: interruption.primary.intent,
        cargoMode: '',
        label: interruption.primary.label,
        title: interruption.text || interruption.kicker,
        disabled: false
      } : null;
    } else if (banner && (banner.kind === 'intent' || banner.kind === 'cargo')) {
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
    var flags = control.flags && typeof control.flags === 'object' ? control.flags : {};
    var cargoVisible = !interrupted && activeRun && cargoWorldAvailable(control) && (
      /^(planned|prepare|boarding|boarded|end_unloading|end_ready)$/.test(phase)
      || (flags.groundStill === true && /^(active|on_task)$/.test(phase))
    );
    return {
      schema: 'ga.mission-toolbar.v1',
      missionId: missionId,
      runId: runId,
      phase: phase,
      primary: primary,
      cargo: {
        visible: cargoVisible,
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
      + '<b>' + dt('Keine aktive Mission') + '</b>'
      + '<p>' + dt('Nach dem Annehmen eines Auftrags erscheinen hier Aufgabe, Bedingungen, Live-Fortschritt, Pax-Stimmung und Ladungszustand.') + '</p>'
      + '</div>';
  }

  function renderActions(control, options) {
    var settings = options || {};
    var allowed = control && Array.isArray(control.allowedActions) ? control.allowedActions : [];
    if (!control || control.executionAuthority !== 'tracker') return '';
    var disabled = settings.intentPending === true ? ' disabled' : '';
    var interruption = settings.interruption && typeof settings.interruption === 'object' ? settings.interruption : null;
    var interrupted = settings.interrupted === true || !!interruption;
    var actionHtml = interrupted ? '' : PRIMARY_ACTIONS.filter(function (intent) {
      return allowed.indexOf(intent) >= 0;
    }).map(function (intent) {
      return '<button type="button" data-action="mission-control-intent" data-efb-drawer-action="mission-intent" data-mission-intent="'
        + escapeHtml(intent) + '"' + disabled + '>' + dt(ACTION_LABELS[intent] || intent) + '</button>';
    }).join('');
    var abortHtml = allowed.indexOf('abort_mission') >= 0
      ? '<div class="mission-control-actions is-danger"><button type="button" data-action="mission-control-intent" data-efb-drawer-action="mission-intent" data-mission-intent="abort_mission"'
        + disabled + '>' + dt('Mission abbrechen') + '</button></div>'
      : '';
    var toolbar = missionToolbarModel(control, { banner: settings.banner || null, interrupted: interrupted, interruption: interruption });
    var interruptedText = interruption ? displayText(interruption.kicker) + ': ' + displayText(interruption.text)
      : displayText('Simulator getrennt: Die Mission ist unterbrochen. Zum Fortsetzen MSFS starten und einen Flug laden – die Mission geht dann an derselben Stelle weiter. Alternativ die Mission neu starten oder abbrechen.');
    var interruptedHtml = interrupted
      ? '<div class="mission-control-actions is-interrupted"><p>' + escapeHtml(interruptedText) + '</p>'
        + (interruption && interruption.primary ? '<button type="button" data-action="mission-control-intent" data-efb-drawer-action="mission-intent" data-mission-intent="'
          + escapeHtml(interruption.primary.intent) + '"' + disabled + '>' + dt(interruption.primary.label) + '</button>' : '')
        + '</div>'
      : '';
    var cargoHtml = toolbar && toolbar.cargo && toolbar.cargo.visible
      ? '<div class="mission-control-actions"><button type="button" data-action="mission-control-open-cargo" data-efb-drawer-action="open-cargo"'
        + disabled + '>' + dt('Verlade-Manager öffnen') + '</button></div>'
      : '';
    var status = String(settings.intentStatus || '');
    var statusTone = safeTone(settings.intentTone || (/abgelehnt|fehlgeschlagen|nicht verfuegbar|nicht verfügbar/i.test(status) ? 'danger' : 'info'), 'info');
    return '<section class="mission-control-card mission-control-operations">'
      + '<div class="mission-control-section-kicker">' + dt('BEDIENUNG') + '</div>'
      + interruptedHtml
      + cargoHtml
      + (actionHtml ? '<div class="mission-control-actions">' + actionHtml + '</div>' : '')
      + abortHtml
      + (status ? '<p class="mission-control-intent-status is-' + statusTone + '">' + dt(status) + '</p>' : '')
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
    // Generated mission text stays as written (phase 4); the fixed detail line used as a
    // fallback is translated like the other card texts.
    var story = view.story ? String(view.story) : displayText(String(view.detail || ''));
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
        + '<span>' + (index < current ? '&#10003;' : String(index + 1)) + '</span><b>' + dt(label || 'Phase') + '</b></div>';
    }).join('');
    var progressHtml = (Array.isArray(view.progress) ? view.progress : []).map(function (row) {
      var pct = clampPct(row && row.percent);
      var tone = safeTone(row && row.tone, pct >= 100 ? 'good' : 'active');
      return '<div class="mission-control-progress-row"><div class="mission-control-progress-head"><span>'
        + dt(row && row.label) + '</span><b>' + dt(valueOf(row, 'detail', 'value', '')) + '</b></div>'
        + '<div class="mission-control-progress-track is-' + tone + '"><span style="width:' + pct + '%"></span></div></div>';
    }).join('');
    var requirementsHtml = (Array.isArray(view.requirements) ? view.requirements : []).map(function (row) {
      return '<div class="mission-control-requirement is-' + safeTone(valueOf(row, 'state', 'tone', 'neutral'), 'neutral') + '"><span>'
        + dt(row && row.label) + '</span><b>' + dt(valueOf(row, 'value', 'detail', '')) + '</b></div>';
    }).join('');
    var feedbackHtml = (Array.isArray(view.feedback) ? view.feedback : []).map(function (row) {
      var tone = safeTone(row && row.tone, 'info');
      var icon = tone === 'danger' ? '!' : (tone === 'warn' ? '&#9651;' : (tone === 'good' ? '&#10003;' : 'i'));
      return '<div class="mission-control-feedback is-' + tone + '"><span aria-hidden="true">' + icon + '</span><p>'
        + dt(valueOf(row, 'text', 'detail', '')) + '</p></div>';
    }).join('');
    var comfort = view.comfort && typeof view.comfort === 'object' ? view.comfort : {};
    var cargo = view.cargo && typeof view.cargo === 'object' ? view.cargo : {};
    var control = settings.control || (viewInput && viewInput.control) || null;
    return '<div class="mission-control-shared" data-mission-control-schema="ga.efb-mission-view.v1">'
      + '<section class="mission-control-hero is-' + taskTone + '"><div class="mission-control-hero-top">'
      + '<span class="mission-control-live' + (flight.trackerLive ? ' is-live' : '') + '">' + (flight.trackerLive ? '&#9679; LIVE' : '&#9675; STANDBY') + '</span>'
      + '<span>' + dt(view.status || 'Mission aktiv') + '</span></div><h3>' + dt(view.title || 'Aktive Mission') + '</h3>'
      + '<div class="mission-control-story ' + (storyExpandable ? (expanded ? 'is-expanded' : 'is-collapsed') : 'is-static') + '"><p id="missionControlStory">'
      + escapeHtml(story) + '</p>'
      + (storyExpandable ? '<button class="mission-control-story-toggle" type="button" data-action="toggle-mission-story" data-efb-drawer-action="toggle-mission-story" aria-controls="missionControlStory" aria-expanded="'
        + (expanded ? 'true' : 'false') + '"><span>' + dt(expanded ? 'Missionstext einklappen' : 'Gesamten Missionstext lesen') + '</span><b aria-hidden="true">'
        + (expanded ? '&#8963;' : '&#8964;') + '</b></button>' : '')
      + '</div></section>'
      + '<section class="mission-control-order is-' + taskTone + '"><div class="mission-control-section-kicker">' + dt('AKTUELLER AUFTRAG') + '</div>'
      + '<div class="mission-control-order-text">' + dt(view.currentTask || 'Missionsstatus prüfen') + '</div>'
      + '<div class="mission-control-order-detail">' + dt(view.detail || '') + '</div></section>'
      + (phaseHtml ? '<section class="mission-control-card"><div class="mission-control-section-kicker">' + dt('MISSIONSVERLAUF') + '</div><div class="mission-control-phase-rail">' + phaseHtml + '</div></section>' : '')
      + '<div class="mission-control-metrics"><div class="mission-control-metric"><span>' + dt('ZIEL') + '</span><b id="gaEfbMissionTargetLine">' + escapeHtml(targetLine) + '</b><small>'
      + escapeHtml(target.name || '') + '</small></div><div class="mission-control-metric"><span>' + dt('FLUGHÖHE') + '</span><b id="gaEfbMissionAltitude">'
      + escapeHtml(altitudeLine) + '</b><small id="gaEfbMissionAltitudeDetail">' + escapeHtml(altitudeDetail) + '</small></div></div>'
      + (progressHtml ? '<section class="mission-control-card"><div class="mission-control-section-kicker">' + dt('LIVE-FORTSCHRITT') + '</div>' + progressHtml + '</section>' : '')
      + (requirementsHtml ? '<section class="mission-control-card"><div class="mission-control-section-kicker">' + dt('BEDINGUNGEN') + '</div><div class="mission-control-requirements">' + requirementsHtml + '</div></section>' : '')
      + '<div class="mission-control-condition-grid"><section class="mission-control-condition is-' + safeTone(comfort.tone, 'muted') + '"><span>' + dt('PAX-STIMMUNG') + '</span><strong>'
      + (comfort.score == null ? '—' : escapeHtml(comfort.score) + '%') + '</strong><b>' + dt(comfort.state || 'Keine Wertung') + '</b><small>'
      + dt(comfort.detail || '') + '</small></section><section class="mission-control-condition is-' + safeTone(cargo.tone, 'muted') + '"><span>' + dt('LADUNGSZUSTAND') + '</span><strong>'
      + (cargo.conditionPct == null ? '—' : escapeHtml(cargo.conditionPct) + '%') + '</strong><b>' + dt(cargo.state || 'Keine Ladung') + '</b><small>'
      + dt(cargo.detail || '') + '</small></section></div>'
      + renderActions(control, settings)
      + (feedbackHtml ? '<section class="mission-control-card"><div class="mission-control-section-kicker">' + dt('LAGEBERICHT') + '</div><div class="mission-control-feedback-list">' + feedbackHtml + '</div></section>' : '')
      + '<div class="mission-control-updated">' + dt('Stand') + ' ' + escapeHtml(formatTime(view.capturedAt || settings.now)) + ' · ' + dt('aktualisiert sich automatisch') + '</div>'
      + '</div>';
  }

  function formatIntentResult(result) {
    var value = result && typeof result === 'object' ? result : {};
    if (value.pending === true) return { tone: 'info', text: 'Tracker verarbeitet die Aktion ...' };
    if (value.ok === true || /^(ok|noop|accepted)$/.test(String(value.status || '').toLowerCase())) {
      return { tone: 'good', text: 'Aktion bestätigt. Der Missionsstand wurde auf allen Ansichten aktualisiert.' };
    }
    var error = String(value.error || value.status || '').toLowerCase();
    if (error === 'mission_transfer_timeout') return { tone: 'danger', text: 'Die Missionsuebertragung wurde nicht rechtzeitig bestaetigt. Verbindung pruefen und erneut versuchen.' };
    if (error === 'mission_transfer_invalid') return { tone: 'danger', text: 'Das Missionspaket konnte nicht vollstaendig geprueft werden. Bitte erneut uebertragen.' };
    if (error === 'mission_transfer_too_large') return { tone: 'danger', text: 'Das vollstaendige Missionspaket ueberschreitet die Transportgrenze. Es wurden keine Daten gekuerzt.' };
    if (error === 'resume_bundle_too_large') return { tone: 'danger', text: 'Das vollstaendige Missionspaket ueberschreitet die lokale Tracker-Grenze. Es wurden keine Daten gekuerzt.' };
    if (error === 'mission_relay_payload_too_large') return { tone: 'danger', text: 'Die Paketuebertragung ist nicht verfuegbar. Bitte App und Tracker aktualisieren und erneut versuchen.' };
    if (error === 'simulator_disconnected') {
      return { tone: 'warn', text: 'Der Simulator ist nicht verbunden. Die Mission ist unterbrochen; möglich sind nur Zurücksetzen und Abbrechen.' };
    }
    if (error === 'mission_intent_pending') {
      return { tone: 'info', text: 'Der Tracker verarbeitet bereits eine Aktion. Bitte den aktualisierten Stand kurz abwarten.' };
    }
    if (error === 'mission_revision_conflict') {
      return { tone: 'warn', text: 'Eine andere Ansicht war schneller. Der aktuelle Missionsstand wurde übernommen.' };
    }
    if (error === 'mission_authority_resume_unavailable') {
      return { tone: 'warn', text: 'Der gespeicherte Missionslauf konnte nicht wiederhergestellt werden. Bitte die Tracker-Verbindung prüfen. Der Lauf bleibt erhalten.' };
    }
    if (error === 'mission_execution_handoff_phase_not_safe') {
      return { tone: 'warn', text: 'Ein bereits begonnener Missionslauf kann nicht neu übergeben werden. Bitte den wiederhergestellten Missionsstand verwenden.' };
    }
    if (/mission_execution_(shadow|replay|legacy|state_hash|projection|handoff)|expected_execution_state_hash/.test(error)) {
      return { tone: 'warn', text: 'App und Tracker konnten den Missionsstand nicht abgleichen. Die Mission wurde nicht neu gestartet. Bitte den aktuellen Tracker-Stand erneut laden.' };
    }
    if (error === 'mission_execution_recipe_not_enabled') {
      return { tone: 'warn', text: 'Dieser Missionsablauf ist nicht für die Tracker-Ausführung freigegeben.' };
    }
    if (error === 'cockpit_session_unavailable' || error === 'mission_execution_authority_web') {
      return { tone: 'danger', text: 'Der Tracker ist für diese Aktion noch nicht erreichbar.' };
    }
    if (error === 'manifest_reload_too_far') {
      return { tone: 'warn', text: 'Der ausgeladene Gegenstand ist zu weit entfernt oder seine aktuelle Entfernung ist unbekannt. Wiederladen ist nur im Umkreis von 200 m möglich.' };
    }
    if (error === 'manifest_lost_item_replacement_required') {
      return { tone: 'warn', text: 'Verlorenen Bordbestand kannst du vor Missionsbeginn am Boden und im Stillstand durch Ersatz einladen. Während einer laufenden Mission oder Kontrolle ist das gesperrt.' };
    }
    if (error === 'manifest_ground_handling_required') {
      return { tone: 'warn', text: 'Verladen ist nur am Boden und im Stillstand möglich.' };
    }
    if (error === 'pax_query_not_available') {
      return { tone: 'warn', text: 'Der Passagier kann dazu gerade nichts sagen.' };
    }
    if (/not_allowed|not_ready|invalid_phase|blocked|manifest/.test(error)) {
      return { tone: 'warn', text: 'Diese Aktion ist im aktuellen Missionsschritt nicht verfügbar.' };
    }
    return { tone: 'danger', text: 'Die Tracker-Aktion konnte nicht ausgeführt werden. Bitte den aktuellen Missionsstand erneut prüfen.' };
  }

  // Transport queue only: state/revision is read by execute at dispatch time.
  // A repeated click on the same item joins its outstanding command.
  function createIntentQueue(onChange) {
    var entries = [];
    var running = false;
    function changed() { if (typeof onChange === 'function') onChange(); }
    async function pump() {
      if (running || !entries.length) return;
      running = true;
      var first = entries[0];
      // Batch only work already waiting. No transport quiet period may delay
      // a mutation; signatures, other intents and repeated items are barriers.
      var group = [first];
      if (first.batch && !first.leading) {
        for (var i = 1; i < entries.length && group.length < 32; i++) {
          var next = entries[i];
          if (!next.batch || next.batch.group !== first.batch.group
              || group.some(function (entry) { return entry.itemId === next.itemId; })) break;
          group.push(next);
        }
      }
      try {
        var result = first.batch
          ? await first.batch.execute(group.map(function (entry) { return entry.batch.value; }))
          : await first.execute();
        group.forEach(function (entry) { entry.resolve(result); });
      } catch (error) {
        group.forEach(function (entry) { entry.reject(error); });
      } finally {
        entries.splice(0, group.length);
        running = false;
        changed();
        if (entries.length) Promise.resolve().then(pump);
      }
    }
    function enqueue(key, itemId, execute, batch) {
      // Only adjacent duplicates are interchangeable. Never cross a signature
      // or an opposite action (load -> unload -> load must execute all three).
      var existing = entries[entries.length - 1];
      if (existing && existing.key === key) return existing.promise;
      var entry = { key: key, itemId: itemId || '', execute: execute, batch: batch, leading: entries.length === 0 };
      entry.promise = new Promise(function (resolve, reject) { entry.resolve = resolve; entry.reject = reject; });
      entries.push(entry);
      changed();
      Promise.resolve().then(pump);
      return entry.promise;
    }
    return {
      enqueue: enqueue,
      pendingItemIds: function () { return entries.map(function (entry) { return entry.itemId; }).filter(Boolean); },
      size: function () { return entries.length; }
    };
  }

  function boardBookReminder(control) {
    if (!control || control.executionAuthority !== 'tracker' || !control.missionId || !control.runId
        || !control.progress || !control.progress.airborneSeen || /^(planned|prepare|boarding|boarded|closing|closed|aborted)$/.test(control.phase || '')) return null;
    var events = control.flightEvents || (control.manifest || {}).flightEvents || {};
    if (!events.flightId || !Number(events.startAt) || (control.allowedActions || []).indexOf('set_boardbook_time') < 0) return null;
    var field = Number(events.landingAt) > 0 ? 'landing' : 'start';
    var item = ((control.manifest || {}).items || []).find(function(item) { return item.id === 'bordbuch'; });
    if (!item || item.status !== 'loaded') return null;
    var log = item.log || {};
    if (log.flightId === events.flightId && Number(log[field + 'At']) > 0) return null;
    return { field: field, flightId: events.flightId,
      key: [control.missionId, control.runId, events.flightId, field, events[field + 'At']].join(':') };
  }

  function boardBookReminderMarkup(field) {
    var landing = field === 'landing';
    return '<div class="mission-boardbook-reminder-copy"><strong>' + dt('BORDBUCH') + '</strong><span>'
      + dt(landing ? 'Landezeit des aktuellen Fluges eintragen?' : 'Startzeit des aktuellen Fluges eintragen?')
      + '</span></div><button type="button">' + dt(landing ? 'Landezeit eintragen' : 'Startzeit eintragen') + '</button>';
  }

  function abortConfirmation() {
    return displayText('Mission wirklich abbrechen?\n\nDer Tracker beendet die Mission auf allen verbundenen Ansichten und entfernt ihre Sim-Objekte. Der Flug wird nicht als abgeschlossen gewertet.');
  }

  return Object.freeze({
    createIntentQueue: createIntentQueue,
    boardBookReminder: boardBookReminder,
    boardBookReminderMarkup: boardBookReminderMarkup,
    BUILD_ID: BUILD_ID,
    ACTION_LABELS: ACTION_LABELS,
    render: render,
    renderEmpty: renderEmpty,
    projectLiveFields: projectLiveFields,
    missionToolbarModel: missionToolbarModel,
    interruptionModel: interruptionModel,
    INTERRUPTION_DEBOUNCE_MS: INTERRUPTION_DEBOUNCE_MS,
    RESUMED_NOTICE_TEXT: RESUMED_NOTICE_TEXT,
    cargoWorldAvailable: cargoWorldAvailable,
    formatIntentResult: formatIntentResult,
    displayText: displayText,
    translateDom: translateDom,
    abortConfirmation: abortConfirmation
  });
}));
