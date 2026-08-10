'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sourceRoot = path.join(__dirname, 'PackageSources', 'VfrMultitool', 'src');
const tsx = fs.readFileSync(path.join(sourceRoot, 'VfrMultitool.tsx'), 'utf8');
const scss = fs.readFileSync(path.join(sourceRoot, 'VfrMultitool.scss'), 'utf8');
const aircraftSvg = fs.readFileSync(path.join(sourceRoot, 'Assets', 'aircraft-marker.svg'), 'utf8');

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
