'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TRACKER_ROOT = __dirname;
const PROJECT_ROOT = path.resolve(TRACKER_ROOT, '..');
const OUTPUT_ROOT = path.join(TRACKER_ROOT, 'efb-web-assets');

function ensureParent(filename) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
}

function copy(relativeSource, relativeTarget = relativeSource) {
  const source = path.join(PROJECT_ROOT, relativeSource);
  const target = path.join(OUTPUT_ROOT, relativeTarget);
  ensureParent(target);
  fs.copyFileSync(source, target);
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
    .replace('src="e6b/e6b-flight-computer.html?embedded=1&amp;', 'src="/efb/v1/e6b/e6b-flight-computer.html?embedded=1&amp;coherent=1&amp;')
    .replace('onclick="vpZoom(10)" title="Horizontal rauszoomen"', 'onclick="vpZoom(-10)" title="Horizontal rauszoomen"')
    .replace('onclick="vpZoom(-10)" title="Horizontal reinzoomen"', 'onclick="vpZoom(10)" title="Horizontal reinzoomen"')
    .replaceAll('−', '-');
  const target = path.join(OUTPUT_ROOT, 'kartentisch-fragment.html');
  ensureParent(target);
  fs.writeFileSync(target, fragment, 'utf8');
}

writeKartentischFragment();
copy('styles.css');
copy('vendor/leaflet/leaflet.css');
copy('vendor/leaflet/leaflet.js');
copy('vendor/leaflet/images/layers.png');
copy('vendor/leaflet/images/layers-2x.png');
copy('vendor/leaflet/images/marker-icon.png');
copy('e6b/e6b-core.js');
copy('e6b/e6b-flight-computer.css');
copy('e6b/e6b-flight-computer.html');
copy('e6b/e6b-workbench-front-disc.json');
copy('e6b/e6b-workbench-wind-disc.json');
copy('ga-tracker-client/efb-app/PackageSources/VfrMultitool/src/Assets/aircraft-marker.svg', 'aircraft-marker.svg');

// Diese beiden Dateien sind absichtliche Coherent-/EFB-Forks. Sie duerfen beim
// Shared-Asset-Sync nicht wieder in die normale Browser-App zurueckkopiert oder
// durch deren Quellen ersetzt werden.
requireEfbFork('map-utility-tools.js', 'ga-e6b-wind-slide-delta');
requireEfbFork(path.join('e6b', 'e6b-flight-computer.js'), 'ga-e6b-wind-dot-set');

process.stdout.write('EFB_WEB_ASSETS_SYNCED\n');
