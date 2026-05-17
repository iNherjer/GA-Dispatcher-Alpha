/* === Passenger Voice System (v2) ===
 * Two-step pipeline: Gemini text-gen → display in UI → Gemini TTS → play audio.
 * Events: greeting (engine start), at-target (POI/landing), farewell (debrief).
 * Works in both live and simulation mode.
 *
 * Requires:
 *   window._tawsAudioCtx, window._awmMasterGain  (taws.js)
 *   incrementApiUsage(type)                        (app.js)
 *   window.activePassenger, window.currentMissionData, window.routeWaypoints
 */

// ─── LOG ─────────────────────────────────────────────────────────────────────
const _paxLogEntries = [];
const _PAX_LOG_MAX   = 120;

// type: 'event' | 'send' | 'recv' | 'audio' | 'warn' | 'state'
function _paxLog(msg, type = 'event') {
    const ts = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    _paxLogEntries.unshift({ ts, msg, type });
    if (_paxLogEntries.length > _PAX_LOG_MAX) _paxLogEntries.length = _PAX_LOG_MAX;
    console.log(`[PaxVoice] ${msg}`);
    _paxLogRender();
}

function _paxLogRender() {
    const el = document.getElementById('paxLogBody');
    if (!el) return;
    const PREFIX = { event: '▶', send: '↑ SEND', recv: '↓ RECV', audio: '🔊', warn: '⚠', state: '·' };
    el.textContent = _paxLogEntries.map(e => `${e.ts}  ${(PREFIX[e.type] || '·').padEnd(6)}  ${e.msg}`).join('\n');
}

window.paxVoiceClearLog = function() { _paxLogEntries.length = 0; _paxLogRender(); };
window.paxVoiceOpenLog  = function() {
    const p = document.getElementById('paxLogPanel');
    if (!p) return;
    p.style.display = p.style.display === 'none' ? 'flex' : 'none';
    const lbl = document.getElementById('paxLogModeLabel');
    if (lbl) lbl.textContent = _paxStrictMode ? 'STRENG' : 'EASY';
    _paxLogRender();
};
window.paxVoiceGetLogEntries = function() {
    return _paxLogEntries.map(e => ({ ts: e.ts, type: e.type, msg: e.msg }));
};

// ─── MAP ZONES ────────────────────────────────────────────────────────────────
let _paxZonesLayer   = null;
let _paxZonesVisible = false;

window.paxVoiceToggleZones = function() {
    _paxZonesVisible = !_paxZonesVisible;
    const btn = document.getElementById('btnPaxZones');
    if (btn) btn.textContent = _paxZonesVisible ? 'Pax Zonen Ein' : 'Pax Zonen Aus';
    if (_paxZonesVisible) { _paxDrawZones(); }
    else if (_paxZonesLayer && typeof map !== 'undefined') { map.removeLayer(_paxZonesLayer); _paxZonesLayer = null; }
};

window.paxVoiceRefreshZones = function() { if (_paxZonesVisible) _paxDrawZones(); };

function _paxDrawZones() {
    if (typeof map === 'undefined' || !map || typeof L === 'undefined') return;
    if (_paxZonesLayer) map.removeLayer(_paxZonesLayer);
    _paxZonesLayer = L.layerGroup();

    const pax = window.activePassenger;
    const NM  = 1852; // metres per NM

    if (_isPOIMission()) {
        const dest = _getDestCoords();
        if (dest && pax) {
            const r = (pax.targetRadiusNm || 1.5) * NM;
            const label = `POI-Radius: ${pax.targetRadiusNm || 1.5} NM`
                + (pax.targetAltFt  ? ` · ${pax.targetAltFt} ft`  : '')
                + (pax.targetDwellMin ? ` · ${pax.targetDwellMin} min` : ' · Überflug');
            L.circle([dest.lat, dest.lon], { radius: r, color: '#4da6ff', weight: 2, opacity: 0.9,
                fillColor: '#4da6ff', fillOpacity: 0.08, dashArray: '10,7' })
             .bindTooltip(label, { permanent: false }).addTo(_paxZonesLayer);
            // Altitude ring label at centre
            if (pax.targetAltFt) {
                L.marker([dest.lat, dest.lon], { icon: L.divIcon({
                    className: '', html: `<div style="background:rgba(10,20,40,0.75);color:#4da6ff;font-size:11px;padding:2px 6px;border-radius:4px;white-space:nowrap;border:1px solid #2a5a9a;">${pax.targetAltFt} ft · ${pax.targetDwellMin || 0} min</div>`,
                    iconAnchor: [40, 0]
                }), interactive: false }).addTo(_paxZonesLayer);
            }
        }
    } else {
        // Airport approach ring
        const wps = (typeof routeWaypoints !== 'undefined') ? routeWaypoints : null;
        if (wps && wps.length >= 2) {
            const last = wps[wps.length - 1];
            L.circle([last.lat, last.lng ?? last.lon], { radius: _AIRPORT_AT_TARGET_NM * NM, color: '#ffa040', weight: 2,
                opacity: 0.9, fillColor: '#ffa040', fillOpacity: 0.08, dashArray: '10,7' })
             .bindTooltip(`At-Target: ${_AIRPORT_AT_TARGET_NM.toFixed(1)} NM vor Landung`).addTo(_paxZonesLayer);
        }
    }
    _paxZonesLayer.addTo(map);
}

// ─── TOGGLE ──────────────────────────────────────────────────────────────────
let _paxVoiceEnabled = (localStorage.getItem('awm_pax_voice') === '1');
let _lastSpokenText  = null; // last generated text — for retroactive TTS
let _lastSpokenSpeaker = null; // speaker snapshot for retroactive TTS

window.paxVoiceSetEnabled = function(on) {
    const wasOff = !_paxVoiceEnabled;
    _paxVoiceEnabled = !!on;
    localStorage.setItem('awm_pax_voice', on ? '1' : '0');
    if (on && wasOff && _lastSpokenText && window.activePassenger && _missionHasPax()) {
        _paxLog('Voice aktiviert — lade TTS für letzte Nachricht nach', 'event');
        setTimeout(() => _playTextAsTTS(_lastSpokenText, _lastSpokenSpeaker || null), 400);
    }
};

function _missionHasPax() {
    let paxText = '';
    try {
        const contract = JSON.parse(localStorage.getItem('ga_active_mission_contract') || 'null');
        paxText = String(contract?.paxText || '').trim();
    } catch (_) {}
    if (!paxText) {
        const ui = document.getElementById('mPay');
        paxText = String(ui?.innerText || '').trim();
    }
    if (!paxText) return true;
    const m = paxText.match(/^\s*(\d+)\s*PAX\b/i);
    if (m) return parseInt(m[1], 10) > 0;
    return !/^\s*0\s*PAX\b/i.test(paxText);
}

// ─── PER-MISSION STATE ───────────────────────────────────────────────────────
let _paxGreetingDone  = false;
let _paxAtTargetDone  = false;  // airport at-target done
let _paxFarewellDone  = false;
let _paxComfortLastAt = 0;
let _paxComfortCount  = 0;
let _paxComfortBusy   = false;
let _paxLandingPhaseAnnounced = false;
let _paxWxMismatchDone = false;
let _paxSpeechQueue   = Promise.resolve();
let _paxWrongStartActive = false;
let _paxWrongStartContinueDone = false;
let _paxOffDestLastAt = 0;
let _pattonvilleJuliusMentioned = false;
let _pattonvilleReportingPointsMentioned = false;
let _aptTrainingBriefDone = false;
let _aptTrainingLandingBriefDone = false;
const _UNIFIED_INSTRUCTOR_BASELINE = true;
let _trainingEval = null;

// POI dwell state machine
let _poiInRadius        = false;
let _poiEnteredAt       = null;
let _poiLastTickTime    = null;
let _poiDwellSec        = 0;
let _poiAttempts        = 0;
let _poiLastComplaintAt = null;
let _poiAltWasOk        = null;  // null=unknown, true/false
let _poiSatisfied       = false;
let _poiAborted         = false;
let _poiEntryDone       = false; // entry comment fired once on radius entry
let _poiInspectionOutcome = null; // keeps one consistent inspection result per mission
let _sarSearchOutcome = null; // keeps one consistent SAR outcome per mission
let _poiSightCallDone   = false; // early pre-arrival call before entering POI radius
let _poiTrainingLastDistToDestNm = null; // trend helper: detect outbound vs. return leg
let _poiTrainingPreBriefDone = false; // 4 NM before training area
let _poiTrainingZoneStartDone = false; // when entering training area
let _poiTrainingLandingBriefDone = false; // 5/4 NM before landing on return leg
let _poiNarrativeMemory = { pre: '', entry: '', done: '' }; // anti-repeat memory across POI phases

window.paxVoiceResetMission = function() {
    _paxGreetingDone  = false;
    _paxAtTargetDone  = false;
    _paxFarewellDone  = false;
    _paxComfortLastAt = 0;
    _paxComfortCount  = 0;
    _paxComfortBusy   = false;
    _paxLandingPhaseAnnounced = false;
    _paxWxMismatchDone = false;
    _paxSpeechQueue   = Promise.resolve();
    _lastSpokenSpeaker = null;
    _paxWrongStartActive = false;
    _paxWrongStartContinueDone = false;
    _paxOffDestLastAt = 0;
    _pattonvilleJuliusMentioned = false;
    _pattonvilleReportingPointsMentioned = false;
    _aptTrainingBriefDone = false;
    _aptTrainingLandingBriefDone = false;
    _trainingEval = {
        active: false,
        startedAt: 0,
        samples: 0,
        minAltFt: Number.POSITIVE_INFINITY,
        maxAltFt: Number.NEGATIVE_INFINITY,
        maxAbsBankDeg: 0,
        maxGForce: 1.0,
        maxClimbFpm: 0,
        maxDescentFpm: 0,
        aoaSamples: 0,
        maxAoaDeg: 0,
        stallEvents: 0,
        _stallPrev: false
    };
    _poiInRadius      = false;
    _poiEnteredAt     = null;
    _poiLastTickTime  = null;
    _poiDwellSec      = 0;
    _poiAttempts      = 0;
    _poiLastComplaintAt = null;
    _poiAltWasOk      = null;
    _poiSatisfied     = false;
    _poiAborted       = false;
    _poiEntryDone     = false;
    _poiInspectionOutcome = null;
    _sarSearchOutcome = null;
    _poiSightCallDone = false;
    _poiTrainingLastDistToDestNm = null;
    _poiTrainingPreBriefDone = false;
    _poiTrainingZoneStartDone = false;
    _poiTrainingLandingBriefDone = false;
    _poiNarrativeMemory = { pre: '', entry: '', done: '' };
    _lastPaxText = '';
    _closePaxPanel();
    _refreshPaxWidgetVisibility();
};

function _poiMemoryCompact(text) {
    const s = String(text || '')
        .replace(/\s+/g, ' ')
        .replace(/\b(äh|aeh|halt|quasi|sozusagen)\b/gi, '')
        .trim();
    if (!s) return '';
    const parts = s.split(/[.!?]/).map(x => x.trim()).filter(Boolean);
    const first = parts[0] || s;
    return first.length > 180 ? `${first.slice(0, 177)}...` : first;
}

function _capturePoiNarrativeMemory(eventLabel, spokenText) {
    if (!_isPOIMission()) return;
    const ev = String(eventLabel || '').toLowerCase();
    const compact = _poiMemoryCompact(spokenText);
    if (!compact) return;
    if (ev.includes('objekt in sicht')) _poiNarrativeMemory.pre = compact;
    else if (ev.includes('zielgebiet')) _poiNarrativeMemory.entry = compact;
    else if (ev.includes('ziel erfüllt') || ev.includes('ziel erfuellt') || ev.includes('am ziel')) _poiNarrativeMemory.done = compact;
}

function _poiNoRepeatHint(stage = 'entry') {
    if (!_isPOIMission()) return '';
    const used = [];
    if (stage === 'entry') {
        if (_poiNarrativeMemory.pre) used.push(_poiNarrativeMemory.pre);
    } else if (stage === 'result') {
        if (_poiNarrativeMemory.pre) used.push(_poiNarrativeMemory.pre);
        if (_poiNarrativeMemory.entry) used.push(_poiNarrativeMemory.entry);
    } else {
        if (_poiNarrativeMemory.pre) used.push(_poiNarrativeMemory.pre);
        if (_poiNarrativeMemory.entry) used.push(_poiNarrativeMemory.entry);
        if (_poiNarrativeMemory.done) used.push(_poiNarrativeMemory.done);
    }
    if (!used.length) return '';
    return ` Bereits genannt (nicht wiederholen, nicht paraphrasieren): ${used.join(' | ')}. Liefere stattdessen neue, konkrete Zusatzinfos.`;
}

function _isPattonvilleMissionTarget() {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const uiDest = document.getElementById('mDestName')?.innerText || '';
    const wikiDest = document.getElementById('wikiDestNameDisplay')?.innerText || '';
    const hay = `${String(md?.dest || '')} ${String(md?.poiName || '')} ${String(uiDest || '')} ${String(wikiDest || '')}`.toLowerCase();
    return /\bpattonville\b/.test(hay);
}

function _isLandingPhaseEvent(eventLabel, text) {
    const ev = String(eventLabel || '').toLowerCase();
    const msg = String(text || '').toLowerCase();
    if (/landung|verabschiedung/.test(ev)) return true;
    // Trainings-Landing-Calls laufen über "Instruktor", daher zusätzlich Textheuristik.
    return /landung|anflug|endanflug|aufsetzen/.test(msg);
}

function _isTrainingLandingInstructorEvent(eventLabel, text) {
    const ev = String(eventLabel || '').toLowerCase();
    const msg = String(text || '').toLowerCase();
    if (ev !== 'instruktor') return false;
    if (!_activeAptTrainingPlan()) return false;
    return /landung|anflug|endanflug|aufsetzen/.test(msg);
}

function _injectPattonvilleJuliusEasteregg(text, eventLabel) {
    const base = String(text || '').trim();
    if (!base) return base;
    if (_pattonvilleJuliusMentioned) return base;
    if (!_isPattonvilleMissionTarget()) return base;
    if (!_isLandingPhaseEvent(eventLabel, base)) return base;
    if (/\bjulius\b/i.test(base)) return base;

    const juliusLines = [
        'Und in Pattonville steht der Julius schon am Grill und tut so, als wäre das hier ein Fly-In-Fest.',
        'Wenn wir in Pattonville aufsetzen, grüß den Julius, der hat meistens schon ein Kaltgetränk in Reichweite.',
        'In Pattonville läuft garantiert der Julius rum, alter Bekannter und selbst ernannter Rampen-Entertainer.'
    ];
    const easteregg = juliusLines[Math.floor(Math.random() * juliusLines.length)] || juliusLines[0];
    _pattonvilleJuliusMentioned = true;
    _paxLog('Pattonville-Easteregg aktiv: Julius-Hinweis ergänzt', 'event');
    return `${base} ${easteregg}`.replace(/\s{2,}/g, ' ').trim();
}

function _injectPattonvilleReportingPointsHint(text, eventLabel) {
    const base = String(text || '').trim();
    if (!base) return base;
    if (_pattonvilleReportingPointsMentioned) return base;
    if (!_isPattonvilleMissionTarget()) return base;
    if (!_isTrainingLandingInstructorEvent(eventLabel, base)) return base;
    if (/(autokino|wasserturm|pflichtmeldepunkt|meldepunkt)/i.test(base)) return base;

    const hint = 'In Pattonville bitte auf die Pflichtmeldepunkte Autokino und Wasserturm achten, dort gilt lokal keine klassische Platzrunde.';
    _pattonvilleReportingPointsMentioned = true;
    _paxLog('Pattonville-Local aktiv: Pflichtmeldepunkte ergänzt', 'event');
    return `${base} ${hint}`.replace(/\s{2,}/g, ' ').trim();
}

function _trainingEvalBegin() {
    if (!_trainingEval) return;
    if (_trainingEval.active) return;
    _trainingEval.active = true;
    _trainingEval.startedAt = Date.now();
}

function _toBoolStall(v) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v > 0.5;
    const s = String(v || '').trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'stall';
}

function _trainingEvalTick(flightData) {
    if (!_trainingEval || !_trainingEval.active || !flightData) return;
    const alt = Number(flightData.mslFt);
    const bank = Math.abs(Number(flightData.bankDeg || 0));
    const g = Number(flightData.gForce || 1.0);
    const vs = Number.isFinite(flightData.vsFpm) ? Number(flightData.vsFpm) : Number(flightData.vs || 0);
    if (Number.isFinite(alt)) {
        _trainingEval.minAltFt = Math.min(_trainingEval.minAltFt, alt);
        _trainingEval.maxAltFt = Math.max(_trainingEval.maxAltFt, alt);
    }
    if (Number.isFinite(bank)) _trainingEval.maxAbsBankDeg = Math.max(_trainingEval.maxAbsBankDeg, bank);
    if (Number.isFinite(g) && g > 0.1) _trainingEval.maxGForce = Math.max(_trainingEval.maxGForce, g);
    if (Number.isFinite(vs)) {
        if (vs > 0) _trainingEval.maxClimbFpm = Math.max(_trainingEval.maxClimbFpm, vs);
        if (vs < 0) _trainingEval.maxDescentFpm = Math.min(_trainingEval.maxDescentFpm, vs);
    }

    const aoa = Number(flightData.aoaDeg);
    if (Number.isFinite(aoa)) {
        _trainingEval.aoaSamples += 1;
        _trainingEval.maxAoaDeg = Math.max(_trainingEval.maxAoaDeg, Math.abs(aoa));
    }
    const stallNow = _toBoolStall(flightData.stallState);
    if (stallNow && !_trainingEval._stallPrev) _trainingEval.stallEvents += 1;
    _trainingEval._stallPrev = stallNow;
    _trainingEval.samples += 1;
}

