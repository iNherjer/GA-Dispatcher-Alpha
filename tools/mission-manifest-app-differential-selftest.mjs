#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import manifestCore from '../mission-manifest-core.js';

const cargoSource = fs.readFileSync(new URL('../mission-cargo-core.js', import.meta.url), 'utf8');

function blockFrom(openIndex) {
    let depth = 0;
    let quote = '';
    let escaped = false;
    for (let index = openIndex; index < cargoSource.length; index += 1) {
        const char = cargoSource[index];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === '\\') {
            escaped = true;
            continue;
        }
        if (quote) {
            if (char === quote) quote = '';
            continue;
        }
        if (char === "'" || char === '"' || char === '`') {
            quote = char;
            continue;
        }
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) return index;
        }
    }
    throw new Error('unterminated source block');
}

function namedFunction(name) {
    const start = cargoSource.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `missing ${name}`);
    const open = cargoSource.indexOf(') {', start) + 2;
    return cargoSource.slice(start, blockFrom(open) + 1);
}

function windowFunction(name) {
    const marker = `window.${name} = function`;
    const start = cargoSource.indexOf(marker);
    assert.ok(start >= 0, `missing window.${name}`);
    const open = cargoSource.indexOf(') {', start) + 2;
    const end = blockFrom(open);
    assert.equal(cargoSource[end + 1], ';', `missing terminator for window.${name}`);
    return cargoSource.slice(start, end + 2);
}

const executableSource = [
    namedFunction('_missionCargoSignatureScope'),
    namedFunction('_missionCargoSignatureMatchesMode'),
    namedFunction('_missionCargoCommitCoreItemTransition'),
    namedFunction('_missionCargoRejectCoreItemTransition'),
    windowFunction('missionCargoSignDispatchList'),
    windowFunction('missionCargoClearDispatchSignature'),
    windowFunction('missionCargoLoadItem'),
    windowFunction('missionCargoToggleItemLoadState'),
    windowFunction('missionCargoUnloadItem')
].join('\n\n');

class FixedDate extends Date {
    static now() { return 1_000; }
}

function runScenario({ coreEnabled, manifest, action, itemId = 'box', options = {}, airborne = false, signatureAction = false }) {
    const workingManifest = JSON.parse(JSON.stringify(manifest));
    const effects = [];
    const context = {
        window: {
            GAMissionManifestCore: coreEnabled ? manifestCore : null,
            missionCargoStatus: { loadConfirmed: true, error: null },
            gaTrackerExecutionHandlesMission: () => false,
            missionComplianceCanMutateCargo: () => true,
            simModeActive: true,
            liveTrackerConnected: false,
            missionSceneStatus: {},
            missionCargoLoadItem: null,
            missionCargoUnloadItem: null
        },
        missionRuntime: { active: true },
        Date: FixedDate,
        Promise,
        JSON,
        Object,
        Number,
        String,
        Array,
        Math,
        console,
        _missionCargoManifestCore: () => context.window.GAMissionManifestCore,
        _missionCargoEnsureManifest: () => workingManifest,
        _missionCargoActionDialogMode: (requested, fallback) => requested?.mode || fallback,
        _missionCargoIsPassengerItem: item => String(item?.itemType || '').toLowerCase() === 'passenger',
        _missionCargoIsPassengerHandoffLocked: item => item?.handoffComplete === true || Number(item?.handedOffAt || 0) > 0,
        _missionCargoGroundHandlingAllowed: () => true,
        _missionCargoPilotId: () => 'PILOT-TEST',
        _missionCargoAircraftLabel: () => 'D-EABC',
        _missionCargoAtHomeNow: () => options.atHome === true,
        _missionCargoItemNeedsUnloadHere: item => item?.deliverAtHome === true
            ? options.atHome === true
            : item?.deliverAtDestination !== false,
        _missionCargoClearSignatureAnimation: () => {
            context.window.missionCargoStatus.signatureAnimationEndsAt = 0;
            context.window.missionCargoStatus.signatureAnimationMode = '';
        },
        _missionCargoStartSignatureAnimation: () => effects.push(['signature-animation']),
        _missionCargoItemCanLoadAtCurrentStage: item => item?.pickupLocation !== 'target' || options.atTarget === true,
        _missionCargoCanReloadUnloadedItem: () => true,
        _missionCargoDistanceToUnloadM: () => 0,
        _missionCargoManualPassengerSceneBusy: () => false,
        _missionCargoIsAirborneNow: () => airborne,
        _missionCargoCommandBasePos: () => ({ lat: 48.3, lon: 8.5, altFt: 900, hdg: 20 }),
        _missionCargoSceneId: () => 'scene-start',
        _missionCargoUnloadSceneId: () => 'scene-unload',
        _missionCargoDetachInheritedEquipmentFromBaseline: item => effects.push(['detach', item.id]),
        _missionCargoInvalidateDispatchSignature: target => {
            target.dispatchSignature = null;
            context.window.missionCargoStatus.loadConfirmed = false;
        },
        _missionCargoPersistManifest: () => effects.push(['persist']),
        _missionCargoPlayAudioCue: (cue, item, event) => effects.push(['audio', cue, item.id, event]),
        _missionCargoQueueVisibleItemState: () => effects.push(['visible']),
        _missionCargoSyncPayloadToSim: reason => {
            effects.push(['payload', reason]);
            return Promise.resolve({ status: 'ok' });
        },
        _missionCargoRenderDialog: mode => effects.push(['render', mode]),
        _missionCargoMarkPassengerLoaded: () => false,
        _missionCargoMarkPassengerUnloaded: () => false,
        _missionCargoManualPassengerLoadOptions: () => ({}),
        _missionCargoPassengerWaitsForFarewellDeboarding: () => false,
        _missionBushPickupBoarding: () => Promise.resolve(true),
        _activeBushMissionSpec: () => null,
        MISSION_CARGO_RELOAD_MAX_DISTANCE_M: 200,
        setTimeout,
        clearTimeout
    };
    context.window.window = context.window;
    vm.runInNewContext(executableSource, context, { filename: 'mission-cargo-differential.js' });
    const result = signatureAction
        ? context.window[action]({ ...options, animate: false, render: true })
        : context.window[action](itemId, { ...options, render: true });
    return {
        result,
        manifest: JSON.parse(JSON.stringify(workingManifest)),
        status: JSON.parse(JSON.stringify(context.window.missionCargoStatus)),
        effects
    };
}

