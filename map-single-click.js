/* Shared Standalone airport/navpoint selection and tooltip/panel modes. */
function setMapSingleClickMode(mode, { persist = true } = {}) {
    const normalized = MAP_SINGLE_CLICK_MODES.includes(mode) ? mode : 'off';
    mapSingleClickMode = normalized;
    window.mapSingleClickMode = normalized;
    pendingMapInfoTapSeq += 1;
    clearMapSingleClickTooltip();
    if (normalized !== 'panels') {
        if (airportInfoPopupLayer?._map === map) map.closePopup(airportInfoPopupLayer);
        if (navaidInfoPopupLayer?._map === map) map.closePopup(navaidInfoPopupLayer);
        if (reportingPointInfoPopupLayer?._map === map) map.closePopup(reportingPointInfoPopupLayer);
    }
    if (persist) localStorage.setItem(MAP_SINGLE_CLICK_MODE_KEY, normalized);
    refreshMapHintMenuUi();
    return normalized;
}

window.getMapSingleClickMode = getMapSingleClickMode;
window.setMapSingleClickMode = setMapSingleClickMode;
window.cycleMapSingleClickMode = function() {
    const currentIndex = MAP_SINGLE_CLICK_MODES.indexOf(getMapSingleClickMode());
    return setMapSingleClickMode(MAP_SINGLE_CLICK_MODES[(currentIndex + 1) % MAP_SINGLE_CLICK_MODES.length]);
};

function getOpenAipAirportTooltip(airport) {
    const normalized = normalizeOpenAipAirportForPopup(airport);
    const icao = normalized?.icao || String(airport?.icaoCode || airport?.icao || '').trim().toUpperCase();
    const name = normalized?.name || String(airport?.name || icao || 'Flugplatz').trim();
    const runwayText = (
        (typeof formatOpenAipAirportRunways === 'function' ? formatOpenAipAirportRunways(airport) : '')
        || (icao && typeof runwayCache !== 'undefined' ? String(runwayCache?.[icao] || '') : '')
    );
    const runwayLabels = runwayText
        .split(/\s*(?:\||\n|<br\s*\/?>)\s*/i)
        .map(line => String(line || '').split(/\s+[–—-]\s+/)[0].trim())
        .filter(label => /^(?:0[1-9]|[12]\d|3[0-6])[LRC]?\s*\/\s*(?:0[1-9]|[12]\d|3[0-6])[LRC]?$/i.test(label))
        .slice(0, 3);
    const frequencies = typeof getMapContextAirportFrequencies === 'function'
        ? getMapContextAirportFrequencies(airport, icao)
        : [];
    return `
        <span class="ga-airport-hover-tooltip">
            <b>${escapePopupText(icao || 'APT')}</b> · ${escapePopupText(name)}
            ${runwayLabels.length ? `<br><span>PISTE&nbsp; ${escapePopupText(runwayLabels.join(' · '))}</span>` : ''}
            ${frequencies.length ? `<br><span>FREQ&nbsp;&nbsp; ${escapePopupText(frequencies[0])}</span>` : ''}
        </span>`;
}


