#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../mission-cargo-core.js', import.meta.url), 'utf8');
const start = source.indexOf("const MISSION_CARGO_ONBOARD_EQUIPMENT_STORAGE_KEY");
const end = source.indexOf('function _missionCargoPlayAudioCueNow', start);
assert.ok(start >= 0 && end > start, 'persistent-equipment implementation block missing');

function extractFunctionSource(name) {
    const functionStart = source.indexOf(`function ${name}(`);
    assert.ok(functionStart >= 0, `missing function ${name}`);
    const open = source.indexOf(') {', functionStart) + 2;
    assert.ok(open > functionStart, `missing function body ${name}`);
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
        if (source[i] === '{') depth += 1;
        if (source[i] === '}') depth -= 1;
        if (depth === 0) return source.slice(functionStart, i + 1);
    }
    throw new Error(`unterminated function ${name}`);
}

const storage = new Map();
const context = {
    window: { selectedAC: 'C172' },
    localStorage: {
        getItem: key => storage.has(key) ? storage.get(key) : null,
        setItem: (key, value) => storage.set(key, String(value))
    },
    document: {
        getElementById: id => id === 'syncToggle' ? { checked: false } : null
    },
    setTimeout,
    clearTimeout,
    Date,
    JSON,
    Object,
    Number,
    String,
    Array,
    Math
};
vm.runInNewContext(source.slice(start, end), context);
assert.equal(context._missionCargoFormatExpiryDate('2026-08-09'), '09 08 2026');
assert.equal(context._missionCargoFormatExpiryDate('invalid'), '-- -- ----');
assert.equal(context._missionCargoNullableNumber(null), null);
assert.equal(context._missionCargoNullableNumber(''), null);
assert.equal(context._missionCargoNullableNumber('48.5'), 48.5);

const upgradeContext = {
    _activeBushMissionSpec: () => null,
    _missionCargoIsPassengerItem: item => String(item?.itemType || '').toLowerCase() === 'passenger',
    _missionCargoAircraftSlot: value => String(value || 'C172'),
    Number,
    String,
    Array,
    Object
};
vm.runInNewContext(extractFunctionSource('_missionCargoUpgradePersistentEquipmentManifest'), upgradeContext);
const legacyPoiManifest = {
    version: 4,
    aircraftSlot: 'C172',
    isPoi: true,
    items: [
        { id: 'mission-passenger', itemType: 'passenger', required: true, deliverAtDestination: true },
        { id: 'primary-cargo', itemType: 'cargo', required: true, deliverAtDestination: false },
        { id: 'survey-docs', itemType: 'cargo', required: false, deliverAtDestination: false }
    ]
};
assert.equal(upgradeContext._missionCargoUpgradePersistentEquipmentManifest(legacyPoiManifest), true);
assert.equal(legacyPoiManifest.version, 5);
assert.equal(legacyPoiManifest.items[1].deliverAtDestination, true);
assert.equal(legacyPoiManifest.items[1].deliverAtHome, false);
assert.equal(legacyPoiManifest.items[2].deliverAtDestination, false, 'optional POI working material must remain onboard');

upgradeContext._activeBushMissionSpec = () => ({
    targetMode: 'area_then_return',
    completionMode: 'return_home'
});
const legacyBushReconManifest = {
    version: 4,
    aircraftSlot: 'C172',
    isPoi: true,
    items: [
        { id: 'primary-cargo', itemType: 'cargo', required: true, deliverAtDestination: false }
    ]
};
assert.equal(upgradeContext._missionCargoUpgradePersistentEquipmentManifest(legacyBushReconManifest), true);
assert.equal(legacyBushReconManifest.items[0].deliverAtDestination, false);
assert.equal(legacyBushReconManifest.items[0].deliverAtHome, true);

