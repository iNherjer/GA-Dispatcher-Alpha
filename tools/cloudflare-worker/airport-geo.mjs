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
//
// Routen:
//   GET  /api/airport-geo-v1/<key>   { ok, found, stale, ageDays, storedAt, refreshedAt, version, context, refresh? }
//   POST /api/airport-geo-v1/<key>   { context, icao?, leaseToken? } → { ok, result }
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
const ICAO_RE = /^[A-Z0-9]{2,8}$/;

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
    // „Nicht leer“: ohne nutzbare Flaeche kann keine Ankunftsszene stehen.
    if (signature.areas < 1) return { ok: false, error: 'context_empty' };
    return { ok: true, signature };
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
        const context = await this.storage.get('ctx');
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
            pending: !!meta.pending, refresh, context
        });
    }

    async write(body, now) {
        const { key, context, signature, hash, icao, leaseToken } = body;
        const meta = await this.storage.get('meta');
        const record = { key, icao, storedAt: now, refreshedAt: now, version: 1, hash, signature, source: String(context.source || '') };
        if (!meta) {
            await this.storage.put({ meta: record, ctx: context });
            return reply({ ok: true, result: 'stored', version: 1 });
        }
        const stale = now - Number(meta.refreshedAt || meta.storedAt || 0) > AIRPORT_GEO_STALE_MS;
        if (!stale) return reply({ ok: true, result: meta.hash === hash ? 'unchanged' : 'ignored_fresh', version: meta.version });
        const lease = await this.storage.get('lease');
        if (lease && Number(lease.until) > now && lease.token !== leaseToken) return reply({ ok: true, result: 'lease_held', version: meta.version });
        if (meta.hash === hash) {
            await this.storage.put('meta', { ...meta, refreshedAt: now, pending: null });
            await this.storage.delete('lease');
            return reply({ ok: true, result: 'confirmed', version: meta.version });
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
        const oldContext = await this.storage.get('ctx');
        const version = Number(meta.version || 1) + 1;
        const { pending: _p, previous: _prev, ...previous } = meta;
        await this.storage.put({ meta: { ...record, storedAt: now, version, previous }, ctx: context, prevCtx: oldContext });
        await this.storage.delete('lease');
        return reply({ ok: true, result: 'updated', version });
    }

    async fetch(request) {
        try {
            const now = Date.now();
            if (request.method === 'GET') return await this.read(now);
            if (request.method === 'POST') return await this.write(await request.json(), now);
            return reply({ error: 'method' }, 405);
        } catch (error) {
            return reply({ error: String(error?.message || error) }, 400);
        }
    }
}

export async function handleAirportGeo(request, env) {
    if (!env.GA_AIRPORT_GEO) return reply({ error: 'airport_geo_unavailable' }, 503);
    if (!['GET', 'POST'].includes(request.method)) return reply({ error: 'method' }, 405);
    const key = new URL(request.url).pathname.split('/').filter(Boolean)[2] || '';
    if (!airportGeoKeyCenter(key)) return reply({ error: 'key_invalid' }, 400);
    const stub = env.GA_AIRPORT_GEO.get(env.GA_AIRPORT_GEO.idFromName(key));
    if (request.method === 'GET') return stub.fetch(new Request('https://airport-geo/' + key));
    const raw = await request.text();
    if (raw.length > MAX_BODY) return reply({ error: 'request_too_large' }, 413);
    let body;
    try { body = JSON.parse(raw); } catch (_) { return reply({ error: 'json_invalid' }, 400); }
    const check = validateAirportGeoContext(key, body?.context);
    if (!check.ok) return reply({ error: check.error }, 400);
    const icao = String(body?.icao || '').trim().toUpperCase();
    const context = { ...body.context, fetchedAt: Number(body.context.fetchedAt) || Date.now() };
    delete context.cloud;
    return stub.fetch(new Request('https://airport-geo/' + key, {
        method: 'POST',
        body: JSON.stringify({ key, context, signature: check.signature, hash: await airportGeoHash(context),
            icao: ICAO_RE.test(icao) ? icao : '', leaseToken: String(body?.leaseToken || '').slice(0, 64) })
    }));
}
