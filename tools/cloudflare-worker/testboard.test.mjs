import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TestBoard, handleTestBoard } from './testboard.mjs';

function storage() {
    const records = new Map();
    return {
        records,
        async get(key) { return records.has(key) ? structuredClone(records.get(key)) : undefined; },
        async put(key, value) { records.set(key, structuredClone(value)); },
        async list({ prefix }) { return new Map([...records].filter(([k]) => k.startsWith(prefix))); }
    };
}

function env() {
    const board = new TestBoard({ storage: storage() });
    return { board, GA_TESTBOARD: { idFromName: name => name, get: () => ({ fetch: request => board.fetch(request) }) } };
}

let authCalls = 0;
const auth = async request => {
    authCalls++;
    const id = request.headers.get('X-Pilot-ID');
    if (request.headers.get('X-Pilot-PIN') !== '1234') return { ok: false, response: new Response('{}', { status: 401 }) };
    return { ok: true, ownerId: id.toUpperCase() };
};
const req = (pilot, body, pin = '1234') => new Request('https://x/api/testboard-v1', {
    method: body ? 'POST' : 'GET',
    headers: { 'X-Pilot-ID': pilot, 'X-Pilot-PIN': pin },
    body: body ? JSON.stringify(body) : undefined
});

test('wrong PIN is refused', async () => {
    const e = env();
    const res = await handleTestBoard(req('anna', null, '0000'), e, auth);
    assert.equal(res.status, 401);
});

test('testers set, change and clear their own results; everyone reads all', async () => {
    const e = env();
    let res = await handleTestBoard(req('anna', { feature: 'dispatch--zufall', status: 'bug', note: 'Hängt', nick: 'Anna' }), e, auth);
    assert.equal(res.status, 200);
    await handleTestBoard(req('ben', { feature: 'dispatch--zufall', status: 'ok' }), e, auth);
    await handleTestBoard(req('anna', { feature: 'tracker--updates', status: 'ok', note: 'ignored' }), e, auth);
    res = await handleTestBoard(req('ben'), e, auth);
    const data = await res.json();
    assert.equal(data.testers.length, 2);
    const anna = data.testers.find(t => t.pilotId === 'ANNA');
    assert.equal(anna.nick, 'Anna');
    assert.equal(anna.features['dispatch--zufall'].note, 'Hängt');
    assert.equal(anna.features['tracker--updates'].note, '');
    await handleTestBoard(req('anna', { feature: 'dispatch--zufall', status: '' }), e, auth);
    const after = await (await handleTestBoard(req('anna'), e, auth)).json();
    assert.equal(after.testers.find(t => t.pilotId === 'ANNA').features['dispatch--zufall'], undefined);
});

test('invalid entries and oversized bodies are refused', async () => {
    const e = env();
    assert.equal((await handleTestBoard(req('anna', { feature: '../x', status: 'ok' }), e, auth)).status, 400);
    assert.equal((await handleTestBoard(req('anna', { feature: 'a', status: 'maybe' }), e, auth)).status, 400);
    assert.equal((await handleTestBoard(req('anna', { feature: 'a', status: 'bug', note: 'x'.repeat(9000) }), e, auth)).status, 413);
});

test('repeated polls reuse the cached login', async () => {
    const e = env();
    authCalls = 0;
    await handleTestBoard(req('carla'), e, auth);
    await handleTestBoard(req('carla'), e, auth);
    assert.equal(authCalls, 1);
});
