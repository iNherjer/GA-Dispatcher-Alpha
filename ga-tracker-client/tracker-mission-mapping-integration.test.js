'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const survey = require('../mission-survey-core');
const poi = require('./tracker-mission-poi-runtime');
const voice = require('../mission-poi-voice-core');
function read(name) { return fs.readFileSync(path.join(__dirname, '..', name), 'utf8'); }
function extract(source, name) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\nfunction ', start + 1);
  const block = source.slice(start, end < 0 ? undefined : end);
  return block.slice(0, block.lastIndexOf('\n}') + 2);
}

test('App seeds Mapping using its normalized original pattern and rejects unmigrated compositions', () => {
  const spec = survey.normalizeSpec({ taskDomain: 'mapping_survey', type: 'orbit', center: { lat: 48, lon: 8 }, targetAltFt: 3000 });
  const passenger = { targetRadiusNm: .55, targetAltFt: 3000, targetDwellMin: 5 };
  const context = { schema: voice.CONTEXT_SCHEMA, version: 1, missionId: 'mapping', taskDomain: 'mapping_survey',
    strict: true, baseContext: 'Survey am Ziel', passenger, speaker: {}, surveySpec: spec, audioEnabled: false };
  const sandbox = { currentMissionData: { surveyPattern: spec }, window: { activePassenger: { ...passenger, surveyPattern: spec },
    missionSurveyPattern: { getActiveSpec: () => spec }, paxVoiceBuildPoiAuthorityContext: () => context,
    paxVoiceGetPoiMissionProgress: () => ({ trackingActive: true }) },
    _activeMissionRuntimeId: () => 'mapping', _targetPointForMission: () => spec.center, _missionHomePointForRuntime: () => ({ lat: 49, lon: 9 }),
    _buildMissionAptExecutionEffectPlan: recipe => { assert.equal(recipe, 'poi'); return { effects: {} }; },
    _missionTargetSceneKind: () => '', _missionTargetSceneItems: () => [] };
  vm.createContext(sandbox);
  vm.runInContext(extract(read('sync.js'), '_buildMissionPoiExecutionSeed'), sandbox);
  const seed = JSON.parse(JSON.stringify(sandbox._buildMissionPoiExecutionSeed()));
  assert.deepEqual(seed.executionPoiRecipe.surveyPattern, spec);
  assert.equal(poi.validateRecipe(seed.executionPoiRecipe), null);
  for (const field of ['poiChain', 'trainingProcedure', 'bush', 'sarHeli']) {
    sandbox.currentMissionData[field] = {};
    assert.equal(sandbox._buildMissionPoiExecutionSeed(), null, field);
    delete sandbox.currentMissionData[field];
  }
  context.taskDomain = 'media_photo';
  assert.equal(sandbox._buildMissionPoiExecutionSeed(), null);
});

test('App PAX Survey snapshot is the authority projection, standalone still uses local detector', () => {
  let localReads = 0;
  const local = { satisfied: false }, projected = { satisfied: true, scan: { completedLineIds: ['L1'] } };
  const sandbox = { window: { missionSurveyPattern: { snapshot: () => { localReads++; return local; } },
    gaTrackerExecutionControl: { executionAuthority: 'tracker', surveySpec: {}, poiTask: { surveyPattern: projected } } } };
  vm.createContext(sandbox);
  vm.runInContext(extract(read('passenger-voice.js'), '_surveyPatternSnapshot'), sandbox);
  assert.equal(sandbox._surveyPatternSnapshot(), projected);
  assert.equal(localReads, 0);
  sandbox.window.gaTrackerExecutionControl = null;
  assert.equal(sandbox._surveyPatternSnapshot(), local);
  assert.equal(localReads, 1);
});

test('Survey authority overlay draws completed lines without ticking the local detector', () => {
  const layers = [], group = { addTo() { return this; }, clearLayers() { layers.length = 0; } };
  const sandbox = { console, module: { exports: {} }, window: {}, L: {
    layerGroup: () => group,
    polyline: (points, options) => ({ addTo() { layers.push({ points, options }); return this; }, bindTooltip() { return this; } }),
    circle: (point, options) => ({ addTo() { layers.push({ point, options }); return this; }, bindTooltip() { return this; } }),
    divIcon: options => options, marker: () => ({ addTo() { return this; } }),
    circleMarker: () => ({ addTo() { return this; }, bindTooltip() { return this; } })
  }, map: { hasLayer: () => false, removeLayer() {} } };
  sandbox.window.L = sandbox.L;
  vm.createContext(sandbox); vm.runInContext(read('mission-survey-pattern.js'), sandbox);
  const api = sandbox.module.exports;
  const spec = survey.normalizeSpec({ taskDomain: 'mapping_survey', type: 'north_south_scan', center: { lat: 48, lon: 8 }, targetAltFt: 3000 });
  const state = survey.createInitialState(spec); state.scan.completedLineIds.add(spec.scan.lines[0].id);
  const progress = survey.snapshotState(state);
  const before = api.snapshot();
  api.renderAuthorityProjection(spec, progress);
  assert.deepEqual(api.snapshot(), before);
  assert.ok(layers.some(layer => layer.options.color === '#2fd46f'), 'original Leaflet renderer colors completed line green');
});
