(function (root, factory) {
    const api = factory(typeof module === 'object' && module.exports ? require('./cloud-sync-core.js') : root.GACloudSyncCore);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.GACloudSyncClient = api;
})(globalThis, function (core) {
    'use strict';
    function create({ request, baseUrl, pilotId, pin, getRevision = () => null, setRevision = () => {} }) {
        const cache = new Map(); let cachedChars = 0;
        const headers = { 'X-Pilot-ID': pilotId, 'X-Pilot-PIN': pin, 'Content-Type': 'application/json' };
        async function call(action, body) {
            const response = await request(baseUrl.replace(/\/$/, '') + '/' + action, { method: body === undefined ? 'GET' : 'POST', headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
            const data = await response.json();
            if (!response.ok) {
                const error = new Error(response.status === 409 ? 'Cloud-Konflikt: Neuere Version vorhanden. Bitte Cloud-Stand laden oder bewusst manuell überschreiben.' : `HTTP ${response.status}: ${data?.error || 'sync_failed'}`);
                error.status = response.status; throw error;
            }
            return data;
        }
        function remember(id, data) {
            if (cache.has(id)) return;
            while (cachedChars + data.length > 12 * 1024 * 1024 && cache.size) {
                const key = cache.keys().next().value; cachedChars -= cache.get(key).length; cache.delete(key);
            }
            cache.set(id, data); cachedChars += data.length;
        }
        async function read(names = null, knownHead = null) {
            const head = knownHead || await call('head?inlineMetadata=1');
            if (!Number.isSafeInteger(head?.revision) || head.revision < 0 || (head.revision > 0 && !head.manifest)) throw new Error('sync_head_invalid');
            if (!head.manifest) return { migrated: false, revision: 0 };
            const profile = await core.unpack(head.manifest, async id => {
                if (cache.has(id)) return cache.get(id);
                const part = await call('chunk/' + id);
                const bytes = core.unbase64(part.data);
                if (bytes.length > core.CHUNK_BYTES || await core.hash(bytes) !== id) throw new Error('chunk_integrity');
                remember(id, part.data); return part.data;
            }, names);
            return { migrated: true, revision: head.revision, profile };
        }
        let uploading = false;
        async function write(profile, { force = false, legacyTime = 0 } = {}) {
            if (uploading) throw new Error('Cloud-Upload läuft bereits; Änderungen bleiben vorgemerkt.');
            uploading = true;
            try {
                const head = await call('head?inlineMetadata=1'), packed = await core.pack(profile, { inlineMetadata: head.capabilities?.inlineMetadata === true });
                // Retain fields introduced by another client version; absence is not deletion.
                if (head.manifest) packed.manifest.sections = { ...head.manifest.sections, ...packed.manifest.sections };
                core.validate(packed.manifest);
                const sameContent = head.manifest && Object.entries(packed.manifest.sections).every(([name, section]) => name === 'field:lastModified' || head.manifest.sections[name]?.hash === section.hash);
                if (sameContent) {
                    const metadata = await read(['field:lastModified'], head);
                    setRevision(head.revision);
                    return { revision: head.revision, lastModified: metadata.profile.lastModified, rawBytes: packed.bytes, transferredBytes: 0, uploadedChunks: 0, reusedChunks: Object.keys(packed.chunks).length };
                }
                let baseRevision = getRevision();
                // A reload may have the exact previously saved local snapshot, but
                // observing a new cloud head alone never authorizes overwriting it.
                if (force) baseRevision = head.revision;
                if (baseRevision == null && head.revision === 0 && (!head.legacyHasData || Number(legacyTime) === Number(head.legacyLastModified))) baseRevision = 0;
                if (baseRevision !== head.revision) { const e = new Error('Cloud-Konflikt: Cloud-Stand zuerst laden oder bewusst manuell überschreiben.'); e.status = 409; throw e; }
                const ids = Object.keys(packed.chunks);
                const { missing } = await call('missing', { ids });
                if (!Array.isArray(missing) || missing.some(id => !Object.hasOwn(packed.chunks, id))) throw new Error('missing_response_invalid');
                let transferred = 0;
                // Sequential: bounded load, deterministic resumption after failure.
                if (head.capabilities?.batchChunks === true) {
                    let parts = [], size = 13;
                    async function flush() {
                        if (!parts.length) return;
                        await call('chunks', { parts });
                        transferred += parts.reduce((sum, part) => sum + part.data.length, 0);
                        parts = []; size = 13;
                    }
                    for (const id of missing) {
                        const part = { id, data: packed.chunks[id] }, bytes = JSON.stringify(part).length + 1;
                        if (parts.length >= 127 || size + bytes > 90 * 1024) await flush();
                        parts.push(part); size += bytes;
                    }
                    await flush();
                } else {
                    for (const id of missing) {
                        await call('chunk', { id, data: packed.chunks[id] }); transferred += packed.chunks[id].length;
                    }
                }
                const saved = await call('commit', { baseRevision, manifest: packed.manifest });
                setRevision(saved.revision);
                return { revision: saved.revision, rawBytes: packed.bytes, transferredBytes: transferred, uploadedChunks: missing.length, reusedChunks: ids.length - missing.length };
            } finally { uploading = false; }
        }
        return { read, write, acknowledge: revision => setRevision(revision) };
    }
    return { create };
});
