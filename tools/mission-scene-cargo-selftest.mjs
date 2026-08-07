#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const catalogContext = { window: {} };
vm.runInNewContext(
    fs.readFileSync(new URL('../data/mission-scene-assets.js', import.meta.url), 'utf8'),
    catalogContext
);

const roles = catalogContext.window.MISSION_SCENE_ASSETS?.roles || {};
const homebaseCatalog = JSON.parse(
    fs.readFileSync(new URL('../homebase/assets/catalog.json', import.meta.url), 'utf8')
);
const requiredRoles = [
    'cargo.camera_equipment',
    'cargo.camping_equipment',
    'cargo.equipment_case',
    'cargo.luggage.suitcase',
    'cargo.medical_kit',
    'cargo.animal_transport_box',
    'cargo.aircraft_logbook',
    'cargo.fire_extinguisher',
    'cargo.first_aid_case',
    'cargo.wheel_chocks',
    'scene.lighting.lantern'
];
requiredRoles.forEach(role => {
    assert.ok(Array.isArray(roles[role]) && roles[role].length > 0, `missing asset role ${role}`);
});

const syncSource = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
const functionSource = (name) => {
    const start = syncSource.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `missing function ${name}`);
    const open = syncSource.indexOf(') {', start) + 2;
    assert.ok(open > start, `missing function body ${name}`);
    let depth = 0;
    for (let i = open; i < syncSource.length; i += 1) {
        if (syncSource[i] === '{') depth += 1;
        if (syncSource[i] === '}') depth -= 1;
        if (depth === 0) return syncSource.slice(start, i + 1);
    }
    throw new Error(`unterminated function ${name}`);
};

const startSceneContext = {
    _missionIsFreeflightOnly: () => false,
    _missionCargoEnsureManifest: () => ({
        key: 'mission-test',
        items: [
            { id: 'mission-pending', itemType: 'cargo', status: 'pending', objectTitle: 'Mission Bag', sceneKind: 'cargo' },
            { id: 'mission-loaded', itemType: 'cargo', status: 'loaded', objectTitle: 'Loaded Bag', sceneKind: 'cargo_loaded' },
            { id: 'mission-unloaded', itemType: 'cargo', status: 'unloaded', objectTitle: 'Unloaded Bag', sceneKind: 'cargo_unloaded' },
            { id: 'equipment-offboard', itemType: 'cargo', status: 'unloaded', persistentEquipment: true, objectTitle: 'Chocks', sceneKind: 'chocks' },
            { id: 'target-pickup', itemType: 'cargo', status: 'pending', pickupLocation: 'target', objectTitle: 'Pickup', sceneKind: 'pickup' },
            { id: 'passenger', itemType: 'passenger', status: 'pending', objectTitle: 'Passenger', sceneKind: 'pax' }
        ]
    }),
    _missionCargoIsPassengerItem: item => item?.itemType === 'passenger',
    _missionCargoStableObjectKey: item => `mission-cargo:mission-test:${item.id}`,
    _missionSceneBoardingCargoCandidates: (_title, candidates) => candidates,
    _missionSceneCargoIsSemanticHomebaseTitle: () => false,
    _missionSceneSafeBoardingCargoTitle: title => title,
    _missionSceneCargoLooksLikeSmallLoosePayload: () => false,
    MISSION_SCENE_ASSET_POOLS: { smallCargo: ['Cardboard'], cargo: ['Cardboard'] },
    Number,
    String
};
vm.runInNewContext(functionSource('_missionSceneCargoItems'), startSceneContext);
const startCargoItems = startSceneContext._missionSceneCargoItems(
    { forwardM: 4, rightM: 4, altOffsetFt: 0 },
    { title: 'Cardboard', candidates: ['Cardboard'] }
);
assert.deepEqual(
    Array.from(startCargoItems, item => item.cargoItemId),
    ['mission-pending'],
    'mission start scene must contain only pending, non-persistent departure cargo'
);
assert.equal(startCargoItems[0].objectKey, 'mission-cargo:mission-test:mission-pending');

