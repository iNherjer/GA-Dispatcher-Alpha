#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import farewellVoiceCore from '../mission-farewell-voice-core.js';

const passengerSource = fs.readFileSync(new URL('../passenger-voice.js', import.meta.url), 'utf8');

function blockSource(marker) {
    const start = passengerSource.indexOf(marker);
    assert.ok(start >= 0, `missing ${marker}`);
    const open = passengerSource.indexOf('{', start);
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
            if (depth === 0) {
                const suffix = marker.startsWith('window.') ? ';' : '';
                return passengerSource.slice(start, index + 1) + suffix;
            }
        }
    }
    throw new Error(`unterminated ${marker}`);
}

const executable = [
    blockSource('function _farewellPreparedContext('),
    blockSource('window.paxVoiceBuildFarewellEffectRecipe = function(')
].join('\n\n');

const scenarios = [
    {
        name: 'passenger success prompt',
        passenger: { name: 'Mara' },
        hasPax: true,
        prompt: 'EXAKTER APP PASSENGER FAREWELL',
        directText: ''
    },
    {
        name: 'passenger failure fallback',
        passenger: { name: 'Mara' },
        hasPax: true,
        prompt: '',
        directText: 'EXAKTER APP FAILURE FALLBACK',
        outcome: { status: 'failed', failed: true }
    },
    {
        name: 'cargo-only recipient prompt',
        passenger: null,
        hasPax: false,
        prompt: 'EXAKTER APP CARGO FAREWELL',
        directText: ''
    }
];

for (const scenario of scenarios) {
    const context = {
        window: {
            GAMissionFarewellVoiceCore: farewellVoiceCore,
            activePassenger: scenario.passenger
        },
        currentMissionData: { missionId: `mission-${scenario.name}`, missionKey: `mission-${scenario.name}` },
        _paxAudioEffectsEnabled: true,
        _paxVoiceEnabled: true,
        _paxTtsModelPref: 'auto',
        _missionHasPax: () => scenario.hasPax,
        _missionCargoEvaluateFarewellOutcome: () => scenario.outcome || null,
        _cargoOnlyFarewellPrompt: () => scenario.hasPax ? null : scenario.prompt,
        _cargoMissionSpeaker: () => ({ name: 'Empfaenger', role: 'Frachtkontakt', gender: 'male' }),
        _speakerSnapshotForActivePax: () => ({ name: 'Mara', role: 'Passagier', gender: 'female' }),
        _speakerSnapshotForMissionVoice: () => ({ name: 'Fallback', gender: 'female' }),
        _failedMissionFarewellFallback: () => scenario.directText,
        _farewellPrompt: () => scenario.prompt,
        _paxMissionAudioKey: kind => `${kind}:mission-test`,
        _paxAiTextModels: provider => provider === 'openai' ? [['gpt-5.4']] : [['gemini-3-flash-preview']],
        _paxMissionAudioCueId: () => 'deboarding_pax',
        _activeTaskDomain: () => 'transport',
        _paxTtsHedgeEnabled: () => true,
        _paxTtsHedgeDelayMs: () => 3000,
        _farewellAuthorityContext: () => null,
        Promise,
        Math,
        Number,
        String,
        JSON,
        Object,
        Array
    };
    context.window.window = context.window;
    vm.runInNewContext(executable, context, { filename: 'passenger-voice.js#farewell-differential' });
    const prepared = context._farewellPreparedContext(scenario.outcome ? { missionCargoOutcome: scenario.outcome } : null);
    const recipe = context.window.paxVoiceBuildFarewellEffectRecipe(scenario.outcome ? { missionCargoOutcome: scenario.outcome } : null);
    assert.equal(recipe.prompt, prepared.prompt || '', `${scenario.name}: prompt drift`);
    assert.equal(recipe.text, prepared.text || '', `${scenario.name}: direct text drift`);
    assert.equal(recipe.speaker.name, prepared.speaker.name, `${scenario.name}: speaker drift`);
    assert.equal(recipe.cargoOnly, !scenario.hasPax, `${scenario.name}: cargo-only drift`);
    assert.equal(recipe.cue.id, scenario.hasPax ? 'deboarding_pax' : 'none', `${scenario.name}: cue drift`);
}

