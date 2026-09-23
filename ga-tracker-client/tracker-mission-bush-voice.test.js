'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const farewellCore = require('../mission-farewell-voice-core.js');
const bushExecutionCore = require('../mission-bush-execution-core.js');
const boardingCore = require('../mission-boarding-voice-core.js');

const source = fs.readFileSync(path.join(__dirname, '..', 'passenger-voice.js'), 'utf8');

function extractBetween(start, end) {
  const startAt = source.indexOf(start);
  const endAt = source.indexOf(end, startAt);
  assert.notEqual(startAt, -1, `missing source anchor: ${start}`);
  assert.notEqual(endAt, -1, `missing source anchor: ${end}`);
  return source.slice(startAt, endAt);
}

const authorityFunctions = [
  extractBetween('function _activeBushPickupVoiceSpec()', '// Private tracker-only recipe.'),
  extractBetween('function _activeBushStripTargetVoiceSpec()', 'function _farewellAuthorityContext()'),
  extractBetween('function _farewellAuthorityContext()', '// Private tracker recipe context only; standalone triggers and prompt stay unchanged.'),
  extractBetween('window.paxVoiceBuildApproachAuthorityContext = function()', 'window.paxVoiceBuildFarewellAuthorityContext = function()')
].join('\n');

const completionByProfile = {
  bush_supply_strip: 'unload_at_target',
  bush_charter_strip: 'passenger_dropoff',
  bush_scenic_hopper: 'land_at_target'
};

async function originalFunctions(...names) {
  const { extractOriginalFunction } = await import('../tools/extract-original-function.mjs');
  return names.map(name => extractOriginalFunction(source, name)).join('\n');
}

