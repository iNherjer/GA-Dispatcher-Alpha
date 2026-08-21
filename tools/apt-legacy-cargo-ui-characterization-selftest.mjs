#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import aptUiCore from '../mission-apt-ui-core.js';

const cargoSource = fs.readFileSync(new URL('../mission-cargo-core.js', import.meta.url), 'utf8');

function functionSource(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `missing function ${name}`);
    const open = source.indexOf(') {', start) + 2;
    assert.ok(open > start, `missing function body ${name}`);
    let depth = 0;
    for (let index = open; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] === '}') depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`unterminated function ${name}`);
}

function cleanText(markup) {
    return String(markup || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&times;/g, 'x')
        .replace(/\s+/g, ' ')
        .trim();
}

function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
}

let overlay = null;
let manifest = null;
let endReady = false;

function newOverlay() {
    let html = '';
    return {
        id: '',
        className: '',
        style: { display: '' },
        get innerHTML() { return html; },
        set innerHTML(value) { html = String(value || ''); },
        querySelector() { return null; }
    };
}

const context = {
    window: {
        gaTrackerExecutionHandlesMission: () => true,
        gaTrackerExecutionControl: null,
        missionCargoStatus: null,
        aircraftPayloadStatus: { snapshot: null },
        missionComplianceGetCargoUiState: () => ({ active: false }),
        missionComplianceCanMutateCargo: () => true,
        missionSceneStatus: {},
        lastLiveFlightData: null,
        selectedAC: 'PA-24'
    },
    document: {
        getElementById(id) { return id === 'missionCargoOverlay' ? overlay : null; },
        createElement() { return newOverlay(); },
        body: {
            appendChild(node) { overlay = node; }
        }
    },
    missionRuntime: { active: false },
    MISSION_CARGO_RELOAD_MAX_DISTANCE_M: 200,
    MISSION_CARGO_EQUIPMENT_REPLACE_THRESHOLD_DAYS: 30,
    _missionCargoEnsureManifest: () => manifest,
    _missionCargoGroundHandlingAllowed: () => context.window.gaTrackerExecutionControl?.flags?.groundStill === true,
    _missionCargoMergeFuelIntoCurrentSnapshot: () => null,
    _missionCargoStorePayloadBaselineIfNeeded: () => null,
    _missionCargoBuildPlanFromManifest: () => null,
    _missionCargoRememberPayloadAssignments: () => false,
    _missionCargoLoadInteractionReady: () => context.window.gaTrackerExecutionControl?.flags?.boardingConfirmed === true,
    _missionCargoManifestGateState: () => null,
    _missionCargoItemNeedsUnloadHere: item => item?.delivery === 'destination' || item?.deliverAtDestination !== false,
    _missionCargoIsPassengerItem: item => String(item?.itemType || '').toLowerCase() === 'passenger',
    _missionRuntimeGroundEndReady: () => endReady,
    _missionCargoSignatureMatchesMode: (signature, mode) => {
        const scope = mode === 'unload' ? 'arrival' : (mode === 'pickup' ? 'pickup' : 'departure');
        return !!signature && signature.scope === scope;
    },
    _missionCargoGroupPayloadAssignmentStations: () => new Map(),
    _missionCargoFormatSheetStationAssignment: stations => Array.isArray(stations) && stations.length ? stations.join('/') : '-',
    _missionCargoLivePos: () => ({ lat: 48, lon: 8 }),
    _missionBushIsPickupPassengerMission: () => false,
    _missionBushIsPickupCargoMission: () => false,
    _missionCargoManualPassengerSceneBusy: () => false,
    _missionCargoPassengerBusyLabel: () => 'Boarding läuft',
    _missionCargoDistanceToUnloadM: item => Number.isFinite(Number(item?.reloadDistanceM)) ? Number(item.reloadDistanceM) : null,
    _missionCargoCanReloadUnloadedItem: item => item?.reloadAllowed !== false,
    _missionCargoIsPassengerHandoffLocked: item => item?.handoffComplete === true || item?.status === 'handed_off',
    _missionCargoItemCanLoadAtCurrentStage: () => true,
    _missionCargoBoardBookActionState: () => ({ complete: false, allowed: false, label: '', log: {} }),
    _missionCargoExpiryDaysRemaining: () => 90,
    _missionCargoFormatExpiryDate: () => '31.12.2026',
    _missionCargoAircraftLabel: () => 'PA-24',
    _missionCargoPilotId: () => 'DEINA',
    _missionCargoFormatDate: value => `DATE-${Number(value || 0)}`,
    _missionCargoTrackerIntentAllowed: intent => (context.window.gaTrackerExecutionControl?.allowedActions || []).includes(String(intent || '')),
    _missionCargoTrackerBlockedMessage: intent => aptUiCore.blockedMessage(intent, context.window.gaTrackerExecutionControl?.phase || ''),
    _activeBushMissionSpec: () => null,
    _missionCargoPayloadSummaryHtml: () => '',
    _missionCargoEscape: escapeHtml,
    _missionCargoRefreshPayloadSnapshot: () => Promise.resolve({ status: 'skipped' }),
    requestAnimationFrame: callback => callback(),
    Date,
    Map,
    Number,
    String,
    Math,
    Array,
    Object,
    JSON,
    Promise
};