function runLegacyFunction(functionNames, globals, expression) {
    const context = {
        ...globals,
        Math,
        Number,
        String,
        JSON,
        Object,
        Array,
        RegExp,
        Set,
        Date
    };
    context.window = context.window || {};
    context.window.window = context.window;
    vm.runInNewContext(functionNames.map(name => blockSource(`function ${name}(`)).join('\n\n'), context, {
        filename: 'passenger-voice.js#farewell-prompt-differential'
    });
    return vm.runInNewContext(expression, context);
}

const passengerRecord = {
    durationSec: 1800,
    distanceNm: 82.14,
    maxAltFt: 6500,
    maxBankDeg: 39.2,
    maxGForce: 1.71,
    maxDescentFpm: -1650,
    touchdownVsFpm: -160,
    missionCargoOutcome: { status: 'completed', failed: false }
};
const liveWeather = { windKts: 18, windDeg: 120, visKm: 10 };
const baseContext = 'ROLLE: Mara (Fotografin)\nAUSGABE: Nur gesprochener Text.';
const followUpHint = '\nANSCHLUSS-HINWEIS: Der Gast bleibt zwei Tage.';
const professionalHint = ' Ton bei Landung: sachlich.';
const driftGuard = ' Drift-Guard.';
const toneHint = '\nDu-Form, nie mit Namen.';
const aptHint = 'Wir stehen am Vorfeld; dort wartet der Abholer.';
const passenger = { role: 'Fotografin', gTolerance: 'niedrig', bankTolerance: 'niedrig' };

const legacyPassengerPrompt = runLegacyFunction(
    ['_weatherContext', '_consumeWeatherMismatchEasteregg', '_farewellPrompt'],
    {
        window: {
            activePassenger: passenger,
            lastLiveFlightData: liveWeather,
            activeMissionContract: null,
            paxVoiceGetPoiMissionProgress: () => null,
            missionCargoEvaluateOutcome: () => ({ status: 'completed', failed: false }),
            missionIsSarHeliMission: () => false
        },
        currentMissionData: { missionFailed: false, cargoOutcome: null },
        _paxWxMismatchDone: false,
        _briefingDestWeather: () => ({ windKts: 5, windDeg: 20, visKm: 20 }),
        _baseContext: () => baseContext,
        _paxDebugMotionProtectionEnabled: () => false,
        _professionalLandingToneHint: () => professionalHint,
        _activeAptTrainingPlan: () => null,
        _trainingEvalSummary: () => null,
        _trainingProcedureDebriefLine: () => '',
        _isPOIMission: () => false,
        _aptArrivalFarewellHint: () => aptHint,
        _bushPickupNarrativeHint: () => '',
        _bushReconOutcomeHintLine: () => '',
        _followUpDeboardingHintLine: () => followUpHint,
        _activeTaskDomain: () => 'charter',
        _domainDriftGuard: () => driftGuard,
        _sarHeliHospitalName: () => '',
        _toneHint: () => toneHint,
        _poiAborted: false
    },
    `_farewellPrompt(${JSON.stringify(passengerRecord)})`
);
const passengerContext = farewellVoiceCore.createContext({
    missionId: 'mission-differential',
    missionAudioKey: 'farewell:mission-differential',
    key: 'farewell:mission-differential',
    mode: 'passenger',
    baseContext,
    taskDomain: 'charter',
    speaker: { name: 'Mara', role: 'Fotografin', gender: 'female' },
    passenger,
    aptFarewellHint: aptHint,
    professionalLandingHint: professionalHint,
    followUpDeboardingHint: followUpHint,
    farewellDriftGuard: driftGuard,
    toneHint,
    briefingWeather: { windKts: 5, windDeg: 20, visKm: 20 },
    playCue: true,
    cueId: 'deboarding_pax'
});
assert.equal(
    farewellVoiceCore.createRecipeFromContext(passengerContext, { record: passengerRecord, liveWeather }).prompt,
    legacyPassengerPrompt,
    'standard APT passenger prompt drift'
);

