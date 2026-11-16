// Gemeinsamer Vorrat der Flugplatz-Geometrie fuer Ankunftsszenen (16.11.2026).
// Die App laedt den aufbereiteten OSM-Platzkontext (schema apt-arrival-geometry.v2:
// Vorfelder, Parkpositionen, Flaechen, Sperrzonen) einmal von OSM und legt ihn hier ab;
// danach bekommt jeder Pilot ihn ohne OSM. Ein Durable Object je Flugplatz.
//
// Lebenszyklus (User-Entscheidung 16.11.2026):
// - Nach 90 Tagen ist ein Eintrag „faellig“, wird aber nie geloescht und weiter ausgeliefert.
// - Der erste Abrufer eines faelligen Eintrags bekommt fuer 10 Minuten den Erneuerungsauftrag
//   (lease) und fragt OSM im Hintergrund; alle anderen nehmen solange den alten Eintrag.
// - Gleicher Inhalt → nur „bestaetigt“; anderer, brauchbarer Inhalt → ersetzt, Vorversion bleibt;
//   schrumpft er auf unter die Haelfte der Flaechen, gilt er erst, wenn ein zweiter Abruf
//   (mind. 1 Minute spaeter, auch von einem anderen Nutzer) dasselbe Bild liefert.
// - Ohne nutzbare Flaeche wird ein Leer-Vermerk gespeichert (auch 90 Tage); ein leeres Ergebnis
//   ersetzt nie einen Eintrag mit Flaechen – der bleibt faellig und wird spaeter erneut versucht.
//
// Routen:
//   GET  /api/airport-geo-v1/<key>   { ok, found, stale, ageDays, storedAt, refreshedAt, version, context, refresh? }
//   POST /api/airport-geo-v1/<key>   { context, icao?, leaseToken? } → { ok, result }
//   Admin (Header X-Admin-Token = Secret AIRPORT_GEO_ADMIN_TOKEN, Workbench tools/airport-geo-workbench):
//   GET  /api/airport-geo-v1/index          alle Plaetze (Index-Instanz „__index__“)
//   GET  /api/airport-geo-v1/<key>/admin    ungefilterter Kontext, Meta, Sperrliste
//   POST /api/airport-geo-v1/<key>/admin    { op: replace|delete|restore|block|places|summary, ... }
//   <key> = airport_<lat>_<lon> | strip_<lat>_<lon> (4 Nachkommastellen)

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });

export const AIRPORT_GEO_SCHEMA = 'apt-arrival-geometry.v2';
export const AIRPORT_GEO_STALE_MS = 90 * 24 * 60 * 60 * 1000;
export const AIRPORT_GEO_LEASE_MS = 10 * 60 * 1000;
export const AIRPORT_GEO_CONFIRM_MIN_MS = 60 * 1000;
const MAX_BODY = 1536 * 1024;
const MAX_ITEMS = { parkingPositions: 200, aprons: 100, surfaces: 200, airportBoundaries: 20, avoidZones: 3000 };
const KEY_RE = /^(airport|strip)_-?\d{1,2}\.\d{4}_-?\d{1,3}\.\d{4}$/;
const ICAO_RE = /^[A-Z0-9-]{2,16}$/;

export function airportGeoKeyCenter(key) {
    if (!KEY_RE.test(String(key || ''))) return null;
    const [, lat, lon] = key.split('_');
    return { lat: Number(lat), lon: Number(lon) };
}

function distM(a, b) {
    const r = 6371000, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * r * Math.asin(Math.sqrt(h));
}

const finitePoint = p => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon))
    && Math.abs(Number(p.lat)) <= 90 && Math.abs(Number(p.lon)) <= 180;

export function airportGeoSignature(context) {
    const zones = Array.isArray(context?.avoidZones) ? context.avoidZones : [];
    const count = type => zones.filter(z => z?.type === type).length;
    const parking = context.parkingPositions.length, aprons = context.aprons.length, surfaces = context.surfaces.length;
    return { parking, aprons, surfaces, areas: parking + aprons + surfaces, runways: count('runway'), buildings: count('building'),
        boundaries: context.airportBoundaries.length, radiusM: Number(context.radiusM) || 0 };
}

