// Shared standalone popup implementation; host adapters supply local data only.
const MAP_CONTEXT_LONG_PRESS_MS = 650;
const MAP_CONTEXT_MOVE_TOLERANCE_PX = 12;
const MAP_CONTEXT_RELEVANT_AIRSPACE_TYPES = new Set([0, 1, 2, 3, 4, 5, 6, 7, 26, 27, 28, 33]);
let mapContextPressState = null;
let mapContextSuppressClickUntil = 0;
let mapContextLastOpen = { at: 0, lat: NaN, lon: NaN };
let mapContextRequestSeq = 0;
let mapContextInfoState = null;
let mapContextPopupLayer = null;
let mapContextPointLayer = null;
let mapContextAirspaceHighlightLayer = null;
let mapContextObjectHighlightLayer = null;

function clearMapContextPress() {
    if (mapContextPressState?.timer) clearTimeout(mapContextPressState.timer);
    mapContextPressState = null;
}

function clearMapContextPointLayer() {
    if (map && mapContextPointLayer && map.hasLayer(mapContextPointLayer)) {
        map.removeLayer(mapContextPointLayer);
    }
    mapContextPointLayer = null;
}

function clearMapContextAirspaceHighlight() {
    if (map && mapContextAirspaceHighlightLayer && map.hasLayer(mapContextAirspaceHighlightLayer)) {
        map.removeLayer(mapContextAirspaceHighlightLayer);
    }
    mapContextAirspaceHighlightLayer = null;
}

function clearMapContextObjectHighlight() {
    if (map && mapContextObjectHighlightLayer && map.hasLayer(mapContextObjectHighlightLayer)) {
        map.removeLayer(mapContextObjectHighlightLayer);
    }
    mapContextObjectHighlightLayer = null;
}

function dismissMapContextInfo({ closePopup = false, clearHighlight = true } = {}) {
    mapContextRequestSeq += 1;
    mapContextInfoState = null;
    clearMapContextPress();
    clearMapContextPointLayer();
    if (clearHighlight) {
        clearMapContextAirspaceHighlight();
        clearMapContextObjectHighlight();
    }
    if (closePopup && map && mapContextPopupLayer) {
        map.closePopup(mapContextPopupLayer);
    }
}

function mapContextPointInRing(lat, lon, ring) {
    if (!Array.isArray(ring) || ring.length < 3) return false;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = Number(ring[i]?.[0]);
        const yi = Number(ring[i]?.[1]);
        const xj = Number(ring[j]?.[0]);
        const yj = Number(ring[j]?.[1]);
        if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
        const crosses = ((yi > lat) !== (yj > lat))
            && (lon < ((xj - xi) * (lat - yi) / (yj - yi)) + xi);
        if (crosses) inside = !inside;
    }
    return inside;
}

function mapContextPointInPolygon(lat, lon, rings) {
    if (!Array.isArray(rings) || !mapContextPointInRing(lat, lon, rings[0])) return false;
    for (let i = 1; i < rings.length; i += 1) {
        if (mapContextPointInRing(lat, lon, rings[i])) return false;
    }
    return true;
}

function mapContextPointInAirspace(airspace, lat, lon) {
    const geometry = airspace?.geometry;
    if (!geometry) return false;
    if (geometry.type === 'Polygon') {
        return mapContextPointInPolygon(lat, lon, geometry.coordinates);
    }
    if (geometry.type === 'MultiPolygon') {
        return geometry.coordinates.some(rings => mapContextPointInPolygon(lat, lon, rings));
    }
    return false;
}

function getMapContextAirspaceId(airspace, fallbackIndex = 0) {
    return String(
        airspace?._id
        || airspace?.id
        || `${airspace?.name || 'airspace'}:${airspace?.type ?? 'x'}:${fallbackIndex}`
    );
}

function mapContextAirspaceStyle(airspace) {
    if (typeof getAirspaceStyle === 'function') {
        try {
            const style = getAirspaceStyle(airspace);
            if (style) {
                const currentColor = String(style.mapColor || style.color || '').toLowerCase();
                const type = Number(airspace?.type);
                const grayPalette = new Set(['#888', '#888888', '#aaa', '#aaaaaa', '#94a3b8']);
                if (grayPalette.has(currentColor)) {
                    const contextualColor = type === 33
                        ? '#22a65a'
                        : (type === 0 || type === 4 ? '#3b82f6' : '#64748b');
                    return { ...style, color: contextualColor, mapColor: contextualColor };
                }
                return style;
            }
        } catch (_) {}
    }
    const type = Number(airspace?.type);
    if (type === 33) return { color: '#22a65a', mapColor: '#22a65a', icon: '📡', category: 'FIS' };
    if (type === 3) return { color: '#ef4444', mapColor: '#ef4444', icon: '⛔', category: 'Prohibited' };
    if (type === 1 || type === 2) return { color: '#f97316', mapColor: '#f97316', icon: '⛔', category: 'Restricted / Danger' };
    if (type === 4 || type === 0) return { color: '#3b82f6', mapColor: '#3b82f6', icon: '⚠️', category: 'CTR / Airspace' };
    if (type === 7 || type === 26) return { color: '#0ea5e9', mapColor: '#0ea5e9', icon: '⚠️', category: 'TMA / CTA' };
    if (type === 5 || type === 27) return { color: '#a855f7', mapColor: '#a855f7', icon: '📡', category: 'TMZ' };
    if (type === 6 || type === 28) return { color: '#22d3ee', mapColor: '#22d3ee', icon: '📡', category: 'RMZ' };
    return { color: '#94a3b8', mapColor: '#94a3b8', icon: '◈', category: 'Luftraum' };
}

