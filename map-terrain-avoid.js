// Standalone Terrarium overlay, shared with the tracker-hosted EFB.
const TERRAIN_AVOID_WARN_DEFAULT_FT = 500;
const TERRAIN_AVOID_SAFE_DEFAULT_FT = 1000;
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
let terrainAvoidUiSignature = '';
const terrainAvoidTileCache = new Map();
const terrainAvoidTileInFlightCache = new Map();
const terrainAvoidRenderedTileCache = new Map();

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
    const warnStored = Number(localStorage.getItem('ga_terrain_avoid_warn_ft') ?? NaN);
    const safeStored = Number(localStorage.getItem('ga_terrain_avoid_safe_ft') ?? NaN);
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
    const on = !!(window.mapHints && window.mapHints.terrainAvoid !== false);
    const available = terrainAvoidCanRenderNow();
    const liveSource = terrainAvoidCanActivate();
    const planningFallback = terrainAvoidUsingPlanningFallback();
    const signature = [
        Math.round(terrainAvoidWarnFt),
        Math.round(terrainAvoidSafeFt),
        on ? 1 : 0,
        available ? 1 : 0,
        liveSource ? 1 : 0,
        planningFallback ? 1 : 0,
        terrainAvoidPausedReason
    ].join('|');
    if (signature === terrainAvoidUiSignature) return;
    terrainAvoidUiSignature = signature;
    if (warnSlider) warnSlider.value = String(Math.round(terrainAvoidWarnFt));
    if (safeSlider) safeSlider.value = String(Math.round(terrainAvoidSafeFt));
    if (warnLabel) warnLabel.textContent = `${Math.round(terrainAvoidWarnFt)} ft`;
    if (safeLabel) safeLabel.textContent = `${Math.round(terrainAvoidSafeFt)} ft`;
    if (statusLabel) {
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
        } else if (planningFallback) {
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

window.resetTerrainAvoidThresholds = function() {
    terrainAvoidWarnFt = TERRAIN_AVOID_WARN_DEFAULT_FT;
    terrainAvoidSafeFt = TERRAIN_AVOID_SAFE_DEFAULT_FT;
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
    const providerAlt = Number(window.gaProfileDataProvider?.planningAltitudeFt?.());
    return Number.isFinite(providerAlt) && providerAlt > 0 ? providerAlt : null;
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
        img.src = typeof window.gaTerrainAvoidTileUrl === 'function' ? window.gaTerrainAvoidTileUrl(z, x, y) : TERRAIN_AVOID_TILE_URL.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
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
    if (!window.mapHints || window.mapHints.terrainAvoid === false) {
        if (terrainAvoidRefreshTimer) clearTimeout(terrainAvoidRefreshTimer);
        terrainAvoidRefreshTimer = null;
        return;
    }
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
    const now = Date.now();
    if (!forceFetch) {
        if ((now - terrainAvoidLastRenderAt) < TERRAIN_AVOID_MIN_UPDATE_MS) return;
        if (Number.isFinite(curAltFt) && Number.isFinite(terrainAvoidLastRenderAltFt)) {
            const dAlt = Math.abs(curAltFt - terrainAvoidLastRenderAltFt);
            if (dAlt < TERRAIN_AVOID_MIN_ALT_DELTA_FT) return;
        }
        if (terrainAvoidRefreshTimer) return;
    }
    if (terrainAvoidRefreshTimer) clearTimeout(terrainAvoidRefreshTimer);
    const delay = forceFetch ? 30 : 60;
    terrainAvoidRefreshTimer = setTimeout(() => {
        terrainAvoidRefreshTimer = null;
        if (!terrainAvoidOverlayLayer || !map.hasLayer(terrainAvoidOverlayLayer)) return;
        const renderNow = Date.now();
        if (!forceFetch && (renderNow - terrainAvoidLastRenderAt) < TERRAIN_AVOID_MIN_UPDATE_MS) return;
        if (!forceFetch && Number.isFinite(curAltFt) && Number.isFinite(terrainAvoidLastRenderAltFt)) {
            const dAlt = Math.abs(curAltFt - terrainAvoidLastRenderAltFt);
            if (dAlt < TERRAIN_AVOID_MIN_ALT_DELTA_FT) return;
        }
        terrainAvoidLastRenderAt = renderNow;
        terrainAvoidLastRenderAltFt = Number.isFinite(curAltFt) ? curAltFt : terrainAvoidLastRenderAltFt;
        if (!terrainAvoidRepaintVisibleTiles(curAltFt) && typeof terrainAvoidOverlayLayer.redraw === 'function') {
            terrainAvoidOverlayLayer.redraw();
        }
    }, delay);
};
