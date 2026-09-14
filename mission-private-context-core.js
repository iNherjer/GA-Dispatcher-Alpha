(function (root) {
    'use strict';
    const VERSION = 'private-region.v1';
    const RADIUS_KM = 50;
    const NEAR_KM = 25;
    const MAX_PLACES = 8;
    const MAX_TILES = 16;
    const BUDGET_MS = 3000;
    const CACHE_TTL_MS = 7 * 86400000;
    const MAX_CACHE_ENTRIES = 16;
    const clean = (v, max = 160) => typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
    const number = v => typeof v === 'number' && Number.isFinite(v);
    const validPoint = p => number(p?.lat) && number(p?.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
    function distanceKm(a, b) {
        if (!validPoint(a) || !validPoint(b)) return Infinity;
        const rad = Math.PI / 180;
        const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2
            + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2;
        return 12742 * Math.asin(Math.sqrt(Math.min(1, h)));
    }
    function tileKeys(target) {
        if (!validPoint(target)) return [];
        const step = 25 / 60;
        const dy = RADIUS_KM / 110.5;
        const dx = Math.min(180, dy / Math.max(0.01, Math.cos(target.lat * Math.PI / 180)));
        const rows = [];
        // Longitude wraps across the date line; cap at polar latitudes before enumerating.
        const minI = Math.max(0, Math.floor((target.lat - dy + 90) / step));
        const maxI = Math.min(431, Math.floor((target.lat + dy + 90) / step));
        const centerJ = Math.floor((target.lon + 180) / step);
        const span = Math.min(20, Math.ceil(dx / step) + 1);
        for (let i = minI; i <= maxI; i++) for (let offset = -span; offset <= span; offset++) {
            const j = ((centerJ + offset) % 864 + 864) % 864;
            const west = (centerJ + offset) * step - 180;
            const near = { lat: Math.max(i * step - 90, Math.min(target.lat, (i + 1) * step - 90)),
                lon: ((Math.max(west, Math.min(target.lon, west + step)) + 540) % 360) - 180 };
            const km = distanceKm(target, near);
            if (km <= RADIUS_KM) rows.push({ key: `${i}|${j}`, km });
        }
        return rows.sort((a, b) => a.km - b.km || a.key.localeCompare(b.key)).slice(0, MAX_TILES).map(r => r.key);
    }
    function wikiUrl(target) {
        // Geographic relevance search: no activity, attraction or example place in the query.
        const params = new URLSearchParams({ action: 'query', generator: 'search',
            gsrsearch: `nearcoord:${RADIUS_KM}km,${target.lat},${target.lon}`, gsrlimit: '20',
            prop: 'coordinates|description|info', inprop: 'url', format: 'json', origin: '*' });
        return `https://de.wikipedia.org/w/api.php?${params}`;
    }
    function tileCandidates(payload, key) {
        const rows = Array.isArray(payload?.poi) ? payload.poi : payload?.poi?.poi || [];
        return rows.filter(validPoint).map(row => {
            const tags = row.tags || row;
            const descriptors = ['place', 'tourism', 'leisure', 'historic', 'natural', 'landuse', 'amenity', 'shop']
                .filter(k => clean(tags[k])).map(k => `${k}=${clean(tags[k], 50)}`);
            return { name: clean(row.name || row.n), lat: row.lat, lon: row.lon,
                type: descriptors[0] || '', description: descriptors.slice(0, 3).join(', '),
                source: `osm-poi-tile:${key}`, evidence: 'osm-tags',
                // Broad evidence quality, not a mission/activity catalogue.
                quality: (tags.tourism ? 1 : 0) + (descriptors.length > 1 ? 0.5 : 0) };
        }).filter(row => row.name && row.type);
    }
    function wikiCandidates(payload) {
        if (payload?.error) return [];
        return Object.values(payload?.query?.pages || {}).map(page => {
            const coord = page.coordinates?.find(p => p.primary !== undefined) || page.coordinates?.[0];
            return { name: clean(page.title), lat: coord?.lat, lon: coord?.lon,
                type: 'wikipedia', description: clean(page.description, 180),
                source: `https://de.wikipedia.org/?curid=${page.pageid}`, evidence: 'wikipedia-coordinate',
                quality: 2 + (page.description ? 0.5 : 0) };
        }).filter(row => row.name && validPoint(row));
    }
    function selectPlaces(target, candidates, seed = '') {
        const byName = new Map();
        for (const row of candidates) {
            const km = distanceKm(target, row);
            if (!clean(row.name) || km > RADIUS_KM || !clean(row.source)) continue;
            const key = row.name.toLocaleLowerCase('de').normalize('NFKC');
            const item = { ...row, distanceKm: Math.round(km * 10) / 10 };
            const prior = byName.get(key);
            if (!prior || row.quality > prior.quality) byName.set(key, item);
        }
        const pool = [...byName.values()];
        const chosen = [];
        // Small deterministic tie-break avoids alphabetically fixed first choices.
        const tie = name => [...`${seed}|${name}`].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 7) / 4294967296;
        while (pool.length && chosen.length < MAX_PLACES) {
            const score = row => row.quality + (row.distanceKm <= NEAR_KM ? 1 : 0) - row.distanceKm / 100
                - chosen.filter(p => p.type === row.type).length * 1.25
                - chosen.filter(p => distanceKm(p, row) < 2).length * 1.5 + tie(row.name) * 0.15;
            pool.sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
            chosen.push(pool.shift());
        }
        return chosen.map(({ quality, ...row }) => row);
    }
    function knowledge(region) {
        return { status: region.places.length ? 'accept' : 'reject', ok: region.places.length > 0,
            facts: region.places.map(p => ({ ...p, kind: 'place', topic: 'regional_context',
                text: `${p.name}: ${p.description || p.type}; ${p.distanceKm} km Luftlinie vom Zielflugplatz. Der Eintrag belegt Ort und Merkmale, keine Öffnung oder Anschlussfahrt.` })) };
    }
    function cacheKey(target) { return `${VERSION}:${target.lat.toFixed(3)},${target.lon.toFixed(3)}`; }
    async function resolve(target, adapters = {}) {
        if (!validPoint(target)) throw new Error('Invalid private region coordinates');
        const started = Date.now();
        const key = cacheKey(target);
        const cached = await adapters.cacheGet?.(key);
        if (cached?.schema === VERSION && Date.now() - cached.createdAt < CACHE_TTL_MS
            && Array.isArray(cached.places) && cached.places.length <= MAX_PLACES
            && cached.places.every(p => distanceKm(target, p) <= RADIUS_KM)) {
            return { ...cached, stats: { ...cached.stats, cacheHit: true, elapsedMs: Date.now() - started } };
        }
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), BUDGET_MS);
        const candidates = [];
        const stats = { cacheHit: false, tileRequests: 0, tileSuccesses: 0, wikiRequests: 1, wikiSuccess: false, errors: [] };
        const keys = tileKeys(target);
        let cursor = 0;
        const tileJob = async () => {
            while (cursor < keys.length && !abort.signal.aborted) {
                const tile = keys[cursor++]; stats.tileRequests++;
                try {
                    const data = await adapters.readTile(tile, abort.signal);
                    if (data) { stats.tileSuccesses++; candidates.push(...tileCandidates(data, tile)); }
                } catch (_) { stats.errors.push(`tile:${tile}`); }
            }
        };
        const wikiJob = async () => {
            try {
                const data = await adapters.fetchJson(wikiUrl(target), abort.signal);
                const rows = wikiCandidates(data);
                stats.wikiSuccess = !data?.error && rows.length > 0;
                candidates.push(...rows);
            } catch (_) { stats.errors.push('wikipedia'); }
        };
        try { await Promise.allSettled([wikiJob(), ...Array.from({ length: 4 }, tileJob)]); }
        finally { clearTimeout(timer); }
        const region = { schema: VERSION, airport: { name: clean(target.name || target.n), lat: target.lat, lon: target.lon },
            nearKm: NEAR_KM, radiusKm: RADIUS_KM, createdAt: Date.now(),
            places: selectPlaces(target, candidates, key), stats: { ...stats, candidateCount: candidates.length, elapsedMs: Date.now() - started } };
        // Only compact, successful results are persisted, never all tile objects.
        if (region.places.length && stats.wikiSuccess && stats.tileSuccesses === keys.length) await adapters.cachePut?.(key, region);
        return region;
    }
    const memory = new Map();
    const inflight = new Map();
    async function resolveBrowser(target) {
        const key = cacheKey(target);
        if (inflight.has(key)) return inflight.get(key);
        const cacheUrl = `https://private-region.invalid/${encodeURIComponent(key)}`;
        const job = resolve(target, {
            cacheGet: async () => {
                if (memory.has(key)) return memory.get(key);
                try { return await (await (await root.caches.open(VERSION)).match(cacheUrl))?.json(); } catch (_) { return null; }
            },
            cachePut: async (_, data) => {
                memory.set(key, data);
                while (memory.size > MAX_CACHE_ENTRIES) memory.delete(memory.keys().next().value);
                try {
                    const cache = await root.caches.open(VERSION);
                    await cache.delete(cacheUrl);
                    await cache.put(cacheUrl, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
                    const keys = await cache.keys();
                    for (const stale of keys.slice(0, Math.max(0, keys.length - MAX_CACHE_ENTRIES))) await cache.delete(stale);
                } catch (_) { /* Memory cache remains usable when browser quota is exhausted. */ }
            },
            readTile: async (tile, signal) => {
                const [lat, lon] = tile.split('|');
                const res = await root.fetch(`./obstacles/poi-tiles/${lat}/${lon}.json.gz`, { signal });
                if (!res.ok) return null;
                if ((res.headers.get('content-encoding') || '').includes('gzip')) return res.json();
                return new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).json();
            },
            fetchJson: async (url, signal) => {
                const res = await root.fetch(url, { signal });
                if (!res.ok) throw new Error('Region lookup unavailable');
                return res.json();
            }
        }).finally(() => inflight.delete(key));
        inflight.set(key, job);
        return job;
    }
    const api = { VERSION, RADIUS_KM, NEAR_KM, MAX_PLACES, MAX_TILES, BUDGET_MS, CACHE_TTL_MS, MAX_CACHE_ENTRIES,
        distanceKm, tileKeys, wikiUrl, tileCandidates, wikiCandidates, selectPlaces, knowledge, resolve, resolveBrowser };
    root.MissionPrivateContextCore = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
