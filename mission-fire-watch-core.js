// Generated from the Fire-Watch functions in passenger-voice.js by tools/generate-fire-watch-core.mjs.
// Do not edit by hand. passenger-voice.js remains the legacy behavioral reference.
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAMissionFireWatchCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
'use strict';
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
function validateScenario(scenario) {
  if (scenario == null) return 'fire_watch_scenario_missing';
  if (typeof scenario !== 'object' || Array.isArray(scenario) || scenario.enabled !== true || scenario.type !== 'fire_watch') return 'fire_watch_scenario_invalid';
  return null;
}
function createState(context = {}, previous = null) {
  const scenario = clone(previous?.scenario ?? context.scenario ?? null);
  const error = validateScenario(scenario);
  if (error) throw new TypeError(error);
  return { scenario, satisfied: previous?.satisfied === true, atTargetDone: previous?.atTargetDone === true };
}
function run(context = {}, inputState = {}, sample = {}, now = Date.now(), operation = 'observe') {
  const voices = [];
  const initial = createState(context, inputState);
  let _poiSatisfied = initial.satisfied, _paxAtTargetDone = initial.atTargetDone;
  let currentMissionData = clone(context.missionData || {});
  const inherited = initial.scenario;
  currentMissionData.fireScenario = clone(inherited);
  const normalizedSample = { ...(sample?.position || sample || {}) };
  if (normalizedSample.alt == null && normalizedSample.altFt != null) normalizedSample.alt = normalizedSample.altFt;
  const normalizedFlight = { ...(sample?.flight || sample || {}) };
  if (normalizedFlight.mslFt == null && normalizedFlight.altFt != null) normalizedFlight.mslFt = normalizedFlight.altFt;
  const window = {
    lastLiveGpsPos: clone(normalizedSample), lastLiveFlightData: clone(normalizedFlight),
    activePassenger: clone(context.passenger || null),
    missionRuntimeIsActive: () => context.runtimeActive !== false
  };
  const Date = { now: () => Number(now) };
  const _getDestCoords = () => clone(context.target || null);
  window.GAMissionBoardingVoiceCore = context.boardingVoiceCore || null;
  const _firePersistState = () => {};
  const _fireSpeakText = (text, label = 'Feuerwache') => { const clean = _normalizeSpokenText(text); if (clean) voices.push({ text: String(clean), label: String(label) }); };
function _normalizeSpokenTextLegacy(text) {
    if (!text) return text;
    return String(text)
        .replace(/[–—]+/g, ', ')
        .replace(/\s*;\s*/g, ', ')
        .replace(/\.{3,}/g, '. ')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([,.!?])/g, '$1')
        .trim();
}

function _normalizeSpokenText(text) {
    const shared = window.GAMissionBoardingVoiceCore;
    return shared && typeof shared.normalizeSpokenText === 'function'
        ? shared.normalizeSpokenText(text)
        : _normalizeSpokenTextLegacy(text);
}

function _bearingDeg(lat1, lon1, lat2, lon2) {
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function _relativeClockPos(targetBearingDeg, headingDeg) {
    if (!Number.isFinite(targetBearingDeg) || !Number.isFinite(headingDeg)) return '12 Uhr';
    const rel = (targetBearingDeg - headingDeg + 360) % 360;
    const hour = Math.round(rel / 30) || 12;
    return `${hour > 12 ? hour - 12 : hour} Uhr`;
}

function _haversineNm(lat1, lon1, lat2, lon2) {
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 3440.065;
}

function _fireScenario() {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    const fs = md?.fireScenario;
    return (fs && typeof fs === 'object' && fs.enabled && fs.type === 'fire_watch') ? fs : null;
}

function _fireMissionRuntimeActive() {
    if (typeof window.missionRuntimeIsActive === 'function') return !!window.missionRuntimeIsActive();
    try { return typeof missionRuntime !== 'undefined' && !!missionRuntime.active; } catch (_) { return false; }
}

function _fireTarget(fs = _fireScenario()) {
    if (fs?.target && Number.isFinite(Number(fs.target.lat)) && Number.isFinite(Number(fs.target.lon))) {
        return {
            name: fs.target.name || 'Zielgebiet',
            lat: Number(fs.target.lat),
            lon: Number(fs.target.lon),
            altFt: Number.isFinite(Number(fs.target.altFt)) ? Number(fs.target.altFt) : null
        };
    }
    const dest = _getDestCoords();
    if (!dest) return null;
    return { name: (typeof currentMissionData !== 'undefined' ? currentMissionData?.poiName : null) || 'Zielgebiet', lat: dest.lat, lon: dest.lon, altFt: null };
}

function _fireRound(value, digits = 1) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const f = Math.pow(10, digits);
    return Math.round(n * f) / f;
}