const arrivalManifest = {
    dispatchSignature: { scope: 'departure' },
    items: [
        { id: 'primary-cargo', itemType: 'cargo', status: 'loaded', deliverAtDestination: true },
        { id: 'mission-passenger', itemType: 'passenger', status: 'loaded', deliverAtDestination: true }
    ]
};
const arrivalContext = {
    _missionCargoHasActiveMission: () => true,
    _missionCargoEnsureManifest: () => arrivalManifest,
    _missionCargoLoadedItems: manifest => manifest.items.filter(item => item.status === 'loaded' || item.status === 'unloaded'),
    _missionCargoItemNeedsUnloadHere: item => item.deliverAtDestination !== false,
    _missionCargoIsPassengerItem: item => item.itemType === 'passenger',
    _missionCargoSignatureMatchesMode: (signature, mode) => signature?.scope === (mode === 'unload' ? 'arrival' : 'departure')
};
vm.runInNewContext([
    extractFunctionSource('_missionCargoNeedsUnload'),
    extractFunctionSource('_missionCargoNeedsArrivalWorkflow')
].join('\n'), arrivalContext);
assert.equal(arrivalContext._missionCargoNeedsArrivalWorkflow({ ignorePassenger: true }), true);
arrivalManifest.items[0].status = 'unloaded';
assert.equal(
    arrivalContext._missionCargoNeedsArrivalWorkflow({ ignorePassenger: true }),
    true,
    'arrival signature must remain mandatory after POI cargo is unloaded'
);
arrivalManifest.dispatchSignature = { scope: 'arrival' };
assert.equal(
    arrivalContext._missionCargoNeedsArrivalWorkflow({ ignorePassenger: true }),
    false,
    'signed arrival with only PAX remaining must release farewell/deboarding'
);
assert.equal(
    arrivalContext._missionCargoNeedsArrivalWorkflow(),
    true,
    'the visible cargo action must still account for the loaded passenger before farewell'
);

const normalizedMissingUnloadPosition = context._missionCargoNormalizeOnboardEquipmentState({
    version: 3,
    aircraft: {
        C172: {
            items: {
                'first-aid': {
                    onboard: false,
                    status: 'offboard',
                    unloadLat: 0,
                    unloadLon: 0,
                    unloadAltFt: null
                }
            }
        }
    }
});
assert.equal(normalizedMissingUnloadPosition.aircraft.C172.items['first-aid'].unloadLat, null);
assert.equal(normalizedMissingUnloadPosition.aircraft.C172.items['first-aid'].unloadLon, null);
assert.equal(normalizedMissingUnloadPosition.aircraft.C172.items['first-aid'].unloadAltFt, null);

const cloudState = {
    version: 1,
    updatedAt: 100,
    aircraft: {
        C172: {
            updatedAt: 100,
            items: {
                bordbuch: {
                    onboard: true,
                    loadedAt: 90,
                    expiresAt: '',
                    updatedAt: 100
                },
                unknown_item: {
                    onboard: true,
                    loadedAt: 90,
                    expiresAt: '',
                    updatedAt: 100
                }
            }
        }
    }
};
assert.equal(context.window.missionCargoApplyOnboardEquipmentFromSync(cloudState), true);

const items = [
    { id: 'bordbuch', persistentEquipment: true, status: 'pending', loadedAt: 0 },
    { id: 'first-aid', persistentEquipment: true, status: 'pending', loadedAt: 0 },
    { id: 'mission-cargo', persistentEquipment: false, status: 'pending', loadedAt: 0 }
];
context._missionCargoApplyStoredOnboardEquipment(items, 'C172');
assert.equal(items[0].status, 'loaded');
assert.equal(items[0].persistentEquipmentInherited, true);
assert.equal(items[1].status, 'pending');
assert.equal(items[2].status, 'pending');

const normalized = context.window.missionCargoGetOnboardEquipmentForSync();
assert.equal(normalized.version, 3);
assert.equal(normalized.aircraft.C172.items.bordbuch.onboard, true);
assert.equal(normalized.aircraft.C172.items.bordbuch.status, 'onboard');
assert.equal(normalized.aircraft.C172.items.unknown_item, undefined);

items[0].status = 'unloaded';
assert.equal(context._missionCargoPersistOnboardEquipment({
    aircraftSlot: 'C172',
    items
}), true);
assert.equal(context.window.missionCargoGetOnboardEquipmentForSync().aircraft.C172.items.bordbuch.onboard, false);
assert.equal(context.window.missionCargoGetOnboardEquipmentForSync().aircraft.C172.items.bordbuch.status, 'offboard');

const explicitlyUnloadedItems = [
    { id: 'bordbuch', persistentEquipment: true, status: 'loaded', loadedAt: 123 }
];
context._missionCargoApplyStoredOnboardEquipment(explicitlyUnloadedItems, 'C172');
assert.equal(explicitlyUnloadedItems[0].status, 'unloaded');
assert.equal(explicitlyUnloadedItems[0].loadedAt, 0);