function findNearestAirport(latlng, maxPixels) {
    if (typeof maxPixels === 'undefined') maxPixels = 60;
    if (!map) return null;
    const tapPx = map.latLngToLayerPoint(latlng);
    let best = null, bestDist = maxPixels + 1;

    // 1. cachedNavData (OpenAIP airports)
    cachedNavData.forEach(nav => {
        if (nav.type !== 'APT' && !nav.name.startsWith('APT ')) return;
        const navPx = map.latLngToLayerPoint([nav.lat, nav.lng]);
        const d = tapPx.distanceTo(navPx);
        if (d < bestDist) {
            bestDist = d;
            const parts = nav.name.replace('APT ', '').split(' (');
            const icao = String(nav.airportIcao || parts[0] || '').trim().toUpperCase();
            best = {
                icao,
                name: nav.airportName || parts[0].trim(),
                lat: nav.lat,
                lon: nav.lng,
                sourceId: nav.sourceId || '',
                country: nav.country || ''
            };
        }
    });
    if (best) return best;

    // 2. Der Regions-Snapshot ist oft deutlich früher verfügbar als die große
    // globale Airport-Datei. Direkt daraus suchen, damit schon der erste Tap sitzt.
    const regionAirports = Array.isArray(openAipRegionState?.payload?.airports)
        ? openAipRegionState.payload.airports
        : [];
    for (const airport of regionAirports) {
        const apt = normalizeOpenAipAirportForPopup(airport);
        if (!apt) continue;
        const aptPx = map.latLngToLayerPoint([apt.lat, apt.lon]);
        const d = tapPx.distanceTo(aptPx);
        if (d < bestDist) {
            bestDist = d;
            best = apt;
        }
    }
    if (best) return best;

    // 3. Lokale Airport-Datenbank. Sie ist auch ohne sichtbares
    // OpenAIP-Overlay geladen und muss deshalb vor einem nahen DME gewinnen
    // können.
    const airportDatabase = getAirportDatabaseForMapClicks();
    if (airportDatabase) {
        const latF = latlng.lat, lngF = latlng.lng;
        for (const icao in airportDatabase) {
            const apt = airportDatabase[icao];
            const aptLat = Number(apt?.lat);
            const aptLon = Number(apt?.lon ?? apt?.lng);
            if (!Number.isFinite(aptLat) || !Number.isFinite(aptLon)) continue;
            if (Math.abs(aptLat - latF) > 0.5 || Math.abs(aptLon - lngF) > 0.5) continue;
            const aptPx = map.latLngToLayerPoint([aptLat, aptLon]);
            const d = tapPx.distanceTo(aptPx);
            if (d < bestDist) {
                bestDist = d;
                const aptIcao = String(apt?.icao || icao || '').trim().toUpperCase();
                best = { icao: aptIcao, name: apt.name || apt.n || apt.city || aptIcao, lat: aptLat, lon: aptLon, elevation: apt.elevation ?? null };
            }
        }
    }
    return best;
}

function findNearestMapNavigationPoint(latlng, maxPixels) {
    if (!map) return null;
    const tapPx = map.latLngToLayerPoint(latlng);
    let best = null;
    let bestDist = Number(maxPixels) + 1;
    const consider = (nav) => {
        if (nav?.type !== 'NAVAID' && nav?.type !== 'RPP') return;
        const lat = Number(nav?.lat);
        const lon = Number(nav?.lng);
        if (![lat, lon].every(Number.isFinite)) return;
        const pointPx = map.latLngToLayerPoint([lat, lon]);
        const distance = tapPx.distanceTo(pointPx);
        if (distance < bestDist) {
            bestDist = distance;
            best = nav;
        }
    };
    (Array.isArray(cachedNavData) ? cachedNavData : []).forEach(consider);

    // Die lokalen OpenAIP-Fallbacks stehen unabhängig von Snapping und
    // Kartenoverlay zur Verfügung. Dadurch funktionieren Tooltip/Tafel auch
    // dann, wenn cachedNavData für die aktuelle Ansicht noch leer ist.
    const viewBounds = getOpenAipNavaidCacheBounds();
    getStaticOpenAipNavaidEntries(viewBounds).forEach(consider);
    getStaticOpenAipReportingPointEntries(viewBounds).forEach(consider);
    return best;
}

