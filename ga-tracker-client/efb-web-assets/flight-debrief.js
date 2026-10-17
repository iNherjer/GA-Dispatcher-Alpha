// Generated from flight-debrief.js by sync-efb-web-assets.js. Do not edit.
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i.return) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
/* Shared App / EFB debrief presentation. */
(function () {
  'use strict';

  var debriefOverlayEl = null;
  var currentDebriefRecord = null;
  var currentDebriefAwaitingCleanup = false;
  function ensureDebriefOverlay() {
    if (debriefOverlayEl) return debriefOverlayEl;
    var ov = document.createElement('div');
    ov.id = 'flightDebriefOverlay';
    ov.className = 'flight-debrief-overlay';
    ov.innerHTML = `
        <div class="flight-debrief-paper" role="dialog" aria-modal="true" aria-labelledby="flightDebriefTitle">
            <div class="flight-debrief-head">
                <div>
                    <div class="flight-debrief-kicker">VFR MULTITOOL · MISSIONSABSCHLUSS</div>
                    <div id="flightDebriefTitle" class="flight-debrief-title">Flight Debrief</div>
                </div>
                <button id="flightDebriefCloseBtn" class="flight-debrief-icon-close" type="button" aria-label="Debrief schließen">×</button>
            </div>
            <div id="flightDebriefBody" class="flight-debrief-body"></div>
            <div class="flight-debrief-actions">
                <button id="flightDebriefPdfBtn" class="flight-debrief-btn secondary" type="button">PDF herunterladen</button>
                <button id="flightDebriefFinishBtn" class="flight-debrief-btn primary" type="button">Schließen</button>
            </div>
        </div>
    `;
    ov.addEventListener('click', e => {
      if (e.target === ov && !currentDebriefAwaitingCleanup) ov.style.display = 'none';
    });
    document.body.appendChild(ov);
    var closeBtn = ov.querySelector('#flightDebriefCloseBtn');
    var finishBtn = ov.querySelector('#flightDebriefFinishBtn');
    var pdfBtn = ov.querySelector('#flightDebriefPdfBtn');
    if (closeBtn) closeBtn.addEventListener('click', () => {
      if (!currentDebriefAwaitingCleanup) ov.style.display = 'none';
    });
    if (finishBtn) finishBtn.addEventListener('click', /*#__PURE__*/_asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee() {
      var displayedRecord, record, cleaned, _t, _t2;
      return _regenerator().w(function (_context) {
        while (1) switch (_context.p = _context.n) {
          case 0:
            displayedRecord = currentDebriefRecord;
            if (!currentDebriefAwaitingCleanup) {
              _context.n = 9;
              break;
            }
            record = currentDebriefRecord;
            finishBtn.disabled = true;
            finishBtn.textContent = 'Mission wird aufgeräumt…';
            cleaned = false;
            _context.p = 1;
            if (!(typeof window.completeMissionCloseCleanup === 'function')) {
              _context.n = 3;
              break;
            }
            _context.n = 2;
            return window.completeMissionCloseCleanup(record, 'debrief-finish');
          case 2:
            _t = _context.v;
            _context.n = 4;
            break;
          case 3:
            _t = false;
          case 4:
            cleaned = _t;
            _context.n = 6;
            break;
          case 5:
            _context.p = 5;
            _t2 = _context.v;
            console.error('[Debrief] Cleanup failed:', _t2);
          case 6:
            if (!(currentDebriefRecord !== displayedRecord)) {
              _context.n = 7;
              break;
            }
            return _context.a(2);
          case 7:
            if (cleaned) {
              _context.n = 8;
              break;
            }
            finishBtn.disabled = false;
            finishBtn.textContent = 'Schließen fehlgeschlagen – erneut versuchen';
            finishBtn.title = 'Tracker-Verbindung und aktuellen Missionsstand prüfen.';
            return _context.a(2);
          case 8:
            currentDebriefAwaitingCleanup = false;
          case 9:
            ov.style.display = 'none';
          case 10:
            return _context.a(2);
        }
      }, _callee, null, [[1, 5]]);
    })));
    if (pdfBtn) pdfBtn.addEventListener('click', /*#__PURE__*/_asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2() {
      var oldText, _t3;
      return _regenerator().w(function (_context2) {
        while (1) switch (_context2.p = _context2.n) {
          case 0:
            if (currentDebriefRecord) {
              _context2.n = 1;
              break;
            }
            return _context2.a(2);
          case 1:
            pdfBtn.disabled = true;
            oldText = pdfBtn.textContent;
            pdfBtn.textContent = 'PDF wird erstellt…';
            _context2.p = 2;
            _context2.n = 3;
            return window.generateDebriefPDF(currentDebriefRecord);
          case 3:
            _context2.n = 5;
            break;
          case 4:
            _context2.p = 4;
            _t3 = _context2.v;
            console.error('[Debrief] PDF export failed:', _t3);
            alert('Das Debrief-PDF konnte nicht erstellt werden.');
          case 5:
            _context2.p = 5;
            pdfBtn.disabled = false;
            pdfBtn.textContent = oldText;
            return _context2.f(5);
          case 6:
            return _context2.a(2);
        }
      }, _callee2, null, [[2, 4, 5, 6]]);
    })));
    debriefOverlayEl = ov;
    return ov;
  }
  function _debriefFinite(value) {
    if (value == null || value === '') return null;
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function _debriefAltitudeAssessment(record) {
    var sd = _debriefFinite(record === null || record === void 0 ? void 0 : record.cruiseAltitudeStdDevFt);
    var range = _debriefFinite(record === null || record === void 0 ? void 0 : record.cruiseAltitudeRangeFt);
    if (sd == null) {
      var enrouteSamples = Math.max(0, Math.round(Number((record === null || record === void 0 ? void 0 : record.enrouteSampleCount) || 0)));
      var cruiseSamples = Math.max(0, Math.round(Number((record === null || record === void 0 ? void 0 : record.cruiseSampleCount) || 0)));
      var cruiseDurationSec = Math.max(0, Math.round(Number((record === null || record === void 0 ? void 0 : record.cruiseDurationSec) || 0)));
      var text = 'Für eine belastbare Bewertung gab es zu wenige stabile Streckenflug-Proben.';
      if (enrouteSamples <= 0 && record !== null && record !== void 0 && record.telemetryStatus) {
        text = 'Es wurde kein Abschnitt sicher als Streckenflug erkannt; deshalb wird die Höhenkonstanz nicht bewertet.';
      } else if (enrouteSamples > 0) {
        text = `Es wurden ${enrouteSamples} Streckenflug-Proben erkannt, davon aber nur ${cruiseSamples} über ${cruiseDurationSec} Sekunden als stabiler Höhenflug.`;
      }
      return {
        value: 'Nicht verfügbar',
        text
      };
    }
    var rating = sd <= 75 ? 'sehr konstant' : sd <= 150 ? 'konstant' : sd <= 300 ? 'wechselhaft' : 'deutlich wechselhaft';
    return {
      value: `± ${Math.round(sd)} ft`,
      text: `Die Flughöhe war im waagerechten Streckenflug ${rating} (Standardabweichung ${Math.round(sd)} ft${range == null ? '' : `, Spannweite ${Math.round(range)} ft`}).`
    };
  }
  function _debriefComfortText(record) {
    var comfort = record === null || record === void 0 ? void 0 : record.comfort;
    if (!comfort || _debriefFinite(comfort.score) == null) return 'Für diesen Auftrag wurde kein Passagier-Komfortindex geführt.';
    var causes = [];
    if (Number(comfort.pilotSevere || 0) > 0) causes.push('deutliche pilotenseitige Belastungsspitzen');else if (Number(comfort.pilotEvents || 0) > 0) causes.push('einzelne Manöverbelastungen');
    if (Number(comfort.weatherSevere || 0) > 0) causes.push('anspruchsvolles Wetter');else if (Number(comfort.weatherEvents || 0) > 0) causes.push('spürbare Wettereinflüsse');
    return `Die Passagiere waren ${comfort.mood || 'bewertet'}: ${Math.round(Number(comfort.score))} von 100 Komfortpunkten${causes.length ? `; prägend waren ${causes.join(' und ')}` : ''}.`;
  }
  function _debriefCargoText(record) {
    var cargo = record === null || record === void 0 ? void 0 : record.cargo;
    if (!cargo) return 'Für diesen Auftrag war keine separate Frachtbewertung erforderlich.';
    var issues = [].concat(_toConsumableArray(cargo.missingRequired || []), _toConsumableArray(cargo.droppedRequired || []), _toConsumableArray(cargo.notDeliveredRequired || []), _toConsumableArray(cargo.damagedRequired || []));
    var condition = _debriefFinite(cargo.conditionPct);
    if (cargo.failed) return `Die Ladung wurde nicht vollständig sicher zugestellt${issues.length ? `: ${issues.slice(0, 3).join(', ')}` : '.'}`;
    if (condition == null) return 'Die vorgeschriebene Ladung wurde vollständig und ohne registrierten Verlust transportiert.';
    var rating = condition >= 95 ? 'sehr sicher' : condition >= 80 ? 'sicher' : condition >= 60 ? 'mit spürbarer Beanspruchung' : 'kritisch beansprucht';
    return `Die Ladung wurde ${rating} transportiert. Ermittelter Zustand: ${Math.round(condition)} %.`;
  }
  function _debriefFlightText(record, altitude) {
    var g = _debriefFinite(record === null || record === void 0 ? void 0 : record.maxGForce);
    var bank = _debriefFinite(record === null || record === void 0 ? void 0 : record.maxBankDeg);
    var agl = _debriefFinite(record === null || record === void 0 ? void 0 : record.minEnrouteAglFt);
    var parts = [];
    if (g != null) parts.push(`Die höchste gemessene Last betrug ${g.toFixed(2)} g`);
    if (bank != null) parts.push(`der größte Bankwinkel ${bank.toFixed(1)}°`);
    if (agl != null) parts.push(`die geringste direkte AGL-Höhe auf Strecke ${Math.round(agl)} ft`);
    var metrics = parts.length ? `${parts.join(', ')}.` : 'Für Belastung und Streckenhöhe lagen keine belastbaren Live-Daten vor.';
    if (!parts.length && record !== null && record !== void 0 && record.telemetryStatus) {
      var samples = Math.max(0, Math.round(Number(record.telemetrySampleCount || 0)));
      metrics = samples > 0 ? `Der Recorder erhielt ${samples} Live-Proben, aber keine auswertbaren G-, Bank- oder Streckenhöhenwerte.` : 'Der Recorder erhielt während dieses Fluges keine auswertbaren Live-Proben.';
    }
    return `${metrics} ${altitude.text}`;
  }
  function _appendDebriefMetric(grid, label, value) {
    var card = document.createElement('div');
    card.className = 'flight-debrief-metric';
    var labelEl = document.createElement('div');
    labelEl.className = 'flight-debrief-metric-label';
    labelEl.textContent = label;
    var valueEl = document.createElement('div');
    valueEl.className = 'flight-debrief-metric-value';
    valueEl.textContent = value;
    card.appendChild(labelEl);
    card.appendChild(valueEl);
    grid.appendChild(card);
  }
  function _appendDebriefSection(body, title, text) {
    var section = document.createElement('section');
    section.className = 'flight-debrief-section';
    var heading = document.createElement('h3');
    heading.textContent = title;
    var para = document.createElement('p');
    para.textContent = text;
    section.appendChild(heading);
    section.appendChild(para);
    body.appendChild(section);
  }
  window.showFlightDebrief = function (record) {
    var _record$distanceNm;
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    if (!record) return;
    var ov = ensureDebriefOverlay();
    var body = ov.querySelector('#flightDebriefBody');
    if (!body) return;
    currentDebriefRecord = record;
    currentDebriefAwaitingCleanup = options.awaitingCleanup === true;
    while (body.firstChild) body.removeChild(body.firstChild);
    var dep = String(record.depLabel || record.start || 'START');
    var arr = String(record.arrLabel || record.dest || 'LANDUNG');
    var dateText = String(record.dateLabel || record.date || new Date(record.createdAt || Date.now()).toLocaleString('de-DE'));
    var mission = String(record.missionTitle || record.mission || 'Mission');
    var route = document.createElement('div');
    route.className = 'flight-debrief-route';
    route.textContent = `${dep} ➔ ${arr}`;
    var meta = document.createElement('div');
    meta.className = 'flight-debrief-meta';
    meta.textContent = `${dateText} · ${record.failed ? 'NICHT ERFÜLLT' : 'ERFÜLLT'}`;
    var assignment = document.createElement('div');
    assignment.className = 'flight-debrief-assignment';
    assignment.textContent = mission;
    body.appendChild(route);
    body.appendChild(meta);
    body.appendChild(assignment);
    var grid = document.createElement('div');
    grid.className = 'flight-debrief-metrics';
    var duration = _debriefFinite(record.durationSec);
    var distance = _debriefFinite((_record$distanceNm = record.distanceNm) !== null && _record$distanceNm !== void 0 ? _record$distanceNm : record.dist);
    var g = _debriefFinite(record.maxGForce);
    var bank = _debriefFinite(record.maxBankDeg);
    var agl = _debriefFinite(record.minEnrouteAglFt);
    var altitude = _debriefAltitudeAssessment(record);
    _appendDebriefMetric(grid, 'Flugzeit', duration == null ? '–' : `${Math.max(1, Math.round(duration / 60))} min`);
    _appendDebriefMetric(grid, 'Distanz', distance == null ? '–' : `${distance.toFixed(1)} NM`);
    _appendDebriefMetric(grid, 'Höchstes G', g == null ? '–' : `${g.toFixed(2)} g`);
    _appendDebriefMetric(grid, 'Max. Bank', bank == null ? '–' : `${bank.toFixed(1)}°`);
    _appendDebriefMetric(grid, 'Höhenkonstanz', altitude.value);
    _appendDebriefMetric(grid, 'Min. AGL Strecke', agl == null ? '–' : `${Math.round(agl)} ft`);
    body.appendChild(grid);
    _appendDebriefSection(body, 'Flugdurchführung', _debriefFlightText(record, altitude));
    _appendDebriefSection(body, 'Passagierkomfort', _debriefComfortText(record));
    _appendDebriefSection(body, 'Ladungssicherheit', _debriefCargoText(record));
    var closeBtn = ov.querySelector('#flightDebriefCloseBtn');
    var finishBtn = ov.querySelector('#flightDebriefFinishBtn');
    var pdfBtn = ov.querySelector('#flightDebriefPdfBtn');
    if (pdfBtn) pdfBtn.style.display = typeof window.generateDebriefPDF === 'function' ? '' : 'none';
    if (closeBtn) closeBtn.style.display = currentDebriefAwaitingCleanup ? 'none' : '';
    if (finishBtn) {
      finishBtn.disabled = false;
      finishBtn.textContent = currentDebriefAwaitingCleanup ? 'Debrief schließen & Mission aufräumen' : 'Schließen';
    }
    ov.style.display = 'flex';
  };
  window.GAFlightDebrief = Object.freeze({
    finite: _debriefFinite,
    altitudeAssessment: _debriefAltitudeAssessment,
    flightText: _debriefFlightText,
    comfortText: _debriefComfortText,
    cargoText: _debriefCargoText
  });
  window.hideFlightDebrief = function (missionId, runId) {
    if (!currentDebriefRecord || currentDebriefRecord.missionId !== missionId || runId && currentDebriefRecord.runId !== runId) return false;
    currentDebriefAwaitingCleanup = false;
    if (debriefOverlayEl) debriefOverlayEl.style.display = 'none';
    return true;
  };
})();
