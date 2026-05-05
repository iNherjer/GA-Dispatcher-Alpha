/* === MAP, ROUTING & LEAFLET ENGINE === */
if (!document.getElementById('route-anim-style')) {
    const style = document.createElement('style');
    style.id = 'route-anim-style';
    // -20 lässt die Striche der Linie vorwärts (Richtung Ziel) fließen
    style.innerHTML = `
        @keyframes routeDashAnim { to { stroke-dashoffset: -20; } }
        .animated-route-line { animation: routeDashAnim 1.5s linear infinite; }
        .low-fps-mode .animated-route-line { animation: none !important; stroke-dasharray: none !important; }
        .low-fps-mode .live-plane-marker .live-plane-inner { filter: none !important; }
    `;
    document.head.appendChild(style);
}
/* =========================================================
   7. KARTE (LEAFLET, KARTENTISCH & MESS-WERKZEUG)
   ========================================================= */
const hitBoxHtml = (color) => `<div class="pin-hitbox"><div class="pin-dot" style="background-color: ${color};"></div></div>`;
const hitBoxIcon = (color) => L.divIcon({ className: 'custom-pin', html: hitBoxHtml(color), iconSize: [34, 34], iconAnchor: [17, 17] });

const startIcon = hitBoxIcon('#44ff44'), destIcon = hitBoxIcon('#ff4444');
const wpIcon = L.divIcon({ className: 'custom-pin', html: `<div class="pin-hitbox" style="cursor: move;"><div class="pin-dot" style="background-color: #fdfd86;"></div></div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
const poiIcon = L.divIcon({ className: 'custom-pin', html: `<div class="pin-hitbox" style="cursor: move;"><div class="pin-dot" style="background-color: #b266ff; border: 2px solid #fff;"></div></div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
const measureIcon = L.divIcon({ className: 'custom-pin', html: `<div class="pin-hitbox" style="cursor: move;"><div class="pin-dot" style="background-color: #fff; width: 12px; height: 12px; min-width: 12px; min-height: 12px;"></div></div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
let routeLegLabelMarkers = [];
const AIP_POPUP_ROUTES = {
    AT: '/at/en/vfr/',
    DE: '/de/en/vfr/',
    FR: '/fr/aeroports/',
    GB: '/uk/vfr/',
    NL: '/nl/en/vfr/'
};
const MAP_HINT_DEFAULTS = {
    magentaLine: true,
    weather: true,
    windBarbs: true,
    cloudFields: true,
    vfrIndex: false,
    terrainAvoid: false,
    traffic: true,
    telemetry: true,
    nextLeg: true,
    compass: true,
    lowFps: false
};
window.mapHints = window.mapHints || { ...MAP_HINT_DEFAULTS };
const MAP_HINT_SUBMENU_DEFAULTS = {
    vfrIndexMenu: false,
    terrainAvoidMenu: false
};
window.mapHintSubmenus = window.mapHintSubmenus || { ...MAP_HINT_SUBMENU_DEFAULTS };
const VP_VFR_INDEX_MIN_UPDATE_MS = 15 * 60 * 1000;
const VP_VFR_INDEX_MAX_POINTS = 72;
const VP_VFR_INDEX_MIN_VISIBLE_ZOOM = 8;
const VP_VFR_AMPEL_MODE_DEFAULT = 'sun';
const VP_GAFOR_REF_TERRAIN_Z = 10;
const VP_GAFOR_REF_MAX_SAMPLES = 1400;
const VP_GAFOR_REF_CACHE_MAX = 420;
const VP_MOSMIX_PROXY_URL = 'https://ga-proxy.einherjer.workers.dev/api/mosmix';
const VP_MOSMIX_ACTIVE_COUNTRIES = new Set(['DE']);
const VP_GAFOR_SECTOR_MODE_COUNTRIES = new Set(['DE']);
const VP_GAFOR_SECTOR_GRID_DE = {
    latEdges: [47.2, 48.4, 49.6, 50.8, 52.0, 53.2, 54.2, 55.2],
    lonEdges: [5.3, 7.5, 9.7, 11.9, 13.7, 15.6],
    idsSouthToNorth: [
        ['50', '61', '62', '73', '75'],
        ['44', '45', '53', '56', '64'],
        ['34', '36', '24', '25', '26'],
        ['32', '33', '20', '22', '23'],
        ['07', '08', '15', '17', '18'],
        ['05', '06', '11', '13', '14'],
        ['02', '03', '04', '12', '16']
    ]
};
const VP_GAFOR_SECTOR_NODE_WARP_DE = {
    lat: [
        [0.10, 0.06, 0.03, 0.02, 0.04, 0.07],
        [0.08, 0.04, 0.02, 0.00, 0.02, 0.05],
        [0.04, 0.02, 0.00, -0.02, -0.01, 0.03],
        [0.03, 0.01, -0.01, -0.03, -0.02, 0.01],
        [0.02, 0.00, -0.02, -0.04, -0.03, 0.00],
        [0.00, -0.02, -0.04, -0.05, -0.03, -0.01],
        [-0.10, -0.06, -0.03, -0.01, -0.02, -0.08],
        [-0.24, -0.17, -0.09, -0.03, -0.05, -0.20]
    ],
    lon: [
        [-0.16, -0.14, -0.07, 0.00, 0.08, 0.20],
        [-0.18, -0.12, -0.06, 0.01, 0.09, 0.21],
        [-0.15, -0.10, -0.04, 0.03, 0.10, 0.20],
        [-0.12, -0.08, -0.01, 0.05, 0.10, 0.16],
        [-0.10, -0.06, 0.00, 0.05, 0.09, 0.14],
        [-0.10, -0.07, -0.01, 0.04, 0.08, 0.12],
        [-0.14, -0.10, -0.04, 0.02, 0.07, 0.10],
        [-0.18, -0.14, -0.06, 0.02, 0.09, 0.12]
    ]
};
const VP_GAFOR_SECTOR_META_DE = {
    '02': { name: 'Nordfriesland-Dithmarschen', refFt: 100 },
    '03': { name: 'Schleswig-Holsteinische Geest', refFt: 200 },
    '04': { name: 'Schleswig-Holsteinisches Huegelland', refFt: 300 },
    '05': { name: 'Nordwestliches Niedersachsen', refFt: 200 },
    '06': { name: 'Lueneburger Heide', refFt: 400 },
    '07': { name: 'Westliches Niedersachsen', refFt: 300 },
    '08': { name: 'Hannover und Braunschweig', refFt: 600 },
    '11': { name: 'Mecklenburgisches Tiefland', refFt: 300 },
    '12': { name: 'Vorpommern', refFt: 200 },
    '13': { name: 'Westliche Meckl. Seenplatte und Prignitz', refFt: 400 },
    '14': { name: 'Oestliche Meckl. Seenplatte und Uckermark', refFt: 400 },
    '15': { name: 'Altmark', refFt: 400 },
    '16': { name: 'Flaeming', refFt: 600 },
    '17': { name: 'Havelland', refFt: 300 },
    '18': { name: 'Barnim und Oderbruch', refFt: 400 },
    '20': { name: 'Magdeburger Boerde und noerdl. Harzvorland', refFt: 700 },
    '22': { name: 'Leipziger Tieflandsbucht/Elbe-Elster', refFt: 600 },
    '23': { name: 'Niederlausitzer Heiden', refFt: 600 },
    '24': { name: 'Thueringer Becken', refFt: 1400 },
    '25': { name: 'Mittelsaechsisches Huegelland', refFt: 1300 },
    '26': { name: 'Oberlausitz und Lausitzer Gebirge', refFt: 1500 },
    '32': { name: 'Muensterland', refFt: 500 },
    '33': { name: 'Ruhrgebiet und Ostwestfalen', refFt: 800 },
    '34': { name: 'Niederrheinische Bucht', refFt: 700 },
    '36': { name: 'Sauerland', refFt: 2400 },
    '44': { name: 'Rheinpfalz und Saarland', refFt: 1900 },
    '45': { name: 'Rhein-Main Gebiet und Wetterau', refFt: 800 },
    '50': { name: 'Suedlicher Oberrheingraben', refFt: 1100 },
    '53': { name: 'Oberer/mittlerer Neckarraum', refFt: 1700 },
    '56': { name: 'Mittelfranken', refFt: 1700 },
    '61': { name: 'Schwarzwald', refFt: 4000 },
    '62': { name: 'Schwaebische Alb', refFt: 3000 },
    '64': { name: 'Oberpfaelzer Wald', refFt: 2400 },
    '73': { name: 'Westliche Donauniederung', refFt: 1700 },
    '75': { name: 'Oestliche Donau-/Naabniederung', refFt: 1600 }
};
const VP_VFR_MODEL_META = {
    internal: {
        label: 'Intern (multi-factor)',
        summary: 'Nutzt zusaetzlich Wind, Niederschlag und Wettercode.',
        pros: 'Sensitiver bei riskantem Flugwetter.',
        cons: 'Kann konservativer als offizieller GAFOR sein.'
    },
    gafor_like: {
        label: 'GAFOR-aehnlich',
        summary: 'Nutzt primaer Sicht + Wolkenbasis.',
        pros: 'Besser mit GAFOR-Logik vergleichbar.',
        cons: 'Keine amtliche GAFOR-Quelle, nur modellbasierte Naeherung.'
    },
    gafor_sector: {
        label: 'GAFOR-Sektor (DE, beta)',
        summary: 'Eigene grobe DE-Sektoren mit fixer Bezugshoehe je Gebiet.',
        pros: 'Naeher an sektorbasiertem GAFOR-Verhalten, worker-schonend.',
        cons: 'Polygone vereinfacht, weiterhin keine amtliche GAFOR-Quelle.'
    }
};
const VP_VFR_INDEX_COUNTRIES = [
    { code: 'DE', name: 'Deutschland' },
    { code: 'AT', name: 'Oesterreich' },
    { code: 'CH', name: 'Schweiz' },
    { code: 'FR', name: 'Frankreich' },
    { code: 'IT', name: 'Italien' },
    { code: 'ES', name: 'Spanien' },
    { code: 'PT', name: 'Portugal' },
    { code: 'NL', name: 'Niederlande' },
    { code: 'BE', name: 'Belgien' },
    { code: 'DK', name: 'Daenemark' },
    { code: 'PL', name: 'Polen' },
    { code: 'CZ', name: 'Tschechien' },
    { code: 'SK', name: 'Slowakei' },
    { code: 'HU', name: 'Ungarn' },
    { code: 'SI', name: 'Slowenien' },
    { code: 'HR', name: 'Kroatien' },
    { code: 'RO', name: 'Rumaenien' },
    { code: 'BG', name: 'Bulgarien' },
    { code: 'GR', name: 'Griechenland' },
    { code: 'SE', name: 'Schweden' },
    { code: 'NO', name: 'Norwegen' },
    { code: 'FI', name: 'Finnland' },
    { code: 'IE', name: 'Irland' },
    { code: 'GB', name: 'Grossbritannien' },
    { code: 'IS', name: 'Island' }
];
const VP_VFR_COUNTRY_FALLBACK_BOUNDS = {
    DE: { minLat: 47.2, maxLat: 55.2, minLon: 5.3, maxLon: 15.6 },
    AT: { minLat: 46.2, maxLat: 49.1, minLon: 9.4, maxLon: 17.3 },
    CH: { minLat: 45.7, maxLat: 47.9, minLon: 5.8, maxLon: 10.7 },
    FR: { minLat: 42.0, maxLat: 51.2, minLon: -5.8, maxLon: 8.7 },
    IT: { minLat: 36.5, maxLat: 47.2, minLon: 6.1, maxLon: 18.7 },
    ES: { minLat: 36.0, maxLat: 43.9, minLon: -9.5, maxLon: 3.6 },
    PT: { minLat: 36.8, maxLat: 42.3, minLon: -9.6, maxLon: -6.0 },
    NL: { minLat: 50.7, maxLat: 53.8, minLon: 3.2, maxLon: 7.3 },
    BE: { minLat: 49.4, maxLat: 51.8, minLon: 2.4, maxLon: 6.4 },
    DK: { minLat: 54.4, maxLat: 57.9, minLon: 8.0, maxLon: 12.8 },
    PL: { minLat: 48.8, maxLat: 54.9, minLon: 14.0, maxLon: 24.4 },
    CZ: { minLat: 48.4, maxLat: 51.2, minLon: 12.0, maxLon: 18.9 },
    SK: { minLat: 47.7, maxLat: 49.7, minLon: 16.8, maxLon: 22.8 },
    HU: { minLat: 45.7, maxLat: 48.7, minLon: 16.0, maxLon: 22.9 },
    SI: { minLat: 45.3, maxLat: 46.9, minLon: 13.2, maxLon: 16.7 },
    HR: { minLat: 42.3, maxLat: 46.7, minLon: 13.4, maxLon: 19.4 },
    RO: { minLat: 43.6, maxLat: 48.4, minLon: 20.1, maxLon: 29.8 },
    BG: { minLat: 41.1, maxLat: 44.3, minLon: 22.3, maxLon: 28.8 },
    GR: { minLat: 34.7, maxLat: 41.9, minLon: 19.3, maxLon: 28.3 },
    SE: { minLat: 55.1, maxLat: 69.2, minLon: 11.0, maxLon: 24.3 },
    NO: { minLat: 57.8, maxLat: 71.5, minLon: 4.0, maxLon: 31.5 },
    FI: { minLat: 59.5, maxLat: 70.2, minLon: 19.0, maxLon: 31.8 },
    IE: { minLat: 51.3, maxLat: 55.5, minLon: -10.8, maxLon: -5.2 },
    GB: { minLat: 49.8, maxLat: 59.3, minLon: -8.8, maxLon: 2.1 },
    IS: { minLat: 63.1, maxLat: 66.7, minLon: -24.8, maxLon: -13.0 }
};
const vpVfrCountryBoundsCache = new Map();
const vpGaforSectorRefCache = new Map();
let vpVfrIndexLayer = null;
const vpVfrIndexState = {
    selectedCountry: localStorage.getItem('ga_vfr_index_country') || 'auto',
    vfrModel: localStorage.getItem('ga_vfr_index_model') || 'internal',
    showSectorAmpel: localStorage.getItem('ga_vfr_sector_ampel') !== 'false',
    ampelWindowMode: localStorage.getItem('ga_vfr_ampel_window_mode') || VP_VFR_AMPEL_MODE_DEFAULT,
    plannedCountry: '',
    activeCountry: '',
    inFlight: false,
    lastFetchAtByCountry: {},
    lastUpdatedAt: 0,
    lastPointCount: 0,
    lastError: '',
    timeline: null,
    lastRenderedSamples: [],
    lastRenderedSectors: [],
    lastRenderMode: 'grid',
    lastGridLatStep: 0.4,
    lastGridLonStep: 0.4
};
let vpVfrAutoTimer = null;
let vpVfrOverlayTimer = null;
let vpVfrOverlayScheduledForce = false;
let vpObsTileDebugLayer = null;
window.vpObsTileOverlayEnabled = localStorage.getItem('ga_debug_obs_tile_overlay') === 'true';
const VP_OBS_TILE_USED_RECENT_MS = 5 * 60 * 1000;
window.vpObsTileLoadingKeys = window.vpObsTileLoadingKeys || new Set();
window.vpObsTileDeferredKeys = window.vpObsTileDeferredKeys || new Set();
const TERRAIN_AVOID_WARN_DEFAULT_FT = 900;
const TERRAIN_AVOID_SAFE_DEFAULT_FT = 2200;
const TERRAIN_AVOID_WARN_MIN_FT = 0;
const TERRAIN_AVOID_WARN_MAX_FT = 3000;
const TERRAIN_AVOID_SAFE_MIN_FT = 0;
const TERRAIN_AVOID_SAFE_MAX_FT = 5000;
const TERRAIN_AVOID_MIN_UPDATE_MS = 1000;
const TERRAIN_AVOID_STALE_GPS_MS = 30000;
const TERRAIN_AVOID_TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const TERRAIN_AVOID_SOURCE_MAX_Z = 13;
const TERRAIN_AVOID_TILE_CACHE_MAX = 180;
const TERRAIN_AVOID_RENDER_TILE_CACHE_MAX = 280;
const TERRAIN_AVOID_MIN_ALT_DELTA_FT = 18;
let terrainAvoidOverlayLayer = null;
let terrainAvoidRefreshTimer = null;
let terrainAvoidLastRenderAt = 0;
let terrainAvoidLastRenderAltFt = null;
let terrainAvoidWarnFt = TERRAIN_AVOID_WARN_DEFAULT_FT;
let terrainAvoidSafeFt = TERRAIN_AVOID_SAFE_DEFAULT_FT;
let terrainAvoidWasAirborne = false;
let terrainAvoidPausedReason = '';
const terrainAvoidTileCache = new Map();
const terrainAvoidTileInFlightCache = new Map();
const terrainAvoidRenderedTileCache = new Map();

function updateObsTileOverlayButtonUi() {
    const btn = document.getElementById('btnToggleObsTileOverlay');
    if (!btn) return;
    const on = !!window.vpObsTileOverlayEnabled;
    btn.textContent = `Tiles Overlay ${on ? 'An' : 'Aus'}`;
    btn.style.background = on ? '#245a8f' : '#1b334a';
    btn.style.borderColor = on ? '#5ea8ff' : '#3a6388';
    btn.style.color = on ? '#dff0ff' : '#9fd0ff';
}
window.vpUpdateObsTileOverlayButtonUi = updateObsTileOverlayButtonUi;

function getObsTileDebugConfig() {
    const cfg = window.vpObsTileConfig || {};
    return {
        storageKey: cfg.storageKey || 'ga_obs_tile_cov_v1',
        stepLat: Number(cfg.stepLat || 0.25),
        stepLon: Number(cfg.stepLon || 0.25)
    };
}

function getObsTileFailDebugConfig() {
    const cfg = window.vpObsTileFailConfig || {};
    return {
        storageKey: cfg.storageKey || 'ga_obs_tile_failed_v1'
    };
}

function parseObsTileCoverageEntries() {
    const cfg = getObsTileDebugConfig();
    try {
        const raw = localStorage.getItem(cfg.storageKey);
        const parsed = JSON.parse(raw || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function parseObsTileFailedEntries() {
    const cfg = getObsTileFailDebugConfig();
    try {
        const raw = localStorage.getItem(cfg.storageKey);
        const parsed = JSON.parse(raw || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function tileBoundsFromKey(key, stepLat, stepLon) {
    const parts = String(key || '').split('|');
    if (parts.length < 2) return null;
    const latI = Number(parts[0]);
    const lonI = Number(parts[1]);
    if (!Number.isFinite(latI) || !Number.isFinite(lonI)) return null;
    const south = (latI * stepLat) - 90;
    const west = (lonI * stepLon) - 180;
    return {
        south,
        west,
        north: south + stepLat,
        east: west + stepLon
    };
}

function addSplitStripeOverlay(layerGroup, b, color = '#ffd400') {
    if (!layerGroup || !b) return;
    const h = Number(b.north) - Number(b.south);
    const w = Number(b.east) - Number(b.west);
    if (!(h > 0) || !(w > 0)) return;
    const stripes = [0.16, 0.34, 0.52, 0.70, 0.88];
    for (const f of stripes) {
        const latA = b.south + (h * Math.max(0, Math.min(1, f - 0.22)));
        const lonA = b.west + (w * Math.max(0, Math.min(1, f - 0.22)));
        const latB = b.south + (h * Math.max(0, Math.min(1, f + 0.22)));
        const lonB = b.west + (w * Math.max(0, Math.min(1, f + 0.22)));
        L.polyline([[latA, lonA], [latB, lonB]], {
            color,
            weight: 3,
            opacity: 0.95,
            dashArray: '8,5',
            interactive: false
        }).addTo(layerGroup);
    }
}

function renderObsTileOverlay() {
    if (!map) return;
    if (!vpObsTileDebugLayer) vpObsTileDebugLayer = L.layerGroup();
    vpObsTileDebugLayer.clearLayers();
    if (!window.vpObsTileOverlayEnabled) {
        if (map.hasLayer(vpObsTileDebugLayer)) map.removeLayer(vpObsTileDebugLayer);
        return;
    }

    const cfg = getObsTileDebugConfig();
    const entries = parseObsTileCoverageEntries();
    const entryByKey = new Map();
    for (const item of entries) {
        const key = item && item.k;
        if (typeof key !== 'string' || !key) continue;
        entryByKey.set(key, item);
    }
    const failedEntries = parseObsTileFailedEntries();
    const failedByKey = new Map();
    for (const item of failedEntries) {
        const key = item && item.k;
        if (typeof key !== 'string' || !key) continue;
        failedByKey.set(key, item);
    }
    const now = Date.now();
    const loadingKeys = (window.vpObsTileLoadingKeys instanceof Set) ? window.vpObsTileLoadingKeys : new Set();
    const deferredKeys = (window.vpObsTileDeferredKeys instanceof Set) ? window.vpObsTileDeferredKeys : new Set();
    const bounds = map.getBounds().pad(0.35);
    const mergedKeys = new Set();
    entries.forEach(item => { if (item && item.k) mergedKeys.add(item.k); });
    failedEntries.forEach(item => { if (item && item.k) mergedKeys.add(item.k); });
    loadingKeys.forEach(k => { if (k) mergedKeys.add(k); });
    deferredKeys.forEach(k => { if (k) mergedKeys.add(k); });
    for (const key of mergedKeys) {
        const item = entryByKey.get(key) || { k: key };
        const b = tileBoundsFromKey(key, cfg.stepLat, cfg.stepLon);
        if (!b) continue;
        if (b.east < bounds.getWest() || b.west > bounds.getEast() || b.north < bounds.getSouth() || b.south > bounds.getNorth()) continue;
        const loadedTs = Number((item && item.ts) || 0);
        const usedTs = Number((item && item.usedTs) || 0);
        const src = String((item && item.src) || '').toLowerCase();
        const failMeta = failedByKey.get(key);
        const failedTs = Number((failMeta && failMeta.ts) || 0);
        const isLoading = loadingKeys.has(key);
        const isDeferred = deferredKeys.has(key);
        const wasUsed = usedTs > 0 && (now - usedTs) <= VP_OBS_TILE_USED_RECENT_MS;
        const hasFailure = failedTs > 0 && (!loadedTs || failedTs >= loadedTs);
        const isHostedTile = src.includes('hosted') || src.includes('github');
        const isCoreTile = src.includes('core');
        const wantsMagentaStripe = isHostedTile || isCoreTile;
        const color = isLoading
            ? '#ff9a3d'
            : (hasFailure ? '#b71c1c' : (isDeferred ? '#ffd54f' : (wantsMagentaStripe ? '#d500f9' : (wasUsed ? '#4fcd73' : '#4da2ff'))));
        const fillOpacity = isLoading ? 0.26 : (hasFailure ? 0.28 : (isDeferred ? 0.22 : (wantsMagentaStripe ? 0.2 : (wasUsed ? 0.14 : 0.1))));
        const strokeWeight = isLoading ? 2 : (hasFailure ? 2 : (isDeferred ? 2 : 1));
        const rect = L.rectangle([[b.south, b.west], [b.north, b.east]], {
            color,
            weight: strokeWeight,
            fillColor: color,
            fillOpacity,
            interactive: false
        });
        rect.addTo(vpObsTileDebugLayer);
        if (!isLoading && !hasFailure && wantsMagentaStripe) {
            addSplitStripeOverlay(vpObsTileDebugLayer, b, '#ffd400');
        }
    }
    if (!map.hasLayer(vpObsTileDebugLayer)) vpObsTileDebugLayer.addTo(map);
}
window.vpRenderObsTileOverlay = renderObsTileOverlay;
window.vpNotifyObsTileCoverageChanged = function() {
    if (window.vpObsTileOverlayEnabled) renderObsTileOverlay();
};
window.vpSetObsTileLoading = function(tileKey, isLoading) {
    if (typeof tileKey !== 'string' || !tileKey) return;
    if (!(window.vpObsTileLoadingKeys instanceof Set)) window.vpObsTileLoadingKeys = new Set();
    if (isLoading) window.vpObsTileLoadingKeys.add(tileKey);
    else window.vpObsTileLoadingKeys.delete(tileKey);
    if (window.vpObsTileOverlayEnabled) renderObsTileOverlay();
};
window.vpSetObsTileDeferred = function(tileKeys, isDeferred) {
    if (!(window.vpObsTileDeferredKeys instanceof Set)) window.vpObsTileDeferredKeys = new Set();
    if (tileKeys === '__RESET__') {
        window.vpObsTileDeferredKeys.clear();
        if (window.vpObsTileOverlayEnabled) renderObsTileOverlay();
        return;
    }
    const keys = Array.isArray(tileKeys) ? tileKeys : [tileKeys];
    for (const key of keys) {
        if (typeof key !== 'string' || !key) continue;
        if (isDeferred) window.vpObsTileDeferredKeys.add(key);
        else window.vpObsTileDeferredKeys.delete(key);
    }
    if (window.vpObsTileOverlayEnabled) renderObsTileOverlay();
};

window.vpToggleObsTileOverlay = function(forceState) {
    const next = (typeof forceState === 'boolean') ? forceState : !window.vpObsTileOverlayEnabled;
    window.vpObsTileOverlayEnabled = !!next;
    localStorage.setItem('ga_debug_obs_tile_overlay', String(window.vpObsTileOverlayEnabled));
    updateObsTileOverlayButtonUi();
    renderObsTileOverlay();
};

window.addEventListener('storage', function(e) {
    if (!e || (e.key !== 'ga_obs_tile_cov_v1' && e.key !== 'ga_obs_tile_failed_v1')) return;
    if (window.vpObsTileOverlayEnabled) renderObsTileOverlay();
});

function loadMapHintSettings() {
    Object.keys(MAP_HINT_DEFAULTS).forEach(key => {
        const saved = localStorage.getItem(`ga_map_hint_${key}`);
        if (saved === null) window.mapHints[key] = MAP_HINT_DEFAULTS[key];
        else window.mapHints[key] = saved !== 'false';
    });
    // Wetter-/Traffic-Flags mit bestehenden Zuständen synchronisieren
    if (typeof window.vpShowMapMetar === 'boolean') window.mapHints.weather = window.vpShowMapMetar;
    if (typeof window.vpTrafficMapVisible === 'boolean') window.mapHints.traffic = window.vpTrafficMapVisible;
}

function saveMapHintSetting(key) {
    if (!(key in MAP_HINT_DEFAULTS)) return;
    localStorage.setItem(`ga_map_hint_${key}`, String(Boolean(window.mapHints[key])));
}

window.isMapHintEnabled = function(key) {
    if (!(key in MAP_HINT_DEFAULTS)) return true;
    return window.mapHints[key] !== false;
};

window.isLowFpsMode = function() {
    return window.isMapHintEnabled('lowFps');
};

function applyLowFpsModeUi() {
    const on = window.isLowFpsMode();
    document.body.classList.toggle('low-fps-mode', on);
    if (typeof polyline !== 'undefined' && polyline && typeof polyline.setStyle === 'function') {
        polyline.setStyle({ dashArray: on ? null : '10,10' });
    }
    if (typeof window.updateLivePlanePerformanceMode === 'function') {
        window.updateLivePlanePerformanceMode(on);
    }
}

function applyMapHintEffects(key) {
    if (key === 'weather') {
        window.vpShowMapMetar = window.mapHints.weather !== false;
        localStorage.setItem('ga_show_map_metar', window.vpShowMapMetar);
        if (typeof renderWeatherMarkers === 'function') renderWeatherMarkers();
        if (typeof window.scheduleMapWeatherOverlayUpdate === 'function') window.scheduleMapWeatherOverlayUpdate(true);
    }
    if (key === 'vfrIndex') {
        if (window.mapHints.vfrIndex === false) {
            vpClearVfrLayer();
            vpVfrIndexState.timeline = null;
        } else vpScheduleVfrOverlayUpdate(false);
        vpUpdateVfrUi();
    }
    if (key === 'terrainAvoid') {
        if (typeof window.setTerrainAvoidOverlayEnabled === 'function') {
            window.setTerrainAvoidOverlayEnabled(window.mapHints.terrainAvoid !== false, { skipPersist: true, silent: true });
        }
    }
    if (key === 'windBarbs' || key === 'cloudFields') {
        // Sofortige visuelle Reaktion ohne zusätzlichen Quellen-Toggle.
        if (typeof renderWeatherMarkers === 'function') renderWeatherMarkers();
        if (typeof clearMapOpenMeteoOverlays === 'function') clearMapOpenMeteoOverlays();
        wxOverlayLastKey = '';
        wxOverlayLastFetchAt = 0;
        if (wxOverlayFetchTimer) {
            clearTimeout(wxOverlayFetchTimer);
            wxOverlayFetchTimer = null;
        }
        if (typeof window.renderMapWeatherOverlays === 'function') window.renderMapWeatherOverlays(true);
    }
    if (key === 'traffic') {
        window.vpTrafficMapVisible = window.mapHints.traffic !== false;
        if (typeof window.applyTrafficVisibility === 'function') window.applyTrafficVisibility();
    }
    if (key === 'telemetry') {
        const box = document.getElementById('liveTelemetryBox');
        if (box) box.classList.toggle('tele-hint-off', !window.mapHints.telemetry);
    }
    if (key === 'nextLeg') {
        const box = document.getElementById('liveNextWpBox');
        if (box) box.classList.toggle('tele-hint-off', !window.mapHints.nextLeg);
    }
    if (key === 'compass') {
        const wrap = document.getElementById('compassRoseWrap');
        if (wrap) wrap.classList.toggle('compass-hint-off', !window.mapHints.compass);
    }
    if (key === 'magentaLine' && window.mapHints.magentaLine === false) {
        if (typeof window.clearLiveToWpLine === 'function') window.clearLiveToWpLine();
    }
    if (key === 'lowFps') {
        applyLowFpsModeUi();
    }
}

function setMapHintSubmenuOpen(key, open) {
    const ids = {
        vfrIndexMenu: { btn: 'btnToggleVfrIndexMenu', panel: 'vfrIndexMenuBlock', label: 'GAFOR / VFR-Index Optionen' },
        terrainAvoidMenu: { btn: 'btnToggleTerrainAvoidMenu', panel: 'terrainAvoidMenuBlock', label: 'Terrain Avoid Optionen' }
    };
    const meta = ids[key];
    if (!meta) return;
    const panel = document.getElementById(meta.panel);
    const btn = document.getElementById(meta.btn);
    const isOpen = !!open;
    if (window.mapHintSubmenus) window.mapHintSubmenus[key] = isOpen;
    if (panel) panel.style.display = isOpen ? 'block' : 'none';
    if (btn) {
        btn.textContent = `${isOpen ? '▾' : '▸'} ${meta.label}`;
        btn.classList.toggle('active', isOpen);
    }
}

function closeAllMapHintSubmenus() {
    Object.keys(MAP_HINT_SUBMENU_DEFAULTS).forEach(k => setMapHintSubmenuOpen(k, false));
}

function positionMapHintsMenuInViewport() {
    const menu = document.getElementById('mapHintsMenu');
    const btn = document.getElementById('mapHintsBtn');
    if (!menu || !btn || menu.style.display !== 'block') return;
    const openInViewport = (typeof window._openFloatingMenuInViewport === 'function')
        ? window._openFloatingMenuInViewport
        : (typeof _openFloatingMenuInViewport === 'function' ? _openFloatingMenuInViewport : null);
    if (openInViewport) {
        openInViewport(menu, btn, false);
    }
}

window.toggleMapHintSubmenu = function(key, evt) {
    if (evt && typeof evt.stopPropagation === 'function') evt.stopPropagation();
    if (!(key in MAP_HINT_SUBMENU_DEFAULTS)) return;
    const nowOpen = !!(window.mapHintSubmenus && window.mapHintSubmenus[key]);
    Object.keys(MAP_HINT_SUBMENU_DEFAULTS).forEach(k => {
        setMapHintSubmenuOpen(k, k === key ? !nowOpen : false);
    });
    positionMapHintsMenuInViewport();
};

function refreshMapHintMenuUi() {
    const labels = {
        magentaLine: '🟣 Direkt-Linie',
        weather: '🌤️ Wetter',
        windBarbs: '🪁 Windbarben',
        cloudFields: '☁️ Wolkenfelder',
        vfrIndex: '🧭 VFR-Index',
        terrainAvoid: '🏔️ Terrain Avoid',
        traffic: '✈️ Traffic',
        telemetry: '📟 Telemetrie',
        nextLeg: '🧭 Wegpunkt-Info',
        compass: '🔵 Kompassscheibe',
        lowFps: '🐢 Low FPS Mode'
    };
    const ids = {
        magentaLine: 'hintToggleMagentaLine',
        weather: 'hintToggleWeather',
        windBarbs: 'hintToggleWindBarbs',
        cloudFields: 'hintToggleCloudFields',
        vfrIndex: 'hintToggleVfrIndex',
        terrainAvoid: 'hintToggleTerrainAvoid',
        traffic: 'hintToggleTraffic',
        telemetry: 'hintToggleTelemetry',
        nextLeg: 'hintToggleNextLeg',
        compass: 'hintToggleCompass',
        lowFps: 'hintToggleLowFps'
    };
    Object.keys(ids).forEach(key => {
        const btn = document.getElementById(ids[key]);
        if (!btn) return;
        const on = window.mapHints[key] !== false;
        btn.textContent = `${labels[key]} (${on ? 'An' : 'Aus'})`;
        btn.style.background = on ? '#2E8B57' : '#444';
        btn.style.color = '#fff';
    });
    Object.keys(MAP_HINT_SUBMENU_DEFAULTS).forEach(k => {
        const isOpen = !!(window.mapHintSubmenus && window.mapHintSubmenus[k]);
        setMapHintSubmenuOpen(k, isOpen);
    });
    vpUpdateVfrUi();
    updateTerrainAvoidThresholdUi();
    positionMapHintsMenuInViewport();
}

window.toggleMapHint = function(key) {
    if (!(key in MAP_HINT_DEFAULTS)) return;
    window.mapHints[key] = !(window.mapHints[key] !== false);
    saveMapHintSetting(key);
    applyMapHintEffects(key);
    refreshMapHintMenuUi();
};

window.toggleMapHintsMenu = function(force) {
    const menu = document.getElementById('mapHintsMenu');
    const btn = document.getElementById('mapHintsBtn');
    if (!menu) return;
    const isOpen = menu.style.display === 'block';
    const nextOpen = typeof force === 'boolean' ? force : !isOpen;
    if (nextOpen) {
        refreshMapHintMenuUi();
        if (btn) {
            menu.style.display = 'block';
            positionMapHintsMenuInViewport();
        } else {
            menu.style.display = 'block';
        }
    } else {
        menu.style.display = 'none';
    }
    if (!nextOpen) {
        closeAllMapHintSubmenus();
        const planeMenu = document.getElementById('vpPlaneIconMenu');
        if (planeMenu) planeMenu.style.display = 'none';
        const planeBtn = document.getElementById('btnTogglePlaneIconMenu');
        if (planeBtn) planeBtn.classList.remove('active');
    }
};

function clampTerrainAvoidThresholds() {
    const warnRaw = Number(terrainAvoidWarnFt);
    const safeRaw = Number(terrainAvoidSafeFt);
    const warnNorm = Number.isFinite(warnRaw) ? warnRaw : TERRAIN_AVOID_WARN_DEFAULT_FT;
    const safeNorm = Number.isFinite(safeRaw) ? safeRaw : TERRAIN_AVOID_SAFE_DEFAULT_FT;
    terrainAvoidWarnFt = Math.round(Math.max(TERRAIN_AVOID_WARN_MIN_FT, Math.min(TERRAIN_AVOID_WARN_MAX_FT, warnNorm)));
    terrainAvoidSafeFt = Math.round(Math.max(TERRAIN_AVOID_SAFE_MIN_FT, Math.min(TERRAIN_AVOID_SAFE_MAX_FT, safeNorm)));
    if (terrainAvoidSafeFt < terrainAvoidWarnFt) {
        terrainAvoidSafeFt = terrainAvoidWarnFt;
    }
}

function loadTerrainAvoidSettings() {
    const warnStored = Number(localStorage.getItem('ga_terrain_avoid_warn_ft'));
    const safeStored = Number(localStorage.getItem('ga_terrain_avoid_safe_ft'));
    terrainAvoidWarnFt = Number.isFinite(warnStored) ? warnStored : TERRAIN_AVOID_WARN_DEFAULT_FT;
    terrainAvoidSafeFt = Number.isFinite(safeStored) ? safeStored : TERRAIN_AVOID_SAFE_DEFAULT_FT;
    clampTerrainAvoidThresholds();
}

function saveTerrainAvoidSettings() {
    localStorage.setItem('ga_terrain_avoid_warn_ft', String(Math.round(terrainAvoidWarnFt)));
    localStorage.setItem('ga_terrain_avoid_safe_ft', String(Math.round(terrainAvoidSafeFt)));
}

function updateTerrainAvoidThresholdUi() {
    const warnSlider = document.getElementById('terrainAvoidWarnSlider');
    const safeSlider = document.getElementById('terrainAvoidSafeSlider');
    const warnLabel = document.getElementById('terrainAvoidWarnValue');
    const safeLabel = document.getElementById('terrainAvoidSafeValue');
    const statusLabel = document.getElementById('terrainAvoidStatus');
    if (warnSlider) warnSlider.value = String(Math.round(terrainAvoidWarnFt));
    if (safeSlider) safeSlider.value = String(Math.round(terrainAvoidSafeFt));
    if (warnLabel) warnLabel.textContent = `${Math.round(terrainAvoidWarnFt)} ft`;
    if (safeLabel) safeLabel.textContent = `${Math.round(terrainAvoidSafeFt)} ft`;
    if (statusLabel) {
        const on = window.mapHints && window.mapHints.terrainAvoid !== false;
        const available = terrainAvoidCanRenderNow();
        const liveSource = terrainAvoidCanActivate();
        if (!on) {
            statusLabel.textContent = 'Live-Layer aus';
            statusLabel.style.color = '#9a9a9a';
        } else if (terrainAvoidPausedReason === 'landed') {
            statusLabel.textContent = 'Pausiert am Boden - startet in der Luft';
            statusLabel.style.color = '#d2ab7a';
        } else if (terrainAvoidPausedReason === 'sim-end') {
            statusLabel.textContent = 'Pausiert nach Sim-Ende - startet in neuer SIM oder in der Luft';
            statusLabel.style.color = '#d2ab7a';
        } else if (!available || terrainAvoidPausedReason === 'source') {
            statusLabel.textContent = 'Pausiert - keine Referenzhöhe';
            statusLabel.style.color = '#d2ab7a';
        } else if (terrainAvoidUsingPlanningFallback()) {
            statusLabel.textContent = 'CRZ-Fallback aktiv (Live-Höhe fehlt)';
            statusLabel.style.color = '#9fc3e3';
        } else if (!liveSource) {
            statusLabel.textContent = 'Planungsmodus aktiv (CRZ-Höhe)';
            statusLabel.style.color = '#9fc3e3';
        } else {
            statusLabel.textContent = 'Live-Layer aktiv';
            statusLabel.style.color = '#9fe3b3';
        }
    }
}

window.setTerrainAvoidThreshold = function(kind, value) {
    if (kind === 'warn') terrainAvoidWarnFt = Number(value);
    if (kind === 'safe') terrainAvoidSafeFt = Number(value);
    clampTerrainAvoidThresholds();
    saveTerrainAvoidSettings();
    updateTerrainAvoidThresholdUi();
    if (window.mapHints && window.mapHints.terrainAvoid !== false) {
        window.scheduleTerrainAvoidOverlayUpdate(true);
    }
};

function terrainAvoidCanActivate() {
    return !!(window.simModeActive || window.liveTrackerConnected);
}

function getTerrainAvoidLiveAltFt() {
    if (window.simModeActive) {
        const altSim = Number(window.lastLiveGpsPos?.alt ?? window.lastLiveFlightData?.mslFt);
        return Number.isFinite(altSim) ? Math.max(0, altSim) : null;
    }
    if (window.liveTrackerConnected) {
        if (typeof isGpsLive === 'function' && !isGpsLive(TERRAIN_AVOID_STALE_GPS_MS)) return null;
        const altLive = Number(window.lastLiveGpsPos?.alt ?? window.lastLiveFlightData?.mslFt);
        return Number.isFinite(altLive) ? Math.max(0, altLive) : null;
    }
    return null;
}

function getTerrainAvoidPlanningAltFt() {
    const altMap = Number(document.getElementById('altSliderMap')?.value);
    if (Number.isFinite(altMap) && altMap > 0) return altMap;
    const altPlan = Number(document.getElementById('altSlider')?.value);
    if (Number.isFinite(altPlan) && altPlan > 0) return altPlan;
    return null;
}

function terrainAvoidUsingPlanningFallback() {
    if (!terrainAvoidCanActivate()) return false;
    const liveAlt = getTerrainAvoidLiveAltFt();
    if (Number.isFinite(liveAlt)) return false;
    return Number.isFinite(getTerrainAvoidPlanningAltFt());
}

function terrainAvoidCanRenderNow() {
    return Number.isFinite(getTerrainAvoidAircraftAltFt());
}

function terrainAvoidReadFlightState() {
    const fd = window.lastLiveFlightData || {};
    const hasOnGround = typeof fd.onGround === 'boolean';
    const onGround = hasOnGround ? !!fd.onGround : false;
    const gs = Number(window.lastLiveGpsPos?.gs ?? fd.gsKts ?? fd.gs);
    const agl = Number(fd.aglFt);
    const airborne = hasOnGround
        ? (!onGround || (Number.isFinite(gs) && gs > 45))
        : ((Number.isFinite(agl) && agl > 180) || (Number.isFinite(gs) && gs > 45));
    const landed = hasOnGround
        ? (onGround && (!Number.isFinite(gs) || gs <= 28))
        : (Number.isFinite(agl) && agl <= 60 && (!Number.isFinite(gs) || gs <= 30));
    return { hasOnGround, onGround, gs, agl, airborne, landed };
}

window.terrainAvoidHandleFlightState = function() {
    if (!window.mapHints || window.mapHints.terrainAvoid === false) return;
    if (!terrainAvoidCanRenderNow()) {
        terrainAvoidWasAirborne = false;
        terrainAvoidPausedReason = 'source';
        if (map && terrainAvoidOverlayLayer && map.hasLayer(terrainAvoidOverlayLayer)) {
            map.removeLayer(terrainAvoidOverlayLayer);
        }
        updateTerrainAvoidThresholdUi();
        return;
    }
    const st = terrainAvoidReadFlightState();
    if (terrainAvoidPausedReason === 'sim-end' && !terrainAvoidCanActivate()) {
        terrainAvoidPausedReason = '';
    }
    if (terrainAvoidPausedReason === 'sim-end' && terrainAvoidCanActivate() && !window.simModeActive && !st.airborne) {
        if (map && terrainAvoidOverlayLayer && map.hasLayer(terrainAvoidOverlayLayer)) {
            map.removeLayer(terrainAvoidOverlayLayer);
        }
        updateTerrainAvoidThresholdUi();
        return;
    }
    if (window.simModeActive && (terrainAvoidPausedReason === 'source' || terrainAvoidPausedReason === 'sim-end' || terrainAvoidPausedReason === 'landed')) {
        terrainAvoidPausedReason = '';
        if (map && terrainAvoidOverlayLayer && !map.hasLayer(terrainAvoidOverlayLayer)) {
            map.addLayer(terrainAvoidOverlayLayer);
            window.scheduleTerrainAvoidOverlayUpdate(true);
        }
        updateTerrainAvoidThresholdUi();
        return;
    }
    if (st.airborne) {
        terrainAvoidWasAirborne = true;
        if (terrainAvoidPausedReason) terrainAvoidPausedReason = '';
        if (map && terrainAvoidOverlayLayer && !map.hasLayer(terrainAvoidOverlayLayer)) {
            map.addLayer(terrainAvoidOverlayLayer);
            window.scheduleTerrainAvoidOverlayUpdate(true);
        }
        updateTerrainAvoidThresholdUi();
        return;
    }
    if (terrainAvoidWasAirborne && st.landed) {
        terrainAvoidWasAirborne = false;
        terrainAvoidPausedReason = 'landed';
        if (map && terrainAvoidOverlayLayer && map.hasLayer(terrainAvoidOverlayLayer)) {
            map.removeLayer(terrainAvoidOverlayLayer);
        }
        updateTerrainAvoidThresholdUi();
        return;
    }
    if (!terrainAvoidPausedReason && map && terrainAvoidOverlayLayer && !map.hasLayer(terrainAvoidOverlayLayer) && terrainAvoidCanRenderNow()) {
        terrainAvoidPausedReason = '';
        map.addLayer(terrainAvoidOverlayLayer);
        window.scheduleTerrainAvoidOverlayUpdate(true);
        updateTerrainAvoidThresholdUi();
    }
};

function getTerrainAvoidAircraftAltFt() {
    const liveAlt = terrainAvoidCanActivate() ? getTerrainAvoidLiveAltFt() : null;
    if (Number.isFinite(liveAlt)) return liveAlt;
    return getTerrainAvoidPlanningAltFt();
}

function terrainAvoidLerpByte(a, b, t) {
    const clamped = Math.max(0, Math.min(1, t));
    return Math.round(a + ((b - a) * clamped));
}

function getTerrainAvoidRgbaBytes(clearanceFt) {
    if (!Number.isFinite(clearanceFt)) return [0, 0, 0, 0];
    if (clearanceFt <= 0) return [255, 52, 52, 208];
    if (clearanceFt <= terrainAvoidWarnFt) {
        const t = clearanceFt / Math.max(1, terrainAvoidWarnFt);
        return [255, terrainAvoidLerpByte(52, 184, t), terrainAvoidLerpByte(52, 0, t), 194];
    }
    if (clearanceFt >= terrainAvoidSafeFt) return [0, 0, 0, 182];
    const t = (clearanceFt - terrainAvoidWarnFt) / Math.max(1, terrainAvoidSafeFt - terrainAvoidWarnFt);
    return [terrainAvoidLerpByte(255, 0, t), terrainAvoidLerpByte(184, 0, t), 0, terrainAvoidLerpByte(186, 178, t)];
}

function terrainAvoidResolveSourceTile(coords) {
    const z = Math.max(0, Number(coords && coords.z) || 0);
    const srcZ = Math.min(TERRAIN_AVOID_SOURCE_MAX_Z, z);
    const scale = Math.max(1, 1 << Math.max(0, z - srcZ));
    const x = Number(coords && coords.x) || 0;
    const y = Number(coords && coords.y) || 0;
    const srcXRaw = Math.floor(x / scale);
    const srcYRaw = Math.floor(y / scale);
    const subX = ((x % scale) + scale) % scale;
    const subY = ((y % scale) + scale) % scale;
    const n = 1 << srcZ;
    if (srcYRaw < 0 || srcYRaw >= n) return null;
    const srcX = ((srcXRaw % n) + n) % n;
    return { srcZ, srcX, srcY: srcYRaw, scale, subX, subY };
}

function terrainAvoidLoadTileImageData(z, x, y) {
    const key = `${z}/${x}/${y}`;
    if (terrainAvoidTileCache.has(key)) return Promise.resolve(terrainAvoidTileCache.get(key));
    if (terrainAvoidTileInFlightCache.has(key)) return terrainAvoidTileInFlightCache.get(key);
    const promise = new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = 256;
            c.height = 256;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
                reject(new Error('terrain-ctx-missing'));
                return;
            }
            ctx.drawImage(img, 0, 0, 256, 256);
            const imageData = ctx.getImageData(0, 0, 256, 256);
            if (terrainAvoidTileCache.size >= TERRAIN_AVOID_TILE_CACHE_MAX) {
                const oldest = terrainAvoidTileCache.keys().next().value;
                if (oldest) terrainAvoidTileCache.delete(oldest);
            }
            terrainAvoidTileCache.set(key, imageData);
            resolve(imageData);
        };
        img.onerror = () => reject(new Error(`terrain-tile-load-failed:${key}`));
        img.src = TERRAIN_AVOID_TILE_URL.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
    });
    terrainAvoidTileInFlightCache.set(key, promise);
    promise.then(
        () => terrainAvoidTileInFlightCache.delete(key),
        () => terrainAvoidTileInFlightCache.delete(key)
    );
    return promise;
}

function terrainAvoidStoreRenderedTile(tileKey, imageData, width, height) {
    terrainAvoidRenderedTileCache.set(tileKey, { imageData, width, height, ts: Date.now() });
    if (terrainAvoidRenderedTileCache.size > TERRAIN_AVOID_RENDER_TILE_CACHE_MAX) {
        const oldest = terrainAvoidRenderedTileCache.keys().next().value;
        if (oldest) terrainAvoidRenderedTileCache.delete(oldest);
    }
}

function terrainAvoidPaintTileCanvas(canvas, coords, aircraftAltFt, done) {
    const ctx = canvas && typeof canvas.getContext === 'function'
        ? canvas.getContext('2d', { willReadFrequently: true })
        : null;
    const finalize = () => { if (typeof done === 'function') done(); };
    if (!ctx || !coords || !Number.isFinite(aircraftAltFt)) {
        finalize();
        return;
    }
    const size = { x: canvas.width || 256, y: canvas.height || 256 };
    const spec = terrainAvoidResolveSourceTile(coords);
    if (!spec) {
        finalize();
        return;
    }
    const tileKey = `${coords.z}/${coords.x}/${coords.y}`;
    terrainAvoidLoadTileImageData(spec.srcZ, spec.srcX, spec.srcY).then((srcImage) => {
        const src = srcImage && srcImage.data ? srcImage.data : null;
        if (!src) {
            finalize();
            return;
        }
        const out = ctx.createImageData(size.x, size.y);
        const outData = out.data;
        for (let py = 0; py < size.y; py++) {
            const srcPy = spec.scale === 1 ? py : Math.min(255, Math.floor(((spec.subY * 256) + py) / spec.scale));
            for (let px = 0; px < size.x; px++) {
                const srcPx = spec.scale === 1 ? px : Math.min(255, Math.floor(((spec.subX * 256) + px) / spec.scale));
                const srcIdx = (srcPy * 256 + srcPx) * 4;
                const r = src[srcIdx];
                const g = src[srcIdx + 1];
                const b = src[srcIdx + 2];
                const elevM = (r * 256 + g + b / 256) - 32768;
                const terrainFt = Math.max(0, Math.round(elevM * 3.28084));
                const rgba = getTerrainAvoidRgbaBytes(aircraftAltFt - terrainFt);
                const outIdx = (py * size.x + px) * 4;
                outData[outIdx] = rgba[0];
                outData[outIdx + 1] = rgba[1];
                outData[outIdx + 2] = rgba[2];
                outData[outIdx + 3] = rgba[3];
            }
        }
        ctx.putImageData(out, 0, 0);
        terrainAvoidStoreRenderedTile(tileKey, out, size.x, size.y);
        finalize();
    }).catch(() => finalize());
}

function terrainAvoidRepaintVisibleTiles(aircraftAltFt) {
    if (!terrainAvoidOverlayLayer || !map || !map.hasLayer(terrainAvoidOverlayLayer)) return false;
    if (!Number.isFinite(aircraftAltFt)) return false;
    const tiles = terrainAvoidOverlayLayer._tiles || null;
    if (!tiles) return false;
    let paintedAny = false;
    Object.keys(tiles).forEach((key) => {
        const rec = tiles[key];
        const canvas = rec && rec.el;
        const coords = rec && rec.coords;
        if (!canvas || !coords) return;
        paintedAny = true;
        terrainAvoidPaintTileCanvas(canvas, coords, aircraftAltFt);
    });
    return paintedAny;
}

function ensureTerrainAvoidOverlayLayer() {
    if (terrainAvoidOverlayLayer || typeof L === 'undefined') return;
    const TerrainAvoidGridLayer = L.GridLayer.extend({
        createTile: function(coords, done) {
            const tile = L.DomUtil.create('canvas', 'leaflet-tile');
            const size = this.getTileSize();
            tile.width = size.x;
            tile.height = size.y;
            const ctx = tile.getContext('2d', { willReadFrequently: true });
            const tileKey = `${coords.z}/${coords.x}/${coords.y}`;
            const finalize = () => { if (typeof done === 'function') done(null, tile); };
            if (!ctx) {
                finalize();
                return tile;
            }
            const cachedRendered = terrainAvoidRenderedTileCache.get(tileKey);
            if (cachedRendered && cachedRendered.width === size.x && cachedRendered.height === size.y && cachedRendered.imageData) {
                try { ctx.putImageData(cachedRendered.imageData, 0, 0); } catch (_) { }
            }
            if (window.mapHints && window.mapHints.terrainAvoid === false) {
                finalize();
                return tile;
            }
            if (!terrainAvoidCanRenderNow()) {
                finalize();
                return tile;
            }
            const aircraftAltFt = getTerrainAvoidAircraftAltFt();
            if (!Number.isFinite(aircraftAltFt)) {
                finalize();
                return tile;
            }
            terrainAvoidPaintTileCanvas(tile, coords, aircraftAltFt, finalize);
            return tile;
        }
    });
    terrainAvoidOverlayLayer = new TerrainAvoidGridLayer({
        tileSize: 256,
        opacity: 1,
        updateWhenIdle: true,
        updateWhenZooming: false,
        keepBuffer: 1,
        zIndex: 430
    });
}

window.setTerrainAvoidOverlayEnabled = function(next, opts = {}) {
    let enable = !!next;
    if (enable && !terrainAvoidCanRenderNow()) {
        enable = true;
        if (!opts.silent && typeof showMapToast === 'function') showMapToast('Terrain Avoid braucht eine Referenzhöhe (Live oder geplante CRZ).', 2200);
    }
    if (window.mapHints) window.mapHints.terrainAvoid = enable;
    if (!opts.skipPersist) saveMapHintSetting('terrainAvoid');
    if (typeof refreshMapHintMenuUi === 'function') refreshMapHintMenuUi();
    updateTerrainAvoidThresholdUi();
    if (!map) return;
    ensureTerrainAvoidOverlayLayer();
    if (!terrainAvoidOverlayLayer) return;
    if (enable && terrainAvoidCanRenderNow() && !map.hasLayer(terrainAvoidOverlayLayer)) terrainAvoidOverlayLayer.addTo(map);
    if (!enable && map.hasLayer(terrainAvoidOverlayLayer)) map.removeLayer(terrainAvoidOverlayLayer);
    if (enable) {
        const st = terrainAvoidReadFlightState();
        terrainAvoidWasAirborne = !!st.airborne;
        terrainAvoidPausedReason = terrainAvoidCanRenderNow() ? '' : 'source';
    } else {
        terrainAvoidWasAirborne = false;
        terrainAvoidPausedReason = '';
    }
    if (enable && terrainAvoidCanRenderNow()) window.scheduleTerrainAvoidOverlayUpdate(true);
    else if (typeof terrainAvoidOverlayLayer.redraw === 'function') terrainAvoidOverlayLayer.redraw();
    updateTerrainAvoidThresholdUi();
};

window.terrainAvoidPauseForSimEnd = function() {
    if (!window.mapHints || window.mapHints.terrainAvoid === false) return;
    terrainAvoidWasAirborne = false;
    terrainAvoidPausedReason = 'sim-end';
    if (map && terrainAvoidOverlayLayer && map.hasLayer(terrainAvoidOverlayLayer)) {
        map.removeLayer(terrainAvoidOverlayLayer);
    }
    updateTerrainAvoidThresholdUi();
};

window.scheduleTerrainAvoidOverlayUpdate = function(forceFetch = false) {
    if (!map) return;
    updateTerrainAvoidThresholdUi();
    ensureTerrainAvoidOverlayLayer();
    if (!terrainAvoidOverlayLayer) return;
    const st = terrainAvoidReadFlightState();
    if (terrainAvoidPausedReason === 'sim-end' && !terrainAvoidCanActivate()) {
        terrainAvoidPausedReason = '';
    }
    if (window.mapHints && window.mapHints.terrainAvoid !== false && terrainAvoidPausedReason === 'sim-end' && terrainAvoidCanActivate() && !window.simModeActive) {
        if (map.hasLayer(terrainAvoidOverlayLayer)) map.removeLayer(terrainAvoidOverlayLayer);
        updateTerrainAvoidThresholdUi();
        return;
    }
    if (window.mapHints && window.mapHints.terrainAvoid !== false && !terrainAvoidCanRenderNow()) {
        terrainAvoidPausedReason = 'source';
        if (map.hasLayer(terrainAvoidOverlayLayer)) map.removeLayer(terrainAvoidOverlayLayer);
        updateTerrainAvoidThresholdUi();
        return;
    }
    if (window.mapHints && window.mapHints.terrainAvoid !== false && terrainAvoidCanRenderNow() && !map.hasLayer(terrainAvoidOverlayLayer)) {
        if (window.simModeActive || st.airborne) {
            terrainAvoidPausedReason = '';
            map.addLayer(terrainAvoidOverlayLayer);
        } else if (terrainAvoidPausedReason !== 'landed' && !(terrainAvoidPausedReason === 'sim-end' && terrainAvoidCanActivate())) {
            terrainAvoidPausedReason = '';
            map.addLayer(terrainAvoidOverlayLayer);
        }
    }
    const curAltFt = getTerrainAvoidAircraftAltFt();
    if (terrainAvoidRefreshTimer) clearTimeout(terrainAvoidRefreshTimer);
    const delay = forceFetch ? 30 : 60;
    terrainAvoidRefreshTimer = setTimeout(() => {
        if (!terrainAvoidOverlayLayer || !map.hasLayer(terrainAvoidOverlayLayer)) return;
        const now = Date.now();
        if (!forceFetch && (now - terrainAvoidLastRenderAt) < TERRAIN_AVOID_MIN_UPDATE_MS) return;
        if (!forceFetch && Number.isFinite(curAltFt) && Number.isFinite(terrainAvoidLastRenderAltFt)) {
            const dAlt = Math.abs(curAltFt - terrainAvoidLastRenderAltFt);
            if (dAlt < TERRAIN_AVOID_MIN_ALT_DELTA_FT) return;
        }
        terrainAvoidLastRenderAt = now;
        terrainAvoidLastRenderAltFt = Number.isFinite(curAltFt) ? curAltFt : terrainAvoidLastRenderAltFt;
        if (!terrainAvoidRepaintVisibleTiles(curAltFt) && typeof terrainAvoidOverlayLayer.redraw === 'function') {
            terrainAvoidOverlayLayer.redraw();
        }
    }, delay);
};

function vpGetVfrCountryMeta(code) {
    const key = String(code || '').toUpperCase();
    return VP_VFR_INDEX_COUNTRIES.find(c => c.code === key) || null;
}

function vpNormalizeVfrCountrySelection(value) {
    const raw = String(value || 'auto').trim().toUpperCase();
    if (!raw || raw === 'AUTO') return 'auto';
    return vpGetVfrCountryMeta(raw) ? raw : 'auto';
}

function vpNormalizeVfrModel(value) {
    const raw = String(value || 'internal').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(VP_VFR_MODEL_META, raw) ? raw : 'internal';
}

function vpGetVfrModelMeta(value) {
    const key = vpNormalizeVfrModel(value);
    return VP_VFR_MODEL_META[key] || VP_VFR_MODEL_META.internal;
}

function vpIcaoPrefixToCountry(icao) {
    const key = String(icao || '').trim().toUpperCase();
    if (key.length < 2) return '';
    const p2 = key.slice(0, 2);
    const map2 = {
        ED: 'DE', ET: 'DE', LO: 'AT', LS: 'CH', LF: 'FR', LI: 'IT',
        LE: 'ES', LP: 'PT', EH: 'NL', EB: 'BE', EK: 'DK', EP: 'PL',
        LK: 'CZ', LZ: 'SK', LH: 'HU', LJ: 'SI', LD: 'HR', LR: 'RO',
        LB: 'BG', LG: 'GR', EN: 'NO', ES: 'SE', EF: 'FI', EI: 'IE',
        EG: 'GB', BI: 'IS'
    };
    return map2[p2] || '';
}

function vpComputeCountryBoundsFromAirports(countryCode) {
    const code = String(countryCode || '').toUpperCase();
    if (!code) return null;
    if (vpVfrCountryBoundsCache.has(code)) return vpVfrCountryBoundsCache.get(code);

    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    let count = 0;
    if (typeof globalAirports === 'object' && globalAirports) {
        for (const icao in globalAirports) {
            const apt = globalAirports[icao];
            if (!apt) continue;
            const cc = String(apt.country || '').toUpperCase();
            if (cc !== code) continue;
            const lat = Number(apt.lat);
            const lon = Number(apt.lon ?? apt.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
            minLon = Math.min(minLon, lon);
            maxLon = Math.max(maxLon, lon);
            count += 1;
        }
    }

    let bounds = null;
    if (count >= 3 && Number.isFinite(minLat) && Number.isFinite(minLon)) {
        const padLat = 0.35;
        const midLat = (minLat + maxLat) * 0.5;
        const cosLat = Math.max(0.25, Math.abs(Math.cos((midLat * Math.PI) / 180)));
        const padLon = Math.min(1.1, Math.max(0.35, 0.35 / cosLat));
        bounds = {
            minLat: Math.max(-89.5, minLat - padLat),
            maxLat: Math.min(89.5, maxLat + padLat),
            minLon: Math.max(-179.5, minLon - padLon),
            maxLon: Math.min(179.5, maxLon + padLon)
        };
    } else {
        bounds = VP_VFR_COUNTRY_FALLBACK_BOUNDS[code] || null;
    }

    vpVfrCountryBoundsCache.set(code, bounds || null);
    return bounds || null;
}

function vpGetVfrCountryBounds(countryCode) {
    const code = String(countryCode || '').toUpperCase();
    if (!code) return null;
    return vpComputeCountryBoundsFromAirports(code);
}

function vpInferPlanningCountryCode() {
    const dep = vpIcaoPrefixToCountry(typeof currentStartICAO !== 'undefined' ? currentStartICAO : '');
    const dest = vpIcaoPrefixToCountry(typeof currentDestICAO !== 'undefined' ? currentDestICAO : '');
    if (dep && dest && dep === dest) return dep;
    if (dep && vpGetVfrCountryMeta(dep)) return dep;

    if (Array.isArray(routeWaypoints) && routeWaypoints.length > 0) {
        let sumLat = 0, sumLon = 0, n = 0;
        routeWaypoints.forEach(p => {
            const lat = Number(p && p.lat);
            const lon = Number(p && (p.lng ?? p.lon));
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
            sumLat += lat;
            sumLon += lon;
            n += 1;
        });
        if (n > 0) {
            const cLat = sumLat / n;
            const cLon = sumLon / n;
            for (const item of VP_VFR_INDEX_COUNTRIES) {
                const b = vpGetVfrCountryBounds(item.code);
                if (!b) continue;
                if (cLat >= b.minLat && cLat <= b.maxLat && cLon >= b.minLon && cLon <= b.maxLon) return item.code;
            }
        }
    }

    if (dest && vpGetVfrCountryMeta(dest)) return dest;
    return 'DE';
}

function vpResolveActiveVfrCountry() {
    const sel = vpNormalizeVfrCountrySelection(vpVfrIndexState.selectedCountry);
    if (sel !== 'auto') return sel;
    const planned = vpInferPlanningCountryCode();
    return vpGetVfrCountryMeta(planned) ? planned : 'DE';
}

function vpBuildVfrGridPoints(bounds) {
    if (!bounds) return { points: [], latStep: 0.4, lonStep: 0.4 };
    const latSpan = Math.max(0.4, Math.abs(bounds.maxLat - bounds.minLat));
    const lonSpan = Math.max(0.4, Math.abs(bounds.maxLon - bounds.minLon));
    const midLat = (bounds.minLat + bounds.maxLat) * 0.5;
    const cosLat = Math.max(0.25, Math.abs(Math.cos((midLat * Math.PI) / 180)));
    const lonSpanAdj = lonSpan * cosLat;
    const target = VP_VFR_INDEX_MAX_POINTS;
    const rows = Math.max(4, Math.round(Math.sqrt(target * (latSpan / Math.max(0.2, lonSpanAdj)))));
    const cols = Math.max(4, Math.round(target / rows));
    let latStep = Math.max(0.24, latSpan / rows);
    let lonStep = Math.max(0.24, lonSpan / cols);
    const pts = [];
    for (let lat = bounds.minLat + (latStep * 0.5); lat <= bounds.maxLat + 1e-9; lat += latStep) {
        const clampedLat = Math.max(-89.5, Math.min(89.5, lat));
        for (let lon = bounds.minLon + (lonStep * 0.5); lon <= bounds.maxLon + 1e-9; lon += lonStep) {
            const normLon = Math.max(-179.5, Math.min(179.5, lon));
            pts.push({ lat: Number(clampedLat.toFixed(4)), lon: Number(normLon.toFixed(4)) });
        }
    }
    const reduced = pts.length > target
        ? pts.filter((_, idx) => (idx % Math.ceil(pts.length / target)) === 0).slice(0, target)
        : pts;
    return { points: reduced, latStep, lonStep };
}

function vpBuildGaforSectorDefs(countryCode) {
    const cc = String(countryCode || '').toUpperCase();
    if (cc !== 'DE') return [];
    const latEdges = VP_GAFOR_SECTOR_GRID_DE.latEdges;
    const lonEdges = VP_GAFOR_SECTOR_GRID_DE.lonEdges;
    const ids = VP_GAFOR_SECTOR_GRID_DE.idsSouthToNorth;
    const rowCount = ids.length;
    const colCount = ids[0] ? ids[0].length : 0;
    const nodeLatWarp = VP_GAFOR_SECTOR_NODE_WARP_DE.lat;
    const nodeLonWarp = VP_GAFOR_SECTOR_NODE_WARP_DE.lon;
    const nodeGrid = [];
    for (let r = 0; r <= rowCount; r++) {
        const row = [];
        for (let c = 0; c <= colCount; c++) {
            let lat = Number(latEdges[r] || latEdges[Math.max(0, Math.min(latEdges.length - 1, r))]);
            let lon = Number(lonEdges[c] || lonEdges[Math.max(0, Math.min(lonEdges.length - 1, c))]);
            const latShift = Number(nodeLatWarp[r] && nodeLatWarp[r][c]);
            const lonShift = Number(nodeLonWarp[r] && nodeLonWarp[r][c]);
            if (Number.isFinite(latShift)) lat += latShift;
            if (Number.isFinite(lonShift)) lon += lonShift;
            row.push([Number(lat.toFixed(4)), Number(lon.toFixed(4))]);
        }
        nodeGrid.push(row);
    }

    const buildSectorPolygon = (id, r, c) => {
        const tl = nodeGrid[r][c];
        const tr = nodeGrid[r][c + 1];
        const br = nodeGrid[r + 1][c + 1];
        const bl = nodeGrid[r + 1][c];
        const midTop = [Number(((tl[0] + tr[0]) * 0.5).toFixed(4)), Number(((tl[1] + tr[1]) * 0.5).toFixed(4))];
        const midRight = [Number(((tr[0] + br[0]) * 0.5).toFixed(4)), Number(((tr[1] + br[1]) * 0.5).toFixed(4))];
        const midBottom = [Number(((bl[0] + br[0]) * 0.5).toFixed(4)), Number(((bl[1] + br[1]) * 0.5).toFixed(4))];
        const midLeft = [Number(((tl[0] + bl[0]) * 0.5).toFixed(4)), Number(((tl[1] + bl[1]) * 0.5).toFixed(4))];

        // Kuesten- und Alpenrandbereiche leicht konturieren, damit die Geometrie
        // nicht kachelartig wirkt.
        if (id === '02' || id === '03') midTop[0] = Number((midTop[0] - 0.15).toFixed(4));
        if (id === '04' || id === '12' || id === '16') midTop[0] = Number((midTop[0] - 0.12).toFixed(4));
        if (id === '50' || id === '61') midBottom[0] = Number((midBottom[0] + 0.10).toFixed(4));
        if (id === '62' || id === '73' || id === '75') midBottom[0] = Number((midBottom[0] + 0.14).toFixed(4));
        if (id === '32' || id === '34' || id === '44') midLeft[1] = Number((midLeft[1] - 0.10).toFixed(4));
        if (id === '23' || id === '26' || id === '64') midRight[1] = Number((midRight[1] + 0.10).toFixed(4));

        return [tl, midTop, tr, midRight, br, midBottom, bl, midLeft];
    };

    const polygonCenter = (poly) => {
        const pts = Array.isArray(poly) ? poly : [];
        let sumLat = 0;
        let sumLon = 0;
        let n = 0;
        pts.forEach((p) => {
            const lat = Number(p && p[0]);
            const lon = Number(p && p[1]);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
            sumLat += lat;
            sumLon += lon;
            n += 1;
        });
        if (n < 1) return { lat: 0, lon: 0 };
        return {
            lat: Number((sumLat / n).toFixed(4)),
            lon: Number((sumLon / n).toFixed(4))
        };
    };

    const out = [];
    for (let r = 0; r < ids.length; r++) {
        for (let c = 0; c < ids[r].length; c++) {
            const id = String(ids[r][c] || '').trim();
            if (!id) continue;
            const meta = VP_GAFOR_SECTOR_META_DE[id];
            if (!meta) continue;
            const polygon = buildSectorPolygon(id, r, c);
            const center = polygonCenter(polygon);
            out.push({
                key: `${id}_${r}_${c}`,
                id,
                name: meta.name,
                refFt: Number(meta.refFt),
                polygon,
                center,
                probe: { lat: center.lat, lon: center.lon }
            });
        }
    }
    return out;
}

function vpBuildGaforSectorProbePoints(sectors) {
    if (!Array.isArray(sectors)) return [];
    return sectors
        .map(s => s && s.probe)
        .filter(p => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)))
        .map(p => ({ lat: Number(p.lat), lon: Number(p.lon) }));
}

function vpCodeRank(code) {
    const c = String(code || '').toUpperCase();
    const rank = {
        C: 0, O: 1, D1: 2, D3: 3, D4: 4,
        M2: 5, M5: 6, M6: 7, M7: 8, M8: 9, X: 10, '?': 11
    };
    return Object.prototype.hasOwnProperty.call(rank, c) ? rank[c] : 11;
}

function vpGetTimelineRecordForPoint(timelines, point) {
    if (!timelines || !timelines.byKey || !point) return null;
    const keys = vpBuildTimelineKeyCandidates(point.lat, point.lon);
    for (const k of keys) {
        if (timelines.byKey[k]) return timelines.byKey[k];
    }
    return null;
}

function vpBuildGaforSectorEntries(sectors, samplesByKey, timelines, nowRatio) {
    const out = [];
    const safeNowRatio = Number.isFinite(Number(nowRatio)) ? Number(nowRatio) : 0.5;
    const nowIdx = Math.max(0, Math.min(2, Math.round(safeNowRatio * 2)));
    sectors.forEach((sector) => {
        const probe = sector && sector.probe;
        if (!probe) return;
        const pKey = vpPointKey(probe.lat, probe.lon);
        const sample = samplesByKey[pKey] || null;
        const baseParts = vpSampleToParts({
            ...(sample || {}),
            sectorRefFt: Number(sector.refFt),
            terrainPointFt: Number(sector.refFt)
        });
        let tl = vpGetTimelineRecordForPoint(timelines, probe);
        if (!tl || !Array.isArray(tl.slots) || tl.slots.length !== 3) {
            const fb = vpBuildAmpelSlotFallback(vpVfrIndexState.ampelWindowMode, baseParts);
            tl = { slots: fb.slots };
        }
        const slots = (tl.slots || []).map((slot) => {
            const parts = {
                ...baseParts,
                ...(slot && slot.parts ? slot.parts : {}),
                sectorRefFt: Number(sector.refFt),
                terrainPointFt: Number(sector.refFt)
            };
            const cat = vpClassifyGaforLike(parts);
            return { slot, parts, cat };
        });
        let current = slots[nowIdx] && slots[nowIdx].cat ? slots[nowIdx].cat : null;
        if (!current) {
            current = slots
                .map(s => s.cat)
                .filter(Boolean)
                .sort((a, b) => vpCodeRank(a.code) - vpCodeRank(b.code))[0] || vpClassifyGaforLike(baseParts);
        }
        out.push({
            sector,
            baseParts,
            currentCat: current,
            timeline: {
                slots: slots.map(({ slot, parts }) => ({
                    ...(slot || {}),
                    parts
                }))
            }
        });
    });
    return out;
}

function vpGaforCacheSet(cache, key, value, maxSize = VP_GAFOR_REF_CACHE_MAX) {
    cache.set(key, value);
    if (cache.size > maxSize) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
    }
}

function vpWrapLon(lon) {
    let out = Number(lon);
    if (!Number.isFinite(out)) out = 0;
    while (out < -180) out += 360;
    while (out >= 180) out -= 360;
    return out;
}

function vpClampMercatorLat(lat) {
    const v = Number(lat);
    if (!Number.isFinite(v)) return 0;
    return Math.max(-85.05112878, Math.min(85.05112878, v));
}

function vpWorldXFromLon(lon, z) {
    const worldPx = (1 << z) * 256;
    return ((vpWrapLon(lon) + 180) / 360) * worldPx;
}

function vpWorldYFromLat(lat, z) {
    const clamped = vpClampMercatorLat(lat);
    const rad = clamped * (Math.PI / 180);
    const sin = Math.sin(rad);
    const worldPx = (1 << z) * 256;
    const merc = Math.log((1 + sin) / Math.max(1e-12, 1 - sin));
    return (0.5 - (merc / (4 * Math.PI))) * worldPx;
}

function vpTerrariumFtAtPixel(imageData, px, py) {
    const src = imageData && imageData.data;
    if (!src) return null;
    const x = Math.max(0, Math.min(255, Math.floor(px)));
    const y = Math.max(0, Math.min(255, Math.floor(py)));
    const idx = (y * 256 + x) * 4;
    const r = src[idx];
    const g = src[idx + 1];
    const b = src[idx + 2];
    if (![r, g, b].every(Number.isFinite)) return null;
    const elevM = (r * 256 + g + b / 256) - 32768;
    return Math.max(0, elevM * 3.28084);
}

async function vpComputeSectorTerrainReferenceFt(lat, lon, latStep, lonStep, z = VP_GAFOR_REF_TERRAIN_Z) {
    const cacheKey = `${Number(lat).toFixed(4)}|${Number(lon).toFixed(4)}|${Number(latStep).toFixed(4)}|${Number(lonStep).toFixed(4)}|${z}`;
    const cached = vpGaforSectorRefCache.get(cacheKey);
    if (cached) return cached;

    const promise = (async () => {
        const halfLat = Math.max(0.12, Number(latStep || 0.4) * 0.48);
        const halfLon = Math.max(0.12, Number(lonStep || 0.4) * 0.48);
        const south = Math.max(-85.0, Number(lat) - halfLat);
        const north = Math.min(85.0, Number(lat) + halfLat);
        const west = vpWrapLon(Number(lon) - halfLon);
        const east = vpWrapLon(Number(lon) + halfLon);

        const westX = vpWorldXFromLon(west, z);
        const eastX = vpWorldXFromLon(east, z);
        const northY = vpWorldYFromLat(north, z);
        const southY = vpWorldYFromLat(south, z);
        const worldPx = (1 << z) * 256;
        const xSegments = (eastX >= westX)
            ? [{ minX: westX, maxX: eastX }]
            : [{ minX: westX, maxX: worldPx - 1e-6 }, { minX: 0, maxX: eastX }];
        const minY = Math.max(0, Math.min(northY, southY));
        const maxY = Math.min(worldPx - 1e-6, Math.max(northY, southY));
        const spanX = xSegments.reduce((sum, seg) => sum + Math.max(0, (seg.maxX - seg.minX)), 0);
        const spanY = Math.max(1, maxY - minY);
        const totalPixels = Math.max(1, spanX * spanY);
        const stride = Math.max(1, Math.ceil(Math.sqrt(totalPixels / VP_GAFOR_REF_MAX_SAMPLES)));

        let maxFt = null;
        const tileCache = new Map();
        const readTile = async (tileX, tileY) => {
            const n = 1 << z;
            if (tileY < 0 || tileY >= n) return null;
            const xNorm = ((tileX % n) + n) % n;
            const k = `${xNorm}|${tileY}`;
            if (tileCache.has(k)) return tileCache.get(k);
            const img = await terrainAvoidLoadTileImageData(z, xNorm, tileY).catch(() => null);
            tileCache.set(k, img);
            return img;
        };

        for (const seg of xSegments) {
            const tMinX = Math.floor(seg.minX / 256);
            const tMaxX = Math.floor((seg.maxX - 1e-6) / 256);
            const tMinY = Math.floor(minY / 256);
            const tMaxY = Math.floor((maxY - 1e-6) / 256);
            for (let ty = tMinY; ty <= tMaxY; ty++) {
                const rowStartY = Math.max(0, Math.floor(ty === tMinY ? (minY - ty * 256) : 0));
                const rowEndY = Math.min(255, Math.floor(ty === tMaxY ? (maxY - ty * 256) : 255));
                for (let tx = tMinX; tx <= tMaxX; tx++) {
                    const colStartX = Math.max(0, Math.floor(tx === tMinX ? (seg.minX - tx * 256) : 0));
                    const colEndX = Math.min(255, Math.floor(tx === tMaxX ? (seg.maxX - tx * 256) : 255));
                    const img = await readTile(tx, ty);
                    if (!img) continue;
                    for (let py = rowStartY; py <= rowEndY; py += stride) {
                        for (let px = colStartX; px <= colEndX; px += stride) {
                            const ft = vpTerrariumFtAtPixel(img, px, py);
                            if (!Number.isFinite(ft)) continue;
                            if (!Number.isFinite(maxFt) || ft > maxFt) maxFt = ft;
                        }
                    }
                }
            }
        }

        const centerTileX = Math.floor(vpWorldXFromLon(lon, z) / 256);
        const centerTileY = Math.floor(vpWorldYFromLat(lat, z) / 256);
        const centerImg = await readTile(centerTileX, centerTileY);
        let terrainFtAtPoint = null;
        if (centerImg) {
            const centerPx = Math.floor(vpWorldXFromLon(lon, z) - (centerTileX * 256));
            const centerPy = Math.floor(vpWorldYFromLat(lat, z) - (centerTileY * 256));
            terrainFtAtPoint = vpTerrariumFtAtPixel(centerImg, centerPx, centerPy);
        }

        return {
            sectorRefFt: Number.isFinite(maxFt) ? Math.max(0, Math.round(maxFt)) : null,
            terrainPointFt: Number.isFinite(terrainFtAtPoint) ? Math.max(0, Math.round(terrainFtAtPoint)) : null
        };
    })();

    vpGaforCacheSet(vpGaforSectorRefCache, cacheKey, promise);
    try {
        const resolved = await promise;
        vpGaforCacheSet(vpGaforSectorRefCache, cacheKey, resolved);
        return resolved;
    } catch (e) {
        vpGaforSectorRefCache.delete(cacheKey);
        throw e;
    }
}

async function vpRunLimited(items, limit, worker) {
    const list = Array.isArray(items) ? items : [];
    const max = Math.max(1, Math.min(Number(limit) || 1, list.length || 1));
    let cursor = 0;
    const runners = [];
    for (let i = 0; i < max; i++) {
        runners.push((async () => {
            while (cursor < list.length) {
                const idx = cursor++;
                await worker(list[idx], idx);
            }
        })());
    }
    await Promise.all(runners);
}

async function vpBuildSectorReferenceMap(points, latStep, lonStep, options = {}) {
    const out = Object.create(null);
    if (!Array.isArray(points) || points.length === 0) return out;
    const signal = options && options.signal;
    const maxConcurrency = Math.max(1, Math.min(Number(options && options.maxConcurrency) || 4, 6));
    await vpRunLimited(points, maxConcurrency, async (p) => {
        if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
        if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return;
        const ref = await vpComputeSectorTerrainReferenceFt(p.lat, p.lon, latStep, lonStep).catch(() => null);
        if (!ref) return;
        const keys = vpBuildTimelineKeyCandidates(p.lat, p.lon);
        keys.forEach(k => { out[k] = ref; });
    });
    return out;
}

function vpComputeVfrIndexScore(sample) {
    if (!sample) return 0;
    return vpComputeVfrIndexScoreFromParts({
        cloudLow: sample.cloudLowPct,
        cloudMid: sample.cloudMidPct,
        precipitation: sample.precipitationMm,
        rain: sample.rainMm,
        snow: sample.snowfallCm,
        wind: sample.wspd,
        visibility: sample.visibilityM,
        weatherCode: sample.weatherCode
    });
}

function vpComputeVfrIndexScoreFromParts(parts = {}) {
    let score = 100;
    const low = Number(parts.cloudLow || 0);
    const mid = Number(parts.cloudMid || 0);
    const cloud = Math.max(low, mid);
    const precip = Number(parts.precipitation || parts.rain || 0);
    const snow = Number(parts.snow || 0);
    const wind = Number(parts.wind || 0);
    const vis = Number(parts.visibility || 0);
    const wx = Number(parts.weatherCode);

    if (cloud > 90) score -= 42;
    else if (cloud > 75) score -= 32;
    else if (cloud > 60) score -= 20;
    else if (cloud > 45) score -= 10;

    if (precip > 2.5) score -= 34;
    else if (precip > 1.2) score -= 22;
    else if (precip > 0.5) score -= 12;
    else if (precip > 0.2) score -= 6;

    if (snow > 0.1) score -= 30;
    if (wind > 35) score -= 30;
    else if (wind > 25) score -= 20;
    else if (wind > 18) score -= 10;
    if (vis > 0 && vis < 3000) score -= 36;
    else if (vis > 0 && vis < 5000) score -= 24;
    else if (vis > 0 && vis < 8000) score -= 12;
    if (wx === 45 || wx === 48) score -= 22;
    if (wx === 95 || wx === 96 || wx === 99) score -= 30;
    if (wx === 65 || wx === 67 || wx === 75 || wx === 82 || wx === 86) score -= 16;

    return Math.max(0, Math.min(100, Math.round(score)));
}

function vpMapVfrCategory(score) {
    if (score >= 75) return { key: 'good', label: 'VFR gut', color: '#9acfa8', letter: 'V' };
    if (score >= 55) return { key: 'marginal', label: 'grenzwertig', color: '#dfcf9d', letter: 'M' };
    return { key: 'poor', label: 'kritisch', color: '#d8abab', letter: 'I' };
}

function vpClassifyInternalVfr(parts = {}) {
    const score = vpComputeVfrIndexScoreFromParts(parts);
    const cat = vpMapVfrCategory(score);
    return { ...cat, score: Math.round(score), mode: 'internal' };
}

function vpClassifyGaforLike(parts = {}) {
    const mosmixVisibilityM = Number(parts.mosmixVisibilityM);
    const visMRaw = Number.isFinite(mosmixVisibilityM) && mosmixVisibilityM > 0
        ? mosmixVisibilityM
        : Number(parts.visibility);
    const visKm = (Number.isFinite(visMRaw) && visMRaw > 0) ? (visMRaw / 1000) : null;
    const cloudBaseMRaw = Number(parts.cloudBaseM);
    const cloudBaseFtAgl = (Number.isFinite(cloudBaseMRaw) && cloudBaseMRaw > 0) ? (cloudBaseMRaw * 3.28084) : null;
    const sectorRefFt = Number(parts.sectorRefFt);
    const terrainPointFt = Number(parts.terrainPointFt);
    const cloudLow = Number(parts.cloudLow || 0);
    const cloudMid = Number(parts.cloudMid || 0);
    const cloudTotal = Number(parts.cloudTotal || 0);
    const mosmixN05Pct = Number(parts.mosmixN05Pct);
    const mosmixLowCloudPct = Number(parts.mosmixLowCloudPct);
    const coverForCeiling = Math.max(cloudLow, cloudMid, cloudTotal);
    const lowCoverForCeiling = Number.isFinite(mosmixLowCloudPct) ? mosmixLowCloudPct : cloudLow;
    const mosmixHasBknBelow500 = Number.isFinite(mosmixN05Pct) && mosmixN05Pct >= 62.5;
    // Ceiling erst ab BKN/OVC (>=5/8) bewerten.
    const hasCeilingCondition = Number.isFinite(coverForCeiling) && coverForCeiling >= 62.5;
    // Open-Meteo liefert cloud_base oft leer. Ein sichtbares '?' nur setzen,
    // wenn wirklich die tiefe Wolkenschicht dicht genug ist; Mid-Cloud allein
    // ist fuer GAFOR-Ceiling als Unsicherheitsausloeser zu breit.
    const hasDenseLowWithoutBase = Number.isFinite(lowCoverForCeiling)
        && lowCoverForCeiling >= 75
        && !Number.isFinite(cloudBaseFtAgl)
        && !mosmixHasBknBelow500;
    let cloudAboveRefFt = cloudBaseFtAgl;
    if (Number.isFinite(cloudBaseFtAgl) && hasCeilingCondition && Number.isFinite(sectorRefFt) && Number.isFinite(terrainPointFt)) {
        cloudAboveRefFt = cloudBaseFtAgl + terrainPointFt - sectorRefFt;
    }
    const labels = {
        UNKNOWN: { key: 'gafor_unknown', label: 'GAFOR unklar', color: '#9aa3ad', letter: '?', code: '?' },
        C: { key: 'gafor_c', label: 'GAFOR C (frei)', color: '#6aaeff', letter: 'C', code: 'C' },
        O: { key: 'gafor_o', label: 'GAFOR O (offen)', color: '#8ecb4b', letter: 'O', code: 'O' },
        D1: { key: 'gafor_d', label: 'GAFOR D1 (schwierig)', color: '#e0c93b', letter: 'D', code: 'D1' },
        D3: { key: 'gafor_d', label: 'GAFOR D3 (schwierig)', color: '#e0c93b', letter: 'D', code: 'D3' },
        D4: { key: 'gafor_d', label: 'GAFOR D4 (schwierig)', color: '#e0c93b', letter: 'D', code: 'D4' },
        M2: { key: 'gafor_m', label: 'GAFOR M2 (kritisch)', color: '#e08a3b', letter: 'M', code: 'M2' },
        M5: { key: 'gafor_m', label: 'GAFOR M5 (kritisch)', color: '#e08a3b', letter: 'M', code: 'M5' },
        M6: { key: 'gafor_m', label: 'GAFOR M6 (kritisch)', color: '#e08a3b', letter: 'M', code: 'M6' },
        M7: { key: 'gafor_m', label: 'GAFOR M7 (kritisch)', color: '#e08a3b', letter: 'M', code: 'M7' },
        M8: { key: 'gafor_m', label: 'GAFOR M8 (kritisch)', color: '#e08a3b', letter: 'M', code: 'M8' },
        X: { key: 'gafor_x', label: 'GAFOR X (geschlossen)', color: '#d14a4a', letter: 'X', code: 'X' }
    };
    const majorRank = { C: 0, O: 1, D: 2, M: 3, X: 4 };

    const visKnown = Number.isFinite(visKm);
    const cloudKnown = mosmixHasBknBelow500 || (hasCeilingCondition && Number.isFinite(cloudAboveRefFt));
    if (!visKnown && !cloudKnown) {
        const neutral = labels.UNKNOWN;
        return {
            ...neutral,
            score: null,
            mode: 'gafor_like',
            dataQuality: 'unknown',
            ceilingQuality: hasDenseLowWithoutBase ? 'unknown_dense_low_cloud' : 'unknown',
            displayCode: '?',
            dataWarning: hasDenseLowWithoutBase
                ? 'Sicht und Wolkenbasis fehlen; dichte Low-Bewoelkung erkannt.'
                : 'Sicht und Wolkenbasis fehlen.',
            visKm,
            cloudBaseFtAgl,
            cloudAboveRefFt,
            sectorRefFt: Number.isFinite(sectorRefFt) ? sectorRefFt : null,
            terrainPointFt: Number.isFinite(terrainPointFt) ? terrainPointFt : null,
            coverForCeiling,
            lowCoverForCeiling,
            mosmixN05Pct: Number.isFinite(mosmixN05Pct) ? mosmixN05Pct : null,
            mosmixLowCloudPct: Number.isFinite(mosmixLowCloudPct) ? mosmixLowCloudPct : null,
            visSource: Number.isFinite(mosmixVisibilityM) ? 'mosmix' : 'openmeteo',
            cloudSource: null,
            hasCeilingCondition,
            visClass: null,
            cloudClass: null
        };
    }

    const visBand = !visKnown ? null : (
        visKm < 1.5 ? 'x'
            : visKm < 5 ? 'v15_5'
                : visKm < 8 ? 'v5_8'
                    : visKm < 10 ? 'v8_10'
                        : 'v10_plus'
    );
    const cloudBand = !cloudKnown ? null : (
        mosmixHasBknBelow500 ? 'c_below_500'
            : cloudAboveRefFt < 500 ? 'c_below_500'
            : cloudAboveRefFt < 1000 ? 'c500_1000'
                : cloudAboveRefFt < 2000 ? 'c1000_2000'
                    : cloudAboveRefFt >= 5000 ? 'c5000_plus'
                        : 'c2000_5000'
    );

    const fullMatrix = {
        v15_5: { c_below_500: 'X', c500_1000: 'M8', c1000_2000: 'M7', c2000_5000: 'M6', c5000_plus: 'M6' },
        v5_8: { c_below_500: 'X', c500_1000: 'M5', c1000_2000: 'D4', c2000_5000: 'D3', c5000_plus: 'D3' },
        v8_10: { c_below_500: 'X', c500_1000: 'M2', c1000_2000: 'D1', c2000_5000: 'O', c5000_plus: 'O' },
        v10_plus: { c_below_500: 'X', c500_1000: 'M2', c1000_2000: 'D1', c2000_5000: 'O', c5000_plus: 'C' }
    };

    let code = null;
    if (visBand === 'x' || cloudBand === 'c_below_500') {
        code = 'X';
    } else if (visBand && cloudBand && fullMatrix[visBand] && fullMatrix[visBand][cloudBand]) {
        code = fullMatrix[visBand][cloudBand];
    } else if (visBand && !cloudBand) {
        if (visBand === 'v10_plus') code = 'C';
        else if (visBand === 'v8_10') code = 'O';
        else if (visBand === 'v5_8') code = 'D3';
        else if (visBand === 'v15_5') code = 'M6';
    } else if (!visBand && cloudBand) {
        if (cloudBand === 'c5000_plus') code = 'C';
        else if (cloudBand === 'c2000_5000') code = 'O';
        else if (cloudBand === 'c1000_2000') code = 'D1';
        else if (cloudBand === 'c500_1000') code = 'M2';
        else code = 'X';
    }
    if (!code || !labels[code]) code = 'D4';

    const cat = labels[code];
    const major = String(cat.letter || 'D');
    const dataQuality = hasDenseLowWithoutBase ? 'estimated' : 'valid';
    const displayCode = dataQuality === 'valid'
        ? cat.code
        : (String(cat.code || cat.letter || '?').length > 1
            ? `${String(cat.letter || cat.code || '?').slice(0, 1)}?`
            : `${String(cat.code || cat.letter || '?').slice(0, 1)}?`);
    const dataWarning = hasDenseLowWithoutBase
        ? 'Wolkenbasis fehlt trotz dichter Low-Bewoelkung; Klasse nur aus Sicht/Restdaten abgeleitet.'
        : '';
    const cloudSource = mosmixHasBknBelow500 ? 'mosmix_n05' : (Number.isFinite(cloudAboveRefFt) ? 'openmeteo_cloud_base' : null);
    return {
        ...cat,
        label: dataQuality === 'valid' ? cat.label : `${cat.label} (unsicher)`,
        score: Math.max(0, 100 - ((majorRank[major] || 2) * 25)),
        mode: 'gafor_like',
        dataQuality,
        ceilingQuality: mosmixHasBknBelow500 ? 'mosmix_n05' : (cloudKnown ? 'valid' : (hasDenseLowWithoutBase ? 'unknown_dense_low_cloud' : 'not_relevant')),
        displayCode,
        dataWarning,
        visKm,
        cloudBaseFtAgl,
        cloudAboveRefFt,
        sectorRefFt: Number.isFinite(sectorRefFt) ? sectorRefFt : null,
        terrainPointFt: Number.isFinite(terrainPointFt) ? terrainPointFt : null,
        coverForCeiling,
        lowCoverForCeiling,
        mosmixN05Pct: Number.isFinite(mosmixN05Pct) ? mosmixN05Pct : null,
        mosmixLowCloudPct: Number.isFinite(mosmixLowCloudPct) ? mosmixLowCloudPct : null,
        visSource: Number.isFinite(mosmixVisibilityM) ? 'mosmix' : 'openmeteo',
        cloudSource,
        hasCeilingCondition,
        visClass: visBand,
        cloudClass: cloudBand
    };
}

function vpClassifyVfrByModel(parts = {}, mode = null) {
    const activeMode = vpNormalizeVfrModel(mode || vpVfrIndexState.vfrModel);
    if (activeMode === 'gafor_like' || activeMode === 'gafor_sector') return vpClassifyGaforLike(parts);
    return vpClassifyInternalVfr(parts);
}

function vpSampleToParts(sample = {}) {
    return {
        cloudLow: sample.cloudLowPct,
        cloudMid: sample.cloudMidPct,
        cloudTotal: sample.cloudTotalPct,
        precipitation: sample.precipitationMm,
        rain: sample.rainMm,
        snow: sample.snowfallCm,
        wind: sample.wspd,
        visibility: sample.visibilityM,
        weatherCode: sample.weatherCode,
        cloudBaseM: sample.cloudBaseM,
        mosmixVisibilityM: sample.mosmixVisibilityM,
        mosmixN05Pct: sample.mosmixN05Pct,
        mosmixLowCloudPct: sample.mosmixLowCloudPct,
        mosmixStation: sample.mosmixStation,
        mosmixStationDistKm: sample.mosmixStationDistKm,
        sectorRefFt: sample.sectorRefFt,
        terrainPointFt: sample.terrainPointFt
    };
}

function vpEnsureVfrLayer() {
    if (!map) return null;
    if (!vpVfrIndexLayer) vpVfrIndexLayer = L.layerGroup();
    return vpVfrIndexLayer;
}

function vpClearVfrLayer() {
    if (!map || !vpVfrIndexLayer) return;
    vpVfrIndexLayer.clearLayers();
    if (map.hasLayer(vpVfrIndexLayer)) map.removeLayer(vpVfrIndexLayer);
}

function vpFormatVfrRemaining(ms) {
    const left = Math.max(0, Number(ms || 0));
    const min = Math.ceil(left / 60000);
    return `${min}m`;
}

function vpPickNearestTimeIndex(unixTimes, targetSec) {
    if (!Array.isArray(unixTimes) || unixTimes.length === 0) return 0;
    let best = 0;
    let diff = Infinity;
    for (let i = 0; i < unixTimes.length; i++) {
        const t = Number(unixTimes[i]);
        if (!Number.isFinite(t)) continue;
        const d = Math.abs(t - targetSec);
        if (d < diff) {
            diff = d;
            best = i;
        }
    }
    return best;
}

function vpFormatHm(ts) {
    try {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
        return '--:--';
    }
}

function vpPointKey(lat, lon) {
    return `${Number(lat).toFixed(4)}|${Number(lon).toFixed(4)}`;
}

function vpRoundToStep(value, step) {
    const s = Number(step);
    if (!Number.isFinite(s) || s <= 0) return Number(value || 0);
    return Math.round((Number(value || 0) / s)) * s;
}

function vpBuildTimelineKeyCandidates(lat, lon) {
    const out = [];
    const push = (a, b) => out.push(vpPointKey(a, b));
    push(lat, lon);
    push(Number(lat).toFixed(3), Number(lon).toFixed(3));
    // Open-Meteo sample cache quantisiert auf 0.05° (siehe profile.js),
    // deshalb bieten wir zusätzlich den 0.05-Grid-Key an.
    push(vpRoundToStep(lat, 0.05), vpRoundToStep(lon, 0.05));
    return Array.from(new Set(out));
}

function vpMosmixTargetsFromTimeline(timelines) {
    const nowSec = Math.round(Date.now() / 1000);
    const targets = [nowSec];
    if (timelines && Array.isArray(timelines.slotsMeta)) {
        timelines.slotsMeta.forEach(s => {
            const t = Number(s && s.targetSec);
            if (Number.isFinite(t)) targets.push(Math.round(t));
        });
    }
    return Array.from(new Set(targets)).slice(0, 4);
}

async function vpFetchMosmixGridForecast(points, timelines, countryCode) {
    const cc = String(countryCode || '').toUpperCase();
    if (!VP_MOSMIX_ACTIVE_COUNTRIES.has(cc)) return null;
    if (!Array.isArray(points) || points.length === 0) return null;
    const targets = vpMosmixTargetsFromTimeline(timelines);
    const res = await fetch(VP_MOSMIX_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
            points: points.map(p => ({ lat: Number(p.lat), lon: Number(p.lon) })),
            targets
        })
    });
    if (!res.ok) throw new Error(`MOSMIX HTTP ${res.status}`);
    const data = await res.json();
    if (!data || data.ok !== true || !Array.isArray(data.points)) return null;
    const byKey = Object.create(null);
    data.points.forEach((item) => {
        if (!item || item.ok !== true || !Number.isFinite(Number(item.lat)) || !Number.isFinite(Number(item.lon))) return;
        const current = item.current && typeof item.current === 'object' ? item.current : null;
        const station = item.station && typeof item.station === 'object' ? item.station : null;
        const rec = {
            station,
            current,
            targets: Array.isArray(item.targets) ? item.targets : []
        };
        vpBuildTimelineKeyCandidates(item.lat, item.lon).forEach(k => { byKey[k] = rec; });
    });
    return {
        byKey,
        attribution: data.attribution || 'Datenbasis: Deutscher Wetterdienst (DWD), MOSMIX_L; eigene Verarbeitung'
    };
}

function vpMosmixPartsFromValue(value, rec) {
    if (!value || typeof value !== 'object') return {};
    return {
        mosmixVisibilityM: Number(value.visibilityM),
        mosmixN05Pct: Number(value.n05Pct),
        mosmixLowCloudPct: Number(value.lowCloudPct),
        mosmixMidCloudPct: Number(value.midCloudPct),
        mosmixTotalCloudPct: Number(value.totalCloudPct),
        mosmixPrecipitationMm: Number(value.precipitationMm),
        mosmixWeatherCode: Number(value.weatherCode),
        mosmixStation: rec && rec.station ? String(rec.station.icao || rec.station.id || rec.station.name || '') : '',
        mosmixStationDistKm: rec && rec.station ? Number(rec.station.distKm) : null,
        mosmixTime: Number(value.time)
    };
}

function vpNearestMosmixTarget(rec, targetSec) {
    if (!rec || !Array.isArray(rec.targets) || rec.targets.length === 0) return rec && rec.current;
    const target = Number(targetSec);
    if (!Number.isFinite(target)) return rec.current || rec.targets[0];
    let best = rec.targets[0];
    let bestDiff = Infinity;
    rec.targets.forEach(item => {
        const t = Number(item && (item.target || item.time));
        if (!Number.isFinite(t)) return;
        const d = Math.abs(t - target);
        if (d < bestDiff) {
            best = item;
            bestDiff = d;
        }
    });
    return best || rec.current || null;
}

function vpMergeMosmixIntoSamples(samples, mosmix) {
    if (!mosmix || !mosmix.byKey || !Array.isArray(samples)) return samples;
    return samples.map(sample => {
        if (!sample || !Number.isFinite(Number(sample.lat)) || !Number.isFinite(Number(sample.lon))) return sample;
        let rec = null;
        const keys = vpBuildTimelineKeyCandidates(sample.lat, sample.lon);
        for (const k of keys) {
            if (mosmix.byKey[k]) { rec = mosmix.byKey[k]; break; }
        }
        if (!rec) return sample;
        return {
            ...sample,
            ...vpMosmixPartsFromValue(rec.current, rec)
        };
    });
}

function vpMergeMosmixIntoTimelines(timelines, mosmix) {
    if (!timelines || !timelines.byKey || !mosmix || !mosmix.byKey) return;
    Object.keys(timelines.byKey).forEach(key => {
        const rec = mosmix.byKey[key];
        const tl = timelines.byKey[key];
        if (!rec || !tl || !Array.isArray(tl.slots)) return;
        tl.slots.forEach((slot, idx) => {
            if (!slot || !slot.parts) return;
            const meta = Array.isArray(timelines.slotsMeta) ? timelines.slotsMeta[idx] : null;
            const targetSec = Number(meta && meta.targetSec);
            Object.assign(slot.parts, vpMosmixPartsFromValue(vpNearestMosmixTarget(rec, targetSec), rec));
        });
    });
}

function vpNormalizeVfrAmpelWindowMode(value) {
    const v = String(value || '').trim().toLowerCase();
    if (v === 'utc6') return 'utc6';
    return 'sun';
}

function vpGetVfrAmpelWindowModeLabel(mode) {
    const m = vpNormalizeVfrAmpelWindowMode(mode);
    if (m === 'utc6') return 'UTC 6h-Block';
    return 'SR/SS';
}

function vpGetNextVfrAmpelWindowMode(mode) {
    return vpNormalizeVfrAmpelWindowMode(mode) === 'utc6' ? 'sun' : 'utc6';
}

function vpFormatHmUtc(ts) {
    try {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    } catch (_) {
        return '--:--';
    }
}

function vpBuildUtc6AmpelPlan(nowMs = Date.now()) {
    const now = new Date(nowMs);
    const y = now.getUTCFullYear();
    const mon = now.getUTCMonth();
    const d = now.getUTCDate();
    const hour = now.getUTCHours();
    const blockStartHour = Math.floor(hour / 6) * 6;
    const blockStartMs = Date.UTC(y, mon, d, blockStartHour, 0, 0, 0);
    const blockEndMs = blockStartMs + (6 * 3600 * 1000);
    const slots = [];
    for (let i = 0; i < 3; i++) {
        const sMs = blockStartMs + (i * 2 * 3600 * 1000);
        const eMs = sMs + (2 * 3600 * 1000);
        slots.push({
            key: `utc6_${i}`,
            label: `${String((blockStartHour + i * 2) % 24).padStart(2, '0')}-${String((blockStartHour + i * 2 + 2) % 24).padStart(2, '0')}Z`,
            targetMs: sMs + (3600 * 1000),
            timeLabel: `${vpFormatHmUtc(sMs)}-${vpFormatHmUtc(eMs)}Z`
        });
    }
    const nowRatio = Math.max(0, Math.min(1, (nowMs - blockStartMs) / Math.max(1, blockEndMs - blockStartMs)));
    return {
        mode: 'utc6',
        slots,
        nowRatio,
        blockStartMs,
        blockEndMs,
        queryTimezone: 'GMT',
        queryPastHours: 6,
        queryForecastHours: 6
    };
}

function vpBuildSunAmpelPlan(srMs, ssMs, nowMs = Date.now()) {
    const dayMs = Math.max(2 * 3600 * 1000, ssMs - srMs);
    const slots = [
        { key: 'morning', label: 'Morgen', targetMs: srMs + dayMs * 0.2 },
        { key: 'noon', label: 'Mittag', targetMs: srMs + dayMs * 0.5 },
        { key: 'evening', label: 'Abend', targetMs: srMs + dayMs * 0.8 }
    ].map(s => ({ ...s, timeLabel: vpFormatHm(s.targetMs) }));
    const minTargetMs = Math.min(...slots.map(s => Number(s.targetMs)));
    const maxTargetMs = Math.max(...slots.map(s => Number(s.targetMs)));
    // Plus 1h Puffer, damit der naechste Stundenstempel sicher im Datensatz liegt.
    const dynPastHours = Math.max(0, Math.min(36, Math.ceil((nowMs - minTargetMs) / (3600 * 1000)) + 1));
    const dynForecastHours = Math.max(0, Math.min(36, Math.ceil((maxTargetMs - nowMs) / (3600 * 1000)) + 1));
    const nowRatio = Math.max(0, Math.min(1, (nowMs - srMs) / Math.max(1, (ssMs - srMs))));
    return {
        mode: 'sun',
        slots,
        nowRatio,
        queryTimezone: 'auto',
        queryPastHours: dynPastHours,
        queryForecastHours: dynForecastHours,
        sunriseMs: srMs,
        sunsetMs: ssMs
    };
}

function vpBuildAmpelSlotFallback(mode, parts = {}) {
    const activeMode = vpNormalizeVfrAmpelWindowMode(mode || vpVfrIndexState.ampelWindowMode);
    if (activeMode === 'utc6') {
        const plan = vpBuildUtc6AmpelPlan(Date.now());
        return {
            slots: plan.slots.map(s => ({ label: s.label, parts, timeLabel: s.timeLabel })),
            nowRatio: plan.nowRatio
        };
    }
    return {
        slots: [
            { label: 'Morgen', parts, timeLabel: '--:--' },
            { label: 'Mittag', parts, timeLabel: '--:--' },
            { label: 'Abend', parts, timeLabel: '--:--' }
        ],
        nowRatio: 0.5
    };
}

function vpRefreshTimelineClockInPlace(timeline) {
    if (!timeline || typeof timeline !== 'object') return { blockChanged: false };
    const mode = vpNormalizeVfrAmpelWindowMode(timeline.ampelMode || vpVfrIndexState.ampelWindowMode);
    if (mode === 'utc6') {
        const plan = vpBuildUtc6AmpelPlan(Date.now());
        const oldStart = Number(timeline.blockStartMs);
        timeline.nowRatio = plan.nowRatio;
        const changed = Number.isFinite(oldStart) && oldStart !== plan.blockStartMs;
        return { blockChanged: changed };
    }
    const sr = Number(timeline.sunriseMs);
    const ss = Number(timeline.sunsetMs);
    if (Number.isFinite(sr) && Number.isFinite(ss) && ss > sr) {
        const now = Date.now();
        timeline.nowRatio = Math.max(0, Math.min(1, (now - sr) / Math.max(1, ss - sr)));
    }
    return { blockChanged: false };
}

function vpBuildSectorAmpelHtml(sectorTl, nowRatio, currentCat = null) {
    if (!sectorTl || !Array.isArray(sectorTl.slots) || sectorTl.slots.length !== 3) return '';
    const slots = sectorTl.slots;
    const nowNorm = Math.max(0, Math.min(1, Number(nowRatio || 0)));
    const pointerLeft = 10 + (nowNorm * 80);
    const pointerIdx = Math.max(0, Math.min(2, Math.round(nowNorm * 2)));
    const mk = (s, fallback, forcedCat = null) => {
        const cat = vpClassifyVfrByModel((s && s.parts) || {}, vpVfrIndexState.vfrModel);
        const viewCat = forcedCat || cat;
        const letter = String((viewCat && (viewCat.displayCode || viewCat.code || viewCat.letter)) || fallback || '?').slice(0, 2);
        const color = (viewCat && viewCat.color) || '#9a9a9a';
        const uncertain = viewCat && viewCat.dataQuality && viewCat.dataQuality !== 'valid';
        const modelLabel = vpGetVfrModelMeta(vpVfrIndexState.vfrModel).label;
        const score = Number(viewCat && viewCat.score);
        const scoreTxt = Number.isFinite(score) ? ` • Score ${Math.round(score)}` : '';
        const warnTxt = (viewCat && viewCat.dataWarning) ? ` • ${viewCat.dataWarning}` : '';
        const title = `${(s && s.label) || ''} ${(s && s.timeLabel) || ''} • ${(viewCat && viewCat.label) || ''}${scoreTxt} • ${modelLabel}${warnTxt}`;
        const bg = uncertain ? 'rgba(238,242,247,0.82)' : color;
        const borderStyle = uncertain ? 'dashed' : 'solid';
        return `<div title="${escapePopupText(title)}" style="width:22px; height:14px; border:1px ${borderStyle} ${color}; border-radius:3px; background:${bg}; color:#111; display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:700; line-height:1;">${escapePopupText(letter)}</div>`;
    };
    const forced = [null, null, null];
    if (currentCat && typeof currentCat === 'object') {
        const slotNowCat = vpClassifyVfrByModel((slots[pointerIdx] && slots[pointerIdx].parts) || {}, vpVfrIndexState.vfrModel);
        const curCode = String(currentCat.displayCode || currentCat.code || currentCat.letter || '').slice(0, 2);
        const slotCode = String((slotNowCat && (slotNowCat.displayCode || slotNowCat.code || slotNowCat.letter)) || '').slice(0, 2);
        if (curCode && slotCode && curCode !== slotCode) forced[pointerIdx] = currentCat;
    }
    return `<div style="pointer-events:none; width:84px; height:26px; border-radius:4px; background:rgba(12,17,24,0.38); box-shadow:0 1px 5px rgba(0,0,0,0.32); backdrop-filter:blur(1.5px);">
        <div style="position:relative; height:8px;">
            <div style="position:absolute; left:10%; right:10%; top:3px; height:1px; background:rgba(208,220,236,0.45);"></div>
            <div style="position:absolute; left:${pointerLeft.toFixed(1)}%; top:1px; transform:translateX(-50%); width:0; height:0; border-left:4px solid transparent; border-right:4px solid transparent; border-top:6px solid rgba(228,239,252,0.95);"></div>
        </div>
        <div style="display:flex; align-items:center; justify-content:center; gap:4px; padding:0 4px;">
            ${mk(slots[0], 'M', forced[0])}
            ${mk(slots[1], 'M', forced[1])}
            ${mk(slots[2], 'A', forced[2])}
        </div>
    </div>`;
}

function vpExtractHourlyLocations(tlData) {
    let locations = [];
    if (Array.isArray(tlData)) {
        locations = tlData;
    } else if (tlData && tlData.hourly && Array.isArray(tlData.hourly.time) && Array.isArray(tlData.hourly.time[0])) {
        const count = tlData.hourly.time.length;
        for (let i = 0; i < count; i++) {
            locations.push({
                latitude: Array.isArray(tlData.latitude) ? tlData.latitude[i] : tlData.latitude,
                longitude: Array.isArray(tlData.longitude) ? tlData.longitude[i] : tlData.longitude,
                hourly: {
                    time: tlData.hourly.time[i] || [],
                    cloud_cover_low: tlData.hourly.cloud_cover_low && tlData.hourly.cloud_cover_low[i],
                    cloud_cover_mid: tlData.hourly.cloud_cover_mid && tlData.hourly.cloud_cover_mid[i],
                    cloud_cover: tlData.hourly.cloud_cover && tlData.hourly.cloud_cover[i],
                    precipitation: tlData.hourly.precipitation && tlData.hourly.precipitation[i],
                    rain: tlData.hourly.rain && tlData.hourly.rain[i],
                    snowfall: tlData.hourly.snowfall && tlData.hourly.snowfall[i],
                    wind_speed_10m: tlData.hourly.wind_speed_10m && tlData.hourly.wind_speed_10m[i],
                    visibility: tlData.hourly.visibility && tlData.hourly.visibility[i],
                    weather_code: tlData.hourly.weather_code && tlData.hourly.weather_code[i],
                    cloud_base: tlData.hourly.cloud_base && tlData.hourly.cloud_base[i]
                }
            });
        }
    } else {
        locations = [tlData];
    }
    return locations;
}

async function vpFetchVfrSectorTimelines(bounds, gridPoints, ampelMode = null) {
    if (!bounds || !Array.isArray(gridPoints) || gridPoints.length === 0) return null;
    const activeAmpelMode = vpNormalizeVfrAmpelWindowMode(ampelMode || vpVfrIndexState.ampelWindowMode);
    const centerLat = (bounds.minLat + bounds.maxLat) * 0.5;
    const centerLon = (bounds.minLon + bounds.maxLon) * 0.5;
    let slotPlan = null;
    if (activeAmpelMode === 'utc6') {
        slotPlan = vpBuildUtc6AmpelPlan(Date.now());
    } else {
        const sunriseUrl = `https://api.open-meteo.com/v1/forecast?latitude=${centerLat.toFixed(4)}&longitude=${centerLon.toFixed(4)}&daily=${encodeURIComponent('sunrise,sunset')}&forecast_days=1&timezone=auto`;
        const sunRes = await fetch(sunriseUrl);
        if (!sunRes.ok) throw new Error(`sunrise HTTP ${sunRes.status}`);
        const sunData = await sunRes.json();
        const srIso = sunData?.daily?.sunrise?.[0];
        const ssIso = sunData?.daily?.sunset?.[0];
        let srMs = Date.parse(srIso || '');
        let ssMs = Date.parse(ssIso || '');
        if (!Number.isFinite(srMs) || !Number.isFinite(ssMs) || ssMs <= srMs) {
            const now = new Date();
            const y = now.getFullYear();
            const m = now.getMonth();
            const d = now.getDate();
            srMs = new Date(y, m, d, 6, 0, 0).getTime();
            ssMs = new Date(y, m, d, 18, 0, 0).getTime();
        }
        slotPlan = vpBuildSunAmpelPlan(srMs, ssMs, Date.now());
    }
    const slots = (slotPlan && Array.isArray(slotPlan.slots)) ? slotPlan.slots : [];
    if (slots.length !== 3) throw new Error('ungueltiger Ampel-Zeitplan');
    const slotTargetsSec = slots.map(s => Math.round(s.targetMs / 1000));
    const slotLabels = slots.map(s => s.label);
    const hourlyVars = [
        'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'precipitation', 'rain',
        'snowfall', 'wind_speed_10m', 'visibility', 'weather_code', 'cloud_base'
    ];
    const byKey = Object.create(null);
    const chunkSize = 16;
    for (let start = 0; start < gridPoints.length; start += chunkSize) {
        const chunk = gridPoints.slice(start, start + chunkSize);
        const latArg = chunk.map(p => Number(p.lat).toFixed(4)).join(',');
        const lonArg = chunk.map(p => Number(p.lon).toFixed(4)).join(',');
        let timelineUrl = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(latArg)}&longitude=${encodeURIComponent(lonArg)}&hourly=${encodeURIComponent(hourlyVars.join(','))}&timezone=${encodeURIComponent(slotPlan.queryTimezone || 'auto')}&timeformat=unixtime`;
        const pastHours = Math.max(0, Math.round(Number(slotPlan.queryPastHours || 0)));
        const forecastHours = Math.max(0, Math.round(Number(slotPlan.queryForecastHours || 0)));
        if (pastHours > 0) timelineUrl += `&past_hours=${pastHours}`;
        if (forecastHours > 0) timelineUrl += `&forecast_hours=${forecastHours}`;
        const tlRes = await fetch(timelineUrl);
        if (!tlRes.ok) throw new Error(`timeline HTTP ${tlRes.status}`);
        const tlData = await tlRes.json();
        const locations = vpExtractHourlyLocations(tlData);
        for (let i = 0; i < chunk.length; i++) {
            const p = chunk[i];
            const loc = locations[i] || locations[0];
            const hourly = loc && loc.hourly;
            const times = hourly && hourly.time;
            if (!Array.isArray(times) || times.length === 0) continue;
            const slotOut = slotTargetsSec.map((targetSec, slotIdx) => {
                const hIdx = vpPickNearestTimeIndex(times, targetSec);
                const parts = {
                    cloudLow: hourly.cloud_cover_low && hourly.cloud_cover_low[hIdx],
                    cloudMid: hourly.cloud_cover_mid && hourly.cloud_cover_mid[hIdx],
                    cloudTotal: hourly.cloud_cover && hourly.cloud_cover[hIdx],
                    precipitation: hourly.precipitation && hourly.precipitation[hIdx],
                    rain: hourly.rain && hourly.rain[hIdx],
                    snow: hourly.snowfall && hourly.snowfall[hIdx],
                    wind: hourly.wind_speed_10m && hourly.wind_speed_10m[hIdx],
                    visibility: hourly.visibility && hourly.visibility[hIdx],
                    weatherCode: hourly.weather_code && hourly.weather_code[hIdx],
                    cloudBaseM: hourly.cloud_base && hourly.cloud_base[hIdx]
                };
                return {
                    label: slotLabels[slotIdx],
                    parts,
                    timeLabel: String(slots[slotIdx].timeLabel || vpFormatHm(slots[slotIdx].targetMs))
                };
            });
            const keys = vpBuildTimelineKeyCandidates(p.lat, p.lon);
            const latFromResp = Number(loc && loc.latitude);
            const lonFromResp = Number(loc && loc.longitude);
            if (Number.isFinite(latFromResp) && Number.isFinite(lonFromResp)) {
                vpBuildTimelineKeyCandidates(latFromResp, lonFromResp).forEach(k => keys.push(k));
            }
            Array.from(new Set(keys)).forEach(k => { byKey[k] = { slots: slotOut }; });
        }
    }
    const nowRatio = Number.isFinite(Number(slotPlan && slotPlan.nowRatio)) ? Number(slotPlan.nowRatio) : 0.5;
    return {
        byKey,
        sunriseMs: Number(slotPlan && slotPlan.sunriseMs),
        sunsetMs: Number(slotPlan && slotPlan.sunsetMs),
        blockStartMs: Number(slotPlan && slotPlan.blockStartMs),
        blockEndMs: Number(slotPlan && slotPlan.blockEndMs),
        ampelMode: activeAmpelMode,
        nowRatio,
        slotsMeta: slots.map(s => ({ label: s.label, timeLabel: s.timeLabel, targetSec: Math.round(Number(s.targetMs || 0) / 1000) }))
    };
}

function vpPopulateVfrCountrySelect() {
    const select = document.getElementById('vfrCountrySelect');
    if (!select) return;
    const expected = VP_VFR_INDEX_COUNTRIES.length + 1;
    if (select.options.length === expected) return;
    select.innerHTML = '';
    const autoOpt = document.createElement('option');
    autoOpt.value = 'auto';
    autoOpt.textContent = 'Auto (Planungsland)';
    select.appendChild(autoOpt);
    VP_VFR_INDEX_COUNTRIES.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.code;
        opt.textContent = `${item.code} - ${item.name}`;
        select.appendChild(opt);
    });
}

function vpUpdateVfrUi() {
    vpPopulateVfrCountrySelect();
    vpVfrIndexState.vfrModel = vpNormalizeVfrModel(vpVfrIndexState.vfrModel);
    vpVfrIndexState.ampelWindowMode = vpNormalizeVfrAmpelWindowMode(vpVfrIndexState.ampelWindowMode);
    vpVfrIndexState.plannedCountry = vpInferPlanningCountryCode();
    const plannedMeta = vpGetVfrCountryMeta(vpVfrIndexState.plannedCountry);
    const active = vpResolveActiveVfrCountry();
    vpVfrIndexState.activeCountry = active;

    const select = document.getElementById('vfrCountrySelect');
    if (select) {
        select.value = vpNormalizeVfrCountrySelection(vpVfrIndexState.selectedCountry);
    }
    const planningLabel = document.getElementById('vfrPlanningCountryLabel');
    if (planningLabel) {
        const plannedName = plannedMeta ? `${plannedMeta.code} - ${plannedMeta.name}` : 'unbekannt';
        planningLabel.textContent = `Planungsland: ${plannedName}`;
    }
    const modelSelect = document.getElementById('vfrModelSelect');
    if (modelSelect) modelSelect.value = vpVfrIndexState.vfrModel;
    const modelInfo = document.getElementById('vfrModelInfo');
    if (modelInfo) {
        const meta = vpGetVfrModelMeta(vpVfrIndexState.vfrModel);
        modelInfo.innerHTML = `<span style="color:#c6d8ea;">${escapePopupText(meta.summary)}</span><br>+ ${escapePopupText(meta.pros)}<br>- ${escapePopupText(meta.cons)}`;
    }
    const ampelWindowSelect = document.getElementById('vfrAmpelWindowSelect');
    if (ampelWindowSelect) ampelWindowSelect.value = vpVfrIndexState.ampelWindowMode;
    const ampelWindowBtn = document.getElementById('vfrAmpelWindowCycleBtn');
    if (ampelWindowBtn) {
        ampelWindowBtn.textContent = `Zeitfenster: ${vpGetVfrAmpelWindowModeLabel(vpVfrIndexState.ampelWindowMode)}`;
        ampelWindowBtn.style.background = vpNormalizeVfrAmpelWindowMode(vpVfrIndexState.ampelWindowMode) === 'utc6' ? '#2f5f94' : '#2E8B57';
        ampelWindowBtn.style.color = '#fff';
    }

    const status = document.getElementById('vfrIndexStatus');
    if (status) {
        if (window.mapHints.vfrIndex === false) {
            status.textContent = 'Status: Aus';
            status.style.color = '#9bb5d1';
        } else if (map && Number(map.getZoom()) < VP_VFR_INDEX_MIN_VISIBLE_ZOOM) {
            status.textContent = `Status: ausgeblendet (Zoom < ${VP_VFR_INDEX_MIN_VISIBLE_ZOOM})`;
            status.style.color = '#9bb5d1';
        } else if (vpVfrIndexState.inFlight) {
            status.textContent = `Status: Lade ${active}...`;
            status.style.color = '#f1c64a';
        } else if (vpVfrIndexState.lastError) {
            status.textContent = `Status: Fehler - ${vpVfrIndexState.lastError}`;
            status.style.color = '#f38f8f';
        } else if (vpVfrIndexState.lastUpdatedAt > 0) {
            const t = new Date(vpVfrIndexState.lastUpdatedAt).toLocaleTimeString();
            const countLabel = vpVfrIndexState.lastRenderMode === 'gafor_sector' ? 'Sektoren' : 'Punkte';
            status.textContent = `Status: ${active} - ${vpVfrIndexState.lastPointCount} ${countLabel} (${t}) - ${vpGetVfrModelMeta(vpVfrIndexState.vfrModel).label} - ${vpGetVfrAmpelWindowModeLabel(vpVfrIndexState.ampelWindowMode)}`;
            status.style.color = '#95d89d';
        } else {
            status.textContent = `Status: ${active} bereit - ${vpGetVfrModelMeta(vpVfrIndexState.vfrModel).label} - ${vpGetVfrAmpelWindowModeLabel(vpVfrIndexState.ampelWindowMode)}`;
            status.style.color = '#9bb5d1';
        }
    }

    const nextHint = document.getElementById('vfrNextFetchHint');
    const lastFetch = Number(vpVfrIndexState.lastFetchAtByCountry[active] || 0);
    const rem = Math.max(0, VP_VFR_INDEX_MIN_UPDATE_MS - (Date.now() - lastFetch));
    if (nextHint) nextHint.textContent = rem > 0 ? `auto in ${vpFormatVfrRemaining(rem)}` : 'auto bereit';

    const refreshBtn = document.getElementById('vfrRefreshBtn');
    if (refreshBtn) refreshBtn.disabled = !!vpVfrIndexState.inFlight;
    const ampelBtn = document.getElementById('vfrAmpelToggleBtn');
    if (ampelBtn) {
        const on = vpVfrIndexState.showSectorAmpel !== false;
        ampelBtn.textContent = `Ampel (${on ? 'An' : 'Aus'})`;
        ampelBtn.style.background = on ? '#2E8B57' : '#444';
        ampelBtn.style.color = '#fff';
    }
    const block = document.getElementById('vfrIndexMenuBlock');
    if (block) block.style.opacity = (window.mapHints.vfrIndex === false) ? '0.72' : '1';
}
window.vpUpdateVfrUi = vpUpdateVfrUi;

window.vpToggleVfrAmpel = function() {
    vpVfrIndexState.showSectorAmpel = !(vpVfrIndexState.showSectorAmpel !== false);
    localStorage.setItem('ga_vfr_sector_ampel', String(vpVfrIndexState.showSectorAmpel !== false));
    vpUpdateVfrUi();
    if (window.mapHints.vfrIndex !== false && map) {
        vpRefreshVfrLayerFromCache();
    }
};

window.vpSetVfrModel = function(value) {
    vpVfrIndexState.vfrModel = vpNormalizeVfrModel(value);
    localStorage.setItem('ga_vfr_index_model', vpVfrIndexState.vfrModel);
    vpUpdateVfrUi();
    if (window.mapHints.vfrIndex !== false && map) {
        const needsSectorSource = vpVfrIndexState.vfrModel === 'gafor_sector';
        const needsTerrainRefs = vpVfrIndexState.vfrModel === 'gafor_like'
            && Array.isArray(vpVfrIndexState.lastRenderedSamples)
            && vpVfrIndexState.lastRenderedSamples.some(s => s && !Number.isFinite(Number(s.sectorRefFt)));
        if ((needsTerrainRefs || needsSectorSource) && typeof window.renderVfrIndexOverlay === 'function') {
            window.renderVfrIndexOverlay(true);
        } else {
            vpRefreshVfrLayerFromCache();
        }
    }
};

window.vpSetVfrAmpelWindowMode = async function(value) {
    vpVfrIndexState.ampelWindowMode = vpNormalizeVfrAmpelWindowMode(value);
    localStorage.setItem('ga_vfr_ampel_window_mode', vpVfrIndexState.ampelWindowMode);
    vpUpdateVfrUi();
    if (window.mapHints.vfrIndex !== false && typeof window.renderVfrIndexOverlay === 'function') {
        await window.renderVfrIndexOverlay(true);
    } else if (map) {
        vpRefreshVfrLayerFromCache();
    }
};

window.vpCycleVfrAmpelWindowMode = async function() {
    const next = vpGetNextVfrAmpelWindowMode(vpVfrIndexState.ampelWindowMode);
    await window.vpSetVfrAmpelWindowMode(next);
};

function vpRenderVfrCells(samples, latStep, lonStep, timelines = null) {
    if (!map) return;
    const layer = vpEnsureVfrLayer();
    if (!layer) return;
    vpVfrIndexState.lastRenderedSamples = Array.isArray(samples) ? samples.slice() : [];
    vpVfrIndexState.lastRenderedSectors = [];
    vpVfrIndexState.lastRenderMode = 'grid';
    vpVfrIndexState.lastGridLatStep = Number(latStep || 0.4);
    vpVfrIndexState.lastGridLonStep = Number(lonStep || 0.4);
    layer.clearLayers();
    if (Number(map.getZoom()) < VP_VFR_INDEX_MIN_VISIBLE_ZOOM) {
        if (map.hasLayer(layer)) map.removeLayer(layer);
        return;
    }
    const halfLat = Math.max(0.12, latStep * 0.48);
    const halfLon = Math.max(0.12, lonStep * 0.48);
    const nowRatio = Number(timelines && timelines.nowRatio);
    const fallbackNowRatio = Number(vpBuildAmpelSlotFallback(vpVfrIndexState.ampelWindowMode, {}).nowRatio || 0.5);
    const byKey = (timelines && timelines.byKey) ? timelines.byKey : null;
    samples.forEach(sample => {
        if (!sample || !Number.isFinite(sample.lat) || !Number.isFinite(sample.lon)) return;
        const parts = vpSampleToParts(sample);
        const scoreOverride = Number(sample.vfrScoreOverride);
        let cat = vpClassifyVfrByModel(parts, vpVfrIndexState.vfrModel);
        if (Number.isFinite(scoreOverride) && vpNormalizeVfrModel(vpVfrIndexState.vfrModel) === 'internal') {
            const forced = vpMapVfrCategory(Math.max(0, Math.min(100, Math.round(scoreOverride))));
            cat = { ...forced, score: Math.max(0, Math.min(100, Math.round(scoreOverride))), mode: 'internal' };
        }
        let sectorCat = cat;
        let tl = null;
        if (byKey) {
            const cands = vpBuildTimelineKeyCandidates(sample.lat, sample.lon);
            for (const key of cands) {
                if (byKey[key]) { tl = byKey[key]; break; }
            }
        }
        // Im GAFOR-Modell soll die Sektorfarbe am aktuellen (Jetzt-)Wert haengen.
        if (vpNormalizeVfrModel(vpVfrIndexState.vfrModel) === 'gafor_like') {
            sectorCat = cat;
        }

        const south = Math.max(-89.5, sample.lat - halfLat);
        const north = Math.min(89.5, sample.lat + halfLat);
        const west = Math.max(-179.5, sample.lon - halfLon);
        const east = Math.min(179.5, sample.lon + halfLon);
        const latSpan = Math.max(1e-6, north - south);
        const lonSpan = Math.max(1e-6, east - west);
        // Randring mit ca. 12% Flaechenanteil:
        // innerArea ~= 88% => inset ~3.1% je Seite (1 - (1-2t)^2 = 0.12).
        const insetRatio = 0.031;
        const insetLat = Math.max(0.0008, latSpan * insetRatio);
        const insetLon = Math.max(0.0008, lonSpan * insetRatio);
        const iSouth = Math.min(north, south + insetLat);
        const iNorth = Math.max(south, north - insetLat);
        const iWest = Math.min(east, west + insetLon);
        const iEast = Math.max(west, east - insetLon);
        const outerRing = [[south, west], [south, east], [north, east], [north, west]];
        const innerRing = [[iSouth, iWest], [iNorth, iWest], [iNorth, iEast], [iSouth, iEast]];
        const cell = L.polygon([outerRing, innerRing], {
            stroke: true,
            color: sectorCat.color,
            weight: 1.2,
            opacity: sectorCat.dataQuality && sectorCat.dataQuality !== 'valid' ? 0.78 : 1,
            fillColor: sectorCat.color,
            fillOpacity: sectorCat.dataQuality && sectorCat.dataQuality !== 'valid' ? 0.20 : 0.45,
            fillRule: 'evenodd',
            dashArray: sectorCat.dataQuality && sectorCat.dataQuality !== 'valid' ? '4 4' : null,
            interactive: false
        });
        const windNum = Number(sample.wspd);
        const windTxt = Number.isFinite(windNum) ? `${Math.round(windNum)} kt` : '--';
        const modelName = vpGetVfrModelMeta(vpVfrIndexState.vfrModel).label;
        const scoreTxt = Number.isFinite(Number(cat.score)) ? ` • Score ${Math.round(Number(cat.score))}` : '';
        const catVisKm = Number(sectorCat && sectorCat.visKm);
        const visM = Number.isFinite(catVisKm) ? catVisKm * 1000 : Number(parts.visibility);
        const visTxt = Number.isFinite(visM) ? `${(visM / 1000).toFixed(1)} km` : '--';
        const cbm = Number(parts.cloudBaseM);
        const cbTxt = Number.isFinite(cbm) ? `${Math.round(cbm * 3.28084)} ft AGL` : '--';
        const codeTxt = sectorCat && (sectorCat.displayCode || sectorCat.code) ? ` (${sectorCat.displayCode || sectorCat.code})` : '';
        const refFt = Number(sectorCat && sectorCat.sectorRefFt);
        const cbRefFt = Number(sectorCat && sectorCat.cloudAboveRefFt);
        const refTxt = Number.isFinite(refFt) ? `${Math.round(refFt)} ft` : '--';
        const cbRefTxt = Number.isFinite(cbRefFt) ? `${Math.round(cbRefFt)} ft` : '--';
        const mxN05 = Number(parts.mosmixN05Pct);
        const mxLow = Number(parts.mosmixLowCloudPct);
        const mxStation = String(parts.mosmixStation || '').trim();
        const mxDist = Number(parts.mosmixStationDistKm);
        const mxTxt = (Number.isFinite(mxN05) || Number.isFinite(mxLow) || mxStation)
            ? ` • MOSMIX ${mxStation || ''}${Number.isFinite(mxDist) ? ` ${Math.round(mxDist)}km` : ''} N05 ${Number.isFinite(mxN05) ? `${Math.round(mxN05)}%` : '--'} Low ${Number.isFinite(mxLow) ? `${Math.round(mxLow)}%` : '--'}`
            : '';
        const qualityTxt = sectorCat && sectorCat.dataWarning ? ` • ${sectorCat.dataWarning}` : '';
        const pop = `${sectorCat.label}${codeTxt}${scoreTxt} • Wind ${windTxt} • VIS ${visTxt} • Base ${cbTxt} • Base ueber Ref ${cbRefTxt} • Ref ${refTxt} • ${modelName}${mxTxt}${qualityTxt}`;
        cell.bindTooltip(pop, { sticky: false, direction: 'top', opacity: 0.9 });
        cell.addTo(layer);

        if (!tl) {
            // Fallback: Ampel trotzdem anzeigen, auf Basis des aktuellen Zell-Scores.
            const fb = vpBuildAmpelSlotFallback(vpVfrIndexState.ampelWindowMode, parts);
            tl = { slots: fb.slots };
        }
        // Fehlende Timeline-Felder robust mit aktuellem Zell-Sample auffuellen,
        // damit die Boxen nicht auf neutrale D4-Klassen kippen.
        const tlForAmpel = {
            slots: (Array.isArray(tl.slots) ? tl.slots : []).map((slot) => ({
                ...slot,
                parts: {
                    ...parts,
                    ...(slot && slot.parts ? slot.parts : {})
                }
            }))
        };
        const ampelNowRatio = Number.isFinite(nowRatio) ? nowRatio : fallbackNowRatio;
        const ampelHtml = vpBuildSectorAmpelHtml(tlForAmpel, ampelNowRatio, sectorCat);
        if (ampelHtml && vpVfrIndexState.showSectorAmpel !== false) {
            const marker = L.marker([sample.lat, sample.lon], {
                icon: L.divIcon({
                    className: 'vp-vfr-sector-ampel',
                    html: ampelHtml,
                    iconSize: [84, 26],
                    iconAnchor: [42, 13]
                }),
                interactive: false,
                keyboard: false,
                zIndexOffset: 1250
            });
            marker.addTo(layer);
        }
    });
    if (!map.hasLayer(layer)) layer.addTo(map);
}

function vpRenderGaforSectorCells(sectorEntries, nowRatio = 0.5) {
    const layer = vpEnsureVfrLayer();
    if (!layer || !map) return;
    layer.clearLayers();
    const entries = Array.isArray(sectorEntries) ? sectorEntries : [];
    vpVfrIndexState.lastRenderedSectors = entries.map(e => ({ ...e }));
    vpVfrIndexState.lastRenderMode = 'gafor_sector';
    const modelName = vpGetVfrModelMeta(vpVfrIndexState.vfrModel).label;
    const ampelNowRatio = Number.isFinite(Number(nowRatio)) ? Number(nowRatio) : 0.5;

    entries.forEach((entry) => {
        const sector = entry && entry.sector;
        const cat = entry && entry.currentCat;
        const timeline = entry && entry.timeline;
        if (!sector || !Array.isArray(sector.polygon) || !cat) return;
        const color = cat.color || '#9a9a9a';
        const uncertain = cat.dataQuality && cat.dataQuality !== 'valid';
        const poly = L.polygon(sector.polygon, {
            stroke: true,
            color,
            weight: 1.25,
            opacity: uncertain ? 0.8 : 1,
            fillColor: color,
            fillOpacity: uncertain ? 0.22 : 0.46,
            dashArray: uncertain ? '4 4' : null,
            interactive: false
        });

        const codeTxt = cat && (cat.displayCode || cat.code) ? ` (${cat.displayCode || cat.code})` : '';
        const visTxt = Number.isFinite(Number(cat.visKm)) ? `${Number(cat.visKm).toFixed(1)} km` : '--';
        const mxN05 = Number(entry && entry.baseParts && entry.baseParts.mosmixN05Pct);
        const mxLow = Number(entry && entry.baseParts && entry.baseParts.mosmixLowCloudPct);
        const mxStation = String(entry && entry.baseParts && entry.baseParts.mosmixStation || '').trim();
        const mxDist = Number(entry && entry.baseParts && entry.baseParts.mosmixStationDistKm);
        const mxTxt = (Number.isFinite(mxN05) || Number.isFinite(mxLow) || mxStation)
            ? ` • MOSMIX ${mxStation || ''}${Number.isFinite(mxDist) ? ` ${Math.round(mxDist)}km` : ''} N05 ${Number.isFinite(mxN05) ? `${Math.round(mxN05)}%` : '--'} Low ${Number.isFinite(mxLow) ? `${Math.round(mxLow)}%` : '--'}`
            : '';
        const qualityTxt = cat.dataWarning ? ` • ${cat.dataWarning}` : '';
        const pop = `${sector.id} ${sector.name} • Ref ${Math.round(Number(sector.refFt) || 0)} ft • ${cat.label}${codeTxt} • VIS ${visTxt} • ${modelName}${mxTxt}${qualityTxt}`;
        poly.bindTooltip(pop, { sticky: false, direction: 'top', opacity: 0.9 });
        poly.addTo(layer);

        if (vpVfrIndexState.showSectorAmpel !== false && timeline && Array.isArray(timeline.slots) && timeline.slots.length === 3) {
            const ampelHtml = vpBuildSectorAmpelHtml(timeline, ampelNowRatio, cat);
            if (ampelHtml) {
                const marker = L.marker([sector.center.lat, sector.center.lon], {
                    icon: L.divIcon({
                        className: 'vp-vfr-sector-ampel',
                        html: ampelHtml,
                        iconSize: [84, 26],
                        iconAnchor: [42, 13]
                    }),
                    interactive: false,
                    keyboard: false,
                    zIndexOffset: 1260
                });
                marker.addTo(layer);
            }
        }
    });
    if (!map.hasLayer(layer)) layer.addTo(map);
}

window.vpRefreshVfrIndex = async function() {
    if (typeof window.renderVfrIndexOverlay === 'function') {
        await window.renderVfrIndexOverlay(true);
    }
};

window.vpSetVfrCountry = async function(value) {
    vpVfrIndexState.selectedCountry = vpNormalizeVfrCountrySelection(value);
    localStorage.setItem('ga_vfr_index_country', vpVfrIndexState.selectedCountry);
    vpUpdateVfrUi();
    if (window.mapHints.vfrIndex !== false && typeof window.renderVfrIndexOverlay === 'function') {
        await window.renderVfrIndexOverlay(true);
    }
};

window.renderVfrIndexOverlay = async function(forceFetch = false) {
    if (!map) return;
    vpUpdateVfrUi();
    if (window.mapHints.vfrIndex === false) {
        vpClearVfrLayer();
        vpUpdateVfrUi();
        return;
    }
    const active = vpResolveActiveVfrCountry();
    const bounds = vpGetVfrCountryBounds(active);
    if (!bounds) {
        vpVfrIndexState.lastError = 'keine Landesgrenzen';
        vpClearVfrLayer();
        vpUpdateVfrUi();
        return;
    }
    const activeVfrModel = vpNormalizeVfrModel(vpVfrIndexState.vfrModel);
    const sectorMode = activeVfrModel === 'gafor_sector';

    const lastFetch = Number(vpVfrIndexState.lastFetchAtByCountry[active] || 0);
    const elapsed = Date.now() - lastFetch;
    const hasCachedSamples = sectorMode
        ? (Array.isArray(vpVfrIndexState.lastRenderedSectors) && vpVfrIndexState.lastRenderedSectors.length > 0)
        : (Array.isArray(vpVfrIndexState.lastRenderedSamples) && vpVfrIndexState.lastRenderedSamples.length > 0);
    const cachedClock = vpRefreshTimelineClockInPlace(vpVfrIndexState.timeline);
    const cacheBlockChanged = !!(cachedClock && cachedClock.blockChanged);
    if (!forceFetch && !cacheBlockChanged && lastFetch > 0 && elapsed < VP_VFR_INDEX_MIN_UPDATE_MS && hasCachedSamples) {
        if (sectorMode) {
            vpRenderGaforSectorCells(
                vpVfrIndexState.lastRenderedSectors,
                Number(vpVfrIndexState.timeline && vpVfrIndexState.timeline.nowRatio)
            );
        } else if (Array.isArray(vpVfrIndexState.lastRenderedSamples) && vpVfrIndexState.lastRenderedSamples.length > 0) {
            vpRenderVfrCells(
                vpVfrIndexState.lastRenderedSamples,
                Number(vpVfrIndexState.lastGridLatStep || 0.4),
                Number(vpVfrIndexState.lastGridLonStep || 0.4),
                vpVfrIndexState.timeline || null
            );
        }
        vpUpdateVfrUi();
        return;
    }
    if (vpVfrIndexState.inFlight) return;
    vpVfrIndexState.inFlight = true;
    vpVfrIndexState.lastError = '';
    vpUpdateVfrUi();

    try {
        if (sectorMode && !VP_GAFOR_SECTOR_MODE_COUNTRIES.has(active)) {
            throw new Error('Sektor-Modell aktuell nur fuer DE verfuegbar');
        }
        const sectors = sectorMode ? vpBuildGaforSectorDefs(active) : [];
        const grid = sectorMode
            ? { points: vpBuildGaforSectorProbePoints(sectors), latStep: 0.6, lonStep: 0.8 }
            : vpBuildVfrGridPoints(bounds);
        if (!grid.points.length) throw new Error('keine Rasterpunkte');
        const samples = await window.fetchOpenMeteoWeatherPoints(grid.points, {
            includePressure: false,
            maxConcurrency: 3
        });
        const sectorRefs = activeVfrModel === 'gafor_like'
            ? await vpBuildSectorReferenceMap(grid.points, grid.latStep, grid.lonStep, { maxConcurrency: 4 })
            : Object.create(null);
        let timelines = null;
        try {
            timelines = await vpFetchVfrSectorTimelines(bounds, grid.points, vpVfrIndexState.ampelWindowMode);
        } catch (timelineErr) {
            console.warn('[VFR-Index] Timeline-Forecast fehlgeschlagen, nutze Fallback:', timelineErr);
            timelines = null;
        }
        let mosmix = null;
        try {
            mosmix = await vpFetchMosmixGridForecast(grid.points, timelines, active);
        } catch (mosmixErr) {
            console.warn('[VFR-Index] MOSMIX-Zusatzdaten nicht verfuegbar:', mosmixErr);
            mosmix = null;
        }
        if (timelines && timelines.byKey && !sectorMode) {
            grid.points.forEach((p) => {
                const keys = vpBuildTimelineKeyCandidates(p.lat, p.lon);
                let ref = null;
                for (const k of keys) {
                    if (sectorRefs[k]) { ref = sectorRefs[k]; break; }
                }
                if (!ref) return;
                for (const k of keys) {
                    const rec = timelines.byKey[k];
                    if (!rec || !Array.isArray(rec.slots)) continue;
                    rec.slots.forEach((slot) => {
                        if (!slot || !slot.parts) return;
                        slot.parts.sectorRefFt = ref.sectorRefFt;
                        slot.parts.terrainPointFt = ref.terrainPointFt;
                    });
                }
            });
        }
        if (timelines && timelines.byKey) vpMergeMosmixIntoTimelines(timelines, mosmix);
        let valid = Array.isArray(samples) ? samples.filter(s => s && Number.isFinite(s.lat) && Number.isFinite(s.lon)) : [];
        if (!sectorMode) {
            valid = valid.map((s) => {
                const keys = vpBuildTimelineKeyCandidates(s.lat, s.lon);
                let ref = null;
                for (const k of keys) {
                    if (sectorRefs[k]) { ref = sectorRefs[k]; break; }
                }
                if (!ref) return s;
                return {
                    ...s,
                    sectorRefFt: ref.sectorRefFt,
                    terrainPointFt: ref.terrainPointFt
                };
            });
        }
        valid = vpMergeMosmixIntoSamples(valid, mosmix);
        if (!sectorMode && valid.length === 0 && timelines && timelines.byKey) {
            const fallback = [];
            const nowRatio = Number(timelines.nowRatio);
            const slotIdx = Number.isFinite(nowRatio) ? Math.max(0, Math.min(2, Math.round(nowRatio * 2))) : 1;
            grid.points.forEach(p => {
                const cands = vpBuildTimelineKeyCandidates(p.lat, p.lon);
                let tl = null;
                for (const key of cands) {
                    if (timelines.byKey[key]) {
                        tl = timelines.byKey[key];
                        break;
                    }
                }
                if (!tl || !Array.isArray(tl.slots) || tl.slots.length < 1) return;
                const slot = tl.slots[Math.min(slotIdx, tl.slots.length - 1)] || tl.slots[0];
                const slotCat = vpClassifyVfrByModel((slot && slot.parts) || {}, vpVfrIndexState.vfrModel);
                const slotScore = Number(slotCat && slotCat.score);
                fallback.push({
                    lat: p.lat,
                    lon: p.lon,
                    cloudBaseM: Number(slot && slot.parts && slot.parts.cloudBaseM),
                    visibilityM: Number(slot && slot.parts && slot.parts.visibility),
                    weatherCode: Number(slot && slot.parts && slot.parts.weatherCode),
                    cloudLowPct: Number(slot && slot.parts && slot.parts.cloudLow),
                    cloudMidPct: Number(slot && slot.parts && slot.parts.cloudMid),
                    cloudTotalPct: Number(slot && slot.parts && slot.parts.cloudTotal),
                    mosmixVisibilityM: Number(slot && slot.parts && slot.parts.mosmixVisibilityM),
                    mosmixN05Pct: Number(slot && slot.parts && slot.parts.mosmixN05Pct),
                    mosmixLowCloudPct: Number(slot && slot.parts && slot.parts.mosmixLowCloudPct),
                    mosmixStation: slot && slot.parts && slot.parts.mosmixStation,
                    mosmixStationDistKm: Number(slot && slot.parts && slot.parts.mosmixStationDistKm),
                    precipitationMm: Number(slot && slot.parts && slot.parts.precipitation),
                    rainMm: Number(slot && slot.parts && slot.parts.rain),
                    snowfallCm: Number(slot && slot.parts && slot.parts.snow),
                    wspd: Number(slot && slot.parts && slot.parts.wind),
                    vfrScoreOverride: Number.isFinite(slotScore) ? slotScore : 60
                });
            });
            valid = fallback;
        }
        if (sectorMode) {
            const byPoint = Object.create(null);
            valid.forEach(v => {
                if (!v || !Number.isFinite(Number(v.lat)) || !Number.isFinite(Number(v.lon))) return;
                byPoint[vpPointKey(v.lat, v.lon)] = v;
            });
            const sectorEntries = vpBuildGaforSectorEntries(sectors, byPoint, timelines, Number(timelines && timelines.nowRatio));
            if (!sectorEntries.length) throw new Error('keine Sektordaten verfuegbar');
            vpRenderGaforSectorCells(sectorEntries, Number(timelines && timelines.nowRatio));
            vpVfrIndexState.lastRenderedSamples = [];
            vpVfrIndexState.lastRenderMode = 'gafor_sector';
            vpVfrIndexState.lastPointCount = sectorEntries.length;
        } else {
            if (valid.length === 0) throw new Error('keine Wetterdaten fuer Raster');
            vpRenderVfrCells(valid, grid.latStep, grid.lonStep, timelines);
            vpVfrIndexState.lastPointCount = valid.length;
        }
        vpVfrIndexState.lastFetchAtByCountry[active] = Date.now();
        vpVfrIndexState.lastUpdatedAt = Date.now();
        vpVfrIndexState.lastError = '';
        vpVfrIndexState.timeline = timelines;
    } catch (e) {
        vpVfrIndexState.lastError = (e && e.message) ? e.message : 'unknown';
        vpClearVfrLayer();
        vpVfrIndexState.timeline = null;
    } finally {
        vpVfrIndexState.inFlight = false;
        vpUpdateVfrUi();
    }
};

function vpScheduleVfrOverlayUpdate(forceFetch = false) {
    if (window.mapHints.vfrIndex === false) return;
    vpVfrOverlayScheduledForce = vpVfrOverlayScheduledForce || !!forceFetch;
    if (vpVfrOverlayTimer) clearTimeout(vpVfrOverlayTimer);
    vpVfrOverlayTimer = setTimeout(() => {
        vpVfrOverlayTimer = null;
        const scheduledForce = !!vpVfrOverlayScheduledForce;
        vpVfrOverlayScheduledForce = false;
        if (typeof window.renderVfrIndexOverlay === 'function') {
            window.renderVfrIndexOverlay(scheduledForce);
        }
    }, forceFetch ? 120 : 650);
}

function vpEnsureVfrAutoTimer() {
    if (vpVfrAutoTimer) return;
    vpVfrAutoTimer = setInterval(() => {
        if (window.mapHints.vfrIndex === false) return;
        if (!map) return;
        vpScheduleVfrOverlayUpdate(false);
        vpUpdateVfrUi();
    }, 60 * 1000);
}

function vpRefreshVfrLayerFromCache() {
    if (!map || window.mapHints.vfrIndex === false) return;
    vpRefreshTimelineClockInPlace(vpVfrIndexState.timeline);
    if (vpVfrIndexState.lastRenderMode === 'gafor_sector') {
        vpRenderGaforSectorCells(
            Array.isArray(vpVfrIndexState.lastRenderedSectors) ? vpVfrIndexState.lastRenderedSectors : [],
            Number(vpVfrIndexState.timeline && vpVfrIndexState.timeline.nowRatio)
        );
    } else {
        vpRenderVfrCells(
            Array.isArray(vpVfrIndexState.lastRenderedSamples) ? vpVfrIndexState.lastRenderedSamples : [],
            Number(vpVfrIndexState.lastGridLatStep || 0.4),
            Number(vpVfrIndexState.lastGridLonStep || 0.4),
            vpVfrIndexState.timeline || null
        );
    }
    vpUpdateVfrUi();
}

function escapePopupText(v) {
    return String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getAirportCountryCode(icao, fallbackCountry = '') {
    const cc = String(fallbackCountry || globalAirports?.[icao]?.country || '').trim().toUpperCase();
    return /^[A-Z]{2}$/.test(cc) ? cc : '';
}

function hasAipCoverageForAirport(icao, fallbackCountry = '') {
    if (!icao || icao === 'GPS' || icao === 'POI') return false;
    return Boolean(resolveAipCountryCode(icao, fallbackCountry));
}

function resolveAipCountryCode(icao, fallbackCountry = '') {
    const cc = getAirportCountryCode(icao, fallbackCountry);
    if (cc && AIP_POPUP_ROUTES[cc]) return cc;

    const code = String(icao || '').trim().toUpperCase();
    if (code.startsWith('LO')) return 'AT';
    if (code.startsWith('LF')) return 'FR';
    if (code.startsWith('EH')) return 'NL';
    if (code.startsWith('EG')) return 'GB';
    if (code.startsWith('ED') || code.startsWith('ET')) return 'DE';
    return null;
}

function getAipPopupUrl(icao, fallbackCountry = '') {
    const cc = resolveAipCountryCode(icao, fallbackCountry);
    if (!cc) return null;
    const route = AIP_POPUP_ROUTES[cc];
    return `https://aip.aero${route}?${encodeURIComponent(String(icao).trim().toUpperCase())}=`;
}

const AIP_PROXY_BASE = 'https://ga-proxy.einherjer.workers.dev';
const AIP_CHART_STORAGE_KEY = 'ga_aip_chart_settings_v1';
const AIP_CHART_UI_ENABLED = false;
const AIP_CHART_OPACITY_MIN = 0.15;
const AIP_CHART_OPACITY_MAX = 1.0;
const AIP_CHART_OPACITY_DEFAULT = 0.65;
const AIP_CHART_CAL_MARKER_STYLE = [
    { color: '#2ec4ff', fillColor: '#2ec4ff' },
    { color: '#ffd166', fillColor: '#ffd166' }
];
const AIP_PDFJS_CDN = {
    lib: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
};

let aipChartOverlayLayer = null;
let aipChartOverlayMeta = null;
let aipChartBusy = false;
let aipPrevClosePopupOnClick = null;
let aipChartCalibration = {
    active: false,
    targetIcao: '',
    step: 0,
    imagePoints: [],
    mapPoints: [],
    mapMarkers: []
};

function escapeJsSingleQuoted(v) {
    return String(v ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '')
        .replace(/\n/g, ' ');
}

function sanitizeAipIcaoKey(icao) {
    return String(icao || '').trim().toUpperCase();
}

function getAipStorageData() {
    try {
        const raw = localStorage.getItem(AIP_CHART_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (e) {
        return {};
    }
}

function saveAipStorageData(data) {
    try {
        localStorage.setItem(AIP_CHART_STORAGE_KEY, JSON.stringify(data || {}));
    } catch (e) { }
}

function getAipChartSettings(icao) {
    const key = sanitizeAipIcaoKey(icao);
    if (!key) return null;
    const all = getAipStorageData();
    const obj = all[key];
    return (obj && typeof obj === 'object') ? obj : null;
}

function patchAipChartSettings(icao, patch) {
    const key = sanitizeAipIcaoKey(icao);
    if (!key || !patch || typeof patch !== 'object') return;
    const all = getAipStorageData();
    const prev = (all[key] && typeof all[key] === 'object') ? all[key] : {};
    all[key] = { ...prev, ...patch };
    saveAipStorageData(all);
}

function normalizeAipOpacity(value) {
    let v = Number(value);
    if (!Number.isFinite(v)) return AIP_CHART_OPACITY_DEFAULT;
    if (v > 1) v = v / 100;
    v = Math.max(AIP_CHART_OPACITY_MIN, Math.min(AIP_CHART_OPACITY_MAX, v));
    return Math.round(v * 1000) / 1000;
}

function getAipCurrentOpacity(icao) {
    const key = sanitizeAipIcaoKey(icao);
    if (!key) return AIP_CHART_OPACITY_DEFAULT;
    if (aipChartOverlayMeta && aipChartOverlayMeta.icao === key) return normalizeAipOpacity(aipChartOverlayMeta.opacity);
    const saved = getAipChartSettings(key);
    if (saved && saved.opacity != null) return normalizeAipOpacity(saved.opacity);
    return AIP_CHART_OPACITY_DEFAULT;
}

function decodeAipStoredBounds(bounds) {
    if (!bounds || typeof bounds !== 'object') return null;
    const south = Number(bounds.south);
    const west = Number(bounds.west);
    const north = Number(bounds.north);
    const east = Number(bounds.east);
    if (![south, west, north, east].every(Number.isFinite)) return null;
    const s = Math.min(south, north);
    const n = Math.max(south, north);
    const w = Math.min(west, east);
    const e = Math.max(west, east);
    if (n - s < 0.00001 || e - w < 0.00001) return null;
    return L.latLngBounds([s, w], [n, e]);
}

function encodeAipBounds(bounds) {
    if (!bounds || typeof bounds.getSouth !== 'function') return null;
    return {
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast()
    };
}

function ensureAipOverlayPane() {
    if (!map) return null;
    let pane = map.getPane('aipChartPane');
    if (!pane) pane = map.createPane('aipChartPane');
    pane.style.zIndex = '320';
    pane.style.pointerEvents = 'none';
    return pane;
}

function getAipOverlayImageEl() {
    if (!aipChartOverlayLayer || typeof aipChartOverlayLayer.getElement !== 'function') return null;
    return aipChartOverlayLayer.getElement();
}

function setAipOverlayPointerEvents(enabled) {
    const pane = map && map.getPane ? map.getPane('aipChartPane') : null;
    if (pane) pane.style.pointerEvents = enabled ? 'auto' : 'none';
    const img = getAipOverlayImageEl();
    if (img) img.style.pointerEvents = enabled ? 'auto' : 'none';
}

function getAipStatusElementsForIcao(icao) {
    const key = sanitizeAipIcaoKey(icao);
    if (!key) return [];
    return Array.from(document.querySelectorAll(`.aip-overlay-status[data-aip-icao="${key}"]`));
}

function setAipOverlayStatus(icao, text, isError = false) {
    const targets = getAipStatusElementsForIcao(icao);
    targets.forEach(el => {
        el.textContent = String(text || '');
        el.style.color = isError ? '#b91c1c' : '#444';
    });
}

function refreshAipOverlayPopupUi(icao) {
    const key = sanitizeAipIcaoKey(icao);
    if (!key) return;
    const opacityPct = Math.round(getAipCurrentOpacity(key) * 100);
    const statusText = aipChartOverlayMeta && aipChartOverlayMeta.icao === key
        ? `Overlay aktiv (${Math.round((aipChartOverlayMeta.opacity || AIP_CHART_OPACITY_DEFAULT) * 100)}%)`
        : 'Overlay aus';

    const statusEls = getAipStatusElementsForIcao(key);
    statusEls.forEach(el => {
        if (!el.textContent || el.textContent.trim() === '' || /Overlay (aktiv|aus)/i.test(el.textContent.trim())) {
            el.textContent = statusText;
            el.style.color = '#444';
        }
    });

    Array.from(document.querySelectorAll(`.aip-opacity-slider[data-aip-icao="${key}"]`)).forEach(slider => {
        slider.value = String(opacityPct);
    });
    Array.from(document.querySelectorAll(`.aip-opacity-value[data-aip-icao="${key}"]`)).forEach(el => {
        el.textContent = `${opacityPct}%`;
    });
    Array.from(document.querySelectorAll(`.aip-calibrate-btn[data-aip-icao="${key}"]`)).forEach(btn => {
        btn.textContent = aipChartCalibration.active && aipChartCalibration.targetIcao === key
            ? '❌ Kalibrierung abbrechen'
            : '🎯 Kalibrieren (2 Punkte)';
    });
}

function clearAipCalibrationMarkers() {
    if (!map || !Array.isArray(aipChartCalibration.mapMarkers)) return;
    aipChartCalibration.mapMarkers.forEach(m => {
        try { map.removeLayer(m); } catch (e) { }
    });
    aipChartCalibration.mapMarkers = [];
}

function resetAipCalibrationState() {
    clearAipCalibrationMarkers();
    if (map && aipPrevClosePopupOnClick !== null) {
        map.options.closePopupOnClick = aipPrevClosePopupOnClick;
    }
    aipPrevClosePopupOnClick = null;
    aipChartCalibration = {
        active: false,
        targetIcao: '',
        step: 0,
        imagePoints: [],
        mapPoints: [],
        mapMarkers: []
    };
    setAipOverlayPointerEvents(false);
}

function addAipCalibrationMapMarker(latlng, idx) {
    if (!map || !latlng) return;
    const style = AIP_CHART_CAL_MARKER_STYLE[idx] || AIP_CHART_CAL_MARKER_STYLE[0];
    const marker = L.circleMarker(latlng, {
        radius: 5,
        color: style.color,
        fillColor: style.fillColor,
        fillOpacity: 0.9,
        weight: 2,
        interactive: false
    }).addTo(map);
    aipChartCalibration.mapMarkers.push(marker);
}

function getAipCalibrationInstruction() {
    switch (aipChartCalibration.step) {
        case 0: return 'Kalibrierung: Punkt 1 auf dem Blatt anklicken.';
        case 1: return 'Kalibrierung: zugehörigen Punkt 1 auf der Karte anklicken.';
        case 2: return 'Kalibrierung: Punkt 2 auf dem Blatt anklicken.';
        case 3: return 'Kalibrierung: zugehörigen Punkt 2 auf der Karte anklicken.';
        default: return 'Kalibrierung läuft…';
    }
}

function readAipImagePointFromEvent(evt) {
    const img = getAipOverlayImageEl();
    const oe = evt && evt.originalEvent;
    if (!img || !oe || !Number.isFinite(oe.clientX) || !Number.isFinite(oe.clientY)) return null;
    const rect = img.getBoundingClientRect();
    const x = oe.clientX - rect.left;
    const y = oe.clientY - rect.top;
    const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    if (!inside || rect.width < 2 || rect.height < 2) return null;

    const naturalW = aipChartOverlayMeta?.naturalWidth || img.naturalWidth || rect.width;
    const naturalH = aipChartOverlayMeta?.naturalHeight || img.naturalHeight || rect.height;
    return {
        x: (x / rect.width) * naturalW,
        y: (y / rect.height) * naturalH
    };
}

function finishAipCalibration(successMsg = '') {
    const key = sanitizeAipIcaoKey(aipChartCalibration.targetIcao);
    resetAipCalibrationState();
    if (key) refreshAipOverlayPopupUi(key);
    if (key && successMsg) setAipOverlayStatus(key, successMsg, false);
}

function abortAipCalibration(errorMsg = '') {
    const key = sanitizeAipIcaoKey(aipChartCalibration.targetIcao || aipChartOverlayMeta?.icao || '');
    resetAipCalibrationState();
    if (key) {
        refreshAipOverlayPopupUi(key);
        if (errorMsg) setAipOverlayStatus(key, errorMsg, true);
    }
}

function finalizeAipCalibration() {
    if (!aipChartOverlayLayer || !aipChartOverlayMeta) {
        abortAipCalibration('Kalibrierung nicht möglich: Kein Overlay aktiv.');
        return;
    }
    if (aipChartCalibration.imagePoints.length !== 2 || aipChartCalibration.mapPoints.length !== 2) {
        abortAipCalibration('Kalibrierung unvollständig.');
        return;
    }
    const w = Number(aipChartOverlayMeta.naturalWidth);
    const h = Number(aipChartOverlayMeta.naturalHeight);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 2 || h < 2) {
        abortAipCalibration('Kalibrierung fehlgeschlagen (Bildgröße ungültig).');
        return;
    }

    const ip1 = aipChartCalibration.imagePoints[0];
    const ip2 = aipChartCalibration.imagePoints[1];
    const mp1 = aipChartCalibration.mapPoints[0];
    const mp2 = aipChartCalibration.mapPoints[1];
    const dx = ip2.x - ip1.x;
    const dy = ip2.y - ip1.y;
    if (Math.abs(dx) < 8 || Math.abs(dy) < 8) {
        abortAipCalibration('Kalibrierung: Punkte liegen zu nah beieinander.');
        return;
    }

    const lonScale = (mp2.lng - mp1.lng) / dx;
    const lonOffset = mp1.lng - lonScale * ip1.x;
    const latScale = (mp2.lat - mp1.lat) / dy;
    const latOffset = mp1.lat - latScale * ip1.y;

    const west = lonOffset;
    const east = lonScale * w + lonOffset;
    const north = latOffset;
    const south = latScale * h + latOffset;

    const s = Math.min(south, north);
    const n = Math.max(south, north);
    const wst = Math.min(west, east);
    const est = Math.max(west, east);
    if (n - s < 0.00001 || est - wst < 0.00001) {
        abortAipCalibration('Kalibrierung: Ergebnis unplausibel.');
        return;
    }

    const bounds = L.latLngBounds([s, wst], [n, est]);
    aipChartOverlayLayer.setBounds(bounds);
    patchAipChartSettings(aipChartOverlayMeta.icao, { bounds: encodeAipBounds(bounds) });
    finishAipCalibration('Kalibrierung gespeichert.');
}

function handleAipCalibrationMapClick(evt) {
    if (!aipChartCalibration.active) return false;
    const key = sanitizeAipIcaoKey(aipChartCalibration.targetIcao || aipChartOverlayMeta?.icao || '');
    if (!key) return true;
    if (!aipChartOverlayLayer || !aipChartOverlayMeta || aipChartOverlayMeta.icao !== key) {
        abortAipCalibration('Kalibrierung abgebrochen: Overlay nicht mehr aktiv.');
        return true;
    }
    const expectImagePoint = aipChartCalibration.step % 2 === 0;
    if (expectImagePoint) {
        const imgPoint = readAipImagePointFromEvent(evt);
        if (!imgPoint) {
            setAipOverlayStatus(key, 'Bitte direkt auf das Anflugblatt klicken.', true);
            return true;
        }
        aipChartCalibration.imagePoints.push(imgPoint);
        aipChartCalibration.step += 1;
        setAipOverlayStatus(key, getAipCalibrationInstruction(), false);
        return true;
    }

    if (!evt || !evt.latlng) {
        setAipOverlayStatus(key, 'Ungültiger Kartenpunkt.', true);
        return true;
    }
    const pairIdx = aipChartCalibration.mapPoints.length;
    aipChartCalibration.mapPoints.push({ lat: evt.latlng.lat, lng: evt.latlng.lng });
    addAipCalibrationMapMarker(evt.latlng, pairIdx);
    aipChartCalibration.step += 1;

    if (aipChartCalibration.step >= 4) {
        finalizeAipCalibration();
    } else {
        setAipOverlayStatus(key, getAipCalibrationInstruction(), false);
    }
    return true;
}

function computeAipFallbackBounds(naturalWidth, naturalHeight) {
    const center = (map && typeof map.getCenter === 'function') ? map.getCenter() : { lat: 51.0, lng: 10.0 };
    const h = Number(naturalHeight) > 0 ? Number(naturalHeight) : 1000;
    const w = Number(naturalWidth) > 0 ? Number(naturalWidth) : 1000;
    const ratio = Math.max(0.35, Math.min(4.0, w / h));
    const halfLat = 0.11;
    const lonScale = Math.max(0.2, Math.cos((center.lat || 0) * Math.PI / 180));
    const halfLon = (halfLat * ratio) / lonScale;
    return L.latLngBounds(
        [center.lat - halfLat, center.lng - halfLon],
        [center.lat + halfLat, center.lng + halfLon]
    );
}

function applyAipChartOverlay(dataUrl, bounds, opacity) {
    if (!map || !dataUrl) return;
    ensureAipOverlayPane();
    if (aipChartOverlayLayer) {
        try { map.removeLayer(aipChartOverlayLayer); } catch (e) { }
        aipChartOverlayLayer = null;
    }
    aipChartOverlayLayer = L.imageOverlay(dataUrl, bounds, {
        pane: 'aipChartPane',
        opacity: normalizeAipOpacity(opacity),
        interactive: false
    }).addTo(map);
    setAipOverlayPointerEvents(false);
}

async function ensurePdfJsReady() {
    if (window.pdfjsLib) {
        if (window.pdfjsLib.GlobalWorkerOptions) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = AIP_PDFJS_CDN.worker;
        }
        return window.pdfjsLib;
    }
    await new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-aip-pdfjs="1"]');
        if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('PDF.js konnte nicht geladen werden.')), { once: true });
            return;
        }
        const script = document.createElement('script');
        script.src = AIP_PDFJS_CDN.lib;
        script.async = true;
        script.dataset.aipPdfjs = '1';
        script.onload = resolve;
        script.onerror = () => reject(new Error('PDF.js konnte nicht geladen werden.'));
        document.head.appendChild(script);
    });
    if (!window.pdfjsLib) throw new Error('PDF.js steht nicht zur Verfügung.');
    if (window.pdfjsLib.GlobalWorkerOptions) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = AIP_PDFJS_CDN.worker;
    }
    return window.pdfjsLib;
}

