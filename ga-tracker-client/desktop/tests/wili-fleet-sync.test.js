const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const core = require('../lib/wili-fleet-core');
const { WiliFleetSync, findModWorkDir } = require('../lib/wili-fleet-sync');

const COMANCHE = 'A2A Piper PA-24-250 Comanche';
const DEINA = `tail:DEINA|${COMANCHE}`;
const LEGACY = 'tail:N315WP|A2A Lancair Legacy';

const pos = (title, tail, extra = {}) => ({ name: title, title, livery: tail, liveryName: tail, tail, lat: 48.2769, lon: 8.4309,
  altFt: 2202, aglFt: 3.4, hdgTrue: 323, pitch: -3.9, bank: 0, onGround: true, hidden: false, savedAt: 1000,
  fuel: [['LEFT MAIN', 29.8], ['RIGHT MAIN', 29.8]], payload: [170, 180, 0], ...extra });
const log = (extra = {}) => ({ flightSecs: 0, engineSecs: 71, landings: 0, lastFlown: 1000, distanceNm: 0, notes: '', flights: [], flightsOffset: 0, ...extra });
const backup = (records, exportedAt = 5000) => core.serializeBackup(records, { modVersion: '2.0.0', exportedAt });

async function worker() {
  const { CrewFleet, handleCrewFleet } = await import('../../../tools/cloudflare-worker/crew-fleet.mjs');
  const store = new Map();
  const storage = {
    get: async key => structuredClone(store.get(key)),
    put: async (entries) => { for (const [k, v] of Object.entries(entries)) store.set(k, structuredClone(v)); },
    list: async ({ prefix }) => new Map([...store].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)]))
  };
  const object = new CrewFleet({ storage });
  const env = { GA_CREW_FLEET: { idFromName: name => name, get: () => object } };
  const pins = { ALICE: '1111', BOB: '2222' };
  const authenticate = async request => {
    const id = request.headers.get('X-Pilot-ID');
    return pins[id] === request.headers.get('X-Pilot-PIN') ? { ok: true, ownerId: id } : { ok: false, response: new Response('{}', { status: 401 }) };
  };
  const readGroup = async crew => (crew === 'EDTW' ? { members: [{ syncId: 'ALICE', nick: 'Ali' }, { syncId: 'BOB', nick: 'Bob' }] } : null);
  const calls = [];
  const request = async (url, init = {}) => {
    calls.push(`${init.method || 'GET'} ${new URL(url).search}`);
    const response = await handleCrewFleet(new Request(url, init), env, authenticate, (_env, crew) => readGroup(crew));
    const data = await response.json();
    return { ok: response.ok, status: response.status, json: async () => data };
  };
  const action = (pilot, name, body) => request(`https://ga-proxy.einherjer.workers.dev/api/crew-fleet-v1/EDTW/${name}`, {
    method: 'POST', headers: { 'X-Pilot-ID': pilot, 'X-Pilot-PIN': pins[pilot], 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { request, calls, pins, action };
}

const started = [];
test.after(() => started.forEach(sync => sync.stop()));

function pilot(name, server, { crew = 'EDTW', autoSync = true, createSocket = null } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `wili-${name}-`));
  const modDir = path.join(root, 'work');
  fs.mkdirSync(modDir, { recursive: true });
  let clock = 10_000;
  const settings = { enabled: true, autoSync };
  const sync = new WiliFleetSync({
    dataDirectory: path.join(root, 'data'),
    request: server.request,
    now: () => clock,
    getSettings: () => settings,
    saveSettings: next => Object.assign(settings, next),
    getCredentials: () => ({ pilotId: name, pin: server.pins[name] }),
    readCrewName: async () => crew,
    locate: () => ({ source: 'Test', dir: modDir }),
    push: Boolean(createSocket),
    createSocket: createSocket || undefined
  });
  started.push(sync);
  return {
    sync, modDir, root,
    advance: ms => { clock += ms; },
    write: content => fs.writeFileSync(path.join(modDir, 'backup.txt'), content),
    read: () => core.parseBackup(fs.readFileSync(path.join(modDir, 'backup.txt'), 'utf8')),
    writeState: lines => fs.writeFileSync(path.join(modDir, 'state.txt'), lines.join('\n') + '\n')
  };
}

