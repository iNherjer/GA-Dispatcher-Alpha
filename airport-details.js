// Shared original App runway lookup, formatting and cache. Host changes transport only.
const runwayLookupInflight = new Map();
const runwayEmptyCache = new Map();
const runwayTemporaryCache = new Map();
const RUNWAY_EMPTY_CACHE_MS = 10 * 60 * 1000;
const RUNWAY_TEMPORARY_RETRY_MS = 15 * 1000;

function getOpenAipRunwayCacheKey(airport) {
    return String(
        airport?.icaoCode
        || airport?.icao
        || airport?.designator
        || airport?.name
        || ''
    ).trim().toUpperCase();
}

function getReciprocalRunwayDesignator(designator) {
    const match = String(designator || '').trim().toUpperCase().match(/^(\d{1,2})([LRC]?)$/);
    if (!match) return '';
    const number = Number(match[1]);
    if (!Number.isFinite(number) || number < 1 || number > 36) return '';
    const reciprocalNumber = ((number + 17) % 36) + 1;
    const side = match[2] === 'L' ? 'R' : (match[2] === 'R' ? 'L' : match[2]);
    return `${String(reciprocalNumber).padStart(2, '0')}${side}`;
}

function getOpenAipRunwayLengthMeters(runway) {
    const length = Number(runway?.dimension?.length?.value);
    if (!Number.isFinite(length) || length <= 0) return null;
    return Number(runway?.dimension?.length?.unit) === 1 ? length * 0.3048 : length;
}

function getOpenAipRunwaySurfaceLabel(runway) {
    const explicit = String(
        runway?.surface?.name
        || runway?.surface?.label
        || runway?.surface?.compositionName
        || runway?.surface?.mainCompositeName
        || ''
    ).trim();
    return explicit;
}

function formatOpenAipAirportRunways(airport) {
    const runways = Array.isArray(airport?.runways) ? airport.runways.filter(Boolean) : [];
    if (!runways.length) return '';
    const byDesignator = new Map();
    runways.forEach((runway) => {
        const designator = String(runway?.designator || '').trim().toUpperCase();
        if (designator && !byDesignator.has(designator)) byDesignator.set(designator, runway);
    });

    const used = new Set();
    const lines = [];
    runways.forEach((runway, index) => {
        const designator = String(runway?.designator || '').trim().toUpperCase();
        const uniqueKey = designator || `index:${index}`;
        if (used.has(uniqueKey)) return;

        const reciprocal = getReciprocalRunwayDesignator(designator);
        const reciprocalRunway = reciprocal ? byDesignator.get(reciprocal) : null;
        used.add(uniqueKey);
        if (reciprocalRunway) used.add(reciprocal);

        const runwayLabel = reciprocalRunway ? `${designator}/${reciprocal}` : (designator || 'Piste');
        const lengthMeters = getOpenAipRunwayLengthMeters(runway)
            ?? getOpenAipRunwayLengthMeters(reciprocalRunway);
        const surface = getOpenAipRunwaySurfaceLabel(runway)
            || getOpenAipRunwaySurfaceLabel(reciprocalRunway);
        const details = [];
        if (surface) details.push(surface);
        if (Number.isFinite(lengthMeters)) details.push(`${Math.round(lengthMeters)}m`);
        lines.push(`${runwayLabel}${details.length ? ` – ${details.join(' · ')}` : ''}`);
    });
    return [...new Set(lines)].slice(0, 8).join('\n');
}

function seedOpenAipAirportRunways(airports) {
    if (typeof runwayCache === 'undefined' || !Array.isArray(airports)) return;
    airports.forEach((airport) => {
        const key = getOpenAipRunwayCacheKey(airport);
        if (!key) return;
        const formatted = formatOpenAipAirportRunways(airport);
        if (!formatted) return;
        const cached = String(runwayCache[key] || '');
        if (!cached || cached === 'Keine Daten gefunden') {
            runwayCache[key] = formatted;
        }
    });
}

