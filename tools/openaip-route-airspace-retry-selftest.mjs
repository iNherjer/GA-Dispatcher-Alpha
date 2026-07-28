#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolDir, '..');
const appSource = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');
const mapSource = fs.readFileSync(path.join(rootDir, 'map.js'), 'utf8');
const profileSource = fs.readFileSync(path.join(rootDir, 'profile.js'), 'utf8');
const syncSource = fs.readFileSync(path.join(rootDir, 'sync.js'), 'utf8');

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

const scheduled = [];
const cleared = [];
const listEl = { innerHTML: '' };
const containerEl = { style: {} };
let fetchBehavior = async () => {
    const error = new Error('snapshot_http_500');
    error.status = 500;
    throw error;
};

const context = vm.createContext({
    console: {
        debug: () => {},
        error: () => {},
        warn: () => {}
    },
    document: {
        getElementById: id => {
            if (id === 'routeAirspacesList') return listEl;
            if (id === 'routeAirspacesContainer') return containerEl;
            return null;
        }
    },
    ROUTE_AIRSPACE_RETRY_DELAYS_MS: Object.freeze([30000, 60000, 120000, 300000]),
    routeAirspaceRetryState: {
        timer: null,
        attempt: 0,
        routeKey: '',
        requestSeq: 0
    },
    activeAirspaces: [],
    window: {},
    calcNav: () => ({ dist: 10 }),
    applyAirspaceLimitHeuristics: () => {},
    pickAirportForAirspaceFallback: () => null,
    clearAirspaceMapLayers: () => {},
    renderAirspaceWarningsList: () => {},
    setTimeout: (callback, delayMs) => {
        const timer = { callback, delayMs, cancelled: false };
        scheduled.push(timer);
        return timer;
    },
    clearTimeout: timer => {
        timer.cancelled = true;
        cleared.push(timer);
    },
    fetchRouteAirspaceItems: bounds => fetchBehavior(bounds)
});

for (const name of [
    'getRouteAirspaceRequestKey',
    'getAirspaceStableId',
    'getRouteAirspaceRetryDelayMs',
    'clearRouteAirspaceRetryTimer',
    'cancelRouteAirspaceRetry',
    'scheduleRouteAirspaceRetry',
    'fetchRouteAirspaces'
]) {
    vm.runInContext(extractFunctionDeclaration(appSource, name), context);
}

const routeA = [
    { lat: 48.0, lng: 7.8 },
    { lat: 48.35, lng: 11.78 }
];
const routeB = [
    { lat: 48.0, lng: 7.8 },
    { lat: 47.45, lng: 8.56 }
];
const routeAKey = context.getRouteAirspaceRequestKey(routeA);
assert.equal(routeAKey, '48.00000,7.80000|48.35000,11.78000');
assert.equal(
    context.getAirspaceStableId({ id: 'hosted-stuttgart-ctr' }),
    'hosted-stuttgart-ctr',
    'Hosted-Airspaces mit `id` werden nicht erkannt'
);
assert.equal(
    context.getAirspaceStableId({ _id: 'v2-stuttgart-ctr', id: 'hosted-stuttgart-ctr' }),
    'v2-stuttgart-ctr',
    'OpenAIP-V2 `_id` muss für den Legacy-Fallback kompatibel bleiben'
);
assert.equal(context.getRouteAirspaceRetryDelayMs(0), 30000);
assert.equal(context.getRouteAirspaceRetryDelayMs(1), 60000);
assert.equal(context.getRouteAirspaceRetryDelayMs(2), 120000);
assert.equal(context.getRouteAirspaceRetryDelayMs(99), 300000);
assert.equal(context.getRouteAirspaceRetryDelayMs(0, { retryAfterMs: 90000 }), 90000);

await context.fetchRouteAirspaces(routeA);
assert.equal(context.routeAirspaceRetryState.attempt, 1);
assert.equal(scheduled.length, 1);
assert.equal(scheduled[0].delayMs, 30000);
assert.match(listEl.innerHTML, /neuer Versuch in 30 s/);

const staleTimer = scheduled[0];
await context.fetchRouteAirspaces(routeB);
assert.equal(staleTimer.cancelled, true, 'Retry der alten Route wurde nicht abgebrochen');
assert.equal(context.routeAirspaceRetryState.attempt, 1);
assert.notEqual(context.routeAirspaceRetryState.routeKey, routeAKey);

