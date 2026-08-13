'use strict';

const MAP_CONTEXT_SCHEMA = 'ga.map-context.v1';
const OPENAIP_SNAPSHOT_URL = 'https://ga-proxy.einherjer.workers.dev/api/openaip/snapshot';
const HOSTED_AVIATION_BASE_URL = 'https://inherjer.github.io/GA-Dispatcher-Aviation-Data/';
const HOSTED_AVIATION_LATEST_URL = `${HOSTED_AVIATION_BASE_URL}latest.json`;
const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation';
const DEFAULT_TIMEOUT_MS = 9000;
const DEFAULT_CACHE_MS = 5 * 60 * 1000;
const MAX_UPSTREAM_BYTES = 12 * 1024 * 1024;
const AVIATION_REGION_GRID_DEG = 0.5;
const HOSTED_CATALOG_CACHE_MS = 60 * 60 * 1000;
const MAX_HOSTED_PACKS = 48;
const RELEVANT_AIRSPACE_TYPES = new Set([0, 1, 2, 3, 4, 5, 6, 7, 26, 27, 28, 33]);

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanText(value, limit = 120) {
  return String(value == null ? '' : value)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function parseTrackerEfbMapContextQuery(searchParams) {
  const lat = finite(searchParams?.get?.('lat'));
  const lon = finite(searchParams?.get?.('lon'));
  if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  const requestedRadius = finite(searchParams?.get?.('radiusNm'));
  const radiusNm = Math.max(0.25, Math.min(12, requestedRadius === null ? 3 : requestedRadius));
  return {
    lat: Math.round(lat * 1000000) / 1000000,
    lon: Math.round(lon * 1000000) / 1000000,
    radiusNm: Math.round(radiusNm * 100) / 100
  };
}

function distanceNm(from, to) {
  const radians = value => value * Math.PI / 180;
  const lat1 = radians(from.lat);
  const lat2 = radians(to.lat);
  const deltaLat = lat2 - lat1;
  const deltaLon = radians(to.lon - from.lon);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 3440.065 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function bearingDeg(from, to) {
  const radians = value => value * Math.PI / 180;
  const lat1 = radians(from.lat);
  const lat2 = radians(to.lat);
  const deltaLon = radians(to.lon - from.lon);
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function contextBounds(request) {
  const latPad = Math.max(0.04, Math.min(0.24, request.radiusNm / 60 + 0.02));
  const cosLat = Math.max(0.25, Math.abs(Math.cos(request.lat * Math.PI / 180)));
  const lonPad = Math.min(0.48, latPad / cosLat);
  return {
    west: Math.max(-180, request.lon - lonPad),
    south: Math.max(-90, request.lat - latPad),
    east: Math.min(180, request.lon + lonPad),
    north: Math.min(90, request.lat + latPad)
  };
}

function fitBoundsRange(center, span, min, max) {
  let low = center - span / 2;
  let high = center + span / 2;
  if (low < min) { high += min - low; low = min; }
  if (high > max) { low -= high - max; high = max; }
  return { low: Math.max(min, low), high: Math.min(max, high) };
}

function stableAviationBounds(request) {
  const exact = contextBounds(request);
  const width = exact.east - exact.west;
  const height = exact.north - exact.south;
  const roundedSpan = value => Math.max(1, Math.ceil((value + 0.5) / AVIATION_REGION_GRID_DEG) * AVIATION_REGION_GRID_DEG);
  const lonSpan = Math.min(3, roundedSpan(width));
  const latSpan = Math.min(3, roundedSpan(height));
  const centerLon = Math.round(request.lon / AVIATION_REGION_GRID_DEG) * AVIATION_REGION_GRID_DEG;
  const centerLat = Math.round(request.lat / AVIATION_REGION_GRID_DEG) * AVIATION_REGION_GRID_DEG;
  let lonRange = fitBoundsRange(centerLon, lonSpan, -180, 180);
  let latRange = fitBoundsRange(centerLat, latSpan, -90, 90);
  if (exact.west < lonRange.low) lonRange = fitBoundsRange(exact.west + lonSpan / 2, lonSpan, -180, 180);
  if (exact.east > lonRange.high) lonRange = fitBoundsRange(exact.east - lonSpan / 2, lonSpan, -180, 180);
  if (exact.south < latRange.low) latRange = fitBoundsRange(exact.south + latSpan / 2, latSpan, -90, 90);
  if (exact.north > latRange.high) latRange = fitBoundsRange(exact.north - latSpan / 2, latSpan, -90, 90);
  return {
    west: Number(lonRange.low.toFixed(3)),
    south: Number(latRange.low.toFixed(3)),
    east: Number(lonRange.high.toFixed(3)),
    north: Number(latRange.high.toFixed(3))
  };
}

function bboxIntersectsBounds(bbox, bounds) {
  return Array.isArray(bbox) && bbox.length === 4
    && bbox.every(value => finite(value) !== null)
    && Number(bbox[0]) <= bounds.east
    && Number(bbox[2]) >= bounds.west
    && Number(bbox[1]) <= bounds.north
    && Number(bbox[3]) >= bounds.south;
}

function pointInRing(lat, lon, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const x1 = finite(ring[index]?.[0]);
    const y1 = finite(ring[index]?.[1]);
    const x2 = finite(ring[previous]?.[0]);
    const y2 = finite(ring[previous]?.[1]);
    if ([x1, y1, x2, y2].some(value => value === null)) continue;
    const crosses = ((y1 > lat) !== (y2 > lat))
      && (lon < ((x2 - x1) * (lat - y1) / (y2 - y1)) + x1);
    if (crosses) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lat, lon, rings) {
  if (!Array.isArray(rings) || !pointInRing(lat, lon, rings[0])) return false;
  for (let index = 1; index < rings.length; index += 1) {
    if (pointInRing(lat, lon, rings[index])) return false;
  }
  return true;
}

function pointInAirspace(airspace, lat, lon) {
  const geometry = airspace?.geometry;
  if (!geometry) return false;
  if (geometry.type === 'Polygon') return pointInPolygon(lat, lon, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') {
    return Array.isArray(geometry.coordinates)
      && geometry.coordinates.some(rings => pointInPolygon(lat, lon, rings));
  }
  return false;
}

function airspaceDescriptor(airspace) {
  const type = finite(airspace?.type);
  const classIndex = finite(airspace?.icaoClass);
  const classLetter = Number.isInteger(classIndex) && classIndex >= 0 && classIndex <= 6 ? 'ABCDEFG'[classIndex] : '';
  const classWord = Number.isInteger(classIndex)
    ? (['ALPHA', 'BRAVO', 'CHARLY', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF'][classIndex] || '')
    : '';
  if (type === 1) return 'ED-R';
  if (type === 2) return 'ED-D';
  if (type === 3) return 'ED-P';
  if (type === 4) return ['CTR', classLetter].filter(Boolean).join(' ');
  if (type === 7) return ['TMA', classWord].filter(Boolean).join(' ');
  if (type === 26) return ['CTA', classWord].filter(Boolean).join(' ');
  if (type === 5 || type === 27) return 'TMZ';
  if (type === 6 || type === 28) return 'RMZ';
  if (type === 33) return 'FIS';
  return classWord || 'LUFTRAUM';
}

function airspacePresentation(type) {
  if (type === 33) return { color: '#22a65a', category: 'FIS' };
  if (type === 3) return { color: '#ef4444', category: 'Prohibited' };
  if (type === 1 || type === 2) return { color: '#f97316', category: 'Restricted / Danger' };
  if (type === 4 || type === 0) return { color: '#3b82f6', category: 'CTR / Airspace' };
  if (type === 7 || type === 26) return { color: '#0ea5e9', category: 'TMA / CTA' };
  if (type === 5 || type === 27) return { color: '#a855f7', category: 'TMZ' };
  if (type === 6 || type === 28) return { color: '#22d3ee', category: 'RMZ' };
  return { color: '#94a3b8', category: 'Luftraum' };
}

function normalizeLimit(limit) {
  const value = finite(limit?.value);
  if (value === null) return null;
  return { value, unit: finite(limit?.unit), referenceDatum: finite(limit?.referenceDatum) };
}

function limitToFt(limit, terrainFt) {
  if (!limit) return null;
  let valueFt = limit.unit === 6 ? limit.value * 100 : (limit.unit === 0 ? limit.value * 3.28084 : limit.value);
  if (limit.referenceDatum === 0) valueFt += Math.max(0, terrainFt || 0);
  return Number.isFinite(valueFt) ? Math.max(0, Math.round(valueFt)) : null;
}

function formatLimit(limit) {
  if (!limit) return '?';
  if (limit.referenceDatum === 0 && limit.value === 0) return 'GND';
  if (limit.unit === 6) return `FL ${Math.round(limit.value)}`;
  const unit = limit.unit === 0 ? 'M' : 'FT';
  const datum = limit.referenceDatum === 1 ? ' MSL' : (limit.referenceDatum === 0 ? ' AGL' : '');
  return `${Math.round(limit.value)} ${unit}${datum}`;
}

function abbreviateFrequencyLabel(value) {
  return cleanText(value || 'FREQ', 40)
    .replace(/FLIGHT INFORMATION SERVICE/ig, 'FIS')
    .replace(/CLEARANCE DELIVERY/ig, 'CLR DEL')
    .replace(/ROLLKONTROLLE|GROUND/ig, 'GND')
    .replace(/TOWER|TURM/ig, 'TWR')
    .replace(/INFORMATION/ig, 'INFO')
    .replace(/APPROACH|ANFLUG/ig, 'APP')
    .replace(/DEPARTURE|ABFLUG/ig, 'DEP')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase() || 'FREQ';
}

function normalizeFrequencies(items, limit = 4) {
  const result = [];
  for (const item of (Array.isArray(items) ? items : [])) {
    if (item == null) continue;
    const value = typeof item === 'object' ? cleanText(item.value, 24) : cleanText(item, 24);
    if (!value) continue;
    const unitCode = finite(typeof item === 'object' ? item.unit : null);
    const unit = unitCode === 1 ? ' kHz' : (unitCode === 2 ? ' MHz' : '');
    const entry = {
      label: abbreviateFrequencyLabel(typeof item === 'object' ? (item.name || item.label) : 'FREQ'),
      value: `${value}${unit}`
    };
    if (!result.some(candidate => candidate.label === entry.label && candidate.value === entry.value)) result.push(entry);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeAirspaces(items, request, terrainFt) {
  const byId = new Map();
  (Array.isArray(items) ? items : []).forEach((airspace, index) => {
    const type = finite(airspace?.type);
    if (!RELEVANT_AIRSPACE_TYPES.has(type) || !pointInAirspace(airspace, request.lat, request.lon)) return;
    const rawName = cleanText(airspace?.name, 100);
    if (type === 0 && finite(airspace?.icaoClass) === 4 && /^(?:ECHO[\s·:_-]*)?AREA$/i.test(rawName)) return;
    const descriptor = airspaceDescriptor(airspace);
    const token = descriptor.split(/\s+/)[0];
    const safeToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cleanedName = rawName.replace(new RegExp(`^${safeToken}[\\s·:_-]*`, 'i'), '').trim();
    const presentation = airspacePresentation(type);
    const lowerLimit = normalizeLimit(airspace?.lowerLimit);
    const upperLimit = normalizeLimit(airspace?.upperLimit);
    const id = cleanText(airspace?._id || airspace?.id || `${rawName}:${type}:${index}`, 140);
    if (!id || byId.has(id)) return;
    const classIndex = finite(airspace?.icaoClass);
    byId.set(id, {
      id,
      name: cleanedName ? `${descriptor} · ${cleanedName}` : descriptor,
      descriptor,
      classLetter: Number.isInteger(classIndex) && classIndex >= 0 && classIndex <= 6 ? 'ABCDEFG'[classIndex] : '',
      type,
      category: presentation.category,
      color: presentation.color,
      lowerLabel: formatLimit(lowerLimit),
      upperLabel: formatLimit(upperLimit),
      lowerFt: limitToFt(lowerLimit, terrainFt),
      upperFt: limitToFt(upperLimit, terrainFt),
      frequencies: normalizeFrequencies(airspace?.frequencies, 3),
      activation: cleanText(
        airspace?.hoursOfOperation || airspace?.operatingHours || airspace?.activation || airspace?.activity
        || (airspace?.byNotam === true ? 'Aktivierung per NOTAM' : '')
        || (/\bHX\b/i.test(rawName) ? 'HX – Aktivierung in AIP/NOTAM prüfen' : ''),
        120
      )
    });
  });
  return [...byId.values()]
    .sort((left, right) => (left.lowerFt ?? Infinity) - (right.lowerFt ?? Infinity) || left.name.localeCompare(right.name, 'de'))
    .slice(0, 8);
}

function coordinatesOf(item) {
  const coordinates = item?.geometry?.coordinates;
  const lat = finite(item?.lat ?? coordinates?.[1]);
  const lon = finite(item?.lon ?? item?.lng ?? coordinates?.[0]);
  return lat === null || lon === null ? null : { lat, lon };
}

function elevationToFt(value) {
  const numeric = finite(value && typeof value === 'object' ? value.value : value);
  if (numeric === null) return null;
  return Math.round(value && typeof value === 'object' && finite(value.unit) === 1 ? numeric : numeric * 3.28084);
}

function reciprocalRunway(designator) {
  const match = cleanText(designator, 4).toUpperCase().match(/^(\d{1,2})([LRC]?)$/);
  if (!match) return '';
  const number = Number(match[1]);
  if (number < 1 || number > 36) return '';
  const side = match[2] === 'L' ? 'R' : (match[2] === 'R' ? 'L' : match[2]);
  return `${String(((number + 17) % 36) + 1).padStart(2, '0')}${side}`;
}

function normalizeRunways(items) {
  const runways = (Array.isArray(items) ? items : []).filter(Boolean);
  const byDesignator = new Map();
  runways.forEach(runway => {
    const designator = cleanText(runway?.designator, 4).toUpperCase();
    if (designator && !byDesignator.has(designator)) byDesignator.set(designator, runway);
  });
  const used = new Set();
  const result = [];
  runways.forEach((runway, index) => {
    const designator = cleanText(runway?.designator, 4).toUpperCase();
    const key = designator || `index:${index}`;
    if (used.has(key)) return;
    const reciprocal = reciprocalRunway(designator);
    const other = reciprocal ? byDesignator.get(reciprocal) : null;
    used.add(key);
    if (other) used.add(reciprocal);
    const length = finite(runway?.dimension?.length?.value ?? other?.dimension?.length?.value);
    const unit = finite(runway?.dimension?.length?.unit ?? other?.dimension?.length?.unit);
    const surface = cleanText(
      runway?.surface?.name || runway?.surface?.label || runway?.surface?.compositionName
      || other?.surface?.name || other?.surface?.label || other?.surface?.compositionName,
      40
    );
    result.push({
      designator: other ? `${designator}/${reciprocal}` : (designator || 'Piste'),
      lengthM: length === null ? null : Math.round(unit === 1 ? length * 0.3048 : length),
      surface
    });
  });
  return result.slice(0, 4);
}

function normalizeAirport(item) {
  const position = coordinatesOf(item);
  if (!position) return null;
  const icao = cleanText(item?.icaoCode || item?.icao || item?.designator, 12).toUpperCase();
  const country = cleanText(item?.country || item?.countryCode || item?.isoCountry, 8).toUpperCase();
  const id = cleanText(item?._id || item?.id || icao || `${position.lat},${position.lon}`, 140);
  return {
    id: `airport:${id}`,
    kind: 'airport',
    kindLabel: 'FLUGPLATZ',
    icao,
    country,
    name: cleanText(item?.name || icao || 'Flugplatz', 100),
    lat: position.lat,
    lon: position.lon,
    elevationFt: elevationToFt(item?.elevation),
    frequencies: normalizeFrequencies(item?.frequencies, 4),
    runways: normalizeRunways(item?.runways)
  };
}

function normalizeNavaid(item) {
  const position = coordinatesOf(item);
  if (!position) return null;
  const identifier = cleanText(item?.identifier || item?.designator, 16).toUpperCase();
  const id = cleanText(item?._id || item?.id || identifier || `${position.lat},${position.lon}`, 140);
  const typeLabels = { 0: 'DME', 1: 'TACAN', 2: 'NDB', 3: 'VOR', 4: 'VOR/DME', 5: 'VORTAC', 6: 'DVOR', 7: 'DVOR/DME', 8: 'DVORTAC' };
  return {
    id: `navaid:${id}`,
    kind: 'navaid',
    kindLabel: 'NAVAID',
    identifier,
    name: cleanText(item?.name || identifier || 'Funkfeuer', 100),
    typeLabel: typeLabels[finite(item?.type)] || 'Funkfeuer',
    lat: position.lat,
    lon: position.lon,
    elevationFt: elevationToFt(item?.elevation),
    frequencies: normalizeFrequencies(item?.frequency != null ? [item.frequency] : item?.frequencies, 2),
    channel: cleanText(item?.channel, 20).toUpperCase()
  };
}

function normalizeReportingPoint(item) {
  const position = coordinatesOf(item);
  if (!position) return null;
  const id = cleanText(item?._id || item?.id || `${position.lat},${position.lon}`, 140);
  return {
    id: `vrp:${id}`,
    kind: 'vrp',
    kindLabel: 'VRP · VFR-MELDEPUNKT',
    name: cleanText(item?.name || 'VFR-Meldepunkt', 100).replace(/^RPP\s+/i, ''),
    airportIcao: cleanText(item?.airportIcao, 12).toUpperCase(),
    description: cleanText(item?.description, 180),
    lat: position.lat,
    lon: position.lon,
    elevationFt: null,
    frequencies: [],
    runways: []
  };
}

function nearestFeature(payload, request) {
  const candidates = [];
  (Array.isArray(payload?.airports) ? payload.airports : []).forEach(item => candidates.push(normalizeAirport(item)));
  (Array.isArray(payload?.navaids) ? payload.navaids : []).forEach(item => candidates.push(normalizeNavaid(item)));
  (Array.isArray(payload?.reportingPoints) ? payload.reportingPoints : []).forEach(item => candidates.push(normalizeReportingPoint(item)));
  const origin = { lat: request.lat, lon: request.lon };
  return candidates
    .filter(Boolean)
    .map(feature => ({
      ...feature,
      distanceNm: Math.round(distanceNm(origin, feature) * 100) / 100,
      bearingDeg: Math.round(bearingDeg(origin, feature))
    }))
    .filter(feature => feature.distanceNm <= request.radiusNm)
    .sort((left, right) => left.distanceNm - right.distanceNm)[0] || null;
}

function hourlyValue(hourly, key, index) {
  return finite(hourly?.[key]?.[index]);
}

function normalizeWeather(payload) {
  const hourly = payload?.hourly;
  if (!hourly || !Array.isArray(hourly.time) || !hourly.time.length) return null;
  let bestIndex = 0;
  let bestDelta = Infinity;
  hourly.time.forEach((value, index) => {
    const delta = Math.abs(Number(value) - Date.now() / 1000);
    if (delta < bestDelta) { bestIndex = index; bestDelta = delta; }
  });
  const low = hourlyValue(hourly, 'cloud_cover_low', bestIndex);
  const mid = hourlyValue(hourly, 'cloud_cover_mid', bestIndex);
  const high = hourlyValue(hourly, 'cloud_cover_high', bestIndex);
  return {
    observedAt: Math.round(Number(hourly.time[bestIndex]) * 1000),
    cloudTotalPct: hourlyValue(hourly, 'cloud_cover', bestIndex) ?? Math.max(low || 0, mid || 0, high || 0),
    cloudLowPct: low,
    cloudMidPct: mid,
    cloudHighPct: high,
    precipitationMm: hourlyValue(hourly, 'precipitation', bestIndex),
    rainMm: hourlyValue(hourly, 'rain', bestIndex),
    snowfallCm: hourlyValue(hourly, 'snowfall', bestIndex),
    wspd: hourlyValue(hourly, 'wind_speed_10m', bestIndex),
    wdir: hourlyValue(hourly, 'wind_direction_10m', bestIndex),
    temp2mC: hourlyValue(hourly, 'temperature_2m', bestIndex),
    dewPoint2mC: hourlyValue(hourly, 'dew_point_2m', bestIndex),
    rh2mPct: hourlyValue(hourly, 'relative_humidity_2m', bestIndex),
    visibilityM: hourlyValue(hourly, 'visibility', bestIndex),
    pressureMslHpa: hourlyValue(hourly, 'pressure_msl', bestIndex),
    weatherCode: hourlyValue(hourly, 'weather_code', bestIndex)
  };
}

function estimatedCloud(weather, terrainFt) {
  if (!weather) return null;
  const coverage = Math.max(0, Math.min(100, finite(weather.cloudTotalPct) || 0));
  if (coverage < 12) return null;
  const temp = finite(weather.temp2mC);
  const dew = finite(weather.dewPoint2mC);
  const baseAgl = temp === null || dew === null ? 2500 : Math.max(300, Math.min(12000, (temp - dew) * 400));
  const type = coverage >= 92 ? 'OVC' : (coverage >= 63 ? 'BKN' : (coverage >= 32 ? 'SCT' : 'FEW'));
  const thickness = type === 'OVC' ? 5200 : (type === 'BKN' ? 3200 : (type === 'SCT' ? 1700 : 900));
  const baseFt = Math.round(Math.max(0, terrainFt || 0) + baseAgl);
  return { type, coveragePct: Math.round(coverage), baseFt, topFt: Math.round(baseFt + thickness) };
}

function elevationFromPayload(payload) {
  const value = Array.isArray(payload?.elevation) ? finite(payload.elevation[0]) : finite(payload?.elevation);
  return value === null ? null : Math.round(value * 3.28084);
}

function buildAviationUrl(request) {
  const bounds = stableAviationBounds(request);
  const bbox = [bounds.west, bounds.south, bounds.east, bounds.north].map(value => value.toFixed(3)).join(',');
  return `${OPENAIP_SNAPSHOT_URL}?bbox=${encodeURIComponent(bbox)}`;
}

function buildElevationUrl(request) {
  return `${OPEN_METEO_ELEVATION_URL}?latitude=${encodeURIComponent(request.lat)}&longitude=${encodeURIComponent(request.lon)}`;
}

function buildForecastUrl(request) {
  const hourly = [
    'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high',
    'precipitation', 'rain', 'snowfall', 'wind_speed_10m', 'wind_direction_10m',
    'temperature_2m', 'dew_point_2m', 'relative_humidity_2m', 'visibility', 'pressure_msl', 'weather_code'
  ].join(',');
  const params = new URLSearchParams({
    latitude: String(request.lat), longitude: String(request.lon), hourly,
    forecast_hours: '6', models: 'best_match', wind_speed_unit: 'kn', timeformat: 'unixtime', timezone: 'UTC'
  });
  return `${OPEN_METEO_FORECAST_URL}?${params}`;
}

function createTrackerEfbMapContextProvider(options = {}) {
  const fetchRemote = typeof options.fetchRemote === 'function' ? options.fetchRemote : globalThis.fetch;
  if (typeof fetchRemote !== 'function') throw new Error('Der EFB-Kartenkontext benoetigt eine Fetch-Implementierung.');
  const log = typeof options.log === 'function' ? options.log : () => {};
  const timeoutMs = Math.max(1500, Math.min(20000, Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS));
  const cacheMs = Math.max(30000, Math.min(60 * 60 * 1000, Number(options.cacheMs) || DEFAULT_CACHE_MS));
  const cache = new Map();
  const inflight = new Map();
  const hostedPackCache = new Map();
  let hostedCatalog = null;
  let hostedCatalogStoredAt = 0;

  function touch(key, value) {
    cache.delete(key);
    cache.set(key, value);
    while (cache.size > 64) cache.delete(cache.keys().next().value);
  }

  async function fetchJson(url, source) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const response = await fetchRemote(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'VFR-Multitool-Tracker-EFB/1.0' },
        redirect: 'follow', signal: controller?.signal
      });
      if (!response || response.ok !== true) throw new Error(`${source}_http_${Number(response?.status) || 0}`);
      const declaredLength = finite(response.headers?.get?.('content-length'));
      if (declaredLength !== null && declaredLength > MAX_UPSTREAM_BYTES) throw new Error(`${source}_payload_too_large`);
      const body = await response.text();
      if (Buffer.byteLength(body, 'utf8') > MAX_UPSTREAM_BYTES) throw new Error(`${source}_payload_too_large`);
      return JSON.parse(body);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function loadHostedCatalog() {
    if (hostedCatalog && Date.now() - hostedCatalogStoredAt < HOSTED_CATALOG_CACHE_MS) return hostedCatalog;
    const latest = await fetchJson(HOSTED_AVIATION_LATEST_URL, 'aviation_hosted_latest');
    const datasetVersion = cleanText(latest?.datasetVersion, 80);
    const manifestPath = cleanText(latest?.manifest, 180);
    if (!datasetVersion || !/^cycles\/[^/]+\/manifest\.json$/.test(manifestPath)) {
      throw new Error('aviation_hosted_latest_invalid');
    }
    const manifestUrl = new URL(manifestPath, HOSTED_AVIATION_BASE_URL).href;
    if (!manifestUrl.startsWith(HOSTED_AVIATION_BASE_URL)) throw new Error('aviation_hosted_manifest_url_invalid');
    const manifest = await fetchJson(manifestUrl, 'aviation_hosted_manifest');
    if (cleanText(manifest?.datasetVersion, 80) !== datasetVersion || manifest?.source?.name !== 'OpenAIP') {
      throw new Error('aviation_hosted_manifest_invalid');
    }
    hostedCatalog = { datasetVersion, manifestUrl, manifest };
    hostedCatalogStoredAt = Date.now();
    return hostedCatalog;
  }

  async function loadHostedPack(catalog, collection, entry) {
    const relativeUrl = cleanText(entry?.url, 180);
    if (!relativeUrl || relativeUrl.includes('..') || relativeUrl.startsWith('/')) {
      throw new Error('aviation_hosted_pack_url_invalid');
    }
    const key = `${catalog.datasetVersion}:${relativeUrl}`;
    if (hostedPackCache.has(key)) return hostedPackCache.get(key);
    const baseUrl = new URL('./', catalog.manifestUrl).href;
    const packUrl = new URL(relativeUrl, baseUrl).href;
    if (!packUrl.startsWith(baseUrl)) throw new Error('aviation_hosted_pack_url_invalid');
    const pending = fetchJson(packUrl, `aviation_hosted_${collection}`).then(pack => {
      if (pack?.collection !== collection || !Array.isArray(pack?.items)) {
        throw new Error(`aviation_hosted_${collection}_pack_invalid`);
      }
      return pack;
    }).catch(error => {
      hostedPackCache.delete(key);
      throw error;
    });
    hostedPackCache.set(key, pending);
    while (hostedPackCache.size > 64) hostedPackCache.delete(hostedPackCache.keys().next().value);
    return pending;
  }

  async function loadHostedAviation(request) {
    if (typeof options.loadHostedAviation === 'function') return options.loadHostedAviation(request);
    const coverage = stableAviationBounds(request);
    const exact = contextBounds(request);
    const catalog = await loadHostedCatalog();
    const collections = ['airspaces', 'airports', 'navaids', 'reportingPoints'];
    const selected = [];
    collections.forEach(collection => {
      const packs = catalog.manifest?.collections?.[collection]?.packs;
      if (!Array.isArray(packs)) throw new Error(`aviation_hosted_${collection}_index_invalid`);
      packs.forEach(entry => {
        if (bboxIntersectsBounds(entry?.bbox, coverage)) selected.push({ collection, entry });
      });
    });
    if (selected.length > MAX_HOSTED_PACKS) throw new Error(`aviation_hosted_pack_selection_too_large:${selected.length}`);
    const packs = await Promise.all(selected.map(item => loadHostedPack(catalog, item.collection, item.entry)
      .then(pack => ({ collection: item.collection, pack }))));
    const payload = { airspaces: [], airports: [], navaids: [], reportingPoints: [] };
    packs.forEach(item => {
      item.pack.items.forEach(raw => {
        if (!raw?.bbox || bboxIntersectsBounds(raw.bbox, exact)) payload[item.collection].push(raw);
      });
    });
    payload.meta = { source: 'hosted', datasetVersion: catalog.datasetVersion };
    return payload;
  }

  async function loadAviation(request) {
    if (options.hostedAviation !== false) {
      try {
        return { payload: await loadHostedAviation(request), name: 'GA Aviation DB', mode: 'hosted', fallbackReason: '' };
      } catch (error) {
        const fallbackReason = cleanText(error?.message || error, 100);
        const payload = await fetchJson(buildAviationUrl(request), 'aviation_region_cache');
        return { payload, name: 'OpenAIP Region-Cache', mode: 'region-cache', fallbackReason };
      }
    }
    return {
      payload: await fetchJson(buildAviationUrl(request), 'aviation_region_cache'),
      name: 'OpenAIP Region-Cache',
      mode: 'region-cache',
      fallbackReason: ''
    };
  }

  async function timed(promise) {
    const startedAt = Date.now();
    const value = await promise;
    return { value, durationMs: Date.now() - startedAt };
  }

  async function load(request) {
    const startedAt = Date.now();
    const results = await Promise.allSettled([
      timed(loadAviation(request)),
      timed(fetchJson(buildElevationUrl(request), 'terrain')),
      timed(fetchJson(buildForecastUrl(request), 'weather'))
    ]);
    const aviationResult = results[0].status === 'fulfilled' ? results[0].value.value : null;
    const aviation = aviationResult?.payload || null;
    const terrainFt = results[1].status === 'fulfilled' ? elevationFromPayload(results[1].value.value) : null;
    const weather = results[2].status === 'fulfilled' ? normalizeWeather(results[2].value.value) : null;
    const airspaces = aviation ? normalizeAirspaces(aviation.airspaces, request, terrainFt) : [];
    const feature = aviation ? nearestFeature(aviation, request) : null;
    const errors = results.map((result, index) => result.status === 'rejected'
      ? `${['aviation', 'terrain', 'weather'][index]}:${cleanText(result.reason?.message || result.reason, 80)}`
      : '').filter(Boolean);
    const payload = {
      schema: MAP_CONTEXT_SCHEMA,
      version: 1,
      available: true,
      position: { lat: request.lat, lon: request.lon },
      radiusNm: request.radiusNm,
      terrainFt,
      currentAltitudeFt: finite(options.getCurrentAltitudeFt?.()),
      airspaces,
      feature,
      weather,
      cloud: estimatedCloud(weather, terrainFt),
      sources: {
        aviation: {
          available: results[0].status === 'fulfilled',
          name: aviationResult?.name || 'OpenAIP',
          mode: aviationResult?.mode || 'unavailable',
          durationMs: results[0].status === 'fulfilled' ? results[0].value.durationMs : null,
          fallbackReason: aviationResult?.fallbackReason || ''
        },
        terrain: {
          available: results[1].status === 'fulfilled',
          name: 'Open-Meteo Elevation',
          durationMs: results[1].status === 'fulfilled' ? results[1].value.durationMs : null
        },
        weather: {
          available: results[2].status === 'fulfilled',
          name: 'Open-Meteo',
          durationMs: results[2].status === 'fulfilled' ? results[2].value.durationMs : null
        }
      },
      errors,
      fetchedAt: Date.now()
    };
    log(`EFB_MAP_CONTEXT lat=${request.lat.toFixed(5)} lon=${request.lon.toFixed(5)} airspaces=${airspaces.length} feature=${feature?.kind || 'none'} aviation=${payload.sources.aviation.mode} aviationMs=${payload.sources.aviation.durationMs ?? -1} terrainMs=${payload.sources.terrain.durationMs ?? -1} weatherMs=${payload.sources.weather.durationMs ?? -1} partial=${errors.length ? 1 : 0} ms=${Date.now() - startedAt}`);
    return payload;
  }

  async function get(request) {
    const key = `${request.lat.toFixed(5)},${request.lon.toFixed(5)},${request.radiusNm.toFixed(2)}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.storedAt < cacheMs) {
      touch(key, cached);
      return { ...cached.payload, cache: 'hit' };
    }
    if (inflight.has(key)) return inflight.get(key);
    const pending = load(request).then(payload => {
      touch(key, { payload, storedAt: Date.now() });
      return { ...payload, cache: 'miss' };
    }).finally(() => inflight.delete(key));
    inflight.set(key, pending);
    return pending;
  }

  return { get, get cacheSize() { return cache.size; } };
}

module.exports = {
  MAP_CONTEXT_SCHEMA,
  OPENAIP_SNAPSHOT_URL,
  HOSTED_AVIATION_LATEST_URL,
  OPEN_METEO_ELEVATION_URL,
  OPEN_METEO_FORECAST_URL,
  createTrackerEfbMapContextProvider,
  parseTrackerEfbMapContextQuery,
  stableAviationBounds
};