function getMapContextAirspaceDescriptor(airspace) {
    const type = Number(airspace?.type);
    const rawClass = airspace?.icaoClass;
    const classIndex = rawClass === null || rawClass === undefined || rawClass === ''
        ? NaN
        : Number(rawClass);
    const classWords = ['ALPHA', 'BRAVO', 'CHARLY', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF'];
    const classWord = Number.isInteger(classIndex) ? (classWords[classIndex] || '') : '';
    const classLetter = Number.isInteger(classIndex) && classIndex >= 0 && classIndex <= 6
        ? 'ABCDEFG'[classIndex]
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

function getMapContextAirspaceDisplayTitle(airspace) {
    const descriptor = getMapContextAirspaceDescriptor(airspace);
    const rawName = String(airspace?.name || '').trim();
    if (!rawName) return descriptor;
    const typeToken = descriptor.split(/\s+/)[0];
    const typePrefix = new RegExp(`^${typeToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s·:_-]*`, 'i');
    const cleanedName = rawName.replace(typePrefix, '').trim();
    return cleanedName ? `${descriptor} · ${cleanedName}` : descriptor;
}

function isMapContextGenericEchoArea(airspace) {
    const rawName = String(airspace?.name || '').trim();
    return Number(airspace?.type) === 0
        && Number(airspace?.icaoClass) === 4
        && /^(?:ECHO[\s·:_-]*)?AREA$/i.test(rawName);
}

function getMapContextAirspaceClassLetter(airspace) {
    const rawClass = airspace?.icaoClass;
    if (rawClass === null || rawClass === undefined || rawClass === '') return '';
    const classIndex = Number(rawClass);
    return Number.isInteger(classIndex) && classIndex >= 0 && classIndex <= 6
        ? 'ABCDEFG'[classIndex]
        : '';
}

function mapContextFormatLimit(limit) {
    if (!limit) return '?';
    if (typeof window.formatAsLimit === 'function') {
        try { return window.formatAsLimit(limit); } catch (_) {}
    }
    const value = Number(limit.value);
    if (limit.referenceDatum === 0 && value === 0) return 'GND';
    if (Number(limit.unit) === 6) return `FL ${value}`;
    const unit = Number(limit.unit) === 1 ? 'FT' : 'M';
    const datum = limit.referenceDatum === 1 ? ' MSL' : (limit.referenceDatum === 0 ? ' AGL' : '');
    return `${value} ${unit}${datum}`;
}

function mapContextLimitToFt(limit) {
    if (!limit) return Infinity;
    const value = Number(limit.value);
    if (!Number.isFinite(value)) return Infinity;
    if (Number(limit.unit) === 6) return value * 100;
    if (Number(limit.unit) === 0) return value * 3.28084;
    return value;
}

function mapContextAirspaceFrequencyText(airspace) {
    const frequencies = Array.isArray(airspace?.frequencies) ? airspace.frequencies : [];
    const values = frequencies
        .filter(item => item && item.value !== undefined && item.value !== null && item.value !== '')
        .map((item) => {
            const name = String(item.name || item.label || 'Frequenz').trim();
            const unitCode = Number(item.unit);
            const unit = unitCode === 1 ? ' kHz' : (unitCode === 2 ? ' MHz' : '');
            return {
                label: abbreviateMapFrequencyLabel(name),
                value: `${item.value}${unit}`
            };
        });
    return values
        .filter((item, index, items) => (
            items.findIndex(candidate => (
                candidate.label === item.label
                && candidate.value === item.value
            )) === index
        ))
        .slice(0, 3);
}

function mapContextAirspaceActivationText(airspace) {
    const candidates = [
        airspace?.hoursOfOperation,
        airspace?.operatingHours,
        airspace?.activation,
        airspace?.activity
    ];
    const explicit = candidates.find(value => typeof value === 'string' && value.trim());
    if (explicit) return explicit.trim();
    if (airspace?.byNotam === true) return 'Aktivierung per NOTAM';
    if (/\bHX\b/i.test(String(airspace?.name || ''))) return 'HX – Aktivierung in AIP/NOTAM prüfen';
    return '';
}

function normalizeMapContextAirspaces(items, latlng) {
    const byId = new Map();
    (Array.isArray(items) ? items : []).forEach((airspace, index) => {
        if (!airspace?.geometry || !MAP_CONTEXT_RELEVANT_AIRSPACE_TYPES.has(Number(airspace.type))) return;
        if (isMapContextGenericEchoArea(airspace)) return;
        if (!mapContextPointInAirspace(airspace, latlng.lat, latlng.lng)) return;
        const normalized = {
            ...airspace,
            lowerLimit: airspace.lowerLimit ? { ...airspace.lowerLimit } : null,
            upperLimit: airspace.upperLimit ? { ...airspace.upperLimit } : null
        };
        if (typeof applyAirspaceLimitHeuristics === 'function') {
            try { applyAirspaceLimitHeuristics(normalized); } catch (_) {}
        }
        const id = getMapContextAirspaceId(normalized, index);
        if (!byId.has(id)) {
            normalized.__mapContextId = id;
            byId.set(id, normalized);
        }
    });
    return [...byId.values()].sort((a, b) => {
        const lowerDelta = mapContextLimitToFt(a.lowerLimit) - mapContextLimitToFt(b.lowerLimit);
        if (Number.isFinite(lowerDelta) && lowerDelta !== 0) return lowerDelta;
        return String(a.name || '').localeCompare(String(b.name || ''), 'de');
    });
}

function getMapContextQueryBounds(latlng, latPad = 0.025) {
    const lonPad = latPad / Math.max(0.25, Math.cos((latlng.lat * Math.PI) / 180));
    return {
        west: Math.max(-180, latlng.lng - lonPad),
        south: Math.max(-90, latlng.lat - latPad),
        east: Math.min(180, latlng.lng + lonPad),
        north: Math.min(90, latlng.lat + latPad)
    };
}

async function fetchMapContextAirspaces(latlng) {
    const bounds = getMapContextQueryBounds(latlng);
    let items = null;
    if (
        (!window.gaMapContextHost && typeof openAipRegionState !== 'undefined' && openAipRegionState.payload)
        && openAipCoverageContainsBounds(openAipRegionState.coverage, bounds)
        && isOpenAipSnapshotCollectionAvailable((typeof openAipRegionState !== 'undefined' && openAipRegionState.payload), 'airspaces')
    ) {
        items = (typeof openAipRegionState !== 'undefined' && openAipRegionState.payload).airspaces;
    } else if (typeof window.gaGetAviationCollectionForBounds === 'function') {
        items = await window.gaGetAviationCollectionForBounds('airspaces', bounds);
    }
    return normalizeMapContextAirspaces(items, latlng);
}

function mapContextElevationToFt(elevation) {
    if (elevation == null) return null;
    const value = Number(elevation?.value ?? elevation);
    if (!Number.isFinite(value)) return null;
    return Number(elevation?.unit) === 1 ? value : value * 3.28084;
}

function getMapContextAirportFrequencies(airport, icao) {
    const direct = Array.isArray(airport?.frequencies) ? airport.frequencies : [];
    const cached = (
        typeof freqCache !== 'undefined'
        && Array.isArray(freqCache?.[icao])
    ) ? freqCache[icao] : [];
    return [...direct, ...cached]
        .map((entry) => {
            if (entry === null || entry === undefined) return '';
            if (typeof entry !== 'object') return String(entry).trim();
            const name = String(entry.name || entry.label || 'Freq').trim();
            const value = String(entry.value ?? '').trim();
            if (!value) return '';
            const unitCode = Number(entry.unit);
            const unit = unitCode === 1 ? ' kHz' : (unitCode === 2 ? ' MHz' : '');
            return `${abbreviateMapFrequencyLabel(name)}: ${value}${unit}`;
        })
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
        .slice(0, 4);
}

function normalizeMapContextAirportFeature(airport) {
    if (!airport) return null;
    const raw = airport?.airportData && typeof airport.airportData === 'object'
        ? airport.airportData
        : airport;
    const coords = raw?.geometry?.coordinates;
    const lat = Number(raw?.lat ?? airport?.lat ?? coords?.[1]);
    const lon = Number(raw?.lon ?? raw?.lng ?? airport?.lon ?? airport?.lng ?? coords?.[0]);
    if (![lat, lon].every(Number.isFinite)) return null;
    const icao = String(
        raw?.icaoCode
        || raw?.icao
        || raw?.designator
        || airport?.icao
        || airport?.airportIcao
        || ''
    ).trim().toUpperCase();
    const name = String(raw?.name || airport?.name || airport?.airportName || icao || 'Flugplatz').trim();
    const sourceId = String(raw?._id || raw?.id || airport?.sourceId || '').trim();
    const country = String(
        raw?.country
        || raw?.countryCode
        || raw?.isoCountry
        || airport?.country
        || ''
    ).trim().toUpperCase();
    const elevationFt = mapContextElevationToFt(raw?.elevation ?? airport?.elevation);
    let runways = typeof formatOpenAipAirportRunways === 'function'
        ? formatOpenAipAirportRunways(raw)
        : '';
    if (!runways && icao && typeof runwayCache !== 'undefined') {
        const cached = String(runwayCache?.[icao] || '').trim();
        if (cached && cached !== 'Keine Daten gefunden') runways = cached;
    }
    return {
        id: `airport:${sourceId || icao || `${lat.toFixed(5)},${lon.toFixed(5)}`}`,
        kind: 'airport',
        sourceId,
        icao,
        name,
        country,
        lat,
        lon,
        elevationFt: Number.isFinite(elevationFt) ? Math.round(elevationFt) : null,
        frequencies: getMapContextAirportFrequencies(raw, icao),
        runways: String(runways || '').split(/\s*(?:\||\n|<br\s*\/?>)\s*/i).filter(Boolean).slice(0, 3)
    };
}

function normalizeMapContextNavaidFeature(navaid) {
    const nav = typeof normalizeOpenAipNavaidForPopup === 'function'
        ? normalizeOpenAipNavaidForPopup(navaid)
        : null;
    if (!nav) return null;
    const raw = navaid?.navaidData && typeof navaid.navaidData === 'object'
        ? navaid.navaidData
        : navaid;
    const elevationFt = mapContextElevationToFt(raw?.elevation);
    return {
        id: `navaid:${nav.id || `${nav.lat.toFixed(5)},${nav.lon.toFixed(5)}`}`,
        kind: 'navaid',
        sourceId: nav.id,
        identifier: nav.identifier,
        name: nav.name,
        typeLabel: getOpenAipNavaidTypeLabel(nav.type),
        lat: nav.lat,
        lon: nav.lon,
        elevationFt: Number.isFinite(elevationFt) ? Math.round(elevationFt) : null,
        frequencies: nav.frequencyValue
            ? [`${nav.frequencyValue}${nav.frequencyUnit ? ` ${nav.frequencyUnit}` : ''}`]
            : [],
        channel: nav.channel,
        range: nav.rangeValue
            ? `${nav.rangeValue}${nav.rangeUnit ? ` ${nav.rangeUnit}` : ''}`
            : ''
    };
}

function normalizeMapContextReportingPointFeature(point) {
    if (!point) return null;
    const raw = point?.rppData && typeof point.rppData === 'object'
        ? point.rppData
        : point;
    const coords = raw?.geometry?.coordinates;
    const lat = Number(raw?.lat ?? point?.lat ?? coords?.[1]);
    const lon = Number(raw?.lon ?? raw?.lng ?? point?.lon ?? point?.lng ?? coords?.[0]);
    if (![lat, lon].every(Number.isFinite)) return null;
    const name = String(raw?.name || point?.name || 'VFR-Meldepunkt')
        .replace(/^RPP\s+/i, '')
        .trim();
    const airportIcao = String(
        raw?.airportIcao
        || point?.rppAirportIcao
        || (typeof extractRppAirportIcao === 'function' ? extractRppAirportIcao(raw) : '')
        || ''
    ).trim().toUpperCase();
    const sourceId = String(raw?._id || raw?.id || point?.sourceId || '').trim();
    return {
        id: `vrp:${sourceId || `${lat.toFixed(5)},${lon.toFixed(5)}`}`,
        kind: 'vrp',
        sourceId,
        name: name || 'VFR-Meldepunkt',
        airportIcao,
        description: String(raw?.description || '').trim(),
        lat,
        lon,
        elevationFt: null
    };
}

function getMapContextFeatureDistancePx(feature, latlng) {
    if (!map || !feature) return Infinity;
    const point = map.latLngToLayerPoint([feature.lat, feature.lon]);
    return point.distanceTo(map.latLngToLayerPoint(latlng));
}

function findCachedMapContextFeature(latlng) {
    if (window.gaMapContextHost?.cachedFeature) return window.gaMapContextHost.cachedFeature(latlng);
    const radius = getAirportTapRadiusPx(38);
    const candidates = [];
    const airport = findNearestAirport(latlng, radius);
    const normalizedAirport = normalizeMapContextAirportFeature(airport);
    if (normalizedAirport) candidates.push(normalizedAirport);
    const navigationPoint = findNearestMapNavigationPoint(latlng, radius);
    if (navigationPoint?.type === 'NAVAID') {
        const normalizedNavaid = normalizeMapContextNavaidFeature(navigationPoint);
        if (normalizedNavaid) candidates.push(normalizedNavaid);
    } else if (navigationPoint?.type === 'RPP') {
        const normalizedReportingPoint = normalizeMapContextReportingPointFeature(navigationPoint);
        if (normalizedReportingPoint) candidates.push(normalizedReportingPoint);
    }
    candidates.sort((a, b) => getMapContextFeatureDistancePx(a, latlng) - getMapContextFeatureDistancePx(b, latlng));
    return candidates[0] || null;
}

function findNearestMapContextFeature(items, latlng, fallback = null) {
    const radius = getAirportTapRadiusPx(38);
    const candidates = (Array.isArray(items) ? items : []).filter(Boolean);
    if (fallback) candidates.push(fallback);
    const unique = new Map();
    candidates.forEach((feature) => {
        const current = unique.get(feature.id);
        const shouldReplace = !current
            || (!current.frequencies?.length && feature.frequencies?.length)
            || (!current.runways?.length && feature.runways?.length);
        if (shouldReplace) unique.set(feature.id, feature);
    });
    return [...unique.values()]
        .map(feature => ({ feature, distance: getMapContextFeatureDistancePx(feature, latlng) }))
        .filter(entry => entry.distance <= radius)
        .sort((a, b) => a.distance - b.distance)[0]?.feature || null;
}

async function fetchMapContextNearbyFeature(latlng) {
    const cachedFeature = findCachedMapContextFeature(latlng);
    const bounds = getMapContextQueryBounds(latlng, 0.04);
    let payload = null;
    const hasRegionAirports = (
        (!window.gaMapContextHost && typeof openAipRegionState !== 'undefined' && openAipRegionState.payload)
        && openAipCoverageContainsBounds(openAipRegionState.coverage, bounds)
        && isOpenAipSnapshotCollectionAvailable((typeof openAipRegionState !== 'undefined' && openAipRegionState.payload), 'airports')
    );
    const hasRegionNavaids = (
        (!window.gaMapContextHost && typeof openAipRegionState !== 'undefined' && openAipRegionState.payload)
        && openAipCoverageContainsBounds(openAipRegionState.coverage, bounds)
        && isOpenAipSnapshotCollectionAvailable((typeof openAipRegionState !== 'undefined' && openAipRegionState.payload), 'navaids')
    );
    const hasRegionReportingPoints = (
        (!window.gaMapContextHost && typeof openAipRegionState !== 'undefined' && openAipRegionState.payload)
        && openAipCoverageContainsBounds(openAipRegionState.coverage, bounds)
        && isOpenAipSnapshotCollectionAvailable((typeof openAipRegionState !== 'undefined' && openAipRegionState.payload), 'reportingPoints')
    );
    if (hasRegionAirports && hasRegionNavaids && hasRegionReportingPoints) {
        payload = (typeof openAipRegionState !== 'undefined' && openAipRegionState.payload);
    } else if (typeof window.gaGetAviationSnapshotForBounds === 'function') {
        payload = await window.gaGetAviationSnapshotForBounds(bounds, ['airports', 'navaids', 'reportingPoints']);
    }
    const candidates = [];
    (Array.isArray(payload?.airports) ? payload.airports : []).forEach((item) => {
        const feature = normalizeMapContextAirportFeature(item);
        if (feature) candidates.push(feature);
    });
    (Array.isArray(payload?.navaids) ? payload.navaids : []).forEach((item) => {
        const feature = normalizeMapContextNavaidFeature(item);
        if (feature) candidates.push(feature);
    });
    (Array.isArray(payload?.reportingPoints) ? payload.reportingPoints : []).forEach((item) => {
        const feature = normalizeMapContextReportingPointFeature(item);
        if (feature) candidates.push(feature);
    });
    return findNearestMapContextFeature(candidates, latlng, cachedFeature);
}

async function fetchMapContextTerrainFt(latlng) {
    if (window.gaMapContextHost?.terrain) return window.gaMapContextHost.terrain(latlng);
    if (typeof fetchPoiTerrainElevationFt === 'function') {
        const terrainFt = await fetchPoiTerrainElevationFt(latlng.lat, latlng.lng);
        return Number.isFinite(Number(terrainFt)) ? Math.round(Number(terrainFt)) : null;
    }
    if (typeof sampleTerrainElevation === 'function') {
        try {
            const terrainFt = await sampleTerrainElevation(latlng.lat, latlng.lng);
            if (Number.isFinite(Number(terrainFt))) return Math.round(Number(terrainFt));
        } catch (_) {}
    }
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${encodeURIComponent(latlng.lat)}&longitude=${encodeURIComponent(latlng.lng)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`elevation_http_${response.status}`);
    const data = await response.json();
    const meters = Array.isArray(data?.elevation) ? Number(data.elevation[0]) : Number(data?.elevation);
    return Number.isFinite(meters) ? Math.round(meters * 3.28084) : null;
}

async function fetchMapContextWeather(latlng) {
    if (typeof window.fetchOpenMeteoWeatherPoints !== 'function') return null;
    const samples = await window.fetchOpenMeteoWeatherPoints(
        [{ lat: latlng.lat, lon: latlng.lng }],
        { includePressure: true, maxConcurrency: 1 }
    );
    return Array.isArray(samples) ? (samples[0] || null) : null;
}

function getMapContextRunwayWindroseData(feature) {
    const runwayText = Array.isArray(feature?.runways)
        ? feature.runways.join('\n')
        : String(feature?.runways || '');
    const match = runwayText.match(
        /(?:^|\s|\n|<br\s*\/?>)(0[1-9]|[12]\d|3[0-6])([LRC]?)\s*\/\s*((?:0[1-9]|[12]\d|3[0-6])[LRC]?)/
    );
    if (!match) return null;
    return {
        headingDeg: parseInt(match[1], 10) * 10,
        end1: `${match[1]}${match[2]}`,
        end2: match[3]
    };
}

function renderMapContextWeather(state, options = {}) {
    const runway = options?.runway || null;
    if (state.loading.weather && !runway) {
        return '<div class="ga-map-context-loading">Punktwetter wird geladen…</div>';
    }
    const weather = state.weather;
    if (!weather && !runway) {
        return '<div class="ga-map-context-muted">Punktwetter derzeit nicht verfügbar.</div>';
    }
    const windDir = Number(weather?.wdir);
    const windKt = Number(weather?.wspd);
    const totalCloud = Number(weather?.cloudTotalPct);
    const lowCloud = Number(weather?.cloudLowPct);
    const midCloud = Number(weather?.cloudMidPct);
    const highCloud = Number(weather?.cloudHighPct);
    const tempC = Number(weather?.temp2mC);
    const visibilityM = Number(weather?.visibilityM);
    const windText = Number.isFinite(windDir) && Number.isFinite(windKt)
        ? (windKt <= 0.4
            ? 'CALM · 0 kt'
            : `${Math.round(windDir).toString().padStart(3, '0')}° / ${Math.round(windKt)} kt`)
        : (state.loading.weather ? 'WIRD GELADEN' : '–');
    const visibilityKm = Number.isFinite(visibilityM) ? visibilityM / 1000 : null;
    let roseTicks = '';
    for (let heading = 0; heading < 360; heading += 30) {
        const angleRad = (heading - 90) * Math.PI / 180;
        const tx = 80 + 61 * Math.cos(angleRad);
        const ty = 80 + 61 * Math.sin(angleRad);
        const label = heading === 0
            ? 'N'
            : (heading === 90 ? 'O' : (heading === 180 ? 'S' : (heading === 270 ? 'W' : String(heading / 10))));
        const fontSize = heading % 90 === 0 ? 15 : 10;
        const tickLength = heading % 90 === 0 ? 9 : 6;
        roseTicks += `
            <line x1="80" y1="3" x2="80" y2="${3 + tickLength}" stroke="${heading % 90 === 0 ? '#111' : '#777'}"
                  stroke-width="${heading % 90 === 0 ? 2.5 : 1.5}" transform="rotate(${heading} 80 80)"></line>
            <text x="${tx.toFixed(2)}" y="${ty.toFixed(2)}" font-family="sans-serif" font-size="${fontSize}"
                  fill="#222" font-weight="800" text-anchor="middle" dominant-baseline="central">${label}</text>`;
    }
    const windArrow = Number.isFinite(windDir) && Number.isFinite(windKt) && windKt > 0.4 ? `
        <g transform="rotate(${windDir} 80 80)">
            <line x1="80" y1="7" x2="80" y2="66" stroke="#1a73e8" stroke-width="4" stroke-linecap="round"></line>
            <polygon points="72,54 80,79 88,54" fill="#1a73e8"></polygon>
        </g>` : '';
    const calmLabel = Number.isFinite(windKt) && windKt <= 0.4
        ? '<text x="80" y="84" font-family="sans-serif" font-size="14" fill="#1a73e8" font-weight="900" text-anchor="middle">CALM</text>'
        : '';
    const runwayLayer = runway ? `
        <g transform="translate(80,80) rotate(${Number(runway.headingDeg) || 0}) translate(-80,-80)">
            <rect x="68" y="29" width="24" height="102" rx="3" fill="#444" stroke="#111" stroke-width="1.5"></rect>
            <line x1="80" y1="47" x2="80" y2="113" stroke="#d4d4d4" stroke-width="2"
                  stroke-dasharray="6 6"></line>
            <text x="80" y="43" font-family="sans-serif" font-size="10" fill="#fff" font-weight="900"
                  text-anchor="middle" transform="rotate(180 80 39)">${escapePopupText(runway.end2)}</text>
            <text x="80" y="126" font-family="sans-serif" font-size="10" fill="#fff" font-weight="900"
                  text-anchor="middle">${escapePopupText(runway.end1)}</text>
        </g>` : '';
    const sourceText = runway
        ? `Piste ${runway.end1}/${runway.end2} aus internen Daten · ${weather
            ? 'Wind am Kartenpunkt'
            : (state.loading.weather ? 'Wind wird ergänzt…' : 'Wind derzeit nicht verfügbar')}`
        : 'Aktueller Stundenwert am Kartenpunkt';
    const ariaLabel = runway
        ? `Piste ${runway.end1}/${runway.end2}; Wind ${windText}`
        : `Windrose ${windText}`;
    return `
        <div class="ga-map-context-weather-card">
            <div class="ga-map-context-weather-header">
                <b>${runway ? 'PISTE · PUNKTWETTER' : 'PUNKTWETTER'}</b>
                <span>OPEN‑METEO</span>
            </div>
            <div class="ga-map-context-weather-layout">
                <div class="ga-map-context-weather-values">
                    <span><small>WIND</small><b class="is-wind">${escapePopupText(windText)}</b></span>
                    <span><small>SICHT</small><b>${Number.isFinite(visibilityKm) ? `${visibilityKm >= 10 ? Math.round(visibilityKm) : visibilityKm.toFixed(1)} km` : '–'}</b></span>
                    <span><small>TEMP</small><b>${Number.isFinite(tempC) ? `${Math.round(tempC)} °C` : '–'}</b></span>
                    <span><small>BEDECKUNG</small><b>${Number.isFinite(totalCloud) ? `${Math.round(totalCloud)} %` : '–'}</b></span>
                    <span class="is-wide"><small>WOLKEN L/M/H</small><b>${[lowCloud, midCloud, highCloud].some(Number.isFinite)
                        ? `${Number.isFinite(lowCloud) ? Math.round(lowCloud) : '–'}/${Number.isFinite(midCloud) ? Math.round(midCloud) : '–'}/${Number.isFinite(highCloud) ? Math.round(highCloud) : '–'} %`
                        : '–'}</b></span>
                </div>
                <div class="ga-map-context-windrose" aria-label="${escapePopupText(ariaLabel)}">
                    <svg viewBox="0 0 160 160" aria-hidden="true">
                        ${roseTicks}
                        ${runwayLayer}
                        ${windArrow}
                        ${calmLabel}
                    </svg>
                </div>
            </div>
            <div class="ga-map-context-weather-source">${escapePopupText(sourceText)}</div>
        </div>`;
}

function renderMapContextAirspaces(state) {
    if (state.loading.airspaces) {
        return '<div class="ga-map-context-loading">Lufträume werden geprüft…</div>';
    }
    if (!Array.isArray(state.airspaces) || state.airspaces.length === 0) {
        return '<div class="ga-map-context-muted">Kein relevanter OpenAIP-Luftraum an diesem Punkt gefunden.</div>';
    }
    const cards = state.airspaces.map((airspace) => {
        const id = String(airspace.__mapContextId || '');
        const style = mapContextAirspaceStyle(airspace);
        const name = getMapContextAirspaceDisplayTitle(airspace);
        const lower = mapContextFormatLimit(airspace.lowerLimit);
        const upper = mapContextFormatLimit(airspace.upperLimit);
        const frequencies = mapContextAirspaceFrequencyText(airspace);
        const frequencyRows = frequencies.length
            ? frequencies.map((frequency) => `
                <span class="ga-map-context-frequency-row">
                    <span class="ga-map-context-frequency-label">${escapePopupText(frequency.label)}</span>
                    <span class="ga-map-context-frequency-value">${escapePopupText(frequency.value)}</span>
                </span>`).join('')
            : `
                <span class="ga-map-context-frequency-row">
                    <span class="ga-map-context-frequency-label">FUNK</span>
                    <span class="ga-map-context-frequency-value">—</span>
                </span>`;
        const activation = mapContextAirspaceActivationText(airspace);
        const selected = state.selectedAirspaceId === id;
        return `
            <button type="button" class="ga-map-context-airspace${selected ? ' is-selected' : ''}"
                    data-map-context-airspace-id="${escapePopupText(id)}"
                    aria-pressed="${selected ? 'true' : 'false'}"
                    style="--ga-map-context-airspace-color:${escapePopupText(style.mapColor || style.color || '#4da6ff')}">
                <span class="ga-map-context-airspace-title"><i></i><b>${escapePopupText(name)}</b></span>
                <span class="ga-map-context-airspace-meta">${escapePopupText(style.category || 'Luftraum')}; ${escapePopupText(lower)}–${escapePopupText(upper)}</span>
                <span class="ga-map-context-airspace-meta ga-map-context-airspace-frequency">${frequencyRows}</span>
                ${activation ? `<span class="ga-map-context-airspace-meta">${escapePopupText(activation)}</span>` : ''}
                ${selected ? '<span class="ga-map-context-airspace-action">Markiert · erneut antippen zum Lösen</span>' : ''}
            </button>`;
    }).join('');
    return `${cards}<div class="ga-map-context-source">Zeiten ggf. in AIP/NOTAM prüfen.</div>`;
}

function mapContextLimitMslFt(airspace, limit, boundary, terrainFt) {
    const valueFt = mapContextLimitToFt(limit);
    if (!Number.isFinite(valueFt)) return null;
    const isAgl = Boolean(
        boundary === 'lower'
            ? (airspace?._lowerIsAgl || limit?.referenceDatum === 0)
            : (airspace?._upperIsAgl || limit?.referenceDatum === 0)
    );
    return valueFt + (isAgl ? Math.max(0, Number(terrainFt) || 0) : 0);
}

function getMapContextCurrentAltitudeFt() {
    const value = Number(window.lastLiveGpsPos?.alt ?? window.lastLiveFlightData?.mslFt);
    if (!Number.isFinite(value) || value < 0) return null;
    const telemetryAt = Number(window.gaLastTrackerTelemetryAt || window.lastLiveGpsPos?.t || 0);
    const liveMode = Boolean(window.simModeActive || window.liveTrackerConnected);
    if (!liveMode && (!telemetryAt || (Date.now() - telemetryAt) > 15000)) return null;
    return Math.round(value);
}

function getMapContextAirspaceClassPriority(airspace) {
    if (Number(airspace?.type) === 33) return null;
    const rawClass = airspace?.icaoClass;
    if (rawClass === null || rawClass === undefined || rawClass === '') return null;
    const classIndex = Number(rawClass);
    return Number.isInteger(classIndex) && classIndex >= 0 && classIndex <= 6
        ? classIndex
        : null;
}

function getMapContextEffectiveHeightBands(rawBands) {
    const minimumSegmentFt = 20;
    return rawBands.flatMap((band) => {
        const bandPriority = getMapContextAirspaceClassPriority(band.airspace);
        if (!Number.isInteger(bandPriority)) return [band];
        const blockers = rawBands
            .filter((other) => (
                other !== band
                && Number.isInteger(getMapContextAirspaceClassPriority(other.airspace))
                && getMapContextAirspaceClassPriority(other.airspace) < bandPriority
                && other.upperFt > band.lowerFt
                && other.lowerFt < band.upperFt
            ))
            .sort((a, b) => a.lowerFt - b.lowerFt);
        let segments = [band];
        blockers.forEach((blocker) => {
            segments = segments.flatMap((segment) => {
                const overlapLower = Math.max(segment.lowerFt, blocker.lowerFt);
                const overlapUpper = Math.min(segment.upperFt, blocker.upperFt);
                if (overlapUpper <= overlapLower) return [segment];
                const remaining = [];
                if ((overlapLower - segment.lowerFt) >= minimumSegmentFt) {
                    remaining.push({
                        ...segment,
                        upperFt: overlapLower,
                        upperLimit: blocker.lowerLimit,
                        effective: true
                    });
                }
                if ((segment.upperFt - overlapUpper) >= minimumSegmentFt) {
                    remaining.push({
                        ...segment,
                        lowerFt: overlapUpper,
                        lowerLimit: blocker.upperLimit,
                        effective: true
                    });
                }
                return remaining;
            });
        });
        return segments;
    });
}

function getMapContextHeightBandData(state) {
    const terrainFt = Math.max(0, Number(state.terrainFt) || 0);
    const stateAltitude = state?.currentAltitudeFt;
    const currentAltitudeFt = stateAltitude !== null
        && stateAltitude !== undefined
        && Number.isFinite(Number(stateAltitude))
        ? Math.max(0, Number(stateAltitude))
        : getMapContextCurrentAltitudeFt();
    const rawBands = (Array.isArray(state.airspaces) ? state.airspaces : []).map((airspace) => {
        const lowerFt = mapContextLimitMslFt(airspace, airspace.lowerLimit, 'lower', terrainFt);
        const upperFt = mapContextLimitMslFt(airspace, airspace.upperLimit, 'upper', terrainFt);
        return {
            airspace,
            lowerFt,
            upperFt,
            lowerLimit: airspace.lowerLimit,
            upperLimit: airspace.upperLimit
        };
    });
    const finiteCeilings = rawBands
        .flatMap(band => [band.lowerFt, band.upperFt])
        .filter(Number.isFinite);
    if (Number.isFinite(Number(state.feature?.elevationFt))) {
        finiteCeilings.push(Number(state.feature.elevationFt));
    }
    finiteCeilings.push(terrainFt);
    if (Number.isFinite(currentAltitudeFt)) finiteCeilings.push(currentAltitudeFt);
    const highest = Math.max(4000, ...finiteCeilings);
    const step = highest <= 10000 ? 1000 : (highest <= 25000 ? 2500 : 5000);
    const maxFt = Math.min(60000, Math.max(5000, Math.ceil((highest * 1.12) / step) * step));
    const normalizedBands = rawBands.map((band) => {
        const lowerFt = Number.isFinite(band.lowerFt) ? Math.max(0, band.lowerFt) : terrainFt;
        const upperFt = Number.isFinite(band.upperFt)
            ? Math.max(lowerFt + 100, band.upperFt)
            : maxFt;
        return { ...band, lowerFt, upperFt: Math.min(maxFt, upperFt) };
    });
    const bands = getMapContextEffectiveHeightBands(normalizedBands);
    return { terrainFt, currentAltitudeFt, maxFt, bands };
}

function formatMapContextBandTick(valueFt) {
    const rounded = Math.round(Number(valueFt) || 0);
    if (rounded === 0) return 'MSL';
    if (rounded >= 10000 && rounded % 1000 === 0) return `${rounded / 1000}k`;
    return rounded.toLocaleString('de-DE');
}

function getMapContextHeightScaleTicks(bands, maxFt) {
    const transitions = [];
    bands.forEach((band) => {
        [
            { valueFt: band.lowerFt, limit: band.lowerLimit },
            { valueFt: band.upperFt, limit: band.upperLimit }
        ].forEach(({ valueFt, limit }) => {
            if (!Number.isFinite(valueFt) || valueFt <= 0 || valueFt >= maxFt) return;
            const isFlightLevel = Number(limit?.unit) === 6 && Number.isFinite(Number(limit?.value));
            transitions.push({
                valueFt,
                label: isFlightLevel ? `FL${Math.round(Number(limit.value))}` : formatMapContextBandTick(valueFt),
                transition: true
            });
        });
    });
    const uniqueTransitions = [];
    transitions
        .sort((a, b) => b.valueFt - a.valueFt)
        .forEach((entry) => {
            if (uniqueTransitions.some(item => Math.abs(item.valueFt - entry.valueFt) < 80)) return;
            uniqueTransitions.push(entry);
        });
    const mergeDistanceFt = Math.max(100, maxFt * 0.012);
    const baseTicks = [1, 0.75, 0.5, 0.25, 0]
        .map(ratio => ({ valueFt: maxFt * ratio, label: formatMapContextBandTick(maxFt * ratio), transition: false }))
        .filter(base => !uniqueTransitions.some(entry => Math.abs(entry.valueFt - base.valueFt) < mergeDistanceFt));
    return [...baseTicks, ...uniqueTransitions].sort((a, b) => b.valueFt - a.valueFt);
}

function getMapContextHeightBandLayer(airspace) {
    const type = Number(airspace?.type);
    if (type === 33) return 2;
    if (type === 0) return 3;
    if (type === 7 || type === 26) return 4;
    if (type === 4 || type === 5 || type === 6 || type === 27 || type === 28) return 5;
    if (type === 1 || type === 2 || type === 3) return 6;
    return 3;
}

function getMapContextCloudVisualProfile(type, hasTS = false) {
    const normalizedType = String(type || '').toUpperCase();
    if (typeof vpGetCloudLayerProfile === 'function') {
        try {
            return vpGetCloudLayerProfile(normalizedType, hasTS);
        } catch (_) {}
    }
    const profiles = {
        FEW: { thicknessFt: 900, density: 0.32, topAlpha: 0.12, bottomAlpha: 0.2, ridgeStrength: 0.22 },
        SCT: { thicknessFt: 1700, density: 0.46, topAlpha: 0.16, bottomAlpha: 0.28, ridgeStrength: 0.3 },
        BKN: { thicknessFt: 3200, density: 0.72, topAlpha: 0.2, bottomAlpha: 0.42, ridgeStrength: 0.4 },
        OVC: { thicknessFt: 5200, density: 0.9, topAlpha: 0.24, bottomAlpha: 0.5, ridgeStrength: 0.46 },
        VV: { thicknessFt: 5200, density: 0.9, topAlpha: 0.24, bottomAlpha: 0.5, ridgeStrength: 0.46 }
    };
    const profile = { ...(profiles[normalizedType] || profiles.SCT) };
    if (hasTS) {
        profile.thicknessFt = Math.max(profile.thicknessFt, 12000);
        profile.density = Math.min(1, profile.density + 0.12);
        profile.topAlpha = Math.min(0.38, profile.topAlpha + 0.08);
        profile.bottomAlpha = Math.min(0.62, profile.bottomAlpha + 0.1);
        profile.ridgeStrength = Math.min(0.62, profile.ridgeStrength + 0.12);
    }
    return profile;
}

function getMapContextCloudCoverage(type) {
    const normalizedType = String(type || '').toUpperCase();
    if (normalizedType === 'FEW') return 22;
    if (normalizedType === 'SCT') return 45;
    if (normalizedType === 'BKN') return 80;
    if (normalizedType === 'OVC' || normalizedType === 'VV') return 100;
    return 50;
}

function getMapContextAtmosphereData(state, terrainFt) {
    const weather = state?.weather;
    if (!weather) {
        return {
            clouds: [],
            hasRain: false,
            hasSnow: false,
            precipitationMm: 0,
            lowestBaseFt: null
        };
    }

    const pressureProfile = Array.isArray(weather.pressureProfile) ? weather.pressureProfile : [];
    let clouds = [];
    if (typeof vpDeriveCloudLayersFromPressureProfile === 'function') {
        try {
            clouds = vpDeriveCloudLayersFromPressureProfile(pressureProfile, terrainFt);
        } catch (_) {
            clouds = [];
        }
    }

    const precipitationMm = Math.max(
        0,
        Number(weather.precipitationMm) || 0,
        Number(weather.rainMm) || 0
    );
    const hasTS = [95, 96, 99].includes(Number(weather.weatherCode));
    const hasRain = (Number(weather.rainMm) || 0) > 0.1 || precipitationMm > 0.25;
    const hasSnow = (Number(weather.snowfallCm) || 0) > 0.05;
    const estimatedCloud = typeof vpBuildTempDewCloudLayer === 'function'
        ? vpBuildTempDewCloudLayer({
            temp2mC: weather.temp2mC,
            dewPoint2mC: weather.dewPoint2mC,
            rh2mPct: weather.rh2mPct,
            windKt: weather.wspd,
            terrainFt,
            lowCloudPct: weather.cloudLowPct,
            coveragePct: weather.cloudTotalPct,
            weatherCode: weather.weatherCode,
            hasRain,
            hasSnow,
            source: 'map_context_openmeteo'
        })
        : null;
    const pressureLowestBase = clouds.reduce((lowest, cloud) => {
        const baseFt = Number(cloud?.baseMsl);
        return Number.isFinite(baseFt) ? Math.min(lowest, baseFt) : lowest;
    }, Infinity);
    if (estimatedCloud && (!Number.isFinite(pressureLowestBase) || estimatedCloud.baseMsl < pressureLowestBase - 500)) {
        clouds.unshift(estimatedCloud);
    }

    clouds = clouds
        .map((cloud) => {
            const baseMsl = Number(cloud?.baseMsl);
            if (!Number.isFinite(baseMsl)) return null;
            const type = String(cloud?.type || 'SCT').toUpperCase();
            const visualProfile = getMapContextCloudVisualProfile(type, hasTS);
            const measuredTopMsl = Number(cloud?.topMsl);
            const topMsl = Number.isFinite(measuredTopMsl) && measuredTopMsl > baseMsl + 150
                ? measuredTopMsl
                : baseMsl + visualProfile.thicknessFt;
            return {
                type,
                baseMsl,
                topMsl,
                coveragePct: getMapContextCloudCoverage(type),
                density: visualProfile.density,
                topAlpha: visualProfile.topAlpha,
                bottomAlpha: visualProfile.bottomAlpha,
                ridgeStrength: visualProfile.ridgeStrength,
                hasTS
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.baseMsl - b.baseMsl);

    const lowestBaseFt = clouds.length
        ? clouds.reduce((lowest, cloud) => Math.min(lowest, cloud.baseMsl), Infinity)
        : null;
    return { clouds, hasRain, hasSnow, hasTS, precipitationMm, lowestBaseFt };
}

function renderMapContextAtmosphere(atmosphere, maxFt, terrainFt) {
    if (!atmosphere || !Number.isFinite(maxFt) || maxFt <= 0) return '';
    const cloudLayers = (Array.isArray(atmosphere.clouds) ? atmosphere.clouds : []).map((cloud, cloudIndex) => {
        const baseFt = Math.max(terrainFt, Number(cloud.baseMsl) || 0);
        const topFt = Math.max(baseFt + 100, Number(cloud.topMsl) || baseFt);
        if (baseFt >= maxFt || topFt <= 0) return '';
        const visibleBaseFt = Math.min(maxFt, baseFt);
        const visibleTopFt = Math.min(maxFt, topFt);
        const topPct = Math.max(0, Math.min(100, 100 - ((visibleTopFt / maxFt) * 100)));
        const bottomPct = Math.max(0, Math.min(100, 100 - ((visibleBaseFt / maxFt) * 100)));
        const heightPct = Math.max(1.2, bottomPct - topPct);
        const type = String(cloud.type || 'SCT').toLowerCase();
        const coveragePct = Math.max(15, Math.min(100, Number(cloud.coveragePct) || 50));
        const density = Math.max(0.2, Math.min(1, Number(cloud.density) || (coveragePct / 100)));
        const ridgeStrength = Math.max(0.15, Math.min(0.7, Number(cloud.ridgeStrength) || 0.3));
        const grayTop = Math.round(218 - (density * 72) - (cloud.hasTS ? 18 : 0));
        const grayBottom = Math.round(170 - (density * 105) - (cloud.hasTS ? 24 : 0));
        const topAlpha = Math.min(0.92, 0.46 + (Number(cloud.topAlpha) || 0.16) + density * 0.16);
        const bottomAlpha = Math.min(0.98, 0.52 + (Number(cloud.bottomAlpha) || 0.28) + density * 0.12);
        const highlightAlpha = Math.min(0.88, topAlpha + 0.11);
        const massWidth = Math.round(120 + density * 70);
        const delaySeconds = -((cloudIndex * 1.73) + (baseFt * 0.00037)) % 7;
        return `
            <span class="ga-map-context-height-cloud is-${escapePopupText(type)}${cloud.hasTS ? ' has-thunderstorm' : ''}"
                  style="top:${topPct.toFixed(2)}%;height:${heightPct.toFixed(2)}%;
                         --ga-map-context-cloud-density:${density.toFixed(2)};
                         --ga-map-context-cloud-ridge:${ridgeStrength.toFixed(2)};
                         --ga-map-context-cloud-mass-width:${massWidth}%;
                         --ga-map-context-cloud-top:rgba(${grayTop},${grayTop},${grayTop},${topAlpha.toFixed(2)});
                         --ga-map-context-cloud-bottom:rgba(${grayBottom},${grayBottom},${grayBottom},${bottomAlpha.toFixed(2)});
                         --ga-map-context-cloud-highlight:rgba(255,255,255,${highlightAlpha.toFixed(2)});
                         --ga-map-context-cloud-delay:${delaySeconds.toFixed(2)}s"
                  aria-hidden="true">
                <span class="ga-map-context-height-cloud-mass">
                    <span class="ga-map-context-height-cloud-core"></span>
                    <span class="ga-map-context-height-cloud-lobe is-top is-a"></span>
                    <span class="ga-map-context-height-cloud-lobe is-top is-b"></span>
                    <span class="ga-map-context-height-cloud-lobe is-top is-c"></span>
                    <span class="ga-map-context-height-cloud-lobe is-bottom is-a"></span>
                    <span class="ga-map-context-height-cloud-lobe is-bottom is-b"></span>
                    <span class="ga-map-context-height-cloud-lobe is-bottom is-c"></span>
                </span>
            </span>`;
    }).join('');

    let precipitation = '';
    let rainSplashes = '';
    if (atmosphere.hasRain || atmosphere.hasSnow) {
        const fallbackBaseFt = Math.max(terrainFt + 1200, maxFt * 0.55);
        const precipBaseFt = Math.min(
            maxFt,
            Math.max(terrainFt + 150, Number(atmosphere.lowestBaseFt) || fallbackBaseFt)
        );
        const topPct = Math.max(0, Math.min(100, 100 - ((precipBaseFt / maxFt) * 100)));
        const heightPct = Math.max(1.5, 100 - topPct);
        const intensity = Math.max(0.42, Math.min(0.92, 0.42 + (Number(atmosphere.precipitationMm) || 0) * 0.15));
        precipitation = `
            <span class="ga-map-context-height-precipitation${atmosphere.hasRain ? ' is-rain' : ''}${atmosphere.hasSnow ? ' is-snow' : ''}"
                  style="top:${topPct.toFixed(2)}%;height:${heightPct.toFixed(2)}%;--ga-map-context-precip-opacity:${intensity.toFixed(2)}"
                  aria-hidden="true"></span>`;
        if (atmosphere.hasRain) {
            const terrainHeightPct = Math.max(2.2, Math.min(92, (terrainFt / maxFt) * 100));
            const terrainTopPct = Math.max(1, Math.min(98, 100 - terrainHeightPct));
            const terrainContour = [
                { x: 18, y: 2, delay: 0.08, scale: 0.92 },
                { x: 37, y: 18, delay: 0.54, scale: 0.76 },
                { x: 58, y: 4, delay: 0.31, scale: 1.0 },
                { x: 78, y: 15, delay: 0.73, scale: 0.82 },
                { x: 97, y: 2, delay: 0.42, scale: 0.9 }
            ];
            rainSplashes = `
                <span class="ga-map-context-height-rain-splashes"
                      style="--ga-map-context-splash-opacity:${Math.min(1, intensity + 0.18).toFixed(2)}"
                      aria-hidden="true">
                    ${terrainContour.map((point) => {
                        const groundPct = terrainTopPct + (terrainHeightPct * point.y / 100);
                        return `
                            <span class="ga-map-context-height-rain-splash"
                                  style="left:${point.x}%;top:${groundPct.toFixed(2)}%;
                                         --ga-map-context-splash-delay:-${point.delay.toFixed(2)}s;
                                         --ga-map-context-splash-scale:${point.scale.toFixed(2)};
                                         --ga-map-context-splash-start-scale:${(point.scale * 0.55).toFixed(2)};
                                         --ga-map-context-splash-end-scale:${(point.scale * 1.28).toFixed(2)}">
                                <i></i>
                            </span>`;
                    }).join('')}
                </span>`;
        }
    }

    if (!cloudLayers && !precipitation) return '';
    return `
        <div class="ga-map-context-height-atmosphere" aria-hidden="true">
            ${cloudLayers}
            ${precipitation}
            ${rainSplashes}
        </div>`;
}

function renderMapContextHeightBand(state) {
    const { terrainFt, currentAltitudeFt, maxFt, bands } = getMapContextHeightBandData(state);
    state.heightBandMaxFt = maxFt;
    const ticks = getMapContextHeightScaleTicks(bands, maxFt).map((tick) => `
        <span class="ga-map-context-height-tick${tick.transition ? ' is-transition' : ''}"
              style="top:${Math.max(0, Math.min(100, 100 - ((tick.valueFt / maxFt) * 100))).toFixed(2)}%">
            ${escapePopupText(tick.label)}
        </span>`).join('');
    const airspaceBands = bands.map((band) => {
        const airspace = band.airspace;
        const id = String(airspace.__mapContextId || '');
        const style = mapContextAirspaceStyle(airspace);
        const name = getMapContextAirspaceDisplayTitle(airspace);
        const classLetter = getMapContextAirspaceClassLetter(airspace);
        const isControlZone = Number(airspace?.type) === 4;
        const shortLabel = isControlZone
            ? 'CTR'
            : (classLetter || getMapContextAirspaceDescriptor(airspace).split(/\s+/)[0]);
        const topPct = Math.max(0, Math.min(100, 100 - ((band.upperFt / maxFt) * 100)));
        const bottomPct = Math.max(0, Math.min(100, 100 - ((band.lowerFt / maxFt) * 100)));
        const heightPct = Math.max(2.8, bottomPct - topPct);
        const classSizePx = Math.max(16, Math.min(29, 13 + (heightPct * 0.58)));
        const selected = state.selectedAirspaceId === id;
        return `
            <button type="button"
                    class="ga-map-context-height-airspace${selected ? ' is-selected' : ''}"
                    data-map-context-airspace-id="${escapePopupText(id)}"
                    aria-label="${escapePopupText(`${name}, ${mapContextFormatLimit(airspace.lowerLimit)} bis ${mapContextFormatLimit(airspace.upperLimit)}`)}"
                    aria-pressed="${selected ? 'true' : 'false'}"
                    title="${escapePopupText(`${name} · ${mapContextFormatLimit(airspace.lowerLimit)}–${mapContextFormatLimit(airspace.upperLimit)}`)}"
                    style="top:${topPct.toFixed(2)}%;height:${heightPct.toFixed(2)}%;--ga-map-context-airspace-color:${escapePopupText(style.mapColor || style.color || '#4da6ff')};--ga-map-context-class-size:${classSizePx.toFixed(1)}px;--ga-map-context-band-layer:${getMapContextHeightBandLayer(airspace)}">
                ${classLetter || isControlZone
                    ? `<span class="ga-map-context-height-class-letter${isControlZone ? ' is-ctr' : ''}">${escapePopupText(shortLabel)}</span>`
                    : `<span class="ga-map-context-height-airspace-label">${escapePopupText(shortLabel)}</span>`}
            </button>`;
    }).join('');
    const terrainHeightPct = Math.max(2.2, Math.min(92, (terrainFt / maxFt) * 100));
    const terrainTopPct = Math.max(1, Math.min(98, 100 - terrainHeightPct));
    const terrainLabel = state.terrainFt != null && Number.isFinite(Number(state.terrainFt))
        ? `${Math.round(terrainFt).toLocaleString('de-DE')}′`
        : 'GND';
    const featureElevation = Number.isFinite(Number(state.feature?.elevationFt))
        ? Number(state.feature.elevationFt)
        : terrainFt;
    const featureTopPct = Math.max(1, Math.min(98, 100 - ((featureElevation / maxFt) * 100)));
    const featureMarkerLabel = state.feature?.kind === 'airport'
        ? 'Flugplatz markieren'
        : (state.feature?.kind === 'vrp' ? 'VFR-Meldepunkt markieren' : 'Navaid markieren');
    const featureMarker = state.feature ? `
        <button type="button"
                class="ga-map-context-height-feature${state.selectedFeatureId === state.feature.id ? ' is-selected' : ''}"
                data-map-context-feature-id="${escapePopupText(state.feature.id)}"
                aria-label="${escapePopupText(featureMarkerLabel)}"
                style="top:${featureTopPct.toFixed(2)}%">
            <span>${state.feature.kind === 'airport' ? 'APT' : (state.feature.kind === 'vrp' ? 'VRP' : 'NAV')}</span>
        </button>` : '';
    const ownAltitudeTopPct = Number.isFinite(currentAltitudeFt)
        ? Math.max(1, Math.min(99, 100 - ((currentAltitudeFt / maxFt) * 100)))
        : null;
    const ownAltitudeMarker = Number.isFinite(ownAltitudeTopPct) ? `
        <span class="ga-map-context-height-ownship"
              data-map-context-own-altitude
              style="top:${ownAltitudeTopPct.toFixed(2)}%"
              role="img"
              aria-label="Eigene Flughöhe ${Math.round(currentAltitudeFt)} Fuß MSL"
              title="Eigene Flughöhe · ${Math.round(currentAltitudeFt).toLocaleString('de-DE')} ft MSL"></span>` : '';
    const loading = state.loading.airspaces || state.loading.terrain;
    const atmosphere = renderMapContextAtmosphere(
        getMapContextAtmosphereData(state, terrainFt),
        maxFt,
        terrainFt
    );
    return `
        <div class="ga-map-context-height-band${loading ? ' is-loading' : ''}">
            <div class="ga-map-context-height-title">HÖHE <small>FT MSL</small></div>
            <div class="ga-map-context-height-plot">
                <div class="ga-map-context-height-sky"></div>
                ${atmosphere}
                <div class="ga-map-context-height-scale">${ticks}</div>
                ${ownAltitudeMarker}
                <div class="ga-map-context-height-stack">
                    ${airspaceBands}
                    ${featureMarker}
                    <div class="ga-map-context-height-terrain" style="height:${terrainHeightPct.toFixed(2)}%"></div>
                    <span class="ga-map-context-height-ground-label" style="top:${terrainTopPct.toFixed(2)}%">${escapePopupText(terrainLabel)}</span>
                </div>
                ${loading ? '<span class="ga-map-context-height-loading">lädt…</span>' : ''}
            </div>
        </div>`;
}

function getMapContextAirportWidgetConfig(state) {
    const feature = state?.feature;
    if (!feature || feature.kind !== 'airport' || !feature.icao) return null;
    const safeIcao = String(feature.icao).replace(/[^a-zA-Z0-9_-]/g, '_');
    const prefix = `gaMapContextApt_${state.requestSeq}_${safeIcao}`;
    return {
        runwayId: `${prefix}_runways`,
        freqId: `${prefix}_frequencies`,
        wxId: `${prefix}_weather`
    };
}

function buildMapContextAirportWidget(state, selected) {
    const feature = state.feature;
    const config = getMapContextAirportWidgetConfig(state);
    const title = [feature.icao, feature.name].filter(Boolean).join(' · ');
    if (!config || typeof _buildAptPopup !== 'function') {
        const details = [];
        if (Number.isFinite(Number(feature.elevationFt))) details.push(`${Math.round(Number(feature.elevationFt))} ft MSL`);
        if (feature.runways?.length) details.push(`RWY ${feature.runways.join('; ')}`);
        if (feature.frequencies?.length) details.push(feature.frequencies.join('; '));
        return `
            <button type="button" class="ga-map-context-feature${selected ? ' is-selected' : ''}"
                    data-map-context-feature-id="${escapePopupText(feature.id)}"
                    aria-pressed="${selected ? 'true' : 'false'}">
                <span class="ga-map-context-feature-kind">FLUGPLATZ</span>
                <b>${escapePopupText(title || 'Flugplatz')}</b>
                ${details.map(detail => `<span>${escapePopupText(detail)}</span>`).join('')}
                ${selected ? '<span class="ga-map-context-feature-action">Karte + Höhenband markiert</span>' : ''}
            </button>`;
    }

    const countryCode = typeof getAirportCountryCode === 'function'
        ? getAirportCountryCode(feature.icao, feature.country)
        : feature.country;
    const widgetTitle = `
        <b style="font-size:13px;">${escapePopupText(feature.icao)}</b>
        <div style="font-size:11px; color:#445; margin-top:2px;">${escapePopupText(feature.name)}</div>`;
    const widgetHtml = _buildAptPopup(
        'APT',
        feature.name,
        feature.elevationFt,
        feature.icao,
        {
            title: widgetTitle,
            wxContainerId: config.wxId,
            runwayContainerId: config.runwayId,
            freqContainerId: config.freqId,
            countryCode,
            showDirectTo: true,
            directToName: feature.name,
            lat: feature.lat,
            lon: feature.lon,
            compactLayout: true
        }
    );
    return `
        <div class="ga-map-context-airport-block">
            <button type="button" class="ga-map-context-feature ga-map-context-feature-selector${selected ? ' is-selected' : ''}"
                    data-map-context-feature-id="${escapePopupText(feature.id)}"
                    aria-pressed="${selected ? 'true' : 'false'}">
                <span class="ga-map-context-feature-kind">FLUGPLATZ · VOLLANSICHT</span>
                <b>${escapePopupText(title)}</b>
                ${selected ? '<span class="ga-map-context-feature-action">Markiert · erneut antippen zum Lösen</span>' : ''}
            </button>
            <div class="ga-map-context-airport-full"
                 style="min-width:0;overflow:hidden;padding:5px;color:#10202d;background:#edf7fb;border:1px solid rgba(250,204,21,.72);border-radius:7px;">
                ${widgetHtml}
            </div>
        </div>`;
}

function captureMapContextAirportWidgetState(state) {
    const config = getMapContextAirportWidgetConfig(state);
    if (!config) return;
    const weatherElement = document.getElementById(config.wxId);
    if (!weatherElement) return;
    if (weatherElement.querySelector('[data-ga-metar-loading="true"]')) return;
    const html = String(weatherElement.innerHTML || '').trim();
    if (html && !/(Wetter lädt|Sucht lokales Wetter|Punktwetter wird geladen)/i.test(html)) {
        state.airportWidgetWeatherHtml = html;
    }
}

function renderMapContextAirportWeatherPlaceholder(state) {
    const feature = state?.feature;
    const runwayText = Array.isArray(feature?.runways) ? feature.runways.join('\n') : '';
    if (typeof window.renderAirportMetarLoadingWidget === 'function') {
        return window.renderAirportMetarLoadingWidget(
            feature?.icao,
            runwayText,
            { responsiveEmbed: true }
        );
    }
    return '<div class="ga-map-context-loading" data-ga-metar-loading="true">METAR wird geladen…</div>';
}

function hydrateMapContextAirportWidget(state) {
    const feature = state?.feature;
    const config = getMapContextAirportWidgetConfig(state);
    if (!feature || !config || state !== mapContextInfoState) return;
    const weatherElement = document.getElementById(config.wxId);
    if (
        feature.icao
        && feature.runways?.length
        && typeof runwayCache !== 'undefined'
        && !runwayCache[feature.icao]
    ) {
        runwayCache[feature.icao] = feature.runways.join('\n');
    }
    if (state.airportWidgetWeatherHtml) {
        if (weatherElement) weatherElement.innerHTML = state.airportWidgetWeatherHtml;
    } else if (weatherElement) {
        weatherElement.innerHTML = renderMapContextAirportWeatherPlaceholder(state);
    }
    if (typeof updatePopupFrequencyBlock === 'function') {
        updatePopupFrequencyBlock(config.freqId, feature.icao);
    }
    if (typeof refreshAipOverlayPopupUi === 'function') {
        refreshAipOverlayPopupUi(feature.icao);
    }
    if (state.airportWidgetLoadingStarted) return;
    state.airportWidgetLoadingStarted = true;
    if (typeof fetchRunwayDetails === 'function') {
        fetchRunwayDetails(feature.lat, feature.lon, config.runwayId, feature.icao);
    }
    if (typeof fetchAirportFreq === 'function') {
        const hasCachedFrequencies = (
            typeof freqCache !== 'undefined'
            && Object.prototype.hasOwnProperty.call(freqCache, feature.icao)
        );
        if (!hasCachedFrequencies) {
            fetchAirportFreq(feature.icao, null, null)
                .finally(() => {
                    if (state === mapContextInfoState) {
                        updatePopupFrequencyBlock(config.freqId, feature.icao);
                    }
                });
        }
    }
    if (typeof loadMetarWidget === 'function' && !state.airportWidgetWeatherHtml) {
        loadMetarWidget(
            feature.icao,
            config.wxId,
            feature.lat,
            feature.lon,
            true,
            {
                preserveLoadingContent: true,
                skipRunwayWait: true,
                responsiveEmbed: true,
                runwayIcao: feature.icao
            }
        );
    }
}

function renderMapContextFeature(state) {
    if (state.loading.feature && !state.feature) {
        return '<div class="ga-map-context-loading">Objekte am Punkt werden geprüft…</div>';
    }
    const feature = state.feature;
    if (!feature) return '';
    const selected = state.selectedFeatureId === feature.id;
    if (feature.kind === 'airport') {
        return buildMapContextAirportWidget(state, selected);
    }
    const isReportingPoint = feature.kind === 'vrp';
    const title = isReportingPoint
        ? feature.name
        : [feature.identifier, feature.name].filter(Boolean).join(' · ');
    const details = isReportingPoint
        ? [
            feature.airportIcao ? `Zugehöriger Flugplatz ${feature.airportIcao}` : '',
            feature.description
        ].filter(Boolean)
        : [
            feature.typeLabel,
            feature.frequencies?.length ? `Funk ${feature.frequencies.join('; ')}` : '',
            feature.channel ? `Kanal ${feature.channel}` : '',
            feature.range ? `Reichweite ${feature.range}` : ''
        ].filter(Boolean);
    return `
        <button type="button" class="ga-map-context-feature${selected ? ' is-selected' : ''}"
                data-map-context-feature-id="${escapePopupText(feature.id)}"
                aria-pressed="${selected ? 'true' : 'false'}">
            <span class="ga-map-context-feature-kind">${isReportingPoint ? 'VRP · VFR-MELDEPUNKT' : 'NAVAID'}</span>
            <b>${escapePopupText(title || (isReportingPoint ? 'VFR-Meldepunkt' : 'Navaid'))}</b>
            ${details.map(detail => `<span>${escapePopupText(detail)}</span>`).join('')}
            ${selected ? '<span class="ga-map-context-feature-action">Markiert · erneut antippen zum Lösen</span>' : ''}
        </button>`;
}

function positionMapContextPopupBesideAnchor(state) {
    if (!state || state.popupPositioned || state.popupPositionScheduled) return;
    state.popupPositionScheduled = true;
    window.requestAnimationFrame(() => {
        if (!state || state !== mapContextInfoState || !mapContextPopupLayer?._container) return;
        state.popupPositionScheduled = false;
        if (state.popupPositioned) return;
        state.popupPositioned = true;
        const popupElement = mapContextPopupLayer._container;
        const wrapper = popupElement.querySelector('.leaflet-popup-content-wrapper');
        const width = Number(mapContextPopupLayer._containerWidth) || popupElement.offsetWidth;
        const height = wrapper?.offsetHeight || popupElement.offsetHeight;
        mapContextPopupLayer.options.offset = L.point(
            Math.round((width / 2) + 16),
            Math.round(height / 2)
        );
        mapContextPopupLayer.update?.();
        window.requestAnimationFrame(() => {
            if (state !== mapContextInfoState || !mapContextPopupLayer) return;
            const mapElement = map.getContainer?.();
            const popupRect = mapContextPopupLayer._container?.getBoundingClientRect?.();
            const mapRect = mapElement?.getBoundingClientRect?.();
            if (!popupRect || !mapRect) return;
            const padding = 4;
            let panX = 0;
            let panY = 0;
            if (popupRect.right > mapRect.right - padding) {
                panX = popupRect.right - (mapRect.right - padding);
            } else if (popupRect.left < mapRect.left + padding) {
                panX = popupRect.left - (mapRect.left + padding);
            }
            if (popupRect.bottom > mapRect.bottom - padding) {
                panY = popupRect.bottom - (mapRect.bottom - padding);
            } else if (popupRect.top < mapRect.top + padding) {
                panY = popupRect.top - (mapRect.top + padding);
            }
            if (panX || panY) {
                const nextCenterPoint = map.getSize()
                    .divideBy(2)
                    .add(L.point(Math.round(panX), Math.round(panY)));
                map.setView(
                    map.containerPointToLatLng(nextCenterPoint),
                    map.getZoom(),
                    { animate: false }
                );
            }
        });
    });
}

function renderMapContextInfoPopup(state, options = {}) {
    if (!state || state !== mapContextInfoState || !state.content) return;
    const preserveDetailsScroll = Boolean(options.preserveDetailsScroll);
    const previousDetailsScrollTop = preserveDetailsScroll
        ? Number(state.content.querySelector?.('.ga-map-context-details')?.scrollTop)
        : null;
    captureMapContextAirportWidgetState(state);
    const mapHeight = Number(map?.getContainer?.()?.clientHeight);
    if (Number.isFinite(mapHeight) && mapHeight > 0) {
        state.content.style.setProperty('--ga-map-context-map-height', `${Math.round(mapHeight)}px`);
    }
    const terrain = state.loading.terrain
        ? '<div class="ga-map-context-loading">Topografie wird geladen…</div>'
        : (state.terrainFt != null && Number.isFinite(Number(state.terrainFt))
            ? `<div class="ga-map-context-summary"><span><b>Gelände</b> ${Math.round(Number(state.terrainFt))} ft MSL / ${Math.round(Number(state.terrainFt) / 3.28084)} m</span></div>`
            : '<div class="ga-map-context-muted">Geländehöhe nicht verfügbar.</div>');
    state.content.innerHTML = `
        <div class="ga-map-context-panel">
            <div class="ga-map-context-heading">
                <span class="ga-map-context-kicker">WAS IST HIER?</span>
                <b>${state.latlng.lat.toFixed(5)}, ${state.latlng.lng.toFixed(5)}</b>
            </div>
            <div class="ga-map-context-body">
                ${renderMapContextHeightBand(state)}
                <div class="ga-map-context-details">
                    ${renderMapContextFeature(state)}
                    <section>
                        <h4>Lufträume</h4>
                        ${renderMapContextAirspaces(state)}
                    </section>
                    <section>
                        <h4>Punkt</h4>
                        ${terrain}
                    </section>
                    <section>
                        <h4>Wetter</h4>
                        ${renderMapContextWeather(state)}
                    </section>
                </div>
            </div>
        </div>`;
    hydrateMapContextAirportWidget(state);
    mapContextPopupLayer?.update?.();
    positionMapContextPopupBesideAnchor(state);
    if (preserveDetailsScroll && Number.isFinite(previousDetailsScrollTop)) {
        const restoreDetailsScroll = () => {
            if (state !== mapContextInfoState || !state.content) return;
            const details = state.content.querySelector?.('.ga-map-context-details');
            if (!details) return;
            const maximum = Math.max(0, details.scrollHeight - details.clientHeight);
            details.scrollTop = Math.min(previousDetailsScrollTop, maximum);
        };
        restoreDetailsScroll();
        window.requestAnimationFrame(restoreDetailsScroll);
    }
}

function highlightMapContextAirspace(airspaceId) {
    const state = mapContextInfoState;
    if (!state || !map) return;
    const airspace = state.airspaces?.find(item => String(item.__mapContextId) === String(airspaceId));
    if (!airspace?.geometry) return;
    if (state.selectedAirspaceId === String(airspaceId)) {
        clearMapContextAirspaceHighlight();
        state.selectedAirspaceId = '';
        renderMapContextInfoPopup(state, { preserveDetailsScroll: true });
        return;
    }
    clearMapContextAirspaceHighlight();
    clearMapContextObjectHighlight();
    if (typeof window.gaClearRouteToolMapFocus === 'function') window.gaClearRouteToolMapFocus();
    const style = mapContextAirspaceStyle(airspace);
    mapContextAirspaceHighlightLayer = L.geoJSON(airspace.geometry, {
        pane: window.gaMapContextHost?.pane || GA_MAP_OVERLAY_PANES.localAviation.name,
        interactive: false,
        style: {
            color: style.mapColor || style.color || '#4da6ff',
            weight: 4,
            opacity: 1,
            fillColor: style.mapColor || style.color || '#4da6ff',
            fillOpacity: 0.24,
            dashArray: '8,5',
            className: 'ga-map-context-airspace-highlight'
        }
    }).addTo(map);
    mapContextAirspaceHighlightLayer.bringToFront?.();
    mapContextPointLayer?.bringToFront?.();
    state.selectedAirspaceId = String(airspaceId);
    state.selectedFeatureId = '';
    renderMapContextInfoPopup(state, { preserveDetailsScroll: true });
}

function highlightMapContextFeature(featureId) {
    const state = mapContextInfoState;
    const feature = state?.feature;
    if (!state || !map || !feature || String(feature.id) !== String(featureId)) return;
    if (state.selectedFeatureId === String(featureId)) {
        clearMapContextObjectHighlight();
        state.selectedFeatureId = '';
        renderMapContextInfoPopup(state, { preserveDetailsScroll: true });
        return;
    }
    clearMapContextAirspaceHighlight();
    clearMapContextObjectHighlight();
    if (typeof window.gaClearRouteToolMapFocus === 'function') window.gaClearRouteToolMapFocus();
    mapContextObjectHighlightLayer = L.circleMarker([feature.lat, feature.lon], {
        pane: window.gaMapContextHost?.pane || GA_MAP_OVERLAY_PANES.localAviation.name,
        radius: feature.kind === 'airport' ? 13 : 11,
        color: '#facc15',
        weight: 4,
        opacity: 1,
        fillColor: feature.kind === 'airport' ? '#f59e0b' : (feature.kind === 'vrp' ? '#facc15' : '#22d3ee'),
        fillOpacity: 0.32,
        interactive: false,
        className: 'ga-map-context-object-highlight'
    }).addTo(map);
    mapContextObjectHighlightLayer.bringToFront?.();
    mapContextPointLayer?.bringToFront?.();
    state.selectedFeatureId = String(featureId);
    state.selectedAirspaceId = '';
    renderMapContextInfoPopup(state, { preserveDetailsScroll: true });
}

window.gaUpdateMapContextOwnAltitude = function(altitudeFt) {
    const state = mapContextInfoState;
    if (!state || mapContextPopupLayer?._map !== map) return;
    const value = Number(altitudeFt);
    const hasValue = altitudeFt !== null && altitudeFt !== undefined && altitudeFt !== '';
    state.currentAltitudeFt = hasValue && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
    const nextBandData = getMapContextHeightBandData(state);
    const marker = state.content?.querySelector?.('[data-map-context-own-altitude]');
    if (
        Number(state.heightBandMaxFt) !== Number(nextBandData.maxFt)
        || (Number.isFinite(nextBandData.currentAltitudeFt) && !marker)
        || (!Number.isFinite(nextBandData.currentAltitudeFt) && marker)
    ) {
        renderMapContextInfoPopup(state);
        return;
    }
    if (!marker || !Number.isFinite(nextBandData.currentAltitudeFt)) return;
    const topPct = Math.max(1, Math.min(99, 100 - ((nextBandData.currentAltitudeFt / nextBandData.maxFt) * 100)));
    marker.style.top = `${topPct.toFixed(2)}%`;
    marker.setAttribute('aria-label', `Eigene Flughöhe ${Math.round(nextBandData.currentAltitudeFt)} Fuß MSL`);
    marker.title = `Eigene Flughöhe · ${Math.round(nextBandData.currentAltitudeFt).toLocaleString('de-DE')} ft MSL`;
};

function openMapContextInfo(latlng, source = 'longpress') {
    if (!map || !latlng || !Number.isFinite(latlng.lat) || !Number.isFinite(latlng.lng)) return;
    const now = Date.now();
    const duplicate = (now - mapContextLastOpen.at) < 900
        && Math.abs(latlng.lat - mapContextLastOpen.lat) < 0.0001
        && Math.abs(latlng.lng - mapContextLastOpen.lon) < 0.0001;
    if (duplicate) return;
    mapContextLastOpen = { at: now, lat: latlng.lat, lon: latlng.lng };
    mapContextSuppressClickUntil = now + 900;
    mapContextRequestSeq += 1;
    const requestSeq = mapContextRequestSeq;
    clearMapContextPointLayer();
    clearMapContextAirspaceHighlight();
    clearMapContextObjectHighlight();
    if (typeof window.gaClearRouteToolMapFocus === 'function') window.gaClearRouteToolMapFocus();

    const content = document.createElement('div');
    const cachedFeature = findCachedMapContextFeature(latlng);
    const state = {
        requestSeq,
        source,
        latlng: L.latLng(latlng.lat, latlng.lng),
        content,
        loading: { airspaces: true, terrain: true, weather: true, feature: true },
        airspaces: [],
        terrainFt: null,
        weather: null,
        feature: cachedFeature,
        currentAltitudeFt: getMapContextCurrentAltitudeFt(),
        selectedAirspaceId: '',
        selectedFeatureId: '',
        popupPositioned: false,
        popupPositionScheduled: false
    };
    mapContextInfoState = state;
    content.addEventListener('click', (event) => {
        const airspaceButton = event.target?.closest?.('[data-map-context-airspace-id]');
        const featureButton = event.target?.closest?.('[data-map-context-feature-id]');
        if (airspaceButton) {
            event.preventDefault();
            event.stopPropagation();
            highlightMapContextAirspace(airspaceButton.dataset.mapContextAirspaceId || '');
        } else if (featureButton) {
            event.preventDefault();
            event.stopPropagation();
            highlightMapContextFeature(featureButton.dataset.mapContextFeatureId || '');
        }
    });

    mapContextPointLayer = L.circleMarker(state.latlng, {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: '#00d9ff',
        fillOpacity: 0.92,
        interactive: false,
        className: 'ga-map-context-point'
    }).addTo(map);
    if (!mapContextPopupLayer) {
        mapContextPopupLayer = L.popup({
            className: 'ga-map-context-popup',
            minWidth: 248,
            maxWidth: 500,
            maxHeight: 680,
            offset: [160, 190],
            autoPan: false,
            autoPanPadding: [18, 18]
        });
    }
    mapContextPopupLayer
        .setLatLng(state.latlng)
        .setContent(content)
        .openOn(map);
    map.getContainer?.()?.classList.add('ga-map-context-open');
    renderMapContextInfoPopup(state);
    window.setTimeout(() => {
        if (state !== mapContextInfoState || mapContextPopupLayer?._map !== map) return;
        state.popupPositioned = false;
        state.popupPositionScheduled = false;
        positionMapContextPopupBesideAnchor(state);
    }, 800);

    const settle = (section, value) => {
        if (!mapContextInfoState || mapContextInfoState.requestSeq !== requestSeq) return;
        state.loading[section] = false;
        if (section === 'airspaces') state.airspaces = Array.isArray(value) ? value : [];
        if (section === 'terrain') state.terrainFt = value != null && Number.isFinite(Number(value)) ? Number(value) : null;
        if (section === 'weather') state.weather = value || null;
        if (section === 'feature') state.feature = value || state.feature || null;
        renderMapContextInfoPopup(state);
    };
    Promise.resolve(fetchMapContextAirspaces(state.latlng))
        .then(value => settle('airspaces', value))
        .catch((error) => {
            console.warn('[Map Context] Luftraumabfrage fehlgeschlagen:', error);
            settle('airspaces', []);
        });
    Promise.resolve(fetchMapContextTerrainFt(state.latlng))
        .then(value => settle('terrain', value))
        .catch((error) => {
            console.warn('[Map Context] Terrainabfrage fehlgeschlagen:', error);
            settle('terrain', null);
        });
    Promise.resolve(fetchMapContextWeather(state.latlng))
        .then(value => settle('weather', value))
        .catch((error) => {
            console.warn('[Map Context] Wetterabfrage fehlgeschlagen:', error);
            settle('weather', null);
        });
    Promise.resolve(fetchMapContextNearbyFeature(state.latlng))
        .then(value => settle('feature', value))
        .catch((error) => {
            console.warn('[Map Context] Objektabfrage fehlgeschlagen:', error);
            settle('feature', cachedFeature);
        });
}


window.gaOpenMapContextInfo = openMapContextInfo;
window.gaMapContextPopupClosed = function(event) {
    if (event.popup !== mapContextPopupLayer) return;
    dismissMapContextInfo();
    map.getContainer()?.classList.remove('ga-map-context-open');
};
