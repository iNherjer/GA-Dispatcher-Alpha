#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolDir, '..');
const mapSource = fs.readFileSync(path.join(rootDir, 'map.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

function extractFunctionDeclaration(source, name) {
    const marker = `function ${name}(`;
    const start = source.indexOf(marker);
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

const context = vm.createContext({
    OPENAIP_REGION_GRID_DEG: 0.5,
    OPENAIP_REGION_MAX_SPAN_DEG: 5
});
for (const name of [
    'fitOpenAipRegionRange',
    'buildOpenAipRegionCoverage',
    'openAipRegionContainsView'
]) {
    vm.runInContext(extractFunctionDeclaration(mapSource, name), context);
}

const desktopZoom8View = {
    west: 5.5,
    south: 48.0,
    east: 13.7,
    north: 53.0
};
assert.equal(
    context.buildOpenAipRegionCoverage(desktopZoom8View),
    null,
    'der alte 5°-Regionspfad darf breite Einzelabfragen weiterhin ablehnen'
);
const desktopZoom8Coverage = context.buildOpenAipRegionCoverage(desktopZoom8View, {
    maxSpanDeg: 20
});
assert.ok(desktopZoom8Coverage, 'Hosted-Viewport muss einen breiten Desktop-Ausschnitt abdecken');
assert.equal(
    context.openAipRegionContainsView(desktopZoom8Coverage, desktopZoom8View),
    true,
    'Hosted-Coverage enthält den breiten Desktop-Ausschnitt nicht'
);

const desktopZoom7View = {
    west: 1.5,
    south: 47.5,
    east: 18.0,
    north: 54.5
};
const desktopZoom7Coverage = context.buildOpenAipRegionCoverage(desktopZoom7View, {
    maxSpanDeg: 20
});
assert.ok(desktopZoom7Coverage, 'Zoom-7-Viewport muss im Hosted-Modus unterstützt werden');
assert.equal(context.openAipRegionContainsView(desktopZoom7Coverage, desktopZoom7View), true);
assert.ok(
    (desktopZoom7Coverage.east - desktopZoom7Coverage.west) <= 20,
    'Hosted-Coverage überschreitet das 20°-Budget'
);
assert.equal(
    context.buildOpenAipRegionCoverage({
        west: -12,
        south: 40,
        east: 12,
        north: 55
    }, { maxSpanDeg: 20 }),
    null,
    'zu breite Kartenansichten müssen weiterhin begrenzt bleiben'
);

assert.match(mapSource, /const OPENAIP_OVERLAY_MIN_ZOOM = 7;/);
assert.match(mapSource, /const OPENAIP_VIEWPORT_MAX_SPAN_DEG = 20;/);
assert.match(
    mapSource,
    /window\.gaGetAviationSnapshotForBounds\(coverage, requestedCollections\)/,
    'Viewport-Abruf nutzt den Hosted-first-Pfad mit gesplittetem V2-Fallback nicht'
);
assert.match(
    mapSource,
    /requestedCollections\.includes\(collection\)[\s\S]*errorStatus: 204, skipped: true/,
    'nicht angeforderte Sammlungen werden nicht als übersprungen markiert'
);
assert.match(
    mapSource,
    /const nextLayers = \[\];[\s\S]*layer\.clearLayers\(\);[\s\S]*nextLayers\.forEach/,
    'Luftraumlayer wird nicht erst nach vollständigem Aufbau ausgetauscht'
);
assert.match(
    mapSource,
    /function renderOpenAipAirports[\s\S]*const nextLayers = \[\];[\s\S]*layer\.clearLayers\(\);[\s\S]*nextLayers\.forEach/,
    'Flughafenmarker werden nicht erst nach vollständigem Aufbau ausgetauscht'
);
assert.match(
    mapSource,
    /if \(zoomBand === 'hidden'\)[\s\S]*setOpenAipOverlaySublayerVisible\(openAipAirportLayer, false\)/,
    'Flughafenmarker werden beim kurzen Herauszoomen weiterhin gelöscht'
);
assert.match(
    mapSource,
    /OPEN_TOPO_BACKUP_TILE_URL[\s\S]*function createResilientOpenTopoLayer[\s\S]*useFallback\('timeout'\)/,
    'OpenTopoMap besitzt keinen Timeout-Fallback auf den offiziellen Backup-Server'
);
assert.doesNotMatch(
    mapSource,
    /e\.name === "🛩️ VFR Lufträume \(Overlay\)"[\s\S]{0,180}aeroOverlay\.setOpacity/,
    'overlayremove greift weiterhin auf den bereits entfernten Leaflet-Container zu'
);
assert.match(
    mapSource,
    /if \(snapMode && zoom >= 8\)[\s\S]*requested\.push\('airports', 'navaids', 'reportingPoints'\)/,
    'weiter Zoom lädt weiterhin unnötig alle Snapping-Sammlungen'
);
assert.match(
    mapSource,
    /localAviation: Object\.freeze\(\{ name: 'ga-local-aviation-pane', zIndex: 250 \}\)[\s\S]*vfr: Object\.freeze\(\{ name: 'ga-vfr-overlay-pane', zIndex: 280 \}\)[\s\S]*officialChart: Object\.freeze\(\{ name: 'ga-official-chart-pane', zIndex: 310 \}\)[\s\S]*weather: Object\.freeze\(\{ name: 'ga-weather-overlay-pane', zIndex: 340 \}\)/,
    'Overlay-Panes bilden die Priorität OpenAIP < VFR < amtlich < Wetter nicht ab'
);
assert.match(
    mapSource,
    /map = L\.map\('map', \{ layers: \[topoMap\][\s\S]*ensureGaMapOverlayPanes\(map\);[\s\S]*aeroOverlay\.addTo\(map\);/,
    'benutzerdefinierte Overlay-Panes werden nicht vor den Start-Layern erzeugt'
);
assert.match(
    mapSource,
    /const aeroOverlay = L\.tileLayer\([\s\S]*pane: GA_MAP_OVERLAY_PANES\.vfr\.name/,
    'VFR-Overlay verwendet nicht den VFR-Pane'
);
assert.match(
    mapSource,
    /const usaVfrSectionalOverlay = L\.tileLayer\([\s\S]*pane: GA_MAP_OVERLAY_PANES\.officialChart\.name/,
    'FAA-Sectional verwendet nicht den amtlichen Karten-Pane'
);
assert.match(
    mapSource,
    /const dfsIcaoOverlay = L\.tileLayer\([\s\S]*pane: GA_MAP_OVERLAY_PANES\.officialChart\.name/,
    'DFS-Karte verwendet nicht den amtlichen Karten-Pane'
);
assert.match(
    mapSource,
    /const dwdWarningsOverlay = L\.tileLayer\.wms\([\s\S]*pane: GA_MAP_OVERLAY_PANES\.weather\.name[\s\S]*const awcSigmetOverlay = new AwcArcgisOverlay\(\{[\s\S]*pane: GA_MAP_OVERLAY_PANES\.weather\.name/,
    'Wetterlayer verwenden nicht gemeinsam den obersten Hintergrund-Pane'
);
assert.doesNotMatch(
    mapSource,
    /e\.name === "🛩️ VFR Lufträume \(Overlay\)"[\s\S]{0,240}removeLayer\(dfsIcaoOverlay\)/,
    'VFR-Overlay schaltet die amtliche DFS-Karte weiterhin automatisch ab'
);
assert.doesNotMatch(
    mapSource,
    /e\.name === "🗺️ DFS ICAO Karte 1:500k"[\s\S]{0,240}removeLayer\(aeroOverlay\)/,
    'DFS-Karte schaltet den darunterliegenden VFR-Layer weiterhin automatisch ab'
);
assert.doesNotMatch(
    mapSource,
    /hintToggleOpenAipDataMode/,
    'Aviation-Datenquellen-Schalter wird weiterhin in das normale Kartenmenü eingefügt'
);
assert.match(
    indexSource,
    /id="btnDebugAviationDataMode"[\s\S]*toggleOpenAipDataMode/,
    'Aviation-Datenquellen-Schalter fehlt in der Debug-Konsole'
);
assert.match(
    mapSource,
    /document\.getElementById\('btnDebugAviationDataMode'\)/,
    'Aviation-Datenquellen-Status aktualisiert nicht den Debug-Schalter'
);

console.log('OpenAIP hosted viewport ok: coverage, V2 fallback, atomic swap and deterministic overlay panes verified');
