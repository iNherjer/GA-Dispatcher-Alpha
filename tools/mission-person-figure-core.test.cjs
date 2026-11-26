'use strict';
// Figurwahl: Geschlecht fest, Look/Jahreszeit bevorzugt, stabile Streuung, Gruppen ohne Dopplung.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const core = require(path.join(__dirname, '..', 'mission-person-figure-core.js'));
const assets = require(path.join(__dirname, '..', 'data', 'mission-person-assets.js'));

test('Jahreszeit: Temperatur vor Monat, Südhalbkugel gespiegelt', () => {
  assert.equal(core.seasonFromContext({ tempC: 3, month: 7 }), 'winter');
  assert.equal(core.seasonFromContext({ tempC: 22, month: 1 }), 'summer');
  assert.equal(core.seasonFromContext({ tempC: 11, month: 1, lat: 48 }), 'winter');
  assert.equal(core.seasonFromContext({ month: 7, lat: 48 }), 'summer');
  assert.equal(core.seasonFromContext({ month: 7, lat: -33 }), 'winter');
  assert.equal(core.seasonFromContext({ snow: true, tempC: 20 }), 'winter');
  assert.equal(core.seasonFromContext({}), 'summer');
});

test('Wanderin für outdoor/weiblich, im Winter weiterhin (season all)', () => {
  const summer = core.pickPersonFigure({ gender: 'female', look: 'outdoor', season: 'summer', seed: 'a' }, assets);
  const winter = core.pickPersonFigure({ gender: 'female', look: 'outdoor', season: 'winter', seed: 'a' }, assets);
  assert.equal(summer.title, 'tw-pod-hiker-f-01');
  assert.equal(winter.title, 'tw-pod-hiker-f-01');
  assert.equal(summer.maxWalkKts, 3);
  assert.equal(summer.matched.look, true);
});

test('Geschlecht wird nie getauscht, Saison nicht gemischt', () => {
  const male = core.pickPersonFigure({ gender: 'male', look: 'outdoor', season: 'winter', use: 'passenger', seed: 'x' }, assets);
  assert.equal(male.title, 'tw-pod-hiker-m-01', 'Wanderer (season all) auch im Winter');
  assert.equal(male.matched.look, true);
  const business = core.pickPersonFigure({ gender: 'male', look: 'business', season: 'winter', use: 'passenger', seed: 'x' }, assets);
  assert.match(business.title, /^Tarmac_Male_Winter_/);
  for (let i = 0; i < 40; i += 1) {
    const pick = core.pickPersonFigure({ gender: 'female', look: 'business', season: 'summer', seed: `s${i}` }, assets);
    assert.match(pick.title, /Female_Summer_/);
    assert.ok(pick.candidates.every((title) => !/_Winter_/.test(title)), pick.candidates.join());
  }
});

test('stabile Streuung über den Seed', () => {
  const a = core.pickPersonFigure({ gender: 'male', look: 'casual', season: 'summer', seed: 'mission-1' }, assets);
  const b = core.pickPersonFigure({ gender: 'male', look: 'casual', season: 'summer', seed: 'mission-1' }, assets);
  assert.equal(a.title, b.title);
  // Ohne passende Pack-Figur streut der Seed über die Standardfiguren.
  const titles = new Set(Array.from({ length: 30 }, (_, i) => core.pickPersonFigure({ gender: 'male', look: 'business', season: 'summer', use: 'passenger', seed: `m${i}` }, assets).title));
  assert.ok(titles.size >= 4, `Streuung: ${[...titles]}`);
  // Passt eine Pack-Figur, hat sie Vorrang (User-Entscheidung 26.11.2026; weitere Figuren folgen).
  const pack = core.pickPersonFigure({ gender: 'male', look: 'casual', season: 'summer', use: 'passenger', seed: 'm1' }, assets);
  assert.equal(pack.title, 'tw-pod-casual-m-01');
});

