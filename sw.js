// VFR Multitool – Service Worker
const CACHE = 'ga-dispatcher-v2264';

const STATIC = [
    './',
    './index.html',
    './legal.html',
    './styles.css',
    './assets/fonts/Doto-Black-latin.woff2',
    './assets/fonts/DSEG14Classic-Bold.woff2',
    './assets/fonts/DSEG14Classic-Regular.woff2',
    './navcom-skins.css',
    './navcom-skins.js',
    './analog-skins.css',
    './analog-skins.js',
    './glareshield.css',
    './glareshield.js',
    './assets/ui/tower/tower-wood.webp',
    './assets/ui/tower/tower-board.webp',
    './assets/ui/tower/tower-clip.webp',
    './assets/ui/tower/tower-pencil.webp',
    './assets/ui/tower/tower-radio.webp',
    './assets/ui/telex/tele-body.webp',
    './assets/ui/telex/tele-paper.webp',
    './assets/ui/telex/tele-hood.webp',
    './assets/ui/telex/tele-knob.webp',
    './assets/ui/telex/tele-toggle-up.webp',
    './assets/ui/telex/tele-toggle-down.webp',
    './assets/ui/telex/tele-toggle-left.webp',
    './assets/ui/telex/tele-toggle-right.webp',
    './assets/ui/telex/tele-key-green.webp',
    './assets/ui/telex/tele-key-cream.webp',
    './assets/ui/telex/tele-key-red.webp',
    './assets/ui/ops1940/ops1940-controls-atlas.webp',
    './assets/ui/ops1940/ops1940-desk-bg.webp',
    './assets/ui/ops1940/ops1940-panel-aircraft.webp',
    './assets/ui/ops1940/ops1940-panel-direction.webp',
    './assets/ui/ops1940/ops1940-panel-region.webp',
    './assets/ui/ops1940/ops1940-panel-route-selector-mobile.webp',
    './assets/ui/ops1940/ops1940-panel-route-selector.webp',
    './assets/ui/ops1940/ops1940-panel-slider.webp',
    './assets/ui/ops1940/ops1940-picto-dep-square.webp',
    './assets/ui/ops1940/ops1940-picto-dest-square.webp',
    './assets/ui/ops1940/ops1940-picto-range-square.webp',
    './assets/ui/ops1940/ops1940-picto-type-apt-square.webp',
    './assets/ui/ops1940/ops1940-picto-type-poi-square.webp',
    './assets/ui/ops1940/ops1940-reset-button-cap.webp',
    './assets/ui/ops1940/ops1940-screw-cross-r0.webp',
    './assets/ui/ops1940/ops1940-screw-cross-r17.webp',
    './assets/ui/ops1940/ops1940-screw-cross-r41.webp',
    './assets/ui/ops1940/ops1940-screw-cross-r73.webp',
    './assets/ui/ops1940/ops1940-selector-knob-square.webp',
    './assets/ui/ops1940/ops1940-switch-base-square.webp',
    './assets/ui/ops1940/ops1940-switch-lever-down.webp',
    './assets/ui/ops1940/ops1940-switch-lever-up.webp',
    './assets/ui/ops1940/ops1940-switchgear-atlas.webp',
    './assets/ui/ops1940/ops1940-texture-atlas.webp',
    './media-player.css',
    './media-player-ipod.js',
    './vendor/suncalc/suncalc.js',
    './media-player-watch-face.js',
    './clock-skins.js',
    './media-player-watch.js',
    './media-player-ui.js',
    './media-player-client.js',
    './settings-toolroll.css',
    './assets/ui/settings/roll-head-suede-v2.webp',
    './assets/ui/settings/roll-body-suede-v2.webp',
    './assets/ui/logbook/closed-tall-v2.webp',
    './assets/ui/logbook/open.webp',
    './ga-tracker-client/efb-fonts/Caveat-SemiBold.ttf',
    './app.js',
    './taws.js',
    './ga-tracker-client/tracker-audio-player.js',
    './ga-tracker-client/tracker-audio-client.js',
    './navigation-warning-audio.js',
    './navigation-warning-core.js',
    './map-prediction.js',
    './map-navigation-geometry.js',
    './mission-airport-information-core.js',
    './mission-airport-information-browser.js',
    './mission-environment-core.js',
    './mission-environment-browser.js',
    './mission-bush-narrative-core.js',
    './mission-bush-narrative-browser.js',
    './navigation-warning-presentation.js',
    './map-live-presentation.js',
    './map-profile-controls.js',
    './navcom-preferences-core.js',
    './navcom-preferences-client.js',
    './display-clock.js',
    './map-display-controls.js',
    './map-favorite-airports.js',
    './radio-tuning-core.js',
    './radio-tuning-ui.js',
    './airport-radio.js',
    './airport-details.js',
    './airport-aip.js',
    './airport-weather.js',
    './map-airport-popup.js',
    './map-drawing.js',
    './map-single-click.js',
    './map-context-popup.js',

    './map-direct-to-core.js',
    './map-navigation-client.js',
    './map-route-edit-core.js',
    './freeflight-navigation-core.js',
    './map-navpoint-core.js',
    './map-layer-controls.js',
    './map-tool-focus.js',
    './map-autozoom.js',
    './map-zoom-control.js',
    './map-terrain-avoid.js',
    './pax-audio-style.js',
    './mission-training-guidance-ui.js',
    './mission-private-outing-core.js',
    './mission-private-episode-v6.js',
    './mission-poi-briefing-shared-core.js',
    './mission-poi-briefing-shared-browser.js',
    './mission-news-briefing-core.js',
    './mission-news-briefing-browser.js',
    './mission-infra-briefing-core.js',
    './mission-infra-briefing-browser.js',
    './mission-bio-briefing-core.js',
    './mission-bio-briefing-browser.js',
    './mission-poi-followup-narrative-core.js',
    './mission-mapping-briefing-core.js',
    './mission-mapping-briefing-browser.js',
    './mission-chain-briefing-core.js',
    './mission-chain-briefing-browser.js',
    './mission-knowledge-briefing-core.js',
    './mission-knowledge-briefing-browser.js',
    './mission-fire-briefing-core.js',
    './mission-fire-scene-core.js',
    './mission-fire-briefing-browser.js',
    './mission-sar-search-core.js',
    './mission-sar-scene-core.js',
    './mission-sar-briefing-core.js',
    './mission-sar-briefing-browser.js',
    './mission-geo-briefing-core.js',
    './mission-geo-briefing-browser.js',
    './mission-route-voice-core.js',
    './mission-club-ideas-core.js',
    './mission-club-events-core.js',
    './mission-club-browser.js',
    './mission-charter-continuation-core.js',
    './mission-charter-ideas-core.js',
    './mission-charter-browser.js',
    './mission-poi-briefing-core.js',
    './mission-poi-briefing-browser.js',
    './mission-cargo-ideas-core.js',
    './mission-cargo-browser.js',
    './mission-fragile-cargo-ideas-core.js',
    './mission-fragile-cargo-browser.js',
    './mission-apt-news-ideas-core.js',
    './mission-apt-news-browser.js',
    './mission-medical-transfer-ideas-core.js',
    './mission-animal-transport-ideas-core.js',
    './mission-medical-transfer-browser.js',
    './mission-animal-transport-browser.js',
    './mission-sightseeing-context-core.js',
    './mission-sightseeing-ideas-core.js',
    './mission-sightseeing-browser.js',
    './mission-private-return-core.js',
    './mission-private-context-core.js',
    './mission-definition-core.js',
    './mission-variety-core.js',
    './mission-arrival-core.js',
    './mission-location-core.js',
    './relay-compression-core.js',
    './relay-failover-core.js',
    './aircraft-mission-capability-core.js',
    './aircraft-mission-profile-core.js',
    './ga-tracker-client/mission-scene-group-core.js',
    './mission-storage-core.js',
    './mission-draft-core.js',
    './cloud-sync-core.js',
    './cloud-sync-client.js',
    './mission-cloud-control-core.js',
    './mission-logbook-record-core.js',
    './sync.js',
    './homebase-capability-retry-core.js',
    './homebase-scene-core.js',
    './homebase-integration.js',
    './homebase-integration.css',
    './assets/ui/homebase/blueprint-09-27.webp',
    './assets/ui/homebase/pocket.webp',
    './homebase/index.html',
    './homebase/homebase-workbench.js',
    './homebase/homebase-workbench.css',
    './homebase/homebase-asset-catalog.js',
    './mission-runtime-core.js',
    './mission-transfer-core.js',
    './mission-resume-adapters-core.js',
    './mission-manifest-core.js',
    './mission-start-core.js',
    './mission-boarding-voice-core.js',
    './mission-precipitation-core.js',
    './mission-weather-preset-core.js',
    './mission-flight-recorder-core.js',
    './mission-farewell-voice-core.js',
    './mission-apt-ui-core.js',
    './mission-poi-ui-core.js',
    './ga-tracker-client/mission-control-ui-core.js',
    './mission-payload-core.js',
    './mission-compliance-domain-core.js',
    './mission-bush-execution-core.js',
    './mission-execution-core.js',
    './mission-execution-shadow-journal.js',
    './mission-cargo-core.js',
    './mission-compliance-core.js',
    './mission-infra-outcome-core.js',
    './mission-legacy-charter-narrative-core.js',
    './mission-followup.js',
    './mission-fire-search-map.js',
    './mission-resume-zone-map.js',
    './mission-survey-pattern.js',
    './mission-training-procedure.js',
    './mission-poi-chain.js',
    './mission-poi-chain-runtime.js',
    './data/mission-scene-assets.js',
    './data/mission-animal-scene-assets.js',
    './data/mission-homebase-scene-assets.js',
    './data/mission-cargo-assets.js',
    './mission-cargo-visual-core.js',
    './mission-reporter-scene-core.js',
    './checklists.js',
    './sim-route.js',
    './sim-manual-flight.js',
    './profile.js',
    './airport-type-filter.js',
    './aviation-data-hosted.js',
    './map.js',
    './map-vector-basemaps.js',
    './vendor/maplibre/maplibre-gl.js',
    './vendor/maplibre/maplibre-gl.css',
    './vendor/maplibre/leaflet-maplibre-gl.js',
    './map-utility-tools.js',
    './e6b/e6b-flight-computer.html',
    './e6b/e6b-flight-computer.css',
    './e6b/e6b-flight-computer.js',
    './e6b/e6b-core.js',
    './e6b/e6b-svg-compat.js',
    './e6b/e6b-workbench-front-disc.json',
    './e6b/e6b-workbench-wind-disc.json',
    './board.js',
    './crew-presence-core.js',
    './crew-presence-client.js',
    './crew-presence.css',
    './ppl-quiz.js',
    './ppl-quiz.css',
    './assets/ui/plane-side.svg',
    './flight-debrief.js',
    './flight-track-codec-core.js',
    './flight-logbook-view.js',
    './tutorial.js',
    './datenbank.js',
    './missions.js',
    './tracker-voice-client.js',
    './ga-tracker-client/tracker-cockpit-session-client.js',
    './mission-poi-task-core.js',
    './mission-poi-voice-core.js',
    './passenger-voice.js',
    './audio-cues/boarding_cargo.mp3',
    './audio-cues/boarding_pax.mp3',
    './audio-cues/boarding_pax1.mp3',
    './audio-cues/boarding_pax2.mp3',
    './audio-cues/deboarding_pax.mp3',
    './audio-cues/deboarding_pax1.mp3',
    './audio-cues/deboarding_pax2.mp3',
    './audio-cues/cargo_load.mp3',
    './audio-cues/cargo_load1.mp3',
    './audio-cues/cargo_load2.mp3',
    './audio-cues/cargo_pickup.mp3',
    './audio-cues/cargo_unload.mp3',
    './audio-cues/cargo_unload1.mp3',
    './audio-cues/cargo_unload2.mp3',
    './audio-cues/photo.mp3',
    './foto.mp3',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './favicon-light-64.png',
    './favicon-dark-64.png',
    './icon-dark-180.png',
    './vendor/leaflet/leaflet.css',
    './vendor/leaflet/leaflet.js',
    './vendor/leaflet/images/layers.png',
    './vendor/leaflet/images/layers-2x.png',
    './vendor/leaflet/images/marker-icon.png'
];

