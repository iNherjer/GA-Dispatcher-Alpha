'use strict';
// Tracker laedt die eigene Homebase selbst aus der Cloud (homebase-cloud-scene-v1).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHomebaseCloudScene, CAPABILITY } = require('./tracker-homebase-cloud.js');
const coreApi = require('../homebase-scene-core.js');
const catalog = require('../homebase/homebase-asset-catalog.js');

const hangarTitle = catalog.assets.find((entry) => entry.kind === 'hangar')?.title;
const objectTitle = catalog.assets.find((entry) => entry.kind !== 'hangar' && entry.persistentOnly !== true && entry.preview !== false)?.title;
const plan = {
  spawn: { lat: 48.2792, lon: 8.4283, altFt: 2201, heading: 168 },
  hangar: { objectTitle: hangarTitle, northM: 12, eastM: -4, heading: 170 },
  objects: [{ id: 'obj-a', title: objectTitle, northM: 3, eastM: 2, heading: 45 }],
  people: [{ id: 'p1', title: catalog.tarmacPeople?.[0]?.title, randomTargets: true }]
};
const record = (extra = {}) => ({ schemaVersion: 2, revision: 'rev-7', plan, ...extra });
const reply = (status, data) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => data });

function fixture(options = {}) {
  const stored = [], logs = [], timers = [], requests = [];
  let cache = options.cache || null;
  let clock = 1000;
  const cloud = createHomebaseCloudScene({
    pilotId: 'DEINA', pin: '1234', log: line => logs.push(line), now: () => clock,
    setTimeout: (fn, ms) => { const timer = { fn, ms, unref() {} }; timers.push(timer); return timer; },
    clearTimeout: timer => { const index = timers.indexOf(timer); if (index >= 0) timers.splice(index, 1); },
    getPackageStatus: options.getPackageStatus || (() => ({ sceneInstalled: false })),
    getCurrentCache: () => cache,
    storeCache: options.storeCache || ((payload, meta) => { stored.push({ payload, meta }); cache = payload; return { ok: true }; }),
    request: async (url, init) => { requests.push({ url, init }); return (options.request || reply(200, { ok: true, record: record() }))(url, init); },
    initialWaitMs: 8000,
    ...options.extra
  });
  return { cloud, stored, logs, timers, requests, advance: ms => { clock += ms; }, getCache: () => cache };
}

test('Cloud-Stand wird mit dem gemeinsamen Kern gebaut und im Tracker gespeichert', async () => {
  const x = fixture();
  assert.equal(x.cloud.available, true);
  assert.equal(x.cloud.capability, CAPABILITY);
  assert.equal(x.cloud.initialSettled(), false);
  assert.equal(x.cloud.ownsScene(), true, 'vor dem ersten Abruf wartet die App');
  const state = await x.cloud.refresh('start');
  assert.equal(state.status, 'ok');
  assert.equal(state.revision, 'rev-7');
  assert.equal(x.requests[0].url, 'https://ga-proxy.einherjer.workers.dev/api/homebase/DEINA');
  assert.deepEqual(x.requests[0].init.headers, { 'X-Pilot-ID': 'DEINA', 'X-Pilot-PIN': '1234' });
  const expected = coreApi.createHomebaseSceneCore({ catalog }).sceneFromCloudRecord(record(), { sceneInstalled: false }).payload;
  assert.deepEqual(x.stored[0].payload, expected, 'identisch mit dem App-Aufbau');
  assert.equal(x.stored[0].meta.source, 'cloud');
  assert.equal(state.sceneSignature, expected.sceneSignature);
  assert.equal(x.cloud.initialSettled(), true);
  assert.equal(x.timers.at(-1).ms, 15 * 60 * 1000, 'naechster Abgleich in 15 min');
  assert.match(x.logs.join('\n'), /HOMEBASE_CLOUD_SCENE reason=start revision=rev-7 .*changed=1/);
});

test('unveraenderter Stand wird nicht neu geschrieben', async () => {
  const x = fixture();
  await x.cloud.refresh('start');
  await x.cloud.refresh('timer');
  assert.equal(x.stored.length, 1);
  assert.match(x.logs.at(-1), /changed=0/);
});

test('keine Homebase in der Cloud oder alter Datensatz: App bleibt zustaendig, Zwischenspeicher bleibt', async () => {
  const empty = fixture({ cache: { sceneSignature: 'app-local' }, request: reply(404, { error: 'Keine Homebase gespeichert' }) });
  assert.equal((await empty.cloud.refresh('start')).status, 'empty');
  assert.equal(empty.cloud.ownsScene(), false);
  assert.equal(empty.stored.length, 0);
  assert.equal(empty.getCache().sceneSignature, 'app-local');
  const legacy = fixture({ request: reply(200, { ok: true, record: record({ schemaVersion: 1 }) }) });
  assert.equal((await legacy.cloud.refresh('start')).status, 'legacy');
  assert.equal(legacy.cloud.ownsScene(), false);
  assert.equal(legacy.stored.length, 0);
});