function makeContext(profileId, overrides = {}, { cargoOnly = false } = {}) {
  const bush = {
    profileId,
    targetMode: 'strip',
    completionMode: completionByProfile[profileId],
    requiresReturnHome: false,
    allowedEndLocations: ['target'],
    targetRef: { lat: 47, lon: 11, name: 'Kiesplatz' },
    homeRef: { lat: 48, lon: 11, name: 'Basis' },
    ...overrides
  };
  const missionContract = { mode: 'BUSH', bush, taskDomain: profileId === 'bush_scenic_hopper' ? 'bush_adventure' : 'charter' };
  const baseContext = `ROLLE: Bush-Gast\n${profileId}\nBUSH-TON: ORIGINAL ${profileId}`;
  const toneHint = `\nORIGINAL TONE HINT ${profileId}`;
  const md = {
    missionId: `mission-${profileId}`,
    missionType: 'bush',
    missionContract,
    bush,
    start: 'HOME',
    dest: 'STRIP'
  };
  const cargoCtx = {
    start: 'STRIP', dest: 'HOME', dist: '24', paxText: '0 PAX', cargoText: 'Medical radio kits',
    story: 'Return supplies to the base.', contractSummary: 'Bush supply run', taskDomain: missionContract.taskDomain,
    bush, md, contract: missionContract
  };
  const window = {
    activePassenger: cargoOnly ? null : { name: 'Ava', role: 'Gast', taskDomain: missionContract.taskDomain },
    lastLiveFlightData: null,
    activeMissionContract: missionContract,
    GAMissionBushExecutionCore: bushExecutionCore,
    GAMissionFarewellVoiceCore: { createContext: value => farewellCore.createContext(value) },
    missionIsSarHeliMission: () => false,
    GAMissionBoardingVoiceCore: boardingCore
  };
  const context = {
    window,
    currentMissionData: md,
    _activeMissionContractData: () => missionContract,
    _activeAptTrainingPlan: () => null,
    _isPOIMission: () => false,
    _isBushVoiceMission: () => true,
    _missionHasPax: () => !cargoOnly,
    _activeTaskDomain: () => missionContract.taskDomain,
    _paxMissionAudioKey: name => `${name}:${md.missionId}`,
    _paxVoiceEnabled: true,
    _paxWrongStartActive: false,
    _paxAiTextModels: () => ['gemini-3-flash-preview'],
    _paxTtsModelPref: 'default',
    _paxTtsHedgeEnabled: () => true,
    _paxTtsHedgeDelayMs: () => 3000,
    _paxDebugMotionProtectionEnabled: () => false,
    _followUpDeboardingHintLine: () => '',
    _toneHint: () => toneHint,
    _activeMissionStoryFrame: () => ({ focusSubject: 'den Bush-Strip' }),
    _privateReturnVoiceContext: () => null,
    _aptArrivalAfterLandingHint: () => '',
    _aptArrivalApproachHint: () => '',
    _hasAptArrivalRuntimePoint: () => false,
    _inspectionMissionMeta: () => null,
    _professionalTaskHint: () => '',
    _bushPickupNarrativeHint: () => '',
    _bushReconOutcomeHintLine: () => '',
    _paxWxMismatchDone: false,
    _briefingDestWeather: () => null,
    _paxAudioEffectsEnabled: false,
    _missionCargoEvaluateFarewellOutcome: () => null,
    _missionCargoEvaluateOutcome: () => null,
    _cargoOnlyVoiceContext: () => cargoOnly ? cargoCtx : null,
    _activeAptArrivalPlan: () => ({ expectedBy: 'Supply crew', roleLabel: 'Supply crew' }),
    _missionRequiredItemNames: () => [],
    _cargoMissionSpeaker: () => ({ name: 'Supply crew', role: 'Supply crew', gender: 'female', taskDomain: missionContract.taskDomain }),
    _aptArrivalCue: () => 'the ground crew',
    _aptArrivalLocationLabel: () => 'at the marked stand',
    _bushCargoPickupNarrativeHint: () => '',
    _weatherContext: () => '',
    _consumeWeatherMismatchEasteregg: () => '',
    _activeCargoText: () => 'Medical radio kits',
    _comfortFeedbackPolicy: () => ({ proactiveAny: false }),
    _normUrgencyPriority: () => 'normal',
    _normLevel3: () => 'mittel',
    _activeMissionData: () => md,
    _isBushAdventureMission: () => profileId === 'bush_scenic_hopper',
    _stripManifestWeightForSpeech: value => value,
    _boardingEquipmentContextLine: () => 'EQUIPMENT: Ausrüstung sitzt sicher.',
    _trainingProcedureScheduleText: () => '',
    _personaNarrativeSeedAllowed: () => false,
    _speakerSnapshotForMissionVoice: () => ({ name: 'Ava', role: 'Gast', taskDomain: missionContract.taskDomain }),
    _paxMissionAudioCueId: () => 'none',
    _buildBoardingText: () => 'ORIGINAL BOARDING FALLBACK',
    _poiAborted: false,
    localStorage: { getItem: () => null },
    _baseContext: () => baseContext,
    _speakerSnapshotForActivePax: () => ({ name: 'Ava', role: 'Gast', taskDomain: missionContract.taskDomain }),
    _aptArrivalFarewellHint: () => 'Wir sind am Strip gelandet.',
    _professionalLandingToneHint: () => '',
    _domainDriftGuard: () => ''
  };
  vm.createContext(context);
  vm.runInContext(authorityFunctions, context);
  return { context, baseContext, toneHint, bush, md, missionContract, cargoCtx };
}

const flightRecord = {
  durationSec: 900, distanceNm: 24.2, maxAltFt: 6200,
  maxBankDeg: 12, maxGForce: 1, maxDescentFpm: -900, touchdownVsFpm: 120
};

for (const profileId of Object.keys(completionByProfile)) {
  test(`${profileId} strip-target tracker farewell matches the original App prompt`, async () => {
    const fixture = makeContext(profileId);
    vm.runInContext(await originalFunctions('_farewellPreparedContext', '_farewellPrompt', '_cargoOnlyFarewellPrompt'), fixture.context);
    const authority = vm.runInContext('_farewellAuthorityContext()', fixture.context);
    assert.equal(authority.supported, true);
    assert.equal(authority.scope, 'apt_standard');
    assert.equal(authority.baseContext, fixture.baseContext);
    assert.equal(authority.toneHint, fixture.toneHint);
    assert.equal(authority.taskDomain, fixture.missionContract.taskDomain);

    const approach = vm.runInContext('window.paxVoiceBuildApproachAuthorityContext()', fixture.context);
    assert.equal(approach.baseContext, fixture.baseContext);
    assert.equal(approach.toneHint, fixture.toneHint);
    assert.equal(approach.bushContinuityHint, '');

    const original = vm.runInContext(`_farewellPreparedContext(${JSON.stringify(flightRecord)})`, fixture.context);
    const prepared = farewellCore.buildPreparedContext(authority, { record: flightRecord, liveWeather: {} });
    assert.equal(prepared.prompt, original.prompt);
  });
}

