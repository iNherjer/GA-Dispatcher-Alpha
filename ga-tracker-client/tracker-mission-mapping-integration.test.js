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

for (const type of ['north_south_scan', 'orbit']) test(`Mapping ${type} completes through POI runtime with Slew after persisted suspension`, () => {
  const spec = survey.normalizeSpec({ taskDomain: 'mapping_survey', type, center: { lat: 48, lon: 8 }, targetAltFt: 3000,
    scan: { lineCount: 1, lineLengthNm: .8, bins: 24, minCoverage: .7 },
    orbit: { radiusNm: .45, requiredTurns: 1, sectorsPerTurn: 36, minTurnCoverage: .8, minTurnSec: 0 } });
  const passenger = { targetRadiusNm: 1, targetAltFt: 3000, targetDwellMin: 0 };
  const recipe = { schema: poi.RECIPE_SCHEMA, version: 1, missionId: 'mapping-slew', taskDomain: 'mapping_survey',
    target: spec.center, home: { lat: 49, lon: 9 }, passenger, strict: true, trackingActive: true, surveyPattern: spec,
    voiceContext: { schema: voice.CONTEXT_SCHEMA, version: 1, missionId: 'mapping-slew', taskDomain: 'mapping_survey',
      strict: true, baseContext: 'Messauftrag', passenger, speaker: {}, surveySpec: spec, audioEnabled: false } };
  assert.equal(poi.validateRecipe(recipe), null);
  const facts = { active: true, trackingActive: true };
  let state = poi.observe(recipe, null, { observedAt: 1000, simPaused: true }, facts).state;
  assert.equal(state.suspendedAt, 1000);
  state = JSON.parse(JSON.stringify(state));
  const count = type === 'orbit' ? 180 : 24;
  for (let i = 0; i <= count; i++) {
    const pos = type === 'orbit' ? survey.destinationPoint(48, 8, spec.orbit.radiusNm, i * 2 % 360)
      : survey.interpolateLine(spec.scan.lines[0], i / count);
    const out = poi.observe(recipe, state, { ...pos, observedAt: 10000 + i * 500, altFt: 3000, gsKts: 95,
      headingDeg: type === 'orbit' ? (i * 2 + 90) % 360 : 180, onGround: false,
      slewActive: true, slewMode: true, isSlewActive: true, slewTelemetryStatus: 'error' }, facts);
    assert.equal(out.state.suspendedAt, null);
    assert.notEqual(out.reason, 'poi_task_suspended');
    state = out.state;
  }
  assert.equal(state.surveyState.progress.satisfied, true);
  assert.equal(poi.project(state).satisfied, true);
});