function findOpenAipAirportInPayloads(payloads, icao, lat, lon) {
    const targetCode = String(icao || '').trim().toUpperCase();
    let nearest = null;
    let nearestDistance = Infinity;
    for (const payload of payloads) {
        for (const airport of (Array.isArray(payload?.airports) ? payload.airports : [])) {
            const code = getOpenAipRunwayCacheKey(airport);
            if (targetCode && code === targetCode) return airport;
            const coords = airport?.geometry?.coordinates;
            if (!Array.isArray(coords) || coords.length < 2) continue;
            const aptLon = Number(coords[0]);
            const aptLat = Number(coords[1]);
            if (![aptLat, aptLon, lat, lon].every(Number.isFinite)) continue;
            const dLat = aptLat - lat;
            const dLon = (aptLon - lon) * Math.cos((lat * Math.PI) / 180);
            const distanceSq = (dLat * dLat) + (dLon * dLon);
            if (distanceSq < nearestDistance) {
                nearestDistance = distanceSq;
                nearest = airport;
            }
        }
    }
    return nearestDistance <= (0.05 * 0.05) ? nearest : null;
}

window.gaFetchOpenAipAirportRunwayText = async function(icao, lat, lon) {
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (![latitude, longitude].every(Number.isFinite)) return '';
    const lonPadding = 0.45 / Math.max(0.25, Math.abs(Math.cos((latitude * Math.PI) / 180)));
    const bounds = {
        west: longitude - lonPadding,
        south: latitude - 0.45,
        east: longitude + lonPadding,
        north: latitude + 0.45
    };
    const payloads = await (window.gaAirportDetailsHost?.snapshots || getOpenAipSnapshotsForBounds)(bounds, 'airports');
    payloads.forEach(payload => seedOpenAipAirportRunways(payload.airports));
    const airport = findOpenAipAirportInPayloads(payloads, icao, latitude, longitude);
    return airport ? formatOpenAipAirportRunways(airport) : '';
};


function formatOverpassRunwayDetails(data) {
    const elements = Array.isArray(data?.elements) ? data.elements : [];
    const trans = {
        asphalt: 'Asphalt', concrete: 'Beton', grass: 'Gras',
        paved: 'Asphalt', unpaved: 'Unbefestigt', dirt: 'Erde',
        gravel: 'Schotter', sand: 'Sand', water: 'Wasser'
    };
    const seen = new Set();
    const parts = [];
    for (const element of elements) {
        const tags = element?.tags || {};
        const ref = String(tags.ref || tags.name || 'Piste').trim();
        const surfaceRaw = String(tags.surface || '').trim();
        const surface = surfaceRaw ? (trans[surfaceRaw.toLowerCase()] || surfaceRaw) : '';
        const lengthRaw = String(tags.length || '').trim();
        const lengthNumber = Number.parseFloat(lengthRaw.replace(',', '.'));
        const lengthMeters = Number.isFinite(lengthNumber)
            ? (/ft|feet/i.test(lengthRaw) ? lengthNumber * 0.3048 : lengthNumber)
            : null;
        const key = `${ref}|${surface}|${Number.isFinite(lengthMeters) ? Math.round(lengthMeters) : ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const details = [];
        if (surface) details.push(surface);
        if (Number.isFinite(lengthMeters)) details.push(`${Math.round(lengthMeters)}m`);
        parts.push(`${ref}${details.length ? ` – ${details.join(' · ')}` : ''}`);
    }
    return parts.slice(0, 8).join('\n');
}

async function lookupRunwayDetails(lat, lon, icaoCode) {
    if (typeof window.gaFetchOpenAipAirportRunwayText === 'function') {
        try {
            const openAipText = await window.gaFetchOpenAipAirportRunwayText(icaoCode, lat, lon);
            if (openAipText) return { status: 'ok', text: openAipText, source: 'openaip-region' };
        } catch (_) {
            // Der OSM-Fallback bleibt unabhängig von einem OpenAIP-Teilausfall.
        }
    }

    const query = `[out:json][timeout:5];nwr["aeroway"="runway"](around:3000,${lat},${lon});out tags;`;
    try {
        const res = await (window.gaAirportDetailsHost?.fetchWithTimeout || fetchWithTimeout)(
            `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
            6500
        );
        if (!res.ok) {
            const error = new Error(`overpass_http_${res.status}`);
            error.status = res.status;
            throw error;
        }
        const data = await res.json();
        const text = formatOverpassRunwayDetails(data);
        return text
            ? { status: 'ok', text, source: 'overpass' }
            : { status: 'empty', text: '', source: 'overpass' };
    } catch (error) {
        return {
            status: 'temporary',
            text: '',
            source: 'overpass',
            error: String(error?.message || error)
        };
    }
}

