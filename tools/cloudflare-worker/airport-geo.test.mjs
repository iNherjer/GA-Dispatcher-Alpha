import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { AirportGeoStore, handleAirportGeo, validateAirportGeoContext, AIRPORT_GEO_STALE_MS, AIRPORT_GEO_LEASE_MS } from './airport-geo.mjs';

// Echter aufbereiteter Platzkontext (EDTW) aus dem App-Kern, wie ihn die App hochlaedt.
const core = fs.readFileSync(new URL('../../mission-arrival-core.js', import.meta.url), 'utf8');
const c = vm.createContext({ window: {}, console, Map });
vm.runInContext(core, c);
const raw = JSON.parse(fs.readFileSync(new URL('../fixtures/arrival-edtw-osm-20261021.json', import.meta.url), 'utf8'));
const base = JSON.parse(JSON.stringify(c.normalizeAptArrivalGeoContext(raw, 48.27917, 8.42833, 1400, {})));
const KEY = 'airport_48.2792_8.4283';

function storage() {
    const records = new Map();
    return {
        records,
        async get(key) { return records.has(key) ? structuredClone(records.get(key)) : undefined; },
        async put(key, value) {
            if (typeof key === 'object') { for (const [k, v] of Object.entries(key)) records.set(k, structuredClone(v)); return; }
            records.set(key, structuredClone(value));
        },
        async delete(keys) { for (const k of [].concat(keys)) records.delete(k); }
    };
}
function env() {
    const stores = new Map();
    return { stores, GA_AIRPORT_GEO: { idFromName: name => name, get: id => {
        if (!stores.has(id)) stores.set(id, new AirportGeoStore({ storage: storage() }));
        const store = stores.get(id);
        return { fetch: request => store.fetch(request) };
    } } };
}
const get = (e, key = KEY) => handleAirportGeo(new Request('https://x/api/airport-geo-v1/' + key), e).then(r => r.json());
const post = (e, body, key = KEY) => handleAirportGeo(new Request('https://x/api/airport-geo-v1/' + key, { method: 'POST', body: JSON.stringify(body) }), e);
const ctx = (patch = {}) => ({ ...structuredClone(base), ...patch });
const realNow = Date.now;
const at = ms => { Date.now = () => ms; };
test.afterEach(() => { Date.now = realNow; });

test('validation: real context passes; wrong place, empty, schema, kind and oversize are refused', () => {
    assert.equal(validateAirportGeoContext(KEY, ctx()).ok, true);
    assert.equal(validateAirportGeoContext('airport_48.0228_7.8325', ctx()).error, 'center_mismatch');
    assert.equal(validateAirportGeoContext(KEY, ctx({ parkingPositions: [], aprons: [], surfaces: [] })).error, 'context_empty');
    assert.equal(validateAirportGeoContext(KEY, ctx({ schema: 'x' })).error, 'schema_invalid');
    assert.equal(validateAirportGeoContext(KEY, ctx({ stripHandoff: true })).error, 'kind_mismatch');
    assert.equal(validateAirportGeoContext(KEY, ctx({ avoidZones: new Array(3001).fill(base.avoidZones[0]) })).error, 'avoidZones_too_many');
    assert.equal(validateAirportGeoContext('../etc', ctx()).error, 'key_invalid');
});

test('unknown airport: first upload is stored and served to everyone', async () => {
    const e = env();
    assert.equal((await get(e)).found, false);
    const res = await (await post(e, { context: ctx(), icao: 'edtw' })).json();
    assert.equal(res.result, 'stored');
    const read = await get(e);
    assert.equal(read.found, true);
    assert.equal(read.stale, false);
    assert.equal(read.icao, 'EDTW');
    assert.equal(read.context.aprons.length, base.aprons.length);
    assert.equal(read.refresh, null);
});

test('fresh entries are not overwritten; bad uploads get 400', async () => {
    const e = env();
    await post(e, { context: ctx() });
    assert.equal((await (await post(e, { context: ctx({ aprons: base.aprons.slice(0, 0) }) })).json()).result, 'ignored_fresh');
    assert.equal((await (await post(e, { context: ctx() })).json()).result, 'unchanged');
    assert.equal((await post(e, { context: ctx({ schema: 'old' }) })).status, 400);
});

test('after 90 days: still served, one lease at a time, same data only confirms', async () => {
    const e = env();
    const t0 = 1_800_000_000_000;
    at(t0); await post(e, { context: ctx() });
    at(t0 + AIRPORT_GEO_STALE_MS + 1000);
    const first = await get(e);
    assert.equal(first.stale, true);
    assert.ok(first.context, 'stale entry still delivered');
    assert.ok(first.refresh?.token, 'first reader gets the refresh lease');
    assert.equal((await get(e)).refresh, null, 'second reader keeps the stale entry without OSM');
    assert.equal((await (await post(e, { context: ctx(), leaseToken: 'other' })).json()).result, 'lease_held');
    assert.equal((await (await post(e, { context: ctx({ source: 'osm-map' }), leaseToken: first.refresh.token })).json()).result, 'confirmed');
    const after = await get(e);
    assert.equal(after.stale, false);
    assert.equal(after.version, 1);
});

test('changed but plausible data replaces the entry and keeps the previous version', async () => {
    const e = env();
    const t0 = 1_800_000_000_000;
    at(t0); await post(e, { context: ctx() });
    at(t0 + AIRPORT_GEO_STALE_MS + 1000);
    const lease = (await get(e)).refresh.token;
    const changed = ctx({ surfaces: base.surfaces.slice(0, Math.max(1, base.surfaces.length - 1)) });
    assert.equal((await (await post(e, { context: changed, leaseToken: lease })).json()).result, 'updated');
    const store = e.stores.get(KEY).storage.records;
    assert.equal(store.get('meta').version, 2);
    assert.equal(store.get('meta').previous.version, 1);
    assert.equal(store.get('prevCtx').surfaces.length, base.surfaces.length);
});

test('a strong shrink needs a second matching fetch at least a minute later', async () => {
    const e = env();
    const t0 = 1_800_000_000_000;
    const big = ctx({ surfaces: Array.from({ length: 20 }, (_, i) => ({ ...base.surfaces[0], id: 'way/' + i })) });
    at(t0); await post(e, { context: big });
    const small = ctx({ surfaces: big.surfaces.slice(0, 3), aprons: [], parkingPositions: [] });
    at(t0 + AIRPORT_GEO_STALE_MS + 1000);
    let lease = (await get(e)).refresh.token;
    assert.equal((await (await post(e, { context: small, leaseToken: lease })).json()).result, 'pending_confirmation');
    const stays = await get(e);
    assert.equal(stays.context.surfaces.length, 20, 'old entry stays');
    lease = stays.refresh?.token;
    assert.ok(lease, 'entry stays due: the next reader gets a new lease');
    at(t0 + AIRPORT_GEO_STALE_MS + 1000 + 30_000);
    assert.equal((await (await post(e, { context: small, leaseToken: lease })).json()).result, 'pending_confirmation', 'too soon to confirm');
    at(t0 + AIRPORT_GEO_STALE_MS + 1000 + 61_000);
    lease = (await get(e)).refresh.token;
    assert.equal((await (await post(e, { context: small, leaseToken: lease })).json()).result, 'updated');
    assert.equal((await get(e)).context.surfaces.length, 3);
});

test('without the Durable Object binding the route answers 503', async () => {
    const res = await handleAirportGeo(new Request('https://x/api/airport-geo-v1/' + KEY), {});
    assert.equal(res.status, 503);
});