test('two pilots share their hangars and a borrowed aircraft comes back moved', async () => {
  const server = await worker();
  const alice = pilot('ALICE', server);
  const bob = pilot('BOB', server);
  alice.write(backup([{ key: DEINA, pos: pos(COMANCHE, 'DEINA'), log: log() }]));
  bob.write(backup([{ key: LEGACY, pos: pos('A2A Lancair Legacy', 'N315WP', { lat: 49.305 }), log: log() }]));

  assert.equal((await alice.sync.sync()).ok, true);
  const first = await bob.sync.sync();
  assert.equal(first.ok, true);
  assert.equal(first.written, 1);
  assert.deepEqual([...bob.read().records.keys()].sort(), [DEINA, LEGACY].sort());
  assert.deepEqual(bob.sync.publicState().pending.map(entry => entry.tail), ['DEINA']);

  // Bob presses Import: the mod's state.txt now has DEINA at the shared place.
  bob.writeState(['settings|ask|tail|1|25||10|5', `rec|${encodeURIComponent(DEINA)}|${COMANCHE}|DEINA|DEINA|48.2769|8.4309|2202|3|323|0|0|1|0`]);
  bob.sync.checkPendingImport();
  assert.equal(bob.sync.publicState().pending.length, 0);

  // Bob flies DEINA to EDRY and exports; only DEINA goes up.
  server.calls.length = 0;
  const flown = backup([
    { key: DEINA, pos: pos(COMANCHE, 'DEINA', { lat: 49.3, lon: 8.45, savedAt: 9000 }), log: log({ lastFlown: 9000, flightSecs: 1800, flights: [{ start: 8000, end: 9000, from: 'EDTW', to: 'EDRY', secs: 1800 }] }) },
    { key: LEGACY, pos: pos('A2A Lancair Legacy', 'N315WP', { lat: 49.305 }), log: log() }
  ], 9100);
  bob.write(flown);
  const back = await bob.sync.sync();
  assert.equal(back.ok, true);
  const post = server.calls.find(call => call.startsWith('POST'));
  assert.ok(post, 'the moved aircraft was uploaded');

  alice.advance(60 * 60 * 1000);
  const home = await alice.sync.sync('poll');
  assert.equal(home.written, 2, 'DEINA moved and Bob\'s Legacy is new for Alice');
  const deina = alice.read().records.get(DEINA);
  assert.equal(deina.pos.lat, 49.3);
  assert.equal(deina.log.flights.length, 1);
  const listed = alice.sync.publicState().aircraft.find(entry => entry.tail === 'DEINA');
  assert.equal(listed.ownerNick, 'Ali');
  assert.equal(listed.lastNick, 'Bob');
});

test('quiet polls only send one small request and never upload or rewrite', async () => {
  const server = await worker();
  const alice = pilot('ALICE', server);
  alice.write(backup([{ key: DEINA, pos: pos(COMANCHE, 'DEINA'), log: log() }]));
  await alice.sync.sync();
  const before = fs.statSync(path.join(alice.modDir, 'backup.txt')).mtimeMs;
  server.calls.length = 0;
  for (let i = 0; i < 3; i++) await alice.sync.sync('poll');
  assert.deepEqual(server.calls, ['GET ?since=1', 'GET ?since=1', 'GET ?since=1']);
  assert.equal(fs.statSync(path.join(alice.modDir, 'backup.txt')).mtimeMs, before);
});

