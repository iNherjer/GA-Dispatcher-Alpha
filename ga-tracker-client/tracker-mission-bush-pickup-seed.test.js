'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const bush = require('../mission-bush-execution-core.js');
const pickupVoice = require('../mission-bush-pickup-voice-core.js');
const { bundle } = require('./tracker-mission-bush-return-fixture.js');
const { buildCloudMissionCandidate } = require('./tracker-mission-cloud.js');
const { extractOriginalFunction } = require('../tools/extract-original-function.mjs');

const source = fs.readFileSync(path.join(__dirname, '..', 'sync.js'), 'utf8');
const passengerSource = fs.readFileSync(path.join(__dirname, '..', 'passenger-voice.js'), 'utf8');
const clone = value => value == null ? value : structuredClone(value);

function buildActualAppSeed(kind) {
  const b = bundle(kind === 'cargo' ? 'bush_pickup_cargo' : 'bush_pickup_strip');
  const recipe = clone(b.executionBushRecipe);
  const context = { ...clone(recipe.voiceContext),
    farewellContext: clone(b.executionEffectPlan.effects['voice.farewell'].context),
    farewellRecipe: null,
    approachContext: clone(b.executionEffectPlan.effects['voice.approach'].context) };
  const plan = clone(b.executionEffectPlan);
  // This is the actual pre-pickup plan shape: no outbound passengers are aboard.
  delete plan.effects['scene.deboarding'];
  let calledDeboardCount = null;
  const sandbox = {
    currentMissionData: clone(b.missionState.currentMissionData),
    window: { GAMissionBushExecutionCore: bush, activePassenger: kind === 'passenger' ? clone(b.missionState.currentMissionData.passenger || {name:'Ava Reed',role:'Rangerin'}) : null,
      paxVoiceBuildBushPickupAuthorityContext: id => id === b.missionId ? clone(context) : null },
    _activeMissionRuntimeId: () => b.missionId,
    _activeBushMissionSpec: () => clone(recipe.spec),
    _safeCloneJson: clone,
    _targetPointForMission: () => clone(recipe.location.missionTarget),
    _aptArrivalPointForRuntime: () => clone(recipe.location.arrivalPoint),
    _buildMissionAptExecutionEffectPlan: () => clone(plan),
    _missionAptArrivalSceneId: () => 'pickup-arrival-scene',
    _missionAptArrivalPlan: () => clone(b.missionState.currentMissionData.aptArrivalPlan),
    _missionAptArrivalPersonPoint: () => clone(b.executionBushRecipe.pickupBoarding?.personPoint || {worldLat:47.0007,worldLon:11.0012}),
    _missionSceneBoardingConfig: () => clone(b.executionBushRecipe.pickupBoarding?.boardingConfig || {spawn:{forwardM:16,rightM:-8},target:{forwardM:4.5,rightM:8.5}}),
    _missionSceneCommonSceneCommandFields: () => clone(b.executionBushRecipe.pickupBoarding?.commonFields || {}),
    _missionSceneBuildDeboardingCommand: (reason, position, sceneId, count) => {
      calledDeboardCount = count;
      return {type:'mission_scene_deboarding',sceneId,reason,boarderCount:count,passengerCount:count,
        path:[{forwardM:5,rightM:8},{forwardM:15,rightM:-8}],vehicleDeparture:true,vehicleArrival:true,vehicleReturn:true};
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(extractOriginalFunction(source, '_buildMissionBushExecutionSeed'), sandbox);
  return { b, seed: sandbox._buildMissionBushExecutionSeed(), calledDeboardCount };
}

test('real App pickup-return seed repairs empty outbound deboarding and survives cloud packaging', () => {
  const { b, seed, calledDeboardCount } = buildActualAppSeed('passenger');
  assert.ok(seed, 'the App seed should satisfy the real Bush validator');
  assert.equal(seed.executionBushRecipe.kind, 'pickup_return');
  assert.equal(seed.executionBushRecipe.home.icao, 'EDTW');
  assert.equal(seed.executionBushRecipe.voiceContext.pickupKind, 'passenger');
  assert.equal(calledDeboardCount, 1, 'the return deboarding uses the future pickup passenger, not the empty outbound count');
  assert.equal(seed.executionEffectPlan.effects['scene.deboarding'].command.boarderCount, 1);
  assert.equal(bush.validateBundle({ ...b, ...seed }), null);

  const cloud = buildCloudMissionCandidate({ activeMission: b.missionState, activeMissionTrackerSeed: {
    schema: 'ga.tracker-cloud-mission-seed.v1', version: 1, missionId: b.missionId, adapter: 'bush_pickup',
    executionBushRecipe: seed.executionBushRecipe, executionEffectPlan: seed.executionEffectPlan
  } }, { poiExecutionEnabled: true });
  assert.equal(cloud.status, 'ready', JSON.stringify(cloud));
  assert.equal(cloud.candidate.bundle.executionBushRecipe.home.icao, 'EDTW');
  assert.deepEqual(cloud.candidate.bundle.executionBushRecipe.pickupBoarding.personPoint, b.executionBushRecipe.pickupBoarding.personPoint);
});

test('real App cargo pickup seed uses cargo-only voice and does not require deboarding', () => {
  const { b, seed, calledDeboardCount } = buildActualAppSeed('cargo');
  assert.ok(seed, 'cargo pickup seed validates without a passenger deboarding scene');
  assert.equal(seed.executionBushRecipe.kind, 'pickup_return');
  assert.equal(seed.executionBushRecipe.voiceContext.pickupKind, 'cargo');
  assert.equal(seed.executionBushRecipe.pickupBoarding, null);
  assert.equal(seed.executionEffectPlan.effects['scene.deboarding'].none, true);
  assert.equal(calledDeboardCount, null);
  assert.equal(bush.validateBundle({ ...b, ...seed }), null);
});

test('pickup voice schema remains specific to return pickup profiles', () => {
  const { seed } = buildActualAppSeed('passenger');
  assert.equal(pickupVoice.validateContext(seed.executionBushRecipe.voiceContext, seed.executionBushRecipe.missionId), null);
  const invalid = { ...seed.executionBushRecipe.voiceContext, bush: { ...seed.executionBushRecipe.spec, profileId: 'bush_recon_return' } };
  assert.notEqual(pickupVoice.validateContext(invalid, seed.executionBushRecipe.missionId), null);
});


test('original passenger-voice App authority builder can seed before a pickup passenger is physically active', () => {
  const b = bundle('bush_pickup_strip');
  const md = clone(b.missionState.currentMissionData);
  md.passenger = clone(b.executionBushRecipe.voiceContext.passenger);
  const start = passengerSource.indexOf('window.paxVoiceBuildBushPickupAuthorityContext = function(');
  assert.ok(start >= 0, 'original App builder exists');
  const end = passengerSource.indexOf('\n};', start);
  assert.ok(end > start, 'original App builder is bounded');
  const builderSource = passengerSource.slice(start, end + 3);
  const window = {
    GAMissionBushPickupVoiceCore: pickupVoice,
    activePassenger: null,
    activeMissionContract: clone(md.missionContract),
    missionCargoGetManifestSnapshot: () => clone(b.runtime.cargoManifest),
    paxVoiceBuildFarewellEffectRecipe: () => null,
    paxVoiceBuildApproachAuthorityContext: () => ({ schema:'ga.mission-approach-context.v1', version:1,
      supported:true, missionId:b.missionId, mode:'passenger', audioEnabled:false, baseContext:'Bush return' })
  };
  const context = vm.createContext({ window, currentMissionData:md,
    _activeMissionContractData: () => md.missionContract,
    _missionHasPax: () => !!window.activePassenger,
    _baseContext: () => 'ROLLE: Ava Reed · Bush pickup return',
    _toneHint: () => 'Calm and personal.',
    _weatherContext: () => '',
    _speakerSnapshotForActivePax: () => clone(md.passenger),
    _cargoMissionSpeaker: () => ({name:'Lademeister',role:'Lademeister'}),
    _bushPickupStoryData: () => ({personName:'Ava Reed',role:'Rangerin',homePlace:'EDTW'}),
    _bushPickupStoryAnchorLine: () => 'Ava Reed at the remote strip.',
    _bushPickupBetweenFlightsLine: () => 'Field work since the supply flight.',
    _bushCargoPickupLabel: () => 'Radio relay case',
    _bushCargoPickupFollowUpLine: () => '',
    _cargoOnlyVoiceContext: () => null,
    _farewellAuthorityContext: () => ({supported:true,mode:'passenger',missionId:b.missionId,
      audioEnabled:false,textModels:{},ttsModels:[],ttsHedgeEnabled:false,ttsHedgeDelayMs:3000}),
    _safeCloneJson: clone
  });
  vm.runInContext(extractOriginalFunction(passengerSource, '_activeBushPickupVoiceSpec') + '\n' + builderSource, context);
  const result = window.paxVoiceBuildBushPickupAuthorityContext(b.missionId);
  assert.ok(result, 'original App builder returns a pickup voice authority context');
  assert.equal(result.pickupKind, 'passenger');
  assert.equal(result.bush.profileId, 'bush_pickup_strip');
  assert.equal(pickupVoice.validateContext(result, b.missionId), null);
  assert.equal(window.activePassenger, null, 'temporary pre-pickup passenger context is restored');
});
