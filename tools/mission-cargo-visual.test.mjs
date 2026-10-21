// Cargo appearance: dynamic catalogue, neutral composer prompt, validation, sizing and manifest/scene expansion.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {buildCargoAssets} from './generate-mission-cargo-assets.mjs';

const require = createRequire(import.meta.url);
const visual = require('../mission-cargo-visual-core.js');
const generated = require('../data/mission-cargo-assets.js');
const catalog = JSON.parse(fs.readFileSync(new URL('../homebase/assets/catalog.json', import.meta.url), 'utf8'));
const profiles = JSON.parse(fs.readFileSync(new URL('../data/mission-cargo-asset-profiles.json', import.meta.url), 'utf8'));

function functionSource(file, name) {
  const source = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, 'missing ' + name);
  const open = source.indexOf(') {', start) + 2;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') depth--;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw Error('unterminated ' + name);
}

test('generated cargo catalogue matches pack catalogue and profiles; every cargo asset has a profile', () => {
  const { warnings, ...built } = buildCargoAssets(catalog, profiles);
  assert.deepEqual(warnings, []);
  assert.deepEqual(JSON.parse(JSON.stringify(built)), JSON.parse(JSON.stringify(generated)));
});

test('a new pack asset becomes selectable through its profile alone', () => {
  const extended = { ...catalog, assets: [...catalog.assets, { key: 'guitarCase', title: 'VFR Multitool Homebase Guitar Case', label: 'Gitarrenkoffer', missionSpawnable: true, missionRoles: ['cargo'], missionTags: ['cargo', 'music'] }] };
  const without = buildCargoAssets(extended, profiles);
  assert.ok(without.warnings.includes('Cargo asset without profile: guitarCase'));
  assert.equal(visual.offeredForms(without).some(form => form.id === 'instrument_case'), false);
  const withProfile = buildCargoAssets(extended, { ...profiles, forms: { ...profiles.forms, instrument_case: { label: 'Instrumentenkoffer' } },
    assets: { ...profiles.assets, guitarCase: { form: 'instrument_case', size: 'm', loadLbs: [5, 30], uses: ['passenger_gear'] } } });
  assert.deepEqual(withProfile.warnings, []);
  assert.equal(visual.offeredForms(withProfile).some(form => form.id === 'instrument_case'), true);
});

test('passenger gear offers luggage forms and generic containers, never fixed aircraft equipment or fuel', () => {
  const ids = visual.offeredForms(generated).map(form => form.id);
  for (const id of ['backpack', 'suitcase', 'duffel', 'hardcase', 'camera_kit', 'wood_crate', 'carton']) assert.ok(ids.includes(id), id);
  for (const id of ['aircraft_logbook', 'wheel_chocks', 'fire_extinguisher', 'first_aid_case', 'fuel_drum', 'jerrycan']) assert.equal(ids.includes(id), false, id);
});

test('composer prompt carries forms only, no asset titles or examples', () => {
  const post = { owner: 'Reporter', description: 'Medienequipment Bergmann', packaging: 'Kamera-Rucksack und Stativ-Case', weightLbs: 24 };
  const text = visual.prompt(post);
  assert.equal(/VFR Multitool|Cardboard/.test(text), false);
  assert.equal(/z\.\s?B\.|zum Beispiel|beispielsweise/i.test(text), false);
  assert.ok(text.includes('"id":"backpack"'));
  assert.equal(visual.prompt(post), text, 'stable order for one description');
});

test('validation enforces catalogue forms, at most three pieces and the manifest weight', () => {
  const post = { description: 'Zwei Koffer', weightLbs: 40 };
  assert.equal(visual.validate({ pieces: [{ form: 'fuel_drum', weightLbs: 40 }] }, post), null);
  assert.equal(visual.validate({ pieces: [] }, post), null);
  assert.equal(visual.validate({ pieces: Array(4).fill({ form: 'suitcase', weightLbs: 10 }) }, post), null);
  const plan = visual.validate({ pieces: [{ form: 'suitcase', weightLbs: 30 }, { form: 'duffel', weightLbs: 30 }] }, post);
  assert.deepEqual(plan.pieces.map(piece => piece.weightLbs), [20, 20]);
  const even = visual.validate({ pieces: [{ form: 'suitcase' }, { form: 'duffel' }] }, post);
  assert.deepEqual(even.pieces.map(piece => piece.weightLbs), [20, 20]);
  assert.ok(visual.planMatches(plan, 'Zwei Koffer (40 lbs)', 40));
  assert.equal(visual.planMatches(plan, 'Andere Taschen', 40), false);
});