const aptArrivalContext = {
    _missionAptArrivalPreviewItems: plan => plan.items || [],
    _missionCargoEnsureManifest: () => ({
        key: 'pickup-test',
        items: [
            { id: 'pickup-passenger', itemType: 'passenger', required: true, pickupLocation: 'target', status: 'pending' },
            { id: 'pickup-companion-cargo', itemType: 'cargo', required: true, pickupLocation: 'target', status: 'pending' }
        ]
    }),
    _missionCargoIsPassengerItem: item => item?.itemType === 'passenger',
    _missionBushIsPickupPassengerMission: () => true,
    _missionAptArrivalAssetForItem: item => ({ title: item.objectTitle || item.label, candidates: [item.objectTitle || item.label] }),
    _missionCargoStableObjectKey: item => `mission-cargo:pickup-test:${item.id}`,
    Number,
    String
};
vm.runInNewContext(functionSource('_missionAptArrivalSceneItems'), aptArrivalContext);
const aptArrivalPlan = {
    items: [
        { kind: 'arrival_vehicle', label: 'Bush-Fahrzeug', role: 'vehicle.car' },
        { kind: 'arrival_person_1', label: 'Pickup-Gast', role: 'person.ground_crew' },
        { kind: 'arrival_equipment_1', label: 'Begleitfracht', role: 'cargo.equipment_case' }
    ]
};
const pickupArrivalItems = aptArrivalContext._missionAptArrivalSceneItems(aptArrivalPlan);
assert.deepEqual(
    Array.from(pickupArrivalItems, item => item.kind),
    ['arrival_vehicle', 'person_boarder_1', 'arrival_equipment_1'],
    'passenger pickup arrival must expose its waiting person to the tracker boarding handler'
);
aptArrivalContext._missionBushIsPickupPassengerMission = () => false;
const regularArrivalItems = aptArrivalContext._missionAptArrivalSceneItems(aptArrivalPlan);
assert.deepEqual(
    Array.from(regularArrivalItems, item => item.kind),
    ['arrival_vehicle', 'arrival_person_1', 'arrival_equipment_1'],
    'regular arrival contacts must remain non-boardable'
);

const personalLuggage = [
    ...roles['cargo.luggage.duffel'],
    ...roles['cargo.luggage.suitcase'],
    ...roles['cargo.luggage.backpack'],
    ...roles['cargo.equipment_case']
];
const pools = {
    smallCargo: ['Cardboard', 'CoffeeCup'],
    mailSacks: roles['cargo.mail_sack'],
    coolers: roles['cargo.cooler'],
    animalTransportBoxes: roles['cargo.animal_transport_box'],
    medicalEquipment: roles['cargo.medical_kit'],
    jerrycanPairs: roles['cargo.jerrycan_pair'],
    toolCarts: roles['cargo.tool_cart'],
    toolboxes: roles['cargo.toolbox'],
    luggageDuffels: roles['cargo.luggage.duffel'],
    luggageBackpacks: roles['cargo.luggage.backpack'],
    luggageSuitcases: roles['cargo.luggage.suitcase'],
    personalLuggage,
    campingEquipment: roles['cargo.camping_equipment'],
    cameraEquipment: [
        ...roles['cargo.camera_equipment'],
        ...roles['cargo.equipment_case'],
        ...roles['cargo.luggage.duffel'],
        ...roles['cargo.luggage.suitcase'],
        ...roles['cargo.luggage.backpack']
    ],
    equipmentCases: roles['cargo.equipment_case'],
    woodCrates: roles['cargo.wood_crate'],
    aircraftLogbooks: roles['cargo.aircraft_logbook'],
    fireExtinguishers: roles['cargo.fire_extinguisher'],
    firstAidCases: roles['cargo.first_aid_case'],
    wheelChocks: roles['cargo.wheel_chocks']
};

const matcherContext = {
    MISSION_SCENE_ASSET_POOLS: pools,
    _scenePickTitle: (pool, _salt, fallback = '') => pool?.[0] || fallback
};
vm.runInNewContext(
    [
        functionSource('_sceneUniqueTitles'),
        functionSource('_sceneAssetCandidates'),
        functionSource('_missionSceneSafeBoardingCargoCandidates'),
        functionSource('_missionSceneCargoIsPersonalLuggageTitle'),
        functionSource('_missionSceneBoardingCargoCandidates'),
        functionSource('_missionSceneSemanticCargoAsset')
    ].join('\n'),
    matcherContext
);

const matchAsset = (label, weight) => matcherContext._missionSceneSemanticCargoAsset(label, weight) || null;
const match = (label, weight) => matchAsset(label, weight)?.title || '';
const CAMERA = 'VFR Multitool Mission Camera Equipment Cargo';
const CAMPING = 'VFR Multitool Mission Camping Equipment Cargo';
const MEDICAL = 'VFR Multitool Mission Medical Backpack Cargo';
const ANIMAL = 'VFR Multitool Mission Pet Carrier Cargo';
const CASE_SMALL = 'VFR Multitool Homebase Hardcase Yellow Small';
const CASE_MEDIUM = 'VFR Multitool Homebase Hardcase Red Pro';
const CASE_LARGE = 'VFR Multitool Homebase Flight Case Black';
const LOGBOOK = 'VFR Multitool Mission Aircraft Logbook Cargo';
const FIRE_EXTINGUISHER = 'VFR Multitool Homebase Fire Extinguisher';
const FIRST_AID_CASE = 'VFR Multitool Homebase First Aid Case';
const WHEEL_CHOCKS = 'VFR Multitool Homebase Aircraft Wheel Chocks';
const DUFFEL = 'VFR Multitool Homebase Duffel Bag';
const SUITCASE = 'VFR Multitool Homebase Travel Suitcase';
assert.ok(JSON.stringify(homebaseCatalog).includes(WHEEL_CHOCKS), 'wheel chocks missing from Homebase asset catalog');