function renderRunwayDetailsResult(domEl, result, icaoCode) {
    if (!domEl || !result) return;
    const hColor = document.body.classList.contains('theme-retro') ? 'var(--piper-yellow)' : 'var(--warn)';
    let summaryText = '';
    if (result.status === 'ok' && result.text) {
        summaryText = result.text;
        domEl.innerHTML = result.text.replace(/\n/g, '<br>');
        domEl.style.color = hColor;
    } else if (result.status === 'empty') {
        summaryText = 'Keine Pisteninformationen vorhanden';
        domEl.innerText = summaryText;
        domEl.style.color = '#888';
    } else {
        summaryText = 'Pistendaten vorübergehend nicht verfügbar · erneut antippen';
        domEl.innerText = summaryText;
        domEl.style.color = '#b7791f';
    }
    if (icaoCode === currentStartICAO && document.getElementById('wikiDepRwyText')) {
        document.getElementById('wikiDepRwyText').innerHTML = `Pisten:<br>${summaryText.replace(/\n/g, '<br>')}`;
    }
    if (icaoCode === currentDestICAO && document.getElementById('wikiDestRwyText')) {
        document.getElementById('wikiDestRwyText').innerHTML = `Pisten:<br>${summaryText.replace(/\n/g, '<br>')}`;
    }
}

async function fetchRunwayDetails(lat, lon, elementId, icaoCode, options = {}) {
    let domEl = document.getElementById(elementId);
    if (!domEl) return;
    const commitAllowed = () => typeof _dispatchUiCommitAllowed !== 'function' || _dispatchUiCommitAllowed(options);
    if (!commitAllowed()) return;
    const normalizedIcao = String(icaoCode || '').trim().toUpperCase();
    const lookupKey = normalizedIcao || `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;

    const cachedText = normalizedIcao ? String(runwayCache[normalizedIcao] || '') : '';
    if (cachedText && cachedText !== 'Keine Daten gefunden') {
        renderRunwayDetailsResult(domEl, { status: 'ok', text: cachedText, source: 'memory' }, normalizedIcao);
        return;
    }

    const emptyCachedAt = Number(runwayEmptyCache.get(lookupKey)) || 0;
    if (emptyCachedAt && (Date.now() - emptyCachedAt) < RUNWAY_EMPTY_CACHE_MS) {
        renderRunwayDetailsResult(domEl, { status: 'empty', text: '', source: 'memory' }, normalizedIcao);
        return;
    }
    if (emptyCachedAt) runwayEmptyCache.delete(lookupKey);
    const temporaryCachedAt = Number(runwayTemporaryCache.get(lookupKey)) || 0;
    if (temporaryCachedAt && (Date.now() - temporaryCachedAt) < RUNWAY_TEMPORARY_RETRY_MS) {
        renderRunwayDetailsResult(domEl, { status: 'temporary', text: '', source: 'memory' }, normalizedIcao);
        return;
    }
    if (temporaryCachedAt) runwayTemporaryCache.delete(lookupKey);

    let request = runwayLookupInflight.get(lookupKey);
    if (!request) {
        request = lookupRunwayDetails(Number(lat), Number(lon), normalizedIcao);
        runwayLookupInflight.set(lookupKey, request);
    }

    let result;
    try {
        result = await request;
    } finally {
        if (runwayLookupInflight.get(lookupKey) === request) runwayLookupInflight.delete(lookupKey);
    }
    if (result?.status === 'ok' && result.text && normalizedIcao) {
        runwayCache[normalizedIcao] = result.text;
        runwayEmptyCache.delete(lookupKey);
        runwayTemporaryCache.delete(lookupKey);
    } else if (result?.status === 'empty') {
        runwayEmptyCache.set(lookupKey, Date.now());
        runwayTemporaryCache.delete(lookupKey);
    } else if (result?.status === 'temporary') {
        runwayTemporaryCache.set(lookupKey, Date.now());
        console.warn('[Runway] Quelle vorübergehend nicht verfügbar:', normalizedIcao || lookupKey, result.error || result.source);
    }
    if (!commitAllowed()) return;
    domEl = document.getElementById(elementId);
    if (!domEl) return;
    renderRunwayDetailsResult(domEl, result, normalizedIcao);
    window.gaChecklistHost?.airportUpdated?.();
}