function _trainingEvalSummary() {
    if (!_trainingEval || _trainingEval.samples < 8) return null;
    const minAlt = Number.isFinite(_trainingEval.minAltFt) ? _trainingEval.minAltFt : null;
    const maxAlt = Number.isFinite(_trainingEval.maxAltFt) ? _trainingEval.maxAltFt : null;
    const altVar = (minAlt != null && maxAlt != null) ? Math.max(0, Math.round(maxAlt - minAlt)) : null;
    const bank = Math.round(_trainingEval.maxAbsBankDeg || 0);
    const maxG = Number((_trainingEval.maxGForce || 1.0).toFixed(2));
    const climb = Math.round(_trainingEval.maxClimbFpm || 0);
    const descent = Math.round(_trainingEval.maxDescentFpm || 0);
    const aoaMax = _trainingEval.aoaSamples > 0 ? Number((_trainingEval.maxAoaDeg || 0).toFixed(1)) : null;
    const stallEvents = _trainingEval.stallEvents || 0;
    return { altVar, bank, maxG, climb, descent, aoaMax, stallEvents, samples: _trainingEval.samples };
}

// ─── STRICT / EASY MODE ──────────────────────────────────────────────────────
let _paxStrictMode = (localStorage.getItem('awm_pax_strict') === '1');
let _paxHumorLevel = (localStorage.getItem('awm_pax_humor') || 'normal');
if (!['subtle', 'normal', 'bold'].includes(_paxHumorLevel)) _paxHumorLevel = 'normal';
function _normalizePaxTtsModelPref(mode) {
    return (mode === '2.5' || mode === 'auto') ? mode : 'auto';
}
let _paxTtsModelPref = _normalizePaxTtsModelPref(localStorage.getItem('awm_pax_tts_model') || 'auto');
localStorage.setItem('awm_pax_tts_model', _paxTtsModelPref);

window.paxVoiceSetMode = function(strict) {
    _paxStrictMode = !!strict;
    localStorage.setItem('awm_pax_strict', strict ? '1' : '0');
    const el = document.getElementById('awmPaxModeSelect');
    if (el) el.value = strict ? 'strict' : 'easy';
};

window.paxVoiceSetHumor = function(level) {
    const next = (level === 'subtle' || level === 'bold' || level === 'normal') ? level : 'normal';
    _paxHumorLevel = next;
    localStorage.setItem('awm_pax_humor', next);
    const el = document.getElementById('awmPaxHumorSelect');
    if (el) el.value = next;
};

window.paxVoiceSetTtsModel = function(mode) {
    const next = _normalizePaxTtsModelPref(mode);
    _paxTtsModelPref = next;
    localStorage.setItem('awm_pax_tts_model', next);
    const el = document.getElementById('awmPaxTtsModelSelect');
    if (el) el.value = next;
    _paxLog(`TTS-Modus gesetzt: ${next}`, 'state');
};

// ─── INIT ─── called at bottom of file after all defs ───────────────────────

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function _getApiKey() {
    return document.getElementById('apiKeyInput')?.value.trim() || '';
}

function _isPOIMission() {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    if (md && typeof md === 'object' && md.poiName) return true;
    if (typeof currentDestICAO !== 'undefined' && currentDestICAO === 'POI') return true;
    return document.getElementById('destRwyContainer')?.style.display === 'none';
}

function _getMissionStory() {
    return document.getElementById('mStory')?.innerText?.trim() || '';
}

function _getDestCoords() {
    const el = document.getElementById('mDestCoords');
    if (!el) return null;
    const parts = el.innerText.split(',').map(s => parseFloat(s.trim()));
    if (parts.length >= 2 && isFinite(parts[0]) && isFinite(parts[1])) return { lat: parts[0], lon: parts[1] };
    return null;
}

function _normTaskDomain(value) {
    const s = String(value || '').trim().toLowerCase();
    const allowed = new Set([
        'general',
        'training',
        'charter',
        'inspection_infra',
        'media_photo',
        'science_bio',
        'science_geo',
        'science_general',
        'club_utility',
        'medical_transfer',
        'news_coverage',
        'sightseeing_tour',
        'historian_guided_tour',
        'poi_learning_guide',
        'mapping_survey',
        'cargo_fragile',
        'search_and_rescue',
        'fire_watch',
        'animal_transport',
        'club_training_basic',
        'club_training_advanced'
    ]);
    return allowed.has(s) ? s : 'general';
}

function _activeTaskDomain() {
    return _normTaskDomain(window.activePassenger?.taskDomain || '');
}

function _normLevel3(v) {
    const s = String(v || '').trim().toLowerCase();
    return (s === 'hoch' || s === 'mittel' || s === 'niedrig') ? s : 'mittel';
}

function _tolToSensitivityLevel(tol) {
    const t = _normLevel3(tol);
    if (t === 'niedrig') return 'hoch';
    if (t === 'hoch') return 'niedrig';
    return 'mittel';
}

function _levelRank(level) {
    const l = _normLevel3(level);
    return l === 'hoch' ? 3 : l === 'mittel' ? 2 : 1;
}

function _maxLevel(levels = []) {
    let best = 'niedrig';
    for (const lvl of levels) {
        if (_levelRank(lvl) > _levelRank(best)) best = _normLevel3(lvl);
    }
    return best;
}

function _levelMode(level) {
    const l = _normLevel3(level);
    return l === 'hoch' ? 'proactive' : l === 'mittel' ? 'reactive' : 'silent';
}

function _comfortFeedbackPolicy(pax) {
    const cargo = _normLevel3(pax?.cargoSensitivity || 'mittel');
    const stomach = _normLevel3(pax?.stomachSensitivity || 'mittel');
    const comfort = _normLevel3(pax?.comfortPriority || 'mittel');
    const gSens = _tolToSensitivityLevel(pax?.gTolerance || 'mittel');
    const bSens = _tolToSensitivityLevel(pax?.bankTolerance || 'mittel');

    const motionLevel = _maxLevel([stomach, comfort]);
    const weatherLevel = _maxLevel([motionLevel, cargo]);

    const metricLevels = {
        g: _maxLevel([motionLevel, gSens]),
        bank: _maxLevel([motionLevel, bSens]),
        wind: weatherLevel,
        gust: weatherLevel,
        turb: weatherLevel,
        precip: weatherLevel,
        descent: motionLevel
    };
    const metricModes = {
        g: _levelMode(metricLevels.g),
        bank: _levelMode(metricLevels.bank),
        wind: _levelMode(metricLevels.wind),
        gust: _levelMode(metricLevels.gust),
        turb: _levelMode(metricLevels.turb),
        precip: _levelMode(metricLevels.precip),
        descent: _levelMode(metricLevels.descent)
    };
    const proactiveAny = Object.values(metricModes).some(m => m === 'proactive');
    const reactiveAny = Object.values(metricModes).some(m => m === 'proactive' || m === 'reactive');
    return { cargo, stomach, comfort, gSens, bSens, metricLevels, metricModes, proactiveAny, reactiveAny };
}

function _inspectionMissionMeta() {
    if (!_isPOIMission()) return null;
    const pax = window.activePassenger || {};
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const role = String(pax.role || '').toLowerCase();
    const title = String(md.mission || '').toLowerCase();
    const story = String(_getMissionStory() || '').toLowerCase();
    const hay = `${role} ${title} ${story}`;
    const taskDomain = _activeTaskDomain();
    // Rollenreinheit: Fire-Watch ist Beobachtung/Frühwarnung, keine Bauwerks-/Geo-Inspektion.
    if (taskDomain === 'fire_watch') return null;
    // Rollenreinheit: Historiker erzaehlt Kontext/Geschichte, keine technische Zustandspruefung.
    if (taskDomain === 'historian_guided_tour') return null;
    if (taskDomain === 'poi_learning_guide') return null;
    const isInspectionByDomain = taskDomain === 'inspection_infra';
    const isInspectionByFallback = /(inspekt|pruef|prüfung|wartung|techn|statik|vermess|scan|check|schaden|fuge|mast|abspannung|brueck|bruck|autobahn|strass|funk|sendemast|stausee|staudamm|talsperre|wehr|sperrmauer)/.test(hay);
    const isInspection = isInspectionByDomain || isInspectionByFallback;
    if (!isInspection) return null;
    return {
        objectName: md.poiName || 'dem Objekt',
        role: role
    };
}

function _getPoiInspectionOutcome() {
    if (_poiInspectionOutcome) return _poiInspectionOutcome;
    const options = ['clear', 'minor', 'damage', 'pending'];
    _poiInspectionOutcome = options[Math.floor(Math.random() * options.length)];
    return _poiInspectionOutcome;
}

function _inspectionEntryHint() {
    const meta = _inspectionMissionMeta();
    if (!meta) return '';
    return ` Fokus Inspektion: Sag kurz, wonach du am Objekt "${meta.objectName}" suchst (z.B. Risse, lockere Bauteile, Schaeden, Auffaelligkeiten).`;
}

function _inspectionResultHint() {
    const meta = _inspectionMissionMeta();
    if (!meta) return '';
    const objectName = meta.objectName;
    const outcome = _getPoiInspectionOutcome();
    if (outcome === 'damage') {
        return ` Inspektionsfazit: Bei "${objectName}" hast du einen klaren Schaden gesehen. Sage konkret, was betroffen wirkt und dass der Befund weitergemeldet wird.`;
    }
    if (outcome === 'minor') {
        return ` Inspektionsfazit: Bei "${objectName}" hast du eine auffaellige Stelle gesehen, aber ohne sichere Schadensbestaetigung. Bitte um kurze Nachpruefung.`;
    }
    if (outcome === 'pending') {
        return ` Inspektionsfazit: Den gesuchten Punkt an "${objectName}" konntest du noch nicht eindeutig erkennen. Bitte freundlich um einen weiteren ruhigen Pass.`;
    }
    return ` Inspektionsfazit: Bei "${objectName}" konntest du keinen relevanten Schaden erkennen. Gib kurz Entwarnung.`;
}

function _getSarSearchOutcome() {
    if (_sarSearchOutcome) return _sarSearchOutcome;
    // Slight bias to "not found" for realism in random missions.
    _sarSearchOutcome = (Math.random() < 0.38) ? 'found' : 'not_found';
    return _sarSearchOutcome;
}

function _sarResultHint() {
    if (_activeTaskDomain() !== 'search_and_rescue') return '';
    const outcome = _getSarSearchOutcome();
    if (outcome === 'found') {
        return ' SAR-Fazit: Melde klar, dass du die vermisste Person entdeckt hast und die Koordinaten sofort an die Leitstelle weitergibst.';
    }
    return ' SAR-Fazit: Melde klar, dass wir in diesem Sektor keine Person finden konnten und die Leitstelle fuer weitere Suchabschnitte informiert wird.';
}

function _professionalRoleMeta() {
    const pax = window.activePassenger || {};
    const role = String(pax.role || '').toLowerCase();
    const story = String(_getMissionStory() || '').toLowerCase();
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const objectName = md.poiName || 'dem Zielobjekt';
    const taskDomain = _activeTaskDomain();

    if (taskDomain === 'media_photo' || taskDomain === 'inspection_infra' || taskDomain === 'training' || taskDomain === 'charter' || taskDomain === 'club_utility') {
        return null;
    }
    // Operative Domains sollen nicht in wissenschaftliche Fallback-Hinweise driften.
    if (/^(fire_watch|search_and_rescue|mapping_survey|news_coverage|medical_transfer|animal_transport|cargo_fragile|sightseeing_tour|historian_guided_tour|poi_learning_guide)$/.test(taskDomain)) {
        return null;
    }
    if (taskDomain === 'science_bio') {
        return {
            field: 'Biologie',
            entry: ` Nenne kurz, welche Arten/Indikatoren du an "${objectName}" beobachtest (z.B. Vogelkolonien, Ufervegetation, Stoerfaktoren).`,
            progress: ` Gib einen kurzen biologischen Zwischenstand zu "${objectName}" (Bestand, Aktivitaet, Auffaelligkeiten).`,
            result: ` Schließe mit einem biologischen Kurzfazit zu "${objectName}" ab (z.B. unauffaellig, Belastungshinweis, weiterer Beobachtungsbedarf).`
        };
    }
    if (taskDomain === 'science_geo') {
        return {
            field: 'Geowissenschaft',
            entry: ` Nenne kurz, welche geologischen Merkmale du an "${objectName}" prüfst (z.B. Erosion, Bruchkanten, Hangstabilitaet, Sedimente).`,
            progress: ` Gib einen kurzen geologischen Zwischenstand zu "${objectName}" (stabil, Erosionsspuren, Verdachtsstelle).`,
            result: ` Schließe mit einem geologischen Kurzfazit zu "${objectName}" ab und nenne ggf. Bedarf fuer Nachmessung.`
        };
    }
    if (taskDomain === 'science_general') {
        return {
            field: 'Forschung',
            entry: ` Nenne kurz, welche Mess-/Beobachtungsaufgabe du an "${objectName}" durchführst.`,
            progress: ` Gib einen knappen fachlichen Zwischenstand (Datenguete, erste Beobachtung, offene Punkte).`,
            result: ` Schließe mit einem knappen fachlichen Ergebnis und dem naechsten sinnvollen Schritt ab.`
        };
    }

    if (/(biolog|oekolog|ökolog|ornitholog|umwelt|naturwacht|naturschutz)/.test(role + ' ' + story)) {
        return {
            field: 'Biologie',
            entry: ` Nenne kurz, welche Arten/Indikatoren du an "${objectName}" beobachtest (z.B. Vogelkolonien, Ufervegetation, Stoerfaktoren).`,
            progress: ` Gib einen kurzen biologischen Zwischenstand zu "${objectName}" (Bestand, Aktivitaet, Auffaelligkeiten).`,
            result: ` Schließe mit einem biologischen Kurzfazit zu "${objectName}" ab (z.B. unauffaellig, Belastungshinweis, weiterer Beobachtungsbedarf).`
        };
    }
    if (/\b(geolog|geomorph|hydrolog|vulkanolog|gestein|erosion|rutsch|hangstabil|sediment|bodenfeuchte|bodenprofil|bodenprobe)\b/.test(role + ' ' + story)) {
        return {
            field: 'Geowissenschaft',
            entry: ` Nenne kurz, welche geologischen Merkmale du an "${objectName}" prüfst (z.B. Erosion, Bruchkanten, Hangstabilitaet, Sedimente).`,
            progress: ` Gib einen kurzen geologischen Zwischenstand zu "${objectName}" (stabil, Erosionsspuren, Verdachtsstelle).`,
            result: ` Schließe mit einem geologischen Kurzfazit zu "${objectName}" ab und nenne ggf. Bedarf fuer Nachmessung.`
        };
    }
    if (/(wissenschaft|forschung|forscher|analyst|kartograf|vermess|meteorolog|limnolog)/.test(role + ' ' + story)) {
        return {
            field: 'Forschung',
            entry: ` Nenne kurz, welche Mess-/Beobachtungsaufgabe du an "${objectName}" durchführst.`,
            progress: ` Gib einen knappen fachlichen Zwischenstand (Datenguete, erste Beobachtung, offene Punkte).`,
            result: ` Schließe mit einem knappen fachlichen Ergebnis und dem naechsten sinnvollen Schritt ab.`
        };
    }
    return null;
}

function _professionalTaskHint(mode = 'entry') {
    const meta = _professionalRoleMeta();
    if (!meta) return '';
    if (mode === 'progress') return meta.progress || '';
    if (mode === 'result') return meta.result || '';
    return meta.entry || '';
}

function _professionalLandingToneHint() {
    const meta = _professionalRoleMeta();
    if (!meta) return '';
    return ' Ton bei Landung: sachlich, knapp und dankend. Kein Show-/Sightseeing-Ton.';
}

function _domainDriftGuard(mode = 'generic') {
    const td = _activeTaskDomain();
    const m = String(mode || 'generic').toLowerCase();
    if (td === 'science_bio') {
        if (m === 'result') return ' Drift-Guard (Bio): Abschluss nur als biologisches/ökologisches Fazit (Arten, Vegetation, Habitat, Stoerfaktoren). Keine Geologie-, Inspektions- oder Einsatzsprache.';
        if (m === 'progress') return ' Drift-Guard (Bio): Bleib bei biologischer Beobachtung und Datenguete. Keine Technikpruefung, keine SAR-/Feuerlage.';
        return ' Drift-Guard (Bio): Nur Bio/Umwelt-Inhalte (Flora/Fauna/Habitat/Ufervegetation). Keine Risse/Statik/Schadenssuche, keine Geologie, kein SAR-/Feuer-Ton.';
    }
    if (td === 'science_geo') {
        if (m === 'result') return ' Drift-Guard (Geo): Abschluss nur als geologisches/geomorphologisches Fazit (Relief, Erosion, Hangstabilitaet, Sedimente). Keine Bio- oder Einsatzsprache.';
        if (m === 'progress') return ' Drift-Guard (Geo): Bleib bei Relief/Erosion/Hangbeobachtung und Datenguete. Keine Arten-/Vegetationsanalyse, kein Medien-/Einsatz-Ton.';
        return ' Drift-Guard (Geo): Nur geologische/geomorphologische Einordnung. Keine Arten-/Uferbiologie, keine Technikinspektion, kein SAR-/Feuer-Ton.';
    }
    if (td === 'mapping_survey') {
        if (m === 'result') return ' Drift-Guard (Survey): Abschluss mit Datenguete und naechstem Vermessungsschritt. Keine Story-, Historiker- oder Sightseeing-Formulierungen.';
        if (m === 'progress') return ' Drift-Guard (Survey): Nur Messlogik, Linienfuehrung, Stabilitaet und Datenqualitaet. Keine Ortsanekdoten.';
        return ' Drift-Guard (Survey): Nur technisch-praezise Vermessungs-/Dokumentationssprache. Keine Begeisterungs- oder Tourismusformeln, keine Inspektionsdramatik.';
    }
    if (td === 'poi_learning_guide') {
        if (m === 'result') return ' Drift-Guard (Lern-Guide): Abschluss mit 1-2 klaren Fakten/Einordnung und einem ruhigen Weiterflug-Hinweis. Keine Arbeitsanweisung, keine Einsatz-/Inspektionssprache.';
        if (m === 'progress') return ' Drift-Guard (Lern-Guide): Nur Fakten, Kontext und Orientierung zum Ziel. Keine Checklisten, keine Mess-/Schadenssprache.';
        return ' Drift-Guard (Lern-Guide): Bildungsorientiert und anschaulich. Keine Instruktoranweisungen, keine feste Arbeitshoehe verlangen, kein SAR-/Fire-/Inspektions-Ton.';
    }
    if (td === 'news_coverage') {
        if (m === 'result') return ' Drift-Guard (News): Abschluss als kurze sachliche Lagezusammenfassung. Kein Einsatzabschluss wie SAR, kein Touri-Ton.';
        if (m === 'progress') return ' Drift-Guard (News): Nenne nur beobachtbare Fakten/Lagepunkte. Keine technische Schadensbewertung.';
        return ' Drift-Guard (News): Nuechtern und beobachtend, faktenbasiert. Keine Sightseeing-Sprache, keine Fachinspektion, keine Rollenmischung mit SAR/Fire.';
    }
    return '';
}

