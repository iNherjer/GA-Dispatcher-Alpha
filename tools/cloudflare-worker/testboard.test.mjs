import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TestBoard, handleTestBoard } from './testboard.mjs';

function storage() {
    const records = new Map();
    return {
        records,
        async get(key) { return records.has(key) ? structuredClone(records.get(key)) : undefined; },
        async put(key, value) { records.set(key, structuredClone(value)); },
        async list({ prefix }) { return new Map([...records].filter(([k]) => k.startsWith(prefix))); },
        async delete(keys) { for (const k of [].concat(keys)) records.delete(k); }
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
const req = (pilot, body, pin = '1234', path = '') => new Request('https://x/api/testboard-v1' + path, {
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

test('problem reports: create with log, list without log, fetch full, mark done', async () => {
    const e = env();
    let res = await handleTestBoard(req('anna', { text: '  ', log: 'x' }, '1234', '/reports'), e, auth);
    assert.equal(res.status, 400);
    res = await handleTestBoard(req('anna', { text: 'Karte bleibt grau', log: 'line1\nline2', meta: 'Version v2299', nick: 'Anna', feature: 'bad id!' }, '1234', '/reports'), e, auth);
    assert.equal(res.status, 200);
    const { report } = await res.json();
    assert.equal(report.log, undefined);
    assert.equal(report.hasLog, true);
    const list = await (await handleTestBoard(req('ben'), e, auth)).json();
    assert.equal(list.reports.length, 1);
    assert.equal(list.reports[0].log, undefined);
    assert.equal(list.reports[0].pilotId, 'ANNA');
    assert.equal(list.reports[0].feature, '');
    const full = await (await handleTestBoard(req('ben', null, '1234', '/reports/' + report.id), e, auth)).json();
    assert.equal(full.report.log, 'line1\nline2');
    const done = await (await handleTestBoard(req('ben', { done: true }, '1234', '/reports/' + report.id + '/done'), e, auth)).json();
    assert.equal(done.report.done, true);
    assert.equal(done.report.doneBy, 'BEN');
    assert.equal((await handleTestBoard(req('ben', null, '1234', '/reports/../x'), e, auth)).status, 404);
    assert.equal((await handleTestBoard(req('ben', null, '1234', '/reports/nope'), e, auth)).status, 404);
});

test('large app logs are accepted up to the report limit', async () => {
    const e = env();
    const res = await handleTestBoard(req('anna', { text: 'Absturz', log: 'y'.repeat(90 * 1024) }, '1234', '/reports'), e, auth);
    assert.equal(res.status, 200);
    assert.equal((await handleTestBoard(req('anna', { text: 'x', log: 'y'.repeat(100 * 1024) }, '1234', '/reports'), e, auth)).status, 413);
});
