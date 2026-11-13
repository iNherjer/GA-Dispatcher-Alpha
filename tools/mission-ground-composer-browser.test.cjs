const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
global.MissionOnboardCore = require(path.join(__dirname, '..', 'mission-onboard-core.js'));
global.MissionCargoVisualCore = require(path.join(__dirname, '..', 'mission-cargo-visual-core.js'));
global.MissionGroundVisualCore = require(path.join(__dirname, '..', 'mission-ground-visual-core.js'));
const browser = require(path.join(__dirname, '..', 'mission-ground-composer-browser.js'));

function withGlobals(values, fn) {
  const old = {}; for (const k of Object.keys(values)) { old[k] = global[k]; global[k] = values[k]; }
  try { return fn(); } finally { for (const k of Object.keys(values)) global[k] = old[k]; }
}

test('Bush-Abholung: Personen aus pickupPassengerCount, Gepäck aus der Ladeliste', () => {
  const md = { missionId: 'm1', missionTitle: 'Abholung am See', taskDomain: 'bush_pickup_return', targetName: 'Lake Strip',
    passenger: { role: 'Biologin', gender: 'female', roleProfile: 'bush_pickup_guest_v1', storySeed: 'Feldarbeit beendet' },
    bush: { targetMode: 'strip_then_return', pickupKind: 'passenger', pickupPassengerCount: 2, pickupLabel: 'Forschungsteam' } };
  const src = withGlobals({ _missionCargoGenerateManifest: () => ({ items: [{ id: 'pickup-passenger' }, { id: 'pickup-companion-cargo', label: 'Probenkisten', weightLbs: 40 }] }) },
    () => browser.source(md));
  assert.equal(src.passengerCount, 2);
  assert.deepEqual(src.lead, { role: 'Biologin', gender: 'female' });
  assert.deepEqual([src.cargoPost.description, src.cargoPost.weightLbs], ['Probenkisten', 40]);
  const onboard = MissionOnboardCore.fromIdea(src);
  assert.equal(onboard.passengers.length, 2);
  assert.equal(onboard.passengers[0].gender, 'female');
  assert.deepEqual(MissionCargoVisualCore.postFromIdea(src), { owner: 'Biologin', description: 'Probenkisten', weightLbs: 40 });
  assert.equal(MissionCargoVisualCore.ideaOf({ groundComposer: src }), src);
});

test('reiner Frachtflug: keine Personen, nur Ladung; Spezialpools ohne Ladung', () => {
  const md = { missionId: 'm2', taskDomain: 'cargo', missionTitle: 'Ersatzteile' };
  const src = withGlobals({ _missionCargoPassengerCount: () => 0, _missionCargoGenerateManifest: () => ({ items: [{ id: 'primary-cargo', label: 'Ersatzteile', weightLbs: 120 }] }) },
    () => browser.source(md));
  assert.equal(src.passengerCount, 0);
  assert.equal(MissionOnboardCore.fromIdea(src).passengers.length, 0);
  assert.equal(MissionOnboardCore.fromIdea(src).cargo[0].weightLbs, 120);
  const fire = withGlobals({ _missionCargoPassengerCount: () => 0, _missionCargoGenerateManifest: () => ({ items: [{ id: 'primary-cargo', label: 'Löschmittel', weightLbs: 200 }] }) },
    () => browser.source({ taskDomain: 'fire_watch' }));
  assert.equal(fire, null);
});

test('Stränge mit eigenem Composer werden übersprungen', () => {
  assert.equal(browser.hasOwnComposer({ charterIdea: { schema: 'charter-idea.v1' } }), true);
  assert.equal(browser.hasOwnComposer({ privateReturn: { outing: { groundVisual: {} } } }), true);
  assert.equal(browser.hasOwnComposer({ missionContract: { clubIdea: { schema: 'club-idea.v1' } } }), true);
  assert.equal(browser.hasOwnComposer({ medicalTransferIdea: { schema: 'medical-transfer-idea.v1' } }), true);
  assert.equal(browser.hasOwnComposer({ cargoIdea: { schema: 'cargo-idea.v1' } }), true);
  assert.equal(browser.hasOwnComposer({ missionContract: { animalTransportIdea: { schema: 'animal-transport-idea.v1' } } }), true);
  assert.equal(browser.hasOwnComposer({ bush: { targetMode: 'strip_then_return' } }), false);
});

test('Composer-Abruf mit Frachtflug: Plan ohne Personen, Gepäck aus FORMEN', async () => {
  const src = { schema: 'mission-ground-source.v1', taskDomain: 'cargo', occasion: 'Ersatzteile', task: '', passengerCount: 0, lead: null,
    cargoPost: { owner: 'pax1', description: 'Ersatzteile in Kisten', weightLbs: 120 } };
  const plan = await MissionGroundVisualCore.ensure(src, async () => ({ passengers: [], cargo: [{ id: 'c1', pieces: [{ form: 'wood_crate', weightLbs: 120 }] }] }), { taskDomain: 'cargo' });
  assert.equal(plan.passengers.length, 0);
  assert.equal(src.cargoVisual.pieces[0].form, 'wood_crate');
});