function _targetFactHint() {
    const td = _activeTaskDomain();
    if (/^(search_and_rescue|fire_watch|mapping_survey|news_coverage)$/.test(td)) return '';
    if (_activeAptTrainingPlan()) return '';
    const raw = document.getElementById('wikiDestDescText')?.innerText?.trim() || '';
    if (!raw) return '';
    if (/warte auf daten|lade ziel-info|nicht geladen|keine regionalen/i.test(raw)) return '';
    const cleaned = raw.replace(/\s+/g, ' ').trim();
    // Filter internal/source status text so it never leaks into spoken prompts.
    if (/(wikipedia|wiki-daten|fetch-fehler)/i.test(cleaned)) return '';
    if (/(konnte(n)?\s+nicht|nicht\s+abrufbar|nicht\s+geladen|fehler)/i.test(cleaned)) return '';
    const firstSentence = cleaned.split(/[.!?]/).map(s => s.trim()).filter(Boolean)[0] || '';
    if (!firstSentence || firstSentence.length < 28) return '';
    const clip = firstSentence.length > 180 ? `${firstSentence.slice(0, 177)}...` : firstSentence;
    return ` Sachlicher Ziel-Fakt (wenn passend kurz einbauen): ${clip}.`;
}

function _activeAptTrainingPlan() {
    const pax = window.activePassenger || null;
    if (!pax || typeof pax !== 'object') return null;
    const plan = pax.trainingPlan;
    if (!plan || typeof plan !== 'object') return null;
    const modeRaw = String(plan.mode || '').toLowerCase();
    const triggerRaw = String(plan.trigger || '').toLowerCase();
    const mode = (modeRaw === 'airwork' || modeRaw === 'pattern') ? modeRaw : null;
    const trigger = (triggerRaw === 'half_route' || triggerRaw === 'five_nm_before_landing') ? triggerRaw : null;
    if (!mode || !trigger) return null;
    const focus = Array.isArray(plan.focus)
        ? plan.focus.map(x => String(x || '').trim()).filter(Boolean).slice(0, 5)
        : [];
    const instructorLine = String(plan.instructorLine || '').trim();
    return { mode, trigger, focus, instructorLine };
}

// ─── UI ──────────────────────────────────────────────────────────────────────
let _paxPanel = null;
let _paxBtn   = null;
let _lastPaxText = '';
const _AIRPORT_AT_TARGET_NM = 4.0;
const _PAX_WIDGET_POS_KEY = 'ga_pax_widget_pos';

function _isMapTableOpen() {
    const board = document.getElementById('mapTableOverlay');
    return !!(board && board.classList.contains('active'));
}

function _syncPaxWidgetHost() {
    const widget = document.getElementById('paxVoiceWidget');
    if (!widget) return;
    const mapOverlay = document.getElementById('mapTableOverlay');
    const useMapOverlay = !!(document.body.classList.contains('maptable-open') && mapOverlay && mapOverlay.classList.contains('active'));
    const host = useMapOverlay ? mapOverlay : document.body;
    if (widget.parentElement !== host) host.appendChild(widget);
}

function _refreshPaxWidgetVisibility() {
    const widget = document.getElementById('paxVoiceWidget');
    if (!widget) return;
    _syncPaxWidgetHost();
    const shouldShow = !!_lastPaxText;
    widget.style.display = shouldShow ? 'flex' : 'none';
    if (shouldShow) _ensurePaxWidgetOnScreen(true);
}

function _injectPaxUI() {
    if (document.getElementById('paxVoiceWidget')) return;

    const widget = document.createElement('div');
    widget.id = 'paxVoiceWidget';
    widget.style.cssText = `
        position: fixed; bottom: 72px; right: 14px; z-index: 50000;
        display: none; flex-direction: column; align-items: flex-end; gap: 8px;
    `;

    // Indicator button
    const btn = document.createElement('button');
    btn.id = 'paxVoiceBtn';
    btn.title = 'Passagier-Nachricht';
    const isMobile = window.innerWidth <= 767;
    const btnSize = isMobile ? 52 : 40;
    btn.style.cssText = `
        width: ${btnSize}px; height: ${btnSize}px; border-radius: 50%; border: none;
        background: #1a3a5c; color: #fff; font-size: ${isMobile ? 22 : 18}px; cursor: pointer;
        box-shadow: 0 2px 10px rgba(0,0,0,0.5); transition: transform 0.15s;
        display: flex; align-items: center; justify-content: center;
        position: relative;
        touch-action: none; user-select: none; -webkit-user-select: none;
    `;
    btn.innerHTML = '🧑‍✈️';
    // click handled by _initPaxWidgetDrag (drag-aware)

    // New-message badge
    const badge = document.createElement('span');
    badge.id = 'paxVoiceBadge';
    badge.style.cssText = `
        position: absolute; top: -3px; right: -3px; width: 11px; height: 11px;
        background: #4da6ff; border-radius: 50%; display: none;
        border: 2px solid #111;
    `;
    btn.appendChild(badge);

    // Message panel
    const panel = document.createElement('div');
    panel.id = 'paxVoicePanel';
    panel.style.cssText = `
        display: none; background: #0e1e30; border: 1px solid #2a4a6a;
        border-radius: 10px; padding: 12px 14px; max-width: 280px; min-width: 200px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.6); font-size: 13px; line-height: 1.5;
        color: #d0e8ff; position: relative;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
        position: absolute; top: 6px; right: 8px; background: none; border: none;
        color: #888; cursor: pointer; font-size: 12px; padding: 0;
    `;
    closeBtn.onclick = () => _closePaxPanel();

    const nameEl = document.createElement('div');
    nameEl.id = 'paxVoiceName';
    nameEl.style.cssText = 'font-size: 11px; color: #4da6ff; margin-bottom: 6px; font-weight: bold;';

    const textEl = document.createElement('div');
    textEl.id = 'paxVoiceText';

    panel.appendChild(closeBtn);
    panel.appendChild(nameEl);
    panel.appendChild(textEl);

    widget.appendChild(panel);
    widget.appendChild(btn);
    document.body.appendChild(widget);

    _paxPanel = panel;
    _paxBtn   = btn;

    _initPaxWidgetDrag(widget, btn);
    window.addEventListener('resize', _ensurePaxWidgetOnScreen);
    window.addEventListener('orientationchange', _ensurePaxWidgetOnScreen);
    const classObserver = new MutationObserver(() => _syncPaxWidgetHost());
    classObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

function _initPaxWidgetDrag(widget, btn) {
    function applyPos(top, left) {
        widget.style.top    = top + 'px';
        widget.style.left   = left + 'px';
        widget.style.bottom = 'auto';
        widget.style.right  = 'auto';
    }

    const saved = localStorage.getItem(_PAX_WIDGET_POS_KEY);
    if (saved) {
        try {
            const { top, left } = JSON.parse(saved);
            widget.style.top    = top;
            widget.style.left   = left;
            widget.style.bottom = 'auto';
            widget.style.right  = 'auto';
        } catch(e) {}
    }
    requestAnimationFrame(() => _ensurePaxWidgetOnScreen(true));

    let _dragging = false, _startX, _startY, _startLeft, _startTop;
    let _ignoreClickUntil = 0;

    btn.addEventListener('pointerdown', e => {
        if (!_isMapTableOpen()) return;
        const rect = widget.getBoundingClientRect();
        e.preventDefault();
        _startX    = e.clientX;
        _startY    = e.clientY;
        _startLeft = rect.left;
        _startTop  = rect.top;
        _dragging  = false;
        btn.setPointerCapture(e.pointerId);
    }, { passive: false });

    btn.addEventListener('pointermove', e => {
        if (!btn.hasPointerCapture(e.pointerId)) return;
        e.preventDefault();
        const dx = e.clientX - _startX;
        const dy = e.clientY - _startY;
        if (!_dragging && Math.sqrt(dx * dx + dy * dy) < 3) return;
        _dragging = true;
        const w = btn.offsetWidth  || 48;
        const h = btn.offsetHeight || 48;
        applyPos(
            Math.max(8, Math.min(window.innerHeight - h - 8, _startTop  + dy)),
            Math.max(8, Math.min(window.innerWidth  - w - 8, _startLeft + dx))
        );
    });

    const onPointerDone = (e) => {
        if (btn.hasPointerCapture(e.pointerId)) btn.releasePointerCapture(e.pointerId);
        if (_dragging) {
            localStorage.setItem(_PAX_WIDGET_POS_KEY, JSON.stringify({ top: widget.style.top, left: widget.style.left }));
            _dragging = false;
            _ignoreClickUntil = Date.now() + 250;
            e.stopImmediatePropagation();
        }
    };
    btn.addEventListener('pointerup', onPointerDone);
    btn.addEventListener('pointercancel', onPointerDone);

    // Override click to ignore drag-end
    btn.addEventListener('click', e => {
        if (_dragging || Date.now() < _ignoreClickUntil) { e.stopImmediatePropagation(); return; }
        _togglePaxPanel();
    }, true);
}

function _ensurePaxWidgetOnScreen(persist = false) {
    const widget = document.getElementById('paxVoiceWidget');
    const panel = document.getElementById('paxVoicePanel');
    const btn = document.getElementById('paxVoiceBtn');
    if (!widget || !btn) return;

    const rect = widget.getBoundingClientRect();
    const margin = 8;
    const panelOpen = !!panel && panel.style.display !== 'none';
    const btnW = btn.offsetWidth || 48;
    const btnH = btn.offsetHeight || 48;
    const reqW = panelOpen ? Math.max(panel.offsetWidth || 280, btnW) : btnW;
    const reqH = panelOpen ? (btnH + 8 + (panel.offsetHeight || 0)) : btnH;

    const maxLeft = Math.max(margin, window.innerWidth - reqW - margin);
    const maxTop = Math.max(margin, window.innerHeight - reqH - margin);
    const left = Math.max(margin, Math.min(rect.left, maxLeft));
    const top = Math.max(margin, Math.min(rect.top, maxTop));

    widget.style.top = top + 'px';
    widget.style.left = left + 'px';
    widget.style.bottom = 'auto';
    widget.style.right = 'auto';
    if (persist) {
        localStorage.setItem(_PAX_WIDGET_POS_KEY, JSON.stringify({ top: widget.style.top, left: widget.style.left }));
    }
}

function _showPaxMessage(text, eventLabel) {
    const widget = document.getElementById('paxVoiceWidget');
    const panel  = document.getElementById('paxVoicePanel');
    const nameEl = document.getElementById('paxVoiceName');
    const textEl = document.getElementById('paxVoiceText');
    const badge  = document.getElementById('paxVoiceBadge');
    const btn    = document.getElementById('paxVoiceBtn');

    if (!widget) return;
    _lastPaxText = text;

    const pax = window.activePassenger;
    if (nameEl) nameEl.textContent = pax ? `${pax.name} · ${eventLabel}` : eventLabel;
    if (textEl) textEl.textContent = text;

    widget.style.display = 'flex';
    _ensurePaxWidgetOnScreen(true);

    // Auto-open panel only in text-only mode (voice off)
    if (panel && !_paxVoiceEnabled) {
        panel.style.display = 'block';
        _ensurePaxWidgetOnScreen();
    }
    if (badge) badge.style.display = 'block';
    if (btn) {
        btn.classList.add('pax-has-new');
        btn.style.transform = 'scale(1.15)';
        setTimeout(() => { if (btn) btn.style.transform = 'scale(1)'; }, 300);
    }

    // Auto-close panel after 18 seconds
    clearTimeout(widget._autoClose);
    widget._autoClose = setTimeout(_closePaxPanel, 18000);
}

window.paxVoiceRefreshWidget = function() {
    _refreshPaxWidgetVisibility();
};

function _togglePaxPanel() {
    const panel = document.getElementById('paxVoicePanel');
    const badge = document.getElementById('paxVoiceBadge');
    const btn   = document.getElementById('paxVoiceBtn');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        _ensurePaxWidgetOnScreen();
        if (badge) badge.style.display = 'none';
        if (btn) btn.classList.remove('pax-has-new');
    }
}

function _closePaxPanel() {
    const panel = document.getElementById('paxVoicePanel');
    const badge = document.getElementById('paxVoiceBadge');
    const btn   = document.getElementById('paxVoiceBtn');
    if (panel) panel.style.display = 'none';
    if (badge) badge.style.display = 'none';
    if (btn) btn.classList.remove('pax-has-new');
}

// ─── TWO-STEP PIPELINE ───────────────────────────────────────────────────────

async function _generateSpokenText(apiKey, situationPrompt) {
    const payload = {
        contents: [{ parts: [{ text: situationPrompt }] }],
        generationConfig: {
            response_mime_type: 'text/plain',
            temperature: 0.95,
            topP: 0.9
        }
    };
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };

    for (const model of ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']) {
        try {
            _paxLog(`Textgen → ${model}`, 'send');
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                opts
            );
            if (!res.ok) {
                _paxLog(`Textgen ${model} HTTP ${res.status}`, 'warn');
                continue;
            }
            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (text) {
                if (typeof incrementApiUsage === 'function') incrementApiUsage('flash');
                _paxLog(`Textgen OK (${text.length} Zeichen): "${text}"`, 'recv');
                return text;
            }
            _paxLog(`Textgen ${model} leere Antwort: ${JSON.stringify(data).slice(0, 120)}`, 'warn');
        } catch(e) { _paxLog(`Textgen ${model} Fehler: ${e.message}`, 'warn'); }
    }
    return null;
}

function _pcmToWav(pcmBuffer, sampleRate, numChannels, bitDepth) {
    const wav = new ArrayBuffer(44 + pcmBuffer.byteLength);
    const v   = new DataView(wav);
    const str = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
    const bps = sampleRate * numChannels * (bitDepth / 8);
    str(0,  'RIFF'); v.setUint32(4,  36 + pcmBuffer.byteLength, true);
    str(8,  'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);                         // PCM
    v.setUint16(22, numChannels, true);
    v.setUint32(24, sampleRate, true);
    v.setUint32(28, bps, true);
    v.setUint16(32, numChannels * (bitDepth / 8), true);
    v.setUint16(34, bitDepth, true);
    str(36, 'data'); v.setUint32(40, pcmBuffer.byteLength, true);
    new Uint8Array(wav, 44).set(new Uint8Array(pcmBuffer));
    return wav;
}

function _buildIntercomChain(ctx, destination, durationSec) {
    // Bandpass: 300 Hz – 3 400 Hz (telephone/intercom range)
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 300; hp.Q.value = 0.7;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 3400; lp.Q.value = 0.8;

    // Soft saturation — WaveShaper
    const ws = ctx.createWaveShaper();
    const curve = new Float32Array(512);
    const amt = 30;
    for (let i = 0; i < 512; i++) {
        const x = (i * 2) / 512 - 1;
        curve[i] = (Math.PI + amt) * x / (Math.PI + amt * Math.abs(x));
    }
    ws.curve = curve; ws.oversample = '2x';

    // Compressor — limits dynamic range like a real intercom
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 6;
    comp.ratio.value = 8; comp.attack.value = 0.003; comp.release.value = 0.15;

    // Static noise layer
    const noiseLen = Math.ceil(ctx.sampleRate * (durationSec + 0.5));
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) nd[i] = (Math.random() * 2 - 1) * 0.018;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.4;

    // Chain: hp → lp → ws → comp → destination
    hp.connect(lp); lp.connect(ws); ws.connect(comp); comp.connect(destination);
    // Noise goes through the same bandpass so it sounds like intercom hiss
    noise.connect(hp);
    noise.connect(noiseGain); noiseGain.connect(destination);

    return { input: hp, noise };
}

function _normalizeSpokenText(text) {
    if (!text) return text;
    return String(text)
        .replace(/[–—]+/g, ', ')
        .replace(/\s*;\s*/g, ', ')
        .replace(/\.{3,}/g, '. ')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+([,.!?])/g, '$1')
        .trim();
}