test('Bush supply cargo-only tracker farewell matches the original App prompt', async () => {
  const fixture = makeContext('bush_supply_strip', {}, { cargoOnly: true });
  vm.runInContext(await originalFunctions('_farewellPreparedContext', '_cargoOnlyFarewellPrompt'), fixture.context);
  const authority = vm.runInContext('_farewellAuthorityContext()', fixture.context);
  assert.equal(authority.supported, true);
  assert.equal(authority.mode, 'cargo');
  const original = vm.runInContext(`_farewellPreparedContext(${JSON.stringify(flightRecord)})`, fixture.context);
  const prepared = farewellCore.buildPreparedContext(authority, { record: flightRecord, liveWeather: {} });
  assert.equal(prepared.prompt, original.prompt);
});

test('scenic boarding recipe carries the original Bush adventure guidance', async () => {
  const fixture = makeContext('bush_scenic_hopper');
  const boardingRecipeSource = extractBetween(
    'window.paxVoiceBuildBoardingEffectRecipe = function()',
    'window.paxVoicePrepareBoarding = function()'
  );
  vm.runInContext(await originalFunctions('_greetingMissionGuidance', '_boardingBriefingPrompt'), fixture.context);
  vm.runInContext(boardingRecipeSource, fixture.context);
  const guidance = vm.runInContext('_greetingMissionGuidance()', fixture.context);
  assert.equal(guidance.reqLine, 'Sag kurz und persoenlich, warum du genau zu diesem Strip willst, was dort auf dich wartet oder warum du dort Zeit verbringen wirst. Nenne einen konkreten Bodenplan mit Wildnisbezug, z.B. Camp, Trail, Lodge, Flussabschnitt, Fotozeit oder ruhigen Beobachtungspunkt. Sprich freundlich als Gast, ohne Navigations-, Hoehen- oder Arbeitsvorgaben an den Piloten. Maximal ein kurzer Komforthinweis, sonst klare Vorfreude mit echtem Hintergrund.');
  const originalPrompt = vm.runInContext('_boardingBriefingPrompt()', fixture.context);
  assert.ok(originalPrompt.includes(guidance.reqLine));
  const recipe = vm.runInContext('window.paxVoiceBuildBoardingEffectRecipe()', fixture.context);
  assert.equal(recipe.prompt, originalPrompt);
  assert.equal(recipe.fallbackText, 'ORIGINAL BOARDING FALLBACK');
});

test('Incomplete pickup, recon, changed completion, and SAR-Heli remain outside the APT farewell context gate', () => {
  for (const bush of [
    { profileId: 'bush_pickup_strip', targetMode: 'strip_then_return', completionMode: 'return_home', requiresReturnHome: true, pickupKind: 'passenger' },
    { profileId: 'bush_recon_return', targetMode: 'area_then_return', completionMode: 'return_home', requiresReturnHome: true },
    { profileId: 'bush_supply_strip', targetMode: 'strip', completionMode: 'return_home', requiresReturnHome: false },
    { profileId: 'bush_scenic_hopper', targetMode: 'strip', completionMode: 'land_at_target', requiresReturnHome: false, pickupKind: 'cargo' }
  ]) {
    const fixture = makeContext(bush.profileId, bush);
    const authority = vm.runInContext('_farewellAuthorityContext()', fixture.context);
    assert.equal(authority.supported, false, bush.profileId);
    assert.equal(authority.unsupportedReason, 'farewell_context_bush_not_migrated', bush.profileId);
  }

  const heli = makeContext('bush_scenic_hopper');
  heli.context.currentMissionData.missionType = 'sar_heli';
  heli.context.window.missionIsSarHeliMission = () => true;
  heli.context._isBushVoiceMission = () => false;
  const heliAuthority = vm.runInContext('_farewellAuthorityContext()', heli.context);
  assert.equal(heliAuthority.supported, false);
  assert.equal(heliAuthority.unsupportedReason, 'farewell_context_sar_heli_not_migrated');
});
