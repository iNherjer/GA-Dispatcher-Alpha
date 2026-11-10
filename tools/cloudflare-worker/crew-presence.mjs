// Crew presence: online status and current flight per crew member.
// One Durable Object per crew; separate from GROUP_ KV so status beats never cost KV writes.
// Routes (auth: X-Pilot-ID / X-Pilot-PIN, plus active membership in GROUP_<crew>):
//   GET  /api/crew-presence-v1/<crew>          members' public status (online, flight)
//   POST /api/crew-presence-v1/<crew>          beat { source, share, flight } | { offline: true }
//   POST /api/crew-presence-v1/<crew>/mission  { flightId, encoding: 'gzip-base64', data } (tracker >= v597)
//                                              or { flightId, state } (v596); mission of the current flight, once per flight
//   GET  /api/crew-presence-v1/<crew>/mission/<pilotId>  that mission, while the flight is shared and visible
// Shared rules (sharing defaults, visibility windows, write throttling): crew-presence-core.js
import '../../crew-presence-core.js';
const core = globalThis.GACrewPresenceCore;

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
const MAX_BODY = 8 * 1024;
const MAX_MISSION_BODY = 64 * 1024;
const FLIGHT_ID = /^[A-Za-z0-9_.:-]{1,120}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const PURGE_AFTER_MS = 2 * 24 * 60 * 60 * 1000;
const AUTH_CACHE_MS = 10 * 60 * 1000;
const AUTH_CACHE_MAX = 500;
const SOURCES = new Set(['tracker', 'web']);
const lower = value => String(value || '').trim().toLowerCase();
const LIVE_TICKET_MS = 2 * 60 * 60 * 1000;

