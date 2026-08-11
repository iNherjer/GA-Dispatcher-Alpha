'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sourceRoot = path.join(__dirname, 'PackageSources', 'VfrMultitool', 'src');
const tsx = fs.readFileSync(path.join(sourceRoot, 'VfrMultitool.tsx'), 'utf8');
const scss = fs.readFileSync(path.join(sourceRoot, 'VfrMultitool.scss'), 'utf8');
const aircraftSvg = fs.readFileSync(path.join(sourceRoot, 'Assets', 'aircraft-marker.svg'), 'utf8');
const e6bRoot = path.join(__dirname, '..', '..', 'e6b');
const e6bJs = fs.readFileSync(path.join(e6bRoot, 'e6b-flight-computer.js'), 'utf8');
const e6bCss = fs.readFileSync(path.join(e6bRoot, 'e6b-flight-computer.css'), 'utf8');
const e6bHtml = fs.readFileSync(path.join(e6bRoot, 'e6b-flight-computer.html'), 'utf8');
const buildJs = fs.readFileSync(path.join(__dirname, 'PackageSources', 'VfrMultitool', 'build.js'), 'utf8');

test('map and status surfaces use app-specific class names', () => {
  assert.match(tsx, /class="ga-efb-map-view"/);
  assert.match(tsx, /class="ga-efb-map-canvas"/);
  assert.match(tsx, /class="ga-efb-status-view is-hidden"/);
  assert.doesNotMatch(tsx, /class="map-screen"/);
  assert.doesNotMatch(tsx, /class="status-screen/);
  assert.doesNotMatch(scss, /\.map-screen\b/);
  assert.doesNotMatch(scss, /\.status-screen\b/);
});

test('map initialization waits for the rendered EFB view', () => {
  assert.match(tsx, /onAfterRender\(node: VNode\)/);
  assert.match(tsx, /super\.onAfterRender\(node\)/);
  assert.match(tsx, /this\.rendered = true/);
  assert.match(tsx, /scheduleMapInitialization/);
  assert.match(tsx, /initializeMapSafely/);
});

test('full-size views avoid unsupported inset shorthand and gate Leaflet on layout size', () => {
  assert.doesNotMatch(scss, /\binset\s*:/);
  assert.match(scss, /\.ga-efb-map-view,[\s\S]*?top: 0;[\s\S]*?left: 0;[\s\S]*?width: 100%;[\s\S]*?height: 100%;/);
  assert.match(scss, /\.ga-efb-status-view[\s\S]*?top: 0;[\s\S]*?left: 0;[\s\S]*?width: 100%;[\s\S]*?height: 100%;/);
  assert.match(tsx, /host\.getBoundingClientRect\(\)/);
  assert.match(tsx, /bounds\.width < 2 \|\| bounds\.height < 2/);
  assert.match(tsx, /Kartenflaeche wartet auf Layoutgroesse/);
});

test('interactive map controls live on a pointer-isolated overlay above Leaflet', () => {
  assert.match(tsx, /mapControlsRef = FSComponent\.createRef<HTMLDivElement>\(\)/);
  assert.match(tsx, /class="ga-efb-map-controls"/);
  assert.match(tsx, /this\.mapControlsRef\.getOrDefault\(\)\?\.classList\.toggle\('is-hidden', screen !== 'map'\)/);
  assert.match(scss, /\.ga-efb-map-controls \{ z-index: 1100; pointer-events: none; \}/);
  assert.match(scss, /\.map-fab \{[\s\S]*?pointer-events: auto;/);
});

test('native EFB buttons bind real DOM click handlers after render', () => {
  assert.doesNotMatch(tsx, /<button[^>]*\bonClick=/);
  assert.match(tsx, /this\.bindDomInteractions\(\)/);
  assert.match(tsx, /button\.onclick = \(event: MouseEvent\): void =>/);
  assert.match(tsx, /this\.bindButton\(this\.mapTabRef\.getOrDefault\(\)/);
  assert.match(tsx, /this\.bindButton\(this\.statusTabRef\.getOrDefault\(\)/);
  assert.match(tsx, /this\.bindButton\(this\.layerButtonRef\.getOrDefault\(\)/);
  assert.match(tsx, /this\.bindButton\(this\.followButtonRef\.getOrDefault\(\)/);
  assert.match(tsx, /querySelectorAll<HTMLButtonElement>\('\[data-base-layer\]'\)/);
  assert.match(tsx, /querySelectorAll<HTMLButtonElement>\('\[data-overlay-layer\]'\)/);
  assert.match(tsx, /this\.bindButton\(this\.toolbarToggleRef\.getOrDefault\(\)/);
  assert.match(tsx, /querySelectorAll<HTMLButtonElement>\('\[data-theme\]'\)/);
  assert.match(tsx, /querySelectorAll<HTMLButtonElement>\('\[data-tool\]'\)/);
  assert.match(tsx, /querySelectorAll<HTMLButtonElement>\('\[data-calc\]'\)/);
});

test('tracker map contract feeds route, profile and compass without embedding mission narrative', () => {
  assert.match(tsx, /fetch\(`\$\{TRACKER_API_URL\}\/api\/v1\/map`/);
  assert.match(tsx, /'map\.snapshot', 'map\.snapshot\.v1'/);
  assert.match(tsx, /MapShellCore\.normalizeTrackerMapSnapshot\(mapPayload\)/);
  assert.match(tsx, /private renderMapSnapshot\(snapshot: TrackerMapSnapshot/);
  assert.match(tsx, /private renderProfile\(\)/);
  assert.match(tsx, /private renderCompass\(\)/);
  assert.match(tsx, /class="profile-band"/);
  assert.match(tsx, /class="map-compass"/);
});

test('theme and local tool shell reuses the map-table devices and bundles the interactive E6B', () => {
  for (const theme of ['classic', 'retro', 'navcom', 'ops1940', 'win95']) {
    assert.match(tsx, new RegExp(`data-theme="${theme}"`));
    if (theme === 'classic') assert.match(scss, /\.vfr-multitool-app/);
    else assert.match(scss, new RegExp(`theme-${theme}`));
  }
  assert.match(tsx, /data-tool="e6b"/);
  assert.match(tsx, /data-tool="clock"/);
  assert.match(tsx, /data-tool="calculator"/);
  assert.match(tsx, /Assets\/E6B\/e6b-flight-computer-efb\.html#embedded-coherent/);
  assert.match(tsx, /MapShellCore\.evaluateCalculatorExpression/);
  assert.match(tsx, /ga-e6b-close/);
  assert.match(tsx, /class="map-stopwatch-device"/);
  assert.match(tsx, /stopwatchSecondHandRef/);
  assert.match(tsx, /class="calculator-case"/);
  assert.match(tsx, /syncE6bFrameSize/);
  assert.match(buildJs, /e6b-efb-disc-data\.js/);
  assert.match(buildJs, /e6b-workbench-front-disc\.json/);
  assert.match(buildJs, /e6b-workbench-wind-disc\.json/);
  assert.match(e6bJs, /embeddedMode = \/embedded\(\?:=1\)\?\/i\.test\(locationMode\)/);
  assert.match(e6bJs, /window\.GAE6B_EFB_DISCS/);
  assert.match(e6bCss, /body\.e6b-coherent/);
  assert.doesNotMatch(e6bCss, /\binset\s*:/);
  assert.doesNotMatch(e6bCss, /\bmin\(/);
  assert.doesNotMatch(e6bCss, /\bclamp\(/);
  assert.doesNotMatch(e6bHtml, /[↻−×]/);
});

test('Coherent-facing controls avoid the unsupported glyphs seen in the simulator', () => {
  assert.doesNotMatch(tsx, /[⌃⌫×÷−·°↻]/);
  assert.doesNotMatch(scss, /\bmin\(/);
  assert.doesNotMatch(scss, /\bclamp\(/);
});

test('EFB map mirrors web base dimming and the default aircraft marker', () => {
  assert.match(tsx, /MapShellCore\.baseLayerOpacity\(this\.preferences\)/);
  assert.match(tsx, /Assets\/aircraft-marker\.svg/);
  assert.match(tsx, /iconSize: \[0, 0\]/);
  assert.match(tsx, /querySelector\?\.\('\.efb-aircraft-glyph img'\)/);
  assert.match(scss, /\.efb-aircraft-glyph \{[\s\S]*?width: 40px;[\s\S]*?height: 40px;[\s\S]*?transform: translate\(-50%, -37%\);/);
  assert.match(aircraftSvg, /viewBox="0 0 447\.74 339\.91"/);
  assert.match(aircraftSvg, /fill="#f2c12e" stroke="#000" stroke-width="16"/);
});

test('mission UI debounces initial emptiness and keeps confirmed snapshots across short gaps', () => {
  assert.match(tsx, /MapShellCore\.advanceMissionDisplay\(snapshot, this\.missionDisplayState, Date\.now\(\)\)/);
  assert.match(tsx, /this\.missionDisplayState\.mode === 'pending'/);
  assert.match(tsx, /Missionsdaten werden synchronisiert\./);
  assert.match(tsx, /this\.missionDisplayState\.snapshot as MissionSnapshotPayload/);
});

test('map initialization failures remain visible and diagnosable', () => {
  assert.match(tsx, /console\.error\('\[VFR Multitool EFB\] Karteninitialisierung fehlgeschlagen'/);
  assert.match(tsx, /Karte konnte nicht initialisiert werden/);
  assert.match(scss, /\.ga-efb-map-view[\s\S]*display: block/);
});

test('tracker-hosted Kartentisch uses a channel handshake and reports iframe diagnostics', () => {
  assert.match(tsx, /private serverFrameChannel = ''/);
  assert.match(tsx, /messageChannel === this\.serverFrameChannel/);
  assert.match(tsx, /\/efb\/v1\/\?channel=\$\{encodeURIComponent\(this\.serverFrameChannel\)\}&view=4/);
  assert.match(tsx, /\/api\/v1\/client-log/);
  assert.match(tsx, /this\.reportServerFrameEvent\('parent-message'/);
  assert.match(tsx, /state === 'close'[\s\S]*?this\.setScreen\('map'\)/);
});