function _fireMissionContext(flightData = null) {
    const fs = _fireScenario();
    const target = _fireTarget(fs);
    const pos = window.lastLiveGpsPos || {};
    const fd = flightData || window.lastLiveFlightData || {};
    const lat = Number(pos.lat);
    const lon = Number(pos.lon);
    if (!fs || !target || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        return { fs, target, hasPosition: false };
    }
    const distNm = _haversineNm(lat, lon, target.lat, target.lon);
    const bearingDeg = _bearingDeg(lat, lon, target.lat, target.lon);
    const hdg = Number(fd.hdg || fd.heading || fd.trackDeg || fd.trkDeg || pos.hdg || bearingDeg);
    const mslFt = Number(fd.mslFt ?? pos.alt ?? fd.alt);
    const aglFt = Number(fd.aglFt);
    const now = Date.now();
    const areaNm = Number(fs.targetAreaNm || window.activePassenger?.targetRadiusNm || 1.5) || 1.5;
    if (distNm <= areaNm) {
        if (!fs.targetAreaEnteredAt) fs.targetAreaEnteredAt = now;
    } else if (fs.targetAreaEnteredAt && !fs.searchStartedAt) {
        fs.searchStartedAt = fs.targetAreaEnteredAt;
    }
    const inTargetAreaSec = fs.targetAreaEnteredAt ? Math.max(0, (now - fs.targetAreaEnteredAt) / 1000) : 0;
    return {
        fs,
        target,
        hasPosition: true,
        lat,
        lon,
        distNm,
        bearingDeg,
        bearingText: `${Math.round(bearingDeg).toString().padStart(3, '0')} Grad`,
        clockPos: _relativeClockPos(bearingDeg, hdg),
        hdg,
        mslFt: Number.isFinite(mslFt) ? Math.round(mslFt) : null,
        aglFt: Number.isFinite(aglFt) ? Math.round(aglFt) : null,
        areaNm,
        inTargetArea: distNm <= areaNm,
        inConfirmRange: distNm <= (Number(fs.confirmRangeNm || 2) || 2),
        inAwarenessRange: distNm <= (Number(fs.paxAwarenessRangeNm || 4) || 4),
        inTargetAreaSec
    };
}

function _fireVectorLine(ctx) {
    if (!ctx?.hasPosition) return 'Mir fehlen gerade Live-Positionsdaten vom Tracker.';
    return `Zielgebiet ${_fireDistanceSpeak(ctx.distNm)}, Richtung ${_fireBearingSpeak(ctx.bearingDeg)}, ${ctx.clockPos}.`;
}

function _fireShortVector(ctx) {
    if (!ctx?.hasPosition) return 'Zielgebiet voraus';
    return `${_fireDistanceSpeak(ctx.distNm)}, ${ctx.clockPos}`;
}

function _fireDistanceSpeak(distNm) {
    const n = Math.max(0, Number(distNm));
    if (!Number.isFinite(n)) return 'in unbekannter Entfernung';
    if (n < 0.75) return 'unter 1 Meile';
    const miles = Math.max(1, Math.round(n));
    return `circa ${miles} Meile${miles === 1 ? '' : 'n'}`;
}