async function fetchAipFileViaProxy(fileUrl) {
    const proxyUrl = `${AIP_PROXY_BASE}/api/aip-chart/file?url=${encodeURIComponent(fileUrl)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Dateiabruf fehlgeschlagen (${res.status}) ${body || ''}`.trim());
    }
    const blob = await res.blob();
    const contentType = String(res.headers.get('content-type') || blob.type || '').toLowerCase();
    return { blob, contentType };
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
        reader.readAsDataURL(blob);
    });
}

function readImageSizeFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
        img.onerror = () => reject(new Error('Bildgröße konnte nicht gelesen werden.'));
        img.src = dataUrl;
    });
}

async function renderPdfBlobToImageData(pdfBlob) {
    const lib = await ensurePdfJsReady();
    const bytes = new Uint8Array(await pdfBlob.arrayBuffer());
    const loadingTask = lib.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/png');
    return { dataUrl, width: canvas.width, height: canvas.height };
}

async function resolveAipChartSource(icao, countryCode = '') {
    const key = sanitizeAipIcaoKey(icao);
    if (!key) throw new Error('ICAO fehlt.');
    const url = `${AIP_PROXY_BASE}/api/aip-chart/resolve?icao=${encodeURIComponent(key)}&country=${encodeURIComponent(String(countryCode || '').toUpperCase())}`;
    const res = await fetch(url);
    let payload = null;
    try { payload = await res.json(); } catch (e) { }
    if (!res.ok || !payload || payload.ok !== true) {
        const errCode = payload?.errorCode || `http_${res.status}`;
        throw new Error(`AIP-Quelle nicht verfügbar (${errCode}).`);
    }
    if (!payload.chartUrl || !payload.chartKind) {
        throw new Error(`AIP-Quelle ohne Chart-Link (${payload.errorCode || 'not_found'}).`);
    }
    return payload;
}

