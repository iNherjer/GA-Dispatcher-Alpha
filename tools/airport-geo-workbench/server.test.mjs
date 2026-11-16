import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkbenchServer, cloudKey, searchAirports, airportsInBox } from './server.mjs';

const airports = [
    { code: 'EDTF', name: 'Freiburg i. Br. Airport', city: 'Freiburg', country: 'DE', type: '2', lat: 48.0227775574, lon: 7.8324999809 },
    { code: 'OUR-321125', name: 'Malsch-Ettlingen Ultralight Flightpark', city: 'Malsch', country: 'DE', type: 'small_airport', lat: 48.901667, lon: 8.328333 }
];

async function start(fetchImpl) {
    const calls = [];
    const server = createWorkbenchServer({ port: 0, airports, token: 'secret-token-abcdefghijklmnop', fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return fetchImpl ? fetchImpl(url, init) : new Response(JSON.stringify({ ok: true, entries: [] }));
    } });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    // Host-Pruefung erwartet den echten Port.
    server.close();
    const real = createWorkbenchServer({ port, airports, token: 'secret-token-abcdefghijklmnop', fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return fetchImpl ? fetchImpl(url, init) : new Response(JSON.stringify({ ok: true, entries: [] }));
    } });
    await new Promise(r => real.listen(port, '127.0.0.1', r));
    return { base: `http://127.0.0.1:${port}`, calls, close: () => real.close() };
}

test('cloud key matches the app key for Freiburg', () => {
    assert.equal(cloudKey(48.0227775574, 7.8324999809), 'airport_48.0228_7.8325');
});

test('search and bbox filter', () => {
    assert.equal(searchAirports(airports, 'edtf')[0].code, 'EDTF');
    assert.equal(searchAirports(airports, 'malsch')[0].code, 'OUR-321125');
    assert.equal(airportsInBox(airports, [7.7, 47.9, 8.0, 48.1]).length, 1);
});

test('admin calls carry the token to the worker, the browser never sees it', async () => {
    const s = await start(async () => new Response(JSON.stringify({ ok: true, result: 'blocked' })));
    try {
        const res = await fetch(`${s.base}/api/cloud/airport_48.0228_7.8325/admin`, { method: 'POST', body: JSON.stringify({ op: 'block', blocked: [] }) });
        const text = await res.text();
        assert.equal(res.status, 200);
        assert.ok(!text.includes('secret-token'));
        assert.equal(s.calls[0].url, 'https://ga-proxy.einherjer.workers.dev/api/airport-geo-v1/airport_48.0228_7.8325/admin');
        assert.equal(s.calls[0].init.headers['X-Admin-Token'], 'secret-token-abcdefghijklmnop');
        assert.equal(s.calls[0].init.headers['X-Body-Encoding'], 'gzip');
        const { gunzipSync } = await import('node:zlib');
        assert.equal(JSON.parse(gunzipSync(s.calls[0].init.body).toString()).op, 'block');
        const page = await (await fetch(`${s.base}/`)).text();
        assert.ok(!page.includes('secret-token'));
    } finally { s.close(); }
});

test('foreign origins and invalid keys are refused', async () => {
    const s = await start();
    try {
        assert.equal((await fetch(`${s.base}/api/cloud/index`, { headers: { Origin: 'https://evil.example' } })).status, 403);
        assert.equal((await fetch(`${s.base}/api/cloud/..%2Fetc/admin`)).status, 404);
        assert.equal((await fetch(`${s.base}/api/airports?bbox=1,2`)).status, 400);
        const core = await fetch(`${s.base}/core/mission-arrival-core.js`);
        assert.equal(core.status, 200);
        assert.equal((await fetch(`${s.base}/core/../app.js`)).status, 404);
    } finally { s.close(); }
});