// API-Domains – immer vom Netz holen, nie cachen
const NETWORK_ONLY = [
    'ga-proxy.einherjer.workers.dev',
    'inherjer.github.io',
    'aviationweather.gov',
    'api.codetabs.com',
    'corsproxy.io',
    'api.allorigins.win',
    'api.open-meteo.com',
    'api.openai.com',
    'generativelanguage.googleapis.com',
    'overpass-api.de',
    'nominatim.openstreetmap.org',
    'opensky-network.org',
    'tile.openstreetmap.org',
    'tiles.openfreemap.org',
    'tiles.arcgis.com',
    'maps.dwd.de',
    'brz-maps.dwd.de',
    'mapservices.weather.noaa.gov',
    'www.paypal.com',
    'www.paypalobjects.com',
    'pics.paypal.com'
];

const NETWORK_FIRST_PATHS = [
    '/data/gafor-sector-dataset-de.json',
    '/data/ppl-quiz-catalog.json'
];

const APP_SHELL_NETWORK_FIRST_EXTENSIONS = ['.html', '.js', '.css'];

function isNetworkFirstRequest(url) {
    if (NETWORK_FIRST_PATHS.some(p => url.pathname.endsWith(p))) return true;
    if (url.origin !== self.location.origin) return false;
    if (url.pathname.endsWith('/')) return true;
    return APP_SHELL_NETWORK_FIRST_EXTENSIONS.some(ext => url.pathname.endsWith(ext));
}

