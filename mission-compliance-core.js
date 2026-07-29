// Mission Compliance Core
// Fachlicher Zustand fuer zufaellige Behoerdenkontrollen nach einem Missionsflug.
// UI, Voice und Tracker fuehren diesen Zustand nur aus; Abschlussentscheidungen
// bleiben hier zentral und werden reload-sicher im aktiven Missionsdatensatz gespeichert.

const MISSION_COMPLIANCE_PROBABILITY = 0.03;
const MISSION_COMPLIANCE_REQUESTED_ITEM_IDS = Object.freeze([
    'bordbuch',
    'fire-extinguisher',
    'first-aid'
]);
const MISSION_COMPLIANCE_PHASE_ORDER = Object.freeze({
    none: 0,
    not_selected: 1,
    selected: 2,
    approach_started: 3,
    inspectors_waiting: 4,
    request_playing: 5,
    evidence_open: 6,
    result_playing: 7,
    departing: 8,
    released: 9
});
const MISSION_COMPLIANCE_APPROACH_FALLBACK_MS = 75000;
const MISSION_COMPLIANCE_DEPARTURE_FALLBACK_MS = 70000;
const MISSION_COMPLIANCE_VOICE_FALLBACK_MS = 75000;
const MISSION_COMPLIANCE_INSPECTOR_SPEAKER = Object.freeze({
    name: 'Luftaufsicht',
    role: 'Behoerdenkontrolleur',
    gender: 'male',
    roleProfile: 'authority_inspector_calm_precise_v1',
    taskDomain: 'flight_compliance'
});

let missionComplianceApproachTimer = null;
let missionComplianceDepartureTimer = null;
let missionComplianceResumeTimer = null;
let missionComplianceRequestPromise = null;
let missionComplianceResultPromise = null;

function _missionComplianceClone(value, fallback = null) {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return fallback; }
}

function _missionComplianceMissionData() {
    try {
        return (typeof currentMissionData !== 'undefined' && currentMissionData && typeof currentMissionData === 'object')
            ? currentMissionData
            : null;
    } catch (_) {
        return null;
    }
}

function _missionComplianceMissionKey() {
    const md = _missionComplianceMissionData();
    const contract = md?.missionContract || window.activeMissionContract || null;
    return String(
        md?.missionId
        || md?.missionKey
        || contract?.missionId
        || contract?.missionKey
        || md?.cargoManifest?.key
        || contract?.cargoManifest?.key
        || [md?.start, md?.dest, md?.poiName || md?.targetName, md?.mission].filter(Boolean).join('|')
        || ''
    ).trim();
}

function _missionComplianceFlightId() {
    if (typeof window.missionCargoCurrentFlightId === 'function') {
        try {
            const cargoId = String(window.missionCargoCurrentFlightId() || '').trim();
            if (cargoId) return cargoId;
        } catch (_) {}
    }
    const startedAt = Number(window.missionRuntimeStartedAt?.() || 0);
    return `${_missionComplianceMissionKey()}|${startedAt > 0 ? Math.round(startedAt) : 'flight'}`;
}

function _missionComplianceNormalizeState(raw = null) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const phase = Object.prototype.hasOwnProperty.call(MISSION_COMPLIANCE_PHASE_ORDER, source.phase)
        ? source.phase
        : (source.selected === true ? 'selected' : (source.selected === false ? 'not_selected' : 'none'));
    const remediation = source.remediation && typeof source.remediation === 'object'
        ? {
            required: source.remediation.required === true,
            missingFields: Array.isArray(source.remediation.missingFields)
                ? source.remediation.missingFields.filter(field => field === 'start' || field === 'landing')
                : []
        }
        : { required: false, missingFields: [] };
    return {
        version: 1,
        missionKey: String(source.missionKey || _missionComplianceMissionKey()),
        flightId: String(source.flightId || _missionComplianceFlightId()),
        selected: source.selected === true ? true : (source.selected === false ? false : null),
        forced: source.forced === true,
        roll: Number.isFinite(Number(source.roll)) ? Number(source.roll) : null,
        decisionAt: Number.isFinite(Number(source.decisionAt)) ? Number(source.decisionAt) : 0,
        phase,
        phaseAt: Number.isFinite(Number(source.phaseAt)) ? Number(source.phaseAt) : 0,
        revision: Math.max(0, Math.round(Number(source.revision || 0))),
        commandId: String(source.commandId || ''),
        sceneId: String(source.sceneId || ''),
        sceneFallback: source.sceneFallback === true,
        inspectorsWaiting: phase !== 'released' && (
            source.inspectorsWaiting === true
            || MISSION_COMPLIANCE_PHASE_ORDER[phase] >= MISSION_COMPLIANCE_PHASE_ORDER.inspectors_waiting
        ),
        farewellComplete: source.farewellComplete === true,
        requestText: String(source.requestText || ''),
        requestSpokenAt: Number.isFinite(Number(source.requestSpokenAt)) ? Number(source.requestSpokenAt) : 0,
        snapshot: source.snapshot && typeof source.snapshot === 'object' ? _missionComplianceClone(source.snapshot, null) : null,
        remediation,
        result: source.result && typeof source.result === 'object' ? _missionComplianceClone(source.result, null) : null,
        resultText: String(source.resultText || ''),
        resultSpokenAt: Number.isFinite(Number(source.resultSpokenAt)) ? Number(source.resultSpokenAt) : 0,
        pendingClose: source.pendingClose && typeof source.pendingClose === 'object'
            ? _missionComplianceClone(source.pendingClose, null)
            : null,
        releasedAt: Number.isFinite(Number(source.releasedAt)) ? Number(source.releasedAt) : 0,
        updatedAt: Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : 0
    };
}

