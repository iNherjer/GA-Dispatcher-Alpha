'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const core = require('./mission-manifest-core.js');

function aptManifest() {
    return {
        version: 6,
        key: 'apt-reference-manifest',
        dispatchSignature: null,
        items: [
            { id: 'mission-passenger', itemType: 'passenger', required: true, status: 'pending', deliverAtDestination: true },
            { id: 'primary-cargo', itemType: 'cargo', required: true, status: 'pending', deliverAtDestination: true },
            { id: 'tie-downs', itemType: 'cargo', required: false, status: 'loaded', deliverAtDestination: false }
        ]
    };
}

test('APT departure gates match the legacy required-item and signature rules', () => {
    const manifest = aptManifest();
    let gates = core.deriveGateState(manifest, { atHome: false });
    assert.deepEqual(gates.requiredDepartureMissingItems.map(item => item.id), ['mission-passenger', 'primary-cargo']);
    assert.equal(gates.loadReady, false);

    manifest.items[0].status = 'loaded';
    manifest.items[1].status = 'loaded';
    gates = core.deriveGateState(manifest, { atHome: false });
    assert.equal(gates.departureItemsComplete, true);
    assert.equal(gates.loadReady, false, 'loaded items still require a departure signature');

    manifest.dispatchSignature = { scope: 'departure', by: 'Pilot' };
    gates = core.deriveGateState(manifest, { atHome: false });
    assert.equal(gates.loadReady, true);
    assert.equal(gates.unloadOpenItems.some(item => item.id === 'tie-downs'), false, 'onboard optional equipment must not become destination cargo');
});

test('APT arrival keeps cargo, passenger and arrival signature gates distinct', () => {
    const manifest = aptManifest();
    manifest.items[0].status = 'loaded';
    manifest.items[1].status = 'loaded';
    manifest.dispatchSignature = { scope: 'departure' };

    let gates = core.deriveGateState(manifest, { atHome: false });
    assert.deepEqual(gates.requiredUnloadBlockingItems.map(item => item.id), ['primary-cargo']);
    assert.equal(core.needsUnload(manifest, { ignorePassenger: true }), true);
    assert.equal(gates.unloadReady, false);

    manifest.items[1].status = 'unloaded';
    gates = core.deriveGateState(manifest, { atHome: false });
    assert.equal(gates.requiredUnloadComplete, true);
    assert.equal(core.needsUnload(manifest, { ignorePassenger: true }), false);
    assert.equal(core.needsArrivalWorkflow(manifest, { ignorePassenger: true }), true, 'arrival signature remains mandatory');
    assert.equal(core.needsUnload(manifest), true, 'loaded PAX remains visible until deboarding');

    manifest.dispatchSignature = { scope: 'arrival' };
    gates = core.deriveGateState(manifest, { atHome: false });
    assert.equal(gates.unloadReady, true);
    assert.equal(core.needsArrivalWorkflow(manifest, { ignorePassenger: true }), false);
    assert.equal(core.needsArrivalWorkflow(manifest), true, 'PAX still requires the farewell/deboarding path');
});

test('pickup, home delivery, handoff lock and signature invalidation preserve legacy semantics', () => {
    const manifest = {
        dispatchSignature: { scope: 'pickup' },
        items: [
            { id: 'pickup-pax', itemType: 'passenger', required: true, status: 'loaded', pickupLocation: 'target', deliverAtHome: true },
            { id: 'pickup-bag', itemType: 'cargo', required: true, status: 'loaded', pickupLocation: 'target', deliverAtHome: true }
        ]
    };
    assert.equal(core.deriveGateState(manifest, { atHome: false }).pickupReady, true);
    assert.equal(core.needsUnload(manifest, { atHome: false }), false);
    assert.equal(core.needsUnload(manifest, { atHome: true }), true);
    assert.equal(core.itemCanLoadAtCurrentStage({ pickupLocation: 'target' }, { atTarget: false }), false);
    assert.equal(core.itemCanLoadAtCurrentStage({ pickupLocation: 'target' }, { atTarget: true }), true);
    assert.equal(core.itemCanLoadAtCurrentStage({ pickupLocation: 'target', handoffComplete: true }, { atTarget: true }), false);
    assert.equal(core.clearDispatchSignature(manifest), true);
    assert.equal(manifest.dispatchSignature, null);
    assert.equal(core.clearDispatchSignature(manifest), false);
});