function compare(name, scenario) {
    const legacy = runScenario({ ...scenario, coreEnabled: false });
    const shared = runScenario({ ...scenario, coreEnabled: true });
    assert.deepEqual(shared, legacy, `${name}: shared manifest core drifted from the executable App fallback`);
}

const pendingManifest = {
    dispatchSignature: { scope: 'departure', by: 'Pilot' },
    items: [{
        id: 'box', itemType: 'cargo', required: true, status: 'pending',
        loadedAt: 0, unloadedAt: 0, droppedAt: 0,
        unloadLat: null, unloadLon: null, unloadAltFt: null,
        droppedLat: null, droppedLon: null, droppedAltFt: null,
        lostAt: 0, handoffComplete: false, handedOffAt: 0
    }]
};

compare('load', { manifest: pendingManifest, action: 'missionCargoLoadItem' });

const loadedManifest = JSON.parse(JSON.stringify(pendingManifest));
loadedManifest.dispatchSignature = { scope: 'arrival', by: 'Pilot' };
loadedManifest.items[0].status = 'loaded';
loadedManifest.items[0].loadedAt = 500;
compare('unload', { manifest: loadedManifest, action: 'missionCargoUnloadItem', options: { mode: 'unload' } });
compare('drop', { manifest: loadedManifest, action: 'missionCargoUnloadItem', options: { mode: 'unload' }, airborne: true });
compare('toggle to pending', { manifest: loadedManifest, action: 'missionCargoToggleItemLoadState', options: { mode: 'load' } });

const unloadedManifest = JSON.parse(JSON.stringify(loadedManifest));
unloadedManifest.items[0].status = 'unloaded';
unloadedManifest.items[0].unloadedAt = 700;
unloadedManifest.items[0].unloadLat = 48.3;
unloadedManifest.items[0].unloadLon = 8.5;
unloadedManifest.items[0].unloadAltFt = 900;
compare('reload', { manifest: unloadedManifest, action: 'missionCargoLoadItem', options: { mode: 'unload-reload' } });

const unsignedDeparture = JSON.parse(JSON.stringify(loadedManifest));
unsignedDeparture.dispatchSignature = null;
compare('sign departure', {
    manifest: unsignedDeparture,
    action: 'missionCargoSignDispatchList',
    signatureAction: true,
    options: { mode: 'load' }
});

compare('clear departure signature', {
    manifest: loadedManifest,
    action: 'missionCargoClearDispatchSignature',
    signatureAction: true,
    options: { mode: 'load' }
});

const arrivalWithLoadedPax = {
    dispatchSignature: null,
    items: [
        { id: 'box', itemType: 'cargo', required: true, status: 'unloaded', deliverAtDestination: true },
        { id: 'pax', itemType: 'passenger', required: true, status: 'loaded', deliverAtDestination: true }
    ]
};
compare('sign arrival while PAX awaits coordinated deboarding', {
    manifest: arrivalWithLoadedPax,
    action: 'missionCargoSignDispatchList',
    signatureAction: true,
    options: { mode: 'unload' }
});

console.log('mission manifest/app differential selftest: ok');