fetchBehavior = async () => [];
const currentTimer = scheduled.at(-1);
currentTimer.callback();
await new Promise(resolve => setImmediate(resolve));
await new Promise(resolve => setImmediate(resolve));
assert.equal(context.routeAirspaceRetryState.attempt, 0, 'erfolgreicher Retry setzte den Backoff nicht zurück');
assert.equal(context.routeAirspaceRetryState.timer, null);
assert.match(listEl.innerHTML, /Keine Daten gefunden/);

fetchBehavior = async () => [
    {
        id: 'hosted-stuttgart-ctr',
        name: 'CTR STUTTGART',
        type: 4,
        icaoClass: 3,
        lowerLimit: { value: 0, unit: 1, referenceDatum: 0 },
        upperLimit: { value: 3500, unit: 1, referenceDatum: 1 },
        frequencies: [{ name: 'STUTTGART TOWER', value: '119.055', primary: true }],
        geometry: { type: 'Polygon', coordinates: [[[7.5, 47.5], [12, 47.5], [12, 49], [7.5, 49], [7.5, 47.5]]] }
    },
    {
        id: 'hosted-stuttgart-tma-low',
        name: 'STUTTGART',
        type: 7,
        icaoClass: 2,
        lowerLimit: { value: 3500, unit: 1, referenceDatum: 1 },
        upperLimit: { value: 5500, unit: 1, referenceDatum: 1 },
        frequencies: [{ name: 'STUTTGART APPROACH', value: '125.055', primary: true }],
        geometry: { type: 'Polygon', coordinates: [[[7.4, 47.4], [12.1, 47.4], [12.1, 49.1], [7.4, 49.1], [7.4, 47.4]]] }
    },
    {
        id: 'hosted-stuttgart-tma-high',
        name: 'STUTTGART',
        type: 7,
        icaoClass: 3,
        lowerLimit: { value: 5500, unit: 1, referenceDatum: 1 },
        upperLimit: { value: 100, unit: 6, referenceDatum: 1 },
        frequencies: [{ name: 'STUTTGART APPROACH', value: '125.055', primary: true }],
        geometry: { type: 'Polygon', coordinates: [[[7.3, 47.3], [12.2, 47.3], [12.2, 49.2], [7.3, 49.2], [7.3, 47.3]]] }
    }
];
await context.fetchRouteAirspaces(routeA);
assert.equal(
    context.activeAirspaces.length,
    3,
    'mehrere Hosted-Sektoren mit `id` wurden in Höhenband/Briefing fälschlich als ein Duplikat behandelt'
);

assert.match(
    mapSource,
    /openAipAuxSnapshotCache\.delete\(coverage\.key\);[\s\S]*openaip_\$\{requiredCollection\}_temporarily_unavailable/,
    'Teilstand ohne erforderliche Sammlung wird vor dem Retry nicht aus dem Hilfscache entfernt'
);
assert.match(
    mapSource,
    /fetchOpenAipSnapshotCoverage\(coverage, requiredCollection\)/,
    'erforderliche Sammlung wird beim Snapshot-Abruf nicht berücksichtigt'
);
assert.match(
    appSource,
    /const stableId = getAirspaceStableId\([\s\S]*if \(addedIds\.has\(stableId\)\) continue;[\s\S]*addedIds\.add\(stableId\)/,
    'Routenfilter dedupliziert Hosted-Airspaces nicht über die normalisierte ID'
);
assert.doesNotMatch(
    appSource,
    /addedIds\.(?:has|add)\(as\._id\)/,
    'Routenfilter enthält noch die fehlerhafte reine `_id`-Deduplizierung'
);
assert.match(
    appSource,
    /activeAirspaces\.find\(a => a && getAirspaceStableId\(a\) === asId\)/,
    'Frequenznachladung findet Hosted-Airspaces nicht über ihre `id` wieder'
);
assert.match(
    appSource,
    /window\.gaGetOpenAipRouteAirspaces\(bounds\)/,
    'Routen-/Briefing-Lufträume verwenden nicht den Hosted-first-Datenzugriff'
);
assert.match(
    profileSource,
    /for \(let asIdx = 0; asIdx < activeAirspaces\.length; asIdx\+\+\)/,
    'Höhenband verwendet nicht den gemeinsamen activeAirspaces-Pool'
);
assert.match(
    syncSource,
    /function pickCurrentAirspaceFrequency[\s\S]*for \(const as of activeAirspaces\)/,
    'Live-Luftraumwarnungen/Frequenzen verwenden nicht den gemeinsamen activeAirspaces-Pool'
);

console.log('OpenAIP route airspace ok: multiple Hosted sectors, V2 IDs, backoff, Retry-After and success reset verified');
