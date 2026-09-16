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
    async storeParts(parts) {
        if (!Array.isArray(parts) || !parts.length || parts.length > 127) throw new Error('parts_invalid');
        const unique = new Map();
        for (const part of parts) {
            const bytes = core.unbase64(part?.data);
            if (!bytes.length || bytes.length > core.CHUNK_BYTES || await core.hash(bytes) !== part.id) throw new Error('chunk_integrity');
            unique.set(part.id, part.data);
        }
        // Validate the whole batch before writing; retry only writes missing keys.
        const found = await this.storage.get([...unique.keys()].map(id => 'c:' + id));
        const missing = [...unique].filter(([id]) => !found.has('c:' + id));
        if (!missing.length) return;
        const count = Number(await this.storage.get('chunkCount')) || 0;
        if (count + missing.length > 1024) throw new Error('staging_quota');
        const updates = { chunkCount: count + missing.length };
        for (const [id, data] of missing) updates['c:' + id] = { data, at: Date.now() };
        await this.storage.put(updates);
        if (!await this.storage.getAlarm()) await this.storage.setAlarm(Date.now() + TTL);
    }
    async fetch(request) {
        try {
            const url = new URL(request.url), action = url.pathname.split('/').pop();
            if (request.method === 'GET' && action === 'head') {
                return await this.ctx.blockConcurrencyWhile(async () => {
                    const head = await this.storage.get('head') || { revision: 0, manifest: null };
                    const metadata = head.manifest?.sections?.['field:lastModified'];
                    if (url.searchParams.get('inlineMetadata') !== '1' && metadata?.inline !== undefined) {
                        // Old cores ignore inline data and fetch the hash URL. Persist it
                        // before returning this head, preserving their delayed-read path.
                        await this.storeParts([{ id: metadata.chunks[0], data: metadata.inline }]);
                    }
                    return reply({ ...head, capabilities: { inlineMetadata: true, batchChunks: true } });
                });
            }
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
                const found = new Map();
                for (let i = 0; i < body.ids.length; i += 128) {
                    for (const [key, value] of await this.storage.get(body.ids.slice(i, i + 128).map(id => 'c:' + id))) found.set(key, value);
                }
                return reply({ missing: body.ids.filter(id => !found.has('c:' + id)) });
            }
            if (action === 'chunk' || action === 'chunks') {
                return await this.ctx.blockConcurrencyWhile(async () => {
                    await this.storeParts(action === 'chunk' ? [body] : body.parts);
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
            return reply({ error: String(error?.message || error) }, error?.message === 'staging_quota' ? 413 : 400);
        }
    }
    async alarm() {
        await this.ctx.blockConcurrencyWhile(async () => {
            const head = await this.storage.get('head'), previous = await this.storage.get('previous');
            const live = new Set([head, previous].flatMap(h => Object.values(h?.manifest?.sections || {}).flatMap(s => s.chunks)));
            const chunks = await this.storage.list({ prefix: 'c:' });
            const expired = [...chunks].filter(([key, value]) => !live.has(key.slice(2)) && value.at < Date.now() - TTL).map(([key]) => key);
            for (let i = 0; i < expired.length; i += 128) await this.storage.delete(expired.slice(i, i + 128));
            const remaining = chunks.size - expired.length;
            if (Number(await this.storage.get('chunkCount')) !== remaining) await this.storage.put('chunkCount', remaining);
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
