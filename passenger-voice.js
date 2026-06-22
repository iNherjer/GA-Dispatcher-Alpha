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
window.paxVoiceGetDebugState = function() {
    const pax = window.activePassenger && typeof window.activePassenger === 'object' ? window.activePassenger : null;
    return {
        voiceEnabled: !!_paxVoiceEnabled,
        strictMode: !!_paxStrictMode,
        hasApiKey: !!_getApiKey(),
        hasPassenger: !!pax,
        passengerName: pax?.name || null,
        passengerRole: pax?.role || null,
        roleProfile: pax?.roleProfile || null,
        taskDomain: pax?.taskDomain || null,
        boardingDone: !!_paxBoardingDone,
        greetingDone: !!_paxGreetingDone,
        atTargetDone: !!_paxAtTargetDone,
        farewellDone: !!_paxFarewellDone,
        missionEndVoiceActive: _paxMissionEndVoiceActive(),
        pickupBoardingDone: !!_paxPickupBoardingDone,
        pickupDepartureDone: !!_paxPickupDepartureDone,
        poiSatisfied: !!_poiSatisfied,
        poiAborted: !!_poiAborted,
        poiManualConfirmed: !!_poiManuallyConfirmed,
        poiInRadius: !!_poiInRadius,
        poiEntryDone: !!_poiEntryDone,
        poiDwellSec: Number(_poiDwellSec || 0),
        poiAttempts: Number(_poiAttempts || 0),
        lastSpokenText: _lastSpokenText ? String(_lastSpokenText) : '',
        lastSpeakerName: _lastSpokenSpeaker?.name || null
    };
};

window.paxVoiceBuildDebugReport = function() {
    const missionSnap = window.vpMissionDebugSnapshot || (() => {
        try { return JSON.parse(localStorage.getItem('ga_mission_debug_snapshot') || 'null'); } catch (_) { return null; }
    })();
    const logEntries = (typeof window.paxVoiceGetLogEntries === 'function') ? window.paxVoiceGetLogEntries() : [];
    const state = (typeof window.paxVoiceGetDebugState === 'function') ? window.paxVoiceGetDebugState() : {};
    const lines = [];
    const contract = missionSnap?.contract && typeof missionSnap.contract === 'object' ? missionSnap.contract : null;
    const bush = contract?.bush && typeof contract.bush === 'object' ? contract.bush : null;
    const firstTs = logEntries.length ? logEntries[logEntries.length - 1]?.ts : '-';
    const lastTs = logEntries.length ? logEntries[0]?.ts : '-';
    const rxTextgen = /^Textgen OK \(\d+ Zeichen\):\s*"(.*)"$/;
    const recvTexts = logEntries
        .filter(e => e?.type === 'recv' && rxTextgen.test(String(e.msg || '')))
        .slice(0, 4)
        .map(e => String(e.msg || '').match(rxTextgen)?.[1] || '');
    const lastModel = logEntries.find(e => e?.type === 'send' && /^Textgen → /.test(String(e.msg || '')))?.msg?.replace(/^Textgen → /, '') || '-';
    const warnings = logEntries
        .filter(e => e?.type === 'warn')
        .slice(0, 6)
        .map(e => `${e.ts} :: ${e.msg}`);
    const eventTrail = logEntries
        .filter(e => e?.type === 'event' || e?.type === 'state')
        .filter(e => /Queue \+1 \| Event:|Queue ▶ Start \| Event:|Queue ✓ Ende \| Event:|triggerPax|API-Call|TTS übersprungen|Greeting unterdrueckt|kein Prompt|Airport in Reichweite|POI pre-call|Verweilzeit erfüllt|Landing-Roll/.test(String(e.msg || '')))
        .slice(0, 16)
        .map(e => `${e.ts} :: ${e.msg}`);
    const promptKinds = Array.from(new Set(
        logEntries
            .filter(e => e?.type === 'state' && /^Queue \+1 \| Event: /.test(String(e.msg || '')))
            .map(e => String(e.msg || '').replace(/^Queue \+1 \| Event: /, '').trim())
    )).slice(0, 8);

    lines.push(`Exportiert: ${new Date().toLocaleString('de-DE')}`);
    lines.push('Pax Voice Debug');
    lines.push(`- Log von/bis: ${firstTs} -> ${lastTs}`);
    lines.push(`- Eintraege: ${logEntries.length}`);
    lines.push(`- Mission: ${missionSnap?.mission || 'n/a'}`);
    lines.push(`- Ziel: ${missionSnap?.target || 'n/a'}`);
    lines.push(`- Modus/Kategorie: ${missionSnap?.mode || '?'} / ${missionSnap?.category || '?'}`);
    if (bush) {
        lines.push(`- Bush-Contract: profile=${bush.profileId || '-'} | targetMode=${bush.targetMode || '-'} | completionMode=${bush.completionMode || '-'} | pickupKind=${bush.pickupKind || '-'}`);
    }
    lines.push(`- Rolle/Task: ${state.passengerName || missionSnap?.passenger?.name || '?'} | ${state.passengerRole || missionSnap?.passenger?.role || '?'} | roleProfile=${state.roleProfile || missionSnap?.passenger?.roleProfile || '-'} | taskDomain=${state.taskDomain || missionSnap?.passenger?.taskDomain || '-'}`);
    lines.push(`- Voice-Modus: enabled=${state.voiceEnabled ? '1' : '0'} | strict=${state.strictMode ? '1' : '0'} | apiKey=${state.hasApiKey ? '1' : '0'}`);
    lines.push(`- Letztes Modell: ${lastModel}`);
    lines.push('');
    lines.push('Voice-Status');
    lines.push(`- Boarding done: ${state.boardingDone ? '1' : '0'}`);
    lines.push(`- Greeting done: ${state.greetingDone ? '1' : '0'}`);
    lines.push(`- At-target done: ${state.atTargetDone ? '1' : '0'}`);
    lines.push(`- Farewell done: ${state.farewellDone ? '1' : '0'}`);
    lines.push(`- End voice lock: ${state.missionEndVoiceActive ? '1' : '0'}`);
    lines.push(`- Pickup boarding done: ${state.pickupBoardingDone ? '1' : '0'}`);
    lines.push(`- Pickup departure done: ${state.pickupDepartureDone ? '1' : '0'}`);
    lines.push(`- POI satisfied/aborted: ${state.poiSatisfied ? '1' : '0'} / ${state.poiAborted ? '1' : '0'} | manual=${state.poiManualConfirmed ? '1' : '0'} | inRadius=${state.poiInRadius ? '1' : '0'} | dwellSec=${Math.round(Number(state.poiDwellSec || 0))} | attempts=${Number(state.poiAttempts || 0)}`);
    if (promptKinds.length) lines.push(`- Erkannte Voice-Events: ${promptKinds.join(' | ')}`);
    lines.push('');
    lines.push('Wichtige Voice-Ereignisse');
    if (eventTrail.length) eventTrail.forEach(line => lines.push(`- ${line}`));
    else lines.push('- (keine)');
    lines.push('');
    lines.push('Letzte generierte Texte');
    if (recvTexts.length) recvTexts.forEach((text, idx) => lines.push(`- T${idx + 1}: ${text}`));
    else lines.push('- (keine Textgen-Antworten im Log)');
    if (state.lastSpokenText && !recvTexts.includes(state.lastSpokenText)) {
        lines.push(`- Last spoken cache: ${state.lastSpokenText}`);
    }
    lines.push('');
    lines.push('Warnungen');
    if (warnings.length) warnings.forEach(line => lines.push(`- ${line}`));
    else lines.push('- (keine)');
    return lines.join('\n');
};

window.paxVoiceCopyDebugReport = async function() {
    const btn = document.getElementById('btnCopyPaxVoiceDebug');
    const oldText = btn ? btn.textContent : '';
    try {
        const text = (typeof window.paxVoiceBuildDebugReport === 'function') ? window.paxVoiceBuildDebugReport() : '';
        if (!String(text || '').trim()) throw new Error('empty_pax_voice_debug_report');
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(text);
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', 'readonly');
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand && document.execCommand('copy');
            ta.remove();
            if (!ok) throw new Error('clipboard_unavailable');
        }
        if (btn) {
            btn.textContent = 'Kopiert';
            setTimeout(() => { btn.textContent = oldText || 'Kopieren'; }, 1400);
        }
    } catch (err) {
        if (btn) {
            btn.textContent = 'Fehler';
            setTimeout(() => { btn.textContent = oldText || 'Kopieren'; }, 1600);
        }
        console.warn('[PaxVoice] Debug copy failed:', err);
    }
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
let _paxAudioWarnedAt = 0;

async function _paxEnsureAudioContextRunning(ctx, waitMs = 4500) {
    if (!ctx) return false;
    if (ctx.state === 'running') return true;

    const tryResume = () => {
        if (ctx.state === 'running') return;
        try { ctx.resume().catch(() => {}); } catch (_) {}
    };

    tryResume();
    if (ctx.state === 'running') return true;

    return await new Promise(resolve => {
        let done = false;
        const finish = ok => {
            if (done) return;
            done = true;
            cleanup();
            resolve(!!ok);
        };
        const onState = () => {
            if (ctx.state === 'running') finish(true);
        };
        const onGesture = () => {
            tryResume();
            if (ctx.state === 'running') finish(true);
        };
        const onVisibility = () => {
            if (!document.hidden) onGesture();
        };
        const cleanup = () => {
            clearTimeout(timer);
            clearInterval(pulse);
            try { ctx.removeEventListener('statechange', onState); } catch (_) {}
            document.removeEventListener('click', onGesture, true);
            document.removeEventListener('touchend', onGesture, true);
            document.removeEventListener('pointerup', onGesture, true);
            window.removeEventListener('pageshow', onGesture, true);
            document.removeEventListener('visibilitychange', onVisibility, true);
        };

        try { ctx.addEventListener('statechange', onState); } catch (_) {}
        document.addEventListener('click', onGesture, true);
        document.addEventListener('touchend', onGesture, true);
        document.addEventListener('pointerup', onGesture, true);
        window.addEventListener('pageshow', onGesture, true);
        document.addEventListener('visibilitychange', onVisibility, true);

        const pulse = setInterval(tryResume, 350);
        const timer = setTimeout(() => finish(ctx.state === 'running'), Math.max(800, Number(waitMs) || 4500));
    });
}

window.paxVoiceUnlockAudio = function(reason = 'manual') {
    let info = null;
    try {
        if (typeof window.awmEnsureAudioUnlocked === 'function') {
            info = window.awmEnsureAudioUnlocked(`pax:${reason}`) || null;
        }
    } catch (_) {}
    const ctx = info?.ctx || window._tawsAudioCtx || null;
    if (!ctx) {
        _paxLog('AudioContext nicht verfügbar; bitte einmal in die App klicken und erneut versuchen.', 'warn');
        return null;
    }
    if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
        ctx.resume().catch(() => {});
    }
    try {
        const silent = ctx.createBuffer(1, 1, ctx.sampleRate || 24000);
        const src = ctx.createBufferSource();
        src.buffer = silent;
        src.connect(window._awmMasterGain || ctx.destination);
        src.start(0);
    } catch (_) {}
    const gain = window._awmMasterGain;
    const vol = Number(gain?.gain?.value ?? info?.volume);
    if (Number.isFinite(vol) && vol <= 0.01 && Date.now() - _paxAudioWarnedAt > 5000) {
        _paxAudioWarnedAt = Date.now();
        _paxLog('Audio-Lautstärke steht auf 0%.', 'warn');
    }
    return ctx;
};

window.paxVoiceSetEnabled = function(on) {
    const wasOff = !_paxVoiceEnabled;
    _paxVoiceEnabled = !!on;
    localStorage.setItem('awm_pax_voice', on ? '1' : '0');
    if (on && wasOff && _lastSpokenText && window.activePassenger && _missionHasPax()) {
        _paxLog('Voice aktiviert — lade TTS für letzte Nachricht nach', 'event');
        const epoch = _paxMissionEpoch;
        setTimeout(() => _playTextAsTTS(_lastSpokenText, _lastSpokenSpeaker || null, epoch), 400);
    }
};

function _missionHasPax() {
    if (window.activePassenger) return true;
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
let _paxPickupBoardingDone = false;
let _paxPickupDepartureDone = false;
let _cargoPickupBoardingDone = false;
let _cargoPickupDepartureDone = false;
let _paxWxMismatchDone = false;
let _paxSpeechQueue   = Promise.resolve();
let _paxMissionEpoch  = 1;
let _paxCurrentPlayback = null;
let _paxWrongStartActive = false;
let _paxWrongStartContinueDone = false;
let _paxOffDestLastAt = 0;
let _paxBoardingDone = false;
let _paxBoardingPromise = null;
let _pattonvilleJuliusMentioned = false;
let _pattonvilleReportingPointsMentioned = false;
let _aptTrainingBriefDone = false;
let _aptTrainingLandingBriefDone = false;
const _UNIFIED_INSTRUCTOR_BASELINE = true;
const _USE_COMBINED_BOARDING_GREETING = true;
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
let _poiManuallyConfirmed = false;
let _poiEntryDone       = false; // entry comment fired once on radius entry
let _poiInspectionOutcome = null; // keeps one consistent inspection result per mission
let _sarSearchOutcome = null; // keeps one consistent SAR outcome per mission
let _poiSightCallDone   = false; // early pre-arrival call before entering POI radius
let _poiTrainingLastDistToDestNm = null; // trend helper: detect outbound vs. return leg
let _poiTrainingPreBriefDone = false; // 4 NM before training area
let _poiTrainingZoneStartDone = false; // when entering training area
let _poiTrainingLandingBriefDone = false; // 5/4 NM before landing on return leg
let _poiNarrativeMemory = { pre: '', entry: '', done: '' }; // anti-repeat memory across POI phases
let _poiKnowledgeContextKey = '';
let _poiKnowledgeManualFactIndices = new Set();
let _poiKnowledgeSpokenMemory = '';
let _bushPickupNarrativeMemory = { boarding: '', departure: '', arrival: '', farewell: '' }; // continuity across bush pickup return-leg calls
let _bushCargoPickupNarrativeMemory = { boarding: '', departure: '', farewell: '' }; // continuity across bush cargo pickup handoff calls
let _missionComfortScore = null;

function _paxEpochCurrent(epoch) {
    return Number(epoch) === Number(_paxMissionEpoch);
}

function _paxMissionEndVoiceActive() {
    const runtime = (typeof missionRuntime !== 'undefined' && missionRuntime && typeof missionRuntime === 'object')
        ? missionRuntime
        : null;
    return !!(
        _paxFarewellDone
        || runtime?.waitingFarewellDeboarding
        || runtime?.deboardingAfterFarewellStarted
        || runtime?.closingPending
        || String(runtime?.phase || '').toLowerCase() === 'closing'
    );
}

function _paxStopCurrentPlayback(reason = 'mission-reset') {
    const playback = _paxCurrentPlayback;
    if (!playback) return;
    _paxCurrentPlayback = null;
    try { playback.stop?.(); } catch (_) {}
    if (reason !== 'new-playback') {
        _paxLog(`Aktive Wiedergabe gestoppt (${reason})`, 'state');
    }
}

function _paxMissionTimeout(fn, delayMs) {
    const epoch = _paxMissionEpoch;
    return setTimeout(() => {
        if (epoch !== _paxMissionEpoch) return;
        try { fn(); } catch (_) {}
    }, Math.max(0, Number(delayMs) || 0));
}

window.paxVoiceResetMission = function() {
    _paxMissionEpoch += 1;
    if (!Number.isFinite(_paxMissionEpoch) || _paxMissionEpoch > 1e9) _paxMissionEpoch = 1;
    _paxStopCurrentPlayback('mission-reset');
    _paxGreetingDone  = false;
    _paxAtTargetDone  = false;
    _paxFarewellDone  = false;
    _paxComfortLastAt = 0;
    _paxComfortCount  = 0;
    _paxComfortBusy   = false;
    _paxLandingPhaseAnnounced = false;
    _paxPickupBoardingDone = false;
    _paxPickupDepartureDone = false;
    _cargoPickupBoardingDone = false;
    _cargoPickupDepartureDone = false;
    _paxWxMismatchDone = false;
    _paxSpeechQueue   = Promise.resolve();
    _lastSpokenSpeaker = null;
    _paxWrongStartActive = false;
    _paxWrongStartContinueDone = false;
    _paxOffDestLastAt = 0;
    _paxBoardingDone = false;
    _paxBoardingPromise = null;
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
    _poiManuallyConfirmed = false;
    _poiEntryDone     = false;
    _poiInspectionOutcome = null;
    _sarSearchOutcome = null;
    _poiSightCallDone = false;
    _poiTrainingLastDistToDestNm = null;
    _poiTrainingPreBriefDone = false;
    _poiTrainingZoneStartDone = false;
    _poiTrainingLandingBriefDone = false;
    _poiNarrativeMemory = { pre: '', entry: '', done: '' };
    _poiKnowledgeContextKey = '';
    _poiKnowledgeManualFactIndices = new Set();
    _poiKnowledgeSpokenMemory = '';
    _bushPickupNarrativeMemory = { boarding: '', departure: '', arrival: '', farewell: '' };
    _bushCargoPickupNarrativeMemory = { boarding: '', departure: '', farewell: '' };
    _missionComfortScore = _createMissionComfortScore();
    _lastPaxText = '';
    try { _paxPreparedAudio.clear(); } catch (_) {}
    if (typeof window.missionSurveyPattern?.reset === 'function') {
        try { window.missionSurveyPattern.reset('pax-voice-reset'); } catch (_) {}
    }
    if (typeof window.missionPoiChainRuntime?.reset === 'function') {
        try { window.missionPoiChainRuntime.reset('pax-voice-reset'); } catch (_) {}
    }
    if (typeof window.refreshMissionPoiChainOverlaySoon === 'function') {
        try {
            window.refreshMissionPoiChainOverlaySoon(
                (typeof currentMissionData !== 'undefined' ? currentMissionData : null),
                window.activePassenger || null,
                'pax-voice-reset'
            );
        } catch (_) {}
    }
    _closePaxPanel();
    _refreshPaxWidgetVisibility();
};

window.paxVoiceGetPoiMissionProgress = function() {
    const sarHeli = (typeof window.missionSarHeliProgressSnapshot === 'function')
        ? window.missionSarHeliProgressSnapshot()
        : null;
    const sarHeliLoaded = !!(sarHeli && sarHeli.patientLoaded);
    const surveyPattern = (typeof window.missionSurveyPattern?.snapshot === 'function')
        ? window.missionSurveyPattern.snapshot()
        : null;
    const surveySatisfied = !!(surveyPattern && surveyPattern.satisfied);
    const poiChain = (typeof window.missionPoiChainRuntime?.snapshot === 'function')
        ? window.missionPoiChainRuntime.snapshot()
        : null;
    const poiChainSatisfied = !!(poiChain && poiChain.satisfied);
    return {
        hasSignal: true,
        trackingActive: !!window.activePassenger && _missionHasPax(),
        satisfied: !!(_poiSatisfied || sarHeliLoaded || surveySatisfied || poiChainSatisfied),
        aborted: !!_poiAborted,
        manualConfirmed: !!_poiManuallyConfirmed,
        atTargetDone: !!(_paxAtTargetDone || sarHeliLoaded || surveySatisfied || poiChainSatisfied),
        dwellSec: Math.max(0, Number(_poiDwellSec || 0)),
        attempts: Math.max(0, Number(_poiAttempts || 0)),
        sarHeli,
        surveyPattern,
        poiChain
    };
};

window.paxVoiceRestorePoiMissionProgress = function(progress = null, reason = 'mission-resume') {
    if (!progress || typeof progress !== 'object') return false;
    const surveySatisfied = !!(progress.surveyPattern && progress.surveyPattern.satisfied);
    _poiSatisfied = !!(progress.satisfied || surveySatisfied);
    _poiAborted = !!progress.aborted;
    _poiManuallyConfirmed = !!progress.manualConfirmed;
    _paxAtTargetDone = !!progress.atTargetDone || _poiSatisfied || _poiManuallyConfirmed;
    _poiDwellSec = Math.max(0, Number(progress.dwellSec || 0));
    _poiAttempts = Math.max(0, Number(progress.attempts || 0));
    if (progress.surveyPattern && typeof window.missionSurveyPattern?.restoreProgress === 'function') {
        try {
            window.missionSurveyPattern.restoreProgress(progress.surveyPattern, (typeof currentMissionData !== 'undefined' ? currentMissionData : null), window.activePassenger || null);
        } catch (_) {}
    }
    const poiChainSatisfied = !!(progress.poiChain && progress.poiChain.satisfied);
    if (progress.poiChain && typeof window.missionPoiChainRuntime?.restoreProgress === 'function') {
        try {
            window.missionPoiChainRuntime.restoreProgress(progress.poiChain, (typeof currentMissionData !== 'undefined' ? currentMissionData : null), window.activePassenger || null);
        } catch (_) {}
    }
    if (poiChainSatisfied) {
        _poiSatisfied = true;
        _paxAtTargetDone = true;
    }
    if (_poiSatisfied || _poiManuallyConfirmed || _poiDwellSec > 0) {
        _poiInRadius = true;
        _poiEntryDone = true;
        _poiLastTickTime = Date.now();
        if (!_poiEnteredAt) _poiEnteredAt = _poiLastTickTime;
    }
    _paxLog(`POI-Fortschritt wiederhergestellt (${reason}) | satisfied=${_poiSatisfied ? 1 : 0} manual=${_poiManuallyConfirmed ? 1 : 0} dwell=${Math.round(_poiDwellSec)}s`, 'state');
    _refreshPaxWidgetVisibility();
    return true;
};

function _createMissionComfortScore() {
    return {
        startedAt: Date.now(),
        samples: 0,
        pilotEvents: 0,
        pilotSevere: 0,
        weatherEvents: 0,
        weatherSevere: 0,
        cargoRiskEvents: 0,
        gEvents: 0,
        bankEvents: 0,
        descentEvents: 0,
        maxG: 1.0,
        maxBankDeg: 0,
        maxDescentFpm: 0,
        maxWindKts: 0,
        maxGustSpreadKts: 0,
        maxTurbulencePct: 0,
        maxPrecipRate: 0,
        flags: {}
    };
}

function _missionComfortScoreState() {
    if (!_missionComfortScore) _missionComfortScore = _createMissionComfortScore();
    return _missionComfortScore;
}

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
    if (/^(poi_learning_guide|sightseeing_tour)$/.test(_activeTaskDomain()) && _activePoiKnowledgeContext()) {
        _poiKnowledgeSyncContext();
        const spoken = String(spokenText || '').replace(/\s+/g, ' ').trim();
        if (spoken) {
            _poiKnowledgeSpokenMemory = `${_poiKnowledgeSpokenMemory} ${spoken}`.trim().slice(-4000);
        }
    }
    if (ev.includes('objekt in sicht')) _poiNarrativeMemory.pre = compact;
    else if (ev.includes('zielgebiet')) _poiNarrativeMemory.entry = compact;
    else if (ev.includes('ziel erfüllt') || ev.includes('ziel erfuellt') || ev.includes('am ziel')) _poiNarrativeMemory.done = compact;
}

function _captureBushPickupNarrativeMemory(eventLabel, spokenText) {
    const active = _activeBushPickupPassengerContract();
    if (!active) return;
    const ev = String(eventLabel || '').toLowerCase();
    const compact = _poiMemoryCompact(spokenText);
    if (!compact) return;
    if (ev.includes('pickup')) _bushPickupNarrativeMemory.boarding = compact;
    else if (ev.includes('rueckflug') || ev.includes('rückflug')) _bushPickupNarrativeMemory.departure = compact;
    else if (ev.includes('landung') || ev.includes('anflug')) _bushPickupNarrativeMemory.arrival = compact;
    else if (ev.includes('verabschiedung')) _bushPickupNarrativeMemory.farewell = compact;
}

function _bushPickupStageProgression(stage = 'departure') {
    const s = String(stage || '').toLowerCase();
    if (s === 'departure') {
        return 'Story-Stufe Rückflug: Nenne jetzt ein neues Detail aus der Arbeit draußen oder ein konkretes Ergebnis, das beim Einsteigen noch nicht gesagt wurde. Wiederhole nicht denselben Satz in anderen Worten.';
    }
    if (s === 'arrival') {
        return 'Story-Stufe Anflug: Verschiebe den Fokus nach vorn auf McCall und den ersten Schritt nach der Landung. Nenne höchstens ein kurzes Ergebnis aus der Wildnis, aber kein erneutes komplettes Debrief.';
    }
    if (s === 'farewell') {
        return 'Story-Stufe Abschluss: Runde die Geschichte persönlich ab. Danke dem Piloten, nenne den Handoff oder die Auswertung in der Basis und wiederhole weder Pickup-Grund noch Rückfluggrund ausführlich.';
    }
    return 'Story-Stufe Einstieg: Setze den Einsatzschwerpunkt, aber hebe Details und Ergebnisse für die späteren Ansagen auf.';
}

function _bushPickupNarrativeHint(stage = 'departure') {
    const active = _activeBushPickupPassengerContract();
    if (!active) return '';
    const boarding = String(_bushPickupNarrativeMemory?.boarding || '').trim();
    const departure = String(_bushPickupNarrativeMemory?.departure || '').trim();
    const arrival = String(_bushPickupNarrativeMemory?.arrival || '').trim();
    if (stage === 'departure') {
        if (!boarding) return '';
        return ` Bisherige Strip-Ansage (inhaltlich verbindlich, nicht wortgleich wiederholen): "${boarding}". ${_bushPickupStageProgression('departure')} Bleib bei demselben Einsatz, derselben Tätigkeit und demselben Wildnis-Kontext; erfinde keinen anderen Forschungs-, Tier-, Einsatz- oder Missionsschwerpunkt.`;
    }
    const used = [boarding, departure, stage === 'farewell' ? arrival : ''].filter(Boolean);
    if (!used.length) return '';
    return ` Bisherige Bush-Pickup-Ansagen (inhaltlich verbindlich, nicht wortgleich wiederholen): ${used.map(text => `"${text}"`).join(' | ')}. ${_bushPickupStageProgression(stage)} Bleib bei derselben Geschichte; führe sie weiter oder runde sie ab, statt dieselben Inhalte neu zu verpacken. Führe keinen neuen Forschungs-, Wildnis- oder Einsatzschwerpunkt ein.`;
}

function _captureBushCargoPickupNarrativeMemory(eventLabel, spokenText) {
    const active = _activeBushPickupCargoContract();
    if (!active) return;
    const ev = String(eventLabel || '').trim().toLowerCase();
    const compact = String(spokenText || '').trim();
    if (!compact) return;
    if (ev.includes('pickup')) _bushCargoPickupNarrativeMemory.boarding = compact;
    else if (ev.includes('rueckflug') || ev.includes('rückflug')) _bushCargoPickupNarrativeMemory.departure = compact;
    else if (ev.includes('verabschiedung')) _bushCargoPickupNarrativeMemory.farewell = compact;
}

function _bushCargoPickupNarrativeHint(stage = 'departure') {
    const active = _activeBushPickupCargoContract();
    if (!active) return '';
    const boarding = String(_bushCargoPickupNarrativeMemory?.boarding || '').trim();
    const departure = String(_bushCargoPickupNarrativeMemory?.departure || '').trim();
    const farewell = String(_bushCargoPickupNarrativeMemory?.farewell || '').trim();
    const used = [];
    if (boarding) used.push(boarding);
    if (stage !== 'departure' && departure) used.push(departure);
    if (stage === 'final' && farewell) used.push(farewell);
    if (!used.length) return '';
    return ` Bisherige Bush-Cargo-Ansagen (inhaltlich verbindlich): ${used.map(text => `"${text}"`).join(' | ')}. Wiederhole weder Grund noch Empfaenger noch naechsten Schritt wortgleich. Fuehre die Geschichte stattdessen knapp weiter und gib pro Phase neue, konkrete Information.`;
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
    return ` Bereits genannt (nicht wiederholen, nicht paraphrasieren und nicht als Leitmotiv fortsetzen): ${used.join(' | ')}. Liefere stattdessen neue, konkrete Zusatzinfos. Wenn darin eine Landmarke oder ein Spezialobjekt vorkam, greife es nicht erneut auf, ausser die aktuelle Anweisung verlangt es ausdruecklich.`;
}

function _poiNarrativeMemoryText() {
    return [
        _poiNarrativeMemory?.pre,
        _poiNarrativeMemory?.entry,
        _poiNarrativeMemory?.done
    ].map(x => String(x || '').trim()).filter(Boolean).join(' ');
}

function _poiMemoryHasCue(text = '') {
    const normalize = (value) => String(value || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/ß/g, 'ss');
    const mem = normalize(_poiNarrativeMemoryText());
    if (!mem) return false;
    const t = normalize(text);
    const cues = [
        'strommast', 'freileitung', 'windrad', 'bruecke', 'fluss', 'kanal',
        'autobahn', 'eisenbahn', 'bahnlinie', 'bahntrasse', 'gleis',
        'gipfel', 'bergruecken', 'pass', 'sattel', 'aussichtspunkt',
        'wald', 'waldkante', 'strasse', 'zufahrt', 'stausee', 'see', 'ufer'
    ];
    return cues.some(cue => t.includes(cue) && mem.includes(cue));
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
    return (mode === '2.5' || mode === '3.1' || mode === 'auto') ? mode : 'auto';
}
let _paxTtsModelPref = _normalizePaxTtsModelPref(localStorage.getItem('awm_pax_tts_model') || 'auto');
localStorage.setItem('awm_pax_tts_model', _paxTtsModelPref);
const _PAX_TTS_HEDGE_DEFAULT_MS = 3000;

function _paxTtsHedgeEnabled() {
    return localStorage.getItem('awm_pax_tts_hedge_enabled') === '1';
}

function _paxTtsHedgeDelayMs() {
    const raw = Number(localStorage.getItem('awm_pax_tts_hedge_delay_ms'));
    const n = Number.isFinite(raw) && raw > 0 ? raw : _PAX_TTS_HEDGE_DEFAULT_MS;
    return Math.max(1000, Math.min(10000, Math.round(n)));
}

function _normalizePaxAudioStyle(style) {
    return ['clear', 'intercom', 'intercom_noise'].includes(style) ? style : 'intercom_noise';
}

function _paxAudioStyleLabel(style = _paxAudioStyle) {
    if (style === 'clear') return 'Version 1 - Klar';
    if (style === 'intercom') return 'Version 2 - Intercom ohne Rauschen';
    return 'Version 3 - Intercom mit Rauschen';
}

let _paxAudioStyle = _normalizePaxAudioStyle(localStorage.getItem('awm_pax_audio_style') || 'intercom_noise');
localStorage.setItem('awm_pax_audio_style', _paxAudioStyle);

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

function _syncPaxTtsHedgeControl() {
    const el = document.getElementById('awmPaxFastTtsToggle');
    if (el) el.checked = _paxTtsHedgeEnabled();
}

window.paxVoiceSetTtsHedge = function(enabled, delayMs = null) {
    if (enabled && _paxTtsModelPref !== 'auto') {
        _paxTtsModelPref = 'auto';
        localStorage.setItem('awm_pax_tts_model', _paxTtsModelPref);
        const modelEl = document.getElementById('awmPaxTtsModelSelect');
        if (modelEl) modelEl.value = _paxTtsModelPref;
        _paxLog('Fast Mode nutzt TTS Auto: 3.1 zuerst, 2.5 als Hedge-Fallback', 'state');
    }
    localStorage.setItem('awm_pax_tts_hedge_enabled', enabled ? '1' : '0');
    if (delayMs != null) {
        const safeDelay = Math.max(1000, Math.min(10000, Math.round(Number(delayMs) || _PAX_TTS_HEDGE_DEFAULT_MS)));
        localStorage.setItem('awm_pax_tts_hedge_delay_ms', String(safeDelay));
    }
    _syncPaxTtsHedgeControl();
    _paxLog(`TTS-Hedge: ${_paxTtsHedgeEnabled() ? 'ein' : 'aus'} | Delay ${_paxTtsHedgeDelayMs()}ms`, 'state');
};

window.paxVoiceSetAudioStyle = function(style) {
    const next = _normalizePaxAudioStyle(style);
    _paxAudioStyle = next;
    localStorage.setItem('awm_pax_audio_style', next);
    const el = document.getElementById('awmPaxAudioStyleSelect');
    if (el) el.value = next;
    _paxLog(`Audio-Stil gesetzt: ${_paxAudioStyleLabel(next)}`, 'state');
};

// ─── INIT ─── called at bottom of file after all defs ───────────────────────

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function _getApiKey() {
    return document.getElementById('apiKeyInput')?.value.trim() || '';
}

function _isPOIMission() {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    if (md && typeof md === 'object' && md.poiName) return true;
    if (
        md
        && typeof md === 'object'
        && md.missionType === 'bush'
        && md.bush
        && String(md.bush.profileId || '').toLowerCase() === 'bush_recon_return'
        && String(md.bush.targetMode || '').toLowerCase() === 'area_then_return'
    ) return true;
    if (typeof currentDestICAO !== 'undefined' && currentDestICAO === 'POI') return true;
    return document.getElementById('destRwyContainer')?.style.display === 'none';
}

function _getMissionStory() {
    return document.getElementById('mStory')?.innerText?.trim() || '';
}

function _activeMissionStoryFrame() {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const contract = md.missionContract || window.activeMissionContract || null;
    const v4 = md.missionContractV4
        || contract?.missionContractV4
        || md._missionContractV4
        || null;
    const frame = v4?.storyFrame
        || md?.missionPlanV4?.storyFrame
        || md?._missionPlanV4?.storyFrame
        || contract?.missionPlanV4?.storyFrame
        || contract?._missionPlanV4?.storyFrame
        || md?.missionPlanV2?.plan?.storyFrame
        || contract?.missionPlanV2?.plan?.storyFrame
        || null;
    return (frame && typeof frame === 'object') ? frame : null;
}

function _activeMissionFollowUpContext() {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const contract = md.missionContract || window.activeMissionContract || null;
    const candidates = [
        md.followUpContext,
        contract?.followUpContext,
        md.missionContractV4?.followUpContext,
        contract?.missionContractV4?.followUpContext,
        md.missionPlanV4?.followUpContext,
        contract?.missionPlanV4?.followUpContext,
        md._missionContractV4?.followUpContext,
        contract?._missionContractV4?.followUpContext
    ];
    return candidates.find(item => item && typeof item === 'object') || null;
}

function _activeMissionTemporalContext() {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const followUpContext = _activeMissionFollowUpContext();
    const candidates = [
        md.missionTemporalContext,
        md.followUpProspect?.temporalContext,
        md.followUpContinuation?.temporalContext,
        followUpContext?.temporalContext,
        window.activePassenger?.missionTemporalContext
    ];
    return candidates.find(item => item && typeof item === 'object') || null;
}

function _followUpDeboardingHintLine() {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    if (md.followUpContinuation || md.followUpRequestId) return '';
    if (_activeBushReconOutcome()) return '';
    const temporal = _activeMissionTemporalContext();
    const prospect = md.followUpProspect && typeof md.followUpProspect === 'object' ? md.followUpProspect : null;
    const hint = String(
        prospect?.deboardingHint
        || temporal?.deboardingHint
        || window.activePassenger?.followUpDeboardingHint
        || ''
    ).replace(/\s+/g, ' ').trim();
    if (!hint) return '';
    const stay = String(temporal?.stayText || prospect?.stayText || '').replace(/\s+/g, ' ').trim();
    return `\nANSCHLUSS-HINWEIS: ${hint}${stay ? ` Zeitraum: ${stay}.` : ''} Erwähne das nur, wenn es als natürlicher Abschiedssatz passt. Keine Wörter wie Follow-up, Request, Timer, stayDays oder System.`;
}

function _activeBushReconOutcome() {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const profileId = String(md?.bush?.profileId || md?.missionContract?.bush?.profileId || md?._appliedProfile || '').toLowerCase();
    if (profileId !== 'bush_recon_return') return null;
    const raw = md.bushReconOutcome || md.hiddenMissionOutcome?.bushReconOutcome || null;
    if (!raw || typeof raw !== 'object') return null;
    const outcome = String(raw.outcome || raw.type || '').toLowerCase();
    if (!outcome) return null;
    return { ...raw, outcome };
}

function _activeInfraInspectionOutcome() {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const taskDomain = String(
        window.activePassenger?.taskDomain
        || md?.missionContract?.taskDomain
        || md?.passenger?.taskDomain
        || ''
    ).toLowerCase();
    if (taskDomain !== 'inspection_infra') return null;
    const raw = md.infraInspectionOutcome
        || md.hiddenMissionOutcome?.infraInspectionOutcome
        || md.missionContract?.infraInspectionOutcome
        || null;
    if (!raw || typeof raw !== 'object') return null;
    const outcome = String(raw.outcome || raw.type || '').toLowerCase();
    if (!outcome) return null;
    return { ...raw, outcome };
}

function _bushReconOutcomeHintLine(stage = 'farewell') {
    const outcome = _activeBushReconOutcome();
    if (!outcome) return '';
    const targetName = String(
        (typeof currentMissionData !== 'undefined' ? currentMissionData?.bush?.targetRef?.name : '')
        || (typeof currentMissionData !== 'undefined' ? currentMissionData?.targetName : '')
        || 'dem Zielstrip'
    ).trim();
    const resultText = String(outcome.resultText || '').replace(/\s+/g, ' ').trim();
    let task = '';
    if (outcome.outcome === 'all_clear') {
        task = resultText || `Der Recon über ${targetName} ist unauffällig; die Basis dokumentiert den Strip als nutzbar und es entsteht keine Folgeanforderung.`;
    } else if (outcome.outcome === 'monitor_only') {
        task = resultText || `Der Recon über ${targetName} bleibt auf Beobachtung; es gibt noch keinen Bodenauftrag und keine sofortige Folgeanforderung.`;
    } else if (outcome.outcome === 'technician_needed') {
        const tech = outcome.technicianPlan?.passenger || {};
        const name = tech.name || 'ein Techniker';
        task = resultText || `Der Recon über ${targetName} braucht eine Bodenprüfung; die Basis plant ${name} für einen späteren Techniker-Dropoff ein.`;
    } else {
        const service = outcome.serviceRun || {};
        task = resultText || service.observedIssue || `Der Recon über ${targetName} ergibt einen kleinen Servicebedarf; die Basis plant einen gezielten Materialflug.`;
    }
    if (stage === 'result') {
        return ` Recon-Ergebnis: ${task} Sage das erst jetzt als fachliches Kurzfazit, nicht als Vorabwissen.`;
    }
    return `\nRECON-ERGEBNIS: ${task} Nutze das als jetzt bekanntes Debriefing-Ergebnis. Wenn daraus ein Folgeauftrag entsteht, erwähne ihn als natürliche nächste Teamentscheidung; wenn nicht, sage klar, dass heute keine Folgeanforderung entsteht.`;
}

function _getDestCoords() {
    const el = document.getElementById('mDestCoords');
    if (!el) return null;
    const parts = el.innerText.split(',').map(s => parseFloat(s.trim()));
    if (parts.length >= 2 && isFinite(parts[0]) && isFinite(parts[1])) return { lat: parts[0], lon: parts[1] };
    return null;
}

function _activePoiConfirmCoords() {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const contract = md.missionContract || window.activeMissionContract || null;
    const truth = md.missionTruth || contract?.missionTruth || null;
    const sarHeliTarget = md.sarHeli?.targetRef || contract?.sarHeli?.targetRef || null;
    const main = truth?.mainTarget || null;
    const anchor = truth?.sceneAnchor || null;
    const pick = (...points) => {
        for (const point of points) {
            const lat = Number(point?.lat);
            const lon = Number(point?.lon);
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
                return {
                    lat,
                    lon,
                    name: String(point?.name || md.poiName || md.targetName || 'Ziel').trim() || 'Ziel'
                };
            }
        }
        return null;
    };
    return pick(sarHeliTarget, main, anchor, _getDestCoords());
}

function _poiManualConfirmRangeNm() {
    const pax = window.activePassenger || {};
    const radius = Math.max(0.25, Number(pax.targetRadiusNm || 0) || 1.5);
    return Math.max(0.25, Math.min(0.8, radius * 0.7));
}

function _normTaskDomain(value) {
    const s = String(value || '').trim().toLowerCase();
    const allowed = new Set([
        'general',
        'training',
        'charter',
        'inspection_infra',
        'infra_chain_recon',
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
        'club_training_advanced',
        'bush_pickup_return',
        'bush_adventure'
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
    if (taskDomain === 'mapping_survey') return null;
    if (taskDomain === 'infra_chain_recon') return null;
    if (taskDomain === 'science_bio' || taskDomain === 'science_geo') return null;
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
    const infraOutcome = _activeInfraInspectionOutcome();
    if (infraOutcome?.outcome) return infraOutcome.outcome;
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
    const infraOutcome = _activeInfraInspectionOutcome();
    if (infraOutcome?.resultPrompt) {
        return ` ${infraOutcome.resultPrompt}`;
    }
    const outcome = _getPoiInspectionOutcome();
    if (outcome === 'major_damage') {
        return ` Inspektionsfazit: Bei "${objectName}" hast du einen klaren Schaden gesehen. Sage konkret, was betroffen wirkt, wie ernst es auf den ersten Blick aussieht und dass der Befund fuer Reparatur oder Sperrpruefung weitergemeldet werden muss.`;
    }
    if (outcome === 'minor_damage') {
        return ` Inspektionsfazit: Bei "${objectName}" hast du eine begrenzte Schadstelle gesehen. Nenne kurz, was betroffen wirkt, dass keine Panik noetig ist, aber eine gezielte Dokumentation oder Nachpruefung folgen sollte.`;
    }
    if (outcome === 'monitor') {
        return ` Inspektionsfazit: Bei "${objectName}" ist nur eine unklare oder kleine Auffaelligkeit offen. Sage, was unauffaellig wirkt, was beobachtet werden sollte und dass eine spaetere Nachpruefung reicht.`;
    }
    if (outcome === 'blocked_access') {
        return ` Inspektionsfazit: Bei "${objectName}" wirkt eine Zufahrt, Trasse oder Arbeitsflaeche blockiert. Beschreibe den sichtbaren Befund kurz und dass daraus eine gezielte Dokumentations- oder Raeumungspruefung folgt.`;
    }
    if (outcome === 'damage') {
        return ` Inspektionsfazit: Bei "${objectName}" hast du einen klaren Schaden gesehen. Sage konkret, was betroffen wirkt, wie ernst es auf den ersten Blick aussieht und dass der Befund fuer Reparatur oder Sperrpruefung weitergemeldet werden muss.`;
    }
    if (outcome === 'minor') {
        return ` Inspektionsfazit: Bei "${objectName}" hast du eine auffaellige Stelle gesehen, aber ohne sichere Schadensbestaetigung. Nenne kurz, was unauffaellig ist, was beobachtet werden sollte und ob eine spaetere Nachpruefung reicht.`;
    }
    if (outcome === 'pending') {
        return ` Inspektionsfazit: Den gesuchten Punkt an "${objectName}" konntest du noch nicht eindeutig erkennen. Sage kurz, welcher Bereich noch unklar ist, und bitte freundlich um einen weiteren ruhigen Pass.`;
    }
    return ` Inspektionsfazit: Bei "${objectName}" konntest du keinen relevanten Schaden erkennen. Sage kurz, welche kritischen Punkte sauber aussehen und dass vorerst keine akute Reparatur noetig wirkt.`;
}

function _getSarSearchOutcome() {
    if (_sarSearchOutcome) return _sarSearchOutcome;
    // Slight bias to "not found" for realism in random missions.
    _sarSearchOutcome = (Math.random() < 0.38) ? 'found' : 'not_found';
    return _sarSearchOutcome;
}

function _sarResultHint() {
    if (_activeTaskDomain() !== 'search_and_rescue') return '';
    const frame = _activeMissionStoryFrame();
    const subject = String(frame?.focusSubject || '').trim();
    const outcome = _getSarSearchOutcome();
    if (outcome === 'found') {
        return subject
            ? ` SAR-Fazit: Melde klar, dass du zu "${subject}" jetzt einen verwertbaren Treffer hast und die Position sofort an die Leitstelle weitergibst.`
            : ' SAR-Fazit: Melde klar, dass du die vermisste Person entdeckt hast und die Koordinaten sofort an die Leitstelle weitergibst.';
    }
    return subject
        ? ` SAR-Fazit: Melde klar, dass wir zu "${subject}" in diesem Sektor noch keinen Treffer haben und die Leitstelle fuer weitere Suchabschnitte informiert wird.`
        : ' SAR-Fazit: Melde klar, dass wir in diesem Sektor keine Person finden konnten und die Leitstelle fuer weitere Suchabschnitte informiert wird.';
}

function _professionalRoleMeta() {
    const pax = window.activePassenger || {};
    const role = String(pax.role || '').toLowerCase();
    const story = String(_getMissionStory() || '').toLowerCase();
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const objectName = md.poiName || 'dem Zielobjekt';
    const taskDomain = _activeTaskDomain();

    if (taskDomain === 'media_photo' || taskDomain === 'inspection_infra' || taskDomain === 'infra_chain_recon' || taskDomain === 'training' || taskDomain === 'charter' || taskDomain === 'club_utility' || taskDomain === 'bush_pickup_return' || taskDomain === 'bush_adventure') {
        return null;
    }
    if (taskDomain === 'mapping_survey') {
        return {
            field: 'Survey',
            entry: ` Nenne kurz, welche Survey-Aufgabe du an "${objectName}" startest (z.B. Orthofoto, Korridor, Objekt-Orbit, Kartenupdate) und woran gute Daten erkennbar sind.`,
            progress: ` Gib einen knappen Survey-Zwischenstand zu "${objectName}" (Linie, Hoehe, Ueberlappung, Abdeckung), ohne Schadens- oder Sightseeing-Ton.`,
            result: ` Schließe mit einem Survey-Fazit zu "${objectName}" ab: Datensatz brauchbar, Abdeckung ausreichend, naechster Schritt Auswertung/GIS/Photogrammetrie.`
        };
    }
    // Operative Domains sollen nicht in wissenschaftliche Fallback-Hinweise driften.
    if (/^(fire_watch|search_and_rescue|news_coverage|medical_transfer|animal_transport|cargo_fragile|sightseeing_tour|historian_guided_tour|poi_learning_guide)$/.test(taskDomain)) {
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

function _paxCardinalGerman(bearingDeg) {
    const n = Number(bearingDeg);
    if (!Number.isFinite(n)) return '';
    const dirs = ['noerdlich', 'nordoestlich', 'oestlich', 'suedoestlich', 'suedlich', 'suedwestlich', 'westlich', 'nordwestlich'];
    const idx = Math.round((((n % 360) + 360) % 360) / 45) % 8;
    return dirs[idx] || '';
}

function _paxNormalizeKey(value = '') {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function _paxNearestMapPlace(maxNm = 16) {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const lat = Number(md.targetLat);
    const lon = Number(md.targetLon);
    const cities = Array.isArray(window.GLOBAL_CITIES_DATA)
        ? window.GLOBAL_CITIES_DATA
        : ((typeof globalCities !== 'undefined' && Array.isArray(globalCities)) ? globalCities : []);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !cities.length) return null;
    const targetKey = _paxNormalizeKey(`${md.poiName || ''} ${md.targetName || ''}`);
    let best = null;
    for (const city of cities) {
        const name = String(city?.name || '').replace(/\s+/g, ' ').trim();
        const cLat = Number(city?.lat);
        const cLon = Number(city?.lon);
        const pop = Number(city?.pop || 0);
        if (!name || !Number.isFinite(cLat) || !Number.isFinite(cLon)) continue;
        if (pop > 0 && pop < 2500) continue;
        const nameKey = _paxNormalizeKey(name);
        if (nameKey && targetKey.includes(nameKey)) continue;
        const distNm = _haversineNm(lat, lon, cLat, cLon);
        if (!Number.isFinite(distNm) || distNm < 1 || distNm > maxNm) continue;
        const bearingFromTarget = _bearingDeg(lat, lon, cLat, cLon);
        if (!Number.isFinite(bearingFromTarget)) continue;
        const populationBonus = Math.min(2.2, Math.log10(Math.max(1000, pop || 1000)) / 3.8);
        const score = distNm - populationBonus;
        if (!best || score < best.score) {
            best = {
                name,
                distNm,
                bearingFromTarget,
                targetFromPlace: _paxCardinalGerman(bearingFromTarget + 180),
                placeFromTarget: _paxCardinalGerman(bearingFromTarget),
                pop,
                score
            };
        }
    }
    return best;
}

function _paxCityDatasetAvailable() {
    return Array.isArray(window.GLOBAL_CITIES_DATA)
        || (typeof globalCities !== 'undefined' && Array.isArray(globalCities));
}

function _paxMapPlaceOrientationLine() {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const place = _paxNearestMapPlace(16);
    if (!place) return '';
    const target = String(md.poiName || md.targetName || 'Ziel').replace(/\s+/g, ' ').trim();
    const dist = place.distNm >= 10 ? `${Math.round(place.distNm)} NM` : `${(Math.round(place.distNm * 10) / 10).toFixed(1)} NM`;
    const rel = place.targetFromPlace || 'in der Naehe';
    return `GROBER KARTENBEZUG: ${target || 'Das Ziel'} liegt etwa ${dist} ${rel} von ${place.name}. Nutze diesen Ort als primaere Orientierung; lokale Felsen, Bachnamen, Wege oder Aussichtspunkte nur als Nahbereich-Zusatz.`;
}

function _paxNearLandmarkOrientationLine() {
    const landmark = _paxApproachLandmarkCueLine();
    if (landmark) return landmark;
    const fact = _targetContextFactCandidates().find(Boolean);
    return fact ? `NAHBEREICH-ZUSATZ: ${fact}` : '';
}

function _paxMissionPlanFactSources() {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const contract = md.missionContract || window.activeMissionContract || null;
    const plan = md?._missionPlanV2?.plan
        || md?.missionPlanV2?.plan
        || contract?._missionPlanV2?.plan
        || contract?.missionPlanV2?.plan
        || null;
    if (!plan || typeof plan !== 'object') return [];
    return [
        ...(Array.isArray(plan.localFacts) ? plan.localFacts : []),
        ...(Array.isArray(plan.narrativeHooks) ? plan.narrativeHooks : []),
        ...(Array.isArray(plan.mustMention) ? plan.mustMention.filter(x => String(x || '').trim().length > 18) : [])
    ];
}

function _activePoiKnowledgeContext() {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const pax = window.activePassenger || null;
    const contract = md.missionContract || window.activeMissionContract || null;
    const sources = [
        md.knowledgeContext,
        contract?.knowledgeContext,
        pax?.knowledgeContext,
        md?.missionContract?.knowledgeContext
    ];
    const context = sources.find(ctx => ctx && typeof ctx === 'object' && Array.isArray(ctx.facts) && ctx.facts.length);
    if (!context) return null;
    const status = String(context.status || '').toLowerCase();
    if (status && status !== 'accept') return null;
    return context;
}

function _poiKnowledgeCleanFactText(value = '') {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/\[\d+\]/g, '')
        .trim();
}

function _poiKnowledgeContextIdentity(context = null) {
    if (!context || typeof context !== 'object') return '';
    const title = String(context.title || context.name || '').replace(/\s+/g, ' ').trim();
    const source = String(context.pageid || context.wikidataId || context.url || context.sourceUrl || context.source || '').trim();
    const facts = Array.isArray(context.facts)
        ? context.facts.slice(0, 3).map(fact => _poiKnowledgeCleanFactText(fact?.text || fact || '').slice(0, 80)).join('|')
        : '';
    return `${title}|${source}|${facts}`;
}

function _poiKnowledgeSyncContext(context = null) {
    const activeContext = context || _activePoiKnowledgeContext();
    const key = _poiKnowledgeContextIdentity(activeContext);
    if (!key || key === _poiKnowledgeContextKey) return;
    _poiKnowledgeContextKey = key;
    _poiKnowledgeManualFactIndices = new Set();
    _poiKnowledgeSpokenMemory = '';
}

function _poiKnowledgeFactCandidates(options = {}) {
    const context = _activePoiKnowledgeContext();
    if (!context) return [];
    _poiKnowledgeSyncContext(context);
    const includeExtraFacts = options?.includeExtraFacts === true;
    const facts = Array.isArray(context.facts) ? context.facts : [];
    const extraFacts = includeExtraFacts && Array.isArray(context.extraFacts) ? context.extraFacts : [];
    const seen = new Set();
    return [...facts, ...extraFacts]
        .map((fact, index) => ({
            index,
            key: `${index < facts.length ? 'core' : 'extra'}:${index < facts.length ? index : index - facts.length}`,
            topic: String(fact?.topic || 'general').toLowerCase(),
            text: _poiKnowledgeCleanFactText(fact?.text || fact || '')
        }))
        .filter(fact => fact.text.length >= 36)
        .filter(fact => !/(wikipedia|quelle|http|einzelnachweise|weblinks|normdaten)/i.test(fact.text))
        .filter(fact => {
            const key = fact.text.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function _poiKnowledgeManualFactCandidates() {
    return _poiKnowledgeFactCandidates({ includeExtraFacts: true });
}

function _poiKnowledgeFactKey(fact = {}) {
    return String(fact?.key || fact?.index || fact?.text || '').trim();
}

function _poiKnowledgeStageScore(fact = {}, stage = 'generic') {
    const s = String(stage || 'generic').toLowerCase();
    const topic = String(fact.topic || 'general').toLowerCase();
    const preferred = {
        greeting: ['location', 'history', 'use'],
        boarding: ['location', 'history', 'use'],
        in_sight: ['location', 'structure', 'metrics', 'nature'],
        entry: ['history', 'use', 'structure', 'metrics'],
        result: ['use', 'history', 'nature', 'metrics'],
        generic: ['history', 'location', 'use', 'structure', 'metrics', 'nature']
    }[s] || ['history', 'location', 'use', 'structure', 'metrics', 'nature'];
    const topicScore = preferred.includes(topic) ? (preferred.length - preferred.indexOf(topic)) * 10 : 0;
    const stageOffset = _poiKnowledgeStageMinIndex(s);
    const index = Number.isFinite(Number(fact.index)) ? Number(fact.index) : 0;
    const progressionScore = index >= stageOffset ? 12 : -30;
    return topicScore + progressionScore - index;
}

function _poiKnowledgeStageMinIndex(stage = 'generic') {
    return {
        greeting: 0,
        boarding: 0,
        in_sight: 1,
        entry: 1,
        result: 4,
        generic: 0
    }[String(stage || 'generic').toLowerCase()] || 0;
}

function _poiKnowledgeFactHint(stage = 'generic') {
    const task = _activeTaskDomain();
    const isLearningGuide = task === 'poi_learning_guide';
    const isSightseeing = task === 'sightseeing_tour';
    if (!isLearningGuide && !isSightseeing) return '';
    const context = _activePoiKnowledgeContext();
    const candidates = _poiKnowledgeFactCandidates();
    if (!context || !candidates.length) return '';
    const stageKey = String(stage || 'generic').toLowerCase();
    const ordered = candidates
        .map(fact => ({ ...fact, score: _poiKnowledgeStageScore(fact, stageKey) }))
        .sort((a, b) => (b.score - a.score) || (a.index - b.index));
    const stagePool = ordered.filter(fact => Number(fact.index || 0) >= _poiKnowledgeStageMinIndex(stageKey));
    const pool = stagePool.length ? stagePool : ordered;
    const fresh = pool.find(fact => !_poiMemoryHasSimilarFact(fact.text)) || pool[0];
    if (!fresh) return '';
    const cleanText = String(fresh.text || '').replace(/[.!?]+$/, '').trim();
    const clip = cleanText.length > 220 ? `${cleanText.slice(0, 217)}...` : cleanText;
    const target = String(context.title || 'Zielgebiet').replace(/\s+/g, ' ').trim();
    const label = {
        greeting: 'Vorschau',
        boarding: 'Vorschau',
        in_sight: 'Anflug',
        entry: 'Zielgebiet',
        result: 'Fazit',
        generic: 'Kontext'
    }[stageKey] || 'Kontext';
    if (isSightseeing) {
        return ` POI-KONTEXT (${label}, Quelle: akzeptierte Wiki-Basis zu ${target}): Wenn es natuerlich passt, erwaehne hoechstens einen kurzen Kontextpunkt als persoenliche Beobachtung, nicht als Fuehrung: ${clip}. Wiederhole keine bereits genannte Zahl, Nutzung oder Landmarke und erfinde keine Zusatzdaten.`;
    }
    return ` WISSENS-FAKTENQUEUE (${label}, Quelle: akzeptierte Wiki-Basis zu ${target}): Nutze genau diesen Fakt, falls er natuerlich passt, und erfinde keine Zusatzdaten: ${clip}. Wiederhole keine bereits genannte Zahl, Nutzung oder Landmarke.`;
}

function _poiKnowledgeRichFactCount(stage = 'generic') {
    const context = _activePoiKnowledgeContext();
    const candidates = _poiKnowledgeFactCandidates();
    const total = Math.max(
        candidates.length,
        Number.isFinite(Number(context?.selectedFacts)) ? Math.round(Number(context.selectedFacts)) : 0
    );
    const s = String(stage || 'generic').toLowerCase();
    if (s === 'entry') {
        if (total >= 8) return 3;
        if (total >= 5) return 2;
        return 1;
    }
    if (s === 'result') {
        if (total >= 7) return 2;
        return 1;
    }
    return 1;
}

function _poiKnowledgeFactSequenceHint(stage = 'generic') {
    if (_activeTaskDomain() !== 'poi_learning_guide') return '';
    const context = _activePoiKnowledgeContext();
    const candidates = _poiKnowledgeFactCandidates();
    if (!context || !candidates.length) return '';
    const stageKey = String(stage || 'generic').toLowerCase();
    const maxFacts = Math.max(1, Math.min(3, _poiKnowledgeRichFactCount(stageKey)));
    if (maxFacts <= 1) return _poiKnowledgeFactHint(stageKey);
    const ordered = candidates
        .map(fact => ({ ...fact, score: _poiKnowledgeStageScore(fact, stageKey) }))
        .sort((a, b) => (b.score - a.score) || (a.index - b.index));
    const stagePool = ordered.filter(fact => Number(fact.index || 0) >= _poiKnowledgeStageMinIndex(stageKey));
    const pool = stagePool.length ? stagePool : ordered;
    const selected = [];
    const seenTopics = new Set();
    for (const fact of pool) {
        if (_poiMemoryHasSimilarFact(fact.text)) continue;
        const topic = String(fact.topic || 'general').toLowerCase();
        if (seenTopics.has(topic) && selected.length < Math.min(2, maxFacts)) continue;
        selected.push(fact);
        seenTopics.add(topic);
        if (selected.length >= maxFacts) break;
    }
    for (const fact of pool) {
        if (selected.length >= maxFacts) break;
        if (selected.some(x => x.text === fact.text)) continue;
        if (_poiMemoryHasSimilarFact(fact.text)) continue;
        selected.push(fact);
    }
    if (!selected.length) return _poiKnowledgeFactHint(stageKey);
    if (selected.length === 1) return _poiKnowledgeFactHint(stageKey);
    const target = String(context.title || 'Zielgebiet').replace(/\s+/g, ' ').trim();
    const label = stageKey === 'result' ? 'Fazit' : 'Zielgebiet';
    const facts = selected.map((fact, index) => {
        const cleanText = String(fact.text || '').replace(/[.!?]+$/, '').trim();
        const clip = cleanText.length > 180 ? `${cleanText.slice(0, 177)}...` : cleanText;
        return `${index + 1}. ${clip}`;
    }).join(' ');
    return ` WISSENS-FAKTENQUEUE (${label}, Quelle: akzeptierte Wiki-Basis zu ${target}): Es gibt hier genug Stoff; nutze ${selected.length} kurze, unterschiedliche Fakten als kleinen Erzaehlbogen und erfinde keine Zusatzdaten: ${facts}. Wiederhole keine bereits genannte Zahl, Nutzung oder Landmarke.`;
}

function _poiKnowledgeQueueContextLine() {
    if (_activeTaskDomain() !== 'poi_learning_guide') return '';
    const context = _activePoiKnowledgeContext();
    if (!context) return '';
    const target = String(context.title || 'Zielgebiet').replace(/\s+/g, ' ').trim();
    const count = Number.isFinite(Number(context.selectedFacts)) ? Math.round(Number(context.selectedFacts)) : _poiKnowledgeFactCandidates().length;
    return `WISSENSQUELLE: ${target}; akzeptierte Wiki-Faktenbasis mit ${Math.max(1, count)} nutzbaren Fakten. Konkrete Fakten nur aus WISSENS-FAKTENQUEUE-Zeilen verwenden, nicht frei ergaenzen. Start/Anflug maximal ein neuer Fakt; im Zielgebiet bei reichhaltiger Basis 2-3 kurze Fakten als Erzaehlbogen.`;
}

function _poiSightseeingKnowledgeContextLine() {
    if (_activeTaskDomain() !== 'sightseeing_tour') return '';
    const context = _activePoiKnowledgeContext();
    if (!context) return '';
    const target = String(context.title || 'Zielgebiet').replace(/\s+/g, ' ').trim();
    const count = Number.isFinite(Number(context.selectedFacts)) ? Math.round(Number(context.selectedFacts)) : _poiKnowledgeFactCandidates().length;
    return `SIGHTSEEING-POI-KONTEXT: Zu ${target} liegt akzeptierter POI-Kontext mit ${Math.max(1, count)} nutzbaren Fakten vor. Nutze ihn nur als kleine persoenliche Beobachtung, maximal ein neuer Punkt pro Voice-Moment, und wiederhole keine bereits erwaehnte Zahl, Nutzung oder Landmarke. Keine freie Ortsgeschichte erfinden.`;
}

function _poiKnowledgeTellMoreAvailable() {
    if (_activeTaskDomain() !== 'poi_learning_guide') return false;
    if (typeof window.missionRuntimeIsActive === 'function' && !window.missionRuntimeIsActive()) return false;
    if (!window.activePassenger || !_missionHasPax()) return false;
    return _poiKnowledgeManualFactCandidates().length > 0;
}

function _poiKnowledgeFreshFactCount() {
    const candidates = _poiKnowledgeManualFactCandidates();
    return candidates.filter(fact => (
        !_poiKnowledgeManualFactIndices.has(_poiKnowledgeFactKey(fact))
        && !_poiMemoryHasSimilarFact(fact.text)
    )).length;
}

function _poiKnowledgeManualFactClip(text = '') {
    const clean = _poiKnowledgeCleanFactText(text).replace(/[.!?]+$/, '').trim();
    if (clean.length <= 340) return clean;
    const clipped = clean.slice(0, 337).replace(/\s+\S*$/, '').trim();
    return clipped || clean.slice(0, 337).trim();
}

function _poiKnowledgeNextManualFact() {
    const context = _activePoiKnowledgeContext();
    if (!context) return null;
    _poiKnowledgeSyncContext(context);
    const candidates = _poiKnowledgeManualFactCandidates();
    const fresh = candidates.find(fact => (
        !_poiKnowledgeManualFactIndices.has(_poiKnowledgeFactKey(fact))
        && !_poiMemoryHasSimilarFact(fact.text)
    ));
    if (!fresh) return null;
    _poiKnowledgeManualFactIndices.add(_poiKnowledgeFactKey(fresh));
    return fresh;
}

function _poiKnowledgeTargetName(context = null) {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    return String(context?.title || md.poiName || md.targetName || 'dem Ziel')
        .replace(/\s+/g, ' ')
        .trim();
}

function _paxTargetGeoContext() {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const contract = md.missionContract || window.activeMissionContract || null;
    return md.targetGeoContext || contract?.targetGeoContext || md.missionTruth?.targetGeoContext || contract?.missionTruth?.targetGeoContext || null;
}

function _targetContextFactCandidates() {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const contract = md.missionContract || window.activeMissionContract || null;
    const truth = md.missionTruth || contract?.missionTruth || null;
    const geo = _paxTargetGeoContext();
    const anchors = geo?.anchors || {};
    const out = [];
    const seen = new Set();
    const add = (value) => {
        const text = String(value || '').replace(/\s+/g, ' ').trim();
        if (text.length < 24) return;
        const key = text.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(text.length > 190 ? `${text.slice(0, 187)}...` : text);
    };
    _paxMissionPlanFactSources().forEach(add);
    const anchorFact = (key, label, verb = 'liegt') => {
        const a = anchors?.[key];
        if (!a?.present) return;
        const dist = Number(a.distM);
        const bearing = Number(a.bearingDeg);
        const distTxt = Number.isFinite(dist) ? `etwa ${Math.round(dist)} Meter` : 'in Zielnaehe';
        const rel = _paxCardinalGerman(bearing);
        const relTxt = rel ? ` ${rel}` : '';
        const name = String(a.name || '').replace(/\s+/g, ' ').trim();
        const nameTxt = name && !/^(road|path|water|forest|meadow|farmland|terrain|railway|power)$/i.test(name) ? ` (${name})` : '';
        add(`${label}${nameTxt} ${verb} ${distTxt}${relTxt} vom Ziel und ist als Lagebezug aus der Luft brauchbar.`);
    };
    anchorFact('railway', 'Eine Bahnlinie', 'verlaeuft');
    anchorFact('terrain', 'Eine markante Gelaendemarke', 'liegt');
    anchorFact('viewpoint', 'Ein Aussichtspunkt', 'liegt');
    anchorFact('water', 'Ein Gewaesser oder Uferbereich', 'liegt');
    anchorFact('forest', 'Eine Waldkante', 'liegt');
    anchorFact('road', 'Eine Strasse oder Zufahrt', 'liegt');
    anchorFact('path', 'Ein Weg oder Pfad', 'liegt');
    anchorFact('meadow', 'Eine offene Wiese', 'liegt');
    anchorFact('farmland', 'Offenes Kulturland', 'liegt');
    anchorFact('power', 'Eine bestaetigte Stromtrasse', 'liegt');
    const prominence = truth?.targetProminence;
    if (prominence?.level && prominence?.reason) {
        add(`Das Ziel ist visuell ${String(prominence.level)} auffaellig: ${String(prominence.reason).replace(/\s+/g, ' ').trim()}.`);
    }
    _paxConfirmedVisualLandmarks(750)
        .filter(lm => !_paxMemoryMentionsLandmark(lm))
        .slice(0, 4)
        .forEach(lm => {
            const name = String(lm.name || lm.label || lm.kind || 'Landmarke').replace(/\s+/g, ' ').trim();
            const dist = Number.isFinite(Number(lm.distM)) ? `etwa ${Math.round(Number(lm.distM))} Meter` : 'in Zielnaehe';
            const rel = lm.relFromTarget ? ` ${lm.relFromTarget}` : '';
            add(`${name} ist eine bestaetigte visuelle Referenz ${dist}${rel} vom Ziel.`);
        });
    return out.filter(x => !_poiMemoryHasSimilarFact(x) && !_poiMemoryHasCue(x));
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
        if (m === 'result') return ' Drift-Guard (Survey): Abschluss mit Datenguete, Abdeckung und naechstem Auswertungsschritt. Keine Schadensdiagnose, keine Story-, Historiker- oder Sightseeing-Formulierungen.';
        if (m === 'progress') return ' Drift-Guard (Survey): Nur Survey-Logik, Linien/Orbit, Hoehenstabilitaet, Ueberlappung, Abdeckung und Datenqualitaet. Keine Ortsanekdoten, keine Risse/Schaeden.';
        return ' Drift-Guard (Survey): Technisch-praezise Vermessungs-/Dokumentationssprache. Keine Begeisterungs- oder Tourismusformeln, keine SAR-/Inspektionsdramatik. Arbeitsmuster nur als geplante Linie oder Orbit nennen, nicht als bereits gepruefte Pattern-Wertung.';
    }
    if (td === 'poi_learning_guide') {
        if (m === 'result') return ' Drift-Guard (Lern-Guide): Abschluss mit 1-2 klaren Fakten/Einordnung und einem ruhigen Weiterflug-Hinweis. Du erklaerst dem Piloten die Gegend; nicht sagen, dass du selbst fuer spaetere Touren lernst. Keine Arbeitsanweisung, keine Einsatz-/Inspektionssprache. Keine unbestaetigten Spezial-Landmarken als roten Faden weiterfuehren.';
        if (m === 'progress') return ' Drift-Guard (Lern-Guide): Nur Fakten, Kontext und Orientierung zum Ziel. Du bist Guide fuer den Piloten, kein angehender Guide im Trainingsflug. Keine Checklisten, keine Mess-/Schadenssprache. Keine unbestaetigten Spezial-Landmarken als roten Faden weiterfuehren.';
        return ' Drift-Guard (Lern-Guide): Bildungsorientiert und anschaulich. Du erklaerst Ziel und Umgebung fuer den Piloten. Keine Formulierungen wie "ich lerne fuer spaetere Touren" oder "Gelaende abspeichern". Keine Instruktoranweisungen, keine feste Arbeitshoehe verlangen, kein SAR-/Fire-/Inspektions-Ton. Keine Strommasten, Windraeder oder andere Spezial-Landmarken nennen, ausser sie sind das Ziel oder sicher bestaetigt.';
    }
    if (td === 'sightseeing_tour') {
        if (m === 'result') return ' Drift-Guard (Sightseeing): Abschluss als warmer Blickmoment mit entspannter Rueckkehr. Keine Woerter wie fertig, abgearbeitet, Befund, Daten, Dokumentation, Erfassung, Inspektion oder Lagebild.';
        if (m === 'progress') return ' Drift-Guard (Sightseeing): Nur Aussicht, Orientierung, Erinnerungsfotos und ruhige Beobachtung. Keine Arbeits-, Einsatz-, Vermessungs- oder Instruktor-Sprache.';
        return ' Drift-Guard (Sightseeing): Persoenlicher Rundflugston. Keine Arbeitsanweisung, keine feste Arbeitshoehe verlangen, keine Erfassung/Dokumentation/Lagebild/Inspektion. Zielbereich nur als Blickmoment aus der Luft erzaehlen, nicht als Bodenaktionsort.';
    }
    if (td === 'news_coverage') {
        if (m === 'result') return ' Drift-Guard (News): Abschluss als kurze sachliche Lagezusammenfassung. Kein Einsatzabschluss wie SAR, kein Touri-Ton.';
        if (m === 'progress') return ' Drift-Guard (News): Nenne nur beobachtbare Fakten/Lagepunkte. Keine technische Schadensbewertung.';
        return ' Drift-Guard (News): Nuechtern und beobachtend, faktenbasiert. Keine Sightseeing-Sprache, keine Fachinspektion, keine Rollenmischung mit SAR/Fire.';
    }
    if (td === 'media_photo') {
        if (m === 'result') return ' Drift-Guard (Foto/Film): Abschluss ueber verwertbares Bildmaterial, Motive und Weitergabe an Redaktion/Gemeinde/Auftraggeber. Kein Sightseeing-Fazit, keine technische Befundsprache.';
        if (m === 'progress') return ' Drift-Guard (Foto/Film): Nur Bildserie, Motiv, Perspektive, Licht, Ortsbezug und Wiedererkennungswert. Keine Aussicht-geniessen-Sprache, keine Inspektion.';
        return ' Drift-Guard (Foto/Film): Bildredaktionell und zweckbezogen. Keine persoenliche Ausflugserzaehlung, keine Einsatz- oder Inspektionssprache.';
    }
    if (td === 'historian_guided_tour') {
        if (m === 'result') return ' Drift-Guard (Historiker): Abschluss als historische Ortslesart mit kurzem Takeaway und Rueckflughinweis. Kein Sightseeing-Fazit, keine technische Befundsprache.';
        if (m === 'progress') return ' Drift-Guard (Historiker): Nur historische Einordnung, Ortsbild, alte Wege, Lagebezug oder fruehere Nutzung. Keine Foto-, Einsatz- oder Inspektionssprache.';
        return ' Drift-Guard (Historiker): Historisch-bildend und anschaulich. Keine Sightseeing-Formel, keine Arbeitsanweisung, keine technische Bewertung.';
    }
    return '';
}

function _targetFactHint() {
    const td = _activeTaskDomain();
    if (/^(search_and_rescue|fire_watch|mapping_survey|news_coverage)$/.test(td)) return '';
    if (_activeAptTrainingPlan()) return '';
    if (td === 'poi_learning_guide') {
        const knowledgeHint = _poiKnowledgeFactHint('generic');
        if (knowledgeHint) return knowledgeHint;
    }
    const raw = document.getElementById('wikiDestDescText')?.innerText?.trim() || '';
    const contextFact = _targetContextFactCandidates().find(s => !_poiMemoryHasSimilarFact(s) && !_poiMemoryHasCue(s)) || '';
    if (!raw) {
        return contextFact ? ` Sachlicher Ziel-/Umfeld-Fakt (wenn passend kurz einbauen): ${contextFact}.` : '';
    }
    if (/warte auf daten|lade ziel-info|nicht geladen|keine regionalen/i.test(raw)) {
        return contextFact ? ` Sachlicher Ziel-/Umfeld-Fakt (wenn passend kurz einbauen): ${contextFact}.` : '';
    }
    const cleaned = raw.replace(/\s+/g, ' ').trim();
    // Filter internal/source status text so it never leaks into spoken prompts.
    if (/(wikipedia|wiki-daten|fetch-fehler)/i.test(cleaned)) {
        return contextFact ? ` Sachlicher Ziel-/Umfeld-Fakt (wenn passend kurz einbauen): ${contextFact}.` : '';
    }
    if (/(konnte(n)?\s+nicht|nicht\s+abrufbar|nicht\s+geladen|fehler)/i.test(cleaned)) {
        return contextFact ? ` Sachlicher Ziel-/Umfeld-Fakt (wenn passend kurz einbauen): ${contextFact}.` : '';
    }
    const pickedSentence = cleaned
        .split(/[.!?]/)
        .map(s => s.trim())
        .filter(s => s.length >= 28)
        .find(s => !_poiMemoryHasSimilarFact(s) && !_poiMemoryHasCue(s)) || '';
    if (!pickedSentence && !contextFact) return '';
    const picked = pickedSentence || contextFact;
    const clip = picked.length > 180 ? `${picked.slice(0, 177)}...` : picked;
    return ` Sachlicher Ziel-/Umfeld-Fakt (wenn passend kurz einbauen): ${clip}.`;
}

function _factKeywords(text = '') {
    const stop = new Set(['eine', 'einer', 'einem', 'einen', 'fuer', 'für', 'fur', 'oder', 'und', 'sind', 'sein', 'wird', 'hier', 'dort', 'diese', 'dieser', 'dieses', 'durch', 'nicht', 'auch', 'nach', 'ziel', 'zielgebiet']);
    return String(text || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9äöüß]+/g, ' ')
        .split(/\s+/)
        .map(w => w.trim())
        .filter(w => w.length >= 5 && !stop.has(w))
        .slice(0, 12);
}

function _poiMemoryHasSimilarFact(fact = '') {
    if (!_isPOIMission()) return false;
    const words = _factKeywords(fact);
    if (words.length < 4) return false;
    const mem = [
        _poiNarrativeMemory.pre,
        _poiNarrativeMemory.entry,
        _poiNarrativeMemory.done,
        _poiKnowledgeSpokenMemory
    ].join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!mem.trim()) return false;
    const overlap = words.filter(w => mem.includes(w)).length;
    return overlap >= Math.min(4, Math.ceil(words.length * 0.45));
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
    const shouldShow = !!_lastPaxText || (!!_fireScenario() && _fireMissionRuntimeActive()) || _missionActionMenuAvailable() || _poiKnowledgeTellMoreAvailable();
    widget.style.display = shouldShow ? 'flex' : 'none';
    if (shouldShow) {
        _refreshPoiKnowledgeGuideMenu();
        _refreshFireMissionMenu();
        _refreshMissionActionMenu();
        _ensurePaxWidgetOnScreen(true);
    }
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

    const knowledgeMenu = document.createElement('div');
    knowledgeMenu.id = 'paxKnowledgeGuideMenu';
    knowledgeMenu.style.cssText = `
        display:none; margin-top:10px; padding-top:9px; border-top:1px solid #244562;
        grid-template-columns:1fr; gap:6px;
    `;
    knowledgeMenu.innerHTML = `
        <button type="button" id="paxKnowledgeTellMoreBtn" class="pax-fire-btn pax-knowledge-action-btn" onclick="window.paxKnowledgeTellMore && paxKnowledgeTellMore()">Erzähl mal</button>
    `;

    const fireMenu = document.createElement('div');
    fireMenu.id = 'paxFireMissionMenu';
    fireMenu.style.cssText = `
        display:none; margin-top:10px; padding-top:9px; border-top:1px solid #244562;
        grid-template-columns:1fr; gap:6px;
    `;
    fireMenu.innerHTML = `
        <button type="button" class="pax-fire-btn" onclick="window.fireMissionReportSmokeVisible && fireMissionReportSmokeVisible()">Rauch in Sicht</button>
        <button type="button" class="pax-fire-btn" onclick="window.fireMissionReportNoSmoke && fireMissionReportNoSmoke()">Kein Rauch sichtbar</button>
        <button type="button" class="pax-fire-btn" onclick="window.fireMissionPositionReport && fireMissionPositionReport()">Missionsstatus</button>
        <div id="paxFireMissionDebug" class="pax-fire-debug" style="display:none;">
            <div id="paxFireMissionDebugStatus" class="pax-fire-debug-status"></div>
            <button type="button" class="pax-fire-btn pax-fire-debug-btn" onclick="window.fireMissionDebugForceSmokeAndFire && fireMissionDebugForceSmokeAndFire()">Test: Rauch + Feuer</button>
            <button type="button" class="pax-fire-btn pax-fire-debug-btn" onclick="window.fireMissionDebugForceFireOnly && fireMissionDebugForceFireOnly()">Test: Nur Feuer</button>
            <button type="button" class="pax-fire-btn pax-fire-debug-btn" onclick="window.missionSceneSpawn && missionSceneSpawn('debug-scene-spawn')">Test: Feuerwehr Szene</button>
            <button type="button" class="pax-fire-btn pax-fire-debug-btn" onclick="window.missionSceneClear && missionSceneClear('debug-scene-clear')">Test: Szene entfernen</button>
            <button type="button" class="pax-fire-btn pax-fire-debug-btn" onclick="window.fireMissionDebugClearSmoke && fireMissionDebugClearSmoke()">Test: Rauch entfernen</button>
        </div>
    `;

    const missionMenu = document.createElement('div');
    missionMenu.id = 'paxMissionActionMenu';
    missionMenu.style.cssText = `
        display:none; margin-top:10px; padding-top:9px; border-top:1px solid #244562;
        grid-template-columns:1fr; gap:6px;
    `;
    missionMenu.innerHTML = `
        <button type="button" id="paxMissionStatusBtn" class="pax-fire-btn pax-mission-action-btn" onclick="window.paxMissionStatusReport && paxMissionStatusReport()">Missionsstatus</button>
        <button type="button" id="paxMissionOrientationBtn" class="pax-fire-btn pax-mission-action-btn" onclick="window.paxMissionOrientationHelp && paxMissionOrientationHelp()">Orientierung</button>
        <button type="button" id="paxPoiFoundBtn" class="pax-fire-btn pax-mission-action-btn" onclick="window.paxMissionReportTargetFound && paxMissionReportTargetFound()">Fund melden</button>
        <button type="button" id="paxAptWellbeingBtn" class="pax-fire-btn pax-mission-action-btn" onclick="window.paxAptWellbeingReport && paxAptWellbeingReport()">Wohlbefinden</button>
        <button type="button" id="paxCargoConditionBtn" class="pax-fire-btn pax-mission-action-btn" onclick="window.paxCargoConditionReport && paxCargoConditionReport()">Ladung</button>
        <button type="button" id="paxWeatherReactionBtn" class="pax-fire-btn pax-mission-action-btn" onclick="window.paxWeatherReactionReport && paxWeatherReactionReport()">Wetter</button>
    `;

    panel.appendChild(closeBtn);
    panel.appendChild(nameEl);
    panel.appendChild(textEl);
    panel.appendChild(knowledgeMenu);
    panel.appendChild(fireMenu);
    panel.appendChild(missionMenu);

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
    const host = widget.parentElement;
    const hostRect = (host && host !== document.body && host !== document.documentElement)
        ? host.getBoundingClientRect()
        : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const margin = 8;
    const panelOpen = !!panel && panel.style.display !== 'none';
    const btnW = btn.offsetWidth || 48;
    const btnH = btn.offsetHeight || 48;
    const reqW = panelOpen ? Math.max(panel.offsetWidth || 280, btnW) : btnW;
    const reqH = panelOpen ? (btnH + 8 + (panel.offsetHeight || 0)) : btnH;

    const hostWidth = Math.max(reqW + margin * 2, Number(hostRect.width) || window.innerWidth);
    const hostHeight = Math.max(reqH + margin * 2, Number(hostRect.height) || window.innerHeight);
    const maxLeft = Math.max(margin, hostWidth - reqW - margin);
    const maxTop = Math.max(margin, hostHeight - reqH - margin);
    const relLeft = rect.left - (Number(hostRect.left) || 0);
    const relTop = rect.top - (Number(hostRect.top) || 0);
    const left = Math.max(margin, Math.min(relLeft, maxLeft));
    const top = Math.max(margin, Math.min(relTop, maxTop));

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
    _refreshPoiKnowledgeGuideMenu();
    _refreshFireMissionMenu();
    _refreshMissionActionMenu();

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
        _refreshFireMissionMenu();
        _refreshMissionActionMenu();
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

function _firePersistState() {
    try {
        if (typeof saveMissionState === 'function') saveMissionState();
        else if (typeof debouncedSaveMissionState === 'function') debouncedSaveMissionState();
    } catch (_) {}
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

function _fireSpeakText(text, eventLabel = 'Feuerwache') {
    const epoch = _paxMissionEpoch;
    const clean = _normalizeSpokenText(text);
    if (!clean) return;
    const pax = window.activePassenger || null;
    const speakerSnapshot = pax ? {
        name: pax.name || '',
        role: pax.role || '',
        gender: pax.gender || '',
        roleProfile: pax.roleProfile || '',
        taskDomain: pax.taskDomain || ''
    } : null;
    _lastSpokenText = clean;
    _lastSpokenSpeaker = speakerSnapshot;
    _capturePoiNarrativeMemory(eventLabel, clean);
    _showPaxMessage(clean, eventLabel);
    if (!_paxVoiceEnabled) return;
    const run = async () => {
        if (epoch !== _paxMissionEpoch) return;
        try { await _playTextAsTTS(clean, speakerSnapshot, epoch); }
        catch (e) { _paxLog(`Fire-Mission TTS Fehler: ${e.message || e}`, 'warn'); }
    };
    _paxSpeechQueue = _paxSpeechQueue.then(run, run);
}

function _refreshFireMissionMenu() {
    const menu = document.getElementById('paxFireMissionMenu');
    if (!menu) return;
    const fs = _fireScenario();
    const active = !!fs && _fireMissionRuntimeActive();
    menu.style.display = active ? 'grid' : 'none';
    const debugBox = document.getElementById('paxFireMissionDebug');
    const debugStatus = document.getElementById('paxFireMissionDebugStatus');
    const debugActive = active && typeof window.fireMissionDebugEnabled === 'function' && window.fireMissionDebugEnabled();
    if (debugBox) debugBox.style.display = debugActive ? 'grid' : 'none';
    if (debugStatus && debugActive) {
        debugStatus.textContent = typeof window.fireMissionSmokeDebugSummary === 'function'
            ? window.fireMissionSmokeDebugSummary()
            : 'Debug aktiv.';
    }
    if (!active) return;
    const nameEl = document.getElementById('paxVoiceName');
    const textEl = document.getElementById('paxVoiceText');
    if (nameEl && !nameEl.textContent) {
        const pax = window.activePassenger;
        nameEl.textContent = pax ? `${pax.name} · Feuerwache` : 'Feuerwache';
    }
    if (textEl && !textEl.textContent) {
        textEl.textContent = 'Feuermeldung aktiv. Lagebeobachtung laeuft.';
    }
}

window.fireMissionRefreshDebugStatus = function() {
    _refreshFireMissionMenu();
};

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

window.fireMissionPositionReport = function() {
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
};

window.fireMissionReportNoSmoke = function() {
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
};

window.fireMissionReportSmokeVisible = function() {
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
};

// ─── GENERIC MISSION ACTION BUTTONS ─────────────────────────────────────────

function _activeMissionData() {
    return (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
}

function _activeMissionContractData() {
    const md = _activeMissionData();
    let contract = md.missionContract || window.activeMissionContract || null;
    if (!contract) {
        try { contract = JSON.parse(localStorage.getItem('ga_active_mission_contract') || 'null'); } catch (_) { contract = null; }
    }
    return contract && typeof contract === 'object' ? contract : {};
}

function _activeCargoText() {
    const md = _activeMissionData();
    const contract = _activeMissionContractData();
    return String(contract?.cargoText || md.cargoText || document.getElementById('mWeight')?.innerText || '').trim();
}

function _activePaxText() {
    const md = _activeMissionData();
    const contract = _activeMissionContractData();
    return String(contract?.paxText || md.paxText || document.getElementById('mPay')?.innerText || '').trim();
}

function _cargoMissionFocus() {
    const md = _activeMissionData();
    const task = _activeTaskDomain();
    const cargo = _activeCargoText().toLowerCase();
    const paxText = _activePaxText();
    const noPax = /^\s*0\s*PAX\b/i.test(paxText);
    const cat = String(md.cat || md.missionContract?.category || '').toLowerCase();
    return noPax
        || task === 'cargo_fragile'
        || cat === 'cargo'
        || /(fracht|ladung|cargo|box|kiste|sensor|scanner|kamera|gimbal|medizin|probe|equipment|ausruest|ausrüst|werkzeug|material)/i.test(cargo);
}

function _missionActionMenuAvailable() {
    if (_fireScenario() && _fireMissionRuntimeActive()) return false;
    const md = _activeMissionData();
    if (!md || (!md.start && !md.dest && !md.poiName && !window.activeMissionContract)) return false;
    if (typeof window.missionRuntimeIsActive === 'function' && !window.missionRuntimeIsActive()) return false;
    const hasPax = !!window.activePassenger && _missionHasPax();
    if (_isPOIMission()) return hasPax;
    return hasPax || _cargoMissionFocus();
}

function _refreshPoiKnowledgeGuideMenu() {
    const menu = document.getElementById('paxKnowledgeGuideMenu');
    if (!menu) return;
    const active = _poiKnowledgeTellMoreAvailable();
    menu.style.display = active ? 'grid' : 'none';
    const btn = document.getElementById('paxKnowledgeTellMoreBtn');
    if (!btn) return;
    const remaining = active ? _poiKnowledgeFreshFactCount() : 0;
    btn.disabled = false;
    btn.title = remaining > 0
        ? `${remaining} weitere gesicherte Fakten vorlesen`
        : 'Keine frischen Fakten mehr; der Guide meldet das kurz.';
}

function _activeBushMissionSpec() {
    const contract = _activeMissionContractData();
    const bush = contract?.bush;
    return bush && typeof bush === 'object' ? bush : null;
}

function _isBushAdventureMission() {
    const bush = _activeBushMissionSpec();
    const id = String(bush?.profileId || bush?.id || '').toLowerCase();
    return id === 'bush_scenic_hopper';
}

function _isBushVoiceMission() {
    const md = _activeMissionData();
    const contract = _activeMissionContractData();
    if (String(md?.missionType || '').toLowerCase() === 'bush') return true;
    if (String(contract?.mode || '').toUpperCase() === 'BUSH') return true;
    return !!_activeBushMissionSpec();
}

function _bushVoiceToneLine() {
    if (!_isBushVoiceMission()) return '';
    if (_isBushAdventureMission()) {
        return 'BUSH-TON: Locker, bodenstaendig und wildnisnah. Weniger citymaessig, weniger Event-Sprech, kein Reiseprospekt und kein Grossstadt-Slang. Gute Bilder sind Canyon, Fluss, Tal, Strip, Lodge, Holzsteg, Kiefern, Kies, Abendlicht, Camp oder Rueckkehr in die Ruhe draussen. Kurz, glaubwuerdig und direkt bleiben.';
    }
    return 'BUSH-TON: Direkt, bodenstaendig und draussen-erfahren. Weniger akademisch, weniger erklaerend, eher praktisch und klar. Kurze konkrete Bilder aus Strip, Bahn, Tal, Hang, Wald, Wildnis, Wetter, Ladung oder Rueckkehr in die Zivilisation sind gut. Kein Gutachten-, Prospekt- oder Behoerdenton.';
}

function _bushPickupPassengerPerspectiveLine() {
    const active = _activeBushPickupPassengerContract();
    if (!active || !window.activePassenger) return '';
    const role = String(window.activePassenger?.role || active.bush?.pickupRole || 'Pickup-Gast').trim();
    const isAptCharterPickup = String(active?.bush?.profileId || '').toLowerCase() === 'apt_charter_pickup';
    const pickupPlace = String(active.bush?.targetRef?.name || active.contract?.dest || (isAptCharterPickup ? 'dem Zielplatz' : 'dem Zielstrip')).trim();
    const homePlace = String(active.bush?.homeRef?.name || active.contract?.start || 'dem Heimatplatz').trim();
    const storyLine = _bushPickupStoryAnchorLine(active, window.activePassenger);
    return `${isAptCharterPickup ? 'APT-CHARTER-PICKUP-PERSPEKTIVE' : 'BUSH-PICKUP-PERSPEKTIVE'}: Du bist der abgeholte Passagier (${role}). Du wartest nicht mehr draußen, sondern bist nach dem Pickup an Bord auf dem Rückflug von ${pickupPlace} nach ${homePlace}. Sprich nie als Pilot, Abholer, Lademeister, Bodencrew oder Dispatcher. Sage nicht, dass du "den Gast", "den Passagier" oder "ihn" eingesammelt hast; du bist selbst dieser Gast.${storyLine ? ` ${storyLine}` : ''}`;
}

function _bushPickupVoiceText(text = '') {
    return String(text || '')
        .replace(/\bfuer\b/g, 'für')
        .replace(/\bFuer\b/g, 'Für')
        .replace(/\bzurueck\b/g, 'zurück')
        .replace(/\bZurueck\b/g, 'Zurück')
        .replace(/\bRueck/g, 'Rück')
        .replace(/\brueck/g, 'rück')
        .replace(/\bnaechst/g, 'nächst')
        .replace(/\bNaechst/g, 'Nächst')
        .replace(/\bGelaende/g, 'Gelände')
        .replace(/\bgelaende/g, 'gelände')
        .replace(/\bGelaendewagen\b/g, 'Geländewagen')
        .replace(/\bPruef/g, 'Prüf')
        .replace(/\bpruef/g, 'prüf')
        .replace(/\bgeprueft\b/g, 'geprüft')
        .replace(/\bMaengel/g, 'Mängel')
        .replace(/\bmaengel/g, 'mängel')
        .replace(/\bUeber/g, 'Über')
        .replace(/\bueber/g, 'über')
        .replace(/\bAusruestung\b/g, 'Ausrüstung')
        .replace(/\bausruestung\b/g, 'ausrüstung')
        .replace(/\bdraussen\b/g, 'draußen')
        .replace(/\bDraussen\b/g, 'Draußen')
        .replace(/\bGeraet/g, 'Gerät')
        .replace(/\bgeraet/g, 'gerät')
        .replace(/geraet\b/g, 'gerät')
        .replace(/\bHandgeraet/g, 'Handgerät')
        .replace(/\bLuecken\b/g, 'Lücken')
        .replace(/\bluecken\b/g, 'lücken')
        .replace(/Lueck/g, 'Lück')
        .replace(/lueck/g, 'lück')
        .replace(/\bGaeste/g, 'Gäste')
        .replace(/\bgaeste/g, 'gäste')
        .replace(/\s+/g, ' ')
        .trim();
}

function _bushPickupStoryData(active = null, pax = null) {
    const bush = active?.bush || _activeBushPickupPassengerContract()?.bush || null;
    const followUp = _activeMissionFollowUpContext();
    const followUpPickupStory = (followUp?.pickupStory && typeof followUp.pickupStory === 'object') ? followUp.pickupStory : {};
    const followUpFrame = (followUp?.storyFrame && typeof followUp.storyFrame === 'object') ? followUp.storyFrame : {};
    const followUpSourceMission = (followUp?.sourceMission && typeof followUp.sourceMission === 'object') ? followUp.sourceMission : {};
    const story = (bush?.pickupStory && typeof bush.pickupStory === 'object')
        ? bush.pickupStory
        : ((pax?.pickupStory && typeof pax.pickupStory === 'object') ? pax.pickupStory : followUpPickupStory);
    const personName = _bushPickupVoiceText(story.personName || pax?.name || bush?.pickupLabel || 'Pickup-Gast').replace(/\s*\([^)]*\)\s*$/, '').trim();
    const role = _bushPickupVoiceText(story.role || pax?.role || bush?.pickupRole || 'Pickup-Gast');
    const pickupPlace = String(bush?.targetRef?.name || active?.contract?.dest || 'dem Zielstrip').trim();
    const homePlace = String(bush?.homeRef?.name || active?.contract?.start || 'dem Heimatplatz').trim();
    return {
        personName,
        role,
        pickupPlace,
        homePlace,
        exactWhere: _bushPickupVoiceText(story.exactWhere || `am Treffpunkt am Striprand bei ${pickupPlace}`),
        whyThere: _bushPickupVoiceText(story.whyThere || followUpPickupStory.whyThere || followUpFrame.incidentContext || ''),
        returnReason: _bushPickupVoiceText(story.returnReason || followUpPickupStory.returnReason || followUpFrame.whyNow || ''),
        boardingCue: _bushPickupVoiceText(story.boardingCue || followUpPickupStory.boardingCue || ''),
        departureCue: _bushPickupVoiceText(story.departureCue || followUpPickupStory.departureCue || ''),
        sourceTitle: _bushPickupVoiceText(followUpSourceMission.title || ''),
        sourceStory: _bushPickupVoiceText(followUpSourceMission.story || ''),
        betweenFlights: _bushPickupVoiceText(followUpFrame.incidentContext || followUpPickupStory.whyThere || story.whyThere || ''),
        whyNow: _bushPickupVoiceText(followUpFrame.whyNow || story.returnReason || followUpPickupStory.returnReason || ''),
        nextStep: _bushPickupVoiceText(followUpFrame.soughtOutcome || followUpFrame.completionSignal || '')
    };
}

function _bushPickupSentence(text = '') {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    return /[.!?]$/.test(s) ? s : `${s}.`;
}

function _bushPickupReturnSentence(returnReason = '') {
    const reason = String(returnReason || '').replace(/\s+/g, ' ').trim();
    if (!reason) return '';
    return _bushPickupSentence(reason);
}

function _bushPickupStoryAnchorLine(active = null, pax = null) {
    const d = _bushPickupStoryData(active, pax);
    const parts = [
        `STORY-ANKER: ${d.personName}${d.role ? ` (${d.role})` : ''}`,
        `Treffpunkt=${d.exactWhere}`,
        d.whyThere ? `Warum dort=${d.whyThere}` : '',
        d.returnReason ? `Warum zurück nach ${d.homePlace}=${d.returnReason}` : ''
    ].filter(Boolean);
    return parts.join(' | ');
}

function _bushPickupBetweenFlightsLine(active = null, pax = null) {
    const d = _bushPickupStoryData(active, pax);
    const parts = [
        d.sourceTitle ? `Vorheriger Auftrag=${d.sourceTitle}` : '',
        d.sourceStory ? `Erster Flug=${d.sourceStory}` : '',
        d.betweenFlights ? `Zwischen den Flügen=${d.betweenFlights}` : '',
        d.whyNow ? `Warum jetzt=${d.whyNow}` : '',
        d.nextStep ? `Nächster Schritt=${d.nextStep}` : ''
    ].filter(Boolean);
    return parts.length ? `FOLLOW-UP-ZWISCHENZEIT: ${parts.join(' | ')}` : '';
}

function _bushCargoPickupLabel(active = null, cargoCtx = null) {
    try {
        const manifest = (typeof window.missionCargoGetManifestSnapshot === 'function')
            ? window.missionCargoGetManifestSnapshot()
            : null;
        const pickupItem = Array.isArray(manifest?.items)
            ? manifest.items.find(item => item?.pickupLocation === 'target' && !_missionManifestItemIsPassenger(item))
            : null;
        const manifestLabel = String(pickupItem?.storyName || pickupItem?.label || '').trim();
        if (manifestLabel) return manifestLabel;
    } catch (_) {}
    const bushLabel = String(active?.bush?.pickupLabel || '').trim();
    if (bushLabel) return bushLabel;
    const cargoText = String(cargoCtx?.cargoText || _activeCargoText() || '').trim();
    if (cargoText && !/^[-–—]$/.test(cargoText)) return cargoText;
    return 'Rueckholfracht';
}

function _bushCargoPickupFollowUpLine() {
    const followUp = _activeMissionFollowUpContext();
    if (!followUp) return '';
    const sourceMission = (followUp.sourceMission && typeof followUp.sourceMission === 'object') ? followUp.sourceMission : {};
    const frame = (followUp.storyFrame && typeof followUp.storyFrame === 'object') ? followUp.storyFrame : {};
    const parts = [
        sourceMission.title ? `Vorheriger Auftrag=${_bushPickupVoiceText(sourceMission.title)}` : '',
        sourceMission.story ? `Supply-Hinflug=${_bushPickupVoiceText(sourceMission.story)}` : '',
        frame.incidentContext ? `Was vor Ort passierte=${_bushPickupVoiceText(frame.incidentContext)}` : '',
        frame.whyNow ? `Warum jetzt zurück=${_bushPickupVoiceText(frame.whyNow)}` : '',
        frame.soughtOutcome || frame.completionSignal ? `Handoff=${_bushPickupVoiceText(frame.soughtOutcome || frame.completionSignal)}` : ''
    ].filter(Boolean);
    return parts.length ? `FOLLOW-UP-CARGO-STORY: ${parts.join(' | ')}` : '';
}

function _cargoOnlyVoiceContext() {
    if (_missionHasPax() || !_cargoMissionFocus()) return null;
    const md = _activeMissionData();
    const contract = _activeMissionContractData();
    const bush = _activeBushMissionSpec();
    const isBushCargoPickup = !!(
        bush
        && String(bush.targetMode || '') === 'strip_then_return'
        && String(bush.pickupKind || '').toLowerCase() === 'cargo'
    );
    const story = _sanitizePaxSoftPoiStory(_getMissionStory());
    const cargoText = isBushCargoPickup
        ? _bushCargoPickupLabel({ contract, bush }, null)
        : (_activeCargoText() || 'wichtige Fracht');
    const paxText = _activePaxText() || '0 PAX';
    const start = String(
        isBushCargoPickup
            ? (bush?.targetRef?.name || md.poiName || md.dest || contract.dest || 'Zielstrip')
            : (md.start || contract.start || 'Startplatz')
    ).trim();
    const dest = String(
        isBushCargoPickup
            ? (bush?.homeRef?.name || md.start || contract.start || 'Heimatplatz')
            : (md.poiName || md.dest || contract.dest || 'Zielflugplatz')
    ).trim();
    const dist = String(md.dist || contract.dist || '?').trim();
    const taskDomain = _normTaskDomain(contract?.taskDomain || md?.missionContract?.taskDomain || 'general');
    const contractSummary = String(contract?.summary || '').trim();
    const aptArrivalLine = _aptArrivalContextLine(md, contract);
    return {
        md,
        contract,
        bush,
        story,
        cargoText,
        paxText,
        start,
        dest,
        dist,
        taskDomain,
        contractSummary,
        aptArrivalLine,
        isBushCargoPickup
    };
}

function _cargoMissionSpeaker(kind = 'boarding') {
    const cargoCtx = _cargoOnlyVoiceContext();
    const arrivalPlan = _activeAptArrivalPlan();
    if (kind === 'farewell') {
        const role = String(arrivalPlan?.expectedBy || arrivalPlan?.roleLabel || 'Frachtkontakt am Ziel').trim();
        return {
            name: role,
            role,
            gender: 'male',
            roleProfile: 'cargo_receiver_v1',
            taskDomain: cargoCtx?.taskDomain || 'cargo_fragile'
        };
    }
    return {
        name: 'Lademeister',
        role: 'Lademeister',
        gender: 'male',
        roleProfile: 'cargo_loadmaster_v1',
        taskDomain: cargoCtx?.taskDomain || 'cargo_fragile'
    };
}

function _refreshMissionActionMenu() {
    const menu = document.getElementById('paxMissionActionMenu');
    if (!menu) return;
    const active = _missionActionMenuAvailable();
    menu.style.display = active ? 'grid' : 'none';
    if (!active) return;

    const isPoi = _isPOIMission();
    const cargoFocus = _cargoMissionFocus();
    const hasPax = !!window.activePassenger && _missionHasPax();
    const sarPoi = isPoi && hasPax && _activeTaskDomain() === 'search_and_rescue';
    const sarHeli = !!(typeof window.missionIsSarHeliMission === 'function' && window.missionIsSarHeliMission((typeof currentMissionData !== 'undefined' ? currentMissionData : null)));
    const sarHeliProgress = sarHeli && typeof window.missionSarHeliProgressSnapshot === 'function'
        ? window.missionSarHeliProgressSnapshot()
        : null;
    const sarHeliFoundReported = !!(sarHeliProgress?.targetConfirmed || sarHeliProgress?.patientLoaded);
    const showWeather = !!_missionWeatherReactionLine(window.lastLiveFlightData || {});
    const setVisible = (id, visible) => {
        const el = document.getElementById(id);
        if (el) el.style.display = visible ? 'block' : 'none';
    };
    setVisible('paxMissionStatusBtn', isPoi && hasPax);
    setVisible('paxMissionOrientationBtn', isPoi && hasPax);
    setVisible('paxPoiFoundBtn', sarPoi && !_poiSatisfied && !_poiAborted && (!sarHeli || !sarHeliFoundReported));
    setVisible('paxAptWellbeingBtn', !isPoi && hasPax && !cargoFocus);
    setVisible('paxCargoConditionBtn', !isPoi && cargoFocus);
    setVisible('paxWeatherReactionBtn', showWeather && (hasPax || cargoFocus));

    const nameEl = document.getElementById('paxVoiceName');
    const textEl = document.getElementById('paxVoiceText');
    if (nameEl && !nameEl.textContent) {
        const pax = window.activePassenger;
        nameEl.textContent = pax ? `${pax.name} · Mission` : 'Mission';
    }
    if (textEl && !textEl.textContent) {
        textEl.textContent = isPoi ? 'Mission laeuft. Status und Orientierung sind abrufbar.' : 'Mission laeuft. Zustand und Wetter sind abrufbar.';
    }
}

function _missionActionContext(flightData = null) {
    const md = _activeMissionData();
    const dest = _getDestCoords();
    const pos = window.lastLiveGpsPos || {};
    const fd = flightData || window.lastLiveFlightData || {};
    const lat = Number(pos.lat);
    const lon = Number(pos.lon);
    const targetName = md.poiName || md.targetName || md.dest || 'Ziel';
    const out = {
        md,
        fd,
        targetName,
        dest,
        hasPosition: false,
        mslFt: Number.isFinite(Number(fd.mslFt ?? pos.alt ?? fd.alt)) ? Math.round(Number(fd.mslFt ?? pos.alt ?? fd.alt)) : null,
        aglFt: Number.isFinite(Number(fd.aglFt)) ? Math.round(Number(fd.aglFt)) : null
    };
    if (!dest || !Number.isFinite(lat) || !Number.isFinite(lon)) return out;
    const distNm = _haversineNm(lat, lon, dest.lat, dest.lon);
    const bearingDeg = _bearingDeg(lat, lon, dest.lat, dest.lon);
    const hdg = Number(fd.hdg || fd.heading || fd.trackDeg || fd.trkDeg || pos.hdg || bearingDeg);
    return {
        ...out,
        hasPosition: true,
        lat,
        lon,
        distNm,
        roundedDistNm: Math.max(0, Math.round(distNm)),
        bearingDeg,
        roundedBearingDeg: Math.round((((bearingDeg % 360) + 360) % 360)),
        clockPos: _relativeClockPos(bearingDeg, hdg),
        hdg
    };
}

function _missionVectorText(ctx) {
    if (!ctx?.hasPosition) return 'Mir fehlen gerade Live-Positionsdaten vom Tracker.';
    const nm = ctx.roundedDistNm <= 0 ? 'unter 1 NM' : `${ctx.roundedDistNm} NM`;
    return `Steuerkurs ${String(ctx.roundedBearingDeg).padStart(3, '0')} Grad, Entfernung ${nm}.`;
}

function _missionOrientationFactLine(ctx = null) {
    const mapPlace = _paxMapPlaceOrientationLine();
    if (mapPlace && (!ctx?.hasPosition || Number(ctx.distNm) > 6)) {
        const near = _paxNearLandmarkOrientationLine();
        return [mapPlace, near].filter(Boolean).join('\n');
    }
    const near = _paxNearLandmarkOrientationLine();
    if (near) return near;
    if (mapPlace) return mapPlace;
    return '';
}

function _missionStatusFacts(ctx) {
    const pax = window.activePassenger || {};
    const sarHeli = !!(typeof window.missionIsSarHeliMission === 'function' && window.missionIsSarHeliMission((typeof currentMissionData !== 'undefined' ? currentMissionData : null)));
    if (sarHeli) {
        const progress = typeof window.missionSarHeliProgressSnapshot === 'function' ? window.missionSarHeliProgressSnapshot() : null;
        const parts = [];
        if (ctx?.hasPosition) parts.push(`Distanz zur Fundstelle ${ctx.distNm.toFixed(1)} NM, Richtung ${String(ctx.roundedBearingDeg).padStart(3, '0')} Grad`);
        if (progress?.patientLoaded) parts.push(`Status: Patient aufgenommen, Ziel ${_sarHeliHospitalName()}`);
        else if (progress?.targetConfirmed) parts.push(`Status: Fund bestätigt, Bergung läuft, Position ruhig halten`);
        else parts.push('Status: Such-/Fundphase, Fundmeldung oder Auto-Markierung offen');
        const wx = _weatherContext(ctx?.fd || window.lastLiveFlightData || {});
        if (wx) parts.push(wx);
        return parts.join(' | ');
    }
    if (_activeTaskDomain() === 'mapping_survey') {
        const survey = _surveyPatternProgressSummary(ctx);
        if (survey) return survey;
    }
    const chainSummary = _poiChainProgressSummary(ctx);
    if (chainSummary) return chainSummary;
    const radius = Number(pax.targetRadiusNm || 1.5) || 1.5;
    const targetAlt = Number(pax.targetAltFt || 0);
    const dwellReq = Number(pax.targetDwellMin || 0) * 60;
    const dwell = Math.max(0, Math.round(_poiDwellSec || 0));
    const parts = [];
    if (ctx?.hasPosition) parts.push(`Distanz zum Ziel ${ctx.distNm.toFixed(1)} NM, Richtung ${String(ctx.roundedBearingDeg).padStart(3, '0')} Grad, Lage ${ctx.clockPos}`);
    if (_poiSatisfied) parts.push('Status: POI-Aufgabe abgeschlossen, Rueckflug/Weiterflug freigegeben');
    else if (_poiAborted) parts.push('Status: abgebrochen, Rueckflug sinnvoll');
    else if (_poiInRadius) parts.push(`Status: im Zielradius (${radius.toFixed(1)} NM), Datenaufnahme laeuft`);
    else parts.push('Status: noch im Anflug zum Zielgebiet');
    if (dwellReq > 0) parts.push(`Verweilzeit ${dwell}/${Math.round(dwellReq)} Sekunden`);
    if (targetAlt > 0 && ctx?.mslFt != null) {
        const diff = ctx.mslFt - targetAlt;
        if (Math.abs(diff) <= 150) parts.push(`Hoehe passt: ${ctx.mslFt} ft MSL bei Ziel ${Math.round(targetAlt)} ft`);
        else parts.push(`Hoehenabweichung: ${Math.abs(Math.round(diff))} ft ${diff > 0 ? 'zu hoch' : 'zu niedrig'} gegen Ziel ${Math.round(targetAlt)} ft`);
    }
    const wx = _weatherContext(ctx?.fd || window.lastLiveFlightData || {});
    if (wx) parts.push(wx);
    return parts.join(' | ');
}

function _missionScoreRegisterEvent(key, active, severe = false, bucket = 'pilot') {
    const score = _missionComfortScoreState();
    const flags = score.flags || (score.flags = {});
    if (active && !flags[key]) {
        if (bucket === 'weather') {
            score.weatherEvents += 1;
            if (severe) score.weatherSevere += 1;
        } else {
            score.pilotEvents += 1;
            if (severe) score.pilotSevere += 1;
            if (key === 'g') score.gEvents += 1;
            if (key === 'bank') score.bankEvents += 1;
            if (key === 'descent') score.descentEvents += 1;
            if (_cargoMissionFocus()) score.cargoRiskEvents += severe ? 2 : 1;
        }
    }
    flags[key] = !!active;
}

function _recordMissionComfortSample(flightData) {
    if (!flightData) return;
    const score = _missionComfortScoreState();
    score.samples += 1;
    const g = Number(flightData.gForce || 1.0);
    const bank = Math.abs(Number(flightData.bankDeg || 0));
    const wind = Number(flightData.windKts || 0);
    const gust = Number(flightData.windGustKts || 0);
    const gustSpread = (Number.isFinite(gust) && Number.isFinite(wind)) ? Math.max(0, gust - wind) : 0;
    const turb = Number(flightData.turbulencePct || 0);
    const precip = Number(flightData.precipRateMmH || 0);
    const vs = Number.isFinite(flightData.vsFpm) ? Number(flightData.vsFpm) : Number(flightData.vs || 0);

    if (Number.isFinite(g)) score.maxG = Math.max(score.maxG || 1.0, g);
    if (Number.isFinite(bank)) score.maxBankDeg = Math.max(score.maxBankDeg || 0, bank);
    if (Number.isFinite(vs)) score.maxDescentFpm = Math.min(score.maxDescentFpm || 0, vs);
    if (Number.isFinite(wind)) score.maxWindKts = Math.max(score.maxWindKts || 0, wind);
    if (Number.isFinite(gustSpread)) score.maxGustSpreadKts = Math.max(score.maxGustSpreadKts || 0, gustSpread);
    if (Number.isFinite(turb)) score.maxTurbulencePct = Math.max(score.maxTurbulencePct || 0, turb);
    if (Number.isFinite(precip)) score.maxPrecipRate = Math.max(score.maxPrecipRate || 0, precip);

    _missionScoreRegisterEvent('g', g >= 1.45, g >= 1.75, 'pilot');
    _missionScoreRegisterEvent('bank', bank >= 30, bank >= 45, 'pilot');
    _missionScoreRegisterEvent('descent', vs <= -1500, vs <= -2300, 'pilot');
    _missionScoreRegisterEvent('wind', wind >= 22, wind >= 32, 'weather');
    _missionScoreRegisterEvent('gust', gustSpread >= 10, gustSpread >= 18, 'weather');
    _missionScoreRegisterEvent('turb', turb >= 35, turb >= 60, 'weather');
    _missionScoreRegisterEvent('precip', precip >= 1.0 || flightData.precipActive === true, precip >= 4.0, 'weather');
}

function _missionComfortSummary() {
    const score = _missionComfortScoreState();
    const pilotPenalty = score.pilotEvents * 9 + score.pilotSevere * 10;
    const weatherPenalty = score.weatherEvents * 3 + score.weatherSevere * 5;
    const cargoPenalty = (_cargoMissionFocus() ? score.cargoRiskEvents * 8 : 0);
    const comfortScore = Math.max(0, Math.min(100, 100 - pilotPenalty - weatherPenalty - cargoPenalty));
    const mood = comfortScore >= 88 ? 'sehr zufrieden'
        : comfortScore >= 72 ? 'zufrieden'
        : comfortScore >= 55 ? 'etwas angespannt'
        : comfortScore >= 35 ? 'unzufrieden'
        : 'ziemlich durchgeschuettelt';
    return {
        ...score,
        comfortScore,
        mood,
        maxG: Number(score.maxG || 1).toFixed(2),
        maxBankDeg: Math.round(score.maxBankDeg || 0),
        maxDescentFpm: Math.round(score.maxDescentFpm || 0),
        maxWindKts: Math.round(score.maxWindKts || 0),
        maxGustSpreadKts: Math.round(score.maxGustSpreadKts || 0),
        maxTurbulencePct: Math.round(score.maxTurbulencePct || 0),
        maxPrecipRate: Number(score.maxPrecipRate || 0).toFixed(1)
    };
}

function _missionWeatherReactionLine(flightData = null) {
    const fd = flightData || window.lastLiveFlightData || {};
    const parts = [];
    const wind = Number(fd.windKts || 0);
    const gust = Number(fd.windGustKts || 0);
    const spread = (Number.isFinite(gust) && Number.isFinite(wind)) ? Math.max(0, gust - wind) : 0;
    const turb = Number(fd.turbulencePct || 0);
    const precip = Number(fd.precipRateMmH || 0);
    if (wind >= 20) parts.push(`Wind ${Math.round(wind)} kt`);
    if (spread >= 8) parts.push(`Boeen plus ${Math.round(spread)} kt`);
    if (turb >= 30) parts.push(`Turbulenz ${Math.round(turb)} Prozent`);
    if (precip >= 0.5 || fd.precipActive === true) parts.push(precip >= 0.5 ? `Regen/Niederschlag ${precip.toFixed(1)} mm/h` : 'Niederschlag');
    if (fd.inCloud === true) parts.push('in Wolken');
    return parts.join(', ');
}

function _paxSpeakTextDirect(text, eventLabel = 'Mission') {
    const epoch = _paxMissionEpoch;
    const clean = _normalizeSpokenText(text);
    if (!clean) return;
    const speaker = _speakerSnapshotForActivePax();
    _lastSpokenText = clean;
    _lastSpokenSpeaker = speaker;
    _capturePoiNarrativeMemory(eventLabel, clean);
    _showPaxMessage(clean, eventLabel);
    if (!_paxVoiceEnabled) return;
    const run = async () => {
        if (epoch !== _paxMissionEpoch) return;
        try { await _playTextAsTTS(clean, speaker, epoch); }
        catch (e) { _paxLog(`Mission-Action TTS Fehler: ${e.message || e}`, 'warn'); }
    };
    _paxSpeechQueue = _paxSpeechQueue.then(run, run);
}

function _missionActionSpeak(prompt, eventLabel, fallbackText) {
    _refreshMissionActionMenu();
    if (prompt && _getApiKey()) return _speakAndShow(prompt, eventLabel);
    _paxSpeakTextDirect(fallbackText || 'Ich habe gerade nicht genug Kontext fuer eine belastbare Rueckmeldung.', eventLabel);
    return Promise.resolve();
}

window.paxKnowledgeTellMore = function() {
    const context = _activePoiKnowledgeContext();
    if (!_poiKnowledgeTellMoreAvailable()) {
        _paxSpeakTextDirect('Dazu habe ich gerade keine gesicherte Faktenbasis geladen.', 'Erzähl mal');
        return;
    }
    const fact = _poiKnowledgeNextManualFact();
    const target = _poiKnowledgeTargetName(context);
    if (!fact) {
        _paxSpeakTextDirect(`Mehr weiß ich dazu leider auch nicht. Die gesicherten Punkte zu ${target} haben wir damit durch.`, 'Erzähl mal');
        _refreshPoiKnowledgeGuideMenu();
        return;
    }
    const clip = _poiKnowledgeManualFactClip(fact.text);
    const intro = _poiKnowledgeManualFactIndices.size <= 1 ? 'Klar. Noch ein Punkt:' : 'Noch ein Punkt:';
    _paxSpeakTextDirect(`${intro} ${clip}.`, 'Erzähl mal');
    _refreshPoiKnowledgeGuideMenu();
};

function _poiManualReportContext(flightData = null) {
    const ctx = _missionActionContext(flightData);
    const confirmCoords = _activePoiConfirmCoords();
    const confirmRangeNm = _poiManualConfirmRangeNm();
    if (!ctx?.hasPosition || !confirmCoords) {
        return {
            ...ctx,
            confirmCoords,
            confirmRangeNm,
            confirmDistNm: null,
            nearEnough: false
        };
    }
    const confirmDistNm = _haversineNm(ctx.lat, ctx.lon, confirmCoords.lat, confirmCoords.lon);
    return {
        ...ctx,
        confirmCoords,
        confirmRangeNm,
        confirmDistNm,
        nearEnough: confirmDistNm <= confirmRangeNm
    };
}

function _poiManualReportSubject() {
    const frame = _activeMissionStoryFrame();
    const detail = String(frame?.subjectDetail || frame?.focusSubject || '').trim();
    if (detail) return detail;
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    return String(md.poiName || md.targetName || 'den Suchhinweis').trim() || 'den Suchhinweis';
}

function _poiManualFoundPrompt(ctx) {
    const base = _baseContext();
    if (!base) return null;
    const frame = _activeMissionStoryFrame();
    const subject = _poiManualReportSubject();
    const clueLine = Array.isArray(frame?.visibleClueCandidates) && frame.visibleClueCandidates.length
        ? frame.visibleClueCandidates.join(', ')
        : 'keine Zusatzhinweise';
    const distLine = Number.isFinite(Number(ctx?.confirmDistNm))
        ? `Wir sind nah genug am Missionsanker (${ctx.confirmDistNm.toFixed(2)} NM).`
        : 'Wir sind nah genug am Missionsanker.';
    return `${base}

Button-Frage: Der Pilot meldet eine moegliche Sichtung und bittet um sofortige Bestaetigung.
Missionsanker: ${ctx?.confirmCoords?.name || ctx?.targetName || 'Zielgebiet'}
${distLine}
Zu bestaetigen: ${subject}
Letzte Lage: ${String(frame?.lastSeenContext || frame?.incidentContext || 'n/a').trim() || 'n/a'}
Vermutung: ${String(frame?.probableScenario || frame?.soughtOutcome || 'n/a').trim() || 'n/a'}
Moegliche Hinweise: ${clueLine}
Antworte als Passagier/Rollenperson mit einer klaren positiven Sichtbestaetigung. Sage, dass der Fund bzw. belastbare Sichtkontakt an die Einsatzleitung geht und der Rueckflug bzw. die naechste Phase beginnen kann. Kein Zweifel, keine neue Suche eroeffnen. Max 2 Saetze.${_toneHint()}`;
}

function _poiManualNotFoundPrompt(ctx) {
    const base = _baseContext();
    if (!base) return null;
    const frame = _activeMissionStoryFrame();
    const subject = _poiManualReportSubject();
    const distNm = Number(ctx?.confirmDistNm);
    const distLine = Number.isFinite(distNm)
        ? `Aktuell sind wir noch ${distNm.toFixed(1)} NM vom Missionsanker entfernt; fuer eine belastbare Bestaetigung ist das zu frueh.`
        : 'Aktuell fehlt noch die noetige Naehe zum Missionsanker.';
    return `${base}

Button-Frage: Der Pilot fragt, ob die vermisste Person bzw. der Suchhinweis bereits bestaetigt ist.
${distLine}
Zu bestaetigen waere: ${subject}
Letzte Lage: ${String(frame?.lastSeenContext || frame?.incidentContext || 'n/a').trim() || 'n/a'}
Antworte klar, dass du noch keinen positiven Sichtkontakt bestaetigen kannst und weiter suchen willst. Bitte um weiteres Suchmuster oder noch etwas Naeherung, aber ohne neue Story aufzumachen. Max 2 Saetze.${_toneHint()}`;
}

function _poiManualFoundFallback(ctx) {
    const frame = _activeMissionStoryFrame();
    const subject = _poiManualReportSubject();
    const outcome = String(frame?.soughtOutcome || '').trim();
    return `${subject} passt jetzt zur gemeldeten Lage, ich bestaetige den Fund. Ich gebe den Sichtkontakt an die Einsatzleitung weiter${outcome ? ` und habe damit ${outcome.charAt(0).toLowerCase()}${outcome.slice(1)}` : ''}; wir koennen den Rueckflug beginnen.`;
}

function _poiManualNotFoundFallback(ctx) {
    const subject = _poiManualReportSubject();
    const distNm = Number(ctx?.confirmDistNm);
    if (Number.isFinite(distNm)) {
        return `Negativ, ich kann ${subject} von hier noch nicht belastbar bestaetigen. Wir sind noch etwa ${distNm.toFixed(1)} NM zu weit weg vom Suchkern, lass uns weiter suchen.`;
    }
    return `Negativ, ich kann ${subject} noch nicht bestaetigen. Lass uns das Suchmuster weiterfliegen, bis wir naeher am Zielkern sind.`;
}

function _sarHeliHospitalName() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const ref = md?.sarHeli?.hospitalRef || md?.missionContract?.sarHeli?.hospitalRef || window.activeMissionContract?.sarHeli?.hospitalRef || null;
    return String(ref?.name || ref?.icao || 'das Krankenhaus-Helipad').trim() || 'das Krankenhaus-Helipad';
}

function _sarHeliTargetName() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    return String(md?.sarHeli?.targetRef?.name || md?.poiName || md?.targetName || 'die Fundstelle').trim() || 'die Fundstelle';
}

window.triggerPaxSarHeliFoundConfirmed = function(ctx = {}) {
    _refreshPaxWidgetVisibility();
    _paxSpeakTextDirect(
        `Fund bestätigt bei ${_sarHeliTargetName()}. Gehe jetzt in die Bergung: landen oder ruhig hovern, nah an der Person bleiben und die Maschine stabil halten.`,
        'Fund bestätigt'
    );
};

window.triggerPaxSarHeliTargetMarked = function(ctx = {}) {
    _refreshPaxWidgetVisibility();
    _paxSpeakTextDirect(
        `Ziel gesichtet und mit Rauch markiert. Bitte jetzt zur Markierung einrichten, landen oder stabil hovern und langsam genug bleiben.`,
        'Ziel markiert'
    );
};

window.triggerPaxSarHeliHoldReady = function(ctx = {}) {
    _paxSpeakTextDirect(
        'Das passt, wir sind nah genug und die Position ist gut. Halte jetzt ruhig, wir übernehmen die Aufnahme.',
        'Bergung halten'
    );
};

window.triggerPaxSarHeliPatientLoaded = function(ctx = {}) {
    const hospital = String(ctx?.hospitalRef?.name || _sarHeliHospitalName()).trim();
    _poiSatisfied = true;
    _paxAtTargetDone = true;
    if (typeof window.missionPersistRuntimeSnapshot === 'function') window.missionPersistRuntimeSnapshot('sar-heli-patient-loaded-voice', { immediate: true });
    _refreshPaxWidgetVisibility();
    _paxSpeakTextDirect(
        `Patient ist verladen. Steig sauber aus der Fundstelle raus und flieg direkt ${hospital ? `zum medizinischen Ziel ${hospital}` : 'zum Krankenhaus-Helipad'}.`,
        'Patient verladen'
    );
};

window.paxMissionStatusReport = function() {
    const ctx = _missionActionContext();
    if (!_isPOIMission()) {
        _paxSpeakTextDirect('Das ist keine POI-Mission. Fuer diesen Flug ist eher Wohlbefinden, Ladung oder Wetter relevant.', 'Missionsstatus');
        return;
    }
    if (_activeTaskDomain() === 'mapping_survey') {
        _paxSpeakTextDirect(_surveyPatternStatusText(ctx), 'Missionsstatus');
        return;
    }
    if (_poiChainActiveSpec()) {
        _paxSpeakTextDirect(_poiChainStatusText(ctx), 'Missionsstatus');
        return;
    }
    const facts = _missionStatusFacts(ctx);
    const base = _baseContext();
    const prompt = base ? `${base}

Button-Frage: Der Pilot fragt nach dem aktuellen Missionsstatus.
Live-Fakten: ${facts}
Antworte als Passagier/Rollenperson dynamisch zum Kontext: Anflug, Datenaufnahme, Hoehenkorrektur, Abschluss oder Rueckflug. Wenn die Hoehe deutlich nicht passt, darfst du freundlich hoeher/tiefer bitten. Keine internen Variablennamen. Max 2 Saetze.${_toneHint()}` : null;
    const fallback = _poiSatisfied
        ? 'Mission ist abgeschlossen, ich habe alles. Wir koennen zurueck beziehungsweise weiter zum Platz.'
        : `${_missionVectorText(ctx)} ${_poiInRadius ? 'Datenaufnahme laeuft, halte den Flug ruhig und stabil.' : 'Wir sind noch im Anflug, ich melde mich am Ziel.'}`;
    _missionActionSpeak(prompt, 'Missionsstatus', fallback);
};

window.paxMissionOrientationHelp = function(_cityRetry = false) {
    const ctx = _missionActionContext();
    if (!_isPOIMission()) {
        _paxSpeakTextDirect('Orientierungshilfe ist aktuell nur fuer POI-Ziele sinnvoll.', 'Orientierung');
        return;
    }
    if (_activeTaskDomain() === 'mapping_survey') {
        _paxSpeakTextDirect(_surveyPatternOrientationText(ctx), 'Orientierung');
        return;
    }
    if (_poiChainActiveSpec()) {
        _paxSpeakTextDirect(_poiChainOrientationText(ctx), 'Orientierung');
        return;
    }
    if (!_cityRetry && !_paxCityDatasetAvailable() && typeof loadGlobalCities === 'function') {
        loadGlobalCities().finally(() => window.paxMissionOrientationHelp(true));
        return;
    }
    const base = _baseContext();
    const vector = _missionVectorText(ctx);
    const factLine = _missionOrientationFactLine(ctx);
    const prompt = base ? `${base}

Button-Frage: Der Pilot bittet um Orientierungshilfe zum POI.
Pflichtdaten: ${vector}
Ziel: ${ctx.targetName}
${factLine || 'Keine bestaetigte Landmarke verfuegbar; beschreibe das Ziel anhand Auftrag, Zielname und Umgebung nur vorsichtig.'}
Orientierungsregel: Wenn die Entfernung groesser als 6 NM ist, nenne nach Steuerkurs/Entfernung zuerst den groben Kartenbezug zu Ort/Region. Danach darf genau ein lokaler Nahbereichs-Hinweis kommen, wenn er bestaetigt ist. Lokale Felsen, Bachnamen, Wege oder Aussichtspunkte nicht als primaere Orientierung verwenden, ausser wir sind im Nahbereich oder sie sind das Ziel selbst.
Antworte zuerst mit Steuerkurs und Entfernung in ganzen NM, danach eine kurze Zielbeschreibung oder Landmarkenhilfe. Keine langen Stories, keine erfundenen Landmarken. Max 2 Saetze.${_toneHint()}` : null;
    const fallback = factLine && /^GROBER KARTENBEZUG:/i.test(factLine)
        ? `${vector} ${factLine.split('\n')[0].replace(/^GROBER KARTENBEZUG:\s*/i, '').replace(/\s*Nutze diesen Ort.*$/i, '')}`
        : `${vector} Ziel ist ${ctx.targetName}; nutze die naechste markante Struktur im Zielgebiet als Bezug und halte weiter Ausschau.`;
    _missionActionSpeak(prompt, 'Orientierung', fallback);
};

window.paxMissionReportTargetFound = function() {
    if (!_isPOIMission() || _activeTaskDomain() !== 'search_and_rescue') {
        _paxSpeakTextDirect('Diese Schnellmeldung ist nur fuer laufende SAR-POI-Missionen gedacht.', 'Fundmeldung');
        return;
    }
    if (_poiSatisfied) {
        _paxSpeakTextDirect('Ich habe den Fund bereits bestaetigt. Wir koennen den Rueckflug oder die naechste Phase fortsetzen.', 'Fundmeldung');
        return;
    }
    if (_poiAborted) {
        _paxSpeakTextDirect('Der Auftrag ist bereits abgebrochen. Fuer diese Lage lohnt keine weitere Sichtmeldung mehr.', 'Fundmeldung');
        return;
    }
    const ctx = _poiManualReportContext();
    if (!ctx?.hasPosition || !ctx?.confirmCoords) {
        _paxSpeakTextDirect('Mir fehlt gerade die noetige Live-Position fuer eine sichere Bestaetigung. Lass uns kurz weiter im Suchraum bleiben.', 'Fundmeldung');
        return;
    }
    if (!ctx.nearEnough) {
        _paxLog(`Manuelle Fundmeldung abgelehnt | dist ${Number(ctx.confirmDistNm || 0).toFixed(2)} NM > ${ctx.confirmRangeNm.toFixed(2)} NM`, 'event');
        const prompt = _poiManualNotFoundPrompt(ctx);
        const fallback = _poiManualNotFoundFallback(ctx);
        _missionActionSpeak(prompt, 'Weiter suchen', fallback);
        return;
    }
    const sarHeli = !!(typeof window.missionIsSarHeliMission === 'function' && window.missionIsSarHeliMission((typeof currentMissionData !== 'undefined' ? currentMissionData : null)));
    if (sarHeli) {
        _poiInRadius = true;
        _poiEntryDone = true;
        _poiManuallyConfirmed = true;
        _poiLastTickTime = Date.now();
        if (!_poiEnteredAt) _poiEnteredAt = _poiLastTickTime;
        let confirmed = false;
        try {
            if (typeof window.missionSarHeliConfirmTarget === 'function') confirmed = !!window.missionSarHeliConfirmTarget('manual-found');
            if (typeof saveMissionState === 'function') saveMissionState();
            if (typeof window.missionPersistRuntimeSnapshot === 'function') window.missionPersistRuntimeSnapshot('sar-heli-manual-confirmed', { immediate: true });
        } catch (_) {}
        _paxLog(`SAR-Heli-Fundmeldung bestaetigt | dist ${Number(ctx.confirmDistNm || 0).toFixed(2)} NM <= ${ctx.confirmRangeNm.toFixed(2)} NM`, 'event');
        _refreshPaxWidgetVisibility();
        if (!confirmed) {
            if (typeof window.triggerPaxSarHeliFoundConfirmed === 'function') window.triggerPaxSarHeliFoundConfirmed(ctx);
            else _paxSpeakTextDirect('Fund bestaetigt. Bitte landen oder stabil hovern, damit wir die Person aufnehmen koennen.', 'Fund bestaetigt');
        }
        return;
    }
    _poiInRadius = true;
    _poiEntryDone = true;
    _poiSatisfied = true;
    _poiManuallyConfirmed = true;
    _paxAtTargetDone = true;
    const pax = window.activePassenger || {};
    const dwellRequired = Math.max(0, Number(pax.targetDwellMin || 0) * 60);
    _poiDwellSec = Math.max(Number(_poiDwellSec || 0), dwellRequired);
    _poiLastTickTime = Date.now();
    if (!_poiEnteredAt) _poiEnteredAt = _poiLastTickTime;
    try {
        if (typeof currentMissionData !== 'undefined' && currentMissionData) {
            currentMissionData.missionFailed = false;
            currentMissionData.missionResult = 'completed';
        }
        if (typeof saveMissionState === 'function') saveMissionState();
        if (typeof window.missionPersistRuntimeSnapshot === 'function') window.missionPersistRuntimeSnapshot('poi-manual-confirmed', { immediate: true });
    } catch (_) {}
    _paxLog(`Manuelle Fundmeldung bestaetigt | dist ${Number(ctx.confirmDistNm || 0).toFixed(2)} NM <= ${ctx.confirmRangeNm.toFixed(2)} NM`, 'event');
    _refreshPaxWidgetVisibility();
    const prompt = _poiManualFoundPrompt(ctx);
    const fallback = _poiManualFoundFallback(ctx);
    _missionActionSpeak(prompt, 'Fund bestaetigt', fallback);
};

window.paxAptWellbeingReport = function() {
    const ctx = _missionActionContext();
    const summary = _missionComfortSummary();
    const base = _baseContext();
    const wx = _missionWeatherReactionLine(ctx.fd);
    const facts = `Score ${summary.comfortScore}/100 (${summary.mood}); Pilot-Events ${summary.pilotEvents}, davon schwer ${summary.pilotSevere}; Wetter-Events ${summary.weatherEvents}, davon schwer ${summary.weatherSevere}; max G ${summary.maxG}, max Bank ${summary.maxBankDeg} Grad, max Sinken ${summary.maxDescentFpm} ft/min, Wetter: ${wx || 'unauffaellig'}.`;
    const prompt = base ? `${base}

Button-Frage: Der Pilot fragt nach dem Wohlbefinden/Zufriedenheit.
Auswertung seit Missionsstart: ${facts}
Wichtig: Turbulenzen, Boeen und Regen nicht dem Piloten anlasten; Flugweise wie harte G-Last, steile Kurven oder starker Sinkflug darfst du humorvoll bewerten. Reagiere kreativ, menschlich und passend zur Rolle. Max 2 Saetze.${_toneHint()}` : null;
    const fallback = summary.comfortScore >= 75
        ? `Mir geht es gut, Score etwa ${summary.comfortScore} von 100. Wetter war ${wx ? 'spuerbar, aber das geht nicht auf deine Kappe' : 'unauffaellig'}, die Flugweise passt.`
        : `Ich bin bei etwa ${summary.comfortScore} von 100. Die Wetteranteile zaehle ich dir nicht an, aber Kurven, G-Last oder Sinkflug haben sich schon bemerkbar gemacht.`;
    _missionActionSpeak(prompt, 'Wohlbefinden', fallback);
};

window.paxCargoConditionReport = function() {
    const ctx = _missionActionContext();
    const summary = _missionComfortSummary();
    const cargo = _activeCargoText() || 'Ladung';
    const wx = _missionWeatherReactionLine(ctx.fd);
    const isPOI = _isPOIMission();
    const missingRequired = !isPOI ? _aptMissingRequiredCargoItems() : [];
    if (!isPOI && missingRequired.length) {
        const missingText = missingRequired.slice(0, 3).join(', ');
        const prompt = `${_baseContext() || `MISSION: ${_activeMissionData().start || '?'} -> ${_activeMissionData().dest || '?'}\nAUSRUESTUNG: ${cargo}\nAUSGABE: Nur gesprochener Text, Deutsch.`}

Button-Frage: Der Pilot fragt nach der Ladung, aber die Pflichtladung wurde vor dem Start nicht geladen.
Fehlende Pflichtladung: ${missingText}
Wetter: ${wx || 'unauffaellig'}
Reagiere als Passagier kurz erschrocken und klar: Wir haben die Pflichtladung vergessen und sollten lieber umkehren, um sie abzuholen. Nenne den fehlenden Gegenstand beim Namen. Kein Vorwurf, aber deutlich besorgt. Max 2 Saetze.${_toneHint()}`;
        const fallback = missingText
            ? `Moment, ${missingText} ist ja gar nicht an Bord. Wir sollten lieber umkehren und die Ladung erst abholen, sonst koennen wir den Auftrag so nicht sauber machen.`
            : 'Moment, die Pflichtladung ist gar nicht an Bord. Wir sollten lieber umkehren und sie erst abholen, sonst koennen wir den Auftrag so nicht sauber machen.';
        _missionActionSpeak(prompt, 'Ladung', fallback);
        return;
    }
    const prompt = `${_baseContext() || `MISSION: ${_activeMissionData().start || '?'} -> ${_activeMissionData().dest || '?'}\nAUSRUESTUNG: ${cargo}\nAUSGABE: Nur gesprochener Text, Deutsch.`}

Button-Frage: Der Pilot fragt nach dem Zustand der Ladung.
Cargo: ${cargo}
Auswertung seit Missionsstart: Cargo-Risiko ${summary.cargoRiskEvents}, Pilot-Events ${summary.pilotEvents}, schwere Pilot-Events ${summary.pilotSevere}; max G ${summary.maxG}, max Bank ${summary.maxBankDeg} Grad, max Sinken ${summary.maxDescentFpm} ft/min; Wetter-Events ${summary.weatherEvents}, Wetter: ${wx || 'unauffaellig'}.
Wichtig: Turbulenzen/Regen nicht dem Piloten anlasten. Bewerte Frachtzustand kreativ passend zur Ladung, von "sitzt sauber" bis "Kaffeebecher/Proben/Kisten haben gelitten". Max 2 Saetze.${_toneHint()}`;
    const fallback = summary.cargoRiskEvents <= 1
        ? `Die Ladung sieht gut aus: ${cargo} sitzt noch sauber. Wetter war ${wx || 'kein Thema'}, nichts Kritisches.`
        : `Die Ladung hat etwas gearbeitet: ${cargo} ist noch dabei, aber ich wuerde nach der Landung Gurte und Verpackung pruefen. Wetter zaehlt nicht gegen dich, die haerteren Manoever schon eher.`;
    _missionActionSpeak(prompt, 'Ladung', fallback);
};

window.paxWeatherReactionReport = function() {
    const ctx = _missionActionContext();
    const wx = _missionWeatherReactionLine(ctx.fd);
    const base = _baseContext();
    const prompt = base ? `${base}

Button-Frage: Der Pilot fragt nach einer Reaktion auf markantes Wetter.
Live-Wetter: ${wx || _weatherContext(ctx.fd) || 'keine markanten Live-Wetterdaten'}
Reagiere auf Regen, Wind, Boeen, Wolken oder Turbulenz aus Passagier-/Rollenperspektive. Wichtig: Bei Turbulenz oder Regen keine Schuldzuweisung an den Piloten, nur Lagegefuehl und ggf. pragmatischer Wunsch nach ruhiger Fluglage. Max 2 Saetze.${_toneHint()}` : null;
    const fallback = wx
        ? `Das Wetter ist spuerbar: ${wx}. Das laste ich dir nicht an, aber ruhig und sauber geflogen bleibt jetzt Gold wert.`
        : 'Wetterseitig ist gerade nichts Markantes dabei. Von mir aus koennen wir den Flug normal fortsetzen.';
    _missionActionSpeak(prompt, 'Wetter', fallback);
};

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

function _buildIntercomChain(ctx, destination, durationSec, options = {}) {
    const withNoise = options.noise !== false;
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

    // Chain: hp → lp → ws → comp → destination
    hp.connect(lp); lp.connect(ws); ws.connect(comp); comp.connect(destination);
    if (!withNoise) return { input: hp, noise: null };

    // Static noise layer
    const noiseLen = Math.ceil(ctx.sampleRate * (durationSec + 0.5));
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) nd[i] = (Math.random() * 2 - 1) * 0.018;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.4;

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

async function _paxDecodeAudioBufferAndPlay(rawAudioBuffer, mimeType, epoch = _paxMissionEpoch, sourceLabel = 'Audio') {
    if (!_paxEpochCurrent(epoch)) return false;
    const ctx = (typeof window.paxVoiceUnlockAudio === 'function')
        ? window.paxVoiceUnlockAudio('playback')
        : window._tawsAudioCtx;
    if (!ctx) { _paxLog('AudioContext nicht verfügbar', 'warn'); return false; }
    if (ctx.state === 'suspended' || ctx.state === 'interrupted') await ctx.resume().catch(() => {});
    if (!_paxEpochCurrent(epoch)) return false;
    if (ctx.state !== 'running' && Date.now() - _paxAudioWarnedAt > 5000) {
        _paxAudioWarnedAt = Date.now();
        _paxLog(`AudioContext ist ${ctx.state}; Browser blockiert Playback moeglicherweise bis zum naechsten Klick.`, 'warn');
    }
    if (ctx.state !== 'running') {
        const recovered = await _paxEnsureAudioContextRunning(ctx);
        if (!recovered) {
            _paxLog(`Playback abgebrochen: AudioContext blieb ${ctx.state}.`, 'warn');
            return false;
        }
        _paxLog('AudioContext wieder aktiv — Playback wird fortgesetzt', 'state');
    }
    if (!_paxEpochCurrent(epoch)) return false;

    let audioBuffer = rawAudioBuffer;
    const mimeLower = String(mimeType || '').toLowerCase();
    if (!mimeType || mimeLower.includes('pcm') || mimeLower.includes('l16')) {
        const rateMatch = mimeType?.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
        _paxLog(`PCM→WAV wrap | rate: ${sampleRate} Hz | mime: ${mimeType || 'unbekannt'}`, 'audio');
        audioBuffer = _pcmToWav(rawAudioBuffer, sampleRate, 1, 16);
    }

    try {
        const decodeBuffer = audioBuffer?.slice ? audioBuffer.slice(0) : audioBuffer;
        const buf = await ctx.decodeAudioData(decodeBuffer);
        if (!_paxEpochCurrent(epoch)) return false;
        const dest = window._awmMasterGain || ctx.destination;
        const style = _normalizePaxAudioStyle(_paxAudioStyle);
        const chain = style === 'clear'
            ? { input: dest, noise: null }
            : _buildIntercomChain(ctx, dest, buf.duration, { noise: style === 'intercom_noise' });

        await new Promise(resolve => {
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(chain.input);
            _paxStopCurrentPlayback('new-playback');
            let done = false;
            let watchdog = null;
            const playback = {
                epoch,
                stop: () => {
                    try { src.stop(0); } catch (_) {}
                    try { chain.noise?.stop?.(0); } catch (_) {}
                    guardedFinish();
                }
            };
            const finish = () => {
                if (done) return;
                done = true;
                if (watchdog) clearTimeout(watchdog);
                if (_paxCurrentPlayback === playback) _paxCurrentPlayback = null;
                try { src.onended = null; } catch (_) {}
                try { src.disconnect(); } catch (_) {}
                try { chain.noise?.disconnect(); } catch (_) {}
                resolve();
            };
            src.onended = () => finish();
            src.onerror = () => finish();

            const t = ctx.currentTime + 0.1;
            const watchdogMs = Math.max(6000, Math.round((buf.duration + 2.5) * 1000));
            watchdog = setTimeout(() => {
                _paxLog(`Playback Watchdog: onended ausgeblieben nach ${watchdogMs} ms — Queue wird freigegeben`, 'warn');
                finish();
            }, watchdogMs);
            const guardedFinish = () => {
                clearTimeout(watchdog);
                finish();
            };
            src.onended = guardedFinish;
            src.onerror = guardedFinish;
            if (!_paxEpochCurrent(epoch)) {
                guardedFinish();
                return;
            }
            _paxCurrentPlayback = playback;

            try {
                src.start(t);
                if (chain.noise) {
                    chain.noise.start(t);
                    chain.noise.stop(t + buf.duration + 0.3);
                }
                _paxLog(`${_paxAudioStyleLabel(style)}-Wiedergabe (${sourceLabel}): ${buf.duration.toFixed(1)} s | audio=${ctx.state} | vol=${Number(window._awmMasterGain?.gain?.value ?? 1).toFixed(2)}`, 'audio');
            } catch (startErr) {
                _paxLog(`Playback Startfehler: ${startErr?.message || startErr}`, 'warn');
                guardedFinish();
            }
        });
        return true;
    } catch(e) {
        _paxLog(`Playback Fehler: ${e.message}`, 'warn');
        return false;
    }
}

async function _paxDecodeAndPlay(base64Audio, mimeType, epoch = _paxMissionEpoch) {
    if (!_paxEpochCurrent(epoch)) return false;
    const binary = atob(base64Audio);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return _paxDecodeAudioBufferAndPlay(bytes.buffer, mimeType, epoch, 'Gemini TTS');
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

const _paxPreparedAudio = new Map();
const _paxBoardingRecentPlayByKey = new Map();
const _PAX_STATIC_VOICE_CATALOG_URL = './audio-pax/gemini-survey-v1/catalog.json';
const _PAX_AUDIO_CUE_VARIANT_MAX = 8;
const _PAX_AUDIO_CUE_CATALOG = Object.freeze({
    none: { disabled: true, stem: '', label: 'Kein Audio-Cue' },
    photo: {
        stem: 'photo',
        aliasStems: ['foto'],
        fallbackUrls: ['./foto.mp3'],
        fallbackStems: ['foto'],
        sourceLabel: 'Foto-Sound',
        warnMissing: true,
        variantScope: 'mission',
        gain: 0.78
    },
    scan_start: { stem: 'scan-start', sourceLabel: 'Scan-Start', gain: 0.58 },
    scan_tick: { stem: 'scan-tick', sourceLabel: 'Scan-Tick', gain: 0.48 },
    data_lock: { stem: 'data-lock', sourceLabel: 'Daten-Lock', gain: 0.58 },
    point_mark: { stem: 'point-mark', sourceLabel: 'Punkt-Markierung', gain: 0.56 },
    radio_blip: { stem: 'radio-blip', sourceLabel: 'Radio-Blip', gain: 0.42 },
    handoff: { stem: 'handoff', sourceLabel: 'Uebergabe', variantScope: 'event', gain: 0.54 },
    boarding_pax: { stem: 'boarding-pax', sourceLabel: 'Pax-Boarding', variantScope: 'event', gain: 0.38 },
    deboarding_pax: { stem: 'deboarding-pax', sourceLabel: 'Pax-Deboarding', variantScope: 'event', gain: 0.38 },
    boarding_cargo: { stem: 'boarding-cargo', sourceLabel: 'Cargo-Boarding', variantScope: 'event', gain: 0.46 },
    cargo_load: { stem: 'cargo-load', sourceLabel: 'Cargo-Load', variantScope: 'event', gain: 0.62 },
    cargo_unload: { stem: 'cargo-unload', sourceLabel: 'Cargo-Unload', variantScope: 'event', gain: 0.62 },
    cargo_pickup: { stem: 'cargo-pickup', sourceLabel: 'Cargo-Pickup', variantScope: 'event', gain: 0.62 },
    cargo_drop: { stem: 'cargo-drop', sourceLabel: 'Cargo-Drop', gain: 0.72 }
});
let _paxStaticVoiceCatalogPromise = null;
const _paxStaticClipCache = new Map();
const _paxAudioCueClipPromises = new Map();
const _paxAudioCueMissingWarned = new Set();
let _paxPhotoEffectWarned = false;

function _paxStaticVoiceAssetsEnabled() {
    return localStorage.getItem('awm_pax_static_voice_assets') !== '0';
}

async function _paxLoadStaticVoiceCatalog() {
    if (!_paxStaticVoiceAssetsEnabled()) return null;
    if (_paxStaticVoiceCatalogPromise) return _paxStaticVoiceCatalogPromise;
    _paxStaticVoiceCatalogPromise = fetch(_PAX_STATIC_VOICE_CATALOG_URL, { cache: 'force-cache' })
        .then(res => res.ok ? res.json() : null)
        .catch(() => null);
    return _paxStaticVoiceCatalogPromise;
}

function _surveyPatternStaticClipKey(kind = 'event', spec = null) {
    const type = String(spec?.type || '').toLowerCase() === 'orbit' ? 'orbit' : 'scan';
    if (kind === 'survey_area_entered' || kind === 'survey_complete') return `${type}_${kind}`;
    return String(kind || '').trim();
}

function _paxStaticClipUrl(catalog, clip) {
    const rel = String(clip?.path || clip?.file || '').trim().replace(/^\.?\//, '');
    if (!rel) return '';
    const base = String(catalog?.basePath || './audio-pax/gemini-survey-v1').replace(/\/+$/, '');
    return `${base}/${rel}`;
}

function _paxPickStaticVoiceClip(catalog, clipKey, speaker = null) {
    const entry = catalog?.clips?.[clipKey];
    const takes = Array.isArray(entry?.takes) ? entry.takes.filter(Boolean) : [];
    if (!takes.length) return null;
    const preferredVoices = _ttsVoiceCandidatesForSpeaker(speaker).map(v => String(v || '').trim()).filter(Boolean);
    let pool = [];
    for (const voice of preferredVoices) {
        pool = takes.filter(t => String(t?.voice || '').toLowerCase() === voice.toLowerCase());
        if (pool.length) break;
    }
    if (!pool.length) return null;
    const seed = `${_paxMissionAudioKey(`static-${clipKey}`)}|${speaker?.name || ''}|${speaker?.role || ''}|${speaker?.roleProfile || ''}`;
    return pool[_hashStable(seed) % pool.length] || null;
}

async function _paxResolveStaticSurveyClip(kind, spec = null, speaker = null) {
    const catalog = await _paxLoadStaticVoiceCatalog();
    if (!catalog?.clips || typeof catalog.clips !== 'object') return null;
    const clipKey = _surveyPatternStaticClipKey(kind, spec);
    const clip = _paxPickStaticVoiceClip(catalog, clipKey, speaker);
    const url = _paxStaticClipUrl(catalog, clip);
    return clip && url ? { catalog, clip, clipKey, url } : null;
}

async function _paxFetchStaticClipAudio(url, mimeType = '') {
    const key = String(url || '');
    if (!key) return null;
    const cached = _paxStaticClipCache.get(key);
    if (cached?.audioBuffer) return cached;
    const res = await fetch(key, { cache: 'force-cache' }).catch(() => null);
    if (!res?.ok) return null;
    const audioBuffer = await res.arrayBuffer();
    const rec = { audioBuffer, mimeType: mimeType || res.headers.get('content-type') || '' };
    _paxStaticClipCache.set(key, rec);
    return rec;
}

function _paxDelayMs(ms, epoch = _paxMissionEpoch) {
    const wait = Math.max(0, Math.round(Number(ms) || 0));
    if (!wait) return Promise.resolve(_paxEpochCurrent(epoch));
    return new Promise(resolve => {
        setTimeout(() => resolve(_paxEpochCurrent(epoch)), wait);
    });
}

function _paxSeededInt(seed, min, max) {
    const lo = Math.round(Number(min) || 0);
    const hi = Math.round(Number(max) || lo);
    const a = Math.min(lo, hi);
    const b = Math.max(lo, hi);
    if (a === b) return a;
    return a + (_hashStable(seed) % (b - a + 1));
}

function _paxNormalizeAudioCueId(value, fallback = 'none') {
    if (value === false || value === null) return 'none';
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw || raw === '0' || raw === 'off' || raw === 'silent' || raw === 'none') return 'none';
    const id = raw.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!id) return 'none';
    return _PAX_AUDIO_CUE_CATALOG[id] ? id : _paxNormalizeAudioCueId(fallback, 'none');
}

function _paxAudioCueDef(cueId = 'none') {
    const id = _paxNormalizeAudioCueId(cueId, 'none');
    return _PAX_AUDIO_CUE_CATALOG[id] ? { id, ..._PAX_AUDIO_CUE_CATALOG[id] } : null;
}

function _paxAudioCueStemVariants(stems = []) {
    const variants = [];
    const seen = new Set();
    const add = (value) => {
        const stem = String(value || '').trim();
        if (!stem || seen.has(stem)) return;
        seen.add(stem);
        variants.push(stem);
    };
    stems.forEach(stem => {
        add(stem);
        add(String(stem || '').replace(/-/g, '_'));
        add(String(stem || '').replace(/_/g, '-'));
    });
    return variants;
}

function _paxAudioCueCandidateUrlsForStems(stems = [], roots = ['./audio-cues/'], variantMax = _PAX_AUDIO_CUE_VARIANT_MAX) {
    const urls = [];
    const seen = new Set();
    const add = (url) => {
        const clean = String(url || '').trim();
        if (!clean || seen.has(clean)) return;
        seen.add(clean);
        urls.push(clean);
    };
    const max = Math.max(0, Math.round(Number(variantMax) || 0));
    roots.forEach(root => {
        const prefix = String(root || './audio-cues/');
        stems.forEach(stemRaw => {
            const stem = String(stemRaw || '').trim();
            if (!stem) return;
            add(`${prefix}${stem}.mp3`);
            for (let idx = 1; idx <= max; idx++) add(`${prefix}${stem}${idx}.mp3`);
        });
    });
    return urls;
}

function _paxAudioCueCandidateGroups(cueId = 'none') {
    const def = _paxAudioCueDef(cueId);
    if (!def || def.disabled) return [];
    const variantMax = Number.isFinite(Number(def.variantMax)) ? Number(def.variantMax) : _PAX_AUDIO_CUE_VARIANT_MAX;
    const primaryStems = _paxAudioCueStemVariants([def.stem || def.id.replace(/_/g, '-'), def.id]
        .concat(Array.isArray(def.aliasStems) ? def.aliasStems : [])
        .map(v => String(v || '').trim())
        .filter(Boolean));
    const groups = [{
        kind: 'primary',
        urls: _paxAudioCueCandidateUrlsForStems(primaryStems, ['./audio-cues/'], variantMax)
    }];
    const fallbackUrls = [];
    (Array.isArray(def.fallbackUrls) ? def.fallbackUrls : [])
        .forEach(url => fallbackUrls.push(String(url || '').trim()));
    const fallbackStems = (Array.isArray(def.fallbackStems) ? def.fallbackStems : [])
        .map(v => String(v || '').trim())
        .filter(Boolean);
    fallbackUrls.push(..._paxAudioCueCandidateUrlsForStems(fallbackStems, ['./'], variantMax));
    if (fallbackUrls.length) groups.push({ kind: 'fallback', urls: fallbackUrls });
    return groups
        .map(group => ({ ...group, urls: Array.from(new Set(group.urls.filter(Boolean))) }))
        .filter(group => group.urls.length);
}

async function _paxResolveAudioCueClips(cueId = 'none') {
    const def = _paxAudioCueDef(cueId);
    if (!def || def.disabled) return [];
    const cacheKey = def.id;
    if (_paxAudioCueClipPromises.has(cacheKey)) return _paxAudioCueClipPromises.get(cacheKey);
    const promise = (async () => {
        const groups = _paxAudioCueCandidateGroups(def.id);
        for (const group of groups) {
            const clips = (await Promise.all(group.urls.map(async (url) => {
                const rec = await _paxFetchStaticClipAudio(url, 'audio/mpeg');
                return rec?.audioBuffer ? { url, rec, group: group.kind } : null;
            }))).filter(Boolean);
            if (clips.length) return clips;
        }
        if (def.warnMissing && !_paxAudioCueMissingWarned.has(def.id)) {
            _paxAudioCueMissingWarned.add(def.id);
            _paxLog(`Audio-Cue ${def.id} nicht gefunden (${_paxAudioCueCandidateGroups(def.id).flatMap(g => g.urls).slice(0, 3).join(', ')} ...)`, 'warn');
        }
        return [];
    })();
    _paxAudioCueClipPromises.set(cacheKey, promise);
    return promise;
}

function _paxPickAudioCueClip(cueId = 'none', clips = [], variantSeed = '') {
    const pool = Array.isArray(clips) ? clips.filter(Boolean) : [];
    if (!pool.length) return null;
    const id = _paxNormalizeAudioCueId(cueId, 'none');
    const seed = `${_paxMissionAudioKey(`cue-variant-${id}`)}|${variantSeed || 'mission'}`;
    return pool[_hashStable(seed) % pool.length] || pool[0] || null;
}

async function _paxPlayAudioCue(cueId = 'none', seed = '', options = {}, epoch = _paxMissionEpoch) {
    const def = _paxAudioCueDef(cueId);
    if (!def || def.disabled || !_paxVoiceEnabled || !_paxEpochCurrent(epoch)) return false;
    const clips = await _paxResolveAudioCueClips(def.id);
    const cueSeed = `${seed || _paxMissionAudioKey(`cue-${def.id}`)}|${def.id}`;
    const variantScope = String(options.variantScope || def.variantScope || 'mission').toLowerCase();
    const variantSeed = variantScope === 'event'
        ? String(options.variantSeed || cueSeed)
        : String(options.variantSeed || '');
    const clip = _paxPickAudioCueClip(def.id, clips, variantSeed);
    if (!clip?.rec?.audioBuffer) return false;
    const minCount = Math.max(1, Number(options.minCount || 1));
    const maxCount = Math.max(minCount, Number(options.maxCount || minCount));
    const count = _paxSeededInt(`${cueSeed}|count`, minCount, maxCount);
    const minDelay = Math.max(0, Number(options.minDelayMs ?? 0));
    const maxDelay = Math.max(minDelay, Number(options.maxDelayMs ?? minDelay));
    const gain = Number.isFinite(Number(options.gain)) ? Number(options.gain) : Number(def.gain || 0.78);
    let played = false;
    for (let idx = 0; idx < count; idx++) {
        const delay = idx === 0
            ? Math.max(0, Number(options.firstDelayMs ?? minDelay))
            : _paxSeededInt(`${cueSeed}|delay|${idx}`, minDelay, maxDelay);
        if (delay > 0) {
            const ok = await _paxDelayMs(delay, epoch);
            if (!ok) return played;
        }
        if (!_paxEpochCurrent(epoch)) return played;
        const didPlay = await _paxDecodeAudioEffectAndPlay(
            clip.rec.audioBuffer.slice(0),
            clip.rec.mimeType || 'audio/mpeg',
            epoch,
            def.sourceLabel || `Audio-Cue ${def.id}`,
            { gain }
        );
        played = played || didPlay;
    }
    if (played) _paxLog(`Audio-Cue gespielt: ${def.id} (${clip.url}, ${count}x)`, 'audio');
    return played;
}

function _paxMissionAudioCueSourceCandidates() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    return [
        md?.audioCues,
        md?.missionContract?.audioCues,
        window.activeMissionContract?.audioCues
    ].filter(source => source && typeof source === 'object');
}

function _paxFindMissionAudioCueOverride(scope = '', event = '') {
    const s = String(scope || '').trim();
    const e = String(event || '').trim();
    if (!s && !e) return undefined;
    const keys = [
        s && e ? `${s}.${e}` : '',
        s && e ? `${s}:${e}` : '',
        s && e ? `${s}_${e}` : '',
        e,
        s
    ].filter(Boolean);
    for (const source of _paxMissionAudioCueSourceCandidates()) {
        for (const key of keys) {
            if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
        }
        const nested = s ? source[s] : null;
        if (nested && typeof nested === 'object') {
            if (e && Object.prototype.hasOwnProperty.call(nested, e)) return nested[e];
            if (Object.prototype.hasOwnProperty.call(nested, 'default')) return nested.default;
        }
    }
    return undefined;
}

function _paxMissionAudioCueId(scope = '', event = '', fallbackCueId = 'none') {
    const override = _paxFindMissionAudioCueOverride(scope, event);
    return _paxNormalizeAudioCueId(override === undefined ? fallbackCueId : override, 'none');
}

window.paxResolveMissionAudioCue = function(scope = '', event = '', fallbackCueId = 'none') {
    return _paxMissionAudioCueId(scope, event, fallbackCueId);
};

window.paxPlayAudioCue = function(cueId = 'none', options = {}) {
    const id = _paxNormalizeAudioCueId(cueId, 'none');
    const seed = String(options?.seed || _paxMissionAudioKey(`manual-cue-${id}`));
    return _paxPlayAudioCue(id, seed, options || {}, _paxMissionEpoch);
};

window.paxGetAudioCueCatalog = function() {
    return Object.fromEntries(Object.entries(_PAX_AUDIO_CUE_CATALOG).map(([id, def]) => [
        id,
        {
            stem: def.stem || '',
            aliasStems: Array.isArray(def.aliasStems) ? def.aliasStems.slice() : [],
            fallbackUrls: Array.isArray(def.fallbackUrls) ? def.fallbackUrls.slice() : [],
            variantScope: def.variantScope || 'mission',
            disabled: !!def.disabled
        }
    ]));
};

async function _paxDecodeAudioEffectAndPlay(rawAudioBuffer, mimeType, epoch = _paxMissionEpoch, sourceLabel = 'Audioeffekt', options = {}) {
    if (!_paxEpochCurrent(epoch)) return false;
    const ctx = (typeof window.paxVoiceUnlockAudio === 'function')
        ? window.paxVoiceUnlockAudio('effect')
        : window._tawsAudioCtx;
    if (!ctx) return false;
    if (ctx.state === 'suspended' || ctx.state === 'interrupted') await ctx.resume().catch(() => {});
    if (ctx.state !== 'running') {
        const recovered = await _paxEnsureAudioContextRunning(ctx, 1800);
        if (!recovered) return false;
    }
    if (!_paxEpochCurrent(epoch)) return false;
    try {
        let audioBuffer = rawAudioBuffer;
        const mimeLower = String(mimeType || '').toLowerCase();
        if (!mimeType || mimeLower.includes('pcm') || mimeLower.includes('l16')) {
            const rateMatch = mimeType?.match(/rate=(\d+)/);
            const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
            audioBuffer = _pcmToWav(rawAudioBuffer, sampleRate, 1, 16);
        }
        const decodeBuffer = audioBuffer?.slice ? audioBuffer.slice(0) : audioBuffer;
        const buf = await ctx.decodeAudioData(decodeBuffer);
        if (!_paxEpochCurrent(epoch)) return false;
        await new Promise(resolve => {
            const src = ctx.createBufferSource();
            const gain = ctx.createGain();
            let done = false;
            let watchdog = null;
            const finish = () => {
                if (done) return;
                done = true;
                if (watchdog) clearTimeout(watchdog);
                try { src.onended = null; } catch (_) {}
                try { src.disconnect(); } catch (_) {}
                try { gain.disconnect(); } catch (_) {}
                resolve();
            };
            src.buffer = buf;
            const gainValue = Number.isFinite(Number(options.gain)) ? Number(options.gain) : 0.78;
            gain.gain.value = Math.max(0, Math.min(1.2, gainValue));
            src.connect(gain);
            gain.connect(window._awmMasterGain || ctx.destination);
            src.onended = finish;
            src.onerror = finish;
            watchdog = setTimeout(finish, Math.max(1200, Math.round((buf.duration + 0.8) * 1000)));
            try {
                src.start(ctx.currentTime + 0.03);
            } catch (_) {
                finish();
            }
        });
        return true;
    } catch (err) {
        if (!_paxPhotoEffectWarned) {
            _paxPhotoEffectWarned = true;
            _paxLog(`${sourceLabel || 'Audioeffekt'} konnte nicht abgespielt werden: ${err?.message || err}`, 'warn');
        }
        return false;
    }
}

async function _paxPlayPhotoBurst(seed, options = {}, epoch = _paxMissionEpoch) {
    return _paxPlayAudioCue('photo', seed, {
        minCount: 1,
        maxCount: 5,
        minDelayMs: 1000,
        maxDelayMs: 10000,
        ...options
    }, epoch);
}

async function _paxPrimeStaticSurveyVoice(kind, spec = null, speaker = null) {
    const resolved = await _paxResolveStaticSurveyClip(kind, spec, speaker);
    if (!resolved) return false;
    const rec = await _paxFetchStaticClipAudio(resolved.url, resolved.clip?.mimeType || '');
    if (!rec?.audioBuffer) return false;
    _paxLog(`Statische Pax Voice bereit: ${resolved.clipKey} | ${resolved.clip?.voice || 'voice'} | take ${resolved.clip?.take || '?'}`, 'state');
    return true;
}

async function _paxTryPlayStaticSurveyVoice(kind, spec = null, speaker = null, epoch = _paxMissionEpoch) {
    const resolved = await _paxResolveStaticSurveyClip(kind, spec, speaker);
    if (!resolved) return false;
    const rec = await _paxFetchStaticClipAudio(resolved.url, resolved.clip?.mimeType || '');
    if (!rec?.audioBuffer) return false;
    const played = await _paxDecodeAudioBufferAndPlay(
        rec.audioBuffer.slice(0),
        rec.mimeType || resolved.clip?.mimeType || '',
        epoch,
        `Static Pax ${resolved.clipKey}`
    );
    if (played) _paxLog(`Statische Pax Voice gespielt: ${resolved.clipKey} | ${resolved.clip?.voice || 'voice'} | take ${resolved.clip?.take || '?'}`, 'audio');
    return !!played;
}

function _paxMissionAudioKey(kind) {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const fs = md?.fireScenario || {};
    const key = String(fs.missionId || md?.missionId || md?.id || `${md?.start || ''}-${md?.dest || ''}-${md?.mission || ''}`).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 96) || 'active';
    return `${kind}:${key}`;
}

function _paxBoardingReplayBlocked(key, windowMs = 120000) {
    const k = String(key || '').trim();
    if (!k) return false;
    const last = Number(_paxBoardingRecentPlayByKey.get(k) || 0);
    if (!Number.isFinite(last) || last <= 0) return false;
    return (Date.now() - last) < Math.max(1000, Number(windowMs) || 120000);
}

function _markPaxBoardingPlayed(key) {
    const k = String(key || '').trim();
    if (!k) return;
    _paxBoardingRecentPlayByKey.set(k, Date.now());
    if (_paxBoardingRecentPlayByKey.size > 24) {
        const entries = [..._paxBoardingRecentPlayByKey.entries()].sort((a, b) => Number(a[1] || 0) - Number(b[1] || 0));
        while (entries.length > 24) {
            const drop = entries.shift();
            if (drop) _paxBoardingRecentPlayByKey.delete(drop[0]);
        }
    }
}

function _speakerSnapshotForActivePax() {
    const pax = window.activePassenger || null;
    return pax ? {
        name: pax.name || '',
        role: pax.role || '',
        gender: pax.gender || '',
        roleProfile: pax.roleProfile || '',
        taskDomain: pax.taskDomain || ''
    } : null;
}

function _speakerSnapshotForMissionVoice(kind = 'boarding') {
    return _speakerSnapshotForActivePax() || (_cargoOnlyVoiceContext() ? _cargoMissionSpeaker(kind) : null);
}

function _extractWeightLbs(text) {
    const s = String(text || '');
    let total = 0;
    const lbMatches = s.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:lb|lbs|pound|pounds|pfund)\b/ig);
    for (const m of lbMatches) {
        const n = Number(String(m[1]).replace(',', '.'));
        if (Number.isFinite(n)) total += n;
    }
    const kgMatches = s.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:kg|kilogramm|kilograms?)\b/ig);
    for (const m of kgMatches) {
        const n = Number(String(m[1]).replace(',', '.'));
        if (Number.isFinite(n)) total += n * 2.20462;
    }
    return total > 0 ? Math.round(total) : 0;
}

function _stripManifestWeightForSpeech(text) {
    return String(text || '')
        .replace(/\s*\((?:ca\.\s*)?\d+(?:[.,]\d+)?\s*(?:lb|lbs|pound|pounds|pfund|kg|kilogramm|kilograms?)\)\s*/ig, ' ')
        .replace(/\b(?:ca\.\s*)?\d+(?:[.,]\d+)?\s*(?:lb|lbs|pound|pounds|pfund|kg|kilogramm|kilograms?)\b/ig, '')
        .replace(/\s+/g, ' ')
        .replace(/\s+([,.;:!?])/g, '$1')
        .replace(/\s*(?:und|,)\s*$/i, '')
        .trim();
}

function _extractPaxCount(text) {
    const m = String(text || '').match(/^\s*(\d+)\s*PAX\b/i);
    return m ? Math.max(0, parseInt(m[1], 10) || 0) : (_missionHasPax() ? 1 : 0);
}

function _missionManifestItemIsPassenger(item = null) {
    if (!item || typeof item !== 'object') return false;
    const type = String(item.itemType || '').toLowerCase();
    const id = String(item.id || '').toLowerCase();
    const label = String(item.storyName || item.label || '').trim();
    return type === 'passenger'
        || id === 'mission-passenger'
        || id === 'pickup-passenger'
        || /^\s*\d+\s*PAX\b/i.test(label);
}

function _missionRequiredItemNames(limit = 4) {
    const max = Math.max(1, Number(limit) || 4);
    let names = [];
    try {
        const manifest = (typeof window.missionCargoGetManifestSnapshot === 'function')
            ? window.missionCargoGetManifestSnapshot()
            : null;
        names = Array.isArray(manifest?.items)
            ? manifest.items
                .filter(item => item?.required && item?.pickupLocation !== 'target' && !_missionManifestItemIsPassenger(item))
                .map(item => String(item.storyName || item.label || '').trim())
                .filter(Boolean)
            : [];
    } catch (_) {}
    return [...new Set(names)].slice(0, max);
}

function _joinSpeechItems(items = []) {
    const clean = (Array.isArray(items) ? items : [])
        .map(item => String(item || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    if (!clean.length) return '';
    if (clean.length === 1) return clean[0];
    if (clean.length === 2) return `${clean[0]} und ${clean[1]}`;
    return `${clean.slice(0, -1).join(', ')} und ${clean[clean.length - 1]}`;
}

function _boardingEquipmentPhrase(items = [], fallback = 'meine Ausrüstung') {
    const list = _joinSpeechItems(items);
    const equipment = list || String(fallback || '').trim();
    if (!equipment || /^kein(?:e|en)?\s+/i.test(equipment)) return '';
    return equipment;
}

function _boardingEquipmentContextLine(items = [], fallback = 'meine Ausrüstung') {
    const equipment = _boardingEquipmentPhrase(items, fallback);
    return equipment
        ? `Optionale Gepäck-/Ausrüstungsdetails für die Ansage: ${equipment}. Nutze sie höchstens kurz und natürlich, wenn es zum Boardingmoment passt.`
        : 'Es gibt keine wichtigen Gepäckdetails für die Ansage; sprich lieber über Bereitschaft, Ziel oder Auftrag.';
}

function _boardingFallbackVariantIndex(seed = '') {
    const s = String(seed || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
}

function _buildBoardingText() {
    const cargoCtx = _cargoOnlyVoiceContext();
    if (cargoCtx) {
        const requiredItems = _missionRequiredItemNames(4);
        const cargoName = requiredItems.length ? requiredItems.join(', ') : cargoCtx.cargoText;
        return `Moin. Wir laden heute ${cargoName} fuer ${cargoCtx.dest}. Bitte sauber sichern und am Ziel erst nach vollem Stillstand zur Uebergabe freigeben.`;
    }
    let contract = null;
    try { contract = JSON.parse(localStorage.getItem('ga_active_mission_contract') || 'null'); } catch (_) {}
    contract = contract || window.activeMissionContract || (typeof currentMissionData !== 'undefined' ? currentMissionData?.missionContract : null) || {};
    const paxText = String(contract.paxText || document.getElementById('mPay')?.innerText || '').trim();
    const cargoText = String(contract.cargoText || document.getElementById('mWeight')?.innerText || '').trim();
    const pax = window.activePassenger || {};
    const paxCount = _extractPaxCount(paxText);
    const cargoClean = cargoText && !/^[-–—]$/.test(cargoText) ? (_stripManifestWeightForSpeech(cargoText) || cargoText) : 'kein zusaetzliches Gepaeck';
    const role = pax.role ? ` als ${pax.role}` : '';
    const bush = contract?.bush && typeof contract.bush === 'object' ? contract.bush : null;
    const isTargetPickupMission = !!(bush && String(bush.targetMode || '') === 'strip_then_return' && String(bush.pickupKind || '').trim());
    const hasOutboundPassenger = paxCount > 0;
    const paxPart = paxCount > 1
        ? `wir sind ${paxCount} Personen`
        : (hasOutboundPassenger
            ? `${pax.name ? `ich bin ${pax.name}` : 'ich bin heute mit an Bord'}${role}`
            : (isTargetPickupMission ? 'heute geht es zunaechst leer raus' : 'heute geht es ohne Passagier los'));
    const requiredItems = _missionRequiredItemNames(4);
    const requiredShort = requiredItems.slice(0, 4).map(_stripManifestWeightForSpeech).filter(Boolean);
    const equipment = _boardingEquipmentPhrase(requiredShort, cargoClean);
    const equipmentText = equipment ? ` ${equipment} ist dabei und liegt bereit.` : '';
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const target = String(contract?.targetName || md?.targetName || md?.dest || '').trim();
    const targetText = target ? ` nach ${target}` : '';
    const variants = [
        `Hi, ${paxPart}.${equipmentText} Von mir aus sind wir bereit für den Flug${targetText}.`,
        `Hallo, ${paxPart}.${equipmentText} Gib mir kurz Bescheid, worauf ich beim Start achten soll.`,
        `Moin, ${paxPart}.${equipmentText} Ich bin soweit, wir können den Auftrag${targetText} angehen.`
    ];
    const idx = _boardingFallbackVariantIndex(`${md?.missionId || md?.missionKey || ''}|boarding`) % variants.length;
    return variants[idx];
}

async function _requestTTSAudioForModel(apiKey, model, text, pax, voiceCandidates, signal = null) {
    let lastErr = null;
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
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ttsPayload), ...(signal ? { signal } : {}) }
            );
            if (!res.ok) {
                const errBody = await res.text().catch(() => '(unlesbar)');
                _paxLog(`TTS ${model}/${voiceName} HTTP ${res.status}: ${errBody.slice(0, 220)}`, 'warn');
                lastErr = new Error(`TTS ${model}/${voiceName} HTTP ${res.status}`);
                continue;
            }
            const data = await res.json();
            const part = data?.candidates?.[0]?.content?.parts?.[0];
            const b64 = part?.inlineData?.data;
            const mimeType = part?.inlineData?.mimeType || '';
            if (!b64) {
                _paxLog(`TTS ${model}/${voiceName} ohne Audio-Daten`, 'warn');
                lastErr = new Error(`TTS ${model}/${voiceName}: Keine Audio-Daten`);
                continue;
            }
            _paxLog(`TTS Stimme aktiv: ${voiceName}`, 'state');
            _paxLog(`TTS OK (${model}) | mime: ${mimeType} | ${b64.length} chars base64`, 'recv');
            return { text, speaker: pax, b64, mimeType, voiceName, model };
        } catch(e) {
            if (e?.name === 'AbortError') throw e;
            lastErr = e;
            _paxLog(`TTS ${model}/${voiceName} Fehler: ${e.message}`, 'warn');
        }
    }
    if (lastErr) throw lastErr;
    return null;
}

function _requestTTSAudioHedged(apiKey, text, pax, voiceCandidates, primaryModel, fallbackModel) {
    const hedgeDelayMs = _paxTtsHedgeDelayMs();
    _paxLog(`TTS-Hedge aktiv: ${primaryModel} zuerst, ${fallbackModel} nach ${hedgeDelayMs}ms`, 'state');
    return new Promise(resolve => {
        const canAbort = typeof AbortController !== 'undefined';
        const primaryCtl = canAbort ? new AbortController() : null;
        let fallbackCtl = null;
        let settled = false;
        let pending = 0;
        let fallbackStarted = false;
        let fallbackTimer = null;
        let lastErr = null;

        const settleWith = (audio, source) => {
            if (settled) {
                if (audio?.b64) _paxLog(`TTS-Hedge Nachzuegler ignoriert (${audio.model})`, 'state');
                return;
            }
            if (!audio?.b64) return;
            settled = true;
            if (fallbackTimer) clearTimeout(fallbackTimer);
            try {
                if (source === 'primary' && fallbackCtl) fallbackCtl.abort();
                if (source === 'fallback' && primaryCtl) primaryCtl.abort();
            } catch (_) {}
            _paxLog(`TTS-Hedge Gewinner: ${audio.model}`, 'state');
            if (typeof incrementApiUsage === 'function') incrementApiUsage('flash');
            resolve(audio);
        };

        const maybeResolveEmpty = () => {
            if (!settled && pending <= 0 && fallbackStarted) {
                if (lastErr) _paxLog(`TTS Fehler: ${lastErr.message || lastErr}`, 'warn');
                settled = true;
                resolve(null);
            }
        };

        const start = (source, model) => {
            if (settled) return;
            if (source === 'fallback') {
                fallbackStarted = true;
                fallbackCtl = canAbort ? new AbortController() : null;
                _paxLog(`TTS-Hedge Fallback gestartet: ${model}`, 'state');
            }
            pending++;
            const ctl = source === 'primary' ? primaryCtl : fallbackCtl;
            _requestTTSAudioForModel(apiKey, model, text, pax, voiceCandidates, ctl?.signal || null)
                .then(audio => settleWith(audio, source))
                .catch(e => {
                    if (e?.name !== 'AbortError') lastErr = e;
                })
                .finally(() => {
                    pending--;
                    if (source === 'primary' && !settled && !fallbackStarted) {
                        if (fallbackTimer) clearTimeout(fallbackTimer);
                        start('fallback', fallbackModel);
                    } else {
                        maybeResolveEmpty();
                    }
                });
        };

        start('primary', primaryModel);
        fallbackTimer = setTimeout(() => {
            if (!settled && !fallbackStarted) start('fallback', fallbackModel);
        }, hedgeDelayMs);
    });
}

async function _requestTTSAudio(text, speaker = null) {
    const apiKey = _getApiKey();
    if (!apiKey) { _paxLog('Kein API-Key für TTS', 'warn'); return null; }
    const pax = speaker || window.activePassenger || _lastSpokenSpeaker || null;
    const resolvedGender = _normSpeakerGender(pax);
    const voiceCandidates = _ttsVoiceCandidatesForSpeaker(pax);
    _paxLog(`TTS Stimmen: ${voiceCandidates.join(' -> ')} | Persona: ${pax?.name || 'unbekannt'} | Gender: ${resolvedGender} (raw: ${String(pax?.gender || 'n/a')})`, 'state');
    const ttsModels = _paxTtsModelPref === '3.1'
        ? ['gemini-3.1-flash-tts-preview']
        : (_paxTtsModelPref === '2.5'
            ? ['gemini-2.5-flash-preview-tts']
            : ['gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts']);
    _paxLog(`TTS-Modelle: ${ttsModels.join(' -> ')} | Modus: ${_paxTtsModelPref}`, 'state');

    if (_paxTtsModelPref === 'auto' && _paxTtsHedgeEnabled() && ttsModels.length >= 2) {
        return _requestTTSAudioHedged(apiKey, text, pax, voiceCandidates, ttsModels[0], ttsModels[1]);
    }

    let lastErr = null;
    for (const model of ttsModels) {
        try {
            const audio = await _requestTTSAudioForModel(apiKey, model, text, pax, voiceCandidates);
            if (audio?.b64) {
                if (typeof incrementApiUsage === 'function') incrementApiUsage('flash');
                return audio;
            }
        } catch (e) {
            if (e?.name !== 'AbortError') {
                lastErr = e;
                _paxLog(`TTS ${model} Fehler: ${e.message}`, 'warn');
            }
        }
    }
    if (lastErr) _paxLog(`TTS Fehler: ${lastErr.message}`, 'warn');
    return null;
}

function _prepareTextAsTTS(key, text, speaker = null, epoch = _paxMissionEpoch) {
    if (!key || !text || !_paxVoiceEnabled || !_getApiKey()) return Promise.resolve(null);
    const existing = _paxPreparedAudio.get(key);
    if (existing && existing.epoch != null && !_paxEpochCurrent(existing.epoch)) {
        _paxPreparedAudio.delete(key);
    } else if (existing?.audio || existing?.promise) {
        return existing.promise || Promise.resolve(existing.audio);
    }
    const promise = _requestTTSAudio(text, speaker).then(audio => {
        const rec = _paxPreparedAudio.get(key) || {};
        if (!_paxEpochCurrent(epoch) || (rec.promise && rec.promise !== promise)) return null;
        rec.audio = audio;
        rec.promise = null;
        rec.text = text;
        rec.speaker = speaker;
        rec.epoch = epoch;
        _paxPreparedAudio.set(key, rec);
        return audio;
    }).catch(err => {
        if (!_paxEpochCurrent(epoch)) return null;
        _paxLog(`TTS Preload Fehler (${key}): ${err?.message || err}`, 'warn');
        const rec = _paxPreparedAudio.get(key) || {};
        if (rec.promise && rec.promise !== promise) return null;
        rec.promise = null;
        rec.epoch = epoch;
        _paxPreparedAudio.set(key, rec);
        return null;
    });
    _paxPreparedAudio.set(key, { text, speaker, promise, audio: null, epoch });
    _paxLog(`TTS Preload gestartet: ${key}`, 'state');
    return promise;
}

function _rememberAndShowPrepared(text, speaker, eventLabel) {
    _lastSpokenText = text;
    _lastSpokenSpeaker = speaker;
    _capturePoiNarrativeMemory(eventLabel, text);
    _showPaxMessage(text, eventLabel);
}

function _speakPreparedText(key, text, speaker, eventLabel, options = {}) {
    const epoch = _paxMissionEpoch;
    const run = async () => {
        if (epoch !== _paxMissionEpoch) return;
        _paxLog(`Queue ▶ Start | Event: ${eventLabel}`, 'state');
        try {
            if (epoch !== _paxMissionEpoch) return;
            _paxLog(`── ${eventLabel} ──`, 'event');
            _rememberAndShowPrepared(text, speaker, eventLabel);
            if (!_paxVoiceEnabled) {
                _paxLog('TTS übersprungen (Stimme deaktiviert) — Text gespeichert', 'state');
                return;
            }
            if (typeof options.backgroundAudio === 'function') {
                try {
                    const maybePromise = options.backgroundAudio(epoch);
                    if (maybePromise && typeof maybePromise.catch === 'function') maybePromise.catch(() => {});
                } catch (_) {}
            }
            if (typeof options.beforeAudio === 'function') {
                await options.beforeAudio(epoch);
                if (epoch !== _paxMissionEpoch) return;
            }
            if (typeof options.tryStaticAudio === 'function') {
                const playedStatic = await options.tryStaticAudio(epoch);
                if (epoch !== _paxMissionEpoch) return;
                if (playedStatic) return;
            }
            const rec = _paxPreparedAudio.get(key);
            const audio = rec?.audio || await (rec?.promise || _prepareTextAsTTS(key, text, speaker, epoch));
            if (epoch !== _paxMissionEpoch) return;
            if (audio?.b64) await _paxDecodeAndPlay(audio.b64, audio.mimeType, epoch);
            else await _playTextAsTTS(text, speaker, epoch);
            if (typeof options.afterAudio === 'function') {
                await options.afterAudio(epoch);
                if (epoch !== _paxMissionEpoch) return;
            }
        } catch (e) {
            _paxLog(`Prepared Speech Fehler: ${e.message || e}`, 'warn');
        } finally {
            if (epoch === _paxMissionEpoch) _paxLog(`Queue ✓ Ende | Event: ${eventLabel}`, 'state');
        }
    };
    _paxSpeechQueue = _paxSpeechQueue.then(run, run);
    return _paxSpeechQueue;
}

function _surveyPatternActiveSpec() {
    if (typeof window.missionSurveyPattern?.getActiveSpec !== 'function') return null;
    try {
        return window.missionSurveyPattern.getActiveSpec(
            (typeof currentMissionData !== 'undefined' ? currentMissionData : null),
            window.activePassenger || null
        );
    } catch (_) {
        return null;
    }
}

function _surveyPatternSnapshot() {
    if (typeof window.missionSurveyPattern?.snapshot !== 'function') return null;
    try {
        return window.missionSurveyPattern.snapshot();
    } catch (_) {
        return null;
    }
}

function _surveyPatternProgressSummary(ctx = null) {
    const spec = _surveyPatternActiveSpec();
    if (!spec) return '';
    const snap = _surveyPatternSnapshot();
    const parts = [];
    if (ctx?.hasPosition) parts.push(`Distanz zum Ziel ${ctx.distNm.toFixed(1)} NM, Richtung ${String(ctx.roundedBearingDeg).padStart(3, '0')} Grad`);
    if (spec.type === 'orbit') {
        const done = Math.max(0, Number(snap?.orbit?.completedTurns || 0));
        const total = Math.max(1, Number(spec.orbit?.requiredTurns || 3));
        const activeCoverage = Math.round(Number(snap?.orbit?.activeCoverage || 0) * 100);
        parts.push(`Survey-Orbit ${done}/${total} Kreise abgeschlossen${snap?.orbit?.active ? `, aktueller Kreis ${activeCoverage}%` : ''}`);
    } else {
        const done = Array.isArray(snap?.scan?.completedLineIds) ? snap.scan.completedLineIds.length : 0;
        const total = Array.isArray(spec.scan?.lines) ? spec.scan.lines.length : Math.max(1, Number(spec.scan?.lineCount || 1));
        const activeLine = String(snap?.scan?.active?.lineId || '');
        const coverage = Math.round(Number(snap?.scan?.activeCoverage || 0) * 100);
        parts.push(`Survey-Scan ${done}/${total} Linien gruen${activeLine ? `, ${activeLine} aktiv bei ${coverage}%` : ''}`);
    }
    if (snap?.satisfied) parts.push('Status: Survey abgeschlossen, Rueckflug freigegeben');
    else if (snap?.startedAt) parts.push('Status: Datenaufnahme laeuft');
    else parts.push('Status: Pattern sichtbar, Einstieg an einem Linienende oder auf dem Orbit');
    const targetAlt = Number(spec.targetAltFt || window.activePassenger?.targetAltFt || 0);
    if (targetAlt > 0 && ctx?.mslFt != null) {
        const diff = Number(ctx.mslFt) - targetAlt;
        if (Math.abs(diff) <= Number(spec.altitudeToleranceFt || 300)) parts.push(`Hoehe im Band: ${ctx.mslFt} ft bei Ziel ${Math.round(targetAlt)} ft`);
        else parts.push(`Hoehenabweichung: ${Math.abs(Math.round(diff))} ft ${diff > 0 ? 'zu hoch' : 'zu niedrig'} gegen Ziel ${Math.round(targetAlt)} ft`);
    }
    return parts.join(' | ');
}

function _surveyPatternStatusText(ctx = null) {
    const summary = _surveyPatternProgressSummary(ctx);
    if (!summary) return 'Ich habe gerade kein aktives Survey-Pattern geladen. Bitte pruefe, ob die Mapping-Mission noch aktiv ist.';
    return summary.replace(/\s*\|\s*/g, '. ') + '.';
}

function _surveyPatternOrientationText(ctx = null) {
    const spec = _surveyPatternActiveSpec();
    const vector = _missionVectorText(ctx);
    if (!spec) return `${vector} Ich habe gerade kein aktives Survey-Pattern geladen.`;
    if (spec.type === 'orbit') {
        const radius = Number(spec.orbit?.radiusNm || 0.55).toFixed(2);
        return `${vector} Das Pattern ist der markierte Orbit um das Ziel. Richte dich auf etwa ${radius} NM Radius ein, halte die geplante Hoehe und fliege die vollen Kreise ruhig durch.`;
    }
    const snap = _surveyPatternSnapshot();
    const done = Array.isArray(snap?.scan?.completedLineIds) ? snap.scan.completedLineIds.length : 0;
    const total = Array.isArray(spec.scan?.lines) ? spec.scan.lines.length : Math.max(1, Number(spec.scan?.lineCount || 1));
    return `${vector} Das rote Scanmuster liegt schon auf der Karte. Such dir ein offenes Linienende, flieg die Nord-Sued-Bahn gerade ab und nimm danach die naechste offene Linie; erledigt sind ${done} von ${total}.`;
}

function _poiChainActiveSpec() {
    if (typeof window.missionPoiChainRuntime?.getActiveSpec !== 'function') return null;
    try {
        return window.missionPoiChainRuntime.getActiveSpec(
            (typeof currentMissionData !== 'undefined' ? currentMissionData : null),
            window.activePassenger || null
        );
    } catch (_) {
        return null;
    }
}

function _poiChainSnapshot() {
    if (typeof window.missionPoiChainRuntime?.snapshot !== 'function') return null;
    try {
        return window.missionPoiChainRuntime.snapshot();
    } catch (_) {
        return null;
    }
}

function _poiChainProgressSummary(ctx = null) {
    const spec = _poiChainActiveSpec();
    if (!spec) return '';
    const snap = _poiChainSnapshot();
    const points = Array.isArray(spec.points) ? spec.points : [];
    const total = points.filter(point => point?.required !== false).length || points.length || 1;
    const done = Array.isArray(snap?.completedPointIds) ? snap.completedPointIds.length : 0;
    const currentIndex = Math.max(0, Number(snap?.currentIndex || 0) || 0);
    const nextPoint = points[currentIndex] || null;
    const parts = [];
    parts.push(`Kettenauftrag ${done}/${total} Punkte erledigt`);
    if (snap?.satisfied) {
        parts.push('Status: Kette abgeschlossen, Rueckflug freigegeben');
    } else if (nextPoint) {
        parts.push(`Nächster Punkt: ${nextPoint.name}`);
        if (ctx?.hasPosition) {
            const dist = _haversineNm(ctx.lat, ctx.lon, nextPoint.lat, nextPoint.lon);
            const brg = _bearingDeg(ctx.lat, ctx.lon, nextPoint.lat, nextPoint.lon);
            parts.push(`Entfernung ${dist.toFixed(1)} NM, Steuerkurs ${String(Math.round(brg)).padStart(3, '0')} Grad`);
        }
    } else {
        parts.push('Status: naechster Kettenpunkt wird vorbereitet');
    }
    return parts.join(' | ');
}

function _poiChainStatusText(ctx = null) {
    const summary = _poiChainProgressSummary(ctx);
    if (!summary) return 'Ich habe gerade keine aktive POI-Kette geladen.';
    return summary.replace(/\s*\|\s*/g, '. ') + '.';
}

function _poiChainOrientationText(ctx = null) {
    const spec = _poiChainActiveSpec();
    if (!spec) return `${_missionVectorText(ctx)} Ich habe gerade keine aktive POI-Kette geladen.`;
    const snap = _poiChainSnapshot();
    const points = Array.isArray(spec.points) ? spec.points : [];
    const currentIndex = Math.max(0, Number(snap?.currentIndex || 0) || 0);
    const nextPoint = points[currentIndex] || null;
    if (!nextPoint) return 'Alle Kettenpunkte sind erledigt. Der sinnvolle nächste Schritt ist der Rueckflug zur Basis.';
    if (ctx?.hasPosition) {
        const dist = _haversineNm(ctx.lat, ctx.lon, nextPoint.lat, nextPoint.lon);
        const brg = _bearingDeg(ctx.lat, ctx.lon, nextPoint.lat, nextPoint.lon);
        const clock = _relativeClockPos(brg, ctx.hdg || 0);
        return `Nächster Kettenpunkt ist ${nextPoint.name}. Steuerkurs ${String(Math.round(brg)).padStart(3, '0')} Grad, Entfernung ${dist.toFixed(1)} NM, etwa ${clock}. Der Triggerkreis ist auf der Karte markiert.`;
    }
    return `Nächster Kettenpunkt ist ${nextPoint.name}. Der aktuelle rote Triggerkreis ist auf der Karte markiert.`;
}

function _surveyPatternOuterRadiusNm(spec = null, fallbackRadiusNm = 1.5) {
    if (!spec || typeof spec !== 'object') return Math.max(0.5, Number(fallbackRadiusNm || 0) || 1.5);
    const center = spec.center || {};
    const centerLat = Number(center.lat);
    const centerLon = Number(center.lon);
    if (String(spec.type || '').toLowerCase() === 'orbit') {
        return Math.max(
            Number(fallbackRadiusNm || 0) || 0,
            Number(spec.orbit?.radiusNm || 0) + Number(spec.orbit?.radialToleranceNm || 0) + 0.25
        );
    }
    let maxNm = 0;
    if (Number.isFinite(centerLat) && Number.isFinite(centerLon) && Array.isArray(spec.scan?.lines)) {
        for (const line of spec.scan.lines) {
            for (const point of [line?.start, line?.end]) {
                const lat = Number(point?.lat);
                const lon = Number(point?.lon);
                if (Number.isFinite(lat) && Number.isFinite(lon)) {
                    maxNm = Math.max(maxNm, _haversineNm(centerLat, centerLon, lat, lon));
                }
            }
        }
    }
    return Math.max(Number(fallbackRadiusNm || 0) || 0, maxNm + 0.25, 0.5);
}

function _poiInSightGate({ taskDomain = '', distNm = 0, etaMin = 0, radiusNm = 1.5, effectiveGs = 95, surveyTickResult = null } = {}) {
    const td = String(taskDomain || '').toLowerCase();
    const dist = Number(distNm);
    if (!Number.isFinite(dist)) return { ready: false, announcedEtaMin: 2, logEtaMin: etaMin };
    if (td !== 'mapping_survey') {
        return {
            ready: Number(etaMin) <= 3.2 && dist <= Math.max(2.2, Number(radiusNm || 0) + 1.2),
            announcedEtaMin: 2,
            logEtaMin: etaMin
        };
    }
    if (surveyTickResult?.progress?.startedAt) {
        return { ready: false, announcedEtaMin: 2, logEtaMin: 0 };
    }
    const spec = _surveyPatternActiveSpec();
    const surveyRadius = _surveyPatternOuterRadiusNm(spec, radiusNm);
    const gs = Math.max(45, Number(effectiveGs || 0) || 95);
    const etaToSurveyAreaMin = Math.max(0, ((dist - surveyRadius) / gs) * 60);
    const stillOutsideSurvey = dist > surveyRadius + 0.25;
    return {
        ready: stillOutsideSurvey
            && etaToSurveyAreaMin <= 3.6
            && dist <= surveyRadius + 6.5,
        announcedEtaMin: Math.max(2, Math.round(etaToSurveyAreaMin)),
        logEtaMin: etaToSurveyAreaMin,
        surveyRadiusNm: surveyRadius
    };
}

function _surveyPatternAudioKey(kind = 'event') {
    return _paxMissionAudioKey(`survey-${kind}`);
}

function _surveyPatternVoiceText(kind = 'line_complete', spec = null) {
    const type = String(spec?.type || '').toLowerCase();
    switch (kind) {
        case 'line_complete':
            return 'Gut, diese Bahn ist sauber. Nimm dir jetzt die nächste Linie, die Reihenfolge ist egal.';
        case 'line_reset_altitude':
            return 'Die Höhe passt nicht mehr, die aktuelle Bahn zählt nicht. Wir setzen die Linie noch einmal sauber an.';
        case 'line_reset_offtrack':
            return 'Wir sind zu weit aus der Bahn gedriftet. Diese Linie bitte noch einmal ruhig und gerade aufnehmen.';
        case 'orbit_turn_complete':
            return 'Sauber, dieser Kreis zählt. Bleib im gleichen Radius und nimm den nächsten Umlauf mit.';
        case 'orbit_reset_altitude':
            return 'Die Höhe ist aus dem Band gelaufen, der aktuelle Kreis zählt nicht. Bitte wieder stabilisieren und neu ansetzen.';
        case 'orbit_reset_offtrack':
            return 'Der Radius läuft weg, der aktuelle Kreis zählt nicht. Bitte zurück auf den Ring und neu ansetzen.';
        case 'survey_complete':
            return type === 'orbit'
                ? 'Das waren alle Kreise, der Survey ist komplett. Auftrag erfüllt, wir gehen zurück zum Heimatplatz.'
                : 'Alle Survey-Linien sind sauber abgedeckt. Auftrag erfüllt, wir gehen zurück zum Heimatplatz.';
        case 'survey_area_entered':
            return type === 'orbit'
                ? 'Wir sind im Surveybereich. Nimm jetzt den markierten Orbit auf und halte Hoehe und Radius stabil.'
                : 'Wir sind im Surveybereich. Such dir ein Linienende und flieg die erste Bahn sauber durch.';
        default:
            return '';
    }
}

window.paxVoicePrepareSurveyPattern = function() {
    const spec = _surveyPatternActiveSpec();
    if (!spec || String(spec.taskDomain || '').toLowerCase() !== 'mapping_survey') return Promise.resolve(null);
    if (!window.activePassenger || !_missionHasPax()) return Promise.resolve(null);
    const epoch = _paxMissionEpoch;
    const speaker = _speakerSnapshotForMissionVoice('survey-pattern');
    // Keep startup TTS bursts small: rare reset/finish calls synthesize on demand.
    const kinds = spec.type === 'orbit'
        ? ['survey_area_entered', 'orbit_turn_complete']
        : ['survey_area_entered', 'line_complete'];
    const jobs = kinds.map(kind => {
        const text = _surveyPatternVoiceText(kind, spec);
        if (!text) return Promise.resolve(null);
        return _paxPrimeStaticSurveyVoice(kind, spec, speaker)
            .then(staticReady => staticReady ? true : _prepareTextAsTTS(_surveyPatternAudioKey(kind), text, speaker, epoch));
    });
    return Promise.allSettled(jobs);
};

function _surveyPatternEventKind(event = null) {
    const type = String(event?.type || '').toLowerCase();
    if (type === 'survey_complete') return 'survey_complete';
    if (type === 'line_complete') return 'line_complete';
    if (type === 'line_reset_altitude') return 'line_reset_altitude';
    if (type === 'line_reset_offtrack') return 'line_reset_offtrack';
    if (type === 'orbit_turn_complete') return 'orbit_turn_complete';
    if (type === 'orbit_reset_altitude') return 'orbit_reset_altitude';
    if (type === 'orbit_reset_offtrack') return 'orbit_reset_offtrack';
    if (type === 'survey_area_entered') return 'survey_area_entered';
    return '';
}

function _surveyPatternAudioCueOptions(kind = '', spec = null, text = '') {
    const fallbackByKind = {
        survey_area_entered: 'scan_start',
        line_complete: 'data_lock',
        orbit_turn_complete: 'data_lock',
        survey_complete: 'handoff'
    };
    const fallbackCue = fallbackByKind[kind] || 'none';
    const cueId = _paxMissionAudioCueId('mapping_survey', kind, fallbackCue);
    if (cueId === 'none') return null;
    const seed = `${spec?.key || spec?.label || ''}|${kind}|${text}`;
    return {
        beforeAudio: (playEpoch) => _paxPlayAudioCue(cueId, `${seed}|cue`, {
            minCount: 1,
            maxCount: 1,
            firstDelayMs: 0,
            minDelayMs: 0,
            maxDelayMs: 0
        }, playEpoch)
    };
}

function _handleSurveyPatternEvents(events = [], spec = null) {
    if (!Array.isArray(events) || !events.length) return;
    const meaningful = events
        .map(_surveyPatternEventKind)
        .filter(Boolean);
    if (!meaningful.length) return;
    const kind = meaningful.includes('survey_complete')
        ? 'survey_complete'
        : (meaningful.includes('survey_area_entered')
            ? 'survey_area_entered'
            : meaningful.find(k => /complete|reset/.test(k)));
    if (!kind) return;
    _paxLog(`Survey-Pattern Event: ${kind}`, 'event');
    if (typeof window.missionPersistRuntimeSnapshot === 'function') {
        window.missionPersistRuntimeSnapshot(`survey-pattern-${kind}`, { immediate: kind === 'survey_complete' });
    }
    const text = _surveyPatternVoiceText(kind, spec);
    if (!text) return;
    const speaker = _speakerSnapshotForMissionVoice('survey-pattern');
    const label = kind === 'survey_complete'
        ? 'Survey erfüllt'
        : (kind.includes('reset') ? 'Survey-Korrektur' : 'Survey-Fortschritt');
    const cueOptions = _surveyPatternAudioCueOptions(kind, spec, text) || {};
    _speakPreparedText(_surveyPatternAudioKey(kind), text, speaker, label, {
        ...cueOptions,
        tryStaticAudio: (playEpoch) => _paxTryPlayStaticSurveyVoice(kind, spec, speaker, playEpoch)
    });
}

function _poiChainAudioKey(kind = 'event', text = '') {
    const suffix = text ? `-${_hashStable(text).toString(36).slice(0, 6)}` : '';
    return _paxMissionAudioKey(`poi-chain-${kind}${suffix}`);
}

function _poiChainPickText(pool = [], seed = '') {
    const options = (Array.isArray(pool) ? pool : []).map(v => String(v || '').trim()).filter(Boolean);
    if (!options.length) return '';
    return options[_hashStable(seed) % options.length] || options[0] || '';
}

function _poiChainPointLabel(point = null, fallback = 'dieser Punkt') {
    const name = String(point?.name || '').trim();
    if (!name) return fallback;
    return name.length > 46 ? `${name.slice(0, 43).trim()}...` : name;
}

function _poiChainPointFindingText(event = null, spec = null) {
    const point = event?.point || null;
    const tags = point?.tags || {};
    const hiddenOutcome = event?.hiddenOutcome && typeof event.hiddenOutcome === 'object' ? event.hiddenOutcome : null;
    const explicit = [
        hiddenOutcome?.paxFindingText,
        hiddenOutcome?.findingHint,
        tags.paxFindingText,
        tags.findingText,
        tags.findingHint,
        event?.findingText,
        event?.findingHint
    ].map(v => String(v || '').trim()).find(Boolean);
    if (explicit) return explicit;
    const marker = String(hiddenOutcome?.findingKind || tags.finding || tags.outcome || tags.followUp || tags.followUpType || event?.finding || '').trim().toLowerCase();
    if (!marker || /^(none|ok|clear|normal|unauffaellig|unauffällig|false|0)$/.test(marker)) return '';
    const pointName = _poiChainPointLabel(point, 'dieser Querung');
    return _poiChainPickText([
        `Bei ${pointName} nehme ich einen möglichen Anschlussbedarf mit. Die Fotos sollten später genauer ausgewertet werden, bevor daraus eine Einzelprüfung wird.`,
        `Hier notiere ich eine Auffälligkeit für die Nachsichtung. Wir dokumentieren den Punkt sauber und entscheiden erst nach der Bildauswertung über eine Folgemission.`,
        `Diesen Punkt markiere ich für die Auswertung. Aus der Luft reicht das für den Erstbefund, Details klären wir später gezielt am Einzelobjekt.`
    ], `${spec?.key || spec?.label || ''}|${point?.id || pointName}|finding|${marker}`);
}

function _poiChainVoiceText(kind = 'point_complete', spec = null, event = null) {
    const point = event?.point || null;
    const nextPoint = event?.nextPoint || null;
    const seed = `${spec?.key || spec?.label || ''}|${kind}|${point?.id || ''}|${nextPoint?.id || ''}`;
    switch (kind) {
        case 'chain_complete':
            return _poiChainPickText([
                'Das war der letzte Kontrollpunkt. Die Bildserie ist komplett; wir gehen zur Auswertung zurück zum Heimatplatz.',
                'Kette abgeschlossen. Alle Prüfpunkte sind dokumentiert, jetzt bringen wir die Bilder zurück zur Basis.',
                'Der letzte Punkt ist im Kasten. Für den Erstbefund reicht das, wir kehren zur Übergabe nach Hause zurück.',
                'Alles aufgenommen. Die Kette ist vollständig dokumentiert, Rückflug zum Startplatz.'
            ], seed);
        case 'point_complete':
            return _poiChainPointFindingText(event, spec) || _poiChainPickText([
                'Gut, der Punkt ist im Kasten. Ich habe die Bilder; weiter zum nächsten markierten Punkt.',
                'Passt, diese Querung ist dokumentiert. Ich rufe gleich den nächsten Prüfpunkt auf.',
                'Fotos sind drauf. Für den Erstbefund reicht das hier; weiter zur nächsten Markierung.',
                'Sauber, der Abschnitt ist abgehakt. Nächster Punkt kommt jetzt auf die Karte.',
                'Der Kontrollpunkt ist erledigt. Ich notiere ihn als dokumentiert und nehme den nächsten Abschnitt auf.'
            ], seed);
        case 'chain_area_entered':
            return _poiChainPickText([
                'Wir sind am ersten Kettenpunkt. Bitte ruhig halten, ich starte die Bildserie.',
                'Erster Prüfpunkt erreicht. Ich beginne mit den Übersichtsaufnahmen und rufe danach den nächsten Punkt auf.',
                'Das ist der Einstieg in die Kette. Ein stabiler Vorbeiflug reicht für den ersten Befund.'
            ], seed);
        default:
            return '';
    }
}

function _poiChainPhotoSoundOptions(kind = '', spec = null, event = null, text = '') {
    if (kind !== 'point_complete') return null;
    const cueId = _paxMissionAudioCueId('poi_chain', kind, 'photo');
    if (cueId === 'none') return null;
    const point = event?.point || {};
    const seed = `${spec?.key || spec?.label || ''}|${point?.id || point?.name || ''}|${text}`;
    if (cueId !== 'photo') {
        return {
            beforeAudio: (epoch) => _paxPlayAudioCue(cueId, `${seed}|pre`, {
                minCount: 1,
                maxCount: 1,
                firstDelayMs: 120,
                minDelayMs: 0,
                maxDelayMs: 0
            }, epoch)
        };
    }
    return {
        beforeAudio: (epoch) => _paxPlayPhotoBurst(`${seed}|pre`, {
            minCount: 1,
            maxCount: 2,
            firstDelayMs: 120,
            minDelayMs: 550,
            maxDelayMs: 1800
        }, epoch),
        afterAudio: (epoch) => _paxPlayPhotoBurst(`${seed}|post`, {
            minCount: 1,
            maxCount: 5,
            firstDelayMs: _paxSeededInt(`${seed}|post-first`, 900, 2600),
            minDelayMs: 1000,
            maxDelayMs: 10000
        }, epoch)
    };
}

window.paxVoicePreparePoiChain = function() {
    const spec = _poiChainActiveSpec();
    if (!spec || String(spec.kind || '').toLowerCase() !== 'poi_chain') return Promise.resolve(null);
    if (!window.activePassenger || !_missionHasPax()) return Promise.resolve(null);
    const epoch = _paxMissionEpoch;
    const speaker = _speakerSnapshotForMissionVoice('poi-chain');
    const kinds = ['point_complete', 'chain_complete'];
    const jobs = kinds.map(kind => {
        const text = _poiChainVoiceText(kind, spec);
        if (!text) return Promise.resolve(null);
        return _prepareTextAsTTS(_poiChainAudioKey(kind, text), text, speaker, epoch);
    });
    return Promise.allSettled(jobs);
};

function _poiChainEventKind(event = null) {
    const type = String(event?.type || '').toLowerCase();
    if (type === 'chain_complete') return 'chain_complete';
    if (type === 'point_complete') return 'point_complete';
    if (type === 'chain_area_entered') return 'chain_area_entered';
    return '';
}

function _handlePoiChainEvents(events = [], spec = null) {
    if (!Array.isArray(events) || !events.length) return;
    const meaningful = events
        .map(event => ({ event, kind: _poiChainEventKind(event) }))
        .filter(item => item.kind);
    if (!meaningful.length) return;
    const pickedEvents = [];
    const pointEvent = meaningful.find(item => item.kind === 'point_complete');
    const areaEvent = meaningful.find(item => item.kind === 'chain_area_entered');
    const chainEvent = meaningful.find(item => item.kind === 'chain_complete');
    if (pointEvent) pickedEvents.push(pointEvent);
    else if (areaEvent) pickedEvents.push(areaEvent);
    else if (meaningful[0]) pickedEvents.push(meaningful[0]);
    if (chainEvent && !pickedEvents.includes(chainEvent)) pickedEvents.push(chainEvent);
    const speaker = _speakerSnapshotForMissionVoice('poi-chain');
    for (const picked of pickedEvents) {
        const kind = picked.kind;
        const event = picked.event || null;
        _paxLog(`POI-Chain Event: ${kind}`, 'event');
        if (typeof window.missionPersistRuntimeSnapshot === 'function') {
            window.missionPersistRuntimeSnapshot(`poi-chain-${kind}`, { immediate: kind === 'chain_complete' });
        }
        const text = _poiChainVoiceText(kind, spec, event);
        if (!text) continue;
        const label = kind === 'chain_complete' ? 'Kette erfüllt' : 'Ketten-Fortschritt';
        const photoOptions = _poiChainPhotoSoundOptions(kind, spec, event, text) || {};
        _speakPreparedText(_poiChainAudioKey(kind, text), text, speaker, label, photoOptions);
    }
}

function _tickPoiChainTask(lat, lon, flightData) {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    const isChainMission = !!(md?.poiChain || md?.missionSubType === 'poi_chain' || window.activePassenger?.poiChain);
    if (!isChainMission) return null;
    if (typeof window.missionPoiChainRuntime?.tick !== 'function') return null;
    let result = null;
    try {
        result = window.missionPoiChainRuntime.tick({
            lat,
            lon,
            flightData,
            missionData: md,
            passenger: window.activePassenger || null
        });
    } catch (err) {
        _paxLog(`POI-Chain Tick Fehler: ${err?.message || err}`, 'warn');
        return null;
    }
    if (!result?.handled) return result;
    _handlePoiChainEvents(result.events || [], result.spec || _poiChainActiveSpec());
    const progress = result.progress || null;
    if (progress?.updatedAt) {
        if (progress.startedAt) _poiDwellSec = Math.max(_poiDwellSec, (Number(progress.updatedAt) - Number(progress.startedAt)) / 1000);
        _poiInRadius = true;
        _poiEntryDone = true;
        if (!_poiEnteredAt) _poiEnteredAt = Number(progress.startedAt || progress.updatedAt) || Date.now();
        _poiLastTickTime = Date.now();
    }
    if (result.satisfied && !_poiSatisfied) {
        _poiSatisfied = true;
        _paxAtTargetDone = true;
        _poiInRadius = true;
        _poiEntryDone = true;
        if (typeof window.missionPersistRuntimeSnapshot === 'function') {
            window.missionPersistRuntimeSnapshot('poi-chain-satisfied', { immediate: true });
        }
        if (!Array.isArray(result.events) || !result.events.some(ev => String(ev?.type || '') === 'chain_complete')) {
            _handlePoiChainEvents([{ type: 'chain_complete' }], result.spec || _poiChainActiveSpec());
        }
        _refreshPaxWidgetVisibility();
    }
    return result;
}

function _tickSurveyPatternTask(lat, lon, flightData) {
    if (_activeTaskDomain() !== 'mapping_survey') return false;
    if (typeof window.missionSurveyPattern?.tick !== 'function') return false;
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    let result = null;
    try {
        result = window.missionSurveyPattern.tick({
            lat,
            lon,
            flightData,
            missionData: md,
            passenger: window.activePassenger || null
        });
    } catch (err) {
        _paxLog(`Survey-Pattern Tick Fehler: ${err?.message || err}`, 'warn');
        return false;
    }
    if (!result?.handled) return false;
    _handleSurveyPatternEvents(result.events || [], result.spec || _surveyPatternActiveSpec());
    const progress = result.progress || null;
    if (progress?.startedAt && progress?.updatedAt) {
        _poiDwellSec = Math.max(_poiDwellSec, (Number(progress.updatedAt) - Number(progress.startedAt)) / 1000);
        _poiInRadius = true;
        _poiEntryDone = true;
        if (!_poiEnteredAt) _poiEnteredAt = Number(progress.startedAt) || Date.now();
        _poiLastTickTime = Date.now();
    }
    if (result.satisfied && !_poiSatisfied) {
        _poiSatisfied = true;
        _paxAtTargetDone = true;
        _poiInRadius = true;
        _poiEntryDone = true;
        if (typeof window.missionPersistRuntimeSnapshot === 'function') {
            window.missionPersistRuntimeSnapshot('survey-pattern-satisfied', { immediate: true });
        }
        if (!Array.isArray(result.events) || !result.events.some(ev => String(ev?.type || '') === 'survey_complete')) {
            _handleSurveyPatternEvents([{ type: 'survey_complete' }], result.spec || _surveyPatternActiveSpec());
        }
        _refreshPaxWidgetVisibility();
    }
    return result;
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
    if (!window.activePassenger || !_missionHasPax()) return;
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

async function _playTextAsTTS(text, speaker = null, epoch = _paxMissionEpoch) {
    if (!_paxEpochCurrent(epoch)) return;
    const audio = await _requestTTSAudio(text, speaker);
    if (!_paxEpochCurrent(epoch)) return;
    if (audio?.b64) await _paxDecodeAndPlay(audio.b64, audio.mimeType, epoch);
}

async function _speakAndShowNow(situationPrompt, eventLabel, speakerOverride = null, epoch = _paxMissionEpoch) {
    if (!_paxEpochCurrent(epoch)) return;
    const apiKey = _getApiKey();
    if (!apiKey) { _paxLog('Kein API-Key', 'warn'); return; }
    const pax = window.activePassenger || null;
    const speakerSnapshot = speakerOverride || (pax ? {
        name: pax.name || '',
        role: pax.role || '',
        gender: pax.gender || '',
        roleProfile: pax.roleProfile || '',
        taskDomain: pax.taskDomain || ''
    } : null);

    _paxLog(`── ${eventLabel} ──`, 'event');
    _logRoleConsistencyCheck(eventLabel);
    _paxLog(`PROMPT (voll): ${situationPrompt.replace(/\n+/g, ' ')}`, 'send');
    const spokenTextRaw = await _generateSpokenText(apiKey, situationPrompt);
    if (!_paxEpochCurrent(epoch)) return;
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
    _captureBushPickupNarrativeMemory(eventLabel, spokenText);
    _captureBushCargoPickupNarrativeMemory(eventLabel, spokenText);
    _showPaxMessage(spokenText, eventLabel);

    if (!_paxVoiceEnabled) {
        _paxLog('TTS übersprungen (Stimme deaktiviert) — Text gespeichert', 'state');
        return;
    }
    await _playTextAsTTS(spokenText, speakerSnapshot, epoch);
}

function _speakAndShow(situationPrompt, eventLabel, speakerOverride = null) {
    const epoch = _paxMissionEpoch;
    _paxLog(`Queue +1 | Event: ${eventLabel}`, 'state');
    const run = async () => {
        if (epoch !== _paxMissionEpoch) return;
        _paxLog(`Queue ▶ Start | Event: ${eventLabel}`, 'state');
        try {
            if (epoch !== _paxMissionEpoch) return;
            await _speakAndShowNow(situationPrompt, eventLabel, speakerOverride, epoch);
        } catch (e) {
            _paxLog(`Speech-Queue Fehler: ${e.message || e}`, 'warn');
        } finally {
            if (epoch === _paxMissionEpoch) _paxLog(`Queue ✓ Ende | Event: ${eventLabel}`, 'state');
        }
    };
    _paxSpeechQueue = _paxSpeechQueue.then(run, run);
    return _paxSpeechQueue;
}

function _distanceFromDepartureNm(lat, lon) {
    const wp0 = (typeof routeWaypoints !== 'undefined' && Array.isArray(routeWaypoints) && routeWaypoints.length > 0)
        ? routeWaypoints[0] : null;
    const wpLat = Number(wp0?.lat);
    const wpLon = Number(wp0?.lng ?? wp0?.lon);
    const curLat = Number(lat);
    const curLon = Number(lon);
    if (!wp0 || !Number.isFinite(wpLat) || !Number.isFinite(wpLon) || !Number.isFinite(curLat) || !Number.isFinite(curLon)) return null;
    const dLat  = (wpLat - curLat) * Math.PI / 180;
    const dLon  = (wpLon - curLon) * Math.PI / 180;
    const a     = Math.sin(dLat/2)**2 + Math.cos(curLat*Math.PI/180) * Math.cos(wpLat*Math.PI/180) * Math.sin(dLon/2)**2;
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 3440.065;
}

window.paxVoicePrepareBoarding = function() {
    const epoch = _paxMissionEpoch;
    let contract = null;
    try { contract = JSON.parse(localStorage.getItem('ga_active_mission_contract') || 'null'); } catch (_) {}
    contract = contract || window.activeMissionContract || (typeof currentMissionData !== 'undefined' ? currentMissionData?.missionContract : null) || {};
    const bush = contract?.bush && typeof contract.bush === 'object' ? contract.bush : null;
    const pickupKind = String(bush?.pickupKind || '').toLowerCase();
    const suppressOutboundPickupBoarding = !!(
        bush
        && String(bush.targetMode || '') === 'strip_then_return'
        && (pickupKind === 'passenger' || pickupKind === 'cargo')
    );
    if (suppressOutboundPickupBoarding) return Promise.resolve(null);
    const hasPassenger = !!window.activePassenger;
    const hasPaxMission = _missionHasPax();
    const hasCargoContext = !!_activeCargoText();
    if (!hasPassenger && !hasCargoContext && !hasPaxMission) return Promise.resolve(null);
    if (typeof window.paxVoicePrepareSurveyPattern === 'function') {
        try { window.paxVoicePrepareSurveyPattern(); } catch (_) {}
    }
    if (typeof window.paxVoicePreparePoiChain === 'function') {
        try { window.paxVoicePreparePoiChain(); } catch (_) {}
    }
    const key = _paxMissionAudioKey('boarding');
    const existing = _paxPreparedAudio.get(key);
    if (existing?.text || existing?.textPromise) return existing.textPromise || Promise.resolve(existing);
    const speaker = _speakerSnapshotForMissionVoice('boarding');
    const prompt = _boardingBriefingPrompt();
    if (!prompt) {
        const fallbackText = _buildBoardingText();
        _paxPreparedAudio.set(key, { text: fallbackText, speaker, audio: null, promise: null, epoch });
        _prepareTextAsTTS(key, fallbackText, speaker, epoch);
        return Promise.resolve(_paxPreparedAudio.get(key) || { key, text: fallbackText, speaker });
    }
    const textPromise = (async () => {
        if (!_paxEpochCurrent(epoch)) return null;
        const apiKey = _getApiKey();
        if (!apiKey) {
            const fallbackText = _buildBoardingText();
            if (!_paxEpochCurrent(epoch)) return null;
            _paxPreparedAudio.set(key, { text: fallbackText, speaker, audio: null, promise: null, epoch });
            _prepareTextAsTTS(key, fallbackText, speaker, epoch);
            return _paxPreparedAudio.get(key) || null;
        }
        try {
            _paxLog('Boarding-Briefing Preload → API-Call', 'event');
            _logRoleConsistencyCheck('Boarding');
            const spokenTextRaw = await _generateSpokenText(apiKey, prompt);
            if (!_paxEpochCurrent(epoch)) return null;
            const spokenText = _injectPattonvilleJuliusEasteregg(
                _injectPattonvilleReportingPointsHint(
                    _normalizeSpokenText(spokenTextRaw),
                    'Boarding'
                ),
                'Boarding'
            );
            const finalText = spokenText || _buildBoardingText();
            _paxPreparedAudio.set(key, { text: finalText, speaker, audio: null, promise: null, epoch });
            _prepareTextAsTTS(key, finalText, speaker, epoch);
            return _paxPreparedAudio.get(key) || null;
        } catch (e) {
            if (!_paxEpochCurrent(epoch)) return null;
            _paxLog(`Boarding-Briefing Preload Fehler: ${e.message || e}`, 'warn');
            const fallbackText = _buildBoardingText();
            _paxPreparedAudio.set(key, { text: fallbackText, speaker, audio: null, promise: null, epoch });
            _prepareTextAsTTS(key, fallbackText, speaker, epoch);
            return _paxPreparedAudio.get(key) || null;
        }
    })();
    _paxPreparedAudio.set(key, { prompt, speaker, textPromise, audio: null, promise: null, epoch });
    return textPromise;
};

window.paxVoicePlayBoarding = async function() {
    const epoch = _paxMissionEpoch;
    const key = _paxMissionAudioKey('boarding');
    if (_paxBoardingDone) return true;
    if (_paxBoardingReplayBlocked(key)) {
        _paxLog(`Boarding-Replay unterdrueckt (cooldown) | key:${key}`, 'state');
        _paxBoardingDone = true;
        _paxGreetingDone = true;
        return true;
    }
    if (_paxBoardingPromise) return _paxBoardingPromise;
    _paxBoardingPromise = (async () => {
        let prepared = await window.paxVoicePrepareBoarding();
        if (!_paxEpochCurrent(epoch)) return false;
        prepared = prepared || _paxPreparedAudio.get(key) || null;
        if (!prepared?.text && !window.activePassenger && !_missionHasPax()) return false;
        const speaker = prepared?.speaker || _speakerSnapshotForMissionVoice('boarding');
        const text = String(prepared?.text || _buildBoardingText() || '').trim();
        if (!text) return false;
        await _speakPreparedText(key, text, speaker, 'Boarding');
        if (!_paxEpochCurrent(epoch)) return false;
        _paxBoardingDone = true;
        _paxGreetingDone = true;
        _markPaxBoardingPlayed(key);
        return true;
    })();
    try {
        return await _paxBoardingPromise;
    } finally {
        _paxBoardingPromise = null;
    }
};

window.paxVoiceBoardingDone = function() {
    return !!_paxBoardingDone;
};

window.paxVoicePrepareGreeting = function(lat = null, lon = null) {
    const epoch = _paxMissionEpoch;
    if (_USE_COMBINED_BOARDING_GREETING) return Promise.resolve(null);
    if (_paxGreetingDone || !window.activePassenger || !_missionHasPax()) return Promise.resolve(null);
    const distNm = _distanceFromDepartureNm(lat, lon);
    if (Number.isFinite(distNm) && distNm > 1.0) {
        _paxLog(`Greeting Preload übersprungen: ${distNm.toFixed(1)} NM vom Startplatz`, 'state');
        return Promise.resolve(null);
    }
    const prompt = _greetingPrompt();
    if (!prompt) return Promise.resolve(null);
    const key = _paxMissionAudioKey('greeting');
    const existing = _paxPreparedAudio.get(key);
    if (existing?.text || existing?.textPromise) return existing.textPromise || Promise.resolve(existing);
    const speaker = _speakerSnapshotForActivePax();
    const textPromise = (async () => {
        if (!_paxEpochCurrent(epoch)) return null;
        const apiKey = _getApiKey();
        if (!apiKey) return null;
        try {
            _paxLog('Greeting Preload → API-Call', 'event');
            _logRoleConsistencyCheck('Begrüßung');
            const spokenTextRaw = await _generateSpokenText(apiKey, prompt);
            if (!_paxEpochCurrent(epoch)) return null;
            const spokenText = _injectPattonvilleJuliusEasteregg(
                _injectPattonvilleReportingPointsHint(
                    _normalizeSpokenText(spokenTextRaw),
                    'Begrüßung'
                ),
                'Begrüßung'
            );
            if (!spokenText) return null;
            _paxPreparedAudio.set(key, { text: spokenText, speaker, audio: null, promise: null, epoch });
            _prepareTextAsTTS(key, spokenText, speaker, epoch);
            return _paxPreparedAudio.get(key) || null;
        } catch (e) {
            if (!_paxEpochCurrent(epoch)) return null;
            _paxLog(`Greeting Preload Fehler: ${e.message || e}`, 'warn');
            const rec = _paxPreparedAudio.get(key) || {};
            rec.textPromise = null;
            rec.epoch = epoch;
            _paxPreparedAudio.set(key, rec);
            return null;
        }
    })();
    _paxPreparedAudio.set(key, { prompt, speaker, textPromise, audio: null, promise: null, epoch });
    return textPromise;
};

// ─── PROMPT BUILDERS ─────────────────────────────────────────────────────────

function _normUrgencyPriority(v) {
    const s = String(v || '').trim().toLowerCase();
    return s === 'hoch' ? 'hoch' : 'niedrig';
}

function _paxTextHasPowerlineLandmark(text = '') {
    return /(strommast|strommasten|stromtrasse|stromleitung|freileitung|hochspann|hochspannung|powerline|power\s+line|power\s+pylon|power\s+tower|umspannwerk|leitungsmast|stromnetz)/i.test(String(text || ''));
}

function _paxTextHasWindLandmark(text = '') {
    return /(windrad|windraeder|windräder|windturbine|wind\s+turbine|windkraft|windpark|windenergie|rotorblatt|rotor)/i.test(String(text || ''));
}

function _paxTextHasBridgeLandmark(text = '') {
    return /(bruecke|brücke|brucke|bridge|viadukt|aquadukt)/i.test(String(text || ''));
}

function _paxTextHasRiverLandmark(text = '') {
    return /\b(fluss|river|kanal|canal|wasserlauf)\b/i.test(String(text || ''));
}

function _paxTextHasMotorwayLandmark(text = '') {
    return /(autobahn|autobahnkreuz|autobahndreieck|schnellstrasse|schnellstraße|motorway|trunk|interchange)/i.test(String(text || ''));
}

function _paxTextHasRailwayLandmark(text = '') {
    return /(eisenbahn|bahnlinie|bahntrasse|schiene|gleis|railway|rail\s+line)/i.test(String(text || ''));
}

function _paxTextHasTowerLandmark(text = '') {
    return /(funkturm|sendemast|fernsehturm|wasserturm|aussichtsturm|turm|tower|mast)/i.test(String(text || ''));
}

function _paxGeoContextHasAnchor(key = '', maxDistM = 700) {
    const anchors = _paxTargetGeoContext()?.anchors || {};
    const anchor = anchors[key];
    if (!anchor?.present) return false;
    const dist = Number(anchor.distM);
    return !Number.isFinite(dist) || dist <= maxDistM;
}

function _paxMemoryMentionsLandmark(lm = null) {
    const mem = _poiNarrativeMemoryText()
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/ß/g, 'ss');
    if (!mem) return false;
    const kind = String(lm?.kind || '').toLowerCase();
    const terms = [
        lm?.name,
        lm?.label,
        kind,
        kind === 'power_tower' ? 'strommast' : '',
        kind === 'powerline' ? 'freileitung' : '',
        kind === 'railway' ? 'eisenbahn' : '',
        kind === 'peak' ? 'gipfel' : '',
        kind?.startsWith?.('terrain_') ? 'gelaendemarke' : '',
        kind === 'viewpoint' ? 'aussichtspunkt' : ''
    ].map(x => String(x || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/ß/g, 'ss')
        .trim())
        .filter(x => x.length >= 4);
    return terms.some(term => mem.includes(term));
}

function _paxConfirmedVisualLandmarks(maxDistM = 500) {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const contract = md.missionContract || window.activeMissionContract || null;
    const fromGeo = md.targetGeoContext?.visualLandmarks || contract?.targetGeoContext?.visualLandmarks || [];
    const fromTruth = md.missionTruth?.visualLandmarks || contract?.missionTruth?.visualLandmarks || [];
    const seen = new Set();
    return [...(Array.isArray(fromGeo) ? fromGeo : []), ...(Array.isArray(fromTruth) ? fromTruth : [])]
        .filter(lm => {
            const kind = String(lm?.kind || '').toLowerCase();
            const dist = Number(lm?.distM);
            if (!kind || (Number.isFinite(dist) && dist > maxDistM)) return false;
            const key = `${kind}|${Math.round((Number.isFinite(dist) ? dist : 0) / 10)}|${String(lm?.name || '').toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((a, b) => Number(a.distM || 999999) - Number(b.distM || 999999))
        .slice(0, 6);
}

function _paxHasVisualLandmarkKind(kinds = [], maxDistM = 500) {
    const wanted = new Set((Array.isArray(kinds) ? kinds : [kinds]).map(k => String(k || '').toLowerCase()).filter(Boolean));
    if (!wanted.size) return false;
    return _paxConfirmedVisualLandmarks(maxDistM).some(lm => wanted.has(String(lm?.kind || '').toLowerCase()));
}

function _paxTargetProminenceLine() {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const contract = md.missionContract || window.activeMissionContract || null;
    const prominence = md.missionTruth?.targetProminence || contract?.missionTruth?.targetProminence || null;
    if (!prominence?.level) return '';
    return `ZIEL-AUFFAELLIGKEIT: ${String(prominence.level)} (${String(prominence.reason || 'n/a')}).`;
}

function _paxVisualLandmarksLine() {
    const task = _activeTaskDomain();
    if (!/^(poi_learning_guide|sightseeing_tour|historian_guided_tour)$/.test(task)) return '';
    const maxDistM = task === 'poi_learning_guide' ? 750 : 500;
    let landmarks = _paxConfirmedVisualLandmarks(maxDistM);
    const fresh = landmarks.filter(lm => !_paxMemoryMentionsLandmark(lm));
    if (fresh.length) landmarks = fresh;
    if (!landmarks.length) return '';
    const items = landmarks.slice(0, task === 'poi_learning_guide' ? 3 : 6).map(lm => {
        const name = String(lm.name || lm.label || lm.kind || 'Landmarke').trim();
        const dist = Number.isFinite(Number(lm.distM)) ? `${Math.round(Number(lm.distM))}m` : 'nah';
        const rel = lm.relFromTarget ? `${lm.relFromTarget} vom Ziel` : '';
        const inverse = lm.targetFromLandmark ? `Ziel ${lm.targetFromLandmark} davon` : '';
        return [name, dist, rel, inverse].filter(Boolean).join(', ');
    }).join(' | ');
    return `BESTAETIGTE VISUELLE REFERENZEN (max ${maxDistM}m): ${items}. Nutze pro Ansage hoechstens eine davon und bevorzuge eine noch nicht genannte Referenz. Nicht erfinden, nicht als Hauptthema ausbauen.`;
}

function _paxApproachLandmarkPolicy() {
    if (!_isPOIMission() || _activeAptTrainingPlan()) return null;
    const task = _activeTaskDomain();
    const expertTargets = new Set([
        'inspection_infra',
        'infra_chain_recon',
        'mapping_survey',
        'science_bio',
        'science_geo',
        'fire_watch',
        'search_and_rescue',
        'media_photo',
        'news_coverage'
    ]);
    const observerTargets = new Set([
        'poi_learning_guide',
        'sightseeing_tour',
        'historian_guided_tour'
    ]);
    if (expertTargets.has(task)) {
        return {
            mode: 'expert',
            maxDistM: 500,
            prefix: '4-NM-ZIELABGLEICH',
            instruction: 'Nutze die Referenz zur fachlichen Ziel-Identifikation. Wenn mehrere aehnliche Objekte sichtbar sein koennen, beschreibe knapp, welches davon das gesuchte Ziel ist. Keine Steuer-, Kurs-, Hoehen- oder Manöveranweisung geben.'
        };
    }
    if (observerTargets.has(task)) {
        return {
            mode: 'observer',
            maxDistM: task === 'poi_learning_guide' ? 750 : 500,
            prefix: '4-NM-ORIENTIERUNG',
            instruction: 'Nutze die Referenz nur als beobachtende Lagebeschreibung fuer den Piloten. Keine Flugmanöver, keine Kurs-/Hoehenvorgaben, keine Instruktor- oder Einsatzsprache.'
        };
    }
    return null;
}

function _paxApproachLandmarkCueLine() {
    const policy = _paxApproachLandmarkPolicy();
    if (!policy) return '';
    const maxDistM = policy.maxDistM;
    const priority = {
        railway: 1,
        peak: 2,
        terrain_ridge: 3,
        terrain_pass: 4,
        terrain_cliff: 5,
        viewpoint: 6,
        river: 7,
        canal: 8,
        bridge: 9,
        motorway: 10,
        motorway_junction: 11,
        tower: 12,
        power_tower: 13,
        powerline: 14,
        wind_turbine: 15
    };
    let landmarks = _paxConfirmedVisualLandmarks(maxDistM).filter(lm => !_paxMemoryMentionsLandmark(lm));
    if (!landmarks.length) landmarks = _paxConfirmedVisualLandmarks(maxDistM);
    const lm = landmarks
        .slice()
        .sort((a, b) => {
            const ak = priority[String(a?.kind || '').toLowerCase()] || 50;
            const bk = priority[String(b?.kind || '').toLowerCase()] || 50;
            if (ak !== bk) return ak - bk;
            return Number(a?.distM || 999999) - Number(b?.distM || 999999);
        })[0];
    if (lm) {
        const name = String(lm.name || lm.label || lm.kind || 'Landmarke').replace(/\s+/g, ' ').trim();
        const dist = Number.isFinite(Number(lm.distM)) ? `etwa ${Math.round(Number(lm.distM))} Meter` : 'in Zielnaehe';
        const rel = lm.relFromTarget ? `${lm.relFromTarget} vom POI` : 'vom POI aus sichtbar';
        const inverse = lm.targetFromLandmark ? `der POI liegt ${lm.targetFromLandmark} davon` : 'nutze sie als Bezug zum POI';
        return `${policy.prefix}: Bestaetigte Referenz: ${name}, ${dist} ${rel}; ${inverse}. ${policy.instruction} Danach hoechstens ein kurzer Zusatzfakt, keine zweite Landmarke.`;
    }

    const anchors = _paxTargetGeoContext()?.anchors || {};
    const anchorDefs = [
        ['railway', 'Bahnlinie', 'verlaeuft'],
        ['terrain', 'Gelaendemarke', 'liegt'],
        ['viewpoint', 'Aussichtspunkt', 'liegt'],
        ['water', 'Gewaesser/Ufer', 'liegt'],
        ['forest', 'Waldkante', 'liegt'],
        ['road', 'Strasse/Zufahrt', 'liegt'],
        ['path', 'Weg/Pfad', 'liegt'],
        ['power', 'Stromtrasse', 'liegt']
    ];
    for (const [key, label, verb] of anchorDefs) {
        const a = anchors?.[key];
        const dist = Number(a?.distM);
        const bearing = Number(a?.bearingDeg);
        if (!a?.present || !Number.isFinite(dist) || dist > maxDistM || !Number.isFinite(bearing)) continue;
        const name = String(a.name || '').replace(/\s+/g, ' ').trim();
        const fullLabel = name && !/^(road|path|water|forest|terrain|railway|power)$/i.test(name) ? `${label} ${name}` : label;
        const rel = _paxCardinalGerman(bearing);
        const inverse = _paxCardinalGerman(bearing + 180);
        return `${policy.prefix}: Bestaetigte Referenz: ${fullLabel} ${verb} etwa ${Math.round(dist)} Meter ${rel} vom POI; der POI liegt ${inverse} davon. ${policy.instruction} Danach hoechstens ein kurzer Zusatzfakt, keine zweite Landmarke.`;
    }
    return '';
}

function _paxMissionTruthMainKind(key = '') {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const contract = md.missionContract || window.activeMissionContract || null;
    const truth = md.missionTruth || contract?.missionTruth || null;
    const mainKind = String(truth?.mainTarget?.kind || '').toLowerCase();
    const anchorKind = String(truth?.sceneAnchor?.kind || '').toLowerCase();
    return mainKind === key || anchorKind === key;
}

function _sanitizePaxSoftPoiStory(text = '') {
    const task = _activeTaskDomain();
    if (!/^(poi_learning_guide|sightseeing_tour|historian_guided_tour)$/.test(task)) return String(text || '').trim();
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const targetName = `${String(md.poiName || '')} ${String(md.targetName || '')}`;
    const powerAllowed = _paxTextHasPowerlineLandmark(targetName) || _paxGeoContextHasAnchor('power', 500) || _paxHasVisualLandmarkKind(['power_tower', 'powerline']) || _paxMissionTruthMainKind('power');
    const windAllowed = _paxTextHasWindLandmark(targetName) || _paxGeoContextHasAnchor('wind', 500) || _paxHasVisualLandmarkKind('wind_turbine') || _paxMissionTruthMainKind('wind');
    const bridgeAllowed = _paxTextHasBridgeLandmark(targetName) || _paxGeoContextHasAnchor('bridge', 500) || _paxHasVisualLandmarkKind('bridge') || _paxMissionTruthMainKind('bridge');
    const riverAllowed = _paxTextHasRiverLandmark(targetName) || _paxHasVisualLandmarkKind(['river', 'canal']) || _paxMissionTruthMainKind('water_edge') || _paxMissionTruthMainKind('water');
    const motorwayAllowed = _paxTextHasMotorwayLandmark(targetName) || _paxHasVisualLandmarkKind(['motorway', 'motorway_junction']) || _paxMissionTruthMainKind('road');
    const railwayAllowed = _paxTextHasRailwayLandmark(targetName) || _paxGeoContextHasAnchor('railway', 750) || _paxGeoContextHasAnchor('rail', 750) || _paxHasVisualLandmarkKind('railway', 750) || _paxMissionTruthMainKind('rail');
    const towerAllowed = _paxTextHasTowerLandmark(targetName) || _paxHasVisualLandmarkKind(['tower', 'power_tower', 'wind_turbine']) || _paxMissionTruthMainKind('power');
    const raw = String(text || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    const sentences = raw
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(Boolean);
    const kept = sentences.filter(sentence => {
        if (!powerAllowed && _paxTextHasPowerlineLandmark(sentence)) return false;
        if (!windAllowed && _paxTextHasWindLandmark(sentence)) return false;
        if (!bridgeAllowed && _paxTextHasBridgeLandmark(sentence)) return false;
        if (!riverAllowed && _paxTextHasRiverLandmark(sentence)) return false;
        if (!motorwayAllowed && _paxTextHasMotorwayLandmark(sentence)) return false;
        if (!railwayAllowed && _paxTextHasRailwayLandmark(sentence)) return false;
        if (!towerAllowed && _paxTextHasTowerLandmark(sentence)) return false;
        return true;
    });
    if (kept.length) return kept.join(' ');
    if (!powerAllowed && _paxTextHasPowerlineLandmark(raw)) return '';
    if (!windAllowed && _paxTextHasWindLandmark(raw)) return '';
    if (!bridgeAllowed && _paxTextHasBridgeLandmark(raw)) return '';
    if (!riverAllowed && _paxTextHasRiverLandmark(raw)) return '';
    if (!motorwayAllowed && _paxTextHasMotorwayLandmark(raw)) return '';
    if (!railwayAllowed && _paxTextHasRailwayLandmark(raw)) return '';
    if (!towerAllowed && _paxTextHasTowerLandmark(raw)) return '';
    return raw;
}

function _baseContext() {
    const pax  = window.activePassenger;
    const md   = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    const story = _sanitizePaxSoftPoiStory(_getMissionStory());
    if (!pax || !md) return null;

    const cargo = document.getElementById('mWeight')?.innerText?.trim() || '';
    const payload = document.getElementById('mPay')?.innerText?.trim() || '';
    const pickupPaxContext = _activeBushPickupPassengerContract();
    const pickupPaxActive = !!(pickupPaxContext && window.activePassenger);
    const pickupRole = String(pax?.role || pickupPaxContext?.bush?.pickupRole || 'Pickup-Gast').trim();
    const onboardPax = pickupPaxActive
        ? `1 PAX (${pickupRole})`
        : (payload || (_missionHasPax() ? '1 PAX' : '0 PAX'));
    const onboardCargo = cargo || 'keine besondere Ausruestung';
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
    let storyShort = String(story || '').trim().replace(/\s+/g, ' ').slice(0, 260);
    if (pickupPaxActive) {
        const pickupStory = _bushPickupStoryData(pickupPaxContext, pax);
        const why = pickupStory.boardingCue
            ? ` ${pickupStory.boardingCue}`
            : (pickupStory.whyThere ? ` Auftrag vor Ort: ${pickupStory.whyThere}.` : '');
        const back = pickupStory.returnReason ? ` ${_bushPickupReturnSentence(pickupStory.returnReason)}` : '';
        storyShort = `Ich bin ${pickupStory.personName}${pickupStory.role ? `, ${pickupStory.role},` : ''} und wurde ${pickupStory.exactWhere} abgeholt.${why} Jetzt fliege ich als Passagier zurück nach ${pickupStory.homePlace}.${back}`;
    }
    const trainingDiscipline = trainingPlan
        ? `TRAINING (${trainingPlan.mode}): Nur fliegerische Inhalte, prozedural, sicherheitsfokussiert. Kein Sightseeing/Ortsstory.`
        : '';
    const contractSummary = contract?.summary ? String(contract.summary).trim() : '';
    const contractRules = Array.isArray(contract?.constraints)
        ? contract.constraints.map(x => String(x || '').trim()).filter(Boolean).slice(0, 3).join(' | ')
        : '';
    const aptArrivalLine = _aptArrivalContextLine(md, contract);
    const fireHazard = md?.fireHazard || null;
    const fireHazardLine = (_activeTaskDomain() === 'fire_watch' && Number.isFinite(Number(fireHazard?.level)))
        ? `FEUERLAGE (DWD): Waldbrandgefahrenindex Stufe ${Math.round(Number(fireHazard.level))} von 5 (${String(fireHazard.label || 'n/a')})${fireHazard?.dateIso ? `, Stand ${fireHazard.dateIso}` : ''}.`
        : '';
    const roleGuard = `ROLLENFIX: Sprich ausschließlich als ${pax.name} (${pax.role}) in Ich-Form. Keine Rollenvermischung.`;
    const flightStart = pickupPaxActive
        ? (pickupPaxContext?.bush?.targetRef?.name || md.poiName || md.dest || '?')
        : (md.start || '?');
    const flightDest = pickupPaxActive
        ? (pickupPaxContext?.bush?.homeRef?.name || md.start || '?')
        : (md.poiName || md.dest || '?');
    const lines = [
`ROLLE: ${pax.name} (${pax.role}) · Persönlichkeit: ${pax.personality}
FLUG: ${flightStart} → ${flightDest} · ${md.dist || '?'} NM
AN BORD: ${onboardPax}
AUSRUESTUNG: ${onboardCargo}
AUFTRAG (kurz): ${storyShort || 'n/a'}
STIL: ${roleStyle}
DRINGLICHKEIT: ${urgency}
${urgencyLine}`
    ];
    if (trainingDiscipline) lines.push(trainingDiscipline);
    if (contractSummary) lines.push(`MISSION-CONTRACT: ${contractSummary}`);
    if (contractRules) lines.push(`CONTRACT-REGELN: ${contractRules}`);
    if (aptArrivalLine) lines.push(aptArrivalLine);
    if (fireHazardLine) lines.push(fireHazardLine);
    if (_activeTaskDomain() === 'poi_learning_guide') {
        lines.push('LERN-GUIDE-FIX: Du bist der Guide und erklaerst dem Piloten die Gegend. Nicht sagen, dass du selbst fuer spaetere Touren lernst oder das Gelaende abspeicherst. Gib pro Meldung mindestens einen konkreten Fakt, Kontext oder eine visuelle Orientierung. Wiederhole keine bereits genannte Landmarke, wenn eine neue Referenz oder ein neuer Umfeld-Fakt verfuegbar ist.');
        const knowledgeQueueLine = _poiKnowledgeQueueContextLine();
        if (knowledgeQueueLine) lines.push(knowledgeQueueLine);
    }
    const sightseeingKnowledgeLine = _poiSightseeingKnowledgeContextLine();
    if (sightseeingKnowledgeLine) lines.push(sightseeingKnowledgeLine);
    const targetProminenceLine = _paxTargetProminenceLine();
    const visualLandmarksLine = _paxVisualLandmarksLine();
    const storyFrame = _activeMissionStoryFrame();
    const storyFrameLine = storyFrame ? [
        `MISSION-LAGE: Ausloeser=${String(storyFrame.trigger || '').trim() || 'n/a'}`,
        `Fokus=${String(storyFrame.focusSubject || '').trim() || 'n/a'}`,
        `Offene Frage=${String(storyFrame.keyQuestion || '').trim() || 'n/a'}`,
        `Abschluss=${String(storyFrame.completionSignal || '').trim() || 'n/a'}`
    ].join(' | ') : '';
    const storyFrameDetailLine = storyFrame ? [
        `MISSION-HINTERGRUND: Detail=${String(storyFrame.subjectDetail || '').trim() || 'n/a'}`,
        `Lage=${String(storyFrame.incidentContext || '').trim() || 'n/a'}`,
        `Warum jetzt=${String(storyFrame.whyNow || '').trim() || 'n/a'}`,
        `Benoetigt=${String(storyFrame.soughtOutcome || '').trim() || 'n/a'}`
    ].join(' | ') : '';
    const storyFrameSarLine = storyFrame ? [
        `MISSION-INCIDENT: Typ=${String(storyFrame.incidentType || '').trim() || 'n/a'}`,
        `Zuletzt=${String(storyFrame.lastSeenContext || '').trim() || 'n/a'}`,
        `Vermutung=${String(storyFrame.probableScenario || '').trim() || 'n/a'}`,
        `Hinweise=${Array.isArray(storyFrame.visibleClueCandidates) && storyFrame.visibleClueCandidates.length ? storyFrame.visibleClueCandidates.join(', ') : 'n/a'}`
    ].join(' | ') : '';
    if (targetProminenceLine) lines.push(targetProminenceLine);
    if (visualLandmarksLine) lines.push(visualLandmarksLine);
    if (pickupPaxActive) {
        const pickupStory = _bushPickupStoryData(pickupPaxContext, pax);
        const isAptCharterPickup = String(pickupPaxContext?.bush?.profileId || '').toLowerCase() === 'apt_charter_pickup';
        const pickupStoryLine = [
            `${isAptCharterPickup ? 'APT-CHARTER-PICKUP-STORY' : 'BUSH-PICKUP-STORY'}: Name=${pickupStory.personName}`,
            `Rolle=${pickupStory.role || 'n/a'}`,
            `Wartepunkt=${pickupStory.exactWhere}`,
            pickupStory.whyThere ? `${isAptCharterPickup ? 'Aufenthalt/Termin' : 'Auftrag draußen'}=${pickupStory.whyThere}` : '',
            pickupStory.returnReason ? `Rückkehrgrund=${pickupStory.returnReason}` : '',
            pickupStory.boardingCue ? `Einstieg-Cue=${pickupStory.boardingCue}` : '',
            pickupStory.departureCue ? `Rückflug-Cue=${pickupStory.departureCue}` : ''
        ].filter(Boolean).join(' | ');
        lines.push(pickupStoryLine);
    } else {
        if (storyFrameLine) lines.push(storyFrameLine);
        if (storyFrameDetailLine) lines.push(storyFrameDetailLine);
        if (storyFrameSarLine) lines.push(storyFrameSarLine);
    }
    const bushToneLine = _bushVoiceToneLine();
    if (bushToneLine) lines.push(bushToneLine);
    const bushPickupPerspectiveLine = _bushPickupPassengerPerspectiveLine();
    if (bushPickupPerspectiveLine) lines.push(bushPickupPerspectiveLine);
    lines.push(roleGuard);
    lines.push(`TASK-DOMAIN: ${_activeTaskDomain()}
AUSGABE: Nur gesprochener Text (kein Markdown, keine Regieanweisungen, keine Anführungszeichen).`);
    return lines.join('\n');
}

function _activeAptArrivalPlan(mdArg = null, contractArg = null) {
    if (_isPOIMission()) return null;
    const md = mdArg || (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    let contract = contractArg || md?.missionContract || window.activeMissionContract || null;
    if (!contract) {
        try { contract = JSON.parse(localStorage.getItem('ga_active_mission_contract') || 'null'); } catch (_) { contract = null; }
    }
    const truth = md?.missionTruth || contract?.missionTruth || null;
    const bush = contract?.bush && typeof contract.bush === 'object' ? contract.bush : null;
    const bushProgress = md?.bushProgress && typeof md.bushProgress === 'object' ? md.bushProgress : null;
    const bushStatus = String(bushProgress?.status || '').toLowerCase();
    if (
        bush
        && String(bush.targetMode || '') === 'strip_then_return'
        && ['passenger', 'cargo'].includes(String(bush.pickupKind || '').toLowerCase())
        && ['return_leg', 'home_unloading', 'ready_to_close'].includes(bushStatus)
    ) {
        return null;
    }
    const plan = md?.aptArrivalPlan || contract?.aptArrivalPlan || truth?.arrivalScene || null;
    if (!plan || typeof plan !== 'object') return null;
    const lat = Number(plan.lat);
    const lon = Number(plan.lon);
    return {
        ...plan,
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null
    };
}

function _aptArrivalCue(plan = null) {
    const p = plan || _activeAptArrivalPlan();
    if (!p) return '';
    const expectedBy = String(p.expectedBy || p.roleLabel || p.role || '').trim();
    const visibleCue = String(p.visibleCue || '').trim();
    if (expectedBy && visibleCue) return `${expectedBy}, erkennbar an ${visibleCue}`;
    return expectedBy || visibleCue || String(p.narrativeHint || '').trim();
}

function _aptArrivalLocationLabel(plan = null) {
    const p = plan || _activeAptArrivalPlan();
    if (!p) return 'Empfangspunkt';
    const semantic = String(p.semantic || p.anchorType || '').toLowerCase();
    const cues = Array.isArray(p.cues) ? p.cues.join(' ').toLowerCase() : '';
    const policy = Array.isArray(p.snapPolicy?.prefer) ? p.snapPolicy.prefer.join(' ').toLowerCase() : '';
    const text = `${semantic} ${cues} ${policy}`;
    if (/hangar/.test(text)) return 'bei den Hangars';
    if (/zufahrt|gate|access|road|entrance/.test(text)) return 'an der Zufahrt';
    if (/apron|vorfeld/.test(text)) return 'am Vorfeld';
    if (/parking|parkposition|parking_position/.test(text)) return 'am Parking-Bereich';
    return 'am geplanten Empfangspunkt';
}

function _aptArrivalContextLine(md = null, contract = null) {
    const plan = _activeAptArrivalPlan(md, contract);
    if (!plan) return '';
    const cue = _aptArrivalCue(plan);
    const label = String(plan.roleLabel || plan.role || 'Empfangsszene').trim();
    const location = _aptArrivalLocationLabel(plan);
    const source = String(plan.source || plan.anchorType || '').trim();
    const hint = String(plan.narrativeHint || '').trim();
    const parts = [`APT-ARRIVAL: ${label}`];
    if (location) parts.push(`Ort: ${location}`);
    if (cue) parts.push(`wartet am Ziel: ${cue}`);
    if (source) parts.push(`Planquelle: ${source}`);
    if (hint) parts.push(`Hinweis: ${hint}`);
    parts.push('Nur bei Anflug, Landung und Rollen grob darauf Bezug nehmen; keine Spawn-Objektliste vorlesen.');
    return parts.join(' | ');
}

function _aptArrivalApproachHint() {
    const plan = _activeAptArrivalPlan();
    const cue = _aptArrivalCue(plan);
    if (!cue) return '';
    return ` APT-Arrival-Hinweis: Bereite kurz auf den Empfangspunkt vor. Erwaehne grob, dass am Ziel ${cue} wartet. Das ist die Ankunfts-/Uebergabe-Meldung vor der Landung, kein langer Debrief und keine Objektliste.`;
}

function _aptArrivalAfterLandingHint() {
    const plan = _activeAptArrivalPlan();
    const cue = _aptArrivalCue(plan);
    if (!cue) return '';
    const place = _aptArrivalLocationLabel(plan);
    return `Nach der Landung: Gib nur ein kurzes Feedback zur Landung und sag, dass wir ${place} rollen sollen; dort wartet ${cue}. Keine Verabschiedung, keine Flugzusammenfassung, keine detaillierte Objektliste.`;
}

function _aptArrivalFarewellHint() {
    const plan = _activeAptArrivalPlan();
    const cue = _aptArrivalCue(plan);
    if (!cue) return '';
    const place = _aptArrivalLocationLabel(plan);
    return `Wir stehen jetzt ${place}; dort wartet ${cue}. Das ist jetzt der eigentliche Abschied am Empfangspunkt. Du darfst den Flug kurz zusammenfassen und dann zur Uebergabe/Abholung ueberleiten.`;
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
        return 'technisch-präzise und ruhig: Survey-Ziel, geplante Linie oder Orbit, stabile Höhe, Abdeckung und Datengüte stehen im Vordergrund; keine Sightseeing- oder Schadenssprache.';
    }
    if (taskDomain === 'science_bio') {
        return 'wissenschaftlich ruhig und beobachtend: Biologie, Lebensraum, Artenhinweise, Ufer- oder Vegetationsstruktur und Datenguete stehen im Vordergrund; keine Sightseeing-, Technik- oder Einsatzsprache.';
    }
    if (taskDomain === 'science_geo') {
        return 'geologisch sachlich und ruhig: Relief, Erosion, Hangform, Sedimente, Uferkanten und Geländestruktur stehen im Vordergrund; keine Bio-, Sightseeing- oder Inspektionssprache.';
    }
    if (taskDomain === 'news_coverage') {
        return 'sachlich beobachtend und professionell: kurze, nüchterne Lageeinschätzung ohne Show.';
    }
    if (taskDomain === 'media_photo') {
        return 'bildredaktionell und ruhig: Motiv, Perspektive, Ortsbezug und verwertbares Material stehen im Vordergrund, kein Sightseeing-Ton.';
    }
    if (taskDomain === 'historian_guided_tour') {
        return 'anschaulich-historisch und bildungsorientiert: Ortsbild, alte Wege, Lagebezug oder fruehere Nutzung konkret einordnen, keine Technik-Inspektion.';
    }
    if (taskDomain === 'poi_learning_guide') {
        return 'locker-bildend und faktenorientiert: kurze Orientierung, klare Einordnung, kein Anweisungsstil.';
    }
    if (taskDomain === 'bush_adventure') {
        return 'locker, bodenstaendig und leicht gespannt: wildnisnah, ruhig, mit persoenlichem Backcountry-Faden und klarem Bezug zum Aufenthalt nach der Landung.';
    }
    if (taskDomain === 'sightseeing_tour') {
        if (_isBushAdventureMission()) {
            return 'locker, bodenstaendig und leicht staunend: wildnisnah, ruhig, mit persoenlichem Backcountry-Faden; kein Stadt-, Event- oder Prospektton.';
        }
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
    const isSightseeing = taskDomain === 'sightseeing_tour';
    const hasPoiKnowledge = !!_activePoiKnowledgeContext();
    const isProfessionalPoiTask = /^(inspection_infra|infra_chain_recon|mapping_survey|science_bio|science_geo|fire_watch|media_photo|news_coverage)$/.test(taskDomain);
    const inspHint = isHistorian ? '' : _inspectionEntryHint();
    const profHint = isHistorian ? '' : _professionalTaskHint('entry');
    const factHint = (taskDomain === 'search_and_rescue' || isLearningGuide || (isSightseeing && hasPoiKnowledge)) ? '' : _targetFactHint();
    const knowledgeFactHint = isLearningGuide ? _poiKnowledgeFactSequenceHint('entry') : (isSightseeing ? _poiKnowledgeFactHint('entry') : '');
    const driftGuard = _domainDriftGuard('entry');
    const historianHint = isHistorian
        ? ' Historiker-Rolle: Erzaehle 1 kurze historische Einordnung direkt zum Ort (Epoche, Nutzung oder lokales Ereignis). Keine Riss-/Technik-/Inspektionssprache.'
        : '';
    const learningGuideHint = isLearningGuide
        ? ' Lern-Guide-Rolle: Nenne einen kurzen Fakt, bei einer mehrteiligen WISSENS-FAKTENQUEUE auch 2-3 unterschiedliche Fakten als Mini-Erzaehlung direkt zum Ziel. Fuehre den Piloten ruhig zum Punkt. Keine Arbeitsanweisung, keine Hoehenforderung, kein "ich suche nach Schaeden".'
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
${isLearningGuide ? 'Fuehre den Piloten jetzt kurz zum Ziel und gib direkt einen kurzen Wissensbogen zum Ort.' : (isProfessionalPoiTask ? 'Du beginnst jetzt mit der fachlichen Zielaufnahme. Sag knapp, worauf du fuer den Auftrag achtest.' : 'Du siehst es zum ersten Mal aus der Luft. Zeig dem Piloten spontan was du erkennst.')}${reqHint}${inspHint}${profHint}${knowledgeFactHint}${factHint}${historianHint}${learningGuideHint}${sarZoneGuard}${trainingHint}
${noRepeatHint}
${driftGuard}
${taskDomain === 'search_and_rescue' ? '1-2 Saetze, einsatznah und klar, keine Begeisterungsformel.' : (isLearningGuide ? '2-4 kurze Sätze, anschaulich und ruhig, ohne zu dozieren.' : (isProfessionalPoiTask ? '1-2 Sätze, sachlich und fachlich, keine Begeisterungsformel.' : '1-2 Sätze, darf etwas begeisterter sein als sonst.'))}${_toneHint()}`;
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

function _poiInSightPrompt(flightData, distNm, etaMin, clockPos, options = {}) {
    const ctx = _baseContext();
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null);
    if (!ctx || !md) return null;
    if (_activeAptTrainingPlan()) return null;
    const taskDomain = _activeTaskDomain();
    const isHistorian = taskDomain === 'historian_guided_tour';
    const isLearningGuide = taskDomain === 'poi_learning_guide';
    const isSightseeing = taskDomain === 'sightseeing_tour';
    const hasPoiKnowledge = !!_activePoiKnowledgeContext();
    const approachLandmarkHint = _paxApproachLandmarkCueLine();
    const factHint = (taskDomain === 'search_and_rescue' || approachLandmarkHint || isLearningGuide || (isSightseeing && hasPoiKnowledge)) ? '' : _targetFactHint();
    const knowledgeFactHint = isLearningGuide || isSightseeing ? _poiKnowledgeFactHint('in_sight') : '';
    const driftGuard = _domainDriftGuard('in_sight');
    const announcedEta = Math.max(1, Math.round(Number(options.announcedEtaMin || 0) || 2)); // Default bewusst knapper wegen Latenz durch Text+TTS
    const roundedDist = Math.max(0.5, Math.round(distNm * 10) / 10);
    const realEta = Math.max(1, Math.round(etaMin));
    const pax = window.activePassenger || {};
    const targetAltFt = Number(pax?.targetAltFt || 0);
    const altBrief = (!isLearningGuide && !/^(sightseeing_tour|science_bio|science_geo)$/.test(taskDomain) && targetAltFt > 0)
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
        ? ' Lern-Guide-Rolle: Sage nicht "in Sicht", sondern orientiere den Piloten ruhig zur Position. Landmarken-Lokalisierung hat Vorrang; wenn es ohne Hektik passt, ergaenze genau einen neuen Wissensfakt.'
        : '';
    const roleTone = (taskDomain === 'search_and_rescue')
        ? 'SAR-Rolle: knapp, klar, lageorientiert, kein Sightseeing-Ton. Max 2 Saetze.'
        : (isLearningGuide
            ? 'Lern-Guide: bildend und klar, ohne Anweisungsstil oder Einsatzsprache. Max 2 Saetze.'
            : (isHistorian
                ? 'Historiker-Rolle: bildungsorientiert und anschaulich, kein Technik-/Inspektionston. Max 2 Saetze.'
                : (taskDomain === 'sightseeing_tour'
                    ? 'Sightseeing-Rolle: freundlich und beobachtend, keine Flug- oder Manöveranweisungen. Max 2 Saetze.'
                    : (/^(inspection_infra|infra_chain_recon|mapping_survey|science_bio|science_geo|fire_watch|media_photo|news_coverage)$/.test(taskDomain)
                        ? 'Fachrolle: knapp, professionell, zielbezogen, keine Steuer- oder Manöveranweisungen. Max 2 Sätze.'
                        : 'Rolle: kurz, glaubwuerdig und beobachtend, keine Flug- oder Manöveranweisungen. Max 2 Sätze.'))));
    return `${ctx}

Moment: Zielobjekt "${md.poiName || 'Ziel'}" wird im Anflug sichtbar. Distanz etwa ${roundedDist} NM, reale ETA ca. ${realEta} min, relative Lage ${clockPos}.
${isLearningGuide
        ? `Gib eine kurze Orientierung zur Lage in der 12-Uhr-Logik (${clockPos}) und nenne "ca. ${announcedEta} Minuten". Nutze danach bevorzugt eine bestaetigte Landmarke, um zu erklaeren, wo der POI liegt.`
        : `Sag dem Piloten kurz und sachlich, dass du das Objekt in Sicht hast, nenne die Lage in der 12-Uhr-Logik (${clockPos}) und ansage "ca. ${announcedEta} Minuten".`}${altBrief}${approachLandmarkHint ? `\n${approachLandmarkHint}` : ''}${knowledgeFactHint}${factHint}${sarZoneGuard}${historianInSightHint}${learningInSightHint} ${trainingHint}
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
    const isSightseeing = taskDomain === 'sightseeing_tour';
    const isMediaPhoto = taskDomain === 'media_photo';
    const isMappingSurvey = taskDomain === 'mapping_survey';
    const isScienceBio = taskDomain === 'science_bio';
    const isScienceGeo = taskDomain === 'science_geo';
    const reconOutcomeActive = _activeBushReconOutcome();
    const inspResultHint = reconOutcomeActive ? '' : _inspectionResultHint();
    const bushReconResultHint = _bushReconOutcomeHintLine('result');
    const profResultHint = _professionalTaskHint('result');
    const sarResultHint = _sarResultHint();
    const driftGuard = _domainDriftGuard('result');
    const historianResultHint = isHistorian
        ? ' Historiker-Fazit: Schließe mit 1 konkreten historischen Takeaway zum Ort (zeitliche Einordnung oder Bedeutung) und einem klaren Weiterflug-Hinweis. Keine technische Zustandsbewertung.'
        : '';
    const learningResultHint = isLearningGuide
        ? ' Lern-Guide-Fazit: Schließe mit 1 konkreten Lernpunkt zum Ziel, bei reichhaltiger WISSENS-FAKTENQUEUE auch mit 2 kurzen Takeaway-Fakten, und einem lockeren Hinweis, dass wir zum naechsten Punkt weiterkoennen.'
        : '';
    const knowledgeResultFactHint = isLearningGuide ? _poiKnowledgeFactSequenceHint('result') : (isSightseeing ? _poiKnowledgeFactHint('result') : '');
    const sightseeingResultHint = isSightseeing
        ? ' Sightseeing-Fazit: Schließe mit einem persoenlichen Blickmoment zum Ziel und einem entspannten Rueckflug-Hinweis. Nicht "fertig", "abgearbeitet" oder wie ein Auftrag klingen.'
        : '';
    const mediaResultHint = isMediaPhoto
        ? ' Foto/Film-Fazit: Schließe mit einem kurzen Satz, welche Art Material im Kasten ist (Aufmacherbild, Bildserie, Establishing Shots oder Ortsmotiv) und wohin es danach geht. Nicht wie Sightseeing klingen.'
        : '';
    const mappingResultHint = isMappingSurvey
        ? ' Survey-Fazit: Schließe mit einem kurzen Satz zu Abdeckung/Datenguete und dem naechsten Auswertungsschritt. Keine Schadensdiagnose, kein Sightseeing-Fazit.'
        : '';
    const scienceBioResultHint = isScienceBio
        ? ' Bio-Fazit: Schließe mit einem kurzen fachlichen Takeaway zu Habitat, Artenhinweis, Vegetation, Uferstruktur oder Stoerfaktor und nenne den naechsten Auswertungsschritt. Kein Sightseeing-Fazit.'
        : '';
    const scienceGeoResultHint = isScienceGeo
        ? ' Geo-Fazit: Schließe mit einem kurzen fachlichen Takeaway zu Relief, Erosion, Sediment, Uferkante oder Hangform und nenne den naechsten Auswertungsschritt. Kein Sightseeing-Fazit.'
        : '';
    const sarEndRule = (taskDomain === 'search_and_rescue')
        ? ' Formuliere ein klares Einsatzende mit Leitstellenbezug. Kein neutraler "alles im Kasten"-Satz.'
        : '';
    const inspectionCompletionRule = (taskDomain === 'inspection_infra' && !reconOutcomeActive)
        ? ' Gib zuerst ein fachliches Kurzfazit: Was hast du gesehen, wie sieht der Zustand aus, und ob Nacharbeit oder Beobachtung noetig ist. Erst danach darfst du den Weiter- oder Rueckflug freigeben.'
        : '';
    const noRepeatHint = _poiNoRepeatHint('result');
    let momentLine = `Moment: Ich bin fertig am Ziel (${dwell} Minuten).${wx ? ' ' + wx : ''}`;
    if (isSightseeing) {
        momentLine = `Moment: Die ruhige Sightseeing-Runde am Ziel hat nach ${dwell} Minuten ihren Blickmoment gehabt.${wx ? ' ' + wx : ''}`;
    } else if (isHistorian) {
        momentLine = `Moment: Die historische Runde am Ziel ist nach ${dwell} Minuten gut eingeordnet.${wx ? ' ' + wx : ''}`;
    } else if (isMediaPhoto) {
        momentLine = `Moment: Die Foto-/Filmserie am Ziel ist nach ${dwell} Minuten im Kasten.${wx ? ' ' + wx : ''}`;
    } else if (isMappingSurvey) {
        momentLine = `Moment: Der Survey-Pass am Ziel hat nach ${dwell} Minuten genug Datenzeit bekommen.${wx ? ' ' + wx : ''}`;
    } else if (isScienceBio) {
        momentLine = `Moment: Die biologische Beobachtungsrunde am Ziel hat nach ${dwell} Minuten genug Vergleichsbilder und Notizen geliefert.${wx ? ' ' + wx : ''}`;
    } else if (isScienceGeo) {
        momentLine = `Moment: Die geologische Beobachtungsrunde am Ziel hat nach ${dwell} Minuten genug Vergleichsbilder und Notizen geliefert.${wx ? ' ' + wx : ''}`;
    }

    let requestLine = 'Sag dem Piloten kurz, dass du fertig bist und wir weiterfliegen können.';
    if (isSightseeing) {
        requestLine = 'Sag dem Piloten kurz, dass der Blick gepasst hat und wir entspannt zurueckfliegen koennen.';
    } else if (isHistorian) {
        requestLine = 'Sag dem Piloten kurz, welcher historische Takeaway bleibt und dass wir ruhig zurueckfliegen koennen.';
    } else if (isMediaPhoto) {
        requestLine = 'Sag dem Piloten kurz, dass das Material verwertbar ist und wir zurueckfliegen koennen.';
    } else if (isMappingSurvey) {
        requestLine = 'Sag dem Piloten kurz, dass der Datensatz verwertbar wirkt und die Auswertung als naechster Schritt folgen kann.';
    } else if (isScienceBio) {
        requestLine = 'Sag dem Piloten kurz, welche biologische Beobachtung fuer die Auswertung haengen bleibt und dass wir zurueckfliegen koennen.';
    } else if (isScienceGeo) {
        requestLine = 'Sag dem Piloten kurz, welche geologische Beobachtung fuer die Auswertung haengen bleibt und dass wir zurueckfliegen koennen.';
    }
    return `${ctx}

${momentLine}
${requestLine}${sarResultHint}${inspResultHint}${bushReconResultHint}${inspectionCompletionRule}${profResultHint}${historianResultHint}${mediaResultHint}${mappingResultHint}${scienceBioResultHint}${scienceGeoResultHint}${knowledgeResultFactHint}${learningResultHint}${sightseeingResultHint}${sarEndRule}${noRepeatHint}${driftGuard} ${isLearningGuide ? '2-3 kurze Sätze.' : '1-2 Sätze.'}${_toneHint()}`;
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

function _poiRequiredTaskItemState() {
    if (typeof window.missionCargoEvaluateOutcome !== 'function') {
        return { missing: [], dropped: [], damaged: [], blockingItems: [], reason: 'missing' };
    }
    try {
        const outcome = window.missionCargoEvaluateOutcome();
        const normalize = (list) => [...new Set((Array.isArray(list) ? list : []).map(v => String(v || '').trim()).filter(Boolean))];
        const missing = normalize(outcome?.missingRequired);
        const dropped = normalize(outcome?.droppedRequired);
        const damaged = normalize(outcome?.damagedRequired);
        const blockingItems = [...new Set([...missing, ...dropped, ...damaged])];
        let reason = 'missing';
        if (damaged.length) reason = 'damaged';
        else if (dropped.length) reason = 'dropped';
        return { missing, dropped, damaged, blockingItems, reason };
    } catch (_) {
        return { missing: [], dropped: [], damaged: [], blockingItems: [], reason: 'missing' };
    }
}

function _aptMissingRequiredCargoItems() {
    if (typeof window.missionCargoEvaluateOutcome !== 'function') return [];
    try {
        const outcome = window.missionCargoEvaluateOutcome();
        const names = Array.isArray(outcome?.missingRequired)
            ? outcome.missingRequired
            : [];
        return [...new Set(names.map(v => String(v || '').trim()).filter(Boolean))];
    } catch (_) {
        return [];
    }
}

function _poiMissingCargoAbortPrompt(flightData, taskState = null) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const wx = _weatherContext(flightData);
    const state = taskState && typeof taskState === 'object'
        ? taskState
        : { missing: [], dropped: [], damaged: [], blockingItems: [], reason: 'missing' };
    const short = (Array.isArray(state.blockingItems) ? state.blockingItems : []).slice(0, 3).join(', ');
    const itemLine = state.reason === 'damaged'
        ? (short
            ? `${short} ist beschaedigt, damit kann ich den Auftrag hier nicht sauber zu Ende bringen.`
            : 'Ein wichtiger Gegenstand ist beschaedigt, damit kann ich den Auftrag hier nicht sauber zu Ende bringen.')
        : state.reason === 'dropped'
            ? (short
                ? `${short} ist nicht mehr einsatzbereit an Bord, das ist fuer meinen Auftrag wichtig.`
                : 'Ein wichtiger Gegenstand ist nicht mehr einsatzbereit an Bord.')
            : (short
                ? `Uns fehlt hier ${short}, das ist fuer meinen Auftrag wichtig.`
                : 'Uns fehlt hier ein wichtiger Gegenstand fuer meinen Auftrag.');
    return `${ctx}

Moment: Wir sind am Zielgebiet, aber ${itemLine}${wx ? ' ' + wx : ''}
Sag dem Piloten klar und ruhig, dass wir die Beobachtung jetzt abbrechen und direkt zum Start-/Heimatplatz zurückfliegen sollen. Kein Vorwurf, keine Verweilzeit, keine Arbeitsfortsetzung. Nenne den betroffenen Gegenstand beim Namen und benenne klar, ob er fehlt oder beschaedigt ist. Max 2 Sätze.${_toneHint()}`;
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
    const isBush = _isBushVoiceMission();
    const humorLine = _paxHumorLevel === 'subtle'
        ? 'Kein Witz.'
        : _paxHumorLevel === 'bold'
            ? 'Genau eine kurze, sympathische Pointe (nur wenn nicht sicherheitskritisch).'
            : 'Humor kurz und freundlich.';
    const greetingLine = _paxGreetingDone
        ? 'Keine neue Begrüßung am Satzanfang.'
        : (isBush ? 'Begrüßung höchstens kurz und unaufgeregt.' : 'Begrüßung höchstens kurz (z.B. "Hi").');
    const registerLine = isCharterNeutral
        ? 'Sprache klar und professionell.'
        : (isBush
            ? 'Sprache klar, direkt und bush-typisch, ohne Amtsdeutsch oder akademischen Ton.'
            : 'Sprache cockpitnah und natürlich, ohne Amtsdeutsch.');
    const colloquialLine = isCharterNeutral
        ? 'Wortwahl standardnah.'
        : (isBush
            ? 'Leicht raue, praktische Alltagssprache ist okay; kurz, bodenstaendig und glaubwuerdig bleiben.'
            : 'Leichte Umgangssprache okay, normal schreiben.');
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
    _paxMissionTimeout(() => _speakAndShow(p, 'Route läuft ab hier'), 300);
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

function _greetingMissionGuidance() {
    const pax = window.activePassenger;
    if (!pax) return null;
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    const isPOI = _isPOIMission();
    const trainingPlan = _activeAptTrainingPlan();
    const role = String(pax?.role || '').toLowerCase();
    const isClubTechRole = /(mechan|wartung|techn|inspekt|ingenieur|facility|vereins|hangar)/.test(role);
    const taskDomain = String(pax?.taskDomain || '').toLowerCase();
    const isReporterApt = (!isPOI && taskDomain === 'news_coverage');
    const isSightseeingApt = (!isPOI && taskDomain === 'sightseeing_tour');
    const isSightseeingPoi = (isPOI && taskDomain === 'sightseeing_tour');
    const isBushAdventure = (!isPOI && (taskDomain === 'bush_adventure' || (taskDomain === 'sightseeing_tour' && _isBushAdventureMission())));
    const isBushPickupReturn = (!isPOI && taskDomain === 'bush_pickup_return');
    const isLearningGuidePoi = (isPOI && taskDomain === 'poi_learning_guide');
    const isScienceBioPoi = (isPOI && taskDomain === 'science_bio');
    const isScienceGeoPoi = (isPOI && taskDomain === 'science_geo');
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
    let reqLine = '';
    if (isPOI) {
        if (trainingPlan) {
            reqLine = `Bitte nenne kurz das Übungsthema und wie wir es sicher und sauber abfliegen. Keine internen Parameter oder technischen Vorgaben zitieren.`;
        } else if (isLearningGuidePoi) {
            reqLine = `Bitte sag locker, dass du den Piloten zum Ziel fuehrst und dabei etwas ueber den Ort vermittelst. Keine Arbeitsanweisung, keine feste Arbeitshoehe, kein Komfort- oder Zeitdruckhinweis.`;
        } else if (isSightseeingPoi) {
            reqLine = `Bitte sag kurz und persoenlich, worauf du dich beim Blick auf das Ziel freust: Aussicht, Orientierung, Erinnerungsfotos oder gemeinsamer Ausflug. Keine Arbeitsanweisung, keine feste Arbeitshoehe, keine Navigations-, Kurs- oder Hoehenvorgaben, kein Zeitdruck.`;
        } else if (isScienceBioPoi) {
            reqLine = `Bitte sag ruhig und fachlich, welche biologische Beobachtung du am Zielgebiet machen willst: Habitat, Artenhinweise, Ufer-/Vegetationsstruktur oder Stoerfaktoren. Keine Arbeitshoehe, keine Flugmanöver, kein Sightseeing-Ton.`;
        } else if (isScienceGeoPoi) {
            reqLine = `Bitte sag ruhig und fachlich, welche geologische Beobachtung du am Zielgebiet machen willst: Relief, Hangform, Uferkante, Erosion, Sedimente oder Geländestruktur. Keine Arbeitshoehe, keine Flugmanöver, kein Sightseeing-Ton.`;
        } else {
            reqLine = `Bitte sag in natürlicher Sprache kurz, was du am Zielgebiet vorhast.${targetAltFt > 0 ? ` Erwähne dabei einmal die fürs Ziel geplante Arbeitshöhe (ungefähr ${targetAltFt} ft).` : ''}${(taskDomain === 'fire_watch' && Number.isFinite(Number(md?.fireHazard?.level))) ? ` Nenne bei der Einsatzlage kurz den offiziellen DWD-Waldbrandgefahrenindex (Stufe ${Math.round(Number(md.fireHazard.level))} von 5).` : ''} Keine internen Parameter oder technischen Vorgaben zitieren.`;
        }
    } else if (isReporterApt) {
        reqLine = comfortHintNeeded
            ? `Nenne kurz, was dein Reporter-Einsatz am Ziel vor Ort ist (1 konkreter Anlass). Nenne einen Komforthinweis nur wenn wirklich nötig. ${comfortContentRule}${timingHintNeeded ? ' Erwähne kurz, dass pünktliche Ankunft wichtig ist.' : ''} Sonst klarer Fokus auf Arbeit am Boden. KEINE Zielarbeitsanforderungen in der Luft wie feste Höhe, Überflug oder Verweildauer nennen.`
            : `Nenne kurz, was dein Reporter-Einsatz am Ziel vor Ort ist (1 konkreter Anlass), danach Fokus auf ${timingHintNeeded ? 'pünktliche ' : ''}Ankunft und Start der Arbeit am Boden. KEIN Komforthinweis. KEINE Zielarbeitsanforderungen in der Luft wie feste Höhe, Überflug oder Verweildauer nennen.`;
    } else if (isBushAdventure) {
        reqLine = `Sag kurz und persoenlich, warum du genau zu diesem Strip willst, was dort auf dich wartet oder warum du dort Zeit verbringen wirst. Nenne einen konkreten Bodenplan mit Wildnisbezug, z.B. Camp, Trail, Lodge, Flussabschnitt, Fotozeit oder ruhigen Beobachtungspunkt. Sprich freundlich als Gast, ohne Navigations-, Hoehen- oder Arbeitsvorgaben an den Piloten. Maximal ein kurzer Komforthinweis, sonst klare Vorfreude mit echtem Hintergrund.`;
    } else if (isBushPickupReturn) {
        reqLine = `Sprich als abgeholter Bush-Pickup-Gast, nicht als Pilot oder Dispatcher. Fokus auf deine konkrete Arbeit draußen, deinen Wartepunkt und warum der Rückflug zur Basis der passende Abschluss ist. Kein generischer Charter-Termin, kein künstlicher Zeitdruck, keine Zielarbeitsanforderungen wie feste Höhe, Überflug oder Verweildauer nennen.`;
    } else if (isSightseeingApt) {
        reqLine = `Sag kurz und locker, dass du dich auf den Flug freust (z.B. "Danke fürs Mitnehmen"). Kein Anweisungsstil: KEINE Navigations-, Höhen- oder Arbeitsvorgaben an den Piloten. Maximal ein weicher Komforthinweis (ruhig/entspannt), sonst einfach sympathische Vorfreude auf den Ausflug.`;
    } else if (isClubTechRole) {
        reqLine = `Fokus auf den Auftrag und den Ablauf am Ziel. Komfortwünsche nur nennen, wenn sie wirklich wichtig sind. KEINE Zielarbeitsanforderungen wie feste Höhe, Überflug oder Verweildauer nennen.`;
    } else if (comfortHintNeeded) {
        reqLine = `Nenne genau einen kurzen Komforthinweis NUR wenn er aufgrund von Magen/Fracht/Empfindlichkeit wirklich nötig ist. ${comfortContentRule}${timingHintNeeded ? ' Erwähne zusätzlich kurz den Zeitdruck.' : ''} Sonst Fokus auf Transportauftrag und Zielablauf am Boden. KEINE Zielarbeitsanforderungen wie feste Höhe, Überflug oder Verweildauer nennen.`;
    } else {
        reqLine = `Nenne KEINEN Komforthinweis. Fokus auf Transportauftrag und Ablauf nach Ankunft am Zielplatz.${timingHintNeeded ? ' Erwähne kurz, dass der Auftrag zeitkritisch ist.' : ''} KEINE Zielarbeitsanforderungen wie feste Höhe, Überflug oder Verweildauer nennen.`;
    }
    const driftGuard = _domainDriftGuard('greeting');
    return { reqLine, driftGuard, timingWordBan };
}

function _boardingBriefingPrompt() {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) {
        const cargoCtx = _cargoOnlyVoiceContext();
        if (!cargoCtx) return null;
        const wx = _weatherContext(window.lastLiveFlightData);
        const requiredItems = _missionRequiredItemNames(3);
        const cargoLine = requiredItems.length
            ? requiredItems.join(', ')
            : cargoCtx.cargoText;
        const opsNotes = Array.isArray(cargoCtx.bush?.opsNotes)
            ? cargoCtx.bush.opsNotes.map(x => String(x || '').trim()).filter(Boolean).slice(0, 2).join(' | ')
            : '';
        const arrivalHint = cargoCtx.aptArrivalLine ? `\n${cargoCtx.aptArrivalLine}` : '';
        return `ROLLE: Lademeister am Startplatz · Persönlichkeit: ruhig, pragmatisch, eingespielt
FLUG: ${cargoCtx.start} → ${cargoCtx.dest} · ${cargoCtx.dist || '?'} NM
AN BORD: ${cargoCtx.paxText}
AUSRUESTUNG: ${cargoCtx.cargoText}
AUFTRAG (kurz): ${cargoCtx.story || 'Versorgungsladung fuer einen abgelegenen Zielplatz.'}
STIL: bodenstaendig, klar, ohne Passagier-Perspektive; wie eine kurze Einweisung vom Loadmaster vor dem Abflug.
${cargoCtx.contractSummary ? `MISSION-CONTRACT: ${cargoCtx.contractSummary}` : ''}${arrivalHint}
TASK-DOMAIN: ${cargoCtx.taskDomain}
AUSGABE: Nur gesprochener Text (kein Markdown, keine Regieanweisungen, keine Anführungszeichen).

Moment: Boarding und Verladen laufen gerade, der Start steht gleich an.${wx ? ` ${wx}` : ''}
Sprich direkt zum Piloten als Lademeister am Heimatplatz. Sag kurz, was wir heute laden, warum diese Fracht am Ziel gebraucht wird und worauf beim Flug oder bei der Uebergabe zu achten ist. Erwaehne die Ladung immer direkt beim Namen: ${cargoLine}. Keine Passagierrolle, kein Einsteigen, kein Smalltalk ueber Sitzplaetze.${opsNotes ? ` Nutze diese Einsatznotizen grob als Leitplanke: ${opsNotes}.` : ''}
Max 3-4 Sätze.${_toneHint()}`;
    }
    const wx = _weatherContext(window.lastLiveFlightData);
    const guidance = _greetingMissionGuidance();
    if (!guidance) return null;
    const requiredItems = _missionRequiredItemNames(3);
    const cargoText = String(_activeCargoText() || '').trim();
    const cargoFallback = cargoText && !/^[-–—]$/.test(cargoText) ? (_stripManifestWeightForSpeech(cargoText) || cargoText) : 'meine Ausruestung';
    const speechItems = (requiredItems.length ? requiredItems : [cargoFallback])
        .map(_stripManifestWeightForSpeech)
        .filter(Boolean)
        .slice(0, 3);
    const equipmentContextLine = _boardingEquipmentContextLine(speechItems, cargoFallback);
    const activeTask = _activeTaskDomain();
    const boardingKnowledgeFact = /^(poi_learning_guide|sightseeing_tour)$/.test(activeTask) ? _poiKnowledgeFactHint('boarding') : '';
    const manifestSpeechRule = 'WICHTIG: Schreibe von Anfang an wie eine echte Person, nicht wie ein Loadsheet. Wenn du dich vorstellst, dann nur natürlich in Alltagssprache. Technische Felder wie PAX, AN BORD, AUSRÜSTUNG, Payload oder Zuladung sind Kontextdaten und keine Wörter für die gesprochene Ansage. Personen sind keine Ausrüstung: ein Mensch steigt ein, setzt sich, schnallt sich an oder ist bereit; nur Gepäck, Werkzeug, Taschen oder Material werden verstaut oder gesichert.';
    return `${ctx}

Moment: Boarding und Verladen laufen gerade, Start steht gleich an.${wx ? ' ' + wx : ''}
Erzeuge eine kurze, nette Boarding-Ansage aus Sicht des Passagiers in einem Block. Sie soll wie ein spontaner Satz beim Einsteigen oder Anschnallen klingen: kurze Begrüßung oder Bereitschaft, ein sinnvoller Bezug zu Ziel/Auftrag, optional ein natürliches Detail zu Gepäck oder Ausrüstung.
Kein fester Satzbau und keine Vorlage nachsprechen; variiere natürlich.
	${equipmentContextLine}
	${guidance.reqLine}${boardingKnowledgeFact}
	${manifestSpeechRule}
${guidance.driftGuard}
${guidance.timingWordBan}
Max 3 Sätze.${_toneHint()}`;
}

function _cargoOnlyFarewellPrompt(record) {
    const cargoCtx = _cargoOnlyVoiceContext();
    if (!cargoCtx) return null;
    const rec = (record && typeof record === 'object') ? record : {};
    const cargoOutcome = rec?.missionCargoOutcome
        || cargoCtx.md?.cargoOutcome
        || cargoCtx.contract?.cargoOutcome
        || (typeof window.missionCargoEvaluateOutcome === 'function' ? window.missionCargoEvaluateOutcome() : null);
    const missingRequired = Array.isArray(cargoOutcome?.missingRequired) ? cargoOutcome.missingRequired : [];
    const droppedRequired = Array.isArray(cargoOutcome?.droppedRequired) ? cargoOutcome.droppedRequired : [];
    const notDeliveredRequired = Array.isArray(cargoOutcome?.notDeliveredRequired) ? cargoOutcome.notDeliveredRequired : [];
    const damagedRequired = Array.isArray(cargoOutcome?.damagedRequired) ? cargoOutcome.damagedRequired : [];
    const failed = !!cargoOutcome?.failed;
    const failureList = [...missingRequired, ...droppedRequired, ...notDeliveredRequired, ...damagedRequired].filter(Boolean);
    const failureShort = failureList.slice(0, 3).join(', ');
    const durationSec = Number.isFinite(Number(rec.durationSec)) ? Number(rec.durationSec) : null;
    const min = durationSec != null ? Math.max(1, Math.round(durationSec / 60)) : null;
    const distanceNm = Number.isFinite(Number(rec.distanceNm)) ? Number(rec.distanceNm) : null;
    const arrivalPlan = _activeAptArrivalPlan();
    const receiver = String(arrivalPlan?.expectedBy || arrivalPlan?.roleLabel || 'Frachtkontakt am Ziel').trim();
    const cue = _aptArrivalCue(arrivalPlan);
    const place = _aptArrivalLocationLabel(arrivalPlan);
    const cargoName = _missionRequiredItemNames(3).join(', ') || cargoCtx.cargoText;
    const facts = (min != null && distanceNm != null)
        ? `${min} min, ${distanceNm.toFixed(1)} NM, Lieferung ${cargoName}.`
        : `Lieferung ${cargoName}.`;
    const followUpDeboardingHint = failed ? '' : _followUpDeboardingHintLine();
    const resultTask = failed
        ? `Sprich als Empfaenger der Lieferung am Ziel direkt zum Piloten. Sag klar, dass die Uebergabe heute noch nicht sauber abgeschlossen ist${failureShort ? `, weil ${failureShort} fehlt oder nicht brauchbar ist` : ''}. Bleib praktisch und knapp, kein Drama, keine Passagierperspektive. Eine kurze Bitte um neuen Anlauf ist okay.`
        : `Sprich als Empfaenger der Lieferung am Ziel direkt zum Piloten. Bestaetige kurz, dass die Fracht angekommen ist, sag wofuer sie hier gebraucht wird oder was damit als Naechstes passiert, und bedanke dich fuer den Flug. Keine Passagierperspektive, kein Mitflug, keine Cockpit-Sicht.`;
    return `ROLLE: ${receiver} · Persönlichkeit: bodenstaendig, direkt, dankbar
FLUG: ${cargoCtx.start} → ${cargoCtx.dest} · ${cargoCtx.dist || '?'} NM
AN BORD: ${cargoCtx.paxText}
AUSRUESTUNG: ${cargoCtx.cargoText}
AUFTRAG (kurz): ${cargoCtx.story || 'Versorgungsladung fuer einen abgelegenen Zielplatz.'}
STIL: kurze Bodenfunk-/Uebergabe-Sprache aus Sicht des Empfaengers; nicht wie ein Passagier an Bord.
${cargoCtx.contractSummary ? `MISSION-CONTRACT: ${cargoCtx.contractSummary}` : ''}
TASK-DOMAIN: ${cargoCtx.taskDomain}
AUSGABE: Nur gesprochener Text (kein Markdown, keine Regieanweisungen, keine Anführungszeichen).

Moment: Die Maschine steht ${place}; dort laeuft jetzt die Uebergabe. ${cue ? `Am Treffpunkt wartet ${cue}.` : ''}
Fakten: ${facts}
${resultTask}${followUpDeboardingHint}
Erwaehne die Fracht beim Namen: ${cargoName}. Gib moeglichst ein kleines konkretes Ergebnis oder einen naechsten Schritt der Uebergabe mit.${_bushCargoPickupNarrativeHint('final')} In dieser Abschlussansage zaehlt nur das Ergebnis der Uebergabe am Ziel und was jetzt als Naechstes mit der Fracht passiert; wiederhole den Abhol- oder Rueckfluggrund nicht noch einmal ausfuehrlich. Max 4 Sätze.${_toneHint()}`;
}

function _greetingPrompt() {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const wx = _weatherContext(window.lastLiveFlightData);
    const guidance = _greetingMissionGuidance();
    if (!guidance) return null;
    const activeTask = _activeTaskDomain();
    const greetingKnowledgeFact = /^(poi_learning_guide|sightseeing_tour)$/.test(activeTask) ? _poiKnowledgeFactHint('greeting') : '';
    return `${ctx}

Moment: Wir starten gleich — Motor läuft an oder das Flugzeug setzt sich in Bewegung.${wx ? ' ' + wx : ''}
Basistext für deine Begrüßung (frei adaptieren): "${pax.greetingText}"
Du DARFST hier mit einer kurzen natürlichen Begrüßung beginnen (z.B. "Hi"), aber nur sehr knapp.
	${guidance.reqLine}
	${greetingKnowledgeFact}
	${guidance.driftGuard}
${guidance.timingWordBan}
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
    const trainingPlan = _activeAptTrainingPlan();

    const situation = isPOI
        ? `Wir sind am Ziel "${(typeof currentMissionData !== 'undefined' ? currentMissionData : null)?.poiName || 'Ziel'}". Höhe: ${altFt} ft MSL / ${aglFt} ft AGL.`
        : `Wir nähern uns ${(typeof currentMissionData !== 'undefined' ? currentMissionData : null)?.dest || 'dem Flughafen'} — Landung gleich.`;
    const aptArrivalApproachHint = (!isPOI && !trainingPlan) ? _aptArrivalApproachHint() : '';

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
    const landingInstructorHint = (!isPOI && trainingPlan)
        ? ' Als Instruktor im Anflug: bereite den Piloten kurz auf die Landung vor. Wenn realistisch, nenne 1-2 markante Landmarken zur VFR-Orientierung. Melde Wind/Wetter knapp und gib genau einen konkreten Lande-Tipp (z.B. stabiler Endanflug, Seitenwindkorrektur, Go-Around-Entscheidung).'
        : '';
    const bushContinuityHint = _bushPickupNarrativeHint('arrival');
    return `${ctx}

Moment: ${situation}${notes}
Reagiere spontan auf diesen Augenblick — was siehst du, was geht dir durch den Kopf? Wenn Wetter oder Bedingungen nicht ideal sind, erwähne es kurz aber bleib positiv.${aptArrivalApproachHint}${inspectionLiveHint}${professionalProgressHint}${landingInstructorHint}${bushContinuityHint}${driftGuard} Max 2-3 Sätze.${_toneHint()}`;
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

    const gThr = chooseThreshold(policy.metricLevels.g, [1.6, 1.85], [1.9, 2.2]);
    const bThr = chooseThreshold(policy.metricLevels.bank, [34, 45], [45, 60]);
    // Wetterreaktionen: hoch = frueher, mittel = spaeter, niedrig = stumm.
    const wThr = chooseThreshold(policy.metricLevels.wind, [20, 30], [24, 34]);
    const gsThr = chooseThreshold(policy.metricLevels.gust, [12, 18], [16, 24]);
    const tThr = chooseThreshold(policy.metricLevels.turb, [40, 60], [50, 75]);
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
    if (Number.isFinite(depDistNm) && depDistNm < 4.0) return;
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
    _paxMissionTimeout(async () => {
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

    const rec = (record && typeof record === 'object') ? record : {};
    const durationSec = Number.isFinite(Number(rec.durationSec)) ? Number(rec.durationSec) : null;
    const min = durationSec != null ? Math.max(1, Math.round(durationSec / 60)) : null;
    const distanceNm = Number.isFinite(Number(rec.distanceNm)) ? Number(rec.distanceNm) : null;
    const maxAltFt = Number.isFinite(Number(rec.maxAltFt)) ? Math.round(Number(rec.maxAltFt)) : null;
    const isSimRecord = !!rec.simulated || durationSec == null;
    const td = (!isSimRecord && rec.touchdownVsFpm != null) ? `${Math.abs(rec.touchdownVsFpm)} ft/min` : null;
    const bank = (Number(rec.maxBankDeg) || 0).toFixed(1);
    const maxG = (Number(rec.maxGForce) || 1.0).toFixed(2);
    const wx   = _weatherContext(window.lastLiveFlightData);

    let highlights = '';
    if (pax.gTolerance === 'niedrig' && (Number(rec.maxGForce) || 1) > 1.5) highlights += ' Etwas viel G für mich, aber okay.';
    if (pax.bankTolerance === 'niedrig' && (Number(rec.maxBankDeg) || 0) > 30) highlights += ' Die Kurven waren schon sportlich.';
    if (!isSimRecord && Number.isFinite(Number(rec.maxDescentFpm)) && Number(rec.maxDescentFpm) <= -1500) {
        highlights += ` Der Sinkflug mit ${Math.abs(Math.round(Number(rec.maxDescentFpm)))} ft/min ging etwas auf Ohren und Magen.`;
    }
    if (td && Math.abs(Number(rec.touchdownVsFpm)) < 200) highlights += ' Die Landung war richtig sanft — Kompliment!';
    if (td && Math.abs(Number(rec.touchdownVsFpm)) > 500) highlights += ` Die Landung mit ${Math.abs(Number(rec.touchdownVsFpm))} ft/min war etwas holprig.`;
    const cargoOutcome = rec?.missionCargoOutcome
        || ((typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData.cargoOutcome : null)
        || window.activeMissionContract?.cargoOutcome
        || (typeof window.missionCargoEvaluateOutcome === 'function' ? window.missionCargoEvaluateOutcome() : null);
    const poiProgress = (typeof window.paxVoiceGetPoiMissionProgress === 'function')
        ? window.paxVoiceGetPoiMissionProgress()
        : null;
    const missingRequired = Array.isArray(cargoOutcome?.missingRequired) ? cargoOutcome.missingRequired : [];
    const droppedRequired = Array.isArray(cargoOutcome?.droppedRequired) ? cargoOutcome.droppedRequired : [];
    const notDeliveredRequired = Array.isArray(cargoOutcome?.notDeliveredRequired) ? cargoOutcome.notDeliveredRequired : [];
    const damagedRequired = Array.isArray(cargoOutcome?.damagedRequired) ? cargoOutcome.damagedRequired : [];
    const failureReasons = [
        ...missingRequired,
        ...droppedRequired,
        ...notDeliveredRequired,
        ...damagedRequired
    ].filter(Boolean);
    const hasResolvedOutcome = !!(cargoOutcome && typeof cargoOutcome === 'object' && String(cargoOutcome.status || '').toLowerCase() !== 'none');
    const currentMissionFailed = ((typeof currentMissionData !== 'undefined' && currentMissionData)
        ? (currentMissionData.missionFailed || String(currentMissionData.missionResult || '').toLowerCase() === 'failed')
        : false);
    const poiSuccessOverride = !!(poiProgress?.satisfied || poiProgress?.manualConfirmed);
    const isMissionFailed = poiSuccessOverride
        ? false
        : hasResolvedOutcome
        ? !!(cargoOutcome?.failed || rec?.missionFailed || rec?.poiAborted)
        : !!(_poiAborted || rec?.missionFailed || currentMissionFailed);
    if (cargoOutcome?.failed) {
        const missing = failureReasons.slice(0, 3).join(', ');
        if (damagedRequired.length) {
            highlights += ` Wichtige Ausruestung wurde beschaedigt${missing ? `: ${missing}` : ''}.`;
        } else {
            highlights += ` Die Ladung ist nicht vollstaendig erledigt${missing ? `: ${missing}` : ''}.`;
        }
    }
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
    const isPOI = _isPOIMission();
    const poiNeedsRideHome = !!rec?.poiNeedsRideHome;
    const primaryFailureReason = damagedRequired.length
        ? `beschaedigte Ausruestung (${damagedRequired.slice(0, 2).join(', ')})`
        : missingRequired.length
            ? `fehlende Ausruestung (${missingRequired.slice(0, 2).join(', ')})`
            : droppedRequired.length
                ? `verlorene Ausruestung (${droppedRequired.slice(0, 2).join(', ')})`
                : notDeliveredRequired.length
                    ? notDeliveredRequired[0]
                    : 'der Auftrag konnte nicht sauber abgeschlossen werden';
    const missionFailureTask = isMissionFailed
        ? `\nDer Auftrag ist heute nicht abgeschlossen. Sag klar, dass die Aufgabe am Ziel nicht erledigt werden konnte. Hauptgrund: ${primaryFailureReason}. Formuliere am Ende eine kurze Retry-Frage (z.B. ob wir es mit kompletter Ausruestung nochmal versuchen sollen). HARTE VERBOTE: Sage NICHT "voller Erfolg", "erfolgreich", "abgeschlossen", "erledigt", "alles im Kasten", "sauber erledigt" oder aehnliche Erfolgsformeln.`
        : '';
    const poiRideHomeTask = (isPOI && poiNeedsRideHome)
        ? '\nWir sind nicht am Startflugplatz gelandet. Frag am Ende locker, ob wir dich von hier noch nach Hause fliegen.'
        : '';
    const aptFarewellHint = (!isPOI && !trainingPlan) ? _aptArrivalFarewellHint() : '';
    const bushContinuityHint = _bushPickupNarrativeHint('farewell');
    const bushReconOutcomeHint = isMissionFailed ? '' : _bushReconOutcomeHintLine('farewell');
    const followUpDeboardingHint = isMissionFailed ? '' : _followUpDeboardingHintLine();
    const taskDomain = _activeTaskDomain();
    const farewellDriftGuard = _domainDriftGuard('result');
    const sarHeliFarewellTask = (typeof window.missionIsSarHeliMission === 'function' && window.missionIsSarHeliMission((typeof currentMissionData !== 'undefined' ? currentMissionData : null)))
        ? `Verabschiede dich als ${pax.role} nach einer SAR-Heli-Bergung. Sage klar, dass der Patient am medizinischen Ziel ${_sarHeliHospitalName()} uebergeben ist, danke fuer die ruhige Bergung und den Weiterflug, und schliesse professionell ab.`
        : '';
    const scienceFarewellTask = taskDomain === 'science_bio'
        ? `Verabschiede dich kurz beim Piloten und gib ein biologisches Abschlussfazit: welcher Habitat-, Arten-, Vegetations-, Ufer- oder Stoerfaktor fuer die Auswertung haengen bleibt und was mit Fotos/Notizen als naechstes passiert. Danke fuer den Flug ist okay, aber kein Sightseeing-Fazit und keine Formulierung wie "schoener Blick", "Blickmoment" oder "den Ort mitnehmen".`
        : (taskDomain === 'science_geo'
            ? `Verabschiede dich kurz beim Piloten und gib ein geologisches Abschlussfazit: welche Relief-, Erosions-, Sediment-, Ufer- oder Hangbeobachtung fuer die Auswertung haengen bleibt und was mit Fotos/Notizen als naechstes passiert. Danke fuer den Flug ist okay, aber kein Sightseeing-Fazit und keine Formulierung wie "schoener Blick", "Blickmoment" oder "den Ort mitnehmen".`
            : '');
    const farewellTask = isMissionFailed
        ? `Verabschiede dich persönlich beim Piloten aus deiner Sicht als ${pax.role}. Danke dem Piloten explizit für den Flug (bevorzuge alltagsnah: "danke fürs Mitnehmen" statt "danke für das Mitnehmen"). Bleib freundlich, aber nenne den Fehlschlag klar und ohne ihn schönzureden.${missionFailureTask}`
        : (sarHeliFarewellTask || scienceFarewellTask || `Verabschiede dich persönlich beim Piloten und gib dein Fazit zum Flug — aus deiner Sicht als ${pax.role}. Danke dem Piloten explizit für den Flug (bevorzuge alltagsnah: "danke fürs Mitnehmen" statt "danke für das Mitnehmen"). Auch wenn etwas nicht perfekt war, schließ positiv ab.${trnTask}`);
    const facts = (min != null && distanceNm != null && maxAltFt != null)
        ? `${min} min, ${distanceNm.toFixed(1)} NM, max ${maxAltFt} ft, max Bank ${bank}°, max G ${maxG}g.`
        : `Flugdaten teilweise unvollständig (z. B. Slew/Teleport). Max Bank ${bank}°, max G ${maxG}g.`;

    return `${ctx}

Moment: ${aptFarewellHint || 'Wir sind gelandet, Flug beendet.'}
Fakten: ${facts}${highlights ? '\n' + highlights : ''}${trnFacts}
${farewellTask}${poiRideHomeTask}${bushContinuityHint}${bushReconOutcomeHint}${followUpDeboardingHint}${profLandingHint}${farewellDriftGuard} Max 3 Sätze.${_toneHint()}`;
}

function _failedMissionFarewellFallback(record = null) {
    const pax = window.activePassenger || {};
    const rec = (record && typeof record === 'object') ? record : {};
    const poiProgress = (typeof window.paxVoiceGetPoiMissionProgress === 'function')
        ? window.paxVoiceGetPoiMissionProgress()
        : null;
    if (poiProgress?.satisfied || poiProgress?.manualConfirmed) {
        const role = String(pax.role || 'Passagier').trim();
        const frame = _activeMissionStoryFrame();
        const subject = String(frame?.focusSubject || 'den Auftrag').trim();
        return `Danke fuers Mitnehmen. Aus Sicht als ${role} haben wir ${subject} heute sauber bestaetigt und ich gebe den Fund so an die Einsatzleitung weiter. Der Rueckflug passt, damit koennen die Bodenkraefte ihren naechsten Schritt gezielt ansetzen.`;
    }
    const frame = _activeMissionStoryFrame();
    const subject = String(frame?.focusSubject || 'den Auftrag').trim();
    const cargoOutcome = rec?.missionCargoOutcome || null;
    const damagedRequired = Array.isArray(cargoOutcome?.damagedRequired) ? cargoOutcome.damagedRequired : [];
    const missingRequired = Array.isArray(cargoOutcome?.missingRequired) ? cargoOutcome.missingRequired : [];
    const droppedRequired = Array.isArray(cargoOutcome?.droppedRequired) ? cargoOutcome.droppedRequired : [];
    const notDeliveredRequired = Array.isArray(cargoOutcome?.notDeliveredRequired) ? cargoOutcome.notDeliveredRequired : [];
    const primaryFailureReason = damagedRequired.length
        ? `weil wichtige Ausruestung beschaedigt wurde (${damagedRequired.slice(0, 2).join(', ')})`
        : missingRequired.length
            ? `weil wichtige Ausruestung fehlte (${missingRequired.slice(0, 2).join(', ')})`
            : droppedRequired.length
                ? `weil wichtige Ausruestung verloren ging (${droppedRequired.slice(0, 2).join(', ')})`
                : notDeliveredRequired.length
                    ? `weil ${notDeliveredRequired[0]}`
                    : 'weil wir den Auftrag am Ziel nicht sauber abschliessen konnten';
    const role = String(pax.role || 'Passagier').trim();
    return `Danke fuers Mitnehmen. Aus Sicht als ${role} war ${subject} heute noch nicht sauber abgeschlossen, ${primaryFailureReason}. Wollen wir das mit einem klareren zweiten Anlauf noch einmal sauber aufsetzen?`;
}

window.triggerPaxCargoEvent = async function(event = {}) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax || !_missionHasPax()) return false;
    const item = event.item || {};
    const name = item.storyName || item.label || 'ein wichtiges Teil';
    const required = item.required === true;
    const reason = event.type === 'dropped_required'
        ? `${name} wurde im Flug abgeworfen.`
        : `${name} wurde an der Ladung geaendert.`;
    const prompt = `${ctx}

Moment: ${reason}
Sprich als ${pax.role} sofort und kurz auf die Ladung an. ${required ? 'Das Teil ist missionsrelevant, also deutlich verärgert oder besorgt reagieren.' : 'Nur knapp und praktisch reagieren.'} Max 2 Sätze.${_toneHint()}`;
    _paxLog(`Cargo-Ereignis: ${reason}`, required ? 'warn' : 'event');
    await _speakAndShow(prompt, 'Ladung');
    return true;
};

function _landingRollPrompt(record = null) {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const hint = _aptArrivalAfterLandingHint();
    if (!hint) return null;
    const td = (record && record.touchdownVsFpm != null) ? Math.abs(Math.round(record.touchdownVsFpm)) : null;
    const landingFact = td != null ? `Touchdown etwa ${td} ft/min.` : 'Touchdown erfolgt.';
    const wx = _weatherContext(window.lastLiveFlightData);
    return `${ctx}

Moment: Wir sind gerade gelandet und rollen noch.
Fakten: ${landingFact}${wx ? ' ' + wx : ''}
${hint}
Sprich als ${pax.role} kurz und praktisch: ein Satz zur Landung, ein Satz zum Rollen/Empfangspunkt. Positiv bleiben. Max 2 Sätze.${_toneHint()}`;
}

// ─── PUBLIC TRIGGERS ─────────────────────────────────────────────────────────

window.paxVoiceResetLeg = function() {
    _paxGreetingDone = false;
    if (_paxMissionEndVoiceActive()) {
        _paxAtTargetDone = true;
        _paxLandingPhaseAnnounced = true;
    } else {
        _paxAtTargetDone = false;
        _paxLandingPhaseAnnounced = false;
    }
    _paxPickupBoardingDone = false;
    _paxPickupDepartureDone = false;
    _cargoPickupBoardingDone = false;
    _cargoPickupDepartureDone = false;
    _bushPickupNarrativeMemory = { boarding: '', departure: '', arrival: '', farewell: '' };
    _bushCargoPickupNarrativeMemory = { boarding: '', departure: '', farewell: '' };
};

function _activeBushPickupPassengerContract() {
    let contract = null;
    try { contract = JSON.parse(localStorage.getItem('ga_active_mission_contract') || 'null'); } catch (_) {}
    contract = contract || window.activeMissionContract || (typeof currentMissionData !== 'undefined' ? currentMissionData?.missionContract : null) || {};
    const bush = contract?.bush && typeof contract.bush === 'object' ? contract.bush : null;
    const isBushPickupPassenger = !!(
        bush
        && String(bush.targetMode || '') === 'strip_then_return'
        && String(bush.pickupKind || '').toLowerCase() === 'passenger'
    );
    return isBushPickupPassenger ? { contract, bush } : null;
}

function _pickupBoardingPrompt() {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const active = _activeBushPickupPassengerContract();
    if (!active) return null;
    const wx = _weatherContext(window.lastLiveFlightData);
    const storyAnchor = _bushPickupStoryAnchorLine(active, pax);
    const storyData = _bushPickupStoryData(active, pax);
    const betweenFlights = _bushPickupBetweenFlightsLine(active, pax);
    const isAptCharterPickup = String(active?.bush?.profileId || '').toLowerCase() === 'apt_charter_pickup';
    const pickupPlaceText = isAptCharterPickup ? 'am Zielplatz oder im GA-Bereich' : 'am Strip';
    const manifestSpeechRule = 'WICHTIG: Keine Manifest- oder UI-Sprache. Sage nie Dinge wie "1 PAX", "AN BORD", "AUSRUESTUNG", "Payload" oder "ich bin jetzt als PAX geladen". Sprich einfach natuerlich als Person, die gerade eingestiegen ist.';
    return `${ctx}

Moment: Der Pickup ist gerade abgeschlossen und ich bin jetzt an Bord, wir stehen noch ${pickupPlaceText} oder rollen langsam an.${wx ? ' ' + wx : ''}
${storyAnchor}
${betweenFlights}
${storyData.boardingCue ? `Ich-Cue für diesen Moment: "${storyData.boardingCue}"` : ''}
${_bushPickupStageProgression('boarding')}
Sprich strikt als abgeholter Gast, der gerade eingestiegen ist. Sag jetzt kurz und natürlich, dass du bereit bist, verorte dich am Treffpunkt (${storyData.exactWhere}) und erwähne ein konkretes Detail aus der Zeit seit dem ersten Flug. Lege dabei den thematischen Faden für die spätere Rückflug-Ansage fest: genau ein klarer Einsatzschwerpunkt, kein Themenmix. Das ist der kurze Moment direkt beim Einsteigen, noch kein längerer Debrief.
Harte Perspektiv-Regel: Verwende "ich" für den abgeholten Gast. Sage niemals, du hättest "den Gast", "den Passagier", "ihn" oder "sie" eingesammelt, eingeladen oder abgeholt. Das hat der Pilot getan.
${manifestSpeechRule}
Max 3 Sätze.${_toneHint()}`;
}

function _pickupDeparturePrompt() {
    const ctx = _baseContext();
    const pax = window.activePassenger;
    if (!ctx || !pax) return null;
    const active = _activeBushPickupPassengerContract();
    if (!active) return null;
    const wx = _weatherContext(window.lastLiveFlightData);
    const continuityHint = _bushPickupNarrativeHint('departure');
    const storyAnchor = _bushPickupStoryAnchorLine(active, pax);
    const storyData = _bushPickupStoryData(active, pax);
    const betweenFlights = _bushPickupBetweenFlightsLine(active, pax);
    const isAptCharterPickup = String(active?.bush?.profileId || '').toLowerCase() === 'apt_charter_pickup';
    const urgency = _normUrgencyPriority(pax?.urgencyPriority);
    const aptTimeTone = urgency === 'hoch'
        ? 'Wenn der konkrete Anlass es hergibt, darf ein echter Zeitbezug kurz mitschwingen.'
        : 'Es gibt keinen Zeitdruck: keine Anschluss-Termin-Hektik, kein "Termin drückt", kein dringender Statusbericht.';
    const storyInstruction = isAptCharterPickup
        ? `Baue direkt auf deiner kurzen Ansage vom Zielplatz auf: Erzähle jetzt als abgeholter Chartergast eine kleine persönliche Szene aus der Zeit zwischen den Flügen, nicht wie ein Briefing. Nimm ein konkretes Detail aus dem Aufenthalt: ein Gespräch, eine handschriftliche Notiz, ein kurzer Weg vom Vorfeld zum Kontakt, eine Mappe im Gepäck oder einen Moment, der dir hängen geblieben ist. Erkläre daraus natürlich, warum der Rückflug nach ${storyData.homePlace} jetzt passt und was du innerlich vom Termin mitnimmst. Nutze den Rückkehrgrund nur als Stoff für diese Erzählung: ${storyData.returnReason || 'zu Hause wartet der nächste ruhige Schritt'}. Der Ton ist Airport-Charter: persönlich, professionell, ruhig; keine Bush-, Wildnis- oder Einsatzromantik. ${aptTimeTone} Beginne NICHT erneut mit einer Begrüßung wie "Hallo", "Hi", "Moin" oder einer neuen Selbstvorstellung, sondern setze inhaltlich einfach fort.`
        : `Baue direkt auf deiner kurzen Ansage vom Strip auf: Erzähle jetzt die persönliche Zwischenzeit-Geschichte aus deiner Ich-Perspektive als abgeholter Gast. Mache sie lebendig und glaubwürdig: was seit dem ersten Flug konkret passiert ist, ein kleines beobachtetes Detail oder Problem vor Ort, welche Notizen/Gegenstände du jetzt dabei hast, warum du wieder nach ${storyData.homePlace} musst und was du vom Ort oder vom Einsatz mitnimmst. Nutze dabei den Rückkehrgrund: ${storyData.returnReason || 'zu Hause wartet der nächste konkrete Arbeitsschritt'}. Der Ton darf klar Wilderness- und Einsatzcharakter haben: Abgeschiedenheit, Gelände, Dauer draußen, Feldarbeit, Wetter oder Rückkehr in die Zivilisation. Das darf persönlicher und bildhafter sein, aber weiterhin realistisch. Beginne NICHT erneut mit einer Begrüßung wie "Hallo", "Hi", "Moin" oder einer neuen Selbstvorstellung, sondern setze inhaltlich einfach fort.`;
    return `${ctx}

Moment: Wir sind wieder in der Luft und der Rückflug nach Hause läuft.${wx ? ' ' + wx : ''}${continuityHint}
${storyAnchor}
${betweenFlights}
${storyData.departureCue ? `Ich-Cue für den Rückflug: "${storyData.departureCue}"` : ''}
${storyInstruction}
Harte Perspektiv-Regel: Du bist der Passagier an Bord, nicht Pilot, Abholer, Lademeister oder Bodencrew. Verbotene Aussagen: "ich habe den Gast eingesammelt", "ich habe den Passagier abgeholt", "er sieht ... aus", "wir haben ihn geladen". Wenn du den Pickup erwähnst, dann nur so: der Pilot hat mich abgeholt/eingesammelt oder ich bin zugestiegen.
Max 5 Sätze.${_toneHint()}`;
}

function _activeBushPickupCargoContract() {
    let contract = null;
    try { contract = JSON.parse(localStorage.getItem('ga_active_mission_contract') || 'null'); } catch (_) {}
    contract = contract || window.activeMissionContract || (typeof currentMissionData !== 'undefined' ? currentMissionData?.missionContract : null) || {};
    const bush = contract?.bush && typeof contract.bush === 'object' ? contract.bush : null;
    const isBushPickupCargo = !!(
        bush
        && String(bush.targetMode || '') === 'strip_then_return'
        && String(bush.pickupKind || '').toLowerCase() === 'cargo'
    );
    return isBushPickupCargo ? { contract, bush } : null;
}

function _pickupCargoBoardingPrompt() {
    const cargoCtx = _cargoOnlyVoiceContext();
    const active = _activeBushPickupCargoContract();
    if (!cargoCtx || !active) return null;
    const wx = _weatherContext(window.lastLiveFlightData);
    const cargoLine = _bushCargoPickupLabel(active, cargoCtx);
    const followUpLine = _bushCargoPickupFollowUpLine();
    const targetName = String(active.bush?.targetRef?.name || cargoCtx.dest || 'dem Strip').trim();
    return `ROLLE: Lademeister am Zielstrip · Persönlichkeit: pragmatisch, direkt, routiniert
FLUG: ${cargoCtx.start} → ${cargoCtx.dest} · ${cargoCtx.dist || '?'} NM
AN BORD: ${cargoCtx.paxText}
RUECKHOLFRACHT: ${cargoLine}
AUFTRAG (kurz): ${cargoCtx.story || 'Rueckholfracht an einem abgelegenen Strip aufnehmen und zum Heimatplatz zurueckbringen.'}
STIL: kurze, glaubwuerdige Uebergabe am Boden aus Sicht des Loadmasters vor Ort.
${cargoCtx.contractSummary ? `MISSION-CONTRACT: ${cargoCtx.contractSummary}` : ''}
${followUpLine}
TASK-DOMAIN: ${cargoCtx.taskDomain}
AUSGABE: Nur gesprochener Text (kein Markdown, keine Regieanweisungen, keine Anführungszeichen).

Moment: Die Pickup-Fracht wird gerade am Zielstrip verladen, wir stehen noch am Boden in ${targetName}.${wx ? ` ${wx}` : ''}
Sprich direkt zum Piloten als Lademeister vor Ort. Sag kurz, was jetzt eingeladen wird, wie diese Rueckfracht aus dem vorherigen Supply Run entstanden ist, warum sie zurueck zum Heimatplatz muss und worauf beim Rueckflug zu achten ist. Erwaehne die Fracht immer direkt beim Namen: ${cargoLine}. Keine Passagierperspektive, kein Smalltalk. Lege hier nur die Ausgangslage und die wichtigste Vorsicht fest; Details zum Empfaenger, zur Werkstatt oder zur Bestandsliste hebst du dir fuer spaetere Phasen auf.
Max 3 Sätze.${_toneHint()}`;
}

function _pickupCargoDeparturePrompt() {
    const cargoCtx = _cargoOnlyVoiceContext();
    const active = _activeBushPickupCargoContract();
    if (!cargoCtx || !active) return null;
    const wx = _weatherContext(window.lastLiveFlightData);
    const cargoLine = _bushCargoPickupLabel(active, cargoCtx);
    const homeName = String(active.bush?.homeRef?.name || cargoCtx.dest || 'dem Heimatplatz').trim();
    const continuityHint = _bushCargoPickupNarrativeHint('departure');
    const followUpLine = _bushCargoPickupFollowUpLine();
    return `ROLLE: Lademeister am Zielstrip · Persönlichkeit: pragmatisch, direkt, routiniert
FLUG: ${cargoCtx.start} → ${cargoCtx.dest} · ${cargoCtx.dist || '?'} NM
AN BORD: ${cargoCtx.paxText}
RUECKHOLFRACHT: ${cargoLine}
AUFTRAG (kurz): ${cargoCtx.story || 'Rueckholfracht an einem abgelegenen Strip aufnehmen und zum Heimatplatz zurueckbringen.'}
STIL: kurze Rueckflug-Freigabe aus Sicht des Boden-/Ladekontakts, nicht wie ein Mitflieger.
${cargoCtx.contractSummary ? `MISSION-CONTRACT: ${cargoCtx.contractSummary}` : ''}
${followUpLine}
TASK-DOMAIN: ${cargoCtx.taskDomain}
AUSGABE: Nur gesprochener Text (kein Markdown, keine Regieanweisungen, keine Anführungszeichen).

Moment: Die Fracht ist eingeladen und der Rueckflug zum Heimatplatz laeuft jetzt an.${wx ? ` ${wx}` : ''}${continuityHint}
Sprich direkt zum Piloten als Ladekontakt am Zielstrip. Sag kurz, dass ${cargoLine} jetzt sauber verstaut ist, was seit der Supply-Lieferung am Strip damit passiert ist, warum die Lieferung in ${homeName} gebraucht wird oder ausgewertet werden muss, und gib den Rueckflug knapp frei. Fuehre die Geschichte gegenueber der Pickup-Ansage inhaltlich weiter: keine wortgleiche Wiederholung von Frachtgrund, Empfaenger oder Vorsichtshinweis. Keine Passagierperspektive.
Max 3 Sätze.${_toneHint()}`;
}

window.triggerPaxPickupBoarding = async function() {
    _paxLog(`triggerPaxPickupBoarding | tts:${_paxVoiceEnabled} done:${_paxPickupBoardingDone} pax:${!!window.activePassenger}`, 'state');
    if (_paxPickupBoardingDone || !window.activePassenger || !_missionHasPax()) return;
    const prompt = _pickupBoardingPrompt();
    if (!prompt) {
        _paxLog('PickupBoarding: kein Prompt (kein passender Bush-Pickup-Kontext)', 'warn');
        return;
    }
    _paxPickupBoardingDone = true;
    _paxLog('PickupBoarding → API-Call', 'event');
    await _speakAndShow(prompt, 'Pickup');
}

window.triggerPaxPickupDeparture = async function() {
    _paxLog(`triggerPaxPickupDeparture | tts:${_paxVoiceEnabled} done:${_paxPickupDepartureDone} pax:${!!window.activePassenger}`, 'state');
    if (_paxPickupDepartureDone || !window.activePassenger || !_missionHasPax()) return;
    const prompt = _pickupDeparturePrompt();
    if (!prompt) {
        _paxLog('PickupDeparture: kein Prompt (kein passender Bush-Pickup-Kontext)', 'warn');
        return;
    }
    _paxPickupDepartureDone = true;
    _paxLog('PickupDeparture → API-Call', 'event');
    await _speakAndShow(prompt, 'Rueckflug');
};

window.triggerPaxCargoPickupBoarding = async function() {
    _paxLog(`triggerPaxCargoPickupBoarding | tts:${_paxVoiceEnabled} done:${_cargoPickupBoardingDone} cargo:${!!_cargoMissionFocus()}`, 'state');
    if (_cargoPickupBoardingDone || !_cargoMissionFocus()) return;
    const prompt = _pickupCargoBoardingPrompt();
    if (!prompt) {
        _paxLog('CargoPickupBoarding: kein Prompt (kein passender Bush-Cargo-Pickup-Kontext)', 'warn');
        return;
    }
    _cargoPickupBoardingDone = true;
    _paxLog('CargoPickupBoarding → API-Call', 'event');
    await _speakAndShow(prompt, 'Pickup', _cargoMissionSpeaker('boarding'));
};

window.triggerPaxCargoPickupDeparture = async function() {
    _paxLog(`triggerPaxCargoPickupDeparture | tts:${_paxVoiceEnabled} done:${_cargoPickupDepartureDone} cargo:${!!_cargoMissionFocus()}`, 'state');
    if (_cargoPickupDepartureDone || !_cargoMissionFocus()) return;
    const prompt = _pickupCargoDeparturePrompt();
    if (!prompt) {
        _paxLog('CargoPickupDeparture: kein Prompt (kein passender Bush-Cargo-Pickup-Kontext)', 'warn');
        return;
    }
    _cargoPickupDepartureDone = true;
    _paxLog('CargoPickupDeparture → API-Call', 'event');
    await _speakAndShow(prompt, 'Rueckflug', _cargoMissionSpeaker('boarding'));
};

window.triggerPaxGreeting = async function(lat, lon, options = {}) {
    const epoch = _paxMissionEpoch;
    _paxLog(`triggerPaxGreeting | tts:${_paxVoiceEnabled} done:${_paxGreetingDone} pax:${!!window.activePassenger} key:${!!_getApiKey()}`, 'state');
    const overrideText = String(options?.overrideText || '').trim();
    if (overrideText && window.activePassenger && _missionHasPax()) {
        _paxGreetingDone = true;
        _paxSpeakTextDirect(overrideText, 'Begrüßung');
        return;
    }
    if (_USE_COMBINED_BOARDING_GREETING) {
        _paxGreetingDone = true;
        _paxLog('Greeting unterdrueckt: kombinierter Boarding/Begruessungsblock aktiv', 'state');
        return;
    }
    if (_paxGreetingDone || !window.activePassenger || !_missionHasPax()) return;
    _paxGreetingDone = true;

    // Location check: must be within 1 NM of the briefed departure airport
    const distNm = _distanceFromDepartureNm(lat, lon);
    if (Number.isFinite(distNm)) {
        _paxLog(`Greeting Standort-Check: ${distNm.toFixed(2)} NM vom Startplatz`, 'state');
        if (distNm > 1.0) {
            _paxLog(`Falsche Position (${distNm.toFixed(1)} NM) → Falsche-Ort-Meldung`, 'warn');
            const wrongPrompt = _wrongLocationPrompt(distNm);
            if (wrongPrompt) await _speakAndShow(wrongPrompt, '⚠️ Falscher Ort');
            if (!_paxEpochCurrent(epoch)) return;
            // Mission soll trotzdem weiterlaufen: wir merken den Wrong-Start
            // und geben nach dem Abheben einen kurzen Folgekommentar.
            _paxWrongStartActive = true;
            return;
        }
    }

    const prompt = _greetingPrompt();
    if (!prompt) { _paxGreetingDone = false; _paxLog('Greeting: kein Prompt (Mission-Daten fehlen?)', 'warn'); return; }
    const key = _paxMissionAudioKey('greeting');
    let prepared = _paxPreparedAudio.get(key) || null;
    if (prepared?.textPromise) prepared = await prepared.textPromise;
    if (!_paxEpochCurrent(epoch)) return;
    if (prepared?.text) {
        _paxLog('Greeting → Prepared Audio/Text', 'event');
        await _speakPreparedText(key, prepared.text, prepared.speaker || _speakerSnapshotForActivePax(), 'Begrüßung');
    } else {
        _paxLog('Greeting → API-Call', 'event');
        await _speakAndShow(prompt, 'Begrüßung');
    }
};

window.triggerPaxAtTarget = async function(flightData) {
    _paxLog(`triggerPaxAtTarget | tts:${_paxVoiceEnabled} done:${_paxAtTargetDone} pax:${!!window.activePassenger} alt:${flightData?.mslFt||0}ft`, 'state');
    if (_paxAtTargetDone || !window.activePassenger || !_missionHasPax()) return;
    if (_paxMissionEndVoiceActive()) {
        _paxAtTargetDone = true;
        _paxLandingPhaseAnnounced = true;
        _paxLog('AtTarget unterdrueckt: Farewell/Missionsende aktiv', 'state');
        return;
    }
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
    const label = _isPOIMission() ? 'Am Ziel' : (_activeAptArrivalPlan() ? 'Ankunft' : 'Landung');
    _paxMissionTimeout(() => {
        if (_paxMissionEndVoiceActive()) {
            _paxLog('AtTarget-Queue unterdrueckt: Farewell/Missionsende aktiv', 'state');
            return;
        }
        _speakAndShow(prompt, label);
    }, 2000);
};

function _notifyFarewellSpeechComplete(reason = 'pax-farewell-complete') {
    if (typeof window.missionSceneStartDeboardingAfterFarewell !== 'function') return;
    try {
        window.missionSceneStartDeboardingAfterFarewell(reason);
    } catch (err) {
        _paxLog(`Farewell complete callback failed: ${err?.message || err}`, 'warn');
    }
}

function _notifyFarewellSpeechCompleteIfCurrent(epoch, reason = 'pax-farewell-complete') {
    if (!_paxEpochCurrent(epoch)) {
        _paxLog(`Farewell-Abschluss ignoriert: alte Mission (${reason})`, 'state');
        return;
    }
    _notifyFarewellSpeechComplete(reason);
}

window.triggerPaxFarewell = async function(record) {
    const epoch = _paxMissionEpoch;
    _paxLog(`triggerPaxFarewell | tts:${_paxVoiceEnabled} done:${_paxFarewellDone} pax:${!!window.activePassenger}`, 'state');
    if (_paxFarewellDone) {
        _notifyFarewellSpeechCompleteIfCurrent(epoch, 'pax-farewell-already-done');
        return false;
    }
    if (!window.activePassenger || !_missionHasPax()) {
        const cargoPrompt = _cargoOnlyFarewellPrompt(record);
        if (cargoPrompt) {
            _paxFarewellDone = true;
            const delayMs = _paxVoiceEnabled ? 1500 : 0;
            const speaker = _cargoMissionSpeaker('farewell');
            _paxLog(`CargoFarewell → API-Call in ${Math.round(delayMs / 1000)}s`, 'event');
            _paxMissionTimeout(async () => {
                try {
                    await _speakAndShow(cargoPrompt, 'Verabschiedung', speaker);
                } finally {
                    _notifyFarewellSpeechCompleteIfCurrent(epoch, 'cargo-farewell-complete');
                }
            }, delayMs);
            return true;
        }
        _notifyFarewellSpeechCompleteIfCurrent(epoch, 'pax-farewell-no-pax');
        return false;
    }
    _paxFarewellDone = true;
    const cargoOutcome = record?.missionCargoOutcome || null;
    const forceFailureFallback = !!(
        record?.missionFailed
        || record?.poiAborted
        || cargoOutcome?.failed
    );
    const prompt = _farewellPrompt(record);
    if (!prompt) {
        _paxFarewellDone = false;
        _paxLog('Farewell: kein Prompt', 'warn');
        _notifyFarewellSpeechCompleteIfCurrent(epoch, 'pax-farewell-no-prompt');
        return false;
    }
    const delayMs = _paxVoiceEnabled ? 3000 : 0;
    if (forceFailureFallback) {
        const fallbackText = _failedMissionFarewellFallback(record);
        const key = _paxMissionAudioKey('farewell-failed');
        const speaker = _speakerSnapshotForActivePax();
        _paxPreparedAudio.set(key, { text: fallbackText, speaker, audio: null, promise: null, epoch });
        _prepareTextAsTTS(key, fallbackText, speaker, epoch);
        _paxLog(`Farewell → lokaler Failure-Fallback in ${Math.round(delayMs / 1000)}s`, 'event');
        _paxMissionTimeout(async () => {
            try {
                await _speakPreparedText(key, fallbackText, speaker, 'Verabschiedung');
            } finally {
                _notifyFarewellSpeechCompleteIfCurrent(epoch, 'pax-farewell-complete');
            }
        }, delayMs);
        return true;
    }
    _paxLog(`Farewell → API-Call in ${Math.round(delayMs / 1000)}s`, 'event');
    _paxMissionTimeout(async () => {
        try {
            await _speakAndShow(prompt, 'Verabschiedung');
        } finally {
            _notifyFarewellSpeechCompleteIfCurrent(epoch, 'pax-farewell-complete');
        }
    }, delayMs);
    return true;
};

window.triggerPaxLandingRoll = async function(record) {
    if (!window.activePassenger || !_missionHasPax()) return;
    if (_paxMissionEndVoiceActive()) return;
    const prompt = _landingRollPrompt(record);
    if (!prompt) return;
    _paxLog('Landing-Roll → API-Call in 1s', 'event');
    _paxMissionTimeout(() => {
        if (_paxMissionEndVoiceActive()) return;
        _speakAndShow(prompt, 'Nach der Landung');
    }, 1000);
};

window.triggerPaxOffDestinationLanding = async function(distNm) {
    const now = Date.now();
    if (!window.activePassenger || !_missionHasPax()) return;
    if ((now - _paxOffDestLastAt) < 90000) return;
    _paxOffDestLastAt = now;
    const p = _offDestinationLandingPrompt(distNm);
    if (!p) return;
    _paxLog(`Off-Destination Landing Hinweis | d=${Number(distNm || 0).toFixed(1)} NM`, 'event');
    _paxMissionTimeout(() => _speakAndShow(p, 'Falscher Landeplatz'), 300);
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
    const hasPax = !!window.activePassenger && _missionHasPax();
    const cargoOnly = !hasPax && _cargoMissionFocus();
    if (!hasPax && !cargoOnly) return;
    if (_paxMissionEndVoiceActive()) return;
    const isPoiMission = _isPOIMission();
    _recordMissionComfortSample(flightData || window.lastLiveFlightData || {});
    if (cargoOnly) {
        _refreshPaxWidgetVisibility();
        return;
    }
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
                if (p) _paxMissionTimeout(() => _speakAndShow(p, 'Instruktor'), 300);
            }

            // 2) Beim Einflug in die Zone: Übung starten
            const zoneNm = Math.max(1.2, Number(window.activePassenger?.targetRadiusNm || 0) || 0);
            if (!_poiTrainingZoneStartDone && distToDestNm <= zoneNm) {
                _poiTrainingZoneStartDone = true;
                _trainingEvalBegin();
                _paxLog(`Training-Trigger poi_zone_entry | distDest ${distToDestNm.toFixed(2)} NM`, 'event');
                const p = _poiTrainingZoneEntryPrompt(flightData);
                if (p) _paxMissionTimeout(() => _speakAndShow(p, 'Instruktor'), 300);
            }

            // 3) Rückanflug: entweder 5 NM (Pattern) oder 4 NM (normale Landung)
            if (_poiTrainingZoneStartDone && !_poiTrainingLandingBriefDone) {
                if (trainingPlan.mode === 'pattern' && distNm <= 5.0) {
                    _poiTrainingLandingBriefDone = true;
                    _paxLandingPhaseAnnounced = true;
                    _paxLog(`Training-Trigger poi_landing_pattern_5nm | distHome ${distNm.toFixed(2)} NM`, 'event');
                    const p = _trainingLandingPrepPrompt(flightData, distNm, 'pattern', 'Startflugplatz');
                    if (p) _paxMissionTimeout(() => _speakAndShow(p, 'Instruktor'), 300);
                } else if (trainingPlan.mode !== 'pattern' && distNm <= 4.0) {
                    _poiTrainingLandingBriefDone = true;
                    _paxLandingPhaseAnnounced = true;
                    _paxLog(`Training-Trigger poi_landing_4nm | distHome ${distNm.toFixed(2)} NM`, 'event');
                    const p = _trainingLandingPrepPrompt(flightData, distNm, 'landing', 'Startflugplatz');
                    if (p) _paxMissionTimeout(() => _speakAndShow(p, 'Instruktor'), 300);
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
                if (p) _paxMissionTimeout(() => _speakAndShow(p, 'Instruktor'), 300);
            }
            // 2) Landing-Call nach Modus: pattern 5NM, sonst 4NM
            if (_aptTrainingBriefDone && !_aptTrainingLandingBriefDone) {
                if (trainingPlan.mode === 'pattern' && distNm <= 5.0) {
                    _aptTrainingLandingBriefDone = true;
                    _paxLandingPhaseAnnounced = true;
                    _paxLog(`Training-Trigger apt_landing_pattern_5nm | dist ${distNm.toFixed(2)} NM`, 'event');
                    const p = _trainingLandingPrepPrompt(flightData, distNm, 'pattern', 'Zielflugplatz');
                    if (p) _paxMissionTimeout(() => _speakAndShow(p, 'Instruktor'), 300);
                } else if (trainingPlan.mode !== 'pattern' && distNm <= 4.0) {
                    _aptTrainingLandingBriefDone = true;
                    _paxLandingPhaseAnnounced = true;
                    _paxLog(`Training-Trigger apt_landing_4nm | dist ${distNm.toFixed(2)} NM`, 'event');
                    const p = _trainingLandingPrepPrompt(flightData, distNm, 'landing', 'Zielflugplatz');
                    if (p) _paxMissionTimeout(() => _speakAndShow(p, 'Instruktor'), 300);
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
    if (taskDomain === 'fire_watch' && _tickFireMissionSearch(flightData, distNm)) {
        return;
    }
    const sarHeli = !!(typeof window.missionIsSarHeliMission === 'function' && window.missionIsSarHeliMission((typeof currentMissionData !== 'undefined' ? currentMissionData : null)));
    if (sarHeli) {
        if (typeof window.missionSarHeliHandlePoiTick === 'function') {
            window.missionSarHeliHandlePoiTick({
                lat,
                lon,
                flightData,
                distNm,
                inRadius,
                radius,
                now
            });
        }
        if (inRadius && !_poiInRadius) {
            _poiInRadius = true;
            _poiLastTickTime = now;
            if (!_poiEnteredAt) _poiEnteredAt = now;
        } else if (!inRadius) {
            _poiInRadius = false;
            _poiLastTickTime = null;
        }
        return;
    }
    const tightAltitudeBand = /^(fire_watch|search_and_rescue|inspection_infra|infra_chain_recon|mapping_survey)$/.test(taskDomain);
    const altTolerance         = strict ? 200  : (tightAltitudeBand ? 300 : 600);
    const dwellRequired        = pax.targetDwellMin > 0 ? pax.targetDwellMin * 60 * (strict ? 1.0 : 0.5) : 0;
    const maxAttempts          = strict ? 2 : 3;
    const graceSec             = strict ? 15  : 25;
    const complaintIntervalSec = strict ? 30 : 45;
    const taskItemState = _poiRequiredTaskItemState();
    const missingTaskItems = taskItemState.blockingItems;
    const poiChainTickResult = _tickPoiChainTask(lat, lon, flightData);
    const surveyTickResult = taskDomain === 'mapping_survey'
        ? _tickSurveyPatternTask(lat, lon, flightData)
        : null;

    const inSightGate = _poiInSightGate({
        taskDomain,
        distNm,
        etaMin,
        radiusNm: radius,
        effectiveGs,
        surveyTickResult
    });

    // Frühe POI-Meldung: technisch hilfreiche "Objekt in Sicht"-Ansage.
    // Mapping-Survey nutzt die ETA bis zum Pattern-Rand, weil das Arbeitsgebiet groesser als der POI-Radius sein kann.
    if (!_poiSightCallDone && !inRadius && inSightGate.ready) {
        _poiSightCallDone = true;
        const surveyPart = Number.isFinite(Number(inSightGate.surveyRadiusNm)) ? ` | surveyR: ${Number(inSightGate.surveyRadiusNm).toFixed(2)} NM` : '';
        _paxLog(`POI pre-call | dist: ${distNm.toFixed(2)} NM | eta: ${etaMin.toFixed(1)} min | etaGate: ${Number(inSightGate.logEtaMin || etaMin).toFixed(1)} min | pos: ${clockPos}${surveyPart}`, 'event');
        const p = _poiInSightPrompt(flightData, distNm, etaMin, clockPos, { announcedEtaMin: inSightGate.announcedEtaMin });
        if (p) _paxMissionTimeout(() => _speakAndShow(p, 'Objekt in Sicht'), 300);
    }

    if (!inRadius) {
        if (!surveyTickResult?.progress?.startedAt && !poiChainTickResult?.progress?.startedAt) {
            _poiInRadius     = false;
            _poiLastTickTime = null;
        }
        return;
    }

    if (!_poiInRadius) {
        _poiInRadius     = true;
        _poiLastTickTime = now;
        if (!_poiEnteredAt) _poiEnteredAt = now;
        _paxLog(`POI-Radius betreten | dist: ${distNm.toFixed(2)} NM | dwell: ${dwellRequired.toFixed(0)}s | altReq: ${pax.targetAltFt || 'keins'}`, 'state');

        if (missingTaskItems.length) {
            _poiAborted = true;
            _paxAtTargetDone = true;
            _poiEntryDone = true;
            if (typeof window.missionPersistRuntimeSnapshot === 'function') window.missionPersistRuntimeSnapshot('poi-aborted-missing-cargo', { immediate: true });
            _paxLog(`POI-Abbruch wichtiger Gegenstand ${taskItemState.reason === 'damaged' ? 'beschaedigt' : 'fehlt'} | items: ${missingTaskItems.join(', ')}`, 'warn');
            const pMissing = _poiMissingCargoAbortPrompt(flightData, taskItemState);
            if (pMissing) _paxMissionTimeout(() => _speakAndShow(pMissing, 'Abbruch'), 600);
            return;
        }

        // Entry comment — spontane erste Reaktion beim Einflug
        if (!_poiEntryDone) {
            _poiEntryDone = true;
            const p = _poiEntryPrompt(flightData);
            if (p) _paxMissionTimeout(() => _speakAndShow(p, 'Zielgebiet'), 800);
        }

        // Flyover (targetDwellMin=0): Entry genügt → satisfied nach kurzem Delay
        if (dwellRequired === 0 && taskDomain !== 'mapping_survey') {
            _poiSatisfied    = true;
            _paxAtTargetDone = true;
            if (typeof window.missionPersistRuntimeSnapshot === 'function') window.missionPersistRuntimeSnapshot('poi-flyover-satisfied', { immediate: true });
            _paxLog('Flyover-Mission — Überflug genügt, satisfied', 'event');
            return;
        }
    }

    if (missingTaskItems.length) {
        _poiAborted = true;
        _paxAtTargetDone = true;
        if (typeof window.missionPersistRuntimeSnapshot === 'function') window.missionPersistRuntimeSnapshot('poi-aborted-missing-cargo', { immediate: true });
        _paxLog(`POI-Abbruch waehrend Verweilzeit: wichtiger Gegenstand ${taskItemState.reason === 'damaged' ? 'beschaedigt' : 'fehlt'} | items: ${missingTaskItems.join(', ')}`, 'warn');
        const pMissing = _poiMissingCargoAbortPrompt(flightData, taskItemState);
        if (pMissing) _paxMissionTimeout(() => _speakAndShow(pMissing, 'Abbruch'), 600);
        return;
    }

    if (taskDomain === 'mapping_survey' && surveyTickResult?.handled) {
        return;
    }
    if (poiChainTickResult?.handled) {
        return;
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
            if (p) _paxMissionTimeout(() => _speakAndShow(p, 'Höhe ok'), 500);
        }
        _poiAltWasOk = true;

        if (_poiDwellSec >= dwellRequired) {
            _paxLog(`Verweilzeit erfüllt (${_poiDwellSec.toFixed(0)}s) → zufrieden`, 'event');
            _poiSatisfied    = true;
            _paxAtTargetDone = true;
            if (typeof window.missionPersistRuntimeSnapshot === 'function') window.missionPersistRuntimeSnapshot('poi-dwell-satisfied', { immediate: true });
            const p = _poiSatisfiedPrompt(flightData);
            if (p) _paxMissionTimeout(() => _speakAndShow(p, 'Ziel erfüllt'), 500);
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
                if (p) _paxMissionTimeout(() => _speakAndShow(p, `Höhe (${_poiAttempts}/${maxAttempts})`), 500);
            } else {
                _paxLog('Max. Versuche erreicht → Abbruch', 'event');
                _poiAborted      = true;
                _paxAtTargetDone = true;
                if (typeof window.missionPersistRuntimeSnapshot === 'function') window.missionPersistRuntimeSnapshot('poi-alt-aborted', { immediate: true });
                const p = _poiAbortPrompt(flightData);
                if (p) _paxMissionTimeout(() => _speakAndShow(p, 'Abbruch'), 1000);
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
    _syncPaxTtsHedgeControl();
    const audioStyleEl = document.getElementById('awmPaxAudioStyleSelect');
    if (audioStyleEl) audioStyleEl.value = _paxAudioStyle;

    if (!window.activePassenger && _missionHasPax()) {
        const saved = localStorage.getItem('ga_active_passenger');
        if (saved) try {
            const parsed = JSON.parse(saved);
            const validator = window.missionRestoreValidateLocalPassenger;
            if (!validator || validator(parsed)) window.activePassenger = parsed;
            else localStorage.removeItem('ga_active_passenger');
        } catch(e) {}
    }
    _normalizeActivePassengerGender();

    _injectPaxUI();
    _refreshPaxWidgetVisibility();
    _paxLog('System bereit', 'state');
}());
