'use strict';
// Gemeinsamer Homebase-Szenen-Kern (App + Tracker) und die Entscheidung der
// App, wann der Tracker die Szene selbst aus der Cloud baut.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repo = path.join(__dirname, '..');
const catalog = require(path.join(repo, 'homebase/homebase-asset-catalog.js'));
const coreApi = require(path.join(repo, 'homebase-scene-core.js'));
const core = coreApi.createHomebaseSceneCore({ catalog });

const hangarTitle = catalog.assets.find((entry) => entry.kind === 'hangar')?.title || 'VFR Multitool Homebase Hangar';
const objectTitle = catalog.assets.find((entry) => entry.kind !== 'hangar' && entry.persistentOnly !== true && entry.preview !== false)?.title;
const personTitle = catalog.tarmacPeople?.[0]?.title;

function samplePlan(extra = {}) {
  return {
    spawn: { lat: 48.2792, lon: 8.4283, altFt: 2201, heading: 168 },
    hangar: { objectTitle: hangarTitle, northM: 12, eastM: -4, heading: 170, widthM: 18, depthM: 22, heightFt: 0 },
    objects: [
      { id: 'obj-a', title: objectTitle, label: 'Kiste', northM: 3, eastM: 2, heading: 45, heightFt: 0, scale: 1 },
      { id: 'obj-b', title: objectTitle, northM: -6, eastM: 9.5, heading: 400, heightFt: 0.5, scale: 1.2 }
    ],
    people: [{ id: 'p1', title: personTitle, randomTargets: true, randomWaitMinS: 4, randomWaitMaxS: 20, speedKts: 2.6 }],
    controlStates: [{ instanceId: 'door-1', title: hangarTitle, controlId: 'door', stateId: 'open' }],
    doorAutomationEnabled: true,
    ...extra
  };
}

test('Kern baut Szene deterministisch; Signatur ist stabil (Referenzwert)', () => {
  const first = core.sceneFromCloudRecord({ plan: samplePlan() }, { sceneInstalled: false });
  const second = core.sceneFromCloudRecord(JSON.parse(JSON.stringify({ plan: samplePlan() })), { sceneInstalled: false });
  assert.equal(first.ok, true);
  assert.deepEqual(first.payload, second.payload);
  assert.equal(first.payload.objects.length, 3, 'Hangar + zwei Objekte');
  assert.equal(first.payload.people.length, 1);
  assert.equal(first.payload.base.enterRadiusNm, 20);
  assert.equal(first.payload.base.exitRadiusNm, 22);
  assert.match(first.payload.sceneSignature, /^hb1-[0-9a-f]{8}-\d+$/);
  // Aendert sich diese Zeile, erzeugen App und alte Zwischenspeicher eine andere
  // Signatur: dann wird beim ersten Start einmal komplett neu aufgebaut.
  const serialized = JSON.stringify({ objects: first.payload.objects, people: first.payload.people, navigation: first.payload.navigation });
  assert.equal(first.payload.sceneSignature, coreApi.compactSceneSignature(serialized));
});

test('installierter Mod: nur abweichende Objekte werden live ergaenzt', () => {
  const plan = samplePlan();
  const installed = core.sanitizeRuntimeConfig(core.runtimeConfigFromPlan({ ...plan, objects: [plan.objects[0]] }));
  const result = core.sceneFromCloudRecord({ plan }, { sceneInstalled: true, snapshotTrusted: true, installedSnapshot: { config: installed } });
  assert.equal(result.ok, true);
  assert.deepEqual(result.payload.objects.map((item) => item.id), ['obj-b']);
  assert.equal(result.delta.stats.compiled, 2);
  const untrusted = core.sceneFromCloudRecord({ plan }, { sceneInstalled: true, snapshotTrusted: false });
  assert.equal(untrusted.ok, false);
  assert.equal(untrusted.reason, 'snapshot-missing');
});

test('ungueltige Plaene liefern keinen Stand', () => {
  assert.equal(core.sceneFromCloudRecord(null, null).reason, 'no-plan');
  assert.equal(core.sceneFromCloudRecord({ plan: { spawn: { lat: 'x', lon: 8 }, hangar: {} } }, null).reason, 'plan-invalid');
});

