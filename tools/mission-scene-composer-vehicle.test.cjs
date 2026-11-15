'use strict';
// Etappe E: Start-/Zielszene nutzen Fahrzeugart und Bringer aus dem Boden-Composer.
// Feldtest 13.11.2026: ein Pax plus zwei Szenenpersonen, aber ein Quad als Fahrzeug.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const sync = fs.readFileSync(path.join(root, 'sync.js'), 'utf8');
function extract(c, name) {
  const a = sync.indexOf('function ' + name + '('), b = sync.indexOf('\nfunction ', a + 1);
  assert.ok(a >= 0, name);
  vm.runInContext(sync.slice(a, b < 0 ? undefined : b), c);
}
const POOLS = { quads: ['Microsoft_Quad'], trucks: ['Truck Large Europe', 'Truck Utility NorthAm', 'Pickup 01'],
  cars: ['Microsoft_Car_EUR_01'], vans: ['Microsoft_Van_EUR'], buses: ['Bus'], medicalVehicles: ['Car Bush Medic'],
  vehicles: ['Microsoft_Quad', 'Microsoft_Car_EUR_01', 'Microsoft_Van_EUR'] };
function context({ plan = null, domain = 'club_utility', needsVan = false, figuresOff = false, group = null } = {}) {
  const c = vm.createContext({
    window: {}, MISSION_SCENE_ASSET_POOLS: POOLS, MISSION_SCENE_DEFAULT_VEHICLE_TITLE: 'Microsoft_Van_EUR',
    _missionPersonFiguresEnabled: () => !figuresOff, _missionSceneGroundIdea: () => (plan ? { groundVisual: plan } : null),
    _missionSceneTaskDomain: () => domain, _missionSceneCargoNeedsVan: () => needsVan, _missionSceneGroupPlan: () => group,
    _missionSceneVehicleRuleV2: () => true,
    _missionBushIsPickupPassengerMission: () => false,
    _sceneUniqueTitles: (...lists) => [...new Set(lists.flat().filter(Boolean))],
    _missionSceneFilteredVehiclePool: (pool) => pool.slice(), _sceneObjectTitleOverride: (_k, title) => title,
    _scenePickTitle: (pool) => pool[0], _scenePreferredTitle: (pool, preferred) => preferred, _sceneAssetCandidates: (title, pool) => [title, ...pool.filter((t) => t !== title)]
  });
  vm.runInContext(sync.slice(sync.indexOf('const MISSION_SCENE_COMPOSER_VEHICLE_POOLS'), sync.indexOf('\nfunction _missionSceneComposerScene(')), c);
  for (const name of ['_missionSceneComposerScene', '_missionSceneComposerVehicleAsset', '_missionSceneVehicleAsset']) extract(c, name);
  return c;
}
const plan = (start, arrival = start) => ({ scenes: { start: { vehicle: start, persons: [] }, arrival: { vehicle: arrival, persons: [] } } });

test('Composer-Fahrzeug je Szene: Start und Ziel unabhängig', () => {
  const c = context({ plan: plan('car', 'van') });
  assert.equal(c._missionSceneVehicleAsset('start').title, 'Microsoft_Car_EUR_01');
  assert.equal(c._missionSceneVehicleAsset('arrival').title, 'Microsoft_Van_EUR');
  assert.equal(c._missionSceneVehicleAsset().composerKind, 'car', 'ohne Angabe: Start');
});

test('Pick-up statt Lkw; schwere Fracht schlägt Pkw/Quad; Einsatzdomänen und Notaus behalten die alte Wahl', () => {
  assert.equal(context({ plan: plan('truck') })._missionSceneVehicleAsset('start').title, 'Truck Utility NorthAm');
  assert.equal(context({ plan: plan('car'), needsVan: true })._missionSceneVehicleAsset('start').composerKind, undefined);
  assert.equal(context({ plan: plan('car'), domain: 'medical_transfer' })._missionSceneVehicleAsset('start').composerKind, undefined);
  assert.equal(context({ plan: plan('car'), figuresOff: true })._missionSceneVehicleAsset('start').composerKind, undefined);
  assert.equal(context({ plan: plan('hovercraft') })._missionSceneVehicleAsset('start').composerKind, undefined);
});

test('Startszene setzt Bringer aus dem Plan an die Stelle der festen Fahrzeug-Crew', () => {
  const body = sync.slice(sync.indexOf('const startCrew = vehicleSupportEnabled'), sync.indexOf('const groupMembers = groupPlan'));
  assert.match(body, /_missionSceneCrewFigures\('start', groundFigures\)/);
  assert.match(body, /person_idle/);
  assert.match(body, /legacyPersonItems\.splice/, 'überzählige feste Crew fällt weg');
  assert.match(sync, /_missionSceneBuildDeboardingCommand\([^)]*\) \{\n    const vehicleAsset = _missionSceneVehicleAsset\(typeof _missionSceneDeboardingComposerScene === 'function' \? _missionSceneDeboardingComposerScene\(\) : 'arrival'\);/);
});

test('Aussteigen bei Rückkehr-Missionen nutzt die Start-Szene (Abflugplatz), sonst das Ziel', () => {
  for (const [md, scene] of [[{ bush: { requiresReturnHome: true } }, 'start'], [{ bush: { requiresReturnHome: false } }, 'arrival'], [{}, 'arrival']]) {
    const c = vm.createContext({ currentMissionData: md });
    extract(c, '_missionSceneDeboardingComposerScene');
    assert.equal(c._missionSceneDeboardingComposerScene(), scene);
  }
});

