const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  EFB_WEB_CLIENT_PATH,
  EFB_WEB_CLIENT_PROBE_PATH,
  createTrackerEfbProbePage,
  createTrackerEfbWebClientPage,
  extractKartentischMarkup,
  getTrackerEfbWebClientAsset
} = require('./tracker-efb-web-client');

test('tracker-hosted EFB page uses the original Kartentisch DOM and shared app modules', () => {
  const page = createTrackerEfbWebClientPage();
  assert.equal(EFB_WEB_CLIENT_PATH, '/efb/v1/');
  assert.equal(EFB_WEB_CLIENT_PROBE_PATH, '/efb/v1/probe/');
  assert.match(page, /data-efb-view-version="2"/);
  assert.match(page, /id="mapTableOverlay"/);
  assert.match(page, /id="mapProfileStrip"/);
  assert.match(page, /id="mapStopwatchDevice"/);
  assert.match(page, /id="mapCalculatorDevice"/);
  assert.match(page, /id="mapE6BDevice"/);
  assert.match(page, /src="\/efb\/v1\/assets\/map-utility-tools\.js"/);
  assert.match(page, /src="\/efb\/v1\/assets\/host\.js"/);
  assert.doesNotMatch(page, /id="pinboardOverlay"/);
  assert.doesNotMatch(page, /id="settingsSection"/);
});

test('Kartentisch markup extraction stays bounded to the map and rewrites E6B locally', () => {
  const markup = extractKartentischMarkup();
  assert.ok(markup.length > 50000);
  assert.match(markup, /src="\/efb\/v1\/e6b\/e6b-flight-computer\.html\?/);
  assert.doesNotMatch(markup, /gaDebugLogInstalled/);
});

test('tracker-hosted static assets are allowlisted and browser scripts parse', () => {
  const hostScript = getTrackerEfbWebClientAsset('/efb/v1/assets/host.js');
  const utilityScript = getTrackerEfbWebClientAsset('/efb/v1/assets/map-utility-tools.js');
  const coreScript = getTrackerEfbWebClientAsset('/efb/v1/assets/map-shell-core.js');
  assert.equal(hostScript.contentType, 'text/javascript; charset=utf-8');
  assert.ok(hostScript.body.length > 10000);
  assert.doesNotThrow(() => new Function(hostScript.body.toString('utf8')));
  assert.doesNotThrow(() => new Function(utilityScript.body.toString('utf8')));
  assert.doesNotThrow(() => new Function(coreScript.body.toString('utf8')));
  assert.equal(getTrackerEfbWebClientAsset('/efb/v1/e6b/../index.html'), null);
  assert.equal(getTrackerEfbWebClientAsset('/efb/v1/assets/unknown.js'), null);
});

test('versioned tracker asset mirror matches the selected original app sources', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const assetRoot = path.join(__dirname, 'efb-web-assets');
  assert.deepEqual(fs.readFileSync(path.join(assetRoot, 'styles.css')), fs.readFileSync(path.join(projectRoot, 'styles.css')));
  assert.deepEqual(fs.readFileSync(path.join(assetRoot, 'map-utility-tools.js')), fs.readFileSync(path.join(projectRoot, 'map-utility-tools.js')));
  [
    'e6b-core.js',
    'e6b-flight-computer.css',
    'e6b-flight-computer.html',
    'e6b-flight-computer.js',
    'e6b-workbench-front-disc.json',
    'e6b-workbench-wind-disc.json'
  ].forEach((filename) => {
    assert.deepEqual(
      fs.readFileSync(path.join(assetRoot, 'e6b', filename)),
      fs.readFileSync(path.join(projectRoot, 'e6b', filename)),
      filename
    );
    assert.ok(getTrackerEfbWebClientAsset(`/efb/v1/e6b/${filename}`));
  });
});

test('diagnostic probe remains available separately from the Kartentisch', () => {
  const page = createTrackerEfbProbePage();
  assert.match(page, /data-probe-version="2"/);
  assert.match(page, /ga-efb-server-probe/);
  const script = page.match(/<script>([\s\S]*?)<\/script>/i)?.[1] || '';
  assert.doesNotThrow(() => new Function(script));
});
