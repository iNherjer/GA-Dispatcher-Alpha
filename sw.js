// VFR Multitool – Service Worker
const CACHE = 'ga-dispatcher-v1259';

const STATIC = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './mission-definition-core.js',
    './mission-variety-core.js',
    './mission-arrival-core.js',
    './sync.js',
    './mission-runtime-core.js',
    './mission-cargo-core.js',
    './mission-infra-outcome-core.js',
    './mission-followup.js',
    './mission-survey-pattern.js',
    './mission-training-procedure.js',
    './mission-poi-chain.js',
    './mission-poi-chain-runtime.js',
    './data/mission-scene-assets.js',
    './checklists.js',
    './sim-route.js',
    './sim-manual-flight.js',
    './profile.js',
    './map.js',
    './board.js',
    './tutorial.js',
    './datenbank.js',
    './missions.js',
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
    './Icon.PNG',
    './IconDRK.PNG',
    './vendor/leaflet/leaflet.css',
    './vendor/leaflet/leaflet.js',
    './vendor/leaflet/images/layers.png',
    './vendor/leaflet/images/layers-2x.png',
    './vendor/leaflet/images/marker-icon.png'
];

// API-Domains – immer vom Netz holen, nie cachen
const NETWORK_ONLY = [
    'ga-proxy.einherjer.workers.dev',
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
    'tiles.arcgis.com',
    'maps.dwd.de',
    'brz-maps.dwd.de',
    'mapservices.weather.noaa.gov'
];

const NETWORK_FIRST_PATHS = [
    '/data/gafor-sector-dataset-de.json'
];

const APP_SHELL_NETWORK_FIRST_EXTENSIONS = ['.html', '.js', '.css'];

function isNetworkFirstRequest(url) {
    if (NETWORK_FIRST_PATHS.some(p => url.pathname.endsWith(p))) return true;
    if (url.origin !== self.location.origin) return false;
    if (url.pathname.endsWith('/')) return true;
    return APP_SHELL_NETWORK_FIRST_EXTENSIONS.some(ext => url.pathname.endsWith(ext));
}

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
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// ── Fetch: Cache-First für Statisches, Network-Only für APIs ─────────────────
self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    // Network-Only für API-Calls
    if (NETWORK_ONLY.some(d => url.hostname.includes(d))) return;

    // Leaflet-Kacheln immer live holen
    if (
        url.hostname.includes('tile.')
        || url.pathname.includes('/tiles/')
        || url.pathname.includes('/MapServer/tile/')
    ) return;

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