function persistAipOverlayState(icao, patch) {
    const key = sanitizeAipIcaoKey(icao);
    if (!key) return;
    patchAipChartSettings(key, patch);
}

window.loadAipChartOverlay = async function(icao, countryCode = '') {
    if (!map) return;
    const key = sanitizeAipIcaoKey(icao);
    if (!key) return;
    if (aipChartBusy) {
        setAipOverlayStatus(key, 'AIP-Overlay lädt bereits…', false);
        return;
    }
    if (aipChartCalibration.active) abortAipCalibration('');
    aipChartBusy = true;
    setAipOverlayStatus(key, 'AIP-Overlay wird geladen…', false);

    try {
        const resolved = await resolveAipChartSource(key, countryCode);
        const fetched = await fetchAipFileViaProxy(resolved.chartUrl);

        let imageData = null;
        if (resolved.chartKind === 'image' || fetched.contentType.startsWith('image/')) {
            const dataUrl = await blobToDataUrl(fetched.blob);
            const size = await readImageSizeFromDataUrl(dataUrl);
            imageData = { dataUrl, width: size.width, height: size.height, chartKind: 'image' };
        } else if (resolved.chartKind === 'pdf' || fetched.contentType.includes('pdf')) {
            const rendered = await renderPdfBlobToImageData(fetched.blob);
            imageData = { ...rendered, chartKind: 'pdf' };
        } else {
            throw new Error('Unbekanntes AIP-Format.');
        }

        const saved = getAipChartSettings(key);
        const savedBounds = decodeAipStoredBounds(saved?.bounds);
        const bounds = savedBounds || computeAipFallbackBounds(imageData.width, imageData.height);
        const opacity = getAipCurrentOpacity(key);

        applyAipChartOverlay(imageData.dataUrl, bounds, opacity);
        aipChartOverlayMeta = {
            icao: key,
            countryCode: String(countryCode || '').toUpperCase(),
            chartKind: imageData.chartKind,
            chartUrl: resolved.chartUrl,
            sourcePage: resolved.sourcePage || '',
            dfsLink: resolved.dfsLink || '',
            title: resolved.title || '',
            naturalWidth: imageData.width,
            naturalHeight: imageData.height,
            opacity: normalizeAipOpacity(opacity)
        };

        persistAipOverlayState(key, {
            opacity: aipChartOverlayMeta.opacity,
            chartKind: aipChartOverlayMeta.chartKind,
            chartUrl: aipChartOverlayMeta.chartUrl,
            sourcePage: aipChartOverlayMeta.sourcePage,
            dfsLink: aipChartOverlayMeta.dfsLink
        });
        refreshAipOverlayPopupUi(key);
        setAipOverlayStatus(key, `Overlay aktiv (${Math.round(aipChartOverlayMeta.opacity * 100)}%)`, false);
    } catch (e) {
        const msg = (e && e.message) ? e.message : 'Overlay konnte nicht geladen werden.';
        setAipOverlayStatus(key, msg, true);
    } finally {
        aipChartBusy = false;
    }
};

