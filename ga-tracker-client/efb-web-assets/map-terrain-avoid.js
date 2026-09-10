// Generated from map-terrain-avoid.js by sync-efb-web-assets.js. Do not edit.
// Standalone Terrarium overlay, shared with the tracker-hosted EFB.
var TERRAIN_AVOID_WARN_DEFAULT_FT = 500;
var TERRAIN_AVOID_SAFE_DEFAULT_FT = 1000;
var TERRAIN_AVOID_WARN_MIN_FT = 0;
var TERRAIN_AVOID_WARN_MAX_FT = 3000;
var TERRAIN_AVOID_SAFE_MIN_FT = 0;
var TERRAIN_AVOID_SAFE_MAX_FT = 5000;
var TERRAIN_AVOID_MIN_UPDATE_MS = 1000;
var TERRAIN_AVOID_STALE_GPS_MS = 30000;
var TERRAIN_AVOID_TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
var TERRAIN_AVOID_SOURCE_MAX_Z = 13;
var TERRAIN_AVOID_TILE_CACHE_MAX = 180;
var TERRAIN_AVOID_RENDER_TILE_CACHE_MAX = 280;
var TERRAIN_AVOID_MIN_ALT_DELTA_FT = 18;
var terrainAvoidOverlayLayer = null;
var terrainAvoidRefreshTimer = null;
var terrainAvoidLastRenderAt = 0;
var terrainAvoidLastRenderAltFt = null;
var terrainAvoidWarnFt = TERRAIN_AVOID_WARN_DEFAULT_FT;
var terrainAvoidSafeFt = TERRAIN_AVOID_SAFE_DEFAULT_FT;
var terrainAvoidWasAirborne = false;
var terrainAvoidPausedReason = '';
var terrainAvoidUiSignature = '';
var terrainAvoidTileCache = new Map();
var terrainAvoidTileInFlightCache = new Map();
var terrainAvoidRenderedTileCache = new Map();
function clampTerrainAvoidThresholds() {
  var warnRaw = Number(terrainAvoidWarnFt);
  var safeRaw = Number(terrainAvoidSafeFt);
  var warnNorm = Number.isFinite(warnRaw) ? warnRaw : TERRAIN_AVOID_WARN_DEFAULT_FT;
  var safeNorm = Number.isFinite(safeRaw) ? safeRaw : TERRAIN_AVOID_SAFE_DEFAULT_FT;
  terrainAvoidWarnFt = Math.round(Math.max(TERRAIN_AVOID_WARN_MIN_FT, Math.min(TERRAIN_AVOID_WARN_MAX_FT, warnNorm)));
  terrainAvoidSafeFt = Math.round(Math.max(TERRAIN_AVOID_SAFE_MIN_FT, Math.min(TERRAIN_AVOID_SAFE_MAX_FT, safeNorm)));
  if (terrainAvoidSafeFt < terrainAvoidWarnFt) {
    terrainAvoidSafeFt = terrainAvoidWarnFt;
  }
}
function loadTerrainAvoidSettings() {
  var _localStorage$getItem, _localStorage$getItem2;
  var warnStored = Number((_localStorage$getItem = localStorage.getItem('ga_terrain_avoid_warn_ft')) !== null && _localStorage$getItem !== void 0 ? _localStorage$getItem : NaN);
  var safeStored = Number((_localStorage$getItem2 = localStorage.getItem('ga_terrain_avoid_safe_ft')) !== null && _localStorage$getItem2 !== void 0 ? _localStorage$getItem2 : NaN);
  terrainAvoidWarnFt = Number.isFinite(warnStored) ? warnStored : TERRAIN_AVOID_WARN_DEFAULT_FT;
  terrainAvoidSafeFt = Number.isFinite(safeStored) ? safeStored : TERRAIN_AVOID_SAFE_DEFAULT_FT;
  clampTerrainAvoidThresholds();
}
function saveTerrainAvoidSettings() {
  localStorage.setItem('ga_terrain_avoid_warn_ft', String(Math.round(terrainAvoidWarnFt)));
  localStorage.setItem('ga_terrain_avoid_safe_ft', String(Math.round(terrainAvoidSafeFt)));
}
function updateTerrainAvoidThresholdUi() {
  var warnSlider = document.getElementById('terrainAvoidWarnSlider');
  var safeSlider = document.getElementById('terrainAvoidSafeSlider');
  var warnLabel = document.getElementById('terrainAvoidWarnValue');
  var safeLabel = document.getElementById('terrainAvoidSafeValue');
  var statusLabel = document.getElementById('terrainAvoidStatus');
  var on = !!(window.mapHints && window.mapHints.terrainAvoid !== false);
  var available = terrainAvoidCanRenderNow();
  var liveSource = terrainAvoidCanActivate();
  var planningFallback = terrainAvoidUsingPlanningFallback();
  var signature = [Math.round(terrainAvoidWarnFt), Math.round(terrainAvoidSafeFt), on ? 1 : 0, available ? 1 : 0, liveSource ? 1 : 0, planningFallback ? 1 : 0, terrainAvoidPausedReason].join('|');
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
window.setTerrainAvoidThreshold = function (kind, value) {
  if (kind === 'warn') terrainAvoidWarnFt = Number(value);
  if (kind === 'safe') terrainAvoidSafeFt = Number(value);
  clampTerrainAvoidThresholds();
  saveTerrainAvoidSettings();
  updateTerrainAvoidThresholdUi();
  if (window.mapHints && window.mapHints.terrainAvoid !== false) {
    window.scheduleTerrainAvoidOverlayUpdate(true);
  }
};
window.resetTerrainAvoidThresholds = function () {
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
    var _window$lastLiveGpsPo, _window$lastLiveGpsPo2, _window$lastLiveFligh;
    var altSim = Number((_window$lastLiveGpsPo = (_window$lastLiveGpsPo2 = window.lastLiveGpsPos) === null || _window$lastLiveGpsPo2 === void 0 ? void 0 : _window$lastLiveGpsPo2.alt) !== null && _window$lastLiveGpsPo !== void 0 ? _window$lastLiveGpsPo : (_window$lastLiveFligh = window.lastLiveFlightData) === null || _window$lastLiveFligh === void 0 ? void 0 : _window$lastLiveFligh.mslFt);
    return Number.isFinite(altSim) ? Math.max(0, altSim) : null;
  }
  if (window.liveTrackerConnected) {
    var _window$lastLiveGpsPo3, _window$lastLiveGpsPo4, _window$lastLiveFligh2;
    if (typeof isGpsLive === 'function' && !isGpsLive(TERRAIN_AVOID_STALE_GPS_MS)) return null;
    var altLive = Number((_window$lastLiveGpsPo3 = (_window$lastLiveGpsPo4 = window.lastLiveGpsPos) === null || _window$lastLiveGpsPo4 === void 0 ? void 0 : _window$lastLiveGpsPo4.alt) !== null && _window$lastLiveGpsPo3 !== void 0 ? _window$lastLiveGpsPo3 : (_window$lastLiveFligh2 = window.lastLiveFlightData) === null || _window$lastLiveFligh2 === void 0 ? void 0 : _window$lastLiveFligh2.mslFt);
    return Number.isFinite(altLive) ? Math.max(0, altLive) : null;
  }
  return null;
}
function getTerrainAvoidPlanningAltFt() {
  var _document$getElementB, _document$getElementB2, _window$gaProfileData, _window$gaProfileData2;
  var altMap = Number((_document$getElementB = document.getElementById('altSliderMap')) === null || _document$getElementB === void 0 ? void 0 : _document$getElementB.value);
  if (Number.isFinite(altMap) && altMap > 0) return altMap;
  var altPlan = Number((_document$getElementB2 = document.getElementById('altSlider')) === null || _document$getElementB2 === void 0 ? void 0 : _document$getElementB2.value);
  if (Number.isFinite(altPlan) && altPlan > 0) return altPlan;
  var providerAlt = Number((_window$gaProfileData = window.gaProfileDataProvider) === null || _window$gaProfileData === void 0 || (_window$gaProfileData2 = _window$gaProfileData.planningAltitudeFt) === null || _window$gaProfileData2 === void 0 ? void 0 : _window$gaProfileData2.call(_window$gaProfileData));
  return Number.isFinite(providerAlt) && providerAlt > 0 ? providerAlt : null;
}
function terrainAvoidUsingPlanningFallback() {
  if (!terrainAvoidCanActivate()) return false;
  var liveAlt = getTerrainAvoidLiveAltFt();
  if (Number.isFinite(liveAlt)) return false;
  return Number.isFinite(getTerrainAvoidPlanningAltFt());
}
function terrainAvoidCanRenderNow() {
  return Number.isFinite(getTerrainAvoidAircraftAltFt());
}
function terrainAvoidReadFlightState() {
  var _ref, _window$lastLiveGpsPo5, _window$lastLiveGpsPo6;
  var fd = window.lastLiveFlightData || {};
  var hasOnGround = typeof fd.onGround === 'boolean';
  var onGround = hasOnGround ? !!fd.onGround : false;
  var gs = Number((_ref = (_window$lastLiveGpsPo5 = (_window$lastLiveGpsPo6 = window.lastLiveGpsPos) === null || _window$lastLiveGpsPo6 === void 0 ? void 0 : _window$lastLiveGpsPo6.gs) !== null && _window$lastLiveGpsPo5 !== void 0 ? _window$lastLiveGpsPo5 : fd.gsKts) !== null && _ref !== void 0 ? _ref : fd.gs);
  var agl = Number(fd.aglFt);
  var airborne = hasOnGround ? !onGround || Number.isFinite(gs) && gs > 45 : Number.isFinite(agl) && agl > 180 || Number.isFinite(gs) && gs > 45;
  var landed = hasOnGround ? onGround && (!Number.isFinite(gs) || gs <= 28) : Number.isFinite(agl) && agl <= 60 && (!Number.isFinite(gs) || gs <= 30);
  return {
    hasOnGround,
    onGround,
    gs,
    agl,
    airborne,
    landed
  };
}
window.terrainAvoidHandleFlightState = function () {
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
  var st = terrainAvoidReadFlightState();
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
  var liveAlt = terrainAvoidCanActivate() ? getTerrainAvoidLiveAltFt() : null;
  if (Number.isFinite(liveAlt)) return liveAlt;
  return getTerrainAvoidPlanningAltFt();
}
function terrainAvoidLerpByte(a, b, t) {
  var clamped = Math.max(0, Math.min(1, t));
  return Math.round(a + (b - a) * clamped);
}
function getTerrainAvoidRgbaBytes(clearanceFt) {
  if (!Number.isFinite(clearanceFt)) return [0, 0, 0, 0];
  if (clearanceFt <= 0) return [255, 52, 52, 208];
  if (clearanceFt <= terrainAvoidWarnFt) {
    var _t = clearanceFt / Math.max(1, terrainAvoidWarnFt);
    return [255, terrainAvoidLerpByte(52, 184, _t), terrainAvoidLerpByte(52, 0, _t), 194];
  }
  if (clearanceFt >= terrainAvoidSafeFt) return [0, 0, 0, 182];
  var t = (clearanceFt - terrainAvoidWarnFt) / Math.max(1, terrainAvoidSafeFt - terrainAvoidWarnFt);
  return [terrainAvoidLerpByte(255, 0, t), terrainAvoidLerpByte(184, 0, t), 0, terrainAvoidLerpByte(186, 178, t)];
}
function terrainAvoidResolveSourceTile(coords) {
  var z = Math.max(0, Number(coords && coords.z) || 0);
  var srcZ = Math.min(TERRAIN_AVOID_SOURCE_MAX_Z, z);
  var scale = Math.max(1, 1 << Math.max(0, z - srcZ));
  var x = Number(coords && coords.x) || 0;
  var y = Number(coords && coords.y) || 0;
  var srcXRaw = Math.floor(x / scale);
  var srcYRaw = Math.floor(y / scale);
  var subX = (x % scale + scale) % scale;
  var subY = (y % scale + scale) % scale;
  var n = 1 << srcZ;
  if (srcYRaw < 0 || srcYRaw >= n) return null;
  var srcX = (srcXRaw % n + n) % n;
  return {
    srcZ,
    srcX,
    srcY: srcYRaw,
    scale,
    subX,
    subY
  };
}
function terrainAvoidLoadTileImageData(z, x, y) {
  var key = `${z}/${x}/${y}`;
  if (terrainAvoidTileCache.has(key)) return Promise.resolve(terrainAvoidTileCache.get(key));
  if (terrainAvoidTileInFlightCache.has(key)) return terrainAvoidTileInFlightCache.get(key);
  var promise = new Promise((resolve, reject) => {
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      var c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      var ctx = c.getContext('2d', {
        willReadFrequently: true
      });
      if (!ctx) {
        reject(new Error('terrain-ctx-missing'));
        return;
      }
      ctx.drawImage(img, 0, 0, 256, 256);
      var imageData = ctx.getImageData(0, 0, 256, 256);
      if (terrainAvoidTileCache.size >= TERRAIN_AVOID_TILE_CACHE_MAX) {
        var oldest = terrainAvoidTileCache.keys().next().value;
        if (oldest) terrainAvoidTileCache.delete(oldest);
      }
      terrainAvoidTileCache.set(key, imageData);
      resolve(imageData);
    };
    img.onerror = () => reject(new Error(`terrain-tile-load-failed:${key}`));
    img.src = typeof window.gaTerrainAvoidTileUrl === 'function' ? window.gaTerrainAvoidTileUrl(z, x, y) : TERRAIN_AVOID_TILE_URL.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
  });
  terrainAvoidTileInFlightCache.set(key, promise);
  promise.then(() => terrainAvoidTileInFlightCache.delete(key), () => terrainAvoidTileInFlightCache.delete(key));
  return promise;
}
function terrainAvoidStoreRenderedTile(tileKey, imageData, width, height) {
  terrainAvoidRenderedTileCache.set(tileKey, {
    imageData,
    width,
    height,
    ts: Date.now()
  });
  if (terrainAvoidRenderedTileCache.size > TERRAIN_AVOID_RENDER_TILE_CACHE_MAX) {
    var oldest = terrainAvoidRenderedTileCache.keys().next().value;
    if (oldest) terrainAvoidRenderedTileCache.delete(oldest);
  }
}
function terrainAvoidPaintTileCanvas(canvas, coords, aircraftAltFt, done) {
  var ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d', {
    willReadFrequently: true
  }) : null;
  var finalize = () => {
    if (typeof done === 'function') done();
  };
  if (!ctx || !coords || !Number.isFinite(aircraftAltFt)) {
    finalize();
    return;
  }
  var size = {
    x: canvas.width || 256,
    y: canvas.height || 256
  };
  var spec = terrainAvoidResolveSourceTile(coords);
  if (!spec) {
    finalize();
    return;
  }
  var tileKey = `${coords.z}/${coords.x}/${coords.y}`;
  terrainAvoidLoadTileImageData(spec.srcZ, spec.srcX, spec.srcY).then(srcImage => {
    var src = srcImage && srcImage.data ? srcImage.data : null;
    if (!src) {
      finalize();
      return;
    }
    var out = ctx.createImageData(size.x, size.y);
    var outData = out.data;
    for (var py = 0; py < size.y; py++) {
      var srcPy = spec.scale === 1 ? py : Math.min(255, Math.floor((spec.subY * 256 + py) / spec.scale));
      for (var px = 0; px < size.x; px++) {
        var srcPx = spec.scale === 1 ? px : Math.min(255, Math.floor((spec.subX * 256 + px) / spec.scale));
        var srcIdx = (srcPy * 256 + srcPx) * 4;
        var r = src[srcIdx];
        var g = src[srcIdx + 1];
        var b = src[srcIdx + 2];
        var elevM = r * 256 + g + b / 256 - 32768;
        var terrainFt = Math.max(0, Math.round(elevM * 3.28084));
        var rgba = getTerrainAvoidRgbaBytes(aircraftAltFt - terrainFt);
        var outIdx = (py * size.x + px) * 4;
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
  var tiles = terrainAvoidOverlayLayer._tiles || null;
  if (!tiles) return false;
  var paintedAny = false;
  Object.keys(tiles).forEach(key => {
    var rec = tiles[key];
    var canvas = rec && rec.el;
    var coords = rec && rec.coords;
    if (!canvas || !coords) return;
    paintedAny = true;
    terrainAvoidPaintTileCanvas(canvas, coords, aircraftAltFt);
  });
  return paintedAny;
}
function ensureTerrainAvoidOverlayLayer() {
  if (terrainAvoidOverlayLayer || typeof L === 'undefined') return;
  var TerrainAvoidGridLayer = L.GridLayer.extend({
    createTile: function createTile(coords, done) {
      var tile = L.DomUtil.create('canvas', 'leaflet-tile');
      var size = this.getTileSize();
      tile.width = size.x;
      tile.height = size.y;
      var ctx = tile.getContext('2d', {
        willReadFrequently: true
      });
      var tileKey = `${coords.z}/${coords.x}/${coords.y}`;
      var finalize = () => {
        if (typeof done === 'function') done(null, tile);
      };
      if (!ctx) {
        finalize();
        return tile;
      }
      var cachedRendered = terrainAvoidRenderedTileCache.get(tileKey);
      if (cachedRendered && cachedRendered.width === size.x && cachedRendered.height === size.y && cachedRendered.imageData) {
        try {
          ctx.putImageData(cachedRendered.imageData, 0, 0);
        } catch (_) {}
      }
      if (window.mapHints && window.mapHints.terrainAvoid === false) {
        finalize();
        return tile;
      }
      if (!terrainAvoidCanRenderNow()) {
        finalize();
        return tile;
      }
      var aircraftAltFt = getTerrainAvoidAircraftAltFt();
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
window.setTerrainAvoidOverlayEnabled = function (next) {
  var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
  var enable = !!next;
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
    var st = terrainAvoidReadFlightState();
    terrainAvoidWasAirborne = !!st.airborne;
    terrainAvoidPausedReason = terrainAvoidCanRenderNow() ? '' : 'source';
  } else {
    terrainAvoidWasAirborne = false;
    terrainAvoidPausedReason = '';
  }
  if (enable && terrainAvoidCanRenderNow()) window.scheduleTerrainAvoidOverlayUpdate(true);else if (typeof terrainAvoidOverlayLayer.redraw === 'function') terrainAvoidOverlayLayer.redraw();
  updateTerrainAvoidThresholdUi();
};
window.terrainAvoidPauseForSimEnd = function () {
  if (!window.mapHints || window.mapHints.terrainAvoid === false) return;
  terrainAvoidWasAirborne = false;
  terrainAvoidPausedReason = 'sim-end';
  if (map && terrainAvoidOverlayLayer && map.hasLayer(terrainAvoidOverlayLayer)) {
    map.removeLayer(terrainAvoidOverlayLayer);
  }
  updateTerrainAvoidThresholdUi();
};
window.scheduleTerrainAvoidOverlayUpdate = function () {
  var forceFetch = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
  if (!map) return;
  if (!window.mapHints || window.mapHints.terrainAvoid === false) {
    if (terrainAvoidRefreshTimer) clearTimeout(terrainAvoidRefreshTimer);
    terrainAvoidRefreshTimer = null;
    return;
  }
  updateTerrainAvoidThresholdUi();
  ensureTerrainAvoidOverlayLayer();
  if (!terrainAvoidOverlayLayer) return;
  var st = terrainAvoidReadFlightState();
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
  var curAltFt = getTerrainAvoidAircraftAltFt();
  var now = Date.now();
  if (!forceFetch) {
    if (now - terrainAvoidLastRenderAt < TERRAIN_AVOID_MIN_UPDATE_MS) return;
    if (Number.isFinite(curAltFt) && Number.isFinite(terrainAvoidLastRenderAltFt)) {
      var dAlt = Math.abs(curAltFt - terrainAvoidLastRenderAltFt);
      if (dAlt < TERRAIN_AVOID_MIN_ALT_DELTA_FT) return;
    }
    if (terrainAvoidRefreshTimer) return;
  }
  if (terrainAvoidRefreshTimer) clearTimeout(terrainAvoidRefreshTimer);
  var delay = forceFetch ? 30 : 60;
  terrainAvoidRefreshTimer = setTimeout(() => {
    terrainAvoidRefreshTimer = null;
    if (!terrainAvoidOverlayLayer || !map.hasLayer(terrainAvoidOverlayLayer)) return;
    var renderNow = Date.now();
    if (!forceFetch && renderNow - terrainAvoidLastRenderAt < TERRAIN_AVOID_MIN_UPDATE_MS) return;
    if (!forceFetch && Number.isFinite(curAltFt) && Number.isFinite(terrainAvoidLastRenderAltFt)) {
      var _dAlt = Math.abs(curAltFt - terrainAvoidLastRenderAltFt);
      if (_dAlt < TERRAIN_AVOID_MIN_ALT_DELTA_FT) return;
    }
    terrainAvoidLastRenderAt = renderNow;
    terrainAvoidLastRenderAltFt = Number.isFinite(curAltFt) ? curAltFt : terrainAvoidLastRenderAltFt;
    if (!terrainAvoidRepaintVisibleTiles(curAltFt) && typeof terrainAvoidOverlayLayer.redraw === 'function') {
      terrainAvoidOverlayLayer.redraw();
    }
  }, delay);
};