async function _paxDecodeAndPlay(base64Audio, mimeType) {
    const ctx = window._tawsAudioCtx;
    if (!ctx) { _paxLog('AudioContext nicht verfügbar', 'warn'); return; }
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

    const binary = atob(base64Audio);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    let audioBuffer = bytes.buffer;
    const mimeLower = String(mimeType || '').toLowerCase();
    if (!mimeType || mimeLower.includes('pcm') || mimeLower.includes('l16')) {
        const rateMatch = mimeType?.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
        _paxLog(`PCM→WAV wrap | rate: ${sampleRate} Hz | mime: ${mimeType || 'unbekannt'}`, 'audio');
        audioBuffer = _pcmToWav(bytes.buffer, sampleRate, 1, 16);
    }

    try {
        const buf = await ctx.decodeAudioData(audioBuffer);
        const dest = window._awmMasterGain || ctx.destination;
        const { input, noise } = _buildIntercomChain(ctx, dest, buf.duration);

        await new Promise(resolve => {
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(input);
            let done = false;
            const finish = () => {
                if (done) return;
                done = true;
                try { src.onended = null; } catch (_) {}
                try { src.disconnect(); } catch (_) {}
                try { noise.disconnect(); } catch (_) {}
                resolve();
            };
            src.onended = () => finish();
            src.onerror = () => finish();

            const t = ctx.currentTime + 0.1;
            const watchdogMs = Math.max(6000, Math.round((buf.duration + 2.5) * 1000));
            const watchdog = setTimeout(() => {
                _paxLog(`Playback Watchdog: onended ausgeblieben nach ${watchdogMs} ms — Queue wird freigegeben`, 'warn');
                finish();
            }, watchdogMs);
            const guardedFinish = () => {
                clearTimeout(watchdog);
                finish();
            };
            src.onended = guardedFinish;
            src.onerror = guardedFinish;

            try {
                src.start(t);
                noise.start(t);
                noise.stop(t + buf.duration + 0.3);
                _paxLog(`Intercom-Wiedergabe: ${buf.duration.toFixed(1)} s`, 'audio');
            } catch (startErr) {
                _paxLog(`Playback Startfehler: ${startErr?.message || startErr}`, 'warn');
                guardedFinish();
            }
        });
    } catch(e) {
        _paxLog(`Playback Fehler: ${e.message}`, 'warn');
    }
}

const _PAX_TTS_VOICE_POOL = {
    // "Fenrir" klingt in der Praxis teils uneindeutig; daher nicht mehr in der
    // primären male-Reihe, um Gender-Mismatch-Eindruck zu reduzieren.
    male: ['Charon', 'Puck'],
    female: ['Kore', 'Leda', 'Aoede']
};

function _normSpeakerGender(pax) {
    const raw = String(pax?.gender || '').trim().toLowerCase();
    if (/^(male|m|mann|maennlich|männlich)$/.test(raw)) return 'male';
    if (/^(female|f|frau|weiblich)$/.test(raw)) return 'female';
    // Kein Guessing aus Name/Rolle: nur explizites gender-Feld verwenden.
    return 'female';
}

function _normalizeActivePassengerGender() {
    if (!window.activePassenger || typeof window.activePassenger !== 'object') return;
    const before = String(window.activePassenger.gender || '').trim();
    const normalized = _normSpeakerGender(window.activePassenger);
    window.activePassenger.gender = normalized;
    if (before.toLowerCase() !== normalized) {
        _paxLog(`Gender normalisiert: "${before || 'n/a'}" -> "${normalized}"`, 'state');
    }
    try { localStorage.setItem('ga_active_passenger', JSON.stringify(window.activePassenger)); } catch (_) {}
}

function _hashStable(text) {
    const s = String(text || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h >>> 0);
}

function _ttsVoiceCandidatesForSpeaker(pax) {
    const gender = _normSpeakerGender(pax);
    const basePool = Array.isArray(_PAX_TTS_VOICE_POOL[gender]) ? _PAX_TTS_VOICE_POOL[gender].slice() : (gender === 'male' ? ['Charon'] : ['Kore']);
    const fallback = gender === 'male' ? 'Charon' : 'Kore';
    if (!basePool.includes(fallback)) basePool.push(fallback);

    const seed = `${pax?.name || ''}|${pax?.role || ''}|${pax?.roleProfile || ''}|${pax?.taskDomain || ''}`;
    const start = basePool.length ? (_hashStable(seed) % basePool.length) : 0;
    const rotated = basePool.map((_, idx) => basePool[(start + idx) % basePool.length]);
    const dedup = [];
    const seen = new Set();
    for (const v of rotated) {
        const n = String(v || '').trim();
        if (!n || seen.has(n)) continue;
        seen.add(n);
        dedup.push(n);
    }
    if (!dedup.includes(fallback)) dedup.push(fallback);
    return dedup;
}

function _roleConsistencyDebugEnabled() {
    return localStorage.getItem('awm_role_consistency_debug') === '1';
}

window.paxVoiceSetRoleConsistencyDebug = function(on) {
    const enabled = !!on;
    localStorage.setItem('awm_role_consistency_debug', enabled ? '1' : '0');
    _paxLog(`Role-Consistency Debug: ${enabled ? 'EIN' : 'AUS'}`, 'state');
};

function _logRoleConsistencyCheck(eventLabel) {
    if (!_roleConsistencyDebugEnabled()) return;
    const pax = window.activePassenger || {};
    const contract = (typeof window !== 'undefined' ? (window.activeMissionContract || null) : null)
        || (() => { try { return JSON.parse(localStorage.getItem('ga_active_mission_contract') || 'null'); } catch (_) { return null; } })();

    const rp = String(pax.roleProfile || '').toLowerCase().trim();
    const td = String(pax.taskDomain || '').toLowerCase().trim();
    const cRp = String(contract?.roleProfile || '').toLowerCase().trim();
    const cTd = String(contract?.taskDomain || '').toLowerCase().trim();
    const cUrg = String(contract?.urgencyPriority || '').toLowerCase().trim();
    const urg = String(pax.urgencyPriority || '').toLowerCase().trim();

    const issues = [];
    if (!pax?.name || !pax?.role) issues.push('Passagierprofil unvollständig (name/role fehlt)');
    if (!rp || !td) issues.push('roleProfile/taskDomain am Passenger fehlt');
    if (cRp && rp && cRp !== rp) issues.push(`roleProfile-Mismatch passenger=${rp} contract=${cRp}`);
    if (cTd && td && cTd !== td) issues.push(`taskDomain-Mismatch passenger=${td} contract=${cTd}`);
    if (cUrg && urg && cUrg !== urg) issues.push(`urgency-Mismatch passenger=${urg} contract=${cUrg}`);
    if (td === 'training' && rp !== 'instructor_calm_precise_v1') issues.push(`training ohne instructor-roleProfile (${rp || 'n/a'})`);

    if (issues.length) {
        _paxLog(`[RoleCheck:${eventLabel}] WARN | ${issues.join(' | ')}`, 'warn');
    } else {
        _paxLog(`[RoleCheck:${eventLabel}] OK | roleProfile=${rp || 'n/a'} | taskDomain=${td || 'n/a'} | urgency=${urg || 'n/a'}`, 'state');
    }
}

async function _playTextAsTTS(text, speaker = null) {
    const apiKey = _getApiKey();
    if (!apiKey) { _paxLog('Kein API-Key für TTS', 'warn'); return; }
    const pax = speaker || window.activePassenger || _lastSpokenSpeaker || null;
    const resolvedGender = _normSpeakerGender(pax);
    const voiceCandidates = _ttsVoiceCandidatesForSpeaker(pax);
    _paxLog(`TTS Stimmen: ${voiceCandidates.join(' -> ')} | Persona: ${pax?.name || 'unbekannt'} | Gender: ${resolvedGender} (raw: ${String(pax?.gender || 'n/a')})`, 'state');
    const ttsModels = ['gemini-2.5-flash-preview-tts'];
    _paxLog(`TTS-Modelle: ${ttsModels.join(' -> ')} | Modus: ${_paxTtsModelPref}`, 'state');

    let lastErr = null;
    for (const model of ttsModels) {
        for (const voiceName of voiceCandidates) {
            const ttsPayload = {
                contents: [{ role: 'user', parts: [{ text }] }],
                generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
                }
            };
            try {
                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ttsPayload) }
                );
                if (!res.ok) {
                    const errBody = await res.text().catch(() => '(unlesbar)');
                    _paxLog(`TTS ${model}/${voiceName} HTTP ${res.status}: ${errBody.slice(0, 220)}`, 'warn');
                    lastErr = new Error(`TTS ${model}/${voiceName} HTTP ${res.status}`);
                    continue;
                }
                const data     = await res.json();
                const part     = data?.candidates?.[0]?.content?.parts?.[0];
                const b64      = part?.inlineData?.data;
                const mimeType = part?.inlineData?.mimeType || '';
                if (!b64) {
                    _paxLog(`TTS ${model}/${voiceName} ohne Audio-Daten`, 'warn');
                    lastErr = new Error(`TTS ${model}/${voiceName}: Keine Audio-Daten`);
                    continue;
                }
                _paxLog(`TTS Stimme aktiv: ${voiceName}`, 'state');
                _paxLog(`TTS OK (${model}) | mime: ${mimeType} | ${b64.length} chars base64`, 'recv');
                if (typeof incrementApiUsage === 'function') incrementApiUsage('flash');
                await _paxDecodeAndPlay(b64, mimeType);
                return;
            } catch(e) {
                lastErr = e;
                _paxLog(`TTS ${model}/${voiceName} Fehler: ${e.message}`, 'warn');
            }
        }
    }
    if (lastErr) {
        _paxLog(`TTS Fehler: ${lastErr.message}`, 'warn');
    }
}

async function _speakAndShowNow(situationPrompt, eventLabel) {
    const apiKey = _getApiKey();
    if (!apiKey) { _paxLog('Kein API-Key', 'warn'); return; }
    const pax = window.activePassenger || null;
    const speakerSnapshot = pax ? {
        name: pax.name || '',
        role: pax.role || '',
        gender: pax.gender || '',
        roleProfile: pax.roleProfile || '',
        taskDomain: pax.taskDomain || ''
    } : null;

    _paxLog(`── ${eventLabel} ──`, 'event');
    _logRoleConsistencyCheck(eventLabel);
    _paxLog(`PROMPT (voll): ${situationPrompt.replace(/\n+/g, ' ')}`, 'send');
    const spokenTextRaw = await _generateSpokenText(apiKey, situationPrompt);
    const spokenText = _injectPattonvilleJuliusEasteregg(
        _injectPattonvilleReportingPointsHint(
            _normalizeSpokenText(spokenTextRaw),
            eventLabel
        ),
        eventLabel
    );
    if (!spokenText) { _paxLog('Kein Text von Gemini (API-Fehler oder leere Antwort)', 'warn'); return; }

    _lastSpokenText = spokenText;
    _lastSpokenSpeaker = speakerSnapshot;
    _capturePoiNarrativeMemory(eventLabel, spokenText);
    _showPaxMessage(spokenText, eventLabel);

    if (!_paxVoiceEnabled) {
        _paxLog('TTS übersprungen (Stimme deaktiviert) — Text gespeichert', 'state');
        return;
    }
    await _playTextAsTTS(spokenText, speakerSnapshot);
}

function _speakAndShow(situationPrompt, eventLabel) {
    _paxLog(`Queue +1 | Event: ${eventLabel}`, 'state');
    const run = async () => {
        _paxLog(`Queue ▶ Start | Event: ${eventLabel}`, 'state');
        try {
            await _speakAndShowNow(situationPrompt, eventLabel);
        } catch (e) {
            _paxLog(`Speech-Queue Fehler: ${e.message || e}`, 'warn');
        } finally {
            _paxLog(`Queue ✓ Ende | Event: ${eventLabel}`, 'state');
        }
    };
    _paxSpeechQueue = _paxSpeechQueue.then(run, run);
    return _paxSpeechQueue;
}

// ─── PROMPT BUILDERS ─────────────────────────────────────────────────────────

function _normUrgencyPriority(v) {
    const s = String(v || '').trim().toLowerCase();
    return s === 'hoch' ? 'hoch' : 'niedrig';
}

function _baseContext() {
    const pax  = window.activePassenger;
    const md   = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    const story = _getMissionStory();
    if (!pax || !md) return null;

    const cargo = document.getElementById('mWeight')?.innerText?.trim() || '';
    const payload = document.getElementById('mPay')?.innerText?.trim() || '';
    const roleStyle = _roleStyleHint(pax.role, pax);
    const urgency = _normUrgencyPriority(pax?.urgencyPriority);
    const urgencyLine = urgency === 'hoch'
        ? 'ZEITRAHMEN: Zeitkritisch, Zeitdruck darf kurz genannt werden.'
        : 'ZEITRAHMEN: Niedrige Prioritaet, keine Eile-Kommunikation.';

    const trainingPlan = _activeAptTrainingPlan();
    let contract = md?.missionContract || window.activeMissionContract || null;
    if (!contract) {
        try { contract = JSON.parse(localStorage.getItem('ga_active_mission_contract') || 'null'); } catch (_) { contract = null; }
    }
    const storyShort = String(story || '').trim().replace(/\s+/g, ' ').slice(0, 260);
    const trainingDiscipline = trainingPlan
        ? `TRAINING (${trainingPlan.mode}): Nur fliegerische Inhalte, prozedural, sicherheitsfokussiert. Kein Sightseeing/Ortsstory.`
        : '';
    const contractSummary = contract?.summary ? String(contract.summary).trim() : '';
    const contractRules = Array.isArray(contract?.constraints)
        ? contract.constraints.map(x => String(x || '').trim()).filter(Boolean).slice(0, 3).join(' | ')
        : '';
    const fireHazard = md?.fireHazard || null;
    const fireHazardLine = (_activeTaskDomain() === 'fire_watch' && Number.isFinite(Number(fireHazard?.level)))
        ? `FEUERLAGE (DWD): Waldbrandgefahrenindex Stufe ${Math.round(Number(fireHazard.level))} von 5 (${String(fireHazard.label || 'n/a')})${fireHazard?.dateIso ? `, Stand ${fireHazard.dateIso}` : ''}.`
        : '';
    const roleGuard = `ROLLENFIX: Sprich ausschließlich als ${pax.name} (${pax.role}) in Ich-Form. Keine Rollenvermischung.`;
    const lines = [
`ROLLE: ${pax.name} (${pax.role}) · Persönlichkeit: ${pax.personality}
FLUG: ${md.start || '?'} → ${md.poiName || md.dest || '?'} · ${md.dist || '?'} NM
LOAD: ${cargo || 'n/a'}${payload ? ` · ${payload}` : ''}
AUFTRAG (kurz): ${storyShort || 'n/a'}
STIL: ${roleStyle}
DRINGLICHKEIT: ${urgency}
${urgencyLine}`
    ];
    if (trainingDiscipline) lines.push(trainingDiscipline);
    if (contractSummary) lines.push(`MISSION-CONTRACT: ${contractSummary}`);
    if (contractRules) lines.push(`CONTRACT-REGELN: ${contractRules}`);
    if (fireHazardLine) lines.push(fireHazardLine);
    lines.push(roleGuard);
    lines.push(`TASK-DOMAIN: ${_activeTaskDomain()}
AUSGABE: Nur gesprochener Text (kein Markdown, keine Regieanweisungen, keine Anführungszeichen).`);
    return lines.join('\n');
}

function _roleStyleHint(roleRaw, pax = null) {
    const taskDomain = _activeTaskDomain();
    if (taskDomain === 'fire_watch') {
        return 'einsatznah, ruhig und präzise: Fokus auf Rauchentwicklung, Hotspots, Lagebild und klare Calls.';
    }
    if (taskDomain === 'search_and_rescue') {
        return 'klar, strukturiert und einsatzorientiert: Suchmuster, Prioritäten und sichere Durchführung.';
    }
    if (taskDomain === 'mapping_survey') {
        return 'technisch-präzise und ruhig: reproduzierbare Linien, stabile Fluglage, keine Offtopic-Kommentare.';
    }
    if (taskDomain === 'news_coverage') {
        return 'sachlich beobachtend und professionell: kurze, nüchterne Lageeinschätzung ohne Show.';
    }
    if (taskDomain === 'historian_guided_tour') {
        return 'anschaulich-historisch und bildungsorientiert: kurze, konkrete Einordnung mit Zeitbezug, keine Technik-Inspektion.';
    }
    if (taskDomain === 'poi_learning_guide') {
        return 'locker-bildend und faktenorientiert: kurze Orientierung, klare Einordnung, kein Anweisungsstil.';
    }
    if (taskDomain === 'sightseeing_tour') {
        return 'locker, freundlich und kurz: passagiernah, fluessig, ohne Anweisungs- oder Instruktor-Ton.';
    }
    if (String(pax?.roleProfile || '').toLowerCase() === 'instructor_calm_precise_v1') {
        return 'klar, ruhig und didaktisch: kurze präzise Anweisungen mit Fokus auf Sicherheit und Trainingsziel.';
    }
    const role = String(roleRaw || '').toLowerCase();
    if (/fluglehrer|instructor|instruktor|checkpilot/.test(role)) {
        return 'klar, ruhig und didaktisch: kurze präzise Anweisungen mit Fokus auf Sicherheit und Trainingsziel.';
    }
    if (/report|journal|presse|medien|film|foto/.test(role)) {
        return 'professionell beobachtend, fokussiert, leicht lebendig; keine übertriebene Touri-Euphorie bei geplanten Zielen.';
    }
    if (/ingenieur|inspekt|vermess|techn|beobachter|amt|facility|wartung|hausmeister|betrieb/.test(role)) {
        return 'sachlich-pragmatisch, präzise und faktenbasiert, mit Fokus auf Auftrag und Bedingungen; keine romantisierenden Landschaftsformulierungen.';
    }
    if (/vip|manager|anwalt|architekt|business|kunde/.test(role)) {
        return 'ruhig, souverän, wertig; kurze klare Aussagen statt Show.';
    }
    if (/flugsch|student|trainee/.test(role)) {
        return 'interessiert, lernorientiert, respektvoll und eher zurückhaltend.';
    }
    return 'natürlich, glaubwürdig und zur Rolle passend; keine überzogene Show.';
}

