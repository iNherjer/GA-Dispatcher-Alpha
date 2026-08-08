'use strict';

const DEFAULT_CENTER = Object.freeze({ lat: 51.1657, lon: 10.4515, zoom: 6 });

const BASE_LAYERS = Object.freeze([
  Object.freeze({
    id: 'topo',
    label: 'OpenTopo · Text',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    fallbackUrl: 'https://backup.opentopomap.org/{z}/{x}/{y}.png',
    options: Object.freeze({
      attribution: '&copy; OpenStreetMap-Mitwirkende, Kartendarstellung &copy; OpenTopoMap',
      maxNativeZoom: 17,
      maxZoom: 18
    })
  }),
  Object.freeze({
    id: 'terrain',
    label: 'Terrain',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
    options: Object.freeze({ attribution: 'Tiles &copy; Esri', maxNativeZoom: 13, maxZoom: 18 })
  }),
  Object.freeze({
    id: 'satellite',
    label: 'Satellit',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: Object.freeze({ attribution: 'Tiles &copy; Esri', maxNativeZoom: 18, maxZoom: 18 })
  }),
  Object.freeze({
    id: 'dark',
    label: 'Dunkel',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    options: Object.freeze({ attribution: '&copy; OpenStreetMap-Mitwirkende, &copy; CARTO', maxNativeZoom: 20, maxZoom: 20 })
  }),
  Object.freeze({
    id: 'light',
    label: 'Hell',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    options: Object.freeze({ attribution: '&copy; OpenStreetMap-Mitwirkende, &copy; CARTO', maxNativeZoom: 20, maxZoom: 20 })
  })
]);

const OVERLAY_LAYERS = Object.freeze([
  Object.freeze({
    id: 'aero',
    label: 'VFR-Lufträume / Aero',
    kind: 'tile',
    url: 'https://nwy-tiles-api.prod.newaydata.com/tiles/{z}/{x}/{y}.png?path=latest/aero/latest',
    options: Object.freeze({ attribution: 'AeroData / NewayData', opacity: 0.68, maxNativeZoom: 12, maxZoom: 18 })
  }),
  Object.freeze({
    id: 'dfs',
    label: 'DFS ICAO 1:500k',
    kind: 'tile',
    url: 'https://secais.dfs.de/static-maps/icao500/tiles/{z}/{x}/{y}.png',
    options: Object.freeze({ attribution: '&copy; DFS Deutsche Flugsicherung', opacity: 1, maxNativeZoom: 11, maxZoom: 18 })
  }),
  Object.freeze({
    id: 'faa',
    label: 'FAA VFR Sectional',
    kind: 'tile',
    url: 'https://tiles.arcgis.com/tiles/ssFJjBXIUyZDrSYZ/arcgis/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}',
    options: Object.freeze({
      attribution: 'FAA VFR Sectional via ArcGIS',
      opacity: 0.92,
      minZoom: 5,
      minNativeZoom: 8,
      maxNativeZoom: 12,
      maxZoom: 18,
      bounds: Object.freeze([[15, -170], [72, -60]]),
      noWrap: true
    })
  }),
  Object.freeze({
    id: 'dwd',
    label: 'DWD Warnungen',
    kind: 'wms',
    url: 'https://maps.dwd.de/geoproxy_warnungen/service',
    options: Object.freeze({
      attribution: 'Warnungen &copy; Deutscher Wetterdienst',
      layers: 'Warnungen_Gemeinden_vereinigt',
      styles: '',
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      opacity: 0.62
    })
  })
]);

const BASE_IDS = new Set(BASE_LAYERS.map((layer) => layer.id));
const OVERLAY_IDS = new Set(OVERLAY_LAYERS.map((layer) => layer.id));

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeHeading(value) {
  const heading = finite(value);
  if (heading === null) return 0;
  return ((heading % 360) + 360) % 360;
}

function normalizePreferences(value = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const requestedBase = String(source.baseLayer || '').trim().toLowerCase();
  const requestedOverlays = Array.isArray(source.overlays) ? source.overlays : ['aero'];
  return {
    baseLayer: BASE_IDS.has(requestedBase) ? requestedBase : 'topo',
    overlays: Array.from(new Set(requestedOverlays
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter((entry) => OVERLAY_IDS.has(entry)))),
    follow: source.follow !== false
  };
}

function normalizeFlightSnapshot(value) {
  if (!value || typeof value !== 'object' || value.available !== true) return null;
  const lat = finite(value.lat);
  const lon = finite(value.lon);
  if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  const flight = value.flight && typeof value.flight === 'object' ? value.flight : {};
  const capturedAt = finite(value.capturedAt);
  return {
    lat,
    lon,
    altFt: Math.round(finite(value.alt) || 0),
    headingDeg: normalizeHeading(value.hdg),
    gsKts: Math.max(0, Math.round(finite(flight.gsKts) || 0)),
    iasKts: Math.max(0, Math.round(finite(flight.iasKts) || 0)),
    onGround: flight.onGround === true,
    capturedAt: capturedAt === null ? 0 : Math.max(0, Math.round(capturedAt))
  };
}

function formatCoordinateLine(snapshot) {
  if (!snapshot) return 'Keine Position';
  return `${snapshot.lat.toFixed(5)}, ${snapshot.lon.toFixed(5)} · ${snapshot.altFt} ft · ${Math.round(snapshot.headingDeg)}°`;
}

function formatFlightLine(snapshot) {
  if (!snapshot) return 'Warte auf Flugdaten';
  return `GS ${snapshot.gsKts} kt · IAS ${snapshot.iasKts} kt · ${snapshot.onGround ? 'Am Boden' : 'In der Luft'}`;
}

module.exports = Object.freeze({
  BASE_LAYERS,
  DEFAULT_CENTER,
  OVERLAY_LAYERS,
  formatCoordinateLine,
  formatFlightLine,
  normalizeFlightSnapshot,
  normalizeHeading,
  normalizePreferences
});
