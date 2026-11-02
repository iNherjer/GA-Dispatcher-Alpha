import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CrewFleet, handleCrewFleet } from './crew-fleet.mjs';
import { CrewPresence } from './crew-presence.mjs';

function storage() {
    const records = new Map();
    const counts = { put: 0, get: 0, list: 0 };
    return {
        records, counts,
        get: async key => { counts.get++; return structuredClone(records.get(key)); },
        put: async (key, value) => {
            counts.put++;
            if (typeof key === 'object') for (const [k, v] of Object.entries(key)) records.set(k, structuredClone(v));
            else records.set(key, structuredClone(value));
        },
        list: async ({ prefix }) => { counts.list++; return new Map([...records].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])); },
        delete: async keys => (Array.isArray(keys) ? keys : [keys]).forEach(k => records.delete(k))
    };
}
function namespace() {
    const objects = new Map();
    return { objects, idFromName: name => name, get: id => {
        if (!objects.has(id)) objects.set(id, new CrewFleet({ storage: storage() }));
        return objects.get(id);
    } };
}
const pilots = { ALICE: '1', BOB: '2', EVE: '3', KICKED: '4' };
let authCalls = 0;
async function authenticate(request) {
    authCalls++;
    const id = request.headers.get('X-Pilot-ID');
    if (!pilots[id] || pilots[id] !== request.headers.get('X-Pilot-PIN')) return { ok: false, response: new Response('{}', { status: 401 }) };
    return { ok: true, ownerId: id };
}
const groups = { EDTW: { members: [{ syncId: 'ALICE', nick: 'Ali' }, { syncId: 'BOB', nick: 'Bob' }, { syncId: 'KICKED', nick: 'K' }], kicked: ['kicked'] } };
const readGroup = async (env, crew) => groups[crew] || null;

function client(env, pilot, crew = 'EDTW', action = '') {
    return async (body, since) => {
        const res = await handleCrewFleet(new Request('https://w/api/crew-fleet-v1/' + crew + (action ? '/' + action : '') + (since != null ? '?since=' + since : ''), {
            method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined,
            headers: { 'X-Pilot-ID': pilot, 'X-Pilot-PIN': pilots[pilot] } }), env, authenticate, readGroup);
        return { status: res.status, body: await res.json() };
    };
}
const KEY = 'tail:DEINA|A2A Piper PA-24-250 Comanche';
const pos = (extra = {}) => ({ name: 'A2A Piper PA-24-250 Comanche', title: 'A2A Piper PA-24-250 Comanche', livery: 'N8351P', tail: 'DEINA',
    lat: 48.2769, lon: 8.4309, altFt: 2202, hdgTrue: 323, onGround: true, hidden: false, savedAt: 1000, fuel: [['LEFT MAIN', 30]], payload: [170, 0], ...extra });
const log = (extra = {}) => ({ flightSecs: 600, engineSecs: 700, landings: 1, lastFlown: 1000, distanceNm: 20, notes: '', flights: [{ start: 1, end: 2, from: 'EDTW', to: 'EDTW', secs: 600, nm: 20, landings: 1, open: false }], flightsOffset: 0, ...extra });

test('members share aircraft; owner stays, last pilot changes; outsiders refused', async () => {
    const env = { GA_CREW_FLEET: namespace() };
    const up = await client(env, 'ALICE')({ records: [{ key: KEY, pos: pos(), log: log() }] });
    assert.equal(up.status, 200);
    assert.equal(up.body.changed, 1);
    const seen = await client(env, 'BOB')();
    assert.equal(seen.body.records.length, 1);
    assert.equal(seen.body.records[0].ownerNick, 'Ali');
    await client(env, 'BOB')({ records: [{ key: KEY, pos: pos({ lat: 48.3, savedAt: 2000 }) }] });
    const after = (await client(env, 'ALICE')()).body.records[0];
    assert.equal(after.pos.lat, 48.3);
    assert.equal(after.ownerPilotId, 'ALICE');
    assert.equal(after.lastNick, 'Bob');
    assert.equal(after.log.flightSecs, 600, 'log stays when only a position is sent');
    assert.equal((await client(env, 'EVE')()).status, 403);
    assert.equal((await client(env, 'KICKED')()).status, 403);
});

