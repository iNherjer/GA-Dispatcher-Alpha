#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolDir, '..');
const mapSource = fs.readFileSync(path.join(rootDir, 'map.js'), 'utf8');
const dataset = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'openaip-navaids.json'), 'utf8'));
const reportingPointDataset = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'data', 'openaip-reporting-points.json'), 'utf8')
);
const airportDataset = JSON.parse(fs.readFileSync(path.join(rootDir, 'airports.json'), 'utf8'));

function extractFunctionDeclaration(name) {
    const marker = `function ${name}(`;
    const start = mapSource.indexOf(marker);
    assert.ok(start >= 0, `${name} fehlt in map.js`);
    const bodyStart = mapSource.indexOf('{', start);
    assert.ok(bodyStart >= 0, `${name}: Funktionskörper fehlt`);
    let depth = 0;
    for (let index = bodyStart; index < mapSource.length; index += 1) {
        const char = mapSource[index];
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) return mapSource.slice(start, index + 1);
        }
    }
    throw new Error(`${name}: Funktionskörper nicht abgeschlossen`);
}

const context = vm.createContext({
    console,
    cachedNavData: [],
    availableCollections: new Set(),
    globalAirports: airportDataset,
    snapMode: true,
    map: { getZoom: () => 6 },
    OPENAIP_OVERLAY_MIN_ZOOM: 8,
    GLOBAL_AIRPORT_SNAP_MIN_ZOOM: 6,
    visibleBounds: { west: 8, south: 48, east: 9, north: 49 },
    hasGlobalAirportsForMapClicks: () => true,
    getOpenAipVisibleBounds: () => context.visibleBounds,
    openAipStaticNavaidState: {
        items: dataset.navaids,
        byId: null,
        activeSource: 'none',
        activeCount: 0
    },
    openAipStaticReportingPointState: {
        items: reportingPointDataset.points,
        activeSource: 'none',
        activeCount: 0
    },
    isOpenAipSnapshotCollectionAvailable: (_, key) => context.availableCollections.has(key),
    getOpenAipNavaidCacheBounds: payload => {
        const [west, south, east, north] = payload.bbox;
        return { west, south, east, north };
    },
    extractRppAirportIcao: () => '',
    normalizeOpenAipAirportForPopup: item => item?.testNormalized || null,
    seedOpenAipAirportFrequencies: () => {},
    seedOpenAipAirportRunways: () => {}
});

for (const name of [
    'buildOpenAipNavaidCacheEntry',
    'getStaticOpenAipNavaidEntries',
    'setOpenAipActiveNavaidSource',
    'buildOpenAipReportingPointCacheEntry',
    'getStaticOpenAipReportingPointEntries',
    'setOpenAipActiveReportingPointSource',
    'buildGlobalAirportSnapEntries',
    'mergeGlobalAirportSnapEntries',
    'replaceCachedNavDataFromOpenAip'
]) {
    vm.runInContext(extractFunctionDeclaration(name), context);
}

const fallbackPayload = {
    bbox: [8, 48, 9, 49],
    navaids: [],
    reportingPoints: [],
    airports: [],
    meta: {
        collections: {
            airports: { errorStatus: 429 },
            navaids: { errorStatus: 429 },
            reportingPoints: { errorStatus: 429 }
        }
    }
};
context.availableCollections.clear();
context.replaceCachedNavDataFromOpenAip(fallbackPayload);
const staticSul = context.cachedNavData.find(item => item.navaidIdentifier === 'SUL');
assert.ok(staticSul, 'SUL fehlt im materialisierten statischen Snap-Pool');
assert.equal(staticSul.name, 'SULZ [SUL] (116.100)');
assert.equal(staticSul.navaidSource, 'static');
assert.equal(context.openAipStaticNavaidState.activeSource, 'static');
assert.ok(context.openAipStaticNavaidState.activeCount > 0);
const staticVrp = context.cachedNavData.find(item => item.type === 'RPP');
assert.ok(staticVrp, 'VRP fehlt im materialisierten statischen Snap-Pool');
assert.equal(staticVrp.rppSource, 'static');
assert.equal(context.openAipStaticReportingPointState.activeSource, 'static');
assert.ok(context.openAipStaticReportingPointState.activeCount > 0);
const staticAirport = context.cachedNavData.find(item => item.airportIcao === 'EDTW');
assert.ok(staticAirport, 'EDTW fehlt im sofort verfügbaren Flugplatz-Snap-Pool');
assert.equal(staticAirport.type, 'APT');
assert.equal(staticAirport.airportSnapSource, 'global-fallback');

