#!/usr/bin/env node
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.GA_PLAYWRIGHT_MODULE || 'playwright');
const { getTrackerEfbWebClientAsset } = require('../ga-tracker-client/tracker-efb-web-client.js');
const fixture = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/efb/v1/assets/leaflet.css">
<link rel="stylesheet" href="/efb/v1/assets/fonts.css">
<style>html,body{margin:0}#map{width:100vw;height:100vh}.ga-efb-vector-layer{pointer-events:none;overflow:hidden}.ga-vector-map-status{background:#222;color:white;padding:8px}</style>
</head><body><div id="map"></div>
<script src="/efb/v1/assets/leaflet.js"></script>
<script src="/efb/v1/assets/vector-basemaps.js?v=test"></script>
<script>
window.testMap=L.map('map').setView([52.52,13.405],9);
testMap.createPane('gaBasePane').style.zIndex='200';
window.styles={};['positron','dark','fiord'].forEach(function(style){styles[style]=GAEfbVectorBasemaps.createLayer({style:style,label:style},{pane:'gaBasePane',attribution:'OpenFreeMap · © OpenMapTiles · OpenStreetMap'})});
window.route=L.polyline([[52.4,13.2],[52.65,13.65]],{color:'#ff0044',weight:5}).addTo(testMap);
window.markerClicks=0;L.circleMarker([52.52,13.405],{radius:12,color:'#00ff44',fillOpacity:1}).on('click',function(){markerClicks++}).addTo(testMap);
window.selectStyle=function(name){Object.keys(styles).forEach(function(key){if(testMap.hasLayer(styles[key]))testMap.removeLayer(styles[key])});if(name)styles[name].addTo(testMap)};
</script></body></html>`;
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end(fixture); return; }
  const asset = getTrackerEfbWebClientAsset(pathname);
  if (!asset) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', asset.contentType); res.end(asset.body);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--disable-webgl'],
    ...(process.env.GA_CHROME_EXECUTABLE ? { executablePath: process.env.GA_CHROME_EXECUTABLE } : {}) });
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  page.on('console', entry => { if (entry.type() === 'error') console.log('BROWSER', entry.text().slice(0, 300)); });
  await page.addInitScript(() => {
    // Simulate the APIs absent in Coherent, not just a WebGL-disabled modern map.
    for (const key of ['fetch','Request','Response','Headers','URL','URLSearchParams','Worker','ResizeObserver','OffscreenCanvas','createImageBitmap','DOMMatrix']) window[key] = undefined;
    Object.fromEntries = undefined;
    Array.prototype.flat = undefined;
    Array.prototype.flatMap = undefined;
    Promise.prototype.finally = undefined;
    HTMLImageElement.prototype.decode = undefined;
    const getContext = HTMLCanvasElement.prototype.getContext;
    window.canvasContexts = [];
    HTMLCanvasElement.prototype.getContext = function(type, options) {
      canvasContexts.push(type);
      if (type !== '2d') throw Error('GPU context requested: ' + type);
      return getContext.call(this, type, options);
    };
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  assert.equal(requests.filter(url => /vector-renderer\.js/.test(url)).length, 0);
  await page.evaluate(() => { selectStyle('positron'); selectStyle('dark'); selectStyle('fiord'); });
  await page.waitForFunction(() => styles.fiord._loaded, null, { timeout: 45000 });
  for (const style of ['positron','dark','fiord']) {
    await page.evaluate(style => selectStyle(style), style);
    await page.waitForFunction(style => styles[style]._loaded, style, { timeout: 45000 });
    const state = await page.evaluate(style => ({
      canvases: document.querySelectorAll('.ga-efb-vector-layer canvas').length,
      instances: document.querySelectorAll('.ga-efb-vector-layer').length,
      loaded: styles[style]._renderer.status().tiles,
      route: getComputedStyle(route.getElement()).stroke,
      contexts: canvasContexts
    }), style);
    assert.equal(state.instances, 1); assert.ok(state.canvases > 0); assert.ok(state.loaded > 0);
    assert.equal(state.route, 'rgb(255, 0, 68)'); assert.ok(state.contexts.every(type => type === '2d'));
    await page.screenshot({ path: `/tmp/ga-efb-canvas-${style}.png` });
    console.log('PASS original OpenFreeMap style in Canvas 2D:', style, state.loaded, 'tiles');
  }
  await page.evaluate(() => testMap.setView([48.86,2.35],11));
  await page.waitForFunction(() => styles.fiord._renderZoom === 11);
  await page.evaluate(() => testMap.setView([52.52,13.405],9));
  await page.locator('path[stroke="#00ff44"]').click();
  assert.equal(await page.evaluate(() => markerClicks), 1);
  await page.setViewportSize({ width: 390, height: 760 });
  await page.waitForFunction(() => document.querySelector('.ga-efb-vector-layer').clientWidth >= 390);
  await page.screenshot({ path: '/tmp/ga-efb-canvas-mobile.png' });
  await page.evaluate(() => selectStyle(null));
  assert.equal(await page.locator('.ga-efb-vector-layer').count(), 0);
  assert.equal(requests.filter(url => /vector-renderer\.js/.test(url)).length, 1);
  assert.ok(!requests.some(url => /googleapis|cartocdn|api_key|[?&]key=/.test(url)));
  assert.deepEqual(errors, []);
  console.log('PASS lazy library, rapid switches, marker clicks, zoom/pan, mobile resize, teardown and no WebGL/fetch/worker dependency');
} catch (error) {
  for (const page of browser?.contexts().flatMap(context => context.pages()) || []) {
    await page.screenshot({ path: '/tmp/ga-efb-canvas-failure.png' }).catch(() => {});
    console.log((await page.locator('body').innerText()).slice(0, 700));
  }
  throw error;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
