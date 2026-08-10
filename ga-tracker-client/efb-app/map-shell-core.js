'use strict';

const DEFAULT_CENTER = Object.freeze({ lat: 51.1657, lon: 10.4515, zoom: 6 });
const AERO_BASE_OPACITY = 0.5;
const MISSION_EMPTY_DEBOUNCE_MS = 3000;
const MISSION_SNAPSHOT_GAP_GRACE_MS = 12000;
const MAP_SNAPSHOT_SCHEMA = 'ga.map-snapshot.v1';
const MAP_SNAPSHOT_VERSION = 1;

const THEMES = Object.freeze([
  Object.freeze({ id: 'classic', label: 'Classic' }),
  Object.freeze({ id: 'retro', label: 'Retro' }),
  Object.freeze({ id: 'navcom', label: 'NAV/COM' }),
  Object.freeze({ id: 'ops1940', label: 'OPS 1940' }),
  Object.freeze({ id: 'win95', label: 'Windows 95' })
]);

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
const THEME_IDS = new Set(THEMES.map((theme) => theme.id));

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
    follow: source.follow !== false,
    theme: THEME_IDS.has(String(source.theme || '').trim().toLowerCase())
      ? String(source.theme).trim().toLowerCase()
      : 'classic',
    toolbarCollapsed: source.toolbarCollapsed === true,
    profileVisible: source.profileVisible !== false
  };
}

function normalizeMapPoint(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const lat = finite(source.lat);
  const lon = finite(source.lon);
  if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return {
    id: String(source.id || '').slice(0, 80),
    name: String(source.name || '').slice(0, 100),
    lat,
    lon,
    elevationFt: finite(source.elevationFt),
    kind: String(source.kind || '').slice(0, 40),
    required: source.required !== false
  };
}

function normalizeTrackerMapSnapshot(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  if (source.schema !== MAP_SNAPSHOT_SCHEMA || Number(source.version) !== MAP_SNAPSHOT_VERSION) return null;
  const rawRoute = source.route && typeof source.route === 'object' ? source.route : {};
  const waypoints = (Array.isArray(rawRoute.waypoints) ? rawRoute.waypoints : [])
    .slice(0, 128)
    .map(normalizeMapPoint)
    .filter(Boolean);
  if (waypoints.length < 2) return null;
  const profileSource = source.profile && typeof source.profile === 'object' ? source.profile : null;
  const profilePoints = (Array.isArray(profileSource?.points) ? profileSource.points : [])
    .slice(0, 128)
    .map((point) => ({
      waypointId: String(point?.waypointId || '').slice(0, 80),
      name: String(point?.name || '').slice(0, 100),
      distanceNm: Math.max(0, finite(point?.distanceNm) || 0),
      terrainFt: finite(point?.terrainFt),
      plannedAltFt: Math.max(0, finite(point?.plannedAltFt) || 0)
    }));
  const navigationSource = source.navigation && typeof source.navigation === 'object' ? source.navigation : null;
  const geometrySource = source.missionGeometry && typeof source.missionGeometry === 'object' ? source.missionGeometry : {};
  return {
    schema: MAP_SNAPSHOT_SCHEMA,
    version: MAP_SNAPSHOT_VERSION,
    missionId: String(source.missionId || '').slice(0, 180),
    runId: String(source.runId || '').slice(0, 220),
    revision: Math.max(1, Math.round(finite(source.revision) || 1)),
    route: {
      totalDistanceNm: Math.max(0, finite(rawRoute.totalDistanceNm) || 0),
      waypoints
    },
    navigation: navigationSource ? {
      activeLegIndex: Math.max(0, Math.round(finite(navigationSource.activeLegIndex) || 0)),
      nextWaypointId: String(navigationSource.nextWaypointId || '').slice(0, 80),
      nextWaypointName: String(navigationSource.nextWaypointName || '').slice(0, 100),
      bearingToNextDeg: normalizeHeading(navigationSource.bearingToNextDeg),
      distanceToNextNm: Math.max(0, finite(navigationSource.distanceToNextNm) || 0),
      crossTrackNm: finite(navigationSource.crossTrackNm) || 0,
      routeDistanceNm: Math.max(0, finite(navigationSource.routeDistanceNm) || 0),
      remainingDistanceNm: Math.max(0, finite(navigationSource.remainingDistanceNm) || 0),
      progress: Math.max(0, Math.min(1, finite(navigationSource.progress) || 0))
    } : null,
    profile: profileSource ? {
      mode: String(profileSource.mode || 'planned-only'),
      terrainAvailable: profileSource.terrainAvailable === true,
      totalDistanceNm: Math.max(0, finite(profileSource.totalDistanceNm) || 0),
      cruiseAltitudeFt: Math.max(0, finite(profileSource.cruiseAltitudeFt) || 0),
      points: profilePoints
    } : null,
    missionGeometry: {
      target: normalizeMapPoint(geometrySource.target),
      poiChain: (Array.isArray(geometrySource.poiChain) ? geometrySource.poiChain : [])
        .slice(0, 96)
        .map(normalizeMapPoint)
        .filter(Boolean)
    }
  };
}

