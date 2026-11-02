// Crew fleet: aircraft parked with the MSFS mod "Where I Left It", shared per crew.
// One Durable Object per crew; no KV writes. Merge and lock rules: wili-fleet-core.js.
// Routes (auth: X-Pilot-ID / X-Pilot-PIN, plus membership in GROUP_<crew>):
//   GET  /api/crew-fleet-v1/<crew>?since=<rev>  records changed after <rev>;
//        { ok, rev, unchanged: true } when nothing changed (tiny reply, no record reads)
//   POST /api/crew-fleet-v1/<crew>              { records: [{ key, pos, log }] }  (desktop app)
//        -> { ok, rev, changed, ignored, blocked: [keys used by someone else] }
//   POST /api/crew-fleet-v1/<crew>/reserve      { key }  (crew board) -> 409 when used by someone else
//   POST /api/crew-fleet-v1/<crew>/release      { key }
//   POST /api/crew-fleet-v1/<crew>/event        { event: claim|unclaim|takeoff|parked, title, tail, lat, lon }  (tracker)
//   GET  /api/crew-fleet-v1/<crew>/ws           WebSocket (desktop app): { type: 'fleet', rev } on every
//        change. Hibernating: an idle connection costs nothing; "ping" is answered without waking.
// Every change also stores the revision in the crew presence object, so the crew board sees
// it in its regular presence poll and loads the fleet only then.
import '../../wili-fleet-core.js';
import { crewPresenceStub } from './crew-presence.mjs';
const core = globalThis.GAWiliFleetCore;

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
const MAX_BODY = 512 * 1024;
const MAX_UPLOAD_RECORDS = 120;
const MAX_SOCKETS = 200;
const AUTH_CACHE_MS = 30 * 60 * 1000;
const AUTH_CACHE_MAX = 500;
const ACTIONS = new Set(['reserve', 'release', 'event']);
const EVENTS = new Set(['claim', 'unclaim', 'takeoff', 'parked']);
const lower = value => String(value || '').trim().toLowerCase();
const text = (value, max) => String(value ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

export class CrewFleet {
    constructor(ctx) {
        this.ctx = ctx;
        this.storage = ctx.storage;
        this.cache = null;
        try {
            if (typeof WebSocketRequestResponsePair === 'function') ctx.setWebSocketAutoResponse?.(new WebSocketRequestResponsePair('ping', 'pong'));
        } catch (_) {}
    }

    // All records stay in memory while the object is alive; a crew has a few dozen aircraft.
    async load() {
        if (this.cache) return this.cache;
        const [meta, rows] = await Promise.all([this.storage.get('meta'), this.storage.list({ prefix: 'r:' })]);
        this.cache = { rev: Number(meta?.rev) || 0, records: new Map([...rows.values()].map(record => [record.key, record])) };
        return this.cache;
    }

    async save(state, changedRecords) {
        state.rev++;
        const writes = { meta: { rev: state.rev } };
        for (const record of changedRecords) {
            record.rev = state.rev;
            state.records.set(record.key, record);
            writes['r:' + record.key] = record;
        }
        const entries = Object.entries(writes);
        for (let i = 0; i < entries.length; i += 128) await this.storage.put(Object.fromEntries(entries.slice(i, i + 128)));
        this.broadcast(state.rev);
    }

    broadcast(rev) {
        const message = JSON.stringify({ type: 'fleet', rev });
        for (const socket of this.ctx.getWebSockets?.() || []) {
            try { socket.send(message); } catch (_) {}
        }
    }

    // Sent lock as it counts now (expired locks read as free).
    view(record, now) {
        return { ...record, lock: core.activeLock(record.lock, now) };
    }

    async fetch(request) {
        try {
            const url = new URL(request.url);
            const route = url.pathname.split('/').filter(Boolean)[0] || '';
            const now = Date.now();
            if (route === 'ws') {
                if ((this.ctx.getWebSockets?.() || []).length >= MAX_SOCKETS) return reply({ error: 'too_many_connections' }, 429);
                const pair = new WebSocketPair();
                this.ctx.acceptWebSocket(pair[1]);
                return new Response(null, { status: 101, webSocket: pair[0] });
            }
            if (request.method === 'GET') {
                const since = Number(url.searchParams.get('since'));
                const meta = this.cache || { rev: Number((await this.storage.get('meta'))?.rev) || 0 };
                // since > rev: the object was reset; the client must take everything again.
                if (Number.isSafeInteger(since) && since === meta.rev) return reply({ ok: true, rev: meta.rev, unchanged: true });
                const state = await this.load();
                const full = !Number.isSafeInteger(since) || since < 0 || since > state.rev;
                const records = [...state.records.values()].filter(record => full || record.rev > since).map(record => this.view(record, now));
                return reply({ ok: true, rev: state.rev, full, records });
            }
            if (request.method !== 'POST') return reply({ error: 'method' }, 405);
            const body = await request.json();
            const state = await this.load();
            const pilot = { pilotId: body.pilotId, nick: body.nick };
            if (route === 'reserve' || route === 'release') return await this.lockAction(state, route, body.key, pilot, now);
            if (route === 'event') return await this.flightEvent(state, body, pilot, now);
            return await this.upsert(state, body, pilot, now);
        } catch (error) {
            this.cache = null;
            return reply({ error: String(error?.message || error) }, 400);
        }
    }

    async upsert(state, body, pilot, now) {
        const changed = [];
        const blocked = [];
        let ignored = 0;
        for (const upload of body.records) {
            const stored = state.records.get(upload.key);
            if (!stored && state.records.size + changed.length >= core.MAX_RECORDS) { ignored++; continue; }
            // Someone else reserved or flies this aircraft: their state counts, this copy does not.
            if (stored && core.blockedFor(stored.lock, pilot.pilotId, now)) { blocked.push(upload.key); continue; }
            const merged = core.mergeRecord(stored, upload);
            // The holder's export after landing ends the use of the aircraft.
            const lock = core.applyLock(stored?.lock, 'uploaded', pilot, now);
            const sameContent = stored && core.recordSignature(merged) === core.recordSignature(stored);
            if (sameContent && !lock.changed) { ignored++; continue; }
            changed.push({
                ...(stored || {}),
                key: upload.key, pos: merged.pos, log: merged.log, updatedAt: sameContent ? stored.updatedAt : now,
                ownerPilotId: stored?.ownerPilotId || pilot.pilotId, ownerNick: stored?.ownerNick || pilot.nick,
                lastPilotId: sameContent ? stored.lastPilotId : pilot.pilotId, lastNick: sameContent ? stored.lastNick : pilot.nick,
                lock: lock.lock
            });
        }
        if (changed.length) await this.save(state, changed);
        return reply({ ok: true, rev: state.rev, saved: changed.length > 0, changed: changed.length, ignored, blocked });
    }

    async lockAction(state, action, key, pilot, now) {
        const stored = state.records.get(key);
        if (!stored) return reply({ error: 'aircraft_unknown' }, 404);
        const result = core.applyLock(stored.lock, action, pilot, now);
        if (result.refused) return reply({ error: 'aircraft_in_use', holder: { nick: result.holder.nick, state: result.holder.state } }, 409);
        if (result.changed) await this.save(state, [{ ...stored, lock: result.lock }]);
        return reply({ ok: true, rev: state.rev, saved: result.changed, lock: core.activeLock(result.lock, now) });
    }

    async flightEvent(state, body, pilot, now) {
        const key = core.matchAircraft(state.records.values(), body);
        if (!key) return reply({ ok: true, matched: false });
        const stored = state.records.get(key);
        const result = core.applyLock(stored.lock, body.event, pilot, now);
        if (result.refused) {
            // Flown anyway: the holder keeps the aircraft; the crew board shows who else flew it.
            await this.save(state, [{ ...stored, conflict: { pilotId: pilot.pilotId, nick: pilot.nick, event: body.event, at: now } }]);
            return reply({ ok: true, rev: state.rev, saved: true, matched: true, key, refused: true, holder: { nick: result.holder.nick, state: result.holder.state } });
        }
        if (result.changed) await this.save(state, [{ ...stored, lock: result.lock, conflict: null }]);
        return reply({ ok: true, rev: state.rev, saved: result.changed, matched: true, key, lock: core.activeLock(result.lock, now) });
    }

    webSocketMessage(socket, message) {
        if (message === 'ping') try { socket.send('pong'); } catch (_) {}
    }

    webSocketClose(socket, code) {
        try { socket.close(code === 1005 ? 1000 : code, 'closed'); } catch (_) {}
    }
}

// Successful auth + membership per isolate: polls then cost no KV read. Key is a hash,
// the PIN itself is never kept.
const authCache = new Map();
async function cacheKey(pilotId, pin, crew) {
    const data = new TextEncoder().encode(`fleet\n${lower(pilotId)}\n${pin}\n${crew}`);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function crewMember(group, pilotId) {
    const id = lower(pilotId);
    const kicked = new Set((Array.isArray(group?.kicked) ? group.kicked : []).map(lower));
    if (!id || kicked.has(id)) return null;
    const member = (Array.isArray(group?.members) ? group.members : []).find(entry => lower(entry?.syncId) === id);
    return member ? { nick: String(member.nick || member.syncId || 'Pilot').slice(0, 64) } : null;
}

export function crewFleetStub(env, crew) {
    return env.GA_CREW_FLEET.get(env.GA_CREW_FLEET.idFromName(JSON.stringify(['crew-fleet', crew])));
}

export function cleanUpload(body) {
    const list = Array.isArray(body?.records) ? body.records : null;
    if (!list || list.length > MAX_UPLOAD_RECORDS) return null;
    const records = [];
    for (const entry of list) {
        if (!core.validKey(entry?.key)) return null;
        const pos = entry.pos == null ? null : core.cleanPos(entry.pos);
        const log = entry.log == null ? null : core.cleanLog(entry.log);
        if ((entry.pos != null && !pos) || (entry.log != null && !log) || (!pos && !log)) return null;
        records.push({ key: String(entry.key), pos, log });
    }
    return records;
}

function cleanAction(action, body) {
    if (action === 'event') {
        if (!EVENTS.has(body?.event)) return null;
        const lat = Number(body.lat), lon = Number(body.lon);
        return {
            event: body.event, title: text(body.title, 200), tail: text(body.tail, 40),
            lat: Number.isFinite(lat) && Math.abs(lat) <= 90 ? lat : undefined,
            lon: Number.isFinite(lon) && Math.abs(lon) <= 180 ? lon : undefined
        };
    }
    return core.validKey(body?.key) ? { key: String(body.key) } : null;
}

export async function handleCrewFleet(request, env, authenticate, readGroup) {
    if (!env.GA_CREW_FLEET) return reply({ error: 'crew_fleet_unavailable' }, 503);
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const crew = decodeURIComponent(parts[2] || '').trim().toUpperCase().slice(0, 80);
    const action = parts[3] || '';
    if (!crew || parts.length > 4 || (action && action !== 'ws' && !ACTIONS.has(action))) return reply({ error: 'crew_invalid' }, 400);
    const socket = action === 'ws';
    if (socket ? request.headers.get('Upgrade') !== 'websocket' : !['GET', 'POST'].includes(request.method)) return reply({ error: 'method' }, socket ? 426 : 405);
    if (ACTIONS.has(action) && request.method !== 'POST') return reply({ error: 'method' }, 405);

    let payload = null;
    if (request.method === 'POST') {
        const raw = await request.text();
        if (raw.length > MAX_BODY) return reply({ error: 'request_too_large' }, 413);
        let body;
        try { body = JSON.parse(raw); } catch (_) { return reply({ error: 'json_invalid' }, 400); }
        payload = action ? cleanAction(action, body) : cleanUpload(body);
        if (!payload) return reply({ error: action ? 'action_invalid' : 'records_invalid' }, 400);
    }

    const key = await cacheKey(request.headers.get('X-Pilot-ID'), request.headers.get('X-Pilot-PIN') || '', crew);
    let entry = authCache.get(key);
    if (!entry || entry.expires < Date.now()) {
        const auth = await authenticate(request, env);
        if (!auth.ok) return auth.response;
        const me = crewMember(await readGroup(env, crew), auth.ownerId);
        if (!me) return reply({ error: 'not_member' }, 403);
        entry = { ownerId: auth.ownerId, nick: me.nick, expires: Date.now() + AUTH_CACHE_MS };
        if (authCache.size >= AUTH_CACHE_MAX) authCache.delete(authCache.keys().next().value);
        authCache.set(key, entry);
    }

    const stub = crewFleetStub(env, crew);
    if (socket) return stub.fetch(new Request('https://crew-fleet/ws', { headers: { Upgrade: 'websocket' } }));
    if (request.method === 'GET') {
        const since = url.searchParams.get('since');
        return stub.fetch(new Request('https://crew-fleet/list' + (since != null ? '?since=' + encodeURIComponent(since) : '')));
    }
    const body = action
        ? { pilotId: entry.ownerId, nick: entry.nick, ...payload }
        : { pilotId: entry.ownerId, nick: entry.nick, records: payload };
    const response = await stub.fetch(new Request('https://crew-fleet/' + (action || 'upsert'), { method: 'POST', body: JSON.stringify(body) }));
    const data = await response.clone().json().catch(() => null);
    if (env.GA_CREW_PRESENCE && data?.saved === true && Number.isSafeInteger(data.rev)) {
        // The crew board reads this in its presence poll; cheap, only when something was sent.
        try {
            await crewPresenceStub(env, crew).fetch(new Request('https://crew-presence/fleet-rev', { method: 'POST', body: JSON.stringify({ rev: data.rev }) }));
        } catch (_) {}
    }
    return response;
}
