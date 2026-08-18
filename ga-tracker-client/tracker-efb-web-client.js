'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EFB_WEB_CLIENT_PATH = '/efb/v1/';
const EFB_WEB_CLIENT_PROBE_PATH = '/efb/v1/probe/';
const EFB_WEB_ASSET_REVISION = '37201';
const fileCache = new Map();

const STATIC_ASSETS = Object.freeze({
  '/efb/v1/assets/bg.jpg': [path.join(__dirname, 'efb-web-assets', 'background-placeholder.svg'), 'image/svg+xml; charset=utf-8'],
  '/efb/v1/assets/map.jpg': [path.join(__dirname, 'efb-web-assets', 'background-placeholder.svg'), 'image/svg+xml; charset=utf-8'],
  '/efb/v1/assets/app-styles.css': [path.join(__dirname, 'efb-web-assets', 'styles.css'), 'text/css; charset=utf-8'],
  '/efb/v1/assets/host.css': [path.join(__dirname, 'tracker-efb-kartentisch-host.css'), 'text/css; charset=utf-8'],
  '/efb/v1/assets/host.js': [path.join(__dirname, 'tracker-efb-kartentisch-host.js'), 'text/javascript; charset=utf-8'],
  '/efb/v1/assets/cockpit-session-client.js': [path.join(__dirname, 'tracker-cockpit-session-client.js'), 'text/javascript; charset=utf-8'],
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
  'e6b-flight-computer.css': [path.join(__dirname, 'efb-web-assets', 'e6b', 'e6b-flight-computer.css'), 'text/css; charset=utf-8'],
  'e6b-flight-computer.html': [path.join(__dirname, 'efb-web-assets', 'e6b', 'e6b-flight-computer.html'), 'text/html; charset=utf-8'],
  'e6b-flight-computer.js': [path.join(__dirname, 'efb-web-assets', 'e6b', 'e6b-flight-computer.js'), 'text/javascript; charset=utf-8'],
  'e6b-workbench-front-disc.json': [path.join(__dirname, 'efb-web-assets', 'e6b', 'e6b-workbench-front-disc.json'), 'application/json; charset=utf-8'],
  'e6b-workbench-wind-disc.json': [path.join(__dirname, 'efb-web-assets', 'e6b', 'e6b-workbench-wind-disc.json'), 'application/json; charset=utf-8']
});

function readCachedFile(filename) {
  if (!fileCache.has(filename)) fileCache.set(filename, fs.readFileSync(filename));
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
  <link rel="stylesheet" href="/efb/v1/assets/leaflet.css" onload="__gaEfbReport('info','style-loaded','leaflet.css')" onerror="__gaEfbReport('error','style-error','leaflet.css')">
  <link rel="stylesheet" href="/efb/v1/assets/app-styles.css?v=${EFB_WEB_ASSET_REVISION}" onload="__gaEfbReport('info','style-loaded','app-styles.css')" onerror="__gaEfbReport('error','style-error','app-styles.css')">
  <link rel="stylesheet" href="/efb/v1/assets/host.css?v=${EFB_WEB_ASSET_REVISION}" onload="__gaEfbReport('info','style-loaded','host.css')" onerror="__gaEfbReport('error','style-error','host.css')">
</head>
<body class="map-is-fullscreen theme-classic ga-efb-tracker-host" data-efb-view-version="8">
<div id="gaEfbBootStatus" class="ga-efb-boot-status">Kartentisch-Skripte werden geladen</div>
${extractKartentischMarkup()}
<script src="/efb/v1/assets/leaflet.js" onload="__gaEfbScriptLoaded('leaflet.js')" onerror="__gaEfbScriptError('leaflet.js')"></script>
<script src="/efb/v1/assets/map-shell-core.js?v=${EFB_WEB_ASSET_REVISION}" onload="__gaEfbScriptLoaded('map-shell-core.js')" onerror="__gaEfbScriptError('map-shell-core.js')"></script>
<script src="/efb/v1/assets/map-utility-tools.js?v=${EFB_WEB_ASSET_REVISION}" onload="__gaEfbScriptLoaded('map-utility-tools.js')" onerror="__gaEfbScriptError('map-utility-tools.js')"></script>
<script src="/efb/v1/assets/cockpit-session-client.js?v=${EFB_WEB_ASSET_REVISION}" data-role="auto" onload="__gaEfbScriptLoaded('cockpit-session-client.js')" onerror="__gaEfbScriptError('cockpit-session-client.js')"></script>
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
