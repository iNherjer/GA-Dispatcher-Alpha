// Standalone frequency matching, priorities and labels shared with EFB.
async function fetchAirportFreq(icao, elementId, type, airportHint = null, options = {}) {
    const fetch = window.gaChecklistHost?.fetch || window.fetch.bind(window);
    const el = document.getElementById(elementId);
    const commitAllowed = () => typeof _dispatchUiCommitAllowed !== 'function' || _dispatchUiCommitAllowed(options);
    if (!commitAllowed()) return null;
    if (el) el.innerText = '📻 Sucht Frequenz...';
    const proxy = 'https://ga-proxy.einherjer.workers.dev';
    const icaoQuery = String(icao || '').trim().toUpperCase();
    const hintSourceId = String(airportHint?.sourceId || airportHint?.id || airportHint?._id || '').trim();

    const freqLabelMap = {
        'TWR': 'Turm', 'TOWER': 'Turm',
        'GND': 'Rollkontrolle', 'GROUND': 'Rollkontrolle',
        'ATIS': 'Information', 'INFO': 'Information',
        'RADIO': 'Radio', 'CTAF': 'Radio', 'UNICOM': 'Radio', 'MULTICOM': 'Radio',
        'APP': 'Anflug', 'APPROACH': 'Anflug',
        'DEP': 'Abflug', 'DEPARTURE': 'Abflug',
        'FIS': 'FIS', 'APRON': 'Vorfeld', 'AWOS': 'AWOS'
    };
    const pickIcao = (apt) => String(
        apt?.icao ||
        apt?.icaoCode ||
        apt?.ident ||
        apt?.code ||
        apt?.designator ||
        apt?.gpsCode ||
        apt?.localCode ||
        ''
    ).trim().toUpperCase();

    try {
        let items = [];
        if (typeof window.gaGetAviationCollectionForBounds === 'function') {
            if (!airportHint && (!globalAirports || Object.keys(globalAirports).length === 0)) {
                await loadGlobalAirports();
                if (!commitAllowed()) return null;
            }
            const directAirport = globalAirports?.[icaoQuery];
            const resolvedAirport = directAirport
                ? { code: icaoQuery, airport: directAirport }
                : (typeof getBestAirportSearchResult === 'function' ? getBestAirportSearchResult(icaoQuery, { auto: true }) : null);
            const airport = directAirport
                || (resolvedAirport?.code ? globalAirports?.[resolvedAirport.code] : null)
                || airportHint;
            const lat = Number(airport?.lat);
            const lon = Number(airport?.lon ?? airport?.lng);
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
                const lonPadding = 0.4 / Math.max(0.25, Math.abs(Math.cos((lat * Math.PI) / 180)));
                items = await window.gaGetAviationCollectionForBounds('airports', {
                    west: Math.max(-180, lon - lonPadding),
                    south: Math.max(-90, lat - 0.4),
                    east: Math.min(180, lon + lonPadding),
                    north: Math.min(90, lat + 0.4)
                });
                if (!commitAllowed()) return null;
            }
        }
        const directSearchIdent = (typeof airportRealIcao === 'function' ? airportRealIcao(airportHint || {}) : '') || icaoQuery;
        if (!items.length && /^[A-Z0-9]{2,8}$/.test(directSearchIdent) && !directSearchIdent.startsWith('OA-')) {
            // Nur für ältere Builds oder Plätze ohne bekannte Koordinate bleibt
            // die direkte OpenAIP-Suche als letzter Kompatibilitätsfallback.
            const res = await fetch(`${proxy}/api/airports?search=${encodeURIComponent(directSearchIdent)}&limit=25&t=${Date.now()}`);
            if (!commitAllowed()) return null;
            const data = await res.json();
            if (!commitAllowed()) return null;
            items = Array.isArray(data?.items) ? data.items : [];
        }
        if (items.length > 0) {
            const exactById = hintSourceId
                ? items.find(apt => String(apt?.id || apt?._id || '').trim() === hintSourceId)
                : null;
            const exact = exactById || items.find(apt => pickIcao(apt) === icaoQuery);
            let nearest = null;
            const hintLat = Number(airportHint?.lat);
            const hintLon = Number(airportHint?.lon ?? airportHint?.lng);
            if (!exact && Number.isFinite(hintLat) && Number.isFinite(hintLon)) {
                let nearestNm = Infinity;
                for (const candidate of items) {
                    const coords = candidate?.geometry?.coordinates;
                    if (!Array.isArray(coords) || coords.length < 2) continue;
                    const candidateLon = Number(coords[0]);
                    const candidateLat = Number(coords[1]);
                    if (!Number.isFinite(candidateLat) || !Number.isFinite(candidateLon)) continue;
                    const nm = calcNav(hintLat, hintLon, candidateLat, candidateLon).dist;
                    if (nm < nearestNm) {
                        nearestNm = nm;
                        nearest = candidate;
                    }
                }
                if (nearestNm > 3) nearest = null;
            }
            // Für 4-stellige ICAO-Abfragen nur exakte Treffer zulassen
            const strictIcaoSearch = /^[A-Z0-9]{4}$/.test(icaoQuery) && !airportHint;
            const apt = exact || nearest || (!strictIcaoSearch ? items[0] : null);
            if (!apt) {
                if (el) el.innerText = '';
                freqCache[icaoQuery] = [];
                return null;
            }

            // Elevation aus OpenAIP (unit 0 = Meter, 1 = Fuß)
            if (apt.elevation != null) {
                const ev = apt.elevation.value;
                const elevFt = apt.elevation.unit === 1 ? ev : Math.round(ev * 3.28084);
                if (type === 'dep')  { currentDepElev  = elevFt; }
                if (type === 'dest') { currentDestElev = elevFt; }
            }

            if (apt.frequencies && apt.frequencies.length > 0) {

                // Bestimme die relevanteste Frequenz (Tower > Info > Radio)
                const prio = { 'TOWER': 1, 'TWR': 1, 'INFO': 2, 'INFORMATION': 2, 'ATIS': 2, 'RADIO': 3, 'CTAF': 3, 'UNICOM': 3, 'MULTICOM': 3, 'APP': 4, 'APPROACH': 4 };
                let bestF = apt.frequencies[0];
                let bestScore = 99;
                apt.frequencies.forEach(f => {
                    const n = (f.name || '').toUpperCase().trim();
                    const score = prio[n] || 99;
                    if (score < bestScore) { bestScore = score; bestF = f; }
                });

                // Speichere NUR den Zahlenwert für die Routen-Tabelle
                const bestFreqValue = bestF.value;
                if (type === 'dep') currentDepFreq = bestFreqValue;
                if (type === 'dest') currentDestFreq = bestFreqValue;

                if (typeof updateRoutePerformance === 'function') updateRoutePerformance();

                // Für die Detail-Anzeige auf der Karte alle formatieren
                const labeledFreqs = apt.frequencies.map(f => {
                    const fName = (f.name || '').toUpperCase().trim();
                    const label = freqLabelMap[fName] || f.name || 'Freq';
                    return { label: label, value: f.value };
                });
                const lines = labeledFreqs.map(lf => `📻 ${lf.label}: ${lf.value}`);
                if (el) el.innerHTML = lines.join('<br>');

                freqCache[icaoQuery] = labeledFreqs;
                return bestFreqValue;
            }
        }
        if (el) el.innerText = '';
        freqCache[icaoQuery] = []; // Mark as fetched but empty
    } catch (e) {
        if (!commitAllowed()) return null;
        if (el) el.innerText = '';
        freqCache[icaoQuery] = []; // Mark as fetched but empty
    } finally {
        window.gaChecklistHost?.airportUpdated?.();
    }
    return null;
}