// Only precached app files use the version cache. Query suffixes on script
// tags share the installed file; releases must bump CACHE when these change.
const APP_SHELL_URLS = new Set(STATIC.filter(path =>
    path.endsWith('/') || /\.(html|js|css)$/.test(path)
).map(path => new URL(path, self.location.href).href));

// ── Install: statische Dateien vorab cachen ──────────────────────────────────
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(STATIC)).then(() => self.skipWaiting())
    );
});

// ── Activate: alte Caches löschen ────────────────────────────────────────────
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE && k !== 'private-region.v1' && k !== 'ga-airport-information-v1').map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// ── Fetch: Cache-First für Statisches, Network-Only für APIs ─────────────────
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    // Network-Only für API-Calls
    const isLocalAppRequest = url.origin === self.location.origin
        && url.pathname.startsWith(new URL('./', self.location.href).pathname);
    if (!isLocalAppRequest && NETWORK_ONLY.some(d => url.hostname.includes(d))) return;

    // Leaflet-Kacheln immer live holen
    if (
        url.hostname.includes('tile.')
        || url.pathname.includes('/tiles/')
        || url.pathname.includes('/MapServer/tile/')
    ) return;

    const assetUrl = new URL(url.href);
    assetUrl.search = '';
    if (e.request.method === 'GET' && APP_SHELL_URLS.has(assetUrl.href)) {
        e.respondWith(caches.open(CACHE).then(async cache => {
            const cached = await cache.match(assetUrl.href);
            if (cached) return cached;
            const response = await fetch(e.request);
            if (response && response.status === 200) {
                await cache.put(assetUrl.href, response.clone());
            }
            return response;
        }));
        return;
    }

    // App-Shell und Daten bevorzugt frisch vom Netz holen (mit Cache-Fallback)
    if (isNetworkFirstRequest(url)) {
        e.respondWith(
            fetch(e.request).then(response => {
                if (response && response.status === 200 && e.request.method === 'GET') {
                    const clone = response.clone();
                    caches.open(CACHE).then(cache => cache.put(e.request, clone));
                }
                return response;
            }).catch(async () => {
                const cached = await caches.match(e.request);
                if (cached) return cached;
                throw new Error('dataset_unavailable_offline');
            })
        );
        return;
    }

    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;
            return fetch(e.request).then(response => {
                // Nur gültige GET-Responses cachen
                if (!response || response.status !== 200 || e.request.method !== 'GET') return response;
                const clone = response.clone();
                caches.open(CACHE).then(cache => cache.put(e.request, clone));
                return response;
            }).catch(() => cached); // Offline-Fallback: gecachte Version
        })
    );
});