window.setAipChartOpacity = function(value, icao = '') {
    const opacity = normalizeAipOpacity(value);
    const requestedKey = sanitizeAipIcaoKey(icao);
    const key = requestedKey || sanitizeAipIcaoKey(aipChartOverlayMeta?.icao || '');
    if (aipChartOverlayLayer && typeof aipChartOverlayLayer.setOpacity === 'function') {
        if (!requestedKey || (aipChartOverlayMeta && aipChartOverlayMeta.icao === requestedKey)) {
            aipChartOverlayLayer.setOpacity(opacity);
        }
    }
    if (aipChartOverlayMeta && (!requestedKey || aipChartOverlayMeta.icao === requestedKey)) {
        aipChartOverlayMeta.opacity = opacity;
    }
    if (key) persistAipOverlayState(key, { opacity });
    if (key) {
        refreshAipOverlayPopupUi(key);
        if (aipChartOverlayMeta && aipChartOverlayMeta.icao === key) {
            setAipOverlayStatus(key, `Overlay aktiv (${Math.round(opacity * 100)}%)`, false);
        } else {
            setAipOverlayStatus(key, `Transparenz gespeichert (${Math.round(opacity * 100)}%)`, false);
        }
    }
};

window.clearAipChartOverlay = function() {
    const key = sanitizeAipIcaoKey(aipChartOverlayMeta?.icao || aipChartCalibration.targetIcao || '');
    if (aipChartOverlayLayer && map) {
        try { map.removeLayer(aipChartOverlayLayer); } catch (e) { }
    }
    aipChartOverlayLayer = null;
    aipChartOverlayMeta = null;
    abortAipCalibration('');
    if (key) {
        refreshAipOverlayPopupUi(key);
        setAipOverlayStatus(key, 'Overlay aus', false);
    }
};

