// Testboard: shared test checklist for testers (testboard.html).
// One Durable Object holds one record per pilot; reads and writes never touch KV
// except for the (cached) Pilot-ID/PIN check.
// Routes (auth: X-Pilot-ID / X-Pilot-PIN):
//   GET  /api/testboard-v1   all testers' results { ok, testers: [{ pilotId, nick, features, updated }] }
//   POST /api/testboard-v1   { feature, status: 'ok'|'bug'|'', note, nick }  sets the caller's own result for one feature

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
const MAX_BODY = 8 * 1024;
const MAX_NOTE = 2000;
const MAX_FEATURES = 400;
const FEATURE_ID = /^[a-z0-9-]{1,120}$/;
const STATUSES = new Set(['ok', 'bug', '']);
const AUTH_CACHE_MS = 10 * 60 * 1000;
const AUTH_CACHE_MAX = 500;
const lower = value => String(value || '').trim().toLowerCase();
const cleanText = (value, max) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max);

export class TestBoard {
    constructor(ctx) { this.ctx = ctx; this.storage = ctx.storage; }

    async fetch(request) {
        try {
            if (request.method === 'GET') {
                const rows = await this.storage.list({ prefix: 'r:' });
                return reply({ ok: true, now: Date.now(), testers: [...rows.values()] });
            }
            if (request.method !== 'POST') return reply({ error: 'method' }, 405);
            const body = await request.json();
            const key = 'r:' + lower(body.pilotId);
            const now = Date.now();
            const record = (await this.storage.get(key)) || { pilotId: body.pilotId, features: {} };
            record.pilotId = body.pilotId;
            if (body.nick) record.nick = body.nick;
            if (body.status === '') delete record.features[body.feature];
            else {
                if (!record.features[body.feature] && Object.keys(record.features).length >= MAX_FEATURES) return reply({ error: 'too_many_features' }, 400);
                record.features[body.feature] = { s: body.status, note: body.status === 'bug' ? body.note : '', at: now };
            }
            record.updated = now;
            await this.storage.put(key, record);
            return reply({ ok: true, record });
        } catch (error) {
            return reply({ error: String(error?.message || error) }, 400);
        }
    }
}

// Successful auth per isolate for a few minutes, so polling costs no KV read.
const authCache = new Map();
async function cacheKey(pilotId, pin) {
    const data = new TextEncoder().encode(`${lower(pilotId)}\n${pin}`);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function testBoardStub(env) {
    return env.GA_TESTBOARD.get(env.GA_TESTBOARD.idFromName('testboard-v1'));
}

export async function handleTestBoard(request, env, authenticate) {
    if (!env.GA_TESTBOARD) return reply({ error: 'testboard_unavailable' }, 503);
    if (!['GET', 'POST'].includes(request.method)) return reply({ error: 'method' }, 405);

    let body = null;
    if (request.method === 'POST') {
        const raw = await request.text();
        if (raw.length > MAX_BODY) return reply({ error: 'request_too_large' }, 413);
        try { body = JSON.parse(raw); } catch (_) { return reply({ error: 'json_invalid' }, 400); }
    }

    const key = await cacheKey(request.headers.get('X-Pilot-ID'), request.headers.get('X-Pilot-PIN') || '');
    let entry = authCache.get(key);
    if (!entry || entry.expires < Date.now()) {
        const auth = await authenticate(request, env);
        if (!auth.ok) return auth.response;
        entry = { ownerId: auth.ownerId, expires: Date.now() + AUTH_CACHE_MS };
        if (authCache.size >= AUTH_CACHE_MAX) authCache.delete(authCache.keys().next().value);
        authCache.set(key, entry);
    }

    const stub = testBoardStub(env);
    if (request.method === 'GET') return stub.fetch(new Request('https://testboard/list'));

    const feature = String(body?.feature || '');
    const status = String(body?.status ?? '');
    if (!FEATURE_ID.test(feature) || !STATUSES.has(status)) return reply({ error: 'entry_invalid' }, 400);
    const update = {
        pilotId: entry.ownerId,
        nick: cleanText(body?.nick, 40).trim(),
        feature,
        status,
        note: cleanText(body?.note, MAX_NOTE)
    };
    return stub.fetch(new Request('https://testboard/set', { method: 'POST', body: JSON.stringify(update) }));
}
