#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GA_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = `<!doctype html><html><head><meta charset="UTF-8">
<link rel="stylesheet" href="/vendor/leaflet/leaflet.css">
<link rel="stylesheet" href="/vendor/maplibre/maplibre-gl.css">
<link rel="stylesheet" href="/styles.css">
<style>html,body{margin:0;padding:0}#fixture{height:100vh;width:100vw}</style>
</head><body><div id="fixture"></div>
<script src="/vendor/leaflet/leaflet.js"></script>
<script src="/map-vector-basemaps.js"></script>
<script>
window.testMap=L.map('fixture').setView([52.52,13.405],9);
testMap.createPane('ga-test-overlay').style.zIndex='280';
window.testRoute=L.polyline([[52.4,13.2],[52.65,13.65]],{pane:'ga-test-overlay',color:'#ff0044',weight:5}).addTo(testMap);
window.testMarker=L.circleMarker([52.52,13.405],{radius:12,color:'#00ff44',fillOpacity:1}).addTo(testMap);
window.markerClicks=0;testMarker.on('click',()=>markerClicks++);
window.styles=Object.fromEntries(['positron','dark','fiord'].map(s=>[s,createOpenFreeMapLayer(s)]));
L.control.layers({'Positron':styles.positron,'Dark':styles.dark,'Fiord':styles.fiord},{'Route':testRoute}).addTo(testMap);
window.selectStyle=function(name){for(const layer of Object.values(styles))if(testMap.hasLayer(layer))testMap.removeLayer(layer);if(name)styles[name].addTo(testMap)};
</script></body></html>`;
const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/') { response.setHeader('Content-Type', 'text/html'); response.end(fixture); return; }
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404); response.end(); return;
    }
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
        '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
        '.woff2': 'font/woff2', '.ttf': 'font/ttf' };
    response.setHeader('Content-Type', types[path.extname(file).toLowerCase()] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
    browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'],
        ...(process.env.GA_CHROME_EXECUTABLE ? { executablePath: process.env.GA_CHROME_EXECUTABLE } : {}) });
    const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
    const pageErrors = [];
    const libraryRequests = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'warning') console.log('BROWSER:', message.text()); });
    page.on('request', request => { if (/vendor\/maplibre\/.*\.js$/.test(request.url())) libraryRequests.push(request.url()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(libraryRequests.length, 0, 'raster map startup must not load MapLibre');
    // Switch while the libraries are still loading: obsolete callbacks must not
    // mount the old layer or leak a second WebGL canvas.
    await page.evaluate(() => { selectStyle('positron'); selectStyle('dark'); selectStyle('fiord'); });
    await page.waitForFunction(() => styles.fiord._loaded, null, { timeout: 60000 });
    for (const style of ['positron', 'dark', 'fiord']) {
        await page.evaluate(style => selectStyle(style), style);
        await page.waitForFunction(style => styles[style]._loaded && styles[style]._inner.getMaplibreMap().areTilesLoaded(), style, { timeout: 60000 });
        const state = await page.evaluate(style => {
            const layer = styles[style], gl = layer._inner.getMaplibreMap();
            return { canvases: document.querySelectorAll('.maplibregl-canvas').length,
                pane: layer._inner.getContainer().parentElement.className,
                pitch: gl.getPitch(), bearing: gl.getBearing(),
                center: [gl.getCenter().lat, gl.getCenter().lng],
                routeColor: getComputedStyle(testRoute.getElement()).stroke,
                attribution: testMap.attributionControl.getContainer().textContent };
        }, style);
        assert.equal(state.canvases, 1);
        assert.match(state.pane, /leaflet-tile-pane/);
        assert.equal(state.pitch, 0); assert.equal(state.bearing, 0);
        assert.ok(Math.abs(state.center[0] - 52.52) < 0.001);
        assert.equal(state.routeColor, 'rgb(255, 0, 68)');
        assert.match(state.attribution, /OpenMapTiles/); assert.match(state.attribution, /OpenStreetMap/);
        await page.screenshot({ path: `/tmp/ga-openfreemap-${style}.png` });
        console.log(`PASS ${style}: real style/tiles loaded, overlays and attribution retained`);
    }
    assert.equal(libraryRequests.length, 2, 'load each bundled library only once');
    await page.evaluate(() => testMap.setView([48.86, 2.35], 11));
    await page.waitForFunction(() => {
        const gl = styles.fiord._inner.getMaplibreMap();
        return Math.abs(gl.getCenter().lat - 48.86) < 0.001 && gl.getZoom() === 10;
    });
    await page.evaluate(() => testMap.setView([52.52, 13.405], 9));
    await page.locator('path[stroke="#00ff44"]').click();
    assert.equal(await page.evaluate(() => markerClicks), 1, 'Leaflet marker remains clickable above vector map');
    await page.evaluate(() => selectStyle(null));
    assert.equal(await page.locator('.maplibregl-canvas').count(), 0, 'remove frees the old renderer');
    // Failed style fetch must leave a clear recovery message and allow switching.
    await page.route('https://tiles.openfreemap.org/styles/dark', route => route.abort());
    await page.evaluate(() => selectStyle('dark'));
    await page.getByRole('status').filter({ hasText: 'Basiskarte nicht verfügbar' }).waitFor();
    await page.evaluate(() => selectStyle('positron'));
    await page.waitForFunction(() => styles.positron._loaded, null, { timeout: 60000 });
    await page.setViewportSize({ width: 390, height: 760 });
    await page.waitForFunction(() => styles.positron._inner.getMaplibreMap().getCanvas().clientWidth >= 390);
    await page.screenshot({ path: '/tmp/ga-openfreemap-mobile.png' });
    assert.deepEqual(pageErrors, []);
    console.log('PASS pan/zoom, marker clicks, rapid switching, renderer cleanup and failed-style recovery');

    if (process.argv.includes('--app')) {
        const appPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        const appErrors = [];
        appPage.on('pageerror', error => appErrors.push(error.message));
        await appPage.addInitScript(() => {
            localStorage.setItem('ga_onboarding_seen_v1', '1');
            localStorage.setItem('ga_ai_enabled', 'false');
            localStorage.setItem('ga_ai_key_startup_dismissed', 'true');
        });
        await appPage.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'domcontentloaded' });
        await appPage.waitForFunction(() => window.__gaAppBooted && !document.body.classList.contains('boot-splash-active'));
        await appPage.evaluate(() => toggleMapTable(true));
        await appPage.waitForFunction(() => !!document.querySelector('#map .leaflet-control-layers'));
        await appPage.locator('#map .leaflet-control-layers-toggle').click();
        await appPage.getByText('📝 Positron (Hell)', { exact: true }).click();
        await appPage.waitForFunction(() => {
            let loaded = false;
            map.eachLayer(layer => { if (layer._loaded && layer._inner) loaded = true; });
            return loaded;
        }, null, { timeout: 60000 });
        await appPage.screenshot({ path: '/tmp/ga-openfreemap-app.png' });
        assert.deepEqual(appErrors, [], 'full application must initialize and select the new basemap without script errors');
        console.log('PASS actual index.html: Kartentisch initializes and Positron is selectable');
    }

    await browser.close();
    browser = await chromium.launch({ headless: true, args: ['--disable-webgl'],
        ...(process.env.GA_CHROME_EXECUTABLE ? { executablePath: process.env.GA_CHROME_EXECUTABLE } : {}) });
    const noGlPage = await browser.newPage();
    const noGlErrors = [];
    noGlPage.on('pageerror', error => noGlErrors.push(error.message));
    await noGlPage.goto(`http://127.0.0.1:${server.address().port}/`);
    await noGlPage.evaluate(() => selectStyle('dark'));
    await noGlPage.getByRole('status').filter({ hasText: 'Basiskarte nicht verfügbar' }).waitFor();
    await noGlPage.evaluate(() => selectStyle(null));
    assert.equal(await noGlPage.locator('.leaflet-gl-layer').count(), 0);
    assert.deepEqual(noGlErrors, []);
    console.log('PASS mobile resize and recovery when WebGL is disabled');
} catch (error) {
    const pages = browser?.contexts().flatMap(context => context.pages()) || [];
    if (pages.length) await pages.at(-1).screenshot({ path: '/tmp/ga-openfreemap-test-failure.png' }).catch(() => {});
    throw error;
} finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
}