explicitlyUnloadedItems[0].status = 'lost';
explicitlyUnloadedItems[0].lostAt = 456;
assert.equal(context._missionCargoPersistOnboardEquipment({
    aircraftSlot: 'C172',
    items: explicitlyUnloadedItems
}), true);
const lostItems = [
    { id: 'bordbuch', persistentEquipment: true, status: 'loaded', loadedAt: 123 }
];
context._missionCargoApplyStoredOnboardEquipment(lostItems, 'C172');
assert.equal(lostItems[0].status, 'lost');
assert.equal(lostItems[0].lostAt, 456);

const secondAircraftItems = [
    { id: 'bordbuch', persistentEquipment: true, status: 'pending', loadedAt: 0 }
];
context._missionCargoApplyStoredOnboardEquipment(secondAircraftItems, 'PA-24');
assert.equal(secondAircraftItems[0].status, 'pending');

for (const id of ['bordbuch', 'fire-extinguisher', 'first-aid']) {
    assert.match(
        source,
        new RegExp(`id: '${id}'[\\s\\S]{0,260}status: 'loaded'`),
        `${id} must initially be onboard`
    );
}

for (const requiredText of [
    'VFR Multitool Mission Aircraft Logbook Cargo',
    'VFR Multitool Homebase Fire Extinguisher',
    'VFR Multitool Homebase First Aid Case',
    'VFR Multitool Homebase Aircraft Wheel Chocks',
    "persistentEquipment: true"
]) {
    assert.ok(source.includes(requiredText), `missing cargo descriptor ${requiredText}`);
}

const syncSource = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
assert.ok(syncSource.includes('onboardEquipment: _syncOnboardEquipmentPayload()'), 'cloud payload omits onboard equipment');
assert.ok(syncSource.includes('_syncApplyOnboardEquipmentFromCloud(data);'), 'cloud pull omits onboard equipment');
assert.ok(syncSource.includes("document.getElementById('mapGroundCargoBtn')"), 'ground cargo toolbar visibility is not updated');
assert.ok(syncSource.includes('window.missionCargoGroundHandlingStatus?.()'), 'ground cargo toolbar does not use cargo ground state');
assert.ok(syncSource.includes('cargoGroundStatus.onGround === true'), 'ground cargo toolbar is not hidden while airborne');
assert.equal(syncSource.includes("window.missionCargoMaybeOpenArrivalDialog?.('runtime-ground-end-ready')"), false, 'arrival cargo dialog still opens automatically instead of staying behind the banner action');
assert.ok(syncSource.includes('window.missionCargoHandleAircraftMovement?.({'), 'flight tick does not process left-behind equipment');
assert.ok(syncSource.includes("window.missionCargoStageSimEquipmentAtAircraft?.('sim-boarding-start')"), 'sim boarding does not stage offboard equipment at the simulated aircraft');
assert.ok(syncSource.includes("window.missionCargoStageSimEquipmentAtAircraft?.('sim-boarding-reopen')"), 'reopened sim boarding does not restage offboard equipment');
const manualSimSource = fs.readFileSync(new URL('../sim-manual-flight.js', import.meta.url), 'utf8');
assert.ok(manualSimSource.includes('window.missionCargoHandleAircraftMovement?.(window.gaSimFlightData)'), 'manual sim tick does not process left-behind equipment with isolated sim telemetry');
assert.ok(manualSimSource.includes('window.gaSimGpsPos = {'), 'manual sim does not publish an isolated sim position');
const autoSimSource = fs.readFileSync(new URL('../sim-route.js', import.meta.url), 'utf8');
assert.ok(autoSimSource.includes('window.missionCargoHandleAircraftMovement?.(window.gaSimFlightData)'), 'auto sim tick does not process left-behind equipment');
assert.ok(autoSimSource.includes('window.gaSimGpsPos = {'), 'auto sim does not publish an isolated sim position');
assert.equal(/mode: '(?:unload|pickup)', trigger: 'sim:end_hold'/.test(autoSimSource), false, 'auto sim still opens a cargo dialog at landing');
assert.ok(autoSimSource.includes("groundAction?.action === 'unload'"), 'sim completion can bypass the central unload workflow');
assert.ok(autoSimSource.includes("window.openMissionCargoDialog('unload')"), 'sim completion does not route pending arrival work back into the cargo window');
const profileSource = fs.readFileSync(new URL('../profile.js', import.meta.url), 'utf8');
assert.ok(profileSource.includes('Cargo / Bordbestand Diagnose'), 'debug report omits cargo positions');
assert.ok(profileSource.includes('window.missionCargoDebugSnapshot'), 'debug report does not read cargo diagnostics');