window.startAipChartCalibration = function(icao = '') {
    const key = sanitizeAipIcaoKey(icao || aipChartOverlayMeta?.icao || '');
    if (aipChartCalibration.active) {
        abortAipCalibration('Kalibrierung abgebrochen.');
        return;
    }
    if (!aipChartOverlayLayer || !aipChartOverlayMeta || !key || aipChartOverlayMeta.icao !== key) {
        setAipOverlayStatus(key || '---', 'Bitte zuerst Overlay laden.', true);
        return;
    }
    aipChartCalibration.active = true;
    aipChartCalibration.targetIcao = key;
    aipChartCalibration.step = 0;
    aipChartCalibration.imagePoints = [];
    aipChartCalibration.mapPoints = [];
    clearAipCalibrationMarkers();
    if (map) {
        aipPrevClosePopupOnClick = map.options.closePopupOnClick;
        map.options.closePopupOnClick = false;
    }
    setAipOverlayPointerEvents(true);
    refreshAipOverlayPopupUi(key);
    setAipOverlayStatus(key, getAipCalibrationInstruction(), false);
};

function buildPopupFrequencyLines(icao) {
    if (!icao || typeof freqCache === 'undefined' || !Array.isArray(freqCache[icao])) {
        return '<span style="color:#666;">Frequenzen laden…</span>';
    }
    if (freqCache[icao].length === 0) {
        return '<span style="color:#666;">Keine Frequenzen verfügbar</span>';
    }
    return freqCache[icao]
        .slice(0, 6)
        .map(f => `📻 ${escapePopupText(f.label || 'Freq')}: ${escapePopupText(f.value || '--')}`)
        .join('<br>');
}

function updatePopupFrequencyBlock(containerId, icao) {
    if (!containerId || !icao) return;
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = buildPopupFrequencyLines(icao);
}

function getAirportTapRadiusPx(basePx = 34) {
    if (!map || !map.getZoom) return basePx;
    const z = map.getZoom();
    // Beim Rauszoomen deutlich kleinerer Clickspot, beim Reinzoomen komfortabel.
    // z=7 -> ~10px, z=10 -> ~19px, z=14 -> ~34px
    const scaled = 10 + ((z - 7) / 7) * (basePx - 10);
    return Math.max(8, Math.min(basePx, Math.round(scaled)));
}

function isMapUiClickTarget(evt) {
    const t = evt && evt.target;
    if (!t || !t.closest) return false;
    return Boolean(
        t.closest('.leaflet-control') ||
        t.closest('.map-overlay-btn') ||
        t.closest('.pb-btn') ||
        t.closest('#vpSettingsMenu') ||
        t.closest('#awmFreqBanner') ||
        t.closest('.telemetry-box') ||
        t.closest('.leaflet-popup') ||
        t.closest('.leaflet-tooltip')
    );
}

function ensureRouteLegLabelPane() {
    if (!map) return;
    if (map.getPane('routeLegLabelPane')) return;
    const pane = map.createPane('routeLegLabelPane');
    pane.style.zIndex = '350'; // Unter der Route (Overlay-Pane ~400)
    pane.style.pointerEvents = 'none';
}

function clearRouteLegLabels() {
    if (!map || !routeLegLabelMarkers.length) return;
    routeLegLabelMarkers.forEach(m => map.removeLayer(m));
    routeLegLabelMarkers = [];
}

function getLegScreenAngle(p1, p2) {
    const a = map.latLngToLayerPoint([p1.lat, p1.lng || p1.lon]);
    const b = map.latLngToLayerPoint([p2.lat, p2.lng || p2.lon]);
    let angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;
    return angle;
}

function formatNm(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.0';
    return (Math.round(n * 10) / 10).toFixed(1);
}

function renderRouteLegLabels() {
    clearRouteLegLabels();
    if (!map || !routeWaypoints || routeWaypoints.length < 2) return;
    ensureRouteLegLabelPane();
    const zoom = map.getZoom ? map.getZoom() : 10;
    const fontSize = Math.max(9, Math.min(14, Math.round(9 + ((zoom - 6) / 7) * 5)));
    const gap = Math.max(7, Math.round(fontSize * 0.4) + 4);

    for (let i = 0; i < routeWaypoints.length - 1; i++) {
        const p1 = routeWaypoints[i];
        const p2 = routeWaypoints[i + 1];
        const nav = calcNav(p1.lat, p1.lng || p1.lon, p2.lat, p2.lng || p2.lon);

        const midLat = (p1.lat + p2.lat) / 2;
        const midLng = ((p1.lng || p1.lon) + (p2.lng || p2.lon)) / 2;
        const angle = getLegScreenAngle(p1, p2).toFixed(1);

        const html = `
            <div class="route-leg-label" style="transform: translate(-50%, -50%) rotate(${angle}deg); --leg-fz:${fontSize}px; --leg-gap:${gap}px;">
                <div class="route-leg-course">${nav.brng}°</div>
                <div class="route-leg-dist">${formatNm(nav.dist)} NM</div>
            </div>
        `;

        const labelIcon = L.divIcon({
            className: 'route-leg-label-icon',
            html,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
        });

        const marker = L.marker([midLat, midLng], {
            icon: labelIcon,
            interactive: false,
            pane: 'routeLegLabelPane'
        }).addTo(map);

        routeLegLabelMarkers.push(marker);
    }
}

function toggleMeasureMode() {
    measureMode = !measureMode; const btn = document.getElementById('measureBtn');
    if (measureMode) {
        btn.innerText = '📏 Messen (An)'; btn.style.background = 'var(--piper-yellow)'; btn.style.color = '#000';
        document.getElementById('map').style.cursor = 'crosshair';
    } else {
        btn.innerText = '📏 Messen (Aus)'; btn.style.background = '#444'; btn.style.color = '#fff';
        document.getElementById('map').style.cursor = '';
    }
    if (map && typeof map.closePopup === 'function') map.closePopup();
    if (typeof renderMainRoute === 'function' && routeWaypoints && routeWaypoints.length > 0) renderMainRoute();
    if (typeof renderWeatherMarkers === 'function') renderWeatherMarkers();
    if (typeof liveGpsMarker !== 'undefined' && liveGpsMarker) {
        try {
            if (typeof liveGpsMarker.closePopup === 'function') liveGpsMarker.closePopup();
            const el = liveGpsMarker.getElement && liveGpsMarker.getElement();
            if (el) el.style.pointerEvents = measureMode ? 'none' : 'auto';
        } catch (e) { }
    }
}

function addMeasurePoint(latlng) {
    if (measureMarkers.length >= 2) { clearMeasure(); }
    const marker = L.marker(latlng, { icon: measureIcon, draggable: true }).addTo(map);
    marker.on('drag', updateMeasureRoute); marker.on('dragend', updateMeasureRoute);
    measureMarkers.push(marker); updateMeasureRoute();
}

function updateMeasureRoute() {
    if (measurePolyline) map.removeLayer(measurePolyline);
    if (measureTooltip) { map.removeLayer(measureTooltip); measureTooltip = null; }
    measurePoints = measureMarkers.map(m => m.getLatLng());

    if (measurePoints.length === 2) {
        measurePolyline = L.polyline(measurePoints, { color: '#f2c12e', weight: 4, dashArray: '6,6' }).addTo(map);
        const nav = calcNav(measurePoints[0].lat, measurePoints[0].lng || measurePoints[0].lon, measurePoints[1].lat, measurePoints[1].lng || measurePoints[1].lon);
        const centerLat = (measurePoints[0].lat + measurePoints[1].lat) / 2, centerLng = (measurePoints[0].lng + measurePoints[1].lng) / 2;
        const labelText = `<div style="font-weight:bold; font-size:14px; color:#111; text-align:center; line-height: 1.2;">${nav.brng}°<br>${formatNm(nav.dist)} NM</div>`;
        measureTooltip = L.tooltip({ permanent: true, direction: 'center', className: 'measure-label' }).setLatLng([centerLat, centerLng]).setContent(labelText).addTo(map);
    }
}

function clearMeasure() {
    if (measurePolyline) map.removeLayer(measurePolyline);
    if (measureTooltip) { map.removeLayer(measureTooltip); measureTooltip = null; }
    measureMarkers.forEach(m => map.removeLayer(m)); measurePoints = []; measureMarkers = [];
}

window.removeRouteWaypoint = function (index) { routeWaypoints.splice(index, 1); renderMainRoute(); };

function resetMainRoute() {
    if (typeof window.clearPinnedFlightReplay === 'function') window.clearPinnedFlightReplay();
    if (window._missionRouteWaypoints && window._missionRouteWaypoints.length >= 2) {
        routeWaypoints = JSON.parse(JSON.stringify(window._missionRouteWaypoints));
    } else if (routeWaypoints.length > 2) {
        routeWaypoints = [routeWaypoints[0], routeWaypoints[routeWaypoints.length - 1]];
    } else {
        return;
    }
    renderMainRoute();
    map.fitBounds(L.latLngBounds(routeWaypoints.map(p => [p.lat, p.lng ?? p.lon])), { padding: [40, 40] });
}

