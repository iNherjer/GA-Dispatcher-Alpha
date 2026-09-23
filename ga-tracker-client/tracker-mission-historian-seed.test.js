'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const voice = require('../mission-poi-voice-core');
const poi = require('./tracker-mission-poi-runtime');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing original function ${name}`);
  let end = source.indexOf('\n}', start);
  while (end >= 0) {
    const candidate = source.slice(start, end + 2);
    try { new vm.Script(candidate); return candidate; }
    catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      end = source.indexOf('\n}', end + 2);
    }
  }
  throw new Error(`unterminated original function ${name}`);
}

function createBuilderHarness(taskDomain = 'historian_guided_tour') {
  const source = fs.readFileSync(path.join(__dirname, '../passenger-voice.js'), 'utf8');
  const assignment = 'window.paxVoiceBuildPoiAuthorityContext = function(missionId)';
  const start = source.indexOf(assignment);
  assert.notEqual(start, -1, 'missing original POI authority context builder');
  const end = source.indexOf('\n};', start) + 3;
  const builder = source.slice(start, end).replace('window.paxVoiceBuildPoiAuthorityContext = function', 'function paxVoiceBuildPoiAuthorityContext');

  const passenger = { name: 'Mara', role: 'Historikerin', taskDomain,
    targetRadiusNm: 1.5, targetAltFt: 3000, targetDwellMin: 4 };
  const missionData = { missionType: 'poi', poiName: 'Alte Burg', mission: 'Historische Ortsführung' };
  const targetFacts = ['Die Burg kontrollierte einst den alten Handelsweg durch das Tal.'];
  const visualLandmarks = [{ kind: 'railway', name: 'Alte Bahntrasse', distM: 240, relFromTarget: 'östlich' }];
  const policy = { mode: 'observer', maxDistM: 500, prefix: '4-NM-ORIENTIERUNG', instruction: 'Nur beobachtend.' };
  const sandbox = {
    window: { GAMissionPoiVoiceCore: voice, activePassenger: passenger,
      GLOBAL_CITIES_DATA: [], activeMissionContract: null,
      missionIsSarHeliMission: () => false },
    currentMissionData: missionData,
    document: { getElementById: id => id === 'wikiDestDescText' ? { innerText: 'Die Burg entstand im Mittelalter.' } : null },
    _activeTaskDomain: () => taskDomain,
    _isPOIMission: () => true,
    _missionHasPax: () => true,
    _activeAptTrainingPlan: () => null,
    _activeBushReconOutcome: () => null,
    _paxCityDatasetAvailable: () => true,
    _baseContext: () => 'Historische Ortsführung am Ziel.',
    _toneHint: () => ' Deutsch.',
    _paxStrictMode: true,
    _paxApproachLandmarkPolicy: () => policy,
    _paxMapPlaceOrientationLine: () => '',
    _paxTargetGeoContext: () => ({ anchors: {} }),
    _paxConfirmedVisualLandmarks: maxDistM => visualLandmarks.filter(lm => lm.distM <= maxDistM),
    _inspectionMissionMeta: null,
    _activeInfraInspectionOutcome: () => null,
    _professionalRoleMeta: () => null,
    _targetContextFactCandidates: () => targetFacts,
    _paxDebugMotionProtectionEnabled: () => false,
    _followUpDeboardingHintLine: () => '',
    _activeMissionStoryFrame: () => ({ focusSubject: 'Alte Burg' }),
    _briefingDestWeather: () => null,
    _paxMissionAudioKey: () => 'farewell:historian-test',
    _paxWxMismatchDone: false,
    _paxWrongStartActive: false,
    _paxAudioEffectsEnabled: false,
    _paxMissionAudioCueId: (_scope, _kind, fallback) => fallback,
    _speakerSnapshotForActivePax: () => ({ name: passenger.name, role: passenger.role, taskDomain }),
    _paxVoiceEnabled: false,
    _paxAiTextModels: () => [],
    _paxTtsModelPref: 'auto',
    _paxTtsHedgeEnabled: () => false,
    _paxTtsHedgeDelayMs: () => 0,
    routeWaypoints: []
  };
  vm.createContext(sandbox);
  sandbox._getMissionStory = () => 'Historische Einordnung des Orts.';
  vm.runInContext(extractFunction(source, '_inspectionMissionMeta'), sandbox);
  vm.runInContext(builder, sandbox);
  return { sandbox, passenger, targetFacts, visualLandmarks, policy, missionData };
}

test('original POI voice context builder seeds historian facts and observer landmarks without guide-only knowledge/actions', () => {
  const { sandbox, passenger, targetFacts, visualLandmarks, policy } = createBuilderHarness();
  const context = sandbox.paxVoiceBuildPoiAuthorityContext('historian-mission');

  assert.ok(context, 'historian should receive an authoritative POI voice context');
  assert.equal(voice.validateContext(context, 'historian-mission'), null);
  assert.equal(poi.validateRecipe({ schema: poi.RECIPE_SCHEMA, version: 1, missionId: 'historian-mission',
    taskDomain: context.taskDomain, target: { lat: 48.3, lon: 8.5 }, home: { lat: 48, lon: 8 },
    passenger, strict: true, trackingActive: true, voiceContext: context }), null);
  assert.equal(context.taskDomain, 'historian_guided_tour');
  assert.equal(context.inspectionMeta, null, 'historian role must not be misclassified as an inspection');
  assert.deepEqual(JSON.parse(JSON.stringify(context.targetFacts)), targetFacts);
  assert.equal(context.wikiText, 'Die Burg entstand im Mittelalter.');
  assert.deepEqual(JSON.parse(JSON.stringify(context.landmarkPolicy)), policy);
  assert.deepEqual(JSON.parse(JSON.stringify(context.visualLandmarks)), visualLandmarks);

  assert.equal(Object.hasOwn(context, 'knowledgeContext'), false, 'historian must not inherit the guide/sightseeing fact queue');
  assert.equal(voice.knowledgeAvailable(context, {}, true), false);
  assert.throws(() => voice.renderAction(context, 'poi_tell_more', {}, {}, null), /poi_knowledge_not_available/);
});

test('original POI voice context builder still rejects domains outside the migrated family', () => {
  const { sandbox } = createBuilderHarness('private_outing');
  assert.equal(sandbox.paxVoiceBuildPoiAuthorityContext('unsupported-mission'), null);
});