function _missionComplianceGetState(create = false) {
    const md = _missionComplianceMissionData();
    if (!md) return null;
    let raw = md.complianceInspection;
    if ((!raw || typeof raw !== 'object') && create) {
        raw = _missionComplianceNormalizeState(null);
        md.complianceInspection = raw;
    }
    if (!raw || typeof raw !== 'object') return null;
    const state = _missionComplianceNormalizeState(raw);
    md.complianceInspection = state;
    if (md.missionContract && typeof md.missionContract === 'object') {
        md.missionContract.complianceInspection = state;
    }
    if (window.activeMissionContract && typeof window.activeMissionContract === 'object') {
        window.activeMissionContract.complianceInspection = state;
    }
    return state;
}

function _missionCompliancePersist(state = null, reason = 'compliance') {
    const next = state || _missionComplianceGetState(false);
    const md = _missionComplianceMissionData();
    if (!next || !md) return false;
    next.missionKey = next.missionKey || _missionComplianceMissionKey();
    next.flightId = next.flightId || _missionComplianceFlightId();
    next.updatedAt = Date.now();
    md.complianceInspection = next;
    if (md.missionContract && typeof md.missionContract === 'object') md.missionContract.complianceInspection = next;
    if (window.activeMissionContract && typeof window.activeMissionContract === 'object') {
        window.activeMissionContract.complianceInspection = next;
    }
    try {
        if (typeof window.debouncedSaveMissionState === 'function') window.debouncedSaveMissionState();
        else if (typeof saveMissionState === 'function') saveMissionState();
    } catch (_) {}
    try { window.missionPersistRuntimeSnapshot?.(`compliance:${reason}`, { immediate: true }); } catch (_) {}
    try {
        window.gaMissionPhaseDebugRecord?.('compliance', {
            reason,
            selected: next.selected,
            forced: next.forced,
            phase: next.phase,
            revision: next.revision,
            sceneFallback: next.sceneFallback
        });
    } catch (_) {}
    _missionComplianceRender();
    return true;
}

function _missionComplianceSetPhase(state, phase, reason = phase) {
    if (!state || !Object.prototype.hasOwnProperty.call(MISSION_COMPLIANCE_PHASE_ORDER, phase)) return false;
    state.phase = phase;
    state.phaseAt = Date.now();
    return _missionCompliancePersist(state, reason);
}

function _missionCompliancePhaseAtLeast(state, phase) {
    return Number(MISSION_COMPLIANCE_PHASE_ORDER[state?.phase] || 0) >= Number(MISSION_COMPLIANCE_PHASE_ORDER[phase] || 0);
}

function _missionComplianceClearTimer(name) {
    if (name === 'approach' && missionComplianceApproachTimer) {
        clearTimeout(missionComplianceApproachTimer);
        missionComplianceApproachTimer = null;
    }
    if (name === 'departure' && missionComplianceDepartureTimer) {
        clearTimeout(missionComplianceDepartureTimer);
        missionComplianceDepartureTimer = null;
    }
    if (name === 'resume' && missionComplianceResumeTimer) {
        clearTimeout(missionComplianceResumeTimer);
        missionComplianceResumeTimer = null;
    }
}

function _missionComplianceAwaitVoice(promise, timeoutMs = MISSION_COMPLIANCE_VOICE_FALLBACK_MS) {
    let timer = null;
    return Promise.race([
        Promise.resolve(promise).catch(() => false),
        new Promise(resolve => {
            timer = setTimeout(() => resolve(false), Math.max(1000, Number(timeoutMs) || MISSION_COMPLIANCE_VOICE_FALLBACK_MS));
        })
    ]).finally(() => {
        if (timer) clearTimeout(timer);
    });
}

function _missionComplianceManifest() {
    if (typeof window.missionCargoGetManifestSnapshot !== 'function') return null;
    try { return window.missionCargoGetManifestSnapshot(); } catch (_) { return null; }
}

function _missionComplianceItemLabel(item = null, fallback = '') {
    const id = String(item?.id || fallback || '');
    if (id === 'bordbuch') return 'Bordbuch';
    if (id === 'fire-extinguisher') return 'Feuerloescher';
    if (id === 'first-aid') return 'Verbandzeug';
    return String(item?.storyName || item?.label || fallback || 'Gegenstand').trim();
}

function _missionComplianceDateDayNumber(value) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
}

function missionComplianceExpiryStatus(expiresAt, now = Date.now()) {
    const expiryDay = _missionComplianceDateDayNumber(expiresAt);
    const date = new Date(Number(now) || Date.now());
    const todayDay = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
    if (!Number.isFinite(expiryDay)) {
        return { valid: false, missing: true, daysRemaining: null, overdueDays: null };
    }
    const daysRemaining = expiryDay - todayDay;
    return {
        valid: daysRemaining >= 0,
        missing: false,
        daysRemaining,
        overdueDays: daysRemaining < 0 ? Math.abs(daysRemaining) : 0
    };
}