vm.runInNewContext(
    functionSource(cargoSource, '_missionCargoRenderDialog'),
    context,
    { filename: 'mission-cargo-core.js#_missionCargoRenderDialog' }
);

function renderLegacy(scenario, useCanonicalCore = false) {
    overlay = null;
    manifest = JSON.parse(JSON.stringify(scenario.manifest));
    endReady = scenario.endReady === true;
    context.missionRuntime.active = scenario.flags?.active === true;
    context.window.gaTrackerExecutionControl = {
        executionAuthority: 'tracker',
        phase: scenario.phase,
        allowedActions: scenario.allowedActions,
        flags: scenario.flags,
        cargo: {
            signatureScope: scenario.manifest.dispatchSignature?.scope || null,
            summary: scenario.summary
        },
        payload: { status: scenario.flags?.payloadSyncRequested ? 'pending' : 'idle', presentation: {} }
    };
    context.window.GAMissionAptUiCore = useCanonicalCore ? aptUiCore : null;
    context.window.missionCargoStatus = {
        lastMode: scenario.mode,
        loadConfirmed: scenario.flags?.loadConfirmed === true,
        signatureAnimationMode: scenario.mode,
        signatureAnimationEndsAt: scenario.signatureAnimating === true ? Date.now() + 10000 : 0,
        payloadFinalizeRunning: scenario.flags?.payloadSyncRequested === true,
        payloadBaseline: null,
        payloadPlan: null,
        error: null
    };
    context._missionCargoRenderDialog(scenario.mode, { skipPayloadRefresh: true, preserveScroll: false });
    return cleanText(overlay?.innerHTML);
}

function renderCanonical(scenario) {
    return aptUiCore.cargoModel({
        signatureAnimating: scenario.signatureAnimating === true,
        control: {
            missionId: scenario.name,
            executionAuthority: 'tracker',
            phase: scenario.phase,
            allowedActions: scenario.allowedActions,
            flags: scenario.flags,
            cargo: {
                signatureScope: scenario.manifest.dispatchSignature?.scope || null,
                summary: scenario.summary
            },
            payload: { status: scenario.flags?.payloadSyncRequested ? 'pending' : 'idle', presentation: {} }
        },
        manifest: scenario.manifest
    });
}

function assertPresentationParity(scenario) {
    const legacy = renderLegacy(scenario);
    const integratedApp = renderLegacy(scenario, true);
    const canonical = renderCanonical(scenario);
    const expectedTexts = [
        canonical.header.kicker,
        canonical.header.title,
        canonical.copy,
        canonical.modeHint,
        canonical.summary.left,
        canonical.summary.right,
        canonical.signature.stateText,
        canonical.actions.secondary?.label,
        canonical.actions.primary?.label,
        ...canonical.items.flatMap(item => [item.label, item.typeLabel, item.statusLabel, item.action?.label])
    ].filter(Boolean);
    expectedTexts.forEach(value => {
        assert.ok(legacy.includes(value), `${scenario.name}: legacy App output is missing canonical text: ${value}\n${legacy}`);
        assert.ok(integratedApp.includes(value), `${scenario.name}: tracker-managed App output is missing canonical text: ${value}\n${integratedApp}`);
    });
    return canonical;
}