const indexSource = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.ok(indexSource.includes('id="mapGroundCargoBtn"'), 'ground cargo toolbar button missing');
assert.ok(indexSource.includes('openMissionGroundCargoDialog()'), 'ground cargo toolbar action missing');

const checklistSource = fs.readFileSync(new URL('../checklists.js', import.meta.url), 'utf8');
assert.ok(checklistSource.includes("data-action=\"cargo-open-modal\">Bordbestand verwalten"), 'cargo menu lacks missionless inventory entry');
assert.ok(checklistSource.includes('window.openMissionGroundCargoDialog()'), 'cargo menu bypasses ground inventory routing');

for (const requiredUiText of [
    'window.openMissionGroundCargoDialog = function()',
    "if (normalizedMode === 'unload' && !_missionCargoHasActiveMission())",
    'if (missionCargoGroundInventoryManifest && !_missionCargoHasActiveMission())',
    "const isEquipment = mode === 'equipment'",
    'const usesManifestSheet = isLoad || isUnload || isEquipment',
    "const listMarkup = usesManifestSheet ? ''",
    'const signaturePanel = (isLoad || isUnload)',
    'scope: _missionCargoSignatureScope(renderMode)',
    "const arrivalWork = complianceActive",
    "_missionCargoSignatureMatchesMode(manifest.dispatchSignature, 'unload')",
    'function _missionCargoNeedsArrivalWorkflow',
    'mission-cargo-sheet-status-hint',
    "{ mode: 'unload' })",
    'function _missionCargoFormatExpiryDate',
    'mission-cargo-sheet-item-date',
    '>Erneuern</button>',
    'function _missionCargoBoardBookActionState',
    "source: 'cargo-manifest'",
    'manifest.flightEvents.flightId = currentFlightId',
    "banner.className = 'awm-freq-entry mission-boardbook-reminder'",
    'if (options.showBanner !== false)',
    'missionCargoBeginGroundInventorySession',
    "taskDomain: 'ground_inventory'",
    'window.missionCargoHandleAircraftMovement = function',
    'window.missionCargoStageSimEquipmentAtAircraft = function',
    "stored.status === 'lost'",
    "item.status = 'lost'",
    "replaceLost: true",
    'if (!window.simModeActive && !window.liveTrackerConnected) return true',
    'window.missionCargoDebugSnapshot = function()',
    "finishMissionCargoUnloadAndEnd({ source: 'passenger-row', skipConfirm: true })",
    'window.finishMissionCargoUnloadAndEnd = function(options = {})',
    'options.skipConfirm !== true && !_missionCargoConfirmCriticalAction',
    'window.missionCargoGroundHandlingStatus = _missionCargoGroundHandlingStatus'
]) {
    assert.ok(source.includes(requiredUiText), `ground inventory UI missing ${requiredUiText}`);
}
assert.equal(source.includes('mission-cargo-sheet-status-action'), false, 'load/unload action buttons still render in the status column');

const tawsSource = fs.readFileSync(new URL('../taws.js', import.meta.url), 'utf8');
assert.ok(source.includes("document.getElementById('awmFreqBanner')"), 'board-book reminder does not use the frequency banner stack');
assert.ok(tawsSource.includes("banner.querySelectorAll('[data-askey]').forEach(entry => entry.remove())"), 'frequency toggle can still hide the board-book reminder');

const functionSource = (name) => {
    const functionStart = source.indexOf(`function ${name}(`);
    assert.ok(functionStart >= 0, `missing function ${name}`);
    const open = source.indexOf(') {', functionStart) + 2;
    assert.ok(open > functionStart, `missing function body ${name}`);
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
        if (source[i] === '{') depth += 1;
        if (source[i] === '}') depth -= 1;
        if (depth === 0) return source.slice(functionStart, i + 1);
    }
    throw new Error(`unterminated function ${name}`);
};

const dialogModeContext = { String };
vm.runInNewContext(functionSource('_missionCargoActionDialogMode'), dialogModeContext);
assert.equal(dialogModeContext._missionCargoActionDialogMode({ mode: 'load' }, 'unload'), 'load');
assert.equal(dialogModeContext._missionCargoActionDialogMode({ mode: 'unload-reload' }, 'load'), 'unload');
assert.equal(dialogModeContext._missionCargoActionDialogMode({ mode: 'equipment' }, 'load'), 'equipment');