test('older position is ignored, newer wins; flights are united like the mod does', async () => {
    const env = { GA_CREW_FLEET: namespace() };
    const alice = client(env, 'ALICE');
    await alice({ records: [{ key: KEY, pos: pos({ savedAt: 2000 }), log: log({ lastFlown: 2000, notes: 'A' }) }] });
    const older = await alice({ records: [{ key: KEY, pos: pos({ lat: 1, savedAt: 1000 }), log: log({ flightSecs: 1, lastFlown: 1000, flights: [{ start: 5, end: 6 }] }) }] });
    assert.equal(older.body.changed, 1, 'the older flight is still added');
    let record = (await alice()).body.records[0];
    assert.equal(record.pos.lat, 48.2769);
    assert.equal(record.log.flightSecs, 600);
    assert.deepEqual(record.log.flights.map(f => f.start), [1, 5]);
    await alice({ records: [{ key: KEY, pos: pos({ lat: 2, savedAt: 3000 }), log: log({ flightSecs: 900, lastFlown: 3000, notes: 'C', flights: [{ start: 9, end: 10 }] }) }] });
    record = (await alice()).body.records[0];
    assert.equal(record.pos.lat, 2);
    assert.equal(record.log.flightSecs, 900);
    assert.equal(record.log.notes, 'A', 'stored notes stay');
    assert.deepEqual(record.log.flights.map(f => f.start), [1, 5, 9]);
});

test('unchanged uploads write nothing; unchanged polls read no records', async () => {
    const env = { GA_CREW_FLEET: namespace() };
    const alice = client(env, 'ALICE');
    await alice({ records: [{ key: KEY, pos: pos(), log: log() }] });
    const object = env.GA_CREW_FLEET.objects.get(JSON.stringify(['crew-fleet', 'EDTW']));
    const puts = object.storage.counts.put;
    // Same content with a different field order, as the mod might write it.
    const reordered = Object.fromEntries(Object.entries(pos()).reverse());
    const again = await alice({ records: [{ key: KEY, pos: reordered, log: log() }] });
    assert.equal(again.body.changed, 0);
    assert.equal(object.storage.counts.put, puts);
    const { rev } = (await alice()).body;
    const poll = await alice(null, rev);
    assert.deepEqual(poll.body, { ok: true, rev, unchanged: true });
    const delta = await alice(null, rev - 1);
    assert.equal(delta.body.records.length, 1);
    const reset = await alice(null, rev + 5);
    assert.equal(reset.body.full, true, 'a client ahead of the server takes everything again');
});

test('auth and membership are cached per pilot and crew', async () => {
    const env = { GA_CREW_FLEET: namespace() };
    const before = authCalls;
    const bob = client(env, 'BOB');
    for (let i = 0; i < 5; i++) await bob(null, 0);
    assert.ok(authCalls - before <= 1, 'at most one real auth for five polls');
});

test('invalid uploads are refused before any auth', async () => {
    const env = { GA_CREW_FLEET: namespace() };
    const alice = client(env, 'ALICE');
    assert.equal((await alice({ records: [{ key: KEY, pos: { lat: 999, lon: 0, title: 'x' } }] })).status, 400);
    assert.equal((await alice({ records: [{ key: '', pos: pos() }] })).status, 400);
    assert.equal((await alice({ records: [{ key: KEY }] })).status, 400);
    assert.equal((await alice({ records: new Array(121).fill({ key: KEY, pos: pos() }) })).status, 400);
    assert.equal((await alice({ nope: 1 })).status, 400);
});

function presenceNamespace() {
    const objects = new Map();
    return { objects, idFromName: name => name, get: id => {
        if (!objects.has(id)) objects.set(id, new CrewPresence({ storage: storage() }));
        return objects.get(id);
    } };
}
const act = (env, pilot, action) => client(env, pilot, 'EDTW', action);

test('reservation blocks the others until released', async () => {
    const env = { GA_CREW_FLEET: namespace() };
    await client(env, 'ALICE')({ records: [{ key: KEY, pos: pos(), log: log() }] });
    assert.equal((await act(env, 'BOB', 'reserve')({ key: KEY })).status, 200);
    const refused = await act(env, 'ALICE', 'reserve')({ key: KEY });
    assert.equal(refused.status, 409);
    assert.equal(refused.body.holder.nick, 'Bob');
    const blocked = await client(env, 'ALICE')({ records: [{ key: KEY, pos: pos({ lat: 1, savedAt: 9999 }) }] });
    assert.deepEqual(blocked.body.blocked, [KEY]);
    assert.equal((await act(env, 'ALICE', 'release')({ key: KEY })).status, 409, 'only the holder releases');
    assert.equal((await act(env, 'BOB', 'release')({ key: KEY })).status, 200);
    const record = (await client(env, 'ALICE')()).body.records[0];
    assert.equal(record.lock, null);
    assert.equal(record.pos.lat, 48.2769);
    assert.equal((await act(env, 'BOB', 'reserve')({ key: 'tail:X|Nope' })).status, 404);
});