function missionComplianceClassifyOverdue(overdueDays) {
    const days = Math.max(0, Math.round(Number(overdueDays || 0)));
    if (days <= 0) return 'valid';
    if (days <= 3) return 'warning';
    return 'entry';
}

function missionComplianceShouldInspect(roll, forced = false) {
    if (forced) return true;
    const value = Number(roll);
    return Number.isFinite(value) && value >= 0 && value < MISSION_COMPLIANCE_PROBABILITY;
}

function _missionComplianceCanDecide() {
    if (!window.missionComplianceAtFinalEndpoint?.()) return false;
    if (window.missionIsFreeflightOnly?.()) return false;
    if (typeof window.missionRuntimeIsActive === 'function' && !window.missionRuntimeIsActive()) return false;
    return true;
}

window.missionComplianceEnsureFinalDecision = function(options = {}) {
    if (!_missionComplianceCanDecide() && options.force !== true) return null;
    const state = _missionComplianceGetState(true);
    if (!state) return null;
    if (state.selected !== null && options.force !== true) {
        if (state.selected === true && !state.snapshot && _missionComplianceCanDecide()) {
            _missionComplianceTakeSnapshot(state);
        }
        return state.selected;
    }
    if (state.phase === 'released') return false;
    const roll = Number.isFinite(Number(options.roll)) ? Number(options.roll) : Math.random();
    state.forced = state.forced || options.force === true;
    state.roll = roll;
    state.selected = missionComplianceShouldInspect(roll, state.forced);
    state.decisionAt = Date.now();
    state.flightId = _missionComplianceFlightId();
    state.phase = state.selected ? 'selected' : 'not_selected';
    state.phaseAt = state.decisionAt;
    _missionCompliancePersist(state, options.force === true ? 'decision-forced' : 'decision-random');
    if (state.selected) {
        _missionComplianceTakeSnapshot(state);
        _missionCompliancePreloadRequest(state);
    }
    return state.selected;
};

window.missionComplianceDebugForceCurrentFlight = function() {
    if (typeof window.missionRuntimeIsActive === 'function' && !window.missionRuntimeIsActive()) {
        try { alert('Die Kontrolle kann nur fuer einen laufenden Missionsflug erzwungen werden.'); } catch (_) {}
        return false;
    }
    const state = _missionComplianceGetState(true);
    if (!state || state.phase === 'released') return false;
    state.forced = true;
    state.selected = true;
    state.roll = 0;
    state.decisionAt = state.decisionAt || Date.now();
    state.flightId = _missionComplianceFlightId();
    if (state.phase === 'none' || state.phase === 'not_selected') {
        state.phase = 'selected';
        state.phaseAt = Date.now();
    }
    _missionCompliancePersist(state, 'debug-force');
    _missionCompliancePreloadRequest(state);
    if (_missionComplianceCanDecide() && window.missionComplianceAtFinalEndpoint?.()) {
        window.missionComplianceStartArrival?.('debug-force-at-destination');
    }
    return true;
};

function _missionComplianceRequestText() {
    return 'Guten Tag, Luftaufsicht. Es handelt sich um eine Behoerdenkontrolle. Bitte laden Sie jetzt das Bordbuch, den Feuerloescher und das Verbandzeug aus. Anschliessend pruefen wir die Gueltigkeit und den Eintrag des aktuellen Fluges.';
}

function _missionComplianceVoiceKey(kind, state, revision = null) {
    const rev = revision == null ? Number(state?.revision || 0) : Number(revision || 0);
    return `compliance-${kind}:${String(state?.flightId || _missionComplianceFlightId()).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 100)}:${rev}`;
}

function _missionCompliancePreloadRequest(state = _missionComplianceGetState(false)) {
    if (!state?.selected) return Promise.resolve(false);
    const text = state.requestText || _missionComplianceRequestText();
    state.requestText = text;
    _missionCompliancePersist(state, 'request-preload');
    if (typeof window.paxVoicePrepareSystemText !== 'function') return Promise.resolve(false);
    try {
        return Promise.resolve(window.paxVoicePrepareSystemText(
            _missionComplianceVoiceKey('request', state, 0),
            text,
            MISSION_COMPLIANCE_INSPECTOR_SPEAKER
        )).catch(() => false);
    } catch (_) {
        return Promise.resolve(false);
    }
}

function _missionComplianceTakeSnapshot(state, manifest = _missionComplianceManifest()) {
    if (!state || state.snapshot) return state?.snapshot || null;
    const items = Array.isArray(manifest?.items) ? manifest.items : [];
    state.snapshot = {
        at: Date.now(),
        flightId: state.flightId || _missionComplianceFlightId(),
        aircraftSlot: String(manifest?.aircraftSlot || ''),
        items: MISSION_COMPLIANCE_REQUESTED_ITEM_IDS.map(id => {
            const item = items.find(entry => String(entry?.id || '') === id) || null;
            return {
                id,
                label: _missionComplianceItemLabel(item, id),
                status: String(item?.status || 'missing'),
                expiresAt: String(item?.expiresAt || ''),
                serialId: String(item?.serialId || '')
            };
        })
    };
    _missionCompliancePersist(state, 'snapshot');
    return state.snapshot;
}

