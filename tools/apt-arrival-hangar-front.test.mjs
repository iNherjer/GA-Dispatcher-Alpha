import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { declaration } from './gemini-migration-harness.mjs';
// Real OSM geometry of two small GA fields (captured 21.10.2026). Both have
// mapped aprons and hangars; an arrival scene must never fall back there.
const core = fs.readFileSync(new URL('../mission-arrival-core.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const fixture = name => JSON.parse(fs.readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8'));
function airport(file, dest) {
  const c = vm.createContext({ window: {}, console, Map });
  vm.runInContext(core, c);
  for (const name of ['scenePlannerV3CleanText', 'scenePlannerV3PreferredAptPlacement', 'sanitizeScenePlannerV3AptArrivalPlan', 'scenePlannerV3CompactAptPlan']) {
    vm.runInContext(declaration(app, name), c);
  }
  c.normalizeAptArrivalRole = () => ({ role: 'media_pickup', personRole: 'person.ground_crew', vehicleRole: 'vehicle.van' });
  c.normalizeMissionType = () => 'apt';
  const plan = c.buildAptArrivalPlan({ dest, heading: 75 });
  const geo = c.normalizeAptArrivalGeoContext(fixture(file), plan.airportLat, plan.airportLon);
  c.fetchAptArrivalGeoContext = async () => geo;
  return { c, plan, geo };
}
const hangarDistanceM = (c, geo, p) => Math.min(...c.aptArrivalHangars(geo).map(h => c.aptArrivalPointLineDistanceM(p, h.polygon)));

for (const [icao, file, dest, minRunwayM] of [
  ['EDTW', 'arrival-edtw-osm-20261021.json', { lat: 48.27917, lon: 8.42833, icao: 'EDTW' }, 100],
  ['EDTQ', 'arrival-edtq-osm-20261021.json', { lat: 48.8641662598, lon: 9.2247219086, icao: 'EDTQ' }, 45]
]) {
  test(`${icao}: mapped apron and hangars give a checked spot in front of a hangar, never a fallback`, async () => {
    const { c, plan, geo } = airport(file, dest);
    const resolved = await c.resolveAptArrivalPlanPlacement(plan);
    assert.equal(resolved.snapStatus.spawnAllowed, true);
    assert.equal(resolved.source, 'osm_hangar_front');
    assert.ok(hangarDistanceM(c, geo, resolved) <= 25, 'directly in front of a hangar');
    assert.ok(c.aptArrivalRunwayDistanceM(geo, resolved) >= minRunwayM, 'not beside the runway');
    assert.deepEqual(Array.from(c.aptArrivalFinalPlacementIssues(resolved)), []);
    assert.ok(resolved.placementCandidates.hangarFront.length >= 4, 'several distinct spots for the composer');
    assert.ok(resolved.placementCandidates.apron.length >= 1, 'released apron spots stay offered');
    const finalized = c.finalizeAptArrivalComposerPlan(resolved);
    assert.ok(finalized.placementCandidates.hangarFront.length >= 4);
  });
}

test('EDTQ: the reception is not placed at the rescue helicopter hangar for a reporter pickup', async () => {
  const { c, plan, geo } = airport('arrival-edtq-osm-20261021.json', { lat: 48.8641662598, lon: 9.2247219086, icao: 'EDTQ' });
  const resolved = await c.resolveAptArrivalPlanPlacement(plan);
  const rescue = c.aptArrivalHangars(geo).find(h => h.id === 'way/82314464');
  assert.match(rescue.tags.operator, /Luftrettung/);
  assert.notEqual(resolved.osmPlacement.sourceId, rescue.id);
  // Nearest hangar decides: the spot must not stand at the rescue hangar's door either.
  const nearest = c.aptArrivalHangars(geo).map(h => [h.id, c.aptArrivalPointLineDistanceM(resolved, h.polygon)]).sort((a, b) => a[1] - b[1])[0];
  assert.notEqual(nearest[0], rescue.id);
});

test('reachable spots: the chosen hangar front is close to a taxiway', async () => {
  for (const [file, dest, maxTaxiwayM] of [
    ['arrival-edtw-osm-20261021.json', { lat: 48.27917, lon: 8.42833, icao: 'EDTW' }, 30],
    ['arrival-edtq-osm-20261021.json', { lat: 48.8641662598, lon: 9.2247219086, icao: 'EDTQ' }, 30]
  ]) {
    const { c, plan, geo } = airport(file, dest);
    const resolved = await c.resolveAptArrivalPlanPlacement(plan);
    assert.ok(c.aptArrivalReleaseIndex(geo).taxiwayDistanceM(resolved) <= maxTaxiwayM, dest.icao);
  }
});

