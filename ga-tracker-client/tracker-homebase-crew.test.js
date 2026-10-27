'use strict';
// Crew-Homebases ohne App (homebase-crew-cloud-v1).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHomebaseCrewScene, CAPABILITY } = require('./tracker-homebase-crew.js');
const coreApi = require('../homebase-scene-core.js');
const catalog = require('../homebase/homebase-asset-catalog.js');

const hangarTitle = catalog.assets.find((entry) => entry.kind === 'hangar')?.title;
const base = (pilotId, lat, lon) => ({ pilotId, nick: `Nick ${pilotId}`, revision: 'r1',
  plan: { spawn: { lat, lon, altFt: 2200, heading: 90 }, hangar: { objectTitle: hangarTitle, northM: 10, eastM: 5, heading: 180 },
    objects: [], people: [{ title: catalog.tarmacPeople[0].title, startNorthM: 2, startEastM: 1 }] } });
const near = base('PILOT-B', 48.28, 8.43);
const far = base('PILOT-C', 50.0, 10.0);
const reply = (status, data) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const home = { lat: 48.2792, lon: 8.4283 };

function fixture(options = {}) {
  const logs = [], timers = [], requests = [];
  let clock = 1000;
  let groupReads = 0;
  const crew = createHomebaseCrewScene({
    pilotId: 'DEINA', pin: '1234', log: line => logs.push(line), now: () => clock,
    setTimeout: (fn, ms) => { const timer = { fn, ms, unref() {} }; timers.push(timer); return timer; },
    clearTimeout: timer => { const index = timers.indexOf(timer); if (index >= 0) timers.splice(index, 1); },
    readGroupName: options.readGroupName || (async () => { groupReads++; return 'falken'; }),
    request: async (url, init) => { requests.push({ url, init }); return (options.request || reply(200, { ok: true, bases: [near, far] }))(url, init); }
  });
  return { crew, logs, timers, requests, advance: ms => { clock += ms; }, groupReads: () => groupReads };
}

test('Gruppe aus dem Profil, Abruf mit Zugangsdaten, Szene identisch mit dem App-Aufbau', async () => {
  const x = fixture();
  assert.equal(x.crew.available, true);
  assert.equal(x.crew.capability, CAPABILITY);
  assert.equal(x.crew.sceneFor(home), null, 'vor dem ersten Abruf faesst der Tracker nichts an');
  const state = await x.crew.refresh('start');
  assert.equal(state.status, 'ok');
  assert.equal(state.groupName, 'FALKEN');
  assert.equal(state.bases, 2);
  assert.equal(x.requests[0].url, 'https://ga-proxy.einherjer.workers.dev/api/homebase-group/FALKEN');
  assert.deepEqual(x.requests[0].init.headers, { 'X-Pilot-ID': 'DEINA', 'X-Pilot-PIN': '1234' });
  const expected = coreApi.createHomebaseSceneCore({ catalog }).crewSceneForPosition([near, far], home);
  assert.deepEqual(x.crew.sceneFor(home), expected);
  assert.equal(expected.length, 2, 'nur die nahe Basis: Hangar + Person');
  assert.deepEqual(x.crew.sceneFor({ lat: 47, lon: 7 }), [], 'ausserhalb jedes Radius leer');
  assert.equal(x.timers.at(-1).ms, 10 * 60 * 1000);
});

test('Gruppenname wird nur alle 10 min aus dem Profil gelesen, Abruf alle 10 min', async () => {
  const x = fixture();
  await x.crew.refresh('start');
  await x.crew.refresh('poll');
  assert.equal(x.groupReads(), 1);
  x.advance(10 * 60 * 1000);
  await x.crew.refresh('poll');
  assert.equal(x.groupReads(), 2);
  assert.equal(x.requests.length, 3);
});

test('keine Gruppe oder nicht mehr Mitglied: Crew-Szene wird geleert', async () => {
  const none = fixture({ readGroupName: async () => '' });
  assert.equal((await none.crew.refresh('start')).status, 'no-group');
  assert.deepEqual(none.crew.sceneFor(home), []);
  assert.equal(none.requests.length, 0);
  const left = fixture({ request: reply(403, { error: 'Kein aktives Mitglied dieser Crew' }) });
  const state = await left.crew.refresh('start');
  assert.equal(state.code, 'not_member');
  assert.deepEqual(left.crew.sceneFor(home), []);
});