// Strenge Pruefung eines hochgeladenen Kontexts: Aufbau, Grenzen, Lage zum Flugplatz, nicht leer.
export function validateAirportGeoContext(key, context) {
    const center = airportGeoKeyCenter(key);
    if (!center) return { ok: false, error: 'key_invalid' };
    if (!context || typeof context !== 'object' || Array.isArray(context)) return { ok: false, error: 'context_missing' };
    if (context.schema !== AIRPORT_GEO_SCHEMA) return { ok: false, error: 'schema_invalid' };
    if ((context.stripHandoff === true) !== key.startsWith('strip_')) return { ok: false, error: 'kind_mismatch' };
    for (const [field, max] of Object.entries(MAX_ITEMS)) {
        if (!Array.isArray(context[field])) return { ok: false, error: `${field}_missing` };
        if (context[field].length > max) return { ok: false, error: `${field}_too_many` };
    }
    if (!finitePoint(context.center) || distM(center, { lat: Number(context.center.lat), lon: Number(context.center.lon) }) > 3000) {
        return { ok: false, error: 'center_mismatch' };
    }
    const radiusM = Number(context.radiusM);
    if (!Number.isFinite(radiusM) || radiusM < 200 || radiusM > 3000) return { ok: false, error: 'radius_invalid' };
    const items = ['parkingPositions', 'aprons', 'surfaces', 'airportBoundaries'].flatMap(field => context[field]);
    if (items.some(item => !finitePoint(item) || distM(center, { lat: Number(item.lat), lon: Number(item.lon) }) > radiusM + 3000)) {
        return { ok: false, error: 'item_out_of_area' };
    }
    if (context.avoidZones.some(zone => !finitePoint(zone?.center))) return { ok: false, error: 'zone_invalid' };
    const signature = airportGeoSignature(context);
    // Ohne nutzbare Flaeche (typisch UL-Plaetze) wird ein Vermerk „OSM kennt hier nichts“ gespeichert,
    // damit nicht jede Mission OSM erneut fragt; er ersetzt aber nie einen echten Eintrag.
    return { ok: true, signature, empty: signature.areas < 1 };
}