test('Fehler: falsche PIN, Netzwerk, kaputte Antwort -> Stand bleibt, App uebernimmt, neuer Versuch nach 60 s', async () => {
  for (const [request, code] of [
    [reply(401, { error: 'PIN falsch' }), 'cloud_unauthorized'],
    [async () => { throw new Error('ENOTFOUND'); }, 'cloud_unavailable'],
    [reply(502, { error: 'KV' }), 'cloud_status'],
    [reply(200, { ok: true, record: { schemaVersion: 2 } }), '']
  ]) {
    const x = fixture({ cache: { sceneSignature: 'old' }, request });
    const state = await x.cloud.refresh('start');
    if (code) {
      assert.equal(state.status, 'error', code);
      assert.equal(state.code, code);
      assert.equal(x.cloud.ownsScene(), false);
      assert.equal(x.timers.at(-1).ms, 60000);
    } else {
      assert.equal(state.status, 'empty', 'Datensatz ohne Plan');
    }
    assert.equal(x.stored.length, 0);
    assert.equal(x.getCache().sceneSignature, 'old');
    assert.equal(x.cloud.initialSettled(), true, 'Fehler blockiert den Start nicht');
  }
});

test('installierter Mod ohne Vergleichsstand: kein halber Aufbau', async () => {
  const x = fixture({ getPackageStatus: () => ({ sceneInstalled: true, snapshotTrusted: false }) });
  const state = await x.cloud.refresh('start');
  assert.equal(state.status, 'error');
  assert.equal(state.code, 'snapshot-missing');
  assert.equal(x.stored.length, 0);
  const broken = fixture({ getPackageStatus: () => { throw new Error('community folder'); } });
  assert.equal((await broken.cloud.refresh('start')).code, 'package_status_failed');
});

test('offener App-Entwurf wird nicht vom Cloud-Abgleich ueberschrieben', async () => {
  const x = fixture({ storeCache: () => ({ ok: true, skipped: true, reason: 'app_draft_active' }) });
  const state = await x.cloud.refresh('timer');
  assert.equal(state.status, 'ok');
  assert.equal(state.code, 'app_draft_active');
  assert.match(x.logs.join('\n'), /HOMEBASE_CLOUD_DEFERRED reason=timer code=app_draft_active/);
});

test('gleichzeitige Abrufe teilen sich eine Anfrage; ohne Zugangsdaten passiert nichts', async () => {
  const x = fixture();
  const [a, b] = await Promise.all([x.cloud.refresh('a'), x.cloud.refresh('b')]);
  assert.equal(x.requests.length, 1);
  assert.deepEqual(a, b);
  const none = createHomebaseCloudScene({ pilotId: '', pin: '', getPackageStatus: () => ({}), storeCache: () => ({ ok: true }) });
  assert.equal(none.available, false);
  assert.equal(none.ownsScene(), false);
  assert.equal(none.initialSettled(), true);
  assert.equal((await none.refresh('x')).status, 'idle');
});

test('Startsperre fuer den alten Zwischenspeicher endet spaetestens nach 8 s', () => {
  const x = fixture({ request: () => new Promise(() => {}) });
  void x.cloud.refresh('start');
  assert.equal(x.cloud.initialSettled(), false);
  x.advance(8000);
  assert.equal(x.cloud.initialSettled(), true);
});

test('Tracker-Verdrahtung: Startsperre, Unterdrueckung, Faehigkeit, Entwurfsvorrang', () => {
  const source = fs.readFileSync(path.join(__dirname, 'tracker.js'), 'utf8');
  assert.match(source, /if \(homebaseCloud && !homebaseCloud\.initialSettled\(\)\) return;/);
  assert.match(source, /if \(shouldBeActive && homebaseCloud\?\.suppressed\(\)\)/);
  assert.match(source, /homebaseCloud\?\.clearSuppression\(\);/);
  assert.match(source, /\.\.\.\(homebaseCloud\?\.available \? \[homebaseCloud\.capability\] : \[\]\),\s*\.\.\.\(homebaseCloud\?\.crew \? \[homebaseCloud\.crew\.capability\] : \[\]\)/);
  assert.match(source, /cloudScene: homebaseCloud\.publicState\(\)/);
  assert.match(source, /_homebaseAppDraftActive = command\?\.draftDirty === true;/);
  assert.match(source, /storeCache: \(payload, meta\) => \(_homebaseAppDraftActive/);
  assert.match(source, /if \(command\?\.draftDirty !== true\) _homebaseAppDraftActive = false;/);
  assert.match(source, /missionTransfer, getCloudAuthoritySnapshot, getHomebaseCloud\), 5000\);/);
  assert.equal((source.match(/getCloudAuthoritySnapshot, getHomebaseCloud\), 5000\)/g) || []).length, 2, 'Reconnect behaelt den Cloud-Zugriff');
  assert.match(source, /\['homebase_v1\.package\.install_ack', 'homebase_v1\.package\.uninstall_ack'\]\.includes\(ack\?\.type\)[\s\S]{0,120}homebaseCloud\.refresh/,
    'Neuaufbau erst nach erfolgreicher Paket-Installation');
});
