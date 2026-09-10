function getAirportWeatherCache() { return window.gaAirportWeatherHost?.cache || gpsState; }
// Shared standalone airport METAR widget and station cache.
function _parseMetarPayloadToArray(txt) {
    if (typeof txt !== 'string') return null;
    const t = txt.trim();
    if (!t) return null;
    try {
        const parsed = JSON.parse(t);
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

async function _fetchWithTimeout(url, timeoutMs = 2500) {
    if (window.gaAirportWeatherHost?.fetchWithTimeout) return window.gaAirportWeatherHost.fetchWithTimeout(url, timeoutMs);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Math.max(250, Number(timeoutMs) || 2500));
    try {
        return await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

async function _fetchMetarArrayViaVariants(sourceUrl, {
    includeCodeTabs = false,
    includeDirect = false,
    retries = 1,
    timeoutMs = 2500,
    retryDelayMs = 0
} = {}) {
    const variants = [];
    if (includeDirect) variants.push(sourceUrl);
    variants.push(`https://ga-proxy.einherjer.workers.dev/api/metar?src=${encodeURIComponent(sourceUrl)}`);
    if (includeCodeTabs) variants.push(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(sourceUrl)}`);

    const maxRetries = Math.max(1, Number(retries) || 1);
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        for (const url of variants) {
            try {
                const res = await _fetchWithTimeout(url, timeoutMs);
                if (!res.ok || res.status === 204) continue;
                const txt = await res.text();
                const arr = _parseMetarPayloadToArray(txt);
                if (Array.isArray(arr) && arr.length) return arr;
            } catch (_) {}
        }
        if (attempt < maxRetries - 1 && retryDelayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
    }
    return null;
}

const METAR_MEMORY_CACHE_TTL_MS = 10 * 60 * 1000;
let metarMemoryCachePruneTimer = null;

function _isFreshMetarMemoryEntry(entry, now = Date.now()) {
    const cachedAt = Number(entry?.cachedAt);
    return Number.isFinite(cachedAt)
        && cachedAt > 0
        && (now - cachedAt) < METAR_MEMORY_CACHE_TTL_MS;
}

function _scheduleMetarMemoryCachePrune() {
    if (metarMemoryCachePruneTimer) {
        clearTimeout(metarMemoryCachePruneTimer);
        metarMemoryCachePruneTimer = null;
    }
    const expiries = [
        ...Object.values(getAirportWeatherCache()?.metarCache || {}).map(entry => Number(entry?.cachedAt) + METAR_MEMORY_CACHE_TTL_MS),
        ...(Array.isArray(getAirportWeatherCache()?.metarRegionCache) ? getAirportWeatherCache().metarRegionCache : [])
            .map(entry => Number(entry?.cachedAt) + METAR_MEMORY_CACHE_TTL_MS)
    ].filter(Number.isFinite);
    if (!expiries.length) return;
    const nextExpiry = Math.min(...expiries);
    metarMemoryCachePruneTimer = setTimeout(() => {
        metarMemoryCachePruneTimer = null;
        _pruneMetarMemoryCache();
    }, Math.max(250, nextExpiry - Date.now() + 25));
}

function _pruneMetarMemoryCache(now = Date.now()) {
    if (!getAirportWeatherCache().metarCache || typeof getAirportWeatherCache().metarCache !== 'object') {
        getAirportWeatherCache().metarCache = {};
    }
    Object.keys(getAirportWeatherCache().metarCache).forEach((key) => {
        if (!_isFreshMetarMemoryEntry(getAirportWeatherCache().metarCache[key], now)) {
            delete getAirportWeatherCache().metarCache[key];
        }
    });
    getAirportWeatherCache().metarRegionCache = (Array.isArray(getAirportWeatherCache().metarRegionCache)
        ? getAirportWeatherCache().metarRegionCache
        : []
    ).filter(entry => _isFreshMetarMemoryEntry(entry, now));
    _scheduleMetarMemoryCachePrune();
}

function _getMetarMemoryEntry(key) {
    const normalizedKey = String(key || '').trim().toUpperCase();
    if (!normalizedKey) return null;
    const entry = getAirportWeatherCache().metarCache?.[normalizedKey];
    if (!_isFreshMetarMemoryEntry(entry)) {
        if (entry) delete getAirportWeatherCache().metarCache[normalizedKey];
        return null;
    }
    return entry;
}

function _setMetarMemoryEntry(key, entry) {
    const normalizedKey = String(key || '').trim().toUpperCase();
    if (!normalizedKey || !entry) return null;
    const cachedEntry = {
        ...entry,
        cachedAt: Number(entry.cachedAt) || Date.now()
    };
    getAirportWeatherCache().metarCache[normalizedKey] = cachedEntry;
    _scheduleMetarMemoryCachePrune();
    return cachedEntry;
}

function _storeMetarRegion(data, bounds) {
    const candidates = (Array.isArray(data) ? data : []).filter(item => (
        item
        && Number.isFinite(Number(item.lat))
        && Number.isFinite(Number(item.lon))
    ));
    if (!candidates.length || !bounds) return;
    const cachedAt = Date.now();
    const entry = {
        data: candidates,
        bounds: {
            latMin: Number(bounds.latMin),
            lonMin: Number(bounds.lonMin),
            latMax: Number(bounds.latMax),
            lonMax: Number(bounds.lonMax)
        },
        cachedAt
    };
    getAirportWeatherCache().metarRegionCache = (Array.isArray(getAirportWeatherCache().metarRegionCache)
        ? getAirportWeatherCache().metarRegionCache
        : []
    ).filter(region => {
        if (!_isFreshMetarMemoryEntry(region, cachedAt)) return false;
        const current = region.bounds || {};
        return !(
            Number(current.latMin) === entry.bounds.latMin
            && Number(current.lonMin) === entry.bounds.lonMin
            && Number(current.latMax) === entry.bounds.latMax
            && Number(current.lonMax) === entry.bounds.lonMax
        );
    });
    getAirportWeatherCache().metarRegionCache.push(entry);
    candidates.forEach((station) => {
        const stationIcao = String(station.icaoId || station.icao || '').trim().toUpperCase();
        if (!stationIcao) return;
        const stationEntry = {
            data: [station],
            isFallback: false,
            foundIcao: stationIcao,
            cachedAt
        };
        _setMetarMemoryEntry(stationIcao, stationEntry);
        _setMetarMemoryEntry(`STATION:${stationIcao}`, stationEntry);
    });
    _scheduleMetarMemoryCachePrune();
}

function _getCachedMetarRegionForPoint(lat, lon) {
    const pointLat = Number(lat);
    const pointLon = Number(lon);
    if (![pointLat, pointLon].every(Number.isFinite)) return null;
    _pruneMetarMemoryCache();
    return (Array.isArray(getAirportWeatherCache().metarRegionCache) ? getAirportWeatherCache().metarRegionCache : [])
        .filter((entry) => {
            const bounds = entry?.bounds || {};
            return (
                pointLat >= Number(bounds.latMin)
                && pointLat <= Number(bounds.latMax)
                && pointLon >= Number(bounds.lonMin)
                && pointLon <= Number(bounds.lonMax)
            );
        })
        .sort((a, b) => Number(b.cachedAt) - Number(a.cachedAt))[0] || null;
}

function _selectMetarForAirport(candidates, icao, lat, lon) {
    const items = (Array.isArray(candidates) ? candidates : []).filter(item => (
        item
        && Number.isFinite(Number(item.lat))
        && Number.isFinite(Number(item.lon))
    ));
    if (!items.length) return null;
    const requestedIcao = String(icao || '').trim().toUpperCase();
    const direct = items.find(item => (
        String(item.icaoId || item.icao || '').trim().toUpperCase() === requestedIcao
    ));
    if (direct) return { station: direct, isFallback: false };
    let closest = items[0];
    let minDist = calcNav(lat, lon, Number(closest.lat), Number(closest.lon)).dist;
    for (let index = 1; index < items.length; index += 1) {
        const distance = calcNav(lat, lon, Number(items[index].lat), Number(items[index].lon)).dist;
        if (distance < minDist) {
            minDist = distance;
            closest = items[index];
        }
    }
    return { station: closest, isFallback: true };
}

function _escapeMetarWidgetText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function _getMetarRunwayVisualData(runwayText) {
    const match = String(runwayText || '').match(
        /(?:^|\s|\n|<br\s*\/?>)(0[1-9]|[12]\d|3[0-6])([LRC]?)\s*\/\s*((?:0[1-9]|[12]\d|3[0-6])[LRC]?)/
    );
    if (!match) return null;
    return {
        headingDeg: parseInt(match[1], 10) * 10,
        end1: `${match[1]}${match[2]}`,
        end2: match[3]
    };
}

function _renderMetarCompassTicks() {
    let ticks = '';
    for (let heading = 0; heading < 360; heading += 5) {
        const isCardinal = heading % 90 === 0;
        const isLong = heading % 10 === 0;
        const length = isCardinal ? 8 : (isLong ? 5 : 3);
        const strokeWidth = isCardinal ? 2 : 1;
        const color = isCardinal ? '#111' : '#888';
        ticks += `<line x1="80" y1="2" x2="80" y2="${2 + length}" stroke="${color}" stroke-width="${strokeWidth}" transform="rotate(${heading} 80 80)"></line>`;
        if (heading % 30 !== 0) continue;
        const angleRad = (heading - 90) * Math.PI / 180;
        const tx = 80 + 61 * Math.cos(angleRad);
        const ty = 80 + 61 * Math.sin(angleRad);
        const label = isCardinal
            ? (heading === 0 ? 'N' : (heading === 90 ? 'O' : (heading === 180 ? 'S' : 'W')))
            : String(heading / 10);
        ticks += `<text x="${tx}" y="${ty}" font-family="sans-serif" font-size="${isCardinal ? 14 : 10}" fill="${isCardinal ? '#111' : '#333'}" font-weight="bold" text-anchor="middle" dominant-baseline="central">${label}</text>`;
    }
    return ticks;
}

function _renderMetarRunwayLayer(runway, isMini = false) {
    if (!runway) return '';
    const width = isMini ? '15px' : '26px';
    const height = isMini ? '60px' : '105px';
    const fontSize = isMini ? '8px' : '10px';
    return `
        <div style="position:absolute;top:50%;left:50%;width:${width};height:${height};background:#444;border:1px solid #111;border-radius:3px;transform:translate(-50%,-50%) rotate(${runway.headingDeg}deg);transform-origin:center center;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:3px 0;box-sizing:border-box;z-index:5;box-shadow:0 2px 4px rgba(0,0,0,.4);">
            <div style="width:100%;text-align:center;font-size:${fontSize};line-height:1;color:#fff;font-weight:bold;transform:rotate(180deg);font-family:sans-serif;">${_escapeMetarWidgetText(runway.end2)}</div>
            <div style="width:2px;flex-grow:1;margin:3px 0;background:repeating-linear-gradient(to bottom,#d4d4d4 0,#d4d4d4 6px,transparent 6px,transparent 12px);"></div>
            <div style="width:100%;text-align:center;font-size:${fontSize};line-height:1;color:#fff;font-weight:bold;font-family:sans-serif;">${_escapeMetarWidgetText(runway.end1)}</div>
        </div>`;
}

window.renderAirportMetarLoadingWidget = function(icao, runwayText, options = {}) {
    const responsiveEmbed = options?.responsiveEmbed !== false;
    const runway = _getMetarRunwayVisualData(runwayText);
    const weatherFont = "'Courier New', Courier, monospace";
    const valueStyle = 'color:#111;font-size:13px;font-weight:bold;white-space:nowrap;';
    const labelStyle = 'color:#666;font-size:8px;font-weight:bold;letter-spacing:1px;';
    return `
        <div class="ga-weather-card ga-weather-card-loading"
             data-ga-metar-loading="true"
             style="background:#f0eada;border-radius:12px;padding:10px;border:3px solid #c2bba8;box-shadow:0 4px 8px rgba(0,0,0,.2),inset 0 2px 5px rgba(255,255,255,.5);font-family:Arial,sans-serif;color:#333;position:relative;overflow:hidden;">
            <div style="position:absolute;top:6px;left:6px;width:6px;height:6px;background:#ddd;border-radius:50%;box-shadow:inset 0 0 2px #555;"></div>
            <div style="position:absolute;bottom:6px;right:6px;width:6px;height:6px;background:#ddd;border-radius:50%;box-shadow:inset 0 0 2px #555;"></div>
            <div style="position:absolute;top:6px;right:6px;width:6px;height:6px;background:#ddd;border-radius:50%;box-shadow:inset 0 0 2px #555;"></div>
            <div style="position:absolute;bottom:6px;left:6px;width:6px;height:6px;background:#ddd;border-radius:50%;box-shadow:inset 0 0 2px #555;"></div>
            <div style="color:#8a1a12;font-size:12px;font-weight:bold;margin-bottom:5px;border-bottom:2px dashed #c2bba8;padding-bottom:4px;font-family:${weatherFont};display:flex;justify-content:space-between;align-items:center;gap:6px;letter-spacing:.5px;">
                <span>▶ STATION: ${_escapeMetarWidgetText(String(icao || '').trim().toUpperCase())}</span>
                <span class="ga-weather-loading-status" style="color:#8a6b12;font-size:10px;padding:1px 5px;border:2px solid #c69b28;border-radius:4px;background:rgba(255,255,255,.7);">LÄDT</span>
            </div>
            <div class="ga-weather-layout${responsiveEmbed ? ' ga-weather-layout-responsive' : ''}"
                 style="display:flex;justify-content:space-between;align-items:stretch;gap:5px;${responsiveEmbed ? 'flex-direction:column;' : ''}">
                <div style="display:flex;flex-direction:column;gap:3px;font-family:${weatherFont};flex-shrink:1;min-width:0;">
                    <div><div style="${labelStyle}">WIND</div><div style="${valueStyle}color:#1a73e8;">WIRD GELADEN</div></div>
                    <div style="display:flex;gap:7px;">
                        <div><div style="${labelStyle}">VIS</div><div style="${valueStyle}">--</div></div>
                        <div><div style="${labelStyle}">WX</div><div style="${valueStyle}">--</div></div>
                    </div>
                    <div style="display:flex;gap:7px;">
                        <div><div style="${labelStyle}">TEMP</div><div style="${valueStyle}">--</div></div>
                        <div><div style="${labelStyle}">DEWP</div><div style="${valueStyle}">--</div></div>
                    </div>
                    <div style="display:flex;gap:7px;">
                        <div><div style="${labelStyle}">QNH</div><div style="${valueStyle}">--</div></div>
                        <div><div style="${labelStyle}">COVER</div><div style="${valueStyle}">--</div></div>
                    </div>
                </div>
                <div class="ga-weather-windrose"
                     aria-label="${runway ? `Piste ${_escapeMetarWidgetText(runway.end1)}/${_escapeMetarWidgetText(runway.end2)}` : 'Piste wird geladen'}"
                     style="position:relative;width:min(100%,148px);height:auto;aspect-ratio:1;flex:0 1 auto;align-self:center;margin:2px auto 0;border:4px solid #a8a291;border-radius:50%;background:#fcfaf5;box-shadow:inset 0 2px 8px rgba(0,0,0,.1),0 2px 6px rgba(0,0,0,.2);">
                    <svg viewBox="0 0 160 160" style="position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;">
                        ${_renderMetarCompassTicks()}
                    </svg>
                    ${_renderMetarRunwayLayer(runway)}
                </div>
            </div>
        </div>`;
};

async function loadMetarWidget(icao, containerId, lat, lon, forceModern = false, options = {}) {
    let container = document.getElementById(containerId);
    if (!container) return;
    const loadOptions = options && typeof options === 'object' ? options : {};
    const commitAllowed = () => typeof _dispatchUiCommitAllowed !== 'function' || _dispatchUiCommitAllowed(loadOptions);
    if (!commitAllowed()) return;
    const requestedRunwayIcao = String(loadOptions.runwayIcao || '').trim().toUpperCase();

    // Zwingt das Widget ins "Modern"-Design, auch wenn das Retro-Theme aktiv ist (wichtig für Karten-Popups)
    const isRetro = !forceModern && document.body.classList.contains('theme-retro');
    const isOps1940 = !forceModern && document.body.classList.contains('theme-ops1940');
    if (!loadOptions.preserveLoadingContent || !String(container.innerHTML || '').trim()) {
        if (isRetro || isOps1940) {
            container.style.boxShadow = 'none';
            container.style.background = 'transparent';
            container.innerHTML = '<div style="padding:20px; text-align:center; color:#555; font-family: \'Caveat\', cursive; font-size:22px; transform: rotate(-1deg);">Sucht lokales Wetter...</div>';
        } else {
            container.style.boxShadow = '';
            container.style.background = '';
            container.innerHTML = '<div style="padding:20px; text-align:center; color:#888; font-size:12px; background:#1a1a1a; border-radius:6px;">Sucht lokales Wetter...</div>';
        }
    }

    const hasCoordinates = Number.isFinite(Number(lat)) && Number.isFinite(Number(lon));
    if (icao === 'POI' || (!icao && !hasCoordinates)) {
        container.style.display = 'none';
        return;
    }
    const icaoNorm = String(icao || '').trim().toUpperCase();
    const looksLikeIcao = /^[A-Z0-9]{4}$/.test(icaoNorm);
    const weatherLocationLabel = icaoNorm || 'diesem Platz';
    container.style.display = 'block';

    try {
        let metarDataList = [];
        let isFallback = false;
        let foundIcao = icaoNorm;

        // Zehn Minuten gültiger In-Memory-Cache. Neben exakten Platz-/Koordinaten-
        // Schlüsseln werden komplette METAR-Regionen gehalten, damit ein weiterer
        // Flugplatz im selben Gebiet seine Station sofort und eindeutig wiederverwenden kann.
        _pruneMetarMemoryCache();
        const cacheKey = (icaoNorm || 'COORDS') + (hasCoordinates ? `_${Number(lat).toFixed(2)}_${Number(lon).toFixed(2)}` : '');
        const cachedEntry = _getMetarMemoryEntry(cacheKey) || _getMetarMemoryEntry(icaoNorm);
        if (cachedEntry) {
            metarDataList = cachedEntry.data;
            isFallback = cachedEntry.isFallback;
            foundIcao = cachedEntry.foundIcao;
        } else {
            const cachedRegion = hasCoordinates ? _getCachedMetarRegionForPoint(lat, lon) : null;
            const cachedRegionSelection = cachedRegion
                ? _selectMetarForAirport(cachedRegion.data, icaoNorm, lat, lon)
                : null;
            if (cachedRegionSelection?.station) {
                metarDataList = [cachedRegionSelection.station];
                isFallback = cachedRegionSelection.isFallback;
                foundIcao = String(
                    cachedRegionSelection.station.icaoId
                    || cachedRegionSelection.station.icao
                    || icaoNorm
                ).trim().toUpperCase();
            } else if (looksLikeIcao) {
                const directUrl = `https://aviationweather.gov/api/data/metar?ids=${icaoNorm}&format=json&t=${Date.now()}`;
                const mainData = await _fetchMetarArrayViaVariants(directUrl, {
                    includeCodeTabs: true,
                    includeDirect: false,
                    retries: 2,
                    timeoutMs: 3500,
                    retryDelayMs: 350
                });
                if (!commitAllowed()) return;
                if (Array.isArray(mainData)) metarDataList = mainData;
            }

            if ((!metarDataList || metarDataList.length === 0) && hasCoordinates) {
                const latMin = lat - 0.6, latMax = lat + 0.6;
                const lonMin = lon - 0.8, lonMax = lon + 0.8;
                const fbUrl = `https://aviationweather.gov/api/data/metar?bbox=${latMin},${lonMin},${latMax},${lonMax}&format=json&t=${Date.now()}`;
                const fbData = await _fetchMetarArrayViaVariants(fbUrl, {
                    includeCodeTabs: true,
                    includeDirect: false,
                    retries: 2,
                    timeoutMs: 3500,
                    retryDelayMs: 350
                });
                if (!commitAllowed()) return;
                if (Array.isArray(fbData)) {
                    _storeMetarRegion(fbData, { latMin, lonMin, latMax, lonMax });
                    try {
                        const selection = _selectMetarForAirport(fbData, icaoNorm, lat, lon);
                        if (selection?.station) {
                            metarDataList = [selection.station];
                            foundIcao = String(
                                selection.station.icaoId
                                || selection.station.icao
                                || icaoNorm
                            ).trim().toUpperCase();
                            isFallback = selection.isFallback;
                        }
                    } catch (parseErr) {
                        console.error("Failed to process fallback METAR JSON", parseErr);
                    }
                }
            }

            // Ergebnis in den Cache legen
            const cacheEntry = {
                data: metarDataList,
                isFallback,
                foundIcao,
                cachedAt: Date.now()
            };
            _setMetarMemoryEntry(cacheKey, cacheEntry);
            // Dieselbe Station kann in Karte und Wetterübersicht leicht
            // abweichende Koordinaten haben. Der ICAO-Alias vermeidet dann
            // eine zweite identische METAR-Abfrage.
            if (icaoNorm && Array.isArray(metarDataList) && metarDataList.length > 0) {
                _setMetarMemoryEntry(icaoNorm, cacheEntry);
            }
            if (foundIcao && Array.isArray(metarDataList) && metarDataList.length > 0) {
                _setMetarMemoryEntry(`STATION:${foundIcao}`, {
                    data: metarDataList,
                    isFallback: false,
                    foundIcao,
                    cachedAt: cacheEntry.cachedAt
                });
            }

        } // Ende der Cache-Else-Bedingung

        // Kontext-Popups werden während parallel laufender Gelände-/Luftraum-
        // Abfragen neu gerendert. Danach immer das aktuell sichtbare Ziel
        // verwenden statt eines inzwischen abgehängten DOM-Knotens.
        if (!commitAllowed()) return;
        container = document.getElementById(containerId);
        if (!container) return;

        if (!Array.isArray(metarDataList)) metarDataList = [];
        metarDataList = metarDataList.filter(m => m && typeof m === 'object');

        if (!metarDataList || metarDataList.length === 0) {
            const loadingCard = container.querySelector?.('[data-ga-metar-loading="true"]');
            if (loadOptions.preserveLoadingContent && loadingCard) {
                const status = loadingCard.querySelector('.ga-weather-loading-status');
                if (status) {
                    status.textContent = 'KEIN METAR';
                    status.style.color = '#a61b12';
                    status.style.borderColor = '#c85b51';
                }
                const windValue = loadingCard.querySelector('.ga-weather-layout > div > div:first-child > div:last-child');
                if (windValue) {
                    windValue.textContent = '--';
                    windValue.style.color = '#555';
                }
                loadingCard.removeAttribute('data-ga-metar-loading');
                return;
            }
            if (isRetro) {
                container.innerHTML = `
                    <div style="padding:15px; text-align:center; font-family: 'Caveat', cursive; transform: rotate(1deg);">
                        <div style="color:#d93829; font-weight:bold; font-size: 22px; margin-bottom:5px;">Kein METAR in der Nähe von ${weatherLocationLabel}</div>
                        <div style="font-size:18px; color:#555; margin-bottom:12px;">Kein automatisches Wetter verfügbar.</div>
                        ${looksLikeIcao ? `<a data-ga-airport-weather="${icaoNorm}" href="https://metar-taf.com/de/${icaoNorm}" target="_blank" style="display:inline-block; color:#0b1f65; font-size:20px; font-weight:bold; text-decoration:underline;">Manuell suchen ➔</a>` : ''}
                    </div>`;
            } else {
                container.innerHTML = `
                    <div style="background:#1a1a1a; border-radius:6px; padding:15px; text-align:center; border: 1px solid #333;">
                        <div style="color:#d93829; font-weight:bold; margin-bottom:5px;">Kein METAR in der Nähe von ${weatherLocationLabel}</div>
                        <div style="font-size:11px; color:#888; margin-bottom:12px;">Für diesen Bereich steht kein automatisches Wetter zur Verfügung.</div>
                        ${looksLikeIcao ? `<a data-ga-airport-weather="${icaoNorm}" href="https://metar-taf.com/de/${icaoNorm}" target="_blank" style="display:inline-block; background:#4da6ff; color:#111; padding:6px 12px; border-radius:4px; text-decoration:none; font-size:12px; font-weight:bold; transition: background 0.2s;">Manuell suchen ➔</a>` : ''}
                    </div>`;
            }
            return;
        }

        const metar = metarDataList[0];
        if (!metar || typeof metar !== 'object') {
            container.innerHTML = `<div style="padding:10px; text-align:center; color:#d93829; font-size:12px; background:#1a1a1a;">Kein verwertbares METAR für ${icao} gefunden.</div>`;
            return;
        }
        const raw = typeof metar.rawOb === 'string'
            ? metar.rawOb
            : (typeof metar.raw === 'string' ? metar.raw : "");
        const temp = metar.temp != null ? metar.temp + '°C' : '--';
        const dewp = metar.dewp != null ? metar.dewp + '°C' : '--';
        let catColor = "#fff";
        let catText = metar.fltCat || "N/A";
        if (catText === "VFR") catColor = "#33ff33";
        else if (catText === "MVFR") catColor = "#4da6ff";
        else if (catText === "IFR") catColor = "#ff3333";
        else if (catText === "LIFR") catColor = "#ff33ff";

        let cover = metar.cover || "--";
        if (cover === "Clear") cover = "CLR";

        let visib = metar.visib !== undefined && metar.visib !== null ? metar.visib + ' sm' : '--';
        const visMatch = raw.match(/\s(\d{4})\s/);
        if (raw.includes(' 9999 ')) visib = '> 10 km';
        else if (visMatch && !visMatch[1].startsWith('0000')) visib = parseInt(visMatch[1], 10) + ' m';
        let wx = metar.wxString ? metar.wxString.replace(/,/g, ' ') : 'NIL';

        let qnhStr = "--";
        const qMatch = raw.match ? raw.match(/Q(\d{4})/) : null;
        const aMatch = raw.match ? raw.match(/A(\d{4})/) : null;
        if (qMatch) qnhStr = qMatch[1] + ' hPa';
        else if (aMatch) qnhStr = Math.round((parseInt(aMatch[1]) / 100) * 33.8639) + ' hPa';

        let wdir = metar.wdir, wspd = metar.wspd || 0, wgst = metar.wgst ? `G${metar.wgst}` : '';
        let isVRB = raw.match ? /VRB\d{2,3}KT/.test(raw) : (wdir === "VRB");
        let windText = isVRB ? `VRB / ${wspd}${wgst} kt` : `${wdir}° / ${wspd}${wgst} kt`;
        if (wspd === 0) windText = "Calm (0 kt)";

        const isMini = containerId.startsWith('wxPopup');
        const isResponsiveEmbed = !isMini && Boolean(loadOptions.responsiveEmbed);
        // Bei einem METAR-Fallback bleibt die Pistenvisualisierung am
        // angefragten Flugplatz. Nur das Wetter stammt von der Ersatzstation.
        const runwayIcao = requestedRunwayIcao || (looksLikeIcao ? icaoNorm : foundIcao);

        // Für Vollansicht: auf Pisten-Daten warten; für Mini-Popup direkt aus Cache lesen
        let retries = 0;
        if (!isMini && !loadOptions.skipRunwayWait) {
            while (runwayIcao && !runwayCache[runwayIcao] && retries < 15) {
                await new Promise(r => setTimeout(r, 200));
                if (!commitAllowed()) return;
                retries++;
            }
        }
        if (!commitAllowed()) return;
        container = document.getElementById(containerId);
        if (!container) return;

        let rwyHdg = 0; let rwy1 = ""; let rwy2 = "";
        {
            const rData = runwayIcao ? runwayCache[runwayIcao] : null;
            if (rData && !rData.includes('Keine Daten')) {
                const match = rData.match(/(?:^|\s|\n|<br\s*\/?>)(0[1-9]|[12]\d|3[0-6])([LRC]?)\s*\/\s*((?:0[1-9]|[12]\d|3[0-6])[LRC]?)/);
                if (match) { rwyHdg = parseInt(match[1], 10) * 10; rwy1 = match[1] + match[2]; rwy2 = match[3]; }
            }
        }

        const headerText = isFallback ? `Nearest: ${foundIcao}` : `Station: ${icaoNorm}`;
        const modernHeaderText = isFallback ? `▶ NEAREST: ${foundIcao}` : `▶ STATION: ${icaoNorm}`;

        if (isRetro) {
            let svgTicks = `
                <circle cx="80" cy="80" r="70" stroke="#444" stroke-width="1.5" fill="none" stroke-dasharray="30.65 6" transform="rotate(2.45 80 80)"/>
                <circle cx="80" cy="80" r="3" fill="#444" />`;

            // Füge N, O, S, W und 30-Grad-Schritte rotierend hinzu
            for (let i = 0; i < 360; i += 30) {
                const angleRad = (i - 90) * Math.PI / 180;
                const radius = 61;
                const tx = 80 + radius * Math.cos(angleRad);
                const ty = 80 + radius * Math.sin(angleRad);

                // dx="-2" gleicht den kursiven Schwung (Slant) von Caveat aus, der sonst wie eine Rechtsrotation wirkt
                if (i % 90 === 0) {
                    let letter = i === 0 ? 'N' : (i === 90 ? 'O' : (i === 180 ? 'S' : 'W'));
                    svgTicks += `<text x="${tx}" y="${ty}" dx="-2" font-family="'Caveat', cursive" font-size="22" fill="#222" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${i} ${tx} ${ty})">${letter}</text>`;
                } else {
                    svgTicks += `<text x="${tx}" y="${ty}" dx="-1.5" font-family="'Caveat', cursive" font-size="14" fill="#666" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${i} ${tx} ${ty})">${i / 10}</text>`;
                }
            }

            let rwyHtml = '';
            if (rwy1 && rwy2) {
                // Piste wurde oben und unten gekürzt (y="29", height="102") um Abstand zu den Zahlen zu gewinnen
                rwyHtml = `
                    <g transform="translate(80,80) rotate(${rwyHdg}) translate(-80,-80)">
                        <rect x="68" y="29" width="24" height="102" fill="none" stroke="#222" stroke-width="1.5" stroke-dasharray="30 4 15 4"/>
                        <text x="80" y="43" font-family="'Caveat', cursive" font-size="14" fill="#111" font-weight="bold" text-anchor="middle" transform="rotate(180 80 39)">${rwy2}</text>
                        <text x="80" y="125" font-family="'Caveat', cursive" font-size="14" fill="#111" font-weight="bold" text-anchor="middle">${rwy1}</text>
                    </g>`;
            }

            let arrowHtml = '';
            if (!isVRB && wspd > 0 && wdir !== null && wdir !== "VRB") {
                arrowHtml = `
                <g transform="rotate(${wdir} 80 80)">
                    <path d="M 80 10 C 77 30, 83 50, 80 65" stroke="#1a73e8" stroke-width="2.5" fill="none" stroke-linecap="round"/>
                    <path d="M 74 54 L 80 68 L 86 52" stroke="#1a73e8" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                </g>`;
            }

            container.innerHTML = `
                <div style="font-family: 'Caveat', cursive; color: #222; padding: 5px; position:relative;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid rgba(0,0,0,0.5); padding-bottom: 2px; margin-bottom: 12px;">
                        <span style="font-size: 24px; font-weight: bold; color: #0b1f65; transform: rotate(-1deg); display: inline-block;">${headerText}</span>
                        <span style="font-size: 18px; font-weight: bold; color: ${catColor}; border: 2px solid ${catColor}; padding: 0 6px; border-radius: 3px; transform: rotate(2deg); display: inline-block; box-shadow: 1px 1px 0 rgba(0,0,0,0.1);">${catText}</span>
                    </div>
                    <div style="font-size: 17px; line-height: 1.25; margin-bottom: 15px; color: #333; padding-left: 12px; border-left: 2px solid rgba(0,0,0,0.2); transform: rotate(0.5deg);">
                        ${raw}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                        <div style="font-size: 20px; line-height: 1.3; display: flex; flex-direction: column; gap: 2px;">
                            <div><span style="color:#666; font-size: 16px;">Wind:</span> <b style="color:#1a73e8; font-size:22px;">${windText}</b></div>
                            <div><span style="color:#666; font-size: 16px;">Vis:</span> <b>${visib}</b> <span style="color:#666; font-size: 16px; margin-left:8px;">Wx:</span> <b>${wx}</b></div>
                            <div><span style="color:#666; font-size: 16px;">Temp:</span> <b>${temp}</b> <span style="color:#666; font-size: 16px; margin-left:8px;">Dew:</span> <b>${dewp}</b></div>
                            <div><span style="color:#666; font-size: 16px;">QNH:</span> <b>${qnhStr}</b> <span style="color:#666; font-size: 16px; margin-left:8px;">Cloud:</span> <b>${cover}</b></div>
                        </div>
                        <div style="position:relative; width: 130px; height: 130px; flex-shrink: 0;">
                            <svg viewBox="0 0 160 160" style="width:100%; height:100%; overflow:visible;">
                                ${svgTicks}${rwyHtml}${arrowHtml}
                            </svg>
                        </div>
                    </div>
                </div>`;
        } else {
            let svgTicks = '';
            for (let i = 0; i < 360; i += 5) {
                const isCard = i % 90 === 0, isLong = i % 10 === 0;
                const len = isCard ? 8 : (isLong ? 5 : 3), sw = isCard ? 2 : 1, col = isCard ? '#111' : '#888';
                svgTicks += `<line x1="80" y1="2" x2="80" y2="${2 + len}" stroke="${col}" stroke-width="${sw}" transform="rotate(${i} 80 80)" />`;
                if (i % 30 === 0 && !isCard) {
                    const angleRad = (i - 90) * Math.PI / 180, tx = 80 + 61 * Math.cos(angleRad), ty = 80 + 61 * Math.sin(angleRad);
                    svgTicks += `<text x="${tx}" y="${ty}" font-family="sans-serif" font-size="10" fill="#333" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${i} ${tx} ${ty})">${i / 10}</text>`;
                } else if (isCard) {
                    const angleRad = (i - 90) * Math.PI / 180, tx = 80 + 61 * Math.cos(angleRad), ty = 80 + 61 * Math.sin(angleRad);
                    let letter = i === 0 ? 'N' : (i === 90 ? 'O' : (i === 180 ? 'S' : 'W'));
                    svgTicks += `<text x="${tx}" y="${ty}" font-family="sans-serif" font-size="14" fill="#111" font-weight="bold" text-anchor="middle" dominant-baseline="central" transform="rotate(${i} ${tx} ${ty})">${letter}</text>`;
                }
            }
            let arrowHtml = '';
            if (!isVRB && wspd > 0 && wdir !== null && wdir !== "VRB") {
                arrowHtml = `
                <svg viewBox="0 0 160 160" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:10; pointer-events:none;">
                    <g transform="rotate(${wdir} 80 80)">
                        <line x1="80" y1="6" x2="80" y2="70" stroke="#1a73e8" stroke-width="4" stroke-linecap="round"/>
                        <polygon points="72,55 80,80 88,55" fill="#1a73e8" />
                    </g>
                </svg>`;
            }

            let rwyHtmlModern = '';
            if (rwy1 && rwy2) {
                const rwyW = isMini ? '15px' : '26px';
                const rwyH = isMini ? '60px' : '105px';
                const rwyFSize = isMini ? '8px' : '10px';
                rwyHtmlModern = `
                <div style="position:absolute; top:50%; left:50%; width:${rwyW}; height:${rwyH}; background:#444; border:1px solid #111; border-radius: 3px; transform: translate(-50%, -50%) rotate(${rwyHdg}deg); transform-origin: center center; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding: 3px 0; box-sizing: border-box; z-index:5; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">
                    <div style="width:100%; text-align:center; font-size:${rwyFSize}; line-height:1; color:#fff; font-weight:bold; transform: rotate(180deg); font-family: sans-serif;">${rwy2}</div>
                    <div style="width:2px; flex-grow:1; margin: 3px 0; background: repeating-linear-gradient(to bottom, #d4d4d4 0, #d4d4d4 6px, transparent 6px, transparent 12px);"></div>
                    <div style="width:100%; text-align:center; font-size:${rwyFSize}; line-height:1; color:#fff; font-weight:bold; font-family: sans-serif;">${rwy1}</div>
                </div>`;
            }

            const cSize = isMini ? '90px' : (isResponsiveEmbed ? 'min(100%, 148px)' : '160px');
            const cHeight = isResponsiveEmbed ? 'auto' : cSize;
            let gap = isMini ? 4 : (isResponsiveEmbed ? 3 : 8);
            let fVal = isMini ? 12 : (isResponsiveEmbed ? 13 : 15);
            let fLbl = isMini ? 9 : (isResponsiveEmbed ? 8 : 10);
            const rowGap = isResponsiveEmbed ? 7 : 12;
            let pPad = isMini ? '10px' : (isResponsiveEmbed ? '10px' : '15px 15px 20px 15px');
            const weatherFont = isOps1940 ? "'Caveat', cursive" : "'Courier New', Courier, monospace";
            const weatherOuterFont = isOps1940 ? "'Caveat', cursive" : "'Arial', sans-serif";
            const rawTextSafe = raw && raw.trim() ? raw : 'RAW nicht verfügbar';
            const miniDecoded = `${visib} · ${wx} · ${temp} / ${dewp} · ${cover}`;

            container.innerHTML = `
                <div class="ga-weather-card" style="${isMini ? 'background:none; border:none; box-shadow:none; padding:4px 0;' : `background:#f0eada; border-radius:12px; padding:${pPad}; border: 3px solid #c2bba8; box-shadow: 0 4px 8px rgba(0,0,0,0.2), inset 0 2px 5px rgba(255,255,255,0.5);`} font-family:${weatherOuterFont}; color: #333; position:relative; overflow:hidden;">

                    ${!isMini ? `
                    <div style="position:absolute; top:6px; left:6px; width:6px; height:6px; background:#ddd; border-radius:50%; box-shadow: inset 0 0 2px #555;"></div>
                    <div style="position:absolute; bottom:6px; right:6px; width:6px; height:6px; background:#ddd; border-radius:50%; box-shadow: inset 0 0 2px #555;"></div>
                    <div style="position:absolute; top:6px; right:6px; width:6px; height:6px; background:#ddd; border-radius:50%; box-shadow: inset 0 0 2px #555;"></div>
                    <div style="position:absolute; bottom:6px; left:6px; width:6px; height:6px; background:#ddd; border-radius:50%; box-shadow: inset 0 0 2px #555;"></div>
                    ` : ''}

                    <div style="color:#8a1a12; font-size:${isResponsiveEmbed ? 12 : 14}px; font-weight:bold; margin-bottom:${isMini ? 6 : (isResponsiveEmbed ? 5 : 12)}px; ${isMini ? '' : 'border-bottom:2px dashed #c2bba8;'} padding-bottom:${isMini ? 0 : (isResponsiveEmbed ? 4 : 8)}px; font-family:${weatherFont}; display:flex; justify-content:space-between; align-items:center; letter-spacing:0.5px;">
                        <span>${modernHeaderText}</span>
                        <span style="color:${catColor}; font-size:${isResponsiveEmbed ? 12 : 14}px; padding:${isResponsiveEmbed ? '1px 5px' : '2px 8px'}; border:2px solid ${catColor}; border-radius:4px; background:rgba(255,255,255,0.7); box-shadow:0 1px 2px rgba(0,0,0,0.1);">${catText}</span>
                    </div>
                    ${!isMini && !isResponsiveEmbed ? `<div style="background:#e6e0ce; color:#333; font-family:${weatherFont}; padding:10px; border-radius:4px; font-size:11.5px; margin-bottom:18px; border: 1px inset #c2bba8; line-height: 1.4; letter-spacing: 0.5px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">${rawTextSafe}</div>` : ''}
                    ${isMini ? `<div style="background:#ece6d6; color:#2f2f2f; font-family:${weatherFont}; padding:6px 8px; border-radius:4px; font-size:10px; margin-bottom:8px; border:1px solid #c8c0ac; line-height:1.35; word-break:break-word;">${rawTextSafe}<br><span style="color:#555;">${miniDecoded}</span></div>` : ''}
                    <div class="ga-weather-layout${isResponsiveEmbed ? ' ga-weather-layout-responsive' : ''}" style="display:flex; justify-content:space-between; align-items:${isResponsiveEmbed ? 'stretch' : 'center'}; gap:${isResponsiveEmbed ? 5 : 8}px;${isResponsiveEmbed ? ' flex-direction:column;' : ''}">
                        <div style="display:flex; flex-direction:column; gap:${gap}px; font-family:${weatherFont}; flex-shrink: 1; min-width: 0;">
                            <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">WIND</div><div style="color:#1a73e8; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${windText}</div></div>
                            ${!isMini ? `
                            <div style="display:flex; gap:${rowGap}px;">
                                <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">VIS</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${visib}</div></div>
                                <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">WX</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${wx}</div></div>
                            </div>
                            <div style="display:flex; gap:${rowGap}px;">
                                <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">TEMP</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${temp}</div></div>
                                <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">DEWP</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${dewp}</div></div>
                            </div>` : ''}
                            <div style="display:flex; gap:${rowGap}px;">
                                <div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">QNH</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${qnhStr}</div></div>
                                ${!isMini ? `<div><div style="color:#666; font-size:${fLbl}px; font-weight:bold; letter-spacing:1px;">COVER</div><div style="color:#111; font-size:${fVal}px; font-weight:bold; white-space: nowrap;">${cover}</div></div>` : ''}
                            </div>
                        </div>
                        <div class="ga-weather-windrose" style="position:relative; width:${cSize}; height:${cHeight}; aspect-ratio:1; flex:${isResponsiveEmbed ? '0 1 auto' : '0 0 auto'}; align-self:${isResponsiveEmbed ? 'center' : 'auto'}; ${isMini ? 'margin-left:auto;' : (isResponsiveEmbed ? 'margin:2px auto 0;' : '')} border:4px solid #a8a291; border-radius:50%; background:#fcfaf5; box-shadow:inset 0 2px 8px rgba(0,0,0,0.1), 0 2px 6px rgba(0,0,0,0.2);">
                            <svg viewBox="0 0 160 160" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:1; pointer-events:none;">
                                ${svgTicks}
                            </svg>
                            ${rwyHtmlModern}
                            ${arrowHtml}
                        </div>
                    </div>
                </div>`;
        }
    } catch (err) {
        console.error("METAR fetch error:", err);
        if (!commitAllowed()) return;
        container = document.getElementById(containerId);
        if (!container) return;
        const loadingCard = container.querySelector?.('[data-ga-metar-loading="true"]');
        if (loadOptions.preserveLoadingContent && loadingCard) {
            const status = loadingCard.querySelector('.ga-weather-loading-status');
            if (status) {
                status.textContent = 'METAR FEHLER';
                status.style.color = '#a61b12';
                status.style.borderColor = '#c85b51';
            }
            const windValue = loadingCard.querySelector('.ga-weather-layout > div > div:first-child > div:last-child');
            if (windValue) {
                windValue.textContent = '--';
                windValue.style.color = '#555';
            }
            loadingCard.removeAttribute('data-ga-metar-loading');
            return;
        }
        const isRetro = document.body.classList.contains('theme-retro');
        const isOps1940 = document.body.classList.contains('theme-ops1940');
        if (isRetro || isOps1940) {
            container.innerHTML = `<div style="padding:10px; text-align:center; color:#d93829; font-family: 'Caveat', cursive; font-size:20px; transform: rotate(-1deg);">Fehler beim Laden des METARs: <br/>${err.message || err}</div>`;
        } else {
            container.innerHTML = `<div style="padding:10px; text-align:center; color:#d93829; font-size:12px; background:#1a1a1a;">Fehler beim Laden des METARs: <br/>${err.message || err}</div>`;
        }
    }
}