function _fireBearingSpeak(bearingDeg) {
    const n = Math.round((((Number(bearingDeg) || 0) % 360) + 360) % 360);
    const digits = n.toString().padStart(3, '0').split('');
    const words = {
        '0': 'null',
        '1': 'eins',
        '2': 'zwei',
        '3': 'drei',
        '4': 'vier',
        '5': 'fünf',
        '6': 'sechs',
        '7': 'sieben',
        '8': 'acht',
        '9': 'neun'
    };
    return `${digits.map(d => words[d] || d).join(' ')} Grad`;
}

function _fireSmokeSourceCount(fs) {
    const raw = Number(fs?.smokeSiteCount || fs?.smoke?.sites?.length || 0);
    if (Number.isFinite(raw) && raw > 0) return Math.max(1, Math.round(raw));
    if (fs?.extent === 'major_fire') return 3;
    if (fs?.extent === 'multi_smoke') return 2;
    if (fs?.truth === 'fire') return 1;
    return 0;
}

function _fireAssessmentText(fs) {
    if (!fs || fs.truth !== 'fire') {
        return 'Ich kann keine belastbare Rauchentwicklung bestaetigen. Das fuehre ich als wahrscheinliche Fehlmeldung und gebe es so weiter.';
    }
    const count = _fireSmokeSourceCount(fs);
    const sourceText = count === 1 ? 'eine Rauchentwicklung' : `${count} getrennte Rauchentwicklungen`;
    if (fs.extent === 'major_fire') {
        return `Ich zaehle ${sourceText}; Lagebild: mehrere aktive Punkte in einem kleinen Bereich, Rauch driftet vom Ursprung weg. Ich melde Position, Ausdehnung und moegliche Brandherde an die Leitstelle.`;
    }
    if (fs.extent === 'multi_smoke') {
        return `Ich zaehle ${sourceText}; Lagebild: getrennte Rauchpunkte, vermutlich ein zusammenhaengender Einsatzbereich. Ich melde Positionen und Ausdehnung an die Leitstelle.`;
    }
    return `Ich zaehle ${sourceText}; Lagebild: lokaler Rauchpunkt, Ursprung noch eingrenzen. Ich melde Position und erste Einschaetzung an die Leitstelle.`;
}

function _fireReturnClearanceText(fs) {
    if (fs?.truth === 'fire' || fs?.state === 'assessment_complete') {
        return 'Die Einsatzdaten sind uebermittelt. Du bist fuer den Rueckflug freigegeben.';
    }
    return 'Die Leitstelle hat die wahrscheinliche Fehlmeldung aufgenommen. Du bist fuer den Rueckflug freigegeben.';
}

function _fireRemainingSearchText(ctx) {
    const req = Number(ctx?.fs?.searchDwellSec || 180);
    const leftSec = Math.max(0, req - Number(ctx?.inTargetAreaSec || 0));
    const min = Math.max(1, Math.ceil(leftSec / 60));
    return `noch etwa ${min} Minute${min === 1 ? '' : 'n'} Suchzeit`;
}

function _fireRecordObservation(kind, ctx, note = '') {
    const fs = ctx?.fs || _fireScenario();
    if (!fs) return;
    if (!Array.isArray(fs.observations)) fs.observations = [];
    fs.observations.push({
        at: Date.now(),
        kind,
        state: fs.state || 'enroute',
        distNm: ctx?.hasPosition ? _fireRound(ctx.distNm, 2) : null,
        bearingDeg: ctx?.hasPosition ? Math.round(ctx.bearingDeg) : null,
        mslFt: ctx?.mslFt ?? null,
        aglFt: ctx?.aglFt ?? null,
        note
    });
    if (fs.observations.length > 20) fs.observations.splice(0, fs.observations.length - 20);
    _firePersistState();
}