test('App nutzt den Kern statt eigener Kopien', () => {
  const app = fs.readFileSync(path.join(repo, 'homebase-integration.js'), 'utf8');
  assert.match(app, /function ownRuntimeConfigFromPlan\(plan\) \{ return homebaseScene\.runtimeConfigFromPlan\(plan\); \}/);
  assert.match(app, /return homebaseScene\.sceneDelta\(currentOwnRuntimeConfig\(\), ownPackageStatus\);/);
  assert.match(app, /return homebaseScene\.fallbackPayload\(currentOwnRuntimeConfig\(\), ownHomebaseDelta\(\)\);/);
  assert.doesNotMatch(app, /const hangarWalls = /, 'keine zweite Kopie der Szenenrechnung');
  const html = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
  assert.ok(html.indexOf('homebase-scene-core.js') < html.indexOf('homebase-integration.js'));
  assert.ok(html.indexOf('homebase/homebase-asset-catalog.js') < html.indexOf('homebase-scene-core.js'));
  assert.match(fs.readFileSync(path.join(repo, 'sw.js'), 'utf8'), /'\.\/homebase-scene-core\.js'/);
});

// Entscheidungslogik der App, extrahiert aus homebase-integration.js.
function appGate({ capabilities = ['homebase-cloud-scene-v1'], status = 'ok', draftDirty = false, metaDirty = false, syncEnabled = true } = {}) {
  const source = fs.readFileSync(path.join(repo, 'homebase-integration.js'), 'utf8');
  const extract = (name) => {
    const start = source.indexOf(`  function ${name}(`);
    const end = source.indexOf('\n  }\n', start);
    assert.ok(start >= 0 && end > start, name);
    return source.slice(start, end + 4);
  };
  const sent = [];
  const context = {
    TRACKER_CLOUD_SCENE_CAPABILITY: 'homebase-cloud-scene-v1',
    HOMEBASE_SYNC_META_KEY: 'meta',
    latestHomebaseDraft: { dirty: draftDirty },
    ownLastTelemetry: { homebase: { capabilities, cloudScene: { status } } },
    readJsonStorage: () => ({ dirty: metaDirty }),
    getHomebaseSyncContext: () => ({ enabled: syncEnabled }),
    sendTracker: (command) => { sent.push(command); return 'id'; }
  };
  vm.createContext(context);
  vm.runInContext(['ownDraftDirty', 'ownTrackerCloudCapable', 'ownTrackerOwnsScene', 'requestTrackerCloudRefresh'].map(extract).join('\n'), context);
  return { context, sent };
}

test('Tracker baut selbst, solange er einen Cloud-Stand hat und kein Entwurf offen ist', () => {
  for (const status of ['idle', 'loading', 'ok']) assert.equal(appGate({ status }).context.ownTrackerOwnsScene(), true, status);
  for (const status of ['empty', 'legacy', 'error', '']) assert.equal(appGate({ status }).context.ownTrackerOwnsScene(), false, status);
  assert.equal(appGate({ capabilities: [] }).context.ownTrackerOwnsScene(), false, 'alter Tracker');
  assert.equal(appGate({ draftDirty: true }).context.ownTrackerOwnsScene(), false, 'offener Entwurf');
  assert.equal(appGate({ metaDirty: true }).context.ownTrackerOwnsScene(), false, 'ungespeicherter Stand');
  assert.equal(appGate({ syncEnabled: false }).context.ownTrackerOwnsScene(), false, 'rein lokale Homebase');
});

test('Neu laden beim Tracker: nur mit Faehigkeit, Entwurfsstatus wird mitgeschickt', () => {
  const capable = appGate({ draftDirty: true });
  assert.equal(capable.context.requestTrackerCloudRefresh('app-save', { draftDirty: false }), true);
  assert.deepEqual(JSON.parse(JSON.stringify(capable.sent[0])), { type: 'homebase_v1.cloud.refresh', reason: 'app-save', draftDirty: false });
  const old = appGate({ capabilities: [] });
  assert.equal(old.context.requestTrackerCloudRefresh('app-save'), false);
  assert.equal(old.sent.length, 0);
});