test('takeoff, parking and the export walk through flying, landed and free', async () => {
    const env = { GA_CREW_FLEET: namespace() };
    await client(env, 'ALICE')({ records: [{ key: KEY, pos: pos(), log: log() }] });
    await act(env, 'BOB', 'reserve')({ key: KEY });
    const takeoff = await act(env, 'BOB', 'event')({ event: 'takeoff', title: 'A2A Piper PA-24-250 Comanche', tail: 'deina' });
    assert.equal(takeoff.body.key, KEY);
    assert.equal(takeoff.body.lock.state, 'flying');
    // Alice loads the same aircraft and flies anyway: refused, the board shows it.
    const other = await act(env, 'ALICE', 'event')({ event: 'takeoff', title: 'A2A Piper PA-24-250 Comanche', tail: 'DEINA' });
    assert.equal(other.body.refused, true);
    assert.equal(other.body.holder.nick, 'Bob');
    let record = (await client(env, 'BOB')()).body.records[0];
    assert.equal(record.conflict.nick, 'Ali');
    assert.equal(record.lock.state, 'flying');
    await act(env, 'BOB', 'event')({ event: 'parked', title: 'A2A Piper PA-24-250 Comanche', tail: 'DEINA' });
    record = (await client(env, 'BOB')()).body.records[0];
    assert.equal(record.lock.state, 'landed');
    assert.equal(record.conflict, null);
    // Bob exports after parking: new position, but he still sits in the aircraft.
    await client(env, 'BOB')({ records: [{ key: KEY, pos: pos({ lat: 49.3, savedAt: 5000 }) }] });
    record = (await client(env, 'ALICE')()).body.records[0];
    assert.equal(record.lock.state, 'landed', 'an export does not end the use');
    assert.equal(record.pos.lat, 49.3);
    // He leaves the aircraft (menu): free, found without title or tail.
    await act(env, 'BOB', 'event')({ event: 'left', title: '', tail: '' });
    record = (await client(env, 'ALICE')()).body.records[0];
    assert.equal(record.lock, null);
    assert.equal(record.lastNick, 'Bob');
    const unknown = await act(env, 'BOB', 'event')({ event: 'takeoff', title: 'Cessna 172', tail: 'D-EXYZ' });
    assert.equal(unknown.body.matched, false);
});

test('locks run out after 12 hours', async () => {
    const env = { GA_CREW_FLEET: namespace() };
    const realNow = Date.now;
    try {
        let t = realNow();
        Date.now = () => t;
        await client(env, 'ALICE')({ records: [{ key: KEY, pos: pos(), log: log() }] });
        await act(env, 'BOB', 'reserve')({ key: KEY });
        t += 12 * 60 * 60 * 1000 - 1000;
        assert.equal((await act(env, 'ALICE', 'reserve')({ key: KEY })).status, 409);
        t += 2000;
        assert.equal((await client(env, 'ALICE')()).body.records[0].lock, null);
        assert.equal((await act(env, 'ALICE', 'reserve')({ key: KEY })).status, 200);
    } finally {
        Date.now = realNow;
    }
});

test('the crew board sees the fleet revision in its presence poll, only after real changes', async () => {
    const env = { GA_CREW_FLEET: namespace(), GA_CREW_PRESENCE: presenceNamespace() };
    const presence = () => env.GA_CREW_PRESENCE.get(JSON.stringify(['crew-presence', 'EDTW']));
    await client(env, 'ALICE')({ records: [{ key: KEY, pos: pos(), log: log() }] });
    const list = async () => (await presence().fetch(new Request('https://crew-presence/list?m=alice'))).json();
    assert.equal((await list()).fleetRev, 1);
    const puts = presence().storage.counts.put;
    await client(env, 'ALICE')({ records: [{ key: KEY, pos: pos(), log: log() }] });
    assert.equal(presence().storage.counts.put, puts, 'an unchanged upload does not touch the presence object');
    await act(env, 'BOB', 'reserve')({ key: KEY });
    assert.equal((await list()).fleetRev, 2);
});

