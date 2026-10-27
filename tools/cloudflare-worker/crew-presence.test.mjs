import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { CrewPresence, handleCrewPresence } from './crew-presence.mjs';
const require = createRequire(import.meta.url);
const core = require('../../crew-presence-core.js');

function storage() {
    const records = new Map();
    const counts = { put: 0, get: 0 };
    return {
        records, counts,
        get: async key => { counts.get++; return structuredClone(records.get(key)); },
        put: async (key, value) => { counts.put++; records.set(key, structuredClone(value)); },
        list: async ({ prefix }) => new Map([...records].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])),
        delete: async keys => (Array.isArray(keys) ? keys : [keys]).forEach(k => records.delete(k))
    };
}
function namespace() {
    const objects = new Map();
    return { objects, idFromName: name => name, get: id => {
        if (!objects.has(id)) objects.set(id, new CrewPresence({ storage: storage() }));
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
const groups = { EDFE: { members: [{ syncId: 'BOB', nick: 'Bob' }] }, EDTW: { members: [{ syncId: 'ALICE', nick: 'Ali' }, { syncId: 'BOB', nick: 'Bob' }, { syncId: 'KICKED', nick: 'K' }], kicked: ['kicked'] } };
const readGroup = async (env, crew) => groups[crew] || null;

function client(env, pilot, crew = 'EDTW', suffix = '') {
    return async body => {
        const res = await handleCrewPresence(new Request('https://w/api/crew-presence-v1/' + crew + suffix, {
            method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined,
            headers: { 'X-Pilot-ID': pilot, 'X-Pilot-PIN': pilots[pilot] } }), env, authenticate, readGroup);
        return { status: res.status, body: await res.json() };
    };
}
const flight = (extra = {}) => ({ kind: 'mission', id: 'run-1', title: 'Charter nach Speyer', dep: 'EDTW', dest: 'EDRY', phase: 'cruise', startedAt: 1, takeoffAt: 2, progress: 0.4, ...extra });

test('members see each other online and in flight; outsiders and kicked members are refused', async () => {
    const env = { GA_CREW_PRESENCE: namespace() };
    assert.equal((await client(env, 'ALICE')({ source: 'tracker', flight: flight() })).status, 200);
    const seen = await client(env, 'BOB')();
    assert.equal(seen.status, 200);
    const alice = seen.body.members.find(m => m.pilotId === 'ALICE');
    assert.equal(alice.online, true);
    assert.equal(alice.nick, 'Ali', 'nick comes from the crew record, not the client');
    assert.equal(alice.flight.dest, 'EDRY');
    assert.equal((await client(env, 'EVE')()).status, 403);
    assert.equal((await client(env, 'KICKED')({ source: 'web' })).status, 403);
});

test('sharing switches hide status and flight on the server', async () => {
    const env = { GA_CREW_PRESENCE: namespace() };
    await client(env, 'ALICE')({ source: 'tracker', share: { online: false, flight: true }, flight: flight() });
    let alice = (await client(env, 'BOB')()).body.members.find(m => m.pilotId === 'ALICE');
    assert.equal(alice.online, false);
    assert.ok(alice.flight);
    await client(env, 'ALICE')({ source: 'tracker', share: { online: false, flight: false }, flight: flight({ phase: 'descent' }) });
    alice = (await client(env, 'BOB')()).body.members.find(m => m.pilotId === 'ALICE');
    assert.equal(alice, undefined);
});

test('repeated beats without change do not write; flight events do', async () => {
    const env = { GA_CREW_PRESENCE: namespace() };
    const alice = client(env, 'ALICE');
    for (let i = 0; i < 10; i++) await alice({ source: 'tracker', flight: flight() });
    const object = env.GA_CREW_PRESENCE.objects.get(JSON.stringify(['crew-presence', 'EDTW']));
    assert.equal(object.storage.counts.put, 1);
    await alice({ source: 'tracker', flight: flight({ phase: 'descent' }) });
    assert.equal(object.storage.counts.put, 2);
    await alice({ source: 'tracker', flight: flight({ phase: 'descent', progress: 0.42 }) });
    assert.equal(object.storage.counts.put, 2, 'small progress change is not stored');
    await alice({ offline: true });
    assert.equal((await client(env, 'BOB')()).body.members.length, 0);
});

test('web beats keep a live tracker flight; newest sharing choice wins', async () => {
    const env = { GA_CREW_PRESENCE: namespace() };
    const alice = client(env, 'ALICE');
    await alice({ source: 'tracker', share: { online: true, flight: true, at: 100 }, flight: flight() });
    await alice({ source: 'web', share: { online: true, flight: true, at: 100 } });
    let view = (await client(env, 'BOB')()).body.members.find(m => m.pilotId === 'ALICE');
    assert.equal(view.flight.id, 'run-1', 'web beat did not wipe the flight');
    await alice({ source: 'web', share: { online: true, flight: false, at: 200 } });
    view = (await client(env, 'BOB')()).body.members.find(m => m.pilotId === 'ALICE');
    assert.equal(view.flight, undefined, 'turning flight sharing off in the app hides it at once');
    await alice({ source: 'tracker', share: { online: true, flight: true, at: 100 }, flight: flight({ phase: 'descent' }) });
    view = (await client(env, 'BOB')()).body.members.find(m => m.pilotId === 'ALICE');
    assert.equal(view.flight, undefined, 'tracker with an older profile copy cannot turn it back on');
});

test('mission of the current flight: stored once, readable by members while shared, runtime fields stripped', async () => {
    const env = { GA_CREW_PRESENCE: namespace() };
    await client(env, 'ALICE')({ source: 'tracker', flight: flight() });
    const state = { mTitle: 'Charter', activeMissionRuntimePhase: 'boarding', currentMissionData: { mission: 'Charter', activeMissionRuntimeStartedAt: 5 } };
    const post = client(env, 'ALICE', 'EDTW', '/mission');
    assert.equal((await post({ flightId: 'run-1', state })).body.stored, true);
    assert.equal((await post({ flightId: 'run-1', state })).body.stored, false, 'second upload of the same flight is not written');
    const got = await client(env, 'BOB', 'EDTW', '/mission/ALICE')();
    assert.equal(got.status, 200);
    assert.equal(got.body.state.mTitle, 'Charter');
    assert.equal(got.body.state.activeMissionRuntimePhase, undefined);
    assert.equal(got.body.state.currentMissionData.activeMissionRuntimeStartedAt, undefined);
    assert.equal((await client(env, 'EVE', 'EDTW', '/mission/ALICE')()).status, 403);
    await client(env, 'ALICE')({ source: 'web', share: { online: true, flight: false, at: 9 } });
    assert.equal((await client(env, 'BOB', 'EDTW', '/mission/ALICE')()).status, 404, 'hidden flight hides its mission');
    await client(env, 'ALICE')({ source: 'tracker', share: { online: true, flight: true, at: 10 }, flight: flight({ id: 'run-2' }) });
    assert.equal((await client(env, 'BOB', 'EDTW', '/mission/ALICE')()).status, 404, 'mission of the old flight is gone');
});

test('compressed missions are stored as-is and returned compressed; bad encodings are refused', async () => {
    const { gzipSync, gunzipSync } = await import('node:zlib');
    const env = { GA_CREW_PRESENCE: namespace() };
    await client(env, 'ALICE')({ source: 'tracker', flight: flight() });
    const state = core.sharedMissionState({ currentMissionData: { mission: 'Charter', aptArrivalPlan: { geo: 'x'.repeat(1000) } }, activeMissionContract: { aptArrivalPlan: { geo: 'x'.repeat(1000) } } });
    assert.equal(state.activeMissionContract.aptArrivalPlan, undefined, 'arrival plan kept once');
    const data = gzipSync(JSON.stringify(state)).toString('base64');
    const post = client(env, 'ALICE', 'EDTW', '/mission');
    assert.equal((await post({ flightId: 'run-1', encoding: 'gzip-base64', data })).status, 200);
    assert.equal((await post({ flightId: 'run-1', encoding: 'zip', data })).status, 400);
    assert.equal((await post({ flightId: 'run-1', encoding: 'gzip-base64', data: '<script>' })).status, 400);
    const got = (await client(env, 'BOB', 'EDTW', '/mission/ALICE')()).body;
    assert.equal(got.encoding, 'gzip-base64');
    const restored = core.restoreSharedMissionState(JSON.parse(gunzipSync(Buffer.from(got.data, 'base64')).toString()));
    assert.equal(restored.activeMissionContract.aptArrivalPlan.geo.length, 1000, 'arrival plan restored on the contract');
    assert.equal(restored.activeMissionContract.crewArrivalPlanFromMission, undefined);
});

test('beats carry position and a bounded route', async () => {
    const env = { GA_CREW_PRESENCE: namespace() };
    const route = Array.from({ length: 80 }, (_, i) => ({ lat: 49 + i * 0.01, lon: 8, name: 'WP' + i }));
    assert.equal((await client(env, 'ALICE')({ source: 'tracker', flight: flight({ route, pos: { lat: 49.2, lon: 8.1, altFt: 3500, hdg: 90, gsKts: 100, at: 7 } }) })).status, 200);
    const alice = (await client(env, 'BOB')()).body.members.find(m => m.pilotId === 'ALICE');
    assert.equal(alice.flight.route.length, 40);
    assert.equal(alice.flight.pos.altFt, 3500);
});

test('auth and membership are cached per isolate; ?fresh=1 checks again', async () => {
    const env = { GA_CREW_PRESENCE: namespace() };
    const before = authCalls;
    const bob = client(env, 'BOB', 'EDFE');
    for (let i = 0; i < 5; i++) await bob();
    assert.equal(authCalls - before, 1);
    await client(env, 'BOB', 'EDFE', '?fresh=1')();
    assert.equal(authCalls - before, 2);
});

test('oversized and malformed beats are refused; flight fields are bounded', async () => {
    const env = { GA_CREW_PRESENCE: namespace() };
    assert.equal((await client(env, 'ALICE')({ source: 'tracker', flight: flight({ title: 'x'.repeat(9000) }) })).status, 413);
    await client(env, 'ALICE')({ source: 'evil', flight: flight({ title: 'y'.repeat(300), phase: 'warp', progress: 7 }) });
    const alice = (await client(env, 'BOB')()).body.members.find(m => m.pilotId === 'ALICE');
    assert.equal(alice.flight.title.length, 120);
    assert.equal(alice.flight.phase, 'ground');
    assert.equal(alice.flight.progress, 1);
});

test('core: landed flights stay visible 30 minutes, stale status goes offline', () => {
    const now = 10_000_000;
    const record = { pilotId: 'A', nick: 'A', share: {}, seenAt: now - 13 * 60 * 1000, flight: flight({ endedAt: now - 20 * 60 * 1000, phase: 'landed' }) };
    let view = core.publicView(record, now);
    assert.equal(view.online, false);
    assert.equal(view.flight.phase, 'landed');
    view = core.publicView({ ...record, flight: flight({ endedAt: now - 31 * 60 * 1000 }) }, now);
    assert.equal(view.flight, undefined);
    view = core.publicView({ ...record, flight: flight() }, now);
    assert.equal(view.flight, undefined, 'running flight without fresh beat is not shown');
});

test('core: route progress follows the route and does not jump back on loops', () => {
    const route = [{ lat: 49, lon: 8 }, { lat: 49, lon: 9 }, { lat: 49, lon: 8 }];
    const mid = core.routeProgress(route, { lat: 49, lon: 8.5 });
    assert.ok(Math.abs(mid.progress - 0.25) < 0.01);
    const back = core.routeProgress(route, { lat: 49, lon: 8.5 }, 1);
    assert.ok(Math.abs(back.progress - 0.75) < 0.01);
    assert.equal(core.routeProgress([{ lat: 49, lon: 8 }], { lat: 49, lon: 8 }), null);
});

test('core: beat pacing', () => {
    const t = 1_000_000;
    assert.equal(core.shouldBeat(null, null, t), true);
    assert.equal(core.shouldBeat({ at: t - 30_000, flight: null }, flight(), t), false, 'events wait for the minimum gap');
    assert.equal(core.shouldBeat({ at: t - 90_000, flight: flight() }, flight({ phase: 'descent' }), t), true);
    assert.equal(core.shouldBeat({ at: t - 90_000, flight: flight() }, flight(), t), false);
    assert.equal(core.shouldBeat({ at: t - core.BEAT_INTERVAL_MS, flight: flight() }, flight(), t), true);
    assert.equal(core.flightPhase({ onGround: true, gsKts: 0 }, true), 'landed');
    assert.equal(core.flightPhase({ onGround: false, vsFpm: 800 }), 'climb');
});