assert.equal(match('Kamera- und Audio-Set (32 lbs)', 32), CAMERA);
assert.equal(match('Duffelbags und Kameraausrüstung (42 lbs)', 42), CAMERA);
assert.equal(match('Kamerarucksack, Stativtasche und Filtercase (31 lbs)', 31), roles['cargo.luggage.backpack'][0]);
const cameraBag = matchAsset('Kleine Kameratasche und Sonnenbrillen (10 lbs)', 10);
assert.equal(cameraBag?.title, CAMERA);
assert.ok(cameraBag?.candidates.includes(CASE_SMALL), 'camera cargo should fall back to a hardcase');
assert.ok(cameraBag?.candidates.includes(DUFFEL), 'camera cargo should fall back to a travel bag');
assert.ok(cameraBag?.candidates.includes(SUITCASE), 'camera cargo should fall back to a suitcase');
assert.ok(!cameraBag?.candidates.includes('Cardboard'), 'personal camera cargo must not use Cardboard as its semantic fallback');
const cameraBoardingCandidates = matcherContext._missionSceneBoardingCargoCandidates(
    cameraBag?.title,
    [...cameraBag?.candidates, 'Cardboard', 'CoffeeCup']
);
assert.ok(cameraBoardingCandidates.includes(CASE_SMALL), 'camera boarding should keep the hardcase fallback');
assert.ok(!cameraBoardingCandidates.includes('Cardboard'), 'personal camera cargo must not fall back to Cardboard while boarding');
assert.ok(!cameraBoardingCandidates.includes('CoffeeCup'), 'personal camera cargo must not fall back to a generic small prop');
assert.ok(matcherContext._missionSceneBoardingCargoCandidates('Cardboard', ['Cardboard']).includes('Cardboard'), 'delivery cargo should keep the Cardboard fallback');
assert.ok(personalLuggage.includes(match('Privatgepäck und Sonnenbrillen (12 lbs)', 12)), 'private baggage should resolve to luggage');
assert.equal(match('Campingausrüstung und Tagesrucksäcke (58 lbs)', 58), CAMPING);
assert.equal(match('Packraft-Zubehör und Trockenbeutel (36 lbs)', 36), CAMPING);
assert.equal(match('HEMS-Rucksack und Immobilisationsset (36 lbs)', 36), MEDICAL);
assert.equal(match('Medizinischer Notfallkoffer (22 lbs)', 22), MEDICAL);
assert.equal(match('Kühlbox mit Blutkonserven (18 lbs)', 18), roles['cargo.cooler'][0]);
assert.equal(match('Fuchswelpe in gesicherter Transportbox (18 lbs)', 18), ANIMAL);
assert.equal(match('Kleiner Therapiehund in Reisebox (28 lbs)', 28), ANIMAL);
assert.equal(match('AOG-Avionikmodul im gepolsterten Kuriercase (16 lbs)', 16), CASE_SMALL);
assert.equal(match('Kalibrierter Sensorkoffer (32 lbs)', 32), CASE_MEDIUM);
assert.equal(match('Lidar-Scanner im Flightcase (65 lbs)', 65), CASE_LARGE);
assert.equal(match('Luftfahrzeug-Bordbuch (3 lbs)', 3), LOGBOOK);
assert.equal(match('Feuerlöscher (5 lbs)', 5), FIRE_EXTINGUISHER);
assert.equal(match('Verbandkasten (2 lbs)', 2), FIRST_AID_CASE);
assert.equal(match('Zwei Paar Flugzeug-Radkeile (6 lbs)', 6), WHEEL_CHOCKS);

const targetSceneFeatures = catalogContext.window.MISSION_SCENE_ASSETS?.targetSceneFeatures || {};
['aircraft_logbook', 'fire_extinguisher', 'first_aid_case', 'wheel_chocks'].forEach(feature => {
    assert.ok(targetSceneFeatures[feature], `missing target-scene feature ${feature}`);
});
assert.ok(syncSource.includes("feature === 'aircraft_logbook' || feature === 'fire_extinguisher' || feature === 'first_aid_case' || feature === 'wheel_chocks'"), 'target-scene feature spawner missing');
assert.ok(syncSource.includes("r === 'cargo.aircraft_logbook'"), 'target-scene role mapping missing');

console.log('mission scene cargo selftest: ok');