function _missionComplianceUpdateRemediation(state, manifest = _missionComplianceManifest()) {
    if (!state) return [];
    const item = (manifest?.items || []).find(entry => String(entry?.id || '') === 'bordbuch') || null;
    const log = item?.log && typeof item.log === 'object' ? item.log : {};
    const correctFlight = String(log.flightId || '') === String(state.flightId || _missionComplianceFlightId());
    const missingFields = [];
    if (!correctFlight || !Number(log.startAt || 0)) missingFields.push('start');
    if (!correctFlight || !Number(log.landingAt || 0)) missingFields.push('landing');
    const canRemediate = !!item && item.status === 'unloaded';
    state.remediation = {
        required: canRemediate && missingFields.length > 0,
        missingFields: canRemediate ? missingFields : []
    };
    return state.remediation.missingFields;
}

function _missionComplianceTryBeginRequest() {
    const state = _missionComplianceGetState(false);
    if (!state?.selected || state.phase === 'released') return false;
    if (!state.inspectorsWaiting || !state.farewellComplete) return false;
    if (_missionCompliancePhaseAtLeast(state, 'request_playing')) return true;
    _missionComplianceTakeSnapshot(state);
    _missionComplianceSetPhase(state, 'request_playing', 'request-start');
    const text = state.requestText || _missionComplianceRequestText();
    const speak = typeof window.paxVoiceSpeakSystemText === 'function'
        ? window.paxVoiceSpeakSystemText(
            _missionComplianceVoiceKey('request', state, 0),
            text,
            MISSION_COMPLIANCE_INSPECTOR_SPEAKER,
            'Behoerdenkontrolle'
        )
        : Promise.resolve(false);
    missionComplianceRequestPromise = _missionComplianceAwaitVoice(speak)
        .then(() => {
            const current = _missionComplianceGetState(false);
            if (!current?.selected || current.phase !== 'request_playing') return false;
            current.requestSpokenAt = Date.now();
            _missionComplianceUpdateRemediation(current);
            _missionComplianceSetPhase(current, 'evidence_open', 'request-complete');
            try {
                window.openMissionCargoDialog?.('unload');
            } catch (_) {}
            return true;
        })
        .finally(() => {
            missionComplianceRequestPromise = null;
        });
    return true;
}

window.missionComplianceStartArrival = function(reason = 'mission-end-action') {
    const selected = window.missionComplianceEnsureFinalDecision?.();
    if (selected !== true) return false;
    const state = _missionComplianceGetState(false);
    if (!state || state.phase === 'released') return false;
    if (_missionCompliancePhaseAtLeast(state, 'approach_started')) {
        _missionComplianceTryBeginRequest();
        return true;
    }
    _missionComplianceSetPhase(state, 'approach_started', reason);
    _missionCompliancePreloadRequest(state);
    const result = window.missionComplianceStartGroundVisit?.(state, reason);
    const commandId = typeof result === 'string' ? result : String(result?.commandId || '');
    const sceneId = typeof result === 'object' ? String(result?.sceneId || '') : '';
    if (commandId) {
        state.commandId = commandId;
        state.sceneId = sceneId;
        state.sceneFallback = false;
        _missionCompliancePersist(state, 'approach-command');
        _missionComplianceClearTimer('approach');
        missionComplianceApproachTimer = setTimeout(() => {
            window.missionComplianceHandleGroundVisitAck?.({
                type: 'mission_scene_ground_visit_stage',
                commandId,
                sceneId,
                stage: 'visitors_at_aircraft',
                status: 'fallback',
                error: 'approach_timeout'
            });
        }, MISSION_COMPLIANCE_APPROACH_FALLBACK_MS);
    } else {
        state.sceneFallback = true;
        _missionCompliancePersist(state, 'approach-logical-fallback');
        setTimeout(() => {
            window.missionComplianceHandleGroundVisitAck?.({
                type: 'mission_scene_ground_visit_stage',
                stage: 'visitors_at_aircraft',
                status: 'fallback',
                error: 'tracker_unavailable'
            });
        }, 700);
    }
    return true;
};

window.missionComplianceHandleGroundVisitAck = function(ack = {}) {
    const state = _missionComplianceGetState(false);
    if (!state?.selected || state.phase === 'released') return false;
    const expected = String(state.commandId || '');
    const received = String(ack.commandId || '');
    if (expected && received && expected !== received) return false;
    const stage = String(ack.stage || '').toLowerCase();
    if (stage === 'vehicle_parked') {
        _missionCompliancePersist(state, 'vehicle-parked');
        return true;
    }
    if (stage === 'visitors_at_aircraft') {
        _missionComplianceClearTimer('approach');
        state.inspectorsWaiting = true;
        if (String(ack.status || '').toLowerCase() === 'fallback' || String(ack.status || '').toLowerCase() === 'error') {
            state.sceneFallback = true;
        }
        if (!_missionCompliancePhaseAtLeast(state, 'inspectors_waiting')) {
            state.phase = 'inspectors_waiting';
            state.phaseAt = Date.now();
        }
        _missionCompliancePersist(state, 'inspectors-waiting');
        _missionComplianceTryBeginRequest();
        return true;
    }
    if (String(ack.type || '') === 'mission_scene_ground_visit_ack') {
        _missionComplianceClearTimer('departure');
        if (state.phase === 'departing') {
            _missionComplianceRelease(state, ack.status === 'ok' ? 'scene-complete' : 'scene-complete-fallback');
        }
        return true;
    }
    return false;
};