test('websocket route needs an upgrade and actions need POST', async () => {
    const env = { GA_CREW_FLEET: namespace() };
    const ws = await handleCrewFleet(new Request('https://w/api/crew-fleet-v1/EDTW/ws', { headers: { 'X-Pilot-ID': 'ALICE', 'X-Pilot-PIN': '1' } }), env, authenticate, readGroup);
    assert.equal(ws.status, 426);
    const get = await handleCrewFleet(new Request('https://w/api/crew-fleet-v1/EDTW/reserve', { headers: { 'X-Pilot-ID': 'ALICE', 'X-Pilot-PIN': '1' } }), env, authenticate, readGroup);
    assert.equal(get.status, 405);
    assert.equal((await act(env, 'ALICE', 'event')({ event: 'boom' })).status, 400);
});

test('the sim may report the livery registration, another title or only the parking spot', async () => {
    const env = { GA_CREW_FLEET: namespace() };
    await client(env, 'ALICE')({ records: [{ key: KEY, pos: pos(), log: log() }] });
    const byLivery = await act(env, 'BOB', 'event')({ event: 'takeoff', title: 'A2A Piper PA-24-250 Comanche N8351P', tail: 'N8351P' });
    assert.equal(byLivery.body.key, KEY);
    await act(env, 'BOB', 'release')({ key: KEY });
    const bySpot = await act(env, 'BOB', 'event')({ event: 'takeoff', title: 'A2A Piper PA-24-250 Comanche Livery 7', tail: 'D-ELSE', lat: 48.27692, lon: 8.43088 });
    assert.equal(bySpot.body.key, KEY);
    await act(env, 'BOB', 'release')({ key: KEY });
    const elsewhere = await act(env, 'BOB', 'event')({ event: 'takeoff', title: 'Cessna 172', tail: 'D-EXYZ', lat: 50, lon: 9 });
    assert.equal(elsewhere.body.matched, false);
});

test('a live flight claims the aircraft as busy on the ground; aborted it is free again', async () => {
    const env = { GA_CREW_FLEET: namespace() };
    await client(env, 'ALICE')({ records: [{ key: KEY, pos: pos(), log: log() }] });
    const claim = await act(env, 'BOB', 'event')({ event: 'claim', title: 'A2A Piper PA-24-250 Comanche', tail: 'DEINA' });
    assert.equal(claim.body.lock.state, 'busy');
    const other = await act(env, 'ALICE', 'reserve')({ key: KEY });
    assert.equal(other.status, 409);
    assert.equal(other.body.holder.state, 'busy');
    await act(env, 'BOB', 'event')({ event: 'unclaim', title: 'A2A Piper PA-24-250 Comanche', tail: 'DEINA' });
    assert.equal((await client(env, 'ALICE')()).body.records[0].lock, null);
    await act(env, 'BOB', 'event')({ event: 'claim', title: 'A2A Piper PA-24-250 Comanche', tail: 'DEINA' });
    await act(env, 'BOB', 'event')({ event: 'takeoff', title: 'A2A Piper PA-24-250 Comanche', tail: 'DEINA' });
    await act(env, 'BOB', 'event')({ event: 'unclaim', title: 'A2A Piper PA-24-250 Comanche', tail: 'DEINA' });
    assert.equal((await client(env, 'ALICE')()).body.records[0].lock.state, 'flying', 'unclaim never frees a flying aircraft');
});

test('leaving the aircraft frees busy, flying and landed, never a manual reservation', async () => {
    const env = { GA_CREW_FLEET: namespace() };
    await client(env, 'ALICE')({ records: [{ key: KEY, pos: pos(), log: log() }] });
    await act(env, 'BOB', 'event')({ event: 'claim', title: 'A2A Piper PA-24-250 Comanche', tail: 'DEINA' });
    await act(env, 'BOB', 'event')({ event: 'left', title: 'A2A Piper PA-24-250 Comanche', tail: 'DEINA' });
    assert.equal((await client(env, 'ALICE')()).body.records[0].lock, null);
    await act(env, 'BOB', 'reserve')({ key: KEY });
    await act(env, 'BOB', 'event')({ event: 'left', title: 'A2A Piper PA-24-250 Comanche', tail: 'DEINA' });
    assert.equal((await client(env, 'ALICE')()).body.records[0].lock.state, 'reserved');
    const other = await act(env, 'ALICE', 'event')({ event: 'left', title: 'A2A Piper PA-24-250 Comanche', tail: 'DEINA' });
    assert.equal(other.body.refused, undefined, 'someone else leaving changes nothing');
    assert.equal((await client(env, 'ALICE')()).body.records[0].lock.state, 'reserved');
});

