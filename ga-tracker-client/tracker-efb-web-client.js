'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { fontDeclarations, htmlFontDeclarations, clientFontSource } = require('./tracker-efb-fonts');

const EFB_WEB_CLIENT_PATH = '/efb/v1/';
const EFB_WEB_CLIENT_PROBE_PATH = '/efb/v1/probe/';
const EFB_WEB_ASSET_REVISION = '40301';
const fileCache = new Map();

const STATIC_ASSETS = Object.freeze({
  '/efb/v1/assets/stopwatch-ticks.svg': [path.join(__dirname, 'efb-fonts', 'stopwatch-ticks.svg'), 'image/svg+xml; charset=utf-8'],
  '/efb/v1/assets/symbols.js': [path.join(__dirname, 'tracker-efb-symbols.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/emoji-text.js': [path.join(__dirname, 'tracker-efb-emoji-text.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/fonts.css': [path.join(__dirname, 'efb-fonts', 'fonts.css'), 'text/css; charset=utf-8'],
  '/efb/v1/assets/fonts/DSEG7Classic-Bold.ttf': [path.join(__dirname, 'efb-fonts', 'DSEG7Classic-Bold.ttf'), 'font/ttf'],
  '/efb/v1/assets/fonts/Caveat-SemiBold.ttf': [path.join(__dirname, 'efb-fonts', 'Caveat-SemiBold.ttf'), 'font/ttf'],
  '/efb/v1/assets/fonts/OleoScript-Regular.ttf': [path.join(__dirname, 'efb-fonts', 'OleoScript-Regular.ttf'), 'font/ttf'],
  '/efb/v1/assets/fonts/OleoScript-Bold.ttf': [path.join(__dirname, 'efb-fonts', 'OleoScript-Bold.ttf'), 'font/ttf'],
  '/efb/v1/assets/fonts/ShareTechMono-Regular.ttf': [path.join(__dirname, 'efb-fonts', 'ShareTechMono-Regular.ttf'), 'font/ttf'],
  '/efb/v1/assets/fonts/NotoSans-Regular.ttf': [path.join(__dirname, 'efb-fonts', 'NotoSans-Regular.ttf'), 'font/ttf'],
  '/efb/v1/assets/fonts/NotoSansMono-Regular.ttf': [path.join(__dirname, 'efb-fonts', 'NotoSansMono-Regular.ttf'), 'font/ttf'],
  '/efb/v1/assets/fonts/NotoSansSymbols2-Regular.ttf': [path.join(__dirname, 'efb-fonts', 'NotoSansSymbols2-Regular.ttf'), 'font/ttf'],
  '/efb/v1/assets/fonts/NotoSansMath-Regular.ttf': [path.join(__dirname, 'efb-fonts', 'NotoSansMath-Regular.ttf'), 'font/ttf'],
  '/efb/v1/assets/fonts/OpenMoji-color-glyf_colr_0.ttf': [path.join(__dirname, 'efb-fonts', 'OpenMoji-color-glyf_colr_0.ttf'), 'font/ttf'],
  '/efb/v1/assets/map-profile-controls.js': [path.join(__dirname, 'efb-web-assets', 'map-profile-controls.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/map-prediction.js': [path.join(__dirname, 'efb-web-assets', 'map-prediction.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/navigation-warning-core.js': [path.join(__dirname, 'efb-web-assets', 'navigation-warning-core.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/map-display-controls.js': [path.join(__dirname, 'efb-web-assets', 'map-display-controls.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/airport-details.js': [path.join(__dirname, 'efb-web-assets', 'airport-details.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/airport-aip.js': [path.join(__dirname, 'efb-web-assets', 'airport-aip.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/map-route-edit-core.js': [path.join(__dirname, 'efb-web-assets', 'map-route-edit-core.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/map-navigation-client.js': [path.join(__dirname, 'efb-web-assets', 'map-navigation-client.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/map-direct-to-core.js': [path.join(__dirname, 'efb-web-assets', 'map-direct-to-core.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/airport-weather.js': [path.join(__dirname, 'efb-web-assets', 'airport-weather.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/map-airport-popup.js': [path.join(__dirname, 'efb-web-assets', 'map-airport-popup.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/map-drawing.js': [path.join(__dirname, 'efb-web-assets', 'map-drawing.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/map-navigation-geometry.js': [path.join(__dirname, 'efb-web-assets', 'map-navigation-geometry.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/map-navpoint-core.js': [path.join(__dirname, 'efb-web-assets', 'map-navpoint-core.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/map-single-click.js': [path.join(__dirname, 'efb-web-assets', 'map-single-click.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/map-context-popup.js': [path.join(__dirname, 'efb-web-assets', 'map-context-popup.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/airport-radio.js': [path.join(__dirname, 'efb-web-assets', 'airport-radio.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/map-layer-controls.js': [path.join(__dirname, 'efb-web-assets', 'map-layer-controls.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/map-tool-focus.js': [path.join(__dirname, 'efb-web-assets', 'map-tool-focus.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/map-autozoom.js': [path.join(__dirname, 'efb-web-assets', 'map-autozoom.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/map-terrain-avoid.js': [path.join(__dirname, 'efb-web-assets', 'map-terrain-avoid.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/profile.js': [path.join(__dirname, 'efb-web-assets', 'profile.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/profile-bridge.js': [path.join(__dirname, 'tracker-efb-profile-bridge.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/checklists.js': [path.join(__dirname, 'efb-web-assets', 'checklists.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/bg.jpg': [path.join(__dirname, 'efb-web-assets', 'background-placeholder.svg'), 'image/svg+xml; charset=utf-8'],
  '/efb/v1/assets/map.jpg': [path.join(__dirname, 'efb-web-assets', 'background-placeholder.svg'), 'image/svg+xml; charset=utf-8'],
  '/efb/v1/assets/app-styles.css': [path.join(__dirname, 'efb-web-assets', 'styles.css'), 'text/css; charset=utf-8'],
  '/efb/v1/assets/host.css': [path.join(__dirname, 'tracker-efb-kartentisch-host.css'), 'text/css; charset=utf-8'],
  '/efb/v1/assets/host.js': [path.join(__dirname, 'tracker-efb-kartentisch-host.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/mission-control-ui-core.js': [path.join(__dirname, 'mission-control-ui-core.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/mission-manifest-core.js': [path.join(__dirname, '..', 'mission-manifest-core.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/warning-voices.json': [path.join(__dirname, '..', 'audio-warnings', 'voices', 'catalog.json'), 'application/json; charset=utf-8'],
  '/efb/v1/assets/navigation-warning-presentation.js': [path.join(__dirname, '..', 'navigation-warning-presentation.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/navigation-warning-audio.js': [path.join(__dirname, '..', 'navigation-warning-audio.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/pax-audio-style.js': [path.join(__dirname, '..', 'pax-audio-style.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/audio-player.js': [path.join(__dirname, 'tracker-audio-player.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/audio-client.js': [path.join(__dirname, 'tracker-audio-client.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/cockpit-session-client.js': [path.join(__dirname, 'tracker-cockpit-session-client.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/map-live-presentation.js': [path.join(__dirname, '..', 'map-live-presentation.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/MS33558.ttf': [path.join(__dirname, '..', 'MS33558.ttf'), 'font/ttf'],
  '/efb/v1/assets/map-shell-core.js': [path.join(__dirname, 'efb-app', 'map-shell-core.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/map-utility-tools.js': [path.join(__dirname, 'efb-web-assets', 'map-utility-tools.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/leaflet.css': [path.join(__dirname, 'efb-web-assets', 'vendor', 'leaflet', 'leaflet.css'), 'text/css; charset=utf-8'],
  '/efb/v1/assets/leaflet.js': [path.join(__dirname, 'efb-web-assets', 'vendor', 'leaflet', 'leaflet.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/images/layers.png': [path.join(__dirname, 'efb-web-assets', 'vendor', 'leaflet', 'images', 'layers.png'), 'image/png'],
  '/efb/v1/assets/images/layers-2x.png': [path.join(__dirname, 'efb-web-assets', 'vendor', 'leaflet', 'images', 'layers-2x.png'), 'image/png'],
  '/efb/v1/assets/images/marker-icon.png': [path.join(__dirname, 'efb-web-assets', 'vendor', 'leaflet', 'images', 'marker-icon.png'), 'image/png'],
  '/efb/v1/assets/aircraft-marker.svg': [path.join(__dirname, 'efb-web-assets', 'aircraft-marker.svg'), 'image/svg+xml; charset=utf-8']
});

const E6B_ASSETS = Object.freeze({
  'e6b-core.js': [path.join(__dirname, 'efb-web-assets', 'e6b', 'e6b-core.js'), 'text/javascript; charset=utf-8'],
  'e6b-svg-compat.js': [path.join(__dirname, 'efb-web-assets', 'e6b', 'e6b-svg-compat.js'), 'text/javascript; charset=utf-8'],
  'e6b-flight-computer.css': [path.join(__dirname, 'efb-web-assets', 'e6b', 'e6b-flight-computer.css'), 'text/css; charset=utf-8'],
  'e6b-flight-computer.html': [path.join(__dirname, 'efb-web-assets', 'e6b', 'e6b-flight-computer.html'), 'text/html; charset=utf-8'],
  'e6b-flight-computer.js': [path.join(__dirname, 'efb-web-assets', 'e6b', 'e6b-flight-computer.js'), 'text/javascript; charset=utf-8'],
  'e6b-workbench-front-disc.json': [path.join(__dirname, 'efb-web-assets', 'e6b', 'e6b-workbench-front-disc.json'), 'application/json; charset=utf-8'],
  'e6b-workbench-wind-disc.json': [path.join(__dirname, 'efb-web-assets', 'e6b', 'e6b-workbench-wind-disc.json'), 'application/json; charset=utf-8']
});

function readCachedFile(filename) {
  if (!fileCache.has(filename)) {
    let body = fs.readFileSync(filename);
    if (filename.endsWith('tracker-efb-symbols.js')) body = Buffer.from('var gaEfbSymbolArtwork = ' + fs.readFileSync(path.join(__dirname, 'efb-fonts', 'symbols.json'), 'utf8') + ';\n' + body.toString('utf8'));
    if (filename.endsWith('tracker-efb-emoji-text.js')) body = Buffer.from(clientFontSource() + body.toString('utf8'));
    if (filename.endsWith('.css')) body = Buffer.from(fontDeclarations(body.toString('utf8')));
    if (filename.endsWith('.html')) body = Buffer.from(htmlFontDeclarations(body.toString('utf8'))
      .replace('</head>', '<link rel="stylesheet" href="/efb/v1/assets/fonts.css?v=' + EFB_WEB_ASSET_REVISION + '"><script defer src="/efb/v1/assets/symbols.js?v=' + EFB_WEB_ASSET_REVISION + '"></script><script defer src="/efb/v1/assets/emoji-text.js?v=' + EFB_WEB_ASSET_REVISION + '"></script></head>'));
    fileCache.set(filename, body);
  }
  return fileCache.get(filename);
}

function extractKartentischMarkup() {
  const markup = readCachedFile(path.join(__dirname, 'efb-web-assets', 'kartentisch-fragment.html')).toString('utf8');
  if (!markup.includes('<div id="mapTableOverlay"') || !markup.includes('<div id="mapE6BDevice"')) {
    throw new Error('Das gebuendelte Kartentisch-Fragment ist unvollstaendig.');
  }
  return markup;
}

function getInlineBootstrapSource() {
  return readCachedFile(path.join(__dirname, 'tracker-efb-bootstrap-inline.js'))
    .toString('utf8')
    .replace(/<\/script/gi, '<\\/script');
}

function createTrackerEfbWebClientPage() {
  return `<!doctype html>
<html lang="de" class="map-is-fullscreen">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <title>VFR Multitool Kartentisch</title>
  <script>${getInlineBootstrapSource()}</script>
  <link rel="stylesheet" href="/efb/v1/assets/fonts.css?v=${EFB_WEB_ASSET_REVISION}">
  <link rel="stylesheet" href="/efb/v1/assets/leaflet.css" onload="__gaEfbReport('info','style-loaded','leaflet.css')" onerror="__gaEfbReport('error','style-error','leaflet.css')">
  <link rel="stylesheet" href="/efb/v1/assets/app-styles.css?v=${EFB_WEB_ASSET_REVISION}" onload="__gaEfbReport('info','style-loaded','app-styles.css')" onerror="__gaEfbReport('error','style-error','app-styles.css')">
  <link rel="stylesheet" href="/efb/v1/assets/host.css?v=${EFB_WEB_ASSET_REVISION}" onload="__gaEfbReport('info','style-loaded','host.css')" onerror="__gaEfbReport('error','style-error','host.css')">
</head>
<body class="map-is-fullscreen theme-classic ga-efb-tracker-host" data-efb-view-version="9">
<div id="gaEfbBootStatus" class="ga-efb-boot-status">Kartentisch-Skripte werden geladen</div>
${extractKartentischMarkup()}
<script src="/efb/v1/assets/symbols.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/emoji-text.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/leaflet.js" onload="__gaEfbScriptLoaded('leaflet.js')" onerror="__gaEfbScriptError('leaflet.js')"></script>
<script src="/efb/v1/assets/map-shell-core.js?v=${EFB_WEB_ASSET_REVISION}" onload="__gaEfbScriptLoaded('map-shell-core.js')" onerror="__gaEfbScriptError('map-shell-core.js')"></script>
<script src="/efb/v1/assets/map-utility-tools.js?v=${EFB_WEB_ASSET_REVISION}" onload="__gaEfbScriptLoaded('map-utility-tools.js')" onerror="__gaEfbScriptError('map-utility-tools.js')"></script>
<script src="/efb/v1/assets/mission-control-ui-core.js?v=${EFB_WEB_ASSET_REVISION}" onload="__gaEfbScriptLoaded('mission-control-ui-core.js')" onerror="__gaEfbScriptError('mission-control-ui-core.js')"></script>
<script src="/efb/v1/assets/mission-manifest-core.js?v=${EFB_WEB_ASSET_REVISION}" onload="__gaEfbScriptLoaded('mission-manifest-core.js')" onerror="__gaEfbScriptError('mission-manifest-core.js')"></script>
<script src="/efb/v1/assets/map-live-presentation.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/navigation-warning-presentation.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/navigation-warning-audio.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/pax-audio-style.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/audio-player.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/cockpit-session-client.js?v=${EFB_WEB_ASSET_REVISION}" data-role="auto" onload="__gaEfbScriptLoaded('cockpit-session-client.js')" onerror="__gaEfbScriptError('cockpit-session-client.js')"></script>
<script src="/efb/v1/assets/audio-client.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/navigation-warning-core.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/map-prediction.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/map-profile-controls.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/map-display-controls.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/airport-radio.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/airport-details.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/airport-aip.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/map-direct-to-core.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/map-route-edit-core.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/map-navigation-client.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/map-layer-controls.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/map-tool-focus.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/map-autozoom.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/map-terrain-avoid.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/airport-weather.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/map-airport-popup.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/map-drawing.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/map-navigation-geometry.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/map-navpoint-core.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/map-single-click.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/map-context-popup.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/profile-bridge.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/checklists.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/profile.js?v=${EFB_WEB_ASSET_REVISION}"></script>
<script src="/efb/v1/assets/host.js?v=${EFB_WEB_ASSET_REVISION}" onload="__gaEfbScriptLoaded('host.js')" onerror="__gaEfbScriptError('host.js')"></script>
</body>
</html>`;
}

function createTrackerEfbProbePage() {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EFB Probe</title><style>html,body{height:100%;margin:0;background:#06121d;color:#eef7fb;font:16px Arial}main{padding:2rem}button{padding:.8rem;margin:.4rem}</style></head><body><main data-probe-version="2"><h1>Tracker-hosted EFB Probe</h1><p id="state">Warte auf Snapshot</p><button id="clickTest">Klicktest</button></main><script>(function(){var clicks=0;function send(state){try{parent.postMessage({type:'ga-efb-server-probe',state:state,clicks:clicks},'*')}catch(_){}}document.getElementById('clickTest').onclick=function(){clicks++;send('input')};fetch('/api/v1/snapshot',{cache:'no-store'}).then(function(r){return r.json()}).then(function(){document.getElementById('state').textContent='Snapshot erreichbar';send('ready')}).catch(function(){document.getElementById('state').textContent='Snapshot nicht erreichbar';send('error')});send('loaded')})()</script></body></html>`;
}

function getTrackerEfbWebClientAsset(pathname) {
  const staticAsset = STATIC_ASSETS[pathname];
  if (staticAsset) {
    return { body: readCachedFile(staticAsset[0]), contentType: staticAsset[1] };
  }
  if (!pathname.startsWith('/efb/v1/e6b/')) return null;
  const filename = pathname.slice('/efb/v1/e6b/'.length);
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(filename) || filename.includes('..')) return null;
  const asset = E6B_ASSETS[filename];
  if (!asset) return null;
  return { body: readCachedFile(asset[0]), contentType: asset[1] };
}

module.exports = {
  EFB_WEB_CLIENT_PATH,
  EFB_WEB_CLIENT_PROBE_PATH,
  EFB_WEB_ASSET_REVISION,
  createTrackerEfbProbePage,
  createTrackerEfbWebClientPage,
  extractKartentischMarkup,
  getInlineBootstrapSource,
  getTrackerEfbWebClientAsset
};