const reloadDistanceContext = {
    window: {
        simModeActive: true,
        liveTrackerConnected: true
    },
    MISSION_CARGO_RELOAD_MAX_DISTANCE_M: 200,
    _missionCargoNullableNumber: value => {
        if (value === null || typeof value === 'undefined' || String(value).trim() === '') return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    },
    distanceM: 250,
    _missionCargoDistanceToUnloadM: () => reloadDistanceContext.distanceM,
    Number,
    String
};
vm.runInNewContext(functionSource('_missionCargoCanReloadUnloadedItem'), reloadDistanceContext);
const unloadedItem = { status: 'unloaded', unloadLat: 48, unloadLon: 9 };
assert.equal(reloadDistanceContext._missionCargoCanReloadUnloadedItem(unloadedItem), false);
reloadDistanceContext.distanceM = 50;
assert.equal(reloadDistanceContext._missionCargoCanReloadUnloadedItem(unloadedItem), true);
reloadDistanceContext.window.simModeActive = false;
reloadDistanceContext.window.liveTrackerConnected = false;
reloadDistanceContext.distanceM = 250;
assert.equal(reloadDistanceContext._missionCargoCanReloadUnloadedItem(unloadedItem), true);
assert.equal(reloadDistanceContext._missionCargoCanReloadUnloadedItem({
    status: 'unloaded',
    unloadLat: null,
    unloadLon: null
}), true);

const sceneCleanupCalls = [];
const sceneCleanupContext = {
    window: {
        simModeActive: false,
        liveTrackerConnected: true
    },
    _missionCargoEnsureManifest: () => ({
        items: [
            { id: 'loaded-item', status: 'loaded', persistentEquipment: false },
            { id: 'persistent-loaded-item', status: 'loaded', persistentEquipment: true },
            { id: 'loaded-passenger', status: 'loaded', itemType: 'passenger', persistentEquipment: false },
            { id: 'unloaded-item', status: 'unloaded' },
            { id: 'pending-item', status: 'pending' }
        ]
    }),
    _missionCargoIsPassengerItem: item => item?.itemType === 'passenger',
    _missionCargoQueueVisibleItemState: (item, visible, options) => {
        sceneCleanupCalls.push({ id: item.id, visible, ...options });
        return true;
    },
    _missionCargoSceneId: () => 'mission-start-scene'
};
vm.runInNewContext(functionSource('_missionCargoRemoveLoadedSceneObjects'), sceneCleanupContext);
assert.equal(sceneCleanupContext._missionCargoRemoveLoadedSceneObjects('spawn-ack-cleanup'), true);
assert.deepEqual(sceneCleanupCalls, [{
    id: 'loaded-item',
    visible: false,
    reason: 'spawn-ack-cleanup',
    unloaded: false,
    sceneId: 'mission-start-scene',
    immediate: true
}]);

const livePositionContext = {
    window: {
        simModeActive: true,
        gaSimGpsPos: { lat: 48.1, lon: 8.1, alt: 1000, hdg: 90 },
        lastLiveGpsPos: { lat: 49.2, lon: 9.2, alt: 2000, hdg: 180 }
    },
    Number
};
vm.runInNewContext(functionSource('_missionCargoLivePos'), livePositionContext);
assert.equal(livePositionContext._missionCargoLivePos().lat, 48.1);
assert.equal(livePositionContext._missionCargoLivePos().lon, 8.1);
livePositionContext.window.simModeActive = false;
assert.equal(livePositionContext._missionCargoLivePos().lat, 49.2);
assert.equal(livePositionContext._missionCargoLivePos().lon, 9.2);

const signatureScopeContext = { String };
vm.runInNewContext([
    functionSource('_missionCargoSignatureScope'),
    functionSource('_missionCargoSignatureMatchesMode')
].join('\n'), signatureScopeContext);
assert.equal(signatureScopeContext._missionCargoSignatureScope('load'), 'departure');
assert.equal(signatureScopeContext._missionCargoSignatureScope('unload'), 'arrival');
assert.equal(signatureScopeContext._missionCargoSignatureMatchesMode({ scope: 'arrival' }, 'unload'), true);
assert.equal(signatureScopeContext._missionCargoSignatureMatchesMode({ scope: 'departure' }, 'unload'), false);
assert.equal(signatureScopeContext._missionCargoSignatureMatchesMode({ by: 'LEGACY' }, 'load'), true);
assert.equal(signatureScopeContext._missionCargoSignatureMatchesMode({ by: 'LEGACY' }, 'unload'), false);
assert.equal(source.includes("isUnload ? 'Ankunft'"), false, 'legacy arrival window label is still rendered');

