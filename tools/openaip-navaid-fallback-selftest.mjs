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
    collectionAvailable: false,
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
    isOpenAipSnapshotCollectionAvailable: () => context.collectionAvailable,
    getOpenAipNavaidCacheBounds: payload => {
        const [west, south, east, north] = payload.bbox;
        return { west, south, east, north };
    },
    extractRppAirportIcao: () => '',
    normalizeOpenAipAirportForPopup: () => null,
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
            navaids: { errorStatus: 429 }
        }
    }
};
context.collectionAvailable = false;
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

context.collectionAvailable = true;
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
assert.equal(context.cachedNavData.length, 1);
assert.equal(context.cachedNavData[0].name, 'SULZ LIVE [SUL] (116.100)');
assert.equal(context.cachedNavData[0].navaidSource, 'live');
assert.equal(context.openAipStaticNavaidState.activeSource, 'live');
assert.equal(context.openAipStaticNavaidState.activeCount, 1);

console.log(`OpenAIP navigation fallback ok: ${staticSul.name}, VRP ${staticVrp.name}, live priority verified`);