window.missionComplianceRequestClose = function(options = {}) {
    const state = _missionComplianceGetState(false);
    if (!state?.selected || state.phase === 'released') return false;
    state.pendingClose = {
        reason: String(options.reason || 'mission-close-after-compliance'),
        outcome: options.outcome && typeof options.outcome === 'object' ? _missionComplianceClone(options.outcome, null) : null,
        record: options.record && typeof options.record === 'object' ? _missionComplianceClone(options.record, null) : null,
        requestedAt: Date.now()
    };
    state.farewellComplete = true;
    _missionCompliancePersist(state, 'close-held');
    window.missionComplianceStartArrival?.('close-held');
    _missionComplianceTryBeginRequest();
    return true;
};

window.missionComplianceNotifyFarewellComplete = function(options = {}) {
    const state = _missionComplianceGetState(false);
    if (!state?.selected || state.phase === 'released') return false;
    state.farewellComplete = true;
    _missionCompliancePersist(state, String(options.reason || 'farewell-complete'));
    window.missionComplianceStartArrival?.('farewell-complete');
    _missionComplianceTryBeginRequest();
    return true;
};

window.missionComplianceBlockClose = function() {
    const state = _missionComplianceGetState(false);
    return !!(state?.selected && state.phase !== 'released');
};

window.missionComplianceBlockReset = function() {
    const state = _missionComplianceGetState(false);
    return !!(state?.selected && state.phase !== 'released' && state.phase !== 'not_selected');
};

window.missionComplianceReplacementLocked = function() {
    const state = _missionComplianceGetState(false);
    if (!state && _missionComplianceCanDecide()) {
        window.missionComplianceEnsureFinalDecision?.();
        return window.missionComplianceReplacementLocked();
    }
    return !!(state?.selected && state.phase !== 'released');
};

window.missionComplianceBeforeEquipmentReplace = function() {
    if (_missionComplianceCanDecide()) window.missionComplianceEnsureFinalDecision?.();
    return !window.missionComplianceReplacementLocked?.();
};

window.missionComplianceCanMutateCargo = function(itemId, action = '') {
    const state = _missionComplianceGetState(false);
    if (!state?.selected || state.phase === 'released') return true;
    if (!MISSION_COMPLIANCE_REQUESTED_ITEM_IDS.includes(String(itemId || ''))) return true;
    if (state.phase === 'result_playing' || state.phase === 'departing') return false;
    if (String(action || '') === 'replace') return false;
    return true;
};

window.missionComplianceBoardBookWriteAllowed = function(field = 'start', options = {}) {
    const state = _missionComplianceGetState(false);
    if (!state?.selected || state.phase === 'released') return true;
    if (!_missionCompliancePhaseAtLeast(state, 'request_playing')) return true;
    if (state.phase !== 'evidence_open') return false;
    const normalized = field === 'landing' ? 'landing' : 'start';
    return state.remediation?.required === true && state.remediation.missingFields?.includes(normalized);
};

window.missionComplianceNotifyCargoChanged = function(reason = 'cargo-change') {
    const state = _missionComplianceGetState(false);
    if (!state?.selected || state.phase === 'released') return false;
    if (state.phase === 'result_playing' || state.phase === 'departing') return false;
    state.revision += 1;
    if (state.phase === 'evidence_open') _missionComplianceUpdateRemediation(state);
    _missionCompliancePersist(state, reason);
    return true;
};