// Inhaltsvergleich ohne Abrufzeit und Quelle (Overpass und OSM-Karte liefern dieselbe Geometrie).
export async function airportGeoHash(context) {
    const { fetchedAt, source, osmMapRadiusM, cloud, ...rest } = context;
    const data = new TextEncoder().encode(JSON.stringify(rest));
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

const close = (a, b) => Math.abs(a - b) <= Math.max(2, Math.round(Math.max(a, b) * 0.1));
const sameShape = (a, b) => !!a && !!b && ['parking', 'aprons', 'surfaces', 'runways', 'buildings'].every(k => close(Number(a[k]) || 0, Number(b[k]) || 0));

export class AirportGeoStore {
    constructor(ctx) { this.ctx = ctx; this.storage = ctx.storage; }

    async read(now) {
        const meta = await this.storage.get('meta');
        if (!meta) return reply({ ok: true, found: false });
        const context = applyAirportGeoOverrides(await this.storage.get('ctx'), meta);
        const ageMs = Math.max(0, now - Number(meta.refreshedAt || meta.storedAt || 0));
        const stale = ageMs > AIRPORT_GEO_STALE_MS;
        let refresh = null;
        if (stale) {
            const lease = await this.storage.get('lease');
            if (!lease || Number(lease.until) <= now) {
                const token = crypto.randomUUID();
                await this.storage.put('lease', { token, until: now + AIRPORT_GEO_LEASE_MS });
                refresh = { token, until: now + AIRPORT_GEO_LEASE_MS };
            }
        }
        return reply({
            ok: true, found: true, stale, ageDays: Math.round(ageMs / 864e5 * 10) / 10,
            storedAt: meta.storedAt, refreshedAt: meta.refreshedAt, version: meta.version, icao: meta.icao || '',
            pending: !!meta.pending, empty: airportGeoIsEmpty(meta), blocked: (meta.blocked || []).length, added: (meta.added || []).length, refresh, context
        });
    }

    // Workbench: ungefilterter Kontext mit Sperrliste und Vorversion.
    async readAdmin(now) {
        const meta = await this.storage.get('meta');
        if (!meta) return reply({ ok: true, found: false });
        const [context, prevCtx] = await Promise.all([this.storage.get('ctx'), this.storage.get('prevCtx')]);
        return reply({ ok: true, found: true, meta, context, hasPrevious: !!prevCtx, summary: airportGeoSummary(meta, now) });
    }

    async write(body, now) {
        const { key, context, signature, hash, icao, name, leaseToken } = body;
        const meta = await this.storage.get('meta');
        const record = { key, icao, name, storedAt: now, refreshedAt: now, version: 1, hash, signature, source: String(context.source || '') };
        const done = (result, nextMeta) => reply({ ok: true, result, version: nextMeta.version, summary: airportGeoSummary(nextMeta, now) });
        if (!meta) {
            await this.storage.put({ meta: record, ctx: context });
            return done('stored', record);
        }
        const stale = now - Number(meta.refreshedAt || meta.storedAt || 0) > AIRPORT_GEO_STALE_MS;
        if (!stale) return reply({ ok: true, result: meta.hash === hash ? 'unchanged' : 'ignored_fresh', version: meta.version });
        const lease = await this.storage.get('lease');
        if (lease && Number(lease.until) > now && lease.token !== leaseToken) return reply({ ok: true, result: 'lease_held', version: meta.version });
        if (signature.areas < 1 && Number(meta.signature?.areas) > 0) {
            // OSM ohne Flaechen: alter Eintrag bleibt, Auftrag frei fuer den naechsten Versuch.
            await this.storage.put('meta', { ...meta, lastEmptyAt: now });
            await this.storage.delete('lease');
            return reply({ ok: true, result: 'ignored_empty', version: meta.version });
        }
        if (meta.hash === hash) {
            const next = { ...meta, refreshedAt: now, pending: null };
            await this.storage.put('meta', next);
            await this.storage.delete('lease');
            return done('confirmed', next);
        }
        const shrinks = signature.areas < Math.ceil((Number(meta.signature?.areas) || 0) * 0.5);
        if (shrinks) {
            const pending = meta.pending;
            const confirmed = pending && now - Number(pending.at) >= AIRPORT_GEO_CONFIRM_MIN_MS
                && (pending.hash === hash || sameShape(pending.signature, signature));
            if (!confirmed) {
                // Eintrag bleibt faellig: die naechste Anfrage bekommt wieder einen Auftrag.
                await this.storage.put('meta', { ...meta, pending: { hash, signature, at: pending?.hash === hash ? pending.at : now } });
                await this.storage.delete('lease');
                return reply({ ok: true, result: 'pending_confirmation', version: meta.version });
            }
        }
        return this.replace(meta, record, context, now, 'updated');
    }

    async replace(meta, record, context, now, result) {
        const oldContext = await this.storage.get('ctx');
        const version = Number(meta.version || 1) + 1;
        const { pending: _p, previous: _prev, blocked, added, ...previous } = meta;
        // Sperren und manuelle Plaetze gelten fuer den Flugplatz, nicht fuer eine Datenversion: sie bleiben.
        const next = { ...record, name: record.name || meta.name || '', icao: record.icao || meta.icao || '', storedAt: now, version, previous,
            blocked: blocked || [], added: added || [] };
        await this.storage.put({ meta: next, ctx: context, prevCtx: oldContext });
        await this.storage.delete('lease');
        return reply({ ok: true, result, version, summary: airportGeoSummary(next, now) });
    }

    async admin(body, now) {
        const meta = await this.storage.get('meta');
        if (body.op === 'replace') {
            const record = { key: body.key, icao: body.icao, name: body.name, storedAt: now, refreshedAt: now, version: 1,
                hash: body.hash, signature: body.signature, source: String(body.context.source || ''), manual: true };
            if (!meta) {
                await this.storage.put({ meta: record, ctx: body.context });
                return reply({ ok: true, result: 'stored', version: 1, summary: airportGeoSummary(record, now) });
            }
            return this.replace(meta, record, body.context, now, 'replaced');
        }
        if (body.op === 'places') {
            // Manuelle Abstellplaetze; ohne OSM-Eintrag entsteht ein leerer Grundkontext.
            if (!meta) {
                const record = { key: body.key, icao: body.icao, name: body.name, storedAt: now, refreshedAt: now, version: 1,
                    hash: '', signature: airportGeoSignature(body.baseContext), source: 'manual', manual: true, added: body.added, blocked: [] };
                await this.storage.put({ meta: record, ctx: body.baseContext });
                return reply({ ok: true, result: 'places', version: 1, summary: airportGeoSummary(record, now) });
            }
            const next = { ...meta, added: body.added };
            await this.storage.put('meta', next);
            return reply({ ok: true, result: 'places', version: meta.version, summary: airportGeoSummary(next, now) });
        }
        if (!meta) return reply({ error: 'not_found' }, 404);
        if (body.op === 'delete') {
            await this.storage.deleteAll();
            return reply({ ok: true, result: 'deleted' });
        }
        if (body.op === 'restore') {
            const prevCtx = await this.storage.get('prevCtx');
            if (!prevCtx || !meta.previous) return reply({ error: 'no_previous' }, 404);
            const next = { ...meta.previous, refreshedAt: now, version: Number(meta.version || 1) + 1, blocked: meta.blocked || [], added: meta.added || [], previous: null };
            await this.storage.put({ meta: next, ctx: prevCtx });
            await this.storage.delete('prevCtx');
            return reply({ ok: true, result: 'restored', version: next.version, summary: airportGeoSummary(next, now) });
        }
        if (body.op === 'block') {
            const next = { ...meta, blocked: body.blocked };
            await this.storage.put('meta', next);
            return reply({ ok: true, result: 'blocked', version: meta.version, summary: airportGeoSummary(next, now) });
        }
        if (body.op === 'summary') return reply({ ok: true, result: 'summary', summary: airportGeoSummary(meta, now) });
        return reply({ error: 'op_invalid' }, 400);
    }

    // Index aller Plaetze (eigene Instanz „__index__“) fuer die Workbench-Karte.
    async index(op, body) {
        if (op === 'list') {
            const all = await this.storage.list({ prefix: 'i:' });
            return reply({ ok: true, entries: [...all.values()] });
        }
        if (op === 'upsert') { await this.storage.put('i:' + body.summary.key, body.summary); return reply({ ok: true }); }
        if (op === 'remove') { await this.storage.delete('i:' + body.key); return reply({ ok: true }); }
        return reply({ error: 'op_invalid' }, 400);
    }

    async fetch(request) {
        try {
            const now = Date.now();
            const parts = new URL(request.url).pathname.split('/').filter(Boolean);
            if (parts[0] === INDEX_NAME) return await this.index(parts[1], request.method === 'POST' ? await request.json() : null);
            if (parts[1] === 'admin') return request.method === 'GET' ? await this.readAdmin(now) : await this.admin(await request.json(), now);
            if (request.method === 'GET') return await this.read(now);
            if (request.method === 'POST') return await this.write(await request.json(), now);
            return reply({ error: 'method' }, 405);
        } catch (error) {
            return reply({ error: String(error?.message || error) }, 400);
        }
    }
}

const INDEX_NAME = '__index__';
const BLOCK_ID_RE = /^(node|way|relation)\/\d{1,15}$/;
const MANUAL_ID_RE = /^manual\/\d{1,9}$/;
const MAX_ADDED = 50;

export function airportGeoIsEmpty(meta) {
    return !(Number(meta?.signature?.areas) > 0) && !(Array.isArray(meta?.added) && meta.added.length);
}

function bearingDeg(a, b) {
    const rad = Math.PI / 180;
    const y = Math.sin((b.lon - a.lon) * rad) * Math.cos(b.lat * rad);
    const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lon - a.lon) * rad);
    return Math.round((Math.atan2(y, x) / rad + 360) % 360);
}

