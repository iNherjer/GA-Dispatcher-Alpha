/* === CLOUD SYNC & MULTIPLAYER FETCH LOGIC (v220) === */
/* =========================================================
   CLOUD SYNC LOGIC (Adaptive, Diffing, Debounce & Toggle)
   ========================================================= */
const SYNC_URL = 'https://ga-proxy.einherjer.workers.dev/api/sync/';
const SYNC_MAX_UPLOAD_BYTES = 95000;
let localSyncTime = localStorage.getItem('ga_sync_time') ? parseInt(localStorage.getItem('ga_sync_time')) : 0;
let lastSyncedPayloadStr = "";

function saveSyncToggle() {
    const t = document.getElementById('syncToggle');
    const label = document.getElementById('autoSyncLabel');
    if (t) {
        localStorage.setItem('ga_sync_enabled', t.checked);
        if (label) label.style.color = t.checked ? '#4caf50' : '#888';
    }
    if (t && t.checked) silentSyncLoad();
}

function getSyncId() {
    return document.getElementById('syncIdInput')?.value.trim() || localStorage.getItem('ga_sync_id') || "";
}

function getSyncPin() {
    return document.getElementById('syncPinInput')?.value.trim() || localStorage.getItem('ga_sync_pin') || "";
}

let liveSnailTrail = null;
let lastTrailPoint = null;
let isAutoFollow = true;
let lastGpsTickDetails = null;
let lastTelemetryUpdateAt = 0;
let lastMissionRuntimeLiveUiRefreshAt = 0;
const PLANE_ICON_COLOR_KEY = 'ga_plane_color';
const PLANE_ICON_SIZE_KEY = 'ga_plane_size';
const PLANE_ICON_DEFAULT_COLOR = '#f2c12e';
const PLANE_ICON_DEFAULT_SIZE = 40;
const PLANE_ICON_MIN_SIZE = 20;
const PLANE_ICON_MAX_SIZE = 100;
const BOARDING_MARKER_STORAGE_KEY = 'ga_boarding_marker_enabled';
const MISSION_SCENE_ID_REGISTRY_KEY = 'ga_mission_scene_ids';
const BOARDING_MARKER_TITLE = 'Cone_Medium';
const BOARDING_CARGO_FALLBACK_TITLE = 'CoffeeCup';
const MISSION_SCENE_SIGNAL_SMOKE_TITLE = 'VO_Smoke_R1_105_Black';
const MISSION_SCENE_SIGNAL_SMOKE_ALT_OFFSET_FT = -110;
const MISSION_SCENE_ASSET_CATALOG = (window.MISSION_SCENE_ASSETS && window.MISSION_SCENE_ASSETS.roles) || {};

function _sceneUniqueTitles(...sources) {
    const out = [];
    const add = (value) => {
        const s = String(value || '').trim();
        if (!s || out.includes(s)) return;
        out.push(s);
    };
    sources.forEach(src => {
        if (Array.isArray(src)) src.forEach(add);
        else add(src);
    });
    return out;
}

function _sceneCatalogRoleTitles(role, fallback = []) {
    return _sceneUniqueTitles(MISSION_SCENE_ASSET_CATALOG[String(role || '')], fallback);
}

function _sceneCatalogRoleMerge(roles = [], fallback = []) {
    const sources = (Array.isArray(roles) ? roles : [roles]).map(role => MISSION_SCENE_ASSET_CATALOG[String(role || '')]);
    return _sceneUniqueTitles(...sources, fallback);
}

const MISSION_SCENE_ASSET_POOLS = {
    smallCargo: _sceneCatalogRoleTitles('cargo.small_box', [
        'Cardboard',
        BOARDING_CARGO_FALLBACK_TITLE
    ]),
    medicalEquipment: _sceneCatalogRoleTitles('cargo.medical_kit', [
        'Cardboard'
    ]),
    animalTransportBoxes: _sceneCatalogRoleTitles('cargo.animal_transport_box', [
        'Cardboard',
        'Pallet01_03'
    ]),
    palletCargo: _sceneCatalogRoleMerge(['cargo.pallet_large', 'cargo.pallet_medium', 'cargo.pallet_small'], [
        'Pallet01_01',
        'Pallet01_02',
        'Pallet01_03',
        'Cardboard',
        BOARDING_CARGO_FALLBACK_TITLE
    ]),
    cargo: _sceneCatalogRoleMerge(['cargo.container', 'cargo.pallet_large', 'cargo.pallet_medium', 'cargo.pallet_small', 'cargo.small_box'], [
        'Cardboard',
        'Drop_Container',
        'Pallet01_02',
        'Pallet01_01',
        'Pallet01_03',
        'Rice_Bag_50',
        BOARDING_CARGO_FALLBACK_TITLE
    ]),
    fireCargo: _sceneCatalogRoleMerge(['cargo.container', 'cargo.small_box', 'cargo.pallet_medium'], [
        'Drop_Container',
        'Cardboard',
        'Rice_Bag_50',
        'Pallet01_01',
        BOARDING_CARGO_FALLBACK_TITLE
    ]),
    sarCargo: _sceneCatalogRoleMerge(['cargo.container', 'cargo.small_box', 'sar.liferaft'], [
        'Cardboard',
        'Drop_Container',
        'LifeRaft',
        BOARDING_CARGO_FALLBACK_TITLE
    ]),
    sarWaterTarget: _sceneCatalogRoleTitles('sar.liferaft', [
        'LifeRaft'
    ]),
    fireVehicles: _sceneCatalogRoleTitles('vehicle.emergency.fire', [
        'Car Bush Firefighting'
    ]),
    medicalVehicles: _sceneCatalogRoleTitles('vehicle.emergency.medical', [
        'Car Bush Medic',
        'Van Asia High Roof Medic'
    ]),
    cars: _sceneCatalogRoleTitles('vehicle.car', [
        'Microsoft_Car_EUR_01',
        'Microsoft_Car_EUR_02',
        'Microsoft_Car_EUR_03',
        'Microsoft_Car_EUR_04',
        'Microsoft_Minicar_01'
    ]),
    vans: _sceneCatalogRoleTitles('vehicle.van', [
        'Microsoft_Van_EUR'
    ]),
    trucks: _sceneCatalogRoleTitles('vehicle.truck', [
        'Truck Utility Europe Flush',
        'Truck Utility NorthAm'
    ]),
    buses: _sceneCatalogRoleTitles('vehicle.bus', [
        'Bus',
        'Microsoft_Bus_Modern',
        'Microsoft_MiniBus_ASIA_01'
    ]),
    quads: _sceneCatalogRoleTitles('vehicle.quad', [
        'Microsoft_Quad'
    ]),
    vehicles: _sceneCatalogRoleMerge(['vehicle.car', 'vehicle.van', 'vehicle.quad'], [
        'Microsoft_Van_EUR',
        'Microsoft_Quad',
        'Microsoft_Car_EUR_01',
        'Microsoft_Car_EUR_02',
        'Microsoft_Car_EUR_03',
        'Microsoft_Car_EUR_04',
        'Microsoft_Minicar_01'
    ]),
    boats: _sceneCatalogRoleTitles('watercraft.boat', [
        'Fishing Boat Red Modular',
        'Fishing Boat White Modular'
    ]),
    smallBoats: _sceneCatalogRoleTitles('watercraft.small_boat', [
        'Fishing Boat Red Modular',
        'Fishing Boat White Modular'
    ]),
    serviceShips: _sceneCatalogRoleTitles('watercraft.service_ship', [
        'Microsoft_Ships_AbeilleBourbon_1.0'
    ]),
    ships: _sceneCatalogRoleTitles('watercraft.ship', [
        'CargoShip01',
        'CruiseShip01'
    ]),
    waterfowl: _sceneCatalogRoleMerge(['animal.waterfowl', 'animal.bird'], [
        'Goose',
        'Seagull'
    ]),
    wildlifeAnimals: _sceneCatalogRoleMerge(['animal.wildlife', 'animal.deer'], [
        'OHemionusFemale',
        'OHemionusJuvenile',
        'AAlcesFemale'
    ]),
    grazingAnimals: _sceneCatalogRoleTitles('animal.grazing', [
        'ALerviaFemale',
        'ALerviaJuvenile',
        'BTaurusPrimigeniusFemale',
        'BFrontalisMale',
        'ECaballusFemale'
    ]),
    animalTransportAnimals: _sceneUniqueTitles([
        'Seagull',
        'Goose',
        'OHemionusFemale',
        'OHemionusJuvenile',
        'CHircusHircusFemale',
        'CHircusHircusJuvenile'
    ]),
    campTents: _sceneCatalogRoleTitles('camp.tent', [
        'LFPB_AS_Tent_01',
        'LFPB_AS_Tent_Dome_Blue'
    ]),
    campTrailers: _sceneCatalogRoleTitles('camp.trailer', [
        'MICROSOFT_ASSET_GlidersTrailerGlobal'
    ]),
    constructionCranes: _sceneCatalogRoleTitles('construction.crane', [
        'Truck Crane Small',
        'Microsoft_Truck_Crane_Small'
    ]),
    constructionEarthmoving: _sceneCatalogRoleTitles('construction.earthmoving', [
        'Bulldozer',
        'Microsoft_Bulldozer'
    ]),
    utilityPower: _sceneCatalogRoleTitles('utility.powerline', [
        'PowerPylon_Base',
        'PowerPylon_Top'
    ]),
    windTurbines: _sceneCatalogRoleTitles('utility.wind_turbine', [
        'WindTurbine',
        'Wind_Turbine',
        'WindTurbine01',
        'Wind_Turbine_01',
        'Microsoft_WindTurbine',
        'Microsoft_Wind_Turbine'
    ]),
    utilityGenerators: _sceneCatalogRoleTitles('utility.generator', [
        'PowerGenerator',
        'GeneracPowerSystems01',
        'Car Ground Power Unit'
    ]),
    peopleFemale: _sceneCatalogRoleTitles('person.ground_crew', [
        'Tarmac_Female_Summer_Asian',
        'Termac_Female_Summer_Asian'
    ]),
    peopleMale: _sceneCatalogRoleTitles('person.male', [
        'Tarmac_Male_Summer_Asian',
        'Termac_Male_Summer_Asian',
        'Tarmac_Male_Summer_Caucasian',
        'Tarmac_Male_Summer_Black'
    ]),
    people: _sceneCatalogRoleMerge(['person.ground_crew', 'person.male'], [
        'Tarmac_Female_Summer_Asian',
        'Tarmac_Male_Summer_Asian'
    ]),
    smokeVfx: _sceneCatalogRoleTitles('vfx.smoke', [
        'Chimney_Smoke_V1'
    ]),
    fireVfx: _sceneCatalogRoleTitles('vfx.fire', [
        'VO_Fire_R1_40'
    ]),
    markers: _sceneCatalogRoleTitles('marker.cone', [
        'Cone_Medium'
    ]),
    material: _sceneCatalogRoleTitles('material.log', [
        'Log',
        'Pallet01_03',
        'Pallet01_02',
        'Pallet01_01'
    ]),
    natureLogs: _sceneCatalogRoleTitles('nature.log', [
        'Log_01',
        'Log'
    ]),
    debrisLight: _sceneCatalogRoleTitles('debris.light', [
        'Log_01',
        'Cardboard',
        'Pallet01_03'
    ])
};
let boardingMarkerRefreshTimer = null;

function isMissionAutoStartEnabled() {
    return false;
}

function setMissionAutoStartEnabled(enabled) {
    if (!missionRuntime.active) missionRuntime.armed = false;
    if (!missionRuntime.active) missionRuntime.readySince = 0;
    _updateMissionRuntimeUi();
    return false;
}

// Legacy no-op API: kept so older UI hooks or saved handlers do not break.
window.isMissionAutoStartEnabled = isMissionAutoStartEnabled;
window.setMissionAutoStartEnabled = setMissionAutoStartEnabled;
window.toggleMissionAutoStart = function() {
    return setMissionAutoStartEnabled(false);
};

function isBoardingMarkerEnabled() {
    return localStorage.getItem(BOARDING_MARKER_STORAGE_KEY) === 'true';
}
window.isBoardingMarkerEnabled = isBoardingMarkerEnabled;

function _boardingMarkerSceneId() {
    return `${_missionSceneId()}-boarding-markers`;
}

function _readMissionSceneIdRegistry() {
    try {
        const raw = JSON.parse(localStorage.getItem(MISSION_SCENE_ID_REGISTRY_KEY) || '[]');
        if (!Array.isArray(raw)) return [];
        return raw.map(id => String(id || '').trim()).filter(Boolean);
    } catch (_) {
        return [];
    }
}

function _writeMissionSceneIdRegistry(ids = []) {
    try {
        const clean = [...new Set(ids.map(id => String(id || '').trim()).filter(Boolean))].slice(-80);
        localStorage.setItem(MISSION_SCENE_ID_REGISTRY_KEY, JSON.stringify(clean));
    } catch (_) {}
}

function _rememberMissionSceneId(sceneId) {
    const id = String(sceneId || '').trim();
    if (!id) return;
    const ids = _readMissionSceneIdRegistry();
    ids.push(id);
    _writeMissionSceneIdRegistry(ids);
}

function _knownMissionSceneIds(...extraIds) {
    return [...new Set([
        ..._readMissionSceneIdRegistry(),
        ...extraIds
    ].map(id => String(id || '').trim()).filter(Boolean))];
}

function _refreshBoardingMarkerToggle() {
    const toggle = document.getElementById('boardingMarkerToggle');
    if (toggle) toggle.checked = isBoardingMarkerEnabled();
}

window.setBoardingMarkerOption = function(enabled) {
    localStorage.setItem(BOARDING_MARKER_STORAGE_KEY, enabled ? 'true' : 'false');
    _refreshBoardingMarkerToggle();
    if (enabled) {
        window.scheduleBoardingMarkerRefresh?.('marker-enabled');
    } else {
        window.boardingMarkerClear?.('marker-disabled');
    }
};

// --- PREDICTION VECTORS ---
let predictionLine = null;
let predictionMarkers = [];
let lastPredictionUpdate = 0;
let smoothedGS = 0;
let smoothedVS = 0;
let liveToWpLine = null;
let vpProfileLockIdx = -1;
let vpProfileLockSig = '';

// --- FLIGHT RECORDER (Snail Trail + Stats) ---
let flightRecorder = {
    active: false,
    armed: false,
    startCandidateSince: 0,
    lastUpdateTs: 0,
    pauseActive: false,
    airborneEvidenceSec: 0,
    hadAirbornePhase: false,
    startTs: 0,
    endTs: 0,
    lowSpeedSince: 0,
    wasOnGround: false,
    farewellTriggered: false,
    touchdownVsFpm: null,
    maxGs: 0,
    maxAltFt: 0,
    sumGs: 0,
    gsSamples: 0,
    distNm: 0,
    track: [],
    lastSample: null,
    maxBankDeg: 0,
    maxGForce: 1.0,
    sumGForce: 0,
    gForceSamples: 0,
    maxAglFt: 0,
    maxClimbFpm: 0,
    maxDescentFpm: 0
};

let missionRuntime = {
    phase: 'idle',
    armed: false,
    active: false,
    manual: false,
    closingPending: false,
    closingReason: '',
    closingOutcome: null,
    closingRequestedAt: 0,
    readySince: 0,
    pendingEndAt: 0,
    lastOffDestAt: 0,
    landingRollTriggered: false,
    arrivalFarewellTriggered: false,
    arrivalFlightRecord: null,
    waitingFarewellDeboarding: false,
    deboardingAfterFarewellStarted: false,
    endReadinessKey: ''
};

function _missionRuntimePhaseSnapshot() {
    const validMission = _hasValidMissionForStart();
    if (missionRuntime.closingPending) return 'closing';
    if (missionRuntime.active) {
        return missionRuntime.phase === 'end_ready' ? 'end_ready' : 'active';
    }
    const startPhase = _missionStartPhase();
    if (startPhase === 'boarded') return 'boarded';
    if (startPhase === 'boarding') return 'boarding';
    if (startPhase === 'prepare') return 'prepare';
    return validMission ? 'planned' : 'idle';
}

function _setMissionRuntimePhase(phase = 'idle', options = {}) {
    const prev = String(missionRuntime.phase || 'idle');
    const next = String(phase || 'idle');
    missionRuntime.phase = next;
    if (prev !== next) {
        _missionPhaseDebugPush('runtime_phase', {
            from: prev,
            to: next,
            trigger: options.reason || 'set-runtime-phase'
        });
    }
    if (options.updateUi !== false) _updateMissionRuntimeUi();
    return next;
}

let missionSmokeCommandSeq = 0;
const missionSceneBoardingWaiters = new Map();
const trackerPayloadWaiters = new Map();
const missionTargetSceneTerrainRequests = new Map();
const trackerPendingMissionCommands = new Map();
let missionSceneBoardingPromise = null;
let missionStartBoardingPromise = null;
let missionStartActionPromise = null;
const TRACKER_RETRYABLE_COMMAND_TYPES = new Set([
    'mission_scene_spawn',
    'mission_scene_clear',
    'mission_scene_boarding',
    'mission_scene_deboarding',
    'mission_smoke_spawn',
    'mission_smoke_clear'
]);
const TRACKER_ACK_SUCCESS = new Set(['ok', 'noop']);

function _trackerAckTypeForCommand(type = '') {
    const t = String(type || '').toLowerCase();
    if (!t) return '';
    if (t === 'mission_scene_spawn') return 'mission_scene_spawn_ack';
    if (t === 'mission_scene_clear') return 'mission_scene_clear_ack';
    if (t === 'mission_scene_boarding') return 'mission_scene_boarding_ack';
    if (t === 'mission_scene_deboarding') return 'mission_scene_deboarding_ack';
    if (t === 'mission_smoke_spawn') return 'mission_smoke_spawn_ack';
    if (t === 'mission_smoke_clear') return 'mission_smoke_clear_ack';
    return '';
}

function _trackerRetryConfigForCommand(type = '') {
    const t = String(type || '').toLowerCase();
    if (t === 'mission_scene_spawn') {
        // Spawn is not idempotent on all tracker builds; retries can duplicate scene objects.
        return { maxAttempts: 1, timeoutMs: 18000 };
    }
    if (t === 'mission_scene_boarding') {
        // Boarding is non-idempotent; a retry can run a second boarding in parallel.
        return { maxAttempts: 1, timeoutMs: 52000 };
    }
    if (t === 'mission_scene_deboarding') {
        return { maxAttempts: 1, timeoutMs: 52000 };
    }
    return { maxAttempts: 3, timeoutMs: 12000 };
}

function _trackerIsWsOpen() {
    return !!(liveGpsSocket && liveGpsSocket.readyState === WebSocket.OPEN);
}

function _trackerPendingClear(commandId) {
    const id = String(commandId || '').trim();
    if (!id) return;
    const entry = trackerPendingMissionCommands.get(id);
    if (!entry) return;
    if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
    if (entry.retryHandle) clearTimeout(entry.retryHandle);
    trackerPendingMissionCommands.delete(id);
}

function _trackerPendingArmTimeout(commandId) {
    const id = String(commandId || '').trim();
    const entry = trackerPendingMissionCommands.get(id);
    if (!entry) return;
    if (entry.timeoutHandle) clearTimeout(entry.timeoutHandle);
    entry.timeoutHandle = setTimeout(() => {
        const current = trackerPendingMissionCommands.get(id);
        if (!current) return;
        if (!_trackerIsWsOpen()) {
            _trackerPendingArmTimeout(id);
            return;
        }
        if (current.attempts >= current.maxAttempts) {
            console.warn(`[TrackerCmd] Retry exhausted ${current.type} id=${id} attempts=${current.attempts}/${current.maxAttempts}`);
            _trackerPendingClear(id);
            return;
        }
        _trackerPendingRetryNow(id, 'timeout');
    }, Math.max(2000, Number(entry.timeoutMs) || 12000));
}

function _trackerPendingMarkSent(command = {}, commandId, options = {}) {
    const type = String(command.type || '').toLowerCase();
    if (!TRACKER_RETRYABLE_COMMAND_TYPES.has(type)) return;
    const id = String(commandId || '').trim();
    if (!id) return;
    const isRetry = options.isRetryAttempt === true;
    const cfg = _trackerRetryConfigForCommand(type);
    const prev = trackerPendingMissionCommands.get(id);
    const entry = prev || {
        commandId: id,
        type,
        ackType: _trackerAckTypeForCommand(type),
        command: null,
        attempts: 0,
        maxAttempts: Number(cfg.maxAttempts) || 3,
        timeoutMs: Number(cfg.timeoutMs) || 12000,
        firstSentAt: 0,
        lastSentAt: 0,
        timeoutHandle: null,
        retryHandle: null
    };
    if (entry.retryHandle) {
        clearTimeout(entry.retryHandle);
        entry.retryHandle = null;
    }
    entry.type = type;
    entry.ackType = _trackerAckTypeForCommand(type);
    entry.command = { ...command, commandId: id };
    entry.maxAttempts = Number(cfg.maxAttempts) || entry.maxAttempts || 3;
    entry.timeoutMs = Number(cfg.timeoutMs) || entry.timeoutMs || 12000;
    entry.attempts = isRetry ? Math.max(2, Number(entry.attempts || 0) + 1) : 1;
    entry.lastSentAt = Date.now();
    if (!entry.firstSentAt) entry.firstSentAt = entry.lastSentAt;
    trackerPendingMissionCommands.set(id, entry);
    if (isRetry) {
        const why = options.retryReason ? ` (${options.retryReason})` : '';
        console.warn(`[TrackerCmd] Retry send ${type} id=${id} attempt=${entry.attempts}/${entry.maxAttempts}${why}`);
    }
    _trackerPendingArmTimeout(id);
}

function _trackerPendingRetryNow(commandId, reason = 'retry') {
    const id = String(commandId || '').trim();
    const entry = trackerPendingMissionCommands.get(id);
    if (!entry || !entry.command) return false;
    if (!_trackerIsWsOpen()) return false;
    if (entry.attempts >= entry.maxAttempts) {
        console.warn(`[TrackerCmd] Retry blocked ${entry.type} id=${id} attempts=${entry.attempts}/${entry.maxAttempts}`);
        _trackerPendingClear(id);
        return false;
    }
    const sentId = window.sendTrackerCommand({ ...entry.command, commandId: id }, { isRetryAttempt: true, retryReason: reason });
    return !!sentId;
}

function _trackerPendingScheduleRetry(commandId, reason = 'ack-failed', delayMs = 450) {
    const id = String(commandId || '').trim();
    const entry = trackerPendingMissionCommands.get(id);
    if (!entry) return;
    if (entry.retryHandle) clearTimeout(entry.retryHandle);
    entry.retryHandle = setTimeout(() => {
        const current = trackerPendingMissionCommands.get(id);
        if (!current) return;
        if (!_trackerIsWsOpen()) return;
        if (current.attempts >= current.maxAttempts) {
            console.warn(`[TrackerCmd] Retry exhausted ${current.type} id=${id} attempts=${current.attempts}/${current.maxAttempts} after ${reason}`);
            _trackerPendingClear(id);
            return;
        }
        _trackerPendingRetryNow(id, reason);
    }, Math.max(100, Number(delayMs) || 450));
}

function _trackerPendingHandleAck(ack = {}) {
    const type = String(ack.type || '').toLowerCase();
    if (!type.endsWith('_ack')) return;
    const commandId = String(ack.commandId || '').trim();
    if (!commandId) return;
    const entry = trackerPendingMissionCommands.get(commandId);
    if (!entry) return;
    if (entry.ackType && entry.ackType !== type) return;
    const status = String(ack.status || '').toLowerCase();
    if (TRACKER_ACK_SUCCESS.has(status)) {
        _trackerPendingClear(commandId);
        return;
    }
    _trackerPendingScheduleRetry(commandId, `ack:${status || 'failed'}`);
}

function _trackerPendingResendAll(reason = 'reconnect') {
    if (!_trackerIsWsOpen() || trackerPendingMissionCommands.size === 0) return;
    const pending = Array.from(trackerPendingMissionCommands.values())
        .sort((a, b) => Number(a.lastSentAt || 0) - Number(b.lastSentAt || 0));
    pending.forEach((entry, idx) => {
        setTimeout(() => {
            const current = trackerPendingMissionCommands.get(entry.commandId);
            if (!current || !_trackerIsWsOpen()) return;
            const ageMs = Date.now() - Number(current.lastSentAt || 0);
            if (ageMs < 1200) return;
            _trackerPendingRetryNow(entry.commandId, reason);
        }, 120 * idx);
    });
}

const FIRE_DEBUG_SYNC_BUILD = 'scene-assets-20260520-04';
const MISSION_SCENE_DEFAULT_VEHICLE_TITLE = 'Car Bush Firefighting';
const MISSION_SCENE_DEFAULT_PERSON_TITLE = 'Tarmac_Female_Summer_Asian';
const MISSION_SCENE_DEFAULT_PERSON_MALE_TITLE = 'Tarmac_Male_Summer_Asian';
const MISSION_SCENE_DEBUG_MAX_EVENTS = 50;
const MISSION_PHASE_DEBUG_MAX_EVENTS = 180;

function _missionPhaseDebugState() {
    if (!window.gaMissionPhaseDebug || typeof window.gaMissionPhaseDebug !== 'object') {
        window.gaMissionPhaseDebug = {
            ts: Date.now(),
            sessionStartedAt: Date.now(),
            events: [],
            lastGroundActionSig: '',
            lastRuntimePhase: '',
            lastStartPhase: '',
            lastBushStatus: ''
        };
    }
    if (!Array.isArray(window.gaMissionPhaseDebug.events)) window.gaMissionPhaseDebug.events = [];
    return window.gaMissionPhaseDebug;
}

function _missionPhaseDebugPush(kind = 'event', payload = {}) {
    const dbg = _missionPhaseDebugState();
    const entry = {
        ts: Date.now(),
        kind: String(kind || 'event'),
        payload: payload && typeof payload === 'object' ? { ...payload } : { value: payload }
    };
    dbg.ts = entry.ts;
    dbg.events.push(entry);
    if (dbg.events.length > MISSION_PHASE_DEBUG_MAX_EVENTS) {
        dbg.events.splice(0, dbg.events.length - MISSION_PHASE_DEBUG_MAX_EVENTS);
    }
    try { console.debug('[MISSION PHASE]', entry.kind, entry.payload); } catch (_) {}
    if (typeof window.vpRefreshWeatherDebugReport === 'function') {
        try { window.vpRefreshWeatherDebugReport(); } catch (_) {}
    }
    return entry;
}

function _missionPhaseDebugSummarizeGroundAction(action = null, context = {}) {
    const safe = action && typeof action === 'object' ? action : {};
    return {
        trigger: context.trigger || null,
        action: safe.action || 'none',
        phase: safe.phase || 'unknown',
        endReady: !!safe.endReady,
        pickupConfirmOnly: !!safe.pickupConfirmOnly,
        atTarget: context.endReady?.atTarget === true,
        groundStill: context.endReady?.groundStill === true,
        reason: context.endReady?.reason || null,
        bushStatus: context.bushStatus || null,
        simMode: !!window.simModeActive
    };
}

window.gaMissionPhaseDebugGet = function() {
    return JSON.parse(JSON.stringify(_missionPhaseDebugState()));
};

window.gaMissionPhaseDebugRecord = function(kind = 'event', payload = {}) {
    return _missionPhaseDebugPush(kind, payload);
};

window.gaMissionPhaseDebugClear = function() {
    window.gaMissionPhaseDebug = null;
    return _missionPhaseDebugState();
};
window.fireMissionDebugSyncBuild = FIRE_DEBUG_SYNC_BUILD;
window.missionSmokeStatus = {
    lastCommandAt: 0,
    lastAckAt: 0,
    lastAck: null
};
window.missionSceneStatus = {
    sceneId: null,
    lastCommandAt: 0,
    lastAckAt: 0,
    lastAck: null,
    spawned: false,
    spawnedCount: 0,
    spawnRequested: false,
    clearRequested: false,
    boardingRequested: false,
    boardingActive: false,
    boardingComplete: false,
    boardingError: null,
    personBoarded: false,
    autoSpawnedFor: null,
    autoClearedFor: null
};
window.missionCargoStatus = {
    manifestKey: '',
    lastMode: 'load',
    loadConfirmed: false,
    signatureAnimationEndsAt: 0,
    signatureAnimationTimer: 0,
    lastCommandAt: 0,
    lastAckAt: 0,
    lastAck: null,
    error: null,
    payloadMissionKey: '',
    payloadBaseline: null,
    payloadLayout: null,
    payloadPlan: null,
    payloadSyncRunning: false,
    payloadSyncQueued: '',
    payloadSyncAt: 0,
    payloadNeedsSync: false,
    payloadPendingResetStations: null,
    payloadPendingResetMaxStations: 0,
    dialogScroll: null
};
window.aircraftPayloadStatus = {
    lastCommandAt: 0,
    lastAckAt: 0,
    lastAck: null,
    lastSnapshotAt: 0,
    snapshot: null,
    error: null
};
const MISSION_CARGO_AUTO_LOAD_KEY = 'ga_mission_cargo_auto_load_enabled';
const MISSION_CARGO_RELOAD_MAX_DISTANCE_M = 200;
let missionCargoUiSyncHooked = false;
window.missionTargetSceneStatus = {
    sceneId: null,
    kind: null,
    lastCommandAt: 0,
    lastAckAt: 0,
    lastAck: null,
    spawned: false,
    spawnedCount: 0,
    spawnRequested: false,
    clearRequested: false,
    cleared: false,
    clearedCount: 0,
    error: null
};
window.missionAptArrivalSceneStatus = {
    sceneId: null,
    role: null,
    planSignature: null,
    lastCommandAt: 0,
    lastAckAt: 0,
    lastAck: null,
    spawned: false,
    spawnedCount: 0,
    spawnRequested: false,
    clearRequested: false,
    cleared: false,
    clearedCount: 0,
    error: null
};
let missionSceneReconnectResyncPending = false;

function _missionSceneDebugState() {
    if (!window.gaMissionSceneDebug || typeof window.gaMissionSceneDebug !== 'object') {
        window.gaMissionSceneDebug = {
            ts: Date.now(),
            aiRequested: null,
            aiNormalized: null,
            contractTargetScene: null,
            targetGeoContext: null,
            missionTruth: null,
            missionPlanV2: null,
            aptArrivalPlan: null,
            missionContext: null,
            appResolvedTargetScene: null,
            appResolvedAptArrivalScene: null,
            lastCommand: null,
            lastStartSceneCommand: null,
            lastEndSceneCommand: null,
            lastAptArrivalSceneCommand: null,
            lastTargetSceneCommand: null,
            lastSmokeCommand: null,
            lastAck: null,
            events: []
        };
    }
    if (!Array.isArray(window.gaMissionSceneDebug.events)) window.gaMissionSceneDebug.events = [];
    return window.gaMissionSceneDebug;
}

function _missionSceneDebugPush(event, payload = {}) {
    const dbg = _missionSceneDebugState();
    const entry = { ts: Date.now(), event: String(event || 'scene-debug'), payload };
    dbg.ts = entry.ts;
    dbg.events.push(entry);
    if (dbg.events.length > MISSION_SCENE_DEBUG_MAX_EVENTS) {
        dbg.events.splice(0, dbg.events.length - MISSION_SCENE_DEBUG_MAX_EVENTS);
    }
    if (typeof window.gaDebugPush === 'function') {
        try { window.gaDebugPush('debug', `[MISSION SCENE] ${entry.event}`, payload); } catch (_) {}
    }
    try { console.debug('[MISSION SCENE]', entry.event, payload); } catch (_) {}
    if (typeof window.vpRefreshWeatherDebugReport === 'function') {
        try { window.vpRefreshWeatherDebugReport(); } catch (_) {}
    }
    return entry;
}

function _missionSceneDebugPatch(patch = {}, event = 'scene-debug-update') {
    const dbg = _missionSceneDebugState();
    Object.assign(dbg, patch || {}, { ts: Date.now() });
    _missionSceneDebugPush(event, patch || {});
    if (typeof window.vpRenderMissionSceneDebugOverlay === 'function' && window.vpMissionSceneDebugOverlayEnabled) {
        try { window.vpRenderMissionSceneDebugOverlay(); } catch (_) {}
    }
    if (typeof window.vpRenderMissionSceneTargetMarker === 'function') {
        try { window.vpRenderMissionSceneTargetMarker(); } catch (_) {}
    }
    return dbg;
}

function _missionSceneDebugSummarizeItems(items = []) {
    return (Array.isArray(items) ? items : []).map((item, idx) => ({
        n: idx + 1,
        kind: String(item?.kind || ''),
        label: String(item?.label || ''),
        title: String(item?.objectTitle || item?.title || ''),
        candidates: Array.isArray(item?.titleCandidates) ? item.titleCandidates.slice(0, 5) : [],
        forwardM: Number.isFinite(Number(item?.forwardM)) ? Number(item.forwardM) : null,
        rightM: Number.isFinite(Number(item?.rightM)) ? Number(item.rightM) : null,
        hdgOffsetDeg: Number.isFinite(Number(item?.hdgOffsetDeg)) ? Number(item.hdgOffsetDeg) : 0,
        altOffsetFt: Number.isFinite(Number(item?.altOffsetFt)) ? Number(item.altOffsetFt) : 0,
        placement: item?.placement || null,
        placementOverride: !!item?.placementOverride,
        geoAnchor: item?.geoAnchor || null,
        worldAvoidance: item?.worldAvoidance || null
    }));
}

function _missionSceneOffsetToLatLon(originLat, originLon, hdgDeg, forwardM = 0, rightM = 0) {
    const lat = Number(originLat);
    const lon = Number(originLon);
    const hdg = Number(hdgDeg);
    const forward = Number(forwardM);
    const right = Number(rightM);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const rad = (Number.isFinite(hdg) ? hdg : 0) * Math.PI / 180;
    const northM = (Number.isFinite(forward) ? forward : 0) * Math.cos(rad) - (Number.isFinite(right) ? right : 0) * Math.sin(rad);
    const eastM = (Number.isFinite(forward) ? forward : 0) * Math.sin(rad) + (Number.isFinite(right) ? right : 0) * Math.cos(rad);
    const metersPerDegLat = 111320;
    const metersPerDegLon = Math.max(1, metersPerDegLat * Math.cos(lat * Math.PI / 180));
    return {
        lat: lat + (northM / metersPerDegLat),
        lon: lon + (eastM / metersPerDegLon)
    };
}

function _missionSceneDebugMapPoints(command = {}, payload = null) {
    const originLat = Number(command.lat ?? payload?.lat);
    const originLon = Number(command.lon ?? payload?.lon);
    const originAltFt = Number(command.altFt ?? payload?.alt);
    const hdg = Number(command.hdg ?? command.heading ?? payload?.hdg);
    const out = [];
    const add = (point) => {
        if (!point || !Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lon))) return;
        out.push({
            n: out.length + 1,
            sceneId: command.sceneId || command.missionId || null,
            sourceType: String(command.type || ''),
            targetSceneKind: command.targetSceneKind || null,
            kind: String(point.kind || ''),
            label: String(point.label || point.kind || ''),
            title: String(point.title || point.objectTitle || ''),
            lat: Number(point.lat),
            lon: Number(point.lon),
            altFt: Number.isFinite(Number(point.altFt)) ? Number(point.altFt) : null,
            forwardM: Number.isFinite(Number(point.forwardM)) ? Number(point.forwardM) : null,
            rightM: Number.isFinite(Number(point.rightM)) ? Number(point.rightM) : null
        });
    };

    if (Array.isArray(command.items) && Number.isFinite(originLat) && Number.isFinite(originLon)) {
        command.items.forEach((item, idx) => {
            const ll = _missionSceneOffsetToLatLon(originLat, originLon, hdg, item?.forwardM, item?.rightM);
            if (!ll) return;
            add({
                ...ll,
                kind: item?.kind || `item_${idx + 1}`,
                label: item?.label || item?.kind || `Objekt ${idx + 1}`,
                title: item?.objectTitle || item?.title || '',
                altFt: Number.isFinite(originAltFt) ? originAltFt + (Number(item?.altOffsetFt) || 0) : null,
                forwardM: item?.forwardM,
                rightM: item?.rightM,
                placement: item?.placement || null,
                geoAnchor: item?.geoAnchor || null
            });
        });
    }

    if (!out.length && command.debugPoint && Number.isFinite(originLat) && Number.isFinite(originLon)) {
        add({
            kind: command.debugPoint.kind || 'scene_point',
            label: command.debugPoint.label || 'Szenenpunkt',
            title: command.debugPoint.title || '',
            lat: originLat,
            lon: originLon,
            altFt: Number.isFinite(originAltFt) ? originAltFt : null
        });
    }

    const addSites = (sites, kind) => {
        (Array.isArray(sites) ? sites : []).forEach((site, siteIdx) => {
            const count = Math.max(1, Math.min(12, Math.round(Number(site?.count || 1) || 1)));
            for (let i = 0; i < count; i++) {
                const title = kind === 'fire' ? (command.fireObjectTitle || site?.objectTitle || 'fire') : (command.objectTitle || site?.objectTitle || 'smoke');
                add({
                    kind,
                    label: `${kind} site ${siteIdx + 1}.${i + 1}`,
                    title,
                    lat: Number(site?.lat),
                    lon: Number(site?.lon),
                    altFt: Number(site?.altFt ?? site?.alt)
                });
            }
        });
    };
    addSites(command.sites, 'smoke');
    addSites(command.fireSites, 'fire');
    return out;
}

function _missionSceneDebugCommandSummary(command = {}, commandId = null, payload = null) {
    const items = Array.isArray(command.items) ? command.items : [];
    const mapPoints = _missionSceneDebugMapPoints(command, payload);
    return {
        ts: Date.now(),
        commandId,
        type: String(command.type || ''),
        sceneId: command.sceneId || command.missionId || null,
        reason: command.reason || null,
        targetSceneKind: command.targetSceneKind || null,
        extent: command.extent || null,
        spawnMode: command.spawnMode || null,
        lat: Number.isFinite(Number(command.lat ?? payload?.lat)) ? Number(command.lat ?? payload?.lat) : null,
        lon: Number.isFinite(Number(command.lon ?? payload?.lon)) ? Number(command.lon ?? payload?.lon) : null,
        altFt: Number.isFinite(Number(command.altFt ?? payload?.alt)) ? Number(command.altFt ?? payload?.alt) : null,
        hdg: Number.isFinite(Number(command.hdg ?? command.heading ?? payload?.hdg)) ? Number(command.hdg ?? command.heading ?? payload?.hdg) : null,
        itemCount: items.length,
        items: _missionSceneDebugSummarizeItems(items),
        mapPoints,
        smokeSites: Array.isArray(command.sites) ? command.sites.length : null,
        fireSites: Array.isArray(command.fireSites) ? command.fireSites.length : null,
        objectTitle: command.objectTitle || null,
        fireObjectTitle: command.fireObjectTitle || null
    };
}

window.gaMissionSceneDebugRecordAi = function(info = {}) {
    return _missionSceneDebugPatch({
        sceneAccepted: info.sceneAccepted ?? null,
        sceneCompositionStatus: info.sceneCompositionStatus || null,
        sceneIntent: info.sceneIntent || null,
        targetGeoContext: info.targetGeoContext || info.sceneComposer?.targetGeoContext || null,
        missionTruth: info.missionTruth || info.sceneComposer?.missionTruth || null,
        missionPlanV2: info.missionPlanV2 || info.sceneComposer?.missionPlanV2 || null,
        aptArrivalPlan: info.aptArrivalPlan || info.sceneComposer?.aptArrivalPlan || null,
        sceneComposer: info.sceneComposer || null,
        aiRequested: info.aiRequested || null,
        aiNormalized: info.aiNormalized || null,
        contractTargetScene: info.contractTargetScene || null,
        missionContext: info.missionContext || null,
        appResolvedAptArrivalScene: null,
        lastAptArrivalSceneCommand: null
    }, 'ai-target-scene');
};

window.gaMissionSceneDebugGet = function() {
    return JSON.parse(JSON.stringify(_missionSceneDebugState()));
};

window.gaMissionSceneDebugClear = function() {
    window.gaMissionSceneDebug = null;
    if (typeof window.vpRenderMissionSceneDebugOverlay === 'function') {
        try { window.vpRenderMissionSceneDebugOverlay(); } catch (_) {}
    }
    return _missionSceneDebugState();
};

function _missionSceneBoardingConfig() {
    const fallback = {
        spawn: { forwardM: 16, rightM: -8, altOffsetFt: 0 },
        cargo: { forwardM: 4, rightM: 4, altOffsetFt: 0 },
        target: { forwardM: 4.5, rightM: 8.5, altOffsetFt: 0 },
        path: [
            { forwardM: 16, rightM: -8, altOffsetFt: 0 },
            { forwardM: 4, rightM: 4, altOffsetFt: 0 },
            { forwardM: 4.5, rightM: 8.5, altOffsetFt: 0 }
        ],
        waypoints: [],
        cargoIndex: 1,
        pathLabels: ['Spawn', 'Cargo', 'Boarding'],
        walkSpeedKts: 3.1,
        durationMs: 18000,
        openDoor: true,
        doorProfile: 'default',
        aircraftSlot: window.selectedAC || 'PA-24',
        aircraftName: ''
    };
    try {
        if (typeof window.getMissionSceneBoardingConfig === 'function') {
            const cfg = window.getMissionSceneBoardingConfig();
            if (cfg && typeof cfg === 'object') {
                const spawn = cfg.spawn || cfg.person || fallback.spawn;
                const cargo = cfg.cargo || fallback.cargo;
                const target = cfg.target || fallback.target;
                const path = Array.isArray(cfg.path) && cfg.path.length >= 2 ? cfg.path : [spawn, cargo, target];
                return {
                    ...fallback,
                    ...cfg,
                    spawn: { ...fallback.spawn, ...spawn },
                    cargo: { ...fallback.cargo, ...cargo },
                    target: { ...fallback.target, ...target },
                    waypoints: Array.isArray(cfg.waypoints) ? cfg.waypoints.map(point => ({ ...point })) : [],
                    path: path.map(point => ({ ...point })),
                    cargoIndex: Number.isFinite(Number(cfg.cargoIndex)) ? Number(cfg.cargoIndex) : fallback.cargoIndex,
                    pathLabels: Array.isArray(cfg.pathLabels) ? cfg.pathLabels.map(String) : fallback.pathLabels
                };
            }
        }
    } catch (_) {}
    return fallback;
}

function _normalizeFireTruthOverride(value) {
    const s = String(value || '').trim().toLowerCase();
    if (/^(fire|smoke|rauch|true|1|yes|ja)$/.test(s)) return 'fire';
    if (/^(false_alarm|falsealarm|no_smoke|kein_rauch|none|false|0|no|nein)$/.test(s)) return 'false_alarm';
    return null;
}

function _normalizeFireExtentOverride(value) {
    const s = String(value || '').trim().toLowerCase();
    if (/^(false_alarm|falsealarm|fehlalarm|0)$/.test(s)) return 'false_alarm';
    if (/^(single_smoke|single|one|1|rauch|smoke)$/.test(s)) return 'single_smoke';
    if (/^(multi_smoke|multi|two|2)$/.test(s)) return 'multi_smoke';
    if (/^(major_fire|major|three|3|fire|brand)$/.test(s)) return 'major_fire';
    return null;
}

function _normalizeFireSpawnMode(value) {
    const s = String(value || '').trim().toLowerCase();
    if (/^(prewarm|warm|aircraft|plane|near_plane)$/.test(s)) return 'prewarm';
    if (/^(target|direct|ziel|normal)$/.test(s)) return 'target';
    return null;
}

function _normalizeFireTestMode(value) {
    const s = String(value || '').trim().toLowerCase();
    if (/^(offset_ladder|ladder|hoehenleiter|height_ladder|alt_ladder)$/.test(s)) return 'offset_ladder';
    if (/^(fire_only_ladder|fire_only|fireonly|nur_feuer|feuer_only|fire_probe|probe_fire)$/.test(s)) return 'fire_only_ladder';
    if (/^(off|none|0|false)$/.test(s)) return '';
    return null;
}

function _normalizeFireObjectTitle(value) {
    const s = String(value || '').trim();
    if (!s || /^(default|auto|none|off)$/i.test(s)) return '';
    return s.length <= 96 ? s : s.slice(0, 96);
}

function _sceneTitleCandidates(title, extra = []) {
    const out = [];
    const add = (value) => {
        const s = String(value || '').trim();
        if (s && !out.includes(s)) out.push(s);
    };
    add(title);
    (Array.isArray(extra) ? extra : []).forEach(add);
    const base = String(title || '').trim();
    const paren = base.match(/\(([^)]+)\)/);
    if (paren) {
        add(paren[1]);
        add(base.replace(/\s*\([^)]+\)\s*/g, ' ').trim());
    }
    if (/termac/i.test(base)) add(base.replace(/termac/ig, 'Tarmac'));
    if (/tarmac/i.test(base)) add(base.replace(/tarmac/ig, 'Termac'));
    return out;
}

function _sceneObjectTitleOverride(key, fallback, allowedTitles = []) {
    try {
        const raw = String(localStorage.getItem(`ga_scene_${key}_title`) || '').replace(/\^+$/g, '').trim();
        const title = _normalizeFireObjectTitle(raw);
        if (title && Array.isArray(allowedTitles) && allowedTitles.length) {
            const allowed = new Set();
            allowedTitles.filter(Boolean).forEach(value => {
                _sceneTitleCandidates(value, [value]).forEach(candidate => allowed.add(candidate));
            });
            if (!allowed.has(title)) return fallback;
        }
        if (key === 'vehicle' && /^Car\s+Bush\s+Firefighting\b/i.test(title)) return MISSION_SCENE_DEFAULT_VEHICLE_TITLE;
        if (key === 'person' && /^(Ter|Tar)mac_Female_Summer_Asian$/i.test(title)) return MISSION_SCENE_DEFAULT_PERSON_TITLE;
        return title || fallback;
    } catch (_) {
        return fallback;
    }
}

function _normalizeFireNumber(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(min, Math.min(max, n));
}

function _initFireMissionDebugFromUrl() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        if (params.has('fireDebug')) {
            const raw = String(params.get('fireDebug') || '').toLowerCase();
            localStorage.setItem('ga_fire_debug', raw === '0' || raw === 'false' || raw === 'off' ? '0' : '1');
        }
        if (params.has('fireTruth')) {
            const override = _normalizeFireTruthOverride(params.get('fireTruth'));
            if (override) localStorage.setItem('ga_fire_truth_override', override);
            else localStorage.removeItem('ga_fire_truth_override');
        }
        if (params.has('fireExtent')) {
            const override = _normalizeFireExtentOverride(params.get('fireExtent'));
            if (override) localStorage.setItem('ga_fire_extent_override', override);
            else localStorage.removeItem('ga_fire_extent_override');
        }
        if (params.has('fireSpawnMode')) {
            const mode = _normalizeFireSpawnMode(params.get('fireSpawnMode'));
            if (mode) localStorage.setItem('ga_fire_spawn_mode', mode);
            else localStorage.removeItem('ga_fire_spawn_mode');
        }
        const fireObjectRaw = params.get('fireObject') ?? params.get('fireAsset') ?? params.get('fireTitle');
        if (fireObjectRaw !== null) {
            const title = _normalizeFireObjectTitle(fireObjectRaw);
            if (title) localStorage.setItem('ga_fire_object_override', title);
            else localStorage.removeItem('ga_fire_object_override');
        }
        const fireAltRaw = params.get('fireAltOffsetFt') ?? params.get('fireAltOffset') ?? params.get('fireOffsetFt') ?? params.get('fireOffset');
        if (fireAltRaw !== null) {
            const altOffsetFt = _normalizeFireNumber(fireAltRaw, -250, 250);
            if (Number.isFinite(altOffsetFt)) localStorage.setItem('ga_fire_alt_offset_ft', String(Math.round(altOffsetFt)));
            else localStorage.removeItem('ga_fire_alt_offset_ft');
        }
        if (params.has('fireCount')) {
            const count = _normalizeFireNumber(params.get('fireCount'), 1, 6);
            if (Number.isFinite(count)) localStorage.setItem('ga_fire_count', String(Math.round(count)));
            else localStorage.removeItem('ga_fire_count');
        }
        if (params.has('fireRadius')) {
            const radius = _normalizeFireNumber(params.get('fireRadius'), 0, 80);
            if (Number.isFinite(radius)) localStorage.setItem('ga_fire_radius_m', String(Math.round(radius)));
            else localStorage.removeItem('ga_fire_radius_m');
        }
        if (params.has('fireTest')) {
            const testMode = _normalizeFireTestMode(params.get('fireTest'));
            if (testMode) localStorage.setItem('ga_fire_test_mode', testMode);
            else localStorage.removeItem('ga_fire_test_mode');
        }
        if (params.has('sceneDebug')) {
            const raw = String(params.get('sceneDebug') || '').toLowerCase();
            localStorage.setItem('ga_scene_debug', raw === '0' || raw === 'false' || raw === 'off' ? '0' : '1');
        }
        if (params.has('sceneAuto')) {
            const raw = String(params.get('sceneAuto') || '').toLowerCase();
            localStorage.setItem('ga_scene_auto_spawn', raw === '0' || raw === 'false' || raw === 'off' ? '0' : '1');
        }
        const sceneVehicleRaw = params.get('sceneVehicle') ?? params.get('sceneVehicleTitle') ?? params.get('vehicleTitle');
        if (sceneVehicleRaw !== null) {
            const title = _normalizeFireObjectTitle(sceneVehicleRaw);
            if (title) localStorage.setItem('ga_scene_vehicle_title', title);
            else localStorage.removeItem('ga_scene_vehicle_title');
        }
        const scenePersonRaw = params.get('scenePerson') ?? params.get('scenePersonTitle') ?? params.get('personTitle');
        if (scenePersonRaw !== null) {
            const title = _normalizeFireObjectTitle(scenePersonRaw);
            if (title) localStorage.setItem('ga_scene_person_title', title);
            else localStorage.removeItem('ga_scene_person_title');
        }
    } catch (_) {}
}
_initFireMissionDebugFromUrl();

window.fireMissionDebugEnabled = function() {
    try { return localStorage.getItem('ga_fire_debug') === '1' || localStorage.getItem('ga_scene_debug') === '1' || !!window.fireMissionTruthOverride(); } catch (_) { return false; }
};

window.missionSceneDebugEnabled = function() {
    try { return localStorage.getItem('ga_scene_debug') === '1'; } catch (_) { return false; }
};

window.missionSceneAutoSpawnEnabled = function() {
    try { return localStorage.getItem('ga_scene_auto_spawn') === '1'; } catch (_) { return false; }
};

window.fireMissionTruthOverride = function() {
    try { return _normalizeFireTruthOverride(localStorage.getItem('ga_fire_truth_override')); } catch (_) { return null; }
};

window.fireMissionExtentOverride = function() {
    try { return _normalizeFireExtentOverride(localStorage.getItem('ga_fire_extent_override')); } catch (_) { return null; }
};

window.fireMissionSpawnMode = function() {
    try { return _normalizeFireSpawnMode(localStorage.getItem('ga_fire_spawn_mode')) || 'target'; } catch (_) { return 'target'; }
};

window.fireMissionFireOverride = function() {
    try {
        const title = _normalizeFireObjectTitle(localStorage.getItem('ga_fire_object_override'));
        const altOffsetFt = _normalizeFireNumber(localStorage.getItem('ga_fire_alt_offset_ft'), -250, 250);
        const count = _normalizeFireNumber(localStorage.getItem('ga_fire_count'), 1, 6);
        const radiusM = _normalizeFireNumber(localStorage.getItem('ga_fire_radius_m'), 0, 80);
        const testMode = _normalizeFireTestMode(localStorage.getItem('ga_fire_test_mode'));
        return {
            objectTitle: title || null,
            altOffsetFt: Number.isFinite(altOffsetFt) ? Math.round(altOffsetFt) : null,
            count: Number.isFinite(count) ? Math.round(count) : null,
            radiusM: Number.isFinite(radiusM) ? Math.round(radiusM) : null,
            testMode: testMode || null
        };
    } catch (_) {
        return {};
    }
};

window.missionRuntimeIsActive = function() {
    return !!missionRuntime.active;
};

function _missionFireContextIsFireWatch(md = null) {
    md = md || ((typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null);
    const contract = md?.missionContract || window.activeMissionContract || {};
    const pax = window.activePassenger || md?.passenger || contract?.passenger || {};
    const taskDomain = String(pax?.taskDomain || contract?.taskDomain || md?.taskDomain || '').toLowerCase();
    const profile = String(
        pax?.roleProfile ||
        contract?.roleProfile ||
        contract?.appliedProfileId ||
        contract?.requestedProfileId ||
        md?.appliedProfile ||
        md?.profile ||
        ''
    ).toLowerCase();
    if (taskDomain === 'fire_watch' || profile === 'fire_watch') return true;
    if (/(mapping|survey|photogrammetry|sightseeing|tour_guide|cargo|medical|search_and_rescue|rescue|sar)/.test(`${taskDomain} ${profile}`)) return false;
    const text = String([
        md?.mission,
        md?.poiName,
        md?.targetName,
        contract?.summary,
        contract?.missionTitle,
        contract?.missionStory,
        pax?.storyHint
    ].filter(Boolean).join(' ')).toLowerCase();
    return /(waldbrand|feuerwacht|rauchfahne|rauchentwicklung|brandherd|brandmeldung|hotspot|fire watch|smoke report)/i.test(text);
}

function _activeFireScenario() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const fs = md?.fireScenario;
    if (!(fs && typeof fs === 'object' && fs.enabled && fs.type === 'fire_watch')) return null;
    return _missionFireContextIsFireWatch(md) ? fs : null;
}

function _missionLooksLikeFireWatch() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    return _missionFireContextIsFireWatch(md);
}

function _missionSceneAcceptedForRuntime() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (!md) return false;
    if (md.sceneAccepted === false) return false;
    const status = String(md.sceneCompositionStatus || '').toLowerCase();
    if (status === 'draft' || status === 'composing') return false;
    return true;
}

function _missionSceneAutoAllowed() {
    if (!_missionSceneAcceptedForRuntime()) return false;
    const fs = _activeFireScenario();
    if (fs && fs.enabled) return true;
    if (_missionLooksLikeFireWatch()) return true;
    if (typeof _hasValidMissionForStart === 'function' && _hasValidMissionForStart()) return true;
    return (typeof window.missionSceneAutoSpawnEnabled === 'function') && window.missionSceneAutoSpawnEnabled();
}

function _scenePositionQuality(pos = {}) {
    const lat = Number(pos.lat);
    const lon = Number(pos.lon);
    const rawHasPosition = Number.isFinite(lat) && Number.isFinite(lon);
    const plausiblePosition = rawHasPosition
        && Math.abs(lat) <= 90
        && Math.abs(lon) <= 180
        && (Math.abs(lat) > 0.05 || Math.abs(lon) > 0.05);
    let depDistNm = null;
    if (plausiblePosition && typeof _distanceFromDepartureNm === 'function') {
        try { depDistNm = _distanceFromDepartureNm(lat, lon); } catch (_) { depDistNm = null; }
    }
    const nearDeparture = !Number.isFinite(depDistNm) || depDistNm <= 15;
    return { lat, lon, rawHasPosition, plausiblePosition, depDistNm, nearDeparture };
}

function _missionTrackerPauseActive(fd = {}, groundLike = false, stationary = false) {
    const pauseFlags = Number(fd?.pauseFlags || 0);
    if (pauseFlags > 0) return true;
    // Some MSFS states report IS PAUSED=true while SimConnect events say unpaused.
    // On the ground and stationary this should not block boarding/scenery staging.
    if (fd?.simPaused === true && !(groundLike && stationary)) return true;
    return false;
}

function _missionSceneFlightGate(flightData = null) {
    const fd = flightData || window.lastLiveFlightData || {};
    const pos = window.lastLiveGpsPos || {};
    const quality = _scenePositionQuality(pos);
    const hasPosition = quality.rawHasPosition && quality.plausiblePosition && quality.nearDeparture;
    const gs = Number.isFinite(Number(fd.gsKts)) ? Number(fd.gsKts)
        : (Number.isFinite(Number(fd.gs)) ? Number(fd.gs)
            : (Number.isFinite(Number(pos.gs)) ? Number(pos.gs) : 0));
    const agl = Number.isFinite(Number(fd.aglFt)) ? Math.max(0, Number(fd.aglFt)) : null;
    const hasOnGroundFlag = typeof fd.onGround === 'boolean';
    const nearGround = Number.isFinite(agl) && agl <= 80;
    const onGround = hasOnGroundFlag ? !!fd.onGround : nearGround;
    const groundLike = onGround || nearGround;
    const inMenuOrMap = !!fd.inMenuOrMap || Number(fd.simRunning) === 0 || Number(fd.dialogMode) === 1;
    const airborne = !groundLike && ((hasOnGroundFlag && !onGround && gs > 35) || (Number.isFinite(agl) && agl > 120) || gs > 70);
    const lowGround = hasOnGroundFlag
        ? onGround || !Number.isFinite(agl) || agl <= 25
        : (!Number.isFinite(agl) || agl <= 25);
    const stationary = gs < 10;
    const paused = _missionTrackerPauseActive(fd, groundLike, stationary);
    const canStage = hasPosition && groundLike && lowGround && stationary && !paused && !inMenuOrMap;
    return { ...quality, gs, agl, hasPosition, onGround, nearGround, groundLike, lowGround, stationary, paused, inMenuOrMap, airborne, canStage };
}

function _missionSceneHandleFlightTick(flightData = null, reason = 'gps-tick') {
    if (typeof window.missionSceneSpawn !== 'function' || typeof window.missionSceneClear !== 'function') return;
    const startPhase = _missionStartPhase();
    if (!missionRuntime.active && startPhase !== 'prepare' && startPhase !== 'boarding' && startPhase !== 'boarded') return;
    const sceneId = _missionSceneId();
    const status = window.missionSceneStatus || {};
    const gate = _missionSceneFlightGate(flightData);
    const hasScene = !!(status.spawned || status.spawnRequested);
    status.lastGate = gate;
    status.blockReason = '';

    if (hasScene && gate.airborne && status.autoClearedFor !== sceneId) {
        if (window.missionSceneClear('airborne-auto-clear')) {
            window.missionSceneStatus.autoClearedFor = sceneId;
        }
        return;
    }

    if (!_missionSceneAutoAllowed()) {
        status.blockReason = 'no_fire_mission';
        return;
    }
    if (!gate.rawHasPosition) {
        status.blockReason = 'no_live_position';
        return;
    }
    if (!gate.plausiblePosition) {
        status.blockReason = 'bad_live_position';
        return;
    }
    if (!gate.nearDeparture) {
        status.blockReason = `away_from_start_${Math.round(Number(gate.depDistNm || 0))}nm`;
        return;
    }
    if (gate.paused || gate.inMenuOrMap) {
        status.blockReason = 'sim_paused_or_menu';
        return;
    }
    if (!gate.groundLike) {
        status.blockReason = 'not_on_ground';
        return;
    }
    if (!gate.lowGround) {
        status.blockReason = 'agl_too_high';
        return;
    }
    if (!gate.stationary) {
        status.blockReason = 'too_fast_for_stage';
        return;
    }
    if (status.autoClearedFor === sceneId) {
        status.blockReason = 'already_airborne_cleared';
        return;
    }
    if (status.sceneId === sceneId && (status.spawned || status.spawnRequested)) {
        status.blockReason = status.spawned ? 'already_spawned' : 'spawn_pending';
        return;
    }
    if (status.lastCommand?.type === 'mission_scene_spawn' && (Date.now() - Number(status.lastCommandAt || 0)) < 12000) {
        status.blockReason = 'spawn_cooldown';
        return;
    }

    window.missionSceneSpawn(reason);
}

function _persistMissionSmokeState() {
    try {
        if (typeof saveMissionState === 'function') saveMissionState();
        else if (typeof currentMissionData !== 'undefined' && currentMissionData) {
            if (_syncMissionStateIsDraft({ currentMissionData })) return;
            localStorage.setItem('ga_active_mission', JSON.stringify({ currentMissionData }));
        }
    } catch (_) {}
}

function _defaultFireSmokeSite(fs) {
    const target = fs?.target || {};
    const smoke = fs?.smoke || {};
    const lat = Number(smoke.lat ?? target.lat);
    const lon = Number(smoke.lon ?? target.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
        siteId: 'smoke-1',
        label: 'Rauchentwicklung',
        objectTitle: smoke.objectTitle || 'Chimney_Smoke_V1',
        lat,
        lon,
        altFt: Number.isFinite(Number(smoke.altFt ?? target.altFt)) ? Number(smoke.altFt ?? target.altFt) : 0,
        hdg: Number.isFinite(Number(smoke.hdg)) ? Number(smoke.hdg) : 0,
        count: 8,
        radiusM: 35
    };
}

function _runtimeFireSiteCountForExtent(extent) {
    if (extent === 'major_fire') return 3;
    if (extent === 'multi_smoke') return 2;
    if (extent === 'single_smoke') return 1;
    return 0;
}

function _runtimeDestinationPoint(lat, lon, distNm, bearing) {
    const r = 3440.065;
    const lat1 = lat * Math.PI / 180;
    const lon1 = lon * Math.PI / 180;
    const brng = bearing * Math.PI / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distNm / r) + Math.cos(lat1) * Math.sin(distNm / r) * Math.cos(brng));
    const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(distNm / r) * Math.cos(lat1), Math.cos(distNm / r) - Math.sin(lat1) * Math.sin(lat2));
    return { lat: lat2 * 180 / Math.PI, lon: lon2 * 180 / Math.PI };
}

function _runtimeBuildFireSmokeSites(fs, extent) {
    const siteCount = _runtimeFireSiteCountForExtent(extent);
    if (!siteCount) return [];
    const target = fs?.target || {};
    const smoke = fs?.smoke || {};
    const lat = Number(smoke.lat ?? target.lat);
    const lon = Number(smoke.lon ?? target.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const altFt = Number.isFinite(Number(smoke.altFt ?? target.altFt)) ? Math.max(0, Math.round(Number(smoke.altFt ?? target.altFt))) : 0;
    const baseBearing = Number.isFinite(Number(smoke.hdg)) ? Number(smoke.hdg) : 0;
    const sites = [];
    for (let i = 0; i < siteCount; i++) {
        const bearing = (baseBearing + 55 + i * 125 + Math.random() * 55) % 360;
        const distM = i === 0 ? Math.random() * 35 : (260 + i * 170 + Math.random() * 160);
        const p = _runtimeDestinationPoint(lat, lon, distM / 1852, bearing);
        const denseMajor = extent === 'major_fire';
        sites.push({
            siteId: `smoke-${i + 1}`,
            label: siteCount === 1 ? 'Rauchentwicklung' : `Rauchentwicklung ${i + 1}`,
            objectTitle: smoke.objectTitle || 'Chimney_Smoke_V1',
            lat: Number(p.lat),
            lon: Number(p.lon),
            altFt,
            hdg: Math.round((baseBearing + i * 35) % 360),
            count: denseMajor ? 9 : 8,
            radiusM: denseMajor ? 55 : 35
        });
    }
    return sites;
}

function _runtimeBuildFireSites(smokeSites, extent, fireConfig = {}) {
    if (!Array.isArray(smokeSites) || smokeSites.length === 0) return [];
    const n = extent === 'major_fire' ? Math.min(2, smokeSites.length) : (extent === 'multi_smoke' ? 1 : 0);
    const ladderTest = fireConfig.testMode === 'offset_ladder' || fireConfig.testMode === 'fire_only_ladder';
    if (!n && !ladderTest) return [];
    const objectTitle = String(fireConfig.objectTitle || 'VO_Fire_R1_40').trim() || 'VO_Fire_R1_40';
    const altOffsetFt = Number.isFinite(Number(fireConfig.altOffsetFt)) ? Math.round(Number(fireConfig.altOffsetFt)) : 0;
    const count = Number.isFinite(Number(fireConfig.count)) ? Math.max(1, Math.min(6, Math.round(Number(fireConfig.count)))) : (extent === 'major_fire' ? 2 : 1);
    const radiusM = Number.isFinite(Number(fireConfig.radiusM)) ? Math.max(0, Math.min(80, Math.round(Number(fireConfig.radiusM)))) : (count > 1 ? 8 : 0);
    if (ladderTest) {
        const base = smokeSites[0];
        const offsets = [80, 40, 0, -40, -80, -120];
        return offsets.map((offset, idx) => {
            const sideM = (idx - (offsets.length - 1) / 2) * 55;
            const p = _runtimeDestinationPoint(Number(base.lat), Number(base.lon), Math.abs(sideM) / 1852, sideM >= 0 ? 90 : 270);
            return {
                siteId: `fire-offset-${offset}`,
                smokeSiteId: base.siteId,
                label: `Fire Offset ${offset} ft`,
                objectTitle,
                lat: Number(p.lat),
                lon: Number(p.lon),
                altFt: base.altFt,
                altOffsetFt: offset,
                hdg: base.hdg || 0,
                count: 1,
                radiusM: 0
            };
        });
    }
    return smokeSites.slice(0, n).map((site, idx) => ({
        siteId: `fire-${idx + 1}`,
        smokeSiteId: site.siteId,
        objectTitle,
        lat: site.lat,
        lon: site.lon,
        altFt: site.altFt,
        altOffsetFt,
        hdg: site.hdg || 0,
        count,
        radiusM
    }));
}

function _applyFireRuntimeOverrides(fs, { forceRebuild = false } = {}) {
    if (!fs || !fs.smoke) return;
    const fireConfig = (typeof window.fireMissionFireOverride === 'function') ? (window.fireMissionFireOverride() || {}) : {};
    const extentOverride = (typeof window.fireMissionExtentOverride === 'function') ? window.fireMissionExtentOverride() : null;
    let extent = fs.extent || 'single_smoke';
    if (fs.truth === 'fire' && extentOverride && extentOverride !== 'false_alarm') extent = extentOverride;
    const ladderTest = fireConfig.testMode === 'offset_ladder' || fireConfig.testMode === 'fire_only_ladder';
    if (fs.truth === 'fire' && ladderTest && extent !== 'multi_smoke' && extent !== 'major_fire') {
        extent = 'major_fire';
    }
    fs.extent = extent;

    const expectedSmokeSites = _runtimeFireSiteCountForExtent(extent);
    const currentSmokeSites = Array.isArray(fs.smoke.sites) ? fs.smoke.sites : [];
    const mustRebuildSmoke = forceRebuild || currentSmokeSites.length !== expectedSmokeSites || ladderTest;
    if (expectedSmokeSites > 0 && mustRebuildSmoke) {
        const rebuilt = _runtimeBuildFireSmokeSites(fs, extent);
        if (rebuilt.length > 0) {
            fs.smoke.sites = rebuilt;
            fs.smoke.count = rebuilt[0]?.count || fs.smoke.count || 0;
            fs.smoke.radiusM = rebuilt[0]?.radiusM || fs.smoke.radiusM || 0;
            fs.smokeSiteCount = rebuilt.length;
        }
    }

    if (!fs.fire || typeof fs.fire !== 'object') fs.fire = {};
    const fireSites = fs.truth === 'fire' ? _runtimeBuildFireSites(fs.smoke.sites || [], extent, fireConfig) : [];
    fs.fire.enabled = fireSites.length > 0;
    fs.fire.objectTitle = String(fireConfig.objectTitle || fs.fire.objectTitle || 'VO_Fire_R1_40').trim() || 'VO_Fire_R1_40';
    fs.fire.altOffsetFt = Number.isFinite(Number(fireConfig.altOffsetFt)) ? Math.round(Number(fireConfig.altOffsetFt)) : (Number.isFinite(Number(fs.fire.altOffsetFt)) ? Math.round(Number(fs.fire.altOffsetFt)) : 0);
    fs.fire.count = Number.isFinite(Number(fireConfig.count)) ? Math.round(Number(fireConfig.count)) : (fs.fire.count || null);
    fs.fire.radiusM = Number.isFinite(Number(fireConfig.radiusM)) ? Math.round(Number(fireConfig.radiusM)) : (fs.fire.radiusM || null);
    fs.fire.testMode = fireConfig.testMode || null;
    fs.fire.sites = fireSites;
    fs.fireSiteCount = fireSites.length;
}

function _ensureFireSmokeSites(fs) {
    if (!fs || !fs.smoke) return;
    if (!Array.isArray(fs.smoke.sites) || fs.smoke.sites.length === 0) {
        const site = _defaultFireSmokeSite(fs);
        if (!site) return;
        fs.smoke.sites = [site];
        fs.smoke.count = site.count;
        fs.smoke.radiusM = site.radiusM;
        fs.extent = fs.extent === 'false_alarm' ? 'single_smoke' : (fs.extent || 'single_smoke');
        fs.smokeSiteCount = 1;
    }
    if (!fs.fire || typeof fs.fire !== 'object') {
        fs.fire = { enabled: false, objectTitle: 'VO_Fire_R1_40', altOffsetFt: 0, sites: [] };
    }
    _applyFireRuntimeOverrides(fs);
}

window.sendTrackerCommand = function(command = {}, options = {}) {
    const ws = liveGpsSocket;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    const fs = _activeFireScenario();
    const pos = window.lastLiveGpsPos || {};
    const lat = Number.isFinite(Number(pos.lat)) ? Number(pos.lat)
        : (Number.isFinite(Number(command.lat)) ? Number(command.lat)
            : (Number.isFinite(Number(fs?.target?.lat)) ? Number(fs.target.lat) : null));
    const lon = Number.isFinite(Number(pos.lon)) ? Number(pos.lon)
        : (Number.isFinite(Number(command.lon)) ? Number(command.lon)
            : (Number.isFinite(Number(fs?.target?.lon)) ? Number(fs.target.lon) : null));
    const alt = Number.isFinite(Number(pos.alt)) ? Number(pos.alt)
        : (Number.isFinite(Number(command.altFt)) ? Number(command.altFt)
            : (Number.isFinite(Number(fs?.target?.altFt)) ? Number(fs.target.altFt) : 0));
    const hdg = Number.isFinite(Number(pos.hdg)) ? Number(pos.hdg)
        : (Number.isFinite(Number(command.hdg ?? command.heading)) ? Number(command.hdg ?? command.heading) : 0);
    const commandId = command.commandId || `cmd-${Date.now()}-${++missionSmokeCommandSeq}`;
    const payload = {
        type: 'gps',
        syncId: getSyncId(),
        pin: getSyncPin(),
        target: 'tracker',
        commandOnly: true,
        trackerCommand: {
            ...command,
            commandId,
            pin: getSyncPin()
        }
    };
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
        payload.lat = lat;
        payload.lon = lon;
        payload.alt = Math.round(Number.isFinite(alt) ? alt : 0);
        payload.hdg = Math.round(Number.isFinite(hdg) ? hdg : 0);
    }
    if (/^mission_scene_(spawn|boarding|deboarding)$/i.test(String(command.type || '')) && command.sceneId) {
        _rememberMissionSceneId(command.sceneId);
    }
    ws.send(JSON.stringify(payload));
    _trackerPendingMarkSent(command, commandId, options);
    if (/^mission_(scene|smoke)_/i.test(String(command.type || ''))) {
        const summary = _missionSceneDebugCommandSummary(command, commandId, payload);
        const patch = { lastCommand: summary };
        if (String(command.type || '') === 'mission_scene_spawn') {
            if (command.targetSceneKind) patch.lastTargetSceneCommand = summary;
            else patch.lastStartSceneCommand = summary;
        } else if (String(command.type || '') === 'mission_scene_deboarding') {
            patch.lastEndSceneCommand = summary;
        } else if (String(command.type || '') === 'mission_scene_clear') {
            if (String(command.sceneId || '').includes('-target')) patch.lastTargetSceneCommand = null;
            else patch.lastStartSceneCommand = null;
        } else if (/^mission_smoke_/i.test(String(command.type || ''))) {
            patch.lastSmokeCommand = summary;
        }
        _missionSceneDebugPatch(patch, `tracker-command:${command.type}`);
    }
    return commandId;
};

window.missionSmokeEnsureSpawned = function(reason = 'mission-active') {
    const fs = _activeFireScenario();
    if (!fs || fs.truth !== 'fire' || !fs.smoke || fs.smoke.spawned) return false;
    _ensureFireSmokeSites(fs);
    if (fs.smoke.spawnSuppressed && !String(reason || '').startsWith('debug-force')) return false;
    if (fs.smoke.spawnRequestedAt && (Date.now() - fs.smoke.spawnRequestedAt) < 15000) return false;
    const smokeSites = Array.isArray(fs.smoke.sites) ? fs.smoke.sites : [];
    const fireSites = (fs.fire?.enabled && Array.isArray(fs.fire.sites)) ? fs.fire.sites : [];
    const pos = window.lastLiveGpsPos || {};
    const spawnMode = typeof window.fireMissionSpawnMode === 'function' ? window.fireMissionSpawnMode() : 'target';
    const fireOnlyTest = fs.fire?.testMode === 'fire_only_ladder';
    const command = {
        type: 'mission_smoke_spawn',
        missionId: fs.missionId,
        reason,
        extent: fs.extent || 'single_smoke',
        spawnMode,
        prewarmLat: Number(pos.lat),
        prewarmLon: Number(pos.lon),
        prewarmAltFt: Number(pos.alt),
        prewarmHdg: Number(pos.hdg || fs.smoke.hdg || 0),
        prewarmDelayMs: 1400,
        objectTitle: fs.smoke.objectTitle || 'Chimney_Smoke_V1',
        fireObjectTitle: fs.fire?.objectTitle || 'VO_Fire_R1_40',
        sites: fireOnlyTest ? [] : smokeSites,
        fireSites
    };
    if (!fireOnlyTest) {
        command.lat = fs.smoke.lat;
        command.lon = fs.smoke.lon;
        command.altFt = fs.smoke.altFt;
        command.hdg = fs.smoke.hdg || 0;
        command.count = fs.smoke.count || 5;
        command.radiusM = fs.smoke.radiusM || 120;
    }
    const commandId = window.sendTrackerCommand(command);
    if (!commandId) return false;
    fs.smoke.spawnRequestedAt = Date.now();
    fs.smoke.spawnCommandId = commandId;
    window.missionSmokeStatus.lastCommandAt = Date.now();
    _persistMissionSmokeState();
    return true;
};

window.missionSmokeClear = function(reason = 'mission-end') {
    const fs = _activeFireScenario();
    if (!fs || !fs.smoke || (!fs.smoke.spawned && !fs.smoke.spawnRequestedAt)) return false;
    const commandId = window.sendTrackerCommand({
        type: 'mission_smoke_clear',
        missionId: fs.missionId,
        reason
    });
    if (!commandId) return false;
    if (String(reason || '').startsWith('debug-')) {
        fs.smoke.spawnSuppressed = true;
        fs.smoke.suppressedAt = Date.now();
    }
    fs.smoke.clearRequestedAt = Date.now();
    fs.smoke.clearCommandId = commandId;
    _persistMissionSmokeState();
    return true;
};

function _missionSceneId() {
    const fs = _activeFireScenario();
    const missionId = fs?.missionId || (typeof currentMissionData !== 'undefined' ? (currentMissionData?.id || currentMissionData?.missionId || currentMissionData?.t || '') : '');
    const key = missionId ? String(missionId).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) : 'active';
    return `scene-${key || 'active'}`;
}

function _missionSceneRepresentativeRoutePoint(which = 'start') {
    const wps = (typeof routeWaypoints !== 'undefined' && Array.isArray(routeWaypoints)) ? routeWaypoints : [];
    if (!wps.length) return null;
    const isEnd = which === 'end';
    const idx = isEnd ? wps.length - 1 : 0;
    const wp = wps[idx] || null;
    const lat = Number(wp?.lat);
    const lon = Number(wp?.lng ?? wp?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const neighborIdx = isEnd ? Math.max(0, idx - 1) : Math.min(wps.length - 1, idx + 1);
    const neighbor = wps[neighborIdx] || null;
    let hdg = 0;
    if (neighbor && neighbor !== wp && typeof calcNav === 'function') {
        const nLat = Number(neighbor.lat);
        const nLon = Number(neighbor.lng ?? neighbor.lon);
        if (Number.isFinite(nLat) && Number.isFinite(nLon)) {
            try {
                const nav = isEnd ? calcNav(nLat, nLon, lat, lon) : calcNav(lat, lon, nLat, nLon);
                hdg = Number(nav?.brng ?? nav?.bearing ?? 0);
            } catch (_) {}
        }
    }
    const depElev = (typeof currentDepElev !== 'undefined' && currentDepElev != null) ? currentDepElev : null;
    const destElev = (typeof currentDestElev !== 'undefined' && currentDestElev != null) ? currentDestElev : null;
    const elevFallback = isEnd ? (destElev ?? depElev) : (depElev ?? destElev);
    const altFt = Number(wp?.altFt ?? wp?.elevFt ?? wp?.elevationFt ?? elevFallback ?? 0);
    const missionPoiName = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData.poiName : '';
    const startName = (typeof currentSName !== 'undefined' && currentSName) ? currentSName : '';
    const endName = (typeof currentDName !== 'undefined' && currentDName) ? currentDName : '';
    const nameFallback = isEnd
        ? ((typeof currentDestICAO !== 'undefined' && currentDestICAO && currentDestICAO !== 'POI') ? currentDestICAO : (missionPoiName || endName || 'Ende'))
        : ((typeof currentStartICAO !== 'undefined' && currentStartICAO) ? currentStartICAO : (startName || 'Start'));
    const name = String(wp?.name || nameFallback || (isEnd ? 'Ende' : 'Start')).replace(/^🎯\s*/u, '').trim();
    return {
        lat,
        lon,
        altFt: Number.isFinite(altFt) ? Math.round(altFt) : 0,
        hdg: Number.isFinite(hdg) ? Math.round(hdg) : 0,
        name: name || (isEnd ? 'Ende' : 'Start')
    };
}

window.missionStartEndSceneDebugPreview = function(reason = 'planned-start-end-scenes') {
    const sceneBase = _missionSceneId();
    const makeCommand = (which, point) => {
        if (!point) return null;
        const isEnd = which === 'end';
        return _missionSceneDebugCommandSummary({
            type: isEnd ? 'mission_scene_end_preview' : 'mission_scene_start_preview',
            sceneId: `${sceneBase}-${which}-preview`,
            reason,
            lat: point.lat,
            lon: point.lon,
            altFt: point.altFt,
            hdg: point.hdg,
            debugPoint: {
                kind: isEnd ? 'scene_end_point' : 'scene_start_point',
                label: `${isEnd ? 'Endszene' : 'Startszene'} repr.: ${point.name}`,
                title: 'repräsentativer Routenpunkt'
            }
        }, null, null);
    };
    const start = makeCommand('start', _missionSceneRepresentativeRoutePoint('start'));
    const end = makeCommand('end', _missionSceneRepresentativeRoutePoint('end'));
    return { start, end };
};

function _missionAptArrivalPlan() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const contract = md?.missionContract || window.activeMissionContract || {};
    const truth = md?.missionTruth || contract?.missionTruth || null;
    const plan = md?.aptArrivalPlan || contract?.aptArrivalPlan || truth?.arrivalScene || null;
    if (!plan || typeof plan !== 'object') return null;
    const lat = Number(plan.lat);
    const lon = Number(plan.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const altFt = Number.isFinite(Number(plan.altFt)) ? Math.round(Number(plan.altFt)) : 0;
    const hdg = Number.isFinite(Number(plan.hdg)) ? Math.round(Number(plan.hdg)) : 0;
    return { ...plan, lat, lon, altFt, hdg };
}

function _missionAptArrivalPreviewItems(plan = {}) {
    const src = Array.isArray(plan.items) ? plan.items : [];
    return src.map((item, idx) => ({
        kind: item?.kind || `apt_arrival_item_${idx + 1}`,
        label: item?.label || item?.kind || `Arrival ${idx + 1}`,
        objectTitle: item?.objectTitle || item?.title || item?.label || '',
        titleCandidates: Array.isArray(item?.titleCandidates) ? item.titleCandidates.slice(0, 5) : [],
        role: item?.role || '',
        forwardM: Number.isFinite(Number(item?.forwardM)) ? Number(item.forwardM) : 0,
        rightM: Number.isFinite(Number(item?.rightM)) ? Number(item.rightM) : 0,
        hdgOffsetDeg: Number.isFinite(Number(item?.hdgOffsetDeg)) ? Number(item.hdgOffsetDeg) : 0,
        altOffsetFt: Number.isFinite(Number(item?.altOffsetFt)) ? Number(item.altOffsetFt) : 0
    })).filter(item => item.label || item.objectTitle || item.role);
}

function _missionAptArrivalPickupPoint(plan = null) {
    const src = plan || _missionAptArrivalPlan();
    if (!src || typeof src !== 'object') return null;
    const items = _missionAptArrivalPreviewItems(src);
    const vehicle = items.find(item => {
        const text = `${item.kind || ''} ${item.label || ''} ${item.role || ''} ${item.objectTitle || ''}`.toLowerCase();
        return text.includes('arrival_vehicle') || text.includes('vehicle') || text.includes('fahrzeug') || text.includes('van') || text.includes('shuttle');
    });
    if (!vehicle) return null;
    const ll = _missionSceneOffsetToLatLon(src.lat, src.lon, src.hdg, vehicle.forwardM, vehicle.rightM);
    return {
        forwardM: Number.isFinite(Number(vehicle.forwardM)) ? Number(vehicle.forwardM) : 0,
        rightM: Number.isFinite(Number(vehicle.rightM)) ? Number(vehicle.rightM) : 0,
        altOffsetFt: Number.isFinite(Number(vehicle.altOffsetFt)) ? Number(vehicle.altOffsetFt) : 0,
        worldLat: Number.isFinite(Number(ll?.lat)) ? Number(ll.lat) : null,
        worldLon: Number.isFinite(Number(ll?.lon)) ? Number(ll.lon) : null,
        worldAltFt: Number.isFinite(Number(src.altFt)) ? Number(src.altFt) + (Number(vehicle.altOffsetFt) || 0) : null,
        label: vehicle.label || src.visibleCue || src.expectedBy || 'Abholfahrzeug'
    };
}

function _missionAptArrivalPersonPoint(plan = null) {
    const src = plan || _missionAptArrivalPlan();
    if (!src || typeof src !== 'object') return null;
    const items = _missionAptArrivalPreviewItems(src);
    const person = items.find(item => {
        const text = `${item.kind || ''} ${item.label || ''} ${item.role || ''} ${item.objectTitle || ''}`.toLowerCase();
        return text.includes('arrival_person') || text.includes('person');
    });
    if (!person) return null;
    const ll = _missionSceneOffsetToLatLon(src.lat, src.lon, src.hdg, person.forwardM, person.rightM);
    return {
        forwardM: Number.isFinite(Number(person.forwardM)) ? Number(person.forwardM) : 0,
        rightM: Number.isFinite(Number(person.rightM)) ? Number(person.rightM) : 0,
        altOffsetFt: Number.isFinite(Number(person.altOffsetFt)) ? Number(person.altOffsetFt) : 0,
        worldLat: Number.isFinite(Number(ll?.lat)) ? Number(ll.lat) : null,
        worldLon: Number.isFinite(Number(ll?.lon)) ? Number(ll.lon) : null,
        worldAltFt: Number.isFinite(Number(src.altFt)) ? Number(src.altFt) + (Number(person.altOffsetFt) || 0) : null,
        label: person.label || src.expectedBy || 'Pickup-Gast'
    };
}
window.missionAptArrivalPickupPointForMap = function() {
    return _missionAptArrivalPickupPoint();
};

window.missionAptArrivalDebugPreview = function(reason = 'planned-apt-arrival-scene') {
    const plan = _missionAptArrivalPlan();
    if (!plan) return null;
    const label = String(plan.roleLabel || plan.role || 'APT-Ankunft').trim();
    const cue = String(plan.visibleCue || plan.expectedBy || plan.anchorType || '').trim();
    const items = _missionAptArrivalPreviewItems(plan);
    const command = _missionSceneDebugCommandSummary({
        type: 'mission_scene_apt_arrival_preview',
        sceneId: `${_missionSceneId()}-apt-arrival-preview`,
        reason,
        lat: plan.lat,
        lon: plan.lon,
        altFt: plan.altFt,
        hdg: plan.hdg,
        items,
        debugPoint: {
            kind: 'apt_arrival_plan',
            label: cue ? `${label}: ${cue}` : label,
            title: `${plan.source || 'airport-representative'} | ${plan.anchorType || 'arrival'} | confidence=${plan.confidence ?? '-'}`
        }
    }, null, null);
    return { plan, command };
};

function _missionAptArrivalSceneId() {
    return `${_missionSceneId()}-apt-arrival`;
}

function _missionAptArrivalPlanSignature(plan = {}) {
    const items = Array.isArray(plan.items) ? plan.items : [];
    return [
        String(plan.role || ''),
        Number.isFinite(Number(plan.lat)) ? Number(plan.lat).toFixed(5) : '',
        Number.isFinite(Number(plan.lon)) ? Number(plan.lon).toFixed(5) : '',
        Number.isFinite(Number(plan.altFt)) ? String(Math.round(Number(plan.altFt))) : '',
        items.map(item => `${item?.kind || ''}:${item?.role || ''}:${item?.objectTitle || item?.title || ''}`).join('|')
    ].join('::');
}

function _missionAptArrivalStatusMatchesPlan(status = {}, plan = {}, planSignature = '') {
    if (!status || typeof status !== 'object') return false;
    if (status.planSignature) return status.planSignature === planSignature;
    let compared = false;
    if (status.role && plan.role) {
        compared = true;
        if (String(status.role) !== String(plan.role)) return false;
    }
    const summary = status.lastCommandSummary || status.resolvedScene || null;
    const point = summary?.point || summary || {};
    const lat = Number(point.lat);
    const lon = Number(point.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
        compared = true;
        const dLat = Math.abs(lat - Number(plan.lat));
        const dLon = Math.abs(lon - Number(plan.lon));
        if (dLat > 0.00005 || dLon > 0.00005) return false;
    }
    return compared;
}

function _missionAptArrivalAssetForItem(item = {}, index = 0) {
    const role = String(item.role || '').trim();
    const semanticTitle = String(item.objectTitle || item.title || item.label || '').trim();
    const provided = Array.isArray(item.titleCandidates) ? item.titleCandidates : [];
    let pool = [];
    let fallback = semanticTitle || 'Cardboard';
    if (role === 'vehicle.emergency.medical') {
        pool = MISSION_SCENE_ASSET_POOLS.medicalVehicles;
        fallback = pool[0] || 'Car Bush Medic';
    } else if (role === 'vehicle.emergency.fire') {
        pool = MISSION_SCENE_ASSET_POOLS.fireVehicles;
        fallback = pool[0] || MISSION_SCENE_DEFAULT_VEHICLE_TITLE;
    } else if (role === 'vehicle.quad') {
        pool = MISSION_SCENE_ASSET_POOLS.quads;
        fallback = pool[0] || 'Microsoft_Quad';
    } else if (role === 'vehicle.van') {
        pool = MISSION_SCENE_ASSET_POOLS.vans;
        fallback = pool[0] || 'Microsoft_Van_EUR';
    } else if (role === 'vehicle.car') {
        pool = MISSION_SCENE_ASSET_POOLS.cars;
        fallback = pool[0] || 'Microsoft_Car_EUR_01';
    } else if (role === 'vehicle.truck') {
        pool = MISSION_SCENE_ASSET_POOLS.trucks;
        fallback = pool[0] || 'Truck Utility Europe Flush';
    } else if (role === 'cargo.medical_kit') {
        pool = MISSION_SCENE_ASSET_POOLS.medicalEquipment;
        fallback = 'Cardboard';
    } else if (role === 'cargo.animal_transport_box') {
        pool = MISSION_SCENE_ASSET_POOLS.animalTransportBoxes;
        fallback = semanticTitle || 'Cardboard';
    } else if (/^cargo\./.test(role)) {
        pool = MISSION_SCENE_ASSET_POOLS.cargo;
        fallback = semanticTitle || 'Cardboard';
    } else if (role === 'person.ground_crew' || /^person\./.test(role)) {
        pool = MISSION_SCENE_ASSET_POOLS.people;
        fallback = _missionScenePersonTitle(_missionScenePassengerGender(), `apt-arrival-${index}`);
    } else if (role) {
        pool = _sceneCatalogRoleTitles(role, provided);
        fallback = pool[0] || semanticTitle;
    }
    const title = _scenePickTitle(pool.length ? pool : provided, `apt-arrival-${role}-${index}`, fallback);
    return {
        title: title || fallback,
        candidates: _sceneAssetCandidates(title || fallback, provided.concat(pool, [fallback]).filter(Boolean))
    };
}

function _missionAptArrivalSceneItems(plan = {}) {
    return _missionAptArrivalPreviewItems(plan).map((item, index) => {
        const asset = _missionAptArrivalAssetForItem(item, index);
        if (!asset.title) return null;
        return {
            ...item,
            label: item.label || item.kind || `APT Arrival ${index + 1}`,
            objectTitle: asset.title,
            titleCandidates: asset.candidates,
            headingMode: 'with_aircraft',
            altOffsetFt: Math.max(
                Number.isFinite(Number(item.altOffsetFt)) ? Number(item.altOffsetFt) : 0,
                _missionSceneGroundAltOffsetForTitle(asset.title)
            )
        };
    }).filter(Boolean);
}

window.missionAptArrivalEnsureSpawned = function(reason = 'apt-arrival-prestage') {
    if (window.simModeActive || !window.liveTrackerConnected) return false;
    const plan = _missionAptArrivalPlan();
    if (!plan) return false;
    const sceneId = _missionAptArrivalSceneId();
    const status = window.missionAptArrivalSceneStatus || {};
    const planSignature = _missionAptArrivalPlanSignature(plan);
    if (status.sceneId === sceneId && (status.spawned || status.spawnRequested || status.clearRequested) && !_missionAptArrivalStatusMatchesPlan(status, plan, planSignature)) {
        if (typeof window.missionAptArrivalClear === 'function' && !status.clearRequested) window.missionAptArrivalClear('apt-arrival-plan-changed');
        return false;
    }
    if (status.sceneId === sceneId && status.clearRequested && (Date.now() - Number(status.lastCommandAt || 0)) < 15000) return false;
    if (status.sceneId === sceneId && (status.spawned || status.spawnRequested)) return false;
    if (status.sceneId === sceneId && status.lastCommand?.type === 'mission_scene_spawn' && (Date.now() - Number(status.lastCommandAt || 0)) < 15000) return false;
    const items = _missionAptArrivalSceneItems(plan);
    if (!items.length) return false;
    const appResolvedAptArrivalScene = {
        sceneId,
        reason,
        role: plan.role || '',
        roleLabel: plan.roleLabel || '',
        source: plan.source || '',
        snapStatus: plan.snapStatus || null,
        point: { lat: plan.lat, lon: plan.lon, altFt: plan.altFt, hdg: plan.hdg },
        itemCount: items.length,
        items: _missionSceneDebugSummarizeItems(items)
    };
    _missionSceneDebugPatch({ appResolvedAptArrivalScene }, 'apt-arrival-scene-resolved');
    const command = {
        type: 'mission_scene_spawn',
        sceneId,
        reason,
        targetSceneKind: 'apt_arrival',
        lat: plan.lat,
        lon: plan.lon,
        altFt: plan.altFt,
        hdg: plan.hdg,
        airportIcao: plan.icao || plan.airportIcao || '',
        airportName: plan.airportName || '',
        snapPolicy: plan.snapPolicy || null,
        snapStatus: plan.snapStatus || null,
        osmPlacement: plan.osmPlacement || null,
        placementCandidates: plan.placementCandidates || null,
        items
    };
    const commandId = window.sendTrackerCommand(command);
    if (!commandId) return false;
    const commandSummary = _missionSceneDebugCommandSummary(command, commandId, null);
    _missionSceneDebugPatch({
        lastCommand: commandSummary,
        lastAptArrivalSceneCommand: commandSummary
    }, 'apt-arrival-scene-spawn');
    window.missionAptArrivalSceneStatus = {
        ...window.missionAptArrivalSceneStatus,
        sceneId,
        role: plan.role || '',
        planSignature,
        resolvedScene: appResolvedAptArrivalScene,
        lastCommandSummary: commandSummary,
        lastCommandAt: Date.now(),
        lastCommand: { type: 'mission_scene_spawn', commandId, reason },
        spawnRequested: true,
        clearRequested: false,
        cleared: false,
        clearedCount: 0,
        spawned: false,
        spawnedCount: 0,
        error: null
    };
    if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
    return true;
};

window.missionAptArrivalClear = function(reason = 'apt-arrival-clear') {
    const ids = [...new Set([
        window.missionAptArrivalSceneStatus?.sceneId,
        _missionAptArrivalSceneId()
    ].filter(Boolean).map(String))];
    let sent = false;
    ids.forEach(sceneId => {
        const commandId = window.sendTrackerCommand({
            type: 'mission_scene_clear',
            sceneId,
            reason
        });
        if (!commandId) return;
        sent = true;
        window.missionAptArrivalSceneStatus = {
            ...window.missionAptArrivalSceneStatus,
            sceneId,
            lastCommandAt: Date.now(),
            lastCommand: { type: 'mission_scene_clear', commandId, reason },
            clearRequested: true
        };
        if (typeof window.vpRenderMissionSceneTargetMarker === 'function') {
            try { window.vpRenderMissionSceneTargetMarker(); } catch (_) {}
        }
    });
    if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
    return sent;
};

function _missionScenePaxCount() {
    const bush = _activeBushMissionSpec();
    const pickupMode = bush && bush.targetMode === 'strip_then_return' && String(bush.pickupKind || '').toLowerCase() === 'passenger';
    if (pickupMode) {
        const manifest = _missionCargoGetManifest();
        const loadedPassengerItem = manifest && Array.isArray(manifest.items)
            ? manifest.items.find(item => _missionCargoIsPassengerItem(item) && item.status === 'loaded')
            : null;
        if (loadedPassengerItem) {
            return Math.max(0, Math.min(6, Math.round(Number(loadedPassengerItem.passengerCount) || Number(bush.pickupPassengerCount) || 1)));
        }
        return 0;
    }
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const text = [
        md?.paxText,
        md?.missionContract?.paxText,
        window.activeMissionContract?.paxText,
        document.getElementById('mPay')?.innerText
    ].filter(Boolean).join(' ');
    const match = String(text || '').match(/(\d+)\s*PAX/i);
    if (match) return Math.max(0, Math.min(6, parseInt(match[1], 10) || 0));
    if (/kein\s+pax|0\s*pax|\bno\s+pax\b|^\s*-\s*$/i.test(String(text || ''))) return 0;
    return window.activePassenger ? 1 : 1;
}

function _missionSceneBoarderCount() {
    const paxCount = _missionScenePaxCount();
    if (paxCount <= 0) return 0;
    return Math.max(1, Math.min(2, paxCount));
}

function _missionSceneTaskDomain() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const fs = _activeFireScenario();
    if (fs && fs.enabled && fs.type === 'fire_watch') return 'fire_watch';
    const raw = [
        window.activePassenger?.taskDomain,
        md?.passenger?.taskDomain,
        md?.missionContract?.taskDomain,
        md?.taskDomain,
        md?.appliedProfile,
        md?.missionContract?.appliedProfileId,
        md?.missionContract?.requestedProfileId,
        md?.cat,
        md?.category
    ].filter(Boolean).join(' ').toLowerCase();
    if (/(fire_watch|fire observer|fire_observer|waldbrand|feuerwacht|rauch|brand|hotspot)/.test(raw)) return 'fire_watch';
    if (/(search_and_rescue|rescue|sar|rettung|seenot|liferaft)/.test(raw)) return 'search_and_rescue';
    if (/(medical|medic|arzt|patient|ambulance|ambulanz|organ|blut|notfall)/.test(raw)) return 'medical_transfer';
    if (/(news|media|press|presse|report|photo|foto|kamera|coverage)/.test(raw)) return 'news_coverage';
    if (/(animal|tier|veterinary|vet|wildlife)/.test(raw)) return 'animal_transport';
    if (/(cargo|freight|fracht|fragile|pallet)/.test(raw)) return 'cargo';
    if (/(mapping|photogrammetry|survey|inspection|science|bio|geo)/.test(raw)) return 'survey';
    return raw || 'general';
}

function _sceneAssetCandidates(primary, extras = []) {
    const out = [];
    const add = (value) => {
        const s = String(value || '').trim();
        if (!s || out.includes(s)) return;
        out.push(s);
        if (s.includes('_')) out.push(s.replace(/_/g, ' '));
        if (/\s/.test(s)) out.push(s.replace(/\s+/g, '_'));
    };
    add(primary);
    (Array.isArray(extras) ? extras : []).forEach(add);
    return [...new Set(out.filter(Boolean))];
}

function _missionSceneCargoText() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    return [
        md?.cargoText,
        md?.cargo,
        md?.missionContract?.cargoText,
        window.activeMissionContract?.cargoText,
        document.getElementById('mWeight')?.innerText
    ].filter(Boolean).join(' ');
}

function _missionSceneCargoWeightLbs() {
    const text = _missionSceneCargoText();
    const match = String(text || '').match(/(\d+(?:[.,]\d+)?)\s*(?:lb|lbs|pound|pfund)/i);
    if (!match) return null;
    const n = Number(String(match[1]).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

function _missionSceneCargoAsset() {
    const taskDomain = _missionSceneTaskDomain();
    const cargoText = _missionSceneCargoText().toLowerCase();
    const cargoWeightLbs = _missionSceneCargoWeightLbs();
    const palletPool = MISSION_SCENE_ASSET_POOLS.palletCargo;
    const sizePrimary = Number.isFinite(cargoWeightLbs)
        ? (cargoWeightLbs >= 120 ? 'Pallet01_01' : (cargoWeightLbs >= 50 ? 'Pallet01_02' : (cargoWeightLbs >= 20 ? 'Pallet01_03' : 'Cardboard')))
        : (/(palette|pallet|fracht|transport|material|ersatzteil|teile|equipment|ausruestung)/.test(cargoText) ? 'Pallet01_02' : 'Cardboard');
    const pool = taskDomain === 'fire_watch'
        ? MISSION_SCENE_ASSET_POOLS.fireCargo
        : (taskDomain === 'search_and_rescue'
            ? MISSION_SCENE_ASSET_POOLS.sarCargo
            : (sizePrimary.startsWith('Pallet') ? [sizePrimary, ...palletPool] : MISSION_SCENE_ASSET_POOLS.cargo));
    const preferredCargo = taskDomain === 'fire_watch' || taskDomain === 'search_and_rescue'
        ? _scenePreferredTitle(pool, 'Drop_Container', `cargo-${cargoText}-${cargoWeightLbs ?? 'n/a'}`, pool[0] || BOARDING_CARGO_FALLBACK_TITLE)
        : _scenePickTitle(pool, `cargo-${cargoText}-${cargoWeightLbs ?? 'n/a'}`, pool[0] || BOARDING_CARGO_FALLBACK_TITLE);
    const preferred = _sceneObjectTitleOverride('cargo', preferredCargo);
    return {
        title: preferred,
        candidates: _sceneAssetCandidates(preferred, pool.concat(MISSION_SCENE_ASSET_POOLS.cargo, [BOARDING_CARGO_FALLBACK_TITLE])),
        taskDomain,
        sizePrimary,
        cargoText,
        cargoWeightLbs
    };
}

function _stableHashText(text) {
    let h = 0;
    for (const ch of String(text || '')) h = ((h << 5) - h + ch.charCodeAt(0)) | 0;
    return Math.abs(h);
}

function _scenePickTitle(pool = [], salt = '', fallback = '') {
    const arr = _sceneUniqueTitles(pool, fallback).filter(Boolean);
    if (!arr.length) return String(fallback || '').trim();
    const key = `${_missionSceneId()}|${_missionSceneTaskDomain()}|${salt}|${arr.length}`;
    return arr[_stableHashText(key) % arr.length] || arr[0] || String(fallback || '').trim();
}

function _scenePreferredTitle(pool = [], preferred = '', salt = '', fallback = '') {
    const arr = _sceneUniqueTitles(pool, fallback).filter(Boolean);
    const p = String(preferred || '').trim();
    if (p && arr.includes(p)) return p;
    return _scenePickTitle(arr, salt, fallback || p || arr[0] || '');
}

const MISSION_SCENE_ANIMAL_TRANSPORT_OPTIONS = [
    { title: 'CHircusHircusFemale', label: 'Ziege', keywords: /ziege|geiss|geiß|bock|goat|hircus/i },
    { title: 'CHircusHircusJuvenile', label: 'junge Ziege', keywords: /kitz|jungziege|zicklein/i },
    { title: 'OHemionusFemale', label: 'Reh', keywords: /reh|hirsch|wildtier|deer|wild/i },
    { title: 'OHemionusJuvenile', label: 'junges Reh', keywords: /rehkitz|kitz|junges\s+reh/i },
    { title: 'Seagull', label: 'Moewe', keywords: /möwe|moewe|seagull|wildvogel|vogelstation/i },
    { title: 'Goose', label: 'Gans', keywords: /gans|goose|wasservogel/i },
    { title: 'Goose', label: 'Gans', keywords: /ente|enten|duck|mallard|schwan|swan|heimischer\s+wasservogel/i },
    { visible: false, label: 'Schaf-Transportbox', cargoLabel: 'Schaf-Transportbox', cargoTitle: 'Pallet01_03', keywords: /schaf|sheep/i },
    { visible: false, label: 'Luchs-Transportbox', cargoLabel: 'Luchs-Transportbox', cargoTitle: 'Cardboard', keywords: /luchs|lux|lynx/i },
    { visible: false, label: 'Tiertransportbox', cargoLabel: 'Tiertransportbox', cargoTitle: 'Cardboard', keywords: /hund|katze|dackel|welpe|dog|cat/i },
    { visible: false, label: 'Seeloewe-Unterlagen', cargoLabel: 'Auffangstations-Kiste', cargoTitle: 'Pallet01_03', keywords: /seelöwe|seeloewe|seal|sealion/i },
    { visible: false, label: 'Pferde-Vet-Material', cargoLabel: 'Pferde-Vet-Material', cargoTitle: 'Pallet01_03', keywords: /pferd|gestuet|gestüt|horse/i }
];

function _missionSceneAnimalTransportSpec(salt = 'animal-transport') {
    const available = new Set(MISSION_SCENE_ASSET_POOLS.animalTransportAnimals || []);
    const options = MISSION_SCENE_ANIMAL_TRANSPORT_OPTIONS.filter(opt => opt.visible === false || available.has(opt.title));
    const visibleOptions = options.filter(opt => opt.visible !== false && available.has(opt.title));
    const fallback = options.length ? options : MISSION_SCENE_ANIMAL_TRANSPORT_OPTIONS;
    const text = _missionSceneCargoText();
    const byText = fallback.find(opt => opt.keywords && opt.keywords.test(text));
    const pickPool = byText ? fallback : (visibleOptions.length ? visibleOptions : fallback);
    const picked = byText || pickPool[_stableHashText(`${_missionSceneId()}|${_missionSceneTaskDomain()}|${salt}|${text}`) % pickPool.length];
    if (picked?.visible === false) {
        const cargoTitle = picked.cargoTitle || 'Cardboard';
        return {
            visible: false,
            label: picked.label || 'Tiertransportbox',
            cargoLabel: picked.cargoLabel || picked.label || 'Tiertransportbox',
            cargoTitle,
            cargoCandidates: _sceneAssetCandidates(cargoTitle, MISSION_SCENE_ASSET_POOLS.animalTransportBoxes)
        };
    }
    const title = picked?.title || 'CHircusHircusFemale';
    return {
        visible: true,
        title,
        label: picked?.label || 'Tier',
        cargoLabel: 'Tiertransportbox',
        cargoTitle: 'Cardboard',
        cargoCandidates: _sceneAssetCandidates('Cardboard', MISSION_SCENE_ASSET_POOLS.animalTransportBoxes),
        candidates: _sceneAssetCandidates(title, MISSION_SCENE_ASSET_POOLS.animalTransportAnimals)
    };
}

function _missionSceneFilteredVehiclePool(pool = []) {
    const filtered = _sceneUniqueTitles(pool).filter(title => !/(lavatory|fuel\s*truck|truck\s+fire|firefighting|medic|military|operation|winch)/i.test(title));
    return filtered.length ? filtered : _sceneUniqueTitles(pool);
}

function _missionSceneGroundAltOffsetForTitle(title) {
    const s = String(title || '').trim();
    if (/^(Cardboard|Coffee[_\s-]?Cup)$/i.test(s)) return 1;
    return 0;
}

function _missionSceneCargoItems(cargoPoint, cargoAsset) {
    const baseForward = Number.isFinite(Number(cargoPoint?.forwardM)) ? Number(cargoPoint.forwardM) : 4;
    const baseRight = Number.isFinite(Number(cargoPoint?.rightM)) ? Number(cargoPoint.rightM) : 4;
    const baseAlt = Number.isFinite(Number(cargoPoint?.altOffsetFt)) ? Number(cargoPoint.altOffsetFt) : 0;
    const makeItem = (kind, label, title, candidates, forwardOffset = 0, rightOffset = 0) => ({
        kind,
        label,
        objectTitle: title,
        titleCandidates: candidates,
        forwardM: baseForward + forwardOffset,
        rightM: baseRight + rightOffset,
        headingMode: 'with_aircraft',
        altOffsetFt: baseAlt + _missionSceneGroundAltOffsetForTitle(title)
    });
    const manifest = _missionCargoEnsureManifest(cargoAsset);
    const manifestItems = Array.isArray(manifest?.items) ? manifest.items : [];
    if (manifestItems.length) {
        return manifestItems
            .filter(item => !_missionCargoIsPassengerItem(item))
            .map((item, index) => makeItem(
            item.sceneKind || (index === 0 ? 'cargo' : `cargo_extra_${index}`),
            item.storyName || item.label || `Ladung ${index + 1}`,
            item.objectTitle || 'Cardboard',
            _sceneAssetCandidates(item.objectTitle || 'Cardboard', item.titleCandidates || MISSION_SCENE_ASSET_POOLS.cargo),
            Number(item.forwardOffsetM || 0),
            Number(item.rightOffsetM || 0)
        ));
    }
    const primary = cargoAsset?.sizePrimary || cargoAsset?.title || 'Cardboard';
    const primaryCandidates = _sceneAssetCandidates(primary, cargoAsset?.candidates || MISSION_SCENE_ASSET_POOLS.cargo);
    return [
        makeItem('cargo', primary.startsWith('Pallet') ? 'Transportpalette' : 'Cargo Karton', primary, primaryCandidates, 0, 0)
    ];
}

function _missionCargoMissionKey() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const stableKey = String(
        md?.missionKey
        || md?.missionContract?.missionKey
        || window.activeMissionContract?.missionKey
        || ''
    ).trim();
    if (stableKey) return stableKey;
    try {
        if (typeof _missionStartUiKey === 'function') return _missionStartUiKey() || '';
    } catch (_) {}
    return [md?.start, md?.dest, md?.poiName || md?.targetName, md?.mission].filter(Boolean).join('|');
}

function _missionCargoHasActiveMission() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    return !!(md || window.activeMissionContract);
}

function _missionCargoIsPoiMission() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    return !!(md?.poiName || md?.poiSource || md?.isPOI || (typeof currentDestICAO !== 'undefined' && currentDestICAO === 'POI'));
}

function _missionCargoCleanLabel(text = '') {
    return String(text || '')
        .replace(/\([^)]*\b(?:lb|lbs|pound|pfund)\b[^)]*\)/ig, '')
        .replace(/\b\d+(?:[.,]\d+)?\s*(?:lb|lbs|pound|pfund)\b/ig, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function _missionCargoPrimaryText() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const values = [
        md?.cargoText,
        md?.cargo,
        md?.missionContract?.cargoText,
        window.activeMissionContract?.cargoText,
        document.getElementById('mWeight')?.innerText
    ];
    return String(values.find(value => String(value || '').trim()) || '').trim();
}

function _missionCargoExtractWeight(text = '', fallback = 5) {
    const match = String(text || '').match(/(\d+(?:[.,]\d+)?)\s*(?:lb|lbs|pound|pfund)/i);
    if (!match) return fallback;
    const n = Number(String(match[1]).replace(',', '.'));
    return Number.isFinite(n) ? Math.max(1, Math.round(n)) : fallback;
}

function _missionCargoSmallTitle(label = '') {
    if (/unterlagen|papier|mappe|bordbuch|akte|karten|tablet|speicher|akku|protokoll/i.test(label)) return 'Cardboard';
    if (/spanngurt|net|netz|gurt/i.test(label)) return 'Pallet01_03';
    return 'Cardboard';
}

function _missionCargoPushItem(items, item) {
    const id = String(item.id || item.label || `item-${items.length + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `item-${items.length + 1}`;
    if (items.some(existing => existing.id === id)) return;
    const sceneKind = item.sceneKind || (items.length === 0 ? 'cargo' : `cargo_extra_${items.length}`);
    const title = item.objectTitle || _missionCargoSmallTitle(item.label || item.storyName || '');
    const itemType = String(item.itemType || 'cargo').trim().toLowerCase() === 'passenger' ? 'passenger' : 'cargo';
    items.push({
        id,
        itemType,
        sceneKind,
        label: String(item.label || item.storyName || id).trim(),
        storyName: String(item.storyName || item.label || id).trim(),
        weightLbs: Math.max(1, Math.round(Number(item.weightLbs) || 1)),
        passengerCount: itemType === 'passenger' ? Math.max(1, Math.min(6, Math.round(Number(item.passengerCount) || 1))) : 0,
        required: item.required === true,
        deliverAtDestination: item.deliverAtDestination !== false,
        status: item.status || 'pending',
        healthPct: Number.isFinite(Number(item.healthPct)) ? Math.max(0, Math.min(100, Math.round(Number(item.healthPct)))) : 100,
        equipmentType: item.equipmentType || '',
        expiresAt: item.expiresAt || '',
        log: item.log && typeof item.log === 'object' ? item.log : {},
        objectTitle: title,
        titleCandidates: _sceneAssetCandidates(title, item.titleCandidates || MISSION_SCENE_ASSET_POOLS.smallCargo || MISSION_SCENE_ASSET_POOLS.cargo),
        forwardOffsetM: Number.isFinite(Number(item.forwardOffsetM)) ? Number(item.forwardOffsetM) : (items.length * 0.45),
        rightOffsetM: Number.isFinite(Number(item.rightOffsetM)) ? Number(item.rightOffsetM) : (items.length % 2 ? -0.8 : 0),
        pickupLocation: item.pickupLocation === 'target' ? 'target' : '',
        deliverAtHome: item.deliverAtHome === true
    });
}

function _missionCargoHasPassengerMission() {
    return _missionScenePaxCount() > 0;
}

function _missionCargoPassengerLabel() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const paxText = String([
        md?.paxText,
        md?.missionContract?.paxText,
        window.activeMissionContract?.paxText
    ].find(v => String(v || '').trim()) || '').trim();
    if (paxText) return paxText;
    const paxCount = _missionScenePaxCount();
    return paxCount === 1 ? '1 PAX' : `${paxCount} PAX`;
}

function _missionCargoPassengerCount() {
    return Math.max(0, Math.min(6, _missionScenePaxCount()));
}

function _missionCargoPassengerTotalWeightLbs() {
    const count = _missionCargoPassengerCount();
    if (count <= 0) return 0;
    return Math.max(1, Math.round(_missionCargoPaxWeightLbs() * count));
}

function _missionCargoIsPassengerItem(item = null) {
    return !!item && String(item.itemType || '').toLowerCase() === 'passenger';
}

function _missionCargoExpiryDate(seed = '', monthsMin = 9, monthsRange = 24) {
    const date = new Date();
    const offset = monthsMin + (_stableHashText(`${_missionCargoMissionKey()}|${seed}`) % Math.max(1, monthsRange));
    date.setMonth(date.getMonth() + offset);
    return date.toISOString().slice(0, 10);
}

function _missionCargoGenerateManifest(cargoAsset = null) {
    const key = _missionCargoMissionKey();
    const taskDomain = _missionSceneTaskDomain();
    const bush = _activeBushMissionSpec();
    const isBushPickupPassenger = !!(bush && bush.targetMode === 'strip_then_return' && String(bush.pickupKind || '').toLowerCase() === 'passenger');
    const isBushPickupCargo = !!(bush && bush.targetMode === 'strip_then_return' && String(bush.pickupKind || '').toLowerCase() === 'cargo');
    const cargoText = _missionCargoPrimaryText() || _missionSceneCargoText();
    const cleanedCargo = _missionCargoCleanLabel(cargoText);
    const hasCargo = !isBushPickupPassenger && !isBushPickupCargo && cleanedCargo && !/^(?:-|none|kein cargo|keine fracht|standard-ausruestung|standard ausruestung)$/i.test(cleanedCargo);
    const isPoi = _missionCargoIsPoiMission();
    const items = [];
    if (_missionCargoHasPassengerMission()) {
        const paxCount = _missionCargoPassengerCount();
        const primaryGender = _missionScenePassengerGender();
        const paxTitle = _missionScenePersonTitle(primaryGender, 'cargo-passenger-manifest');
        _missionCargoPushItem(items, {
            id: 'mission-passenger',
            itemType: 'passenger',
            sceneKind: 'mission_passenger',
            label: _missionCargoPassengerLabel(),
            storyName: _missionCargoPassengerLabel(),
            weightLbs: _missionCargoPassengerTotalWeightLbs(),
            passengerCount: paxCount,
            required: true,
            deliverAtDestination: true,
            objectTitle: paxTitle,
            titleCandidates: _missionScenePersonCandidates(primaryGender, paxTitle),
            forwardOffsetM: -0.4,
            rightOffsetM: -1.2
        });
    }
    if (isBushPickupPassenger) {
        const pickupCount = Math.max(1, Math.min(6, Math.round(Number(bush.pickupPassengerCount) || 1)));
        const primaryGender = _missionScenePassengerGender();
        const paxTitle = _missionScenePersonTitle(primaryGender, 'pickup-passenger-manifest');
        _missionCargoPushItem(items, {
            id: 'pickup-passenger',
            itemType: 'passenger',
            sceneKind: 'pickup_passenger',
            label: String(bush.pickupLabel || bush.pickupRole || 'Pickup Passenger').trim(),
            storyName: String(bush.pickupLabel || bush.pickupRole || 'Pickup Passenger').trim(),
            weightLbs: Math.max(1, Math.round(_missionCargoPaxWeightLbs() * pickupCount)),
            passengerCount: pickupCount,
            required: true,
            deliverAtDestination: false,
            deliverAtHome: true,
            pickupLocation: 'target',
            objectTitle: paxTitle,
            titleCandidates: _missionScenePersonCandidates(primaryGender, paxTitle),
            forwardOffsetM: -0.2,
            rightOffsetM: 1.1
        });
    }
    if (isBushPickupCargo) {
        const pickupLabel = String(bush.pickupLabel || cleanedCargo || 'Rueckholfracht').trim();
        _missionCargoPushItem(items, {
            id: 'pickup-cargo',
            itemType: 'cargo',
            sceneKind: 'cargo.small_box',
            label: pickupLabel,
            storyName: pickupLabel,
            weightLbs: _missionCargoExtractWeight(pickupLabel, 42),
            required: true,
            deliverAtDestination: false,
            deliverAtHome: true,
            pickupLocation: 'target',
            objectTitle: 'Cardboard',
            titleCandidates: MISSION_SCENE_ASSET_POOLS.cargo,
            forwardOffsetM: 0.2,
            rightOffsetM: 1.0
        });
    }
    if (hasCargo) {
        let primaryTitle = cargoAsset?.title || cargoAsset?.sizePrimary || 'Cardboard';
        let primaryCandidates = cargoAsset?.candidates || MISSION_SCENE_ASSET_POOLS.cargo;
        let primaryLabel = cleanedCargo || 'Missionsladung';
        if (taskDomain === 'fire_watch') {
            primaryTitle = _scenePreferredTitle(MISSION_SCENE_ASSET_POOLS.fireCargo, 'Drop_Container', 'fire-cargo-primary', 'Drop_Container');
            primaryCandidates = MISSION_SCENE_ASSET_POOLS.fireCargo;
            primaryLabel = cleanedCargo || 'Einsatzladung';
        } else if (taskDomain === 'search_and_rescue') {
            primaryTitle = _scenePreferredTitle(MISSION_SCENE_ASSET_POOLS.sarCargo, 'Drop_Container', 'sar-cargo-primary', 'Drop_Container');
            primaryCandidates = MISSION_SCENE_ASSET_POOLS.sarCargo;
            primaryLabel = cleanedCargo || 'SAR Ausruestung';
        } else if (taskDomain === 'medical_transfer') {
            primaryTitle = _scenePreferredTitle(MISSION_SCENE_ASSET_POOLS.medicalEquipment, 'Cardboard', 'medical-cargo-primary', 'Cardboard');
            primaryCandidates = MISSION_SCENE_ASSET_POOLS.medicalEquipment;
            primaryLabel = cleanedCargo || 'Medizinische Transportkiste';
        } else if (taskDomain === 'animal_transport') {
            const animal = _missionSceneAnimalTransportSpec('animal-cargo-primary');
            primaryTitle = animal.cargoTitle || 'Cardboard';
            primaryCandidates = animal.cargoCandidates || MISSION_SCENE_ASSET_POOLS.animalTransportBoxes;
            primaryLabel = animal.cargoLabel || cleanedCargo || 'Tiertransportbox';
        }
        _missionCargoPushItem(items, {
            id: 'primary-cargo',
            sceneKind: 'cargo',
            label: primaryLabel,
            storyName: primaryLabel,
            weightLbs: _missionCargoExtractWeight(cargoText, cargoAsset?.cargoWeightLbs || 20),
            required: true,
            deliverAtDestination: !isPoi,
            objectTitle: primaryTitle,
            titleCandidates: primaryCandidates,
            forwardOffsetM: 0,
            rightOffsetM: 0
        });
    }

    _missionCargoPushItem(items, { id: 'bordbuch', label: 'Bordbuch / Dispatch-Mappe', weightLbs: 3, required: false, deliverAtDestination: false, forwardOffsetM: 0.35, rightOffsetM: -0.75 });
    _missionCargoPushItem(items, { id: 'first-aid', label: 'Verbandzeug', weightLbs: 2, required: false, deliverAtDestination: false, equipmentType: 'expiry', expiresAt: _missionCargoExpiryDate('first-aid', 6, 18), forwardOffsetM: 0.65, rightOffsetM: -0.55 });
    _missionCargoPushItem(items, { id: 'fire-extinguisher', label: 'Feuerloescher', weightLbs: 5, required: false, deliverAtDestination: false, equipmentType: 'expiry', expiresAt: _missionCargoExpiryDate('fire-extinguisher', 4, 20), forwardOffsetM: 0.95, rightOffsetM: 0.55 });
    _missionCargoPushItem(items, { id: 'chocks', label: 'Chocks / Radkeile', weightLbs: 6, required: false, deliverAtDestination: false, equipmentType: 'ground', forwardOffsetM: 1.25, rightOffsetM: -0.25 });
    if (/(cargo|freight|fracht|animal_transport)/.test(taskDomain) && !isBushPickupCargo) {
        _missionCargoPushItem(items, { id: 'cargo-docs', label: 'Frachtpapiere und Uebergabeunterlagen', weightLbs: 4, required: true, deliverAtDestination: !isPoi, forwardOffsetM: 0.75, rightOffsetM: 0.8 });
        _missionCargoPushItem(items, { id: 'tie-downs', label: 'Spanngurte / Ladungsnetz', weightLbs: 8, required: false, deliverAtDestination: false, forwardOffsetM: 1.1, rightOffsetM: -0.9, objectTitle: 'Pallet01_03', titleCandidates: MISSION_SCENE_ASSET_POOLS.palletCargo });
    }
    if (/(news_coverage|media|photo)/.test(taskDomain)) {
        _missionCargoPushItem(items, { id: 'media-batteries', label: 'Akkukoffer und Speicherkarten', weightLbs: 9, required: false, deliverAtDestination: false, forwardOffsetM: 0.85, rightOffsetM: 0.9 });
    }
    if (/(survey|inspection|science|mapping)/.test(taskDomain)) {
        _missionCargoPushItem(items, { id: 'survey-docs', label: 'Messprotokolle und Referenzkarten', weightLbs: 5, required: false, deliverAtDestination: false, forwardOffsetM: 0.8, rightOffsetM: 0.85 });
    }
    if (taskDomain === 'medical_transfer') {
        _missionCargoPushItem(items, { id: 'patient-docs', label: 'Patientenakte / Kuehlhinweis', weightLbs: 3, required: true, deliverAtDestination: !isPoi, forwardOffsetM: 0.75, rightOffsetM: 0.85 });
    }
    if (!items.length) {
        _missionCargoPushItem(items, { id: 'bordbuch', label: 'Bordbuch / Dispatch-Mappe', weightLbs: 3, required: false, deliverAtDestination: false });
    }
    return {
        version: 1,
        key,
        taskDomain,
        isPoi,
        createdAt: Date.now(),
        items
    };
}

function _missionCargoGetManifest() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (md?.cargoManifest && typeof md.cargoManifest === 'object') return md.cargoManifest;
    if (md?.missionContract?.cargoManifest && typeof md.missionContract.cargoManifest === 'object') return md.missionContract.cargoManifest;
    if (window.activeMissionContract?.cargoManifest && typeof window.activeMissionContract.cargoManifest === 'object') return window.activeMissionContract.cargoManifest;
    return null;
}

function _missionCargoPersistManifest(manifest) {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (md && typeof md === 'object') {
        md.cargoManifest = manifest;
        if (md.missionContract && typeof md.missionContract === 'object') md.missionContract.cargoManifest = manifest;
    }
    if (window.activeMissionContract && typeof window.activeMissionContract === 'object') {
        window.activeMissionContract.cargoManifest = manifest;
    }
    try {
        window.dispatchEvent(new CustomEvent('missioncargochange', { detail: { manifest } }));
    } catch (_) {}
    try {
        if (typeof window.debouncedSaveMissionState === 'function') window.debouncedSaveMissionState();
        else if (typeof saveMissionState === 'function') saveMissionState();
    } catch (_) {}
    return manifest;
}

function _missionCargoEnsureUiSyncHook() {
    if (missionCargoUiSyncHooked) return;
    missionCargoUiSyncHooked = true;
    window.addEventListener('missioncargochange', () => {
        const overlay = document.getElementById('missionCargoOverlay');
        if (!overlay || overlay.style.display !== 'flex') return;
        const mode = window.missionCargoStatus?.lastMode === 'unload'
            ? 'unload'
            : (window.missionCargoStatus?.lastMode === 'pickup' ? 'pickup' : 'load');
        _missionCargoRenderDialog(mode, { skipPayloadRefresh: true });
    });
}

function _missionCargoEnsureManifest(cargoAsset = null) {
    const key = _missionCargoMissionKey();
    let manifest = _missionCargoGetManifest();
    if (!manifest || manifest.key !== key || !Array.isArray(manifest.items) || !manifest.items.length) {
        manifest = _missionCargoGenerateManifest(cargoAsset || _missionSceneCargoAsset());
        _missionCargoPersistManifest(manifest);
    }
    window.missionCargoStatus.manifestKey = manifest.key || key;
    _missionCargoResetPayloadPlanForMissionKey(manifest.key || key);
    return manifest;
}

function _missionCargoPilotId() {
    try {
        if (typeof getSyncId === 'function') {
            const id = String(getSyncId() || '').trim();
            if (id) return id;
        }
    } catch (_) {}
    try {
        const id = String(localStorage.getItem('ga_sync_id') || '').trim();
        if (id) return id;
    } catch (_) {}
    return 'UNBEKANNT';
}

function _missionCargoAircraftLabel() {
    const slot = String(window.selectedAC || window.activeAircraftPresetSettingsSlot || 'N/A').trim() || 'N/A';
    let presetName = '';
    try {
        const presets = JSON.parse(localStorage.getItem('ga_aircraft_presets_v1') || '{}') || {};
        const rawName = presets?.[slot]?.name;
        if (rawName != null) presetName = String(rawName).trim();
    } catch (_) {}
    if (presetName && presetName !== slot) return `${slot} · ${presetName}`;
    return slot;
}

function _missionCargoFormatDate(ts = Date.now()) {
    const d = new Date(Number(ts) || Date.now());
    return d.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function _missionCargoInvalidateDispatchSignature(manifest) {
    if (!manifest || !manifest.dispatchSignature) return false;
    manifest.dispatchSignature = null;
    return true;
}

function _missionCargoClearSignatureAnimation() {
    if (window.missionCargoStatus?.signatureAnimationTimer) {
        clearTimeout(window.missionCargoStatus.signatureAnimationTimer);
        window.missionCargoStatus.signatureAnimationTimer = 0;
    }
    if (window.missionCargoStatus) window.missionCargoStatus.signatureAnimationEndsAt = 0;
}

function _missionCargoStartSignatureAnimation(options = {}) {
    const durationMs = Math.max(300, Number(options.durationMs) || 1600);
    _missionCargoClearSignatureAnimation();
    if (!window.missionCargoStatus) return;
    window.missionCargoStatus.signatureAnimationEndsAt = Date.now() + durationMs;
    window.missionCargoStatus.signatureAnimationTimer = window.setTimeout(() => {
        if (window.missionCargoStatus) {
            window.missionCargoStatus.signatureAnimationTimer = 0;
            window.missionCargoStatus.signatureAnimationEndsAt = 0;
        }
        if (options.render !== false && document.getElementById('missionCargoOverlay')?.style.display === 'flex') {
            _missionCargoRenderDialog('load', { skipPayloadRefresh: true });
        }
    }, durationMs + 40);
}

window.missionCargoSignDispatchList = function(options = {}) {
    const manifest = _missionCargoEnsureManifest();
    manifest.dispatchSignature = {
        by: _missionCargoPilotId(),
        at: Date.now(),
        aircraft: _missionCargoAircraftLabel(),
        note: String(options?.note || '').trim()
    };
    _missionCargoPersistManifest(manifest);
    if (options.animate !== false) _missionCargoStartSignatureAnimation({ render: options.render !== false });
    if (options.render !== false) _missionCargoRenderDialog('load', { skipPayloadRefresh: true });
    return true;
};

window.missionCargoClearDispatchSignature = function(options = {}) {
    const manifest = _missionCargoEnsureManifest();
    if (!manifest.dispatchSignature) return false;
    _missionCargoClearSignatureAnimation();
    manifest.dispatchSignature = null;
    _missionCargoPersistManifest(manifest);
    if (options.render !== false) _missionCargoRenderDialog('load', { skipPayloadRefresh: true });
    return true;
};

window.missionCargoToggleDispatchSignature = function(options = {}) {
    const manifest = _missionCargoEnsureManifest();
    if (manifest.dispatchSignature) return window.missionCargoClearDispatchSignature(options);
    return window.missionCargoSignDispatchList(options);
};

function _missionCargoSceneId() {
    return window.missionSceneStatus?.sceneId || _missionSceneId();
}

function _missionCargoUnloadSceneId() {
    return `${_missionSceneId()}-cargo-unload`;
}

function _missionCargoLivePos() {
    const pos = window.lastLiveGpsPos || {};
    const lat = Number(pos.lat);
    const lon = Number(pos.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
        lat,
        lon,
        altFt: Number.isFinite(Number(pos.alt)) ? Number(pos.alt) : 0,
        hdg: Number.isFinite(Number(pos.hdg)) ? Number(pos.hdg) : 0
    };
}

function _missionCargoCommandBasePos() {
    const livePos = _missionCargoLivePos();
    if (livePos) return livePos;
    const gate = window.missionSceneStatus?.lastGate || {};
    const lat = Number(gate.lat);
    const lon = Number(gate.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const pos = window.lastLiveGpsPos || {};
    return {
        lat,
        lon,
        altFt: Number.isFinite(Number(pos.alt)) ? Number(pos.alt) : 0,
        hdg: Number.isFinite(Number(pos.hdg)) ? Number(pos.hdg) : 0
    };
}

function _missionCargoDistanceToUnloadM(item, livePos = null) {
    const unloadLat = Number(item?.unloadLat);
    const unloadLon = Number(item?.unloadLon);
    if (!Number.isFinite(unloadLat) || !Number.isFinite(unloadLon)) return null;
    const pos = livePos || _missionCargoLivePos();
    if (!pos) return null;
    return _haversineNmLocal(pos.lat, pos.lon, unloadLat, unloadLon) * 1852;
}

function _missionCargoCanReloadUnloadedItem(item, maxDistanceM = MISSION_CARGO_RELOAD_MAX_DISTANCE_M) {
    if (!item || item.status !== 'unloaded') return true;
    if (!window.liveTrackerConnected) return true;
    const unloadLat = Number(item.unloadLat);
    const unloadLon = Number(item.unloadLon);
    if (!Number.isFinite(unloadLat) || !Number.isFinite(unloadLon)) return true;
    const dM = _missionCargoDistanceToUnloadM(item);
    return Number.isFinite(dM) && dM <= Number(maxDistanceM || MISSION_CARGO_RELOAD_MAX_DISTANCE_M);
}

function _missionCargoFindItem(itemId) {
    const manifest = _missionCargoEnsureManifest();
    return manifest.items.find(item => item.id === itemId) || null;
}

function _missionCargoItemForwardM(item = null) {
    if (!item || typeof item !== 'object') return 0;
    if (Number.isFinite(Number(item.forwardM))) return Number(item.forwardM);
    if (Number.isFinite(Number(item.forwardOffsetM))) return Number(item.forwardOffsetM);
    return 0;
}

function _missionCargoItemRightM(item = null) {
    if (!item || typeof item !== 'object') return 0;
    if (Number.isFinite(Number(item.rightM))) return Number(item.rightM);
    if (Number.isFinite(Number(item.rightOffsetM))) return Number(item.rightOffsetM);
    return 0;
}

function _missionCargoGroundSpawnPlacement(item = null) {
    const cfg = _missionSceneBoardingConfig();
    const cargo = cfg?.cargo || { forwardM: 4, rightM: 4, altOffsetFt: 0 };
    const cargoForward = Number.isFinite(Number(cargo.forwardM)) ? Number(cargo.forwardM) : 4;
    const cargoRight = Number.isFinite(Number(cargo.rightM)) ? Number(cargo.rightM) : 4;
    const cargoAlt = Number.isFinite(Number(cargo.altOffsetFt)) ? Number(cargo.altOffsetFt) : 0;
    const itemAlt = Number.isFinite(Number(item?.altOffsetFt)) ? Number(item.altOffsetFt) : 0;
    return {
        forwardM: cargoForward + _missionCargoItemForwardM(item),
        rightM: cargoRight + _missionCargoItemRightM(item),
        altOffsetFt: cargoAlt + itemAlt
    };
}

function _missionCargoPassengerSpawnPlacement(item = null) {
    const cfg = _missionSceneBoardingConfig();
    const target = cfg?.target || { forwardM: 4.5, rightM: 8.5, altOffsetFt: 0 };
    const targetForward = Number.isFinite(Number(target.forwardM)) ? Number(target.forwardM) : 4.5;
    const targetRight = Number.isFinite(Number(target.rightM)) ? Number(target.rightM) : 8.5;
    const targetAlt = Number.isFinite(Number(target.altOffsetFt)) ? Number(target.altOffsetFt) : 0;
    const itemAlt = Number.isFinite(Number(item?.altOffsetFt)) ? Number(item.altOffsetFt) : 0;
    return {
        forwardM: targetForward + _missionCargoItemForwardM(item),
        rightM: targetRight + _missionCargoItemRightM(item),
        altOffsetFt: targetAlt + itemAlt
    };
}

function _missionCargoLoadedItems(manifest = _missionCargoEnsureManifest()) {
    return (manifest.items || []).filter(item => item.status === 'loaded' || item.status === 'unloaded');
}

function _missionCargoItemCanLoadAtCurrentStage(item = null) {
    if (!item || typeof item !== 'object') return false;
    if (item.pickupLocation === 'target') return _missionBushPickupAtTargetNow();
    return true;
}

function _missionCargoItemNeedsUnloadHere(item = null) {
    if (!item || typeof item !== 'object') return false;
    if (item.deliverAtHome === true) {
        const pos = window.lastLiveGpsPos || {};
        const lat = Number(pos.lat);
        const lon = Number(pos.lon);
        return Number.isFinite(lat) && Number.isFinite(lon) && _isAtMissionHome(lat, lon);
    }
    return item.deliverAtDestination !== false;
}

function _missionCargoLoadedPassengerItems(manifest = _missionCargoEnsureManifest()) {
    return (manifest.items || []).filter(item => _missionCargoIsPassengerItem(item) && item.status === 'loaded');
}

function _missionCargoPassengerUnloadedItems(manifest = _missionCargoEnsureManifest()) {
    return (manifest.items || []).filter(item => _missionCargoIsPassengerItem(item) && item.status === 'unloaded');
}

function _lbsFromKg(kg) {
    const n = Number(kg);
    if (!Number.isFinite(n)) return null;
    return n * 2.2046226218;
}

function _missionCargoParseWeightFromText(text = '') {
    const raw = String(text || '');
    const match = raw.match(/(\d+(?:[.,]\d+)?)\s*(kg|kgs|kilogramm?|lb|lbs|pounds?|pfund)/i);
    if (!match) return null;
    const value = Number(String(match[1]).replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return null;
    const unit = String(match[2] || '').toLowerCase();
    if (unit.startsWith('k')) return _lbsFromKg(value);
    return value;
}

function _missionCargoPaxWeightLbs() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const pax = window.activePassenger || md?.passenger || md?.missionContract?.passenger || window.activeMissionContract?.passenger || {};
    const directLbs = [pax?.weightLbs, pax?.weightLb, pax?.massLbs, pax?.weight]
        .map(v => Number(v))
        .find(v => Number.isFinite(v) && v > 20);
    if (Number.isFinite(directLbs)) return Math.round(directLbs);
    const directKg = [pax?.weightKg, pax?.massKg]
        .map(v => Number(v))
        .find(v => Number.isFinite(v) && v > 10);
    if (Number.isFinite(directKg)) return Math.round(_lbsFromKg(directKg));
    const text = [
        pax?.weightText,
        pax?.notes,
        md?.paxText,
        md?.missionContract?.paxText,
        window.activeMissionContract?.paxText,
        document.getElementById('mPay')?.innerText
    ].filter(Boolean).join(' ');
    const parsed = _missionCargoParseWeightFromText(text);
    return Number.isFinite(parsed) ? Math.round(parsed) : 180;
}

function _missionCargoBoardedPaxCount() {
    const manifest = _missionCargoGetManifest();
    const loadedPassengerItem = manifest && Array.isArray(manifest.items)
        ? manifest.items.find(item => _missionCargoIsPassengerItem(item) && item.status === 'loaded')
        : null;
    if (loadedPassengerItem) return Math.max(0, Math.min(6, Math.round(Number(loadedPassengerItem.passengerCount) || 1)));
    const paxCount = Math.max(0, Math.min(2, _missionScenePaxCount()));
    if (paxCount <= 0) return 0;
    if (window.missionSceneStatus?.personBoarded) return 1;
    try {
        if (_missionStartPhase() === 'boarded') return 1;
    } catch (_) {}
    return 0;
}

function _missionCargoResetPayloadPlanForMissionKey(manifestKey = '') {
    if (window.missionCargoStatus.payloadMissionKey === manifestKey) return;
    window.missionCargoStatus.payloadMissionKey = manifestKey;
    window.missionCargoStatus.payloadBaseline = null;
    window.missionCargoStatus.payloadLayout = null;
    window.missionCargoStatus.payloadPlan = null;
    window.missionCargoStatus.payloadSyncQueued = '';
    window.missionCargoStatus.payloadPendingResetStations = null;
    window.missionCargoStatus.payloadPendingResetMaxStations = 0;
    if (manifestKey) window.missionCargoStatus.payloadNeedsSync = false;
}

function _missionCargoNormalizePayloadSnapshot(snapshot = null) {
    const raw = snapshot && typeof snapshot === 'object' ? snapshot : null;
    if (!raw) return null;
    const rawCount = (raw.payloadStationCount ?? raw.sampledStationCount ?? (Array.isArray(raw.stations) ? raw.stations.length : 0));
    const stationCount = Math.max(1, Math.min(15, Math.round(Number(rawCount || 0))));
    if (!Number.isFinite(stationCount) || stationCount < 1) return null;
    const byIndex = new Map();
    const inputStations = Array.isArray(raw.stations) ? raw.stations : [];
    inputStations.forEach((row) => {
        const idx = Math.round(Number(row?.index));
        const w = Number(row?.weightLbs);
        if (!Number.isFinite(idx) || idx < 1 || idx > stationCount) return;
        byIndex.set(idx, Number.isFinite(w) ? Math.max(0, w) : 0);
    });
    const stations = [];
    for (let i = 1; i <= stationCount; i += 1) {
        stations.push({ index: i, weightLbs: Math.round((Number(byIndex.get(i) || 0)) * 10) / 10 });
    }
    return {
        totalWeightLbs: Number.isFinite(Number(raw.totalWeightLbs)) ? Number(raw.totalWeightLbs) : null,
        emptyWeightLbs: Number.isFinite(Number(raw.emptyWeightLbs)) ? Number(raw.emptyWeightLbs) : null,
        fuelWeightLbs: Number.isFinite(Number(raw.fuelWeightLbs ?? window.lastLiveFlightData?.fuelWeightLbs)) ? Number(raw.fuelWeightLbs ?? window.lastLiveFlightData?.fuelWeightLbs) : null,
        payloadWeightLbs: Number.isFinite(Number(raw.payloadWeightLbs)) ? Number(raw.payloadWeightLbs) : null,
        payloadStationCount: stationCount,
        sampledStationCount: Math.max(stationCount, Math.min(15, Math.round(Number(raw.sampledStationCount || stationCount)))),
        stations
    };
}

function _missionCargoBuildPayloadLayout(snapshot = null) {
    const count = Math.max(1, Math.min(15, Math.round(Number(snapshot?.payloadStationCount ?? 1) || 1)));
    const allIndices = Array.from({ length: count }, (_, idx) => idx + 1);
    const pilotIndex = 1;
    const copilotIndex = count >= 2 ? 2 : 1;
    const rearSeatIndices = count >= 4 ? [3, 4] : (count === 3 ? [3] : []);
    const cargoIndices = count >= 5 ? allIndices.slice(4) : [];
    return { count, allIndices, pilotIndex, copilotIndex, rearSeatIndices, cargoIndices };
}

function _missionCargoItemIsBulky(item) {
    const weight = Number(item?.weightLbs || 0);
    const text = String(`${item?.label || ''} ${item?.storyName || ''} ${item?.objectTitle || ''}`).toLowerCase();
    if (weight >= 35) return true;
    return /(palette|pallet|kiste|sperrig|gross|box|netz|gurt|container|transport)/i.test(text);
}

function _missionCargoAllocateWeightToStations(map, stationIndices = [], totalWeightLbs = 0, splitAcross = 1) {
    const weight = Math.max(0, Number(totalWeightLbs) || 0);
    const slots = [...new Set((Array.isArray(stationIndices) ? stationIndices : [])
        .map(v => Math.round(Number(v)))
        .filter(v => Number.isFinite(v) && v >= 1))];
    if (!weight || !slots.length) return [];
    const split = Math.max(1, Math.min(slots.length, Math.round(Number(splitAcross) || 1)));
    const chosen = slots.slice(0, split);
    const unit = weight / chosen.length;
    chosen.forEach((idx) => {
        map.set(idx, (Number(map.get(idx) || 0) + unit));
    });
    return chosen;
}

function _missionCargoBuildMissionExtraPlan(manifest, layout) {
    const missionByStation = new Map();
    const assignments = [];
    const passengerItems = (manifest?.items || []).filter(item => _missionCargoIsPassengerItem(item) && item.status === 'loaded');
    let paxTotalLbs = passengerItems.reduce((sum, item) => sum + Math.max(0, Number(item.weightLbs || 0)), 0);
    let paxCount = passengerItems.reduce((sum, item) => sum + Math.max(0, Math.round(Number(item.passengerCount) || 1)), 0);
    if (paxTotalLbs <= 0) {
        const fallbackCount = _missionCargoBoardedPaxCount();
        if (fallbackCount > 0) {
            paxCount = fallbackCount;
            paxTotalLbs = fallbackCount * _missionCargoPaxWeightLbs();
        }
    }
    if (paxTotalLbs > 0) {
        _missionCargoAllocateWeightToStations(missionByStation, [layout.copilotIndex].concat(layout.rearSeatIndices), paxTotalLbs, Math.max(1, Math.min(1 + layout.rearSeatIndices.length, paxCount || 1)));
        assignments.push({ type: 'pax', label: paxCount > 1 ? `${paxCount} Passagiere` : 'Passagier', weightLbs: Math.round(paxTotalLbs), stations: [layout.copilotIndex].concat(layout.rearSeatIndices).slice(0, Math.max(1, Math.min(1 + layout.rearSeatIndices.length, paxCount || 1))) });
    }

    const loadedItems = (manifest?.items || []).filter(item => item.status === 'loaded' && !_missionCargoIsPassengerItem(item));
    const allNonPilotIndices = layout.allIndices.filter(idx => idx !== layout.pilotIndex);
    const cargoPrimary = layout.cargoIndices.length ? layout.cargoIndices : (layout.rearSeatIndices.length ? layout.rearSeatIndices : allNonPilotIndices);
    const nonCopilotCargo = cargoPrimary.filter(idx => idx !== layout.copilotIndex);
    const cargoFallback = nonCopilotCargo.length ? nonCopilotCargo : cargoPrimary;
    loadedItems.forEach((item) => {
        const itemWeight = Math.max(0, Number(item?.weightLbs || 0));
        if (!itemWeight) return;
        const bulky = _missionCargoItemIsBulky(item);
        const prefersRear = bulky && layout.rearSeatIndices.length > 0;
        const candidateSlots = prefersRear
            ? layout.rearSeatIndices
            : (cargoFallback.length ? cargoFallback : allNonPilotIndices);
        const splitAcross = (prefersRear && candidateSlots.length >= 2) ? 2 : 1;
        const usedStations = _missionCargoAllocateWeightToStations(missionByStation, candidateSlots, itemWeight, splitAcross);
        assignments.push({
            type: 'cargo',
            itemId: item.id,
            label: item.storyName || item.label || item.id || 'Cargo',
            weightLbs: Math.round(itemWeight),
            bulky,
            stations: usedStations
        });
    });
    return {
        missionByStation,
        assignments,
        loadedItems,
        paxCount,
        paxTotalLbs
    };
}

function _missionCargoBuildPlanFromManifest(manifest, baseline) {
    const snapshot = _missionCargoNormalizePayloadSnapshot(baseline);
    if (!snapshot) return null;
    const layout = _missionCargoBuildPayloadLayout(snapshot);
    const missionPlan = _missionCargoBuildMissionExtraPlan(manifest, layout);
    const missionByStation = missionPlan.missionByStation;
    const assignments = missionPlan.assignments;
    const loadedItems = missionPlan.loadedItems;

    const stations = snapshot.stations.map((row) => {
        const missionExtra = Number(missionByStation.get(row.index) || 0);
        const baselineWeight = Number(row.weightLbs || 0);
        const targetWeight = Math.max(0, baselineWeight + missionExtra);
        return {
            index: row.index,
            baselineWeightLbs: Math.round(baselineWeight * 10) / 10,
            missionExtraLbs: Math.round(missionExtra * 10) / 10,
            weightLbs: Math.round(targetWeight * 10) / 10
        };
    });
    const payloadWeightLbs = stations.reduce((sum, row) => sum + Number(row.weightLbs || 0), 0);
    return {
        snapshot,
        layout,
        stations,
        assignments,
        boardedPaxCount: missionPlan.paxCount,
        paxWeightLbs: Math.round(missionPlan.paxTotalLbs),
        cargoWeightLbs: Math.round(loadedItems.reduce((sum, item) => sum + Number(item.weightLbs || 0), 0)),
        missionWeightLbs: Math.round(stations.reduce((sum, row) => sum + Number(row.missionExtraLbs || 0), 0)),
        payloadWeightLbs: Math.round(payloadWeightLbs * 10) / 10
    };
}

function _missionCargoStorePayloadBaselineIfNeeded(snapshot, manifestKey = '') {
    const normalized = _missionCargoNormalizePayloadSnapshot(snapshot);
    if (!normalized) return null;
    _missionCargoResetPayloadPlanForMissionKey(manifestKey);
    if (!window.missionCargoStatus.payloadBaseline || Number(window.missionCargoStatus.payloadBaseline?.payloadStationCount || 0) !== Number(normalized.payloadStationCount || 0)) {
        window.missionCargoStatus.payloadBaseline = normalized;
        window.missionCargoStatus.payloadLayout = _missionCargoBuildPayloadLayout(normalized);
    }
    return window.missionCargoStatus.payloadBaseline;
}

function _missionCargoEstimateResetStationsFromSnapshot(manifestBeforeReset, snapshotNow) {
    const snapshot = _missionCargoNormalizePayloadSnapshot(snapshotNow);
    if (!snapshot) return [];
    const layout = _missionCargoBuildPayloadLayout(snapshot);
    const missionPlan = _missionCargoBuildMissionExtraPlan(manifestBeforeReset, layout);
    return snapshot.stations.map((row) => {
        const missionExtra = Number(missionPlan.missionByStation.get(row.index) || 0);
        const currentWeight = Math.max(0, Number(row.weightLbs || 0));
        return {
            index: row.index,
            weightLbs: Math.round(Math.max(0, currentWeight - missionExtra) * 10) / 10
        };
    });
}

function _missionCargoResetManifestState(manifest) {
    if (!manifest || !Array.isArray(manifest.items)) return false;
    let changed = false;
    manifest.items.forEach((item) => {
        const nextStatus = 'pending';
        if (item.status !== nextStatus) changed = true;
        item.status = nextStatus;
        if (item.loadedAt || item.unloadedAt || item.droppedAt) changed = true;
        item.loadedAt = 0;
        item.unloadedAt = 0;
        item.droppedAt = 0;
        if (Number.isFinite(Number(item.droppedLat)) || Number.isFinite(Number(item.droppedLon)) || Number.isFinite(Number(item.droppedAltFt))) changed = true;
        item.droppedLat = null;
        item.droppedLon = null;
        item.droppedAltFt = null;
        if (Number.isFinite(Number(item.unloadLat)) || Number.isFinite(Number(item.unloadLon)) || Number.isFinite(Number(item.unloadAltFt))) changed = true;
        item.unloadLat = null;
        item.unloadLon = null;
        item.unloadAltFt = null;
        if (Number(item.healthPct) !== 100) changed = true;
        item.healthPct = 100;
        if (item.log && Object.keys(item.log).length) changed = true;
        item.log = {};
    });
    if (Number(manifest.maxStressDamagePct || 0) !== 0) changed = true;
    manifest.maxStressDamagePct = 0;
    if (manifest.dispatchSignature) changed = true;
    manifest.dispatchSignature = null;
    return changed;
}

async function _missionCargoResetForMissionReset(reason = 'mission-runtime-reset') {
    if (window.missionCargoStatus.payloadSyncRunning) {
        const waitUntil = Date.now() + 2600;
        while (window.missionCargoStatus.payloadSyncRunning && Date.now() < waitUntil) {
            await new Promise(resolve => setTimeout(resolve, 120));
        }
    }
    window.missionCargoStatus.payloadSyncQueued = '';
    let manifest = _missionCargoGetManifest();
    if ((!manifest || !Array.isArray(manifest.items)) && _missionCargoHasActiveMission()) {
        manifest = _missionCargoEnsureManifest();
    }
    if (!manifest || !Array.isArray(manifest.items) || !manifest.items.length) {
        _missionCargoResetPayloadPlanForMissionKey('');
        window.missionCargoStatus.payloadPendingResetStations = null;
        window.missionCargoStatus.payloadPendingResetMaxStations = 0;
        window.missionCargoStatus.payloadNeedsSync = false;
        return { status: 'no_manifest' };
    }
    const manifestBeforeReset = JSON.parse(JSON.stringify(manifest));
    const baseline = _missionCargoNormalizePayloadSnapshot(window.missionCargoStatus?.payloadBaseline);
    let snapshot = _missionCargoNormalizePayloadSnapshot(window.aircraftPayloadStatus?.snapshot);
    if (!snapshot && !window.simModeActive && window.liveTrackerConnected && typeof window.trackerPayloadGet === 'function') {
        const ack = await _missionCargoRefreshPayloadSnapshot({ force: true, maxStations: 12, timeoutMs: 12000 });
        if (ack?.status === 'ok' || ack?.status === 'cached') snapshot = _missionCargoNormalizePayloadSnapshot(window.aircraftPayloadStatus?.snapshot);
    }
    let targetStations = [];
    let targetMaxStations = 0;
    if (baseline && Array.isArray(baseline.stations) && baseline.stations.length && (!snapshot || baseline.payloadStationCount === snapshot.payloadStationCount)) {
        targetStations = baseline.stations.map(row => ({ index: row.index, weightLbs: Math.max(0, Number(row.weightLbs || 0)) }));
        targetMaxStations = baseline.sampledStationCount || baseline.payloadStationCount || targetStations.length;
    } else if (snapshot) {
        targetStations = _missionCargoEstimateResetStationsFromSnapshot(manifestBeforeReset, snapshot);
        targetMaxStations = snapshot.sampledStationCount || snapshot.payloadStationCount || targetStations.length;
    }

    const changed = _missionCargoResetManifestState(manifest);
    if (changed) _missionCargoPersistManifest(manifest);
    _missionCargoResetPayloadPlanForMissionKey('');
    window.missionCargoStatus.payloadPendingResetStations = targetStations.length ? targetStations : null;
    window.missionCargoStatus.payloadPendingResetMaxStations = targetMaxStations || 0;
    window.missionCargoStatus.payloadNeedsSync = !!window.missionCargoStatus.payloadPendingResetStations;

    if (window.simModeActive || !window.liveTrackerConnected || typeof window.trackerPayloadSet !== 'function' || !targetStations.length) {
        return { status: changed ? 'reset_app_only' : 'noop' };
    }

    const setAck = await window.trackerPayloadSet(targetStations, {
        maxStations: targetMaxStations || 12,
        timeoutMs: 15000,
        refreshAfter: true
    });
    if (setAck?.status === 'ok') {
        window.missionCargoStatus.payloadNeedsSync = false;
        window.missionCargoStatus.payloadPendingResetStations = null;
        window.missionCargoStatus.payloadPendingResetMaxStations = 0;
        window.missionCargoStatus.payloadBaseline = _missionCargoNormalizePayloadSnapshot(window.aircraftPayloadStatus?.snapshot);
        window.missionCargoStatus.payloadLayout = window.missionCargoStatus.payloadBaseline ? _missionCargoBuildPayloadLayout(window.missionCargoStatus.payloadBaseline) : null;
        window.missionCargoStatus.payloadPlan = null;
        window.missionCargoStatus.payloadSyncAt = Date.now();
        return { status: changed ? 'reset_app_and_sim' : 'sim_synced', ack: setAck };
    }
    window.missionCargoStatus.payloadNeedsSync = true;
    return { status: 'sim_reset_failed', ack: setAck };
}

async function _missionCargoApplyPendingResetStations(reason = 'payload-pending-reset') {
    const rows = Array.isArray(window.missionCargoStatus?.payloadPendingResetStations) ? window.missionCargoStatus.payloadPendingResetStations : [];
    if (!rows.length) return { status: 'no_pending_reset' };
    if (window.simModeActive || !window.liveTrackerConnected || typeof window.trackerPayloadSet !== 'function') return { status: 'skipped' };
    const ack = await window.trackerPayloadSet(rows, {
        maxStations: Math.max(1, Number(window.missionCargoStatus?.payloadPendingResetMaxStations || rows.length) || rows.length),
        timeoutMs: 15000,
        refreshAfter: true
    });
    if (ack?.status === 'ok') {
        window.missionCargoStatus.payloadNeedsSync = false;
        window.missionCargoStatus.payloadPendingResetStations = null;
        window.missionCargoStatus.payloadPendingResetMaxStations = 0;
        window.missionCargoStatus.payloadBaseline = _missionCargoNormalizePayloadSnapshot(window.aircraftPayloadStatus?.snapshot);
        window.missionCargoStatus.payloadLayout = window.missionCargoStatus.payloadBaseline ? _missionCargoBuildPayloadLayout(window.missionCargoStatus.payloadBaseline) : null;
        window.missionCargoStatus.payloadPlan = null;
        window.missionCargoStatus.payloadSyncAt = Date.now();
    } else {
        window.missionCargoStatus.payloadNeedsSync = true;
    }
    return ack || { status: 'unknown' };
}

function _missionCargoFormatStationList(indices = []) {
    const list = [...new Set((Array.isArray(indices) ? indices : [])
        .map(v => Math.round(Number(v)))
        .filter(v => Number.isFinite(v) && v >= 1))];
    return list.length ? list.join(', ') : '-';
}

function _missionCargoPayloadSummaryHtml(mode = 'load') {
    const snapshot = _missionCargoNormalizePayloadSnapshot(window.aircraftPayloadStatus?.snapshot);
    if (!snapshot) {
        const trackerConnected = !!window.liveTrackerConnected;
        const fd = window.lastLiveFlightData || {};
        const simRunning = Number(fd?.simRunning);
        const payloadError = String(window.aircraftPayloadStatus?.error || '').trim();
        const lastCommandAt = Number(window.aircraftPayloadStatus?.lastCommandAt || 0);
        const lastSnapshotAt = Number(window.aircraftPayloadStatus?.lastSnapshotAt || 0);
        const waitingForReply = lastCommandAt > 0 && lastSnapshotAt < lastCommandAt;
        const waitingAgeMs = waitingForReply ? (Date.now() - lastCommandAt) : 0;
        let message = 'Noch keine Sim-Gewichte empfangen.';
        if (!trackerConnected) message = 'Tracker nicht verbunden. Sim-Gewichte werden nicht abgefragt.';
        else if (Number.isFinite(simRunning) && simRunning === 0) message = 'Simulator liefert aktuell keine Live-Daten.';
        else if (payloadError) message = `Sim-Gewichte nicht verfügbar (${payloadError}).`;
        else if (waitingForReply && waitingAgeMs < 14000) message = 'Sim-Gewichte werden abgerufen ...';
        else if (waitingForReply) message = 'Abruf der Sim-Gewichte fehlgeschlagen oder abgelaufen.';
        return `<div class="mission-cargo-payload-empty">${_missionCargoEscape(message)}</div>`;
    }
    const layout = window.missionCargoStatus.payloadLayout || _missionCargoBuildPayloadLayout(snapshot);
    const plan = window.missionCargoStatus.payloadPlan;
    const fuelWeight = Number.isFinite(Number(snapshot.fuelWeightLbs)) ? Number(snapshot.fuelWeightLbs) : Number(window.lastLiveFlightData?.fuelWeightLbs);
    const stationRows = (plan?.stations || snapshot.stations || []).map((row) => {
        const target = Number(row?.weightLbs);
        const base = Number(row?.baselineWeightLbs);
        const extra = Number(row?.missionExtraLbs);
        const detail = Number.isFinite(base) && Number.isFinite(extra)
            ? ` (Basis ${Math.round(base)} + ${Math.round(extra)} lbs)`
            : '';
        return `<span>S${Math.round(Number(row?.index) || 0)}: ${Number.isFinite(target) ? Math.round(target) : '-'} lbs${detail}</span>`;
    }).join(' · ');
    const missionExtra = Number.isFinite(Number(plan?.missionWeightLbs)) ? Number(plan.missionWeightLbs) : null;
    const paxPart = Number.isFinite(Number(plan?.paxWeightLbs)) ? `Pax ${Math.round(plan.paxWeightLbs)} lbs` : 'Pax n/a';
    const cargoPart = Number.isFinite(Number(plan?.cargoWeightLbs)) ? `Cargo ${Math.round(plan.cargoWeightLbs)} lbs` : 'Cargo n/a';
    return `
        <div class="mission-cargo-payload-summary">
            <div>Sim aktuell: MTOW-Live ${Number.isFinite(Number(snapshot.totalWeightLbs)) ? Math.round(snapshot.totalWeightLbs) : '-'} lbs · Leer ${Number.isFinite(Number(snapshot.emptyWeightLbs)) ? Math.round(snapshot.emptyWeightLbs) : '-'} lbs · Fuel ${Number.isFinite(fuelWeight) ? Math.round(fuelWeight) : '-'} lbs</div>
            <div>Nutzlaststationen: ${snapshot.payloadStationCount} · Verteilung: Copilot S${layout.copilotIndex} · Ruecksitze ${_missionCargoFormatStationList(layout.rearSeatIndices)} · Cargo ${_missionCargoFormatStationList(layout.cargoIndices)}</div>
            <div>Mission-Plan (${mode === 'unload' ? 'Entladen' : 'Verladen'}): ${paxPart} · ${cargoPart}${missionExtra == null ? '' : ` · Zusatz ${Math.round(missionExtra)} lbs`}</div>
            <div>Stationen: ${stationRows || '-'}</div>
        </div>`;
}

async function _missionCargoRefreshPayloadSnapshot(options = {}) {
    if (window.simModeActive || !window.liveTrackerConnected || typeof window.trackerPayloadGet !== 'function') return { status: 'skipped' };
    const force = options?.force === true;
    const ageMs = Date.now() - Number(window.aircraftPayloadStatus?.lastSnapshotAt || 0);
    if (!force && ageMs >= 0 && ageMs < 4500 && window.aircraftPayloadStatus?.snapshot) {
        return { status: 'cached', snapshot: window.aircraftPayloadStatus.snapshot };
    }
    return window.trackerPayloadGet({
        maxStations: Math.max(4, Math.min(15, Math.round(Number(options?.maxStations ?? 12) || 12))),
        timeoutMs: Number(options?.timeoutMs) || 12000
    });
}

async function _missionCargoSyncPayloadToSim(reason = 'cargo-sync') {
    if (window.simModeActive || !window.liveTrackerConnected || typeof window.trackerPayloadSet !== 'function') {
        window.missionCargoStatus.payloadNeedsSync = true;
        return { status: 'skipped' };
    }
    if (window.missionCargoStatus.payloadSyncRunning) {
        window.missionCargoStatus.payloadSyncQueued = reason;
        return { status: 'queued' };
    }
    window.missionCargoStatus.payloadSyncRunning = true;
    window.missionCargoStatus.payloadSyncQueued = '';
    try {
        const hasPendingReset = Array.isArray(window.missionCargoStatus?.payloadPendingResetStations) && window.missionCargoStatus.payloadPendingResetStations.length > 0;
        if (hasPendingReset) {
            const pendingAck = await _missionCargoApplyPendingResetStations(`${reason}-pre`);
            if (pendingAck?.status && pendingAck.status !== 'ok' && pendingAck.status !== 'no_pending_reset') {
                window.missionCargoStatus.payloadNeedsSync = true;
                return pendingAck;
            }
        }
        const manifest = _missionCargoEnsureManifest();
        _missionCargoResetPayloadPlanForMissionKey(manifest?.key || '');
        if (!window.missionCargoStatus.payloadBaseline) {
            const getAck = await _missionCargoRefreshPayloadSnapshot({ force: true, maxStations: 12, timeoutMs: 12000 });
            if (getAck?.status !== 'ok' && !window.aircraftPayloadStatus?.snapshot) {
                window.missionCargoStatus.payloadNeedsSync = true;
                return getAck || { status: 'no_snapshot' };
            }
        }
        const baseline = _missionCargoStorePayloadBaselineIfNeeded(window.aircraftPayloadStatus?.snapshot, manifest?.key || '');
        if (!baseline) {
            window.missionCargoStatus.payloadNeedsSync = true;
            return { status: 'no_baseline' };
        }
        const plan = _missionCargoBuildPlanFromManifest(manifest, baseline);
        if (!plan || !Array.isArray(plan.stations) || !plan.stations.length) {
            window.missionCargoStatus.payloadNeedsSync = true;
            return { status: 'no_plan' };
        }
        window.missionCargoStatus.payloadLayout = plan.layout;
        window.missionCargoStatus.payloadPlan = plan;
        const setAck = await window.trackerPayloadSet(
            plan.stations.map(row => ({ index: row.index, weightLbs: row.weightLbs })),
            { maxStations: baseline.sampledStationCount || baseline.payloadStationCount || 12, timeoutMs: 15000, refreshAfter: true }
        );
        window.missionCargoStatus.payloadSyncAt = Date.now();
        if (setAck?.status === 'ok') {
            window.missionCargoStatus.payloadNeedsSync = false;
        } else {
            window.missionCargoStatus.payloadNeedsSync = true;
            window.missionCargoStatus.error = setAck?.error || setAck?.status || 'payload_set_failed';
        }
        return setAck || { status: 'unknown' };
    } catch (err) {
        window.missionCargoStatus.payloadNeedsSync = true;
        window.missionCargoStatus.error = err?.message || String(err);
        return { status: 'error', error: err?.message || String(err) };
    } finally {
        window.missionCargoStatus.payloadSyncRunning = false;
        const queued = window.missionCargoStatus.payloadSyncQueued;
        window.missionCargoStatus.payloadSyncQueued = '';
        if (queued) setTimeout(() => { _missionCargoSyncPayloadToSim(`queued:${queued}`); }, 180);
    }
}

function _missionCargoStressDamage(record = null) {
    const fd = window.lastLiveFlightData || {};
    const maxG = Math.max(Number(record?.maxGForce || 1), Number(flightRecorder?.maxGForce || 1), Number(fd.gForce || 1));
    const maxBank = Math.max(Math.abs(Number(record?.maxBankDeg || 0)), Math.abs(Number(flightRecorder?.maxBankDeg || 0)), Math.abs(Number(fd.bankDeg || 0)));
    const maxDescent = Math.max(Math.abs(Math.min(0, Number(record?.maxDescentFpm || 0))), Math.abs(Math.min(0, Number(flightRecorder?.maxDescentFpm || 0))), Math.abs(Math.min(0, Number(fd.vsFpm ?? fd.vs ?? 0))));
    const touchdown = Math.abs(Number(record?.touchdownVsFpm || flightRecorder?.touchdownVsFpm || fd.touchdownFpm || 0));
    let damage = 0;
    if (Number.isFinite(maxG) && maxG > 1.45) damage += (maxG - 1.45) * 22;
    if (Number.isFinite(maxBank) && maxBank > 45) damage += (maxBank - 45) * 0.45;
    if (Number.isFinite(maxDescent) && maxDescent > 1300) damage += (maxDescent - 1300) * 0.008;
    if (Number.isFinite(touchdown) && touchdown > 450) damage += (touchdown - 450) * 0.045;
    return Math.max(0, Math.min(85, Math.round(damage)));
}

function _missionCargoApplyStressSnapshot(record = null) {
    const manifest = _missionCargoEnsureManifest();
    const damage = _missionCargoStressDamage(record);
    const prev = Number(manifest.maxStressDamagePct || 0);
    if (!Number.isFinite(damage) || damage <= prev) return manifest;
    manifest.maxStressDamagePct = damage;
    (manifest.items || []).forEach(item => {
        if (item.status === 'loaded') {
            item.healthPct = Math.max(0, Math.min(Number(item.healthPct ?? 100), 100 - damage));
        }
    });
    _missionCargoPersistManifest(manifest);
    return manifest;
}

window.missionCargoApplyCurrentStress = function(record = null) {
    if (!_missionCargoHasActiveMission()) return null;
    return JSON.parse(JSON.stringify(_missionCargoApplyStressSnapshot(record)));
};

function _missionCargoEvaluateOutcome(manifest = _missionCargoEnsureManifest()) {
    const items = Array.isArray(manifest?.items) ? manifest.items : [];
    const required = items.filter(item => item.required);
    const missing = required.filter(item => item.status !== 'loaded' && item.status !== 'unloaded' && item.status !== 'dropped');
    const dropped = required.filter(item => item.status === 'dropped');
    const notDelivered = required.filter(item => _missionCargoItemNeedsUnloadHere(item) && item.status === 'loaded');
    const damaged = required.filter(item => Number(item.healthPct ?? 100) <= 35);
    const failed = missing.length > 0 || dropped.length > 0 || notDelivered.length > 0 || damaged.length > 0;
    const loadedWeightLbs = items.reduce((sum, item) => sum + ((item.status === 'loaded' || item.status === 'unloaded') ? Number(item.weightLbs || 0) : 0), 0);
    return {
        status: failed ? 'failed' : 'completed',
        failed,
        requiredTotal: required.length,
        requiredLoaded: required.filter(item => item.status === 'loaded' || item.status === 'unloaded').length,
        missingRequired: missing.map(item => item.storyName || item.label),
        droppedRequired: dropped.map(item => item.storyName || item.label),
        notDeliveredRequired: notDelivered.map(item => item.storyName || item.label),
        damagedRequired: damaged.map(item => item.storyName || item.label),
        loadedWeightLbs: Math.round(loadedWeightLbs),
        totalWeightLbs: Math.round(items.reduce((sum, item) => sum + Number(item.weightLbs || 0), 0))
    };
}

function _missionCargoEvaluateFarewellOutcome() {
    const manifest = _missionCargoEnsureManifest();
    if (!manifest || !Array.isArray(manifest.items)) return _missionCargoEvaluateOutcome(manifest);
    const projected = JSON.parse(JSON.stringify(manifest));
    const passenger = (projected.items || []).find(item => _missionCargoIsPassengerItem(item) && item.status === 'loaded');
    if (passenger) {
        passenger.status = 'unloaded';
        passenger.unloadedAt = Date.now();
        passenger.droppedAt = 0;
    }
    return _missionCargoEvaluateOutcome(projected);
}

function _missionCargoRequiredStatusSnapshot(manifest = _missionCargoEnsureManifest()) {
    const items = Array.isArray(manifest?.items) ? manifest.items : [];
    return items
        .filter(item => item && item.required)
        .map(item => ({
            id: String(item.id || ''),
            label: String(item.storyName || item.label || item.id || ''),
            status: String(item.status || 'pending'),
            itemType: String(item.itemType || 'cargo'),
            pickupLocation: String(item.pickupLocation || ''),
            deliverAtDestination: item.deliverAtDestination !== false,
            deliverAtHome: item.deliverAtHome === true
        }));
}

window.missionCargoEvaluateOutcome = function() {
    if (!_missionCargoHasActiveMission()) {
        return { status: 'none', failed: false, requiredTotal: 0, requiredLoaded: 0, missingRequired: [], droppedRequired: [], notDeliveredRequired: [], damagedRequired: [], loadedWeightLbs: 0, totalWeightLbs: 0 };
    }
    _missionCargoApplyStressSnapshot();
    return _missionCargoEvaluateOutcome();
};

function _missionCargoFinalizeMissionOutcome(options = {}) {
    const manifest = _missionCargoApplyStressSnapshot(options.record || null);
    const outcome = _missionCargoEvaluateOutcome(manifest);
    if (typeof _missionPhaseDebugPush === 'function') {
        _missionPhaseDebugPush('trigger', {
            name: 'missionCargoFinalizeMissionOutcome',
            source: options.source || 'mission-end',
            failed: !!outcome.failed,
            missingRequired: (outcome.missingRequired || []).join(','),
            notDeliveredRequired: (outcome.notDeliveredRequired || []).join(','),
            droppedRequired: (outcome.droppedRequired || []).join(','),
            damagedRequired: (outcome.damagedRequired || []).join(','),
            requiredStatus: JSON.stringify(_missionCargoRequiredStatusSnapshot(manifest))
        });
    }
    outcome.finalizedAt = Date.now();
    outcome.source = options.source || 'mission-end';
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (md && typeof md === 'object') {
        md.cargoOutcome = outcome;
        md.cargoManifest = manifest;
        md.missionResult = outcome.failed ? 'failed' : 'completed';
        md.missionFailed = !!outcome.failed;
        if (md.missionContract && typeof md.missionContract === 'object') {
            md.missionContract.cargoOutcome = outcome;
            md.missionContract.cargoManifest = manifest;
        }
    }
    if (window.activeMissionContract && typeof window.activeMissionContract === 'object') {
        window.activeMissionContract.cargoOutcome = outcome;
        window.activeMissionContract.cargoManifest = manifest;
    }
    _missionCargoPersistManifest(manifest);
    return outcome;
}
window.missionCargoFinalizeMissionOutcome = _missionCargoFinalizeMissionOutcome;

window.missionCargoGetManifestSnapshot = function() {
    if (!_missionCargoHasActiveMission()) return null;
    _missionCargoApplyStressSnapshot();
    return JSON.parse(JSON.stringify(_missionCargoEnsureManifest()));
};

function _missionCargoNeedsUnload() {
    const manifest = _missionCargoEnsureManifest();
    if (manifest.isPoi) return false;
    return _missionCargoLoadedItems(manifest).some(item => _missionCargoItemNeedsUnloadHere(item) && item.status !== 'unloaded');
}
window.missionCargoNeedsUnload = _missionCargoNeedsUnload;

function _missionCargoAutoLoadEnabled() {
    try {
        return localStorage.getItem(MISSION_CARGO_AUTO_LOAD_KEY) === '1';
    } catch (_) {
        return false;
    }
}

function _updateMissionCargoAutoLoadButton() {
    const btn = document.getElementById('missionCargoAutoLoadBtn');
    if (!btn) return;
    const enabled = _missionCargoAutoLoadEnabled();
    btn.textContent = enabled ? 'AUTO LOAD: AN' : 'AUTO LOAD: AUS';
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    btn.classList.toggle('is-on', enabled);
    btn.classList.toggle('is-off', !enabled);
}

window.toggleMissionCargoAutoLoadOption = function() {
    const next = !_missionCargoAutoLoadEnabled();
    try {
        if (next) localStorage.setItem(MISSION_CARGO_AUTO_LOAD_KEY, '1');
        else localStorage.removeItem(MISSION_CARGO_AUTO_LOAD_KEY);
    } catch (_) {}
    _updateMissionCargoAutoLoadButton();
    if (next && document.getElementById('missionCargoOverlay')?.style.display === 'flex') {
        _missionCargoMarkAllLoaded({ despawn: false });
        _missionCargoRenderDialog('load');
    }
    return next;
};

function _missionCargoMarkAllLoaded({ despawn = true } = {}) {
    const manifest = _missionCargoEnsureManifest();
    let changed = false;
    manifest.items.forEach(item => {
        if (!_missionCargoItemCanLoadAtCurrentStage(item)) return;
        if (item.status !== 'loaded' && item.status !== 'unloaded') {
            item.status = 'loaded';
            item.loadedAt = Date.now();
            changed = true;
            if (despawn && !window.simModeActive && window.liveTrackerConnected && !_missionCargoIsPassengerItem(item)) {
                window.sendTrackerCommand({
                    type: 'mission_scene_object_remove',
                    sceneId: _missionCargoSceneId(),
                    reason: 'cargo-auto-load',
                    kinds: [item.sceneKind],
                    labels: [item.label, item.storyName]
                });
            }
        }
    });
    if (_missionCargoInvalidateDispatchSignature(manifest)) changed = true;
    if (changed) {
        _missionCargoPersistManifest(manifest);
        _missionCargoSyncPayloadToSim('cargo-mark-all-loaded').catch(() => {});
    }
    return changed;
}

function _missionCargoMarkPassengerLoaded(options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const item = (manifest.items || []).find(_missionCargoIsPassengerItem);
    if (!item) return false;
    if (item.status === 'loaded') return false;
    item.status = 'loaded';
    item.loadedAt = Date.now();
    item.unloadedAt = 0;
    item.droppedAt = 0;
    item.unloadLat = null;
    item.unloadLon = null;
    item.unloadAltFt = null;
    item.droppedLat = null;
    item.droppedLon = null;
    item.droppedAltFt = null;
    _missionCargoInvalidateDispatchSignature(manifest);
    _missionCargoPersistManifest(manifest);
    if (window.missionSceneStatus && typeof window.missionSceneStatus === 'object') {
        window.missionSceneStatus.personBoarded = true;
    }
    if (!window.simModeActive && window.liveTrackerConnected) {
        const commandId = window.sendTrackerCommand({
            type: 'mission_scene_object_remove',
            sceneId: _missionCargoUnloadSceneId(),
            reason: options.reason || 'passenger-load-sync',
            kinds: [`unloaded_${item.sceneKind || item.id}`],
            labels: [item.label, item.storyName]
        });
        if (commandId) {
            window.missionCargoStatus.lastCommandAt = Date.now();
            window.missionCargoStatus.lastCommand = { type: 'mission_scene_object_remove', commandId, itemId: item.id };
        }
    }
    _missionCargoSyncPayloadToSim(options.reason || 'passenger-load-sync').catch(() => {});
    return true;
}

function _missionCargoMarkPassengerUnloaded(options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const item = (manifest.items || []).find(entry => _missionCargoIsPassengerItem(entry) && entry.status === 'loaded');
    if (!item) return false;
    const livePos = _missionCargoCommandBasePos();
    item.status = 'unloaded';
    item.unloadedAt = Date.now();
    item.droppedAt = 0;
    item.unloadLat = Number.isFinite(Number(livePos?.lat)) ? Number(livePos.lat) : null;
    item.unloadLon = Number.isFinite(Number(livePos?.lon)) ? Number(livePos.lon) : null;
    item.unloadAltFt = Number.isFinite(Number(livePos?.altFt)) ? Number(livePos.altFt) : null;
    item.droppedLat = null;
    item.droppedLon = null;
    item.droppedAltFt = null;
    if (_missionCargoIsPassengerItem(item) && window.missionSceneStatus && typeof window.missionSceneStatus === 'object') {
        window.missionSceneStatus.personBoarded = false;
    }
    _missionCargoInvalidateDispatchSignature(manifest);
    _missionCargoPersistManifest(manifest);
    if (window.missionSceneStatus && typeof window.missionSceneStatus === 'object') {
        window.missionSceneStatus.personBoarded = false;
    }
    if (!window.simModeActive && window.liveTrackerConnected) {
        const pos = _missionCargoCommandBasePos();
        const hasPos = Number.isFinite(Number(pos?.lat)) && Number.isFinite(Number(pos?.lon));
        if (hasPos) {
            window.sendTrackerCommand({
                type: 'mission_scene_object_remove',
                sceneId: _missionCargoUnloadSceneId(),
                reason: `${options.reason || 'passenger-unload-sync'}-refresh-remove`,
                kinds: [`unloaded_${item.sceneKind || item.id}`],
                labels: [item.label, item.storyName]
            });
            const placement = _missionCargoPassengerSpawnPlacement(item);
            const commandId = window.sendTrackerCommand({
                type: 'mission_scene_object_spawn',
                sceneId: _missionCargoUnloadSceneId(),
                reason: options.reason || 'passenger-unload-sync',
                lat: Number(pos.lat),
                lon: Number(pos.lon),
                altFt: Number.isFinite(Number(pos.altFt)) ? Number(pos.altFt) : 0,
                hdg: Number.isFinite(Number(pos.hdg)) ? Number(pos.hdg) : 0,
                items: [{
                    kind: `unloaded_${item.sceneKind || item.id}`,
                    label: item.storyName || item.label,
                    objectTitle: item.objectTitle || _missionScenePersonTitle(_missionScenePassengerGender(), 'cargo-passenger-unloaded'),
                    titleCandidates: item.titleCandidates || _missionScenePersonCandidates(_missionScenePassengerGender(), item.objectTitle || ''),
                    forwardM: placement.forwardM,
                    rightM: placement.rightM,
                    headingMode: 'with_aircraft',
                    hdgOffsetDeg: 165,
                    altOffsetFt: placement.altOffsetFt
                }]
            });
            if (commandId) {
                window.missionCargoStatus.lastCommandAt = Date.now();
                window.missionCargoStatus.lastCommand = { type: 'mission_scene_object_spawn', commandId, itemId: item.id };
            }
        } else {
            window.missionCargoStatus.error = 'Keine gueltige Sim-Position fuer Passenger-Spawn.';
        }
    }
    _missionCargoSyncPayloadToSim(options.reason || 'passenger-unload-sync').catch(() => {});
    return true;
}

function _missionCargoEscape(text = '') {
    if (typeof escapeHtmlLite === 'function') return escapeHtmlLite(text);
    return String(text || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function _missionCargoRenderDialog(mode = 'load', options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const groundHandlingAllowed = _missionCargoGroundHandlingAllowed();
    const isPickup = mode === 'pickup';
    if (!isPickup && mode !== 'unload' && groundHandlingAllowed && _missionCargoAutoLoadEnabled()) {
        _missionCargoMarkAllLoaded({ despawn: false });
        if (window.missionSceneStatus?.spawned) _missionCargoRemoveLoadedSceneObjects('cargo-auto-load-open');
    }
    _missionCargoStorePayloadBaselineIfNeeded(window.aircraftPayloadStatus?.snapshot, manifest?.key || '');
    if (window.missionCargoStatus.payloadBaseline) {
        window.missionCargoStatus.payloadPlan = _missionCargoBuildPlanFromManifest(manifest, window.missionCargoStatus.payloadBaseline);
    }
    let overlay = document.getElementById('missionCargoOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'missionCargoOverlay';
        overlay.className = 'mission-cargo-overlay';
        document.body.appendChild(overlay);
    }
    const sameModeRepaint = window.missionCargoStatus?.lastMode === mode && overlay.style.display === 'flex';
    const preserveScroll = options?.preserveScroll !== false && sameModeRepaint;
    const previousScroll = preserveScroll ? {
        panelTop: Number(overlay.querySelector('.mission-cargo-panel')?.scrollTop || 0),
        panelLeft: Number(overlay.querySelector('.mission-cargo-panel')?.scrollLeft || 0),
        clipboardTop: Number(overlay.querySelector('.mission-cargo-clipboard')?.scrollTop || 0),
        clipboardLeft: Number(overlay.querySelector('.mission-cargo-clipboard')?.scrollLeft || 0),
        listTop: Number(overlay.querySelector('.mission-cargo-list')?.scrollTop || 0),
        listLeft: Number(overlay.querySelector('.mission-cargo-list')?.scrollLeft || 0)
    } : null;
    const isUnload = mode === 'unload';
    const missionStartReady = (isUnload || isPickup) ? true : _missionCargoLoadInteractionReady();
    const visibleItems = isUnload
        ? manifest.items.filter(item => (item.status === 'loaded' || item.status === 'unloaded' || item.status === 'dropped') && _missionCargoItemNeedsUnloadHere(item))
        : (isPickup
            ? manifest.items.filter(item => item.pickupLocation === 'target')
            : manifest.items);
    const requiredMissing = manifest.items.filter(item => item.required && item.pickupLocation !== 'target' && item.status !== 'loaded' && item.status !== 'unloaded').length;
    const requiredUnloadMissing = manifest.items.filter(item => item.required && _missionCargoItemNeedsUnloadHere(item) && item.status === 'loaded').length;
    const requiredPickupMissing = visibleItems.filter(item => item.required && item.status !== 'loaded' && item.status !== 'unloaded').length;
    const signature = manifest.dispatchSignature && typeof manifest.dispatchSignature === 'object' ? manifest.dispatchSignature : null;
    const signatureAnimating = !!signature && !isUnload && !isPickup && Number(window.missionCargoStatus?.signatureAnimationEndsAt || 0) > Date.now();
    const signatureReady = !!signature && !signatureAnimating;
    const assignmentMap = new Map(
        ((window.missionCargoStatus?.payloadPlan?.assignments) || [])
            .filter(row => (row?.type === 'cargo' && row?.itemId) || row?.type === 'pax')
            .map(row => [row?.itemId ? String(row.itemId) : 'mission-passenger', Array.isArray(row.stations) ? row.stations.join('/') : '-'])
    );
    const livePos = _missionCargoLivePos();
    const pickupBoardingActive = isPickup && _missionBushIsPickupPassengerMission() && !!(window.missionSceneStatus?.boardingRequested || window.missionSceneStatus?.boardingActive);
    const pickupItemTypeLabel = _missionBushIsPickupCargoMission() ? 'Rueckholfracht' : 'wartenden Pickup-Gast';
    const rows = visibleItems.map(item => {
        const isPassenger = _missionCargoIsPassengerItem(item);
        const loaded = item.status === 'loaded' || item.status === 'unloaded';
        const unloaded = item.status === 'unloaded';
        const dropped = item.status === 'dropped';
        const reloadDistanceM = _missionCargoDistanceToUnloadM(item, livePos);
        const canReloadNearby = _missionCargoCanReloadUnloadedItem(item, MISSION_CARGO_RELOAD_MAX_DISTANCE_M);
        const action = isUnload
            ? (dropped
                ? `<button class="mission-cargo-row-btn" disabled>Abgeworfen</button>`
                : (unloaded
                ? `<button class="mission-cargo-row-btn" ${(!groundHandlingAllowed || !canReloadNearby) ? 'disabled' : ''} onclick="window.missionCargoLoadItem && missionCargoLoadItem('${item.id}', { mode: 'unload-reload' })">${!groundHandlingAllowed ? 'Nur am Boden' : (canReloadNearby ? (isPassenger ? 'Einsteigen' : 'Wieder laden') : 'Zu weit weg')}</button>`
                : `<button class="mission-cargo-row-btn" ${(!groundHandlingAllowed && isPassenger) ? 'disabled' : ''} onclick="window.missionCargoUnloadItem && missionCargoUnloadItem('${item.id}')">${groundHandlingAllowed ? (isPassenger ? 'Aussteigen' : 'Ausladen') : (isPassenger ? 'Nur am Boden' : 'Abwerfen')}</button>`))
            : `<button class="mission-cargo-row-btn" ${(loaded || dropped || !groundHandlingAllowed || !_missionCargoItemCanLoadAtCurrentStage(item) || pickupBoardingActive) ? 'disabled' : ''} onclick="window.missionCargoLoadItem && missionCargoLoadItem('${item.id}', { mode: '${isPickup ? 'pickup' : 'load'}' })">${pickupBoardingActive ? '… Boarding' : (!groundHandlingAllowed ? 'Nur am Boden' : (!_missionCargoItemCanLoadAtCurrentStage(item) ? 'Am Ziel' : (dropped ? 'Abgeworfen' : (loaded ? (isPassenger ? 'An Bord' : 'Geladen') : (isPassenger ? 'Einsteigen' : 'Laden')))))}</button>`;
        const status = dropped ? 'abgeworfen' : (unloaded ? (isPassenger ? 'ausgestiegen' : 'ausgeladen') : (loaded ? (isPassenger ? 'an bord' : 'geladen') : 'offen'));
        const distanceMeta = (isUnload && unloaded && Number.isFinite(reloadDistanceM))
            ? ` · Distanz ${Math.round(reloadDistanceM)} m`
            : '';
        return `
            <div class="mission-cargo-row ${item.required ? 'is-required' : 'is-optional'} ${loaded ? 'is-loaded' : ''} ${dropped ? 'is-dropped' : ''}">
                <div class="mission-cargo-row-main">
                    <div class="mission-cargo-row-title">${_missionCargoEscape(item.storyName || item.label)}</div>
                    <div class="mission-cargo-row-meta">${item.required ? 'Pflicht' : 'Optional'} · ${Math.round(Number(item.weightLbs) || 0)} lbs · ${status}${distanceMeta}</div>
                </div>
                ${action}
            </div>`;
    }).join('') || `<div class="mission-cargo-empty">${isUnload ? 'Keine geladene Zielfracht offen.' : 'Keine Ladung fuer diese Mission.'}</div>`;
    const clipboardRows = visibleItems.map((item, idx) => {
        const isPassenger = _missionCargoIsPassengerItem(item);
        const loaded = item.status === 'loaded' || item.status === 'unloaded';
        const unloaded = item.status === 'unloaded';
        const dropped = item.status === 'dropped';
        const status = dropped ? 'abgeworfen' : (unloaded ? (isPassenger ? 'ausgestiegen' : 'ausgeladen') : (loaded ? (isPassenger ? 'an bord' : 'geladen') : 'offen'));
        const stationText = assignmentMap.get(String(item.id)) || (loaded ? 'auto' : '-');
        const rowAction = (!isUnload && !isPickup && groundHandlingAllowed && _missionCargoItemCanLoadAtCurrentStage(item)) ? ` onclick="window.missionCargoToggleItemLoadState && missionCargoToggleItemLoadState('${item.id}')"` : '';
        return `
            <tr class="${loaded ? 'is-loaded' : ''} ${(!isUnload && groundHandlingAllowed) ? 'is-interactive' : ''}"${rowAction}>
                <td>${idx + 1}</td>
                <td>${_missionCargoEscape(item.storyName || item.label || item.id)}</td>
                <td>${isPassenger ? `PAX${Number(item.passengerCount || 0) > 1 ? ` x${Number(item.passengerCount)}` : ''}` : (item.required ? 'Pflicht' : 'Optional')}</td>
                <td>${Math.round(Number(item.weightLbs) || 0)} lbs</td>
                <td>${_missionCargoEscape(stationText)}</td>
                <td>${status}</td>
            </tr>`;
    }).join('') || `<tr><td colspan="6">Keine Ladung fuer diese Mission.</td></tr>`;
    const metaAircraft = _missionCargoAircraftLabel();
    const metaPilot = _missionCargoPilotId();
    const metaDate = _missionCargoFormatDate(signature?.at || Date.now());
    const signatureName = _missionCargoEscape(signature?.by || metaPilot);
    const signaturePanel = (!isUnload && !isPickup) ? `
        <div class="mission-cargo-signature ${signature ? 'is-signed' : ''} ${signatureAnimating ? 'is-animating' : ''} ${signatureAnimating ? '' : 'is-clickable'}" onclick="${signatureAnimating ? '' : 'window.missionCargoToggleDispatchSignature && missionCargoToggleDispatchSignature()'}">
            <div class="mission-cargo-signature-line">${signature ? `<span class="mission-cargo-signature-name">${signatureName}</span>` : '&nbsp;'}</div>
            <div class="mission-cargo-signature-meta">Unterschrift Pilot · ${signature ? _missionCargoEscape(_missionCargoFormatDate(signature.at)) : 'noch offen'} · ${signatureAnimating ? 'wird eingetragen' : (signatureReady ? 'Klick: Signatur loeschen' : 'Klick: unterschreiben')}</div>
        </div>` : '';
    const pickupReadyToConfirm = isPickup && requiredPickupMissing === 0 && visibleItems.length > 0;
    const unloadCompletesMission = isUnload && _missionRuntimeGroundEndReady();
    const primaryActionJs = (!isUnload && !isPickup && !signatureReady)
        ? 'window.missionCargoSignDispatchList && missionCargoSignDispatchList()'
        : (isUnload
        ? 'window.finishMissionCargoUnloadAndEnd && finishMissionCargoUnloadAndEnd()'
        : (isPickup
            ? 'window.finishMissionCargoPickupAndContinue && finishMissionCargoPickupAndContinue()'
            : 'window.finishMissionCargoLoadingAndStart && finishMissionCargoLoadingAndStart()'));
    const primaryActionLabel = (!isUnload && !isPickup && !signatureReady)
        ? (signatureAnimating ? 'Unterschrift wird eingetragen ...' : 'Unterschrift eintragen')
        : (isUnload
        ? (unloadCompletesMission ? 'Entladung abgeschlossen - Mission beenden' : 'Entladung abschliessen')
        : (isPickup ? 'Pickup bestaetigen und Rueckflug freigeben' : 'Verladung abschliessen'));
    const secondaryAction = (!isUnload && !isPickup && signatureReady)
        ? `<button class="mission-cargo-secondary" onclick="window.missionCargoClearDispatchSignature && missionCargoClearDispatchSignature()">Zurueck zur Liste</button>`
        : '';
    const listMarkup = (!isUnload && !isPickup)
        ? ''
        : `<div class="mission-cargo-list">${rows}</div>`;
    const modeHint = isUnload
        ? (!groundHandlingAllowed ? '<div class="mission-cargo-summary">Im Flug kann Ladung nur abgeworfen werden. Als geliefert gilt sie erst nach Ausladen am Boden.</div>' : '')
        : (isPickup
            ? (!groundHandlingAllowed ? '<div class="mission-cargo-summary">Pickup ist nur im Stillstand am Zielstrip moeglich.</div>' : '<div class="mission-cargo-summary">Zum Treffpunkt rollen, Pickup laden und danach den Rueckflug bestaetigen.</div>')
            : (!groundHandlingAllowed ? '<div class="mission-cargo-summary">Verladung ist nur am Boden moeglich. Im Flug bleibt diese Liste nur zur Dokumentation sichtbar.</div>' : ''));
    overlay.innerHTML = `
        <div class="mission-cargo-panel">
            <div class="mission-cargo-head">
                <div>
                    <div class="mission-cargo-kicker">${isUnload ? 'Ankunft' : 'Abflug'}</div>
                    <div class="mission-cargo-title">${isUnload ? 'Ladung entladen' : (isPickup ? 'Pickup am Zielstrip' : 'Verladung')}</div>
                </div>
                <button class="mission-cargo-close" onclick="window.closeMissionCargoDialog && closeMissionCargoDialog()" title="Schliessen">×</button>
            </div>
            ${modeHint}
            <div class="mission-cargo-copy">${isUnload
                ? `Entlade die am Ziel benoetigten Gegenstaende. Wiederladen geht im Umkreis von ${MISSION_CARGO_RELOAD_MAX_DISTANCE_M} m.`
                : (isPickup
                    ? `Hier laedst du ${pickupItemTypeLabel} am Zielstrip ein. Nach der Bestaetigung wird der Rueckflug freigegeben.`
                    : (window.missionCargoStatus?.loadConfirmed
                        ? (missionStartReady
                            ? 'Verladung ist bestaetigt. Die Mission ist jetzt startbereit.'
                            : 'Verladung ist bestaetigt. Mission starten wird freigegeben, sobald Boarding und Ansage fertig sind.')
                        : (missionStartReady
                            ? 'Die Boarding-Animation ist abgeschlossen. Nach dem Abschliessen der Verladung ist die Mission startbereit.'
                            : 'Verladen ist bereits moeglich. Die eigentliche Missionsaktivierung wird erst nach Boarding und Verladung freigeschaltet.')))}</div>
            ${(!isUnload && !isPickup) ? `
            <div class="mission-cargo-clipboard">
                <div class="mission-cargo-sheet-title">Frachtgutliste</div>
                <div class="mission-cargo-sheet-meta">
                    <span><b>Flugzeug Kennung:</b> ${_missionCargoEscape(metaAircraft)}</span>
                    <span><b>Pilot-ID:</b> ${_missionCargoEscape(metaPilot)}</span>
                    <span><b>Datum:</b> ${_missionCargoEscape(metaDate)}</span>
                </div>
                <table class="mission-cargo-sheet-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Position</th>
                            <th>Typ</th>
                            <th>Gewicht</th>
                            <th>Station</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>${clipboardRows}</tbody>
                </table>
                ${signaturePanel}
            </div>` : ''}
            ${_missionCargoPayloadSummaryHtml(mode)}
            ${listMarkup}
            <div class="mission-cargo-summary">
                <span>${isUnload ? `${requiredUnloadMissing} Pflicht-Items noch an Bord` : (isPickup ? `${requiredPickupMissing} Pickup-Items offen` : `${requiredMissing} Pflicht-Items offen`)}</span>
                <span>${manifest.items.reduce((sum, item) => sum + ((item.status === 'loaded' || item.status === 'unloaded') ? Number(item.weightLbs || 0) : 0), 0)} lbs geladen</span>
            </div>
            <div class="mission-cargo-actions">
                ${secondaryAction}
                <button class="mission-cargo-primary" ${((isUnload && !groundHandlingAllowed) || (isPickup && (!groundHandlingAllowed || !pickupReadyToConfirm)) || (!isUnload && !isPickup && (!groundHandlingAllowed || signatureAnimating))) ? 'disabled' : ''} onclick="${primaryActionJs}">${primaryActionLabel}</button>
            </div>
        </div>`;
    overlay.style.display = 'flex';
    if (previousScroll) {
        window.missionCargoStatus.dialogScroll = previousScroll;
        const applyScroll = () => {
            const panelEl = overlay.querySelector('.mission-cargo-panel');
            const clipboardEl = overlay.querySelector('.mission-cargo-clipboard');
            const listEl = overlay.querySelector('.mission-cargo-list');
            if (panelEl) {
                panelEl.scrollTop = previousScroll.panelTop;
                panelEl.scrollLeft = previousScroll.panelLeft;
            }
            if (clipboardEl) {
                clipboardEl.scrollTop = previousScroll.clipboardTop;
                clipboardEl.scrollLeft = previousScroll.clipboardLeft;
            }
            if (listEl) {
                listEl.scrollTop = previousScroll.listTop;
                listEl.scrollLeft = previousScroll.listLeft;
            }
        };
        applyScroll();
        requestAnimationFrame(applyScroll);
    } else {
        window.missionCargoStatus.dialogScroll = null;
    }
    window.missionCargoStatus.lastMode = mode;
    _updateMissionCargoAutoLoadButton();
    if (options?.skipPayloadRefresh !== true) {
        _missionCargoRefreshPayloadSnapshot({ force: false, maxStations: 12, timeoutMs: 12000 })
            .then((ack) => {
                if (ack?.status === 'ok' || ack?.status === 'cached') {
                    const refreshedManifest = _missionCargoEnsureManifest();
                    _missionCargoStorePayloadBaselineIfNeeded(window.aircraftPayloadStatus?.snapshot, refreshedManifest?.key || '');
                    if (window.missionCargoStatus.payloadBaseline) {
                        window.missionCargoStatus.payloadPlan = _missionCargoBuildPlanFromManifest(refreshedManifest, window.missionCargoStatus.payloadBaseline);
                    }
                    if (document.getElementById('missionCargoOverlay')?.style.display === 'flex') {
                        _missionCargoRenderDialog(mode, { skipPayloadRefresh: true });
                    }
                }
            })
            .catch(() => {});
    }
}

window.openMissionCargoDialog = function(mode = 'load') {
    _missionCargoEnsureUiSyncHook();
    const normalizedMode = mode === 'unload' ? 'unload' : (mode === 'pickup' ? 'pickup' : 'load');
    _missionCargoRenderDialog(normalizedMode, { preserveScroll: false });
    _updateMissionRuntimeUi();
};

window.closeMissionCargoDialog = function() {
    const overlay = document.getElementById('missionCargoOverlay');
    if (overlay) overlay.style.display = 'none';
};

window.missionCargoLoadItem = function(itemId, options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const item = manifest.items.find(entry => entry.id === itemId);
    if (!item || item.status === 'loaded') return false;
    if (!options.skipAnimation && item.pickupLocation === 'target' && _missionCargoIsPassengerItem(item)) {
        _missionBushPickupBoarding(item, { reason: 'bush-pickup-load' }).catch?.(() => {});
        return true;
    }
    if (!_missionCargoItemCanLoadAtCurrentStage(item)) {
        window.missionCargoStatus.error = item.pickupLocation === 'target'
            ? 'Dieser Pickup ist erst am Zielstrip verfuegbar.'
            : 'Dieses Item ist in der aktuellen Missionsphase noch nicht verfuegbar.';
        if (options.render !== false) _missionCargoRenderDialog(options.mode === 'pickup' ? 'pickup' : (options.mode === 'unload-reload' ? 'unload' : 'load'), { skipPayloadRefresh: true });
        return false;
    }
    if (item.status === 'dropped') {
        window.missionCargoStatus.error = 'Dieses Item wurde im Flug abgeworfen und kann nicht wieder geladen werden.';
        if (options.render !== false) _missionCargoRenderDialog(options.mode === 'unload-reload' ? 'unload' : 'load', { skipPayloadRefresh: true });
        return false;
    }
    if (item.status === 'unloaded' && !_missionCargoCanReloadUnloadedItem(item, MISSION_CARGO_RELOAD_MAX_DISTANCE_M)) {
        const dM = _missionCargoDistanceToUnloadM(item);
        window.missionCargoStatus.error = Number.isFinite(dM)
            ? `Zu weit vom entladenen Item entfernt (${Math.round(dM)} m, max ${MISSION_CARGO_RELOAD_MAX_DISTANCE_M} m).`
            : `Position fehlt: fuer Wiederladen im Umkreis von ${MISSION_CARGO_RELOAD_MAX_DISTANCE_M} m bleiben.`;
        if (options.render !== false) _missionCargoRenderDialog(options.mode === 'unload-reload' ? 'unload' : 'load', { skipPayloadRefresh: true });
        return false;
    }
    const wasUnloaded = item.status === 'unloaded';
    item.status = 'loaded';
    item.loadedAt = Date.now();
    item.unloadedAt = 0;
    item.droppedAt = 0;
    item.unloadLat = null;
    item.unloadLon = null;
    item.unloadAltFt = null;
    item.droppedLat = null;
    item.droppedLon = null;
    item.droppedAltFt = null;
    _missionCargoInvalidateDispatchSignature(manifest);
    _missionCargoPersistManifest(manifest);
    if (_missionCargoIsPassengerItem(item) && window.missionSceneStatus && typeof window.missionSceneStatus === 'object') {
        window.missionSceneStatus.personBoarded = true;
    }
    if (!window.simModeActive && window.liveTrackerConnected && !_missionCargoIsPassengerItem(item)) {
        const isTargetPickup = item.pickupLocation === 'target';
        const removeSceneId = isTargetPickup
            ? (window.missionAptArrivalSceneStatus?.sceneId || _missionAptArrivalSceneId())
            : (wasUnloaded ? _missionCargoUnloadSceneId() : _missionCargoSceneId());
        const removeKinds = isTargetPickup
            ? ['arrival_equipment_1', item.sceneKind || item.id]
            : [wasUnloaded ? `unloaded_${item.sceneKind || item.id}` : item.sceneKind];
        const commandId = window.sendTrackerCommand({
            type: 'mission_scene_object_remove',
            sceneId: removeSceneId,
            reason: isTargetPickup ? 'pickup-cargo-load' : (wasUnloaded ? 'cargo-reload' : 'cargo-load'),
            kinds: removeKinds,
            labels: [item.label, item.storyName]
        });
        window.missionCargoStatus.lastCommandAt = Date.now();
        window.missionCargoStatus.lastCommand = { type: 'mission_scene_object_remove', commandId, itemId };
    }
    _missionCargoSyncPayloadToSim(wasUnloaded ? 'cargo-reload-item' : 'cargo-load-item').catch(() => {});
    if (options.render !== false) _missionCargoRenderDialog(options.mode === 'pickup' ? 'pickup' : (options.mode === 'unload-reload' ? 'unload' : 'load'), { skipPayloadRefresh: true });
    return true;
};

window.missionCargoToggleItemLoadState = function(itemId, options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const item = manifest.items.find(entry => entry.id === itemId);
    if (!item) return false;
    if (item.status === 'unloaded') {
        return window.missionCargoLoadItem(itemId, options);
    }
    if (item.status !== 'loaded' && item.status !== 'unloaded' && item.status !== 'dropped') {
        return window.missionCargoLoadItem(itemId, options);
    }
    item.status = 'pending';
    item.loadedAt = 0;
    item.unloadedAt = 0;
    item.droppedAt = 0;
    item.unloadLat = null;
    item.unloadLon = null;
    item.unloadAltFt = null;
    item.droppedLat = null;
    item.droppedLon = null;
    item.droppedAltFt = null;
    item.healthPct = 100;
    _missionCargoInvalidateDispatchSignature(manifest);
    _missionCargoPersistManifest(manifest);
    if (!window.simModeActive && window.liveTrackerConnected && !_missionCargoIsPassengerItem(item)) {
        const pos = _missionCargoCommandBasePos();
        const hasPos = Number.isFinite(Number(pos?.lat)) && Number.isFinite(Number(pos?.lon));
        if (hasPos) {
            const placement = _missionCargoGroundSpawnPlacement(item);
            const commandId = window.sendTrackerCommand({
                type: 'mission_scene_object_spawn',
                sceneId: _missionCargoSceneId(),
                reason: 'cargo-toggle-unload',
                lat: Number(pos.lat),
                lon: Number(pos.lon),
                altFt: Number.isFinite(Number(pos.altFt)) ? Number(pos.altFt) : 0,
                hdg: Number.isFinite(Number(pos.hdg)) ? Number(pos.hdg) : 0,
                items: [{
                    kind: item.sceneKind || `cargo_${item.id}`,
                    label: item.storyName || item.label || item.id,
                    objectTitle: item.objectTitle || 'Cardboard',
                    titleCandidates: item.titleCandidates || _sceneAssetCandidates(item.objectTitle || 'Cardboard', MISSION_SCENE_ASSET_POOLS.cargo),
                    forwardM: placement.forwardM,
                    rightM: placement.rightM,
                    headingMode: 'with_aircraft',
                    altOffsetFt: placement.altOffsetFt
                }]
            });
            window.missionCargoStatus.lastCommandAt = Date.now();
            window.missionCargoStatus.lastCommand = { type: 'mission_scene_object_spawn', commandId, itemId };
        } else {
            window.missionCargoStatus.error = 'Keine gueltige Sim-Position fuer Cargo-Spawn.';
        }
    }
    _missionCargoSyncPayloadToSim('cargo-toggle-unload-item').catch(() => {});
    if (options.render !== false) _missionCargoRenderDialog('load', { skipPayloadRefresh: true });
    return true;
};

function _missionCargoIsAirborneNow() {
    const fd = window.lastLiveFlightData || {};
    if (typeof fd.onGround === 'boolean') return !fd.onGround;
    const agl = Number(fd.aglFt);
    const gs = Number(fd.gsKts ?? fd.gs ?? window.lastLiveGpsPos?.gs ?? 0);
    return (Number.isFinite(agl) && agl > 80) || (missionRuntime.active && Number.isFinite(gs) && gs > 35);
}

function _missionCargoRemoveLoadedSceneObjects(reason = 'cargo-loaded-sync') {
    if (window.simModeActive || !window.liveTrackerConnected) return false;
    const manifest = _missionCargoEnsureManifest();
    const sceneId = _missionCargoSceneId();
    let sent = false;
    manifest.items
        .filter(item => item.status === 'loaded' || item.status === 'unloaded')
        .forEach(item => {
            sent = !!window.sendTrackerCommand({
                type: 'mission_scene_object_remove',
                sceneId,
                reason,
                kinds: [item.sceneKind],
                labels: [item.label, item.storyName]
            }) || sent;
        });
    return sent;
}

function _missionCargoPassengerAlreadyUnloaded() {
    return _missionCargoPassengerUnloadedItems().length > 0 && _missionCargoLoadedPassengerItems().length === 0;
}

window.missionCargoAutoLoad = function() {
    _missionCargoMarkAllLoaded({ despawn: true });
    _missionCargoRenderDialog('load');
    return true;
};

window.missionCargoUnloadItem = function(itemId, options = {}) {
    const manifest = _missionCargoEnsureManifest();
    const item = manifest.items.find(entry => entry.id === itemId);
    if (!item || item.status !== 'loaded') return false;
    if (_missionCargoIsPassengerItem(item) && !options.drop && !_missionCargoGroundHandlingAllowed()) return false;
    const dropped = options.drop === true || _missionCargoIsAirborneNow();
    if (_missionCargoIsPassengerItem(item) && dropped) return false;
    if (dropped) {
        const livePos = _missionCargoCommandBasePos();
        item.status = 'dropped';
        item.droppedAt = Date.now();
        item.droppedLat = Number.isFinite(Number(livePos?.lat)) ? Number(livePos.lat) : null;
        item.droppedLon = Number.isFinite(Number(livePos?.lon)) ? Number(livePos.lon) : null;
        item.droppedAltFt = Number.isFinite(Number(livePos?.altFt)) ? Number(livePos.altFt) : null;
        item.unloadLat = null;
        item.unloadLon = null;
        item.unloadAltFt = null;
        item.healthPct = 0;
        _missionCargoInvalidateDispatchSignature(manifest);
        _missionCargoPersistManifest(manifest);
        if (item.required && typeof window.triggerPaxCargoEvent === 'function') {
            try {
                window.triggerPaxCargoEvent({ type: 'dropped_required', item: JSON.parse(JSON.stringify(item)), manifest: JSON.parse(JSON.stringify(manifest)) });
            } catch (_) {}
        }
        _missionCargoSyncPayloadToSim('cargo-drop-item').catch(() => {});
        if (options.render !== false) _missionCargoRenderDialog('load', { skipPayloadRefresh: true });
        return true;
    }
    const livePos = _missionCargoCommandBasePos();
    item.status = 'unloaded';
    item.unloadedAt = Date.now();
    item.droppedAt = 0;
    item.unloadLat = Number.isFinite(Number(livePos?.lat)) ? Number(livePos.lat) : null;
    item.unloadLon = Number.isFinite(Number(livePos?.lon)) ? Number(livePos.lon) : null;
    item.unloadAltFt = Number.isFinite(Number(livePos?.altFt)) ? Number(livePos.altFt) : null;
    item.droppedLat = null;
    item.droppedLon = null;
    item.droppedAltFt = null;
    _missionCargoInvalidateDispatchSignature(manifest);
    _missionCargoPersistManifest(manifest);
    if (!window.simModeActive && window.liveTrackerConnected && !_missionCargoIsPassengerItem(item)) {
        const pos = _missionCargoCommandBasePos();
        const hasPos = Number.isFinite(Number(pos?.lat)) && Number.isFinite(Number(pos?.lon));
        if (!hasPos) {
            window.missionCargoStatus.error = 'Keine gueltige Sim-Position fuer Cargo-Spawn.';
        } else {
            // Remove stale unloaded copy first, then spawn fresh object at current cargo point.
            window.sendTrackerCommand({
                type: 'mission_scene_object_remove',
                sceneId: _missionCargoUnloadSceneId(),
                reason: 'cargo-unload-refresh-remove',
                kinds: [`unloaded_${item.sceneKind || item.id}`],
                labels: [item.label, item.storyName]
            });
        }
        if (hasPos) {
        const placement = _missionCargoGroundSpawnPlacement(item);
        const commandId = window.sendTrackerCommand({
            type: 'mission_scene_object_spawn',
            sceneId: _missionCargoUnloadSceneId(),
            reason: 'cargo-unload',
            lat: Number(pos.lat),
            lon: Number(pos.lon),
            altFt: Number.isFinite(Number(pos.altFt)) ? Number(pos.altFt) : 0,
            hdg: Number.isFinite(Number(pos.hdg)) ? Number(pos.hdg) : 0,
            items: [{
                kind: `unloaded_${item.sceneKind || item.id}`,
                label: item.storyName || item.label,
                objectTitle: item.objectTitle || 'Cardboard',
                titleCandidates: item.titleCandidates || _sceneAssetCandidates(item.objectTitle || 'Cardboard', MISSION_SCENE_ASSET_POOLS.cargo),
                forwardM: placement.forwardM,
                rightM: placement.rightM,
                headingMode: 'with_aircraft',
                altOffsetFt: placement.altOffsetFt
            }]
        });
        window.missionCargoStatus.lastCommandAt = Date.now();
        window.missionCargoStatus.lastCommand = { type: 'mission_scene_object_spawn', commandId, itemId };
        }
    }
    _missionCargoSyncPayloadToSim('cargo-unload-item').catch(() => {});
    if (options.render !== false) _missionCargoRenderDialog('unload', { skipPayloadRefresh: true });
    return true;
};

window.missionCargoSetBoardBookTime = function(itemId, field) {
    const manifest = _missionCargoEnsureManifest();
    const item = manifest.items.find(entry => entry.id === itemId);
    if (!item || !/bordbuch/i.test(`${item.id} ${item.label} ${item.storyName}`)) return false;
    const key = field === 'landing' ? 'landingTime' : 'startTime';
    item.log = item.log && typeof item.log === 'object' ? item.log : {};
    item.log[key] = new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    _missionCargoPersistManifest(manifest);
    return true;
};

window.finishMissionCargoLoadingAndStart = function() {
    _missionPhaseDebugPush('trigger', { name: 'finishMissionCargoLoadingAndStart' });
    const manifest = _missionCargoEnsureManifest();
    if (!manifest.dispatchSignature) {
        window.missionCargoSignDispatchList?.();
        return false;
    }
    if (Number(window.missionCargoStatus?.signatureAnimationEndsAt || 0) > Date.now()) {
        _missionCargoRenderDialog('load', { skipPayloadRefresh: true });
        return false;
    }
    window.missionCargoStatus.loadConfirmed = true;
    _missionCargoSyncPayloadToSim('cargo-finish-loading').catch(() => {});
    window.closeMissionCargoDialog?.();
    if (!_missionCargoMaybePromoteStartReady('cargo-finish-loading')) {
        _missionCargoScheduleStartReadyPromotion('cargo-finish-loading');
    }
    _updateMissionRuntimeUi();
    return true;
};

window.finishMissionCargoPickupAndContinue = function() {
    if (!_missionBushIsPickupMission()) return false;
    _missionPhaseDebugPush('trigger', { name: 'finishMissionCargoPickupAndContinue' });
    const manifest = _missionCargoEnsureManifest();
    const pickupItem = _missionBushPickupItem(manifest);
    if (!pickupItem || (pickupItem.status !== 'loaded' && pickupItem.status !== 'unloaded')) return false;
    const progress = _activeBushMissionProgress();
    if (progress) {
        _persistBushMissionProgress({
            ...progress,
            pickupReady: false,
            pickupCompleted: true,
            pickupConfirmed: true,
            targetReached: true,
            status: 'return_leg'
        });
    }
    const bush = _activeBushMissionSpec();
    if (_missionBushIsPickupPassengerMission() && !window.activePassenger) {
        const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
        const passenger = md?.passenger || md?.missionContract?.passenger || window.activeMissionContract?.passenger || null;
        if (passenger && typeof passenger === 'object') {
            window.activePassenger = { ...passenger };
            try { localStorage.setItem('ga_active_passenger', JSON.stringify(window.activePassenger)); } catch (_) {}
            try { window.paxVoiceRefreshWidget?.(); } catch (_) {}
        }
    }
    if (window.simModeActive && typeof window.resumeSimMissionAfterPickup === 'function') {
        try { window.resumeSimMissionAfterPickup(); } catch (_) {}
    }
    if (typeof window.triggerPaxGreeting === 'function' && bush?.pickupGreetingText) {
        try {
            window.triggerPaxGreeting(window.lastLiveGpsPos?.lat, window.lastLiveGpsPos?.lon, {
                overrideText: String(bush.pickupGreetingText || '').trim()
            });
        } catch (_) {}
    }
    if (bush?.requiresReturnHome && bush?.homeRef) {
        const pos = window.lastLiveGpsPos || {};
        const homeLat = Number(bush.homeRef.lat);
        const homeLon = Number(bush.homeRef.lon);
        const curLat = Number(pos.lat);
        const curLon = Number(pos.lon);
        if (Number.isFinite(homeLat) && Number.isFinite(homeLon) && Number.isFinite(curLat) && Number.isFinite(curLon)) {
            routeWaypoints = [
                { lat: curLat, lng: curLon, name: 'Pickup RTB' },
                { lat: homeLat, lng: homeLon, name: String(bush.homeRef.name || bush.homeRef.icao || 'Home') }
            ];
            if (typeof currentDestICAO !== 'undefined') currentDestICAO = String(bush.homeRef.icao || currentStartICAO || '').trim().toUpperCase();
            if (typeof currentDName !== 'undefined') currentDName = String(bush.homeRef.name || bush.homeRef.icao || 'Home').trim();
            window._missionRouteWaypoints = JSON.parse(JSON.stringify(routeWaypoints));
            if (typeof currentMissionData !== 'undefined' && currentMissionData) {
                currentMissionData.routeWaypoints = JSON.parse(JSON.stringify(routeWaypoints));
                currentMissionData.missionRouteWaypoints = JSON.parse(JSON.stringify(routeWaypoints));
                currentMissionData.dest = String(bush.homeRef.icao || currentMissionData.dest || '').trim().toUpperCase();
                const nav = (typeof calcNav === 'function') ? calcNav(curLat, curLon, homeLat, homeLon) : null;
                if (nav) {
                    currentMissionData.dist = Number(nav.dist) || currentMissionData.dist;
                    currentMissionData.heading = Number(nav.brng) || currentMissionData.heading;
                }
            }
            try { renderMainRoute?.(); } catch (_) {}
            try { fitMapToRouteWaypoints?.([60, 60]); } catch (_) {}
            try { updateMiniMap?.(); } catch (_) {}
            try { refreshGPSAfterDispatch?.(); } catch (_) {}
            try { window.debouncedSaveMissionState?.(); } catch (_) {}
        }
    }
    if (typeof window.missionAptArrivalClear === 'function') {
        try { window.missionAptArrivalClear('bush-pickup-complete'); } catch (_) {}
    }
    window.closeMissionCargoDialog?.();
    _updateMissionRuntimeUi();
    return true;
};

window.finishMissionCargoUnloadAndEnd = function() {
    _missionPhaseDebugPush('trigger', { name: 'finishMissionCargoUnloadAndEnd' });
    window.closeMissionCargoDialog?.();
    if (!_missionRuntimeGroundEndReady()) {
        _updateMissionRuntimeUi();
        return true;
    }
    if (window.simModeActive && typeof window.completeSimMissionEnd === 'function') {
        return window.completeSimMissionEnd();
    }
    window.manualMissionEnd({ skipCargoUnload: true });
};

function _missionSceneVehicleAsset() {
    const taskDomain = _missionSceneTaskDomain();
    if (taskDomain === 'fire_watch') {
        const pool = MISSION_SCENE_ASSET_POOLS.fireVehicles;
        const allowed = pool.concat([
            'Car Bush Firefighting',
            'Car Bush Firefighting (FIREFIGHTING_DEFAULT)',
            'FIREFIGHTING_DEFAULT',
            'Car_Bush_Firefighting'
        ]);
        const title = _sceneObjectTitleOverride('vehicle', _scenePreferredTitle(pool, MISSION_SCENE_DEFAULT_VEHICLE_TITLE, 'vehicle-fire', MISSION_SCENE_DEFAULT_VEHICLE_TITLE), allowed);
        return {
            title,
            candidates: _sceneTitleCandidates(title, _sceneAssetCandidates(title, [
                ...allowed
            ]))
        };
    }
    if (taskDomain === 'search_and_rescue' || taskDomain === 'medical_transfer') {
        const fallbackPool = _missionSceneFilteredVehiclePool(MISSION_SCENE_ASSET_POOLS.vans.concat(MISSION_SCENE_ASSET_POOLS.quads, MISSION_SCENE_ASSET_POOLS.vehicles));
        const pool = MISSION_SCENE_ASSET_POOLS.medicalVehicles.length
            ? MISSION_SCENE_ASSET_POOLS.medicalVehicles
            : fallbackPool;
        const title = _sceneObjectTitleOverride('vehicle', _scenePickTitle(pool, 'vehicle-sar-medical', pool[0] || fallbackPool[0] || 'Microsoft_Van_EUR'), pool.concat(fallbackPool));
        return {
            title,
            candidates: _sceneAssetCandidates(title, pool.concat(fallbackPool))
        };
    }
    const rawWorkVehiclePool = /(cargo|freight|club_utility|animal_transport)/.test(taskDomain)
        ? MISSION_SCENE_ASSET_POOLS.vans.concat(MISSION_SCENE_ASSET_POOLS.trucks, MISSION_SCENE_ASSET_POOLS.vehicles)
        : MISSION_SCENE_ASSET_POOLS.vehicles;
    const workVehiclePool = _missionSceneFilteredVehiclePool(rawWorkVehiclePool);
    const preferred = _sceneObjectTitleOverride('vehicle', _scenePickTitle(workVehiclePool, `vehicle-${taskDomain}`, workVehiclePool[0] || MISSION_SCENE_DEFAULT_VEHICLE_TITLE), workVehiclePool);
    return {
        title: preferred,
        candidates: _sceneAssetCandidates(preferred, workVehiclePool)
    };
}

function _missionScenePassengerGender() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const raw = String(window.activePassenger?.gender || md?.passenger?.gender || md?.missionContract?.passenger?.gender || '').toLowerCase();
    if (raw === 'male' || raw === 'female') return raw;
    const roleText = String(`${window.activePassenger?.role || ''} ${md?.paxText || ''} ${document.getElementById('mPay')?.innerText || ''}`).toLowerCase();
    if (/(frau|female|reporterin|fotografin|biologin|geologin|historikerin|koordinatorin|beobachterin|instruktorin|passagierin)/i.test(roleText)) return 'female';
    return 'male';
}

function _missionScenePersonTitle(gender = 'female', salt = 'person') {
    const normalizedGender = String(gender || '').toLowerCase() === 'male' ? 'male' : 'female';
    const pool = normalizedGender === 'male'
        ? MISSION_SCENE_ASSET_POOLS.peopleMale.concat(MISSION_SCENE_ASSET_POOLS.peopleFemale)
        : MISSION_SCENE_ASSET_POOLS.peopleFemale;
    const fallback = normalizedGender === 'male' ? MISSION_SCENE_DEFAULT_PERSON_MALE_TITLE : MISSION_SCENE_DEFAULT_PERSON_TITLE;
    return _sceneObjectTitleOverride('person', _scenePickTitle(pool, `${normalizedGender}-${salt}`, fallback));
}

function _missionScenePersonCandidates(gender = 'female', preferredTitle = '') {
    const normalizedGender = String(gender || '').toLowerCase() === 'male' ? 'male' : 'female';
    const preferred = preferredTitle || _missionScenePersonTitle(normalizedGender, 'candidate');
    const pool = normalizedGender === 'male'
        ? MISSION_SCENE_ASSET_POOLS.peopleMale.concat(MISSION_SCENE_ASSET_POOLS.peopleFemale)
        : MISSION_SCENE_ASSET_POOLS.peopleFemale;
    const female = [
        preferred,
        MISSION_SCENE_DEFAULT_PERSON_TITLE,
        'Termac_Female_Summer_Asian',
        'Tarmac_Female_Summer_Asian',
        ...pool
    ];
    const male = [
        preferredTitle && /male/i.test(preferredTitle) ? preferredTitle : MISSION_SCENE_DEFAULT_PERSON_MALE_TITLE,
        MISSION_SCENE_DEFAULT_PERSON_MALE_TITLE,
        'Termac_Male_Summer_Asian',
        'Tarmac_Male_Summer_Caucasian',
        'Tarmac_Male_Summer_Black',
        MISSION_SCENE_DEFAULT_PERSON_TITLE,
        'Termac_Female_Summer_Asian',
        ...pool
    ];
    return _sceneTitleCandidates(preferred, normalizedGender === 'male' ? male : female);
}

function _missionSceneHeadingOffsetBetween(fromPoint, toPoint, fallbackDeg = 0) {
    const forwardDelta = Number(toPoint?.forwardM) - Number(fromPoint?.forwardM);
    const rightDelta = Number(toPoint?.rightM) - Number(fromPoint?.rightM);
    if (!Number.isFinite(forwardDelta) || !Number.isFinite(rightDelta) || (Math.abs(forwardDelta) < 0.01 && Math.abs(rightDelta) < 0.01)) {
        return fallbackDeg;
    }
    return Math.round(Math.atan2(rightDelta, forwardDelta) * 180 / Math.PI);
}

function _missionSceneVehiclePoint() {
    return { forwardM: 22, rightM: -12, altOffsetFt: 0 };
}

function _missionSceneVehicleDeparturePath() {
    return [
        _missionSceneVehiclePoint(),
        { forwardM: 10, rightM: -18, altOffsetFt: 0 },
        { forwardM: -8, rightM: -18, altOffsetFt: 0 },
        { forwardM: -22, rightM: -14, altOffsetFt: 0 }
    ];
}

function _missionSceneIsPoiMission() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (md?.isPOI === true) return true;
    if (String(md?.dest || '').toUpperCase() === 'POI') return true;
    if (String(typeof currentDestICAO !== 'undefined' ? currentDestICAO : '').toUpperCase() === 'POI') return true;
    return false;
}

function _activeMissionContractRuntime() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    return md?.missionContract || window.activeMissionContract || null;
}

function _missionSceneIsBushMission() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const contract = _activeMissionContractRuntime();
    return String(md?.missionType || contract?.missionType || '').toLowerCase() === 'bush'
        || !!(md?.bush && typeof md.bush === 'object')
        || !!(contract?.bush && typeof contract.bush === 'object');
}

function _activeBushMissionSpec() {
    if (!_missionSceneIsBushMission()) return null;
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const contract = _activeMissionContractRuntime();
    const spec = md?.bush || contract?.bush || null;
    return spec && typeof spec === 'object' ? spec : null;
}

function _missionSceneVehicleSupportEnabled() {
    try {
        const raw = String(localStorage.getItem('ga_scene_apt_vehicle_enabled') || '').trim().toLowerCase();
        if (/^(1|true|yes|ja|on)$/.test(raw)) return true;
        if (/^(0|false|no|nein|off)$/.test(raw)) return false;
    } catch (_) {}
    const taskDomain = _missionSceneTaskDomain();
    if (/^(medical_transfer|search_and_rescue|cargo|news_coverage|animal_transport|survey|fire_watch)$/.test(taskDomain)) return true;
    if (/(club_utility|inspection|mapping|science|freight|fracht|cargo|medical|sar|rescue|rettung|news|media|animal|tier)/.test(taskDomain)) return true;
    return false;
}

function _missionSceneCommonSceneCommandFields() {
    const boardingConfig = _missionSceneBoardingConfig();
    const vehicleSupportEnabled = _missionSceneVehicleSupportEnabled();
    const fields = {
        profile: 'app_preset',
        path: Array.isArray(boardingConfig.path) && boardingConfig.path.length >= 2 ? boardingConfig.path : [boardingConfig.spawn, boardingConfig.target],
        cargoPathIndex: Number.isFinite(Number(boardingConfig.cargoIndex)) ? Number(boardingConfig.cargoIndex) : 1,
        spawnPoint: boardingConfig.spawn,
        targetPoint: boardingConfig.target,
        aircraftSlot: boardingConfig.aircraftSlot || window.selectedAC || '',
        aircraftName: boardingConfig.aircraftName || '',
        boarderCount: _missionSceneBoarderCount(),
        passengerCount: _missionScenePaxCount(),
        vehicleDeparture: vehicleSupportEnabled,
        vehicleArrival: vehicleSupportEnabled,
        splitCargoRoute: false,
        cargoArrivalSlackMs: 250,
        cargoTimingFactor: 1,
        cargoRestartDelayMs: 0,
        cargoRestartSpeedKts: 2.1,
        walkSpeedKts: Number.isFinite(Number(boardingConfig.walkSpeedKts)) ? Number(boardingConfig.walkSpeedKts) : 3.3,
        openDoor: boardingConfig.openDoor !== false,
        doorProfile: boardingConfig.doorProfile || 'default',
        doorIndex: 1
    };
    if (vehicleSupportEnabled) {
        fields.vehiclePoint = _missionSceneVehiclePoint();
        fields.vehicleDeparturePath = _missionSceneVehicleDeparturePath();
        fields.vehicleReturnPath = _missionSceneVehicleDeparturePath().slice().reverse();
        fields.vehicleSpeedKts = 7;
        fields.vehicleBoardDelayMs = 2800;
    } else {
        fields.deboardingWalkOffPath = _missionSceneVehicleDeparturePath();
    }
    return fields;
}

window.missionSceneSpawn = function(reason = 'scene-debug-spawn') {
    const pos = window.lastLiveGpsPos || {};
    const gate = _missionSceneFlightGate(window.lastLiveFlightData || {});
    const debugReason = String(reason || '').includes('debug');
    if (!gate.rawHasPosition || !gate.plausiblePosition || !gate.nearDeparture) {
        window.missionSceneStatus.blockReason = !gate.rawHasPosition ? 'no_live_position' : (!gate.plausiblePosition ? 'bad_live_position' : `away_from_start_${Math.round(Number(gate.depDistNm || 0))}nm`);
        if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
        return false;
    }
    if (!debugReason && !gate.canStage) {
        window.missionSceneStatus.blockReason = gate.paused || gate.inMenuOrMap ? 'sim_paused_or_menu'
            : (!gate.groundLike ? 'not_on_ground'
                : (!gate.lowGround ? 'agl_too_high'
                    : (!gate.stationary ? 'too_fast_for_stage' : 'scene_gate_closed')));
        if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
        return false;
    }
    const sceneId = _missionSceneId();
    const vehicleSupportEnabled = _missionSceneVehicleSupportEnabled();
    const vehicleAsset = vehicleSupportEnabled ? _missionSceneVehicleAsset() : null;
    const vehicleTitle = vehicleAsset?.title || '';
    const cargoAsset = _missionSceneCargoAsset();
    const boardingConfig = _missionSceneBoardingConfig();
    const personSpawn = boardingConfig.spawn || { forwardM: 16, rightM: -8, altOffsetFt: 0 };
    const cargoPoint = boardingConfig.cargo || { forwardM: 4, rightM: 4, altOffsetFt: 0 };
    const cargoItems = _missionSceneCargoItems(cargoPoint, cargoAsset);
    const vehiclePoint = vehicleSupportEnabled ? _missionSceneVehiclePoint() : null;
    const boarderCount = _missionSceneBoarderCount();
    const primaryGender = _missionScenePassengerGender();
    const secondaryGender = primaryGender === 'male' ? 'female' : 'male';
    const primaryPersonTitle = _missionScenePersonTitle(primaryGender, 'boarding-primary');
    const secondaryPersonTitle = _missionScenePersonTitle(secondaryGender, 'boarding-secondary');
    const idlePersonTitle = _missionScenePersonTitle(primaryGender, 'vehicle-idle');
    const vehicleCrewOne = { forwardM: 19.5, rightM: -14 };
    const vehicleCrewTwo = { forwardM: 19, rightM: -11.5 };
    const personItems = vehicleSupportEnabled ? [
        ...(boarderCount > 0 ? [{
            kind: 'person_boarder_1',
            label: 'Boarding Pax 1',
            objectTitle: primaryPersonTitle,
            titleCandidates: _missionScenePersonCandidates(primaryGender, primaryPersonTitle),
            forwardM: Number.isFinite(Number(personSpawn.forwardM)) ? Number(personSpawn.forwardM) : 16,
            rightM: Number.isFinite(Number(personSpawn.rightM)) ? Number(personSpawn.rightM) : -8,
            headingMode: 'face_aircraft',
            altOffsetFt: Number.isFinite(Number(personSpawn.altOffsetFt)) ? Number(personSpawn.altOffsetFt) : 0
        }] : []),
        {
            kind: boarderCount >= 2 ? 'person_boarder_2' : 'person_idle_1',
            label: boarderCount >= 2 ? 'Boarding Pax 2' : 'Crew Fahrzeug 1',
            objectTitle: secondaryPersonTitle,
            titleCandidates: _missionScenePersonCandidates(secondaryGender, secondaryPersonTitle),
            forwardM: vehicleCrewOne.forwardM,
            rightM: vehicleCrewOne.rightM,
            headingMode: 'with_aircraft',
            hdgOffsetDeg: _missionSceneHeadingOffsetBetween(vehicleCrewOne, vehicleCrewTwo, 70),
            altOffsetFt: 0
        },
        {
            kind: 'person_idle_2',
            label: 'Crew Fahrzeug 2',
            objectTitle: idlePersonTitle,
            titleCandidates: _missionScenePersonCandidates(primaryGender, idlePersonTitle),
            forwardM: vehicleCrewTwo.forwardM,
            rightM: vehicleCrewTwo.rightM,
            headingMode: 'with_aircraft',
            hdgOffsetDeg: _missionSceneHeadingOffsetBetween(vehicleCrewTwo, vehicleCrewOne, 250),
            altOffsetFt: 0
        }
    ] : Array.from({ length: boarderCount }, (_, idx) => {
        const gender = idx % 2 === 0 ? primaryGender : secondaryGender;
        const title = idx % 2 === 0 ? primaryPersonTitle : secondaryPersonTitle;
        return {
            kind: `person_boarder_${idx + 1}`,
            label: `Boarding Pax ${idx + 1}`,
            objectTitle: title,
            titleCandidates: _missionScenePersonCandidates(gender, title),
            forwardM: (Number.isFinite(Number(personSpawn.forwardM)) ? Number(personSpawn.forwardM) : 16),
            rightM: (Number.isFinite(Number(personSpawn.rightM)) ? Number(personSpawn.rightM) : -8) + (idx * 0.8),
            headingMode: 'face_aircraft',
            altOffsetFt: Number.isFinite(Number(personSpawn.altOffsetFt)) ? Number(personSpawn.altOffsetFt) : 0
        };
    });
    const sceneItems = [];
    if (vehicleSupportEnabled && vehicleAsset && vehiclePoint) {
        const taskDomain = _missionSceneTaskDomain();
        const vehicleLabel = taskDomain === 'fire_watch'
            ? 'Feuerwehrfahrzeug'
            : (taskDomain === 'medical_transfer'
                ? 'Medizinisches Bringfahrzeug'
                : (taskDomain === 'search_and_rescue'
                    ? 'Rettungsfahrzeug'
                    : (taskDomain === 'cargo' ? 'Frachtfahrzeug' : 'Szenenfahrzeug')));
        sceneItems.push({
            kind: 'vehicle',
            label: vehicleLabel,
            objectTitle: vehicleTitle,
            titleCandidates: vehicleAsset.candidates,
            forwardM: vehiclePoint.forwardM,
            rightM: vehiclePoint.rightM,
            headingMode: 'face_aircraft',
            altOffsetFt: 0
        });
    }
    const commandId = window.sendTrackerCommand({
        type: 'mission_scene_spawn',
        sceneId,
        reason,
        lat: Number(pos.lat),
        lon: Number(pos.lon),
        altFt: Number.isFinite(Number(pos.alt)) ? Number(pos.alt) : 0,
        hdg: Number.isFinite(Number(pos.hdg)) ? Number(pos.hdg) : 0,
        boarderCount,
        passengerCount: _missionScenePaxCount(),
        vehicleDeparture: vehicleSupportEnabled,
        vehicleArrival: vehicleSupportEnabled,
        items: sceneItems.concat(cargoItems, personItems)
    });
    if (!commandId) return false;
    window.missionSceneStatus.sceneId = sceneId;
    window.missionSceneStatus.lastCommandAt = Date.now();
    window.missionSceneStatus.lastCommand = { type: 'mission_scene_spawn', commandId, reason };
    window.missionSceneStatus.spawnRequested = true;
    window.missionSceneStatus.clearRequested = false;
    window.missionSceneStatus.spawned = false;
    window.missionSceneStatus.error = null;
    window.missionSceneStatus.blockReason = '';
    if (String(reason || '').includes('auto') || reason === 'gps-tick') {
        window.missionSceneStatus.autoSpawnedFor = sceneId;
    }
    if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
    return true;
};

window.missionSceneClear = function(reason = 'scene-debug-clear', sceneIdOverride = null) {
    const sceneId = sceneIdOverride ? String(sceneIdOverride) : (window.missionSceneStatus?.sceneId || _missionSceneId());
    const commandId = window.sendTrackerCommand({
        type: 'mission_scene_clear',
        sceneId,
        reason
    });
    if (!commandId) return false;
    window.missionSceneStatus.sceneId = sceneId;
    window.missionSceneStatus.lastCommandAt = Date.now();
    window.missionSceneStatus.lastCommand = { type: 'mission_scene_clear', commandId, reason };
    window.missionSceneStatus.clearRequested = true;
    if (reason === 'manual-mission-end') {
        window.missionSceneStatus.autoClearedFor = sceneId;
    }
    if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
    return true;
};

window.clearMissionSceneObjects = function(reason = 'mission-scene-reset') {
    const markerSceneId = _boardingMarkerSceneId();
    const targetSceneId = _missionTargetSceneId();
    const aptArrivalSceneId = _missionAptArrivalSceneId();
    const cargoUnloadSceneId = _missionCargoUnloadSceneId();
    let sent = false;
    sent = !!window.sendTrackerCommand({
        type: 'mission_scene_clear_all',
        reason
    }) || sent;
    const ids = _knownMissionSceneIds(
        window.missionSceneStatus?.sceneId,
        window.missionTargetSceneStatus?.sceneId,
        window.missionAptArrivalSceneStatus?.sceneId,
        _missionSceneId(),
        markerSceneId,
        targetSceneId,
        aptArrivalSceneId,
        cargoUnloadSceneId
    );
    ids.forEach(sceneId => {
        sent = !!window.sendTrackerCommand({
            type: 'mission_scene_clear',
            sceneId,
            reason
        }) || sent;
    });
    if (typeof window.missionSmokeClear === 'function') {
        try { sent = !!window.missionSmokeClear(`${reason}-smoke`) || sent; } catch (_) {}
    }
    if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
    return sent;
};

function _missionTargetSceneId() {
    return `${_missionSceneId()}-target`;
}

function _missionTruthPoint(prefer = 'mainTarget') {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const truth = md?.missionTruth || md?.missionContract?.missionTruth || window.activeMissionContract?.missionTruth || null;
    if (!truth || typeof truth !== 'object') return null;
    const order = Array.isArray(prefer) ? prefer : [prefer];
    for (const key of order) {
        const p = truth?.[key];
        const lat = Number(p?.lat);
        const lon = Number(p?.lon);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
            return {
                lat,
                lon,
                name: String(p?.name || truth?.pickedPoi?.name || md?.poiName || 'POI'),
                kind: String(p?.kind || key),
                reason: String(p?.reason || '')
            };
        }
    }
    return null;
}

function _missionTruthData() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const truth = md?.missionTruth || md?.missionContract?.missionTruth || window.activeMissionContract?.missionTruth || null;
    return truth && typeof truth === 'object' ? truth : null;
}

function _missionTargetSceneSpec() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const spec = md?.targetScene || md?.poiScene || md?.missionContract?.targetScene || window.activeMissionContract?.targetScene || null;
    return spec && typeof spec === 'object' ? spec : null;
}

function _missionTargetSceneIsBridgeTarget() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const spec = _missionTargetSceneSpec();
    const truth = _missionTruthData();
    return String(spec?.kind || spec?.type || '').toLowerCase() === 'infra_bridge'
        || String(md?.requestedCategory || md?.poiCategory || '').toLowerCase() === 'bridge'
        || String(truth?.requestedCategory || truth?.poiCategory || '').toLowerCase() === 'bridge';
}

function _missionTargetGeoContext() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const ctx = md?.targetGeoContext || md?.missionContract?.targetGeoContext || window.activeMissionContract?.targetGeoContext || null;
    return ctx && typeof ctx === 'object' ? ctx : null;
}

function _missionTargetGeoAnchor(names = []) {
    const ctx = _missionTargetGeoContext();
    const anchors = ctx?.anchors && typeof ctx.anchors === 'object' ? ctx.anchors : null;
    if (!anchors) return null;
    const list = Array.isArray(names) ? names : [names];
    for (const name of list) {
        const anchor = anchors[String(name || '')];
        if (anchor && anchor.present && Number.isFinite(Number(anchor.bearingDeg))) return anchor;
    }
    return null;
}

function _missionTargetGeoOffset(names, fallbackF, fallbackR, options = {}) {
    const point = _missionTargetScenePoint();
    const anchor = _missionTargetGeoAnchor(names);
    if (!point || !anchor) return { f: fallbackF, r: fallbackR, hdg: Number(options.hdgOffsetDeg ?? 0), anchored: false };
    const maxM = Number.isFinite(Number(options.maxM)) ? Number(options.maxM) : 130;
    const minM = Number.isFinite(Number(options.minM)) ? Number(options.minM) : 18;
    const preferredM = Number(options.distanceM);
    const rawDist = Number.isFinite(preferredM) ? preferredM : Number(anchor.distM || 0);
    const distM = Math.max(minM, Math.min(maxM, Number.isFinite(rawDist) ? rawDist : Math.max(minM, Math.hypot(Number(fallbackF) || 0, Number(fallbackR) || 0))));
    const deltaRad = ((Number(anchor.bearingDeg) - Number(point.hdg || 0)) * Math.PI) / 180;
    let f = Math.cos(deltaRad) * distM;
    let r = Math.sin(deltaRad) * distM;
    const lateral = Number(options.lateralM || 0);
    if (Number.isFinite(lateral) && lateral !== 0) {
        f += Math.cos(deltaRad + Math.PI / 2) * lateral;
        r += Math.sin(deltaRad + Math.PI / 2) * lateral;
    }
    return {
        f: Math.round(f),
        r: Math.round(r),
        hdg: Number.isFinite(Number(options.hdgOffsetDeg)) ? Number(options.hdgOffsetDeg) : Math.round(Number(anchor.bearingDeg) - Number(point.hdg || 0)),
        anchored: true,
        anchor
    };
}

function _missionTargetGeoAnchorDebug(pos = null, requested = []) {
    if (!pos || !pos.anchored || !pos.anchor) return null;
    const anchor = pos.anchor || {};
    return {
        requested: (Array.isArray(requested) ? requested : [requested]).map(v => String(v || '')).filter(Boolean).slice(0, 5),
        tag: String(anchor.tag || ''),
        name: String(anchor.name || '').slice(0, 80),
        distM: Number.isFinite(Number(anchor.distM)) ? Math.round(Number(anchor.distM)) : null,
        bearingDeg: Number.isFinite(Number(anchor.bearingDeg)) ? Math.round(Number(anchor.bearingDeg)) : null,
        count: Number.isFinite(Number(anchor.count)) ? Math.round(Number(anchor.count)) : null
    };
}

function _missionTargetGeoPointInPolygon(lat, lon, polygon = []) {
    const y = Number(lat);
    const x = Number(lon);
    if (!Number.isFinite(y) || !Number.isFinite(x) || !Array.isArray(polygon) || polygon.length < 4) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const yi = Number(polygon[i]?.lat);
        const xi = Number(polygon[i]?.lon);
        const yj = Number(polygon[j]?.lat);
        const xj = Number(polygon[j]?.lon);
        if (!Number.isFinite(yi) || !Number.isFinite(xi) || !Number.isFinite(yj) || !Number.isFinite(xj)) continue;
        const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi) / ((yj - yi) || 1e-12)) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function _missionTargetSceneItemWaterCompatible(kind = '', label = '', title = '') {
    const text = [kind, label, title].filter(Boolean).join(' ').toLowerCase();
    return /(water|boat|ship|raft|liferaft|fowl|goose|duck|ente|gans|wasservogel|floating|treibgut|ufer|debris|pollution|survey_boat)/.test(text);
}

function _missionTargetGeoBlockingZone(lat, lon, item = {}) {
    const ctx = _missionTargetGeoContext();
    const zones = Array.isArray(ctx?.avoidZones) ? ctx.avoidZones : [];
    if (!zones.length) return null;
    const waterOk = _missionTargetSceneItemWaterCompatible(item.kind, item.label, item.objectTitle || item.title);
    for (const zone of zones) {
        const type = String(zone?.type || '').toLowerCase();
        if (type !== 'building' && type !== 'water') continue;
        if (type === 'water' && waterOk) continue;
        if (_missionTargetGeoPointInPolygon(lat, lon, zone.polygon)) return zone;
    }
    return null;
}

function _missionTargetGeoZones(type = '') {
    const ctx = _missionTargetGeoContext();
    const wanted = String(type || '').toLowerCase();
    return (Array.isArray(ctx?.avoidZones) ? ctx.avoidZones : [])
        .filter(zone => String(zone?.type || '').toLowerCase() === wanted);
}

function _missionTargetGeoContainingZone(lat, lon, type = '') {
    return _missionTargetGeoZones(type).find(zone => _missionTargetGeoPointInPolygon(lat, lon, zone.polygon)) || null;
}

function _missionTargetGeoLocalShift(absBearingDeg, distanceM, pointHdgDeg) {
    const deltaRad = ((Number(absBearingDeg) - Number(pointHdgDeg || 0)) * Math.PI) / 180;
    return {
        f: Math.cos(deltaRad) * Number(distanceM || 0),
        r: Math.sin(deltaRad) * Number(distanceM || 0)
    };
}

function _missionTargetGeoPreciseNav(lat1, lon1, lat2, lon2) {
    const aLat = Number(lat1), aLon = Number(lon1), bLat = Number(lat2), bLon = Number(lon2);
    if (![aLat, aLon, bLat, bLon].every(Number.isFinite)) return null;
    const phi1 = aLat * Math.PI / 180;
    const phi2 = bLat * Math.PI / 180;
    const dPhi = (bLat - aLat) * Math.PI / 180;
    const dLam = (bLon - aLon) * Math.PI / 180;
    const h = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) ** 2;
    const distM = 2 * 6371000 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
    const y = Math.sin(dLam) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLam);
    return {
        distM,
        brng: (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
    };
}

function _missionTargetGeoLocalOffsetTo(lat, lon, point) {
    if (!point || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;
    const nav = _missionTargetGeoPreciseNav(point.lat, point.lon, Number(lat), Number(lon));
    const distM = Number(nav?.distM);
    const brng = Number(nav?.brng);
    if (!Number.isFinite(distM) || !Number.isFinite(brng)) return null;
    return _missionTargetGeoLocalShift(brng, distM, point.hdg);
}

function _missionTargetGeoSnapWaterOffset(point, baseF, baseR, itemInfo = {}) {
    const waterZones = _missionTargetGeoZones('water');
    if (!point || !waterZones.length) return null;
    const ll = _missionSceneOffsetToLatLon(point.lat, point.lon, point.hdg, baseF, baseR);
    if (ll && _missionTargetGeoContainingZone(ll.lat, ll.lon, 'water')) return null;
    let nearest = null;
    let nearestM = Infinity;
    for (const zone of waterZones) {
        const centerLat = Number(zone?.center?.lat);
        const centerLon = Number(zone?.center?.lon);
        if (!Number.isFinite(centerLat) || !Number.isFinite(centerLon)) continue;
        let nav = null;
        try {
            nav = ll
                ? _missionTargetGeoPreciseNav(ll.lat, ll.lon, centerLat, centerLon)
                : _missionTargetGeoPreciseNav(point.lat, point.lon, centerLat, centerLon);
        } catch (_) {}
        const dM = Number(nav?.distM);
        if (!Number.isFinite(dM) || dM >= nearestM) continue;
        nearest = zone;
        nearestM = dM;
    }
    if (!nearest) return null;
    const centerOffset = _missionTargetGeoLocalOffsetTo(nearest.center?.lat, nearest.center?.lon, point);
    if (!centerOffset) return null;
    const nudges = [
        { f: 0, r: 0 },
        { f: 10, r: 0 },
        { f: -10, r: 0 },
        { f: 0, r: 10 },
        { f: 0, r: -10 },
        { f: 14, r: 8 },
        { f: -14, r: -8 }
    ];
    for (const nudge of nudges) {
        const f = centerOffset.f + nudge.f;
        const r = centerOffset.r + nudge.r;
        const test = _missionSceneOffsetToLatLon(point.lat, point.lon, point.hdg, f, r);
        if (!test || !_missionTargetGeoContainingZone(test.lat, test.lon, 'water')) continue;
        const blocking = _missionTargetGeoBlockingZone(test.lat, test.lon, itemInfo);
        if (blocking && String(blocking.type || '').toLowerCase() !== 'water') continue;
        return { forwardM: Math.round(f), rightM: Math.round(r), adjusted: true, zone: 'water' };
    }
    return null;
}

function _missionTargetGeoResolveWorldOffset(kind, label, title, forwardM, rightM) {
    const point = _missionTargetScenePoint();
    const baseF = Number(forwardM) || 0;
    const baseR = Number(rightM) || 0;
    if (!point) return { forwardM: baseF, rightM: baseR, adjusted: false };
    const itemInfo = { kind, label, objectTitle: title };
    if (_missionTargetSceneItemWaterCompatible(kind, label, title)) {
        const waterSnap = _missionTargetGeoSnapWaterOffset(point, baseF, baseR, itemInfo);
        if (waterSnap) return waterSnap;
    }
    let f = baseF;
    let r = baseR;
    let lastZone = null;
    for (let attempt = 0; attempt < 5; attempt++) {
        const ll = _missionSceneOffsetToLatLon(point.lat, point.lon, point.hdg, f, r);
        if (!ll) break;
        const zone = _missionTargetGeoBlockingZone(ll.lat, ll.lon, itemInfo);
        if (!zone) {
            return {
                forwardM: Math.round(f),
                rightM: Math.round(r),
                adjusted: attempt > 0,
                zone: lastZone ? String(lastZone.type || '') : null
            };
        }
        lastZone = zone;
        let nav = null;
        try { nav = calcNav(Number(zone.center?.lat), Number(zone.center?.lon), ll.lat, ll.lon); } catch (_) {}
        if (!Number.isFinite(Number(nav?.brng)) || Number(nav?.dist || 0) * 1852 < 1) {
            try { nav = calcNav(Number(zone.center?.lat), Number(zone.center?.lon), point.lat, point.lon); } catch (_) {}
        }
        const awayBearing = Number.isFinite(Number(nav?.brng)) ? Number(nav.brng) : (Number(zone.bearingDeg || 0) + 180);
        const distFromCenterM = Number.isFinite(Number(nav?.dist)) ? Number(nav.dist) * 1852 : 0;
        const pushM = Math.max(18, Math.min(90, Number(zone.radiusM || 25) - distFromCenterM + 22));
        const shift = _missionTargetGeoLocalShift(awayBearing, pushM, point.hdg);
        f += shift.f;
        r += shift.r;
    }

    const rings = [24, 42, 65, 92];
    const bearings = [0, 45, 90, 135, 180, 225, 270, 315];
    for (const radius of rings) {
        for (const relBearing of bearings) {
            const shift = _missionTargetGeoLocalShift(Number(point.hdg || 0) + relBearing, radius, point.hdg);
            const testF = baseF + shift.f;
            const testR = baseR + shift.r;
            const ll = _missionSceneOffsetToLatLon(point.lat, point.lon, point.hdg, testF, testR);
            if (!ll || _missionTargetGeoBlockingZone(ll.lat, ll.lon, itemInfo)) continue;
            return {
                forwardM: Math.round(testF),
                rightM: Math.round(testR),
                adjusted: true,
                zone: lastZone ? String(lastZone.type || '') : null
            };
        }
    }
    return { forwardM: Math.round(f), rightM: Math.round(r), adjusted: !!lastZone, zone: lastZone ? String(lastZone.type || '') : null };
}

function _missionTargetSceneText() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const contract = md?.missionContract || window.activeMissionContract || {};
    return [
        md?.mission,
        md?.poiName,
        md?.cat,
        md?.category,
        contract?.title,
        contract?.story,
        contract?.cargoText,
        contract?.paxText,
        md?.targetScene?.notes,
        md?.targetScene?.kind,
        md?.targetScene?.preset,
        Array.isArray(md?.targetScene?.features) ? md.targetScene.features.join(' ') : '',
        Array.isArray(md?.targetScene?.requirements) ? md.targetScene.requirements.map(req => [req?.feature, req?.placement, req?.notes].filter(Boolean).join(' ')).join(' ') : '',
        Array.isArray(md?.targetScene?.roles) ? md.targetScene.roles.join(' ') : '',
        window.activePassenger?.role,
        window.activePassenger?.taskDomain
    ].filter(Boolean).join(' ').toLowerCase();
}

function _missionTargetScenePoint(options = {}) {
    const allowMissingTerrain = !!options.allowMissingTerrain;
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (!md || !md.poiName || _activeFireScenario()) return null;
    const wps = (typeof routeWaypoints !== 'undefined' && Array.isArray(routeWaypoints)) ? routeWaypoints : [];
    const poiWp = wps.find(wp => wp && wp.isPOI) || (wps.length >= 2 ? wps[1] : null);
    const bridgeTarget = _missionTargetSceneIsBridgeTarget();
    let truthPoint = _missionTruthPoint(bridgeTarget ? ['mainTarget', 'sceneAnchor'] : ['sceneAnchor', 'mainTarget']);
    const truth = _missionTruthData();
    const pickedPoi = truth?.pickedPoi || null;
    const pickedPoiLat = Number(pickedPoi?.lat);
    const pickedPoiLon = Number(pickedPoi?.lon);
    if (
        bridgeTarget &&
        /^(road|rail|railway|path|parking)$/.test(String(truthPoint?.kind || '').toLowerCase()) &&
        Number.isFinite(pickedPoiLat) &&
        Number.isFinite(pickedPoiLon)
    ) {
        truthPoint = {
            lat: pickedPoiLat,
            lon: pickedPoiLon,
            name: String(pickedPoi?.name || md.poiName || 'Bruecke/Viadukt'),
            kind: 'bridge',
            reason: 'picked_bridge_poi'
        };
    }
    const lat = Number(truthPoint?.lat ?? md.targetLat ?? poiWp?.lat);
    const lon = Number(truthPoint?.lon ?? md.targetLon ?? poiWp?.lng ?? poiWp?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const terrainFt = Number(md.poiTerrainFt ?? md.targetAltFt ?? poiWp?.altFt ?? poiWp?.elevFt);
    if (!Number.isFinite(terrainFt) && !allowMissingTerrain) return null;
    let hdg = Number(md.heading);
    if (!Number.isFinite(hdg) && wps[0] && typeof calcNav === 'function') {
        try {
            const nav = calcNav(Number(wps[0].lat), Number(wps[0].lng ?? wps[0].lon), lat, lon);
            hdg = Number(nav?.brng);
        } catch (_) {}
    }
    return {
        lat,
        lon,
        altFt: Number.isFinite(terrainFt) ? Math.max(0, Math.round(terrainFt)) : 0,
        terrainPending: !Number.isFinite(terrainFt),
        hdg: Number.isFinite(hdg) ? Math.round(hdg) : 0,
        name: String(truthPoint?.name || md.poiName || poiWp?.name || 'POI')
    };
}

function _missionTargetSceneHasPowerlineContext(text = '') {
    const t = String(text || '').toLowerCase();
    return /(strommast|stromtrasse|stromleitung|freileitung|hochspann|hochspannung|powerline|power\s+line|power\s+pylon|power\s+tower|umspannwerk|transformator|energieinfrastruktur|leitungsmast|stromnetz)/.test(t);
}

function _missionTargetSceneHasWindTurbineContext(text = '') {
    const t = String(text || '').toLowerCase();
    return /(wind_turbine|windrad|windraeder|windräder|windturbine|wind\s+turbine|windkraft|windpark|windenergie|rotorblatt|rotor|turbine)/.test(t);
}

function _missionTargetSceneHasWindTerrainText(text = '') {
    const t = String(text || '').toLowerCase();
    return /(berg|gipfel|ruecken|rücken|kuppe|hochflaeche|hochfläche|hoehe|höhe|wiese|wiesen|feld|felder|acker|farmland|meadow|offenes gelaende|offenes gelände|weide|landwirtschaft)/.test(t);
}

function _missionTargetSceneHasWindBadTerrainText(text = '') {
    const t = String(text || '').toLowerCase();
    return /(stadt|innenstadt|city|wohngebiet|siedlung|urban|bebauung|tal|talsohle|schlucht|enge lage|industriegebiet)/.test(t);
}

function _missionTargetSceneGeoAllowsWindTurbine() {
    const anchors = _missionTargetGeoContext()?.anchors || {};
    const meadow = Number(anchors.meadow?.distM);
    const farmland = Number(anchors.farmland?.distM);
    const openM = Math.min(Number.isFinite(meadow) ? meadow : Infinity, Number.isFinite(farmland) ? farmland : Infinity);
    const building = Number(anchors.building?.distM);
    const urbanClose = Number.isFinite(building) && building < 180 && !(Number.isFinite(openM) && openM <= building + 80);
    return Number.isFinite(openM) && openM < 450 && !urbanClose;
}

function _missionTargetSceneAllowsWindTurbine(text = '') {
    if (!_missionTargetSceneHasWindTurbineContext(text)) return false;
    if (_missionTargetSceneHasWindBadTerrainText(text)) return false;
    return _missionTargetSceneHasWindTerrainText(text) || _missionTargetSceneGeoAllowsWindTurbine();
}

function _missionTargetSceneRequestTerrain() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (!md || !md.poiName || Number.isFinite(Number(md.poiTerrainFt ?? md.targetAltFt))) return false;
    const wps = (typeof routeWaypoints !== 'undefined' && Array.isArray(routeWaypoints)) ? routeWaypoints : [];
    const poiWp = wps.find(wp => wp && wp.isPOI) || (wps.length >= 2 ? wps[1] : null);
    const truthPoint = _missionTruthPoint(['sceneAnchor', 'mainTarget']);
    const lat = Number(truthPoint?.lat ?? md.targetLat ?? poiWp?.lat);
    const lon = Number(truthPoint?.lon ?? md.targetLon ?? poiWp?.lng ?? poiWp?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
    if (typeof fetchPoiTerrainElevationFt !== 'function') return false;
    const key = _missionTargetSceneId();
    if (missionTargetSceneTerrainRequests.has(key)) return true;
    const promise = Promise.resolve()
        .then(() => fetchPoiTerrainElevationFt(lat, lon))
        .then(ft => {
            if (!Number.isFinite(Number(ft))) return;
            md.poiTerrainFt = Math.max(0, Math.round(Number(ft)));
            md.targetAltFt = md.poiTerrainFt;
            if (!truthPoint) {
                md.targetLat = lat;
                md.targetLon = lon;
            }
            if (typeof saveMissionState === 'function') {
                try { saveMissionState(); } catch (_) {}
            }
        })
        .finally(() => missionTargetSceneTerrainRequests.delete(key));
    missionTargetSceneTerrainRequests.set(key, promise);
    return true;
}

function _missionTargetSceneFeatureHintsFromSpec(kind = 'survey_context') {
    const spec = _missionTargetSceneSpec() || {};
    const out = [];
    const add = (feature) => {
        const normalized = _missionTargetSceneNormalizeFeature(feature);
        if (normalized && !out.includes(normalized)) out.push(normalized);
    };
    if (Array.isArray(spec.features)) spec.features.forEach(add);
    if (Array.isArray(spec.modifiers)) spec.modifiers.forEach(add);
    if (Array.isArray(spec.requirements)) {
        spec.requirements.forEach(req => {
            if (typeof req === 'string') add(req);
            else add(req?.feature || req?.kind || req?.type || req?.name || req?.role);
        });
    }
    if (Array.isArray(spec.roles)) {
        spec.roles.forEach(role => {
            const r = String(role || '').toLowerCase();
            if (r === 'utility.powerline') add('powerline');
            if (r === 'utility.wind_turbine') add('wind_turbine');
            if (r === 'utility.generator') add('generator');
            if (r === 'construction.crane') add('construction_crane');
            if (r === 'construction.earthmoving') add('earthmoving');
            if (r === 'vehicle.bus') add('bus');
            if (r === 'vehicle.car' || r === 'vehicle.van') add((kind === 'road_incident' || kind === 'event_site') ? 'road_vehicles' : 'parked_vehicle');
            if (r === 'vehicle.truck') add('utility_truck');
            if (r === 'vehicle.emergency.medical') add('emergency_response');
            if (r === 'person.ground_crew') add('people');
            if (r === 'sar.liferaft') add('liferaft');
            if (r === 'watercraft.small_boat' || r === 'watercraft.boat') add('watercraft');
            if (r === 'watercraft.service_ship' || r === 'watercraft.ship') add('service_ship');
            if (r === 'animal.waterfowl' || r === 'animal.bird') add('waterfowl');
            if (r === 'animal.wildlife' || r === 'animal.deer') add('wildlife_animals');
            if (r === 'animal.grazing') add('animal_herd');
            if (r === 'camp.tent' || r === 'camp.trailer') add('tent');
            if (r === 'cargo.medical_kit' || r === 'cargo.animal_transport_box') add('cargo_material');
            if (r === 'cargo.small_box') add((kind === 'cargo_site' || kind === 'medical_pickup') ? 'cargo_material' : 'small_equipment');
            if (r.startsWith('debris.')) add('debris');
            if (r === 'nature.log' || r === 'material.log') add('logs');
            if (r === 'vfx.smoke') add('smoke_light');
            if (r === 'vfx.fire') add('fire_small');
        });
    }
    return out;
}

function _missionTargetSceneKindFromFeatureHints(text = '') {
    const features = _missionTargetSceneFeatureHintsFromSpec('survey_context');
    if (!features.length) return null;
    const has = feature => features.includes(feature);
    if (has('powerline')) return _missionTargetSceneHasPowerlineContext(text) ? 'powerline_inspection' : 'survey_context';
    if (has('wind_turbine')) return _missionTargetSceneAllowsWindTurbine(text) ? 'wind_turbine_site' : 'survey_context';
    if (has('construction_crane') || has('earthmoving') || has('construction_truck')) return 'construction_site';
    if (has('liferaft') || has('service_ship')) return 'sar_water';
    if (has('missing_person')) return 'sar_land';
    if (has('emergency_response') && /(medizin|medical|patient|rettung|notfall|verletz)/.test(text)) return 'medical_pickup';
    if (has('emergency_response') || (has('road_vehicles') && /(unfall|crash|kollision|sperrung|einsatzlage)/.test(text))) return 'road_incident';
    if (has('cargo_material') || has('pallet_stack')) return 'cargo_site';
    if (has('watercraft') || has('waterfowl')) return 'water_context';
    if (has('wildlife_animals') || has('animal_herd') || has('tent') || has('campfire')) return 'wildlife_site';
    if (has('bus')) return 'event_site';
    if (has('road_vehicles') || has('parked_vehicle') || has('people') || has('small_equipment') || has('cones') || has('logs') || has('debris')) return 'survey_context';
    return null;
}

function _missionTargetSceneKind() {
    const point = _missionTargetScenePoint({ allowMissingTerrain: true });
    if (!point) return null;
    const spec = _missionTargetSceneSpec();
    const explicitKindRaw = String(spec?.kind || spec?.type || '').trim().toLowerCase();
    const kindAliases = {
        traffic_site: 'road_incident',
        accident: 'road_incident',
        water_sar: 'sar_water',
        land_sar: 'sar_land',
        medical_site: 'medical_pickup',
        construction: 'construction_site',
        powerline: 'powerline_inspection',
        power_pylon: 'powerline_inspection',
        pylon: 'powerline_inspection',
        wind_turbine: 'wind_turbine_site',
        windrad: 'wind_turbine_site',
        windkraft: 'wind_turbine_site',
        windpark: 'wind_turbine_site',
        erosion: 'erosion_damage',
        shore_damage: 'erosion_damage',
        landslide: 'erosion_damage',
        debris: 'debris_field',
        bridge: 'infra_bridge',
        dam: 'infra_dam',
        industry: 'industry_site',
        water: 'water_pollution',
        water_context: 'water_context',
        shoreline: 'water_context',
        waterline: 'water_context',
        wildlife: 'wildlife_site',
        animals: 'wildlife_site',
        nature: 'wildlife_site',
        media: 'media_site',
        event: 'event_site',
        survey: 'survey_context',
        survey_site: 'survey_context'
    };
    const explicitKind = kindAliases[explicitKindRaw] || explicitKindRaw;
    const text = _missionTargetSceneText();
    if (/^(none|off|false|no)$/i.test(explicitKind)) return _missionTargetSceneKindFromFeatureHints(text);
    if (explicitKind === 'fire_watch') return null;
    if (explicitKind === 'powerline_inspection' && !_missionTargetSceneHasPowerlineContext(text)) return 'survey_context';
    if (explicitKind === 'wind_turbine_site' && !_missionTargetSceneAllowsWindTurbine(text)) return 'survey_context';
    if (/^(road_incident|sar_water|sar_land|medical_pickup|cargo_site|construction_site|powerline_inspection|wind_turbine_site|erosion_damage|debris_field|infra_bridge|infra_dam|industry_site|water_pollution|water_context|wildlife_site|media_site|event_site|survey_context)$/.test(explicitKind)) return explicitKind;
    const roles = Array.isArray(spec?.roles) ? spec.roles.map(role => String(role || '').toLowerCase()) : [];
    if (roles.some(role => role.startsWith('construction.'))) return 'construction_site';
    if (roles.some(role => role === 'utility.powerline') && _missionTargetSceneHasPowerlineContext(text)) return 'powerline_inspection';
    if (roles.some(role => role === 'utility.wind_turbine') && _missionTargetSceneAllowsWindTurbine(text)) return 'wind_turbine_site';
    if (roles.some(role => role.startsWith('nature.') || role.startsWith('debris.'))) return 'debris_field';
    const taskDomain = _missionSceneTaskDomain();
    if (taskDomain === 'fire_watch' || /(waldbrand|rauch|brand|feuer|hotspot)/.test(text)) return null;
    if (_missionTargetSceneHasPowerlineContext(text)) return 'powerline_inspection';
    if (_missionTargetSceneAllowsWindTurbine(text)) return 'wind_turbine_site';
    if (/(baustelle|baugrube|kran|bagger|bulldozer|erdarbeiten|construction|crane|dozer)/.test(text)) return 'construction_site';
    if (/(uferbruch|uferkante|hangrutsch|erosion|erdrutsch|abbruchkante|geroell|geröll|felsen|steine|sediment|boeschung|böschung)/.test(text)) return 'erosion_damage';
    if (/(truemmer|trümmer|debris|streugut| verstreut|wrackteile)/.test(text)) return 'debris_field';
    if (/(bruecke|brücke|viadukt|bridge)/.test(text)) return 'infra_bridge';
    if (/(staudamm|talsperre|damm|dam\b|wasserreservoir)/.test(text)) return 'infra_dam';
    if (/(industrie|werk|fabrik|raffinerie|anlage|industry|industrial)/.test(text)) return 'industry_site';
    if (taskDomain === 'search_and_rescue' || /(sar|rettung|seenot|vermisst|liferaft|rettungsinsel|notlage)/.test(text)) {
        return /(see|lake|fluss|river|meer|sea|wasser|water|boot|boat|ship|schiff|kueste|küste|insel|liferaft|rettungsinsel)/.test(text) ? 'sar_water' : 'sar_land';
    }
    if (/(gewaesser|gewässer|verschmutz|oel|öl|alge|wasserprobe|ufer|see|fluss|river|lake)/.test(text) && /(science|bio|umwelt|probe|verschmutz|alge|oel|öl)/.test(text)) return 'water_pollution';
    if (/(see|ufer|fluss|river|lake|gewaesser|gewässer|waterline|shoreline)/.test(text)
        && /(ufercamp|zelt|camping|parkendes auto|auto am ufer|wasservogel|wasservoegel|wasservögel|ente|enten|goose|geese|boot|boat|treibholz|log|logs)/.test(text)) return 'water_context';
    if (/(wildtier|wildlife|tiere|vogel|voegel|vögel|habitat|nest|herde|biotop|wald|forest|zelt|camping|biwak)/.test(text)) return 'wildlife_site';
    if (/(veranstaltung|event|festival|menschenmenge|zuschauer)/.test(text)) return 'event_site';
    if (/(unfall|accident|crash|collision|kollision|panne|road|strasse|straße|autobahn|fahrzeugbergung|verletzte)/.test(text)) return 'road_incident';
    if (taskDomain === 'medical_transfer') return 'medical_pickup';
    if (taskDomain === 'cargo' || taskDomain === 'animal_transport' || /(fracht|cargo|palette|pallet|lieferung|material|ersatzteil|tiertransport)/.test(text)) return 'cargo_site';
    if (taskDomain === 'survey' || /(survey|mapping|inspection|inspektion|messung|probe|science|bio|geo|fotogramm|kartierung)/.test(text)) return 'survey_context';
    if (taskDomain === 'news_coverage' || /(presse|news|reportage|kamera|foto|media|drehort)/.test(text)) return 'media_site';
    return null;
}

function _missionTargetSceneItem(kind, label, title, pool, forwardM, rightM, options = {}) {
    if (!title) return null;
    const resolved = _missionTargetGeoResolveWorldOffset(kind, label, title, forwardM, rightM);
    return {
        kind,
        label,
        objectTitle: title,
        titleCandidates: _sceneAssetCandidates(title, pool || []),
        forwardM: resolved.forwardM,
        rightM: resolved.rightM,
        headingMode: 'with_aircraft',
        hdgOffsetDeg: Number.isFinite(Number(options.hdgOffsetDeg)) ? Number(options.hdgOffsetDeg) : 0,
        altOffsetFt: Number.isFinite(Number(options.altOffsetFt)) ? Number(options.altOffsetFt) : 0,
        placement: options.placement ? String(options.placement).slice(0, 80) : undefined,
        placementOverride: !!options.placementOverride,
        geoAnchor: options.geoAnchor || undefined,
        worldAvoidance: resolved.adjusted ? { adjusted: true, zone: resolved.zone || null } : undefined
    };
}

function _missionTargetSceneNormalizeFeature(value) {
    const s = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!s) return '';
    const aliases = {
        crane: 'construction_crane',
        kran: 'construction_crane',
        dozer: 'earthmoving',
        bulldozer: 'earthmoving',
        bagger: 'earthmoving',
        material: 'cargo_material',
        cargo: 'cargo_material',
        pallets: 'pallet_stack',
        pallet: 'pallet_stack',
        paletten: 'pallet_stack',
        palette: 'pallet_stack',
        pallet_stack: 'pallet_stack',
        material_stack: 'pallet_stack',
        materiallager: 'pallet_stack',
        power: 'powerline',
        power_pylon: 'powerline',
        pylon: 'powerline',
        strommast: 'powerline',
        freileitung: 'powerline',
        wind_turbine: 'wind_turbine',
        windrad: 'wind_turbine',
        windraeder: 'wind_turbine',
        windrader: 'wind_turbine',
        windkraft: 'wind_turbine',
        windpark: 'wind_turbine',
        windenergie: 'wind_turbine',
        utility_vehicle: 'utility_truck',
        service_vehicle: 'utility_truck',
        cars: 'road_vehicles',
        vehicles: 'road_vehicles',
        traffic: 'road_vehicles',
        emergency_vehicle: 'emergency_response',
        emergency_vehicles: 'emergency_response',
        rescue_vehicle: 'emergency_response',
        rescue_vehicles: 'emergency_response',
        einsatzfahrzeug: 'emergency_response',
        einsatzfahrzeuge: 'emergency_response',
        rettungsfahrzeug: 'emergency_response',
        rettungsfahrzeuge: 'emergency_response',
        emergency: 'emergency_response',
        medic: 'emergency_response',
        ambulance: 'emergency_response',
        missing_person: 'missing_person',
        missing: 'missing_person',
        lost_person: 'missing_person',
        vermisste_person: 'missing_person',
        vermisst: 'missing_person',
        person_waving: 'missing_person',
        waving_person: 'missing_person',
        winkende_person: 'missing_person',
        crew: 'people',
        persons: 'people',
        person: 'people',
        personnel: 'people',
        staff: 'people',
        rescue_personnel: 'people',
        search_team: 'people',
        search_party: 'people',
        ground_team: 'people',
        field_personnel: 'people',
        suchtrupp: 'people',
        suchtrupps: 'people',
        einsatzkraefte: 'people',
        einsatzkräfte: 'people',
        rettungskraefte: 'people',
        rettungskräfte: 'people',
        marker: 'cones',
        cone: 'cones',
        ground_marker: 'cones',
        ground_markers: 'cones',
        ground_marking: 'cones',
        ground_markings: 'cones',
        bodenmarkierung: 'cones',
        bodenmarkierungen: 'cones',
        rubble: 'debris',
        truemmer: 'debris',
        treibgut: 'logs',
        log: 'logs',
        raft: 'liferaft',
        boat: 'watercraft',
        boats: 'watercraft',
        small_boat: 'watercraft',
        small_watercraft: 'watercraft',
        ship: 'service_ship',
        ships: 'service_ship',
        service_ship: 'service_ship',
        work_ship: 'service_ship',
        coast_guard: 'service_ship',
        kuestenwache: 'service_ship',
        kustwache: 'service_ship',
        arbeitsschiff: 'service_ship',
        birds: 'waterfowl',
        bird: 'waterfowl',
        waterfowl: 'waterfowl',
        wasservoegel: 'waterfowl',
        wasservogel: 'waterfowl',
        enten: 'waterfowl',
        ente: 'waterfowl',
        ducks: 'waterfowl',
        duck: 'waterfowl',
        geese: 'waterfowl',
        goose: 'waterfowl',
        wildlife_animals: 'wildlife_animals',
        wildlife: 'wildlife_animals',
        wildtiere: 'wildlife_animals',
        wildtier: 'wildlife_animals',
        animals: 'wildlife_animals',
        animal: 'wildlife_animals',
        herd: 'animal_herd',
        herde: 'animal_herd',
        grazing: 'animal_herd',
        weidetiere: 'animal_herd',
        camp: 'tent',
        camping: 'tent',
        tent: 'tent',
        tents: 'tent',
        zelt: 'tent',
        zelte: 'tent',
        ufercamp: 'tent',
        shore_camp: 'tent',
        shore_car: 'parked_vehicle',
        shore_vehicle: 'parked_vehicle',
        parking_car: 'parked_vehicle',
        parked_car: 'parked_vehicle',
        parked_vehicle: 'parked_vehicle',
        parkendes_auto: 'parked_vehicle',
        auto_am_ufer: 'parked_vehicle',
        box: 'small_equipment',
        boxes: 'small_equipment',
        equipment: 'small_equipment',
        ausruestung: 'small_equipment',
        picknick: 'small_equipment',
        picnic: 'small_equipment',
        lagerfeuer: 'campfire',
        campfire: 'campfire',
        firepit: 'campfire',
        feuerstelle: 'campfire',
        bus_shuttle: 'bus',
        smoke: 'smoke_light',
        light_smoke: 'smoke_light',
        signal_smoke: 'signal_smoke',
        smoke_signal: 'signal_smoke',
        rauchsignal: 'signal_smoke',
        signalrauch: 'signal_smoke',
        farbiger_rauch: 'signal_smoke',
        fire: 'fire_small',
        small_fire: 'fire_small'
    };
    const normalized = aliases[s] || s;
    const catalog = window.MISSION_SCENE_ASSETS?.targetSceneFeatures || {};
    return catalog[normalized] ? normalized : '';
}

const MISSION_TARGET_SCENE_BASE_FEATURE_COUNTS = {
    powerline_inspection: { powerline: 2, generator: 1, utility_truck: 1, cones: 1 },
    wind_turbine_site: { wind_turbine: 1, utility_truck: 1 },
    road_incident: { road_vehicles: 2, emergency_response: 1, people: 2, cones: 2 },
    construction_site: { construction_crane: 1, earthmoving: 1, construction_truck: 1, cargo_material: 1, cones: 2 },
    erosion_damage: { logs: 2, debris: 1, cones: 1 },
    debris_field: { debris: 3 },
    sar_water: { liferaft: 1, service_ship: 1 },
    sar_land: { missing_person: 1 },
    medical_pickup: { emergency_response: 1, people: 2, cargo_material: 1 },
    cargo_site: { cargo_material: 2, utility_truck: 1, people: 1 },
    infra_bridge: { utility_truck: 1, generator: 1, cones: 2 },
    infra_dam: { utility_truck: 1, generator: 1, cones: 2, watercraft: 1 },
    industry_site: { utility_truck: 1, cargo_material: 1, generator: 1 },
    water_pollution: { watercraft: 1, logs: 2 },
    water_context: { logs: 2 },
    wildlife_site: { logs: 2 },
    media_site: { utility_truck: 1, cargo_material: 1, people: 1, cones: 1 },
    event_site: { bus: 1, road_vehicles: 1, cones: 2 },
    survey_context: { logs: 2 }
};

function _missionTargetSceneRequestedFeatures(kind = '') {
    const spec = _missionTargetSceneSpec() || {};
    const out = [];
    const text = _missionTargetSceneText();
    const add = (feature) => {
        const normalized = _missionTargetSceneNormalizeFeature(feature);
        if (normalized && !out.includes(normalized)) out.push(normalized);
    };
    if (Array.isArray(spec.features)) spec.features.forEach(add);
    if (Array.isArray(spec.modifiers)) spec.modifiers.forEach(add);
    if (Array.isArray(spec.requirements)) {
        spec.requirements.forEach(req => {
            if (typeof req === 'string') add(req);
            else add(req?.feature || req?.kind || req?.type || req?.name || req?.role);
        });
    }
    if (Array.isArray(spec.roles)) {
        spec.roles.forEach(role => {
            const r = String(role || '').toLowerCase();
            if (r === 'utility.powerline') add('powerline');
            if (r === 'utility.wind_turbine') add('wind_turbine');
            if (r === 'utility.generator') add('generator');
            if (r === 'construction.crane') add('construction_crane');
            if (r === 'construction.earthmoving') add('earthmoving');
            if (r === 'vehicle.bus') add('bus');
            if (r === 'sar.liferaft') add('liferaft');
            if (r === 'watercraft.small_boat' || r === 'watercraft.boat') add('watercraft');
            if (r === 'watercraft.service_ship' || r === 'watercraft.ship') add('service_ship');
            if (r === 'animal.waterfowl' || r === 'animal.bird') add('waterfowl');
            if (r === 'animal.wildlife' || r === 'animal.deer') add('wildlife_animals');
            if (r === 'animal.grazing') add('animal_herd');
            if (r === 'camp.tent' || r === 'camp.trailer') add('tent');
            if (r === 'vehicle.car') add((kind === 'road_incident' || kind === 'event_site') ? 'road_vehicles' : 'parked_vehicle');
            if (r === 'cargo.medical_kit') add('cargo_material');
            if (r === 'cargo.animal_transport_box') add('cargo_material');
            if (r === 'cargo.small_box') add((kind === 'cargo_site' || kind === 'medical_pickup') ? 'cargo_material' : 'small_equipment');
            if (r.startsWith('debris.')) add('debris');
            if (r === 'nature.log' || r === 'material.log') add('logs');
            if (r === 'vfx.smoke') add(/(rauchsignal|signalrauch|farbiger rauch|signalfackel|signal smoke)/.test(text) ? 'signal_smoke' : 'smoke_light');
            if (r === 'vfx.fire' && !out.includes('campfire')) add('fire_small');
        });
    }
    if (_missionTargetSceneHasPowerlineContext(text)) add('powerline');
    if (_missionTargetSceneAllowsWindTurbine(text)) add('wind_turbine');
    if (/(kran|crane)/.test(text)) add('construction_crane');
    if (/(bagger|bulldozer|dozer|erdarbeiten)/.test(text)) add('earthmoving');
    if (/(truemmer|trümmer|debris|wrackteile|streugut)/.test(text)) add('debris');
    if (/(treibholz|baumstamm|log|logs)/.test(text)) add('logs');
    if (kind === 'sar_land' && /(sichtkontakt|gesichtet|fundstelle|person am boden|verletzte person|wink|winkt|hilferuf|hilfezeichen)/.test(text)) add('missing_person');
    if (/(rauchsignal|signalrauch|farbiger rauch|signalfackel|signal smoke)/.test(text)) add('signal_smoke');
    else if (/(rauch|smoke|abluft)/.test(text) && kind !== 'fire_watch') add('smoke_light');
    if (/(rettungsinsel|liferaft)/.test(text)) add('liferaft');
    if (/(boot|boat)/.test(text)) add('watercraft');
    if (/(arbeitsschiff|küstenwache|kuestenwache|coast guard|schiff|ship)/.test(text)) add('service_ship');
    if (/(ente|enten|goose|geese|gans|gaense|gänse|wasservogel|wasservoegel|wasservögel|seagull|moewe|möwe|voegel|vögel|bird|birds)/.test(text)) add('waterfowl');
    if (/(wildtier|wildtiere|wildlife|hirsch|reh|elch|deer|moose|elk|habitat)/.test(text)) add('wildlife_animals');
    if (/(herde|weidetiere|schafe|kuehe|kühe|rinder|ziegen|pferde|grazing|herd)/.test(text)) add('animal_herd');
    if (/(zelt|camp|camping|ufercamp|trailer|wohnwagen)/.test(text)) add('tent');
    if (/(parkendes auto|auto am ufer|uferparkplatz|shore car|parked car)/.test(text)) add('parked_vehicle');
    if (/(picknick|picnic|ausruestung|ausrüstung|kiste|box|kleine ladung)/.test(text)) add('small_equipment');
    if (/(lagerfeuer|campfire|firepit|feuerstelle)/.test(text)) add('campfire');
    if (/(bus|shuttle)/.test(text)) add('bus');
    return out;
}

function _missionTargetSceneFeatureCount(feature) {
    const spec = _missionTargetSceneSpec() || {};
    let count = 1;
    if (Array.isArray(spec.requirements)) {
        spec.requirements.forEach(req => {
            if (!req || typeof req !== 'object') return;
            if (_missionTargetSceneNormalizeFeature(req.feature || req.kind || req.type || req.name || req.role) !== feature) return;
            const limit = (feature === 'pallet_stack' || feature === 'cargo_material') ? 8 : (feature === 'cones' ? 8 : 6);
            const c = Math.max(1, Math.min(limit, Math.round(Number(req.count || req.qty || req.amount || 1) || 1)));
            count = Math.max(count, c);
        });
    }
    return count;
}

function _missionTargetSceneFeatureArrangement(feature) {
    const spec = _missionTargetSceneSpec() || {};
    const sceneLayout = String(spec.layout || spec.arrangement || '').trim().toLowerCase();
    let out = '';
    if (Array.isArray(spec.requirements)) {
        spec.requirements.forEach(req => {
            if (!req || typeof req !== 'object') return;
            if (_missionTargetSceneNormalizeFeature(req.feature || req.kind || req.type || req.name || req.role) !== feature) return;
            const raw = String(req.arrangement || req.layout || req.pattern || '').trim().toLowerCase();
            if (/^(cluster|scattered|line|roadside|waterline|perimeter|mixed)$/.test(raw)) out = raw;
        });
    }
    if (out) return out;
    if (feature === 'pallet_stack' || feature === 'cargo_material') return 'cluster';
    if (feature === 'waterfowl') return 'cluster';
    return /^(cluster|scattered|line|roadside|waterline|perimeter|mixed)$/.test(sceneLayout) ? sceneLayout : '';
}

function _missionTargetSceneFeaturePlacementOverride(feature, index = 0) {
    const normalized = _missionTargetSceneNormalizeFeature(feature);
    const spec = _missionTargetSceneSpec() || {};
    const reqs = Array.isArray(spec.requirements) ? spec.requirements : [];
    const matches = reqs.filter(req => {
        if (!req || typeof req !== 'object') return false;
        return _missionTargetSceneNormalizeFeature(req.feature || req.kind || req.type || req.name || req.role) === normalized;
    });
    if (!matches.length) return null;
    let cursor = Math.max(0, Math.round(Number(index) || 0));
    for (const req of matches) {
        const count = Math.max(1, Math.round(Number(req.count || req.qty || req.amount || 1) || 1));
        if (cursor >= count) {
            cursor -= count;
            continue;
        }
        const f = Number(req.forwardM ?? req.forward ?? req.f);
        const r = Number(req.rightM ?? req.right ?? req.r);
        if (!Number.isFinite(f) || !Number.isFinite(r)) return null;
        const spacing = Number.isFinite(Number(req.spacingM)) ? Number(req.spacingM) : 4.5;
        const arrangement = String(req.arrangement || req.layout || req.pattern || '').toLowerCase();
        const cluster = arrangement === 'cluster' && count > 1 ? _missionSceneClusterOffset(cursor, f, r, spacing) : { f, r, hdg: Number(req.hdgOffsetDeg ?? req.headingOffsetDeg ?? 0) };
        const placementText = String(req.placement || req.position || req.where || '').replace(/\s+/g, ' ').trim();
        const placementLower = placementText.toLowerCase();
        let placed = cluster;
        let geoAnchor = null;
        let anchorNames = null;
        if (/waldrand|waldkante|forest edge|wood edge/.test(placementLower)) anchorNames = ['forest', 'meadow', 'farmland', 'path'];
        else if (/feldrand|wiesenrand|field edge|meadow edge/.test(placementLower)) anchorNames = ['meadow', 'farmland', 'road', 'parking', 'path'];
        else if (/lichtung|wiese|freiflaeche|freifläche|clearing|meadow/.test(placementLower)) anchorNames = ['meadow', 'farmland'];
        else if (/strasse|straße|road|weg|path|parking|parkplatz/.test(placementLower)) anchorNames = ['parking', 'road', 'path'];
        if (anchorNames) {
            const pos = _missionTargetGeoOffset(anchorNames, cluster.f, cluster.r, {
                minM: 10,
                maxM: 950,
                lateralM: cursor * Math.max(4, spacing),
                hdgOffsetDeg: Number(req.hdgOffsetDeg ?? req.headingOffsetDeg ?? cluster.hdg ?? 0)
            });
            if (pos?.anchored) {
                placed = { f: pos.f, r: pos.r, hdg: pos.hdg };
                geoAnchor = _missionTargetGeoAnchorDebug(pos, anchorNames);
            }
        }
        return {
            forwardM: Math.max(-950, Math.min(950, Math.round(placed.f))),
            rightM: Math.max(-950, Math.min(950, Math.round(placed.r))),
            hdgOffsetDeg: Number.isFinite(Number(req.hdgOffsetDeg ?? req.headingOffsetDeg ?? placed.hdg))
                ? Math.round(Number(req.hdgOffsetDeg ?? req.headingOffsetDeg ?? placed.hdg))
                : undefined,
            placement: placementText || '',
            geoAnchor
        };
    }
    return null;
}

function _missionSceneClusterOffset(index, centerF = 0, centerR = 0, spacingM = 3.2) {
    const pattern = [
        [0, 0], [1, 0], [0, 1], [1, 1],
        [-1, 0], [0, -1], [-1, -1], [1, -1]
    ];
    const p = pattern[index % pattern.length] || [0, 0];
    const ring = Math.floor(index / pattern.length);
    return {
        f: centerF + ((p[0] * spacingM) + (ring * spacingM * 0.75)),
        r: centerR + ((p[1] * spacingM) - (ring * spacingM * 0.75)),
        hdg: 15 + ((index % 4) * 18)
    };
}

function _missionTargetSceneFeatureAllowedForKind(kind = '', feature = '') {
    const k = String(kind || '').toLowerCase();
    const f = String(feature || '').toLowerCase();
    if (k === 'infra_bridge' && f === 'logs') {
        const text = _missionTargetSceneText();
        const anchors = _missionTargetGeoContext()?.anchors || {};
        const waterM = Number(anchors.water?.distM);
        return /(treibholz|baumstamm|holzstapel|holzlager|ufer|fluss|wasser|hochwasser|erosion|anschwemm|schwemmgut)/.test(text)
            || (Number.isFinite(waterM) && waterM < 90);
    }
    return true;
}

function _missionTargetSceneItems(kind) {
    const civilCars = _missionSceneFilteredVehiclePool(MISSION_SCENE_ASSET_POOLS.cars);
    const civilVans = _missionSceneFilteredVehiclePool(MISSION_SCENE_ASSET_POOLS.vans);
    const civilTrucks = _missionSceneFilteredVehiclePool(MISSION_SCENE_ASSET_POOLS.trucks);
    const carPool = civilCars.concat(civilVans);
    const vanPool = civilVans.length ? civilVans : civilCars;
    const truckPool = civilTrucks.concat(civilVans);
    const primaryTruckPool = civilTrucks.length ? civilTrucks : truckPool;
    const supportVehiclePool = MISSION_SCENE_ASSET_POOLS.medicalVehicles.concat(civilVans);
    const primarySupportVehiclePool = MISSION_SCENE_ASSET_POOLS.medicalVehicles.length
        ? MISSION_SCENE_ASSET_POOLS.medicalVehicles
        : supportVehiclePool;
    const smallBoatPool = MISSION_SCENE_ASSET_POOLS.smallBoats.length
        ? MISSION_SCENE_ASSET_POOLS.smallBoats
        : MISSION_SCENE_ASSET_POOLS.boats;
    const serviceShipPool = MISSION_SCENE_ASSET_POOLS.serviceShips.concat(MISSION_SCENE_ASSET_POOLS.ships);
    const debrisPool = MISSION_SCENE_ASSET_POOLS.debrisLight.concat(MISSION_SCENE_ASSET_POOLS.natureLogs);
    const peoplePool = MISSION_SCENE_ASSET_POOLS.people;
    const markerPool = MISSION_SCENE_ASSET_POOLS.markers.includes(BOARDING_MARKER_TITLE)
        ? [BOARDING_MARKER_TITLE]
        : MISSION_SCENE_ASSET_POOLS.markers;
    const cone = _scenePreferredTitle(markerPool, BOARDING_MARKER_TITLE, `${kind}-marker`, BOARDING_MARKER_TITLE);
    const personA = _missionScenePersonTitle('female', `${kind}-person-a`);
    const personB = _missionScenePersonTitle('male', `${kind}-person-b`);
    const items = [];
    const add = (...args) => {
        const item = _missionTargetSceneItem(...args);
        if (item) items.push(item);
    };
    const addFeatureSupplement = (feature, count = 1) => {
        const maxFeatureCount = (feature === 'pallet_stack' || feature === 'cargo_material') ? 8 : (feature === 'cones' ? 8 : 6);
        const safeCount = Math.max(1, Math.min(maxFeatureCount, Math.round(Number(count) || 1)));
        const arrangement = _missionTargetSceneFeatureArrangement(feature);
        let featureIndex = 0;
        const add = (...args) => {
            const override = _missionTargetSceneFeaturePlacementOverride(feature, featureIndex);
            if (override) {
                args[4] = override.forwardM;
                args[5] = override.rightM;
                args[6] = {
                    ...(args[6] || {}),
                    hdgOffsetDeg: Number.isFinite(Number(override.hdgOffsetDeg)) ? override.hdgOffsetDeg : args[6]?.hdgOffsetDeg,
                    placement: override.placement || args[6]?.placement,
                    geoAnchor: override.geoAnchor || args[6]?.geoAnchor,
                    placementOverride: true
                };
            }
            const item = _missionTargetSceneItem(...args);
            if (item) items.push(item);
        };
        for (let i = 0; i < safeCount; i++) {
            featureIndex = i;
            const step = i * 5;
            if (feature === 'powerline') {
                const pylon = MISSION_SCENE_ASSET_POOLS.utilityPower.includes('PowerPylon_Base') ? 'PowerPylon_Base' : _scenePickTitle(MISSION_SCENE_ASSET_POOLS.utilityPower, `feature-powerline-${i}`, 'PowerPylon_Base');
                const powerAnchor = _missionTargetGeoAnchor(['power']);
                const anchorDistM = Number(powerAnchor?.distM);
                const pos = _missionTargetGeoOffset(['power'], 24 + (i * 28), -18 + (i * 5), {
                    minM: 12,
                    maxM: 650,
                    distanceM: Number.isFinite(anchorDistM) ? anchorDistM + (i * 45) : undefined,
                    lateralM: i * 10,
                    hdgOffsetDeg: 0
                });
                add(`feature_powerline_${i + 1}`, 'Zusatz Strommast/Freileitung', pylon, MISSION_SCENE_ASSET_POOLS.utilityPower, pos.f, pos.r, {
                    hdgOffsetDeg: 0,
                    placement: 'power anchor',
                    geoAnchor: _missionTargetGeoAnchorDebug(pos, ['power'])
                });
            } else if (feature === 'wind_turbine') {
                const turbine = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.windTurbines, `feature-wind-turbine-${i}`, 'WindTurbine');
                const pos = _missionTargetGeoOffset(['farmland', 'meadow'], 20 + (i * 22), -12 - (i * 7), { minM: 18, maxM: 150, lateralM: i * 14, hdgOffsetDeg: 0 });
                add(`feature_wind_turbine_${i + 1}`, 'Zusatz Windrad', turbine, MISSION_SCENE_ASSET_POOLS.windTurbines, pos.f, pos.r, { hdgOffsetDeg: 0 });
            } else if (feature === 'generator') {
                const generator = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.utilityGenerators, `feature-generator-${i}`, 'PowerGenerator');
                add(`feature_generator_${i + 1}`, 'Zusatz Generator', generator, MISSION_SCENE_ASSET_POOLS.utilityGenerators, 14 + step, -13 - step, { hdgOffsetDeg: 35 });
            } else if (feature === 'utility_truck' || feature === 'construction_truck') {
                const truck = _scenePickTitle(primaryTruckPool, `feature-truck-${feature}-${i}`, primaryTruckPool[0] || 'Truck Utility Europe Flush');
                add(`feature_${feature}_${i + 1}`, feature === 'construction_truck' ? 'Zusatz Baustellen-LKW' : 'Zusatz Utility Fahrzeug', truck, truckPool, -22 - step, 6 + step, { hdgOffsetDeg: 205 });
            } else if (feature === 'construction_crane') {
                const crane = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.constructionCranes, `feature-crane-${i}`, 'Truck Crane Small');
                add(`feature_crane_${i + 1}`, 'Zusatz Kran', crane, MISSION_SCENE_ASSET_POOLS.constructionCranes, -18 - step, 14 + step, { hdgOffsetDeg: 210 });
            } else if (feature === 'earthmoving') {
                const dozer = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.constructionEarthmoving, `feature-earthmoving-${i}`, 'Bulldozer');
                add(`feature_earthmoving_${i + 1}`, 'Zusatz Erdbaumaschine', dozer, MISSION_SCENE_ASSET_POOLS.constructionEarthmoving, 12 + step, -10 - step, { hdgOffsetDeg: 35 });
            } else if (feature === 'cargo_material' || feature === 'pallet_stack') {
                const cargoPool = feature === 'pallet_stack' ? MISSION_SCENE_ASSET_POOLS.palletCargo : MISSION_SCENE_ASSET_POOLS.cargo;
                const cargo = _scenePickTitle(cargoPool, `feature-cargo-${feature}-${i}`, feature === 'pallet_stack' ? 'Pallet01_02' : 'Pallet01_02');
                let pos = kind === 'sar_land' ? { f: -62 - step, r: 28 + step, hdg: 210 } : { f: 5 + step, r: 14 + step, hdg: 20 };
                if (arrangement === 'cluster') {
                    const center = kind === 'construction_site' ? { f: 8, r: 13 } : { f: pos.f, r: pos.r };
                    pos = _missionSceneClusterOffset(i, center.f, center.r, feature === 'pallet_stack' ? 3.1 : 3.6);
                }
                add(`feature_cargo_${i + 1}`, kind === 'sar_land' ? 'Support Material abseits Suchziel' : 'Zusatz Material/Fracht', cargo, cargoPool, pos.f, pos.r, { hdgOffsetDeg: pos.hdg });
            } else if (feature === 'road_vehicles') {
                const car = _scenePickTitle(carPool, `feature-car-${i}`, 'Microsoft_Car_EUR_01');
                const fallback = kind === 'sar_land' ? { f: -86 - step, r: 36 + step, hdg: 35 } : { f: -20 - step, r: -1 + step, hdg: i % 2 ? 190 : 15 };
                const anchorNames = ['parking', 'road', 'path'];
                const pos = _missionTargetGeoOffset(anchorNames, fallback.f, fallback.r, { minM: kind === 'sar_land' ? 70 : 20, maxM: kind === 'sar_land' ? 950 : 120, lateralM: i * 8, hdgOffsetDeg: fallback.hdg });
                add(`feature_vehicle_${i + 1}`, kind === 'sar_land' ? 'Suchfahrzeug im Perimeter' : 'Zusatz Fahrzeug', car, carPool, pos.f, pos.r, {
                    hdgOffsetDeg: pos.hdg,
                    placement: kind === 'sar_land' ? 'road/perimeter support' : 'context vehicle',
                    geoAnchor: _missionTargetGeoAnchorDebug(pos, anchorNames)
                });
            } else if (feature === 'emergency_response') {
                const support = _scenePickTitle(primarySupportVehiclePool, `feature-emergency-${i}`, 'Car Bush Medic');
                const fallback = kind === 'sar_land' ? { f: -95 - step, r: 42 + step, hdg: 35 } : { f: -18 - step, r: 12 + step, hdg: 210 };
                const anchorNames = ['parking', 'road', 'path'];
                const pos = _missionTargetGeoOffset(anchorNames, fallback.f, fallback.r, { minM: kind === 'sar_land' ? 75 : 20, maxM: kind === 'sar_land' ? 950 : 120, lateralM: i * 9, hdgOffsetDeg: fallback.hdg });
                add(`feature_emergency_${i + 1}`, kind === 'sar_land' ? 'Einsatzfahrzeug im Suchperimeter' : 'Zusatz Einsatzfahrzeug', support, supportVehiclePool, pos.f, pos.r, {
                    hdgOffsetDeg: pos.hdg,
                    placement: kind === 'sar_land' ? 'road/perimeter support' : 'emergency response',
                    geoAnchor: _missionTargetGeoAnchorDebug(pos, anchorNames)
                });
            } else if (feature === 'people') {
                const person = i % 2 ? personB : personA;
                const fallback = kind === 'sar_land' ? { f: -72 - step, r: 30 + step, hdg: 35 } : { f: 4 + step, r: 9 + step, hdg: 210 };
                const anchorNames = ['path', 'road', 'parking'];
                const pos = _missionTargetGeoOffset(anchorNames, fallback.f, fallback.r, { minM: kind === 'sar_land' ? 55 : 12, maxM: kind === 'sar_land' ? 900 : 95, lateralM: i * 6, hdgOffsetDeg: fallback.hdg });
                add(`feature_person_${i + 1}`, kind === 'sar_land' ? 'Suchtrupp / Einsatzkraft' : 'Zusatz Person', person, peoplePool, pos.f, pos.r, {
                    hdgOffsetDeg: pos.hdg,
                    placement: kind === 'sar_land' ? 'road/path support' : 'context person',
                    geoAnchor: _missionTargetGeoAnchorDebug(pos, anchorNames)
                });
            } else if (feature === 'missing_person') {
                const person = i % 2 ? personB : personA;
                add(`feature_missing_person_${i + 1}`, 'Vermisste / winkende Person', person, peoplePool, 0 + (i * 3), -2 + (i * 2), { hdgOffsetDeg: 180 });
            } else if (feature === 'cones') {
                add(`feature_cone_${(i * 2) + 1}`, 'Zusatz Absperrkegel', cone, markerPool, -7 + step, -3 - step);
                add(`feature_cone_${(i * 2) + 2}`, 'Zusatz Absperrkegel', cone, markerPool, 9 + step, 3 + step);
            } else if (feature === 'debris') {
                const debris = _scenePickTitle(debrisPool, `feature-debris-${i}`, 'Cardboard');
                add(`feature_debris_${i + 1}`, 'Zusatz Debris', debris, debrisPool, -6 + step, -15 - step, { hdgOffsetDeg: 35 + (i * 30) });
            } else if (feature === 'logs') {
                const log = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.natureLogs, `feature-log-${i}`, 'Log_01');
                const pos = _missionTargetGeoOffset(['water', 'forest', 'meadow'], 7 + step, -17 - step, { minM: 12, maxM: 115, lateralM: i * 5, hdgOffsetDeg: 80 + (i * 20) });
                add(`feature_log_${i + 1}`, 'Zusatz Holz/Treibgut', log, MISSION_SCENE_ASSET_POOLS.natureLogs, pos.f, pos.r, { hdgOffsetDeg: pos.hdg });
            } else if (feature === 'liferaft') {
                const raft = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.sarWaterTarget, `feature-liferaft-${i}`, 'LifeRaft');
                add(`feature_liferaft_${i + 1}`, 'Zusatz Rettungsinsel', raft, MISSION_SCENE_ASSET_POOLS.sarWaterTarget, 8 + step, -12 - step, { hdgOffsetDeg: 20 });
            } else if (feature === 'watercraft') {
                const boat = _scenePickTitle(smallBoatPool, `feature-watercraft-${i}`, 'Fishing Boat Red Modular');
                const pos = _missionTargetGeoOffset(['water'], 28 + (i * 18), -20 - (i * 8), { minM: 20, maxM: 130, lateralM: i * 12, hdgOffsetDeg: 130 });
                add(`feature_watercraft_${i + 1}`, 'Zusatz kleines Boot', boat, smallBoatPool, pos.f, pos.r, { hdgOffsetDeg: pos.hdg });
            } else if (feature === 'service_ship') {
                const ship = _scenePickTitle(serviceShipPool, `feature-service-ship-${i}`, 'Microsoft_Ships_AbeilleBourbon_1.0');
                add(`feature_service_ship_${i + 1}`, 'Zusatz Arbeits-/Service-Schiff', ship, serviceShipPool, 34 + (i * 24), -24 - (i * 10), { hdgOffsetDeg: 130 });
            } else if (feature === 'waterfowl') {
                const bird = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.waterfowl, `feature-waterfowl-${i}`, 'Goose');
                const pos = _missionTargetGeoOffset(['water'], 14 + (i * 4), -11 - (i * 3), { minM: 10, maxM: 90, lateralM: i * 5, hdgOffsetDeg: 70 + (i * 35) });
                add(`feature_waterfowl_${i + 1}`, 'Zusatz Wasservogel', bird, MISSION_SCENE_ASSET_POOLS.waterfowl, pos.f, pos.r, { hdgOffsetDeg: pos.hdg });
            } else if (feature === 'wildlife_animals') {
                const animal = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.wildlifeAnimals, `feature-wildlife-${i}`, 'OHemionusFemale');
                const pos = _missionTargetGeoOffset(['meadow', 'forest', 'farmland'], -10 + (i * 6), -14 + (i * 4), { minM: 15, maxM: 125, lateralM: i * 7, hdgOffsetDeg: 45 + (i * 20) });
                add(`feature_wildlife_${i + 1}`, 'Zusatz Wildtier', animal, MISSION_SCENE_ASSET_POOLS.wildlifeAnimals, pos.f, pos.r, { hdgOffsetDeg: pos.hdg });
            } else if (feature === 'animal_herd') {
                const herdCount = Math.max(3, safeCount);
                const anchorBase = _missionTargetGeoOffset(['meadow', 'farmland', 'forest'], -8, 12, { minM: 18, maxM: 135, hdgOffsetDeg: 90 });
                for (let h = 0; h < herdCount; h++) {
                    const animal = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.grazingAnimals, `feature-herd-${i}-${h}`, 'ALerviaFemale');
                    add(`feature_herd_${i + 1}_${h + 1}`, 'Zusatz Tiergruppe', animal, MISSION_SCENE_ASSET_POOLS.grazingAnimals, anchorBase.f + (h * 5), anchorBase.r + ((h % 3) * 4), { hdgOffsetDeg: 90 + (h * 25) });
                }
                break;
            } else if (feature === 'tent') {
                const tent = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.campTents, `feature-camp-tent-${i}`, 'LFPB_AS_Tent_01');
                const pos = _missionTargetGeoOffset(['forest', 'meadow', 'water', 'path'], -16 - step, 10 + step, { minM: 18, maxM: 125, lateralM: i * 7, hdgOffsetDeg: 25 });
                add(`feature_tent_${i + 1}`, 'Zusatz Zelt', tent, MISSION_SCENE_ASSET_POOLS.campTents, pos.f, pos.r, { hdgOffsetDeg: pos.hdg });
            } else if (feature === 'parked_vehicle') {
                const car = _scenePickTitle(carPool, `feature-shore-car-${i}`, 'Microsoft_Car_EUR_02');
                const fallback = kind === 'sar_land' ? { f: -78 - step, r: 34 + step, hdg: 35 } : { f: -22 - step, r: 11 + step, hdg: 205 };
                const anchorNames = ['parking', 'road', 'path'];
                const pos = _missionTargetGeoOffset(anchorNames, fallback.f, fallback.r, { minM: kind === 'sar_land' ? 55 : 18, maxM: kind === 'sar_land' ? 900 : 115, lateralM: i * 7, hdgOffsetDeg: fallback.hdg });
                add(`feature_shore_vehicle_${i + 1}`, kind === 'sar_land' ? 'Abgestelltes Fahrzeug abseits Fundpunkt' : 'Zusatz parkendes Auto', car, carPool, pos.f, pos.r, {
                    hdgOffsetDeg: pos.hdg,
                    placement: kind === 'sar_land' ? 'road/perimeter support' : 'parked vehicle',
                    geoAnchor: _missionTargetGeoAnchorDebug(pos, anchorNames)
                });
            } else if (feature === 'small_equipment') {
                const kit = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.smallCargo, `feature-equipment-${i}`, 'Cardboard');
                const fallback = kind === 'sar_land' ? { f: 8 + step, r: -6 - step, hdg: 10 } : { f: -11 - step, r: 14 + step, hdg: 10 };
                const pos = _missionTargetGeoOffset(['water', 'path', 'road', 'parking'], fallback.f, fallback.r, { minM: 10, maxM: 95, lateralM: i * 4, hdgOffsetDeg: fallback.hdg });
                add(`feature_equipment_${i + 1}`, kind === 'sar_land' ? 'Hinweis / kleine Ausruestung' : 'Zusatz Ausruestung', kit, MISSION_SCENE_ASSET_POOLS.smallCargo, pos.f, pos.r, { hdgOffsetDeg: pos.hdg });
            } else if (feature === 'campfire') {
                const fire = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.fireVfx, `feature-campfire-${i}`, 'VO_Fire_R1_40');
                add(`feature_campfire_${i + 1}`, 'Zusatz Lagerfeuer', fire, MISSION_SCENE_ASSET_POOLS.fireVfx, -7 - step, 8 + step, { hdgOffsetDeg: 0 });
            } else if (feature === 'bus') {
                const bus = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.buses, `feature-bus-${i}`, 'Bus');
                add(`feature_bus_${i + 1}`, 'Zusatz Bus/Shuttle', bus, MISSION_SCENE_ASSET_POOLS.buses, -20 - step, 16 + step, { hdgOffsetDeg: 210 });
            } else if (feature === 'smoke_light') {
                const smoke = _scenePreferredTitle(MISSION_SCENE_ASSET_POOLS.smokeVfx, 'Chimney_Smoke_V1', `feature-smoke-${i}`, 'Chimney_Smoke_V1');
                add(`feature_smoke_${i + 1}`, 'Zusatz Rauchquelle', smoke, MISSION_SCENE_ASSET_POOLS.smokeVfx, 3 + step, 18 + step, { hdgOffsetDeg: 0 });
            } else if (feature === 'signal_smoke') {
                const smoke = _scenePreferredTitle(
                    MISSION_SCENE_ASSET_POOLS.smokeVfx,
                    MISSION_SCENE_SIGNAL_SMOKE_TITLE,
                    `feature-signal-smoke-${i}`,
                    'Chimney_Smoke_V1'
                );
                add(`feature_signal_smoke_${i + 1}`, 'Signalrauch / Hilfezeichen', smoke, MISSION_SCENE_ASSET_POOLS.smokeVfx, 6 + step, -10 - step, {
                    hdgOffsetDeg: 0,
                    altOffsetFt: MISSION_SCENE_SIGNAL_SMOKE_ALT_OFFSET_FT
                });
            } else if (feature === 'fire_small') {
                const fire = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.fireVfx, `feature-fire-${i}`, 'VO_Fire_R1_40');
                add(`feature_fire_${i + 1}`, 'Zusatz Brandherd', fire, MISSION_SCENE_ASSET_POOLS.fireVfx, 5 + step, 16 + step, { hdgOffsetDeg: 0 });
            }
        }
    };
    const finish = () => {
        const baseFeatureCounts = MISSION_TARGET_SCENE_BASE_FEATURE_COUNTS[kind] || {};
        const explicitSurveyFeatures = kind === 'survey_context' ? _missionTargetSceneFeatureHintsFromSpec(kind) : null;
        _missionTargetSceneRequestedFeatures(kind).forEach(feature => {
            if (explicitSurveyFeatures && explicitSurveyFeatures.length && !explicitSurveyFeatures.includes(feature)) return;
            if (!_missionTargetSceneFeatureAllowedForKind(kind, feature)) return;
            const count = _missionTargetSceneFeatureCount(feature);
            const baseCount = Number(baseFeatureCounts[feature] || 0);
            const extraCount = Math.max(0, count - baseCount);
            if (extraCount <= 0) return;
            addFeatureSupplement(feature, extraCount);
        });
        const density = String(_missionTargetSceneSpec()?.density || 'normal').toLowerCase();
        const maxItems = density === 'busy' ? 18 : (density === 'sparse' ? 9 : 14);
        return items.slice(0, maxItems);
    };

    if (kind === 'construction_site') {
        const crane = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.constructionCranes, 'construction-crane', 'Truck Crane Small');
        const dozer = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.constructionEarthmoving, 'construction-earthmoving', 'Bulldozer');
        const truck = _scenePickTitle(primaryTruckPool, 'construction-truck', primaryTruckPool[0] || 'Truck Utility Europe Flush');
        const container = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.cargo, 'construction-cargo', 'CargoContainer01');
        add('construction_crane', 'Kranfahrzeug', crane, MISSION_SCENE_ASSET_POOLS.constructionCranes, -10, 7, { hdgOffsetDeg: 205 });
        add('construction_dozer', 'Erdbaumaschine', dozer, MISSION_SCENE_ASSET_POOLS.constructionEarthmoving, 7, -6, { hdgOffsetDeg: 35 });
        add('construction_truck', 'Baustellen-LKW', truck, truckPool, -18, -7, { hdgOffsetDeg: 180 });
        add('construction_material', 'Baustellenmaterial', container, MISSION_SCENE_ASSET_POOLS.cargo, 4, 10, { hdgOffsetDeg: 15 });
        add('marker_1', 'Baustellenmarkierung', cone, markerPool, -2, -2);
        add('marker_2', 'Baustellenmarkierung', cone, markerPool, 12, 4);
        return finish();
    }

    if (kind === 'powerline_inspection') {
        const pylonBase = MISSION_SCENE_ASSET_POOLS.utilityPower.includes('PowerPylon_Base') ? 'PowerPylon_Base' : _scenePickTitle(MISSION_SCENE_ASSET_POOLS.utilityPower, 'power-pylon-base', 'PowerPylon_Base');
        const generator = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.utilityGenerators, 'power-generator', 'PowerGenerator');
        const utilityTruck = _scenePickTitle(primaryTruckPool, 'power-utility-truck', 'Truck Utility Europe Flush');
        const powerAnchor = _missionTargetGeoAnchor(['power']);
        const anchorDistM = Number(powerAnchor?.distM);
        const powerPos = _missionTargetGeoOffset(['power'], 0, 0, {
            minM: 8,
            maxM: 650,
            distanceM: Number.isFinite(anchorDistM) ? anchorDistM : undefined,
            hdgOffsetDeg: 0
        });
        const followPos = _missionTargetGeoOffset(['power'], powerPos.f + 34, powerPos.r + 7, {
            minM: 20,
            maxM: 700,
            distanceM: Number.isFinite(anchorDistM) ? anchorDistM + 45 : undefined,
            lateralM: Number.isFinite(anchorDistM) ? 8 : 0,
            hdgOffsetDeg: 0
        });
        const roadPos = _missionTargetGeoOffset(['parking', 'road', 'path'], -16, 12, { minM: 22, maxM: 120, hdgOffsetDeg: 205 });
        add('power_pylon_1', 'Strommast', pylonBase, MISSION_SCENE_ASSET_POOLS.utilityPower, powerPos.f, powerPos.r, {
            hdgOffsetDeg: 0,
            placement: 'power anchor',
            geoAnchor: _missionTargetGeoAnchorDebug(powerPos, ['power'])
        });
        add('power_pylon_2', 'Strommast Folgepunkt', pylonBase, MISSION_SCENE_ASSET_POOLS.utilityPower, followPos.f, followPos.r, {
            hdgOffsetDeg: 0,
            placement: 'power anchor follow',
            geoAnchor: _missionTargetGeoAnchorDebug(followPos, ['power'])
        });
        add('utility_truck', 'Utility Fahrzeug', utilityTruck, truckPool, roadPos.f, roadPos.r, {
            hdgOffsetDeg: roadPos.hdg,
            placement: 'road support',
            geoAnchor: _missionTargetGeoAnchorDebug(roadPos, ['parking', 'road', 'path'])
        });
        add('generator', 'Generator', generator, MISSION_SCENE_ASSET_POOLS.utilityGenerators, roadPos.f + 6, roadPos.r + 4, {
            hdgOffsetDeg: roadPos.hdg,
            placement: 'road support equipment',
            geoAnchor: _missionTargetGeoAnchorDebug(roadPos, ['parking', 'road', 'path'])
        });
        add('marker_1', 'Arbeitsbereich', cone, markerPool, roadPos.f + 2, roadPos.r - 3, {
            hdgOffsetDeg: roadPos.hdg,
            placement: 'road support marker',
            geoAnchor: _missionTargetGeoAnchorDebug(roadPos, ['parking', 'road', 'path'])
        });
        return finish();
    }

    if (kind === 'wind_turbine_site') {
        const turbine = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.windTurbines, 'wind-turbine-main', 'WindTurbine');
        const truck = _scenePickTitle(primaryTruckPool, 'wind-turbine-service-truck', primaryTruckPool[0] || 'Truck Utility Europe Flush');
        const turbinePos = _missionTargetGeoOffset(['farmland', 'meadow'], 0, 0, { minM: 12, maxM: 150, hdgOffsetDeg: 0 });
        const roadPos = _missionTargetGeoOffset(['road', 'parking', 'path'], -22, 12, { minM: 26, maxM: 140, hdgOffsetDeg: 205 });
        add('wind_turbine_1', 'Windrad / Windenergieanlage', turbine, MISSION_SCENE_ASSET_POOLS.windTurbines, turbinePos.f, turbinePos.r, { hdgOffsetDeg: 0 });
        add('wind_service_truck', 'Servicefahrzeug Windrad', truck, truckPool, roadPos.f, roadPos.r, { hdgOffsetDeg: roadPos.hdg });
        return finish();
    }

    if (kind === 'erosion_damage') {
        const logA = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.natureLogs, 'erosion-log-a', 'Log_01');
        const logB = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.natureLogs, 'erosion-log-b', 'Log');
        const debris = _scenePickTitle(debrisPool, 'erosion-debris', 'Pallet01_03');
        add('erosion_log_1', 'Treibholz / Bruchkante', logA, MISSION_SCENE_ASSET_POOLS.natureLogs, -6, -8, { hdgOffsetDeg: 70 });
        add('erosion_log_2', 'Treibholz / Bruchkante', logB, MISSION_SCENE_ASSET_POOLS.natureLogs, 2, -11, { hdgOffsetDeg: 112 });
        add('erosion_debris_1', 'Ablagerung', debris, debrisPool, 9, -7, { hdgOffsetDeg: 35 });
        add('marker_1', 'Referenzmarkierung', cone, markerPool, -3, 3);
        return finish();
    }

    if (kind === 'debris_field') {
        const debrisA = _scenePickTitle(debrisPool, 'debris-a', 'Cardboard');
        const debrisB = _scenePickTitle(debrisPool, 'debris-b', 'Pallet01_03');
        const debrisC = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.natureLogs.concat(debrisPool), 'debris-c', 'Log_01');
        add('debris_1', 'Truemmer / Gegenstand', debrisA, debrisPool, -3, -5, { hdgOffsetDeg: 25 });
        add('debris_2', 'Truemmer / Gegenstand', debrisB, debrisPool, 4, -1, { hdgOffsetDeg: 80 });
        add('debris_3', 'Truemmer / Gegenstand', debrisC, debrisPool, 10, 5, { hdgOffsetDeg: 135 });
        return finish();
    }

    if (kind === 'infra_bridge' || kind === 'infra_dam') {
        const utilityTruck = _scenePickTitle(primaryTruckPool, `${kind}-truck`, primaryTruckPool[0] || 'Truck Utility Europe Flush');
        const generator = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.utilityGenerators, `${kind}-generator`, 'PowerGenerator');
        const accessPos = kind === 'infra_bridge'
            ? _missionTargetGeoOffset(['parking', 'road', 'path', 'railway'], -24, 14, { minM: 18, maxM: 130, hdgOffsetDeg: 210 })
            : { f: -14, r: 9, hdg: 210 };
        const devicePos = kind === 'infra_bridge'
            ? _missionTargetGeoOffset(['bridge'], -4, 6, { minM: 4, maxM: 70, hdgOffsetDeg: 30 })
            : { f: -4, r: 6, hdg: 30 };
        add('utility_truck', kind === 'infra_bridge' ? 'Brueckenzufahrt Fahrzeug' : 'Dammservice Fahrzeug', utilityTruck, truckPool, accessPos.f, accessPos.r, { hdgOffsetDeg: accessPos.hdg });
        add('generator', 'Mess-/Versorgungsgeraet', generator, MISSION_SCENE_ASSET_POOLS.utilityGenerators, devicePos.f, devicePos.r, { hdgOffsetDeg: devicePos.hdg });
        add('marker_1', 'Pruefpunkt', cone, markerPool, 2, -3);
        add('marker_2', 'Pruefpunkt', cone, markerPool, 12, 2);
        if (kind === 'infra_dam') {
            const boat = _scenePickTitle(smallBoatPool, 'dam-boat', 'Fishing Boat Red Modular');
            add('boat_1', 'Boot am Wasserbauwerk', boat, smallBoatPool, 28, -18, { hdgOffsetDeg: 120 });
        }
        return finish();
    }

    if (kind === 'industry_site') {
        const truck = _scenePickTitle(primaryTruckPool, 'industry-truck', primaryTruckPool[0] || 'Truck Utility NorthAm');
        const container = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.cargo, 'industry-container', 'CargoContainer01');
        const generator = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.utilityGenerators, 'industry-generator', 'PowerGenerator');
        add('industry_truck', 'Werksfahrzeug', truck, truckPool, -16, 8, { hdgOffsetDeg: 200 });
        add('industry_container', 'Container / Lagerpunkt', container, MISSION_SCENE_ASSET_POOLS.cargo, 3, 8, { hdgOffsetDeg: 10 });
        add('industry_generator', 'Generator / Aggregat', generator, MISSION_SCENE_ASSET_POOLS.utilityGenerators, 8, 2, { hdgOffsetDeg: 40 });
        return finish();
    }

    if (kind === 'water_pollution') {
        const boat = _scenePickTitle(smallBoatPool, 'water-pollution-boat', 'Fishing Boat White Modular');
        const log = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.natureLogs, 'water-log', 'Log_01');
        add('survey_boat', 'Boot am Gewaesser', boat, smallBoatPool, -20, 15, { hdgOffsetDeg: 130 });
        add('floating_debris_1', 'Treibgut / Referenzobjekt', log, MISSION_SCENE_ASSET_POOLS.natureLogs, 0, 0, { hdgOffsetDeg: 70 });
        add('floating_debris_2', 'Treibgut / Referenzobjekt', log, MISSION_SCENE_ASSET_POOLS.natureLogs, 12, -7, { hdgOffsetDeg: 105 });
        return finish();
    }

    if (kind === 'water_context') {
        const log = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.natureLogs, 'water-context-log', 'Log_01');
        const waterPos = _missionTargetGeoOffset(['water'], -4, -5, { minM: 12, maxM: 110, hdgOffsetDeg: 70 });
        add('water_ref_1', 'Ufer-/Wasser Referenz', log, MISSION_SCENE_ASSET_POOLS.natureLogs, waterPos.f, waterPos.r, { hdgOffsetDeg: waterPos.hdg });
        add('water_ref_2', 'Ufer-/Wasser Referenz', log, MISSION_SCENE_ASSET_POOLS.natureLogs, waterPos.f + 12, waterPos.r + 9, { hdgOffsetDeg: 120 });
        return finish();
    }

    if (kind === 'wildlife_site') {
        const log = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.natureLogs, 'wildlife-log', 'Log_01');
        const habitatPos = _missionTargetGeoOffset(['meadow', 'forest', 'farmland'], -5, -5, { minM: 14, maxM: 115, hdgOffsetDeg: 65 });
        add('habitat_ref_1', 'Habitat Referenz', log, MISSION_SCENE_ASSET_POOLS.natureLogs, habitatPos.f, habitatPos.r, { hdgOffsetDeg: habitatPos.hdg });
        add('habitat_ref_2', 'Habitat Referenz', log, MISSION_SCENE_ASSET_POOLS.natureLogs, habitatPos.f + 13, habitatPos.r + 9, { hdgOffsetDeg: 122 });
        return finish();
    }

    if (kind === 'event_site') {
        const bus = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.buses, 'event-bus', 'Bus');
        const van = _scenePickTitle(vanPool, 'event-van', vanPool[0] || 'Microsoft_Van_EUR');
        add('event_bus', 'Event Shuttle', bus, MISSION_SCENE_ASSET_POOLS.buses, -15, 9, { hdgOffsetDeg: 210 });
        add('event_van', 'Event Fahrzeug', van, vanPool, -8, -8, { hdgOffsetDeg: 190 });
        add('marker_1', 'Absperrung', cone, markerPool, 2, -2);
        add('marker_2', 'Absperrung', cone, markerPool, 9, 4);
        return finish();
    }

    if (kind === 'road_incident') {
        const carA = _scenePickTitle(carPool, 'incident-car-a', 'Microsoft_Car_EUR_01');
        const carB = _scenePickTitle(carPool, 'incident-car-b', 'Microsoft_Car_EUR_03');
        const support = _scenePickTitle(primarySupportVehiclePool, 'incident-support', 'Car Bush Medic');
        const roadPos = _missionTargetGeoOffset(['road', 'parking'], 0, -8, { minM: 12, maxM: 100, hdgOffsetDeg: 18 });
        add('incident_car_1', 'Unfallfahrzeug 1', carA, carPool, roadPos.f, roadPos.r, { hdgOffsetDeg: roadPos.hdg });
        add('incident_car_2', 'Unfallfahrzeug 2', carB, carPool, roadPos.f + 7, roadPos.r + 3, { hdgOffsetDeg: 198 });
        add('support_vehicle', 'Einsatzfahrzeug', support, supportVehiclePool, roadPos.f - 13, roadPos.r + 19, { hdgOffsetDeg: 210 });
        add('person_1', 'Person an Unfallstelle', personA, peoplePool, 3, -12, { hdgOffsetDeg: 90 });
        add('person_2', 'Person an Unfallstelle', personB, peoplePool, -2, -13, { hdgOffsetDeg: 110 });
        add('marker_1', 'Absperrkegel', cone, markerPool, -5, -2);
        add('marker_2', 'Absperrkegel', cone, markerPool, 11, 1);
        return finish();
    }

    if (kind === 'sar_water') {
        const raft = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.sarWaterTarget, 'sar-water-raft', 'LifeRaft');
        const boat = _scenePickTitle(serviceShipPool, 'sar-water-service-ship', 'Microsoft_Ships_AbeilleBourbon_1.0');
        const waterPos = _missionTargetGeoOffset(['water'], 0, 0, { minM: 10, maxM: 115, hdgOffsetDeg: 20 });
        add('liferaft', 'Rettungsinsel', raft, MISSION_SCENE_ASSET_POOLS.sarWaterTarget, waterPos.f, waterPos.r, { hdgOffsetDeg: waterPos.hdg });
        add('service_ship_1', 'SAR Arbeits-/Service-Schiff', boat, serviceShipPool, waterPos.f - 32, waterPos.r + 23, { hdgOffsetDeg: 135 });
        return finish();
    }

    if (kind === 'sar_land') {
        const requestedFeatures = _missionTargetSceneRequestedFeatures(kind);
        const wantsMissingPerson = requestedFeatures.includes('missing_person');
        const hasSupportObjects = requestedFeatures.some(feature => ['emergency_response', 'people', 'road_vehicles', 'parked_vehicle'].includes(feature));
        if (wantsMissingPerson || !hasSupportObjects) {
            if (wantsMissingPerson) {
                const targetPerson = _scenePickTitle([personA, personB].filter(Boolean), 'sar-land-missing-person', personA || personB);
                add('missing_person', 'Vermisste / winkende Person', targetPerson, peoplePool, 0, 0, {
                    hdgOffsetDeg: 180,
                    placement: 'search target'
                });
            } else {
                const kit = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.smallCargo, 'sar-land-clue-equipment', 'Cardboard');
                const cluePos = _missionTargetGeoOffset(['path', 'forest', 'meadow'], 8, -6, { minM: 10, maxM: 120, hdgOffsetDeg: 15 });
                add('search_clue_equipment', 'Hinweis / kleine Ausruestung', kit, MISSION_SCENE_ASSET_POOLS.smallCargo, cluePos.f, cluePos.r, {
                    hdgOffsetDeg: cluePos.hdg,
                    placement: 'search clue near target',
                    geoAnchor: _missionTargetGeoAnchorDebug(cluePos, ['path', 'forest', 'meadow'])
                });
            }
        }
        return finish();
    }

    if (kind === 'medical_pickup') {
        const vehicle = _scenePickTitle(primarySupportVehiclePool, 'medical-vehicle', 'Car Bush Medic');
        const medicalPool = MISSION_SCENE_ASSET_POOLS.medicalEquipment.concat(MISSION_SCENE_ASSET_POOLS.smallCargo, MISSION_SCENE_ASSET_POOLS.cargo);
        const cargo = _scenePickTitle(medicalPool, 'medical-cargo', 'Cardboard');
        add('medical_vehicle', 'Medizinisches Fahrzeug', vehicle, MISSION_SCENE_ASSET_POOLS.medicalVehicles.concat(vanPool), -13, 9, { hdgOffsetDeg: 205 });
        add('person_1', 'Medizinisches Team', personA, peoplePool, 1, 5, { hdgOffsetDeg: 180 });
        add('person_2', 'Medizinisches Team', personB, peoplePool, 4, 7, { hdgOffsetDeg: 220 });
        add('cargo_1', 'Medizinische Kiste', cargo, medicalPool, 2, 9);
        return finish();
    }

    if (kind === 'cargo_site') {
        const vehicle = _scenePickTitle(primaryTruckPool, 'target-cargo-vehicle', primaryTruckPool[0] || 'Microsoft_Van_EUR');
        const cargoA = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.cargo, 'target-cargo-a', 'Pallet01_02');
        const cargoB = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.smallCargo.concat(MISSION_SCENE_ASSET_POOLS.cargo), 'target-cargo-b', 'Cardboard');
        add('cargo_vehicle', 'Frachtfahrzeug', vehicle, truckPool, -14, 9, { hdgOffsetDeg: 205 });
        add('cargo_1', 'Fracht', cargoA, MISSION_SCENE_ASSET_POOLS.cargo, 1, 4);
        add('cargo_2', 'Fracht klein', cargoB, MISSION_SCENE_ASSET_POOLS.smallCargo.concat(MISSION_SCENE_ASSET_POOLS.cargo), 3, 8);
        add('person_1', 'Bodencrew', personA, peoplePool, 6, 6, { hdgOffsetDeg: 230 });
        return finish();
    }

    if (kind === 'media_site') {
        const vehicle = _scenePickTitle(vanPool, `${kind}-vehicle`, vanPool[0] || 'Microsoft_Van_EUR');
        const cargo = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.smallCargo.concat(MISSION_SCENE_ASSET_POOLS.cargo), `${kind}-kit`, 'Cardboard');
        add('work_vehicle', 'Medienfahrzeug', vehicle, vanPool, -12, 8, { hdgOffsetDeg: 210 });
        add('equipment_1', 'Kameraausruestung', cargo, MISSION_SCENE_ASSET_POOLS.smallCargo.concat(MISSION_SCENE_ASSET_POOLS.cargo), 2, 6);
        add('person_1', 'Kamerateam', personA, peoplePool, 5, 5, { hdgOffsetDeg: 200 });
        add('marker_1', 'Markierung', cone, markerPool, -1, -3);
        return finish();
    }

    if (kind === 'survey_context') {
        const requestedFeatures = _missionTargetSceneFeatureHintsFromSpec(kind);
        const hasConcreteRequestedFeatures = requestedFeatures.some(feature => !['logs', 'debris'].includes(feature));
        if (!hasConcreteRequestedFeatures) {
            const ref = _scenePickTitle(debrisPool, 'survey-context-ref', 'Log_01');
            const contextPos = _missionTargetGeoOffset(['meadow', 'farmland', 'forest', 'road'], -2, -4, { minM: 12, maxM: 110, hdgOffsetDeg: 35 });
            add('survey_ref_1', 'Survey Referenzobjekt', ref, debrisPool, contextPos.f, contextPos.r, { hdgOffsetDeg: contextPos.hdg });
            add('survey_ref_2', 'Survey Referenzobjekt', ref, debrisPool, contextPos.f + 9, contextPos.r + 9, { hdgOffsetDeg: 130 });
        }
        return finish();
    }

    return finish();
}

window.missionTargetSceneEnsureSpawned = function(reason = 'mission-start') {
    if (window.simModeActive || !window.liveTrackerConnected) return false;
    const sceneId = _missionTargetSceneId();
    const kind = _missionTargetSceneKind();
    const point = _missionTargetScenePoint();
    if (!point) {
        _missionTargetSceneRequestTerrain();
        return false;
    }
    if (!kind || !point) return false;
    const status = window.missionTargetSceneStatus || {};
    if (status.sceneId === sceneId && (status.spawned || status.spawnRequested)) return false;
    if (status.sceneId === sceneId && status.lastCommand?.type === 'mission_scene_spawn' && (Date.now() - Number(status.lastCommandAt || 0)) < 15000) return false;
    const items = _missionTargetSceneItems(kind);
    if (!items.length) return false;
    const appResolvedTargetScene = {
        sceneId,
        reason,
        requestedSpec: _missionTargetSceneSpec(),
        targetGeoContext: _missionTargetGeoContext(),
        missionTruth: (typeof currentMissionData !== 'undefined' && currentMissionData)
            ? (currentMissionData.missionTruth || currentMissionData.missionContract?.missionTruth || window.activeMissionContract?.missionTruth || null)
            : (window.activeMissionContract?.missionTruth || null),
        resolvedKind: kind,
        point,
        itemCount: items.length,
        items: _missionSceneDebugSummarizeItems(items)
    };
    _missionSceneDebugPatch({ appResolvedTargetScene }, 'target-scene-resolved');
    const commandId = window.sendTrackerCommand({
        type: 'mission_scene_spawn',
        sceneId,
        reason,
        targetSceneKind: kind,
        lat: point.lat,
        lon: point.lon,
        altFt: point.altFt,
        hdg: point.hdg,
        items
    });
    if (!commandId) return false;
    window.missionTargetSceneStatus = {
        ...window.missionTargetSceneStatus,
        sceneId,
        kind,
        lastCommandAt: Date.now(),
        lastCommand: { type: 'mission_scene_spawn', commandId, reason },
        spawnRequested: true,
        clearRequested: false,
        cleared: false,
        clearedCount: 0,
        spawned: false,
        spawnedCount: 0,
        error: null
    };
    if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
    return true;
};

window.missionTargetSceneDebugPreview = function(reason = 'planned-target-scene') {
    const sceneId = _missionTargetSceneId();
    const kind = _missionTargetSceneKind();
    const point = _missionTargetScenePoint({ allowMissingTerrain: true });
    if (!kind || !point) return null;
    const items = _missionTargetSceneItems(kind);
    if (!items.length) return null;
    const command = {
        type: 'mission_scene_target_preview',
        sceneId,
        reason,
        targetSceneKind: kind,
        lat: point.lat,
        lon: point.lon,
        altFt: point.altFt,
        hdg: point.hdg,
        items
    };
    const commandSummary = _missionSceneDebugCommandSummary(command, null, null);
    return {
        appResolved: {
            sceneId,
            reason,
            requestedSpec: _missionTargetSceneSpec(),
            targetGeoContext: _missionTargetGeoContext(),
            missionTruth: (typeof currentMissionData !== 'undefined' && currentMissionData)
                ? (currentMissionData.missionTruth || currentMissionData.missionContract?.missionTruth || window.activeMissionContract?.missionTruth || null)
                : (window.activeMissionContract?.missionTruth || null),
            resolvedKind: kind,
            point,
            itemCount: items.length,
            items: _missionSceneDebugSummarizeItems(items)
        },
        command: commandSummary
    };
};

window.missionTargetSceneClear = function(reason = 'mission-target-clear') {
    const ids = [...new Set([
        window.missionTargetSceneStatus?.sceneId,
        _missionTargetSceneId()
    ].filter(Boolean).map(String))];
    let sent = false;
    ids.forEach(sceneId => {
        const commandId = window.sendTrackerCommand({
            type: 'mission_scene_clear',
            sceneId,
            reason
        });
        if (!commandId) return;
        sent = true;
        window.missionTargetSceneStatus = {
            ...window.missionTargetSceneStatus,
            sceneId,
            lastCommandAt: Date.now(),
            lastCommand: { type: 'mission_scene_clear', commandId, reason },
            clearRequested: true
        };
        if (typeof window.vpRenderMissionSceneTargetMarker === 'function') {
            try { window.vpRenderMissionSceneTargetMarker(); } catch (_) {}
        }
    });
    if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
    return sent;
};

window.boardingMarkerSpawn = function(reason = 'boarding-marker') {
    if (!isBoardingMarkerEnabled()) return false;
    const pos = window.lastLiveGpsPos || {};
    const gate = _missionSceneFlightGate(window.lastLiveFlightData || {});
    if (!gate.rawHasPosition || !gate.plausiblePosition || !gate.nearDeparture || !gate.canStage) {
        return false;
    }
    const cfg = _missionSceneBoardingConfig();
    const markerTitle = BOARDING_MARKER_TITLE;
    const path = Array.isArray(cfg.path) && cfg.path.length >= 2 ? cfg.path : [cfg.spawn, cfg.cargo, cfg.target];
    const labels = Array.isArray(cfg.pathLabels) && cfg.pathLabels.length === path.length
        ? cfg.pathLabels
        : path.map((_, index) => index === 0 ? 'Spawn' : (index === path.length - 1 ? 'Boarding' : (index === Number(cfg.cargoIndex) ? 'Cargo' : `Wegpunkt ${index}`)));
    return !!window.sendTrackerCommand({
        type: 'mission_scene_spawn',
        sceneId: _boardingMarkerSceneId(),
        reason,
        lat: Number(pos.lat),
        lon: Number(pos.lon),
        altFt: Number.isFinite(Number(pos.alt)) ? Number(pos.alt) : 0,
        hdg: Number.isFinite(Number(pos.hdg)) ? Number(pos.hdg) : 0,
        items: path.slice(0, 10).map((point, index) => ({
            kind: `marker_${index + 1}`,
            label: `Boarding ${labels[index] || `Punkt ${index + 1}`} Marker`,
            objectTitle: markerTitle,
            titleCandidates: _sceneTitleCandidates(markerTitle, [markerTitle, 'Cone Medium', 'Cone_Medium']),
            forwardM: Number.isFinite(Number(point.forwardM)) ? Number(point.forwardM) : 0,
            rightM: Number.isFinite(Number(point.rightM)) ? Number(point.rightM) : 0,
            headingMode: 'with_aircraft',
            altOffsetFt: Number.isFinite(Number(point.altOffsetFt)) ? Number(point.altOffsetFt) : 0
        }))
    });
};

window.boardingMarkerClear = function(reason = 'boarding-marker-clear') {
    clearTimeout(boardingMarkerRefreshTimer);
    return !!window.sendTrackerCommand({
        type: 'mission_scene_clear',
        sceneId: _boardingMarkerSceneId(),
        reason
    });
};

window.scheduleBoardingMarkerRefresh = function(reason = 'boarding-marker-refresh') {
    if (!isBoardingMarkerEnabled()) return false;
    clearTimeout(boardingMarkerRefreshTimer);
    boardingMarkerRefreshTimer = setTimeout(() => {
        window.boardingMarkerSpawn?.(reason);
    }, 280);
    return true;
};

function _waitForMissionSceneReady(timeoutMs = 5000) {
    return new Promise(resolve => {
        const started = Date.now();
        const tick = () => {
            const status = window.missionSceneStatus || {};
            if (status.spawned) return resolve(true);
            if (!status.spawnRequested && Date.now() - started > 500) return resolve(false);
            if (Date.now() - started >= timeoutMs) return resolve(!!status.spawned);
            setTimeout(tick, 180);
        };
        tick();
    });
}

function _waitForMissionSceneBoardingAck(commandId, timeoutMs = 15000) {
    if (!commandId) return Promise.resolve({ status: 'not_sent' });
    return new Promise(resolve => {
        const timer = setTimeout(() => {
            missionSceneBoardingWaiters.delete(commandId);
            resolve({ type: 'mission_scene_boarding_ack', commandId, status: 'timeout' });
        }, Math.max(1000, Number(timeoutMs) || 15000));
        missionSceneBoardingWaiters.set(commandId, { resolve, timer });
    });
}

function _resolveMissionSceneBoardingAck(ack) {
    const commandId = ack?.commandId;
    if (!commandId || !missionSceneBoardingWaiters.has(commandId)) return;
    const waiter = missionSceneBoardingWaiters.get(commandId);
    missionSceneBoardingWaiters.delete(commandId);
    clearTimeout(waiter.timer);
    waiter.resolve(ack);
}

function _missionBushPickupBoardingApplySuccess(item = null) {
    if (!item) return false;
    _missionPhaseDebugPush('trigger', {
        name: '_missionBushPickupBoardingApplySuccess',
        itemId: item.id || null,
        itemLabel: item.label || item.storyName || null
    });
    window.missionCargoLoadItem?.(item.id, { mode: 'pickup', render: false, skipAnimation: true });
    const next = _activeBushMissionProgress();
    if (next) {
        _persistBushMissionProgress({
            ...next,
            pickupCompleted: true,
            status: 'pickup_complete'
        });
    }
    _missionCargoRenderDialog('pickup', { skipPayloadRefresh: true });
    return true;
}

async function _missionBushPickupBoarding(item = null, options = {}) {
    if (!_missionBushIsPickupMission() || !item || !_missionCargoIsPassengerItem(item)) return false;
    _missionPhaseDebugPush('trigger', {
        name: '_missionBushPickupBoarding',
        itemId: item.id || null,
        itemLabel: item.label || item.storyName || null,
        reason: options?.reason || null
    });
    if (window.missionSceneStatus?.boardingRequested || window.missionSceneStatus?.boardingActive || missionSceneBoardingPromise) {
        return false;
    }
    const progress = _activeBushMissionProgress();
    if (progress) {
        _persistBushMissionProgress({
            ...progress,
            pickupReady: false,
            status: 'pickup_loading'
        });
    }
    window.missionSceneStatus.boardingRequested = true;
    window.missionSceneStatus.boardingActive = true;
    window.missionSceneStatus.boardingComplete = false;
    window.missionSceneStatus.boardingError = null;
    if (window.simModeActive || !window.liveTrackerConnected) {
        _missionCargoRenderDialog('pickup', { skipPayloadRefresh: true });
        await new Promise(resolve => setTimeout(resolve, 900));
        window.missionSceneStatus.boardingRequested = false;
        window.missionSceneStatus.boardingActive = false;
        window.missionSceneStatus.boardingComplete = true;
        window.missionSceneStatus.boardingError = null;
        window.missionSceneStatus.personBoarded = true;
        return _missionBushPickupBoardingApplySuccess(item);
    }
    const aptPlan = _missionAptArrivalPlan();
    const personPoint = _missionAptArrivalPersonPoint(aptPlan);
    const aptSceneId = window.missionAptArrivalSceneStatus?.sceneId || _missionAptArrivalSceneId();
    const pos = window.lastLiveGpsPos || {};
    const hdg = Number(pos.hdg);
    if (!aptPlan || !personPoint || !aptSceneId || !Number.isFinite(Number(pos.lat)) || !Number.isFinite(Number(pos.lon)) || !Number.isFinite(hdg)) {
        return false;
    }
    const personRel = _missionSceneWorldPointToRelative(Number(pos.lat), Number(pos.lon), hdg, personPoint.worldLat, personPoint.worldLon);
    if (!personRel) return false;
    const boardingConfig = _missionSceneBoardingConfig();
    const spawnPoint = {
        forwardM: Number(personRel.forwardM.toFixed(1)),
        rightM: Number(personRel.rightM.toFixed(1)),
        altOffsetFt: 0
    };
    const joinPoint = boardingConfig.spawn || { forwardM: 16, rightM: -8, altOffsetFt: 0 };
    const targetPoint = boardingConfig.target || { forwardM: 4.5, rightM: 8.5, altOffsetFt: 0 };
    const command = {
        type: 'mission_scene_boarding',
        sceneId: aptSceneId,
        reason: options.reason || 'bush-pickup-boarding',
        ..._missionSceneCommonSceneCommandFields(),
        path: [spawnPoint, joinPoint, targetPoint],
        pathLabels: ['Pickup', 'Join', 'Boarding'],
        spawnPoint,
        targetPoint,
        cargoPathIndex: 1,
        boarderCount: 1,
        passengerCount: 1,
        durationMs: 14000,
        finalHoldMs: 450,
        removePerson: true,
        removeCargoAtWaypoint: false,
        splitCargoRoute: false,
        cargoArrivalSlackMs: 250,
        cargoTimingFactor: 1,
        cargoHoldMs: 0,
        cargoObjectKind: 'cargo',
        lat: Number(pos.lat),
        lon: Number(pos.lon),
        altFt: Number.isFinite(Number(pos.alt)) ? Number(pos.alt) : 0,
        hdg
    };
    const commandId = window.sendTrackerCommand(command);
    if (!commandId) {
        window.missionSceneStatus.boardingRequested = false;
        window.missionSceneStatus.boardingActive = false;
        return false;
    }
    const ack = await _waitForMissionSceneBoardingAck(commandId, 36000);
    if (ack?.status === 'ok') {
        return _missionBushPickupBoardingApplySuccess(item);
    }
    window.missionCargoStatus.error = ack?.error || ack?.status || 'pickup_boarding_failed';
    const next = _activeBushMissionProgress();
    if (next) {
        _persistBushMissionProgress({
            ...next,
            pickupReady: true,
            status: 'pickup_ready'
        });
    }
    _missionCargoRenderDialog('pickup', { skipPayloadRefresh: true });
    return false;
}

function _waitForTrackerPayloadAck(commandId, timeoutMs = 12000) {
    if (!commandId) return Promise.resolve({ status: 'not_sent' });
    return new Promise(resolve => {
        const timer = setTimeout(() => {
            trackerPayloadWaiters.delete(commandId);
            resolve({ type: 'aircraft_payload_ack', commandId, status: 'timeout' });
        }, Math.max(1200, Number(timeoutMs) || 12000));
        trackerPayloadWaiters.set(commandId, { resolve, timer });
    });
}

function _resolveTrackerPayloadAck(ack) {
    const commandId = ack?.commandId;
    if (!commandId || !trackerPayloadWaiters.has(commandId)) return;
    const waiter = trackerPayloadWaiters.get(commandId);
    trackerPayloadWaiters.delete(commandId);
    clearTimeout(waiter.timer);
    waiter.resolve(ack);
}

window.trackerPayloadGet = async function(options = {}) {
    const maxStations = Math.max(1, Math.min(15, Math.round(Number(options?.maxStations ?? 12) || 12)));
    const commandId = window.sendTrackerCommand({
        type: 'aircraft_payload_get',
        maxStations
    });
    if (!commandId) return { status: 'not_sent' };
    window.aircraftPayloadStatus.lastCommandAt = Date.now();
    window.aircraftPayloadStatus.error = null;
    return _waitForTrackerPayloadAck(commandId, Number(options?.timeoutMs) || 12000);
};

window.trackerPayloadSet = async function(stations = [], options = {}) {
    const rows = (Array.isArray(stations) ? stations : [])
        .map(row => ({
            index: Math.round(Number(row?.index)),
            weightLbs: Number(row?.weightLbs)
        }))
        .filter(row => Number.isFinite(row.index) && row.index >= 1 && row.index <= 15 && Number.isFinite(row.weightLbs));
    if (!rows.length) return { status: 'invalid_input', error: 'no_valid_stations' };
    const commandId = window.sendTrackerCommand({
        type: 'aircraft_payload_set',
        maxStations: Math.max(1, Math.min(15, Math.round(Number(options?.maxStations ?? 12) || 12))),
        stations: rows
    });
    if (!commandId) return { status: 'not_sent' };
    window.aircraftPayloadStatus.lastCommandAt = Date.now();
    window.aircraftPayloadStatus.error = null;
    const ack = await _waitForTrackerPayloadAck(commandId, Number(options?.timeoutMs) || 15000);
    if (ack?.status !== 'ok' || options?.refreshAfter === false) return ack;
    return window.trackerPayloadGet({ maxStations: options?.maxStations, timeoutMs: options?.timeoutMs || 12000 });
};

window.missionSceneBoarding = async function(reason = 'boarding') {
    if (missionSceneBoardingPromise) return missionSceneBoardingPromise;
    if (window.missionSceneStatus?.boardingRequested || window.missionSceneStatus?.boardingActive) {
        return { status: 'busy' };
    }
    missionSceneBoardingPromise = (async () => {
        const status = window.missionSceneStatus || {};
        if (typeof window.missionAptArrivalEnsureSpawned === 'function') {
            window.missionAptArrivalEnsureSpawned(`${reason}-apt-arrival-prestage`);
        }
        if (!status.spawned && !status.spawnRequested && typeof window.missionSceneSpawn === 'function') {
            window.missionSceneSpawn('boarding-ensure-scene');
        }
        await _waitForMissionSceneReady(5200);
        if (!window.missionSceneStatus?.spawned) return { status: 'no_scene' };
        const pos = window.lastLiveGpsPos || {};
        const sceneId = status.sceneId || _missionSceneId();
        const boardingConfig = _missionSceneBoardingConfig();
        const command = {
            type: 'mission_scene_boarding',
            sceneId,
            reason,
            ..._missionSceneCommonSceneCommandFields(),
            durationMs: Number.isFinite(Number(boardingConfig.durationMs)) ? Number(boardingConfig.durationMs) : 18000,
            finalHoldMs: 450,
            removePerson: true,
            removeCargoAtWaypoint: false,
            splitCargoRoute: false,
            cargoArrivalSlackMs: 250,
            cargoTimingFactor: 1,
            cargoHoldMs: 0,
            cargoObjectKind: 'cargo'
        };
        if (Number.isFinite(Number(pos.lat)) && Number.isFinite(Number(pos.lon))) {
            command.lat = Number(pos.lat);
            command.lon = Number(pos.lon);
            command.altFt = Number.isFinite(Number(pos.alt)) ? Number(pos.alt) : 0;
            command.hdg = Number.isFinite(Number(pos.hdg)) ? Number(pos.hdg) : 0;
        }
        const commandId = window.sendTrackerCommand(command);
        if (!commandId) return { status: 'not_sent' };
        window.missionSceneStatus.sceneId = sceneId;
        window.missionSceneStatus.lastCommandAt = Date.now();
        window.missionSceneStatus.lastCommand = { type: 'mission_scene_boarding', commandId, reason };
        window.missionSceneStatus.boardingRequested = true;
        window.missionSceneStatus.boardingActive = true;
        window.missionSceneStatus.boardingComplete = false;
        window.missionSceneStatus.boardingError = null;
        if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
        return _waitForMissionSceneBoardingAck(commandId, 36000);
    })();
    try {
        return await missionSceneBoardingPromise;
    } finally {
        missionSceneBoardingPromise = null;
    }
};

window.missionSceneDeboarding = function(reason = 'mission-end') {
    if (window.simModeActive) return false;
    if (window.missionSceneStatus?.deboardingRequested || window.missionSceneStatus?.deboardingActive) return false;
    if (_missionCargoPassengerAlreadyUnloaded()) return false;
    const pos = window.lastLiveGpsPos || {};
    if (!Number.isFinite(Number(pos.lat)) || !Number.isFinite(Number(pos.lon))) return false;
    const sceneId = window.missionSceneStatus?.sceneId || _missionSceneId();
    const aptPickupPoint = _isAtAptArrivalPoint(Number(pos.lat), Number(pos.lon), 0.12) ? _missionAptArrivalPickupPoint() : null;
    const vehicleSupportEnabled = !aptPickupPoint && _missionSceneVehicleSupportEnabled();
    const vehicleAsset = vehicleSupportEnabled ? _missionSceneVehicleAsset() : null;
    const vehicleTitle = vehicleAsset?.title || MISSION_SCENE_DEFAULT_VEHICLE_TITLE;
    const commonFields = _missionSceneCommonSceneCommandFields();
    if (aptPickupPoint) {
        commonFields.vehicleDeparture = false;
        commonFields.vehicleArrival = false;
        commonFields.vehicleReturn = false;
    }
    const primaryGender = _missionScenePassengerGender();
    const personTitle = _missionScenePersonTitle(primaryGender, 'deboarding');
    const command = {
        type: 'mission_scene_deboarding',
        sceneId,
        reason,
        lat: Number(pos.lat),
        lon: Number(pos.lon),
        altFt: Number.isFinite(Number(pos.alt)) ? Number(pos.alt) : 0,
        hdg: Number.isFinite(Number(pos.hdg)) ? Number(pos.hdg) : 0,
        ...commonFields,
        personTitle,
        personTitleCandidates: _missionScenePersonCandidates(primaryGender, personTitle)
    };
    if (vehicleSupportEnabled && vehicleAsset) {
        command.vehicleTitle = vehicleTitle;
        command.vehicleTitleCandidates = _sceneAssetCandidates(vehicleTitle, vehicleAsset.candidates || []);
    }
    if (aptPickupPoint) {
        command.deboardingPickupPoint = aptPickupPoint;
        command.deboardingPickupLabel = aptPickupPoint.label;
        command.deboardingPickupSceneId = _missionAptArrivalSceneId();
    }
    const commandId = window.sendTrackerCommand(command);
    if (!commandId) return false;
    window.missionSceneStatus.sceneId = sceneId;
    window.missionSceneStatus.lastCommandAt = Date.now();
    window.missionSceneStatus.lastCommand = { type: 'mission_scene_deboarding', commandId, reason };
    window.missionSceneStatus.deboardingRequested = true;
    window.missionSceneStatus.deboardingActive = true;
    window.missionSceneStatus.deboardingComplete = false;
    window.missionSceneStatus.deboardingError = null;
    if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
    return true;
};

function _handleTrackerAck(ack) {
    if (!ack || typeof ack !== 'object') return;
    _trackerPendingHandleAck(ack);
    window.missionSmokeStatus.lastAckAt = Date.now();
    window.missionSmokeStatus.lastAck = ack;
    if (ack.type === 'aircraft_payload_get_ack' || ack.type === 'aircraft_payload_set_ack') {
        window.aircraftPayloadStatus.lastAckAt = Date.now();
        window.aircraftPayloadStatus.lastAck = ack;
        if (ack.status === 'ok') {
            window.aircraftPayloadStatus.snapshot = {
                totalWeightLbs: Number.isFinite(Number(ack.totalWeightLbs)) ? Number(ack.totalWeightLbs) : null,
                emptyWeightLbs: Number.isFinite(Number(ack.emptyWeightLbs)) ? Number(ack.emptyWeightLbs) : null,
                fuelWeightLbs: Number.isFinite(Number(ack.fuelWeightLbs)) ? Number(ack.fuelWeightLbs) : null,
                payloadWeightLbs: Number.isFinite(Number(ack.payloadWeightLbs)) ? Number(ack.payloadWeightLbs) : null,
                payloadStationCount: Number.isFinite(Number(ack.payloadStationCount)) ? Math.round(Number(ack.payloadStationCount)) : null,
                sampledStationCount: Number.isFinite(Number(ack.sampledStationCount)) ? Math.round(Number(ack.sampledStationCount)) : null,
                stations: Array.isArray(ack.stations) ? ack.stations.map(row => ({
                    index: Math.round(Number(row?.index)),
                    weightLbs: Number.isFinite(Number(row?.weightLbs)) ? Number(row.weightLbs) : null
                })).filter(row => Number.isFinite(row.index) && row.index >= 1) : []
            };
            window.aircraftPayloadStatus.lastSnapshotAt = Date.now();
            window.aircraftPayloadStatus.error = null;
            if (_missionCargoHasActiveMission()) {
                const manifest = _missionCargoEnsureManifest();
                _missionCargoStorePayloadBaselineIfNeeded(window.aircraftPayloadStatus.snapshot, manifest?.key || '');
                if (window.missionCargoStatus.payloadBaseline) {
                    window.missionCargoStatus.payloadPlan = _missionCargoBuildPlanFromManifest(manifest, window.missionCargoStatus.payloadBaseline);
                }
            }
            if (document.getElementById('missionCargoOverlay')?.style.display === 'flex') {
                const mode = window.missionCargoStatus?.lastMode === 'unload'
                    ? 'unload'
                    : (window.missionCargoStatus?.lastMode === 'pickup' ? 'pickup' : 'load');
                _missionCargoRenderDialog(mode, { skipPayloadRefresh: true });
            }
        } else {
            window.aircraftPayloadStatus.error = ack.error || ack.status || 'payload_command_failed';
        }
        try {
            window.dispatchEvent(new CustomEvent('missioncargopayloadchange', {
                detail: {
                    status: ack.status || 'unknown',
                    source: ack.type || '',
                    ack
                }
            }));
        } catch (_) {}
        _resolveTrackerPayloadAck(ack);
        return;
    }
    if (/^mission_(scene|smoke)_/i.test(String(ack.type || ''))) {
        _missionSceneDebugPatch({ lastAck: ack }, `tracker-ack:${ack.type}`);
    }
    if (ack.type === 'mission_scene_spawn_ack' || ack.type === 'mission_scene_clear_ack' || ack.type === 'mission_scene_boarding_ack' || ack.type === 'mission_scene_deboarding_ack' || ack.type === 'mission_scene_object_remove_ack' || ack.type === 'mission_scene_object_spawn_ack') {
        if (ack.type === 'mission_scene_object_remove_ack' || ack.type === 'mission_scene_object_spawn_ack') {
            window.missionCargoStatus.lastAckAt = Date.now();
            window.missionCargoStatus.lastAck = ack;
            window.missionCargoStatus.error = ack.status === 'ok' || ack.status === 'noop' ? null : (ack.error || ack.status || 'cargo_scene_command_failed');
            if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
            _updateMissionRuntimeUi();
            return;
        }
        const targetSceneId = window.missionTargetSceneStatus?.sceneId || _missionTargetSceneId();
        if (ack.sceneId && targetSceneId && ack.sceneId === targetSceneId) {
            window.missionTargetSceneStatus.lastAckAt = Date.now();
            window.missionTargetSceneStatus.lastAck = ack;
            window.missionTargetSceneStatus.sceneId = ack.sceneId;
            if (ack.type === 'mission_scene_spawn_ack') {
                window.missionTargetSceneStatus.spawnRequested = false;
                window.missionTargetSceneStatus.clearRequested = false;
                window.missionTargetSceneStatus.spawned = ack.status === 'ok';
                window.missionTargetSceneStatus.spawnedCount = Number(ack.spawned || 0);
                window.missionTargetSceneStatus.spawnedByKind = ack.spawnedByKind || null;
                window.missionTargetSceneStatus.error = ack.status === 'ok' ? null : (ack.error || ack.status || 'target_scene_spawn_failed');
            } else if (ack.type === 'mission_scene_clear_ack') {
                window.missionTargetSceneStatus.spawnRequested = false;
                window.missionTargetSceneStatus.clearRequested = false;
                window.missionTargetSceneStatus.spawned = false;
                window.missionTargetSceneStatus.spawnedCount = 0;
                window.missionTargetSceneStatus.spawnedByKind = null;
                window.missionTargetSceneStatus.cleared = ack.status === 'ok' || ack.status === 'noop';
                window.missionTargetSceneStatus.clearedCount = Number(ack.cleared || 0);
                window.missionTargetSceneStatus.error = null;
            }
            if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
            _updateMissionRuntimeUi();
            return;
        }
        const aptArrivalSceneId = window.missionAptArrivalSceneStatus?.sceneId || _missionAptArrivalSceneId();
        if (ack.sceneId && aptArrivalSceneId && ack.sceneId === aptArrivalSceneId) {
            window.missionAptArrivalSceneStatus.lastAckAt = Date.now();
            window.missionAptArrivalSceneStatus.lastAck = ack;
            window.missionAptArrivalSceneStatus.sceneId = ack.sceneId;
            if (ack.type === 'mission_scene_spawn_ack') {
                window.missionAptArrivalSceneStatus.spawnRequested = false;
                window.missionAptArrivalSceneStatus.clearRequested = false;
                window.missionAptArrivalSceneStatus.spawned = ack.status === 'ok';
                window.missionAptArrivalSceneStatus.spawnedCount = Number(ack.spawned || 0);
                window.missionAptArrivalSceneStatus.spawnedByKind = ack.spawnedByKind || null;
                window.missionAptArrivalSceneStatus.error = ack.status === 'ok' ? null : (ack.error || ack.status || 'apt_arrival_scene_spawn_failed');
            } else if (ack.type === 'mission_scene_clear_ack') {
                window.missionAptArrivalSceneStatus.spawnRequested = false;
                window.missionAptArrivalSceneStatus.clearRequested = false;
                window.missionAptArrivalSceneStatus.spawned = false;
                window.missionAptArrivalSceneStatus.spawnedCount = 0;
                window.missionAptArrivalSceneStatus.spawnedByKind = null;
                window.missionAptArrivalSceneStatus.cleared = ack.status === 'ok' || ack.status === 'noop';
                window.missionAptArrivalSceneStatus.clearedCount = Number(ack.cleared || 0);
                window.missionAptArrivalSceneStatus.error = null;
            } else if (ack.type === 'mission_scene_boarding_ack') {
                window.missionSceneStatus.boardingRequested = false;
                window.missionSceneStatus.boardingActive = false;
                window.missionSceneStatus.boardingComplete = ack.status === 'ok';
                window.missionSceneStatus.boardingError = ack.status === 'ok' ? null : (ack.error || ack.status || 'scene_boarding_failed');
                window.missionSceneStatus.personBoarded = ack.status === 'ok' && !!Number(ack.boarded || 0);
                _resolveMissionSceneBoardingAck(ack);
            }
            if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
            _updateMissionRuntimeUi();
            return;
        }
        const currentSceneId = window.missionSceneStatus?.sceneId || _missionSceneId();
        if (ack.sceneId && currentSceneId && ack.sceneId !== currentSceneId) return;
        window.missionSceneStatus.lastAckAt = Date.now();
        window.missionSceneStatus.lastAck = ack;
        if (ack.sceneId) window.missionSceneStatus.sceneId = ack.sceneId;
        if (ack.type === 'mission_scene_spawn_ack') {
            window.missionSceneStatus.spawnRequested = false;
            window.missionSceneStatus.clearRequested = false;
            window.missionSceneStatus.spawned = ack.status === 'ok';
            window.missionSceneStatus.spawnedCount = Number(ack.spawned || 0);
            window.missionSceneStatus.spawnedByKind = ack.spawnedByKind || null;
            window.missionSceneStatus.cleared = false;
            window.missionSceneStatus.error = ack.status === 'ok' ? null : (ack.error || ack.status || 'scene_spawn_failed');
            window.missionSceneStatus.boardingComplete = false;
            window.missionSceneStatus.personBoarded = false;
            if (ack.status === 'ok') _missionCargoRemoveLoadedSceneObjects('cargo-loaded-after-scene-spawn');
        } else if (ack.type === 'mission_scene_clear_ack') {
            window.missionSceneStatus.spawnRequested = false;
            window.missionSceneStatus.clearRequested = false;
            window.missionSceneStatus.spawned = false;
            window.missionSceneStatus.spawnedCount = 0;
            window.missionSceneStatus.spawnedByKind = null;
            window.missionSceneStatus.cleared = ack.status === 'ok' || ack.status === 'noop';
            window.missionSceneStatus.clearedCount = Number(ack.cleared || 0);
            window.missionSceneStatus.boardingRequested = false;
            window.missionSceneStatus.boardingActive = false;
            window.missionSceneStatus.boardingComplete = false;
            window.missionSceneStatus.personBoarded = false;
            window.missionSceneStatus.error = null;
            if (window.missionSceneStatus.respawnAfterClear) {
                window.missionSceneStatus.respawnAfterClear = false;
                setTimeout(() => _missionSceneHandleFlightTick(window.lastLiveFlightData || {}, 'mission-runtime-reset-respawn'), 350);
            }
        } else if (ack.type === 'mission_scene_boarding_ack') {
            window.missionSceneStatus.boardingRequested = false;
            window.missionSceneStatus.boardingActive = false;
            window.missionSceneStatus.boardingComplete = ack.status === 'ok';
            window.missionSceneStatus.boardingError = ack.status === 'ok' ? null : (ack.error || ack.status || 'scene_boarding_failed');
            window.missionSceneStatus.personBoarded = ack.status === 'ok' && !!Number(ack.boarded || 0);
            if (ack.status === 'ok') {
                _missionCargoMarkPassengerLoaded({ reason: 'boarding-ack-passenger-sync' });
                _missionCargoSyncPayloadToSim('boarding-ack').catch(() => {});
                _missionCargoScheduleStartReadyPromotion('boarding-ack');
                setTimeout(() => {
                    try {
                        const alreadyPlayed = (typeof window.paxVoiceBoardingDone === 'function')
                            ? !!window.paxVoiceBoardingDone()
                            : false;
                        if (!alreadyPlayed && typeof window.paxVoicePlayBoarding === 'function') {
                            const p = window.paxVoicePlayBoarding();
                            if (p && typeof p.catch === 'function') p.catch(() => {});
                        }
                    } catch (_) {}
                }, 300);
            }
            _resolveMissionSceneBoardingAck(ack);
        } else {
            window.missionSceneStatus.deboardingRequested = false;
            window.missionSceneStatus.deboardingActive = false;
            window.missionSceneStatus.deboardingComplete = ack.status === 'ok';
            window.missionSceneStatus.deboardingError = ack.status === 'ok' ? null : (ack.error || ack.status || 'scene_deboarding_failed');
            if (ack.status === 'ok') window.missionSceneStatus.personBoarded = false;
        }
        if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
        _updateMissionRuntimeUi();
        return;
    }
    const fs = _activeFireScenario();
    if (!fs || !fs.smoke || (ack.missionId && ack.missionId !== fs.missionId)) return;
    if (ack.type === 'mission_smoke_spawn_ack') {
        fs.smoke.spawnAckAt = Date.now();
        fs.smoke.spawned = ack.status === 'ok';
        fs.smoke.spawnedCount = Number(ack.spawned || 0);
        fs.smoke.spawnMode = ack.spawnMode || fs.smoke.spawnMode || null;
        fs.smoke.teleported = Number(ack.teleported || 0);
        fs.smoke.spawnedByKind = ack.spawnedByKind || null;
        fs.smoke.requestedByKind = ack.requestedByKind || null;
        fs.smoke.spawnError = ack.status === 'ok' ? null : (ack.error || ack.status || 'spawn_failed');
    } else if (ack.type === 'mission_smoke_clear_ack') {
        fs.smoke.clearAckAt = Date.now();
        fs.smoke.spawned = false;
        fs.smoke.cleared = ack.status === 'ok' || ack.status === 'noop';
    }
    _persistMissionSmokeState();
    if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
}

function _setFireDebugStorageOptions(options = {}) {
    try {
        localStorage.setItem('ga_fire_debug', '1');
        localStorage.setItem('ga_fire_truth_override', 'fire');
        if (options.extent) localStorage.setItem('ga_fire_extent_override', options.extent);
        if (Object.prototype.hasOwnProperty.call(options, 'testMode')) {
            const mode = _normalizeFireTestMode(options.testMode);
            if (mode) localStorage.setItem('ga_fire_test_mode', mode);
            else localStorage.removeItem('ga_fire_test_mode');
        }
        if (options.spawnMode) localStorage.setItem('ga_fire_spawn_mode', options.spawnMode);
        if (Number.isFinite(Number(options.fireAltOffsetFt))) localStorage.setItem('ga_fire_alt_offset_ft', String(Math.round(Number(options.fireAltOffsetFt))));
        if (Number.isFinite(Number(options.fireCount))) localStorage.setItem('ga_fire_count', String(Math.round(Number(options.fireCount))));
        if (Number.isFinite(Number(options.fireRadiusM))) localStorage.setItem('ga_fire_radius_m', String(Math.round(Number(options.fireRadiusM))));
    } catch (_) {}
}

function _forceFireMissionDebugSpawn(reason = 'debug-force-smoke', options = {}) {
    const fs = _activeFireScenario();
    if (!fs || !fs.smoke) return false;
    _setFireDebugStorageOptions(options);
    fs.truth = 'fire';
    fs.debugOverride = options.debugOverride || 'force_fire_runtime';
    fs.extent = options.extent || (fs.extent && fs.extent !== 'false_alarm' ? fs.extent : 'single_smoke');
    _ensureFireSmokeSites(fs);
    _applyFireRuntimeOverrides(fs, { forceRebuild: true });
    fs.smoke.spawned = false;
    fs.smoke.spawnRequestedAt = 0;
    fs.smoke.spawnSuppressed = false;
    fs.smoke.spawnError = null;
    fs.smoke.cleared = false;
    _persistMissionSmokeState();
    const sent = window.missionSmokeEnsureSpawned(reason);
    if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
    return sent;
}

window.fireMissionDebugForceSmoke = function(reason = 'debug-force-smoke') {
    return _forceFireMissionDebugSpawn(reason, {
        debugOverride: 'force_smoke_runtime',
        extent: 'single_smoke',
        testMode: '',
        spawnMode: typeof window.fireMissionSpawnMode === 'function' ? window.fireMissionSpawnMode() : 'target'
    });
};

window.fireMissionDebugForceSmokeAndFire = function(reason = 'debug-force-smoke-fire') {
    return _forceFireMissionDebugSpawn(reason, {
        debugOverride: 'force_smoke_fire_runtime',
        extent: 'major_fire',
        testMode: 'offset_ladder',
        spawnMode: 'target',
        fireAltOffsetFt: 0,
        fireCount: 1,
        fireRadiusM: 0
    });
};

window.fireMissionDebugForceFireOnly = function(reason = 'debug-force-fire-only') {
    return _forceFireMissionDebugSpawn(reason, {
        debugOverride: 'force_fire_only_runtime',
        extent: 'major_fire',
        testMode: 'fire_only_ladder',
        spawnMode: 'target',
        fireAltOffsetFt: 0,
        fireCount: 1,
        fireRadiusM: 0
    });
};

window.fireMissionDebugClearSmoke = function(reason = 'debug-clear-smoke') {
    const sent = window.missionSmokeClear(reason);
    if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
    return sent;
};

window.fireMissionSmokeDebugSummary = function() {
    const fs = _activeFireScenario();
    const scene = window.missionSceneStatus || {};
    const targetScene = window.missionTargetSceneStatus || {};
    const sceneParts = [
        scene.spawnRequested ? 'scenePending=1' : '',
        scene.spawned ? `sceneSpawned=${scene.spawnedCount || '?'}` : '',
        scene.blockReason ? `sceneGate=${scene.blockReason}` : '',
        scene.lastGate ? `sceneGround=${scene.lastGate.groundLike ? 'Y' : 'N'} agl=${scene.lastGate.agl == null ? '?' : Math.round(scene.lastGate.agl)} gs=${Math.round(Number(scene.lastGate.gs || 0))}${Number.isFinite(Number(scene.lastGate.depDistNm)) ? ` dep=${Number(scene.lastGate.depDistNm).toFixed(1)}nm` : ''}` : '',
        scene.lastCommandAt ? `sceneReq=${new Date(scene.lastCommandAt).toLocaleTimeString('de-DE')}` : '',
        scene.lastAck ? `sceneAck=${scene.lastAck.type || '?'}:${scene.lastAck.status || '?'}` : '',
        scene.spawnedByKind ? `sceneKind=${Object.entries(scene.spawnedByKind).map(([k, v]) => `${k}:${v}`).join(',')}` : '',
        scene.boardingActive ? 'boarding=active' : '',
        scene.boardingComplete ? 'boarding=done' : '',
        scene.boardingError ? `boardingError=${scene.boardingError}` : '',
        scene.autoClearedFor ? 'sceneAirborneClear=1' : '',
        scene.error ? `sceneError=${scene.error}` : '',
        targetScene.spawnRequested ? `targetScenePending=${targetScene.kind || '?'}` : '',
        targetScene.spawned ? `targetScene=${targetScene.kind || '?'}:${targetScene.spawnedCount || '?'}` : '',
        targetScene.error ? `targetSceneError=${targetScene.error}` : ''
    ].filter(Boolean);
    if (!fs) return sceneParts.length ? `build=${FIRE_DEBUG_SYNC_BUILD} | ${sceneParts.join(' | ')}` : 'Keine Fire-Mission aktiv.';
    const smoke = fs.smoke || {};
    const ack = window.missionSmokeStatus?.lastAck || null;
    const parts = [
        `build=${FIRE_DEBUG_SYNC_BUILD}`,
        `truth=${fs.truth || 'n/a'}${fs.debugOverride ? ` (${fs.debugOverride})` : ''}`,
        `extent=${fs.extent || 'n/a'}`,
        `mode=${smoke.spawnMode || (typeof window.fireMissionSpawnMode === 'function' ? window.fireMissionSpawnMode() : 'target')}`,
        `sites=${Array.isArray(smoke.sites) ? smoke.sites.length : 0}`,
        fs.fire?.enabled ? `fireSites=${Array.isArray(fs.fire.sites) ? fs.fire.sites.length : 0}` : '',
        fs.fire?.enabled ? `fire=${fs.fire.objectTitle || 'VO_Fire_R1_40'}@${Number.isFinite(Number(fs.fire.altOffsetFt)) ? Math.round(Number(fs.fire.altOffsetFt)) : 0}ft` : '',
        fs.fire?.testMode ? `fireTest=${fs.fire.testMode}` : '',
        fs.fire?.testMode === 'fire_only_ladder' ? 'fireOnly=1' : '',
        `requested=${smoke.spawnRequestedAt ? new Date(smoke.spawnRequestedAt).toLocaleTimeString('de-DE') : 'nein'}`,
        `spawned=${smoke.spawned ? `ja (${smoke.spawnedCount || '?'})` : 'nein'}`,
        smoke.teleported ? `teleported=${smoke.teleported}` : '',
        smoke.spawnSuppressed ? 'suppressed=1' : '',
        smoke.requestedByKind ? `req=${Object.entries(smoke.requestedByKind).map(([k, v]) => `${k}:${v}`).join(',')}` : '',
        smoke.spawnedByKind ? `kind=${Object.entries(smoke.spawnedByKind).map(([k, v]) => `${k}:${v}`).join(',')}` : '',
        ...sceneParts,
        smoke.spawnError ? `error=${smoke.spawnError}` : '',
        ack ? `lastAck=${ack.type || '?'}:${ack.status || '?'}` : 'lastAck=keins'
    ].filter(Boolean);
    return parts.join(' | ');
};

function _missionStartUiKey() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (!md) return '';
    const fs = _activeFireScenario() || {};
    return String(fs.missionId || md.missionId || md.id || `${md.start || ''}-${md.dest || ''}-${md.mission || ''}`).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 96);
}

function _missionStartHasUsableRoute() {
    const hasTwoPoints = (points) => Array.isArray(points)
        && points.filter(point => {
            const lat = Number(point?.lat);
            const lon = Number(point?.lng ?? point?.lon);
            return Number.isFinite(lat) && Number.isFinite(lon);
        }).length >= 2;
    return hasTwoPoints(_missionRuntimeRouteWaypoints());
}

function _hasValidMissionForStart() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    return !!(md && _missionSceneAcceptedForRuntime() && _missionStartHasUsableRoute());
}

function _missionStartBannerDismissKey() {
    return `ga_mission_start_banner_dismissed_${_missionStartUiKey() || 'none'}`;
}

const missionStartBannerDismissState = Object.create(null);

function _missionStartPhaseKey() {
    const key = _missionStartUiKey();
    return key ? `ga_mission_start_phase_${key}` : '';
}

function _missionStartPhase() {
    try {
        const key = _missionStartPhaseKey();
        const raw = key ? localStorage.getItem(key) : '';
        if (raw === 'boarded') return 'boarded';
        if (raw === 'boarding') return 'boarding';
        if (raw === 'prepare') return 'prepare';
        return 'planned';
    } catch (_) {
        return 'planned';
    }
}

function _setMissionStartPhase(phase) {
    try {
        const key = _missionStartPhaseKey();
        if (!key) return;
        const prev = _missionStartPhase();
        const next = phase === 'boarded'
            ? 'boarded'
            : (phase === 'boarding'
                ? 'boarding'
                : (phase === 'prepare' ? 'prepare' : 'planned'));
        localStorage.setItem(key, next);
        if (prev !== next) {
            _missionPhaseDebugPush('start_phase', {
                from: prev,
                to: next,
                trigger: 'set-start-phase'
            });
        }
    } catch (_) {}
}

function _clearMissionStartPhase() {
    try {
        const key = _missionStartPhaseKey();
        const prev = _missionStartPhase();
        if (key) localStorage.removeItem(key);
        if (prev !== 'planned') {
            _missionPhaseDebugPush('start_phase', {
                from: prev,
                to: 'planned',
                trigger: 'clear-start-phase'
            });
        }
    } catch (_) {}
}

function _missionStartGroundReady() {
    return !!_missionStartGroundStatus().ready;
}

function _missionStartGroundStatus() {
    if (window.simModeActive) {
        const ready = _hasValidMissionForStart();
        return { ready, label: ready ? 'Sim-Modus bereit' : 'Keine startbare Mission', reason: ready ? 'sim_mode_ready' : 'sim_mode_no_mission' };
    }
    if (!window.liveTrackerConnected) {
        return { ready: false, label: 'Tracker offline', reason: 'tracker_offline' };
    }
    const fd = window.lastLiveFlightData || {};
    const pos = window.lastLiveGpsPos || {};
    const hasFlightData = fd && typeof fd === 'object' && Object.keys(fd).length > 0;
    const hasPosition = Number.isFinite(Number(pos.lat)) && Number.isFinite(Number(pos.lon));
    if (!hasFlightData || !hasPosition) {
        return { ready: false, label: 'Warte auf Sim-Daten', reason: 'no_sim_data' };
    }
    const gs = Number.isFinite(Number(fd.gsKts)) ? Number(fd.gsKts)
        : (Number.isFinite(Number(fd.gs)) ? Number(fd.gs)
            : (Number.isFinite(Number(pos.gs)) ? Number(pos.gs) : 0));
    const agl = Number.isFinite(Number(fd.aglFt)) ? Math.max(0, Number(fd.aglFt)) : null;
    const hasOnGroundFlag = typeof fd.onGround === 'boolean';
    const onGround = hasOnGroundFlag ? !!fd.onGround : (Number.isFinite(agl) ? agl <= 35 : false);
    const nearSurface = Number.isFinite(agl) ? agl <= 35 : onGround;
    const parkingBrakeSet = fd.parkingBrake === true || fd.parkingBrake === 1;
    const inMenuOrMap = !!fd.inMenuOrMap || Number(fd.simRunning) === 0 || Number(fd.dialogMode) === 1;
    const stationary = gs <= 5 || (parkingBrakeSet && gs <= 10);
    const paused = _missionTrackerPauseActive(fd, onGround || nearSurface, stationary);
    const ready = !!((onGround || nearSurface) && stationary && !paused && !inMenuOrMap);
    if (ready) {
        return { ready: true, label: 'Am Boden bereit', reason: 'ready', gs, agl, onGround, parkingBrakeSet };
    }
    if (paused) return { ready: false, label: 'Simulator pausiert', reason: 'paused', gs, agl, onGround, parkingBrakeSet };
    if (inMenuOrMap) return { ready: false, label: 'Sim-Menue/Map offen', reason: 'menu_or_map', gs, agl, onGround, parkingBrakeSet };
    if (!(onGround || nearSurface)) return { ready: false, label: 'Nicht am Boden', reason: 'not_on_ground', gs, agl, onGround, parkingBrakeSet };
    if (!stationary) return { ready: false, label: 'Nicht im Stillstand', reason: 'moving', gs, agl, onGround, parkingBrakeSet };
    return { ready: false, label: 'Wartet auf Boden', reason: 'unknown', gs, agl, onGround, parkingBrakeSet };
}

function _missionBoardingVoiceDone() {
    try {
        if (typeof window.paxVoiceBoardingDone === 'function') return !!window.paxVoiceBoardingDone();
    } catch (_) {}
    return false;
}

function _missionCargoLoadInteractionReady() {
    if (window.simModeActive) return true;
    const sceneDone = !!window.missionSceneStatus?.boardingComplete || !!window.missionSceneStatus?.personBoarded;
    if (!sceneDone) return false;
    return true;
}

function _missionCargoMaybePromoteStartReady(reason = 'cargo-ready-check') {
    const manifest = _missionCargoEnsureManifest();
    if (!window.missionCargoStatus?.loadConfirmed) return false;
    if (!manifest?.dispatchSignature) return false;
    if (!_missionCargoLoadInteractionReady()) return false;
    if (_missionStartPhase() === 'boarded') return true;
    _setMissionStartPhase('boarded');
    _setMissionRuntimePhase('boarded', { updateUi: false });
    window.missionCargoStatus.error = null;
    _updateMissionRuntimeUi();
    if (document.getElementById('missionCargoOverlay')?.style.display === 'flex') {
        _missionCargoRenderDialog('load', { skipPayloadRefresh: true });
    }
    return true;
}

function _missionCargoScheduleStartReadyPromotion(reason = 'cargo-ready-poll', attemptsLeft = 40) {
    if (_missionCargoMaybePromoteStartReady(reason)) return;
    if (!window.missionCargoStatus?.loadConfirmed || attemptsLeft <= 0) return;
    _updateMissionRuntimeUi();
    setTimeout(() => _missionCargoScheduleStartReadyPromotion(reason, attemptsLeft - 1), 500);
}

function _missionCargoGroundHandlingAllowed() {
    return !_missionCargoIsAirborneNow();
}

function _missionCloseOutcomeSummaryText(outcome = null) {
    const o = (outcome && typeof outcome === 'object') ? outcome : null;
    if (!o) return 'Missionabschluss bereit. Mit "Mission schliessen" wird alles zurueckgesetzt.';
    if (!o.failed) {
        const requiredLoaded = Number.isFinite(Number(o.requiredLoaded)) ? Number(o.requiredLoaded) : 0;
        const requiredTotal = Number.isFinite(Number(o.requiredTotal)) ? Number(o.requiredTotal) : 0;
        const loadedWeight = Number.isFinite(Number(o.loadedWeightLbs)) ? Number(o.loadedWeightLbs) : 0;
        return `Mission waere erfolgreich (${requiredLoaded}/${requiredTotal} Pflicht-Items, ${loadedWeight} lbs). Mit "Mission schliessen" wird alles zurueckgesetzt.`;
    }
    const reasons = [
        ...(Array.isArray(o.missingRequired) ? o.missingRequired : []),
        ...(Array.isArray(o.droppedRequired) ? o.droppedRequired : []),
        ...(Array.isArray(o.notDeliveredRequired) ? o.notDeliveredRequired : []),
        ...(Array.isArray(o.damagedRequired) ? o.damagedRequired : [])
    ].filter(Boolean);
    const preview = reasons.slice(0, 3).join(', ');
    return preview
        ? `Mission wuerde mit Fehlschlag enden: ${preview}. Mit "Mission schliessen" wird alles zurueckgesetzt.`
        : 'Mission wuerde mit Fehlschlag enden. Mit "Mission schliessen" wird alles zurueckgesetzt.';
}

function _missionOutcomeApplyEndReadiness(outcome = null, endReady = null) {
    if (_missionSceneIsPoiMission()) return outcome;
    if (_missionSceneIsBushMission() && _missionBushGroundEndReady(endReady)) return outcome;
    if (!endReady || endReady.atTarget) return outcome;
    const hasAptArrival = !!endReady.hasAptArrival;
    const dNm = hasAptArrival && Number.isFinite(Number(endReady.dArrivalNm))
        ? Number(endReady.dArrivalNm)
        : Number(endReady.dMissionNm);
    const distanceText = Number.isFinite(dNm) ? `${dNm.toFixed(2)} NM` : 'unbekannte Distanz';
    const locationReason = hasAptArrival
        ? `Zielbereich nicht erreicht (${distanceText} bis Empfangspunkt).`
        : `Zielflugplatz nicht erreicht (${distanceText} bis Ziel).`;
    const base = (outcome && typeof outcome === 'object')
        ? { ...outcome }
        : {
            status: 'failed',
            failed: true,
            requiredTotal: 0,
            requiredLoaded: 0,
            missingRequired: [],
            droppedRequired: [],
            notDeliveredRequired: [],
            damagedRequired: [],
            loadedWeightLbs: 0,
            totalWeightLbs: 0
        };
    const notDelivered = Array.isArray(base.notDeliveredRequired) ? base.notDeliveredRequired.slice() : [];
    if (!notDelivered.includes(locationReason)) notDelivered.push(locationReason);
    base.notDeliveredRequired = notDelivered;
    base.failed = true;
    base.status = 'failed';
    try {
        if (typeof currentMissionData !== 'undefined' && currentMissionData) {
            currentMissionData.missionResult = 'failed';
            currentMissionData.missionFailed = true;
            currentMissionData.missionOutcome = base;
        }
        if (typeof saveMissionState === 'function') saveMissionState();
    } catch (_) {}
    return base;
}

function _missionOutcomeApplyPoiProgress(outcome = null, options = {}) {
    if (!_missionSceneIsPoiMission()) return outcome;
    const progress = options?.progress && typeof options.progress === 'object'
        ? options.progress
        : _missionPoiProgressState();
    if (!progress?.hasSignal || !progress?.trackingActive) return outcome;
    const base = (outcome && typeof outcome === 'object')
        ? { ...outcome }
        : {
            status: 'completed',
            failed: false,
            requiredTotal: 0,
            requiredLoaded: 0,
            missingRequired: [],
            droppedRequired: [],
            notDeliveredRequired: [],
            damagedRequired: [],
            loadedWeightLbs: 0,
            totalWeightLbs: 0
        };
    const notDelivered = Array.isArray(base.notDeliveredRequired) ? base.notDeliveredRequired.slice() : [];
    if (progress.aborted) {
        if (!notDelivered.includes('POI-Auftrag wurde im Zielgebiet abgebrochen.')) {
            notDelivered.push('POI-Auftrag wurde im Zielgebiet abgebrochen.');
        }
    } else if (!progress.satisfied) {
        if (!notDelivered.includes('POI-Auftrag wurde nicht abgeschlossen.')) {
            notDelivered.push('POI-Auftrag wurde nicht abgeschlossen.');
        }
    }
    base.notDeliveredRequired = notDelivered;
    if (notDelivered.length > 0) {
        base.failed = true;
        base.status = 'failed';
    }
    try {
        if (typeof currentMissionData !== 'undefined' && currentMissionData) {
            currentMissionData.poiEndedAtHome = options?.endedAtHome === true;
            currentMissionData.poiNeedsRideHome = options?.needsRideHome === true;
            currentMissionData.missionResult = base.failed ? 'failed' : 'completed';
            currentMissionData.missionFailed = !!base.failed;
            currentMissionData.missionOutcome = base;
        }
        if (typeof saveMissionState === 'function') saveMissionState();
    } catch (_) {}
    return base;
}

function _missionCargoHasHardFailure(outcome = null) {
    const o = (outcome && typeof outcome === 'object') ? outcome : null;
    if (!o) return false;
    return !!(
        (Array.isArray(o.missingRequired) && o.missingRequired.length > 0)
        || (Array.isArray(o.droppedRequired) && o.droppedRequired.length > 0)
        || (Array.isArray(o.damagedRequired) && o.damagedRequired.length > 0)
    );
}

function _missionCargoHardFailurePreview() {
    if (typeof window.missionCargoEvaluateOutcome !== 'function') return null;
    try {
        const preview = window.missionCargoEvaluateOutcome();
        return _missionCargoHasHardFailure(preview) ? preview : null;
    } catch (_) {
        return null;
    }
}

function _setMissionClosePending(options = {}) {
    const outcome = options?.outcome && typeof options.outcome === 'object' ? options.outcome : null;
    missionRuntime.phase = 'closing';
    missionRuntime.active = false;
    missionRuntime.armed = false;
    missionRuntime.manual = false;
    missionRuntime.closingPending = true;
    missionRuntime.closingReason = String(options?.reason || 'mission-close-pending');
    missionRuntime.closingOutcome = outcome || missionRuntime.closingOutcome || null;
    missionRuntime.closingRequestedAt = Date.now();
    missionRuntime.readySince = 0;
    missionRuntime.pendingEndAt = 0;
    missionRuntime.lastOffDestAt = 0;
    missionRuntime.waitingFarewellDeboarding = false;
    missionRuntime.deboardingAfterFarewellStarted = false;
    missionRuntime.endReadinessKey = '';
    _updateMissionRuntimeUi();
    return true;
}

function _triggerGreetingAfterBoardingVoice(lat = null, lon = null, timeoutMs = 30000) {
    if (typeof window.triggerPaxGreeting !== 'function') return;
    const started = Date.now();
    const tryFire = () => {
        if (_missionBoardingVoiceDone() || (Date.now() - started) >= Math.max(1000, Number(timeoutMs) || 30000)) {
            try { window.triggerPaxGreeting(lat, lon); } catch (_) {}
            return;
        }
        setTimeout(tryFire, 220);
    };
    tryFire();
}

function _missionStartBannerDismissed() {
    try {
        const key = _missionStartUiKey();
        return !!key && missionStartBannerDismissState[key] === true;
    } catch (_) {
        return false;
    }
}

window.dismissMissionStartBanner = function() {
    try {
        const key = _missionStartUiKey();
        if (key) missionStartBannerDismissState[key] = true;
    } catch (_) {}
    _updateMissionRuntimeUi();
};

window.resetMissionStartBannerDismiss = function(options = {}) {
    const onlyIfNotStarted = options?.onlyIfNotStarted !== false;
    if (onlyIfNotStarted && (missionRuntime.active || missionRuntime.closingPending)) return false;
    try {
        const key = _missionStartUiKey();
        if (key) delete missionStartBannerDismissState[key];
    } catch (_) {}
    _updateMissionRuntimeUi();
    return true;
};

window.resetMissionStartFlow = function() {
    if (typeof currentMissionData !== 'undefined' && currentMissionData && typeof currentMissionData === 'object') {
        if (currentMissionData.bush && typeof buildInitialBushMissionProgress === 'function') {
            try {
                _persistBushMissionProgress(buildInitialBushMissionProgress(currentMissionData.bush));
            } catch (_) {}
        }
        currentMissionData.missionResult = '';
        currentMissionData.missionFailed = false;
        currentMissionData.missionOutcome = null;
        currentMissionData.cargoOutcome = null;
        currentMissionData.poiEndedAtHome = false;
        currentMissionData.poiNeedsRideHome = false;
    }
    const manifest = (typeof _missionCargoGetManifest === 'function') ? _missionCargoGetManifest() : null;
    if (manifest && typeof _missionCargoResetManifestState === 'function') {
        const changed = _missionCargoResetManifestState(manifest);
        if (changed && typeof _missionCargoPersistManifest === 'function') {
            try { _missionCargoPersistManifest(manifest); } catch (_) {}
        }
    }
    _clearMissionStartPhase();
    try {
        const key = _missionStartUiKey();
        if (key) delete missionStartBannerDismissState[key];
    } catch (_) {}
    Object.assign(window.missionSceneStatus, {
        boardingRequested: false,
        boardingActive: false,
        boardingComplete: false,
        boardingError: null,
        personBoarded: false
    });
    _updateMissionRuntimeUi();
};

function _resetMissionStartFlowAfterEnd() {
    _clearMissionStartPhase();
    try {
        const key = _missionStartUiKey();
        if (key) delete missionStartBannerDismissState[key];
    } catch (_) {}
    Object.assign(window.missionSceneStatus, {
        boardingRequested: false,
        boardingActive: false,
        boardingComplete: false,
        boardingError: null,
        personBoarded: false
    });
}

function _missionSceneBlockReasonBannerText(rawReason = '') {
    const reason = String(rawReason || '').trim();
    if (!reason) return 'Szene wartet auf Freigabe.';
    const awayMatch = reason.match(/^away_from_start_(\d+)nm$/i);
    if (awayMatch) {
        const distNm = Math.max(0, Math.round(Number(awayMatch[1]) || 0));
        return `Startszene nur am Abflugplatz verfuegbar (ca. ${distNm} NM entfernt).`;
    }
    if (reason === 'no_live_position') return 'Warte auf gueltige Live-Position.';
    if (reason === 'bad_live_position') return 'Live-Position unplausibel, bitte kurz stabilisieren.';
    if (reason === 'sim_paused_or_menu') return 'Sim pausiert oder Menue offen.';
    if (reason === 'not_on_ground') return 'Bitte fuer Boarding am Boden sein.';
    if (reason === 'agl_too_high') return 'Bitte fuer Boarding tiefer/nahe Boden gehen.';
    if (reason === 'too_fast_for_stage') return 'Bitte fuer Boarding langsamer rollen.';
    if (reason === 'already_airborne_cleared') return 'Szene im Flug automatisch entfernt.';
    if (reason === 'spawn_pending') return 'Startszene wird vorbereitet.';
    if (reason === 'spawn_cooldown') return 'Startszene hat kurze Sperrzeit.';
    if (reason === 'already_spawned') return 'Startszene steht bereits.';
    if (reason === 'no_fire_mission') return 'Kein passendes Missionsprofil fuer Startszene.';
    return `Szene wartet: ${reason}.`;
}

function _missionEndDeboardingBusy() {
    const scene = window.missionSceneStatus || {};
    return !!(missionRuntime.waitingFarewellDeboarding
        || missionRuntime.deboardingAfterFarewellStarted
        || scene.deboardingRequested
        || scene.deboardingActive);
}

function _updateMissionStartBanner() {
    const banner = document.getElementById('missionStartBanner');
    if (!banner) return;
    const kickerEl = document.getElementById('missionStartBannerKicker');
    const textEl = document.getElementById('missionStartBannerText');
    const btn = document.getElementById('missionStartBannerBtn');
    const closeBtn = banner.querySelector('.mission-start-banner-close');
    const valid = _hasValidMissionForStart();
    const trackerConnected = !!window.liveTrackerConnected;
    const simMode = !!window.simModeActive;
    const groundReady = _missionStartGroundReady();
    const dismissed = _missionStartBannerDismissed();
    const phase = _missionStartPhase();
    const endReady = missionRuntime.active ? _missionEndReadiness() : null;
    const poiGroundEndReady = missionRuntime.active ? _missionPoiGroundEndReady(endReady) : false;
    const bushGroundEndReady = missionRuntime.active ? _missionBushGroundEndReady(endReady) : false;
    const runtimeGroundEndReady = missionRuntime.active ? _missionRuntimeGroundEndReady(endReady) : false;
    const deboardingBusy = _missionEndDeboardingBusy();
    const groundAction = missionRuntime.active ? _missionResolveGroundAction({ endReady, deboardingBusy, active: true }) : null;
    const pickupConfirmOnly = !!groundAction?.pickupConfirmOnly;
    const runtimePhase = _missionRuntimePhaseSnapshot();
    missionRuntime.phase = runtimePhase;
    const showClose = !!missionRuntime.closingPending;
    const showDeboarding = missionRuntime.active && deboardingBusy;
    const showEndReady = missionRuntime.active && !!groundAction?.endReady;
    const showEnd = missionRuntime.active && showEndReady && !deboardingBusy;
    const showPickup = missionRuntime.active && groundAction?.action === 'pickup' && !showEnd && !deboardingBusy;
    const showStart = valid
        && (trackerConnected || simMode)
        && groundReady
        && !missionRuntime.active
        && !dismissed;
    const show = showClose || showDeboarding || showEnd || showPickup || showStart;
    banner.style.display = show ? 'flex' : 'none';
    if (!show) return;
    if (btn) btn.disabled = false;
    banner.classList.toggle('is-end-ready', showEnd);
    if (showClose) {
        if (kickerEl) kickerEl.textContent = 'Mission schliessen';
        if (closeBtn) closeBtn.style.display = 'none';
        if (textEl) {
            const waitHint = window.missionSceneStatus?.deboardingActive
                ? ' Endszene laeuft noch, danach schliessen.'
                : '';
            textEl.textContent = `${_missionCloseOutcomeSummaryText(missionRuntime.closingOutcome)}${waitHint}`;
        }
        if (btn) btn.textContent = 'Mission schliessen';
        return;
    }
    if (showDeboarding) {
        if (kickerEl) kickerEl.textContent = 'Mission abschliessen';
        if (closeBtn) closeBtn.style.display = 'none';
        if (textEl) textEl.textContent = 'Deboarding laeuft. Missionabschluss wird vorbereitet.';
        if (btn) {
            btn.textContent = 'Bitte warten...';
            btn.disabled = true;
        }
        return;
    }
    if (closeBtn) closeBtn.style.display = showEnd ? 'none' : '';
    if (showEnd) {
        if (kickerEl) kickerEl.textContent = groundAction?.action === 'unload' ? 'Ladung entladen' : 'Mission abschliessen';
        if (textEl) {
            const useArrivalDistance = endReady?.reason === 'apt_arrival_point' && Number.isFinite(Number(endReady?.dArrivalNm));
            if (groundAction?.action === 'unload') {
                textEl.textContent = 'Du stehst am Boden. Vor dem Missionsabschluss jetzt Ladung entladen bzw. Passagiere aussteigen lassen.';
            } else if (poiGroundEndReady && !_missionPoiEndedAtHome(endReady) && !endReady?.ready) {
                textEl.textContent = 'Du stehst am Boden. POI-Mission kann hier beendet werden.';
            } else if (poiGroundEndReady && _missionPoiEndedAtHome(endReady) && !endReady?.ready) {
                textEl.textContent = 'Du bist wieder am Startplatz. POI-Mission kann beendet werden.';
            } else if (bushGroundEndReady) {
                textEl.textContent = _missionBushEndReadyText();
            } else {
                const distanceText = useArrivalDistance
                    ? `${Number(endReady.dArrivalNm).toFixed(2)} NM zum Empfangspunkt`
                    : (Number.isFinite(Number(endReady?.dMissionNm)) ? `${Number(endReady.dMissionNm).toFixed(2)} NM zum Ziel` : 'Ziel erreicht');
                textEl.textContent = `Du stehst am Ziel. ${distanceText}.`;
            }
        }
        if (btn) btn.textContent = groundAction?.action === 'unload' ? 'Ausladen' : 'Mission beenden';
        return;
    }
    if (showPickup) {
        if (kickerEl) kickerEl.textContent = 'Bush Pickup';
        if (closeBtn) closeBtn.style.display = 'none';
        if (textEl) textEl.textContent = pickupConfirmOnly
            ? 'Pickup ist bereits geladen. Jetzt im Ladefenster bestaetigen und den Rueckflug freigeben.'
            : 'Pickup-Punkt erreicht. Jetzt das Ladefenster oeffnen und den Rueckflug vorbereiten.';
        if (btn) btn.textContent = pickupConfirmOnly ? 'Pickup abschliessen' : 'Pickup starten';
        return;
    }
    if (kickerEl) kickerEl.textContent = 'Mission bereit';
    if (closeBtn) closeBtn.style.display = '';
    const scene = window.missionSceneStatus || {};
    let text = phase === 'boarded'
        ? 'Boarding abgeschlossen. Wenn du die Ladung sicher verstaut hast, kann es losgehen.'
        : (phase === 'boarding'
            ? (simMode ? 'Sim-Modus bereit. Boarding und Verladen laufen an.' : 'Missionstart angefordert. Szene, Boarding und Verladen werden vorbereitet.')
            : (phase === 'prepare'
                ? 'Missionstart freigegeben. Als Nächstes kannst du Boarding und Verladen beginnen.'
                : 'Mission ist geplant, aber noch nicht gestartet.'));
    if (phase === 'boarding') {
        if (simMode) text = 'Sim-Modus bereit. Boarding und Verladen laufen an.';
        else if (scene.spawned) text = `Start-Szene steht (${scene.spawnedCount || '?'} Objekte). Boarding und Verladen laufen.`;
        else if (scene.spawnRequested) text = 'Start-Szene wird vorbereitet. Boarding und Verladen laufen an.';
        else if (scene.blockReason) text = _missionSceneBlockReasonBannerText(scene.blockReason);
        else if (_missionLooksLikeFireWatch()) text = 'Feuerwehr-Szene wird vorbereitet. Boarding und Verladen laufen an.';
        if (typeof window.paxVoicePrepareBoarding === 'function') {
            try { window.paxVoicePrepareBoarding(); } catch (_) {}
        }
    } else if (phase === 'prepare') {
        text = groundReady
            ? 'Missionstart freigegeben. Mit dem nächsten Klick beginnt Boarding und Verladen.'
            : 'Missionstart vorgemerkt. Bitte am Boden stehen und den Tracker abwarten.';
    } else if (phase === 'planned') {
        text = groundReady
            ? 'Mission ist geplant. Mit "Mission starten" wird erst dann Szene, Boarding und Verladen freigegeben.'
            : 'Mission ist geplant. Für den Start bitte am Boden stehen und den Tracker abwarten.';
    }
    if (textEl) textEl.textContent = text;
    if (btn) {
        btn.textContent = phase === 'boarded'
            ? 'Mission starten'
            : (phase === 'prepare' ? 'Boarding und Verladen beginnen' : (phase === 'boarding' ? 'Bitte warten...' : 'Mission starten'));
        btn.disabled = phase === 'boarding';
    }
}

function _updateMissionRuntimeUi() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const draftBlocked = !!md && !_missionSceneAcceptedForRuntime();
    const validMission = _hasValidMissionForStart();
    const groundStatus = _missionStartGroundStatus();
    const groundReady = !!groundStatus.ready;
    const phase = _missionStartPhase();
    const endReady = missionRuntime.active ? _missionEndReadiness() : null;
    const poiGroundEndReady = missionRuntime.active ? _missionPoiGroundEndReady(endReady) : false;
    const bushGroundEndReady = missionRuntime.active ? _missionBushGroundEndReady(endReady) : false;
    const runtimeGroundEndReady = missionRuntime.active ? _missionRuntimeGroundEndReady(endReady) : false;
    const deboardingBusy = _missionEndDeboardingBusy();
    const groundAction = missionRuntime.active ? _missionResolveGroundAction({ endReady, deboardingBusy, active: true }) : null;
    const pickupConfirmOnly = !!groundAction?.pickupConfirmOnly;
    const st = document.getElementById('missionRuntimeStatus');
    const detailEl = document.getElementById('missionRuntimeDetail');
    const nextStepEl = document.getElementById('missionRuntimeNextStep');
    const poiStatus = missionRuntime.active ? _missionPoiRuntimeStatus(endReady) : null;
    const runtimePhase = _missionRuntimePhaseSnapshot();
    if (st) {
        const idleText = !validMission
            ? 'Keine startbare Mission'
            : (groundReady
                ? (phase === 'boarded' ? 'Mission startbereit' : (phase === 'boarding' ? 'Boarding läuft an' : (phase === 'prepare' ? 'Boarding freigegeben' : 'Mission geplant')))
                : groundStatus.label);
        st.textContent = missionRuntime.closingPending
            ? 'Abschluss ausstehend'
            : missionRuntime.active
            ? ((runtimePhase === 'end_ready')
                ? 'Abschlussbereit'
                : 'Aktiv (manuell)')
            : (draftBlocked ? 'Entwurf: Mission akzeptieren' : idleText);
        st.title = groundStatus.reason
            ? `Start-Gate: ${groundStatus.reason}${Number.isFinite(Number(groundStatus.gs)) ? ` | GS ${Number(groundStatus.gs).toFixed(1)} kt` : ''}${Number.isFinite(Number(groundStatus.agl)) ? ` | AGL ${Math.round(Number(groundStatus.agl))} ft` : ''}`
            : '';
        st.style.color = missionRuntime.active
            ? (runtimePhase === 'end_ready' ? '#c6f3a3' : '#4caf50')
            : (draftBlocked ? '#f2c12e' : (validMission && groundReady ? '#8ec5ff' : '#888'));
    }
    if (detailEl) {
        let detailText = 'Statusdetails folgen nach Missionsstart';
        let detailColor = '#8ea0b8';
        const landedHere = !!endReady?.groundStill;
        const landedAtHome = landedHere && _missionPoiEndedAtHome(endReady);
        const landedAtTarget = landedHere && !!endReady?.atTarget;
        const meaningfulFlight = _missionHadMeaningfulFlightForEnd();
        if (missionRuntime.closingPending) {
            detailText = _missionCloseOutcomeSummaryText(missionRuntime.closingOutcome);
            detailColor = '#d7c58b';
        } else if (missionRuntime.active) {
            if (window.missionSceneStatus?.deboardingActive) {
                detailText = 'Endszene und Deboarding laufen bereits.';
                detailColor = '#d7c58b';
            } else if (!meaningfulFlight && landedAtHome) {
                detailText = 'Am Startplatz bereit. Mission ist aktiv, aber der Flug hat noch nicht begonnen.';
                detailColor = '#8ea0b8';
            } else if (poiStatus?.detail) {
                const landingPrefix = landedAtHome
                    ? 'Gelandet am Startplatz. '
                    : (landedAtTarget
                        ? 'Gelandet am Ziel. '
                        : (landedHere ? 'Gelandet ausserhalb. ' : 'In der Luft. '));
                detailText = `${landingPrefix}${poiStatus.detail}`;
                detailColor = poiStatus.stage === 'failed'
                    ? '#ff9d9d'
                    : (poiStatus.stage === 'home_ready' || poiStatus.stage === 'away_ready'
                        ? '#c6f3a3'
                        : '#8ea0b8');
            } else if (runtimeGroundEndReady) {
                if (bushGroundEndReady) {
                    detailText = _missionBushRuntimeDetailText();
                    detailColor = '#c6f3a3';
                } else {
                detailText = endReady.reason === 'apt_arrival_point'
                    ? 'Gelandet am Platz. Empfangspunkt erreicht. Mission kann regulär abgeschlossen werden.'
                    : 'Gelandet am Ziel. Mission kann regulär abgeschlossen werden.';
                detailColor = '#c6f3a3';
                }
            } else if (endReady?.groundStill) {
                const distText = Number.isFinite(Number(endReady?.dMissionNm)) ? `${Number(endReady.dMissionNm).toFixed(2)} NM vom Missionsziel` : 'nicht am Ziel';
                detailText = `Gelandet, aber noch ${distText}.`;
            } else if (_missionSceneIsBushMission()) {
                detailText = _missionBushRuntimeDetailText();
                detailColor = '#8ea0b8';
            } else {
                const homeNm = Number(_distanceToMissionHomeNm(window.lastLiveGpsPos?.lat, window.lastLiveGpsPos?.lon));
                const homeText = Number.isFinite(homeNm) ? ` · Home ${homeNm.toFixed(2)} NM` : '';
                detailText = `Mission läuft${homeText}.`;
            }
        } else if (runtimePhase === 'boarded' && validMission) {
            detailText = 'Boarding und Verladen abgeschlossen. Mission ist jetzt startbereit.';
        } else if (phase === 'boarding' && validMission) {
            detailText = 'Missionstart angefordert. Szene, Boarding und Verladen werden vorbereitet.';
        } else if (phase === 'prepare' && validMission) {
            detailText = 'Missionstart freigegeben. Boarding und Verladen warten auf die nächste Bestätigung.';
        } else if (phase === 'planned' && validMission) {
            detailText = 'Mission liegt bereit. Erst nach "Mission starten" werden Szene und Boarding freigeschaltet.';
        } else if (!validMission) {
            detailText = 'Es fehlt aktuell eine akzeptierte Mission mit nutzbarer Route.';
            detailColor = '#b7a6a6';
        }
        detailEl.textContent = detailText;
        detailEl.style.color = detailColor;
    }
    if (nextStepEl) {
        let nextStep = 'Nächster Schritt: Mission vorbereiten';
        if (missionRuntime.closingPending) {
            nextStep = 'Nächster Schritt: Mission schließen';
        } else if (missionRuntime.active) {
            if (missionRuntime.waitingFarewellDeboarding && !missionRuntime.deboardingAfterFarewellStarted) {
                nextStep = 'Nächster Schritt: Farewell abwarten';
            } else if (window.missionSceneStatus?.deboardingActive) {
                nextStep = 'Nächster Schritt: Deboarding läuft';
            } else if (poiStatus?.nextStep) {
                nextStep = poiStatus.nextStep;
            } else if (groundAction?.action === 'pickup') {
                nextStep = pickupConfirmOnly
                    ? 'Nächster Schritt: Pickup bestätigen und Rückflug freigeben'
                    : 'Nächster Schritt: Pickup starten und Gast einladen';
            } else if (groundAction?.action === 'unload') {
                nextStep = 'Nächster Schritt: Pflichtladung entladen';
            } else if (runtimeGroundEndReady) {
                nextStep = 'Nächster Schritt: Mission beenden';
            } else if (_missionSceneIsBushMission() && _missionBushEffectiveCompletionMode() === 'return_home') {
                const p = _activeBushMissionProgress();
                if (_missionBushIsPickupMission()) {
                    nextStep = String(p?.status || '') === 'pickup_loading'
                        ? 'Nächster Schritt: Pickup-Boarding abwarten'
                        : (p?.pickupReady
                        ? 'Nächster Schritt: Pickup starten und Gast einladen'
                        : (p?.pickupCompleted
                            ? (p?.returnHomeQualified ? 'Nächster Schritt: Gast am Heimatplatz aussteigen lassen' : 'Nächster Schritt: Zum Heimatplatz zurückkehren und stoppen')
                            : 'Nächster Schritt: Zum Zielstrip fliegen und zum Treffpunkt rollen'));
                } else {
                    nextStep = p?.areaQualified
                        ? 'Nächster Schritt: Zum Heimatplatz zurückkehren und stoppen'
                        : 'Nächster Schritt: Recon-Gebiet sauber abfliegen';
                }
            } else if (endReady?.groundStill && !endReady?.atTarget) {
                nextStep = 'Nächster Schritt: Zum Ziel rollen/fliegen';
            } else {
                nextStep = 'Nächster Schritt: Am Ziel landen und stoppen';
            }
        } else if (runtimePhase === 'boarded' && validMission) {
            nextStep = 'Nächster Schritt: Mission starten';
        } else if (phase === 'boarding' && validMission) {
            nextStep = 'Nächster Schritt: Boarding und Verladen abschliessen';
        } else if (phase === 'prepare' && validMission && groundReady) {
            nextStep = 'Nächster Schritt: Boarding und Verladen beginnen';
        } else if (window.missionSceneStatus?.boardingRequested || window.missionSceneStatus?.boardingActive) {
            nextStep = 'Nächster Schritt: Boarding läuft';
        } else if (phase === 'planned' && validMission && groundReady) {
            nextStep = 'Nächster Schritt: Mission starten';
        } else if (validMission && groundReady) {
            nextStep = 'Nächster Schritt: Mission starten';
        } else if (!validMission) {
            nextStep = 'Nächster Schritt: Mission erzeugen/akzeptieren';
        }
        nextStepEl.textContent = nextStep;
    }
    const bStart = document.getElementById('missionStartBtn');
    const bEnd = document.getElementById('missionEndBtn');
    const bAuto = document.getElementById('missionAutoStartBtn');
    const bMap = document.getElementById('mapMissionToggleBtn');
    if (bStart) bStart.disabled = missionRuntime.active;
    if (bEnd) bEnd.disabled = !missionRuntime.active;
    if (bAuto) {
        bAuto.style.display = 'none';
        bAuto.disabled = true;
        bAuto.setAttribute('aria-pressed', 'false');
        bAuto.classList.remove('is-on');
        bAuto.classList.add('is-off');
    }
    if (bMap) {
        if (missionRuntime.closingPending) {
            bMap.style.display = 'inline-flex';
            bMap.textContent = '■ Mission schliessen';
            bMap.title = 'Mission abschliessen und Szene/Status zuruecksetzen';
            bMap.disabled = false;
        } else {
            bMap.style.display = (missionRuntime.active || (validMission && groundReady)) ? 'inline-flex' : 'none';
            const pickupActionReady = missionRuntime.active && groundAction?.action === 'pickup';
            const unloadActionReady = missionRuntime.active && groundAction?.action === 'unload';
            bMap.textContent = missionRuntime.active
                ? (deboardingBusy ? '… Deboarding läuft' : (pickupActionReady ? (pickupConfirmOnly ? '⬤ Pickup abschliessen' : '⬤ Pickup starten') : (unloadActionReady ? '⬤ Ausladen' : (runtimeGroundEndReady ? '■ Mission beenden' : '■ Mission stoppen'))))
                : (phase === 'boarded'
                    ? '▶ Mission starten'
                    : (phase === 'prepare' ? '▶ Boarding' : (phase === 'boarding' ? '… Boarding läuft' : '▶ Mission starten')));
            bMap.title = missionRuntime.active
                ? (deboardingBusy ? 'Deboarding laeuft bereits' : (pickupActionReady ? (pickupConfirmOnly ? 'Pickup bestaetigen und Rueckflug freigeben' : 'Pickup am Zielstrip oeffnen') : (unloadActionReady ? 'Ausladen/Aussteigen am Boden oeffnen' : (runtimeGroundEndReady ? 'Mission jetzt abschliessen' : 'Mission manuell stoppen'))))
                : (phase === 'boarded'
                    ? 'Mission jetzt aktiv schalten'
                    : (phase === 'prepare' ? 'Boarding und Verladen beginnen' : (phase === 'boarding' ? 'Boarding und Verladen laufen noch' : 'Missionstart freigeben und Boarding vorbereiten')));
            bMap.disabled = missionRuntime.active ? deboardingBusy : (!validMission || !groundReady || phase === 'boarding');
        }
        bMap.classList.toggle('is-active', missionRuntime.active);
    }
    _updateMissionCargoAutoLoadButton();
    _updateMissionStartBanner();
    if (typeof window.paxVoiceRefreshWidget === 'function') window.paxVoiceRefreshWidget();
}
window.refreshMissionRuntimeUi = _updateMissionRuntimeUi;

function _resetMissionRuntime() {
    missionRuntime = {
        phase: _hasValidMissionForStart() ? 'planned' : 'idle',
        armed: false,
        active: false,
        manual: false,
        closingPending: false,
        closingReason: '',
        closingOutcome: null,
        closingRequestedAt: 0,
        readySince: 0,
        pendingEndAt: 0,
        lastOffDestAt: 0,
        landingRollTriggered: false,
        arrivalFarewellTriggered: false,
        arrivalFlightRecord: null,
        waitingFarewellDeboarding: false,
        deboardingAfterFarewellStarted: false,
        endReadinessKey: ''
    };
    _updateMissionRuntimeUi();
}

function _targetPointForMission() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (md?.poiName) {
        const truthPoint = _missionTruthPoint(['mainTarget', 'sceneAnchor']);
        if (truthPoint) return { lat: truthPoint.lat, lon: truthPoint.lon };
    }
    const wps = _missionRuntimeRouteWaypoints();
    if (!wps || wps.length < 1) return null;
    const isPoi = !!md?.poiName || (typeof currentDestICAO !== 'undefined' && currentDestICAO === 'POI');
    const wp = isPoi ? (wps.find(wp => wp && wp.isPOI) || (wps.length >= 2 ? wps[1] : wps[0])) : wps[wps.length - 1];
    const lat = Number(wp?.lat), lon = Number(wp?.lng ?? wp?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
}

function _haversineNmLocal(lat1, lon1, lat2, lon2) {
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 3440.065;
}

function _distanceToMissionTargetNm(lat, lon) {
    const t = _targetPointForMission();
    if (!t) return null;
    return _haversineNmLocal(lat, lon, t.lat, t.lon);
}

function _missionRuntimeRouteWaypoints() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const candidates = [
        (typeof routeWaypoints !== 'undefined' && Array.isArray(routeWaypoints)) ? routeWaypoints : null,
        Array.isArray(md?.routeWaypoints) ? md.routeWaypoints : null,
        Array.isArray(md?.missionRouteWaypoints) ? md.missionRouteWaypoints : null,
        (typeof window !== 'undefined' && Array.isArray(window._missionRouteWaypoints)) ? window._missionRouteWaypoints : null
    ];
    for (const points of candidates) {
        if (!Array.isArray(points) || !points.length) continue;
        const usable = points.filter(point => {
            const lat = Number(point?.lat);
            const lon = Number(point?.lng ?? point?.lon);
            return Number.isFinite(lat) && Number.isFinite(lon);
        });
        if (usable.length) return points;
    }
    return null;
}

function _missionHomePointForRuntime() {
    const wps = _missionRuntimeRouteWaypoints();
    if (!wps || !wps.length) return null;
    const wp = wps[0];
    const lat = Number(wp?.lat);
    const lon = Number(wp?.lng ?? wp?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
}

function _distanceToMissionHomeNm(lat, lon) {
    const home = _missionHomePointForRuntime();
    if (!home) return null;
    return _haversineNmLocal(Number(lat), Number(lon), home.lat, home.lon);
}

function _isAtMissionHome(lat, lon, thresholdNm = 0.35) {
    const dNm = _distanceToMissionHomeNm(lat, lon);
    return Number.isFinite(dNm) ? dNm <= thresholdNm : false;
}

function _missionHadMeaningfulFlightForEnd() {
    const poiProgress = _missionPoiProgressState();
    const poiProgressEvidence = !!(
        _missionSceneIsPoiMission()
        && poiProgress?.trackingActive
        && poiProgress?.hasSignal
        && (poiProgress.satisfied || poiProgress.aborted || poiProgress.atTargetDone)
    );
    return !!(
        flightRecorder?.hadAirbornePhase
        || Number(flightRecorder?.airborneEvidenceSec || 0) >= 8
        || Number(flightRecorder?.maxAglFt || 0) >= 500
        || poiProgressEvidence
    );
}

function _missionHasReachedEndEligibleFlightPhase() {
    const poiProgress = _missionPoiProgressState();
    const poiProgressEvidence = !!(
        _missionSceneIsPoiMission()
        && poiProgress?.trackingActive
        && poiProgress?.hasSignal
        && (poiProgress.satisfied || poiProgress.aborted || poiProgress.atTargetDone)
    );
    return !!(
        flightRecorder?.hadAirbornePhase
        || Number(flightRecorder?.airborneEvidenceSec || 0) >= 10
        || Number(flightRecorder?.maxAglFt || 0) >= 200
        || poiProgressEvidence
    );
}

function _missionPoiRuntimeStatus(endReady = null) {
    if (!_missionSceneIsPoiMission()) return null;
    const ready = endReady && typeof endReady === 'object' ? endReady : _missionEndReadiness();
    const progress = _missionPoiProgressState();
    const endedAtHome = _missionPoiEndedAtHome(ready);
    const canEndHere = _missionPoiGroundEndReady(ready);
    if (!progress?.hasSignal || !progress?.trackingActive) {
        return {
            stage: 'unknown',
            detail: 'POI-Status noch nicht sicher verfügbar.',
            nextStep: canEndHere
                ? (endedAtHome ? 'Nächster Schritt: Mission beenden' : 'Nächster Schritt: Mission hier beenden oder Heimflug fortsetzen')
                : 'Nächster Schritt: POI anfliegen und Aufgabe erfüllen'
        };
    }
    if (progress.aborted) {
        return {
            stage: 'failed',
            detail: 'POI-Auftrag fehlgeschlagen.',
            nextStep: canEndHere
                ? 'Nächster Schritt: Mission beenden'
                : 'Nächster Schritt: Landen und Mission abschliessen'
        };
    }
    if (progress.satisfied) {
        if (canEndHere) {
            return {
                stage: endedAtHome ? 'home_ready' : 'away_ready',
                detail: endedAtHome
                    ? 'POI erfüllt. Du bist zurück am Startplatz.'
                    : 'POI erfüllt. Ausweichlandung erkannt.',
                nextStep: endedAtHome
                    ? 'Nächster Schritt: Mission regulär beenden'
                    : 'Nächster Schritt: Mission hier beenden oder Pax später heimfliegen'
            };
        }
        return {
            stage: 'return_leg',
            detail: endedAtHome
                ? 'POI erfüllt. Startplatz erreicht, aber noch nicht im End-Gate.'
                : 'POI erfüllt. Rückflugphase oder freie Landung zum Missionsende.',
            nextStep: 'Nächster Schritt: Landen, stoppen und Mission beenden'
        };
    }
    const dwellSec = Number.isFinite(Number(progress.dwellSec)) ? Number(progress.dwellSec) : 0;
    const attempts = Number.isFinite(Number(progress.attempts)) ? Number(progress.attempts) : 0;
    return {
        stage: 'working',
        detail: `POI noch offen. Arbeitszeit im Zielgebiet: ${Math.round(dwellSec)}s${attempts > 0 ? ` · Hinweise: ${attempts}` : ''}.`,
        nextStep: canEndHere
            ? 'Nächster Schritt: Mission beenden'
            : 'Nächster Schritt: POI sauber erfüllen und danach landen'
    };
}

function _missionPoiProgressState() {
    if (typeof window.paxVoiceGetPoiMissionProgress !== 'function') return null;
    try {
        const progress = window.paxVoiceGetPoiMissionProgress();
        return progress && typeof progress === 'object' ? progress : null;
    } catch (_) {
        return null;
    }
}

function _activeBushMissionProgress() {
    if (!_missionSceneIsBushMission()) return null;
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const progress = md?.bushProgress;
    if (!progress || typeof progress !== 'object') return null;
    return {
        status: String(progress.status || 'enroute'),
        targetReached: !!progress.targetReached,
        areaEnteredAt: Number(progress.areaEnteredAt) || 0,
        areaQualified: !!progress.areaQualified,
        groundStopQualified: !!progress.groundStopQualified,
        cargoDelivered: !!progress.cargoDelivered,
        passengerDropped: !!progress.passengerDropped,
        returnHomeQualified: !!progress.returnHomeQualified,
        pickupReady: !!progress.pickupReady,
        pickupCompleted: !!progress.pickupCompleted,
        pickupConfirmed: !!progress.pickupConfirmed,
        areaDwellSec: Math.max(0, Number(progress.areaDwellSec) || 0),
        areaTrackNm: Math.max(0, Number(progress.areaTrackNm) || 0),
        lastAreaSampleLat: Number(progress.lastAreaSampleLat),
        lastAreaSampleLon: Number(progress.lastAreaSampleLon),
        lastAreaSampleTs: Number(progress.lastAreaSampleTs) || 0,
        visitedRouteRefs: Array.isArray(progress.visitedRouteRefs) ? progress.visitedRouteRefs.slice(0, 12) : []
    };
}

function _persistBushMissionProgress(progress = null) {
    if (!progress || typeof progress !== 'object') return null;
    if (typeof currentMissionData === 'undefined' || !currentMissionData || typeof currentMissionData !== 'object') return null;
    const prev = currentMissionData.bushProgress && typeof currentMissionData.bushProgress === 'object'
        ? currentMissionData.bushProgress
        : null;
    currentMissionData.bushProgress = { ...progress };
    const prevStatus = String(prev?.status || '');
    const nextStatus = String(progress?.status || '');
    if (prevStatus !== nextStatus || !!prev?.pickupReady !== !!progress?.pickupReady || !!prev?.pickupConfirmed !== !!progress?.pickupConfirmed) {
        _missionPhaseDebugPush('bush_progress', {
            from: prevStatus || '-',
            to: nextStatus || '-',
            pickupReady: !!progress?.pickupReady,
            pickupCompleted: !!progress?.pickupCompleted,
            pickupConfirmed: !!progress?.pickupConfirmed,
            returnHomeQualified: !!progress?.returnHomeQualified,
            groundStopQualified: !!progress?.groundStopQualified
        });
    }
    try {
        if (typeof window.debouncedSaveMissionState === 'function') window.debouncedSaveMissionState();
        else if (typeof saveMissionState === 'function') saveMissionState();
    } catch (_) {}
    return currentMissionData.bushProgress;
}

function _missionBushAreaRef() {
    const bush = _activeBushMissionSpec();
    const area = bush?.areaRef;
    if (!area || typeof area !== 'object') return null;
    const lat = Number(area.lat);
    const lon = Number(area.lon);
    const radiusNm = Math.max(0.5, Number(area.radiusNm) || 3);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { ...area, lat, lon, radiusNm };
}

function _missionBushAreaDistanceNm(lat, lon) {
    const area = _missionBushAreaRef();
    if (!area || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;
    return _haversineNmLocal(Number(lat), Number(lon), area.lat, area.lon);
}

function _missionBushIsPickupMission() {
    const bush = _activeBushMissionSpec();
    return !!(bush && bush.targetMode === 'strip_then_return' && ['passenger', 'cargo'].includes(String(bush.pickupKind || '').toLowerCase()));
}

function _missionBushIsPickupPassengerMission() {
    const bush = _activeBushMissionSpec();
    return !!(bush && bush.targetMode === 'strip_then_return' && String(bush.pickupKind || '').toLowerCase() === 'passenger');
}

function _missionBushIsPickupCargoMission() {
    const bush = _activeBushMissionSpec();
    return !!(bush && bush.targetMode === 'strip_then_return' && String(bush.pickupKind || '').toLowerCase() === 'cargo');
}

function _missionBushPickupItem(manifest = _missionCargoEnsureManifest()) {
    const items = Array.isArray(manifest?.items) ? manifest.items : [];
    return items.find(item => item && item.pickupLocation === 'target') || null;
}

function _missionBushPickupAtTargetNow(lat = null, lon = null) {
    const pos = window.lastLiveGpsPos || {};
    const curLat = Number(lat ?? pos.lat);
    const curLon = Number(lon ?? pos.lon);
    if (!Number.isFinite(curLat) || !Number.isFinite(curLon)) return false;
    const ready = _missionEndReadiness(curLat, curLon);
    if (!ready?.groundStill) return false;
    const bush = _activeBushMissionSpec();
    const targetLat = Number(bush?.targetRef?.lat);
    const targetLon = Number(bush?.targetRef?.lon);
    if (Number.isFinite(targetLat) && Number.isFinite(targetLon)) {
        const atArrivalPoint = _isAtAptArrivalPoint(curLat, curLon, 0.12);
        const dTargetNm = _haversineNmLocal(curLat, curLon, targetLat, targetLon);
        return !!(atArrivalPoint || (Number.isFinite(dTargetNm) && dTargetNm <= 0.35));
    }
    if (!ready?.atTarget) return false;
    if (ready.hasAptArrival) return _isAtAptArrivalPoint(curLat, curLon, 0.12);
    return true;
}

function _missionBushPickupReadyForAction() {
    if (!_missionBushIsPickupMission()) return false;
    const progress = _activeBushMissionProgress();
    return !!(_missionBushPickupAtTargetNow() && (progress?.pickupReady || (progress?.pickupCompleted && !progress?.pickupConfirmed)));
}

function _missionResolveGroundAction(options = {}) {
    const active = options?.active ?? missionRuntime.active;
    const deboardingBusy = options?.deboardingBusy ?? _missionEndDeboardingBusy();
    const endReady = options?.endReady ?? (active ? _missionEndReadiness() : null);
    const runtimeGroundEndReady = active ? _missionRuntimeGroundEndReady(endReady) : false;
    const bushProgress = _missionSceneIsBushMission() ? _activeBushMissionProgress() : null;
    const pickupActionReady = active && _missionBushPickupReadyForAction();
    const pickupConfirmOnly = !!(pickupActionReady && bushProgress?.pickupCompleted && !bushProgress?.pickupConfirmed);
    const unloadActionReady = active && _missionCargoGroundHandlingAllowed() && _missionCargoNeedsUnload();

    let resolved = null;
    if (missionRuntime.closingPending) {
        resolved = { phase: 'closing', action: 'close', endReady: false, pickupConfirmOnly: false };
    } else if (!active) {
        resolved = { phase: _missionRuntimePhaseSnapshot(), action: 'none', endReady: false, pickupConfirmOnly: false };
    } else if (deboardingBusy) {
        resolved = { phase: 'deboarding', action: 'none', endReady: false, pickupConfirmOnly: false };
    } else if (pickupActionReady) {
        resolved = {
            phase: pickupConfirmOnly ? 'pickup_complete' : 'pickup_ready',
            action: 'pickup',
            endReady: false,
            pickupConfirmOnly
        };
    } else if (runtimeGroundEndReady) {
        if (unloadActionReady) {
            resolved = {
                phase: String(bushProgress?.status || '') === 'home_unloading' ? 'home_unloading' : 'end_unloading',
                action: 'unload',
                endReady: true,
                pickupConfirmOnly: false
            };
        } else {
            resolved = {
                phase: String(bushProgress?.status || '') === 'ready_to_close' ? 'ready_to_close' : 'end_ready',
                action: 'end',
                endReady: true,
                pickupConfirmOnly: false
            };
        }
    } else if (unloadActionReady) {
        resolved = {
            phase: String(bushProgress?.status || '') || 'ground_unloading',
            action: 'unload',
            endReady: false,
            pickupConfirmOnly: false
        };
    } else {
        resolved = {
            phase: String(bushProgress?.status || '') || 'active',
            action: 'end',
            endReady: false,
            pickupConfirmOnly: false
        };
    }
    const dbg = _missionPhaseDebugState();
    const sig = JSON.stringify([
        resolved.action,
        resolved.phase,
        resolved.endReady ? 1 : 0,
        resolved.pickupConfirmOnly ? 1 : 0,
        endReady?.reason || '',
        endReady?.groundStill ? 1 : 0,
        endReady?.atTarget ? 1 : 0,
        String(bushProgress?.status || '')
    ]);
    if (dbg.lastGroundActionSig !== sig) {
        dbg.lastGroundActionSig = sig;
        _missionPhaseDebugPush('ground_action', _missionPhaseDebugSummarizeGroundAction(resolved, {
            trigger: options?.trigger || 'resolve-ground-action',
            endReady,
            bushStatus: String(bushProgress?.status || '')
        }));
    }
    return resolved;
}
window.missionResolveGroundAction = _missionResolveGroundAction;

function _missionSceneWorldPointToRelative(originLat, originLon, originHdgDeg, worldLat, worldLon) {
    const oLat = Number(originLat);
    const oLon = Number(originLon);
    const hdgDeg = Number(originHdgDeg);
    const wLat = Number(worldLat);
    const wLon = Number(worldLon);
    if (![oLat, oLon, hdgDeg, wLat, wLon].every(Number.isFinite)) return null;
    let nav = null;
    try { nav = calcNav(oLat, oLon, wLat, wLon); } catch (_) {}
    const distNm = Number(nav?.dist);
    const brngDeg = Number(nav?.brng);
    if (!Number.isFinite(distNm) || !Number.isFinite(brngDeg)) return null;
    const distM = distNm * 1852;
    const deltaRad = ((brngDeg - hdgDeg) * Math.PI) / 180;
    return {
        forwardM: Math.cos(deltaRad) * distM,
        rightM: Math.sin(deltaRad) * distM
    };
}

function _missionBushUpdateProgress(lat = null, lon = null, now = Date.now()) {
    if (!_missionSceneIsBushMission()) return null;
    const bush = _activeBushMissionSpec();
    const progress = _activeBushMissionProgress();
    if (!bush || !progress) return null;
    const next = { ...progress };
    const curLat = Number(lat ?? window.lastLiveGpsPos?.lat);
    const curLon = Number(lon ?? window.lastLiveGpsPos?.lon);
    const endReady = _missionEndReadiness(curLat, curLon);
    if (endReady?.atTarget) next.targetReached = true;
    if (_missionBushIsPickupMission()) {
        const pickupItem = _missionBushPickupItem();
        const pickupLoaded = pickupItem?.status === 'loaded' || pickupItem?.status === 'unloaded';
        const pickupUnloadedHome = pickupItem?.status === 'unloaded' && _isAtMissionHome(curLat, curLon);
        const pickupIsPassenger = _missionCargoIsPassengerItem(pickupItem);
        const atPickup = _missionBushPickupAtTargetNow(curLat, curLon);
        next.pickupReady = !!(atPickup && !pickupLoaded);
        next.pickupCompleted = !!pickupLoaded;
        if (next.pickupReady && !pickupLoaded) next.status = 'pickup_ready';
        if (pickupLoaded && !next.pickupConfirmed) next.status = 'pickup_complete';
        if (pickupLoaded && next.pickupConfirmed && bush.requiresReturnHome && !pickupUnloadedHome) next.status = 'return_leg';
        if (pickupLoaded && endReady?.groundStill && _isAtMissionHome(curLat, curLon)) {
            next.returnHomeQualified = true;
            next.status = pickupUnloadedHome ? 'ready_to_close' : 'home_unloading';
            next.groundStopQualified = !!pickupUnloadedHome;
        }
        if (pickupUnloadedHome) {
            if (pickupIsPassenger) next.passengerDropped = true;
            else next.cargoDelivered = true;
            next.returnHomeQualified = true;
            next.groundStopQualified = true;
            next.status = 'ready_to_close';
        }
        const prevJson = JSON.stringify(progress);
        const nextJson = JSON.stringify(next);
        if (prevJson !== nextJson) _persistBushMissionProgress(next);
        return next;
    }
    const mode = _missionBushEffectiveCompletionMode();
    if (mode === 'return_home') {
        const area = _missionBushAreaRef();
        const insideArea = area && Number.isFinite(curLat) && Number.isFinite(curLon)
            ? (_missionBushAreaDistanceNm(curLat, curLon) <= area.radiusNm)
            : false;
        if (insideArea) {
            if (!next.areaEnteredAt) next.areaEnteredAt = now;
            if (Number.isFinite(next.lastAreaSampleTs) && next.lastAreaSampleTs > 0) {
                const dtSec = Math.max(0, Math.min(10, (now - next.lastAreaSampleTs) / 1000));
                next.areaDwellSec = Math.max(0, Number(next.areaDwellSec || 0) + dtSec);
            }
            if (Number.isFinite(next.lastAreaSampleLat) && Number.isFinite(next.lastAreaSampleLon)) {
                const legNm = _haversineNmLocal(next.lastAreaSampleLat, next.lastAreaSampleLon, curLat, curLon);
                if (Number.isFinite(legNm) && legNm > 0 && legNm <= 2.5) {
                    next.areaTrackNm = Math.max(0, Number(next.areaTrackNm || 0) + legNm);
                }
            }
            next.lastAreaSampleLat = curLat;
            next.lastAreaSampleLon = curLon;
            next.lastAreaSampleTs = now;
            next.targetReached = true;
            if (!next.areaQualified) next.status = 'on_task';
        } else {
            next.lastAreaSampleLat = NaN;
            next.lastAreaSampleLon = NaN;
            next.lastAreaSampleTs = 0;
        }
        const minAreaTimeSec = Math.max(0, Number(bush?.success?.minAreaTimeSec) || 0);
        const minAreaTrackNm = Math.max(0, Number(bush?.success?.minAreaTrackNm) || 0);
        if (!next.areaQualified && next.areaDwellSec >= minAreaTimeSec && next.areaTrackNm >= minAreaTrackNm) {
            next.areaQualified = true;
            next.status = bush.requiresReturnHome ? 'return_leg' : 'ready_to_close';
        }
        if (next.areaQualified && endReady?.groundStill && _isAtMissionHome(curLat, curLon)) {
            next.returnHomeQualified = true;
            next.groundStopQualified = true;
            next.status = 'ready_to_close';
        } else if (next.areaQualified && bush.requiresReturnHome) {
            next.status = 'return_leg';
        }
    } else if (endReady?.groundStill && endReady?.atTarget) {
        next.groundStopQualified = true;
        next.status = 'ready_to_close';
    }
    const prevJson = JSON.stringify(progress);
    const nextJson = JSON.stringify(next);
    if (prevJson !== nextJson) _persistBushMissionProgress(next);
    return next;
}
window.missionBushUpdateProgress = _missionBushUpdateProgress;

function _missionPoiGroundEndReady(endReady = null) {
    if (!_missionSceneIsPoiMission()) return false;
    const ready = endReady && typeof endReady === 'object' ? endReady : _missionEndReadiness();
    return !!(ready?.groundStill && _missionHasReachedEndEligibleFlightPhase());
}

function _missionBushEffectiveCompletionMode() {
    const bush = _activeBushMissionSpec();
    const profileId = String(bush?.profileId || '').toLowerCase();
    const completionMode = String(bush?.completionMode || '').toLowerCase();
    if (completionMode) return completionMode;
    if (profileId === 'bush_supply_strip') return 'unload_at_target';
    if (profileId === 'bush_charter_strip') return 'passenger_dropoff';
    if (profileId === 'bush_scenic_hopper') return 'land_at_target';
    return '';
}

function _missionBushRequiresReturnHome() {
    return _missionSceneIsBushMission() && _missionBushEffectiveCompletionMode() === 'return_home';
}

function _missionBushEndReadyText() {
    if (_missionBushIsPickupMission()) {
        return _missionBushIsPickupCargoMission()
            ? 'Bush-Cargo-Pickup abgeschlossen. Rueckkehr und Ausladen am Heimatplatz bestaetigt.'
            : 'Bush-Pickup abgeschlossen. Rueckkehr und Ausstieg am Heimatplatz bestaetigt.';
    }
    const mode = _missionBushEffectiveCompletionMode();
    if (mode === 'unload_at_target') {
        return _missionCargoNeedsUnload()
            ? 'Bush-Zielstrip erreicht. Pflichtladung jetzt entladen.'
            : 'Bush-Zielstrip erreicht. Versorgung kann abgeschlossen werden.';
    }
    if (mode === 'passenger_dropoff') {
        return 'Bush-Zielstrip erreicht. Passagier-Dropoff kann jetzt abgeschlossen werden.';
    }
    if (mode === 'land_at_target') {
        return 'Bush-Zielstrip erreicht. Adventure-Leg kann jetzt abgeschlossen werden.';
    }
    if (mode === 'return_home') {
        return 'Bush-Recon abgeschlossen. Mission kann jetzt am Heimatplatz beendet werden.';
    }
    return 'Bush-Zielstrip erreicht. Mission kann abgeschlossen werden.';
}

function _missionBushRuntimeDetailText() {
    if (_missionBushIsPickupMission()) {
        const p = _activeBushMissionProgress();
        const pickupNoun = _missionBushIsPickupCargoMission() ? 'Fracht' : 'Gast';
        const pickupVerb = _missionBushIsPickupCargoMission() ? 'ausladen' : 'aussteigen lassen';
        const pickupLoadedLabel = _missionBushIsPickupCargoMission() ? 'Pickup-Fracht' : 'Pickup';
        if (p?.groundStopQualified && (p?.passengerDropped || p?.cargoDelivered)) return _missionBushIsPickupCargoMission()
            ? 'Pickup-Rueckflug abgeschlossen. Die Rueckholfracht ist am Heimatplatz ausgeladen.'
            : 'Pickup-Rueckflug abgeschlossen. Der Gast ist am Heimatplatz ausgestiegen.';
        if (p?.returnHomeQualified) return `Heimatplatz erreicht. ${pickupNoun} jetzt ${pickupVerb}.`;
        if (String(p?.status || '') === 'pickup_loading') return _missionBushIsPickupCargoMission()
            ? 'Pickup-Ladung wird jetzt am Treffpunkt aufgenommen.'
            : 'Pickup-Boarding laeuft. Der Gast bewegt sich jetzt zum Flugzeug.';
        if (p?.pickupCompleted && p?.pickupConfirmed) return 'Pickup bestaetigt. Rueckflug zum Heimatplatz laeuft.';
        if (p?.pickupCompleted) return `${pickupLoadedLabel} geladen. Rueckflug nach kurzer Bestaetigung freigeben.`;
        if (p?.pickupReady) return _missionBushIsPickupCargoMission()
            ? 'Zielstrip erreicht. Zum Treffpunkt rollen und die Rueckholfracht aufnehmen.'
            : 'Zielstrip erreicht. Zum Treffpunkt rollen und den Pickup starten.';
        return 'Leerflug zum Zielstrip laeuft. Pickup wird erst nach Landung am Treffpunkt freigegeben.';
    }
    const mode = _missionBushEffectiveCompletionMode();
    if (mode === 'unload_at_target') {
        return _missionCargoNeedsUnload()
            ? 'Bush-Zielstrip erreicht. Pflichtladung wartet auf Entladung.'
            : 'Bush-Zielstrip erreicht. Versorgung kann regulär abgeschlossen werden.';
    }
    if (mode === 'passenger_dropoff') {
        return 'Bush-Zielstrip erreicht. Passagier wartet auf Farewell und Deboarding.';
    }
    if (mode === 'land_at_target') {
        return 'Bush-Zielstrip erreicht. Adventure-Leg ist sauber beendet.';
    }
    if (mode === 'return_home') {
        const p = _activeBushMissionProgress();
        if (p?.returnHomeQualified) return 'Bush-Recon abgeschlossen. Rueckkehr und Stillstand am Heimatplatz bestaetigt.';
        if (p?.areaQualified) return 'Recon im Zielgebiet abgeschlossen. Rueckflug zum Heimatplatz laeuft.';
        return `Recon noch offen. Gebietsdauer ${Math.round(Number(p?.areaDwellSec || 0))}s · Track ${Number(p?.areaTrackNm || 0).toFixed(1)} NM.`;
    }
    return 'Bush-Zielstrip erreicht. Auftrag kann regulär abgeschlossen werden.';
}

function _missionBushGroundEndReady(endReady = null) {
    if (!_missionSceneIsBushMission()) return false;
    const ready = endReady && typeof endReady === 'object' ? endReady : _missionEndReadiness();
    if (_missionBushIsPickupMission()) {
        const pos = window.lastLiveGpsPos || {};
        const curLat = Number(pos.lat);
        const curLon = Number(pos.lon);
        const progress = _activeBushMissionProgress();
        return !!(
            ready?.groundStill
            && Number.isFinite(curLat)
            && Number.isFinite(curLon)
            && _isAtMissionHome(curLat, curLon)
            && progress?.pickupCompleted
            && (progress?.passengerDropped || progress?.cargoDelivered)
            && _missionHasReachedEndEligibleFlightPhase()
        );
    }
    const completionMode = _missionBushEffectiveCompletionMode();
    const isSupportedBushCompletion = completionMode === 'unload_at_target'
        || completionMode === 'passenger_dropoff'
        || completionMode === 'land_at_target'
        || completionMode === 'return_home';
    if (!isSupportedBushCompletion) return false;
    if (completionMode === 'return_home') {
        const pos = window.lastLiveGpsPos || {};
        const curLat = Number(pos.lat);
        const curLon = Number(pos.lon);
        const progress = _activeBushMissionProgress();
        return !!(
            ready?.groundStill
            && Number.isFinite(curLat)
            && Number.isFinite(curLon)
            && _isAtMissionHome(curLat, curLon)
            && progress?.areaQualified
            && _missionHasReachedEndEligibleFlightPhase()
        );
    }
    return !!(ready?.groundStill && ready?.atTarget && _missionHasReachedEndEligibleFlightPhase());
}

function _missionRuntimeGroundEndReady(endReady = null) {
    const ready = endReady && typeof endReady === 'object' ? endReady : _missionEndReadiness();
    if (_missionSceneIsPoiMission()) return !!(ready?.ready || _missionPoiGroundEndReady(ready));
    if (_missionSceneIsBushMission()) return _missionBushGroundEndReady(ready);
    return !!ready?.ready;
}

function _missionPoiEndedAtHome(endReady = null) {
    if (!_missionSceneIsPoiMission()) return false;
    const pos = window.lastLiveGpsPos || {};
    const ready = endReady && typeof endReady === 'object' ? endReady : _missionEndReadiness();
    const curLat = Number(pos.lat);
    const curLon = Number(pos.lon);
    if (!ready?.groundStill || !Number.isFinite(curLat) || !Number.isFinite(curLon)) return false;
    return _isAtMissionHome(curLat, curLon);
}

function _aptArrivalPointForRuntime() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (md?.poiName || (typeof currentDestICAO !== 'undefined' && currentDestICAO === 'POI')) return null;
    const contract = md?.missionContract || window.activeMissionContract || {};
    const truth = md?.missionTruth || contract?.missionTruth || null;
    const plan = md?.aptArrivalPlan || contract?.aptArrivalPlan || truth?.arrivalScene || null;
    const lat = Number(plan?.lat);
    const lon = Number(plan?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon, plan };
}

function _distanceToAptArrivalNm(lat, lon) {
    const p = _aptArrivalPointForRuntime();
    if (!p) return null;
    return _haversineNmLocal(Number(lat), Number(lon), p.lat, p.lon);
}

function _hasAptArrivalRuntimePoint() {
    return !!_aptArrivalPointForRuntime();
}

function _isAtAptArrivalPoint(lat, lon, thresholdNm = 0.08) {
    const dNm = _distanceToAptArrivalNm(lat, lon);
    return Number.isFinite(dNm) ? dNm <= thresholdNm : false;
}

function _isAtMissionTarget(lat, lon, thresholdNm = 1.2) {
    const dNm = _distanceToMissionTargetNm(lat, lon);
    return Number.isFinite(dNm) ? dNm <= thresholdNm : false;
}

function _missionEndReadiness(lat = null, lon = null) {
    const fd = window.lastLiveFlightData || {};
    const pos = window.lastLiveGpsPos || {};
    const curLat = Number(lat ?? pos.lat);
    const curLon = Number(lon ?? pos.lon);
    if (!Number.isFinite(curLat) || !Number.isFinite(curLon)) {
        return { ready: false, reason: 'no_position', atTarget: false, groundStill: false, hasAptArrival: false };
    }
    const gs = Number.isFinite(Number(fd.gsKts)) ? Number(fd.gsKts)
        : (Number.isFinite(Number(fd.gs)) ? Number(fd.gs) : Number(pos.gs || 0));
    const agl = Number.isFinite(Number(fd.aglFt)) ? Math.max(0, Number(fd.aglFt)) : null;
    const onGround = typeof fd.onGround === 'boolean' ? !!fd.onGround : (!Number.isFinite(agl) || agl <= 40);
    const parkingBrakeSet = fd.parkingBrake === true || fd.parkingBrake === 1;
    const groundStill = onGround && (gs <= 2.0 || parkingBrakeSet);
    const hasAptArrival = _hasAptArrivalRuntimePoint();
    const dArrivalNm = hasAptArrival ? _distanceToAptArrivalNm(curLat, curLon) : null;
    const dMissionNm = _distanceToMissionTargetNm(curLat, curLon);
    const atArrivalPoint = hasAptArrival && Number.isFinite(dArrivalNm) && dArrivalNm <= 0.16;
    const atAirportFallback = hasAptArrival && Number.isFinite(dMissionNm) && dMissionNm <= 0.35;
    const atMissionTarget = !hasAptArrival && Number.isFinite(dMissionNm) && dMissionNm <= 1.2;
    const atTarget = atArrivalPoint || atAirportFallback || atMissionTarget;
    const reason = !groundStill ? 'not_stopped'
        : (!atTarget ? 'not_at_target'
            : (atArrivalPoint ? 'apt_arrival_point'
                : (atAirportFallback ? 'apt_airport_fallback' : 'mission_target')));
    return {
        ready: groundStill && atTarget,
        reason,
        atTarget,
        groundStill,
        hasAptArrival,
        dArrivalNm,
        dMissionNm,
        gs,
        onGround,
        parkingBrakeSet
    };
}

function _missionSceneFinishRuntimeAfterDeboard(reason = 'mission-end-after-farewell') {
    _missionPhaseDebugPush('trigger', { name: '_missionSceneFinishRuntimeAfterDeboard', reason });
    _missionCargoMarkPassengerUnloaded({ reason: `${reason}-passenger-sync` });
    let cargoOutcome = typeof _missionCargoFinalizeMissionOutcome === 'function'
        ? _missionCargoFinalizeMissionOutcome({ source: reason })
        : null;
    cargoOutcome = _missionOutcomeApplyPoiProgress(cargoOutcome, {
        endedAtHome: _missionPoiEndedAtHome(),
        needsRideHome: _missionPoiGroundEndReady() && !_missionPoiEndedAtHome()
    });
    _missionPhaseDebugPush('trigger', {
        name: '_missionSceneFinishRuntimeAfterDeboard:outcome',
        reason,
        failed: !!cargoOutcome?.failed,
        missingRequired: (cargoOutcome?.missingRequired || []).join(','),
        notDeliveredRequired: (cargoOutcome?.notDeliveredRequired || []).join(','),
        droppedRequired: (cargoOutcome?.droppedRequired || []).join(','),
        damagedRequired: (cargoOutcome?.damagedRequired || []).join(',')
    });
    const endSceneStarted = _tryStartMissionEndScene(reason, { force: true });
    _setMissionClosePending({ reason, outcome: cargoOutcome });
    return endSceneStarted || cargoOutcome || true;
}

function _missionFarewellRecordWithCargoOutcome(record) {
    const baseRecord = (record && typeof record === 'object') ? { ...record } : {};
    if (typeof _missionCargoEvaluateFarewellOutcome === 'function') {
        try {
            const outcome = _missionCargoEvaluateFarewellOutcome();
            if (outcome && typeof outcome === 'object' && outcome.status !== 'none') {
                baseRecord.missionCargoOutcome = outcome;
                baseRecord.missionFailed = !!outcome.failed;
            }
        } catch (_) {}
    }
    if (typeof _missionPoiProgressState === 'function') {
        try {
            const poiProgress = _missionPoiProgressState();
            if (poiProgress && typeof poiProgress === 'object' && typeof poiProgress.aborted === 'boolean') {
                baseRecord.poiAborted = !!poiProgress.aborted;
            }
        } catch (_) {}
    }
    return Object.keys(baseRecord).length ? baseRecord : null;
}

function _triggerPaxFarewellAndWaitForDeboard(record, reason = 'pax-farewell') {
    _missionPhaseDebugPush('trigger', { name: '_triggerPaxFarewellAndWaitForDeboard', reason });
    if (typeof window.triggerPaxFarewell !== 'function') return false;
    if (typeof _missionCargoNeedsUnload === 'function' && _missionCargoNeedsUnload()) {
        _missionPhaseDebugPush('trigger', { name: '_triggerPaxFarewellAndWaitForDeboard:blocked-unload', reason });
        return false;
    }
    const farewellRecord = _missionFarewellRecordWithCargoOutcome(record);
    missionRuntime.waitingFarewellDeboarding = true;
    missionRuntime.deboardingAfterFarewellStarted = false;
    try {
        window.triggerPaxFarewell(farewellRecord);
        _missionPhaseDebugPush('trigger', { name: '_triggerPaxFarewellAndWaitForDeboard:started', reason });
    } catch (err) {
        missionRuntime.waitingFarewellDeboarding = false;
        _missionPhaseDebugPush('trigger', {
            name: '_triggerPaxFarewellAndWaitForDeboard:error',
            reason,
            error: err?.message || String(err)
        });
        console.warn('[MissionRuntime] Pax farewell trigger failed:', err);
        return false;
    }
    setTimeout(() => {
        if (missionRuntime.waitingFarewellDeboarding && !missionRuntime.deboardingAfterFarewellStarted) {
            window.missionSceneStartDeboardingAfterFarewell(`${reason}-timeout`);
        }
    }, 90000);
    return true;
}

window.missionSceneStartDeboardingAfterFarewell = function(reason = 'pax-farewell-complete') {
    _missionPhaseDebugPush('trigger', {
        name: 'missionSceneStartDeboardingAfterFarewell',
        reason,
        waitingFarewellDeboarding: !!missionRuntime.waitingFarewellDeboarding,
        deboardingAfterFarewellStarted: !!missionRuntime.deboardingAfterFarewellStarted
    });
    if (!missionRuntime.waitingFarewellDeboarding) return false;
    if (missionRuntime.deboardingAfterFarewellStarted) return false;
    missionRuntime.deboardingAfterFarewellStarted = true;
    return _missionSceneFinishRuntimeAfterDeboard(reason);
};

window.missionRuntimeReset = function(options = {}) {
    const respawnAfterClear = options && options.respawnAfterClear === true;
    if (!window.simModeActive && !window.liveTrackerConnected) missionSceneReconnectResyncPending = true;
    if (!window.simModeActive && window.liveTrackerConnected) missionSceneReconnectResyncPending = false;
    if (typeof window.closeMissionCargoDialog === 'function') window.closeMissionCargoDialog();
    if (typeof window.paxVoiceResetMission === 'function') {
        try { window.paxVoiceResetMission(); } catch (_) {}
    }
    if (typeof _missionCargoResetForMissionReset === 'function') {
        _missionCargoResetForMissionReset('mission-runtime-reset').catch(err => {
            console.warn('[MissionCargo] Reset payload sync failed:', err?.message || err);
        });
    }
    if (typeof window.missionSmokeClear === 'function') window.missionSmokeClear('mission-runtime-reset');
    if (typeof window.clearMissionSceneObjects === 'function') window.clearMissionSceneObjects('mission-runtime-reset');
    else if (typeof window.missionSceneClear === 'function') window.missionSceneClear('mission-runtime-reset');
    _clearMissionStartPhase();
    Object.assign(window.missionSceneStatus, {
        spawned: false,
        spawnedCount: 0,
        spawnRequested: false,
        clearRequested: false,
        boardingRequested: false,
        boardingActive: false,
        boardingComplete: false,
        boardingError: null,
        personBoarded: false,
        autoSpawnedFor: null,
        autoClearedFor: null,
        respawnAfterClear
    });
    Object.assign(window.missionTargetSceneStatus, {
        sceneId: null,
        kind: null,
        spawned: false,
        spawnedCount: 0,
        spawnRequested: false,
        clearRequested: false,
        cleared: false,
        clearedCount: 0,
        error: null
    });
    Object.assign(window.missionAptArrivalSceneStatus, {
        sceneId: null,
        role: null,
        planSignature: null,
        resolvedScene: null,
        lastCommandSummary: null,
        spawned: false,
        spawnedCount: 0,
        spawnRequested: false,
        clearRequested: false,
        cleared: false,
        clearedCount: 0,
        error: null
    });
    _resetMissionRuntime();
    _missionCargoClearSignatureAnimation();
    window.missionCargoStatus.loadConfirmed = false;
    resetFlightRecorder();
    if (respawnAfterClear) {
        setTimeout(() => {
            if (window.missionSceneStatus?.respawnAfterClear) {
                window.missionSceneStatus.respawnAfterClear = false;
                _missionSceneHandleFlightTick(window.lastLiveFlightData || {}, 'mission-runtime-reset-fallback-respawn');
            }
        }, 2200);
    }
};

window.startMissionBoarding = async function() {
    if (missionStartBoardingPromise) return missionStartBoardingPromise;
    if (typeof window.paxVoiceUnlockAudio === 'function') {
        try { window.paxVoiceUnlockAudio('boarding-click'); } catch (_) {}
    }
    if (missionRuntime.active) return true;
    if (!window.simModeActive && (window.missionSceneStatus?.boardingRequested || window.missionSceneStatus?.boardingActive || missionSceneBoardingPromise)) {
        _updateMissionRuntimeUi();
        return true;
    }
    if (!_hasValidMissionForStart() || !_missionStartGroundReady()) {
        _updateMissionRuntimeUi();
        return false;
    }
    _setMissionStartPhase('boarding');
    _setMissionRuntimePhase('boarding', { updateUi: false });
    _updateMissionRuntimeUi();
    missionStartBoardingPromise = (async () => {
        const bannerBtn = document.getElementById('missionStartBannerBtn');
        const mapBtn = document.getElementById('mapMissionToggleBtn');
        const oldBannerText = bannerBtn ? bannerBtn.textContent : '';
        if (bannerBtn) {
            bannerBtn.disabled = true;
            bannerBtn.textContent = 'Boarding läuft...';
        }
        if (mapBtn) mapBtn.disabled = true;
        try {
            if (typeof window.paxVoicePrepareBoarding === 'function') {
                try { window.paxVoicePrepareBoarding(); } catch (_) {}
            }
            if (typeof window.openMissionCargoDialog === 'function') {
                try { window.openMissionCargoDialog('load'); } catch (_) {}
            }
            const playBoardingReminder = async () => {
                if (typeof window.paxVoicePlayBoarding !== 'function') return false;
                try {
                    return !!(await window.paxVoicePlayBoarding());
                } catch (_) {
                    return false;
                }
            };
            if (!window.simModeActive && typeof window.missionSceneBoarding === 'function') {
                let ack = null;
                try {
                    ack = await window.missionSceneBoarding('boarding-click');
                } catch (err) {
                    console.warn('Boarding animation fehlgeschlagen:', err);
                }
                if (ack && ack.status && ack.status !== 'ok') {
                    console.warn('Boarding animation nicht bestätigt:', ack.status, ack.error || '');
                }
                await playBoardingReminder();
            } else {
                await playBoardingReminder();
            }
            const pos = window.lastLiveGpsPos || {};
            if (typeof window.paxVoicePrepareGreeting === 'function') {
                try { window.paxVoicePrepareGreeting(pos.lat, pos.lon); } catch (_) {}
            }
            if (document.getElementById('missionCargoOverlay')?.style.display === 'flex') {
                _missionCargoRenderDialog('load', { skipPayloadRefresh: true });
            }
            return true;
        } finally {
            if (bannerBtn) {
                bannerBtn.disabled = false;
                bannerBtn.textContent = oldBannerText || 'Mission starten';
            }
            if (mapBtn) mapBtn.disabled = false;
            _updateMissionRuntimeUi();
        }
    })();
    try {
        return await missionStartBoardingPromise;
    } finally {
        missionStartBoardingPromise = null;
    }
};

window.manualMissionStart = function() {
    if (typeof window.paxVoiceUnlockAudio === 'function') {
        try { window.paxVoiceUnlockAudio('mission-start-click'); } catch (_) {}
    }
    if (_missionRuntimePhaseSnapshot() !== 'boarded') {
        _updateMissionRuntimeUi();
        return false;
    }
    _setMissionStartPhase('boarded');
    missionRuntime.phase = 'active';
    missionRuntime.armed = true;
    missionRuntime.active = true;
    missionRuntime.manual = true;
    missionRuntime.readySince = 0;
    missionRuntime.pendingEndAt = 0;
    missionRuntime.lastOffDestAt = 0;
    missionRuntime.landingRollTriggered = false;
    missionRuntime.arrivalFarewellTriggered = false;
    missionRuntime.arrivalFlightRecord = null;
    missionRuntime.waitingFarewellDeboarding = false;
    missionRuntime.deboardingAfterFarewellStarted = false;
    missionRuntime.endReadinessKey = '';
    resetFlightRecorder();
    const pos = window.lastLiveGpsPos;
    if ((pos || window.simModeActive) && !_missionBushIsPickupMission()) {
        setTimeout(() => _triggerGreetingAfterBoardingVoice(pos?.lat, pos?.lon), 200);
    }
    if (!window.simModeActive && typeof window.missionSmokeEnsureSpawned === 'function') window.missionSmokeEnsureSpawned('manual-mission-start');
    if (!window.simModeActive && typeof window.missionTargetSceneEnsureSpawned === 'function') window.missionTargetSceneEnsureSpawned('manual-mission-start');
    if (!window.simModeActive && typeof window.missionAptArrivalEnsureSpawned === 'function') window.missionAptArrivalEnsureSpawned('manual-mission-start');
    if (!window.simModeActive && typeof _missionSceneHandleFlightTick === 'function') {
        setTimeout(() => _missionSceneHandleFlightTick(window.lastLiveFlightData || {}, 'manual-mission-start'), 600);
    }
    _updateMissionRuntimeUi();
    return true;
};

window.manualMissionEnd = function(options = {}) {
    _missionPhaseDebugPush('trigger', {
        name: 'manualMissionEnd',
        skipCargoUnload: !!options?.skipCargoUnload
    });
    const endReady = _missionEndReadiness();
    const poiGroundEndReady = _missionPoiGroundEndReady(endReady);
    const bushGroundEndReady = _missionBushGroundEndReady(endReady);
    const runtimeGroundEndReady = _missionRuntimeGroundEndReady(endReady);
    const groundAction = _missionResolveGroundAction({ endReady, active: true, trigger: 'manualMissionEnd' });
    if (!options.skipCargoUnload && typeof window.openMissionCargoDialog === 'function' && groundAction.action === 'pickup') {
        _missionPhaseDebugPush('dialog', { mode: 'pickup', trigger: 'manualMissionEnd', phase: groundAction.phase });
        window.openMissionCargoDialog('pickup');
        return false;
    }
    if (!options.skipCargoUnload && typeof window.openMissionCargoDialog === 'function' && (groundAction.action === 'unload' || poiGroundEndReady)) {
        _missionPhaseDebugPush('dialog', { mode: 'unload', trigger: 'manualMissionEnd', phase: groundAction.phase, poiGroundEndReady: !!poiGroundEndReady });
        window.openMissionCargoDialog('unload');
        return false;
    }
    if (_missionEndDeboardingBusy()) {
        _updateMissionRuntimeUi();
        return true;
    }
    const poiEndedAtHome = poiGroundEndReady && _missionPoiEndedAtHome(endReady);
    const poiNeedsRideHome = poiGroundEndReady && !poiEndedAtHome;
    let farewellRecord = missionRuntime.arrivalFlightRecord || _buildFlightRecordSnapshot(Date.now()) || null;
    let cargoOutcome = typeof _missionCargoFinalizeMissionOutcome === 'function'
        ? _missionCargoFinalizeMissionOutcome({ source: 'manual-mission-end-preview' })
        : null;
    cargoOutcome = _missionOutcomeApplyPoiProgress(cargoOutcome, {
        endedAtHome: poiEndedAtHome,
        needsRideHome: poiNeedsRideHome
    });
    cargoOutcome = _missionOutcomeApplyEndReadiness(cargoOutcome, endReady);
    if (farewellRecord && typeof farewellRecord === 'object') {
        farewellRecord = {
            ...farewellRecord,
            missionCargoOutcome: cargoOutcome || farewellRecord.missionCargoOutcome,
            missionFailed: !!cargoOutcome?.failed,
            poiNeedsRideHome
        };
    }
    const poiCargoHardFail = (
        endReady.groundStill
        && !endReady.atTarget
        && _missionSceneIsPoiMission()
        && _missionCargoHasHardFailure(_missionCargoHardFailurePreview())
    );
    if ((endReady.atTarget || poiGroundEndReady || bushGroundEndReady || runtimeGroundEndReady) && typeof _triggerPaxFarewellAndWaitForDeboard === 'function') {
        if (_triggerPaxFarewellAndWaitForDeboard(farewellRecord, 'manual-end-farewell')) {
            return true;
        }
    }
    if (poiCargoHardFail && typeof _triggerPaxFarewellAndWaitForDeboard === 'function') {
        if (_triggerPaxFarewellAndWaitForDeboard(farewellRecord, 'manual-end-poi-cargo-failure-farewell')) {
            return true;
        }
    }
    cargoOutcome = typeof _missionCargoFinalizeMissionOutcome === 'function'
        ? _missionCargoFinalizeMissionOutcome({ source: 'manual-mission-end' })
        : cargoOutcome;
    cargoOutcome = _missionOutcomeApplyPoiProgress(cargoOutcome, {
        endedAtHome: poiEndedAtHome,
        needsRideHome: poiNeedsRideHome
    });
    cargoOutcome = _missionOutcomeApplyEndReadiness(cargoOutcome, endReady);
    if (!endReady.atTarget && !poiGroundEndReady && typeof window.triggerPaxOffDestinationLanding === 'function') {
        const dTargetNm = endReady.hasAptArrival && Number.isFinite(Number(endReady.dArrivalNm))
            ? Number(endReady.dArrivalNm)
            : Number(endReady.dMissionNm);
        if (Number.isFinite(dTargetNm)) {
            try { window.triggerPaxOffDestinationLanding(dTargetNm); } catch (_) {}
        }
    }
    const endSceneStarted = _tryStartMissionEndScene('manual-mission-end', { force: true });
    _missionPhaseDebugPush('trigger', {
        name: 'manualMissionEnd:finalize',
        endSceneStarted: !!endSceneStarted,
        runtimeGroundEndReady: !!runtimeGroundEndReady,
        bushGroundEndReady: !!bushGroundEndReady,
        poiGroundEndReady: !!poiGroundEndReady
    });
    _setMissionClosePending({ reason: 'manual-mission-end', outcome: cargoOutcome });
    const pos = window.lastLiveGpsPos;
    const shouldFinalize = !!(flightRecorder && (flightRecorder.active || flightRecorder.hadAirbornePhase || (Array.isArray(flightRecorder.track) && flightRecorder.track.length > 1)));
    if (shouldFinalize) finalizeFlightRecorder(Date.now(), pos?.lat ?? null, pos?.lon ?? null);
    else resetFlightRecorder();
    return endSceneStarted || cargoOutcome || true;
};

window.completeMissionClose = function(reason = 'mission-close') {
    if (!missionRuntime.closingPending) return false;
    if (typeof _missionCargoFinalizeMissionOutcome === 'function' && !missionRuntime.closingOutcome) {
        try {
            missionRuntime.closingOutcome = _missionCargoFinalizeMissionOutcome({ source: reason });
        } catch (_) {}
    }
    if (typeof window.missionRuntimeReset === 'function') {
        window.missionRuntimeReset({ respawnAfterClear: false });
        return true;
    }
    return false;
};

window.toggleManualMissionRuntime = function() {
    if (missionRuntime.closingPending) window.completeMissionClose('toggle-manual-runtime');
    else if (missionRuntime.active) window.manualMissionEnd();
    else window.manualMissionStart();
};

function _tryStartMissionEndScene(reason = 'mission-end', options = {}) {
    if (window.simModeActive) return false;
    if (!window.liveTrackerConnected) return false;
    const pos = window.lastLiveGpsPos || {};
    if (!Number.isFinite(Number(pos.lat)) || !Number.isFinite(Number(pos.lon))) return false;
    const fd = window.lastLiveFlightData || {};
    const gs = Number.isFinite(Number(fd.gsKts)) ? Number(fd.gsKts) : (Number.isFinite(Number(fd.gs)) ? Number(fd.gs) : Number(pos.gs || 0));
    const parked = fd.parkingBrake === true || fd.parkingBrake === 1;
    const onGround = typeof fd.onGround === 'boolean' ? fd.onGround : true;
    const groundStill = onGround && ((!!options.force && gs <= 8) || parked || gs <= 3);
    if (!groundStill) return false;
    if (typeof window.missionSceneDeboarding !== 'function') return false;
    return !!window.missionSceneDeboarding(reason);
}

window.handleMissionStartBannerAction = async function() {
    if (missionStartActionPromise) return missionStartActionPromise;
    missionStartActionPromise = (async () => {
        _missionPhaseDebugPush('trigger', {
            name: 'handleMissionStartBannerAction',
            runtimeActive: !!missionRuntime.active,
            closingPending: !!missionRuntime.closingPending
        });
        const phase = _missionStartPhase();
        if (missionRuntime.closingPending) {
            window.completeMissionClose('banner-close');
            return;
        }
        if (_missionEndDeboardingBusy()) {
            _updateMissionRuntimeUi();
            return;
        }
        if (missionRuntime.active) {
            const groundAction = _missionResolveGroundAction({ active: true, trigger: 'handleMissionStartBannerAction' });
            if (typeof window.openMissionCargoDialog === 'function' && groundAction.action === 'pickup') {
                _missionPhaseDebugPush('dialog', { mode: 'pickup', trigger: 'handleMissionStartBannerAction', phase: groundAction.phase });
                window.openMissionCargoDialog('pickup');
                return;
            }
            if (typeof window.openMissionCargoDialog === 'function' && groundAction.action === 'unload') {
                _missionPhaseDebugPush('dialog', { mode: 'unload', trigger: 'handleMissionStartBannerAction', phase: groundAction.phase });
                window.openMissionCargoDialog('unload');
                return;
            }
            if (window.simModeActive && typeof window.completeSimMissionEnd === 'function' && groundAction.action === 'end') {
                _missionPhaseDebugPush('trigger', {
                    name: 'handleMissionStartBannerAction:complete-sim-end',
                    phase: groundAction.phase
                });
                window.completeSimMissionEnd();
                return;
            }
            window.manualMissionEnd();
            return;
        }
        if (phase === 'planned') {
            _setMissionStartPhase('prepare');
            _setMissionRuntimePhase('planned');
            _updateMissionRuntimeUi();
            if (!window.simModeActive && typeof _missionSceneHandleFlightTick === 'function') {
                setTimeout(() => _missionSceneHandleFlightTick(window.lastLiveFlightData || {}, 'mission-start-prepare'), 120);
            }
            return;
        }
        if (phase === 'prepare') {
            await window.startMissionBoarding();
            return;
        }
        if (phase !== 'boarded') {
            await window.startMissionBoarding();
            return;
        }
        window.manualMissionStart();
    })();
    try {
        return await missionStartActionPromise;
    } finally {
        missionStartActionPromise = null;
    }
};

// --- LIVE TRAFFIC ---
let liveTrafficMarkers = {}; // key → { marker }
window.vpTrafficData = [];
window.vpTrafficMapVisible = true;

function isMapHintOn(key, fallback = true) {
    if (typeof window.isMapHintEnabled === 'function') return window.isMapHintEnabled(key);
    return fallback;
}

function isLowFpsModeActive() {
    if (typeof window.isMapHintEnabled === 'function') return window.isMapHintEnabled('lowFps');
    return localStorage.getItem('ga_map_hint_lowFps') === 'true';
}

function normalizePlaneIconColor(value) {
    const v = String(value || '').trim();
    return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : null;
}

function normalizePlaneIconSize(value) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return null;
    return Math.min(PLANE_ICON_MAX_SIZE, Math.max(PLANE_ICON_MIN_SIZE, n));
}

function getCurrentPlaneIconDefaults() {
    const rootStyle = getComputedStyle(document.documentElement);
    const colorCss = normalizePlaneIconColor(rootStyle.getPropertyValue('--plane-color').trim());
    const sizeCss = normalizePlaneIconSize(rootStyle.getPropertyValue('--plane-size'));
    return {
        color: colorCss || PLANE_ICON_DEFAULT_COLOR,
        size: sizeCss || PLANE_ICON_DEFAULT_SIZE
    };
}

function applyPlaneIconSettings({ color, size, persist = false } = {}) {
    const defaults = getCurrentPlaneIconDefaults();
    const nextColor = normalizePlaneIconColor(color) || defaults.color;
    const nextSize = normalizePlaneIconSize(size) || defaults.size;
    document.documentElement.style.setProperty('--plane-color', nextColor);
    document.documentElement.style.setProperty('--plane-size', `${nextSize}px`);
    if (persist) {
        localStorage.setItem(PLANE_ICON_COLOR_KEY, nextColor);
        localStorage.setItem(PLANE_ICON_SIZE_KEY, String(nextSize));
    }

    const colorPicker = document.getElementById('vpPlaneColorPicker');
    if (colorPicker && colorPicker.value !== nextColor) colorPicker.value = nextColor;

    const sizeSlider = document.getElementById('vpPlaneSizeSlider');
    if (sizeSlider) sizeSlider.value = String(nextSize);

    const sizeLabel = document.getElementById('vpPlaneSizeValue');
    if (sizeLabel) sizeLabel.textContent = `${nextSize} px`;
}

function initPlaneIconSettingsUi() {
    const defaults = getCurrentPlaneIconDefaults();
    const storedColor = normalizePlaneIconColor(localStorage.getItem(PLANE_ICON_COLOR_KEY));
    const storedSize = normalizePlaneIconSize(localStorage.getItem(PLANE_ICON_SIZE_KEY));
    applyPlaneIconSettings({
        color: storedColor || defaults.color,
        size: storedSize || defaults.size
    });

    const colorPicker = document.getElementById('vpPlaneColorPicker');
    if (colorPicker && !colorPicker.dataset.boundPlaneIcon) {
        colorPicker.dataset.boundPlaneIcon = '1';
        colorPicker.addEventListener('input', (e) => {
            applyPlaneIconSettings({ color: e.target.value, persist: true });
        });
    }

    const sizeSlider = document.getElementById('vpPlaneSizeSlider');
    if (sizeSlider && !sizeSlider.dataset.boundPlaneIcon) {
        sizeSlider.dataset.boundPlaneIcon = '1';
        sizeSlider.addEventListener('input', (e) => {
            applyPlaneIconSettings({ size: e.target.value, persist: true });
        });
    }
}

window.clearLiveToWpLine = function() {
    if (liveToWpLine) {
        try { liveToWpLine.remove(); } catch (e) {}
        liveToWpLine = null;
    }
};

function toggleAutoFollow() {
    isAutoFollow = !isAutoFollow;
    if (isAutoFollow) {
        lastAutoFollowPanAt = 0;
        lastAutoFollowPanPos = null;
    }
    const btn = document.getElementById('autoFollowBtn');
    if (btn) {
        btn.style.background = isAutoFollow ? 'var(--blue)' : '#666';
        btn.innerHTML = isAutoFollow ? '🎯' : '📍';
    }
}

function saveSyncId() {
    const id = document.getElementById('syncIdInput').value.trim();
    const pin = document.getElementById('syncPinInput').value.trim();
    
    localStorage.setItem('ga_sync_id', id);
    localStorage.setItem('ga_sync_pin', pin);
    
    // Wir setzen den Status auf Offline zurück, wenn sich die ID ändert,
    // außer wir sind gerade mitten im Login-Check.
    setSyncLoginState(false);
}

async function triggerLoginFlow(isAutoLogin = false) {
    const id = getSyncId();
    const pin = getSyncPin();

    if (!id || !pin) {
        if (!isAutoLogin) alert("Bitte Pilot-ID und PIN eingeben.");
        return;
    }

    const loginBtn = document.getElementById('loginSyncBtn');
    if (loginBtn) {
        loginBtn.innerText = "🔑 Prüfe...";
        loginBtn.disabled = true;
    }

    try {
        // Fall A: Existenz-Prüfung & PIN-Check (GET)
        const res = await fetch(SYNC_URL + id + "?pin=" + pin, {
            headers: { 'X-Pilot-PIN': pin }
        });

        if (res.status === 200) {
            // Erfolg (Existiert & PIN stimmt)
            localStorage.setItem('ga_saved_id', id);
            localStorage.setItem('ga_saved_pin', pin);
            if (!isAutoLogin) alert("✅ Erfolgreich angemeldet!");
            setSyncLoginState(true);
        } else if (res.status === 401) {
            // ID existiert, aber PIN falsch
            if (!isAutoLogin) {
                alert("❌ Zugriff verweigert: Passwort falsch oder ID bereits vergeben!");
            } else {
                // Bei stillem Auto-Login Fehler: Daten löschen, damit nicht bei jedem Load der Fehler passiert
                localStorage.removeItem('ga_saved_id');
                localStorage.removeItem('ga_saved_pin');
            }
            setSyncLoginState(false);
        } else if (res.status === 404) {
            // ID ist noch frei! -> Fall C: Registrieren (POST)
            const registerRes = await fetch(SYNC_URL + id, {
                method: 'POST',
                headers: { 'X-Pilot-PIN': pin, 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: pin, flights: [], lastModified: Date.now() })
            });
            if (registerRes.ok) {
                localStorage.setItem('ga_saved_id', id);
                localStorage.setItem('ga_saved_pin', pin);
                if (!isAutoLogin) alert("✅ Neuer Pilot erfolgreich registriert!");
                setSyncLoginState(true);
            } else {
                throw new Error("Registrierung fehlgeschlagen");
            }
        } else {
            throw new Error("Server-Fehler");
        }
    } catch (e) {
        console.error("[Login] Fehler:", e);
        if (!isAutoLogin) alert("⚠️ Verbindung zum Sync-Server fehlgeschlagen.");
        setSyncLoginState(false);
    } finally {
        if (loginBtn) {
            loginBtn.innerText = "🔑 Login / Verknüpfen";
            loginBtn.disabled = false;
        }
    }
}

function setSyncLoginState(isLoggedIn) {
    const led = document.getElementById('loginLed');
    const txt = document.getElementById('loginText');
    const syncStatus = document.getElementById('syncStatus');
    const syncId = getSyncId();
    const loginBtn = document.getElementById('loginSyncBtn');

    if (isLoggedIn) {
        if (led) { led.style.background = "#00ff41"; led.style.boxShadow = "0 0 8px #00ff41"; }
        if (txt) { txt.innerText = "Verbunden"; txt.style.color = "#00ff41"; }
        if (syncStatus) syncStatus.innerText = "Bereit (" + syncId + ")";
        
        // Buttons aktivieren, Login-Button bleibt immer aktiv
        document.querySelectorAll('.sync-req-btn').forEach(btn => btn.disabled = false);
        if (loginBtn) loginBtn.disabled = false; // Ensure login button is enabled

        const toggle = document.getElementById('syncToggle');
        if (toggle) toggle.disabled = false;

        // Hint aktualisieren
        const hint = document.getElementById('loginHint');
        if (hint) hint.innerText = "Du bist als " + syncId + " angemeldet. Daten werden synchronisiert.";

        // Sync & GPS starten falls gewünscht
        const t = document.getElementById('syncToggle');
        if (t) {
            const savedToggle = localStorage.getItem('ga_sync_enabled') === 'true';
            t.checked = savedToggle;
            const label = document.getElementById('autoSyncLabel');
            if (label) label.style.color = savedToggle ? '#4caf50' : '#888';
        }
        if (t && t.checked) silentSyncLoad();
        if (typeof connectToLiveGPS === 'function') connectToLiveGPS(syncId);
    } else {
        if (led) { led.style.background = "#d93829"; led.style.boxShadow = "0 0 5px #d93829"; }
        if (txt) { txt.innerText = "Offline"; txt.style.color = "#888"; }
        if (syncStatus) syncStatus.innerText = "Anmeldung erforderlich";
        
        // Buttons deaktivieren, Login-Button bleibt immer aktiv
        document.querySelectorAll('.sync-req-btn').forEach(btn => {
            if (btn.id !== 'loginSyncBtn') btn.disabled = true;
        });
        if (loginBtn) loginBtn.disabled = false; // Ensure login button is enabled

        const toggle = document.getElementById('syncToggle');
        if (toggle) { toggle.disabled = true; toggle.checked = false; }

        const hint = document.getElementById('loginHint');
        if (hint) hint.innerText = "Bitte logge dich ein, um Cloud-Sync zu nutzen.";
    }
}
function updateSyncStatus(msg, isError = false) {
    const el = document.getElementById('syncStatus');
    if (el) {
        el.innerText = msg;
        el.style.color = isError ? "var(--red)" : "var(--green)";
        setTimeout(() => { if(el.innerText === msg) el.style.color = "#888"; }, 4000);
    }
}
function flashSyncIndicator(direction) {
    const ind = document.getElementById('syncTrafficIndicator');
    if (!ind) return;
    ind.innerText = direction === 'up' ? '⬆️' : '⬇️';
    ind.style.opacity = '1';
    setTimeout(() => { ind.style.opacity = '0'; }, 800);
}
function getAircraftPresetsForSync() {
    try {
        return JSON.parse(localStorage.getItem('ga_aircraft_presets_v1') || '{}') || {};
    } catch (_) {
        return {};
    }
}
function applyAircraftPresetsFromSync(data) {
    if (!data || typeof data !== 'object') return;
    try {
        localStorage.setItem('ga_aircraft_presets_v1', JSON.stringify(data));
        if (typeof window.loadAircraftPresets === 'function') window.loadAircraftPresets();
        if (typeof window.updateAircraftPresetButtonsUI === 'function') window.updateAircraftPresetButtonsUI();
        if (typeof window.selectAircraftPresetSlotFromSettings === 'function') {
            window.selectAircraftPresetSlotFromSettings(window.activeAircraftPresetSettingsSlot || window.selectedAC || 'C172');
        }
    } catch (_) {}
}

function _syncJsonClone(value) {
    if (value == null) return value;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_) {
        return null;
    }
}

function _syncCompactArray(arr, maxItems = 80) {
    const src = Array.isArray(arr) ? arr : [];
    if (src.length <= maxItems) return src;
    if (typeof compactFlightTrackForStorage === 'function') {
        try { return compactFlightTrackForStorage(src, maxItems); } catch (_) {}
    }
    if (maxItems <= 1) return src.length ? [src[src.length - 1]] : [];
    const out = [];
    const step = (src.length - 1) / (maxItems - 1);
    for (let i = 0; i < maxItems; i++) {
        out.push(src[Math.min(src.length - 1, Math.round(i * step))]);
    }
    return out;
}

function _syncCompactFlightRecord(record, maxTrack = 80) {
    const rec = _syncJsonClone(record);
    if (!rec || typeof rec !== 'object') return rec;
    if (Array.isArray(rec.track)) rec.track = _syncCompactArray(rec.track, maxTrack);
    return rec;
}

function _syncCompactFlightDataState(state, level = 1) {
    const out = _syncJsonClone(state);
    if (!out || typeof out !== 'object') return out;
    if (level >= 1) {
        delete out.vpElevationData;
        delete out.vpSegmentAlts;
        delete out.freqCache;
        if (out.currentMissionData && typeof out.currentMissionData === 'object') {
            delete out.currentMissionData.targetGeoContext;
            delete out.currentMissionData.missionPlanV3;
            delete out.currentMissionData.targetSceneDebug;
            delete out.currentMissionData.missionTruth;
            delete out.currentMissionData.missionContract;
        }
        if (out.activeMissionContract && typeof out.activeMissionContract === 'object') {
            delete out.activeMissionContract.targetGeoContext;
            delete out.activeMissionContract.missionTruth;
        }
    }
    if (level >= 2) {
        delete out.activeMissionContract;
        delete out.missionRouteWaypoints;
        delete out.vpAltWaypoints;
    }
    return out;
}

function _syncCompactPinboard(pinboard, options = {}) {
    const maxFlightRecords = Number.isFinite(Number(options.maxFlightRecords)) ? Number(options.maxFlightRecords) : 8;
    const maxTrack = Number.isFinite(Number(options.maxTrack)) ? Number(options.maxTrack) : 80;
    const flightDataLevel = Number.isFinite(Number(options.flightDataLevel)) ? Number(options.flightDataLevel) : 1;
    const textMax = Number.isFinite(Number(options.textMax)) ? Number(options.textMax) : 8000;
    let notes = Array.isArray(pinboard) ? pinboard.map(n => _syncJsonClone(n)).filter(Boolean) : [];
    if (Number.isFinite(Number(options.maxNotes)) && notes.length > Number(options.maxNotes)) {
        notes = notes.slice(Math.max(0, notes.length - Number(options.maxNotes)));
    }
    const flightRecordIndexes = [];
    notes.forEach((note, idx) => {
        if (note?.type === 'flight_record') flightRecordIndexes.push(idx);
    });
    while (flightRecordIndexes.length > maxFlightRecords) {
        const idx = flightRecordIndexes.shift();
        notes.splice(idx, 1);
        for (let i = 0; i < flightRecordIndexes.length; i++) flightRecordIndexes[i] -= 1;
    }
    notes.forEach(note => {
        if (!note || typeof note !== 'object') return;
        if (typeof note.text === 'string' && note.text.length > textMax) note.text = note.text.slice(0, textMax);
        if (note.type === 'flight_record' && note.flightRecord) {
            note.flightRecord = _syncCompactFlightRecord(note.flightRecord, maxTrack);
        }
        if (note.type === 'flight' && note.flightData) {
            if (options.dropFlightData) delete note.flightData;
            else note.flightData = _syncCompactFlightDataState(note.flightData, flightDataLevel);
        }
    });
    return notes;
}

function _syncCompactActiveMission(activeMission, level = 1) {
    const out = _syncCompactFlightDataState(activeMission, level);
    if (!out || typeof out !== 'object') return out;
    if (out.currentMissionData && typeof out.currentMissionData === 'object') {
        if (level >= 1) {
            delete out.currentMissionData.targetSceneDebug;
            delete out.currentMissionData.missionPipelineDebug;
            delete out.currentMissionData.missionPlanV3;
        }
        if (level >= 2) {
            delete out.currentMissionData.targetGeoContext;
            delete out.currentMissionData.missionTruth;
        }
    }
    return out;
}

function _syncBuildUploadPayload(basePayload, localSyncTs, pin) {
    const attempts = [
        { maxFlightRecords: 12, maxTrack: 100, flightDataLevel: 1, logbookMax: 40, missionLevel: 1 },
        { maxFlightRecords: 8, maxTrack: 70, flightDataLevel: 1, logbookMax: 30, missionLevel: 1 },
        { maxFlightRecords: 5, maxTrack: 40, flightDataLevel: 2, logbookMax: 20, missionLevel: 2 },
        { maxFlightRecords: 2, maxTrack: 20, flightDataLevel: 2, logbookMax: 10, missionLevel: 2 },
        { maxFlightRecords: 0, maxTrack: 0, flightDataLevel: 2, logbookMax: 5, missionLevel: 2, maxNotes: 50, textMax: 1000, dropFlightData: true, dropActiveMission: true }
    ];

    let last = null;
    for (const cfg of attempts) {
        const payload = {
            ...basePayload,
            pinboard: _syncCompactPinboard(basePayload.pinboard, cfg),
            logbook: Array.isArray(basePayload.logbook) ? basePayload.logbook.slice(0, cfg.logbookMax) : [],
            activeMission: cfg.dropActiveMission ? null : _syncCompactActiveMission(basePayload.activeMission, cfg.missionLevel),
            lastModified: localSyncTs,
            pin
        };
        const bodyStr = JSON.stringify(payload);
        last = { payload, bodyStr, compacted: true };
        if (bodyStr.length <= SYNC_MAX_UPLOAD_BYTES) return last;
    }
    return last || { payload: { ...basePayload, lastModified: localSyncTs, pin }, bodyStr: JSON.stringify({ ...basePayload, lastModified: localSyncTs, pin }), compacted: false };
}

function _syncMissionStateIsDraft(state = null) {
    if (!state || typeof state !== 'object') return false;
    if (typeof window.isMissionDraftPending === 'function') {
        try { return !!window.isMissionDraftPending(state); } catch (_) {}
    }
    const md = state.currentMissionData && typeof state.currentMissionData === 'object' ? state.currentMissionData : state;
    if (!md || typeof md !== 'object') return false;
    if (md.sceneAccepted === false) return true;
    const status = String(md.sceneCompositionStatus || '').toLowerCase();
    return status === 'draft' || status === 'composing';
}

function _syncActiveMissionPayload() {
    try {
        const state = JSON.parse(localStorage.getItem('ga_active_mission') || 'null');
        if (_syncMissionStateIsDraft(state)) {
            return null;
        }
        return state;
    } catch (_) {
        return null;
    }
}

function _syncHasLocalDraftMission() {
    try {
        return _syncMissionStateIsDraft(JSON.parse(localStorage.getItem('ga_active_mission') || 'null'));
    } catch (_) {
        return false;
    }
}

function _syncApplyActiveMissionFromCloud(activeMission = null) {
    const briefing = document.getElementById("briefingBox");
    if (activeMission && !_syncMissionStateIsDraft(activeMission)) {
        localStorage.setItem('ga_active_mission', JSON.stringify(activeMission));
        restoreMissionState(activeMission);
        return true;
    }
    try {
        const localMission = JSON.parse(localStorage.getItem('ga_active_mission') || 'null');
        if (_syncMissionStateIsDraft(localMission)) return false;
    } catch (_) {}
    localStorage.removeItem('ga_active_mission');
    if (briefing) briefing.style.display = "none";
    return false;
}

function setLastSyncedPayload() {
    const payloadToCompare = {
        pinboard: JSON.parse(localStorage.getItem('ga_pinboard') || '[]'),
        logbook: JSON.parse(localStorage.getItem('ga_logbook') || '[]'),
        activeMission: _syncActiveMissionPayload(),
        groupName: getGroupName(),
        groupNick: getGroupNick(),
        knownNotes: JSON.parse(localStorage.getItem('ga_known_group_notes') || '[]'),
        newBadges: JSON.parse(localStorage.getItem('ga_group_new') || '[]'),
        aircraftPresets: getAircraftPresetsForSync()
    };
    lastSyncedPayloadStr = JSON.stringify(payloadToCompare);
}
async function triggerCloudSave(immediate = false) {
    const id = getSyncId();
    const t = document.getElementById('syncToggle');
    if (!id) return;
    // SOFT-SYNC FIX: Normale Spielaktionen (wie Zettel bewegen) rufen dies ohne Parameter auf.
    // Diese blockieren wir jetzt hart. Ein Upload findet NUR noch beim Schließen (true)
    // oder durch manuelle Buttons ('manual') statt!
    if (!immediate) return;
    if (immediate !== 'manual' && t && !t.checked) return;
    if (immediate === 'manual') {
        if (!confirm("⬆️ CLOUD UPLOAD\nMöchtest du deinen aktuellen, lokalen Stand hochladen und das bisherige Cloud-Backup überschreiben?")) return;
        setNavComLed('navcomSaveBtn', 'syncing');
    }
    if (immediate !== 'manual' && _syncHasLocalDraftMission()) {
        updateSyncStatus("Cloud: Missionsentwurf lokal");
        return;
    }
    localSyncTime = Date.now();
    const payloadToCompare = {
        pinboard: JSON.parse(localStorage.getItem('ga_pinboard') || '[]'),
        logbook: JSON.parse(localStorage.getItem('ga_logbook') || '[]'),
        activeMission: _syncActiveMissionPayload(),
        groupName: getGroupName(),
        groupNick: getGroupNick(),
        knownNotes: JSON.parse(localStorage.getItem('ga_known_group_notes') || '[]'),
        newBadges: JSON.parse(localStorage.getItem('ga_group_new') || '[]'),
        aircraftPresets: getAircraftPresetsForSync()
    };

    const currentPayloadStr = JSON.stringify(payloadToCompare);
    if (currentPayloadStr === lastSyncedPayloadStr && immediate !== 'manual') {
        updateSyncStatus("Cloud: Aktuell ✅");
        return;
    }
    updateSyncStatus("Speichere in Cloud...");
    localStorage.setItem('ga_sync_time', localSyncTime);
    try {
        const id = getSyncId();
        const pin = getSyncPin();
        const upload = _syncBuildUploadPayload(payloadToCompare, localSyncTime, pin);
        const bodyStr = upload.bodyStr;
        if (bodyStr.length > SYNC_MAX_UPLOAD_BYTES) {
            updateSyncStatus(`Cloud: zu groß (${Math.round(bodyStr.length / 1024)} KB)`, true);
            throw new Error(`Payload ${bodyStr.length} bytes`);
        }
        if (upload.compacted && bodyStr.length < currentPayloadStr.length) {
            console.info(`[Sync] Upload kompakt: ${Math.round(currentPayloadStr.length / 1024)} KB -> ${Math.round(bodyStr.length / 1024)} KB`);
        }
        const fetchOptions = {
            method: 'POST',
            headers: { 'X-Pilot-PIN': pin, 'Content-Type': 'application/json' },
            body: bodyStr
        };
        if (immediate !== 'manual' && bodyStr.length < 60000) {
            fetchOptions.keepalive = true;
        }
        const res = await fetch(SYNC_URL + id + "?pin=" + pin, fetchOptions);
        if (res.ok) {
            lastSyncedPayloadStr = currentPayloadStr;
            updateSyncStatus("Cloud: Gespeichert ✅");
            flashSyncIndicator('up');
            if (immediate === 'manual') {
                setNavComLed('navcomSaveBtn', 'success');
                setTimeout(() => setNavComLed('navcomSaveBtn', 'off'), 3000);
            }
        } else if (res.status === 401) {
            updateSyncStatus("Cloud: PIN falsch! ❌", true);
            alert("Zugriff verweigert: PIN falsch!");
        } else {
            throw new Error(`HTTP ${res.status}`);
        }
    } catch (e) {
        console.error("[Sync] Cloud save failed:", e);
        const msg = String(e?.message || '');
        updateSyncStatus(
            msg.startsWith('HTTP ') ? `Cloud: Fehler ${msg}`
                : (msg.startsWith('Payload ') ? "Cloud: Payload zu groß" : "Cloud: Speicher-Fehler"),
            true
        );
        if (immediate === 'manual') {
            setNavComLed('navcomSaveBtn', 'error');
            setTimeout(() => setNavComLed('navcomSaveBtn', 'off'), 3000);
        }
    }
}
async function forceSyncLoad() {
    if (!confirm("⬇️ CLOUD DOWNLOAD\nMöchtest du deinen Spielstand aus der Cloud laden? Alle lokalen Änderungen (die nicht hochgeladen wurden) gehen dabei verloren!")) return;
    const id = getSyncId();
    if (!id) { alert("Bitte zuerst eine Pilot-ID eingeben oder generieren (🎲)."); return; }

    setNavComLed('navcomLoadBtn', 'syncing');
    updateSyncStatus("Lade Daten...");

    try {
        const res = await fetch(SYNC_URL + id + "?pin=" + getSyncPin(), {
            headers: { 'X-Pilot-PIN': getSyncPin() }
        });
        if (res.status === 401) {
            alert("Zugriff verweigert: PIN falsch!");
            updateSyncStatus("PIN falsch", true);
            setNavComLed('navcomLoadBtn', 'error');
            setTimeout(() => setNavComLed('navcomLoadBtn', 'off'), 3000);
            return;
        }
        if (res.status === 404) {
            alert("Zu dieser ID wurden keine Daten gefunden.");
            updateSyncStatus("Nicht gefunden", true);
            setNavComLed('navcomLoadBtn', 'error');
            setTimeout(() => setNavComLed('navcomLoadBtn', 'off'), 3000);
            return;
        }
        if (!res.ok) throw new Error("Netzwerkfehler");
        const data = await res.json();

        if (data.lastModified) {
            localSyncTime = data.lastModified;
            localStorage.setItem('ga_sync_time', localSyncTime);
        }
        if (data.pinboard) localStorage.setItem('ga_pinboard', JSON.stringify(data.pinboard));
        if (data.logbook) localStorage.setItem('ga_logbook', JSON.stringify(data.logbook));
        _syncApplyActiveMissionFromCloud(data.activeMission || null);
        if (data.knownNotes) localStorage.setItem('ga_known_group_notes', JSON.stringify(data.knownNotes));
        if (data.newBadges) localStorage.setItem('ga_group_new', JSON.stringify(data.newBadges));
        if (data.aircraftPresets) applyAircraftPresetsFromSync(data.aircraftPresets);

        if (data.groupName !== undefined) {
            updateGroupUIFromSync(data.groupName, data.groupNick);
        }
        setLastSyncedPayload();
        updateGroupBadgeUI();
        updateSyncStatus("Cloud: Geladen ✅");
        flashSyncIndicator('down');

        setNavComLed('navcomLoadBtn', 'success');
        setTimeout(() => setNavComLed('navcomLoadBtn', 'off'), 3000);
        if (document.getElementById('pinboardOverlay').classList.contains('active')) renderNotes();
        renderLog();
    } catch (e) {
        updateSyncStatus("Cloud: Lade-Fehler", true);
        alert("Fehler beim Laden aus der Cloud.");
        setNavComLed('navcomLoadBtn', 'error');
        setTimeout(() => setNavComLed('navcomLoadBtn', 'off'), 3000);
    }
}
async function silentSyncLoad() {
    const id = getSyncId();
    const t = document.getElementById('syncToggle');
    if (!id || (t && !t.checked)) return;
    try {
        const res = await fetch(SYNC_URL + id + "?pin=" + getSyncPin(), {
            headers: { 'X-Pilot-PIN': getSyncPin() }
        });
        if (res.status === 401) {
            alert("Zugriff verweigert: PIN falsch!");
            updateSyncStatus("PIN falsch", true);
            return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (data.lastModified && data.lastModified > localSyncTime) {
            localSyncTime = data.lastModified;
            localStorage.setItem('ga_sync_time', localSyncTime);
            if (data.pinboard) localStorage.setItem('ga_pinboard', JSON.stringify(data.pinboard));
            if (data.logbook) localStorage.setItem('ga_logbook', JSON.stringify(data.logbook));
            _syncApplyActiveMissionFromCloud(data.activeMission || null);
            if (data.knownNotes) localStorage.setItem('ga_known_group_notes', JSON.stringify(data.knownNotes));
            if (data.newBadges) localStorage.setItem('ga_group_new', JSON.stringify(data.newBadges));
            if (data.aircraftPresets) applyAircraftPresetsFromSync(data.aircraftPresets);

            if (data.groupName !== undefined) {
                updateGroupUIFromSync(data.groupName, data.groupNick);
            }

            setLastSyncedPayload();
            updateGroupBadgeUI();
            if (document.getElementById('pinboardOverlay').classList.contains('active')) renderNotes();
            renderLog();
            updateSyncStatus("Auto-Sync: Aktualisiert 🔄");
            flashSyncIndicator('down');
        }
    } catch (e) {}
}
// === GROUP SYNC LOGIC ===
let groupSyncTime = 0;
let isGroupSyncing = false;
async function silentGroupSync() {
    const gName = getGroupName();
    const gNick = getGroupNick();
    if(!gName || isGroupSyncing) return;

    try {
        const res = await fetch(SYNC_URL + "GROUP_" + gName + "?pin=" + getSyncPin() + "&syncId=" + getSyncId(), {
            headers: { 'X-Pilot-PIN': getSyncPin(), 'X-Pilot-ID': getSyncId() }
        });
        if (res.status === 401) {
            updateSyncStatus("Crew Auth Fehler", true);
            leaveGroup(true);
            return;
        }
        if (!res.ok) return;
        const data = await res.json();

        if (data.lastModified && data.lastModified > groupSyncTime) {
            groupSyncTime = data.lastModified;
            let knownNotes = JSON.parse(localStorage.getItem('ga_known_group_notes')) || [];
            let newBadges = JSON.parse(localStorage.getItem('ga_group_new')) || [];
            let changed = false;
            if (data.kicked && data.kicked.includes(getSyncId())) {
                alert("❌ Du wurdest vom Admin aus der Crew entfernt.");
                leaveGroup(true);
                return;
            }
            const downloadedNotes = data.notes || [];
            const activeNoteIds = downloadedNotes.map(n => n.id);

            // Ghost-Badge Fix: Entferne alte Badges von Zetteln, die gelöscht wurden
            const originalBadgeCount = newBadges.length;
            newBadges = newBadges.filter(id => activeNoteIds.includes(id));
            if (originalBadgeCount !== newBadges.length) changed = true;
            downloadedNotes.forEach(dn => {
                if(!knownNotes.includes(dn.id)) {
                    knownNotes.push(dn.id);
                    if (dn.author !== gNick) {
                        newBadges.push(dn.id);
                    }
                    changed = true;
                }
            });
            if (changed) {
                localStorage.setItem('ga_known_group_notes', JSON.stringify(knownNotes));
                localStorage.setItem('ga_group_new', JSON.stringify(newBadges));
                triggerCloudSave(true); // Ins Profil sichern
            }
            groupDataCache = data;
            updateGroupBadgeUI();
            if (document.getElementById('pinboardOverlay').classList.contains('active') && currentBoardMode === 'group') {
                renderNotes();
            }
        }
    } catch(e) {}
}
async function triggerGroupSave(immediate = false) {
    const gName = getGroupName();
    const gNick = getGroupNick();
    if(!gName) return;
    isGroupSyncing = true;
    try {
        const syncId = getSyncId();
        const pin = getSyncPin();
        const res = await fetch(SYNC_URL + "GROUP_" + gName + "?pin=" + pin + "&syncId=" + syncId, {
            headers: { 'X-Pilot-PIN': pin, 'X-Pilot-ID': syncId }
        });
        let latestData = { members: [], notes: [] };
        if (res.ok) latestData = await res.json();

        let members = latestData.members || [];
        // Veraltete Mitglieder (außer Admin) herausfiltern
        members = members.filter(m => {
            const timeoutMs = m.isAdmin ? (365 * 24 * 60 * 60 * 1000) : (28 * 24 * 60 * 60 * 1000);
            return (Date.now() - m.lastSeen) < timeoutMs && m.syncId !== syncId;
        });

        let amIAdmin = false;
        const existingMe = (latestData.members || []).find(m => m.syncId === syncId);
        if (existingMe && existingMe.isAdmin) amIAdmin = true;
        if (members.length === 0) amIAdmin = true; // Wer die Gruppe belebt, wird Admin
        members.push({ nick: gNick, syncId: syncId, lastSeen: Date.now(), isAdmin: amIAdmin });

        // Max 10 Mitglieder (älteste Nicht-Admins fliegen zuerst)
        if(members.length > 10) {
            members.sort((a,b) => b.lastSeen - a.lastSeen); // Neueste zuerst
            members = members.slice(0, 10);
        }

        // Kicked-Liste behalten
        const kickedList = latestData.kicked || [];

        let cloudNotes = latestData.notes || [];
        let localNotes = groupDataCache.notes || [];

        const myLocalNotes = localNotes.filter(n => n.author === gNick);
        const theirCloudNotes = cloudNotes.filter(n => n.author !== gNick);
        let mergedNotes = [...myLocalNotes, ...theirCloudNotes];

        const payload = { members: members, notes: mergedNotes, kicked: kickedList, lastModified: Date.now(), pin: getSyncPin(), syncId: getSyncId() };

        groupDataCache = payload;
        groupSyncTime = payload.lastModified;
        await fetch(SYNC_URL + "GROUP_" + gName, { 
            method: 'POST', 
            headers: { 'X-Pilot-PIN': getSyncPin(), 'X-Pilot-ID': getSyncId() },
            body: JSON.stringify(payload), 
            keepalive: true 
        });
    } catch(e) {}
    isGroupSyncing = false;
}
async function forceGroupSync() {
    await triggerGroupSave(true);
    await silentGroupSync();
}
// === Auto-Sync Trigger (Adaptive Polling & Idle-Conflict-Check) ===
let syncLastActivityTime = Date.now();
let syncLastFetchTime = Date.now();
let syncIsSleeping = false;
let idleCheckInProgress = false;
async function checkCloudAfterIdle() {
    const id = getSyncId();
    if (!id) return;
    idleCheckInProgress = true;
    updateSyncStatus("Prüfe Cloud...");
    try {
        const res = await fetch(SYNC_URL + id + "?pin=" + getSyncPin(), {
            headers: { 'X-Pilot-PIN': getSyncPin() }
        });
        if (res.status === 401) {
            alert("Zugriff verweigert: PIN falsch!");
            updateSyncStatus("PIN falsch", true);
            return;
        }
        if (!res.ok) throw new Error("Netzwerkfehler");
        const data = await res.json();
        if (data.lastModified && data.lastModified > localSyncTime) {
            // Lokalen Status abgleichen (Habe ich hier ungespeicherte Änderungen?)
            const payloadToCompare = {
                pinboard: JSON.parse(localStorage.getItem('ga_pinboard') || '[]'),
                logbook: JSON.parse(localStorage.getItem('ga_logbook') || '[]'),
                activeMission: _syncActiveMissionPayload(),
                groupName: getGroupName(),
                groupNick: getGroupNick(),
                knownNotes: JSON.parse(localStorage.getItem('ga_known_group_notes') || '[]'),
                newBadges: JSON.parse(localStorage.getItem('ga_group_new') || '[]'),
                aircraftPresets: getAircraftPresetsForSync()
            };
            const currentPayloadStr = JSON.stringify(payloadToCompare);
            const hasLocalUnsavedChanges = (currentPayloadStr !== lastSyncedPayloadStr);
            let msg = "☁️ NEUE CLOUD DATEN VERFÜGBAR\n\nEin anderes Gerät hat in der Zwischenzeit neue Daten gespeichert.\nMöchtest du deinen aktuellen Bildschirm aktualisieren?";
            if (hasLocalUnsavedChanges) {
                msg = "⚠️ CLOUD KONFLIKT\n\nEin anderes Gerät hat in der Zwischenzeit neue Daten gespeichert. Du hast hier aber UNGESPEICHERTE lokale Änderungen!\n\nMöchtest du die Cloud-Daten laden? (Deine lokalen Änderungen hier gehen dann verloren!)";
            }
            if (confirm(msg)) {
                // User will laden -> Daten anwenden
                localSyncTime = data.lastModified;
                localStorage.setItem('ga_sync_time', localSyncTime);
                if (data.pinboard) localStorage.setItem('ga_pinboard', JSON.stringify(data.pinboard));
                if (data.logbook) localStorage.setItem('ga_logbook', JSON.stringify(data.logbook));
                _syncApplyActiveMissionFromCloud(data.activeMission || null);
                if (data.knownNotes) localStorage.setItem('ga_known_group_notes', JSON.stringify(data.knownNotes));
                if (data.newBadges) localStorage.setItem('ga_group_new', JSON.stringify(data.newBadges));
                if (data.aircraftPresets) applyAircraftPresetsFromSync(data.aircraftPresets);
                if (data.groupName !== undefined) {
                    updateGroupUIFromSync(data.groupName, data.groupNick);
                }
                setLastSyncedPayload();
                updateGroupBadgeUI();
                if (document.getElementById('pinboardOverlay').classList.contains('active')) renderNotes();
                renderLog();
                updateSyncStatus("Cloud-Update geladen ✅");
                flashSyncIndicator('down');
            } else {
                // User lehnt ab -> Behalte lokale Daten.
                // Wir setzen die Sync-Zeit künstlich hoch, damit der lokale Stand als der "neueste" gilt und beim Schließen gepusht wird.
                localSyncTime = Date.now();
                localStorage.setItem('ga_sync_time', localSyncTime);
                updateSyncStatus("Lokaler Stand behalten");
            }
        } else {
            updateSyncStatus("Auto-Sync: Aktuell ✅");
        }
    } catch(e) {
        updateSyncStatus("Cloud-Prüfung fehlgeschlagen", true);
    }
    // 10 Sekunden Cooldown, damit man bei vielen Klicks nicht bombardiert wird
    setTimeout(() => { idleCheckInProgress = false; }, 10000);
}
function resetSyncTimer() {
    try {
        const now = Date.now();
        const idleTime = now - syncLastActivityTime;
        if (idleTime > 30000 && !idleCheckInProgress) {
            const t = document.getElementById('syncToggle');
            if (getSyncId() && t && t.checked) {
                checkCloudAfterIdle();
            }
        }
        syncLastActivityTime = now;
        if (syncIsSleeping) {
            syncIsSleeping = false;
            syncLastFetchTime = now;
        }
    } catch(e) {
        console.warn("Sync Timer Error intercepted", e);
    }
}
['click', 'touchstart', 'scroll', 'keydown'].forEach(evt => {
    document.addEventListener(evt, resetSyncTimer, { passive: true, capture: true });
});

// Globale Variablen für das Live-Tracking
let liveGpsSocket = null;
let liveGpsMarker = null;
window.liveTrackerConnected = false;
let lastTrackerDisconnectAt = 0;
let lastTrackerReconnectAt = 0;
let trackerReconnectRecoveryUntil = 0;
let lastAutoFollowPanAt = 0;
let lastAutoFollowPanPos = null;
let lastLivePlaneHeadingUpdateAt = 0;
let gpsWatchdog;
let gpsReconnectDelay = 2000; // Start: 2s, wächst bei wiederholtem Fehlschlag
let liveNextLegIndex = 0;
let liveNextRouteKey = '';
let liveActiveWpIndex = null; // null = automatisch (aus Leg), sonst manuell gewählter Ziel-Wegpunkt
const ROUTE_PROGRESS_TARGET_KEY = 'ga_route_progress_target';
let routeProgressTarget = localStorage.getItem(ROUTE_PROGRESS_TARGET_KEY) === 'end' ? 'end' : 'wpt';
let lastRouteProgressContext = null;
let liveCurrentNavFetchAt = 0;
let liveCurrentNavFetchKey = '';
let liveCurrentNavData = [];
let liveCurrentAirportCacheKey = '';
let liveCurrentAirportCandidates = [];
const liveFreqLookupPending = {};
const MIN_TRACKER_VERSION_CODE = 239;
const MIN_TRACKER_VERSION_LABEL = 'v239';
let trackerVersionPromptShown = false;

function _trackerReconnectRecoveryActive(now = Date.now()) {
    return Number(trackerReconnectRecoveryUntil || 0) > Number(now || Date.now());
}

window.updateLivePlanePerformanceMode = function(forceState = null) {
    const on = (typeof forceState === 'boolean') ? forceState : isLowFpsModeActive();
    const el = liveGpsMarker && typeof liveGpsMarker.getElement === 'function' ? liveGpsMarker.getElement() : null;
    if (el) el.classList.toggle('low-fps-plane', !!on);
};

function _extractTrackerVersionCode(pkt) {
    if (!pkt || typeof pkt !== 'object') return null;
    const codeRaw = pkt.trackerVersionCode;
    if (Number.isFinite(codeRaw)) return Math.round(codeRaw);
    const verRaw = String(pkt.trackerVersion || '').trim().toLowerCase();
    const m = verRaw.match(/(\d{2,})/);
    if (m) {
        const parsed = parseInt(m[1], 10);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

function _maybePromptTrackerUpdate(pkt) {
    const code = _extractTrackerVersionCode(pkt);
    const reportedLabel = String(pkt?.trackerVersion || '').trim() || (Number.isFinite(code) ? `v${code}` : 'keine Versionsnummer');
    const outdated = !Number.isFinite(code) || code < MIN_TRACKER_VERSION_CODE;
    if (!outdated || trackerVersionPromptShown) return;
    trackerVersionPromptShown = true;
    updateSyncStatus(`Tracker veraltet (${reportedLabel}) – Update auf ${MIN_TRACKER_VERSION_LABEL} empfohlen.`, true);
    alert(
        `Neue Tracker-Version verfügbar.\n\n` +
        `Erkannt: ${reportedLabel}\n` +
        `Empfohlen: mindestens ${MIN_TRACKER_VERSION_LABEL}\n\n` +
        `Bitte den Tracker aktualisieren.`
    );
}

function clampLiveLegIndex(idx) {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return 0;
    const maxLeg = routeWaypoints.length - 2;
    return Math.max(0, Math.min(Number(idx) || 0, maxLeg));
}

function clampLiveWpIndex(idx) {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 1) return 0;
    const maxWp = routeWaypoints.length - 1;
    return Math.max(0, Math.min(Number(idx) || 0, maxWp));
}

function setNextLegButtonStates(activeWp, maxWp) {
    const prevBtn = document.getElementById('nextLegPrevBtn');
    const nextBtn = document.getElementById('nextLegNextBtn');
    if (prevBtn) prevBtn.disabled = activeWp <= 0;
    if (nextBtn) nextBtn.disabled = activeWp >= maxWp;
}

window.stepLiveNextLegPreview = function(delta, ev) {
    if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
    if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return;

    const autoWpIdx = clampLiveWpIndex(liveNextLegIndex + 1);
    const currentWpIdx = (liveActiveWpIndex == null) ? autoWpIdx : liveActiveWpIndex;
    liveActiveWpIndex = clampLiveWpIndex(currentWpIdx + (delta < 0 ? -1 : 1));

    const pos = window.lastLiveGpsPos;
    if (pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lon)) {
        const nextInfo = updateNextWpTelemetry(pos.lat, pos.lon);
        updateRouteProgressBar(pos.lat, pos.lon, pos.gs, nextInfo);
    }
};

function hideNextWpTelemetry() {
    const box = document.getElementById('liveNextWpBox');
    if (box) box.style.display = 'none';
    hideCurrentInfoTelemetry();
    setNextLegButtonStates(0, 0);
    if (liveToWpLine) {
        try { liveToWpLine.remove(); } catch (e) {}
        liveToWpLine = null;
    }
    liveActiveWpIndex = null;
    hideCompassRose();
}

function hideRouteProgressBar() {
    const bar = document.getElementById('routeProgressBar');
    if (bar) bar.style.display = 'none';
    setRouteProgressLayoutVisible(false);
}

function routeProgressTargetLabel() {
    return routeProgressTarget === 'end' ? 'END' : 'WPT';
}

function updateRouteProgressTargetLabels() {
    document.querySelectorAll('#routeProgressBar .route-progress-target').forEach(el => {
        el.textContent = routeProgressTargetLabel();
    });
}

function setRouteProgressLayoutVisible(visible) {
    const on = !!visible;
    document.body.classList.toggle('route-progress-visible', on);
    if (typeof map !== 'undefined' && map && typeof map.invalidateSize === 'function') {
        requestAnimationFrame(() => {
            try { map.invalidateSize({ pan: false }); } catch (_) { map.invalidateSize(); }
        });
    }
}

function getLiveRouteTargetIndex(fallbackInfo = null) {
    if (fallbackInfo && Number.isFinite(Number(fallbackInfo.wpIdx))) {
        return clampLiveWpIndex(fallbackInfo.wpIdx);
    }
    const autoWpIdx = clampLiveWpIndex(liveNextLegIndex + 1);
    return (liveActiveWpIndex == null) ? autoWpIdx : clampLiveWpIndex(liveActiveWpIndex);
}

function routeProgressLegDistanceNm(a, b) {
    const aLon = a?.lng ?? a?.lon;
    const bLon = b?.lng ?? b?.lon;
    if (!a || !b || !Number.isFinite(a.lat) || !Number.isFinite(aLon) || !Number.isFinite(b.lat) || !Number.isFinite(bLon)) return 0;
    const nav = calcNav(a.lat, aLon, b.lat, bLon);
    return Number.isFinite(nav?.dist) ? nav.dist : 0;
}

function routeProgressShortIdent(value) {
    const ident = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return /^[A-Z0-9]{2,4}$/.test(ident) ? ident : '';
}

function findRouteProgressPositionReference(lat, lon) {
    if (typeof calcNav !== 'function' || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const candidates = [];
    const seen = new Set();
    const mapNavItems = (typeof cachedNavData !== 'undefined' && Array.isArray(cachedNavData)) ? cachedNavData : [];
    const navItems = [...mapNavItems, ...liveCurrentNavData];

    navItems.forEach(nav => {
        const parsed = parseCurrentNavLabel(nav);
        if (!parsed || (parsed.kind !== 'APT' && parsed.kind !== 'VOR')) return;
        const ident = routeProgressShortIdent(parsed.label);
        if (!ident) return;
        addCurrentNavCandidate(candidates, seen, ident, nav.lat, nav.lng ?? nav.lon, parsed.kind);
    });

    getCurrentNearbyAirportCandidates(lat, lon).forEach(apt => {
        const ident = routeProgressShortIdent(apt.label);
        if (ident) addCurrentNavCandidate(candidates, seen, ident, apt.lat, apt.lon, 'APT');
    });

    let best = null;
    for (const c of candidates) {
        const nav = calcNav(c.lat, c.lon, lat, lon);
        if (!Number.isFinite(nav?.dist)) continue;
        if (!best || nav.dist < best.dist) best = { ...c, dist: nav.dist, brngFromRef: nav.brng };
    }

    if (!navItems.length || !best || best.dist > 35) maybeRefreshCurrentNavData(lat, lon);
    return best && best.dist <= 35 ? best : null;
}

function formatRouteProgressPosition(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '--';
    const ref = findRouteProgressPositionReference(lat, lon);
    const ident = routeProgressShortIdent(ref?.label);
    if (!ref || !ident) return '--';
    const dir = currentInfoCardinalFromBearing(ref.brngFromRef);
    return `${currentInfoNm(ref.dist)} NM ${dir} ${ident}`.replace(/\s+/g, ' ').trim();
}

function formatRouteProgressFrequency(lat, lon, alt = null) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '--';
    const freq = getCurrentFrequencyInfo(lat, lon, alt);
    return freq?.value ? String(freq.value).toUpperCase() : '--';
}

function getRouteProgressDistanceNm(lat, lon, wpIdx, fallbackInfo = null) {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2 || typeof calcNav !== 'function') return null;
    const safeWpIdx = clampLiveWpIndex(wpIdx);
    const wp = routeWaypoints[safeWpIdx];
    const wpLon = wp?.lng ?? wp?.lon;
    if (!wp || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(wp.lat) || !Number.isFinite(wpLon)) return null;

    const directToWp = (fallbackInfo && Number(fallbackInfo.wpIdx) === safeWpIdx && Number.isFinite(Number(fallbackInfo.distToWpNm)))
        ? Number(fallbackInfo.distToWpNm)
        : calcNav(lat, lon, wp.lat, wpLon).dist;

    if (!Number.isFinite(directToWp)) return null;
    if (routeProgressTarget !== 'end') return Math.max(0, directToWp);

    let remaining = Math.max(0, directToWp);
    for (let i = safeWpIdx; i < routeWaypoints.length - 1; i++) {
        remaining += routeProgressLegDistanceNm(routeWaypoints[i], routeWaypoints[i + 1]);
    }
    return remaining;
}

function formatRouteProgressDistance(distNm) {
    const n = Number(distNm);
    if (!Number.isFinite(n)) return '--.- NM';
    if (n >= 100) return `${Math.round(n)} NM`;
    return `${n.toFixed(1)} NM`;
}

function formatRouteProgressDuration(minutes) {
    const n = Number(minutes);
    if (!Number.isFinite(n)) return '--';
    const mins = Math.max(0, Math.round(n));
    if (mins < 1) return '<1 MIN';
    if (mins < 60) return `${mins} MIN`;
    const h = Math.floor(mins / 60);
    const m = String(mins % 60).padStart(2, '0');
    return `${h}:${m} H`;
}

function formatRouteProgressEta(minutes) {
    const n = Number(minutes);
    if (!Number.isFinite(n)) return '--:--';
    const eta = new Date(Date.now() + Math.max(0, n) * 60000);
    return `${String(eta.getHours()).padStart(2, '0')}:${String(eta.getMinutes()).padStart(2, '0')}`;
}

function getRouteProgressMinutes(distNm, gsKts) {
    const gs = Number(gsKts);
    const dist = Number(distNm);
    if (!Number.isFinite(gs) || gs < 5 || !Number.isFinite(dist)) return null;
    return (dist / gs) * 60;
}

window.toggleRouteProgressTarget = function() {
    routeProgressTarget = routeProgressTarget === 'wpt' ? 'end' : 'wpt';
    localStorage.setItem(ROUTE_PROGRESS_TARGET_KEY, routeProgressTarget);
    window.refreshRouteProgressBar();
};

window.refreshRouteProgressBar = function() {
    if (!lastRouteProgressContext) {
        const pos = window.lastLiveGpsPos;
        if (!pos || !Number.isFinite(pos.lat) || !Number.isFinite(pos.lon)) {
            updateRouteProgressTargetLabels();
            updateRouteProgressBar(null, null, null, null);
            return;
        }
        updateRouteProgressBar(pos.lat, pos.lon, pos.gs, null);
        return;
    }
    updateRouteProgressBar(
        lastRouteProgressContext.lat,
        lastRouteProgressContext.lon,
        lastRouteProgressContext.gs,
        lastRouteProgressContext.nextInfo
    );
};

function updateRouteProgressBar(lat, lon, gsKts = null, nextInfo = null) {
    const bar = document.getElementById('routeProgressBar');
    if (!bar) return;

    updateRouteProgressTargetLabels();
    const hintOn = isMapHintOn('routeProgress', true);
    bar.classList.toggle('route-progress-hidden', !hintOn);
    setRouteProgressLayoutVisible(hintOn);
    if (!hintOn) {
        bar.style.display = 'none';
        return;
    }

    const hasPosition = Number.isFinite(lat) && Number.isFinite(lon);
    if (hasPosition) lastRouteProgressContext = { lat, lon, gs: gsKts, nextInfo };
    const posEl = document.getElementById('routeProgressPos');
    if (posEl) posEl.textContent = formatRouteProgressPosition(lat, lon);
    const freqEl = document.getElementById('routeProgressFreq');
    if (freqEl) freqEl.textContent = formatRouteProgressFrequency(lat, lon, window.lastLiveGpsPos?.alt);

    const wpIdx = getLiveRouteTargetIndex(nextInfo);
    const distNm = getRouteProgressDistanceNm(lat, lon, wpIdx, nextInfo);

    const gs = Number.isFinite(Number(gsKts)) ? Number(gsKts) : Number(window.lastLiveGpsPos?.gs ?? smoothedGS);
    const minutes = getRouteProgressMinutes(distNm, gs);
    const distEl = document.getElementById('routeProgressDst');
    const etaEl = document.getElementById('routeProgressEta');
    const durEl = document.getElementById('routeProgressDur');
    if (distEl) distEl.textContent = formatRouteProgressDistance(distNm);
    if (etaEl) etaEl.textContent = formatRouteProgressEta(minutes);
    if (durEl) durEl.textContent = formatRouteProgressDuration(minutes);
    bar.style.display = 'grid';
}

// ── Compass Rose ──────────────────────────────────────────────────────────────
let _compassRot = 0;

function buildCompassSvg() {
    const svg = document.getElementById('compassSvg');
    if (!svg || svg.childElementCount > 0) return;
    const CX = 150, CY = 150, NS = 'http://www.w3.org/2000/svg';

    function e(tag, attrs, text) {
        const el = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
        if (text != null) el.textContent = text;
        return el;
    }

    // ── Background ───────────────────────────────────────────────────────────
    svg.appendChild(e('circle', { cx: CX, cy: CY, r: 149,
        fill: 'rgba(2,5,10,0.97)', stroke: 'rgba(255,255,255,0.7)', 'stroke-width': 1.5 }));
    // Thin inner rings (HSI reference circles)
    svg.appendChild(e('circle', { cx: CX, cy: CY, r: 108,
        fill: 'none', stroke: 'rgba(255,255,255,0.12)', 'stroke-width': 0.8 }));
    svg.appendChild(e('circle', { cx: CX, cy: CY, r: 62,
        fill: 'none', stroke: 'rgba(255,255,255,0.08)', 'stroke-width': 0.8 }));

    // ── Tick marks + labels ───────────────────────────────────────────────────
    // Label graduation: every 30° (N/E/S/W + heading÷10 without zero-pad)
    const CARDS  = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
    const OR = 143; // outer ring radius

    for (let deg = 0; deg < 360; deg += 5) {
        const r = (deg - 90) * Math.PI / 180;
        const isCard = deg % 90 === 0;
        const is30   = !isCard && deg % 30 === 0;
        const is10   = !isCard && !is30 && deg % 10 === 0;

        // Tick sizes: cardinal 18 px, 30° 12 px, 10° 7 px, 5° 4 px
        const tLen    = isCard ? 18 : is30 ? 12 : is10 ? 7 : 4;
        const tStroke = isCard ? 2.2 : is30 ? 1.6 : is10 ? 1.0 : 0.7;
        const tColor  = '#ffffff';   // all ticks pure white like the reference

        svg.appendChild(e('line', {
            x1: (CX + OR * Math.cos(r)).toFixed(1),          y1: (CY + OR * Math.sin(r)).toFixed(1),
            x2: (CX + (OR - tLen) * Math.cos(r)).toFixed(1), y2: (CY + (OR - tLen) * Math.sin(r)).toFixed(1),
            stroke: tColor, 'stroke-width': tStroke,
            opacity: isCard ? 1 : is30 ? 0.9 : is10 ? 0.65 : 0.35
        }));

        // Labels only at every 30° (matches reference image graduation)
        if (deg % 30 === 0) {
            const lr = OR - tLen - (isCard ? 14 : 11);
            const lx = CX + lr * Math.cos(r), ly = CY + lr * Math.sin(r);
            // heading÷10 without leading zero for non-cardinals (3, 6, 12, 15 …)
            const label = CARDS[deg] ?? String(deg / 10);
            svg.appendChild(e('text', {
                x: lx.toFixed(1), y: ly.toFixed(1),
                'text-anchor': 'middle', 'dominant-baseline': 'middle',
                transform: `rotate(${deg},${lx.toFixed(1)},${ly.toFixed(1)})`,
                fill: deg === 0 ? '#ff4d4d' : '#ffffff',
                'font-size': isCard ? 21 : 14,
                'font-family': "'MS33558', 'Arial Narrow', Arial, sans-serif",
                'font-weight': isCard ? 'bold' : '600',
                'letter-spacing': isCard ? '0.5' : '0'
            }, label));
        }
    }

    // ── HDG bug (bearing to next WP, on outer ring at 12 o'clock before rotation) ──
    const bugG = e('g', { id: 'compassBugGroup', transform: `rotate(0,${CX},${CY})` });
    bugG.style.display = 'none';
    // Orange upward-pointing hollow triangle (apex toward disc centre)
    bugG.appendChild(e('polygon', { points: `${CX-10},30 ${CX+10},30 ${CX},8`,
        fill: 'none', stroke: '#f07800', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));
    svg.appendChild(bugG);

    // ── Aircraft symbol (fixed centre reference) ──────────────────────────────
    const ac = e('g', { 'pointer-events': 'none' });
    ac.appendChild(e('line',    { x1: CX, y1: CY - 18, x2: CX, y2: CY + 14, stroke: '#f0a800', 'stroke-width': 2.2 }));
    ac.appendChild(e('line',    { x1: CX - 18, y1: CY + 2, x2: CX + 18, y2: CY + 2, stroke: '#f0a800', 'stroke-width': 2.2 }));
    ac.appendChild(e('line',    { x1: CX - 7, y1: CY + 12, x2: CX + 7, y2: CY + 12, stroke: '#f0a800', 'stroke-width': 2 }));
    svg.appendChild(ac);

    // Centre dot
    svg.appendChild(e('circle', { cx: CX, cy: CY, r: 2.8, fill: 'rgba(180,205,230,0.55)' }));
}

// Update HDG bug + fixed CDI bar
// bearingToWp: bearing° to next WP (disc angle for bug)
// courseDeg:   planned track bearing° (unused – CDI is fixed horizontal)
// xteNm:       cross-track error in NM, positive = right of track
window.updateCompassInstruments = function(bearingToWp, courseDeg, xteNm) {
    const bugG = document.getElementById('compassBugGroup');
    if (bugG) {
        bugG.setAttribute('transform', `rotate(${bearingToWp},150,150)`);
        bugG.style.display = '';
    }

    const cdiBar = document.getElementById('compassCdiBarFixed');
    if (cdiBar) {
        const MAX_PX = 44, FULL_NM = 2.0;
        // positive xte (right of track) → CDI deflects left (negative x)
        const offset = Math.max(-MAX_PX, Math.min(MAX_PX, -(xteNm / FULL_NM) * MAX_PX));
        cdiBar.setAttribute('x1', offset.toFixed(1));
        cdiBar.setAttribute('x2', offset.toFixed(1));
        const cdiSvg = document.getElementById('compassCdiSvg');
        if (cdiSvg) cdiSvg.style.display = '';
    }
};

function buildCompassFixed() {
    const svg = document.getElementById('compassCdiSvg');
    if (!svg || svg.childElementCount > 0) return;
    const NS = 'http://www.w3.org/2000/svg';
    function e(tag, attrs) {
        const el = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
        return el;
    }
    // Background pill
    svg.appendChild(e('rect', { x: -52, y: -12, width: 104, height: 24, rx: 5,
        fill: 'rgba(2,5,10,0.82)', stroke: 'rgba(255,255,255,0.18)', 'stroke-width': 1 }));
    // Centre track line (thin, white)
    svg.appendChild(e('line', { x1: 0, y1: -8, x2: 0, y2: 8,
        stroke: 'rgba(255,255,255,0.35)', 'stroke-width': 1.2, 'stroke-dasharray': '3 2' }));
    // Scale dots at ±22 and ±44 px
    for (const dx of [-44, -22, 22, 44]) {
        svg.appendChild(e('circle', { cx: dx, cy: 0, r: 2.5,
            fill: 'none', stroke: 'rgba(255,255,255,0.45)', 'stroke-width': 1.5 }));
    }
    // CDI bar (vertical, moves horizontally)
    svg.appendChild(e('line', { id: 'compassCdiBarFixed', x1: 0, y1: -10, x2: 0, y2: 10,
        stroke: '#ccd8ea', 'stroke-width': 3.5, 'stroke-linecap': 'round' }));
    // Heading readout below CDI strip — DSEG7 7-segment LED font
    svg.appendChild(e('text', { id: 'compassHdgReadout', x: 0, y: 25,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        fill: '#f5e97a', 'font-size': 15, 'font-family': "'DSEG7', 'Courier New', monospace",
        'font-weight': 'bold', 'letter-spacing': '2' }, '---°'));
    svg.style.display = 'none';
}

function updateCompassBottom() {
    // mapArea shrinks/grows with profile via flex — bottom:0 tracks the map edge automatically
}

window.updateCompassHeading = function(hdg) {
    if (hdg == null || isNaN(hdg)) return;
    const wrap = document.getElementById('compassRoseWrap');
    const disc = document.getElementById('compassDisc');
    if (!wrap || !disc) return;

    const target = -hdg;
    const delta = ((target - _compassRot) % 360 + 540) % 360 - 180;
    _compassRot += delta;
    disc.style.transform = `rotate(${_compassRot}deg)`;

    const hdgText = document.getElementById('compassHdgReadout');
    if (hdgText) hdgText.textContent = String(Math.round(hdg) % 360).padStart(3, '0') + '°';

    if (isMapHintOn('compass', true) && wrap.style.display !== 'block') {
        wrap.style.display = 'block';
        updateCompassBottom();
    }
};

window.hideCompassRose = function() {
    const wrap = document.getElementById('compassRoseWrap');
    if (wrap) wrap.style.display = 'none';
    const bugG = document.getElementById('compassBugGroup');
    if (bugG) bugG.style.display = 'none';
    const cdiSvg = document.getElementById('compassCdiSvg');
    if (cdiSvg) cdiSvg.style.display = 'none';
};

function routeKeyForLiveNav() {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return '';
    return routeWaypoints.map((wp, i) => `${i}:${(wp.lat || 0).toFixed(4)},${((wp.lng || wp.lon) || 0).toFixed(4)}`).join('|');
}

function legDistanceToSegmentNm(lat, lon, a, b) {
    const refLat = (a.lat + b.lat + lat) / 3;
    const cosRef = Math.cos(refLat * Math.PI / 180);

    const ax = (a.lng || a.lon) * cosRef * 60;
    const ay = a.lat * 60;
    const bx = (b.lng || b.lon) * cosRef * 60;
    const by = b.lat * 60;
    const px = lon * cosRef * 60;
    const py = lat * 60;

    const abx = bx - ax, aby = by - ay;
    const apx = px - ax, apy = py - ay;
    const denom = abx * abx + aby * aby;
    const t = denom > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / denom)) : 0;
    const cx = ax + t * abx, cy = ay + t * aby;
    return Math.hypot(px - cx, py - cy);
}

function nearestLegIndexBySegment(lat, lon) {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return 0;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < routeWaypoints.length - 1; i++) {
        const d = legDistanceToSegmentNm(lat, lon, routeWaypoints[i], routeWaypoints[i + 1]);
        if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
        }
    }
    return bestIdx;
}

function getWpDisplayName(idx) {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || !routeWaypoints[idx]) return `WP ${idx}`;
    const isLast = idx === routeWaypoints.length - 1;
    if (idx === 0 && typeof currentStartICAO !== 'undefined' && currentStartICAO) return currentStartICAO;
    if (isLast) {
        if (typeof currentDestICAO !== 'undefined' && currentDestICAO) return currentDestICAO;
        if (typeof currentDName !== 'undefined' && currentDName) return currentDName;
    }
    return routeWaypoints[idx].name || `WP ${idx}`;
}

function getExplicitFrequencyFromText(txt) {
    if (!txt) return '';
    const m = String(txt).match(/\((\d{3}\.\d{2,3}|\d{3}\.\d{1}|\d{3})\)/);
    return m ? m[1] : '';
}

function getPrimaryAirportFrequency(icao, typeHint = null) {
    if (!icao || typeof freqCache === 'undefined') return '';
    const cached = freqCache[icao];
    if (Array.isArray(cached) && cached.length > 0) {
        const pref = cached.find(f => /turm|tower|info|radio|ctaf|unicom/i.test(String(f.label || '')));
        const best = pref || cached[0];
        return best?.value || '';
    }

    if (typeof fetchAirportFreq === 'function' && !liveFreqLookupPending[icao]) {
        liveFreqLookupPending[icao] = true;
        Promise.resolve(fetchAirportFreq(icao, null, typeHint)).finally(() => {
            liveFreqLookupPending[icao] = false;
        });
    }
    return '';
}

function getRegionalFisFrequency(lat, lon) {
    if (typeof activeAirspaces === 'undefined' || !Array.isArray(activeAirspaces) || activeAirspaces.length === 0) return '';
    const withFreq = activeAirspaces.filter(as => as?.type === 33 && Array.isArray(as.frequencies) && as.frequencies.length > 0);
    if (withFreq.length === 0) return '';

    // 1) Erst: Punkt-in-Polygon, falls Geometrie verfügbar
    if (typeof vpPointInPoly === 'function') {
        for (const as of withFreq) {
            if (!as.geometry) continue;
            const polys = [];
            if (as.geometry.type === 'Polygon') polys.push(as.geometry.coordinates[0]);
            else if (as.geometry.type === 'MultiPolygon') as.geometry.coordinates.forEach(mc => polys.push(mc[0]));
            for (const poly of polys) {
                if (vpPointInPoly({ lat, lon }, poly)) {
                    const primary = as.frequencies.find(f => f.primary) || as.frequencies[0];
                    if (primary?.value) return `${primary.value}`;
                }
            }
        }
    }

    // 2) Fallback: nächstgelegene FIS-Zone über groben Schwerpunkt
    let best = null;
    let bestNm = Infinity;
    for (const as of withFreq) {
        if (!as.geometry) continue;
        let ring = null;
        if (as.geometry.type === 'Polygon') ring = as.geometry.coordinates[0];
        else if (as.geometry.type === 'MultiPolygon' && as.geometry.coordinates[0]) ring = as.geometry.coordinates[0][0];
        if (!ring || ring.length < 3) continue;
        let sumLat = 0, sumLon = 0;
        ring.forEach(c => { sumLon += c[0]; sumLat += c[1]; });
        const cLat = sumLat / ring.length;
        const cLon = sumLon / ring.length;
        if (typeof calcNav !== 'function') continue;
        const d = calcNav(lat, lon, cLat, cLon).dist;
        if (d < bestNm) {
            bestNm = d;
            best = as;
        }
    }
    if (best) {
        const primary = best.frequencies.find(f => f.primary) || best.frequencies[0];
        if (primary?.value) return `${primary.value}`;
    }
    return '';
}

function stripNavFrequencyFromName(s) {
    return String(s || '').replace(/\s*\(\d{3}(?:[.,]\d{1,3})?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

function currentInfoCardinalFromBearing(brng) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const n = Number(brng);
    if (!Number.isFinite(n)) return '';
    return dirs[Math.round((((n % 360) + 360) % 360) / 45) % dirs.length];
}

function currentInfoNm(dist) {
    const n = Number(dist);
    if (!Number.isFinite(n)) return '--';
    if (n < 1) return n.toFixed(1);
    return String(Math.round(n));
}

function addCurrentNavCandidate(list, seen, label, lat, lon, kind = 'NAV') {
    const la = Number(lat), lo = Number(lon);
    const cleanLabel = stripNavFrequencyFromName(label).replace(/^APT\s+/i, '').replace(/^RPP\s+/i, '').trim();
    if (!cleanLabel || !Number.isFinite(la) || !Number.isFinite(lo)) return;
    const key = `${kind}:${cleanLabel.toUpperCase()}:${la.toFixed(4)}:${lo.toFixed(4)}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ label: cleanLabel, lat: la, lon: lo, kind });
}

function parseCurrentNavLabel(nav) {
    const raw = String(nav?.name || '').trim();
    if (!raw) return null;
    if (/^APT\s+/i.test(raw)) {
        const label = stripNavFrequencyFromName(raw.replace(/^APT\s+/i, ''));
        return { label, kind: 'APT' };
    }
    if (/^RPP\s+/i.test(raw) || nav?.type === 'RPP') {
        const label = stripNavFrequencyFromName(raw.replace(/^RPP\s+/i, ''));
        return { label, kind: 'RPP' };
    }
    const ident = raw.match(/\[([^\]]+)\]/);
    if (ident) return { label: ident[1].trim().split(/\s+/)[0], kind: 'VOR' };
    return { label: stripNavFrequencyFromName(raw), kind: 'NAV' };
}

function currentInfoReadFreq(item) {
    if (!item) return '';
    if (item.frequency !== undefined && item.frequency !== null) {
        return (typeof item.frequency === 'object' && item.frequency.value) ? item.frequency.value : item.frequency;
    }
    if (Array.isArray(item.frequencies) && item.frequencies.length > 0) {
        return item.frequencies[0]?.value || item.frequencies[0] || '';
    }
    return '';
}

function currentInfoCoords(item) {
    const c = item?.geometry?.coordinates;
    return Array.isArray(c) && c.length >= 2 ? { lat: Number(c[1]), lng: Number(c[0]) } : null;
}

function maybeRefreshCurrentNavData(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || typeof fetch !== 'function') return;
    const now = Date.now();
    const key = `${lat.toFixed(1)}_${lon.toFixed(1)}`;
    if (key === liveCurrentNavFetchKey && now - liveCurrentNavFetchAt < 45000) return;
    liveCurrentNavFetchAt = now;
    liveCurrentNavFetchKey = key;

    const w = Math.max(-180, lon - 0.65);
    const s = Math.max(-90, lat - 0.45);
    const e = Math.min(180, lon + 0.65);
    const n = Math.min(90, lat + 0.45);
    const bbox = `${w},${s},${e},${n}`;
    const proxy = 'https://ga-proxy.einherjer.workers.dev';

    Promise.all([
        fetch(`${proxy}/api/navaids?bbox=${bbox}&limit=250&t=${Date.now()}`),
        fetch(`${proxy}/api/reporting-points?bbox=${bbox}&limit=250&t=${Date.now()}`),
        fetch(`${proxy}/api/airports?bbox=${bbox}&limit=250&t=${Date.now()}`)
    ]).then(async ([navRes, repRes, aptRes]) => {
        if (!navRes.ok || !repRes.ok || !aptRes.ok) return;
        const [navJson, repJson, aptJson] = await Promise.all([navRes.json(), repRes.json(), aptRes.json()]);
        const next = [];

        (navJson.items || []).forEach(i => {
            const c = currentInfoCoords(i);
            if (!c) return;
            const freqVal = currentInfoReadFreq(i);
            const freq = freqVal ? ` (${freqVal})` : '';
            const idVal = i.identifier || i.designator || '';
            const ident = idVal ? ` [${idVal}]` : '';
            next.push({ name: `${i.name || 'NAV'}${ident}${freq}`, lat: c.lat, lng: c.lng });
        });

        (repJson.items || []).forEach(i => {
            const c = currentInfoCoords(i);
            if (!c) return;
            next.push({
                name: `RPP ${i.name || ''}`.trim(),
                lat: c.lat,
                lng: c.lng,
                type: 'RPP',
                rppAirportIcao: (typeof extractRppAirportIcao === 'function') ? extractRppAirportIcao(i) : ''
            });
        });

        (aptJson.items || []).forEach(i => {
            const c = currentInfoCoords(i);
            if (!c) return;
            const freqVal = currentInfoReadFreq(i);
            const freq = freqVal ? ` (${freqVal})` : '';
            const displayName = i.icaoCode || i.name || 'APT';
            next.push({ name: `APT ${displayName}${freq}`, lat: c.lat, lng: c.lng });
        });

        liveCurrentNavData = next;
    }).catch(() => {});
}

function getCurrentNearbyAirportCandidates(lat, lon) {
    if (typeof globalAirports !== 'object' || !globalAirports) return [];
    const key = `${lat.toFixed(1)}_${lon.toFixed(1)}`;
    if (key === liveCurrentAirportCacheKey) return liveCurrentAirportCandidates;

    liveCurrentAirportCacheKey = key;
    liveCurrentAirportCandidates = [];
    for (const aptKey in globalAirports) {
        const apt = globalAirports[aptKey];
        const aLat = Number(apt?.lat), aLon = Number(apt?.lon);
        if (!Number.isFinite(aLat) || !Number.isFinite(aLon)) continue;
        if (Math.abs(aLat - lat) > 0.8 || Math.abs(aLon - lon) > 1.2) continue;
        const icao = String(apt?.icao || aptKey || '').trim().toUpperCase();
        liveCurrentAirportCandidates.push({ label: icao || apt?.name || 'APT', lat: aLat, lon: aLon });
    }
    return liveCurrentAirportCandidates;
}

function findNearestCurrentReference(lat, lon) {
    if (typeof calcNav !== 'function') return null;
    const candidates = [];
    const seen = new Set();
    const mapNavItems = (typeof cachedNavData !== 'undefined' && Array.isArray(cachedNavData)) ? cachedNavData : [];
    const navItems = [...mapNavItems, ...liveCurrentNavData];

    navItems.forEach(nav => {
        const parsed = parseCurrentNavLabel(nav);
        if (!parsed) return;
        addCurrentNavCandidate(candidates, seen, parsed.label, nav.lat, nav.lng ?? nav.lon, parsed.kind);
    });

    getCurrentNearbyAirportCandidates(lat, lon).forEach(apt => {
        addCurrentNavCandidate(candidates, seen, apt.label, apt.lat, apt.lon, 'APT');
    });

    let best = null;
    for (const c of candidates) {
        const nav = calcNav(c.lat, c.lon, lat, lon);
        if (!Number.isFinite(nav?.dist)) continue;
        if (!best || nav.dist < best.dist) best = { ...c, dist: nav.dist, brngFromRef: nav.brng };
    }

    if (!navItems.length || !best || best.dist > 35) maybeRefreshCurrentNavData(lat, lon);
    return best;
}

function currentAirspacePriority(as) {
    const t = as?.type;
    if (t === 4) return 0;                 // CTR
    if (as?.icaoClass === 2 || as?.icaoClass === 3 || t === 0) return 1;
    if (t === 5 || t === 27) return 2;     // TMZ
    if (t === 6 || t === 28) return 3;     // RMZ
    if (t === 7 || t === 26) return 4;     // TMA/CTA
    return 8;
}

function compactCurrentFrequencyLabel(rawName) {
    const raw = String(rawName || '').trim();
    const up = raw.toUpperCase();
    if (/XPDR|SQK|SQUAWK|TRANSP/.test(up)) return 'SQWK';
    if (/\b(TWR|TOWER|TURM)\b/.test(up)) return 'TWR';
    if (/\b(APP|APPROACH|ANFLUG)\b/.test(up)) return 'APP';
    if (/\b(ATIS)\b/.test(up)) return 'ATIS';
    if (/\b(RADIO|CTAF|UNICOM)\b/.test(up)) return 'RADIO';
    if (/\b(FIS|INFO|INFORMATION)\b/.test(up)) return 'INFO';
    return raw || 'INFO';
}

function pickCurrentAirspaceFrequency(lat, lon, alt) {
    if (typeof activeAirspaces === 'undefined' || !Array.isArray(activeAirspaces)) return null;
    if (typeof isPointInsideAirspace !== 'function') return null;

    const terrainFt = Number(window.lastLiveTerrainFt) || 0;
    const hasAlt = Number.isFinite(Number(alt));
    const hits = [];

    for (const as of activeAirspaces) {
        if (!as?.geometry || as.type === 33) continue;
        if (!Array.isArray(as.frequencies) || as.frequencies.length === 0) continue;
        if (!isPointInsideAirspace(as, lat, lon)) continue;

        if (hasAlt && typeof getAirspaceVerticalBandFt === 'function') {
            const band = getAirspaceVerticalBandFt(as, terrainFt);
            if (!band) continue;
            if (alt < band.lowerFt - 200 || alt > band.upperFt + 200) continue;
        }

        const primary = (typeof pickPreferredAirspaceFrequency === 'function')
            ? pickPreferredAirspaceFrequency(as.frequencies, as.type)
            : (as.frequencies.find(f => f.primary) || as.frequencies[0]);
        if (!primary?.value) continue;
        hits.push({ as, primary, priority: currentAirspacePriority(as) });
    }

    if (!hits.length) return null;
    hits.sort((a, b) => a.priority - b.priority);
    const hit = hits[0];
    const label = compactCurrentFrequencyLabel(hit.primary.name);
    const source = (typeof getAirspaceDisplayName === 'function') ? getAirspaceDisplayName(hit.as) : (hit.as.name || 'Luftraum');
    return {
        value: `${label}: ${hit.primary.value}`,
        source,
        color: (typeof getAirspaceStyle === 'function') ? getAirspaceStyle(hit.as).color : '#9fd3ff'
    };
}

function getCurrentFrequencyInfo(lat, lon, alt) {
    const airspaceFreq = pickCurrentAirspaceFrequency(lat, lon, alt);
    if (airspaceFreq) return airspaceFreq;
    const fis = getRegionalFisFrequency(lat, lon);
    return fis ? { value: `FIS ${fis}`, source: 'Offenes Gebiet', color: '#66cccc' } : null;
}

function hideCurrentInfoTelemetry() {
    const box = document.getElementById('liveCurrentBox');
    if (box) box.style.display = 'none';
}

function updateCurrentInfoTelemetry(lat, lon, alt = null) {
    const box = document.getElementById('liveCurrentBox');
    const posEl = document.getElementById('currentPosRef');
    const freqEl = document.getElementById('currentFreqValue');
    const sourceEl = document.getElementById('currentFreqSource');
    if (!box || !posEl || !freqEl || !sourceEl) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        hideCurrentInfoTelemetry();
        return;
    }

    const shouldShow = isMapHintOn('currentInfo', true);
    box.style.display = shouldShow ? 'block' : 'none';
    if (!shouldShow) return;

    const ref = findNearestCurrentReference(lat, lon);
    if (ref) {
        const dir = currentInfoCardinalFromBearing(ref.brngFromRef);
        posEl.textContent = `${currentInfoNm(ref.dist)} NM ${dir} ${ref.label}`.replace(/\s+/g, ' ').trim();
    } else {
        posEl.textContent = 'Position aktiv';
    }

    const freq = getCurrentFrequencyInfo(lat, lon, alt);
    if (freq) {
        freqEl.textContent = freq.value;
        freqEl.style.color = freq.color || '#9fd3ff';
        sourceEl.textContent = freq.source || '';
    } else {
        freqEl.textContent = '—';
        freqEl.style.color = '#777';
        sourceEl.textContent = '';
    }

    box.style.display = 'block';
}

function normalizeTextToken(s) {
    return String(s || '')
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getAssociatedAirportIcaoForRpp(wp) {
    if (!wp) return '';
    const direct = String(wp.rppAirportIcao || '').trim().toUpperCase();
    if (/^[A-Z]{4}$/.test(direct)) return direct;
    if (wp._rppAssocIcao && /^[A-Z]{4}$/.test(wp._rppAssocIcao)) return wp._rppAssocIcao;
    if (typeof globalAirports !== 'object' || !globalAirports || typeof calcNav !== 'function') return '';

    const label = String(wp.name || '').replace(/^RPP\s+/i, '');
    const normLabel = normalizeTextToken(label);
    const tokens = normLabel.split(' ').filter(t => t.length >= 4);

    let bestIcao = '';
    let bestScore = Infinity;

    for (const key in globalAirports) {
        const apt = globalAirports[key];
        const icao = String(apt?.icao || key || '').trim().toUpperCase();
        if (!/^[A-Z]{4}$/.test(icao)) continue;
        if (!Number.isFinite(wp.lat) || !Number.isFinite(wp.lng || wp.lon)) continue;
        if (!Number.isFinite(apt.lat) || !Number.isFinite(apt.lon)) continue;

        const dNm = calcNav(wp.lat, wp.lng || wp.lon, apt.lat, apt.lon).dist;
        if (!Number.isFinite(dNm) || dNm > 35) continue;

        const aptText = normalizeTextToken(`${apt.name || ''} ${apt.city || ''} ${icao}`);
        const tokenHit = tokens.length > 0 && tokens.some(t => aptText.includes(t));
        if (!tokenHit && dNm > 8) continue;

        const score = dNm + (tokenHit ? 0 : 12);
        if (score < bestScore) {
            bestScore = score;
            bestIcao = icao;
        }
    }

    wp._rppAssocIcao = bestIcao || '';
    return bestIcao;
}

function getWpFrequencyText(wpIdx) {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || !routeWaypoints[wpIdx]) return '';
    const wp = routeWaypoints[wpIdx];
    const lastIdx = routeWaypoints.length - 1;
    const wpName = String(getWpDisplayName(wpIdx) || '');

    // Wenn im Namen bereits eine Frequenz steckt (z.B. gesnappter APT-WP), nichts doppeln.
    if (getExplicitFrequencyFromText(wpName)) return '';

    if (wpIdx === 0) {
        const icao = (typeof currentStartICAO !== 'undefined') ? currentStartICAO : '';
        const f = (typeof currentDepFreq !== 'undefined' && currentDepFreq) ? currentDepFreq : getPrimaryAirportFrequency(icao, 'dep');
        return f ? `📻 ${f}` : '';
    }
    if (wpIdx === lastIdx) {
        const icao = (typeof currentDestICAO !== 'undefined') ? currentDestICAO : '';
        const f = (typeof currentDestFreq !== 'undefined' && currentDestFreq) ? currentDestFreq : getPrimaryAirportFrequency(icao, 'dest');
        return f ? `📻 ${f}` : '';
    }

    if (/^RPP\s+/i.test(wpName)) {
        const rppIcao = getAssociatedAirportIcaoForRpp(wp);
        if (rppIcao) {
            const f = getPrimaryAirportFrequency(rppIcao, null);
            if (f) return `📻 ${rppIcao} ${f}`;
        }
    }

    const fis = getRegionalFisFrequency(wp.lat, wp.lng || wp.lon);
    return fis ? `🌐 FIS ${fis}` : '';
}

function escapeHtmlLite(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function updateLiveToActiveWpLine(lat, lon, activeWpIdx = null) {
    if (typeof map === 'undefined' || !map || typeof L === 'undefined') return;
    if (!isMapHintOn('magentaLine', true)) {
        if (liveToWpLine) { try { liveToWpLine.remove(); } catch (e) {} liveToWpLine = null; }
        return;
    }
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) {
        if (liveToWpLine) { try { liveToWpLine.remove(); } catch (e) {} liveToWpLine = null; }
        return;
    }
    const autoWpIdx = clampLiveWpIndex(liveNextLegIndex + 1);
    const wpIdx = (activeWpIdx == null) ? ((liveActiveWpIndex == null) ? autoWpIdx : clampLiveWpIndex(liveActiveWpIndex)) : clampLiveWpIndex(activeWpIdx);
    const wp = routeWaypoints[wpIdx];
    const wpLon = wp.lng || wp.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !wp || !Number.isFinite(wp.lat) || !Number.isFinite(wpLon)) {
        if (liveToWpLine) { try { liveToWpLine.remove(); } catch (e) {} liveToWpLine = null; }
        return;
    }

    const pts = [[lat, lon], [wp.lat, wpLon]];
    if (!liveToWpLine) {
        liveToWpLine = L.polyline(pts, {
            color: '#ff3fd9',
            weight: 2,
            opacity: 0.9,
            interactive: false
        }).addTo(map);
    } else {
        liveToWpLine.setLatLngs(pts);
    }
}

function updateNextWpTelemetry(lat, lon) {
    const box = document.getElementById('liveNextWpBox');
    const nameEl = document.getElementById('nextWpName');
    const courseEl = document.getElementById('nextWpCourse');
    const distEl = document.getElementById('nextWpDist');
    if (!box || !nameEl || !courseEl || !distEl) return;
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2 || typeof calcNav !== 'function') {
        box.style.display = 'none';
        if (liveToWpLine) {
            try { liveToWpLine.remove(); } catch (e) {}
            liveToWpLine = null;
        }
        return;
    }

    const key = routeKeyForLiveNav();
    if (key !== liveNextRouteKey) {
        liveNextRouteKey = key;
        liveNextLegIndex = nearestLegIndexBySegment(lat, lon);
        liveActiveWpIndex = null;
    }

    const maxLeg = routeWaypoints.length - 2;
    let legIdx = Math.max(0, Math.min(liveNextLegIndex, maxLeg));
    const maxWp = routeWaypoints.length - 1;
    let wpIdx = (liveActiveWpIndex == null) ? Math.min(legIdx + 1, maxWp) : clampLiveWpIndex(liveActiveWpIndex);

    // Auto-Advance: senkrechte Triggerlinie 0.5 NM vor Wegpunkt, 5 NM breit
    const target    = routeWaypoints[wpIdx];
    const navToTarget = calcNav(lat, lon, target.lat, target.lng || target.lon);

    // Anflugkurs vom vorherigen Wegpunkt (oder aktueller Bearing wenn erster WP)
    let inboundBrng = navToTarget.brng;
    if (wpIdx > 0) {
        const prev = routeWaypoints[wpIdx - 1];
        inboundBrng = calcNav(prev.lat, prev.lng || prev.lon, target.lat, target.lng || target.lon).brng;
    }

    // Projektion auf Anflugachse: entlang = Abstand bis WP, quer = seitliche Abweichung
    const angleDiffRad = ((navToTarget.brng - inboundBrng + 540) % 360 - 180) * Math.PI / 180;
    const alongTrack   = navToTarget.dist * Math.cos(angleDiffRad); // positiv = noch vor WP
    const crossTrack   = Math.abs(navToTarget.dist * Math.sin(angleDiffRad));

    // Linie überflogen wenn: ≤ 0.5 NM vor (oder bis 0.5 NM nach) dem WP, max. 2.5 NM seitlich
    if (alongTrack <= 0.5 && alongTrack >= -0.5 && crossTrack <= 2.5 && wpIdx < maxWp) {
        const isAutoAdvance = (liveActiveWpIndex == null);
        wpIdx += 1;
        if (liveActiveWpIndex == null) legIdx = Math.max(0, wpIdx - 1);
        else liveActiveWpIndex = wpIdx;

        // Ansage nur bei automatischem Advance, nicht bei manuellem Wegpunktwechsel
        if (isAutoAdvance && typeof window.awmAnnounceWpAdvance === 'function') {
            const nextWp    = routeWaypoints[wpIdx];
            const navToNext = calcNav(lat, lon, nextWp.lat, nextWp.lng || nextWp.lon);
            window.awmAnnounceWpAdvance(navToNext.brng, navToNext.dist);
        }
    }
    liveNextLegIndex = legIdx;

    const wp  = routeWaypoints[wpIdx];
    const wpLon = wp.lng ?? wp.lon;
    const nav = calcNav(lat, lon, wp.lat, wpLon);
    const crs = `${String(nav.brng).padStart(3, '0')}°`;
    const dist = nav.dist.toFixed(1);
    const nextInfo = { wpIdx, maxWp, distToWpNm: nav.dist, brng: nav.brng };

    const wpName = getWpDisplayName(wpIdx);
    const freqInfo = getWpFrequencyText(wpIdx);
    if (freqInfo) {
        nameEl.innerHTML = `${escapeHtmlLite(wpName)}<div style="font-size:11px; color:#9fd3ff; margin-top:1px; line-height:1.1;">${escapeHtmlLite(freqInfo)}</div>`;
    } else {
        nameEl.textContent = wpName;
    }
    courseEl.textContent = crs;
    distEl.textContent = dist;
    box.style.display = (window.simModeActive || isMapHintOn('nextLeg', true)) ? 'block' : 'none';
    setNextLegButtonStates(wpIdx, maxWp);
    updateLiveToActiveWpLine(lat, lon, wpIdx);

    // Compass HSI instruments
    if (typeof window.updateCompassInstruments === 'function') {
        let xteNm = 0;
        if (wpIdx > 0 && typeof calcNav === 'function') {
            try {
                const prevWp = routeWaypoints[wpIdx - 1];
                const fromPrev = calcNav(prevWp.lat, prevWp.lng || prevWp.lon, lat, lon);
                const R = 3440.065;
                const diffRad = (fromPrev.brng - inboundBrng) * Math.PI / 180;
                xteNm = Math.asin(Math.sin(fromPrev.dist / R) * Math.sin(diffRad)) * R;
            } catch (_) {}
        }
        window.updateCompassInstruments(nav.brng, inboundBrng, xteNm);
    }
    return nextInfo;
}

// Diese Funktion aufrufen, sobald eine Route per Sync ID geladen wurde (z.B. connectToLiveGPS("4815"))
window.connectToLiveGPS = async function(syncId) {
    if (!syncId) return;

    const wsUrl = 'wss://websocketrelais.onrender.com/';

    // Alte Verbindung schließen, falls wir die ID wechseln
    if (liveGpsSocket) liveGpsSocket.close();

    console.log(`[GPS] 📡 Verbinde mit Live-Tracking für Pilot-ID ${syncId}...`);

    // Wake-up Ping: Render.com Free Tier aus dem Schlaf holen bevor WebSocket versucht wird
    const ind0 = document.getElementById('liveGpsIndicator');
    if (ind0) { ind0.innerHTML = '🛰️ WAKE'; ind0.style.color = '#f2c12e'; ind0.style.textShadow = 'none'; }
    try {
        await fetch('https://websocketrelais.onrender.com/', { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(8000) });
    } catch(e) { /* Server schläft evtl. noch – WebSocket versucht es trotzdem */ }

    liveGpsSocket = new WebSocket(wsUrl);

    liveGpsSocket.onopen = () => {
        console.log(`[GPS] ✅ Verbunden! Warte auf Flugzeug-Daten...`);
        gpsReconnectDelay = 2000; // Erfolg → Backoff zurücksetzen
        const now = Date.now();
        lastTrackerReconnectAt = now;
        if (lastTrackerDisconnectAt && (now - lastTrackerDisconnectAt) <= 30000) {
            trackerReconnectRecoveryUntil = now + 20000;
        }
        window.liveTrackerConnected = true;
        _updateMissionRuntimeUi();
        if (typeof window.scheduleTerrainAvoidOverlayUpdate === 'function') window.scheduleTerrainAvoidOverlayUpdate(true);
        // Dem Server mitteilen, in welchen Raum wir wollen (mit PIN!)
        liveGpsSocket.send(JSON.stringify({ type: 'join', syncId: syncId, pin: getSyncPin() }));
        setTimeout(() => _trackerPendingResendAll('websocket-open'), 300);
        let missionSceneTickDelayMs = 900;
        if (missionSceneReconnectResyncPending && !missionRuntime.active && !window.simModeActive) {
            missionSceneReconnectResyncPending = false;
            if (typeof window.clearMissionSceneObjects === 'function') {
                try { window.clearMissionSceneObjects('websocket-open-resync'); } catch (_) {}
            }
            missionSceneTickDelayMs = 2200;
        }
        if (window.missionCargoStatus?.payloadNeedsSync) {
            setTimeout(() => {
                _missionCargoApplyPendingResetStations('websocket-reconnect-pending-reset')
                    .then(() => {
                        if (window.missionCargoStatus?.payloadNeedsSync) {
                            return _missionCargoSyncPayloadToSim('websocket-reconnect-resync');
                        }
                        return null;
                    })
                    .catch(() => {});
            }, 650);
        }

        const ind = document.getElementById('liveGpsIndicator');
        if (ind) {
            ind.innerHTML = '🛰️ WAIT';
            ind.style.color = '#f2c12e'; // Orange
            ind.style.textShadow = 'none';
        }
        if (missionRuntime.active && typeof window.missionSmokeEnsureSpawned === 'function') {
            setTimeout(() => window.missionSmokeEnsureSpawned('websocket-open'), 500);
        }
        if (missionRuntime.active && typeof window.missionTargetSceneEnsureSpawned === 'function') {
            setTimeout(() => window.missionTargetSceneEnsureSpawned('websocket-open'), 650);
        }
        if (missionRuntime.active && typeof window.missionAptArrivalEnsureSpawned === 'function') {
            setTimeout(() => window.missionAptArrivalEnsureSpawned('websocket-open'), 750);
        }
        setTimeout(() => _missionSceneHandleFlightTick(window.lastLiveFlightData || {}, 'websocket-open'), missionSceneTickDelayMs);
    };

    liveGpsSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'error') {
                alert(data.message);
                if (liveGpsSocket) liveGpsSocket.close();
                return;
            }
            if (data.trackerAck) {
                _handleTrackerAck(data.trackerAck);
                if (data.commandAckOnly) return;
                if (!Number.isFinite(Number(data.lat)) || !Number.isFinite(Number(data.lon))) return;
            }
            if (data.trackerCommand || data.commandOnly) return;
            if (data.type === 'gps') {
                if (!Number.isFinite(Number(data.lat)) || !Number.isFinite(Number(data.lon))) return;
                _maybePromptTrackerUpdate(data);
                if (data.flight && typeof data.flight === 'object') {
                    window.lastLiveFlightData = data.flight;
                    if (typeof window.terrainAvoidHandleFlightState === 'function') window.terrainAvoidHandleFlightState();
                }
                updateLivePlanePosition(data.lat, data.lon, data.alt, data.hdg);

                // Traffic-Daten die im GPS-Paket eingebettet sind (Relay-kompatibler Weg)
                if (data.traffic && Array.isArray(data.traffic)) {
                    // Eigenes Flugzeug + irrelevanten Traffic herausfiltern
                    const filteredTraffic = data.traffic.filter(ac => {
                        const dLat = Math.abs((ac.lat ?? 0) - data.lat);
                        const dLon = Math.abs((ac.lon ?? 0) - data.lon);
                        if (dLat < 0.0015 && dLon < 0.0015) return false; // eigene Position ~0.1 NM
                        // Nur Flieger innerhalb ±5000 ft anzeigen – außer sie sind sehr nah (<5 NM)
                        const dAlt = Math.abs((ac.alt ?? 0) - data.alt);
                        const nearBy = dLat < 0.08 && dLon < 0.08; // ~5 NM box
                        if (!nearBy && dAlt > 5000) return false;
                        return true;
                    });
                    window.vpTrafficData = filteredTraffic;
                    if (window.vpTrafficMapVisible) {
                        updateTrafficOnMap(filteredTraffic, data.alt);
                    }
                }

                const ind = document.getElementById('liveGpsIndicator');
                if (ind) {
                    ind.innerHTML = '🛰️ LIVE'; 
                    ind.style.color = '#44ff44'; // Grün
                    ind.style.textShadow = '0 0 8px #44ff44';
                    
                    // Watchdog: Timer bei jedem neuen Paket zurücksetzen
                    clearTimeout(gpsWatchdog);
                    gpsWatchdog = setTimeout(() => {
                        // Wenn 3 Sekunden lang kein Paket mehr kam -> Zurück auf WAIT
                        if (ind.innerHTML === '🛰️ LIVE') {
                            ind.innerHTML = '🛰️ WAIT';
                            ind.style.color = '#f2c12e';
                            ind.style.textShadow = 'none';
                        }
                    }, 3000);
                }
            }
            if (data.type === 'traffic') {
                window.vpTrafficData = data.aircraft || [];
                if (window.vpTrafficMapVisible) {
                    updateTrafficOnMap(window.vpTrafficData, window.lastLiveGpsPos?.alt);
                }
            }
        } catch (e) {
            console.error('[GPS] Fehler beim Lesen der Daten:', e);
        }
    };

    liveGpsSocket.onclose = () => {
        clearTimeout(gpsWatchdog);
        lastTrackerDisconnectAt = Date.now();
        window.liveTrackerConnected = false;
        _updateMissionRuntimeUi();
        if (typeof window.scheduleTerrainAvoidOverlayUpdate === 'function') window.scheduleTerrainAvoidOverlayUpdate(true);
        const ind = document.getElementById('liveGpsIndicator');
        if (ind) {
            ind.innerHTML = '🛰️ OFF';
            ind.style.color = '#666';
            ind.style.textShadow = 'none';
        }
        hideNextWpTelemetry();

        // Auto-HDG zurücksetzen damit es bei der nächsten Verbindung wieder greift
        window._hdgAutoActivated = false;

        // Exponentielles Backoff: 2s → 4s → 8s → max 15s (fängt Render.com Cold Starts sauber ab)
        console.warn(`[GPS] ❌ Verbindung getrennt. Reconnect in ${(gpsReconnectDelay/1000).toFixed(0)}s...`);
        setTimeout(() => connectToLiveGPS(syncId), gpsReconnectDelay);
        gpsReconnectDelay = Math.min(gpsReconnectDelay * 2, 15000);
    };

    liveGpsSocket.onerror = () => {
        clearTimeout(gpsWatchdog);
        lastTrackerDisconnectAt = Date.now();
        window.liveTrackerConnected = false;
        _updateMissionRuntimeUi();
        if (typeof window.scheduleTerrainAvoidOverlayUpdate === 'function') window.scheduleTerrainAvoidOverlayUpdate(true);
        const ind = document.getElementById('liveGpsIndicator');
        if (ind) { 
            ind.innerHTML = '🛰️ OFF'; 
            ind.style.color = '#666'; // Grau
            ind.style.textShadow = 'none';
        }
        hideNextWpTelemetry();
    };
};

function _headingDiffDeg(a, b) {
    return Math.abs(((a - b + 540) % 360) - 180);
}

function _profileSegmentCourseDeg(ed, i) {
    const i0 = Math.max(0, i - 1);
    const i1 = Math.min(ed.length - 1, i + 1);
    if (i0 === i1) return null;
    const a = ed[i0], b = ed[i1];
    const aLon = a.lon ?? a.lng;
    const bLon = b.lon ?? b.lng;
    if (!Number.isFinite(a?.lat) || !Number.isFinite(aLon) || !Number.isFinite(b?.lat) || !Number.isFinite(bLon)) return null;
    const refLat = ((a.lat + b.lat) * 0.5) * Math.PI / 180;
    const dLon = (bLon - aLon) * Math.cos(refLat);
    const dLat = (b.lat - a.lat);
    if (Math.abs(dLon) < 1e-9 && Math.abs(dLat) < 1e-9) return null;
    return (Math.atan2(dLon, dLat) * 180 / Math.PI + 360) % 360;
}

function _profileIdxScore(ed, i, lat, lon, hdg) {
    const p = ed[i];
    const pLon = p.lon ?? p.lng;
    const dLat = lat - p.lat;
    const dLon = lon - pLon;
    const distNm = Math.sqrt(dLat * dLat + dLon * dLon) * 59.9;
    let score = distNm;

    if (Number.isFinite(hdg)) {
        const segCourse = _profileSegmentCourseDeg(ed, i);
        if (Number.isFinite(segCourse)) {
            const diff = _headingDiffDeg(hdg, segCourse);
            if (diff > 20) {
                // Gegenkurs-Segmente in Nähe bekommen eine klare, aber nicht harte Strafe.
                score += Math.min(2.5, ((diff - 20) / 160) * 2.5);
            }
        }
    }
    return { score, distNm };
}

function updateLivePlanePosition(lat, lon, alt, hdg) {
    const now = Date.now();
    const simGsNow = Number(window.lastLiveFlightData?.gsKts ?? window.lastLiveFlightData?.gs);
    const curGs = Number.isFinite(simGsNow) ? simGsNow : smoothedGS;
    window.lastLiveGpsPos = { lat, lon, alt, hdg, t: now, gs: curGs };
    _missionSceneHandleFlightTick(window.lastLiveFlightData || {}, 'gps-tick');
    if (now - lastMissionRuntimeLiveUiRefreshAt > 650) {
        lastMissionRuntimeLiveUiRefreshAt = now;
        _updateMissionRuntimeUi();
    }
    if (typeof map === 'undefined' || !map || typeof L === 'undefined') return;

    if (typeof window.scheduleTerrainAvoidOverlayUpdate === 'function') window.scheduleTerrainAvoidOverlayUpdate(false);
    if (typeof window.terrainAvoidHandleFlightState === 'function') window.terrainAvoidHandleFlightState();
    window.updateCompassHeading(hdg);

    // --- FEATURE 1: SNAIL TRAIL ---
    if (!liveSnailTrail) {
        liveSnailTrail = L.polyline([], {
            color: '#1a4bb3',
            weight: 3,
            opacity: 0.7,
            dashArray: '5, 10',
            interactive: false
        }).addTo(map);
    }
    
    // Nur Punkt hinzufügen, wenn > 20 Meter vom letzten Punkt entfernt
    if (!lastTrailPoint || map.distance(lastTrailPoint, [lat, lon]) > 20) {
        liveSnailTrail.addLatLng([lat, lon]);
        lastTrailPoint = [lat, lon];
    }

    // --- FEATURE 2: AUTO-FOLLOW ---
    const lowFpsMode = isLowFpsModeActive();
    if (isAutoFollow) {
        if (!lowFpsMode) {
            map.panTo([lat, lon]);
        } else {
            const movedM = lastAutoFollowPanPos ? map.distance(lastAutoFollowPanPos, [lat, lon]) : Number.POSITIVE_INFINITY;
            const canPanByTime = (now - lastAutoFollowPanAt) >= 320;
            const canPanByDist = movedM >= 45;
            if (canPanByTime && canPanByDist) {
                map.panTo([lat, lon], { animate: false });
                lastAutoFollowPanAt = now;
                lastAutoFollowPanPos = [lat, lon];
            }
        }
    }

    // --- FEATURE 3: TELEMETRY (GS & VS) ---
    if (lastGpsTickDetails) {
        const dt = (now - lastGpsTickDetails.t) / 1000; // Sekunden
        if (dt > 1.0) { // UI-Update-Schutz & Smoothing (ca. 1 Sekunde)
            const distM = map.distance([lastGpsTickDetails.lat, lastGpsTickDetails.lon], [lat, lon]);
            const calcGs = (distM / dt) * 1.94384;
            const simGs = Number(window.lastLiveFlightData?.gsKts ?? window.lastLiveFlightData?.gs);
            const gs = Number.isFinite(simGs) ? simGs : calcGs;
            const vs = ((alt - lastGpsTickDetails.alt) / dt) * 60;

            const box = document.getElementById('liveTelemetryBox');
            if (box) {
                box.style.display = (window.simModeActive || isMapHintOn('telemetry', true)) ? 'block' : 'none';
                const gsEl = document.getElementById('teleGS');
                const vsEl = document.getElementById('teleVS');
                if (gsEl) gsEl.textContent = gs.toFixed(1);
                if (vsEl) {
                    vsEl.textContent = Math.round(vs);
                    vsEl.style.color = vs > 100 ? 'var(--green)' : (vs < -100 ? 'var(--red)' : '#fff');
                }
                // AGL wird in updateLivePlanePosition weiter unten gesetzt (nach bestIdx-Suche)
            }
            const nextInfo = updateNextWpTelemetry(lat, lon);
            updateRouteProgressBar(lat, lon, gs, nextInfo);
            updateCurrentInfoTelemetry(lat, lon, alt);
            // Smoothed GS/VS for prediction (EMA α=0.3)
            smoothedGS = smoothedGS === 0 ? gs : smoothedGS * 0.7 + gs * 0.3;
            smoothedVS = smoothedVS === 0 ? vs : smoothedVS * 0.7 + vs * 0.3;

            // Auto-HDG: Bei erster echter GPS-Bewegung HDG-Modus aktivieren (nicht im Sim-Modus)
            if (smoothedGS > 20 && !window._hdgAutoActivated
                && !window.simModeActive
                && typeof vpMode !== 'undefined' && vpMode === 'ROUTE'
                && typeof vpToggleMode === 'function') {
                window._hdgAutoActivated = true;
                vpToggleMode();
            }

            // Update last info for speed calculation
            lastGpsTickDetails = { lat, lon, alt, t: now };
        }
    } else {
        lastGpsTickDetails = { lat, lon, alt, t: now };
        const nextInfo = updateNextWpTelemetry(lat, lon);
        updateRouteProgressBar(lat, lon, curGs, nextInfo);
        updateCurrentInfoTelemetry(lat, lon, alt);
    }

    // --- PREDICTION VECTORS ---
    // Hilfsfunktion: Luftraum-Farbe für einen Vorhersagepunkt (synchron, für Marker-Einfärbung)
    function _getAirspaceColorForPredPoint(pt) {
        if (typeof activeAirspaces === 'undefined' || !activeAirspaces.length) return null;
        if (typeof getAirspaceVerticalBandFt === 'undefined' || typeof isPointInsideAirspace === 'undefined') return null;
        for (const as of activeAirspaces) {
            if (!as.geometry || !as.lowerLimit || !as.upperLimit) continue;
            if (as.type === 33) continue; // FIS überspringen
            const terrainBase = Number(pt.terrainFt ?? window.lastLiveTerrainFt) || 0;
            const band = getAirspaceVerticalBandFt(as, terrainBase);
            if (!band) continue;
            if (pt.alt < band.lowerFt - 500 || pt.alt > band.upperFt + 500) continue;
            if (isPointInsideAirspace(as, pt.lat, pt.lon))
                return typeof getAirspaceStyle === 'function' ? getAirspaceStyle(as).color : '#f2c12e';
        }
        return null;
    }
    if (smoothedGS > 30 && typeof getDestinationPoint === 'function' && now - lastPredictionUpdate > 1000) {
        lastPredictionUpdate = now;
        const horizons = [1, 2, 5, 10];
        const predPoints = horizons.map(min => {
            const distNM = smoothedGS * (min / 60);
            const pt = getDestinationPoint(lat, lon, distNM, hdg);
            const predAlt = alt + (smoothedVS * min);
            return { lat: pt.lat, lon: pt.lon, min, distNMAhead: distNM, altFt: Math.max(0, predAlt), alt: Math.max(0, predAlt), threat: 'green' };
        });

        // Für Vertikalprofil-Rendering bereitstellen
        window.vpPredictionData = predPoints;

        // Erweiterte Punkte für AWM (3 und 4 min) — nur intern, nicht auf Karte
        const _awmExtra = [3, 4].map(min => {
            const distNM = smoothedGS * (min / 60);
            const pt = getDestinationPoint(lat, lon, distNM, hdg);
            return { lat: pt.lat, lon: pt.lon, min, alt: Math.max(0, alt + smoothedVS * min) };
        });
        const _awmPredPoints = [...predPoints, ..._awmExtra];
        // Zusätzlicher TAWS-Feinpunkt für 15s "time-to-impact" Warnung.
        const _tawsExtra = [0.25].map(min => {
            const distNM = smoothedGS * (min / 60);
            const pt = getDestinationPoint(lat, lon, distNM, hdg);
            return { lat: pt.lat, lon: pt.lon, min, alt: Math.max(0, alt + smoothedVS * min) };
        });
        const _tawsPredPoints = [..._awmPredPoints, ..._tawsExtra];

        const lineCoords = [[lat, lon], ...predPoints.map(p => [p.lat, p.lon])];

        // Linie zeichnen/updaten
        if (!predictionLine) {
            predictionLine = L.polyline(lineCoords, {
                color: '#ffffff',
                weight: 2,
                opacity: 0.7,
                dashArray: '8, 6',
                interactive: false
            }).addTo(map);
        } else {
            predictionLine.setLatLngs(lineCoords);
        }

        // Lufträume positions-basiert nachladen wenn:
        //   a) HDG-Modus — activeAirspaces muss positions-basiert sein, oder
        //   b) Keine Route gesetzt — ohne Route wird fetchRouteAirspaces nie aufgerufen
        //      → activeAirspaces bleibt sonst dauerhaft leer
        // Im ROUTE-Modus MIT Route: NICHT aufrufen, sonst überschreibt der 10-NM-Ausschnitt
        // die komplette Routen-Luftraumliste und Lufträume verschwinden aus dem Vertikalprofil.
        const _isHdgModeNow = (typeof vpMode !== 'undefined' && vpMode === 'HDG');
        const _hasRoute = !!(window._lastVpRouteKey);
        if ((_isHdgModeNow || !_hasRoute) && typeof fetchRouteAirspaces === 'function') {
            const hdgKey = `${lat.toFixed(1)}_${lon.toFixed(1)}`;
            if (window._lastHdgAirspaceKey !== hdgKey) {
                window._lastHdgAirspaceKey = hdgKey;
                const hdgPts = [{ lat, lng: lon }, ...predPoints.map(p => ({ lat: p.lat, lng: p.lon }))];
                fetchRouteAirspaces(hdgPts);
            }
        }

        // Hindernisse + Städte positions-basiert laden wenn kein Flugplan gesetzt oder HDG-Modus
        const _needsGpsData = _isHdgModeNow || !_hasRoute;
        if (_needsGpsData) {
            // Hindernisse: max. alle 2 Minuten UND bei Positionsänderung >~6km
            const _obsKey = `${lat.toFixed(1)}_${lon.toFixed(1)}`;
            const _obsNow = Date.now();
            if ((window._lastGpsObsKey !== _obsKey || !window._lastGpsObsTime || (_obsNow - window._lastGpsObsTime) > 120000)
                && typeof window.fetchGpsObstacles === 'function') {
                window._lastGpsObsKey = _obsKey;
                window._lastGpsObsTime = _obsNow;
                window.fetchGpsObstacles(lat, lon);
            }
            // Städte: bei Positionsänderung >~700m (RAM-only, kein API-Limit)
            const _cityKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
            if (window._lastGpsCityKey !== _cityKey && typeof window.updateGpsCities === 'function') {
                window._lastGpsCityKey = _cityKey;
                window.updateGpsCities(lat, lon);
            }
        } else {
            // Zurücksetzen damit beim nächsten Eintritt in GPS-Modus sofort geladen wird
            window._lastGpsObsKey = null;
            window._lastGpsCityKey = null;
        }

        // TAWS-Check: Prediction-Linie einfärben wenn taws.js geladen
        if (typeof checkTerrainAlongPath === 'function') {
            checkTerrainAlongPath(_tawsPredPoints).then(results => {
                if (!results || !predictionLine) return;
                // Airspace-Warnungen mit Terrain-Info füttern (AGL-Limits korrekt auswerten).
                if (typeof checkAirspaceWarnings === 'function') {
                    const terrainFallback = Number(window.lastLiveTerrainFt) || 0;
                    const awmPts = _awmPredPoints.map((p, idx) => ({
                        ...p,
                        terrainFt: Number(results[idx]?.terrainFt ?? terrainFallback) || 0
                    }));
                    checkAirspaceWarnings(awmPts);
                }

                // Worst-case Threat bestimmt Linienfarbe
                let worst = 'green';
                for (const r of results.slice(0, predPoints.length)) {
                    if (r.threat === 'red') { worst = 'red'; break; }
                    if (r.threat === 'amber') worst = 'amber';
                }
                const color = worst === 'red' ? '#ff2222' : worst === 'amber' ? '#ffaa00' : '#ffffff';
                predictionLine.setStyle({ color });

                // Marker-Farben: Terrain hat Priorität, danach Luftraum-Farbe
                predictionMarkers.forEach((m, i) => {
                    const pt = predPoints[i];
                    const terrain = results[i];
                    let c = '#ffffff';
                    if (terrain?.threat === 'red')   c = '#ff2222';
                    else if (terrain?.threat === 'amber') c = '#ffaa00';
                    else if (pt) {
                        // Luftraum-Check für visuelle Rückmeldung
                        const asC = _getAirspaceColorForPredPoint(pt);
                        if (asC) c = asC;
                    }
                    m.setStyle({ color: c, fillColor: c });
                });

                // Threats + Airspace-Farbe ans Vertikalprofil weitergeben
                if (window.vpPredictionData) {
                    results.forEach((r, i) => {
                        if (!window.vpPredictionData[i]) return;
                        window.vpPredictionData[i].threat = r.threat;
                        // Airspace-Farbe: nur setzen wenn kein Terrain-Threat
                        if (r.threat === 'green') {
                            window.vpPredictionData[i].asColor = _getAirspaceColorForPredPoint(predPoints[i]) || null;
                        } else {
                            window.vpPredictionData[i].asColor = null;
                        }
                    });
                }
            });
        } else {
            // Fallback ohne Terrain-Resolver
            if (typeof checkAirspaceWarnings === 'function') checkAirspaceWarnings(_awmPredPoints);
        }

        // Zeitmarker zeichnen/updaten
        while (predictionMarkers.length < predPoints.length) {
            const idx = predictionMarkers.length;
            const m = L.circleMarker([0, 0], {
                radius: 4,
                color: '#ffffff',
                fillColor: '#ffffff',
                fillOpacity: 0.9,
                weight: 1.5,
                interactive: false
            }).addTo(map);
            m.bindTooltip('', { permanent: true, direction: 'top', offset: [0, -8], className: 'prediction-tooltip' });
            predictionMarkers.push(m);
        }
        predPoints.forEach((p, i) => {
            predictionMarkers[i].setLatLng([p.lat, p.lon]);
            predictionMarkers[i].setTooltipContent(`${p.min}m`);
        });
    } else if (smoothedGS <= 30) {
        // Zu langsam → Prediction ausblenden
        if (predictionLine) { predictionLine.remove(); predictionLine = null; }
        predictionMarkers.forEach(m => m.remove());
        predictionMarkers = [];
    }

    // --- ICON A: KARTE ---
    // SVG nur einmal bauen, danach nur per CSS-Transform rotieren (kein innerHTML-Rebuild pro Paket!)
    const _planeSvgTemplate = `
        <div class="live-plane-inner" style="width: var(--plane-size); height: var(--plane-size); filter: drop-shadow(0 0 5px rgba(0,0,0,0.6)); position: relative; transform: translate(-50%, -37%);">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 447.74 339.91" style="transform-origin: 50% 37%; width: 100%; height: 100%; will-change: transform;">
                <path fill="var(--plane-color)" stroke="#000" stroke-width="16" stroke-linejoin="round" stroke-linecap="round" d="M447.22,118.14a2,2,0,0,0-1.48-.65H443a61.87,61.87,0,0,0-6.2-19.62,8.66,8.66,0,0,0-7.67-4.6H290.3a13.4,13.4,0,0,1-4.61-.81L259.8,83a10.84,10.84,0,0,1-7.09-8.94c-1.44-12.06-4.15-34.18-6.06-46.78a16.45,16.45,0,0,0-10.94-13.17c-.9-.31-1.81-.59-2.69-.82a1.94,1.94,0,0,1-1.4-1.37,29.46,29.46,0,0,0-5.37-10.72,3.45,3.45,0,0,0-5.28,0A29.37,29.37,0,0,0,215.6,12a2,2,0,0,1-1.4,1.37c-.88.23-1.79.51-2.69.82a16.46,16.46,0,0,0-10.95,13.17C198.67,39.84,196,62,194.51,74.09A10.84,10.84,0,0,1,187.42,83l-25.89,9.43a13.4,13.4,0,0,1-4.61.81H18a8.66,8.66,0,0,0-7.66,4.6,61.62,61.62,0,0,0-6.2,19.62H2a2,2,0,0,0-2,2.19l.63,6.83a2,2,0,0,0,2,1.82h.72v.33A71.32,71.32,0,0,0,6.5,150a49.32,49.32,0,0,0,8.4,16.31,5.49,5.49,0,0,0,4.28,2H196.94c.84,5.65,13.56,91.52,17.94,122h-50.2a11.94,11.94,0,0,0-11.92,11.92v13.57a11.94,11.94,0,0,0,11.92,11.92H224.5v11.4c0,.37.64.71,1,.71s1.1-.34,1.1-.71V327.8h59.82a11.94,11.94,0,0,0,11.92-11.92V302.31a11.94,11.94,0,0,0-11.92-11.92H232.34c4.38-30.49,17.1-116.36,17.93-122H428a5.53,5.53,0,0,0,4.29-2,49.32,49.32,0,0,0,8.4-16.31,71.64,71.64,0,0,0,3.14-21.38v-.33h1.24a2,2,0,0,0,2-1.82l.63-6.83A2,2,0,0,0,447.22,118.14Zm-4.62,1c0,.27.07.54.1.81l.09.87C442.74,120.3,442.67,119.74,442.6,119.19ZM443,123c0,.14,0,.29,0,.44s0,.58.05.86h0C443,123.9,443,123.46,443,123Zm.09,1.32v.06c0,.12,0,.24,0,.37C443.08,124.63,443.08,124.49,443.07,124.35Z"/>
            </svg>
            <div style="position:absolute; left:50%; top:37%; width:4px; height:4px; background:#000; border-radius:50%; transform:translate(-50%,-50%); pointer-events:none;"></div>
        </div>
    `;

    if (!liveGpsMarker) {
        const planeIcon = L.divIcon({
            html: _planeSvgTemplate,
            className: 'live-plane-marker',
            iconSize: [0, 0],
            iconAnchor: [0, 0]     // Geo-Koordinate = top-left des Divs; inner div verschiebt sich per translate(-50%,-37%)
        });
        liveGpsMarker = L.marker([lat, lon], {
            icon: planeIcon,
            zIndexOffset: 9999,
            interactive: false
        }).addTo(map);
        // Initiale Rotation setzen
        const svgEl = liveGpsMarker.getElement()?.querySelector('svg');
        if (svgEl) svgEl.style.transform = `rotate(${hdg}deg)`;
        if (typeof window.updateLivePlanePerformanceMode === 'function') window.updateLivePlanePerformanceMode(lowFpsMode);
        const planeEl = liveGpsMarker.getElement();
        if (planeEl) planeEl.style.pointerEvents = 'none';

        map.on('dragstart', () => { if (isAutoFollow) toggleAutoFollow(); });
    } else {
        liveGpsMarker.setLatLng([lat, lon]);
        // Im Low-FPS-Mode die Heading-Rotation leicht drosseln, um Repaint-Spitzen zu vermeiden.
        if (!lowFpsMode || (now - lastLivePlaneHeadingUpdateAt) >= 120) {
            const svgEl = liveGpsMarker.getElement()?.querySelector('svg');
            if (svgEl) svgEl.style.transform = `rotate(${hdg}deg)`;
            lastLivePlaneHeadingUpdateAt = now;
        }
        if (typeof window.updateLivePlanePerformanceMode === 'function') window.updateLivePlanePerformanceMode(lowFpsMode);
        const planeEl = liveGpsMarker.getElement();
        if (planeEl) planeEl.style.pointerEvents = 'none';
    }

    // --- ICON B: HÖHENPROFIL ---
    // Richtungssensitives Lock-on: verhindert Sprünge zwischen nahen Hin-/Rück-Segmenten.
    if (typeof vpElevationData !== 'undefined' && vpElevationData && vpElevationData.length > 2) {
        const ed = vpElevationData;
        const totalDist = ed[ed.length - 1].distNM;
        const routeSig = `${ed.length}:${Math.round(totalDist * 10)}`;
        if (routeSig !== vpProfileLockSig) {
            vpProfileLockSig = routeSig;
            vpProfileLockIdx = -1;
        }

        const coarseStep = Math.max(1, Math.floor(ed.length / 8));
        let coarseIdx = 0, coarseBest = Infinity;
        for (let i = 0; i < ed.length; i += coarseStep) {
            const p = ed[i];
            const pLon = p.lon ?? p.lng;
            const dLat = lat - p.lat;
            const dLon = lon - pLon;
            const d2 = dLat * dLat + dLon * dLon;
            if (d2 < coarseBest) { coarseBest = d2; coarseIdx = i; }
        }

        const localWindow = Math.max(40, coarseStep * 4);
        const hasLock = Number.isFinite(vpProfileLockIdx) && vpProfileLockIdx >= 0 && vpProfileLockIdx < ed.length;
        let searchLo = Math.max(0, coarseIdx - coarseStep);
        let searchHi = Math.min(ed.length - 1, coarseIdx + coarseStep);
        if (hasLock) {
            searchLo = Math.max(0, vpProfileLockIdx - localWindow);
            searchHi = Math.min(ed.length - 1, vpProfileLockIdx + localWindow);
        }

        let bestIdx = searchLo;
        let bestScore = Infinity;
        let bestDistNm = Infinity;
        for (let i = searchLo; i <= searchHi; i++) {
            const s = _profileIdxScore(ed, i, lat, lon, hdg);
            if (s.score < bestScore) {
                bestScore = s.score;
                bestDistNm = s.distNm;
                bestIdx = i;
            }
        }

        // Wenn Lock-Fenster zu weit weg liegt, einmal global neu einloggen.
        if (hasLock && bestDistNm > 2.2) {
            let globalBestIdx = 0;
            let globalBestScore = Infinity;
            let globalBestDistNm = Infinity;
            for (let i = 0; i < ed.length; i += 1) {
                const s = _profileIdxScore(ed, i, lat, lon, hdg);
                if (s.score < globalBestScore) {
                    globalBestScore = s.score;
                    globalBestDistNm = s.distNm;
                    globalBestIdx = i;
                }
            }
            bestIdx = globalBestIdx;
            bestDistNm = globalBestDistNm;
        }
        vpProfileLockIdx = bestIdx;
        window.vpLiveRouteDistNM = bestDistNm;

        // Terrain-Höhe weiterhin intern vorhalten (z.B. für Warnlogik),
        // Telemetrie zeigt aber MSL-Höhe.
        const terrainFt = bestDistNm < 10 ? (ed[bestIdx].elevFt ?? 0) : 0;
        window.lastLiveTerrainFt = terrainFt;
        const mslFt = Math.max(0, Math.round(alt));
        const aglEl = document.getElementById('teleAGL');
        if (aglEl) {
            aglEl.textContent = mslFt;
            aglEl.style.color = mslFt < 1500 ? '#ff4444' : (mslFt < 3000 ? '#ffcc44' : '#8ec5ff');
        }

        if (bestDistNm < 10) { // ~10 NM Schwelle für Icon-Anzeige
            if (typeof vpUpdateLiveAircraft === 'function') {
                vpUpdateLiveAircraft(ed[bestIdx].distNM / totalDist, alt, hdg);
            }
        } else {
            window.vpLiveRouteDistNM = 999;
            if (typeof vpUpdateLiveAircraft === 'function') {
                vpUpdateLiveAircraft(-1, alt, hdg);  // -1 = ausblenden
            }
        }
    }

    updateFlightRecorder(lat, lon, alt);
    if (missionRuntime.active && typeof window.missionSmokeEnsureSpawned === 'function') {
        window.missionSmokeEnsureSpawned('gps-tick');
    }
    if (missionRuntime.active && typeof window.missionTargetSceneEnsureSpawned === 'function') {
        window.missionTargetSceneEnsureSpawned('gps-tick');
    }
    if (missionRuntime.active && typeof window.missionAptArrivalEnsureSpawned === 'function') {
        window.missionAptArrivalEnsureSpawned('gps-tick');
    }
    if (typeof window.checkPaxPoiProximity === 'function') {
        const _paxAlt = Math.max(0, Math.round(alt));
        const _aglFromTracker = Number(window.lastLiveFlightData?.aglFt);
        const _paxFd  = Object.assign({}, window.lastLiveFlightData || {}, {
            mslFt: _paxAlt,
            aglFt: Number.isFinite(_aglFromTracker) ? Math.max(0, Math.round(_aglFromTracker)) : _paxAlt
        });
        window.checkPaxPoiProximity(lat, lon, _paxFd);
    }
}

function resetFlightRecorder() {
    flightRecorder = {
        active: false,
        armed: false,
        startCandidateSince: 0,
        lastUpdateTs: 0,
        pauseActive: false,
        airborneEvidenceSec: 0,
        hadAirbornePhase: false,
        startTs: 0,
        endTs: 0,
        lowSpeedSince: 0,
        wasOnGround: false,
        farewellTriggered: false,
        touchdownVsFpm: null,
        maxGs: 0,
        maxAltFt: 0,
        sumGs: 0,
        gsSamples: 0,
        distNm: 0,
        track: [],
        lastSample: null,
        maxBankDeg: 0,
        maxGForce: 1.0,
        sumGForce: 0,
        gForceSamples: 0,
        maxAglFt: 0,
        maxClimbFpm: 0,
        maxDescentFpm: 0
    };
}

function addFlightTrackPoint(lat, lon, alt, now, force = false) {
    const r = flightRecorder;
    const prev = r.track.length ? r.track[r.track.length - 1] : null;
    if (!force && prev) {
        const prevLatLng = [prev[0], prev[1]];
        const dM = map && typeof map.distance === 'function' ? map.distance(prevLatLng, [lat, lon]) : 0;
        const dtMs = now - ((prev[3] || 0) + r.startTs);
        if (dtMs < 1000) return; // max 1 Punkt/s
        if (dM < 180 && dtMs < 15000) return;
    }
    const relSec = Math.max(0, Math.round((now - r.startTs) / 1000));
    r.track.push([
        Number(lat.toFixed(5)),
        Number(lon.toFixed(5)),
        Math.round(alt),
        relSec
    ]);
    if (r.track.length > 1200) {
        // Sanftes Decimation wenn sehr lang: jeden zweiten Punkt verwerfen
        const compact = [];
        for (let i = 0; i < r.track.length; i += 2) compact.push(r.track[i]);
        r.track = compact;
    }
}

function compactFlightTrackForStorage(track, maxPoints = 220) {
    const src = Array.isArray(track) ? track : [];
    if (src.length < 2) return src.slice();
    // 1s-Bucket: nur erster Punkt je Sekunde behalten.
    const bySec = [];
    let lastSec = null;
    for (const p of src) {
        if (!Array.isArray(p) || p.length < 4) continue;
        const sec = Number.isFinite(p[3]) ? Math.round(p[3]) : null;
        if (sec == null) continue;
        if (sec === lastSec) continue;
        lastSec = sec;
        bySec.push([
            Number(Number(p[0]).toFixed(4)),
            Number(Number(p[1]).toFixed(4)),
            Math.round(Number(p[2]) / 10) * 10,
            sec
        ]);
    }
    if (bySec.length <= maxPoints) return bySec;
    const step = Math.ceil(bySec.length / maxPoints);
    const out = [];
    for (let i = 0; i < bySec.length; i += step) out.push(bySec[i]);
    const last = bySec[bySec.length - 1];
    if (out.length && out[out.length - 1][3] !== last[3]) out.push(last);
    return out;
}

function nearestAirportLabel(lat, lon) {
    if (typeof globalAirports === 'undefined' || !globalAirports) {
        return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
    }
    let bestIcao = null;
    let bestNm = Infinity;
    for (const [icao, a] of Object.entries(globalAirports)) {
        if (!a || !Number.isFinite(a.lat) || !Number.isFinite(a.lon)) continue;
        const dLat = a.lat - lat;
        const dLon = a.lon - lon;
        const nm = Math.hypot(dLat, dLon) * 59.9;
        if (nm < bestNm) { bestNm = nm; bestIcao = icao; }
    }
    if (bestIcao && bestNm <= 35) return bestIcao;
    return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
}

function _buildFlightRecordSnapshot(now) {
    const r = flightRecorder;
    const endTs = Number.isFinite(now) ? now : Date.now();
    const durationSec = Math.max(1, Math.round((endTs - r.startTs) / 1000));
    const avgGs = r.gsSamples > 0 ? (r.sumGs / r.gsSamples) : 0;
    if (r.distNm < 2 || durationSec < 120 || r.track.length < 2) {
        return null;
    }

    const track = compactFlightTrackForStorage(r.track, 220);

    const dep = track[0];
    const arr = track[track.length - 1];
    const depLabel = (typeof currentStartICAO !== 'undefined' && currentStartICAO) ? currentStartICAO : nearestAirportLabel(dep[0], dep[1]);
    const arrLabel = (typeof currentDestICAO !== 'undefined' && currentDestICAO && currentDestICAO !== 'POI')
        ? currentDestICAO
        : nearestAirportLabel(arr[0], arr[1]);

    const cargoOutcome = (typeof currentMissionData !== 'undefined' && currentMissionData)
        ? (currentMissionData.cargoOutcome || currentMissionData.missionContract?.cargoOutcome || null)
        : null;
    const record = {
        id: Date.now(),
        createdAt: Date.now(),
        dateLabel: new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        depLabel,
        arrLabel,
        durationSec,
        distanceNm: Number(r.distNm.toFixed(1)),
        avgGs: Number(avgGs.toFixed(1)),
        maxGs: Number(r.maxGs.toFixed(1)),
        maxAltFt: Math.round(r.maxAltFt),
        touchdownVsFpm: Number.isFinite(r.touchdownVsFpm) ? Math.round(r.touchdownVsFpm) : null,
        track,
        maxBankDeg: Number((r.maxBankDeg || 0).toFixed(1)),
        maxGForce: Number((r.maxGForce || 1.0).toFixed(2)),
        avgGForce: r.gForceSamples > 0 ? Number((r.sumGForce / r.gForceSamples).toFixed(2)) : 1.0,
        maxClimbFpm: Number.isFinite(r.maxClimbFpm) ? Math.round(r.maxClimbFpm) : 0,
        maxDescentFpm: Number.isFinite(r.maxDescentFpm) ? Math.round(r.maxDescentFpm) : 0
    };
    if (cargoOutcome) record.missionCargoOutcome = cargoOutcome;
    return record;
}

function finalizeFlightRecorder(now, endLat = null, endLon = null) {
    const r = flightRecorder;
    try {
        r.endTs = now;

        // Nur echte Fluege finalisieren, nicht reine Repositions-/Bodenartefakte.
        if (!r.hadAirbornePhase) return;

        const record = _buildFlightRecordSnapshot(now);
        if (!record) return;

        const hist = JSON.parse(localStorage.getItem('ga_flight_history') || '[]');
        hist.unshift(record);
        localStorage.setItem('ga_flight_history', JSON.stringify(hist.slice(0, 80)));

        if (typeof window.pinCompletedFlightRecord === 'function') {
            window.pinCompletedFlightRecord(record);
            console.log(`[FlightRec] 🧾 Flug ausgewertet & an Pinwand gehängt: ${record.depLabel} ➔ ${record.arrLabel} (${record.distanceNm} NM, ${Math.round(record.durationSec / 60)} min)`);
        } else {
            console.warn('[FlightRec] pinCompletedFlightRecord() nicht verfügbar.');
        }
        triggerCloudSave();
        const hasAptArrival = _hasAptArrivalRuntimePoint();
        if (hasAptArrival) {
            missionRuntime.arrivalFlightRecord = record;
            return;
        }
        // Farewell nur am korrekten Zielplatz triggern. APT-Arrival-Missionen
        // sprechen den Abschied erst am geplanten Empfangspunkt.
        const atTargetForFarewell = !_missionBushRequiresReturnHome() && _isAtMissionTarget(Number(endLat), Number(endLon), 1.2);
        if (!r.farewellTriggered && atTargetForFarewell) {
            if (_triggerPaxFarewellAndWaitForDeboard(record, 'flight-finalize-farewell')) {
                r.farewellTriggered = true;
            }
        }
    } finally {
        resetFlightRecorder();
    }
}

function updateFlightRecorder(lat, lon, alt) {
    if (window.simModeActive) return; // Sim-Flüge laufen über sim-route Debrief/Prompt

    const now = Date.now();
    const _lfd = window.lastLiveFlightData;
    const gs = Number.isFinite(_lfd?.gsKts) ? Number(_lfd.gsKts) : (Number(smoothedGS) || 0);
    const agl = Number.isFinite(_lfd?.aglFt)
        ? Math.max(0, Number(_lfd.aglFt))
        : Math.max(0, (Number(alt) || 0) - (Number(window.lastLiveTerrainFt) || 0));
    const hasOnGroundFlag = typeof _lfd?.onGround === 'boolean';
    const onGroundNow = hasOnGroundFlag ? !!_lfd.onGround : false;
    const nearSurfaceForPause = Number.isFinite(agl) && agl <= 35;
    const stationaryForPause = gs <= 5 || ((_lfd?.parkingBrake === true || _lfd?.parkingBrake === 1) && gs <= 10);
    const simPaused = _missionTrackerPauseActive(_lfd || {}, onGroundNow || nearSurfaceForPause, stationaryForPause);
    const inMenuOrMap = !!_lfd?.inMenuOrMap || (Number(_lfd?.simRunning) === 0) || (Number(_lfd?.dialogMode) === 1);
    const r = flightRecorder;
    const dtSec = r.lastUpdateTs ? Math.max(0, (now - r.lastUpdateTs) / 1000) : 0;
    r.lastUpdateTs = now;

    // Pause im Sim: Recorder einfrieren und keine Trigger auslösen.
    if (simPaused || inMenuOrMap) {
        r.pauseActive = true;
        r.wasOnGround = onGroundNow;
        r.lowSpeedSince = 0;
        return;
    }

    // Nach Pause unterscheiden: echter Neustart vs. normale Fortsetzung.
    if (r.pauseActive) {
        r.pauseActive = false;
        const restartPattern = onGroundNow && gs <= 2.5 && agl <= 120;
        if (restartPattern) {
            const depCtx = _scenePositionQuality(window.lastLiveGpsPos || {});
            const meaningfulMission = missionRuntime.active && _missionHadMeaningfulFlightForEnd();
            const reconnectRecovery = missionRuntime.active && _trackerReconnectRecoveryActive(now);
            const allowReset = !meaningfulMission && !reconnectRecovery && !!depCtx.nearDeparture;
            if (!allowReset) {
                const reasons = [
                    meaningfulMission ? 'meaningful-flight' : '',
                    reconnectRecovery ? 'reconnect-recovery' : '',
                    depCtx.nearDeparture ? '' : 'not-near-departure'
                ].filter(Boolean).join(',');
                console.log(`[FlightRec] Pause-Ende Neustart-Muster ignoriert (${reasons || 'guarded'})`);
                r.lastUpdateTs = now;
                r.lowSpeedSince = 0;
            } else {
            console.log('[FlightRec] Pause-Ende mit Neustart-Muster erkannt -> Mission reset bereit');
            if (typeof window.paxVoiceResetMission === 'function') window.paxVoiceResetMission();
            if (typeof window.missionRuntimeReset === 'function') window.missionRuntimeReset();
            else {
                resetFlightRecorder();
                _resetMissionRuntime();
            }
            return;
            }
        }
        r.lastUpdateTs = now; // dt-Sprung nach Pause vermeiden
    }

    if (!missionRuntime.active) {
        if (missionRuntime.armed || missionRuntime.readySince) {
            missionRuntime.armed = false;
            missionRuntime.readySince = 0;
            _updateMissionRuntimeUi();
        }
    }

    // Ohne aktive Mission keine Recorder-/Landungs-/Debrief-Logik.
    if (!missionRuntime.active) return;

    // Aktivierung: erst nach stabilem Startkandidaten (kein GPS-Spike/Spawn)
    if (!r.active) {
        const taxiStartCandidate = hasOnGroundFlag && onGroundNow && gs > 6;
        const airborneStartCandidate = hasOnGroundFlag
            ? (!onGroundNow && (gs > 20 || agl > 120))
            : (gs > 28 || agl > 220);
        const startCandidate = taxiStartCandidate || airborneStartCandidate;
        if (startCandidate) {
            if (!r.startCandidateSince) r.startCandidateSince = now;
        } else {
            r.startCandidateSince = 0;
        }

        const stableMs = taxiStartCandidate ? 1800 : 3000;
        if (r.startCandidateSince && (now - r.startCandidateSince) >= stableMs) {
            r.active = true;
            r.armed = false;
            r.startCandidateSince = 0;
            r.startTs = now;
            r.maxGs = gs;
            r.maxAltFt = alt;
            r.maxAglFt = agl;
            r.sumGs = gs;
            r.gsSamples = 1;
            r.track = [];
            r.lastSample = [lat, lon];
            r.wasOnGround = onGroundNow;
            addFlightTrackPoint(lat, lon, alt, now, true);
        }
        return;
    }

    // Reposition/Teleport erkannt (typisch nach falschem Start + neu laden): Recorder sauber verwerfen.
    if (r.lastSample && map && typeof map.distance === 'function') {
        const dM = map.distance(r.lastSample, [lat, lon]);
        const dNm = dM / 1852;
        if (dNm > 5 && gs < 40 && (hasOnGroundFlag ? onGroundNow : agl < 200)) {
            console.warn(`[FlightRec] Reposition erkannt (${dNm.toFixed(1)} NM Sprung) -> Recorder reset`);
            resetFlightRecorder();
            return;
        }
        if (Number.isFinite(dM) && dM > 0) r.distNm += (dM / 1852);
    }
    r.lastSample = [lat, lon];

    r.maxGs = Math.max(r.maxGs, gs);
    r.maxAltFt = Math.max(r.maxAltFt, Number(alt) || 0);
    r.maxAglFt = Math.max(r.maxAglFt || 0, agl);
    r.sumGs += gs;
    r.gsSamples += 1;
    const airborneNow = hasOnGroundFlag ? !onGroundNow : (agl > 180 || gs > 35);
    if (airborneNow && dtSec > 0) r.airborneEvidenceSec += dtSec;
    if (!airborneNow && r.airborneEvidenceSec > 0) r.airborneEvidenceSec = Math.max(0, r.airborneEvidenceSec - dtSec * 0.5);
    if (!r.hadAirbornePhase && (r.airborneEvidenceSec >= 8 || r.maxAglFt >= 500)) r.hadAirbornePhase = true;
    r.armed = r.hadAirbornePhase;

    if (_lfd) {
        if (Number.isFinite(_lfd.bankDeg)) r.maxBankDeg = Math.max(r.maxBankDeg, Math.abs(_lfd.bankDeg));
        if (Number.isFinite(_lfd.gForce) && _lfd.gForce > 0.1) {
            r.maxGForce = Math.max(r.maxGForce, _lfd.gForce);
            r.sumGForce += _lfd.gForce;
            r.gForceSamples += 1;
        }
    }
    if (Number.isFinite(smoothedVS)) {
        if (smoothedVS > 0) r.maxClimbFpm = Math.max(r.maxClimbFpm, smoothedVS);
        if (smoothedVS < 0) r.maxDescentFpm = Math.min(r.maxDescentFpm, smoothedVS);
    }

    addFlightTrackPoint(lat, lon, alt, now, false);

    // Touchdown-Trigger (Live-Tracker): kurze Rollmeldung bei APT-Arrival,
    // Farewell bei normalen Missionen erst mit anschließendem Deboarding.
    if (r.armed && r.hadAirbornePhase && onGroundNow && !r.wasOnGround) {
        if (Number.isFinite(_lfd?.touchdownFpm)) r.touchdownVsFpm = _lfd.touchdownFpm;
        else if (Number.isFinite(smoothedVS)) r.touchdownVsFpm = smoothedVS;
        const earlyRecord = _buildFlightRecordSnapshot(now);
        if (_hasAptArrivalRuntimePoint()) {
            if (earlyRecord) missionRuntime.arrivalFlightRecord = earlyRecord;
            if (!missionRuntime.landingRollTriggered && typeof window.triggerPaxLandingRoll === 'function') {
                missionRuntime.landingRollTriggered = true;
                window.triggerPaxLandingRoll(earlyRecord);
            }
        } else {
            const atTargetForFarewell = !_missionBushRequiresReturnHome() && _isAtMissionTarget(lat, lon, 1.2);
            if (!r.farewellTriggered && atTargetForFarewell) {
                const earlyRecord = _buildFlightRecordSnapshot(now);
                if (earlyRecord) {
                    if (_triggerPaxFarewellAndWaitForDeboard(earlyRecord, 'touchdown-farewell')) {
                        r.farewellTriggered = true;
                    }
                }
            }
        }
    }
    r.wasOnGround = onGroundNow;

    if (_missionSceneIsBushMission()) {
        _missionBushUpdateProgress(lat, lon, now);
    }

    // Missionsende / Bodenfall:
    // - am Ziel + stillstand -> Farewell sprechen, danach Deboarding/Mission schließen
    // - woanders + stillstand -> humorvoller Hinweis, mission bleibt offen
    const endReady = _missionEndReadiness(lat, lon);
    const bushGroundEndReady = _missionBushGroundEndReady(endReady);
    const runtimeGroundEndReady = _missionRuntimeGroundEndReady(endReady);
    const nextRuntimePhase = runtimeGroundEndReady ? 'end_ready' : 'active';
    if (missionRuntime.phase !== nextRuntimePhase) {
        _missionPhaseDebugPush('runtime_phase', {
            from: String(missionRuntime.phase || 'idle'),
            to: nextRuntimePhase,
            trigger: 'live-flight-tick'
        });
    }
    missionRuntime.phase = nextRuntimePhase;
    const key = `${runtimeGroundEndReady ? 'ready' : 'wait'}:${endReady.reason || ''}`;
    if (missionRuntime.endReadinessKey !== key) {
        missionRuntime.endReadinessKey = key;
        _updateMissionRuntimeUi();
    }
    if (endReady.groundStill) {
        const hasAptArrival = !!endReady.hasAptArrival;
        const dTargetNm = hasAptArrival && Number.isFinite(Number(endReady.dArrivalNm))
            ? endReady.dArrivalNm
            : endReady.dMissionNm;
        missionRuntime.pendingEndAt = 0;
        if (!runtimeGroundEndReady && r.hadAirbornePhase && (now - missionRuntime.lastOffDestAt) > 90000) {
            missionRuntime.lastOffDestAt = now;
            if (typeof window.triggerPaxOffDestinationLanding === 'function') {
                window.triggerPaxOffDestinationLanding(dTargetNm);
            }
        }
    } else {
        missionRuntime.pendingEndAt = 0;
    }

    // Landing-Detection: erst wenn der Flug wirklich "airborne" war
    if (!r.armed || !r.hadAirbornePhase) return;

    const landingCandidate = gs < 18 && agl < 140;
    if (landingCandidate) {
        if (!r.lowSpeedSince) {
            r.lowSpeedSince = now;
            if (Number.isFinite(smoothedVS)) r.touchdownVsFpm = smoothedVS;
            // Fallback-AtTarget nur in Zielnähe zulassen, damit ein Absturz/Touchdown
            // fern vom Ziel keine "4-NM-vor-Landung"-Meldung auslöst.
            const dTargetNmNear = _distanceToMissionTargetNm(lat, lon);
            const nearTargetForAtTarget = !_missionBushRequiresReturnHome() && (Number.isFinite(dTargetNmNear) ? dTargetNmNear <= 4.5 : false);
            if (nearTargetForAtTarget && typeof window.triggerPaxAtTarget === 'function') {
                window.triggerPaxAtTarget(window.lastLiveFlightData || {});
            }
        }
        if ((now - r.lowSpeedSince) >= 5000) {
            addFlightTrackPoint(lat, lon, alt, now, true);
            finalizeFlightRecorder(now, lat, lon);
        }
    } else {
        r.lowSpeedSince = 0;
    }
}

// ─── TRAFFIC AUF KARTE ────────────────────────────────────────────────────────
// Proximity-Matching: statt exaktem Key-Lookup wird der nächstgelegene
// bestehende Marker gefunden und geupdated. Damit funktioniert es auch bei
// wechselnden SimConnect-IDs (MSFS Online-Traffic) und Formationsflug.
const TRAFFIC_MATCH_DEG = 0.025; // ~2 km Matching-Schwelle

function _trafficIconHtml(hdg, relAltStr, relAltColor, callsign) {
    return `<div style="position:relative; transform:translate(-10px,-13px); pointer-events:none; text-align:center;">
        <svg class="trf-svg" viewBox="-8 -12 16 24" width="20" height="26"
             style="transform:rotate(${hdg}deg); display:block; margin:0 auto;
                    filter:drop-shadow(0 0 2px rgba(0,0,0,0.9));">
            <ellipse cx="0" cy="0"  rx="1.8" ry="10" fill="#00ccff" opacity="0.95"/>
            <ellipse cx="0" cy="-1" rx="8"   ry="1.8" fill="#00ccff" opacity="0.95"/>
            <ellipse cx="0" cy="8"  rx="4"   ry="1.2" fill="#00ccff" opacity="0.85"/>
        </svg>
        <div class="trf-alt" style="font-size:8px;font-weight:bold;color:${relAltColor};
             text-shadow:1px 1px 2px #000;line-height:1.1;white-space:nowrap;">${relAltStr}</div>
        <div style="font-size:7px;color:#aaddff;text-shadow:1px 1px 2px #000;
             line-height:1;white-space:nowrap;">${callsign}</div>
    </div>`;
}

function updateTrafficOnMap(aircraft, ownAlt) {
    if (typeof map === 'undefined' || !map || typeof L === 'undefined') return;
    if (!isMapHintOn('traffic', true) || !window.vpTrafficMapVisible) {
        Object.values(liveTrafficMarkers).forEach(t => t.marker.remove());
        liveTrafficMarkers = {};
        return;
    }

    const claimedKeys = new Set(); // Marker die in diesem Update bereits belegt wurden

    for (const ac of aircraft) {
        const relAlt = ownAlt != null ? ac.alt - ownAlt : null;
        const relAltStr = relAlt != null
            ? (relAlt >= 0 ? '+' : '') + Math.round(relAlt / 100) * 100 : '';
        const relAltColor = relAlt == null ? '#aaa'
            : Math.abs(relAlt) < 300 ? '#ff8800'
            : relAlt > 0 ? '#44ff44' : '#aaaaaa';
        const hdg = ac.hdg ?? 0;
        const callsign = ac.callsign ?? ('AI-' + String(ac.id ?? (ac.lat + ',' + ac.lon)));

        // Nächstgelegenen unbelegten Marker suchen
        let bestKey = null, bestDist = TRAFFIC_MATCH_DEG;
        for (const [key, t] of Object.entries(liveTrafficMarkers)) {
            if (claimedKeys.has(key)) continue;
            const d = Math.hypot(t.lat - ac.lat, t.lon - ac.lon);
            if (d < bestDist) { bestDist = d; bestKey = key; }
        }

        if (bestKey) {
            // Bestehenden Marker in-place aktualisieren
            claimedKeys.add(bestKey);
            liveTrafficMarkers[bestKey].lat = ac.lat;
            liveTrafficMarkers[bestKey].lon = ac.lon;
            liveTrafficMarkers[bestKey].marker.setLatLng([ac.lat, ac.lon]);
            const el = liveTrafficMarkers[bestKey].marker.getElement();
            if (el) {
                const svgEl = el.querySelector('.trf-svg');
                if (svgEl) svgEl.style.transform = `rotate(${hdg}deg)`;
                const altEl = el.querySelector('.trf-alt');
                if (altEl) { altEl.textContent = relAltStr; altEl.style.color = relAltColor; }
            }
        } else {
            // Neuen Marker erstellen
            const newKey = String(ac.id ?? (Date.now() + Math.random()));
            claimedKeys.add(newKey);
            const icon = L.divIcon({
                html: _trafficIconHtml(hdg, relAltStr, relAltColor, callsign),
                className: 'traffic-marker',
                iconSize: [0, 0],
                iconAnchor: [0, 0]
            });
            const marker = L.marker([ac.lat, ac.lon], {
                icon, interactive: false, zIndexOffset: 5000
            }).addTo(map);
            liveTrafficMarkers[newKey] = { marker, lat: ac.lat, lon: ac.lon };
        }
    }

    // Nicht beanspruchte Marker entfernen (Flieger aus der Range verschwunden)
    for (const key of Object.keys(liveTrafficMarkers)) {
        if (!claimedKeys.has(key)) {
            liveTrafficMarkers[key].marker.remove();
            delete liveTrafficMarkers[key];
        }
    }
}

window.applyTrafficVisibility = function() {
    if (!isMapHintOn('traffic', true) || !window.vpTrafficMapVisible) {
        Object.values(liveTrafficMarkers).forEach(t => t.marker.remove());
        liveTrafficMarkers = {};
        return;
    }
    if (window.vpTrafficData?.length) updateTrafficOnMap(window.vpTrafficData, window.lastLiveGpsPos?.alt);
};

window.toggleTrafficMap = function(forceState = null) {
    window.vpTrafficMapVisible = (typeof forceState === 'boolean') ? forceState : !window.vpTrafficMapVisible;
    if (window.mapHints && typeof window.mapHints === 'object') {
        window.mapHints.traffic = window.vpTrafficMapVisible;
        localStorage.setItem('ga_map_hint_traffic', String(window.vpTrafficMapVisible));
        if (typeof refreshMapHintMenuUi === 'function') refreshMapHintMenuUi();
    }
    const btn = document.getElementById('btnToggleTrafficMap');
    if (btn) btn.classList.toggle('active', window.vpTrafficMapVisible);
    window.applyTrafficVisibility();
};

// Sim-Modus: Flugzeug-Icon, Trail und Profil zurücksetzen
window.hideLivePlane = function (options = {}) {
    if (liveGpsMarker) { liveGpsMarker.remove(); liveGpsMarker = null; }
    lastAutoFollowPanAt = 0;
    lastAutoFollowPanPos = null;
    lastLivePlaneHeadingUpdateAt = 0;
    if (liveSnailTrail) { liveSnailTrail.setLatLngs([]); }
    if (liveToWpLine) { liveToWpLine.remove(); liveToWpLine = null; }
    // Prediction-Vektoren entfernen
    if (predictionLine) { predictionLine.setLatLngs([]); }
    predictionMarkers.forEach(m => { try { m.remove(); } catch(e) {} });
    predictionMarkers = [];
    // Profil zurücksetzen
    if (typeof vpUpdateLiveAircraft === 'function') vpUpdateLiveAircraft(-1, 0, 0);
    window.lastLiveGpsPos = null;
    window.lastLiveFlightData = null;
    vpProfileLockIdx = -1;
    vpProfileLockSig = '';
    lastGpsTickDetails = null;
    lastTrailPoint = null;
    resetFlightRecorder();
    if (options?.preserveMissionRuntime !== true) _resetMissionRuntime();
    hideNextWpTelemetry();
};

// Auto-Start & Login on app load
document.addEventListener('DOMContentLoaded', () => {
    _updateMissionRuntimeUi();
    initPlaneIconSettingsUi();
    // Felder aus dem bestätigten Speicher vorbefüllen
    const savedId = localStorage.getItem('ga_saved_id') || localStorage.getItem('ga_sync_id');
    const savedPin = localStorage.getItem('ga_saved_pin') || localStorage.getItem('ga_sync_pin');
    
    if (savedId) {
        const idInp = document.getElementById('syncIdInput');
        if (idInp) idInp.value = savedId;
    }
    if (savedPin) {
        const pinInp = document.getElementById('syncPinInput');
        if (pinInp) pinInp.value = savedPin;
    }

    // Falls Daten vorhanden -> Auto-Login Versuch im Hintergrund
    if (savedId && savedPin) {
        setTimeout(() => {
            console.log("[Sync] Starte Auto-Login...");
            triggerLoginFlow(true); 
        }, 800);
    }

    const currentBox = document.getElementById('liveCurrentBox');
    const nextBox = document.getElementById('liveNextWpBox');
    [currentBox, nextBox].filter(Boolean).forEach(navBox => {
        ['pointerdown', 'click', 'touchstart', 'mousedown'].forEach(evt => {
            navBox.addEventListener(evt, e => {
                if (typeof e.stopPropagation === 'function') e.stopPropagation();
            }, { passive: false });
        });
    });

    initTelemetryBoxDrag(document.getElementById('liveTelemetryBox'), 'ga_tele_pos');
    initTelemetryBoxDrag(document.getElementById('liveCurrentBox'), 'ga_current_pos');
    initTelemetryBoxDrag(document.getElementById('liveNextWpBox'), 'ga_nextwp_pos');

    buildCompassSvg();
    buildCompassFixed();
    updateCompassBottom();

    const compassWrap = document.getElementById('compassRoseWrap');
    if (compassWrap) {
        compassWrap.addEventListener('click', () => {
            compassWrap.classList.toggle('compass-minimized');
        });
    }

    // Profil-Toggle: Kompass-Position neu berechnen
    const _origToggleProfile = window.toggleMapProfile;
    if (typeof _origToggleProfile === 'function') {
        window.toggleMapProfile = function() {
            _origToggleProfile.apply(this, arguments);
            setTimeout(updateCompassBottom, 150);
        };
    }
});

function initTelemetryBoxDrag(el, storageKey) {
    if (!el) return;

    const DEFAULT_STYLES = {
        liveTelemetryBox: { top: '10px', left: '50%', transform: 'translateX(-50%)', right: 'auto' },
        liveCurrentBox:   { top: '10px', left: 'calc(50% - 230px)', transform: 'none', right: 'auto' },
        liveNextWpBox:    { top: '10px', left: 'calc(50% + 128px)', transform: 'none', right: 'auto' }
    };

    function applyPosition(top, left) {
        el.style.top = top;
        el.style.left = left;
        el.style.transform = 'none';
        el.style.right = 'auto';
    }

    function savePosition() {
        localStorage.setItem(storageKey, JSON.stringify({ top: el.style.top, left: el.style.left }));
    }

    function restorePosition() {
        const saved = localStorage.getItem(storageKey);
        if (!saved) return;
        try {
            const { top, left } = JSON.parse(saved);
            applyPosition(top, left);
            el.classList.add('tele-dragged');
        } catch(e) {}
    }

    function resetPosition() {
        localStorage.removeItem(storageKey);
        el.classList.remove('tele-dragged');
        const def = DEFAULT_STYLES[el.id];
        if (def) {
            el.style.top = def.top;
            el.style.left = def.left;
            el.style.transform = def.transform;
            el.style.right = def.right;
        }
    }

    restorePosition();

    let dragging = false, startX, startY, startTop, startLeft;

    el.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;
        e.stopPropagation();
        el.setPointerCapture(e.pointerId);
        dragging = true;
        el.classList.add('tele-dragging');
        startX = e.clientX;
        startY = e.clientY;
        startTop = el.offsetTop;
        startLeft = el.offsetLeft;
    });

    el.addEventListener('pointermove', e => {
        if (!dragging) return;
        e.stopPropagation();
        const parent = el.parentElement;
        const maxLeft = parent.offsetWidth - el.offsetWidth - 5;
        const maxTop = parent.offsetHeight - el.offsetHeight - 5;
        const newLeft = Math.max(5, Math.min(maxLeft, startLeft + (e.clientX - startX)));
        const newTop  = Math.max(5, Math.min(maxTop,  startTop  + (e.clientY - startY)));
        applyPosition(newTop + 'px', newLeft + 'px');
        el.classList.add('tele-dragged');
    });

    el.addEventListener('pointerup', e => {
        if (!dragging) return;
        dragging = false;
        el.classList.remove('tele-dragging');
        el.releasePointerCapture(e.pointerId);
        savePosition();
    });

    el.addEventListener('dblclick', e => {
        if (e.target.closest('button')) return;
        resetPosition();
    });
}