test('size follows piece weight and equally fitting variants vary', () => {
  const hardcase = generated.forms.hardcase;
  assert.equal(visual.pickVariant(hardcase, 6, 1).title, 'VFR Multitool Homebase Hardcase Yellow Small');
  assert.equal(visual.pickVariant(hardcase, 90, 1).title, 'VFR Multitool Homebase Flight Case Black');
  assert.equal(visual.pickVariant(hardcase, 500, 1).title, 'VFR Multitool Homebase Flight Case Black');
  const seen = new Set(Array.from({ length: 12 }, (_, seed) => visual.pickVariant(hardcase, 20, seed).title));
  assert.deepEqual([...seen].sort(), ['VFR Multitool Homebase Hardcase Red Pro', 'VFR Multitool Homebase Hardcase Yellow Small']);
  const crate = generated.forms.wood_crate;
  assert.equal(visual.pickVariant(crate, 150, 3).title, 'VFR Multitool Homebase Wood Crate Large');
});

test('resolved pieces stay identical for the same plan (outbound and return)', () => {
  const plan = visual.validate({ pieces: [{ form: 'backpack', weightLbs: 16 }, { form: 'hardcase', weightLbs: 8 }] }, { description: 'Medienequipment', weightLbs: 24 });
  const first = visual.resolve(JSON.parse(JSON.stringify(plan)));
  assert.deepEqual(visual.resolve(plan), first);
  assert.equal(first.length, 2);
  assert.ok(first[1].forwardM > 0);
});

test('composer step keeps a matching plan, attaches a valid one and never throws', async () => {
  const idea = { schema: 'apt-news-idea.v1', passenger: { role: 'Reporterin' }, shipment: { label: 'Medienequipment', weightLbs: 24, packaging: 'Kamera-Rucksack' } };
  let calls = 0;
  const plan = await visual.ensure(idea, async () => { calls++; return { pieces: [{ form: 'backpack', weightLbs: 24 }] }; });
  assert.equal(calls, 1);
  assert.equal(idea.cargoVisual, plan);
  await visual.ensure(idea, async () => { calls++; return {}; });
  assert.equal(calls, 1, 'matching plan is reused');
  const other = { ...idea, shipment: { ...idea.shipment, label: 'Anderes Gepäck' }, cargoVisual: plan };
  assert.equal(await visual.ensure(other, async () => ({ pieces: [{ form: 'fuel_drum' }] })), null);
  assert.equal(other.cargoVisual, plan, 'invalid composer answer leaves the old mapping in charge');
  assert.equal(await visual.ensure({ ...idea, cargoVisual: null }, async () => { throw Error('offline'); }), null);
  assert.equal(await visual.ensure({ schema: 'charter-idea.v1', luggageLabel: 'Kein Gepäck', luggageWeightLbs: 0 }, async () => { throw Error('no call'); }), null);
});

test('manifest item takes the composer pieces only when the plan matches its label', () => {
  const plan = visual.validate({ pieces: [{ form: 'suitcase', weightLbs: 30 }, { form: 'backpack', weightLbs: 12 }] }, { description: 'Rollkoffer und Rucksack', weightLbs: 42 });
  const context = { window: { MissionCargoVisualCore: visual, currentMissionData: { charterIdea: { schema: 'charter-idea.v1', luggageLabel: 'Rollkoffer und Rucksack', luggageWeightLbs: 42, cargoVisual: plan } } } };
  vm.runInNewContext(functionSource('mission-cargo-core.js', '_missionCargoApplyVisualPlan'), context);
  const items = [{ id: 'mission-passenger' }, { id: 'primary-cargo', label: 'Rollkoffer und Rucksack', weightLbs: 42, objectTitle: 'Cardboard' }];
  assert.equal(context._missionCargoApplyVisualPlan(items), true);
  assert.equal(items[1].visualPieces.length, 2);
  assert.equal(items[1].objectTitle, items[1].visualPieces[0].title);
  const stale = [{ id: 'primary-cargo', label: 'Etwas anderes', weightLbs: 42, objectTitle: 'Cardboard' }];
  assert.equal(context._missionCargoApplyVisualPlan(stale), false);
  assert.equal(stale[0].objectTitle, 'Cardboard');
});