// Manuelle Abstellplaetze der Workbench als Parkpositionen im Aufbau der App (gleiche Pruefung wie OSM).
export function normalizeAddedPlaces(key, added) {
    const center = airportGeoKeyCenter(key);
    if (!center || !Array.isArray(added) || added.length > MAX_ADDED) return null;
    const out = [];
    for (const place of added) {
        const lat = Number(place?.lat), lon = Number(place?.lon), id = String(place?.id || '');
        if (!MANUAL_ID_RE.test(id) || !finitePoint({ lat, lon }) || distM(center, { lat, lon }) > 3000) return null;
        out.push({ id, lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6,
            name: String(place?.name || '').replace(/[\u0000-\u001f]/g, '').slice(0, 60) });
    }
    return out;
}

export function emptyAirportGeoContext(key) {
    const center = airportGeoKeyCenter(key);
    return { schema: AIRPORT_GEO_SCHEMA, stripHandoff: key.startsWith('strip_'), source: 'manual', radiusM: 1400, center,
        parkingPositions: [], aprons: [], surfaces: [], airportBoundaries: [], avoidZones: [], summary: 'manuell', fetchedAt: Date.now() };
}

// Gesperrte Flaechen fallen aus den Kandidaten; ein gesperrter Hangar bleibt Hindernis,
// gibt aber keinen Vorplatz mehr frei. Manuelle Plaetze kommen als Parkpositionen dazu.
export function applyAirportGeoOverrides(context, meta) {
    const ids = new Set(Array.isArray(meta?.blocked) ? meta.blocked : []);
    const added = Array.isArray(meta?.added) ? meta.added : [];
    if (!context || (!ids.size && !added.length)) return context;
    const center = airportGeoKeyCenter(meta.key);
    const keep = list => (Array.isArray(list) ? list : []).filter(item => !ids.has(String(item?.id || '')));
    const manual = added.map(place => ({
        id: place.id, name: place.name || 'Manueller Abstellplatz', lat: place.lat, lon: place.lon, manual: true,
        distM: center ? Math.round(distM(center, place)) : 0, bearingDeg: center ? bearingDeg(center, place) : 0,
        tags: { ref: '', name: place.name || '', shortName: '', aeroway: 'parking_position', operator: '', service: '', access: '', surface: '', parking: '', summary: 'manuell' }
    }));
    return {
        ...context,
        parkingPositions: keep(context.parkingPositions).concat(manual),
        aprons: keep(context.aprons),
        surfaces: keep(context.surfaces),
        avoidZones: (context.avoidZones || []).map(zone => ids.has(String(zone?.id || '')) && zone.buildingType === 'hangar'
            ? { ...zone, buildingType: 'hangar_blocked' } : zone),
        blockedIds: [...ids],
        manualPlaces: manual.length
    };
}