test('the composer may choose another offered hangar front and the App validates it', async () => {
  const { c, plan } = airport('arrival-edtw-osm-20261021.json', { lat: 48.27917, lon: 8.42833, icao: 'EDTW' });
  const resolved = await c.resolveAptArrivalPlanPlacement(plan);
  const index = resolved.placementCandidates.hangarFront.length - 1;
  const chosen = resolved.placementCandidates.hangarFront[index];
  const result = c.sanitizeScenePlannerV3AptArrivalPlan({ preferredPlacement: { source: 'osm_hangar_front', index, reason: 'Vereinshangar' },
    headingDeg: resolved.hdg, items: resolved.items }, resolved);
  assert.equal(result.lat, chosen.lat);
  assert.equal(result.source, 'osm_hangar_front');
  assert.equal(result.snapStatus.finalLayoutValidated, true);
});

test('released areas: hangar front overrides a crossing taxiway, an apron keeps 4 m, runway and buildings always block', () => {
  const c = vm.createContext({ window: {}, console, Map });
  vm.runInContext(core, c);
  const at = (east, north) => c.offsetAptArrivalLatLon(48, 8, 0, north, east);
  const rect = (x1, y1, x2, y2) => [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]].map(([x, y]) => at(x, y));
  const hangar = { type: 'building', buildingType: 'hangar', id: 'h', polygon: rect(-20, 40, 20, 60), center: at(0, 50), tags: {} };
  const runway = { type: 'runway', id: 'rw', widthM: 20, line: [at(-300, -60), at(300, -60)], polygon: [], bufferM: 30 };
  const taxiway = { type: 'taxiway', id: 'tw', line: [at(-100, 30), at(100, 30)], polygon: [], bufferM: 18 };
  const ctx = { aprons: [{ id: 'apron', polygon: rect(60, -20, 140, 50) }], avoidZones: [hangar, runway, taxiway],
    airportBoundaries: [], parkingPositions: [], surfaces: [] };
  assert.equal(c.aptArrivalHangarFrontOf(ctx, at(0, 30))?.id, 'h', 'runway-facing side');
  assert.equal(c.aptArrivalHangarFrontOf(ctx, at(0, 75)), null, 'land side behind the hangar');
  assert.equal(c.aptArrivalScenePointIssue(ctx, at(0, 30), 2), null, 'taxiway across the hangar front is released');
  assert.ok(c.aptArrivalScenePointIssue(ctx, at(100, 32), 2)?.zone?.type === 'taxiway', 'apron keeps 4 m to the taxiway centre');
  assert.equal(c.aptArrivalScenePointIssue(ctx, at(100, 45), 2), null, 'apron away from the taxiway');
  assert.ok(c.aptArrivalScenePointIssue(ctx, at(0, 50), 2)?.zone?.type === 'building', 'inside the hangar');
  assert.equal(c.aptArrivalReleasedAreaBlock(ctx, at(0, -48), 2, 'hangar_front')?.type, 'runway', 'runway surface + 3 m');
});

function bushStrip(file, dest) {
  const c = vm.createContext({ window: {}, console, Map });
  vm.runInContext(fs.readFileSync(new URL('../mission-definition-core.js', import.meta.url), 'utf8'), c);
  vm.runInContext(core, c);
  c.normalizeMissionType = () => 'bush';
  c.normalizeAptArrivalRole = () => ({ role: 'bush_strip_pickup', personRole: 'person.ground_crew', vehicleRole: 'vehicle.utility', equipmentRole: 'cargo.equipment_case' });
  const plan = c.buildAptArrivalPlan({ dest, heading: 75, missionType: 'bush', bushSpec: { targetMode: 'strip_then_return', pickupKind: 'passenger' } });
  const geo = c.normalizeAptArrivalGeoContext(fixture(file), dest.lat, dest.lon, 1400, { stripHandoff: true });
  c.fetchAptArrivalGeoContext = async () => geo;
  return { c, plan, geo };
}