test('a mod export that replaced the prepared import gets the crew aircraft again, without uploading the old copy', async () => {
  const server = await worker();
  const alice = pilot('ALICE', server);
  const bob = pilot('BOB', server);
  alice.write(backup([{ key: DEINA, pos: pos(COMANCHE, 'DEINA', { savedAt: 5000 }), log: log({ lastFlown: 5000 }) }]));
  await alice.sync.sync();
  bob.write(backup([{ key: DEINA, pos: pos(COMANCHE, 'DEINA', { savedAt: 1000, lat: 10 }), log: log() }]));
  await bob.sync.sync();
  assert.equal(bob.read().records.get(DEINA).pos.savedAt, 5000);
  // Bob exports before importing: the mod writes its old copy again.
  bob.write(backup([{ key: DEINA, pos: pos(COMANCHE, 'DEINA', { savedAt: 1000, lat: 10 }), log: log() }], 7000));
  server.calls.length = 0;
  const again = await bob.sync.sync();
  assert.equal(again.written, 1);
  assert.equal(bob.read().records.get(DEINA).pos.savedAt, 5000);
  assert.equal(server.calls.filter(call => call.startsWith('POST')).length, 0, 'the older copy is not uploaded');
});

test('manual mode keeps upload and download apart', async () => {
  const server = await worker();
  const alice = pilot('ALICE', server, { autoSync: false });
  alice.write(backup([{ key: DEINA, pos: pos(COMANCHE, 'DEINA'), log: log() }]));
  const before = fs.readFileSync(path.join(alice.modDir, 'backup.txt'), 'utf8');
  await alice.sync.tick();
  await alice.sync.tick();
  assert.deepEqual(server.calls, ['GET ?since=0'], 'one look at start, no upload');
  assert.equal(fs.readFileSync(path.join(alice.modDir, 'backup.txt'), 'utf8'), before, 'nothing written without a button');
  server.calls.length = 0;
  const up = await alice.sync.upload();
  assert.equal(up.uploaded, 1);
  assert.deepEqual(server.calls, ['POST ']);
  const down = await alice.sync.download();
  assert.equal(down.ok, true);
});

test('unknown file formats and missing crews stop safely', async () => {
  const server = await worker();
  const alice = pilot('ALICE', server);
  alice.write('SOMETHING-ELSE|9|3.0.0|1\npos|x|y\n');
  const result = await alice.sync.sync();
  assert.equal(result.ok, false);
  assert.match(result.message, /unbekanntes Format/);
  assert.equal(fs.readFileSync(path.join(alice.modDir, 'backup.txt'), 'utf8').startsWith('SOMETHING-ELSE'), true);

  const loner = pilot('BOB', server, { crew: '' });
  loner.write(backup([{ key: DEINA, pos: pos(COMANCHE, 'DEINA'), log: log() }]));
  const lonely = await loner.sync.sync();
  assert.equal(lonely.ok, false);
  assert.equal(loner.sync.publicState().phase, 'no-crew');
});

test('a copy of backup.txt is kept before the app rewrites it', async () => {
  const server = await worker();
  const alice = pilot('ALICE', server);
  const bob = pilot('BOB', server);
  alice.write(backup([{ key: DEINA, pos: pos(COMANCHE, 'DEINA'), log: log() }]));
  await alice.sync.sync();
  const original = backup([{ key: LEGACY, pos: pos('A2A Lancair Legacy', 'N315WP'), log: log() }]);
  bob.write(original);
  await bob.sync.sync();
  const copies = fs.readdirSync(path.join(bob.root, 'data', 'wili-backups'));
  assert.equal(copies.length, 1);
  assert.equal(fs.readFileSync(path.join(bob.root, 'data', 'wili-backups', copies[0]), 'utf8'), original);
});

test('the mod folder is found for Store and Steam installs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wili-find-'));
  const local = path.join(root, 'Local');
  const roaming = path.join(root, 'Roaming');
  const store = path.join(local, 'Packages', 'Microsoft.Limitless_8wekyb3d8bbwe', 'LocalState', 'WASM', 'MSFS2024', 'community-whereileftit', 'work');
  assert.equal(findModWorkDir({ appData: roaming, localAppData: local }), null);
  fs.mkdirSync(store, { recursive: true });
  fs.writeFileSync(path.join(store, 'state.txt'), 'x');
  assert.equal(findModWorkDir({ appData: roaming, localAppData: local }).source, 'Microsoft Store');
  const steam = path.join(roaming, 'Microsoft Flight Simulator 2024', 'WASM', 'MSFS2024', 'community-whereileftit', 'work');
  fs.mkdirSync(steam, { recursive: true });
  fs.writeFileSync(path.join(steam, 'state.txt'), 'x');
  const later = new Date(Date.now() + 60000);
  fs.utimesSync(path.join(steam, 'state.txt'), later, later);
  assert.equal(findModWorkDir({ appData: roaming, localAppData: local }).source, 'Steam', 'the most recently used install wins');
});

