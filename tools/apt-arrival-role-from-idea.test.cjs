// Die Idee bestimmt die Art der Abhol-Szene am Ziel vor Plan-Aufgabe und Stichwortsuche.
// Feldtest 15.11.2026: Charter mit „Laborassistent“ in der Story wurde zur Frachtübergabe (Fracht-Hangar).
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
function extract(file, name, c) { const code = fs.readFileSync(file, 'utf8'), a = code.indexOf('function ' + name + '('), b = code.indexOf('\nfunction ', a + 1); assert.ok(a >= 0); vm.runInContext(code.slice(a, b < 0 ? undefined : b), c); }
function resolver() {
  const c = vm.createContext({ normalizeMissionType: () => 'apt', pickAnimalTransportSceneSpec: () => ({ role: 'animal.box', label: 'Tierbox' }) });
  extract('app.js', 'getMissionPlanV2Plan', c); extract('mission-definition-core.js', 'normalizeAptArrivalRole', c);
  return c.normalizeAptArrivalRole;
}
const labStory = 'Gemeinsam mit ihrem Laborassistenten bringt sie die Proben ins Labor.';

test('Charter-Idee: Charter-Abholung trotz Labor-Stichwort und Fracht-Aufgabe im Plan', () => {
  const role = resolver()({ mission: { charterIdea: { schema: 'charter-idea.v1' }, s: labStory }, cargoText: 'Messapparatur', missionPlanV2: { status: 'ready', plan: { taskDomain: 'cargo_logistics' } } });
  assert.equal(role.role, 'charter_pickup');
});

test('Idee im Vertrag zählt ebenso; Fracht-Idee bleibt Frachtübergabe', () => {
  const normalize = resolver();
  assert.equal(normalize({ mission: { missionContract: { sightseeingIdea: { schema: 'sightseeing-idea.v1' } }, s: labStory } }).role,
    normalize({ mission: { missionPlanV2: null, s: 'sightseeing tour' }, missionPlanV2: { status: 'ready', plan: { taskDomain: 'sightseeing' } } }).role);
  assert.equal(normalize({ mission: { cargoIdea: { schema: 'cargo-idea.v1' }, s: 'Ein Gast fliegt mit' } }).role, 'cargo_handoff');
});

test('Ohne Idee bleibt Plan-Aufgabe und Stichwortsuche wie bisher', () => {
  const normalize = resolver();
  assert.equal(normalize({ mission: { s: labStory } }).role, 'cargo_handoff', 'Textrückfall unverändert');
  assert.equal(normalize({ mission: { s: labStory }, missionPlanV2: { status: 'ready', plan: { taskDomain: 'charter' } } }).role, 'charter_pickup');
  assert.equal(normalize({ mission: { charterIdea: { schema: 'altes-schema' }, s: labStory } }).role, 'cargo_handoff', 'fremdes Schema zählt nicht');
});