function _fireMissionAwarenessTick(flightData, distNm = null) {
    const fs = _fireScenario();
    if (!fs || fs.awarenessDone) return;
    const ctx = _fireMissionContext(flightData);
    const dist = Number.isFinite(Number(distNm)) ? Number(distNm) : ctx.distNm;
    if (!Number.isFinite(dist) || dist > (Number(fs.paxAwarenessRangeNm || 4) || 4)) return;
    fs.awarenessDone = true;
    fs.state = fs.state || 'search';
    _fireRecordObservation('awareness_range', ctx, 'pax awareness range reached');
    const text = fs.truth === 'fire'
        ? `${_fireVectorLine(ctx)} Ich glaube, da vorn ist etwas zu sehen. Ich beobachte weiter und gleiche es mit der gemeldeten Position ab.`
        : `${_fireVectorLine(ctx)} Wir sind im gemeldeten Bereich. Ich sehe noch nichts Eindeutiges; wir suchen weiter und pruefen das Zielgebiet aus mehreren Blickwinkeln.`;
    _fireSpeakText(text, 'Feuermeldung');
}

function _fireHasObservation(fs, kind) {
    return Array.isArray(fs?.observations) && fs.observations.some(o => o?.kind === kind);
}

function _tickFireMissionSearch(flightData, distNm = null) {
    const fs = _fireScenario();
    if (!fs) return false;
    if (!_fireMissionRuntimeActive()) return true;
    _fireMissionAwarenessTick(flightData, distNm);
    const ctx = _fireMissionContext(flightData);
    if (!ctx.hasPosition) return true;

    if (ctx.inTargetArea && !fs.targetAreaAnnounced) {
        fs.targetAreaAnnounced = true;
        fs.state = fs.state === 'enroute' ? 'searching' : (fs.state || 'searching');
        _fireRecordObservation('target_area_entry', ctx, 'entered fire search area');
        _fireSpeakText(`${_fireVectorLine(ctx)} Zielgebiet erreicht. Halte ein ruhiges Suchmuster; ich uebernehme die Beobachtung und gleiche Rauch, Ursprung und Ausdehnung ab.`, 'Zielgebiet');
        _firePersistState();
    }

    if (fs.state === 'smoke_confirmed' && fs.smokeConfirmedAt && !fs.assessmentComplete) {
        const elapsed = (Date.now() - fs.smokeConfirmedAt) / 1000;
        if (elapsed >= Number(fs.assessmentDwellSec || 240)) {
            fs.assessmentComplete = true;
            fs.state = 'assessment_complete';
            _poiSatisfied = true;
            _paxAtTargetDone = true;
            _fireRecordObservation('assessment_complete', ctx, 'fire assessment dwell complete');
            _fireSpeakText(`Aufgabe abgeschlossen. ${_fireAssessmentText(fs)} ${_fireReturnClearanceText(fs)}`, 'Lagebild komplett');
            _firePersistState();
        }
    }

    const noSmokeReported = _fireHasObservation(fs, 'pilot_no_smoke');
    const searchDone = ctx.inTargetArea && Number(ctx.inTargetAreaSec || 0) >= Number(fs.searchDwellSec || 180);
    if (searchDone && noSmokeReported && fs.truth === 'false_alarm' && fs.state !== 'false_alarm_rtb') {
        fs.state = 'false_alarm_rtb';
        _poiSatisfied = true;
        _paxAtTargetDone = true;
        _fireRecordObservation('false_alarm_complete', ctx, 'search dwell complete without smoke');
        _fireSpeakText(`Suchzeit komplett. Ich kann keine belastbare Rauchentwicklung bestaetigen; ich melde wahrscheinliche Fehlmeldung. ${_fireReturnClearanceText(fs)}`, 'Fehlmeldung');
        _firePersistState();
    }
    return true;
}