function renderMainRoute() {
    if (!map) initMapBase();
    const _routeKey = Array.isArray(routeWaypoints)
        ? routeWaypoints.map(p => `${(p.lat || 0).toFixed(5)},${((p.lng || p.lon) || 0).toFixed(5)}`).join('|')
        : '';
    if (window._lastReplayRouteKey !== _routeKey) {
        if (typeof window.clearPinnedFlightReplay === 'function') window.clearPinnedFlightReplay();
        window._lastReplayRouteKey = _routeKey;
    }
    window.vpBgNeedsUpdate = true;
    routeMarkers.forEach(m => map.removeLayer(m));
    routeMarkers = [];
    clearRouteLegLabels();

    if (routeWaypoints.length === 0) {
        if (polyline) { map.removeLayer(polyline); polyline = null; }
        if (window.hitBoxPolyline) { map.removeLayer(window.hitBoxPolyline); window.hitBoxPolyline = null; }
        return;
    }

    const lowFpsMode = window.isLowFpsMode && window.isLowFpsMode();
    if (!polyline) {
        polyline = L.polyline(routeWaypoints, {
            color: '#ff4444',
            weight: 8,
            dashArray: lowFpsMode ? null : '10,10',
            className: 'animated-route-line',
            interactive: false
        }).addTo(map);
    } else {
        polyline.setLatLngs(routeWaypoints);
        if (typeof polyline.setStyle === 'function') {
            polyline.setStyle({ dashArray: lowFpsMode ? null : '10,10' });
        }
    }

    if (!window.hitBoxPolyline) {
        window.hitBoxPolyline = L.polyline(routeWaypoints, { color: 'transparent', weight: 45, opacity: 0, className: 'interactive-route' }).addTo(map);
        window.hitBoxPolyline.on('click', function (e) {
            if (measureMode) return;
            let bestIndex = 1, minDiff = Infinity;
            for (let i = 0; i < routeWaypoints.length - 1; i++) {
                let p1 = L.latLng(routeWaypoints[i].lat, routeWaypoints[i].lng || routeWaypoints[i].lon);
                let p2 = L.latLng(routeWaypoints[i + 1].lat, routeWaypoints[i + 1].lng || routeWaypoints[i + 1].lon);
                let d1 = map.distance(p1, e.latlng), d2 = map.distance(e.latlng, p2), d = map.distance(p1, p2), diff = d1 + d2 - d;
                if (diff < minDiff) { minDiff = diff; bestIndex = i + 1; }
            }
            routeWaypoints.splice(bestIndex, 0, e.latlng); renderMainRoute();
        });
    } else {
        window.hitBoxPolyline.setLatLngs(routeWaypoints);
    }

    routeWaypoints.forEach((latlng, index) => {
        let isStart = (index === 0), isDest = (index === routeWaypoints.length - 1 && routeWaypoints.length > 1);
        let isPOI = routeWaypoints[index].isPOI === true;
        
        let icon = isStart ? startIcon : (isDest ? destIcon : (isPOI ? poiIcon : wpIcon));
        // Wir erlauben das Draggen von POIs und Wegpunkten. Start/Dest bleiben fix.
        let draggable = (!isStart && !isDest && !measureMode);
        // POI Marker immer nach vorne holen (Z-Index), damit er nicht hinter der Linie verschwindet
        let marker = L.marker(latlng, {
            icon: icon,
            draggable: draggable,
            interactive: !measureMode,
            riseOnHover: true,
            zIndexOffset: isPOI ? 3500 : 3000
        }).addTo(map);

        if (isStart) {
            marker.bindPopup('');
            marker.on('popupopen', () => {
                const depCountry = getAirportCountryCode(currentStartICAO);
                marker.getPopup().setContent(_buildAptPopup('DEP', currentSName, currentDepElev, currentStartICAO, {
                    runwayContainerId: 'wxPopupDepRwy',
                    freqContainerId: 'wxPopupDepFreq',
                    countryCode: depCountry,
                    showDirectTo: currentStartICAO && currentStartICAO !== 'GPS' && currentStartICAO !== currentDestICAO,
                    directToName: currentSName,
                    lat: latlng.lat,
                    lon: latlng.lng || latlng.lon
                }));
                marker.getPopup().update();
                const depIcao = currentStartICAO;
                if (depIcao) setTimeout(() => refreshAipOverlayPopupUi(depIcao), 0);
                if (depIcao && depIcao !== 'GPS' && typeof fetchRunwayDetails === 'function') {
                    fetchRunwayDetails(latlng.lat, latlng.lng || latlng.lon, 'wxPopupDepRwy', depIcao);
                }
                if (depIcao && depIcao !== 'GPS' && typeof fetchAirportFreq === 'function') {
                    updatePopupFrequencyBlock('wxPopupDepFreq', depIcao);
                    fetchAirportFreq(depIcao, null, null).finally(() => updatePopupFrequencyBlock('wxPopupDepFreq', depIcao));
                }
                if (depIcao && typeof loadMetarWidget === 'function') {
                    loadMetarWidget(depIcao, 'wxPopupDep', latlng.lat, latlng.lng || latlng.lon, true);
                }
            });
        } else if (isDest) {
            marker.bindPopup('');
            marker.on('popupopen', () => {
                const icao = currentMissionData && currentMissionData.poiName ? currentStartICAO : currentDestICAO;
                const elev = currentMissionData && currentMissionData.poiName ? currentDepElev : currentDestElev;
                const destCountry = getAirportCountryCode(icao);
                marker.getPopup().setContent(_buildAptPopup('DEST', currentDName, elev, icao, {
                    runwayContainerId: 'wxPopupDestRwy',
                    freqContainerId: 'wxPopupDestFreq',
                    countryCode: destCountry,
                    showDirectTo: Boolean(icao && icao !== currentDestICAO),
                    directToName: currentDName,
                    lat: latlng.lat,
                    lon: latlng.lng || latlng.lon
                }));
                marker.getPopup().update();
                if (icao) setTimeout(() => refreshAipOverlayPopupUi(icao), 0);
                if (icao && typeof fetchRunwayDetails === 'function') {
                    fetchRunwayDetails(latlng.lat, latlng.lng || latlng.lon, 'wxPopupDestRwy', icao);
                }
                if (icao && icao !== 'GPS' && typeof fetchAirportFreq === 'function') {
                    updatePopupFrequencyBlock('wxPopupDestFreq', icao);
                    fetchAirportFreq(icao, null, null).finally(() => updatePopupFrequencyBlock('wxPopupDestFreq', icao));
                }
                if (icao && typeof loadMetarWidget === 'function') {
                    loadMetarWidget(icao, 'wxPopupDest', latlng.lat, latlng.lng || latlng.lon, true);
                }
            });
        } else if (isPOI) {
            // POIs bekommen ein spezielles lila Popup ohne Löschen-Button (da es das Missionsziel ist)
            marker.bindPopup(`<div style="text-align:center; color:#b266ff;"><b>${routeWaypoints[index].name}</b></div>`);
        } else {
            let wpName = routeWaypoints[index].name ? `<b>${routeWaypoints[index].name}</b>` : `<b>Wegpunkt</b>`;
            const wpAirport = findNearestAirport(L.latLng(latlng.lat, latlng.lng || latlng.lon), getAirportTapRadiusPx(18));
            const infoBtn = wpAirport
                ? `<button onclick="openRouteWaypointAirportInfo(${index})" style="margin-top:5px; margin-right:4px; background:#235ea7; color:#fff; border:none; padding:4px 8px; cursor:pointer; border-radius:2px;">ℹ️ Info</button>`
                : '';
            marker.bindPopup(
                `<div style="text-align:center;">${wpName}<br>${infoBtn}<button onclick="removeRouteWaypoint(${index})" style="margin-top:5px; background:#d93829; color:#fff; border:none; padding:4px 8px; cursor:pointer; border-radius:2px;">🗑️ Löschen</button></div>`
            );
        }

        if (draggable) {
            marker.on('drag', function (e) {
                if (snapMode && cachedNavData.length > 0) {
                    let mousePoint = map.latLngToLayerPoint(e.latlng);
                    let closest = null;
                    let bestScore = -1;

                    cachedNavData.forEach(nav => {
                        let navPoint = map.latLngToLayerPoint([nav.lat, nav.lng]);
                        let d = mousePoint.distanceTo(navPoint);
                        if (d < 25) {
                            let score = 25 - d;
                            // PRIORITÄT: VORs und Airports gewinnen bei Überlappung
                            if (nav.name.includes('APT ')) score += 100;
                            else if (nav.name.includes('[')) score += 50;

                            if (score > bestScore) {
                                bestScore = score;
                                closest = nav;
                            }
                        }
                    });

                    if (closest) marker.setLatLng([closest.lat, closest.lng]);
                    else marker.setLatLng(e.latlng);
                }
            });

        marker.on('drag', function (e) {
            if (polyline) {
                const latlngs = polyline.getLatLngs();
                latlngs[index] = marker.getLatLng();
                polyline.setLatLngs(latlngs);
                if (typeof window.hitBoxPolyline !== 'undefined' && window.hitBoxPolyline) {
                    window.hitBoxPolyline.setLatLngs(latlngs);
                }
                scheduleWeatherMarkerDodging(true);
            }
        });

            marker.on('dragend', function (e) {
                let dropLatLng = marker.getLatLng();
                const origLatLng = { lat: routeWaypoints[index].lat, lng: routeWaypoints[index].lng || routeWaypoints[index].lon };

                // === NEU: SPEZIELLE POI LOGIK (Auto-Name & Fallback) ===
                if (isPOI) {
                    if (confirm("Möchtest du das Ziel für den Rundflug an diese Position verschieben?")) {
                        
                        const mDestName = document.getElementById("mDestName");
                        if (mDestName) mDestName.innerText = "Ermittle Ort...";
                        
                        setTimeout(async () => {
                            let newName = "Neuer Wendepunkt";
                            
                            // 1. Ort via Wikipedia (Geosearch) ermitteln
                            try {
                                const geoRes = await fetch(`https://de.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${dropLatLng.lat}|${dropLatLng.lng}&gsradius=10000&gslimit=1&format=json&origin=*`);
                                const geoData = await geoRes.json();
                                if (geoData?.query?.geosearch?.length > 0) {
                                    newName = geoData.query.geosearch[0].title;
                                } else {
                                    // Fallback auf Nominatim (OSM) wenn kein Wiki-Artikel in der Nähe ist
                                    const nomRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${dropLatLng.lat}&lon=${dropLatLng.lng}&zoom=10`);
                                    const nomData = await nomRes.json();
                                    if (nomData && nomData.name) newName = nomData.name;
                                }
                            } catch(e) {}
                            
                            // 2. POI aktualisieren
                            routeWaypoints[index].lat = dropLatLng.lat;
                            routeWaypoints[index].lng = dropLatLng.lng;
                            routeWaypoints[index].name = "🎯 " + newName;
                            
                            if (typeof currentMissionData !== 'undefined' && currentMissionData) {
                                currentMissionData.poiName = newName;
                            }
                            
                            // 3. Das dynamische Dreieck anpassen
                            const returnNav = calcNav(dropLatLng.lat, dropLatLng.lng, routeWaypoints[0].lat, routeWaypoints[0].lng || routeWaypoints[0].lon);
                            const offsetBearing = (returnNav.brng + 20) % 360;
                            const returnWp = getDestinationPoint(dropLatLng.lat, dropLatLng.lng, returnNav.dist * 0.45, offsetBearing);
                            
                            if (routeWaypoints.length > 2) {
                                routeWaypoints[2].lat = returnWp.lat;
                                routeWaypoints[2].lng = returnWp.lon;
                            }

                            // 4. UI aktualisieren
                            if (mDestName) mDestName.innerText = newName;
                            const wikiDestNameEl = document.getElementById('wikiDestNameDisplay');
                            if (wikiDestNameEl) wikiDestNameEl.innerText = `POI – ${newName}`;
                            
                            // 5. Wiki-Daten live laden
                            if (typeof fetchAreaDescription === 'function') {
                                const descEl = document.getElementById("wikiDestDescText");
                                if (descEl) descEl.innerText = "Lade neue Ziel-Info...";
                                fetchAreaDescription(dropLatLng.lat, dropLatLng.lng, 'wikiDestDescText', newName, null, 'wikiDestImageContainer', 'wikiDestImage');
                            }

                            // 6. KI-Briefing Story umschreiben (Live Dispatch)
                            renderMainRoute(); // Aktualisiert die Distanzen im Hintergrund
                            
                            const paxText = document.getElementById("mPay") ? document.getElementById("mPay").innerText : "0 PAX";
                            const cargoText = document.getElementById("mWeight") ? document.getElementById("mWeight").innerText : "0 lbs";
                            const totalDist = currentMissionData.dist;
                            
                            const titleEl = document.getElementById("mTitle");
                            const storyEl = document.getElementById("mStory");

                            // Freiflug-/Planungsmodus: POI verschieben, aber KEINE neue Mission erzeugen.
                            const selectedTypeRaw = String(
                                document.getElementById('targetType')?.value ||
                                localStorage.getItem('ga_target_type') ||
                                ''
                            ).toLowerCase();
                            let isPlanningOnlyMode = selectedTypeRaw.includes('+freeflight_planning');
                            if (!isPlanningOnlyMode && typeof parseMissionPickerValue === 'function') {
                                const parsed = parseMissionPickerValue(selectedTypeRaw);
                                isPlanningOnlyMode = String(parsed?.profile || '').toLowerCase() === 'freeflight_planning';
                            }
                            if (isPlanningOnlyMode) {
                                if (titleEl) titleEl.innerHTML = '🧭 Freiflug · POI-Ziel';
                                if (storyEl) storyEl.innerText = 'Kein Missionsauftrag erstellt. Das POI-Ziel wurde im Freiflug-/Planungsmodus verschoben.';
                                if (typeof currentMissionData !== 'undefined' && currentMissionData) {
                                    currentMissionData.mission = 'Freiflug · POI-Ziel';
                                }
                                window.debouncedSaveMissionState();
                                return;
                            }
                            
                            if (titleEl) titleEl.innerHTML = "🔄 Auftrag wird umgeschrieben...";
                            if (storyEl) storyEl.innerText = "Dispatcher passt die Story an das neue Ziel an...";
                            
                            // Die Gemini-Funktion gibt intern sofort 'null' zurück, wenn API aus/offline ist
                            let m = await fetchGeminiMission(currentSName, newName, totalDist, true, paxText, cargoText);
                            
                            if (m) {
                                if (titleEl) titleEl.innerHTML = `${m.i ? m.i + ' ' : ''}${m.t}`;
                                if (storyEl) storyEl.innerText = m.s;
                                currentMissionData.mission = m.t;
                            } else {
                                // Offline / Fallback Modus aus der lokalen Datenbank
                                let fallbackM;
                                if (typeof generateDynamicPOIMission === 'function') {
                                    const maxSeats = parseInt(document.getElementById("maxSeats")?.value || 4);
                                    fallbackM = generateDynamicPOIMission(newName, maxSeats);
                                    
                                    // Aktualisiert auch die Passagiere und Fracht passend zur Offline-Story
                                    if (document.getElementById("mPay")) document.getElementById("mPay").innerText = fallbackM.payloadText || paxText;
                                    if (document.getElementById("mWeight")) document.getElementById("mWeight").innerText = fallbackM.cargoText || cargoText;
                                } else if (typeof missions !== 'undefined') {
                                    fallbackM = missions[Math.floor(Math.random() * missions.length)];
                                } else {
                                    fallbackM = { t: "Privater Rundflug", s: `Umgeleiteter Flugpunkt: ${newName}`, i: "📋" };
                                }
                                
                                if (titleEl) titleEl.innerHTML = `${fallbackM.i ? fallbackM.i + ' ' : '📋 '}${fallbackM.t}`;
                                if (storyEl) storyEl.innerText = fallbackM.s;
                                currentMissionData.mission = fallbackM.t;
                            }
                            
                            window.debouncedSaveMissionState();
                        }, 50);

                        return;
                    } else {
                        // Abbruch: Marker schnipst an Original-Position zurück
                        routeWaypoints[index].lat = origLatLng.lat;
                        routeWaypoints[index].lng = origLatLng.lng;
                    }
                    renderMainRoute();
                    return;
                }
                // === ENDE POI LOGIK ===

                if (snapMode && cachedNavData.length > 0) {
                    let mousePoint = map.latLngToLayerPoint(dropLatLng);
                    let closest = null;
                    let bestScore = -1;

                    cachedNavData.forEach(nav => {
                        let navPoint = map.latLngToLayerPoint([nav.lat, nav.lng]);
                        let d = mousePoint.distanceTo(navPoint);
                        if (d < 25) {
                            let score = 25 - d;
                            if (nav.name.includes('APT ')) score += 100;
                            else if (nav.name.includes('[')) score += 50;

                            if (score > bestScore) {
                                bestScore = score;
                                closest = nav;
                            }
                        }
                    });

                    if (closest) {
                        routeWaypoints[index].lat = closest.lat;
                        routeWaypoints[index].lng = closest.lng;
                        routeWaypoints[index].name = closest.name;
                        routeWaypoints[index].rppAirportIcao = closest.rppAirportIcao || '';
                    } else {
                        routeWaypoints[index].lat = dropLatLng.lat;
                        routeWaypoints[index].lng = dropLatLng.lng;
                        routeWaypoints[index].name = null;
                        routeWaypoints[index].rppAirportIcao = '';
                    }
                } else {
                    routeWaypoints[index].lat = dropLatLng.lat;
                    routeWaypoints[index].lng = dropLatLng.lng;
                    routeWaypoints[index].name = null;
                    routeWaypoints[index].rppAirportIcao = '';
                }
                renderMainRoute();
            });
        }
        routeMarkers.push(marker);
    });

    renderRouteLegLabels();
    updateRoutePerformance(); updateMiniMap();
    if (routeWaypoints.length >= 2 && typeof triggerVerticalProfileUpdate === 'function') {
        triggerVerticalProfileUpdate();
    }
    scheduleWeatherMarkerDodging(true);
    vpUpdateVfrUi();
    if (window.mapHints.vfrIndex !== false && vpNormalizeVfrCountrySelection(vpVfrIndexState.selectedCountry) === 'auto') {
        vpScheduleVfrOverlayUpdate(false);
    }
}

window.openRouteWaypointAirportInfo = function (index) {
    if (!map || !Array.isArray(routeWaypoints)) return;
    const wp = routeWaypoints[index];
    if (!wp) return;
    const latlng = L.latLng(wp.lat, wp.lng || wp.lon);
    const apt = findNearestAirport(latlng, getAirportTapRadiusPx(18));
    if (!apt) return;
    openAirportInfoPopup(apt, latlng);
};

function findNearestEditableWaypoint(latlng, maxPixels = 28) {
    if (!map || !Array.isArray(routeWaypoints) || routeWaypoints.length < 3) return null;
    const tapPx = map.latLngToLayerPoint(latlng);
    let bestIndex = -1;
    let bestDist = maxPixels + 1;
    for (let i = 1; i < routeWaypoints.length - 1; i++) {
        const wp = routeWaypoints[i];
        if (!wp || wp.isPOI) continue;
        const wpPx = map.latLngToLayerPoint([wp.lat, wp.lng || wp.lon]);
        const d = tapPx.distanceTo(wpPx);
        if (d < bestDist) {
            bestDist = d;
            bestIndex = i;
        }
    }
    return bestIndex >= 0 ? bestIndex : null;
}

function _buildAptPopup(label, name, elev, icaoForRunways, options = {}) {
    const rwCacheKey = icaoForRunways || (label === 'DEP' ? currentStartICAO : currentDestICAO);
    const wxContainerId = options.wxContainerId || (label === 'DEP' ? 'wxPopupDep' : 'wxPopupDest');
    const runwayContainerId = options.runwayContainerId || null;
    const freqContainerId = options.freqContainerId || null;
    const countryCode = options.countryCode || '';
    const titleHtml = options.title || `<b style="font-size:13px;">${label}: ${name || '–'}</b>`;
    const showDirectTo = Boolean(options.showDirectTo && icaoForRunways && Number.isFinite(options.lat) && Number.isFinite(options.lon));
    const aipUrl = icaoForRunways ? getAipPopupUrl(icaoForRunways, countryCode) : null;
    const showAip = Boolean(aipUrl);
    const icaoSafe = sanitizeAipIcaoKey(icaoForRunways || '');
    const icaoEsc = escapeJsSingleQuoted(icaoSafe);
    const countryEsc = escapeJsSingleQuoted(String(countryCode || '').toUpperCase());
    const opacityPct = Math.round(getAipCurrentOpacity(icaoSafe) * 100);
    let html = `<div style="font-family:'Courier New',monospace; min-width:190px; color:#111;">`;
    html += titleHtml;

    if (elev != null) {
        const elevRnd = Math.round(elev);
        const tpa = elevRnd + 1000;
        html += `<hr style="border-color:#ccc; margin:5px 0;">`;
        html += `<div style="font-size:11px; line-height:1.7;">`;
        html += `📍 Platz: <b>${elevRnd} ft MSL</b><br>`;
        html += `🔄 Platzrunde: <b>~${tpa} ft MSL</b>`;
        html += `</div>`;
    }

    const runwayHtml = (() => {
        if (!rwCacheKey || typeof runwayCache === 'undefined' || !runwayCache[rwCacheKey] || runwayCache[rwCacheKey] === 'Keine Daten gefunden') {
            return runwayContainerId
                ? `<div id="${runwayContainerId}" style="font-size:11px; line-height:1.7; color:#666;">Pisten laden…</div>`
                : '';
        }

        const rwys = runwayCache[rwCacheKey]
            .split(/\s*(?:\||\n|<br\s*\/?>)\s*/i)
            .filter(r => r.trim());

        if (rwys.length === 0) return '';
        const lines = `🛫 Pisten:<br>` + rwys.map(r => `&nbsp;&nbsp;${r}`).join('<br>');
        return runwayContainerId
            ? `<div id="${runwayContainerId}" style="font-size:11px; line-height:1.7;">${lines}</div>`
            : `<div style="font-size:11px; line-height:1.7;">${lines}</div>`;
    })();

    if (runwayHtml) {
        html += `<hr style="border-color:#ccc; margin:5px 0;">`;
        html += runwayHtml;
    }

    if (icaoForRunways) {
        html += `<hr style="border-color:#ccc; margin:5px 0;">`;
        const freqBody = buildPopupFrequencyLines(icaoForRunways);
        html += freqContainerId
            ? `<div id="${freqContainerId}" style="font-size:11px; line-height:1.6;">${freqBody}</div>`
            : `<div style="font-size:11px; line-height:1.6;">${freqBody}</div>`;
    }

    if (showAip) {
        html += `<hr style="border-color:#ccc; margin:5px 0;">`;
        html += `<a href="${aipUrl}" target="_blank" rel="noopener noreferrer" style="display:block; font-size:11px; text-decoration:none; color:#0b1f65; font-weight:bold;">📄 AIP VFR öffnen ↗</a>`;
        if (AIP_CHART_UI_ENABLED) {
            html += `<div style="margin-top:6px; border:1px solid #ddd; border-radius:5px; padding:6px; background:#f8f8f8;">`;
            html += `<div class="aip-overlay-status" data-aip-icao="${icaoSafe}" style="font-size:10px; color:#444; margin-bottom:6px;">Overlay aus</div>`;
            html += `<button onclick="window.loadAipChartOverlay('${icaoEsc}','${countryEsc}')" style="display:block; width:100%; background:#235ea7; color:#fff; border:none; padding:6px 8px; cursor:pointer; border-radius:3px; font-size:11px; margin-bottom:4px;">🗺️ Overlay laden</button>`;
            html += `<button class="aip-calibrate-btn" data-aip-icao="${icaoSafe}" onclick="window.startAipChartCalibration('${icaoEsc}')" style="display:block; width:100%; background:#7c4d9e; color:#fff; border:none; padding:6px 8px; cursor:pointer; border-radius:3px; font-size:11px; margin-bottom:6px;">🎯 Kalibrieren (2 Punkte)</button>`;
            html += `<div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">`;
            html += `<span style="font-size:10px; color:#555; min-width:64px;">Transparenz</span>`;
            html += `<input class="aip-opacity-slider" data-aip-icao="${icaoSafe}" type="range" min="15" max="100" value="${opacityPct}" oninput="window.setAipChartOpacity(this.value, '${icaoEsc}'); this.nextElementSibling.textContent=this.value+'%';" style="flex:1;">`;
            html += `<span class="aip-opacity-value" data-aip-icao="${icaoSafe}" style="font-size:10px; color:#222; min-width:34px; text-align:right;">${opacityPct}%</span>`;
            html += `</div>`;
            html += `<button onclick="window.clearAipChartOverlay()" style="display:block; width:100%; background:#666; color:#fff; border:none; padding:5px 8px; cursor:pointer; border-radius:3px; font-size:10px;">Overlay aus</button>`;
            html += `</div>`;
        }
    }

    html += `<hr style="border-color:#ccc; margin:5px 0;">`;
    html += `<div id="${wxContainerId}" style="min-height:36px;">`;
    html += `<div style="font-size:10px; color:#aaa; text-align:center; padding:8px 0;">Wetter lädt…</div>`;
    html += `</div>`;

    if (showDirectTo) {
        const encodedName = encodeURIComponent(options.directToName || name || icaoForRunways);
        html += `<button onclick="window.confirmAirportDirectTo('${icaoForRunways}', ${Number(options.lat)}, ${Number(options.lon)}, '${encodedName}')" style="margin-top:8px; width:100%; background:#1f7a45; color:#fff; border:none; padding:8px 10px; cursor:pointer; border-radius:4px; font-weight:bold;">✈️ Direct To</button>`;
    }

    html += `</div>`;
    return html;
}

function getAirportDisplayName(apt) {
    return apt?.name || apt?.n || apt?.city || apt?.icao || 'Flugplatz';
}

function normalizeAirportForMap(apt) {
    if (!apt) return null;
    return {
        icao: apt.icao || apt.ident || '',
        name: getAirportDisplayName(apt),
        lat: Number(apt.lat),
        lon: Number(apt.lon ?? apt.lng),
        elevation: apt.elevation ?? null,
        country: apt.country || apt.iso_country || apt.cc || ''
    };
}

function openAirportInfoPopup(airport, latlng = null) {
    if (!map) return;
    const apt = normalizeAirportForMap(airport);
    if (!apt || !apt.icao || !Number.isFinite(apt.lat) || !Number.isFinite(apt.lon)) return;

    const popupLatLng = latlng || [apt.lat, apt.lon];
    const popupIdSafe = apt.icao.replace(/[^a-zA-Z0-9_-]/g, '_');
    const runwayId = `wxRwy_${popupIdSafe}`;
    const freqId = `wxFreq_${popupIdSafe}`;
    // Prefix "wxPopup" erzwingt im Widget die gleiche kompakte Start/Ziel-Darstellung
    const wxId = `wxPopupApt_${popupIdSafe}`;
    const elev = apt.elevation ?? (globalAirports?.[apt.icao]?.elevation ?? null);
    const countryCode = getAirportCountryCode(apt.icao, apt.country);
    const title = `<b style="font-size:13px;">${apt.icao}</b><div style="font-size:11px; color:#555; margin-top:2px;">${apt.name}</div>`;

    const html = _buildAptPopup('APT', apt.name, elev, apt.icao, {
        title,
        wxContainerId: wxId,
        runwayContainerId: runwayId,
        freqContainerId: freqId,
        countryCode,
        showDirectTo: true,
        directToName: apt.name,
        lat: apt.lat,
        lon: apt.lon
    });

    L.popup({ maxWidth: 290 })
        .setLatLng(popupLatLng)
        .setContent(html)
        .openOn(map);
    setTimeout(() => refreshAipOverlayPopupUi(apt.icao), 0);

    if (typeof fetchRunwayDetails === 'function') {
        fetchRunwayDetails(apt.lat, apt.lon, runwayId, apt.icao);
    }
    if (typeof fetchAirportFreq === 'function') {
        updatePopupFrequencyBlock(freqId, apt.icao);
        fetchAirportFreq(apt.icao, null, null).finally(() => updatePopupFrequencyBlock(freqId, apt.icao));
    }
    if (typeof loadMetarWidget === 'function') {
        loadMetarWidget(apt.icao, wxId, apt.lat, apt.lon, true);
    }
}

function hasActiveBriefingRoute() {
    const briefingBox = document.getElementById('briefingBox');
    return Boolean(briefingBox && briefingBox.style.display === 'block' && routeWaypoints && routeWaypoints.length > 0);
}

function getTasForRouteEstimate() {
    return parseInt(document.getElementById('tasSlider')?.value || 160, 10) || 160;
}

function getDirectToPrivateStoryText() {
    return 'Direct-To Modus aktiv: Story-Briefing ausgesetzt.';
}

function renderGpsStartBriefing(destAirport, startPoint) {
    const nav = calcNav(startPoint.lat, startPoint.lng, destAirport.lat, destAirport.lon);
    const tas = getTasForRouteEstimate();
    const eteMinutes = Math.max(1, Math.round((nav.dist / Math.max(1, tas)) * 60));
    const depLinks = document.getElementById('wikiDepLinks');
    const destLinks = document.getElementById('wikiDestLinks');
    const destSwitchRow = document.getElementById('destSwitchRow');

    document.getElementById('mTitle').innerHTML = '👤 Privater Flug';
    document.getElementById('mStory').innerText = getDirectToPrivateStoryText();
    document.getElementById('mDepICAO').innerText = 'GPS';
    document.getElementById('mDepName').innerText = 'Live GPS Position';
    document.getElementById('mDepCoords').innerText = `${startPoint.lat.toFixed(4)}, ${startPoint.lng.toFixed(4)}`;
    document.getElementById('mDepRwy').innerText = 'Live-Start';
    document.getElementById('destIcon').innerText = '🛬';
    document.getElementById('mDestICAO').innerText = destAirport.icao;
    document.getElementById('mDestName').innerText = destAirport.name;
    document.getElementById('mDestCoords').innerText = `${destAirport.lat.toFixed(4)}, ${destAirport.lon.toFixed(4)}`;
    document.getElementById('mPay').innerText = 'N/A';
    document.getElementById('mWeight').innerText = 'N/A';
    document.getElementById('mDistNote').innerText = `${formatNm(nav.dist)} NM`;
    document.getElementById('mHeadingNote').innerText = `${nav.brng}°`;
    document.getElementById('mETENote').innerText = `${eteMinutes} min`;
    if (typeof setDrumCounter === 'function') setDrumCounter('distDrum', parseFloat(formatNm(nav.dist)));
    if (typeof recalculatePerformance === 'function') recalculatePerformance();
    const indicator = document.getElementById('searchIndicator');
    if (indicator) indicator.innerText = 'Direct-To Flug bereit.';
    document.getElementById('briefingBox').style.display = 'block';
    document.getElementById('destRwyContainer').style.display = 'block';
    if (document.getElementById('wikiDestRwyText')) document.getElementById('wikiDestRwyText').style.display = 'block';
    if (destSwitchRow) destSwitchRow.style.display = 'flex';
    if (depLinks) depLinks.style.display = 'none';
    if (destLinks) destLinks.style.display = 'block';

    const wikiDepNameEl = document.getElementById('wikiDepNameDisplay');
    const wikiDestNameEl = document.getElementById('wikiDestNameDisplay');
    if (wikiDepNameEl) wikiDepNameEl.innerText = 'GPS – Live Position';
    if (wikiDestNameEl) wikiDestNameEl.innerText = `${destAirport.icao} – ${destAirport.name}`;

    const depFreq = document.getElementById('wikiDepFreqText');
    const destFreq = document.getElementById('wikiDestFreqText');
    if (depFreq) depFreq.innerHTML = '<span style="color:#888;">Live GPS Start</span>';
    if (destFreq) destFreq.innerHTML = 'Lade Frequenzen...';

    const depDesc = document.getElementById('wikiDepDescText');
    const destDesc = document.getElementById('wikiDestDescText');
    if (depDesc) depDesc.innerText = 'Live-Startpunkt vom Tracker. Umgebung wird geladen...';
    if (destDesc) destDesc.innerText = 'Ziel-Informationen werden geladen...';

    if (typeof fetchAreaDescription === 'function') {
        fetchAreaDescription(startPoint.lat, startPoint.lng, 'wikiDepDescText', 'Live GPS Position', null, 'wikiDepImageContainer', 'wikiDepImage');
        fetchAreaDescription(destAirport.lat, destAirport.lon, 'wikiDestDescText', null, destAirport.icao, 'wikiDestImageContainer', 'wikiDestImage');
    }
    if (typeof fetchAirportFreq === 'function') {
        fetchAirportFreq(destAirport.icao, 'wikiDestFreqText', 'dest');
    }
    if (typeof fetchRunwayDetails === 'function') {
        fetchRunwayDetails(destAirport.lat, destAirport.lon, 'mDestRwy', destAirport.icao);
    }
    if (typeof loadMetarWidget === 'function') {
        loadMetarWidget(null, 'metarContainerDep', startPoint.lat, startPoint.lng);
        loadMetarWidget(destAirport.icao, 'metarContainerDest', destAirport.lat, destAirport.lon);
    }
}

async function applyAirportDirectTo(airport, options = {}) {
    const destAirport = normalizeAirportForMap(airport);
    if (!destAirport || !destAirport.icao || !Number.isFinite(destAirport.lat) || !Number.isFinite(destAirport.lon)) return false;

    const forceGpsStart = Boolean(options.forceGpsStart);
    const hadFlightPlan = hasActiveBriefingRoute();
    const useExistingStart = hadFlightPlan && !forceGpsStart;
    const gpsLive = isGpsLive();
    let startPoint = null;
    let startData = null;

    if (useExistingStart) {
        const firstWp = routeWaypoints[0];
        startPoint = { lat: firstWp.lat, lng: firstWp.lng || firstWp.lon };
        if (currentStartICAO && currentStartICAO !== 'GPS' && typeof getAirportData === 'function') {
            startData = await getAirportData(currentStartICAO);
        }
    } else if (gpsLive && window.lastLiveGpsPos) {
        startPoint = { lat: window.lastLiveGpsPos.lat, lng: window.lastLiveGpsPos.lon };
    } else {
        alert('Ohne bestehenden Flugplan brauche ich eine aktive Tracker-Verbindung, damit die aktuelle GPS-Position als Start gesetzt werden kann.');
        return false;
    }

    const nav = calcNav(startPoint.lat, startPoint.lng, destAirport.lat, destAirport.lon);
    routeWaypoints = [
        { lat: startPoint.lat, lng: startPoint.lng },
        { lat: destAirport.lat, lng: destAirport.lon }
    ];

    currentDestICAO = destAirport.icao;
    currentDName = destAirport.name;
    currentDestElev = destAirport.elevation ?? (globalAirports?.[destAirport.icao]?.elevation ?? null);

    if (useExistingStart) {
        currentSName = startData?.n || currentSName || currentStartICAO || 'Start';
        currentDepElev = currentStartICAO && globalAirports?.[currentStartICAO]
            ? (globalAirports[currentStartICAO].elevation ?? null)
            : currentDepElev;
    } else {
        currentStartICAO = 'GPS';
        currentSName = 'Live GPS Position';
        currentDepElev = null;
    }

    currentMissionData = {
        start: currentStartICAO || 'GPS',
        dest: currentDestICAO,
        poiName: null,
        mission: 'Privater Flug',
        dist: nav.dist,
        ac: typeof selectedAC !== 'undefined' ? selectedAC : 'N/A',
        heading: nav.brng
    };
    currentDepFreq = '';
    currentDestFreq = '';

    const startLocEl = document.getElementById('startLoc');
    const startLocRadioEl = document.getElementById('startLocRadio');
    const destLocEl = document.getElementById('destLoc');
    const destLocRadioEl = document.getElementById('destLocRadio');
    if (startLocEl) startLocEl.value = currentStartICAO === 'GPS' ? '' : (currentStartICAO || '');
    if (startLocRadioEl) startLocRadioEl.value = currentStartICAO === 'GPS' ? 'GPS' : (currentStartICAO || '');
    if (destLocEl) destLocEl.value = currentDestICAO || '';
    if (destLocRadioEl) destLocRadioEl.value = currentDestICAO || '';

    if (useExistingStart && typeof populateBriefingUI === 'function') {
        const title = '👤 Privater Flug';
        const story = getDirectToPrivateStoryText();
        const pax = 'N/A';
        const cargo = 'N/A';
        const destData = { icao: destAirport.icao, n: destAirport.name, lat: destAirport.lat, lon: destAirport.lon };
        currentMissionData.mission = 'Privater Flug';
        populateBriefingUI(title, story, pax, cargo, false, routeWaypoints, startData, destData);
    } else {
        renderGpsStartBriefing(destAirport, startPoint);
        renderMainRoute();
        if (map) {
            const bounds = L.latLngBounds(routeWaypoints.map(w => [w.lat, w.lng || w.lon]));
            map.fitBounds(bounds, { padding: [60, 60] });
        }
        if (typeof updateMiniMap === 'function') updateMiniMap();
        if (typeof triggerVerticalProfileUpdate === 'function') triggerVerticalProfileUpdate();
        if (typeof refreshGPSAfterDispatch === 'function') refreshGPSAfterDispatch();
        if (typeof window.debouncedSaveMissionState === 'function') window.debouncedSaveMissionState();
    }

    if (useExistingStart && typeof refreshGPSAfterDispatch === 'function') refreshGPSAfterDispatch();

    showMapToast('Direct to ' + destAirport.icao);
    return true;
}

window.confirmAirportDirectTo = async function(icao, lat, lon, encodedName = '') {
    const name = encodedName ? decodeURIComponent(encodedName) : icao;
    if (!confirm(`${icao} als Ziel übernehmen?`)) return false;

    // Wenn Live-GPS vorhanden ist, wird automatisch GPS als Start priorisiert.
    const forceGpsStart = isGpsLive();
    return applyAirportDirectTo({ icao, name, lat, lon }, { forceGpsStart });
};

function updateRoutePerformance() {
    if (routeWaypoints.length < 2 || !currentMissionData) return;
    let totalNM = 0, wpHTML = '';
    const tas = parseInt(document.getElementById("tasSlider").value) || 160;
    const gph = parseInt(document.getElementById("gphSlider").value) || 14;

    let totalTime = 0;
    let totalFuel = 0;

    let blHTML = '<table style="width:100%; border-collapse:collapse; text-align:left; font-size:14px; font-family:\'Courier New\', monospace; font-weight:bold; color:var(--navlog-text); margin-top:5px;">';
    blHTML += '<colgroup><col style="width:30%;"><col style="width:20%;"><col style="width:16%;"><col style="width:10%;"><col style="width:10%;"><col style="width:14%;"></colgroup>';
    blHTML += '<tr style="border-bottom:2px solid var(--navlog-border); color:var(--navlog-heading);"><th>Route</th><th>FREQ</th><th>HDG</th><th>NM</th><th>Min</th><th>Gal</th></tr>';

    for (let i = 0; i < routeWaypoints.length - 1; i++) {
        let p1 = routeWaypoints[i], p2 = routeWaypoints[i + 1], nav = calcNav(p1.lat, p1.lng || p1.lon, p2.lat, p2.lng || p2.lon);
        totalNM += nav.dist;

        let isStart = (i === 0);
        let isEnd = (i === routeWaypoints.length - 2);

        let name1 = isStart ? currentStartICAO : (routeWaypoints[i].name || `WP ${i}`);
        
        let name2;
        if (isEnd) {
            // Bei einem Rundflug (POI-Mission) ist das Endziel der Startplatz
            name2 = (currentMissionData && currentMissionData.poiName) ? currentStartICAO : currentDestICAO;
        } else {
            name2 = routeWaypoints[i + 1].name || `WP ${i + 1}`;
        }

        let cleanName1 = name1.replace(/^RPP\s+/i, '').replace(/^APT\s+/i, '');
        let cleanName2 = name2.replace(/^RPP\s+/i, '').replace(/^APT\s+/i, '');

        // Frequenz aus Namen extrahieren
        let f1 = "";
        let m1 = cleanName1.match(/\(([^)]+)\)/);
        if (m1) { f1 = m1[1]; cleanName1 = cleanName1.replace(/\s*\([^)]+\)/, ''); }
        else if (isStart && currentDepFreq) { f1 = currentDepFreq; }

        let f2 = "";
        let m2 = cleanName2.match(/\(([^)]+)\)/);
        if (m2) { f2 = m2[1]; cleanName2 = cleanName2.replace(/\s*\([^)]+\)/, ''); }
        else if (isEnd && currentDestFreq) { f2 = currentDestFreq; }

        // VOR Klammern erhalten - nur Kennung nutzen wenn vorhanden
        let v1 = cleanName1.match(/\[([^\]]+)\]/);
        let isV1 = !!v1;
        if (v1) cleanName1 = `[${v1[1].trim().split(/\s+/)[0]}]`;
        else cleanName1 = cleanName1.trim();

        let v2 = cleanName2.match(/\[([^\]]+)\]/);
        let isV2 = !!v2;
        if (v2) cleanName2 = `[${v2[1].trim().split(/\s+/)[0]}]`;
        else cleanName2 = cleanName2.trim();

        let legTime = Math.round((nav.dist / tas) * 60);
        let legFuel = parseFloat((nav.dist / tas * gph).toFixed(1));

        totalTime += legTime;
        totalFuel += legFuel;

        const c1 = isV1 ? 'var(--navlog-text)' : 'var(--navlog-freq)';
        const c2 = isV2 ? 'var(--navlog-text)' : 'var(--navlog-freq)';

        blHTML += `<tr style="border-bottom:1px dashed var(--navlog-border);">`;
        blHTML += `<td style="padding:8px 0 8px 8px; color:var(--navlog-text); line-height: 1.4;"><span style="display:inline-block; min-width:20px; text-align:right;">${i + 1}.</span> ${cleanName1}<br><span style="display:inline-block; min-width:20px; text-align:left;">➔</span> ${cleanName2}</td>`;
        blHTML += `<td style="padding:8px 0 8px 4px; font-size:14px; line-height: 1.6;"><span style="color:${c1}">${f1}</span><br><span style="color:${c2}">${f2}</span></td>`;
        blHTML += `<td style="padding:8px 0 8px 16px; color:var(--navlog-data); vertical-align:middle;">${nav.brng}°</td>`;
        blHTML += `<td style="padding:8px 0; color:var(--navlog-data); vertical-align:middle;">${formatNm(nav.dist)}</td>`;
        blHTML += `<td style="padding:8px 0; color:var(--navlog-data); vertical-align:middle;">${legTime}</td>`;
        blHTML += `<td style="padding:8px 0; color:var(--navlog-data); vertical-align:middle;">${legFuel.toFixed(1)}</td>`;
        blHTML += `</tr>`;

        wpHTML += `<div class="wp-row"><span class="wp-name">${cleanName1.replace(/<[^>]+>/g, '').trim()} ➔ ${cleanName2.replace(/<[^>]+>/g, '').trim()}</span><span class="wp-data">${nav.brng}° | ${formatNm(nav.dist)} NM</span></div>`;
    }

    const totalNmDisplay = formatNm(totalNM);
    blHTML += `<tr style="border-top:2px solid var(--navlog-border); color:var(--navlog-heading); font-size:15px;"><td style="padding-top:8px;">TOTAL</td><td style="padding-top:8px;"></td><td style="padding-top:8px;"></td><td style="padding-top:8px;">${totalNmDisplay}</td><td style="padding-top:8px;">${totalTime}</td><td style="padding-top:8px;">${totalFuel.toFixed(1)}</td></tr>`;
    blHTML += '</table>';

    const blDiv = document.getElementById('briefingNavLog');
    if (blDiv) blDiv.innerHTML = blHTML;

    let initialNav = calcNav(routeWaypoints[0].lat, routeWaypoints[0].lng || routeWaypoints[0].lon, routeWaypoints[1].lat, routeWaypoints[1].lng || routeWaypoints[1].lon);

    if (currentMissionData) {
        currentMissionData.dist = parseFloat(totalNmDisplay);
        currentMissionData.heading = initialNav.brng;
    }

    setDrumCounter('distDrum', parseFloat(totalNmDisplay));
    const mHeadingNote = document.getElementById("mHeadingNote"); if (mHeadingNote) mHeadingNote.innerText = `${initialNav.brng}°`;
    const wpListContainer = document.getElementById("waypointList"); if (wpListContainer) wpListContainer.innerHTML = wpHTML;

    recalculatePerformance();
    const mDistNote = document.getElementById("mDistNote"); if (mDistNote) mDistNote.innerText = `${totalNmDisplay} NM`;
    const hrs = Math.floor(totalTime / 60), mins = totalTime % 60;
    const mETENote = document.getElementById("mETENote"); if (mETENote) mETENote.innerText = hrs > 0 ? `${hrs}h ${mins}m` : `${mins} Min.`;

    // Trigger Airspace Check
    if (window.airspaceFetchTimeout) clearTimeout(window.airspaceFetchTimeout);
    window.airspaceFetchTimeout = setTimeout(() => {
        fetchRouteAirspaces(routeWaypoints);
    }, 800);

    // Trigger Vertical Profile Update
    triggerVerticalProfileUpdate();

    window.debouncedSaveMissionState();
    if (gpsState.visible && gpsState.mode === 'FPL') renderGPS();
}

function initMapBase() {
    if (map) return;
    const radarActive = localStorage.getItem('ga_radar_active') === 'true';
    
    // Base Maps
    const topoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { attribution: 'OpenTopoMap' });
    const topoLightMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}', { attribution: 'Esri' });
    const satMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Esri' });
    const darkMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: 'CartoDB' });
    const lightMap = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: 'CartoDB' });
    
    // Overlays
    const aeroOverlay = L.tileLayer('https://nwy-tiles-api.prod.newaydata.com/tiles/{z}/{x}/{y}.png?path=latest/aero/latest', {
        attribution: 'AeroData / Navigraph', opacity: 0.65, maxNativeZoom: 12
    });
    
    // NEU: Die offizielle DFS ICAO 1:500.000 Karte vom Secais Server
    const dfsIcaoOverlay = L.tileLayer('https://secais.dfs.de/static-maps/icao500/tiles/{z}/{x}/{y}.png', {
        attribution: '© DFS Deutsche Flugsicherung', maxNativeZoom: 11, opacity: 1.0
    });
    ensureTerrainAvoidOverlayLayer();

    topoMap.setOpacity(0.5);
    map = L.map('map', { layers: [topoMap, aeroOverlay], attributionControl: false }).setView([51.1657, 10.4515], 6);
    
    const baseMaps = {
        "⛰️ Topografie (Mit Text)": topoMap,
        "🗺️ Terrain (Ohne Text)": topoLightMap,
        "🛰️ Satellit": satMap,
        "🌑 Dark Mode (Clean)": darkMap,
        "📝 Blank Mode (Weiß)": lightMap
    };
    
    const radarOverlay = L.layerGroup();
    fetch('https://api.rainviewer.com/public/weather-maps.json')
        .then(res => res.json())
        .then(data => {
            if (data && data.radar && data.radar.past && data.radar.past.length > 0) {
                const latestRadar = data.radar.past[data.radar.past.length - 1].path;
                L.tileLayer(`https://tilecache.rainviewer.com${latestRadar}/256/{z}/{x}/{y}/2/1_1.png`, {
                    opacity: 0.65, transparent: true, maxNativeZoom: 7, attribution: 'Radar © RainViewer'
                }).addTo(radarOverlay); if (radarActive) radarOverlay.addTo(map);
            }
        }).catch(e => console.warn('RainViewer Fetch Fehler:', e));
        
    const overlayMaps = {
        "🗺️ DFS ICAO Karte 1:500k": dfsIcaoOverlay,
        "🛩️ VFR Lufträume (Overlay)": aeroOverlay,
        "🌧️ Wetterradar (Niederschlag)": radarOverlay,
        "🏔️ Terrain Avoid (Live)": terrainAvoidOverlayLayer
    };
    
    const layerControl = L.control.layers(baseMaps, overlayMaps, { collapsed: true }).addTo(map);
    if (layerControl && layerControl._container) {
        const lc = layerControl._container;
        // Hover-Verhalten robust deaktivieren: Leaflet nutzt je nach Version
        // mouseover/mouseout oder mouseenter/mouseleave.
        const expandFn = (typeof layerControl.expand === 'function') ? layerControl.expand
            : ((typeof layerControl._expand === 'function') ? layerControl._expand : null);
        const collapseFn = (typeof layerControl.collapse === 'function') ? layerControl.collapse
            : ((typeof layerControl._collapse === 'function') ? layerControl._collapse : null);
        const origExpand = expandFn ? expandFn.bind(layerControl) : null;
        const origCollapse = collapseFn ? collapseFn.bind(layerControl) : null;

        // Harte Absicherung: Expand nur aus unserem Klick-Flow erlauben.
        layerControl._allowManualExpand = false;
        if (origExpand) {
            layerControl.expand = function() {
                if (!this._allowManualExpand) return this;
                return origExpand();
            };
            layerControl._expand = layerControl.expand;
        }
        if (origCollapse) {
            layerControl.collapse = function() {
                return origCollapse();
            };
            layerControl._collapse = layerControl.collapse;
        }
        if (expandFn) {
            L.DomEvent.off(lc, 'mouseover', expandFn, layerControl);
            L.DomEvent.off(lc, 'mouseenter', expandFn, layerControl);
            L.DomEvent.off(lc, 'pointerenter', expandFn, layerControl);
        }
        if (collapseFn) {
            L.DomEvent.off(lc, 'mouseout', collapseFn, layerControl);
            L.DomEvent.off(lc, 'mouseleave', collapseFn, layerControl);
            L.DomEvent.off(lc, 'pointerleave', collapseFn, layerControl);
        }

        const toggle = lc.querySelector('.leaflet-control-layers-toggle');
        if (toggle) {
            // Falls Touch-Click expand bereits von Leaflet gebunden ist, entfernen
            if (expandFn) {
                L.DomEvent.off(toggle, 'click', expandFn, layerControl);
                L.DomEvent.off(toggle, 'focus', expandFn, layerControl);
            }
            L.DomEvent.on(toggle, 'click', L.DomEvent.stop);
            L.DomEvent.on(toggle, 'click', () => {
                const isOpen = L.DomUtil.hasClass(lc, 'leaflet-control-layers-expanded');
                if (isOpen && typeof layerControl.collapse === 'function') {
                    layerControl.collapse();
                } else if (!isOpen && typeof layerControl.expand === 'function') {
                    layerControl._allowManualExpand = true;
                    layerControl.expand();
                    layerControl._allowManualExpand = false;
                }
            });
        }

        if (!map._layersOutsideCloseBound) {
            document.addEventListener('click', (e) => {
                const isOpen = L.DomUtil.hasClass(lc, 'leaflet-control-layers-expanded');
                if (!isOpen) return;
                if (lc.contains(e.target)) return;
                if (typeof layerControl.collapse === 'function') layerControl.collapse();
            }, true);
            map._layersOutsideCloseBound = true;
        }
    }
    
    map.on('overlayadd', function (e) {
        // Schaltet DFS ab, wenn VFR-Lufträume aktiviert werden
        if (e.name === "🛩️ VFR Lufträume (Overlay)") {
            if (typeof dfsIcaoOverlay !== 'undefined' && map.hasLayer(dfsIcaoOverlay)) map.removeLayer(dfsIcaoOverlay);
            topoMap.setOpacity(0.5);
        }
        // Schaltet VFR-Lufträume ab, wenn DFS aktiviert wird
        if (e.name === "🗺️ DFS ICAO Karte 1:500k") {
            if (typeof aeroOverlay !== 'undefined' && map.hasLayer(aeroOverlay)) map.removeLayer(aeroOverlay);
            topoMap.setOpacity(1.0);
        }
        if (e.name === "🌧️ Wetterradar (Niederschlag)") localStorage.setItem('ga_radar_active', 'true');
        if (e.name === "🏔️ Terrain Avoid (Live)") {
            if (typeof window.setTerrainAvoidOverlayEnabled === 'function') {
                window.setTerrainAvoidOverlayEnabled(true);
            }
            if (typeof window.scheduleTerrainAvoidOverlayUpdate === 'function') window.scheduleTerrainAvoidOverlayUpdate(true);
        }
    });
    
    map.on('overlayremove', function (e) {
        if (e.name === "🛩️ VFR Lufträume (Overlay)") {
            topoMap.setOpacity(1.0);
        }
        if (e.name === "🌧️ Wetterradar (Niederschlag)") localStorage.setItem('ga_radar_active', 'false');
        if (e.name === "🏔️ Terrain Avoid (Live)") {
            if (typeof window.setTerrainAvoidOverlayEnabled === 'function') {
                window.setTerrainAvoidOverlayEnabled(false);
            }
        }
    });
    
    let fetchTimeout = null;
    map.on('moveend', function () {
        if (snapMode) {
            clearTimeout(fetchTimeout);
            fetchTimeout = setTimeout(fetchOpenAIPData, 600);
        }
        if (typeof window.scheduleMapWeatherOverlayUpdate === 'function') window.scheduleMapWeatherOverlayUpdate(false);
        if (window.vpObsTileOverlayEnabled) renderObsTileOverlay();
    });
    map.on('zoomend', function() {
        if (typeof window.scheduleMapWeatherOverlayUpdate === 'function') window.scheduleMapWeatherOverlayUpdate(false);
        if (window.vpObsTileOverlayEnabled) renderObsTileOverlay();
        if (window.mapHints.vfrIndex !== false) {
            vpRefreshVfrLayerFromCache();
            vpScheduleVfrOverlayUpdate(false);
        }
    });
    
    const fsControl = L.control({ position: 'topleft' });
    fsControl.onAdd = function () {
        const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control');
        btn.innerHTML = '⛶'; btn.title = 'Vollbildmodus'; btn.style.width = '30px'; btn.style.height = '30px';
        btn.style.lineHeight = '30px'; btn.style.backgroundColor = '#fff'; btn.style.border = '1px solid #ccc';
        btn.style.cursor = 'pointer'; btn.style.fontSize = '18px'; btn.style.fontWeight = 'bold'; btn.style.textAlign = 'center'; btn.style.padding = '0';
        btn.onclick = function (e) {
            e.preventDefault();
            const willBeFs = !document.body.classList.contains('map-is-fullscreen');
            document.body.classList.toggle('map-is-fullscreen');
            document.documentElement.classList.toggle('map-is-fullscreen', willBeFs);
            if (document.body.classList.contains('map-is-fullscreen')) { btn.innerHTML = '✖'; } else { btn.innerHTML = '⛶'; }
            setTimeout(() => {
                if (map) map.invalidateSize();
                updateMiniMap();
                if (typeof renderMapProfile === 'function') renderMapProfile();
            }, 300);
        };
        return btn;
    };
    fsControl.addTo(map);
    if (window.mapHints && window.mapHints.terrainAvoid !== false && terrainAvoidCanRenderNow() && terrainAvoidOverlayLayer) {
        terrainAvoidOverlayLayer.addTo(map);
        if (typeof window.scheduleTerrainAvoidOverlayUpdate === 'function') window.scheduleTerrainAvoidOverlayUpdate(true);
    }
    map.on('click', function (e) {
        if (handleAipCalibrationMapClick(e)) return;
        if (isMapUiClickTarget(e.originalEvent)) return;
        if (freeflightMode) { handleFreeflightMapClick(e); return; }
        if (measureMode) { addMeasurePoint(e.latlng); return; }

        const wpIndex = findNearestEditableWaypoint(e.latlng, 30);
        if (wpIndex !== null && routeMarkers[wpIndex]) {
            routeMarkers[wpIndex].openPopup();
            return;
        }

        const apt = findNearestAirport(e.latlng, getAirportTapRadiusPx(34));
        if (apt) openAirportInfoPopup(apt, e.latlng);
    });
    if (!map._routeLegLabelsBound) {
        map.on('zoomend moveend', () => {
            if (routeWaypoints && routeWaypoints.length >= 2) renderRouteLegLabels();
        });
        map._routeLegLabelsBound = true;
    }
    if (typeof window.scheduleMapWeatherOverlayUpdate === 'function') window.scheduleMapWeatherOverlayUpdate(true);
    vpUpdateVfrUi();
    if (window.mapHints.vfrIndex !== false) vpScheduleVfrOverlayUpdate(false);
}

