import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { AirportGeoStore, handleAirportGeo, validateAirportGeoContext, unpackAirportGeoContext, AIRPORT_GEO_STALE_MS, AIRPORT_GEO_LEASE_MS } from './airport-geo.mjs';

// Echter aufbereiteter Platzkontext (EDTW) aus dem App-Kern, wie ihn die App hochlaedt.
const core = fs.readFileSync(new URL('../../mission-arrival-core.js', import.meta.url), 'utf8');
const c = vm.createContext({ window: {}, console, Map });
vm.runInContext(core, c);
const raw = JSON.parse(fs.readFileSync(new URL('../fixtures/arrival-edtw-osm-20261021.json', import.meta.url), 'utf8'));
const base = JSON.parse(JSON.stringify(c.normalizeAptArrivalGeoContext(raw, 48.27917, 8.42833, 1400, {})));
const KEY = 'airport_48.2792_8.4283';
const TOKEN = 'test-admin-token-0123456789abcdef';

function storage() {
    const records = new Map();
    return {
        records,
        async get(key) { return records.has(key) ? structuredClone(records.get(key)) : undefined; },
        async put(key, value) {
            if (typeof key === 'object') { for (const [k, v] of Object.entries(key)) records.set(k, structuredClone(v)); return; }
            records.set(key, structuredClone(value));
        },
        async delete(keys) { for (const k of [].concat(keys)) records.delete(k); },
        async deleteAll() { records.clear(); },
        async list({ prefix }) { return new Map([...records].filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k, structuredClone(v)])); }
    };
}
function env() {
    const stores = new Map();
    return { stores, AIRPORT_GEO_ADMIN_TOKEN: TOKEN, GA_AIRPORT_GEO: { idFromName: name => name, get: id => {
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
    const empty = validateAirportGeoContext(KEY, ctx({ parkingPositions: [], aprons: [], surfaces: [] }));
    assert.equal(empty.ok, true);
    assert.equal(empty.empty, true);
    assert.equal(validateAirportGeoContext(KEY, ctx({ schema: 'x' })).error, 'schema_invalid');
    assert.equal(validateAirportGeoContext(KEY, ctx({ stripHandoff: true })).error, 'kind_mismatch');
    assert.equal(validateAirportGeoContext(KEY, ctx({ avoidZones: new Array(12001).fill(base.avoidZones[0]) })).error, 'avoidZones_too_many');
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
    assert.equal((await unpackAirportGeoContext(store.get('prevCtx'))).surfaces.length, base.surfaces.length);
    assert.ok(store.get('ctx').gz instanceof ArrayBuffer, 'stored compressed');
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

// Feldtest 16.11.2026: UL-Platz Malsch-Ettlingen – OSM-Karte ohne nutzbare Flaeche.
test('empty OSM result is kept as a marker so later missions skip OSM', async () => {
    const e = env();
    const empty = ctx({ parkingPositions: [], aprons: [], surfaces: [] });
    assert.equal((await (await post(e, { context: empty })).json()).result, 'stored');
    const read = await get(e);
    assert.equal(read.found, true);
    assert.equal(read.empty, true);
    assert.equal(read.stale, false);
});

test('a due entry with areas is never replaced by an empty result', async () => {
    const e = env();
    const t0 = 1_800_000_000_000;
    at(t0); await post(e, { context: ctx() });
    at(t0 + AIRPORT_GEO_STALE_MS + 1000);
    const lease = (await get(e)).refresh.token;
    const empty = ctx({ parkingPositions: [], aprons: [], surfaces: [] });
    assert.equal((await (await post(e, { context: empty, leaseToken: lease })).json()).result, 'ignored_empty');
    const again = await get(e);
    assert.equal(again.empty, false);
    assert.equal(again.context.aprons.length, base.aprons.length);
    assert.ok(again.refresh?.token, 'still due: the next reader tries OSM again');
    at(t0 + AIRPORT_GEO_STALE_MS + 120_000);
    assert.equal((await (await post(e, { context: empty, leaseToken: again.refresh.token })).json()).result, 'ignored_empty', 'also a second empty result');
});

test('an empty marker is replaced as soon as OSM delivers areas', async () => {
    const e = env();
    const t0 = 1_800_000_000_000;
    at(t0); await post(e, { context: ctx({ parkingPositions: [], aprons: [], surfaces: [] }) });
    at(t0 + AIRPORT_GEO_STALE_MS + 1000);
    const lease = (await get(e)).refresh.token;
    assert.equal((await (await post(e, { context: ctx(), leaseToken: lease })).json()).result, 'updated');
    assert.equal((await get(e)).empty, false);
});

// Workbench (Admin): Index, Ersetzen, Sperren, manuelle Plaetze, Loeschen, Vorversion.
const admin = (e, key, body, token = TOKEN) => handleAirportGeo(new Request(`https://x/api/airport-geo-v1/${key}/admin`, {
    method: body ? 'POST' : 'GET', headers: { 'X-Admin-Token': token }, body: body ? JSON.stringify(body) : undefined }), e);
const index = (e, token = TOKEN) => handleAirportGeo(new Request('https://x/api/airport-geo-v1/index', { headers: { 'X-Admin-Token': token } }), e);

test('admin routes need the token; without the secret they stay closed', async () => {
    const e = env();
    assert.equal((await index(e, 'wrong')).status, 401);
    assert.equal((await admin(e, KEY, { op: 'delete' }, 'wrong')).status, 401);
    assert.equal((await index({ ...e, AIRPORT_GEO_ADMIN_TOKEN: '' }, '')).status, 401);
});

test('index lists every stored airfield, also app uploads', async () => {
    const e = env();
    await post(e, { context: ctx(), icao: 'EDTW' });
    const list = await (await index(e)).json();
    assert.equal(list.entries.length, 1);
    assert.equal(list.entries[0].key, KEY);
    assert.equal(list.entries[0].icao, 'EDTW');
    assert.equal(list.entries[0].empty, false);
});

test('manual replace overwrites a fresh entry and keeps the previous version for restore', async () => {
    const e = env();
    await post(e, { context: ctx() });
    const smaller = ctx({ surfaces: base.surfaces.slice(0, 1) });
    const res = await (await admin(e, KEY, { op: 'replace', context: smaller, name: 'Winzeln' })).json();
    assert.equal(res.result, 'replaced');
    assert.equal((await get(e)).context.surfaces.length, 1);
    assert.equal((await (await admin(e, KEY, { op: 'restore' })).json()).result, 'restored');
    assert.equal((await get(e)).context.surfaces.length, base.surfaces.length);
});

test('blocked areas disappear for the app, a blocked hangar stays an obstacle without a front', async () => {
    const e = env();
    await post(e, { context: ctx() });
    const hangar = base.avoidZones.find(z => z.buildingType === 'hangar');
    const blocked = [base.aprons[0]?.id, hangar?.id].filter(Boolean);
    assert.equal((await (await admin(e, KEY, { op: 'block', blocked: [...blocked, 'evil'] })).json()).summary.blocked, blocked.length);
    const read = await get(e);
    assert.ok(!read.context.aprons.some(a => blocked.includes(a.id)));
    if (hangar) assert.equal(read.context.avoidZones.find(z => z.id === hangar.id).buildingType, 'hangar_blocked');
    const raw = await (await admin(e, KEY)).json();
    assert.equal(raw.context.aprons.length, base.aprons.length, 'admin view stays unfiltered');
    // Sperren ueberleben eine Erneuerung.
    await admin(e, KEY, { op: 'replace', context: ctx() });
    assert.ok(!(await get(e)).context.aprons.some(a => blocked.includes(a.id)));
});

test('manual places: also on an unknown field, used by the app placement, survive OSM uploads', async () => {
    const e = env();
    const key = 'airport_48.9017_8.3283';
    const spot = { id: 'manual/1', lat: 48.9019, lon: 8.3295, name: 'Parkplatz am Clubheim' };
    assert.equal((await admin(e, key, { op: 'places', added: [{ ...spot, id: 'x' }] })).status, 400);
    assert.equal((await admin(e, key, { op: 'places', added: [{ ...spot, lat: 49.5 }] })).status, 400);
    const res = await (await admin(e, key, { op: 'places', added: [spot], icao: 'OUR-321125', name: 'Malsch-Ettlingen' })).json();
    assert.equal(res.summary.empty, false);
    assert.equal(res.summary.added, 1);
    const read = await get(e, key);
    assert.equal(read.empty, false);
    const pos = read.context.parkingPositions.find(p => p.id === 'manual/1');
    assert.equal(pos.tags.aeroway, 'parking_position');
    // Echte Platzwahl der App auf diesem Kontext.
    c.normalizeAptArrivalRole = () => ({ role: 'charter_pickup', personRole: 'person.ground_crew', vehicleRole: 'vehicle.car' });
    c.normalizeMissionType = () => 'apt';
    const plan = c.buildAptArrivalPlan({ dest: { lat: 48.901667, lon: 8.328333, icao: 'OUR-321125' }, heading: 0 });
    const placement = c.pickAptArrivalOsmPlacement(read.context, plan);
    assert.equal(placement?.sourceId, 'manual/1');
    // Ein spaeterer App-Upload (mit eingeschleustem manuellem Punkt) aendert die Liste nicht.
    const upload = ctx({ center: { lat: 48.9017, lon: 8.3283 }, parkingPositions: [{ ...pos, id: 'manual/9' }], aprons: [], surfaces: [], airportBoundaries: [], avoidZones: [] });
    await admin(e, key, { op: 'replace', context: { ...upload, parkingPositions: [], surfaces: base.surfaces.slice(0, 1).map(x => ({ ...x, lat: 48.9015, lon: 8.3287 })) } });
    const after = await get(e, key);
    assert.deepEqual(after.context.parkingPositions.filter(p => p.manual).map(p => p.id), ['manual/1']);
});

test('delete removes the entry and its index row', async () => {
    const e = env();
    await post(e, { context: ctx() });
    assert.equal((await (await admin(e, KEY, { op: 'delete' })).json()).result, 'deleted');
    assert.equal((await get(e)).found, false);
    assert.equal((await (await index(e)).json()).entries.length, 0);
});

// Feldtest 16.11.2026: EDDS kam auf 2,1 MB mit 3807 Sperrzonen – roh ueber der 2-MB-Grenze eines DO-Werts.
test('a large airport (EDDS size) is stored compressed and read back intact', async () => {
    const e = env();
    const zone = base.avoidZones.find(z => z.type === 'building' && z.polygon?.length) || base.avoidZones[0];
    const avoidZones = Array.from({ length: 5000 }, (_, i) => ({ ...zone, id: 'way/' + (900000 + i), center: { lat: 48.2792 + (i % 50) * 0.0001, lon: 8.4283 + Math.floor(i / 50) * 0.0001 } }));
    const big = ctx({ avoidZones });
    const raw = JSON.stringify(big).length;
    assert.ok(raw > 2 * 1024 * 1024, `fixture is ${raw} bytes`);
    const res = await (await post(e, { context: big })).json();
    assert.equal(res.result, 'stored');
    const packed = e.stores.get(KEY).storage.records.get('ctx').gz.byteLength;
    assert.ok(packed < raw / 4, `packed ${packed} bytes`);
    const read = await get(e);
    assert.equal(read.context.avoidZones.length, 5000);
    assert.deepEqual(read.context.aprons, base.aprons);
});

test('entries stored before compression stay readable', async () => {
    const e = env();
    await post(e, { context: ctx() });
    const records = e.stores.get(KEY).storage.records;
    records.set('ctx', structuredClone(base));
    assert.equal((await get(e)).context.aprons.length, base.aprons.length);
});
