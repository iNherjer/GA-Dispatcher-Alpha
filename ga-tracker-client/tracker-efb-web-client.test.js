const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  EFB_WEB_CLIENT_PATH,
  EFB_WEB_CLIENT_PROBE_PATH,
  EFB_WEB_ASSET_REVISION,
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
  assert.equal(EFB_WEB_ASSET_REVISION, '37101');
  assert.match(page, /data-efb-view-version="7"/);
  assert.match(page, /app-styles\.css\?v=37101/);
  assert.match(page, /host\.css\?v=37101/);
  assert.match(page, /map-shell-core\.js\?v=37101/);
  assert.match(page, /map-utility-tools\.js\?v=37101/);
  assert.match(page, /cockpit-session-client\.js\?v=37101/);
  assert.match(page, /host\.js\?v=37101/);
  assert.match(page, /id="mapTableOverlay"/);
  assert.match(page, /id="mapProfileStrip"/);
  assert.match(page, /id="mapStopwatchDevice"/);
  assert.match(page, /id="mapCalculatorDevice"/);
  assert.match(page, /id="mapE6BDevice"/);
  assert.match(page, /src="\/efb\/v1\/assets\/map-utility-tools\.js\?v=37101"/);
  assert.match(page, /src="\/efb\/v1\/assets\/cockpit-session-client\.js\?v=37101"/);
  assert.match(page, /src="\/efb\/v1\/assets\/host\.js\?v=37101"/);
  assert.match(page, /id="gaEfbBootStatus"/);
  assert.match(page, /window\.toggleMapTable = function/);
  assert.doesNotMatch(page, /<script defer/);
  const scriptOrder = [
    '/efb/v1/assets/leaflet.js',
    '/efb/v1/assets/map-shell-core.js?v=37101',
    '/efb/v1/assets/map-utility-tools.js?v=37101',
    '/efb/v1/assets/cockpit-session-client.js?v=37101',
    '/efb/v1/assets/host.js?v=37101'
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
  assert.match(markup, /id="mapE6BFlip"[^>]*>FLIP<\/button>/);
  assert.match(markup, /id="mapE6BClose"[^>]*>X<\/button>/);
  assert.doesNotMatch(markup, /id="mapE6BFlip"[^>]*>↻<\/button>/);
  assert.doesNotMatch(markup, /gaDebugLogInstalled/);
});

test('tracker-hosted static assets are allowlisted and browser scripts parse', () => {
  const hostScript = getTrackerEfbWebClientAsset('/efb/v1/assets/host.js');
  const utilityScript = getTrackerEfbWebClientAsset('/efb/v1/assets/map-utility-tools.js');
  const coreScript = getTrackerEfbWebClientAsset('/efb/v1/assets/map-shell-core.js');
  const sessionScript = getTrackerEfbWebClientAsset('/efb/v1/assets/cockpit-session-client.js');
  assert.equal(hostScript.contentType, 'text/javascript; charset=utf-8');
  assert.ok(hostScript.body.length > 10000);
  assert.doesNotThrow(() => new Function(hostScript.body.toString('utf8')));
  assert.doesNotThrow(() => new Function(utilityScript.body.toString('utf8')));
  assert.doesNotThrow(() => new Function(coreScript.body.toString('utf8')));
  assert.doesNotThrow(() => new Function(sessionScript.body.toString('utf8')));
  assert.equal(getTrackerEfbWebClientAsset('/efb/v1/e6b/../index.html'), null);
  assert.equal(getTrackerEfbWebClientAsset('/efb/v1/assets/unknown.js'), null);
});

