'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const core = require('../mission-bush-pickup-scene-core.js');
const { buildFrozenLegacyCommand } = require('../tools/fixtures/bush-pickup-scene-legacy-20260923.js');

test('generated bush pickup boarding command matches the frozen original command and geometry', () => {
  const samples = [
    {
      recipe: {
        sceneId: 'arrival-scene-42',
        personPoint: { worldLat: 48.17391, worldLon: 11.58412 },
        boardingConfig: { spawn: { forwardM: 16, rightM: -8, altOffsetFt: 0 }, target: { forwardM: 4.5, rightM: 8.5, altOffsetFt: 0 } },
        commonFields: { profile: 'app_preset', aircraftSlot: 'PA-24', vehicleArrival: true }
      },
      position: { lat: 48.1735, lon: 11.5836, alt: 1320.4, hdg: 71 }
    },
    {
      recipe: {
        sceneId: 'zero-coordinates', personPoint: { worldLat: 0, worldLon: 0 },
        boardingConfig: null, reason: 'custom-reason', commonFields: { profile: 'original-common-fields' }
      },
      position: { lat: 0, lon: 0, alt: null, hdg: 0 }
    }
  ];
  for (const sample of samples) assert.deepEqual(core.buildCommand(sample.recipe, sample.position), buildFrozenLegacyCommand(sample.recipe, sample.position));
});

test('returns null when original geometry prerequisites are missing or invalid', () => {
  const recipe = { sceneId: 's', personPoint: { worldLat: 1, worldLon: 2 } };
  for (const position of [
    {}, { lat: 1 }, { lat: NaN, lon: 2, hdg: 0 }, { lat: 1, lon: 2, hdg: Infinity },
    { lat: 1, lon: 2, hdg: 0, alt: 'bad' }
  ]) {
    const expected = buildFrozenLegacyCommand(recipe, position);
    assert.deepEqual(core.buildCommand(recipe, position), expected);
  }
  assert.equal(core.buildCommand({ ...recipe, sceneId: '' }, { lat: 1, lon: 2, hdg: 0 }), null);
  assert.equal(core.buildCommand({ sceneId: 's' }, { lat: 1, lon: 2, hdg: 0 }), null);
});

test('generator check detects drift from the original App boarding function', () => {
  execFileSync(process.execPath, ['tools/generate-bush-pickup-scene-core.mjs', '--check'], {
    cwd: path.join(__dirname, '..')
  });
});