function _rolePrefersNeutralSpeech(roleRaw) {
    const role = String(roleRaw || '').toLowerCase();
    return /(wissenschaft|wissenschaftler|wissenschaftlerin|professor|dozent|arzt|aerzt|anwalt|richter|controller|vorstand|manager|analyst|fluglehrer|instructor|instruktor|checkpilot)/.test(role);
}

function _roleSupportsRegionalSpeech(roleRaw) {
    const role = String(roleRaw || '').toLowerCase();
    return /(techn|mechan|wartung|inspekt|ingenieur|report|journal|fotograf|flugplatz|verein|beobachter|bauer|handwerker|taxi|bus|shuttle)/.test(role);
}

function _roleDialectStrength(roleRaw) {
    const role = String(roleRaw || '').toLowerCase();
    if (_rolePrefersNeutralSpeech(role)) return 'none';
    if (_roleSupportsRegionalSpeech(role)) return 'medium';
    if (/(vip|manager|anwalt|business|kunde|berater|auditor)/.test(role)) return 'low';
    return 'low';
}

function _regionalSpeechProfileForCoords(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { region: 'Unbekannt', dialect: 'neutral' };

    // Schleswig-Holstein / Itzehoe / Nordsee-nahe
    if (lat >= 53.7 && lat <= 55.2 && lon >= 8.0 && lon <= 11.5) return { region: 'Schleswig-Holstein', dialect: 'leicht holsteinisch-norddeutsch' };
    // Hamburg
    if (lat >= 53.35 && lat <= 53.85 && lon >= 9.55 && lon <= 10.45) return { region: 'Hamburg', dialect: 'leicht hamburgisch' };
    // Niedersachsen / Bremen
    if (lat >= 52.2 && lat <= 53.9 && lon >= 7.0 && lon <= 10.4) return { region: 'Niedersachsen/Bremen', dialect: 'leicht norddeutsch' };
    // Mecklenburg-Vorpommern
    if (lat >= 53.1 && lat <= 54.7 && lon >= 10.5 && lon <= 14.7) return { region: 'Mecklenburg-Vorpommern', dialect: 'leicht nordostdeutsch' };

    // Rheinland / Ruhr / Saar
    if (lat >= 50.6 && lat <= 52.1 && lon >= 6.0 && lon <= 8.2) return { region: 'Rheinland/Ruhrgebiet', dialect: 'leicht rheinisch' };
    if (lat >= 49.0 && lat <= 50.7 && lon >= 6.0 && lon <= 8.4) return { region: 'Rheinland-Pfalz/Saar', dialect: 'leicht rheinlaendisch' };
    if (lat >= 49.6 && lat <= 50.9 && lon >= 8.0 && lon <= 9.5) return { region: 'Rhein-Main', dialect: 'leicht hessisch' };

    // Baden-Wuerttemberg
    if (lat >= 47.45 && lat <= 49.95 && lon >= 7.35 && lon <= 10.65) {
        return lon < 8.85
            ? { region: 'Baden/Schwarzwald', dialect: 'leicht badisch' }
            : { region: 'Wuerttemberg/Schwaben', dialect: 'leicht schwaebisch' };
    }

    // Bayern differenziert: Berchtesgadener Land bis Franken
    if (lat >= 47.45 && lat <= 48.25 && lon >= 12.6 && lon <= 13.5) return { region: 'Berchtesgadener Land', dialect: 'leicht oberbayerisch' };
    if (lat >= 47.2 && lat <= 48.8 && lon >= 9.4 && lon <= 11.0) return { region: 'Bayerisch-Schwaben/Allgaeu', dialect: 'leicht schwaebisch' };
    if (lat >= 47.2 && lat <= 49.2 && lon >= 11.0 && lon <= 13.8) return { region: 'Ober-/Niederbayern', dialect: 'leicht bayrisch' };
    if (lat >= 49.0 && lat <= 50.9 && lon >= 9.2 && lon <= 12.6) return { region: 'Franken', dialect: 'leicht fraenkisch' };

    // Ostdeutschland
    if (lat >= 51.3 && lat <= 53.7 && lon >= 12.0 && lon <= 14.9) return { region: 'Berlin/Brandenburg', dialect: 'leicht berlinisch-brandenburgisch' };
    if (lat >= 50.2 && lat <= 51.8 && lon >= 11.8 && lon <= 14.9) return { region: 'Sachsen', dialect: 'leicht saechsisch' };
    if (lat >= 50.4 && lat <= 51.8 && lon >= 9.8 && lon <= 12.2) return { region: 'Thueringen', dialect: 'leicht thueringisch' };

    // D-A-CH Nachbarn
    if (lat >= 46.9 && lat <= 48.1 && lon >= 9.3 && lon <= 12.3) return { region: 'Westoesterreich', dialect: 'leicht oesterreichisch' };
    if (lat >= 46.2 && lat <= 48.5 && lon >= 5.9 && lon <= 10.6) return { region: 'Schweiz', dialect: 'leicht schweizerdeutsch gefaerbt' };

    return { region: 'Mitteleuropa', dialect: 'neutral' };
}

function _contextualDialectProfile(pax) {
    if (_UNIFIED_INSTRUCTOR_BASELINE) {
        return { dialectHint: 'neutral', strengthLabel: 'neutral', regionLabel: 'Global: instructor_baseline' };
    }
    const explicit = String(pax?.dialectHint || '').trim().toLowerCase() || 'neutral';
    const role = String(pax?.role || '');
    const roleProfile = String(pax?.roleProfile || '').toLowerCase();
    if (roleProfile === 'instructor_calm_precise_v1') {
        return { dialectHint: 'neutral', strengthLabel: 'neutral', regionLabel: 'Profil: calm_precise_neutral' };
    }
    if (roleProfile === 'charter_professional_neutral_v1') {
        return { dialectHint: 'neutral', strengthLabel: 'neutral', regionLabel: 'Profil: charter_professional_neutral' };
    }
    const trainingPlan = _activeAptTrainingPlan();
    if (trainingPlan && /fluglehrer|instructor|instruktor|checkpilot/.test(role.toLowerCase())) {
        return { dialectHint: 'neutral', strengthLabel: 'neutral', regionLabel: 'Training-Instruktor neutral' };
    }
    const strength = _roleDialectStrength(role);
    if (strength === 'none') {
        return { dialectHint: 'neutral', strengthLabel: 'neutral', regionLabel: 'rollenbedingt neutral' };
    }

    const coords = _getDestCoords();
    const regional = _regionalSpeechProfileForCoords(coords?.lat, coords?.lon);

    let dialect = 'neutral';
    if (regional.dialect !== 'neutral') {
        // Region hat Vorrang, damit z.B. in Baden kein fraenkischer Klang erzwungen wird.
        dialect = regional.dialect;
    } else if (explicit && explicit !== 'neutral') {
        dialect = explicit;
    }

    if (dialect === 'neutral') {
        return { dialectHint: 'neutral', strengthLabel: 'neutral', regionLabel: regional.region || 'Unbekannt' };
    }

    const strengthLabel = strength === 'medium'
        ? 'dezent-hoerbar'
        : 'sehr dezent';
    return {
        dialectHint: dialect,
        strengthLabel,
        regionLabel: regional.region || 'Unbekannt'
    };
}

function _dialectGlobalRules(profile, roleRaw) {
    const dialect = String(profile?.dialectHint || 'neutral').toLowerCase();
    const neutralRole = _rolePrefersNeutralSpeech(roleRaw);
    const dialectLine = (neutralRole || dialect === 'neutral')
        ? 'neutral'
        : dialect;
    return `Standardaussprache immer beibehalten (kein Dialekt-Akzent, keine regionale Prosodie). Regionale Farbe nur ueber Wortwahl/Redewendungen (${dialectLine}) und ohne Regionen zu mischen. Keine dialektale Schreibweise oder Lautschrift.`;
}

function _briefingDestWeather() {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    const d = md?.weatherBriefing?.dest;
    if (!d || typeof d !== 'object') return null;
    return {
        windDeg: Number.isFinite(d.windDeg) ? Number(d.windDeg) : null,
        windKts: Number.isFinite(d.windKts) ? Number(d.windKts) : null,
        visKm: Number.isFinite(d.visKm) ? Number(d.visKm) : null
    };
}

function _consumeWeatherMismatchEasteregg(flightData) {
    if (_paxWxMismatchDone) return '';
    const brief = _briefingDestWeather();
    if (!brief || !flightData) return '';

    const liveWind = Number.isFinite(flightData.windKts) ? Number(flightData.windKts) : null;
    const liveDir  = Number.isFinite(flightData.windDeg) ? Number(flightData.windDeg) : null;
    const liveVis  = Number.isFinite(flightData.visKm) ? Number(flightData.visKm) : null;
    if (liveWind == null && liveVis == null) return '';

    let score = 0;
    if (brief.windKts != null && liveWind != null && Math.abs(brief.windKts - liveWind) >= 8) score++;
    if (brief.windDeg != null && liveDir != null) {
        const d = Math.abs(((liveDir - brief.windDeg + 540) % 360) - 180);
        if (d >= 60) score++;
    }
    if (brief.visKm != null && liveVis != null && Math.abs(brief.visKm - liveVis) >= 4) score++;
    if (score < 2) return '';

    _paxWxMismatchDone = true;
    return ' Kleiner Side-Note mit Augenzwinkern: Das Wetter fühlt sich gerade deutlich anders an als gemeldet — vielleicht hat im MSFS jemand am Wetterregler gespielt.';
}

function _poiEntryPrompt(flightData) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const md    = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    const altFt = Math.round(flightData?.mslFt || 0);
    const wx    = _weatherContext(flightData);
    const reqHint = '';
    const taskDomain = _activeTaskDomain();
    const isHistorian = taskDomain === 'historian_guided_tour';
    const isLearningGuide = taskDomain === 'poi_learning_guide';
    const inspHint = isHistorian ? '' : _inspectionEntryHint();
    const profHint = isHistorian ? '' : _professionalTaskHint('entry');
    const factHint = (taskDomain === 'search_and_rescue') ? '' : _targetFactHint();
    const driftGuard = _domainDriftGuard('entry');
    const historianHint = isHistorian
        ? ' Historiker-Rolle: Erzaehle 1 kurze historische Einordnung direkt zum Ort (Epoche, Nutzung oder lokales Ereignis). Keine Riss-/Technik-/Inspektionssprache.'
        : '';
    const learningGuideHint = isLearningGuide
        ? ' Lern-Guide-Rolle: Nenne 1-2 kurze Fakten/Einordnungen direkt zum Ziel und fuehre den Piloten ruhig zum Punkt. Keine Arbeitsanweisung, keine Hoehenforderung, kein "ich suche nach Schaeden".'
        : '';
    const sarZoneGuard = (taskDomain === 'search_and_rescue')
        ? ' Bleib strikt im Suchkorridor rund um das Zielobjekt. Keine entfernten Orts-/Gewaesserbezuege ausserhalb der Suchzone.'
        : '';
    const trainingPlan = _activeAptTrainingPlan();
    const trainingHint = trainingPlan
        ? ' Als Instruktor: bleib strikt prozedural. Fokus auf Flugweg, Maschine, Luftraum-Scan und Sicherheitsverfahren. Keine Ortsfakten, keine Geschichte, kein Schwärmen.'
        : '';
    const noRepeatHint = _poiNoRepeatHint('entry');
    return `${ctx}

Moment: Das Zielgebiet "${md?.poiName || 'Ziel'}" taucht gerade vor uns auf — wir sind auf ${altFt} ft.${wx ? ' ' + wx : ''}
${isLearningGuide ? 'Fuehre den Piloten jetzt kurz zum Ziel und gib direkt einen ersten Fakt oder Kontext zum Ort.' : 'Du siehst es zum ersten Mal aus der Luft. Zeig dem Piloten spontan was du erkennst.'}${reqHint}${inspHint}${profHint}${factHint}${historianHint}${learningGuideHint}${sarZoneGuard}${trainingHint}
${noRepeatHint}
${driftGuard}
${taskDomain === 'search_and_rescue' ? '1-2 Saetze, einsatznah und klar, keine Begeisterungsformel.' : '1-2 Sätze, darf etwas begeisterter sein als sonst.'}${_toneHint()}`;
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

function _poiInSightPrompt(flightData, distNm, etaMin, clockPos) {
    const ctx = _baseContext();
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    if (!ctx || !md) return null;
    if (_activeAptTrainingPlan()) return null;
    const taskDomain = _activeTaskDomain();
    const isHistorian = taskDomain === 'historian_guided_tour';
    const isLearningGuide = taskDomain === 'poi_learning_guide';
    const factHint = (taskDomain === 'search_and_rescue') ? '' : _targetFactHint();
    const driftGuard = _domainDriftGuard('in_sight');
    const announcedEta = 2; // bewusst knapper wegen Latenz durch Text+TTS
    const roundedDist = Math.max(0.5, Math.round(distNm * 10) / 10);
    const realEta = Math.max(1, Math.round(etaMin));
    const pax = window.activePassenger || {};
    const targetAltFt = Number(pax?.targetAltFt || 0);
    const altBrief = (!isLearningGuide && targetAltFt > 0)
        ? ` Nenne in derselben Meldung bitte kurz die geplante Arbeitsflughöhe: "${targetAltFt} Fuß".`
        : '';
    const trainingPlan = _activeAptTrainingPlan();
    const trainingHint = trainingPlan
        ? `Instruktor-Modus: Nur fliegerische Hinweise (Anflugstruktur, Luftraum-Scan, Kurs-/Höhenführung, Arbeitsverteilung im Cockpit). Landmarken nur als nüchterne Navigationsreferenz, keine Objektbeschreibung oder Ortsanekdoten.`
        : '';
    const sarZoneGuard = (taskDomain === 'search_and_rescue')
        ? ' Nur suchrelevante Referenzen in direkter Naehe des Zielobjekts nennen. Keine entfernten Orts-/Gewaesserbezuege.'
        : '';
    const historianInSightHint = isHistorian
        ? ' Historiker-Rolle: knapp historisch einordnen (z.B. Epoche/Funktion/regionale Bedeutung), ohne technische Befundsprache.'
        : '';
    const learningInSightHint = isLearningGuide
        ? ' Lern-Guide-Rolle: Sage nicht "in Sicht", sondern orientiere den Piloten ruhig zur Position und nenne direkt einen kurzen Fakt zum Ziel.'
        : '';
    const roleTone = (taskDomain === 'search_and_rescue')
        ? 'SAR-Rolle: knapp, klar, lageorientiert, kein Sightseeing-Ton. Max 2 Saetze.'
        : (isLearningGuide
            ? 'Lern-Guide: bildend und klar, ohne Anweisungsstil oder Einsatzsprache. Max 2 Saetze.'
            : (isHistorian
                ? 'Historiker-Rolle: bildungsorientiert und anschaulich, kein Technik-/Inspektionston. Max 2 Saetze.'
                : 'Techniker-/Inspektionsrollen: knapp, professionell, kein Sightseeing-Ton. Max 2 Sätze.'));
    return `${ctx}

Moment: Zielobjekt "${md.poiName || 'Ziel'}" wird im Anflug sichtbar. Distanz etwa ${roundedDist} NM, reale ETA ca. ${realEta} min, relative Lage ${clockPos}.
${isLearningGuide
        ? `Gib eine kurze Orientierung zur Lage in der 12-Uhr-Logik (${clockPos}) und nenne "ca. ${announcedEta} Minuten", dann direkt einen kurzen Fakt zum Ziel.`
        : `Sag dem Piloten kurz und sachlich, dass du das Objekt in Sicht hast, nenne die Lage in der 12-Uhr-Logik (${clockPos}) und ansage "ca. ${announcedEta} Minuten".`}${altBrief}${factHint}${sarZoneGuard}${historianInSightHint}${learningInSightHint} ${trainingHint}
${driftGuard}
${roleTone}${_toneHint()}`;
}

function _poiTrainingPreZonePrompt(flightData, distNm) {
    const ctx = _baseContext();
    const plan = _activeAptTrainingPlan();
    if (!ctx || !plan) return null;
    const wx = _weatherContext(flightData);
    const focus = plan.focus.length ? plan.focus.join(', ') : 'saubere Kurs-/Höhenführung, Luftraum-Scan und stabile Fluglage';
    const distTxt = Math.max(0.2, Number(distNm || 0)).toFixed(1);
    return `${ctx}

Moment: Wir sind noch ca. ${distTxt} NM vor dem Übungsgebiet.${wx ? ' ' + wx : ''}
Briefing für die nächste Phase: ${focus}. Gib dem Piloten jetzt eine kurze, klare Vorbereitung auf die Übung.
Keine Objektbeschreibung, kein "in Sicht", nur Verfahren/Sicherheit. Max 2 Sätze.${_toneHint()}`;
}

function _poiTrainingZoneEntryPrompt(flightData) {
    const ctx = _baseContext();
    const plan = _activeAptTrainingPlan();
    if (!ctx || !plan) return null;
    const focus = plan.focus.length ? plan.focus.join(', ') : 'Basis-Airwork';
    const lineHint = plan.instructorLine
        ? `Nutze sinngemäß diese Linie: "${plan.instructorLine}".`
        : '';
    return `${ctx}

Moment: Einflug ins Übungsgebiet. Jetzt startet die Übung.
Gib die Startanweisung für die Durchführung in 1-2 klaren Schritten (Priorität und Sicherheitsfokus). Übungen: ${focus}. ${lineHint}
Hänge kurz an: Nach Abschluss der Übung fliegen wir zurück Richtung Platz, falls Zeit bleibt mit kurzer Freiflug-Phase.
Wichtig: Keine offene Anweisung. Der letzte Satz MUSS den nächsten klaren Schritt benennen (z.B. "danach zurück auf Kurs Richtung Platz").
Ton: Instruktor-Funkstil, knapp und präzise. Max 2 Sätze.${_toneHint()}`;
}

