(function () {
    'use strict';

    function createDwdWeatherReader({ root, decodeTile, readManifest = response => response.json(),
        fetchAssetResponse = fetch, tileLimit = 24, mayCache = () => true, timeoutMs = 15000, onManifest = null }) {

        const HOUR = 3600000;
        const MANIFEST_TTL = 60000;
        const TILE_TTL = 10 * 60000;
        const MISSING = -32768;
        const tiles = new Map();
        const pending = new Map();
        let currentManifest = null;
        let manifestRequest = null;

        async function fetchAsset(path, cache = 'default') {
            const response = await fetchAssetResponse(root + path, {
                cache, signal: AbortSignal.timeout(timeoutMs)
            });
            if (response.status === 404) return null;
            if (!response.ok) throw new Error('DWD ICON-EU HTTP ' + response.status);
            return response;
        }

        async function manifest(force = false) {
            if (!force && currentManifest && Date.now() < currentManifest.expires) return currentManifest.data;
            if (!manifestRequest) {
                // URL variant also bypasses previously installed cache-first service workers.
                const stamp = force ? 'retry-' + Date.now() : Math.floor(Date.now() / MANIFEST_TTL);
                manifestRequest = fetchAsset('/manifest.json?dwd=' + stamp, 'no-store').then(async response => {
                    if (!response) throw new Error('DWD ICON-EU: forecast index is unavailable');
                    const data = await readManifest(response);
                    if (data.version !== 1 || data.source !== 'dwd-icon-eu' || !Array.isArray(data.terms)) {
                        throw new Error('DWD ICON-EU: invalid forecast index');
                    }
                    currentManifest = { data, expires: Date.now() + MANIFEST_TTL };
                    if (onManifest) onManifest(termWindow(data));
                    return data;
                }).finally(() => { manifestRequest = null; });
            }
            return manifestRequest;
        }

        // First and last published forecast hour: the hour pickers offer only these.
        function termWindow(data) {
            const times = data.terms.map(term => term.validAt).filter(Number.isFinite);
            return times.length ? { first: Math.min(...times), last: Math.max(...times) } : null;
        }

        function pruneTiles() {
            const now = Date.now();
            for (const [key, item] of tiles) if (item.expires <= now) tiles.delete(key);
            while (tiles.size > tileLimit) tiles.delete(tiles.keys().next().value);
        }

        function tile(path, size) {
            pruneTiles();
            const cached = tiles.get(path);
            if (cached) {
                tiles.delete(path);
                tiles.set(path, cached);
                return Promise.resolve(cached.data);
            }
            if (!pending.has(path)) {
                const request = fetchAsset(path).then(async response => {
                    if (!response) return null;
                    const view = await decodeTile(response, size);
                    if (view.byteLength !== size) throw new Error('DWD ICON-EU: invalid tile');
                    if (mayCache()) {
                        tiles.set(path, { data: view, expires: Date.now() + TILE_TTL });
                        pruneTiles();
                    }
                    return view;
                }).finally(() => pending.delete(path));
                pending.set(path, request);
            }
            return pending.get(path);
        }

        function wind(u, v) {
            if (u === null || v === null) return [null, null];
            return [Math.hypot(u, v) * 3600 / 1852, (Math.atan2(-u, -v) * 180 / Math.PI + 360) % 360];
        }

        function sample(view, fields, index, cells, point, data, term, profile) {
            const values = {};
            fields.forEach(([key, level], column) => {
                const raw = view.getInt16((column * cells + index) * 2, true);
                if (raw === MISSING) return;
                const [offset, scale] = data.encoding[key] || [0, 1];
                values[key + (level || '')] = raw / scale + offset;
            });
            if (!Object.keys(values).length) return null;
            const value = (key, level = '') => values[key + level] ?? null;
            const [wspd, wdir] = wind(value('u_10m'), value('v_10m'));
            return {
                lat: point.lat, lon: point.lon, wspd, wdir, contourValidAt: term.validAt, modelRunAt: term.runAt,
                cloudLowPct: value('clcl'), cloudMidPct: value('clcm'), cloudHighPct: value('clch'), cloudTotalPct: value('clct'),
                mslPressureHpa: value('pmsl') === null ? null : value('pmsl') / 100,
                visibilityM: null, ceilingMslM: value('ceiling'), modelTerrainMslM: value('hsurf'), weatherCode: value('ww'),
                temp2mC: value('t_2m') === null ? null : value('t_2m') - 273.15,
                pressureProfile: profile ? data.levels.map(hPa => {
                    const [windKt, windDirDeg] = wind(value('u', hPa), value('v', hPa));
                    const height = value('fi', hPa);
                    const temperature = value('t', hPa);
                    return { hPa, windKt, windDirDeg, cloudPct: value('clc', hPa),
                        geopotentialFt: height === null ? null : height * 3.280839895 / 9.80665,
                        temperatureC: temperature === null ? null : temperature - 273.15 };
                }) : []
            };
        }

        async function read(points, { signal, includePressure = false, validAt = null } = {}, refresh = false) {
            signal?.throwIfAborted();
            const data = await manifest(refresh);
            const current = Math.floor(Date.now() / HOUR) * HOUR;
            const term = validAt === null
                ? data.terms.filter(item => item.validAt <= current && item.validAt >= current - 2 * HOUR).at(-1)
                : data.terms.find(item => item.validAt === validAt);
            if (!term) return points.map(() => null);
            const [south, west, north, east] = data.bounds;
            const side = data.samplesPerDegree * data.tileDegrees;
            const product = includePressure ? 'profile' : 'map';
            const fields = data.fields[product];
            const cells = side * side;
            const grouped = new Map();
            points.forEach((point, i) => {
                if (point.lat < south || point.lat >= north || point.lon < west || point.lon >= east) return;
                const row = Math.min(Math.round((point.lat - south) * data.samplesPerDegree), (north - south) * data.samplesPerDegree - 1);
                const col = Math.min(Math.round((point.lon - west) * data.samplesPerDegree), (east - west) * data.samplesPerDegree - 1);
                const lat = south + Math.floor(row / side) * data.tileDegrees;
                const lon = west + Math.floor(col / side) * data.tileDegrees;
                const path = `/v1/${term.key}/${lat}-${lon}-${product}.bin.gz`;
                if (!grouped.has(path)) grouped.set(path, []);
                grouped.get(path).push([i, (row % side) * side + col % side]);
            });
            const results = points.map(() => null);
            const batches = Array.from(grouped);
            let missing = false;
            for (let offset = 0; offset < batches.length; offset += 6) {
                signal?.throwIfAborted();
                await Promise.all(batches.slice(offset, offset + 6).map(async ([path, rows]) => {
                    const view = await tile(path, fields.length * cells * 2);
                    if (!view) { missing = true; return; }
                    for (const [i, cell] of rows) results[i] = sample(view, fields, cell, cells, points[i], data, term, includePressure);
                }));
            }
            signal?.throwIfAborted();
            return missing && !refresh ? read(points, { signal, includePressure, validAt }, true) : results;
        }

        return { read, manifest, termWindow, pruneTiles, clear() { tiles.clear(); currentManifest = null; } };
    }

    if (typeof module === 'object' && module.exports) {
        module.exports = { createDwdWeatherReader };
        return;
    }
    const root = window.GA_DWD_STATIC_URL;
    if (!root || typeof DecompressionStream !== 'function' || typeof AbortSignal.timeout !== 'function') return;
    const reader = createDwdWeatherReader({ root, mayCache: () => !document.hidden,
        onManifest: range => { window.gaDwdTermWindow = range && { first: range.first, last: range.last, at: Date.now() }; },
        decodeTile: async response => new DataView(await new Response(
            response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()) });
    document.addEventListener('visibilitychange', () => { if (document.hidden) reader.clear(); });
    setInterval(reader.pruneTiles, 10 * 60000);
    window.fetchStaticDwdWeatherPoints = reader.read;
    window.GA_DWD_WEATHER_PREFETCH = true;
}());
