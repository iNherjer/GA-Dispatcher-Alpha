/* === VERTICAL PROFILE & CANVAS ENGINE (v220) === */
if (!document.getElementById('vp-err-dot-style')) {
    const style = document.createElement('style');
    style.id = 'vp-err-dot-style';
    style.innerHTML = `.vp-error-dot { position:absolute; top:-4px; right:-4px; width:10px; height:10px; background-color:#ff4444; border-radius:50%; border:1.5px solid #222; z-index:10; box-shadow: 0 0 4px #ff0000; } .vp-btn-relative { position:relative; overflow:visible !important; }`;
    document.head.appendChild(style);
}

window.vpFailedOverpassChunks = [];
window.updateOverpassErrorUI = function() {
    const hasError = window.vpFailedOverpassChunks && window.vpFailedOverpassChunks.length > 0;

    // Error-Dot auf Einzel-Buttons (im Untermenü)
    const btnOb = document.getElementById('btnToggleObstacles');
    const btnLin = document.getElementById('btnToggleLinear');
    [btnOb, btnLin].forEach(btn => {
        if (!btn) return;
        btn.classList.add('vp-btn-relative');
        let dot = btn.querySelector('.vp-error-dot');
        if (hasError) {
            if (!dot) { dot = document.createElement('div'); dot.className = 'vp-error-dot'; btn.appendChild(dot); }
        } else {
            if (dot) dot.remove();
        }
    });

    // Error-Dot auch am Zahnrad-Button sichtbar machen
    const gearDot = document.getElementById('vpSettingsErrorDot');
    if (gearDot) gearDot.style.display = hasError ? 'block' : 'none';
};
window.vpBgNeedsUpdate = true;
window.vpAnimFrameId = null;
window.vpAnimFrameTimerId = null;
window.vpAnimFrameMeta = window.vpAnimFrameMeta || { lastPaintMs: 0, lastTargetFps: 0 };
window.vpProfilePanActive = false;
window._vpLastScrollLeft = 0;
window._vpProfileRenderTimer = null;
window.vpScheduleProfileRender = function(reason = 'profile', delayMs = 50) {
    window.vpBgNeedsUpdate = true;
    if (window.gaDebugPush) window.gaDebugPush('profile-render', '[Profile] render scheduled', { reason: String(reason || ''), delayMs: Number(delayMs || 0) });
    if (window._vpProfileRenderTimer) clearTimeout(window._vpProfileRenderTimer);
    window._vpProfileRenderTimer = setTimeout(() => {
        window._vpProfileRenderTimer = null;
        if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
    }, Math.max(0, Number(delayMs || 0)));
};
window.vpProfilePerfWarn = function(label, t0, extra = null, warnMs = 120) {
    const now = performance && performance.now ? performance.now() : Date.now();
    const durationMs = Math.round((now - Number(t0 || now)) * 10) / 10;
    if (durationMs >= warnMs) {
        const payload = { durationMs, ...(extra || {}) };
        if (window.gaDebugPush) window.gaDebugPush(durationMs >= 250 ? 'perf-warn' : 'perf', `[PERF] ${label}`, payload);
        if (durationMs >= 250) console.warn('[PERF]', label, payload);
    }
    return durationMs;
};
function vpIsMapProfileFrameScheduled() {
    return !!(window.vpAnimFrameId || window.vpAnimFrameTimerId);
}
window.vpIsMapProfileFrameScheduled = vpIsMapProfileFrameScheduled;
function vpRequestMapProfileRaf() {
    if (window.vpAnimFrameId) return;
    window.vpAnimFrameId = requestAnimationFrame((timeMs) => {
        window.vpAnimFrameId = null;
        renderMapProfileFrames(timeMs);
    });
}
function vpScheduleMapProfileFrame(delayMs = 0) {
    if (window.vpAnimFrameId || window.vpAnimFrameTimerId) return;
    const delay = Math.max(0, Number(delayMs) || 0);
    if (delay <= 0) {
        vpRequestMapProfileRaf();
        return;
    }
    window.vpAnimFrameTimerId = setTimeout(() => {
        window.vpAnimFrameTimerId = null;
        vpRequestMapProfileRaf();
    }, delay);
}
function vpRequestMapProfileFrameNow() {
    if (window.vpAnimFrameTimerId) {
        clearTimeout(window.vpAnimFrameTimerId);
        window.vpAnimFrameTimerId = null;
    }
    vpRequestMapProfileRaf();
}
function vpStopMapProfileFrameLoop() {
    if (window.vpAnimFrameTimerId) clearTimeout(window.vpAnimFrameTimerId);
    window.vpAnimFrameTimerId = null;
    if (window.vpAnimFrameId) cancelAnimationFrame(window.vpAnimFrameId);
    window.vpAnimFrameId = null;
}
function vpScheduleNextMapProfileFrame(frameIntervalMs, lastPaintMs) {
    const now = performance && performance.now ? performance.now() : Date.now();
    const elapsedSincePaintMs = Math.max(0, now - (Number(lastPaintMs) || now));
    vpScheduleMapProfileFrame(Math.max(0, Number(frameIntervalMs || 0) - elapsedSincePaintMs));
}
/* =========================================================
   VERTICAL PROFILE (Höhenprofil) ENGINE
   ========================================================= */
let vpElevationData = null;
let vpWeatherData = null;
let vpProfileFastTimeout = null;
let vpProfileSlowTimeout = null;
let globalCities = null;
let globalCitiesLoadPromise = null;

async function loadGlobalCities() {
    if (Array.isArray(globalCities)) return;
    if (globalCitiesLoadPromise) {
        await globalCitiesLoadPromise;
        return;
    }
    globalCitiesLoadPromise = (async () => {
        if (Array.isArray(window.GLOBAL_CITIES_DATA)) {
            globalCities = window.GLOBAL_CITIES_DATA;
            return;
        }
        try {
            // Lazy-Load: city dataset erst bei tatsächlichem Bedarf laden.
            const res = await fetch('./cities.json', { cache: 'default' });
            if (res.ok) {
                const parsed = await res.json();
                globalCities = Array.isArray(parsed) ? parsed : [];
            } else {
                globalCities = [];
            }
        } catch (_) {
            globalCities = [];
        }
    })();
    try {
        await globalCitiesLoadPromise;
    } finally {
        globalCitiesLoadPromise = null;
    }
}

let vpZoomLevel = 100; // 100 = full route, 10 = 10% view
let vpHighResData = null; // Higher resolution elevation data for zoom
let vpElevationCache = {}; // Cache to prevent API rate limits (HTTP 429)
const VP_ELEVATION_COOLDOWN_MS = 15 * 60 * 1000;
let vpClimbRate = 500; // ft/min climb rate (configurable)
let vpDescentRate = 500; // ft/min descent rate (configurable)
let vpLandmarks = [];
let vpObstacles = [];
let vpLinearFeatures = [];
const VP_LINEAR_ROUTE_CROSS_NM = 0.35;
const VP_PROFILE_OBS_LATERAL_MAX_NM = 0.5;
const VP_PROFILE_WIND_LATERAL_MAX_NM = 0.8;
const VP_PROFILE_LIN_LATERAL_MAX_NM = 0.6;
// Linear icon style in vertical profile:
// - 'r2f1'  => new road/river style (R2/F1)
// - 'legacy' => previous symbols for quick rollback
const VP_PROFILE_LINEAR_ICON_STYLE = 'r2f1';
const VP_DECLUTTER_COLLISION_PAD_PX = 0;
const VP_POWERLINE_MAST_LATERAL_NM = 0.8;
const VP_POWERLINE_MAST_MATCH_DIST_NM = 1.4;
window.vpElevationFallbackActive = false;
window.vpTerrainElevationSource = 'terrarium';
const VP_OVERPASS_SERVERS = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter'
];
const VP_OVERPASS_MIN_REQUERY_MS = 15 * 1000;
const VP_OVERPASS_BASE_COOLDOWN_MS = 15 * 1000;
const VP_OVERPASS_MAX_COOLDOWN_MS = 3 * 60 * 1000;
const VP_OVERPASS_TILE_FAIL_BASE_MS = 45 * 1000;
const VP_OVERPASS_TILE_FAIL_MAX_MS = 8 * 60 * 1000;
const VP_OVERPASS_STATE_STORAGE_KEY = 'ga_overpass_state_v1';
const VP_OBS_POOL_STORAGE_KEY = 'ga_obs_pool_v1';
const VP_OBS_POOL_MAX_OBS = 12000;
const VP_OBS_POOL_MAX_LIN = 60000;
const VP_OBS_POOL_TTL_MS = 0; // 0 = rolling cache ohne Zeitablauf
const VP_OBS_POOL_PERSIST_MAX_OBS = 2500;
const VP_OBS_POOL_PERSIST_MAX_LIN = 5000;
const VP_OBS_POOL_MAX_BYTES = 650_000;
const VP_OBS_COMBO_PREFIX = 'ga_obs_combo_';
const VP_OBS_COMBO_MAX_ENTRIES = 8;
const VP_OBS_TILE_COVERAGE_KEY = 'ga_obs_tile_cov_v1';
const VP_OBS_TILE_EDGE_NM = 25;
const VP_OBS_TILE_STEP_LAT = VP_OBS_TILE_EDGE_NM / 60; // ~0.4167°
const VP_OBS_TILE_STEP_LON = VP_OBS_TILE_EDGE_NM / 60; // global fixer Raster-Schritt
const VP_OBS_TILE_TTL_MS = 0; // 0 = rolling cache ohne Zeitablauf
const VP_OBS_TILE_INTER_REQUEST_MS = 3200;
const VP_OBS_TILE_MAX_PER_PASS = 1;
const VP_OBS_TILE_MAX_PER_PASS_FORCE = 2;
const VP_OBS_TILE_INTER_REQUEST_LONG_MS = 4200;
const VP_OBS_TILE_DEFERRED_RETRY_MS = 5000;
const VP_OBS_HOSTED_PARALLELISM = 6;
const VP_OBS_HOSTED_MAX_PER_PASS = 36;
const VP_OBS_HOSTED_ENABLED = localStorage.getItem('ga_obs_hosted_enabled') !== 'false';
const VP_OBS_HOSTED_MISS_TTL_MS = 30 * 60 * 1000;
const VP_OBS_HOSTED_TIMEOUT_MS = 2200;
const VP_ROUTE_STATS_HEAVY_FEATURE_LIMIT = 14000;
const VP_OBS_HOSTED_ENDPOINTS = [
    './obstacles/core-tiles/{latI}/{lonI}.json.gz',
    './obstacles/core-tiles/{latI}/{lonI}.json',
    './obstacles/tiles/{latI}/{lonI}.json',
    'https://ga-proxy.einherjer.workers.dev/api/obstacles/tile'
];
const VP_PROFILE_FPS_IDLE = 2;
const VP_PROFILE_FPS_ACTIVE = 12;
const VP_PROFILE_FPS_ACTIVE_LOW = 8;
const VP_PROFILE_FPS_INTERACT = 30;
const VP_PROFILE_FPS_INTERACT_LOW = 16;
const VP_OBS_TILE_FAILED_KEY = 'ga_obs_tile_failed_v1';
const VP_OBS_TILE_FAILED_MAX = 1200;
let vpOverpassStateHydrated = false;
let vpOverpassState = {
    cooldownUntil: 0,
    backoffLevel: 0,
    lastFailureAt: 0,
    lastFailureStatus: 0,
    lastSuccessAt: 0
};
window.vpOverpassInFlight = window.vpOverpassInFlight || new Map();
window.vpOverpassRouteLastSuccess = window.vpOverpassRouteLastSuccess || {};
window.vpOverpassGlobalInFlight = window.vpOverpassGlobalInFlight || null;
window.vpOverpassTileBackoff = window.vpOverpassTileBackoff || new Map();
let vpObsPoolHydrated = false;
let vpObsPoolPersistTimer = null;
let vpObsTileCoverageHydrated = false;
let vpObsTileCoveragePersistTimer = null;
let vpObsTileFailedHydrated = false;
let vpObsTileFailedPersistTimer = null;
const vpObsPool = {
    obs: new Map(),
    lin: new Map()
};
const vpObsPoolTileIndex = {
    obs: new Map(),
    lin: new Map()
};

function vpInferRoadKindFromText(ref, name, highwayTag = '') {
    const txt = `${String(ref || '')} ${String(name || '')}`.toUpperCase();
    const hw = String(highwayTag || '').toLowerCase();
    if (/\bA\s*\d+\b/.test(txt) || hw === 'motorway' || hw === 'motorway_link') return 'motorway';
    if (/\bB\s*\d+\b/.test(txt) || hw === 'trunk' || hw === 'trunk_link' || hw === 'primary' || hw === 'primary_link') return 'bundesstrasse';
    return 'road_minor';
}

function vpLinearPriority(feat) {
    const t = String(feat?.type || '').toLowerCase();
    const k = String(feat?.lineKind || '').toLowerCase();
    if (t === 'highway') {
        if (k === 'motorway') return 80;
        if (k === 'bundesstrasse') return 68;
        return 58;
    }
    if (t === 'river') return 62;
    if (t === 'powerline') {
        if (k === 'line') return 40;
        if (k === 'minor_line') return 28;
        if (k === 'cable') return 20;
        return 34;
    }
    return 10;
}

function vpBoxesOverlap(a, b, pad = 0) {
    if (!a || !b) return false;
    return (a.l < b.r + pad && a.r > b.l - pad && a.t < b.b + pad && a.b > b.t - pad);
}
const vpObsTileCoverage = new Map();
const vpObsTileFailed = new Map();
const vpObsHostedMissCache = new Map();
window.vpObsTileConfig = {
    storageKey: VP_OBS_TILE_COVERAGE_KEY,
    stepLat: VP_OBS_TILE_STEP_LAT,
    stepLon: VP_OBS_TILE_STEP_LON
};
window.vpObsTileFailConfig = {
    storageKey: VP_OBS_TILE_FAILED_KEY,
    maxEntries: VP_OBS_TILE_FAILED_MAX
};

// Traffic im Profil
window.vpTrafficProfileVisible = true;

async function fetchProfileLandmarks(elevData) {
    if (!elevData || elevData.length < 2) return [];
    let minL = 90, maxL = -90, minLo = 180, maxLo = -180;
    elevData.forEach(p => {
        if(p.lat < minL) minL = p.lat; if(p.lat > maxL) maxL = p.lat;
        if(p.lon < minLo) minLo = p.lon; if(p.lon > maxLo) maxLo = p.lon;
    });
    minL -= 0.1; maxL += 0.1; minLo -= 0.15; maxLo += 0.15;
    let landmarks = [];
    
    await loadGlobalAirports();
    for(let k in globalAirports) {
        let a = globalAirports[k];
        if (a.lat > minL && a.lat < maxL && a.lon > minLo && a.lon < maxLo) {
            let bestD = Infinity, bestDistNM = 0;
            elevData.forEach(ep => {
                let d = calcNav(a.lat, a.lon, ep.lat, ep.lon).dist;
                if(d < bestD) { bestD = d; bestDistNM = ep.distNM; }
            });
            if (bestD < 3.5) landmarks.push({ name: a.icao, type: 'apt', pop: 100000000, distNM: bestDistNM });
        }
    }
    
    await loadGlobalCities();
    if (globalCities && globalCities.length > 0) {
        globalCities.forEach(c => {
            if (c.lat > minL && c.lat < maxL && c.lon > minLo && c.lon < maxLo) {
                let bestD = Infinity, bestDistNM = 0;
                elevData.forEach(ep => {
                    let d = calcNav(c.lat, c.lon, ep.lat, ep.lon).dist;
                    if(d < bestD) { bestD = d; bestDistNM = ep.distNM; }
                });
                if (bestD < 3.5) {
                    let cType = c.pop >= 15000 ? 'city' : 'town';
                    landmarks.push({ name: c.name, type: cType, pop: c.pop || 5000, distNM: bestDistNM });
                }
            }
        });
    }
    return landmarks.sort((a,b) => b.pop - a.pop);
}

// GPS-zentrierte Städte/Airports laden (ohne Flugplan, aus RAM)
async function updateGpsCities(lat, lon) {
    await loadGlobalCities();
    await loadGlobalAirports();
    let landmarks = [];

    if (globalCities && globalCities.length > 0) {
        globalCities.forEach(c => {
            if (Math.abs(c.lat - lat) > 0.22 || Math.abs(c.lon - lon) > 0.33) return;
            const nav = calcNav(lat, lon, c.lat, c.lon);
            if (nav.dist > 15) return;
            landmarks.push({ name: c.name, type: c.pop >= 15000 ? 'city' : 'town', pop: c.pop || 5000, distNM: nav.dist });
        });
    }
    if (typeof globalAirports !== 'undefined' && globalAirports) {
        for (let k in globalAirports) {
            const a = globalAirports[k];
            const nav = calcNav(lat, lon, a.lat, a.lon);
            if (nav.dist <= 10) landmarks.push({ name: a.icao, type: 'apt', pop: 100000000, distNM: nav.dist });
        }
    }

    vpLandmarks = landmarks.sort((a, b) => b.pop - a.pop);
    window.vpBgNeedsUpdate = true;
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
}
window.updateGpsCities = updateGpsCities;


// Helfer zum Entdoppeln von Hindernissen (nimmt das höchste in einem engen Fenster)
function deduplicateFeatures(features) {
    const buckets = {};
    for (const f of (Array.isArray(features) ? features : [])) {
        if (!f || !Number.isFinite(Number(f.distNM))) continue;
        const t = String(f.type || '').toLowerCase();
        const typeGroup = (t === 'wind') ? 'wind' : ((t === 'power_tower') ? 'power_tower' : 'mast');
        const bIdx = Math.floor(Number(f.distNM) / 0.35);
        const key = `${typeGroup}|${bIdx}`;
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(f);
    }
    const final = [];
    for (const k in buckets) {
        buckets[k].sort((a, b) => Number(b.hFt || 0) - Number(a.hFt || 0));
        const rep = { ...buckets[k][0], count: buckets[k].length };
        final.push(rep);
    }
    return final.sort((a, b) => Number(a.distNM || 0) - Number(b.distNM || 0));
}

function vpHydrateOverpassState() {
    if (vpOverpassStateHydrated) return;
    vpOverpassStateHydrated = true;
    try {
        const raw = localStorage.getItem(VP_OVERPASS_STATE_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;
        vpOverpassState = {
            cooldownUntil: Number(parsed.cooldownUntil || 0),
            backoffLevel: Math.max(0, Number(parsed.backoffLevel || 0)),
            lastFailureAt: Number(parsed.lastFailureAt || 0),
            lastFailureStatus: Number(parsed.lastFailureStatus || 0),
            lastSuccessAt: Number(parsed.lastSuccessAt || 0)
        };
    } catch (_) { }
}

function vpPersistOverpassState() {
    try {
        localStorage.setItem(VP_OVERPASS_STATE_STORAGE_KEY, JSON.stringify(vpOverpassState));
    } catch (_) { }
}

function vpGetOverpassCooldownRemainingMs(now = Date.now()) {
    vpHydrateOverpassState();
    const until = Number(vpOverpassState.cooldownUntil || 0);
    return Math.max(0, until - now);
}

function vpIsOverpassCoolingDown(now = Date.now()) {
    return vpGetOverpassCooldownRemainingMs(now) > 0;
}

function vpGetTileBackoffRemainingMs(tileKey, now = Date.now()) {
    const m = window.vpOverpassTileBackoff && window.vpOverpassTileBackoff.get(tileKey);
    if (!m) return 0;
    const until = Number(m.until || 0);
    return Math.max(0, until - now);
}

function vpIsTileBackoffActive(tileKey, now = Date.now()) {
    return vpGetTileBackoffRemainingMs(tileKey, now) > 0;
}

function vpMarkTileBackoff(tileKey) {
    if (typeof tileKey !== 'string' || !tileKey) return 0;
    if (!window.vpOverpassTileBackoff) window.vpOverpassTileBackoff = new Map();
    const now = Date.now();
    const prev = window.vpOverpassTileBackoff.get(tileKey);
    const tries = Math.min(8, Number((prev && prev.tries) || 0) + 1);
    const ms = Math.min(VP_OVERPASS_TILE_FAIL_MAX_MS, Math.round(VP_OVERPASS_TILE_FAIL_BASE_MS * Math.pow(1.7, Math.max(0, tries - 1))));
    const jitter = Math.round((Math.random() - 0.5) * 0.16 * ms);
    const until = now + Math.max(15 * 1000, ms + jitter);
    window.vpOverpassTileBackoff.set(tileKey, { tries, until });
    return Math.max(0, until - now);
}

function vpClearTileBackoff(tileKey) {
    if (!window.vpOverpassTileBackoff) return;
    window.vpOverpassTileBackoff.delete(tileKey);
}

function vpMinTileBackoffRemainingMs(tileKeys, now = Date.now()) {
    let min = Infinity;
    if (!Array.isArray(tileKeys)) return 0;
    for (const key of tileKeys) {
        const rem = vpGetTileBackoffRemainingMs(key, now);
        if (rem > 0 && rem < min) min = rem;
    }
    return Number.isFinite(min) ? min : 0;
}

function vpMarkOverpassSuccess() {
    vpHydrateOverpassState();
    vpOverpassState.backoffLevel = 0;
    vpOverpassState.cooldownUntil = 0;
    vpOverpassState.lastSuccessAt = Date.now();
    vpPersistOverpassState();
}

function vpApplyOverpassBackoff(statusCode, retryAfterSec = 0) {
    vpHydrateOverpassState();
    vpOverpassState.backoffLevel = Math.min(6, Number(vpOverpassState.backoffLevel || 0) + 1);
    const baseMs = statusCode === 429 ? Math.max(VP_OVERPASS_BASE_COOLDOWN_MS, 20 * 1000) : VP_OVERPASS_BASE_COOLDOWN_MS;
    const exp = Math.pow(1.7, Math.max(0, vpOverpassState.backoffLevel - 1));
    const retryAfterMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : 0;
    const cooldownMs = Math.min(VP_OVERPASS_MAX_COOLDOWN_MS, Math.max(baseMs * exp, retryAfterMs));
    const jitterMs = Math.floor(Math.random() * 1200);
    vpOverpassState.cooldownUntil = Date.now() + cooldownMs + jitterMs;
    vpOverpassState.lastFailureAt = Date.now();
    vpOverpassState.lastFailureStatus = Number(statusCode || 0);
    vpPersistOverpassState();
    return cooldownMs + jitterMs;
}

function vpObsKey(item) {
    const lat = Number(item && item.lat);
    const lon = Number(item && item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
    const t = String(item.type || 'obs');
    return `${t}|${lat.toFixed(4)}|${lon.toFixed(4)}`;
}

function vpLinKey(item) {
    const lat = Number(item && item.lat);
    const lon = Number(item && item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
    const t = String(item.type || 'lin');
    const n = String(item.name || '').slice(0, 48);
    const k = String(item.lineKind || '').slice(0, 24);
    return `${t}|${k}|${n}|${lat.toFixed(4)}|${lon.toFixed(4)}`;
}

function vpIndexObsPoolEntry(kind, key, item) {
    const idx = kind === 'obs' ? vpObsPoolTileIndex.obs : vpObsPoolTileIndex.lin;
    if (!idx || !key || !item) return;
    const tileKey = String(item.tileKey || vpObsTileKey(item.lat, item.lon) || '');
    if (!tileKey) return;
    let set = idx.get(tileKey);
    if (!set) {
        set = new Set();
        idx.set(tileKey, set);
    }
    set.add(key);
}

function vpRebuildObsPoolTileIndex() {
    vpObsPoolTileIndex.obs.clear();
    vpObsPoolTileIndex.lin.clear();
    for (const [key, item] of vpObsPool.obs.entries()) vpIndexObsPoolEntry('obs', key, item);
    for (const [key, item] of vpObsPool.lin.entries()) vpIndexObsPoolEntry('lin', key, item);
}

function vpGetObsPoolCandidates(kind, tileKeys) {
    const pool = kind === 'obs' ? vpObsPool.obs : vpObsPool.lin;
    const idx = kind === 'obs' ? vpObsPoolTileIndex.obs : vpObsPoolTileIndex.lin;
    if (!pool || !idx || !tileKeys || !tileKeys.size) return [];
    const out = [];
    for (const tileKey of tileKeys) {
        const keys = idx.get(tileKey);
        if (!keys || !keys.size) continue;
        for (const key of keys) {
            const item = pool.get(key);
            if (!item) {
                keys.delete(key);
                continue;
            }
            const currentTile = String(item.tileKey || vpObsTileKey(item.lat, item.lon) || '');
            if (currentTile !== tileKey) {
                keys.delete(key);
                vpIndexObsPoolEntry(kind, key, item);
                continue;
            }
            out.push(item);
        }
        if (!keys.size) idx.delete(tileKey);
    }
    return out;
}

function vpTrimTimedMap(mapObj, maxEntries) {
    if (!mapObj || mapObj.size <= maxEntries) return false;
    const arr = Array.from(mapObj.entries());
    arr.sort((a, b) => Number(b[1].ts || 0) - Number(a[1].ts || 0));
    mapObj.clear();
    for (let i = 0; i < Math.min(maxEntries, arr.length); i++) mapObj.set(arr[i][0], arr[i][1]);
    return true;
}

function vpTrimLinearMapFairByTile(mapObj, maxEntries) {
    if (!mapObj || mapObj.size <= maxEntries) return false;
    const entries = Array.from(mapObj.entries());
    const byTile = new Map();
    for (const it of entries) {
        const v = it[1] || {};
        const tk = String(v.tileKey || '');
        if (!byTile.has(tk)) byTile.set(tk, []);
        byTile.get(tk).push(it);
    }

    // Fair + robust: pro Tile nach Timestamp sortieren und dann round-robin ziehen.
    const groups = Array.from(byTile.values()).map(group =>
        group.slice().sort((a, b) => Number((b[1] && b[1].ts) || 0) - Number((a[1] && a[1].ts) || 0))
    );
    const idx = new Array(groups.length).fill(0);
    const keep = [];
    while (keep.length < maxEntries) {
        let progressed = false;
        for (let gi = 0; gi < groups.length && keep.length < maxEntries; gi++) {
            const arr = groups[gi];
            const pos = idx[gi];
            if (pos >= arr.length) continue;
            keep.push(arr[pos]);
            idx[gi] = pos + 1;
            progressed = true;
        }
        if (!progressed) break;
    }
    mapObj.clear();
    for (const [k, v] of keep.slice(0, maxEntries)) mapObj.set(k, v);
    return true;
}

function vpTrimMapNewest(mapObj, keepCount) {
    if (!mapObj) return;
    const arr = Array.from(mapObj.entries());
    arr.sort((a, b) => Number(b[1].ts || 0) - Number(a[1].ts || 0));
    mapObj.clear();
    for (let i = 0; i < Math.min(keepCount, arr.length); i++) mapObj.set(arr[i][0], arr[i][1]);
}

function vpTakeNewestValues(mapObj, keepCount) {
    if (!mapObj || keepCount <= 0) return [];
    return Array.from(mapObj.values())
        .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))
        .slice(0, keepCount);
}

function vpPruneObsPool(now = Date.now()) {
    const ttl = VP_OBS_POOL_TTL_MS;
    let changed = false;
    if (ttl > 0) {
        for (const [k, v] of vpObsPool.obs.entries()) {
            if (!v || !Number(v.ts) || (now - Number(v.ts)) > ttl) {
                vpObsPool.obs.delete(k);
                changed = true;
            }
        }
        for (const [k, v] of vpObsPool.lin.entries()) {
            if (!v || !Number(v.ts) || (now - Number(v.ts)) > ttl) {
                vpObsPool.lin.delete(k);
                changed = true;
            }
        }
    }
    changed = vpTrimTimedMap(vpObsPool.obs, VP_OBS_POOL_MAX_OBS) || changed;
    changed = vpTrimLinearMapFairByTile(vpObsPool.lin, VP_OBS_POOL_MAX_LIN) || changed;
    if (changed) vpRebuildObsPoolTileIndex();
}

function vpEncodeObsPoolWithBudget() {
    const obsArr = vpTakeNewestValues(vpObsPool.obs, VP_OBS_POOL_PERSIST_MAX_OBS);
    const linArr = vpTakeNewestValues(vpObsPool.lin, VP_OBS_POOL_PERSIST_MAX_LIN);
    let obsCount = Math.min(obsArr.length, VP_OBS_POOL_PERSIST_MAX_OBS);
    let linCount = Math.min(linArr.length, VP_OBS_POOL_PERSIST_MAX_LIN);
    let raw = '';

    while (true) {
        const payload = { obs: obsArr.slice(0, obsCount), lin: linArr.slice(0, linCount) };
        raw = JSON.stringify(payload);
        if (raw.length <= VP_OBS_POOL_MAX_BYTES) return { raw, obsCount, linCount };
        if (obsCount <= 200 && linCount <= 400) return { raw, obsCount, linCount };

        if (linCount > 400) {
            linCount = Math.max(400, Math.floor(linCount * 0.65));
        } else if (obsCount > 200) {
            obsCount = Math.max(200, Math.floor(obsCount * 0.65));
        } else {
            return { raw, obsCount, linCount };
        }
    }
}

function vpHydrateObsPool() {
    if (vpObsPoolHydrated) return;
    vpObsPoolHydrated = true;
    try {
        const raw = localStorage.getItem(VP_OBS_POOL_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const obs = Array.isArray(parsed && parsed.obs) ? parsed.obs : [];
        const lin = Array.isArray(parsed && parsed.lin) ? parsed.lin : [];
        for (const item of obs) {
            const key = vpObsKey(item);
            if (!key) continue;
            const entry = {
                ts: Number(item.ts || 0),
                type: item.type || 'mast',
                hFt: Number(item.hFt || 0),
                elevFt: Number(item.elevFt || 0),
                lat: Number(item.lat),
                lon: Number(item.lon),
                tileKey: String(item.tileKey || vpObsTileKey(item.lat, item.lon) || '')
            };
            vpObsPool.obs.set(key, entry);
        }
        for (const item of lin) {
            const key = vpLinKey(item);
            if (!key) continue;
            const entry = {
                ts: Number(item.ts || 0),
                type: item.type || 'linear',
                name: String(item.name || ''),
                lineKind: String(item.lineKind || ''),
                lat: Number(item.lat),
                lon: Number(item.lon),
                tileKey: String(item.tileKey || vpObsTileKey(item.lat, item.lon) || '')
            };
            vpObsPool.lin.set(key, entry);
        }
        vpPruneObsPool();
        vpRebuildObsPoolTileIndex();
    } catch (_) { }
}

function vpPersistObsPoolSoon() {
    if (vpObsPoolPersistTimer) return;
    vpObsPoolPersistTimer = setTimeout(() => {
        vpObsPoolPersistTimer = null;
        const perf = window.gaPerfStart ? window.gaPerfStart('Overpass persist obs pool', {
            obs: vpObsPool.obs ? vpObsPool.obs.size : 0,
            lin: vpObsPool.lin ? vpObsPool.lin.size : 0
        }) : null;
        try {
            vpPruneObsPool();
            const packed = vpEncodeObsPoolWithBudget();
            // Wichtig: Nur die persistierte Snapshot-Groesse begrenzen.
            // Den RAM-Pool nicht auf Persist-Größe zusammenschrumpfen, sonst
            // verschwinden nach Routenwechseln visuell Features "zufaellig".
            localStorage.setItem(VP_OBS_POOL_STORAGE_KEY, packed.raw);
            if (window.vpWeatherDebug) window.vpWeatherDebug.overpassTileCoverageEntries = vpObsTileCoverage.size;
            if (window.gaPerfEnd) window.gaPerfEnd(perf, { ok: true, bytes: packed.raw.length, obs: packed.obsCount, lin: packed.linCount });
        } catch (_) {
            try {
                // Fallback: kleiner Snapshot nur fuer Persistenz, RAM-Pool bleibt erhalten.
                const obsSnapshot = Array.from(vpObsPool.obs.values())
                    .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))
                    .slice(0, 1200);
                const linSnapshot = Array.from(vpObsPool.lin.values())
                    .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))
                    .slice(0, 800);
                const fallbackRaw = JSON.stringify({ obs: obsSnapshot, lin: linSnapshot });
                localStorage.setItem(VP_OBS_POOL_STORAGE_KEY, fallbackRaw);
                if (window.gaPerfEnd) window.gaPerfEnd(perf, { ok: true, fallback: true, bytes: fallbackRaw.length });
            } catch (_) {
                if (window.gaPerfEnd) window.gaPerfEnd(perf, { ok: false });
            }
        }
    }, 400);
}

function vpListObsComboKeys() {
    const keys = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(VP_OBS_COMBO_PREFIX)) keys.push(k);
        }
    } catch (_) { }
    return keys;
}

function vpReadObsComboTs(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return 0;
        const parsed = JSON.parse(raw);
        return Number(parsed && parsed.ts) || 0;
    } catch (_) {
        return 0;
    }
}

function vpPruneObsComboRouteCache(maxEntries = VP_OBS_COMBO_MAX_ENTRIES) {
    const keys = vpListObsComboKeys();
    if (keys.length <= maxEntries) return 0;
    const victims = keys
        .map(k => ({ k, ts: vpReadObsComboTs(k) }))
        .sort((a, b) => (a.ts - b.ts))
        .slice(0, Math.max(0, keys.length - maxEntries));
    let removed = 0;
    for (const v of victims) {
        try {
            localStorage.removeItem(v.k);
            removed++;
        } catch (_) { }
    }
    return removed;
}

function vpStoreObsComboRouteCache(cacheKey, obs, lin) {
    const perf = window.gaPerfStart ? window.gaPerfStart('Overpass store combo cache', {
        obs: Array.isArray(obs) ? obs.length : 0,
        lin: Array.isArray(lin) ? lin.length : 0
    }) : null;
    const key = `${VP_OBS_COMBO_PREFIX}${cacheKey}`;
    const payload = JSON.stringify({ ts: Date.now(), obs: obs || [], lin: lin || [] });
    try {
        vpPruneObsComboRouteCache(VP_OBS_COMBO_MAX_ENTRIES - 1);
        localStorage.setItem(key, payload);
        vpPruneObsComboRouteCache(VP_OBS_COMBO_MAX_ENTRIES);
        if (window.gaPerfEnd) window.gaPerfEnd(perf, { ok: true, bytes: payload.length });
        return true;
    } catch (e) {
        // Quota voll: alte Route-Caches aggressiv aufraeumen und einmal retry.
        try {
            vpPruneObsComboRouteCache(6);
            localStorage.setItem(key, payload);
            vpPruneObsComboRouteCache(VP_OBS_COMBO_MAX_ENTRIES);
            if (window.gaPerfEnd) window.gaPerfEnd(perf, { ok: true, retry: true, bytes: payload.length });
            return true;
        } catch (_) {
            if (window.vpWeatherDebug) {
                window.vpWeatherDebug.lastGlobalErrorAt = Date.now();
                window.vpWeatherDebug.lastGlobalErrorMsg = (e && e.message) ? e.message : 'obs combo cache persist failed';
            }
            if (window.gaPerfEnd) window.gaPerfEnd(perf, { ok: false, bytes: payload.length });
            return false;
        }
    }
}

function vpRememberObstacleData(obsArr, linArr, tileKey = '') {
    const perf = window.gaPerfStart ? window.gaPerfStart('Overpass remember obstacle data', {
        obs: Array.isArray(obsArr) ? obsArr.length : 0,
        lin: Array.isArray(linArr) ? linArr.length : 0,
        tileKey: String(tileKey || '')
    }) : null;
    vpHydrateObsPool();
    const now = Date.now();
    const fallbackTileKey = (typeof tileKey === 'string' && tileKey) ? tileKey : '';
    if (Array.isArray(obsArr)) {
        for (const item of obsArr) {
            const key = vpObsKey(item);
            if (!key) continue;
            const tk = String(item?.tileKey || fallbackTileKey || vpObsTileKey(item?.lat, item?.lon) || '');
            const entry = {
                ts: now,
                type: item.type || 'mast',
                hFt: Number(item.hFt || 0),
                elevFt: Number(item.elevFt || 0),
                lat: Number(item.lat),
                lon: Number(item.lon),
                tileKey: tk
            };
            vpObsPool.obs.set(key, entry);
            vpIndexObsPoolEntry('obs', key, entry);
        }
    }
    if (Array.isArray(linArr)) {
        for (const item of linArr) {
            const key = vpLinKey(item);
            if (!key) continue;
            const tk = String(item?.tileKey || fallbackTileKey || vpObsTileKey(item?.lat, item?.lon) || '');
            const entry = {
                ts: now,
                type: item.type || 'linear',
                name: String(item.name || ''),
                lineKind: String(item.lineKind || ''),
                lat: Number(item.lat),
                lon: Number(item.lon),
                tileKey: tk
            };
            vpObsPool.lin.set(key, entry);
            vpIndexObsPoolEntry('lin', key, entry);
        }
    }
    const trimmedObs = vpTrimTimedMap(vpObsPool.obs, VP_OBS_POOL_MAX_OBS);
    const trimmedLin = vpTrimLinearMapFairByTile(vpObsPool.lin, VP_OBS_POOL_MAX_LIN);
    if (trimmedObs || trimmedLin) vpRebuildObsPoolTileIndex();
    vpPersistObsPoolSoon();
    if (window.gaPerfEnd) window.gaPerfEnd(perf, {
        obsPool: vpObsPool.obs ? vpObsPool.obs.size : 0,
        linPool: vpObsPool.lin ? vpObsPool.lin.size : 0
    });
}

function vpObsTileKey(lat, lon) {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return '';
    const latI = Math.floor((Number(lat) + 90) / VP_OBS_TILE_STEP_LAT);
    const lonI = Math.floor((Number(lon) + 180) / VP_OBS_TILE_STEP_LON);
    return `${latI}|${lonI}`;
}

function vpObsTileBoundsFromKey(key) {
    const parts = String(key || '').split('|');
    if (parts.length < 2) return null;
    const latI = Number(parts[0]);
    const lonI = Number(parts[1]);
    if (!Number.isFinite(latI) || !Number.isFinite(lonI)) return null;
    const south = (latI * VP_OBS_TILE_STEP_LAT) - 90;
    const west = (lonI * VP_OBS_TILE_STEP_LON) - 180;
    return {
        south,
        west,
        north: south + VP_OBS_TILE_STEP_LAT,
        east: west + VP_OBS_TILE_STEP_LON
    };
}

function vpCollectRouteTileKeys(elevData) {
    const set = new Set();
    if (!Array.isArray(elevData)) return set;
    for (const p of elevData) {
        if (!p || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lon))) continue;
        set.add(vpObsTileKey(p.lat, p.lon));
    }
    return set;
}

function vpExpandObsTileKeys(keys, radius = 1) {
    const out = new Set();
    const r = Math.max(0, Math.floor(Number(radius) || 0));
    if (!keys || typeof keys[Symbol.iterator] !== 'function') return out;
    for (const key of keys) {
        const parts = String(key || '').split('|');
        if (parts.length < 2) continue;
        const latI = Number(parts[0]);
        const lonI = Number(parts[1]);
        if (!Number.isFinite(latI) || !Number.isFinite(lonI)) continue;
        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                out.add(`${latI + dy}|${lonI + dx}`);
            }
        }
    }
    return out;
}

function vpHydrateObsTileCoverage() {
    if (vpObsTileCoverageHydrated) return;
    vpObsTileCoverageHydrated = true;
    try {
        const raw = localStorage.getItem(VP_OBS_TILE_COVERAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        const now = Date.now();
        for (const item of parsed) {
            if (!item || typeof item.k !== 'string') continue;
            const ts = Number(item.ts || 0);
            if (!ts) continue;
            if (VP_OBS_TILE_TTL_MS > 0 && (now - ts) > VP_OBS_TILE_TTL_MS) continue;
            vpObsTileCoverage.set(item.k, {
                ts,
                src: String(item.src || 'unknown'),
                usedTs: Number(item.usedTs || 0)
            });
        }
    } catch (_) { }
}

function vpPersistObsTileCoverageSoon() {
    if (vpObsTileCoveragePersistTimer) return;
    vpObsTileCoveragePersistTimer = setTimeout(() => {
        vpObsTileCoveragePersistTimer = null;
        try {
            const now = Date.now();
            const payload = [];
            for (const [k, meta] of vpObsTileCoverage.entries()) {
                const ts = Number((meta && meta.ts) || 0);
                if (!ts) continue;
                if (VP_OBS_TILE_TTL_MS > 0 && (now - ts) > VP_OBS_TILE_TTL_MS) continue;
                payload.push({
                    k,
                    ts,
                    src: String((meta && meta.src) || 'unknown'),
                    usedTs: Number((meta && meta.usedTs) || 0)
                });
            }
            localStorage.setItem(VP_OBS_TILE_COVERAGE_KEY, JSON.stringify(payload));
            if (window.vpNotifyObsTileCoverageChanged) window.vpNotifyObsTileCoverageChanged();
        } catch (_) { }
    }, 400);
}

function vpHydrateObsTileFailed() {
    if (vpObsTileFailedHydrated) return;
    vpObsTileFailedHydrated = true;
    try {
        const raw = localStorage.getItem(VP_OBS_TILE_FAILED_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        for (const item of parsed) {
            if (!item || typeof item.k !== 'string') continue;
            const ts = Number(item.ts || 0);
            if (!ts) continue;
            vpObsTileFailed.set(item.k, {
                ts,
                status: Number(item.status || 0),
                src: String(item.src || ''),
                attempts: Number(item.attempts || 1)
            });
        }
        vpSyncFailedOverpassChunksFromTileStore();
    } catch (_) { }
}

function vpPersistObsTileFailedSoon() {
    if (vpObsTileFailedPersistTimer) return;
    vpObsTileFailedPersistTimer = setTimeout(() => {
        vpObsTileFailedPersistTimer = null;
        try {
            const payload = Array.from(vpObsTileFailed.entries())
                .sort((a, b) => Number((b[1] && b[1].ts) || 0) - Number((a[1] && a[1].ts) || 0))
                .slice(0, VP_OBS_TILE_FAILED_MAX)
                .map(([k, v]) => ({
                    k,
                    ts: Number((v && v.ts) || 0),
                    status: Number((v && v.status) || 0),
                    src: String((v && v.src) || ''),
                    attempts: Number((v && v.attempts) || 1)
                }));
            localStorage.setItem(VP_OBS_TILE_FAILED_KEY, JSON.stringify(payload));
            if (window.vpNotifyObsTileCoverageChanged) window.vpNotifyObsTileCoverageChanged();
        } catch (_) { }
    }, 400);
}

function vpSyncFailedOverpassChunksFromTileStore() {
    const list = Array.from(vpObsTileFailed.keys()).slice(0, 200).map(k => ({ tileKey: k }));
    window.vpFailedOverpassChunks = list;
    if (typeof window.updateOverpassErrorUI === 'function') window.updateOverpassErrorUI();
}

function vpMarkTileFailed(tileKey, status = 0, src = '') {
    vpHydrateObsTileFailed();
    if (typeof tileKey !== 'string' || !tileKey) return;
    const prev = vpObsTileFailed.get(tileKey);
    vpObsTileFailed.set(tileKey, {
        ts: Date.now(),
        status: Number(status || 0),
        src: String(src || (prev && prev.src) || ''),
        attempts: Number((prev && prev.attempts) || 0) + 1
    });
    while (vpObsTileFailed.size > VP_OBS_TILE_FAILED_MAX) {
        let oldestKey = null;
        let oldestTs = Infinity;
        for (const [k, v] of vpObsTileFailed.entries()) {
            const ts = Number((v && v.ts) || 0);
            if (ts < oldestTs) { oldestTs = ts; oldestKey = k; }
        }
        if (!oldestKey) break;
        vpObsTileFailed.delete(oldestKey);
    }
    vpSyncFailedOverpassChunksFromTileStore();
    vpPersistObsTileFailedSoon();
}

function vpClearTileFailed(tileKey) {
    vpHydrateObsTileFailed();
    if (typeof tileKey !== 'string' || !tileKey) return;
    if (vpObsTileFailed.delete(tileKey)) {
        vpSyncFailedOverpassChunksFromTileStore();
        vpPersistObsTileFailedSoon();
    }
}

function vpGetRouteTileCoverageProbe(elevData) {
    vpHydrateObsTileCoverage();
    const keys = vpCollectRouteTileKeys(elevData);
    const now = Date.now();
    const missing = [];
    let touchedUsage = false;
    for (const key of keys) {
        const meta = vpObsTileCoverage.get(key);
        const ts = Number((meta && meta.ts) || 0);
        if (!ts) {
            missing.push(key);
            continue;
        }
        // Legacy/Provisional marker aus altem Route-Cache nicht als "wirklich geladen" behandeln.
        // Dadurch werden diese Tiles automatisch erneut gegen Overpass validiert.
        if (String((meta && meta.src) || '') === 'route-cache') {
            missing.push(key);
            continue;
        }
        if (VP_OBS_TILE_TTL_MS > 0 && (now - ts) > VP_OBS_TILE_TTL_MS) {
            missing.push(key);
            continue;
        }
        if (meta && meta.usedTs !== now) {
            meta.usedTs = now;
            vpObsTileCoverage.set(key, meta);
            touchedUsage = true;
        }
    }
    if (touchedUsage) vpPersistObsTileCoverageSoon();
    if (window.vpWeatherDebug) {
        window.vpWeatherDebug.overpassTileCoverageEntries = vpObsTileCoverage.size;
        window.vpWeatherDebug.overpassTileLastMissingCount = missing.length;
        window.vpWeatherDebug.overpassTileLastMissingSample = missing.slice(0, 10).join(', ');
    }
    return { total: keys.size, missing };
}

function vpMarkRouteTilesCovered(elevData, source = 'unknown') {
    vpHydrateObsTileCoverage();
    const keys = vpCollectRouteTileKeys(elevData);
    vpMarkTileKeysCovered(keys, source);
}

function vpMarkTileKeysCovered(keys, source = 'unknown') {
    vpHydrateObsTileCoverage();
    const now = Date.now();
    const src = String(source || 'unknown');
    if (!keys) return;
    for (const key of keys) {
        if (typeof key !== 'string' || !key) continue;
        const prev = vpObsTileCoverage.get(key);
        vpObsTileCoverage.set(key, {
            ts: now,
            src,
            usedTs: Number((prev && prev.usedTs) || 0)
        });
    }
    if (window.vpWeatherDebug) window.vpWeatherDebug.overpassTileCoverageEntries = vpObsTileCoverage.size;
    vpPersistObsTileCoverageSoon();
}

function vpProjectObsPoolToRoute(elevData) {
    const perf = window.gaPerfStart ? window.gaPerfStart('Overpass project pool to route', {
        routePoints: Array.isArray(elevData) ? elevData.length : 0,
        obsPool: vpObsPool && vpObsPool.obs ? vpObsPool.obs.size : 0,
        linPool: vpObsPool && vpObsPool.lin ? vpObsPool.lin.size : 0
    }) : null;
    vpHydrateObsPool();
    if (!Array.isArray(elevData) || elevData.length < 2) {
        if (window.gaPerfEnd) window.gaPerfEnd(perf, { status: 'no-route' });
        return { obs: [], lin: [] };
    }

    const obsSeed = [];
    const linSeed = [];
    const maxRouteSamples = 900;
    const stride = elevData.length > maxRouteSamples ? Math.ceil(elevData.length / maxRouteSamples) : 1;
    const routeSamples = stride <= 1
        ? elevData
        : elevData.filter((_, idx) => idx % stride === 0 || idx === elevData.length - 1);
    const routeTileKeys = vpCollectRouteTileKeys(elevData);
    const candidateTileKeys = vpExpandObsTileKeys(routeTileKeys, 1);
    const obsCandidates = vpGetObsPoolCandidates('obs', candidateTileKeys);
    const linCandidates = vpGetObsPoolCandidates('lin', candidateTileKeys);
    let obsChecked = 0;
    let obsSkippedTile = 0;
    let obsSkippedBounds = 0;
    let linChecked = 0;
    let linSkippedTile = 0;
    let linSkippedBounds = 0;
    const routeLats = routeSamples.map(p => Number(p && p.lat)).filter(Number.isFinite);
    const routeLons = routeSamples.map(p => Number(p && p.lon)).filter(Number.isFinite);
    const midLat = routeLats.length ? routeLats.reduce((sum, v) => sum + v, 0) / routeLats.length : 51;
    const lonNmFactor = Math.max(8, 60 * Math.cos(midLat * Math.PI / 180));
    const latNmFactor = 60;
    const maxLateralNm = Math.max(VP_PROFILE_WIND_LATERAL_MAX_NM, VP_PROFILE_OBS_LATERAL_MAX_NM, VP_PROFILE_LIN_LATERAL_MAX_NM);
    const latPad = Math.max(0.04, (maxLateralNm + 2) / latNmFactor);
    const lonPad = Math.max(0.04, (maxLateralNm + 2) / lonNmFactor);
    const routeBounds = routeLats.length && routeLons.length ? {
        minLat: Math.min(...routeLats) - latPad,
        maxLat: Math.max(...routeLats) + latPad,
        minLon: Math.min(...routeLons) - lonPad,
        maxLon: Math.max(...routeLons) + lonPad
    } : null;
    const metricRouteSamples = routeSamples
        .filter(p => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)))
        .map(p => ({
            p,
            x: Number(p.lon) * lonNmFactor,
            y: Number(p.lat) * latNmFactor
        }));
    const isInRouteBounds = (lat, lon) => {
        if (!routeBounds) return true;
        return lat >= routeBounds.minLat && lat <= routeBounds.maxLat && lon >= routeBounds.minLon && lon <= routeBounds.maxLon;
    };
    const resolveTileKey = (item) => {
        const lat = Number(item && item.lat);
        const lon = Number(item && item.lon);
        return String(vpObsTileKey(lat, lon) || item?.tileKey || '');
    };
    const nearestOnRoute = (lat, lon) => {
        const x = Number(lon) * lonNmFactor;
        const y = Number(lat) * latNmFactor;
        let best = metricRouteSamples[0];
        let bestD2 = Infinity;
        for (const ep of metricRouteSamples) {
            const dx = x - ep.x;
            const dy = y - ep.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestD2) {
                bestD2 = d2;
                best = ep;
            }
        }
        return { bestPt: (best && best.p) || routeSamples[0] || elevData[0], bestD: Math.sqrt(bestD2) };
    };

    for (const item of obsCandidates) {
        const lat = Number(item && item.lat);
        const lon = Number(item && item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            obsSkippedBounds++;
            continue;
        }
        if (!isInRouteBounds(lat, lon)) {
            obsSkippedBounds++;
            continue;
        }
        const tileKey = resolveTileKey(item);
        if (candidateTileKeys.size && tileKey && !candidateTileKeys.has(tileKey)) {
            obsSkippedTile++;
            continue;
        }
        obsChecked++;
        const { bestPt, bestD } = nearestOnRoute(lat, lon);
        const obsType = String(item?.type || '').toLowerCase();
        const obsLateralMax = (obsType === 'wind') ? VP_PROFILE_WIND_LATERAL_MAX_NM : VP_PROFILE_OBS_LATERAL_MAX_NM;
        if (bestD > obsLateralMax) continue;
        obsSeed.push({
            type: item.type || 'mast',
            hFt: Number(item.hFt || 0),
            distNM: bestPt.distNM,
            lateralNM: Number(bestD || 0),
            elevFt: Number(item.elevFt || 0),
            groundElevFt: Number(bestPt.elevFt || 0),
            lat,
            lon,
            tileKey
        });
    }

    for (const item of linCandidates) {
        const lat = Number(item && item.lat);
        const lon = Number(item && item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            linSkippedBounds++;
            continue;
        }
        if (!isInRouteBounds(lat, lon)) {
            linSkippedBounds++;
            continue;
        }
        const tileKey = resolveTileKey(item);
        if (candidateTileKeys.size && tileKey && !candidateTileKeys.has(tileKey)) {
            linSkippedTile++;
            continue;
        }
        linChecked++;
        const { bestPt, bestD } = nearestOnRoute(lat, lon);
        if (bestD > VP_PROFILE_LIN_LATERAL_MAX_NM) continue;
        const rawKind = String(item.lineKind || '');
        const inferredKind = (String(item.type || '').toLowerCase() === 'highway' && !rawKind)
            ? vpInferRoadKindFromText('', String(item.name || ''), '')
            : rawKind;
        linSeed.push({
            type: item.type || 'linear',
            name: String(item.name || ''),
            lineKind: inferredKind,
            distNM: bestPt.distNM,
            lateralNM: Number(bestD || 0),
            lat,
            lon,
            tileKey
        });
    }

    const compactLinSeed = (() => {
        // Nur fast identische Nachbarn zusammenfassen:
        // gleiche Art, nahezu gleiche Distanz/Lateral und (wenn vorhanden) gleicher Name.
        // Wichtig: Unbenannte Flüsse nicht global "wegfalten".
        const out = [];
        const sorted = linSeed.slice().sort((a, b) => Number(a.distNM || 0) - Number(b.distNM || 0));
        for (const cur of sorted) {
            if (!out.length) { out.push(cur); continue; }
            const prev = out[out.length - 1];
            const sameType = String(prev.type || '') === String(cur.type || '');
            if (!sameType) { out.push(cur); continue; }
            const sameLineKind = String(prev.lineKind || '') === String(cur.lineKind || '');
            if (!sameLineKind) { out.push(cur); continue; }

            const pName = String(prev.name || '').trim().toLowerCase();
            const cName = String(cur.name || '').trim().toLowerCase();
            const bothNamed = !!pName && !!cName;
            const sameName = bothNamed && pName === cName;
            const sameTile = String(prev.tileKey || '') === String(cur.tileKey || '') && !!String(cur.tileKey || '');
            const dDist = Math.abs(Number(prev.distNM || 0) - Number(cur.distNM || 0));
            const dLat = Math.abs(Number(prev.lateralNM || 0) - Number(cur.lateralNM || 0));

            if (bothNamed) {
                if (sameName && dDist <= 0.35) continue;
                out.push(cur);
                continue;
            }

            // Unbenannte Features nur innerhalb desselben Tiles und sehr engem Fenster deduplizieren.
            if (sameTile && dDist <= 0.12 && dLat <= 0.08) continue;
            out.push(cur);
        }
        return out;
    })();

    const out = {
        obs: deduplicateFeatures(obsSeed),
        lin: compactLinSeed
    };
    if (window.gaPerfEnd) window.gaPerfEnd(perf, {
        routeSamples: routeSamples.length,
        stride,
        routeTiles: routeTileKeys.size,
        candidateTiles: candidateTileKeys.size,
        obsCandidates: obsCandidates.length,
        linCandidates: linCandidates.length,
        obsChecked,
        obsSkippedTile,
        obsSkippedBounds,
        linChecked,
        linSkippedTile,
        linSkippedBounds,
        obs: out.obs.length,
        lin: out.lin.length
    });
    return out;
}

function vpEstimateObstacleDisplayStats(obsArr) {
    const src = Array.isArray(obsArr) ? obsArr : [];
    const byType = { wind: 0, mast: 0, power_tower: 0, other: 0 };
    let displayable = 0;
    if (!vpShowObstacles) return { total: src.length, displayable: 0, byType };
    for (const o of src) {
        const t = String(o?.type || '').toLowerCase();
        if (t === 'power_tower' && !vpShowPowerInfra) continue;
        displayable++;
        if (t === 'wind') byType.wind++;
        else if (t === 'mast' || t === 'tower') byType.mast++;
        else if (t === 'power_tower') byType.power_tower++;
        else byType.other++;
    }
    return { total: src.length, displayable, byType };
}

function vpEstimateLinearDisplayStats(linArr, _obsArr) {
    const src = Array.isArray(linArr) ? linArr : [];
    const majorRoadRx = /\b(A|B)\s?\d+\b/i;
    const isMajorRoadFeature = (feat) => {
        if (!feat || feat.type !== 'highway') return false;
        const n = String(feat.name || '').trim();
        if (!n) return false;
        if (majorRoadRx.test(n)) return true;
        const low = n.toLowerCase();
        return low.includes('autobahn') || low.includes('bundesstraße') || low.includes('bundesstrasse');
    };
    const isLinearTypeEnabled = (feat) => {
        if (!feat) return false;
        if (feat.type === 'highway') return !!vpShowRoads;
        if (feat.type === 'river') return !!vpShowRivers;
        if (feat.type === 'powerline') return !!vpShowPowerInfra;
        return false;
    };
    const clusterLinearFeatures = (arr) => {
        const inArr = Array.isArray(arr) ? arr.slice().sort((a, b) => Number(a.distNM || 0) - Number(b.distNM || 0)) : [];
        const out = [];
        let i = 0;
        while (i < inArr.length) {
            const base = inArr[i];
            const type = String(base.type || '');
            const thr = (type === 'river') ? 0.8 : (type === 'highway' ? 0.35 : 0.3);
            let sumDist = Number(base.distNM || 0);
            let sumLat = Number(base.lat || 0);
            let sumLon = Number(base.lon || 0);
            let cnt = 1;
            let bestName = String(base.name || '');
            let j = i + 1;
            while (j < inArr.length) {
                const cur = inArr[j];
                if (String(cur.type || '') !== type) break;
                if (Math.abs(Number(cur.distNM || 0) - Number(inArr[j - 1].distNM || 0)) > thr) break;
                sumDist += Number(cur.distNM || 0);
                sumLat += Number(cur.lat || 0);
                sumLon += Number(cur.lon || 0);
                cnt++;
                if (!bestName && String(cur.name || '').trim()) bestName = String(cur.name || '');
                j++;
            }
            out.push({
                ...base,
                name: bestName || String(base.name || ''),
                distNM: sumDist / cnt,
                lat: sumLat / cnt,
                lon: sumLon / cnt,
                count: cnt
            });
            i = j;
        }
        return out;
    };
    const isRouteCrossingLinear = (feat) => Number(feat?.lateralNM || 999) <= VP_LINEAR_ROUTE_CROSS_NM;

    let filtered = src.filter(isLinearTypeEnabled);
    filtered = filtered.filter((feat) => {
        if (feat.type === 'highway') return isMajorRoadFeature(feat);
        if (feat.type === 'river') {
            const n = String(feat.name || '').toLowerCase();
            if (n.includes('wassertret') || n.includes('kneipp') || n.includes('wasserspiel')) return false;
        }
        return true;
    });
    const clustered = clusterLinearFeatures(filtered);
    const byType = { highway: 0, river: 0, powerline: 0 };
    let displayable = 0;
    for (const feat of clustered) {
        if (!isRouteCrossingLinear(feat)) continue;
        displayable++;
        if (feat.type === 'highway') byType.highway++;
        else if (feat.type === 'river') byType.river++;
        else if (feat.type === 'powerline') byType.powerline++;
    }
    return { total: src.length, filtered: filtered.length, clustered: clustered.length, displayable, byType };
}

function vpEstimateLinearDisplayStatsLight(linArr) {
    const src = Array.isArray(linArr) ? linArr : [];
    const byType = { highway: 0, river: 0, powerline: 0 };
    let displayable = 0;
    const maxScan = Math.min(src.length, 16000);
    const step = src.length > maxScan ? Math.ceil(src.length / maxScan) : 1;
    for (let i = 0; i < src.length; i += step) {
        const feat = src[i];
        if (!feat) continue;
        const type = String(feat.type || '');
        if (type === 'highway') byType.highway++;
        else if (type === 'river') byType.river++;
        else if (type === 'powerline') byType.powerline++;
        if (Number(feat.lateralNM || 999) <= VP_LINEAR_ROUTE_CROSS_NM) displayable++;
    }
    const factor = step > 1 ? step : 1;
    return {
        total: src.length,
        filtered: null,
        clustered: null,
        displayable: Math.round(displayable * factor),
        byType: {
            highway: Math.round(byType.highway * factor),
            river: Math.round(byType.river * factor),
            powerline: Math.round(byType.powerline * factor)
        },
        sampled: step > 1
    };
}

function vpLogRouteFeatureStats(sourceTag, cacheKey, obsArr, linArr) {
    let perf = null;
    try {
        perf = window.gaPerfStart ? window.gaPerfStart('Overpass route stats', {
            sourceTag: String(sourceTag || 'n/a'),
            obs: Array.isArray(obsArr) ? obsArr.length : 0,
            lin: Array.isArray(linArr) ? linArr.length : 0
        }) : null;
        const obsStats = vpEstimateObstacleDisplayStats(obsArr);
        const linTotal = Array.isArray(linArr) ? linArr.length : 0;
        const heavyStats = linTotal > VP_ROUTE_STATS_HEAVY_FEATURE_LIMIT;
        const linStats = heavyStats
            ? vpEstimateLinearDisplayStatsLight(linArr)
            : vpEstimateLinearDisplayStats(linArr, obsArr);
        const tileCounts = new Map();
        const acc = (arr, kind) => {
            if (!Array.isArray(arr)) return;
            const maxScan = heavyStats ? Math.min(arr.length, 12000) : arr.length;
            const step = arr.length > maxScan ? Math.ceil(arr.length / maxScan) : 1;
            for (let i = 0; i < arr.length; i += step) {
                const f = arr[i];
                const tk = String(f?.tileKey || vpObsTileKey(f?.lat, f?.lon) || '?');
                const prev = tileCounts.get(tk) || { obs: 0, lin: 0 };
                if (kind === 'obs') prev.obs += step;
                else prev.lin += step;
                tileCounts.set(tk, prev);
            }
        };
        acc(obsArr, 'obs');
        acc(linArr, 'lin');
        const tileSummary = Array.from(tileCounts.entries())
            .sort((a, b) => ((b[1].obs + b[1].lin) - (a[1].obs + a[1].lin)))
            .slice(0, 12)
            .map(([k, v]) => `${k}:o${v.obs}/l${v.lin}`)
            .join(', ');
        const tileMore = Math.max(0, tileCounts.size - 12);
        const routeTileKeys = Array.from(vpCollectRouteTileKeys(Array.isArray(vpElevationData) ? vpElevationData : []));
        const routeTileSet = new Set(routeTileKeys);
        const featureTileSet = new Set(tileCounts.keys());
        const routeWithFeatures = routeTileKeys.filter(k => featureTileSet.has(k));
        const routeWithoutFeatures = routeTileKeys.filter(k => !featureTileSet.has(k));
        vpHydrateObsTileCoverage();
        const covBySrc = new Map();
        for (const key of routeTileKeys) {
            const meta = vpObsTileCoverage.get(key);
            const src = String((meta && meta.src) || 'none');
            covBySrc.set(src, Number(covBySrc.get(src) || 0) + 1);
        }
        const covSummary = Array.from(covBySrc.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `${k}:${v}`)
            .join(', ');
        const noDataSample = routeWithoutFeatures.slice(0, 8).join(', ');
        const sig = [
            String(sourceTag || ''),
            String(cacheKey || ''),
            String(obsStats.total),
            String(obsStats.displayable),
            String(linStats.total),
            String(linStats.displayable),
            String(linStats.clustered),
            String(obsStats.byType.wind),
            String(obsStats.byType.mast),
            String(obsStats.byType.power_tower),
            String(linStats.byType.highway),
            String(linStats.byType.river),
            String(linStats.byType.powerline),
            String(tileSummary),
            String(tileCounts.size),
            String(routeTileSet.size),
            String(routeWithFeatures.length),
            String(routeWithoutFeatures.length),
            String(covSummary),
            String(noDataSample)
        ].join('|');
        if (window._vpLastRouteFeatureStatsSig === sig) {
            if (window.gaPerfEnd) window.gaPerfEnd(perf, { heavyStats, skipped: 'duplicate' });
            return;
        }
        window._vpLastRouteFeatureStatsSig = sig;
        console.log(
            `[Overpass] Route-Stats (${sourceTag || 'n/a'}${heavyStats ? ':light' : ''}) | core-found obs=${obsStats.total} lin=${linStats.total} ` +
            `| display obs=${obsStats.displayable} (wind ${obsStats.byType.wind}, mast ${obsStats.byType.mast}, pwrTower ${obsStats.byType.power_tower}) ` +
            `lin=${linStats.displayable}/${linStats.clustered} (road ${linStats.byType.highway}, river ${linStats.byType.river}, power ${linStats.byType.powerline}) ` +
            `| tiles core [${tileSummary || '-'}${tileMore > 0 ? `, +${tileMore} more` : ''}] ` +
            `| route-tiles ${routeTileSet.size} (feat ${routeWithFeatures.length}, empty ${routeWithoutFeatures.length}) ` +
            `| coverage [${covSummary || '-'}]` +
            `${noDataSample ? ` | empty-sample [${noDataSample}]` : ''}`
        );
        if (window.gaPerfEnd) window.gaPerfEnd(perf, { heavyStats });
    } catch (err) {
        if (window.gaPerfEnd) {
            window.gaPerfEnd(perf, {
                ok: false,
                message: err && err.message ? String(err.message) : 'route stats failed'
            });
        }
    }
}

function vpExtractOverpassTileFeatures(elements) {
    const obs = [];
    const lin = [];
    if (!Array.isArray(elements)) return { obs, lin };
    for (const e of elements) {
        if (e.type === 'node' && Number.isFinite(e.lat) && Number.isFinite(e.lon)) {
            const isWind = e.tags && e.tags['generator:source'] === 'wind';
            const powerTag = e.tags ? String(e.tags.power || '').toLowerCase() : '';
            const isPowerTower = (powerTag === 'tower' || powerTag === 'pole');
            const hRaw = (e.tags && e.tags.height) ? String(e.tags.height).replace(',', '.') : (isWind ? '120' : (isPowerTower ? '25' : '50'));
            const hMeter = parseFloat(hRaw);
            const minHeightM = isPowerTower ? 18 : 30;
            if (!Number.isFinite(hMeter) || hMeter < minHeightM) continue;
            obs.push({
                type: isWind ? 'wind' : (isPowerTower ? 'power_tower' : 'mast'),
                hFt: Math.round(hMeter * 3.28084),
                elevFt: 0,
                lat: Number(e.lat),
                lon: Number(e.lon)
            });
            continue;
        }
        if (e.type === 'way' && Array.isArray(e.geometry) && e.tags) {
            const powerTag = String(e.tags.power || '').toLowerCase();
            const isPowerLine = (powerTag === 'line' || powerTag === 'minor_line' || powerTag === 'cable');
            const featType = e.tags.highway ? 'highway' : (e.tags.waterway ? 'river' : (isPowerLine ? 'powerline' : ''));
            if (!featType) continue;
            const refTxt = String(e.tags.ref || '');
            const name = String(e.tags.name || e.tags.ref || e.tags.operator || '');
            const roadKind = featType === 'highway'
                ? vpInferRoadKindFromText(refTxt, name, String(e.tags.highway || ''))
                : '';
            if (!name && featType === 'highway') continue;
            const geom = e.geometry;
            const step = Math.max(1, Math.floor(geom.length / 12));
            for (let i = 0; i < geom.length; i += step) {
                const g = geom[i];
                if (!g || !Number.isFinite(g.lat) || !Number.isFinite(g.lon)) continue;
                lin.push({
                    type: featType,
                    name,
                    lineKind: isPowerLine ? powerTag : roadKind,
                    lat: Number(g.lat),
                    lon: Number(g.lon)
                });
            }
        }
    }
    return { obs, lin };
}

function vpParseHostedObstaclePayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    if (Array.isArray(payload.elements)) return vpExtractOverpassTileFeatures(payload.elements);
    const coreObj = (payload.core && typeof payload.core === 'object') ? payload.core : null;
    const obsIn = Array.isArray(payload.obs)
        ? payload.obs
        : (Array.isArray(coreObj && coreObj.obs)
            ? coreObj.obs
            : (Array.isArray(payload.features && payload.features.obs) ? payload.features.obs : []));
    const linIn = Array.isArray(payload.lin)
        ? payload.lin
        : (Array.isArray(coreObj && coreObj.lin)
            ? coreObj.lin
            : (Array.isArray(payload.features && payload.features.lin) ? payload.features.lin : []));
    const obs = [];
    const lin = [];
    for (const e of obsIn) {
        const lat = Number(e && e.lat);
        const lon = Number(e && e.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const hFt = Math.max(0, Math.round(Number(e.hFt || 0)));
        obs.push({
            type: String(e.type || 'mast'),
            hFt,
            elevFt: Math.max(0, Math.round(Number(e.elevFt || 0))),
            lat,
            lon
        });
    }
    for (const e of linIn) {
        const lat = Number(e && e.lat);
        const lon = Number(e && e.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        lin.push({
            type: String(e.type || 'linear'),
            name: String(e.name || ''),
            lineKind: String(e.lineKind || e.power || e.powerTag || ''),
            lat,
            lon
        });
    }
    return { obs, lin };
}

function vpGetHostedMissRemainingMs(tileKey, now = Date.now()) {
    const entry = vpObsHostedMissCache.get(tileKey);
    if (!entry) return 0;
    return Math.max(0, Number(entry.until || 0) - now);
}

function vpMarkHostedMiss(tileKey, status = 0, ttlMs = VP_OBS_HOSTED_MISS_TTL_MS) {
    if (!tileKey) return;
    const jitter = Math.floor(Math.random() * 2000);
    vpObsHostedMissCache.set(tileKey, {
        status: Number(status || 0),
        until: Date.now() + Math.max(60 * 1000, ttlMs) + jitter
    });
}

function vpClearHostedMiss(tileKey) {
    if (!tileKey) return;
    vpObsHostedMissCache.delete(tileKey);
}

async function vpFetchHostedObstacleTile(tileKey, signal) {
    if (!VP_OBS_HOSTED_ENABLED) return { ok: false, status: 0, src: '', hostedSkipped: true };
    if (vpGetHostedMissRemainingMs(tileKey) > 0) return { ok: false, status: 0, src: 'hosted-miss-cache', hostedSkipped: true };
    const b = vpObsTileBoundsFromKey(tileKey);
    if (!b) return { ok: false, status: 0, src: '' };
    const [latI, lonI] = String(tileKey).split('|').map(Number);
    const dbg = window.vpWeatherDebug;
    const endpoints = VP_OBS_HOSTED_ENDPOINTS.slice();
    const timeoutMs = VP_OBS_HOSTED_TIMEOUT_MS;

    for (const endpoint of endpoints) {
        if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
        let ctrl = null;
        let timer = null;
        let onAbort = null;
        try {
            const isLocalStaticEndpoint = endpoint.includes('./obstacles/core-tiles/') || endpoint.includes('./obstacles/tiles/');
            ctrl = new AbortController();
            if (signal) {
                onAbort = () => ctrl.abort();
                if (signal.aborted) ctrl.abort();
                else signal.addEventListener('abort', onAbort, { once: true });
            }
            timer = setTimeout(() => ctrl.abort(), timeoutMs);
            let url = '';
            if (endpoint.includes('{latI}') || endpoint.includes('{lonI}')) {
                url = endpoint
                    .replaceAll('{latI}', encodeURIComponent(String(latI)))
                    .replaceAll('{lonI}', encodeURIComponent(String(lonI)));
            } else {
                const u = new URL(endpoint);
                u.searchParams.set('layer', 'core');
                u.searchParams.set('tile', tileKey);
                u.searchParams.set('lat_i', String(latI));
                u.searchParams.set('lon_i', String(lonI));
                u.searchParams.set('south', b.south.toFixed(5));
                u.searchParams.set('west', b.west.toFixed(5));
                u.searchParams.set('north', b.north.toFixed(5));
                u.searchParams.set('east', b.east.toFixed(5));
                u.searchParams.set('v', '3');
                url = u.toString();
            }
            if (dbg) dbg.hostedTileRequests = Number(dbg.hostedTileRequests || 0) + 1;
            const res = await fetch(url, { signal: ctrl.signal });
            if (res.status === 404 || res.status === 204) {
                if (dbg) dbg.hostedTileMisses = Number(dbg.hostedTileMisses || 0) + 1;
                if (isLocalStaticEndpoint) continue;
                vpMarkHostedMiss(tileKey, res.status);
                return { ok: false, status: res.status, src: endpoint, hostedMiss: true };
            }
            if (!res.ok) {
                if (res.status === 400 || res.status === 403) vpMarkHostedMiss(tileKey, res.status, 5 * 60 * 1000);
                if (dbg) dbg.hostedTileErrors = Number(dbg.hostedTileErrors || 0) + 1;
                continue;
            }
            let payload;
            if (url.endsWith('.gz')) {
                const ds = new DecompressionStream('gzip');
                payload = await new Response(res.body.pipeThrough(ds)).json();
            } else {
                payload = await res.json();
            }
            const sourceKind = String((payload && payload.sourceKind) || '').toLowerCase();
            const features = vpParseHostedObstaclePayload(payload);
            if (!features) {
                if (dbg) dbg.hostedTileErrors = Number(dbg.hostedTileErrors || 0) + 1;
                continue;
            }
            const obsCount = Array.isArray(features.obs) ? features.obs.length : 0;
            const linCount = Array.isArray(features.lin) ? features.lin.length : 0;
            // Lokale Split-Tiles koennen vereinzelt als leere Platzhalter vorliegen.
            // Diese nicht als "ok" akzeptieren, damit Worker/Overpass nachgeladen wird.
            if (isLocalStaticEndpoint && (obsCount + linCount) === 0) {
                if (dbg) dbg.hostedTileMisses = Number(dbg.hostedTileMisses || 0) + 1;
                continue;
            }
            vpClearHostedMiss(tileKey);
            if (dbg) {
                dbg.hostedTileHits = Number(dbg.hostedTileHits || 0) + 1;
                if (sourceKind === 'legacy') dbg.hostedTileLegacyHits = Number(dbg.hostedTileLegacyHits || 0) + 1;
                else dbg.hostedTileCoreHits = Number(dbg.hostedTileCoreHits || 0) + 1;
            }
            let src = endpoint;
            try {
                const host = new URL(endpoint).host;
                src = `${host}:hosted${sourceKind === 'legacy' ? ':legacy' : ':split'}`;
            } catch (_) {}
            return { ok: true, features, src, hosted: true };
        } catch (e) {
            if (e && e.name === 'AbortError') {
                if (signal && signal.aborted) throw e;
            }
            if (dbg) dbg.hostedTileErrors = Number(dbg.hostedTileErrors || 0) + 1;
        } finally {
            if (timer) clearTimeout(timer);
            if (signal && onAbort) signal.removeEventListener('abort', onAbort);
        }
    }
    return { ok: false, status: 0, src: '', hostedMiss: false };
}

async function vpFetchObstacleTile(tileKey, signal, tileIndex = 0, options = {}) {
    const preferOverpass = !!(options && options.preferOverpass);
    if (!preferOverpass) {
        const hosted = await vpFetchHostedObstacleTile(tileKey, signal);
        if (hosted && hosted.ok) return hosted;
    }
    return await vpFetchOverpassTile(tileKey, signal, tileIndex);
}

async function vpFetchHostedTilesParallel(tileKeys, signal, options = {}) {
    const keys = Array.from(new Set((Array.isArray(tileKeys) ? tileKeys : []).filter(Boolean)));
    if (!keys.length) return new Map();
    const concurrency = Math.max(1, Math.min(12, Number((options && options.concurrency) || VP_OBS_HOSTED_PARALLELISM)));
    const results = new Map();
    let cursor = 0;

    const worker = async () => {
        while (cursor < keys.length) {
            if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
            const idx = cursor++;
            const tileKey = keys[idx];
            if (!tileKey) continue;
            if (window.vpSetObsTileLoading) window.vpSetObsTileLoading(tileKey, true);
            if (window.vpSetObsTileDeferred) window.vpSetObsTileDeferred(tileKey, false);
            try {
                const res = await vpFetchHostedObstacleTile(tileKey, signal);
                results.set(tileKey, res || { ok: false, status: 0, src: '' });
            } catch (e) {
                if (e && e.name === 'AbortError') throw e;
                results.set(tileKey, { ok: false, status: 0, src: '' });
            } finally {
                if (window.vpSetObsTileLoading) window.vpSetObsTileLoading(tileKey, false);
            }
        }
    };

    const workers = [];
    const workerCount = Math.min(concurrency, keys.length);
    for (let i = 0; i < workerCount; i++) workers.push(worker());
    await Promise.all(workers);
    return results;
}

async function vpFetchOverpassTile(tileKey, signal, tileIndex = 0) {
    const b = vpObsTileBoundsFromKey(tileKey);
    if (!b) return { ok: false, cooldown: false };
    if (window.vpSetObsTileDeferred) window.vpSetObsTileDeferred(tileKey, false);
    if (window.vpSetObsTileLoading) window.vpSetObsTileLoading(tileKey, true);
    const bbox = `${b.south.toFixed(4)},${b.west.toFixed(4)},${b.north.toFixed(4)},${b.east.toFixed(4)}`;
    const query = `[out:json][timeout:45][bbox:${bbox}];(node["generator:source"="wind"];node["man_made"~"mast|tower"]["height"];node["power"~"tower|pole"];way["highway"~"motorway|motorway_link|trunk|trunk_link|primary|primary_link"];way["waterway"~"river|canal"];way["power"~"line|minor_line|cable"];);out geom qt;`;

    let retries = 1;
    let attempt = 0;
    try {
        while (retries > 0) {
            if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
            window.vpServerOffset = (window.vpServerOffset || 0) + 1;
            const serverUrl = VP_OVERPASS_SERVERS[(tileIndex + attempt + window.vpServerOffset) % VP_OVERPASS_SERVERS.length];
            attempt++;
            try {
                const res = await fetch(serverUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `data=${encodeURIComponent(query)}`,
                    signal
                });
                if (res.status === 429) {
                    if (window.vpWeatherDebug) window.vpWeatherDebug.overpass429Count += 1;
                    const retryAfter = Number(res.headers.get('retry-after') || 0);
                    const cooldownMs = vpApplyOverpassBackoff(429, retryAfter);
                    console.warn(`[Overpass] Tile ${tileKey}: 429. Cooldown ${(cooldownMs / 60000).toFixed(1)} min.`);
                    return { ok: false, cooldown: true, status: 429, src: serverUrl };
                }
                if (res.status === 504) {
                    if (window.vpWeatherDebug) window.vpWeatherDebug.overpass504Count += 1;
                    console.warn(`[Overpass] Tile ${tileKey}: 504 (tile-lokales Backoff).`);
                    return { ok: false, cooldown: false, status: 504, src: serverUrl, tileBackoff: true };
                }
                if (!res.ok) {
                    retries--;
                    await new Promise(r => setTimeout(r, 1500));
                    continue;
                }
                const json = await res.json();
                if (!json || !Array.isArray(json.elements)) {
                    console.warn(`[Overpass] Tile ${tileKey}: Antwort unvollständig (kein elements[]).`);
                    return { ok: false, cooldown: false, status: 520, src: serverUrl };
                }
                const features = vpExtractOverpassTileFeatures(json && json.elements);
                let src = serverUrl;
                try { src = new URL(serverUrl).host; } catch (_) {}
                return { ok: true, features, src };
            } catch (e) {
                if (e && e.name === 'AbortError') throw e;
                retries--;
                if (retries > 0) await new Promise(r => setTimeout(r, 1200));
            }
        }
        return { ok: false, cooldown: false, status: 0, src: '' };
    } finally {
        if (window.vpSetObsTileLoading) window.vpSetObsTileLoading(tileKey, false);
    }
}

async function fetchProfileObstacles(elevData, signal, routeCacheKey = '', forceNetwork = false) {
    if (!elevData || elevData.length < 2) return null;

    if (!forceNetwork && vpIsOverpassCoolingDown()) {
        const remainingMs = vpGetOverpassCooldownRemainingMs();
        const remainingMin = Math.max(1, Math.ceil(remainingMs / 60000));
        if (window.vpWeatherDebug) window.vpWeatherDebug.overpassCooldownSkips += 1;
        console.warn(`[Overpass] Cooldown aktiv (${remainingMin} min). Nutze Cache/Bestand, kein Netz-Request.`);
        const seededCd = vpProjectObsPoolToRoute(elevData);
        return { obs: seededCd.obs || [], lin: seededCd.lin || [], source: 'cooldown-cache', loadedTileKeys: [], failedTileKeys: [] };
    }
    if (window.vpWeatherDebug) window.vpWeatherDebug.overpassRequests += 1;

    const probe = vpGetRouteTileCoverageProbe(elevData);
    const allKeys = Array.from(vpCollectRouteTileKeys(elevData));
    const toLoadAll = forceNetwork ? allKeys : probe.missing.slice();
    const nowTs = Date.now();
    const readyKeys = toLoadAll.filter(k => forceNetwork || !vpIsTileBackoffActive(k, nowTs));
    const blockedKeys = toLoadAll.filter(k => !readyKeys.includes(k));
    const maxPerPass = forceNetwork ? VP_OBS_TILE_MAX_PER_PASS_FORCE : VP_OBS_TILE_MAX_PER_PASS;
    let toLoad = [];
    let deferredTileKeys = [];
    let interDelayMs = VP_OBS_TILE_INTER_REQUEST_MS;
    const nextTileRetryMs = vpMinTileBackoffRemainingMs(blockedKeys, nowTs);
    const usedServers = new Set();
    const loadedTileKeys = [];
    const failedTileKeys = [];
    let hostedLoadedCount = 0;
    let hostedAttemptCount = 0;
    let latestSeededProjection = null;
    let obsPoolProjectionDirty = true;

    // Phase 1: Hosted-Tiles parallel laden (schnell), Overpass erst danach.
    let overpassCandidates = readyKeys.slice();
    if (readyKeys.length > 0) {
        const hostedBatchSize = Math.min(VP_OBS_HOSTED_MAX_PER_PASS, readyKeys.length);
        const hostedKeys = readyKeys.slice(0, hostedBatchSize);
        hostedAttemptCount = hostedKeys.length;
        if (hostedKeys.length > 0) {
            const hostedResMap = await vpFetchHostedTilesParallel(hostedKeys, signal, { concurrency: VP_OBS_HOSTED_PARALLELISM });
            const hostedMissKeys = [];
            const hostedObsBatch = [];
            const hostedLinBatch = [];
            for (const key of hostedKeys) {
                const res = hostedResMap.get(key);
                if (res && res.ok) {
                    vpClearTileFailed(key);
                    vpClearTileBackoff(key);
                    if (res.src) usedServers.add(res.src);
                    if (res.features) {
                        (res.features.obs || []).forEach(item => hostedObsBatch.push({ ...item, tileKey: String(item && item.tileKey || key) }));
                        (res.features.lin || []).forEach(item => hostedLinBatch.push({ ...item, tileKey: String(item && item.tileKey || key) }));
                    }
                    vpMarkTileKeysCovered([key], res.src || 'hosted');
                    loadedTileKeys.push(key);
                    hostedLoadedCount++;
                } else {
                    hostedMissKeys.push(key);
                }
            }
            if (hostedObsBatch.length || hostedLinBatch.length) {
                vpRememberObstacleData(hostedObsBatch, hostedLinBatch);
                obsPoolProjectionDirty = true;
            }
            const hostedKeySet = new Set(hostedKeys);
            overpassCandidates = hostedMissKeys.concat(readyKeys.filter(k => !hostedKeySet.has(k)));
            if (hostedLoadedCount > 0) {
                const seededHosted = vpProjectObsPoolToRoute(elevData);
                latestSeededProjection = seededHosted;
                obsPoolProjectionDirty = false;
                requestAnimationFrame(() => {
                    if (signal && signal.aborted) return;
                    vpObstacles = seededHosted.obs || [];
                    vpLinearFeatures = seededHosted.lin || [];
                    window.vpBgNeedsUpdate = true;
                    if (typeof window.vpScheduleProfileRender === 'function') window.vpScheduleProfileRender('overpass-hosted-seed', 80);
                    else if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
                });
            }
        }
    }

    toLoad = overpassCandidates.slice(0, Math.max(1, maxPerPass));
    deferredTileKeys = overpassCandidates.slice(toLoad.length).concat(blockedKeys);
    interDelayMs = overpassCandidates.length > maxPerPass ? VP_OBS_TILE_INTER_REQUEST_LONG_MS : VP_OBS_TILE_INTER_REQUEST_MS;

    if (window.vpWeatherDebug) {
        window.vpWeatherDebug.overpassLastDeferredCount = deferredTileKeys.length;
        if (deferredTileKeys.length > 0) {
            window.vpWeatherDebug.overpassDeferredRuns = Number(window.vpWeatherDebug.overpassDeferredRuns || 0) + 1;
            window.vpWeatherDebug.overpassDeferredTilesTotal = Number(window.vpWeatherDebug.overpassDeferredTilesTotal || 0) + deferredTileKeys.length;
        }
    }
    if (window.vpSetObsTileDeferred) {
        window.vpSetObsTileDeferred('__RESET__', false);
        if (deferredTileKeys.length > 0) window.vpSetObsTileDeferred(deferredTileKeys, true);
    }
    if (!toLoad.length) {
        const seeded = (!obsPoolProjectionDirty && latestSeededProjection)
            ? latestSeededProjection
            : vpProjectObsPoolToRoute(elevData);
        const sourceLabelNoOp = usedServers.size > 0 ? Array.from(usedServers).join(',') : 'tile-cache';
        return {
            obs: seeded.obs || [],
            lin: seeded.lin || [],
            source: sourceLabelNoOp,
            loadedTileKeys,
            failedTileKeys: [],
            deferredTileKeys: deferredTileKeys || [],
            nextTileRetryMs
        };
    }

    console.log(`[Overpass] Tile-Modus: hosted ${hostedLoadedCount}/${hostedAttemptCount} ok, overpass ${toLoad.length}/${overpassCandidates.length} jetzt laden, ${deferredTileKeys.length} defer${routeCacheKey ? ` [${routeCacheKey.slice(0, 24)}]` : ''}.`);

    for (let i = 0; i < toLoad.length; i++) {
        if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
        if (!forceNetwork && vpIsOverpassCoolingDown()) {
            const remainSec = Math.ceil(vpGetOverpassCooldownRemainingMs() / 1000);
            console.warn(`[Overpass] Tile-Queue pausiert (Cooldown ${remainSec}s).`);
            failedTileKeys.push(...toLoad.slice(i));
            break;
        }

        const tileKey = toLoad[i];
        const res = await vpFetchObstacleTile(tileKey, signal, i, { preferOverpass: !!forceNetwork });
        if (!res || !res.ok) {
            vpMarkTileFailed(tileKey, Number((res && res.status) || 0), String((res && res.src) || ''));
            if (res && res.tileBackoff) {
                const waitMs = vpMarkTileBackoff(tileKey);
                console.warn(`[Overpass] Tile ${tileKey} pausiert für ${(waitMs / 1000).toFixed(0)}s.`);
            }
            if (window.vpSetObsTileDeferred) window.vpSetObsTileDeferred(tileKey, false);
            failedTileKeys.push(tileKey);
            if (res && res.cooldown) {
                failedTileKeys.push(...toLoad.slice(i + 1));
                for (let j = i + 1; j < toLoad.length; j++) vpMarkTileFailed(toLoad[j], Number((res && res.status) || 0), String((res && res.src) || ''));
                break;
            }
            continue;
        }

        vpClearTileFailed(tileKey);
        vpClearTileBackoff(tileKey);
        if (window.vpSetObsTileDeferred) window.vpSetObsTileDeferred(tileKey, false);
        if (res.src) usedServers.add(res.src);
        if (res.features) {
            vpRememberObstacleData(res.features.obs || [], res.features.lin || [], tileKey);
            obsPoolProjectionDirty = true;
        }
        vpMarkTileKeysCovered([tileKey], res.src || 'overpass');
        loadedTileKeys.push(tileKey);
        vpMarkOverpassSuccess();

        if (i < toLoad.length - 1) {
            const seededLive = vpProjectObsPoolToRoute(elevData);
            latestSeededProjection = seededLive;
            obsPoolProjectionDirty = false;
            requestAnimationFrame(() => {
                if (signal && signal.aborted) return;
                vpObstacles = seededLive.obs || [];
                vpLinearFeatures = seededLive.lin || [];
                window.vpBgNeedsUpdate = true;
                if (typeof window.vpScheduleProfileRender === 'function') window.vpScheduleProfileRender('overpass-live-seed', 80);
                else if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
            });
        }

        if (i < toLoad.length - 1) await new Promise(r => setTimeout(r, interDelayMs));
    }

    if (failedTileKeys.length > 0) {
        window.vpFailedOverpassChunks = failedTileKeys.map(k => ({ tileKey: k }));
    } else {
        window.vpFailedOverpassChunks = [];
    }
    if (typeof window.updateOverpassErrorUI === 'function') window.updateOverpassErrorUI();

    const seededFinal = (!obsPoolProjectionDirty && latestSeededProjection)
        ? latestSeededProjection
        : vpProjectObsPoolToRoute(elevData);
    vpObstacles = seededFinal.obs || [];
    vpLinearFeatures = seededFinal.lin || [];
    const sourceLabel = usedServers.size > 0 ? Array.from(usedServers).join(',') : 'tile-cache';
    window.vpLastObsTileSource = sourceLabel;
    console.log(`[Overpass] Tile-Queue fertig. geladen=${loadedTileKeys.length}, failed=${failedTileKeys.length}, deferred=${deferredTileKeys.length}`);
    return {
        obs: vpObstacles,
        lin: vpLinearFeatures,
        source: sourceLabel,
        loadedTileKeys,
        failedTileKeys,
        deferredTileKeys,
        nextTileRetryMs
    };
}

// GPS-zentrierte Hindernisse laden (ohne Flugplan, Tile-Modus: Center + 8 Nachbartiles)
async function fetchGpsObstacles(lat, lon) {
    const centerKey = vpObsTileKey(lat, lon);
    const [latI, lonI] = centerKey.split('|').map(Number);
    const tileKeys = [];
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            tileKeys.push(`${latI + dy}|${lonI + dx}`);
        }
    }
    const probe = vpGetRouteTileCoverageProbe(tileKeys.map(k => {
        const b = vpObsTileBoundsFromKey(k);
        return b ? { lat: (b.south + b.north) / 2, lon: (b.west + b.east) / 2 } : null;
    }).filter(Boolean));
    const missing = probe.missing || [];

    if (!vpIsOverpassCoolingDown() && missing.length > 0) {
        const hostedBatchSize = Math.min(VP_OBS_HOSTED_MAX_PER_PASS, missing.length);
        const hostedKeys = missing.slice(0, hostedBatchSize);
        const hostedResults = await vpFetchHostedTilesParallel(hostedKeys, null, { concurrency: VP_OBS_HOSTED_PARALLELISM });
        const hostedOk = new Set();
        for (const key of hostedKeys) {
            const res = hostedResults.get(key);
            if (res && res.ok) {
                hostedOk.add(key);
                vpClearTileFailed(key);
                vpClearTileBackoff(key);
                vpRememberObstacleData(res.features?.obs || [], res.features?.lin || [], key);
                vpMarkTileKeysCovered([key], res.src || 'gps-hosted');
            }
        }

        const restHosted = missing.filter(k => !hostedOk.has(k));
        const overpassKeys = restHosted.slice(0, Math.max(1, VP_OBS_TILE_MAX_PER_PASS));
        for (let i = 0; i < overpassKeys.length; i++) {
            const tileKey = overpassKeys[i];
            try {
                const res = await vpFetchOverpassTile(tileKey, null, i);
                if (res && res.ok) {
                    vpClearTileFailed(tileKey);
                    vpClearTileBackoff(tileKey);
                    vpRememberObstacleData(res.features?.obs || [], res.features?.lin || [], tileKey);
                    vpMarkTileKeysCovered([tileKey], res.src || 'gps-overpass');
                    vpMarkOverpassSuccess();
                } else if (res && res.cooldown) {
                    vpMarkTileFailed(tileKey, Number(res.status || 0), String(res.src || ''));
                    break;
                } else {
                    vpMarkTileFailed(tileKey, Number((res && res.status) || 0), String((res && res.src) || ''));
                    if (res && res.tileBackoff) vpMarkTileBackoff(tileKey);
                }
            } catch (e) {
                vpMarkTileFailed(tileKey, 0, '');
                console.warn('[GPS-Obs] Tile-Fehler:', e);
            }
            if (i < overpassKeys.length - 1) await new Promise(r => setTimeout(r, VP_OBS_TILE_INTER_REQUEST_MS));
        }
    }

    vpHydrateObsPool();
    const rawObs = [];
    for (const item of vpObsPool.obs.values()) {
        if (!item || !Number.isFinite(item.lat) || !Number.isFinite(item.lon)) continue;
        const nav = calcNav(lat, lon, item.lat, item.lon);
        if (!Number.isFinite(nav.dist) || nav.dist > 22) continue;
        rawObs.push({
            type: item.type || 'mast',
            hFt: Number(item.hFt || 0),
            distNM: nav.dist,
            elevFt: Number(item.elevFt || 0),
            groundElevFt: 0,
            lat: Number(item.lat),
            lon: Number(item.lon)
        });
    }

    const buckets = {};
    rawObs.forEach(obs => {
        const bIdx = Math.floor(obs.distNM / 0.5);
        if (!buckets[bIdx]) buckets[bIdx] = [];
        buckets[bIdx].push(obs);
    });
    const finalObs = [];
    for (const k of Object.keys(buckets)) {
        const group = buckets[k].sort((a, b) => b.hFt - a.hFt);
        const rep = group[0];
        rep.count = group.length;
        finalObs.push(rep);
    }

    vpObstacles = finalObs;
    window.vpBgNeedsUpdate = true;
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
    console.log(`[GPS-Obs] ${finalObs.length} Hindernisse aus Tile-Cache/Netz (${missing.length} fehlende Tiles geprüft).`);
}
window.fetchGpsObstacles = fetchGpsObstacles;

function vpIsSarHeliProfileMission() {
    try {
        return !!(
            typeof currentMissionData !== 'undefined'
            && currentMissionData
            && typeof window.missionIsSarHeliMission === 'function'
            && window.missionIsSarHeliMission(currentMissionData)
        );
    } catch (_) {
        return false;
    }
}

function vpRouteWaypointDistances(points = routeWaypoints) {
    if (!Array.isArray(points) || points.length < 1 || typeof calcNav !== 'function') return [];
    const out = [0];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1] || {};
        const curr = points[i] || {};
        const pLat = Number(prev.lat);
        const pLon = Number(prev.lng ?? prev.lon);
        const cLat = Number(curr.lat);
        const cLon = Number(curr.lng ?? curr.lon);
        if (![pLat, pLon, cLat, cLon].every(Number.isFinite)) {
            out.push(total);
            continue;
        }
        const nav = calcNav(pLat, pLon, cLat, cLon);
        total += Number.isFinite(Number(nav?.dist)) ? Math.max(0, Number(nav.dist)) : 0;
        out.push(total);
    }
    return out;
}

function vpSampleElevationFtAtDist(elevationData = [], distNm = 0, fallbackFt = 0) {
    if (!Array.isArray(elevationData) || elevationData.length < 1) return Math.round(Number(fallbackFt) || 0);
    const dist = Number(distNm);
    if (!Number.isFinite(dist)) return Math.round(Number(fallbackFt) || 0);
    const first = elevationData[0];
    const last = elevationData[elevationData.length - 1];
    if (dist <= Number(first?.distNM || 0)) return Math.round(Number(first?.elevFt ?? fallbackFt) || 0);
    if (dist >= Number(last?.distNM || 0)) return Math.round(Number(last?.elevFt ?? fallbackFt) || 0);
    for (let i = 0; i < elevationData.length - 1; i++) {
        const a = elevationData[i] || {};
        const b = elevationData[i + 1] || {};
        const ad = Number(a.distNM);
        const bd = Number(b.distNM);
        if (!Number.isFinite(ad) || !Number.isFinite(bd) || dist < ad || dist > bd) continue;
        const f = (dist - ad) / Math.max(0.001, bd - ad);
        const ae = Number(a.elevFt ?? fallbackFt) || 0;
        const be = Number(b.elevFt ?? ae) || ae;
        return Math.round(ae + f * (be - ae));
    }
    return Math.round(Number(fallbackFt) || 0);
}

function vpWaypointAltitudeFt(point = null, distNm = 0, elevationData = []) {
    const explicit = Number(point?.altFt ?? point?.elevationFt ?? point?.elevation);
    if (Number.isFinite(explicit)) return Math.max(0, Math.round(explicit));
    return Math.max(0, vpSampleElevationFtAtDist(elevationData, distNm, 0));
}

function vpApplySarHeliAltitudeConstraints(cacheKey = '') {
    if (!vpIsSarHeliProfileMission()) return false;
    if (!Array.isArray(routeWaypoints) || routeWaypoints.length < 3 || !Array.isArray(vpElevationData) || vpElevationData.length < 2) return false;
    if (Array.isArray(vpAltWaypoints) && vpAltWaypoints.length > 0 && window._vpAutoSarHeliAltRouteKey !== cacheKey) return false;
    if (window._vpAutoSarHeliAltRouteKey === cacheKey && Array.isArray(vpAltWaypoints) && vpAltWaypoints.length >= 3) return true;

    const distances = vpRouteWaypointDistances(routeWaypoints);
    const totalDist = Number(vpElevationData[vpElevationData.length - 1]?.distNM || distances[distances.length - 1] || 0);
    const incidentIdx = routeWaypoints.findIndex(wp => wp?.isSarHeliIncident || wp?.simHoldAction === 'sar_heli_recovery');
    const targetIdx = incidentIdx >= 0 ? incidentIdx : 1;
    const hospitalIdxRaw = routeWaypoints.findIndex(wp => wp?.isSarHeliHospital);
    const hospitalIdx = hospitalIdxRaw >= 0 ? hospitalIdxRaw : (routeWaypoints.length - 1);
    const targetDist = Number(distances[targetIdx]);
    const hospitalDist = Number(distances[hospitalIdx]);
    if (!Number.isFinite(targetDist) || targetDist <= 0.05 || !Number.isFinite(hospitalDist) || hospitalDist <= targetDist) return false;

    const startAlt = vpWaypointAltitudeFt(routeWaypoints[0], 0, vpElevationData);
    const targetAlt = vpWaypointAltitudeFt(routeWaypoints[targetIdx], targetDist, vpElevationData);
    const hospitalAlt = vpWaypointAltitudeFt(routeWaypoints[hospitalIdx], Math.min(totalDist, hospitalDist), vpElevationData);
    const constraints = [
        { distNM: 0, altFt: startAlt },
        { distNM: Math.max(0, Math.min(totalDist, targetDist)), altFt: targetAlt },
        { distNM: Math.max(0, totalDist), altFt: hospitalAlt }
    ].filter((wp, idx, arr) => idx === 0 || Math.abs(wp.distNM - arr[idx - 1].distNM) > 0.05);
    if (constraints.length < 3) return false;

    const cruiseAlt = parseInt(document.getElementById('altMapInput')?.textContent || document.getElementById('altSlider')?.value || 4500);
    const medLegNm = Math.max(0, hospitalDist - targetDist);
    const lowMedicalCruise = Math.ceil((Math.max(targetAlt, hospitalAlt) + 1200) / 100) * 100;
    const hospitalLegAlt = medLegNm > 0 && medLegNm <= 18
        ? Math.min(cruiseAlt, Math.max(lowMedicalCruise, Math.max(targetAlt, hospitalAlt) + 500))
        : cruiseAlt;
    vpAltWaypoints = constraints.map(wp => ({ distNM: Math.round(wp.distNM * 100) / 100, altFt: Math.round(wp.altFt) }));
    vpSegmentAlts = [];
    for (let i = 0; i < vpAltWaypoints.length - 1; i++) {
        vpSegmentAlts.push(i === 1 ? hospitalLegAlt : cruiseAlt);
    }
    window._vpAutoSarHeliAltRouteKey = cacheKey;
    return true;
}

function vpRouteWaypointLabel(index, point = null) {
    const wp = point || (Array.isArray(routeWaypoints) ? routeWaypoints[index] : null) || {};
    const isLast = Array.isArray(routeWaypoints) && index === routeWaypoints.length - 1;
    const missionLikePoi = !!(
        typeof currentMissionData !== 'undefined'
        && currentMissionData
        && (
            currentMissionData.poiName
            || currentMissionData.poiPresentation
            || (typeof missionUsesPoiTaskRecipe === 'function' && missionUsesPoiTaskRecipe(currentMissionData))
        )
    );
    const isSarHeliFinal = !!(isLast && (wp.isSarHeliHospital || vpIsSarHeliProfileMission()));
    if (index === 0) return currentStartICAO || 'DEP';
    if (isSarHeliFinal) return String(wp.name || currentMissionData?.sarHeli?.hospitalRef?.name || currentDestICAO || 'HOSP').replace(/^🏥\s*/, '');
    if (isLast) return missionLikePoi ? (currentStartICAO || 'HOME') : (currentDestICAO || 'DEST');
    return wp.name ? String(wp.name).replace(/^RPP\s+/i, '').replace(/^APT\s+/i, '').replace(/^🚁\s*/, '').split(' ')[0] : `WP${index}`;
}

window.vpHardReloadRouteProfile = function(reason = 'route-change') {
    if (!Array.isArray(routeWaypoints) || routeWaypoints.length < 2) return false;

    if (vpProfileFastTimeout) {
        clearTimeout(vpProfileFastTimeout);
        vpProfileFastTimeout = null;
    }
    if (vpProfileSlowTimeout) {
        clearTimeout(vpProfileSlowTimeout);
        vpProfileSlowTimeout = null;
    }
    if (window.vpFetchController) {
        try { window.vpFetchController.abort(); } catch (_) {}
        window.vpFetchController = null;
    }

    // Route edits need a data reload, not only a canvas repaint.
    vpElevationData = null;
    window.vpElevationData = null;
    vpHighResData = null;
    vpAltWaypoints = [];
    vpSegmentAlts = [];
    vpZoomLevel = 100;
    window._lastVpRouteKey = null;
    window._lastLmRouteKey = null;
    window._lastObsRouteKey = null;
    window._lastWetterRouteKey = null;
    window._lastWetterCoverageKey = null;
    window._lastWetterRouteNm = 0;
    window._vpAutoSarHeliAltRouteKey = null;
    window.vpBgNeedsUpdate = true;

    const zd = document.getElementById('vpZoomDisplay');
    if (zd) zd.textContent = '0%';
    const status = document.getElementById('verticalProfileStatus');
    if (status) status.textContent = 'Lade Terrain...';

    const mapTable = document.getElementById('mapTableOverlay');
    if (mapTable && mapTable.classList.contains('active')) {
        vpMapProfileVisible = true;
        const strip = document.getElementById('mapProfileStrip');
        const btn = document.getElementById('vpToggleBtn');
        if (strip) strip.style.display = '';
        if (btn) {
            btn.textContent = '📊 Profil (An)';
            btn.style.background = '#2E8B57';
        }
        if (typeof initProfileResize === 'function') initProfileResize();
        if (typeof map !== 'undefined' && map && typeof map.invalidateSize === 'function') {
            setTimeout(() => map.invalidateSize(), 80);
        }
    }

    if (window.gaDebugPush) window.gaDebugPush('profile', 'Route profile hard reload', { reason });
    triggerVerticalProfileUpdate();
    if (typeof renderMapProfile === 'function') renderMapProfile();
    return true;
};

function triggerVerticalProfileUpdate() {
    if (vpProfileFastTimeout) clearTimeout(vpProfileFastTimeout);
    if (window.vpFetchController) window.vpFetchController.abort();
    window.vpFetchController = new AbortController();
    const currentSignal = window.vpFetchController.signal;
    const forceOverpassReload = window._vpForceOverpassOnce === true;
    window._vpForceOverpassOnce = false;
    window.vpBgNeedsUpdate = true;

    vpProfileFastTimeout = setTimeout(async () => {
        if (!routeWaypoints || routeWaypoints.length < 2) return;
        const cacheKey = routeWaypoints.map(p => `${(p.lat || 0).toFixed(4)},${((p.lng || p.lon) || 0).toFixed(4)}`).join('|');
        
        if (window._lastVpRouteKey !== cacheKey) {
            vpAltWaypoints = []; vpSegmentAlts = []; vpHighResData = null; vpZoomLevel = 100;
            // Hindernisse/Linear-Features nicht hart leeren:
            // bis neue Route-Daten da sind, bleibt die letzte Darstellung sichtbar.
            if (typeof renderWeatherMarkers === 'function') renderWeatherMarkers();
            const zd = document.getElementById('vpZoomDisplay'); if (zd) zd.textContent = '0%';
            window._lastVpRouteKey = cacheKey;
        }

        const status = document.getElementById('verticalProfileStatus');
        if (status) status.textContent = 'Lade Terrain...';

        try {
            // 1. Höhendaten (Blockierend, da alles andere darauf aufbaut)
            vpElevationData = await fetchRouteElevation(routeWaypoints, currentSignal);
            if (!Array.isArray(vpElevationData)) vpElevationData = [];
            window.vpBgNeedsUpdate = true;
            
            window.vpElevationData = vpElevationData;
            if (typeof vpApplySarHeliAltitudeConstraints === 'function') {
                vpApplySarHeliAltitudeConstraints(cacheKey);
            }
            if (document.getElementById('verticalProfileCanvas') && typeof renderVerticalProfile === 'function') {
                renderVerticalProfile('verticalProfileCanvas');
            }
            const mapTable = document.getElementById('mapTableOverlay');
            if (
                mapTable && mapTable.classList.contains('active')
                && (typeof vpMapProfileVisible === 'undefined' || vpMapProfileVisible)
                && typeof renderMapProfile === 'function'
            ) {
                renderMapProfile();
            }
            
            // 2. Städte / Landmarks (Lokale JSON, blitzschnell)
            if (window._lastLmRouteKey !== cacheKey) {
                const btnLm = document.getElementById('btnToggleLandmarks');
                if (btnLm) btnLm.classList.add('vp-loading-pulse');
                const lmStr = localStorage.getItem('ga_lms_' + cacheKey);
                if (lmStr) {
                    try { vpLandmarks = JSON.parse(lmStr); window._lastLmRouteKey = cacheKey; } catch(e) { vpLandmarks = []; }
                } else {
                    vpLandmarks = await fetchProfileLandmarks(vpElevationData);
                    if (vpLandmarks !== null) {
                        try { localStorage.setItem('ga_lms_' + cacheKey, JSON.stringify(vpLandmarks)); window._lastLmRouteKey = cacheKey; } catch(e) {}
                    }
                }
                if (btnLm) btnLm.classList.remove('vp-loading-pulse');
            }
            
            if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();

            if (status) status.textContent = 'Lade Wetter & Umgebung...';
            
            // 3. PARALLELER FETCH: Wetter & Overpass
            const fetchWetter = async () => {
                const needsProfileWeather = vpShowClouds || vpShowIsobars || vpShowWindComponents;
                if (!needsProfileWeather) {
                    vpWeatherDebugEvent('Wetter-Fetch übersprungen (keine aktive Wetterdarstellung)');
                    return;
                }
                const weatherRouteKey = vpBuildElevationRouteKey(routeWaypoints, 5);
                const weatherCoveragePoints = routeWaypoints.map(p => ({
                    lat: Number(p && p.lat),
                    lon: Number((p && (p.lng ?? p.lon)))
                })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
                const weatherCoverageKey = vpBuildCoverageKeyFromPoints(weatherCoveragePoints, 0.1);
                const weatherSrcCacheKey = vpGetWeatherSourceCacheKey();
                const nowTs = Date.now();
                const maxAgeMs = (vpWeatherSource === 'metar') ? VP_METAR_ROUTE_CACHE_TTL_MS : 5 * 60 * 1000;
                const isFresh = (nowTs - Number(window._lastWeatherFetchAt || 0)) < maxAgeMs;
                const currentRouteNm = Array.isArray(vpElevationData) && vpElevationData.length > 0
                    ? Number(vpElevationData[vpElevationData.length - 1].distNM || 0)
                    : 0;
                const lastRouteNm = Number(window._lastWetterRouteNm || 0);
                const routeDeltaNm = Math.abs(currentRouteNm - lastRouteNm);
                const sameCoverage = !!weatherCoverageKey && weatherCoverageKey === window._lastWetterCoverageKey;
                const sameExactRoute = window._lastWetterRouteKey === weatherRouteKey;
                const canReuseByCoverage = sameCoverage && routeDeltaNm <= 8;
                const weatherCacheReusable = (sameExactRoute || canReuseByCoverage)
                    && window._lastWeatherSourceKey === weatherSrcCacheKey
                    && vpWeatherData
                    && isFresh;

                // Wetter nur dann skippen, wenn Quelle gleich, Daten frisch und Route/Gebiet relevant gleich.
                if (weatherCacheReusable) {
                    if (!sameExactRoute && canReuseByCoverage) {
                        vpWeatherDebugEvent(`Wetter-Fetch übersprungen (Coverage gleich, ΔDist ${routeDeltaNm.toFixed(1)} NM)`);
                    }
                    window.vpBgNeedsUpdate = true; 
                    if (typeof renderWeatherMarkers === 'function') renderWeatherMarkers();
                    return;
                }

                const btnCl = document.getElementById('btnToggleClouds');
                if (btnCl) btnCl.classList.add('vp-loading-pulse');
                const prevWeatherData = Array.isArray(vpWeatherData) ? vpWeatherData : null;
                const nextWeatherData = await fetchRouteWeather(routeWaypoints, vpElevationData, currentSignal);
                if (Array.isArray(nextWeatherData) && nextWeatherData.length > 0) {
                    vpWeatherData = nextWeatherData;
                } else if (prevWeatherData && prevWeatherData.length > 0) {
                    vpWeatherDebugEvent('Wetter-Fetch leer/failed -> letzter gültiger Stand bleibt aktiv');
                    vpWeatherData = prevWeatherData;
                } else {
                    vpWeatherData = nextWeatherData;
                }
                window._lastWetterRouteKey = weatherRouteKey; // Cache-Key merken
                window._lastWetterCoverageKey = weatherCoverageKey;
                window._lastWetterRouteNm = currentRouteNm;
                window._lastWeatherSourceKey = vpGetWeatherSourceCacheKey();
                window._lastWeatherFetchAt = Date.now();
                if (btnCl) btnCl.classList.remove('vp-loading-pulse');
                if (status && vpWeatherSource === 'openmeteo') {
                    status.textContent = (window.vpWeatherFallbackMode === 'openmeteo_to_metar')
                        ? 'Open-Meteo nicht verfügbar – Fallback: METAR'
                        : ((window.vpWeatherFallbackMode === 'metar_to_openmeteo')
                            ? 'METAR nicht verfügbar – Fallback: Open-Meteo'
                            : 'Open-Meteo aktiv');
                }
                
                window.vpBgNeedsUpdate = true; 
                if (typeof renderWeatherMarkers === 'function') renderWeatherMarkers(); 
                if (typeof window.scheduleMapWeatherOverlayUpdate === 'function') window.scheduleMapWeatherOverlayUpdate(true);
            };

            const fetchOverpass = async () => {
                if (!vpShowObstacles && !vpShowLinear) return;
                const needsObsNow = !!vpShowObstacles;
                const needsLinNow = !!vpShowLinear;

                const now = Date.now();
                const tileProbe = vpGetRouteTileCoverageProbe(vpElevationData);
                let hasRouteComboCache = false;
                try {
                    const comboRaw = localStorage.getItem('ga_obs_combo_' + cacheKey);
                    if (comboRaw) {
                        const combo = JSON.parse(comboRaw);
                        const obs = Array.isArray(combo && combo.obs) ? combo.obs : [];
                        const lin = Array.isArray(combo && combo.lin) ? combo.lin : [];
                        hasRouteComboCache = (!needsObsNow || obs.length > 0) && (!needsLinNow || lin.length > 0);
                    }
                } catch (_) { }
                const lastSuccessAt = Number((window.vpOverpassRouteLastSuccess && window.vpOverpassRouteLastSuccess[cacheKey]) || 0);
                if (!forceOverpassReload && hasRouteComboCache && tileProbe.missing.length === 0 && lastSuccessAt > 0 && (now - lastSuccessAt) < VP_OVERPASS_MIN_REQUERY_MS) {
                    if (window.vpWeatherDebug) window.vpWeatherDebug.overpassRouteThrottleSkips += 1;
                    console.log(`[Overpass] Route-Guard aktiv (${Math.ceil((VP_OVERPASS_MIN_REQUERY_MS - (now - lastSuccessAt)) / 1000)}s Rest), nutze Bestand.`);
                    return;
                }

                if (!forceOverpassReload && tileProbe.total > 0 && tileProbe.missing.length === 0) {
                    if (window.vpSetObsTileDeferred) window.vpSetObsTileDeferred('__RESET__', false);
                    const comboRawFast = localStorage.getItem('ga_obs_combo_' + cacheKey);
                    if (comboRawFast) {
                        try {
                            const comboFast = JSON.parse(comboRawFast);
                            const cObs = Array.isArray(comboFast && comboFast.obs) ? comboFast.obs : [];
                            const cLin = Array.isArray(comboFast && comboFast.lin) ? comboFast.lin : [];
                            let comboSparseLin = false;
                            if (needsLinNow && cLin.length > 0) {
                                const routeTileCount = vpCollectRouteTileKeys(vpElevationData).size;
                                const linTileSet = new Set(
                                    cLin
                                        .map(f => String(f && f.tileKey || ''))
                                        .filter(Boolean)
                                );
                                comboSparseLin = routeTileCount >= 8 && linTileSet.size <= 2;
                                if (comboSparseLin) {
                                    console.warn(`[Overpass] Route-Combo-Cache wirkt zu dünn (${linTileSet.size}/${routeTileCount} Lin-Tiles) -> Refetch statt Fast-Cache.`);
                                }
                            }
                            const comboFastUsable = (!needsObsNow || cObs.length > 0) && (!needsLinNow || cLin.length > 0) && !comboSparseLin;
                            if (comboFastUsable) {
                                vpObstacles = cObs;
                                vpLinearFeatures = cLin;
                                vpLogRouteFeatureStats('route-cache-combo-fast', cacheKey, vpObstacles, vpLinearFeatures);
                                window._lastObsRouteKey = cacheKey;
                                window.vpOverpassRouteLastSuccess[cacheKey] = Date.now();
                                if (window.vpWeatherDebug) window.vpWeatherDebug.overpassTileCoverageHits += 1;
                                window.vpBgNeedsUpdate = true;
                                if (typeof window.vpScheduleProfileRender === 'function') window.vpScheduleProfileRender('overpass-route-cache-fast', 50);
                                else if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
                                console.log('[Overpass] Route vollständig im Tile-Cache. Nutze Route-Combo-Cache.');
                                return;
                            }
                            console.warn('[Overpass] Route-Combo-Cache unvollständig -> Refetch-Prüfung läuft.');
                        } catch (_) { }
                    } else {
                        console.log('[Overpass] Coverage vollständig, aber kein Route-Combo-Cache vorhanden -> Tile-Refresh wird erzwungen.');
                    }
                } else if (!forceOverpassReload && tileProbe.missing.length > 0) {
                    if (window.vpWeatherDebug) window.vpWeatherDebug.overpassTileCoverageMisses += 1;
                    console.log(`[Overpass] Tile-Cache unvollständig: ${tileProbe.missing.length}/${tileProbe.total} Tiles fehlen.`);
                }

                const inflightKey = `obs|${cacheKey}`;
                if (window.vpOverpassInFlight && window.vpOverpassInFlight.has(inflightKey)) {
                    if (window.vpWeatherDebug) window.vpWeatherDebug.overpassInFlightJoins += 1;
                    await window.vpOverpassInFlight.get(inflightKey);
                    return;
                }
                if (window.vpOverpassGlobalInFlight && window.vpOverpassGlobalInFlight.promise) {
                    if (window.vpOverpassGlobalInFlight.key === inflightKey) {
                        if (window.vpWeatherDebug) window.vpWeatherDebug.overpassInFlightJoins += 1;
                        await window.vpOverpassGlobalInFlight.promise;
                    } else {
                        console.log('[Overpass] Globaler Request läuft bereits, nutze vorerst Cache/Pool-Daten.');
                    }
                    return;
                }

                const runner = (async () => {
                    const btnOb = document.getElementById('btnToggleObstacles');
                    if (btnOb) btnOb.classList.add('vp-loading-pulse');
                    vpSetLinearLoadingPulse(true);
                    const routeTileCount = vpCollectRouteTileKeys(vpElevationData).size;
                    const isLinearCoverageWeak = (features) => {
                        if (!needsLinNow) return false;
                        if (!Array.isArray(features) || features.length === 0) return true;
                        const linTileSet = new Set(
                            features
                                .map(f => String(f && f.tileKey || ''))
                                .filter(Boolean)
                        );
                        return routeTileCount >= 8 && linTileSet.size <= 2;
                    };

                    // FIX: Kombinierter Cache für Hindernisse UND Flüsse/Autobahnen
                    const obStr = localStorage.getItem('ga_obs_combo_' + cacheKey);
                    let hasUsableCache = false;
                    if (obStr) {
                        try { 
                            const cached = JSON.parse(obStr); 
                            vpObstacles = cached.obs || [];
                            vpLinearFeatures = cached.lin || [];
                            vpLogRouteFeatureStats('route-cache-combo', cacheKey, vpObstacles, vpLinearFeatures);
                            window._lastObsRouteKey = cacheKey; 
                            hasUsableCache = (!needsObsNow || vpObstacles.length > 0) && (!needsLinNow || vpLinearFeatures.length > 0);
                            vpRememberObstacleData(vpObstacles, vpLinearFeatures);
                            window.vpBgNeedsUpdate = true; // <--- FIX: Redraw nach Laden aus Cache erzwingen
                        } catch(e) { vpObstacles = []; vpLinearFeatures = []; }
                    }

                    let weakLinearCoverage = false;
                    if (!forceOverpassReload && needsLinNow && Array.isArray(vpLinearFeatures) && vpLinearFeatures.length > 0) {
                        weakLinearCoverage = isLinearCoverageWeak(vpLinearFeatures);
                        if (weakLinearCoverage) {
                            console.warn(`[Overpass] Linear-Coverage verdächtig dünn -> erzwinge Refetch.`);
                        }
                    }

                    if (!hasUsableCache) {
                        const seeded = vpProjectObsPoolToRoute(vpElevationData);
                        const seededObsOk = !needsObsNow || (Array.isArray(seeded.obs) && seeded.obs.length > 0);
                        const seededLinOk = !needsLinNow || (Array.isArray(seeded.lin) && seeded.lin.length > 0);
                        if ((seeded.obs && seeded.obs.length) || (seeded.lin && seeded.lin.length)) {
                            vpObstacles = seeded.obs || [];
                            vpLinearFeatures = seeded.lin || [];
                            vpLogRouteFeatureStats('pool-seed', cacheKey, vpObstacles, vpLinearFeatures);
                            hasUsableCache = seededObsOk && seededLinOk;
                            weakLinearCoverage = !forceOverpassReload && isLinearCoverageWeak(vpLinearFeatures);
                            window.vpBgNeedsUpdate = true;
                            if (typeof window.vpScheduleProfileRender === 'function') window.vpScheduleProfileRender('overpass-pool-seed', 80);
                            else if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
                            if (!weakLinearCoverage && tileProbe.total > 0 && tileProbe.missing.length === 0) {
                                try {
                                    vpStoreObsComboRouteCache(cacheKey, vpObstacles, vpLinearFeatures);
                                    window._lastObsRouteKey = cacheKey;
                                    window.vpOverpassRouteLastSuccess[cacheKey] = Date.now();
                                } catch (_) {}
                            }
                        }
                    }

                    // Wichtig: Nicht nur auf "Key existiert" prüfen.
                    // Wenn der Route-Cache leer/kaputt ist oder keine nutzbaren Daten
                    // enthält, müssen wir trotzdem live nachladen.
                    const forceFullTileReload = (!forceOverpassReload && !hasRouteComboCache && !hasUsableCache && tileProbe.total > 0 && tileProbe.missing.length === 0);
                    const mustRefetch = forceOverpassReload || forceFullTileReload || !hasUsableCache || weakLinearCoverage || tileProbe.missing.length > 0;
                    if (mustRefetch) {
                        // Bei verdächtig dünner Linear-Coverage immer echten Netz-Reload forcieren.
                        // Sonst landen wir in einem Cache-Loop mit denselben "leeren" Lin-Tiles.
                        const forceNetReload = forceOverpassReload || forceFullTileReload || weakLinearCoverage;
                        const result = await fetchProfileObstacles(vpElevationData, currentSignal, cacheKey, forceNetReload);
                        if (result !== null) { 
                            vpObstacles = result.obs || [];
                            vpLinearFeatures = result.lin || [];
                            vpLogRouteFeatureStats('network-merge', cacheKey, vpObstacles, vpLinearFeatures);
                            window.vpBgNeedsUpdate = true; // FIX: Garantiert, dass der Hintergrund nach dem finalen Fetch aktualisiert wird
                            window.vpOverpassRouteLastSuccess[cacheKey] = Date.now();
                            // Do not overwrite per-tile source metadata with an aggregated route source label.
                            // fetchProfileObstacles() already marks each loaded tile individually (hosted/overpass).
                            try {
                                vpStoreObsComboRouteCache(cacheKey, vpObstacles, vpLinearFeatures);
                                window._lastObsRouteKey = cacheKey;
                            } catch(e) {}
                            if (!forceOverpassReload && result && Array.isArray(result.deferredTileKeys) && result.deferredTileKeys.length > 0) {
                                const deferredWait = Math.max(
                                    VP_OBS_TILE_DEFERRED_RETRY_MS,
                                    Number(result.nextTileRetryMs || 0) + 800
                                );
                                if (window._vpOverpassDeferredRefreshTimer) clearTimeout(window._vpOverpassDeferredRefreshTimer);
                                window._vpOverpassDeferredRefreshTimer = setTimeout(() => {
                                    window._vpOverpassDeferredRefreshTimer = null;
                                    if (!routeWaypoints || routeWaypoints.length < 2) return;
                                    if (window._lastVpRouteKey !== cacheKey) return;
                                    if (vpIsOverpassCoolingDown()) return;
                                    if (typeof triggerVerticalProfileUpdate === 'function') triggerVerticalProfileUpdate();
                                }, deferredWait);
                            }
                            if (!forceOverpassReload && result && Array.isArray(result.failedTileKeys) && result.failedTileKeys.length > 0) {
                                const retryMs = Math.max(VP_OBS_TILE_DEFERRED_RETRY_MS, vpGetOverpassCooldownRemainingMs() + 1200);
                                if (window._vpOverpassFailedRefreshTimer) clearTimeout(window._vpOverpassFailedRefreshTimer);
                                window._vpOverpassFailedRefreshTimer = setTimeout(() => {
                                    window._vpOverpassFailedRefreshTimer = null;
                                    if (!routeWaypoints || routeWaypoints.length < 2) return;
                                    if (window._lastVpRouteKey !== cacheKey) return;
                                    if (vpIsOverpassCoolingDown()) return;
                                    if (typeof triggerVerticalProfileUpdate === 'function') triggerVerticalProfileUpdate();
                                }, retryMs);
                            }
                        }
                    }
                    if (btnOb) btnOb.classList.remove('vp-loading-pulse');
                    vpSetLinearLoadingPulse(false);
                })();

                if (window.vpOverpassInFlight) window.vpOverpassInFlight.set(inflightKey, runner);
                window.vpOverpassGlobalInFlight = { key: inflightKey, promise: runner };
                try {
                    await runner;
                } finally {
                    if (window.vpOverpassInFlight) window.vpOverpassInFlight.delete(inflightKey);
                    if (window.vpOverpassGlobalInFlight && window.vpOverpassGlobalInFlight.promise === runner) {
                        window.vpOverpassGlobalInFlight = null;
                    }
                }
            };

            // Führe beide schweren Netzwerk-Tasks parallel aus
            await Promise.all([fetchWetter(), fetchOverpass()]);
            if (typeof window.scheduleMapWeatherOverlayUpdate === 'function') window.scheduleMapWeatherOverlayUpdate(true);
            if (status) {
                const wxInfo = (vpWeatherSource === 'openmeteo')
                    ? ((window.vpWeatherFallbackMode === 'openmeteo_to_metar') ? ' • Fallback METAR' : ' • Open-Meteo')
                    : ((window.vpWeatherFallbackMode === 'metar_to_openmeteo') ? ' • Fallback Open-Meteo' : ' • METAR');
                const terrainInfo = window.vpElevationFallbackActive ? ' • Terrain Fallback' : '';
                const elevCount = Array.isArray(vpElevationData) ? vpElevationData.length : 0;
                status.textContent = elevCount + ' Punkte & API-Daten geladen' + wxInfo + terrainInfo;
            }
            
        } catch(e) {
            if (e && e.name !== 'AbortError') console.error('Profile Fetch Error:', e);
            if (status) status.textContent = 'API Error / Abgebrochen';
        } finally {
            const bC = document.getElementById('btnToggleClouds'); if(bC) bC.classList.remove('vp-loading-pulse');
            const bO = document.getElementById('btnToggleObstacles'); if(bO) bO.classList.remove('vp-loading-pulse');
            vpSetLinearLoadingPulse(false);
            if (typeof window.vpScheduleProfileRender === 'function') window.vpScheduleProfileRender('profile-fetch-final', 40);
            else if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
        }
    }, 150); // Nur noch 150ms Debounce statt fast 3 Sekunden!
}

window.vpForceOverpassRefresh = function() {
    if (!window._lastVpRouteKey || !routeWaypoints || routeWaypoints.length < 2) return;
    window._vpForceOverpassOnce = true;
    window._lastObsRouteKey = null;
    triggerVerticalProfileUpdate();
};

async function fetchRouteElevation(routePts, signal) {
    if (!routePts || routePts.length < 2) return [];

    const cacheKey = vpBuildElevationRouteKey(routePts, 4);
    const coarseKey = vpBuildElevationRouteKey(routePts, 3);
    const coarseMemKey = 'q3|' + coarseKey;

    if (vpElevationCache[cacheKey]) {
        window.vpElevationFallbackActive = false;
        window.vpTerrainElevationSource = 'terrarium-cache';
        return vpElevationCache[cacheKey];
    }

    const exactStored = vpGetStoredElevationCache(cacheKey, false);
    if (exactStored) {
        vpElevationCache[cacheKey] = exactStored;
        window.vpElevationFallbackActive = false;
        window.vpTerrainElevationSource = 'terrarium-cache';
        return exactStored;
    }

    const coarseCached = vpElevationCache[coarseMemKey] || vpGetStoredElevationCache(coarseKey, true);
    if (coarseCached) {
        vpElevationCache[coarseMemKey] = coarseCached;
        vpRecordElevationFallback('coarse route cache');
        return coarseCached;
    }

    const { interpolated, samplePts } = vpBuildInterpolatedRoutePoints(routePts);
    const approxProfile = vpBuildApproxElevationProfile(interpolated);

    try {
        const terrariumData = await vpFetchElevationFromTerrarium(samplePts, signal);
        if (terrariumData && terrariumData.length === samplePts.length) {
            return vpPersistElevationResult(cacheKey, coarseKey, terrariumData, 'terrarium');
        }
    } catch (e) {
        if (e && e.name === 'AbortError') return null;
        vpWeatherDebugSetError(e, 'terrarium elevation');
    }

    if (vpIsElevationCoolingDown()) {
        vpRecordElevationFallback('terrarium unavailable + openmeteo cooldown');
        return approxProfile;
    }

    const lats = samplePts.map(p => p.lat.toFixed(4)).join(',');
    const lons = samplePts.map(p => p.lon.toFixed(4)).join(',');

    try {
        if (window.vpWeatherDebug) window.vpWeatherDebug.elevationNetworkRequests += 1;
        const res = await fetch('https://api.open-meteo.com/v1/elevation?latitude=' + lats + '&longitude=' + lons, { signal });
        if (!res.ok) {
            if (res.status === 429) vpRecordElevation429();
            throw new Error('Elevation API error: ' + res.status);
        }
        const data = await res.json();

        if (!data.elevation || data.elevation.length !== samplePts.length) {
            throw new Error('Invalid elevation response');
        }

        const finalData = samplePts.map((p, i) => ({
            distNM: p.distNM,
            elevFt: Math.round(data.elevation[i] * 3.28084),
            lat: p.lat,
            lon: p.lon
        }));

        vpPersistElevationResult(cacheKey, coarseKey, finalData, 'openmeteo');
        if (window.vpWeatherDebug) window.vpWeatherDebug.lastElevationSuccessAt = Date.now();
        return finalData;
    } catch (e) {
        if (e && e.name === 'AbortError') return null;
        vpWeatherDebugSetError(e, 'elevation');
        vpRecordElevationFallback((e && e.message) ? e.message : 'elevation fetch failed');
        return approxProfile;
    }
}

async function fetchRouteWeatherMetar(routePts, elevData, signal, options = {}) {
    if (!routePts || routePts.length < 2 || !elevData || elevData.length < 2) return null;
    const fastFail = !!(options && options.fastFail);
    const perRequestTimeoutMs = fastFail ? 3200 : 6500;
    const retries = fastFail ? 1 : 2;

    const totalDist = elevData[elevData.length - 1].distNM;
    let activeMetars = [];

    function vpQuant(v, step = 0.25) {
        if (!Number.isFinite(v) || !Number.isFinite(step) || step <= 0) return Number(v || 0);
        return Math.round(v / step) * step;
    }

    function vpBuildMetarChunkKey(minLat, minLon, maxLat, maxLon) {
        return [
            vpQuant(minLat).toFixed(2),
            vpQuant(minLon).toFixed(2),
            vpQuant(maxLat).toFixed(2),
            vpQuant(maxLon).toFixed(2)
        ].join('|');
    }

    function vpGetMetarChunkCache(key, now = Date.now(), allowStale = false) {
        if (!key) return null;
        const entry = vpMetarChunkCache.get(key);
        if (!entry || !Array.isArray(entry.data)) return null;
        const ttl = entry.empty ? VP_METAR_CHUNK_EMPTY_TTL_MS : VP_METAR_CHUNK_CACHE_TTL_MS;
        const age = now - Number(entry.ts || 0);
        if (age > ttl && !allowStale) return null;
        return entry.data;
    }

    function vpSetMetarChunkCache(key, arr, now = Date.now()) {
        if (!key || !Array.isArray(arr)) return;
        vpMetarChunkCache.set(key, { ts: now, data: arr, empty: arr.length === 0 });
        if (vpMetarChunkCache.size <= VP_METAR_CHUNK_CACHE_MAX) return;
        const drop = vpMetarChunkCache.size - VP_METAR_CHUNK_CACHE_MAX;
        const oldest = Array.from(vpMetarChunkCache.entries())
            .sort((a, b) => Number((a[1] && a[1].ts) || 0) - Number((b[1] && b[1].ts) || 0))
            .slice(0, Math.max(1, drop));
        for (const [k] of oldest) vpMetarChunkCache.delete(k);
    }

    function vpBuildPrefetchGridChunks(eData, radiusNm) {
        if (!Array.isArray(eData) || eData.length < 2) return [];
        let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
        for (const p of eData) {
            if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
            minLat = Math.min(minLat, p.lat);
            maxLat = Math.max(maxLat, p.lat);
            minLon = Math.min(minLon, p.lon);
            maxLon = Math.max(maxLon, p.lon);
        }
        if (!Number.isFinite(minLat) || minLat > maxLat) return [];
        const padDeg = Math.max(0.2, Number(radiusNm || 0) / 60);
        const c = VP_METAR_PREFETCH_CELL_DEG;
        const minLatQ = Math.floor((minLat - padDeg) / c) * c;
        const maxLatQ = Math.ceil((maxLat + padDeg) / c) * c;
        const minLonQ = Math.floor((minLon - padDeg) / c) * c;
        const maxLonQ = Math.ceil((maxLon + padDeg) / c) * c;
        const defs = [];
        const seen = new Set();
        for (let la = minLatQ; la < maxLatQ - 1e-8; la += c) {
            for (let lo = minLonQ; lo < maxLonQ - 1e-8; lo += c) {
                const minLa = Math.max(-89.8, la);
                const maxLa = Math.min(89.8, la + c);
                const minLo = Math.max(-179.8, lo);
                const maxLo = Math.min(179.8, lo + c);
                const key = vpBuildMetarChunkKey(minLa, minLo, maxLa, maxLo);
                if (!key || seen.has(key)) continue;
                seen.add(key);
                defs.push({ minLat: minLa, minLon: minLo, maxLat: maxLa, maxLon: maxLo, key });
            }
        }
        return defs;
    }

    function parseMetarJsonText(text) {
        if (typeof text !== 'string') return null;
        const trimmed = text.trim();
        if (!trimmed) return null;
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && Array.isArray(parsed.data)) return parsed.data;
            if (parsed && Array.isArray(parsed.results)) return parsed.results;
            if (parsed && typeof parsed.contents === 'string') {
                const nested = JSON.parse(parsed.contents);
                return Array.isArray(nested) ? nested : null;
            }
        } catch (_) {}
        return null;
    }

    const skipDirectMetarFetch = true;

    async function fetchWithTimeout(urlObj) {
        const ctrl = new AbortController();
        let timer = null;
        let onAbort = null;
        if (signal) {
            onAbort = () => ctrl.abort();
            if (signal.aborted) ctrl.abort();
            else signal.addEventListener('abort', onAbort, { once: true });
        }
        timer = setTimeout(() => ctrl.abort(), perRequestTimeoutMs);
        try {
            return await fetch(urlObj, { signal: ctrl.signal });
        } finally {
            if (timer) clearTimeout(timer);
            if (signal && onAbort) signal.removeEventListener('abort', onAbort);
        }
    }

    function vpProxyIsCoolingDown(key, now = Date.now()) {
        if (key === 'ga_worker') return false;
        const until = Number(vpMetarProxyBackoff.get(key) || 0);
        return until > now;
    }

    function vpProxyMarkFailed(key) {
        if (!key) return;
        if (key === 'ga_worker') return;
        vpMetarProxyBackoff.set(key, Date.now() + VP_METAR_PROXY_FAIL_COOLDOWN_MS);
    }

    function vpProxyMarkOk(key) {
        if (!key) return;
        if (key === 'ga_worker') return;
        vpMetarProxyBackoff.delete(key);
    }

    async function safeFetchMetarJson(urlObj, retryCount = retries) {
        const proxyDefs = [
            { key: 'ga_worker', mk: (u) => `https://ga-proxy.einherjer.workers.dev/api/metar?src=${encodeURIComponent(u)}` },
            { key: 'codetabs', mk: (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}` }
        ];
        let infraBlocked = false;
        for (let i = 0; i < retryCount; i++) {
            if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
            if (!skipDirectMetarFetch) {
                try {
                    const r = await fetchWithTimeout(urlObj);
                    if (r.ok && r.status !== 204) {
                        const txt = await r.text();
                        const arr = parseMetarJsonText(txt);
                        if (arr) return arr;
                    }
                    if ([400, 401, 403, 404].includes(r.status)) break;
                } catch (_) {}
            }

            const activeProxies = proxyDefs.filter(p => !vpProxyIsCoolingDown(p.key));
            if (activeProxies.length === 0) {
                window.vpMetarLastInfraBlockAt = Date.now();
                infraBlocked = true;
                vpWeatherDebugEvent('METAR proxies in cooldown -> skip network');
                if (i < retryCount - 1) await new Promise(res => setTimeout(res, fastFail ? 120 : 300));
                continue;
            }

            for (const proxy of activeProxies) {
                try {
                    const pr = await fetchWithTimeout(proxy.mk(urlObj));
                    if (!pr.ok || pr.status === 204) {
                        if ([400, 401, 403, 404, 408, 429].includes(pr.status) || pr.status >= 500) {
                            vpProxyMarkFailed(proxy.key);
                        }
                        continue;
                    }
                    const ptxt = await pr.text();
                    const arr = parseMetarJsonText(ptxt);
                    if (arr) {
                        vpProxyMarkOk(proxy.key);
                        return arr;
                    }
                    vpProxyMarkFailed(proxy.key);
                    if ([400, 401, 403, 404].includes(pr.status)) continue;
                } catch (_) {
                    vpProxyMarkFailed(proxy.key);
                }
            }

            if (i < retryCount - 1) await new Promise(res => setTimeout(res, fastFail ? 250 : 600));
        }
        return infraBlocked ? null : [];
    }

    // METAR FIX: Route in parallele 60-NM-Blöcke schneiden, um AviationWeather API-Schnittlimits (Max Stations) zu umgehen!
    const CHUNK_NM = 60;
    const chunkDefs = [];

    for (let d = 0; d < totalDist; d += CHUNK_NM) {
        let cMinLat = 90, cMaxLat = -90, cMinLon = 180, cMaxLon = -180;
        elevData.forEach(p => {
            if (p.distNM >= d && p.distNM < d + CHUNK_NM) {
                if (p.lat < cMinLat) cMinLat = p.lat;
                if (p.lat > cMaxLat) cMaxLat = p.lat;
                if (p.lon < cMinLon) cMinLon = p.lon;
                if (p.lon > cMaxLon) cMaxLon = p.lon;
            }
        });
        if (cMinLat === 90) continue;
        
        // Puffer hinzufügen (ca. 45 NM)
        cMinLat -= 0.8; cMaxLat += 0.8; cMinLon -= 0.8; cMaxLon += 0.8;
        chunkDefs.push({
            minLat: cMinLat,
            minLon: cMinLon,
            maxLat: cMaxLat,
            maxLon: cMaxLon,
            key: vpBuildMetarChunkKey(cMinLat, cMinLon, cMaxLat, cMaxLon)
        });
    }

    const nowTs = Date.now();
    const fetchChunkData = async (chunk, bypassCache = false) => {
        if (!bypassCache) {
            const cached = vpGetMetarChunkCache(chunk.key, nowTs);
            if (Array.isArray(cached)) return { arr: cached, fromCache: true };
        }
        const url = `https://aviationweather.gov/api/data/metar?bbox=${chunk.minLat},${chunk.minLon},${chunk.maxLat},${chunk.maxLon}&format=json&t=${Date.now()}`;
        const arr = await safeFetchMetarJson(url, retries);
        if (arr === null) {
            const stale = vpGetMetarChunkCache(chunk.key, nowTs, true);
            if (Array.isArray(stale) && stale.length > 0) {
                return { arr: stale, fromCache: true, staleFallback: true };
            }
            return { arr: [], fromCache: false, infraBlocked: true };
        }
        const safeArr = Array.isArray(arr) ? arr : [];
        vpSetMetarChunkCache(chunk.key, safeArr, Date.now());
        if (safeArr.length > 0) return { arr: safeArr, fromCache: false };
        const stale = vpGetMetarChunkCache(chunk.key, nowTs, true);
        if (Array.isArray(stale) && stale.length > 0) {
            return { arr: stale, fromCache: true, staleFallback: true };
        }
        return { arr: safeArr, fromCache: false };
    };

    const promises = chunkDefs.map(async (chunk) => {
        const cached = vpGetMetarChunkCache(chunk.key, nowTs);
        if (Array.isArray(cached)) return { arr: cached, fromCache: true };
        return fetchChunkData(chunk, false);
    });

    let results = await Promise.all(promises);
    const allEmpty = results.length > 0 && results.every(item => !item || !Array.isArray(item.arr) || item.arr.length === 0);
    const allFromCache = results.length > 0 && results.every(item => !!(item && item.fromCache));
    if (allEmpty && allFromCache) {
        vpWeatherDebugEvent('METAR cache-only empty result -> force refresh');
        for (const c of chunkDefs) vpMetarChunkCache.delete(c.key);
        results = await Promise.all(chunkDefs.map(c => fetchChunkData(c, true)));
    }
    if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const hasAnyMetarResult = results.some(item => item && Array.isArray(item.arr) && item.arr.length > 0);

    // Stage-2 Cache-Aufbau: größere Zone im Hintergrund nachziehen (sehr konservativ).
    try {
        const nowPrefetch = Date.now();
        const prefetchKey = `pf|${vpBuildElevationRouteKey(routePts, 2)}`;
        const lastPrefetchAt = Number(window.vpMetarPrefetchLastRunAt || 0);
        const lastPrefetchKey = String(window.vpMetarPrefetchLastKey || '');
        if (
            hasAnyMetarResult &&
            vpMetarProxyBackoff.size === 0 &&
            ((prefetchKey !== lastPrefetchKey) || ((nowPrefetch - lastPrefetchAt) > VP_METAR_PREFETCH_MIN_INTERVAL_MS))
        ) {
            window.vpMetarPrefetchLastKey = prefetchKey;
            window.vpMetarPrefetchLastRunAt = nowPrefetch;
            const nearDefs = vpBuildPrefetchGridChunks(elevData, VP_METAR_PREFETCH_NEAR_NM);
            const farDefs = vpBuildPrefetchGridChunks(elevData, VP_METAR_PREFETCH_FAR_NM);
            const primaryKeys = new Set(chunkDefs.map(c => c.key));
            const prefetchDefs = farDefs
                .filter(d => !primaryKeys.has(d.key))
                .filter(d => !Array.isArray(vpGetMetarChunkCache(d.key, nowPrefetch)))
                .filter(d => !vpMetarPrefetchInFlight.has(d.key))
                .slice(0, VP_METAR_PREFETCH_MAX_CHUNKS);
            if (prefetchDefs.length > 0) {
                const runPrefetch = async () => {
                    for (const d of prefetchDefs) {
                        if (signal && signal.aborted) return;
                        if (vpMetarPrefetchInFlight.has(d.key)) continue;
                        vpMetarPrefetchInFlight.add(d.key);
                        try {
                            const url = `https://aviationweather.gov/api/data/metar?bbox=${d.minLat},${d.minLon},${d.maxLat},${d.maxLon}&format=json&t=${Date.now()}`;
                            const arr = await safeFetchMetarJson(url, 1);
                            if (arr === null) continue;
                            const safeArr = Array.isArray(arr) ? arr : [];
                            vpSetMetarChunkCache(d.key, safeArr, Date.now());
                        } catch (_) {
                            // prefetch best-effort
                        } finally {
                            vpMetarPrefetchInFlight.delete(d.key);
                        }
                        await new Promise(r => setTimeout(r, 500));
                    }
                    vpWeatherDebugEvent(`METAR prefetch near/far queued: near=${nearDefs.length} far=${prefetchDefs.length}`);
                };
                setTimeout(() => { runPrefetch().catch(() => {}); }, 0);
            }
        }
    } catch (_) {}

    let seen = new Set();
    let totalInChunks = 0;
    
    results.forEach((item, idx) => {
        const arr = item && Array.isArray(item.arr) ? item.arr : [];
        const fromCache = !!(item && item.fromCache);
        const fromStale = !!(item && item.staleFallback);
        if (arr && arr.length) {
            console.log(`[Wetter] Chunk ${idx + 1}: ${arr.length} METAR-Stationen geliefert${fromStale ? ' (stale-cache)' : (fromCache ? ' (cache)' : '')}.`);
            totalInChunks += arr.length;
            
            // BULK CACHE: Füttert die Widgets sofort mit den heruntergeladenen Daten!
            const useBulk = (typeof gpsState !== 'undefined' && gpsState.metarCache);
            
            arr.forEach(m => {
                if (m && m.icaoId && !seen.has(m.icaoId)) {
                    seen.add(m.icaoId);
                    activeMetars.push(m);
                    
                    if (useBulk) {
                        gpsState.metarCache[m.icaoId] = { data: [m], isFallback: false, foundIcao: m.icaoId };
                    }
                }
            });
        } else {
            console.log(`[Wetter] Chunk ${idx + 1}: 0 Stationen${fromCache ? ' (cache)' : ' (Leerer Bereich oder Fehler)'}.`);
        }
    });
    console.log(`[Wetter] Gesamt nach Duplikat-Filterung: ${activeMetars.length} einzigartige Stationen für dieses Flugprofil.`);

    if (!activeMetars || activeMetars.length === 0) return null;
    const stepNM = 15;
    const zones = [];

    for (let targetDist = 0; targetDist <= totalDist; targetDist += stepNM) {
        let bestPt = elevData[0];
        let minDiff = Infinity;
        for (const pt of elevData) {
            const diff = Math.abs(pt.distNM - targetDist);
            if (diff < minDiff) { minDiff = diff; bestPt = pt; }
        }

        let closestMetar = null, minMetarDist = Infinity;
        activeMetars.forEach(m => {
            const d = calcNav(bestPt.lat, bestPt.lon, m.lat, m.lon).dist;
            if (d < minMetarDist) { minMetarDist = d; closestMetar = m; }
        });

        if (closestMetar && minMetarDist < 45) {
            const clouds = [];
            const raw = closestMetar.rawOb || "";
            const stnElevFt = closestMetar.elev ? closestMetar.elev * 3.28084 : 0;
            const cloudRegex = /(FEW|SCT|BKN|OVC|VV)(\d{3})/g;
            let match, lowestBase = Infinity;
            
            while((match = cloudRegex.exec(raw)) !== null) {
                const agl = parseInt(match[2], 10) * 100;
                const msl = Math.round(agl + stnElevFt);
                if (msl < lowestBase) lowestBase = msl;
                clouds.push({ type: match[1], baseAgl: agl, baseMsl: msl });
            }
            
            const hasRain = /\b(-|\+)?(RA|DZ|SH|SHRA)\b/i.test(raw);
            const hasSnow = /\b(-|\+)?(SN|SG|PL|SHSN)\b/i.test(raw);
            const hasTS = /\b(-|\+)?(TS|TSRA|CB)\b/i.test(raw);
            const metarFltCat = closestMetar.fltcat || closestMetar.fltCat || "VFR";
            if (clouds.length === 0) {
                const estimatedCloud = vpBuildTempDewCloudLayer({
                    tempC: closestMetar.temp,
                    dewPointC: closestMetar.dewp,
                    windKt: closestMetar.wspd,
                    terrainFt: stnElevFt,
                    fltCat: metarFltCat,
                    hasRain,
                    hasSnow,
                    raw,
                    source: 'metar_temp_dew'
                });
                if (estimatedCloud) {
                    clouds.push(estimatedCloud);
                    lowestBase = estimatedCloud.baseMsl;
                }
            }
            const mslPressureRaw = Number(closestMetar.mslp ?? closestMetar.slp ?? closestMetar.altim);
            const mslPressureHpa = (Number.isFinite(mslPressureRaw) && mslPressureRaw >= 850 && mslPressureRaw <= 1100)
                ? mslPressureRaw
                : null;
            const pressureProfile = [];
            if (Number.isFinite(mslPressureHpa)) {
                const pressureAnomalyFt = (mslPressureHpa - VP_STD_MSL_PRESSURE_HPA) * 27;
                const base1000 = Number(VP_OM_LEVEL_DEFAULT_FT[1000] || 360);
                const wkt = Number(closestMetar.wspd);
                const wdir = Number(closestMetar.wdir);
                pressureProfile.push({
                    hPa: 1000,
                    geopotentialFt: base1000 + pressureAnomalyFt,
                    windKt: Number.isFinite(wkt) ? wkt : null,
                    windDirDeg: Number.isFinite(wdir) ? wdir : null
                });
            }
            
            const visuals = { puffs: [], drops: [], flashes: [] };
            if (clouds.length > 0) {
                for(let c=0; c<25; c++) visuals.puffs.push({ x: Math.random(), y: Math.random(), r: Math.random(), op: Math.random() });
            }
            if (hasRain || hasSnow) {
                for(let d=0; d<120; d++) visuals.drops.push({ x: Math.random(), y: Math.random(), spd: Math.random() });
            }
            if (hasTS) {
                for(let f=0; f<2; f++) visuals.flashes.push({ x: Math.random(), pts: [Math.random(), Math.random(), Math.random(), Math.random()] });
            }
            
            // IMMER pushen, damit auch wolkenlose Stationen als Marker auf der Karte landen!
            zones.push({
                distNM: bestPt.distNM, icao: closestMetar.icaoId, stnDist: Math.round(minMetarDist), clouds: clouds,
                lowestBase: lowestBase !== Infinity ? lowestBase : 5000,
                weather: { hasRain, hasSnow, hasTS }, visuals: visuals,
                stnLat: closestMetar.lat, stnLon: closestMetar.lon,
                fltCat: metarFltCat,
                raw: raw,
                wdir: closestMetar.wdir, 
                wspd: closestMetar.wspd,
                mslPressureHpa: mslPressureHpa,
                pressureProfile: pressureProfile,
                wxSource: 'metar'
            });
        }
    }

    return zones.length > 0 ? zones : null;
}

const VP_OM_PRESSURE_LEVELS = [1000, 925, 850, 700, 600, 500];
const VP_OM_LEVEL_DEFAULT_FT = {
    1000: 360,
    925: 2500,
    850: 5000,
    700: 10000,
    600: 14000,
    500: 18200
};
const VP_STD_MSL_PRESSURE_HPA = 1013.25;
const VP_OM_CACHE_TTL_MS = 30 * 60 * 1000;
const VP_OM_STALE_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
const VP_OM_COOLDOWN_MS = 15 * 60 * 1000;
const VP_OM_DAILY_LIMIT_STORAGE_KEY = 'ga_om_daily_limit_until_v1';
const VP_METAR_RECOVERY_PROBE_MS = 2 * 60 * 1000;
const VP_METAR_ROUTE_CACHE_TTL_MS = 30 * 60 * 1000;
const VP_METAR_ROUTE_CACHE_MAX = 24;
const VP_METAR_FAIL_COOLDOWN_MS = 4 * 60 * 1000;
const VP_METAR_FAIL_COOLDOWN_SOFT_MS = 45 * 1000;
const VP_METAR_CHUNK_CACHE_TTL_MS = 30 * 60 * 1000;
const VP_METAR_CHUNK_EMPTY_TTL_MS = 20 * 1000;
const VP_METAR_CHUNK_CACHE_MAX = 420;
const VP_METAR_PROXY_FAIL_COOLDOWN_MS = 30 * 1000;
const VP_METAR_PREFETCH_NEAR_NM = 80;
const VP_METAR_PREFETCH_FAR_NM = 150;
const VP_METAR_PREFETCH_CELL_DEG = 1.6;
const VP_METAR_PREFETCH_MAX_CHUNKS = 2;
const VP_METAR_PREFETCH_MIN_INTERVAL_MS = 3 * 60 * 1000;
const VP_OM_CACHE_STORAGE_KEY = 'ga_om_cache_v2';
const VP_OM_CACHE_MAX_ENTRIES = 900;
const VP_OM_COORD_STEP_BASE = 0.05;     // ~3 NM
const VP_OM_COORD_STEP_PRESS = 0.075;   // ~4-5 NM
const VP_HDG_WEATHER_CHUNK_CACHE_TTL_MS = 30 * 60 * 1000;
const VP_HDG_WEATHER_CHUNK_CACHE_MAX = 80;
const VP_HDG_WEATHER_COVERAGE_STEP_DEG = 0.25;
const VP_WEATHER_AUTO_FALLBACK_DEFAULT = true;
const vpOpenMeteoPointCache = new Map();
const vpOpenMeteoPointInFlight = new Map();
const vpMetarChunkCache = new Map();
const vpMetarProxyBackoff = new Map();
const vpMetarPrefetchInFlight = new Set();
const vpHdgWeatherChunkCache = new Map();
let vpOmCacheHydrated = false;
let vpOmCachePersistTimer = null;
const vpMetarRouteCache = new Map();
window.vpOpenMeteoDailyLimitUntil = Number(localStorage.getItem(VP_OM_DAILY_LIMIT_STORAGE_KEY) || 0);
window.vpWeatherFallbackActive = false;
window.vpWeatherFallbackMode = 'none'; // none | openmeteo_to_metar | metar_to_openmeteo
window.vpWeatherAutoFallbackFrom = null; // metar | null
window.vpWeatherFallbackSince = 0;
window.vpMetarRecoveryProbeAt = 0;
window.vpMetarDownUntil = Number(window.vpMetarDownUntil || 0);

window.vpWeatherDebug = window.vpWeatherDebug || {
    sessionStartedAt: Date.now(),
    openMeteoNetworkRequests: 0,
    elevationNetworkRequests: 0,
    openMeteoBatchCalls: 0,
    openMeteoBatchPoints: 0,
    openMeteoCacheHits: 0,
    openMeteoCacheMisses: 0,
    openMeteoStaleCacheHits: 0,
    openMeteoCooldownSkips: 0,
    cacheHydratedEntries: 0,
    cachePersistWrites: 0,
    cachePersistErrors: 0,
    profileRouteFetches: 0,
    mapOverlayFetches: 0,
    hdgFetches: 0,
    hdgSkippedNoAreaChange: 0,
    fallbackToMetarCount: 0,
    fallbackToOpenMeteoCount: 0,
    fallbackLastAt: 0,
    fallbackLastReason: '',
    elevationFallbackCount: 0,
    lastElevationFallbackAt: 0,
    lastElevationFallbackReason: '',
    openMeteoErrors: 0,
    lastErrorAt: 0,
    lastErrorMsg: '',
    openMeteo429Count: 0,
    last429At: 0,
    openMeteoDailyLimitCount: 0,
    openMeteoDailyLimitUntil: Number(window.vpOpenMeteoDailyLimitUntil || 0),
    elevation429Count: 0,
    lastElevation429At: 0,
    overpassRequests: 0,
    overpass429Count: 0,
    overpass504Count: 0,
    overpassCooldownSkips: 0,
    overpassRouteThrottleSkips: 0,
    overpassInFlightJoins: 0,
    hostedTileRequests: 0,
    hostedTileHits: 0,
    hostedTileCoreHits: 0,
    hostedTileLegacyHits: 0,
    hostedTileMisses: 0,
    hostedTileErrors: 0,
    overpassTileCoverageHits: 0,
    overpassTileCoverageMisses: 0,
    overpassTileCoverageEntries: 0,
    overpassTileLastMissingCount: 0,
    overpassTileLastMissingSample: '',
    overpassDeferredRuns: 0,
    overpassDeferredTilesTotal: 0,
    overpassLastDeferredCount: 0,
    globalErrors: 0,
    globalWarnings: 0,
    unhandledRejections: 0,
    lastGlobalErrorAt: 0,
    lastGlobalErrorMsg: '',
    debugHooksInstalled: false,
    lastSuccessAt: 0,
    lastElevationSuccessAt: 0,
    recentEvents: []
};

function vpWeatherDebugEvent(message) {
    const dbg = window.vpWeatherDebug;
    if (!dbg) return;
    const ts = Date.now();
    dbg.recentEvents.push({ ts, message: String(message || '') });
    if (dbg.recentEvents.length > 40) dbg.recentEvents = dbg.recentEvents.slice(-40);
}

function vpWeatherDebugSetError(err, context = '') {
    const dbg = window.vpWeatherDebug;
    if (!dbg) return;
    dbg.openMeteoErrors += 1;
    dbg.lastErrorAt = Date.now();
    const msg = err && (err.message || String(err));
    dbg.lastErrorMsg = context ? `${context}: ${msg}` : (msg || 'unbekannter Fehler');
    vpWeatherDebugEvent(`ERR ${dbg.lastErrorMsg}`);
}
window.vpWeatherDebugSetError = vpWeatherDebugSetError;

function vpBuildElevationRouteKey(routePts, precision = 4) {
    return (routePts || []).map(p => `${Number(p.lat || 0).toFixed(precision)},${Number((p.lng || p.lon) || 0).toFixed(precision)}`).join('|');
}

function vpGetStoredElevationCache(key, coarse = false) {
    try {
        const prefix = coarse ? 'ga_elev_cache_q3_' : 'ga_elev_cache_';
        const stored = localStorage.getItem(prefix + key);
        if (!stored) return null;
        const data = JSON.parse(stored);
        return Array.isArray(data) && data.length >= 2 ? data : null;
    } catch (_) {
        return null;
    }
}

function vpSetStoredElevationCache(key, data, coarse = false) {
    try {
        const prefix = coarse ? 'ga_elev_cache_q3_' : 'ga_elev_cache_';
        localStorage.setItem(prefix + key, JSON.stringify(data));
    } catch (_) { }
}

function vpIsElevationCoolingDown(now = Date.now()) {
    const last429 = Number(window.vpWeatherDebug?.lastElevation429At || 0);
    return last429 > 0 && (now - last429) < VP_ELEVATION_COOLDOWN_MS;
}

function vpRecordElevation429() {
    const dbg = window.vpWeatherDebug;
    if (!dbg) return;
    dbg.elevation429Count += 1;
    dbg.lastElevation429At = Date.now();
    vpWeatherDebugEvent('Elevation 429 rate limit');
}

function vpRecordElevationFallback(reason) {
    window.vpElevationFallbackActive = true;
    window.vpTerrainElevationSource = 'fallback';
    const dbg = window.vpWeatherDebug;
    if (!dbg) return;
    dbg.elevationFallbackCount += 1;
    dbg.lastElevationFallbackAt = Date.now();
    dbg.lastElevationFallbackReason = String(reason || 'fallback');
    vpWeatherDebugEvent(`terrain fallback -> ${dbg.lastElevationFallbackReason}`);
}

function vpPersistElevationResult(cacheKey, coarseKey, data, source = 'terrarium') {
    if (!Array.isArray(data) || data.length < 2) return data;
    const coarseMemKey = 'q3|' + coarseKey;
    vpElevationCache[cacheKey] = data;
    vpElevationCache[coarseMemKey] = data;
    vpSetStoredElevationCache(cacheKey, data, false);
    vpSetStoredElevationCache(coarseKey, data, true);
    window.vpElevationFallbackActive = false;
    window.vpTerrainElevationSource = source;
    if (window.vpWeatherDebug) window.vpWeatherDebug.lastElevationSuccessAt = Date.now();
    return data;
}

function vpGetTerrariumZoom() {
    return (typeof TAWS_TILE_ZOOM === 'number' && TAWS_TILE_ZOOM > 0) ? TAWS_TILE_ZOOM : 10;
}

function vpDecodeTerrariumFt(imageData, px, py) {
    if (!imageData || !imageData.data) return 0;
    const idx = (py * 256 + px) * 4;
    const r = imageData.data[idx];
    const g = imageData.data[idx + 1];
    const b = imageData.data[idx + 2];
    const elevM = (r * 256 + g + b / 256) - 32768;
    return Math.round(elevM * 3.28084);
}

async function vpFetchElevationFromTerrarium(samplePts, signal) {
    if (!Array.isArray(samplePts) || samplePts.length < 2) return null;
    if (typeof _tawsLatLonToPixel !== 'function' || typeof _tawsLoadTile !== 'function') return null;

    const zoom = vpGetTerrariumZoom();
    const tileMap = new Map();
    for (const p of samplePts) {
        if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const { tile } = _tawsLatLonToPixel(p.lat, p.lon, zoom);
        const key = `${zoom}/${tile.x}/${tile.y}`;
        if (!tileMap.has(key)) tileMap.set(key, { x: tile.x, y: tile.y });
    }

    const loads = [];
    tileMap.forEach((tile, key) => {
        loads.push(
            _tawsLoadTile(tile.x, tile.y, zoom)
                .then(imageData => { tileMap.set(key, { ...tile, imageData }); })
                .catch(() => { tileMap.set(key, { ...tile, imageData: null }); })
        );
    });
    await Promise.all(loads);
    if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const result = [];
    for (const p of samplePts) {
        const { tile, px, py } = _tawsLatLonToPixel(p.lat, p.lon, zoom);
        const key = `${zoom}/${tile.x}/${tile.y}`;
        const imageData = tileMap.get(key)?.imageData || null;
        if (!imageData) return null;
        result.push({
            distNM: p.distNM,
            elevFt: Math.max(0, vpDecodeTerrariumFt(imageData, px, py)),
            lat: p.lat,
            lon: p.lon
        });
    }
    return result;
}

function vpBuildInterpolatedRoutePoints(routePts) {
    const interpolated = [];
    let cumulativeDist = 0;

    for (let i = 0; i < routePts.length - 1; i++) {
        const p1 = routePts[i], p2 = routePts[i + 1];
        const lat1 = p1.lat, lon1 = p1.lng || p1.lon;
        const lat2 = p2.lat, lon2 = p2.lng || p2.lon;
        const segDist = calcNav(lat1, lon1, lat2, lon2).dist;
        const steps = Math.max(1, Math.round(segDist));

        for (let j = 0; j <= steps; j++) {
            if (i > 0 && j === 0) continue;
            const f = j / steps;
            interpolated.push({
                lat: lat1 + (lat2 - lat1) * f,
                lon: lon1 + (lon2 - lon1) * f,
                distNM: cumulativeDist + segDist * f
            });
        }
        cumulativeDist += segDist;
    }

    let samplePts = interpolated;
    if (interpolated.length > 100) {
        samplePts = [];
        for (let i = 0; i < 100; i++) {
            const idx = Math.round(i * (interpolated.length - 1) / 99);
            samplePts.push(interpolated[idx]);
        }
    }

    return { interpolated, samplePts };
}

function vpBuildApproxElevationProfile(interpolated) {
    if (!Array.isArray(interpolated) || interpolated.length < 2) return [];
    const totalDist = interpolated[interpolated.length - 1].distNM || 1;
    const depElevFt = Number.isFinite(currentDepElev) ? Number(currentDepElev) : 0;
    const destElevFt = Number.isFinite(currentDestElev) ? Number(currentDestElev) : depElevFt;

    return interpolated.map(p => {
        const t = totalDist > 0 ? (p.distNM / totalDist) : 0;
        const smoothBias = Math.sin(t * Math.PI) * 120;
        return {
            distNM: p.distNM,
            elevFt: Math.max(0, Math.round(depElevFt + ((destElevFt - depElevFt) * t) + smoothBias)),
            lat: p.lat,
            lon: p.lon
        };
    });
}

function vpIsOpenMeteoCoolingDown(now = Date.now()) {
    const dailyUntil = Number(window.vpOpenMeteoDailyLimitUntil || 0);
    if (dailyUntil > now) return true;
    const last429 = Number(window.vpWeatherDebug?.last429At || 0);
    return last429 > 0 && (now - last429) < VP_OM_COOLDOWN_MS;
}
window.vpIsOpenMeteoCoolingDown = vpIsOpenMeteoCoolingDown;

function vpNextUtcMidnightMs(now = Date.now()) {
    const d = new Date(now);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 10, 0);
}

function vpLooksLikeDailyOpenMeteoLimit(text) {
    return /daily\s+api\s+request\s+limit|try\s+again\s+tomorrow|daily\s+limit/i.test(String(text || ''));
}

function vpSetOpenMeteoDailyLimit(untilMs = vpNextUtcMidnightMs(), reason = 'daily limit') {
    const until = Math.max(Date.now() + VP_OM_COOLDOWN_MS, Number(untilMs || 0));
    window.vpOpenMeteoDailyLimitUntil = Math.max(Number(window.vpOpenMeteoDailyLimitUntil || 0), until);
    try { localStorage.setItem(VP_OM_DAILY_LIMIT_STORAGE_KEY, String(window.vpOpenMeteoDailyLimitUntil)); } catch (_) {}
    if (window.vpWeatherDebug) {
        window.vpWeatherDebug.openMeteoDailyLimitCount += 1;
        window.vpWeatherDebug.openMeteoDailyLimitUntil = window.vpOpenMeteoDailyLimitUntil;
        window.vpWeatherDebug.last429At = Date.now();
    }
    vpSetWeatherFallbackMode('openmeteo_to_metar', `openmeteo daily limit: ${reason}`);
    vpWeatherDebugEvent(`Open-Meteo daily limit until ${vpFormatDebugTs(window.vpOpenMeteoDailyLimitUntil)}`);
}

function vpRecordOpenMeteo429Text(text = '', context = '') {
    const dbg = window.vpWeatherDebug;
    if (dbg) {
        dbg.openMeteo429Count += 1;
        dbg.last429At = Date.now();
    }
    if (vpLooksLikeDailyOpenMeteoLimit(text)) {
        vpSetOpenMeteoDailyLimit(vpNextUtcMidnightMs(), context || text || '429');
    } else {
        vpWeatherDebugEvent(`Open-Meteo 429 rate limit${context ? ` (${context})` : ''}`);
    }
}

window.vpRecordOpenMeteo429FromResponse = async function(res, context = '') {
    let text = '';
    try { text = await res.clone().text(); } catch (_) {}
    vpRecordOpenMeteo429Text(text, context);
    return text;
};

window.vpIsOpenMeteoDailyLimited = function(now = Date.now()) {
    return Number(window.vpOpenMeteoDailyLimitUntil || 0) > now;
};

function vpIsOpenMeteoDisplayActive() {
    const fbMode = String(window.vpWeatherFallbackMode || 'none');
    if (fbMode === 'openmeteo_to_metar') return false;
    if (fbMode === 'metar_to_openmeteo') return !vpIsOpenMeteoCoolingDown();
    if (vpWeatherSource !== 'openmeteo') return false;
    return !vpIsOpenMeteoCoolingDown();
}
window.vpIsOpenMeteoDisplayActive = vpIsOpenMeteoDisplayActive;

function vpGetWeatherSourceCacheKey() {
    const src = window.vpWeatherSource || vpWeatherSource || 'metar';
    const mode = String(window.vpWeatherFallbackMode || 'none');
    return `${src}:${mode}`;
}

function vpIsWeatherAutoFallbackEnabled() {
    try {
        const raw = localStorage.getItem('ga_weather_auto_fallback');
        if (raw === null) return VP_WEATHER_AUTO_FALLBACK_DEFAULT;
        return raw === 'true' || raw === '1';
    } catch (_) {
        return VP_WEATHER_AUTO_FALLBACK_DEFAULT;
    }
}

function vpSetWeatherFallbackMode(mode, reason = '') {
    const normalized = (mode === 'openmeteo_to_metar' || mode === 'metar_to_openmeteo') ? mode : 'none';
    const prev = String(window.vpWeatherFallbackMode || 'none');
    window.vpWeatherFallbackMode = normalized;
    window.vpWeatherFallbackActive = normalized !== 'none';
    if (window.vpWeatherFallbackActive && (!Number.isFinite(window.vpWeatherFallbackSince) || window.vpWeatherFallbackSince <= 0)) {
        window.vpWeatherFallbackSince = Date.now();
    }
    if (!window.vpWeatherFallbackActive) {
        window.vpWeatherFallbackSince = 0;
        window.vpMetarRecoveryProbeAt = 0;
    }

    if (prev !== normalized && window.vpWeatherDebug) {
        const dbg = window.vpWeatherDebug;
        dbg.fallbackLastAt = Date.now();
        if (normalized === 'openmeteo_to_metar') dbg.fallbackToMetarCount += 1;
        if (normalized === 'metar_to_openmeteo') dbg.fallbackToOpenMeteoCount += 1;
    }
    if (reason && window.vpWeatherDebug) {
        window.vpWeatherDebug.fallbackLastAt = Date.now();
        window.vpWeatherDebug.fallbackLastReason = reason;
    }
    if (prev !== normalized || reason) {
        const suffix = reason ? ` (${reason})` : '';
        vpWeatherDebugEvent(`fallback mode -> ${normalized}${suffix}`);
        try { console.info(`[Wetter] Fallback-Modus: ${normalized}${suffix}`); } catch (_) {}
    }
}

function vpBuildMetarRouteCacheKey(routePts, elevData) {
    if (Array.isArray(elevData) && elevData.length >= 2) return `e3:${vpBuildElevationRouteKey(elevData, 3)}`;
    return `r3:${vpBuildElevationRouteKey(routePts || [], 3)}`;
}

function vpGetMetarRouteCache(routeKey, now = Date.now()) {
    if (!routeKey) return null;
    const entry = vpMetarRouteCache.get(routeKey);
    if (!entry || !Array.isArray(entry.data)) return null;
    if ((now - Number(entry.ts || 0)) > VP_METAR_ROUTE_CACHE_TTL_MS) {
        vpMetarRouteCache.delete(routeKey);
        return null;
    }
    return entry.data;
}

function vpSetMetarRouteCache(routeKey, data, now = Date.now()) {
    if (!routeKey || !Array.isArray(data) || data.length === 0) return;
    vpMetarRouteCache.set(routeKey, { ts: now, data });
    if (vpMetarRouteCache.size <= VP_METAR_ROUTE_CACHE_MAX) return;
    const oldest = Array.from(vpMetarRouteCache.entries())
        .sort((a, b) => Number((a[1] && a[1].ts) || 0) - Number((b[1] && b[1].ts) || 0))
        .slice(0, Math.max(1, vpMetarRouteCache.size - VP_METAR_ROUTE_CACHE_MAX));
    for (const [k] of oldest) vpMetarRouteCache.delete(k);
}

function vpMarkMetarFailure(reason = 'metar unavailable', cooldownMs = VP_METAR_FAIL_COOLDOWN_MS) {
    const cdMs = Math.max(10 * 1000, Number(cooldownMs || VP_METAR_FAIL_COOLDOWN_MS));
    const until = Date.now() + cdMs;
    window.vpMetarDownUntil = Math.max(Number(window.vpMetarDownUntil || 0), until);
    vpSetWeatherFallbackMode('metar_to_openmeteo', reason);
}

function vpClearMetarFailure() {
    window.vpMetarDownUntil = 0;
}

function vpIsMetarCoolingDown(now = Date.now()) {
    return Number(window.vpMetarDownUntil || 0) > now;
}

function vpHasUsableOpenMeteoRouteData(zones) {
    if (!Array.isArray(zones) || zones.length === 0) return false;
    return zones.some(z =>
        z &&
        Number.isFinite(Number(z.stnLat)) &&
        Number.isFinite(Number(z.stnLon)) &&
        (
            (Array.isArray(z.pressureProfile) && z.pressureProfile.length >= 1) ||
            Number.isFinite(Number(z.cloudTotalPct)) ||
            Number.isFinite(Number(z.wspd))
        )
    );
}

async function vpProbeMetarRecovery(routePts, elevData, signal) {
    if (!routePts || routePts.length < 2 || !elevData || elevData.length < 2) return false;
    try {
        const metar = await fetchRouteWeatherMetar(routePts, elevData, signal, { fastFail: true });
        return !!(Array.isArray(metar) && metar.length > 0);
    } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        return false;
    }
}

function vpInstallGlobalDebugHooks() {
    const dbg = window.vpWeatherDebug;
    if (!dbg || dbg.debugHooksInstalled) return;
    dbg.debugHooksInstalled = true;

    window.addEventListener('error', (ev) => {
        const msg = ev && (ev.message || (ev.error && ev.error.message)) || 'window error';
        dbg.globalErrors += 1;
        dbg.lastGlobalErrorAt = Date.now();
        dbg.lastGlobalErrorMsg = `error: ${msg}`;
        vpWeatherDebugEvent(`GLOBAL ERR ${msg}`);
    });

    window.addEventListener('unhandledrejection', (ev) => {
        const reason = ev && ev.reason;
        const msg = reason && (reason.message || String(reason)) || 'unhandled rejection';
        dbg.unhandledRejections += 1;
        dbg.lastGlobalErrorAt = Date.now();
        dbg.lastGlobalErrorMsg = `rejection: ${msg}`;
        vpWeatherDebugEvent(`UNHANDLED ${msg}`);
    });

    const origWarn = console.warn ? console.warn.bind(console) : null;
    const origError = console.error ? console.error.bind(console) : null;
    if (origWarn) {
        console.warn = function(...args) {
            try {
                dbg.globalWarnings += 1;
                const msg = args.map(a => {
                    if (typeof a === 'string') return a;
                    if (a && a.message) return a.message;
                    try { return JSON.stringify(a); } catch (_) { return String(a); }
                }).join(' ').slice(0, 220);
                vpWeatherDebugEvent(`WARN ${msg}`);
            } catch (_) {}
            return origWarn(...args);
        };
    }
    if (origError) {
        console.error = function(...args) {
            try {
                dbg.globalErrors += 1;
                const msg = args.map(a => {
                    if (typeof a === 'string') return a;
                    if (a && a.message) return a.message;
                    try { return JSON.stringify(a); } catch (_) { return String(a); }
                }).join(' ').slice(0, 260);
                dbg.lastGlobalErrorAt = Date.now();
                dbg.lastGlobalErrorMsg = msg;
                vpWeatherDebugEvent(`ERROR ${msg}`);
            } catch (_) {}
            return origError(...args);
        };
    }
}

function vpFormatDebugTs(ts) {
    if (!Number.isFinite(ts) || ts <= 0) return '-';
    try { return new Date(ts).toLocaleString(); } catch (_) { return String(ts); }
}

function vpApproxStorageBytes(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (raw.length * 2) : 0;
    } catch (_) {
        return 0;
    }
}

function vpApproxStorageBytesByPrefix(prefix) {
    let total = 0;
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || !k.startsWith(prefix)) continue;
            const raw = localStorage.getItem(k);
            if (raw) total += raw.length * 2;
        }
    } catch (_) { }
    return total;
}

function vpFormatBytes(bytes) {
    const b = Number(bytes || 0);
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function vpBuildDisplayDiagnosticsLines() {
    const fmt = (value, digits = 0) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '-';
    const fmtRect = (rect) => {
        if (!rect) return '-';
        return `${fmt(rect.width)}x${fmt(rect.height)} @ ${fmt(rect.left)},${fmt(rect.top)}`;
    };
    const media = (query) => {
        try { return window.matchMedia && window.matchMedia(query).matches ? '1' : '0'; } catch (_) { return '-'; }
    };
    const cssVar = (name) => {
        try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '-'; } catch (_) { return '-'; }
    };
    const storageValue = (key) => {
        try { return localStorage.getItem(key) || '-'; } catch (_) { return '-'; }
    };
    const rectOf = (selector) => {
        try {
            const node = document.querySelector(selector);
            return node ? node.getBoundingClientRect() : null;
        } catch (_) {
            return null;
        }
    };
    const vv = window.visualViewport || null;
    const dpr = Number(window.devicePixelRatio || 1);
    const innerW = Number(window.innerWidth || 0);
    const innerH = Number(window.innerHeight || 0);
    const visualW = Number(vv?.width || innerW);
    const visualH = Number(vv?.height || innerH);
    const ua = String(navigator.userAgent || '');
    const isQuest = /Quest|OculusBrowser|Meta Quest|VR/i.test(ua);
    const appScaleRaw = storageValue('ga_ui_scale_percent');
    const appScale = Number(appScaleRaw === '-' ? 100 : appScaleRaw);
    const cssPixelBudgetW = Math.round(visualW * dpr);
    const cssPixelBudgetH = Math.round(visualH * dpr);
    const layoutLabel = innerW < 740 ? 'phone-like' : (innerW < 1024 ? 'tablet-like' : 'desktop-like');
    const pixelLabel = cssPixelBudgetW < 1000 ? 'sehr niedrig' : (cssPixelBudgetW < 1500 ? 'niedrig' : (cssPixelBudgetW < 2200 ? 'mittel' : 'hoch'));
    const lines = [];
    lines.push('Display / Viewport Diagnose');
    lines.push(`- Zeitpunkt: ${vpFormatDebugTs(Date.now())}`);
    lines.push(`- Layout-Breite: ${layoutLabel} | inner=${fmt(innerW)}x${fmt(innerH)} CSS px | outer=${fmt(window.outerWidth)}x${fmt(window.outerHeight)}`);
    lines.push(`- VisualViewport: ${fmt(visualW, 1)}x${fmt(visualH, 1)} CSS px | scale=${fmt(vv?.scale, 3)} | offset=${fmt(vv?.offsetLeft, 1)},${fmt(vv?.offsetTop, 1)}`);
    lines.push(`- devicePixelRatio: ${fmt(dpr, 3)} | geschaetztes Pixelbudget=${cssPixelBudgetW}x${cssPixelBudgetH} (${pixelLabel})`);
    lines.push(`- Screen: ${fmt(screen.width)}x${fmt(screen.height)} CSS px | avail=${fmt(screen.availWidth)}x${fmt(screen.availHeight)} | orientation=${screen.orientation?.type || '-'} ${fmt(screen.orientation?.angle)}`);
    lines.push(`- Document: client=${fmt(document.documentElement.clientWidth)}x${fmt(document.documentElement.clientHeight)} | bodyZoom=${document.body?.style?.zoom || '-'} | --ga-ui-scale=${cssVar('--ga-ui-scale')} | savedScale=${appScaleRaw}`);
    lines.push(`- Elemente: container=${fmtRect(rectOf('.container'))} | map=${fmtRect(rectOf('#map'))} | settings=${fmtRect(rectOf('#settingsPanel'))}`);
    lines.push(`- Eingabe/Media: maxTouch=${navigator.maxTouchPoints || 0} | pointerCoarse=${media('(pointer: coarse)')} | hoverNone=${media('(hover: none)')} | standalone=${media('(display-mode: standalone)')}`);
    lines.push(`- Browser: ${ua.slice(0, 220) || '-'}`);
    const warnings = [];
    if (isQuest && innerW < 900) warnings.push('Quest meldet nur phone/tablet-artige CSS-Breite; Meta-Fenster wirkt vermutlich niedriger aufgeloest.');
    if (isQuest && dpr <= 1.15) warnings.push('Quest DPR ist nahe 1; es gibt wenig physische Pixel pro CSS-Pixel.');
    if (Number.isFinite(appScale) && appScale !== 100) warnings.push('Seitengroesse ist nicht 100%; CSS-Zoom kann vorhandene Pixel-Unschaerfe sichtbar verstaerken.');
    if (vv && Number.isFinite(Number(vv.scale)) && Math.abs(Number(vv.scale) - 1) > 0.02) warnings.push('VisualViewport ist skaliert; Browser/Page-Zoom ist aktiv.');
    if (warnings.length) {
        lines.push('- Hinweise:');
        warnings.forEach(w => lines.push(`  * ${w}`));
    } else {
        lines.push('- Hinweise: keine offensichtliche App-seitige Zusatzskalierung erkannt.');
    }
    lines.push('- Grenze: Eine Website kann das Meta-2D-Fenster groesser oder kleiner layouten, aber nicht erzwingen, dass Horizon OS mehr Pixel fuer dieses Fenster alloziert.');
    return lines;
}

window.vpBuildDisplayDiagnosticsReport = function() {
    return vpBuildDisplayDiagnosticsLines().join('\n');
};

window.vpBuildWeatherDebugReport = function() {
    vpHydrateObsTileCoverage();
    vpHydrateObsTileFailed();
    const dbg = window.vpWeatherDebug || {};
    const cacheTotal = vpOpenMeteoPointCache ? vpOpenMeteoPointCache.size : 0;
    const hit = Number(dbg.openMeteoCacheHits || 0);
    const miss = Number(dbg.openMeteoCacheMisses || 0);
    const hitRate = (hit + miss) > 0 ? ((hit / (hit + miss)) * 100).toFixed(1) : '0.0';
    const approxCalls = Number(dbg.openMeteoNetworkRequests || 0);
    const lines = [];
    const redactDebugSecrets = (value = '') => String(value || '')
        .replace(/([?&](?:key|api_key|apikey|token|access_token|auth|authorization)=)[^&\s"']+/ig, '$1[redacted]')
        .replace(/(AIza[0-9A-Za-z_-]{20,})/g, '[redacted-google-api-key]');
    const flattenText = (value, maxLen = 260) => redactDebugSecrets(String(value || '').replace(/\s+/g, ' ').trim()).slice(0, maxLen);
    const collectConsoleLogs = () => {
        if (typeof window.gaGetDebugLogs !== 'function') return [];
        try {
            const logs = window.gaGetDebugLogs();
            return Array.isArray(logs) ? logs : [];
        } catch (_) {
            return [];
        }
    };
    const isImportantConsoleLog = (entry) => {
        const level = String(entry?.level || '').toLowerCase();
        const msg = String(entry?.msg || '');
        return /error|warn|rejection|exception|failed|fail|invalid|fallback|mission|scene|dispatch|planner|gemini|target|ack|paxvoice|tts|textgen|fetch|gps|websocket/i.test(`${level} ${msg}`);
    };
    const isPriorityMissionConsoleLog = (entry) => {
        const level = String(entry?.level || '').toLowerCase();
        const msg = String(entry?.msg || '');
        const hay = `${level} ${msg}`;
        return /paxvoice|tts|textgen|\[fetch\]|fetch-(slow|error)|generativelanguage|websocketrelais|gps/.test(hay.toLowerCase());
    };
    lines.push(...vpBuildDisplayDiagnosticsLines());
    lines.push('');
    lines.push(`Session seit: ${vpFormatDebugTs(dbg.sessionStartedAt)}`);
    const fbMode = String(window.vpWeatherFallbackMode || 'none');
    const fbLabel = fbMode === 'openmeteo_to_metar'
        ? ' (Fallback METAR aktiv)'
        : (fbMode === 'metar_to_openmeteo' ? ' (Fallback OPEN-METEO aktiv)' : '');
    lines.push(`Quelle aktiv: ${(window.vpWeatherSource || 'metar').toUpperCase()}${fbLabel}`);
    lines.push(`Terrain Quelle: ${(window.vpTerrainElevationSource || 'terrarium').toUpperCase()}${window.vpElevationFallbackActive ? ' (Fallback aktiv)' : ''}`);
    lines.push(`Refresh Intervall: 30 min`);
    if (typeof window.gaPerfBaselineSummaryText === 'function') {
        lines.push('');
        try {
            lines.push(window.gaPerfBaselineSummaryText());
        } catch (err) {
            lines.push(`Performance Baseline: Debug-Fehler (${err?.message || err})`);
        }
    }
    if (typeof window.missionFollowupBuildDebugReport === 'function') {
        lines.push('');
        try {
            lines.push(window.missionFollowupBuildDebugReport());
        } catch (err) {
            lines.push(`Follow-up Requests: Debug-Fehler (${err?.message || err})`);
        }
    }
    lines.push('');
    lines.push('Wetter / Open-Meteo kurz');
    lines.push(`- Requests: OM ${approxCalls}, Elevation ${dbg.elevationNetworkRequests || 0}, Batches ${dbg.openMeteoBatchCalls || 0}/${dbg.openMeteoBatchPoints || 0} Punkte`);
    lines.push(`- Cache: Hit/Miss ${hit}/${miss} (${hitRate}%), RAM ${cacheTotal}/${VP_OM_CACHE_MAX_ENTRIES}, HDG ${vpHdgWeatherChunkCache.size}/${VP_HDG_WEATHER_CHUNK_CACHE_MAX}, METAR ${vpMetarChunkCache.size}/${VP_METAR_CHUNK_CACHE_MAX}`);
    lines.push(`- 429/Cooldown: OM ${dbg.openMeteo429Count || 0}${window.vpIsOpenMeteoDailyLimited && window.vpIsOpenMeteoDailyLimited() ? ` Tageslimit bis ${vpFormatDebugTs(Number(window.vpOpenMeteoDailyLimitUntil || 0))}` : ''}, Elevation ${dbg.elevation429Count || 0}, OM cooldown ${vpIsOpenMeteoCoolingDown() ? 'ja' : 'nein'}, METAR cooldown ${vpIsMetarCoolingDown() ? 'ja' : 'nein'}`);
    lines.push(`- Fallback: Modus ${fbMode}, zu METAR ${dbg.fallbackToMetarCount || 0}, zu OPEN-METEO ${dbg.fallbackToOpenMeteoCount || 0}, letzter ${vpFormatDebugTs(dbg.fallbackLastAt)}${dbg.fallbackLastReason ? ` (${dbg.fallbackLastReason})` : ''}`);
    lines.push(`- Letzter Wetterfehler: ${vpFormatDebugTs(dbg.lastErrorAt)}${dbg.lastErrorMsg ? ` (${dbg.lastErrorMsg})` : ''} | Erfolg ${vpFormatDebugTs(dbg.lastSuccessAt)}`);
    lines.push('');
    lines.push('OSM / Overpass kurz');
    const poiDbg = (window.gaPoiTileDebug && typeof window.gaPoiTileDebug === 'object') ? window.gaPoiTileDebug : {};
    lines.push(`- Overpass Requests: ${dbg.overpassRequests || 0}, 429/504 ${dbg.overpass429Count || 0}/${dbg.overpass504Count || 0}, Cooldown-Skips ${dbg.overpassCooldownSkips || 0}, Inflight-Joins ${dbg.overpassInFlightJoins || 0}`);
    lines.push(`- Hosted Tiles Req/Hit/Miss/Err: ${dbg.hostedTileRequests || 0}/${dbg.hostedTileHits || 0}/${dbg.hostedTileMisses || 0}/${dbg.hostedTileErrors || 0} | CORE split/legacy ${dbg.hostedTileCoreHits || 0}/${dbg.hostedTileLegacyHits || 0}`);
    lines.push(`- POI Tiles Req/Hit/Miss/Err: ${poiDbg.requests || 0}/${poiDbg.hits || 0}/${poiDbg.misses || 0}/${poiDbg.errors || 0} | split/legacy ${poiDbg.splitHits || 0}/${poiDbg.legacyHits || 0} | fallback ${poiDbg.fallbackHits || 0}${poiDbg.lastSource ? ` last=${poiDbg.lastSource}` : ''}`);
    lines.push(`- Tile Cache: coverage ${vpObsTileCoverage.size}, failed ${vpObsTileFailed.size}, POI RAM ${poiDbg.cacheEntries || 0}, route-guard skips ${dbg.overpassRouteThrottleSkips || 0}`);
    if (vpObsTileFailed.size > 0) {
        const sample = Array.from(vpObsTileFailed.entries())
            .sort((a, b) => Number((b[1] && b[1].ts) || 0) - Number((a[1] && a[1].ts) || 0))
            .slice(0, 6)
            .map(([k, v]) => `${k}${v && v.status ? `:${v.status}` : ''}`)
            .join(', ');
        lines.push(`- Failed Sample: ${sample}`);
    }
    lines.push(`- Tile-Cache Hit/Miss: ${dbg.overpassTileCoverageHits || 0}/${dbg.overpassTileCoverageMisses || 0}`);
    lines.push(`- Deferred Tiles: ${dbg.overpassLastDeferredCount || 0} (Runs: ${dbg.overpassDeferredRuns || 0}, Summe: ${dbg.overpassDeferredTilesTotal || 0})`);
    lines.push(`- Letzter Tile-Miss: ${dbg.overpassTileLastMissingCount || 0}${dbg.overpassTileLastMissingSample ? ` (${dbg.overpassTileLastMissingSample})` : ''}`);
    lines.push(`- Tiles Overlay (Karte): ${window.vpObsTileOverlayEnabled ? 'An' : 'Aus'}`);
    const srcCounter = {};
    for (const meta of vpObsTileCoverage.values()) {
        const src = String((meta && meta.src) || 'unknown');
        srcCounter[src] = (srcCounter[src] || 0) + 1;
    }
    const srcSummary = Object.keys(srcCounter)
        .sort((a, b) => srcCounter[b] - srcCounter[a])
        .slice(0, 4)
        .map(k => `${k}:${srcCounter[k]}`)
        .join(' | ');
    lines.push(`- Tile-Quellen: ${srcSummary || '-'}`);
    const overpassCdRem = Math.ceil(vpGetOverpassCooldownRemainingMs() / 1000);
    lines.push(`- Overpass Cooldown aktiv: ${vpIsOverpassCoolingDown() ? `Ja (${overpassCdRem}s)` : 'Nein'}`);
    const rollingPoolBytes = vpApproxStorageBytes(VP_OBS_POOL_STORAGE_KEY);
    const rollingTileBytes = vpApproxStorageBytes(VP_OBS_TILE_COVERAGE_KEY);
    const rollingFailBytes = vpApproxStorageBytes(VP_OBS_TILE_FAILED_KEY);
    const rollingComboBytes = vpApproxStorageBytesByPrefix(VP_OBS_COMBO_PREFIX);
    const rollingComboCount = vpListObsComboKeys().length;
    const rollingTotalBytes = rollingPoolBytes + rollingTileBytes + rollingFailBytes;
    lines.push(`- Rolling Cache Größe: ${vpFormatBytes(rollingTotalBytes)} (Pool ${vpFormatBytes(rollingPoolBytes)}, Tiles ${vpFormatBytes(rollingTileBytes)}, Failed ${vpFormatBytes(rollingFailBytes)})`);
    lines.push(`- Route-Cache (ga_obs_combo_*): ${rollingComboCount} Einträge, ${vpFormatBytes(rollingComboBytes)}`);
    lines.push('');
    lines.push('Allgemeine App-Fehler');
    lines.push(`- Global Errors: ${dbg.globalErrors || 0}`);
    lines.push(`- Global Warnings: ${dbg.globalWarnings || 0}`);
    lines.push(`- Unhandled Rejections: ${dbg.unhandledRejections || 0}`);
    lines.push(`- Letzter globaler Fehler: ${vpFormatDebugTs(dbg.lastGlobalErrorAt)}${dbg.lastGlobalErrorMsg ? ` (${dbg.lastGlobalErrorMsg})` : ''}`);
    lines.push('');
    lines.push('Mission Snapshot');
    let missionSnap = window.vpMissionDebugSnapshot || null;
    if (!missionSnap) {
        try { missionSnap = JSON.parse(localStorage.getItem('ga_mission_debug_snapshot') || 'null'); } catch (_) { missionSnap = null; }
    }
    if (!missionSnap) {
        lines.push('- (keine aktive Mission oder noch kein Snapshot)');
    } else {
        const p = missionSnap.passenger || {};
        lines.push(`- Zeit: ${vpFormatDebugTs(missionSnap.ts)}`);
        lines.push(`- Modus/Kategorie: ${missionSnap.mode || '?'} / ${missionSnap.category || '?'}`);
        if (missionSnap.requestedCategory) lines.push(`- Gewählt: ${missionSnap.requestedCategory}`);
        lines.push(`- Mission: ${missionSnap.mission || 'n/a'}`);
        lines.push(`- Ziel: ${missionSnap.target || 'n/a'}`);
        if (missionSnap.targetCoords) lines.push(`- Ziel-Koordinaten: ${missionSnap.targetCoords}`);
        const truth = missionSnap.missionTruth || missionSnap.contract?.missionTruth || null;
        if (truth?.mainTarget) {
            const mt = truth.mainTarget;
            const mtPos = (Number.isFinite(Number(mt.lat)) && Number.isFinite(Number(mt.lon)))
                ? `${Number(mt.lat).toFixed(5)}, ${Number(mt.lon).toFixed(5)}`
                : '-';
            lines.push(`- Main Target: ${mt.name || '-'} | ${mt.kind || '-'} | ${mtPos} | Δ=${Number.isFinite(Number(mt.distanceFromPoiM)) ? Math.round(Number(mt.distanceFromPoiM)) : 0}m`);
        }
        if (truth?.sceneAnchor) {
            const sa = truth.sceneAnchor;
            const saPos = (Number.isFinite(Number(sa.lat)) && Number.isFinite(Number(sa.lon)))
                ? `${Number(sa.lat).toFixed(5)}, ${Number(sa.lon).toFixed(5)}`
                : '-';
            const cues = Array.isArray(truth.visibleCues) && truth.visibleCues.length ? ` | cues=${truth.visibleCues.join(', ')}` : '';
            lines.push(`- Scene Anchor: ${sa.kind || '-'} | ${saPos} | reason=${sa.reason || '-'}${cues}`);
        }
        const aptArrival = missionSnap.aptArrivalPlan || missionSnap.contract?.aptArrivalPlan || truth?.arrivalScene || null;
        if (aptArrival) {
            const pos = (Number.isFinite(Number(aptArrival.lat)) && Number.isFinite(Number(aptArrival.lon)))
                ? `${Number(aptArrival.lat).toFixed(5)}, ${Number(aptArrival.lon).toFixed(5)}`
                : '-';
            const conf = Number.isFinite(Number(aptArrival.confidence)) ? Number(aptArrival.confidence).toFixed(2) : '-';
            const itemCount = Array.isArray(aptArrival.items) ? aptArrival.items.length : 0;
            lines.push(`- APT Arrival Plan: ${aptArrival.roleLabel || aptArrival.role || '-'} | ${aptArrival.anchorType || '-'} | ${pos} | source=${aptArrival.source || '-'} | conf=${conf} | items=${itemCount}`);
            if (aptArrival.expectedBy || aptArrival.visibleCue) {
                lines.push(`- APT Erwartung: ${aptArrival.expectedBy || '-'} | cue=${aptArrival.visibleCue || '-'}`);
            }
        }
        lines.push(`- Quelle: ${missionSnap.source || 'n/a'}`);
        const aiUsage = missionSnap.aiUsage && typeof missionSnap.aiUsage === 'object' ? missionSnap.aiUsage : null;
        if (aiUsage && Number.isFinite(Number(aiUsage.calls)) && Number(aiUsage.calls) > 0) {
            const promptTokens = Number(aiUsage.promptTokens || 0);
            const completionTokens = Number(aiUsage.completionTokens || 0);
            const totalTokens = Number(aiUsage.totalTokens || 0);
            const tokenBits = [
                `calls=${Number(aiUsage.calls)}`,
                Number(aiUsage.openaiTextCalls || 0) ? `openai=${Number(aiUsage.openaiTextCalls)}` : '',
                totalTokens ? `tokens=${totalTokens}` : '',
                promptTokens || completionTokens ? `in/out=${promptTokens}/${completionTokens}` : '',
                Number(aiUsage.cachedTokens || 0) ? `cached=${Number(aiUsage.cachedTokens)}` : '',
                Number(aiUsage.reasoningTokens || 0) ? `reasoning=${Number(aiUsage.reasoningTokens)}` : ''
            ].filter(Boolean);
            lines.push(`- AI Usage: ${tokenBits.join(' | ')} | Kosten: Tokenbasis, kein Rechnungsbetrag in API-Antwort`);
            const modelBits = Object.entries(aiUsage.models || {})
                .map(([model, count]) => `${flattenText(model, 36)}×${count}`)
                .slice(0, 6);
            if (modelBits.length) lines.push(`- AI Usage Modelle: ${modelBits.join(' | ')}`);
            const eventBits = (Array.isArray(aiUsage.events) ? aiUsage.events : [])
                .slice(0, 6)
                .map(event => {
                    const usage = event?.usage || {};
                    const total = Number(usage.totalTokens || 0);
                    const status = event?.status && event.status !== 'ok' ? `/${event.status}` : '';
                    return `${flattenText(event?.promptVersion || '-', 28)}:${flattenText(event?.model || '-', 24)}${status}${total ? ` ${total}t` : ''}`;
                });
            if (eventBits.length) lines.push(`- AI Usage Calls: ${eventBits.join(' | ')}`);
        }
        if (missionSnap.poiSource) lines.push(`- POI-Fundquelle: ${missionSnap.poiSource}`);
        if (missionSnap.poiLookup && typeof missionSnap.poiLookup === 'object') {
            const lk = missionSnap.poiLookup;
            const srcBits = [];
            if (lk.engine) srcBits.push(String(lk.engine));
            if (lk.lastSource) srcBits.push(`last=${String(lk.lastSource)}`);
            if (typeof lk.includeCore === 'boolean') srcBits.push(`core=${lk.includeCore ? 'on' : 'off'}`);
            if (Number.isFinite(Number(lk.tileKeys))) srcBits.push(`tiles=${Number(lk.tileKeys)}`);
            if (Number.isFinite(Number(lk.features))) srcBits.push(`features=${Number(lk.features)}`);
            if (Number.isFinite(Number(lk.candidates))) srcBits.push(`candidates=${Number(lk.candidates)}`);
            if (Number.isFinite(Number(lk.requestsDelta))) srcBits.push(`reqΔ=${Number(lk.requestsDelta)}`);
            if (Number.isFinite(Number(lk.splitHitsDelta))) srcBits.push(`splitΔ=${Number(lk.splitHitsDelta)}`);
            if (Number.isFinite(Number(lk.legacyHitsDelta))) srcBits.push(`legacyΔ=${Number(lk.legacyHitsDelta)}`);
            if (Number.isFinite(Number(lk.fallbackHitsDelta))) srcBits.push(`fallbackΔ=${Number(lk.fallbackHitsDelta)}`);
            if (Number.isFinite(Number(lk.errorsDelta))) srcBits.push(`errΔ=${Number(lk.errorsDelta)}`);
            if (lk.featureSourceKind) srcBits.push(`featSrc=${String(lk.featureSourceKind)}`);
            if (lk.featureLayer) srcBits.push(`featLayer=${String(lk.featureLayer)}`);
            lines.push(`- POI-Lookup: ${srcBits.join(' | ')}`);
        }
        lines.push(`- Picker-Profil: ${missionSnap.profile || 'auto'} | Aktiv: ${missionSnap.appliedProfile || 'auto'}`);
        const pipelineMode = String(missionSnap.missionPipelineMode || (window.getMissionPipelineMode ? window.getMissionPipelineMode() : (window.isMissionPipelineV2Enabled?.() ? 'v2' : 'v3'))).toUpperCase();
        lines.push(`- Mission Pipeline: ${pipelineMode}`);
        const writerMode = String(missionSnap.missionWriterMode || (window.getMissionWriterMode ? window.getMissionWriterMode() : '') || '').toUpperCase();
        if (writerMode) lines.push(`- Mission Writer: ${writerMode}`);
        const poiChainDebug = (window.gaPoiChainDebug && typeof window.gaPoiChainDebug === 'object') ? window.gaPoiChainDebug : {};
        const poiChainForce = typeof window.getPoiChainDebugForceValue === 'function' ? window.getPoiChainDebugForceValue() : '';
        const poiChainSpec = missionSnap.poiChain || missionSnap.contract?.poiChain || null;
        if (poiChainForce || poiChainDebug.last || poiChainSpec) {
            const chainBits = [`Force=${poiChainForce || 'aus'}`];
            if (poiChainSpec?.label) chainBits.push(`Mission=${flattenText(poiChainSpec.label, 70)}`);
            if (Number.isFinite(Number(poiChainSpec?.points?.length))) chainBits.push(`Punkte=${Number(poiChainSpec.points.length)}`);
            const last = poiChainDebug.last || null;
            if (last && typeof last === 'object') {
                if (last.ok) {
                    chainBits.push(`last=ok`);
                    if (last.theme) chainBits.push(`theme=${String(last.theme)}`);
                    if (Number.isFinite(Number(last.points))) chainBits.push(`found=${Number(last.points)}`);
                } else {
                    chainBits.push(`last=${last.status || 'no_chain'}`);
                    if (last.forced) chainBits.push('forced=yes');
                }
                if (Number.isFinite(Number(last.tileKeys))) chainBits.push(`tiles=${Number(last.tileKeys)}`);
                if (Number.isFinite(Number(last.features))) chainBits.push(`features=${Number(last.features)}`);
                if (Number.isFinite(Number(last.fetchMs))) chainBits.push(`fetch=${Math.round(Number(last.fetchMs))}ms`);
                if (Number.isFinite(Number(last.buildMs))) chainBits.push(`build=${Math.round(Number(last.buildMs))}ms`);
                if (Number.isFinite(Number(last.totalMs))) chainBits.push(`total=${Math.round(Number(last.totalMs))}ms`);
            }
            lines.push(`- POI-Ketten-Debug: ${chainBits.join(' | ')}`);
            const chainDetail = missionSnap.poiChainDebug || null;
            if (chainDetail && typeof chainDetail === 'object') {
                const guide = chainDetail.guide || {};
                const overlay = chainDetail.overlay || {};
                const trace = overlay.trace || {};
                const route = chainDetail.routeWaypoints || {};
                const guideBits = [];
                if (guide.name) guideBits.push(`guide=${flattenText(guide.name, 70)}`);
                if (guide.groupKey) guideBits.push(`group=${flattenText(guide.groupKey, 80)}`);
                if (Number.isFinite(Number(guide.guidePointCount))) guideBits.push(`guidePts=${Number(guide.guidePointCount)}`);
                if (Number.isFinite(Number(trace.count))) guideBits.push(`tracePts=${Number(trace.count)}`);
                if (Number.isFinite(Number(overlay.widthNm))) guideBits.push(`width=${Number(overlay.widthNm)}NM`);
                if (Number.isFinite(Number(route.count))) guideBits.push(`routeWpt=${Number(route.count)}`);
                if (guideBits.length) lines.push(`- POI-Ketten-Geometrie: ${guideBits.join(' | ')}`);
                const pointSummary = Array.isArray(chainDetail.points)
                    ? chainDetail.points.slice(0, 8).map(point => {
                        const order = Number.isFinite(Number(point.orderT)) ? `t=${Number(point.orderT)}` : 't=-';
                        const xtrk = Number.isFinite(Number(point.distCorridorNm)) ? `x=${Number(point.distCorridorNm)}NM` : 'x=-';
                        const prev = Number.isFinite(Number(point.distanceFromPrevNm)) ? `prev=${Number(point.distanceFromPrevNm)}NM` : 'prev=-';
                        const pos = (Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)))
                            ? `${Number(point.lat).toFixed(5)},${Number(point.lon).toFixed(5)}`
                            : '-';
                        return `${Number(point.index || 0) + 1}:${flattenText(point.name || '-', 36)}[${order},${xtrk},${prev}]@${pos}`;
                    }).join(' | ')
                    : '';
                if (pointSummary) lines.push(`- POI-Ketten-Punkte: ${pointSummary}`);
                if (Array.isArray(trace.first) && trace.first.length) {
                    const firstTrace = trace.first.map(point => `${Number(point.lat).toFixed(5)},${Number(point.lon).toFixed(5)}`).join(' > ');
                    const lastTrace = Array.isArray(trace.last) && trace.last.length
                        ? trace.last.map(point => `${Number(point.lat).toFixed(5)},${Number(point.lon).toFixed(5)}`).join(' > ')
                        : '';
                    lines.push(`- POI-Ketten-Trace: start ${firstTrace}${lastTrace ? ` | ende ${lastTrace}` : ''}`);
                }
            }
        }
        const planV2 = missionSnap.missionPlanV2 || missionSnap.contract?.missionPlanV2 || (missionSnap.restored ? null : window.gaMissionPipelineV2Last) || null;
        if (planV2 && typeof planV2 === 'object') {
            const p2 = planV2.plan || {};
            const needTypes = Array.isArray(planV2.needs) ? planV2.needs.map(n => n.type || '?').join(',') : '-';
            const resolvedTypes = planV2.resolvedNeeds && typeof planV2.resolvedNeeds === 'object' ? Object.keys(planV2.resolvedNeeds).join(',') : '-';
            const planVersion = String(planV2.pipelineVersion || '');
            const planLabel = planVersion.includes('mission-v4')
                ? 'Pipeline V4 Plan'
                : (planVersion.includes('mission-v3')
                    ? 'Pipeline V3'
                    : (pipelineMode === 'V4' && planV2.debug?.v4DirectFallback
                        ? 'Pipeline V2 Fallback-Plan'
                        : 'Pipeline V2'));
            lines.push(`- ${planLabel} Status: ${planV2.status || '-'} | needs=${needTypes || '-'} | resolved=${resolvedTypes || '-'}`);
            if (planV2.debug?.v4DirectFallback) {
                const directBits = [
                    `direct=${planV2.debug.v4DirectStatus || 'unknown'}`,
                    planV2.debug.v4DirectParseMode ? `parse=${planV2.debug.v4DirectParseMode}` : '',
                    planV2.debug.v4DirectSource ? `source=${planV2.debug.v4DirectSource}` : '',
                    planV2.debug.v4DirectError ? `error=${flattenText(planV2.debug.v4DirectError, 180)}` : ''
                ].filter(Boolean);
                lines.push(`- V4 Planner Fallback: ${directBits.join(' | ')}`);
            }
            if (p2.primaryObjective) lines.push(`- ${planLabel} Plan: ${p2.taskDomain || '-'} | ${p2.sceneKind || '-'} | ${String(p2.primaryObjective).replace(/\s+/g, ' ').slice(0, 180)}`);
            if (Array.isArray(p2.objectFamilies) && p2.objectFamilies.length) lines.push(`- ${planLabel} Objekte: ${p2.objectFamilies.slice(0, 8).join(', ')}`);
            if (p2.placementPolicy) lines.push(`- ${planLabel} Platzierung: ${flattenText(p2.placementPolicy, 220)}`);
            if (Array.isArray(p2.localFacts) && p2.localFacts.length) lines.push(`- ${planLabel} Fakten: ${p2.localFacts.slice(0, 4).join(' | ')}`);
            if (Array.isArray(p2.weatherHooks) && p2.weatherHooks.length) lines.push(`- ${planLabel} Wetter: ${p2.weatherHooks.slice(0, 3).join(' | ')}`);
            if (Array.isArray(p2.mustMention) && p2.mustMention.length) lines.push(`- ${planLabel} Muss nennen: ${p2.mustMention.slice(0, 5).join(' | ')}`);
            if (Array.isArray(p2.mustAvoid) && p2.mustAvoid.length) lines.push(`- ${planLabel} Vermeiden: ${p2.mustAvoid.slice(0, 5).join(' | ')}`);
            if (p2.realismBrief) lines.push(`- ${planLabel} Realismus: ${String(p2.realismBrief).replace(/\s+/g, ' ').slice(0, 180)}`);
            if (Array.isArray(planV2.debug?.toolCalls) && planV2.debug.toolCalls.length) lines.push(`- ${planLabel} Tools: ${planV2.debug.toolCalls.map(c => c.name || '?').slice(0, 6).join(', ')}`);
            if (planV2.debug?.fallbackError) lines.push(`- ${planLabel} Fallback-Fehler: ${flattenText(planV2.debug.fallbackError, 220)}`);
        }
        if (missionSnap.contract?.summary) lines.push(`- Contract: ${missionSnap.contract.summary}`);
        lines.push(`- PAX/Cargo: ${missionSnap.paxText || 'n/a'} | ${missionSnap.cargoText || 'n/a'}`);
        lines.push(`- Passenger: ${p.name || '?'} (${p.role || '?'}) | gender=${p.gender || 'n/a'}`);
        lines.push(`- Role/Task: ${p.roleProfile || 'general_passenger_v1'} | ${p.taskDomain || 'general'}`);
        lines.push(`- Toleranzen: g=${p.gTolerance || 'mittel'} | bank=${p.bankTolerance || 'mittel'}`);
        lines.push(`- Sensitivität: cargo=${p.cargoSensitivity || 'mittel'} | magen=${p.stomachSensitivity || 'mittel'} | comfortPriority=${p.comfortPriority || 'mittel'} | urgency=${p.urgencyPriority || 'mittel'}`);
        lines.push(`- POI-Parameter: alt=${Number(p.targetAltFt || 0)} ft | radius=${Number(p.targetRadiusNm || 0)} NM | dwell=${Number(p.targetDwellMin || 0)} min`);
        if (missionSnap.story) lines.push(`- Story: ${String(missionSnap.story).replace(/\s+/g, ' ').trim()}`);
        if (missionSnap.storyDebug && typeof missionSnap.storyDebug === 'object') {
            const sd = missionSnap.storyDebug;
            const storyBits = [];
            if (sd.source) storyBits.push(`source=${String(sd.source)}`);
            if (sd.writerMode) storyBits.push(`mode=${String(sd.writerMode).toUpperCase()}`);
            if (sd.stage) storyBits.push(`stage=${String(sd.stage)}`);
            if (Number.isFinite(Number(sd.rawStoryLength))) storyBits.push(`raw=${Number(sd.rawStoryLength)}`);
            if (Number.isFinite(Number(sd.writerLength))) storyBits.push(`writer=${Number(sd.writerLength)}`);
            if (Number.isFinite(Number(sd.preparedLength))) storyBits.push(`prepared=${Number(sd.preparedLength)}`);
            if (Number.isFinite(Number(sd.fallbackLength))) storyBits.push(`fallback=${Number(sd.fallbackLength)}`);
            if (typeof sd.storyChangedByFinalize === 'boolean') storyBits.push(`finalizeChanged=${sd.storyChangedByFinalize ? 'ja' : 'nein'}`);
            if (typeof sd.endpointNoteAdded === 'boolean') storyBits.push(`endpointNote=${sd.endpointNoteAdded ? 'ja' : 'nein'}`);
            if (typeof sd.passengerNoteAdded === 'boolean') storyBits.push(`paxNote=${sd.passengerNoteAdded ? 'ja' : 'nein'}`);
            if (typeof sd.writerComplete === 'boolean') storyBits.push(`complete=${sd.writerComplete ? 'ja' : 'nein'}`);
            if (typeof sd.writerUsable === 'boolean') storyBits.push(`usable=${sd.writerUsable ? 'ja' : 'nein'}`);
            if (typeof sd.writerAccepted === 'boolean') storyBits.push(`accepted=${sd.writerAccepted ? 'ja' : 'nein'}`);
            if (sd.fallbackReason) storyBits.push(`fallback=${String(sd.fallbackReason)}`);
            if (typeof sd.finalLooksEnumerative === 'boolean') storyBits.push(`enumerativ=${sd.finalLooksEnumerative ? 'ja' : 'nein'}`);
            if (Number.isFinite(Number(sd.finalSentenceCount))) storyBits.push(`sentences=${Number(sd.finalSentenceCount)}`);
            if (storyBits.length) lines.push(`- Story-Debug: ${storyBits.join(' | ')}`);
        }
        const textPassenger = (window.activePassenger && typeof window.activePassenger === 'object')
            ? window.activePassenger
            : (missionSnap.contract?.passenger || missionSnap.contract?.missionPassenger || {});
        if (textPassenger?.greetingText) lines.push(`- Greeting Text: ${flattenText(textPassenger.greetingText, 420)}`);
        if (textPassenger?.enrouteText) lines.push(`- Enroute Text: ${flattenText(textPassenger.enrouteText, 360)}`);
        if (textPassenger?.arrivalText || textPassenger?.farewellText) lines.push(`- Arrival/Farewell Text: ${flattenText(textPassenger.arrivalText || textPassenger.farewellText, 360)}`);
        const sceneIntent = missionSnap.sceneIntent || missionSnap.contract?.sceneIntent || missionSnap.targetSceneDebug?.sceneIntent || null;
        if (sceneIntent && typeof sceneIntent === 'object') {
            if (sceneIntent.summary) lines.push(`- SceneIntent Summary: ${flattenText(sceneIntent.summary, 360)}`);
            if (sceneIntent.environment) lines.push(`- SceneIntent Umgebung: ${flattenText(sceneIntent.environment, 260)}`);
            if (Array.isArray(sceneIntent.visibleIdeas) && sceneIntent.visibleIdeas.length) lines.push(`- SceneIntent Sichtbar: ${sceneIntent.visibleIdeas.slice(0, 8).map(v => flattenText(v, 80)).join(' | ')}`);
            if (sceneIntent.notes) lines.push(`- SceneIntent Notes: ${flattenText(sceneIntent.notes, 260)}`);
        } else if (typeof sceneIntent === 'string' && sceneIntent.trim()) {
            lines.push(`- SceneIntent Text: ${flattenText(sceneIntent, 420)}`);
        }
        const geoCtx = missionSnap.targetGeoContext || missionSnap.contract?.targetGeoContext || null;
        if (geoCtx && typeof geoCtx === 'object') {
            const geoBits = [];
            if (geoCtx.geometryMode) geoBits.push(`mode=${geoCtx.geometryMode}`);
            if (geoCtx.primaryKind) geoBits.push(`kind=${geoCtx.primaryKind}`);
            if (geoCtx.source) geoBits.push(`source=${geoCtx.source}`);
            if (Number.isFinite(Number(geoCtx.confidence))) geoBits.push(`conf=${Number(geoCtx.confidence).toFixed(2)}`);
            if (Array.isArray(geoCtx.visualLandmarks) && geoCtx.visualLandmarks.length) geoBits.push(`landmarks=${geoCtx.visualLandmarks.slice(0, 4).map(x => x?.name || x?.kind || x).join(',')}`);
            if (geoBits.length) lines.push(`- TargetGeoContext: ${geoBits.join(' | ')}`);
            if (geoCtx.anchors && typeof geoCtx.anchors === 'object') {
                const anchorSummary = Object.entries(geoCtx.anchors)
                    .filter(([, a]) => a?.present)
                    .sort((a, b) => Number(a[1]?.distM || 999999) - Number(b[1]?.distM || 999999))
                    .slice(0, 8)
                    .map(([k, a]) => `${k}:${Math.round(Number(a.distM) || 0)}m/${Math.round(Number(a.bearingDeg) || 0)}deg${a.name ? `:${flattenText(a.name, 34)}` : ''}`)
                    .join(' | ');
                if (anchorSummary) lines.push(`- TargetGeoContext Anchors: ${anchorSummary}`);
            }
        }
        if (missionSnap.narrativeGuard) lines.push(`- Narrative Guard: ${flattenText(JSON.stringify(missionSnap.narrativeGuard), 420)}`);
    }
    lines.push('');
    lines.push('Mission Scene Debug');
    const sceneDbg = (window.gaMissionSceneDebug && typeof window.gaMissionSceneDebug === 'object') ? window.gaMissionSceneDebug : {};
    const missionSceneDbg = missionSnap?.targetSceneDebug || {};
    const aiRequested = sceneDbg.aiRequested || missionSceneDbg.aiRequested || null;
    const aiNormalized = sceneDbg.aiNormalized || missionSceneDbg.aiNormalized || null;
    const contractTargetScene = sceneDbg.contractTargetScene || missionSceneDbg.contractTargetScene || missionSnap?.targetScene || null;
    const sceneTruth = sceneDbg.missionTruth || missionSnap?.missionTruth || missionSnap?.contract?.missionTruth || null;
    const sceneComposer = sceneDbg.sceneComposer || missionSnap?.targetSceneComposerDebug || null;
    const targetCommandHasMapPoints = Array.isArray(sceneDbg.lastTargetSceneCommand?.mapPoints) && sceneDbg.lastTargetSceneCommand.mapPoints.length > 0;
    const targetPreview = (!targetCommandHasMapPoints && typeof window.missionTargetSceneDebugPreview === 'function')
        ? window.missionTargetSceneDebugPreview('debug-report-preview')
        : null;
    const startEndPreview = (typeof window.missionStartEndSceneDebugPreview === 'function')
        ? window.missionStartEndSceneDebugPreview('debug-report-preview')
        : null;
    const aptArrivalPreview = (typeof window.missionAptArrivalDebugPreview === 'function')
        ? window.missionAptArrivalDebugPreview('debug-report-preview')
        : null;
    const appResolved = sceneDbg.appResolvedTargetScene || targetPreview?.appResolved || null;
    const appResolvedAptArrival = sceneDbg.appResolvedAptArrivalScene || null;
    const lastTargetCommand = sceneDbg.lastTargetSceneCommand || null;
    const lastAptArrivalCommand = sceneDbg.lastAptArrivalSceneCommand || null;
    const previewTargetCommand = targetPreview?.command || null;
    const plannedStartCommand = startEndPreview?.start || null;
    const plannedEndCommand = startEndPreview?.end || null;
    const plannedAptArrivalCommand = aptArrivalPreview?.command || null;
    const lastStartCommand = sceneDbg.lastStartSceneCommand || null;
    const lastEndCommand = sceneDbg.lastEndSceneCommand || null;
    const lastSmokeCommand = sceneDbg.lastSmokeCommand || null;
    const lastAck = sceneDbg.lastAck || window.missionAptArrivalSceneStatus?.lastAck || window.missionTargetSceneStatus?.lastAck || window.missionSceneStatus?.lastAck || null;
    const sceneAccepted = sceneDbg.sceneAccepted ?? missionSnap?.sceneAccepted ?? null;
    const sceneStatus = sceneDbg.sceneCompositionStatus || missionSnap?.sceneCompositionStatus || '-';
    lines.push(`- Plan/Sim Status: accepted=${sceneAccepted === null ? '-' : (sceneAccepted ? 'ja' : 'nein')} | composition=${sceneStatus} | targetCommand=${lastTargetCommand ? 'ja' : 'nein'} | ack=${lastAck ? 'ja' : 'nein'}${!lastTargetCommand ? ' | Modus=Plan/Preview' : ''}`);
    if (sceneComposer && typeof sceneComposer === 'object') {
        const toolNames = Array.isArray(sceneComposer.toolCalls) ? sceneComposer.toolCalls.map(c => c.name || '?').slice(0, 5).join(',') : '-';
        lines.push(`- Scene Composer: ${sceneComposer.source || '-'} | prompt=${sceneComposer.promptVersion || '-'} | tools=${toolNames || '-'} | error=${sceneComposer.error || '-'}`);
        if (Array.isArray(sceneComposer.localizationNotes) && sceneComposer.localizationNotes.length) lines.push(`- Scene Composer Lokalisierung: ${sceneComposer.localizationNotes.slice(0, 4).map(n => flattenText(n, 90)).join(' | ')}`);
        if (Array.isArray(sceneComposer.validationNotes) && sceneComposer.validationNotes.length) lines.push(`- Scene Composer Validierung: ${sceneComposer.validationNotes.slice(0, 4).map(n => flattenText(n, 90)).join(' | ')}`);
    }
    const fmtSceneSpec = (label, spec) => {
        if (!spec || typeof spec !== 'object') {
            lines.push(`- ${label}: -`);
            return;
        }
        const roles = Array.isArray(spec.roles) ? spec.roles.join(',') : '-';
        const features = Array.isArray(spec.features) ? spec.features.join(',') : '-';
        const req = Array.isArray(spec.requirements)
            ? spec.requirements.map(r => {
                const place = r.placement ? `@${String(r.placement).replace(/\s+/g, ' ').slice(0, 34)}` : '';
                const arr = r.arrangement ? `/${r.arrangement}` : '';
                const off = Number.isFinite(Number(r.forwardM)) && Number.isFinite(Number(r.rightM)) ? `[f${Math.round(Number(r.forwardM))},r${Math.round(Number(r.rightM))}]` : '';
                return `${r.feature || '?'}x${r.count || 1}${arr}${place}${off}`;
            }).join(',')
            : '-';
        const notes = spec.notes ? ` | notes=${String(spec.notes).replace(/\s+/g, ' ').slice(0, 120)}` : '';
        lines.push(`- ${label}: kind=${spec.kind || spec.type || '?'} | preset=${spec.preset || '-'} | density=${spec.density || '-'} | layout=${spec.layout || '-'} | features=${features} | req=${req} | roles=${roles}${notes}`);
    };
    const fmtItem = (it) => {
        const off = Number.isFinite(Number(it.forwardM)) && Number.isFinite(Number(it.rightM))
            ? ` f=${Math.round(Number(it.forwardM))} r=${Math.round(Number(it.rightM))}`
            : '';
        const anchor = it.geoAnchor
            ? ` anchor=${it.geoAnchor.tag || '-'}:${it.geoAnchor.name || '-'} ${it.geoAnchor.distM ?? '-'}m/${it.geoAnchor.bearingDeg ?? '-'}deg`
            : '';
        const avoid = it.worldAvoidance?.adjusted ? ` adjusted=${it.worldAvoidance.zone || 'yes'}` : '';
        const placement = it.placement ? ` place=${it.placement}${it.placementOverride ? ':ai-offset' : ''}` : '';
        const candidates = Array.isArray(it.candidates) && it.candidates.length ? ` candidates=${it.candidates.slice(0, 3).join('/')}` : '';
        return `${it.n || '?'}:${it.kind || '?'} "${it.label || ''}" title="${it.title || '-'}"${off}${placement}${anchor}${avoid}${candidates}`;
    };
    const fmtCommand = (label, cmd) => {
        if (!cmd || typeof cmd !== 'object') {
            lines.push(`- ${label}: -`);
            return;
        }
        const pos = (Number.isFinite(Number(cmd.lat)) && Number.isFinite(Number(cmd.lon)))
            ? `${Number(cmd.lat).toFixed(5)}, ${Number(cmd.lon).toFixed(5)}`
            : '-';
        const itemSummary = Array.isArray(cmd.items)
            ? cmd.items.slice(0, 10).map(fmtItem).join(' | ')
            : '';
        const pointSummary = Array.isArray(cmd.mapPoints)
            ? cmd.mapPoints.slice(0, 10).map(pt => {
                const pos = (Number.isFinite(Number(pt.lat)) && Number.isFinite(Number(pt.lon)))
                    ? `${Number(pt.lat).toFixed(5)},${Number(pt.lon).toFixed(5)}`
                    : '-';
                const off = Number.isFinite(Number(pt.forwardM)) && Number.isFinite(Number(pt.rightM)) ? `[f${Math.round(Number(pt.forwardM))},r${Math.round(Number(pt.rightM))}]` : '';
                return `${pt.label || pt.kind || '?'}@${pos}${off}`;
            }).join(' | ')
            : '';
        lines.push(`- ${label}: ${cmd.type || '?'} id=${cmd.commandId || '-'} reason=${cmd.reason || '-'} scene=${cmd.sceneId || '-'} kind=${cmd.targetSceneKind || '-'} pos=${pos} alt=${Number.isFinite(Number(cmd.altFt)) ? Math.round(Number(cmd.altFt)) : '-'} hdg=${Number.isFinite(Number(cmd.hdg)) ? Math.round(Number(cmd.hdg)) : '-'}`);
        if (cmd.itemCount || itemSummary) lines.push(`  items=${cmd.itemCount || 0}: ${itemSummary || '-'}`);
        if (pointSummary) lines.push(`  points=${Array.isArray(cmd.mapPoints) ? cmd.mapPoints.length : 0}: ${pointSummary}`);
        if (cmd.smokeSites != null || cmd.fireSites != null) lines.push(`  smokeSites=${cmd.smokeSites ?? '-'} fireSites=${cmd.fireSites ?? '-'} smoke="${cmd.objectTitle || '-'}" fire="${cmd.fireObjectTitle || '-'}"`);
    };
    fmtSceneSpec('KI-Anforderung raw', aiRequested);
    fmtSceneSpec('KI normalisiert', aiNormalized);
    fmtSceneSpec('Contract', contractTargetScene);
    if (sceneTruth?.mainTarget) {
        const mt = sceneTruth.mainTarget;
        const sa = sceneTruth.sceneAnchor || {};
        const mtPos = (Number.isFinite(Number(mt.lat)) && Number.isFinite(Number(mt.lon)))
            ? `${Number(mt.lat).toFixed(5)}, ${Number(mt.lon).toFixed(5)}`
            : '-';
        const saPos = (Number.isFinite(Number(sa.lat)) && Number.isFinite(Number(sa.lon)))
            ? `${Number(sa.lat).toFixed(5)}, ${Number(sa.lon).toFixed(5)}`
            : '-';
        lines.push(`- MissionTruth: main=${mt.kind || '-'} ${mtPos} | anchor=${sa.kind || '-'} ${saPos} | cues=${Array.isArray(sceneTruth.visibleCues) ? sceneTruth.visibleCues.join(',') : '-'}`);
    }
    if (sceneTruth?.arrivalScene) {
        const ar = sceneTruth.arrivalScene;
        const arPos = (Number.isFinite(Number(ar.lat)) && Number.isFinite(Number(ar.lon)))
            ? `${Number(ar.lat).toFixed(5)}, ${Number(ar.lon).toFixed(5)}`
            : '-';
        const conf = Number.isFinite(Number(ar.confidence)) ? Number(ar.confidence).toFixed(2) : '-';
        lines.push(`- MissionTruth Arrival: ${ar.roleLabel || ar.role || '-'} | ${ar.anchorType || '-'} ${arPos} | source=${ar.source || '-'} | conf=${conf}`);
    }
    if (appResolved && typeof appResolved === 'object') {
        const point = appResolved.point || {};
        const pointText = (Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)))
            ? `${Number(point.lat).toFixed(5)}, ${Number(point.lon).toFixed(5)} alt=${Math.round(Number(point.altFt || 0))}ft`
            : '-';
        lines.push(`- App resolved: kind=${appResolved.resolvedKind || '-'} | scene=${appResolved.sceneId || '-'} | point=${pointText} | items=${appResolved.itemCount || 0}`);
        if (Array.isArray(appResolved.items) && appResolved.items.length) {
            lines.push(`  resolvedItems=${appResolved.items.slice(0, 10).map(fmtItem).join(' | ')}`);
        }
    } else {
        lines.push('- App resolved: -');
    }
    if (appResolvedAptArrival && typeof appResolvedAptArrival === 'object') {
        const point = appResolvedAptArrival.point || {};
        const pointText = (Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lon)))
            ? `${Number(point.lat).toFixed(5)}, ${Number(point.lon).toFixed(5)} alt=${Math.round(Number(point.altFt || 0))}ft`
            : '-';
        lines.push(`- App resolved APT Arrival: role=${appResolvedAptArrival.roleLabel || appResolvedAptArrival.role || '-'} | scene=${appResolvedAptArrival.sceneId || '-'} | point=${pointText} | items=${appResolvedAptArrival.itemCount || 0}`);
    } else {
        lines.push('- App resolved APT Arrival: -');
    }
    fmtCommand('App -> Sim Zielszene', lastTargetCommand);
    fmtCommand('App -> Sim APT Arrival', lastAptArrivalCommand);
    fmtCommand('Plan Startszene', plannedStartCommand);
    fmtCommand('Plan Endszene', plannedEndCommand);
    fmtCommand('Plan APT Arrival', plannedAptArrivalCommand);
    fmtCommand('App -> Sim Startszene', lastStartCommand);
    fmtCommand('App -> Sim Endszene', lastEndCommand);
    fmtCommand('App -> Sim Smoke/Fire', lastSmokeCommand);
    const targetPointCommand = targetCommandHasMapPoints ? lastTargetCommand : previewTargetCommand;
    const scenePointCount = [targetPointCommand, lastAptArrivalCommand || plannedAptArrivalCommand, plannedStartCommand, plannedEndCommand, lastSmokeCommand]
        .reduce((sum, cmd) => sum + (Array.isArray(cmd?.mapPoints) ? cmd.mapPoints.length : 0), 0);
    const hasPreviewPoints = Boolean((previewTargetCommand && !targetCommandHasMapPoints) || plannedStartCommand || plannedEndCommand || plannedAptArrivalCommand);
    lines.push(`- Scene Punkte Overlay: ${window.vpMissionSceneDebugOverlayEnabled ? 'An' : 'Aus'} | Punkte=${scenePointCount}${hasPreviewPoints ? ' (Preview)' : ''}`);
    if (lastAck && typeof lastAck === 'object') {
        const byKind = lastAck.spawnedByKind ? JSON.stringify(lastAck.spawnedByKind) : '-';
        lines.push(`- Letztes ACK: ${lastAck.type || '?'} status=${lastAck.status || '-'} spawned=${lastAck.spawned ?? '-'} cleared=${lastAck.cleared ?? '-'} byKind=${byKind} error=${lastAck.error || '-'}`);
    } else {
        lines.push('- Letztes ACK: -');
    }
    const sceneEvents = Array.isArray(sceneDbg.events) ? sceneDbg.events.slice(-5) : [];
    if (sceneEvents.length) {
        lines.push('- Scene Events:');
        sceneEvents.forEach(ev => lines.push(`  ${vpFormatDebugTs(ev.ts)} :: ${ev.event}`));
    }
    lines.push('');
    lines.push('Konsolenfehler / relevante Logs');
    const consoleLogs = collectConsoleLogs();
    const importantLogs = consoleLogs.filter(isImportantConsoleLog);
    const priorityLogs = consoleLogs.filter(isPriorityMissionConsoleLog);
    const dedupedLogSet = new Set();
    const mergedImportantLogs = [];
    [...importantLogs, ...priorityLogs].forEach((entry) => {
        const key = `${entry?.ts || ''}|${entry?.level || ''}|${entry?.msg || ''}`;
        if (dedupedLogSet.has(key)) return;
        dedupedLogSet.add(key);
        mergedImportantLogs.push(entry);
    });
    const importantLogTail = mergedImportantLogs.slice(-32);
    if (!importantLogTail.length) {
        lines.push('- (keine relevanten Console-Warnungen/Fehler im Ringbuffer)');
    } else {
        importantLogTail.forEach((entry) => {
            const extra = entry.extra ? ` | ${flattenText(JSON.stringify(entry.extra), 260)}` : '';
            lines.push(`- ${vpFormatDebugTs(entry.ts)} [${entry.level || 'log'}] ${flattenText(entry.msg, 520)}${extra}`);
        });
    }
    lines.push('');
    lines.push('Recent Events');
    const events = Array.isArray(dbg.recentEvents) ? dbg.recentEvents.slice(-8) : [];
    if (!events.length) lines.push('- (keine)');
    else events.forEach(ev => lines.push(`- ${vpFormatDebugTs(ev.ts)} :: ${ev.message}`));
    return lines.join('\n');
};

window.vpRefreshWeatherDebugReport = function() {
    const body = document.getElementById('weatherDebugBody');
    if (!body) return;
    try {
        body.textContent = window.vpBuildWeatherDebugReport ? window.vpBuildWeatherDebugReport() : 'Debug-Daten nicht verfügbar';
        if (typeof window.missionFollowupInit === 'function') window.missionFollowupInit();
        if (typeof window.updatePoiChainDebugForceButtonUi === 'function') window.updatePoiChainDebugForceButtonUi();
    } catch (err) {
        const msg = err && (err.stack || err.message || String(err));
        body.textContent = `Debug-Report Fehler:\n${msg || 'unknown'}`;
        if (typeof window.gaDebugPush === 'function') {
            try { window.gaDebugPush('debug-error', '[DEBUG REPORT] build failed', { message: msg || 'unknown' }); } catch (_) {}
        }
    }
};

window.vpCopyWeatherDebugReport = async function() {
    const btn = document.getElementById('btnCopyWeatherDebug');
    const oldText = btn ? btn.textContent : '';
    let text = '';
    try {
        text = window.vpBuildWeatherDebugReport ? window.vpBuildWeatherDebugReport() : (document.getElementById('weatherDebugBody')?.textContent || '');
        const body = document.getElementById('weatherDebugBody');
        if (body && text) body.textContent = text;
        if (!text.trim()) throw new Error('empty_debug_report');
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(text);
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', 'readonly');
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand && document.execCommand('copy');
            ta.remove();
            if (!ok) throw new Error('clipboard_unavailable');
        }
        if (btn) {
            btn.textContent = 'Kopiert';
            setTimeout(() => { btn.textContent = oldText || 'Kopieren'; }, 1200);
        }
    } catch (err) {
        if (btn) {
            btn.textContent = 'Fehler';
            setTimeout(() => { btn.textContent = oldText || 'Kopieren'; }, 1600);
        }
        console.warn('[Debug] Copy failed:', err);
        alert(`Debug-Log konnte nicht kopiert werden: ${err?.message || err}`);
    }
};

window.vpBuildMissionPhaseDebugReport = function() {
    const fmt = (ts) => vpFormatDebugTs(ts);
    const lines = [];
    const dbg = (typeof window.gaMissionPhaseDebugGet === 'function')
        ? window.gaMissionPhaseDebugGet()
        : (window.gaMissionPhaseDebug || null);
    const missionSnap = window.vpMissionDebugSnapshot || (() => {
        try { return JSON.parse(localStorage.getItem('ga_mission_debug_snapshot') || 'null'); } catch (_) { return null; }
    })();
    const events = Array.isArray(dbg?.events) ? dbg.events : [];
    const contract = missionSnap?.contract && typeof missionSnap.contract === 'object' ? missionSnap.contract : null;
    const bush = contract?.bush && typeof contract.bush === 'object' ? contract.bush : null;
    const missionType = String(contract?.missionType || missionSnap?.mode || '').trim().toLowerCase();
    const poiRecipeId = (typeof window.missionPoiRecipeId === 'function' && contract)
        ? String(window.missionPoiRecipeId(contract) || '').trim().toLowerCase()
        : '';
    const bushRecipeId = (typeof window._bushRecipeIdFromSpec === 'function' && bush)
        ? String(window._bushRecipeIdFromSpec(bush) || '').trim().toLowerCase()
        : '';
    const sarHeliProgress = (() => {
        try {
            if (typeof window.missionSarHeliProgressSnapshot === 'function') return window.missionSarHeliProgressSnapshot();
        } catch (_) {}
        return (typeof currentMissionData !== 'undefined' && currentMissionData?.sarHeliProgress) ? currentMissionData.sarHeliProgress : null;
    })();
    const lastRuntimePhaseEntry = [...events].reverse().find(e => e?.kind === 'runtime_phase');
    const lastStartPhaseEntry = [...events].reverse().find(e => e?.kind === 'start_phase');
    const lastBushProgressEntry = [...events].reverse().find(e => e?.kind === 'bush_progress');
    const lastGroundActionEntry = [...events].reverse().find(e => e?.kind === 'ground_action');
    const lastDialogEntry = [...events].reverse().find(e => e?.kind === 'dialog');
    const finalOutcomeEntry = [...events].reverse().find(e => e?.kind === 'trigger' && (e?.payload?.name === 'missionCargoFinalizeMissionOutcome' || e?.payload?.name === '_missionSceneFinishRuntimeAfterDeboard:outcome'));
    const completionEntry = [...events].reverse().find(e => e?.kind === 'trigger' && e?.payload?.name === 'completeSimMissionEnd');
    const hasEvent = (kind, predicate) => events.some((entry) => {
        if (kind && entry?.kind !== kind) return false;
        return typeof predicate === 'function' ? !!predicate(entry.payload || {}, entry) : true;
    });
    const recipeFlow = (() => {
        if (bushRecipeId === 'pickup_return') return 'A -> B (Landung/Pickup) -> A';
        if (bushRecipeId === 'poi_on_task_return' || poiRecipeId === 'poi_on_task_return') return 'A -> B (POI/on-task ohne Landung) -> A';
        if (poiRecipeId === 'poi_sar_heli') return 'A -> B (Fundstelle: Hover/Landung/Patient) -> C (Klinik)';
        if (poiRecipeId === 'poi_on_task' || poiRecipeId === 'poi_flyover' || poiRecipeId === 'poi_fire_watch' || poiRecipeId === 'poi_search_and_rescue' || poiRecipeId === 'poi_training') {
            return 'A -> B (POI/on-task ohne Landung) -> A';
        }
        return 'A -> B';
    })();
    const validation = {
        targetReached: hasEvent('ground_action', (p) => p.atTarget === true)
            || hasEvent('sar_heli_progress', (p) => p.targetConfirmed === true)
            || !!sarHeliProgress?.targetConfirmed,
        taskEntered: hasEvent(null, (_, entry) => {
            return (entry.kind === 'bush_progress' && (entry.payload?.to === 'on_task' || entry.payload?.to === 'pickup_ready' || entry.payload?.to === 'pickup_loading' || entry.payload?.to === 'pickup_complete'))
                || (entry.kind === 'ground_action' && ['on_task', 'pickup_ready', 'pickup_loading', 'pickup_complete'].includes(String(entry.payload?.phase || '')))
                || (entry.kind === 'sar_heli_progress' && (entry.payload?.targetConfirmed || entry.payload?.holdReady || entry.payload?.patientLoaded));
        }) || !!(sarHeliProgress?.targetConfirmed || sarHeliProgress?.holdReadyAnnounced || sarHeliProgress?.patientLoaded),
        returnLegReached: hasEvent(null, (_, entry) => {
            return (entry.kind === 'bush_progress' && entry.payload?.to === 'return_leg')
                || (entry.kind === 'ground_action' && String(entry.payload?.phase || '') === 'return_leg')
                || (entry.kind === 'sar_heli_progress' && entry.payload?.patientLoaded === true);
        }) || !!sarHeliProgress?.patientLoaded,
        readyToCloseReached: hasEvent(null, (_, entry) => {
            return (entry.kind === 'bush_progress' && entry.payload?.to === 'ready_to_close')
                || (entry.kind === 'ground_action' && String(entry.payload?.phase || '') === 'ready_to_close')
                || (entry.kind === 'sar_heli_progress' && entry.payload?.readyToClose === true);
        }) || !!sarHeliProgress?.readyToClose,
        simEndTriggered: hasEvent('trigger', (p) => p.name === 'completeSimMissionEnd'),
        farewellTriggered: hasEvent('trigger', (p) => p.name === '_triggerPaxFarewellAndWaitForDeboard:started'),
        deboardingStarted: hasEvent('trigger', (p) => p.name === 'missionSceneStartDeboardingAfterFarewell' || p.name === 'finishMissionCargoUnloadAndEnd:start-bush-home-deboarding'),
        outcomeFinalized: hasEvent('trigger', (p) => p.name === 'missionCargoFinalizeMissionOutcome' || p.name === '_missionSceneFinishRuntimeAfterDeboard:outcome'),
        resetAfterClose: hasEvent('trigger', (p) => Number(p.runtimeActive || 0) === 0 && Number(p.closingPending || 0) === 1)
            || hasEvent('start_phase', (p) => p.trigger === 'clear-start-phase')
    };
    const validationFlag = (ok) => ok ? '1' : '0';
    const finalOutcomePayload = finalOutcomeEntry?.payload && typeof finalOutcomeEntry.payload === 'object' ? finalOutcomeEntry.payload : {};
    const completionPayload = completionEntry?.payload && typeof completionEntry.payload === 'object' ? completionEntry.payload : {};
    lines.push(`Session seit: ${fmt(dbg?.sessionStartedAt || dbg?.ts || Date.now())}`);
    lines.push('Phasen-Log');
    if (missionSnap) {
        lines.push(`- Mission: ${missionSnap.mission || 'n/a'}`);
        lines.push(`- Ziel: ${missionSnap.target || 'n/a'}`);
        lines.push(`- Modus/Kategorie: ${missionSnap.mode || '?'} / ${missionSnap.category || '?'}`);
    } else {
        lines.push('- Mission: -');
    }
    lines.push(`- Events: ${events.length}`);
    lines.push(`- Ablauf-Rezept: ${recipeFlow}`);
    lines.push(`- Rezept-ID: Bush=${bushRecipeId || '-'} | POI=${poiRecipeId || '-'}`);
    if (bush) {
        lines.push(`- Bush-Contract: profile=${bush.profileId || '-'} | targetMode=${bush.targetMode || '-'} | completionMode=${bush.completionMode || '-'} | returnHome=${bush.requiresReturnHome ? '1' : '0'}`);
    } else if (missionType === 'poi') {
        lines.push(`- POI-Contract: dwell=${Number(missionSnap?.passenger?.targetDwellMin || 0)} min | radius=${Number(missionSnap?.passenger?.targetRadiusNm || 0)} NM | alt=${Number(missionSnap?.passenger?.targetAltFt || 0)} ft`);
    }
    lines.push('');
    lines.push('Debug-Protokoll');
    lines.push(`- Ziel erreicht: ${validationFlag(validation.targetReached)}`);
    lines.push(`- Task-/Dialog-Phase erreicht: ${validationFlag(validation.taskEntered)}`);
    lines.push(`- Return-Leg erreicht: ${validationFlag(validation.returnLegReached)}`);
    lines.push(`- Ready-to-close erreicht: ${validationFlag(validation.readyToCloseReached)}`);
    lines.push(`- Sim-Ende getriggert: ${validationFlag(validation.simEndTriggered)}${completionPayload.distanceNm ? ` | distanceNm=${completionPayload.distanceNm}` : ''}`);
    lines.push(`- Farewell getriggert: ${validationFlag(validation.farewellTriggered)}`);
    lines.push(`- Deboarding gestartet: ${validationFlag(validation.deboardingStarted)}`);
    lines.push(`- Outcome finalisiert: ${validationFlag(validation.outcomeFinalized)}${typeof finalOutcomePayload.failed !== 'undefined' ? ` | failed=${finalOutcomePayload.failed ? '1' : '0'}` : ''}`);
    lines.push(`- Reset/Close-Pfad gesehen: ${validationFlag(validation.resetAfterClose)}`);
    if (lastRuntimePhaseEntry?.payload) {
        lines.push(`- Letzte Runtime-Phase: ${lastRuntimePhaseEntry.payload.from || '-'} -> ${lastRuntimePhaseEntry.payload.to || '-'}`);
    }
    if (lastStartPhaseEntry?.payload) {
        lines.push(`- Letzte Start-Phase: ${lastStartPhaseEntry.payload.from || '-'} -> ${lastStartPhaseEntry.payload.to || '-'}`);
    }
    if (lastBushProgressEntry?.payload) {
        lines.push(`- Letzter Bush-Status: ${lastBushProgressEntry.payload.from || '-'} -> ${lastBushProgressEntry.payload.to || '-'} | ready=${lastBushProgressEntry.payload.pickupReady ? '1' : '0'} completed=${lastBushProgressEntry.payload.pickupCompleted ? '1' : '0'} confirmed=${lastBushProgressEntry.payload.pickupConfirmed ? '1' : '0'} home=${lastBushProgressEntry.payload.returnHomeQualified ? '1' : '0'}`);
    }
    if (lastGroundActionEntry?.payload) {
        lines.push(`- Letzte Bodenaktion: action=${lastGroundActionEntry.payload.action || '-'} | phase=${lastGroundActionEntry.payload.phase || '-'} | reason=${lastGroundActionEntry.payload.reason || '-'} | atTarget=${lastGroundActionEntry.payload.atTarget ? '1' : '0'} | groundStill=${lastGroundActionEntry.payload.groundStill ? '1' : '0'}`);
    }
    if (lastDialogEntry?.payload) {
        lines.push(`- Letzter Dialog: mode=${lastDialogEntry.payload.mode || '-'} | trigger=${lastDialogEntry.payload.trigger || '-'} | phase=${lastDialogEntry.payload.phase || '-'}`);
    }
    if (finalOutcomePayload.requiredStatus) {
        lines.push(`- Outcome requiredStatus: ${typeof finalOutcomePayload.requiredStatus === 'string' ? finalOutcomePayload.requiredStatus : JSON.stringify(finalOutcomePayload.requiredStatus)}`);
    }
    lines.push('');
    lines.push('Trigger / Phasen / Aktionen');
    if (!events.length) {
        lines.push('- (keine Einträge)');
        return lines.join('\n');
    }
    events.slice(-120).forEach((entry) => {
        const payload = entry?.payload && typeof entry.payload === 'object' ? entry.payload : {};
        const kind = String(entry?.kind || 'event');
        if (kind === 'runtime_phase') {
            lines.push(`- ${fmt(entry.ts)} :: runtime ${payload.from || '-'} -> ${payload.to || '-'} | trigger=${payload.trigger || '-'}`);
            return;
        }
        if (kind === 'start_phase') {
            lines.push(`- ${fmt(entry.ts)} :: start ${payload.from || '-'} -> ${payload.to || '-'} | trigger=${payload.trigger || '-'}`);
            return;
        }
        if (kind === 'bush_progress') {
            lines.push(`- ${fmt(entry.ts)} :: bush ${payload.from || '-'} -> ${payload.to || '-'} | ready=${payload.pickupReady ? '1' : '0'} completed=${payload.pickupCompleted ? '1' : '0'} confirmed=${payload.pickupConfirmed ? '1' : '0'} home=${payload.returnHomeQualified ? '1' : '0'}`);
            return;
        }
        if (kind === 'ground_action') {
            lines.push(`- ${fmt(entry.ts)} :: action=${payload.action || '-'} phase=${payload.phase || '-'} | trigger=${payload.trigger || '-'} | groundStill=${payload.groundStill ? '1' : '0'} atTarget=${payload.atTarget ? '1' : '0'} reason=${payload.reason || '-'} bush=${payload.bushStatus || '-'}`);
            return;
        }
        if (kind === 'dialog') {
            lines.push(`- ${fmt(entry.ts)} :: dialog=${payload.mode || '-'} | trigger=${payload.trigger || '-'} | phase=${payload.phase || '-'}${payload.poiGroundEndReady ? ' | poiReady=1' : ''}`);
            return;
        }
        if (kind === 'trigger') {
            const rest = Object.keys(payload)
                .filter(k => k !== 'name' && payload[k] !== null && payload[k] !== undefined && payload[k] !== '')
                .map(k => `${k}=${typeof payload[k] === 'boolean' ? (payload[k] ? '1' : '0') : String(payload[k])}`)
                .join(' | ');
            lines.push(`- ${fmt(entry.ts)} :: trigger=${payload.name || '-'}${rest ? ` | ${rest}` : ''}`);
            return;
        }
        lines.push(`- ${fmt(entry.ts)} :: ${kind} ${JSON.stringify(payload)}`);
    });
    return lines.join('\n');
};

window.vpCopyMissionPhaseDebugReport = async function() {
    const btn = document.getElementById('btnCopyMissionPhaseDebug');
    const oldText = btn ? btn.textContent : '';
    try {
        const text = window.vpBuildMissionPhaseDebugReport ? window.vpBuildMissionPhaseDebugReport() : '';
        if (!text.trim()) throw new Error('empty_phase_debug_report');
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(text);
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', 'readonly');
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand && document.execCommand('copy');
            ta.remove();
            if (!ok) throw new Error('clipboard_unavailable');
        }
        if (btn) {
            btn.textContent = 'Phasen-Log kopiert';
            setTimeout(() => { btn.textContent = oldText || 'Phasen-Log'; }, 1400);
        }
    } catch (err) {
        if (btn) {
            btn.textContent = 'Fehler';
            setTimeout(() => { btn.textContent = oldText || 'Phasen-Log'; }, 1400);
        }
        throw err;
    }
};

window.vpClearObstacleRollingCache = function() {
    try {
        localStorage.removeItem(VP_OBS_POOL_STORAGE_KEY);
        localStorage.removeItem(VP_OBS_TILE_COVERAGE_KEY);
        localStorage.removeItem(VP_OBS_TILE_FAILED_KEY);
        localStorage.removeItem(VP_OVERPASS_STATE_STORAGE_KEY);
        const toDelete = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k) continue;
            if (k.startsWith('ga_obs_combo_')) toDelete.push(k);
        }
        toDelete.forEach(k => localStorage.removeItem(k));
    } catch (_) { }

    try {
        vpObsPool.obs.clear();
        vpObsPool.lin.clear();
        vpObsTileCoverage.clear();
        vpObsTileFailed.clear();
        if (window.vpOverpassTileBackoff instanceof Map) window.vpOverpassTileBackoff.clear();
        window.vpFailedOverpassChunks = [];
        vpObstacles = [];
        vpLinearFeatures = [];
        window._lastObsRouteKey = null;
        window.vpOverpassRouteLastSuccess = {};
        if (window.vpSetObsTileDeferred) window.vpSetObsTileDeferred('__RESET__', false);
        if (window.updateOverpassErrorUI) window.updateOverpassErrorUI();
        if (window.vpNotifyObsTileCoverageChanged) window.vpNotifyObsTileCoverageChanged();
        window.vpBgNeedsUpdate = true;
        if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
    } catch (_) { }
    console.log('[Overpass] Rolling Cache geleert (Pool/Tiles/Failed/Route-Cache).');
};

window.vpToggleWeatherDebugPanel = function(forceState) {
    const panel = document.getElementById('weatherDebugPanel');
    if (!panel) return;
    const show = typeof forceState === 'boolean' ? forceState : (panel.style.display === 'none' || !panel.style.display);
    panel.style.display = show ? 'block' : 'none';
    if (show) {
        window.vpUpdateObsTileOverlayButtonUi && window.vpUpdateObsTileOverlayButtonUi();
        window.updateMissionPipelineV2ButtonUi && window.updateMissionPipelineV2ButtonUi();
        window.updateMissionWriterModeButtonUi && window.updateMissionWriterModeButtonUi();
        window.vpRefreshWeatherDebugReport && window.vpRefreshWeatherDebugReport();
    }
};
vpInstallGlobalDebugHooks();

function vpCoverageToCloudType(coveragePct) {
    if (coveragePct >= 88) return 'OVC';
    if (coveragePct >= 62) return 'BKN';
    if (coveragePct >= 30) return 'SCT';
    return 'FEW';
}

function vpEstimateCloudBaseFtFromTempDewProfile(parts = {}) {
    const tempC = Number(parts.tempC ?? parts.temp2mC);
    const dewC = Number(parts.dewPointC ?? parts.dewPoint2mC);
    if (!Number.isFinite(tempC) || !Number.isFinite(dewC)) return null;

    const spreadC = Math.max(0, tempC - dewC);
    const windKtRaw = Number(parts.windKt ?? parts.wind);
    const windKt = Number.isFinite(windKtRaw) ? Math.max(0, Math.min(30, windKtRaw)) : 0;
    const rh = Number(parts.rhPct ?? parts.rh2mPct);

    let windBoost = 1 + (windKt / 30) * 0.85;
    if (Number.isFinite(rh)) {
        if (rh >= 97) windBoost -= 0.22;
        else if (rh >= 93) windBoost -= 0.12;
        else if (rh >= 88) windBoost -= 0.06;
    }
    windBoost = Math.max(1.0, Math.min(1.9, windBoost));

    const spreadWeight = spreadC <= 2.5 ? 1.0 : (spreadC <= 4.0 ? 0.65 : 0.35);
    const effBoost = 1 + ((windBoost - 1) * spreadWeight);
    return spreadC * 400 * effBoost;
}

function vpBuildTempDewCloudLayer(parts = {}) {
    const baseAglRaw = vpEstimateCloudBaseFtFromTempDewProfile(parts);
    if (!Number.isFinite(baseAglRaw)) return null;

    const raw = String(parts.raw || '').toUpperCase();
    const fltCat = String(parts.fltCat || '').toUpperCase();
    const wxCode = Number(parts.weatherCode);
    const coveragePct = Number(parts.coveragePct);
    const lowCloudPct = Number(parts.lowCloudPct);
    const rh = Number(parts.rhPct ?? parts.rh2mPct);
    const tempC = Number(parts.tempC ?? parts.temp2mC);
    const dewC = Number(parts.dewPointC ?? parts.dewPoint2mC);
    const spreadC = (Number.isFinite(tempC) && Number.isFinite(dewC)) ? Math.max(0, tempC - dewC) : null;
    const hasPrecip = !!(parts.hasRain || parts.hasSnow || /\b(-|\+)?(RA|DZ|SN|SG|PL|SH|SHRA|SHSN)\b/i.test(raw));
    const hasFogMist = /\b(FG|BR|HZ|FU|MIFG|BCFG|PRFG|VCFG)\b/i.test(raw) || wxCode === 45 || wxCode === 48;
    const clearToken = /\b(CAVOK|NSC|SKC|CLR)\b/i.test(raw);
    const nonVfr = ['MVFR', 'IFR', 'LIFR'].includes(fltCat);
    const moist = (Number.isFinite(rh) && rh >= 88) || (Number.isFinite(spreadC) && spreadC <= 3.5);
    const cloudyCoverage = Number.isFinite(lowCloudPct)
        ? lowCloudPct >= 35
        : (Number.isFinite(coveragePct) && coveragePct >= 55);

    if (clearToken && !nonVfr && !hasPrecip && !hasFogMist) return null;
    if (!nonVfr && !hasPrecip && !hasFogMist && !cloudyCoverage && !moist) return null;

    let typeCoverage = Number.isFinite(lowCloudPct) ? lowCloudPct : (Number.isFinite(coveragePct) ? coveragePct : null);
    if (!Number.isFinite(typeCoverage)) {
        if (fltCat === 'LIFR' || fltCat === 'IFR' || hasFogMist) typeCoverage = 88;
        else if (fltCat === 'MVFR' || hasPrecip) typeCoverage = 68;
        else if (moist) typeCoverage = 45;
        else typeCoverage = 30;
    }

    const terrainFt = Number(parts.terrainFt);
    const baseAgl = Math.round(Math.max(0, Math.min(15000, baseAglRaw)));
    const baseMsl = Math.round((Number.isFinite(terrainFt) ? terrainFt : 0) + baseAgl);
    return {
        type: vpCoverageToCloudType(typeCoverage),
        baseAgl,
        baseMsl,
        source: String(parts.source || 'temp_dew_spread'),
        estimated: true
    };
}

function vpBucketCloudForLevel(level, lowPct, midPct, highPct) {
    if (level >= 900) return lowPct;
    if (level >= 700) return midPct;
    return highPct;
}

function vpEstimatePressureLevelFt(levelHpa, mslPressureHpa) {
    const level = Number(levelHpa);
    if (!Number.isFinite(level) || level <= 0) return null;
    const p0 = (Number.isFinite(mslPressureHpa) && mslPressureHpa > 700 && mslPressureHpa < 1085)
        ? mslPressureHpa
        : VP_STD_MSL_PRESSURE_HPA;
    const ratio = Math.max(0.0001, Math.min(1.2, level / p0));
    // ISA-Näherung: Hoehe der Druckfläche relativ zu lokalem MSL-Druck.
    const altFt = 145366.45 * (1 - Math.pow(ratio, 0.190284));
    return Math.max(0, Math.min(30000, altFt));
}

function vpInterpolateRoutePointAtDist(elevData, targetDist) {
    if (!elevData || elevData.length < 2) return null;
    for (let i = 0; i < elevData.length - 1; i++) {
        const a = elevData[i];
        const b = elevData[i + 1];
        if (targetDist < a.distNM || targetDist > b.distNM) continue;
        const seg = (b.distNM - a.distNM) || 1;
        const f = (targetDist - a.distNM) / seg;
        return {
            distNM: targetDist,
            lat: a.lat + (b.lat - a.lat) * f,
            lon: a.lon + (b.lon - a.lon) * f,
            elevFt: Math.round(a.elevFt + (b.elevFt - a.elevFt) * f)
        };
    }
    const last = elevData[elevData.length - 1];
    return { distNM: last.distNM, lat: last.lat, lon: last.lon, elevFt: last.elevFt };
}

function vpSampleRouteWeatherPoints(elevData, stepNM = 5) {
    if (!elevData || elevData.length < 2) return [];
    const totalDist = elevData[elevData.length - 1].distNM;
    if (totalDist <= 0) return [elevData[0]];

    // 5 NM Zielraster; harte Kappung für API/Render-Performance.
    let effStep = Math.max(2.5, stepNM);
    const maxPoints = 40;
    const idealCount = Math.floor(totalDist / effStep) + 1;
    if (idealCount > maxPoints) effStep = totalDist / (maxPoints - 1);

    const points = [];
    for (let d = 0; d <= totalDist + 0.01; d += effStep) {
        const pt = vpInterpolateRoutePointAtDist(elevData, Math.min(d, totalDist));
        if (pt) points.push(pt);
    }
    if (points.length === 0 || points[points.length - 1].distNM < totalDist - 0.1) {
        const last = elevData[elevData.length - 1];
        points.push({ distNM: totalDist, lat: last.lat, lon: last.lon, elevFt: last.elevFt });
    }
    return points;
}

function vpQuantizeCoord(value, step) {
    if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return value;
    return Math.round(value / step) * step;
}

function vpBuildOpenMeteoCacheKey(includePressure, lat, lon) {
    const step = includePressure ? VP_OM_COORD_STEP_PRESS : VP_OM_COORD_STEP_BASE;
    const latQ = vpQuantizeCoord(lat, step);
    const lonQ = vpQuantizeCoord(lon, step);
    return `${includePressure ? 'p4' : 'b4'}|${latQ.toFixed(3)}|${lonQ.toFixed(3)}`;
}

function vpHydrateOpenMeteoCache() {
    if (vpOmCacheHydrated) return;
    vpOmCacheHydrated = true;
    try {
        const raw = localStorage.getItem(VP_OM_CACHE_STORAGE_KEY);
        if (!raw) return;
        const payload = JSON.parse(raw);
        if (!payload || !Array.isArray(payload.entries)) return;
        const now = Date.now();
        for (const item of payload.entries) {
            if (!item || typeof item.key !== 'string' || !item.data || !Number.isFinite(item.ts)) continue;
            if ((now - item.ts) > VP_OM_CACHE_TTL_MS) continue;
            vpOpenMeteoPointCache.set(item.key, { ts: item.ts, data: item.data });
        }
        if (window.vpWeatherDebug) {
            window.vpWeatherDebug.cacheHydratedEntries += vpOpenMeteoPointCache.size;
            vpWeatherDebugEvent(`cache hydrate: ${vpOpenMeteoPointCache.size} entries`);
        }
    } catch (e) {
        // still offline-first if cache payload is malformed
        if (window.vpWeatherDebug) window.vpWeatherDebug.cachePersistErrors += 1;
    }
}

function vpPruneOpenMeteoCache(now = Date.now()) {
    for (const [k, v] of vpOpenMeteoPointCache.entries()) {
        if (!v || !Number.isFinite(v.ts) || (now - v.ts) > VP_OM_CACHE_TTL_MS) vpOpenMeteoPointCache.delete(k);
    }
    if (vpOpenMeteoPointCache.size <= VP_OM_CACHE_MAX_ENTRIES) return;
    const entries = Array.from(vpOpenMeteoPointCache.entries()).sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));
    const drop = vpOpenMeteoPointCache.size - VP_OM_CACHE_MAX_ENTRIES;
    for (let i = 0; i < drop; i++) vpOpenMeteoPointCache.delete(entries[i][0]);
}

function vpSchedulePersistOpenMeteoCache() {
    if (vpOmCachePersistTimer) return;
    vpOmCachePersistTimer = setTimeout(() => {
        vpOmCachePersistTimer = null;
        try {
            vpPruneOpenMeteoCache();
            const entries = Array.from(vpOpenMeteoPointCache.entries())
                .slice(-VP_OM_CACHE_MAX_ENTRIES)
                .map(([key, v]) => ({ key, ts: v.ts, data: v.data }));
            localStorage.setItem(VP_OM_CACHE_STORAGE_KEY, JSON.stringify({ ts: Date.now(), entries }));
            if (window.vpWeatherDebug) window.vpWeatherDebug.cachePersistWrites += 1;
        } catch (e) {
            // localStorage may be full or blocked; continue with in-memory cache only
            if (window.vpWeatherDebug) {
                window.vpWeatherDebug.cachePersistErrors += 1;
                vpWeatherDebugSetError(e, 'cache persist');
            }
        }
    }, 1200);
}

function vpGetNearestHourlyIndex(hourlyTimes) {
    if (!Array.isArray(hourlyTimes) || hourlyTimes.length === 0) return 0;
    const now = Math.floor(Date.now() / 1000);
    let bestIdx = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < hourlyTimes.length; i++) {
        const t = Number(hourlyTimes[i]);
        if (!Number.isFinite(t)) continue;
        const diff = Math.abs(t - now);
        if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
    }
    return bestIdx;
}

function vpGetHourlyAt(hourly, key, idx) {
    if (!hourly || !Array.isArray(hourly[key])) return null;
    const v = Number(hourly[key][idx]);
    return Number.isFinite(v) ? v : null;
}

async function vpFetchOpenMeteoPoint(lat, lon, { signal, includePressure = false } = {}) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    vpHydrateOpenMeteoCache();
    const cacheKey = vpBuildOpenMeteoCacheKey(includePressure, lat, lon);
    const keyParts = cacheKey.split('|');
    const latQ = Number(keyParts[1]);
    const lonQ = Number(keyParts[2]);
    const now = Date.now();
    vpPruneOpenMeteoCache(now);
    const cached = vpOpenMeteoPointCache.get(cacheKey);
    if (cached && (now - cached.ts) < VP_OM_CACHE_TTL_MS) {
        if (window.vpWeatherDebug) window.vpWeatherDebug.openMeteoCacheHits += 1;
        return cached.data;
    }
    if (vpIsOpenMeteoCoolingDown(now)) {
        if (cached && (now - cached.ts) < VP_OM_STALE_CACHE_TTL_MS) {
            if (window.vpWeatherDebug) {
                window.vpWeatherDebug.openMeteoCacheHits += 1;
                window.vpWeatherDebug.openMeteoStaleCacheHits += 1;
            }
            return cached.data;
        }
        if (window.vpWeatherDebug) window.vpWeatherDebug.openMeteoCooldownSkips += 1;
        return null;
    }
    if (window.vpWeatherDebug) window.vpWeatherDebug.openMeteoCacheMisses += 1;
    const inFlight = vpOpenMeteoPointInFlight.get(cacheKey);
    if (inFlight) {
        if (window.vpWeatherDebug) window.vpWeatherDebug.openMeteoCacheHits += 1;
        return inFlight;
    }

    const loadPromise = (async () => {
    const hourlyVars = [
        'pressure_msl',
        'cloud_cover',
        'cloud_cover_low',
        'cloud_cover_mid',
        'cloud_cover_high',
        'precipitation',
        'rain',
        'snowfall',
        'wind_speed_10m',
        'wind_direction_10m',
        'temperature_2m',
        'dew_point_2m',
        'relative_humidity_2m',
        'visibility',
        'weather_code'
    ];
    if (includePressure) {
        VP_OM_PRESSURE_LEVELS.forEach(level => {
            hourlyVars.push(`geopotential_height_${level}hPa`);
            hourlyVars.push(`cloud_cover_${level}hPa`);
            hourlyVars.push(`wind_speed_${level}hPa`);
            hourlyVars.push(`wind_direction_${level}hPa`);
        });
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latQ}&longitude=${lonQ}&hourly=${encodeURIComponent(hourlyVars.join(','))}&forecast_hours=6&models=best_match&wind_speed_unit=kn&timeformat=unixtime&timezone=UTC`;
    if (window.vpWeatherDebug) window.vpWeatherDebug.openMeteoNetworkRequests += 1;
    const res = await fetch(url, { signal });
    if (!res.ok) {
        if (res.status === 429) {
            await window.vpRecordOpenMeteo429FromResponse?.(res, 'point forecast');
        }
        throw new Error(`Open-Meteo HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data || !data.hourly || !Array.isArray(data.hourly.time)) throw new Error('Open-Meteo hourly fehlt');

    const idx = vpGetNearestHourlyIndex(data.hourly.time);
    const lowPct = vpGetHourlyAt(data.hourly, 'cloud_cover_low', idx) ?? 0;
    const midPct = vpGetHourlyAt(data.hourly, 'cloud_cover_mid', idx) ?? 0;
    const highPct = vpGetHourlyAt(data.hourly, 'cloud_cover_high', idx) ?? 0;
    const totalCloudPct = vpGetHourlyAt(data.hourly, 'cloud_cover', idx) ?? Math.max(lowPct, midPct, highPct);

    const mslPressureHpa = vpGetHourlyAt(data.hourly, 'pressure_msl', idx);
    const pressureAnomalyFt = Number.isFinite(mslPressureHpa)
        ? (VP_STD_MSL_PRESSURE_HPA - mslPressureHpa) * 27
        : 0;
    const pressureProfile = [];
    if (includePressure) {
        for (const level of VP_OM_PRESSURE_LEVELS) {
            const geoM = vpGetHourlyAt(data.hourly, `geopotential_height_${level}hPa`, idx);
            const cloudLevel = vpGetHourlyAt(data.hourly, `cloud_cover_${level}hPa`, idx);
            const wsLevel = vpGetHourlyAt(data.hourly, `wind_speed_${level}hPa`, idx);
            const wdLevel = vpGetHourlyAt(data.hourly, `wind_direction_${level}hPa`, idx);
            const mslEstimatedFt = vpEstimatePressureLevelFt(level, mslPressureHpa);
            let geopotentialFt;
            if (Number.isFinite(geoM)) {
                // Modellhoehen behalten, aber mit lokalem Druckanomalie-Offset leicht regional variieren.
                geopotentialFt = (geoM * 3.28084) + (pressureAnomalyFt * 0.75);
            } else {
                geopotentialFt = Number.isFinite(mslEstimatedFt) ? mslEstimatedFt : VP_OM_LEVEL_DEFAULT_FT[level];
            }
            geopotentialFt = Math.max(0, Math.min(30000, geopotentialFt));
            pressureProfile.push({
                hPa: level,
                geopotentialFt: Number(geopotentialFt.toFixed(1)),
                cloudPct: Math.max(0, Math.min(100, Number.isFinite(cloudLevel) ? cloudLevel : vpBucketCloudForLevel(level, lowPct, midPct, highPct))),
                windKt: Math.max(0, Number.isFinite(wsLevel) ? wsLevel : (vpGetHourlyAt(data.hourly, 'wind_speed_10m', idx) ?? 0)),
                windDirDeg: ((Number.isFinite(wdLevel) ? wdLevel : (vpGetHourlyAt(data.hourly, 'wind_direction_10m', idx) ?? 0)) + 360) % 360
            });
        }
        pressureProfile.sort((a, b) => a.geopotentialFt - b.geopotentialFt);
    }

    const sample = {
        lat: latQ,
        lon: lonQ,
        mslPressureHpa: mslPressureHpa,
        cloudTotalPct: totalCloudPct,
        cloudLowPct: lowPct,
        cloudMidPct: midPct,
        cloudHighPct: highPct,
        cloudBaseM: null,
        precipitationMm: vpGetHourlyAt(data.hourly, 'precipitation', idx) ?? 0,
        rainMm: vpGetHourlyAt(data.hourly, 'rain', idx) ?? 0,
        snowfallCm: vpGetHourlyAt(data.hourly, 'snowfall', idx) ?? 0,
        wspd: vpGetHourlyAt(data.hourly, 'wind_speed_10m', idx) ?? 0,
        wdir: vpGetHourlyAt(data.hourly, 'wind_direction_10m', idx) ?? 0,
        temp2mC: vpGetHourlyAt(data.hourly, 'temperature_2m', idx),
        dewPoint2mC: vpGetHourlyAt(data.hourly, 'dew_point_2m', idx),
        rh2mPct: vpGetHourlyAt(data.hourly, 'relative_humidity_2m', idx),
        visibilityM: vpGetHourlyAt(data.hourly, 'visibility', idx),
        weatherCode: vpGetHourlyAt(data.hourly, 'weather_code', idx),
        pressureProfile
    };

    vpOpenMeteoPointCache.set(cacheKey, { ts: now, data: sample });
    vpSchedulePersistOpenMeteoCache();
    if (window.vpWeatherDebug) window.vpWeatherDebug.lastSuccessAt = Date.now();
    return sample;
    })();
    vpOpenMeteoPointInFlight.set(cacheKey, loadPromise);
    try {
        return await loadPromise;
    } finally {
        vpOpenMeteoPointInFlight.delete(cacheKey);
    }
}

window.fetchOpenMeteoWeatherPoints = async function(points, { signal, includePressure = false, maxConcurrency = 6 } = {}) {
    if (!Array.isArray(points) || points.length === 0) return [];
    if (window.vpWeatherDebug) {
        window.vpWeatherDebug.openMeteoBatchCalls += 1;
        window.vpWeatherDebug.openMeteoBatchPoints += points.length;
    }
    const out = new Array(points.length);
    let cursor = 0;
    const workers = [];
    const limit = Math.max(1, Math.min(maxConcurrency, points.length));
    for (let w = 0; w < limit; w++) {
        workers.push((async () => {
            while (true) {
                const i = cursor++;
                if (i >= points.length) break;
                if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');
                try {
                    const p = points[i];
                    out[i] = await vpFetchOpenMeteoPoint(p.lat, p.lon, { signal, includePressure });
                } catch (e) {
                    if (e && e.name === 'AbortError') throw e;
                    vpWeatherDebugSetError(e, 'point fetch');
                    out[i] = null;
                }
            }
        })());
    }
    await Promise.all(workers);
    return out;
};

function vpDeriveCloudLayersFromPressureProfile(pressureProfile, terrainFt = 0) {
    if (!Array.isArray(pressureProfile) || pressureProfile.length === 0) return [];
    const pts = pressureProfile
        .filter(p => Number.isFinite(p.geopotentialFt) && Number.isFinite(p.cloudPct))
        .sort((a, b) => a.geopotentialFt - b.geopotentialFt);
    if (!pts.length) return [];

    const layers = [];
    let segStart = null;
    let segCover = [];
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const cloudy = p.cloudPct >= 20;
        if (cloudy && !segStart) {
            segStart = { idx: i, baseFt: p.geopotentialFt };
            segCover = [p.cloudPct];
            continue;
        }
        if (cloudy && segStart) {
            segCover.push(p.cloudPct);
            continue;
        }
        if (!cloudy && segStart) {
            const topPt = pts[Math.max(segStart.idx, i - 1)];
            const avgCov = segCover.reduce((a, b) => a + b, 0) / Math.max(1, segCover.length);
            const baseMsl = Math.round(segStart.baseFt);
            const topMsl = Math.max(baseMsl + 400, Math.round(topPt.geopotentialFt));
            layers.push({
                type: vpCoverageToCloudType(avgCov),
                baseAgl: Math.max(0, baseMsl - terrainFt),
                baseMsl,
                topMsl
            });
            segStart = null;
            segCover = [];
        }
    }
    if (segStart) {
        const topPt = pts[pts.length - 1];
        const avgCov = segCover.reduce((a, b) => a + b, 0) / Math.max(1, segCover.length);
        const baseMsl = Math.round(segStart.baseFt);
        const topMsl = Math.max(baseMsl + 400, Math.round(topPt.geopotentialFt));
        layers.push({
            type: vpCoverageToCloudType(avgCov),
            baseAgl: Math.max(0, baseMsl - terrainFt),
            baseMsl,
            topMsl
        });
    }
    return layers;
}

async function fetchRouteWeatherOpenMeteo(routePts, elevData, signal) {
    if (!routePts || routePts.length < 2 || !elevData || elevData.length < 2) return null;
    if (window.vpWeatherDebug) window.vpWeatherDebug.profileRouteFetches += 1;
    const sampled = vpSampleRouteWeatherPoints(elevData, 5);
    if (!sampled || sampled.length < 3) return null;

    const samples = await window.fetchOpenMeteoWeatherPoints(sampled, { signal, includePressure: true, maxConcurrency: 6 });
    if (signal && signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const zones = [];
    for (let i = 0; i < sampled.length; i++) {
        const pt = sampled[i];
        const sample = samples[i];
        if (!sample) continue;
        const pressureProfile = Array.isArray(sample.pressureProfile) ? sample.pressureProfile : [];
        const clouds = vpDeriveCloudLayersFromPressureProfile(pressureProfile, pt.elevFt || 0);
        let lowestBase = Infinity;
        clouds.forEach(c => { if (c.baseMsl < lowestBase) lowestBase = c.baseMsl; });

        const hasRain = (sample.rainMm || 0) > 0.1 || (sample.precipitationMm || 0) > 0.25;
        const hasSnow = (sample.snowfallCm || 0) > 0.05;
        const hasTS = false;
        const estimatedCloud = vpBuildTempDewCloudLayer({
            temp2mC: sample.temp2mC,
            dewPoint2mC: sample.dewPoint2mC,
            rh2mPct: sample.rh2mPct,
            windKt: sample.wspd,
            terrainFt: pt.elevFt || 0,
            lowCloudPct: sample.cloudLowPct,
            coveragePct: sample.cloudTotalPct,
            weatherCode: sample.weatherCode,
            hasRain,
            hasSnow,
            source: 'openmeteo_temp_dew'
        });
        if (estimatedCloud && (!Number.isFinite(lowestBase) || estimatedCloud.baseMsl < lowestBase - 500)) {
            clouds.unshift(estimatedCloud);
            lowestBase = estimatedCloud.baseMsl;
        }
        const visuals = { puffs: [], drops: [], flashes: [] };
        if (clouds.length) for (let c = 0; c < 25; c++) visuals.puffs.push({ x: Math.random(), y: Math.random(), r: Math.random(), op: Math.random() });
        if (hasRain || hasSnow) for (let d = 0; d < 110; d++) visuals.drops.push({ x: Math.random(), y: Math.random(), spd: Math.random() });

        const cloudRef = Math.max(sample.cloudLowPct || 0, sample.cloudMidPct || 0, sample.cloudHighPct || 0);
        const fltCat = cloudRef > 85 ? 'IFR' : (cloudRef > 65 ? 'MVFR' : 'VFR');

        zones.push({
            distNM: pt.distNM,
            icao: `OM${String(i + 1).padStart(2, '0')}`,
            stnDist: 0,
            clouds,
            lowestBase: lowestBase !== Infinity ? lowestBase : 5000,
            weather: { hasRain, hasSnow, hasTS },
            visuals,
            stnLat: pt.lat,
            stnLon: pt.lon,
            fltCat: fltCat,
            raw: `OPEN-METEO CLOUD ${Math.round(sample.cloudTotalPct || 0)}%`,
            wdir: Math.round(sample.wdir || 0),
            wspd: Math.round(sample.wspd || 0),
            mslPressureHpa: sample.mslPressureHpa,
            pressureProfile: pressureProfile,
            wxSource: 'openmeteo'
        });
    }

    if (zones.length < 3) return null;
    return zones;
}

async function fetchRouteWeather(routePts, elevData, signal, options = {}) {
    vpWeatherDebugEvent('fetchRouteWeather dispatch');
    const source = String(options.source || window.vpWeatherSource || localStorage.getItem('ga_weather_source') || 'metar').toLowerCase() === 'openmeteo'
        ? 'openmeteo'
        : 'metar';
    const autoFallback = typeof options.autoFallback === 'boolean'
        ? options.autoFallback
        : vpIsWeatherAutoFallbackEnabled();
    const metarRouteKey = vpBuildMetarRouteCacheKey(routePts, elevData);
    if (source === 'openmeteo') {
        if (vpIsOpenMeteoCoolingDown()) {
            vpSetWeatherFallbackMode('openmeteo_to_metar', window.vpIsOpenMeteoDailyLimited?.() ? 'openmeteo daily limit' : 'openmeteo cooldown after 429');
            const metar = await fetchRouteWeatherMetar(routePts, elevData, signal, { fastFail: false });
            if (Array.isArray(metar) && metar.length > 0) vpSetMetarRouteCache(metarRouteKey, metar);
            return metar;
        }
        try {
            const om = await fetchRouteWeatherOpenMeteo(routePts, elevData, signal);
            if (vpHasUsableOpenMeteoRouteData(om)) {
                vpSetWeatherFallbackMode('none');
                return om;
            }
        } catch (e) {
            if (e && e.name === 'AbortError') throw e;
            console.warn('[Wetter] Open-Meteo fehlgeschlagen, Fallback auf METAR:', e);
            vpWeatherDebugSetError(e, 'openmeteo route');
        }
        if (!autoFallback && !window.vpIsOpenMeteoDailyLimited?.()) {
            vpSetWeatherFallbackMode('none', 'auto fallback disabled');
            vpWeatherDebugEvent('OM failed/incomplete, no METAR fallback (auto fallback disabled)');
            return null;
        }
        vpSetWeatherFallbackMode('openmeteo_to_metar', 'openmeteo failed/incomplete');
        const metar = await fetchRouteWeatherMetar(routePts, elevData, signal, { fastFail: false });
        if (Array.isArray(metar) && metar.length > 0) vpSetMetarRouteCache(metarRouteKey, metar);
        return metar;
    }

    const now = Date.now();
    const cachedMetar = vpGetMetarRouteCache(metarRouteKey, now);
    if (Array.isArray(cachedMetar) && cachedMetar.length > 0) {
        vpSetWeatherFallbackMode('none');
        return cachedMetar;
    }

    if (vpIsMetarCoolingDown(now)) {
        if (!autoFallback) {
            vpSetWeatherFallbackMode('none', 'auto fallback disabled');
            vpWeatherDebugEvent('METAR cooldown, no OM fallback (auto fallback disabled)');
            return null;
        }
        const probeDue = (now - Number(window.vpMetarRecoveryProbeAt || 0)) >= VP_METAR_RECOVERY_PROBE_MS;
        if (probeDue) {
            window.vpMetarRecoveryProbeAt = now;
            try {
                const recovered = await vpProbeMetarRecovery(routePts, elevData, signal);
                if (recovered) {
                    vpClearMetarFailure();
                    vpSetWeatherFallbackMode('none', 'metar recovered');
                } else {
                    vpSetWeatherFallbackMode('metar_to_openmeteo', 'metar cooldown active');
                }
            } catch (e) {
                if (e && e.name === 'AbortError') throw e;
                vpSetWeatherFallbackMode('metar_to_openmeteo', 'metar cooldown active');
            }
        } else {
            vpSetWeatherFallbackMode('metar_to_openmeteo', 'metar cooldown active');
        }
        if (!vpIsOpenMeteoCoolingDown(now)) {
            try {
                const omCd = await fetchRouteWeatherOpenMeteo(routePts, elevData, signal);
                if (vpHasUsableOpenMeteoRouteData(omCd)) return omCd;
            } catch (e) {
                if (e && e.name === 'AbortError') throw e;
                vpWeatherDebugSetError(e, 'metar cooldown openmeteo fallback');
            }
        }
    }

    let metarData = null;
    try {
        metarData = await fetchRouteWeatherMetar(routePts, elevData, signal, { fastFail: true });
    } catch (e) {
        if (e && e.name === 'AbortError') throw e;
        vpWeatherDebugSetError(e, 'metar route');
    }
    if (Array.isArray(metarData) && metarData.length > 0) {
        if (window.vpWeatherAutoFallbackFrom === 'metar') window.vpWeatherAutoFallbackFrom = null;
        vpClearMetarFailure();
        vpSetMetarRouteCache(metarRouteKey, metarData);
        vpSetWeatherFallbackMode('none');
        return metarData;
    }

    if (!autoFallback) {
        vpSetWeatherFallbackMode('none', 'auto fallback disabled');
        vpWeatherDebugEvent('METAR failed, no OM fallback (auto fallback disabled)');
        return metarData;
    }

    const metarInfraBlockedRecently = (Date.now() - Number(window.vpMetarLastInfraBlockAt || 0)) < 20 * 1000;
    vpMarkMetarFailure(
        metarInfraBlockedRecently ? 'metar infra blocked' : 'metar unavailable',
        metarInfraBlockedRecently ? VP_METAR_FAIL_COOLDOWN_SOFT_MS : VP_METAR_FAIL_COOLDOWN_MS
    );
    vpWeatherDebugEvent('METAR leer/failed -> versuche Open-Meteo Fallback');
    try { console.warn('[Wetter] METAR fehlgeschlagen, versuche Open-Meteo Fallback...'); } catch (_) {}

    if (!vpIsOpenMeteoCoolingDown()) {
        try {
            const om = await fetchRouteWeatherOpenMeteo(routePts, elevData, signal);
            if (vpHasUsableOpenMeteoRouteData(om)) {
                window.vpWeatherAutoFallbackFrom = 'metar';
                vpSetWeatherFallbackMode('metar_to_openmeteo', 'metar unavailable');
                vpWeatherDebugEvent('METAR -> OPEN-METEO auto fallback aktiv');
                return om;
            }
            vpWeatherDebugEvent('Open-Meteo Fallback lieferte keine verwertbaren Zonen');
        } catch (e) {
            if (e && e.name === 'AbortError') throw e;
            vpWeatherDebugSetError(e, 'metar fallback openmeteo route');
        }
    } else {
        vpWeatherDebugEvent('Open-Meteo Fallback wegen Cooldown/Tageslimit uebersprungen');
    }

    vpSetWeatherFallbackMode('metar_to_openmeteo', 'metar unavailable');
    return metarData;
}
// Globale Debug-Funktion für die Entwicklerkonsole
window.debugCloudProfile = function() {
    console.log("=== MANUELLER CLOUD DEBUG START ===");
    if (!routeWaypoints || routeWaypoints.length < 2) {
        console.warn("Bitte erst einen Flugauftrag generieren (Route fehlt).");
        return;
    }
    triggerVerticalProfileUpdate();
    console.log("Update angetriggert. Bitte das Profil-Canvas öffnen und die Logs beobachten.");
};
function vpDrawTerrainCover(ctx, xOf, yOf, elevData, viewMinX, viewMaxX, zoomFactor, maxAlt) {
    if (!elevData || elevData.length < 2) return;
    ctx.save();
    const prng = (s) => { let x = Math.sin(s) * 10000; return x - Math.floor(x); };
    
    // 1. WÄLDER (Dunkelgrüne Tannenzacken)
    ctx.fillStyle = '#1c3614'; 
    ctx.beginPath();
    
    for (let i = 0; i < elevData.length - 1; i++) {
        const p1 = elevData[i];
        const p2 = elevData[i+1];
        const startX = xOf(p1.distNM);
        const endX = xOf(p2.distNM);
        
        if (endX < viewMinX || startX > viewMaxX) continue;
        
        const dist = p2.distNM - p1.distNM;
        if (dist === 0) continue;
        const slope = Math.abs(p2.elevFt - p1.elevFt) / dist;
        
        const isForest = (p1.elevFt > 200 && p1.elevFt < 4500) && (slope > 80 || prng(i) > 0.5);
        
        if (isForest) {
            // PERFORMANCE & OPTIK FIX: Verhindert den "Blob" beim Rauszoomen
            const pixelDist = endX - startX;
            const maxTrees = Math.max(1, Math.floor(pixelDist / 6)); // Max 1 Baum alle 6 Pixel
            const numTrees = Math.min(Math.max(1, Math.floor(dist * 15)), maxTrees); 
            
            for(let t = 0; t < numTrees; t++) {
                const seed = i * 100 + t;
                if (prng(seed + 0.1) > 0.7) continue;
                
                const f = t / numTrees;
                const tx = startX + f * (endX - startX);
                const altFt = p1.elevFt + f * (p2.elevFt - p1.elevFt);
                const ty = yOf(altFt);
                
                // Bäume skalieren sanft runter, bleiben aber knackig
                const scale = Math.min(1, zoomFactor / 2.5);
                const treeHeight = Math.max(3, (5 + prng(seed + 0.2) * 8) * scale);
                const treeWidth = Math.max(2, (4 + prng(seed + 0.3) * 4) * scale);
                
                ctx.moveTo(tx - treeWidth/2, ty + 2);
                ctx.lineTo(tx, ty - treeHeight);
                ctx.lineTo(tx + treeWidth/2, ty + 2);
            }
        }
    }
    ctx.fill();
    
    // 2. ECHTE FLÜSSE UND AUTOBAHNEN (Linear Features aus Overpass / HDG-Korridor)
    // Im HDG-Modus: vpHdgLinearFeatures (entlang Heading gefiltert), sonst Route-Daten
    const _linRaw = (vpMode === 'HDG' && typeof vpHdgLinearFeatures !== 'undefined' && vpHdgLinearFeatures.length > 0)
        ? vpHdgLinearFeatures
        : (typeof vpLinearFeatures !== 'undefined' ? vpLinearFeatures : []);
    const majorRoadRx = /\b(A|B)\s?\d+\b/i;
    const isMajorRoadFeature = (feat) => {
        if (!feat || feat.type !== 'highway') return false;
        const kind = String(feat.lineKind || '').toLowerCase();
        if (kind === 'motorway' || kind === 'bundesstrasse') return true;
        const n = String(feat.name || '').trim();
        if (!n) return false;
        if (majorRoadRx.test(n)) return true; // Axx / Bxx
        const low = n.toLowerCase();
        return low.includes('autobahn') || low.includes('bundesstraße') || low.includes('bundesstrasse');
    };
    const isLinearTypeEnabled = (feat) => {
        if (!feat) return false;
        if (feat.type === 'highway') return !!vpShowRoads;
        if (feat.type === 'river') return !!vpShowRivers;
        if (feat.type === 'powerline') return !!vpShowPowerInfra;
        return false;
    };
    // Nähe-Clustering für überlappende Features: sauberer, weniger Clutter.
    const clusterLinearFeatures = (arr) => {
        const src = Array.isArray(arr) ? arr.slice().sort((a, b) => Number(a.distNM || 0) - Number(b.distNM || 0)) : [];
        const out = [];
        let i = 0;
        while (i < src.length) {
            const base = src[i];
            const type = String(base.type || '');
            const lineKind = String(base.lineKind || '');
            const thr = (type === 'river') ? 0.8 : (type === 'highway' ? 0.35 : 0.3);
            let sumDist = Number(base.distNM || 0);
            let sumLat = Number(base.lat || 0);
            let sumLon = Number(base.lon || 0);
            let cnt = 1;
            let bestName = String(base.name || '');
            let j = i + 1;
            while (j < src.length) {
                const cur = src[j];
                if (String(cur.type || '') !== type) break;
                if (String(cur.lineKind || '') !== lineKind) break;
                if (Math.abs(Number(cur.distNM || 0) - Number(src[j - 1].distNM || 0)) > thr) break;
                sumDist += Number(cur.distNM || 0);
                sumLat += Number(cur.lat || 0);
                sumLon += Number(cur.lon || 0);
                cnt++;
                if (!bestName && String(cur.name || '').trim()) bestName = String(cur.name || '');
                j++;
            }
            out.push({
                ...base,
                name: bestName || String(base.name || ''),
                distNM: sumDist / cnt,
                lat: sumLat / cnt,
                lon: sumLon / cnt,
                count: cnt
            });
            i = j;
        }
        return out;
    };
    let _linSrc = [];
    for (const feat of _linRaw) {
        if (!isLinearTypeEnabled(feat)) continue;
        if (Number(feat?.lateralNM || 999) > VP_LINEAR_ROUTE_CROSS_NM) continue;
        const d = Number(feat?.distNM || NaN);
        if (!Number.isFinite(d)) continue;
        const px = xOf(d);
        if (px < viewMinX - 80 || px > viewMaxX + 80) continue;
        if (feat.type === 'highway' && !isMajorRoadFeature(feat)) continue;
        if (feat.type === 'river') {
            const n = String(feat.name || '').toLowerCase();
            if (n.includes('wassertret') || n.includes('kneipp') || n.includes('wasserspiel')) continue;
        }
        _linSrc.push(feat);
    }
    _linSrc = clusterLinearFeatures(_linSrc);
    if ((vpShowRoads || vpShowRivers || vpShowPowerInfra) && _linSrc.length > 0) {
        const getElevY = (dNM) => {
            for(let i=0; i<elevData.length-1; i++) {
                if (dNM >= elevData[i].distNM && dNM <= elevData[i+1].distNM) {
                    const f = (dNM - elevData[i].distNM) / (elevData[i+1].distNM - elevData[i].distNM);
                    return yOf(elevData[i].elevFt + f * (elevData[i+1].elevFt - elevData[i].elevFt));
                }
            }
            return yOf(elevData[elevData.length-1].elevFt);
        };

        // Declutter mit Prioritäten (ausgezoomt dynamisch reduzieren)
        const occupied = [];
        const reserveBox = (l, r, t, b, prio) => occupied.push({ l, r, t, b, prio: Number(prio || 0) });
        const collidesWithHigher = (box, prio) => {
            for (const occ of occupied) {
                if (occ.prio >= prio && vpBoxesOverlap(box, occ, VP_DECLUTTER_COLLISION_PAD_PX)) return true;
            }
            return false;
        };

        // Blocker aus höchsten Prioritäten vorbereiten: Flugplätze > Städte > Windräder/hohe Türme > Strommasten
        if (Array.isArray(vpLandmarks) && vpLandmarks.length > 0) {
            for (const lm of vpLandmarks) {
                const d = Number(lm?.distNM || NaN);
                if (!Number.isFinite(d)) continue;
                const px = xOf(d);
                if (px < viewMinX - 80 || px > viewMaxX + 80) continue;
                const py = getElevY(d);
                const lt = String(lm?.type || '').toLowerCase();
                const prio = (lt === 'apt') ? 120 : ((lt === 'city') ? 110 : 102);
                reserveBox(px - 12, px + 12, py - 16, py + 14, prio);
            }
        }
        if (Array.isArray(vpObstacles) && vpObstacles.length > 0) {
            for (const obs of deduplicateFeatures(vpObstacles)) {
                const d = Number(obs?.distNM || NaN);
                if (!Number.isFinite(d)) continue;
                const px = xOf(d);
                if (px < viewMinX - 80 || px > viewMaxX + 80) continue;
                const py = getElevY(d);
                const t = String(obs?.type || '').toLowerCase();
                const h = Number(obs?.hFt || 0);
                let prio = 92; // hoher Turm
                if (t === 'wind') prio = 100;
                else if (t === 'power_tower') prio = 84;
                else if (h >= 700) prio = 96;
                reserveBox(px - 8, px + 8, py - 18, py + 10, prio);
            }
        }

        const linCandidates = _linSrc.slice().sort((a, b) => {
            const pa = vpLinearPriority(a);
            const pb = vpLinearPriority(b);
            if (pb !== pa) return pb - pa;
            return Number(a.distNM || 0) - Number(b.distNM || 0);
        });
        const _linRender = [];
        for (const feat of linCandidates) {
            const type = String(feat?.type || '').toLowerCase();
            const prio = vpLinearPriority(feat);
            const px = xOf(Number(feat?.distNM || 0));
            const py = getElevY(Number(feat?.distNM || 0));
            if (px < viewMinX - 50 || px > viewMaxX + 50) continue;

            const boxHalfW = (type === 'river') ? 6 : (type === 'highway' ? 5 : 7);
            const boxHalfH = (type === 'river') ? 5 : (type === 'highway' ? 4 : 6);
            const box = { l: px - boxHalfW, r: px + boxHalfW, t: py - boxHalfH, b: py + boxHalfH };

            if (collidesWithHigher(box, prio)) continue;

            _linRender.push(feat);
            reserveBox(box.l, box.r, box.t, box.b, prio);
        }

        // PERFORMANCE FIX: Layout nur 1x pro Zoom-Stufe, maxAlt UND aktueller Route berechnen!
        const routeKey = window._lastVpRouteKey || 'none';
        // Im HDG-Modus: Cache-Key enthält Heading → wird bei Kursänderung invalidiert
        const layoutKey = (vpMode === 'HDG')
            ? ('hdg_lin_' + (window.lastLiveGpsPos?.hdg || 0).toFixed(0) + '_' + zoomFactor.toFixed(2))
            : (routeKey + '_' + zoomFactor.toFixed(2) + '_' + (maxAlt || 0).toFixed(0));

        // Neu berechnen, wenn sich der Cache-Key ändert ODER die Features noch keine Render-Daten haben
        if (!window._vpLinearLayouts || window._vpLinearLayouts.key !== layoutKey || (_linRender.length > 0 && !_linRender[0]._render)) {
            let occupiedSigns = [];
            for (const feat of _linRender) {
                const px = xOf(feat.distNM);
                const py = getElevY(feat.distNM);
                feat._render = { px, py, drawName: false, labelY: 0, tw: 0 };
                
                if (feat.name && zoomFactor >= 1.2 && feat.type !== 'powerline') {
                    ctx.font = feat.type === 'river' ? 'bold 8px Arial' : 'bold 7px Arial';
                    const tw = ctx.measureText(feat.name).width;
                    feat._render.tw = tw;
                    let labelY = feat.type === 'river' ? py + 15 : (feat.type === 'powerline' ? py - 20 : py - 14);
                    let collision = true, attempts = 0;
                    while(collision && attempts < 4) {
                        collision = false;
                        for(let occ of occupiedSigns) {
                            if (px - tw/2 - 3 < occ.r && px + tw/2 + 3 > occ.l && labelY < occ.b && labelY + 10 > occ.t) { collision = true; break; }
                        }
                        if(collision) { labelY += (feat.type === 'river' ? 10 : -12); attempts++; }
                    }
                    if(!collision) {
                        occupiedSigns.push({l: px - tw/2 - 2, r: px + tw/2 + 2, t: labelY, b: labelY + 10});
                        feat._render.drawName = true;
                        // FIX: Wir merken uns nur den Pixel-Abstand zum Boden, nicht die absolute Höhe!
                        feat._render.labelYOffset = labelY - py;
                    }
                }
            }
            window._vpLinearLayouts = { key: layoutKey, occ: occupiedSigns };
            window.vpLinearOccupied = occupiedSigns; 
        }

        // NUR NOCH ZEICHNEN (mit weichem Culling)
        for (const feat of _linRender) {
            if (!feat._render) continue;
            
            // FIX: X und Y live berechnen, damit Schilder mit der Bodenlinie wandern
            const px = xOf(feat.distNM);
            const py = getElevY(feat.distNM);
            if (px < viewMinX - 50 || px > viewMaxX + 50) continue;
            
            if (feat.type === 'river') {
                if (VP_PROFILE_LINEAR_ICON_STYLE === 'r2f1') {
                    // F1+: Doppelwelle mit "eingeschnittenem" Unterzug fürs Terrain-Gefühl
                    ctx.strokeStyle = 'rgba(8, 34, 68, 0.42)';
                    ctx.lineWidth = 2.5;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(px - 7.3, py + 4.2);
                    ctx.quadraticCurveTo(px - 5.8, py + 2.6, px - 4.4, py + 4.2);
                    ctx.quadraticCurveTo(px - 3.0, py + 5.8, px - 1.6, py + 4.2);
                    ctx.quadraticCurveTo(px - 0.2, py + 2.6, px + 1.2, py + 4.2);
                    ctx.quadraticCurveTo(px + 2.6, py + 5.8, px + 4.0, py + 4.2);
                    ctx.quadraticCurveTo(px + 5.4, py + 2.6, px + 7.1, py + 4.2);
                    ctx.stroke();

                    // Hauptwasserlauf
                    ctx.strokeStyle = '#61b6ff';
                    ctx.lineWidth = 1.25;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(px - 7.2, py + 0.4);
                    ctx.quadraticCurveTo(px - 5.8, py - 1.2, px - 4.4, py + 0.4);
                    ctx.quadraticCurveTo(px - 3.0, py + 2.0, px - 1.6, py + 0.4);
                    ctx.quadraticCurveTo(px - 0.2, py - 1.2, px + 1.2, py + 0.4);
                    ctx.quadraticCurveTo(px + 2.6, py + 2.0, px + 4.0, py + 0.4);
                    ctx.quadraticCurveTo(px + 5.4, py - 1.2, px + 7.0, py + 0.4);
                    ctx.stroke();

                    ctx.strokeStyle = '#c8ebff';
                    ctx.lineWidth = 1.0;
                    ctx.beginPath();
                    ctx.moveTo(px - 7.2, py + 2.8);
                    ctx.quadraticCurveTo(px - 5.8, py + 1.3, px - 4.4, py + 2.8);
                    ctx.quadraticCurveTo(px - 3.0, py + 4.3, px - 1.6, py + 2.8);
                    ctx.quadraticCurveTo(px - 0.2, py + 1.3, px + 1.2, py + 2.8);
                    ctx.quadraticCurveTo(px + 2.6, py + 4.3, px + 4.0, py + 2.8);
                    ctx.quadraticCurveTo(px + 5.4, py + 1.3, px + 7.0, py + 2.8);
                    ctx.stroke();
                } else {
                    // legacy river icon
                    ctx.fillStyle = '#3498db';
                    ctx.beginPath();
                    ctx.moveTo(px - 4, py - 1);
                    ctx.lineTo(px - 2, py + 5);
                    ctx.lineTo(px + 2, py + 5);
                    ctx.lineTo(px + 4, py - 1);
                    ctx.fill();
                }
                if (feat._render.drawName) {
                    const labelY = py + feat._render.labelYOffset;
                    ctx.fillStyle = '#3498db';
                    ctx.font = 'bold 8px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(feat.name, px, labelY + 8);
                }
            } else if (feat.type === 'highway') {
                if (VP_PROFILE_LINEAR_ICON_STYLE === 'r2f1') {
                    // R2: Double-Lane hell
                    ctx.strokeStyle = '#cfd6e5';
                    ctx.lineWidth = 1.8;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(px - 7.2, py - 1.2);
                    ctx.lineTo(px + 7.2, py - 1.2);
                    ctx.stroke();

                    ctx.strokeStyle = '#aeb9cf';
                    ctx.beginPath();
                    ctx.moveTo(px - 7.2, py + 1.8);
                    ctx.lineTo(px + 7.2, py + 1.8);
                    ctx.stroke();

                    ctx.strokeStyle = '#fff2be';
                    ctx.lineWidth = 0.95;
                    ctx.beginPath();
                    ctx.moveTo(px - 3.8, py + 0.3); ctx.lineTo(px - 2.1, py + 0.3);
                    ctx.moveTo(px - 0.8, py + 0.3); ctx.lineTo(px + 0.9, py + 0.3);
                    ctx.moveTo(px + 2.2, py + 0.3); ctx.lineTo(px + 3.9, py + 0.3);
                    ctx.stroke();
                } else {
                    // legacy road icon
                    ctx.fillStyle = '#555';
                    ctx.fillRect(px - 3, py - 2, 6, 4);
                    ctx.fillStyle = '#f2c12e';
                    ctx.fillRect(px - 1, py - 1, 2, 2);
                }
                if (feat._render.drawName) {
                    const labelY = py + feat._render.labelYOffset;
                    ctx.fillStyle = '#1a73e8';
                    ctx.fillRect(px - feat._render.tw/2 - 2, labelY, feat._render.tw + 4, 10);
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 7px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(feat.name, px, labelY + 8);
                }
            } else if (feat.type === 'powerline') {
                const lineKind = String(feat.lineKind || '').toLowerCase();
                const isCable = lineKind === 'cable';
                const isMajor = lineKind === 'line' || (!lineKind && VP_PROFILE_LINEAR_ICON_STYLE === 'r2f1');

                if (isCable) {
                    // Kabel: eher schlank/diskret, ohne hohe Masten
                    ctx.strokeStyle = 'rgba(198, 228, 255, 0.9)';
                    ctx.lineWidth = 1.0;
                    ctx.setLineDash([2.2, 1.8]);
                    ctx.beginPath();
                    ctx.moveTo(px - 8.2, py - 1.6);
                    ctx.quadraticCurveTo(px, py + 1.6, px + 8.2, py - 1.6);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.fillStyle = 'rgba(236, 246, 255, 0.9)';
                    ctx.beginPath();
                    ctx.arc(px, py + 0.4, 0.9, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    // Freileitung: major/minor visuell unterscheiden
                    const poleH = isMajor ? 8 : 6.6;
                    const wireY = isMajor ? -4.8 : -3.8;
                    const sagY = isMajor ? 0.8 : 0.4;
                    const poleStroke = isMajor ? 'rgba(220, 236, 255, 0.96)' : 'rgba(190, 222, 248, 0.92)';
                    const wireStroke = isMajor ? 'rgba(240, 248, 255, 0.96)' : 'rgba(211, 235, 255, 0.9)';
                    const boltStroke = isMajor ? '#ffd85f' : '#bfe7ff';

                    ctx.strokeStyle = poleStroke;
                    ctx.lineWidth = isMajor ? 1.05 : 0.95;
                    ctx.beginPath();
                    ctx.moveTo(px - 8, py + 8); ctx.lineTo(px - 8, py - poleH);
                    ctx.moveTo(px + 8, py + 8); ctx.lineTo(px + 8, py - poleH);
                    ctx.stroke();

                    ctx.strokeStyle = wireStroke;
                    ctx.lineWidth = isMajor ? 1.1 : 0.95;
                    ctx.beginPath();
                    ctx.moveTo(px - 7.6, py + wireY);
                    ctx.quadraticCurveTo(px, py + sagY, px + 7.6, py + wireY);
                    if (isMajor) {
                        ctx.moveTo(px - 7.1, py + wireY - 1.6);
                        ctx.quadraticCurveTo(px, py + sagY - 1.6, px + 7.1, py + wireY - 1.6);
                    }
                    ctx.stroke();

                    ctx.strokeStyle = boltStroke;
                    ctx.lineWidth = 1;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.beginPath();
                    ctx.moveTo(px + 0.5, py - 3.4);
                    ctx.lineTo(px - 1.1, py + 0.2);
                    ctx.lineTo(px + 1.4, py + 0.2);
                    ctx.lineTo(px - 0.2, py + 4.1);
                    ctx.stroke();
                }

                if (feat._render.drawName) {
                    const labelY = py + feat._render.labelYOffset;
                    ctx.fillStyle = '#7d2632';
                    ctx.fillRect(px - feat._render.tw/2 - 2, labelY, feat._render.tw + 4, 10);
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 7px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(feat.name, px, labelY + 8);
                }
            }
            if (Number(feat.count || 1) > 1) {
                ctx.fillStyle = 'rgba(236, 239, 244, 0.95)';
                ctx.font = 'bold 8px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('×' + String(feat.count), px, py + 12);
            }
        }
    }
    ctx.restore();
}
function vpDrawLandmarks(ctx, xOf, yOf, elevData, totalDist, isDarkTheme, zoomFactor, maxAlt, lmOverride = null) {
    const _landmarks = lmOverride !== null ? lmOverride : vpLandmarks;
    if (!_landmarks || _landmarks.length === 0) return;
    const lmPrio = (lm) => {
        const t = String(lm?.type || '').toLowerCase();
        if (t === 'apt') return 3;
        if (t === 'city') return 2;
        return 1;
    };
    const lmOrdered = _landmarks.slice().sort((a, b) => {
        const dp = lmPrio(b) - lmPrio(a);
        if (dp) return dp;
        return Number(b?.pop || 0) - Number(a?.pop || 0);
    });
    const getElevY = (dNM) => {
        if (!elevData || elevData.length < 2) return yOf(0);
        for(let i=0; i<elevData.length-1; i++) {
            if (dNM >= elevData[i].distNM && dNM <= elevData[i+1].distNM) {
                const f = (dNM - elevData[i].distNM) / (elevData[i+1].distNM - elevData[i].distNM);
                return yOf(elevData[i].elevFt + f * (elevData[i+1].elevFt - elevData[i].elevFt));
            }
        }
        return yOf(elevData[elevData.length-1].elevFt);
    };
    
    // PERFORMANCE FIX: Kollisionen nur 1x pro Zoom-Stufe, maxAlt UND aktueller Route berechnen
    const routeKey = window._lastVpRouteKey || 'none';
    const layoutKey = routeKey + '_' + zoomFactor.toFixed(2) + '_' + (maxAlt || 0).toFixed(0)
        + '_' + (vpShowRoads ? 'R1' : 'R0')
        + '_' + (vpShowRivers ? 'V1' : 'V0')
        + '_' + (vpShowPowerInfra ? 'P1' : 'P0');
    
    // Im HDG-Modus: kein Layout-Cache, immer neu berechnen (distNM ändert sich mit Kurs)
    const isHdgLm = lmOverride !== null;
    const hdgLmKey = isHdgLm ? ('hdg_' + (window.lastLiveGpsPos?.hdg || 0).toFixed(0) + '_' + zoomFactor.toFixed(2)) : null;
    const effectiveLayoutKey = isHdgLm ? hdgLmKey : layoutKey;

    if (!window._vpLandmarkLayouts || window._vpLandmarkLayouts.key !== effectiveLayoutKey || (_landmarks.length > 0 && !_landmarks[0]._render)) {
        let globalOccupiedX = [];
        const nmPerPx = totalDist / (xOf(totalDist) - xOf(0));
        const edgePad = Math.min(2.5, totalDist * 0.05);
        ctx.font = `bold ${(zoomFactor >= 1.5 ? 10 : 8)}px Arial`; // Setup für measureText

        for (const lm of lmOrdered) {
            lm._render = null;
            if (lm.distNM < edgePad || lm.distNM > totalDist - edgePad) continue;
            
            const px = xOf(lm.distNM);
            const icon = lm.type === 'apt' ? '🛫' : (lm.type === 'city' ? '🏢' : '🏘️');
            const fontSize = (zoomFactor >= 1.5) ? 10 : 8;

            let iconScale = 1.0;
            if (lm.type !== 'apt') {
                const p = Math.max(5000, Math.min(1000000, lm.pop || 5000));
                const logPop = Math.log10(p);
                let factor = (logPop - 3.7) / 2.3;
                iconScale = Math.min((zoomFactor >= 1.5 ? 2.5 : 1.5), 0.5 + Math.max(0, Math.min(1, factor)) * 2.0);
            } else iconScale = 1.2;
            
            const iconFontSize = Math.max(8, Math.round(11 * iconScale));
            const iconOffsetY = Math.round(iconFontSize * 0.55);
            
            const textWidth = ctx.measureText(lm.name).width;
            const reqWidth = Math.max(textWidth, iconFontSize + 4) + 6;
            
            let shiftAttempts = 0, currentDistNM = lm.distNM, currentPx = px, currentPy = getElevY(lm.distNM);
            let collision = true, finalMinX, finalMaxX;

            while (collision && shiftAttempts < 12) {
                collision = false;
                finalMinX = currentPx - reqWidth / 2;
                finalMaxX = currentPx + reqWidth / 2;
                const boxT = currentPy - iconOffsetY - iconFontSize;
                const boxB = currentPy + 20;

                for (const occ of globalOccupiedX) {
                    if (finalMinX < occ.maxX && finalMaxX > occ.minX) { collision = true; break; }
                }
                if (!collision && window.vpLinearOccupied) {
                    for (const occ of window.vpLinearOccupied) {
                        if (finalMinX < occ.r && finalMaxX > occ.l && boxT < occ.b && boxB > occ.t) { collision = true; break; }
                    }
                }
                if (collision) {
                    shiftAttempts++;
                    const shiftPx = (shiftAttempts % 2 !== 0 ? -1 : 1) * Math.ceil(shiftAttempts / 2) * 8;
                    currentDistNM = lm.distNM + (shiftPx * nmPerPx);
                    currentPx = xOf(currentDistNM);
                    currentPy = getElevY(currentDistNM); 
                }
            }

            if (!collision) {
                globalOccupiedX.push({ minX: finalMinX, maxX: finalMaxX, t: currentPy - iconOffsetY - iconFontSize, b: currentPy + 20 });
                // FIX: Wir cachen nur die Distanz (inkl. Ausweich-Shift), die Pixelhöhe wird im Render-Loop LIVE berechnet!
                lm._render = { distNM: currentDistNM, icon, iconFontSize, iconOffsetY, fontSize };
            }
        }
        window._vpLandmarkLayouts = { key: effectiveLayoutKey, occ: globalOccupiedX };
        window.vpLandmarkOccupiedX = globalOccupiedX;
    }
    
    // NUR NOCH ZEICHNEN (Schnell, ohne jegliche Kollisions-Logik)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    let viewMinX = -Infinity, viewMaxX = Infinity;
    if (ctx.canvas && (ctx.canvas.id === 'mapProfileCanvasBg' || ctx.canvas.id === 'mapProfileCanvas')) {
        const sc = document.getElementById('mapProfileScroll');
        if (sc) { viewMinX = sc.scrollLeft - 100; viewMaxX = sc.scrollLeft + sc.clientWidth + 100; }
    }

    for (const lm of lmOrdered) {
        if (!lm._render) continue;

        // FIX: X und Y Pixel in Echtzeit anhand der aktuellen Skalierung berechnen
        const px = xOf(lm._render.distNM);
        const py = getElevY(lm._render.distNM);
        
        if (px < viewMinX || px > viewMaxX) continue;
        
        ctx.font = lm._render.iconFontSize + 'px Arial';
        ctx.fillStyle = '#ffffff'; 
        ctx.fillText(lm._render.icon, px, py - lm._render.iconOffsetY);
        
        if (!window.vpIsFastRendering) {
            ctx.font = `bold ${lm._render.fontSize}px Arial`;
            ctx.fillStyle = isDarkTheme ? 'rgba(190, 180, 160, 0.7)' : 'rgba(70, 60, 40, 0.7)';
            ctx.fillText(lm.name, px, py + 10); 
        }
    }
    ctx.restore();
}
function vpDrawObstacles(ctx, xOf, yOf, totalDist, zoomFactor, elevData, timeMs = 0, obsOverride = null) {
    if (obsOverride !== null) { const _orig = vpObstacles; vpObstacles = obsOverride; const r = vpDrawObstacles(ctx, xOf, yOf, totalDist, zoomFactor, elevData, timeMs, null); vpObstacles = _orig; return r; }
    if (!vpObstacles || vpObstacles.length === 0) return;
    const obsToDraw = deduplicateFeatures(vpObstacles);
    if (!obsToDraw.length) return;
    const edgePad = Math.min(1.0, totalDist * 0.02);
    const activeLin = (vpMode === 'HDG' && Array.isArray(window.vpHdgLinearFeatures) && window.vpHdgLinearFeatures.length > 0)
        ? window.vpHdgLinearFeatures
        : (Array.isArray(vpLinearFeatures) ? vpLinearFeatures : []);
    const isLikelyPowerTower = (obs) => {
        const t = String(obs?.type || '').toLowerCase();
        if (t === 'power_tower') return true;
        if (!(t === 'mast' || t === 'tower')) return false;
        const oDist = Number(obs?.distNM || NaN);
        const oLat = Number(obs?.lateralNM || 999);
        if (!Number.isFinite(oDist)) return false;
        for (const feat of activeLin) {
            if (String(feat?.type || '').toLowerCase() !== 'powerline') continue;
            const fDist = Number(feat?.distNM || NaN);
            const fLat = Number(feat?.lateralNM || 999);
            if (!Number.isFinite(fDist)) continue;
            if (Math.abs(fDist - oDist) <= VP_POWERLINE_MAST_MATCH_DIST_NM &&
                (oLat <= VP_POWERLINE_MAST_LATERAL_NM || fLat <= VP_POWERLINE_MAST_LATERAL_NM)) {
                return true;
            }
        }
        return false;
    };
    
    const getElevY = (dNM) => {
        if (!elevData || elevData.length < 2) return yOf(0);
        let low = 0, high = elevData.length - 2;
        while (low <= high) {
            let mid = (low + high) >> 1;
            if (dNM < elevData[mid].distNM) high = mid - 1;
            else if (dNM > elevData[mid+1].distNM) low = mid + 1;
            else {
                const p1 = elevData[mid], p2 = elevData[mid+1];
                const f = (dNM - p1.distNM) / (p2.distNM - p1.distNM || 1);
                return yOf(p1.elevFt + f * (p2.elevFt - p1.elevFt));
            }
        }
        return yOf(elevData[elevData.length - 1].elevFt);
    };

    let viewMinX = -Infinity, viewMaxX = Infinity;
    if (ctx.canvas.id === 'mapProfileCanvas') {
        const sc = document.getElementById('mapProfileScroll');
        if (sc) { viewMinX = sc.scrollLeft - 200; viewMaxX = sc.scrollLeft + sc.clientWidth + 200; }
    }
    
    ctx.save();
    
    // 1. Alle Masten zeichnen und Label-Positionen sammeln
    let rawLabels = [];
    
    for (const obs of obsToDraw) {
        if (obs.distNM < edgePad || obs.distNM > totalDist - edgePad) continue;
        if (!vpShowPowerInfra && String(obs?.type || '').toLowerCase() === 'power_tower') continue;
        const px = xOf(obs.distNM);
        if (px < viewMinX || px > viewMaxX) continue; // CULLING
        const pyGround = getElevY(obs.distNM);
        const trueHeightPx = Math.abs(yOf(obs.hFt) - yOf(0));
        
        // Der Mast steckt leicht im Boden (vorher tiefer), wirkt dadurch etwas höher aufgesetzt
        const pyRoot = pyGround + 6; 

        if (obs.type === 'wind') {
            // FIX: Die "echte" sichtbare Länge ist die Höhe über Grund PLUS die 8px im Boden!
            const visualTotalHeight = trueHeightPx + 8;
            
            // Blätter sind jetzt immer ca. 45% des ECHTEN sichtbaren Mastes (mindestens 4px)
            const r = Math.max(4, visualTotalHeight * 0.45);
            
            // Die Nabe sitzt so, dass das obere Blatt genau an der echten Spitze kratzt
            const pyTop = pyGround - trueHeightPx;
            const pyHub = pyTop + r;

            ctx.beginPath(); ctx.moveTo(px, pyRoot); ctx.lineTo(px, pyHub);
            ctx.strokeStyle = 'rgba(230, 230, 230, 0.9)'; ctx.lineWidth = 1.5; ctx.stroke();

            ctx.fillStyle = '#f5f5f5'; ctx.strokeStyle = 'rgba(150, 150, 150, 0.6)'; ctx.lineWidth = 0.5;
            const rotSpeed = 0.0015;
            const rotOffset = ((obs.distNM * 137) + (timeMs * rotSpeed)) % (Math.PI * 2);
            for (let i = 0; i < 3; i++) {
                const a = rotOffset + (i * 120 - 90) * Math.PI / 180;
                ctx.beginPath();
                ctx.moveTo(px, pyHub);
                ctx.lineTo(px + Math.cos(a - 0.2) * r * 0.25, pyHub + Math.sin(a - 0.2) * r * 0.25);
                ctx.lineTo(px + Math.cos(a) * r,               pyHub + Math.sin(a) * r);
                ctx.lineTo(px + Math.cos(a + 0.2) * r * 0.25, pyHub + Math.sin(a + 0.2) * r * 0.25);
                ctx.closePath(); ctx.fill(); ctx.stroke();
            }
            // Nabe wächst proportional mit
            ctx.beginPath(); ctx.arc(px, pyHub, Math.max(1.5, r * 0.15), 0, Math.PI * 2); ctx.fillStyle = '#ccc'; ctx.fill();
        } else {
            // Normale Masten/Türme: dynamisch skalieren wie Windrad-Symbolik,
            // aber bewusst nur 50% der visuellen Gesamtgröße.
            const visualTotalHeight = trueHeightPx + 8;
            const obsType = String(obs?.type || '').toLowerCase();
            const isPowerTower = (obsType === 'power_tower') || isLikelyPowerTower(obs);
            const mastVisualHeight = isPowerTower
                ? Math.max(10, visualTotalHeight * 0.75)
                : Math.max(7, visualTotalHeight * 0.5);
            const pyTop = pyRoot - mastVisualHeight;

            if (isPowerTower) {
                // A3: technischer Strommast (ohne Bodenstrich)
                const halfW = Math.max(2.8, mastVisualHeight * 0.17);
                const armYTop = pyTop + Math.max(1.6, mastVisualHeight * 0.24);
                const armYMid = pyTop + Math.max(3.0, mastVisualHeight * 0.5);
                const pyBase = pyRoot - 0.8; // kein sichtbarer Bodenstrich
                ctx.strokeStyle = 'rgba(214, 228, 245, 0.98)';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(px - halfW, pyBase); ctx.lineTo(px - 0.9, pyTop);
                ctx.moveTo(px + halfW, pyBase); ctx.lineTo(px + 0.9, pyTop);
                ctx.moveTo(px - halfW * 1.02, armYTop); ctx.lineTo(px + halfW * 1.02, armYTop);
                ctx.moveTo(px - halfW * 0.72, armYMid); ctx.lineTo(px + halfW * 0.72, armYMid);
                ctx.moveTo(px - halfW * 0.9, armYTop); ctx.lineTo(px - halfW * 1.22, armYTop + 1.1);
                ctx.moveTo(px + halfW * 0.9, armYTop); ctx.lineTo(px + halfW * 1.22, armYTop + 1.1);
                ctx.stroke();
            } else {
                // A1: allgemeiner Turm/Mast (feines Gitter)
                const halfW = Math.max(2.5, mastVisualHeight * 0.16);
                const armY1 = pyTop + Math.max(1.6, mastVisualHeight * 0.26);
                const armY2 = pyTop + Math.max(2.8, mastVisualHeight * 0.52);
                const armY3 = pyTop + Math.max(3.8, mastVisualHeight * 0.75);
                ctx.strokeStyle = 'rgba(220, 236, 255, 0.96)';
                ctx.lineWidth = 1.1;
                ctx.beginPath();
                ctx.moveTo(px - halfW, pyRoot); ctx.lineTo(px, pyTop);
                ctx.moveTo(px + halfW, pyRoot); ctx.lineTo(px, pyTop);
                ctx.moveTo(px - halfW * 0.72, armY1); ctx.lineTo(px + halfW * 0.72, armY1);
                ctx.moveTo(px - halfW * 0.55, armY2); ctx.lineTo(px + halfW * 0.55, armY2);
                ctx.moveTo(px - halfW * 0.42, armY3); ctx.lineTo(px + halfW * 0.42, armY3);
                ctx.stroke();
            }

            // ANIMATION: Blinklicht – Strommast etwas amber, sonst rot.
            const blink = 0.3 + 0.6 * (Math.sin(timeMs * 0.005 + obs.distNM * 50) * 0.5 + 0.5);
            const beaconR = Math.max(2, mastVisualHeight * 0.16);
            const beaconColor = isPowerTower
                ? `rgba(255, 170, 70, ${blink})`
                : `rgba(217, 56, 41, ${blink})`;
            ctx.beginPath(); ctx.arc(px, pyTop, beaconR, 0, Math.PI * 2); ctx.fillStyle = beaconColor; ctx.fill();
        }

        rawLabels.push({ x: px, yBase: pyRoot, count: obs.count || 1 });
    }
    
    if (window.vpIsFastRendering) { ctx.restore(); return; } // Performance-Culling
    
    // 2. Labels abhängig vom Zoom/Pixelabstand clustern
    rawLabels.sort((a, b) => a.x - b.x);
    let clusters = [];
    const MIN_LABEL_DIST = 16; 

    for (const lbl of rawLabels) {
        if (clusters.length === 0) {
            clusters.push({ sumX: lbl.x, sumY: lbl.yBase, count: lbl.count, items: 1 });
        } else {
            let last = clusters[clusters.length - 1];
            let avgX = last.sumX / last.items; 
            
            if (lbl.x - avgX < MIN_LABEL_DIST) {
                last.sumX += lbl.x;
                last.sumY += lbl.yBase;
                last.count += lbl.count;
                last.items += 1;
            } else {
                clusters.push({ sumX: lbl.x, sumY: lbl.yBase, count: lbl.count, items: 1 });
            }
        }
    }

    // 3. Cluster-Labels zeichnen (ohne Schatten, reine Schrift)
    ctx.fillStyle = '#d93829';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (const cl of clusters) {
        if (cl.count <= 1) continue; 
        
        const px = cl.sumX / cl.items;
        const pyBase = cl.sumY / cl.items;
        
        let collision = false;
        const textWidth = 18; 
        const minX = px - textWidth / 2;
        const maxX = px + textWidth / 2;
        
        if (window.vpLandmarkOccupiedX) {
            for (const occ of window.vpLandmarkOccupiedX) {
                if (minX < occ.maxX + 2 && maxX > occ.minX - 2) {
                    collision = true; break;
                }
            }
        }
        
        if (!collision) {
            ctx.fillText('×' + cl.count, px, pyBase + 2);
        }
    }
    
    ctx.restore();
}

function vpDrawClouds(ctx, xOf, yOf, padTop, plotH, totalDist, isDarkTheme, elevData) {
    if (!vpWeatherData || vpWeatherData.length === 0) return;
    const getElevY = (dNM) => {
        if (!elevData || elevData.length < 2) return yOf(0);
        for(let i=0; i<elevData.length-1; i++) {
            if (dNM >= elevData[i].distNM && dNM <= elevData[i+1].distNM) {
                const f = (dNM - elevData[i].distNM) / (elevData[i+1].distNM - elevData[i].distNM);
                return yOf(elevData[i].elevFt + f * (elevData[i+1].elevFt - elevData[i].elevFt));
            }
        }
        return yOf(elevData[elevData.length-1].elevFt);
    };

    // KEIN Culling für Layer 1 (Wird nativ von der GPU gescrollt)
    let viewMinX = -Infinity, viewMaxX = Infinity;
    // Stabiler, deterministischer Pseudo-Zufallsgenerator gegen Flackern
    const prng = (s) => { let x = Math.sin(s) * 10000; return x - Math.floor(x); };
    ctx.save();
    for (let i = 0; i < vpWeatherData.length; i++) {
        const zone = vpWeatherData[i];
        const prevDist = (i > 0) ? (zone.distNM + vpWeatherData[i-1].distNM)/2 : Math.max(0, zone.distNM - totalDist*0.05);
        const nextDist = (i < vpWeatherData.length - 1) ? (zone.distNM + vpWeatherData[i+1].distNM)/2 : Math.min(totalDist, zone.distNM + totalDist*0.05);
        const startX = xOf(prevDist), endX = xOf(nextDist), width = endX - startX, midX = startX + width/2;
        
        if (endX < viewMinX || startX > viewMaxX) continue; // CULLING
        // 3. WOLKEN (PUFFS) – Zoom-adaptiv, isolierte Zellen für FEW/SCT
        if (zone.clouds && zone.clouds.length > 0) {
            zone.clouds.forEach((c, cIdx) => {
                const baseY = yOf(c.baseMsl);
                let thicknessFt = 600, baseColor = isDarkTheme ? 210 : 255;
                let coverage = 1.0, radiusMult = 1.0, numCells = 4;
                // Logik für isolierte Grüppchen (mehr Zellen = kleinere Wölkchen)
                if (c.type === 'FEW') { thicknessFt = 800; coverage = 0.22; radiusMult = 0.35; numCells = 16; }
                else if (c.type === 'SCT') { thicknessFt = 1500; baseColor -= 15; coverage = 0.45; radiusMult = 0.6; numCells = 10; }
                else if (c.type === 'BKN') { thicknessFt = 3000; baseColor -= 40; coverage = 0.80; radiusMult = 0.9; numCells = 6; }
                else if (c.type === 'OVC' || c.type === 'VV') { thicknessFt = 5000; baseColor -= 70; coverage = 1.0; }
                if (zone.weather && zone.weather.hasTS) { thicknessFt = Math.max(thicknessFt, 12000); baseColor -= 60; coverage = 1.0; radiusMult = 1.1; numCells = 4; }
                if (Number.isFinite(c.topMsl) && c.topMsl > c.baseMsl + 150) thicknessFt = Math.max(400, c.topMsl - c.baseMsl);
                const topY = yOf(c.baseMsl + thicknessFt), layerHeight = baseY - topY;
                if (baseY < padTop - 20 || topY > padTop + plotH + 20) return;
                // Zoom-abhängige Skalierung: Beim Rauszoomen wird 'width' klein -> Wolken werden winzig!
                const maxRadiusY = Math.abs(yOf(1000) - yOf(0));
                const maxRadiusX = width * (2.5 / numCells);
                const maxR = Math.max(2, Math.min(maxRadiusY, maxRadiusX)) * radiusMult;

                const seedBase = i * 100 + cIdx * 10;

                ctx.save();
                ctx.beginPath();
                ctx.rect(startX - 2000, 0, width + 4000, baseY);
                ctx.clip();
                const numPuffs = c.type === 'FEW' ? 40 : 60;
                for (let p = 0; p < numPuffs; p++) {
                    const pxRand = prng(seedBase + p + 0.1);

                    const cellIndex = Math.floor(pxRand * numCells);
                    const cellActive = prng(seedBase + cellIndex * 77) < coverage;
                    if (!cellActive) continue;
                    let localPx = pxRand;
                    // Bei FEW/SCT zwingen wir die Puffs in die Mitte der Zelle (0.2 bis 0.8), um Gaps zu garantieren!
                    if (c.type === 'FEW' || c.type === 'SCT') {
                        const cellStart = cellIndex / numCells;
                        const puffInCell = prng(seedBase + p + 0.5);
                        localPx = cellStart + (0.2 + puffInCell * 0.6) / numCells;
                    }
                    const pyRand = prng(seedBase + p + 0.2);
                    const prRand = prng(seedBase + p + 0.3);
                    const opRand = prng(seedBase + p + 0.4);
                    // OVC überlappt stark, FEW/SCT bleiben strikt in ihrer Zone
                    const px = (c.type === 'FEW' || c.type === 'SCT')
                        ? startX + localPx * width
                        : startX + (localPx * 1.2 - 0.1) * width;
                    const py = baseY - pyRand * layerHeight;
                    const pr = 2 + prRand * maxR;

                    const cVal = Math.floor(baseColor - opRand * 30);
                    const alpha = (c.type === 'FEW') ? (0.15 + opRand * 0.2) : ((c.type === 'SCT') ? (0.3 + opRand * 0.3) : (0.5 + opRand * 0.4));

                    ctx.beginPath();
                    ctx.arc(px, py, pr, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(${cVal},${cVal},${cVal},${alpha})`;

                    // Performance-Fix: Weiche Ränder deaktivieren, während UI-Interaktion ODER Fast-Render-Modus aktiv ist!
                    const isDragging = (typeof vpDraggingWP !== 'undefined' && vpDraggingWP >= 0) ||
                                       (typeof vpDraggingSegment !== 'undefined' && !!vpDraggingSegment) ||
                                       (typeof vpResizeActive !== 'undefined' && vpResizeActive) ||
                                       (window.vpUIInteractionActive === true) ||
                                       (window.vpIsFastRendering === true);
                    if (!isDragging) {
                        ctx.shadowColor = `rgba(${cVal},${cVal},${cVal},${alpha})`;
                        ctx.shadowBlur = 4 + prRand * 8;
                    } else {
                        ctx.shadowColor = 'transparent';
                        ctx.shadowBlur = 0;
                    }

                    ctx.fill();
                }
                ctx.restore();

                ctx.fillStyle = isDarkTheme ? '#ccc' : '#222';
                ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center';
                ctx.fillText(c.type, midX, baseY + 12);
            });
        }
    }

    // METAR STATIONEN & GRENZEN BEI 16000 FT (Dezentes Debugging-Overlay)
    let lastIcao = null;
    let lastDist = 0;
    for (let i = 0; i < vpWeatherData.length; i++) {
        const zone = vpWeatherData[i];
        if (zone.icao !== lastIcao) {
            const bDist = (i === 0) ? 0 : (lastDist + zone.distNM) / 2;
            const bx = xOf(bDist);
            if (bx >= viewMinX - 100 && bx <= viewMaxX + 100) {
                ctx.beginPath();
                ctx.moveTo(bx, yOf(16500));
                ctx.lineTo(bx, yOf(15500));
                ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);
                ctx.stroke();
                ctx.setLineDash([]);
                
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.font = 'bold 9px Arial';
                ctx.textAlign = 'left';
                const distText = zone.stnDist !== undefined ? ` (${zone.stnDist} NM)` : '';
                ctx.fillText('📡 ' + zone.icao + distText, bx + 4, yOf(16000));
            }
            lastIcao = zone.icao;
        }
        lastDist = zone.distNM;
    }
    ctx.restore();
}

function vpGetCloudLayerProfile(cloudType, hasTS) {
    let profile = {
        thicknessFt: 1800,
        density: 0.55,
        topAlpha: 0.22,
        bottomAlpha: 0.36,
        ridgeStrength: 0.35
    };

    if (cloudType === 'FEW') {
        profile.thicknessFt = 900;
        profile.density = 0.32;
        profile.topAlpha = 0.12;
        profile.bottomAlpha = 0.2;
        profile.ridgeStrength = 0.22;
    } else if (cloudType === 'SCT') {
        profile.thicknessFt = 1700;
        profile.density = 0.46;
        profile.topAlpha = 0.16;
        profile.bottomAlpha = 0.28;
        profile.ridgeStrength = 0.3;
    } else if (cloudType === 'BKN') {
        profile.thicknessFt = 3200;
        profile.density = 0.72;
        profile.topAlpha = 0.2;
        profile.bottomAlpha = 0.42;
        profile.ridgeStrength = 0.4;
    } else if (cloudType === 'OVC' || cloudType === 'VV') {
        profile.thicknessFt = 5200;
        profile.density = 0.9;
        profile.topAlpha = 0.24;
        profile.bottomAlpha = 0.5;
        profile.ridgeStrength = 0.46;
    }

    if (hasTS) {
        profile.thicknessFt = Math.max(profile.thicknessFt, 12000);
        profile.density = Math.min(1, profile.density + 0.12);
        profile.topAlpha = Math.min(0.38, profile.topAlpha + 0.08);
        profile.bottomAlpha = Math.min(0.62, profile.bottomAlpha + 0.1);
        profile.ridgeStrength = Math.min(0.62, profile.ridgeStrength + 0.12);
    }

    return profile;
}

function vpRoundedRectPath(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
}

function vpDrawCloudsPro(ctx, xOf, yOf, padTop, plotH, totalDist, isDarkTheme, elevData) {
    if (!vpWeatherData || vpWeatherData.length === 0) return;
    const prng = (s) => { const x = Math.sin(s) * 10000; return x - Math.floor(x); };
    const viewMinX = -Infinity;
    const viewMaxX = Infinity;

    ctx.save();
    for (let i = 0; i < vpWeatherData.length; i++) {
        const zone = vpWeatherData[i];
        const prevDist = (i > 0) ? (zone.distNM + vpWeatherData[i - 1].distNM) / 2 : Math.max(0, zone.distNM - totalDist * 0.05);
        const nextDist = (i < vpWeatherData.length - 1) ? (zone.distNM + vpWeatherData[i + 1].distNM) / 2 : Math.min(totalDist, zone.distNM + totalDist * 0.05);
        const startX = xOf(prevDist);
        const endX = xOf(nextDist);
        const width = endX - startX;
        const midX = startX + width / 2;

        if (width <= 1 || endX < viewMinX || startX > viewMaxX) continue;
        if (!zone.clouds || zone.clouds.length === 0) continue;

        const hasTS = !!(zone.weather && zone.weather.hasTS);
        for (let cIdx = 0; cIdx < zone.clouds.length; cIdx++) {
            const c = zone.clouds[cIdx];
            const profile = vpGetCloudLayerProfile(c.type, hasTS);
            const topFt = (Number.isFinite(c.topMsl) && c.topMsl > c.baseMsl + 150)
                ? c.topMsl
                : (c.baseMsl + profile.thicknessFt);
            const baseY = yOf(c.baseMsl);
            const topY = yOf(topFt);
            const layerTop = Math.min(baseY, topY);
            const layerBottom = Math.max(baseY, topY);
            const layerHeight = layerBottom - layerTop;

            if (layerBottom < padTop - 20 || layerTop > padTop + plotH + 20 || layerHeight < 2) continue;

            const left = startX - width * 0.04;
            const bandW = width * 1.08;
            const radius = Math.max(6, Math.min(16, Math.abs(yOf(500) - yOf(0)) * 0.65));
            const seed = (i + 1) * 103.7 + (cIdx + 1) * 71.9 + c.baseMsl * 0.001;
            const grayTop = Math.round((isDarkTheme ? 165 : 230) - profile.density * 28 - (hasTS ? 18 : 0));
            const grayBottom = Math.round((isDarkTheme ? 120 : 188) - profile.density * 35 - (hasTS ? 24 : 0));

            const grad = ctx.createLinearGradient(0, layerTop, 0, layerBottom);
            grad.addColorStop(0, `rgba(${grayTop},${grayTop},${grayTop},${profile.topAlpha})`);
            grad.addColorStop(0.45, `rgba(${grayTop - 8},${grayTop - 8},${grayTop - 8},${profile.topAlpha + 0.05})`);
            grad.addColorStop(1, `rgba(${grayBottom},${grayBottom},${grayBottom},${profile.bottomAlpha})`);

            vpRoundedRectPath(ctx, left, layerTop, bandW, layerHeight, radius);
            ctx.fillStyle = grad;
            ctx.fill();

            // Strukturierte Oberkante: klare Schichtkontur statt Blob-Rand
            const ridgeSteps = Math.max(8, Math.min(46, Math.round(bandW / 13)));
            ctx.beginPath();
            for (let s = 0; s <= ridgeSteps; s++) {
                const t = s / ridgeSteps;
                const x = left + t * bandW;
                const wave = Math.sin((t * (2.6 + profile.ridgeStrength) * Math.PI * 2) + seed) * (1.8 + layerHeight * 0.025);
                const noise = (prng(seed + s * 1.37) - 0.5) * (2.2 + layerHeight * 0.03);
                const y = layerTop + 2 + wave + noise;
                if (s === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = isDarkTheme
                ? `rgba(240,245,255,${0.18 + profile.ridgeStrength * 0.22})`
                : `rgba(120,130,145,${0.16 + profile.ridgeStrength * 0.18})`;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Dezente Schichtstruktur innen
            const stripeCount = Math.max(1, Math.round(2 + profile.density * 2));
            for (let k = 1; k <= stripeCount; k++) {
                const sy = layerTop + (layerHeight * k) / (stripeCount + 1);
                const wobble = (prng(seed + k * 11.1) - 0.5) * 2.4;
                ctx.beginPath();
                ctx.moveTo(left + 4, sy + wobble);
                ctx.lineTo(left + bandW - 4, sy - wobble);
                ctx.strokeStyle = isDarkTheme
                    ? `rgba(220,228,240,${0.06 + profile.density * 0.08})`
                    : `rgba(95,105,122,${0.05 + profile.density * 0.07})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            if (width > 34) {
                const topFL = Math.round(topFt / 100);
                const baseFL = Math.round(c.baseMsl / 100);
                ctx.fillStyle = isDarkTheme ? 'rgba(205,215,230,0.82)' : 'rgba(35,42,52,0.78)';
                ctx.font = 'bold 8px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`${c.type} FL${baseFL}-${topFL}`, midX, Math.min(layerBottom + 12, padTop + plotH + 10));
            }
        }
    }
    ctx.restore();
}

function vpClipWeatherColumnToSky(ctx, startX, endX, prevDist, nextDist, getElevY) {
    const width = Math.max(1, endX - startX);
    const steps = Math.max(10, Math.min(48, Math.round(width / 12)));
    ctx.beginPath();
    ctx.moveTo(startX, -2000);
    ctx.lineTo(endX, -2000);
    for (let s = steps; s >= 0; s--) {
        const t = s / steps;
        const x = startX + t * width;
        const dNM = prevDist + t * (nextDist - prevDist);
        const gy = getElevY(dNM);
        ctx.lineTo(x, gy);
    }
    ctx.closePath();
    ctx.clip();
}

function vpDrawAnimatedWeather(ctx, xOf, yOf, totalDist, elevData, timeMs, viewMinX, viewMaxX) {
    if (!vpWeatherData || vpWeatherData.length === 0) return;

    const getElevY = (dNM) => {
        if (!elevData || elevData.length < 2) return yOf(0);
        let low = 0, high = elevData.length - 2;
        while (low <= high) {
            let mid = (low + high) >> 1;
            if (dNM < elevData[mid].distNM) high = mid - 1;
            else if (dNM > elevData[mid+1].distNM) low = mid + 1;
            else {
                const p1 = elevData[mid], p2 = elevData[mid+1];
                const f = (dNM - p1.distNM) / (p2.distNM - p1.distNM || 1);
                return yOf(p1.elevFt + f * (p2.elevFt - p1.elevFt));
            }
        }
        return yOf(elevData[elevData.length - 1].elevFt);
    };

    ctx.save();
    for (let i = 0; i < vpWeatherData.length; i++) {
        const zone = vpWeatherData[i];
        if (!zone.weather || (!zone.weather.hasRain && !zone.weather.hasSnow && !zone.weather.hasTS)) continue;

        const prevDist = (i > 0) ? (zone.distNM + vpWeatherData[i-1].distNM)/2 : Math.max(0, zone.distNM - totalDist*0.05);
        const nextDist = (i < vpWeatherData.length - 1) ? (zone.distNM + vpWeatherData[i+1].distNM)/2 : Math.min(totalDist, zone.distNM + totalDist*0.05);
        const startX = xOf(prevDist);
        const endX = xOf(nextDist);
        const width = endX - startX;

        if (endX < viewMinX || startX > viewMaxX) continue; // CULLING

        const baseY = yOf(zone.lowestBase);

        // 1. REGEN & SCHNEE ANIMIERT
        if ((zone.weather.hasRain || zone.weather.hasSnow) && zone.visuals && zone.visuals.drops) {
            // Niederschlag hinter Gelände halten, damit Tropfen am Boden "enden".
            ctx.save();
            vpClipWeatherColumnToSky(ctx, startX, endX, prevDist, nextDist, getElevY);
            ctx.beginPath();
            
            // FIX: Virtuelles Fall-Band (von ganz oben nach ganz unten auf dem Bildschirm)
            const virtualTop = -100; 
            const virtualBottom = 500; 
            const virtualFallDist = virtualBottom - virtualTop;

            for(let d=0; d < zone.visuals.drops.length; d++) {
                const drop = zone.visuals.drops[d];
                const dropX = startX + drop.x * width;
                const dNM = prevDist + drop.x * (nextDist - prevDist);
                const groundY = getElevY(dNM);

                if (baseY >= groundY) continue; 

                // Unabhängige, konstante Fall-Animation
                const speed = zone.weather.hasSnow ? (0.01 + drop.spd * 0.01) : (0.05 + drop.spd * 0.03);
                const currentYOffset = ((drop.y * virtualFallDist) + (timeMs * speed)) % virtualFallDist;
                const sy = virtualTop + currentYOffset;

                // CULLING: Tropfen nur zeichnen, wenn er sich zwischen Wolke und Boden befindet!
                if (sy < baseY || sy > groundY) continue;

                if (zone.weather.hasSnow) {
                    const sway = Math.sin(timeMs * 0.002 + d) * 4 * drop.spd;
                    const snowDrift = currentYOffset * 0.15; 
                    let rawSx = dropX + sway - snowDrift;
                    // FIX: Zwingt den Schnee durch Modulo-Wrap immer in der exakten Stations-Breite (Zone) zu bleiben!
                    const sx = startX + ((rawSx - startX) % width + width) % width;
                    
                    ctx.moveTo(sx, sy);
                    ctx.arc(sx, sy, 0.8 + drop.spd, 0, Math.PI*2);
                } else {
                    const tailLength = 6 + drop.spd * 8;
                    const windSlant = 2 + drop.spd * 4; 
                    const driftRatio = windSlant / tailLength;
                    let rawX = dropX - (currentYOffset * driftRatio);
                    // FIX: Zwingt den Regen durch Modulo-Wrap immer in der exakten Stations-Breite (Zone) zu bleiben!
                    const currentX = startX + ((rawX - startX) % width + width) % width;

                    ctx.moveTo(currentX, sy);
                    ctx.lineTo(currentX - windSlant, sy + tailLength); 
                }
            }
            ctx.fillStyle = zone.weather.hasSnow ? 'rgba(255,255,255,0.8)' : 'rgba(120, 180, 255, 0.6)';
            ctx.strokeStyle = zone.weather.hasSnow ? 'rgba(255,255,255,0.8)' : 'rgba(100, 160, 255, 0.5)';
            ctx.lineWidth = zone.weather.hasSnow ? 1 : 1.5;
            if (zone.weather.hasSnow) ctx.fill(); else ctx.stroke();
            ctx.restore();
        }

        // 2. BLITZE ANIMIERT
        if (zone.weather.hasTS && zone.visuals && zone.visuals.flashes) {
            const flashCycle = timeMs % 5000; // Ein Blitz-Zyklus dauert 5 Sekunden
            let hasActiveFlash = false;
            
            ctx.beginPath();
            for(let f=0; f < zone.visuals.flashes.length; f++) {
                const flash = zone.visuals.flashes[f];
                const flashTimeStart = flash.x * 4500; // Zufälliger Start im Zyklus
                
                // Blitz leuchtet für knackige 120ms
                if (flashCycle > flashTimeStart && flashCycle < flashTimeStart + 120) {
                    hasActiveFlash = true;
                    const fx = startX + width * 0.2 + flash.x * width * 0.6;
                    const groundY = getElevY(prevDist + flash.x * (nextDist - prevDist));
                    if (baseY < groundY) {
                        const stepY = (groundY - baseY) / 4;
                        ctx.moveTo(fx, baseY);
                        ctx.lineTo(fx + (flash.pts[0]-0.5)*20, baseY + stepY);
                        ctx.lineTo(fx + (flash.pts[1]-0.5)*20, baseY + stepY*2);
                        ctx.lineTo(fx + (flash.pts[2]-0.5)*20, baseY + stepY*3);
                        ctx.lineTo(fx + (flash.pts[3]-0.5)*20, groundY);
                    }
                }
            }
            if (hasActiveFlash) {
                ctx.strokeStyle = 'rgba(255, 230, 100, 0.9)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }
    }
    ctx.restore();
}

function vpDrawAnimatedWeatherPro(ctx, xOf, yOf, totalDist, elevData, timeMs, viewMinX, viewMaxX) {
    if (!vpWeatherData || vpWeatherData.length === 0) return;
    const prng = (s) => { const x = Math.sin(s) * 10000; return x - Math.floor(x); };

    const getElevY = (dNM) => {
        if (!elevData || elevData.length < 2) return yOf(0);
        let low = 0, high = elevData.length - 2;
        while (low <= high) {
            const mid = (low + high) >> 1;
            if (dNM < elevData[mid].distNM) high = mid - 1;
            else if (dNM > elevData[mid + 1].distNM) low = mid + 1;
            else {
                const p1 = elevData[mid];
                const p2 = elevData[mid + 1];
                const f = (dNM - p1.distNM) / (p2.distNM - p1.distNM || 1);
                return yOf(p1.elevFt + f * (p2.elevFt - p1.elevFt));
            }
        }
        return yOf(elevData[elevData.length - 1].elevFt);
    };

    ctx.save();
    for (let i = 0; i < vpWeatherData.length; i++) {
        const zone = vpWeatherData[i];
        if (!zone.weather || (!zone.weather.hasRain && !zone.weather.hasSnow && !zone.weather.hasTS)) continue;

        const prevDist = (i > 0) ? (zone.distNM + vpWeatherData[i - 1].distNM) / 2 : Math.max(0, zone.distNM - totalDist * 0.05);
        const nextDist = (i < vpWeatherData.length - 1) ? (zone.distNM + vpWeatherData[i + 1].distNM) / 2 : Math.min(totalDist, zone.distNM + totalDist * 0.05);
        const startX = xOf(prevDist);
        const endX = xOf(nextDist);
        const width = endX - startX;
        if (width <= 1 || endX < viewMinX || startX > viewMaxX) continue;

        const baseFt = (zone.lowestBase && Number.isFinite(zone.lowestBase)) ? zone.lowestBase : 4500;
        const baseY = yOf(baseFt);
        const hasSnow = !!zone.weather.hasSnow;
        const hasRain = !!zone.weather.hasRain && !hasSnow;
        const hasTS = !!zone.weather.hasTS;

        if (hasSnow || hasRain) {
            ctx.save();
            vpClipWeatherColumnToSky(ctx, startX, endX, prevDist, nextDist, getElevY);
            const colTop = baseY - 6;
            const steps = 10;
            ctx.beginPath();
            ctx.moveTo(startX, colTop);
            ctx.lineTo(endX, colTop);
            for (let s = steps; s >= 0; s--) {
                const t = s / steps;
                const x = startX + t * width;
                const dNM = prevDist + t * (nextDist - prevDist);
                const gy = getElevY(dNM);
                ctx.lineTo(x, gy);
            }
            ctx.closePath();
            const columnGrad = ctx.createLinearGradient(0, colTop, 0, colTop + 220);
            if (hasSnow) {
                columnGrad.addColorStop(0, 'rgba(214,230,255,0.16)');
                columnGrad.addColorStop(1, 'rgba(190,215,255,0.03)');
            } else {
                columnGrad.addColorStop(0, 'rgba(95,155,230,0.18)');
                columnGrad.addColorStop(1, 'rgba(80,130,210,0.04)');
            }
            ctx.fillStyle = columnGrad;
            ctx.fill();

            const drops = (zone.visuals && zone.visuals.drops && zone.visuals.drops.length > 0) ? zone.visuals.drops : null;
            const sampleCount = drops ? Math.min(drops.length, hasSnow ? 90 : 115) : (hasSnow ? 80 : 100);
            ctx.beginPath();
            for (let d = 0; d < sampleCount; d++) {
                const drop = drops ? drops[d] : {
                    x: prng(i * 193 + d * 17.1),
                    y: prng(i * 219 + d * 11.7),
                    spd: prng(i * 251 + d * 7.3)
                };
                const fracX = drop.x;
                const dNM = prevDist + fracX * (nextDist - prevDist);
                const groundY = getElevY(dNM);
                if (groundY <= baseY + 2) continue;

                const span = (groundY - colTop) + 16;
                const speed = hasSnow ? (0.017 + drop.spd * 0.011) : (0.062 + drop.spd * 0.046);
                const y = colTop + ((drop.y * span) + (timeMs * speed)) % span;
                if (y < baseY || y > groundY) continue;

                if (hasSnow) {
                    const sway = Math.sin(timeMs * 0.0012 + d * 0.8) * (2.5 + drop.spd * 2.4);
                    let sx = startX + fracX * width + sway;
                    sx = startX + ((sx - startX) % width + width) % width;
                    const r = 0.8 + drop.spd * 1.1;
                    ctx.moveTo(sx + r, y);
                    ctx.arc(sx, y, r, 0, Math.PI * 2);
                } else {
                    const slant = 2.5 + drop.spd * 5;
                    const tail = 7 + drop.spd * 9;
                    let rx = startX + fracX * width - (timeMs * 0.01 * (0.1 + drop.spd));
                    rx = startX + ((rx - startX) % width + width) % width;
                    ctx.moveTo(rx, y);
                    ctx.lineTo(rx - slant, y + tail);
                }
            }
            if (hasSnow) {
                ctx.fillStyle = 'rgba(245,250,255,0.84)';
                ctx.fill();
            } else {
                ctx.strokeStyle = 'rgba(120,185,255,0.56)';
                ctx.lineWidth = 1.4;
                ctx.stroke();
            }
            ctx.restore();
        }

        if (hasTS) {
            const tsLeft = startX + width * 0.12;
            const tsRight = endX - width * 0.12;
            const tsWidth = Math.max(8, tsRight - tsLeft);
            const tsTop = baseY - 10;
            const pulse = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(timeMs * 0.003 + i * 0.8));

            // Konvektionskern als vertikaler Gefahrenvorhang
            const steps = 12;
            ctx.beginPath();
            ctx.moveTo(tsLeft, tsTop);
            ctx.lineTo(tsRight, tsTop);
            for (let s = steps; s >= 0; s--) {
                const t = s / steps;
                const x = tsLeft + t * tsWidth;
                const dNM = prevDist + ((x - startX) / Math.max(1, width)) * (nextDist - prevDist);
                const gy = getElevY(dNM);
                ctx.lineTo(x, gy);
            }
            ctx.closePath();
            const tsGrad = ctx.createLinearGradient(0, tsTop, 0, tsTop + 260);
            tsGrad.addColorStop(0, `rgba(255,120,60,${0.12 + pulse * 0.16})`);
            tsGrad.addColorStop(0.5, `rgba(255,80,45,${0.08 + pulse * 0.14})`);
            tsGrad.addColorStop(1, 'rgba(255,60,45,0.02)');
            ctx.fillStyle = tsGrad;
            ctx.fill();

            ctx.beginPath();
            const ridgeSteps = Math.max(8, Math.round(tsWidth / 14));
            for (let s = 0; s <= ridgeSteps; s++) {
                const t = s / ridgeSteps;
                const x = tsLeft + t * tsWidth;
                const y = tsTop + Math.sin((t * Math.PI * 2 * 2.4) + i * 1.2) * (2 + pulse * 3);
                if (s === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = `rgba(255,190,90,${0.34 + pulse * 0.3})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();

            const flashes = (zone.visuals && zone.visuals.flashes && zone.visuals.flashes.length > 0)
                ? zone.visuals.flashes
                : [{ x: 0.4, pts: [0.45, 0.55, 0.4, 0.6] }];
            const cycle = timeMs % 4400;
            let hasActiveFlash = false;

            ctx.beginPath();
            for (let f = 0; f < flashes.length; f++) {
                const flash = flashes[f];
                const start = (flash.x * 3600) % 3600 + 220;
                if (cycle < start || cycle > start + 150) continue;

                const fx = tsLeft + tsWidth * (0.08 + flash.x * 0.84);
                const dNM = prevDist + ((fx - startX) / Math.max(1, width)) * (nextDist - prevDist);
                const gy = getElevY(dNM);
                if (gy <= tsTop) continue;

                hasActiveFlash = true;
                const seg = (gy - tsTop) / 4;
                ctx.moveTo(fx, tsTop);
                ctx.lineTo(fx + (flash.pts[0] - 0.5) * 18, tsTop + seg);
                ctx.lineTo(fx + (flash.pts[1] - 0.5) * 18, tsTop + seg * 2);
                ctx.lineTo(fx + (flash.pts[2] - 0.5) * 18, tsTop + seg * 3);
                ctx.lineTo(fx + (flash.pts[3] - 0.5) * 18, gy);
            }
            if (hasActiveFlash) {
                ctx.strokeStyle = `rgba(255,235,150,${0.72 + pulse * 0.24})`;
                ctx.lineWidth = 1.8;
                ctx.shadowColor = 'rgba(255,220,130,0.6)';
                ctx.shadowBlur = 8;
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        }
    }
    ctx.restore();
}

function vpFindNearestWeatherZone(distNM) {
    if (!vpWeatherData || vpWeatherData.length === 0) return null;
    let best = null;
    let minDiff = Infinity;
    for (const z of vpWeatherData) {
        const d = Math.abs((z.distNM || 0) - distNM);
        if (d < minDiff) { minDiff = d; best = z; }
    }
    return best;
}

function vpGetRouteBearingAtDist(elevData, distNM) {
    if (!elevData || elevData.length < 2 || !Number.isFinite(distNM)) return null;
    for (let i = 0; i < elevData.length - 1; i++) {
        const a = elevData[i], b = elevData[i + 1];
        if (distNM < a.distNM || distNM > b.distNM) continue;
        if (!Number.isFinite(a.lat) || !Number.isFinite(a.lon) || !Number.isFinite(b.lat) || !Number.isFinite(b.lon)) return null;
        return calcNav(a.lat, a.lon, b.lat, b.lon).brng;
    }
    const a = elevData[elevData.length - 2], b = elevData[elevData.length - 1];
    if (!a || !b) return null;
    return calcNav(a.lat, a.lon, b.lat, b.lon).brng;
}

function vpInterpolateWindAtAltitude(zone, targetAltFt) {
    if (!zone || !Array.isArray(zone.pressureProfile) || zone.pressureProfile.length === 0) return null;
    const pts = zone.pressureProfile
        .filter(p => Number.isFinite(p.geopotentialFt) && Number.isFinite(p.windKt) && Number.isFinite(p.windDirDeg))
        .sort((a, b) => a.geopotentialFt - b.geopotentialFt);
    if (!pts.length) return null;

    if (targetAltFt <= pts[0].geopotentialFt) return { windKt: pts[0].windKt, windDirDeg: pts[0].windDirDeg };
    if (targetAltFt >= pts[pts.length - 1].geopotentialFt) {
        const p = pts[pts.length - 1];
        return { windKt: p.windKt, windDirDeg: p.windDirDeg };
    }

    for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        if (targetAltFt < a.geopotentialFt || targetAltFt > b.geopotentialFt) continue;
        const f = (targetAltFt - a.geopotentialFt) / Math.max(1, (b.geopotentialFt - a.geopotentialFt));
        const aRad = (a.windDirDeg * Math.PI) / 180;
        const bRad = (b.windDirDeg * Math.PI) / 180;
        const aU = -a.windKt * Math.sin(aRad), aV = -a.windKt * Math.cos(aRad);
        const bU = -b.windKt * Math.sin(bRad), bV = -b.windKt * Math.cos(bRad);
        const u = aU + (bU - aU) * f;
        const v = aV + (bV - aV) * f;
        const windKt = Math.sqrt(u * u + v * v);
        const windDirDeg = ((Math.atan2(-u, -v) * 180 / Math.PI) + 360) % 360;
        return { windKt, windDirDeg, u, v };
    }
    return null;
}

function vpComputeTailwindComponent(windKt, windDirFromDeg, trackDeg) {
    if (!Number.isFinite(windKt) || !Number.isFinite(windDirFromDeg) || !Number.isFinite(trackDeg)) return null;
    const windRad = (windDirFromDeg * Math.PI) / 180;
    const u = -windKt * Math.sin(windRad); // East
    const v = -windKt * Math.cos(windRad); // North
    const tr = (trackDeg * Math.PI) / 180;
    const tx = Math.sin(tr), ty = Math.cos(tr);
    return u * tx + v * ty; // >0 tailwind, <0 headwind
}

const VP_ISOBAR_RELIEF_GAIN_DEFAULT = 5.5;
const VP_ISOBAR_RELIEF_GAIN_LOW = 10.5;
const VP_ISOBAR_RELIEF_GAIN_TINY = 15;
const VP_ISOBAR_RELIEF_MAX_DELTA_FT = 1800;

function vpBuildIsobarReliefStats() {
    const stats = {};
    if (!Array.isArray(vpWeatherData) || vpWeatherData.length < 2) return stats;
    for (const level of VP_OM_PRESSURE_LEVELS) {
        const vals = [];
        for (const zone of vpWeatherData) {
            if (!Array.isArray(zone.pressureProfile)) continue;
            const p = zone.pressureProfile.find(pp => pp.hPa === level && Number.isFinite(pp.geopotentialFt));
            if (!p) continue;
            vals.push(p.geopotentialFt);
        }
        if (vals.length < 2) continue;
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const spread = Math.max(0, max - min);
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        let gain = VP_ISOBAR_RELIEF_GAIN_DEFAULT;
        if (spread < 70) gain = VP_ISOBAR_RELIEF_GAIN_TINY;
        else if (spread < 180) gain = VP_ISOBAR_RELIEF_GAIN_LOW;
        const maxDelta = Math.max(220, Math.min(VP_ISOBAR_RELIEF_MAX_DELTA_FT, spread * gain));
        stats[level] = { mean, gain, maxDelta };
    }
    return stats;
}

function vpMapIsobarDisplayFt(level, rawFt, reliefStats) {
    if (!Number.isFinite(rawFt)) return rawFt;
    const s = reliefStats ? reliefStats[level] : null;
    if (!s) return rawFt;
    const amplified = s.mean + (rawFt - s.mean) * s.gain;
    const delta = Math.max(-s.maxDelta, Math.min(s.maxDelta, amplified - s.mean));
    return s.mean + delta;
}

function vpDrawIsobars(ctx, xOf, yOf, padTop, plotH, viewMinX, viewMaxX, rightX) {
    if (!vpShowIsobars || !vpWeatherData || vpWeatherData.length < 2) return;
    const hasPressureData = vpWeatherData.some(z => Array.isArray(z.pressureProfile) && z.pressureProfile.length > 0);
    if (!hasPressureData) return;
    const hasOpenMeteoProfiles = vpWeatherData.some(z => z && z.wxSource === 'openmeteo');
    const levels = hasOpenMeteoProfiles ? VP_OM_PRESSURE_LEVELS : [1000];
    const reliefStats = vpBuildIsobarReliefStats();
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.font = '9px Arial';
    ctx.textAlign = 'right';
    let usedLabelYs = [];

    for (const level of levels) {
        const pts = [];
        let lastLabel = null;
        for (const zone of vpWeatherData) {
            if (!Array.isArray(zone.pressureProfile)) continue;
            const p = zone.pressureProfile.find(pp => pp.hPa === level && Number.isFinite(pp.geopotentialFt));
            if (!p) continue;
            const x = xOf(zone.distNM);
            const y = yOf(vpMapIsobarDisplayFt(level, p.geopotentialFt, reliefStats));
            if (x < viewMinX - 60 || x > viewMaxX + 60 || y < padTop - 20 || y > padTop + plotH + 20) continue;
            pts.push({ x, y, distNM: zone.distNM, level });
            lastLabel = { x, y };
        }
        if (pts.length < 2) continue;

        // Sanfte Kurve statt strikt gerader Segmente zwischen den Samples.
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
            const prev = pts[i - 1];
            const cur = pts[i];
            const midX = (prev.x + cur.x) * 0.5;
            const midY = (prev.y + cur.y) * 0.5;
            ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
        }
        const last = pts[pts.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.strokeStyle = 'rgba(140,170,210,0.35)';
        ctx.stroke();
        if (!lastLabel) continue;

        let ly = Math.max(padTop + 10, Math.min(padTop + plotH - 4, lastLabel.y + 3));
        let collide = true;
        let guard = 0;
        while (collide && guard < 8) {
            collide = usedLabelYs.some(v => Math.abs(v - ly) < 12);
            if (collide) ly += 11;
            guard++;
        }
        usedLabelYs.push(ly);
        ctx.fillStyle = 'rgba(180,205,235,0.82)';
        const label = (!hasOpenMeteoProfiles && level === 1000) ? 'QNH' : `${level} hPa`;
        ctx.fillText(label, rightX, ly);
    }

    ctx.restore();
}

function vpDrawWindComponentsOnIsobars(ctx, xOf, yOf, elevData, viewMinX, viewMaxX, padTop, plotH) {
    if (!vpShowWindComponents || !vpWeatherData || vpWeatherData.length === 0) return;
    const hasOpenMeteoProfiles = vpWeatherData.some(z => z && z.wxSource === 'openmeteo');
    const levels = hasOpenMeteoProfiles ? VP_OM_PRESSURE_LEVELS : [1000];
    const reliefStats = vpBuildIsobarReliefStats();
    ctx.save();
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const minLabelDxPx = 82;
    const minShownComponentKt = 2;

    for (const level of levels) {
        const points = [];
        for (let i = 0; i < vpWeatherData.length; i++) {
            const zone = vpWeatherData[i];
            if (!Array.isArray(zone.pressureProfile)) continue;
            const p = zone.pressureProfile.find(pp => pp.hPa === level && Number.isFinite(pp.geopotentialFt) && Number.isFinite(pp.windKt) && Number.isFinite(pp.windDirDeg));
            if (!p) continue;
            const x = xOf(zone.distNM);
            const y = yOf(vpMapIsobarDisplayFt(level, p.geopotentialFt, reliefStats));
            if (x < viewMinX + 12 || x > viewMaxX - 12 || y < padTop + 8 || y > padTop + plotH - 8) continue;

            const track = vpGetRouteBearingAtDist(elevData, zone.distNM);
            if (!Number.isFinite(track)) continue;
            const comp = vpComputeTailwindComponent(p.windKt, p.windDirDeg, track);
            if (!Number.isFinite(comp)) continue;
            points.push({ x, y, comp });
        }
        if (points.length < 2) continue;

        let lastLabelX = -Infinity;
        for (let i = 0; i < points.length; i++) {
            const pt = points[i];
            if ((pt.x - lastLabelX) < minLabelDxPx) continue;

            const c = Math.round(pt.comp);
            if (Math.abs(c) < minShownComponentKt) continue;

            const prev = points[Math.max(0, i - 1)];
            const next = points[Math.min(points.length - 1, i + 1)];
            const dx = next.x - prev.x;
            const dy = next.y - prev.y;
            const l = Math.max(1, Math.hypot(dx, dy));
            const nx = -dy / l;
            const ny = dx / l;
            const isTail = c > 0;
            const txt = isTail
                ? `${Math.abs(c)} \u2192`
                : `\u2190 ${Math.abs(c)}`;
            const tx = pt.x + nx * 8;
            const ty = pt.y + ny * 8;

            ctx.lineWidth = 2.4;
            ctx.strokeStyle = 'rgba(0,0,0,0.62)';
            ctx.strokeText(txt, tx, ty);
            ctx.fillStyle = isTail ? 'rgba(136,255,184,0.96)' : 'rgba(255,172,160,0.96)';
            ctx.fillText(txt, tx, ty);
            lastLabelX = pt.x;
        }
    }
    ctx.restore();
}

function computeFlightProfile(elevationData, cruiseAltFt, climbRateFpm, descentRateFpm, tasKts) {
    if (!elevationData || elevationData.length < 2) return null;

    const depElevFt = elevationData[0].elevFt;
    let destElevFt = elevationData[elevationData.length - 1].elevFt;
    const totalDistNM = elevationData[elevationData.length - 1].distNM;

    const climbFt = Math.max(0, cruiseAltFt - depElevFt);
    const climbTimeMin = climbFt / climbRateFpm;
    const climbDistNM = (climbTimeMin / 60) * tasKts * 0.85;

    const descentFt = Math.max(0, cruiseAltFt - destElevFt);
    const descentTimeMin = descentFt / descentRateFpm;
    const descentDistNM = (descentTimeMin / 60) * tasKts * 0.9;

    const tocDistNM = Math.min(climbDistNM, totalDistNM * 0.4);
    const todDistNM = Math.max(totalDistNM - descentDistNM, totalDistNM * 0.6);

    const profile = [];
    for (const pt of elevationData) {
        let altFt;
        if (pt.distNM <= tocDistNM) {
            const f = tocDistNM > 0 ? pt.distNM / tocDistNM : 1;
            altFt = depElevFt + (cruiseAltFt - depElevFt) * f;
        } else if (pt.distNM >= todDistNM) {
            const f = (totalDistNM - todDistNM) > 0 ? (pt.distNM - todDistNM) / (totalDistNM - todDistNM) : 1;
            altFt = cruiseAltFt - (cruiseAltFt - destElevFt) * f;
        } else {
            altFt = cruiseAltFt;
        }
        profile.push({ distNM: pt.distNM, altFt: Math.round(altFt) });
    }

    return { profile, tocDistNM, todDistNM };
}
function getCachedAirspaceIntersections(elevData, totalDist) {
    // Im HDG-Modus ändert sich elevData[0] mit jeder Position → Cache-Key muss mitlaufen
    const isHdg = (typeof vpMode !== 'undefined' && vpMode === 'HDG');
    const hdgPosKey = isHdg && elevData[0]
        ? `_${(elevData[0].lat || 0).toFixed(2)}_${(elevData[0].lon || 0).toFixed(2)}`
        : '';
    const asCacheKey = (window._lastVpRouteKey || 'none') + '_v' + (window._activeAirspacesVersion || 0) + hdgPosKey;
    if (window._vpAsCache && window._vpAsCache.key === asCacheKey && window._vpAsCache.elevLength === elevData.length) {
        return window._vpAsCache.items;
    }
    
    const baseStepNm = (elevData.length > 1)
        ? Math.max(0.05, Math.abs((elevData[1].distNM || 0) - (elevData[0].distNM || 0)))
        : 0.25;
    // Mikro-Splitter zusammenführen, aber echte mehrfach-Durchflüge getrennt lassen.
    const mergeGapNm = Math.max(0.12, baseStepNm * 0.35);
    const minIntervalNm = Math.max(0.06, baseStepNm * 0.22);
    let items = [];
    for (let asIdx = 0; asIdx < activeAirspaces.length; asIdx++) {
        const as = activeAirspaces[asIdx];
        if (as.type === 33) continue;
        const band = getAirspaceVerticalBandFt(as, 0);
        if (!band) continue;
        const lowerFt = band.baseLowerFt;
        const upperFt = band.baseUpperFt;
        const isLowerAgl = band.isLowerAgl;
        const isUpperAgl = band.isUpperAgl;

        const polys = [];
        if (as.geometry) {
            if (as.geometry.type === 'Polygon') polys.push(as.geometry.coordinates[0]);
            else if (as.geometry.type === 'MultiPolygon') as.geometry.coordinates.forEach(mc => polys.push(mc[0]));
        }
        if (polys.length === 0) continue;

        const pointInsideAnyPoly = (pt) => {
            for (const poly of polys) {
                if (vpPointInPoly(pt, poly)) return true;
            }
            return false;
        };

        const segmentCrossFractions = (ptA, ptB) => {
            const vals = [];
            for (const poly of polys) {
                for (let ei = 0, ej = poly.length - 1; ei < poly.length; ej = ei++) {
                    const ax = poly[ej][0], ay = poly[ej][1], bx = poly[ei][0], by = poly[ei][1];
                    const d1x = ptB.lon - ptA.lon, d1y = ptB.lat - ptA.lat;
                    const d2x = bx - ax, d2y = by - ay;
                    const cross = d1x * d2y - d1y * d2x;
                    if (Math.abs(cross) < 1e-12) continue;
                    const t = ((ax - ptA.lon) * d2y - (ay - ptA.lat) * d2x) / cross;
                    const u = ((ax - ptA.lon) * d1y - (ay - ptA.lat) * d1x) / cross;
                    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) vals.push(t);
                }
            }
            vals.sort((a, b) => a - b);
            const unique = [];
            for (const t of vals) {
                if (!unique.length || Math.abs(t - unique[unique.length - 1]) > 1e-5) unique.push(t);
            }
            return unique;
        };

        const intervals = [];
        let openStart = null;
        const openInterval = (dist) => {
            if (openStart === null) openStart = dist;
        };
        const closeInterval = (dist) => {
            if (openStart !== null && dist > openStart + 1e-4) intervals.push({ min: openStart, max: dist });
            openStart = null;
        };

        for (let i = 0; i < elevData.length - 1; i++) {
            const a = elevData[i];
            const b = elevData[i + 1];
            const segLen = b.distNM - a.distNM;
            if (segLen <= 1e-6) continue;

            const cuts = [0, ...segmentCrossFractions(a, b), 1];
            for (let c = 0; c < cuts.length - 1; c++) {
                const t0 = cuts[c], t1 = cuts[c + 1];
                if (t1 - t0 <= 1e-6) continue;
                const mid = (t0 + t1) * 0.5;
                const probe = {
                    lat: a.lat + (b.lat - a.lat) * mid,
                    lon: a.lon + (b.lon - a.lon) * mid
                };
                const inside = pointInsideAnyPoly(probe);
                const d0 = a.distNM + segLen * t0;
                const d1 = a.distNM + segLen * t1;
                if (inside) {
                    openInterval(d0);
                    if (c === cuts.length - 2) closeInterval(d1);
                } else {
                    closeInterval(d0);
                }
            }
        }
        if (openStart !== null) closeInterval(totalDist);
        if (intervals.length === 0) continue;

        // 1) Zu kleine Fragmente verwerfen
        const filtered = intervals
            .map(iv => ({ min: Number(iv.min || 0), max: Number(iv.max || 0) }))
            .filter(iv => Number.isFinite(iv.min) && Number.isFinite(iv.max) && iv.max > iv.min + minIntervalNm)
            .sort((a, b) => a.min - b.min);
        if (filtered.length === 0) continue;

        // 2) Fast angrenzende Intervalle zusammenführen (numerisches Flattern am Rand)
        const merged = [];
        for (const iv of filtered) {
            if (merged.length === 0) {
                merged.push({ min: iv.min, max: iv.max });
                continue;
            }
            const prev = merged[merged.length - 1];
            if (iv.min <= prev.max + mergeGapNm) {
                prev.max = Math.max(prev.max, iv.max);
            } else {
                merged.push({ min: iv.min, max: iv.max });
            }
        }

        const eps = (elevData.length > 1) ? Math.max(0.05, (elevData[1].distNM - elevData[0].distNM) * 0.5) : 0.5;
        for (let runIdx = 0; runIdx < merged.length; runIdx++) {
            const interval = merged[runIdx];
            const asMinDist = interval.min;
            const asMaxDist = interval.max;
            const relevantPts = elevData.filter(p => p.distNM >= asMinDist - eps && p.distNM <= asMaxDist + eps);
            if (relevantPts.length < 1) continue;
            items.push({
                asIdx,
                as,
                runIdx,
                lowerFt,
                upperFt,
                isLowerAgl,
                isUpperAgl,
                asMinDist,
                asMaxDist,
                relevantPts
            });
        }
    }
    window._vpAsCache = { key: asCacheKey, elevLength: elevData.length, items: items };
    return items;
}


function renderVerticalProfile(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !vpElevationData || vpElevationData.length < 2) return;

    const container = canvas.parentElement;
    const displayWidth = container.clientWidth || 400;
    const displayHeight = Math.round(displayWidth * 0.4);

    const dpr = window.devicePixelRatio || 1;
    const targetW = displayWidth * dpr;
    const targetH = displayHeight * dpr;

    const ctx = canvas.getContext('2d');
    
    // Performance Fix für das kleine Diagramm
    if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        canvas.style.width = '100%';
        canvas.style.maxWidth = displayWidth + 'px';
        canvas.style.height = 'auto';
        ctx.scale(dpr, dpr);
    } else {
        ctx.clearRect(0, 0, displayWidth, displayHeight);
    }

    const padLeft = 45, padRight = 15, padTop = 20, padBottom = 30;
    const plotW = displayWidth - padLeft - padRight;
    const plotH = displayHeight - padTop - padBottom;

    const cruiseAlt = parseInt(document.getElementById('altMapInput')?.textContent || document.getElementById('altSlider')?.value || 4500);
    const tas = parseInt(document.getElementById('tasSlider')?.value || 115);
    const totalDist = vpElevationData[vpElevationData.length - 1].distNM;
    const maxTerrain = Math.max(...vpElevationData.map(p => p.elevFt));
    let maxCloudAlt = 0;
    if (vpShowClouds && vpWeatherData) {
        vpWeatherData.forEach(zone => {
            if (zone.clouds) zone.clouds.forEach(c => {
                if (c.baseMsl > maxCloudAlt) maxCloudAlt = c.baseMsl;
            });
        });
    }
    let autoMaxAlt = Math.max(cruiseAlt + 2500, maxTerrain + 1000);
    const maxAlt = vpMaxAltOverride > 0 ? vpMaxAltOverride : autoMaxAlt;
    const minAlt = 0;

    const fpResult = computeFlightProfile(vpElevationData, cruiseAlt, vpClimbRate, vpDescentRate, tas);

    const xOf = (distNM) => padLeft + (distNM / totalDist) * plotW;
    const yOf = (altFt) => padTop + plotH - ((altFt - minAlt) / (maxAlt - minAlt)) * plotH;

    // Background
    ctx.fillStyle = '#eef6ff';
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
    skyGrad.addColorStop(0, '#87CEEB');
    skyGrad.addColorStop(0.5, '#c8e6f8');
    skyGrad.addColorStop(1, '#e8f4f8');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(padLeft, padTop, plotW, plotH);
    if (vpShowClouds) {
        if (vpWeatherRenderMode === 'abstrakt' || vpWeatherRenderMode === 'pro') vpDrawCloudsPro(ctx, xOf, yOf, padTop, plotH, totalDist, typeof zoomFactor !== 'undefined', typeof elevData !== 'undefined' ? elevData : vpElevationData);
        else vpDrawClouds(ctx, xOf, yOf, padTop, plotH, totalDist, typeof zoomFactor !== 'undefined', typeof elevData !== 'undefined' ? elevData : vpElevationData);
    }

    // Airspace blocks
    let occupiedASLabels = [];
    if (vpAirspaceMode !== 0 && typeof activeAirspaces !== 'undefined' && activeAirspaces.length > 0) {
        const cachedAirspaces = getCachedAirspaceIntersections(vpElevationData, totalDist);
        for (const item of cachedAirspaces) {
            const { asIdx, as, lowerFt, upperFt, isLowerAgl, isUpperAgl, asMinDist, asMaxDist, relevantPts } = item;
            
            const style = getAirspaceStyle(as);
            const x1 = xOf(asMinDist), x2 = xOf(asMaxDist);

            ctx.fillStyle = vpHexToRgba(style.color, 0.15);
            ctx.strokeStyle = vpHexToRgba(style.color, 0.4);
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);

            // Airspace-Form zeichnen: MSL → exaktes Rechteck (kein Sampling-Artefakt),
            // AGL → Gelände-folgendes Polygon
            ctx.beginPath();
            if (!isLowerAgl && !isUpperAgl) {
                // Reines MSL-Rechteck — exakt von asMinDist bis asMaxDist
                const ry1 = yOf(Math.min(upperFt, maxAlt));
                const ry2 = yOf(Math.max(lowerFt, minAlt));
                ctx.moveTo(xOf(asMinDist), ry1);
                ctx.lineTo(xOf(asMaxDist), ry1);
                ctx.lineTo(xOf(asMaxDist), ry2);
                ctx.lineTo(xOf(asMinDist), ry2);
            } else {
                // AGL-Polygon entlang Geländeprofil
                for (let i = 0; i < relevantPts.length; i++) {
                    const p = relevantPts[i];
                    const realUpper = isUpperAgl ? p.elevFt + upperFt : upperFt;
                    const y = yOf(Math.min(realUpper, maxAlt));
                    if (i === 0) ctx.moveTo(xOf(p.distNM), y); else ctx.lineTo(xOf(p.distNM), y);
                }
                for (let i = relevantPts.length - 1; i >= 0; i--) {
                    const p = relevantPts[i];
                    const realLower = isLowerAgl ? p.elevFt + lowerFt : lowerFt;
                    ctx.lineTo(xOf(p.distNM), yOf(Math.max(realLower, minAlt)));
                }
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.setLineDash([]);

            let sumUpper = 0;
            relevantPts.forEach(p => sumUpper += (isUpperAgl ? p.elevFt + upperFt : upperFt));
            const avgUpper = relevantPts.length ? sumUpper / relevantPts.length : upperFt;

            let labelY = yOf(Math.min(avgUpper, maxAlt));
            labelY = Math.max(padTop + 15, labelY);
            const displayName = getAirspaceDisplayName(as);
            ctx.font = 'bold 8px Arial';
            const tw = ctx.measureText(displayName).width;
            const tLeft = ((x1 + x2) / 2) - tw/2, tRight = tLeft + tw;

            let collision = false;
            for(let occ of occupiedASLabels) {
                if (tLeft < occ.r && tRight > occ.l && labelY < occ.b && (labelY+20) > occ.t) { collision = true; break; }
            }
            if (!collision) {
                occupiedASLabels.push({l: tLeft-5, r: tRight+5, t: labelY-5, b: labelY+20});
                ctx.fillStyle = vpHexToRgba(style.color, 0.7);
                ctx.textAlign = 'center';
                ctx.fillText(displayName, (x1 + x2) / 2, labelY + 10);
                ctx.font = '7px Arial';
                ctx.fillText(formatAsLimit(as.lowerLimit) + ' – ' + formatAsLimit(as.upperLimit), (x1 + x2) / 2, labelY + 19);
            }
        }
    }
    ctx.textAlign = 'left';

    // Safety line (terrain + 1000ft)
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(200, 80, 0, 0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < vpElevationData.length; i++) {
        const x = xOf(vpElevationData[i].distNM), y = yOf(vpElevationData[i].elevFt + 1000);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Terrain polygon
    ctx.beginPath();
    ctx.moveTo(xOf(0), yOf(0));
    for (let i = 0; i < vpElevationData.length; i++) ctx.lineTo(xOf(vpElevationData[i].distNM), yOf(vpElevationData[i].elevFt));
    ctx.lineTo(xOf(totalDist), yOf(0));
    ctx.closePath();

    const terrainGrad = ctx.createLinearGradient(0, yOf(maxTerrain), 0, yOf(0));
    terrainGrad.addColorStop(0, '#8B7355');
    terrainGrad.addColorStop(0.3, '#6B8E23');
    terrainGrad.addColorStop(0.7, '#228B22');
    terrainGrad.addColorStop(1, '#2E8B57');
    ctx.fillStyle = terrainGrad;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < vpElevationData.length; i++) {
        const x = xOf(vpElevationData[i].distNM), y = yOf(vpElevationData[i].elevFt);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#3a5a20';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (vpShowLandmarks) vpDrawLandmarks(ctx, xOf, yOf, typeof elevData !== 'undefined' ? elevData : vpElevationData, totalDist, typeof zoomFactor !== 'undefined', typeof zoomFactor !== 'undefined' ? zoomFactor : 1.0, maxAlt);
    if (vpShowObstacles) vpDrawObstacles(ctx, xOf, yOf, totalDist, typeof zoomFactor !== 'undefined' ? zoomFactor : 1.0, typeof elevData !== 'undefined' ? elevData : vpElevationData);

    // Flight profile
    if (fpResult && fpResult.profile) {
        ctx.beginPath();
        for (let i = 0; i < fpResult.profile.length; i++) {
            const x = xOf(fpResult.profile[i].distNM), y = yOf(fpResult.profile[i].altFt) + 2;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.beginPath();
        for (let i = 0; i < fpResult.profile.length; i++) {
            const x = xOf(fpResult.profile[i].distNM), y = yOf(fpResult.profile[i].altFt);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#d93829';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // TOC
        ctx.beginPath();
        ctx.arc(xOf(fpResult.tocDistNM), yOf(cruiseAlt), 4, 0, Math.PI * 2);
        ctx.fillStyle = '#d93829';
        ctx.fill();
        ctx.fillStyle = '#333';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('TOC', xOf(fpResult.tocDistNM), yOf(cruiseAlt) - 7);

        // TOD
        ctx.beginPath();
        ctx.arc(xOf(fpResult.todDistNM), yOf(cruiseAlt), 4, 0, Math.PI * 2);
        ctx.fillStyle = '#d93829';
        ctx.fill();
        ctx.fillStyle = '#333';
        ctx.fillText('TOD', xOf(fpResult.todDistNM), yOf(cruiseAlt) - 7);
        ctx.textAlign = 'left';
    }

    // Waypoint markers
    let wpCumDist = 0;
    for (let i = 0; i < routeWaypoints.length; i++) {
        if (i > 0) {
            const prev = routeWaypoints[i - 1], curr = routeWaypoints[i];
            wpCumDist += calcNav(prev.lat, prev.lng || prev.lon, curr.lat, curr.lng || curr.lon).dist;
        }
        const x = xOf(wpCumDist);

        ctx.beginPath();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.moveTo(x, padTop);
        ctx.lineTo(x, padTop + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        let wpLabel = typeof vpRouteWaypointLabel === 'function'
            ? vpRouteWaypointLabel(i, routeWaypoints[i])
            : (i === 0 ? (currentStartICAO || 'DEP') : (routeWaypoints[i].name || 'WP' + i));
        if (wpLabel.length > 8) wpLabel = wpLabel.substring(0, 7) + '…';

        ctx.save();
        ctx.translate(x, padTop + plotH + 4);
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = '#333';
        ctx.font = 'bold 8px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(wpLabel, 0, 0);
        ctx.restore();

        ctx.beginPath();
        ctx.arc(x, padTop + 3, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? '#44ff44' : (i === routeWaypoints.length - 1 ? '#ff4444' : '#fdfd86');
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Y axis
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'right';
    const altStep = maxAlt > 6000 ? 2000 : (maxAlt > 3000 ? 1000 : 500);
    for (let alt = 0; alt <= maxAlt; alt += altStep) {
        const y = yOf(alt);
        if (y < padTop - 5 || y > padTop + plotH + 5) continue;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 0.5;
        ctx.moveTo(padLeft, y);
        ctx.lineTo(padLeft + plotW, y);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Arial';
        ctx.fillText(alt >= 1000 ? (alt / 1000).toFixed(alt % 1000 === 0 ? 0 : 1) + 'k' : alt + '', padLeft - 4, y + 3);
    }

    ctx.save();
    ctx.translate(8, padTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#888';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('ALT (ft)', 0, 0);
    ctx.restore();

    // X axis
    ctx.textAlign = 'center';
    const distStep = totalDist > 100 ? 20 : (totalDist > 50 ? 10 : 5);
    for (let d = 0; d <= totalDist; d += distStep) {
        ctx.fillStyle = '#888';
        ctx.font = '8px Arial';
        ctx.fillText(d + '', xOf(d), padTop + plotH + 22);
    }
    ctx.fillStyle = '#888';
    ctx.font = 'bold 8px Arial';
    ctx.fillText('NM', padLeft + plotW + 8, padTop + plotH + 22);

    // Border
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 1;
    ctx.strokeRect(padLeft, padTop, plotW, plotH);

    // Cruise altitude label & line
    ctx.fillStyle = 'rgba(217, 56, 41, 0.8)';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('CRZ ' + cruiseAlt + ' ft', padLeft + 4, yOf(cruiseAlt) - 4);
    ctx.beginPath();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = 'rgba(217, 56, 41, 0.3)';
    ctx.lineWidth = 1;
    ctx.moveTo(padLeft, yOf(cruiseAlt));
    ctx.lineTo(padLeft + plotW, yOf(cruiseAlt));
    ctx.stroke();
    ctx.setLineDash([]);

    // Peak elevation marker
    const peakPt = vpElevationData.reduce((max, p) => p.elevFt > max.elevFt ? p : max);
    ctx.fillStyle = '#333';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('▲', xOf(peakPt.distNM), yOf(peakPt.elevFt) - 3);
    ctx.font = 'bold 8px Arial';
    ctx.fillText(peakPt.elevFt + ' ft', xOf(peakPt.distNM), yOf(peakPt.elevFt) - 12);

    // Auto-update things that depend on the completed elevation data
    if (typeof renderAirspaceWarningsList === 'function') renderAirspaceWarningsList();
    if (typeof vpMapProfileVisible !== 'undefined' && vpMapProfileVisible && vpElevationData) {
        const mainAlt = document.getElementById('altSlider');
        const mapAlt = document.getElementById('altSliderMap');
        const mapDisplay = document.getElementById('altMapDisplay');
        if (mainAlt && mapAlt) { mapAlt.value = mainAlt.value; }
        if (mainAlt && mapDisplay) { mapDisplay.textContent = mainAlt.value; }
        renderMapProfile();
    }
}

function vpPointInPoly(pt, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        const intersect = ((yi > pt.lat) !== (yj > pt.lat)) && (pt.lon < (xj - xi) * (pt.lat - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function airspaceLimitToFt(lim) {
    if (!lim) return null;
    if (lim.referenceDatum === 0 && lim.value === 0) return 0;
    if (lim.unit === 6) return lim.value * 100;
    if (lim.unit === 1) return lim.value;
    if (lim.unit === 0) return Math.round(lim.value * 3.28084);
    return lim.value;
}

function getAirspaceVerticalBandFt(as, terrainFt) {
    if (!as?.lowerLimit || !as?.upperLimit) return null;
    const baseLowerFt = airspaceLimitToFt(as.lowerLimit);
    const baseUpperFt = airspaceLimitToFt(as.upperLimit);
    if (baseLowerFt === null || baseUpperFt === null) return null;
    const groundFt = Number(terrainFt) || 0;
    const isLowerAgl = !!(as._lowerIsAgl || as.lowerLimit.referenceDatum === 0);
    const isUpperAgl = !!(as._upperIsAgl || as.upperLimit.referenceDatum === 0);
    const lowerFt = isLowerAgl ? (groundFt + baseLowerFt) : baseLowerFt;
    const upperFt = isUpperAgl ? (groundFt + baseUpperFt) : baseUpperFt;
    return { lowerFt, upperFt, baseLowerFt, baseUpperFt, isLowerAgl, isUpperAgl };
}

function isPointInsideAirspace(as, lat, lon) {
    if (!as?.geometry) return false;
    const polys = [];
    if (as.geometry.type === 'Polygon') polys.push(as.geometry.coordinates[0]);
    else if (as.geometry.type === 'MultiPolygon') as.geometry.coordinates.forEach(mc => polys.push(mc[0]));
    for (const poly of polys) {
        if (vpPointInPoly({ lat, lon }, poly)) return true;
    }
    return false;
}

function vpHexToRgba(hex, alpha) {
    if (!hex || hex.charAt(0) !== '#') return 'rgba(0,0,0,' + alpha + ')';
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

/* =========================================================
   MAP TABLE PROFILE STRIP
   ========================================================= */
let vpMapProfileVisible = true;

function vpCanRunVisibleMapProfileWork() {
    const mapTable = document.getElementById('mapTableOverlay');
    return !document.hidden &&
        !!(mapTable && mapTable.classList.contains('active')) &&
        vpMapProfileVisible;
}

function vpPauseMapProfileWork(reason = 'hidden') {
    vpStopMapProfileFrameLoop();
    if (typeof vpMode !== 'undefined' && vpMode === 'HDG') {
        vpHdgRefreshPending = true;
        if (vpHdgWeatherAbortController && !vpHdgWeatherAbortController.signal.aborted) {
            vpHdgWeatherAbortController.abort();
        }
    }
    if (window.gaDebugPush) window.gaDebugPush('profile', 'Map profile paused', { reason: String(reason || '') });
}

function vpResumeMapProfile(reason = 'visible') {
    window.vpBgNeedsUpdate = true;
    if (!vpCanRunVisibleMapProfileWork()) return false;

    // Explizite Sichtbarkeits-/Routenereignisse umgehen den FPS-Timer bewusst.
    vpRequestMapProfileFrameNow();
    if (typeof vpMode !== 'undefined' && vpMode === 'HDG') {
        vpQueueHdgProfileUpdate({ force: true, reason });
    }
    if (window.gaDebugPush) window.gaDebugPush('profile', 'Map profile resumed', { reason: String(reason || '') });
    return true;
}
window.vpPauseMapProfile = vpPauseMapProfileWork;
window.vpResumeMapProfile = vpResumeMapProfile;

function toggleMapProfile() {
    vpMapProfileVisible = !vpMapProfileVisible;
    const strip = document.getElementById('mapProfileStrip');
    const btn = document.getElementById('vpToggleBtn');
    if (strip) strip.style.display = vpMapProfileVisible ? '' : 'none';
    if (btn) {
        btn.textContent = vpMapProfileVisible ? '📊 Profil (An)' : '📊 Profil (Aus)';
        btn.style.background = vpMapProfileVisible ? '#2E8B57' : '#444';
    }
    if (vpMapProfileVisible) {
        renderMapProfile();
        vpResumeMapProfile('profile-toggle');
        // Marker wieder anzeigen, falls er existiert
        if (vpPositionLeafletMarker && map) vpPositionLeafletMarker.addTo(map);
    } else {
        vpPauseMapProfileWork('profile-toggle');
        // Marker von der Karte entfernen, wenn Profil ausgeblendet
        if (vpPositionLeafletMarker && map) map.removeLayer(vpPositionLeafletMarker);
    }
    // Invalidate map size since space changed
    if (typeof map !== 'undefined' && map) setTimeout(() => map.invalidateSize(), 100);
}

function vpEnsureMapProfileVisible(reason = 'route') {
    vpMapProfileVisible = true;
    const strip = document.getElementById('mapProfileStrip');
    const btn = document.getElementById('vpToggleBtn');
    if (strip) strip.style.display = '';
    if (btn) {
        btn.textContent = '📊 Profil (An)';
        btn.style.background = '#2E8B57';
    }
    if (typeof initProfileResize === 'function') initProfileResize();
    if (typeof map !== 'undefined' && map && typeof map.invalidateSize === 'function') {
        setTimeout(() => map.invalidateSize(), 80);
    }
    const hasRoute = typeof routeWaypoints !== 'undefined' && Array.isArray(routeWaypoints) && routeWaypoints.length >= 2;
    if (hasRoute && typeof triggerVerticalProfileUpdate === 'function') {
        triggerVerticalProfileUpdate();
    } else if (document.getElementById('verticalProfileCanvas') && typeof renderVerticalProfile === 'function') {
        renderVerticalProfile('verticalProfileCanvas');
    }
    if (typeof renderMapProfile === 'function') renderMapProfile();
    vpResumeMapProfile(reason);
    if (window.gaDebugPush) window.gaDebugPush('profile', 'Map profile ensured visible', { reason, hasRoute });
}
window.vpEnsureMapProfileVisible = vpEnsureMapProfileVisible;

document.addEventListener('visibilitychange', () => {
    if (document.hidden) vpPauseMapProfileWork('document-hidden');
    else vpResumeMapProfile('document-visible');
});

function syncAltFromMap(val) {
    const mainSlider = document.getElementById('altSlider');
    if (mainSlider) mainSlider.value = val;
    document.getElementById('altMapDisplay').textContent = val;
    handleSliderChange('alt', val);
    renderMapProfile();
    if (typeof renderAirspaceWarningsList === 'function') renderAirspaceWarningsList();
}

// Globale Fast-Render Steuerung (Nun in app.js definiert)

let vpHighResFetchTimeout = null;
function vpZoom(delta) {
    window.activateFastRender();
    vpZoomLevel = Math.max(10, Math.min(100, vpZoomLevel + delta));
    const zd = document.getElementById('vpZoomDisplay');
    if (zd) zd.textContent = Math.round((100 - vpZoomLevel) / 90 * 100) + '%';

    // Ruckelfrei mit der Interaktions-Framerate rendern statt bei jedem Event
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();

    // High-Res API Debounce
    if (vpHighResFetchTimeout) clearTimeout(vpHighResFetchTimeout);
    if (vpZoomLevel < 100 && routeWaypoints && routeWaypoints.length >= 2) {
        vpHighResFetchTimeout = setTimeout(() => {
            fetchHighResElevation().then(() => {
                if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
            });
        }, 400); 
    } else if (vpZoomLevel === 100) {
        vpHighResData = null;
        if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
    }
}

async function fetchHighResElevation() {
    if (!routeWaypoints || routeWaypoints.length < 2) return;

    const interpolated = [];
    let cumulativeDist = 0;

    for (let i = 0; i < routeWaypoints.length - 1; i++) {
        const p1 = routeWaypoints[i], p2 = routeWaypoints[i + 1];
        const lat1 = p1.lat, lon1 = p1.lng || p1.lon;
        const lat2 = p2.lat, lon2 = p2.lng || p2.lon;
        const segDist = calcNav(lat1, lon1, lat2, lon2).dist;
        // Higher resolution: every 0.25 NM instead of 1 NM
        const steps = Math.max(1, Math.round(segDist * 4));

        for (let j = 0; j <= steps; j++) {
            if (i > 0 && j === 0) continue;
            const f = j / steps;
            interpolated.push({
                lat: lat1 + (lat2 - lat1) * f,
                lon: lon1 + (lon2 - lon1) * f,
                distNM: cumulativeDist + segDist * f
            });
        }
        cumulativeDist += segDist;
    }

    // Resample to max 100 points
    let samplePts = interpolated;
    if (interpolated.length > 100) {
        samplePts = [];
        for (let i = 0; i < 100; i++) {
            const idx = Math.round(i * (interpolated.length - 1) / 99);
            samplePts.push(interpolated[idx]);
        }
    }

    const lats = samplePts.map(p => p.lat.toFixed(5)).join(',');
    const lons = samplePts.map(p => p.lon.toFixed(5)).join(',');

    try {
        const terrariumData = await vpFetchElevationFromTerrarium(samplePts);
        if (terrariumData && terrariumData.length === samplePts.length) {
            vpHighResData = terrariumData;
            window.vpTerrainElevationSource = 'terrarium';
            return;
        }

        if (vpIsElevationCoolingDown()) return;
        if (window.vpWeatherDebug) window.vpWeatherDebug.elevationNetworkRequests += 1;
        const res = await fetch('https://api.open-meteo.com/v1/elevation?latitude=' + lats + '&longitude=' + lons);
        if (res.status === 429) {
            vpRecordElevation429();
            return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (!data.elevation || data.elevation.length !== samplePts.length) return;

        vpHighResData = samplePts.map((p, i) => ({
            distNM: p.distNM,
            elevFt: Math.round(data.elevation[i] * 3.28084),
            lat: p.lat,
            lon: p.lon
        }));
        window.vpTerrainElevationSource = 'openmeteo';
    } catch (e) {
        console.error('High-res elevation fetch error:', e);
    }
}

function renderMapProfile() {
    // Sicherheitsnetz: explizite Render-Aufrufe sollen den statischen Layer
    // immer neu zeichnen, damit Karten-Edits und Menü-Toggles sichtbar werden.
    window.vpBgNeedsUpdate = true;
    vpRequestMapProfileFrameNow();
}

function vpGetMapProfileElevationData(isHdgMode) {
    if (isHdgMode) {
        return Array.isArray(vpHdgElevData) && vpHdgElevData.length >= 2 ? vpHdgElevData : null;
    }
    if (vpZoomLevel < 100 && Array.isArray(vpHighResData) && vpHighResData.length >= 2) {
        return vpHighResData;
    }
    if (Array.isArray(vpElevationData) && vpElevationData.length >= 2) {
        return vpElevationData;
    }
    if (Array.isArray(window.vpElevationData) && window.vpElevationData.length >= 2) {
        vpElevationData = window.vpElevationData;
        return vpElevationData;
    }
    return null;
}

function vpIsProfileLowFpsMode() {
    try {
        if (typeof window.isLowFpsMode === 'function') return !!window.isLowFpsMode();
        if (typeof window.isMapHintEnabled === 'function') return !!window.isMapHintEnabled('lowFps');
        if (document.body && document.body.classList.contains('low-fps-mode')) return true;
        return localStorage.getItem('ga_map_hint_lowFps') === 'true';
    } catch (_) {
        return false;
    }
}

function vpGetMapProfileTargetFps(isHdgMode) {
    const lowFpsMode = vpIsProfileLowFpsMode();
    const isInteracting = !!(
        window.vpIsFastRendering ||
        window.vpUIInteractionActive === true ||
        window.vpProfilePanActive === true ||
        window.vpDraggingPosMarker === true ||
        (typeof vpResizeActive !== 'undefined' && vpResizeActive) ||
        (typeof vpDraggingWP !== 'undefined' && vpDraggingWP >= 0) ||
        (typeof vpDraggingSegment !== 'undefined' && !!vpDraggingSegment)
    );
    if (isInteracting) return lowFpsMode ? VP_PROFILE_FPS_INTERACT_LOW : VP_PROFILE_FPS_INTERACT;

    const obsSrc = isHdgMode ? vpHdgObstacles : vpObstacles;
    const hasObstacleAnim = vpShowObstacles && Array.isArray(obsSrc) && obsSrc.length > 0;
    const hasWeatherAnim = !!vpShowClouds;
    const hasAirspacePulse = (typeof vpHighlightPulseIdx !== 'undefined' && vpHighlightPulseIdx >= 0);
    const hasTrafficAnim = !!(window.vpTrafficProfileVisible && window.vpTrafficData && window.vpTrafficData.length);
    const hasPrediction = !!(window.vpPredictionData && window.vpPredictionData.length);

    const hasActiveAnimation = hasObstacleAnim || hasWeatherAnim || hasAirspacePulse || hasTrafficAnim || hasPrediction || isHdgMode;
    if (!hasActiveAnimation) return VP_PROFILE_FPS_IDLE;
    return lowFpsMode ? VP_PROFILE_FPS_ACTIVE_LOW : VP_PROFILE_FPS_ACTIVE;
}

// ─── TRAFFIC PROJEKTION AUF ROUTE ────────────────────────────────────────────
function vpProjectTrafficOnRoute(elevData) {
    if (!window.vpTrafficData?.length || !elevData?.length) return [];
    const MAX_LAT_NM = 5;
    const result = [];
    for (const ac of window.vpTrafficData) {
        let bestDist = Infinity, bestDistNM = 0;
        for (const ep of elevData) {
            if (ep.lat == null) continue;
            const d = calcNav(ac.lat, ac.lon, ep.lat, ep.lon).dist;
            if (d < bestDist) { bestDist = d; bestDistNM = ep.distNM; }
        }
        if (bestDist <= MAX_LAT_NM) {
            result.push({ id: ac.id, callsign: ac.callsign, projDistNM: bestDistNM, altFt: ac.alt, lateralNM: bestDist });
        }
    }
    return result;
}

// ─── TRAFFIC PROJEKTION AUF HEADING (HDG-MODUS) ──────────────────────────────
function vpProjectTrafficOnHeading() {
    if (!window.vpTrafficData?.length || !window.lastLiveGpsPos) return [];
    const { lat: oLat, lon: oLon, hdg: oHdg } = window.lastLiveGpsPos;
    const gs = (typeof smoothedGS !== 'undefined' && smoothedGS > 20) ? smoothedGS : 80;
    const hdgRad = oHdg * Math.PI / 180;
    const hdgSin = Math.sin(hdgRad), hdgCos = Math.cos(hdgRad);
    const MAX_LAT_NM = 5;
    const minAlongNM = -(VP_HDG_LOOKBACK_MIN * gs / 60);
    const maxAlongNM =  VP_HDG_LOOKAHEAD_MIN * gs / 60;
    const result = [];

    for (const ac of window.vpTrafficData) {
        const dLatNM = (ac.lat - oLat) * 60;
        const dLonNM = (ac.lon - oLon) * 60 * Math.cos(oLat * Math.PI / 180);
        const along = dLonNM * hdgSin + dLatNM * hdgCos;   // NM entlang Heading
        const cross = Math.abs(-dLonNM * hdgCos + dLatNM * hdgSin); // NM quer
        if (cross > MAX_LAT_NM || along < minAlongNM || along > maxAlongNM) continue;
        // Im HDG-Modus: distNM speichert Minuten (gleich wie vpHdgElevData)
        const timeMin = VP_HDG_LOOKBACK_MIN + (along / (gs / 60));
        result.push({ id: ac.id, callsign: ac.callsign, projDistNM: timeMin, altFt: ac.alt, lateralNM: cross });
    }
    return result;
}

// ─── TRAFFIC IM VERTIKALPROFIL ZEICHNEN ──────────────────────────────────────
function vpDrawTrafficInProfile(fgCtx, xOf, yOf, elevData, isHdgMode, viewMinX, viewMaxX) {
    if (!window.vpTrafficProfileVisible) return;
    const traffic = isHdgMode ? vpProjectTrafficOnHeading() : vpProjectTrafficOnRoute(elevData);
    if (!traffic.length) return;

    const ownAlt = (window.lastLiveGpsPos?.alt) ?? vpLiveAltFt ?? 0;

    for (const ac of traffic) {
        const tx = xOf(ac.projDistNM);
        const ty = yOf(ac.altFt);
        if (tx < viewMinX - 30 || tx > viewMaxX + 30) continue;

        const relAlt = Math.round((ac.altFt - ownAlt) / 100) * 100;
        const relAltStr = (relAlt >= 0 ? '+' : '') + relAlt;
        const relAltColor = Math.abs(relAlt) < 300 ? '#ff8800' : relAlt > 0 ? '#44ff44' : '#888888';

        fgCtx.save();
        fgCtx.translate(tx, ty);

        // Flugzeug-Silhouette (Seitenansicht, schaut nach rechts)
        fgCtx.fillStyle = '#00ccff';
        fgCtx.strokeStyle = 'rgba(0,0,0,0.6)';
        fgCtx.lineWidth = 0.5;

        // Rumpf
        fgCtx.beginPath();
        fgCtx.ellipse(0, 0, 7, 2, 0, 0, Math.PI * 2);
        fgCtx.fill(); fgCtx.stroke();

        // Tragfläche (oben)
        fgCtx.beginPath();
        fgCtx.moveTo(-7, -1); fgCtx.lineTo(5, -1); fgCtx.lineTo(4, 1.5); fgCtx.lineTo(-6, 1.5);
        fgCtx.closePath(); fgCtx.fill(); fgCtx.stroke();

        // Leitwerk (hinten oben)
        fgCtx.beginPath();
        fgCtx.moveTo(-7, -1); fgCtx.lineTo(-4, -4); fgCtx.lineTo(-2, -1);
        fgCtx.closePath(); fgCtx.fill(); fgCtx.stroke();

        // Relative Höhe
        fgCtx.fillStyle = relAltColor;
        fgCtx.font = 'bold 8px monospace';
        fgCtx.textAlign = 'center';
        fgCtx.fillText(relAltStr, 0, -11);

        // Callsign (wenn vorhanden)
        if (ac.callsign) {
            fgCtx.fillStyle = 'rgba(0, 200, 255, 0.75)';
            fgCtx.font = '7px monospace';
            fgCtx.fillText(ac.callsign, 0, 14);
        }

        fgCtx.restore();
    }
}

window.vpToggleTrafficProfile = function() {
    window.vpTrafficProfileVisible = !window.vpTrafficProfileVisible;
    updateTrafficProfileBtn();
};

function renderMapProfileFrames(timeMs) {
    const frameT0 = performance && performance.now ? performance.now() : Date.now();
    if (!vpCanRunVisibleMapProfileWork()) {
        vpStopMapProfileFrameLoop();
        return;
    }

    const fgCanvas = document.getElementById('mapProfileCanvas');
    const bgCanvas = document.getElementById('mapProfileCanvasBg');
    const scrollContainer = document.getElementById('mapProfileScroll');
    const wrapper = document.getElementById('vpCanvasWrapper');
    if (!fgCanvas || !bgCanvas || !scrollContainer || !wrapper) {
        vpScheduleMapProfileFrame(250);
        return;
    }

    const isHdgMode = (typeof vpMode !== 'undefined' && vpMode === 'HDG');
    const perfMeta = window.vpAnimFrameMeta || (window.vpAnimFrameMeta = { lastPaintMs: 0, lastTargetFps: 0 });
    const targetFps = vpGetMapProfileTargetFps(isHdgMode);
    const frameIntervalMs = 1000 / Math.max(1, targetFps);
    const nowMs = Number.isFinite(timeMs) ? timeMs : performance.now();
    const elapsedMs = nowMs - (Number(perfMeta.lastPaintMs) || 0);

    if (!window.vpBgNeedsUpdate && elapsedMs < frameIntervalMs) {
        vpScheduleMapProfileFrame(frameIntervalMs - elapsedMs);
        return;
    }
    const elevData = vpGetMapProfileElevationData(isHdgMode);
    if (!elevData || elevData.length < 2) {
        window.vpBgNeedsUpdate = true;
        perfMeta.lastNoElevationMs = nowMs;
        vpScheduleMapProfileFrame(250);
        return;
    }
    perfMeta.lastPaintMs = nowMs;
    perfMeta.lastTargetFps = targetFps;

    const containerHeight = scrollContainer.clientHeight || 100;
    const baseWidth = scrollContainer.clientWidth || 600;
    const zoomFactor = 100 / vpZoomLevel;
    
    // Virtuelle Breite für die Scrollbar
    const virtualWidth = Math.round(baseWidth * zoomFactor);
    if (wrapper.style.width !== virtualWidth + 'px') wrapper.style.width = virtualWidth + 'px';

    // Canvas bleibt immer exakt so groß wie der sichtbare Bildschirm! (Kein iOS Absturz mehr)
    const dpr = window.devicePixelRatio || 1;
    const targetW = baseWidth * dpr;
    const targetH = containerHeight * dpr;

    const padLeft = 33, padRight = 16, padTop = 12, padBottom = 22;
    const plotW = virtualWidth - padLeft - padRight;
    const plotH = containerHeight - padTop - padBottom;

    const cruiseAlt = parseInt(document.getElementById('altMapInput')?.textContent || document.getElementById('altSlider')?.value || 4500);
    const tas = parseInt(document.getElementById('tasSlider')?.value || 115);
    const totalDist = elevData[elevData.length - 1].distNM;
    const maxTerrain = Math.max(...elevData.map(p => p.elevFt));
    let autoMaxAlt = Math.max(cruiseAlt + 2500, maxTerrain + 1000);
    let currentMaxAlt = vpMaxAltOverride > 0 ? vpMaxAltOverride : autoMaxAlt;

    // PERFORMANCE & UX FIX: Y-Achse während des Ziehens einfrieren!
    const isDragging = (typeof vpDraggingWP !== 'undefined' && vpDraggingWP >= 0) || 
                       (typeof vpDraggingSegment !== 'undefined' && !!vpDraggingSegment) ||
                       (window.vpDraggingPosMarker === true);
    
    if (isDragging) {
        if (!window._vpFrozenMaxAlt) window._vpFrozenMaxAlt = currentMaxAlt;
        currentMaxAlt = window._vpFrozenMaxAlt;
    } else {
        window._vpFrozenMaxAlt = null;
    }
    const maxAlt = currentMaxAlt;
    const minAlt = 0;

    const fpResult = typeof computeFlightProfile === 'function' ? computeFlightProfile(elevData, cruiseAlt, vpClimbRate, vpDescentRate, tas) : null;
    const xOf = (distNM) => padLeft + (distNM / totalDist) * plotW;
    const yOf = (altFt) => padTop + plotH - ((altFt - minAlt) / (maxAlt - minAlt)) * plotH;
    
    const maxScroll = Math.max(0, virtualWidth - baseWidth);
    const viewXRaw = scrollContainer.scrollLeft;
    const viewX = Math.min(viewXRaw, maxScroll);
    
    // Zwinge die Scrollbar sofort zurück, falls wir durch Auszoomen im Nichts gelandet sind
    if (viewXRaw > maxScroll) {
        scrollContainer.scrollLeft = maxScroll;
    }

    if (viewX !== window._vpLastScrollLeft) {
        window.vpBgNeedsUpdate = true;
        window._vpLastScrollLeft = viewX;
    }
    
    // Hardwarebeschleunigtes Mitführen der Leinwände (GPU Magic)
    bgCanvas.style.transform = `translateX(${viewX}px)`;
    fgCanvas.style.transform = `translateX(${viewX}px)`;

    const viewMinX = viewX - 50;
    const viewMaxX = viewX + baseWidth + 50;

    // NEU: Luftraum-Render-Logik als wiederverwendbare Funktion (für BG und FG)
    const drawAirspaces = (targetCtx, isFg) => {
        let occupiedASLabels = [];
        if (typeof activeAirspaces !== 'undefined' && activeAirspaces.length > 0) {
            const cachedAirspaces = getCachedAirspaceIntersections(elevData, totalDist);
            for (const item of cachedAirspaces) {
                const { asIdx, as, lowerFt, upperFt, isLowerAgl, isUpperAgl, asMinDist, asMaxDist, relevantPts } = item;
                const style = getAirspaceStyle(as);
                const x1 = xOf(asMinDist), x2 = xOf(asMaxDist);

                const isHighlighted = !!isFg && (typeof vpHighlightPulseIdx !== 'undefined' && vpHighlightPulseIdx >= 0 && asIdx === vpHighlightPulseIdx);
                const phase = typeof vpPulsePhase !== 'undefined' ? vpPulsePhase : 0;
                const pulseOpacity = isHighlighted ? 0.2 + 0.4 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2)) : (isFg ? 0.22 : 0.15);
                const strokeOpacity = isHighlighted ? 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2)) : 0.5;
                const lineW = isHighlighted ? 2 + 2 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2)) : 2;

                targetCtx.fillStyle = vpHexToRgba(style.color, pulseOpacity);
                targetCtx.strokeStyle = vpHexToRgba(style.color, strokeOpacity);
                targetCtx.lineWidth = lineW; 
                targetCtx.setLineDash(isHighlighted ? [] : [3, 3]);

                // Airspace-Form zeichnen: MSL → exaktes Rechteck, AGL → Gelände-Polygon
                targetCtx.beginPath();
                if (!isLowerAgl && !isUpperAgl) {
                    const ry1 = yOf(Math.min(upperFt, maxAlt));
                    const ry2 = yOf(Math.max(lowerFt, minAlt));
                    targetCtx.moveTo(xOf(asMinDist), ry1);
                    targetCtx.lineTo(xOf(asMaxDist), ry1);
                    targetCtx.lineTo(xOf(asMaxDist), ry2);
                    targetCtx.lineTo(xOf(asMinDist), ry2);
                } else {
                    for (let i = 0; i < relevantPts.length; i++) {
                        const p = relevantPts[i];
                        const realUpper = isUpperAgl ? p.elevFt + upperFt : upperFt;
                        const y = yOf(Math.min(realUpper, maxAlt));
                        if (i === 0) targetCtx.moveTo(xOf(p.distNM), y); else targetCtx.lineTo(xOf(p.distNM), y);
                    }
                    for (let i = relevantPts.length - 1; i >= 0; i--) {
                        const p = relevantPts[i];
                        const realLower = isLowerAgl ? p.elevFt + lowerFt : lowerFt;
                        targetCtx.lineTo(xOf(p.distNM), yOf(Math.max(realLower, minAlt)));
                    }
                }
                targetCtx.closePath(); targetCtx.fill(); targetCtx.stroke(); targetCtx.setLineDash([]);

                let sumUpper = 0; relevantPts.forEach(p => sumUpper += (isUpperAgl ? p.elevFt + upperFt : upperFt));
                const avgUpper = sumUpper / relevantPts.length;
                let labelY = yOf(Math.min(avgUpper, maxAlt)); labelY = Math.max(padTop + 15, labelY); 

                if (!window.vpIsFastRendering && (zoomFactor >= 1.5 || (x2 - x1) > 40 || isHighlighted)) {
                    const displayName = getAirspaceDisplayName(as);
                    targetCtx.font = isHighlighted ? 'bold 11px Arial' : 'bold 10px Arial';
                    const tw = targetCtx.measureText(displayName).width;
                    const tLeft = ((x1 + x2) / 2) - tw/2, tRight = tLeft + tw;
                    let collision = false;
                    if (!isHighlighted) {
                        for (let occ of occupiedASLabels) {
                            if (tLeft < occ.r && tRight > occ.l && labelY < occ.b && (labelY+25) > occ.t) { collision = true; break; }
                        }
                    }
                    if (!collision) {
                        if (!isHighlighted) occupiedASLabels.push({l: tLeft-5, r: tRight+5, t: labelY-5, b: labelY+25});
                        targetCtx.fillStyle = vpHexToRgba(style.color, isHighlighted ? 0.9 : 0.6); targetCtx.textAlign = 'center';
                        targetCtx.fillText(displayName, (x1 + x2) / 2, labelY + 12);
                        if (zoomFactor >= 2 || isHighlighted) {
                            targetCtx.font = '9px Arial'; targetCtx.fillText(formatAsLimit(as.lowerLimit) + ' – ' + formatAsLimit(as.upperLimit), (x1 + x2) / 2, labelY + 23);
                        }
                    }
                }
            }
        }
        targetCtx.textAlign = 'left';
    };

    // =======================================================
    // LAYER 1: STATISCHER HINTERGRUND
    // =======================================================
    const needsBgRender = window.vpBgNeedsUpdate
        || bgCanvas.width !== targetW
        || bgCanvas.height !== targetH;
    if (needsBgRender) {
        const bgT0 = performance && performance.now ? performance.now() : Date.now();
        if (bgCanvas.width !== targetW || bgCanvas.height !== targetH) {
            bgCanvas.width = targetW; 
            bgCanvas.height = targetH;
            bgCanvas.style.width = baseWidth + 'px'; 
            bgCanvas.style.height = containerHeight + 'px';
        }
        const bgCtx = bgCanvas.getContext('2d');
        bgCtx.save();
        bgCtx.scale(dpr, dpr);
        bgCtx.translate(-viewX, 0); // Vektor-Koordinatensystem anpassen

        bgCtx.clearRect(viewX, 0, baseWidth, containerHeight);

        bgCtx.fillStyle = '#1a1a1a'; 
        bgCtx.fillRect(viewX, 0, baseWidth, containerHeight);
        
        const skyGrad = bgCtx.createLinearGradient(0, padTop, 0, padTop + plotH);
        skyGrad.addColorStop(0, '#1a2a3a'); 
        skyGrad.addColorStop(0.5, '#1a2030'); 
        skyGrad.addColorStop(1, '#151a20');
        bgCtx.fillStyle = skyGrad; 
        bgCtx.fillRect(viewX, padTop, baseWidth, plotH);

        // Wolken explizit weit nach hinten: direkt nach dem Himmel zeichnen,
        // damit Landschaft, Landmarken und Hindernisse klar davor liegen.
        if (vpShowClouds) {
            if (vpWeatherRenderMode === 'abstrakt' || vpWeatherRenderMode === 'pro') vpDrawCloudsPro(bgCtx, xOf, yOf, padTop, plotH, totalDist, true, elevData);
            else vpDrawClouds(bgCtx, xOf, yOf, padTop, plotH, totalDist, true, elevData);
        }

        // Aufruf für Layer 1 (Statischer Hintergrund)
        if (vpAirspaceMode === 1) {
            drawAirspaces(bgCtx, false);
        }

        bgCtx.beginPath(); bgCtx.setLineDash([4, 4]); bgCtx.strokeStyle = 'rgba(200, 120, 40, 0.4)'; bgCtx.lineWidth = 1;
        for (let i = 0; i < elevData.length; i++) {
            const x = xOf(elevData[i].distNM), y = yOf(elevData[i].elevFt + 1000);
            if (i === 0) bgCtx.moveTo(x, y); else bgCtx.lineTo(x, y);
        }
        bgCtx.stroke(); bgCtx.setLineDash([]);

        bgCtx.beginPath(); bgCtx.moveTo(xOf(0), yOf(0));
        for (let i = 0; i < elevData.length; i++) bgCtx.lineTo(xOf(elevData[i].distNM), yOf(elevData[i].elevFt));
        bgCtx.lineTo(xOf(totalDist), yOf(0)); bgCtx.closePath();
        const terrainGrad = bgCtx.createLinearGradient(0, yOf(maxTerrain), 0, yOf(0));
        terrainGrad.addColorStop(0, '#6B5B3C'); terrainGrad.addColorStop(0.3, '#3B5B23'); terrainGrad.addColorStop(0.7, '#1B5B22'); terrainGrad.addColorStop(1, '#1E5B37');
        bgCtx.fillStyle = terrainGrad; bgCtx.fill();
        
        bgCtx.beginPath();
        for (let i = 0; i < elevData.length; i++) {
            const x = xOf(elevData[i].distNM), y = yOf(elevData[i].elevFt);
            if (i === 0) bgCtx.moveTo(x, y); else bgCtx.lineTo(x, y);
        }
        bgCtx.strokeStyle = '#4a7a30'; bgCtx.lineWidth = 1.5; bgCtx.stroke();

        // WÄLDER UND FLÜSSE GENERIEREN
        vpDrawTerrainCover(bgCtx, xOf, yOf, elevData, viewMinX, viewMaxX, zoomFactor, maxAlt);

        // Landmarken werden im Vordergrund gezeichnet (Top-Priorität),
        // damit Hindernisse/Linears dahinter liegen dürfen.

        bgCtx.textAlign = 'right';
        const altStep = maxAlt > 6000 ? 2000 : (maxAlt > 3000 ? 1000 : 500);
        for (let alt = 0; alt <= maxAlt; alt += altStep) {
            const y = yOf(alt);
            if (y < padTop - 3 || y > padTop + plotH + 3) continue;
            bgCtx.beginPath(); bgCtx.strokeStyle = 'rgba(255,255,255,0.05)'; bgCtx.lineWidth = 0.5;
            bgCtx.moveTo(viewX + padLeft, y); bgCtx.lineTo(viewX + baseWidth, y); bgCtx.stroke();
            bgCtx.fillStyle = '#fff'; bgCtx.font = 'bold 10px Arial';
            bgCtx.fillText(alt >= 1000 ? (alt / 1000).toFixed(0) + 'k' : alt + '', viewX + padLeft - 3, y + 3);
        }

        if (!isHdgMode) {
            vpDrawIsobars(bgCtx, xOf, yOf, padTop, plotH, viewMinX, viewMaxX, viewX + baseWidth - 4);
        }

        bgCtx.textAlign = 'center';
        if (isHdgMode) {
            // X-Achse in Minuten (HDG-Modus)
            const hdgHdgVal = window.lastLiveGpsPos ? Math.round(window.lastLiveGpsPos.hdg) : 0;
            const acX = xOf(VP_HDG_LOOKBACK_MIN);
            // Flugzeug-Trennlinie (senkrecht, gestrichelt)
            bgCtx.beginPath(); bgCtx.setLineDash([3, 4]);
            bgCtx.strokeStyle = 'rgba(100,200,255,0.3)'; bgCtx.lineWidth = 1;
            bgCtx.moveTo(acX, padTop); bgCtx.lineTo(acX, padTop + plotH); bgCtx.stroke(); bgCtx.setLineDash([]);
            // Minuten-Ticks
            const tickStep = totalDist > 12 ? 5 : 2;
            for (let m = 0; m <= Math.ceil(totalDist); m += tickStep) {
                const x = xOf(m);
                const label = m < VP_HDG_LOOKBACK_MIN ? `-${Math.round(VP_HDG_LOOKBACK_MIN - m)}m`
                    : m === VP_HDG_LOOKBACK_MIN ? 'NOW'
                    : `+${Math.round(m - VP_HDG_LOOKBACK_MIN)}m`;
                bgCtx.fillStyle = m === VP_HDG_LOOKBACK_MIN ? '#64c8ff' : '#666';
                bgCtx.font = m === VP_HDG_LOOKBACK_MIN ? 'bold 8px Arial' : '8px Arial';
                bgCtx.fillText(label, x, containerHeight - 1);
            }
            // Mode-Label oben links
            bgCtx.fillStyle = '#64c8ff'; bgCtx.font = 'bold 9px Arial'; bgCtx.textAlign = 'left';
            bgCtx.fillText(`HDG ${hdgHdgVal}°`, viewX + padLeft + 4, padTop + 10);
        } else {
            const distStep = totalDist > 150 ? 25 : (totalDist > 80 ? 10 : 5);
            for (let d = distStep; d < totalDist; d += distStep) {
                bgCtx.fillStyle = '#666'; bgCtx.font = '8px Arial'; bgCtx.fillText(d + '', xOf(d), containerHeight - 1);
            }
        }

        const peakPt = elevData.reduce((max, p) => p.elevFt > max.elevFt ? p : max);
        bgCtx.fillStyle = '#aaa'; bgCtx.font = '11px Arial'; bgCtx.textAlign = 'center';
        bgCtx.fillText('▲', xOf(peakPt.distNM), yOf(peakPt.elevFt) - 3);
        bgCtx.font = 'bold 9px Arial'; bgCtx.fillText(peakPt.elevFt + ' ft', xOf(peakPt.distNM), yOf(peakPt.elevFt) - 13);

        bgCtx.strokeStyle = '#333'; bgCtx.lineWidth = 1; 
        bgCtx.strokeRect(padLeft, padTop, plotW, plotH);
        bgCtx.restore();
        window.vpBgNeedsUpdate = false;
        if (window.vpProfilePerfWarn) {
            window.vpProfilePerfWarn('Profile map background render', bgT0, {
                elevPoints: Array.isArray(elevData) ? elevData.length : 0,
                width: Math.round(baseWidth),
                height: Math.round(containerHeight),
                zoomFactor: Math.round(zoomFactor * 100) / 100
            }, 90);
        }
    }

    // =======================================================
    // LAYER 2: DYNAMISCHER VORDERGRUND 
    // =======================================================
    if (fgCanvas.width !== targetW || fgCanvas.height !== targetH) {
        fgCanvas.width = targetW; 
        fgCanvas.height = targetH;
        fgCanvas.style.width = baseWidth + 'px'; 
        fgCanvas.style.height = containerHeight + 'px';
    }
    const fgCtx = fgCanvas.getContext('2d');
    fgCtx.save();
    fgCtx.scale(dpr, dpr);
    fgCtx.translate(-viewX, 0); 

    fgCtx.clearRect(viewX, 0, baseWidth, containerHeight);

    // Aufruf für Layer 2 (Dynamischer Vordergrund)
    if (vpAirspaceMode === 2) {
        drawAirspaces(fgCtx, true);
    }

    if (vpShowObstacles) {
        const obsSrc = isHdgMode ? vpHdgObstacles : vpObstacles;
        if (obsSrc && obsSrc.length > 0) {
            const obsT0 = performance && performance.now ? performance.now() : Date.now();
            vpDrawObstacles(fgCtx, xOf, yOf, totalDist, zoomFactor, elevData, timeMs, obsSrc);
            if (window.vpProfilePerfWarn) {
                window.vpProfilePerfWarn('Profile map obstacles render', obsT0, {
                    obs: Array.isArray(obsSrc) ? obsSrc.length : 0,
                    lin: Array.isArray(vpLinearFeatures) ? vpLinearFeatures.length : 0,
                    zoomFactor: Math.round(zoomFactor * 100) / 100
                }, 90);
            }
        }
    }
    if (vpShowClouds) {
        if (vpWeatherRenderMode === 'abstrakt' || vpWeatherRenderMode === 'pro') vpDrawAnimatedWeatherPro(fgCtx, xOf, yOf, totalDist, elevData, timeMs, viewMinX, viewMaxX);
        else vpDrawAnimatedWeather(fgCtx, xOf, yOf, totalDist, elevData, timeMs, viewMinX, viewMaxX);
    }
    if (!isHdgMode) vpDrawWindComponentsOnIsobars(fgCtx, xOf, yOf, elevData, viewMinX, viewMaxX, padTop, plotH);

    // Im HDG-Modus: Fluglinie einblenden wenn Flugzeug ≤2 NM von der geplanten Route entfernt
    // X-Achse: NM-Offset vom aktuellen Standort → Minuten umrechnen (offsetNM / gs * 60)
    if (isHdgMode
        && typeof vpLiveGpsFraction === 'number' && vpLiveGpsFraction >= 0
        && (window.vpLiveRouteDistNM ?? 999) <= 2.0
        && typeof vpElevationData !== 'undefined' && vpElevationData && vpElevationData.length >= 2
        && typeof computeFlightProfile === 'function') {

        const routeElevData = vpElevationData;
        const routeTotalDist = routeElevData[routeElevData.length - 1].distNM;
        const tasHdg = parseInt(document.getElementById('tasSlider')?.value || 115);
        const fpRoute = computeFlightProfile(routeElevData, cruiseAlt, vpClimbRate, vpDescentRate, tasHdg);
        if (fpRoute && fpRoute.profile) {
            const liveDistNM = vpLiveGpsFraction * routeTotalDist;
            const gs = (window.lastLiveGpsPos?.gs > 20 ? window.lastLiveGpsPos.gs : null) || tasHdg;
            const hdgTotalMin = VP_HDG_LOOKBACK_MIN + VP_HDG_LOOKAHEAD_MIN;

            const _drawHdgFpLine = (offsetY, style, width) => {
                fgCtx.beginPath();
                let started = false;
                for (const pt of fpRoute.profile) {
                    const offsetNM = pt.distNM - liveDistNM;
                    const minAxis = VP_HDG_LOOKBACK_MIN + (offsetNM / gs * 60);
                    if (minAxis < -0.5 || minAxis > hdgTotalMin + 0.5) { started = false; continue; }
                    const x = xOf(minAxis);
                    if (x < viewMinX - 60 || x > viewMaxX + 60) { started = false; continue; }
                    const y = yOf(pt.altFt) + offsetY;
                    if (!started) { fgCtx.moveTo(x, y); started = true; } else { fgCtx.lineTo(x, y); }
                }
                fgCtx.strokeStyle = style; fgCtx.lineWidth = width; fgCtx.stroke();
            };
            _drawHdgFpLine(1, 'rgba(0,0,0,0.3)', 3);
            _drawHdgFpLine(0, '#ff4444', 2);
        }
    }

    // Fluglinie (Climb/Cruise/Descend) und Route-Waypoint-Marker nur im RTE-Modus
    // Im HDG-Modus wären distNM-Werte (NM) falsch durch xOf() das Minuten erwartet
    if (!isHdgMode) {
        if (fpResult && fpResult.profile) {
            fgCtx.beginPath();
            let shStarted = false;
            for (let i = 0; i < fpResult.profile.length; i++) {
                const x = xOf(fpResult.profile[i].distNM);
                if (x < viewMinX - 100 && i < fpResult.profile.length - 1 && xOf(fpResult.profile[i+1].distNM) < viewMinX) continue;
                if (x > viewMaxX + 100 && i > 0 && xOf(fpResult.profile[i-1].distNM) > viewMaxX) continue;
                const y = yOf(fpResult.profile[i].altFt) + 1;
                if (!shStarted) { fgCtx.moveTo(x, y); shStarted = true; } else { fgCtx.lineTo(x, y); }
            }
            fgCtx.strokeStyle = 'rgba(0,0,0,0.3)'; fgCtx.lineWidth = 3; fgCtx.stroke();

            fgCtx.beginPath();
            let rdStarted = false;
            for (let i = 0; i < fpResult.profile.length; i++) {
                const x = xOf(fpResult.profile[i].distNM);
                if (x < viewMinX - 100 && i < fpResult.profile.length - 1 && xOf(fpResult.profile[i+1].distNM) < viewMinX) continue;
                if (x > viewMaxX + 100 && i > 0 && xOf(fpResult.profile[i-1].distNM) > viewMaxX) continue;
                const y = yOf(fpResult.profile[i].altFt);
                if (!rdStarted) { fgCtx.moveTo(x, y); rdStarted = true; } else { fgCtx.lineTo(x, y); }
            }
            fgCtx.strokeStyle = '#ff4444'; fgCtx.lineWidth = 2; fgCtx.stroke();
        }
    }

    // CRZ-Höhenlinie (gestrichelt, horizontal) – in beiden Modi
    fgCtx.beginPath(); fgCtx.setLineDash([6, 4]); fgCtx.strokeStyle = 'rgba(255, 68, 68, 0.3)'; fgCtx.lineWidth = 1;
    fgCtx.moveTo(Math.max(padLeft, viewMinX), yOf(cruiseAlt));
    fgCtx.lineTo(Math.min(padLeft + plotW, viewMaxX), yOf(cruiseAlt));
    fgCtx.stroke(); fgCtx.setLineDash([]);
    fgCtx.fillStyle = 'rgba(255, 68, 68, 0.7)'; fgCtx.font = 'bold 10px Arial'; fgCtx.textAlign = 'left';
    fgCtx.fillText('CRZ ' + cruiseAlt + ' ft', Math.max(padLeft + 4, viewMinX + 4), yOf(cruiseAlt) - 4);

    // Im HDG-Modus: "JETZT"-Linie bei VP_HDG_LOOKBACK_MIN (Flugzeugposition)
    if (isHdgMode) {
        const nowX = xOf(VP_HDG_LOOKBACK_MIN);
        if (nowX >= viewMinX && nowX <= viewMaxX) {
            fgCtx.beginPath();
            fgCtx.setLineDash([3, 4]);
            fgCtx.strokeStyle = 'rgba(255,255,255,0.18)';
            fgCtx.lineWidth = 1;
            fgCtx.moveTo(nowX, padTop);
            fgCtx.lineTo(nowX, padTop + plotH);
            fgCtx.stroke();
            fgCtx.setLineDash([]);
            fgCtx.fillStyle = 'rgba(255,255,255,0.35)';
            fgCtx.font = '8px Arial'; fgCtx.textAlign = 'center';
            fgCtx.fillText('NOW', nowX, padTop + plotH + 12);
        }
    }

    // Route-Waypoint-Marker nur im RTE-Modus (Positionen in NM, im HDG unbrauchbar)
    if (!isHdgMode) {
        let wpCumDist = 0;
        for (let i = 0; i < routeWaypoints.length; i++) {
            if (i > 0) wpCumDist += calcNav(routeWaypoints[i - 1].lat, routeWaypoints[i - 1].lng || routeWaypoints[i - 1].lon, routeWaypoints[i].lat, routeWaypoints[i].lng || routeWaypoints[i].lon).dist;
            const x = xOf(wpCumDist);
            if (x < viewMinX - 40 || x > viewMaxX + 40) continue;

            fgCtx.beginPath(); fgCtx.setLineDash([2, 3]); fgCtx.strokeStyle = 'rgba(255,255,255,0.2)'; fgCtx.lineWidth = 1;
            fgCtx.moveTo(x, padTop); fgCtx.lineTo(x, padTop + plotH); fgCtx.stroke(); fgCtx.setLineDash([]);
            let wpLabel = typeof vpRouteWaypointLabel === 'function'
                ? vpRouteWaypointLabel(i, routeWaypoints[i])
                : (i === 0 ? (currentStartICAO || 'DEP') : (routeWaypoints[i].name || 'WP' + i));
            if (!zoomFactor || zoomFactor < 2) { if (wpLabel.length > 6) wpLabel = wpLabel.substring(0, 5) + '…'; } else { if (wpLabel.length > 12) wpLabel = wpLabel.substring(0, 11) + '…'; }
            fgCtx.beginPath(); fgCtx.arc(x, padTop + plotH + 3, 3, 0, Math.PI * 2); fgCtx.fillStyle = i === 0 ? '#44ff44' : (i === routeWaypoints.length - 1 ? '#ff4444' : '#ffcc00'); fgCtx.fill();
            fgCtx.fillStyle = '#bbb'; fgCtx.font = (zoomFactor >= 2) ? 'bold 11px Arial' : 'bold 9px Arial'; fgCtx.textAlign = 'center'; fgCtx.fillText(wpLabel, x, padTop + plotH + 16);
        }
    }

    // A: SCRUB-MARKER (Magenta Linie bei Hover)
    // Scrub-Marker nur im RTE-Modus (in HDG-Modus ist Position live-GPS-gesteuert)
    if (!isHdgMode && typeof vpPositionFraction === 'number' && vpPositionFraction >= 0) {
        const posX = xOf(vpPositionFraction * totalDist);
        if (posX >= viewMinX - 20 && posX <= viewMaxX + 20) {
            fgCtx.beginPath(); fgCtx.strokeStyle = '#ff00ff'; fgCtx.lineWidth = 1.5; fgCtx.moveTo(posX, padTop); fgCtx.lineTo(posX, padTop + plotH); fgCtx.stroke();
            fgCtx.beginPath(); fgCtx.moveTo(posX, padTop + plotH + 2); fgCtx.lineTo(posX - 5, padTop + plotH + 10); fgCtx.lineTo(posX + 5, padTop + plotH + 10); fgCtx.closePath(); fgCtx.fillStyle = '#ff00ff'; fgCtx.fill();
        }
    }

            // B: LIVE-GPS-MARKER (Das Flugzeug)
    const _showLiveMarker = isHdgMode
        ? (window.lastLiveGpsPos != null)
        : (typeof vpLiveGpsFraction === 'number' && vpLiveGpsFraction >= 0);
    if (_showLiveMarker) {
        const liveX = isHdgMode
            ? xOf(VP_HDG_LOOKBACK_MIN)   // Im HDG-Modus: leicht eingerückt vom linken Rand
            : xOf(vpLiveGpsFraction * totalDist);
        const _liveAlt = isHdgMode ? (window.lastLiveGpsPos?.alt ?? 0) : vpLiveAltFt;
        if (liveX >= viewMinX - 50 && liveX <= viewMaxX + 50) {
            const liveY = yOf(_liveAlt);
            
            // CSS Variablen auslesen
            const rootStyle = getComputedStyle(document.documentElement);
            const planeColor = rootStyle.getPropertyValue('--plane-color').trim() || '#f2c12e';
            const planeSizePx = parseInt(rootStyle.getPropertyValue('--plane-size')) || 40;

            fgCtx.save();
            fgCtx.translate(liveX, liveY);

            // Pitch-Rotation: Steig-/Sinkwinkel aus VS/GS berechnen
            // smoothedVS in ft/min → ft/s (/60), smoothedGS in kts → ft/s (*1.6878)
            const _vsPitch = (typeof smoothedVS !== 'undefined') ? smoothedVS : 0;
            const _gsPitch = (typeof smoothedGS !== 'undefined' && smoothedGS > 20) ? smoothedGS : 80;
            const _pitchRad = Math.atan2(_vsPitch / 60, _gsPitch * 1.6878);
            fgCtx.rotate(_pitchRad);

            // Berechnung der Skalierung (Basisbreite Path: 504.91)
            const baseScale = planeSizePx / 504.91;

            // Im Profil schaut das Flugzeug immer nach rechts (Richtung Zukunft).
            // sx=1: Nase bei x=504 → rechts, Heck bei x=0 → links (korrekte Ausrichtung).
            // Kein Flip basierend auf Heading — das Profil hat immer Vergangenheit links.
            fgCtx.scale(baseScale, baseScale);

            fgCtx.fillStyle = planeColor;
            
            // Side-View Path (ViewBox 504.91 x 184.69, Zentrum: 252.45, 92.35)
            const sideViewPath = new Path2D("M504.83,54.71l-.57-2.37a1.12,1.12,0,0,0-.84-.84,1.14,1.14,0,0,0-1.13.35,108.13,108.13,0,0,0-7.76,9.95,42.45,42.45,0,0,0-6.15,11.54,20.33,20.33,0,0,0-2.53-.45c-1.13-2.15-6.44-3.5-15.36-3.92-12.18-.81-42.61-3.25-51.64-4a13.91,13.91,0,0,1-3.4-.72l-.53-.2a15,15,0,0,1-1.62-.77c-5.49-3.07-19.3-10.65-29.11-14.65-7.6-3.09-12.88-5.24-18.9-6.51l-.8-.16a71.07,71.07,0,0,0-12.43-1.21,161,161,0,0,0-20.61,1.63v-.86a1.45,1.45,0,0,0-1.62-1.43c-2.38.28-6.23,1.11-7.08,3.5L320,44c-2.6-2-6.49-2.07-8.85-1.92a2,2,0,0,0-1.88,2.22l.15,1.42c-13.69,1.51-38.55,6-65.14,11.22l-.07-1.22A4.24,4.24,0,0,0,243,52.92l-17-16.46a.46.46,0,0,0-.65,0,.47.47,0,0,0,0,.65l17,16.46a3.36,3.36,0,0,1,1,2.22l.07,1.35c-19.92,3.91-40.74,8.21-58.51,11.94l-.22-4a4.17,4.17,0,0,0-1.29-2.83l-17-16.46a.46.46,0,0,0-.64.66l17,16.46a3.3,3.3,0,0,1,1,2.22l.23,4.2c-15.46,3.25-28.52,6.07-36.53,7.8a18.29,18.29,0,0,1-17.05-5.25L73.68,12.1a9.11,9.11,0,0,0-5-2.7V5.7A.68.68,0,0,0,68,5H67V1.89A1.89,1.89,0,0,0,65.08,0a1.89,1.89,0,0,0-1.89,1.89V5H62.13a.68.68,0,0,0-.67.68v4.55L38.14,15.42a4.46,4.46,0,0,0-1.16.41,4.74,4.74,0,0,0-1,.69,1.66,1.66,0,0,0-.45.69h0L24,18.84a.46.46,0,0,0,.06.92h.07l11.35-1.61a1.58,1.58,0,0,0,.82,1l.07,0a4.28,4.28,0,0,1,2.17,2.37l26.85,72a24.81,24.81,0,0,0-2.32,5.77L0,110.9l1.15.32c.18,0,18.4,5,48.57,5.2h0l17.32-4.16a1.51,1.51,0,0,1,1.34.31c1.35,1.13,5.76,3.21,20.08,4.44l.41,0-1.62,2.45a2.43,2.43,0,0,0,3.49,3.29l6.64-5c7.72.7,16.8,1.57,26.24,2.47,15.52,1.48,31.57,3,42.88,4,18.77,1.55,54.16,4.95,61,5.6l-19.28,7.63,39.35.54,3.63,6.59a1.32,1.32,0,0,0,1.52.63l1.57-.47a1.31,1.31,0,0,0,.8-1.84l-2.4-4.84,13.36.19.8,2.92,9.31-2.57,36.25,2v4.57l5.11,3.2c-3.29.8-18.46,4.51-24.31,6.06-6.22,1.65-9.95,2.88-9.29,6.17.41,2.05,2.4,3.68,4.29,5,3.29,2.3,6.84,3.11,10.19,3.73s6.52,1.17,9.34,1.65l5.46.93a13.62,13.62,0,0,0,27,1.79c.42-.06.87-.13,1.33-.22a41.71,41.71,0,0,0,10.61-3.56l.16-.07c2.56-1.25,6.42-3.13,5.92-6.53-.69-4.67-5.09-7.72-8.63-10.16-5.13-3.55-14.6-4.94-18.2-5.36v-7.41c3.37-.32,39.35-3.77,51.17-5.41,12.27-1.71,32.66-6.86,37-9.86.82.14,5.58.81,9.48-1.56v3.31l1.82,1.81a.78.78,0,0,0,1.34-.55v-5.27l7.93-1.18v.82l-7.77,7.73,7.05,3.51a11.14,11.14,0,0,1-3.52,1.38c-1.71.33-18.72-.25-26-.51a2.13,2.13,0,0,0-1.82,3.35l5.63,8.07a5.22,5.22,0,0,0,3.56,2.17,53.38,53.38,0,0,1,9.85,2.13L430,151.4a36.46,36.46,0,0,0,9.37,2.64,13.18,13.18,0,0,0,24.92-.47c.83-.36,1.67-.76,2.51-1.19l.49-.25c2.2-1.11,5.52-2.79,4.68-5.72a11.89,11.89,0,0,0-3.26-4.68l-.33-.34a45.54,45.54,0,0,0-7.27-6.28,29.74,29.74,0,0,0-7.87-3.61,56.48,56.48,0,0,0-5.57-1.47l-1.82-9.58,1.25-.19c4.59-.7,9.32-1.42,13.94-2.31,1.52-.3,3.07-.54,4.58-.78s3-.48,4.51-.77l.18,0c2.9-.56,5.89-1.13,8.24-3.11a21.78,21.78,0,0,0,7.26-11.85,64.85,64.85,0,0,0,1.29-8.49,37.13,37.13,0,0,0,15.63-8.15,2.93,2.93,0,0,0,1-2.35,3,3,0,0,0-1.22-2.31,43,43,0,0,0-6.18-3.8l8.32-19.79A2.86,2.86,0,0,0,504.83,54.71ZM321.27,80.13a3.12,3.12,0,0,1-2.14,1.07l-24,1.61a3.13,3.13,0,0,1-3-1.78l-6.32-13.25a3.11,3.11,0,0,1,2.16-4.4l29.13-6.25A3.13,3.13,0,0,1,320.84,60L322,77.86A3.09,3.09,0,0,1,321.27,80.13Zm67.42-6.44-21.6-30c5.14,1.29,10.06,3.29,16.65,6h0c9.75,4,23.52,11.53,29,14.59.34.19.68.36,1,.52-3.91,5.23-13.17,9.1-18.45,11a5.69,5.69,0,0,1-1.91.33A5.83,5.83,0,0,1,388.69,73.69Zm4.68,3h0Zm-.35,0-.33,0Zm-.4,0-.27,0Zm-.35,0-.31-.07Zm-.38-.09-.27-.07Zm-.34-.09-.31-.1Zm-.38-.13-.25-.1Zm-.33-.13-.29-.14Zm-.35-.17-.24-.13Zm-.31-.17-.28-.18Zm-.33-.21a1.88,1.88,0,0,1-.23-.16A1.88,1.88,0,0,0,389.85,75.56Zm-.3-.21-.26-.21Zm-14-.4a5.12,5.12,0,0,1-4.27,2.83l-36.16,2.38a5.21,5.21,0,0,1-3.89-1.38A5.16,5.16,0,0,1,329.57,75l-.26-15.32a5.33,5.33,0,0,1,4.77-5.4l23.15-2.51a9.58,9.58,0,0,1,9.11,4.31l9,13.75A5.11,5.11,0,0,1,375.58,75Zm12.87-.67a3.17,3.17,0,0,1-.21-.27A3.17,3.17,0,0,0,388.45,74.28Zm.27.32-.21-.25Zm0,0,.24.24Zm.53.51-.23-.21Zm4.19,1.53h0Zm1.81-.28.25-.08Zm-1.55.27h0Zm.26,0h0Zm.26,0,.14,0Zm.26,0,.15,0Zm.26,0,.15,0Zm.25-.07.17,0Zm44.66,54.37-3.46-1.25,5.23-4.35,1.93,2.46Z");
            
            // Zentrierung: immer -252.45 (unabhaengig von Spiegelung)
            // Beweis: path-Center (252.45, 92.35) → translate(-252.45,-92.35) → (0,0) → scale → (0,0) → an liveX,liveY ✓
            fgCtx.translate(-252.45, -92.35);
            fgCtx.strokeStyle = '#000';
            fgCtx.lineWidth = 32;
            fgCtx.lineJoin = 'round';
            fgCtx.lineCap = 'round';
            fgCtx.stroke(sideViewPath);
            fgCtx.fill(sideViewPath);
            
            fgCtx.restore();
        }
    }

    // C: PREDICTION VECTORS im Vertikalprofil
    const _predAvail = window.vpPredictionData && window.vpPredictionData.length > 0 &&
        (isHdgMode || (typeof vpLiveGpsFraction === 'number' && vpLiveGpsFraction >= 0));
    if (_predAvail) {
        const baseDist = isHdgMode ? VP_HDG_LOOKBACK_MIN : vpLiveGpsFraction * totalDist;
        const baseX = xOf(baseDist);
        // Im HDG-Modus: Live-GPS-Hoehe verwenden (vpLiveAltFt kommt vom Route-Marker)
        const _predBaseAlt = isHdgMode ? (window.lastLiveGpsPos?.alt ?? vpLiveAltFt) : vpLiveAltFt;
        const baseY = yOf(_predBaseAlt);

        // Punkte filtern die noch innerhalb der Route liegen
        // Im HDG-Modus: distNMAhead in Minuten umrechnen
        const _gs4pred = (typeof smoothedGS !== 'undefined' && smoothedGS > 20) ? smoothedGS : 80;
        const ptOffset = (pt) => isHdgMode ? pt.min : pt.distNMAhead;
        const visiblePts = window.vpPredictionData.filter(pt => baseDist + ptOffset(pt) <= totalDist + 1);

        if (visiblePts.length > 0) {
            // Gestrichelte Linie vom Flugzeug durch alle Prediction-Punkte
            fgCtx.save();
            fgCtx.setLineDash([5, 4]);
            fgCtx.lineWidth = 1.5;
            fgCtx.beginPath();
            fgCtx.moveTo(baseX, baseY);

            for (const pt of visiblePts) {
                const px = xOf(baseDist + ptOffset(pt));
                const py = yOf(pt.altFt);
                fgCtx.lineTo(px, py);
            }
            fgCtx.strokeStyle = 'rgba(255,255,255,0.55)';
            fgCtx.stroke();
            fgCtx.setLineDash([]);

            // Zeitmarker + Labels
            for (const pt of visiblePts) {
                const px = xOf(baseDist + ptOffset(pt));
                const py = yOf(pt.altFt);

                // Culling: nur sichtbaren Bereich rendern
                if (px < viewMinX - 30 || px > viewMaxX + 30) continue;

                const tc = pt.threat === 'red' ? '#ff2222' : pt.threat === 'amber' ? '#ffaa00' : (pt.asColor || '#ffffff');

                // Kreis
                fgCtx.beginPath();
                fgCtx.arc(px, py, 3.5, 0, Math.PI * 2);
                fgCtx.fillStyle = tc;
                fgCtx.fill();
                fgCtx.strokeStyle = 'rgba(0,0,0,0.6)';
                fgCtx.lineWidth = 1;
                fgCtx.stroke();

                // Zeitlabel oben
                fgCtx.fillStyle = tc;
                fgCtx.font = 'bold 9px Arial';
                fgCtx.textAlign = 'center';
                fgCtx.fillText(pt.min + 'm', px, py - 8);

                // Höhe unten (nur wenn genug Platz)
                if (zoomFactor >= 1.5 || window.vpPredictionData.length <= 3) {
                    fgCtx.fillStyle = 'rgba(255,255,255,0.6)';
                    fgCtx.font = '8px Arial';
                    fgCtx.fillText(Math.round(pt.altFt) + 'ft', px, py + 14);
                }
            }
            fgCtx.restore();
        }
    }

    // Altitude-Waypoint-Diamanten nur im RTE-Modus (distNM = Route-NM, im HDG unbrauchbar)
    if (!isHdgMode && vpAltWaypoints.length > 0) {
        for (let i = 0; i < vpAltWaypoints.length; i++) {
            const wp = vpAltWaypoints[i], wx = xOf(wp.distNM), wy = yOf(wp.altFt);
            if (wx < viewMinX - 20 || wx > viewMaxX + 20) continue;

            fgCtx.beginPath(); fgCtx.setLineDash([2, 3]); fgCtx.strokeStyle = 'rgba(255,0,255,0.3)'; fgCtx.lineWidth = 1;
            fgCtx.moveTo(wx, wy); fgCtx.lineTo(wx, padTop + plotH); fgCtx.stroke(); fgCtx.setLineDash([]);
            fgCtx.beginPath(); fgCtx.moveTo(wx, wy - 7); fgCtx.lineTo(wx + 6, wy); fgCtx.lineTo(wx, wy + 7); fgCtx.lineTo(wx - 6, wy); fgCtx.closePath();
            fgCtx.fillStyle = '#ff00ff'; fgCtx.fill(); fgCtx.strokeStyle = '#fff'; fgCtx.lineWidth = 1; fgCtx.stroke();
            fgCtx.fillStyle = '#ff00ff'; fgCtx.font = 'bold 9px Arial'; fgCtx.textAlign = 'center'; fgCtx.fillText(wp.altFt + ' ft', wx, wy - 11);
        }
    }

    // D: TRAFFIC IM PROFIL
    vpDrawTrafficInProfile(fgCtx, xOf, yOf, elevData, isHdgMode, viewMinX, viewMaxX);

    // E: Vordergrund-Puls fuer den aktuell gewarnten Luftraum.
    // Zeichnet das bereits vorhandene Band nochmals im FG, damit der Blinkeffekt
    // auch bei statischem BG-Cache sichtbar bleibt.
    if (typeof vpHighlightPulseIdx !== 'undefined' && vpHighlightPulseIdx >= 0) {
        const phase = (typeof vpPulsePhase !== 'undefined') ? vpPulsePhase : 0;
        const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2));
        const cachedAirspaces = getCachedAirspaceIntersections(elevData, totalDist);
        const item = cachedAirspaces.find(it => it.asIdx === vpHighlightPulseIdx);
        if (item && item.as) {
            const { as, lowerFt, upperFt, isLowerAgl, isUpperAgl, relevantPts } = item;
            const style = getAirspaceStyle(as);

            fgCtx.save();
            fgCtx.fillStyle = vpHexToRgba(style.color, 0.14 + 0.24 * pulse);
            fgCtx.strokeStyle = vpHexToRgba(style.color, 0.65 + 0.30 * pulse);
            fgCtx.lineWidth = 2.2 + 1.8 * pulse;
            fgCtx.setLineDash([]);
            fgCtx.beginPath();

            if (!isLowerAgl && !isUpperAgl) {
                const x1 = xOf(item.asMinDist), x2 = xOf(item.asMaxDist);
                const ry1 = yOf(Math.min(upperFt, maxAlt));
                const ry2 = yOf(Math.max(lowerFt, minAlt));
                fgCtx.moveTo(x1, ry1);
                fgCtx.lineTo(x2, ry1);
                fgCtx.lineTo(x2, ry2);
                fgCtx.lineTo(x1, ry2);
            } else {
                for (let i = 0; i < relevantPts.length; i++) {
                    const p = relevantPts[i];
                    const realUpper = isUpperAgl ? p.elevFt + upperFt : upperFt;
                    const y = yOf(Math.min(realUpper, maxAlt));
                    if (i === 0) fgCtx.moveTo(xOf(p.distNM), y); else fgCtx.lineTo(xOf(p.distNM), y);
                }
                for (let i = relevantPts.length - 1; i >= 0; i--) {
                    const p = relevantPts[i];
                    const realLower = isLowerAgl ? p.elevFt + lowerFt : lowerFt;
                    fgCtx.lineTo(xOf(p.distNM), yOf(Math.max(realLower, minAlt)));
                }
            }

            fgCtx.closePath();
            fgCtx.fill();
            fgCtx.stroke();
            fgCtx.restore();
        }
    }

    // Top-Priorität: Landmarken (Apt/City) bewusst über dem Hindernis-Layer
    if (vpShowLandmarks) {
        const lmOverride = isHdgMode ? vpHdgLandmarks : null;
        vpDrawLandmarks(fgCtx, xOf, yOf, elevData, totalDist, true, zoomFactor, maxAlt, lmOverride);
    }

    fgCtx.restore();

    if (needsBgRender && window.vpProfilePerfWarn) {
        window.vpProfilePerfWarn('Profile map frame render', frameT0, {
            bg: true,
            elevPoints: Array.isArray(elevData) ? elevData.length : 0
        }, 120);
    }
    vpScheduleNextMapProfileFrame(frameIntervalMs, perfMeta.lastPaintMs);
}

// Removed arbitrary setTimeout hook in favor of synchronous hooks within renderVerticalProfile

/* =========================================================
   RESIZE HANDLE (Map / Profile split)
   ========================================================= */
let vpResizeActive = false;

function initProfileResize() {
    const handle = document.getElementById('profileResizeHandle');
    const strip = document.getElementById('mapProfileStrip');
    const maptable = document.querySelector('.maptable-content');
    if (!handle || !strip || !maptable) return;

    let startY = 0, startH = 0;

    function onStart(e) {
        window.activateFastRender();
        vpResizeActive = true;
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        startH = strip.offsetHeight;
        document.body.style.cursor = 'ns-resize';
        e.preventDefault();
    }

    function onMove(e) {
        if (!vpResizeActive) return;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const delta = startY - clientY; // pulling up = bigger profile
        let newH = startH + delta;
        const totalH = maptable.offsetHeight;
        const maxFraction = document.body.classList.contains('map-is-fullscreen') ? 0.75 : 0.6;
        newH = Math.max(60, Math.min(totalH * maxFraction, newH));
        strip.style.height = newH + 'px';

        if (typeof map !== 'undefined' && map) map.invalidateSize();
        renderMapProfile();
    }

    function onEnd() {
        if (!vpResizeActive) return;
        vpResizeActive = false;
        document.body.style.cursor = '';
    }

    handle.addEventListener('mousedown', onStart);
    handle.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);
}



/* =========================================================
   POSITION MARKER (Magenta triangle + Leaflet marker sync)
   ========================================================= */
let vpPositionFraction = -1; // -1 = hidden scrub marker
let vpLiveGpsFraction = -1;  // -1 = hidden live aircraft
let vpLiveAltFt = 0;
let vpLiveHdg = 0;
let vpPositionLeafletMarker = null;

function vpUpdatePosition(fraction) {
    vpPositionFraction = fraction;
    
    // Weckt nur die Foreground-Schleife, falls sie schläft.
    if (typeof vpMapProfileVisible !== 'undefined' && vpMapProfileVisible) vpRequestMapProfileFrameNow();

    // Update Leaflet marker on map
    if (!vpElevationData || vpElevationData.length < 2) return;
    const totalDist = vpElevationData[vpElevationData.length - 1].distNM;
    const targetDist = fraction * totalDist;

    // Find the interpolated lat/lon at this distance
    let lat, lon;
    for (let i = 0; i < vpElevationData.length - 1; i++) {
        if (vpElevationData[i + 1].distNM >= targetDist) {
            const segLen = vpElevationData[i + 1].distNM - vpElevationData[i].distNM;
            const f = segLen > 0 ? (targetDist - vpElevationData[i].distNM) / segLen : 0;
            lat = vpElevationData[i].lat + (vpElevationData[i + 1].lat - vpElevationData[i].lat) * f;
            lon = vpElevationData[i].lon + (vpElevationData[i + 1].lon - vpElevationData[i].lon) * f;
            break;
        }
    }
    if (!lat) { lat = vpElevationData[vpElevationData.length - 1].lat; lon = vpElevationData[vpElevationData.length - 1].lon; }

    if (typeof map !== 'undefined' && map && typeof L !== 'undefined') {
        if (!vpPositionLeafletMarker) {
            const magentaIcon = L.divIcon({
                className: 'vp-pos-marker',
                html: '<div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:14px solid #ff00ff;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.6));"></div>',
                iconSize: [16, 14],
                iconAnchor: [8, 14]
            });
            vpPositionLeafletMarker = L.marker([lat, lon], { icon: magentaIcon, interactive: false, zIndexOffset: 5000 });
            // Nur zur Map hinzufügen, wenn Profil sichtbar ist
            if (vpMapProfileVisible) vpPositionLeafletMarker.addTo(map);
        } else {
            vpPositionLeafletMarker.setLatLng([lat, lon]);
            // Sicherstellen, dass Sichtbarkeit synchron ist
            if (vpMapProfileVisible) {
                if (!map.hasLayer(vpPositionLeafletMarker)) vpPositionLeafletMarker.addTo(map);
            } else {
                if (map.hasLayer(vpPositionLeafletMarker)) map.removeLayer(vpPositionLeafletMarker);
            }
        }
    }
}

function vpUpdateLiveAircraft(fraction, altFt, hdg) {
    vpLiveGpsFraction = fraction;
    vpLiveAltFt = altFt;
    vpLiveHdg = hdg;

    if (typeof vpMapProfileVisible !== 'undefined' && vpMapProfileVisible) vpRequestMapProfileFrameNow();
}

/* =========================================================
   ALTITUDE WAYPOINTS (Click to set, drag to move)
   ========================================================= */
let vpAltWaypoints = []; // [{distNM, altFt}] - fixed anchor points
let vpSegmentAlts = [];  // vpSegmentAlts[i] = cruise altitude between vpAltWaypoints[i] and [i+1]
let vpDraggingWP = -1;
let vpDraggingSegment = null; // { segIndex, origAlt }
let vpCanvasClickHandler = null;

function getExactAltAtDist(distNM, profObj, fallbackAlt) {
    if (!profObj || !profObj.profile || profObj.profile.length === 0) return fallbackAlt;
    const prof = profObj.profile;
    if (distNM <= prof[0].distNM) return prof[0].altFt;
    if (distNM >= prof[prof.length - 1].distNM) return prof[prof.length - 1].altFt;
    for (let j = 0; j < prof.length - 1; j++) {
        if (distNM >= prof[j].distNM && distNM <= prof[j + 1].distNM) {
            const f = (distNM - prof[j].distNM) / (prof[j + 1].distNM - prof[j].distNM || 1);
            return prof[j].altFt + f * (prof[j + 1].altFt - prof[j].altFt);
        }
    }
    return fallbackAlt;
}

function initAltWaypoints() {
    const canvas = document.getElementById('mapProfileCanvas');
    if (!canvas || vpCanvasClickHandler) return;

    vpCanvasClickHandler = true;

    // === SHARED HELPERS for mouse & touch ===
    function vpGetCanvasMetrics() {
        const elevData = (vpZoomLevel < 100 && vpHighResData) ? vpHighResData : vpElevationData;
        if (!elevData || elevData.length < 2) return null;
        const rect = canvas.getBoundingClientRect();
        const scrollContainer = document.getElementById('mapProfileScroll');
        const viewX = scrollContainer ? scrollContainer.scrollLeft : 0;
        const containerHeight = scrollContainer?.clientHeight || 100;
        const baseWidth = scrollContainer?.clientWidth || 600;
        const zoomFactor = 100 / vpZoomLevel;
        const virtualWidth = Math.round(baseWidth * zoomFactor);
        const totalDist = elevData[elevData.length - 1].distNM;

        const cruiseAlt = parseInt(document.getElementById('altMapInput')?.textContent || document.getElementById('altSlider')?.value || 4500);
        const maxTerrain = Math.max(...elevData.map(p => p.elevFt));
        let autoMaxAlt = Math.max(cruiseAlt + 2500, maxTerrain + 1000);
        const maxAlt = vpMaxAltOverride > 0 ? vpMaxAltOverride : autoMaxAlt;
        const padLeft = 33, padRight = 16, padTop = 12, padBottom = 22;
        const plotW = virtualWidth - padLeft - padRight;
        const plotH = containerHeight - padTop - padBottom;
        
        return { elevData, rect, viewX, containerHeight, baseWidth, virtualWidth, zoomFactor, totalDist, cruiseAlt, maxTerrain, maxAlt, padLeft, padRight, padTop, padBottom, plotW, plotH };
    }

    function vpClientToCanvas(clientX, clientY, m) {
        // FIX: Koordinaten 1:1 in CSS-Pixeln berechnen
        const cssX = clientX - m.rect.left;
        const cssY = clientY - m.rect.top;
        return { mx: cssX + m.viewX, my: cssY };
    }

    function vpHitTestWaypoint(mx, my, m) {
        for (let i = 0; i < vpAltWaypoints.length; i++) {
            const wp = vpAltWaypoints[i];
            const wpx = m.padLeft + (wp.distNM / m.totalDist) * m.plotW;
            const wpy = m.padTop + m.plotH - (wp.altFt / m.maxAlt) * m.plotH;
            if (Math.abs(mx - wpx) < 26 && Math.abs(my - wpy) < 26) return i;
        }
        return -1;
    }

    function vpHitTestFlightLine(mx, my, m) {
        const mouseDistNM = ((mx - m.padLeft) / m.plotW) * m.totalDist;
        if (mouseDistNM < 0 || mouseDistNM > m.totalDist) return null;
        const tas = parseInt(document.getElementById('tasSlider')?.value || 115);
        const profObj = typeof computeFlightProfile === 'function' ? computeFlightProfile(m.elevData, m.cruiseAlt, vpClimbRate, vpDescentRate, tas) : null;
        const altAtMouse = getExactAltAtDist(mouseDistNM, profObj, m.cruiseAlt);
        const lineY = m.padTop + m.plotH - (altAtMouse / m.maxAlt) * m.plotH;
        if (Math.abs(my - lineY) < 32) return mouseDistNM;
        return null;
    }

    function vpHitTestMagenta(mx, m) {
        if (typeof vpPositionFraction !== 'number' || vpPositionFraction < 0) return false;
        const posX = m.padLeft + (vpPositionFraction * m.totalDist / m.totalDist) * m.plotW;
        return Math.abs(mx - posX) < 18;
    }

    function vpFindSegmentIdx(mouseDistNM) {
        let segIdx = -1;
        if (vpAltWaypoints.length === 0) {
            segIdx = -1;
        } else if (vpAltWaypoints.length === 1) {
            segIdx = -2;
        } else {
            if (mouseDistNM <= vpAltWaypoints[0].distNM) {
                segIdx = -3;
            } else if (mouseDistNM >= vpAltWaypoints[vpAltWaypoints.length - 1].distNM) {
                segIdx = -4;
            } else {
                for (let k = 0; k < vpAltWaypoints.length - 1; k++) {
                    if (mouseDistNM >= vpAltWaypoints[k].distNM && mouseDistNM <= vpAltWaypoints[k + 1].distNM) {
                        segIdx = k; break;
                    }
                }
            }
        }
        return segIdx;
    }

    function vpRemoveWaypoint(clickDistNM, totalDist) {
        if (vpAltWaypoints.length === 0) return false;
        let nearestIdx = -1, nearestDist = Infinity;
        for (let i = 0; i < vpAltWaypoints.length; i++) {
            const d = Math.abs(vpAltWaypoints[i].distNM - clickDistNM);
            if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
        }
        if (nearestIdx >= 0 && nearestDist < totalDist * 0.05) {
            vpAltWaypoints.splice(nearestIdx, 1);
            if (vpSegmentAlts.length > 0) {
                if (nearestIdx > 0 && nearestIdx < vpSegmentAlts.length) {
                    const merged = Math.round((vpSegmentAlts[nearestIdx - 1] + vpSegmentAlts[nearestIdx]) / 2);
                    vpSegmentAlts.splice(nearestIdx - 1, 2, merged);
                } else if (nearestIdx < vpSegmentAlts.length) {
                    vpSegmentAlts.splice(nearestIdx, 1);
                } else if (vpSegmentAlts.length > 0) {
                    vpSegmentAlts.splice(vpSegmentAlts.length - 1, 1);
                }
            }
            if (vpAltWaypoints.length < 2) vpSegmentAlts = [];
            renderMapProfile(); // Zeichnet sofort!
            
            // FIX: Schwere DOM/Luftraum-Berechnungen asynchron ausführen, damit der Klick nicht einfriert!
            setTimeout(() => {
                if (typeof renderAirspaceWarningsList === 'function') renderAirspaceWarningsList();
            }, 50);
            return true;
        }
        return false;
    }

    function vpAddWaypoint(clickDistNM, exactAlt, cruiseAlt, totalDist) {
        if (clickDistNM < 0 || clickDistNM > totalDist) return;
        for (const wp of vpAltWaypoints) {
            if (Math.abs(wp.distNM - clickDistNM) < totalDist * 0.03) return;
        }
        let insertIdx = vpAltWaypoints.length;
        for (let k = 0; k < vpAltWaypoints.length; k++) {
            if (clickDistNM < vpAltWaypoints[k].distNM) { insertIdx = k; break; }
        }
        vpAltWaypoints.splice(insertIdx, 0, { distNM: clickDistNM, altFt: exactAlt });
        if (vpSegmentAlts.length > 0 && insertIdx < vpSegmentAlts.length) {
            vpSegmentAlts.splice(insertIdx, 1, exactAlt, exactAlt);
        } else if (vpSegmentAlts.length > 0 && insertIdx >= vpSegmentAlts.length) {
            vpSegmentAlts.push(exactAlt);
        } else if (vpAltWaypoints.length >= 2 && vpSegmentAlts.length === 0) {
            vpSegmentAlts = [];
            for (let k = 0; k < vpAltWaypoints.length - 1; k++) {
                vpSegmentAlts.push(exactAlt);
            }
        }
        renderMapProfile(); // Zeichnet sofort!
        
        // FIX: Entkoppeln, um Ruckler zu vermeiden!
        setTimeout(() => {
            if (typeof renderAirspaceWarningsList === 'function') renderAirspaceWarningsList();
        }, 50);
    }

    function vpHandleDoubleHit(mx, my, m) {
        // 1. Try removing existing waypoint
        const wpIdx = vpHitTestWaypoint(mx, my, m);
        if (wpIdx >= 0) {
            const wp = vpAltWaypoints[wpIdx];
            vpRemoveWaypoint(wp.distNM, m.totalDist);
            return true;
        }
        // 2. Try adding new waypoint on flight line
        const clickDistNM = vpHitTestFlightLine(mx, my, m);
        if (clickDistNM !== null) {
            const tas = parseInt(document.getElementById('tasSlider')?.value || 115);
            const profObj = typeof computeFlightProfile === 'function' ? computeFlightProfile(m.elevData, m.cruiseAlt, vpClimbRate, vpDescentRate, tas) : null;
            let exactAlt = getExactAltAtDist(clickDistNM, profObj, m.cruiseAlt);
            exactAlt = Math.round(exactAlt / 100) * 100;
            vpAddWaypoint(clickDistNM, exactAlt, m.cruiseAlt, m.totalDist);
            return true;
        }
        return false;
    }

    function vpHandleDragMove(clientX, clientY, dragStartX, dragStartY, dragOrigWP) {
        const m = vpGetCanvasMetrics();
        if (!m) return;
        const deltaY = dragStartY - clientY;
        const altChange = (deltaY / m.plotH) * m.maxAlt;
        if (vpDraggingWP >= 0) {
            const deltaX = clientX - dragStartX;
            const distChange = (deltaX / m.plotW) * m.totalDist;
            let newDist = dragOrigWP.distNM + distChange;
            newDist = Math.max(0, Math.min(m.totalDist, newDist));
            let newAlt = Math.round((dragOrigWP.altFt + altChange) / 100) * 100;
            newAlt = Math.max(0, Math.min(m.maxAlt, newAlt));
            vpAltWaypoints[vpDraggingWP].distNM = newDist;
            vpAltWaypoints[vpDraggingWP].altFt = newAlt;
        } else if (vpDraggingSegment) {
            const seg = vpDraggingSegment;
            const newAlt = Math.max(0, Math.round((seg.origAlt + altChange) / 100) * 100);
            
            if (seg.segIdx >= 0 && seg.segIdx < vpSegmentAlts.length) {
                vpSegmentAlts[seg.segIdx] = newAlt;
            } else if (seg.segIdx === -1) {
                const newGlobalAlt = Math.max(1500, Math.min(13500, newAlt));
                const altMap = document.getElementById('altMapInput');
                if (altMap && altMap.textContent != newGlobalAlt) {
                    altMap.textContent = newGlobalAlt;
                }
            } else if (seg.segIdx === -2 || seg.segIdx === -3) {
                if (vpAltWaypoints.length > 0) vpAltWaypoints[0].altFt = newAlt;
            } else if (seg.segIdx === -4) {
                if (vpAltWaypoints.length > 0) vpAltWaypoints[vpAltWaypoints.length - 1].altFt = newAlt;
            }
        } else if (window.vpDraggingPosMarker) {
            const { mx } = vpClientToCanvas(clientX, clientY, m);
            let frac = (mx - m.padLeft) / m.plotW;
            frac = Math.max(0, Math.min(1, frac));
            vpUpdatePosition(frac);
        }
    }

    function vpHandleDragEnd() {
        if (vpDraggingWP >= 0 || vpDraggingSegment || window.vpDraggingPosMarker) {
            const needsSave = vpDraggingWP >= 0 || !!vpDraggingSegment;

            // Bei globaler Höhenänderung einmalig am Ende synchronisieren
            if (vpDraggingSegment && vpDraggingSegment.segIdx === -1) {
                const finalAlt = parseInt(document.getElementById('altMapInput').textContent) || 4500;
                syncAltFromInput(finalAlt);
            }
            if (vpDraggingWP >= 0) vpAltWaypoints.sort((a, b) => a.distNM - b.distNM);

            vpDraggingWP = -1;
            vpDraggingSegment = null;
            window.vpDraggingPosMarker = false;
            dragOrigWP = null;

            // 1. Priorität: Vordergrund (Rote Linie) sofort einrasten lassen
            renderMapProfile(); 
            
            // 2. Priorität: UI-Logik (Mini-Profil) und Background-Schatten sanft nachladen (150ms)
            setTimeout(() => {
                if (typeof renderVerticalProfile === 'function') renderVerticalProfile('verticalProfileCanvas');
                window.vpBgNeedsUpdate = true; // Stellt die Wolkenschatten nach dem Drag wieder her
            }, 150);

            // 3. Priorität: Schwere Daten-Logik (Lufträume & JSON-Speichern) ins Backend schieben (300ms)
            setTimeout(() => {
                if (typeof renderAirspaceWarningsList === 'function') renderAirspaceWarningsList(); 
                if (needsSave) window.debouncedSaveMissionState();
            }, 300);
        }
    }

    // === STATE ===
    let vpWasDragging = false;
    window.vpDraggingPosMarker = false;
    let dragStartY = 0, dragStartX = 0, dragOrigWP = null;
    let lastTapTime = 0;
    let vpIsPanning = false;
    let vpPanStartScrollLeft = 0;
    let vpPanStartX = 0;
    let initialPinchDist = null;
    let initialTwoFingerY = null;

    // === DOUBLE CLICK: remove/add waypoint ===
    canvas.addEventListener('dblclick', (e) => {
        if (typeof vpMode !== 'undefined' && vpMode === 'HDG') return; // Nur im RTE-Modus
        const m = vpGetCanvasMetrics();
        if (!m) return;
        const { mx, my } = vpClientToCanvas(e.clientX, e.clientY, m);
        if (vpHandleDoubleHit(mx, my, m)) window.debouncedSaveMissionState();
    });

    // === CLICK: no more single-click creation ===
    canvas.addEventListener('click', (e) => {
        // Logic removed to prevent accidental creation on iPhone
    });

    // === HOVER CURSOR ===
    canvas.addEventListener('mousemove', (e) => {
        if (vpDraggingWP >= 0 || vpDraggingSegment || window.vpDraggingPosMarker) return;
        const m = vpGetCanvasMetrics();
        if (!m) return;
        const { mx, my } = vpClientToCanvas(e.clientX, e.clientY, m);
        let cursor = 'default';
        if (vpHitTestMagenta(mx, m)) cursor = 'ew-resize';
        else if (vpHitTestWaypoint(mx, my, m) >= 0) cursor = 'move';
        else if ((typeof vpMode === 'undefined' || vpMode !== 'HDG') && vpHitTestFlightLine(mx, my, m) !== null) cursor = 'ns-resize';
        canvas.style.cursor = cursor;
    });

    // === MOUSEDOWN: start drag ===
    canvas.addEventListener('mousedown', (e) => {
        vpWasDragging = false;
        const m = vpGetCanvasMetrics();
        if (!m) return;
        const { mx, my } = vpClientToCanvas(e.clientX, e.clientY, m);
        dragStartX = e.clientX;
        dragStartY = e.clientY;

        // Priority 1: Magenta marker drag (nur im RTE-Modus)
        const _isHdgNow = (typeof vpMode !== 'undefined' && vpMode === 'HDG');
        if (!_isHdgNow && vpHitTestMagenta(mx, m)) {
            window.vpDraggingPosMarker = true;
            e.preventDefault(); e.stopPropagation();
            return;
        }
        // Priority 2: Waypoint drag
        const wpIdx = vpHitTestWaypoint(mx, my, m);
        if (wpIdx >= 0) {
            vpDraggingWP = wpIdx;
            dragOrigWP = { ...vpAltWaypoints[wpIdx] };
            e.preventDefault(); e.stopPropagation();
            return;
        }
        // Priority 3: Flight line segment drag (nur im ROUTE-Modus)
        if (typeof vpMode !== 'undefined' && vpMode === 'HDG') return; // Keine Höhenlinien-Interaktion im HDG-Modus
        const mouseDistNM = vpHitTestFlightLine(mx, my, m);
        if (mouseDistNM !== null) {
            e.preventDefault(); e.stopPropagation();
            const segIdx = vpFindSegmentIdx(mouseDistNM);
            
            // FIX: Exakte, physikalische Höhe an der angeklickten Stelle berechnen
            const tas = parseInt(document.getElementById('tasSlider')?.value || 115);
            const profObj = typeof computeFlightProfile === 'function' ? computeFlightProfile(m.elevData, m.cruiseAlt, vpClimbRate, vpDescentRate, tas) : null;
            let exactAltAtClick = typeof getExactAltAtDist === 'function' ? getExactAltAtDist(mouseDistNM, profObj, m.cruiseAlt) : m.cruiseAlt;
            exactAltAtClick = Math.round(exactAltAtClick / 100) * 100;
            
            vpDraggingSegment = { segIdx, origAlt: exactAltAtClick, origCruiseAlt: m.cruiseAlt };
            return;
        }
    });

    // === MOUSEMOVE: drag ===
    document.addEventListener('mousemove', (e) => {
        if (vpDraggingWP < 0 && !vpDraggingSegment && !window.vpDraggingPosMarker) return;
        if (Math.abs(e.clientX - dragStartX) > 2 || Math.abs(e.clientY - dragStartY) > 2) vpWasDragging = true;
        vpHandleDragMove(e.clientX, e.clientY, dragStartX, dragStartY, dragOrigWP);
    });

    // === MOUSEUP: end drag ===
    document.addEventListener('mouseup', () => vpHandleDragEnd());

    // === TOUCH EVENTS ===
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            initialPinchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            initialTwoFingerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            return;
        }

        const touch = e.touches[0];
        vpWasDragging = false;
        vpIsPanning = false;
        window.vpProfilePanActive = false;
        const m = vpGetCanvasMetrics();
        if (!m) return;
        const { mx, my } = vpClientToCanvas(touch.clientX, touch.clientY, m);
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;

        const now = Date.now();
        if (now - lastTapTime < 300) {
            e.preventDefault();
            if (typeof vpMode === 'undefined' || vpMode !== 'HDG') { // Nur im RTE-Modus
                if (vpHandleDoubleHit(mx, my, m)) window.debouncedSaveMissionState();
            }
            lastTapTime = 0;
            return;
        }
        lastTapTime = now;

        const _isHdgNow2 = (typeof vpMode !== 'undefined' && vpMode === 'HDG');
        if (!_isHdgNow2 && vpHitTestMagenta(mx, m)) {
            e.preventDefault();
            window.vpDraggingPosMarker = true;
            return;
        }
        const wpIdx = vpHitTestWaypoint(mx, my, m);
        if (wpIdx >= 0) {
            e.preventDefault();
            vpDraggingWP = wpIdx;
            dragOrigWP = { ...vpAltWaypoints[wpIdx] };
            return;
        }
        if (typeof vpMode !== 'undefined' && vpMode === 'HDG') return; // Keine Höhenlinien-Interaktion im HDG-Modus
        const mouseDistNM = vpHitTestFlightLine(mx, my, m);
        if (mouseDistNM !== null) {
            e.preventDefault();
            const segIdx = vpFindSegmentIdx(mouseDistNM);
            const origSegAlt = (segIdx >= 0 && segIdx < vpSegmentAlts.length) ? vpSegmentAlts[segIdx] : m.cruiseAlt;
            vpDraggingSegment = { segIdx, origAlt: origSegAlt, origCruiseAlt: m.cruiseAlt };
            return;
        }
        if (vpZoomLevel < 100) {
            e.preventDefault();
            vpIsPanning = true;
            window.vpProfilePanActive = true;
            const scrollContainer = document.getElementById('mapProfileScroll');
            vpPanStartScrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
            vpPanStartX = touch.clientX;
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialPinchDist !== null && initialTwoFingerY !== null) {
            e.preventDefault();
            
            // X-Achse: Pinch-to-Zoom
            const currentDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const distDiff = currentDist - initialPinchDist;
            if (Math.abs(distDiff) > 10) {
                let zoomDelta = distDiff > 0 ? -3 : 3; 
                vpZoom(zoomDelta);
                initialPinchDist = currentDist;
            }

            // Y-Achse: Zwei-Finger vertikaler Wisch (Direct Manipulation des Bodens)
            const currentTwoFingerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const yDiff = currentTwoFingerY - initialTwoFingerY;
            if (Math.abs(yDiff) > 15) {
                // Wischen nach UNTEN (yDiff > 0): User drückt Boden weg -> Stauchen (MaxAlt wird GRÖSSER)
                // Wischen nach OBEN (yDiff < 0): User zieht Boden her -> Dehnen (MaxAlt wird KLEINER)
                let yDelta = yDiff > 0 ? 1000 : -1000; 
                vpChangeYAxis(yDelta);
                initialTwoFingerY = currentTwoFingerY;
            }
            return;
        }

        if (vpIsPanning) {
            e.preventDefault();
            const touch = e.touches[0];
            const deltaX = vpPanStartX - touch.clientX;
            const scrollContainer = document.getElementById('mapProfileScroll');
            if (scrollContainer) scrollContainer.scrollLeft = vpPanStartScrollLeft + deltaX;
            return;
        }
        if (vpDraggingWP < 0 && !vpDraggingSegment && !window.vpDraggingPosMarker) return;
        e.preventDefault();
        const touch = e.touches[0];
        if (Math.abs(touch.clientX - dragStartX) > 3 || Math.abs(touch.clientY - dragStartY) > 3) vpWasDragging = true;
        vpHandleDragMove(touch.clientX, touch.clientY, dragStartX, dragStartY, dragOrigWP);
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) { initialPinchDist = null; initialTwoFingerY = null; }
        if (vpIsPanning) {
            vpIsPanning = false;
            window.vpProfilePanActive = false;
            return;
        }
        window.vpProfilePanActive = false;
        if (vpDraggingWP >= 0 || vpDraggingSegment || window.vpDraggingPosMarker) vpHandleDragEnd();
    });

    canvas.addEventListener('touchcancel', (e) => {
        initialPinchDist = null; initialTwoFingerY = null;
        vpIsPanning = false; vpWasDragging = false;
        window.vpProfilePanActive = false;
        if (vpDraggingWP >= 0 || vpDraggingSegment || window.vpDraggingPosMarker) vpHandleDragEnd();
    });

    // === MOUSE WHEEL ZOOM & PAN (Multi-Achsen) ===
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (typeof window.activateFastRender === 'function') window.activateFastRender();
        if (e.ctrlKey) {
            let yDelta = e.deltaY > 0 ? 1000 : -1000;
            vpChangeYAxis(yDelta);
        } else if (e.shiftKey) {
            // FIX: OS wandelt Shift+Scroll oft in deltaX um!
            let wheelDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            let zoomDelta = wheelDelta > 0 ? 5 : -5;
            vpZoom(zoomDelta);
        } else {
            const scrollContainer = document.getElementById('mapProfileScroll');
            if (scrollContainer) {
                const panDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
                scrollContainer.scrollLeft += panDelta;
            }
        }
    }, { passive: false });
}

// Override computeFlightProfile to use altitude waypoints + segment altitudes
const _origComputeProfile = computeFlightProfile;
computeFlightProfile = function (elevationData, cruiseAltFt, climbRateFpm, descentRateFpm, tasKts) {
    if (!elevationData || elevationData.length < 2) return null;
    if (vpAltWaypoints.length === 0) return _origComputeProfile(elevationData, cruiseAltFt, climbRateFpm, descentRateFpm, tasKts);

    tasKts = tasKts || parseInt(document.getElementById('tasSlider')?.value || 115);
    climbRateFpm = climbRateFpm || 500;
    descentRateFpm = descentRateFpm || 500;

    const totalDistNM = elevationData[elevationData.length - 1].distNM;
    const depElevFt = elevationData[0].elevFt;
    let destElevFt = elevationData[elevationData.length - 1].elevFt;
    const wps = vpAltWaypoints;

    // Ensure vpSegmentAlts has the right length
    while (vpSegmentAlts.length < wps.length - 1) {
        vpSegmentAlts.push(cruiseAltFt);
    }
    while (vpSegmentAlts.length > Math.max(0, wps.length - 1)) {
        vpSegmentAlts.pop();
    }

    const profile = [];

    // Climb: from departure to first WP altitude
    const firstWpAlt = wps[0].altFt;
    const climbFt = Math.max(0, firstWpAlt - depElevFt);
    const climbDistNM = Math.max(0.5, (climbFt / climbRateFpm / 60) * tasKts * 0.85);
    const tocDistNM = Math.min(climbDistNM, wps[0].distNM);

    // Descent: from last WP altitude to destination
    const lastWpAlt = wps[wps.length - 1].altFt;
    const descentFt = Math.max(0, lastWpAlt - destElevFt);
    const descentDistNM = Math.max(0.5, (descentFt / descentRateFpm / 60) * tasKts * 0.9);
    const todDistNM = Math.max(totalDistNM - descentDistNM, wps[wps.length - 1].distNM);

    for (const pt of elevationData) {
        const d = pt.distNM;
        let altFt = cruiseAltFt;

        if (d <= wps[0].distNM) {
            // CLIMB ZONE: departure → first WP
            if (d < tocDistNM) {
                const f = tocDistNM > 0 ? d / tocDistNM : 1;
                altFt = depElevFt + f * (firstWpAlt - depElevFt);
            } else {
                altFt = firstWpAlt;
            }
        } else if (d >= wps[wps.length - 1].distNM) {
            // DESCENT ZONE: last WP → destination
            if (d > todDistNM) {
                const rem = totalDistNM - todDistNM;
                const f = rem > 0 ? (d - todDistNM) / rem : 1;
                altFt = lastWpAlt - f * (lastWpAlt - destElevFt);
            } else {
                altFt = lastWpAlt;
            }
        } else if (wps.length === 1) {
            // Only 1 WP — hold at that altitude
            altFt = wps[0].altFt;
        } else {
            // MIDDLE: between two consecutive waypoints
            for (let i = 0; i < wps.length - 1; i++) {
                if (d >= wps[i].distNM && d <= wps[i + 1].distNM) {
                    const segAlt = vpSegmentAlts[i] !== undefined ? vpSegmentAlts[i] : Math.max(wps[i].altFt, wps[i + 1].altFt);
                    const segDist = wps[i + 1].distNM - wps[i].distNM;
                    const transitionDist = Math.min(segDist * 0.15, 3); // 15% of segment or max 3nm

                    const distFromLeft = d - wps[i].distNM;
                    const distFromRight = wps[i + 1].distNM - d;

                    if (distFromLeft < transitionDist && wps[i].altFt !== segAlt) {
                        // Transition from WP[i].alt to segAlt
                        const f = transitionDist > 0 ? distFromLeft / transitionDist : 1;
                        altFt = wps[i].altFt + f * (segAlt - wps[i].altFt);
                    } else if (distFromRight < transitionDist && wps[i + 1].altFt !== segAlt) {
                        // Transition from segAlt to WP[i+1].alt
                        const f = transitionDist > 0 ? distFromRight / transitionDist : 1;
                        altFt = wps[i + 1].altFt + f * (segAlt - wps[i + 1].altFt);
                    } else {
                        altFt = segAlt;
                    }
                    break;
                }
            }
        }

        profile.push({ distNM: pt.distNM, altFt: Math.round(altFt) });
    }

    return { profile, tocDistNM, todDistNM };
};

// Init altitude waypoints when map table canvas is ready

setTimeout(() => initAltWaypoints(), 2000);
// === VERTICAL PROFILE CONTROLS (V49) ===
let vpMaxAltOverride = 0; // 0 = Auto-Scaling
let vpShowClouds = localStorage.getItem('ga_show_clouds') !== 'false'; // Default: true
let vpWeatherSource = localStorage.getItem('ga_weather_source') === 'openmeteo' ? 'openmeteo' : 'metar';
window.vpWeatherSource = vpWeatherSource;
const _storedWeatherRenderMode = localStorage.getItem('ga_weather_render_mode');
let vpWeatherRenderMode = (_storedWeatherRenderMode === 'abstrakt' || _storedWeatherRenderMode === 'pro') ? 'abstrakt' : 'classic';
let vpShowIsobars = localStorage.getItem('ga_show_isobars') !== 'false';
let vpShowWindComponents = localStorage.getItem('ga_show_wind_components') !== 'false';
let vpWeatherRefreshTimer = null;
let vpWeatherLastAutoRefreshAt = 0;
let vpShowLandmarks = localStorage.getItem('ga_show_landmarks') !== 'false';
let vpShowObstacles = localStorage.getItem('ga_show_obstacles') !== 'false';
const _legacyShowLinear = localStorage.getItem('ga_show_linear');
let vpShowRoads = (localStorage.getItem('ga_show_roads') ?? _legacyShowLinear ?? 'true') !== 'false';
let vpShowRivers = (localStorage.getItem('ga_show_rivers') ?? _legacyShowLinear ?? 'true') !== 'false';
let vpShowPowerInfra = (localStorage.getItem('ga_show_power') ?? _legacyShowLinear ?? 'true') !== 'false';
let vpShowLinear = (vpShowRoads || vpShowRivers || vpShowPowerInfra);
let vpAirspaceMode = parseInt(localStorage.getItem('ga_show_airspaces') || '1'); // 0=Off, 1=Bg, 2=Fg

function vpSyncLinearMasterFlag() {
    vpShowLinear = !!(vpShowRoads || vpShowRivers || vpShowPowerInfra);
}

function vpToggleStatusText(on) {
    return on ? 'An' : 'Aus';
}

function updateVpToggleBtn(id, on, label) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.classList.toggle('active', !!on);
    btn.textContent = `${label} (${vpToggleStatusText(on)})`;
}

function updateLinearButtons() {
    updateVpToggleBtn('btnToggleRoads', vpShowRoads, '🛣️ Straßen');
    updateVpToggleBtn('btnToggleRivers', vpShowRivers, '🌊 Flüsse');
    updateVpToggleBtn('btnTogglePower', vpShowPowerInfra, '⚡ Strom');
    const blin = document.getElementById('btnToggleLinear');
    if (blin) blin.classList.toggle('active', vpShowLinear);
}

function vpSetLinearLoadingPulse(on) {
    const ids = ['btnToggleLinear', 'btnToggleRoads', 'btnToggleRivers', 'btnTogglePower'];
    for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (on) el.classList.add('vp-loading-pulse');
        else el.classList.remove('vp-loading-pulse');
    }
}

function updateAirspaceBtn() {
    const btn = document.getElementById('btnToggleAirspaces');
    if (!btn) return;
    btn.classList.toggle('active', vpAirspaceMode !== 0);
    if (vpAirspaceMode === 1) btn.textContent = '🛡️ Lufträume (An · BG)';
    else if (vpAirspaceMode === 2) btn.textContent = '🛡️ Lufträume (An · FG)';
    else btn.textContent = '🛡️ Lufträume (Aus)';
}

function updateWeatherSourceBtn() {
    const btn = document.getElementById('btnToggleWeatherSource');
    if (!btn) return;
    const isOpenMeteo = vpWeatherSource === 'openmeteo';
    btn.classList.toggle('active', isOpenMeteo);
    btn.textContent = `🌐 Quelle: ${isOpenMeteo ? 'OPEN METEO' : 'METAR'}`;
    btn.title = isOpenMeteo
        ? 'Aktuell: Open-Meteo (nochmal klicken = METAR)'
        : 'Aktuell: METAR (nochmal klicken = Open-Meteo)';
}

function updateIsobarsBtn() {
    const btn = document.getElementById('btnToggleIsobars');
    if (!btn) return;
    btn.classList.toggle('active', vpShowIsobars);
    btn.textContent = `🧭 Isobaren (${vpShowIsobars ? 'An' : 'Aus'})`;
}

function updateWindComponentsBtn() {
    const btn = document.getElementById('btnToggleWindComponents');
    if (!btn) return;
    btn.classList.toggle('active', vpShowWindComponents);
    btn.textContent = `💨 Windkomponenten (${vpShowWindComponents ? 'An' : 'Aus'})`;
}

function updateCloudsBtn() {
    updateVpToggleBtn('btnToggleClouds', vpShowClouds, '⛅ Wolken');
}

function updateLandmarksBtn() {
    updateVpToggleBtn('btnToggleLandmarks', vpShowLandmarks, '🏙️ Städte');
}

function updateObstaclesBtn() {
    updateVpToggleBtn('btnToggleObstacles', vpShowObstacles, '🗼 Hindernisse');
}

function updateTrafficProfileBtn() {
    updateVpToggleBtn('btnToggleTrafficProfile', !!window.vpTrafficProfileVisible, '📡 Traffic');
}

function ensureWeatherRefreshTimer() {
    if (vpWeatherRefreshTimer) clearInterval(vpWeatherRefreshTimer);
    vpWeatherRefreshTimer = setInterval(() => {
        const now = Date.now();
        if (routeWaypoints && routeWaypoints.length >= 2) {
            if (typeof window.gaShouldPauseNetwork === 'function' && window.gaShouldPauseNetwork('profile-weather')) {
                window.gaRunWhenAwake?.('profile-weather', () => {
                    if (typeof triggerVerticalProfileUpdate === 'function') triggerVerticalProfileUpdate();
                    if (typeof window.scheduleMapWeatherOverlayUpdate === 'function') window.scheduleMapWeatherOverlayUpdate(true);
                });
                return;
            }
            const profileWeatherNeeded = (vpShowClouds || vpShowIsobars || vpShowWindComponents);
            const mapWeatherNeeded = !!(window.mapHints && window.mapHints.weather !== false);
            const mapWeatherSource = String(window.vpMapWeatherSource || localStorage.getItem('ga_map_weather_source') || 'metar').toLowerCase() === 'openmeteo' ? 'openmeteo' : 'metar';
            const openMeteoRefreshNeeded = (profileWeatherNeeded && vpWeatherSource === 'openmeteo') || (mapWeatherNeeded && mapWeatherSource === 'openmeteo');
            if (openMeteoRefreshNeeded && (now - vpWeatherLastAutoRefreshAt) >= (15 * 60 * 1000)) {
                vpWeatherLastAutoRefreshAt = now;
                if (profileWeatherNeeded && vpWeatherSource === 'openmeteo' && typeof triggerVerticalProfileUpdate === 'function') triggerVerticalProfileUpdate();
                if (window.vpWeatherFallbackMode !== 'openmeteo_to_metar' && !vpIsOpenMeteoCoolingDown() && typeof window.scheduleMapWeatherOverlayUpdate === 'function') {
                    window.scheduleMapWeatherOverlayUpdate(true);
                }
            }
            if (window.vpWeatherAutoFallbackFrom === 'metar' && window.vpWeatherFallbackMode === 'metar_to_openmeteo') {
                const lastProbe = Number(window.vpMetarRecoveryProbeAt || 0);
                if ((now - lastProbe) >= VP_METAR_RECOVERY_PROBE_MS) {
                    window.vpMetarRecoveryProbeAt = now;
                    vpProbeMetarRecovery(routeWaypoints, vpElevationData || [], null).then((ok) => {
                        if (!ok) return;
                        vpWeatherSource = 'metar';
                        window.vpWeatherSource = 'metar';
                        localStorage.setItem('ga_weather_source', 'metar');
                        window.vpWeatherAutoFallbackFrom = null;
                        vpSetWeatherFallbackMode('none', 'metar recovered');
                        if (typeof updateWeatherSourceBtn === 'function') updateWeatherSourceBtn();
                        if (typeof renderWeatherMarkers === 'function') renderWeatherMarkers();
                        if (typeof window.scheduleMapWeatherOverlayUpdate === 'function') window.scheduleMapWeatherOverlayUpdate(true);
                        if (typeof triggerVerticalProfileUpdate === 'function') triggerVerticalProfileUpdate();
                    }).catch(() => {});
                }
            }
        }
    }, 60 * 1000);
}

function updateWeatherRenderModeBtn() {
    const btn = document.getElementById('btnToggleWeatherRenderMode');
    if (!btn) return;
    const isAbstrakt = vpWeatherRenderMode === 'abstrakt' || vpWeatherRenderMode === 'pro';
    btn.classList.toggle('active', isAbstrakt);
    btn.textContent = '🌦️ Wetterstil: ' + (isAbstrakt ? 'Abstrakt' : 'Classic');
    btn.title = isAbstrakt
        ? 'Aktuell: abstrakter Wetterstil (nochmal klicken = Classic)'
        : 'Aktuell: klassischer Wetterstil (nochmal klicken = Abstrakt)';
}

document.addEventListener('DOMContentLoaded', () => {
    updateCloudsBtn();
    updateWeatherSourceBtn();
    updateWeatherRenderModeBtn();
    updateIsobarsBtn();
    updateWindComponentsBtn();
    updateLandmarksBtn();
    updateObstaclesBtn();
    vpSyncLinearMasterFlag();
    updateLinearButtons();
    updateAirspaceBtn(); // NEU
    updateTrafficProfileBtn();
    ensureWeatherRefreshTimer();
});
function vpChangeAlt(delta) {
    let val = parseInt(document.getElementById('altMapInput').textContent) || 4500;
    val = Math.max(1500, Math.min(13500, val + delta));
    syncAltFromInput(val);
}
function syncAltFromInput(val) {
    val = parseInt(val) || 4500;
    const inp = document.getElementById('altMapInput');
    if (inp) inp.textContent = val;
    const mainSlider = document.getElementById('altSlider');
    if (mainSlider) mainSlider.value = val;
    handleSliderChange('alt', val); // handleSliderChange übernimmt jetzt den direkten Render
}
function vpChangeRate(delta) {
    let val = parseInt(document.getElementById('rateMapInput').textContent) || 500;
    val = Math.max(200, Math.min(1500, val + delta));
    syncRateFromInput(val);
}
function syncRateFromInput(val) {
    val = parseInt(val) || 500;
    const inp = document.getElementById('rateMapInput');
    inp.innerText = val;
    handleRateChange(val);
}
function vpChangeYAxis(delta) {
    window.activateFastRender();
    if (vpMaxAltOverride === 0) {
        const elevData = (typeof vpZoomLevel !== 'undefined' && vpZoomLevel < 100 && vpHighResData) ? vpHighResData : vpElevationData;
        if (!elevData) return;
        const cruiseAlt = parseInt(document.getElementById('altMapInput')?.textContent || 4500);
        const maxTerrain = Math.max(...elevData.map(p => p.elevFt));
        vpMaxAltOverride = Math.max(cruiseAlt + 2500, maxTerrain + 1000);
        vpMaxAltOverride = Math.ceil(vpMaxAltOverride / 1000) * 1000;
    }
    vpMaxAltOverride = Math.max(3000, vpMaxAltOverride + delta);
    document.getElementById('yAxisDisplay').textContent = (vpMaxAltOverride / 1000) + 'k';
    
    // Performance-Rendering!
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
}
function vpResetYAxis() {
    window.activateFastRender();
    vpMaxAltOverride = 0;
    document.getElementById('yAxisDisplay').textContent = 'AUTO';
    renderMapProfile();
    if (document.getElementById('verticalProfileCanvas')) renderVerticalProfile('verticalProfileCanvas');
}
function vpToggleClouds() {
    vpShowClouds = !vpShowClouds;
    localStorage.setItem('ga_show_clouds', vpShowClouds);
    updateCloudsBtn();
    
    if (vpShowClouds && window._lastVpRouteKey) {
        triggerVerticalProfileUpdate();
    } else {
        window.vpBgNeedsUpdate = true;
        if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
    }
}

function vpToggleWeatherSource() {
    vpWeatherSource = vpWeatherSource === 'metar' ? 'openmeteo' : 'metar';
    window.vpWeatherSource = vpWeatherSource;
    localStorage.setItem('ga_weather_source', vpWeatherSource);
    // Quelle wechselt global: alte Daten sofort invalidieren, damit keine
    // veralteten OM/METAR-Labels bis zum nächsten Fetch sichtbar bleiben.
    vpWeatherData = null;
    window._lastWetterRouteKey = null;
    window._lastWetterCoverageKey = null;
    window._lastWetterRouteNm = 0;
    window._lastWeatherSourceKey = null;
    updateWeatherSourceBtn();
    window.vpBgNeedsUpdate = true;
    window.vpWeatherAutoFallbackFrom = null;
    vpSetWeatherFallbackMode('none', 'manual source toggle');
    if (typeof renderWeatherMarkers === 'function') renderWeatherMarkers();
    const mapWeatherSource = String(window.vpMapWeatherSource || localStorage.getItem('ga_map_weather_source') || 'metar').toLowerCase() === 'openmeteo' ? 'openmeteo' : 'metar';
    if (mapWeatherSource === 'metar' && typeof window.scheduleMapWeatherOverlayUpdate === 'function') window.scheduleMapWeatherOverlayUpdate(false);
    if (window._lastVpRouteKey) triggerVerticalProfileUpdate();
    else if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
    ensureWeatherRefreshTimer();
}

function vpToggleWeatherRenderMode() {
    vpWeatherRenderMode = (vpWeatherRenderMode === 'classic') ? 'abstrakt' : 'classic';
    localStorage.setItem('ga_weather_render_mode', vpWeatherRenderMode);
    updateWeatherRenderModeBtn();
    window.vpBgNeedsUpdate = true;
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
}

function vpToggleIsobars() {
    vpShowIsobars = !vpShowIsobars;
    localStorage.setItem('ga_show_isobars', vpShowIsobars);
    updateIsobarsBtn();
    window.vpBgNeedsUpdate = true;
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
}

function vpToggleWindComponents() {
    vpShowWindComponents = !vpShowWindComponents;
    localStorage.setItem('ga_show_wind_components', vpShowWindComponents);
    updateWindComponentsBtn();
    window.vpBgNeedsUpdate = true;
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
}

function vpToggleLandmarks() {
    vpShowLandmarks = !vpShowLandmarks;
    localStorage.setItem('ga_show_landmarks', vpShowLandmarks);
    updateLandmarksBtn();
    
    if (vpShowLandmarks && window._lastVpRouteKey) {
        localStorage.removeItem('ga_lms_' + window._lastVpRouteKey);
        window._lastLmRouteKey = null; // Zwingt zum erneuten Fetch
        triggerVerticalProfileUpdate();
    } else {
        window.vpBgNeedsUpdate = true; // FIX: Hintergrund zum Löschen zwingen
        if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
    }
}

function vpToggleObstacles() {
    vpShowObstacles = !vpShowObstacles;
    localStorage.setItem('ga_show_obstacles', vpShowObstacles);
    updateObstaclesBtn();
    
    // FIX: Nur neu abfragen, wenn für die aktuelle Route noch nie geladen wurde!
    if (vpShowObstacles && window._lastVpRouteKey && window._lastObsRouteKey !== window._lastVpRouteKey) {
        triggerVerticalProfileUpdate();
    } else {
        window.vpBgNeedsUpdate = true; 
        if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
    }
}

function vpToggleLinearFeatures() {
    const next = !vpShowLinear;
    vpShowRoads = next;
    vpShowRivers = next;
    vpShowPowerInfra = next;
    vpSyncLinearMasterFlag();
    localStorage.setItem('ga_show_linear', vpShowLinear);
    localStorage.setItem('ga_show_roads', vpShowRoads);
    localStorage.setItem('ga_show_rivers', vpShowRivers);
    localStorage.setItem('ga_show_power', vpShowPowerInfra);
    updateLinearButtons();
    
    // FIX: Nur neu abfragen, wenn für die aktuelle Route noch nie geladen wurde!
    if (vpShowLinear && window._lastVpRouteKey && window._lastObsRouteKey !== window._lastVpRouteKey) {
        triggerVerticalProfileUpdate();
    } else {
        window.vpBgNeedsUpdate = true; 
        if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
    }
}

function vpToggleRoads() {
    vpShowRoads = !vpShowRoads;
    vpSyncLinearMasterFlag();
    localStorage.setItem('ga_show_roads', vpShowRoads);
    localStorage.setItem('ga_show_linear', vpShowLinear);
    updateLinearButtons();
    if (vpShowLinear && window._lastVpRouteKey && window._lastObsRouteKey !== window._lastVpRouteKey) triggerVerticalProfileUpdate();
    else {
        window.vpBgNeedsUpdate = true;
        if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
    }
}

function vpToggleRivers() {
    vpShowRivers = !vpShowRivers;
    vpSyncLinearMasterFlag();
    localStorage.setItem('ga_show_rivers', vpShowRivers);
    localStorage.setItem('ga_show_linear', vpShowLinear);
    updateLinearButtons();
    if (vpShowLinear && window._lastVpRouteKey && window._lastObsRouteKey !== window._lastVpRouteKey) triggerVerticalProfileUpdate();
    else {
        window.vpBgNeedsUpdate = true;
        if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
    }
}

function vpTogglePower() {
    vpShowPowerInfra = !vpShowPowerInfra;
    vpSyncLinearMasterFlag();
    localStorage.setItem('ga_show_power', vpShowPowerInfra);
    localStorage.setItem('ga_show_linear', vpShowLinear);
    updateLinearButtons();
    if ((vpShowLinear || vpShowObstacles) && window._lastVpRouteKey && window._lastObsRouteKey !== window._lastVpRouteKey) triggerVerticalProfileUpdate();
    else {
        window.vpBgNeedsUpdate = true;
        if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
    }
}

function vpToggleAirspaces() {
    vpAirspaceMode = (vpAirspaceMode + 1) % 3;
    localStorage.setItem('ga_show_airspaces', vpAirspaceMode);
    updateAirspaceBtn();
    window.vpBgNeedsUpdate = true; // Zwingt den Hintergrund zum Update
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
}

// === PROMPT-EINGABE für ALT / V/S (V57) ===
window.retryFailedOverpassChunks = async function() {
    vpHydrateObsTileFailed();
    let chunks = window.vpFailedOverpassChunks;
    if (!chunks || chunks.length === 0) {
        const fromStore = Array.from(vpObsTileFailed.keys()).slice(0, 120).map(k => ({ tileKey: k }));
        chunks = fromStore;
    }
    if (!chunks || chunks.length === 0) return;
    if (window.vpOverpassGlobalInFlight && window.vpOverpassGlobalInFlight.promise) {
        console.warn('[Overpass] Retry blockiert: Es läuft bereits ein Overpass-Request.');
        return;
    }
    if (vpIsOverpassCoolingDown()) {
        const remainingMin = Math.max(1, Math.ceil(vpGetOverpassCooldownRemainingMs() / 60000));
        console.warn(`[Overpass] Retry blockiert: Cooldown noch ${remainingMin} min aktiv.`);
        return;
    }
    
    console.log(`[Overpass] Starte manuellen Retry für ${chunks.length} fehlgeschlagene Tiles...`);
    window.vpFailedOverpassChunks = []; 
    if (typeof window.updateOverpassErrorUI === 'function') window.updateOverpassErrorUI();
    
    const btnOb = document.getElementById('btnToggleObstacles');
    if (btnOb) btnOb.classList.add('vp-loading-pulse');

    const tileKeys = chunks
        .map(c => (c && typeof c.tileKey === 'string') ? c.tileKey : '')
        .filter(Boolean);
    const failedAgain = [];
    for (let i = 0; i < tileKeys.length; i++) {
        const tileKey = tileKeys[i];
        const res = await vpFetchObstacleTile(tileKey, null, i, { preferOverpass: true });
        if (res && res.ok) {
            vpRememberObstacleData(res.features?.obs || [], res.features?.lin || [], tileKey);
            vpMarkTileKeysCovered([tileKey], res.src || 'overpass-retry');
            vpClearTileFailed(tileKey);
            vpMarkOverpassSuccess();
        } else {
            vpMarkTileFailed(tileKey, Number((res && res.status) || 0), String((res && res.src) || ''));
            failedAgain.push({ tileKey });
            if (res && res.cooldown) {
                for (let k = i + 1; k < tileKeys.length; k++) failedAgain.push({ tileKey: tileKeys[k] });
                break;
            }
        }
        if (i < tileKeys.length - 1) await new Promise(r => setTimeout(r, VP_OBS_TILE_INTER_REQUEST_MS));
    }
    window.vpFailedOverpassChunks = failedAgain;

    if (Array.isArray(vpElevationData) && vpElevationData.length > 1) {
        const seeded = vpProjectObsPoolToRoute(vpElevationData);
        vpObstacles = seeded.obs || [];
        vpLinearFeatures = seeded.lin || [];
    }

    window.vpBgNeedsUpdate = true;
    if (typeof window.throttledRenderProfiles === 'function') window.throttledRenderProfiles();
    
    if (btnOb) btnOb.classList.remove('vp-loading-pulse');
    if (typeof window.updateOverpassErrorUI === 'function') window.updateOverpassErrorUI();
};
window.vpRetryFailedObsTiles = function() {
    return window.retryFailedOverpassChunks ? window.retryFailedOverpassChunks() : Promise.resolve();
};

window.promptForAlt = function() {
    const current = document.getElementById('altMapInput').textContent;
    const res = prompt("Gewünschte Flughöhe (ALT) eingeben:", current);
    if (res !== null && !isNaN(parseInt(res))) {
        let val = parseInt(res);
        val = Math.max(1500, Math.min(13500, val));
        syncAltFromInput(val);
    }
};
window.promptForRate = function() {
    const current = document.getElementById('rateMapInput').textContent;
    const res = prompt("Gewünschte Steig-/Sinkrate (V/S) in ft/min eingeben:", current);
    if (res !== null && !isNaN(parseInt(res))) {
        let val = parseInt(res);
        val = Math.max(200, Math.min(1500, val));
        syncRateFromInput(val);
    }
};

/* =========================================================
   2D SIMULATOR EXPORT (Vollständige Welt)
   ========================================================= */
window.exportFor2DSim = function() {
    if (!vpElevationData || vpElevationData.length < 2) {
        alert("Bitte generiere zuerst eine Route im Dispatcher!");
        return;
    }

    const NM_TO_M = 1852;
    const FT_TO_M = 0.3048;

    let waypoints = [];
    
    // 1. Start-Landebahn generieren
    waypoints.push({ x: 0, elevation: vpElevationData[0].elevFt * FT_TO_M, type: "runway", length: 1200 });
    
    // 2. Wegpunkte / Topographie
    for (let i = 1; i < vpElevationData.length - 1; i++) {
        waypoints.push({ x: vpElevationData[i].distNM * NM_TO_M, elevation: vpElevationData[i].elevFt * FT_TO_M, type: "terrain" });
    }
    
    // 3. Ziel-Landebahn generieren
    let totalDistM = vpElevationData[vpElevationData.length - 1].distNM * NM_TO_M;
    waypoints.push({ x: totalDistM, elevation: vpElevationData[vpElevationData.length - 1].elevFt * FT_TO_M, type: "runway", length: 1200 });

    // 3b. Höhenprofil berechnen und zu jedem Wegpunkt hinzufügen
    const _exportCruiseAlt = parseInt(document.getElementById('altMapInput')?.textContent || 4500);
    const _exportTas = parseInt(document.getElementById('tasSlider')?.value || 115);
    const _exportProf = typeof computeFlightProfile === 'function'
        ? computeFlightProfile(vpElevationData, _exportCruiseAlt, vpClimbRate, vpDescentRate, _exportTas)
        : null;
    if (_exportProf && _exportProf.profile && _exportProf.profile.length > 0) {
        waypoints.forEach(wp => {
            const distNM = wp.x / NM_TO_M;
            let altFt = _exportCruiseAlt;
            for (let _j = 0; _j < _exportProf.profile.length - 1; _j++) {
                const _p0 = _exportProf.profile[_j], _p1 = _exportProf.profile[_j + 1];
                if (distNM >= _p0.distNM && distNM <= _p1.distNM) {
                    const _f = (_p1.distNM > _p0.distNM) ? (distNM - _p0.distNM) / (_p1.distNM - _p0.distNM) : 0;
                    altFt = _p0.altFt + _f * (_p1.altFt - _p0.altFt);
                    break;
                }
            }
            wp.alt = Math.round(altFt); // Reiseflughöhe in Fuß
        });
    }

    // 3c. Dispatcher-Wegpunkte (gesetzt im Vertical Profile) extrahieren
    let altWaypoints = [];
    if (typeof vpAltWaypoints !== 'undefined' && vpAltWaypoints.length > 0) {
        altWaypoints = vpAltWaypoints.map(wp => ({ x: wp.distNM * NM_TO_M, altFt: wp.altFt }));
    }

    // 4. Wetter-Zonen (Regen, Schnee, Wolken)
    let weatherZones = [];
    let cloudBaseMeters = 1500;
    if (typeof vpWeatherData !== 'undefined' && vpWeatherData) {
        if (vpWeatherData.length > 0 && vpWeatherData[0].lowestBase !== Infinity) {
            cloudBaseMeters = vpWeatherData[0].lowestBase * FT_TO_M;
        }
        vpWeatherData.forEach(zone => {
            weatherZones.push({
                x: zone.distNM * NM_TO_M,
                icao: zone.icao,
                hasRain: zone.weather ? zone.weather.hasRain : false,
                hasSnow: zone.weather ? zone.weather.hasSnow : false,
                hasTS: zone.weather ? zone.weather.hasTS : false,
                clouds: zone.clouds ? zone.clouds.map(c => ({
                    type: c.type,
                    baseM: c.baseMsl * FT_TO_M
                })) : []
            });
        });
    }

    // 5. Hindernisse (Windräder, Masten)
    let obstacles = [];
    if (typeof vpObstacles !== 'undefined' && vpObstacles) {
        vpObstacles.forEach(obs => {
            obstacles.push({
                x: obs.distNM * NM_TO_M,
                type: obs.type, // 'wind' oder 'mast'
                heightM: obs.hFt * FT_TO_M
            });
        });
    }

    // 6. Lineare Features (Flüsse, Autobahnen, Stromtrassen)
    let linearFeatures = [];
    if (typeof vpLinearFeatures !== 'undefined' && vpLinearFeatures) {
        vpLinearFeatures.forEach(feat => {
            linearFeatures.push({
                x: feat.distNM * NM_TO_M,
                type: feat.type, // 'river' | 'highway' | 'powerline'
                name: feat.name
            });
        });
    }

    // 7. Städte & Flughäfen
    let landmarks = [];
    if (typeof vpLandmarks !== 'undefined' && vpLandmarks) {
        vpLandmarks.forEach(lm => {
            landmarks.push({
                x: lm.distNM * NM_TO_M,
                type: lm.type, // 'apt', 'city', 'town'
                name: lm.name
            });
        });
    }

    // 7b. Lufträume (Airspaces) extrahieren
    let airspaces = [];
    if (typeof activeAirspaces !== 'undefined' && activeAirspaces.length > 0 && typeof getCachedAirspaceIntersections === 'function') {
        let totalDistNM = vpElevationData[vpElevationData.length - 1].distNM;
        let cachedAS = getCachedAirspaceIntersections(vpElevationData, totalDistNM);
        
        cachedAS.forEach(item => {
            // Nur relevante Lufträume exportieren (z.B. keine unendlichen FIRs)
            let asName = item.as.name || "Luftraum";
            // Wir berechnen die absolute MSL Höhe in Metern für den Simulator
            let lowerM = item.lowerFt * FT_TO_M;
            let upperM = item.upperFt * FT_TO_M;
            
            airspaces.push({
                name: asName,
                type: item.as.type, 
                isCTR: asName.includes("CTR") || asName.includes("Control Zone"),
                startX: item.asMinDist * NM_TO_M,
                endX: item.asMaxDist * NM_TO_M,
                lowerM: lowerM,
                upperM: upperM,
                isLowerAgl: item.isLowerAgl
            });
        });
    }

    // 8. JSON zusammensetzen (Update!)
    let simData = {
        weather: { windVX: -5, windVY: 0, oat: 15, qnh: 1013, cloudBase: Math.round(cloudBaseMeters) },
        waypoints: waypoints,
        weatherZones: weatherZones,
        obstacles: obstacles,
        linearFeatures: linearFeatures,
        landmarks: landmarks,
        airspaces: airspaces,
        altWaypoints: altWaypoints
    };

    let jsonString = JSON.stringify(simData);

    // 9. MAGIC TRANSFER: Ab in den localStorage und Simulator öffnen!
    try {
        localStorage.setItem('autoSimFlightPlan', jsonString);
        // Öffnet den Simulator in einem neuen Tab (Pfad ggf. anpassen, falls game.html woanders liegt)
        window.open('game.html', '_blank');
    } catch (e) {
        alert("Fehler beim Transfer! Bitte Cookies/Local Storage im Browser erlauben.");
        console.error(e);
    }
};

/* =========================================================
   HDG-MODUS: Heading-basiertes Vertikalprofil (v1)
   Zeigt Terrain, Lufträume, Städte entlang der aktuellen
   Flugrichtung — ohne neue API-Calls.
   X-Achse = Minuten voraus/zurück (totalDist = Minuten).
   Flugzeug steht bei distNM = VP_HDG_LOOKBACK_MIN (leicht eingerückt).
   ========================================================= */

const VP_HDG_LOOKBACK_MIN = 2;    // Minuten hinter dem Flugzeug (Gelände dahinter)
const VP_HDG_LOOKAHEAD_MIN = 15;  // Minuten voraus (Standard)
const VP_HDG_SAMPLES = 80;        // Anzahl Terrain-Sample-Punkte (gesamt)

let vpMode = 'ROUTE';            // 'ROUTE' | 'HDG'
let vpHdgElevData = null;        // [{distNM (=Minuten), elevFt, lat, lon}]
let vpHdgLandmarks = [];
let vpHdgObstacles = [];
let vpHdgLinearFeatures = [];
let vpHdgUpdateTimer = null;
let vpHdgUpdateInFlight = false;
let vpHdgRefreshPending = false;
let vpHdgPendingReason = '';
let vpHdgCycleGeneration = 0;
let vpHdgLastUpdate = { lat: 0, lon: 0, hdg: -999 };
let vpHdgLastTurnSample = { hdg: -999, ts: 0 };
let vpHdgWeatherTurnRate = 0;
let vpHdgWeatherFetchTs = 0;
let vpHdgWeatherInFlight = false;
let vpHdgWeatherAbortController = null;
let vpHdgWeatherLastSignature = '';
let vpHdgWeatherCoverageKey = '';
let vpHdgWeatherLastHardRefreshTs = 0;

// ── Toggle ──────────────────────────────────────────────
function vpToggleMode() {
    const btn = document.getElementById('btnToggleVpMode');
    const hasGps = window.lastLiveGpsPos && typeof smoothedGS !== 'undefined' && smoothedGS > 20;

    if (vpMode === 'ROUTE') {
        if (!hasGps) {
            // Kein GPS → Button kurz blinken lassen
            if (btn) { btn.style.background = '#833'; setTimeout(() => btn.style.background = '', 600); }
            return;
        }
        vpMode = 'HDG';
        if (btn) { btn.textContent = 'HDG'; btn.classList.add('active'); }
        startHdgCycle();
    } else {
        stopHdgCycle();
        if (btn) { btn.textContent = 'RTE'; btn.classList.remove('active'); }
        // _hdgAutoActivated bleibt true → kein sofortiger Re-Trigger durch GPS-Tick
        // Reset passiert erst beim GPS-Disconnect (in sync.js onclose)
    }
}

// Öffentliche Sicherheitsfunktion: garantiert Rückkehr in den ROUTE-Modus.
window.vpEnsureRouteMode = function () {
    if (vpMode !== 'HDG') return;
    stopHdgCycle();
    const btn = document.getElementById('btnToggleVpMode');
    if (btn) {
        btn.textContent = 'RTE';
        btn.classList.remove('active');
    }
};

function startHdgCycle() {
    vpHdgCycleGeneration += 1;
    vpWeatherData = null;
    vpHdgWeatherLastSignature = '';
    vpHdgWeatherFetchTs = 0;
    vpHdgWeatherCoverageKey = '';
    vpHdgWeatherLastHardRefreshTs = 0;
    vpHdgLastTurnSample = { hdg: -999, ts: 0 };
    vpHdgRefreshPending = true;
    vpHdgPendingReason = 'hdg-start';
    vpQueueHdgProfileUpdate({ force: true, reason: 'hdg-start' });
    if (vpHdgUpdateTimer) clearInterval(vpHdgUpdateTimer);
    vpHdgUpdateTimer = setInterval(() => vpQueueHdgProfileUpdate({ reason: 'hdg-cycle' }), 1000);
}

function stopHdgCycle() {
    vpHdgCycleGeneration += 1;
    clearInterval(vpHdgUpdateTimer);
    vpHdgUpdateTimer = null;
    vpHdgElevData = null;
    vpHdgLandmarks = [];
    vpHdgObstacles = [];
    vpHdgLinearFeatures = [];
    if (vpHdgWeatherAbortController) {
        vpHdgWeatherAbortController.abort();
        vpHdgWeatherAbortController = null;
    }
    vpHdgWeatherInFlight = false;
    vpHdgWeatherLastSignature = '';
    vpHdgWeatherFetchTs = 0;
    vpHdgWeatherCoverageKey = '';
    vpHdgWeatherLastHardRefreshTs = 0;
    vpHdgRefreshPending = false;
    vpHdgPendingReason = '';
    vpMode = 'ROUTE';
    window.vpBgNeedsUpdate = true;
    if (window._lastVpRouteKey && typeof triggerVerticalProfileUpdate === 'function') {
        triggerVerticalProfileUpdate();
    }
}

function vpHdgAngleDelta(a, b) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
    return Math.abs(((a - b + 540) % 360) - 180);
}

function vpClonePressureProfile(list) {
    if (!Array.isArray(list)) return [];
    return list.map(p => ({
        hPa: p.hPa,
        geopotentialFt: Number.isFinite(p.geopotentialFt) ? p.geopotentialFt : null,
        cloudPct: Number.isFinite(p.cloudPct) ? p.cloudPct : null,
        windKt: Number.isFinite(p.windKt) ? p.windKt : null,
        windDirDeg: Number.isFinite(p.windDirDeg) ? p.windDirDeg : null
    }));
}

function vpCloneClouds(list) {
    if (!Array.isArray(list)) return [];
    return list.map(c => ({
        type: c.type,
        baseAgl: c.baseAgl,
        baseMsl: c.baseMsl,
        topMsl: c.topMsl,
        source: c.source || null,
        estimated: !!c.estimated
    }));
}

function vpLerpCircularDeg(a, b, t) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.isFinite(b) ? b : a;
    const da = ((b - a + 540) % 360) - 180;
    return (a + da * t + 360) % 360;
}

function vpBuildCoverageKeyFromPoints(points, stepDeg = 0.1) {
    if (!Array.isArray(points) || points.length === 0) return '';
    const picks = [0, Math.floor(points.length * 0.25), Math.floor(points.length * 0.5), Math.floor(points.length * 0.75), points.length - 1];
    const chunks = [];
    for (const idx of picks) {
        const p = points[Math.max(0, Math.min(points.length - 1, idx))];
        if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
        const latQ = vpQuantizeCoord(p.lat, stepDeg);
        const lonQ = vpQuantizeCoord(p.lon, stepDeg);
        chunks.push(`${latQ.toFixed(2)},${lonQ.toFixed(2)}`);
    }
    return chunks.join('|');
}

function vpBlendHdgWeatherZones(prevZones, nextZones, alpha) {
    if (!Array.isArray(nextZones) || nextZones.length === 0) return nextZones;
    if (!Array.isArray(prevZones) || prevZones.length === 0) return nextZones;
    const t = Math.max(0, Math.min(1, alpha));
    const maxMatchDeltaMin = 2.4;
    return nextZones.map(nz => {
        let best = null;
        let bestD = Infinity;
        for (const pz of prevZones) {
            const d = Math.abs((pz.distNM || 0) - (nz.distNM || 0));
            if (d < bestD) { bestD = d; best = pz; }
        }
        if (!best || bestD > maxMatchDeltaMin) return nz;

        const out = { ...nz };
        if (Number.isFinite(best.lowestBase) && Number.isFinite(nz.lowestBase)) {
            out.lowestBase = best.lowestBase + (nz.lowestBase - best.lowestBase) * t;
        }
        if (Number.isFinite(best.wspd) && Number.isFinite(nz.wspd)) {
            out.wspd = best.wspd + (nz.wspd - best.wspd) * t;
        }
        if (Number.isFinite(best.wdir) && Number.isFinite(nz.wdir)) {
            out.wdir = vpLerpCircularDeg(best.wdir, nz.wdir, t);
        }
        if (Number.isFinite(best.mslPressureHpa) && Number.isFinite(nz.mslPressureHpa)) {
            out.mslPressureHpa = best.mslPressureHpa + (nz.mslPressureHpa - best.mslPressureHpa) * t;
        }

        if (Array.isArray(best.clouds) && Array.isArray(nz.clouds) && best.clouds.length === nz.clouds.length) {
            out.clouds = nz.clouds.map((c, i) => {
                const p = best.clouds[i];
                return {
                    ...c,
                    baseAgl: Number.isFinite(p.baseAgl) && Number.isFinite(c.baseAgl) ? (p.baseAgl + (c.baseAgl - p.baseAgl) * t) : c.baseAgl,
                    baseMsl: Number.isFinite(p.baseMsl) && Number.isFinite(c.baseMsl) ? (p.baseMsl + (c.baseMsl - p.baseMsl) * t) : c.baseMsl,
                    topMsl: Number.isFinite(p.topMsl) && Number.isFinite(c.topMsl) ? (p.topMsl + (c.topMsl - p.topMsl) * t) : c.topMsl
                };
            });
        }

        if (Array.isArray(best.pressureProfile) && Array.isArray(nz.pressureProfile)) {
            const bestByLevel = new Map(best.pressureProfile.map(p => [p.hPa, p]));
            out.pressureProfile = nz.pressureProfile.map(p => {
                const q = bestByLevel.get(p.hPa);
                if (!q) return p;
                return {
                    ...p,
                    geopotentialFt: Number.isFinite(q.geopotentialFt) && Number.isFinite(p.geopotentialFt) ? (q.geopotentialFt + (p.geopotentialFt - q.geopotentialFt) * t) : p.geopotentialFt,
                    cloudPct: Number.isFinite(q.cloudPct) && Number.isFinite(p.cloudPct) ? (q.cloudPct + (p.cloudPct - q.cloudPct) * t) : p.cloudPct,
                    windKt: Number.isFinite(q.windKt) && Number.isFinite(p.windKt) ? (q.windKt + (p.windKt - q.windKt) * t) : p.windKt,
                    windDirDeg: Number.isFinite(q.windDirDeg) && Number.isFinite(p.windDirDeg) ? vpLerpCircularDeg(q.windDirDeg, p.windDirDeg, t) : p.windDirDeg
                };
            });
        }
        return out;
    });
}

function vpConvertHdgWeatherZonesToMinutes(zonesNm, gs) {
    if (!Array.isArray(zonesNm)) return [];
    const k = Math.max(15, gs) / 60;
    return zonesNm.map(z => ({
        ...z,
        distNM: (z.distNM || 0) / k,
        clouds: vpCloneClouds(z.clouds),
        pressureProfile: vpClonePressureProfile(z.pressureProfile)
    }));
}

function vpGetHdgWeatherChunkCache(key, now = Date.now()) {
    if (!key) return null;
    const entry = vpHdgWeatherChunkCache.get(key);
    if (!entry || !Array.isArray(entry.zones)) return null;
    if ((now - Number(entry.ts || 0)) > VP_HDG_WEATHER_CHUNK_CACHE_TTL_MS) {
        vpHdgWeatherChunkCache.delete(key);
        return null;
    }
    return entry.zones.map(z => ({
        ...z,
        clouds: vpCloneClouds(z.clouds),
        pressureProfile: vpClonePressureProfile(z.pressureProfile)
    }));
}

function vpSetHdgWeatherChunkCache(key, zones, now = Date.now()) {
    if (!key || !Array.isArray(zones) || zones.length === 0) return;
    vpHdgWeatherChunkCache.set(key, {
        ts: now,
        zones: zones.map(z => ({
            ...z,
            clouds: vpCloneClouds(z.clouds),
            pressureProfile: vpClonePressureProfile(z.pressureProfile)
        }))
    });
    if (vpHdgWeatherChunkCache.size <= VP_HDG_WEATHER_CHUNK_CACHE_MAX) return;
    const stale = Array.from(vpHdgWeatherChunkCache.entries())
        .sort((a, b) => Number((a[1] && a[1].ts) || 0) - Number((b[1] && b[1].ts) || 0))
        .slice(0, Math.max(1, vpHdgWeatherChunkCache.size - VP_HDG_WEATHER_CHUNK_CACHE_MAX));
    stale.forEach(([k]) => vpHdgWeatherChunkCache.delete(k));
}

async function vpUpdateHdgWeather(lat, lon, hdg, gs, dHdg, dPos) {
    if (!vpCanRunVisibleMapProfileWork()) return;
    const weatherNeeded = vpShowClouds || vpShowIsobars || vpShowWindComponents;
    if (!weatherNeeded || !Array.isArray(vpHdgElevData) || vpHdgElevData.length < 2) return;
    if (vpHdgWeatherInFlight) return;
    if (!Number.isFinite(gs) || gs < 20) return;

    const now = Date.now();
    const dtSec = vpHdgLastTurnSample.ts > 0 ? ((now - vpHdgLastTurnSample.ts) / 1000) : 1;
    const dTurn = vpHdgAngleDelta(hdg, vpHdgLastTurnSample.hdg);
    vpHdgWeatherTurnRate = dtSec > 0.05 ? (dTurn / dtSec) : vpHdgWeatherTurnRate;
    vpHdgLastTurnSample = { hdg, ts: now };

    const highTurn = vpHdgWeatherTurnRate > 6;
    const mediumTurn = vpHdgWeatherTurnRate > 2.5;

    const signature = [
        (lat || 0).toFixed(3),
        (lon || 0).toFixed(3),
        Math.round(hdg || 0),
        Math.round(gs || 0),
        vpWeatherSource
    ].join('|');
    const sigHeadingDelta = vpHdgWeatherLastSignature ? vpHdgAngleDelta(Math.round(hdg || 0), Number(vpHdgWeatherLastSignature.split('|')[2] || 0)) : 999;
    if (signature === vpHdgWeatherLastSignature && dPos < 0.0015 && sigHeadingDelta < 2) return;

    const k = gs / 60;
    const elevNm = vpHdgElevData.map(p => ({
        distNM: Math.max(0, (p.distNM || 0) * k),
        elevFt: p.elevFt,
        lat: p.lat,
        lon: p.lon
    }));
    const routePts = elevNm.map(p => ({ lat: p.lat, lon: p.lon, lng: p.lon }));
    if (routePts.length < 2) return;
    const coverageKey = vpBuildCoverageKeyFromPoints(routePts, VP_HDG_WEATHER_COVERAGE_STEP_DEG);
    const hdgChunkKey = `${window.vpWeatherSource || vpWeatherSource || 'metar'}:${coverageKey || 'none'}`;
    const cachedZonesNm = vpGetHdgWeatherChunkCache(hdgChunkKey, now);
    if (cachedZonesNm) {
        const zonesMin = vpConvertHdgWeatherZonesToMinutes(cachedZonesNm, gs);
        const blendAlpha = mediumTurn ? 0.34 : 0.46;
        vpWeatherData = vpBlendHdgWeatherZones(vpWeatherData, zonesMin, blendAlpha);
        vpHdgWeatherLastSignature = signature;
        vpHdgWeatherCoverageKey = coverageKey;
        vpHdgWeatherLastHardRefreshTs = now;
        window.vpBgNeedsUpdate = true;
        return;
    }
    const areaChanged = !!coverageKey && coverageKey !== vpHdgWeatherCoverageKey;
    const refreshDue = (now - vpHdgWeatherLastHardRefreshTs) >= VP_OM_CACHE_TTL_MS;
    if (!areaChanged && !refreshDue) {
        if (window.vpWeatherDebug) window.vpWeatherDebug.hdgSkippedNoAreaChange += 1;
        return;
    }

    const minFetchIntervalMs = areaChanged ? (highTurn ? 3500 : 2400) : VP_OM_CACHE_TTL_MS;
    if ((now - vpHdgWeatherFetchTs) < minFetchIntervalMs) {
        if (window.vpWeatherDebug) window.vpWeatherDebug.hdgSkippedNoAreaChange += 1;
        return;
    }
    if (!areaChanged && highTurn && dHdg < 5 && dPos < 0.0035) {
        if (window.vpWeatherDebug) window.vpWeatherDebug.hdgSkippedNoAreaChange += 1;
        return;
    }

    if (vpHdgWeatherAbortController) vpHdgWeatherAbortController.abort();
    vpHdgWeatherAbortController = new AbortController();
    const signal = vpHdgWeatherAbortController.signal;
    vpHdgWeatherInFlight = true;
    vpHdgWeatherFetchTs = now;

    try {
        if (window.vpWeatherDebug) window.vpWeatherDebug.hdgFetches += 1;
        const zonesNm = await fetchRouteWeather(routePts, elevNm, signal);
        if (signal.aborted || vpMode !== 'HDG' || !vpCanRunVisibleMapProfileWork()) return;
        if (!Array.isArray(zonesNm) || zonesNm.length === 0) return;
        vpSetHdgWeatherChunkCache(hdgChunkKey, zonesNm, now);

        const zonesMin = vpConvertHdgWeatherZonesToMinutes(zonesNm, gs);
        const blendAlpha = highTurn ? 0.24 : (mediumTurn ? 0.34 : 0.46);
        vpWeatherData = vpBlendHdgWeatherZones(vpWeatherData, zonesMin, blendAlpha);
        vpHdgWeatherLastSignature = signature;
        vpHdgWeatherCoverageKey = coverageKey;
        vpHdgWeatherLastHardRefreshTs = now;
        window.vpBgNeedsUpdate = true;
    } catch (e) {
        if (e && e.name === 'AbortError') return;
        console.warn('[HDG] Wetter-Update fehlgeschlagen:', e);
        vpWeatherDebugSetError(e, 'hdg update');
    } finally {
        vpHdgWeatherInFlight = false;
    }
}

function vpQueueHdgProfileUpdate(options = {}) {
    const force = options.force === true;
    const reason = String(options.reason || 'hdg-cycle');
    if (vpMode !== 'HDG') return;
    if (!vpCanRunVisibleMapProfileWork()) {
        if (force) {
            vpHdgRefreshPending = true;
            vpHdgPendingReason = reason;
        }
        return;
    }
    if (vpHdgUpdateInFlight) {
        if (force) {
            vpHdgRefreshPending = true;
            vpHdgPendingReason = reason;
        }
        return;
    }

    const runForced = force || vpHdgRefreshPending;
    const runReason = vpHdgPendingReason || reason;
    vpHdgRefreshPending = false;
    vpHdgPendingReason = '';
    void updateHdgProfile({ force: runForced, reason: runReason }).catch((e) => {
        console.warn('[HDG] Profil-Update fehlgeschlagen:', e);
        if (window.gaDebugPush) window.gaDebugPush('profile', '[HDG] Profile update failed', { reason: runReason, error: String(e && e.message || e) });
    });
}

async function updateHdgProfile(options = {}) {
    const force = options.force === true;
    if (vpMode !== 'HDG' || !vpCanRunVisibleMapProfileWork()) {
        if (force) vpHdgRefreshPending = true;
        return;
    }
    if (!window.lastLiveGpsPos) return;

    const runGeneration = vpHdgCycleGeneration;
    vpHdgUpdateInFlight = true;

    try {
        const { lat, lon, hdg, alt } = window.lastLiveGpsPos;
        const gs = (typeof smoothedGS !== 'undefined' && smoothedGS > 20) ? smoothedGS : 80;

        // Change-Detection: nur updaten wenn Kurs/Position sich nennenswert geändert hat.
        // Sichtbarwerden und explizite Refreshes dürfen diese Schwelle einmalig umgehen.
        const dHdg = Math.abs(((hdg - vpHdgLastUpdate.hdg) + 540) % 360 - 180);
        const dPos = Math.abs(lat - vpHdgLastUpdate.lat) + Math.abs(lon - vpHdgLastUpdate.lon);
        if (!force && vpHdgElevData && dHdg < 2 && dPos < 0.003) return;

        vpHdgLastUpdate = { lat, lon, hdg };
        const nextElevData = await generateHdgProfile(lat, lon, hdg, alt, gs);
        if (runGeneration !== vpHdgCycleGeneration || vpMode !== 'HDG' || !vpCanRunVisibleMapProfileWork()) return;
        if (Array.isArray(nextElevData) && nextElevData.length >= 2) vpHdgElevData = nextElevData;

        await vpUpdateHdgWeather(lat, lon, hdg, gs, dHdg, dPos);
        if (runGeneration !== vpHdgCycleGeneration || vpMode !== 'HDG' || !vpCanRunVisibleMapProfileWork()) return;
        computeHdgLandmarks(lat, lon, hdg, gs);
        computeHdgObstacles(lat, lon, hdg, gs);
        computeHdgLinearFeatures(lat, lon, hdg, gs);
        window.vpBgNeedsUpdate = true;
        vpRequestMapProfileFrameNow();
    } finally {
        vpHdgUpdateInFlight = false;
        if (vpHdgRefreshPending && vpMode === 'HDG' && vpCanRunVisibleMapProfileWork()) {
            const pendingReason = vpHdgPendingReason || 'hdg-pending';
            vpHdgRefreshPending = false;
            vpHdgPendingReason = '';
            vpQueueHdgProfileUpdate({ force: true, reason: pendingReason });
        }
    }
}

// ── Terrain-Sampling entlang der Flugrichtung ────────────
async function generateHdgProfile(lat, lon, hdg, alt, gs) {
    if (typeof sampleTerrainElevation !== 'function') return null;
    if (vpMode !== 'HDG' || !vpCanRunVisibleMapProfileWork()) return null;

    const totalMin = VP_HDG_LOOKBACK_MIN + VP_HDG_LOOKAHEAD_MIN;
    const totalNM  = gs * (totalMin / 60);
    const stepNM   = totalNM / VP_HDG_SAMPLES;
    const backNM   = gs * (VP_HDG_LOOKBACK_MIN / 60);

    const points = [];
    for (let i = 0; i <= VP_HDG_SAMPLES; i++) {
        const ahead = i * stepNM - backNM;  // negativ = hinter dem Flugzeug
        const bearing = ahead >= 0 ? hdg : (hdg + 180) % 360;
        const dist    = Math.abs(ahead);
        const pt = (typeof getDestinationPoint === 'function')
            ? getDestinationPoint(lat, lon, dist, bearing)
            : { lat, lon };
        // distNM speichern wir in Minuten (i * totalMin / samples)
        const timeMin = i * totalMin / VP_HDG_SAMPLES;
        points.push({ lat: pt.lat, lon: pt.lon, distNM: timeMin });
    }

    // Tiles parallel vorladen (normalerweise 1-3 Tiles)
    const tileSet = new Set();
    const tilePromises = [];
    for (const p of points) {
        const z = 10;
        const n = Math.pow(2, z);
        const tx = Math.floor((p.lon + 180) / 360 * n);
        const latRad = p.lat * Math.PI / 180;
        const ty = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
        const key = `${z}/${tx}/${ty}`;
        if (!tileSet.has(key) && typeof _tawsLoadTile === 'function') {
            tileSet.add(key);
            tilePromises.push(_tawsLoadTile(tx, ty, z).catch(() => null));
        }
    }
    if (tilePromises.length) await Promise.all(tilePromises);
    if (vpMode !== 'HDG' || !vpCanRunVisibleMapProfileWork()) return null;

    // Höhen sampeln (synchron aus Cache)
    const result = [];
    for (const p of points) {
        if ((result.length % 8) === 0 && (vpMode !== 'HDG' || !vpCanRunVisibleMapProfileWork())) return null;
        try {
            const elevFt = await sampleTerrainElevation(p.lat, p.lon);
            result.push({ distNM: p.distNM, elevFt: Math.max(0, elevFt), lat: p.lat, lon: p.lon });
        } catch (e) {
            result.push({ distNM: p.distNM, elevFt: 0, lat: p.lat, lon: p.lon });
        }
    }
    return result;
}

// ── Landmarks (Städte & Airports) entlang Heading ────────
function computeHdgLandmarks(lat, lon, hdg, gs) {
    vpHdgLandmarks = [];

    const cities = Array.isArray(window.GLOBAL_CITIES_DATA)
        ? window.GLOBAL_CITIES_DATA
        : (Array.isArray(globalCities) ? globalCities : []);
    const airports = (typeof globalAirports !== 'undefined' && globalAirports) ? Object.values(globalAirports) : [];
    const totalMin = VP_HDG_LOOKBACK_MIN + VP_HDG_LOOKAHEAD_MIN;
    const totalNM  = gs * (totalMin / 60);
    const backNM   = gs * (VP_HDG_LOOKBACK_MIN / 60);

    const found = [];

    // Städte
    for (const c of cities) {
        if (!c.lat || !c.lon) continue;
        if (typeof calcNav !== 'function') break;
        const nav = calcNav(lat, lon, c.lat, c.lon);
        if (nav.dist > totalNM + 5) continue; // Grob-Filter
        // Winkel zur Heading-Linie prüfen
        const angleOff = Math.abs(((nav.brng - hdg) + 540) % 360 - 180);
        if (angleOff > 20 || nav.dist > totalNM + 3) continue;
        // Seitliche Abweichung prüfen (max 4 NM)
        const sideDevNM = nav.dist * Math.sin(angleOff * Math.PI / 180);
        if (Math.abs(sideDevNM) > 4) continue;
        // Distanz entlang Heading → Minuten
        const alongNM = nav.dist * Math.cos(angleOff * Math.PI / 180);
        const alongMin = (alongNM / gs) * 60;
        const timeMin = VP_HDG_LOOKBACK_MIN + (nav.brng === hdg ? alongMin : -alongMin);
        if (timeMin < 0 || timeMin > totalMin) continue;
        found.push({ name: c.name || c.n, type: 'city', pop: c.pop || 0, distNM: timeMin });
    }

    // Airports
    for (const a of airports) {
        if (!a.lat || !a.lon) continue;
        if (typeof calcNav !== 'function') break;
        const nav = calcNav(lat, lon, a.lat, a.lon);
        if (nav.dist > totalNM + 5) continue;
        const angleOff = Math.abs(((nav.brng - hdg) + 540) % 360 - 180);
        if (angleOff > 20 || nav.dist > totalNM + 3) continue;
        const sideDevNM = nav.dist * Math.sin(angleOff * Math.PI / 180);
        if (Math.abs(sideDevNM) > 4) continue;
        const alongNM = nav.dist * Math.cos(angleOff * Math.PI / 180);
        const alongMin = (alongNM / gs) * 60;
        const timeMin = VP_HDG_LOOKBACK_MIN + (nav.brng === hdg ? alongMin : -alongMin);
        if (timeMin < 0 || timeMin > totalMin) continue;
        found.push({ name: a.icao || a.name, type: 'apt', pop: 999999, distNM: timeMin });
    }

    // Sortieren nach Entfernung, max. 12 Landmarks
    found.sort((a, b) => b.pop - a.pop);
    vpHdgLandmarks = found.slice(0, 12);
}

// ── Hindernisse aus Cache filtern ────────────────────────
function computeHdgObstacles(lat, lon, hdg, gs) {
    vpHdgObstacles = [];
    if (!vpObstacles || vpObstacles.length === 0) return;

    const totalMin = VP_HDG_LOOKBACK_MIN + VP_HDG_LOOKAHEAD_MIN;
    const totalNM  = gs * (totalMin / 60);
    const backNM   = gs * (VP_HDG_LOOKBACK_MIN / 60);

    for (const obs of vpObstacles) {
        if (!obs.lat || !obs.lon) continue;
        if (typeof calcNav !== 'function') break;
        const nav = calcNav(lat, lon, obs.lat, obs.lon);
        if (nav.dist > totalNM + 3) continue;
        const angleOff = Math.abs(((nav.brng - hdg) + 540) % 360 - 180);
        if (angleOff > 20) continue;
        const sideDevNM = nav.dist * Math.sin(angleOff * Math.PI / 180);
        if (Math.abs(sideDevNM) > 3) continue;
        const alongNM = nav.dist * Math.cos(angleOff * Math.PI / 180);
        const alongMin = (alongNM / gs) * 60;
        // angleOff ≤ 20° → Hindernis liegt voraus (Heading-Korridor)
        const timeMin = VP_HDG_LOOKBACK_MIN + alongMin;
        if (timeMin < 0 || timeMin > totalMin) continue;
        vpHdgObstacles.push({ ...obs, distNM: timeMin, groundElevFt: obs.elevFt });
    }
}

// ── Lineare Features (Straßen, Flüsse, Stromtrassen) entlang Heading ──
function computeHdgLinearFeatures(lat, lon, hdg, gs) {
    vpHdgLinearFeatures = [];
    if (!vpLinearFeatures || vpLinearFeatures.length === 0) return;

    const totalMin = VP_HDG_LOOKBACK_MIN + VP_HDG_LOOKAHEAD_MIN;
    const totalNM  = gs * (totalMin / 60);

    for (const lin of vpLinearFeatures) {
        if (!lin.lat || !lin.lon) continue;
        if (typeof calcNav !== 'function') break;
        const nav = calcNav(lat, lon, lin.lat, lin.lon);
        if (nav.dist > totalNM + 3) continue;
        const angleOff = Math.abs(((nav.brng - hdg) + 540) % 360 - 180);
        if (angleOff > 25) continue; // etwas breiterer Korridor für Straßen/Flüsse
        const sideDevNM = nav.dist * Math.sin(angleOff * Math.PI / 180);
        if (Math.abs(sideDevNM) > 5) continue;
        const alongNM = nav.dist * Math.cos(angleOff * Math.PI / 180);
        const timeMin = VP_HDG_LOOKBACK_MIN + (alongNM / gs) * 60;
        if (timeMin < 0 || timeMin > totalMin) continue;
        vpHdgLinearFeatures.push({ ...lin, distNM: timeMin });
    }
}