const failureRecord = {
    missionFailed: true,
    missionCargoOutcome: { status: 'failed', failed: true, damagedRequired: ['Kamera'] }
};
const legacyFailureText = runLegacyFunction(
    ['_failedMissionFarewellFallback'],
    {
        window: { activePassenger: passenger, paxVoiceGetPoiMissionProgress: () => null },
        _activeMissionStoryFrame: () => ({ focusSubject: 'die Fotodokumentation' })
    },
    `_failedMissionFarewellFallback(${JSON.stringify(failureRecord)})`
);
const failedContext = farewellVoiceCore.createContext({
    ...passengerContext,
    storyFocusSubject: 'die Fotodokumentation'
});
assert.equal(
    farewellVoiceCore.createRecipeFromContext(failedContext, { record: failureRecord }).text,
    legacyFailureText,
    'standard APT failure fallback drift'
);

const cargoRecord = {
    durationSec: 1200,
    distanceNm: 40.04,
    missionCargoOutcome: { status: 'completed', failed: false }
};
const cargoData = {
    start: 'EDTW',
    dest: 'EDTL',
    dist: '42',
    paxText: '0 PAX',
    cargoText: 'Ersatzteile',
    story: 'Ersatzteilflug zur Werft.',
    contractSummary: 'Pumpe zur Werft bringen.',
    taskDomain: 'cargo_fragile'
};
const legacyCargoPrompt = runLegacyFunction(
    ['_cargoOnlyFarewellPrompt'],
    {
        window: { missionCargoEvaluateOutcome: () => ({ status: 'completed', failed: false }) },
        _cargoOnlyVoiceContext: () => cargoData,
        _activeAptArrivalPlan: () => ({ expectedBy: 'Werkstattmeister' }),
        _aptArrivalCue: () => 'der Werkstattwagen',
        _aptArrivalLocationLabel: () => 'bei den Hangars',
        _missionRequiredItemNames: () => ['Hydraulikpumpe'],
        _followUpDeboardingHintLine: () => followUpHint,
        _bushCargoPickupNarrativeHint: () => ' NARRATIV-HINWEIS.',
        _toneHint: () => toneHint
    },
    `_cargoOnlyFarewellPrompt(${JSON.stringify(cargoRecord)})`
);
const cargoContext = farewellVoiceCore.createContext({
    missionId: 'mission-cargo-differential',
    missionAudioKey: 'farewell:mission-cargo-differential',
    key: 'farewell-cargo:mission-cargo-differential',
    mode: 'cargo',
    taskDomain: 'general',
    speaker: { name: 'Werkstattmeister', role: 'Werkstattmeister', gender: 'male' },
    followUpDeboardingHint: followUpHint,
    toneHint,
    cargo: {
        receiver: 'Werkstattmeister',
        ...cargoData,
        arrivalCue: 'der Werkstattwagen',
        arrivalLocation: 'bei den Hangars',
        cargoName: 'Hydraulikpumpe',
        narrativeHint: ' NARRATIV-HINWEIS.'
    }
});
assert.equal(
    farewellVoiceCore.createRecipeFromContext(cargoContext, { record: cargoRecord }).prompt,
    legacyCargoPrompt,
    'standard APT cargo prompt drift'
);