function _missionComplianceEvidenceResult(state, manifest = _missionComplianceManifest()) {
    const items = Array.isArray(manifest?.items) ? manifest.items : [];
    const inspectedItems = Array.isArray(state?.snapshot?.items) ? state.snapshot.items : [];
    const offences = [];
    const blockingUnload = [];
    const equipment = [];
    for (const id of MISSION_COMPLIANCE_REQUESTED_ITEM_IDS) {
        const item = items.find(entry => String(entry?.id || '') === id) || null;
        const inspectedItem = inspectedItems.find(entry => String(entry?.id || '') === id) || null;
        const label = _missionComplianceItemLabel(item, id);
        const carriedOnFlight = inspectedItem
            ? String(inspectedItem.status || '') === 'loaded'
            : String(item?.status || '') === 'loaded';
        if (!carriedOnFlight) {
            offences.push({
                code: `missing_${id}`,
                itemId: id,
                label,
                severity: 'entry',
                description: `${label} wurde auf dem kontrollierten Flug nicht mitgefuehrt.`
            });
            continue;
        }
        if (item?.status === 'loaded') {
            blockingUnload.push(label);
            continue;
        }
        if (!item || item.status !== 'unloaded') {
            offences.push({
                code: `not_presented_${id}`,
                itemId: id,
                label,
                severity: 'entry',
                description: `${label} wurde bei der Kontrolle nicht vorgelegt.`
            });
            continue;
        }
        if (id === 'bordbuch') {
            const log = item.log && typeof item.log === 'object' ? item.log : {};
            const correctFlight = String(log.flightId || '') === String(state.flightId || '');
            const missingFields = [];
            if (!correctFlight || !Number(log.startAt || 0)) missingFields.push('start');
            if (!correctFlight || !Number(log.landingAt || 0)) missingFields.push('landing');
            if (missingFields.length) {
                return {
                    ready: false,
                    blockingUnload,
                    missingLogFields: missingFields,
                    offences,
                    equipment
                };
            }
            equipment.push({ id, label, status: 'logged', log: _missionComplianceClone(log, {}) });
            continue;
        }
        const inspectedExpiry = String(inspectedItem?.expiresAt || item.expiresAt || '');
        const expiry = missionComplianceExpiryStatus(inspectedExpiry, Date.now());
        const classification = expiry.missing ? 'entry' : missionComplianceClassifyOverdue(expiry.overdueDays);
        equipment.push({
            id,
            label,
            status: classification,
            expiresAt: inspectedExpiry,
            daysRemaining: expiry.daysRemaining,
            overdueDays: expiry.overdueDays
        });
        if (classification === 'warning') {
            offences.push({
                code: `overdue_${id}`,
                itemId: id,
                label,
                severity: 'warning',
                overdueDays: expiry.overdueDays,
                description: `${label} war seit ${expiry.overdueDays} ${expiry.overdueDays === 1 ? 'Tag' : 'Tagen'} abgelaufen.`
            });
        } else if (classification === 'entry') {
            offences.push({
                code: expiry.missing ? `missing_expiry_${id}` : `overdue_${id}`,
                itemId: id,
                label,
                severity: 'entry',
                overdueDays: expiry.overdueDays,
                description: expiry.missing
                    ? `Fuer ${label} war kein gueltiges Ablaufdatum nachweisbar.`
                    : `${label} war seit ${expiry.overdueDays} Tagen abgelaufen.`
            });
        }
    }
    return {
        ready: blockingUnload.length === 0,
        blockingUnload,
        missingLogFields: [],
        offences,
        equipment
    };
}

function _missionComplianceResultVoiceText(result) {
    const entries = (result?.offences || []).filter(offence => offence.severity === 'entry');
    const warnings = (result?.offences || []).filter(offence => offence.severity === 'warning');
    const equipment = Array.isArray(result?.equipment) ? result.equipment : [];
    const validity = equipment
        .filter(item => item.id !== 'bordbuch' && item.status === 'valid')
        .map(item => `${item.label} gueltig bis ${item.expiresAt}`)
        .join(' und ');
    if (!entries.length && !warnings.length) {
        return `Danke. Der aktuelle Flug ist im Bordbuch vollstaendig eingetragen${validity ? `, ${validity}` : ''}. Die Kontrolle ist ohne Beanstandung abgeschlossen. Gute Weiterreise.`;
    }
    const details = [...warnings, ...entries].map(offence => offence.description).join(' ');
    if (entries.length) {
        return `${details} Dafuer wird ein Behoerdeneintrag am Crewboard angelegt, der sieben Tage bestehen bleibt. Die Kontrolle ist damit abgeschlossen.`;
    }
    return `${details} Bei bis zu drei Tagen Ueberziehung bleibt es diesmal bei einer Verwarnung. Die Kontrolle ist abgeschlossen.`;
}

function _missionComplianceCreateSanction(state, result) {
    const entries = (result?.offences || []).filter(offence => offence.severity === 'entry');
    if (!entries.length) return false;
    const now = Date.now();
    const record = {
        id: `authority-${String(state.flightId || '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80)}-${now}`,
        type: 'authority_sanction',
        createdAt: now,
        immutableUntil: now + (7 * 24 * 60 * 60 * 1000),
        expiresAt: now + (7 * 24 * 60 * 60 * 1000),
        flightId: state.flightId,
        aircraftSlot: String(state.snapshot?.aircraftSlot || ''),
        offences: entries.map(entry => _missionComplianceClone(entry, {})),
        text: `BEHOERDENEINTRAG\n\n${entries.map(entry => `• ${entry.description}`).join('\n')}\n\nNicht loeschbar fuer 7 Tage.`
    };
    if (typeof window.addAuthoritySanctionToCrewboard === 'function') {
        try { return !!window.addAuthoritySanctionToCrewboard(record); } catch (_) {}
    }
    return false;
}

