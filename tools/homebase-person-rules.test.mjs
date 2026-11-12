// Prüfregeln für Personen im Homebase-Pack: gültige Figur, typische Fehler, Aussehen.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { checkPersonAsset, isPersonAsset } from './homebase-person-rules.mjs';

const vocabulary = JSON.parse(fs.readFileSync(new URL('../data/mission-person-vocabulary.json', import.meta.url), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(new URL('../homebase/assets/catalog.json', import.meta.url), 'utf8'));

const appearance = {
  look: 'outdoor', ageBand: 'young_adult', season: 'all', props: ['backpack_large'],
  uses: ['passenger', 'pickup', 'bystander', 'homebase'],
  description: 'Junge Frau in Wanderhose und Funktionsjacke mit großem Trekkingrucksack'
};
const hiker = () => {
  const asset = JSON.parse(JSON.stringify(catalog.assets.find((entry) => entry.key === 'tumbleweedHiker')));
  asset.person.appearance = { ...appearance };
  return asset;
};

test('Wanderin mit Aussehen ist gültig', () => {
  const result = checkPersonAsset(hiker(), vocabulary);
  assert.deepEqual(result, { errors: [], warnings: [] });
});

test('Wanderin im Pack 0.6.26 ohne Aussehen: nur Hinweis', () => {
  const asset = catalog.assets.find((entry) => entry.key === 'tumbleweedHiker');
  const result = checkPersonAsset(asset, vocabulary);
  assert.equal(result.errors.length, 0);
  assert.match(result.warnings[0], /appearance fehlt/);
});

test('typische Fehler werden erkannt', () => {
  const cases = [
    [(a) => { a.missionRoles = ['scene-prop']; }, /scene-prop/],
    [(a) => { a.title = 'Tarmac_Female_Summer_Asian'; }, /Titel/],
    [(a) => { a.person.gender = 'other'; }, /gender/],
    [(a) => { a.person.locomotion.maxWalkKts = 6; }, /maxWalkKts/],
    [(a) => { a.person.locomotion.cleanWalkKts = [1.5, 3.5]; }, /cleanWalkKts/],
    [(a) => { a.person.appearance.look = 'party'; }, /look/],
    [(a) => { a.person.appearance.props = ['umbrella']; }, /props/],
    [(a) => { a.person.appearance.uses = []; }, /uses/],
    [(a) => { a.person.appearance.description = 'x'.repeat(250); }, /zu lang/],
    [(a) => { delete a.person; }, /person-Block/]
  ];
  for (const [mutate, expected] of cases) {
    const asset = hiker();
    mutate(asset);
    const { errors } = checkPersonAsset(asset, vocabulary);
    assert.ok(errors.some((message) => expected.test(message)), `${expected} in ${JSON.stringify(errors)}`);
  }
});

test('Einsatzzweck in der Beschreibung gibt einen Hinweis', () => {
  const asset = hiker();
  asset.person.appearance.description = 'Junge Frau, ideal für Bush-Missionen';
  const { errors, warnings } = checkPersonAsset(asset, vocabulary);
  assert.equal(errors.length, 0);
  assert.match(warnings[0], /Einsatzzweck/);
});

test('Personen werden erkannt, Objekte nicht', () => {
  assert.equal(isPersonAsset(catalog.assets.find((entry) => entry.key === 'tumbleweedHiker')), true);
  assert.equal(catalog.assets.filter(isPersonAsset).length, 1);
});