test('departure scene spawns every piece with its own object key', () => {
  const pieces = visual.resolve(visual.validate({ pieces: [{ form: 'backpack', weightLbs: 14 }, { form: 'hardcase', weightLbs: 10 }] }, { description: 'Kit', weightLbs: 24 }));
  const context = {
    globalThis: { MissionCargoVisualCore: visual },
    _missionIsFreeflightOnly: () => false,
    _missionCargoEnsureManifest: () => ({ key: 'mission-test', items: [{ id: 'primary-cargo', itemType: 'cargo', status: 'pending', objectTitle: pieces[0].title, sceneKind: 'cargo', visualPieces: pieces }] }),
    _missionCargoIsPassengerItem: () => false,
    _missionCargoStableObjectKey: item => `mission-cargo:mission-test:${item.id}`,
    _missionSceneBoardingCargoCandidates: (_title, candidates) => candidates,
    _missionSceneCargoIsSemanticHomebaseTitle: () => true,
    _missionSceneSafeBoardingCargoTitle: title => title,
    _missionSceneCargoLooksLikeSmallLoosePayload: () => false,
    MISSION_SCENE_ASSET_POOLS: { smallCargo: ['Cardboard'], cargo: ['Cardboard'] },
    Number, String
  };
  const scope = { ...context, context: context.globalThis };
  vm.runInNewContext(functionSource('sync.js', '_missionSceneCargoItems').replace('globalThis.MissionCargoVisualCore', 'context.MissionCargoVisualCore'), scope);
  const items = scope._missionSceneCargoItems({ forwardM: 4, rightM: 4, altOffsetFt: 0 }, { title: 'Cardboard' });
  assert.deepEqual(items.map(item => [item.objectKey, item.objectTitle, item.cargoItemId]), [
    ['mission-cargo:mission-test:primary-cargo', pieces[0].title, 'primary-cargo'],
    ['mission-cargo:mission-test:primary-cargo:p2', pieces[1].title, 'primary-cargo']
  ]);
  assert.ok(items[1].forwardM > items[0].forwardM);
});

test('pickup scene at the target shows the whole luggage group with the keys used later for loading', () => {
  const pieces = visual.resolve(visual.validate({ pieces: [{ form: 'suitcase', weightLbs: 30 }, { form: 'backpack', weightLbs: 12 }] }, { description: 'Rollkoffer und Rucksack', weightLbs: 42 }));
  const scope = {
    context: { MissionCargoVisualCore: visual },
    _missionAptArrivalPreviewItems: plan => plan.items || [],
    _missionCargoEnsureManifest: () => ({ key: 'pickup-test', items: [
      { id: 'pickup-passenger', itemType: 'passenger', pickupLocation: 'target', status: 'pending' },
      { id: 'pickup-companion-cargo', itemType: 'cargo', pickupLocation: 'target', status: 'pending', sceneKind: 'cargo.equipment_case', objectTitle: pieces[0].title, visualPieces: pieces }
    ] }),
    _missionCargoIsPassengerItem: item => item?.itemType === 'passenger',
    _missionBushIsPickupPassengerMission: () => true,
    _missionAptArrivalAssetForItem: item => ({ title: item.objectTitle || item.label, candidates: [item.objectTitle || item.label] }),
    _missionCargoStableObjectKey: item => `mission-cargo:pickup-test:${item.id}`,
    Number, String
  };
  vm.runInNewContext(functionSource('sync.js', '_missionAptArrivalSceneItems').replace('globalThis.MissionCargoVisualCore', 'context.MissionCargoVisualCore'), scope);
  const items = scope._missionAptArrivalSceneItems({ items: [
    { kind: 'arrival_vehicle', label: 'Fahrzeug', role: 'vehicle.car', forwardM: -8, rightM: 6 },
    { kind: 'arrival_person_1', label: 'Gast', role: 'person.ground_crew', forwardM: 2, rightM: 3 },
    { kind: 'arrival_equipment_1', label: 'Gepäck', role: 'cargo.equipment_case', objectTitle: 'Cardboard', forwardM: 3, rightM: 4 }
  ] });
  assert.deepEqual(items.map(item => item.kind), ['arrival_vehicle', 'person_boarder_1', 'arrival_equipment_1', 'arrival_equipment_1_p2']);
  const equipment = items.filter(item => item.cargoItemId === 'pickup-companion-cargo');
  assert.deepEqual(equipment.map(item => [item.objectKey, item.objectTitle]), [
    ['mission-cargo:pickup-test:pickup-companion-cargo', pieces[0].title],
    ['mission-cargo:pickup-test:pickup-companion-cargo:p2', pieces[1].title]
  ]);
  assert.deepEqual(equipment.map(item => item.objectKey), visual.pieceObjectKeys('mission-cargo:pickup-test:pickup-companion-cargo', { visualPieces: pieces }),
    'pickup load removes exactly the keys spawned at the target');
  assert.equal(equipment[0].forwardM, 3);
});
