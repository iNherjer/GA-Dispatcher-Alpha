/* Original standalone navpoint labels, airport enrichment and geographic filters.
 * Shared by the App and the Tracker's local EFB/Toolbar data source. */
(function(root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.GAMapNavpointCore = factory();
})(typeof window !== 'undefined' ? window : globalThis, function() {
'use strict';
function normalizeOpenAipAirportForPopup(airport) {
    const coords = airport?.geometry?.coordinates;
    const hasGeometryCoordinates = Array.isArray(coords) && coords.length >= 2;
    const lat = Number(hasGeometryCoordinates ? coords[1] : airport?.lat);
    const lon = Number(hasGeometryCoordinates ? coords[0] : (airport?.lon ?? airport?.lng));
    const icao = String(
        airport?.icaoCode
        || airport?.icao
        || airport?.designator
        || airport?.name
        || ''
    ).trim().toUpperCase();
    if (!icao || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const elevationIsObject = airport?.elevation && typeof airport.elevation === 'object';
    const elevationValue = Number(elevationIsObject ? airport.elevation.value : airport?.elevation);
    const elevation = Number.isFinite(elevationValue)
        ? (
            elevationIsObject && Number(airport.elevation.unit) !== 1
                ? Math.round(elevationValue * 3.28084)
                : elevationValue
        )
        : null;
    return {
        icao,
        name: String(airport?.name || icao).trim(),
        lat,
        lon,
        elevation,
        country: String(airport?.country || airport?.countryCode || airport?.isoCountry || '').trim(),
        sourceId: String(airport?._id || airport?.id || '').trim()
    };
}

function buildOpenAipNavaidCacheEntry(item, source = 'live', byId = null) {
    const sourceId = String(item?._id || item?.id || '').trim();
    const staticItem = sourceId && byId instanceof Map
        ? byId.get(sourceId)
        : null;
    const enrichedItem = staticItem ? { ...staticItem, ...item } : item;
    const coords = enrichedItem?.geometry?.coordinates;
    const lat = Number(enrichedItem?.lat ?? coords?.[1]);
    const lon = Number(enrichedItem?.lon ?? coords?.[0]);
    if (![lat, lon].every(Number.isFinite)) return null;

    let freqVal = '';
    if (enrichedItem?.frequency !== undefined && enrichedItem?.frequency !== null) {
        freqVal = (typeof enrichedItem.frequency === 'object' && enrichedItem.frequency.value)
            ? enrichedItem.frequency.value
            : enrichedItem.frequency;
    } else if (Array.isArray(enrichedItem?.frequencies) && enrichedItem.frequencies.length > 0) {
        freqVal = enrichedItem.frequencies[0]?.value || enrichedItem.frequencies[0];
    }
    const identifier = String(enrichedItem?.identifier || enrichedItem?.designator || '').trim().toUpperCase();
    const name = String(enrichedItem?.name || identifier || 'Navaid').trim();
    const identText = identifier ? ` [${identifier}]` : '';
    const freqText = freqVal ? ` (${freqVal})` : '';
    return {
        name: `${name}${identText}${freqText}`,
        lat,
        lng: lon,
        type: 'NAVAID',
        sourceId,
        navaidIdentifier: identifier,
        navaidType: enrichedItem?.type ?? null,
        navaidSource: source,
        navaidData: {
            ...enrichedItem,
            id: sourceId || enrichedItem?.id || '',
            lat,
            lon,
            identifier,
            name
        }
    };
}

function buildOpenAipReportingPointCacheEntry(item, source = 'live') {
    const coords = item?.geometry?.coordinates;
    const lat = Number(item?.lat ?? coords?.[1]);
    const lon = Number(item?.lon ?? coords?.[0]);
    const name = String(item?.name || '').trim();
    if (!name || ![lat, lon].every(Number.isFinite)) return null;
    return {
        name: `RPP ${name}`,
        lat,
        lng: lon,
        type: 'RPP',
        rppAirportIcao: String(item?.airportIcao || extractRppAirportIcao(item) || '').trim().toUpperCase(),
        sourceId: String(item?._id || item?.id || '').trim(),
        rppSource: source,
        rppData: {
            ...item,
            id: String(item?._id || item?.id || '').trim(),
            name,
            lat,
            lon
        }
    };
}

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

function buildGlobalAirportSnapEntries(bounds, globalAirports) {
    if (!bounds || typeof globalAirports !== 'object' || !globalAirports) return [];
    const west = Number(bounds.west);
    const south = Number(bounds.south);
    const east = Number(bounds.east);
    const north = Number(bounds.north);
    if (![west, south, east, north].every(Number.isFinite) || east <= west || north <= south) return [];

    const padLon = Math.min(0.25, Math.max(0.05, (east - west) * 0.15));
    const padLat = Math.min(0.25, Math.max(0.05, (north - south) * 0.15));
    const entries = [];
    for (const key in globalAirports) {
        const airport = globalAirports[key];
        const lat = Number(airport?.lat);
        const lon = Number(airport?.lon ?? airport?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        if (
            lat < south - padLat
            || lat > north + padLat
            || lon < west - padLon
            || lon > east + padLon
        ) continue;
        const icao = String(airport?.icao || key || '').trim().toUpperCase();
        const airportName = String(airport?.name || airport?.n || airport?.city || icao || 'Flugplatz').trim();
        entries.push({
            name: `APT ${icao || airportName}`,
            lat,
            lng: lon,
            type: 'APT',
            airportIcao: icao || airportName,
            airportName,
            country: String(airport?.country || '').trim(),
            elevation: airport?.elevation ?? null,
            airportSnapSource: 'global-fallback'
        });
    }
    return entries;
}

function airportEntry(item) {
    const apt = normalizeOpenAipAirportForPopup(item);
    if (!apt) return null;
    const frequency = Array.isArray(item.frequencies) ? item.frequencies[0]?.value : '';
    return { name: `APT ${apt.icao || apt.name}${frequency ? ` (${frequency})` : ''}`,
        lat: apt.lat, lng: apt.lon, type: 'APT', airportIcao: apt.icao || apt.name,
        airportName: apt.name, sourceId: apt.sourceId, country: apt.country };
}
return { navaid: buildOpenAipNavaidCacheEntry, reportingPoint: buildOpenAipReportingPointCacheEntry,
    airport: airportEntry, globalAirports: buildGlobalAirportSnapEntries,
    normalizeAirport: normalizeOpenAipAirportForPopup, extractRppAirportIcao };
});
