'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const log = require('./tracker-ground-composer-log.js');

test('Composer hat gewählt: Status, Quelle, Looks, Packstücke und was die Ladeliste nutzt', () => {
  const state = { currentMissionData: { clubIdea: { schema: 'club-idea.v1', groundVisual: {
    composer: { status: 'ai', source: 'club-idea.v1' }, aiLooks: 1, figureSeed: 'gv-x',
    passengers: [{ id: 'pax1', gender: 'male', look: 'outdoor', ageBand: 'adult', lookSource: 'composer' }],
    cargo: { c1: { pieces: [{ form: 'hardcase', weightLbs: 40 }, { form: 'toolbox', weightLbs: 12 }] } } } } } };
  const manifest = { items: [
    { id: 'mission-passenger', visualPersons: [{ title: 'tw-pod-hiker-f-01' }] },
    { id: 'primary-cargo', visualPieces: [{ title: 'Hardcase A' }, { title: 'Toolbox B' }], cargoVisualSource: 'composer' },
    { id: 'bordbuch', objectTitle: 'Book' }] };
  const [plan, used] = log.summarize(state, manifest);
  assert.match(plan, /^GROUND_COMPOSER status=ai source=club-idea\.v1 idea=clubIdea aiLooks=1 kept=0 seed=1 pax=pax1:male\/outdoor\/adult\(composer\) cargo=c1:hardcase@40\+toolbox@12$/);
  assert.equal(used, 'GROUND_COMPOSER_MANIFEST items=mission-passenger=tw-pod-hiker-f-01(figures) | primary-cargo=Hardcase A+Toolbox B(composer)');
});

test('Fehler und übersprungener Schritt werden genannt', () => {
  const failed = { currentMissionData: { groundComposer: { groundVisual: { composer: { status: 'fallback', source: 'mission-ground-source.v1', error: 'Boden-Composer ohne "Antwort"' }, passengers: [] } } } };
  assert.match(log.summarize(failed)[0], /status=fallback .* error="Boden-Composer ohne 'Antwort'"$/);
  assert.deepEqual(log.summarize({ currentMissionData: { groundComposerStatus: { status: 'skipped', reason: 'no-ai' } } }), ['GROUND_COMPOSER status=none reason=no-ai']);
  assert.deepEqual(log.summarize(null), ['GROUND_COMPOSER status=none reason=no-mission']);
});
