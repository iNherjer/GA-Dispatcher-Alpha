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
  getInlineBootstrapSource,
  getTrackerEfbWebClientAsset
} = require('./tracker-efb-web-client');
const trackerPackage = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

test('tracker-hosted EFB page uses the original Kartentisch DOM and shared app modules', () => {
  const page = createTrackerEfbWebClientPage();
  assert.equal(EFB_WEB_CLIENT_PATH, '/efb/v1/');
  assert.equal(EFB_WEB_CLIENT_PROBE_PATH, '/efb/v1/probe/');
  assert.match(page, /data-efb-view-version="4"/);
  assert.match(page, /id="mapTableOverlay"/);
  assert.match(page, /id="mapProfileStrip"/);
  assert.match(page, /id="mapStopwatchDevice"/);
  assert.match(page, /id="mapCalculatorDevice"/);
  assert.match(page, /id="mapE6BDevice"/);
  assert.match(page, /src="\/efb\/v1\/assets\/map-utility-tools\.js"/);
  assert.match(page, /src="\/efb\/v1\/assets\/host\.js"/);
  assert.match(page, /id="gaEfbBootStatus"/);
  assert.match(page, /window\.toggleMapTable = function/);
  assert.doesNotMatch(page, /<script defer/);
  const scriptOrder = [
    '/efb/v1/assets/leaflet.js',
    '/efb/v1/assets/map-shell-core.js',
    '/efb/v1/assets/map-utility-tools.js',
    '/efb/v1/assets/host.js'
  ].map((asset) => page.indexOf(`<script src="${asset}"`));
  assert.deepEqual(scriptOrder, [...scriptOrder].sort((a, b) => a - b));
  assert.equal(scriptOrder.every((index) => index > 0), true);
  assert.doesNotMatch(page, /id="pinboardOverlay"/);
  assert.doesNotMatch(page, /id="settingsSection"/);
});

test('inline bootstrap provides close fallback and bounded client diagnostics before external scripts', () => {
  const source = getInlineBootstrapSource();
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /MAX_EVENTS = 80/);
  assert.match(source, /\/api\/v1\/client-log/);
  assert.match(source, /window\.toggleMapTable = function/);
  assert.match(source, /document\.documentElement\.classList\.add\('map-is-fullscreen'\)/);
  assert.match(source, /channel: channel/);
  assert.match(source, /installCompatibilityPolyfills/);
  assert.match(source, /Element\.prototype\.replaceChildren/);
  assert.match(source, /Object\.entries/);
  assert.match(source, /String\.prototype\.trimEnd/);
  assert.match(source, /Array\.prototype\.flatMap/);
});

test('Kartentisch markup extraction stays bounded to the map and rewrites E6B locally', () => {
  const markup = extractKartentischMarkup();
  assert.ok(markup.length > 50000);
  assert.match(markup, /src="\/efb\/v1\/e6b\/e6b-flight-computer\.html\?/);
  assert.match(markup, /embedded=1&amp;coherent=1&amp;/);
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

test('all Coherent-facing scripts avoid syntax rejected by the simulator engine', () => {
  const paths = [
    '/efb/v1/assets/host.js',
    '/efb/v1/assets/map-utility-tools.js',
    '/efb/v1/assets/map-shell-core.js',
    '/efb/v1/e6b/e6b-core.js',
    '/efb/v1/e6b/e6b-flight-computer.js'
  ];
  paths.forEach((assetPath) => {
    const source = getTrackerEfbWebClientAsset(assetPath).body.toString('utf8');
    assert.doesNotMatch(source, /\?\./, `${assetPath} contains optional chaining`);
    assert.doesNotMatch(source, /\?\?/, `${assetPath} contains nullish coalescing`);
    assert.doesNotMatch(source, /(^\s*|[([{,]\s*)\.\.\./m, `${assetPath} contains spread syntax`);
  });
  const e6bSource = getTrackerEfbWebClientAsset('/efb/v1/e6b/e6b-flight-computer.js').body.toString('utf8');
  assert.match(e6bSource, /installE6BCompatibilityPolyfills/);
  assert.match(e6bSource, /Element\.prototype\.replaceChildren/);
  assert.match(e6bSource, /Array\.prototype\.flatMap/);
  assert.match(e6bSource, /reportE6B/);
  const utilitySource = getTrackerEfbWebClientAsset('/efb/v1/assets/map-utility-tools.js').body.toString('utf8');
  assert.doesNotMatch(utilitySource, /calcState\.expression\.trimEnd/);
  assert.match(utilitySource, /ga-e6b-diagnostic/);
  const hostSource = getTrackerEfbWebClientAsset('/efb/v1/assets/host.js').body.toString('utf8');
  assert.match(hostSource, /notifyParentState\('live'\)/);
  assert.doesNotMatch(hostSource, /notifyParent\('live'\)/);
  assert.match(hostSource, /stepLiveNextLegPreview = function \(delta, event\)/);
  assert.doesNotMatch(hostSource, /stepLiveNextLegPreview = function \(\) \{\}/);
  assert.match(hostSource, /createStablePane\('gaBasePane', 200\)/);
  assert.match(hostSource, /fadeAnimation: false/);
  assert.match(hostSource, /bindInfoBoxDrag/);
  assert.match(hostSource, /ga-info-box-close/);
});

test('E6B document forwards iframe diagnostics before loading its runtime', () => {
  const page = getTrackerEfbWebClientAsset('/efb/v1/e6b/e6b-flight-computer.html').body.toString('utf8');
  assert.match(page, /ga-e6b-diagnostic/);
  assert.match(page, /unhandledrejection/);
  assert.match(page, /workbenchjson02/);
  assert.ok(page.indexOf('inline-diagnostics') < page.indexOf('e6b-core.js'));
});

test('legacy app background requests resolve to a tiny local placeholder', () => {
  ['/efb/v1/assets/bg.jpg', '/efb/v1/assets/map.jpg'].forEach((assetPath) => {
    const asset = getTrackerEfbWebClientAsset(assetPath);
    assert.equal(asset.contentType, 'image/svg+xml; charset=utf-8');
    assert.ok(asset.body.length < 512);
  });
  assert.ok(trackerPackage.pkg.assets.includes('efb-web-assets/background-placeholder.svg'));
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
