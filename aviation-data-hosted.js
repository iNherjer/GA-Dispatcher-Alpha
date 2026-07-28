(function initHostedAviationData(globalScope) {
    'use strict';

    const BASE_URL = 'https://inherjer.github.io/GA-Dispatcher-Aviation-Data/';
    const LATEST_URL = `${BASE_URL}latest.json`;
    const COLLECTIONS = Object.freeze([
        'airspaces',
        'airports',
        'navaids',
        'reportingPoints'
    ]);
    const COLLECTION_PATHS = Object.freeze({
        airspaces: 'airspaces/',
        airports: 'airports/',
        navaids: 'navaids/',
        reportingPoints: 'reporting-points/'
    });
    const CATALOG_TTL_MS = 60 * 60 * 1000;
    const CATALOG_TIMEOUT_MS = 15 * 1000;
    const PACK_TIMEOUT_MS = 30 * 1000;
    const PACK_FETCH_CONCURRENCY = 3;
    const MAX_SELECTED_PACKS = 96;
    const MAX_PACK_CACHE_BYTES = 24 * 1024 * 1024;

    const state = {
        catalog: null,
        catalogPromise: null,
        lastCatalogCheckAt: 0,
        retryAfter: 0,
        dataRetryAfter: 0,
        consecutiveFailures: 0,
        lastError: '',
        lastErrorAt: 0,
        lastSuccessAt: 0,
        requests: 0,
        packRequests: 0,
        packCacheHits: 0,
        fallbackCount: 0,
        lastFallbackAt: 0,
        lastFallbackReason: ''
    };
    const packCache = new Map();
    const packInflight = new Map();
    let packCacheBytes = 0;

    function makeError(message, details = {}) {
        const error = new Error(message);
        Object.assign(error, details);
        return error;
    }

    function validBbox(bbox) {
        return Array.isArray(bbox)
            && bbox.length === 4
            && bbox.every(value => Number.isFinite(Number(value)))
            && Number(bbox[0]) >= -180
            && Number(bbox[2]) <= 180
            && Number(bbox[1]) >= -90
            && Number(bbox[3]) <= 90
            && Number(bbox[0]) <= Number(bbox[2])
            && Number(bbox[1]) <= Number(bbox[3]);
    }

    function normalizeBounds(bounds) {
        const west = Math.max(-180, Number(bounds?.west));
        const south = Math.max(-90, Number(bounds?.south));
        const east = Math.min(180, Number(bounds?.east));
        const north = Math.min(90, Number(bounds?.north));
        if (
            ![west, south, east, north].every(Number.isFinite)
            || east <= west
            || north <= south
        ) {
            throw makeError('hosted_invalid_bounds');
        }
        return { west, south, east, north };
    }

    function bboxIntersectsBounds(bbox, bounds) {
        return validBbox(bbox)
            && Number(bbox[0]) <= bounds.east
            && Number(bbox[2]) >= bounds.west
            && Number(bbox[1]) <= bounds.north
            && Number(bbox[3]) >= bounds.south;
    }

    function retryAfterMs(response) {
        const raw = response?.headers?.get?.('Retry-After');
        if (!raw) return 0;
        const seconds = Number(raw);
        if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
        const date = Date.parse(raw);
        return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
    }

    async function fetchWithTimeout(url, timeoutMs, cache = 'default') {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, {
                cache,
                headers: { Accept: 'application/json' },
                signal: controller.signal
            });
            if (!response.ok) {
                throw makeError(`hosted_http_${response.status}`, {
                    status: Number(response.status) || 0,
                    retryAfterMs: retryAfterMs(response)
                });
            }
            return response;
        } catch (error) {
            if (error?.name === 'AbortError') {
                throw makeError('hosted_timeout', { cause: error });
            }
            throw error;
        } finally {
            clearTimeout(timer);
        }
    }

    function sha256HexFallback(buffer) {
        // WebCrypto ist unter lokalem HTTP (z. B. iPhone -> Rechner-IP) nicht
        // immer als Secure-Context-API verfügbar. Dieser kompakte Fallback
        // hält die Integritätsprüfung dort trotzdem aktiv.
        const input = new Uint8Array(buffer);
        const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
        const padded = new Uint8Array(paddedLength);
        padded.set(input);
        padded[input.length] = 0x80;
        const view = new DataView(padded.buffer);
        const bitLength = input.length * 8;
        view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
        view.setUint32(paddedLength - 4, bitLength >>> 0, false);

        const constants = new Uint32Array([
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
            0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
            0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
            0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
            0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
            0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
            0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
            0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
            0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
        ]);
        const hash = new Uint32Array([
            0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
            0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
        ]);
        const words = new Uint32Array(64);
        const rotateRight = (value, shift) => (value >>> shift) | (value << (32 - shift));

        for (let offset = 0; offset < paddedLength; offset += 64) {
            for (let index = 0; index < 16; index += 1) {
                words[index] = view.getUint32(offset + (index * 4), false);
            }
            for (let index = 16; index < 64; index += 1) {
                const x = words[index - 15];
                const y = words[index - 2];
                const sigma0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3);
                const sigma1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10);
                words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
            }
            let a = hash[0];
            let b = hash[1];
            let c = hash[2];
            let d = hash[3];
            let e = hash[4];
            let f = hash[5];
            let g = hash[6];
            let h = hash[7];
            for (let index = 0; index < 64; index += 1) {
                const sigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
                const choice = (e & f) ^ (~e & g);
                const temp1 = (h + sigma1 + choice + constants[index] + words[index]) >>> 0;
                const sigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
                const majority = (a & b) ^ (a & c) ^ (b & c);
                const temp2 = (sigma0 + majority) >>> 0;
                h = g;
                g = f;
                f = e;
                e = (d + temp1) >>> 0;
                d = c;
                c = b;
                b = a;
                a = (temp1 + temp2) >>> 0;
            }
            hash[0] = (hash[0] + a) >>> 0;
            hash[1] = (hash[1] + b) >>> 0;
            hash[2] = (hash[2] + c) >>> 0;
            hash[3] = (hash[3] + d) >>> 0;
            hash[4] = (hash[4] + e) >>> 0;
            hash[5] = (hash[5] + f) >>> 0;
            hash[6] = (hash[6] + g) >>> 0;
            hash[7] = (hash[7] + h) >>> 0;
        }
        return Array.from(hash)
            .map(value => value.toString(16).padStart(8, '0'))
            .join('');
    }

    async function sha256Hex(buffer) {
        if (globalScope.crypto?.subtle?.digest) {
            const digest = await globalScope.crypto.subtle.digest('SHA-256', buffer);
            return Array.from(new Uint8Array(digest))
                .map(value => value.toString(16).padStart(2, '0'))
                .join('');
        }
        return sha256HexFallback(buffer);
    }

    function parseJsonBuffer(buffer, label) {
        try {
            return JSON.parse(new TextDecoder().decode(buffer));
        } catch (error) {
            throw makeError(`hosted_${label}_invalid_json`, { cause: error });
        }
    }

    async function readJsonResponse(response, options = {}) {
        const buffer = await response.arrayBuffer();
        if (
            Number.isFinite(Number(options.expectedBytes))
            && Number(options.expectedBytes) > 0
            && buffer.byteLength !== Number(options.expectedBytes)
        ) {
            throw makeError(`hosted_${options.label || 'data'}_size_mismatch`);
        }
        if (options.expectedSha256) {
            const actualSha256 = await sha256Hex(buffer);
            if (actualSha256 !== String(options.expectedSha256).toLowerCase()) {
                throw makeError(`hosted_${options.label || 'data'}_hash_mismatch`);
            }
        }
        return {
            parsed: parseJsonBuffer(buffer, options.label || 'data'),
            bytes: buffer.byteLength
        };
    }

    function validateLatest(latest) {
        if (
            Number(latest?.schemaVersion) !== 1
            || !/^snapshot-\d{4}-\d{2}-\d{2}(?:-[a-z0-9-]+)?$/i.test(String(latest?.datasetVersion || ''))
            || !/^cycles\/[^/]+\/manifest\.json$/.test(String(latest?.manifest || ''))
            || !/^[a-f0-9]{64}$/i.test(String(latest?.manifestSha256 || ''))
            || !Number.isFinite(Number(latest?.manifestBytes))
            || Number(latest.manifestBytes) <= 0
            || Number(latest.manifestBytes) > 5 * 1024 * 1024
        ) {
            throw makeError('hosted_latest_invalid');
        }
        return latest;
    }

    function validatePackEntry(collection, entry) {
        const url = String(entry?.url || '');
        if (
            !entry
            || typeof entry !== 'object'
            || !url.startsWith(COLLECTION_PATHS[collection])
            || url.includes('..')
            || url.startsWith('/')
            || !/^[a-z0-9/_-]+\.json$/i.test(url)
            || !validBbox(entry.bbox)
            || !/^[A-Z]{2}$/.test(String(entry.country || ''))
            || !Number.isInteger(Number(entry.count))
            || Number(entry.count) < 0
            || !Number.isInteger(Number(entry.bytes))
            || Number(entry.bytes) <= 0
            || Number(entry.bytes) > 7 * 1024 * 1024
            || !/^[a-f0-9]{64}$/i.test(String(entry.sha256 || ''))
        ) {
            throw makeError(`hosted_manifest_pack_invalid:${collection}:${url || 'unknown'}`);
        }
        return {
            id: String(entry.id || url),
            url,
            country: String(entry.country),
            bbox: entry.bbox.map(Number),
            count: Number(entry.count),
            bytes: Number(entry.bytes),
            sha256: String(entry.sha256).toLowerCase()
        };
    }

    function validateManifest(manifest, latest, manifestUrl) {
        if (
            Number(manifest?.schemaVersion) !== 1
            || String(manifest?.datasetVersion || '') !== String(latest.datasetVersion)
            || manifest?.scope?.type !== 'global'
            || manifest?.source?.name !== 'OpenAIP'
            || manifest?.source?.license !== 'CC BY-NC 4.0'
        ) {
            throw makeError('hosted_manifest_invalid');
        }
        const indexes = {};
        for (const collection of COLLECTIONS) {
            const source = manifest?.collections?.[collection];
            if (
                !source
                || !Array.isArray(source.packs)
                || Number(source.packCount) !== source.packs.length
                || Number(source.count) <= 0
            ) {
                throw makeError(`hosted_manifest_collection_invalid:${collection}`);
            }
            indexes[collection] = source.packs.map(entry => validatePackEntry(collection, entry));
        }
        return {
            datasetVersion: String(manifest.datasetVersion),
            generatedAt: String(manifest.generatedAt || ''),
            manifestUrl,
            packBaseUrl: new URL('./', manifestUrl).href,
            indexes
        };
    }

    function noteFailure(error, dataFailure = false) {
        state.lastError = String(error?.message || error || 'hosted_unknown_error');
        state.lastErrorAt = Date.now();
        state.consecutiveFailures += 1;
        const baseDelay = Number(error?.status) === 429 ? 60 * 1000 : 30 * 1000;
        const backoff = Math.min(
            5 * 60 * 1000,
            baseDelay * Math.pow(2, Math.min(3, state.consecutiveFailures - 1))
        );
        state.retryAfter = Date.now() + Math.max(Number(error?.retryAfterMs) || 0, backoff);
        if (dataFailure) state.dataRetryAfter = state.retryAfter;
    }

    function noteSuccess() {
        state.lastSuccessAt = Date.now();
        state.lastError = '';
        state.retryAfter = 0;
        state.dataRetryAfter = 0;
        state.consecutiveFailures = 0;
    }

    function clearPackCache() {
        packCache.clear();
        packInflight.clear();
        packCacheBytes = 0;
    }

    async function loadCatalog() {
        const latestResponse = await fetchWithTimeout(LATEST_URL, CATALOG_TIMEOUT_MS, 'no-cache');
        const latest = validateLatest((await readJsonResponse(latestResponse, {
            label: 'latest'
        })).parsed);
        if (
            state.catalog
            && state.catalog.datasetVersion === latest.datasetVersion
            && state.catalog.manifestSha256 === String(latest.manifestSha256).toLowerCase()
        ) {
            return state.catalog;
        }

        const manifestUrl = new URL(latest.manifest, BASE_URL).href;
        if (!manifestUrl.startsWith(BASE_URL)) throw makeError('hosted_manifest_url_invalid');
        const manifestResponse = await fetchWithTimeout(manifestUrl, CATALOG_TIMEOUT_MS);
        const manifestResult = await readJsonResponse(manifestResponse, {
            label: 'manifest',
            expectedBytes: Number(latest.manifestBytes),
            expectedSha256: String(latest.manifestSha256).toLowerCase()
        });
        const catalog = validateManifest(manifestResult.parsed, latest, manifestUrl);
        catalog.manifestSha256 = String(latest.manifestSha256).toLowerCase();
        if (state.catalog?.datasetVersion !== catalog.datasetVersion) clearPackCache();
        return catalog;
    }

    async function ensureCatalog() {
        const now = Date.now();
        if (
            state.catalog
            && (now - state.lastCatalogCheckAt) < CATALOG_TTL_MS
        ) return state.catalog;
        if (state.catalogPromise) return state.catalogPromise;
        if (!state.catalog && state.retryAfter > now) {
            throw makeError(state.lastError || 'hosted_catalog_cooldown', {
                retryAfterMs: state.retryAfter - now
            });
        }

        state.catalogPromise = (async () => {
            try {
                const catalog = await loadCatalog();
                state.catalog = catalog;
                state.lastCatalogCheckAt = Date.now();
                noteSuccess();
                return catalog;
            } catch (error) {
                noteFailure(error);
                if (state.catalog) {
                    console.warn(
                        '[Aviation Data Hosted] Katalog-Aktualisierung fehlgeschlagen; '
                        + 'verwende den bereits geprüften Stand:',
                        state.lastError
                    );
                    state.lastCatalogCheckAt = Date.now();
                    return state.catalog;
                }
                throw error;
            } finally {
                state.catalogPromise = null;
            }
        })();
        return state.catalogPromise;
    }

    function validatePack(pack, entry, collection, catalog) {
        if (
            Number(pack?.schemaVersion) !== 1
            || String(pack?.datasetVersion || '') !== catalog.datasetVersion
            || pack?.collection !== collection
            || pack?.country !== entry.country
            || Number(pack?.count) !== entry.count
            || !Array.isArray(pack?.items)
            || pack.items.length !== entry.count
            || !validBbox(pack?.bbox)
        ) {
            throw makeError(`hosted_pack_invalid:${entry.url}`);
        }
        for (const item of pack.items) {
            if (
                !item
                || typeof item !== 'object'
                || !String(item.id || '').trim()
                || !validBbox(item.bbox)
                || !item.geometry
                || typeof item.geometry !== 'object'
            ) {
                throw makeError(`hosted_pack_item_invalid:${entry.url}`);
            }
        }
        return pack;
    }

    function rememberPack(key, value, bytes) {
        if (packCache.has(key)) {
            packCacheBytes -= Number(packCache.get(key)?.bytes) || 0;
            packCache.delete(key);
        }
        if (bytes <= MAX_PACK_CACHE_BYTES) {
            packCache.set(key, { value, bytes, storedAt: Date.now() });
            packCacheBytes += bytes;
        }
        while (packCacheBytes > MAX_PACK_CACHE_BYTES && packCache.size > 1) {
            const oldestKey = packCache.keys().next().value;
            const oldest = packCache.get(oldestKey);
            packCache.delete(oldestKey);
            packCacheBytes -= Number(oldest?.bytes) || 0;
        }
    }

    async function loadPack(catalog, collection, entry) {
        const key = `${catalog.datasetVersion}:${entry.url}`;
        const cached = packCache.get(key);
        if (cached) {
            packCache.delete(key);
            packCache.set(key, cached);
            state.packCacheHits += 1;
            return cached.value;
        }
        if (packInflight.has(key)) return packInflight.get(key);

        const promise = (async () => {
            state.packRequests += 1;
            const url = new URL(entry.url, catalog.packBaseUrl).href;
            if (!url.startsWith(catalog.packBaseUrl)) {
                throw makeError(`hosted_pack_url_invalid:${entry.url}`);
            }
            const response = await fetchWithTimeout(url, PACK_TIMEOUT_MS);
            const result = await readJsonResponse(response, {
                label: 'pack',
                expectedBytes: entry.bytes,
                expectedSha256: entry.sha256
            });
            const pack = validatePack(result.parsed, entry, collection, catalog);
            rememberPack(key, pack, result.bytes);
            return pack;
        })();
        packInflight.set(key, promise);
        try {
            return await promise;
        } finally {
            if (packInflight.get(key) === promise) packInflight.delete(key);
        }
    }

    async function mapWithConcurrency(items, concurrency, mapper) {
        const results = new Array(items.length);
        let nextIndex = 0;
        async function worker() {
            while (nextIndex < items.length) {
                const index = nextIndex;
                nextIndex += 1;
                results[index] = await mapper(items[index], index);
            }
        }
        const workerCount = Math.min(Math.max(1, concurrency), Math.max(1, items.length));
        await Promise.all(Array.from({ length: workerCount }, () => worker()));
        return results;
    }

    function normalizeCollections(requested) {
        if (!Array.isArray(requested) || requested.length === 0) return [...COLLECTIONS];
        const unique = [...new Set(requested.map(value => String(value || '').trim()).filter(Boolean))];
        if (!unique.length || unique.some(value => !COLLECTIONS.includes(value))) {
            throw makeError('hosted_invalid_collections');
        }
        return unique;
    }

    async function fetchSnapshot(bounds, options = {}) {
        state.requests += 1;
        if (state.dataRetryAfter > Date.now()) {
            throw makeError(state.lastError || 'hosted_data_cooldown', {
                retryAfterMs: state.dataRetryAfter - Date.now()
            });
        }
        const normalized = normalizeBounds(bounds);
        const requestedCollections = normalizeCollections(options.collections);
        const catalog = await ensureCatalog();
        const tasks = [];
        const selectedByCollection = {};
        for (const collection of requestedCollections) {
            const selected = catalog.indexes[collection]
                .filter(entry => bboxIntersectsBounds(entry.bbox, normalized));
            selectedByCollection[collection] = selected;
            selected.forEach(entry => tasks.push({ collection, entry }));
        }
        if (tasks.length > MAX_SELECTED_PACKS) {
            throw makeError(`hosted_pack_selection_too_large:${tasks.length}`);
        }

        try {
            const loaded = await mapWithConcurrency(
                tasks,
                PACK_FETCH_CONCURRENCY,
                task => loadPack(catalog, task.collection, task.entry)
                    .then(pack => ({ ...task, pack }))
            );
            const payload = {
                bbox: [normalized.west, normalized.south, normalized.east, normalized.north],
                airspaces: [],
                airports: [],
                navaids: [],
                reportingPoints: [],
                meta: {
                    source: 'hosted',
                    datasetVersion: catalog.datasetVersion,
                    generatedAt: catalog.generatedAt,
                    fetchedAtMs: Date.now(),
                    partial: false,
                    collections: {}
                }
            };
            const seen = Object.fromEntries(COLLECTIONS.map(collection => [collection, new Set()]));
            for (const collection of COLLECTIONS) {
                const requested = requestedCollections.includes(collection);
                payload.meta.collections[collection] = requested
                    ? {
                        source: 'hosted',
                        errorStatus: 0,
                        packCount: selectedByCollection[collection].length
                    }
                    : { source: 'hosted', errorStatus: 204, skipped: true };
            }
            for (const { collection, pack } of loaded) {
                for (const item of pack.items) {
                    if (!bboxIntersectsBounds(item.bbox, normalized)) continue;
                    const id = String(item.id || '');
                    if (!id || seen[collection].has(id)) continue;
                    seen[collection].add(id);
                    payload[collection].push(item);
                }
            }
            noteSuccess();
            return payload;
        } catch (error) {
            noteFailure(error, true);
            throw error;
        }
    }

    function recordFallback(error) {
        state.fallbackCount += 1;
        state.lastFallbackAt = Date.now();
        state.lastFallbackReason = String(error?.message || error || 'hosted_unknown_error');
    }

    function getStatus() {
        return {
            baseUrl: BASE_URL,
            catalogLoaded: !!state.catalog,
            datasetVersion: state.catalog?.datasetVersion || '',
            generatedAt: state.catalog?.generatedAt || '',
            lastCatalogCheckAt: state.lastCatalogCheckAt,
            retryAfter: state.retryAfter,
            dataRetryAfter: state.dataRetryAfter,
            requests: state.requests,
            packRequests: state.packRequests,
            packCacheHits: state.packCacheHits,
            packCacheEntries: packCache.size,
            packCacheBytes,
            lastSuccessAt: state.lastSuccessAt,
            lastErrorAt: state.lastErrorAt,
            lastError: state.lastError,
            fallbackCount: state.fallbackCount,
            lastFallbackAt: state.lastFallbackAt,
            lastFallbackReason: state.lastFallbackReason
        };
    }

    function reset() {
        state.catalog = null;
        state.catalogPromise = null;
        state.lastCatalogCheckAt = 0;
        state.retryAfter = 0;
        state.dataRetryAfter = 0;
        state.consecutiveFailures = 0;
        state.lastError = '';
        state.lastErrorAt = 0;
        clearPackCache();
    }

    globalScope.gaHostedAviationData = Object.freeze({
        fetchSnapshot,
        getStatus,
        recordFallback,
        reset,
        constants: Object.freeze({
            baseUrl: BASE_URL,
            collections: COLLECTIONS,
            maxPackCacheBytes: MAX_PACK_CACHE_BYTES
        })
    });
})(window);