test('Einsatz filtert, solange es Treffer gibt', () => {
  const homebase = core.pickPersonFigure({ gender: 'female', use: 'homebase', season: 'summer', seed: 'h' }, assets);
  assert.equal(homebase.title, 'tw-pod-hiker-f-01', 'nur die Wanderin hat homebase');
  const patient = core.pickPersonFigure({ gender: 'male', use: 'patient', season: 'summer', seed: 'p' }, assets);
  assert.equal(patient.title, 'tw-pod-patient-m-01', 'Patient nur über use patient');
  const femalePatient = core.pickPersonFigure({ gender: 'female', use: 'patient', season: 'summer', seed: 'p' }, assets);
  assert.ok(femalePatient, 'ohne Treffer: ganzer Pool');
  const worker = core.pickPersonFigure({ gender: 'male', use: 'ground_crew', look: 'workwear', season: 'summer', seed: 'w' }, assets);
  assert.equal(worker.title, 'tw-pod-worker-m-01');
  for (const use of ['passenger', 'escort', 'pickup']) {
    for (let i = 0; i < 40; i += 1) {
      for (const look of ['', 'casual', 'outdoor', 'workwear', 'medical']) {
        const pick = core.pickPersonFigure({ gender: 'male', use, look, season: i % 2 ? 'winter' : 'summer', seed: `u${i}` }, assets);
        assert.ok(!['tw-pod-patient-m-01', 'tw-pod-worker-m-01'].includes(pick.title), `${use}/${look}: ${pick.title}`);
      }
    }
  }
});

test('Gruppe: eigene Figuren ohne Dopplung, Geschlecht je Person', () => {
  const group = core.pickGroupFigures([
    { gender: 'female', look: 'outdoor' }, { gender: 'female' }, { gender: 'male' }, { gender: 'male' }, { gender: 'female' }, { gender: 'male' }
  ], { season: 'summer', seed: 'grp' }, assets);
  assert.equal(group.length, 6);
  assert.equal(new Set(group.map((pick) => pick.title)).size, 6);
  assert.deepEqual(group.map((pick) => pick.gender), ['female', 'female', 'male', 'male', 'female', 'male']);
  assert.equal(group[0].title, 'tw-pod-hiker-f-01');
});

test('Titelprüfung kennt Pack- und Standardfiguren', () => {
  assert.equal(core.isPersonFigureTitle('tw-pod-hiker-f-01', assets), true);
  assert.equal(core.isPersonFigureTitle('Tarmac_Male_Winter_Arab', assets), true);
  assert.equal(core.isPersonFigureTitle('Cardboard', assets), false);
});

test('feste Liste Rolle → Look: alle Werte gültig, roleProfile vor taskDomain', () => {
  const vocabulary = require(path.join(__dirname, '..', 'data', 'mission-person-vocabulary.json'));
  for (const look of [...Object.values(core.LOOK_BY_ROLE_PROFILE), ...Object.values(core.LOOK_BY_TASK_DOMAIN)]) {
    assert.ok(vocabulary.looks[look], look);
  }
  assert.equal(core.defaultLookForRole({ roleProfile: 'instructor_calm_precise_v1', taskDomain: 'charter' }), 'aviation');
  assert.equal(core.defaultLookForRole({ taskDomain: 'medical_transfer' }), 'medical');
  assert.equal(core.defaultLookForRole({ roleProfile: 'unbekannt', taskDomain: 'unbekannt' }), 'casual');
});

test('alle bekannten roleProfiles und taskDomains der App sind in der festen Liste', () => {
  const fs = require('node:fs');
  const root = path.join(__dirname, '..');
  const sources = fs.readdirSync(root).filter((name) => /\.js$/.test(name) && !/\.test\./.test(name))
    .map((name) => fs.readFileSync(path.join(root, name), 'utf8')).join('\n');
  const found = (key) => [...new Set([...sources.matchAll(new RegExp(`${key}: '([a-z_0-9]+)'`, 'g'))].map((m) => m[1]))];
  const ignoredDomains = new Set(['flight_compliance', 'ground_inventory', 'freeflight_planning']);
  const missingProfiles = found('roleProfile').filter((value) => value !== 'none' && !core.LOOK_BY_ROLE_PROFILE[value]);
  const missingDomains = found('taskDomain').filter((value) => !ignoredDomains.has(value) && !core.LOOK_BY_TASK_DOMAIN[value]);
  assert.deepEqual(missingProfiles, [], 'roleProfile ohne Look');
  assert.deepEqual(missingDomains, [], 'taskDomain ohne Look');
});
