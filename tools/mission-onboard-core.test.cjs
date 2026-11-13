'use strict';
// Bordliste aus den fertigen Ideen der Pilot-Stränge und aus dem Passagierprofil.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const core = require(path.join(__dirname, '..', 'mission-onboard-core.js'));

const charter = {
  schema: 'charter-idea.v1', reason: 'Hochzeit auf einem Weingut', background: 'Das Brautpaar wünscht Luftaufnahmen',
  arrival: 'Abholung durch die Hochzeitsplanerin', travelCharacter: 'festlich', passengerCount: 2, groupLabel: 'Fotograf mit Assistentin',
  passenger: { name: 'Jonas Weber', role: 'Hochzeitsfotograf', gender: 'male', personality: 'ruhig' },
  luggageLabel: 'Kameraausrüstung mit Drohne im Hartschalenkoffer', luggageWeightLbs: 28
};

test('Charter: Anlass, Gruppe, Hauptperson mit Geschlecht, Mitreisende offen, Gepäck', () => {
  const onboard = core.fromIdea(charter);
  assert.equal(onboard.schema, 'mission-onboard.v1');
  assert.match(onboard.occasion, /Hochzeit/);
  assert.match(onboard.occasion, /festlich/);
  assert.equal(onboard.passengers.length, 2);
  assert.deepEqual(onboard.passengers.map((p) => [p.id, p.lead, p.gender]), [['pax1', true, 'male'], ['pax2', false, '']]);
  assert.equal(onboard.passengers[0].role, 'Hochzeitsfotograf');
  assert.equal(onboard.passengers[1].role, 'Fotograf mit Assistentin');
  assert.deepEqual(onboard.cargo.map((c) => [c.id, c.owner, c.weightLbs]), [['c1', 'pax1', 28]]);
});

test('Charter mit companions: Mitreisende übernehmen Rolle und Geschlecht fest', () => {
  const onboard = core.fromIdea({ ...charter, companions: [{ role: 'Assistentin', gender: 'female' }] });
  assert.deepEqual(onboard.passengers.map((p) => [p.id, p.role, p.gender]), [['pax1', 'Hochzeitsfotograf', 'male'], ['pax2', 'Assistentin', 'female']]);
  const sight = core.fromIdea({ schema: 'sightseeing-idea.v1', theme: 'Burgen', summary: 'Ausflug', groundPlan: 'Picknick', passengerCount: 2,
    groupLabel: 'Ehepaar', passenger: { name: 'Erika', role: 'Reisende', gender: 'female' }, companions: [{ role: 'Ehemann', gender: 'male' }],
    luggageLabel: 'Picknickkorb', luggageWeightLbs: 10 });
  assert.deepEqual(sight.passengers.map((p) => p.gender), ['female', 'male']);
});

test('Charter ohne Gepäck: keine Cargo-Posten', () => {
  assert.deepEqual(core.fromIdea({ ...charter, luggageWeightLbs: 0 }).cargo, []);
});

test('Sightseeing und Reporter', () => {
  const sight = core.fromIdea({ schema: 'sightseeing-idea.v1', theme: 'Burgen am Neckar', summary: 'Rundflug für ein älteres Paar',
    groundPlan: 'Kaffee am Flugplatz', passengerCount: 2, groupLabel: 'Ehepaar',
    passenger: { name: 'Ilse', role: 'Rentnerin', gender: 'female', personality: 'neugierig' }, luggageLabel: 'Kamera', luggageWeightLbs: 4 });
  assert.equal(sight.passengers.length, 2);
  assert.equal(sight.passengers[0].gender, 'female');
  const news = core.fromIdea({ schema: 'apt-news-idea.v1', purpose: 'Bericht über das Fliegerfest', background: 'Lokalzeitung',
    angle: 'Ehrenamt', groundPlan: 'Interviews', publication: 'Wochenendausgabe', groupLabel: 'Reporterin',
    passenger: { name: 'Mia', role: 'Reporterin', gender: 'female' },
    shipment: { label: 'Kameratasche', packaging: 'gepolsterte Tasche', handling: 'aufrecht', weightLbs: 12 } });
  assert.equal(news.passengers.length, 1);
  assert.equal(news.cargo[0].packaging, 'gepolsterte Tasche');
});