test('legacy normalization edge cases remain unchanged during extraction', () => {
    assert.equal(core.isPassengerItem({ itemType: 'PASSENGER' }), true);
    assert.equal(core.isPassengerItem({ itemType: ' passenger ' }), false);
    assert.equal(core.isTargetPickupItem({ pickupLocation: 'target' }), true);
    assert.equal(core.isTargetPickupItem({ pickupLocation: 'TARGET' }), false);
    assert.equal(core.signatureMatchesMode({ scope: 'ARRIVAL' }, 'unload'), true);
    assert.equal(core.signatureMatchesMode({ scope: ' arrival ' }, 'unload'), false);
    assert.equal(core.signatureScope(' unload '), 'departure');
});

test('cargo load, unload, reload and reset transitions reproduce the legacy manifest fields', () => {
    const manifest = {
        dispatchSignature: { scope: 'departure', by: 'Pilot' },
        items: [{
            id: 'cargo', itemType: 'cargo', status: 'pending', persistentEquipment: true, persistentEquipmentInherited: true,
            loadedAt: 0, unloadedAt: 0, droppedAt: 0, unloadLat: null, unloadLon: null,
            unloadAltFt: null, droppedLat: null, droppedLon: null, droppedAltFt: null,
            lostAt: 12, handoffComplete: false, handedOffAt: 0
        }]
    };

    let plan = core.planItemTransition(manifest, { action: 'load', itemId: 'cargo' }, {
        now: 100, groundHandlingAllowed: true, complianceAllowed: true, atTarget: false
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.wasUnloaded, false);
    assert.equal(core.commitItemTransition(manifest, plan).ok, true);
    assert.deepEqual(manifest.items[0], {
        id: 'cargo', itemType: 'cargo', status: 'loaded', persistentEquipment: true, persistentEquipmentInherited: false,
        loadedAt: 100, unloadedAt: 0, droppedAt: 0, unloadLat: null, unloadLon: null,
        unloadAltFt: null, droppedLat: null, droppedLon: null, droppedAltFt: null,
        lostAt: 0, handoffComplete: false, handedOffAt: 0
    });
    assert.equal(manifest.dispatchSignature, null);

    manifest.dispatchSignature = { scope: 'arrival' };
    plan = core.planItemTransition(manifest, { action: 'unload', itemId: 'cargo' }, {
        now: 200, groundHandlingAllowed: true, complianceAllowed: true,
        position: { lat: 48.1, lon: 9.2, altFt: 1234 }
    });
    assert.equal(core.commitItemTransition(manifest, plan).ok, true);
    assert.equal(manifest.items[0].status, 'unloaded');
    assert.equal(manifest.items[0].loadedAt, 100, 'unload keeps the original loading timestamp');
    assert.equal(manifest.items[0].unloadedAt, 200);
    assert.equal(manifest.items[0].unloadLat, 48.1);
    assert.equal(manifest.items[0].unloadLon, 9.2);
    assert.equal(manifest.items[0].unloadAltFt, 1234);

    plan = core.planItemTransition(manifest, { action: 'load', itemId: 'cargo' }, {
        now: 300, groundHandlingAllowed: true, complianceAllowed: true, reloadAllowed: true
    });
    assert.equal(plan.wasUnloaded, true);
    assert.equal(core.commitItemTransition(manifest, plan).ok, true);
    assert.equal(manifest.items[0].status, 'loaded');
    assert.equal(manifest.items[0].loadedAt, 300);
    assert.equal(manifest.items[0].unloadLat, null);

    plan = core.planItemTransition(manifest, { action: 'reset_to_pending', itemId: 'cargo' }, {
        groundHandlingAllowed: true, complianceAllowed: true
    });
    assert.equal(core.commitItemTransition(manifest, plan).ok, true);
    assert.equal(manifest.items[0].status, 'pending');
    assert.equal(manifest.items[0].loadedAt, 0);
    assert.equal(manifest.items[0].healthPct, 100);
});

test('airborne cargo drop is deterministic and cannot be reused after commit', () => {
    const manifest = {
        dispatchSignature: { scope: 'departure' },
        items: [{ id: 'bundle', itemType: 'cargo', status: 'loaded', unloadedAt: 0 }]
    };
    const plan = core.planItemTransition(manifest, { action: 'unload', itemId: 'bundle' }, {
        now: 500, airborne: true, complianceAllowed: true, position: { lat: 47.5, lon: 8.5, altFt: 2500 }
    });
    assert.equal(plan.action, 'drop');
    assert.equal(core.commitItemTransition(manifest, plan).ok, true);
    assert.deepEqual(manifest.items[0], {
        id: 'bundle', itemType: 'cargo', status: 'dropped', unloadedAt: 0,
        droppedAt: 500, unloadLat: null, unloadLon: null, unloadAltFt: null,
        droppedLat: 47.5, droppedLon: 8.5, droppedAltFt: 2500, healthPct: 0
    });
    assert.equal(manifest.dispatchSignature, null);
    assert.equal(core.commitItemTransition(manifest, plan).error, 'manifest_transition_conflict');
    assert.equal(core.planItemTransition(manifest, { action: 'load', itemId: 'bundle' }, {
        groundHandlingAllowed: true, complianceAllowed: true
    }).error, 'manifest_item_dropped');
});

test('every removal path permanently detaches inherited equipment from the payload baseline', () => {
    for (const [action, context, expectedStatus] of [
        ['unload', { now: 100, groundHandlingAllowed: true, complianceAllowed: true }, 'unloaded'],
        ['reset_to_pending', { groundHandlingAllowed: true, complianceAllowed: true }, 'pending'],
        ['drop', { now: 100, airborne: true, complianceAllowed: true }, 'dropped']
    ]) {
        const manifest = { items: [{
            id: `kit-${action}`,
            itemType: 'cargo',
            status: 'loaded',
            weightLbs: 20,
            persistentEquipment: true,
            persistentEquipmentInherited: true
        }] };
        const plan = core.planItemTransition(manifest, { action, itemId: manifest.items[0].id }, context);
        assert.equal(plan.ok, true, action);
        assert.equal(core.commitItemTransition(manifest, plan).ok, true, action);
        assert.equal(manifest.items[0].status, expectedStatus, action);
        assert.equal(manifest.items[0].persistentEquipmentInherited, false, action);
    }
});

test('transition failures use stable codes and leave the manifest untouched', () => {
    const manifest = {
        dispatchSignature: { scope: 'departure' },
        items: [
            { id: 'pickup', itemType: 'cargo', status: 'pending', pickupLocation: 'target' },
            { id: 'locked', itemType: 'cargo', status: 'unloaded', handoffComplete: true },
            { id: 'loaded', itemType: 'cargo', status: 'loaded' }
        ]
    };
    const before = JSON.stringify(manifest);
    assert.equal(core.planItemTransition(manifest, { action: 'load', itemId: 'missing' }, {}).error, 'manifest_item_not_found');
    assert.equal(core.planItemTransition(manifest, { action: 'load', itemId: 'pickup' }, {
        atTarget: false, groundHandlingAllowed: true, complianceAllowed: true
    }).error, 'manifest_pickup_not_available');
    assert.equal(core.planItemTransition(manifest, { action: 'load', itemId: 'locked' }, {
        atTarget: true, groundHandlingAllowed: true, complianceAllowed: true
    }).error, 'manifest_item_handoff_locked');
    assert.equal(core.planItemTransition(manifest, { action: 'unload', itemId: 'loaded' }, {
        groundHandlingAllowed: false, complianceAllowed: true
    }).error, 'manifest_ground_handling_required');
    assert.equal(core.planItemTransition({ items: [{ id: 'unguarded', itemType: 'cargo', status: 'pending' }] }, {
        action: 'load', itemId: 'unguarded'
    }, { now: 10 }).error, 'manifest_ground_handling_required', 'missing tracker facts must fail closed');
    assert.equal(JSON.stringify(manifest), before);
});

test('passenger transitions declare their required animation effect without mutating state', () => {
    const manifest = {
        dispatchSignature: { scope: 'departure' },
        items: [{ id: 'pax', itemType: 'passenger', status: 'pending', required: true }]
    };
    let plan = core.planItemTransition(manifest, { action: 'load', itemId: 'pax' }, {
        groundHandlingAllowed: true, complianceAllowed: true, missionActive: true
    });
    assert.equal(plan.requiresEffect, 'passenger.board');
    assert.equal(core.commitItemTransition(manifest, plan).error, 'manifest_transition_effect_pending');
    assert.equal(manifest.items[0].status, 'pending');
    assert.ok(manifest.dispatchSignature);

    manifest.items[0].status = 'loaded';
    plan = core.planItemTransition(manifest, { action: 'unload', itemId: 'pax' }, {
        groundHandlingAllowed: true, complianceAllowed: true, passengerFarewellPending: true
    });
    assert.equal(plan.requiresEffect, 'passenger.farewell_then_deboard');
    assert.equal(core.planItemTransition(manifest, { action: 'drop', itemId: 'pax' }, {
        complianceAllowed: true
    }).error, 'manifest_passenger_drop_not_allowed');

    plan = core.planItemTransition(manifest, { action: 'unload', itemId: 'pax' }, {
        now: 300,
        groundHandlingAllowed: true,
        complianceAllowed: true,
        effectAcknowledged: 'passenger.farewell_then_deboard',
        position: { lat: 48.3, lon: 8.5, altFt: 900 }
    });
    assert.equal(plan.requiresEffect, null);
    assert.equal(core.commitItemTransition(manifest, plan).ok, true);
    assert.equal(manifest.items[0].status, 'unloaded');
    assert.equal(manifest.items[0].unloadedAt, 300);
    assert.equal(manifest.items[0].unloadLat, 48.3);
    assert.equal(manifest.items[0].handoffComplete, false);
});

test('departure, pickup and arrival signatures use the same deterministic gates', () => {
    const manifest = {
        dispatchSignature: null,
        items: [
            { id: 'departure', itemType: 'cargo', required: true, status: 'pending' },
            { id: 'pickup', itemType: 'cargo', required: true, status: 'pending', pickupLocation: 'target' },
            { id: 'pax', itemType: 'passenger', required: true, status: 'loaded', deliverAtDestination: true }
        ]
    };
    let plan = core.planSignatureTransition(manifest, { action: 'sign', mode: 'load' }, {});
    assert.equal(plan.error, 'manifest_required_load_pending');
    assert.deepEqual(plan.missingItems.map(item => item.id), ['departure']);

    manifest.items[0].status = 'loaded';
    plan = core.planSignatureTransition(manifest, {
        action: 'sign', mode: 'load',
        signature: { by: 'Pilot', at: 700, aircraft: 'PA-24', note: '  bereit  ' }
    }, {});
    assert.equal(core.commitSignatureTransition(manifest, plan).ok, true);
    assert.deepEqual(manifest.dispatchSignature, {
        by: 'Pilot', at: 700, aircraft: 'PA-24', scope: 'departure', note: 'bereit'
    });

    plan = core.planSignatureTransition(manifest, { action: 'clear', mode: 'pickup' }, {});
    assert.equal(plan.error, 'manifest_signature_scope_mismatch');
    plan = core.planSignatureTransition(manifest, { action: 'clear', mode: 'load' }, {});
    assert.equal(core.commitSignatureTransition(manifest, plan).ok, true);
    assert.equal(manifest.dispatchSignature, null);

    plan = core.planSignatureTransition(manifest, { action: 'sign', mode: 'pickup' }, {});
    assert.equal(plan.error, 'manifest_required_pickup_pending');
    manifest.items[1].status = 'loaded';
    plan = core.planSignatureTransition(manifest, {
        action: 'sign', mode: 'pickup', signature: { by: 'Pilot', at: 800, aircraft: 'PA-24' }
    }, {});
    assert.equal(core.commitSignatureTransition(manifest, plan).scope, 'pickup');

    manifest.items[0].status = 'loaded';
    manifest.items[1].status = 'loaded';
    manifest.items.push({ id: 'destination-cargo', itemType: 'cargo', required: true, status: 'loaded', deliverAtDestination: true });
    plan = core.planSignatureTransition(manifest, { action: 'sign', mode: 'unload' }, { atHome: false });
    assert.equal(plan.error, 'manifest_required_unload_pending');
    assert.deepEqual(plan.missingItems.map(item => item.id), ['departure', 'pickup', 'destination-cargo']);
    manifest.items.filter(item => item.itemType !== 'passenger').forEach(item => { item.status = 'unloaded'; });
    plan = core.planSignatureTransition(manifest, {
        action: 'sign', mode: 'unload', signature: { by: 'Pilot', at: 900, aircraft: 'PA-24' }
    }, { atHome: false });
    assert.equal(core.commitSignatureTransition(manifest, plan).scope, 'arrival');
    assert.equal(manifest.dispatchSignature.scope, 'arrival');
});

test('board book entries preserve the App flight log fields without invalidating the signature', () => {
    const manifest = {
        groundInventory: false,
        flightEvents: { flightId: 'apt|flight', startAt: 1000 },
        dispatchSignature: { scope: 'departure', by: 'Pilot' },
        items: [{ id: 'bordbuch', label: 'Bordbuch / Dispatch-Mappe', status: 'loaded', persistentEquipment: true, log: {} }]
    };
    const initial = core.boardBookActionState(manifest.items[0], manifest, {
        currentFlightId: 'apt|flight', missionAvailable: true, complianceAllowed: true
    });
    assert.equal(initial.field, 'start');
    assert.equal(initial.label, 'Startzeit eintragen');
    assert.equal(initial.allowed, true);

    let plan = core.planBoardBookEntry(manifest, {
        itemId: 'bordbuch', field: 'start', source: 'tracker'
    }, {
        currentFlightId: 'apt|flight', timestamp: 1000, formattedTime: '01.01.26, 10:00',
        endpointLabel: 'EDTW', loggedAt: 1100, complianceAllowed: true
    });
    assert.equal(plan.ok, true);
    assert.equal(core.commitMetadataTransition(manifest, plan).ok, true);
    assert.deepEqual(manifest.items[0].log, {
        flightId: 'apt|flight', loggedAt: 1100, lastSource: 'tracker', backfilled: true,
        startTime: '01.01.26, 10:00', startAt: 1000, origin: 'EDTW'
    });
    assert.equal(manifest.dispatchSignature.scope, 'departure');

    plan = core.planBoardBookEntry(manifest, {
        itemId: 'bordbuch', field: 'landing', source: 'tracker'
    }, {
        currentFlightId: 'apt|flight', timestamp: 2000, formattedTime: '01.01.26, 11:00',
        endpointLabel: 'EDTL', loggedAt: 2100, complianceAllowed: true
    });
    assert.equal(core.commitMetadataTransition(manifest, plan).ok, true);
    assert.equal(core.boardBookActionState(manifest.items[0], manifest, {
        currentFlightId: 'apt|flight', missionAvailable: true
    }).complete, true);
    assert.equal(manifest.items[0].log.destination, 'EDTL');
    assert.equal(manifest.flightEvents.landingAt, 2000);
});

test('equipment replacement uses the App five-day threshold and keeps cargo state stable', () => {
    const manifest = {
        dispatchSignature: { scope: 'arrival' },
        items: [{
            id: 'first-aid', status: 'unloaded', persistentEquipment: true, equipmentType: 'expiry',
            expiresAt: '2026-01-10', serialId: 'OLD'
        }]
    };
    const now = Date.UTC(2026, 0, 5, 12);
    assert.equal(core.planEquipmentReplacement(manifest, { itemId: 'first-aid' }, {
        now, complianceAllowed: true, serialId: 'NEW', expiresAt: '2026-02-01'
    }).error, 'manifest_equipment_replacement_too_early');
    const plan = core.planEquipmentReplacement(manifest, { itemId: 'first-aid' }, {
        now: Date.UTC(2026, 0, 6, 12), complianceAllowed: true,
        serialId: 'NEW', expiresAt: '2026-02-01'
    });
    assert.equal(plan.ok, true);
    assert.equal(core.commitMetadataTransition(manifest, plan).ok, true);
    assert.equal(manifest.items[0].status, 'unloaded');
    assert.equal(manifest.items[0].serialId, 'NEW');
    assert.equal(manifest.items[0].expiresAt, '2026-02-01');
    assert.equal(manifest.dispatchSignature.scope, 'arrival');
});

test('browser and Node expose the same manifest core', () => {
    const source = fs.readFileSync(path.join(__dirname, 'mission-manifest-core.js'), 'utf8');
    const context = vm.createContext({});
    vm.runInContext(source, context, { filename: 'mission-manifest-core.js' });
    assert.ok(context.GAMissionManifestCore);
    const manifest = aptManifest();
    manifest.items.forEach(item => { item.status = 'loaded'; });
    manifest.dispatchSignature = { scope: 'departure' };
    const nodeView = core.deriveGateState(manifest, { atHome: false });
    const browserView = context.GAMissionManifestCore.deriveGateState(JSON.parse(JSON.stringify(manifest)), { atHome: false });
    assert.deepEqual(JSON.parse(JSON.stringify(browserView)), JSON.parse(JSON.stringify(nodeView)));
});