function updateMap(lat1, lon1, lat2, lon2, s, d) {
    if (!map) initMapBase();
    currentSName = s || "Start"; currentDName = d || "Ziel";
    
    // POI-Check: Wenn poiName gesetzt ist, bauen wir ein Rundflug-Dreieck
    if (typeof currentMissionData !== 'undefined' && currentMissionData && currentMissionData.poiName) {
        // Berechnung des direkten Rückwegs (vom POI zurück zum Start)
        const returnNav = calcNav(lat2, lon2, lat1, lon1);
        // Wir biegen den Rückflug um 20 Grad ab und legen den Wegpunkt auf ~45% der Strecke
        const offsetBearing = (returnNav.brng + 20) % 360;
        const returnWp = getDestinationPoint(lat2, lon2, returnNav.dist * 0.45, offsetBearing);
        
        routeWaypoints = [
            { lat: lat1, lng: lon1 },
            { lat: lat2, lng: lon2, name: "🎯 " + currentMissionData.poiName, isPOI: true },
            { lat: returnWp.lat, lng: returnWp.lon, name: "Return Leg" },
            { lat: lat1, lng: lon1, name: currentSName }
        ];
    } else {
        routeWaypoints = [{ lat: lat1, lng: lon1 }, { lat: lat2, lng: lon2 }];
    }
    window._missionRouteWaypoints = JSON.parse(JSON.stringify(routeWaypoints));

    renderMainRoute();
}

async function updateMapFromInputs() {
    if (!document.getElementById('mapTableOverlay').classList.contains('active')) return;
    const sIcao = document.getElementById('startLoc').value.toUpperCase(), dIcao = document.getElementById('destLoc').value.toUpperCase();
    if (!sIcao) return;
    if (!map) initMapBase();
    let sData = await getAirportData(sIcao), dData = dIcao ? await getAirportData(dIcao) : null;
    if (sData && dData) {
        currentSName = sData.icao; currentDName = dData.icao;
        if (!currentMissionData) {
            map.fitBounds(L.latLngBounds([sData.lat, sData.lon], [dData.lat, dData.lon]), { padding: [40, 40] });
        } else {
            routeWaypoints = [{ lat: sData.lat, lng: sData.lon }, { lat: dData.lat, lng: dData.lon }];
            renderMainRoute();
            map.fitBounds(L.latLngBounds([sData.lat, sData.lon], [dData.lat, dData.lon]), { padding: [40, 40] });
        }
    } else if (sData) {
        currentSName = sData.icao;
        if (!currentMissionData) {
            map.panTo([sData.lat, sData.lon]); if (map.getZoom() < 8) map.setZoom(9);
        } else {
            routeWaypoints = [{ lat: sData.lat, lng: sData.lon }];
            renderMainRoute();
            map.panTo([sData.lat, sData.lon]); if (map.getZoom() < 8) map.setZoom(9);
        }
    }
}

let _scrollLockY = 0;
let _drawerTransitionInProgress = false;
let _drawerTransitionStartedAt = 0;
const DRAWER_STATE = {
    OPENING: 'opening',
    OPEN: 'open',
    CLOSING: 'closing',
    CLOSED: 'closed'
};

function lockBodyScroll() {
    if (window.innerWidth >= 1250) return;
    _scrollLockY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + _scrollLockY + 'px';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
}
function unlockBodyScroll() {
    if (window.innerWidth >= 1250) return;
    if (document.body.style.position !== 'fixed') return;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo(0, _scrollLockY);
}

function setDrawerTransitionBusy(isBusy) {
    _drawerTransitionInProgress = !!isBusy;
    _drawerTransitionStartedAt = _drawerTransitionInProgress ? Date.now() : 0;
}

function isDrawerTransitionBusy() {
    if (_drawerTransitionInProgress) {
        const staleLimit = Math.max(1500, getDrawerDurationMs() + 1100);
        if ((Date.now() - _drawerTransitionStartedAt) > staleLimit) {
            _drawerTransitionInProgress = false;
            _drawerTransitionStartedAt = 0;
        }
    }
    return _drawerTransitionInProgress;
}

function parseDurationMs(rawDuration) {
    if (!rawDuration) return 360;
    const value = String(rawDuration).trim();
    if (!value) return 360;
    if (value.endsWith('ms')) return Math.max(0, parseFloat(value));
    if (value.endsWith('s')) return Math.max(0, parseFloat(value) * 1000);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 360;
}

function getDrawerDurationMs() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 1;
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--drawer-duration');
    const parsed = parseDurationMs(raw);
    return parsed > 0 ? parsed : 360;
}

function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
}

function waitMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function setDrawerState(overlay, state) {
    if (!overlay) return;
    overlay.dataset.drawerState = state;
}

function getDrawerState(overlay) {
    if (!overlay) return DRAWER_STATE.CLOSED;
    if (overlay.dataset.drawerState) return overlay.dataset.drawerState;
    return overlay.classList.contains('active') ? DRAWER_STATE.OPEN : DRAWER_STATE.CLOSED;
}

function waitForOverlayTransition(overlay) {
    const timeoutMs = Math.max(80, getDrawerDurationMs() + 220);
    return new Promise((resolve) => {
        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            overlay.removeEventListener('transitionend', onEnd);
            clearTimeout(timer);
            resolve();
        };
        const onEnd = (event) => {
            if (event.target !== overlay) return;
            if (event.propertyName !== 'transform' && event.propertyName !== 'opacity') return;
            done();
        };
        const timer = setTimeout(done, timeoutMs);
        overlay.addEventListener('transitionend', onEnd);
    });
}

async function animateDrawerOverlay(overlay, shouldOpen) {
    if (!overlay) return;
    overlay.classList.remove('is-opening', 'is-closing');

    if (shouldOpen) {
        setDrawerState(overlay, DRAWER_STATE.OPENING);
        overlay.classList.add('is-opening');
        await nextFrame();
        overlay.classList.add('active');
        await waitForOverlayTransition(overlay);
        overlay.classList.remove('is-opening');
        setDrawerState(overlay, DRAWER_STATE.OPEN);
        return;
    }

    setDrawerState(overlay, DRAWER_STATE.CLOSING);
    overlay.classList.add('is-closing');
    await nextFrame();
    overlay.classList.remove('active');
    await waitForOverlayTransition(overlay);
    overlay.classList.remove('is-closing');
    setDrawerState(overlay, DRAWER_STATE.CLOSED);
}

function enterMapFullscreenMode() {
    document.body.classList.add('map-is-fullscreen');
    document.documentElement.classList.add('map-is-fullscreen');
    document.body.style.overflow = 'hidden';
}

function exitMapFullscreenMode() {
    document.body.classList.remove('map-is-fullscreen');
    document.documentElement.classList.remove('map-is-fullscreen');
    document.body.style.overflow = '';
}

async function refreshMapTableLayout() {
    if (!map) initMapBase();
    await nextFrame();
    await nextFrame();

    if (map) {
        map.invalidateSize();
        if (routeWaypoints && routeWaypoints.length >= 2) map.fitBounds(L.latLngBounds(routeWaypoints), { padding: [40, 40] });
        else updateMapFromInputs();

        updateSnapButtonUI();
        if (snapMode) fetchOpenAIPData();
    }
    if (typeof initProfileResize === 'function') initProfileResize();
    if (typeof vpMapProfileVisible !== 'undefined' && vpMapProfileVisible && typeof renderMapProfile === 'function') renderMapProfile();
}

function toggleMapToolbar() {
    const collapsed = document.body.classList.toggle('toolbar-collapsed');
    const btn = document.getElementById('mapToolbarToggle');
    if (btn) btn.textContent = collapsed ? '▼' : '▲';
    localStorage.setItem('ga_toolbar_collapsed', collapsed ? '1' : '');
}

// Restore toolbar state on load
document.addEventListener('DOMContentLoaded', function() {
    if (localStorage.getItem('ga_toolbar_collapsed')) {
        document.body.classList.add('toolbar-collapsed');
        const btn = document.getElementById('mapToolbarToggle');
        if (btn) btn.textContent = '▼';
    }
});

function toggleMapTable(forceInternal) {
    const board = document.getElementById('mapTableOverlay');
    const pinBoard = document.getElementById('pinboardOverlay');
    if (!board || !pinBoard) return;

    const force = !!forceInternal;
    if (isDrawerTransitionBusy() && !force) return;
    if (!force) setDrawerTransitionBusy(true);

    try {
        if (pinBoard.classList.contains('active') && typeof togglePinboard === 'function') {
            togglePinboard(true);
        }

        board.classList.toggle('active');
        document.body.classList.toggle('maptable-open');
        setDrawerState(board, board.classList.contains('active') ? DRAWER_STATE.OPEN : DRAWER_STATE.CLOSED);
        if (typeof _closeFloatingMenus === 'function') _closeFloatingMenus();

        if (board.classList.contains('active')) {
            const autoFs = shouldAutoStartMapFullscreen();
            if (autoFs) {
                enterMapFullscreenMode();
            } else {
                lockBodyScroll();
            }
            if (!map) initMapBase();

            setTimeout(() => {
                refreshMapTableLayout().catch((error) => {
                    console.error('Map table refresh failed:', error);
                });
                if (routeWaypoints && routeWaypoints.length >= 2 && typeof triggerVerticalProfileUpdate === 'function') {
                    triggerVerticalProfileUpdate();
                }
            }, 500);
        } else {
            unlockBodyScroll();
            exitMapFullscreenMode();
            if (typeof _closeFloatingMenus === 'function') _closeFloatingMenus();
        }

        if (typeof window.persistMainViewFromOverlays === 'function') {
            window.persistMainViewFromOverlays();
        }
    } catch (error) {
        console.error('Map table toggle failed:', error);
        unlockBodyScroll();
        exitMapFullscreenMode();
    } finally {
        if (!force) {
            const releaseDelay = Math.max(120, getDrawerDurationMs() + 80);
            setTimeout(() => setDrawerTransitionBusy(false), releaseDelay);
        }
    }
}

function shouldAutoStartMapFullscreen() {
    return window.innerWidth < 1250;
}

/* =========================================================
   8. POLAROID MINIMAP
   ========================================================= */
function updateMiniMap() {
    const miniContainer = document.getElementById('miniMap');
    if (!miniContainer || miniContainer.offsetParent === null) return;

    // Verzögerung, um UI-Blockierung zu vermeiden
    setTimeout(() => {
        if (!miniMap) {
            miniMap = L.map('miniMap', { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false, attributionControl: false });
            L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png').addTo(miniMap);
            L.tileLayer('https://nwy-tiles-api.prod.newaydata.com/tiles/{z}/{x}/{y}.png?path=latest/aero/latest', {
                opacity: 0.65,
                maxNativeZoom: 12
            }).addTo(miniMap);
        }

        if (routeWaypoints && routeWaypoints.length > 0) {
            if (!miniRoutePolyline) {
                miniRoutePolyline = L.polyline(routeWaypoints, { color: '#d93829', weight: 4 }).addTo(miniMap);
            } else {
                miniRoutePolyline.setLatLngs(routeWaypoints);
            }
            miniMapMarkers.forEach(m => miniMap.removeLayer(m)); miniMapMarkers = [];

            const startMarker = L.circleMarker(routeWaypoints[0], { radius: 5, color: '#111', weight: 2, fillColor: '#44ff44', fillOpacity: 1 }).addTo(miniMap);
            const destMarker = L.circleMarker(routeWaypoints[routeWaypoints.length - 1], { radius: 5, color: '#111', weight: 2, fillColor: '#ff4444', fillOpacity: 1 }).addTo(miniMap);

            miniMapMarkers.push(startMarker, destMarker);
            setTimeout(() => { miniMap.invalidateSize(); miniMap.fitBounds(L.latLngBounds(routeWaypoints), { padding: [15, 15] }); }, 50);
        }
    }, 100); // Kurze Verzögerung vor dem Start
}

/* =========================================================
   19. OPENAIP SNAPPING (NAVAIDS & REP-POINTS)
   ========================================================= */
let snapMode = true;
let cachedNavData = [];

function extractRppAirportIcao(rppItem) {
    if (!rppItem || typeof rppItem !== 'object') return '';
    const readIcao = (obj) => String(
        obj?.icao || obj?.icaoCode || obj?.ident || obj?.designator || obj?.code || ''
    ).trim().toUpperCase();

    const directCandidates = [
        rppItem.airport,
        rppItem.aerodrome,
        rppItem.relatedAirport,
        rppItem.location,
        rppItem.parent
    ];
    for (const c of directCandidates) {
        const icao = readIcao(c);
        if (/^[A-Z]{4}$/.test(icao)) return icao;
    }

    if (Array.isArray(rppItem.airports)) {
        for (const a of rppItem.airports) {
            const icao = readIcao(a);
            if (/^[A-Z]{4}$/.test(icao)) return icao;
        }
    }

    // Fallback: gelegentlich steckt die ICAO nur im Namen/Kommentar.
    const textBlob = [rppItem.name, rppItem.title, rppItem.description, rppItem.note, rppItem.remarks]
        .filter(Boolean)
        .join(' ');
    const m = textBlob.match(/\b[A-Z]{4}\b/);
    return m ? m[0] : '';
}

/* --- DIRECT TO STATE --- */
let freeflightMode = false;
let ffWaypoints = [];
let ffPolyline = null;
let ffMarkers = [];
let ffContextPopup = null;
let ffNeedsStart = false;

function toggleSnapMode() {
    snapMode = !snapMode;
    updateSnapButtonUI();
    updateObsTileOverlayButtonUi();
    if (window.vpObsTileOverlayEnabled) renderObsTileOverlay();
    if (snapMode && map) fetchOpenAIPData();
    else cachedNavData = [];
}

function updateSnapButtonUI() {
    const btn = document.getElementById('snapBtn');
    if (!btn) return;
    if (snapMode) {
        btn.innerText = '🧲 Snapping (An)';
        btn.style.background = '#4da6ff';
        btn.style.color = '#fff';
    } else {
        btn.innerText = '🧲 Snapping (Aus)';
        btn.style.background = '#444';
        btn.style.color = '#fff';
    }
}

async function fetchOpenAIPData() {
    if (!map || !snapMode) return;

    // 1. Schutz: Nicht laden, wenn man zu weit rausgezoomt ist (verhindert "Box too large" 500er Fehler)
    if (map.getZoom() < 8) {
        cachedNavData = [];
        return;
    }
    const b = map.getBounds();

    // 2. Schutz: Koordinaten auf die reale Weltkarte limitieren (-180 bis 180 / -90 bis 90)
    const w = Math.max(-180, b.getWest());
    const s = Math.max(-90, b.getSouth());
    const e = Math.min(180, b.getEast());
    const n = Math.min(90, b.getNorth());

    const bbox = `${w},${s},${e},${n}`;
    const proxy = 'https://ga-proxy.einherjer.workers.dev';
    try {
        const [navRes, repRes, aptRes] = await Promise.all([
            fetch(`${proxy}/api/navaids?bbox=${bbox}&limit=250&t=${Date.now()}`),
            fetch(`${proxy}/api/reporting-points?bbox=${bbox}&limit=250&t=${Date.now()}`),
            fetch(`${proxy}/api/airports?bbox=${bbox}&limit=250&t=${Date.now()}`)
        ]);
        // 3. Schutz: Falls OpenAIP blockt, breche leise ab statt abzustürzen
        if (!navRes.ok || !repRes.ok || !aptRes.ok) {
            return;
        }
        const navJson = await navRes.json(), repJson = await repRes.json(), aptJson = await aptRes.json();
        cachedNavData = [];
        let navArray = navJson.items || [];
        let repArray = repJson.items || [];
        let aptArray = aptJson.items || [];
        navArray.forEach(i => {
            if (!i.geometry) return;
            let freqVal = '';
            if (i.frequency !== undefined && i.frequency !== null) {
                freqVal = (typeof i.frequency === 'object' && i.frequency.value) ? i.frequency.value : i.frequency;
            } else if (i.frequencies && i.frequencies.length > 0) {
                freqVal = i.frequencies[0].value || i.frequencies[0];
            }
            let freq = freqVal ? ` (${freqVal})` : '';
            let idVal = i.identifier || i.designator || '';
            let ident = idVal ? ` [${idVal}]` : '';
            cachedNavData.push({ name: `${i.name}${ident}${freq}`, lat: i.geometry.coordinates[1], lng: i.geometry.coordinates[0] });
        });
        repArray.forEach(i => {
            if (!i.geometry) return;
            cachedNavData.push({
                name: `RPP ${i.name}`,
                lat: i.geometry.coordinates[1],
                lng: i.geometry.coordinates[0],
                type: 'RPP',
                rppAirportIcao: extractRppAirportIcao(i),
                sourceId: i._id || i.id || ''
            });
        });
        aptArray.forEach(i => {
            if (!i.geometry) return;
            let freq = (i.frequencies && i.frequencies.length > 0 && i.frequencies[0].value) ? ` (${i.frequencies[0].value})` : '';
            let displayName = i.icaoCode ? i.icaoCode : i.name;
            cachedNavData.push({ name: `APT ${displayName}${freq}`, lat: i.geometry.coordinates[1], lng: i.geometry.coordinates[0] });
        });
    } catch (e) {
        // Leiser Fallback, wenn das Netzwerk mal hakt
    }
}
/* =========================================================
   WETTER MARKER AUF DER KARTE (VFR / IFR)
   ========================================================= */
window.vpShowMapMetar = localStorage.getItem('ga_show_map_metar') !== 'false';

window.toggleMapMetars = function() {
    const next = !window.vpShowMapMetar;
    window.vpShowMapMetar = next;
    window.mapHints.weather = next;
    localStorage.setItem('ga_show_map_metar', window.vpShowMapMetar);
    saveMapHintSetting('weather');
    const btn = document.getElementById('mapMetarBtn');
    if (btn) {
        btn.innerText = window.vpShowMapMetar ? '🌤️ METARs (An)' : '🌤️ METARs (Aus)';
        btn.style.background = window.vpShowMapMetar ? '#4da6ff' : '#444';
        btn.style.color = window.vpShowMapMetar ? '#111' : '#fff';
    }
    refreshMapHintMenuUi();
    // API triggern falls Wetter gebraucht wird, ansonsten nur Marker neu rendern
    if (window.vpShowMapMetar && typeof window._lastVpRouteKey !== 'undefined') {
        if (typeof triggerVerticalProfileUpdate === 'function') triggerVerticalProfileUpdate();
    } else {
        if (typeof renderWeatherMarkers === 'function') renderWeatherMarkers();
    }
    if (typeof window.scheduleMapWeatherOverlayUpdate === 'function') window.scheduleMapWeatherOverlayUpdate(true);
};

document.addEventListener('DOMContentLoaded', () => {
    loadMapHintSettings();
    loadTerrainAvoidSettings();
    vpEnsureVfrAutoTimer();
    vpVfrIndexState.selectedCountry = vpNormalizeVfrCountrySelection(localStorage.getItem('ga_vfr_index_country') || 'auto');
    vpVfrIndexState.vfrModel = vpNormalizeVfrModel(localStorage.getItem('ga_vfr_index_model') || 'internal');
    vpVfrIndexState.ampelWindowMode = vpNormalizeVfrAmpelWindowMode(localStorage.getItem('ga_vfr_ampel_window_mode') || VP_VFR_AMPEL_MODE_DEFAULT);
    // Bestehenden Wetter-Status übernehmen, falls vorhanden
    window.vpShowMapMetar = window.mapHints.weather !== false;
    // Traffic-Status übernehmen
    window.vpTrafficMapVisible = window.mapHints.traffic !== false;
    refreshMapHintMenuUi();
    applyMapHintEffects('weather');
    applyMapHintEffects('windBarbs');
    applyMapHintEffects('cloudFields');
    applyMapHintEffects('vfrIndex');
    applyMapHintEffects('terrainAvoid');
    applyMapHintEffects('traffic');
    applyMapHintEffects('lowFps');
    vpUpdateVfrUi();

    document.addEventListener('click', (e) => {
        const menu = document.getElementById('mapHintsMenu');
        if (!menu || menu.style.display !== 'block') return;
        const t = e.target;
        if (t && t.closest && (t.closest('#mapHintsMenu') || t.closest('#mapHintsBtn'))) return;
        window.toggleMapHintsMenu(false);
    }, true);
});

let wxMapMarkers = [];
let wxWindBarbMarkers = [];
let wxCloudFieldMarkers = [];
let wxDodgingRafQueued = false;
let wxDodgingTimer = null;
let wxDodgingLastRun = 0;

function scheduleWeatherMarkerDodging(force = false) {
    if (!map || typeof window.updateWeatherMarkerDodging !== 'function') return;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const minGapMs = force ? 0 : 90;

    const queueRaf = () => {
        if (wxDodgingRafQueued) return;
        wxDodgingRafQueued = true;
        requestAnimationFrame(() => {
            wxDodgingRafQueued = false;
            wxDodgingLastRun = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            if (typeof window.updateWeatherMarkerDodging === 'function') window.updateWeatherMarkerDodging();
        });
    };

    if ((now - wxDodgingLastRun) >= minGapMs) {
        queueRaf();
        return;
    }
    if (wxDodgingTimer) return;
    const waitMs = Math.max(10, minGapMs - (now - wxDodgingLastRun));
    wxDodgingTimer = setTimeout(() => {
        wxDodgingTimer = null;
        queueRaf();
    }, waitMs);
}
let wxCloudFieldSvgSeq = 0;
let wxOverlayFetchController = null;
let wxOverlayFetchTimer = null;
let wxOverlayLastKey = '';
let wxOverlayLastFetchAt = 0;
const WX_OVERLAY_MIN_INTERVAL_MS = 12 * 1000;
const WX_OVERLAY_MIN_INTERVAL_FORCE_MS = 3 * 1000;
const WX_WEATHER_DOMAIN_ROUTE_NM = 50;
const WX_WEATHER_DOMAIN_GPS_NM = 50;

window.resetMapWeatherVisualsForSourceSwitch = function() {
    try {
        if (wxOverlayFetchTimer) {
            clearTimeout(wxOverlayFetchTimer);
            wxOverlayFetchTimer = null;
        }
        if (wxOverlayFetchController) {
            wxOverlayFetchController.abort();
            wxOverlayFetchController = null;
        }
    } catch (_) {}
    wxOverlayLastKey = '';
    clearMapOpenMeteoOverlays();
    if (Array.isArray(wxMapMarkers)) {
        wxMapMarkers.forEach(m => { try { map && map.removeLayer(m); } catch (_) {} });
        wxMapMarkers = [];
    }
};
const WX_GRID_SPACING_SCALE = 1.5;

function clearMapOpenMeteoOverlays() {
    if (!map) return;
    wxWindBarbMarkers.forEach(m => map.removeLayer(m));
    wxCloudFieldMarkers.forEach(m => map.removeLayer(m));
    wxWindBarbMarkers = [];
    wxCloudFieldMarkers = [];
}

function clamp01(v) {
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(1, v));
}

function mixChannel(a, b, t) {
    return Math.round(a + (b - a) * clamp01(t));
}

function windBarbStyleFromSpeed(speedKt) {
    const t = clamp01(speedKt / 42);
    const r = mixChannel(168, 26, t);
    const g = mixChannel(214, 120, t);
    const b = mixChannel(255, 255, t);
    const alpha = 0.86 + 0.14 * t;
    const shadow = 0.62 + 0.28 * t;
    const strokeWidth = 2.2 + 1.2 * t;
    return {
        stroke: `rgba(${r},${g},${b},${alpha.toFixed(3)})`,
        fill: `rgba(${r},${g},${b},${Math.min(1, alpha + 0.12).toFixed(3)})`,
        core: `rgba(${r},${g},${b},${Math.min(1, alpha + 0.2).toFixed(3)})`,
        shadow: shadow.toFixed(3),
        strokeWidth: strokeWidth.toFixed(2)
    };
}