test('unbekanntes Schema → null, Rückfall aus Passagierprofil mit Gruppe bis 6', () => {
  assert.equal(core.fromIdea({ schema: 'cargo-idea.v1' }), null);
  const fallback = core.fromPassenger({ role: 'Fluglehrerin', gender: 'female', storySeed: 'Platzrundentraining' }, { party: { count: 9, label: 'Schulklasse' } });
  assert.equal(fallback.passengers.length, 6);
  assert.equal(fallback.passengers[0].gender, 'female');
  assert.equal(fallback.source, 'passenger-profile');
  assert.equal(core.fromPassenger(null), null);
});

test('normalize begrenzt und bereinigt', () => {
  const onboard = core.normalize({ passengers: [{ gender: 'divers', role: 'x'.repeat(300) }], cargo: [{ description: 'Kiste', weightLbs: -1 }] });
  assert.equal(onboard.passengers[0].gender, '');
  assert.equal(onboard.passengers[0].role.length, 100);
  assert.deepEqual(onboard.cargo, []);
  assert.equal(core.normalize({ passengers: [] }), null);
});

test('Privatflug: ein Mitflieger mit festem Geschlecht und persönlichem Gepäck', () => {
  const onboard = core.fromIdea({ schema: 'private-outing.v1', occasion: 'Ihr wollt gemeinsam den Flohmarkt besuchen.',
    personalReason: 'Ihr sucht alte Schallplatten.', storyIdentity: { activity: 'stöbern' }, firstStep: 'Zu Fuß zum Markt',
    groundPlan: { intent: 'Flohmarktbesuch' }, companion: { name: 'Jan', relationship: 'Bruder', gender: 'male', personality: 'ruhig' },
    luggage: { label: 'Stoffbeutel', weightLbs: 4 } });
  assert.equal(onboard.source, 'private-outing.v1');
  assert.equal(onboard.passengers.length, 1);
  assert.deepEqual([onboard.passengers[0].role, onboard.passengers[0].gender], ['Bruder', 'male']);
  assert.match(onboard.occasion, /Flohmarkt/);
  assert.match(onboard.task, /Flohmarktbesuch/);
  assert.deepEqual([onboard.cargo[0].description, onboard.cargo[0].weightLbs], ['Stoffbeutel', 4]);
});

test('Verein: ein Vereinskollege, Lieferung als Hauptposten, Gepäck als zweiter Posten', () => {
  const visual = require('../mission-cargo-visual-core.js');
  const idea = { schema: 'club-idea.v1', occasion: 'Der Nachbarverein feiert Hangarfest.', clubConnection: 'Partnerverein',
    pilotIntent: 'Helfen', passengerIntent: 'Grill betreuen', groundPlan: 'Aufbau am Hangar',
    passenger: { name: 'Uwe', role: 'Vereinskamerad', gender: 'male', personality: 'ruhig' },
    luggage: { label: 'Reisetasche', weightLbs: 12 }, delivery: { label: 'Grillrost', weightLbs: 30, receiver: 'Festwart', purpose: 'Hangarfest' } };
  const onboard = core.fromIdea(idea);
  assert.equal(onboard.passengers.length, 1);
  assert.deepEqual([onboard.passengers[0].role, onboard.passengers[0].gender], ['Vereinskamerad', 'male']);
  assert.deepEqual(onboard.cargo.map((c) => [c.id, c.description, c.owner]), [['c1', 'Grillrost', 'Festwart'], ['c2', 'Reisetasche', 'Vereinskamerad']]);
  assert.equal(visual.postFromIdea(idea).description, 'Grillrost');
  const noDelivery = core.fromIdea({ ...idea, delivery: null });
  assert.deepEqual(noDelivery.cargo.map((c) => [c.id, c.description]), [['c1', 'Reisetasche']]);
  assert.equal(visual.postFromIdea({ ...idea, delivery: null }).description, 'Reisetasche');
  const nobody = core.fromIdea({ ...idea, passenger: null, luggage: null });
  assert.equal(nobody.passengers.length, 0);
  assert.equal(nobody.cargo.length, 1);
  assert.equal(visual.ideaOf({ clubIdea: idea }), idea);
});
