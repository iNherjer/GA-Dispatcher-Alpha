'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TRACKER_ROOT = __dirname;
const PROJECT_ROOT = path.resolve(TRACKER_ROOT, '..');
const OUTPUT_ROOT = path.join(TRACKER_ROOT, 'efb-web-assets');
const { canvasFontPlugin } = require('./tracker-efb-fonts');

function ensureParent(filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
}

function copy(relativeSource, relativeTarget = relativeSource) {
  const source = path.join(PROJECT_ROOT, relativeSource);
  const target = path.join(OUTPUT_ROOT, relativeTarget);
  ensureParent(target);
  fs.copyFileSync(source, target);
}


// Compile the actual standalone sources for Coherent. Generated assets never
// acquire a separate renderer or independent control logic.
function compileShared(relativeSource) {
  const source = path.join(PROJECT_ROOT, relativeSource);
  const target = path.join(OUTPUT_ROOT, relativeSource);
  const result = require('@babel/core').transformFileSync(source, {
    babelrc: false, configFile: false, sourceType: 'script', comments: true, compact: false,
    plugins: relativeSource === 'profile.js' ? [canvasFontPlugin] : [],
    presets: [[require.resolve('@babel/preset-env'), {
      targets: { chrome: '49' }, modules: false, useBuiltIns: false,
      include: ['@babel/plugin-transform-spread', '@babel/plugin-transform-parameters']
    }]]
  });
  ensureParent(target);
  fs.writeFileSync(target, '// Generated from ' + relativeSource + ' by sync-efb-web-assets.js. Do not edit.\n' + result.code + '\n');
}

function requireEfbFork(relativeTarget, marker) {
  const target = path.join(OUTPUT_ROOT, relativeTarget);
  const source = fs.readFileSync(target, 'utf8');
  if (!source.includes(marker)) {
    throw new Error(`Der EFB-spezifische Asset-Fork ${relativeTarget} fehlt oder ist nicht aktuell.`);
  }
}

function writeKartentischFragment() {
  const html = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');
  const start = html.indexOf('<div id="mapTableOverlay"');
  const end = html.indexOf('\n<script>', start);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('Der originale Kartentisch-Abschnitt konnte nicht aus index.html extrahiert werden.');
  }
  const fragment = html.slice(start, end)
    .replace('src="e6b/e6b-flight-computer.html?embedded=1&amp;', 'src="/efb/v1/e6b/e6b-flight-computer.html?embedded=1&amp;coherent=1&amp;');
  const target = path.join(OUTPUT_ROOT, 'kartentisch-fragment.html');
  ensureParent(target);
  fs.writeFileSync(target, fragment, 'utf8');
}

writeKartentischFragment();
copy('styles.css');
compileShared('profile.js');
compileShared('checklists.js');
compileShared('navigation-warning-core.js');
compileShared('map-prediction.js');
compileShared('map-profile-controls.js');
compileShared('map-display-controls.js');
compileShared('airport-radio.js');
compileShared('airport-details.js');
compileShared('airport-aip.js');
compileShared('airport-weather.js');
compileShared('map-airport-popup.js');
compileShared('map-drawing.js');
compileShared('map-navigation-geometry.js');
compileShared('map-navpoint-core.js');
compileShared('map-single-click.js');
compileShared('map-context-popup.js');
compileShared('map-direct-to-core.js');
compileShared('map-navigation-client.js');
compileShared('map-route-edit-core.js');
compileShared('map-layer-controls.js');
compileShared('map-tool-focus.js');
compileShared('map-autozoom.js');
compileShared('map-terrain-avoid.js');
copy('vendor/leaflet/leaflet.css');
copy('vendor/leaflet/leaflet.js');
copy('vendor/leaflet/images/layers.png');
copy('vendor/leaflet/images/layers-2x.png');
copy('vendor/leaflet/images/marker-icon.png');
copy('e6b/e6b-core.js');
copy('e6b/e6b-svg-compat.js');
copy('e6b/e6b-workbench-front-disc.json');
copy('e6b/e6b-workbench-wind-disc.json');
copy('ga-tracker-client/efb-app/PackageSources/VfrMultitool/src/Assets/aircraft-marker.svg', 'aircraft-marker.svg');

// Diese Dateien sind absichtliche Coherent-/EFB-Forks. Sie duerfen beim
// Shared-Asset-Sync nicht wieder in die normale Browser-App zurueckkopiert oder
// durch deren Quellen ersetzt werden.
requireEfbFork('map-utility-tools.js', 'ga-e6b-wind-slide-delta');
requireEfbFork(path.join('e6b', 'e6b-flight-computer.html'), 'ga-e6b-diagnostic');
requireEfbFork(path.join('e6b', 'e6b-flight-computer.css'), 'body.e6b-coherent');
requireEfbFork(path.join('e6b', 'e6b-flight-computer.js'), 'ga-e6b-wind-dot-set');

process.stdout.write('EFB_WEB_ASSETS_SYNCED\n');

fs.copyFileSync(path.join(TRACKER_ROOT, 'tracker-audio-player.js'), path.join(TRACKER_ROOT, 'desktop', 'ui', 'tracker-audio-player.js'));
