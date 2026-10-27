import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { FlightLogbook, handleFlightLogbook } from './flight-logbook.mjs';
const require = createRequire(import.meta.url);
const codec = require('../../flight-track-codec-core.js');

function storage() {
    const records = new Map();
    return {
        records,
        get: async key => structuredClone(records.get(key)),
        put: async (key, value) => { if (typeof key === 'object') Object.entries(key).forEach(([k, v]) => records.set(k, structuredClone(v))); else records.set(key, structuredClone(value)); },
        list: async ({ prefix }) => new Map([...records].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])),
        delete: async keys => (Array.isArray(keys) ? keys : [keys]).forEach(k => records.delete(k))
    };
}
function namespace() {
    const objects = new Map();
    return { objects, idFromName: name => name, get: id => {
        if (!objects.has(id)) { let chain = Promise.resolve(); const s = storage();
            objects.set(id, new FlightLogbook({ storage: s, blockConcurrencyWhile(fn) { const r = chain.then(fn); chain = r.catch(() => {}); return r; } })); }
        return objects.get(id);
    } };
}
const pilots = { ALICE: { pin: '1', storageOwnerId: 'ALICE', ns: 'a1' }, BOB: { pin: '2', storageOwnerId: 'BOB', ns: 'b1' },
    // renamed account: logs in as NEWNAME, stores under its original anchor
    NEWNAME: { pin: '3', storageOwnerId: 'OLDNAME', ns: 'o1' }, OLDNAME: { pin: '3', storageOwnerId: 'OLDNAME', ns: 'o1' } };
async function authenticate(request) {
    const id = request.headers.get('X-Pilot-ID'), p = pilots[id];
    if (!p || p.pin !== request.headers.get('X-Pilot-PIN')) return { ok: false, response: new Response('{}', { status: 401 }) };
    return { ok: true, ownerId: id, storageOwnerId: p.storageOwnerId, profileSyncNamespace: p.ns };
}
function api(env, pilot, pin) {
    const call = async (path, body) => {
        const res = await handleFlightLogbook(new Request('https://w/api/flightlog-v1/' + path, {
            method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined,
            headers: { 'X-Pilot-ID': pilot, 'X-Pilot-PIN': pin } }), env, authenticate);
        return { status: res.status, body: await res.json() };
    };
    return { list: since => call('list' + (since !== undefined ? `?since=${since}` : '')), track: id => call('track/' + id),
        put: (entry, track) => call('put', { entry, track }), del: body => call('delete', body) };
}
function track(seed = 0) {
    return codec.encodeTrack(Array.from({ length: 120 }, (_, i) => ({ observedAt: 1e12 + i * 1000, lat: 48 + i * 0.001, lon: 9 + Math.sin(i / 9 + seed) * 0.01, altFt: 2000 + i * 10, aglFt: 1500, onGround: false })));
}
const entry = (runId, endTs, kind = 'free') => ({ kind, runId, completionId: runId, endTs, durationSec: 600, distanceNm: 12.3 });

test('flights are stored per pilot; list has no tracks, tracks load on demand', async () => {
    const env = { GA_FLIGHT_LOGBOOK: namespace() };
    const alice = api(env, 'ALICE', '1'), bob = api(env, 'BOB', '2');
    assert.equal((await alice.put(entry('free-1', 100), track())).status, 200);
    const list = await alice.list();
    assert.equal(list.body.entries.length, 1);
    assert.equal(list.body.entries[0].hasTrack, true);
    assert.equal(list.body.entries[0].track, undefined);
    assert.equal((await alice.track('free-1')).body.track.enc, track().enc);
    assert.equal((await bob.list()).body.entries.length, 0);
    assert.equal((await bob.track('free-1')).status, 404);
    assert.equal((await api(env, 'ALICE', 'wrong').list()).status, 401);
});

test('a renamed pilot keeps the flights; unchanged list costs no payload', async () => {
    const env = { GA_FLIGHT_LOGBOOK: namespace() };
    await api(env, 'OLDNAME', '3').put(entry('free-1', 100), track());
    const renamed = api(env, 'NEWNAME', '3');
    const { body } = await renamed.list();
    assert.equal(body.entries.length, 1);
    assert.deepEqual((await renamed.list(body.revision)).body, { revision: body.revision, unchanged: true });
});

test('newest 50 per kind are kept; same runId replaces', async () => {
    const env = { GA_FLIGHT_LOGBOOK: namespace() };
    const a = api(env, 'ALICE', '1');
    for (let i = 0; i < 55; i += 1) await a.put(entry(`free-${i}`, 1000 + i), track(i));
    await a.put(entry('run-m1', 1, 'mission'), track());
    await a.put({ ...entry('free-54', 1054), distanceNm: 99 }, track());
    const { entries } = (await a.list()).body;
    assert.equal(entries.filter(e => e.kind === 'free').length, 50);
    assert.equal(entries.filter(e => e.kind === 'mission').length, 1);
    assert.equal(entries[0].distanceNm, 99);
    assert.equal((await a.track('free-0')).status, 404);
    assert.equal((await a.track('free-5')).status, 200);
});

test('delete by id or by kind', async () => {
    const env = { GA_FLIGHT_LOGBOOK: namespace() };
    const a = api(env, 'ALICE', '1');
    await a.put(entry('free-1', 1), track()); await a.put(entry('free-2', 2), track()); await a.put(entry('run-m', 3, 'mission'), track());
    assert.equal((await a.del({ runIds: ['free-1'] })).body.deleted, 1);
    assert.equal((await a.del({ kind: 'free' })).body.deleted, 1);
    assert.deepEqual((await a.list()).body.entries.map(e => e.runId), ['run-m']);
});

test('invalid input is rejected', async () => {
    const env = { GA_FLIGHT_LOGBOOK: namespace() };
    const a = api(env, 'ALICE', '1');
    assert.equal((await a.put({ kind: 'other', runId: 'x' }, track())).status, 400);
    assert.equal((await a.put(entry('bad id!', 1), track())).status, 400);
    assert.equal((await a.put(entry('free-1', 1), { v: 1, enc: '\u0001\u0002', n: 1 })).status, 400);
    assert.equal((await a.put({ ...entry('free-1', 1), note: 'x'.repeat(5000) }, track())).status, 413);
    assert.equal((await handleFlightLogbook(new Request('https://w/api/flightlog-v1/list'), {}, authenticate)).status, 503);
});