// Short-lived, signed ticket for the crew live room on the relay (ga-relay, CrewLiveRoom).
// The relay has no profile access; it trusts membership checked here. HMAC-SHA256 with the
// secret CREW_LIVE_SECRET, set identically in both workers.
function base64Url(bytes) {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function signCrewLiveTicket(secret, payload) {
    const body = base64Url(new TextEncoder().encode(JSON.stringify(payload)));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
    return `${body}.${base64Url(signature)}`;
}

export class CrewPresence {
    constructor(ctx) { this.ctx = ctx; this.storage = ctx.storage; }

    // Mission of a member's current flight, for "fly it yourself".
    async mission(request, url, now) {
        if (request.method === 'POST') {
            const body = await request.json();
            const id = lower(body.pilotId);
            const stored = await this.storage.get('m:' + id);
            if (stored?.flightId === body.flightId) return reply({ ok: true, stored: false });
            const payload = body.encoding ? { encoding: body.encoding, data: body.data } : { state: body.state };
            await this.storage.put('m:' + id, { flightId: body.flightId, ...payload, storedAt: now });
            return reply({ ok: true, stored: true });
        }
        const id = lower(url.searchParams.get('pilot'));
        const members = new Set(url.searchParams.getAll('m').map(lower));
        if (!id || !members.has(id)) return reply({ error: 'mission_missing' }, 404);
        const [record, mission] = await Promise.all([this.storage.get('p:' + id), this.storage.get('m:' + id)]);
        const view = core.publicView(record, now);
        if (!view?.flight || !mission || mission.flightId !== view.flight.id) return reply({ error: 'mission_missing' }, 404);
        return reply(mission.encoding
            ? { ok: true, flightId: mission.flightId, encoding: mission.encoding, data: mission.data }
            : { ok: true, flightId: mission.flightId, state: mission.state });
    }

    async fetch(request) {
        try {
            const url = new URL(request.url);
            const now = Date.now();
            const action = url.pathname.split('/').filter(Boolean)[0] || '';
            if (action === 'mission') return await this.mission(request, url, now);
            // Revision of the crew fleet (crew-fleet.mjs); the board loads the fleet only when it changed.
            if (action === 'fleet-rev' && request.method === 'POST') {
                const rev = Number((await request.json())?.rev);
                if (Number.isSafeInteger(rev) && rev !== this.fleetRev) { this.fleetRev = rev; await this.storage.put('fleetRev', rev); }
                return reply({ ok: true });
            }
            if (request.method === 'GET') {
                const members = new Set(url.searchParams.getAll('m').map(lower));
                const rows = await this.storage.list({ prefix: 'p:' });
                const list = [];
                for (const record of rows.values()) {
                    if (!members.has(lower(record.pilotId))) continue;
                    const view = core.publicView(record, now);
                    if (view && (view.online || view.flight)) list.push(view);
                }
                if (this.fleetRev === undefined) this.fleetRev = Number(await this.storage.get('fleetRev')) || 0;
                return reply({ ok: true, now, members: list, fleetRev: this.fleetRev });
            }
            if (request.method !== 'POST') return reply({ error: 'method' }, 405);
            const beat = await request.json();
            const key = 'p:' + lower(beat.pilotId);
            if (beat.offline === true) {
                await this.storage.delete(key);
                return reply({ ok: true, stored: false, offline: true });
            }
            const stored = await this.storage.get(key);
            const merged = core.mergeBeat(stored, beat, now);
            if (!core.shouldStore(stored, merged, now)) return reply({ ok: true, stored: false });
            const keepSeen = stored && merged.source === 'tracker' && beat.source === 'web';
            await this.storage.put(key, { ...merged, seenAt: keepSeen ? stored.seenAt : now });
            // The shared mission belongs to one flight; drop it once another flight starts.
            // The tracker uploads the new flight's mission before its first beat, so keep a mission
            // that already belongs to the new flight.
            const missionKey = 'm:' + lower(beat.pilotId);
            if (merged.flight?.id && stored?.flight?.id && merged.flight.id !== stored.flight.id) {
                const mission = await this.storage.get(missionKey);
                if (mission && mission.flightId !== merged.flight.id) await this.storage.delete(missionKey);
            }
            // Rare cleanup of members who vanished without an offline beat.
            if (Math.random() < 0.05) {
                const rows = await this.storage.list({ prefix: 'p:' });
                const old = [...rows.entries()].filter(([, r]) => now - Number(r.seenAt || 0) > PURGE_AFTER_MS).map(([k]) => k);
                if (old.length) await this.storage.delete(old.flatMap(k => [k, 'm:' + k.slice(2)]));
            }
            return reply({ ok: true, stored: true });
        } catch (error) {
            return reply({ error: String(error?.message || error) }, 400);
        }
    }
}

// Successful auth + membership per isolate for a few minutes: a beat or a poll
// then costs no KV read. Key is a hash, the PIN itself is never kept.
const authCache = new Map();
async function cacheKey(pilotId, pin, crew) {
    const data = new TextEncoder().encode(`${lower(pilotId)}\n${pin}\n${crew}`);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function crewMembers(group) {
    const kicked = new Set((Array.isArray(group?.kicked) ? group.kicked : []).map(lower));
    const members = new Map();
    for (const member of (Array.isArray(group?.members) ? group.members : [])) {
        const id = lower(member?.syncId);
        if (id && !kicked.has(id)) members.set(id, { pilotId: String(member.syncId), nick: String(member.nick || member.syncId || 'Pilot').slice(0, 64) });
    }
    return members;
}

export function crewPresenceStub(env, crew) {
    return env.GA_CREW_PRESENCE.get(env.GA_CREW_PRESENCE.idFromName(JSON.stringify(['crew-presence', crew])));
}

export async function handleCrewPresence(request, env, authenticate, readGroup) {
    if (!env.GA_CREW_PRESENCE) return reply({ error: 'crew_presence_unavailable' }, 503);
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const crew = decodeURIComponent(parts[2] || '').trim().toUpperCase().slice(0, 80);
    const missionRoute = parts[3] === 'mission';
    const ticketRoute = parts[3] === 'live-ticket';
    if (!crew) return reply({ error: 'crew_invalid' }, 400);
    if (!['GET', 'POST'].includes(request.method)) return reply({ error: 'method' }, 405);

    let body = null;
    if (request.method === 'POST') {
        const raw = await request.text();
        if (raw.length > (missionRoute ? MAX_MISSION_BODY : MAX_BODY)) return reply({ error: 'request_too_large' }, 413);
        try { body = JSON.parse(raw); } catch (_) { return reply({ error: 'json_invalid' }, 400); }
    }

    const key = await cacheKey(request.headers.get('X-Pilot-ID'), request.headers.get('X-Pilot-PIN') || '', crew);
    let entry = authCache.get(key);
    // ?fresh=1 (refresh button on the crew board): check membership again right away.
    const fresh = url.searchParams.get('fresh') === '1';
    if (!entry || entry.expires < Date.now() || fresh) {
        const auth = await authenticate(request, env);
        if (!auth.ok) return auth.response;
        const group = await readGroup(env, crew);
        const members = crewMembers(group);
        const me = members.get(lower(auth.ownerId));
        if (!me) return reply({ error: 'not_member' }, 403);
        entry = { ownerId: auth.ownerId, nick: me.nick, members: [...members.keys()], expires: Date.now() + AUTH_CACHE_MS };
        if (authCache.size >= AUTH_CACHE_MAX) authCache.delete(authCache.keys().next().value);
        authCache.set(key, entry);
    }

    if (ticketRoute) {
        if (request.method !== 'GET') return reply({ error: 'method' }, 405);
        const secret = String(env.CREW_LIVE_SECRET || '');
        if (secret.length < 32) return reply({ error: 'crew_live_unavailable' }, 503);
        const exp = Date.now() + LIVE_TICKET_MS;
        const ticket = await signCrewLiveTicket(secret, { v: 1, crew, pid: entry.ownerId, nick: entry.nick, exp });
        return reply({ ok: true, ticket, exp });
    }

    const stub = crewPresenceStub(env, crew);
    if (missionRoute) {
        const query = new URLSearchParams();
        entry.members.forEach(id => query.append('m', id));
        if (request.method === 'GET') {
            query.set('pilot', decodeURIComponent(parts[4] || ''));
            return stub.fetch(new Request('https://crew-presence/mission?' + query.toString()));
        }
        const flightId = String(body?.flightId || '');
        if (!FLIGHT_ID.test(flightId)) return reply({ error: 'mission_invalid' }, 400);
        // Compressed missions are opaque here; the tracker strips runtime fields before packing.
        if (body?.encoding !== undefined) {
            const data = String(body.data || '');
            if (body.encoding !== 'gzip-base64' || !data || !BASE64.test(data)) return reply({ error: 'mission_invalid' }, 400);
            return stub.fetch(new Request('https://crew-presence/mission', { method: 'POST', body: JSON.stringify({ pilotId: entry.ownerId, flightId, encoding: 'gzip-base64', data }) }));
        }
        const state = core.plannedMissionState(body?.state);
        if (!state) return reply({ error: 'mission_invalid' }, 400);
        return stub.fetch(new Request('https://crew-presence/mission', { method: 'POST', body: JSON.stringify({ pilotId: entry.ownerId, flightId, state }) }));
    }
    if (request.method === 'GET') {
        const query = new URLSearchParams();
        entry.members.forEach(id => query.append('m', id));
        return stub.fetch(new Request('https://crew-presence/list?' + query.toString()));
    }
    const beat = body?.offline === true
        ? { pilotId: entry.ownerId, offline: true }
        : {
            pilotId: entry.ownerId,
            nick: entry.nick,
            source: SOURCES.has(body?.source) ? body.source : 'web',
            share: core.normalizeShare(body?.share),
            flight: core.cleanFlight(body?.flight)
        };
    return stub.fetch(new Request('https://crew-presence/beat', { method: 'POST', body: JSON.stringify(beat) }));
}