function _missionCompliancePlayResult(state) {
    if (!state?.resultText || state.phase !== 'result_playing') return false;
    if (missionComplianceResultPromise) return true;
    try { window.closeMissionCargoDialog?.(); } catch (_) {}
    const result = state.result && typeof state.result === 'object' ? state.result : {};
    const voiceKey = _missionComplianceVoiceKey('result', state, state.revision);
    const prepare = typeof window.paxVoicePrepareSystemText === 'function'
        ? window.paxVoicePrepareSystemText(voiceKey, state.resultText, MISSION_COMPLIANCE_INSPECTOR_SPEAKER)
        : Promise.resolve(false);
    missionComplianceResultPromise = _missionComplianceAwaitVoice(Promise.resolve(prepare)
        .catch(() => false)
        .then(() => {
            if (typeof window.paxVoiceSpeakSystemText !== 'function') return false;
            return window.paxVoiceSpeakSystemText(
                voiceKey,
                state.resultText,
                MISSION_COMPLIANCE_INSPECTOR_SPEAKER,
                Number(result.entryCount || 0) > 0
                    ? 'Kontrolle: Beanstandung'
                    : (Number(result.warningCount || 0) > 0 ? 'Kontrolle: Verwarnung' : 'Kontrolle abgeschlossen')
            );
        }))
        .then(() => {
            const current = _missionComplianceGetState(false);
            if (!current || current.phase !== 'result_playing') return false;
            current.resultSpokenAt = Date.now();
            _missionComplianceSetPhase(current, 'departing', 'result-complete');
            _missionComplianceStartDeparture(current);
            return true;
        })
        .finally(() => {
            missionComplianceResultPromise = null;
        });
    return true;
}

window.missionComplianceSubmitEvidence = function() {
    const state = _missionComplianceGetState(false);
    if (!state?.selected || state.phase !== 'evidence_open') return false;
    const manifest = _missionComplianceManifest();
    const result = _missionComplianceEvidenceResult(state, manifest);
    if (result.blockingUnload?.length) {
        window.missionCargoStatus = window.missionCargoStatus || {};
        window.missionCargoStatus.error = `Fuer die Kontrolle noch ausladen: ${result.blockingUnload.join(', ')}.`;
        try { window.openMissionCargoDialog?.('unload'); } catch (_) {}
        return false;
    }
    if (result.missingLogFields?.length) {
        state.remediation = { required: true, missingFields: result.missingLogFields };
        _missionCompliancePersist(state, 'log-remediation-required');
        window.missionCargoStatus = window.missionCargoStatus || {};
        window.missionCargoStatus.error = `Bordbuch nachtragen: ${result.missingLogFields.includes('start') ? 'Startzeit' : ''}${result.missingLogFields.length > 1 ? ' und ' : ''}${result.missingLogFields.includes('landing') ? 'Landezeit' : ''}.`;
        try { window.openMissionCargoDialog?.('unload'); } catch (_) {}
        return false;
    }
    result.completedAt = Date.now();
    result.warningCount = result.offences.filter(offence => offence.severity === 'warning').length;
    result.entryCount = result.offences.filter(offence => offence.severity === 'entry').length;
    state.result = result;
    state.resultText = _missionComplianceResultVoiceText(result);
    state.remediation = { required: false, missingFields: [] };
    _missionComplianceCreateSanction(state, result);
    _missionComplianceSetPhase(state, 'result_playing', 'evidence-complete');
    return _missionCompliancePlayResult(state);
};

function _missionComplianceStartDeparture(state) {
    if (!state || state.phase !== 'departing') return false;
    const released = window.missionComplianceReleaseGroundVisit?.(state);
    if (!released || state.sceneFallback) {
        setTimeout(() => _missionComplianceRelease(state, 'logical-departure'), 900);
        return true;
    }
    _missionComplianceClearTimer('departure');
    missionComplianceDepartureTimer = setTimeout(() => {
        const current = _missionComplianceGetState(false);
        if (current?.phase === 'departing') {
            current.sceneFallback = true;
            _missionComplianceRelease(current, 'departure-timeout');
        }
    }, MISSION_COMPLIANCE_DEPARTURE_FALLBACK_MS);
    return true;
}

function _missionComplianceRelease(state, reason = 'released') {
    if (!state || state.phase === 'released') return true;
    _missionComplianceClearTimer('approach');
    _missionComplianceClearTimer('departure');
    state.phase = 'released';
    state.phaseAt = Date.now();
    state.releasedAt = state.phaseAt;
    state.inspectorsWaiting = false;
    _missionCompliancePersist(state, reason);
    if (state.pendingClose) {
        setTimeout(() => {
            try { window.missionComplianceReleasePendingClose?.(state.pendingClose); } catch (_) {}
        }, 100);
    }
    return true;
}

window.missionComplianceGetCargoUiState = function() {
    const state = _missionComplianceGetState(false);
    if (!state?.selected || state.phase === 'released') {
        return {
            active: false,
            phase: state?.phase || 'none',
            replacementLocked: false,
            message: '',
            actionLabel: ''
        };
    }
    let message = 'Behoerdenkontrolle ist fuer diesen Flug vorgesehen.';
    let actionLabel = 'Kontrolle wird vorbereitet ...';
    if (state.phase === 'approach_started' || state.phase === 'inspectors_waiting') {
        message = state.inspectorsWaiting
            ? 'Die Kontrolleure warten am Flugzeug auf das Ende des Farewells.'
            : 'Das Behoerdenfahrzeug ist unterwegs. Ausladen ist bereits moeglich; Austauschen ist gesperrt.';
    } else if (state.phase === 'request_playing') {
        message = 'Die Kontrollansage laeuft. Bitte auf die Aufforderung warten.';
    } else if (state.phase === 'evidence_open') {
        message = state.remediation?.required
            ? 'Der aktuelle Bordbucheintrag muss vor Abschluss der Kontrolle nachgetragen werden.'
            : 'Bordbuch, Feuerloescher und Verbandzeug ausladen und anschliessend zur Pruefung vorlegen.';
        actionLabel = 'Der Kontrolle vorlegen';
    } else if (state.phase === 'result_playing') {
        message = 'Das Kontrollergebnis wird bekanntgegeben.';
    } else if (state.phase === 'departing') {
        message = 'Die Kontrolleure kehren zum Fahrzeug zurueck. Missionsende bleibt bis zur Abfahrt gesperrt.';
    }
    return {
        active: true,
        phase: state.phase,
        replacementLocked: true,
        message,
        actionLabel,
        remediation: _missionComplianceClone(state.remediation, null)
    };
};