function findNearestMapInfoObject(latlng) {
    const radius = getAirportTapRadiusPx(34);
    const airport = findNearestAirport(latlng, radius);
    const navigationPoint = findNearestMapNavigationPoint(latlng, radius);
    if (!airport && !navigationPoint) return null;

    // Während die lokale Airport-Datei noch lädt, darf ein bereits verfügbares
    // DME den Tap nicht vorzeitig verbrauchen. Der asynchrone Retry löst den
    // Treffer unmittelbar nach dem Laden noch einmal auf.
    if (
        !airport
        && !getAirportDatabaseForMapClicks()
        && storedAirportOverlayState.loadPromise
    ) {
        return null;
    }
    if (airport && navigationPoint && map) {
        const tapPx = map.latLngToLayerPoint(latlng);
        const airportPx = map.latLngToLayerPoint([airport.lat, airport.lon]);
        const navaidPx = map.latLngToLayerPoint([navigationPoint.lat, navigationPoint.lng]);
        const airportDistance = tapPx.distanceTo(airportPx);
        const navigationDistance = tapPx.distanceTo(navaidPx);
        // Bei praktisch identischer Position gehört der sichtbare Platz zum
        // Airport; ansonsten entscheidet der näher angetippte Kartenpunkt.
        if (airportDistance <= navigationDistance + 2) {
            return { kind: 'airport', data: airport };
        }
    } else if (airport) {
        return { kind: 'airport', data: airport };
    }
    if (!navigationPoint) return { kind: 'airport', data: airport };
    return {
        kind: navigationPoint.type === 'RPP' ? 'vrp' : 'navaid',
        data: navigationPoint
    };
}

function getMapNavigationPointTooltip(point) {
    if (!point) return '';
    if (point.type === 'RPP') {
        const raw = point?.rppData && typeof point.rppData === 'object' ? point.rppData : point;
        const name = String(raw?.name || point?.name || 'VFR-Meldepunkt').replace(/^RPP\s+/i, '').trim();
        const airportIcao = String(raw?.airportIcao || point?.rppAirportIcao || '').trim().toUpperCase();
        return `
            <span class="ga-airport-hover-tooltip ga-map-point-hover-tooltip">
                <b>VRP</b> · ${escapePopupText(name)}
                ${airportIcao ? `<br><span>FLUGPLATZ&nbsp; ${escapePopupText(airportIcao)}</span>` : ''}
            </span>`;
    }
    const nav = normalizeOpenAipNavaidForPopup(point);
    if (!nav) return '';
    const title = nav.identifier || 'NAVAID';
    const frequency = nav.frequencyValue
        ? `${nav.frequencyValue}${nav.frequencyUnit ? ` ${nav.frequencyUnit}` : ''}`
        : '';
    return `
        <span class="ga-airport-hover-tooltip ga-map-point-hover-tooltip">
            <b>${escapePopupText(title)}</b> · ${escapePopupText(nav.name)}
            <br><span>${escapePopupText(getOpenAipNavaidTypeLabel(nav.type))}${frequency ? `&nbsp; ${escapePopupText(frequency)}` : ''}</span>
        </span>`;
}

let mapSingleClickTooltipLayer = null;
let mapSingleClickTooltipTimer = null;

function clearMapSingleClickTooltip() {
    if (mapSingleClickTooltipTimer) {
        clearTimeout(mapSingleClickTooltipTimer);
        mapSingleClickTooltipTimer = null;
    }
    if (map && mapSingleClickTooltipLayer && map.hasLayer(mapSingleClickTooltipLayer)) {
        map.removeLayer(mapSingleClickTooltipLayer);
    }
    mapSingleClickTooltipLayer = null;
}

