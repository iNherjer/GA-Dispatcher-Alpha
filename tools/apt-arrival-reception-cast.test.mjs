// Etappe E Schritt 3: Der Szenenplaner bekommt die Empfangsbesetzung aus dem Boden-Composer fest
// vorgegeben und platziert nur noch; die Szene setzt sie auch durch, wenn der Planer abweicht.
// Feldtest 13.11.2026: Planer erfand Redakteur/Kameramann und einen Container-Lkw als Ausrüstung.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { declaration } from './gemini-migration-harness.mjs';
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const sync = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
const arrivalCore = fs.readFileSync(new URL('../mission-arrival-core.js', import.meta.url), 'utf8');

function appContext() {
  const c = vm.createContext({ window: {}, console, Map, Set });
  vm.runInContext(arrivalCore, c);
  vm.runInContext(app.slice(app.indexOf('const SCENE_PLANNER_V3_CAST_VEHICLE_ROLES'), app.indexOf('\nfunction scenePlannerV3ReceptionCast(')), c);
  for (const name of ['scenePlannerV3CleanText', 'scenePlannerV3ReceptionCast', 'scenePlannerV3PreferredAptPlacement', 'sanitizeScenePlannerV3AptArrivalPlan']) vm.runInContext(declaration(app, name), c);
  return c;
}
const arrival = (extra = {}) => ({ vehicle: 'truck', vehicleSource: 'composer', seatsNeeded: 2, seats: 3, castFixed: false,
  persons: [{ id: 'a1', role: 'Hüttenwirt', gender: 'male', look: 'outdoor' }], ...extra });

test('Planer-Vorgabe: Fahrzeugrolle immer, Personen nur aus der Idee, sonst Höchstzahl nach Plätzen', () => {
  const c = appContext();
  const open = c.scenePlannerV3ReceptionCast({ groundComposer: { groundVisual: { scenes: { arrival: arrival() } } } });
  assert.equal(open.vehicleRole, 'vehicle.truck');
  assert.equal(open.persons.length, 0);
  assert.equal(open.maxPersons, 2, 'Pick-up 3 Plätze, ein Mitreisender');
  const fixed = c.scenePlannerV3ReceptionCast({}, { clubIdea: { groundVisual: { scenes: { arrival: arrival({ castFixed: true }) } } } });
  assert.equal(fixed.persons[0].label, 'Hüttenwirt');
  assert.equal(fixed.persons[0].role, 'person.ground_crew');
  assert.equal(c.scenePlannerV3ReceptionCast({ clubIdea: {} }), null, 'ohne Plan keine Vorgabe');
  c.window.MissionGroundVisualCore = { enabled: () => false };
  assert.equal(c.scenePlannerV3ReceptionCast({ groundComposer: { groundVisual: { scenes: { arrival: arrival() } } } }), null, 'Notaus');
});

test('Plausibilitätsprüfung: Planer-Aufstellung mit vorgegebenem Fahrzeug bleibt erhalten', () => {
  const c = appContext();
  const base = { role: 'cargo_handoff', roles: ['vehicle.van', 'person.ground_crew'], items: [
    { kind: 'arrival_vehicle', role: 'vehicle.van', forwardM: -7, rightM: 5 }, { kind: 'arrival_person_1', role: 'person.ground_crew', forwardM: 1, rightM: 3 }] };
  const raw = { items: [{ kind: 'arrival_vehicle', role: 'vehicle.truck', forwardM: -12, rightM: 9 }, { kind: 'arrival_person_1', role: 'person.ground_crew', forwardM: 2, rightM: 4 }] };
  const without = c.sanitizeScenePlannerV3AptArrivalPlan(raw, base);
  assert.equal(without.items[0].role, 'vehicle.van', 'ohne Vorgabe: Grundrolle (bisheriges Verhalten)');
  const withCast = c.sanitizeScenePlannerV3AptArrivalPlan(raw, base, { vehicleRole: 'vehicle.truck', persons: [] });
  assert.equal(withCast.items[0].role, 'vehicle.truck');
  assert.equal(withCast.items[0].forwardM, -12, 'Planer-Position bleibt');
});