test('an aircraft reserved by someone else is not uploaded and a moved copy is reset', async () => {
  const server = await worker();
  const alice = pilot('ALICE', server);
  const bob = pilot('BOB', server);
  alice.write(backup([{ key: DEINA, pos: pos(COMANCHE, 'DEINA', { savedAt: 2000 }), log: log() }]));
  await alice.sync.sync();
  bob.write(backup([]));
  await bob.sync.sync();
  assert.equal((await server.action('BOB', 'reserve', { key: DEINA })).status, 200);
  // Alice flies it anyway and exports.
  alice.write(backup([{ key: DEINA, pos: pos(COMANCHE, 'DEINA', { lat: 50, savedAt: 8000 }), log: log() }], 8100));
  const result = await alice.sync.sync();
  assert.match(result.message, /Nicht übernommen.*DEINA/);
  const reset = alice.read().records.get(DEINA).pos;
  assert.equal(reset.lat, 48.2769, 'back where the holder has it');
  assert.ok(reset.savedAt > 8000, 'newer than her own copy, so the mod takes it');
  const listed = alice.sync.publicState().aircraft[0];
  assert.equal(listed.status, 'reserved');
  assert.equal(listed.holderNick, 'Bob');
  assert.equal(listed.mine, false);
  server.calls.length = 0;
  await alice.sync.sync('poll');
  assert.equal(server.calls.filter(call => call.startsWith('POST')).length, 0, 'the reset copy is not sent while blocked');
});

test('a push from the crew cloud starts a sync at once', async () => {
  const server = await worker();
  let socket = null;
  const createSocket = () => { socket = { send() {}, close() {} }; return socket; };
  const alice = pilot('ALICE', server, { createSocket });
  alice.write(backup([{ key: DEINA, pos: pos(COMANCHE, 'DEINA'), log: log() }]));
  await alice.sync.sync();
  await alice.sync.connectSocket();
  socket.onopen();
  await alice.sync.busy;
  assert.equal(alice.sync.publicState().push, true);
  server.calls.length = 0;
  socket.onmessage({ data: JSON.stringify({ type: 'fleet', rev: alice.sync.ledger.rev }) });
  assert.equal(server.calls.length, 0, 'own revision: nothing to do');
  socket.onmessage({ data: JSON.stringify({ type: 'fleet', rev: alice.sync.ledger.rev + 1 }) });
  await alice.sync.busy;
  assert.ok(server.calls.some(call => call.startsWith('GET')));
  alice.sync.stop();
});

test('manual mode tells at start how many crew aircraft are new', async () => {
  const server = await worker();
  const alice = pilot('ALICE', server);
  alice.write(backup([{ key: DEINA, pos: pos(COMANCHE, 'DEINA'), log: log() }]));
  await alice.sync.sync();
  const bob = pilot('BOB', server, { autoSync: false });
  bob.write(backup([]));
  await bob.sync.tick();
  assert.equal(bob.sync.publicState().remoteNewer, 1);
  assert.match(bob.sync.publicState().message, /1 Maschine\(n\) neu/);
  assert.equal(bob.read().records.size, 0);
  const loaded = await bob.sync.download();
  assert.equal(loaded.written, 1);
  assert.equal(bob.sync.publicState().remoteNewer, 0);
});

