/* === CLOUD SYNC & MULTIPLAYER FETCH LOGIC (v220) === */
/* =========================================================
   CLOUD SYNC LOGIC (Adaptive, Diffing, Debounce & Toggle)
   ========================================================= */
const SYNC_URL = 'https://ga-proxy.einherjer.workers.dev/api/sync/';
const AUTH_VERIFY_URL = 'https://ga-proxy.einherjer.workers.dev/api/auth/verify';
// Muss dem Worker-Vertrag entsprechen: /api/sync/* akzeptiert bis zu 256 KiB.
// Beide Seiten pruefen die Laenge des bereits dekodierten JSON-Strings.
const SYNC_MAX_UPLOAD_BYTES = 256 * 1024;
const SYNC_PENDING_UPLOAD_KEY = 'ga_sync_pending_upload_v1';
let localSyncTime = localStorage.getItem('ga_sync_time') ? parseInt(localStorage.getItem('ga_sync_time')) : 0;
let lastSyncedPayloadStr = "";
let activeMissionCloudSaveTimer = null;
let activeMissionCloudSavePromise = null;

function _syncReadPendingUpload() {
    try {
        const parsed = JSON.parse(localStorage.getItem(SYNC_PENDING_UPLOAD_KEY) || 'null');
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
        return null;
    }
}

function _syncMarkPendingUpload(reason = 'local-change') {
    const now = Date.now();
    const existing = _syncReadPendingUpload();
    const pilotId = String(getSyncId() || existing?.pilotId || '').trim();
    const pending = {
        version: 1,
        requestedAt: Number(existing?.requestedAt || now) || now,
        updatedAt: now,
        reason: String(reason || existing?.reason || 'local-change'),
        pilotId
    };
    try { localStorage.setItem(SYNC_PENDING_UPLOAD_KEY, JSON.stringify(pending)); } catch (_) {}
    return pending;
}

function _syncClearPendingUpload() {
    try { localStorage.removeItem(SYNC_PENDING_UPLOAD_KEY); } catch (_) {}
}

function queueActiveMissionCloudSave(reason = 'mission-state-change', options = {}) {
    _syncMarkPendingUpload(reason);
    const toggle = document.getElementById('syncToggle');
    if (!getSyncId() || (toggle && !toggle.checked)) return false;
    if (activeMissionCloudSaveTimer) clearTimeout(activeMissionCloudSaveTimer);
    const delayMs = Number.isFinite(Number(options.delayMs)) ? Math.max(0, Number(options.delayMs)) : 1200;
    activeMissionCloudSaveTimer = setTimeout(() => {
        activeMissionCloudSaveTimer = null;
        activeMissionCloudSavePromise = triggerCloudSave(true, {
            force: true,
            skipHomebase: true,
            reason
        }).finally(() => {
            activeMissionCloudSavePromise = null;
        });
    }, delayMs);
    return true;
}
window.queueActiveMissionCloudSave = queueActiveMissionCloudSave;

async function flushActiveMissionCloudSave(reason = 'mission-flush', options = {}) {
    if (activeMissionCloudSaveTimer) {
        clearTimeout(activeMissionCloudSaveTimer);
        activeMissionCloudSaveTimer = null;
    }
    if (activeMissionCloudSavePromise) {
        try { await activeMissionCloudSavePromise; } catch (_) {}
    }
    if (options.markPending !== false) _syncMarkPendingUpload(reason);
    return triggerCloudSave(true, {
        force: true,
        skipHomebase: options.skipHomebase !== false,
        reason
    });
}
window.flushActiveMissionCloudSaveForUpdate = reason => flushActiveMissionCloudSave(reason || 'app-update');

async function syncPendingUploadThenLoad(reason = 'sync-resume') {
    const pending = _syncReadPendingUpload();
    const currentPilotId = String(getSyncId() || '').trim().toLowerCase();
    const pendingPilotId = String(pending?.pilotId || '').trim().toLowerCase();
    if (pendingPilotId && currentPilotId && pendingPilotId !== currentPilotId) {
        _syncClearPendingUpload();
    } else if (pending) {
        const result = await flushActiveMissionCloudSave(reason, { markPending: false, skipHomebase: true });
        if (_syncReadPendingUpload() && result?.skipped !== true) return result;
    }
    return silentSyncLoad({ pendingHandled: true });
}
window.syncPendingUploadThenLoad = syncPendingUploadThenLoad;

(function installIdleNetworkSleep() {
    if (window.gaIdleSleep) return;
    const IDLE_SLEEP_MS = 10 * 60 * 1000;
    const CHECK_INTERVAL_MS = 15 * 1000;
    let lastActivityAt = Date.now();
    let sleeping = false;
    const wakeTasks = new Map();

    function isTrackerLive() {
        const lastTelemetryAt = Number(window.gaLastTrackerTelemetryAt || window.lastLiveGpsPos?.t || 0);
        return !!window.liveTrackerConnected && Number.isFinite(lastTelemetryAt) && (Date.now() - lastTelemetryAt) < 15000;
    }

    function dispatchSleepChange(reason) {
        try {
            window.dispatchEvent(new CustomEvent('ga-sleepchange', {
                detail: {
                    sleeping,
                    reason: String(reason || ''),
                    lastActivityAt,
                    idleMs: Math.max(0, Date.now() - lastActivityAt)
                }
            }));
        } catch (_) {}
    }

    function flushWakeTasks() {
        if (!wakeTasks.size) return;
        const tasks = Array.from(wakeTasks.entries());
        wakeTasks.clear();
        tasks.forEach(([, fn]) => {
            try { Promise.resolve().then(fn).catch(() => {}); } catch (_) {}
        });
    }

    function setSleeping(next, reason = '') {
        const shouldSleep = !!next && !isTrackerLive();
        if (sleeping === shouldSleep) return;
        sleeping = shouldSleep;
        dispatchSleepChange(reason);
        if (!sleeping) {
            setTimeout(() => {
                flushWakeTasks();
                const t = document.getElementById('syncToggle');
                if (t && t.checked && getSyncId() && typeof silentSyncLoad === 'function') {
                    try { syncPendingUploadThenLoad('idle-wake'); } catch (_) {}
                }
            }, 0);
        }
    }

    function markActivity(reason = 'activity') {
        lastActivityAt = Date.now();
        if (sleeping) setSleeping(false, reason);
    }

    function runWhenAwake(key, fn) {
        if (typeof fn !== 'function') return false;
        if (!sleeping || isTrackerLive()) {
            try { Promise.resolve().then(fn).catch(() => {}); } catch (_) {}
            return false;
        }
        wakeTasks.set(String(key || `task:${wakeTasks.size + 1}`), fn);
        return true;
    }

    function checkIdle() {
        if (isTrackerLive()) {
            if (sleeping) setSleeping(false, 'tracker-live');
            return;
        }
        if (!sleeping && Date.now() - lastActivityAt >= IDLE_SLEEP_MS) {
            setSleeping(true, 'idle-timeout');
        }
    }

    ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousedown', 'click', 'scroll'].forEach(type => {
        window.addEventListener(type, () => markActivity(type), { capture: true, passive: true });
    });
    window.addEventListener('focus', () => markActivity('focus'), { passive: true });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') markActivity('visible');
    }, { passive: true });

    setInterval(checkIdle, CHECK_INTERVAL_MS);

    window.gaIdleSleep = {
        isSleeping: () => sleeping,
        getLastActivityAt: () => lastActivityAt,
        markActivity,
        shouldPauseNetwork: () => sleeping && !isTrackerLive(),
        runWhenAwake
    };
    window.gaShouldPauseNetwork = (reason) => !!(window.gaIdleSleep && window.gaIdleSleep.shouldPauseNetwork(reason));
    window.gaRunWhenAwake = (key, fn) => window.gaIdleSleep ? window.gaIdleSleep.runWhenAwake(key, fn) : false;
})();

function saveSyncToggle() {
    const t = document.getElementById('syncToggle');
    const label = document.getElementById('autoSyncLabel');
    if (t) {
        localStorage.setItem('ga_sync_enabled', t.checked);
        if (label) label.style.color = t.checked ? '#4caf50' : '#888';
    }
    if (t && t.checked) syncPendingUploadThenLoad('sync-toggle-enabled');
}

function getSyncId() {
    return document.getElementById('syncIdInput')?.value.trim() || localStorage.getItem('ga_sync_id') || "";
}

function getSyncPin() {
    return document.getElementById('syncPinInput')?.value.trim() || localStorage.getItem('ga_sync_pin') || "";
}

function applyCanonicalSyncId(pilotId, { authenticated = false } = {}) {
    const canonicalId = String(pilotId || '').trim();
    if (!canonicalId) return '';
    const input = document.getElementById('syncIdInput');
    if (input) input.value = canonicalId;
    localStorage.setItem('ga_sync_id', canonicalId);
    if (authenticated) localStorage.setItem('ga_saved_id', canonicalId);
    return canonicalId;
}

let liveSnailTrail = null;
let lastTrailPoint = null;
let liveSnailTrailPoints = [];
let liveSnailTrailDirty = false;
let liveSnailTrailRenderedCount = 0;
let liveSnailTrailNeedsFullSync = false;
let lastLiveSnailTrailRenderAt = 0;
const LIVE_SNAIL_TRAIL_TRIM_AT = 12000;
const LIVE_SNAIL_TRAIL_KEEP_POINTS = 8000;
const LIVE_SNAIL_TRAIL_RENDER_INTERVAL_MS = 250;
const LIVE_TRAFFIC_RENDER_INTERVAL_MS = 250;
let liveTrafficRenderTimer = null;
let liveTrafficRenderPending = null;
let lastLiveTrafficRenderAt = 0;
let forceLiveMapVisualRefresh = false;
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
    aircraftLogbooks: _sceneCatalogRoleTitles('cargo.aircraft_logbook'),
    fireExtinguishers: _sceneCatalogRoleTitles('cargo.fire_extinguisher'),
    firstAidCases: _sceneCatalogRoleTitles('cargo.first_aid_case'),
    wheelChocks: _sceneCatalogRoleTitles('cargo.wheel_chocks'),
    animalTransportBoxes: _sceneCatalogRoleTitles('cargo.animal_transport_box', [
        'Cardboard',
        'Pallet01_03'
    ]),
    cameraEquipment: _sceneCatalogRoleMerge([
        'cargo.camera_equipment',
        'cargo.equipment_case',
        'cargo.luggage.duffel',
        'cargo.luggage.suitcase',
        'cargo.luggage.backpack'
    ]),
    campingEquipment: _sceneCatalogRoleTitles('cargo.camping_equipment', ['Cardboard']),
    equipmentCases: _sceneCatalogRoleTitles('cargo.equipment_case'),
    luggageBackpacks: _sceneCatalogRoleTitles('cargo.luggage.backpack'),
    luggageDuffels: _sceneCatalogRoleTitles('cargo.luggage.duffel'),
    luggageSuitcases: _sceneCatalogRoleTitles('cargo.luggage.suitcase'),
    personalLuggage: _sceneCatalogRoleMerge([
        'cargo.luggage.duffel',
        'cargo.luggage.suitcase',
        'cargo.luggage.backpack',
        'cargo.equipment_case'
    ]),
    toolboxes: _sceneCatalogRoleTitles('cargo.toolbox'),
    toolCarts: _sceneCatalogRoleTitles('cargo.tool_cart'),
    coolers: _sceneCatalogRoleTitles('cargo.cooler'),
    jerrycanPairs: _sceneCatalogRoleTitles('cargo.jerrycan_pair'),
    mailSacks: _sceneCatalogRoleTitles('cargo.mail_sack'),
    woodCrates: _sceneCatalogRoleTitles('cargo.wood_crate'),
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
    sarPersonTargets: _sceneCatalogRoleTitles('sar.person_target', [
        'mmh_HikerRescue',
        'mmh_SkierRescue',
        'mmh_ArcticRescue'
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
    airportServiceVehicles: _sceneCatalogRoleTitles('vehicle.airport_service', [
        'Fuel Truck Long 01',
        'Truck Boarding NorthAm',
        'Truck Deicing Large'
    ]),
    militaryVehicles: _sceneCatalogRoleTitles('vehicle.military', [
        'Truck Military No Cover',
        'Humvee',
        'MATV Vehicle'
    ]),
    constructionVehicles: _sceneCatalogRoleTitles('construction.vehicle', [
        'Truck Crane Small',
        'Forklift Large',
        'Forklift Medium',
        'Truck Water 02'
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
        'boat01',
        'boat02',
        'Yacht01',
        'Yacht02',
        'Yacht03',
        'Fishing Boat Red Modular',
        'Fishing Boat White Modular'
    ]),
    tinyBoats: _sceneCatalogRoleTitles('watercraft.tiny_boat', [
        'boat01',
        'boat02'
    ]),
    smallBoats: _sceneCatalogRoleTitles('watercraft.small_boat', [
        'boat01',
        'boat02',
        'Yacht01',
        'Yacht02',
        'Yacht03',
        'Fishing Boat Red Modular',
        'Fishing Boat White Modular'
    ]),
    fishingShips: _sceneCatalogRoleTitles('watercraft.fishing_ship', [
        'FishingShip02',
        'FishingShip03'
    ]),
    serviceShips: _sceneCatalogRoleTitles('watercraft.service_ship', [
        'Microsoft_Ships_AbeilleBourbon_1.0'
    ]),
    largeShips: _sceneCatalogRoleTitles('watercraft.large_ship', [
        'CargoShip01',
        'CruiseShip01'
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
    campLanterns: _sceneCatalogRoleTitles('scene.lighting.lantern'),
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
    constructionMaterials: _sceneCatalogRoleTitles('construction.material', [
        'BuildingMaterial01',
        'RooftopUnits03',
        'GeneracPowerSystems01',
        'Pallet01_02',
        'Pallet01_03'
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
    ]),
    aircraftWreck: _sceneCatalogRoleTitles('aircraft.wreck', [
        'Cessna 172 Skyhawk (G1000)',
        'Cessna 172 Skyhawk',
        'Cessna Skyhawk G1000 Asobo',
        'Cessna Skyhawk Asobo',
        'Savage Cub Asobo',
        'VL3 Asobo',
        'Pipistrel Virus SW121 Asobo',
        'DA40-NG Asobo'
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
let livePredictionGeneration = 0;
let smoothedGS = 0;
let smoothedVS = 0;
let liveToWpLine = null;
let vpProfileLockIdx = -1;
let vpProfileLockSig = '';
const MAP_AUTOZOOM_LOOKAHEAD_KEY = 'ga_map_autozoom_lookahead_min';
const MAP_AUTOZOOM_DEFAULT_LOOKAHEAD_MIN = 8;
const MAP_AUTOZOOM_MIN_LOOKAHEAD_MIN = 2;
const MAP_AUTOZOOM_MAX_LOOKAHEAD_MIN = 25;
const MAP_AUTOZOOM_MIN_ZOOM = 8;
const MAP_AUTOZOOM_MAX_ZOOM = 18;
const MAP_AUTOZOOM_ZOOM_SNAP = 0.01;
const MAP_AUTOZOOM_TARGET_CHANGE_DELTA = 0.08;
const MAP_AUTOZOOM_MIN_STEP = 0.02;
const MAP_AUTOZOOM_MIN_APPLY_DELTA = 0.015;
const MAP_AUTOZOOM_SMOOTH_INTERVAL_MS = 300;
const MAP_AUTOZOOM_SMOOTH_LOW_FPS_INTERVAL_MS = 650;
const MAP_AUTOZOOM_SMOOTH_DURATION_S = 0.42;
const MAP_AUTOZOOM_SMOOTH_LOW_FPS_DURATION_S = 0.75;
const MAP_AUTOZOOM_SMOOTH_MAX_STEP = 0.22;
const MAP_AUTOZOOM_SMOOTH_LOW_FPS_MAX_STEP = 0.16;
const MAP_AUTOZOOM_SMOOTH_STEP_FRACTION = 0.28;
const MAP_AUTOZOOM_SMOOTH_LOW_FPS_STEP_FRACTION = 0.2;
const MAP_AUTOZOOM_TARGET_APPROACH_MIN = 5;
const MAP_AUTOZOOM_POI_APPROACH_ZOOM = 13.4;
const MAP_AUTOZOOM_WAYPOINT_APPROACH_ZOOM = 12.5;
const MAP_AUTOZOOM_TARGET_APPROACH_CENTER_TARGET_WEIGHT = 1 / 3;
const MAP_AUTOZOOM_POI_FOCUS_RELEASE_PROGRESS = 0.5;
const MAP_AUTOZOOM_SPEED_STAGES = [
    { max: 18, zoom: 15, label: 'Boden' },
    { max: 60, zoom: 14, label: 'Langsam/niedrig' },
    { max: 95, zoom: 13, label: 'Abflug/Anflug' },
    { max: 130, zoom: 12, label: 'Route' },
    { max: 170, zoom: 11, label: 'Reise' },
    { max: Infinity, zoom: 10, label: 'Schnell/hoch' }
];
const MAP_AUTOZOOM_ALTITUDE_STAGES = [
    { max: 250, zoom: 15, label: 'Boden' },
    { max: 1500, zoom: 14, label: 'Langsam/niedrig' },
    { max: 3000, zoom: 13, label: 'Abflug/Anflug' },
    { max: 5500, zoom: 12, label: 'Route' },
    { max: 9000, zoom: 11, label: 'Reise' },
    { max: Infinity, zoom: 10, label: 'Schnell/hoch' }
];
let lastMapAutoZoomAppliedAt = 0;
let lastMapAutoZoomTargetZoom = null;
let lastMapAutoZoomSample = null;
let mapAutoFollowProgrammaticMoveUntil = 0;
let autoFollowMapInteractionBound = false;
let mapAutoZoomFractionalZoomConfigured = false;
let mapAutoZoomManualHoldZoom = null;
let mapAutoZoomManualHoldTargetZoom = null;
let mapAutoZoomManualHoldPhase = '';
let mapAutoZoomUserZoomIntentUntil = 0;
let mapAutoZoomPoiFocusLock = null;
let mapAutoZoomSmoothTimer = null;

function _clampMapAutoZoomNumber(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
}

function quantizeMapAutoZoom(zoom) {
    const n = Number(zoom);
    if (!Number.isFinite(n)) return n;
    return Math.round(n / MAP_AUTOZOOM_ZOOM_SNAP) * MAP_AUTOZOOM_ZOOM_SNAP;
}

function clampAutoZoomToRange(zoom, minZoom, maxZoom) {
    let min = Number.isFinite(Number(minZoom)) ? Number(minZoom) : MAP_AUTOZOOM_MIN_ZOOM;
    let max = Number.isFinite(Number(maxZoom)) ? Number(maxZoom) : MAP_AUTOZOOM_MAX_ZOOM;
    if (max < min) max = min;
    return quantizeMapAutoZoom(_clampMapAutoZoomNumber(zoom, min, max));
}

function sanitizeMapAutoZoomVisibilityCap(zoom) {
    const n = Number(zoom);
    if (!Number.isFinite(n)) return null;
    const q = quantizeMapAutoZoom(n);
    if (q < MAP_AUTOZOOM_MIN_ZOOM) return null;
    return Math.min(MAP_AUTOZOOM_MAX_ZOOM, q);
}

function normalizeMapAutoZoomLookaheadMinutes(value) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return MAP_AUTOZOOM_DEFAULT_LOOKAHEAD_MIN;
    return Math.round(_clampMapAutoZoomNumber(n, MAP_AUTOZOOM_MIN_LOOKAHEAD_MIN, MAP_AUTOZOOM_MAX_LOOKAHEAD_MIN));
}

window.getMapAutoZoomLookaheadMinutes = function() {
    return normalizeMapAutoZoomLookaheadMinutes(localStorage.getItem(MAP_AUTOZOOM_LOOKAHEAD_KEY));
};

window.setMapAutoZoomLookaheadMinutes = function(value, options = {}) {
    const lookaheadMin = normalizeMapAutoZoomLookaheadMinutes(value);
    if (options.persist !== false) {
        localStorage.setItem(MAP_AUTOZOOM_LOOKAHEAD_KEY, String(lookaheadMin));
    }
    lastMapAutoZoomAppliedAt = 0;
    lastMapAutoZoomTargetZoom = null;
    if (typeof window.refreshMapAutoZoomUi === 'function') window.refreshMapAutoZoomUi();
    return lookaheadMin;
};

window.getMapAutoZoomStrength = window.getMapAutoZoomLookaheadMinutes;
window.setMapAutoZoomStrength = window.setMapAutoZoomLookaheadMinutes;

function isMapAutoZoomEnabled() {
    if (typeof window.isMapHintEnabled === 'function') return window.isMapHintEnabled('autoZoom');
    return localStorage.getItem('ga_map_hint_autoZoom') === 'true';
}

function getMapAutoZoomAglFt(altFt) {
    const fd = window.lastLiveFlightData || {};
    const rawAgl = Number(fd.aglFt ?? fd.agl ?? fd.heightAboveGroundFt ?? fd.radioAltFt);
    if (Number.isFinite(rawAgl)) return Math.max(0, rawAgl);

    const terrainFt = Number(window.lastLiveTerrainFt);
    const mslFt = Number(altFt);
    if (Number.isFinite(mslFt) && Number.isFinite(terrainFt) && terrainFt > 0) {
        return Math.max(0, mslFt - terrainFt);
    }
    return null;
}

function clampAutoZoomForMap(zoom, options = {}) {
    let minZoom = MAP_AUTOZOOM_MIN_ZOOM;
    let maxZoom = MAP_AUTOZOOM_MAX_ZOOM;
    const respectMapMax = options.respectMapMax === true;
    if (typeof map !== 'undefined' && map) {
        const mapMin = Number(typeof map.getMinZoom === 'function' ? map.getMinZoom() : NaN);
        const mapMax = Number(typeof map.getMaxZoom === 'function' ? map.getMaxZoom() : NaN);
        if (Number.isFinite(mapMin)) minZoom = Math.max(minZoom, mapMin);
        if (respectMapMax && Number.isFinite(mapMax) && mapMax > minZoom) maxZoom = Math.min(maxZoom, mapMax);
    }
    if (minZoom > maxZoom) minZoom = maxZoom;
    return clampAutoZoomToRange(zoom, minZoom, maxZoom);
}

function ensureMapAutoZoomFractionalZoom() {
    if (mapAutoZoomFractionalZoomConfigured) return;
    if (typeof map === 'undefined' || !map || !map.options) return;
    map.options.zoomSnap = Math.min(Number(map.options.zoomSnap) || 1, MAP_AUTOZOOM_ZOOM_SNAP);
    map.options.zoomDelta = Math.min(Number(map.options.zoomDelta) || 1, 0.25);
    const currentMaxZoom = Number(map.options.maxZoom);
    if (!Number.isFinite(currentMaxZoom) || currentMaxZoom < MAP_AUTOZOOM_MAX_ZOOM) {
        map.options.maxZoom = MAP_AUTOZOOM_MAX_ZOOM;
    }
    mapAutoZoomFractionalZoomConfigured = true;
}

function clearMapAutoZoomSmoothTimer() {
    if (!mapAutoZoomSmoothTimer) return;
    try { clearTimeout(mapAutoZoomSmoothTimer); } catch (_) {}
    mapAutoZoomSmoothTimer = null;
}

function getMapAutoZoomSmoothIntervalMs(lowFpsMode) {
    return lowFpsMode ? MAP_AUTOZOOM_SMOOTH_LOW_FPS_INTERVAL_MS : MAP_AUTOZOOM_SMOOTH_INTERVAL_MS;
}

function getMapAutoZoomSmoothDurationS(lowFpsMode) {
    return lowFpsMode ? MAP_AUTOZOOM_SMOOTH_LOW_FPS_DURATION_S : MAP_AUTOZOOM_SMOOTH_DURATION_S;
}

function computeMapAutoZoomSmoothStep(zoomDelta, lowFpsMode) {
    const delta = Math.max(0, Number(zoomDelta) || 0);
    if (delta <= 0) return 0;
    const fraction = lowFpsMode ? MAP_AUTOZOOM_SMOOTH_LOW_FPS_STEP_FRACTION : MAP_AUTOZOOM_SMOOTH_STEP_FRACTION;
    const maxStep = lowFpsMode ? MAP_AUTOZOOM_SMOOTH_LOW_FPS_MAX_STEP : MAP_AUTOZOOM_SMOOTH_MAX_STEP;
    const minStep = Math.min(delta, MAP_AUTOZOOM_MIN_STEP);
    return Math.min(delta, Math.min(maxStep, Math.max(minStep, delta * fraction)));
}

function _mapAutoZoomStageForValue(value, stages) {
    const n = Number(value);
    const safeValue = Number.isFinite(n) ? Math.max(0, n) : 0;
    return stages.find(stage => safeValue < stage.max) || stages[stages.length - 1];
}

function _mapAutoZoomPhaseForZoom(zoom) {
    if (zoom >= 15) return 'Boden';
    if (zoom >= 14) return 'Langsam/niedrig';
    if (zoom >= 13) return 'Abflug/Anflug';
    if (zoom >= 12) return 'Route';
    if (zoom >= 11) return 'Reise';
    return 'Schnell/hoch';
}

function _mapAutoZoomSmoothstep(value) {
    const t = _clampMapAutoZoomNumber(value, 0, 1);
    return t * t * (3 - 2 * t);
}

function _mapAutoZoomLerp(a, b, t) {
    return a + (b - a) * _clampMapAutoZoomNumber(t, 0, 1);
}

function getMapAutoZoomPlanReference() {
    const tas = Number(document.getElementById('tasSlider')?.value);
    const mapAlt = Number(document.getElementById('altMapInput')?.textContent);
    const sliderAlt = Number(document.getElementById('altSlider')?.value);
    const cruiseAlt = Number.isFinite(mapAlt) ? mapAlt : sliderAlt;
    return {
        tasKts: Number.isFinite(tas) ? _clampMapAutoZoomNumber(tas, 80, 300) : 115,
        cruiseAltFt: Number.isFinite(cruiseAlt) ? Math.max(1000, cruiseAlt) : 4500
    };
}

function _mapAutoZoomPointAt(lat, lon, distNm, bearingDeg) {
    if (typeof getDestinationPoint === 'function') {
        try { return getDestinationPoint(lat, lon, distNm, bearingDeg); } catch (_) {}
    }
    const rNm = 3440.065;
    const lat1 = lat * Math.PI / 180;
    const lon1 = lon * Math.PI / 180;
    const brng = bearingDeg * Math.PI / 180;
    const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(distNm / rNm)
        + Math.cos(lat1) * Math.sin(distNm / rNm) * Math.cos(brng)
    );
    const lon2 = lon1 + Math.atan2(
        Math.sin(brng) * Math.sin(distNm / rNm) * Math.cos(lat1),
        Math.cos(distNm / rNm) - Math.sin(lat1) * Math.sin(lat2)
    );
    return { lat: lat2 * 180 / Math.PI, lon: lon2 * 180 / Math.PI };
}

function _mapAutoZoomWaypointTarget(idx, lat, lon, options = {}) {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return null;
    if (typeof calcNav !== 'function') return null;
    const wpIdx = typeof clampLiveWpIndex === 'function' ? clampLiveWpIndex(idx) : Number(idx);
    if (!Number.isFinite(wpIdx)) return null;
    const wp = routeWaypoints[wpIdx];
    const wpLon = wp?.lng ?? wp?.lon;
    if (!wp || !Number.isFinite(Number(wp.lat)) || !Number.isFinite(Number(wpLon))) return null;
    let nav = null;
    try { nav = calcNav(lat, lon, Number(wp.lat), Number(wpLon)); } catch (_) {}
    const distNm = Number(nav?.dist);
    const brng = Number(nav?.brng);
    return {
        lat: Number(wp.lat),
        lon: Number(wpLon),
        distNm: Number.isFinite(distNm) ? distNm : null,
        brng: Number.isFinite(brng) ? brng : null,
        idx: wpIdx,
        name: typeof getWpDisplayName === 'function' ? getWpDisplayName(wpIdx) : (wp.name || `WP ${wpIdx}`),
        isPoi: wp.isPOI === true || String(wp.icao || '').toUpperCase() === 'POI',
        focusLocked: options.focusLocked === true,
        focusLockRawIdx: Number.isFinite(Number(options.rawIdx)) ? Number(options.rawIdx) : null,
        focusLockEtaMin: Number.isFinite(Number(options.etaMin)) ? Number(options.etaMin) : null,
        focusLockProgress: Number.isFinite(Number(options.progress)) ? Number(options.progress) : null
    };
}

function _mapAutoZoomRouteTarget(lat, lon) {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return null;
    const autoWpIdx = typeof clampLiveWpIndex === 'function'
        ? clampLiveWpIndex((Number.isFinite(Number(liveNextLegIndex)) ? liveNextLegIndex : 0) + 1)
        : 1;
    const wpIdx = liveActiveWpIndex == null
        ? autoWpIdx
        : (typeof clampLiveWpIndex === 'function' ? clampLiveWpIndex(liveActiveWpIndex) : liveActiveWpIndex);
    return _mapAutoZoomWaypointTarget(wpIdx, lat, lon);
}

function _mapAutoZoomRouteKeySnapshot() {
    if (typeof routeKeyForLiveNav === 'function') {
        try { return routeKeyForLiveNav(); } catch (_) {}
    }
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints)) return '';
    return routeWaypoints.map((wp, i) => {
        const wpLon = wp?.lng ?? wp?.lon ?? 0;
        return `${i}:${Number(wp?.lat || 0).toFixed(4)},${Number(wpLon || 0).toFixed(4)}`;
    }).join('|');
}

function _mapAutoZoomSegmentProgress(fromPoint, toPoint, point) {
    const fromLat = Number(fromPoint?.lat);
    const fromLon = Number(fromPoint?.lon ?? fromPoint?.lng);
    const toLat = Number(toPoint?.lat);
    const toLon = Number(toPoint?.lon ?? toPoint?.lng);
    const pointLat = Number(point?.lat);
    const pointLon = Number(point?.lon ?? point?.lng);
    if (!Number.isFinite(fromLat) || !Number.isFinite(fromLon)
        || !Number.isFinite(toLat) || !Number.isFinite(toLon)
        || !Number.isFinite(pointLat) || !Number.isFinite(pointLon)) return null;
    const refLat = (fromLat + toLat + pointLat) / 3;
    const cosRef = Math.cos(refLat * Math.PI / 180);
    const ax = fromLon * cosRef * 60;
    const ay = fromLat * 60;
    const bx = toLon * cosRef * 60;
    const by = toLat * 60;
    const px = pointLon * cosRef * 60;
    const py = pointLat * 60;
    const abx = bx - ax;
    const aby = by - ay;
    const denom = abx * abx + aby * aby;
    if (denom <= 0.000001) return null;
    return _clampMapAutoZoomNumber(((px - ax) * abx + (py - ay) * aby) / denom, 0, 1);
}

function _mapAutoZoomRefreshPoiFocusLock(routeTarget, routeKey) {
    if (!routeTarget?.isPoi || !Number.isFinite(Number(routeTarget.idx))) return;
    mapAutoZoomPoiFocusLock = {
        idx: Number(routeTarget.idx),
        lat: Number(routeTarget.lat),
        lon: Number(routeTarget.lon),
        name: routeTarget.name,
        routeKey,
        acquiredAt: Date.now()
    };
}

function _mapAutoZoomResolveFocusTarget(lat, lon, rawRouteTarget, gsKts) {
    if (!rawRouteTarget) {
        mapAutoZoomPoiFocusLock = null;
        return null;
    }
    const routeKey = _mapAutoZoomRouteKeySnapshot();
    if (mapAutoZoomPoiFocusLock?.routeKey && routeKey && mapAutoZoomPoiFocusLock.routeKey !== routeKey) {
        mapAutoZoomPoiFocusLock = null;
    }
    if (rawRouteTarget.isPoi) {
        _mapAutoZoomRefreshPoiFocusLock(rawRouteTarget, routeKey);
        return rawRouteTarget;
    }
    if (typeof liveActiveWpIndex !== 'undefined' && liveActiveWpIndex != null) {
        mapAutoZoomPoiFocusLock = null;
        return rawRouteTarget;
    }
    const lock = mapAutoZoomPoiFocusLock;
    if (!lock || !Number.isFinite(Number(lock.idx))) return rawRouteTarget;

    const rawIdx = Number(rawRouteTarget.idx);
    if (!Number.isFinite(rawIdx) || rawIdx <= Number(lock.idx)) {
        mapAutoZoomPoiFocusLock = null;
        return rawRouteTarget;
    }

    const aircraftPoint = { lat: Number(lat), lon: Number(lon) };
    const poiPoint = { lat: Number(lock.lat), lon: Number(lock.lon) };
    const progress = _mapAutoZoomSegmentProgress(poiPoint, rawRouteTarget, aircraftPoint);
    const poiTarget = _mapAutoZoomWaypointTarget(lock.idx, lat, lon, {
        focusLocked: true,
        rawIdx,
        progress
    }) || {
        ...poiPoint,
        idx: lock.idx,
        name: lock.name || `WP ${lock.idx}`,
        isPoi: true,
        focusLocked: true,
        focusLockRawIdx: rawIdx,
        focusLockProgress: progress
    };
    const distNm = Number(poiTarget.distNm);
    const gs = Number(gsKts);
    const etaAwayMin = Number.isFinite(distNm) && Number.isFinite(gs) && gs > 5
        ? (distNm / Math.max(gs, 1)) * 60
        : null;
    poiTarget.focusLockEtaMin = Number.isFinite(etaAwayMin) ? etaAwayMin : null;
    poiTarget.focusLockProgress = Number.isFinite(progress) ? progress : null;

    const releaseByEta = Number.isFinite(etaAwayMin) && etaAwayMin >= MAP_AUTOZOOM_TARGET_APPROACH_MIN;
    const releaseByProgress = Number.isFinite(progress) && progress >= MAP_AUTOZOOM_POI_FOCUS_RELEASE_PROGRESS;
    if (releaseByEta || releaseByProgress) {
        mapAutoZoomPoiFocusLock = null;
        return {
            ...rawRouteTarget,
            focusLockReleased: releaseByEta ? 'eta' : 'progress',
            focusLockReleasedEtaMin: Number.isFinite(etaAwayMin) ? etaAwayMin : null,
            focusLockReleasedProgress: Number.isFinite(progress) ? progress : null
        };
    }
    return poiTarget;
}

function _mapAutoZoomRouteStart(lat, lon) {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 1) return null;
    if (typeof calcNav !== 'function') return null;
    const wp = routeWaypoints[0];
    const wpLon = wp?.lng ?? wp?.lon;
    if (!wp || !Number.isFinite(Number(wp.lat)) || !Number.isFinite(Number(wpLon))) return null;
    let nav = null;
    try { nav = calcNav(lat, lon, Number(wp.lat), Number(wpLon)); } catch (_) {}
    const distNm = Number(nav?.dist);
    return {
        lat: Number(wp.lat),
        lon: Number(wpLon),
        distNm: Number.isFinite(distNm) ? distNm : null,
        name: typeof getWpDisplayName === 'function' ? getWpDisplayName(0) : (wp.name || 'Start')
    };
}

function _mapAutoZoomZoomForRadius(lat, lon, radiusNm, paddingPx = 90) {
    if (typeof L === 'undefined' || typeof map === 'undefined' || !map || typeof map.getBoundsZoom !== 'function') {
        const safeRadius = Math.max(0.15, Number(radiusNm) || 1);
        return clampAutoZoomForMap(15 - Math.log2(safeRadius));
    }
    const radius = Math.max(0.12, Number(radiusNm) || 0.5);
    const points = [
        [lat, lon],
        _mapAutoZoomPointAt(lat, lon, radius, 0),
        _mapAutoZoomPointAt(lat, lon, radius, 90),
        _mapAutoZoomPointAt(lat, lon, radius, 180),
        _mapAutoZoomPointAt(lat, lon, radius, 270)
    ].map(p => Array.isArray(p) ? p : [p.lat, p.lon]);
    try {
        const bounds = L.latLngBounds(points);
        const padding = typeof L.point === 'function' ? L.point(paddingPx, paddingPx) : [paddingPx, paddingPx];
        return quantizeMapAutoZoom(map.getBoundsZoom(bounds, false, padding));
    } catch (_) {
        const safeRadius = Math.max(0.15, Number(radiusNm) || 1);
        return clampAutoZoomForMap(15 - Math.log2(safeRadius));
    }
}

function _mapAutoZoomZoomForPoints(points, paddingPx = 110) {
    if (typeof L === 'undefined' || typeof map === 'undefined' || !map || typeof map.getBoundsZoom !== 'function') return null;
    const validPoints = (Array.isArray(points) ? points : [])
        .map(p => Array.isArray(p) ? p : [p?.lat, p?.lon])
        .filter(p => Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
        .map(p => [Number(p[0]), Number(p[1])]);
    if (validPoints.length < 2) return null;
    try {
        const bounds = L.latLngBounds(validPoints);
        const padding = typeof L.point === 'function' ? L.point(paddingPx, paddingPx) : [paddingPx, paddingPx];
        return quantizeMapAutoZoom(map.getBoundsZoom(bounds, false, padding));
    } catch (_) {
        return null;
    }
}

function _mapAutoZoomZoomForPointsAroundCenter(points, center, paddingPx = 110) {
    const centerLat = Number(center?.lat ?? (Array.isArray(center) ? center[0] : NaN));
    const centerLon = Number(center?.lon ?? center?.lng ?? (Array.isArray(center) ? center[1] : NaN));
    if (!Number.isFinite(centerLat) || !Number.isFinite(centerLon)) return _mapAutoZoomZoomForPoints(points, paddingPx);
    const validPoints = (Array.isArray(points) ? points : [])
        .map(p => Array.isArray(p) ? p : [p?.lat, p?.lon])
        .filter(p => Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])))
        .map(p => [Number(p[0]), Number(p[1])]);
    if (validPoints.length < 2) return null;
    const centeredPoints = [[centerLat, centerLon]];
    validPoints.forEach(p => {
        centeredPoints.push(p);
        centeredPoints.push([centerLat * 2 - p[0], centerLon * 2 - p[1]]);
    });
    return _mapAutoZoomZoomForPoints(centeredPoints, paddingPx);
}

function _mapAutoZoomWeightedCenterBetweenPoints(fromPoint, toPoint, toWeight) {
    const fromLat = Number(fromPoint?.lat ?? (Array.isArray(fromPoint) ? fromPoint[0] : NaN));
    const fromLon = Number(fromPoint?.lon ?? fromPoint?.lng ?? (Array.isArray(fromPoint) ? fromPoint[1] : NaN));
    const toLat = Number(toPoint?.lat ?? (Array.isArray(toPoint) ? toPoint[0] : NaN));
    const toLon = Number(toPoint?.lon ?? toPoint?.lng ?? (Array.isArray(toPoint) ? toPoint[1] : NaN));
    if (!Number.isFinite(fromLat) || !Number.isFinite(fromLon) || !Number.isFinite(toLat) || !Number.isFinite(toLon)) return null;
    const t = _clampMapAutoZoomNumber(toWeight, 0, 1);
    return {
        lat: fromLat + (toLat - fromLat) * t,
        lon: fromLon + (toLon - fromLon) * t
    };
}

function computeMapAutoZoomTargetZoom(lat, lon, gsKts, altFt, hdgDeg = null) {
    const gs = _clampMapAutoZoomNumber(gsKts, 0, 240);
    const fd = window.lastLiveFlightData || {};
    const onGround = fd.onGround === true || fd.simOnGround === true || Number(fd.simOnGround) === 1;
    const aglFt = getMapAutoZoomAglFt(altFt);
    const mslFt = Number(altFt);
    const altitudeRefFt = Number.isFinite(aglFt)
        ? aglFt
        : (Number.isFinite(mslFt) ? Math.max(0, mslFt) : 0);
    const hasAglReference = Number.isFinite(aglFt);
    const speedStage = _mapAutoZoomStageForValue(gs, MAP_AUTOZOOM_SPEED_STAGES);
    const altitudeStage = _mapAutoZoomStageForValue(altitudeRefFt, MAP_AUTOZOOM_ALTITUDE_STAGES);
    const grounded = onGround || gs < 8 || (hasAglReference && gs < 18 && altitudeRefFt < 250) || (!hasAglReference && gs < 18);
    const planRef = getMapAutoZoomPlanReference();
    const lookaheadMin = window.getMapAutoZoomLookaheadMinutes();
    const plannedLookaheadNm = Math.max(2, planRef.tasKts * (lookaheadMin / 60));
    const cruiseSpeedT = _mapAutoZoomSmoothstep(gs / Math.max(60, planRef.tasKts));
    const cruiseAltT = _mapAutoZoomSmoothstep(altitudeRefFt / Math.max(1000, planRef.cruiseAltFt));
    const cruiseProgress = _clampMapAutoZoomNumber(cruiseSpeedT * 0.58 + cruiseAltT * 0.42, 0, 1);
    const cruiseLookaheadCapNm = _mapAutoZoomLerp(Math.max(2.5, plannedLookaheadNm * 0.55), plannedLookaheadNm, cruiseProgress);
    const rawRouteTarget = Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) ? _mapAutoZoomRouteTarget(Number(lat), Number(lon)) : null;
    const routeTarget = Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))
        ? _mapAutoZoomResolveFocusTarget(Number(lat), Number(lon), rawRouteTarget, gs)
        : null;
    const routeStart = Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) ? _mapAutoZoomRouteStart(Number(lat), Number(lon)) : null;
    const routeDistNm = Number(routeTarget?.distNm);
    const startDistNm = Number(routeStart?.distNm);
    const hdg = Number.isFinite(Number(hdgDeg)) ? Number(hdgDeg)
        : (Number.isFinite(Number(routeTarget?.brng)) ? Number(routeTarget.brng) : null);
    const lookaheadNm = _clampMapAutoZoomNumber(gs * (lookaheadMin / 60), 0.35, Math.max(0.35, cruiseLookaheadCapNm));
    const routeEtaMin = Number.isFinite(routeDistNm) && gs > 5
        ? (routeDistNm / Math.max(gs, 1)) * 60
        : null;
    const targetApproachLeadNm = Math.max(0.8, gs * (MAP_AUTOZOOM_TARGET_APPROACH_MIN / 60));
    const targetApproachActive = Number.isFinite(routeEtaMin)
        ? routeEtaMin <= MAP_AUTOZOOM_TARGET_APPROACH_MIN
        : (Number.isFinite(routeDistNm) && routeDistNm <= targetApproachLeadNm);
    const departureT = Number.isFinite(startDistNm) ? _mapAutoZoomSmoothstep((startDistNm - 2) / 14) : cruiseProgress;
    const departureLookaheadNm = _mapAutoZoomLerp(3.8, Math.max(lookaheadNm, cruiseLookaheadCapNm), departureT);
    const routeLastIdx = (typeof routeWaypoints !== 'undefined' && Array.isArray(routeWaypoints) && routeWaypoints.length > 0)
        ? routeWaypoints.length - 1
        : null;
    const routeTargetIsFinal = routeLastIdx !== null
        && Number.isFinite(Number(routeTarget?.idx))
        && Number(routeTarget.idx) === routeLastIdx;
    const nearDeparture = !Number.isFinite(startDistNm) || startDistNm <= 4.5;
    const nearArrival = routeTargetIsFinal && Number.isFinite(routeDistNm) && routeDistNm <= 6.5;
    const nearPatternAirport = nearDeparture || nearArrival;
    const patternCandidate = nearArrival || ((altitudeRefFt < 1800 || gs < 75) && nearPatternAirport);

    let phase = 'Strecke';
    let requiredRadiusNm = Math.max(2, lookaheadNm);
    let minModeZoom = MAP_AUTOZOOM_MIN_ZOOM;
    let maxModeZoom = 14.25;
    let targetVisibilityMaxZoom = null;
    const routeTargetPoint = routeTarget ? { lat: routeTarget.lat, lon: routeTarget.lon } : null;
    const aircraftPoint = { lat: Number(lat), lon: Number(lon) };
    const targetApproachViewCenter = targetApproachActive && routeTargetPoint
        ? _mapAutoZoomWeightedCenterBetweenPoints(
            aircraftPoint,
            routeTargetPoint,
            MAP_AUTOZOOM_TARGET_APPROACH_CENTER_TARGET_WEIGHT
        )
        : null;

    if (grounded) {
        phase = 'Taxi';
        requiredRadiusNm = 0.28;
        minModeZoom = 17;
        maxModeZoom = MAP_AUTOZOOM_MAX_ZOOM;
    } else if (routeTarget?.isPoi && targetApproachActive) {
        phase = 'POI';
        requiredRadiusNm = Math.max(1.1, Math.min(8, routeDistNm + 0.9));
        minModeZoom = MAP_AUTOZOOM_POI_APPROACH_ZOOM;
        maxModeZoom = MAP_AUTOZOOM_POI_APPROACH_ZOOM;
        targetVisibilityMaxZoom = _mapAutoZoomZoomForPointsAroundCenter(
            [[lat, lon], [routeTarget.lat, routeTarget.lon]],
            targetApproachViewCenter || aircraftPoint,
            120
        );
    } else if (patternCandidate) {
        phase = 'Platzrunde';
        const lowAltT = _mapAutoZoomSmoothstep(altitudeRefFt / 1800);
        requiredRadiusNm = _mapAutoZoomLerp(1.4, 4.8, lowAltT);
        if (Number.isFinite(routeDistNm) && routeDistNm <= 6.5) requiredRadiusNm = Math.max(requiredRadiusNm, routeDistNm + 0.6);
        minModeZoom = 12.4;
        maxModeZoom = 12.4;
    } else if (altitudeRefFt < 2200 || gs < 85) {
        phase = 'Abflug';
        const lowAltT = _mapAutoZoomSmoothstep(altitudeRefFt / 2200);
        const localRadiusNm = _mapAutoZoomLerp(3.8, 6.2, lowAltT);
        requiredRadiusNm = Math.max(localRadiusNm, departureLookaheadNm);
        if (Number.isFinite(routeDistNm) && routeDistNm <= Math.max(8, lookaheadNm * 1.05)) {
            requiredRadiusNm = Math.max(requiredRadiusNm, routeDistNm + 1.0);
            targetVisibilityMaxZoom = _mapAutoZoomZoomForPointsAroundCenter(
                [[lat, lon], [routeTarget.lat, routeTarget.lon]],
                aircraftPoint,
                115
            );
        }
        requiredRadiusNm = _clampMapAutoZoomNumber(requiredRadiusNm, 3.8, 45);
        minModeZoom = 10.75;
        maxModeZoom = _mapAutoZoomLerp(15.5, 13.25, departureT);
    } else if (Number.isFinite(routeDistNm) && targetApproachActive) {
        phase = routeTarget?.isPoi ? 'POI' : 'Wegpunkt';
        requiredRadiusNm = Math.max(1.1, Math.min(8, routeDistNm + 0.9));
        const approachZoom = routeTarget?.isPoi
            ? MAP_AUTOZOOM_POI_APPROACH_ZOOM
            : MAP_AUTOZOOM_WAYPOINT_APPROACH_ZOOM;
        minModeZoom = approachZoom;
        maxModeZoom = approachZoom;
        targetVisibilityMaxZoom = _mapAutoZoomZoomForPointsAroundCenter(
            [[lat, lon], [routeTarget.lat, routeTarget.lon]],
            targetApproachViewCenter || aircraftPoint,
            115
        );
    } else {
        if (Number.isFinite(routeDistNm) && routeDistNm <= Math.max(8, lookaheadNm * 1.15)) {
            requiredRadiusNm = Math.max(requiredRadiusNm, routeDistNm + 1.2);
            targetVisibilityMaxZoom = _mapAutoZoomZoomForPointsAroundCenter(
                [[lat, lon], [routeTarget.lat, routeTarget.lon]],
                aircraftPoint,
                110
            );
        }
        requiredRadiusNm = Math.max(requiredRadiusNm, departureLookaheadNm);
        requiredRadiusNm = _clampMapAutoZoomNumber(requiredRadiusNm, 2.2, 85);
    }

    const targetViewCenter = targetApproachViewCenter;
    const radiusZoom = _mapAutoZoomZoomForRadius(Number(lat), Number(lon), requiredRadiusNm, phase === 'Taxi' ? 70 : 95);
    const usableVisibilityCapZoom = sanitizeMapAutoZoomVisibilityCap(targetVisibilityMaxZoom);
    const hasVisibilityCapZoom = usableVisibilityCapZoom !== null && Number.isFinite(usableVisibilityCapZoom);
    const hasRawVisibilityCapZoom = targetVisibilityMaxZoom !== null && Number.isFinite(targetVisibilityMaxZoom);
    const visibleMaxZoom = hasVisibilityCapZoom
        ? Math.min(maxModeZoom, usableVisibilityCapZoom)
        : maxModeZoom;
    const visibleMinZoom = Math.min(minModeZoom, visibleMaxZoom);
    const clampedTargetZoom = clampAutoZoomToRange(radiusZoom, visibleMinZoom, visibleMaxZoom);

    return {
        targetZoom: clampedTargetZoom,
        baseZoom: clampedTargetZoom,
        phase,
        targetPhase: _mapAutoZoomPhaseForZoom(clampedTargetZoom),
        speedStage: speedStage.label,
        altitudeStage: altitudeStage.label,
        onGround: grounded,
        gs,
        hdg: Number.isFinite(hdg) ? Math.round(hdg) : null,
        aglFt: Number.isFinite(aglFt) ? Math.round(aglFt) : null,
        altitudeRefFt: Math.round(altitudeRefFt),
        planTasKts: Math.round(planRef.tasKts),
        planCruiseAltFt: Math.round(planRef.cruiseAltFt),
        lookaheadMin,
        lookaheadNm: Math.round(lookaheadNm * 10) / 10,
        targetApproachMin: MAP_AUTOZOOM_TARGET_APPROACH_MIN,
        targetApproachLeadNm: Math.round(targetApproachLeadNm * 10) / 10,
        targetApproachActive,
        routeTargetIsFinal,
        nearDeparture,
        nearArrival,
        nearPatternAirport,
        poiFocusLocked: routeTarget?.focusLocked === true,
        poiFocusReleaseProgress: MAP_AUTOZOOM_POI_FOCUS_RELEASE_PROGRESS,
        plannedLookaheadNm: Math.round(plannedLookaheadNm * 10) / 10,
        cruiseProgress: Math.round(cruiseProgress * 100) / 100,
        departureProgress: Math.round(departureT * 100) / 100,
        targetVisibilityMaxZoom: hasRawVisibilityCapZoom ? targetVisibilityMaxZoom : null,
        usableVisibilityCapZoom: hasVisibilityCapZoom ? usableVisibilityCapZoom : null,
        radiusZoom: Number.isFinite(Number(radiusZoom)) ? Math.round(Number(radiusZoom) * 10) / 10 : null,
        modeMinZoom: Math.round(visibleMinZoom * 10) / 10,
        modeMaxZoom: Math.round(visibleMaxZoom * 10) / 10,
        viewCenter: targetViewCenter ? {
            lat: Number(targetViewCenter.lat),
            lon: Number(targetViewCenter.lon),
            reason: 'target-approach'
        } : null,
        requiredRadiusNm: Math.round(requiredRadiusNm * 10) / 10,
        routeTarget: routeTarget ? {
            idx: routeTarget.idx,
            name: routeTarget.name,
            distNm: Number.isFinite(routeDistNm) ? Math.round(routeDistNm * 10) / 10 : null,
            etaMin: Number.isFinite(routeEtaMin) ? Math.round(routeEtaMin * 10) / 10 : null,
            isPoi: routeTarget.isPoi,
            focusLocked: routeTarget.focusLocked === true,
            focusLockRawIdx: Number.isFinite(Number(routeTarget.focusLockRawIdx)) ? Number(routeTarget.focusLockRawIdx) : null,
            focusLockEtaMin: Number.isFinite(Number(routeTarget.focusLockEtaMin)) ? Math.round(Number(routeTarget.focusLockEtaMin) * 10) / 10 : null,
            focusLockProgress: Number.isFinite(Number(routeTarget.focusLockProgress)) ? Math.round(Number(routeTarget.focusLockProgress) * 100) / 100 : null,
            focusLockReleased: routeTarget.focusLockReleased || null,
            focusLockReleasedEtaMin: Number.isFinite(Number(routeTarget.focusLockReleasedEtaMin)) ? Math.round(Number(routeTarget.focusLockReleasedEtaMin) * 10) / 10 : null,
            focusLockReleasedProgress: Number.isFinite(Number(routeTarget.focusLockReleasedProgress)) ? Math.round(Number(routeTarget.focusLockReleasedProgress) * 100) / 100 : null
        } : null,
        rawRouteTarget: rawRouteTarget ? {
            idx: rawRouteTarget.idx,
            name: rawRouteTarget.name,
            isPoi: rawRouteTarget.isPoi
        } : null,
        routeStart: routeStart ? {
            name: routeStart.name,
            distNm: Number.isFinite(startDistNm) ? Math.round(startDistNm * 10) / 10 : null
        } : null
    };
}

window.refreshMapAutoZoomUi = function() {
    const lookaheadMin = window.getMapAutoZoomLookaheadMinutes();
    const slider = document.getElementById('mapAutoZoomStrengthSlider');
    if (slider && slider.value !== String(lookaheadMin)) slider.value = String(lookaheadMin);

    const value = document.getElementById('mapAutoZoomStrengthValue');
    if (value) value.textContent = `${lookaheadMin} min`;

    const block = document.getElementById('mapAutoZoomMenuBlock');
    if (block) block.style.opacity = isMapAutoZoomEnabled() ? '1' : '0.62';

    const status = document.getElementById('mapAutoZoomStatus');
    if (status) {
        if (!isMapAutoZoomEnabled()) {
            status.textContent = 'Aus';
        } else if (!isAutoFollow) {
            status.textContent = 'Follow aus';
        } else if (lastMapAutoZoomSample) {
            const currentZoom = Number.isFinite(lastMapAutoZoomSample.currentZoom)
                ? `Z${lastMapAutoZoomSample.currentZoom.toFixed(1)}`
                : 'Z--';
            const targetZoom = Number.isFinite(lastMapAutoZoomSample.targetZoom)
                ? lastMapAutoZoomSample.targetZoom.toFixed(1)
                : '--';
            const phase = lastMapAutoZoomSample.phase || lastMapAutoZoomSample.targetPhase || '';
            const hold = lastMapAutoZoomSample.manualHoldZoom ? ` manuell Z${lastMapAutoZoomSample.manualHoldZoom.toFixed(1)}` : '';
            status.textContent = `${currentZoom} -> Z${targetZoom}${phase ? ` ${phase}` : ''}${hold}`;
        } else {
            status.textContent = 'Bereit';
        }
    }
};

window.resetMapAutoZoomState = function() {
    lastMapAutoZoomAppliedAt = 0;
    lastMapAutoZoomTargetZoom = null;
    lastMapAutoZoomSample = null;
    mapAutoZoomManualHoldZoom = null;
    mapAutoZoomManualHoldTargetZoom = null;
    mapAutoZoomManualHoldPhase = '';
    mapAutoZoomUserZoomIntentUntil = 0;
    mapAutoZoomPoiFocusLock = null;
    clearMapAutoZoomSmoothTimer();
};

function markAutoFollowProgrammaticMapMove(now = Date.now(), durationMs = 700) {
    mapAutoFollowProgrammaticMoveUntil = Math.max(mapAutoFollowProgrammaticMoveUntil, now + durationMs);
}

function isAutoFollowProgrammaticMapMove(now = Date.now()) {
    return now < mapAutoFollowProgrammaticMoveUntil;
}

function markMapAutoZoomUserZoomIntent(now = Date.now(), durationMs = 1800) {
    if (!isAutoFollow || !isMapAutoZoomEnabled()) return;
    mapAutoZoomUserZoomIntentUntil = Math.max(mapAutoZoomUserZoomIntentUntil, now + durationMs);
}

function hasMapAutoZoomUserZoomIntent(now = Date.now()) {
    return now < mapAutoZoomUserZoomIntentUntil;
}

function rememberMapAutoZoomManualZoom(now = Date.now(), options = {}) {
    const userIntent = options.userIntent === true || hasMapAutoZoomUserZoomIntent(now);
    if (!isAutoFollow || (!userIntent && isAutoFollowProgrammaticMapMove(now))) return;
    if (!isMapAutoZoomEnabled()) return;
    if (typeof map === 'undefined' || !map || typeof map.getZoom !== 'function') return;
    const zoom = Number(map.getZoom());
    if (!Number.isFinite(zoom)) return;
    mapAutoZoomManualHoldZoom = zoom;
    mapAutoZoomManualHoldTargetZoom = Number.isFinite(Number(lastMapAutoZoomSample?.targetZoom))
        ? Number(lastMapAutoZoomSample.targetZoom)
        : zoom;
    mapAutoZoomManualHoldPhase = String(lastMapAutoZoomSample?.phase || '');
    clearMapAutoZoomSmoothTimer();
    if (typeof window.refreshMapAutoZoomUi === 'function') window.refreshMapAutoZoomUi();
}

function shouldHoldManualMapAutoZoom(sample) {
    if (!sample || !Number.isFinite(Number(mapAutoZoomManualHoldZoom))) return false;
    const targetZoom = Number(sample.targetZoom);
    const holdTargetZoom = Number(mapAutoZoomManualHoldTargetZoom);
    const targetMoved = Number.isFinite(targetZoom)
        && Number.isFinite(holdTargetZoom)
        && Math.abs(targetZoom - holdTargetZoom) >= 0.75;
    const phaseChanged = mapAutoZoomManualHoldPhase
        && sample.phase
        && mapAutoZoomManualHoldPhase !== sample.phase;
    if (targetMoved || phaseChanged) {
        mapAutoZoomManualHoldZoom = null;
        mapAutoZoomManualHoldTargetZoom = null;
        mapAutoZoomManualHoldPhase = '';
        return false;
    }
    sample.manualHoldZoom = Number(mapAutoZoomManualHoldZoom);
    return true;
}

function getMapAutoZoomViewCenter(sample, fallbackLat, fallbackLon) {
    const center = sample?.viewCenter;
    const lat = Number(center?.lat);
    const lon = Number(center?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
    return [fallbackLat, fallbackLon];
}

function shouldUseMapAutoZoomViewCenter(sample, fallbackLat, fallbackLon) {
    const center = getMapAutoZoomViewCenter(sample, fallbackLat, fallbackLon);
    return Math.abs(Number(center[0]) - Number(fallbackLat)) > 0.000001
        || Math.abs(Number(center[1]) - Number(fallbackLon)) > 0.000001;
}

function getAutoFollowLiveSample() {
    const pos = window.lastLiveGpsPos || {};
    const lat = Number(pos.lat);
    const lon = Number(pos.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const fd = window.lastLiveFlightData || {};
    const alt = Number.isFinite(Number(pos.alt)) ? Number(pos.alt)
        : (Number.isFinite(Number(fd.mslFt)) ? Number(fd.mslFt) : 0);
    const gs = Number.isFinite(Number(fd.gsKts ?? fd.gs)) ? Number(fd.gsKts ?? fd.gs)
        : (Number.isFinite(Number(pos.gs)) ? Number(pos.gs) : smoothedGS);
    return {
        lat,
        lon,
        alt,
        gs: Number.isFinite(gs) ? gs : 0,
        hdg: Number.isFinite(Number(pos.hdg ?? fd.hdg ?? fd.headingDeg ?? fd.heading)) ? Number(pos.hdg ?? fd.hdg ?? fd.headingDeg ?? fd.heading) : null,
        now: Date.now(),
        lowFpsMode: isLowFpsModeActive()
    };
}

function scheduleMapAutoZoomSmoothContinuation(lowFpsMode) {
    if (!isAutoFollow || !isMapAutoZoomEnabled()) {
        clearMapAutoZoomSmoothTimer();
        return;
    }
    clearMapAutoZoomSmoothTimer();
    const delayMs = getMapAutoZoomSmoothIntervalMs(lowFpsMode);
    mapAutoZoomSmoothTimer = setTimeout(() => {
        mapAutoZoomSmoothTimer = null;
        if (!isAutoFollow || !isMapAutoZoomEnabled()) return;
        const sample = getAutoFollowLiveSample();
        if (!sample) return;
        maybeApplyMapAutoZoom(sample.lat, sample.lon, sample.alt, sample.gs, sample.hdg, Date.now(), sample.lowFpsMode, {
            continuation: true
        });
    }, delayMs);
}

function maybeApplyMapAutoZoom(lat, lon, altFt, gsKts, hdgDeg, now, lowFpsMode, options = {}) {
    if (!isMapAutoZoomEnabled() || !isAutoFollow) {
        clearMapAutoZoomSmoothTimer();
        return false;
    }
    if (typeof map === 'undefined' || !map || typeof map.getZoom !== 'function') {
        clearMapAutoZoomSmoothTimer();
        return false;
    }
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
        clearMapAutoZoomSmoothTimer();
        return false;
    }

    ensureMapAutoZoomFractionalZoom();
    const currentZoom = Number(map.getZoom());
    if (!Number.isFinite(currentZoom)) {
        clearMapAutoZoomSmoothTimer();
        return false;
    }

    const sinceLastAutoZoom = now - lastMapAutoZoomAppliedAt;
    const force = options.force === true;
    const sample = computeMapAutoZoomTargetZoom(lat, lon, gsKts, altFt, hdgDeg);
    sample.currentZoom = currentZoom;
    sample.t = now;
    lastMapAutoZoomSample = sample;
    const recoveringInvalidZoom = currentZoom < MAP_AUTOZOOM_MIN_ZOOM - 0.25
        && sample.targetZoom >= MAP_AUTOZOOM_MIN_ZOOM;
    if (recoveringInvalidZoom) sample.recoveringInvalidZoom = true;

    if (!force && !recoveringInvalidZoom && shouldHoldManualMapAutoZoom(sample)) {
        clearMapAutoZoomSmoothTimer();
        if (typeof window.refreshMapAutoZoomUi === 'function') window.refreshMapAutoZoomUi();
        return false;
    }

    const targetZoomChanged = lastMapAutoZoomTargetZoom !== null
        && Math.abs(sample.targetZoom - lastMapAutoZoomTargetZoom) >= MAP_AUTOZOOM_TARGET_CHANGE_DELTA;
    const zoomDelta = Math.abs(sample.targetZoom - currentZoom);
    const minZoomDelta = force ? 0 : MAP_AUTOZOOM_MIN_APPLY_DELTA;
    if (!force && !recoveringInvalidZoom && !targetZoomChanged && zoomDelta < minZoomDelta) {
        if (typeof window.refreshMapAutoZoomUi === 'function') window.refreshMapAutoZoomUi();
        return false;
    }

    const minIntervalMs = getMapAutoZoomSmoothIntervalMs(lowFpsMode);
    if (!force && !recoveringInvalidZoom && !targetZoomChanged && sinceLastAutoZoom < minIntervalMs) {
        if (zoomDelta >= MAP_AUTOZOOM_MIN_APPLY_DELTA) scheduleMapAutoZoomSmoothContinuation(lowFpsMode);
        return false;
    }

    try {
        let appliedZoom = sample.targetZoom;
        if (!force && !recoveringInvalidZoom) {
            const direction = sample.targetZoom >= currentZoom ? 1 : -1;
            const step = direction * computeMapAutoZoomSmoothStep(zoomDelta, lowFpsMode);
            appliedZoom = clampAutoZoomForMap(currentZoom + step);
        }
        sample.appliedZoom = appliedZoom;
        const viewCenter = getMapAutoZoomViewCenter(sample, lat, lon);
        sample.appliedCenter = { lat: viewCenter[0], lon: viewCenter[1] };
        const animationDurationS = getMapAutoZoomSmoothDurationS(lowFpsMode);
        const moveGuardMs = force ? 700 : Math.ceil(animationDurationS * 1000) + 350;
        markAutoFollowProgrammaticMapMove(now, moveGuardMs);
        const animatedViewOptions = (force || recoveringInvalidZoom)
            ? { animate: false }
            : { animate: true, duration: animationDurationS, easeLinearity: 0.16 };
        if (typeof map.setView === 'function') {
            map.setView(viewCenter, appliedZoom, animatedViewOptions);
        } else if (typeof map.setZoom === 'function') {
            map.setZoom(appliedZoom, animatedViewOptions);
            if (typeof map.panTo === 'function') map.panTo(viewCenter, animatedViewOptions);
        }
        lastMapAutoZoomAppliedAt = now;
        lastMapAutoZoomTargetZoom = sample.targetZoom;
        const remainingZoomDelta = Math.abs(sample.targetZoom - appliedZoom);
        if (!force && !recoveringInvalidZoom && remainingZoomDelta > MAP_AUTOZOOM_MIN_APPLY_DELTA) {
            scheduleMapAutoZoomSmoothContinuation(lowFpsMode);
        } else {
            clearMapAutoZoomSmoothTimer();
        }
        if (typeof window.refreshMapAutoZoomUi === 'function') window.refreshMapAutoZoomUi();
        return true;
    } catch (err) {
        console.warn('[Map Autozoom] Zoom update failed:', err && err.message ? err.message : err);
        return false;
    }
}

function applyAutoFollowViewNow(options = {}) {
    if (!isAutoFollow || typeof map === 'undefined' || !map) return false;
    const sample = options.sample || getAutoFollowLiveSample();
    if (!sample) return false;
    const now = Number.isFinite(Number(sample.now)) ? Number(sample.now) : Date.now();
    const lowFpsMode = typeof sample.lowFpsMode === 'boolean' ? sample.lowFpsMode : isLowFpsModeActive();
    const autoZoomApplied = maybeApplyMapAutoZoom(sample.lat, sample.lon, sample.alt, sample.gs, sample.hdg, now, lowFpsMode, {
        force: options.forceZoom === true
    });
    if (autoZoomApplied) {
        const followCenter = getMapAutoZoomViewCenter(lastMapAutoZoomSample, sample.lat, sample.lon);
        lastAutoFollowPanAt = now;
        lastAutoFollowPanPos = followCenter;
        return true;
    }
    const useAutoZoomCenter = isMapAutoZoomEnabled() && shouldUseMapAutoZoomViewCenter(lastMapAutoZoomSample, sample.lat, sample.lon);
    const autoZoomViewCenter = useAutoZoomCenter
        ? getMapAutoZoomViewCenter(lastMapAutoZoomSample, sample.lat, sample.lon)
        : [sample.lat, sample.lon];
    if (useAutoZoomCenter && typeof map.panTo === 'function') {
        markAutoFollowProgrammaticMapMove(now, options.animate === true ? 900 : 700);
        map.panTo(autoZoomViewCenter, { animate: options.animate === true && !lowFpsMode });
        lastAutoFollowPanAt = now;
        lastAutoFollowPanPos = autoZoomViewCenter;
        return true;
    }
    if (options.panFallback === false) return false;
    if (typeof map.panTo === 'function') {
        markAutoFollowProgrammaticMapMove(now, options.animate === true ? 900 : 700);
        map.panTo(autoZoomViewCenter, { animate: options.animate === true });
        lastAutoFollowPanAt = now;
        lastAutoFollowPanPos = autoZoomViewCenter;
        return true;
    }
    return false;
}

function handleAutoFollowManualMapDrag() {
    if (!isAutoFollow) return;
    toggleAutoFollow(false);
}

function handleAutoFollowManualMapZoomStart(e) {
    if (e?.originalEvent) markMapAutoZoomUserZoomIntent();
}

function handleAutoFollowManualMapZoom(e) {
    const now = Date.now();
    const userIntent = hasMapAutoZoomUserZoomIntent(now) || !!e?.originalEvent;
    if (!userIntent && isAutoFollowProgrammaticMapMove(now)) return;
    rememberMapAutoZoomManualZoom(now, { userIntent });
    if (userIntent) mapAutoZoomUserZoomIntentUntil = Math.max(mapAutoZoomUserZoomIntentUntil, now + 250);
}

function bindAutoFollowMapDomInteractionHandlers() {
    if (typeof map.getContainer !== 'function') return;
    const container = map.getContainer();
    if (!container || container._gaAutoFollowInteractionBound) return;
    container._gaAutoFollowInteractionBound = true;
    container.addEventListener('wheel', () => markMapAutoZoomUserZoomIntent(), { passive: true, capture: true });
    container.addEventListener('dblclick', () => markMapAutoZoomUserZoomIntent(), { passive: true, capture: true });
    container.addEventListener('touchstart', (evt) => {
        if (evt && evt.touches && evt.touches.length >= 2) markMapAutoZoomUserZoomIntent();
    }, { passive: true, capture: true });
    container.addEventListener('click', (evt) => {
        const target = evt?.target;
        if (target && typeof target.closest === 'function' && target.closest('.leaflet-control-zoom-in, .leaflet-control-zoom-out')) {
            markMapAutoZoomUserZoomIntent();
        }
    }, { passive: true, capture: true });
}

function bindAutoFollowMapInteractionHandlers() {
    if (autoFollowMapInteractionBound || typeof map === 'undefined' || !map || typeof map.on !== 'function') return;
    autoFollowMapInteractionBound = true;
    bindAutoFollowMapDomInteractionHandlers();
    map.on('dragstart', handleAutoFollowManualMapDrag);
    map.on('zoomstart', handleAutoFollowManualMapZoomStart);
    map.on('zoomend', handleAutoFollowManualMapZoom);
}

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
    bankSamples: 0,
    maxGForce: 1.0,
    sumGForce: 0,
    gForceSamples: 0,
    maxAglFt: 0,
    maxClimbFpm: 0,
    maxDescentFpm: 0,
    minEnrouteAglFt: null,
    enrouteSamples: 0,
    aglSamples: 0,
    levelAltSamples: 0,
    levelAltMeanFt: 0,
    levelAltM2: 0,
    levelAltMinFt: null,
    levelAltMaxFt: null,
    levelAltDurationSec: 0
};

let missionRuntime = {
    phase: 'idle',
    startedAt: 0,
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
    farewellPreloadRequestedAt: 0,
    arrivalFlightRecord: null,
    waitingFarewellDeboarding: false,
    deboardingAfterFarewellStarted: false,
    farewellSpeechStarted: false,
    farewellSpeechComplete: false,
    farewellDoorReady: false,
    pendingFarewellRecord: null,
    pendingFarewellReason: '',
    completionRecord: null,
    endDeboardingAnimationExpected: false,
    endDeboardingCompleted: false,
    endDeboardingCommandId: '',
    endReadinessKey: ''
};

function _missionRuntimeDataFromCandidate(candidate = null) {
    if (candidate && typeof candidate === 'object') {
        if (candidate.currentMissionData && typeof candidate.currentMissionData === 'object') return candidate.currentMissionData;
        return candidate;
    }
    try {
        return (typeof currentMissionData !== 'undefined' && currentMissionData && typeof currentMissionData === 'object')
            ? currentMissionData
            : null;
    } catch (_) {
        return null;
    }
}

function _missionRuntimeContractFromCandidate(candidate = null, md = null) {
    if (candidate && typeof candidate === 'object') {
        if (candidate.activeMissionContract && typeof candidate.activeMissionContract === 'object') return candidate.activeMissionContract;
        if (candidate.currentMissionData?.missionContract && typeof candidate.currentMissionData.missionContract === 'object') return candidate.currentMissionData.missionContract;
        if (candidate.missionContract && typeof candidate.missionContract === 'object') return candidate.missionContract;
    }
    if (md?.missionContract && typeof md.missionContract === 'object') return md.missionContract;
    try {
        return (window.activeMissionContract && typeof window.activeMissionContract === 'object') ? window.activeMissionContract : null;
    } catch (_) {
        return null;
    }
}

function _missionIsFreeflightOnly(candidate = null) {
    const md = _missionRuntimeDataFromCandidate(candidate);
    if (!md || typeof md !== 'object') return false;
    const contract = _missionRuntimeContractFromCandidate(candidate, md);
    const flags = [
        md.freeflightOnly,
        md.efbOnly,
        md.noMissionRuntime,
        md.directToEfbOnly,
        md.routeOnly,
        contract?.freeflightOnly,
        contract?.efbOnly,
        contract?.noMissionRuntime,
        contract?.directToEfbOnly
    ];
    if (flags.some(value => value === true || value === 'true' || value === 1 || value === '1')) return true;

    const profileValues = [
        md.taskDomain,
        md.profileId,
        md.requestedProfileId,
        md.appliedProfileId,
        md._requestedProfile,
        md._appliedProfile,
        md.missionContractV4?.profile?.id,
        md.missionContractV4?.profile?.taskDomain,
        contract?.taskDomain,
        contract?.profileId,
        contract?.requestedProfileId,
        contract?.appliedProfileId
    ].map(value => String(value || '').trim().toLowerCase()).filter(Boolean);
    if (profileValues.includes('freeflight_planning')) return true;

    const texts = [
        md.source,
        md._source,
        md.mission,
        md.title,
        md.missionTitle,
        md.story,
        md.missionStory,
        md.s,
        candidate?.mTitle,
        candidate?.mStory
    ].map(value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean);
    const hasDirectToStory = texts.some(text => /direct-to|direct to|story-briefing ausgesetzt/.test(text));
    const hasFreeflightStory = texts.some(text => /freiflug|freeflight/.test(text));
    const hasPrivateFlightTitle = texts.some(text => /^👤?\s*privater flug$/.test(text) || /^privater flug$/.test(text));
    return (hasDirectToStory && hasPrivateFlightTitle) || (hasFreeflightStory && profileValues.length === 0 && hasPrivateFlightTitle);
}
window.missionIsFreeflightOnly = _missionIsFreeflightOnly;

function _markMissionAsFreeflightOnly(md = null, options = {}) {
    const data = _missionRuntimeDataFromCandidate(md);
    if (!data || typeof data !== 'object') return data;
    data.freeflightOnly = true;
    data.efbOnly = true;
    data.noMissionRuntime = true;
    data.directToEfbOnly = options.directTo !== false;
    data.routeOnly = true;
    data.taskDomain = data.taskDomain || 'freeflight_planning';
    data.missionType = data.missionType || 'freeflight';
    data._requestedProfile = data._requestedProfile || 'freeflight_planning';
    data._appliedProfile = data._appliedProfile || 'freeflight_planning';
    data.sceneAccepted = null;
    data.sceneCompositionStatus = 'freeflight';
    delete data.missionContract;
    delete data.passenger;
    return data;
}
window.markMissionAsFreeflightOnly = _markMissionAsFreeflightOnly;

window.prepareFreeflightBriefingState = function(md = null, options = {}) {
    if (window.missionComplianceBlockReset?.()) {
        try { alert('Die laufende Behoerdenkontrolle muss zuerst abgeschlossen werden.'); } catch (_) {}
        return false;
    }
    if (typeof window.confirmMissionAuthorityReplacement === 'function'
        && !window.confirmMissionAuthorityReplacement('die Freiflugroute', options.reason || 'freeflight-briefing')) return false;
    const data = _markMissionAsFreeflightOnly(md, options);
    try { window.activePassenger = null; } catch (_) {}
    try { window.activeMissionContract = null; } catch (_) {}
    try { localStorage.removeItem('ga_active_passenger'); } catch (_) {}
    try { localStorage.removeItem('ga_active_mission_contract'); } catch (_) {}
    try { localStorage.removeItem(MISSION_RUNTIME_RESUME_KEY); } catch (_) {}
    if (typeof window.paxVoiceResetMission === 'function') {
        try { window.paxVoiceResetMission(); } catch (_) {}
    }
    if (typeof window.clearMissionDebugSnapshot === 'function') {
        try { window.clearMissionDebugSnapshot(options.reason || 'freeflight-briefing'); } catch (_) {}
    } else {
        try { window.vpMissionDebugSnapshot = null; localStorage.removeItem('ga_mission_debug_snapshot'); } catch (_) {}
    }
    if (typeof window.gaMissionSceneDebugClear === 'function') {
        try { window.gaMissionSceneDebugClear(); } catch (_) {}
    }
    if (typeof window.missionRuntimeReset === 'function') {
        try { window.missionRuntimeReset({ respawnAfterClear: false }); } catch (_) {}
    } else {
        _resetMissionRuntime();
    }
    return data;
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
    if (_missionRuntimePhaseCountsAsStarted(next) && !missionRuntime.startedAt) {
        missionRuntime.startedAt = Date.now();
        _touchActiveMissionRuntimeMarker(options.reason || 'set-runtime-phase');
    }
    if (prev !== next) {
        _missionPhaseDebugPush('runtime_phase', {
            from: prev,
            to: next,
            trigger: options.reason || 'set-runtime-phase'
        });
    }
    _persistMissionRuntimeSnapshot(
        options.reason || 'set-runtime-phase',
        prev !== next ? { immediate: true } : {}
    );
    if (options.updateUi !== false) _updateMissionRuntimeUi();
    return next;
}

let missionSmokeCommandSeq = 0;
const missionSceneBoardingWaiters = new Map();
const missionSceneIgnoredBoardingCommandIds = new Set();
const trackerPayloadWaiters = new Map();
const trackerDebugCommandWaiters = new Map();
const missionTargetSceneTerrainRequests = new Map();
const trackerPendingMissionCommands = new Map();
let missionSceneBoardingPromise = null;
let missionStartBoardingPromise = null;
let missionStartActionPromise = null;
let missionSceneDeboardingWatchdogTimer = null;
let missionSceneBoardingCuePlayback = null;
let missionSceneDeboardingCuePlayback = null;
let missionInterruptedDeboardingRecovery = null;
const MISSION_RUNTIME_RESUME_KEY = 'ga_active_mission_runtime';
const MISSION_AUTHORITY_STORAGE_KEY = 'ga_mission_authority_v1';
const MISSION_AUTHORITY_CAPABILITY = 'mission.authority.v1';
const MISSION_SNAPSHOT_V2_CAPABILITY = 'mission.snapshot.v2';
const missionAuthorityAckWaiters = new Map();
const missionAuthorityLocalCommandIds = new Map();
let missionRuntimeSnapshotTimer = null;
let missionRuntimeLastPersistAt = 0;
let missionRuntimePendingSnapshotReason = '';
let missionRuntimeResumeAppliedFor = '';
let missionRuntimeResumeSuppressedFor = '';
let missionRuntimeResumeSuppressedLastSig = '';
let missionRuntimeResumeSuppressedLastLogAt = 0;
let missionRuntimeResumeConflictLastSig = '';
let missionRuntimeResumeConflictLastLogAt = 0;
let missionAuthoritySnapshotSequence = 0;
let missionAuthorityLastSnapshotHash = '';
let missionAuthorityLastSnapshotPushAt = 0;
let missionAuthoritySnapshotPushTimer = null;
let missionAuthorityAdoptPromise = null;
let missionAuthorityForeignAckLastSig = '';
let missionAuthorityForeignAckLastLogAt = 0;
const MISSION_AUTHORITY_LOCAL_COMMAND_TTL_MS = 10 * 60 * 1000;
const MISSION_AUTHORITY_LOCAL_COMMAND_MAX = 800;
const TRACKER_RETRYABLE_COMMAND_TYPES = new Set([
    'mission_scene_spawn',
    'mission_scene_clear',
    'mission_scene_boarding',
    'mission_scene_deboarding',
    'mission_smoke_spawn',
    'mission_smoke_clear'
]);
const TRACKER_ACK_SUCCESS = new Set(['ok', 'noop']);

function _missionAuthorityClientId() {
    const key = 'ga_mission_authority_client_id';
    try {
        let value = String(localStorage.getItem(key) || '').trim();
        if (value) return value;
        const randomPart = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
        value = `web-${randomPart}`;
        localStorage.setItem(key, value);
        return value;
    } catch (_) {
        if (!window.__gaMissionAuthorityClientId) {
            window.__gaMissionAuthorityClientId = `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
        }
        return window.__gaMissionAuthorityClientId;
    }
}

function _rememberMissionAuthorityLocalCommand(commandId = '', type = '') {
    const id = String(commandId || '').trim();
    if (!id) return false;
    const now = Date.now();
    missionAuthorityLocalCommandIds.set(id, {
        type: String(type || '').trim().toLowerCase(),
        sentAt: now
    });
    for (const [storedId, entry] of missionAuthorityLocalCommandIds) {
        if (missionAuthorityLocalCommandIds.size <= MISSION_AUTHORITY_LOCAL_COMMAND_MAX
            && now - Number(entry?.sentAt || 0) <= MISSION_AUTHORITY_LOCAL_COMMAND_TTL_MS) break;
        missionAuthorityLocalCommandIds.delete(storedId);
    }
    return true;
}

function _missionAuthorityAckWasSentLocally(ack = {}) {
    const commandId = String(ack?.commandId || '').trim();
    return !!(commandId && missionAuthorityLocalCommandIds.has(commandId));
}

function _missionAuthorityIncomingRunRelation(local = null, active = null, clientId = '') {
    if (!active?.missionId || !active?.runId) return 'none';
    const ownClientId = String(clientId || '').trim();
    const localRevision = Math.max(0, Math.round(Number(local?.revision) || 0));
    const activeRevision = Math.max(0, Math.round(Number(active.revision) || 0));
    if (local?.runId === active.runId
        && localRevision
        && activeRevision
        && activeRevision < localRevision) return 'stale';
    if (active.ownerClientId === ownClientId) return 'owner';
    if (!local?.runId || local.runId !== active.runId) return 'foreign';
    return 'demote';
}

function _readMissionAuthorityState() {
    try {
        const parsed = JSON.parse(localStorage.getItem(MISSION_AUTHORITY_STORAGE_KEY) || 'null');
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
        return null;
    }
}

function _writeMissionAuthorityState(next = null) {
    if (!next || typeof next !== 'object' || !next.missionId || !next.runId) {
        try { localStorage.removeItem(MISSION_AUTHORITY_STORAGE_KEY); } catch (_) {}
        window.missionAuthorityState = null;
        return null;
    }
    const previous = _readMissionAuthorityState() || {};
    const normalized = {
        version: 1,
        missionId: _normalizeMissionRuntimeId(next.missionId),
        runId: String(next.runId || '').slice(0, 220),
        clientId: String(next.clientId || previous.clientId || _missionAuthorityClientId()).slice(0, 220),
        revision: Math.max(1, Math.round(Number(next.revision || previous.revision) || 1)),
        phase: String(next.phase || previous.phase || '').slice(0, 100),
        updatedAt: Date.now()
    };
    try { localStorage.setItem(MISSION_AUTHORITY_STORAGE_KEY, JSON.stringify(normalized)); } catch (_) {}
    window.missionAuthorityState = normalized;
    return normalized;
}

function _clearMissionAuthorityState(reason = 'clear') {
    const previous = _readMissionAuthorityState();
    if (missionAuthoritySnapshotPushTimer) {
        clearTimeout(missionAuthoritySnapshotPushTimer);
        missionAuthoritySnapshotPushTimer = null;
    }
    _writeMissionAuthorityState(null);
    missionAuthorityLastSnapshotHash = '';
    missionAuthoritySnapshotSequence = 0;
    missionAuthorityLastSnapshotPushAt = 0;
    window.missionAuthorityReleasePending = null;
    _missionPhaseDebugPush('authority_local_clear', {
        reason,
        missionId: previous?.missionId || null,
        runId: previous?.runId || null
    });
}

function _trackerCapabilitiesFromPacket(packet = null) {
    const capabilities = packet?.trackerProtocolHello?.payload?.capabilities;
    if (!Array.isArray(capabilities)) return [];
    return Array.from(new Set(capabilities.map(value => String(value || '').trim().toLowerCase()).filter(Boolean)));
}

function _trackerSupportsMissionAuthority() {
    return Array.isArray(window.liveTrackerCapabilities)
        && window.liveTrackerCapabilities.includes(MISSION_AUTHORITY_CAPABILITY);
}
window.trackerSupportsMissionAuthority = _trackerSupportsMissionAuthority;

function _missionAuthorityAdapter(runtimeSnapshot = null, missionState = null) {
    if (typeof window.GAMissionResumeAdapters?.detectPrimaryAdapter === 'function') {
        try { return window.GAMissionResumeAdapters.detectPrimaryAdapter(runtimeSnapshot, missionState); } catch (_) {}
    }
    const progress = runtimeSnapshot?.poiProgress || {};
    if (progress.sarHeli) return 'sar_heli';
    if (progress.surveyPattern) return 'survey_pattern';
    if (progress.poiChain) return 'poi_chain';
    if (progress.trainingProcedure) return 'training';
    if (runtimeSnapshot?.bushProgress) return 'bush_pickup';
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : {};
    if (md.isPOI || md.poiName || md.targetName) return 'poi';
    return 'apt';
}

function _missionAuthorityStateHash(value) {
    let raw = '';
    try { raw = JSON.stringify(value); } catch (_) { return ''; }
    let hash = 2166136261;
    for (let i = 0; i < raw.length; i++) {
        hash ^= raw.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}-${raw.length}`;
}

function _buildMissionAuthorityMapProfile() {
    const source = (typeof vpElevationData !== 'undefined' && Array.isArray(vpElevationData))
        ? vpElevationData
        : (Array.isArray(window.vpElevationData) ? window.vpElevationData : []);
    const clean = source.map(point => {
        const lat = Number(point?.lat);
        const lon = Number(point?.lon ?? point?.lng);
        const elevFt = Number(point?.elevFt ?? point?.terrainFt ?? point?.elevationFt);
        const distNM = Number(point?.distNM ?? point?.distanceNm);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(elevFt)) return null;
        const item = {
            lat: Math.round(lat * 1e5) / 1e5,
            lon: Math.round(lon * 1e5) / 1e5,
            elevFt: Math.round(elevFt)
        };
        if (Number.isFinite(distNM)) item.distNM = Math.round(distNM * 100) / 100;
        return item;
    }).filter(Boolean);
    if (clean.length < 2) return null;
    const maxPoints = 96;
    const points = [];
    if (clean.length <= maxPoints) {
        points.push(...clean);
    } else {
        const step = (clean.length - 1) / (maxPoints - 1);
        for (let index = 0; index < maxPoints; index += 1) {
            points.push(clean[Math.min(clean.length - 1, Math.round(index * step))]);
        }
    }
    const totalDistanceNm = Number(points[points.length - 1]?.distNM);
    return {
        version: 1,
        terrainAvailable: true,
        totalDistanceNm: Number.isFinite(totalDistanceNm) ? totalDistanceNm : null,
        points
    };
}

function _missionAuthorityLiveRouteSnapshot() {
    const candidates = [
        (typeof routeWaypoints !== 'undefined' && Array.isArray(routeWaypoints)) ? routeWaypoints : null,
        Array.isArray(window._missionRouteWaypoints) ? window._missionRouteWaypoints : null,
        (typeof currentMissionData !== 'undefined' && Array.isArray(currentMissionData?.routeWaypoints))
            ? currentMissionData.routeWaypoints
            : null,
        (typeof currentMissionData !== 'undefined' && Array.isArray(currentMissionData?.missionRouteWaypoints))
            ? currentMissionData.missionRouteWaypoints
            : null
    ];
    const source = candidates.find(value => Array.isArray(value) && value.length >= 2);
    if (!source) return [];
    return source.slice(0, 128).map((point, index) => {
        const lat = Number(point?.lat ?? point?.latitude);
        const lon = Number(point?.lon ?? point?.lng ?? point?.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const elevationFt = Number(point?.elevationFt ?? point?.elevFt ?? point?.altitudeFt ?? point?.altFt);
        return {
            id: String(point?.id || point?.ref || `wp-${index + 1}`).slice(0, 80),
            name: String(point?.name || point?.label || point?.icao || point?.ident || `WP ${index + 1}`).slice(0, 100),
            lat: Math.round(lat * 1e6) / 1e6,
            lon: Math.round(lon * 1e6) / 1e6,
            ...(Number.isFinite(elevationFt) ? { elevationFt: Math.round(elevationFt) } : {}),
            kind: String(point?.kind || point?.type || (point?.isPOI ? 'poi' : 'waypoint')).slice(0, 40),
            required: point?.required !== false
        };
    }).filter(Boolean);
}

function _missionAuthorityInjectLiveRoute(missionState = null) {
    const route = _missionAuthorityLiveRouteSnapshot();
    if (!missionState || typeof missionState !== 'object' || route.length < 2) return missionState;
    missionState.routeWaypoints = _safeCloneJson(route, route);
    missionState.missionRouteWaypoints = _safeCloneJson(route, route);
    if (missionState.currentMissionData && typeof missionState.currentMissionData === 'object') {
        missionState.currentMissionData.routeWaypoints = _safeCloneJson(route, route);
        missionState.currentMissionData.missionRouteWaypoints = _safeCloneJson(route, route);
    }
    if (missionState.activeMissionContract && typeof missionState.activeMissionContract === 'object') {
        missionState.activeMissionContract.routeWaypoints = _safeCloneJson(route, route);
        missionState.activeMissionContract.missionRouteWaypoints = _safeCloneJson(route, route);
    }
    return missionState;
}

function _restoreMissionAuthorityMapProfile(bundle = null) {
    const source = Array.isArray(bundle?.mapProfile?.points) ? bundle.mapProfile.points : [];
    const points = source.map(point => {
        const lat = Number(point?.lat);
        const lon = Number(point?.lon ?? point?.lng);
        const elevFt = Number(point?.elevFt ?? point?.terrainFt ?? point?.elevationFt);
        const distNM = Number(point?.distNM ?? point?.distanceNm);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(elevFt)) return null;
        return {
            lat,
            lon,
            elevFt,
            ...(Number.isFinite(distNM) ? { distNM } : {})
        };
    }).filter(Boolean);
    if (points.length < 2) return false;
    try {
        vpElevationData = points;
    } catch (_) {}
    window.vpElevationData = points;
    return true;
}

function _buildMissionAuthorityResumeBundle(reason = 'runtime', options = {}) {
    const runtime = _buildMissionRuntimeSnapshot(reason);
    if (!runtime?.missionId) return null;
    let missionState = null;
    try {
        const activeState = _syncActiveMissionPayload();
        missionState = activeState ? _syncCompactActiveMission(activeState, 3) : null;
        missionState = _missionAuthorityInjectLiveRoute(missionState);
    } catch (_) {
        missionState = null;
    }
    return {
        version: 2,
        missionId: runtime.missionId,
        adapter: _missionAuthorityAdapter(runtime, missionState),
        descriptor: typeof window.GAMissionResumeAdapters?.createDescriptor === 'function'
            ? window.GAMissionResumeAdapters.createDescriptor(runtime, missionState)
            : null,
        savedAt: Date.now(),
        mapProfile: options.includeMapProfile === false ? null : _buildMissionAuthorityMapProfile(),
        missionState,
        runtime
    };
}

function _validateMissionAuthorityResumeBundle(bundle = null) {
    if (typeof window.GAMissionResumeAdapters?.validateBundle === 'function') {
        try { return window.GAMissionResumeAdapters.validateBundle(bundle); } catch (_) {}
    }
    return {
        ok: !!(bundle?.missionId && bundle?.missionState && bundle?.runtime),
        error: bundle ? 'resume_bundle_invalid' : 'resume_bundle_missing'
    };
}

function _buildMissionAuthorityLocalRecovery(active = null, reason = 'legacy-local-recovery') {
    const trackerMissionId = _normalizeMissionRuntimeId(active?.missionId || '');
    const trackerMissionKey = trackerMissionId.toLowerCase();
    const ownerClientId = String(active?.ownerClientId || '').trim();
    const localClientId = _missionAuthorityClientId();
    if (!trackerMissionId || !active?.runId) return { ok: false, error: 'tracker_run_missing' };
    if (ownerClientId !== 'legacy-client' && ownerClientId !== localClientId) {
        return { ok: false, error: 'tracker_owner_not_recoverable' };
    }

    const missionState = _syncActiveMissionPayload();
    const localMissionIds = _syncMissionIdentityValues(missionState)
        .map(value => _normalizeMissionRuntimeId(value).toLowerCase())
        .filter(Boolean);
    if (!missionState || !localMissionIds.includes(trackerMissionKey)) {
        return { ok: false, error: 'local_mission_mismatch' };
    }

    const persistedRuntime = _syncReadRuntimeSnapshot();
    const liveRuntime = _buildMissionRuntimeSnapshot(reason);
    const matchesMission = snapshot => (
        _normalizeMissionRuntimeId(_missionRuntimeSnapshotMissionId(snapshot)).toLowerCase() === trackerMissionKey
    );
    const persistedMatches = matchesMission(persistedRuntime);
    const liveMatches = matchesMission(liveRuntime);
    let runtime = null;
    let runtimeSource = 'planned-fallback';
    if (persistedMatches && (!liveMatches
        || (_syncRuntimeSnapshotStarted(persistedRuntime) && !_syncRuntimeSnapshotStarted(liveRuntime)))) {
        runtime = persistedRuntime;
        runtimeSource = 'persisted';
    } else if (liveMatches) {
        runtime = liveRuntime;
        runtimeSource = 'live';
    } else if (persistedMatches) {
        runtime = persistedRuntime;
        runtimeSource = 'persisted';
    } else {
        runtime = {
            version: 1,
            missionId: trackerMissionId,
            startedAt: 0,
            savedAt: Date.now(),
            reason,
            startPhase: 'planned',
            runtime: {
                missionId: trackerMissionId,
                phase: 'planned',
                startedAt: 0,
                active: false,
                manual: false,
                armed: false,
                closingPending: false,
                closingReason: ''
            }
        };
    }

    const compactMissionState = _missionAuthorityInjectLiveRoute(_syncCompactActiveMission(missionState, 3));
    const bundle = {
        version: 2,
        missionId: trackerMissionId,
        adapter: _missionAuthorityAdapter(runtime, compactMissionState),
        descriptor: typeof window.GAMissionResumeAdapters?.createDescriptor === 'function'
            ? window.GAMissionResumeAdapters.createDescriptor(runtime, compactMissionState)
            : null,
        savedAt: Date.now(),
        mapProfile: _buildMissionAuthorityMapProfile(),
        missionState: compactMissionState,
        runtime
    };
    const validation = _validateMissionAuthorityResumeBundle(bundle);
    if (!validation.ok) return { ok: false, error: validation.error || 'local_resume_invalid' };
    return {
        ok: true,
        bundle,
        validation,
        runtimeSource,
        ownerClientId,
        missionTitle: _syncMissionTitleForPrompt(missionState)
    };
}

function _missionAuthorityResumeBundleHash(bundle = null) {
    if (!bundle || typeof bundle !== 'object') return '';
    const runtimeForHash = _safeCloneJson(bundle.runtime, null) || {};
    delete runtimeForHash.savedAt;
    delete runtimeForHash.reason;
    delete runtimeForHash.lastLiveGpsPos;
    delete runtimeForHash.lastLiveFlightData;
    delete runtimeForHash.trackerMissionStatus;
    return _missionAuthorityStateHash({
        version: bundle.version,
        missionId: bundle.missionId,
        descriptor: bundle.descriptor,
        mapProfile: bundle.mapProfile,
        missionState: bundle.missionState,
        runtime: runtimeForHash
    });
}

function _resolveMissionAuthorityAck(ack = {}) {
    const commandId = String(ack.commandId || '').trim();
    if (!commandId) return false;
    const waiter = missionAuthorityAckWaiters.get(commandId);
    if (!waiter) return false;
    missionAuthorityAckWaiters.delete(commandId);
    clearTimeout(waiter.timer);
    waiter.resolve(ack);
    return true;
}

function _sendMissionAuthorityRequest(command = {}, timeoutMs = 10000) {
    const commandId = command.commandId || `cmd-authority-${Date.now()}-${++missionSmokeCommandSeq}`;
    return new Promise(resolve => {
        const timer = setTimeout(() => {
            missionAuthorityAckWaiters.delete(commandId);
            resolve({ type: `${command.type || 'mission_authority'}_ack`, commandId, status: 'error', error: 'authority_timeout' });
        }, Math.max(2000, Number(timeoutMs) || 10000));
        missionAuthorityAckWaiters.set(commandId, { resolve, timer, type: command.type || '' });
        const sent = window.sendTrackerCommand({ ...command, commandId }, { authorityProtocol: true });
        if (!sent) {
            clearTimeout(timer);
            missionAuthorityAckWaiters.delete(commandId);
            resolve({ type: `${command.type || 'mission_authority'}_ack`, commandId, status: 'error', error: 'tracker_not_connected' });
        }
    });
}

async function _ensureMissionAuthorityForStart(reason = 'mission-start') {
    if (window.simModeActive || !_trackerSupportsMissionAuthority()) return true;
    const missionId = _activeMissionRuntimeId('');
    if (!missionId) return false;
    const local = _readMissionAuthorityState();
    const command = {
        type: 'mission_authority_acquire',
        missionId,
        clientId: _missionAuthorityClientId(),
        reason,
        state: 'active',
        missionPhase: 'planned',
        resumeBundle: _buildMissionAuthorityResumeBundle(reason)
    };
    if (local?.missionId === missionId && local.runId) {
        command.runId = local.runId;
    }
    const ack = await _sendMissionAuthorityRequest(command, 12000);
    if (ack.status === 'ok' && ack.authoritativeRun?.missionId === missionId) {
        _writeMissionAuthorityState({
            ...ack.authoritativeRun,
            clientId: _missionAuthorityClientId()
        });
        window.missionRuntimeResumeConflict = null;
        _missionPhaseDebugPush('authority_acquired', {
            missionId,
            runId: ack.authoritativeRun.runId,
            resumed: ack.resumed === true,
            reason
        });
        _scheduleMissionAuthorityProfileRefresh('tracker-authority-acquired');
        return true;
    }
    const active = ack.authoritativeRun || null;
    window.missionRuntimeResumeConflict = {
        reason: ack.error || 'mission-authority-conflict',
        trackerMissionId: active?.missionId || null,
        trackerRunId: active?.runId || null,
        ownerClientId: active?.ownerClientId || null,
        activeMissionId: missionId,
        trackerActive: !!active,
        at: Date.now()
    };
    _missionPhaseDebugPush('authority_acquire_rejected', window.missionRuntimeResumeConflict);
    _updateMissionRuntimeUi();
    return false;
}

function _queueMissionAuthoritySnapshot(reason = 'runtime', options = {}) {
    if (!_trackerSupportsMissionAuthority() || !window.liveTrackerConnected) return false;
    const local = _readMissionAuthorityState();
    const missionId = _activeMissionRuntimeId('');
    if (!local?.runId || !missionId || local.missionId !== missionId) return false;
    const push = () => {
        missionAuthoritySnapshotPushTimer = null;
        const currentLocal = _readMissionAuthorityState();
        if (!currentLocal?.runId
            || currentLocal.missionId !== missionId
            || currentLocal.clientId !== _missionAuthorityClientId()) return;
        const trackerRun = window.lastTrackerMissionAuthority?.activeRun || window.lastTrackerMissionStatus || null;
        if (trackerRun?.runId && trackerRun.runId !== currentLocal.runId) return;
        const relation = _missionAuthorityIncomingRunRelation(currentLocal, trackerRun, _missionAuthorityClientId());
        if (relation === 'demote' || relation === 'foreign') return;
        const bundle = _buildMissionAuthorityResumeBundle(reason, options);
        if (!bundle) return;
        const stateHash = _missionAuthorityResumeBundleHash(bundle);
        if (stateHash && stateHash === missionAuthorityLastSnapshotHash) return;
        missionAuthoritySnapshotSequence = Math.max(missionAuthoritySnapshotSequence + 1, Date.now());
        missionAuthorityLastSnapshotHash = stateHash;
        missionAuthorityLastSnapshotPushAt = Date.now();
        window.sendTrackerCommand({
            type: 'mission_snapshot_update',
            missionId,
            runId: currentLocal.runId,
            clientId: currentLocal.clientId,
            snapshotSequence: missionAuthoritySnapshotSequence,
            state: missionRuntime.closingPending ? 'closing' : 'active',
            missionPhase: _missionRuntimePhaseSnapshot(),
            stateHash,
            reason,
            resumeBundle: bundle
        }, { authorityProtocol: true });
    };
    if (options.immediate === true) {
        if (missionAuthoritySnapshotPushTimer) clearTimeout(missionAuthoritySnapshotPushTimer);
        push();
    } else if (!missionAuthoritySnapshotPushTimer) {
        const minDelay = Math.max(700, 10000 - (Date.now() - missionAuthorityLastSnapshotPushAt));
        missionAuthoritySnapshotPushTimer = setTimeout(push, minDelay);
    }
    return true;
}

window.gaPushMissionAuthorityProfile = function(reason = 'terrain-profile-ready') {
    return _queueMissionAuthoritySnapshot(reason, { immediate: true });
};

window.gaPushMissionAuthorityRoute = function(reason = 'route-changed') {
    return _queueMissionAuthoritySnapshot(reason, { immediate: true, includeMapProfile: false });
};

let missionAuthorityProfileRefreshTimer = null;
function _scheduleMissionAuthorityProfileRefresh(reason = 'tracker-authority-handoff') {
    if (missionAuthorityProfileRefreshTimer) clearTimeout(missionAuthorityProfileRefreshTimer);
    const delays = [250, 1000, 3000];
    let attempt = 0;
    const run = () => {
        missionAuthorityProfileRefreshTimer = null;
        const existing = _buildMissionAuthorityMapProfile();
        if (existing?.points?.length >= 2) {
            _queueMissionAuthoritySnapshot(`${reason}-profile-ready`, { immediate: true });
            return;
        }
        let started = false;
        try {
            started = typeof window.vpHardReloadRouteProfile === 'function'
                && window.vpHardReloadRouteProfile(reason) === true;
        } catch (_) {
            started = false;
        }
        if (started || attempt >= delays.length - 1) return;
        attempt += 1;
        missionAuthorityProfileRefreshTimer = setTimeout(run, delays[attempt]);
    };
    missionAuthorityProfileRefreshTimer = setTimeout(run, delays[attempt]);
    return true;
}

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

function _trackerRetryConfigForCommand(type = '', command = {}) {
    const t = String(type || '').toLowerCase();
    if (t === 'mission_scene_spawn') {
        // Spawn is not idempotent on all tracker builds; retries can duplicate scene objects.
        return { maxAttempts: 1, timeoutMs: 60000 };
    }
    if (t === 'mission_scene_clear') {
        // Clear is idempotent and often used for broad reset/preview cleanup. Missing ACKs should not
        // create retry storms or warning floods while the user is interacting with the app.
        return { maxAttempts: 1, timeoutMs: 5000, warnOnExhausted: false };
    }
    if (t === 'mission_scene_boarding') {
        // Boarding is non-idempotent; a retry can run a second boarding in parallel.
        return { maxAttempts: 1, timeoutMs: 75000 };
    }
    if (t === 'mission_scene_deboarding') {
        // Includes vehicle arrival, Farewell voice hold and walk-off animation.
        return { maxAttempts: 1, timeoutMs: 300000 };
    }
    return { maxAttempts: 3, timeoutMs: 12000, warnOnExhausted: true };
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
            if (current.warnOnExhausted !== false) console.warn(`[TrackerCmd] Retry exhausted ${current.type} id=${id} attempts=${current.attempts}/${current.maxAttempts}`);
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
    const cfg = _trackerRetryConfigForCommand(type, command);
    const prev = trackerPendingMissionCommands.get(id);
    const entry = prev || {
        commandId: id,
        type,
        ackType: _trackerAckTypeForCommand(type),
        command: null,
        attempts: 0,
        maxAttempts: Number(cfg.maxAttempts) || 3,
        timeoutMs: Number(cfg.timeoutMs) || 12000,
        warnOnExhausted: cfg.warnOnExhausted !== false,
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
    entry.warnOnExhausted = cfg.warnOnExhausted !== false;
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
        if (entry.warnOnExhausted !== false) console.warn(`[TrackerCmd] Retry blocked ${entry.type} id=${id} attempts=${entry.attempts}/${entry.maxAttempts}`);
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
            if (current.warnOnExhausted !== false) console.warn(`[TrackerCmd] Retry exhausted ${current.type} id=${id} attempts=${current.attempts}/${current.maxAttempts} after ${reason}`);
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
const MISSION_SCENE_MOVING_TARMAC_PERSON_TITLES = Object.freeze([
    'Tarmac_Male_Summer_African',
    'Tarmac_Male_Summer_Arab',
    'Tarmac_Male_Summer_Asian',
    'Tarmac_Male_Summer_Caucasian',
    'Tarmac_Male_Summer_Hispanic',
    'Tarmac_Male_Summer_Indian',
    'Tarmac_Male_Winter_African',
    'Tarmac_Male_Winter_Arab',
    'Tarmac_Male_Winter_Asian',
    'Tarmac_Male_Winter_Caucasian',
    'Tarmac_Male_Winter_Hispanic',
    'Tarmac_Male_Winter_Indian',
    'Tarmac_Female_Summer_African',
    'Tarmac_Female_Summer_Arab',
    'Tarmac_Female_Summer_Asian',
    'Tarmac_Female_Summer_Caucasian',
    'Tarmac_Female_Summer_Hispanic',
    'Tarmac_Female_Summer_Indian',
    'Tarmac_Female_Winter_African',
    'Tarmac_Female_Winter_Arab',
    'Tarmac_Female_Winter_Asian',
    'Tarmac_Female_Winter_Caucasian',
    'Tarmac_Female_Winter_Hispanic',
    'Tarmac_Female_Winter_Indian'
]);
const MISSION_SCENE_DEBUG_MAX_EVENTS = 50;
const MISSION_PHASE_DEBUG_MAX_EVENTS = 240;
const MISSION_PHASE_DEBUG_STORAGE_KEY = 'ga_mission_phase_debug_v2';
const MISSION_SCENE_SPAWN_ERROR_COOLDOWN_MS = 60000;
const MISSION_SCENE_SPAWN_PENDING_STALE_MS = 90000;

function _missionPhaseDebugReadPersistedEvents() {
    try {
        const parsed = JSON.parse(localStorage.getItem(MISSION_PHASE_DEBUG_STORAGE_KEY) || 'null');
        if (!parsed || !Array.isArray(parsed.events)) return [];
        return parsed.events
            .filter(entry => entry && Number.isFinite(Number(entry.ts)) && entry.kind)
            .slice(-MISSION_PHASE_DEBUG_MAX_EVENTS);
    } catch (_) {
        return [];
    }
}

function _missionPhaseDebugPersist(dbg = null) {
    if (!dbg || !Array.isArray(dbg.events)) return false;
    try {
        localStorage.setItem(MISSION_PHASE_DEBUG_STORAGE_KEY, JSON.stringify({
            schemaVersion: 2,
            updatedAt: Date.now(),
            events: dbg.events.slice(-MISSION_PHASE_DEBUG_MAX_EVENTS)
        }));
        return true;
    } catch (_) {
        return false;
    }
}

function _missionPhaseDebugState() {
    if (!window.gaMissionPhaseDebug || typeof window.gaMissionPhaseDebug !== 'object') {
        const persistedEvents = _missionPhaseDebugReadPersistedEvents();
        window.gaMissionPhaseDebug = {
            ts: Date.now(),
            sessionStartedAt: Date.now(),
            persistenceEnabled: true,
            restoredEventCount: persistedEvents.length,
            events: persistedEvents,
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
    _missionPhaseDebugPersist(dbg);
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

function _safeCloneJson(value, fallback = null) {
    try {
        if (value == null) return fallback;
        return JSON.parse(JSON.stringify(value));
    } catch (_) {
        return fallback;
    }
}

function _compactLivePositionForRuntime(pos = null) {
    const src = pos || window.lastLiveGpsPos || {};
    const lat = Number(src.lat);
    const lon = Number(src.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
        lat,
        lon,
        alt: Number.isFinite(Number(src.alt)) ? Math.round(Number(src.alt)) : null,
        hdg: Number.isFinite(Number(src.hdg)) ? Math.round(Number(src.hdg)) : null,
        gs: Number.isFinite(Number(src.gs)) ? Math.round(Number(src.gs) * 10) / 10 : null,
        ts: Number.isFinite(Number(src.ts)) ? Number(src.ts) : Date.now()
    };
}

function _compactFlightDataForRuntime(fd = null) {
    const src = fd || window.lastLiveFlightData || {};
    if (!src || typeof src !== 'object') return null;
    return {
        onGround: typeof src.onGround === 'boolean' ? src.onGround : null,
        parkingBrake: src.parkingBrake === true || src.parkingBrake === 1,
        gsKts: Number.isFinite(Number(src.gsKts ?? src.gs)) ? Math.round(Number(src.gsKts ?? src.gs) * 10) / 10 : null,
        aglFt: Number.isFinite(Number(src.aglFt)) ? Math.round(Number(src.aglFt)) : null,
        simPaused: src.simPaused === true,
        inMenuOrMap: src.inMenuOrMap === true
    };
}

function _missionRuntimeSnapshotMissionId(snapshot = null) {
    return _normalizeMissionRuntimeId(snapshot?.missionId || snapshot?.runtime?.missionId || '');
}

function _readMissionRuntimeSnapshot() {
    try {
        const raw = localStorage.getItem(MISSION_RUNTIME_RESUME_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
        return null;
    }
}

function _writeMissionRuntimeSnapshot(snapshot = null) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    try {
        localStorage.setItem(MISSION_RUNTIME_RESUME_KEY, JSON.stringify(snapshot));
        return true;
    } catch (_) {
        return false;
    }
}

function _clearMissionRuntimeSnapshot(reason = 'mission-runtime-clear') {
    if (missionRuntimeSnapshotTimer) {
        clearTimeout(missionRuntimeSnapshotTimer);
        missionRuntimeSnapshotTimer = null;
    }
    missionRuntimePendingSnapshotReason = '';
    try { localStorage.removeItem(MISSION_RUNTIME_RESUME_KEY); } catch (_) {}
    missionRuntimeResumeSuppressedFor = _activeMissionRuntimeId('') || missionRuntimeResumeSuppressedFor;
    missionRuntimeResumeAppliedFor = '';
    _missionPhaseDebugPush('resume_snapshot_clear', { reason });
}

function _prepareFreshMissionRuntimeStart(reason = 'mission-start-prepare') {
    const missionId = _activeMissionRuntimeId('');
    _clearMissionRuntimeSnapshot(reason);
    if (missionId) missionRuntimeResumeSuppressedFor = missionId;
    missionRuntimeResumeAppliedFor = '';
    _clearActiveMissionRuntimeMarker(reason);
    if (!_trackerSupportsMissionAuthority()) _sendMissionLifecycleToTracker('ended', reason);
    _missionPhaseDebugPush('fresh_start_guard', {
        reason,
        missionId: missionId || null,
        resumeSuppressed: !!missionId
    });
    return missionId;
}

function _missionRuntimePhaseCountsAsStarted(phase = '') {
    const p = String(phase || '').toLowerCase();
    return ['prepare', 'boarding', 'boarded', 'active', 'end_ready', 'closing'].includes(p);
}

function _mutateStoredActiveMissionRuntimeMarker(mutator) {
    let state = null;
    try {
        state = JSON.parse(localStorage.getItem('ga_active_mission') || 'null');
    } catch (_) {
        state = null;
    }
    if (!state || typeof state !== 'object') return false;
    try {
        mutator(state);
        localStorage.setItem('ga_active_mission', JSON.stringify(state));
        if (typeof window !== 'undefined' && window.__gaActiveMissionStorageFallback && typeof window.__gaActiveMissionStorageFallback === 'object') {
            try { mutator(window.__gaActiveMissionStorageFallback); } catch (_) {}
        }
        return true;
    } catch (_) {
        return false;
    }
}

function _touchActiveMissionRuntimeMarker(reason = 'runtime') {
    const missionId = _activeMissionRuntimeId('');
    if (!missionId) return false;
    const now = Date.now();
    if (!missionRuntime.startedAt) missionRuntime.startedAt = now;
    const phase = String(missionRuntime.phase || _missionRuntimePhaseSnapshot() || 'active');
    const applyMarker = obj => {
        if (!obj || typeof obj !== 'object') return;
        obj.activeMissionRuntimeStartedAt = Number(obj.activeMissionRuntimeStartedAt || missionRuntime.startedAt || now) || now;
        obj.activeMissionRuntimeSavedAt = now;
        obj.activeMissionRuntimePhase = phase;
        obj.activeMissionRuntimeMissionId = missionId;
    };
    try { applyMarker(currentMissionData); } catch (_) {}
    try { applyMarker(window.activeMissionContract); } catch (_) {}
    return _mutateStoredActiveMissionRuntimeMarker(state => {
        const startedAt = Number(state.activeMissionRuntimeStartedAt || missionRuntime.startedAt || now) || now;
        state.activeMissionRuntimeStartedAt = startedAt;
        state.activeMissionRuntimeSavedAt = now;
        state.activeMissionRuntimePhase = phase;
        state.activeMissionRuntimeMissionId = missionId;
        const md = state.currentMissionData && typeof state.currentMissionData === 'object' ? state.currentMissionData : null;
        if (md) {
            md.activeMissionRuntimeStartedAt = Number(md.activeMissionRuntimeStartedAt || startedAt) || startedAt;
            md.activeMissionRuntimeSavedAt = now;
            md.activeMissionRuntimePhase = phase;
            md.activeMissionRuntimeMissionId = missionId;
        }
        const contract = state.activeMissionContract && typeof state.activeMissionContract === 'object' ? state.activeMissionContract : null;
        if (contract) {
            contract.activeMissionRuntimeStartedAt = Number(contract.activeMissionRuntimeStartedAt || startedAt) || startedAt;
            contract.activeMissionRuntimeSavedAt = now;
            contract.activeMissionRuntimePhase = phase;
            contract.activeMissionRuntimeMissionId = missionId;
        }
    });
}

function _clearActiveMissionRuntimeMarker(reason = 'runtime-clear') {
    const clear = obj => {
        if (!obj || typeof obj !== 'object') return;
        delete obj.activeMissionRuntimeStartedAt;
        delete obj.activeMissionRuntimeSavedAt;
        delete obj.activeMissionRuntimePhase;
        delete obj.activeMissionRuntimeMissionId;
    };
    missionRuntime.startedAt = 0;
    try { clear(currentMissionData); } catch (_) {}
    try { clear(window.activeMissionContract); } catch (_) {}
    return _mutateStoredActiveMissionRuntimeMarker(state => {
        clear(state);
        clear(state.currentMissionData);
        clear(state.activeMissionContract);
        if (state.currentMissionData?.missionContract) clear(state.currentMissionData.missionContract);
    });
}

function _compactFlightRecordForRuntime(record = null) {
    if (!record || typeof record !== 'object') return null;
    const finiteOrNull = value => value != null && Number.isFinite(Number(value)) ? Number(value) : null;
    return {
        createdAt: finiteOrNull(record.createdAt),
        endTs: finiteOrNull(record.endTs),
        startTs: finiteOrNull(record.startTs),
        depLabel: String(record.depLabel || '').slice(0, 64),
        arrLabel: String(record.arrLabel || '').slice(0, 64),
        durationSec: finiteOrNull(record.durationSec),
        distanceNm: finiteOrNull(record.distanceNm),
        distanceSource: String(record.distanceSource || '').slice(0, 24),
        maxGs: finiteOrNull(record.maxGs),
        maxAltFt: finiteOrNull(record.maxAltFt),
        touchdownVsFpm: finiteOrNull(record.touchdownVsFpm),
        maxBankDeg: finiteOrNull(record.maxBankDeg),
        maxGForce: finiteOrNull(record.maxGForce),
        avgGForce: finiteOrNull(record.avgGForce),
        maxClimbFpm: finiteOrNull(record.maxClimbFpm),
        maxDescentFpm: finiteOrNull(record.maxDescentFpm),
        minEnrouteAglFt: finiteOrNull(record.minEnrouteAglFt),
        cruiseAltitudeMeanFt: finiteOrNull(record.cruiseAltitudeMeanFt),
        cruiseAltitudeStdDevFt: finiteOrNull(record.cruiseAltitudeStdDevFt),
        cruiseAltitudeRangeFt: finiteOrNull(record.cruiseAltitudeRangeFt),
        telemetrySampleCount: Math.max(0, Math.round(Number(record.telemetrySampleCount || 0))),
        bankSampleCount: Math.max(0, Math.round(Number(record.bankSampleCount || 0))),
        gForceSampleCount: Math.max(0, Math.round(Number(record.gForceSampleCount || 0))),
        enrouteSampleCount: Math.max(0, Math.round(Number(record.enrouteSampleCount || 0))),
        aglSampleCount: Math.max(0, Math.round(Number(record.aglSampleCount || 0))),
        cruiseSampleCount: Math.max(0, Math.round(Number(record.cruiseSampleCount || 0))),
        cruiseDurationSec: Math.max(0, Math.round(Number(record.cruiseDurationSec || 0))),
        telemetryStatus: String(record.telemetryStatus || '').slice(0, 24),
        missionCargoOutcome: record.missionCargoOutcome
            ? _safeCloneJson(record.missionCargoOutcome, null)
            : null,
        missionFailed: !!record.missionFailed,
        poiNeedsRideHome: !!record.poiNeedsRideHome
    };
}

function _buildMissionRuntimeSnapshot(reason = 'runtime') {
    const missionId = _activeMissionRuntimeId('');
    if (!missionId) return null;
    const startPhase = _missionStartPhase();
    const poiProgress = _missionPoiProgressState();
    const bushProgress = _activeBushMissionProgress();
    const cargoManifest = (typeof _missionCargoGetManifest === 'function')
        ? _safeCloneJson(_missionCargoGetManifest(), null)
        : null;
    return {
        version: 1,
        missionId,
        startedAt: Number(missionRuntime.startedAt || 0),
        savedAt: Date.now(),
        reason: String(reason || 'runtime'),
        startPhase,
        runtime: {
            missionId,
            phase: String(missionRuntime.phase || _missionRuntimePhaseSnapshot() || 'idle'),
            startedAt: Number(missionRuntime.startedAt || 0),
            active: !!missionRuntime.active,
            manual: !!missionRuntime.manual,
            armed: !!missionRuntime.armed,
            closingPending: !!missionRuntime.closingPending,
            closingReason: String(missionRuntime.closingReason || ''),
            waitingFarewellDeboarding: !!missionRuntime.waitingFarewellDeboarding,
            deboardingAfterFarewellStarted: !!missionRuntime.deboardingAfterFarewellStarted,
            endDeboardingCommandId: String(missionRuntime.endDeboardingCommandId || ''),
            endReadinessKey: String(missionRuntime.endReadinessKey || ''),
            completionRecord: missionRuntime.completionRecord
                ? _safeCloneJson(missionRuntime.completionRecord, null)
                : null,
            arrivalFlightRecord: _compactFlightRecordForRuntime(missionRuntime.arrivalFlightRecord),
            pendingFarewellRecord: _compactFlightRecordForRuntime(missionRuntime.pendingFarewellRecord)
        },
        poiProgress: poiProgress ? {
            satisfied: !!poiProgress.satisfied,
            aborted: !!poiProgress.aborted,
            manualConfirmed: !!poiProgress.manualConfirmed,
            atTargetDone: !!poiProgress.atTargetDone,
            dwellSec: Math.max(0, Number(poiProgress.dwellSec || 0)),
            attempts: Math.max(0, Number(poiProgress.attempts || 0)),
            surveyPattern: poiProgress.surveyPattern ? _safeCloneJson(poiProgress.surveyPattern, null) : null,
            poiChain: poiProgress.poiChain ? _safeCloneJson(poiProgress.poiChain, null) : null,
            trainingProcedure: poiProgress.trainingProcedure ? _safeCloneJson(poiProgress.trainingProcedure, null) : null,
            sarHeli: poiProgress.sarHeli ? _safeCloneJson(poiProgress.sarHeli, null) : null
        } : null,
        bushProgress: bushProgress ? _safeCloneJson(bushProgress, null) : null,
        cargoManifest,
        complianceInspection: (typeof currentMissionData !== 'undefined' && currentMissionData?.complianceInspection)
            ? _safeCloneJson(currentMissionData.complianceInspection, null)
            : null,
        flightRecorder: flightRecorder ? {
            active: !!flightRecorder.active,
            armed: !!flightRecorder.armed,
            hadAirbornePhase: !!flightRecorder.hadAirbornePhase,
            airborneEvidenceSec: Math.max(0, Number(flightRecorder.airborneEvidenceSec || 0)),
            maxAglFt: Math.max(0, Number(flightRecorder.maxAglFt || 0)),
            maxAltFt: Math.max(0, Number(flightRecorder.maxAltFt || 0)),
            distNm: Math.max(0, Number(flightRecorder.distNm || 0)),
            startTs: Number(flightRecorder.startTs || 0),
            endTs: Number(flightRecorder.endTs || 0),
            maxGs: Math.max(0, Number(flightRecorder.maxGs || 0)),
            sumGs: Math.max(0, Number(flightRecorder.sumGs || 0)),
            gsSamples: Math.max(0, Number(flightRecorder.gsSamples || 0)),
            maxBankDeg: Math.max(0, Number(flightRecorder.maxBankDeg || 0)),
            bankSamples: Math.max(0, Number(flightRecorder.bankSamples || 0)),
            maxGForce: Math.max(0, Number(flightRecorder.maxGForce || 1)),
            sumGForce: Math.max(0, Number(flightRecorder.sumGForce || 0)),
            gForceSamples: Math.max(0, Number(flightRecorder.gForceSamples || 0)),
            maxClimbFpm: Math.max(0, Number(flightRecorder.maxClimbFpm || 0)),
            maxDescentFpm: Math.min(0, Number(flightRecorder.maxDescentFpm || 0)),
            touchdownVsFpm: flightRecorder.touchdownVsFpm != null && Number.isFinite(Number(flightRecorder.touchdownVsFpm)) ? Number(flightRecorder.touchdownVsFpm) : null,
            minEnrouteAglFt: flightRecorder.minEnrouteAglFt != null && Number.isFinite(Number(flightRecorder.minEnrouteAglFt)) ? Number(flightRecorder.minEnrouteAglFt) : null,
            enrouteSamples: Math.max(0, Number(flightRecorder.enrouteSamples || 0)),
            aglSamples: Math.max(0, Number(flightRecorder.aglSamples || 0)),
            levelAltSamples: Math.max(0, Number(flightRecorder.levelAltSamples || 0)),
            levelAltMeanFt: Number(flightRecorder.levelAltMeanFt || 0),
            levelAltM2: Math.max(0, Number(flightRecorder.levelAltM2 || 0)),
            levelAltMinFt: flightRecorder.levelAltMinFt != null && Number.isFinite(Number(flightRecorder.levelAltMinFt)) ? Number(flightRecorder.levelAltMinFt) : null,
            levelAltMaxFt: flightRecorder.levelAltMaxFt != null && Number.isFinite(Number(flightRecorder.levelAltMaxFt)) ? Number(flightRecorder.levelAltMaxFt) : null,
            levelAltDurationSec: Math.max(0, Number(flightRecorder.levelAltDurationSec || 0)),
            lastSample: Array.isArray(flightRecorder.lastSample)
                && flightRecorder.lastSample.length >= 2
                && Number.isFinite(Number(flightRecorder.lastSample[0]))
                && Number.isFinite(Number(flightRecorder.lastSample[1]))
                ? [Number(flightRecorder.lastSample[0]), Number(flightRecorder.lastSample[1])]
                : null
        } : null,
        comfort: typeof window.paxVoiceGetComfortState === 'function'
            ? _safeCloneJson(window.paxVoiceGetComfortState(), null)
            : null,
        sceneStatus: {
            sceneId: window.missionSceneStatus?.sceneId || null,
            spawned: !!window.missionSceneStatus?.spawned,
            spawnedCount: Math.max(0, Number(window.missionSceneStatus?.spawnedCount || 0)),
            boardingComplete: !!window.missionSceneStatus?.boardingComplete,
            personBoarded: !!window.missionSceneStatus?.personBoarded,
            autoClearedFor: window.missionSceneStatus?.autoClearedFor || null
        },
        targetSceneStatus: {
            sceneId: window.missionTargetSceneStatus?.sceneId || null,
            kind: window.missionTargetSceneStatus?.kind || null,
            spawned: !!window.missionTargetSceneStatus?.spawned,
            spawnedCount: Math.max(0, Number(window.missionTargetSceneStatus?.spawnedCount || 0))
        },
        aptArrivalSceneStatus: {
            sceneId: window.missionAptArrivalSceneStatus?.sceneId || null,
            role: window.missionAptArrivalSceneStatus?.role || null,
            spawned: !!window.missionAptArrivalSceneStatus?.spawned,
            spawnedCount: Math.max(0, Number(window.missionAptArrivalSceneStatus?.spawnedCount || 0))
        },
        lastLiveGpsPos: _compactLivePositionForRuntime(),
        lastLiveFlightData: _compactFlightDataForRuntime(),
        trackerMissionStatus: window.lastTrackerMissionStatus ? _safeCloneJson(window.lastTrackerMissionStatus, null) : null
    };
}

function _persistMissionRuntimeSnapshot(reason = 'runtime', options = {}) {
    const immediate = options.immediate === true;
    const minIntervalMs = Math.max(250, Number(options.minIntervalMs) || 2500);
    missionRuntimePendingSnapshotReason = String(reason || 'runtime');
    const writeNow = () => {
        if (missionRuntimeSnapshotTimer) {
            clearTimeout(missionRuntimeSnapshotTimer);
            missionRuntimeSnapshotTimer = null;
        }
        const latestReason = missionRuntimePendingSnapshotReason || String(reason || 'runtime');
        missionRuntimePendingSnapshotReason = '';
        const snapshot = _buildMissionRuntimeSnapshot(latestReason);
        if (!snapshot) return false;
        const runtimeStarted = !!(
            snapshot.runtime?.active
            || snapshot.runtime?.closingPending
            || _missionRuntimePhaseCountsAsStarted(snapshot.startPhase)
            || _missionRuntimePhaseCountsAsStarted(snapshot.runtime?.phase)
        );
        if (runtimeStarted) {
            if (!missionRuntime.startedAt) missionRuntime.startedAt = Date.now();
            snapshot.startedAt = Number(snapshot.startedAt || missionRuntime.startedAt || Date.now());
            if (snapshot.runtime && typeof snapshot.runtime === 'object') snapshot.runtime.startedAt = snapshot.startedAt;
            _touchActiveMissionRuntimeMarker(latestReason);
        }
        missionRuntimeSnapshotTimer = null;
        missionRuntimeLastPersistAt = Date.now();
        const written = _writeMissionRuntimeSnapshot(snapshot);
        if (written) _queueMissionAuthoritySnapshot(latestReason, { immediate });
        return written;
    };
    if (immediate || (Date.now() - missionRuntimeLastPersistAt) >= minIntervalMs) return writeNow();
    if (!missionRuntimeSnapshotTimer) {
        missionRuntimeSnapshotTimer = setTimeout(writeNow, Math.max(250, minIntervalMs - (Date.now() - missionRuntimeLastPersistAt)));
    }
    return true;
}

window.missionPersistRuntimeSnapshot = _persistMissionRuntimeSnapshot;

function _snapshotMatchesActiveMission(snapshot = null) {
    const snapId = _missionRuntimeSnapshotMissionId(snapshot);
    const activeId = _activeMissionRuntimeId('');
    return !!(snapId && activeId && snapId === activeId);
}

window.gaMissionPhaseDebugGet = function() {
    return JSON.parse(JSON.stringify(_missionPhaseDebugState()));
};

window.gaMissionPhaseDebugRecord = function(kind = 'event', payload = {}) {
    return _missionPhaseDebugPush(kind, payload);
};

window.gaMissionPhaseDebugClear = function() {
    window.gaMissionPhaseDebug = null;
    try { localStorage.removeItem(MISSION_PHASE_DEBUG_STORAGE_KEY); } catch (_) {}
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
    lastSpawnFailedAt: 0,
    spawnRequested: false,
    clearRequested: false,
    boardingPreparing: false,
    boardingRequested: false,
    boardingActive: false,
    boardingComplete: false,
    boardingError: null,
    boardingCueCommandId: '',
    boardingVoiceComplete: false,
    deboardingRequested: false,
    deboardingActive: false,
    deboardingComplete: false,
    deboardingError: null,
    deboardingCommandId: '',
    deboardingCueCommandId: '',
    manualPaxRequested: false,
    manualPaxActive: false,
    manualPaxError: null,
    personBoarded: false,
    autoSpawnedFor: null,
    autoClearedFor: null,
    respawnAfterClear: false,
    respawnAfterClearReason: ''
};
window.missionCargoStatus = {
    manifestKey: '',
    lastMode: 'load',
    loadConfirmed: false,
    signatureAnimationEndsAt: 0,
    signatureAnimationTimer: 0,
    arrivalAutoOpenedFor: '',
    groundUiKey: '',
    lastEquipmentLossAt: 0,
    lastEquipmentLossIds: [],
    lastCommandAt: 0,
    lastAckAt: 0,
    lastAck: null,
    error: null,
    manualPaxPending: null,
    payloadMissionKey: '',
    payloadBaseline: null,
    payloadLayout: null,
    payloadPlan: null,
    payloadSyncRunning: false,
    payloadSyncQueued: '',
    payloadSyncRevision: 0,
    payloadSyncScheduledAt: 0,
    payloadFinalizeRunning: false,
    payloadFinalizeSeq: 0,
    payloadStartOverride: false,
    payloadSyncAt: 0,
    payloadNeedsSync: false,
    payloadVerification: null,
    payloadVerificationRunning: false,
    payloadPendingResetStations: null,
    payloadPendingResetMaxStations: 0,
    payloadPendingResetAdapter: '',
    payloadPendingResetPa24State: null,
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
    lastSpawnFailedAt: 0,
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
    lastSpawnFailedAt: 0,
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
        missionId: command.missionId || null,
        missionPhase: command.missionPhase || null,
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

window.missionRuntimeStartedAt = function() {
    return Number(missionRuntime.startedAt || 0);
};

window.missionComplianceAtFinalEndpoint = function() {
    if (!missionRuntime.active || missionRuntime.closingPending) return false;
    if (typeof window.missionIsFreeflightOnly === 'function' && window.missionIsFreeflightOnly()) return false;
    return !!(_missionRuntimeGroundEndReady() && _missionHadMeaningfulFlightForEnd());
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

function _missionTrainingSceneCanAutoAccept(candidate = null) {
    const md = (candidate && typeof candidate === 'object')
        ? (candidate.currentMissionData && typeof candidate.currentMissionData === 'object' ? candidate.currentMissionData : candidate)
        : null;
    if (!md) return false;
    const isCurrentMission = (typeof currentMissionData !== 'undefined' && currentMissionData && md === currentMissionData);
    const contract = (md.missionContract && typeof md.missionContract === 'object')
        ? md.missionContract
        : (isCurrentMission && window.activeMissionContract && typeof window.activeMissionContract === 'object' ? window.activeMissionContract : null);
    const taskDomain = String(
        md?.passenger?.taskDomain
        || contract?.taskDomain
        || contract?.profile?.taskDomain
        || md?.missionContractV4?.profile?.taskDomain
        || md?.missionPlanV4?.plan?.taskDomain
        || md?.missionPlanV2?.plan?.taskDomain
        || ''
    ).trim().toLowerCase();
    const category = String(
        md?.requestedCategory
        || md?.poiCategory
        || md?.category
        || md?.cat
        || contract?.requestedCategory
        || contract?.category
        || contract?.profile?.requestedCategory
        || contract?.profile?.pickerCategory
        || ''
    ).trim().toLowerCase();
    const isTraining = /^(training|club_training_basic|club_training_advanced)$/.test(taskDomain) || category === 'trn';
    if (!isTraining) return false;
    const sceneKind = String(
        md?.targetScene?.kind
        || md?.targetSceneAiNormalized?.kind
        || contract?.targetScene?.kind
        || md?.missionPlanV2?.plan?.sceneKind
        || contract?.missionPlanV2?.plan?.sceneKind
        || ''
    ).trim().toLowerCase();
    return !sceneKind || sceneKind === 'none';
}
window.missionTrainingSceneCanAutoAccept = _missionTrainingSceneCanAutoAccept;

function _missionAcceptTrainingNoSceneDraft(candidate = null, reason = 'training-no-scene') {
    const md = (candidate && typeof candidate === 'object')
        ? (candidate.currentMissionData && typeof candidate.currentMissionData === 'object' ? candidate.currentMissionData : candidate)
        : null;
    if (!_missionTrainingSceneCanAutoAccept(md)) return false;
    const changed = md.sceneAccepted !== true || String(md.sceneCompositionStatus || '').toLowerCase() !== 'accepted';
    md.sceneAccepted = true;
    md.sceneCompositionStatus = 'accepted';
    md.sceneCompositionStartedAt = 0;
    if (md.missionContract && typeof md.missionContract === 'object') {
        md.missionContract.sceneAccepted = true;
        md.missionContract.sceneCompositionStatus = 'accepted';
    }
    const isCurrentMission = (typeof currentMissionData !== 'undefined' && currentMissionData && md === currentMissionData);
    if (isCurrentMission && window.activeMissionContract && typeof window.activeMissionContract === 'object' && (window.activeMissionContract === md.missionContract || !window.activeMissionContract.sceneAccepted)) {
        window.activeMissionContract.sceneAccepted = true;
        window.activeMissionContract.sceneCompositionStatus = 'accepted';
    }
    if (changed) {
        _missionPhaseDebugPush('scene_accept', { reason, mode: 'training-no-scene' });
        try {
            if (typeof window.debouncedSaveMissionState === 'function') window.debouncedSaveMissionState();
            else if (typeof window.saveMissionState === 'function') window.saveMissionState();
        } catch (_) {}
    }
    return true;
}
window.missionAcceptTrainingNoSceneDraft = _missionAcceptTrainingNoSceneDraft;

function _missionSceneAcceptedForRuntime() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (!md) return false;
    if (_missionIsFreeflightOnly(md)) return false;
    if (_missionTrainingSceneCanAutoAccept(md)) {
        return _missionAcceptTrainingNoSceneDraft(md, 'runtime-gate');
    }
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

function _missionSceneSpawnBackoffActive(status = {}, sceneId = '') {
    if (!status || typeof status !== 'object') return false;
    if (sceneId && status.sceneId && String(status.sceneId) !== String(sceneId)) return false;
    const failedAt = Number(status.lastSpawnFailedAt || 0);
    return Number.isFinite(failedAt) && failedAt > 0 && (Date.now() - failedAt) < MISSION_SCENE_SPAWN_ERROR_COOLDOWN_MS;
}

function _missionSceneSpawnPendingActive(status = {}, sceneId = '') {
    if (!status || typeof status !== 'object' || !status.spawnRequested) return false;
    if (sceneId && status.sceneId && String(status.sceneId) !== String(sceneId)) return false;
    const ageMs = Date.now() - Number(status.lastCommandAt || 0);
    if (Number.isFinite(ageMs) && ageMs < MISSION_SCENE_SPAWN_PENDING_STALE_MS) return true;
    status.spawnRequested = false;
    status.lastSpawnFailedAt = Date.now();
    status.error = status.error || 'scene_spawn_ack_timeout';
    return false;
}

function _missionSceneHandleFlightTick(flightData = null, reason = 'gps-tick') {
    if (typeof window.missionSceneSpawn !== 'function' || typeof window.missionSceneClear !== 'function') return;
    if (_missionIsFreeflightOnly()) return;
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
    const spawnPending = _missionSceneSpawnPendingActive(status, sceneId);
    if (status.sceneId === sceneId && (status.spawned || spawnPending)) {
        status.blockReason = status.spawned ? 'already_spawned' : 'spawn_pending';
        return;
    }
    if (_missionSceneSpawnBackoffActive(status, sceneId)) {
        status.blockReason = 'spawn_error_cooldown';
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
    const commandType = String(command.type || '');
    const missionAuthorityProtocol = /^mission_(authority|snapshot)_/i.test(commandType);
    const missionScopedCommand = /^mission_(scene|smoke)_/i.test(commandType) || commandType === 'mission_lifecycle';
    const missionId = missionScopedCommand
        ? _normalizeMissionRuntimeId(command.missionId || _activeMissionRuntimeId('active'))
        : (missionAuthorityProtocol ? _normalizeMissionRuntimeId(command.missionId || '') : '');
    const missionPhase = missionScopedCommand && typeof _missionRuntimePhaseSnapshot === 'function'
        ? _missionRuntimePhaseSnapshot()
        : '';
    const trackerCommand = {
        ...command,
        commandId,
        pin: getSyncPin()
    };
    if ((missionScopedCommand || missionAuthorityProtocol) && missionId) trackerCommand.missionId = missionId;
    if (missionScopedCommand && missionPhase) trackerCommand.missionPhase = missionPhase;
    if (_trackerSupportsMissionAuthority() && (missionScopedCommand || missionAuthorityProtocol)) {
        const authority = _readMissionAuthorityState();
        trackerCommand.clientId = String(command.clientId || authority?.clientId || _missionAuthorityClientId());
        if (authority?.missionId === missionId && authority.runId) {
            trackerCommand.runId = String(command.runId || authority.runId);
            trackerCommand.expectedRevision = Math.max(1, Math.round(Number(command.expectedRevision || authority.revision) || 1));
        }
    }
    const payload = {
        type: 'gps',
        syncId: getSyncId(),
        pin: getSyncPin(),
        target: 'tracker',
        commandOnly: true,
        trackerCommand
    };
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
        payload.lat = lat;
        payload.lon = lon;
        payload.alt = Math.round(Number.isFinite(alt) ? alt : 0);
        payload.hdg = Math.round(Number.isFinite(hdg) ? hdg : 0);
    }
    if (/^mission_scene_(spawn|boarding|deboarding|ground_visit)$/i.test(String(command.type || '')) && command.sceneId) {
        _rememberMissionSceneId(command.sceneId);
    }
    if (missionScopedCommand || missionAuthorityProtocol) {
        _rememberMissionAuthorityLocalCommand(commandId, commandType);
    }
    ws.send(JSON.stringify(payload));
    _trackerPendingMarkSent(trackerCommand, commandId, options);
    if (missionScopedCommand) {
        const summary = _missionSceneDebugCommandSummary(trackerCommand, commandId, payload);
        const patch = { lastCommand: summary };
        if (commandType === 'mission_scene_spawn') {
            if (trackerCommand.targetSceneKind) patch.lastTargetSceneCommand = summary;
            else patch.lastStartSceneCommand = summary;
        } else if (commandType === 'mission_scene_deboarding' || commandType === 'mission_scene_ground_visit') {
            patch.lastEndSceneCommand = summary;
        } else if (commandType === 'mission_scene_clear') {
            if (String(trackerCommand.sceneId || '').includes('-target')) patch.lastTargetSceneCommand = null;
            else patch.lastStartSceneCommand = null;
        } else if (/^mission_smoke_/i.test(commandType)) {
            patch.lastSmokeCommand = summary;
        }
        _missionSceneDebugPatch(patch, `tracker-command:${trackerCommand.type}`);
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

function _normalizeMissionRuntimeId(value = '') {
    const raw = String(value || '').trim();
    return raw ? raw.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 96) : '';
}

function _activeMissionRuntimeId(fallback = 'active') {
    const fs = _activeFireScenario();
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (_missionIsFreeflightOnly(md)) return '';
    const contract = window.activeMissionContract || md?.missionContract || null;
    const id = _normalizeMissionRuntimeId(
        fs?.missionId
        || md?.missionId
        || md?.id
        || md?.missionKey
        || contract?.missionId
        || ''
    );
    return id || _normalizeMissionRuntimeId(fallback);
}

function _trackerAckMatchesActiveMission(ack = {}) {
    const ackMissionId = _normalizeMissionRuntimeId(ack?.missionId || '');
    if (!ackMissionId) return true;
    const activeMissionId = _activeMissionRuntimeId('');
    if (!activeMissionId) return true;
    return ackMissionId === activeMissionId;
}

function _sendMissionLifecycleToTracker(state = 'active', reason = 'mission-lifecycle') {
    if (window.simModeActive || !window.liveTrackerConnected || typeof window.sendTrackerCommand !== 'function') return false;
    const missionId = _activeMissionRuntimeId('');
    if (!missionId) return false;
    return !!window.sendTrackerCommand({
        type: 'mission_lifecycle',
        missionId,
        state: String(state || 'active'),
        reason
    });
}

function _restoreFlightRecorderFromRuntimeSnapshot(snapshot = null) {
    const src = snapshot?.flightRecorder;
    if (!src || typeof src !== 'object' || !flightRecorder || typeof flightRecorder !== 'object') return false;
    flightRecorder.active = !!src.active;
    flightRecorder.armed = !!src.armed;
    flightRecorder.hadAirbornePhase = !!src.hadAirbornePhase;
    flightRecorder.airborneEvidenceSec = Math.max(0, Number(src.airborneEvidenceSec || 0));
    flightRecorder.maxAglFt = Math.max(0, Number(src.maxAglFt || 0));
    flightRecorder.maxAltFt = Math.max(0, Number(src.maxAltFt || 0));
    flightRecorder.distNm = Math.max(0, Number(src.distNm || 0));
    flightRecorder.startTs = Number(src.startTs || 0);
    flightRecorder.endTs = Number(src.endTs || 0);
    flightRecorder.maxGs = Math.max(0, Number(src.maxGs || 0));
    flightRecorder.sumGs = Math.max(0, Number(src.sumGs || 0));
    flightRecorder.gsSamples = Math.max(0, Number(src.gsSamples || 0));
    flightRecorder.maxBankDeg = Math.max(0, Number(src.maxBankDeg || 0));
    flightRecorder.bankSamples = Math.max(0, Number(src.bankSamples || 0));
    flightRecorder.maxGForce = Math.max(0, Number(src.maxGForce || 1));
    flightRecorder.sumGForce = Math.max(0, Number(src.sumGForce || 0));
    flightRecorder.gForceSamples = Math.max(0, Number(src.gForceSamples || 0));
    flightRecorder.maxClimbFpm = Math.max(0, Number(src.maxClimbFpm || 0));
    flightRecorder.maxDescentFpm = Math.min(0, Number(src.maxDescentFpm || 0));
    flightRecorder.touchdownVsFpm = src.touchdownVsFpm != null && Number.isFinite(Number(src.touchdownVsFpm)) ? Number(src.touchdownVsFpm) : null;
    flightRecorder.minEnrouteAglFt = src.minEnrouteAglFt != null && Number.isFinite(Number(src.minEnrouteAglFt)) ? Number(src.minEnrouteAglFt) : null;
    flightRecorder.enrouteSamples = Math.max(0, Number(src.enrouteSamples || 0));
    flightRecorder.aglSamples = Math.max(0, Number(src.aglSamples || 0));
    flightRecorder.levelAltSamples = Math.max(0, Number(src.levelAltSamples || 0));
    flightRecorder.levelAltMeanFt = Number(src.levelAltMeanFt || 0);
    flightRecorder.levelAltM2 = Math.max(0, Number(src.levelAltM2 || 0));
    flightRecorder.levelAltMinFt = src.levelAltMinFt != null && Number.isFinite(Number(src.levelAltMinFt)) ? Number(src.levelAltMinFt) : null;
    flightRecorder.levelAltMaxFt = src.levelAltMaxFt != null && Number.isFinite(Number(src.levelAltMaxFt)) ? Number(src.levelAltMaxFt) : null;
    flightRecorder.levelAltDurationSec = Math.max(0, Number(src.levelAltDurationSec || 0));
    flightRecorder.lastSample = Array.isArray(src.lastSample)
        && src.lastSample.length >= 2
        && Number.isFinite(Number(src.lastSample[0]))
        && Number.isFinite(Number(src.lastSample[1]))
        ? [Number(src.lastSample[0]), Number(src.lastSample[1])]
        : null;
    return true;
}

function _restoreCargoManifestFromRuntimeSnapshot(snapshot = null) {
    const manifest = snapshot?.cargoManifest;
    if (!manifest || typeof manifest !== 'object') return false;
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (!md || typeof md !== 'object') return false;
    const currentKey = (typeof _missionCargoMissionKey === 'function') ? _missionCargoMissionKey() : '';
    if (manifest.key && currentKey && manifest.key !== currentKey) return false;
    md.cargoManifest = manifest;
    if (md.missionContract && typeof md.missionContract === 'object') md.missionContract.cargoManifest = manifest;
    if (window.activeMissionContract && typeof window.activeMissionContract === 'object') window.activeMissionContract.cargoManifest = manifest;
    if (window.missionCargoStatus) window.missionCargoStatus.manifestKey = manifest.key || currentKey || '';
    return true;
}

function _missionAuthorityShouldSuppressFreshStartRestore(snapshotMissionId = '', options = {}) {
    const missionId = _normalizeMissionRuntimeId(snapshotMissionId || '');
    return !!(
        missionId
        && missionRuntimeResumeSuppressedFor === missionId
        && !missionRuntime.active
        && !missionRuntime.closingPending
        && options.authorityConfirmed !== true
    );
}

function _restoreMissionRuntimeFromSnapshot(snapshot = null, options = {}) {
    const snap = snapshot || _readMissionRuntimeSnapshot();
    if (!snap || !_snapshotMatchesActiveMission(snap)) return false;
    const snapId = _missionRuntimeSnapshotMissionId(snap);
    if (_missionAuthorityShouldSuppressFreshStartRestore(snapId, options)) {
        _missionPhaseDebugPush('resume_suppressed', {
            reason: options.reason || 'mission-resume',
            missionId: snapId,
            state: 'fresh-start'
        });
        return false;
    }
    if (snapId
        && missionRuntimeResumeSuppressedFor === snapId
        && options.authorityConfirmed === true) {
        _missionPhaseDebugPush('resume_fresh_start_guard_overridden', {
            reason: options.reason || 'mission-resume',
            missionId: snapId,
            source: 'tracker-authority'
        });
    }
    const ageMs = Date.now() - Number(snap.savedAt || 0);
    const pendingCompletion = _readPendingMissionDebrief();
    const hasPendingCompletion = !!(pendingCompletion?.missionId && pendingCompletion.missionId === snapId);
    if (!Number.isFinite(ageMs) || (ageMs > 12 * 60 * 60 * 1000 && !hasPendingCompletion && options.authorityConfirmed !== true)) {
        _missionPhaseDebugPush('resume_snapshot_stale', {
            missionId: snapId,
            ageMin: Number.isFinite(ageMs) ? Math.round(ageMs / 60000) : null,
            reason: options.reason || 'mission-resume'
        });
        return false;
    }
    const runtime = snap.runtime && typeof snap.runtime === 'object' ? snap.runtime : {};
    const startPhase = String(snap.startPhase || '').toLowerCase();
    const phase = String(runtime.phase || snap.runtimePhase || '').toLowerCase();
    const trackerActive = options.trackerActive === true;
    const shouldBeClosing = !!runtime.closingPending || phase === 'closing';
    const shouldBeActive = !!runtime.active || ['active', 'end_ready'].includes(phase);
    const shouldRestore = shouldBeClosing || shouldBeActive || ['prepare', 'boarding', 'boarded'].includes(startPhase);
    if (!shouldRestore) return false;

    if (snap.poiProgress && typeof window.paxVoiceRestorePoiMissionProgress === 'function') {
        try { window.paxVoiceRestorePoiMissionProgress(snap.poiProgress, options.reason || 'mission-resume'); } catch (_) {}
    }
    if (snap.poiProgress?.sarHeli && typeof currentMissionData !== 'undefined' && currentMissionData && typeof currentMissionData === 'object') {
        currentMissionData.sarHeliProgress = _safeCloneJson(snap.poiProgress.sarHeli, null);
        if (currentMissionData.missionContract && typeof currentMissionData.missionContract === 'object') {
            currentMissionData.missionContract.sarHeliProgress = currentMissionData.sarHeliProgress;
        }
        if (window.activeMissionContract && typeof window.activeMissionContract === 'object') {
            window.activeMissionContract.sarHeliProgress = currentMissionData.sarHeliProgress;
        }
    }
    if (snap.bushProgress && typeof currentMissionData !== 'undefined' && currentMissionData && typeof currentMissionData === 'object') {
        currentMissionData.bushProgress = { ...snap.bushProgress };
    }
    _restoreCargoManifestFromRuntimeSnapshot(snap);
    if (snap.complianceInspection && typeof currentMissionData !== 'undefined' && currentMissionData && typeof currentMissionData === 'object') {
        currentMissionData.complianceInspection = _safeCloneJson(snap.complianceInspection, null);
        if (currentMissionData.missionContract && typeof currentMissionData.missionContract === 'object') {
            currentMissionData.missionContract.complianceInspection = currentMissionData.complianceInspection;
        }
        if (window.activeMissionContract && typeof window.activeMissionContract === 'object') {
            window.activeMissionContract.complianceInspection = currentMissionData.complianceInspection;
        }
    }
    _restoreFlightRecorderFromRuntimeSnapshot(snap);
    if (snap.comfort && typeof window.paxVoiceRestoreComfortState === 'function') {
        try { window.paxVoiceRestoreComfortState(snap.comfort); } catch (_) {}
    }

    if (shouldBeActive) {
        _setMissionStartPhase('boarded', { persist: false });
    } else if (['prepare', 'boarding', 'boarded'].includes(startPhase)) {
        // Nicht-idempotente Boarding-Animationen werden nach einem Reload nie
        // als laufend restauriert. Der Pilot kann sie kontrolliert neu starten.
        _setMissionStartPhase(startPhase === 'boarding' ? 'prepare' : startPhase, { persist: false });
    }

    missionRuntime.phase = shouldBeClosing ? 'closing' : (phase === 'end_ready' ? 'end_ready' : (shouldBeActive ? 'active' : _missionRuntimePhaseSnapshot()));
    missionRuntime.startedAt = Number(runtime.startedAt || snap.startedAt || snap.savedAt || Date.now()) || Date.now();
    missionRuntime.active = shouldBeActive && !shouldBeClosing;
    missionRuntime.armed = shouldBeActive && !shouldBeClosing;
    missionRuntime.manual = !!runtime.manual || shouldBeActive;
    missionRuntime.closingPending = shouldBeClosing;
    missionRuntime.closingReason = String(runtime.closingReason || (shouldBeClosing ? 'mission-resume-closing' : ''));
    const interruptedDeboarding = !!(runtime.waitingFarewellDeboarding || runtime.deboardingAfterFarewellStarted);
    if (interruptedDeboarding) {
        missionInterruptedDeboardingRecovery = {
            commandId: String(runtime.endDeboardingCommandId || ''),
            sceneId: String(snap.sceneStatus?.sceneId || _missionSceneId())
        };
    }
    missionRuntime.waitingFarewellDeboarding = false;
    missionRuntime.deboardingAfterFarewellStarted = false;
    missionRuntime.farewellSpeechStarted = false;
    missionRuntime.farewellSpeechComplete = false;
    missionRuntime.farewellDoorReady = false;
    missionRuntime.pendingFarewellRecord = null;
    missionRuntime.pendingFarewellReason = '';
    missionRuntime.arrivalFlightRecord = runtime.arrivalFlightRecord && typeof runtime.arrivalFlightRecord === 'object'
        ? _safeCloneJson(runtime.arrivalFlightRecord, null)
        : null;
    missionRuntime.pendingFarewellRecord = runtime.pendingFarewellRecord && typeof runtime.pendingFarewellRecord === 'object'
        ? _safeCloneJson(runtime.pendingFarewellRecord, null)
        : null;
    missionRuntime.completionRecord = runtime.completionRecord && typeof runtime.completionRecord === 'object'
        ? _safeCloneJson(runtime.completionRecord, null)
        : null;
    missionRuntime.endDeboardingAnimationExpected = false;
    missionRuntime.endDeboardingCompleted = false;
    missionRuntime.endDeboardingCommandId = '';
    missionRuntime.farewellPreloadRequestedAt = 0;
    missionRuntime.endReadinessKey = String(runtime.endReadinessKey || '');
    if (shouldBeClosing && !missionRuntime.closingRequestedAt) missionRuntime.closingRequestedAt = Date.now();

    if (window.missionSceneStatus && (shouldBeActive || startPhase === 'boarded')) {
        // Do not respawn the departure/boarding scene after an app restart.
        const restoredHasPassenger = !!(
            (typeof _missionCargoLoadedPassengerItems === 'function' && _missionCargoLoadedPassengerItems().length > 0)
            || (typeof _missionScenePaxCount === 'function' && _missionScenePaxCount() > 0)
        );
        window.missionSceneStatus.autoClearedFor = _missionSceneId();
        window.missionSceneStatus.boardingPreparing = false;
        window.missionSceneStatus.boardingRequested = false;
        window.missionSceneStatus.boardingActive = false;
        window.missionSceneStatus.boardingComplete = !!(snap.sceneStatus?.boardingComplete || startPhase === 'boarded' || shouldBeActive);
        window.missionSceneStatus.boardingVoiceComplete = !!(startPhase === 'boarded' || shouldBeActive);
        window.missionSceneStatus.personBoarded = restoredHasPassenger && !!(snap.sceneStatus?.personBoarded || startPhase === 'boarded' || shouldBeActive);
    }
    if (window.missionSceneStatus && startPhase === 'boarding' && !shouldBeActive) {
        _missionSceneResetBoardingState('boarding_restart_required', { clearPersonBoarded: false });
    }

    missionRuntimeResumeAppliedFor = snapId;
    if (missionRuntimeResumeSuppressedFor === snapId) missionRuntimeResumeSuppressedFor = '';
    _missionPhaseDebugPush('resume_restore', {
        reason: options.reason || 'mission-resume',
        missionId: snapId,
        startPhase,
        phase: missionRuntime.phase,
        active: !!missionRuntime.active,
        closing: !!missionRuntime.closingPending,
        trackerConfirmed: options.trackerConfirmed === true,
        trackerActive
    });
    _persistMissionRuntimeSnapshot(options.reason || 'mission-resume', { immediate: true });
    if (missionInterruptedDeboardingRecovery && window.liveTrackerConnected) {
        setTimeout(() => _missionSceneCancelInterruptedDeboarding('mission-resume'), 250);
    }
    _updateMissionRuntimeUi();
    try { window.missionComplianceResume?.(options.reason || 'mission-resume'); } catch (_) {}
    if (shouldBeClosing) {
        const pendingDebrief = pendingCompletion || _readPendingMissionDebrief();
        if (pendingDebrief && pendingDebrief.missionId === snapId) {
            missionRuntime.completionRecord = pendingDebrief;
            _showMissionCompletionDebrief(pendingDebrief);
        }
    }
    return true;
}

window.missionRuntimeRestoreFromSnapshot = _restoreMissionRuntimeFromSnapshot;

function _handleTrackerMissionStatus(status = null, reason = 'tracker-status') {
    if (!status || typeof status !== 'object') return false;
    const trackerMissionId = _normalizeMissionRuntimeId(status.missionId || '');
    if (!trackerMissionId) return false;
    const activeMissionId = _activeMissionRuntimeId('');
    const localAuthority = _readMissionAuthorityState();
    const trackerRunId = String(status.runId || '').trim();
    const runConflict = !!(trackerRunId && localAuthority?.runId && trackerRunId !== localAuthority.runId);
    const ownerConflict = !!(status.ownerClientId && status.ownerClientId !== _missionAuthorityClientId());
    const trackerActive = status.active !== false && !/^(ended|closed|reset|cleared)$/i.test(String(status.state || ''));
    if (!activeMissionId) {
        const now = Date.now();
        window.missionRuntimeResumeConflict = {
            reason: 'tracker-active-without-local-mission',
            trackerMissionId,
            trackerRunId: trackerRunId || null,
            ownerClientId: status.ownerClientId || null,
            trackerActive,
            at: now
        };
        const conflictSig = `tracker-active-without-local-mission|${trackerMissionId}|${trackerRunId}|${status.ownerClientId || ''}`;
        if (conflictSig !== missionRuntimeResumeConflictLastSig || now - missionRuntimeResumeConflictLastLogAt > 30000) {
            missionRuntimeResumeConflictLastSig = conflictSig;
            missionRuntimeResumeConflictLastLogAt = now;
            _missionPhaseDebugPush('resume_conflict', window.missionRuntimeResumeConflict);
            _updateMissionRuntimeUi();
        }
        return false;
    }
    if (trackerMissionId !== activeMissionId || runConflict || ownerConflict) {
        if (!trackerActive) {
            if (window.missionRuntimeResumeConflict?.trackerMissionId === trackerMissionId) {
                window.missionRuntimeResumeConflict = null;
                missionRuntimeResumeConflictLastSig = '';
                missionRuntimeResumeConflictLastLogAt = 0;
                _updateMissionRuntimeUi();
            }
            return true;
        }
        const now = Date.now();
        window.missionRuntimeResumeConflict = {
            reason: trackerMissionId !== activeMissionId
                ? 'mission-id-mismatch'
                : (runConflict ? 'mission-run-mismatch' : 'mission-owner-mismatch'),
            trackerMissionId,
            trackerRunId: trackerRunId || null,
            ownerClientId: status.ownerClientId || null,
            activeMissionId,
            trackerActive,
            at: now
        };
        const conflictSig = [
            window.missionRuntimeResumeConflict.reason,
            trackerMissionId,
            activeMissionId,
            trackerRunId || '',
            status.ownerClientId || '',
            trackerActive ? 'active' : 'inactive'
        ].join('|');
        if (conflictSig !== missionRuntimeResumeConflictLastSig || now - missionRuntimeResumeConflictLastLogAt > 30000) {
            missionRuntimeResumeConflictLastSig = conflictSig;
            missionRuntimeResumeConflictLastLogAt = now;
            _missionPhaseDebugPush('resume_conflict', window.missionRuntimeResumeConflict);
            _updateMissionRuntimeUi();
        }
        return false;
    }
    window.missionRuntimeResumeConflict = null;
    missionRuntimeResumeConflictLastSig = '';
    missionRuntimeResumeConflictLastLogAt = 0;
    if (trackerActive && missionRuntimeResumeSuppressedFor === trackerMissionId && !missionRuntime.active && !missionRuntime.closingPending) {
        const now = Date.now();
        const signature = `${trackerMissionId}|${status.runId || ''}|${status.state || ''}|${reason}`;
        if (signature !== missionRuntimeResumeSuppressedLastSig || now - missionRuntimeResumeSuppressedLastLogAt > 30000) {
            missionRuntimeResumeSuppressedLastSig = signature;
            missionRuntimeResumeSuppressedLastLogAt = now;
            _missionPhaseDebugPush('resume_suppressed', { reason, missionId: trackerMissionId, state: status.state || '' });
        }
        return true;
    }
    const snap = _readMissionRuntimeSnapshot();
    if (trackerActive && snap && _snapshotMatchesActiveMission(snap) && !missionRuntime.active && !missionRuntime.closingPending) {
        if (missionRuntimeResumeAppliedFor === trackerMissionId) {
            _persistMissionRuntimeSnapshot(reason, { minIntervalMs: 10000 });
            return true;
        }
        return _restoreMissionRuntimeFromSnapshot(snap, {
            reason,
            trackerConfirmed: true,
            trackerActive,
            authorityConfirmed: !!(trackerRunId && localAuthority?.runId === trackerRunId)
        });
    }
    if (!trackerActive && (missionRuntime.active || missionRuntime.closingPending)) {
        _missionPhaseDebugPush('resume_tracker_ended', {
            missionId: trackerMissionId,
            localActive: !!missionRuntime.active,
            localClosing: !!missionRuntime.closingPending,
            state: status.state || ''
        });
    }
    _persistMissionRuntimeSnapshot(reason, { minIntervalMs: 10000 });
    return true;
}

function _handleTrackerMissionAuthoritySnapshot(snapshot = null, reason = 'tracker-authority') {
    if (!snapshot || typeof snapshot !== 'object') return false;
    const active = snapshot.activeRun && typeof snapshot.activeRun === 'object' ? snapshot.activeRun : null;
    let local = _readMissionAuthorityState();
    if (!active?.missionId || !active?.runId) {
        window.lastTrackerMissionAuthority = { ...snapshot, receivedAt: Date.now() };
        window.lastTrackerMissionStatus = null;
        if (local?.runId) _clearMissionAuthorityState(`${reason}:tracker-no-active-run`);
        if (window.missionRuntimeResumeConflict?.trackerActive) {
            window.missionRuntimeResumeConflict = null;
            _updateMissionRuntimeUi();
        }
        return true;
    }
    const relation = _missionAuthorityIncomingRunRelation(local, active, _missionAuthorityClientId());
    if (relation === 'stale') {
        _missionPhaseDebugPush('authority_snapshot_stale_ignored', {
            reason,
            missionId: active.missionId,
            runId: active.runId,
            incomingRevision: Number(active.revision || 0),
            localRevision: Number(local?.revision || 0)
        });
        return false;
    }
    window.lastTrackerMissionAuthority = { ...snapshot, receivedAt: Date.now() };
    if (relation === 'demote') {
        _clearMissionAuthorityState(`${reason}:owner-transferred`);
        local = null;
        _missionPhaseDebugPush('authority_demoted_to_observer', {
            reason,
            missionId: active.missionId,
            runId: active.runId,
            ownerClientId: active.ownerClientId || null,
            revision: Number(active.revision || 0)
        });
    }
    const trackerMissionId = _normalizeMissionRuntimeId(active.missionId);
    const sameOwner = active.ownerClientId === _missionAuthorityClientId();
    if (sameOwner && (!local || local.runId === active.runId)) {
        _writeMissionAuthorityState({ ...active, clientId: _missionAuthorityClientId() });
    }
    window.lastTrackerMissionStatus = { ...active, receivedAt: Date.now() };
    _handleTrackerMissionStatus(window.lastTrackerMissionStatus, reason);
    if (sameOwner && !local?.runId && !missionAuthorityAdoptPromise && trackerMissionId === _activeMissionRuntimeId('')) {
        missionAuthorityAdoptPromise = _ensureMissionAuthorityForStart('tracker-authority-rebind')
            .catch(() => false)
            .finally(() => { missionAuthorityAdoptPromise = null; });
    }
    return true;
}

window.resumeTrackerMissionOnThisDevice = async function(options = {}) {
    if (!_trackerSupportsMissionAuthority()) return false;
    const active = window.lastTrackerMissionAuthority?.activeRun || window.lastTrackerMissionStatus || null;
    if (!active?.missionId || !active?.runId) return false;
    const snapshotAck = await _sendMissionAuthorityRequest({
        type: 'mission_snapshot_request',
        missionId: active.missionId,
        runId: active.runId,
        clientId: _missionAuthorityClientId(),
        reason: 'device-handoff-preview'
    }, 12000);
    const authoritativeRun = snapshotAck.authoritativeRun && typeof snapshotAck.authoritativeRun === 'object'
        ? snapshotAck.authoritativeRun
        : active;
    let bundle = snapshotAck.resumeBundle && typeof snapshotAck.resumeBundle === 'object' ? snapshotAck.resumeBundle : null;
    let bundleValidation = _validateMissionAuthorityResumeBundle(bundle);
    let localRecovery = null;
    const missingLegacySnapshot = String(snapshotAck.status || '').toLowerCase() === 'noop' && !bundle;
    if (missingLegacySnapshot) {
        localRecovery = _buildMissionAuthorityLocalRecovery(authoritativeRun, 'legacy-device-handoff-recovery');
        if (localRecovery.ok) {
            bundle = localRecovery.bundle;
            bundleValidation = localRecovery.validation;
        }
    }
    if (!localRecovery?.ok && (snapshotAck.status !== 'ok' || !bundleValidation.ok)) {
        const mismatch = localRecovery?.error === 'local_mission_mismatch';
        const foreignOwner = localRecovery?.error === 'tracker_owner_not_recoverable';
        const message = mismatch
            ? 'Der Tracker hat noch keinen vollständigen Übergabestand. Auf diesem Gerät liegt jedoch eine andere Mission; sie darf den laufenden Tracker-Lauf nicht überschreiben.'
            : (foreignOwner
                ? 'Der Tracker hat noch keinen vollständigen Übergabestand. Der Lauf gehört bereits einem anderen Gerät; bitte dieses kurz verbunden lassen und erneut versuchen.'
                : 'Der Tracker hat für diese Mission noch keinen vollständigen Übergabestand. Bitte die bisherige App kurz verbunden lassen und erneut versuchen.');
        _missionPhaseDebugPush('authority_handoff_rejected', {
            reason: localRecovery?.error || snapshotAck.error || bundleValidation.error || 'resume_bundle_missing',
            missionId: authoritativeRun?.missionId || active.missionId,
            runId: authoritativeRun?.runId || active.runId,
            ownerClientId: authoritativeRun?.ownerClientId || null,
            localMissionId: _activeMissionRuntimeId('') || null
        });
        try { alert(message); } catch (_) {}
        return false;
    }

    const label = String(authoritativeRun.missionId || active.missionId || 'Mission');
    try {
        if (localRecovery?.ok) {
            const title = String(localRecovery.missionTitle || label);
            const phase = String(bundle.runtime?.startPhase || bundle.runtime?.runtime?.phase || 'geplant');
            if (!confirm(
                `Der ältere Tracker-Lauf enthält noch keinen Übergabe-Snapshot.\n\n`
                + `Auf diesem Gerät liegt dieselbe Mission „${title}“ (lokaler Stand: ${phase}). `
                + 'Diesen Stand jetzt einmalig als Tracker-Wahrheit übernehmen?'
            )) return false;
        } else {
            const promptContext = String(options.promptContext || '').trim();
            const prompt = [
                promptContext,
                `Auf dem Tracker läuft bereits ${label}.`,
                'Diese Mission auf diesem Gerät übernehmen und am gespeicherten Stand fortsetzen?'
            ].filter(Boolean).join('\n\n');
            if (!confirm(prompt)) return false;
        }
    } catch (_) {
        return false;
    }

    const alreadyOwned = authoritativeRun.ownerClientId === _missionAuthorityClientId();
    const takeoverAck = alreadyOwned
        ? { status: 'ok', authoritativeRun }
        : await _sendMissionAuthorityRequest({
            type: 'mission_authority_takeover',
            missionId: authoritativeRun.missionId,
            runId: authoritativeRun.runId,
            clientId: _missionAuthorityClientId(),
            expectedRevision: Number(authoritativeRun.revision || 0),
            reason: localRecovery?.ok ? 'explicit-legacy-recovery' : 'explicit-device-handoff'
        }, 12000);
    if (takeoverAck.status !== 'ok' || !takeoverAck.authoritativeRun?.runId) {
        try { alert('Die Mission konnte nicht übernommen werden. Der Stand hat sich zwischenzeitlich geändert; bitte erneut versuchen.'); } catch (_) {}
        return false;
    }
    const ownedAuthority = _writeMissionAuthorityState({
        ...takeoverAck.authoritativeRun,
        clientId: _missionAuthorityClientId()
    });

    if (localRecovery?.ok) {
        const local = ownedAuthority;
        if (!local?.missionId || !local?.runId || !local?.clientId) {
            try { alert('Der lokale Authority-Stand konnte nicht angelegt werden. Bitte lokalen Speicher freigeben und erneut versuchen.'); } catch (_) {}
            return false;
        }
        const stateHash = _missionAuthorityResumeBundleHash(bundle);
        missionAuthoritySnapshotSequence = Math.max(missionAuthoritySnapshotSequence + 1, Date.now());
        const snapshotSequence = missionAuthoritySnapshotSequence;
        const seedAck = await _sendMissionAuthorityRequest({
            type: 'mission_snapshot_update',
            missionId: local.missionId,
            runId: local.runId,
            clientId: local.clientId,
            snapshotSequence,
            state: bundle.runtime?.runtime?.closingPending ? 'closing' : 'active',
            missionPhase: bundle.runtime?.startPhase || bundle.runtime?.runtime?.phase || 'planned',
            stateHash,
            reason: 'legacy-device-handoff-recovery-seed',
            resumeBundle: bundle
        }, 12000);
        if (seedAck.status !== 'ok' || !seedAck.authoritativeRun?.runId) {
            _missionPhaseDebugPush('authority_legacy_recovery_seed_failed', {
                missionId: local.missionId,
                runId: local.runId,
                status: seedAck.status || '',
                error: seedAck.error || '',
                snapshotSequence
            });
            _queueMissionAuthoritySnapshot('legacy-device-handoff-recovery-retry', { immediate: true });
            try { alert('Die Mission wurde übernommen, aber der Rettungsstand wurde noch nicht bestätigt. Bitte diese App mit dem Tracker verbunden lassen und die Übergabe erneut öffnen.'); } catch (_) {}
            return false;
        }
        missionAuthorityLastSnapshotHash = stateHash;
        missionAuthorityLastSnapshotPushAt = Date.now();
        _writeMissionAuthorityState({ ...seedAck.authoritativeRun, clientId: _missionAuthorityClientId() });
        _missionPhaseDebugPush('authority_legacy_recovery_seeded', {
            missionId: local.missionId,
            runId: local.runId,
            previousOwnerClientId: authoritativeRun.ownerClientId || null,
            runtimeSource: localRecovery.runtimeSource,
            snapshotSequence,
            revision: seedAck.authoritativeRun.revision || null
        });
    }

    try {
        localStorage.setItem('ga_active_mission', JSON.stringify(bundle.missionState));
        localStorage.setItem(MISSION_RUNTIME_RESUME_KEY, JSON.stringify(bundle.runtime));
    } catch (_) {}
    let restored = false;
    try {
        restored = (await restoreMissionState(bundle.missionState, {
            source: localRecovery?.ok ? 'tracker-authority-legacy-recovery' : 'tracker-authority',
            allowDraft: false,
            resumeRuntime: true,
            authorityConfirmed: true
        })) !== false;
    } catch (error) {
        console.warn('[MISSION AUTHORITY] Geräteübergabe konnte lokal nicht restauriert werden:', error);
    }
    if (!restored) return false;
    _restoreMissionAuthorityMapProfile(bundle);
    _scheduleMissionAuthorityProfileRefresh('tracker-authority-handoff');
    if (missionRuntimeResumeAppliedFor !== _normalizeMissionRuntimeId(active.missionId)) {
        _restoreMissionRuntimeFromSnapshot(bundle.runtime, {
            reason: 'tracker-authority-handoff',
            trackerConfirmed: true,
            trackerActive: true,
            authorityConfirmed: true
        });
    }
    window.missionRuntimeResumeConflict = null;
    missionRuntimeResumeConflictLastSig = '';
    missionRuntimeResumeConflictLastLogAt = 0;
    _missionPhaseDebugPush('authority_handoff_complete', {
        missionId: active.missionId,
        runId: active.runId,
        recoveredFromLocal: !!localRecovery?.ok,
        runtimeSource: localRecovery?.runtimeSource || 'tracker',
        adapter: bundle.descriptor?.primaryAdapter || bundle.adapter || null,
        facets: bundle.descriptor?.facets || []
    });
    _queueMissionAuthoritySnapshot('device-handoff-complete', { immediate: true });
    _updateMissionRuntimeUi();
    return true;
};

function _releaseMissionAuthority(outcome = 'reset', reason = 'mission-runtime-reset') {
    if (!_trackerSupportsMissionAuthority() || window.simModeActive) return false;
    const local = _readMissionAuthorityState();
    if (!local?.missionId || !local?.runId || local.clientId !== _missionAuthorityClientId()) return false;
    if (window.missionAuthorityReleasePending?.runId === local.runId) return true;
    const commandId = window.sendTrackerCommand({
        type: 'mission_authority_release',
        missionId: local.missionId,
        runId: local.runId,
        clientId: local.clientId,
        expectedRevision: local.revision,
        outcome,
        reason
    }, { authorityProtocol: true });
    if (commandId) {
        window.missionAuthorityReleasePending = {
            missionId: local.missionId,
            runId: local.runId,
            outcome,
            reason,
            commandId,
            requestedAt: Date.now()
        };
        _missionPhaseDebugPush('authority_release_requested', {
            commandId,
            missionId: local.missionId,
            runId: local.runId,
            outcome,
            reason
        });
    }
    return !!commandId;
}
window.releaseMissionAuthority = _releaseMissionAuthority;

window.confirmMissionAuthorityReplacement = function(label = 'diese Aktion', reason = 'mission-replacement') {
    if (!_trackerSupportsMissionAuthority()) return true;
    if (window.missionRuntimeResumeConflict?.trackerActive === true) {
        try { alert('Auf dem Tracker läuft eine andere Mission. Übernimm oder beende diese Mission, bevor du eine neue Route startest.'); } catch (_) {}
        return false;
    }
    const local = _readMissionAuthorityState();
    if (!local?.missionId || !local?.runId) return true;
    if (window.missionAuthorityReleasePending?.runId === local.runId) return true;
    try {
        if (!confirm(`Mission ${local.missionId} läuft noch.\n\nMission ausdrücklich abbrechen und ${label} starten?`)) return false;
    } catch (_) {
        return false;
    }
    const reset = window.missionRuntimeReset?.({
        respawnAfterClear: false,
        authorityOutcome: 'aborted',
        reason
    });
    return reset !== false;
};

function _missionSceneId() {
    const fs = _activeFireScenario();
    const missionId = _activeMissionRuntimeId('');
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

function _missionAptArrivalAssetForItem(item = {}, index = 0, options = {}) {
    const role = String(item.role || '').trim();
    const semanticTitle = String(item.objectTitle || item.title || item.label || '').trim();
    const provided = Array.isArray(item.titleCandidates) ? item.titleCandidates : [];
    const allowedProvided = options.movingPerson === true
        ? provided.filter(title => /^tarmac_/i.test(String(title || '').trim()))
        : provided;
    let pool = [];
    let fallback = semanticTitle || 'Cardboard';
    let preferFirst = false;
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
        fallback = pool[0] || 'Cardboard';
        preferFirst = true;
    } else if (role === 'cargo.animal_transport_box') {
        pool = MISSION_SCENE_ASSET_POOLS.animalTransportBoxes;
        fallback = semanticTitle || pool[0] || 'Cardboard';
        preferFirst = !semanticTitle;
    } else if (role === 'cargo.camera_equipment') {
        pool = MISSION_SCENE_ASSET_POOLS.cameraEquipment;
        fallback = semanticTitle || pool[0] || 'Cardboard';
        preferFirst = !semanticTitle;
    } else if (role === 'cargo.camping_equipment') {
        pool = MISSION_SCENE_ASSET_POOLS.campingEquipment;
        fallback = semanticTitle || pool[0] || 'Cardboard';
        preferFirst = !semanticTitle;
    } else if (role === 'cargo.equipment_case') {
        pool = MISSION_SCENE_ASSET_POOLS.equipmentCases;
        fallback = semanticTitle || pool[0] || 'Cardboard';
        preferFirst = !semanticTitle;
    } else if (/^cargo\./.test(role)) {
        pool = MISSION_SCENE_ASSET_POOLS.cargo;
        fallback = semanticTitle || 'Cardboard';
    } else if (role === 'person.ground_crew' || /^person\./.test(role)) {
        const gender = _missionScenePassengerGender();
        if (options.movingPerson === true) {
            pool = _missionSceneMovingPersonPool(gender, true);
            fallback = _missionSceneMovingPersonTitle(gender, `apt-arrival-moving-${index}`);
        } else {
            pool = MISSION_SCENE_ASSET_POOLS.people;
            fallback = _missionScenePersonTitle(gender, `apt-arrival-${index}`);
        }
    } else if (role) {
        pool = _sceneCatalogRoleTitles(role, allowedProvided);
        fallback = pool[0] || semanticTitle;
    }
    const titlePool = pool.length ? pool : allowedProvided;
    const title = preferFirst
        ? (titlePool[0] || fallback)
        : _scenePickTitle(titlePool, `apt-arrival-${role}-${index}`, fallback);
    return {
        title: title || fallback,
        candidates: _sceneAssetCandidates(title || fallback, allowedProvided.concat(pool, [fallback]).filter(Boolean))
    };
}

function _missionAptArrivalSceneItems(plan = {}) {
    const items = _missionAptArrivalPreviewItems(plan);
    const pickupManifest = _missionCargoEnsureManifest();
    const pickupCargoItem = Array.isArray(pickupManifest?.items)
        ? pickupManifest.items.find(item => (
            item?.pickupLocation === 'target'
            && !_missionCargoIsPassengerItem(item)
        )) || null
        : null;
    const movingPickupPersonIndex = _missionBushIsPickupPassengerMission()
        ? items.findIndex(item => {
            const role = String(item?.role || '').trim();
            const kind = String(item?.kind || '').toLowerCase();
            return role === 'person.ground_crew' || /^person\./.test(role) || kind.includes('arrival_person');
        })
        : -1;
    return items.map((item, index) => {
        const isMovingPickupPerson = index === movingPickupPersonIndex;
        const asset = _missionAptArrivalAssetForItem(item, index, {
            movingPerson: isMovingPickupPerson
        });
        if (!asset.title) return null;
        const isPickupCargoVisual = pickupCargoItem
            && !_missionCargoIsPassengerItem(pickupCargoItem)
            && (
                String(item?.kind || '').toLowerCase().includes('arrival_equipment')
                || String(item?.role || '').toLowerCase().startsWith('cargo.')
            );
        return {
            ...item,
            kind: isMovingPickupPerson ? 'person_boarder_1' : item.kind,
            label: item.label || item.kind || `APT Arrival ${index + 1}`,
            objectTitle: asset.title,
            titleCandidates: asset.candidates,
            ...(isPickupCargoVisual ? {
                itemId: pickupCargoItem.id || '',
                cargoItemId: pickupCargoItem.id || '',
                cargoSceneKind: pickupCargoItem.sceneKind || item.kind || '',
                objectKey: _missionCargoStableObjectKey(pickupCargoItem, pickupManifest),
                objectRevision: 0
            } : {}),
            headingMode: 'with_aircraft',
            altOffsetFt: Number.isFinite(Number(item.altOffsetFt)) ? Number(item.altOffsetFt) : 0
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
    if (status.sceneId === sceneId && (status.spawned || _missionSceneSpawnPendingActive(status, sceneId))) return false;
    if (_missionSceneSpawnBackoffActive(status, sceneId)) return false;
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
        lastSpawnFailedAt: 0,
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
    if (_missionIsFreeflightOnly()) return 0;
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
    const existingManifest = typeof _missionCargoGetManifest === 'function' ? _missionCargoGetManifest() : null;
    if (Array.isArray(existingManifest?.items) && existingManifest.items.length > 0) {
        const passengerItems = existingManifest.items.filter(item => _missionCargoIsPassengerItem(item));
        if (!passengerItems.length) return 0;
        return Math.max(0, Math.min(6, passengerItems.reduce((sum, item) => sum + Math.max(1, Number(item.passengerCount) || 1), 0)));
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
    return window.activePassenger ? 1 : 0;
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

function _missionSceneSafeBoardingCargoCandidates(candidates = []) {
    return _sceneUniqueTitles(candidates)
        .filter(title => !/(^|[_\s-])Microsoft[_\s-]?Truck[_\s-]?Container($|[_\s-])|Truck[_\s-]?Utility/i.test(String(title || '')));
}

function _missionSceneCargoIsPersonalLuggageTitle(title = '') {
    return _sceneUniqueTitles(
        MISSION_SCENE_ASSET_POOLS.cameraEquipment,
        MISSION_SCENE_ASSET_POOLS.personalLuggage
    ).includes(String(title || '').trim());
}

function _missionSceneBoardingCargoCandidates(title = '', candidates = [], options = null) {
    const primary = String(title || 'Cardboard').trim() || 'Cardboard';
    const personalLuggage = _missionSceneCargoIsPersonalLuggageTitle(primary);
    const smallCargoFallbacks = _sceneUniqueTitles(MISSION_SCENE_ASSET_POOLS.smallCargo || ['Cardboard']);
    const suppliedCandidates = _sceneAssetCandidates(primary, candidates);
    const semanticCandidates = personalLuggage
        ? suppliedCandidates.filter(candidate => !smallCargoFallbacks.includes(candidate))
        : suppliedCandidates;
    const includeSmallCargoFallback = options?.includeSmallCargoFallback !== false && !personalLuggage;
    const fallback = includeSmallCargoFallback ? smallCargoFallbacks : [];
    return _missionSceneSafeBoardingCargoCandidates(
        semanticCandidates.concat(fallback)
    );
}

function _missionSceneCargoTitleIsTruckContainer(title = '') {
    return /(^|[_\s-])Microsoft[_\s-]?Truck[_\s-]?Container($|[_\s-])|Truck[_\s-]?Utility/i.test(String(title || ''));
}

function _missionSceneCargoIsSemanticHomebaseTitle(title = '') {
    return _sceneUniqueTitles(
        MISSION_SCENE_ASSET_POOLS.luggageBackpacks,
        MISSION_SCENE_ASSET_POOLS.luggageDuffels,
        MISSION_SCENE_ASSET_POOLS.luggageSuitcases,
        MISSION_SCENE_ASSET_POOLS.personalLuggage,
        MISSION_SCENE_ASSET_POOLS.toolboxes,
        MISSION_SCENE_ASSET_POOLS.toolCarts,
        MISSION_SCENE_ASSET_POOLS.coolers,
        MISSION_SCENE_ASSET_POOLS.jerrycanPairs,
        MISSION_SCENE_ASSET_POOLS.mailSacks,
        MISSION_SCENE_ASSET_POOLS.woodCrates,
        MISSION_SCENE_ASSET_POOLS.cameraEquipment,
        MISSION_SCENE_ASSET_POOLS.campingEquipment,
        MISSION_SCENE_ASSET_POOLS.equipmentCases,
        MISSION_SCENE_ASSET_POOLS.medicalEquipment,
        MISSION_SCENE_ASSET_POOLS.aircraftLogbooks,
        MISSION_SCENE_ASSET_POOLS.fireExtinguishers,
        MISSION_SCENE_ASSET_POOLS.firstAidCases,
        MISSION_SCENE_ASSET_POOLS.wheelChocks,
        MISSION_SCENE_ASSET_POOLS.animalTransportBoxes
    ).includes(String(title || '').trim());
}

function _missionSceneCargoLooksLikeSmallLoosePayload(text = '', weightLbs = null) {
    const label = String(text || '').toLowerCase();
    const weight = Number(weightLbs);
    const hasWeight = Number.isFinite(weight);
    const smallMissionKit = /(tablet|checklist|checkliste|bordbuch|dispatch.?mappe|mappe|unterlagen|papier|akte|karten|notiz|protokoll|formular|dokument|foto|kamera|speicher|akku|referenzkarten|messprotokoll)/i.test(label);
    if (smallMissionKit && (!hasWeight || weight <= 35)) return true;
    const clearlyBulk = /(palette|pallet|container|fass|kanister|sperrig|transportbox|generator|ersatzteil|teile|fracht|freight|ladungssatz|baugruppe)/i.test(label);
    return !!(hasWeight && weight <= 10 && !clearlyBulk);
}

function _missionSceneSafeBoardingCargoTitle(title = '', label = '', weightLbs = null) {
    const rawTitle = String(title || '').trim();
    if (_missionSceneCargoIsSemanticHomebaseTitle(rawTitle)) return rawTitle;
    const context = `${label || ''} ${rawTitle}`;
    if (_missionSceneCargoLooksLikeSmallLoosePayload(context, weightLbs)) return 'Cardboard';
    if (_missionSceneCargoTitleIsTruckContainer(rawTitle)) return 'Cardboard';
    return rawTitle || 'Cardboard';
}

function _missionSceneSemanticCargoAsset(cargoText = '', cargoWeightLbs = null) {
    const text = String(cargoText || '').toLowerCase();
    const weight = Number(cargoWeightLbs);
    const pick = (pool, salt, fallback = '') => {
        const title = _scenePickTitle(pool, salt, fallback || pool[0] || '');
        return title ? { title, candidates: _sceneAssetCandidates(title, pool) } : null;
    };
    const pickPrimary = (pool, fallback = '') => {
        const title = String(pool?.[0] || fallback || '').trim();
        return title ? { title, candidates: _sceneAssetCandidates(title, pool) } : null;
    };
    if (/(luftfahrzeug[\s-]?(?:bordbuch|flugbuch)|aircraft[\s-]?logbook|bordbuch|flugbuch)/i.test(text)) {
        return pickPrimary(MISSION_SCENE_ASSET_POOLS.aircraftLogbooks);
    }
    if (/(feuerloesch|feuerlösch|fire[\s-]?extinguisher)/i.test(text)) {
        return pickPrimary(MISSION_SCENE_ASSET_POOLS.fireExtinguishers);
    }
    if (/(verband(?:kasten|zeug)|erste[\s-]?hilfe[\s-]?(?:koffer|kasten|case)|first[\s-]?aid[\s-]?case)/i.test(text)) {
        return pickPrimary(MISSION_SCENE_ASSET_POOLS.firstAidCases);
    }
    if (/(radkeil|wheel[\s-]?chock|\bchocks?\b)/i.test(text)) {
        return pickPrimary(MISSION_SCENE_ASSET_POOLS.wheelChocks);
    }
    if (/(postsack|postsendung|postbeutel|briefsendung)/i.test(text)) return pick(MISSION_SCENE_ASSET_POOLS.mailSacks, `cargo-mail-${text}`);
    if (/(kuehlbox|kühlbox|blutkonserven|serum|laborproben|probenbeutel)/i.test(text)) return pick(MISSION_SCENE_ASSET_POOLS.coolers, `cargo-cooler-${text}`);
    if (/(transportbox|tiertransportbox|reisebox|reha[\s-]?box|vogelbox|wildvogelbox|greifvogelbox|igelbox|fledermaus[\s-]?kleinbox|tiertransport)/i.test(text)) {
        return pickPrimary(MISSION_SCENE_ASSET_POOLS.animalTransportBoxes);
    }
    if (/(sanitaets|sanitäts|sanitaet|sanität|medpack|hems[\s-]?rucksack|erste[\s-]?hilfe[\s-]?(?:pack|tasche|kit)|rettungs[\s-]?(?:und[\s-]?)?sanitaetskit|rettungs[\s-]?(?:und[\s-]?)?sanitätskit|medizinischer notfallkoffer|notfallkoffer)/i.test(text)) {
        return pickPrimary(MISSION_SCENE_ASSET_POOLS.medicalEquipment);
    }
    if (/(kanister|kraftstoff|treibstoff)/i.test(text)) return pick(MISSION_SCENE_ASSET_POOLS.jerrycanPairs, `cargo-jerrycan-${text}`);
    if (/(werkzeugwagen|tool\s*cart)/i.test(text)) return pick(MISSION_SCENE_ASSET_POOLS.toolCarts, `cargo-tool-cart-${text}`);
    if (/(werkzeug|toolbox|werkzeugkiste|werkzeugtasche|wartungskit|prueflampe|prüflampe|sicherungsdraht)/i.test(text)) return pick(MISSION_SCENE_ASSET_POOLS.toolboxes, `cargo-toolbox-${text}`);
    if (/(kamerarucksack|museumrucksack|notizrucksack)/i.test(text)) {
        const asset = pick(MISSION_SCENE_ASSET_POOLS.luggageBackpacks, `cargo-backpack-${text}`);
        return asset
            ? { ...asset, candidates: _sceneAssetCandidates(asset.title, MISSION_SCENE_ASSET_POOLS.personalLuggage) }
            : null;
    }
    if (/(campingausruestung|campingausrüstung|camp[\s-]?proviant|angel[\s-]?(?:und[\s-]?)?camptaschen|packraft|trockenbeutel|provianttasche|wasserfilter|solarlader|trail[\s-]?crew[\s-]?proviant)/i.test(text)) {
        return pickPrimary(MISSION_SCENE_ASSET_POOLS.campingEquipment);
    }
    if (/(kamera|camera|fotoequipment|fotoausruestung|fotoausrüstung|foto[\s-]?kit|stativ|gimbal|teleobjektiv|film[\s-]?(?:und[\s-]?)?akkukoffer|audio[\s-]?set|waermebildkamera|wärmebildkamera|thermal[\s-]?handkamera)/i.test(text)) {
        return pickPrimary(MISSION_SCENE_ASSET_POOLS.cameraEquipment);
    }
    if (/(hardcase|flightcase|schutzcase|transportcase|kuriercase|klimacase|schaumcase|polstercase|acrylcase|alukoffer|schutzverpackung|instrumentenkoffer|sensorkoffer|kalibrierkoffer|messkoffer|probenkoffer|arbeitskoffer|werkzeugkoffer|funkakku[\s-]?case|tabletcase)/i.test(text)) {
        const caseIndex = Number.isFinite(weight) && weight >= 36 ? 2 : (Number.isFinite(weight) && weight >= 20 ? 1 : 0);
        const title = MISSION_SCENE_ASSET_POOLS.equipmentCases[caseIndex] || MISSION_SCENE_ASSET_POOLS.equipmentCases[0] || '';
        return title ? { title, candidates: _sceneAssetCandidates(title, MISSION_SCENE_ASSET_POOLS.personalLuggage) } : null;
    }
    if (/(duffel|reisetasche|wochenendtasche)/i.test(text)) {
        const asset = pick(MISSION_SCENE_ASSET_POOLS.luggageDuffels, `cargo-duffel-${text}`);
        return asset
            ? { ...asset, candidates: _sceneAssetCandidates(asset.title, MISSION_SCENE_ASSET_POOLS.personalLuggage) }
            : null;
    }
    if (/(reisekoffer|rollkoffer|kabinen[\s-]?(?:koffer|trolley)|cabin[\s-]?trolley|handgepaeck|handgepäck|urlaubskoffer|\bkoffer\b)/i.test(text)) {
        const asset = pick(MISSION_SCENE_ASSET_POOLS.luggageSuitcases, `cargo-suitcase-${text}`);
        return asset
            ? { ...asset, candidates: _sceneAssetCandidates(asset.title, MISSION_SCENE_ASSET_POOLS.personalLuggage) }
            : null;
    }
    if (/(tagesrucksack|daypack|wanderrucksack|trailrucksack|outdoor-kit)/i.test(text)) {
        const asset = pick(MISSION_SCENE_ASSET_POOLS.luggageBackpacks.slice(1), `cargo-daypack-${text}`, MISSION_SCENE_ASSET_POOLS.luggageBackpacks[0]);
        return asset
            ? { ...asset, candidates: _sceneAssetCandidates(asset.title, MISSION_SCENE_ASSET_POOLS.personalLuggage) }
            : null;
    }
    if (/(rucksack|rucksäcke)/i.test(text)) {
        const asset = pick(MISSION_SCENE_ASSET_POOLS.luggageBackpacks, `cargo-backpack-${text}`);
        return asset
            ? { ...asset, candidates: _sceneAssetCandidates(asset.title, MISSION_SCENE_ASSET_POOLS.personalLuggage) }
            : null;
    }
    if (/(privat[\s-]?gepaeck|privat[\s-]?gepäck|reisegepaeck|reisegepäck|\bgepaeck\b|\bgepäck\b|persoenliche sachen|persönliche sachen|kleidung|jacken|sonnenbrill)/i.test(text)) {
        return pick(MISSION_SCENE_ASSET_POOLS.personalLuggage, `cargo-personal-${text}`);
    }
    if (/(holz\s*kiste|versorgungskisten?|ersatzteilkiste|materialkiste|utility-kiste|frachtkiste)/i.test(text)) {
        const crateIndex = Number.isFinite(weight) && weight >= 75 ? 2 : (Number.isFinite(weight) && weight >= 35 ? 1 : 0);
        const title = MISSION_SCENE_ASSET_POOLS.woodCrates[crateIndex] || MISSION_SCENE_ASSET_POOLS.woodCrates[0] || '';
        return title ? { title, candidates: _sceneAssetCandidates(title, MISSION_SCENE_ASSET_POOLS.woodCrates) } : null;
    }
    return null;
}

function _missionSceneCargoAsset() {
    const taskDomain = _missionSceneTaskDomain();
    const cargoText = _missionSceneCargoText().toLowerCase();
    const cargoWeightLbs = _missionSceneCargoWeightLbs();
    const semanticAsset = _missionSceneSemanticCargoAsset(cargoText, cargoWeightLbs);
    if (semanticAsset) {
        const title = _missionSceneSafeBoardingCargoTitle(_sceneObjectTitleOverride('cargo', semanticAsset.title), cargoText, cargoWeightLbs);
        return {
            title,
            candidates: _missionSceneSafeBoardingCargoCandidates(_sceneAssetCandidates(title, semanticAsset.candidates)),
            taskDomain,
            sizePrimary: title,
            cargoText,
            cargoWeightLbs,
            smallLoosePayload: false,
            semanticAsset: true
        };
    }
    const smallLoosePayload = _missionSceneCargoLooksLikeSmallLoosePayload(cargoText, cargoWeightLbs);
    const palletPool = MISSION_SCENE_ASSET_POOLS.palletCargo;
    const sizePrimary = Number.isFinite(cargoWeightLbs)
        ? (cargoWeightLbs >= 120 ? 'Pallet01_01' : (cargoWeightLbs >= 50 ? 'Pallet01_02' : (cargoWeightLbs >= 20 ? 'Pallet01_03' : 'Cardboard')))
        : (/(palette|pallet|fracht|transport|material|ersatzteil|teile|equipment|ausruestung)/.test(cargoText) ? 'Pallet01_02' : 'Cardboard');
    const pool = smallLoosePayload
        ? MISSION_SCENE_ASSET_POOLS.smallCargo
        : (taskDomain === 'fire_watch'
        ? MISSION_SCENE_ASSET_POOLS.fireCargo
        : (taskDomain === 'search_and_rescue'
            ? MISSION_SCENE_ASSET_POOLS.sarCargo
            : (sizePrimary.startsWith('Pallet') ? [sizePrimary, ...palletPool] : MISSION_SCENE_ASSET_POOLS.cargo)));
    const preferredCargo = smallLoosePayload
        ? _scenePreferredTitle(pool, 'Cardboard', `cargo-small-${cargoText}-${cargoWeightLbs ?? 'n/a'}`, 'Cardboard')
        : (taskDomain === 'fire_watch' || taskDomain === 'search_and_rescue'
        ? _scenePreferredTitle(pool, 'Drop_Container', `cargo-${cargoText}-${cargoWeightLbs ?? 'n/a'}`, pool[0] || BOARDING_CARGO_FALLBACK_TITLE)
        : _scenePickTitle(pool, `cargo-${cargoText}-${cargoWeightLbs ?? 'n/a'}`, pool[0] || BOARDING_CARGO_FALLBACK_TITLE));
    const preferred = _missionSceneSafeBoardingCargoTitle(_sceneObjectTitleOverride('cargo', preferredCargo), cargoText, cargoWeightLbs);
    const candidatePool = smallLoosePayload
        ? _missionSceneSafeBoardingCargoCandidates((MISSION_SCENE_ASSET_POOLS.smallCargo || []).concat(['Cardboard', BOARDING_CARGO_FALLBACK_TITLE]))
        : ((taskDomain === 'fire_watch' || taskDomain === 'search_and_rescue')
        ? _missionSceneSafeBoardingCargoCandidates(pool.concat(MISSION_SCENE_ASSET_POOLS.smallCargo, ['Cardboard', BOARDING_CARGO_FALLBACK_TITLE]))
        : _missionSceneSafeBoardingCargoCandidates(pool.concat(MISSION_SCENE_ASSET_POOLS.cargo, [BOARDING_CARGO_FALLBACK_TITLE])));
    return {
        title: preferred,
        candidates: _sceneAssetCandidates(preferred, candidatePool),
        taskDomain,
        sizePrimary,
        cargoText,
        cargoWeightLbs,
        smallLoosePayload
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
    const preferredAnimalBox = MISSION_SCENE_ASSET_POOLS.animalTransportBoxes[0] || 'Cardboard';
    if (picked?.visible === false) {
        const cargoTitle = preferredAnimalBox;
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
        cargoTitle: preferredAnimalBox,
        cargoCandidates: _sceneAssetCandidates(preferredAnimalBox, MISSION_SCENE_ASSET_POOLS.animalTransportBoxes),
        candidates: _sceneAssetCandidates(title, MISSION_SCENE_ASSET_POOLS.animalTransportAnimals)
    };
}

function _missionSceneFilteredVehiclePool(pool = []) {
    const filtered = _sceneUniqueTitles(pool).filter(title => !/(lavatory|fuel\s*truck|fuel[_\s-]*short|boarding|deice|deicing|truck\s+fire|firetruck|firefighting|medic|military|humvee|matv|armoured|armored|police|operation|winch)/i.test(title));
    return filtered.length ? filtered : _sceneUniqueTitles(pool);
}

function _missionTargetSceneAllowsLargeWatercraft(text = '') {
    const t = String(text || _missionTargetSceneText() || '').toLowerCase();
    return /(kueste|küste|meer|sea|ocean|offshore|hafen|harbor|harbour|port|dock|werft|grosses gewaesser|grosses gewässer|grossen see|großer see|grosser see|lake constance|bodensee|schiff|ship|ferry|faehre|fähre|cutter|coast guard|kuestenwache|küstenwache|arbeitsschiff|service ship)/.test(t);
}

function _missionTargetSceneSafeSmallBoatPool() {
    const text = _missionTargetSceneText();
    const tinyOnly = /(badesee|teich|weiher|kleiner\s+(binnen)?see|small\s+lake|pond|swimming\s+lake)/i.test(text);
    if (tinyOnly && MISSION_SCENE_ASSET_POOLS.tinyBoats.length) return _sceneUniqueTitles(MISSION_SCENE_ASSET_POOLS.tinyBoats);
    const lakeSafe = _sceneUniqueTitles(
        MISSION_SCENE_ASSET_POOLS.tinyBoats,
        MISSION_SCENE_ASSET_POOLS.smallBoats
    ).filter(title => !/(ship|cargoship|cruise|ferry|tanker|supply|platform|cutter|destroyer|frigate|carrier|fishingship)/i.test(title));
    return lakeSafe.length ? lakeSafe : ['boat01', 'boat02'];
}

function _missionSceneRescueTargetTitle(salt = 'rescue-target') {
    const text = _missionSarContextText();
    const rescuePool = MISSION_SCENE_ASSET_POOLS.sarPersonTargets || [];
    const pick = (preferred) => {
        if (preferred && rescuePool.includes(preferred)) return preferred;
        return _scenePickTitle(rescuePool, salt, rescuePool[0] || '');
    };
    if (/(ski|skier|schnee|winter|alpin|lawine|piste)/i.test(text)) return pick('mmh_SkierRescue');
    if (/(arktis|arctic|eis|gletscher)/i.test(text)) return pick('mmh_ArcticRescue');
    if (/(wander|hiker|trail|bergsteiger|spazier|forest|wald)/i.test(text)) return pick('mmh_HikerRescue');
    return pick('mmh_HikerRescue');
}

function _missionSceneCargoItems(cargoPoint, cargoAsset) {
    if (_missionIsFreeflightOnly()) return [];
    const baseForward = Number.isFinite(Number(cargoPoint?.forwardM)) ? Number(cargoPoint.forwardM) : 4;
    const baseRight = Number.isFinite(Number(cargoPoint?.rightM)) ? Number(cargoPoint.rightM) : 4;
    const baseAlt = Number.isFinite(Number(cargoPoint?.altOffsetFt)) ? Number(cargoPoint.altOffsetFt) : 0;
    const safeCargoCandidates = (title, candidates = []) => _missionSceneBoardingCargoCandidates(title, candidates);
    const makeItem = (kind, label, title, candidates, forwardOffset = 0, rightOffset = 0, weightLbs = null) => {
        const semanticHomebaseAsset = _missionSceneCargoIsSemanticHomebaseTitle(title);
        const safeTitle = semanticHomebaseAsset ? title : _missionSceneSafeBoardingCargoTitle(title, label, weightLbs);
        const candidateSource = !semanticHomebaseAsset && _missionSceneCargoLooksLikeSmallLoosePayload(`${label || ''} ${title || ''}`, weightLbs)
            ? (MISSION_SCENE_ASSET_POOLS.smallCargo || ['Cardboard'])
            : candidates;
        return {
            kind,
            label,
            objectTitle: safeTitle,
            titleCandidates: safeCargoCandidates(safeTitle, candidateSource),
            forwardM: baseForward + forwardOffset,
            rightM: baseRight + rightOffset,
            headingMode: 'with_aircraft',
            // The tracker measures local terrain and applies the model clearance once.
            // Keep only the configurable cargo/item offset in the app payload.
            altOffsetFt: baseAlt
        };
    };
    const manifest = _missionCargoEnsureManifest(cargoAsset);
    const manifestItems = Array.isArray(manifest?.items) ? manifest.items : [];
    if (manifestItems.length) {
        return manifestItems
            .filter(item => !_missionCargoIsPassengerItem(item))
            .filter(item => item.persistentEquipment !== true)
            .filter(item => item.pickupLocation !== 'target')
            .filter(item => String(item.status || 'pending') === 'pending')
            .map((item, index) => ({
                ...makeItem(
                    item.sceneKind || (index === 0 ? 'cargo' : `cargo_extra_${index}`),
                    item.storyName || item.label || `Ladung ${index + 1}`,
                    item.objectTitle || 'Cardboard',
                    item.titleCandidates || MISSION_SCENE_ASSET_POOLS.cargo,
                    Number(item.forwardOffsetM || 0),
                    Number(item.rightOffsetM || 0),
                    Number.isFinite(Number(item.weightLbs)) ? Number(item.weightLbs) : null
                ),
                cargoItemId: item.id || '',
                cargoSceneKind: item.sceneKind || (index === 0 ? 'cargo' : `cargo_extra_${index}`),
                objectKey: typeof _missionCargoStableObjectKey === 'function'
                    ? _missionCargoStableObjectKey(item, manifest)
                    : `mission-cargo:${manifest?.key || 'active'}:${item.id || index}`,
                objectRevision: 0
            }));
    }
    const primary = cargoAsset?.sizePrimary || cargoAsset?.title || 'Cardboard';
    const primaryCandidates = cargoAsset?.candidates || MISSION_SCENE_ASSET_POOLS.cargo;
    return [
        makeItem('cargo', primary.startsWith('Pallet') ? 'Transportpalette' : 'Cargo Karton', primary, primaryCandidates, 0, 0, cargoAsset?.cargoWeightLbs ?? null)
    ];
}

// Cargo-/Manifest-Kernlogik lebt ab hier in mission-cargo-core.js.


function _missionSceneVehicleAsset() {
    const taskDomain = _missionSceneTaskDomain();
    if (_missionBushIsPickupPassengerMission()) {
        const bushPool = _missionSceneFilteredVehiclePool(
            MISSION_SCENE_ASSET_POOLS.vehicles
                .concat(MISSION_SCENE_ASSET_POOLS.trucks, MISSION_SCENE_ASSET_POOLS.quads)
        );
        const preferred = _sceneObjectTitleOverride(
            'vehicle',
            _scenePickTitle(bushPool, 'vehicle-bush-pickup-home', bushPool[0] || MISSION_SCENE_DEFAULT_VEHICLE_TITLE),
            bushPool
        );
        return {
            title: preferred,
            candidates: _sceneAssetCandidates(preferred, bushPool)
        };
    }
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
        const title = _sceneObjectTitleOverride('vehicle', _scenePreferredTitle(pool, 'Car Bush Medic', 'vehicle-sar-medical', pool[0] || fallbackPool[0] || 'Microsoft_Van_EUR'), pool.concat(fallbackPool));
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

function _missionSceneMovingPersonPool(gender = 'female', includeFallbackGender = false) {
    const normalizedGender = String(gender || '').toLowerCase() === 'male' ? 'male' : 'female';
    const titleGender = title => /_Female_/i.test(String(title || '')) ? 'female' : 'male';
    const primary = MISSION_SCENE_MOVING_TARMAC_PERSON_TITLES.filter(title => titleGender(title) === normalizedGender);
    const secondary = includeFallbackGender
        ? MISSION_SCENE_MOVING_TARMAC_PERSON_TITLES.filter(title => titleGender(title) !== normalizedGender)
        : [];
    const defaultTitle = normalizedGender === 'male'
        ? MISSION_SCENE_DEFAULT_PERSON_MALE_TITLE
        : MISSION_SCENE_DEFAULT_PERSON_TITLE;
    return _sceneUniqueTitles(primary, secondary, [defaultTitle]);
}

function _missionSceneMovingPersonTitle(gender = 'female', salt = 'moving-person') {
    const pool = _missionSceneMovingPersonPool(gender, false);
    const fallback = String(gender || '').toLowerCase() === 'male'
        ? MISSION_SCENE_DEFAULT_PERSON_MALE_TITLE
        : MISSION_SCENE_DEFAULT_PERSON_TITLE;
    return _scenePickTitle(pool, `${gender}-${salt}`, fallback);
}

function _missionSceneMovingPersonCandidates(gender = 'female', preferredTitle = '') {
    const preferred = /^tarmac_/i.test(String(preferredTitle || '').trim())
        ? String(preferredTitle).trim()
        : _missionSceneMovingPersonTitle(gender, 'moving-candidate');
    const pool = _missionSceneMovingPersonPool(gender, true);
    const aliases = pool.flatMap(title => _sceneTitleCandidates(title, [title]));
    return _sceneTitleCandidates(preferred, aliases);
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
    if (md?.poiPresentation === true) return true;
    if (typeof window.missionUsesPoiTaskRecipe === 'function' && window.missionUsesPoiTaskRecipe(md)) return true;
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
    if (_missionBushIsPickupPassengerMission()) return true;
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
    const debugReason = String(reason || '').includes('debug');
    if (!debugReason && _missionIsFreeflightOnly()) {
        if (window.missionSceneStatus) window.missionSceneStatus.blockReason = 'freeflight_only';
        if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
        return false;
    }
    const pos = window.lastLiveGpsPos || {};
    const gate = _missionSceneFlightGate(window.lastLiveFlightData || {});
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
    if (!debugReason && _missionSceneSpawnBackoffActive(window.missionSceneStatus || {}, sceneId)) {
        window.missionSceneStatus.blockReason = 'spawn_error_cooldown';
        if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
        return false;
    }
    const sameSceneAlreadyRequested = !!(
        !debugReason
        && window.missionSceneStatus?.sceneId === sceneId
        && (_missionSceneSpawnPendingActive(window.missionSceneStatus || {}, sceneId) || window.missionSceneStatus?.spawned)
        && (Date.now() - Number(window.missionSceneStatus?.lastCommandAt || 0)) < 15000
    );
    if (sameSceneAlreadyRequested) {
        window.missionSceneStatus.blockReason = 'spawn_already_requested';
        if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
        return true;
    }
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
    const primaryPersonTitle = _missionSceneMovingPersonTitle(primaryGender, 'boarding-primary');
    const secondaryBoarderTitle = _missionSceneMovingPersonTitle(secondaryGender, 'boarding-secondary');
    const secondaryIdleTitle = _missionScenePersonTitle(secondaryGender, 'vehicle-idle-secondary');
    const idlePersonTitle = _missionScenePersonTitle(primaryGender, 'vehicle-idle');
    const vehicleCrewOne = { forwardM: 19.5, rightM: -14 };
    const vehicleCrewTwo = { forwardM: 19, rightM: -11.5 };
    const personItems = vehicleSupportEnabled ? [
        ...(boarderCount > 0 ? [{
            kind: 'person_boarder_1',
            label: 'Boarding Pax 1',
            objectTitle: primaryPersonTitle,
            titleCandidates: _missionSceneMovingPersonCandidates(primaryGender, primaryPersonTitle),
            forwardM: Number.isFinite(Number(personSpawn.forwardM)) ? Number(personSpawn.forwardM) : 16,
            rightM: Number.isFinite(Number(personSpawn.rightM)) ? Number(personSpawn.rightM) : -8,
            headingMode: 'face_aircraft',
            altOffsetFt: Number.isFinite(Number(personSpawn.altOffsetFt)) ? Number(personSpawn.altOffsetFt) : 0
        }] : []),
        {
            kind: boarderCount >= 2 ? 'person_boarder_2' : 'person_idle_1',
            label: boarderCount >= 2 ? 'Boarding Pax 2' : 'Crew Fahrzeug 1',
            objectTitle: boarderCount >= 2 ? secondaryBoarderTitle : secondaryIdleTitle,
            titleCandidates: boarderCount >= 2
                ? _missionSceneMovingPersonCandidates(secondaryGender, secondaryBoarderTitle)
                : _missionScenePersonCandidates(secondaryGender, secondaryIdleTitle),
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
        const title = idx % 2 === 0 ? primaryPersonTitle : secondaryBoarderTitle;
        return {
            kind: `person_boarder_${idx + 1}`,
            label: `Boarding Pax ${idx + 1}`,
            objectTitle: title,
            titleCandidates: _missionSceneMovingPersonCandidates(gender, title),
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
    _missionPhaseDebugPush('scene_command', {
        type: 'mission_scene_spawn',
        commandId,
        sceneId,
        reason,
        boarderCount,
        passengerCount: _missionScenePaxCount(),
        personTitles: personItems.map(item => item.objectTitle).filter(Boolean),
        itemCount: sceneItems.length + cargoItems.length + personItems.length,
        startPhase: _missionStartPhase(),
        runtimePhase: _missionRuntimePhaseSnapshot()
    });
    window.missionSceneStatus.sceneId = sceneId;
    window.missionSceneStatus.lastCommandAt = Date.now();
    window.missionSceneStatus.lastCommand = { type: 'mission_scene_spawn', commandId, reason };
    window.missionSceneStatus.spawnRequested = true;
    window.missionSceneStatus.clearRequested = false;
    window.missionSceneStatus.spawned = false;
    window.missionSceneStatus.lastSpawnFailedAt = 0;
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
    _missionPhaseDebugPush('scene_command', {
        type: 'mission_scene_clear',
        commandId,
        sceneId,
        reason,
        personBoarded: !!window.missionSceneStatus?.personBoarded,
        boardingComplete: !!window.missionSceneStatus?.boardingComplete,
        startPhase: _missionStartPhase(),
        runtimePhase: _missionRuntimePhaseSnapshot()
    });
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
    const clearAllCommandId = window.sendTrackerCommand({
        type: 'mission_scene_clear_all',
        reason
    });
    sent = !!clearAllCommandId || sent;
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
    _missionPhaseDebugPush('scene_command', {
        type: 'mission_scene_clear_all',
        commandId: clearAllCommandId || null,
        reason,
        sceneIds: ids,
        sent,
        personBoarded: !!window.missionSceneStatus?.personBoarded,
        boardingComplete: !!window.missionSceneStatus?.boardingComplete,
        startPhase: _missionStartPhase(),
        runtimePhase: _missionRuntimePhaseSnapshot()
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

function _missionSarContextText() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const contract = md?.missionContract || window.activeMissionContract || {};
    const values = [_missionTargetSceneText()];
    const add = (value) => {
        if (value == null) return;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            const s = String(value).trim();
            if (s) values.push(s);
        }
    };
    const addJson = (value) => {
        if (!value || typeof value !== 'object') return;
        try { values.push(JSON.stringify(value)); } catch (_) {}
    };
    add(window.activePassenger?.role);
    add(window.activePassenger?.taskDomain);
    addJson(_missionTruthData());
    addJson(_missionTargetSceneSpec());
    addJson(md?.missionPlan?.plan || md?.missionPlan);
    addJson(md?.missionPlanV2?.plan || md?.missionPlanV2);
    addJson(contract?.missionPlan?.plan || contract?.missionPlan);
    addJson(contract?.missionPlanV2?.plan || contract?.missionPlanV2);
    addJson(md?.storyFrame || contract?.storyFrame);
    addJson(md?.sceneIntent || contract?.sceneIntent);
    return values.filter(Boolean).join(' ').toLowerCase();
}

function _missionSarExplicitFalseAlarm() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const contract = md?.missionContract || window.activeMissionContract || {};
    const values = [];
    const collectFields = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        ['truth', 'result', 'outcome', 'status', 'scenario', 'type', 'finding', 'signal', 'incidentType', 'incident_type', 'classification', 'resolution'].forEach(key => {
            if (obj[key] != null) values.push(String(obj[key]));
        });
    };
    collectFields(_missionTruthData());
    collectFields(_missionTargetSceneSpec());
    collectFields(md?.missionPlan?.plan || md?.missionPlan);
    collectFields(md?.missionPlanV2?.plan || md?.missionPlanV2);
    collectFields(contract?.missionPlan?.plan || contract?.missionPlan);
    collectFields(contract?.missionPlanV2?.plan || contract?.missionPlanV2);
    collectFields(md?.storyFrame || contract?.storyFrame);
    const fieldText = values.join(' ').toLowerCase();
    if (/(^|\b)(false[_ -]?alarm|fehlalarm|no[_ -]?(target|person|find|finding)|negative[_ -]?(search|finding)|not[_ -]?found|none)(\b|$)/.test(fieldText)) return true;
    const text = _missionSarContextText();
    return /\b(false[_ -]?alarm|fehlalarm)\b/.test(text)
        || /\b(no[_ -]?(target|person|find|finding)|negative[_ -]?(search|finding)|not[_ -]?found)\b/.test(text)
        || /kein(?:e|er|en)?\s+(person|fundstelle|ziel|treffer)/.test(text);
}

function _missionSarHasExplicitPersonTarget() {
    const spec = _missionTargetSceneSpec() || {};
    const text = [
        spec.kind,
        spec.type,
        spec.preset,
        Array.isArray(spec.features) ? spec.features.join(' ') : '',
        Array.isArray(spec.modifiers) ? spec.modifiers.join(' ') : '',
        Array.isArray(spec.roles) ? spec.roles.join(' ') : '',
        Array.isArray(spec.requirements) ? spec.requirements.map(req => [req?.feature, req?.kind, req?.type, req?.role, req?.name].filter(Boolean).join(' ')).join(' ') : ''
    ].filter(Boolean).join(' ').toLowerCase();
    return /(missing_person|lost_person|person_waving|waving_person|winkende_person|vermisste_person|person\.ground_crew)/.test(text);
}

function _missionSarLooksLikePersonSearch() {
    if (_missionSarExplicitFalseAlarm()) return false;
    if (_missionSarHasExplicitPersonTarget()) return true;
    const text = _missionSarContextText();
    const explicitPersonIncident = /(missing[_ -]?person|lost[_ -]?person|overdue[_ -]?person|fallen[_ -]?climber|missing[_ -]?hiker|fall[_ -]?injury)/.test(text)
        || /vermisst(?:e|er|en)?\s+(person|wanderer|wanderin|kind|jugendliche?r?|kletterer|kletterin|bergsteiger|bergsteigerin|spaziergaenger|spaziergänger|laeufer|läufer|senior|seniorin|radfahrer|radfahrerin|mountainbiker|mountainbikerin)/.test(text)
        || /(person|wanderer|wanderin|kind|jugendliche?r?|kletterer|kletterin|bergsteiger|bergsteigerin|spaziergaenger|spaziergänger|laeufer|läufer|senior|seniorin|radfahrer|radfahrerin|mountainbiker|mountainbikerin)[^.;,\n]{0,80}(vermisst|ueberfaellig|überfällig|gestuerzt|gestürzt|hilferuf|hilfezeichen|winkt)/.test(text);
    if (explicitPersonIncident) return true;
    const vehicleOrObjectSearch = /(vehicle[_ -]?off[_ -]?road|fahrzeugabkommen|fahrzeugunfall|fahrzeughinweis|fahrzeugspuren|pkw|motorrad|kleinwagen)/.test(text);
    if (vehicleOrObjectSearch) return false;
    const aircraftOrWreckSearch = /(downed[_ -]?(aircraft|ultralight|plane)|vermisst(?:es|er|e|en)?\s+(kleinflugzeug|ultraleichtflugzeug|luftfahrzeug|flugzeug)|wrack|wrackteile|einschlag|absturz|aussenlandung|außenlandung)/.test(text);
    const explicitSurvivorCue = /(pilot|pilotin|insasse|insassin|ueberlebend|überlebend|verletzte person|person am boden|hilferuf|winkt|winkende person)/.test(text);
    if (aircraftOrWreckSearch && !explicitSurvivorCue) return false;
    return /(verletzte person|person am boden|sichtkontakt[^.;,\n]{0,50}person|gesichtet[^.;,\n]{0,50}person|fundstelle[^.;,\n]{0,50}person|hilferuf|hilfezeichen|winkende person)/.test(text);
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
            if (r === 'construction.vehicle') add('construction_truck');
            if (r === 'construction.material') add('construction_material');
            if (r === 'vehicle.bus') add('bus');
            if (r === 'vehicle.car' || r === 'vehicle.van') add((kind === 'road_incident' || kind === 'event_site') ? 'road_vehicles' : 'parked_vehicle');
            if (r === 'vehicle.truck') add('utility_truck');
            if (r === 'vehicle.emergency.medical') add('emergency_response');
            if (r === 'vehicle.emergency.fire') add('emergency_response');
            if (r === 'person.ground_crew') add('people');
            if (r === 'sar.person_target') add('missing_person');
            if (r === 'sar.liferaft') add('liferaft');
            if (r === 'watercraft.tiny_boat' || r === 'watercraft.small_boat' || r === 'watercraft.boat') add('watercraft');
            if (r === 'watercraft.service_ship' || r === 'watercraft.large_ship' || r === 'watercraft.ship') add('service_ship');
            if (r === 'animal.waterfowl' || r === 'animal.bird') add('waterfowl');
            if (r === 'animal.wildlife' || r === 'animal.deer') add('wildlife_animals');
            if (r === 'animal.grazing') add('animal_herd');
            if (r === 'camp.tent' || r === 'camp.trailer') add('tent');
            if (r === 'scene.lighting.lantern') add('lantern');
            if (r === 'cargo.aircraft_logbook') add('aircraft_logbook');
            if (r === 'cargo.fire_extinguisher') add('fire_extinguisher');
            if (r === 'cargo.first_aid_case') add('first_aid_case');
            if (r === 'cargo.wheel_chocks') add('wheel_chocks');
            if (r === 'cargo.medical_kit' || r === 'cargo.animal_transport_box' || r === 'cargo.camera_equipment' || r === 'cargo.camping_equipment' || r === 'cargo.equipment_case') add('cargo_material');
            if (r === 'cargo.small_box') add((kind === 'cargo_site' || kind === 'medical_pickup') ? 'cargo_material' : 'small_equipment');
            if (r === 'aircraft.wreck') add('aircraft_wreck');
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
    if (has('construction_crane') || has('earthmoving') || has('construction_truck') || has('construction_material')) return 'construction_site';
    if (has('liferaft') || has('service_ship')) return 'sar_water';
    if (has('aircraft_wreck')) return 'debris_field';
    if (has('missing_person')) return 'sar_land';
    if (has('emergency_response') && /(medizin|medical|patient|rettung|notfall|verletz)/.test(text)) return 'medical_pickup';
    if (has('emergency_response') || (has('road_vehicles') && /(unfall|crash|kollision|sperrung|einsatzlage)/.test(text))) return 'road_incident';
    if (has('aircraft_logbook') || has('fire_extinguisher') || has('first_aid_case') || has('wheel_chocks')) return 'cargo_site';
    if (has('cargo_material') || has('pallet_stack')) return 'cargo_site';
    if (has('watercraft') || has('waterfowl')) return 'water_context';
    if (has('wildlife_animals') || has('animal_herd') || has('tent') || has('campfire') || has('lantern')) return 'wildlife_site';
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
        const sarRoadIncident = /(road_collision|intersection_accident|intersection_crash|traffic_accident|verkehrsunfall|kollision|crash|unfallstelle|mehrere fahrzeuge|fahrzeugkollision|kreuzung|intersection)/.test(text)
            && /(strasse|straße|road|verkehr|fahrzeug|auto|pkw|kreuzung|intersection|zufahrt)/.test(text);
        if (sarRoadIncident) return 'road_incident';
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
        baumaschine: 'earthmoving',
        baumaschinen: 'earthmoving',
        building_material: 'construction_material',
        building_materials: 'construction_material',
        construction_material: 'construction_material',
        construction_materials: 'construction_material',
        baumaterial: 'construction_material',
        baustellenmaterial: 'construction_material',
        rooftop_units: 'construction_material',
        rooftopunits: 'construction_material',
        rooftopunits03: 'construction_material',
        material: 'cargo_material',
        cargo: 'cargo_material',
        pallets: 'pallet_stack',
        pallet: 'pallet_stack',
        paletten: 'pallet_stack',
        palette: 'pallet_stack',
        pallet_stack: 'pallet_stack',
        material_stack: 'pallet_stack',
        materiallager: 'pallet_stack',
        logbook: 'aircraft_logbook',
        aircraft_logbook: 'aircraft_logbook',
        bordbuch: 'aircraft_logbook',
        flugbuch: 'aircraft_logbook',
        fire_extinguisher: 'fire_extinguisher',
        feuerloescher: 'fire_extinguisher',
        feuerlöscher: 'fire_extinguisher',
        feuerl_scher: 'fire_extinguisher',
        first_aid: 'first_aid_case',
        first_aid_case: 'first_aid_case',
        verbandkasten: 'first_aid_case',
        verbandzeug: 'first_aid_case',
        erste_hilfe_koffer: 'first_aid_case',
        chock: 'wheel_chocks',
        chocks: 'wheel_chocks',
        wheel_chock: 'wheel_chocks',
        wheel_chocks: 'wheel_chocks',
        aircraft_wheel_chocks: 'wheel_chocks',
        radkeil: 'wheel_chocks',
        radkeile: 'wheel_chocks',
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
        hiker_rescue: 'missing_person',
        skier_rescue: 'missing_person',
        rescue_target: 'missing_person',
        rescue_scene: 'missing_person',
        hiker: 'missing_person',
        skier: 'missing_person',
        wanderer: 'missing_person',
        marker: 'cones',
        cone: 'cones',
        ground_marker: 'cones',
        ground_markers: 'cones',
        ground_marking: 'cones',
        ground_markings: 'cones',
        bodenmarkierung: 'cones',
        bodenmarkierungen: 'cones',
        aircraft_wreck: 'aircraft_wreck',
        aircraft_debris: 'aircraft_wreck',
        downed_aircraft: 'aircraft_wreck',
        downed_ultralight: 'aircraft_wreck',
        crashed_aircraft: 'aircraft_wreck',
        plane_wreck: 'aircraft_wreck',
        aircraft: 'aircraft_wreck',
        airplane: 'aircraft_wreck',
        plane: 'aircraft_wreck',
        ultralight: 'aircraft_wreck',
        ultraleicht: 'aircraft_wreck',
        ultraleichtflugzeug: 'aircraft_wreck',
        kleinflugzeug: 'aircraft_wreck',
        flugzeug: 'aircraft_wreck',
        flugzeugwrack: 'aircraft_wreck',
        wrack: 'aircraft_wreck',
        rubble: 'debris',
        truemmer: 'debris',
        treibgut: 'logs',
        log: 'logs',
        raft: 'liferaft',
        boat: 'watercraft',
        boats: 'watercraft',
        small_boat: 'watercraft',
        small_watercraft: 'watercraft',
        rowboat: 'watercraft',
        lake_boat: 'watercraft',
        badesee_boot: 'watercraft',
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
        lantern: 'lantern',
        laterne: 'lantern',
        stalllaterne: 'lantern',
        camp_lantern: 'lantern',
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
    construction_site: { construction_crane: 1, earthmoving: 1, construction_truck: 1, construction_material: 1, cones: 2 },
    erosion_damage: { logs: 2, debris: 1, cones: 1 },
    debris_field: { aircraft_wreck: 1, debris: 3 },
    sar_water: { liferaft: 1, service_ship: 1, watercraft: 1, missing_person: 1, small_equipment: 1 },
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
            if (r === 'construction.vehicle') add('construction_truck');
            if (r === 'construction.material') add('construction_material');
            if (r === 'vehicle.bus') add('bus');
            if (r === 'sar.liferaft') add('liferaft');
            if (r === 'sar.person_target') add('missing_person');
            if (r === 'watercraft.tiny_boat' || r === 'watercraft.small_boat' || r === 'watercraft.boat') add('watercraft');
            if (r === 'watercraft.service_ship' || r === 'watercraft.large_ship' || r === 'watercraft.ship') add('service_ship');
            if (r === 'animal.waterfowl' || r === 'animal.bird') add('waterfowl');
            if (r === 'animal.wildlife' || r === 'animal.deer') add('wildlife_animals');
            if (r === 'animal.grazing') add('animal_herd');
            if (r === 'camp.tent' || r === 'camp.trailer') add('tent');
            if (r === 'scene.lighting.lantern') add('lantern');
            if (r === 'cargo.aircraft_logbook') add('aircraft_logbook');
            if (r === 'cargo.fire_extinguisher') add('fire_extinguisher');
            if (r === 'cargo.first_aid_case') add('first_aid_case');
            if (r === 'cargo.wheel_chocks') add('wheel_chocks');
            if (r === 'vehicle.car') add((kind === 'road_incident' || kind === 'event_site') ? 'road_vehicles' : 'parked_vehicle');
            if (r === 'cargo.medical_kit' || r === 'cargo.animal_transport_box' || r === 'cargo.camera_equipment' || r === 'cargo.camping_equipment' || r === 'cargo.equipment_case') add('cargo_material');
            if (r === 'cargo.small_box') add((kind === 'cargo_site' || kind === 'medical_pickup') ? 'cargo_material' : 'small_equipment');
            if (r === 'aircraft.wreck') add('aircraft_wreck');
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
    if (/(baumaterial|baustellenmaterial|building material|rooftopunits|rooftop units|aggregat|generator|materiallager)/.test(text)) add('construction_material');
    if (/(flugzeug|kleinflugzeug|ultraleicht|ul[\s-]?maschine|luftfahrzeug|wrack|einschlag|absturz)/.test(text)) add('aircraft_wreck');
    if (/(truemmer|trümmer|debris|wrackteile|streugut)/.test(text)) add('debris');
    if (!out.includes('aircraft_logbook') && /(treibholz|baumstamm|log|logs)/.test(text)) add('logs');
    if (kind === 'sar_land' && (/(sichtkontakt|gesichtet|fundstelle|person am boden|verletzte person|wink|winkt|hilferuf|hilfezeichen)/.test(text) || _missionSarLooksLikePersonSearch())) add('missing_person');
    if (/(rauchsignal|signalrauch|farbiger rauch|signalfackel|signal smoke)/.test(text)) add('signal_smoke');
    else if (/(rauch|smoke|abluft)/.test(text) && kind !== 'fire_watch') add('smoke_light');
    if (/(rettungsinsel|liferaft)/.test(text)) add('liferaft');
    if (/(boot|boat|kajak|kayak|paddel|paddle|badesee|seeufer)/.test(text)) add('watercraft');
    if (_missionTargetSceneAllowsLargeWatercraft(text) && /(arbeitsschiff|küstenwache|kuestenwache|coast guard|schiff|ship|ferry|faehre|fähre|cutter|service ship)/.test(text)) add('service_ship');
    if (/(ente|enten|goose|geese|gans|gaense|gänse|wasservogel|wasservoegel|wasservögel|seagull|moewe|möwe|voegel|vögel|bird|birds)/.test(text)) add('waterfowl');
    if (/(wildtier|wildtiere|wildlife|hirsch|reh|elch|deer|moose|elk|habitat)/.test(text)) add('wildlife_animals');
    if (/(herde|weidetiere|schafe|kuehe|kühe|rinder|ziegen|pferde|grazing|herd)/.test(text)) add('animal_herd');
    if (/(zelt|camp|camping|ufercamp|trailer|wohnwagen)/.test(text)) add('tent');
    if (/(parkendes auto|auto am ufer|uferparkplatz|shore car|parked car)/.test(text)) add('parked_vehicle');
    if (/(picknick|picnic|ausruestung|ausrüstung|kiste|box|kleine ladung)/.test(text)) add('small_equipment');
    if (kind === 'sar_land' && /(vehicle_off_road|fahrzeugabkommen|von der strasse abgekommen|von der straße abgekommen|fahrzeugunfall|fahrzeughinweis|fahrzeugspuren|reifenspur|boeschungsschaden|böschungsschaden|glas|reflektion|pkw|kleinwagen|motorrad)/.test(text)) {
        add('parked_vehicle');
        add('small_equipment');
    }
    if (kind === 'road_incident' && /(road_collision|intersection_accident|intersection_crash|traffic_accident|verkehrsunfall|kollision|crash|unfallstelle|mehrere fahrzeuge|fahrzeugkollision|kreuzung|intersection)/.test(text)) {
        add('road_vehicles');
        add('people');
        if (/(rauch|smoke|qualm)/.test(text)) add('smoke_light');
    }
    if (/(lagerfeuer|campfire|firepit|feuerstelle)/.test(text)) add('campfire');
    if (/(stalllaterne|camp[\s-]?laterne|laterne|lantern)/.test(text)) add('lantern');
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
            const limit = (feature === 'pallet_stack' || feature === 'cargo_material' || feature === 'construction_material') ? 8 : (feature === 'cones' ? 8 : 6);
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
    if (feature === 'pallet_stack' || feature === 'cargo_material' || feature === 'construction_material') return 'cluster';
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
    if (f === 'service_ship') {
        return _missionTargetSceneAllowsLargeWatercraft(_missionTargetSceneText());
    }
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
    const constructionVehiclePool = _sceneUniqueTitles(MISSION_SCENE_ASSET_POOLS.constructionVehicles, civilTrucks);
    const constructionMaterialPool = _sceneUniqueTitles(MISSION_SCENE_ASSET_POOLS.constructionMaterials, MISSION_SCENE_ASSET_POOLS.palletCargo, MISSION_SCENE_ASSET_POOLS.cargo);
    const supportVehiclePool = MISSION_SCENE_ASSET_POOLS.medicalVehicles.concat(MISSION_SCENE_ASSET_POOLS.fireVehicles, civilVans);
    const primarySupportVehiclePool = MISSION_SCENE_ASSET_POOLS.medicalVehicles.length
        ? MISSION_SCENE_ASSET_POOLS.medicalVehicles
        : supportVehiclePool;
    const smallBoatPool = _missionTargetSceneSafeSmallBoatPool();
    const serviceShipPool = _sceneUniqueTitles(MISSION_SCENE_ASSET_POOLS.serviceShips, MISSION_SCENE_ASSET_POOLS.largeShips);
    const debrisPool = MISSION_SCENE_ASSET_POOLS.debrisLight.concat(MISSION_SCENE_ASSET_POOLS.natureLogs);
    const aircraftWreckPool = MISSION_SCENE_ASSET_POOLS.aircraftWreck || [];
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
        const maxFeatureCount = (feature === 'pallet_stack' || feature === 'cargo_material' || feature === 'construction_material') ? 8 : (feature === 'cones' ? 8 : 6);
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
                const pool = feature === 'construction_truck' ? constructionVehiclePool : truckPool;
                const fallbackTitle = feature === 'construction_truck' ? (pool[0] || 'Truck Crane Small') : (primaryTruckPool[0] || 'Truck Utility Europe Flush');
                const truck = _scenePickTitle(pool, `feature-truck-${feature}-${i}`, fallbackTitle);
                add(`feature_${feature}_${i + 1}`, feature === 'construction_truck' ? 'Zusatz Baustellenfahrzeug' : 'Zusatz Utility Fahrzeug', truck, pool, -22 - step, 6 + step, { hdgOffsetDeg: 205 });
            } else if (feature === 'construction_crane') {
                const crane = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.constructionCranes, `feature-crane-${i}`, 'Truck Crane Small');
                add(`feature_crane_${i + 1}`, 'Zusatz Kran', crane, MISSION_SCENE_ASSET_POOLS.constructionCranes, -18 - step, 14 + step, { hdgOffsetDeg: 210 });
            } else if (feature === 'earthmoving') {
                const dozer = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.constructionEarthmoving, `feature-earthmoving-${i}`, 'Bulldozer');
                add(`feature_earthmoving_${i + 1}`, 'Zusatz Erdbaumaschine', dozer, MISSION_SCENE_ASSET_POOLS.constructionEarthmoving, 12 + step, -10 - step, { hdgOffsetDeg: 35 });
            } else if (feature === 'cargo_material' || feature === 'pallet_stack' || feature === 'construction_material') {
                const cargoPool = feature === 'construction_material'
                    ? constructionMaterialPool
                    : (feature === 'pallet_stack' ? MISSION_SCENE_ASSET_POOLS.palletCargo : (kind === 'construction_site' ? constructionMaterialPool : MISSION_SCENE_ASSET_POOLS.cargo));
                const cargo = _scenePickTitle(cargoPool, `feature-cargo-${feature}-${i}`, feature === 'construction_material' ? 'BuildingMaterial01' : 'Pallet01_02');
                let pos = kind === 'sar_land' ? { f: -62 - step, r: 28 + step, hdg: 210 } : { f: 5 + step, r: 14 + step, hdg: 20 };
                if (arrangement === 'cluster') {
                    const center = kind === 'construction_site' ? { f: 8, r: 13 } : { f: pos.f, r: pos.r };
                    pos = _missionSceneClusterOffset(i, center.f, center.r, feature === 'pallet_stack' ? 3.1 : 3.6);
                }
                add(`feature_cargo_${i + 1}`, kind === 'sar_land' ? 'Support Material abseits Suchziel' : (feature === 'construction_material' ? 'Zusatz Baustellenmaterial' : 'Zusatz Material/Fracht'), cargo, cargoPool, pos.f, pos.r, { hdgOffsetDeg: pos.hdg });
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
                const rescueTarget = _missionSceneRescueTargetTitle(`feature-missing-person-${i}`) || (i % 2 ? personB : personA);
                const pool = _sceneUniqueTitles(MISSION_SCENE_ASSET_POOLS.sarPersonTargets, peoplePool);
                add(`feature_missing_person_${i + 1}`, 'Vermisste / winkende Person', rescueTarget, pool, 0 + (i * 3), -2 + (i * 2), { hdgOffsetDeg: 180 });
            } else if (feature === 'cones') {
                add(`feature_cone_${(i * 2) + 1}`, 'Zusatz Absperrkegel', cone, markerPool, -7 + step, -3 - step);
                add(`feature_cone_${(i * 2) + 2}`, 'Zusatz Absperrkegel', cone, markerPool, 9 + step, 3 + step);
            } else if (feature === 'aircraft_wreck') {
                const aircraft = _scenePickTitle(aircraftWreckPool, `feature-aircraft-wreck-${i}`, 'Cessna 172 Skyhawk');
                const fallback = { f: -2 + (i * 7), r: -5 + (i * 5), hdg: 35 + (i * 25) };
                add(`feature_aircraft_wreck_${i + 1}`, 'Kleinflugzeug / UL-Wrack', aircraft, aircraftWreckPool, fallback.f, fallback.r, {
                    hdgOffsetDeg: fallback.hdg,
                    placement: 'aircraft wreck search target'
                });
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
                if (!_missionTargetSceneAllowsLargeWatercraft()) continue;
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
                const anchorNames = kind === 'sar_water' ? ['path', 'road', 'parking', 'water'] : ['parking', 'road', 'path'];
                const pos = _missionTargetGeoOffset(anchorNames, fallback.f, fallback.r, { minM: kind === 'sar_land' ? 55 : 18, maxM: kind === 'sar_land' ? 900 : 115, lateralM: i * 7, hdgOffsetDeg: fallback.hdg });
                add(`feature_shore_vehicle_${i + 1}`, kind === 'sar_land'
                    ? 'Abgestelltes Fahrzeug abseits Fundpunkt'
                    : (kind === 'sar_water' ? 'Fahrzeug am Ufer / Wasserzugang' : 'Zusatz parkendes Auto'), car, carPool, pos.f, pos.r, {
                    hdgOffsetDeg: pos.hdg,
                    placement: kind === 'sar_land' ? 'road/perimeter support' : (kind === 'sar_water' ? 'shore vehicle clue' : 'parked vehicle'),
                    geoAnchor: _missionTargetGeoAnchorDebug(pos, anchorNames)
                });
            } else if (feature === 'small_equipment') {
                const kit = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.smallCargo, `feature-equipment-${i}`, 'Cardboard');
                const fallback = kind === 'sar_land' ? { f: 8 + step, r: -6 - step, hdg: 10 } : { f: -11 - step, r: 14 + step, hdg: 10 };
                const pos = _missionTargetGeoOffset(['water', 'path', 'road', 'parking'], fallback.f, fallback.r, { minM: 10, maxM: 95, lateralM: i * 4, hdgOffsetDeg: fallback.hdg });
                add(`feature_equipment_${i + 1}`, kind === 'sar_land' ? 'Hinweis / kleine Ausruestung' : 'Zusatz Ausruestung', kit, MISSION_SCENE_ASSET_POOLS.smallCargo, pos.f, pos.r, { hdgOffsetDeg: pos.hdg });
            } else if (feature === 'aircraft_logbook' || feature === 'fire_extinguisher' || feature === 'first_aid_case' || feature === 'wheel_chocks') {
                const featurePools = {
                    aircraft_logbook: MISSION_SCENE_ASSET_POOLS.aircraftLogbooks,
                    fire_extinguisher: MISSION_SCENE_ASSET_POOLS.fireExtinguishers,
                    first_aid_case: MISSION_SCENE_ASSET_POOLS.firstAidCases,
                    wheel_chocks: MISSION_SCENE_ASSET_POOLS.wheelChocks
                };
                const featureLabels = {
                    aircraft_logbook: 'Luftfahrzeug-Bordbuch / Flugbuch',
                    fire_extinguisher: 'Feuerloescher',
                    first_aid_case: 'Erste-Hilfe-Koffer / Verbandkasten',
                    wheel_chocks: 'Flugzeug-Radkeile / Wheel Chocks'
                };
                const pool = featurePools[feature] || [];
                const title = String(pool[0] || '').trim();
                if (!title) continue;
                const pos = _missionTargetGeoOffset(['parking', 'road', 'path'], -8 - step, 11 + step, {
                    minM: 8,
                    maxM: 75,
                    lateralM: i * 3,
                    hdgOffsetDeg: 10
                });
                add(`feature_${feature}_${i + 1}`, featureLabels[feature], title, pool, pos.f, pos.r, {
                    hdgOffsetDeg: pos.hdg,
                    placement: 'mission equipment'
                });
            } else if (feature === 'campfire') {
                const fire = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.fireVfx, `feature-campfire-${i}`, 'VO_Fire_R1_40');
                add(`feature_campfire_${i + 1}`, 'Zusatz Lagerfeuer', fire, MISSION_SCENE_ASSET_POOLS.fireVfx, -7 - step, 8 + step, { hdgOffsetDeg: 0 });
            } else if (feature === 'lantern') {
                const lantern = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.campLanterns, `feature-lantern-${i}`, MISSION_SCENE_ASSET_POOLS.campLanterns[0] || '');
                if (!lantern) continue;
                const pos = _missionTargetGeoOffset(['path', 'forest', 'meadow', 'parking'], -10 - step, 9 + step, { minM: 10, maxM: 90, lateralM: i * 3, hdgOffsetDeg: 15 });
                add(`feature_lantern_${i + 1}`, 'Zusatz Stall-/Camp-Laterne', lantern, MISSION_SCENE_ASSET_POOLS.campLanterns, pos.f, pos.r, { hdgOffsetDeg: pos.hdg });
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
        const truck = _scenePickTitle(constructionVehiclePool, 'construction-truck', constructionVehiclePool[0] || 'Truck Utility Europe Flush');
        const material = _scenePickTitle(constructionMaterialPool, 'construction-material', 'BuildingMaterial01');
        add('construction_crane', 'Kranfahrzeug', crane, MISSION_SCENE_ASSET_POOLS.constructionCranes, -10, 7, { hdgOffsetDeg: 205 });
        add('construction_dozer', 'Erdbaumaschine', dozer, MISSION_SCENE_ASSET_POOLS.constructionEarthmoving, 7, -6, { hdgOffsetDeg: 35 });
        add('construction_truck', 'Baustellenfahrzeug', truck, constructionVehiclePool, -18, -7, { hdgOffsetDeg: 180 });
        add('construction_material', 'Baustellenmaterial', material, constructionMaterialPool, 4, 10, { hdgOffsetDeg: 15 });
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
        const hasAircraftWreck = _missionTargetSceneRequestedFeatures(kind).includes('aircraft_wreck');
        if (hasAircraftWreck) {
            const aircraft = _scenePickTitle(aircraftWreckPool, 'aircraft-wreck-main', 'Cessna 172 Skyhawk');
            add('aircraft_wreck', 'Kleinflugzeug / UL-Wrack', aircraft, aircraftWreckPool, -2, -5, {
                hdgOffsetDeg: 35,
                placement: 'primary aircraft wreck'
            });
        }
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
        if (_missionSceneIsSarHeliMission()) {
            add('sar_heli_patient', 'Zu bergende Person an Unfallstelle', personA, peoplePool, 3, -12, { hdgOffsetDeg: 90 });
            add('person_2', 'Person an Unfallstelle', personB, peoplePool, -2, -13, { hdgOffsetDeg: 110 });
        } else {
            add('person_1', 'Person an Unfallstelle', personA, peoplePool, 3, -12, { hdgOffsetDeg: 90 });
            add('person_2', 'Person an Unfallstelle', personB, peoplePool, -2, -13, { hdgOffsetDeg: 110 });
        }
        add('marker_1', 'Absperrkegel', cone, markerPool, -5, -2);
        add('marker_2', 'Absperrkegel', cone, markerPool, 11, 1);
        return finish();
    }

    if (kind === 'sar_water') {
        const requestedFeatures = _missionTargetSceneRequestedFeatures(kind);
        const sarText = _missionSarContextText();
        const raft = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.sarWaterTarget, 'sar-water-raft', 'LifeRaft');
        const smallBoat = _scenePickTitle(smallBoatPool, 'sar-water-small-boat', 'Fishing Boat Red Modular');
        const serviceShip = _scenePickTitle(serviceShipPool, 'sar-water-service-ship', 'Microsoft_Ships_AbeilleBourbon_1.0');
        const targetPerson = _scenePickTitle([personA, personB].filter(Boolean), 'sar-water-missing-person', personA || personB);
        const kit = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.smallCargo, 'sar-water-clue-equipment', 'Cardboard');
        const waterPos = _missionTargetGeoOffset(['water'], 0, 0, { minM: 10, maxM: 115, hdgOffsetDeg: 20 });
        const shorePos = _missionTargetGeoOffset(['path', 'road', 'parking', 'meadow', 'water'], 10, -8, { minM: 14, maxM: 125, lateralM: -10, hdgOffsetDeg: 180 });
        const cluePos = _missionTargetGeoOffset(['path', 'road', 'parking', 'water'], 7, -12, { minM: 14, maxM: 120, lateralM: 8, hdgOffsetDeg: 35 });
        const supportPos = _missionTargetGeoOffset(['water'], waterPos.f - 32, waterPos.r + 23, { minM: 35, maxM: 150, lateralM: 22, hdgOffsetDeg: 135 });
        if (requestedFeatures.includes('liferaft')) {
            add('liferaft', 'Rettungsinsel / Wasser-SAR-Ziel', raft, MISSION_SCENE_ASSET_POOLS.sarWaterTarget, waterPos.f, waterPos.r, {
                hdgOffsetDeg: waterPos.hdg,
                placement: 'search target on water',
                geoAnchor: _missionTargetGeoAnchorDebug(waterPos, ['water'])
            });
        }
        if (requestedFeatures.includes('watercraft') || /(kajak|kayak|paddel|paddler|paddlerin|kleines boot|small boat)/.test(sarText)) {
            add('watercraft', 'Kleines Boot / Wasserhinweis', smallBoat, smallBoatPool, waterPos.f + 16, waterPos.r - 10, {
                hdgOffsetDeg: waterPos.hdg,
                placement: 'secondary water clue',
                geoAnchor: _missionTargetGeoAnchorDebug(waterPos, ['water'])
            });
        }
        if (!_missionSarExplicitFalseAlarm() && requestedFeatures.includes('missing_person')) {
            add('missing_person', 'Vermisste Person am Ufer', targetPerson, peoplePool, shorePos.f, shorePos.r, {
                hdgOffsetDeg: shorePos.hdg,
                placement: 'shoreline search target',
                geoAnchor: _missionTargetGeoAnchorDebug(shorePos, ['path', 'road', 'parking', 'meadow', 'water'])
            });
        }
        if (requestedFeatures.includes('small_equipment')) {
            add('shore_equipment', 'Ausruestung / Hinweis am Ufer', kit, MISSION_SCENE_ASSET_POOLS.smallCargo, cluePos.f, cluePos.r, {
                hdgOffsetDeg: cluePos.hdg,
                placement: 'shore clue near target',
                geoAnchor: _missionTargetGeoAnchorDebug(cluePos, ['path', 'road', 'parking', 'water'])
            });
        }
        if (requestedFeatures.includes('service_ship') && /(kueste|küste|meer|sea|coast|hafen|harbor|kuestenwache|küstenwache|coast guard|offshore|arbeitsschiff)/.test(sarText)) {
            add('service_ship_1', 'SAR Arbeits-/Service-Schiff', serviceShip, serviceShipPool, supportPos.f, supportPos.r, {
                hdgOffsetDeg: supportPos.hdg,
                placement: 'coastal water rescue support',
                geoAnchor: _missionTargetGeoAnchorDebug(supportPos, ['water'])
            });
        }
        return finish();
    }

    if (kind === 'sar_land') {
        const requestedFeatures = _missionTargetSceneRequestedFeatures(kind);
        const wantsMissingPerson = requestedFeatures.includes('missing_person') || _missionSarLooksLikePersonSearch();
        const hasSupportObjects = requestedFeatures.some(feature => ['emergency_response', 'people', 'road_vehicles', 'parked_vehicle'].includes(feature));
        if (wantsMissingPerson || !hasSupportObjects) {
            if (wantsMissingPerson) {
                const targetPerson = _missionSceneRescueTargetTitle('sar-land-missing-person') || _scenePickTitle([personA, personB].filter(Boolean), 'sar-land-missing-person', personA || personB);
                const targetPool = _sceneUniqueTitles(MISSION_SCENE_ASSET_POOLS.sarPersonTargets, peoplePool);
                add('missing_person', 'Vermisste / winkende Person', targetPerson, targetPool, 0, 0, {
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
        const cargo = MISSION_SCENE_ASSET_POOLS.medicalEquipment[0] || _scenePickTitle(medicalPool, 'medical-cargo', 'Cardboard');
        add('medical_vehicle', 'Medizinisches Fahrzeug', vehicle, MISSION_SCENE_ASSET_POOLS.medicalVehicles.concat(vanPool), -13, 9, { hdgOffsetDeg: 205 });
        add('person_1', 'Medizinisches Team', personA, peoplePool, 1, 5, { hdgOffsetDeg: 180 });
        add('person_2', 'Medizinisches Team', personB, peoplePool, 4, 7, { hdgOffsetDeg: 220 });
        add('cargo_1', 'Medizinische Kiste', cargo, medicalPool, 2, 9);
        return finish();
    }

    if (kind === 'cargo_site') {
        const vehicle = _scenePickTitle(primaryTruckPool, 'target-cargo-vehicle', primaryTruckPool[0] || 'Microsoft_Van_EUR');
        const semanticCargo = _missionSceneSemanticCargoAsset(_missionSceneCargoText(), _missionSceneCargoWeightLbs());
        const semanticCargoPool = semanticCargo?.candidates?.length
            ? semanticCargo.candidates
            : MISSION_SCENE_ASSET_POOLS.cargo;
        const cargoA = semanticCargo?.title || _scenePickTitle(semanticCargoPool, 'target-cargo-a', 'Pallet01_02');
        const cargoB = _scenePickTitle(MISSION_SCENE_ASSET_POOLS.smallCargo.concat(MISSION_SCENE_ASSET_POOLS.cargo), 'target-cargo-b', 'Cardboard');
        add('cargo_vehicle', 'Frachtfahrzeug', vehicle, truckPool, -14, 9, { hdgOffsetDeg: 205 });
        add('cargo_1', 'Fracht', cargoA, semanticCargoPool, 1, 4);
        add('cargo_2', 'Fracht klein', cargoB, MISSION_SCENE_ASSET_POOLS.smallCargo.concat(MISSION_SCENE_ASSET_POOLS.cargo), 3, 8);
        add('person_1', 'Bodencrew', personA, peoplePool, 6, 6, { hdgOffsetDeg: 230 });
        return finish();
    }

    if (kind === 'media_site') {
        const vehicle = _scenePickTitle(vanPool, `${kind}-vehicle`, vanPool[0] || 'Microsoft_Van_EUR');
        const mediaEquipmentPool = MISSION_SCENE_ASSET_POOLS.cameraEquipment.concat(MISSION_SCENE_ASSET_POOLS.equipmentCases, MISSION_SCENE_ASSET_POOLS.smallCargo);
        const cargo = MISSION_SCENE_ASSET_POOLS.cameraEquipment[0] || _scenePickTitle(mediaEquipmentPool, `${kind}-kit`, 'Cardboard');
        add('work_vehicle', 'Medienfahrzeug', vehicle, vanPool, -12, 8, { hdgOffsetDeg: 210 });
        add('equipment_1', 'Kameraausruestung', cargo, mediaEquipmentPool, 2, 6);
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
    if (status.sceneId === sceneId && (status.spawned || _missionSceneSpawnPendingActive(status, sceneId))) return false;
    if (_missionSceneSpawnBackoffActive(status, sceneId)) return false;
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
        lastSpawnFailedAt: 0,
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
            requestedFeatures: _missionTargetSceneRequestedFeatures(kind),
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
            _missionPhaseDebugPush('boarding_wait_timeout', {
                commandId,
                timeoutMs: Math.max(1000, Number(timeoutMs) || 15000),
                lastCommand: window.missionSceneStatus?.lastCommand || null
            });
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

function _missionSceneResetBoardingState(error = null, options = {}) {
    if (!window.missionSceneStatus || typeof window.missionSceneStatus !== 'object') return;
    _missionPhaseDebugPush('boarding_reset', {
        error: error ? String(error) : null,
        rollbackStartPhase: !!options?.rollbackStartPhase,
        recoverScene: !!options?.recoverScene,
        clearPersonBoarded: options?.clearPersonBoarded !== false,
        ignoreCommandId: !!options?.ignoreCommandId,
        lastCommand: window.missionSceneStatus?.lastCommand || null,
        startPhase: _missionStartPhase(),
        runtimePhase: _missionRuntimePhaseSnapshot()
    });
    window.missionSceneStatus.boardingPreparing = false;
    window.missionSceneStatus.boardingRequested = false;
    window.missionSceneStatus.boardingActive = false;
    window.missionSceneStatus.boardingComplete = false;
    window.missionSceneStatus.boardingError = error ? String(error) : null;
    window.missionSceneStatus.boardingVoiceComplete = false;
    missionSceneBoardingCuePlayback = null;
    if (options?.clearPersonBoarded !== false) window.missionSceneStatus.personBoarded = false;
    if (options?.rollbackStartPhase && _missionStartPhase() === 'boarding') {
        _setMissionStartPhase('prepare');
        _setMissionRuntimePhase('planned', { updateUi: false, reason: 'boarding-rollback' });
    }
    const failedCommandId = String(window.missionSceneStatus?.lastCommand?.type === 'mission_scene_boarding'
            ? window.missionSceneStatus.lastCommand.commandId || ''
            : '');
    if (options?.ignoreCommandId && failedCommandId) missionSceneIgnoredBoardingCommandIds.add(failedCommandId);
    if (options?.recoverScene && !window.simModeActive && window.liveTrackerConnected) {
        if (failedCommandId) missionSceneIgnoredBoardingCommandIds.add(failedCommandId);
        window.missionSceneStatus.respawnAfterClear = true;
        window.missionSceneStatus.respawnAfterClearReason = 'boarding-failure-recover';
        window.missionSceneClear?.('boarding-failure-recover');
    }
    if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
    _updateMissionRuntimeUi();
}

function _missionBushPickupBoardingApplySuccess(item = null) {
    if (!item) return false;
    _missionPhaseDebugPush('trigger', {
        name: '_missionBushPickupBoardingApplySuccess',
        itemId: item.id || null,
        itemLabel: item.label || item.storyName || null
    });
    window.missionCargoLoadItem?.(item.id, {
        mode: 'pickup',
        render: false,
        skipAnimation: true,
        playAudioCue: false
    });
    _missionBushUpdateProgress();
    window.missionCargoActivatePickupPassenger?.();
    _missionScenePrepareDeboardingCue();
    if (typeof window.paxVoiceResetLeg === 'function') {
        try { window.paxVoiceResetLeg(); } catch (_) {}
    }
    if (typeof window.triggerPaxPickupBoarding === 'function') {
        setTimeout(() => {
            try {
                if (window.activePassenger) window.triggerPaxPickupBoarding();
            } catch (_) {}
        }, 300);
    }
    _missionCargoRenderDialog('pickup', { skipPayloadRefresh: true });
    return true;
}

async function _missionBushPickupBoarding(item = null, options = {}) {
    if (!_missionBushIsPickupMission() || !item || !_missionCargoIsPassengerItem(item)) return false;
    if (typeof _missionCargoItemCanLoadAtCurrentStage === 'function' && !_missionCargoItemCanLoadAtCurrentStage(item)) {
        const pickupPlaceLabel = String(_activeBushMissionSpec()?.profileId || '').toLowerCase() === 'apt_charter_pickup' ? 'Zielplatz' : 'Zielstrip';
        window.missionCargoStatus.error = `Dieser Pickup ist erst am ${pickupPlaceLabel} verfügbar.`;
        _missionCargoRenderDialog('pickup', { skipPayloadRefresh: true });
        return false;
    }
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
    _missionScenePrepareBoardingCue();
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
        _missionSceneResetBoardingState('pickup_scene_geometry_missing', { clearPersonBoarded: false });
        const next = _activeBushMissionProgress();
        if (next) _persistBushMissionProgress({ ...next, pickupReady: true, status: 'pickup_ready' });
        _missionCargoRenderDialog('pickup', { skipPayloadRefresh: true });
        return false;
    }
    const personRel = _missionSceneWorldPointToRelative(Number(pos.lat), Number(pos.lon), hdg, personPoint.worldLat, personPoint.worldLon);
    if (!personRel) {
        _missionSceneResetBoardingState('pickup_scene_relative_position_failed', { clearPersonBoarded: false });
        const next = _activeBushMissionProgress();
        if (next) _persistBushMissionProgress({ ...next, pickupReady: true, status: 'pickup_ready' });
        _missionCargoRenderDialog('pickup', { skipPayloadRefresh: true });
        return false;
    }
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
        _missionSceneResetBoardingState('pickup_boarding_not_sent', { clearPersonBoarded: false });
        const next = _activeBushMissionProgress();
        if (next) _persistBushMissionProgress({ ...next, pickupReady: true, status: 'pickup_ready' });
        _missionCargoRenderDialog('pickup', { skipPayloadRefresh: true });
        return false;
    }
    window.missionSceneStatus.lastCommandAt = Date.now();
    window.missionSceneStatus.lastCommand = { type: 'mission_scene_boarding', commandId, reason: command.reason };
    const ack = await _waitForMissionSceneBoardingAck(commandId, 65000);
    if (ack?.status === 'ok') {
        let stagedCuePlayed = false;
        if (missionSceneBoardingCuePlayback?.promise
            && String(missionSceneBoardingCuePlayback.commandId || '') === String(commandId)) {
            stagedCuePlayed = await _missionSceneAwaitCuePlayback(missionSceneBoardingCuePlayback);
        }
        if (!stagedCuePlayed && typeof window.paxPlayAudioCue === 'function') {
            const fallbackCue = window.paxPlayAudioCue(_missionSceneBoardingCueId(), {
                seed: `mission-pickup-boarding|${aptSceneId}|${commandId}`,
                gain: 0.38,
                variantScope: 'event'
            });
            await _missionSceneAwaitCuePlayback({ promise: Promise.resolve(fallbackCue).then(Boolean).catch(() => false) });
        }
        missionSceneBoardingCuePlayback = null;
        return _missionBushPickupBoardingApplySuccess(item);
    }
    window.missionCargoStatus.error = ack?.error || ack?.status || 'pickup_boarding_failed';
    _missionSceneResetBoardingState(window.missionCargoStatus.error, { clearPersonBoarded: false, ignoreCommandId: true });
    if (!window.simModeActive && window.liveTrackerConnected) {
        try { window.missionAptArrivalClear?.('pickup-boarding-failure-recover'); } catch (_) {}
        setTimeout(() => {
            try { window.missionAptArrivalEnsureSpawned?.('pickup-boarding-failure-recover'); } catch (_) {}
        }, 1200);
    }
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

function _waitForTrackerDebugAck(commandId, timeoutMs = 7000) {
    if (!commandId) return Promise.resolve({ status: 'not_sent' });
    return new Promise(resolve => {
        const timer = setTimeout(() => {
            trackerDebugCommandWaiters.delete(commandId);
            resolve({ type: 'aircraft_debug_ack', commandId, status: 'timeout' });
        }, Math.max(1000, Number(timeoutMs) || 7000));
        trackerDebugCommandWaiters.set(commandId, { resolve, timer });
    });
}

function _resolveTrackerDebugAck(ack) {
    const commandId = ack?.commandId;
    if (!commandId || !trackerDebugCommandWaiters.has(commandId)) return;
    const waiter = trackerDebugCommandWaiters.get(commandId);
    trackerDebugCommandWaiters.delete(commandId);
    clearTimeout(waiter.timer);
    waiter.resolve(ack);
}

window.trackerPayloadGet = async function(options = {}) {
    const maxStations = Math.max(1, Math.min(20, Math.round(Number(options?.maxStations ?? 12) || 12)));
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
    const trackerRun = window.lastTrackerMissionAuthority?.activeRun || null;
    const localAuthority = _readMissionAuthorityState();
    if (_trackerSupportsMissionAuthority() && trackerRun?.runId
        && (!localAuthority?.runId || localAuthority.runId !== trackerRun.runId || trackerRun.ownerClientId !== _missionAuthorityClientId())) {
        return { status: 'conflict', error: 'mission_authority_conflict' };
    }
    const payloadAdapter = String(options?.payloadAdapter || options?.adapter || '').trim();
    const pa24State = options?.pa24State && typeof options.pa24State === 'object'
        ? options.pa24State
        : null;
    const rows = (Array.isArray(stations) ? stations : [])
        .map(row => ({
            index: Math.round(Number(row?.index)),
            weightLbs: Number(row?.weightLbs)
        }))
        .filter(row => Number.isFinite(row.index) && row.index >= 1 && row.index <= 20 && Number.isFinite(row.weightLbs));
    if (!rows.length && !pa24State) return { status: 'invalid_input', error: 'no_valid_payload_target' };
    const commandId = window.sendTrackerCommand({
        type: 'aircraft_payload_set',
        maxStations: Math.max(1, Math.min(20, Math.round(Number(options?.maxStations ?? 12) || 12))),
        stations: rows,
        payloadAdapter,
        pa24State
    });
    if (!commandId) return { status: 'not_sent' };
    window.aircraftPayloadStatus.lastCommandAt = Date.now();
    window.aircraftPayloadStatus.error = null;
    const ack = await _waitForTrackerPayloadAck(commandId, Number(options?.timeoutMs) || 15000);
    if (ack?.status !== 'ok' || options?.refreshAfter === false) return ack;
    return window.trackerPayloadGet({ maxStations: options?.maxStations, timeoutMs: options?.timeoutMs || 12000 });
};

window.trackerDebugSetVar = async function(nameOrOptions, value = 0, units = 'number', options = {}) {
    const opts = (nameOrOptions && typeof nameOrOptions === 'object')
        ? nameOrOptions
        : { ...(options || {}), name: nameOrOptions, value, units };
    const name = String(opts.name || opts.varName || opts.simVar || '').trim();
    const numericValue = Number(opts.value ?? 0);
    const unitName = String(opts.units || opts.unit || 'number').trim() || 'number';
    if (!name || !Number.isFinite(numericValue)) return { status: 'invalid_input', error: !name ? 'missing_name' : 'invalid_value' };
    const commandId = window.sendTrackerCommand({
        type: 'aircraft_var_set',
        name,
        value: numericValue,
        units: unitName,
        reason: opts.reason || 'pa24-door-debug-var'
    });
    if (!commandId) return { status: 'not_sent' };
    return _waitForTrackerDebugAck(commandId, Number(opts.timeoutMs) || 7000);
};

window.trackerDebugSetInputEvent = async function(nameOrOptions, value = 1, options = {}) {
    const opts = (nameOrOptions && typeof nameOrOptions === 'object')
        ? nameOrOptions
        : { ...(options || {}), names: Array.isArray(nameOrOptions) ? nameOrOptions : [nameOrOptions], value };
    const names = (Array.isArray(opts.names) ? opts.names : [opts.name || opts.eventName || opts.inputEvent])
        .map(v => String(v || '').trim())
        .filter(Boolean);
    const numericValue = Number(opts.value ?? 1);
    if (!names.length || !Number.isFinite(numericValue)) return { status: 'invalid_input', error: !names.length ? 'missing_name' : 'invalid_value' };
    const commandId = window.sendTrackerCommand({
        type: 'aircraft_input_event_set',
        names,
        value: numericValue,
        reason: opts.reason || 'pa24-door-debug-input-event'
    });
    if (!commandId) return { status: 'not_sent' };
    return _waitForTrackerDebugAck(commandId, Number(opts.timeoutMs) || 7000);
};

(function setupPa24DoorDebugTool() {
    const presets = [
        { id: 'handle-door1-0', label: 'Door1Handle = 0', kind: 'var', name: 'L:Door1Handle', value: 0, units: 'Bool' },
        { id: 'handle-door1-1', label: 'Door1Handle = 1', kind: 'var', name: 'L:Door1Handle', value: 1, units: 'Bool' },
        { id: 'handle-handle1-0', label: 'DoorHandle1 = 0', kind: 'var', name: 'L:DoorHandle1', value: 0, units: 'Bool' },
        { id: 'handle-handle1-1', label: 'DoorHandle1 = 1', kind: 'var', name: 'L:DoorHandle1', value: 1, units: 'Bool' },
        { id: 'latch-door1-0', label: 'Door1Latch = 0', kind: 'var', name: 'L:Door1Latch', value: 0, units: 'number' },
        { id: 'latch-door1-1', label: 'Door1Latch = 1', kind: 'var', name: 'L:Door1Latch', value: 1, units: 'number' },
        { id: 'latch-latch1-0', label: 'DoorLatch1 = 0', kind: 'var', name: 'L:DoorLatch1', value: 0, units: 'number' },
        { id: 'latch-latch1-1', label: 'DoorLatch1 = 1', kind: 'var', name: 'L:DoorLatch1', value: 1, units: 'number' },
        { id: 'dooropen-0', label: 'DoorOpen1 = 0', kind: 'var', name: 'L:DoorOpen1', value: 0, units: 'Bool' },
        { id: 'dooropen-1', label: 'DoorOpen1 = 1', kind: 'var', name: 'L:DoorOpen1', value: 1, units: 'Bool' },
        { id: 'dooropen-percent-0', label: 'DoorOpen1 = 0%', kind: 'var', name: 'L:DoorOpen1', value: 0, units: 'percent' },
        { id: 'dooropen-percent-100', label: 'DoorOpen1 = 100%', kind: 'var', name: 'L:DoorOpen1', value: 100, units: 'percent' },
        { id: 'exitopen-0', label: 'Exit1Open = 0', kind: 'var', name: 'L:Exit1Open', value: 0, units: 'Bool' },
        { id: 'exitopen-1', label: 'Exit1Open = 1', kind: 'var', name: 'L:Exit1Open', value: 1, units: 'Bool' },
        { id: 'exitopen-percent-0', label: 'Exit1Open = 0%', kind: 'var', name: 'L:Exit1Open', value: 0, units: 'percent' },
        { id: 'exitopen-percent-100', label: 'Exit1Open = 100%', kind: 'var', name: 'L:Exit1Open', value: 100, units: 'percent' },
        { id: 'input-latch-toggle', label: 'Input latch toggle', kind: 'input', names: ['LEVER_door_latch_2States_Toggle', 'B:LEVER_door_latch_2States_Toggle'], value: 1 }
    ];

    const htmlEscape = (text = '') => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    let lastAck = null;

    const runPreset = async (presetOrId) => {
        const preset = typeof presetOrId === 'string' ? presets.find(item => item.id === presetOrId) : presetOrId;
        if (!preset) return { status: 'invalid_preset' };
        const ack = preset.kind === 'input'
            ? await window.trackerDebugSetInputEvent({ names: preset.names, value: preset.value, reason: `pa24-door-lab-${preset.id}` })
            : await window.trackerDebugSetVar({ name: preset.name, value: preset.value, units: preset.units, reason: `pa24-door-lab-${preset.id}` });
        lastAck = { label: preset.label, ack, at: Date.now() };
        try { console.log('[PA24 Door Lab]', preset.label, ack); } catch (_) {}
        renderPanel();
        return ack;
    };

    const closePanel = () => {
        const el = document.getElementById('pa24DoorDebugPanel');
        if (el) el.remove();
    };

    const renderPanel = () => {
        const panel = document.getElementById('pa24DoorDebugPanel');
        if (!panel) return;
        const status = lastAck
            ? `${lastAck.label}: ${lastAck.ack?.status || 'unknown'}${lastAck.ack?.error ? ` (${lastAck.ack.error})` : ''}`
            : 'No command sent yet.';
        panel.querySelector('[data-pa24-status]').textContent = status;
    };

    const openPanel = () => {
        closePanel();
        const panel = document.createElement('div');
        panel.id = 'pa24DoorDebugPanel';
        panel.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:99999;width:min(390px,calc(100vw - 28px));max-height:min(680px,calc(100vh - 28px));overflow:auto;background:#111;color:#f4f4f4;border:1px solid #555;border-radius:8px;box-shadow:0 14px 38px rgba(0,0,0,.45);font:12px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;padding:10px;';
        panel.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">
                <strong>PA24 Door Lab</strong>
                <button type="button" data-pa24-close style="background:#333;color:#fff;border:1px solid #666;border-radius:6px;padding:4px 8px;cursor:pointer;">Close</button>
            </div>
            <div style="color:#bbb;margin-bottom:8px;">Send one value, observe the aircraft, note what moved.</div>
            <div data-pa24-status style="min-height:18px;margin-bottom:8px;color:#8fe3ff;">No command sent yet.</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                ${presets.map(preset => `<button type="button" data-pa24-preset="${htmlEscape(preset.id)}" style="background:#242424;color:#fff;border:1px solid #555;border-radius:6px;padding:7px;cursor:pointer;text-align:left;">${htmlEscape(preset.label)}</button>`).join('')}
            </div>
            <div style="margin-top:10px;color:#aaa;">
                Console helpers: pa24DoorDebug.setVar('L:Door1Handle', 0, 'Bool') or pa24DoorDebug.inputEvent().
            </div>
        `;
        panel.addEventListener('click', (event) => {
            const close = event.target.closest('[data-pa24-close]');
            if (close) {
                closePanel();
                return;
            }
            const button = event.target.closest('[data-pa24-preset]');
            if (!button) return;
            button.disabled = true;
            const oldText = button.textContent;
            button.textContent = `${oldText} ...`;
            runPreset(button.getAttribute('data-pa24-preset')).finally(() => {
                button.disabled = false;
                button.textContent = oldText;
            });
        });
        document.body.appendChild(panel);
    };

    window.pa24DoorDebug = {
        presets,
        run: runPreset,
        open: openPanel,
        close: closePanel,
        setVar(name, value = 0, units = 'number') {
            return window.trackerDebugSetVar({ name, value, units, reason: 'pa24-door-lab-console' });
        },
        inputEvent(value = 1) {
            return window.trackerDebugSetInputEvent({
                names: ['LEVER_door_latch_2States_Toggle', 'B:LEVER_door_latch_2States_Toggle'],
                value,
                reason: 'pa24-door-lab-console-input'
            });
        }
    };
})();

window.missionSceneBoarding = async function(reason = 'boarding') {
    if (missionSceneBoardingPromise) {
        _missionPhaseDebugPush('boarding_reused', { reason, source: 'missionSceneBoardingPromise' });
        return missionSceneBoardingPromise;
    }
    if (window.missionSceneStatus?.boardingPreparing || window.missionSceneStatus?.boardingRequested || window.missionSceneStatus?.boardingActive) {
        _missionPhaseDebugPush('boarding_blocked', {
            reason,
            source: 'scene_busy',
            preparing: !!window.missionSceneStatus?.boardingPreparing,
            requested: !!window.missionSceneStatus?.boardingRequested,
            active: !!window.missionSceneStatus?.boardingActive
        });
        return { status: 'busy' };
    }
    missionSceneBoardingPromise = (async () => {
        const status = window.missionSceneStatus || {};
        status.boardingPreparing = true;
        status.boardingError = null;
        status.boardingCueCommandId = '';
        _updateMissionRuntimeUi();
        if (!status.spawned && !status.spawnRequested && typeof window.missionSceneSpawn === 'function') {
            window.missionSceneSpawn('boarding-ensure-scene');
        }
        await _waitForMissionSceneReady(22000);
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
        _missionPhaseDebugPush('boarding_command', {
            commandId,
            sceneId,
            reason,
            boarderCount: command.boarderCount,
            passengerCount: command.passengerCount,
            path: Array.isArray(command.path) ? command.path : [],
            aircraftSlot: command.aircraftSlot || null,
            aircraftName: command.aircraftName || null,
            openDoor: !!command.openDoor
        });
        window.missionSceneStatus.sceneId = sceneId;
        window.missionSceneStatus.lastCommandAt = Date.now();
        window.missionSceneStatus.lastCommand = { type: 'mission_scene_boarding', commandId, reason };
        window.missionSceneStatus.boardingPreparing = false;
        window.missionSceneStatus.boardingRequested = true;
        window.missionSceneStatus.boardingActive = true;
        window.missionSceneStatus.boardingComplete = false;
        window.missionSceneStatus.boardingError = null;
        if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
        return _waitForMissionSceneBoardingAck(commandId, 65000);
    })();
    try {
        const ack = await missionSceneBoardingPromise;
        _missionPhaseDebugPush('boarding_result', {
            commandId: ack?.commandId || window.missionSceneStatus?.lastCommand?.commandId || null,
            status: ack?.status || 'missing',
            error: ack?.error || null,
            boarded: Number(ack?.boarded || 0),
            removed: Number(ack?.removed || 0),
            routeSent: Number(ack?.routeSent || 0)
        });
        return ack;
    } finally {
        if (window.missionSceneStatus) window.missionSceneStatus.boardingPreparing = false;
        missionSceneBoardingPromise = null;
    }
};

function _missionSceneBoardingCueId() {
    let cueId = 'boarding_pax';
    if (typeof window.paxResolveMissionAudioCue === 'function') {
        try { cueId = window.paxResolveMissionAudioCue('cargo', 'passenger_load', 'boarding_pax') || cueId; } catch (_) {}
    }
    return cueId;
}

function _missionScenePrepareBoardingCue() {
    const cueId = _missionSceneBoardingCueId();
    if (!cueId || cueId === 'none' || typeof window.paxPrepareAudioCue !== 'function') return false;
    try {
        const prepared = window.paxPrepareAudioCue(cueId);
        if (prepared && typeof prepared.catch === 'function') prepared.catch(() => {});
        return true;
    } catch (_) {
        return false;
    }
}

function _missionSceneDeboardingCueId() {
    let cueId = 'deboarding_pax';
    if (typeof window.paxResolveMissionAudioCue === 'function') {
        try { cueId = window.paxResolveMissionAudioCue('cargo', 'passenger_unload', 'deboarding_pax') || cueId; } catch (_) {}
    }
    return cueId;
}

function _missionScenePrepareDeboardingCue() {
    const cueId = _missionSceneDeboardingCueId();
    if (!cueId || cueId === 'none' || typeof window.paxPrepareAudioCue !== 'function') return false;
    try {
        const prepared = window.paxPrepareAudioCue(cueId);
        if (prepared && typeof prepared.catch === 'function') prepared.catch(() => {});
        return true;
    } catch (_) {
        return false;
    }
}

async function _missionSceneAwaitCuePlayback(playback = null, timeoutMs = 15000) {
    if (!playback?.promise) return false;
    let timer = null;
    try {
        return !!(await Promise.race([
            playback.promise,
            new Promise(resolve => { timer = setTimeout(() => resolve(false), Math.max(1000, Number(timeoutMs) || 15000)); })
        ]));
    } catch (_) {
        return false;
    } finally {
        if (timer) clearTimeout(timer);
    }
}

function _missionScenePlayBoardingCue(commandId = '', reason = 'boarding-passenger-seated') {
    if (typeof window.paxPlayAudioCue !== 'function') return false;
    const id = String(commandId || window.missionSceneStatus?.lastCommand?.commandId || 'boarding');
    if (window.missionSceneStatus?.boardingCueCommandId === id) return false;
    if (typeof _missionScenePaxCount === 'function' && _missionScenePaxCount() <= 0) return false;
    const cueId = _missionSceneBoardingCueId();
    if (!cueId || cueId === 'none') return false;
    window.missionSceneStatus.boardingCueCommandId = id;
    try {
        const played = window.paxPlayAudioCue(cueId, {
            seed: `mission-boarding|${window.missionSceneStatus?.sceneId || _missionSceneId()}|${id}|${reason}`,
            gain: 0.38,
            variantScope: 'event'
        });
        const promise = Promise.resolve(played).then(Boolean).catch(() => false);
        missionSceneBoardingCuePlayback = { commandId: id, promise };
        return true;
    } catch (_) {
        return false;
    }
}

function _missionScenePlayDeboardingCue(reason = 'mission-end', commandId = '') {
    if (typeof window.paxPlayAudioCue !== 'function') return;
    const hasPassenger = !!(
        window.activePassenger
        || window.missionSceneStatus?.personBoarded
        || (typeof _missionCargoLoadedPassengerItems === 'function' && _missionCargoLoadedPassengerItems().length)
    );
    if (!hasPassenger) return;
    const id = String(commandId || window.missionSceneStatus?.deboardingCommandId || 'deboarding');
    if (window.missionSceneStatus?.deboardingCueCommandId === id) return;
    const cueId = _missionSceneDeboardingCueId();
    if (!cueId || cueId === 'none') return;
    window.missionSceneStatus.deboardingCueCommandId = id;
    try {
        const played = window.paxPlayAudioCue(cueId, {
            seed: `mission-deboarding|${window.missionSceneStatus?.sceneId || _missionSceneId()}|${reason}`,
            gain: 0.38,
            variantScope: 'event'
        });
        const promise = Promise.resolve(played).then(Boolean).catch(() => false);
        missionSceneDeboardingCuePlayback = { commandId: id, promise };
    } catch (_) {}
}

function _missionSceneClearDeboardingWatchdog() {
    if (missionSceneDeboardingWatchdogTimer) clearTimeout(missionSceneDeboardingWatchdogTimer);
    missionSceneDeboardingWatchdogTimer = null;
}

function _missionSceneArmDeboardingWatchdog(commandId, reason = 'mission-end') {
    _missionSceneClearDeboardingWatchdog();
    missionSceneDeboardingWatchdogTimer = setTimeout(() => {
        if (String(window.missionSceneStatus?.deboardingCommandId || '') !== String(commandId || '')) return;
        window.missionSceneStatus.deboardingRequested = false;
        window.missionSceneStatus.deboardingActive = false;
        window.missionSceneStatus.deboardingComplete = false;
        window.missionSceneStatus.deboardingError = 'deboarding_timeout';
        if (typeof window.missionRuntimeHandleDeboardingTimeout === 'function') {
            window.missionRuntimeHandleDeboardingTimeout(`${reason}-watchdog`);
        }
        _updateMissionRuntimeUi();
    }, 300000);
}

function _missionSceneDeboardingPaxCount() {
    const manifest = typeof _missionCargoGetManifest === 'function' ? _missionCargoGetManifest() : null;
    if (Array.isArray(manifest?.items) && manifest.items.length > 0) {
        const passengerItems = manifest.items.filter(item => _missionCargoIsPassengerItem(item));
        if (!passengerItems.length) return 0;
        return Math.max(0, Math.min(3, passengerItems
            .filter(item => (
                item.status === 'loaded'
                && item.handoffComplete !== true
                && !(Number(item.handedOffAt || 0) > 0)
            ))
            .reduce((sum, item) => sum + Math.max(1, Number(item.passengerCount) || 1), 0)));
    }
    if (!window.missionSceneStatus?.personBoarded) return 0;
    return Math.max(1, Math.min(3, typeof _missionScenePaxCount === 'function' ? _missionScenePaxCount() : 1));
}

window.missionSceneDeboarding = function(reason = 'mission-end', options = {}) {
    if (window.simModeActive && !window.liveTrackerConnected) return false;
    const trackerVersionCode = Number(window.liveTrackerVersionCode);
    if (options?.coordinateFarewell === true && (!Number.isFinite(trackerVersionCode) || trackerVersionCode < MIN_TRACKER_VERSION_CODE)) {
        window.missionSceneStatus.deboardingError = `tracker_${MIN_TRACKER_VERSION_LABEL}_required`;
        _missionPhaseDebugPush('deboarding_blocked', {
            reason: 'tracker_version',
            required: MIN_TRACKER_VERSION_LABEL,
            received: Number.isFinite(trackerVersionCode) ? trackerVersionCode : null
        });
        return false;
    }
    if (window.missionSceneStatus?.deboardingRequested || window.missionSceneStatus?.deboardingActive) {
        _missionPhaseDebugPush('deboarding_blocked', { reason: 'already_active' });
        return false;
    }
    const deboardingPaxCount = _missionSceneDeboardingPaxCount();
    if (deboardingPaxCount <= 0) {
        _missionPhaseDebugPush('deboarding_blocked', { reason: 'no_loaded_passenger' });
        return false;
    }
    const allowBushHomeHandoff = reason === 'bush-home-unload' && _missionBushIsPickupPassengerMission();
    const allowMissionEndDeboarding = /(farewell|mission-end|manual-end|flight-finalize|touchdown)/i.test(String(reason || ''));
    if (_missionCargoPassengerAlreadyUnloaded() && !allowBushHomeHandoff && !allowMissionEndDeboarding) return false;
    const pos = window.lastLiveGpsPos || {};
    if (!Number.isFinite(Number(pos.lat)) || !Number.isFinite(Number(pos.lon))) {
        _missionPhaseDebugPush('deboarding_blocked', { reason: 'no_live_position' });
        return false;
    }
    const sceneId = window.missionSceneStatus?.sceneId || _missionSceneId();
    const aptSpawnedByKind = window.missionAptArrivalSceneStatus?.spawnedByKind;
    const aptVehicleConfirmed = !aptSpawnedByKind || typeof aptSpawnedByKind !== 'object'
        || Object.entries(aptSpawnedByKind).some(([kind, count]) => Number(count || 0) > 0 && /vehicle|fahrzeug|van|shuttle/i.test(String(kind || '')));
    const aptArrivalSceneReady = !!(
        window.missionAptArrivalSceneStatus?.spawned
        && !window.missionAptArrivalSceneStatus?.error
        && aptVehicleConfirmed
    );
    const aptPickupPoint = aptArrivalSceneReady && _isAtAptArrivalPoint(Number(pos.lat), Number(pos.lon), 0.12)
        ? _missionAptArrivalPickupPoint()
        : null;
    // Passenger handoff always gets a vehicle. At an APT arrival scene the already
    // staged vehicle is reused; otherwise the deboarding command brings its own.
    const vehicleSupportEnabled = !aptPickupPoint;
    const vehicleAsset = _missionSceneVehicleAsset();
    const vehicleTitle = vehicleAsset?.title || MISSION_SCENE_DEFAULT_VEHICLE_TITLE;
    const commonFields = _missionSceneCommonSceneCommandFields();
    if (aptPickupPoint) {
        commonFields.vehicleDeparture = false;
        commonFields.vehicleArrival = false;
        commonFields.vehicleReturn = false;
    } else {
        commonFields.vehicleDeparture = true;
        commonFields.vehicleArrival = true;
        commonFields.vehicleReturn = true;
        commonFields.vehiclePoint = _missionSceneVehiclePoint();
        commonFields.vehicleDeparturePath = _missionSceneVehicleDeparturePath();
        commonFields.vehicleReturnPath = _missionSceneVehicleDeparturePath().slice().reverse();
        commonFields.vehicleSpeedKts = 7;
    }
    const primaryGender = _missionScenePassengerGender();
    const personTitle = _missionSceneMovingPersonTitle(primaryGender, 'deboarding');
    const command = {
        type: 'mission_scene_deboarding',
        sceneId,
        reason,
        lat: Number(pos.lat),
        lon: Number(pos.lon),
        altFt: Number.isFinite(Number(pos.alt)) ? Number(pos.alt) : 0,
        hdg: Number.isFinite(Number(pos.hdg)) ? Number(pos.hdg) : 0,
        ...commonFields,
        coordinateFarewell: options?.coordinateFarewell === true,
        boarderCount: deboardingPaxCount,
        passengerCount: deboardingPaxCount,
        personTitle,
        personTitleCandidates: _missionSceneMovingPersonCandidates(primaryGender, personTitle)
    };
    if (vehicleAsset) {
        command.vehicleTitle = vehicleTitle;
        command.vehicleTitleCandidates = _sceneAssetCandidates(vehicleTitle, vehicleAsset.candidates || []);
    }
    if (aptPickupPoint) {
        command.deboardingPickupPoint = aptPickupPoint;
        command.deboardingPickupLabel = aptPickupPoint.label;
        command.deboardingPickupSceneId = _missionAptArrivalSceneId();
    }
    const commandId = window.sendTrackerCommand(command);
    if (!commandId) {
        _missionPhaseDebugPush('deboarding_blocked', { reason: 'command_not_sent' });
        return false;
    }
    window.missionSceneStatus.sceneId = sceneId;
    window.missionSceneStatus.lastCommandAt = Date.now();
    window.missionSceneStatus.lastCommand = { type: 'mission_scene_deboarding', commandId, reason };
    window.missionSceneStatus.deboardingRequested = true;
    window.missionSceneStatus.deboardingActive = true;
    window.missionSceneStatus.deboardingComplete = false;
    window.missionSceneStatus.deboardingError = null;
    window.missionSceneStatus.deboardingCommandId = String(commandId);
    window.missionSceneStatus.deboardingCueCommandId = '';
    _missionPhaseDebugPush('deboarding_command', {
        commandId: String(commandId),
        sceneId,
        reason,
        passengerCount: deboardingPaxCount,
        coordinateFarewell: options?.coordinateFarewell === true,
        usesStagedArrivalVehicle: !!aptPickupPoint
    });
    _missionSceneArmDeboardingWatchdog(commandId, reason);
    if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
    return commandId;
};

window.missionSceneContinueDeboarding = function(deboardingCommandId = '', reason = 'farewell-complete') {
    const targetCommandId = String(deboardingCommandId || window.missionSceneStatus?.deboardingCommandId || '');
    if (!targetCommandId || typeof window.sendTrackerCommand !== 'function') return false;
    return window.sendTrackerCommand({
        type: 'mission_scene_deboarding_continue',
        sceneId: window.missionSceneStatus?.sceneId || _missionSceneId(),
        deboardingCommandId: targetCommandId,
        reason
    }) || false;
};

window.missionSceneCancelDeboarding = function(reason = 'deboarding-cancel') {
    const targetCommandId = String(window.missionSceneStatus?.deboardingCommandId || '');
    if (!targetCommandId || typeof window.sendTrackerCommand !== 'function') return false;
    return window.sendTrackerCommand({
        type: 'mission_scene_deboarding_cancel',
        sceneId: window.missionSceneStatus?.sceneId || _missionSceneId(),
        deboardingCommandId: targetCommandId,
        reason
    }) || false;
};

function _missionSceneCancelInterruptedDeboarding(reason = 'mission-resume') {
    const recovery = missionInterruptedDeboardingRecovery;
    if (!recovery || typeof window.sendTrackerCommand !== 'function' || !window.liveTrackerConnected) return false;
    const commandId = window.sendTrackerCommand({
        type: 'mission_scene_deboarding_cancel',
        sceneId: recovery.sceneId || _missionSceneId(),
        deboardingCommandId: recovery.commandId || '',
        reason: `${reason}-cancel-interrupted-deboarding`
    });
    if (!commandId) return false;
    missionInterruptedDeboardingRecovery = null;
    return true;
}

window.missionComplianceDebugGroundVisitStatus = function() {
    if (window.simModeActive) {
        return { ready: false, reason: 'sim_mode', label: 'Live-Tracker erforderlich' };
    }
    if (!window.liveTrackerConnected || typeof window.sendTrackerCommand !== 'function') {
        return { ready: false, reason: 'tracker_offline', label: 'Tracker offline' };
    }
    const trackerVersionCode = Number(window.liveTrackerVersionCode);
    if (!Number.isFinite(trackerVersionCode) || trackerVersionCode < 316) {
        return { ready: false, reason: 'tracker_version', label: 'Tracker v316 oder neuer erforderlich' };
    }
    const pos = window.lastLiveGpsPos || {};
    if (!Number.isFinite(Number(pos.lat)) || !Number.isFinite(Number(pos.lon))) {
        return { ready: false, reason: 'no_position', label: 'Keine gueltige Sim-Position' };
    }
    const ground = _missionStartGroundStatus();
    if (!ground?.ready) {
        return {
            ...ground,
            ready: false,
            label: String(ground?.label || 'Flugzeug nicht am Boden im Stillstand')
        };
    }
    return {
        ...ground,
        ready: true,
        reason: 'ready',
        label: 'Am Boden bereit'
    };
};

window.missionComplianceStartGroundVisit = function(state = null, reason = 'authority-inspection') {
    if (window.simModeActive || !window.liveTrackerConnected || typeof window.sendTrackerCommand !== 'function') return false;
    const trackerVersionCode = Number(window.liveTrackerVersionCode);
    if (!Number.isFinite(trackerVersionCode) || trackerVersionCode < 316) return false;
    const pos = window.lastLiveGpsPos || {};
    if (!Number.isFinite(Number(pos.lat)) || !Number.isFinite(Number(pos.lon))) return false;

    const boarding = _missionSceneBoardingConfig();
    const boardingPoint = {
        ...(boarding.target || { forwardM: 4.5, rightM: 8.5, altOffsetFt: 0 })
    };
    const cargo = boarding.cargo || { forwardM: 4, rightM: 4, altOffsetFt: 0 };
    const cargoStop = {
        forwardM: Number(cargo.forwardM || 4) + 0.9,
        rightM: Number(cargo.rightM || 4) + 0.45,
        altOffsetFt: Number(cargo.altOffsetFt || 0)
    };
    const vehiclePoint = { forwardM: 22, rightM: 12, altOffsetFt: 0 };
    const vehicleArrivalPath = [
        { forwardM: -24, rightM: 18, altOffsetFt: 0 },
        { forwardM: -6, rightM: 18, altOffsetFt: 0 },
        { forwardM: 10, rightM: 16, altOffsetFt: 0 },
        vehiclePoint
    ];
    const maleTitle = _missionSceneMovingPersonTitle('male', 'authority-inspector-one');
    const femaleTitle = _missionSceneMovingPersonTitle('female', 'authority-inspector-two');
    const visitorPaths = [
        {
            id: 'inspector-boarding',
            label: 'Luftaufsicht 1',
            objectTitle: maleTitle,
            titleCandidates: _missionSceneMovingPersonCandidates('male', maleTitle),
            path: [
                { forwardM: 21.5, rightM: 11.2, altOffsetFt: 0 },
                { forwardM: 13, rightM: 11, altOffsetFt: 0 },
                boardingPoint
            ]
        },
        {
            id: 'inspector-cargo',
            label: 'Luftaufsicht 2',
            objectTitle: femaleTitle,
            titleCandidates: _missionSceneMovingPersonCandidates('female', femaleTitle),
            path: [
                { forwardM: 22.4, rightM: 13.1, altOffsetFt: 0 },
                { forwardM: 13.5, rightM: 8.5, altOffsetFt: 0 },
                cargoStop
            ]
        }
    ];
    const sceneId = `scene-${_activeMissionRuntimeId('active') || Date.now()}-authority-inspection`;
    const command = {
        type: 'mission_scene_ground_visit',
        sceneId,
        reason,
        lat: Number(pos.lat),
        lon: Number(pos.lon),
        altFt: Number.isFinite(Number(pos.alt)) ? Number(pos.alt) : 0,
        hdg: Number.isFinite(Number(pos.hdg)) ? Number(pos.hdg) : 0,
        visitKind: 'authority_inspection',
        vehicleTitle: 'Microsoft_Car_EUR_04',
        vehicleTitleCandidates: _sceneAssetCandidates('Microsoft_Car_EUR_04', [
            'Microsoft_Car_EUR_01',
            'Microsoft_Car_EUR_02',
            'Microsoft_Car_EUR_03'
        ]),
        vehiclePoint,
        vehicleArrivalPath,
        vehicleDeparturePath: vehicleArrivalPath.slice().reverse(),
        vehicleSpeedKts: 7,
        visitorPaths,
        walkSpeedKts: 3.1,
        releaseTimeoutMs: 30 * 60 * 1000
    };
    const commandId = window.sendTrackerCommand(command);
    if (!commandId) return false;
    return { commandId, sceneId };
};

window.missionComplianceReleaseGroundVisit = function(state = null) {
    const visitCommandId = String(state?.commandId || '');
    if (!visitCommandId || !window.liveTrackerConnected || typeof window.sendTrackerCommand !== 'function') return false;
    return window.sendTrackerCommand({
        type: 'mission_scene_ground_visit_release',
        sceneId: String(state?.sceneId || ''),
        visitCommandId,
        reason: 'authority-inspection-complete'
    }) || false;
};

function _handleTrackerAck(ack) {
    if (!ack || typeof ack !== 'object') return;
    const ackType = String(ack.type || '').toLowerCase();
    const ackCommandId = String(ack.commandId || '').trim();
    const authorityScopedAck = /^(mission_(authority|snapshot|scene|smoke)_|mission_lifecycle_ack)/i.test(ackType);
    if (_trackerSupportsMissionAuthority()
        && authorityScopedAck
        && ackCommandId
        && !_missionAuthorityAckWasSentLocally(ack)) {
        const now = Date.now();
        const signature = `${ackType}|${ackCommandId}|${ack.status || ''}|${ack.error || ''}`;
        if (signature !== missionAuthorityForeignAckLastSig || now - missionAuthorityForeignAckLastLogAt > 30000) {
            missionAuthorityForeignAckLastSig = signature;
            missionAuthorityForeignAckLastLogAt = now;
            _missionPhaseDebugPush('foreign_tracker_ack_ignored', {
                type: ack.type || '',
                commandId: ackCommandId,
                missionId: ack.missionId || null,
                status: ack.status || '',
                error: ack.error || ''
            });
        }
        return;
    }
    _trackerPendingHandleAck(ack);
    const authorityAck = /^mission_(authority|snapshot)_.*_ack$/i.test(String(ack.type || ''));
    if (authorityAck) {
        _resolveMissionAuthorityAck(ack);
        const run = ack.authoritativeRun && typeof ack.authoritativeRun === 'object' ? ack.authoritativeRun : null;
        const local = _readMissionAuthorityState();
        if (run?.missionId && run?.runId && run.ownerClientId === _missionAuthorityClientId()
            && (!local || local.runId === run.runId || ack.type === 'mission_authority_takeover_ack' || ack.type === 'mission_authority_acquire_ack')) {
            _writeMissionAuthorityState({ ...run, clientId: _missionAuthorityClientId() });
        }
        if (ack.type === 'mission_authority_release_ack' && TRACKER_ACK_SUCCESS.has(String(ack.status || '').toLowerCase())) {
            _clearMissionAuthorityState(`tracker-ack:${ack.outcome || 'released'}`);
        }
        if (String(ack.status || '').toLowerCase() === 'conflict') {
            window.missionRuntimeResumeConflict = {
                reason: ack.error || 'mission-authority-conflict',
                trackerMissionId: run?.missionId || null,
                trackerRunId: run?.runId || null,
                ownerClientId: run?.ownerClientId || null,
                activeMissionId: _activeMissionRuntimeId('') || null,
                trackerActive: !!run,
                at: Date.now()
            };
            _updateMissionRuntimeUi();
        }
        _missionPhaseDebugPush('authority_ack', {
            type: ack.type,
            status: ack.status || '',
            error: ack.error || '',
            missionId: run?.missionId || ack.missionId || null,
            runId: run?.runId || ack.runId || null,
            revision: run?.revision || null
        });
        return;
    }
    if (String(ack.type || '').startsWith('homebase_v1.')) {
        try {
            window.dispatchEvent(new CustomEvent('homebasetrackerack', { detail: { ack } }));
        } catch (_) {}
        return;
    }
    if ((/^mission_(scene|smoke)_/i.test(String(ack.type || '')) || String(ack.type || '') === 'mission_lifecycle_ack') && !_trackerAckMatchesActiveMission(ack)) {
        _missionSceneDebugPatch({ lastIgnoredAck: ack }, `tracker-ack-ignored:${ack.type}`);
        return;
    }
    if (ack.type === 'mission_scene_clear_ack' && String(ack.reason || '').toLowerCase() === 'replace-before-scene') {
        _missionSceneDebugPatch({ lastIgnoredAck: ack }, `tracker-ack-ignored:${ack.type}:replace-before-scene`);
        return;
    }
    window.missionSmokeStatus.lastAckAt = Date.now();
    window.missionSmokeStatus.lastAck = ack;
    if (ack.type === 'aircraft_var_set_ack' || ack.type === 'aircraft_input_event_set_ack') {
        window.trackerDebugStatus = window.trackerDebugStatus && typeof window.trackerDebugStatus === 'object' ? window.trackerDebugStatus : {};
        window.trackerDebugStatus.lastAckAt = Date.now();
        window.trackerDebugStatus.lastAck = ack;
        _resolveTrackerDebugAck(ack);
        try {
            window.dispatchEvent(new CustomEvent('trackerdebugack', { detail: { ack } }));
        } catch (_) {}
        return;
    }
    if (ack.type === 'aircraft_payload_get_ack' || ack.type === 'aircraft_payload_set_ack') {
        window.aircraftPayloadStatus.lastAckAt = Date.now();
        window.aircraftPayloadStatus.lastAck = ack;
        if (ack.status === 'ok') {
            window.aircraftPayloadStatus.snapshot = {
                payloadAdapter: String(ack.payloadAdapter || 'msfs_payload_stations'),
                aircraft: ack.aircraft && typeof ack.aircraft === 'object' ? { ...ack.aircraft } : null,
                pa24: ack.pa24 && typeof ack.pa24 === 'object' ? JSON.parse(JSON.stringify(ack.pa24)) : null,
                totalWeightLbs: Number.isFinite(Number(ack.totalWeightLbs)) ? Number(ack.totalWeightLbs) : null,
                emptyWeightLbs: Number.isFinite(Number(ack.emptyWeightLbs)) ? Number(ack.emptyWeightLbs) : null,
                fuelWeightLbs: Number.isFinite(Number(ack.fuelWeightLbs)) ? Number(ack.fuelWeightLbs) : null,
                payloadWeightLbs: Number.isFinite(Number(ack.payloadWeightLbs)) ? Number(ack.payloadWeightLbs) : null,
                stationPayloadWeightLbs: Number.isFinite(Number(ack.stationPayloadWeightLbs)) ? Number(ack.stationPayloadWeightLbs) : null,
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
    const missionAckType = String(ack.type || '');
    if (/^mission_scene_(?:spawn|clear|boarding|deboarding|manual_pax|ground_visit)/i.test(missionAckType)) {
        _missionPhaseDebugPush('scene_ack', {
            type: missionAckType,
            commandId: ack.commandId || null,
            sceneId: ack.sceneId || null,
            missionId: ack.missionId || null,
            status: ack.status || null,
            stage: ack.stage || null,
            reason: ack.reason || null,
            error: ack.error || null,
            spawned: Number.isFinite(Number(ack.spawned)) ? Number(ack.spawned) : null,
            cleared: Number.isFinite(Number(ack.cleared)) ? Number(ack.cleared) : null,
            boarded: Number.isFinite(Number(ack.boarded)) ? Number(ack.boarded) : null,
            deboarded: Number.isFinite(Number(ack.deboarded)) ? Number(ack.deboarded) : null,
            removed: Number.isFinite(Number(ack.removed)) ? Number(ack.removed) : null,
            action: ack.action || null,
            startPhase: _missionStartPhase(),
            runtimePhase: _missionRuntimePhaseSnapshot(),
            personBoardedBeforeAck: !!window.missionSceneStatus?.personBoarded
        });
    }
    if (/^mission_(scene|smoke)_/i.test(missionAckType)) {
        _missionSceneDebugPatch({ lastAck: ack }, `tracker-ack:${ack.type}`);
    }
    if (/^mission_scene_ground_visit_(?:stage|ack)$/i.test(missionAckType)) {
        window.missionComplianceHandleGroundVisitAck?.(ack);
        _updateMissionRuntimeUi();
        return;
    }
    if (ack.type === 'mission_scene_boarding_stage') {
        if (missionSceneIgnoredBoardingCommandIds.has(String(ack.commandId || ''))) return;
        window.missionSceneStatus.lastAckAt = Date.now();
        window.missionSceneStatus.lastAck = ack;
        if (String(ack.stage || '').toLowerCase() === 'passenger_boarded') {
            _missionScenePlayBoardingCue(ack.commandId, ack.stage);
        }
        return;
    }
    if (ack.type === 'mission_scene_deboarding_stage') {
        window.missionSceneStatus.lastAckAt = Date.now();
        window.missionSceneStatus.lastAck = ack;
        const stage = String(ack.stage || '').toLowerCase();
        if (stage === 'cue') _missionScenePlayDeboardingCue(ack.reason || 'mission-end', ack.commandId);
        const handleStage = () => {
            if (typeof window.missionRuntimeHandleDeboardingStage === 'function') {
                window.missionRuntimeHandleDeboardingStage(ack);
            }
            _updateMissionRuntimeUi();
        };
        if (stage === 'door_open'
            && missionSceneDeboardingCuePlayback?.promise
            && String(missionSceneDeboardingCuePlayback.commandId || '') === String(ack.commandId || '')) {
            _missionSceneAwaitCuePlayback(missionSceneDeboardingCuePlayback).then(handleStage);
        } else {
            handleStage();
        }
        return;
    }
    if (ack.type === 'mission_scene_deboarding_continue_ack' || ack.type === 'mission_scene_deboarding_cancel_ack') {
        return;
    }
    if (ack.type === 'mission_scene_deboarding_ack') {
        const expectedCommandId = String(window.missionSceneStatus?.deboardingCommandId || '');
        const receivedCommandId = String(ack.commandId || '');
        if (expectedCommandId && receivedCommandId && receivedCommandId !== expectedCommandId) {
            _missionSceneDebugPatch({ lastIgnoredAck: ack }, 'tracker-ack-ignored:mission_scene_deboarding_ack:stale-command');
            return;
        }
        if (!expectedCommandId && !window.missionSceneStatus?.deboardingRequested && !window.missionSceneStatus?.deboardingActive) {
            _missionSceneDebugPatch({ lastIgnoredAck: ack }, 'tracker-ack-ignored:mission_scene_deboarding_ack:not-active');
            return;
        }
        _missionSceneClearDeboardingWatchdog();
        window.missionSceneStatus.lastAckAt = Date.now();
        window.missionSceneStatus.lastAck = ack;
        window.missionSceneStatus.deboardingRequested = false;
        window.missionSceneStatus.deboardingActive = false;
        window.missionSceneStatus.deboardingComplete = ack.status === 'ok';
        window.missionSceneStatus.deboardingError = ack.status === 'ok' ? null : (ack.error || ack.status || 'scene_deboarding_failed');
        if (ack.status === 'ok') window.missionSceneStatus.personBoarded = false;
        if (typeof window.missionRuntimeHandleDeboardingAck === 'function') {
            window.missionRuntimeHandleDeboardingAck(ack);
        }
        window.missionSceneStatus.deboardingCommandId = '';
        missionSceneDeboardingCuePlayback = null;
        if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
        _updateMissionRuntimeUi();
        return;
    }
    if (ack.type === 'mission_scene_boarding_ack' && missionSceneIgnoredBoardingCommandIds.has(String(ack.commandId || ''))) {
        missionSceneIgnoredBoardingCommandIds.delete(String(ack.commandId || ''));
        _resolveMissionSceneBoardingAck(ack);
        return;
    }
    if (ack.type === 'mission_scene_spawn_ack' || ack.type === 'mission_scene_clear_ack' || ack.type === 'mission_scene_boarding_ack' || ack.type === 'mission_scene_object_remove_ack' || ack.type === 'mission_scene_object_spawn_ack' || ack.type === 'mission_scene_manual_pax_ack') {
        if (ack.type === 'mission_scene_object_remove_ack' || ack.type === 'mission_scene_object_spawn_ack' || ack.type === 'mission_scene_manual_pax_ack') {
            window.missionCargoStatus.lastAckAt = Date.now();
            window.missionCargoStatus.lastAck = ack;
            window.missionCargoStatus.error = ack.status === 'ok' || ack.status === 'noop' ? null : (ack.error || ack.status || 'cargo_scene_command_failed');
            if (ack.type === 'mission_scene_object_remove_ack' || ack.type === 'mission_scene_object_spawn_ack') {
                window.missionCargoResolveVisibleItemAck?.(ack);
            }
            if (ack.type === 'mission_scene_manual_pax_ack' && window.missionSceneStatus && typeof window.missionSceneStatus === 'object') {
                const resolvedPending = !!window.missionCargoResolveManualPassengerAck?.(ack);
                if (resolvedPending) {
                    if (typeof window.fireMissionRefreshDebugStatus === 'function') window.fireMissionRefreshDebugStatus();
                    return;
                }
                const expectedCommandId = String(window.missionCargoStatus?.lastCommand?.type === 'mission_scene_manual_pax'
                    ? window.missionCargoStatus.lastCommand.commandId || ''
                    : '');
                if (!window.missionSceneStatus.manualPaxActive
                    || (expectedCommandId && String(ack.commandId || '') !== expectedCommandId)) {
                    return;
                }
                window.missionSceneStatus.manualPaxRequested = false;
                window.missionSceneStatus.manualPaxActive = false;
                window.missionSceneStatus.manualPaxError = ack.status === 'ok' || ack.status === 'noop' ? null : (ack.error || ack.status || 'manual_pax_failed');
                if (ack.status === 'ok' || ack.status === 'noop') {
                    window.missionSceneStatus.personBoarded = String(ack.action || '').toLowerCase() === 'load';
                }
            }
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
                window.missionTargetSceneStatus.lastSpawnFailedAt = ack.status === 'ok' ? 0 : Date.now();
            } else if (ack.type === 'mission_scene_clear_ack') {
                window.missionTargetSceneStatus.spawnRequested = false;
                window.missionTargetSceneStatus.clearRequested = false;
                window.missionTargetSceneStatus.spawned = false;
                window.missionTargetSceneStatus.spawnedCount = 0;
                window.missionTargetSceneStatus.spawnedByKind = null;
                window.missionTargetSceneStatus.cleared = ack.status === 'ok' || ack.status === 'noop';
                window.missionTargetSceneStatus.clearedCount = Number(ack.cleared || 0);
                window.missionTargetSceneStatus.lastSpawnFailedAt = 0;
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
                window.missionAptArrivalSceneStatus.lastSpawnFailedAt = ack.status === 'ok' ? 0 : Date.now();
            } else if (ack.type === 'mission_scene_clear_ack') {
                window.missionAptArrivalSceneStatus.spawnRequested = false;
                window.missionAptArrivalSceneStatus.clearRequested = false;
                window.missionAptArrivalSceneStatus.spawned = false;
                window.missionAptArrivalSceneStatus.spawnedCount = 0;
                window.missionAptArrivalSceneStatus.spawnedByKind = null;
                window.missionAptArrivalSceneStatus.cleared = ack.status === 'ok' || ack.status === 'noop';
                window.missionAptArrivalSceneStatus.clearedCount = Number(ack.cleared || 0);
                window.missionAptArrivalSceneStatus.lastSpawnFailedAt = 0;
                window.missionAptArrivalSceneStatus.error = null;
            } else if (ack.type === 'mission_scene_boarding_ack') {
                window.missionSceneStatus.boardingPreparing = false;
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
            window.missionSceneStatus.lastSpawnFailedAt = ack.status === 'ok' ? 0 : Date.now();
            window.missionSceneStatus.boardingComplete = false;
            window.missionSceneStatus.personBoarded = false;
            if (ack.status === 'ok') {
                _missionCargoRemoveLoadedSceneObjects('cargo-loaded-after-scene-spawn');
                _missionCargoEnsurePendingSceneObjects(ack.objects, 'cargo-pending-after-scene-spawn');
                _missionCargoSpawnUnloadedSceneObjects('cargo-unloaded-after-scene-spawn');
            }
        } else if (ack.type === 'mission_scene_clear_ack') {
            window.missionSceneStatus.spawnRequested = false;
            window.missionSceneStatus.clearRequested = false;
            window.missionSceneStatus.spawned = false;
            window.missionSceneStatus.spawnedCount = 0;
            window.missionSceneStatus.spawnedByKind = null;
            window.missionSceneStatus.cleared = ack.status === 'ok' || ack.status === 'noop';
            window.missionSceneStatus.clearedCount = Number(ack.cleared || 0);
            window.missionSceneStatus.lastSpawnFailedAt = 0;
            window.missionSceneStatus.boardingRequested = false;
            window.missionSceneStatus.boardingActive = false;
            window.missionSceneStatus.boardingComplete = false;
            window.missionSceneStatus.personBoarded = false;
            window.missionSceneStatus.error = null;
            if (window.missionSceneStatus.respawnAfterClear) {
                const respawnReason = window.missionSceneStatus.respawnAfterClearReason || 'scene-clear-respawn';
                window.missionSceneStatus.respawnAfterClear = false;
                window.missionSceneStatus.respawnAfterClearReason = '';
                setTimeout(() => _missionSceneHandleFlightTick(window.lastLiveFlightData || {}, respawnReason), 350);
            }
        } else if (ack.type === 'mission_scene_boarding_ack') {
            window.missionSceneStatus.boardingPreparing = false;
            window.missionSceneStatus.boardingRequested = false;
            window.missionSceneStatus.boardingActive = false;
            window.missionSceneStatus.boardingComplete = ack.status === 'ok';
            window.missionSceneStatus.boardingError = ack.status === 'ok' ? null : (ack.error || ack.status || 'scene_boarding_failed');
            window.missionSceneStatus.personBoarded = ack.status === 'ok' && !!Number(ack.boarded || 0);
            if (ack.status === 'ok') {
                _missionCargoMarkPassengerLoaded({ reason: 'boarding-ack-passenger-sync', playAudioCue: false });
                _missionCargoSyncPayloadToSim('boarding-ack').catch(() => {});
                _missionCargoScheduleStartReadyPromotion('boarding-ack');
            }
            _resolveMissionSceneBoardingAck(ack);
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
    if (_missionIsFreeflightOnly(md)) return '';
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
    if (_missionIsFreeflightOnly(md)) return false;
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

function _setMissionStartPhase(phase, options = {}) {
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
        if (options.persist !== false) {
            _persistMissionRuntimeSnapshot('set-start-phase', prev !== next ? { immediate: true } : {});
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
        _persistMissionRuntimeSnapshot('clear-start-phase');
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
    if (typeof _missionScenePaxCount === 'function' && _missionScenePaxCount() <= 0) return true;
    const sceneDone = !!window.missionSceneStatus?.boardingComplete || !!window.missionSceneStatus?.personBoarded;
    if (!sceneDone) return false;
    return true;
}

function _missionCargoMaybePromoteStartReady(reason = 'cargo-ready-check') {
    const manifest = _missionCargoEnsureManifest();
    if (!window.missionCargoStatus?.loadConfirmed) return false;
    if (!manifest?.dispatchSignature) return false;
    if (!_missionCargoLoadInteractionReady()) return false;
    if (!window.missionSceneStatus?.boardingVoiceComplete) return false;
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

function _missionCargoScheduleStartReadyPromotion(reason = 'cargo-ready-poll', attemptsLeft = 240) {
    if (_missionCargoMaybePromoteStartReady(reason)) return;
    if (!window.missionCargoStatus?.loadConfirmed || attemptsLeft <= 0) return;
    _updateMissionRuntimeUi();
    setTimeout(() => _missionCargoScheduleStartReadyPromotion(reason, attemptsLeft - 1), 500);
}

function _missionCloseOutcomeSummaryText(outcome = null) {
    const o = (outcome && typeof outcome === 'object') ? outcome : null;
    if (!o) return 'Missionabschluss bereit. Die Auswertung wird jetzt festgeschrieben; aufgeraeumt wird erst beim Schliessen des Debriefs.';
    if (!o.failed) {
        const requiredLoaded = Number.isFinite(Number(o.requiredLoaded)) ? Number(o.requiredLoaded) : 0;
        const requiredTotal = Number.isFinite(Number(o.requiredTotal)) ? Number(o.requiredTotal) : 0;
        const loadedWeight = Number.isFinite(Number(o.loadedWeightLbs)) ? Number(o.loadedWeightLbs) : 0;
        return `Mission erfolgreich (${requiredLoaded}/${requiredTotal} Pflicht-Items, ${loadedWeight} lbs). Jetzt Abschluss und Debrief oeffnen.`;
    }
    const reasons = [
        ...(Array.isArray(o.missingRequired) ? o.missingRequired : []),
        ...(Array.isArray(o.droppedRequired) ? o.droppedRequired : []),
        ...(Array.isArray(o.notDeliveredRequired) ? o.notDeliveredRequired : []),
        ...(Array.isArray(o.damagedRequired) ? o.damagedRequired : [])
    ].filter(Boolean);
    const preview = reasons.slice(0, 3).join(', ');
    return preview
        ? `Mission endet mit Fehlschlag: ${preview}. Jetzt Abschluss und Debrief oeffnen.`
        : 'Mission endet mit Fehlschlag. Jetzt Abschluss und Debrief oeffnen.';
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
    const usePoiStyleTask = _missionSceneIsPoiMission()
        || (typeof window.missionBushUsesPoiTaskRecipe === 'function' && window.missionBushUsesPoiTaskRecipe());
    if (!usePoiStyleTask) return outcome;
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
    const taskLabel = (typeof window.missionBushUsesPoiTaskRecipe === 'function' && window.missionBushUsesPoiTaskRecipe())
        ? 'Auftrag im Zielgebiet'
        : 'POI-Auftrag';
    const poiFailureMessages = new Set([
        `${taskLabel} wurde nicht abgeschlossen.`,
        `${taskLabel} wurde im Zielgebiet abgebrochen.`
    ]);
    const poiResolved = !!(progress.satisfied || progress.manualConfirmed);
    if (poiResolved) {
        base.notDeliveredRequired = notDelivered.filter(entry => !poiFailureMessages.has(String(entry || '').trim()));
        if (!base.missingRequired?.length && !base.droppedRequired?.length && !base.damagedRequired?.length && !(base.notDeliveredRequired || []).length) {
            base.failed = false;
            base.status = 'completed';
        }
    } else
    if (progress.aborted) {
        const abortMsg = `${taskLabel} wurde im Zielgebiet abgebrochen.`;
        if (!notDelivered.includes(abortMsg)) {
            notDelivered.push(abortMsg);
        }
    } else if (!progress.satisfied) {
        const incompleteMsg = `${taskLabel} wurde nicht abgeschlossen.`;
        if (!notDelivered.includes(incompleteMsg)) {
            notDelivered.push(incompleteMsg);
        }
    }
    if (!poiResolved) base.notDeliveredRequired = notDelivered;
    if ((base.notDeliveredRequired || []).length > 0) {
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

const MISSION_DEBRIEF_PENDING_KEY = 'ga_pending_mission_debrief_v1';

function _completionFinite(value, digits = null) {
    if (value == null || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return digits == null ? n : Number(n.toFixed(digits));
}

function _completionText(value, max = 180) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function _completionList(value, maxItems = 6) {
    return Array.isArray(value)
        ? value.map(item => _completionText(item, 80)).filter(Boolean).slice(0, maxItems)
        : [];
}

function _readPendingMissionDebrief() {
    try {
        const parsed = JSON.parse(localStorage.getItem(MISSION_DEBRIEF_PENDING_KEY) || 'null');
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
        return null;
    }
}

function _missionCompletionHasCargo() {
    try {
        const manifest = typeof _missionCargoGetManifest === 'function' ? _missionCargoGetManifest() : null;
        return !!(Array.isArray(manifest?.items) && manifest.items.some(item => {
            try { return typeof _missionCargoIsPassengerItem !== 'function' || !_missionCargoIsPassengerItem(item); }
            catch (_) { return true; }
        }));
    } catch (_) {
        return false;
    }
}

function _missionCompletionHasPassengers() {
    if (window.activePassenger) return true;
    try {
        const manifest = typeof _missionCargoGetManifest === 'function' ? _missionCargoGetManifest() : null;
        if (Array.isArray(manifest?.items) && manifest.items.some(item => typeof _missionCargoIsPassengerItem === 'function' && _missionCargoIsPassengerItem(item))) return true;
    } catch (_) {}
    try { return typeof _missionScenePaxCount === 'function' && _missionScenePaxCount() > 0; } catch (_) { return false; }
}

function _buildMissionCompletionRecord(options = {}) {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData && typeof currentMissionData === 'object')
        ? currentMissionData
        : {};
    const missionId = _activeMissionRuntimeId('mission');
    const existing = _readPendingMissionDebrief();
    if (existing?.missionId === missionId) return existing;
    const flight = options.flightRecord || missionRuntime.pendingFarewellRecord || missionRuntime.arrivalFlightRecord || _buildFlightRecordSnapshot(Date.now()) || {};
    const endedAt = Number(flight.createdAt || flight.endTs || Date.now()) || Date.now();
    const startedAt = Number(flight.startTs || missionRuntime.startedAt || 0);
    const durationSec = _completionFinite(flight.durationSec)
        ?? (startedAt > 0 ? Math.max(1, Math.round((endedAt - startedAt) / 1000)) : null);
    const recordedDistanceNm = _completionFinite(flight.distanceNm, 1);
    const distanceNm = recordedDistanceNm
        ?? _completionFinite(parseFloat(String(md.dist ?? md.distanceNm ?? '').replace(',', '.')), 1);
    const cargoOutcome = options.outcome || flight.missionCargoOutcome || missionRuntime.closingOutcome || null;
    let comfort = null;
    if (_missionCompletionHasPassengers() && typeof window.paxVoiceGetComfortSummary === 'function') {
        try { comfort = window.paxVoiceGetComfortSummary(); } catch (_) {}
    }
    const comfortHasSamples = Number(comfort?.samples || 0) > 0;
    const maxGForce = _completionFinite(flight.maxGForce, 2)
        ?? (comfortHasSamples ? _completionFinite(comfort?.maxG, 2) : null);
    const maxBankDeg = _completionFinite(flight.maxBankDeg, 1)
        ?? (comfortHasSamples ? _completionFinite(comfort?.maxBankDeg, 1) : null);
    const telemetrySampleCount = Math.max(0, Math.round(Number(flight.telemetrySampleCount || 0)));
    const bankSampleCount = Math.max(0, Math.round(Number(flight.bankSampleCount || 0)));
    const gForceSampleCount = Math.max(0, Math.round(Number(flight.gForceSampleCount || 0)));
    const enrouteSampleCount = Math.max(0, Math.round(Number(flight.enrouteSampleCount || 0)));
    const aglSampleCount = Math.max(0, Math.round(Number(flight.aglSampleCount || 0)));
    const telemetryStatus = _completionText(
        flight.telemetryStatus
        || ((maxGForce != null || maxBankDeg != null) ? 'partial' : 'unavailable'),
        24
    );
    const completionId = `${missionId}-${Math.round(endedAt)}`;
    const start = _completionText(flight.depLabel || md.start || (typeof currentStartICAO !== 'undefined' ? currentStartICAO : '') || 'START', 64);
    const actualLanding = _completionText(flight.arrLabel || md.dest || (typeof currentDestICAO !== 'undefined' ? currentDestICAO : '') || 'LANDUNG', 64);
    const assignment = _completionText(md.mission || md.title || md.missionTitle || md.task || 'Mission', 220);
    const cruiseCount = Math.max(0, Math.round(Number(flight.cruiseSampleCount || 0)));
    const cruiseDurationSec = Math.max(0, Math.round(Number(flight.cruiseDurationSec || 0)));
    const hasCruiseEvidence = cruiseCount >= 10 && cruiseDurationSec >= 20;
    return {
        schemaVersion: 2,
        id: completionId,
        completionId,
        missionId,
        createdAt: endedAt,
        endedAt,
        date: new Date(endedAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
        dateLabel: new Date(endedAt).toLocaleString('de-DE'),
        start,
        dest: actualLanding,
        depLabel: start,
        arrLabel: actualLanding,
        plannedDest: _completionText(md.dest || '', 64),
        mission: assignment,
        missionTitle: assignment,
        taskDomain: _completionText(md.taskDomain || md.missionContract?.taskDomain || '', 80),
        aircraft: _completionText(md.ac || md.aircraft || '', 80),
        ac: _completionText(md.ac || md.aircraft || '', 80),
        durationSec: durationSec == null ? null : Math.round(durationSec),
        distanceNm,
        dist: distanceNm,
        distanceSource: _completionText(recordedDistanceNm != null ? (flight.distanceSource || 'gps') : 'planned', 24),
        result: cargoOutcome?.failed || flight.missionFailed ? 'failed' : 'completed',
        failed: !!(cargoOutcome?.failed || flight.missionFailed),
        simulated: !!window.simModeActive,
        maxGForce,
        maxBankDeg,
        touchdownVsFpm: _completionFinite(flight.touchdownVsFpm),
        maxClimbFpm: _completionFinite(flight.maxClimbFpm),
        maxDescentFpm: _completionFinite(flight.maxDescentFpm),
        minEnrouteAglFt: _completionFinite(flight.minEnrouteAglFt),
        cruiseAltitudeMeanFt: hasCruiseEvidence ? _completionFinite(flight.cruiseAltitudeMeanFt) : null,
        cruiseAltitudeStdDevFt: hasCruiseEvidence ? _completionFinite(flight.cruiseAltitudeStdDevFt) : null,
        cruiseAltitudeRangeFt: hasCruiseEvidence ? _completionFinite(flight.cruiseAltitudeRangeFt) : null,
        telemetryStatus,
        telemetrySampleCount,
        bankSampleCount: bankSampleCount || (comfortHasSamples ? Math.max(0, Math.round(Number(comfort.samples || 0))) : 0),
        gForceSampleCount: gForceSampleCount || (comfortHasSamples ? Math.max(0, Math.round(Number(comfort.samples || 0))) : 0),
        enrouteSampleCount,
        aglSampleCount,
        cruiseSampleCount: cruiseCount,
        cruiseDurationSec,
        comfort: comfort ? {
            score: _completionFinite(comfort.comfortScore),
            mood: _completionText(comfort.mood, 80),
            pilotEvents: Math.max(0, Math.round(Number(comfort.pilotEvents || 0))),
            pilotSevere: Math.max(0, Math.round(Number(comfort.pilotSevere || 0))),
            weatherEvents: Math.max(0, Math.round(Number(comfort.weatherEvents || 0))),
            weatherSevere: Math.max(0, Math.round(Number(comfort.weatherSevere || 0))),
            samples: Math.max(0, Math.round(Number(comfort.samples || 0))),
            maxG: _completionFinite(comfort.maxG, 2),
            maxBankDeg: _completionFinite(comfort.maxBankDeg, 1),
            maxDescentFpm: _completionFinite(comfort.maxDescentFpm)
        } : null,
        cargo: _missionCompletionHasCargo() && cargoOutcome ? {
            status: _completionText(cargoOutcome.status || (cargoOutcome.failed ? 'failed' : 'completed'), 32),
            failed: !!cargoOutcome.failed,
            conditionPct: _completionFinite(cargoOutcome.conditionPct),
            stressDamagePct: _completionFinite(cargoOutcome.stressDamagePct),
            requiredTotal: Math.max(0, Math.round(Number(cargoOutcome.requiredTotal || 0))),
            requiredLoaded: Math.max(0, Math.round(Number(cargoOutcome.requiredLoaded || 0))),
            missingRequired: _completionList(cargoOutcome.missingRequired),
            droppedRequired: _completionList(cargoOutcome.droppedRequired),
            notDeliveredRequired: _completionList(cargoOutcome.notDeliveredRequired),
            damagedRequired: _completionList(cargoOutcome.damagedRequired)
        } : null
    };
}

function _compactLegacyLogbookEntry(entry = {}, index = 0) {
    if (entry?.schemaVersion === 2 && entry?.completionId) return entry;
    const createdAt = Number(entry.createdAt || entry.endedAt || entry.id || 0) || 0;
    const legacySignature = [entry.date || entry.dateLabel || '', entry.start || entry.depLabel || '', entry.dest || entry.arrLabel || '', entry.mission || entry.title || '', entry.dist || entry.distanceNm || '', entry.ac || entry.aircraft || ''].join('-');
    const fallbackId = `legacy-${createdAt || _completionText(legacySignature, 105) || index}`;
    return {
        schemaVersion: 1,
        id: _completionText(entry.completionId || entry.id || fallbackId, 120),
        completionId: _completionText(entry.completionId || entry.id || fallbackId, 120),
        createdAt: createdAt || null,
        date: _completionText(entry.date || entry.dateLabel || '', 80),
        dateLabel: _completionText(entry.dateLabel || entry.date || '', 80),
        start: _completionText(entry.start || entry.depLabel || 'START', 64),
        dest: _completionText(entry.dest || entry.arrLabel || 'LANDUNG', 64),
        depLabel: _completionText(entry.depLabel || entry.start || 'START', 64),
        arrLabel: _completionText(entry.arrLabel || entry.dest || 'LANDUNG', 64),
        mission: _completionText(entry.mission || entry.missionTitle || entry.title || 'Mission', 220),
        missionTitle: _completionText(entry.missionTitle || entry.mission || entry.title || 'Mission', 220),
        aircraft: _completionText(entry.aircraft || entry.ac || '', 80),
        ac: _completionText(entry.ac || entry.aircraft || '', 80),
        durationSec: _completionFinite(entry.durationSec),
        distanceNm: _completionFinite(entry.distanceNm ?? entry.dist, 1),
        dist: _completionFinite(entry.distanceNm ?? entry.dist, 1),
        result: _completionText(entry.result || (entry.failed ? 'failed' : 'completed'), 24),
        failed: !!entry.failed
    };
}

function _upsertMissionLogbook(record) {
    if (!record?.completionId) return false;
    let log = [];
    try { log = JSON.parse(localStorage.getItem('ga_logbook') || '[]'); } catch (_) {}
    const compact = (Array.isArray(log) ? log : []).map(_compactLegacyLogbookEntry);
    const idx = compact.findIndex(entry => entry?.completionId === record.completionId || entry?.id === record.completionId);
    if (idx >= 0) compact[idx] = record;
    else compact.unshift(record);
    compact.sort((a, b) => Number(b?.createdAt || b?.endedAt || 0) - Number(a?.createdAt || a?.endedAt || 0));
    _storeMissionLogbookEntries(compact);
    try { window.renderLog?.(); } catch (_) { try { renderLog(); } catch (_) {} }
    return true;
}
window.upsertMissionLogbook = _upsertMissionLogbook;

function _missionLogbookForSync(source = null) {
    let entries = source;
    if (!Array.isArray(entries)) {
        try { entries = JSON.parse(localStorage.getItem('ga_logbook') || '[]'); } catch (_) { entries = []; }
    }
    return (Array.isArray(entries) ? entries : [])
        .map(_compactLegacyLogbookEntry)
        .filter(entry => entry?.completionId)
        .slice(0, 50);
}

function _storeMissionLogbookEntries(entries = [], options = {}) {
    const source = (Array.isArray(entries) ? entries : [])
        .map(_compactLegacyLogbookEntry)
        .filter(entry => entry?.completionId)
        .slice(0, 50);
    const limits = Array.from(new Set([
        source.length,
        40,
        25,
        10,
        5,
        2,
        1
    ].filter(limit => limit > 0 && limit <= source.length)));
    if (!source.length) limits.push(0);

    let lastError = null;
    let storageRescued = false;
    for (const limit of limits) {
        const candidate = source.slice(0, limit);
        for (let pass = 0; pass < 2; pass++) {
            try {
                if (storageRescued) {
                    try { localStorage.removeItem('ga_logbook'); } catch (_) {}
                }
                localStorage.setItem('ga_logbook', JSON.stringify(candidate));
                const compacted = candidate.length < source.length;
                if (storageRescued || compacted) {
                    try {
                        console.warn('[Sync] Logbook storage adjusted for local quota.', {
                            kept: candidate.length,
                            available: source.length,
                            storageRescued
                        });
                    } catch (_) {}
                }
                return {
                    entries: candidate,
                    totalEntries: source.length,
                    compacted,
                    storageRescued
                };
            } catch (err) {
                lastError = err;
                if (!_syncIsStorageQuotaError(err)) throw err;
                if (!storageRescued) {
                    _syncPruneLocalStorageForQuota({
                        replacePinboard: options.replacePinboard === true,
                        replaceActiveMission: false
                    });
                    try { localStorage.removeItem('ga_logbook'); } catch (_) {}
                    storageRescued = true;
                    continue;
                }
                break;
            }
        }
    }
    throw lastError || new Error('Logbuch konnte lokal nicht gespeichert werden');
}

function _mergeMissionLogbooks(remoteEntries = [], options = {}) {
    const merged = new Map();
    _missionLogbookForSync(remoteEntries).forEach(entry => merged.set(entry.completionId, entry));
    _missionLogbookForSync().forEach(entry => merged.set(entry.completionId, entry));
    const result = Array.from(merged.values())
        .sort((a, b) => Number(b?.createdAt || b?.endedAt || 0) - Number(a?.createdAt || a?.endedAt || 0))
        .slice(0, 50);
    return _storeMissionLogbookEntries(result, options);
}

function _persistMissionCompletion(record) {
    if (!record?.completionId) return false;
    localStorage.setItem(MISSION_DEBRIEF_PENDING_KEY, JSON.stringify(record));
    localStorage.setItem('last_icao_dest', String(record.dest || ''));
    _upsertMissionLogbook(record);
    try {
        if (typeof currentMissionData === 'object' && currentMissionData) {
            currentMissionData.missionCompletionState = 'completed_awaiting_cleanup';
            currentMissionData.missionCompletionId = record.completionId;
            currentMissionData.missionCompletionRecord = record;
        }
        _mutateStoredActiveMissionRuntimeMarker(state => {
            state.missionCompletionState = 'completed_awaiting_cleanup';
            state.missionCompletionId = record.completionId;
            state.missionCompletionRecord = record;
            if (state.currentMissionData) {
                state.currentMissionData.missionCompletionState = 'completed_awaiting_cleanup';
                state.currentMissionData.missionCompletionId = record.completionId;
                state.currentMissionData.missionCompletionRecord = record;
            }
        });
    } catch (_) {}
    return true;
}

function _showMissionCompletionDebrief(record) {
    let attempts = 0;
    const show = () => {
        if (typeof window.showFlightDebrief === 'function') {
            window.showFlightDebrief(record, { awaitingCleanup: true });
            return;
        }
        if (++attempts < 20) setTimeout(show, 100);
    };
    setTimeout(show, 0);
}

window.restoreMissionCompletionFromCloud = function(record = null, reason = 'cloud-completion-restore') {
    if (!record || typeof record !== 'object' || !record.completionId) return false;
    if (window.missionComplianceBlockClose?.()) {
        missionRuntime.phase = 'inspection';
        missionRuntime.active = true;
        missionRuntime.armed = false;
        missionRuntime.closingPending = false;
        window.missionComplianceRequestClose?.({
            reason,
            outcome: record.cargo && typeof record.cargo === 'object'
                ? { ...record.cargo, failed: !!record.failed }
                : { status: record.failed ? 'failed' : 'completed', failed: !!record.failed },
            record
        });
        _persistMissionRuntimeSnapshot('cloud-completion-held-for-compliance', { immediate: true });
        _updateMissionRuntimeUi();
        return false;
    }
    missionRuntime.phase = 'closing';
    missionRuntime.active = false;
    missionRuntime.armed = false;
    missionRuntime.manual = false;
    missionRuntime.closingPending = true;
    missionRuntime.closingReason = reason;
    missionRuntime.closingRequestedAt = Number(record.endedAt || record.createdAt || Date.now());
    missionRuntime.completionRecord = record;
    missionRuntime.closingOutcome = record.cargo ? {
        ...record.cargo,
        failed: !!record.failed
    } : { status: record.failed ? 'failed' : 'completed', failed: !!record.failed };
    _persistMissionCompletion(record);
    _persistMissionRuntimeSnapshot(reason, { immediate: true });
    _updateMissionRuntimeUi();
    _showMissionCompletionDebrief(record);
    return true;
};

function _setMissionClosePending(options = {}) {
    const sourceRecord = (options?.record && typeof options.record === 'object' ? options.record : null)
        || missionRuntime.pendingFarewellRecord
        || missionRuntime.arrivalFlightRecord
        || _buildFlightRecordSnapshot(Date.now())
        || null;
    let outcome = options?.outcome && typeof options.outcome === 'object' ? options.outcome : null;
    if (typeof _missionCargoFinalizeMissionOutcome === 'function') {
        try { outcome = _missionCargoFinalizeMissionOutcome({ source: 'mission-close-pending', record: sourceRecord }) || outcome; } catch (_) {}
    }
    if (options?.complianceReleased !== true && window.missionComplianceBlockClose?.()) {
        missionRuntime.phase = 'inspection';
        missionRuntime.active = true;
        missionRuntime.armed = false;
        missionRuntime.closingPending = false;
        missionRuntime.waitingFarewellDeboarding = false;
        missionRuntime.deboardingAfterFarewellStarted = false;
        missionRuntime.farewellSpeechStarted = false;
        missionRuntime.farewellSpeechComplete = true;
        missionRuntime.farewellDoorReady = false;
        missionRuntime.pendingFarewellRecord = null;
        missionRuntime.pendingFarewellReason = '';
        missionRuntime.endDeboardingAnimationExpected = false;
        missionRuntime.endDeboardingCompleted = true;
        missionRuntime.endDeboardingCommandId = '';
        _missionSceneClearDeboardingWatchdog();
        window.missionComplianceRequestClose?.({
            reason: String(options?.reason || 'mission-close-after-compliance'),
            outcome,
            record: sourceRecord
        });
        _persistMissionRuntimeSnapshot('mission-close-held-for-compliance', { immediate: true });
        _updateMissionRuntimeUi();
        return false;
    }
    missionRuntime.phase = 'closing';
    missionRuntime.active = false;
    missionRuntime.armed = false;
    missionRuntime.manual = false;
    missionRuntime.closingPending = true;
    missionRuntime.closingReason = String(options?.reason || 'mission-close-pending');
    missionRuntime.closingOutcome = outcome || missionRuntime.closingOutcome || null;
    if (missionRuntime.closingOutcome && typeof window.missionFollowupMaybeCreateFromCompletedMission === 'function') {
        try {
            window.missionFollowupMaybeCreateFromCompletedMission(
                (typeof currentMissionData !== 'undefined' ? currentMissionData : null),
                missionRuntime.closingOutcome,
                { source: missionRuntime.closingReason || 'mission-close-pending' }
            );
        } catch (err) {
            console.warn('[FollowUp] Runtime-Close-Hook fehlgeschlagen:', err?.message || err);
        }
    }
    missionRuntime.closingRequestedAt = Date.now();
    missionRuntime.completionRecord = _buildMissionCompletionRecord({ flightRecord: sourceRecord, outcome: missionRuntime.closingOutcome });
    missionRuntime.readySince = 0;
    missionRuntime.pendingEndAt = 0;
    missionRuntime.lastOffDestAt = 0;
    missionRuntime.waitingFarewellDeboarding = false;
    missionRuntime.deboardingAfterFarewellStarted = false;
    missionRuntime.farewellSpeechStarted = false;
    missionRuntime.farewellSpeechComplete = false;
    missionRuntime.farewellDoorReady = false;
    missionRuntime.pendingFarewellRecord = null;
    missionRuntime.pendingFarewellReason = '';
    missionRuntime.endDeboardingAnimationExpected = false;
    missionRuntime.endDeboardingCompleted = false;
    missionRuntime.endDeboardingCommandId = '';
    missionRuntime.endReadinessKey = '';
    _missionSceneClearDeboardingWatchdog();
    _sendMissionLifecycleToTracker('closing', missionRuntime.closingReason);
    _persistMissionRuntimeSnapshot('mission-close-pending', { immediate: true });
    _updateMissionRuntimeUi();
    return true;
}

window.missionComplianceReleasePendingClose = function(pending = null) {
    const held = pending && typeof pending === 'object' ? pending : {};
    return _setMissionClosePending({
        reason: String(held.reason || 'mission-close-after-compliance'),
        outcome: held.outcome && typeof held.outcome === 'object' ? held.outcome : null,
        record: held.record && typeof held.record === 'object' ? held.record : null,
        complianceReleased: true
    });
};

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
    _restoreBushPickupOutboundRuntimeState();
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
        boardingPreparing: false,
        boardingRequested: false,
        boardingActive: false,
        boardingComplete: false,
        boardingError: null,
        boardingCueCommandId: '',
        boardingVoiceComplete: false,
        manualPaxRequested: false,
        manualPaxActive: false,
        manualPaxError: null,
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
        boardingPreparing: false,
        boardingRequested: false,
        boardingActive: false,
        boardingComplete: false,
        boardingError: null,
        boardingCueCommandId: '',
        boardingVoiceComplete: false,
        manualPaxRequested: false,
        manualPaxActive: false,
        manualPaxError: null,
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
    const compliance = window.missionComplianceGetDebugState?.() || null;
    const complianceBusy = !!(
        compliance?.selected
        && compliance.phase !== 'released'
        && compliance.farewellComplete
    );
    return !!(missionRuntime.waitingFarewellDeboarding
        || missionRuntime.deboardingAfterFarewellStarted
        || scene.deboardingRequested
        || scene.deboardingActive
        || complianceBusy);
}

function _missionCriticalActionConfirmMessage(action = 'end', options = {}) {
    const normalized = String(action || 'end').toLowerCase();
    if (normalized === 'close') {
        return 'Mission wirklich schliessen?\n\nDer Missionsabschluss wird uebernommen und der laufende Missionsstatus zurueckgesetzt.';
    }
    if (normalized === 'reset') {
        return 'Mission wirklich zuruecksetzen?\n\nAktive Missionsphase, Szenenstatus und Laufzeitdaten werden geloescht.';
    }
    if (normalized === 'stop') {
        return 'Mission wirklich stoppen?\n\nDiese Aktion beendet die laufende Mission manuell.';
    }
    if (normalized === 'sim-end') {
        return 'Sim-Mission wirklich beenden?\n\nDer Missionsabschluss wird jetzt ausgefuehrt.';
    }
    if (normalized === 'cargo-end') {
        return 'Entladung abschliessen und Mission beenden?\n\nDanach startet der Missionsabschluss mit Farewell/Endszene.';
    }
    if (normalized === 'cargo-unload') {
        return 'Entladung wirklich abschliessen?\n\nDiese Missionsaktion bestaetigt die aktuelle Entladung.';
    }
    if (normalized === 'debug-end') {
        return 'Debug-Mission wirklich als beendet markieren?\n\nDiese Aktion veraendert den Follow-up-/Missionsstatus.';
    }
    return options?.message || 'Mission wirklich beenden?\n\nDer Missionsabschluss wird jetzt ausgefuehrt.';
}

function _confirmMissionCriticalAction(action = 'end', options = {}) {
    if (options?.skipConfirm) return true;
    const message = _missionCriticalActionConfirmMessage(action, options);
    try { return !!confirm(message); } catch (_) { return false; }
}
window.confirmMissionCriticalAction = _confirmMissionCriticalAction;

function _updateMissionStartBanner() {
    const banner = document.getElementById('missionStartBanner');
    if (!banner) return;
    const kickerEl = document.getElementById('missionStartBannerKicker');
    const textEl = document.getElementById('missionStartBannerText');
    const btn = document.getElementById('missionStartBannerBtn');
    const closeBtn = banner.querySelector('.mission-start-banner-close');
    const authorityConflict = window.missionRuntimeResumeConflict?.trackerActive === true
        ? window.missionRuntimeResumeConflict
        : null;
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
    const deferredPickupStart = !missionRuntime.active
        && typeof _missionBushIsPickupMission === 'function'
        && _missionBushIsPickupMission();
    const isAptCharterPickup = String(_activeBushMissionSpec()?.profileId || '').toLowerCase() === 'apt_charter_pickup';
    const pickupPlaceLabel = isAptCharterPickup ? 'Zielplatz' : 'Zielstrip';
    const pickupLegLabel = isAptCharterPickup ? 'Charter-Pickup' : 'Pickup-Strip';
    missionRuntime.phase = runtimePhase;
    const showClose = !!missionRuntime.closingPending && !deboardingBusy;
    const showDeboarding = (missionRuntime.active || missionRuntime.closingPending) && deboardingBusy;
    const showEndReady = missionRuntime.active && !!groundAction?.endReady;
    const showEnd = missionRuntime.active && showEndReady && !deboardingBusy;
    const showPickup = missionRuntime.active && groundAction?.action === 'pickup' && !showEnd && !deboardingBusy;
    const showFinalEndAction = showEnd && groundAction?.action !== 'unload';
    const showStart = valid
        && (trackerConnected || simMode)
        && groundReady
        && !missionRuntime.active
        && !dismissed;
    const showAuthorityConflict = !!authorityConflict;
    const show = showAuthorityConflict || showClose || showDeboarding || showEnd || showPickup || showStart;
    banner.style.display = show ? 'flex' : 'none';
    if (!show) return;
    if (btn) btn.disabled = false;
    banner.classList.toggle('is-end-ready', showEnd);
    banner.classList.toggle('is-begin-action', showStart && phase === 'planned');
    banner.classList.toggle('is-final-action', showFinalEndAction);
    if (showAuthorityConflict) {
        if (kickerEl) kickerEl.textContent = 'Mission läuft auf dem Tracker';
        if (closeBtn) closeBtn.style.display = 'none';
        if (textEl) {
            const trackerId = authorityConflict.trackerMissionId || 'eine andere Mission';
            textEl.textContent = `${trackerId} ist die aktuelle Missionswahrheit. Du kannst ihren gespeicherten Stand auf dieses Gerät übernehmen.`;
        }
        if (btn) {
            btn.textContent = 'Mission hier übernehmen';
            btn.disabled = false;
        }
        return;
    }
    if (showClose) {
        if (kickerEl) kickerEl.textContent = 'Mission auswerten';
        if (closeBtn) closeBtn.style.display = 'none';
        if (textEl) {
            const waitHint = window.missionSceneStatus?.deboardingActive
                ? ' Endszene laeuft noch, danach schliessen.'
                : '';
            textEl.textContent = `${_missionCloseOutcomeSummaryText(missionRuntime.closingOutcome)}${waitHint}`;
        }
        if (btn) btn.textContent = 'Abschluss & Debrief';
        return;
    }
    if (showDeboarding) {
        const compliance = window.missionComplianceGetCargoUiState?.() || null;
        const complianceBusy = compliance?.active === true && compliance.phase !== 'released';
        if (kickerEl) kickerEl.textContent = complianceBusy ? 'Behoerdenkontrolle' : 'Mission abschliessen';
        if (closeBtn) closeBtn.style.display = 'none';
        if (textEl) textEl.textContent = complianceBusy
            ? (compliance.message || 'Kontrolle laeuft. Missionsende bleibt bis zur Freigabe gesperrt.')
            : 'Deboarding laeuft. Missionabschluss wird vorbereitet.';
        if (btn) {
            btn.textContent = complianceBusy ? 'Kontrolle läuft ...' : 'Bitte warten...';
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
        if (kickerEl) kickerEl.textContent = isAptCharterPickup ? 'Charter Pickup' : 'Bush Pickup';
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
    const boardingFlowBusy = phase === 'boarding' && !!(
        scene.boardingPreparing
        || scene.boardingRequested
        || scene.boardingActive
        || missionStartBoardingPromise
    );
    let text = phase === 'boarded'
        ? (deferredPickupStart
            ? `Leerflug ist startbereit. Der Pickup wird erst am ${pickupPlaceLabel} freigegeben.`
            : 'Boarding abgeschlossen. Wenn du die Ladung sicher verstaut hast, kann es losgehen.')
        : (phase === 'boarding'
            ? (deferredPickupStart
                ? 'Leerflug wird vorbereitet. Kein Passagier steigt am Start ein.'
                : (simMode ? 'Sim-Modus bereit. Boarding und Verladen laufen an.' : 'Missionstart angefordert. Szene, Boarding und Verladen werden vorbereitet.'))
            : (phase === 'prepare'
                ? (deferredPickupStart
                    ? 'Leerflug freigegeben. Als Nächstes machst du die Mission startbereit.'
                    : 'Missionstart freigegeben. Als Nächstes kannst du Boarding und Verladen beginnen.')
                : 'Mission ist geplant, aber noch nicht gestartet.'));
    if (phase === 'boarding') {
        if (deferredPickupStart) text = `Leerflug wird vorbereitet. Der Gast wartet am ${pickupPlaceLabel}.`;
        else if (scene.boardingComplete && scene.boardingVoiceComplete) text = 'Boarding und Ansage sind abgeschlossen. Die Verladung im Ladefenster noch bestätigen.';
        else if (scene.boardingComplete) text = 'Die Tür ist geschlossen. Boarding-Ansage und Verladung werden noch abgeschlossen.';
        else if (simMode) text = 'Sim-Modus bereit. Boarding und Verladen laufen an.';
        else if (scene.spawned) text = `Start-Szene steht (${scene.spawnedCount || '?'} Objekte). Boarding und Verladen laufen.`;
        else if (scene.spawnRequested) text = 'Start-Szene wird vorbereitet. Boarding und Verladen laufen an.';
        else if (scene.blockReason) text = _missionSceneBlockReasonBannerText(scene.blockReason);
        else if (_missionLooksLikeFireWatch()) text = 'Feuerwehr-Szene wird vorbereitet. Boarding und Verladen laufen an.';
        if (!deferredPickupStart && typeof window.paxVoicePrepareBoarding === 'function') {
            try { window.paxVoicePrepareBoarding(); } catch (_) {}
        }
    } else if (phase === 'prepare') {
        text = deferredPickupStart
            ? (groundReady
                ? 'Leerflug freigegeben. Mit dem nächsten Klick wird die Mission ohne Start-PAX startbereit.'
                : 'Leerflug vorgemerkt. Bitte am Boden stehen und den Tracker abwarten.')
            : (groundReady
                ? 'Missionstart freigegeben. Mit dem nächsten Klick beginnt Boarding und Verladen.'
                : 'Missionstart vorgemerkt. Bitte am Boden stehen und den Tracker abwarten.');
    } else if (phase === 'planned') {
        text = deferredPickupStart
            ? (groundReady
                ? `Mission ist geplant. Mit "Mission starten" wird der Leerflug zum ${pickupLegLabel} vorbereitet.`
                : 'Mission ist geplant. Für den Leerflug bitte am Boden stehen und den Tracker abwarten.')
            : (groundReady
                ? 'Mission ist geplant. Mit "Mission starten" wird erst dann Szene, Boarding und Verladen freigegeben.'
                : 'Mission ist geplant. Für den Start bitte am Boden stehen und den Tracker abwarten.');
    }
    if (textEl) textEl.textContent = text;
    if (btn) {
        btn.textContent = phase === 'boarded'
            ? 'Mission starten'
            : (phase === 'prepare'
                ? (deferredPickupStart ? 'Leerflug startbereit machen' : 'Boarding und Verladen beginnen')
                : (phase === 'boarding' ? (boardingFlowBusy ? 'Bitte warten...' : 'Verladefenster öffnen') : 'Mission starten'));
        btn.disabled = phase === 'boarding' && boardingFlowBusy;
    }
}

function _updateMissionRuntimeUi() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const draftBlocked = !!md && !_missionSceneAcceptedForRuntime();
    const validMission = _hasValidMissionForStart();
    const groundStatus = _missionStartGroundStatus();
    const groundReady = !!groundStatus.ready;
    const phase = _missionStartPhase();
    const startScene = window.missionSceneStatus || {};
    const boardingFlowBusy = phase === 'boarding' && !!(
        startScene.boardingPreparing
        || startScene.boardingRequested
        || startScene.boardingActive
        || missionStartBoardingPromise
    );
    const endReady = missionRuntime.active ? _missionEndReadiness() : null;
    const poiGroundEndReady = missionRuntime.active ? _missionPoiGroundEndReady(endReady) : false;
    const bushGroundEndReady = missionRuntime.active ? _missionBushGroundEndReady(endReady) : false;
    const runtimeGroundEndReady = missionRuntime.active ? _missionRuntimeGroundEndReady(endReady) : false;
    const deboardingBusy = _missionEndDeboardingBusy();
    const groundAction = missionRuntime.active ? _missionResolveGroundAction({ endReady, deboardingBusy, active: true }) : null;
    const pickupConfirmOnly = !!groundAction?.pickupConfirmOnly;
    const deferredPickupStart = !missionRuntime.active
        && typeof _missionBushIsPickupMission === 'function'
        && _missionBushIsPickupMission();
    const isAptCharterPickup = String(_activeBushMissionSpec()?.profileId || '').toLowerCase() === 'apt_charter_pickup';
    const pickupPlaceLabel = isAptCharterPickup ? 'Zielplatz' : 'Zielstrip';
    const pickupLegLabel = isAptCharterPickup ? 'Charter-Pickup' : 'Pickup-Strip';
    const st = document.getElementById('missionRuntimeStatus');
    const detailEl = document.getElementById('missionRuntimeDetail');
    const nextStepEl = document.getElementById('missionRuntimeNextStep');
    const poiStatus = missionRuntime.active ? _missionPoiRuntimeStatus(endReady) : null;
    const runtimePhase = _missionRuntimePhaseSnapshot();
    if (st) {
        const idleText = !validMission
            ? 'Keine startbare Mission'
            : (groundReady
                ? (phase === 'boarded' ? 'Mission startbereit' : (phase === 'boarding' ? (deferredPickupStart ? 'Leerflug läuft an' : 'Boarding läuft an') : (phase === 'prepare' ? (deferredPickupStart ? 'Leerflug freigegeben' : 'Boarding freigegeben') : 'Mission geplant')))
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
            detailText = deferredPickupStart
                ? `Leerflug zum ${pickupLegLabel} ist startbereit. Der Gast wird erst am Ziel aufgenommen.`
                : 'Boarding und Verladen abgeschlossen. Mission ist jetzt startbereit.';
        } else if (phase === 'boarding' && validMission) {
            detailText = deferredPickupStart
                ? 'Leerflug wird vorbereitet. Am Start steigt kein Pickup-Gast ein.'
                : 'Missionstart angefordert. Szene, Boarding und Verladen werden vorbereitet.';
        } else if (phase === 'prepare' && validMission) {
            detailText = deferredPickupStart
                ? 'Leerflug freigegeben. Die nächste Bestätigung macht die Mission ohne Start-PAX startbereit.'
                : 'Missionstart freigegeben. Boarding und Verladen warten auf die nächste Bestätigung.';
        } else if (phase === 'planned' && validMission) {
            detailText = deferredPickupStart
                ? `Pickup-Mission liegt bereit. Erstflug zum ${pickupPlaceLabel} bleibt leer.`
                : 'Mission liegt bereit. Erst nach "Mission starten" werden Szene und Boarding freigeschaltet.';
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
                            : `Nächster Schritt: Zum ${pickupPlaceLabel} fliegen und zum Treffpunkt rollen`));
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
            nextStep = deferredPickupStart
                ? 'Nächster Schritt: Leerflug startbereit machen'
                : 'Nächster Schritt: Boarding und Verladen abschliessen';
        } else if (phase === 'prepare' && validMission && groundReady) {
            nextStep = deferredPickupStart
                ? 'Nächster Schritt: Leerflug startbereit machen'
                : 'Nächster Schritt: Boarding und Verladen beginnen';
        } else if (window.missionSceneStatus?.boardingRequested || window.missionSceneStatus?.boardingActive) {
            nextStep = deferredPickupStart
                ? 'Nächster Schritt: Leerflug wird vorbereitet'
                : 'Nächster Schritt: Boarding läuft';
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
    const bGroundCargo = document.getElementById('mapGroundCargoBtn');
    if (bStart) bStart.disabled = missionRuntime.active;
    if (bEnd) bEnd.disabled = !missionRuntime.active || deboardingBusy;
    if (bAuto) {
        bAuto.style.display = 'none';
        bAuto.disabled = true;
        bAuto.setAttribute('aria-pressed', 'false');
        bAuto.classList.remove('is-on');
        bAuto.classList.add('is-off');
    }
    if (bGroundCargo) {
        const cargoGroundStatus = window.missionCargoGroundHandlingStatus?.() || {
            ready: groundReady,
            onGround: groundStatus.onGround === true,
            label: groundStatus.label
        };
        const groundCargoVisible = cargoGroundStatus.onGround === true;
        bGroundCargo.style.display = groundCargoVisible ? 'inline-flex' : 'none';
        bGroundCargo.disabled = cargoGroundStatus.ready !== true;
        bGroundCargo.title = cargoGroundStatus.ready === true
            ? 'Verladefenster und Bordbestand oeffnen'
            : String(cargoGroundStatus.label || 'Nur am Boden und im Stillstand');
    }
    if (bMap) {
        if (missionRuntime.closingPending) {
            bMap.style.display = 'inline-flex';
            bMap.textContent = deboardingBusy ? '… Deboarding läuft' : '■ Abschluss & Debrief';
            bMap.title = deboardingBusy
                ? 'Deboarding laeuft noch'
                : 'Mission auswerten und Debrief oeffnen';
            bMap.disabled = deboardingBusy;
        } else {
            bMap.style.display = (missionRuntime.active || (validMission && groundReady)) ? 'inline-flex' : 'none';
            const pickupActionReady = missionRuntime.active && groundAction?.action === 'pickup';
            const unloadActionReady = missionRuntime.active && groundAction?.action === 'unload';
            bMap.textContent = missionRuntime.active
                ? (deboardingBusy ? '… Deboarding läuft' : (pickupActionReady ? (pickupConfirmOnly ? '⬤ Pickup abschliessen' : '⬤ Pickup starten') : (unloadActionReady ? '⬤ Ausladen' : (runtimeGroundEndReady ? '■ Mission beenden' : '■ Mission stoppen'))))
                : (phase === 'boarded'
                    ? '▶ Mission starten'
                : (phase === 'prepare'
                    ? (deferredPickupStart ? '▶ Leerflug bereit' : '▶ Boarding')
                        : (phase === 'boarding' ? (boardingFlowBusy ? (deferredPickupStart ? '… Leerflug' : '… Boarding läuft') : '▣ Verladefenster') : '▶ Mission starten')));
            bMap.title = missionRuntime.active
                ? (deboardingBusy ? 'Deboarding laeuft bereits' : (pickupActionReady ? (pickupConfirmOnly ? 'Pickup bestaetigen und Rueckflug freigeben' : `Pickup am ${pickupPlaceLabel} oeffnen`) : (unloadActionReady ? 'Ausladen/Aussteigen am Boden oeffnen' : (runtimeGroundEndReady ? 'Mission jetzt abschliessen' : 'Mission manuell stoppen'))))
                : (phase === 'boarded'
                    ? 'Mission jetzt aktiv schalten'
                    : (phase === 'prepare'
                        ? (deferredPickupStart ? 'Leerflug ohne Start-PAX startbereit machen' : 'Boarding und Verladen beginnen')
                        : (phase === 'boarding' ? (boardingFlowBusy ? (deferredPickupStart ? 'Leerflug wird vorbereitet' : 'Boarding und Verladen laufen noch') : 'Verladefenster wieder öffnen') : (deferredPickupStart ? 'Missionstart freigeben und Leerflug vorbereiten' : 'Missionstart freigeben und Boarding vorbereiten'))));
            bMap.disabled = missionRuntime.active ? deboardingBusy : (!validMission || !groundReady || (phase === 'boarding' && boardingFlowBusy));
        }
        bMap.classList.toggle('is-active', missionRuntime.active);
    }
    _updateMissionStartBanner();
    if (typeof window.paxVoiceRefreshWidget === 'function') window.paxVoiceRefreshWidget();
}
window.refreshMissionRuntimeUi = _updateMissionRuntimeUi;

function _resetMissionRuntime() {
    _missionSceneClearDeboardingWatchdog();
    window.missionPickupDepartureVoicePending = null;
    missionRuntime = {
        phase: _hasValidMissionForStart() ? 'planned' : 'idle',
        startedAt: 0,
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
        farewellPreloadRequestedAt: 0,
        arrivalFlightRecord: null,
        waitingFarewellDeboarding: false,
        deboardingAfterFarewellStarted: false,
        farewellSpeechStarted: false,
        farewellSpeechComplete: false,
        farewellDoorReady: false,
        pendingFarewellRecord: null,
        pendingFarewellReason: '',
        completionRecord: null,
        endDeboardingAnimationExpected: false,
        endDeboardingCompleted: false,
        endDeboardingCommandId: '',
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
    const bush = _activeBushMissionSpec();
    const homeLat = Number(bush?.homeRef?.lat);
    const homeLon = Number(bush?.homeRef?.lon);
    if (Number.isFinite(homeLat) && Number.isFinite(homeLon)) {
        return { lat: homeLat, lon: homeLon };
    }
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

function _missionSceneIsSarHeliMission() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (typeof window.missionIsSarHeliMission === 'function') {
        try { return !!window.missionIsSarHeliMission(md); } catch (_) {}
    }
    const contract = md?.missionContract || window.activeMissionContract || null;
    const ids = [
        md?._appliedProfile,
        md?._requestedProfile,
        md?.profileId,
        contract?.appliedProfileId,
        contract?.requestedProfileId,
        md?.sarHeli?.profileId,
        contract?.sarHeli?.profileId
    ].map(x => String(x || '').toLowerCase());
    return !!(md?.sarHeli?.enabled || contract?.sarHeli?.enabled || ids.includes('sar_heli'));
}
window.missionSceneIsSarHeliMission = _missionSceneIsSarHeliMission;

function _activeSarHeliSpec() {
    if (!_missionSceneIsSarHeliMission()) return null;
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const contract = md?.missionContract || window.activeMissionContract || null;
    const spec = md?.sarHeli || contract?.sarHeli || null;
    return spec && typeof spec === 'object' ? spec : null;
}

function _sarHeliInitialProgress() {
    if (typeof window.missionSarHeliInitialProgress === 'function') {
        try { return window.missionSarHeliInitialProgress(); } catch (_) {}
    }
    return {
        schema: 'sarHeliProgress.v1',
        status: 'enroute_search',
        targetConfirmed: false,
        markerSpawned: false,
        targetAreaEnteredAt: 0,
        holdReadyAnnounced: false,
        holdStartedAt: 0,
        holdSec: 0,
        patientLoaded: false,
        patientLoadedAt: 0,
        hospitalReached: false,
        readyToClose: false,
        lastUpdatedAt: Date.now()
    };
}

function _activeSarHeliProgress() {
    if (!_missionSceneIsSarHeliMission()) return null;
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (!md) return null;
    if (!md.sarHeliProgress || typeof md.sarHeliProgress !== 'object') {
        md.sarHeliProgress = _sarHeliInitialProgress();
    }
    return md.sarHeliProgress;
}

let sarHeliLastCheckpointAt = 0;
let sarHeliLastUiRefreshAt = 0;
let sarHeliLastProgressTickToken = '';

function _persistSarHeliProgress(next = null, reason = 'sar-heli-progress') {
    if (!_missionSceneIsSarHeliMission()) return null;
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    if (!md) return null;
    const prev = { ...(_activeSarHeliProgress() || _sarHeliInitialProgress()) };
    const now = Date.now();
    const progress = {
        ...prev,
        ...(next && typeof next === 'object' ? next : {}),
        lastUpdatedAt: now
    };
    md.sarHeliProgress = progress;
    if (md.missionContract && typeof md.missionContract === 'object') md.missionContract.sarHeliProgress = progress;
    if (window.activeMissionContract && typeof window.activeMissionContract === 'object') window.activeMissionContract.sarHeliProgress = progress;
    const statusChanged = String(prev.status || '') !== String(progress.status || '');
    const targetChanged = !!prev.targetConfirmed !== !!progress.targetConfirmed;
    const loadedChanged = !!prev.patientLoaded !== !!progress.patientLoaded;
    const readyChanged = !!prev.readyToClose !== !!progress.readyToClose;
    const semanticChange = statusChanged || targetChanged || loadedChanged || readyChanged;
    try {
        if (statusChanged || targetChanged || loadedChanged || readyChanged) {
            _missionPhaseDebugPush('sar_heli_progress', {
                from: String(prev.status || 'unknown'),
                to: String(progress.status || 'unknown'),
                trigger: reason,
                targetConfirmed: !!progress.targetConfirmed,
                holdReady: !!progress.holdReadyAnnounced,
                holdSec: Math.round(Number(progress.holdSec || 0)),
                patientLoaded: !!progress.patientLoaded,
                readyToClose: !!progress.readyToClose
            });
        }
    } catch (_) {}
    const highFrequencyHold = String(reason || '') === 'sar-heli-hold-progress';
    const checkpointDue = (now - sarHeliLastCheckpointAt) >= 1000;
    const shouldCheckpoint = semanticChange || !highFrequencyHold || checkpointDue;
    try {
        if (shouldCheckpoint) {
            sarHeliLastCheckpointAt = now;
            if (typeof window.missionPersistRuntimeSnapshot === 'function') {
                window.missionPersistRuntimeSnapshot(reason, semanticChange || !highFrequencyHold
                    ? { immediate: true }
                    : { minIntervalMs: 1000 });
            } else if (typeof window.debouncedSaveMissionState === 'function') window.debouncedSaveMissionState();
            else if (typeof saveMissionState === 'function') saveMissionState();
        }
    } catch (_) {}
    if (semanticChange || (now - sarHeliLastUiRefreshAt) >= 500) {
        sarHeliLastUiRefreshAt = now;
        try { _updateMissionRuntimeUi(); } catch (_) {}
    }
    return progress;
}

function _sarHeliTargetPoint() {
    const spec = _activeSarHeliSpec();
    const ref = spec?.targetRef || {};
    const lat = Number(ref.lat);
    const lon = Number(ref.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon, name: ref.name || 'Fundstelle' };
    const point = _targetPointForMission();
    return point ? { ...point, name: 'Fundstelle' } : null;
}

function _sarHeliHospitalPoint() {
    const spec = _activeSarHeliSpec();
    const ref = spec?.hospitalRef || {};
    const lat = Number(ref.lat);
    const lon = Number(ref.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon, name: ref.name || ref.icao || 'Krankenhaus-Helipad', ref };
}

function _sarHeliRecoveryGate(lat, lon, flightData = null) {
    const spec = _activeSarHeliSpec();
    const recovery = spec?.recovery || {};
    const target = _sarHeliTargetPoint();
    const curLat = Number(lat);
    const curLon = Number(lon);
    if (!target || !Number.isFinite(curLat) || !Number.isFinite(curLon)) return { ok: false, reason: 'no_target' };
    const dNm = _haversineNmLocal(curLat, curLon, target.lat, target.lon);
    const radiusNm = Math.max(0.03, Number(recovery.radiusNm || 0.12));
    const fd = flightData || window.lastLiveFlightData || {};
    const aglFt = Number(fd.aglFt ?? fd.agl ?? window.lastLiveGpsPos?.aglFt ?? window.lastLiveGpsPos?.agl ?? NaN);
    const gs = Number(fd.gs ?? fd.gsKts ?? fd.groundSpeed ?? window.lastLiveGpsPos?.gs ?? window.lastLiveGpsPos?.gsKts ?? 0);
    const vs = Number(fd.vsFpm ?? fd.verticalSpeedFpm ?? fd.vs ?? NaN);
    const onGround = typeof fd.onGround === 'boolean'
        ? !!fd.onGround
        : (Number.isFinite(aglFt) && aglFt <= 8 && gs <= 12);
    const close = Number.isFinite(dNm) && dNm <= radiusNm;
    const lowEnough = onGround || (Number.isFinite(aglFt) && aglFt <= Math.max(20, Number(recovery.maxAglFt || 33)));
    const slowEnough = gs <= Math.max(8, Number(recovery.maxGsKts || 18));
    const verticalStable = !Number.isFinite(vs) || Math.abs(vs) <= 450;
    return {
        ok: !!(close && lowEnough && slowEnough && verticalStable),
        close,
        lowEnough,
        slowEnough,
        verticalStable,
        onGround,
        hover: !onGround && lowEnough,
        dNm,
        aglFt: Number.isFinite(aglFt) ? aglFt : null,
        gs,
        radiusNm
    };
}

window.missionSarHeliProgressSnapshot = function() {
    const progress = _activeSarHeliProgress();
    return progress ? { ...progress } : null;
};

window.missionSarHeliConfirmTarget = function(reason = 'manual') {
    if (!_missionSceneIsSarHeliMission()) return false;
    const progress = _activeSarHeliProgress() || _sarHeliInitialProgress();
    if (progress.patientLoaded) return true;
    const wasConfirmed = !!progress.targetConfirmed;
    const next = _persistSarHeliProgress({
        ...progress,
        status: 'recovery_pending',
        targetConfirmed: true,
        targetConfirmedAt: progress.targetConfirmedAt || Date.now(),
        targetConfirmedReason: String(reason || 'manual')
    }, `sar-heli-confirm-${reason}`);
    if (!wasConfirmed) {
        try { window.triggerPaxSarHeliFoundConfirmed?.({ reason, progress: next }); } catch (_) {}
    }
    return true;
};

window.missionSarHeliSpawnTargetMarker = function(reason = 'sar-heli-auto-marker') {
    if (!_missionSceneIsSarHeliMission()) return false;
    const point = _missionTargetScenePoint({ allowMissingTerrain: true }) || _sarHeliTargetPoint();
    const sceneId = _missionTargetSceneId();
    if (!point || !sceneId || typeof window.sendTrackerCommand !== 'function') return false;
    const item = _missionTargetSceneItem(
        'sar_heli_signal_smoke',
        'Signalrauch / Fundmarkierung',
        MISSION_SCENE_SIGNAL_SMOKE_TITLE,
        MISSION_SCENE_ASSET_POOLS.smokeVfx,
        0,
        0,
        { hdgOffsetDeg: 0, altOffsetFt: MISSION_SCENE_SIGNAL_SMOKE_ALT_OFFSET_FT }
    );
    if (!item) return false;
    const commandId = window.sendTrackerCommand({
        type: 'mission_scene_object_spawn',
        sceneId,
        reason,
        targetSceneKind: _missionTargetSceneKind(),
        lat: point.lat,
        lon: point.lon,
        altFt: point.altFt || 0,
        hdg: point.hdg || 0,
        items: [item]
    });
    if (!commandId) return false;
    const progress = _activeSarHeliProgress() || _sarHeliInitialProgress();
    _persistSarHeliProgress({
        ...progress,
        markerSpawned: true,
        markerSpawnedAt: progress.markerSpawnedAt || Date.now(),
        targetConfirmed: true,
        targetConfirmedAt: progress.targetConfirmedAt || Date.now(),
        targetConfirmedReason: reason
    }, 'sar-heli-marker-spawned');
    return true;
};

window.missionSarHeliDespawnRecoverable = function(reason = 'sar-heli-patient-loaded') {
    if (!_missionSceneIsSarHeliMission()) return false;
    const spec = _activeSarHeliSpec();
    const kinds = Array.from(new Set([
        ...(Array.isArray(spec?.recoverableKinds) ? spec.recoverableKinds : []),
        'missing_person',
        'liferaft',
        'sar_heli_patient'
    ].filter(Boolean)));
    if (!kinds.length || typeof window.sendTrackerCommand !== 'function') return false;
    const sceneId = window.missionTargetSceneStatus?.sceneId || _missionTargetSceneId();
    const commandId = window.sendTrackerCommand({
        type: 'mission_scene_object_remove',
        sceneId,
        reason,
        kinds
    });
    return !!commandId;
};

function _sarHeliRouteWaypoint(ref = {}, nameFallback = 'WP', extra = {}) {
    const lat = Number(ref.lat);
    const lon = Number(ref.lon ?? ref.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
        lat,
        lng: lon,
        lon,
        name: String(ref.name || ref.icao || nameFallback),
        ...extra
    };
}

window.missionSarHeliRewriteRouteToHospital = function(reason = 'sar-heli-patient-loaded') {
    if (!_missionSceneIsSarHeliMission()) return false;
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const spec = _activeSarHeliSpec();
    const hospital = _sarHeliHospitalPoint();
    const target = _sarHeliTargetPoint();
    if (!md || !spec || !hospital || !target) return false;
    const currentRoute = _missionRuntimeRouteWaypoints() || [];
    const startAirport = (typeof globalAirports === 'object' && typeof currentStartICAO !== 'undefined')
        ? globalAirports[String(currentStartICAO || '').toUpperCase()]
        : null;
    const startWp = currentRoute[0] || _sarHeliRouteWaypoint({
        lat: md.initialStartLat || md.startLat || startAirport?.lat,
        lon: md.initialStartLon || md.startLon || startAirport?.lon,
        name: md.start || currentStartICAO || startAirport?.name || 'Start'
    }, 'Start');
    const targetWp = _sarHeliRouteWaypoint(spec.targetRef || target, `Fundstelle ${target.name || ''}`.trim(), { isPOI: true, isSarHeliIncident: true });
    const hospitalWp = _sarHeliRouteWaypoint(hospital.ref || hospital, hospital.name || 'Krankenhaus-Helipad', { isSarHeliHospital: true });
    if (!startWp || !targetWp || !hospitalWp) return false;
    const nextRoute = [startWp, targetWp, hospitalWp];
    try {
        routeWaypoints = JSON.parse(JSON.stringify(nextRoute));
        window._missionRouteWaypoints = JSON.parse(JSON.stringify(nextRoute));
        md.routeWaypoints = JSON.parse(JSON.stringify(nextRoute));
        md.missionRouteWaypoints = JSON.parse(JSON.stringify(nextRoute));
    } catch (_) {
        routeWaypoints = nextRoute;
        window._missionRouteWaypoints = nextRoute;
        md.routeWaypoints = nextRoute;
        md.missionRouteWaypoints = nextRoute;
    }
    md.dest = String(hospital.ref?.icao || 'HOSP').toUpperCase();
    md.targetName = hospital.name;
    md.targetLat = hospital.lat;
    md.targetLon = hospital.lon;
    md.sarHeli = { ...spec, routeRewritten: true };
    if (md.missionContract && typeof md.missionContract === 'object') md.missionContract.sarHeli = md.sarHeli;
    if (window.activeMissionContract && typeof window.activeMissionContract === 'object') window.activeMissionContract.sarHeli = md.sarHeli;
    if (typeof currentDestICAO !== 'undefined') currentDestICAO = md.dest;
    if (typeof currentDName !== 'undefined') currentDName = hospital.name;
    const destIcaoEl = document.getElementById('mDestICAO');
    const destNameEl = document.getElementById('mDestName');
    const destCoordsEl = document.getElementById('mDestCoords');
    const wikiDestNameEl = document.getElementById('wikiDestNameDisplay');
    if (destIcaoEl) destIcaoEl.innerText = md.dest || 'HOSP';
    if (destNameEl) destNameEl.innerText = hospital.name;
    if (destCoordsEl) destCoordsEl.innerText = `${hospital.lat.toFixed(4)}, ${hospital.lon.toFixed(4)}`;
    if (wikiDestNameEl) wikiDestNameEl.innerText = `${md.dest || 'HOSP'} - ${hospital.name}`;
    try { renderMainRoute?.(); } catch (_) {}
    try { updateMiniMap?.(); } catch (_) {}
    try { refreshGPSAfterDispatch?.(); } catch (_) {}
    try {
        if (typeof window.debouncedSaveMissionState === 'function') window.debouncedSaveMissionState();
        else if (typeof saveMissionState === 'function') saveMissionState();
    } catch (_) {}
    _persistSarHeliProgress({ ...(_activeSarHeliProgress() || {}), routeRewritten: true }, `sar-heli-route-rewrite-${reason}`);
    return true;
};

window.missionSarHeliGroundEndReady = function(endReady = null) {
    if (!_missionSceneIsSarHeliMission()) return false;
    const progress = _activeSarHeliProgress();
    if (!progress?.patientLoaded) return false;
    const hospital = _sarHeliHospitalPoint();
    const pos = window.lastLiveGpsPos || {};
    const lat = Number(pos.lat);
    const lon = Number(pos.lon);
    const ready = endReady && typeof endReady === 'object' ? endReady : _missionEndReadiness(lat, lon);
    if (!hospital || !ready?.groundStill || !Number.isFinite(lat) || !Number.isFinite(lon)) return false;
    const dHospitalNm = _haversineNmLocal(lat, lon, hospital.lat, hospital.lon);
    const atHospital = Number.isFinite(dHospitalNm) && dHospitalNm <= 0.35;
    if (atHospital && _missionHasReachedEndEligibleFlightPhase()) {
        if (!progress.readyToClose) {
            _persistSarHeliProgress({
                ...progress,
                status: 'ready_to_close',
                hospitalReached: true,
                readyToClose: true,
                hospitalReachedAt: progress.hospitalReachedAt || Date.now()
            }, 'sar-heli-hospital-ready');
        }
        return true;
    }
    return false;
};

window.missionSarHeliUpdateProgress = function(lat = null, lon = null, now = Date.now(), flightData = null) {
    if (!_missionSceneIsSarHeliMission()) return null;
    const progress = _activeSarHeliProgress() || _sarHeliInitialProgress();
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const missionKey = String(md?.id || md?.missionId || md?.generatedAt || 'sar-heli');
    const telemetryAt = Number(window.gaLastTrackerTelemetryAt || 0);
    const tickToken = `${missionKey}:${telemetryAt > 0 ? telemetryAt : Math.floor(Number(now || Date.now()) / 50)}`;
    if (tickToken === sarHeliLastProgressTickToken) return progress;
    sarHeliLastProgressTickToken = tickToken;
    if (progress.patientLoaded) {
        window.missionSarHeliGroundEndReady();
        return progress;
    }
    if (!progress.targetConfirmed) return progress;
    const gate = _sarHeliRecoveryGate(lat ?? window.lastLiveGpsPos?.lat, lon ?? window.lastLiveGpsPos?.lon, flightData);
    const requiredSec = Math.max(5, Number(_activeSarHeliSpec()?.recovery?.stableHoldSec || 20));
    if (gate.ok) {
        const holdStartedAt = Number(progress.holdStartedAt || 0) || now;
        const holdSec = Math.max(0, (now - holdStartedAt) / 1000);
        let next = {
            ...progress,
            status: 'recovery_holding',
            holdStartedAt,
            holdSec,
            recoveryGate: gate
        };
        if (!progress.holdReadyAnnounced) {
            next.holdReadyAnnounced = true;
            try { window.triggerPaxSarHeliHoldReady?.({ gate, requiredSec }); } catch (_) {}
        }
        if (holdSec >= requiredSec) {
            next = {
                ...next,
                status: 'hospital_leg',
                patientLoaded: true,
                patientLoadedAt: Date.now(),
                holdSec: requiredSec
            };
            _persistSarHeliProgress(next, 'sar-heli-patient-loaded');
            try { window.missionSarHeliDespawnRecoverable('sar-heli-patient-loaded'); } catch (_) {}
            try { window.missionSarHeliRewriteRouteToHospital('sar-heli-patient-loaded'); } catch (_) {}
            try { window.triggerPaxSarHeliPatientLoaded?.({ hospitalRef: _activeSarHeliSpec()?.hospitalRef || null }); } catch (_) {}
            return next;
        }
        return _persistSarHeliProgress(next, 'sar-heli-hold-progress');
    }
    if (progress.holdStartedAt || progress.holdSec) {
        return _persistSarHeliProgress({
            ...progress,
            status: 'recovery_pending',
            holdStartedAt: 0,
            holdSec: 0,
            recoveryGate: gate
        }, 'sar-heli-hold-reset');
    }
    return progress;
};

window.missionSarHeliHandlePoiTick = function(ctx = {}) {
    if (!_missionSceneIsSarHeliMission()) return false;
    const now = Number(ctx.now || Date.now());
    const progress = _activeSarHeliProgress() || _sarHeliInitialProgress();
    if (progress.patientLoaded) return true;
    const inRadius = !!ctx.inRadius;
    if (inRadius && !progress.targetAreaEnteredAt) {
        _persistSarHeliProgress({ ...progress, targetAreaEnteredAt: now, status: 'target_area' }, 'sar-heli-target-area');
    } else if (!inRadius && progress.targetAreaEnteredAt && !progress.targetConfirmed) {
        _persistSarHeliProgress({ ...progress, targetAreaEnteredAt: 0, status: 'enroute_search' }, 'sar-heli-target-area-exit');
    }
    const latest = _activeSarHeliProgress() || progress;
    const autoMarkAfterSec = Math.max(10, Number(_activeSarHeliSpec()?.recovery?.autoMarkAfterSec || 60));
    const enteredAt = Number(latest.targetAreaEnteredAt || 0);
    if (inRadius && !latest.targetConfirmed && enteredAt && (now - enteredAt) >= autoMarkAfterSec * 1000) {
        const marked = window.missionSarHeliSpawnTargetMarker('sar-heli-auto-marker');
        if (!marked) window.missionSarHeliConfirmTarget('sar-heli-auto-marker');
        try { window.triggerPaxSarHeliTargetMarked?.({ distNm: ctx.distNm }); } catch (_) {}
    }
    window.missionSarHeliUpdateProgress(ctx.lat, ctx.lon, now, ctx.flightData || null);
    return true;
};

function _isAtMissionHome(lat, lon, thresholdNm = 0.35) {
    const dNm = _distanceToMissionHomeNm(lat, lon);
    return Number.isFinite(dNm) ? dNm <= thresholdNm : false;
}

function _restoreBushPickupOutboundRuntimeState() {
    const md = (typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null;
    const bush = md?.bush;
    if (!bush || String(bush.targetMode || '') !== 'strip_then_return') return false;
    if (typeof buildInitialBushMissionProgress === 'function') {
        try { _persistBushMissionProgress(buildInitialBushMissionProgress(bush)); } catch (_) {}
    }
    const originalRoute = Array.isArray(md?.missionRouteWaypoints) && md.missionRouteWaypoints.length >= 2
        ? JSON.parse(JSON.stringify(md.missionRouteWaypoints))
        : null;
    if (originalRoute) {
        routeWaypoints = JSON.parse(JSON.stringify(originalRoute));
        window._missionRouteWaypoints = JSON.parse(JSON.stringify(originalRoute));
        md.routeWaypoints = JSON.parse(JSON.stringify(originalRoute));
    }
    const targetIcao = String(md?.initialDest || bush?.targetRef?.icao || '').trim().toUpperCase();
    const targetName = String(md?.initialTargetName || bush?.targetRef?.name || md?.targetName || '').trim();
    const targetLat = Number(md?.initialTargetLat ?? bush?.targetRef?.lat ?? md?.targetLat);
    const targetLon = Number(md?.initialTargetLon ?? bush?.targetRef?.lon ?? md?.targetLon);
    if (targetIcao) {
        md.dest = targetIcao;
        if (typeof currentDestICAO !== 'undefined') currentDestICAO = targetIcao;
    }
    if (targetName) md.targetName = targetName;
    if (Number.isFinite(targetLat)) md.targetLat = targetLat;
    if (Number.isFinite(targetLon)) md.targetLon = targetLon;
    if (Number.isFinite(Number(md?.initialDist))) md.dist = Number(md.initialDist);
    if (Number.isFinite(Number(md?.initialHeading))) md.heading = Number(md.initialHeading);
    if (targetName && typeof currentDName !== 'undefined') currentDName = targetName;
    const initialPaxText = String(md?.initialPaxText || md?.paxText || '').trim();
    if (initialPaxText) {
        md.paxText = initialPaxText;
        if (md.missionContract && typeof md.missionContract === 'object') md.missionContract.paxText = initialPaxText;
        if (window.activeMissionContract && typeof window.activeMissionContract === 'object') window.activeMissionContract.paxText = initialPaxText;
    }
    const destIcaoEl = document.getElementById('mDestICAO');
    const destNameEl = document.getElementById('mDestName');
    const destCoordsEl = document.getElementById('mDestCoords');
    const wikiDestNameEl = document.getElementById('wikiDestNameDisplay');
    const wikiDestDescEl = document.getElementById('wikiDestDescText');
    const wikiDestFreqEl = document.getElementById('wikiDestFreqText');
    const payEl = document.getElementById('mPay');
    if (destIcaoEl && targetIcao) destIcaoEl.innerText = targetIcao;
    if (destNameEl && targetName) destNameEl.innerText = targetName;
    if (destCoordsEl && Number.isFinite(targetLat) && Number.isFinite(targetLon)) {
        destCoordsEl.innerText = `${targetLat.toFixed(4)}, ${targetLon.toFixed(4)}`;
    }
    if (wikiDestNameEl && targetIcao && targetName) wikiDestNameEl.innerText = `${targetIcao} – ${targetName}`;
    if (wikiDestDescEl) wikiDestDescEl.innerText = 'Lade Ziel-Info...';
    if (wikiDestFreqEl) wikiDestFreqEl.innerHTML = '';
    if (payEl && initialPaxText) payEl.innerText = initialPaxText;
    window.activePassenger = null;
    try { localStorage.setItem('ga_active_passenger', ''); } catch (_) {}
    try { window.paxVoiceRefreshWidget?.(); } catch (_) {}
    try { renderMainRoute?.(); } catch (_) {}
    try { updateMiniMap?.(); } catch (_) {}
    try { refreshGPSAfterDispatch?.(); } catch (_) {}
    if (Number.isFinite(targetLat) && Number.isFinite(targetLon) && targetIcao) {
        try { fetchAreaDescription?.(targetLat, targetLon, 'wikiDestDescText', null, targetIcao, 'wikiDestImageContainer', 'wikiDestImage'); } catch (_) {}
        try { fetchAirportFreq?.(targetIcao, 'wikiDestFreqText', 'dest'); } catch (_) {}
    }
    try {
        if (typeof window.debouncedSaveMissionState === 'function') window.debouncedSaveMissionState();
        else if (typeof saveMissionState === 'function') saveMissionState();
    } catch (_) {}
    return true;
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
    if (window.simModeActive && window.simHadMeaningfulAirbornePhase === true) return true;
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
    const poiRecipeId = (typeof window.missionPoiRecipeId === 'function')
        ? String(window.missionPoiRecipeId((typeof currentMissionData !== 'undefined' && currentMissionData) ? currentMissionData : null) || '').trim().toLowerCase()
        : '';
    if (poiRecipeId === 'poi_sar_heli' || _missionSceneIsSarHeliMission()) {
        const sar = _activeSarHeliProgress();
        const spec = _activeSarHeliSpec();
        const hospitalName = String(spec?.hospitalRef?.name || 'Krankenhaus-Helipad').trim();
        if (!sar?.targetConfirmed) {
            return {
                stage: 'sar_heli_search',
                detail: 'SAR-Heli: Fundstelle noch nicht bestaetigt.',
                nextStep: 'Nächster Schritt: Zielgebiet anfliegen, Fund melden oder nach 60s automatisch markieren lassen'
            };
        }
        if (!sar?.patientLoaded) {
            return {
                stage: 'sar_heli_recovery',
                detail: `SAR-Heli: Bergung offen. Aufnahmephase läuft.`,
                nextStep: 'Nächster Schritt: landen oder langsam und stabil über der Fundstelle halten'
            };
        }
        if (canEndHere || sar?.readyToClose) {
            return {
                stage: 'sar_heli_ready',
                detail: `SAR-Heli: Patient am medizinischen Ziel ${hospitalName} uebergeben.`,
                nextStep: 'Nächster Schritt: Mission beenden'
            };
        }
        return {
            stage: 'sar_heli_hospital_leg',
            detail: `SAR-Heli: Patient aufgenommen. Medizinisches Ziel: ${hospitalName}.`,
            nextStep: 'Nächster Schritt: Krankenhaus-Helipad/Fallback-Ziel anfliegen, landen und stoppen'
        };
    }
    const taskDomain = String(window.activePassenger?.taskDomain || currentMissionData?.missionContract?.taskDomain || '').toLowerCase();
    if (/^(training|club_training_basic|club_training_advanced)$/.test(taskDomain) || progress?.trainingProcedure) {
        const training = progress?.trainingProcedure || null;
        let recipe = null;
        try {
            recipe = typeof window.missionTrainingProcedure?.getActiveRecipe === 'function'
                ? window.missionTrainingProcedure.getActiveRecipe(currentMissionData, window.activePassenger || null)
                : null;
        } catch (_) {
            recipe = null;
        }
        const total = Math.max(1, Number(training?.totalExercises || recipe?.exercises?.length || 0) || 1);
        const required = Math.max(1, Math.min(total, Number(training?.requiredCount || recipe?.requiredCount || 2) || 2));
        const done = Math.max(0, Number(training?.completedCount || 0));
        const ready = !!training?.ready;
        const readyPrompted = !!training?.readyPrompted;
        const activeLabel = String(training?.activeExercise?.label || recipe?.exercises?.[Math.max(0, Number(training?.activeIndex || 0) || 0)]?.label || '').trim();
        const optionalLeft = Math.max(0, total - Math.max(required, done));
        let detail = '';
        let nextStep = '';
        if (training?.requiredComplete) {
            detail = `Training Pflichtteil abgeschlossen. Pflichtuebungen: ${Math.min(done, required)}/${required}${optionalLeft ? `, optionale Uebungen offen: ${optionalLeft}` : ''}.`;
            nextStep = optionalLeft
                ? 'Nächster Schritt: Rückkehr fortsetzen oder per Pax-Fenster eine Zusatzuebung anfragen'
                : 'Nächster Schritt: Landung/Heimflug fortsetzen und Debriefing nach der Landung abholen';
        } else if (!ready) {
            detail = readyPrompted
                ? `Trainingshoehe erreicht. Pflichtuebungen offen: ${Math.min(done, required)}/${required}.`
                : `Training wartet auf passende Trainingshoehe. Pflichtuebungen offen: ${Math.min(done, required)}/${required}.`;
            nextStep = readyPrompted
                ? 'Nächster Schritt: im Pax-Fenster "Bereit für Übung" drücken, wenn die Maschine stabil ist'
                : 'Nächster Schritt: zur Trainingshoehe steigen und Instruktor-Freigabe abwarten';
        } else {
            detail = `Training offen. Pflichtuebungen abgeschlossen: ${Math.min(done, required)}/${required}${activeLabel ? `, aktuell: ${activeLabel}` : ''}.`;
            nextStep = activeLabel
                ? `Nächster Schritt: Trainingsuebung fliegen: ${activeLabel}`
                : 'Nächster Schritt: auf die Instruktor-Ansage warten und Uebung stabil beginnen';
        }
        return {
            stage: training?.requiredComplete ? 'training_complete' : (ready ? 'training_working' : 'training_ready_waiting'),
            detail,
            nextStep
        };
    }
    if (progress?.poiChain || currentMissionData?.missionSubType === 'poi_chain' || currentMissionData?.poiChain) {
        const chain = progress?.poiChain || null;
        let spec = null;
        try {
            spec = typeof window.missionPoiChainRuntime?.getActiveSpec === 'function'
                ? window.missionPoiChainRuntime.getActiveSpec(currentMissionData, window.activePassenger || null)
                : null;
        } catch (_) {
            spec = null;
        }
        const total = Array.isArray(spec?.points) ? spec.points.filter(point => point?.required !== false).length : Math.max(1, Number(currentMissionData?.poiChain?.points?.length || 0) || 1);
        const done = Array.isArray(chain?.completedPointIds) ? chain.completedPointIds.length : 0;
        const nextPoint = Array.isArray(spec?.points) ? spec.points[Math.max(0, Number(chain?.currentIndex || 0) || 0)] : null;
        const detail = chain?.satisfied
            ? `Infrastruktur-Kette erfüllt. Alle ${total} Punkte sind abgeschlossen.`
            : `Infrastruktur-Kette offen. Punkte abgeschlossen: ${done}/${total}.`;
        return {
            stage: chain?.satisfied ? 'poi_chain_complete' : 'poi_chain_working',
            detail,
            nextStep: chain?.satisfied
                ? 'Nächster Schritt: Rueckflug zum Heimatplatz, landen und Mission beenden'
                : (nextPoint?.name
                    ? `Nächster Schritt: nächsten markierten Punkt anfliegen: ${nextPoint.name}`
                    : 'Nächster Schritt: nächsten markierten Kettenpunkt anfliegen')
        };
    }
    if (taskDomain === 'mapping_survey') {
        const survey = progress?.surveyPattern || null;
        let spec = null;
        try {
            spec = typeof window.missionSurveyPattern?.getActiveSpec === 'function'
                ? window.missionSurveyPattern.getActiveSpec(currentMissionData, window.activePassenger || null)
                : null;
        } catch (_) {
            spec = null;
        }
        const scanTotal = Array.isArray(spec?.scan?.lines) ? spec.scan.lines.length : Math.max(1, Number(spec?.scan?.lineCount || 0) || 1);
        const scanDone = Array.isArray(survey?.scan?.completedLineIds) ? survey.scan.completedLineIds.length : 0;
        const orbitTotal = Math.max(1, Number(spec?.orbit?.requiredTurns || 3));
        const orbitDone = Math.max(0, Number(survey?.orbit?.completedTurns || 0));
        const isOrbit = String(spec?.type || '').toLowerCase() === 'orbit';
        const detail = survey?.satisfied
            ? 'Mapping/Survey erfüllt. Alle geforderten Pattern-Segmente sind abgeschlossen.'
            : (isOrbit
                ? `Mapping/Survey offen. Kreise abgeschlossen: ${orbitDone}/${orbitTotal}.`
                : `Mapping/Survey offen. Linien abgeschlossen: ${scanDone}/${scanTotal}.`);
        return {
            stage: survey?.satisfied ? 'survey_complete' : 'survey_working',
            detail,
            nextStep: survey?.satisfied
                ? 'Nächster Schritt: Rueckflug zum Heimatplatz, landen und Mission beenden'
                : (survey?.startedAt
                    ? 'Nächster Schritt: offene rote Linie sauber abfliegen, grüne Linien gelten als erledigt'
                    : 'Nächster Schritt: markiertes Survey-Pattern anfliegen und an einem Linienende beginnen')
        };
    }
    const taskLabel = poiRecipeId === 'poi_on_task_return'
        ? 'Recon-/Arbeitsauftrag im Zielgebiet'
        : (poiRecipeId === 'poi_fire_watch'
            ? 'Feuerbeobachtung'
            : (poiRecipeId === 'poi_search_and_rescue'
                ? 'Suchauftrag'
                : (poiRecipeId === 'poi_training'
                    ? 'Trainingsaufgabe'
                    : (poiRecipeId === 'poi_flyover'
                        ? 'Flyover-Auftrag'
                        : 'POI-Auftrag'))));
    if (!progress?.hasSignal || !progress?.trackingActive) {
        return {
            stage: 'unknown',
            detail: `${taskLabel}-Status noch nicht sicher verfügbar.`,
            nextStep: canEndHere
                ? (endedAtHome ? 'Nächster Schritt: Mission beenden' : 'Nächster Schritt: Mission hier beenden oder Heimflug fortsetzen')
                : `Nächster Schritt: Zielgebiet anfliegen und ${taskLabel.toLowerCase()} erfuellen`
        };
    }
    if (progress.aborted) {
        return {
            stage: 'failed',
            detail: `${taskLabel} fehlgeschlagen.`,
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
                    ? `${taskLabel} erfüllt. Du bist zurück am Startplatz.`
                    : `${taskLabel} erfüllt. Ausweichlandung erkannt.`,
                nextStep: endedAtHome
                    ? 'Nächster Schritt: Mission regulär beenden'
                    : 'Nächster Schritt: Mission hier beenden oder Pax später heimfliegen'
            };
        }
        return {
            stage: 'return_leg',
            detail: endedAtHome
                ? `${taskLabel} erfüllt. Startplatz erreicht, aber noch nicht im End-Gate.`
                : `${taskLabel} erfüllt. Rueckflugphase oder freie Landung zum Missionsende.`,
            nextStep: 'Nächster Schritt: Landen, stoppen und Mission beenden'
        };
    }
    const dwellSec = Number.isFinite(Number(progress.dwellSec)) ? Number(progress.dwellSec) : 0;
    const attempts = Number.isFinite(Number(progress.attempts)) ? Number(progress.attempts) : 0;
    const workingDetail = poiRecipeId === 'poi_flyover'
        ? 'Flyover noch offen. Zielgebiet sauber anfliegen und den Ueberflug bestaetigen.'
        : `${taskLabel} noch offen. Arbeitszeit im Zielgebiet: ${Math.round(dwellSec)}s${attempts > 0 ? ` · Hinweise: ${attempts}` : ''}.`;
    return {
        stage: 'working',
        detail: workingDetail,
        nextStep: canEndHere
            ? 'Nächster Schritt: Mission beenden'
            : `Nächster Schritt: ${taskLabel} sauber erfuellen und danach landen`
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

let bushProgressLastCheckpointAt = 0;
let bushProgressLastMissionKey = '';

function _persistBushMissionProgress(progress = null) {
    if (!progress || typeof progress !== 'object') return null;
    if (typeof currentMissionData === 'undefined' || !currentMissionData || typeof currentMissionData !== 'object') return null;
    const prev = currentMissionData.bushProgress && typeof currentMissionData.bushProgress === 'object'
        ? currentMissionData.bushProgress
        : null;
    currentMissionData.bushProgress = { ...progress };
    const prevStatus = String(prev?.status || '');
    const nextStatus = String(progress?.status || '');
    const semanticChange = !!(
        prevStatus !== nextStatus
        || !!prev?.pickupReady !== !!progress?.pickupReady
        || !!prev?.pickupCompleted !== !!progress?.pickupCompleted
        || !!prev?.pickupConfirmed !== !!progress?.pickupConfirmed
        || !!prev?.targetReached !== !!progress?.targetReached
        || !!prev?.areaQualified !== !!progress?.areaQualified
        || !!prev?.groundStopQualified !== !!progress?.groundStopQualified
        || !!prev?.returnHomeQualified !== !!progress?.returnHomeQualified
        || !!prev?.cargoDelivered !== !!progress?.cargoDelivered
        || !!prev?.passengerDropped !== !!progress?.passengerDropped
    );
    if (semanticChange) {
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
    const missionKey = String(currentMissionData?.id || currentMissionData?.missionId || currentMissionData?.generatedAt || 'bush');
    if (missionKey !== bushProgressLastMissionKey) {
        bushProgressLastMissionKey = missionKey;
        bushProgressLastCheckpointAt = 0;
    }
    const now = Date.now();
    const checkpointDue = (now - bushProgressLastCheckpointAt) >= 1000;
    if (semanticChange || checkpointDue) {
        bushProgressLastCheckpointAt = now;
        try {
            if (typeof window.debouncedSaveMissionState === 'function') window.debouncedSaveMissionState();
            else if (typeof saveMissionState === 'function') saveMissionState();
        } catch (_) {}
        _persistMissionRuntimeSnapshot('bush-progress', semanticChange ? { immediate: true } : { minIntervalMs: 1000 });
    }
    return currentMissionData.bushProgress;
}

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
// Runtime-/Bush-/Ground-Action-Kernlogik lebt ab hier in mission-runtime-core.js.

window.missionRuntimeReset = function(options = {}) {
    if (options?.complianceReleased !== true && options?.forceComplianceReset !== true && window.missionComplianceBlockReset?.()) {
        _missionPhaseDebugPush('runtime_reset_blocked', {
            reason: options?.reason || 'mission-runtime-reset',
            block: 'authority-inspection'
        });
        try { alert('Die laufende Behoerdenkontrolle muss zuerst abgeschlossen werden.'); } catch (_) {}
        _updateMissionRuntimeUi();
        return false;
    }
    if (_trackerSupportsMissionAuthority()
        && window.missionRuntimeResumeConflict?.trackerActive === true
        && (!_readMissionAuthorityState()?.runId || _readMissionAuthorityState()?.runId !== window.missionRuntimeResumeConflict?.trackerRunId)) {
        _missionPhaseDebugPush('runtime_reset_blocked', {
            reason: options?.reason || 'mission-runtime-reset',
            block: 'foreign-tracker-authority',
            trackerMissionId: window.missionRuntimeResumeConflict?.trackerMissionId || null
        });
        try { alert('Auf dem Tracker läuft eine andere Missionsinstanz. Übernimm sie zuerst auf dieses Gerät oder beende sie auf dem derzeit führenden Gerät.'); } catch (_) {}
        _updateMissionRuntimeUi();
        return false;
    }
    _missionPhaseDebugPush('runtime_reset', {
        reason: options?.reason || 'mission-runtime-reset',
        respawnAfterClear: options?.respawnAfterClear === true,
        runtimePhase: _missionRuntimePhaseSnapshot(),
        startPhase: _missionStartPhase(),
        runtimeActive: !!missionRuntime.active,
        trackerConnected: !!window.liveTrackerConnected,
        sceneId: window.missionSceneStatus?.sceneId || null,
        sceneSpawned: !!window.missionSceneStatus?.spawned,
        boardingPreparing: !!window.missionSceneStatus?.boardingPreparing,
        boardingRequested: !!window.missionSceneStatus?.boardingRequested,
        boardingActive: !!window.missionSceneStatus?.boardingActive,
        boardingComplete: !!window.missionSceneStatus?.boardingComplete,
        personBoarded: !!window.missionSceneStatus?.personBoarded,
        lastCommand: window.missionSceneStatus?.lastCommand || null,
        lastAck: window.missionSceneStatus?.lastAck || null
    });
    if (window.missionSceneStatus?.deboardingRequested || window.missionSceneStatus?.deboardingActive) {
        try { window.missionSceneCancelDeboarding?.('mission-runtime-reset'); } catch (_) {}
    }
    _missionSceneClearDeboardingWatchdog();
    missionInterruptedDeboardingRecovery = null;
    missionSceneIgnoredBoardingCommandIds.clear();
    _restoreBushPickupOutboundRuntimeState();
    const respawnAfterClear = options && options.respawnAfterClear === true;
    if (!window.simModeActive && !window.liveTrackerConnected) missionSceneReconnectResyncPending = true;
    if (!window.simModeActive && window.liveTrackerConnected) missionSceneReconnectResyncPending = false;
    const resetReason = options?.reason || 'mission-runtime-reset';
    const authorityReleaseRequested = _releaseMissionAuthority(options?.authorityOutcome || 'reset', resetReason);
    if (!authorityReleaseRequested) _sendMissionLifecycleToTracker('ended', resetReason);
    if (typeof window.closeMissionCargoDialog === 'function') window.closeMissionCargoDialog();
    if (typeof window.paxVoiceResetMission === 'function') {
        try { window.paxVoiceResetMission(); } catch (_) {}
    }
    if (typeof _missionCargoResetForMissionReset === 'function') {
        _missionCargoResetForMissionReset('mission-runtime-reset').catch(err => {
            console.warn('[MissionCargo] Reset payload sync failed:', err?.message || err);
        });
    }
    if (!authorityReleaseRequested) {
        if (typeof window.missionSmokeClear === 'function') window.missionSmokeClear(resetReason);
        if (typeof window.clearMissionSceneObjects === 'function') window.clearMissionSceneObjects(resetReason);
        else if (typeof window.missionSceneClear === 'function') window.missionSceneClear(resetReason);
    }
    _clearMissionStartPhase();
    _clearActiveMissionRuntimeMarker('mission-runtime-reset');
    Object.assign(window.missionSceneStatus, {
        spawned: false,
        spawnedCount: 0,
        lastSpawnFailedAt: 0,
        spawnRequested: false,
        clearRequested: false,
        boardingPreparing: false,
        boardingRequested: false,
        boardingActive: false,
        boardingComplete: false,
        boardingError: null,
        boardingCueCommandId: '',
        boardingVoiceComplete: false,
        deboardingRequested: false,
        deboardingActive: false,
        deboardingComplete: false,
        deboardingError: null,
        deboardingCommandId: '',
        deboardingCueCommandId: '',
        manualPaxRequested: false,
        manualPaxActive: false,
        manualPaxError: null,
        personBoarded: false,
        autoSpawnedFor: null,
        autoClearedFor: null,
        respawnAfterClear,
        respawnAfterClearReason: respawnAfterClear ? 'mission-runtime-reset' : ''
    });
    Object.assign(window.missionTargetSceneStatus, {
        sceneId: null,
        kind: null,
        spawned: false,
        spawnedCount: 0,
        lastSpawnFailedAt: 0,
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
        lastSpawnFailedAt: 0,
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
    _clearMissionRuntimeSnapshot('mission-runtime-reset');
    missionSceneBoardingCuePlayback = null;
    missionSceneDeboardingCuePlayback = null;
    if (respawnAfterClear) {
        setTimeout(() => {
            if (window.missionSceneStatus?.respawnAfterClear) {
                window.missionSceneStatus.respawnAfterClear = false;
                window.missionSceneStatus.respawnAfterClearReason = '';
                _missionSceneHandleFlightTick(window.lastLiveFlightData || {}, 'mission-runtime-reset-fallback-respawn');
            }
        }, 2200);
    }
    return true;
};

window.startMissionBoarding = async function() {
    _missionPhaseDebugPush('start_boarding_attempt', {
        reusedPromise: !!missionStartBoardingPromise,
        runtimeActive: !!missionRuntime.active,
        runtimePhase: _missionRuntimePhaseSnapshot(),
        startPhase: _missionStartPhase(),
        trackerConnected: !!window.liveTrackerConnected,
        simMode: !!window.simModeActive,
        ground: _missionStartGroundStatus(),
        paxCount: typeof _missionScenePaxCount === 'function' ? _missionScenePaxCount() : null,
        scene: {
            spawned: !!window.missionSceneStatus?.spawned,
            preparing: !!window.missionSceneStatus?.boardingPreparing,
            requested: !!window.missionSceneStatus?.boardingRequested,
            active: !!window.missionSceneStatus?.boardingActive,
            complete: !!window.missionSceneStatus?.boardingComplete,
            personBoarded: !!window.missionSceneStatus?.personBoarded
        }
    });
    if (missionStartBoardingPromise) return missionStartBoardingPromise;
    if (typeof window.paxVoiceUnlockAudio === 'function') {
        try { window.paxVoiceUnlockAudio('boarding-click'); } catch (_) {}
    }
    if (missionRuntime.active) {
        _missionPhaseDebugPush('start_boarding_blocked', { reason: 'runtime_active' });
        return true;
    }
    if (!window.simModeActive && (window.missionSceneStatus?.boardingPreparing || window.missionSceneStatus?.boardingRequested || window.missionSceneStatus?.boardingActive || missionSceneBoardingPromise)) {
        _missionPhaseDebugPush('start_boarding_blocked', { reason: 'boarding_busy' });
        _updateMissionRuntimeUi();
        return true;
    }
    if (_missionStartPhase() === 'boarding' && window.missionSceneStatus?.boardingComplete) {
        _missionPhaseDebugPush('start_boarding_blocked', { reason: 'already_complete_open_cargo' });
        if (window.simModeActive) {
            try { window.missionCargoStageSimEquipmentAtAircraft?.('sim-boarding-reopen'); } catch (_) {}
        }
        window.openMissionCargoDialog?.('load');
        _updateMissionRuntimeUi();
        return true;
    }
    if (!_hasValidMissionForStart() || !_missionStartGroundReady()) {
        _missionPhaseDebugPush('start_boarding_blocked', {
            reason: !_hasValidMissionForStart() ? 'invalid_mission' : 'ground_not_ready',
            ground: _missionStartGroundStatus()
        });
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
            const hasBoardingPassenger = typeof _missionScenePaxCount === 'function' && _missionScenePaxCount() > 0;
            window.missionSceneStatus.boardingVoiceComplete = false;
            if (typeof window.paxVoicePrepareBoarding === 'function') {
                try { window.paxVoicePrepareBoarding(); } catch (_) {}
            }
            if (hasBoardingPassenger) {
                _missionScenePrepareBoardingCue();
                _missionScenePrepareDeboardingCue();
            }
            let boardingPromise = null;
            if (!window.simModeActive && hasBoardingPassenger && typeof window.missionSceneBoarding === 'function') {
                try {
                    boardingPromise = window.missionSceneBoarding('boarding-click');
                } catch (err) {
                    console.warn('Boarding animation konnte nicht gestartet werden:', err);
                }
            } else {
                Object.assign(window.missionSceneStatus, {
                    boardingPreparing: false,
                    boardingRequested: false,
                    boardingActive: false,
                    boardingComplete: true,
                    boardingError: null,
                    personBoarded: !!hasBoardingPassenger
                });
                try { window.missionCargoStageSimEquipmentAtAircraft?.('sim-boarding-start'); } catch (_) {}
                if (hasBoardingPassenger && typeof _missionCargoMarkPassengerLoaded === 'function') {
                    _missionCargoMarkPassengerLoaded({ reason: 'boarding-sim-passenger-sync', playAudioCue: false });
                }
            }
            if (typeof window.openMissionCargoDialog === 'function') {
                try { window.openMissionCargoDialog('load'); } catch (_) {}
            }
            const playBoardingReminder = async (options = {}) => {
                if (typeof window.paxVoicePlayBoarding !== 'function') return false;
                try {
                    return !!(await window.paxVoicePlayBoarding(options));
                } catch (_) {
                    return false;
                }
            };
            if (boardingPromise) {
                let ack = null;
                try {
                    ack = await boardingPromise;
                } catch (err) {
                    console.warn('Boarding animation fehlgeschlagen:', err);
                }
                if (!ack || ack.status !== 'ok') {
                    const error = ack?.error || ack?.status || 'boarding_not_confirmed';
                    _missionPhaseDebugPush('start_boarding_failed', {
                        commandId: ack?.commandId || null,
                        status: ack?.status || 'missing_ack',
                        error
                    });
                    console.warn('Boarding animation nicht bestätigt:', ack?.status || 'missing_ack', error);
                    window.missionCargoStatus.error = `Boarding fehlgeschlagen: ${error}. Bitte erneut starten.`;
                    _missionSceneResetBoardingState(error, { rollbackStartPhase: true, recoverScene: true });
                    if (document.getElementById('missionCargoOverlay')?.style.display === 'flex') {
                        _missionCargoRenderDialog('load', { skipPayloadRefresh: true });
                    }
                    return false;
                }
            }
            let stagedCuePlayed = false;
            if (hasBoardingPassenger
                && missionSceneBoardingCuePlayback?.promise
                && String(missionSceneBoardingCuePlayback.commandId || '') === String(window.missionSceneStatus?.boardingCueCommandId || '')) {
                stagedCuePlayed = await _missionSceneAwaitCuePlayback(missionSceneBoardingCuePlayback);
            }
            await playBoardingReminder({ playCue: hasBoardingPassenger && !stagedCuePlayed });
            window.missionSceneStatus.boardingVoiceComplete = true;
            _missionPhaseDebugPush('start_boarding_complete', {
                sceneId: window.missionSceneStatus?.sceneId || null,
                commandId: window.missionSceneStatus?.lastCommand?.commandId || null,
                hasBoardingPassenger,
                personBoarded: !!window.missionSceneStatus?.personBoarded,
                boardingComplete: !!window.missionSceneStatus?.boardingComplete,
                boardingVoiceComplete: true,
                startPhase: _missionStartPhase(),
                runtimePhase: _missionRuntimePhaseSnapshot()
            });
            missionSceneBoardingCuePlayback = null;
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
    _missionPhaseDebugPush('mission_start_attempt', {
        runtimePhase: _missionRuntimePhaseSnapshot(),
        startPhase: _missionStartPhase(),
        personBoarded: !!window.missionSceneStatus?.personBoarded,
        boardingComplete: !!window.missionSceneStatus?.boardingComplete,
        boardingVoiceComplete: !!window.missionSceneStatus?.boardingVoiceComplete,
        boardedPaxCount: typeof _missionCargoBoardedPaxCount === 'function' ? _missionCargoBoardedPaxCount() : null,
        hasActivePassenger: !!window.activePassenger
    });
    if (typeof window.paxVoiceUnlockAudio === 'function') {
        try { window.paxVoiceUnlockAudio('mission-start-click'); } catch (_) {}
    }
    if (_missionRuntimePhaseSnapshot() !== 'boarded') {
        _missionPhaseDebugPush('mission_start_blocked', {
            reason: 'runtime_phase_not_boarded',
            runtimePhase: _missionRuntimePhaseSnapshot(),
            startPhase: _missionStartPhase()
        });
        _updateMissionRuntimeUi();
        return false;
    }
    _setMissionStartPhase('boarded');
    missionRuntime.phase = 'active';
    if (!missionRuntime.startedAt) missionRuntime.startedAt = Date.now();
    missionRuntime.armed = true;
    missionRuntime.active = true;
    missionRuntime.manual = true;
    missionRuntime.readySince = 0;
    missionRuntime.pendingEndAt = 0;
    missionRuntime.lastOffDestAt = 0;
    missionRuntime.landingRollTriggered = false;
    missionRuntime.arrivalFarewellTriggered = false;
    missionRuntime.farewellPreloadRequestedAt = 0;
    missionRuntime.arrivalFlightRecord = null;
    missionRuntime.waitingFarewellDeboarding = false;
    missionRuntime.deboardingAfterFarewellStarted = false;
    missionRuntime.farewellSpeechStarted = false;
    missionRuntime.farewellSpeechComplete = false;
    missionRuntime.farewellDoorReady = false;
    missionRuntime.pendingFarewellRecord = null;
    missionRuntime.pendingFarewellReason = '';
    missionRuntime.endDeboardingAnimationExpected = false;
    missionRuntime.endDeboardingCompleted = false;
    missionRuntime.endDeboardingCommandId = '';
    missionRuntime.endReadinessKey = '';
    if (window.missionCargoStatus) window.missionCargoStatus.arrivalAutoOpenedFor = '';
    let missionStartVoiceState = null;
    try {
        const voice = typeof window.paxVoiceGetDebugState === 'function' ? window.paxVoiceGetDebugState() : null;
        if (voice) {
            missionStartVoiceState = {
                voiceEnabled: !!voice.voiceEnabled,
                audioEffectsEnabled: !!voice.audioEffectsEnabled,
                hasApiKey: !!voice.hasApiKey,
                hasPassenger: !!voice.hasPassenger,
                passengerName: voice.passengerName || null,
                audioContextState: voice.audioContextState || null,
                masterGain: voice.masterGain ?? null,
                missionEpoch: voice.missionEpoch ?? null,
                boardingDone: !!voice.boardingDone,
                greetingDone: !!voice.greetingDone
            };
        }
    } catch (_) {}
    _missionPhaseDebugPush('mission_start_active', {
        startPhase: _missionStartPhase(),
        runtimePhase: 'active',
        personBoarded: !!window.missionSceneStatus?.personBoarded,
        boardedPaxCount: typeof _missionCargoBoardedPaxCount === 'function' ? _missionCargoBoardedPaxCount() : null,
        hasActivePassenger: !!window.activePassenger,
        voice: missionStartVoiceState
    });
    _sendMissionLifecycleToTracker('active', 'manual-mission-start');
    resetFlightRecorder();
    try {
        window.missionCargoRecordFlightEvent?.('start', missionRuntime.startedAt, {
            showBanner: true,
            delayMs: 350
        });
    } catch (_) {}
    _persistMissionRuntimeSnapshot('manual-mission-start', { immediate: true });
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
    if (runtimeGroundEndReady) {
        try {
            window.missionComplianceEnsureFinalDecision?.();
            window.missionComplianceStartArrival?.('manual-mission-end');
        } catch (_) {}
    }
    if (!options.skipCargoUnload && typeof window.openMissionCargoDialog === 'function' && groundAction.action === 'pickup') {
        _missionPhaseDebugPush('dialog', { mode: 'pickup', trigger: 'manualMissionEnd', phase: groundAction.phase });
        window.openMissionCargoDialog('pickup');
        return false;
    }
    if (!options.skipCargoUnload && typeof window.openMissionCargoDialog === 'function' && groundAction.action === 'unload') {
        _missionPhaseDebugPush('dialog', { mode: 'unload', trigger: 'manualMissionEnd', phase: groundAction.phase, poiGroundEndReady: !!poiGroundEndReady });
        window.openMissionCargoDialog('unload');
        return false;
    }
    if (!options.skipConfirm) {
        const confirmAction = (groundAction.action === 'end' || endReady.atTarget || poiGroundEndReady || bushGroundEndReady || runtimeGroundEndReady)
            ? 'end'
            : 'stop';
        if (!_confirmMissionCriticalAction(confirmAction, options)) {
            _missionPhaseDebugPush('trigger', { name: 'manualMissionEnd:cancelled', action: confirmAction });
            return false;
        }
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
    // Ein manueller Stop ausserhalb eines regulaeren Endpunkts startet keine
    // losgeloeste Deboarding-Animation. Reguläres Deboarding läuft immer über
    // die koordinierte Cue/Tür/Farewell-Sequenz oben.
    const endSceneStarted = false;
    _missionPhaseDebugPush('trigger', {
        name: 'manualMissionEnd:finalize',
        endSceneStarted: !!endSceneStarted,
        runtimeGroundEndReady: !!runtimeGroundEndReady,
        bushGroundEndReady: !!bushGroundEndReady,
        poiGroundEndReady: !!poiGroundEndReady
    });
    const pos = window.lastLiveGpsPos;
    const shouldFinalize = !!(flightRecorder && (flightRecorder.active || flightRecorder.hadAirbornePhase || (Array.isArray(flightRecorder.track) && flightRecorder.track.length > 1)));
    if (shouldFinalize) finalizeFlightRecorder(Date.now(), pos?.lat ?? null, pos?.lon ?? null);
    else resetFlightRecorder();
    _setMissionClosePending({ reason: 'manual-mission-end', outcome: cargoOutcome });
    return endSceneStarted || cargoOutcome || true;
};

window.completeMissionClose = function(reason = 'mission-close', options = {}) {
    if (!missionRuntime.closingPending) return false;
    if (options?.complianceReleased !== true && window.missionComplianceBlockClose?.()) {
        const record = missionRuntime.completionRecord || missionRuntime.arrivalFlightRecord || null;
        const outcome = missionRuntime.closingOutcome || null;
        missionRuntime.closingPending = false;
        missionRuntime.active = true;
        missionRuntime.phase = 'inspection';
        window.missionComplianceRequestClose?.({ reason, outcome, record });
        _persistMissionRuntimeSnapshot('mission-close-reheld-for-compliance', { immediate: true });
        _updateMissionRuntimeUi();
        return false;
    }
    if (typeof _missionCargoFinalizeMissionOutcome === 'function' && !missionRuntime.closingOutcome) {
        try {
            missionRuntime.closingOutcome = _missionCargoFinalizeMissionOutcome({ source: reason });
        } catch (_) {}
    }
    const record = missionRuntime.completionRecord || _buildMissionCompletionRecord({ outcome: missionRuntime.closingOutcome });
    if (!record) return false;
    missionRuntime.completionRecord = record;
    _persistMissionCompletion(record);
    _persistMissionRuntimeSnapshot('mission-debrief-open', { immediate: true });
    _showMissionCompletionDebrief(record);
    try { triggerCloudSave(true); } catch (_) {}
    return true;
};

window.completeMissionCloseCleanup = function(record = null, reason = 'debrief-close-cleanup') {
    const pending = record && typeof record === 'object' ? record : (_readPendingMissionDebrief() || missionRuntime.completionRecord);
    if (!pending) return false;
    const nextStart = _completionText(pending.dest || pending.arrLabel || '', 64);
    try { localStorage.removeItem(MISSION_DEBRIEF_PENDING_KEY); } catch (_) {}
    if (typeof window.missionRuntimeReset === 'function') {
        window.missionRuntimeReset({
            respawnAfterClear: false,
            complianceReleased: true,
            authorityOutcome: 'completed',
            reason
        });
    }
    if (typeof window.clearAppMissionState === 'function') {
        window.clearAppMissionState({
            skipRuntimeReset: true,
            abortDispatch: false,
            complianceReleased: true,
            nextStart,
            reason
        });
    } else {
        localStorage.removeItem('ga_active_mission');
        localStorage.removeItem('ga_active_mission_contract');
        localStorage.removeItem('ga_active_passenger');
        localStorage.removeItem('ga_active_mission_runtime');
        try { currentMissionData = null; routeWaypoints = []; window._missionRouteWaypoints = null; } catch (_) {}
        window.activeMissionContract = null;
        window.activePassenger = null;
        const briefing = document.getElementById('briefingBox');
        if (briefing) briefing.style.display = 'none';
    }
    try { triggerCloudSave(true); } catch (_) {}
    return true;
};

window.toggleManualMissionRuntime = function() {
    if (missionRuntime.closingPending) window.completeMissionClose('toggle-manual-runtime');
    else if (missionRuntime.active) window.manualMissionEnd();
    else window.manualMissionStart();
};

function _missionPrepareFarewellVoice(record = null, reason = 'farewell-preload') {
    if (!missionRuntime.active || missionRuntime.waitingFarewellDeboarding || missionRuntime.closingPending) return false;
    if (missionRuntime.farewellPreloadRequestedAt) return false;
    if (typeof window.paxVoicePrepareFarewell !== 'function') return false;
    if (typeof _missionScenePaxCount === 'function' && _missionScenePaxCount() > 0) {
        _missionScenePrepareDeboardingCue();
    }
    missionRuntime.farewellPreloadRequestedAt = Date.now();
    _missionPhaseDebugPush('trigger', { name: 'paxVoicePrepareFarewell', reason });
    try {
        const prepared = window.paxVoicePrepareFarewell(record);
        if (prepared && typeof prepared.catch === 'function') prepared.catch(() => {});
        return true;
    } catch (_) {
        missionRuntime.farewellPreloadRequestedAt = 0;
        return false;
    }
}

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
        if (window.missionRuntimeResumeConflict?.trackerActive === true) {
            return window.resumeTrackerMissionOnThisDevice?.();
        }
        if (_missionIsFreeflightOnly()) {
            _missionPhaseDebugPush('trigger', {
                name: 'handleMissionStartBannerAction:freeflight-blocked'
            });
            if (typeof window.prepareFreeflightBriefingState === 'function') {
                window.prepareFreeflightBriefingState(currentMissionData, { reason: 'freeflight-start-blocked' });
            }
            _updateMissionRuntimeUi();
            return false;
        }
        _missionPhaseDebugPush('trigger', {
            name: 'handleMissionStartBannerAction',
            runtimeActive: !!missionRuntime.active,
            closingPending: !!missionRuntime.closingPending
        });
        const phase = _missionStartPhase();
        if (_missionEndDeboardingBusy()) {
            _updateMissionRuntimeUi();
            return;
        }
        if (missionRuntime.closingPending) {
            window.completeMissionClose('banner-close');
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
            const simEndPhase = String(groundAction.phase || '').trim();
            const simEndAllowed = (
                !window.simModeActive
                || groundAction.action !== 'end'
                || simEndPhase === 'end_ready'
                || simEndPhase === 'ready_to_close'
            );
            if (window.simModeActive && typeof window.completeSimMissionEnd === 'function' && groundAction.action === 'end' && simEndAllowed) {
                if (!_confirmMissionCriticalAction('sim-end')) return false;
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
            const authorityReady = await _ensureMissionAuthorityForStart('mission-start-prepare');
            if (!authorityReady) {
                const runningId = window.missionRuntimeResumeConflict?.trackerMissionId || 'eine andere Mission';
                try { alert(`Der Tracker führt bereits ${runningId}. Die laufende Mission kann hier übernommen oder zuerst beendet werden.`); } catch (_) {}
                _updateMissionRuntimeUi();
                return false;
            }
            _prepareFreshMissionRuntimeStart('mission-start-prepare');
            _setMissionStartPhase('prepare');
            _setMissionRuntimePhase('planned');
            _updateMissionRuntimeUi();
            if (!window.simModeActive && typeof _missionSceneHandleFlightTick === 'function') {
                _missionSceneHandleFlightTick(window.lastLiveFlightData || {}, 'mission-start-prepare');
                setTimeout(() => {
                    if (_missionStartPhase() !== 'prepare' || missionRuntime.active) return;
                    if (window.missionSceneStatus?.spawned || window.missionSceneStatus?.spawnRequested) return;
                    _missionSceneHandleFlightTick(window.lastLiveFlightData || {}, 'mission-start-prepare-retry');
                }, 500);
            }
            return;
        }
        if (phase === 'prepare') {
            await window.startMissionBoarding();
            return;
        }
        if (phase === 'boarding') {
            const scene = window.missionSceneStatus || {};
            if (scene.boardingPreparing || scene.boardingRequested || scene.boardingActive || missionStartBoardingPromise) {
                _updateMissionRuntimeUi();
                return;
            }
            window.openMissionCargoDialog?.('load');
            return;
        }
        if (phase !== 'boarded') return false;
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

function toggleAutoFollow(forceState = null) {
    const nextState = (typeof forceState === 'boolean') ? forceState : !isAutoFollow;
    isAutoFollow = nextState;
    if (isAutoFollow) {
        lastAutoFollowPanAt = 0;
        lastAutoFollowPanPos = null;
        if (typeof window.resetMapAutoZoomState === 'function') window.resetMapAutoZoomState();
    }
    const btn = document.getElementById('autoFollowBtn');
    if (btn) {
        btn.style.background = isAutoFollow ? 'var(--blue)' : '#666';
        btn.innerHTML = isAutoFollow ? '🎯' : '📍';
    }
    if (isAutoFollow) applyAutoFollowViewNow({ forceZoom: true });
    if (typeof window.refreshMapAutoZoomUi === 'function') window.refreshMapAutoZoomUi();
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
        // Konto und PIN minimal prüfen; der Worker liefert die gespeicherte
        // kanonische Schreibweise zurück, damit Sync und Relay denselben Raum nutzen.
        const res = await fetch(AUTH_VERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pilotId: id, pin })
        });

        if (res.status === 200) {
            const authData = await res.json();
            const canonicalId = applyCanonicalSyncId(authData?.pilotId || id, { authenticated: true });
            localStorage.setItem('ga_saved_pin', pin);
            if (!isAutoLogin) alert(`✅ Erfolgreich angemeldet als ${canonicalId}!`);
            setSyncLoginState(true);
        } else if (res.status === 401) {
            if (!isAutoLogin) {
                alert("❌ Der PIN für diese Pilot-ID ist falsch.");
            } else {
                localStorage.removeItem('ga_saved_id');
                localStorage.removeItem('ga_saved_pin');
            }
            setSyncLoginState(false);
        } else if (res.status === 404) {
            if (isAutoLogin) {
                localStorage.removeItem('ga_saved_id');
                localStorage.removeItem('ga_saved_pin');
                setSyncLoginState(false);
                return;
            }
            // Unbekannte ID bleibt im manuellen Login der bestehende Registrierungsweg.
            const registerRes = await fetch(SYNC_URL + encodeURIComponent(id), {
                method: 'POST',
                headers: { 'X-Pilot-PIN': pin, 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: pin, flights: [], lastModified: Date.now() })
            });
            if (registerRes.ok) {
                const registerData = await registerRes.json();
                const canonicalId = applyCanonicalSyncId(registerData?.pilotId || id, { authenticated: true });
                localStorage.setItem('ga_saved_pin', pin);
                alert(`✅ Neuer Pilot ${canonicalId} erfolgreich registriert!`);
                setSyncLoginState(true);
            } else {
                throw new Error("Registrierung fehlgeschlagen");
            }
        } else if (res.status === 409) {
            if (!isAutoLogin) alert("❌ Diese Pilot-ID ist nicht eindeutig. Bitte den Support kontaktieren.");
            setSyncLoginState(false);
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
        if (t && t.checked) syncPendingUploadThenLoad('login-sync-resume');
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

function _syncIsStorageQuotaError(err) {
    const name = String(err?.name || '');
    const msg = String(err?.message || '');
    return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || /quota|storage/i.test(msg);
}

function _syncPruneLocalStorageForQuota(options = {}) {
    const exact = [
        'ga_mission_debug_snapshot',
        'ga_vfr_overlay_cache_v1',
        'ga_obs_pool_v1',
        'ga_obs_tile_cov_v1',
        'ga_obs_tile_failed_v1',
        'ga_om_cache_v2'
    ];
    if (options.replacePinboard) exact.push('ga_pinboard');
    if (options.replaceActiveMission) {
        exact.push('ga_active_mission', 'ga_active_mission_contract', 'ga_active_passenger', 'ga_active_mission_runtime');
    }
    const prefixes = ['ga_obs_combo_', 'ga_lms_'];
    let removed = 0;
    exact.forEach(key => {
        try {
            if (localStorage.getItem(key) !== null) {
                localStorage.removeItem(key);
                removed++;
            }
        } catch (_) {}
    });
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && prefixes.some(prefix => key.startsWith(prefix))) {
                localStorage.removeItem(key);
                removed++;
            }
        }
    } catch (_) {}
    return removed;
}

try { window.gaPruneLocalStorageForQuota = _syncPruneLocalStorageForQuota; } catch (_) {}

function _syncCompactMissionObjectCore(value = null, fallbackMission = null) {
    if (!value || typeof value !== 'object') return value || null;
    const fallback = (fallbackMission && typeof fallbackMission === 'object') ? fallbackMission : {};
    const keep = [
        'id', 'missionId', 'missionKey', 'title', 'name', 's', 'mission',
        'freeflightOnly', 'efbOnly', 'noMissionRuntime', 'directToEfbOnly', 'routeOnly',
        'activeMissionCreatedAt', 'activeMissionSavedAt',
        'activeMissionRuntimeStartedAt', 'activeMissionRuntimeSavedAt',
        'activeMissionRuntimePhase', 'activeMissionRuntimeMissionId',
        'generatedAt', 'createdAt', 'updatedAt', 'savedAt',
        'missionTitle', 'missionStory', 'summary', 'missionType', 'missionPipelineMode',
        'start', 'dest', 'initialDest', 'initialStartLat', 'initialStartLon',
        'poiPresentation', 'isPOI', 'poiName', 'targetName', 'targetLat', 'targetLon', 'targetAltFt', 'targetInfo',
        'poiTerrainFt', 'poiTerrainMaxFt', 'poiTerrainRadiusNm', 'poiTerrainEnvelope',
        'missionSubType', 'poiChain',
        'category', 'profileId', 'requestedProfileId', 'appliedProfileId',
        'taskDomain', 'roleProfile', 'pax', 'cargo', 'paxText', 'initialPaxText',
        'cargoText', 'passenger',
        'sarHeli', 'sarHeliProgress', 'bush', 'bushProgress',
        'routeWaypoints', 'missionRouteWaypoints',
        'targetScene', 'sceneIntent', 'sceneAccepted', 'sceneCompositionStatus',
        'missionPlanV2', 'missionPlanV4', 'missionContractV4', 'missionVariety',
        'aptArrivalPlan', 'surveyPattern', 'cargoManifest', 'cargoOutcome', 'fireScenario', 'complianceInspection'
    ];
    const out = {};
    keep.forEach(key => {
        if (value[key] !== undefined) out[key] = value[key];
    });
    if (!out.missionId && fallback.missionId) out.missionId = fallback.missionId;
    if (!out.missionKey && fallback.missionKey) out.missionKey = fallback.missionKey;
    if (!out.start && fallback.start) out.start = fallback.start;
    if (!out.dest && fallback.dest) out.dest = fallback.dest;
    if (!out.targetName && fallback.targetName) out.targetName = fallback.targetName;
    if (!out.missionTitle) out.missionTitle = value.missionTitle || value.title || fallback.missionTitle || fallback.mission || fallback.title || '';
    if (!out.missionStory) out.missionStory = value.missionStory || value.story || fallback.missionStory || fallback.story || fallback.s || '';
    if (value.missionContract && typeof value.missionContract === 'object') {
        out.missionContract = _syncCompactMissionObjectCore(value.missionContract, fallback);
    }
    return out;
}

function _syncStripDeepMissionPlans(value = null) {
    if (!value || typeof value !== 'object') return value || null;
    delete value.targetGeoContext;
    delete value.missionTruth;
    delete value.missionPlanV2;
    delete value.missionPlanV3;
    delete value.missionPlanV4;
    delete value.missionContractV4;
    delete value._missionPlanV2;
    delete value._missionPlanV4;
    delete value._missionContractV4;
    delete value.targetSceneDebug;
    delete value.targetSceneComposerDebug;
    delete value.missionPipelineDebug;
    delete value.weatherBriefing;
    delete value.dispatchPerf;
    if (value.missionContract && typeof value.missionContract === 'object') {
        value.missionContract = _syncStripDeepMissionPlans(value.missionContract);
    }
    return value;
}

function _syncCompactFlightDataState(state, level = 1) {
    const out = _syncJsonClone(state);
    if (!out || typeof out !== 'object') return out;
    if (out.currentMissionData && typeof out.currentMissionData === 'object') {
        const embeddedContract = out.currentMissionData.missionContract;
        if (!out.activeMissionContract && embeddedContract && typeof embeddedContract === 'object') {
            out.activeMissionContract = embeddedContract;
        }
    }
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
            out.activeMissionContract = _syncCompactMissionObjectCore(out.activeMissionContract, out.currentMissionData);
        }
    }
    if (level >= 2) {
        if (out.activeMissionContract && typeof out.activeMissionContract === 'object') {
            out.activeMissionContract = _syncCompactMissionObjectCore(out.activeMissionContract, out.currentMissionData);
        }
        delete out.missionRouteWaypoints;
        delete out.vpAltWaypoints;
    }
    if (level >= 3) {
        out.wikiDepImageUrl = '';
        out.wikiDestImageUrl = '';
        out.wikiDepDescText = '';
        out.wikiDestDescText = '';
        out.wikiDepFreqText = '';
        out.wikiDestFreqText = '';
        if (out.currentMissionData && typeof out.currentMissionData === 'object') {
            out.currentMissionData = _syncStripDeepMissionPlans(_syncCompactMissionObjectCore(out.currentMissionData, out.currentMissionData));
        }
        if (out.activeMissionContract && typeof out.activeMissionContract === 'object') {
            out.activeMissionContract = _syncStripDeepMissionPlans(_syncCompactMissionObjectCore(out.activeMissionContract, out.currentMissionData));
        }
    }
    return out;
}

function _syncCompactPinboard(pinboard, options = {}) {
    const maxPinnedFlights = Number.isFinite(Number(options.maxPinnedFlights)) ? Number(options.maxPinnedFlights) : Infinity;
    const flightDataLevel = Number.isFinite(Number(options.flightDataLevel)) ? Number(options.flightDataLevel) : 1;
    const textMax = Number.isFinite(Number(options.textMax)) ? Number(options.textMax) : 8000;
    let notes = Array.isArray(pinboard)
        ? pinboard.map(n => _syncJsonClone(n)).filter(note => (
            note
            && note.type !== 'flight_record'
            && !(note.type === 'authority_sanction' && Number(note.expiresAt || 0) > 0 && Number(note.expiresAt) <= Date.now())
        ))
        : [];
    if (Number.isFinite(Number(options.maxNotes)) && notes.length > Number(options.maxNotes)) {
        const protectedIds = new Set(
            notes
                .filter(note => note.type === 'authority_sanction' && Number(note.expiresAt || note.immutableUntil || 0) > Date.now())
                .map(note => String(note.id))
        );
        const removable = notes.filter(note => !protectedIds.has(String(note.id)));
        const keepRemovable = Math.max(0, Number(options.maxNotes) - protectedIds.size);
        const keepIds = new Set(removable.slice(Math.max(0, removable.length - keepRemovable)).map(note => String(note.id)));
        notes = notes.filter(note => protectedIds.has(String(note.id)) || keepIds.has(String(note.id)));
    }
    const pruneByType = (type, maxKeep) => {
        if (!Number.isFinite(maxKeep)) return;
        maxKeep = Math.max(0, Math.floor(maxKeep));
        const indexes = [];
        notes.forEach((note, idx) => {
            if (note?.type === type) indexes.push(idx);
        });
        while (indexes.length > maxKeep) {
            const idx = indexes.shift();
            notes.splice(idx, 1);
            for (let i = 0; i < indexes.length; i++) indexes[i] -= 1;
        }
    };
    pruneByType('flight', maxPinnedFlights);
    notes.forEach(note => {
        if (!note || typeof note !== 'object') return;
        if (note.type !== 'authority_sanction' && typeof note.text === 'string' && note.text.length > textMax) note.text = note.text.slice(0, textMax);
        if (note.type === 'flight' && note.flightData) {
            note.flightData = _syncCompactFlightDataState(note.flightData, flightDataLevel);
        }
    });
    return notes;
}

function _syncStoreCloudPinboard(pinboard) {
    const sourceNotes = Array.isArray(pinboard) ? pinboard.slice() : [];
    let localProtected = [];
    try {
        localProtected = JSON.parse(localStorage.getItem('ga_pinboard') || '[]').filter(note => (
            note?.type === 'authority_sanction'
            && Number(note.expiresAt || note.immutableUntil || 0) > Date.now()
        ));
    } catch (_) {}
    localProtected.forEach(note => {
        const duplicate = sourceNotes.some(remote => (
            remote?.type === 'authority_sanction'
            && (
                String(remote.id || '') === String(note.id || '')
                || (remote.flightId && String(remote.flightId) === String(note.flightId || ''))
            )
        ));
        if (!duplicate) sourceNotes.push(note);
    });
    const cleanSourceNotes = sourceNotes.filter(note => note?.type !== 'flight_record');
    const legacyRemoved = sourceNotes.length - cleanSourceNotes.length;
    const attempts = [
        { raw: true },
        { maxPinnedFlights: 10, flightDataLevel: 1 },
        { maxPinnedFlights: 8, flightDataLevel: 1 },
        { maxPinnedFlights: 6, flightDataLevel: 2 },
        { maxPinnedFlights: 4, flightDataLevel: 2, maxNotes: 80, textMax: 3000 },
        { maxPinnedFlights: 2, flightDataLevel: 3, maxNotes: 50, textMax: 1000 },
        { maxPinnedFlights: 1, flightDataLevel: 3, maxNotes: 30, textMax: 600 },
        { dropPinboard: true }
    ];
    let lastError = null;
    let storageRescued = false;
    for (const cfg of attempts) {
        const notes = cfg.dropPinboard
            ? cleanSourceNotes.filter(note => note?.type === 'authority_sanction' && Number(note.expiresAt || note.immutableUntil || 0) > Date.now())
            : (cfg.raw ? cleanSourceNotes : _syncCompactPinboard(cleanSourceNotes, cfg));
        const raw = JSON.stringify(notes);
        for (let pass = 0; pass < 2; pass++) {
            try {
                if (storageRescued || cfg.dropPinboard) {
                    try { localStorage.removeItem('ga_pinboard'); } catch (_) {}
                }
                localStorage.setItem('ga_pinboard', raw);
                if (storageRescued) {
                    try { console.warn('[Sync] Local storage quota cleanup applied before storing cloud pinboard.'); } catch (_) {}
                }
                if (cfg.dropPinboard) {
                    try { console.warn('[Sync] Cloud pinboard dropped locally because storage quota stayed full after compaction.'); } catch (_) {}
                }
                return { notes, compacted: !cfg.raw, storageRescued, dropped: !!cfg.dropPinboard, legacyRemoved };
            } catch (err) {
                lastError = err;
                if (!_syncIsStorageQuotaError(err)) break;
                if (!storageRescued) {
                    _syncPruneLocalStorageForQuota({ replacePinboard: true, replaceActiveMission: true });
                    storageRescued = true;
                    continue;
                }
                break;
            }
        }
    }
    throw lastError || new Error('Pinboard konnte lokal nicht gespeichert werden');
}

let syncLegacyPinboardCleanupScheduled = false;
function _syncScheduleLegacyPinboardCleanup(storeResult = null) {
    if (!storeResult?.legacyRemoved || storeResult.dropped || storeResult.compacted || syncLegacyPinboardCleanupScheduled) return;
    syncLegacyPinboardCleanupScheduled = true;
    setTimeout(() => {
        syncLegacyPinboardCleanupScheduled = false;
        try {
            console.info(`[Sync] Entferne ${storeResult.legacyRemoved} alte Flugtrack-Eintraege aus der Cloud-Pinnwand.`);
            triggerCloudSave(true);
        } catch (_) {}
    }, 0);
}

async function _syncFetchError(res) {
    let detail = '';
    try {
        detail = (await res.text() || '').trim();
        if (detail.length > 180) detail = detail.slice(0, 180) + '...';
    } catch (_) {}
    return new Error(`HTTP ${res.status}${detail ? ': ' + detail : ''}`);
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

function _syncFollowupPayload() {
    if (typeof window.missionFollowupGetForSync === 'function') {
        try { return window.missionFollowupGetForSync(); } catch (_) {}
    }
    try {
        const parsed = JSON.parse(localStorage.getItem('ga_followup_requests_v1') || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function _syncApplyFollowupsFromCloud(data = null) {
    if (!data || !Array.isArray(data.followUpRequests)) return;
    if (typeof window.missionFollowupApplyFromSync === 'function') {
        try { window.missionFollowupApplyFromSync(data.followUpRequests); } catch (_) {}
    } else {
        try { localStorage.setItem('ga_followup_requests_v1', JSON.stringify(data.followUpRequests)); } catch (_) {}
    }
}

function _syncOnboardEquipmentPayload() {
    if (typeof window.missionCargoGetOnboardEquipmentForSync !== 'function') return null;
    try { return window.missionCargoGetOnboardEquipmentForSync(); } catch (_) { return null; }
}

function _syncApplyOnboardEquipmentFromCloud(data = null) {
    if (!data || !Object.prototype.hasOwnProperty.call(data, 'onboardEquipment')) return false;
    if (typeof window.missionCargoApplyOnboardEquipmentFromSync !== 'function') return false;
    try { return window.missionCargoApplyOnboardEquipmentFromSync(data.onboardEquipment); } catch (_) { return false; }
}

function _syncBuildUploadPayload(basePayload, localSyncTs, pin) {
    const attempts = [
        { maxPinnedFlights: 10, flightDataLevel: 1, logbookMax: 40, missionLevel: 1, maxFollowUps: 36 },
        { maxPinnedFlights: 8, flightDataLevel: 1, logbookMax: 30, missionLevel: 1, maxFollowUps: 30 },
        { maxPinnedFlights: 6, flightDataLevel: 2, logbookMax: 20, missionLevel: 2, maxFollowUps: 24 },
        { maxPinnedFlights: 4, flightDataLevel: 2, logbookMax: 10, missionLevel: 2, maxNotes: 80, textMax: 3000, maxFollowUps: 18 },
        { maxPinnedFlights: 2, flightDataLevel: 3, logbookMax: 5, missionLevel: 3, maxNotes: 50, textMax: 1000, maxFollowUps: 12 },
        { maxPinnedFlights: 1, flightDataLevel: 3, logbookMax: 2, missionLevel: 3, maxNotes: 30, textMax: 600, maxFollowUps: 6 }
    ];

    let last = null;
    for (const cfg of attempts) {
        const payload = {
            ...basePayload,
            pinboard: _syncCompactPinboard(basePayload.pinboard, cfg),
            logbook: Array.isArray(basePayload.logbook) ? basePayload.logbook.slice(0, cfg.logbookMax) : [],
            activeMission: cfg.dropActiveMission ? null : _syncCompactActiveMission(basePayload.activeMission, cfg.missionLevel),
            followUpRequests: (typeof window.missionFollowupCompactForSync === 'function')
                ? window.missionFollowupCompactForSync(basePayload.followUpRequests, cfg)
                : (Array.isArray(basePayload.followUpRequests) ? basePayload.followUpRequests.slice(0, cfg.maxFollowUps || 20) : []),
            lastModified: localSyncTs,
            pin
        };
        const bodyStr = JSON.stringify(payload);
        last = { payload, bodyStr, compacted: true, compaction: { ...cfg } };
        if (bodyStr.length <= SYNC_MAX_UPLOAD_BYTES) return last;
    }
    return last || { payload: { ...basePayload, lastModified: localSyncTs, pin }, bodyStr: JSON.stringify({ ...basePayload, lastModified: localSyncTs, pin }), compacted: false };
}

function _syncPayloadComponentChars(payload = null) {
    if (!payload || typeof payload !== 'object') return {};
    const out = {};
    Object.keys(payload).forEach(key => {
        try { out[key] = JSON.stringify(payload[key]).length; } catch (_) { out[key] = -1; }
    });
    return out;
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

function _syncMissionIdentityValues(state = null) {
    if (!state || typeof state !== 'object') return [];
    const md = state.currentMissionData && typeof state.currentMissionData === 'object' ? state.currentMissionData : state;
    const contract = state.activeMissionContract && typeof state.activeMissionContract === 'object'
        ? state.activeMissionContract
        : (md.missionContract && typeof md.missionContract === 'object' ? md.missionContract : null);
    const out = [];
    [
        state.missionId,
        state.missionKey,
        state.id,
        md.missionId,
        md.missionKey,
        md.id,
        contract?.missionId,
        contract?.missionKey,
        contract?.id
    ].forEach(value => {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized && !out.includes(normalized)) out.push(normalized);
    });
    return out;
}

function _syncMissionStatesShareIdentity(a = null, b = null) {
    const aIds = _syncMissionIdentityValues(a);
    const bIds = _syncMissionIdentityValues(b);
    return !!(aIds.length && bIds.length && aIds.some(id => bIds.includes(id)));
}

function _syncReadRuntimeSnapshot() {
    try {
        const snap = JSON.parse(localStorage.getItem(MISSION_RUNTIME_RESUME_KEY) || 'null');
        return snap && typeof snap === 'object' ? snap : null;
    } catch (_) {
        return null;
    }
}

function _syncRuntimeSnapshotMatchesMission(snapshot = null, missionState = null) {
    if (!snapshot || typeof snapshot !== 'object' || !missionState || typeof missionState !== 'object') return false;
    const snapIds = [
        snapshot.missionId,
        snapshot.runtime?.missionId
    ].map(value => String(value || '').trim().toLowerCase()).filter(Boolean);
    const missionIds = _syncMissionIdentityValues(missionState);
    return !!(snapIds.length && missionIds.length && snapIds.some(id => missionIds.includes(id)));
}

function _syncRuntimeSnapshotStarted(snapshot = null) {
    if (!snapshot || typeof snapshot !== 'object') return false;
    const runtime = snapshot.runtime && typeof snapshot.runtime === 'object' ? snapshot.runtime : {};
    return !!(
        runtime.active
        || runtime.closingPending
        || _missionRuntimePhaseCountsAsStarted(snapshot.startPhase)
        || _missionRuntimePhaseCountsAsStarted(runtime.phase || snapshot.runtimePhase)
    );
}

function _syncCurrentMissionStateForIdentity() {
    if (typeof currentMissionData === 'undefined' || !currentMissionData || typeof currentMissionData !== 'object') return null;
    return {
        currentMissionData,
        activeMissionContract: window.activeMissionContract || currentMissionData.missionContract || null
    };
}

function _syncMissionTitleForPrompt(state = null) {
    if (!state || typeof state !== 'object') return 'Unbenannte Mission';
    const md = state.currentMissionData && typeof state.currentMissionData === 'object' ? state.currentMissionData : state;
    const parts = [
        md.missionTitle || md.mission || md.title || state.mTitle || '',
        [md.start || state.currentStartICAO || state.mDepICAO || '', md.dest || state.currentDestICAO || state.mDestICAO || ''].filter(Boolean).join(' -> ')
    ].map(value => String(value || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
    return parts.length ? parts.join('\n') : 'Unbenannte Mission';
}

function _syncLocalMissionRuntimeStatus(state = null) {
    if (!state || typeof state !== 'object') return { started: false, expired: false };
    let info = null;
    if (typeof window.activeMissionRestoreExpiryInfo === 'function') {
        try { info = window.activeMissionRestoreExpiryInfo(state); } catch (_) { info = null; }
    }
    const currentState = _syncCurrentMissionStateForIdentity();
    const matchesCurrent = _syncMissionStatesShareIdentity(currentState, state);
    const runtimeStarted = !!(
        matchesCurrent
        && (
            missionRuntime.active
            || missionRuntime.closingPending
            || _missionRuntimePhaseCountsAsStarted(_missionRuntimePhaseSnapshot())
        )
    );
    const snapshot = _syncReadRuntimeSnapshot();
    const snapshotStarted = _syncRuntimeSnapshotStarted(snapshot) && _syncRuntimeSnapshotMatchesMission(snapshot, state);
    return {
        started: !!(info?.started || runtimeStarted || snapshotStarted),
        expired: !!info?.expired,
        source: info?.source || (runtimeStarted ? 'runtime' : (snapshotStarted ? 'runtimeSnapshot' : 'none'))
    };
}

function _syncShouldPromptBeforeReplacingLocalMission(cloudMission = null, localMission = null) {
    if (!localMission || typeof localMission !== 'object') return false;
    if (_syncMissionStateIsDraft(localMission)) return false;
    if (cloudMission && _syncMissionStatesShareIdentity(localMission, cloudMission)) return false;
    const localRuntime = _syncLocalMissionRuntimeStatus(localMission);
    return !!(localRuntime.started && !localRuntime.expired);
}

function _syncConfirmReplaceRunningLocalMission(cloudMission = null, localMission = null, options = {}) {
    if (window.missionComplianceBlockReset?.()) {
        try { alert('Die laufende Behoerdenkontrolle muss zuerst abgeschlossen werden.'); } catch (_) {}
        return false;
    }
    if (!_syncShouldPromptBeforeReplacingLocalMission(cloudMission, localMission)) return true;
    if (typeof confirm !== 'function') return false;
    const localLabel = _syncMissionTitleForPrompt(localMission);
    const cloudLabel = cloudMission
        ? _syncMissionTitleForPrompt(cloudMission)
        : 'Keine aktive Mission in der Cloud';
    const cloudText = cloudMission
        ? `In der Cloud liegt eine andere aktive Mission:\n\n${cloudLabel}`
        : 'In der Cloud ist keine aktive Mission gespeichert.';
    const actionText = cloudMission
        ? 'OK = Cloud-Mission laden und lokale laufende Mission beenden'
        : 'OK = Cloud-Zustand uebernehmen und lokale laufende Mission beenden';
    const msg = [
        'Lokal laeuft noch eine Mission:',
        '',
        localLabel,
        '',
        cloudText,
        '',
        actionText,
        'Abbrechen = lokale laufende Mission fortsetzen'
    ].join('\n');
    try { return !!confirm(msg); } catch (_) { return false; }
}

function _syncShouldCloudRestoreResumeRuntime(activeMission = null, localMission = null) {
    if (!activeMission || typeof activeMission !== 'object') return false;
    if (_missionIsFreeflightOnly(activeMission)) return false;
    const currentState = _syncCurrentMissionStateForIdentity();
    const matchesCurrent = _syncMissionStatesShareIdentity(currentState, activeMission);
    const matchesLocal = _syncMissionStatesShareIdentity(localMission, activeMission);
    if (!matchesCurrent && !matchesLocal) return false;
    if (matchesCurrent && (missionRuntime.active || missionRuntime.closingPending || _missionRuntimePhaseCountsAsStarted(_missionRuntimePhaseSnapshot()))) {
        return true;
    }
    const snapshot = _syncReadRuntimeSnapshot();
    return !!(_syncRuntimeSnapshotStarted(snapshot) && _syncRuntimeSnapshotMatchesMission(snapshot, activeMission));
}

function _syncActiveMissionIsExpired(state = null) {
    if (!state || typeof state !== 'object') return false;
    if (typeof window.isActiveMissionStateExpired !== 'function') return false;
    try { return !!window.isActiveMissionStateExpired(state); } catch (_) { return false; }
}

function _syncResetExpiredActiveMissionToPlanned(reason = 'sync-active-mission-runtime-expired', state = null, options = {}) {
    if (!state || typeof state !== 'object') return null;
    if (typeof window.resetExpiredActiveMissionToPlanned === 'function') {
        let expiryInfo = null;
        if (state && typeof window.activeMissionRestoreExpiryInfo === 'function') {
            try { expiryInfo = window.activeMissionRestoreExpiryInfo(state); } catch (_) { expiryInfo = null; }
        }
        try {
            return window.resetExpiredActiveMissionToPlanned(state, reason, {
                expiryInfo,
                queueCloudSave: options.queueCloudSave !== false,
                showIndicator: options.showIndicator !== false
            });
        } catch (_) {}
    }
    const clear = obj => {
        if (!obj || typeof obj !== 'object') return;
        delete obj.activeMissionRuntimeStartedAt;
        delete obj.activeMissionRuntimeSavedAt;
        delete obj.activeMissionRuntimePhase;
        delete obj.activeMissionRuntimeMissionId;
    };
    clear(state);
    clear(state.currentMissionData);
    clear(state.activeMissionContract);
    clear(state.currentMissionData?.missionContract);
    try { localStorage.removeItem(MISSION_RUNTIME_RESUME_KEY); } catch (_) {}
    try { localStorage.setItem('ga_active_mission', JSON.stringify(state)); } catch (_) {}
    return state;
}

function _syncActiveMissionPayload() {
    try {
        const state = JSON.parse(localStorage.getItem('ga_active_mission') || 'null');
        if (_missionIsFreeflightOnly(state)) {
            return null;
        }
        if (_syncActiveMissionIsExpired(state)) {
            if (window.missionComplianceBlockReset?.()) return state;
            return _syncResetExpiredActiveMissionToPlanned('sync-upload-expired-active-mission', state, {
                queueCloudSave: false
            }) || state;
        }
        if (state) return state;
    } catch (_) {
        // Fall through to the in-memory save fallback below.
    }
    const fallback = (typeof window !== 'undefined' && window.__gaActiveMissionStorageFallback && typeof window.__gaActiveMissionStorageFallback === 'object')
        ? window.__gaActiveMissionStorageFallback
        : null;
    if (_missionIsFreeflightOnly(fallback)) return null;
    if (_syncActiveMissionIsExpired(fallback)) {
        if (window.missionComplianceBlockReset?.()) return fallback;
        return _syncResetExpiredActiveMissionToPlanned('sync-upload-expired-active-mission-fallback', fallback, {
            queueCloudSave: false
        }) || fallback;
    }
    return fallback || null;
}

function _syncShouldPreserveLocalMissionWithoutCloud(state = null) {
    return _syncMissionStateIsDraft(state) || _missionIsFreeflightOnly(state);
}

function _syncHasLocalDraftMission() {
    try {
        return _syncMissionStateIsDraft(JSON.parse(localStorage.getItem('ga_active_mission') || 'null'));
    } catch (_) {
        return false;
    }
}

function _syncActiveTrackerRunForCloudPull() {
    if (typeof window === 'undefined' || !window.liveTrackerConnected) return null;
    if (typeof _trackerSupportsMissionAuthority !== 'function' || !_trackerSupportsMissionAuthority()) return null;
    const run = window.lastTrackerMissionAuthority?.activeRun || window.lastTrackerMissionStatus || null;
    if (!run || typeof run !== 'object') return null;
    const missionId = _normalizeMissionRuntimeId(run.missionId || '');
    const runId = String(run.runId || '').trim();
    const state = String(run.state || '').trim().toLowerCase();
    const inactive = run.active === false || /^(ended|closed|reset|cleared|completed)$/.test(state);
    if (!missionId || !runId || inactive) return null;
    return { ...run, missionId, runId };
}

function _syncRecordCloudMissionPullOutcome(status, details = {}) {
    const outcome = {
        status: String(status || 'unknown'),
        at: Date.now(),
        ...details
    };
    window.gaLastCloudMissionPullOutcome = outcome;
    try {
        console.info('[SYNC MISSION AUTHORITY]', outcome.status, JSON.stringify(outcome));
    } catch (_) {}
    if (typeof _missionPhaseDebugPush === 'function') {
        try { _missionPhaseDebugPush('cloud_pull_authority', outcome); } catch (_) {}
    }
    return outcome;
}

async function _syncApplyActiveMissionFromCloud(activeMission = null, options = {}) {
    const briefing = document.getElementById("briefingBox");
    let localMission = null;
    window.gaLastCloudMissionPullOutcome = null;
    try {
        localMission = JSON.parse(localStorage.getItem('ga_active_mission') || 'null');
    } catch (_) {
        localMission = null;
    }
    const trackerRun = _syncActiveTrackerRunForCloudPull();
    if (trackerRun) {
        const trackerMissionId = String(trackerRun.missionId || '').trim().toLowerCase();
        const cloudMissionIds = _syncMissionIdentityValues(activeMission);
        const cloudMatchesTracker = !!(trackerMissionId && cloudMissionIds.includes(trackerMissionId));
        const cloudMissionTitle = activeMission ? _syncMissionTitleForPrompt(activeMission) : '';
        const commonOutcome = {
            source: String(options.source || 'cloud-pull'),
            trackerMissionId: trackerRun.missionId,
            trackerRunId: trackerRun.runId,
            trackerOwnerClientId: trackerRun.ownerClientId || null,
            cloudMissionId: cloudMissionIds[0] || null,
            cloudMatchesTracker
        };
        if (options.allowTrackerHandoff !== true || typeof window.resumeTrackerMissionOnThisDevice !== 'function') {
            _syncRecordCloudMissionPullOutcome('tracker-authority-retained', commonOutcome);
            return false;
        }
        const promptContext = cloudMatchesTracker
            ? 'Der Cloud-Pull gehört zur laufenden Tracker-Mission. Phase und Fortschritt werden deshalb aus dem autoritativen Tracker-Stand übernommen.'
            : (activeMission
                ? `Die Cloud-Kopie „${cloudMissionTitle}“ gehört nicht zum laufenden Tracker-Lauf und darf ihn nicht überschreiben. Der Tracker-Stand hat Vorrang.`
                : 'In der Cloud ist keine aktive Mission gespeichert. Der laufende Tracker-Lauf darf dadurch nicht gelöscht werden und hat Vorrang.');
        let resumed = false;
        try {
            resumed = (await window.resumeTrackerMissionOnThisDevice({
                source: options.source || 'cloud-pull',
                promptContext
            })) === true;
        } catch (error) {
            try { console.warn('[SYNC] Tracker-Mission konnte nach Cloud-Pull nicht übernommen werden:', error); } catch (_) {}
        }
        _syncRecordCloudMissionPullOutcome(
            resumed ? 'tracker-handoff-complete' : 'tracker-handoff-incomplete',
            commonOutcome
        );
        return resumed;
    }
    if (activeMission) {
        if (_missionIsFreeflightOnly(activeMission)) return false;
        let missionToApply = activeMission;
        let staleRuntimeResetToPlanned = false;
        if (_syncActiveMissionIsExpired(activeMission)) {
            const localRuntime = _syncLocalMissionRuntimeStatus(localMission);
            const keepFreshSameLocalMission = !!(
                localMission
                && _syncMissionStatesShareIdentity(localMission, activeMission)
                && localRuntime.started
                && !localRuntime.expired
            );
            const keepDifferentLocalMission = !!(
                localMission
                && !_syncMissionStateIsDraft(localMission)
                && !_syncMissionStatesShareIdentity(localMission, activeMission)
            );
            if (keepFreshSameLocalMission || keepDifferentLocalMission) {
                if (typeof window.triggerCloudSave === 'function') {
                    setTimeout(() => {
                        try { window.triggerCloudSave(true); } catch (_) {}
                    }, 0);
                }
                return false;
            }
            missionToApply = _syncResetExpiredActiveMissionToPlanned('cloud-active-mission-runtime-expired', activeMission, {
                queueCloudSave: false,
                showIndicator: false
            });
            if (!missionToApply) return false;
            staleRuntimeResetToPlanned = true;
        }
        const cloudIsDraft = _syncMissionStateIsDraft(missionToApply);
        if (!_syncConfirmReplaceRunningLocalMission(missionToApply, localMission, { source: 'cloud-active-mission' })) {
            return false;
        }
        const resumeRuntime = !staleRuntimeResetToPlanned
            && !cloudIsDraft
            && _syncShouldCloudRestoreResumeRuntime(missionToApply, localMission);
        window.__gaCloudActiveMissionApplyInProgress = true;
        try {
            const stored = typeof window.storeActiveMissionStateSafely === 'function'
                ? window.storeActiveMissionStateSafely(missionToApply, { refreshActiveMissionTimestamp: false })
                : (() => {
                    localStorage.setItem('ga_active_mission', JSON.stringify(missionToApply));
                    return true;
                })();
            if (stored === false) {
                try { console.warn('[SYNC] Cloud-Active-Mission konnte nur im Speicher-Fallback gehalten werden.'); } catch (_) {}
            }
            const restored = await restoreMissionState(missionToApply, {
                source: 'cloud',
                allowDraft: cloudIsDraft,
                resumeRuntime,
                runtimeResetToPlanned: staleRuntimeResetToPlanned
            });
            const completionState = String(missionToApply.missionCompletionState || missionToApply.currentMissionData?.missionCompletionState || '');
            const completionRecord = missionToApply.missionCompletionRecord || missionToApply.currentMissionData?.missionCompletionRecord || null;
            if (restored !== false && completionState === 'completed_awaiting_cleanup' && completionRecord && typeof window.restoreMissionCompletionFromCloud === 'function') {
                window.restoreMissionCompletionFromCloud(completionRecord, 'cloud-completion-restore');
            }
            if (restored !== false && staleRuntimeResetToPlanned && typeof window.queueActiveMissionCloudSave === 'function') {
                window.queueActiveMissionCloudSave('cloud-runtime-expired-reset-to-planned', { delayMs: 0 });
            }
            _syncRecordCloudMissionPullOutcome(restored !== false ? 'cloud-mission-applied' : 'cloud-mission-rejected', {
                source: String(options.source || 'cloud-pull'),
                cloudMissionId: _syncMissionIdentityValues(missionToApply)[0] || null
            });
            return restored !== false;
        } catch (err) {
            try { console.warn('[SYNC] Cloud-Active-Mission-Restore fehlgeschlagen:', err); } catch (_) {}
            return false;
        } finally {
            window.__gaCloudActiveMissionApplyInProgress = false;
            window.__gaCloudActiveMissionAppliedAt = Date.now();
        }
    }
    try {
        // Ein leerer Cloud-Missionsslot darf einen lokalen Entwurf oder eine
        // reine Freiflug-/Planungsroute nicht bei einem stillen Reload entfernen.
        // Offene lokale Aenderungen werden ueber den Pending-Upload zuerst gepusht.
        if (_syncShouldPreserveLocalMissionWithoutCloud(localMission)) return false;
    } catch (_) {}
    if (!_syncConfirmReplaceRunningLocalMission(null, localMission, { source: 'cloud-no-active-mission' })) {
        return false;
    }
    if (typeof window.missionRuntimeReset === 'function') {
        try { window.missionRuntimeReset({ respawnAfterClear: false }); } catch (_) {}
    }
    localStorage.removeItem('ga_active_mission');
    localStorage.removeItem('ga_active_mission_contract');
    localStorage.removeItem('ga_active_passenger');
    try { currentMissionData = null; } catch (_) {}
    try { routeWaypoints = []; } catch (_) {}
    try { window._missionRouteWaypoints = null; } catch (_) {}
    window.activeMissionContract = null;
    window.activePassenger = null;
    if (typeof window.clearMissionDebugSnapshot === 'function') {
        window.clearMissionDebugSnapshot('cloud-load-no-active-mission');
    } else {
        window.vpMissionDebugSnapshot = null;
        try { localStorage.removeItem('ga_mission_debug_snapshot'); } catch (_) {}
    }
    if (briefing) briefing.style.display = "none";
    _syncRecordCloudMissionPullOutcome('cloud-mission-cleared', {
        source: String(options.source || 'cloud-pull')
    });
    return false;
}

function setLastSyncedPayload() {
    const payloadToCompare = {
        pinboard: JSON.parse(localStorage.getItem('ga_pinboard') || '[]'),
        logbook: _missionLogbookForSync(),
        activeMission: _syncActiveMissionPayload(),
        groupName: getGroupName(),
        groupNick: getGroupNick(),
        knownNotes: JSON.parse(localStorage.getItem('ga_known_group_notes') || '[]'),
        newBadges: JSON.parse(localStorage.getItem('ga_group_new') || '[]'),
        aircraftPresets: getAircraftPresetsForSync(),
        onboardEquipment: _syncOnboardEquipmentPayload(),
        followUpRequests: _syncFollowupPayload()
    };
    lastSyncedPayloadStr = JSON.stringify(payloadToCompare);
}

async function _syncHomebasePush(reason = 'app-push') {
    if (typeof window.homebaseCloudPush !== 'function') return { ok: true, skipped: true };
    try {
        return await window.homebaseCloudPush(reason);
    } catch (error) {
        try { console.warn('[Sync] Homebase-Push fehlgeschlagen:', error); } catch (_) {}
        return { ok: false, error: error?.message || String(error) };
    }
}

async function _syncHomebasePull(reason = 'app-pull') {
    if (typeof window.homebaseCloudPull !== 'function') return { ok: true, skipped: true };
    try {
        return await window.homebaseCloudPull(reason);
    } catch (error) {
        try { console.warn('[Sync] Homebase-Pull fehlgeschlagen:', error); } catch (_) {}
        return { ok: false, error: error?.message || String(error) };
    }
}

async function triggerCloudSave(immediate = false, options = {}) {
    const id = getSyncId();
    const t = document.getElementById('syncToggle');
    if (!id) return { ok: false, skipped: true, reason: 'missing-sync-id' };
    // Allgemeine Spielaktionen ohne Parameter bleiben lokal. Missionsaenderungen
    // verwenden die dedizierte Queue und rufen diesen Pfad bestaetigt mit true auf.
    if (!immediate) return { ok: false, skipped: true, reason: 'soft-sync-disabled' };
    if (immediate !== 'manual' && t && !t.checked) return { ok: false, skipped: true, reason: 'auto-sync-disabled' };
    if (immediate === 'manual') {
        if (!confirm("⬆️ CLOUD UPLOAD\nMöchtest du deinen aktuellen, lokalen Stand hochladen und das bisherige Cloud-Backup überschreiben?")) {
            return { ok: false, skipped: true, reason: 'manual-cancelled' };
        }
        setNavComLed('navcomSaveBtn', 'syncing');
    }
    // Homebase bleibt ein eigener, revisionsgesicherter Datensatz. Der normale
    // App-Push startet beide Uploads gemeinsam, ohne eine nie geöffnete bzw.
    // unveränderte Workbench als leeren Entwurf hochzuladen.
    const homebasePushPromise = options.skipHomebase === true
        ? Promise.resolve({ ok: true, skipped: true })
        : _syncHomebasePush(immediate === 'manual' ? 'app-manual-push' : 'app-close-push');
    const uploadSyncTime = Date.now();
    const pendingBeforeSave = _syncReadPendingUpload();
    const payloadToCompare = {
        pinboard: JSON.parse(localStorage.getItem('ga_pinboard') || '[]'),
        logbook: _missionLogbookForSync(),
        activeMission: _syncActiveMissionPayload(),
        groupName: getGroupName(),
        groupNick: getGroupNick(),
        knownNotes: JSON.parse(localStorage.getItem('ga_known_group_notes') || '[]'),
        newBadges: JSON.parse(localStorage.getItem('ga_group_new') || '[]'),
        aircraftPresets: getAircraftPresetsForSync(),
        onboardEquipment: _syncOnboardEquipmentPayload(),
        followUpRequests: _syncFollowupPayload()
    };

    const currentPayloadStr = JSON.stringify(payloadToCompare);
    if (currentPayloadStr === lastSyncedPayloadStr && immediate !== 'manual' && options.force !== true && !pendingBeforeSave) {
        _syncClearPendingUpload();
        await homebasePushPromise;
        updateSyncStatus("Cloud: Aktuell ✅");
        return { ok: true, skipped: true, reason: 'unchanged' };
    }
    _syncMarkPendingUpload(options.reason || (immediate === 'manual' ? 'manual-upload' : 'auto-upload'));
    updateSyncStatus("Speichere in Cloud...");
    let profileSaved = false;
    let profileError = null;
    try {
        const id = getSyncId();
        const pin = getSyncPin();
        const upload = _syncBuildUploadPayload(payloadToCompare, uploadSyncTime, pin);
        const bodyStr = upload.bodyStr;
        window.gaLastCloudUploadDiagnostics = {
            at: Date.now(),
            status: 'prepared',
            rawChars: currentPayloadStr.length,
            uploadChars: bodyStr.length,
            limitChars: SYNC_MAX_UPLOAD_BYTES,
            compacted: !!upload.compacted,
            compaction: upload.compaction || null,
            rawComponents: _syncPayloadComponentChars(payloadToCompare),
            uploadComponents: _syncPayloadComponentChars(upload.payload)
        };
        if (bodyStr.length > SYNC_MAX_UPLOAD_BYTES) {
            updateSyncStatus(`Cloud: zu groß (${Math.round(bodyStr.length / 1024)} KB)`, true);
            window.gaLastCloudUploadDiagnostics.status = 'too-large';
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
            profileSaved = true;
            if (window.gaLastCloudUploadDiagnostics) window.gaLastCloudUploadDiagnostics.status = 'saved';
            localSyncTime = uploadSyncTime;
            localStorage.setItem('ga_sync_time', localSyncTime);
            lastSyncedPayloadStr = currentPayloadStr;
            _syncClearPendingUpload();
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
        profileError = e;
        if (window.gaLastCloudUploadDiagnostics && window.gaLastCloudUploadDiagnostics.status === 'prepared') {
            window.gaLastCloudUploadDiagnostics.status = 'failed';
        }
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
    const homebaseResult = await homebasePushPromise;
    if (immediate === 'manual' && profileSaved) {
        if (homebaseResult?.saved) {
            updateSyncStatus("Cloud + Homebase: Gespeichert ✅");
        } else if (homebaseResult?.conflict) {
            updateSyncStatus("App gespeichert · Homebase-Konflikt ⚠️", true);
        } else if (homebaseResult?.ok === false && !homebaseResult?.disabled) {
            updateSyncStatus("App gespeichert · Homebase nicht gespeichert ⚠️", true);
        }
    }
    return {
        ok: profileSaved,
        skipped: false,
        pending: !!_syncReadPendingUpload(),
        reason: profileSaved ? 'saved' : 'save-failed',
        error: profileError ? String(profileError?.message || profileError) : null
    };
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
        if (!res.ok) throw await _syncFetchError(res);
        const data = await res.json();
        const homebasePullPromise = _syncHomebasePull('app-manual-pull');

        if (data.lastModified) {
            localSyncTime = data.lastModified;
            localStorage.setItem('ga_sync_time', localSyncTime);
        }
        const logbookStore = data.logbook
            ? _mergeMissionLogbooks(data.logbook, { replacePinboard: !!data.pinboard })
            : null;
        const pinboardStore = data.pinboard ? _syncStoreCloudPinboard(data.pinboard) : null;
        await _syncApplyActiveMissionFromCloud(data.activeMission || null, {
            source: 'manual-cloud-pull',
            allowTrackerHandoff: true
        });
        const missionPullOutcome = window.gaLastCloudMissionPullOutcome || null;
        _syncApplyOnboardEquipmentFromCloud(data);
        if (data.knownNotes) localStorage.setItem('ga_known_group_notes', JSON.stringify(data.knownNotes));
        if (data.newBadges) localStorage.setItem('ga_group_new', JSON.stringify(data.newBadges));
        if (data.aircraftPresets) applyAircraftPresetsFromSync(data.aircraftPresets);
        _syncApplyFollowupsFromCloud(data);

        if (data.groupName !== undefined) {
            updateGroupUIFromSync(data.groupName, data.groupNick);
        }
        setLastSyncedPayload();
        _syncScheduleLegacyPinboardCleanup(pinboardStore);
        updateGroupBadgeUI();
        const storageAdjusted = !!(
            pinboardStore?.storageRescued
            || pinboardStore?.compacted
            || logbookStore?.storageRescued
            || logbookStore?.compacted
        );
        let pinboardStatus = pinboardStore?.dropped
            ? "Cloud: Geladen (ohne Pinnwand) ⚠️"
            : (storageAdjusted ? "Cloud: Geladen (Speicher angepasst) ✅" : "Cloud: Geladen ✅");
        if (missionPullOutcome?.status === 'tracker-handoff-complete') {
            pinboardStatus = 'Cloud geladen · Tracker-Mission übernommen ✅';
        } else if (missionPullOutcome?.status === 'tracker-handoff-incomplete') {
            pinboardStatus = 'Cloud-Daten geladen · Tracker-Mission bleibt geschützt ⚠️';
        }
        updateSyncStatus(pinboardStatus);
        flashSyncIndicator('down');

        setNavComLed('navcomLoadBtn', 'success');
        setTimeout(() => setNavComLed('navcomLoadBtn', 'off'), 3000);
        if (document.getElementById('pinboardOverlay').classList.contains('active')) renderNotes();
        renderLog();
        const homebaseResult = await homebasePullPromise;
        if (homebaseResult?.ok && homebaseResult?.record) {
            updateSyncStatus(missionPullOutcome?.status === 'tracker-handoff-complete'
                ? 'Cloud + Homebase geladen · Tracker-Mission übernommen ✅'
                : (missionPullOutcome?.status === 'tracker-handoff-incomplete'
                    ? 'Cloud + Homebase geladen · Tracker-Mission bleibt geschützt ⚠️'
                    : "Cloud geladen · Homebase geprüft ✅"));
        } else if (homebaseResult?.ok === false && !homebaseResult?.disabled) {
            updateSyncStatus("App geladen · Homebase nicht geladen ⚠️", true);
        }
    } catch (e) {
        try { console.error("[Sync] Cloud load failed:", e); } catch (_) {}
        const msg = String(e?.message || '');
        updateSyncStatus(msg.startsWith('HTTP ') ? `Cloud: ${msg}` : "Cloud: Lade-Fehler", true);
        alert("Fehler beim Laden aus der Cloud." + (msg ? "\n\nDetails: " + msg : ""));
        setNavComLed('navcomLoadBtn', 'error');
        setTimeout(() => setNavComLed('navcomLoadBtn', 'off'), 3000);
    }
}
async function silentSyncLoad(options = {}) {
    const id = getSyncId();
    const t = document.getElementById('syncToggle');
    if (!id || (t && !t.checked)) return;
    if (options.pendingHandled !== true && _syncReadPendingUpload()) {
        return syncPendingUploadThenLoad('silent-sync-pending');
    }
    const homebasePullPromise = _syncHomebasePull('app-silent-pull');
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
            if (data.logbook) _mergeMissionLogbooks(data.logbook, { replacePinboard: !!data.pinboard });
            const pinboardStore = data.pinboard ? _syncStoreCloudPinboard(data.pinboard) : null;
            await _syncApplyActiveMissionFromCloud(data.activeMission || null, {
                source: 'silent-cloud-pull',
                allowTrackerHandoff: false
            });
            const missionPullOutcome = window.gaLastCloudMissionPullOutcome || null;
            _syncApplyOnboardEquipmentFromCloud(data);
            if (data.knownNotes) localStorage.setItem('ga_known_group_notes', JSON.stringify(data.knownNotes));
            if (data.newBadges) localStorage.setItem('ga_group_new', JSON.stringify(data.newBadges));
            if (data.aircraftPresets) applyAircraftPresetsFromSync(data.aircraftPresets);
            _syncApplyFollowupsFromCloud(data);

            if (data.groupName !== undefined) {
                updateGroupUIFromSync(data.groupName, data.groupNick);
            }

            setLastSyncedPayload();
            _syncScheduleLegacyPinboardCleanup(pinboardStore);
            updateGroupBadgeUI();
            if (document.getElementById('pinboardOverlay').classList.contains('active')) renderNotes();
            renderLog();
            updateSyncStatus(missionPullOutcome?.status === 'tracker-authority-retained'
                ? 'Auto-Sync: Daten aktualisiert · Tracker-Mission aktiv 🔄'
                : "Auto-Sync: Aktualisiert 🔄");
            flashSyncIndicator('down');
        }
    } catch (e) {
        try { console.warn('[SYNC] Silent Cloud Load fehlgeschlagen:', e); } catch (_) {}
    } finally {
        await homebasePullPromise;
    }
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
            window.homebaseGroupRefresh?.('group-sync');
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
    if (typeof window.gaShouldPauseNetwork === 'function' && window.gaShouldPauseNetwork('sync-idle-check')) {
        window.gaRunWhenAwake?.('sync-idle-check', () => checkCloudAfterIdle());
        return;
    }
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
        if (!res.ok) throw await _syncFetchError(res);
        const data = await res.json();
        if (data.lastModified && data.lastModified > localSyncTime) {
            // Lokalen Status abgleichen (Habe ich hier ungespeicherte Änderungen?)
            const payloadToCompare = {
                pinboard: JSON.parse(localStorage.getItem('ga_pinboard') || '[]'),
                logbook: _missionLogbookForSync(),
                activeMission: _syncActiveMissionPayload(),
                groupName: getGroupName(),
                groupNick: getGroupNick(),
                knownNotes: JSON.parse(localStorage.getItem('ga_known_group_notes') || '[]'),
                newBadges: JSON.parse(localStorage.getItem('ga_group_new') || '[]'),
                aircraftPresets: getAircraftPresetsForSync(),
                onboardEquipment: _syncOnboardEquipmentPayload(),
                followUpRequests: _syncFollowupPayload()
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
                if (data.logbook) _mergeMissionLogbooks(data.logbook, { replacePinboard: !!data.pinboard });
                const pinboardStore = data.pinboard ? _syncStoreCloudPinboard(data.pinboard) : null;
                await _syncApplyActiveMissionFromCloud(data.activeMission || null, {
                    source: 'idle-cloud-pull',
                    allowTrackerHandoff: true
                });
                const missionPullOutcome = window.gaLastCloudMissionPullOutcome || null;
                _syncApplyOnboardEquipmentFromCloud(data);
                if (data.knownNotes) localStorage.setItem('ga_known_group_notes', JSON.stringify(data.knownNotes));
                if (data.newBadges) localStorage.setItem('ga_group_new', JSON.stringify(data.newBadges));
                if (data.aircraftPresets) applyAircraftPresetsFromSync(data.aircraftPresets);
                _syncApplyFollowupsFromCloud(data);
                if (data.groupName !== undefined) {
                    updateGroupUIFromSync(data.groupName, data.groupNick);
                }
                setLastSyncedPayload();
                _syncScheduleLegacyPinboardCleanup(pinboardStore);
                updateGroupBadgeUI();
                if (document.getElementById('pinboardOverlay').classList.contains('active')) renderNotes();
                renderLog();
                updateSyncStatus(missionPullOutcome?.status === 'tracker-handoff-complete'
                    ? 'Cloud-Update · Tracker-Mission übernommen ✅'
                    : (missionPullOutcome?.status === 'tracker-handoff-incomplete'
                        ? 'Cloud-Update · Tracker-Mission bleibt geschützt ⚠️'
                        : "Cloud-Update geladen ✅"));
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
let liveGpsMarkerElement = null;
let liveGpsMarkerSvgElement = null;
let lastLivePlanePerformanceMode = null;
window.liveTrackerConnected = false;
window.liveTrackerVersionCode = null;
let lastTrackerDisconnectAt = 0;
let lastTrackerReconnectAt = 0;
let trackerReconnectRecoveryUntil = 0;
let lastAutoFollowPanAt = 0;
let lastAutoFollowPanPos = null;
let lastLivePlaneHeadingUpdateAt = 0;
let gpsWatchdog;
let trackerHeartbeatWatchdog = null;
let lastTrackerHeartbeatAt = 0;
let gpsReconnectDelay = 2000; // Start: 2s, wächst bei wiederholtem Fehlschlag
let liveGpsConnectionSeq = 0;
let liveGpsReconnectTimer = null;
const LIVE_GPS_WAKE_LOCK_STALE_MS = 15000;
const TRACKER_HEARTBEAT_STALE_MS = 12000;
let liveGpsWakeLock = null;
let liveGpsWakeLockRequestPending = false;
let liveGpsWakeLockTelemetryTimer = null;
let liveGpsWakeLockRequestGeneration = 0;
let liveGpsWakeLockRetryAfter = 0;

function _hasFreshLiveGpsTelemetry(now = Date.now()) {
    const lastTelemetryAt = Number(window.gaLastTrackerTelemetryAt || window.lastLiveGpsPos?.t || 0);
    return !!window.liveTrackerConnected
        && Number.isFinite(lastTelemetryAt)
        && (now - lastTelemetryAt) < LIVE_GPS_WAKE_LOCK_STALE_MS;
}

function _clearLiveGpsWakeLockTelemetryTimer() {
    if (!liveGpsWakeLockTelemetryTimer) return;
    clearTimeout(liveGpsWakeLockTelemetryTimer);
    liveGpsWakeLockTelemetryTimer = null;
}

function _scheduleLiveGpsWakeLockTelemetryTimeout() {
    _clearLiveGpsWakeLockTelemetryTimer();
    const lastTelemetryAt = Number(window.gaLastTrackerTelemetryAt || window.lastLiveGpsPos?.t || 0);
    if (!window.liveTrackerConnected || !Number.isFinite(lastTelemetryAt)) return;
    const remainingMs = Math.max(0, LIVE_GPS_WAKE_LOCK_STALE_MS - (Date.now() - lastTelemetryAt));
    liveGpsWakeLockTelemetryTimer = setTimeout(() => {
        liveGpsWakeLockTelemetryTimer = null;
        if (!_hasFreshLiveGpsTelemetry()) {
            _releaseLiveGpsScreenWakeLock('telemetry-stale');
        }
    }, remainingMs + 100);
}

async function _requestLiveGpsScreenWakeLock(reason = 'tracker-live') {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || !_hasFreshLiveGpsTelemetry()) return false;
    if (liveGpsWakeLock && !liveGpsWakeLock.released) return true;
    if (liveGpsWakeLockRequestPending || Date.now() < liveGpsWakeLockRetryAfter) return false;

    const requestGeneration = liveGpsWakeLockRequestGeneration;
    liveGpsWakeLockRequestPending = true;
    try {
        const wakeLock = await navigator.wakeLock.request('screen');
        if (requestGeneration !== liveGpsWakeLockRequestGeneration
            || document.visibilityState !== 'visible'
            || !_hasFreshLiveGpsTelemetry()) {
            try { await wakeLock.release(); } catch (_) {}
            return false;
        }
        liveGpsWakeLock = wakeLock;
        wakeLock.addEventListener('release', () => {
            if (liveGpsWakeLock === wakeLock) liveGpsWakeLock = null;
        }, { once: true });
        console.info(`[GPS] Bildschirm-Wake-Lock aktiv (${reason}).`);
        return true;
    } catch (error) {
        liveGpsWakeLockRetryAfter = Date.now() + 30000;
        console.warn('[GPS] Bildschirm-Wake-Lock konnte nicht aktiviert werden:', error?.message || error);
        return false;
    } finally {
        liveGpsWakeLockRequestPending = false;
    }
}

async function _releaseLiveGpsScreenWakeLock(reason = 'tracker-offline') {
    liveGpsWakeLockRequestGeneration += 1;
    _clearLiveGpsWakeLockTelemetryTimer();
    const wakeLock = liveGpsWakeLock;
    liveGpsWakeLock = null;
    if (!wakeLock || wakeLock.released) return;
    try {
        await wakeLock.release();
        console.info(`[GPS] Bildschirm-Wake-Lock beendet (${reason}).`);
    } catch (_) {}
}

function _handleLiveGpsTelemetryForWakeLock() {
    _scheduleLiveGpsWakeLockTelemetryTimeout();
    _requestLiveGpsScreenWakeLock('tracker-telemetry');
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
        _releaseLiveGpsScreenWakeLock('document-hidden');
        return;
    }
    if (_hasFreshLiveGpsTelemetry()) {
        liveGpsWakeLockRetryAfter = 0;
        _scheduleLiveGpsWakeLockTelemetryTimeout();
        _requestLiveGpsScreenWakeLock('document-visible');
    }
}, { passive: true });
window.addEventListener('ga-sleepchange', (event) => {
    if (!event?.detail?.sleeping) return;
    const lastTelemetryAt = Number(window.gaLastTrackerTelemetryAt || window.lastLiveGpsPos?.t || 0);
    if (Number.isFinite(lastTelemetryAt) && Date.now() - lastTelemetryAt < 15000) return;
    const hadLiveGpsSession = !!liveGpsSocket || !!liveGpsReconnectTimer;
    const reconnectId = getSyncId();
    if (liveGpsReconnectTimer) {
        clearTimeout(liveGpsReconnectTimer);
        liveGpsReconnectTimer = null;
    }
    if (liveGpsSocket) {
        try {
            liveGpsSocket.onopen = null;
            liveGpsSocket.onmessage = null;
            liveGpsSocket.onclose = null;
            liveGpsSocket.onerror = null;
            liveGpsSocket.close();
        } catch (_) {}
        liveGpsSocket = null;
        window.liveTrackerConnected = false;
        window.liveTrackerVersionCode = null;
        _clearTrackerHeartbeat();
        _setLiveGpsIndicator('off');
    }
    if (hadLiveGpsSession && reconnectId) {
        window.gaRunWhenAwake?.('live-gps-reconnect', () => window.connectToLiveGPS(reconnectId));
    }
});
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
// Das produktive Homebase-v1-Protokoll inklusive gezieltem Live-Despawn ist ab
// v288 enthalten; dynamische Assetmetadaten benötigen v289 und die sichere
// Steam-/Store-Community-Pfaderkennung v290; Crew-Homebases v291,
// generische Hangar-Toranimationen v293, der gehärtete Relay-Dispatch v294
// die korrigierte SimConnect-RawBuffer-Übergabe, generische Objektsteuerungen und cachefeste Assetupdates ab v298.
// v320 bleibt die Mindestversion fuer den bestehenden Web-/Relay-Vertrag.
// Neuere Alpha-Capabilities (z. B. EFB-Snapshots ab v323/v324) werden von ihren
// jeweiligen Clients ausgehandelt und duerfen die Stable-Runtime nicht sperren.
const MIN_TRACKER_VERSION_CODE = 320;
const MIN_TRACKER_VERSION_LABEL = 'v320';
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

function _trackerVersionLabel(pkt = null) {
    const explicit = String(pkt?.trackerVersion || '').trim();
    const code = _extractTrackerVersionCode(pkt);
    if (explicit) return explicit;
    if (Number.isFinite(code)) return `v${code}`;
    return String(window.liveTrackerVersionLabel || '').trim();
}

function _setLiveGpsIndicator(state, pkt = null) {
    const ind = document.getElementById('liveGpsIndicator');
    if (!ind) return;
    const nextState = String(state || 'off').toLowerCase();
    const packetLabel = _trackerVersionLabel(pkt);
    if (packetLabel) window.liveTrackerVersionLabel = packetLabel;
    const versionLabel = String(window.liveTrackerVersionLabel || '').trim();
    ind.dataset.trackerState = nextState;
    ind.style.textShadow = 'none';

    if (nextState === 'live') {
        ind.textContent = `🛰️ LIVE${versionLabel ? ` · ${versionLabel}` : ''}`;
        ind.style.color = '#44ff44';
        ind.style.textShadow = '0 0 8px #44ff44';
        ind.title = `PC-Tracker verbunden; Telemetrie aktiv${versionLabel ? ` – Version ${versionLabel}` : ''}`;
        return;
    }
    if (nextState === 'link') {
        ind.textContent = `🛰️ LINK${versionLabel ? ` · ${versionLabel}` : ''}`;
        ind.style.color = '#55d7ff';
        ind.style.textShadow = '0 0 7px rgba(85, 215, 255, 0.75)';
        ind.title = `PC-Tracker am Relay verbunden; warte auf Telemetrie${versionLabel ? ` – Version ${versionLabel}` : ''}`;
        return;
    }
    if (nextState === 'wait') {
        ind.textContent = `🛰️ WAIT${versionLabel ? ` · ${versionLabel}` : ''}`;
        ind.style.color = '#f2c12e';
        ind.title = versionLabel
            ? `Relay verbunden; Tracker ${versionLabel} sendet momentan keine frische Telemetrie`
            : 'Relay verbunden; warte auf Telemetrie vom PC-Tracker';
        return;
    }
    if (nextState === 'wake') {
        ind.textContent = '🛰️ WAKE';
        ind.style.color = '#f2c12e';
        ind.title = 'Relay wird gestartet';
        return;
    }
    window.liveTrackerVersionLabel = '';
    ind.textContent = '🛰️ OFF';
    ind.style.color = '#666';
    ind.title = 'Kein PC-Tracker verbunden';
}

function _trackerHeartbeatIsFresh(now = Date.now()) {
    return Number.isFinite(lastTrackerHeartbeatAt)
        && lastTrackerHeartbeatAt > 0
        && (now - lastTrackerHeartbeatAt) < TRACKER_HEARTBEAT_STALE_MS;
}

function _clearTrackerHeartbeat() {
    if (trackerHeartbeatWatchdog) {
        clearTimeout(trackerHeartbeatWatchdog);
        trackerHeartbeatWatchdog = null;
    }
    lastTrackerHeartbeatAt = 0;
    window.liveTrackerCapabilities = [];
}

function _markTrackerHeartbeat(pkt) {
    lastTrackerHeartbeatAt = Date.now();
    const reportedCapabilities = _trackerCapabilitiesFromPacket(pkt);
    if (reportedCapabilities.length) window.liveTrackerCapabilities = reportedCapabilities;
    _maybePromptTrackerUpdate(pkt);
    if (trackerHeartbeatWatchdog) clearTimeout(trackerHeartbeatWatchdog);
    trackerHeartbeatWatchdog = setTimeout(() => {
        trackerHeartbeatWatchdog = null;
        lastTrackerHeartbeatAt = 0;
        if (liveGpsSocket?.readyState === WebSocket.OPEN) {
            window.liveTrackerVersionCode = null;
            window.liveTrackerVersionLabel = '';
            window.liveTrackerCapabilities = [];
            _setLiveGpsIndicator('wait');
        }
    }, TRACKER_HEARTBEAT_STALE_MS);
}

function _maybePromptTrackerUpdate(pkt) {
    const code = _extractTrackerVersionCode(pkt);
    window.liveTrackerVersionCode = Number.isFinite(code) ? code : null;
    const reportedLabel = _trackerVersionLabel(pkt) || 'keine Versionsnummer';
    if (reportedLabel !== 'keine Versionsnummer') window.liveTrackerVersionLabel = reportedLabel;
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

    const dataPromise = typeof window.gaGetAviationSnapshotForBounds === 'function'
        ? window.gaGetAviationSnapshotForBounds(
            { west: w, south: s, east: e, north: n },
            ['navaids', 'reportingPoints', 'airports']
        )
        : Promise.all([
            fetch(`${proxy}/api/navaids?bbox=${bbox}&limit=250&t=${Date.now()}`),
            fetch(`${proxy}/api/reporting-points?bbox=${bbox}&limit=250&t=${Date.now()}`),
            fetch(`${proxy}/api/airports?bbox=${bbox}&limit=250&t=${Date.now()}`)
        ]).then(async ([navRes, repRes, aptRes]) => {
            if (!navRes.ok || !repRes.ok || !aptRes.ok) throw new Error('openaip_current_nav_unavailable');
            const [navJson, repJson, aptJson] = await Promise.all([navRes.json(), repRes.json(), aptRes.json()]);
            return {
                navaids: navJson.items || [],
                reportingPoints: repJson.items || [],
                airports: aptJson.items || []
            };
        });

    Promise.resolve(dataPromise).then((snapshot) => {
        const next = [];

        (snapshot.navaids || []).forEach(i => {
            const c = currentInfoCoords(i);
            if (!c) return;
            const freqVal = currentInfoReadFreq(i);
            const freq = freqVal ? ` (${freqVal})` : '';
            const idVal = i.identifier || i.designator || '';
            const ident = idVal ? ` [${idVal}]` : '';
            next.push({ name: `${i.name || 'NAV'}${ident}${freq}`, lat: c.lat, lng: c.lng });
        });

        (snapshot.reportingPoints || []).forEach(i => {
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

        (snapshot.airports || []).forEach(i => {
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
    if (typeof window.gaShouldPauseNetwork === 'function' && window.gaShouldPauseNetwork('live-gps')) {
        window.gaRunWhenAwake?.('live-gps-reconnect', () => window.connectToLiveGPS(syncId));
        return;
    }

    const wsUrl = 'wss://websocketrelais.onrender.com/';
    const connectionSeq = ++liveGpsConnectionSeq;
    _clearTrackerHeartbeat();
    if (liveGpsReconnectTimer) {
        clearTimeout(liveGpsReconnectTimer);
        liveGpsReconnectTimer = null;
    }

    // Alte Verbindung schließen, falls wir die ID wechseln
    if (liveGpsSocket) {
        try {
            liveGpsSocket.onopen = null;
            liveGpsSocket.onmessage = null;
            liveGpsSocket.onclose = null;
            liveGpsSocket.onerror = null;
            liveGpsSocket.close();
        } catch (_) {}
    }

    console.log(`[GPS] 📡 Verbinde mit Live-Tracking für Pilot-ID ${syncId}...`);

    // Wake-up Ping: Render.com Free Tier aus dem Schlaf holen bevor WebSocket versucht wird
    window.liveTrackerVersionCode = null;
    window.liveTrackerVersionLabel = '';
    _setLiveGpsIndicator('wake');
    try {
        await fetch('https://websocketrelais.onrender.com/', { method: 'HEAD', mode: 'no-cors', signal: AbortSignal.timeout(8000) });
    } catch(e) { /* Server schläft evtl. noch – WebSocket versucht es trotzdem */ }
    if (connectionSeq !== liveGpsConnectionSeq) return;

    const socket = new WebSocket(wsUrl);
    liveGpsSocket = socket;

    liveGpsSocket.onopen = () => {
        if (socket !== liveGpsSocket || connectionSeq !== liveGpsConnectionSeq) return;
        console.log(`[GPS] ✅ Verbunden! Warte auf Flugzeug-Daten...`);
        gpsReconnectDelay = 2000; // Erfolg → Backoff zurücksetzen
        const now = Date.now();
        lastTrackerReconnectAt = now;
        if (lastTrackerDisconnectAt && (now - lastTrackerDisconnectAt) <= 30000) {
            trackerReconnectRecoveryUntil = now + 20000;
        }
        window.liveTrackerConnected = true;
        _missionPhaseDebugPush('tracker_connection', {
            state: 'open',
            reconnectResyncPending: !!missionSceneReconnectResyncPending,
            runtimeActive: !!missionRuntime.active,
            runtimeClosing: !!missionRuntime.closingPending,
            startPhase: _missionStartPhase(),
            sceneId: window.missionSceneStatus?.sceneId || null,
            sceneSpawned: !!window.missionSceneStatus?.spawned,
            personBoarded: !!window.missionSceneStatus?.personBoarded
        });
        _updateMissionRuntimeUi();
        if (typeof window.scheduleTerrainAvoidOverlayUpdate === 'function') window.scheduleTerrainAvoidOverlayUpdate(true);
        // Dem Server mitteilen, in welchen Raum wir wollen (mit PIN!)
        socket.send(JSON.stringify({ type: 'join', syncId: syncId, pin: getSyncPin() }));
        if (missionInterruptedDeboardingRecovery) {
            setTimeout(() => _missionSceneCancelInterruptedDeboarding('websocket-open'), 350);
        }
        setTimeout(() => _trackerPendingResendAll('websocket-open'), 300);
        if (missionRuntime.active) {
            setTimeout(() => _sendMissionLifecycleToTracker('active', 'websocket-open-resume'), 180);
        } else if (missionRuntime.closingPending) {
            setTimeout(() => _sendMissionLifecycleToTracker('closing', 'websocket-open-resume'), 180);
        }
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

        _setLiveGpsIndicator('wait');
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
        if (socket !== liveGpsSocket || connectionSeq !== liveGpsConnectionSeq) return;
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
            if (data.type === 'gps'
                && data.trackerStatusOnly === true
                && data.source === 'tracker'
                && data.status === 'connected') {
                _markTrackerHeartbeat(data);
                const indicatorState = document.getElementById('liveGpsIndicator')?.dataset?.trackerState;
                if (indicatorState !== 'live') _setLiveGpsIndicator('link', data);
                return;
            }
            if (data.type === 'gps') {
                if (!Number.isFinite(Number(data.lat)) || !Number.isFinite(Number(data.lon))) return;
                _markTrackerHeartbeat(data);
                try {
                    window.dispatchEvent(new CustomEvent('homebasetelemetry', { detail: { data } }));
                } catch (_) {}
                try {
                    if (data.trackerMissionAuthority && typeof data.trackerMissionAuthority === 'object') {
                        _handleTrackerMissionAuthoritySnapshot(data.trackerMissionAuthority, 'tracker-gps-authority');
                    } else if (data.trackerMissionStatus && typeof data.trackerMissionStatus === 'object') {
                        window.lastTrackerMissionStatus = {
                            ...data.trackerMissionStatus,
                            receivedAt: Date.now()
                        };
                        _handleTrackerMissionStatus(window.lastTrackerMissionStatus, 'tracker-gps-status');
                    }
                } catch (authorityError) {
                    // Authority-Projektionen duerfen niemals das eigentliche GPS-Paket
                    // verwerfen. Telemetrie und LIVE-Anzeige laufen weiter; der Fehler
                    // bleibt fuer die Diagnose sichtbar.
                    console.error('[MISSION AUTH] Tracker-Projektion fehlgeschlagen; Telemetrie laeuft weiter:', authorityError);
                }
                if (data.flight && typeof data.flight === 'object') {
                    window.lastLiveFlightData = data.flight;
                    window.missionCargoHandleLiveFuelUpdate?.(data.flight);
                }
                updateLivePlanePosition(data.lat, data.lon, data.alt, data.hdg);
                _handleLiveGpsTelemetryForWakeLock();

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
                    _scheduleLiveTrafficMapRender(filteredTraffic, data.alt);
                }

                _setLiveGpsIndicator('live', data);

                // Watchdog: Timer bei jedem neuen Paket zurücksetzen
                clearTimeout(gpsWatchdog);
                gpsWatchdog = setTimeout(() => {
                    const ind = document.getElementById('liveGpsIndicator');
                    if (ind?.dataset?.trackerState === 'live') {
                        _setLiveGpsIndicator(_trackerHeartbeatIsFresh() ? 'link' : 'wait');
                    }
                }, 3000);
            }
            if (data.type === 'traffic') {
                window.vpTrafficData = data.aircraft || [];
                _scheduleLiveTrafficMapRender(window.vpTrafficData, window.lastLiveGpsPos?.alt);
            }
        } catch (e) {
            console.error('[GPS] Fehler beim Lesen der Daten:', e);
        }
    };

    liveGpsSocket.onclose = () => {
        if (socket !== liveGpsSocket || connectionSeq !== liveGpsConnectionSeq) return;
        clearTimeout(gpsWatchdog);
        _clearTrackerHeartbeat();
        liveGpsSocket = null;
        lastTrackerDisconnectAt = Date.now();
        window.liveTrackerConnected = false;
        _missionPhaseDebugPush('tracker_connection', {
            state: 'closed',
            runtimeActive: !!missionRuntime.active,
            runtimeClosing: !!missionRuntime.closingPending,
            startPhase: _missionStartPhase(),
            sceneId: window.missionSceneStatus?.sceneId || null,
            sceneSpawned: !!window.missionSceneStatus?.spawned,
            personBoarded: !!window.missionSceneStatus?.personBoarded
        });
        window.liveTrackerVersionCode = null;
        _releaseLiveGpsScreenWakeLock('websocket-close');
        _updateMissionRuntimeUi();
        if (typeof window.scheduleTerrainAvoidOverlayUpdate === 'function') window.scheduleTerrainAvoidOverlayUpdate(true);
        _setLiveGpsIndicator('off');
        hideNextWpTelemetry();

        // Auto-HDG zurücksetzen damit es bei der nächsten Verbindung wieder greift
        window._hdgAutoActivated = false;

        // Exponentielles Backoff: 2s → 4s → 8s → max 15s (fängt Render.com Cold Starts sauber ab)
        console.warn(`[GPS] ❌ Verbindung getrennt. Reconnect in ${(gpsReconnectDelay/1000).toFixed(0)}s...`);
        liveGpsReconnectTimer = setTimeout(() => {
            liveGpsReconnectTimer = null;
            if (connectionSeq === liveGpsConnectionSeq) {
                if (typeof window.gaShouldPauseNetwork === 'function' && window.gaShouldPauseNetwork('live-gps')) {
                    window.gaRunWhenAwake?.('live-gps-reconnect', () => window.connectToLiveGPS(syncId));
                } else {
                    connectToLiveGPS(syncId);
                }
            }
        }, gpsReconnectDelay);
        gpsReconnectDelay = Math.min(gpsReconnectDelay * 2, 15000);
    };

    liveGpsSocket.onerror = () => {
        if (socket !== liveGpsSocket || connectionSeq !== liveGpsConnectionSeq) return;
        clearTimeout(gpsWatchdog);
        _clearTrackerHeartbeat();
        lastTrackerDisconnectAt = Date.now();
        window.liveTrackerConnected = false;
        _missionPhaseDebugPush('tracker_connection', {
            state: 'error',
            runtimeActive: !!missionRuntime.active,
            runtimeClosing: !!missionRuntime.closingPending,
            startPhase: _missionStartPhase(),
            sceneId: window.missionSceneStatus?.sceneId || null,
            sceneSpawned: !!window.missionSceneStatus?.spawned,
            personBoarded: !!window.missionSceneStatus?.personBoarded
        });
        window.liveTrackerVersionCode = null;
        _releaseLiveGpsScreenWakeLock('websocket-error');
        _updateMissionRuntimeUi();
        if (typeof window.scheduleTerrainAvoidOverlayUpdate === 'function') window.scheduleTerrainAvoidOverlayUpdate(true);
        _setLiveGpsIndicator('off');
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

function _canRunLiveMapVisualWork() {
    if (typeof document === 'undefined' || document.hidden) return false;
    const board = document.getElementById('mapTableOverlay');
    return !!(board && board.classList.contains('active'));
}

function _refreshMissionArrivalGuideLine(lat = null, lon = null) {
    if (typeof window.vpUpdateMissionArrivalGuideLine !== 'function') return false;
    const pos = window.lastLiveGpsPos || {};
    const phase = String(missionRuntime.phase || '').toLowerCase();
    return window.vpUpdateMissionArrivalGuideLine({
        lat: Number(lat ?? pos.lat),
        lon: Number(lon ?? pos.lon),
        onGround: window.lastLiveFlightData?.onGround === true,
        missionActive: !!missionRuntime.active && !missionRuntime.closingPending && phase !== 'closing'
    });
}

function _liveTrailDistanceM(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return Number.POSITIVE_INFINITY;
    if (typeof map !== 'undefined' && map && typeof map.distance === 'function') {
        return map.distance(a, b);
    }
    const lat1 = Number(a[0]) * Math.PI / 180;
    const lat2 = Number(b[0]) * Math.PI / 180;
    const dLat = lat2 - lat1;
    const dLon = (Number(b[1]) - Number(a[1])) * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

function _recordLiveTrailPoint(lat, lon) {
    const point = [Number(lat), Number(lon)];
    if (!point.every(Number.isFinite)) return false;
    if (lastTrailPoint && _liveTrailDistanceM(lastTrailPoint, point) <= 20) return false;
    liveSnailTrailPoints.push(point);
    lastTrailPoint = point;
    if (liveSnailTrailPoints.length > LIVE_SNAIL_TRAIL_TRIM_AT) {
        liveSnailTrailPoints = liveSnailTrailPoints.slice(-LIVE_SNAIL_TRAIL_KEEP_POINTS);
        liveSnailTrailNeedsFullSync = true;
    }
    liveSnailTrailDirty = true;
    return true;
}

function _renderLiveTrailIfNeeded(now = Date.now(), force = false) {
    if (!_canRunLiveMapVisualWork() || typeof map === 'undefined' || !map || typeof L === 'undefined') return false;
    if (!liveSnailTrail) {
        liveSnailTrail = L.polyline([], {
            color: '#1a4bb3',
            weight: 3,
            opacity: 0.7,
            dashArray: '5, 10',
            interactive: false
        }).addTo(map);
        liveSnailTrailNeedsFullSync = true;
    }
    if (!force && (!liveSnailTrailDirty || (now - lastLiveSnailTrailRenderAt) < LIVE_SNAIL_TRAIL_RENDER_INTERVAL_MS)) return false;
    if (liveSnailTrailNeedsFullSync || liveSnailTrailRenderedCount > liveSnailTrailPoints.length) {
        liveSnailTrail.setLatLngs(liveSnailTrailPoints);
    } else {
        for (let i = liveSnailTrailRenderedCount; i < liveSnailTrailPoints.length; i += 1) {
            liveSnailTrail.addLatLng(liveSnailTrailPoints[i]);
        }
    }
    liveSnailTrailRenderedCount = liveSnailTrailPoints.length;
    liveSnailTrailNeedsFullSync = false;
    liveSnailTrailDirty = false;
    lastLiveSnailTrailRenderAt = now;
    return true;
}

function _runLiveMissionTriggerTick(lat, lon, alt) {
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
    const paxMissionTickActive = !!(
        missionRuntime.active
        && !missionRuntime.closingPending
        && String(missionRuntime.phase || '').toLowerCase() !== 'closing'
    );
    if (paxMissionTickActive && typeof window.checkPaxPoiProximity === 'function') {
        const paxAlt = Math.max(0, Math.round(alt));
        const aglFromTracker = Number(window.lastLiveFlightData?.aglFt);
        const paxFlightData = Object.assign({}, window.lastLiveFlightData || {}, {
            mslFt: paxAlt,
            aglFt: Number.isFinite(aglFromTracker) ? Math.max(0, Math.round(aglFromTracker)) : paxAlt
        });
        window.checkPaxPoiProximity(lat, lon, paxFlightData);
    }
}

function _flushPendingLiveTrafficMapRender() {
    if (liveTrafficRenderTimer) {
        clearTimeout(liveTrafficRenderTimer);
        liveTrafficRenderTimer = null;
    }
    if (!_canRunLiveMapVisualWork() || !window.vpTrafficMapVisible) return false;
    const pending = liveTrafficRenderPending || {
        aircraft: Array.isArray(window.vpTrafficData) ? window.vpTrafficData : [],
        ownAlt: window.lastLiveGpsPos?.alt
    };
    liveTrafficRenderPending = null;
    updateTrafficOnMap(pending.aircraft, pending.ownAlt);
    lastLiveTrafficRenderAt = Date.now();
    return true;
}

function _scheduleLiveTrafficMapRender(aircraft, ownAlt, options = {}) {
    liveTrafficRenderPending = {
        aircraft: Array.isArray(aircraft) ? aircraft : [],
        ownAlt
    };
    if (!_canRunLiveMapVisualWork() || !window.vpTrafficMapVisible) return false;
    const now = Date.now();
    const waitMs = LIVE_TRAFFIC_RENDER_INTERVAL_MS - (now - lastLiveTrafficRenderAt);
    if (options.immediate === true || waitMs <= 0) return _flushPendingLiveTrafficMapRender();
    if (!liveTrafficRenderTimer) {
        liveTrafficRenderTimer = setTimeout(_flushPendingLiveTrafficMapRender, Math.max(16, waitMs));
    }
    return true;
}

window.gaRequestLiveMapVisualRefresh = function(reason = 'map-visible') {
    forceLiveMapVisualRefresh = true;
    lastPredictionUpdate = 0;
    liveSnailTrailDirty = true;
    if (_canRunLiveMapVisualWork()) {
        _refreshMissionArrivalGuideLine();
        _scheduleLiveTrafficMapRender(window.vpTrafficData || [], window.lastLiveGpsPos?.alt, { immediate: true });
        if (typeof window.scheduleTerrainAvoidOverlayUpdate === 'function') {
            window.scheduleTerrainAvoidOverlayUpdate(true);
        }
    }
    if (window.gaDebugPush) window.gaDebugPush('performance', 'Live map visual refresh requested', { reason: String(reason || '') });
};

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && _canRunLiveMapVisualWork()) window.gaRequestLiveMapVisualRefresh('document-visible');
}, { passive: true });

function updateLivePlanePosition(lat, lon, alt, hdg) {
    const now = Date.now();
    lastTelemetryUpdateAt = now;
    window.gaLastTrackerTelemetryAt = now;
    const simGsNow = Number(window.lastLiveFlightData?.gsKts ?? window.lastLiveFlightData?.gs);
    const curGs = Number.isFinite(simGsNow) ? simGsNow : smoothedGS;
    window.lastLiveGpsPos = { lat, lon, alt, hdg, t: now, gs: curGs };
    window.gaUpdateMapContextOwnAltitude?.(alt);
    _recordLiveTrailPoint(lat, lon);
    _missionSceneHandleFlightTick(window.lastLiveFlightData || {}, 'gps-tick');
    if (now - lastMissionRuntimeLiveUiRefreshAt > 650) {
        lastMissionRuntimeLiveUiRefreshAt = now;
        _updateMissionRuntimeUi();
    }
    if (missionRuntime.active || missionRuntime.closingPending || ['prepare', 'boarding', 'boarded'].includes(_missionStartPhase())) {
        _persistMissionRuntimeSnapshot('gps-tick', { minIntervalMs: 3500 });
    }
    if (typeof map === 'undefined' || !map || typeof L === 'undefined') {
        // Missionslogik ist ausdrücklich unabhängig davon, ob der Kartentisch
        // bereits initialisiert oder gerade geöffnet ist.
        _runLiveMissionTriggerTick(lat, lon, alt);
        return;
    }
    const liveMapVisualActive = _canRunLiveMapVisualWork();

    if (liveMapVisualActive) _refreshMissionArrivalGuideLine(lat, lon);
    if (liveMapVisualActive && typeof window.scheduleTerrainAvoidOverlayUpdate === 'function') {
        window.scheduleTerrainAvoidOverlayUpdate(false);
    }
    if (typeof window.terrainAvoidHandleFlightState === 'function') window.terrainAvoidHandleFlightState();
    if (liveMapVisualActive) window.updateCompassHeading(hdg);

    // --- FEATURE 1: SNAIL TRAIL ---
    // Positionspunkte werden oben immer gepuffert; nur die Leaflet-Linie pausiert
    // bei geschlossenem Kartentisch. So gehen keine geflogenen Abschnitte verloren.
    _renderLiveTrailIfNeeded(now, forceLiveMapVisualRefresh);

    let autoFollowGs = curGs;

    // --- FEATURE 2: TELEMETRY (GS & VS) ---
    if (lastGpsTickDetails) {
        const dt = (now - lastGpsTickDetails.t) / 1000; // Sekunden
        if (dt > 1.0) { // UI-Update-Schutz & Smoothing (ca. 1 Sekunde)
            const distM = map.distance([lastGpsTickDetails.lat, lastGpsTickDetails.lon], [lat, lon]);
            const calcGs = (distM / dt) * 1.94384;
            const simGs = Number(window.lastLiveFlightData?.gsKts ?? window.lastLiveFlightData?.gs);
            const gs = Number.isFinite(simGs) ? simGs : calcGs;
            const vs = ((alt - lastGpsTickDetails.alt) / dt) * 60;
            autoFollowGs = Number.isFinite(gs) ? gs : autoFollowGs;

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
            // Smoothed GS/VS for prediction (EMA alpha=0.3)
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
            window.lastLiveGpsPos = { lat, lon, alt, hdg, t: now, gs: autoFollowGs };
        }
    } else {
        lastGpsTickDetails = { lat, lon, alt, t: now };
        const nextInfo = updateNextWpTelemetry(lat, lon);
        updateRouteProgressBar(lat, lon, curGs, nextInfo);
        updateCurrentInfoTelemetry(lat, lon, alt);
    }

    // --- FEATURE 3: AUTO-FOLLOW ---
    const lowFpsMode = isLowFpsModeActive();
    if (liveMapVisualActive && isAutoFollow) {
        const autoFollowViewApplied = applyAutoFollowViewNow({
            sample: { lat, lon, alt, gs: autoFollowGs, hdg, now, lowFpsMode },
            panFallback: false
        });
        if (autoFollowViewApplied) {
            // handled by applyAutoFollowViewNow()
        } else if (!lowFpsMode) {
            markAutoFollowProgrammaticMapMove(now);
            map.panTo([lat, lon]);
            lastAutoFollowPanAt = now;
            lastAutoFollowPanPos = [lat, lon];
        } else {
            const movedM = lastAutoFollowPanPos ? map.distance(lastAutoFollowPanPos, [lat, lon]) : Number.POSITIVE_INFINITY;
            const canPanByTime = (now - lastAutoFollowPanAt) >= 320;
            const canPanByDist = movedM >= 45;
            if (canPanByTime && canPanByDist) {
                markAutoFollowProgrammaticMapMove(now);
                map.panTo([lat, lon], { animate: false });
                lastAutoFollowPanAt = now;
                lastAutoFollowPanPos = [lat, lon];
            }
        }
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

        // Linie nur zeichnen, wenn der Kartentisch sichtbar ist. Die darunterliegende
        // TAWS-/Airspace-Auswertung läuft unabhängig davon weiter.
        if (liveMapVisualActive) {
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
            const predictionGeneration = ++livePredictionGeneration;
            checkTerrainAlongPath(_tawsPredPoints).then(results => {
                if (!results || predictionGeneration !== livePredictionGeneration) return;
                // Airspace-Warnungen mit Terrain-Info füttern (AGL-Limits korrekt auswerten).
                if (typeof checkAirspaceWarnings === 'function') {
                    const terrainFallback = Number(window.lastLiveTerrainFt) || 0;
                    const awmPts = _awmPredPoints.map((p, idx) => ({
                        ...p,
                        terrainFt: Number(results[idx]?.terrainFt ?? terrainFallback) || 0
                    }));
                    checkAirspaceWarnings(awmPts);
                }

                if (_canRunLiveMapVisualWork()) {
                    // Worst-case Threat bestimmt Linienfarbe
                    let worst = 'green';
                    for (const r of results.slice(0, predPoints.length)) {
                        if (r.threat === 'red') { worst = 'red'; break; }
                        if (r.threat === 'amber') worst = 'amber';
                    }
                    const color = worst === 'red' ? '#ff2222' : worst === 'amber' ? '#ffaa00' : '#ffffff';
                    if (predictionLine) predictionLine.setStyle({ color });

                    // Marker-Farben: Terrain hat Priorität, danach Luftraum-Farbe
                    predictionMarkers.forEach((m, i) => {
                        const pt = predPoints[i];
                        const terrain = results[i];
                        let c = '#ffffff';
                        if (terrain?.threat === 'red') c = '#ff2222';
                        else if (terrain?.threat === 'amber') c = '#ffaa00';
                        else if (pt) {
                            const asC = _getAirspaceColorForPredPoint(pt);
                            if (asC) c = asC;
                        }
                        m.setStyle({ color: c, fillColor: c });
                    });
                }

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

        if (liveMapVisualActive) {
            // Zeitmarker zeichnen/updaten
            while (predictionMarkers.length < predPoints.length) {
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
        }
    } else if (smoothedGS <= 30) {
        livePredictionGeneration += 1;
        // Zu langsam → Prediction ausblenden
        if (predictionLine) { predictionLine.remove(); predictionLine = null; }
        predictionMarkers.forEach(m => m.remove());
        predictionMarkers = [];
    }

    // --- ICON A: KARTE ---
    // SVG nur einmal bauen, danach nur per CSS-Transform rotieren (kein innerHTML-Rebuild pro Paket!)
    if (liveMapVisualActive && !liveGpsMarker) {
        const _planeSvgTemplate = `
        <div class="live-plane-inner" style="width: var(--plane-size); height: var(--plane-size); filter: drop-shadow(0 0 5px rgba(0,0,0,0.6)); position: relative; transform: translate(-50%, -37%);">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 447.74 339.91" style="transform-origin: 50% 37%; width: 100%; height: 100%; will-change: transform;">
                <path fill="var(--plane-color)" stroke="#000" stroke-width="16" stroke-linejoin="round" stroke-linecap="round" d="M447.22,118.14a2,2,0,0,0-1.48-.65H443a61.87,61.87,0,0,0-6.2-19.62,8.66,8.66,0,0,0-7.67-4.6H290.3a13.4,13.4,0,0,1-4.61-.81L259.8,83a10.84,10.84,0,0,1-7.09-8.94c-1.44-12.06-4.15-34.18-6.06-46.78a16.45,16.45,0,0,0-10.94-13.17c-.9-.31-1.81-.59-2.69-.82a1.94,1.94,0,0,1-1.4-1.37,29.46,29.46,0,0,0-5.37-10.72,3.45,3.45,0,0,0-5.28,0A29.37,29.37,0,0,0,215.6,12a2,2,0,0,1-1.4,1.37c-.88.23-1.79.51-2.69.82a16.46,16.46,0,0,0-10.95,13.17C198.67,39.84,196,62,194.51,74.09A10.84,10.84,0,0,1,187.42,83l-25.89,9.43a13.4,13.4,0,0,1-4.61.81H18a8.66,8.66,0,0,0-7.66,4.6,61.62,61.62,0,0,0-6.2,19.62H2a2,2,0,0,0-2,2.19l.63,6.83a2,2,0,0,0,2,1.82h.72v.33A71.32,71.32,0,0,0,6.5,150a49.32,49.32,0,0,0,8.4,16.31,5.49,5.49,0,0,0,4.28,2H196.94c.84,5.65,13.56,91.52,17.94,122h-50.2a11.94,11.94,0,0,0-11.92,11.92v13.57a11.94,11.94,0,0,0,11.92,11.92H224.5v11.4c0,.37.64.71,1,.71s1.1-.34,1.1-.71V327.8h59.82a11.94,11.94,0,0,0,11.92-11.92V302.31a11.94,11.94,0,0,0-11.92-11.92H232.34c4.38-30.49,17.1-116.36,17.93-122H428a5.53,5.53,0,0,0,4.29-2,49.32,49.32,0,0,0,8.4-16.31,71.64,71.64,0,0,0,3.14-21.38v-.33h1.24a2,2,0,0,0,2-1.82l.63-6.83A2,2,0,0,0,447.22,118.14Zm-4.62,1c0,.27.07.54.1.81l.09.87C442.74,120.3,442.67,119.74,442.6,119.19ZM443,123c0,.14,0,.29,0,.44s0,.58.05.86h0C443,123.9,443,123.46,443,123Zm.09,1.32v.06c0,.12,0,.24,0,.37C443.08,124.63,443.08,124.49,443.07,124.35Z"/>
            </svg>
            <div style="position:absolute; left:50%; top:37%; width:4px; height:4px; background:#000; border-radius:50%; transform:translate(-50%,-50%); pointer-events:none;"></div>
        </div>
    `;

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
        // DOM-Referenzen bleiben bis zum Entfernen des Markers stabil.
        liveGpsMarkerElement = liveGpsMarker.getElement();
        liveGpsMarkerSvgElement = liveGpsMarkerElement?.querySelector('svg') || null;
        if (liveGpsMarkerSvgElement) liveGpsMarkerSvgElement.style.transform = `rotate(${hdg}deg)`;
        if (liveGpsMarkerElement) liveGpsMarkerElement.style.pointerEvents = 'none';
        if (typeof window.updateLivePlanePerformanceMode === 'function') {
            window.updateLivePlanePerformanceMode(lowFpsMode);
            lastLivePlanePerformanceMode = lowFpsMode;
        }

        bindAutoFollowMapInteractionHandlers();
    } else if (liveMapVisualActive) {
        liveGpsMarker.setLatLng([lat, lon]);
        // Im Low-FPS-Mode die Heading-Rotation leicht drosseln, um Repaint-Spitzen zu vermeiden.
        if (!lowFpsMode || (now - lastLivePlaneHeadingUpdateAt) >= 120) {
            if (liveGpsMarkerSvgElement) liveGpsMarkerSvgElement.style.transform = `rotate(${hdg}deg)`;
            lastLivePlaneHeadingUpdateAt = now;
        }
        if (lastLivePlanePerformanceMode !== lowFpsMode && typeof window.updateLivePlanePerformanceMode === 'function') {
            window.updateLivePlanePerformanceMode(lowFpsMode);
            lastLivePlanePerformanceMode = lowFpsMode;
        }
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
        const aglEl = liveMapVisualActive ? document.getElementById('teleAGL') : null;
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

    if (liveMapVisualActive) forceLiveMapVisualRefresh = false;
    _runLiveMissionTriggerTick(lat, lon, alt);
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
        bankSamples: 0,
        maxGForce: 1.0,
        sumGForce: 0,
        gForceSamples: 0,
        maxAglFt: 0,
        maxClimbFpm: 0,
        maxDescentFpm: 0,
        minEnrouteAglFt: null,
        enrouteSamples: 0,
        aglSamples: 0,
        levelAltSamples: 0,
        levelAltMeanFt: 0,
        levelAltM2: 0,
        levelAltMinFt: null,
        levelAltMaxFt: null,
        levelAltDurationSec: 0
    };
}

function addFlightTrackPoint(lat, lon, alt, now, force = false) {
    const r = flightRecorder;
    const prev = r.track.length ? r.track[r.track.length - 1] : null;
    if (!force && prev) {
        const prevLatLng = [prev[0], prev[1]];
        const dM = _liveTrailDistanceM(prevLatLng, [lat, lon]);
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
    const telemetrySampleCount = Math.max(r.gsSamples || 0, r.bankSamples || 0, r.gForceSamples || 0);
    const hasFlightEvidence = !!(
        r.hadAirbornePhase
        || Number(r.airborneEvidenceSec || 0) >= 8
        || Number(r.maxAglFt || 0) >= 500
    );
    if (!hasFlightEvidence || durationSec < 15 || telemetrySampleCount < 2) {
        return null;
    }

    const track = compactFlightTrackForStorage(r.track, 220);
    const dep = track.length ? track[0] : null;
    const arr = track.length ? track[track.length - 1] : null;
    const depLabel = (typeof currentStartICAO !== 'undefined' && currentStartICAO)
        ? currentStartICAO
        : (dep ? nearestAirportLabel(dep[0], dep[1]) : 'START');
    const arrLabel = (typeof currentDestICAO !== 'undefined' && currentDestICAO && currentDestICAO !== 'POI')
        ? currentDestICAO
        : (arr ? nearestAirportLabel(arr[0], arr[1]) : 'LANDUNG');
    const measuredDistanceNm = Number.isFinite(Number(r.distNm)) && Number(r.distNm) >= 0.05
        ? Number(Number(r.distNm).toFixed(1))
        : null;

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
        distanceNm: measuredDistanceNm,
        distanceSource: measuredDistanceNm == null ? 'unavailable' : 'gps',
        avgGs: Number(avgGs.toFixed(1)),
        maxGs: Number(r.maxGs.toFixed(1)),
        maxAltFt: Math.round(r.maxAltFt),
        touchdownVsFpm: Number.isFinite(r.touchdownVsFpm) ? Math.round(r.touchdownVsFpm) : null,
        track,
        maxBankDeg: r.bankSamples > 0 ? Number((r.maxBankDeg || 0).toFixed(1)) : null,
        maxGForce: r.gForceSamples > 0 ? Number((r.maxGForce || 1.0).toFixed(2)) : null,
        avgGForce: r.gForceSamples > 0 ? Number((r.sumGForce / r.gForceSamples).toFixed(2)) : null,
        maxClimbFpm: Number.isFinite(r.maxClimbFpm) ? Math.round(r.maxClimbFpm) : 0,
        maxDescentFpm: Number.isFinite(r.maxDescentFpm) ? Math.round(r.maxDescentFpm) : 0,
        minEnrouteAglFt: Number.isFinite(r.minEnrouteAglFt) ? Math.round(r.minEnrouteAglFt) : null,
        cruiseAltitudeMeanFt: r.levelAltSamples >= 10 ? Math.round(r.levelAltMeanFt) : null,
        cruiseAltitudeStdDevFt: r.levelAltSamples >= 10 ? Math.round(Math.sqrt(r.levelAltM2 / Math.max(1, r.levelAltSamples - 1))) : null,
        cruiseAltitudeRangeFt: r.levelAltSamples >= 10 && Number.isFinite(r.levelAltMinFt) && Number.isFinite(r.levelAltMaxFt)
            ? Math.round(r.levelAltMaxFt - r.levelAltMinFt)
            : null,
        telemetrySampleCount: Math.round(telemetrySampleCount),
        bankSampleCount: Math.round(r.bankSamples || 0),
        gForceSampleCount: Math.round(r.gForceSamples || 0),
        enrouteSampleCount: Math.round(r.enrouteSamples || 0),
        aglSampleCount: Math.round(r.aglSamples || 0),
        cruiseSampleCount: Math.round(r.levelAltSamples || 0),
        cruiseDurationSec: Math.round(r.levelAltDurationSec || 0),
        telemetryStatus: r.bankSamples > 0 && r.gForceSamples > 0
            ? 'complete'
            : (telemetrySampleCount > 0 ? 'partial' : 'unavailable')
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

        // Der Recorder liefert nur einen kurzlebigen Abschlussdatensatz.
        // Roh-Track und Telemetrie werden nicht automatisch im Local Storage
        // oder an der Pinnwand abgelegt.
        missionRuntime.arrivalFlightRecord = record;
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
    try {
        window.missionCargoHandleAircraftMovement?.({
            ...(_lfd || {}),
            gsKts: gs,
            aglFt: agl,
            onGround: hasOnGroundFlag ? onGroundNow : undefined
        });
    } catch (_) {}
    window.missionMaybeTriggerPickupDepartureVoice?.({
        ...(_lfd || {}),
        gsKts: gs,
        aglFt: agl,
        onGround: hasOnGroundFlag ? onGroundNow : undefined
    });
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
            const activeMissionOnGround = missionRuntime.active || _missionStartPhase() === 'boarded';
            const allowReset = !activeMissionOnGround && !meaningfulMission && !reconnectRecovery && !!depCtx.nearDeparture;
            if (!allowReset) {
                const reasons = [
                    activeMissionOnGround ? 'active-mission-ground' : '',
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
    if (r.lastSample) {
        const dM = _liveTrailDistanceM(r.lastSample, [lat, lon]);
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
        if (Number.isFinite(_lfd.bankDeg)) {
            r.maxBankDeg = Math.max(r.maxBankDeg, Math.abs(_lfd.bankDeg));
            r.bankSamples += 1;
        }
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

    // Nur Streckenflug auswerten: stabil airborne, bereits von der Abflugphase
    // entfernt und (falls bestimmbar) noch nicht im Zielanflug. Gespeichert
    // werden ausschliesslich Aggregate, keine Telemetriepunkte.
    let dTargetNm = null;
    try { dTargetNm = _distanceToMissionTargetNm(lat, lon); } catch (_) {}
    const enrouteSample = airborneNow
        && r.airborneEvidenceSec >= 30
        && r.distNm >= 2
        && gs >= 35
        && (dTargetNm == null || !Number.isFinite(Number(dTargetNm)) || Number(dTargetNm) > 2);
    if (enrouteSample) r.enrouteSamples += 1;
    if (enrouteSample && _lfd?.aglFt != null && Number.isFinite(Number(_lfd.aglFt))) {
        const directAgl = Math.max(0, Number(_lfd.aglFt));
        r.minEnrouteAglFt = Number.isFinite(r.minEnrouteAglFt)
            ? Math.min(r.minEnrouteAglFt, directAgl)
            : directAgl;
        r.aglSamples += 1;
    }
    if (enrouteSample && Number.isFinite(Number(alt)) && Number.isFinite(smoothedVS) && Math.abs(smoothedVS) <= 350) {
        const altitudeFt = Number(alt);
        r.levelAltSamples += 1;
        const delta = altitudeFt - r.levelAltMeanFt;
        r.levelAltMeanFt += delta / r.levelAltSamples;
        r.levelAltM2 += delta * (altitudeFt - r.levelAltMeanFt);
        r.levelAltMinFt = Number.isFinite(r.levelAltMinFt) ? Math.min(r.levelAltMinFt, altitudeFt) : altitudeFt;
        r.levelAltMaxFt = Number.isFinite(r.levelAltMaxFt) ? Math.max(r.levelAltMaxFt, altitudeFt) : altitudeFt;
        r.levelAltDurationSec += Math.min(2, Math.max(0, dtSec));
    }

    addFlightTrackPoint(lat, lon, alt, now, false);

    // Touchdown-Trigger (Live-Tracker): Rollmeldung und Farewell-Preload.
    // Der eigentliche Abschied startet erst über die bestätigte Ground-Action.
    if (r.armed && r.hadAirbornePhase && onGroundNow && !r.wasOnGround) {
        if (Number.isFinite(_lfd?.touchdownFpm)) r.touchdownVsFpm = _lfd.touchdownFpm;
        else if (Number.isFinite(smoothedVS)) r.touchdownVsFpm = smoothedVS;
        const earlyRecord = _buildFlightRecordSnapshot(now);
        const dAptArrivalNm = _hasAptArrivalRuntimePoint() ? _distanceToAptArrivalNm(lat, lon) : null;
        const dMissionTouchdownNm = _distanceToMissionTargetNm(lat, lon);
        const nearFarewellTarget = !!(
            (Number.isFinite(Number(dAptArrivalNm)) && Number(dAptArrivalNm) <= 1.2)
            || (Number.isFinite(Number(dMissionTouchdownNm)) && Number(dMissionTouchdownNm) <= 1.2)
        );
        if (earlyRecord && nearFarewellTarget) {
            _missionPrepareFarewellVoice(earlyRecord, 'touchdown-preload');
            try {
                window.missionCargoRecordFlightEvent?.('landing', Number(earlyRecord.endTs || now), {
                    showBanner: true,
                    delayMs: 250
                });
            } catch (_) {}
        }
        if (_hasAptArrivalRuntimePoint()) {
            if (earlyRecord) missionRuntime.arrivalFlightRecord = earlyRecord;
            if (!missionRuntime.landingRollTriggered && typeof window.triggerPaxLandingRoll === 'function') {
                missionRuntime.landingRollTriggered = true;
                window.triggerPaxLandingRoll(earlyRecord);
            }
        }
    }
    r.wasOnGround = onGroundNow;

    if (_missionSceneIsBushMission()) {
        _missionBushUpdateProgress(lat, lon, now);
    }
    if (_missionSceneIsSarHeliMission()) {
        window.missionSarHeliUpdateProgress?.(lat, lon, now, window.lastLiveFlightData || {});
    }

    // Missionsende / Bodenfall:
    // - am Ziel + stillstand -> Farewell sprechen, danach Deboarding/Mission schließen
    // - woanders + stillstand -> humorvoller Hinweis, mission bleibt offen
    const endReady = _missionEndReadiness(lat, lon);
    const bushGroundEndReady = _missionBushGroundEndReady(endReady);
    const runtimeGroundEndReady = _missionRuntimeGroundEndReady(endReady);
    if (runtimeGroundEndReady && !missionRuntime.waitingFarewellDeboarding && !missionRuntime.closingPending) {
        const endRecord = missionRuntime.arrivalFlightRecord || _buildFlightRecordSnapshot(now);
        if (endRecord) _missionPrepareFarewellVoice(endRecord, 'ground-end-ready-preload');
        try {
            window.missionCargoRecordFlightEvent?.('landing', Number(endRecord?.endTs || now), {
                showBanner: true,
                delayMs: 250
            });
            window.missionComplianceEnsureFinalDecision?.();
        } catch (_) {}
    }
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
            const paxVoiceEndBusy = !!(
                r.farewellTriggered
                || missionRuntime.waitingFarewellDeboarding
                || missionRuntime.deboardingAfterFarewellStarted
                || missionRuntime.closingPending
                || String(missionRuntime.phase || '').toLowerCase() === 'closing'
            );
            if (!paxVoiceEndBusy && nearTargetForAtTarget && typeof window.triggerPaxAtTarget === 'function') {
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
        if (liveTrafficRenderTimer) {
            clearTimeout(liveTrafficRenderTimer);
            liveTrafficRenderTimer = null;
        }
        liveTrafficRenderPending = null;
        Object.values(liveTrafficMarkers).forEach(t => t.marker.remove());
        liveTrafficMarkers = {};
        return;
    }
    _scheduleLiveTrafficMapRender(window.vpTrafficData || [], window.lastLiveGpsPos?.alt, { immediate: true });
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
    liveGpsMarkerElement = null;
    liveGpsMarkerSvgElement = null;
    lastLivePlanePerformanceMode = null;
    lastAutoFollowPanAt = 0;
    lastAutoFollowPanPos = null;
    lastLivePlaneHeadingUpdateAt = 0;
    if (typeof window.resetMapAutoZoomState === 'function') window.resetMapAutoZoomState();
    if (liveSnailTrail) { liveSnailTrail.setLatLngs([]); }
    liveSnailTrailPoints = [];
    liveSnailTrailDirty = false;
    liveSnailTrailRenderedCount = 0;
    liveSnailTrailNeedsFullSync = false;
    lastLiveSnailTrailRenderAt = 0;
    if (liveToWpLine) { liveToWpLine.remove(); liveToWpLine = null; }
    // Prediction-Vektoren entfernen
    if (predictionLine) { predictionLine.setLatLngs([]); }
    predictionMarkers.forEach(m => { try { m.remove(); } catch(e) {} });
    predictionMarkers = [];
    // Profil zurücksetzen
    if (typeof vpUpdateLiveAircraft === 'function') vpUpdateLiveAircraft(-1, 0, 0);
    window.lastLiveGpsPos = null;
    window.lastLiveFlightData = null;
    window.gaUpdateMapContextOwnAltitude?.(null);
    window.gaLastTrackerTelemetryAt = 0;
    lastTelemetryUpdateAt = 0;
    vpProfileLockIdx = -1;
    vpProfileLockSig = '';
    lastGpsTickDetails = null;
    lastTrailPoint = null;
    forceLiveMapVisualRefresh = false;
    livePredictionGeneration += 1;
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
