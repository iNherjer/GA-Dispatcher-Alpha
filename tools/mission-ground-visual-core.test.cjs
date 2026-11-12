'use strict';
// Boden-Composer: Prompt, Prüfung, Rückfall auf feste Liste, Cargo-Kompatibilität, Figuren je Pax.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const core = require(path.join(__dirname, '..', 'mission-ground-visual-core.js'));
const onboardCore = require(path.join(__dirname, '..', 'mission-onboard-core.js'));

const idea = () => ({
  schema: 'charter-idea.v1', reason: 'Hochzeit auf einem Weingut', background: 'Das Brautpaar wünscht Luftaufnahmen',
  arrival: 'Abholung durch die Hochzeitsplanerin', travelCharacter: 'festlich', passengerCount: 2, groupLabel: 'Fotograf mit Assistentin',
  passenger: { name: 'Jonas Weber', role: 'Hochzeitsfotograf', gender: 'male', personality: 'ruhig' },
  luggageLabel: 'Kameraausrüstung mit Drohne im Hartschalenkoffer', luggageWeightLbs: 28
});

test('Prompt enthält Anlass, Personen, Looks, Formen – ohne Beispiele für Kombinationen', () => {
  const text = core.prompt(onboardCore.fromIdea(idea()));
  assert.match(text, /Hochzeit auf einem Weingut/);
  assert.match(text, /"geschlecht":"offen"/);
  assert.match(text, /"id":"business"/);
  assert.match(text, /"id":"camera_kit"/);
  assert.doesNotMatch(text, /Hochzeitsfotograf.*business.*Beispiel/);
});

test('gültige Antwort: Looks vom Composer, Hauptperson behält Geschlecht, Cargo wie bisher', () => {
  const i = idea();
  const onboard = onboardCore.fromIdea(i);
  const plan = core.validate({
    passengers: [{ id: 'pax1', look: 'business', ageBand: 'adult', gender: 'female' }, { id: 'pax2', look: 'business', ageBand: 'young_adult', gender: 'female' }],
    cargo: [{ id: 'c1', pieces: [{ form: 'camera_kit', weightLbs: 20 }, { form: 'hardcase', weightLbs: 8 }] }]
  }, onboard, { idea: i, roleProfile: 'charter_professional_neutral_v1' });
  assert.deepEqual(plan.passengers.map((p) => [p.look, p.gender, p.lookSource]), [['business', 'male', 'composer'], ['business', 'female', 'composer']]);
  assert.equal(plan.cargo.c1.schema, 'cargo-visual-plan.v1');
  assert.equal(plan.cargo.c1.sourceLabel, i.luggageLabel, 'kompatibel zum bisherigen planMatches');
  assert.equal(plan.cargo.c1.pieces.reduce((sum, p) => sum + p.weightLbs, 0), 28);
});

test('ungültige Teile: Look aus fester Liste, ungültiges Gepäck fehlt, Struktur ohne passengers → null', () => {
  const i = idea();
  const onboard = onboardCore.fromIdea(i);
  const plan = core.validate({ passengers: [{ id: 'pax1', look: 'uniform' }], cargo: [{ id: 'c1', pieces: [{ form: 'unbekannt' }] }] },
    onboard, { idea: i, roleProfile: 'charter_professional_neutral_v1' });
  assert.equal(plan.passengers[0].look, 'business');
  assert.equal(plan.passengers[0].lookSource, 'role');
  assert.equal(plan.cargo.c1, undefined);
  assert.ok(['female', 'male'].includes(plan.passengers[1].gender), 'offenes Geschlecht wird gefüllt');
  assert.equal(core.validate({}, onboard), null);
});

test('ensure: Erfolg schreibt groundVisual + cargoVisual; gleiche Idee ruft nicht erneut', async () => {
  const i = idea();
  let calls = 0;
  const json = async () => { calls += 1; return { passengers: [{ id: 'pax1', look: 'business' }, { id: 'pax2', look: 'casual', gender: 'female' }], cargo: [{ id: 'c1', pieces: [{ form: 'camera_kit', weightLbs: 28 }] }] }; };
  const plan = await core.ensure(i, json, { taskDomain: 'charter' });
  assert.equal(plan.passengers[0].look, 'business');
  assert.equal(i.cargoVisual.pieces[0].form, 'camera_kit');
  await core.ensure(i, json, { taskDomain: 'charter' });
  assert.equal(calls, 1, 'Rückflug/Wiederherstellung nutzt gespeicherte Wahl');
  assert.equal(core.planMatches(i.groundVisual, onboardCore.fromIdea(i)), true);
});

test('ensure: KI-Ausfall → feste Liste, Cargo über bisherigen Composer', async () => {
  const i = idea();
  let cargoCalls = 0;
  const json = async (text) => {
    if (/Scene Composer.*Bodenszene/s.test(text)) throw new Error('offline');
    cargoCalls += 1;
    return { pieces: [{ form: 'camera_kit', weightLbs: 28 }] };
  };
  const plan = await core.ensure(i, json, { taskDomain: 'charter' });
  assert.deepEqual(plan.passengers.map((p) => p.lookSource), ['role', 'role']);
  assert.equal(plan.passengers[0].look, 'business');
  assert.equal(cargoCalls, 1);
  assert.equal(i.cargoVisual.pieces[0].form, 'camera_kit');
});

test('unbekanntes Ideen-Schema: unverändert bisheriger Cargo-Composer', async () => {
  const result = await core.ensure({ schema: 'cargo-idea.v1' }, async () => ({}));
  assert.equal(result, null);
});

test('Figuren je Pax: Geschlecht und Look umgesetzt, keine Dopplung', () => {
  const plan = { schema: core.SCHEMA, passengers: [
    { id: 'pax1', lead: true, look: 'outdoor', gender: 'female', ageBand: 'young_adult' },
    { id: 'pax2', lead: false, look: 'outdoor', gender: 'female', ageBand: '' },
    { id: 'pax3', lead: false, look: 'casual', gender: 'male', ageBand: '' }
  ] };
  const figures = core.resolveFigures(plan, { season: 'summer', seed: 'm1' });
  assert.equal(figures[0].title, 'tw-pod-hiker-f-01');
  assert.match(figures[1].title, /^Tarmac_Female_Summer_/);
  assert.match(figures[2].title, /^Tarmac_Male_Summer_/);
  assert.equal(new Set(figures.map((f) => f.title)).size, 3);
});

test('Rückflug: gleiche Personen behalten Looks trotz neuem Anlass, kein neuer Composer-Abruf', async () => {
  const outbound = idea();
  await core.ensure(outbound, async () => ({ passengers: [{ id: 'pax1', look: 'business' }, { id: 'pax2', look: 'casual', gender: 'female' }],
    cargo: [{ id: 'c1', pieces: [{ form: 'camera_kit', weightLbs: 28 }] }] }), { taskDomain: 'charter' });
  const back = { ...JSON.parse(JSON.stringify(outbound)), reason: 'Rückreise nach der Hochzeit', background: 'Die Fotos sind fertig' };
  let calls = 0;
  const plan = await core.ensure(back, async () => { calls += 1; return { pieces: [{ form: 'camera_kit', weightLbs: 28 }] }; }, { taskDomain: 'charter' });
  assert.equal(calls, 0, 'Gepäck unverändert → auch kein Cargo-Abruf');
  assert.deepEqual(plan.passengers.map((p) => [p.look, p.gender]), [['business', 'male'], ['casual', 'female']]);
});
