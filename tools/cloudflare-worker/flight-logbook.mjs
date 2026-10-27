// Flight logbook store: compact flights with track, one Durable Object per authenticated pilot.
// Separate from profile sync so a new flight costs a few KB instead of a profile section rewrite.
// Routes (auth: X-Pilot-ID / X-Pilot-PIN, same as /api/sync-v2/):
//   GET  /api/flightlog-v1/list[?since=<revision>]   entries without track, newest first
//   GET  /api/flightlog-v1/track/<runId>             one track
//   POST /api/flightlog-v1/put     { entry, track }  insert or replace by runId
//   POST /api/flightlog-v1/delete  { runIds } | { kind }
// Concept: docs/Flugbuch Kruemelweg Konzept.md
import '../../flight-track-codec-core.js';
const codec = globalThis.GAFlightTrackCodecCore;

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
const KEEP_PER_KIND = 50;
const MAX_BODY = 48 * 1024;
const MAX_ENTRY = 4 * 1024;
const MAX_TRACK = 32 * 1024;
const RUN_ID = /^[A-Za-z0-9_.:-]{1,120}$/;
const KINDS = new Set(['free', 'mission']);

async function readBody(request) {
    const text = await request.text();
    if (text.length > MAX_BODY) throw new Error('request_too_large');
    return JSON.parse(text);
}

// Plain JSON only, bounded; the entry is display data, never instructions.
function cleanEntry(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('entry_invalid');
    if (!KINDS.has(entry.kind) || !RUN_ID.test(String(entry.runId || ''))) throw new Error('entry_invalid');
    const { track, ...rest } = entry;
    const json = JSON.stringify(rest);
    if (json.length > MAX_ENTRY) throw new Error('entry_too_large');
    const clean = JSON.parse(json);
    clean.endTs = Number(clean.endTs) || Number(clean.createdAt) || 0;
    return clean;
}

function cleanTrack(track) {
    if (!track) return null;
    if (JSON.stringify(track).length > MAX_TRACK) throw new Error('track_too_large');
    codec.decodeTrack(track); // throws on malformed data
    return track;
}

export class FlightLogbook {
    constructor(ctx) { this.ctx = ctx; this.storage = ctx.storage; }

    async entries() {
        const rows = await this.storage.list({ prefix: 'm:' });
        return [...rows.values()].sort((a, b) => Number(b.endTs || 0) - Number(a.endTs || 0));
    }

    async fetch(request) {
        try {
            const url = new URL(request.url);
            const parts = url.pathname.split('/').filter(Boolean);
            const at = parts.indexOf('flightlog-v1');
            const action = parts[at + 1] || '';
            if (request.method === 'GET' && action === 'list') {
                const revision = Number(await this.storage.get('revision')) || 0;
                const since = url.searchParams.get('since');
                if (since !== null && Number(since) === revision) return reply({ revision, unchanged: true });
                return reply({ revision, keepPerKind: KEEP_PER_KIND, entries: await this.entries() });
            }
            if (request.method === 'GET' && action === 'track') {
                const runId = decodeURIComponent(parts[at + 2] || '');
                if (!RUN_ID.test(runId)) return reply({ error: 'run_invalid' }, 400);
                const track = await this.storage.get('t:' + runId);
                return track ? reply({ runId, track }) : reply({ error: 'track_missing' }, 404);
            }
            if (request.method !== 'POST') return reply({ error: 'method' }, 405);
            const body = await readBody(request);
            if (action === 'put') {
                const entry = cleanEntry(body.entry);
                const track = cleanTrack(body.track);
                return await this.ctx.blockConcurrencyWhile(async () => {
                    const meta = { ...entry, hasTrack: !!track, trackPoints: track?.n || 0, storedAt: Date.now() };
                    const updates = { ['m:' + entry.runId]: meta };
                    if (track) updates['t:' + entry.runId] = track;
                    const revision = (Number(await this.storage.get('revision')) || 0) + 1;
                    updates.revision = revision;
                    await this.storage.put(updates);
                    // Newest KEEP_PER_KIND per kind survive.
                    const old = (await this.entries()).filter(e => e.kind === entry.kind).slice(KEEP_PER_KIND);
                    if (old.length) await this.storage.delete(old.flatMap(e => ['m:' + e.runId, 't:' + e.runId]));
                    return reply({ ok: true, revision, runId: entry.runId, pruned: old.length });
                });
            }
            if (action === 'delete') {
                return await this.ctx.blockConcurrencyWhile(async () => {
                    let targets = [];
                    if (Array.isArray(body.runIds)) targets = body.runIds.map(String).filter(id => RUN_ID.test(id)).slice(0, 200);
                    else if (KINDS.has(body.kind)) targets = (await this.entries()).filter(e => e.kind === body.kind).map(e => e.runId);
                    else return reply({ error: 'delete_invalid' }, 400);
                    if (targets.length) await this.storage.delete(targets.flatMap(id => ['m:' + id, 't:' + id]));
                    const revision = (Number(await this.storage.get('revision')) || 0) + 1;
                    await this.storage.put('revision', revision);
                    return reply({ ok: true, revision, deleted: targets.length });
                });
            }
            return reply({ error: 'not_found' }, 404);
        } catch (error) {
            const message = String(error?.message || error);
            return reply({ error: message }, /too_large/.test(message) ? 413 : 400);
        }
    }
}

// Same identity rule as profile sync: verified storage anchor (survives ID renames)
// plus registration namespace (a re-created ID never inherits old flights).
export function flightLogbookStub(env, ownerId, namespace = '') {
    const identity = JSON.stringify(['flight-logbook', ownerId, namespace || '']);
    return env.GA_FLIGHT_LOGBOOK.get(env.GA_FLIGHT_LOGBOOK.idFromName(identity));
}

export async function handleFlightLogbook(request, env, authenticate) {
    if (!env.GA_FLIGHT_LOGBOOK) return reply({ error: 'flight_logbook_unavailable' }, 503);
    const auth = await authenticate(request, env);
    if (!auth.ok) return auth.response;
    return flightLogbookStub(env, auth.storageOwnerId || auth.ownerId, auth.profileSyncNamespace).fetch(request);
}