test('an aircraft flown by someone else is hidden at the others and comes back at its new place', async () => {
  const server = await worker();
  const alice = pilot('ALICE', server);
  const bob = pilot('BOB', server);
  alice.write(backup([{ key: DEINA, pos: pos(COMANCHE, 'DEINA', { savedAt: 2000 }), log: log() }]));
  await alice.sync.sync();
  bob.write(backup([]));
  await bob.sync.sync();
  // Alice imported; Bob takes off with DEINA.
  await server.action('BOB', 'event', { event: 'takeoff', title: COMANCHE, tail: 'DEINA' });
  await alice.sync.sync('poll');
  let deina = alice.read().records.get(DEINA).pos;
  assert.equal(deina.hidden, true, 'not on Alice\'s ramp while Bob flies it');
  assert.ok(deina.savedAt > 2000);
  // Alice exports meanwhile: the hidden copy never goes up.
  alice.write(backup([{ key: DEINA, pos: deina, log: log() }], 9000));
  server.calls.length = 0;
  await alice.sync.sync();
  assert.equal(server.calls.filter(call => call.startsWith('POST')).length, 0);
  // Bob lands, parks and exports: free again, visible at EDRY for Alice.
  await server.action('BOB', 'event', { event: 'parked', title: COMANCHE, tail: 'DEINA' });
  bob.write(backup([{ key: DEINA, pos: pos(COMANCHE, 'DEINA', { lat: 49.3, savedAt: Date.now() }), log: log() }]));
  await bob.sync.sync();
  await alice.sync.sync('poll');
  deina = alice.read().records.get(DEINA).pos;
  assert.equal(deina.hidden, false);
  assert.equal(deina.lat, 49.3);
  assert.deepEqual(alice.sync.ledger.hidden, {});
});

test('a hidden aircraft is shown again when the use ran out without an export', async () => {
  const server = await worker();
  const alice = pilot('ALICE', server);
  alice.write(backup([{ key: DEINA, pos: pos(COMANCHE, 'DEINA', { savedAt: 2000 }), log: log() }]));
  await alice.sync.sync();
  await server.action('BOB', 'event', { event: 'takeoff', title: COMANCHE, tail: 'DEINA' });
  await alice.sync.sync('poll');
  assert.equal(alice.read().records.get(DEINA).pos.hidden, true);
  await server.action('BOB', 'release', { key: DEINA });
  await alice.sync.sync('poll');
  const deina = alice.read().records.get(DEINA).pos;
  assert.equal(deina.hidden, false);
  assert.equal(deina.lat, 48.2769);
});

test('leaving the crew ends the sync and marks the aircraft of the others, shown again', async () => {
  const server = await worker();
  const alice = pilot('ALICE', server);
  alice.write(backup([{ key: DEINA, pos: pos(COMANCHE, 'DEINA', { savedAt: 2000, customName: 'DEINA' }), log: log() }]));
  await alice.sync.sync();
  let crew = 'EDTW';
  const bob = pilot('BOB', server);
  bob.sync.readCrewName = async () => crew;
  bob.write(backup([{ key: LEGACY, pos: pos('A2A Lancair Legacy', 'N315WP'), log: log() }]));
  await bob.sync.sync();
  // Alice flies DEINA: hidden at Bob.
  await server.action('ALICE', 'event', { event: 'takeoff', title: COMANCHE, tail: 'DEINA' });
  await bob.sync.sync('poll');
  assert.equal(bob.read().records.get(DEINA).pos.hidden, true);
  // Bob leaves the crew.
  crew = '';
  bob.advance(7 * 60 * 60 * 1000);
  const result = await bob.sync.sync('poll');
  assert.equal(result.ok, false);
  assert.equal(bob.sync.publicState().phase, 'no-crew');
  const deina = bob.read().records.get(DEINA).pos;
  assert.equal(deina.hidden, false, 'visible again');
  assert.equal(deina.customName, 'DEINA · ex EDTW');
  assert.equal(bob.read().records.get(LEGACY).pos.customName, undefined, 'own aircraft untouched');
  assert.deepEqual(bob.sync.publicState().formerCrew.aircraft, ['DEINA']);
  assert.deepEqual(bob.sync.publicState().pending.map(entry => entry.tail), ['DEINA']);
  server.calls.length = 0;
  await bob.sync.sync('poll');
  assert.equal(server.calls.length, 0, 'no more crew traffic');
});