test('all Coherent-facing scripts avoid syntax rejected by the simulator engine', () => {
  const paths = [
    '/efb/v1/assets/host.js',
    '/efb/v1/assets/map-utility-tools.js',
    '/efb/v1/assets/map-shell-core.js',
    '/efb/v1/assets/cockpit-session-client.js',
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
  assert.match(hostSource, /createStablePane\('gaVfrPane', 280\)/);
  assert.match(hostSource, /createStablePane\('gaOfficialChartPane', 310\)/);
  assert.match(hostSource, /createStablePane\('gaWeatherPane', 340\)/);
  assert.match(hostSource, /faa: 'gaOfficialChartPane'/);
  assert.match(hostSource, /dwd: 'gaWeatherPane'/);
  assert.match(hostSource, /createTileLayer\(definition, overlayPaneName\(definition\)\)/);
  assert.match(hostSource, /fadeAnimation: false/);
  assert.match(hostSource, /bindInfoBoxDrag/);
  assert.match(hostSource, /ga-info-box-close/);
  assert.match(hostSource, /renderMissionPayload/);
  assert.match(hostSource, /function missionBannerModel\(payload\)/);
  assert.match(hostSource, /function ensureMissionBanner\(\)/);
  assert.match(hostSource, /function renderMissionBanner\(payload\)/);
  assert.match(hostSource, /mission-banner/);
  assert.match(hostSource, /setupSideDrawer/);
  assert.match(hostSource, /data-efb-check-row/);
  assert.match(hostSource, /checklist-action/);
  assert.match(hostSource, /Mission: /);
  assert.match(hostSource, /Checklisten/);
  assert.match(hostSource, /Werkzeuge/);
  assert.match(hostSource, /Was ist hier/);
  assert.match(hostSource, /map-profile/);
  assert.match(hostSource, /map\.mouseEventToContainerPoint\(source\)/);
  assert.match(hostSource, /setupProfileResize/);
  assert.match(hostSource, /profile\.airspaces/);
  assert.match(hostSource, /profile\.obstacles/);
  assert.match(hostSource, /makeHostMenu/);
  assert.match(hostSource, /bindMapContextLongPress/);
  assert.match(hostSource, /function mapContextEventPoint\(event\)/);
  assert.match(hostSource, /event\.changedTouches && event\.changedTouches\.length/);
  assert.match(hostSource, /addEventListener\('pointerdown', begin, true\)/);
  assert.match(hostSource, /addEventListener\('mousedown', begin, true\)/);
  assert.match(hostSource, /addEventListener\('touchstart', begin, true\)/);
  assert.match(hostSource, /addEventListener\('touchend', end, true\)/);
  assert.match(hostSource, /ga-efb-context-panel/);
  assert.match(hostSource, /\/api\/v1\/map-context\?lat=/);
  assert.match(hostSource, /aviationSource \+ ' \+ ' \+ weatherSource/);
  assert.match(hostSource, /PUNKTWETTER/);
  assert.match(hostSource, /ga-efb-context-airport-widget/);
  assert.match(hostSource, /FLUGPLATZ \| VOLLANSICHT/);
  assert.doesNotMatch(hostSource, /AIP VFR OEFFNEN/);
  assert.match(hostSource, /ga-efb-context-runway/);
  assert.match(hostSource, /labelTop = clamp\(bandTop \+ \(bandHeight \/ 2\)/);
  assert.match(hostSource, /querySelectorAll\('\.pb-btn\.close'\)[\s\S]*?button\.parentNode\.removeChild\(button\)/);
  assert.doesNotMatch(hostSource, /[·°—–…−×÷⌃⌫↻]/);
  assert.match(hostSource, /mapContextFlightCategory/);
  assert.match(hostSource, /pressureMslHpa/);
  assert.doesNotMatch(hostSource, /nearestRouteWaypoint/);
  assert.doesNotMatch(hostSource, /Kein Routenluftraum/);
  assert.match(hostSource, /650/);
  assert.match(hostSource, /\{ url: definition\.url, label: 'direct' \}/);
  assert.match(hostSource, /\{ url: definition\.localUrl, label: 'tracker-proxy' \}/);
  assert.match(hostSource, /return createResilientTileLayer\(definition, options\)/);
  assert.doesNotMatch(hostSource, /definition\.localUrl \|\| definition\.url/);
  assert.match(hostSource, /event=map-tile|map-tile/);
  assert.match(utilitySource, /ga-efb-e6b-input-surface/);
  assert.match(utilitySource, /function toggleMapUtilityTool\(tool\)/);
  assert.match(utilitySource, /if \(isMapUtilityToolOpen\(tool\)\) \{[\s\S]*?closeMapUtilityTool\(tool\);[\s\S]*?return false;/);
  assert.match(utilitySource, /window\.toggleMapUtilityTool = toggleMapUtilityTool/);
  assert.match(hostSource, /function toggleUtilityTool\(tool\)/);
  assert.match(hostSource, /typeof window\.toggleMapUtilityTool === 'function'/);
  assert.match(hostSource, /window\.isMapUtilityToolOpen\(tool\)/);
  assert.match(hostSource, /window\.closeMapUtilityTool\(tool\)/);
  assert.match(hostSource, /toggleUtilityTool\('stopwatch'\)/);
  assert.match(hostSource, /toggleUtilityTool\('calculator'\)/);
  assert.match(hostSource, /toggleUtilityTool\('e6b'\)/);
  assert.match(hostSource, /function openHostMenuPanel\(wrapper, trigger, panel\)/);
  assert.match(hostSource, /document\.body\.appendChild\(panel\)/);
  assert.match(hostSource, /wrapper\._gaHostMenuPanel = panel/);
  assert.match(utilitySource, /ga-e6b-rotate-delta/);
  assert.match(utilitySource, /ga-e6b-wind-slide-delta/);
  assert.match(utilitySource, /ga-e6b-wind-dot-set/);
  assert.match(utilitySource, /addEventListener\('mousedown'/);
  assert.match(utilitySource, /addEventListener\('touchstart'/);
  assert.match(utilitySource, /ga-efb-tracker-host/);
  assert.match(e6bSource, /ga-e6b-rotate-delta/);
  assert.match(e6bSource, /ga-e6b-wind-slide-delta/);
  assert.match(e6bSource, /ga-e6b-wind-dot-set/);
  const hostCss = getTrackerEfbWebClientAsset('/efb/v1/assets/host.css').body.toString('utf8');
  assert.match(hostCss, /#liveNextWpBox \.ga-info-box-close[\s\S]*?right: -20px/);
  assert.match(hostSource, /routeRenderer = L\.svg/);
  assert.match(hostSource, /map\.removeLayer\(layer\)/);
  assert.match(hostCss, /#map img\.ga-efb-map-tile \{[\s\S]*?visibility: visible !important;[\s\S]*?mix-blend-mode: normal !important;/);
  assert.match(hostCss, /#map img\.leaflet-tile \{[\s\S]*?mix-blend-mode: normal !important;/);
  assert.match(hostCss, /\.leaflet-gaVfr-pane \{[\s\S]*?z-index: 280 !important;/);
  assert.match(hostCss, /\.leaflet-gaOfficialChart-pane \{[\s\S]*?z-index: 310 !important;/);
  assert.match(hostCss, /\.leaflet-gaWeather-pane \{[\s\S]*?z-index: 340 !important;/);
  assert.match(hostCss, /\.ga-efb-context-weather/);
  assert.match(hostCss, /\.ga-efb-context-height-cloud/);
  assert.match(hostCss, /\.ga-efb-context-point/);
  assert.match(hostCss, /\.ga-efb-context-airport-widget/);
  assert.match(hostCss, /\.ga-efb-context-airspaces > span > b > i/);
  assert.match(hostCss, /grid-template-columns: 132px minmax\(0, 1fr\)/);
  assert.match(hostCss, /\.map-e6b-device\.map-e6b-half \{[\s\S]*?transform: scale\(\.7\) !important/);
  assert.match(hostCss, /\.ga-efb-host-menu-panel\.is-open \{[\s\S]*?display: block;/);
  assert.match(hostCss, /\.calculator-formula-drawer,[\s\S]*?background: #f7f4e8 !important/);
  assert.match(hostCss, /\.ga-efb-context-windrose \.ga-efb-context-runway rect/);
  assert.match(hostCss, /#mapSideDrawer \{[\s\S]*?--checklist-panel-width: 66\.6667vw/);
  assert.match(hostCss, /\.ga-efb-mission-banner\.is-visible \{[\s\S]*?display: grid;/);
  assert.match(hostSource, /Schrift kleiner \(-\)/);
  assert.match(hostSource, /Schrift größer \(\+\)/);
  assert.match(hostSource, /Schriftgröße:/);
  assert.match(hostSource, /Missionsstatus prüfen/);
  assert.match(hostSource, /FLUGHÖHE/);
  assert.match(hostSource, /function requestSideDrawerRefresh\(\)/);
  assert.match(hostSource, /body\.addEventListener\('scroll', noteDrawerScroll/);
  assert.match(hostSource, /window\.setTimeout\(apply, 90\)/);
  assert.match(hostSource, /function applyEfbFontScale\(\)/);
  assert.match(hostSource, /function normalizeCoherentGlyphs\(root\)/);
  assert.match(hostSource, /new window\.MutationObserver/);
  assert.match(hostSource, /element\.hasAttribute\('data-ga-efb-font-base'\)/);
});

test('EFB mission banner mirrors tracker authority without taking ownership', () => {
  const hostSource = getTrackerEfbWebClientAsset('/efb/v1/assets/host.js').body.toString('utf8');
  const modelSource = hostSource.match(/function missionBannerModel\(payload\) \{[\s\S]*?\n  \}\n\n  function ensureMissionBanner/)?.[0]
    .replace(/\n\n  function ensureMissionBanner$/, '');
  assert.ok(modelSource);
  const missionBannerModel = new Function(`return (${modelSource});`)();

  assert.equal(missionBannerModel(null), null);
  const readOnly = missionBannerModel({
    available: true,
    missionId: 'mission-1',
    phase: 'planned',
    view: { title: 'Kurzer Sprung', currentTask: 'Mission vorbereiten' },
    control: { executionAuthority: 'web', allowedActions: [] }
  });
  assert.equal(readOnly.badge, 'NUR LESEN');
  assert.equal(readOnly.trackerAuthority, false);
  assert.equal(readOnly.actionable, false);

  const controllable = missionBannerModel({
    available: true,
    missionId: 'mission-1',
    phase: 'planned',
    view: { title: 'Kurzer Sprung', currentTask: 'Mission vorbereiten' },
    control: { executionAuthority: 'tracker', phase: 'prepare', allowedActions: ['sign_manifest'] }
  });
  assert.equal(controllable.label, 'MISSION | PREPARE');
  assert.equal(controllable.badge, 'AKTION BEREIT');
  assert.equal(controllable.trackerAuthority, true);
  assert.equal(controllable.actionable, true);
});

test('EFB host toggles utilities even when Coherent still serves the legacy utility module', () => {
  const hostSource = getTrackerEfbWebClientAsset('/efb/v1/assets/host.js').body.toString('utf8');
  const toggleSource = hostSource.match(/function toggleUtilityTool\(tool\) \{[\s\S]*?\n  \}\n\n  function configureOriginalChrome/)?.[0]
    .replace(/\n\n  function configureOriginalChrome$/, '');
  assert.ok(toggleSource);

  const calls = [];
  const legacyWindow = {
    isMapUtilityToolOpen: () => true,
    closeMapUtilityTool: (tool) => calls.push(`close:${tool}`),
    openMapUtilityTool: (tool) => calls.push(`open:${tool}`)
  };
  const legacyToggle = new Function('window', `return (${toggleSource});`)(legacyWindow);
  assert.equal(legacyToggle('e6b'), false);
  assert.deepEqual(calls, ['close:e6b']);

  legacyWindow.isMapUtilityToolOpen = () => false;
  assert.equal(legacyToggle('e6b'), true);
  assert.deepEqual(calls, ['close:e6b', 'open:e6b']);

  legacyWindow.toggleMapUtilityTool = (tool) => calls.push(`toggle:${tool}`) && 'modern';
  assert.equal(legacyToggle('e6b'), 'modern');
  assert.deepEqual(calls, ['close:e6b', 'open:e6b', 'toggle:e6b']);
});

test('mission drawer signatures ignore volatile relay and flight fields', () => {
  const hostSource = getTrackerEfbWebClientAsset('/efb/v1/assets/host.js').body.toString('utf8');
  const signatureSource = hostSource.match(/function missionRenderSignature\(payload\) \{[\s\S]*?\n  \}\n\n  function missionBannerModel/)?.[0]
    .replace(/\n\n  function missionBannerModel$/, '');
  assert.ok(signatureSource);
  const missionRenderSignature = new Function(`return (${signatureSource});`)();
  const first = {
    missionId: 'mission-1', runId: 'run-1', revision: 4, state: 'active', phase: 'enroute', sceneCount: 1,
    view: {
      capturedAt: 100,
      title: 'Überführungsflug', story: 'Öl prüfen und zur Küste fliegen.', currentTask: 'Ziel anfliegen',
      target: { name: 'Kühlungsborn', route: 'EDXY -> EDCX', distanceNm: 25.4, bearingDeg: 42 },
      flight: { trackerLive: true, mslFt: 3200, aglFt: 1800, gsKts: 102 },
      progress: [{ label: 'Strecke', percent: 40 }]
    }
  };
  const volatileUpdate = JSON.parse(JSON.stringify(first));
  volatileUpdate.revision = 9;
  volatileUpdate.view.capturedAt = 200;
  volatileUpdate.view.target.distanceNm = 21.8;
  volatileUpdate.view.target.bearingDeg = 44;
  volatileUpdate.view.flight.mslFt = 3500;
  volatileUpdate.view.flight.aglFt = 2100;
  volatileUpdate.view.flight.gsKts = 106;
  assert.equal(missionRenderSignature(first), missionRenderSignature(volatileUpdate));
  volatileUpdate.view.story = 'Geänderter Missionstext';
  assert.notEqual(missionRenderSignature(first), missionRenderSignature(volatileUpdate));
});

test('EFB map long-press input normalizes mouse, pointer and touch coordinates', () => {
  const hostSource = getTrackerEfbWebClientAsset('/efb/v1/assets/host.js').body.toString('utf8');
  const inputTypeSource = hostSource.match(/function mapContextInputType\(event\) \{[\s\S]*?\n  \}\n\n  function mapContextEventPoint/)?.[0]
    .replace(/\n\n  function mapContextEventPoint$/, '');
  const eventPointSource = hostSource.match(/function mapContextEventPoint\(event\) \{[\s\S]*?\n  \}\n\n  function bindMapContextLongPress/)?.[0]
    .replace(/\n\n  function bindMapContextLongPress$/, '');
  assert.ok(inputTypeSource);
  assert.ok(eventPointSource);
  const mapContextInputType = new Function(`return (${inputTypeSource});`)();
  const mapContextEventPoint = new Function(
    'mapContextInputType',
    'isFiniteNumber',
    `return (${eventPointSource});`
  )(mapContextInputType, (value) => typeof value === 'number' && Number.isFinite(value));

  assert.deepEqual(mapContextEventPoint({ type: 'mousedown', clientX: 12, clientY: 34, button: 0 }), {
    x: 12, y: 34, key: 'mouse:0', inputType: 'mouse'
  });
  assert.deepEqual(mapContextEventPoint({ type: 'pointerdown', clientX: 20, clientY: 40, pointerId: 7 }), {
    x: 20, y: 40, key: 'pointer:7', inputType: 'pointer'
  });
  assert.deepEqual(mapContextEventPoint({ type: 'touchstart', touches: [{ clientX: 50, clientY: 60, identifier: 3 }] }), {
    x: 50, y: 60, key: 'touch:3', inputType: 'touch'
  });
  assert.deepEqual(mapContextEventPoint({ type: 'touchend', touches: [], changedTouches: [{ clientX: 51, clientY: 61, identifier: 3 }] }), {
    x: 51, y: 61, key: 'touch:3', inputType: 'touch'
  });
  assert.equal(mapContextEventPoint({ type: 'touchcancel', touches: [], changedTouches: [] }), null);
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

test('versioned tracker assets keep shared sources in sync and EFB interaction patches isolated', () => {
  const projectRoot = path.resolve(__dirname, '..');
  const assetRoot = path.join(__dirname, 'efb-web-assets');
  assert.deepEqual(fs.readFileSync(path.join(assetRoot, 'styles.css')), fs.readFileSync(path.join(projectRoot, 'styles.css')));
  const appUtilitySource = fs.readFileSync(path.join(projectRoot, 'map-utility-tools.js'), 'utf8');
  const efbUtilitySource = fs.readFileSync(path.join(assetRoot, 'map-utility-tools.js'), 'utf8');
  assert.notEqual(efbUtilitySource, appUtilitySource);
  assert.match(efbUtilitySource, /ga-e6b-wind-slide-delta/);
  assert.doesNotMatch(appUtilitySource, /ga-e6b-wind-slide-delta/);
  assert.match(appUtilitySource, /function fitE6BFrameToViewport\(panel\)/);
  assert.match(appUtilitySource, /frame\.style\.width = `\$\{viewportWidth\}px`/);
  assert.match(appUtilitySource, /function toggleMapUtilityTool\(tool\)/);
  assert.match(appUtilitySource, /window\.toggleMapUtilityTool = toggleMapUtilityTool/);
  assert.doesNotMatch(efbUtilitySource, /fitE6BFrameToViewport/);
  const appMapSource = fs.readFileSync(path.join(projectRoot, 'map.js'), 'utf8');
  assert.match(appMapSource, /window\.toggleMapUtilityTool\('stopwatch'\)/);
  assert.match(appMapSource, /window\.toggleMapUtilityTool\('calculator'\)/);
  assert.match(appMapSource, /window\.toggleMapUtilityTool\('e6b'\)/);
  [
    'e6b-core.js',
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
  const appE6BSource = fs.readFileSync(path.join(projectRoot, 'e6b', 'e6b-flight-computer.js'), 'utf8');
  const efbE6BSource = fs.readFileSync(path.join(assetRoot, 'e6b', 'e6b-flight-computer.js'), 'utf8');
  assert.notEqual(efbE6BSource, appE6BSource);
  assert.match(efbE6BSource, /ga-e6b-wind-dot-set/);
  assert.doesNotMatch(appE6BSource, /ga-e6b-wind-dot-set/);
  assert.match(appE6BSource, /localControls: true/);
  assert.doesNotMatch(appE6BSource, /coherentMode/);
  assert.doesNotMatch(appE6BSource, /installE6BCompatibilityPolyfills/);
  assert.ok(getTrackerEfbWebClientAsset('/efb/v1/e6b/e6b-flight-computer.js'));
  const appE6BHtml = fs.readFileSync(path.join(projectRoot, 'e6b', 'e6b-flight-computer.html'), 'utf8');
  const efbE6BHtml = fs.readFileSync(path.join(assetRoot, 'e6b', 'e6b-flight-computer.html'), 'utf8');
  const appE6BCss = fs.readFileSync(path.join(projectRoot, 'e6b', 'e6b-flight-computer.css'), 'utf8');
  const efbE6BCss = fs.readFileSync(path.join(assetRoot, 'e6b', 'e6b-flight-computer.css'), 'utf8');
  assert.notEqual(efbE6BHtml, appE6BHtml);
  assert.notEqual(efbE6BCss, appE6BCss);
  assert.match(appE6BHtml, /data-e6b-control="flip"[^>]*>↻<\/button>/);
  assert.doesNotMatch(appE6BHtml, /ga-e6b-diagnostic/);
  assert.doesNotMatch(appE6BCss, /body\.e6b-coherent/);
  assert.match(efbE6BHtml, /ga-e6b-diagnostic/);
  assert.match(efbE6BCss, /body\.e6b-coherent/);
  const syncSource = fs.readFileSync(path.join(__dirname, 'sync-efb-web-assets.js'), 'utf8');
  assert.doesNotMatch(syncSource, /copy\('map-utility-tools\.js'\)/);
  assert.doesNotMatch(syncSource, /copy\('e6b\/e6b-flight-computer\.js'\)/);
  assert.doesNotMatch(syncSource, /copy\('e6b\/e6b-flight-computer\.html'\)/);
  assert.doesNotMatch(syncSource, /copy\('e6b\/e6b-flight-computer\.css'\)/);
  assert.match(syncSource, /requireEfbFork\('map-utility-tools\.js'/);
  assert.match(syncSource, /requireEfbFork\(path\.join\('e6b', 'e6b-flight-computer\.html'\)/);
  assert.match(syncSource, /requireEfbFork\(path\.join\('e6b', 'e6b-flight-computer\.css'\)/);
  assert.match(syncSource, /vpZoom\(-10\).*Horizontal rauszoomen/);
});

test('diagnostic probe remains available separately from the Kartentisch', () => {
  const page = createTrackerEfbProbePage();
  assert.match(page, /data-probe-version="2"/);
  assert.match(page, /ga-efb-server-probe/);
  const script = page.match(/<script>([\s\S]*?)<\/script>/i)?.[1] || '';
  assert.doesNotThrow(() => new Function(script));
});