function _trainingLandingPrepPrompt(flightData, distNm, mode, placeLabel = 'Zielflugplatz') {
    const ctx = _baseContext();
    const plan = _activeAptTrainingPlan();
    if (!ctx || !plan) return null;
    const wx = _weatherContext(flightData);
    const d = Math.max(0.2, Number(distNm || 0)).toFixed(1);
    const pattern = mode === 'pattern';
    const body = pattern
        ? `Wir sind etwa ${d} NM vor der Landung. Jetzt die Platzübung sauber anweisen und danach normal landen lassen.`
        : `Wir sind etwa ${d} NM vor der Landung. Jetzt kurze, klare Landevorbereitung geben.`;
    return `${ctx}

    Moment: Rückanflug zum ${placeLabel}.${wx ? ' ' + wx : ''}
${body} Nenne Wind/Wetter knapp und gib genau einen konkreten Tipp für den Anflug bzw. die Landung.
Ton: sachlich, instruktiv, kein Offtopic. Max 2 Sätze.${_toneHint()}`;
}

function _poiAltComplaintPrompt(flightData, altFt, targetAlt, attempt) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const diff = altFt - targetAlt;
    const dir  = diff < 0 ? `${Math.abs(Math.round(diff))} ft zu niedrig` : `${Math.round(diff)} ft zu hoch`;
    const md   = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    const isLast = attempt >= (_paxStrictMode ? 2 : 3);
    const wx = _weatherContext(flightData);
    return `${ctx}

Moment: Wir sind am Ziel "${md?.poiName || 'Ziel'}", aber die Höhe passt noch nicht.
Aktuell: ${altFt} ft (${dir} von meinen benötigten ${targetAlt} ft).${wx ? ' ' + wx : ''}${isLast ? ' Das ist mein letzter Versuch — danach müssen wir leider aufgeben.' : ''}
Bitte den Piloten freundlich aber klar, die Höhe anzupassen. 1-2 Sätze.${_toneHint()}`;
}

function _poiAltCorrectedPrompt(flightData) {
    const ctx = _baseContext();
    if (!ctx) return null;
    const pax = window.activePassenger || {};
    const altFt = Math.round(flightData?.mslFt || 0);
    const targetAlt = Math.round(Number(pax?.targetAltFt || 0));
    let altLine = `Höhe passt jetzt — wir sind auf ${altFt} ft im Zielgebiet.`;
    if (targetAlt > 0) {
        const diff = altFt - targetAlt;
        if (Math.abs(diff) <= 120) {
            altLine = `Die geplanten ${targetAlt} ft passen jetzt, ich fange mit der Beobachtung an.`;
        } else {
            altLine = `Wir sind mit ${altFt} ft jetzt im Arbeitsband um die geplanten ${targetAlt} ft, ich starte die Beobachtung.`;
        }
    }
    return `${ctx}

Moment: ${altLine} Sag dem Piloten kurz, dass es jetzt stimmt und du anfangen kannst. 1 Satz.${_toneHint()}`;
}

function _poiSatisfiedPrompt(flightData) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const dwell = Math.round(_poiDwellSec / 60 * 10) / 10;
    const wx = _weatherContext(flightData);
    const taskDomain = _activeTaskDomain();
    const isHistorian = taskDomain === 'historian_guided_tour';
    const isLearningGuide = taskDomain === 'poi_learning_guide';
    const inspResultHint = _inspectionResultHint();
    const profResultHint = _professionalTaskHint('result');
    const sarResultHint = _sarResultHint();
    const driftGuard = _domainDriftGuard('result');
    const historianResultHint = isHistorian
        ? ' Historiker-Fazit: Schließe mit 1 konkreten historischen Takeaway zum Ort (zeitliche Einordnung oder Bedeutung) und einem klaren Weiterflug-Hinweis. Keine technische Zustandsbewertung.'
        : '';
    const learningResultHint = isLearningGuide
        ? ' Lern-Guide-Fazit: Schließe mit 1 konkreten Lernpunkt zum Ziel und einem lockeren Hinweis, dass wir zum naechsten Punkt weiterkoennen.'
        : '';
    const sarEndRule = (taskDomain === 'search_and_rescue')
        ? ' Formuliere ein klares Einsatzende mit Leitstellenbezug. Kein neutraler "alles im Kasten"-Satz.'
        : '';
    const noRepeatHint = _poiNoRepeatHint('result');
    return `${ctx}

Moment: Ich bin fertig am Ziel (${dwell} Minuten).${wx ? ' ' + wx : ''}
Sag dem Piloten kurz, dass du fertig bist und wir weiterfliegen können.${sarResultHint}${inspResultHint}${profResultHint}${historianResultHint}${learningResultHint}${sarEndRule}${noRepeatHint}${driftGuard} 1-2 Sätze.${_toneHint()}`;
}

function _poiAbortPrompt(flightData) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const wx = _weatherContext(flightData);
    return `${ctx}

Moment: Trotz mehrfacher Bitte war die Höhe nicht erreichbar — ich kann unter diesen Bedingungen nicht arbeiten.${wx ? ' ' + wx : ''}
Erkläre dem Piloten verständnisvoll, dass wir die Mission abbrechen und zurückfliegen müssen. Kein Vorwurf — manchmal passt es einfach nicht. 2 Sätze.${_toneHint()}`;
}

// Shared tone instruction appended to every prompt
function _toneHint() {
    if (_UNIFIED_INSTRUCTOR_BASELINE) {
        const greetingLine = _paxGreetingDone ? 'Keine neue Begrüßung am Satzanfang.' : 'Begrüßung höchstens sehr kurz.';
        const humorLine = _paxHumorLevel === 'subtle'
            ? 'Kein Witz.'
            : _paxHumorLevel === 'bold'
                ? 'Genau eine kurze, sympathische Pointe (nur wenn nicht sicherheitskritisch).'
                : 'Humor kurz und freundlich.';
        return `
Du-Form, nie mit Namen. Ich-Form, kurze klare Sätze.
Neutral-standardsprachlich, kein Erzählerstil, kein Amtsdeutsch.
${greetingLine}
${humorLine}
Bei Sicherheit/Warnung/Arbeitsanweisung: kein Humor.
Nur Deutsch, kein Markdown.`;
    }
    const roleProfile = String(window.activePassenger?.roleProfile || '').toLowerCase();
    const isCharterNeutral = roleProfile === 'charter_professional_neutral_v1';
    const humorLine = _paxHumorLevel === 'subtle'
        ? 'Kein Witz.'
        : _paxHumorLevel === 'bold'
            ? 'Genau eine kurze, sympathische Pointe (nur wenn nicht sicherheitskritisch).'
            : 'Humor kurz und freundlich.';
    const greetingLine = _paxGreetingDone
        ? 'Keine neue Begrüßung am Satzanfang.'
        : 'Begrüßung höchstens kurz (z.B. "Hi").';
    const registerLine = isCharterNeutral
        ? 'Sprache klar und professionell.'
        : 'Sprache cockpitnah und natürlich, ohne Amtsdeutsch.';
    const colloquialLine = isCharterNeutral
        ? 'Wortwahl standardnah.'
        : 'Leichte Umgangssprache okay, normal schreiben.';
    return `
Du-Form, nie mit Namen. Ich-Form, kurze klare Sätze.
${registerLine}
${colloquialLine}
${greetingLine}
${humorLine}
Bei Sicherheit/Warnung/Arbeitsanweisung: kein Humor.
Nur Deutsch, kein Markdown.`;
}

function _weatherContext(fd) {
    if (!fd) return '';
    const parts = [];
    if (fd.windKts != null) {
        const desc = fd.windKts > 20 ? ' (kräftig)' : fd.windKts > 10 ? ' (mäßig)' : ' (schwach)';
        parts.push(`Wind ${fd.windKts} kts aus ${fd.windDeg ?? '?'}°${desc}`);
    }
    if (fd.windGustKts != null && fd.windKts != null) {
        const spread = Math.max(0, Number(fd.windGustKts) - Number(fd.windKts));
        if (spread >= 4) parts.push(`Böen bis ${fd.windGustKts} kts`);
    } else if (fd.windGustKts != null) {
        parts.push(`Böen bis ${fd.windGustKts} kts`);
    }
    if (fd.tempC   != null) parts.push(`${fd.tempC}°C`);
    if (fd.visKm   != null) {
        const desc = fd.visKm < 3 ? ' (sehr schlecht)' : fd.visKm < 8 ? ' (eingeschränkt)' : fd.visKm > 20 ? ' (ausgezeichnet)' : '';
        parts.push(`Sicht ${fd.visKm} km${desc}`);
    }
    if (fd.precipRateMmH != null) {
        const p = Number(fd.precipRateMmH);
        const state = p >= 4 ? 'stark' : p >= 1.5 ? 'mäßig' : p > 0.05 ? 'leicht' : '';
        if (state) parts.push(`Niederschlag ${state}`);
    } else if (fd.precipActive === true) {
        parts.push('Niederschlag');
    }
    if (fd.inCloud === true) parts.push('in Wolken');
    if (fd.turbulencePct != null) {
        const t = Number(fd.turbulencePct);
        if (t >= 60) parts.push('Turbulenz stark');
        else if (t >= 35) parts.push('Turbulenz spürbar');
    }
    return parts.length ? `Wetter: ${parts.join(', ')}.` : '';
}

function _wrongLocationPrompt(distNm) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    return `${ctx}

Moment: Das Flugzeug bewegt sich, aber wir sind ${distNm.toFixed(1)} NM vom geplanten Startflughafen ${md?.start || '?'} entfernt. Das ergibt keinen Sinn.
Reagiere verwundert und leicht amüsiert — irgendwas stimmt hier nicht, und du weißt nicht ob der Pilot sich verfahren hat oder ob das Briefing falsch war. 1-2 Sätze.${_toneHint()}`;
}

function _wrongStartContinuePrompt(flightData) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const wx = _weatherContext(flightData);
    return `${ctx}

Moment: Wir sind inzwischen gestartet, aber vom falschen Platz. Mission läuft jetzt einfach von hier weiter.${wx ? ' ' + wx : ''}
Sag dem Piloten mit einem kurzen, lockeren Kommentar, dass wir die Mission jetzt pragmatisch von diesem Startpunkt aus fliegen und offenbar niemand genau weiß, wie wir spontan hier gelandet sind. Humor erlaubt, aber glaubwürdig bleiben. Max 1-2 Sätze.${_toneHint()}`;
}

function _maybeWrongStartContinue(flightData) {
    if (!_paxWrongStartActive || _paxWrongStartContinueDone) return;
    const onGround = !!flightData?.onGround;
    const aglFt = Number(flightData?.aglFt || 0);
    const gsKts = Number(flightData?.gs || flightData?.gsKts || flightData?.groundSpeed || window.lastLiveGpsPos?.gs || 0);
    if (onGround) return;
    if (aglFt < 120 && gsKts < 60) return;
    _paxWrongStartContinueDone = true;
    const p = _wrongStartContinuePrompt(flightData);
    if (!p) return;
    _paxLog('Wrong-Start Follow-up nach Abheben', 'event');
    setTimeout(() => _speakAndShow(p, 'Route läuft ab hier'), 300);
}

function _offDestinationLandingPrompt(distNm) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const distTxt = Number.isFinite(distNm) ? `${distNm.toFixed(1)} NM` : 'ein gutes Stueck';
    return `${ctx}

Moment: Wir sind am Boden, aber nicht am geplanten Ziel (Abweichung etwa ${distTxt}).
Sag in 1-2 kurzen Sätzen mit leichtem Humor, dass wir offenbar woanders gelandet sind ("wo sind wir denn hier gelandet?"), die Mission aber weiter offen bleibt. Keine Panik, konstruktiv bleiben.${_toneHint()}`;
}

function _greetingPrompt() {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const wx = _weatherContext(window.lastLiveFlightData);
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const isPOI = _isPOIMission();
    const trainingPlan = _activeAptTrainingPlan();
    const role = String(pax?.role || '').toLowerCase();
    const isClubTechRole = /(mechan|wartung|techn|inspekt|ingenieur|facility|vereins|hangar)/.test(role);
    const taskDomain = String(pax?.taskDomain || '').toLowerCase();
    const isReporterApt = (!isPOI && taskDomain === 'news_coverage');
    const isSightseeingApt = (!isPOI && taskDomain === 'sightseeing_tour');
    const isLearningGuidePoi = (isPOI && taskDomain === 'poi_learning_guide');
    const targetAltFt = Math.round(Number(pax?.targetAltFt || 0));
    const comfortPolicy = _comfortFeedbackPolicy(pax);
    const urgencyPriority = _normUrgencyPriority(pax?.urgencyPriority);
    const stomachSensitivity = _normLevel3(pax?.stomachSensitivity || 'mittel');
    const cargoSensitivity = _normLevel3(pax?.cargoSensitivity || 'mittel');
    const comfortHintNeeded = !!comfortPolicy.proactiveAny;
    const mandatoryStomachHint = (stomachSensitivity === 'hoch');
    const preferCargoHint = (!mandatoryStomachHint && cargoSensitivity === 'hoch');
    const timingHintNeeded = (urgencyPriority === 'hoch');
    const timingWordBan = timingHintNeeded
        ? 'Zeitbezug nur kurz und konkret.'
        : 'Kein Zeitdruck kommunizieren.';
    const comfortContentRule = mandatoryStomachHint
        ? 'Der Komforthinweis MUSS explizit den empfindlichen Magen/Reisekrankheit benennen (z.B. mir wird schnell schlecht, ich vertrage keine Achterbahn-Manoever).'
        : (preferCargoHint
            ? 'Wenn Komforthinweis, dann bevorzugt mit Bezug auf empfindliche Fracht/verwackelungsarme Arbeit.'
            : 'Wenn Komforthinweis, dann passend zum konkreten Risiko (Magen/Fracht/Taetigkeit an Bord).');
    const reqLine = isPOI
        ? (trainingPlan
            ? `Bitte nenne kurz das Übungsthema und wie wir es sicher und sauber abfliegen. Keine internen Parameter oder technischen Vorgaben zitieren.`
            : (isLearningGuidePoi
                ? `Bitte sag locker, dass du den Piloten zum Ziel fuehrst und dabei etwas ueber den Ort vermittelst. Keine Arbeitsanweisung, keine feste Arbeitshoehe, kein Komfort- oder Zeitdruckhinweis.`
                : `Bitte sag in natürlicher Sprache kurz, was du am Zielgebiet vorhast.${targetAltFt > 0 ? ` Erwähne dabei einmal die fürs Ziel geplante Arbeitshöhe (ungefähr ${targetAltFt} ft).` : ''}${(taskDomain === 'fire_watch' && Number.isFinite(Number(md?.fireHazard?.level))) ? ` Nenne bei der Einsatzlage kurz den offiziellen DWD-Waldbrandgefahrenindex (Stufe ${Math.round(Number(md.fireHazard.level))} von 5).` : ''} Keine internen Parameter oder technischen Vorgaben zitieren.`))
        : (isReporterApt
            ? (comfortHintNeeded
                ? `Nenne kurz, was dein Reporter-Einsatz am Ziel vor Ort ist (1 konkreter Anlass). Nenne einen Komforthinweis nur wenn wirklich nötig. ${comfortContentRule}${timingHintNeeded ? ' Erwähne kurz, dass pünktliche Ankunft wichtig ist.' : ''} Sonst klarer Fokus auf Arbeit am Boden. KEINE Zielarbeitsanforderungen in der Luft wie feste Höhe, Überflug oder Verweildauer nennen.`
                : `Nenne kurz, was dein Reporter-Einsatz am Ziel vor Ort ist (1 konkreter Anlass), danach Fokus auf ${timingHintNeeded ? 'pünktliche ' : ''}Ankunft und Start der Arbeit am Boden. KEIN Komforthinweis. KEINE Zielarbeitsanforderungen in der Luft wie feste Höhe, Überflug oder Verweildauer nennen.`)
            : (isSightseeingApt
                ? `Sag kurz und locker, dass du dich auf den Flug freust (z.B. "Danke fürs Mitnehmen"). Kein Anweisungsstil: KEINE Navigations-, Höhen- oder Arbeitsvorgaben an den Piloten. Maximal ein weicher Komforthinweis (ruhig/entspannt), sonst einfach sympathische Vorfreude auf den Ausflug.`
            : (isClubTechRole
                ? `Fokus auf den Auftrag und den Ablauf am Ziel. Komfortwünsche nur nennen, wenn sie wirklich wichtig sind. KEINE Zielarbeitsanforderungen wie feste Höhe, Überflug oder Verweildauer nennen.`
                : (comfortHintNeeded
                    ? `Nenne genau einen kurzen Komforthinweis NUR wenn er aufgrund von Magen/Fracht/Empfindlichkeit wirklich nötig ist. ${comfortContentRule}${timingHintNeeded ? ' Erwähne zusätzlich kurz den Zeitdruck.' : ''} Sonst Fokus auf Transportauftrag und Zielablauf am Boden. KEINE Zielarbeitsanforderungen wie feste Höhe, Überflug oder Verweildauer nennen.`
                    : `Nenne KEINEN Komforthinweis. Fokus auf Transportauftrag und Ablauf nach Ankunft am Zielplatz.${timingHintNeeded ? ' Erwähne kurz, dass der Auftrag zeitkritisch ist.' : ''} KEINE Zielarbeitsanforderungen wie feste Höhe, Überflug oder Verweildauer nennen.`))));
    const driftGuard = _domainDriftGuard('greeting');
    return `${ctx}

Moment: Wir starten gleich — Motor läuft an oder das Flugzeug setzt sich in Bewegung.${wx ? ' ' + wx : ''}
Basistext für deine Begrüßung (frei adaptieren): "${pax.greetingText}"
Du DARFST hier mit einer kurzen natürlichen Begrüßung beginnen (z.B. "Hi"), aber nur sehr knapp.
${reqLine}
${driftGuard}
${timingWordBan}
Max 3 Sätze.${_toneHint()}`;
}

