#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolDir, '..');
const providerSource = fs.readFileSync(path.join(rootDir, 'aviation-data-hosted.js'), 'utf8');
const mapSource = fs.readFileSync(path.join(rootDir, 'map.js'), 'utf8');

function jsonText(value) {
    return `${JSON.stringify(value)}\n`;
}

function sha256(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function extractFunctionDeclaration(source, name) {
    const asyncMarker = `async function ${name}(`;
    const regularMarker = `function ${name}(`;
    const asyncStart = source.indexOf(asyncMarker);
    const start = asyncStart >= 0 ? asyncStart : source.indexOf(regularMarker);
    assert.ok(start >= 0, `${name} fehlt`);
    const signatureEnd = source.indexOf(') {', start);
    assert.ok(signatureEnd >= 0, `${name}: Signatur nicht abgeschlossen`);
    const bodyStart = signatureEnd + 2;
    let depth = 0;
    for (let index = bodyStart; index < source.length; index += 1) {
        const char = source[index];
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) return source.slice(start, index + 1);
        }
    }
    throw new Error(`${name}: Funktionskörper nicht abgeschlossen`);
}

const datasetVersion = 'snapshot-2026-07-28';
const generatedAt = '2026-07-28T08:44:28.006Z';
const bbox = [7, 47, 9, 49];
const collectionPaths = {
    airspaces: 'airspaces/DE/lat-27-lon-37.json',
    airports: 'airports/DE/lat-27-lon-37.json',
    navaids: 'navaids/DE/lat-27-lon-37.json',
    reportingPoints: 'reporting-points/DE/lat-27-lon-37.json'
};
const itemGeometry = {
    airspaces: {
        type: 'Polygon',
        coordinates: [[[7.4, 47.7], [7.8, 47.7], [7.8, 48.1], [7.4, 47.7]]]
    },
    airports: { type: 'Point', coordinates: [7.7, 47.9] },
    navaids: { type: 'Point', coordinates: [7.6, 47.8] },
    reportingPoints: { type: 'Point', coordinates: [7.5, 47.75] }
};
const packBodies = {};
const collections = {};
for (const collection of Object.keys(collectionPaths)) {
    const item = {
        id: `${collection}-1`,
        name: `${collection} fixture`,
        country: 'DE',
        bbox: collection === 'airspaces' ? [7.4, 47.7, 7.8, 48.1] : [
            itemGeometry[collection].coordinates[0],
            itemGeometry[collection].coordinates[1],
            itemGeometry[collection].coordinates[0],
            itemGeometry[collection].coordinates[1]
        ],
        geometry: itemGeometry[collection]
    };
    const body = jsonText({
        schemaVersion: 1,
        datasetVersion,
        generatedAt,
        collection,
        country: 'DE',
        bbox: item.bbox,
        count: 1,
        source: { name: 'OpenAIP', license: 'CC BY-NC 4.0' },
        items: [item]
    });
    packBodies[collectionPaths[collection]] = body;
    collections[collection] = {
        sourceCount: 1,
        count: 1,
        packCount: 1,
        packs: [{
            id: `DE/${collection}`,
            url: collectionPaths[collection],
            country: 'DE',
            bbox: item.bbox,
            count: 1,
            bytes: Buffer.byteLength(body),
            sha256: sha256(body)
        }]
    };
}

const manifestPath = `cycles/${datasetVersion}/manifest.json`;
const manifestBody = jsonText({
    schemaVersion: 1,
    datasetVersion,
    generatedAt,
    cadenceDays: 28,
    scope: { type: 'global' },
    packCellSpanDegrees: 5,
    source: { name: 'OpenAIP', license: 'CC BY-NC 4.0' },
    collections
});
const latestBody = jsonText({
    schemaVersion: 1,
    datasetVersion,
    generatedAt,
    scope: { type: 'global' },
    manifest: manifestPath,
    manifestBytes: Buffer.byteLength(manifestBody),
    manifestSha256: sha256(manifestBody)
});