function syncContext({ entry, crew, paxFigures = [{ title: 'Pax_A', gender: 'female' }], items, bushPickup = false }) {
  const c = vm.createContext({ console, globalThis: {}, window: {},
    _missionAptArrivalPreviewItems: () => items, _missionCargoEnsureManifest: () => ({ items: [] }), _missionCargoIsPassengerItem: () => false,
    _missionBushIsPickupPassengerMission: () => bushPickup, _missionAptArrivalAssetForItem: (item, i, o) => ({ title: `legacy-${item.role}-${i}`, candidates: [], moving: o?.movingPerson === true }),
    _missionSceneGroundFigures: () => paxFigures, _missionSceneCrewFigures: () => crew, _missionSceneComposerScene: () => ({ entry }),
    _missionSceneGroundFigureCandidates: (f) => [f.title], _missionCargoStableObjectKey: () => 'k' });
  const a = sync.indexOf('function _missionAptArrivalSceneItems('), b = sync.indexOf('\nfunction ', a + 1);
  vm.runInContext(sync.slice(a, b), c);
  return c;
}
const person = (n) => ({ kind: `arrival_person_${n}`, role: 'person.ground_crew', label: `P${n}` });
const vehicle = { kind: 'arrival_vehicle', role: 'vehicle.van', label: 'Van' };

test('Zielszene: feste Besetzung ersetzt und begrenzt die Planer-Personen', () => {
  const c = syncContext({ entry: arrival({ castFixed: true, seats: 8 }), crew: [{ title: 'Crew_1', role: 'Hüttenwirt' }], items: [vehicle, person(1), person(2)] });
  assert.deepEqual(c._missionAptArrivalSceneItems({}).map((i) => i.objectTitle), ['legacy-vehicle.van-0', 'Crew_1']);
});

test('Zielszene: Standardperson ersetzt die erste, weitere bleiben bis zu den Plätzen', () => {
  const items = [vehicle, person(1), person(2), person(3)];
  const c = syncContext({ entry: arrival({ seats: 3, seatsNeeded: 2 }), crew: [{ title: 'Crew_1' }], items });
  assert.deepEqual(c._missionAptArrivalSceneItems({}).map((i) => i.objectTitle), ['legacy-vehicle.van-0', 'Crew_1', 'legacy-person.ground_crew-2'],
    'Pick-up: 3 Plätze minus 1 Pax = 2 Empfänger');
});

test('Bush-Abholung: wartende Person ist der Pax und trägt dessen Figur', () => {
  const c = syncContext({ entry: arrival(), crew: [{ title: 'Crew_1' }], items: [vehicle, person(1), person(2)], bushPickup: true });
  const out = c._missionAptArrivalSceneItems({});
  assert.equal(out[1].kind, 'person_boarder_1');
  assert.equal(out[1].objectTitle, 'Pax_A');
  assert.equal(out[2].objectTitle, 'Crew_1');
});

test('Ohne Composer-Plan bleibt die Zielszene unverändert', () => {
  const c = syncContext({ entry: null, crew: null, paxFigures: null, items: [vehicle, person(1), person(2)] });
  assert.deepEqual(c._missionAptArrivalSceneItems({}).map((i) => i.objectTitle), ['legacy-vehicle.van-0', 'legacy-person.ground_crew-1', 'legacy-person.ground_crew-2']);
});

test('Zielszene: Empfänger steigen mit ins Abholfahrzeug, ohne Plan bleibt es wie bisher', () => {
  const near = { ...vehicle, forwardM: -7, rightM: 5 };
  const far = { ...person(2), forwardM: 60, rightM: 0 };
  const c = syncContext({ entry: arrival({ seats: 8, seatsNeeded: 3 }), crew: [{ title: 'Crew_1' }, { title: 'Crew_2' }], items: [near, { ...person(1), forwardM: 2, rightM: 3 }, far] });
  const out = c._missionAptArrivalSceneItems({});
  assert.equal(out[0].departWithPickupVehicle, undefined, 'Fahrzeug selbst nicht');
  assert.equal(out[1].departWithPickupVehicle, true);
  assert.equal(out[2].departWithPickupVehicle, undefined, 'mehr als 45 m Weg: bleibt stehen');
  const extra = syncContext({ entry: arrival({ seats: 8, seatsNeeded: 3 }), crew: [{ title: 'Crew_1' }], items: [near, person(1), person(2)] });
  const ex = extra._missionAptArrivalSceneItems({});
  assert.equal(ex[2].objectTitle, 'legacy-person.ground_crew-2');
  assert.equal(ex[2].departWithPickupVehicle, true, 'zusätzliche Person der Szene steigt auch zu');
  const pickup = syncContext({ entry: arrival(), crew: [{ title: 'Crew_1' }], items: [near, person(1), person(2)], bushPickup: true });
  const p = pickup._missionAptArrivalSceneItems({});
  assert.equal(p[1].departWithPickupVehicle, undefined, 'wartender Bush-Pax steigt selbst zu');
  assert.equal(p[2].departWithPickupVehicle, true);
  const legacy = syncContext({ entry: null, crew: null, items: [near, person(1)] });
  assert.equal(legacy._missionAptArrivalSceneItems({})[1].departWithPickupVehicle, undefined);
});