function _atTargetPrompt(flightData) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;

    const altFt = Math.round(flightData?.mslFt || 0);
    const aglFt = Math.round(flightData?.aglFt || 0);
    const bank  = Math.abs(flightData?.bankDeg || 0).toFixed(1);
    const gf    = (flightData?.gForce || 1.0).toFixed(2);
    const isPOI = _isPOIMission();
    const wx    = _weatherContext(flightData);

    const situation = isPOI
        ? `Wir sind am Ziel "${(typeof currentMissionData !== 'undefined' ? currentMissionData : null)?.poiName || 'Ziel'}". Höhe: ${altFt} ft MSL / ${aglFt} ft AGL.`
        : `Wir nähern uns ${(typeof currentMissionData !== 'undefined' ? currentMissionData : null)?.dest || 'dem Flughafen'} — Landung gleich.`;

    let notes = '';
    if (pax.gTolerance === 'niedrig' && parseFloat(gf) > 1.3) notes += ` Die G-Belastung vorhin war spürbar für mich.`;
    if (pax.bankTolerance === 'niedrig' && parseFloat(bank) > 20) notes += ` Die Kurven haben mich etwas mitgenommen.`;
    if (isPOI && altFt > 0 && pax.targetAltFt) {
        const diff = altFt - pax.targetAltFt;
        if (Math.abs(diff) > 300) notes += ` Wir sind noch ${diff > 0 ? diff + ' ft zu hoch' : Math.abs(diff) + ' ft zu niedrig'} für meine Arbeit.`;
    }
    if (wx) notes += ` ${wx}`;
    notes += _consumeWeatherMismatchEasteregg(flightData);

    const inspectionLiveHint = _inspectionMissionMeta()
        ? ' Falls es zu deiner Rolle passt, nenne direkt eine erste fachliche Beobachtung am Objekt (z.B. unauffaellig, Verdacht, klarer Schaden).'
        : '';
    const professionalProgressHint = _professionalTaskHint('progress');
    const driftGuard = _domainDriftGuard('progress');
    const trainingPlan = _activeAptTrainingPlan();
    const landingInstructorHint = (!isPOI && trainingPlan)
        ? ' Als Instruktor im Anflug: bereite den Piloten kurz auf die Landung vor. Wenn realistisch, nenne 1-2 markante Landmarken zur VFR-Orientierung. Melde Wind/Wetter knapp und gib genau einen konkreten Lande-Tipp (z.B. stabiler Endanflug, Seitenwindkorrektur, Go-Around-Entscheidung).'
        : '';
    return `${ctx}

Moment: ${situation}${notes}
Reagiere spontan auf diesen Augenblick — was siehst du, was geht dir durch den Kopf? Wenn Wetter oder Bedingungen nicht ideal sind, erwähne es kurz aber bleib positiv.${inspectionLiveHint}${professionalProgressHint}${landingInstructorHint}${driftGuard} Max 2-3 Sätze.${_toneHint()}`;
}

function _aptTrainingPrompt(flightData, distNm, progressRatio) {
    const ctx = _baseContext();
    const plan = _activeAptTrainingPlan();
    if (!ctx || !plan) return null;
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const wx = _weatherContext(flightData);
    const triggerLine = `Trigger: Halbe Strecke erreicht (${Math.round((progressRatio || 0.5) * 100)}%).`;
    // 50%-Call ist immer AIRWORK. Pattern-/Platzrundenanteile gehören in den
    // Endanflug-Trigger (5/4 NM) am Zielflugplatz.
    const airworkFocus = Array.isArray(plan.focus)
        ? plan.focus.filter(item => !_isPatternFocusItem(item))
        : [];
    const modeLine = 'Trainingsmodus AIRWORK: Übungen in der Luft, nicht platzrundenfokussiert.';
    const focusLine = airworkFocus.length
        ? `Heutige Airwork-Übungen: ${airworkFocus.join(', ')}.`
        : 'Nenne jetzt 2-3 konkrete Airwork-Übungen (z.B. Slow Flight, Steep Turns, Stall Recovery, Höhen-/Kursführung).';
    const instructorLineRaw = String(plan.instructorLine || '').trim();
    const lineLooksPattern = _isPatternFocusItem(instructorLineRaw);
    // Halbzeit-Call strikt airwork: pattern-/landing-lastige Instructor-Lines hier NICHT einstreuen.
    const lineHint = (instructorLineRaw && !lineLooksPattern)
        ? `Wenn passend, baue diese Instruktor-Linie sinngemäß ein: "${instructorLineRaw}".`
        : '';
    const closeStepHint = `Schließe zwingend mit einem klaren nächsten Schritt ab, z.B.: "Danach zurück auf Kurs Richtung ${md.dest || 'Zielflugplatz'}."`;
    const hardSeparationRule = 'In diesem Halbzeit-Call strikt verboten: Platzrunde, Fehlanflug/Missed Approach, Touch-and-Go, No-Flap-Landung, Endanflug/Landung. Diese Inhalte erst im 5-NM-Landing-Call.';
    return `${ctx}

Moment: Trainingsflug mit Instruktor. ${triggerLine}${wx ? ' ' + wx : ''}
${modeLine}
${focusLine}
Gib dem Piloten jetzt eine kurze, konkrete Airwork-Arbeitsanweisung (Reihenfolge oder Priorität), dann einen knappen Sicherheitsfokus. ${hardSeparationRule}${lineHint ? ' ' + lineHint : ''} ${closeStepHint}
Ton: sachlich, ruhig, klar. Strikter Instruktor-Funkstil: keine Ortsgeschichte, keine Schwärmerei, kein Offtopic. Max 2 Sätze.${_toneHint()}`;
}

function _evaluateComfortBreach(flightData, pax) {
    if (!flightData || !pax) return null;
    const g = Number(flightData.gForce || 1.0);
    const bank = Math.abs(Number(flightData.bankDeg || 0));
    const wind = Number(flightData.windKts || 0);
    const gust = Number(flightData.windGustKts || 0);
    const gustSpread = (Number.isFinite(gust) && Number.isFinite(wind)) ? Math.max(0, gust - wind) : 0;
    const turbulence = Number(flightData.turbulencePct || 0);
    const precipRate = Number(flightData.precipRateMmH || 0);
    const vsFpm = Number.isFinite(flightData.vsFpm) ? Number(flightData.vsFpm) : Number(flightData.vs || 0);
    const policy = _comfortFeedbackPolicy(pax);
    const chooseThreshold = (level, highPair, mediumPair) => {
        const lvl = _normLevel3(level);
        if (lvl === 'hoch') return { warn: highPair[0], hard: highPair[1] };
        if (lvl === 'mittel') return { warn: mediumPair[0], hard: mediumPair[1] };
        return null;
    };

    const gThr = chooseThreshold(policy.metricLevels.g, [1.45, 1.65], [1.8, 2.1]);
    const bThr = chooseThreshold(policy.metricLevels.bank, [28, 38], [38, 50]);
    // Wetterreaktionen: hoch = frueher, mittel = spaeter, niedrig = stumm.
    const wThr = chooseThreshold(policy.metricLevels.wind, [20, 30], [24, 34]);
    const gsThr = chooseThreshold(policy.metricLevels.gust, [8, 14], [12, 18]);
    const tThr = chooseThreshold(policy.metricLevels.turb, [30, 50], [40, 65]);
    const pThr = chooseThreshold(policy.metricLevels.precip, [1.0, 3.0], [2.0, 4.5]);
    const dThr = chooseThreshold(policy.metricLevels.descent, [-1300, -2000], [-1600, -2400]);

    const gLevel = gThr ? (g >= gThr.hard ? 'hard' : g >= gThr.warn ? 'warn' : null) : null;
    const bLevel = bThr ? (bank >= bThr.hard ? 'hard' : bank >= bThr.warn ? 'warn' : null) : null;
    const wLevel = wThr ? (wind >= wThr.hard ? 'hard' : wind >= wThr.warn ? 'warn' : null) : null;
    const gsLevel = gsThr ? (gustSpread >= gsThr.hard ? 'hard' : gustSpread >= gsThr.warn ? 'warn' : null) : null;
    const tLevel = tThr ? (turbulence >= tThr.hard ? 'hard' : turbulence >= tThr.warn ? 'warn' : null) : null;
    const pLevel = pThr ? (precipRate >= pThr.hard ? 'hard' : precipRate >= pThr.warn ? 'warn' : null) : null;
    const dLevel = dThr ? (vsFpm <= dThr.hard ? 'hard' : vsFpm <= dThr.warn ? 'warn' : null) : null;
    if (!gLevel && !bLevel && !wLevel && !gsLevel && !tLevel && !pLevel && !dLevel) return null;

    const severity = (gLevel === 'hard' || bLevel === 'hard' || wLevel === 'hard' || gsLevel === 'hard' || tLevel === 'hard' || pLevel === 'hard' || dLevel === 'hard') ? 'hard' : 'warn';
    return { severity, g, bank, wind, gustSpread, turbulence, precipRate, vsFpm, gLevel, bLevel, wLevel, gsLevel, tLevel, pLevel, dLevel, policy };
}

function _comfortBreachPrompt(flightData, breach, count) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax || !breach) return null;
    const wx = _weatherContext(flightData);
    const bits = [];
    if (breach.gLevel) bits.push(`G-Last gerade ${breach.g.toFixed(2)}g`);
    if (breach.bLevel) bits.push(`Bank aktuell ${breach.bank.toFixed(0)}°`);
    if (breach.wLevel) bits.push(`Wind ${breach.wind.toFixed(0)} kts`);
    if (breach.gsLevel) bits.push(`Böenspitzen +${Math.round(breach.gustSpread)} kts`);
    if (breach.tLevel) bits.push(`Turbulenz ${Math.round(breach.turbulence)}%`);
    if (breach.pLevel) bits.push(`Niederschlag ${breach.precipRate.toFixed(1)} mm/h`);
    if (breach.dLevel) bits.push(`Sinkflug ${Math.round(breach.vsFpm)} ft/min`);
    const level = breach.severity === 'hard' ? 'deutlich' : 'spürbar';
    const humor = breach.severity === 'hard'
        ? 'Gib gern einen kurzen humorvollen Kommentar zur sportlichen Flugweise.'
        : 'Du darfst leicht humorvoll sein, aber bleib freundlich.';

    return `${ctx}

Moment: Mitten im Flug wurden Komfortgrenzen ${level} überschritten (${bits.join(' · ')}).${wx ? ' ' + wx : ''}
Melde dich beim Piloten mit einem kurzen, menschlichen Statement zu deinem Komfortgefühl. ${humor}
Hinweis: Das ist Hinweis #${count} in diesem Flug. Maximal 1-2 Sätze.${_toneHint()}`;
}

function _maybePaxComfortFeedback(flightData, lat, lon) {
    if (!window.activePassenger || !_missionHasPax() || !flightData) return;
    if (!_paxGreetingDone || _paxAtTargetDone || _paxFarewellDone) return;
    if (_paxLandingPhaseAnnounced || _aptTrainingLandingBriefDone || _poiTrainingLandingBriefDone) return;
    if (_paxComfortBusy) return;
    if (_paxComfortCount >= 3) return;
    const onGround = (typeof flightData?.onGround === 'boolean')
        ? !!flightData.onGround
        : (Number(flightData?.aglFt || 0) <= 12 && Number(flightData?.gs || flightData?.gsKts || 0) < 30);
    if (onGround) return;
    const depDistNm = _distanceFromDepartureNm(Number(lat), Number(lon));
    if (Number.isFinite(depDistNm) && depDistNm < 2.0) return;
    const comfortPolicy = _comfortFeedbackPolicy(window.activePassenger);
    if (!comfortPolicy.reactiveAny) return;

    const now = Date.now();
    const cooldownMs = 90 * 1000;
    if ((now - _paxComfortLastAt) < cooldownMs) return;

    const breach = _evaluateComfortBreach(flightData, window.activePassenger);
    if (!breach) return;

    _paxComfortBusy = true;
    _paxComfortLastAt = now;
    _paxComfortCount += 1;
    _paxLog(
        `Komfort-Hinweis #${_paxComfortCount} | G ${breach.g.toFixed(2)} | Bank ${breach.bank.toFixed(0)}° | Wind ${breach.wind.toFixed(0)}kts | Böen+ ${Math.round(breach.gustSpread || 0)}kts | Turb ${Math.round(breach.turbulence || 0)}% | Mode G:${breach.policy?.metricModes?.g || '-'} B:${breach.policy?.metricModes?.bank || '-'} W:${breach.policy?.metricModes?.wind || '-'} T:${breach.policy?.metricModes?.turb || '-'} D:${breach.policy?.metricModes?.descent || '-'}`,
        'event'
    );

    const prompt = _comfortBreachPrompt(flightData, breach, _paxComfortCount);
    if (!prompt) { _paxComfortBusy = false; return; }
    setTimeout(async () => {
        try {
            await _speakAndShow(prompt, 'Komfort-Hinweis');
        } finally {
            _paxComfortBusy = false;
        }
    }, 300);
}

function _farewellPrompt(record) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;

    const min  = Math.round(record.durationSec / 60);
    const isSimRecord = !!record?.simulated;
    const td   = (!isSimRecord && record.touchdownVsFpm != null) ? `${Math.abs(record.touchdownVsFpm)} ft/min` : null;
    const bank = (record.maxBankDeg || 0).toFixed(1);
    const maxG = (record.maxGForce  || 1.0).toFixed(2);
    const wx   = _weatherContext(window.lastLiveFlightData);

    let highlights = '';
    if (pax.gTolerance === 'niedrig' && (record.maxGForce || 1) > 1.5) highlights += ' Etwas viel G für mich, aber okay.';
    if (pax.bankTolerance === 'niedrig' && (record.maxBankDeg || 0) > 30) highlights += ' Die Kurven waren schon sportlich.';
    if (!isSimRecord && Number.isFinite(record.maxDescentFpm) && record.maxDescentFpm <= -1500) {
        highlights += ` Der Sinkflug mit ${Math.abs(Math.round(record.maxDescentFpm))} ft/min ging etwas auf Ohren und Magen.`;
    }
    if (td && Math.abs(record.touchdownVsFpm) < 200) highlights += ' Die Landung war richtig sanft — Kompliment!';
    if (td && Math.abs(record.touchdownVsFpm) > 500) highlights += ` Die Landung mit ${Math.abs(record.touchdownVsFpm)} ft/min war etwas holprig.`;
    if (isSimRecord) highlights += ' Hinweis: Sim-Modus aktiv, Landebewertung nur eingeschränkt belastbar.';
    if (wx) highlights += ` ${wx}`;
    highlights += _consumeWeatherMismatchEasteregg(window.lastLiveFlightData || null);
    const profLandingHint = _professionalLandingToneHint();
    const trainingPlan = _activeAptTrainingPlan();
    const trn = trainingPlan ? _trainingEvalSummary() : null;
    const trnFacts = trn
        ? `\nTrainingsdaten (Übungsabschnitt): Höhenvariation ${trn.altVar ?? 'n/a'} ft, max Bank ${trn.bank}°, max G ${trn.maxG}g, max Steigen ${trn.climb} ft/min, max Sinken ${Math.abs(trn.descent)} ft/min${trn.aoaMax != null ? `, max AOA ${trn.aoaMax}°` : ''}, Stall-Events ${trn.stallEvents}.`
        : '';
    const trnTask = trn
        ? '\nDa du hier als Instruktor unterwegs bist: Gib ein kurzes, konkretes Trainingsfazit (was war gut, was sollte beim nächsten Flug sauberer werden).'
        : '';

    return `${ctx}

Moment: Wir sind gelandet, Flug beendet.
Fakten: ${min} min, ${record.distanceNm} NM, max ${record.maxAltFt} ft, max Bank ${bank}°, max G ${maxG}g.${highlights ? '\n' + highlights : ''}${trnFacts}
Verabschiede dich persönlich beim Piloten und gib dein Fazit zum Flug — aus deiner Sicht als ${pax.role}. Danke dem Piloten explizit für den Flug (bevorzuge alltagsnah: "danke fürs Mitnehmen" statt "danke für das Mitnehmen"). Auch wenn etwas nicht perfekt war, schließ positiv ab.${trnTask}${profLandingHint} Max 3 Sätze.${_toneHint()}`;
}

// ─── PUBLIC TRIGGERS ─────────────────────────────────────────────────────────

window.triggerPaxGreeting = async function(lat, lon) {
    _paxLog(`triggerPaxGreeting | tts:${_paxVoiceEnabled} done:${_paxGreetingDone} pax:${!!window.activePassenger} key:${!!_getApiKey()}`, 'state');
    if (_paxGreetingDone || !window.activePassenger || !_missionHasPax()) return;
    _paxGreetingDone = true;

    // Location check: must be within 1 NM of the briefed departure airport
    const wp0 = (typeof routeWaypoints !== 'undefined' && Array.isArray(routeWaypoints) && routeWaypoints.length > 0)
        ? routeWaypoints[0] : null;
    if (wp0 && Number.isFinite(lat) && Number.isFinite(lon)) {
        const dLat  = (wp0.lat - lat) * Math.PI / 180;
        const dLon  = ((wp0.lng ?? wp0.lon) - lon) * Math.PI / 180;
        const a     = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180) * Math.cos(wp0.lat*Math.PI/180) * Math.sin(dLon/2)**2;
        const distNm = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 3440.065;
        _paxLog(`Greeting Standort-Check: ${distNm.toFixed(2)} NM vom Startplatz`, 'state');
        if (distNm > 1.0) {
            _paxLog(`Falsche Position (${distNm.toFixed(1)} NM) → Falsche-Ort-Meldung`, 'warn');
            const wrongPrompt = _wrongLocationPrompt(distNm);
            if (wrongPrompt) await _speakAndShow(wrongPrompt, '⚠️ Falscher Ort');
            // Mission soll trotzdem weiterlaufen: wir merken den Wrong-Start
            // und geben nach dem Abheben einen kurzen Folgekommentar.
            _paxWrongStartActive = true;
            return;
        }
    }

    const prompt = _greetingPrompt();
    if (!prompt) { _paxGreetingDone = false; _paxLog('Greeting: kein Prompt (Mission-Daten fehlen?)', 'warn'); return; }
    _paxLog('Greeting → API-Call', 'event');
    await _speakAndShow(prompt, 'Begrüßung');
};