const signatureContext = {
    window: {
        missionCargoStatus: {
            loadConfirmed: true
        }
    }
};
vm.runInNewContext(functionSource('_missionCargoInvalidateDispatchSignature'), signatureContext);
const signedManifest = { dispatchSignature: { by: 'TEST' } };
assert.equal(signatureContext._missionCargoInvalidateDispatchSignature(signedManifest), true);
assert.equal(signedManifest.dispatchSignature, null);
assert.equal(signatureContext.window.missionCargoStatus.loadConfirmed, false);

const boardBookContext = {
    window: {
        missionCargoCurrentFlightId: () => 'flight-1',
        missionComplianceBoardBookWriteAllowed: () => true
    },
    _missionCargoHasActiveMission: () => true,
    Number,
    String
};
vm.runInNewContext(functionSource('_missionCargoBoardBookActionState'), boardBookContext);
const boardBookItem = { id: 'bordbuch', status: 'loaded', log: {} };
const boardBookManifest = { groundInventory: false };
assert.equal(boardBookContext._missionCargoBoardBookActionState(boardBookItem, boardBookManifest).field, 'start');
assert.equal(boardBookContext._missionCargoBoardBookActionState(boardBookItem, boardBookManifest).allowed, true);
boardBookItem.log = { flightId: 'flight-1', startAt: 100, startTime: '10:00' };
assert.equal(boardBookContext._missionCargoBoardBookActionState(boardBookItem, boardBookManifest).field, 'landing');
boardBookItem.log.landingAt = 200;
boardBookItem.log.landingTime = '11:00';
assert.equal(boardBookContext._missionCargoBoardBookActionState(boardBookItem, boardBookManifest).complete, true);
assert.equal(boardBookContext._missionCargoBoardBookActionState(boardBookItem, boardBookManifest).allowed, false);

const payloadContext = {
    window: {},
    _missionCargoIsPassengerItem: item => item?.itemType === 'passenger',
    _missionCargoBoardedPaxCount: () => 0,
    _missionCargoPaxWeightLbs: () => 180,
    Map,
    Set,
    Number,
    Math,
    Array
};
vm.runInNewContext([
    functionSource('_missionCargoNormalizePayloadSnapshot'),
    functionSource('_missionCargoBuildPayloadLayout'),
    functionSource('_missionCargoItemIsBulky'),
    functionSource('_missionCargoAllocateWeightToStations'),
    functionSource('_missionCargoBuildMissionExtraPlan'),
    functionSource('_missionCargoEstimateResetStationsFromSnapshot'),
    functionSource('_missionCargoEstimatePersistentStationsFromBaseline')
].join('\n'), payloadContext);

const baseline = {
    payloadStationCount: 5,
    sampledStationCount: 5,
    stations: [
        { index: 1, weightLbs: 170 },
        { index: 2, weightLbs: 0 },
        { index: 3, weightLbs: 0 },
        { index: 4, weightLbs: 0 },
        { index: 5, weightLbs: 0 }
    ]
};
const manifestWithPersistent = {
    items: [
        {
            id: 'bordbuch',
            itemType: 'cargo',
            status: 'loaded',
            weightLbs: 3,
            persistentEquipment: true,
            persistentEquipmentInherited: false
        },
        {
            id: 'mission-cargo',
            itemType: 'cargo',
            status: 'loaded',
            weightLbs: 10,
            persistentEquipment: false
        }
    ]
};
const persistentTarget = payloadContext._missionCargoEstimatePersistentStationsFromBaseline(
    manifestWithPersistent,
    baseline
);
assert.equal(persistentTarget.find(row => row.index === 5)?.weightLbs, 3);

const currentSnapshot = {
    ...baseline,
    stations: baseline.stations.map(row => ({
        ...row,
        weightLbs: row.index === 5 ? 13 : row.weightLbs
    }))
};
const resetTarget = payloadContext._missionCargoEstimateResetStationsFromSnapshot(
    manifestWithPersistent,
    currentSnapshot
);
assert.equal(resetTarget.find(row => row.index === 5)?.weightLbs, 3);

manifestWithPersistent.items[0].persistentEquipmentInherited = true;
const layout = payloadContext._missionCargoBuildPayloadLayout(baseline);
const nextMissionPlan = payloadContext._missionCargoBuildMissionExtraPlan(manifestWithPersistent, layout);
assert.equal(nextMissionPlan.missionByStation.get(5), 10, 'inherited equipment was counted twice');

console.log('mission cargo persistence selftest: ok');
