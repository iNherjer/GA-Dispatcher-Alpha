'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sourceRoot = path.join(__dirname, 'PackageSources', 'VfrMultitool', 'src');
const tsx = fs.readFileSync(path.join(sourceRoot, 'VfrMultitool.tsx'), 'utf8');
const scss = fs.readFileSync(path.join(sourceRoot, 'VfrMultitool.scss'), 'utf8');

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

test('map initialization failures remain visible and diagnosable', () => {
  assert.match(tsx, /console\.error\('\[VFR Multitool EFB\] Karteninitialisierung fehlgeschlagen'/);
  assert.match(tsx, /Karte konnte nicht initialisiert werden/);
  assert.match(scss, /\.ga-efb-map-view[\s\S]*display: block/);
});