function runActualAppAuthorityRecipe({ cargoOnly, missionId, record, weather }) {
    const windowObject = {
        GAMissionFarewellVoiceCore: farewellVoiceCore,
        activePassenger: cargoOnly ? null : passenger,
        lastLiveFlightData: weather,
        activeMissionContract: null,
        missionIsSarHeliMission: () => false
    };
    const context = {
        window: windowObject,
        currentMissionData: {
            missionId,
            missionKey: missionId,
            start: 'EDTW',
            dest: 'EDTL',
            missionFailed: false
        },
        currentStartICAO: 'EDTW',
        currentDestICAO: 'EDTL',
        _paxWxMismatchDone: false,
        _paxVoiceEnabled: true,
        _paxAudioEffectsEnabled: true,
        _paxTtsModelPref: 'auto',
        _missionHasPax: () => !cargoOnly,
        _activeAptTrainingPlan: () => null,
        _isPOIMission: () => false,
        _isBushVoiceMission: () => false,
        _paxAiTextModels: provider => provider === 'openai' ? [['gpt-5.4']] : [['gemini-3-flash-preview']],
        _activeMissionStoryFrame: () => ({ focusSubject: 'die Fotodokumentation' }),
        _paxMissionAudioKey: kind => `${kind}:${missionId}`,
        _activeTaskDomain: () => cargoOnly ? 'general' : 'charter',
        _paxTtsHedgeEnabled: () => true,
        _paxTtsHedgeDelayMs: () => 3000,
        _paxDebugMotionProtectionEnabled: () => false,
        _followUpDeboardingHintLine: () => followUpHint,
        _toneHint: () => toneHint,
        _briefingDestWeather: () => ({ windKts: 5, windDeg: 20, visKm: 20 }),
        _baseContext: () => baseContext,
        _paxMissionAudioCueId: () => 'deboarding_pax',
        _speakerSnapshotForActivePax: () => ({ name: 'Mara', role: 'Fotografin', gender: 'female', taskDomain: 'charter' }),
        _speakerSnapshotForMissionVoice: () => ({ name: 'Mara', role: 'Fotografin', gender: 'female' }),
        _aptArrivalFarewellHint: () => aptHint,
        _professionalLandingToneHint: () => professionalHint,
        _domainDriftGuard: () => driftGuard,
        _missionCargoEvaluateFarewellOutcome: () => record.missionCargoOutcome || null,
        _cargoOnlyVoiceContext: () => cargoData,
        _activeAptArrivalPlan: () => ({ expectedBy: 'Werkstattmeister' }),
        _missionRequiredItemNames: () => ['Hydraulikpumpe'],
        _cargoMissionSpeaker: () => ({ name: 'Werkstattmeister', role: 'Werkstattmeister', gender: 'male' }),
        _aptArrivalLocationLabel: () => 'bei den Hangars',
        _aptArrivalCue: () => 'der Werkstattwagen',
        _bushCargoPickupNarrativeHint: () => ' NARRATIV-HINWEIS.',
        Math,
        Number,
        String,
        JSON,
        Object,
        Array
    };
    windowObject.window = windowObject;
    vm.runInNewContext([
        blockSource('function _farewellAuthorityContext('),
        blockSource('window.paxVoiceBuildFarewellAuthorityContext = function('),
        blockSource('window.paxVoiceBuildFarewellEffectRecipe = function(')
    ].join('\n\n'), context, { filename: 'passenger-voice.js#farewell-authority-context-differential' });
    return {
        authorityContext: context.window.paxVoiceBuildFarewellAuthorityContext(),
        recipe: context.window.paxVoiceBuildFarewellEffectRecipe(record),
        mismatchConsumed: context._paxWxMismatchDone
    };
}

const actualPassengerAuthority = runActualAppAuthorityRecipe({
    cargoOnly: false,
    missionId: 'mission-differential',
    record: passengerRecord,
    weather: liveWeather
});
assert.equal(actualPassengerAuthority.authorityContext.supported, true);
assert.equal(actualPassengerAuthority.authorityContext.baseContext, baseContext);
assert.equal(actualPassengerAuthority.recipe.prompt, legacyPassengerPrompt, 'actual App passenger authority wrapper drift');
assert.equal(actualPassengerAuthority.mismatchConsumed, true, 'actual App wrapper must consume the weather Easter egg at close');

const actualCargoAuthority = runActualAppAuthorityRecipe({
    cargoOnly: true,
    missionId: 'mission-cargo-differential',
    record: cargoRecord,
    weather: liveWeather
});
assert.equal(actualCargoAuthority.authorityContext.supported, true);
assert.equal(actualCargoAuthority.authorityContext.mode, 'cargo');
assert.equal(actualCargoAuthority.recipe.prompt, legacyCargoPrompt, 'actual App cargo authority wrapper drift');

console.log('mission farewell voice/app differential selftest: ok');
