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
const requiredRoles = [
    'cargo.camera_equipment',
    'cargo.camping_equipment',
    'cargo.equipment_case',
    'cargo.medical_kit',
    'cargo.animal_transport_box',
    'scene.lighting.lantern'
];
requiredRoles.forEach(role => {
    assert.ok(Array.isArray(roles[role]) && roles[role].length > 0, `missing asset role ${role}`);
});

const syncSource = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
const functionSource = (name) => {
    const start = syncSource.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `missing function ${name}`);
    const open = syncSource.indexOf('{', start);
    let depth = 0;
    for (let i = open; i < syncSource.length; i += 1) {
        if (syncSource[i] === '{') depth += 1;
        if (syncSource[i] === '}') depth -= 1;
        if (depth === 0) return syncSource.slice(start, i + 1);
    }
    throw new Error(`unterminated function ${name}`);
};

const pools = {
    mailSacks: roles['cargo.mail_sack'],
    coolers: roles['cargo.cooler'],
    animalTransportBoxes: roles['cargo.animal_transport_box'],
    medicalEquipment: roles['cargo.medical_kit'],
    jerrycanPairs: roles['cargo.jerrycan_pair'],
    toolCarts: roles['cargo.tool_cart'],
    toolboxes: roles['cargo.toolbox'],
    luggageDuffels: roles['cargo.luggage.duffel'],
    luggageBackpacks: roles['cargo.luggage.backpack'],
    campingEquipment: roles['cargo.camping_equipment'],
    cameraEquipment: roles['cargo.camera_equipment'],
    equipmentCases: roles['cargo.equipment_case'],
    woodCrates: roles['cargo.wood_crate']
};

const matcherContext = {
    MISSION_SCENE_ASSET_POOLS: pools,
    _scenePickTitle: (pool, _salt, fallback = '') => pool?.[0] || fallback
};
vm.runInNewContext(
    `${functionSource('_sceneAssetCandidates')}\n${functionSource('_missionSceneSemanticCargoAsset')}`,
    matcherContext
);

const match = (label, weight) => matcherContext._missionSceneSemanticCargoAsset(label, weight)?.title || '';
const CAMERA = 'VFR Multitool Mission Camera Equipment Cargo';
const CAMPING = 'VFR Multitool Mission Camping Equipment Cargo';
const MEDICAL = 'VFR Multitool Mission Medical Backpack Cargo';
const ANIMAL = 'VFR Multitool Mission Pet Carrier Cargo';
const CASE_SMALL = 'VFR Multitool Homebase Hardcase Yellow Small';
const CASE_MEDIUM = 'VFR Multitool Homebase Hardcase Red Pro';
const CASE_LARGE = 'VFR Multitool Homebase Flight Case Black';

assert.equal(match('Kamera- und Audio-Set (32 lbs)', 32), CAMERA);
assert.equal(match('Duffelbags und Kameraausrüstung (42 lbs)', 42), CAMERA);
assert.equal(match('Kamerarucksack, Stativtasche und Filtercase (31 lbs)', 31), roles['cargo.luggage.backpack'][0]);
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

console.log('mission scene cargo selftest: ok');