test('Big Creek: blocked runway ends no longer force the unchecked offset; pickup waits at the runway edge by the hut', async () => {
  const { c, plan, geo } = bushStrip('arrival-bigcreek-osm-20261021.json', { lat: 45.133243, lon: -115.321779, icao: 'U60' });
  const resolved = await c.resolveAptArrivalPlanPlacement(plan);
  assert.equal(resolved.source, 'osm_runway_side');
  assert.ok(resolved.osmPlacement.contextMatch.includes('by_building'));
  const hut = geo.avoidZones.find(z => z.id === 'way/288606960');
  assert.ok(c.aptArrivalPointLineDistanceM(resolved, hut.polygon) <= 30, 'next to the south-east hut');
  const runway = geo.avoidZones.find(z => z.type === 'runway');
  const lateralM = c.aptArrivalPointLineDistanceM(resolved, c.aptArrivalZoneGeometry(runway));
  assert.ok(lateralM >= runway.bufferM && lateralM <= runway.bufferM + 25, 'at the edge of the runway clearance');
});

test('Soldier Bar: strip without buildings keeps the runway-end side spot', async () => {
  const { c, plan } = bushStrip('arrival-soldierbar-osm-20261021.json', { lat: 45.099914, lon: -114.800929, icao: 'SOLDIER' });
  const resolved = await c.resolveAptArrivalPlanPlacement(plan);
  assert.equal(resolved.source, 'osm_runway_side');
  assert.equal(resolved.snapStatus.spawnAllowed, true);
  assert.ok(Math.abs(resolved.lat - 45.104126) < 0.0002 && Math.abs(resolved.lon + 114.801534) < 0.0002);
});

test('EDDS: a large airport resolves in time at a business aviation hangar front', async () => {
  const { c, plan, geo } = airport('arrival-edds-osm-20261021.json', { lat: 48.6898994446, lon: 9.2219600677, icao: 'EDDS' });
  const started = Date.now();
  const resolved = await c.resolveAptArrivalPlanPlacement(plan);
  assert.ok(Date.now() - started < 5000, 'placement stays fast with thousands of blockers');
  assert.equal(resolved.source, 'osm_hangar_front');
  assert.match(c.aptArrivalHangars(geo).find(h => h.id === resolved.osmPlacement.sourceId).tags.operator, /Aviation/);
  assert.deepEqual(Array.from(c.aptArrivalFinalPlacementIssues(resolved)), []);
});

test('EDDS: mapped GA area (GAT, GA aprons) decides the pickup spot, not chance', async () => {
  const { c, plan, geo } = airport('arrival-edds-osm-20261021.json', { lat: 48.6898994446, lon: 9.2219600677, icao: 'EDDS' });
  const index = c.aptArrivalReleaseIndex(geo);
  assert.ok(index.gaAnchors.length >= 2, 'GAT and GA aprons are recognised');
  const resolved = await c.resolveAptArrivalPlanPlacement(plan);
  assert.ok(index.gaDistanceM(resolved) <= 50, 'pickup at the general aviation area');
});

test('of two equal hangars the one at the general aviation terminal wins', () => {
  const c = vm.createContext({ window: {}, console, Map });
  vm.runInContext(core, c);
  const at = (east, north) => c.offsetAptArrivalLatLon(48, 8, 0, north, east);
  const rect = (x1, y1, x2, y2) => [[x1, y1], [x2, y1], [x2, y2], [x1, y2], [x1, y1]].map(([x, y]) => at(x, y));
  const hangar = (id, x) => ({ type: 'building', buildingType: 'hangar', id, polygon: rect(x - 20, 40, x + 20, 60), center: at(x, 50), radiusM: 25, distM: Math.abs(x), tags: {} });
  const gat = { type: 'building', buildingType: 'transportation', id: 'gat', polygon: rect(330, 40, 360, 60), center: at(345, 50), radiusM: 20, tags: { name: 'General Aviation Terminal', shortName: 'GAT' } };
  const ctx = { aprons: [], parkingPositions: [], surfaces: [], airportBoundaries: [],
    avoidZones: [hangar('far', -300), hangar('near', 300), gat, { type: 'runway', id: 'rw', widthM: 30, line: [at(-800, -80), at(800, -80)], polygon: [], bufferM: 35 }] };
  const plan = { airportLat: 48, airportLon: 8, hdg: 0, role: 'media_pickup', items: [{ kind: 'arrival_vehicle', forwardM: -7, rightM: 5 }] };
  const best = c.aptArrivalHangarFrontCandidates(ctx, plan)[0];
  assert.equal(best.sourceId, 'near');
  ctx.avoidZones[2] = { ...gat, tags: {} };
  const neutral = c.aptArrivalHangarFrontCandidates(JSON.parse(JSON.stringify(ctx)), plan);
  assert.ok(neutral.some(x => x.sourceId === 'far'), 'without a GA anchor both hangars stay equal candidates');
});