export function airportGeoSummary(meta, now = Date.now()) {
    const center = airportGeoKeyCenter(meta.key) || { lat: 0, lon: 0 };
    const sig = meta.signature || {};
    return {
        key: meta.key, lat: center.lat, lon: center.lon, icao: meta.icao || '', name: meta.name || '',
        version: Number(meta.version) || 1, storedAt: meta.storedAt, refreshedAt: meta.refreshedAt,
        stale: now - Number(meta.refreshedAt || meta.storedAt || 0) > AIRPORT_GEO_STALE_MS,
        empty: airportGeoIsEmpty(meta), added: (meta.added || []).length, aprons: sig.aprons || 0, parking: sig.parking || 0, surfaces: sig.surfaces || 0,
        source: meta.source || '', manual: meta.manual === true, blocked: (meta.blocked || []).length, pending: !!meta.pending
    };
}

const adminOk = (request, env) => {
    const expected = String(env.AIRPORT_GEO_ADMIN_TOKEN || '');
    return expected.length >= 24 && request.headers.get('X-Admin-Token') === expected;
};

async function readBody(request) {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return { error: reply({ error: 'request_too_large' }, 413) };
    try { return { body: JSON.parse(raw) }; } catch (_) { return { error: reply({ error: 'json_invalid' }, 400) }; }
}