function openMapPointSingleClickTooltip(match) {
    if (!map || getMapSingleClickMode() !== 'tooltip' || !match) return false;
    const isAirport = match.kind === 'airport';
    const normalizedAirport = isAirport
        ? normalizeOpenAipAirportForPopup(match.data)
        : null;
    if (isAirport && !normalizedAirport) return false;
    const rawCoordinates = match.data?.geometry?.coordinates
        || match.data?.navaidData?.geometry?.coordinates
        || match.data?.rppData?.geometry?.coordinates;
    const anchorLat = Number(normalizedAirport?.lat ?? match.data?.lat ?? match.data?.rppData?.lat ?? rawCoordinates?.[1]);
    const anchorLon = Number(normalizedAirport?.lon ?? match.data?.lng ?? match.data?.lon ?? match.data?.rppData?.lon ?? rawCoordinates?.[0]);
    if (![anchorLat, anchorLon].every(Number.isFinite)) return false;
    const anchor = L.latLng(anchorLat, anchorLon);
    const content = isAirport
        ? getOpenAipAirportTooltip(match.data)
        : getMapNavigationPointTooltip(match.data);
    if (!content) return false;

    clearMapSingleClickTooltip();
    mapSingleClickTooltipLayer = L.tooltip({
        direction: 'top',
        offset: [0, -8],
        opacity: 1,
        className: 'airspace-tooltip ga-airport-tooltip-shell ga-map-point-click-tooltip'
    })
        .setLatLng(anchor)
        .setContent(content)
        .addTo(map);
    mapSingleClickTooltipTimer = setTimeout(clearMapSingleClickTooltip, 5200);
    return true;
}

function openNearestMapTooltipAt(latlng) {
    if (!map || getMapSingleClickMode() !== 'tooltip') return false;
    return openMapPointSingleClickTooltip(findNearestMapInfoObject(latlng));
}

function openNearestMapInfoAt(latlng) {
    if (getMapSingleClickMode() !== 'panels') return false;
    const match = findNearestMapInfoObject(latlng);
    if (!match) return false;
    if (match.kind === 'airport') {
        openAirportInfoPopup(match.data);
        return true;
    }
    if (match.kind === 'navaid') {
        openNavaidInfoPopup(match.data);
    } else {
        openReportingPointInfoPopup(match.data);
    }
    return true;
}

function resolveMapSingleClickAt(latlng) {
    const mode = getMapSingleClickMode();
    if (mode === 'tooltip') return openNearestMapTooltipAt(latlng);
    if (mode === 'panels') return openNearestMapInfoAt(latlng);
    return false;
}


let pendingMapInfoTapSeq = 0;

function scheduleMapInfoTapResolution(latlng) {
    if (getMapSingleClickMode() === 'off') return;
    const seq = ++pendingMapInfoTapSeq;
    const tap = L.latLng(latlng.lat, latlng.lng);
    const tasks = window.gaMapSingleClickHost ? [window.gaMapSingleClickHost.load(tap)] : [
        Promise.resolve(ensureOpenAipRegionSnapshot()),
        Promise.resolve(ensureGlobalAirportsForMapClicks()),
        Promise.resolve(loadStoredAirportOverlayDatabase()),
        Promise.resolve(loadOpenAipStaticNavaids()),
        Promise.resolve(loadOpenAipStaticReportingPoints())
    ];
    let resolved = false;
    const retry = () => {
        if (resolved || seq !== pendingMapInfoTapSeq || !map) return;
        if (resolveMapSingleClickAt(tap)) {
            resolved = true;
            pendingMapInfoTapSeq += 1;
        }
    };
    tasks.forEach(task => task.then(retry, () => {}));
    if (
        !getAirportDatabaseForMapClicks()
        || !Array.isArray(window.gaMapSingleClickHost ? cachedNavData : openAipStaticNavaidState.items)
        || !Array.isArray(window.gaMapSingleClickHost ? cachedNavData : openAipStaticReportingPointState.items)
    ) {
        showMapToast('Flugplatz- und Funkfeuerdaten laden – Auswahl wird automatisch nachgeholt', 2400);
    }
}


let navaidInfoPopupLayer = null;

function getOpenAipPopupSourceLabel(source) {
    const normalized = String(source || '').toLowerCase();
    if (normalized === 'hosted') return 'GA Aviation DB (OpenAIP)';
    if (normalized.startsWith('static')) return 'OpenAIP-Fallback';
    if (normalized.includes('legacy')) return 'OpenAIP Legacy';
    return 'OpenAIP V2';
}