function buildWindBarbIcon(directionDeg, speedKt) {
    const dirFrom = Number.isFinite(directionDeg) ? directionDeg : 0;
    // Open-Meteo liefert "coming from"; auf der Karte zeigen wir die Bewegungsrichtung (to).
    const renderDir = (dirFrom + 180) % 360;
    const speed = Math.max(0, Number.isFinite(speedKt) ? speedKt : 0);
    const style = windBarbStyleFromSpeed(speed);
    let rem = Math.round(speed / 5) * 5;
    let y = 20.4;
    let feathers = '';
    while (rem >= 50) {
        feathers += `<path d="M12 ${y} L19 ${y + 2.7} L12 ${y + 5.4} Z" fill="${style.fill}"/>`;
        y -= 5.4;
        rem -= 50;
    }
    while (rem >= 10) {
        feathers += `<line x1="12" y1="${y}" x2="19" y2="${y + 3.4}" stroke="${style.stroke}" stroke-width="${style.strokeWidth}" stroke-linecap="round"/>`;
        y -= 3.5;
        rem -= 10;
    }
    if (rem >= 5) {
        feathers += `<line x1="12" y1="${y}" x2="16.6" y2="${y + 2.1}" stroke="${style.stroke}" stroke-width="${style.strokeWidth}" stroke-linecap="round"/>`;
    }

    const svg = `
        <svg width="36" height="36" viewBox="0 0 24 24" style="overflow:visible;">
            <g transform="rotate(${renderDir} 12 12)">
                <circle cx="12" cy="12" r="1.8" fill="${style.core}"/>
                <line x1="12" y1="21.2" x2="12" y2="2.2" stroke="${style.stroke}" stroke-width="${style.strokeWidth}" stroke-linecap="round"/>
                ${feathers}
            </g>
        </svg>`;

    return L.divIcon({
        className: 'wx-windbarb-icon',
        html: `<div style="filter: drop-shadow(0 1px 3px rgba(0,0,0,${style.shadow}));">${svg}</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
    });
}

function cloudBandFillLevel(pct) {
    const v = Math.max(0, Math.min(100, Number(pct) || 0));
    if (v < 34) return 0; // leer
    if (v < 67) return 1; // halb
    return 2;             // voll
}

function cloudBandOpacity(level) {
    if (level <= 0) return 0;
    if (level === 1) return 0.42;
    return 0.86;
}

function createCloudFieldMarker(lat, lon, lowPct, midPct, highPct, sizePx) {
    const highLevel = cloudBandFillLevel(highPct);
    const midLevel = cloudBandFillLevel(midPct);
    const lowLevel = cloudBandFillLevel(lowPct);
    const anyFill = (highLevel + midLevel + lowLevel) > 0;
    if (!anyFill) return null;

    const topA = cloudBandOpacity(highLevel).toFixed(3);
    const midA = cloudBandOpacity(midLevel).toFixed(3);
    const lowA = cloudBandOpacity(lowLevel).toFixed(3);
    const id = `wx-cloud-clip-${(++wxCloudFieldSvgSeq)}`;
    const size = Math.max(40, Math.min(72, Math.round(sizePx)));

    const svg = `
        <svg width="${size}" height="${size}" viewBox="0 0 100 100" style="overflow:visible;">
            <defs>
                <clipPath id="${id}">
                    <circle cx="50" cy="50" r="46"></circle>
                </clipPath>
            </defs>
            <circle cx="50" cy="50" r="46" fill="rgba(128,128,128,0.10)" stroke="rgba(214,214,214,0.72)" stroke-width="2.8"></circle>
            <g clip-path="url(#${id})">
                <rect x="4" y="4" width="92" height="30.67" fill="rgba(170,170,170,${topA})"></rect>
                <rect x="4" y="34.67" width="92" height="30.66" fill="rgba(160,160,160,${midA})"></rect>
                <rect x="4" y="65.33" width="92" height="30.67" fill="rgba(150,150,150,${lowA})"></rect>
                <line x1="6" y1="34.67" x2="94" y2="34.67" stroke="rgba(230,230,230,0.62)" stroke-width="1"></line>
                <line x1="6" y1="65.33" x2="94" y2="65.33" stroke="rgba(230,230,230,0.62)" stroke-width="1"></line>
            </g>
        </svg>`;

    const icon = L.divIcon({
        className: 'wx-cloudfield-icon',
        html: `<div style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.58));">${svg}</div>`,
        iconSize: [size, size],
        iconAnchor: [Math.round(size / 2), Math.round(size / 2)]
    });
    return L.marker([lat, lon], { icon, interactive: false, keyboard: false, opacity: 0.98 });
}

function pickWeatherGridStep(spanDeg, targetLines) {
    const raw = Math.max(0.02, spanDeg / Math.max(2, targetLines - 1));
    const steps = [0.02, 0.03, 0.05, 0.075, 0.1, 0.125, 0.2, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10];
    for (const s of steps) {
        if (raw <= s) return s;
    }
    return Math.ceil(raw / 5) * 5;
}

function normalizeLon180(lon) {
    let x = lon;
    while (x > 180) x -= 360;
    while (x <= -180) x += 360;
    return x;
}

function nmToLatDeg(nm) {
    return Number(nm || 0) / 60;
}

function nmToLonDegAtLat(nm, latDeg) {
    const cosLat = Math.max(0.2, Math.abs(Math.cos((Number(latDeg || 0) * Math.PI) / 180)));
    return Number(nm || 0) / (60 * cosLat);
}

function buildRouteWeatherBounds() {
    if (typeof routeWaypoints === 'undefined' || !Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return null;
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    for (const wp of routeWaypoints) {
        const lat = Number(wp && wp.lat);
        const lon = Number(wp && (wp.lng ?? wp.lon));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
    }
    if (!Number.isFinite(minLat) || !Number.isFinite(minLon)) return null;
    const midLat = (minLat + maxLat) * 0.5;
    const padLatDeg = nmToLatDeg(WX_WEATHER_DOMAIN_ROUTE_NM);
    const padLonDeg = nmToLonDegAtLat(WX_WEATHER_DOMAIN_ROUTE_NM, midLat);
    return {
        minLat: Math.max(-89.5, minLat - padLatDeg),
        maxLat: Math.min(89.5, maxLat + padLatDeg),
        minLon: normalizeLon180(minLon - padLonDeg),
        maxLon: normalizeLon180(maxLon + padLonDeg),
        wrapsDateline: (minLon - padLonDeg) < -180 || (maxLon + padLonDeg) > 180
    };
}

function pointInsideBounds(lat, lon, b) {
    if (!b) return false;
    const latOk = lat >= b.minLat && lat <= b.maxLat;
    if (!latOk) return false;
    if (!b.wrapsDateline) return lon >= b.minLon && lon <= b.maxLon;
    return lon >= b.minLon || lon <= b.maxLon;
}

function filterWeatherPointsByActiveDomain(points) {
    if (!Array.isArray(points) || points.length === 0) return points;
    const routeBounds = buildRouteWeatherBounds();
    const gps = window.lastLiveGpsPos;
    const hasRecentGps = !!(gps && Number.isFinite(gps.lat) && Number.isFinite(gps.lon) && Number.isFinite(gps.t) && (Date.now() - gps.t < 15 * 60 * 1000));
    const gpsLatPad = hasRecentGps ? nmToLatDeg(WX_WEATHER_DOMAIN_GPS_NM) : 0;
    const gpsLonPad = hasRecentGps ? nmToLonDegAtLat(WX_WEATHER_DOMAIN_GPS_NM, gps.lat) : 0;
    const gpsLatMin = hasRecentGps ? Math.max(-89.5, gps.lat - gpsLatPad) : 0;
    const gpsLatMax = hasRecentGps ? Math.min(89.5, gps.lat + gpsLatPad) : 0;
    const gpsLonMin = hasRecentGps ? normalizeLon180(gps.lon - gpsLonPad) : 0;
    const gpsLonMax = hasRecentGps ? normalizeLon180(gps.lon + gpsLonPad) : 0;
    const gpsWrap = hasRecentGps ? ((gps.lon - gpsLonPad) < -180 || (gps.lon + gpsLonPad) > 180) : false;

    if (!routeBounds && !hasRecentGps) return points;
    const filtered = points.filter(p => {
        if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) return false;
        if (routeBounds && pointInsideBounds(p.lat, p.lon, routeBounds)) return true;
        if (hasRecentGps) {
            if (p.lat < gpsLatMin || p.lat > gpsLatMax) return false;
            if (!gpsWrap) return p.lon >= gpsLonMin && p.lon <= gpsLonMax;
            return p.lon >= gpsLonMin || p.lon <= gpsLonMax;
        }
        return false;
    });
    // Wenn durch Domain-Filter zu stark ausgedünnt wird, auf das Viewport-Raster zurückfallen.
    if (filtered.length >= 8) return filtered;
    return points;
}

function getMapWeatherGridPoints(cols = 8, rows = 6) {
    if (!map) return { points: [], key: '' };
    const b = map.getBounds();
    if (!b || !b.isValid()) return { points: [], key: '' };
    const north = b.getNorth();
    const south = b.getSouth();
    const west = b.getWest();
    const east = b.getEast();

    const latSpan = Math.max(0.05, Math.abs(north - south));
    let lonSpan = east - west;
    if (lonSpan < 0) lonSpan += 360;
    lonSpan = Math.max(0.05, lonSpan);

    const latStep = pickWeatherGridStep(latSpan, rows) * WX_GRID_SPACING_SCALE;
    const lonStep = pickWeatherGridStep(lonSpan, cols) * WX_GRID_SPACING_SCALE;
    const latStart = Math.floor(south / latStep) * latStep;
    const latEnd = Math.ceil(north / latStep) * latStep;

    const westN = ((west % 360) + 360) % 360;
    const eastN = westN + lonSpan;
    const lonStart = Math.floor(westN / lonStep) * lonStep;
    const lonEnd = Math.ceil(eastN / lonStep) * lonStep;

    const pts = [];
    for (let lat = latStart; lat <= latEnd + (latStep * 0.25); lat += latStep) {
        const clampedLat = Math.max(-89.5, Math.min(89.5, lat));
        for (let lon = lonStart; lon <= lonEnd + (lonStep * 0.25); lon += lonStep) {
            pts.push({
                lat: Math.round(clampedLat * 1e5) / 1e5,
                lon: Math.round(normalizeLon180(lon) * 1e5) / 1e5
            });
        }
    }
    const filteredPts = filterWeatherPointsByActiveDomain(pts);
    const maxPoints = 48;
    const reducedPts = filteredPts.length > maxPoints
        ? filteredPts.filter((_, idx) => (idx % Math.ceil(filteredPts.length / maxPoints)) === 0).slice(0, maxPoints)
        : filteredPts;
    return {
        points: reducedPts,
        key: [
            latStep.toFixed(3),
            lonStep.toFixed(3),
            latStart.toFixed(3),
            latEnd.toFixed(3),
            lonStart.toFixed(3),
            lonEnd.toFixed(3),
            reducedPts.length
        ].join('|')
    };
}

window.scheduleMapWeatherOverlayUpdate = function(forceFetch = false) {
    if (wxOverlayFetchTimer) clearTimeout(wxOverlayFetchTimer);
    wxOverlayFetchTimer = setTimeout(() => {
        if (typeof window.renderMapWeatherOverlays === 'function') window.renderMapWeatherOverlays(forceFetch);
    }, forceFetch ? 180 : 900);
};

window.renderMapWeatherOverlays = async function(forceFetch = false) {
    if (!map) return;
    const fbMode = String(window.vpWeatherFallbackMode || 'none');
    const openMeteoSourceSelected = (
        (window.vpWeatherSource === 'openmeteo' && fbMode !== 'openmeteo_to_metar')
        || fbMode === 'metar_to_openmeteo'
    );
    if (!openMeteoSourceSelected) {
        clearMapOpenMeteoOverlays();
        return;
    }
    if (window.mapHints.weather === false) {
        clearMapOpenMeteoOverlays();
        return;
    }
    const showWind = window.mapHints.windBarbs !== false;
    const showCloud = window.mapHints.cloudFields !== false;
    if (!showWind && !showCloud) {
        clearMapOpenMeteoOverlays();
        return;
    }
    if (typeof window.fetchOpenMeteoWeatherPoints !== 'function') return;
    if (typeof window.vpIsOpenMeteoCoolingDown === 'function' && window.vpIsOpenMeteoCoolingDown()) return;

    const grid = getMapWeatherGridPoints(8, 6);
    const points = grid.points;
    if (!points.length) {
        clearMapOpenMeteoOverlays();
        return;
    }
    const gridKey = `${grid.key}|${showWind ? 1 : 0}|${showCloud ? 1 : 0}`;
    if (!forceFetch && gridKey === wxOverlayLastKey) return;
    const now = Date.now();
    const minInterval = forceFetch ? WX_OVERLAY_MIN_INTERVAL_FORCE_MS : WX_OVERLAY_MIN_INTERVAL_MS;
    if (!forceFetch && (now - wxOverlayLastFetchAt) < minInterval) return;
    if (forceFetch && (now - wxOverlayLastFetchAt) < WX_OVERLAY_MIN_INTERVAL_FORCE_MS) return;
    wxOverlayLastKey = gridKey;

    if (wxOverlayFetchController) wxOverlayFetchController.abort();
    wxOverlayFetchController = new AbortController();
    const signal = wxOverlayFetchController.signal;

    try {
        if (window.vpWeatherDebug) window.vpWeatherDebug.mapOverlayFetches += 1;
        const samples = await window.fetchOpenMeteoWeatherPoints(points, { signal, includePressure: false, maxConcurrency: 4 });
        if (signal.aborted) return;
        wxOverlayLastFetchAt = Date.now();

        clearMapOpenMeteoOverlays();
        const z = map.getZoom ? map.getZoom() : 8;
        const cloudIconSize = Math.max(37, Math.min(56, Math.round((50 + (z - 6) * 2.4) * 0.8)));

        samples.forEach((sample, idx) => {
            if (!sample || !Number.isFinite(sample.lat) || !Number.isFinite(sample.lon)) return;
            const lat = sample.lat, lon = sample.lon;

            if (showCloud) {
                const low = Number(sample.cloudLowPct || 0);
                const mid = Number(sample.cloudMidPct || 0);
                const high = Number(sample.cloudHighPct || 0);
                const cloudMarker = createCloudFieldMarker(lat, lon, low, mid, high, cloudIconSize);
                if (cloudMarker) wxCloudFieldMarkers.push(cloudMarker.addTo(map));
            }

            if (showWind) {
                const dir = Number(sample.wdir);
                const spd = Number(sample.wspd);
                if (Number.isFinite(dir) && Number.isFinite(spd)) {
                    const icon = buildWindBarbIcon(dir, spd);
                    const m = L.marker([lat, lon], { icon, interactive: false, keyboard: false, opacity: 1 }).addTo(map);
                    wxWindBarbMarkers.push(m);
                }
            }
        });
    } catch (e) {
        if (e && e.name === 'AbortError') return;
        console.warn('[MapWX] Open-Meteo Overlay Fehler:', e);
        if (window.vpWeatherDebug && typeof window.vpWeatherDebugSetError === 'function') {
            window.vpWeatherDebugSetError(e, 'map overlay');
        } else if (window.vpWeatherDebug) {
            window.vpWeatherDebug.openMeteoErrors = (window.vpWeatherDebug.openMeteoErrors || 0) + 1;
            window.vpWeatherDebug.lastErrorAt = Date.now();
            window.vpWeatherDebug.lastErrorMsg = `map overlay: ${e && (e.message || String(e))}`;
        }
        clearMapOpenMeteoOverlays();
    }
};

    window.updateWeatherMarkerDodging = function() {
        if (!map || typeof wxMapMarkers === 'undefined' || wxMapMarkers.length === 0) return;
        
        // FIX: Verhindere NaN, wenn die Karte versteckt ist (Leaflet liefert dann 0,0 für alles)
        const mapTable = document.getElementById('mapTableOverlay');
        if (!mapTable || !mapTable.classList.contains('active')) {
            wxMapMarkers.forEach(marker => {
                const wrap = marker._icon ? marker._icon.querySelector('.wx-marker-wrap') : null;
                if (wrap) wrap.style.transform = `translate(0px, 0px)`;
            });
            return;
        }

        // Echtzeit-Koordinaten direkt aus der sichtbaren roten Linie holen
        let pts = [];
    if (typeof polyline !== 'undefined' && polyline) {
        pts = polyline.getLatLngs().map(ll => map.latLngToLayerPoint(ll));
    } else if (typeof routeWaypoints !== 'undefined' && routeWaypoints && routeWaypoints.length >= 2) {
        pts = routeWaypoints.map(wp => map.latLngToLayerPoint([wp.lat, wp.lng || wp.lon]));
    } else return;
    
    wxMapMarkers.forEach(marker => {
        const wrap = marker._icon ? marker._icon.querySelector('.wx-marker-wrap') : null;
        if (!wrap) return;
        
        const mPx = map.latLngToLayerPoint(marker.getLatLng());
        let minDist = Infinity;
        let pushVec = { x: 0, y: 0 };
        
        // Abstand zu den Liniensegmenten
        for (let i = 0; i < pts.length - 1; i++) {
            const p1 = pts[i], p2 = pts[i+1];
            const l2 = Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
            let t = 0;
            if (l2 > 0) t = Math.max(0, Math.min(1, ((mPx.x - p1.x) * (p2.x - p1.x) + (mPx.y - p1.y) * (p2.y - p1.y)) / l2));
            const projX = p1.x + t * (p2.x - p1.x);
            const projY = p1.y + t * (p2.y - p1.y);
            
            const dist = Math.sqrt(Math.pow(mPx.x - projX, 2) + Math.pow(mPx.y - projY, 2));
            if (dist < minDist) {
                minDist = dist;
                if (dist > 0) pushVec = { x: (mPx.x - projX) / dist, y: (mPx.y - projY) / dist };
                else pushVec = { x: 1, y: 1 };
            }
        }
        
        // Abstand zu den Wegpunkten selbst prüfen
        pts.forEach(p => {
            const dist = Math.sqrt(Math.pow(mPx.x - p.x, 2) + Math.pow(mPx.y - p.y, 2));
            if (dist < minDist) {
                minDist = dist;
                if (dist > 0) pushVec = { x: (mPx.x - p.x) / dist, y: (mPx.y - p.y) / dist };
                else pushVec = { x: 1, y: 1 };
            }
        });
        
        const THRESHOLD = 45; 
        if (minDist < THRESHOLD) {
            const force = THRESHOLD - minDist + 15; 
            wrap.style.transition = 'transform 0.1s linear';
            wrap.style.transform = `translate(${pushVec.x * force}px, ${pushVec.y * force}px)`;
        } else {
            wrap.style.transition = 'transform 0.2s ease-out';
            wrap.style.transform = `translate(0px, 0px)`;
        }
    });
};

window.renderWeatherMarkers = function() {
    if (!map) return;
    wxMapMarkers.forEach(m => map.removeLayer(m));
    wxMapMarkers = [];

    const fbMode = String(window.vpWeatherFallbackMode || 'none');
    const openMeteoSourceSelected = (
        (window.vpWeatherSource === 'openmeteo' && fbMode !== 'openmeteo_to_metar')
        || fbMode === 'metar_to_openmeteo'
    );
    if (openMeteoSourceSelected) {
        if (typeof window.scheduleMapWeatherOverlayUpdate === 'function') window.scheduleMapWeatherOverlayUpdate(false);
        return;
    }

    if (!window.vpShowMapMetar) return;
    if (typeof vpWeatherData === 'undefined' || !vpWeatherData || vpWeatherData.length === 0) return;
    const sourceNow = window.vpWeatherSource || 'metar';
    const metarDisplayMode = (sourceNow === 'metar' && fbMode !== 'metar_to_openmeteo') || fbMode === 'openmeteo_to_metar';
    const cloudsToggleEnabled = (typeof localStorage !== 'undefined')
        ? (localStorage.getItem('ga_show_clouds') !== 'false')
        : true;
    const cloudDiscEnabled = (window.mapHints && window.mapHints.cloudFields !== false) && cloudsToggleEnabled;

    let seenIcao = new Set();

    vpWeatherData.forEach((zone, markerIndex) => {
        if (metarDisplayMode && /^OM\d+$/i.test(String(zone && zone.icao || ''))) return;
        const zLat = Number(zone && zone.stnLat);
        const zLon = Number(zone && zone.stnLon);
        if (!zone.icao || !Number.isFinite(zLat) || !Number.isFinite(zLon) || seenIcao.has(zone.icao)) return;
        seenIcao.add(zone.icao);

        let catColor = "#fff";
        let catText = zone.fltCat || "VFR";
        if (catText === "VFR") catColor = "#33ff33";
        else if (catText === "MVFR") catColor = "#4da6ff";
        else if (catText === "IFR") catColor = "#ff4444";
        else if (catText === "LIFR") catColor = "#ff33ff";

        let windHtml = '';
        let wdir = zone.wdir;
        let wspd = zone.wspd || 0;
        
        if (wdir && wdir !== 'VRB' && wspd > 0) {
            let rotDir = (parseInt(wdir) + 180) % 360;
            windHtml = `
            <div style="margin-top: 4px; background: rgba(10,10,10,0.85); border: 1px solid #4da6ff; border-radius: 4px; padding: 2px 6px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.5);">
                <svg width="12" height="12" viewBox="0 0 24 24" style="transform: rotate(${rotDir}deg); margin-right: 4px; overflow: visible;">
                    <path d="M12 2L12 22M12 2L5 9M12 2L19 9" stroke="#4da6ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span style="color:#4da6ff; font-family:monospace; font-size:11px; font-weight:bold;">${wspd}kt</span>
            </div>`;
        }

        const coverageByType = { FEW: 25, SCT: 50, BKN: 80, OVC: 100, VV: 100 };
        let lowCloud = 0, midCloud = 0, highCloud = 0;
        if (Array.isArray(zone.clouds) && zone.clouds.length > 0) {
            zone.clouds.forEach((c) => {
                if (!c) return;
                const t = String(c.type || '').toUpperCase();
                const cov = Number(coverageByType[t] || 0);
                const baseAgl = Number(c.baseAgl || 0);
                if (baseAgl > 0 && baseAgl < 3500) lowCloud = Math.max(lowCloud, cov);
                else if (baseAgl > 0 && baseAgl < 10000) midCloud = Math.max(midCloud, cov);
                else highCloud = Math.max(highCloud, cov);
            });
        }
        if (lowCloud === 0 && midCloud === 0 && highCloud === 0) {
            if (catText === 'LIFR') { lowCloud = 95; midCloud = 70; highCloud = 55; }
            else if (catText === 'IFR') { lowCloud = 80; midCloud = 55; highCloud = 40; }
            else if (catText === 'MVFR') { lowCloud = 55; midCloud = 35; highCloud = 25; }
            else { lowCloud = 25; midCloud = 15; highCloud = 10; }
        }
        const lowA = (0.10 + (lowCloud / 100) * 0.42).toFixed(3);
        const midA = (0.10 + (midCloud / 100) * 0.42).toFixed(3);
        const highA = (0.10 + (highCloud / 100) * 0.42).toFixed(3);
        const cloudDiscBg = `linear-gradient(to bottom,
            rgba(124,144,168,${highA}) 0%,
            rgba(124,144,168,${highA}) 33.333%,
            rgba(146,168,192,${midA}) 33.333%,
            rgba(146,168,192,${midA}) 66.666%,
            rgba(172,192,214,${lowA}) 66.666%,
            rgba(172,192,214,${lowA}) 100%
        )`;
        const cloudDiscHtml = cloudDiscEnabled ? `
                    <div style="position:absolute; left:50%; top:50%; width:120%; aspect-ratio:1 / 1; height:auto; transform:translate(-50%,-50%); border-radius:999px; z-index:1; pointer-events:none; overflow:hidden; background:${cloudDiscBg}; box-shadow: 0 0 0 1px rgba(216,229,242,0.52), 0 3px 12px rgba(12,18,26,0.30), inset 0 0 8px rgba(255,255,255,0.22);">
                        <div style="position:absolute; inset:0; border-radius:999px; background: radial-gradient(circle at 35% 32%, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.10) 38%, rgba(255,255,255,0.00) 72%);"></div>
                    </div>
        ` : '';

        const html = `
            <div class="wx-marker-wrap" style="position:relative; transition: transform 0.2s ease-out; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: visible;">
                <div style="position: relative; display: inline-flex; align-items: center; justify-content: center;">
                    ${cloudDiscHtml}
                    <div style="background: rgba(10,10,10,0.85); border: 2px solid ${catColor}; border-radius: 4px; padding: 2px 5px; color: ${catColor}; font-family: monospace; font-size: 11px; font-weight: bold; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.6); position:relative; z-index:2;">
                        <span style="color:#fff; margin-right:4px;">${zone.icao}</span> ${catText}
                    </div>
                </div>
                ${windHtml}
            </div>
        `;

        const icon = L.divIcon({ className: 'custom-pin', html: html, iconSize: [92, 58], iconAnchor: [46, 21] });
        const stnPos = L.latLng(zLat, zLon);
        const stnPx = map.latLngToLayerPoint(stnPos);
        const angle = (markerIndex % 8) * (Math.PI / 4);
        const offsetPx = L.point(Math.round(Math.cos(angle) * 14), Math.round(Math.sin(angle) * 14) - 10);
        const drawPos = map.layerPointToLatLng(stnPx.add(offsetPx));
        const marker = L.marker(drawPos, { icon: icon, interactive: !measureMode }).addTo(map);
        
        // Kompaktes Popup-Container
        const popupId = `wxPopup_${zone.icao}`;
        marker.bindPopup(`<div id="${popupId}" style="width: 250px; min-height: 120px; display: flex; align-items: center; justify-content: center; color: #888; font-family: Arial, sans-serif; margin: -5px;">Lade METAR...</div>`, { maxWidth: 300 });
        
        // Rendert das moderne, kompakte Widget (forceModern=true) beim Klick
        marker.on('popupopen', () => {
            if (measureMode) {
                marker.closePopup();
                return;
            }
            if (typeof loadMetarWidget === 'function') loadMetarWidget(zone.icao, popupId, zLat, zLon, true);
        });
        
        wxMapMarkers.push(marker);
    });

    if (!map._wxDodgingBound) {
        map.on('move zoom moveend zoomend', () => scheduleWeatherMarkerDodging(false));
        map._wxDodgingBound = true;
    }
    setTimeout(() => scheduleWeatherMarkerDodging(true), 50);
};

/* =========================================================
   DIRECT TO MODUS
   ========================================================= */

const ffStartIcon = hitBoxIcon('#00e5ff');
const ffDestIcon = L.divIcon({
    className: 'custom-pin',
    html: `<div class="pin-hitbox"><div class="pin-dot" style="background-color: #00e5ff; border: 2px solid #fff;"></div></div>`,
    iconSize: [34, 34], iconAnchor: [17, 17]
});

function isGpsLive(maxAgeMs = 15000) {
    const pos = window.lastLiveGpsPos;
    if (!pos) return false;
    if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lon)) return false;

    const ts = Number(pos.t) || 0;
    if (!ts || (Date.now() - ts) > maxAgeMs) return false;

    // Indicator kann zeitweise auf WAIT/WAKE stehen, obwohl wir eine frische Position haben.
    // Nur bei explizitem OFF blockieren wir den GPS-Start.
    const ind = document.getElementById('liveGpsIndicator');
    if (ind && typeof ind.innerHTML === 'string' && ind.innerHTML.includes('OFF')) return false;

    return true;
}

function toggleFreeflightMode() {
    freeflightMode = !freeflightMode;
    const btn = document.getElementById('freeflightBtn');
    if (freeflightMode) {
        btn.innerText = '✈️ Direct To (An)';
        btn.classList.add('active');
        if (measureMode) toggleMeasureMode();
        document.getElementById('map').style.cursor = 'crosshair';
        // GPS als Start?
        if (isGpsLive()) {
            const gps = window.lastLiveGpsPos;
            ffWaypoints = [{ lat: gps.lat, lng: gps.lon, name: 'GPS' }];
            showMapToast('GPS-Position als Start gesetzt');
        } else {
            ffNeedsStart = true;
            showMapToast('Tippe auf einen Flugplatz oder die Karte um den Startpunkt zu setzen');
        }
        // Missions-Route abdimmen
        if (polyline) polyline.setStyle({ opacity: 0.15 });
        routeMarkers.forEach(m => { if (m.getElement) { const el = m.getElement(); if (el) el.style.opacity = '0.15'; } });
    } else {
        btn.innerText = '✈️ Direct To (Aus)';
        btn.classList.remove('active');
        btn.style.background = '#444';
        btn.style.color = '#fff';
        document.getElementById('map').style.cursor = '';
        clearFreeflightRoute();
        ffWaypoints = [];
        ffNeedsStart = false;
        // Missions-Route wiederherstellen
        if (polyline) polyline.setStyle({ opacity: 1 });
        routeMarkers.forEach(m => { if (m.getElement) { const el = m.getElement(); if (el) el.style.opacity = '1'; } });
    }
}

function clearFreeflightRoute() {
    if (ffPolyline) { map.removeLayer(ffPolyline); ffPolyline = null; }
    ffMarkers.forEach(m => map.removeLayer(m));
    ffMarkers = [];
    if (ffContextPopup) { map.closePopup(ffContextPopup); ffContextPopup = null; }
}

function findNearestAirport(latlng, maxPixels) {
    if (typeof maxPixels === 'undefined') maxPixels = 60;
    if (!map) return null;
    const tapPx = map.latLngToLayerPoint(latlng);
    let best = null, bestDist = maxPixels + 1;

    // 1. cachedNavData (OpenAIP airports)
    cachedNavData.forEach(nav => {
        if (!nav.name.startsWith('APT ')) return;
        const navPx = map.latLngToLayerPoint([nav.lat, nav.lng]);
        const d = tapPx.distanceTo(navPx);
        if (d < bestDist) {
            bestDist = d;
            const parts = nav.name.replace('APT ', '').split(' (');
            best = { icao: parts[0].trim(), name: parts[0].trim(), lat: nav.lat, lon: nav.lng };
        }
    });
    if (best) return best;

    // 2. globalAirports Fallback
    if (typeof globalAirports === 'object' && globalAirports) {
        const latF = latlng.lat, lngF = latlng.lng;
        for (const icao in globalAirports) {
            const apt = globalAirports[icao];
            if (Math.abs(apt.lat - latF) > 0.5 || Math.abs(apt.lon - lngF) > 0.5) continue;
            const aptPx = map.latLngToLayerPoint([apt.lat, apt.lon]);
            const d = tapPx.distanceTo(aptPx);
            if (d < bestDist) {
                bestDist = d;
                best = { icao: apt.icao, name: apt.name || apt.city || apt.icao, lat: apt.lat, lon: apt.lon, elevation: apt.elevation ?? null };
            }
        }
    }
    return best;
}

function handleFreeflightMapClick(e) {
    if (isMapUiClickTarget(e.originalEvent)) return;
    if (ffContextPopup) { map.closePopup(ffContextPopup); ffContextPopup = null; }

    if (ffNeedsStart) {
        const apt = findNearestAirport(e.latlng, getAirportTapRadiusPx(34));
        if (apt) {
            ffWaypoints = [{ lat: apt.lat, lng: apt.lon, name: apt.icao, icao: apt.icao }];
            showMapToast('Start: ' + apt.icao + (apt.name && apt.name !== apt.icao ? ' — ' + apt.name : ''));
        } else {
            ffWaypoints = [{ lat: e.latlng.lat, lng: e.latlng.lng, name: 'Start' }];
            showMapToast('Startpunkt gesetzt');
        }
        ffNeedsStart = false;
        renderFreeflightRoute();
        return;
    }

    if (ffWaypoints.length === 0) return;

    const apt = findNearestAirport(e.latlng, getAirportTapRadiusPx(34));
    if (apt) {
        freeflightDirectTo(apt.icao, apt.lat, apt.lon, apt.name);
    }
}

window.freeflightDirectTo = function(icao, lat, lon, destName = '') {
    if (ffContextPopup) { map.closePopup(ffContextPopup); ffContextPopup = null; }
    // GPS-Start aktualisieren falls verfuegbar
    if (isGpsLive()) {
        const gps = window.lastLiveGpsPos;
        ffWaypoints[0] = { lat: gps.lat, lng: gps.lon, name: 'GPS' };
    }
    const startWp = ffWaypoints[0];
    const startName = startWp.icao || startWp.name || 'Start';

    // FF-Route in die Hauptroute uebertragen
    routeWaypoints = [
        { lat: startWp.lat, lng: startWp.lng },
        { lat: lat, lng: lon }
    ];
    const isLiveGpsStart = startWp.name === 'GPS';
    const isAirportStart = Boolean(startWp.icao);
    currentSName = isLiveGpsStart ? 'Live GPS Position' : (isAirportStart ? startName : 'Kartenstart');
    currentDName = destName || icao;
    if (typeof currentStartICAO !== 'undefined') {
        currentStartICAO = isAirportStart ? startWp.icao : 'GPS';
    }
    if (typeof currentDestICAO !== 'undefined') currentDestICAO = icao;
    const directNav = calcNav(startWp.lat, startWp.lng, lat, lon);
    currentMissionData = {
        start: currentStartICAO || 'GPS',
        dest: currentDestICAO,
        poiName: null,
        mission: 'Privater Flug',
        dist: directNav.dist,
        ac: typeof selectedAC !== 'undefined' ? selectedAC : 'N/A',
        heading: directNav.brng
    };
    if (typeof populateBriefingUI === 'function') {
        const startData = { lat: startWp.lat, lon: startWp.lng, n: currentSName, icao: currentStartICAO };
        const destData = { lat: lat, lon: lon, n: currentDName, icao: currentDestICAO };
        populateBriefingUI(
            '👤 Privater Flug',
            getDirectToPrivateStoryText(),
            'N/A',
            'N/A',
            false,
            routeWaypoints,
            startData,
            destData
        );
    }

    // Freeflight-Modus sauber beenden (ohne Route wiederherzustellen)
    clearFreeflightRoute();
    ffWaypoints = [];
    ffNeedsStart = false;
    freeflightMode = false;
    const btn = document.getElementById('freeflightBtn');
    if (btn) { btn.innerText = '✈️ Direct To (Aus)'; btn.classList.remove('active'); btn.style.background = '#444'; btn.style.color = '#fff'; }
    document.getElementById('map').style.cursor = '';

    // Hauptroute rendern (regulaerer Bearbeitungsmodus)
    if (polyline) polyline.setStyle({ opacity: 1 });
    renderMainRoute();
    updateRoutePerformance();

    // Lufträume, Landmarks, Hindernisse/Flüsse explizit laden —
    // updateRoutePerformance() gibt früh zurück wenn kein currentMissionData gesetzt ist
    // (Direct-To aus leerer Karte), daher hier direkt triggern.
    const _ffCacheKey = routeWaypoints.map(p =>
        `${(p.lat || 0).toFixed(4)},${((p.lng || p.lon) || 0).toFixed(4)}`).join('|');
    // Cache-Keys zurücksetzen damit ein voller Neu-Fetch stattfindet
    if (window._lastLmRouteKey  !== _ffCacheKey) window._lastLmRouteKey  = null;
    if (window._lastObsRouteKey !== _ffCacheKey) window._lastObsRouteKey = null;
    // Airspaces
    if (window.airspaceFetchTimeout) clearTimeout(window.airspaceFetchTimeout);
    window.airspaceFetchTimeout = setTimeout(() => {
        if (typeof fetchRouteAirspaces === 'function') fetchRouteAirspaces(routeWaypoints);
    }, 800);
    if (typeof triggerVerticalProfileUpdate === 'function') triggerVerticalProfileUpdate();

    // Elevation, Frequenz & Pisten für beide Airports via OpenAIP laden
    const startIcao = startWp.icao || null;
    if (startIcao && startIcao !== 'GPS' && typeof fetchAirportFreq === 'function') {
        fetchAirportFreq(startIcao, 'wikiDepFreqText', 'dep');
    }
    if (typeof fetchAirportFreq === 'function') {
        fetchAirportFreq(icao, 'wikiDestFreqText', 'dest');
    }
    if (startIcao && startIcao !== 'GPS' && typeof fetchRunwayDetails === 'function') {
        fetchRunwayDetails(startWp.lat, startWp.lng, 'mDepRwy', startIcao);
    }
    if (typeof fetchRunwayDetails === 'function') {
        fetchRunwayDetails(lat, lon, 'mDestRwy', icao);
    }

    // Karte auf Route einpassen
    const bounds = L.latLngBounds(routeWaypoints.map(w => [w.lat, w.lng || w.lon]));
    map.fitBounds(bounds, { padding: [60, 60] });

    showMapToast('Direct to ' + icao);
};

function renderFreeflightRoute() {
    clearFreeflightRoute();
    if (ffWaypoints.length === 0) return;

    // Marker zeichnen
    ffWaypoints.forEach((wp, i) => {
        const icon = i === 0 ? ffStartIcon : ffDestIcon;
        const marker = L.marker([wp.lat, wp.lng], { icon: icon, interactive: false, zIndexOffset: 900 }).addTo(map);
        if (wp.name) marker.bindTooltip(wp.name, { permanent: true, direction: 'top', offset: [0, -12],
            className: 'ff-tooltip' });
        ffMarkers.push(marker);
    });

    // Polyline zeichnen
    if (ffWaypoints.length >= 2) {
        const coords = ffWaypoints.map(w => [w.lat, w.lng]);
        ffPolyline = L.polyline(coords, {
            color: '#00e5ff', weight: 6, dashArray: '12,8', opacity: 0.9, interactive: false
        }).addTo(map);

        // Nav-Info Tooltip am Mittelpunkt
        const p1 = ffWaypoints[0], p2 = ffWaypoints[1];
        const nav = calcNav(p1.lat, p1.lng, p2.lat, p2.lng);
        const midLat = (p1.lat + p2.lat) / 2, midLng = (p1.lng + p2.lng) / 2;
        const infoTooltip = L.tooltip({ permanent: true, direction: 'center', className: 'ff-nav-tooltip',
            offset: [0, -15] })
            .setLatLng([midLat, midLng])
            .setContent(`<b>${Math.round(nav.brng)}° / ${nav.dist.toFixed(1)} NM</b>`)
            .addTo(map);
        ffMarkers.push(infoTooltip);
    }
}

function showMapToast(message, durationMs) {
    if (!durationMs) durationMs = 3000;
    const container = document.getElementById('mapArea') || document.body;
    const toast = document.createElement('div');
    toast.className = 'ff-toast';
    toast.textContent = message;
    toast.style.animationDuration = durationMs + 'ms';
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, durationMs + 100);
}