context.visibleBounds = { west: 7, south: 47, east: 12.5, north: 49.5 };
context.cachedNavData = [{ name: staticSul.name, type: 'VOR', lat: staticSul.lat, lng: staticSul.lng }];
assert.ok(context.mergeGlobalAirportSnapEntries() > 0, 'sichtbare Flugplätze wurden beim Verschieben nicht ergänzt');
assert.ok(
    context.cachedNavData.some(item => item.airportIcao === 'EDTF')
        && context.cachedNavData.some(item => item.airportIcao === 'EDDM'),
    'Flugplätze der Übersicht Freiburg–München fehlen nach dem sichtbereichsbezogenen Merge'
);
context.visibleBounds = { west: 30, south: -60, east: 31, north: -59 };
context.mergeGlobalAirportSnapEntries();
assert.ok(
    !context.cachedNavData.some(item => item.airportIcao === 'EDTW'),
    'Flugplatz-Fallback des alten Kartenausschnitts blieb nach dem Verschieben erhalten'
);

context.availableCollections = new Set(['airports', 'navaids', 'reportingPoints']);
context.visibleBounds = { west: 8, south: 48, east: 9, north: 49 };
context.replaceCachedNavDataFromOpenAip({
    ...fallbackPayload,
    navaids: [{
        _id: 'live-sul',
        identifier: 'SUL',
        name: 'SULZ LIVE',
        frequency: { value: '116.100', unit: 2 },
        geometry: { type: 'Point', coordinates: [8.644722, 48.3816681] }
    }],
    meta: { collections: { navaids: { errorStatus: 0 } } }
});
const liveSul = context.cachedNavData.find(item => item.navaidIdentifier === 'SUL');
const airportAfterEmptyLiveCollection = context.cachedNavData.find(item => item.airportIcao === 'EDTW');
assert.equal(liveSul?.name, 'SULZ LIVE [SUL] (116.100)');
assert.equal(liveSul?.navaidSource, 'live');
assert.equal(
    airportAfterEmptyLiveCollection?.airportSnapSource,
    'global-fallback',
    'ein erfolgreicher, aber leerer OpenAIP-Airport-Teil entfernte den Flugplatz-Fallback'
);
assert.equal(context.openAipStaticNavaidState.activeSource, 'live');
assert.equal(context.openAipStaticNavaidState.activeCount, 1);

context.replaceCachedNavDataFromOpenAip({
    ...fallbackPayload,
    airports: [{
        _id: 'live-edtw',
        frequencies: [],
        testNormalized: {
            icao: 'EDTW',
            name: 'Winzeln-Schramberg LIVE',
            lat: 48.27917,
            lon: 8.42833,
            sourceId: 'live-edtw',
            country: 'DE'
        }
    }],
    meta: {
        collections: {
            airports: { errorStatus: 0 },
            navaids: { errorStatus: 0 },
            reportingPoints: { errorStatus: 0 }
        }
    }
});
const edtwEntries = context.cachedNavData.filter(item => item.airportIcao === 'EDTW');
assert.equal(edtwEntries.length, 1, 'OpenAIP- und globaler Flugplatz wurden im Snap-Pool dupliziert');
assert.equal(edtwEntries[0].sourceId, 'live-edtw', 'der OpenAIP-Flugplatz hatte nicht Vorrang vor dem Fallback');

console.log(
    `OpenAIP navigation fallback ok: ${staticSul.name}, VRP ${staticVrp.name}, APT ${staticAirport.airportIcao}, live priority verified`
);