window.triggerPaxAtTarget = async function(flightData) {
    _paxLog(`triggerPaxAtTarget | tts:${_paxVoiceEnabled} done:${_paxAtTargetDone} pax:${!!window.activePassenger} alt:${flightData?.mslFt||0}ft`, 'state');
    if (_paxAtTargetDone || !window.activePassenger || !_missionHasPax()) return;
    const trainingPlan = _activeAptTrainingPlan();
    if (trainingPlan) {
        _paxAtTargetDone = true;
        _paxLandingPhaseAnnounced = true;
        _paxLog('AtTarget unterdrueckt: Trainingsmodus aktiv (eigene Trainings-Trigger steuern die Ansagen)', 'state');
        return;
    }
    _paxAtTargetDone = true;
    _paxLandingPhaseAnnounced = true;
    const prompt = _atTargetPrompt(flightData);
    if (!prompt) { _paxAtTargetDone = false; _paxLandingPhaseAnnounced = false; _paxLog('AtTarget: kein Prompt', 'warn'); return; }
    _paxLog('At-Target → API-Call in 2s', 'event');
    setTimeout(() => _speakAndShow(prompt, _isPOIMission() ? 'Am Ziel' : 'Landung'), 2000);
};

window.triggerPaxFarewell = async function(record) {
    _paxLog(`triggerPaxFarewell | tts:${_paxVoiceEnabled} done:${_paxFarewellDone} pax:${!!window.activePassenger}`, 'state');
    if (_paxFarewellDone || !window.activePassenger || !_missionHasPax()) return;
    _paxFarewellDone = true;
    const prompt = _farewellPrompt(record);
    if (!prompt) { _paxFarewellDone = false; _paxLog('Farewell: kein Prompt', 'warn'); return; }
    _paxLog('Farewell → API-Call in 3s', 'event');
    setTimeout(() => _speakAndShow(prompt, 'Verabschiedung'), 3000);
};

window.triggerPaxOffDestinationLanding = async function(distNm) {
    const now = Date.now();
    if (!window.activePassenger || !_missionHasPax()) return;
    if ((now - _paxOffDestLastAt) < 90000) return;
    _paxOffDestLastAt = now;
    const p = _offDestinationLandingPrompt(distNm);
    if (!p) return;
    _paxLog(`Off-Destination Landing Hinweis | d=${Number(distNm || 0).toFixed(1)} NM`, 'event');
    setTimeout(() => _speakAndShow(p, 'Falscher Landeplatz'), 300);
};

function _haversineNm(lat1, lon1, lat2, lon2) {
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 3440.065;
}

function _distanceFromDepartureNm(lat, lon) {
    const wps = (typeof routeWaypoints !== 'undefined' && Array.isArray(routeWaypoints)) ? routeWaypoints : null;
    if (!wps || !wps.length) return null;
    const depLat = Number(wps[0]?.lat);
    const depLon = Number(wps[0]?.lng ?? wps[0]?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(depLat) || !Number.isFinite(depLon)) return null;
    return _haversineNm(lat, lon, depLat, depLon);
}

function _trainingPoiCenterFromRoute(wps) {
    if (!Array.isArray(wps) || wps.length < 3) return null;
    const mid = wps[Math.floor((wps.length - 1) / 2)];
    const lat = Number(mid?.lat);
    const lon = Number(mid?.lng ?? mid?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
}

// Called each GPS tick from sync.js + sim-route.js
window.checkPaxPoiProximity = function(lat, lon, flightData) {
    if (!window.activePassenger || !_missionHasPax()) return;
    const isPoiMission = _isPOIMission();
    _maybePaxComfortFeedback(flightData, lat, lon);
    _maybeWrongStartContinue(flightData || window.lastLiveFlightData || {});
    const trainingPlan = _activeAptTrainingPlan();
    const wps = (typeof routeWaypoints !== 'undefined') ? routeWaypoints : null;
    if (trainingPlan && wps && wps.length >= 2) {
        const first = wps[0];
        const last = wps[wps.length - 1];
        const distNm = _haversineNm(lat, lon, last.lat, last.lng ?? last.lon);
        if (isPoiMission) {
            const dest = _getDestCoords() || _trainingPoiCenterFromRoute(wps);
            if (!dest) {
                _paxLog('POI-Training: kein gueltiger POI-Mittelpunkt fuer Trigger vorhanden', 'warn');
                return;
            }
            const distToDestNm = _haversineNm(lat, lon, dest.lat, dest.lon);
            const approaching = (_poiTrainingLastDistToDestNm == null)
                ? true
                : (distToDestNm <= (_poiTrainingLastDistToDestNm + 0.02));
            _poiTrainingLastDistToDestNm = distToDestNm;

            // 1) 4 NM vor Trainingsgebiet: Übungsbeschreibung/Einweisung
            if (!_poiTrainingPreBriefDone && approaching && distToDestNm <= 4.0) {
                _poiTrainingPreBriefDone = true;
                _paxLog(`Training-Trigger poi_prebrief_4nm | distDest ${distToDestNm.toFixed(2)} NM`, 'event');
                const p = _poiTrainingPreZonePrompt(flightData, distToDestNm);
                if (p) setTimeout(() => _speakAndShow(p, 'Instruktor'), 300);
            }

            // 2) Beim Einflug in die Zone: Übung starten
            const zoneNm = Math.max(1.2, Number(window.activePassenger?.targetRadiusNm || 0) || 0);
            if (!_poiTrainingZoneStartDone && distToDestNm <= zoneNm) {
                _poiTrainingZoneStartDone = true;
                _trainingEvalBegin();
                _paxLog(`Training-Trigger poi_zone_entry | distDest ${distToDestNm.toFixed(2)} NM`, 'event');
                const p = _poiTrainingZoneEntryPrompt(flightData);
                if (p) setTimeout(() => _speakAndShow(p, 'Instruktor'), 300);
            }

            // 3) Rückanflug: entweder 5 NM (Pattern) oder 4 NM (normale Landung)
            if (_poiTrainingZoneStartDone && !_poiTrainingLandingBriefDone) {
                if (trainingPlan.mode === 'pattern' && distNm <= 5.0) {
                    _poiTrainingLandingBriefDone = true;
                    _paxLandingPhaseAnnounced = true;
                    _paxLog(`Training-Trigger poi_landing_pattern_5nm | distHome ${distNm.toFixed(2)} NM`, 'event');
                    const p = _trainingLandingPrepPrompt(flightData, distNm, 'pattern', 'Startflugplatz');
                    if (p) setTimeout(() => _speakAndShow(p, 'Instruktor'), 300);
                } else if (trainingPlan.mode !== 'pattern' && distNm <= 4.0) {
                    _poiTrainingLandingBriefDone = true;
                    _paxLandingPhaseAnnounced = true;
                    _paxLog(`Training-Trigger poi_landing_4nm | distHome ${distNm.toFixed(2)} NM`, 'event');
                    const p = _trainingLandingPrepPrompt(flightData, distNm, 'landing', 'Startflugplatz');
                    if (p) setTimeout(() => _speakAndShow(p, 'Instruktor'), 300);
                }
            }
        } else {
            // APT-Training: identisches Muster wie POI-Training.
            // 1) Hauptbriefing bei ~50% Route
            const totalNm = _haversineNm(first.lat, first.lng ?? first.lon, last.lat, last.lng ?? last.lon);
            const doneNm = _haversineNm(first.lat, first.lng ?? first.lon, lat, lon);
            const progress = totalNm > 1 ? (doneNm / totalNm) : 0;
            if (!_aptTrainingBriefDone && progress >= 0.50) {
                _aptTrainingBriefDone = true;
                _paxLog(`Training-Trigger apt_half_route_50 | progress ${(progress * 100).toFixed(0)}%`, 'event');
                const p = _aptTrainingPrompt(flightData, distNm, progress);
                if (p) setTimeout(() => _speakAndShow(p, 'Instruktor'), 300);
            }
            // 2) Landing-Call nach Modus: pattern 5NM, sonst 4NM
            if (_aptTrainingBriefDone && !_aptTrainingLandingBriefDone) {
                if (trainingPlan.mode === 'pattern' && distNm <= 5.0) {
                    _aptTrainingLandingBriefDone = true;
                    _paxLandingPhaseAnnounced = true;
                    _paxLog(`Training-Trigger apt_landing_pattern_5nm | dist ${distNm.toFixed(2)} NM`, 'event');
                    const p = _trainingLandingPrepPrompt(flightData, distNm, 'pattern', 'Zielflugplatz');
                    if (p) setTimeout(() => _speakAndShow(p, 'Instruktor'), 300);
                } else if (trainingPlan.mode !== 'pattern' && distNm <= 4.0) {
                    _aptTrainingLandingBriefDone = true;
                    _paxLandingPhaseAnnounced = true;
                    _paxLog(`Training-Trigger apt_landing_4nm | dist ${distNm.toFixed(2)} NM`, 'event');
                    const p = _trainingLandingPrepPrompt(flightData, distNm, 'landing', 'Zielflugplatz');
                    if (p) setTimeout(() => _speakAndShow(p, 'Instruktor'), 300);
                }
            }
        }
    }
    if (trainingPlan && (_aptTrainingBriefDone || _poiTrainingZoneStartDone)) {
        _trainingEvalBegin();
        _trainingEvalTick(flightData || window.lastLiveFlightData || {});
    }

    if (isPoiMission) {
        if (!_poiSatisfied && !_poiAborted) _tickPoiDwell(lat, lon, flightData);
    } else {
        if (!wps || wps.length < 2) return;
        const last = wps[wps.length - 1];
        const distNm = _haversineNm(lat, lon, last.lat, last.lng ?? last.lon);

        // Bei Trainingsflügen übernimmt die Trainingslogik die 5/4-NM-Landing-Ansage.
        // Dadurch vermeiden wir doppelte Meldungen aus dem generischen Airport-Trigger.
        if (trainingPlan) return;

        // Airport: early approach trigger (live mode fallback)
        if (_paxAtTargetDone) return;
        if (distNm <= _AIRPORT_AT_TARGET_NM) {
            _paxLog(`Airport in Reichweite: ${distNm.toFixed(2)} NM`, 'state');
            window.triggerPaxAtTarget(flightData);
        }
    }
};

function _tickPoiDwell(lat, lon, flightData) {
    // POI-Training nutzt ein virtuelles Uebungsgebiet ohne echtes Objekt.
    // Daher keine Objekt-/Dwell-/In-Sight-Trigger aus dem POI-Inspektionspfad.
    if (_activeAptTrainingPlan()) return;

    const pax  = window.activePassenger;
    const dest = _getDestCoords();
    if (!dest) return;

    const distNm   = _haversineNm(lat, lon, dest.lat, dest.lon);
    const radius   = pax.targetRadiusNm || 1.5;
    const inRadius = distNm <= radius;
    const now      = Date.now();
    const gsKts = Number(flightData?.gs || flightData?.gsKts || flightData?.groundSpeed || window.lastLiveGpsPos?.gs || 0);
    const effectiveGs = gsKts > 25 ? gsKts : 95;
    const etaMin = (distNm / effectiveGs) * 60;
    const targetBearing = _bearingDeg(lat, lon, dest.lat, dest.lon);
    const hdg = Number(flightData?.hdg || flightData?.heading || flightData?.trackDeg || flightData?.trkDeg || window.lastLiveGpsPos?.hdg || targetBearing);
    const clockPos = _relativeClockPos(targetBearing, hdg);

    const strict               = _paxStrictMode;
    const taskDomain = _activeTaskDomain();
    const tightAltitudeBand = /^(fire_watch|search_and_rescue|inspection_infra|mapping_survey)$/.test(taskDomain);
    const altTolerance         = strict ? 200  : (tightAltitudeBand ? 300 : 600);
    const dwellRequired        = pax.targetDwellMin > 0 ? pax.targetDwellMin * 60 * (strict ? 1.0 : 0.5) : 0;
    const maxAttempts          = strict ? 2 : 3;
    const graceSec             = strict ? 15  : 25;
    const complaintIntervalSec = strict ? 30 : 45;

    // Frühe POI-Meldung: technisch hilfreiche "Objekt in Sicht"-Ansage.
    // Trigger bei ~3 min Restzeit (gesprochen wird "ca. 2 min", um Gen-/TTS-Latenz auszugleichen).
    if (!_poiSightCallDone && !inRadius && etaMin <= 3.2 && distNm <= Math.max(2.2, radius + 1.2)) {
        _poiSightCallDone = true;
        _paxLog(`POI pre-call | dist: ${distNm.toFixed(2)} NM | eta: ${etaMin.toFixed(1)} min | pos: ${clockPos}`, 'event');
        const p = _poiInSightPrompt(flightData, distNm, etaMin, clockPos);
        if (p) setTimeout(() => _speakAndShow(p, 'Objekt in Sicht'), 300);
    }

    if (!inRadius) {
        _poiInRadius     = false;
        _poiLastTickTime = null;
        return;
    }

    if (!_poiInRadius) {
        _poiInRadius     = true;
        _poiLastTickTime = now;
        if (!_poiEnteredAt) _poiEnteredAt = now;
        _paxLog(`POI-Radius betreten | dist: ${distNm.toFixed(2)} NM | dwell: ${dwellRequired.toFixed(0)}s | altReq: ${pax.targetAltFt || 'keins'}`, 'state');

        // Entry comment — spontane erste Reaktion beim Einflug
        if (!_poiEntryDone) {
            _poiEntryDone = true;
            const p = _poiEntryPrompt(flightData);
            if (p) setTimeout(() => _speakAndShow(p, 'Zielgebiet'), 800);
        }

        // Flyover (targetDwellMin=0): Entry genügt → satisfied nach kurzem Delay
        if (dwellRequired === 0) {
            _poiSatisfied    = true;
            _paxAtTargetDone = true;
            _paxLog('Flyover-Mission — Überflug genügt, satisfied', 'event');
            return;
        }
    }

    const dt = Math.min((now - _poiLastTickTime) / 1000, 5);
    _poiLastTickTime = now;

    const altFt     = flightData?.mslFt || 0;
    const targetAlt = pax.targetAltFt || 0;
    const altOk     = targetAlt === 0 || Math.abs(altFt - targetAlt) <= altTolerance;
    const inRadiusForSec   = (now - (_poiEnteredAt || now)) / 1000;
    const lastComplaintSec = _poiLastComplaintAt ? (now - _poiLastComplaintAt) / 1000 : Infinity;

    if (altOk) {
        // Proximity boost: 2× at centre, 1× at edge (linear)
        const proximityFactor = 1 + Math.max(0, 1 - distNm / radius);
        _poiDwellSec += dt * proximityFactor;

        if (_poiAltWasOk === false) {
            _paxLog('Höhe korrigiert → Bestätigung', 'event');
            const p = _poiAltCorrectedPrompt(flightData);
            if (p) setTimeout(() => _speakAndShow(p, 'Höhe ok'), 500);
        }
        _poiAltWasOk = true;

        if (_poiDwellSec >= dwellRequired) {
            _paxLog(`Verweilzeit erfüllt (${_poiDwellSec.toFixed(0)}s) → zufrieden`, 'event');
            _poiSatisfied    = true;
            _paxAtTargetDone = true;
            const p = _poiSatisfiedPrompt(flightData);
            if (p) setTimeout(() => _speakAndShow(p, 'Ziel erfüllt'), 500);
        }
    } else {
        _poiAltWasOk = false;

        const canComplain = inRadiusForSec >= graceSec && lastComplaintSec >= complaintIntervalSec;
        if (canComplain) {
            if (_poiAttempts < maxAttempts) {
                _poiAttempts++;
                _poiLastComplaintAt = now;
                _paxLog(`Höhen-Reklamation #${_poiAttempts} | ${altFt} ft statt ${targetAlt} ft`, 'event');
                const p = _poiAltComplaintPrompt(flightData, altFt, targetAlt, _poiAttempts);
                if (p) setTimeout(() => _speakAndShow(p, `Höhe (${_poiAttempts}/${maxAttempts})`), 500);
            } else {
                _paxLog('Max. Versuche erreicht → Abbruch', 'event');
                _poiAborted      = true;
                _paxAtTargetDone = true;
                const p = _poiAbortPrompt(flightData);
                if (p) setTimeout(() => _speakAndShow(p, 'Abbruch'), 1000);
            }
        }
    }
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
// All function declarations above are now defined — safe to init
(function() {
    const chk = document.getElementById('awmPaxVoiceCheck');
    if (chk) chk.checked = _paxVoiceEnabled;
    const modeEl = document.getElementById('awmPaxModeSelect');
    if (modeEl) modeEl.value = _paxStrictMode ? 'strict' : 'easy';
    const humorEl = document.getElementById('awmPaxHumorSelect');
    if (humorEl) humorEl.value = _paxHumorLevel;
    const ttsModelEl = document.getElementById('awmPaxTtsModelSelect');
    if (ttsModelEl) ttsModelEl.value = _paxTtsModelPref;

    if (!window.activePassenger && _missionHasPax()) {
        const saved = localStorage.getItem('ga_active_passenger');
        if (saved) try { window.activePassenger = JSON.parse(saved); } catch(e) {}
    }
    _normalizeActivePassengerGender();

    _injectPaxUI();
    _refreshPaxWidgetVisibility();
    _paxLog('System bereit', 'state');
}());
