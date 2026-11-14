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
  // Neue Missionskennung auf dem Rückflug: dieselben Figuren, weil der Plan seinen Losschlüssel mitträgt.
  assert.ok(plan.figureSeed && plan.figureSeed === outbound.groundVisual.figureSeed);
  const titles = (gv, seed) => core.resolveFigures(gv, { season: 'summer', seed }).map((f) => f.title);
  assert.deepEqual(titles(plan, 'mission-back'), titles(outbound.groundVisual, 'mission-out'));
});

test('Losschlüssel: ohne gespeicherten Schlüssel lost die Missionskennung, mit Schlüssel nicht', () => {
  const base = { schema: core.SCHEMA, passengers: [{ id: 'pax1', lead: true, look: 'casual', gender: 'male', ageBand: '' }] };
  const seeds = Array.from({ length: 12 }, (_, i) => 'm' + i);
  const unseeded = new Set(seeds.map((seed) => core.resolveFigures(base, { season: 'summer', seed })[0].title));
  assert.ok(unseeded.size > 1, 'Testannahme: mehrere passende Figuren im Pool');
  const seeded = new Set(seeds.map((seed) => core.resolveFigures({ ...base, figureSeed: 'gv-test' }, { season: 'summer', seed })[0].title));
  assert.equal(seeded.size, 1);
});

test('companions aus der Idee: Composer kann das Geschlecht der Mitreisenden nicht umdrehen', () => {
  const i = { ...idea(), companions: [{ role: 'Kollege aus dem Planungsteam', gender: 'male' }] };
  const onboard = onboardCore.fromIdea(i);
  assert.match(core.prompt(onboard), /"geschlecht":"male","rolle"|"rolle":"Kollege aus dem Planungsteam","geschlecht":"male"/);
  const plan = core.validate({ passengers: [{ id: 'pax1', look: 'business' }, { id: 'pax2', look: 'business', gender: 'female' }] }, onboard, { idea: i });
  assert.deepEqual(plan.passengers.map((p) => p.gender), ['male', 'male']);
});

test('Etappe C ohne KI: Bush-Gäste outdoor, Privatflug casual über die feste Rollenliste', () => {
  const onboardCore = require('../mission-onboard-core.js');
  const visual = require('../mission-ground-visual-core.js');
  const look = (roleProfile, taskDomain, gender) => visual.fallbackPlan(onboardCore.fromPassenger({ role: 'Gast', gender, roleProfile }), { roleProfile, taskDomain }).passengers[0];
  assert.deepEqual([look('bush_pickup_guest_v1', 'bush_pickup_return', 'female').look, look('bush_pickup_guest_v1', 'bush_pickup_return', 'female').gender], ['outdoor', 'female']);
  assert.equal(look('bush_adventure_guest_v1', 'bush_adventure', 'male').look, 'outdoor');
  assert.equal(look('bush_charter_guest_v1', 'charter', 'male').look, 'outdoor');
  assert.equal(look('general_passenger_v1', 'private_outing', 'female').look, 'casual');
});

// Etappe E: Bringer/Empfänger und Fahrzeug je Bodenszene, Platzprüfung.
test('Szenen: Standard je ein Bringer und ein Empfänger, Fahrzeug nach Plätzen', () => {
  const onboard = onboardCore.fromIdea(idea());
  assert.deepEqual(onboard.scenes.start.crew.map((m) => m.id), ['s1']);
  assert.deepEqual(onboard.scenes.arrival.crew.map((m) => m.id), ['a1']);
  const options = core.vehicleOptions(onboard, 'start', { taskDomain: 'charter' });
  assert.ok(options.includes('car') && options.includes('van'));
  assert.ok(!options.includes('quad'), 'Quad nur am Buschstreifen');
  assert.ok(!options.includes('bus'), 'kein Bus für drei');
  const text = core.prompt(onboard, undefined, { taskDomain: 'charter' });
  assert.match(text, /SZENEN: .*"start".*"fahrzeuge"/);
});