function fireMissionPositionReport() {
    const ctx = _fireMissionContext();
    if (!ctx.fs) {
        _fireSpeakText('Hier ist keine aktive Feuerwache geladen.', 'Feuerwache');
        return;
    }
    _fireRecordObservation('position_report', ctx);
    if (!ctx.hasPosition) {
        _fireSpeakText('Ich habe gerade keine Live-Position vom Tracker. Sobald die GPS-Daten wieder laufen, gebe ich dir Richtung und Entfernung zum Zielgebiet.', 'Feuerwache');
        return;
    }
    if (ctx.fs.state === 'assessment_complete') {
        _fireSpeakText(`Mission abgeschlossen. ${_fireAssessmentText(ctx.fs)} ${_fireReturnClearanceText(ctx.fs)}`, 'Missionsstatus');
        return;
    }
    if (ctx.fs.state === 'false_alarm_rtb') {
        _fireSpeakText(`Mission abgeschlossen. Keine belastbare Rauchentwicklung bestaetigt. ${_fireReturnClearanceText(ctx.fs)}`, 'Missionsstatus');
        return;
    }
    if (ctx.fs.state === 'smoke_confirmed') {
        _fireSpeakText(`Rauch bestaetigt. ${_fireAssessmentText(ctx.fs)} Halte den Orbit noch stabil; ${_fireRemainingSearchText(ctx)} fuer das Lagebild.`, 'Missionsstatus');
        return;
    }
    if (ctx.fs.state === 'reported_smoke_unconfirmed') {
        _fireSpeakText(`Rauchmeldung noch unbestaetigt. ${_fireVectorLine(ctx)} Ich gleiche Sichtung und Zielposition weiter ab.`, 'Missionsstatus');
        return;
    }
    const action = ctx.inTargetArea
        ? `Noch kein belastbarer Befund. Halte den Orbit stabil; ${_fireRemainingSearchText(ctx)}.`
        : `Weiter Richtung Zielgebiet, ${ctx.clockPos}.`;
    _fireSpeakText(`${_fireVectorLine(ctx)} ${action}`, 'Missionsstatus');
}

function fireMissionReportNoSmoke() {
    const ctx = _fireMissionContext();
    if (!ctx.fs) {
        _fireSpeakText('Hier ist keine aktive Feuerwache geladen.', 'Feuerwache');
        return;
    }
    _fireRecordObservation('pilot_no_smoke', ctx);
    if (!ctx.hasPosition) {
        _fireSpeakText('Verstanden, noch kein Rauch sichtbar. Mir fehlen gerade die Live-Daten fuer eine Suchrichtung; pruefe bitte Tracker-Verbindung und halte den letzten Zielpunkt.', 'Kein Rauch');
        return;
    }
    if (ctx.fs.state === 'smoke_confirmed' || ctx.fs.state === 'assessment_complete') {
        _fireSpeakText(`Verstanden, aus deiner Perspektive ist das gerade nicht klar sichtbar. Ich halte die bestaetigte Lage weiter fest: ${_fireAssessmentText(ctx.fs)} Halte den Orbit, ich beobachte weiter.`, 'Kein Rauch');
        _firePersistState();
        return;
    }
    if (ctx.fs.state === 'false_alarm_rtb') {
        _fireSpeakText(`Passt, weiterhin keine bestaetigte Rauchentwicklung. ${_fireReturnClearanceText(ctx.fs)}`, 'Fehlmeldung');
        _firePersistState();
        return;
    }
    if (!ctx.inTargetArea) {
        ctx.fs.state = 'search_enroute';
        _fireSpeakText(`Verstanden, noch nichts sichtbar. ${_fireVectorLine(ctx)} Weiter zum Zielgebiet, dort pruefen wir aus der Naehe.`, 'Kein Rauch');
        _firePersistState();
        return;
    }
    const dwellDone = Number(ctx.inTargetAreaSec || 0) >= Number(ctx.fs.searchDwellSec || 180);
    if (dwellDone && ctx.fs.truth === 'false_alarm') {
        ctx.fs.state = 'false_alarm_rtb';
        _poiSatisfied = true;
        _paxAtTargetDone = true;
        _fireSpeakText(`Keine Rauchentwicklung feststellbar nach der Suchzeit. Ich melde wahrscheinliche Fehlmeldung. ${_fireReturnClearanceText(ctx.fs)}`, 'Fehlmeldung');
        _firePersistState();
        return;
    }
    ctx.fs.state = 'searching';
    const hint = ctx.fs.truth === 'fire'
        ? 'Die Meldung bleibt offen; Rauch kann im Gelaende oder unter der Sichtlinie liegen. Halte ein ruhiges Suchmuster, ich pruefe weiter.'
        : 'Ich kann ebenfalls nichts bestaetigen. Wir halten die Suchzeit noch sauber durch.';
    _fireSpeakText(`${_fireVectorLine(ctx)} Verstanden, noch nichts bestaetigt. ${hint} ${_fireRemainingSearchText(ctx)}.`, 'Kein Rauch');
    _firePersistState();
}