window.missionComplianceOpenCargo = function() {
    try {
        window.openMissionCargoDialog?.('unload');
        return true;
    } catch (_) {
        return false;
    }
};

function _missionComplianceRender() {
    if (typeof document === 'undefined' || !document.body) return;
    const state = _missionComplianceGetState(false);
    let banner = document.getElementById('missionComplianceBanner');
    if (!state?.selected || state.phase === 'selected' || state.phase === 'not_selected' || state.phase === 'none' || state.phase === 'released') {
        if (banner) banner.hidden = true;
        return;
    }
    if (!banner) {
        banner = document.createElement('section');
        banner.id = 'missionComplianceBanner';
        banner.className = 'mission-compliance-banner';
        banner.setAttribute('role', 'status');
        banner.innerHTML = `
            <div class="mission-compliance-banner-copy">
                <strong>BEHOERDENKONTROLLE</strong>
                <span data-compliance-message></span>
            </div>
            <button type="button" data-compliance-open-cargo>Verladefenster</button>
        `;
        banner.querySelector('[data-compliance-open-cargo]')?.addEventListener('click', () => {
            window.missionComplianceOpenCargo?.();
        });
        document.body.appendChild(banner);
    }
    const ui = window.missionComplianceGetCargoUiState?.() || {};
    const message = banner.querySelector('[data-compliance-message]');
    const button = banner.querySelector('[data-compliance-open-cargo]');
    if (message) message.textContent = ui.message || 'Kontrolle laeuft.';
    if (button) {
        const allowOpen = state.phase === 'evidence_open' || state.phase === 'approach_started' || state.phase === 'inspectors_waiting';
        button.hidden = !allowOpen;
        button.disabled = !allowOpen;
    }
    banner.hidden = false;
}

window.missionComplianceResume = function(reason = 'resume') {
    _missionComplianceClearTimer('resume');
    missionComplianceResumeTimer = setTimeout(() => {
        missionComplianceResumeTimer = null;
        const state = _missionComplianceGetState(false);
        if (!state?.selected) {
            _missionComplianceRender();
            return;
        }
        if (state.phase === 'request_playing') {
            state.phase = 'inspectors_waiting';
            state.inspectorsWaiting = true;
            state.phaseAt = Date.now();
            _missionCompliancePersist(state, `${reason}-request-retry`);
        }
        if (state.phase === 'result_playing' && state.resultText) {
            _missionCompliancePersist(state, `${reason}-result-retry`);
            _missionCompliancePlayResult(state);
            return;
        }
        if (state.phase === 'approach_started') {
            state.phase = 'selected';
            state.commandId = '';
            state.sceneId = '';
            state.inspectorsWaiting = false;
            _missionCompliancePersist(state, `${reason}-approach-retry`);
            window.missionComplianceStartArrival?.(`${reason}-approach`);
            return;
        }
        if (state.phase === 'inspectors_waiting') {
            state.inspectorsWaiting = true;
            _missionCompliancePersist(state, `${reason}-waiting`);
            _missionComplianceTryBeginRequest();
            return;
        }
        if (state.phase === 'evidence_open') {
            _missionComplianceUpdateRemediation(state);
            _missionCompliancePersist(state, `${reason}-evidence`);
            setTimeout(() => window.openMissionCargoDialog?.('unload'), 500);
            return;
        }
        if (state.phase === 'departing') {
            _missionComplianceStartDeparture(state);
            return;
        }
        if (state.phase === 'released' && state.pendingClose) {
            setTimeout(() => window.missionComplianceReleasePendingClose?.(state.pendingClose), 300);
            return;
        }
        _missionComplianceRender();
    }, 250);
    return true;
};

window.missionComplianceGetDebugState = function() {
    return _missionComplianceClone(_missionComplianceGetState(false), null);
};

window.MissionComplianceCore = Object.freeze({
    probability: MISSION_COMPLIANCE_PROBABILITY,
    requestedItemIds: MISSION_COMPLIANCE_REQUESTED_ITEM_IDS,
    shouldInspect: missionComplianceShouldInspect,
    expiryStatus: missionComplianceExpiryStatus,
    classifyOverdue: missionComplianceClassifyOverdue
});

window.addEventListener('missioncargochange', () => {
    window.missionComplianceNotifyCargoChanged?.('cargo-change-event');
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => _missionComplianceRender(), { once: true });
} else {
    _missionComplianceRender();
}
