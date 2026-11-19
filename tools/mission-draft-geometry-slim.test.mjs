import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { declaration } from './gemini-migration-harness.mjs';
// Entwuerfe speichern die OSM-Platzdaten nicht mit (EDDS: 2,1 MB je Kopie, 16.11.2026).
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const c = vm.createContext({});
vm.runInContext(declaration(app, 'slimMissionDraftGeometry'), c);
const geometry = { schema: 'apt-arrival-geometry.v2', aprons: [{ id: 'way/1' }] };
const plan = () => ({ role: 'charter_pickup', lat: 48.02185, lon: 7.83587, source: 'osm_hangar_front', snapStatus: { status: 'resolved' }, placementGeometry: geometry });
const state = () => ({
    currentMissionData: { missionId: 'm1', aptArrivalPlan: plan(), missionContract: { aptArrivalPlan: plan(), taskDomain: 'charter' } },
    activeMissionContract: { aptArrivalPlan: plan() },
    activePassenger: { name: 'Holger' }
});

test('draft copy drops placement geometry in mission, contract and active contract', () => {
    const live = state();
    const slim = c.slimMissionDraftGeometry(live);
    assert.equal(slim.currentMissionData.aptArrivalPlan.placementGeometry, undefined);
    assert.equal(slim.currentMissionData.missionContract.aptArrivalPlan.placementGeometry, undefined);
    assert.equal(slim.activeMissionContract.aptArrivalPlan.placementGeometry, undefined);
    // Platzwahl, Snap-Status und alles andere bleiben.
    assert.equal(slim.currentMissionData.aptArrivalPlan.source, 'osm_hangar_front');
    assert.equal(slim.currentMissionData.aptArrivalPlan.lat, 48.02185);
    assert.equal(slim.currentMissionData.missionContract.taskDomain, 'charter');
    assert.equal(slim.activePassenger.name, 'Holger');
    assert.ok(JSON.stringify(slim).length < JSON.stringify(live).length);
});

test('the running mission keeps its geometry (no mutation)', () => {
    const live = state();
    c.slimMissionDraftGeometry(live);
    assert.equal(live.currentMissionData.aptArrivalPlan.placementGeometry, geometry);
    assert.equal(live.currentMissionData.missionContract.aptArrivalPlan.placementGeometry, geometry);
    assert.equal(live.activeMissionContract.aptArrivalPlan.placementGeometry, geometry);
});

test('states without geometry pass unchanged', () => {
    const s = { currentMissionData: { missionId: 'poi', poiName: 'Burg' } };
    assert.equal(JSON.stringify(c.slimMissionDraftGeometry(s)), JSON.stringify(s));
    assert.equal(c.slimMissionDraftGeometry(null), null);
});

test('draft saves go through the slimming and accept re-resolves missing geometry', () => {
    assert.match(app, /window\.gaStoreMissionDraft = state => missionDraftSession\(\)\.save\(slimMissionDraftGeometry\(state\)\);/);
    assert.match(app, /if \(!isPOI && contextBase\.aptArrivalPlan && !contextBase\.aptArrivalPlan\.placementGeometry\) \{\n\s+contextBase\.aptArrivalPlan = await resolveAptArrivalPlanPlacement\(contextBase\.aptArrivalPlan\);/);
});