const baseUrl = 'https://inherjer.github.io/GA-Dispatcher-Aviation-Data/';
const responses = new Map([
    [`${baseUrl}latest.json`, latestBody],
    [`${baseUrl}${manifestPath}`, manifestBody],
    ...Object.entries(packBodies).map(([url, body]) => [
        `${baseUrl}cycles/${datasetVersion}/${url}`,
        body
    ])
]);
const fetchCalls = [];
let corruptAirportPack = false;
const providerContext = vm.createContext({
    console: { warn: () => {} },
    crypto: crypto.webcrypto,
    AbortController,
    TextDecoder,
    URL,
    Uint8Array,
    Uint32Array,
    ArrayBuffer,
    DataView,
    Date,
    Map,
    Set,
    Promise,
    Object,
    Number,
    String,
    RegExp,
    Error,
    Math,
    JSON,
    setTimeout,
    clearTimeout,
    fetch: async (url) => {
        const key = String(url);
        fetchCalls.push(key);
        let body = responses.get(key);
        if (corruptAirportPack && key.endsWith(collectionPaths.airports)) {
            body = body.replace('airports fixture', 'corrupt fixture');
        }
        if (body === undefined) return new Response('', { status: 404 });
        return new Response(body, {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    },
    Response
});
providerContext.window = providerContext;
vm.runInContext(providerSource, providerContext);

const provider = providerContext.gaHostedAviationData;
const firstPayload = await provider.fetchSnapshot({
    west: 7.2,
    south: 47.5,
    east: 8.2,
    north: 48.3
});
for (const collection of Object.keys(collectionPaths)) {
    assert.equal(firstPayload[collection].length, 1, `${collection} fehlt im Hosted-Payload`);
}
assert.equal(firstPayload.meta.source, 'hosted');
assert.equal(provider.getStatus().packRequests, 4);

await provider.fetchSnapshot({
    west: 7.2,
    south: 47.5,
    east: 8.2,
    north: 48.3
});
assert.equal(provider.getStatus().packRequests, 4, 'RAM-Cache verhinderte Pack-Refetch nicht');
assert.equal(provider.getStatus().packCacheHits, 4);

provider.reset();
providerContext.crypto = {};
const insecureContextPayload = await provider.fetchSnapshot({
    west: 7.2,
    south: 47.5,
    east: 8.2,
    north: 48.3
});
assert.equal(insecureContextPayload.airports.length, 1, 'SHA-256-Fallback für lokales HTTP schlug fehl');

provider.reset();
providerContext.crypto = crypto.webcrypto;
corruptAirportPack = true;
await assert.rejects(
    provider.fetchSnapshot({
        west: 7.2,
        south: 47.5,
        east: 8.2,
        north: 48.3
    }),
    /hosted_pack_(?:size|hash)_mismatch/,
    'korrumpierter Pack wurde nicht abgelehnt'
);

let fallbackRecorded = 0;
let v2Requests = 0;
const mapContext = vm.createContext({
    console: { warn: () => {} },
    window: null,
    OPENAIP_PROXY_BASE: 'https://ga-proxy.example',
    OPENAIP_DATA_MODE_HOSTED: 'hosted',
    OPENAIP_DATA_MODE_REGION: 'region',
    OPENAIP_AUX_CACHE_MS: 300000,
    OPENAIP_ROUTE_MAX_REGIONS: 12,
    openAipRegionState: { payload: null, key: '' },
    openAipAuxSnapshotCache: new Map(),
    openAipAuxSnapshotInflight: new Map(),
    isOpenAipHostedMode: () => true,
    fetch: async () => {
        v2Requests += 1;
        return {
            ok: true,
            headers: { get: () => null },
            json: async () => ({
                bbox,
                airports: [],
                airspaces: [{ id: 'v2-airspace' }],
                navaids: [],
                reportingPoints: [],
                meta: {
                    collections: {
                        airports: { errorStatus: 0 },
                        airspaces: { errorStatus: 0 },
                        navaids: { errorStatus: 0 },
                        reportingPoints: { errorStatus: 0 }
                    }
                }
            })
        };
    }
});
mapContext.window = mapContext;
mapContext.gaHostedAviationData = {
    fetchSnapshot: async () => {
        throw new Error('hosted_pack_hash_mismatch');
    },
    recordFallback: () => {
        fallbackRecorded += 1;
    }
};
for (const name of [
    'isOpenAipSnapshotCollectionAvailable',
    'isOpenAipSnapshotSufficient',
    'rememberOpenAipAuxSnapshot',
    'fetchOpenAipV2SnapshotCoverage',
    'fetchOpenAipSnapshotCoverage'
]) {
    vm.runInContext(extractFunctionDeclaration(mapSource, name), mapContext);
}

const fallbackPayload = await mapContext.fetchOpenAipSnapshotCoverage({
    west: 7,
    south: 47,
    east: 9,
    north: 49,
    key: '7.000,47.000,9.000,49.000'
}, 'airspaces');
assert.equal(fallbackPayload.meta.source, 'v2');
assert.equal(fallbackPayload.airspaces.length, 1);
assert.equal(fallbackRecorded, 1, 'Hosted-Fehler wurde nicht als Fallback erfasst');
assert.equal(v2Requests, 1, 'V2 wurde nach Hosted-Fehler nicht genau einmal aufgerufen');

console.log(
    'Hosted aviation data ok: schema/hash validation, RAM cache, corruption rejection '
    + 'and automatic V2 fallback verified'
);