function openNavaidInfoPopup(navaid) {
    if (!map) return;
    const nav = normalizeOpenAipNavaidForPopup(navaid);
    if (!nav) return;
    const title = nav.identifier
        ? `${escapePopupText(nav.identifier)} · ${escapePopupText(nav.name)}`
        : escapePopupText(nav.name);
    const typeLabel = getOpenAipNavaidTypeLabel(nav.type);
    const sourceLabel = getOpenAipPopupSourceLabel(nav.source);
    const lines = [
        `<div style="font-size:11px; line-height:1.65;"><b>Typ:</b> ${escapePopupText(typeLabel)}`,
        nav.frequencyValue
            ? `<b>Frequenz:</b> ${escapePopupText(nav.frequencyValue)}${nav.frequencyUnit ? ` ${escapePopupText(nav.frequencyUnit)}` : ''}`
            : '<b>Frequenz:</b> Keine Angabe',
        nav.channel ? `<b>Kanal:</b> ${escapePopupText(nav.channel)}` : '',
        nav.rangeValue
            ? `<b>Reichweite:</b> ${escapePopupText(nav.rangeValue)}${nav.rangeUnit ? ` ${escapePopupText(nav.rangeUnit)}` : ''}`
            : '',
        nav.country ? `<b>Land:</b> ${escapePopupText(nav.country)}` : '',
        `<b>Position:</b> ${nav.lat.toFixed(5)}, ${nav.lon.toFixed(5)}`,
        `<span style="color:#666;">Quelle: ${escapePopupText(sourceLabel)}</span></div>`
    ].filter(Boolean).join('<br>');
    const content = `
        <div style="font-family:'Courier New',monospace; min-width:190px; color:#111;">
            <b style="font-size:13px;">${title}</b>
            <hr style="border-color:#ccc; margin:5px 0;">
            ${lines}
        </div>`;
    if (!navaidInfoPopupLayer) navaidInfoPopupLayer = L.popup({ maxWidth: 285 });
    navaidInfoPopupLayer
        .setLatLng([nav.lat, nav.lon])
        .setContent(content)
        .openOn(map);
}

let reportingPointInfoPopupLayer = null;

function openReportingPointInfoPopup(point) {
    if (!map || !point) return;
    const raw = point?.rppData && typeof point.rppData === 'object' ? point.rppData : point;
    const coords = raw?.geometry?.coordinates;
    const lat = Number(raw?.lat ?? point?.lat ?? coords?.[1]);
    const lon = Number(raw?.lon ?? raw?.lng ?? point?.lng ?? coords?.[0]);
    if (![lat, lon].every(Number.isFinite)) return;
    const name = String(raw?.name || point?.name || 'VFR-Meldepunkt').replace(/^RPP\s+/i, '').trim();
    const airportIcao = String(raw?.airportIcao || point?.rppAirportIcao || '').trim().toUpperCase();
    const description = String(raw?.description || '').trim();
    const sourceLabel = getOpenAipPopupSourceLabel(point?.rppSource);
    const content = `
        <div style="font-family:'Courier New',monospace; min-width:185px; color:#111;">
            <b style="font-size:13px;">VRP ${escapePopupText(name)}</b>
            <hr style="border-color:#ccc; margin:5px 0;">
            <div style="font-size:11px; line-height:1.65;">
                ${airportIcao ? `<b>Flugplatz:</b> ${escapePopupText(airportIcao)}<br>` : ''}
                <b>Position:</b> ${lat.toFixed(5)}, ${lon.toFixed(5)}
                ${description ? `<br><span style="color:#555;">${escapePopupText(description)}</span>` : ''}
                <br><span style="color:#666;">Quelle: ${escapePopupText(sourceLabel)}</span>
            </div>
        </div>`;
    if (!reportingPointInfoPopupLayer) reportingPointInfoPopupLayer = L.popup({ maxWidth: 285 });
    reportingPointInfoPopupLayer
        .setLatLng([lat, lon])
        .setContent(content)
        .openOn(map);
}


function normalizeOpenAipAirportForPopup(airport) {
    return window.GAMapNavpointCore.normalizeAirport(airport);
}