function fireMissionReportSmokeVisible() {
    const ctx = _fireMissionContext();
    if (!ctx.fs) {
        _fireSpeakText('Hier ist keine aktive Feuerwache geladen.', 'Feuerwache');
        return;
    }
    _fireRecordObservation('pilot_smoke_visible', ctx);
    if (!ctx.hasPosition) {
        _fireSpeakText('Rauchmeldung aufgenommen. Mir fehlen gerade Live-Positionsdaten, daher kann ich Entfernung und Zielbezug noch nicht bestaetigen.', 'Rauchmeldung');
        return;
    }
    if (ctx.fs.state === 'assessment_complete') {
        _fireSpeakText(`Ja, die Lage ist bereits abgeschlossen dokumentiert. ${_fireAssessmentText(ctx.fs)} ${_fireReturnClearanceText(ctx.fs)}`, 'Rauch bestaetigt');
        _firePersistState();
        return;
    }
    if (ctx.fs.state === 'false_alarm_rtb') {
        _fireSpeakText('Ich kann das weiter nicht zur gemeldeten Position passend bestaetigen. Moeglich waere Dunst, Staub oder Schatten; ich lasse es als unbestaetigte Sichtung bei der Fehlmeldung stehen.', 'Rauch pruefen');
        _firePersistState();
        return;
    }
    if (!ctx.inConfirmRange) {
        ctx.fs.state = 'reported_smoke_unconfirmed';
        _fireSpeakText(`Rauchmeldung aufgenommen. ${_fireVectorLine(ctx)} Aus der Entfernung kann ich das noch nicht sicher zuordnen; naeher am Zielgebiet pruefe ich es mit.`, 'Rauchmeldung');
        _firePersistState();
        return;
    }
    if (ctx.fs.truth === 'fire') {
        ctx.fs.state = 'smoke_confirmed';
        if (!ctx.fs.smokeConfirmedAt) ctx.fs.smokeConfirmedAt = Date.now();
        _fireSpeakText(`Bestaetigt, das passt zur gemeldeten Rauchentwicklung. ${_fireAssessmentText(ctx.fs)} Halte den Orbit stabil; ich sammle das Lagebild und gebe Bescheid, wenn die Aufgabe abgeschlossen ist.`, 'Rauch bestaetigt');
        _firePersistState();
        return;
    }
    ctx.fs.state = 'reported_smoke_unconfirmed';
    _fireSpeakText(`${_fireVectorLine(ctx)} Ich kann das zur Meldung noch nicht bestaetigen. Wir pruefen weiter, ob es Rauch ist oder nur Dunst, Staub beziehungsweise Schattenwurf.`, 'Rauch pruefen');
    _firePersistState();
}
  if (operation === 'observe') _tickFireMissionSearch(window.lastLiveFlightData, sample?.distNm);
  else if (operation === 'fire_position') fireMissionPositionReport();
  else if (operation === 'fire_no_smoke') fireMissionReportNoSmoke();
  else if (operation === 'fire_smoke_visible') fireMissionReportSmokeVisible();
  else throw new TypeError('fire_watch_action_invalid');
  const state = { scenario: clone(currentMissionData.fireScenario), satisfied: _poiSatisfied, atTargetDone: _paxAtTargetDone };
  return { state, voices, satisfied: state.satisfied };
}
function observe(context, state, sample, now) { return run(context, state, sample, now, 'observe'); }
function action(context, state, actionName, sample, now) { return run(context, state, sample, now, String(actionName || '')); }
return Object.freeze({ observe, action, createState, validateScenario });
});
