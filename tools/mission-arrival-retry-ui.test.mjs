import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { declaration } from './gemini-migration-harness.mjs';
// Entwurf mit fehlgeschlagenem OSM-Abruf: Neuversuch an Stelle von „Mission akzeptieren“ (Feldtest 15.11.2026).
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function el() { return { style: {}, disabled: false, textContent: '', hidden: false, classList: { set: new Set(), toggle(n, on) { on ? this.set.add(n) : this.set.delete(n); }, contains(n) { return this.set.has(n); } } }; }
function setup(resolver) {
  const dom = { missionAcceptPanel: el(), missionAcceptBtn: el(), missionAcceptText: el(), missionDraftCloudNotice: el(), missionRejectBtn: el(), missionArrivalRetryBtn: el() };
  const failedPlan = { role: 'charter_pickup', lat: 48.02316, lon: 7.83258, source: 'airport-representative-offset',
    snapStatus: { status: 'unavailable', spawnAllowed: false, reason: 'overpass_unavailable', geoFetchFailed: true } };
  const c = vm.createContext({ console, document: { getElementById: id => dom[id] || null },
    sanitizeMissionSceneIntentSpec: () => ({ summary: 'Charter-Abholung' }),
    resolveAptArrivalPlanPlacement: resolver,
    attachAptArrivalPlanToMissionTruth: (truth, plan) => ({ ...(truth || {}), arrivalScene: plan }) });
  c.window = c;
  c.gaMissionDraftActive = () => true;
  c.gaMissionDraftPhase = () => 'ready';
  for (const name of ['updateMissionAcceptanceUi', 'missionArrivalGeoFetchFailed', 'retryMissionArrivalPlacement']) vm.runInContext(declaration(app, name), c);
  vm.runInContext('var currentMissionData = null;', c);
  c.currentMissionData = { sceneAccepted: false, aptArrivalPlan: failedPlan, missionContract: { aptArrivalPlan: failedPlan } };
  return { c, dom };
}

test('failed OSM fetch shows the notice and puts the retry button in front of accept', () => {
  const { c, dom } = setup(async () => null);
  c.updateMissionAcceptanceUi();
  assert.equal(dom.missionArrivalRetryBtn.style.display, '');
  assert.match(dom.missionAcceptText.textContent, /OSM-Server antwortet nicht.*Abholfahrzeug zu deinem Flugzeug/);
  assert.equal(dom.missionAcceptBtn.textContent, 'Ohne Empfangsszene akzeptieren');
  assert.ok(dom.missionAcceptBtn.classList.contains('mission-reject-btn'));
});

test('a successful forced retry stores the checked place and restores the normal accept button', async () => {
  let opts = null;
  const { c, dom } = setup(async (plan, o) => { opts = o; return { ...plan, source: 'osm_apron', lat: 48.0236, lon: 7.8331, placementGeometry: {},
    snapStatus: { status: 'resolved', spawnAllowed: true, reason: 'no_osm_parking_position_use_apron' } }; });
  assert.equal(await c.retryMissionArrivalPlacement(), true);
  assert.equal(opts.force, true);
  assert.equal(c.currentMissionData.aptArrivalPlan.source, 'osm_apron');
  assert.equal(c.currentMissionData.missionContract.aptArrivalPlan.source, 'osm_apron');
  assert.equal(c.currentMissionData.missionTruth.arrivalScene.source, 'osm_apron');
  assert.equal(dom.missionArrivalRetryBtn.style.display, 'none');
  assert.equal(dom.missionAcceptBtn.textContent, 'Mission akzeptieren');
  assert.match(dom.missionAcceptText.textContent, /^Lokaler Entwurf/);
});

test('a failed retry counts the attempt and keeps offering it', async () => {
  const { c, dom } = setup(async plan => ({ ...plan, snapStatus: { ...plan.snapStatus, geoFetchFailed: true } }));
  assert.equal(await c.retryMissionArrivalPlacement(), false);
  assert.match(dom.missionAcceptText.textContent, /Versuch 1 ohne Erfolg/);
  assert.equal(dom.missionArrivalRetryBtn.disabled, false);
});