const loadedItems = [
    { id: 'pax', storyName: 'Dr. Test', itemType: 'passenger', passengerCount: 1, required: true, status: 'loaded', weightLbs: 180, delivery: 'destination' },
    { id: 'box', storyName: 'Kühlbox', itemType: 'cargo', required: true, status: 'loaded', weightLbs: 24, delivery: 'destination', station: 'Sitz 4' }
];

assertPresentationParity({
    name: 'boarding-unsigned', mode: 'load', phase: 'boarding', endReady: false,
    allowedActions: ['set_manifest_item', 'sign_manifest'],
    flags: { boardingConfirmed: true, groundStill: true, loadConfirmed: false },
    summary: { departureMissing: 0 },
    manifest: { aircraftSlot: 'PA-24', createdAt: 123, items: loadedItems }
});

assertPresentationParity({
    name: 'boarding-signed', mode: 'load', phase: 'boarding', endReady: false,
    allowedActions: ['set_manifest_item', 'clear_manifest_signature', 'confirm_load'],
    flags: { boardingConfirmed: true, groundStill: true, loadConfirmed: false },
    summary: { departureMissing: 0 },
    manifest: {
        aircraftSlot: 'PA-24', createdAt: 123,
        dispatchSignature: { scope: 'departure', by: 'DEINA', at: 456, aircraft: 'PA-24' },
        items: loadedItems
    }
});

assertPresentationParity({
    name: 'boarding-signature-animation', mode: 'load', phase: 'boarding', endReady: false,
    allowedActions: ['set_manifest_item', 'clear_manifest_signature', 'confirm_load'],
    flags: { boardingConfirmed: true, groundStill: true, loadConfirmed: false },
    summary: { departureMissing: 0 }, signatureAnimating: true,
    manifest: {
        aircraftSlot: 'PA-24', createdAt: 123,
        dispatchSignature: { scope: 'departure', by: 'DEINA', at: 456, aircraft: 'PA-24' },
        items: loadedItems
    }
});

assertPresentationParity({
    name: 'boarded-locked', mode: 'load', phase: 'boarded', endReady: false,
    allowedActions: ['start_mission'],
    flags: { boardingConfirmed: true, groundStill: true, loadConfirmed: true },
    summary: { departureMissing: 0 },
    manifest: {
        aircraftSlot: 'PA-24', createdAt: 123,
        dispatchSignature: { scope: 'departure', by: 'DEINA', at: 456, aircraft: 'PA-24' },
        items: loadedItems
    }
});

assertPresentationParity({
    name: 'arrival-unload', mode: 'unload', phase: 'end_unloading', endReady: true,
    allowedActions: ['set_manifest_item', 'request_pax_interaction'],
    flags: { active: true, groundStill: true, unloadConfirmed: false },
    summary: { destinationRemaining: 1 },
    manifest: { aircraftSlot: 'PA-24', createdAt: 123, items: loadedItems }
});

const arrivalReady = assertPresentationParity({
    name: 'arrival-ready-with-pax', mode: 'unload', phase: 'end_unloading', endReady: true,
    allowedActions: ['set_manifest_item', 'clear_manifest_signature', 'confirm_unload'],
    flags: { active: true, groundStill: true, unloadConfirmed: false },
    summary: { destinationRemaining: 0 },
    manifest: {
        aircraftSlot: 'PA-24', createdAt: 123,
        dispatchSignature: { scope: 'arrival', by: 'DEINA', at: 789, aircraft: 'PA-24' },
        items: [loadedItems[0], { ...loadedItems[1], status: 'unloaded', reloadAllowed: true }]
    }
});
assert.equal(arrivalReady.actions.primary.followupIntent, 'request_close');

console.log('apt-legacy-cargo-ui-characterization-selftest: ok');
