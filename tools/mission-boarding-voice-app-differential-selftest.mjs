#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import boardingVoiceCore from '../mission-boarding-voice-core.js';

const passengerSource = fs.readFileSync(new URL('../passenger-voice.js', import.meta.url), 'utf8');

function functionSource(name) {
    const start = passengerSource.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `missing ${name}`);
    const open = passengerSource.indexOf(') {', start) + 2;
    let depth = 0;
    let quote = '';
    let escaped = false;
    for (let index = open; index < passengerSource.length; index += 1) {
        const char = passengerSource[index];
        if (escaped) { escaped = false; continue; }
        if (char === '\\') { escaped = true; continue; }
        if (quote) {
            if (char === quote) quote = '';
            continue;
        }
        if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) return passengerSource.slice(start, index + 1);
        }
    }
    throw new Error(`unterminated ${name}`);
}

const executable = [
    functionSource('_extractPaxCount'),
    functionSource('_stripManifestWeightForSpeech'),
    functionSource('_joinSpeechItems'),
    functionSource('_boardingEquipmentPhrase'),
    functionSource('_boardingFallbackVariantIndex'),
    functionSource('_buildBoardingTextLegacy'),
    functionSource('_buildBoardingText')
].join('\n\n');

const scenarios = [
    {
        name: 'single passenger with equipment',
        missionId: 'mission-pax',
        paxText: '1 PAX',
        cargoText: 'Kameratasche (12 lbs)',
        targetName: 'Freiburg',
        hasPax: true,
        passenger: { name: 'Mara', role: 'Fotografin', gender: 'female' },
        requiredItems: ['Kameratasche (12 lbs)']
    },
    {
        name: 'multi passenger',
        missionId: 'mission-multi',
        paxText: '3 PAX',
        cargoText: 'Tagesgepäck',
        targetName: 'Konstanz',
        hasPax: true,
        passenger: { name: 'Jonas', role: 'Reisegast', gender: 'male' },
        requiredItems: ['Tagesgepäck']
    },
    {
        name: 'cargo only loadmaster',
        missionId: 'mission-cargo',
        cargoOnly: { cargoText: 'Medikamente', dest: 'EDTL' },
        cargoText: 'Medikamente',
        requiredItems: ['Kühlbox']
    },
    {
        name: 'empty outbound pickup',
        missionId: 'mission-pickup',
        paxText: '0 PAX',
        cargoText: '–',
        targetName: 'Waldstrip',
        targetPickupMission: true,
        passenger: { name: '', role: '', gender: 'female' }
    },
    {
        name: 'training schedule',
        missionId: 'mission-training',
        paxText: '1 PAX',
        cargoText: '–',
        hasPax: true,
        taskDomain: 'training',
        trainingSchedule: 'Ich habe heute zwei Uebungen fuer dich vorbereitet: Vollkreis und Stall.',
        passenger: { name: 'Lea', role: 'Fluglehrerin', gender: 'female' }
    }
];

function run(coreEnabled, scenario) {
    const contract = {
        paxText: scenario.paxText || '',
        cargoText: scenario.cargoText || '',
        targetName: scenario.targetName || '',
        ...(scenario.targetPickupMission
            ? { bush: { targetMode: 'strip_then_return', pickupKind: 'passenger' } }
            : {})
    };
    const context = {
        window: {
            GAMissionBoardingVoiceCore: coreEnabled ? boardingVoiceCore : null,
            activePassenger: scenario.passenger || null,
            activeMissionContract: contract
        },
        currentMissionData: {
            missionId: scenario.missionId,
            targetName: scenario.targetName || '',
            dest: scenario.cargoOnly?.dest || scenario.targetName || '',
            missionContract: contract
        },
        localStorage: { getItem: () => JSON.stringify(contract) },
        document: { getElementById: () => null },
        _cargoOnlyVoiceContext: () => scenario.cargoOnly || null,
        _missionRequiredItemNames: () => scenario.requiredItems || [],
        _trainingProcedureScheduleText: () => scenario.trainingSchedule || '',
        _activeTaskDomain: () => scenario.taskDomain || '',
        _missionHasPax: () => scenario.hasPax === true,
        Math,
        Number,
        String,
        JSON,
        Object,
        Array,
        RegExp
    };
    context.window.window = context.window;
    vm.runInNewContext(executable, context, { filename: 'passenger-voice.js#boarding-differential' });
    return context._buildBoardingText();
}

for (const scenario of scenarios) {
    assert.equal(run(true, scenario), run(false, scenario), `boarding fallback drifted: ${scenario.name}`);
}

console.log('mission boarding voice/app differential selftest: ok');
