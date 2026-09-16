import '../../cloud-sync-core.js';
const core = globalThis.GACloudSyncCore;
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
const TTL = 24 * 60 * 60 * 1000;
async function readBody(request) {
    const reader = request.body?.getReader(); if (!reader) throw new Error('body_missing');
    const parts = []; let size = 0;
    for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > 96 * 1024) { await reader.cancel(); throw new Error('request_too_large'); }
        parts.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.length; }
    return JSON.parse(new TextDecoder().decode(bytes));
}
// One strongly consistent coordinator per authenticated pilot. KV remains the auth registry.
export class ProfileSync {
    constructor(ctx) { this.ctx = ctx; this.storage = ctx.storage; }
    async fetch(request) {
        try {
            const url = new URL(request.url), action = url.pathname.split('/').pop();
            if (request.method === 'GET' && action === 'head') return reply(await this.storage.get('head') || { revision: 0, manifest: null });
            if (request.method === 'GET' && action === 'profile') {
                const head = await this.storage.get('head');
                if (!head) return reply({ error: 'not_migrated' }, 404);
                const profile = await core.unpack(head.manifest, async id => (await this.storage.get('c:' + id))?.data, url.searchParams.get('mission') === '1' ? ['mission', 'field:lastModified'] : null);
                return reply({ ...profile, _syncRevision: head.revision });
            }
            if (request.method === 'GET' && core.hashPattern.test(action)) {
                const chunk = await this.storage.get('c:' + action);
                return chunk ? reply({ data: chunk.data }) : reply({ error: 'chunk_missing' }, 404);
            }
            if (request.method !== 'POST') return reply({ error: 'method' }, 405);
            const body = await readBody(request);
            if (action === 'missing') {
                if (!Array.isArray(body.ids) || body.ids.length > core.MAX_CHUNKS || body.ids.some(id => !core.hashPattern.test(id))) return reply({ error: 'ids_invalid' }, 400);
                const found = await this.storage.get(body.ids.map(id => 'c:' + id));
                return reply({ missing: body.ids.filter(id => !found.has('c:' + id)) });
            }
            if (action === 'chunk') {
                const bytes = core.unbase64(body.data);
                if (!bytes.length || bytes.length > core.CHUNK_BYTES || await core.hash(bytes) !== body.id) return reply({ error: 'chunk_integrity' }, 400);
                return await this.ctx.blockConcurrencyWhile(async () => {
                    if (await this.storage.get('c:' + body.id)) return reply({ ok: true });
                    const count = Number(await this.storage.get('chunkCount')) || 0;
                    if (count >= 1024) return reply({ error: 'staging_quota' }, 413);
                    await this.storage.put({ ['c:' + body.id]: { data: body.data, at: Date.now() }, chunkCount: count + 1 });
                    if (!await this.storage.getAlarm()) await this.storage.setAlarm(Date.now() + TTL);
                    return reply({ ok: true });
                });
            }
            if (action === 'commit') {
                core.validate(body.manifest);
                if (!Number.isSafeInteger(body.baseRevision) || body.baseRevision < 0) return reply({ error: 'revision_invalid' }, 400);
                const fingerprint = await core.hash(new TextEncoder().encode(core.stringify(body.manifest)));
                return await this.ctx.blockConcurrencyWhile(async () => {
                    const previous = await this.storage.get('head');
                    if (previous?.fingerprint === fingerprint) return reply(previous); // Lost reply: idempotent retry.
                    if ((previous?.revision || 0) !== body.baseRevision) return reply({ error: 'revision_conflict', revision: previous?.revision || 0 }, 409);
                    // Validate complete, bounded decoded data before changing the visible head.
                    await core.unpack(body.manifest, async id => (await this.storage.get('c:' + id))?.data);
                    const head = { revision: (previous?.revision || 0) + 1, manifest: body.manifest, fingerprint, committedAt: Date.now() };
                    await this.storage.put({ head, previous: previous || null });
                    return reply(head);
                });
            }
            return reply({ error: 'not_found' }, 404);
        } catch (error) {
            return reply({ error: String(error?.message || error) }, 400);
        }
    }
    async alarm() {
        await this.ctx.blockConcurrencyWhile(async () => {
            const head = await this.storage.get('head'), previous = await this.storage.get('previous');
            const live = new Set([head, previous].flatMap(h => Object.values(h?.manifest?.sections || {}).flatMap(s => s.chunks)));
            const chunks = await this.storage.list({ prefix: 'c:' });
            const expired = [...chunks].filter(([key, value]) => !live.has(key.slice(2)) && value.at < Date.now() - TTL).map(([key]) => key);
            for (let i = 0; i < expired.length; i += 128) await this.storage.delete(expired.slice(i, i + 128));
            await this.storage.put('chunkCount', chunks.size - expired.length);
            if ([...chunks].some(([key]) => !live.has(key.slice(2)) && !expired.includes(key))) await this.storage.setAlarm(Date.now() + TTL);
        });
    }
}
export function profileStub(env, ownerId, namespace = '') {
    // Re-created pilot IDs must never inherit a deleted/expired account's profile.
    // Existing registrations keep their original namespace without a data migration.
    const identity = namespace ? JSON.stringify([ownerId, namespace]) : ownerId;
    return env.GA_PROFILE_SYNC.get(env.GA_PROFILE_SYNC.idFromName(identity));
}
export async function handleProfileSync(request, env, authenticate) {
    if (!env.GA_PROFILE_SYNC) return reply({ error: 'sync_v2_unavailable' }, 503);
    const auth = await authenticate(request, env); if (!auth.ok) return auth.response;
    const response = await profileStub(env, auth.ownerId, auth.profileSyncNamespace).fetch(request);
    if (request.method === 'GET' && new URL(request.url).pathname.endsWith('/head') && response.ok) {
        const head = await response.json();
        return reply({ ...head, ...(head.revision === 0 ? { legacyLastModified: auth.legacyLastModified || 0, legacyHasData: !!auth.legacyHasData } : {}) });
    }
    return response;
}