test('Gruppenwechsel aus der App gilt sofort, auch waehrend ein Abruf laeuft', async () => {
  let release;
  const x = fixture({ request: (url) => url.endsWith('/FALKEN')
    ? new Promise(resolve => { release = () => resolve({ ok: true, status: 200, json: async () => ({ bases: [near] }) }); })
    : reply(200, { ok: true, bases: [] })() });
  const first = x.crew.refresh('start');
  while (!release) await new Promise(resolve => setImmediate(resolve));
  const switched = x.crew.refresh('group-joined', { forceGroup: true, groupName: 'adler' });
  release();
  await first;
  const state = await switched;
  assert.equal(state.groupName, 'ADLER');
  assert.equal(x.requests.at(-1).url.endsWith('/ADLER'), true);
  assert.match(x.logs.join('\n'), /HOMEBASE_CREW_GROUP reason=group-joined group=ADLER source=app/);
  const cleared = await x.crew.refresh('group-cleared', { groupName: '' });
  assert.equal(cleared.status, 'no-group');
});

test('Netzwerkfehler: letzte Szene bleibt stehen, Tracker gibt die Zustaendigkeit ab, neuer Versuch nach 60 s', async () => {
  let fail = false;
  const x = fixture({ request: async (url, init) => { if (fail) throw new Error('ENOTFOUND'); return reply(200, { ok: true, bases: [near] })(url, init); } });
  await x.crew.refresh('start');
  assert.equal(x.crew.sceneFor(home).length, 2);
  fail = true;
  const state = await x.crew.refresh('poll');
  assert.equal(state.status, 'error');
  assert.equal(x.crew.sceneFor(home), null, 'Tracker faesst die stehende Szene nicht an');
  assert.equal(x.timers.at(-1).ms, 60000);
  fail = false;
  assert.equal((await x.crew.refresh('retry')).status, 'ok');
});

test('Profil nicht lesbar ohne bekannte Gruppe -> Fehler; ohne Zugangsdaten passiert nichts', async () => {
  const x = fixture({ readGroupName: async () => { throw new Error('offline'); } });
  const state = await x.crew.refresh('start');
  assert.equal(state.code, 'profile_unavailable');
  assert.equal(x.crew.sceneFor(home), null);
  const none = createHomebaseCrewScene({ pilotId: '', pin: '' });
  assert.equal(none.available, false);
  assert.equal(none.sceneFor(home), null);
  assert.equal((await none.refresh('x')).status, 'idle');
});

test('Profil-Abruf ueber das Cloud-Profil (field:groupName)', async () => {
  const requests = [];
  const crew = createHomebaseCrewScene({ pilotId: 'DEINA', pin: '1234', log() {},
    setTimeout: () => ({ unref() {} }), clearTimeout() {},
    request: async (url, init) => {
      requests.push(url);
      if (url.includes('/homebase-group/')) return { ok: true, status: 200, json: async () => ({ bases: [] }) };
      // Altes Profil ohne V2-Index (Revision 0, kein Manifest): Rueckfall auf /api/sync/<Pilot>.
      if (url.includes('/sync-v2/')) return { ok: true, status: 200, json: async () => ({ revision: 0 }) };
      return { ok: true, status: 200, json: async () => ({ groupName: ' falken ' }) };
    } });
  const state = await crew.refresh('start');
  assert.equal(state.groupName, 'FALKEN');
  assert.ok(requests.some(url => url.endsWith('/api/sync/DEINA')));
});

test('Tracker-Verdrahtung und App-Uebergabe', () => {
  const source = fs.readFileSync(path.join(__dirname, 'tracker.js'), 'utf8');
  assert.match(source, /applyHomebaseFallback\(lastGpsMsg\);\s*applyHomebaseCrew\(lastGpsMsg\);/);
  assert.match(source, /if \(signature === homebaseCrewSignature\) return;/);
  assert.match(source, /type: 'homebase_v1\.crew\.set', commandId: `homebase-crew-\$\{Date\.now\(\)\}`, objects/);
  assert.match(source, /crewScene: homebaseCloud\.crew\.publicState\(\)/);
  assert.match(source, /typeof command\?\.groupName === 'string' \? \{ groupName: command\.groupName \}/);
  const app = fs.readFileSync(path.join(__dirname, '../homebase-integration.js'), 'utf8');
  assert.match(app, /if \(ownTrackerOwnsCrew\(position\)\) \{\s*\/\/[^\n]*\n\s*crewLastSceneSignature = '';\s*return false;/);
  assert.match(app, /requestTrackerCrewRefresh\(reason\);\s*return refreshCrewHomebases\(reason\);/);
  assert.match(app, /requestTrackerCrewRefresh\('group-cleared'\);/);
});
