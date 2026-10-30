// Testboard: shared test checklist and problem reports for testers (testboard.html).
// One Durable Object holds one result record per pilot plus the problem reports;
// reads and writes never touch KV except for the (cached) Pilot-ID/PIN check.
// Routes (auth: X-Pilot-ID / X-Pilot-PIN):
//   GET  /api/testboard-v1                     all results and report summaries { ok, testers, reports }
//   POST /api/testboard-v1                     { feature, status: 'ok'|'bug'|'', note, nick }  own result for one feature
//   POST /api/testboard-v1/reports             { text, feature, meta, log, nick }  new problem report (log from the app)
//   GET  /api/testboard-v1/reports/<id>        one report including its log
//   POST /api/testboard-v1/reports/<id>/done   { done: true|false }  mark a report as handled

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
const MAX_BODY = 8 * 1024;
const MAX_REPORT_BODY = 96 * 1024;
const MAX_NOTE = 2000;
const MAX_REPORT_TEXT = 4000;
const MAX_META = 3000;
const MAX_LOG = 80 * 1024;
const MAX_FEATURES = 400;
const MAX_REPORTS = 500;
const FEATURE_ID = /^[a-z0-9-]{1,120}$/;
const REPORT_ID = /^[a-z0-9-]{1,60}$/;
const STATUSES = new Set(['ok', 'bug', '']);
const AUTH_CACHE_MS = 10 * 60 * 1000;
const AUTH_CACHE_MAX = 500;
const lower = value => String(value || '').trim().toLowerCase();
const cleanText = (value, max) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max);
const summary = ({ log, ...report }) => ({ ...report, hasLog: !!log });

export class TestBoard {
    constructor(ctx) { this.ctx = ctx; this.storage = ctx.storage; }

    async list() {
        const [results, reports] = await Promise.all([
            this.storage.list({ prefix: 'r:' }),
            this.storage.list({ prefix: 'b:' })
        ]);
        const reportList = [...reports.values()].map(summary).sort((a, b) => b.at - a.at);
        return reply({ ok: true, now: Date.now(), testers: [...results.values()], reports: reportList });
    }

    async setResult(body) {
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
    }

    async addReport(body) {
        const now = Date.now();
        const id = now.toString(36) + '-' + Math.random().toString(36).slice(2, 8);
        const report = { id, at: now, done: false, pilotId: body.pilotId, nick: body.nick, text: body.text, feature: body.feature, meta: body.meta, log: body.log };
        await this.storage.put('b:' + id, report);
        // Keep the store bounded: drop the oldest reports beyond the limit.
        const all = await this.storage.list({ prefix: 'b:' });
        if (all.size > MAX_REPORTS) {
            const old = [...all.values()].sort((a, b) => a.at - b.at).slice(0, all.size - MAX_REPORTS).map(r => 'b:' + r.id);
            await this.storage.delete(old);
        }
        return reply({ ok: true, report: summary(report) });
    }

    async fetch(request) {
        try {
            const url = new URL(request.url);
            const parts = url.pathname.split('/').filter(Boolean);
            if (parts[0] === 'reports') {
                if (request.method === 'POST' && !parts[1]) return await this.addReport(await request.json());
                const report = await this.storage.get('b:' + parts[1]);
                if (!report) return reply({ error: 'report_missing' }, 404);
                if (request.method === 'GET') return reply({ ok: true, report });
                const body = await request.json();
                report.done = body.done === true;
                report.doneBy = report.done ? body.pilotId : '';
                report.doneAt = report.done ? Date.now() : 0;
                await this.storage.put('b:' + report.id, report);
                return reply({ ok: true, report: summary(report) });
            }
            if (request.method === 'GET') return await this.list();
            if (request.method === 'POST') return await this.setResult(await request.json());
            return reply({ error: 'method' }, 405);
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
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean).slice(2); // after api/testboard-v1
    const reportRoute = parts[0] === 'reports';
    if (parts.length && !reportRoute) return reply({ error: 'not_found' }, 404);
    const reportId = reportRoute ? String(parts[1] || '') : '';
    if (reportId && !REPORT_ID.test(reportId)) return reply({ error: 'report_invalid' }, 400);
    if (reportRoute && request.method === 'POST' && reportId && parts[2] !== 'done') return reply({ error: 'not_found' }, 404);
    if (reportRoute && request.method === 'GET' && !reportId) return reply({ error: 'not_found' }, 404);

    let body = null;
    if (request.method === 'POST') {
        const raw = await request.text();
        if (raw.length > (reportRoute && !reportId ? MAX_REPORT_BODY : MAX_BODY)) return reply({ error: 'request_too_large' }, 413);
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
    const forward = (path, data) => stub.fetch(new Request('https://testboard/' + path, data === undefined ? undefined : { method: 'POST', body: JSON.stringify(data) }));
    const nick = cleanText(body?.nick, 40).trim();

    if (reportRoute) {
        if (request.method === 'GET') return forward('reports/' + reportId);
        if (reportId) return forward(`reports/${reportId}/done`, { pilotId: entry.ownerId, done: body?.done === true });
        const text = cleanText(body?.text, MAX_REPORT_TEXT).trim();
        if (!text) return reply({ error: 'text_missing' }, 400);
        const feature = String(body?.feature || '');
        return forward('reports', {
            pilotId: entry.ownerId,
            nick,
            text,
            feature: FEATURE_ID.test(feature) ? feature : '',
            meta: cleanText(body?.meta, MAX_META),
            log: String(body?.log ?? '').replace(/\u0000/g, '').slice(-MAX_LOG)
        });
    }

    if (request.method === 'GET') return forward('list');
    const feature = String(body?.feature || '');
    const status = String(body?.status ?? '');
    if (!FEATURE_ID.test(feature) || !STATUSES.has(status)) return reply({ error: 'entry_invalid' }, 400);
    return forward('set', { pilotId: entry.ownerId, nick, feature, status, note: cleanText(body?.note, MAX_NOTE) });
}