test('Platzregel: Quad nie für drei Personen, auch wenn die KI es wählt', () => {
  const bushIdea = { schema: 'mission-ground-source.v1', occasion: 'Abholung am Buschstreifen', passengerCount: 1,
    lead: { role: 'Wanderin', gender: 'female' }, groundCast: { start: [{ role: 'Hüttenwirt' }, { role: 'Helfer' }] } };
  const onboard = onboardCore.fromIdea(bushIdea);
  const context = { roleProfile: 'bush_pickup_guest_v1' };
  assert.ok(!core.vehicleOptions(onboard, 'start', context).includes('quad'));
  const plan = core.validate({ passengers: [], scenes: { start: { vehicle: 'quad' } } }, onboard, context);
  assert.equal(plan.scenes.start.vehicle, 'truck', 'Busch: Pick-up mit 3 Plätzen');
  assert.equal(plan.scenes.start.vehicleSource, 'capacity');
  assert.equal(plan.scenes.start.seatsNeeded, 3);
  const solo = onboardCore.fromIdea({ ...bushIdea, groundCast: { start: [], arrival: [{ role: 'Hüttenwirt' }] } });
  assert.ok(core.vehicleOptions(solo, 'arrival', context).includes('quad'), 'Pax mit Abholer am Strip: Quad erlaubt');
  assert.ok(!core.vehicleOptions(solo, 'start', context).includes('quad'), 'am Startflugplatz kein Quad');
  assert.equal(solo.scenes.start.crew.length, 0, 'leere Liste heißt: niemand bringt');
});

test('Fracht: schwer oder sperrig verlangt Ladefläche; KI-Wahl gilt, wenn sie passt', () => {
  const freight = { schema: 'cargo-idea.v1', purpose: 'Ersatzteile', shipment: { label: 'Getriebe in Holzkiste', packaging: 'Holzkiste', weightLbs: 180 }, sender: 'Werkstatt' };
  const onboard = onboardCore.fromIdea(freight);
  const options = core.vehicleOptions(onboard, 'arrival', { taskDomain: 'cargo' });
  assert.deepEqual(options.filter((k) => ['car', 'quad'].includes(k)), []);
  const plan = core.validate({ passengers: [], scenes: { arrival: { vehicle: 'truck', persons: [{ id: 'a1', look: 'workwear', gender: 'male' }] } } }, onboard, { taskDomain: 'cargo' });
  assert.equal(plan.scenes.arrival.vehicle, 'truck');
  assert.equal(plan.scenes.arrival.vehicleSource, 'composer');
  assert.deepEqual([plan.scenes.arrival.persons[0].look, plan.scenes.arrival.persons[0].gender], ['workwear', 'male']);
  assert.equal(plan.scenes.start.vehicle, 'van', 'Rückfall bei schwerer Fracht außerhalb Bush: Transporter');
});

test('Patiententransfer: Krankenwagen nur am Start', () => {
  const med = { schema: 'medical-transfer-idea.v1', purpose: 'Verlegung', passenger: { role: 'Notärztin', gender: 'female' }, patient: { gender: 'male' } };
  const onboard = onboardCore.fromIdea(med);
  assert.equal(core.validate({ passengers: [] }, onboard, {}).scenes.start.vehicle, 'medical');
  assert.ok(!core.vehicleOptions(onboard, 'arrival', {}).includes('medical'));
});

test('Empfänger-Figuren: eigene Figur je Person, keine Dopplung mit den Mitreisenden', () => {
  const onboard = onboardCore.fromIdea({ ...idea(), groundCast: { arrival: [{ role: 'Hochzeitsplanerin', gender: 'female' }, { role: 'Fahrer', gender: 'male' }] } });
  const plan = core.fallbackPlan(onboard, { roleProfile: 'charter_professional_neutral_v1' });
  plan.figureSeed = 'gv-test';
  const pax = core.resolveFigures(plan, { season: 'summer' }).map((f) => f.title);
  const crew = core.resolveSceneCrew(plan, 'arrival', { season: 'summer', exclude: pax });
  assert.equal(crew.length, 2);
  assert.deepEqual(crew.map((c) => c.gender), ['female', 'male']);
  assert.ok(crew.every((c) => c.title && !pax.includes(c.title)));
  assert.equal(crew[0].role, 'Hochzeitsplanerin');
});

test('Rückflug mit altem Plan ohne Szenen: Szenen nach Platzregel ergänzt, Looks bleiben', async () => {
  const i = idea();
  await core.ensure(i, async () => ({ passengers: [{ id: 'pax1', look: 'business' }, { id: 'pax2', look: 'casual', gender: 'female' }] }), {});
  delete i.groundVisual.scenes;
  i.luggageLabel = 'Nur Handgepäck'; i.luggageWeightLbs = 5;
  await core.ensure(i, async () => ({ passengers: [] }), {});
  assert.equal(i.groundVisual.passengers[0].look, 'business');
  assert.equal(i.groundVisual.scenes.start.vehicle, 'car');
});

test('Gruppen bleiben in der Tracker-Fahrzeugregel: 2 Pkw/Van, 3–5 Van', () => {
  const two = onboardCore.fromIdea(idea());
  assert.deepEqual(core.vehicleOptions(two, 'start', {}).sort(), ['car', 'van']);
  const four = onboardCore.fromIdea({ ...idea(), passengerCount: 4 });
  assert.deepEqual(core.vehicleOptions(four, 'start', {}), ['van']);
});