async function prepareContext(key, body) {
    const check = validateAirportGeoContext(key, body?.context);
    if (!check.ok) return { error: reply({ error: check.error }, 400) };
    const context = { ...body.context, fetchedAt: Number(body.context.fetchedAt) || Date.now() };
    delete context.cloud;
    delete context.blockedIds;
    delete context.manualPlaces;
    // Manuelle Plaetze leben in meta.added, nie in den hochgeladenen OSM-Daten.
    if (Array.isArray(context.parkingPositions)) context.parkingPositions = context.parkingPositions.filter(p => !p?.manual);
    const icao = String(body?.icao || '').trim().toUpperCase();
    return { context, signature: check.signature, hash: await airportGeoHash(context),
        icao: ICAO_RE.test(icao) ? icao : '', name: String(body?.name || '').replace(/[\u0000-\u001f]/g, '').slice(0, 80) };
}

export async function handleAirportGeo(request, env) {
    if (!env.GA_AIRPORT_GEO) return reply({ error: 'airport_geo_unavailable' }, 503);
    if (!['GET', 'POST'].includes(request.method)) return reply({ error: 'method' }, 405);
    const parts = new URL(request.url).pathname.split('/').filter(Boolean).slice(2); // after api/airport-geo-v1
    const ns = env.GA_AIRPORT_GEO;
    const indexStub = () => ns.get(ns.idFromName(INDEX_NAME));
    const indexCall = (op, data) => indexStub().fetch(new Request(`https://airport-geo/${INDEX_NAME}/${op}`, data ? { method: 'POST', body: JSON.stringify(data) } : undefined));
    const syncIndex = async response => {
        const data = await response.clone().json().catch(() => null);
        if (data?.summary?.key) await indexCall('upsert', { summary: data.summary });
        return response;
    };
    // Workbench-Liste aller Plaetze (Admin).
    if (!parts.length || parts[0] === 'index') {
        if (!adminOk(request, env)) return reply({ error: 'admin_required' }, 401);
        return indexCall('list');
    }
    const key = parts[0];
    if (!airportGeoKeyCenter(key)) return reply({ error: 'key_invalid' }, 400);
    const stub = ns.get(ns.idFromName(key));
    if (parts[1] === 'admin') {
        if (!adminOk(request, env)) return reply({ error: 'admin_required' }, 401);
        if (request.method === 'GET') return stub.fetch(new Request(`https://airport-geo/${key}/admin`));
        const { body, error } = await readBody(request);
        if (error) return error;
        let payload = { op: String(body?.op || '') };
        if (payload.op === 'replace') {
            const prepared = await prepareContext(key, body);
            if (prepared.error) return prepared.error;
            payload = { ...payload, key, ...prepared };
        } else if (payload.op === 'places') {
            const added = normalizeAddedPlaces(key, body?.added);
            if (!added) return reply({ error: 'places_invalid' }, 400);
            const icao = String(body?.icao || '').trim().toUpperCase();
            payload = { ...payload, key, added, baseContext: emptyAirportGeoContext(key), icao: ICAO_RE.test(icao) ? icao : '',
                name: String(body?.name || '').replace(/[\u0000-\u001f]/g, '').slice(0, 80) };
        } else if (payload.op === 'block') {
            const blocked = Array.isArray(body?.blocked) ? [...new Set(body.blocked.map(String).filter(id => BLOCK_ID_RE.test(id)))].slice(0, 500) : null;
            if (!blocked) return reply({ error: 'blocked_invalid' }, 400);
            payload.blocked = blocked;
        }
        const response = await stub.fetch(new Request(`https://airport-geo/${key}/admin`, { method: 'POST', body: JSON.stringify(payload) }));
        if (payload.op === 'delete' && response.ok) await indexCall('remove', { key });
        return syncIndex(response);
    }
    if (parts.length > 1) return reply({ error: 'not_found' }, 404);
    if (request.method === 'GET') return stub.fetch(new Request('https://airport-geo/' + key));
    const { body, error } = await readBody(request);
    if (error) return error;
    const prepared = await prepareContext(key, body);
    if (prepared.error) return prepared.error;
    return syncIndex(await stub.fetch(new Request('https://airport-geo/' + key, {
        method: 'POST',
        body: JSON.stringify({ key, ...prepared, leaseToken: String(body?.leaseToken || '').slice(0, 64) })
    })));
}
