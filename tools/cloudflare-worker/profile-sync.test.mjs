import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ProfileSync } from './profile-sync.mjs';
const require = createRequire(import.meta.url);
const core = require('../../cloud-sync-core.js');
const { create } = require('../../cloud-sync-client.js');
function fixture() {
    const records = new Map(); let alarm = null, chain = Promise.resolve();
    const storage = {
        get: async key => Array.isArray(key) ? new Map(key.filter(k => records.has(k)).map(k => [k, structuredClone(records.get(k))])) : structuredClone(records.get(key)),
        put: async (key, value) => { if (typeof key === 'object') Object.entries(key).forEach(([k,v]) => records.set(k, structuredClone(v))); else records.set(key, structuredClone(value)); },
        list: async ({prefix}) => new Map([...records].filter(([k]) => k.startsWith(prefix))),
        delete: async keys => (Array.isArray(keys) ? keys : [keys]).forEach(k => records.delete(k)),
        getAlarm: async () => alarm, setAlarm: async value => { alarm = value; }
    };
    const coordinator = new ProfileSync({ storage, blockConcurrencyWhile(fn) { const result = chain.then(fn); chain = result.catch(() => {}); return result; } });
    const calls = []; let fail = null;
    const request = async (url, init) => {
        calls.push(url);
        if (fail && fail(url, init)) throw new Error('connection_lost');
        return coordinator.fetch(new Request(url, init));
    };
    function client() { let revision = null; return create({ request, baseUrl: 'https://test/api/sync-v2/', pilotId: 'TEST', pin: 'secret', getRevision: () => revision, setRevision: value => { revision = value; } }); }
    return { coordinator, records, calls, request, client, fail: fn => { fail = fn; } };
}
const profile = () => ({ activeMission: { missionId: 'poi', missionTruth: { text: '🌍 ÄÖÜ'.repeat(45000) }, targetGeoContext: { target: 'bridge' } }, activeMissionTrackerSeed: { schema: 'ga.tracker-cloud-mission-seed.v1', missionId: 'poi', voice: 'Ansage'.repeat(20000) }, logbook: Array.from({ length: 60 }, (_, i) => ({ id: i, text: 'vollständig' })), lastModified: 123, pin: 'secret' });
test('full >256KiB profile round trip, Unicode, seed and >50 logbook records survive', async () => {
    const f = fixture(), c = f.client(), source = profile();
    const saved = await c.write(source); assert.ok(saved.rawBytes > 256 * 1024); assert.ok(saved.transferredBytes < saved.rawBytes);
    const result = await c.read(); delete source.pin;
    assert.deepEqual(JSON.parse(JSON.stringify(result.profile)), source);
    assert.ok(!JSON.stringify([...f.records]).includes('secret'));
    const again = await c.write(source); assert.equal(again.uploadedChunks, 0); assert.equal(again.revision, saved.revision);
});
test('Tracker fetches mission and timestamp without reading logbook chunks; cache avoids repeat parts', async () => {
    const f = fixture(); await f.client().write(profile()); const reader = f.client();
    const result = await reader.read(['mission', 'field:lastModified']); assert.equal(result.profile.logbook, undefined);
    const before = f.calls.length; await reader.read(['mission', 'field:lastModified']); assert.equal(f.calls.length - before, 1);
});
test('interrupted upload retains old head; retry reuses confirmed chunks', async () => {
    const f = fixture(), c = f.client(); await c.write(profile());
    const changed = { ...profile(), lastModified: 456, groupName: 'new' }; let chunks = 0;
    f.fail(url => url.endsWith('/chunk') && ++chunks === 2);
    await assert.rejects(c.write(changed), /connection_lost/);
    assert.equal((await c.read()).profile.lastModified, 123);
    f.fail(null); const saved = await c.write(changed); assert.ok(saved.reusedChunks > 0);
    assert.equal((await c.read()).profile.lastModified, 456);
});
test('two devices cannot overwrite unseen revision; reading alone does not acknowledge', async () => {
    const f = fixture(), a = f.client(), b = f.client(); await a.write(profile());
    const old = await b.read(); b.acknowledge(old.revision);
    await a.write({ ...profile(), groupName: 'A' }); await b.read();
    await assert.rejects(b.write({ ...profile(), groupName: 'B' }), /Cloud-Konflikt/);
    assert.equal((await a.read()).profile.groupName, 'A');
});
test('simultaneous commits serialize and reject one stale writer', async () => {
    const f = fixture(), a = f.client(), b = f.client(); await a.write(profile()); b.acknowledge(1);
    const results = await Promise.allSettled([a.write({ ...profile(), groupName: 'A' }), b.write({ ...profile(), groupName: 'B' })]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter(r => r.status === 'rejected').length, 1);
});
test('missing/tampered chunk and wrong decoded size cannot publish; old revision retained', async () => {
    const f = fixture(); await f.client().write(profile());
    const packed = await core.pack({ ...profile(), groupName: 'changed' });
    const res = await f.request('https://test/commit', { method: 'POST', body: JSON.stringify({ baseRevision: 1, manifest: packed.manifest }) });
    assert.equal(res.status, 400); assert.equal(f.records.get('head').revision, 1);
    const bad = await f.request('https://test/chunk', { method: 'POST', body: JSON.stringify({ id: 'a'.repeat(64), data: 'YWJj' }) }); assert.equal(bad.status, 400);
    const head = structuredClone(f.records.get('head')); head.manifest.sections.mission.bytes++;
    const invalid = await f.request('https://test/commit', { method: 'POST', body: JSON.stringify({ baseRevision: 1, manifest: head.manifest }) });
    assert.equal(invalid.status, 400); assert.equal(f.records.get('head').revision, 1);
});
test('lost commit response is retriable with same local base revision', async () => {
    const f = fixture(), c = f.client(); await c.write(profile());
    const packed = await core.pack({ ...profile(), lastModified: 987 });
    for (const [id,data] of Object.entries(packed.chunks)) await f.request('https://test/chunk', { method: 'POST', body: JSON.stringify({ id,data }) });
    const body = JSON.stringify({ baseRevision: 1, manifest: packed.manifest });
    const first = await (await f.request('https://test/commit', { method: 'POST', body })).json();
    const again = await (await f.request('https://test/commit', { method: 'POST', body })).json();
    assert.equal(first.revision, again.revision);
});
test('oversize is rejected without trimming; malformed manifests and chunk bodies bounded', async () => {
    await assert.rejects(core.pack({ activeMission: { text: 'x'.repeat(core.MAX_BYTES + 1) } }), /profile_too_large/);
    const f = fixture(); const response = await f.request('https://test/chunk', { method: 'POST', body: 'x'.repeat(97 * 1024) }); assert.equal(response.status, 400);
});
test('orphan cleanup keeps current and previous complete revisions', async () => {
    const f = fixture(), c = f.client(); await c.write(profile()); await c.write({ ...profile(), lastModified: 456, groupName: 'updated' });
    for (const [key, value] of f.records) if (key.startsWith('c:')) value.at = 0;
    f.records.set('c:' + 'a'.repeat(64), { data: 'YWJj', at: 0 });
    await f.coordinator.alarm(); assert.equal(f.records.has('c:' + 'a'.repeat(64)), false);
    assert.equal((await f.client().read()).profile.lastModified, 456);
});
test('incompressible multi-chunk payload preserves exact bytes and supports selective changes', async () => {
    const { randomBytes } = await import('node:crypto');
    const f = fixture(), c = f.client();
    const source = { ...profile(), activeMission: { data: randomBytes(500000).toString('base64') } };
    const initial = await c.write(source); assert.ok(initial.uploadedChunks >= 10);
    assert.deepEqual(JSON.parse(JSON.stringify((await c.read()).profile.activeMission)), source.activeMission);
    const update = await c.write({ ...source, groupName: 'updated' });
    assert.equal(update.uploadedChunks, 1); assert.ok(update.reusedChunks >= 10);
});
test('client recovers commit success with lost HTTP response without requiring overwrite', async () => {
    const f = fixture(); let loseReply = true, revision = null;
    const c = create({ baseUrl: 'https://test/', pilotId: 'T', pin: 'p', getRevision: () => revision, setRevision: n => { revision = n; }, request: async (url, init) => {
        const response = await f.request(url, init);
        if (url.endsWith('/commit') && loseReply) { loseReply = false; throw new Error('lost_reply'); }
        return response;
    } });
    await assert.rejects(c.write(profile()), /lost_reply/);
    const retry = await c.write({ ...profile(), lastModified: 999 }); assert.equal(retry.revision, 1); assert.equal(retry.uploadedChunks, 0);
});
test('browser CompressionStream package interoperates with Worker/Node decoder', async () => {
    const vm = await import('node:vm'), fs = await import('node:fs');
    const { webcrypto } = await import('node:crypto');
    const context = vm.createContext({ TextEncoder, TextDecoder, CompressionStream, DecompressionStream, Blob, crypto: webcrypto, btoa, atob });
    vm.runInContext(fs.readFileSync(new URL('../../cloud-sync-core.js', import.meta.url), 'utf8'), context);
    const packed = await context.GACloudSyncCore.pack(profile());
    const result = await core.unpack(packed.manifest, async id => packed.chunks[id]);
    const expected = profile(); delete expected.pin;
    assert.deepEqual(JSON.parse(JSON.stringify(result)), expected);
});
test('unknown cloud fields survive clients that do not supply them, explicit null still clears mission', async () => {
    const f = fixture(), c = f.client(); await c.write({ ...profile(), futureMissionContext: { keep: true } });
    await c.write({ ...profile(), activeMission: null, activeMissionTrackerSeed: null });
    const result = (await c.read()).profile;
    assert.equal(result.activeMission, null); assert.deepEqual(JSON.parse(JSON.stringify(result.futureMissionContext)), { keep: true });
});
test('migration refuses an unseen legacy profile unless manually authorized', async () => {
    const f = fixture();
    const c = create({ baseUrl: 'https://test/', pilotId: 'T', pin: 'p', request: async (url, init) => {
        if (url.endsWith('/head')) return new Response(JSON.stringify({ revision: 0, manifest: null, legacyHasData: true, legacyLastModified: 123 }));
        return f.request(url, init);
    } });
    await assert.rejects(c.write(profile(), { legacyTime: 100 }), /Cloud-Konflikt/);
    assert.equal(f.records.has('head'), false);
    assert.equal((await c.write(profile(), { legacyTime: 123 })).revision, 1);
});
test('Worker authenticates V2 and legacy route cannot overwrite migrated data', async () => {
    const { default: worker } = await import('./worker-merged-full.js');
    const objects = new Map(), kv = new Map([['SYNCV2', JSON.stringify({ pin: 'p', activeMission: { old: true }, lastModified: 10 })]]);
    const env = { GA_SYNC_KV: {
        get: async key => kv.get(key) || null,
        put: async (key, value) => kv.set(key, value),
        list: async () => ({ keys: [...kv.keys()].map(name => ({ name })), list_complete: true })
    }, GA_PROFILE_SYNC: {
        idFromName: name => name,
        get: name => { if (!objects.has(name)) objects.set(name, fixture().coordinator); return { fetch: (request, init) => objects.get(name).fetch(request instanceof Request ? request : new Request(request, init)) }; }
    } };
    const request = (url, init) => worker.fetch(new Request(url, init), env, {});
    const c = create({ request, baseUrl: 'https://test/api/sync-v2/', pilotId: 'SYNCV2', pin: 'p' });
    await c.write(profile(), { legacyTime: 10 });
    const wrong = await request('https://test/api/sync-v2/head', { headers: { 'X-Pilot-ID': 'SYNCV2', 'X-Pilot-PIN': 'wrong' } }); assert.equal(wrong.status, 401);
    const oldWrite = await request('https://test/api/sync/SYNCV2', { method: 'POST', body: JSON.stringify({ pin: 'p', activeMission: null }) }); assert.equal(oldWrite.status, 409);
    const oldRead = await request('https://test/api/sync/SYNCV2?pin=p'); assert.equal(oldRead.status, 200);
    assert.equal((await oldRead.json()).activeMissionTrackerSeed.missionId, 'poi');
    assert.equal(JSON.parse(kv.get('SYNCV2')).activeMission.old, true);
});