test('Niemand bringt: Startfahrzeug bleibt geparkt; Standard- oder Gruppenfall fährt weg', () => {
  const run = (entry, group = null) => {
    const c = vm.createContext({ _missionSceneComposerScene: () => (entry ? { entry } : null), _missionSceneGroupPlan: () => group });
    extract(c, '_missionSceneStartVehicleStays');
    return c._missionSceneStartVehicleStays();
  };
  assert.equal(run({ castFixed: true, persons: [] }), true);
  assert.equal(run({ castFixed: false, persons: [] }), false);
  assert.equal(run({ castFixed: true, persons: [{ id: 's1' }] }), false);
  assert.equal(run({ castFixed: true, persons: [] }, { valid: true }), false);
  assert.equal(run(null), false);
  assert.match(sync, /vehicleDeparture: vehicleSupportEnabled && !\(typeof _missionSceneStartVehicleStays === 'function' && _missionSceneStartVehicleStays\(\)\)/);
});

test('Empfänger am Ziel bekommen nicht dieselbe Figur wie die Bringer am Start', () => {
  const vm = require('node:vm'), fs = require('node:fs');
  const c = vm.createContext({ console, window: {}, globalThis: {} });
  c.globalThis = c.window;
  vm.runInContext(fs.readFileSync('data/mission-person-assets.js', 'utf8'), c);
  vm.runInContext(fs.readFileSync('mission-person-figure-core.js', 'utf8'), c);
  vm.runInContext(fs.readFileSync('mission-ground-visual-core.js', 'utf8'), c);
  const plan = { figureSeed: 's2', scenes: {
    start: { persons: [{ id: 's1', role: 'Sohn', gender: 'male', look: 'casual', ageBand: 'adult' }] },
    arrival: { persons: [{ id: 'a1', role: 'Grabungsbegleiter', gender: 'male', look: 'outdoor', ageBand: 'adult' }] } } };
  // Ohne Ausschluss ergibt dieser Seed für beide Szenen dieselbe Standardfigur (Feldtest 15.11.2026).
  Object.assign(c, { _missionSceneComposerScene: (scene) => ({ plan, entry: plan.scenes[scene] }), _missionScenePassengerSeason: () => 'winter', _missionSceneId: () => 'scene-x' });
  const code = fs.readFileSync('sync.js', 'utf8'), a = code.indexOf('function _missionSceneCrewFigures('), b = code.indexOf('\nfunction ', a + 1);
  vm.runInContext(code.slice(a, b), c);
  const start = c._missionSceneCrewFigures('start', []), arrival = c._missionSceneCrewFigures('arrival', []);
  assert.ok(start[0].title && arrival[0].title);
  assert.notEqual(arrival[0].title, start[0].title);
});

// Feldtest 15.11.2026: 2 Pax = Gruppe; Startszene nahm Gruppen-Van statt Composer-Fahrzeug und ohne Bringer.
test('Gruppen-Startszene nutzt das Composer-Fahrzeug; Aussteigen und Patiententransfer bleiben bei der Gruppenregel', () => {
  const group = { valid: true, groupVehicleKind: 'car', expectedPassengerCount: 2 };
  const c = context({ plan: plan('van', 'car'), group });
  c.window.GAMissionSceneGroup = { resolveGroupVehicleSelection: () => ({ candidates: ['Microsoft_Car_EUR_04'] }) };
  assert.equal(c._missionSceneVehicleAsset('start', { startSceneBuild: true }).title, 'Microsoft_Van_EUR');
  assert.equal(c._missionSceneVehicleAsset('start', { startSceneBuild: true }).composerKind, 'van');
  assert.equal(c._missionSceneVehicleAsset('start').title, 'Microsoft_Car_EUR_04', 'Aussteigen: Tracker-Titelliste');
  const medical = context({ plan: plan('van'), group: { valid: true, groupVehicleKind: 'medical', expectedPassengerCount: 2 } });
  assert.equal(medical._missionSceneVehicleAsset('start', { startSceneBuild: true }).title, 'Car Bush Medic');
  const heavy = context({ plan: plan('car'), needsVan: true, group: { valid: true, groupVehicleKind: 'van', expectedPassengerCount: 2 } });
  assert.equal(heavy._missionSceneVehicleAsset('start', { startSceneBuild: true }).title, 'Microsoft_Van_EUR', 'Pkw trotz schwerer Fracht → Gruppen-Van');
  assert.match(sync, /_missionSceneVehicleAsset\('start', \{ startSceneBuild: true \}\)/);
});

test('Gruppen-Startszene stellt bis zu zwei Bringer als person_idle an das Fahrzeug', () => {
  const body = sync.slice(sync.indexOf('const startCrew = vehicleSupportEnabled'), sync.indexOf('const sceneItems = [];', sync.indexOf('const startCrew = vehicleSupportEnabled')));
  assert.doesNotMatch(body.split('\n')[0], /!groupPlan/, 'Bringer auch bei Gruppen');
  assert.match(body, /const groupCrewItems = groupPlan && startCrew \? startCrew\.slice\(0, 2\)/);
  assert.match(body, /kind: `person_idle_\$\{index \+ 1\}`/);
  assert.match(body, /\}\)\.concat\(groupCrewItems\) : legacyPersonItems;/);
  // Der Tracker steigt nur person_boarder_* ins Flugzeug und nimmt person_idle_* beim Abfahren mit.
  const tracker = fs.readFileSync(path.join(root, 'ga-tracker-client', 'tracker.js'), 'utf8');
  assert.match(tracker, /filter\(o => \/\^person_boarder\/i\.test/);
  assert.match(tracker, /const boardVehiclePeople = rec\.objects\.filter\(o => \/\^person_idle\/i\.test/);
});
