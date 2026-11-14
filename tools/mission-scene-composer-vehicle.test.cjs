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
function context({ plan = null, domain = 'club_utility', needsVan = false, figuresOff = false } = {}) {
  const c = vm.createContext({
    window: {}, MISSION_SCENE_ASSET_POOLS: POOLS, MISSION_SCENE_DEFAULT_VEHICLE_TITLE: 'Microsoft_Van_EUR',
    _missionPersonFiguresEnabled: () => !figuresOff, _missionSceneGroundIdea: () => (plan ? { groundVisual: plan } : null),
    _missionSceneTaskDomain: () => domain, _missionSceneCargoNeedsVan: () => needsVan, _missionSceneGroupPlan: () => null,
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