test('the same registration on another type never matches by registration alone', async () => {
    const env = { GA_CREW_FLEET: namespace() };
    await client(env, 'ALICE')({ records: [{ key: KEY, pos: pos(), log: log() }] });
    const dakota = await act(env, 'ALICE', 'event')({ event: 'takeoff', title: 'Piper PA28-236 Dakota - Standard', tail: 'DEINA', lat: 48.2770, lon: 8.4310 });
    assert.equal(dakota.body.matched, false, 'the Comanche stays free');
    assert.equal((await client(env, 'ALICE')()).body.records[0].lock, null);
});

test('only the owner removes an aircraft; it stays out, also when uploaded again', async () => {
    const env = { GA_CREW_FLEET: namespace() };
    await client(env, 'ALICE')({ records: [{ key: KEY, pos: pos(), log: log() }] });
    assert.equal((await act(env, 'BOB', 'remove')({ key: KEY })).status, 403, 'not the owner');
    await act(env, 'BOB', 'event')({ event: 'claim', title: 'A2A Piper PA-24-250 Comanche', tail: 'DEINA' });
    const inUse = await act(env, 'ALICE', 'remove')({ key: KEY });
    assert.equal(inUse.status, 409, 'not while someone else uses it');
    await act(env, 'BOB', 'event')({ event: 'left', title: '', tail: '' });
    const { rev } = (await client(env, 'BOB')()).body;
    assert.equal((await act(env, 'ALICE', 'remove')({ key: KEY })).status, 200);
    const delta = (await client(env, 'BOB')(null, rev)).body.records;
    assert.equal(delta.length, 1);
    assert.equal(delta[0].removed, true, 'clients learn it from the marker');
    assert.equal(delta[0].removedNick, 'Ali');
    assert.equal(delta[0].log, null);
    const again = await client(env, 'ALICE')({ records: [{ key: KEY, pos: pos({ savedAt: 99999 }), log: log() }] });
    assert.deepEqual(again.body.removed, [KEY]);
    assert.equal((await client(env, 'ALICE')()).body.records[0].removed, true);
    assert.equal((await act(env, 'BOB', 'reserve')({ key: KEY })).status, 404);
    const flown = await act(env, 'BOB', 'event')({ event: 'takeoff', title: 'A2A Piper PA-24-250 Comanche', tail: 'DEINA' });
    assert.equal(flown.body.matched, false);
});

test('removal markers older than 30 days disappear', async () => {
    const env = { GA_CREW_FLEET: namespace() };
    const realNow = Date.now;
    try {
        let t = realNow();
        Date.now = () => t;
        await client(env, 'ALICE')({ records: [{ key: KEY, pos: pos(), log: log() }, { key: 'tail:X|Robin DR400', pos: pos({ title: 'Robin DR400', tail: 'X' }) }] });
        await act(env, 'ALICE', 'remove')({ key: KEY });
        t += 31 * 24 * 60 * 60 * 1000;
        await act(env, 'ALICE', 'remove')({ key: 'tail:X|Robin DR400' });
        const keys = (await client(env, 'ALICE')()).body.records.map(record => record.key);
        assert.deepEqual(keys, ['tail:X|Robin DR400']);
    } finally {
        Date.now = realNow;
    }
});

test('a removed aircraft comes back only through an explicit re-add, with the re-adding pilot as owner', async () => {
    const env = { GA_CREW_FLEET: namespace() };
    await client(env, 'ALICE')({ records: [{ key: KEY, pos: pos(), log: log() }] });
    await act(env, 'ALICE', 'remove')({ key: KEY });
    const plain = await client(env, 'BOB')({ records: [{ key: KEY, pos: pos({ savedAt: 5000 }) }] });
    assert.deepEqual(plain.body.removed, [KEY]);
    const back = await client(env, 'BOB')({ records: [{ key: KEY, pos: pos({ lat: 49, savedAt: 6000 }), restore: true }] });
    assert.equal(back.body.changed, 1);
    const record = (await client(env, 'ALICE')()).body.records[0];
    assert.equal(record.removed, undefined);
    assert.equal(record.ownerPilotId, 'BOB');
    assert.equal(record.pos.lat, 49);
    assert.equal((await act(env, 'ALICE', 'remove')({ key: KEY })).status, 403, 'now Bob is the owner');
});