function normalizeCalcExpression(expression) {
  return String(expression || '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/,/g, '.')
    .replace(/\s+/g, '');
}

function evaluateCalculatorExpression(rawExpression) {
  const source = normalizeCalcExpression(rawExpression);
  if (!source || source.length > 160) throw new Error('invalid-expression');
  let index = 0;
  const peek = () => source[index] || '';
  const match = (character) => {
    if (source[index] !== character) return false;
    index += 1;
    return true;
  };
  const parseExpression = () => {
    let value = parseTerm();
    while (index < source.length) {
      if (match('+')) value += parseTerm();
      else if (match('-')) value -= parseTerm();
      else break;
    }
    return value;
  };
  const parseTerm = () => {
    let value = parseUnary();
    while (index < source.length) {
      if (match('*')) value *= parseUnary();
      else if (match('/')) {
        const divisor = parseUnary();
        value = divisor === 0 ? NaN : value / divisor;
      } else break;
    }
    return value;
  };
  const parseUnary = () => {
    if (match('+')) return parseUnary();
    if (match('-')) return -parseUnary();
    return parsePostfix();
  };
  const parsePostfix = () => {
    let value = parsePrimary();
    while (match('%')) value /= 100;
    return value;
  };
  const parsePrimary = () => {
    const character = peek();
    if (match('(')) {
      const value = parseExpression();
      if (!match(')')) throw new Error('missing-parenthesis');
      return value;
    }
    if (/\d|\./.test(character)) {
      const start = index;
      while (/\d|\./.test(peek())) index += 1;
      const numberText = source.slice(start, index);
      if ((numberText.match(/\./g) || []).length > 1) throw new Error('invalid-number');
      const number = Number(numberText);
      if (!Number.isFinite(number)) throw new Error('invalid-number');
      return number;
    }
    throw new Error('unexpected-token');
  };
  const result = parseExpression();
  if (index !== source.length || !Number.isFinite(result)) throw new Error('invalid-result');
  return result;
}

function baseLayerOpacity(value = {}) {
  return normalizePreferences(value).overlays.includes('aero') ? AERO_BASE_OPACITY : 1;
}

function advanceMissionDisplay(incoming, previous = {}, now = Date.now()) {
  const currentAt = Math.max(0, Math.round(finite(now) || 0));
  const lastSnapshot = previous?.lastSnapshot && typeof previous.lastSnapshot === 'object'
    && previous.lastSnapshot.available === true
    && String(previous.lastSnapshot.missionId || '').trim()
    ? previous.lastSnapshot
    : null;
  const lastSeenAt = Math.max(0, Math.round(finite(previous?.lastSeenAt) || 0));
  const emptySince = Math.max(0, Math.round(finite(previous?.emptySince) || 0));
  const source = incoming && typeof incoming === 'object' && !Array.isArray(incoming) ? incoming : null;
  const hasMission = source?.available === true && String(source.missionId || '').trim();

  if (hasMission) {
    return {
      mode: 'mission',
      snapshot: source,
      lastSnapshot: source,
      lastSeenAt: currentAt,
      emptySince: 0
    };
  }

  const withinGapGrace = lastSnapshot
    && lastSeenAt > 0
    && currentAt >= lastSeenAt
    && (currentAt - lastSeenAt) <= MISSION_SNAPSHOT_GAP_GRACE_MS;
  if (withinGapGrace) {
    return {
      mode: 'mission',
      snapshot: lastSnapshot,
      lastSnapshot,
      lastSeenAt,
      emptySince: 0
    };
  }

  if (source?.available === false) {
    const nextEmptySince = emptySince > 0 ? emptySince : currentAt;
    const pending = currentAt >= nextEmptySince
      && (currentAt - nextEmptySince) < MISSION_EMPTY_DEBOUNCE_MS;
    return {
      mode: pending ? 'pending' : 'empty',
      snapshot: null,
      lastSnapshot: pending ? lastSnapshot : null,
      lastSeenAt: pending ? lastSeenAt : 0,
      emptySince: nextEmptySince
    };
  }

  return {
    mode: 'unsupported',
    snapshot: null,
    lastSnapshot: null,
    lastSeenAt: 0,
    emptySince: 0
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
  AERO_BASE_OPACITY,
  BASE_LAYERS,
  DEFAULT_CENTER,
  MISSION_EMPTY_DEBOUNCE_MS,
  MISSION_SNAPSHOT_GAP_GRACE_MS,
  OVERLAY_LAYERS,
  THEMES,
  advanceMissionDisplay,
  baseLayerOpacity,
  formatCoordinateLine,
  formatFlightLine,
  normalizeFlightSnapshot,
  normalizeHeading,
  normalizePreferences,
  normalizeTrackerMapSnapshot,
  evaluateCalculatorExpression
});
