// Shared standalone popup implementation; host adapters supply local data only.
function _buildAptPopup(label, name, elev, icaoForRunways, options = {}) {
    const rwCacheKey = icaoForRunways || (label === 'DEP' ? currentStartICAO : currentDestICAO);
    const wxContainerId = options.wxContainerId || (label === 'DEP' ? 'wxPopupDep' : 'wxPopupDest');
    const runwayContainerId = options.runwayContainerId || null;
    const freqContainerId = options.freqContainerId || null;
    const countryCode = options.countryCode || '';
    const compactLayout = Boolean(options.compactLayout);
    const dividerMargin = compactLayout ? '2px 0' : '5px 0';
    const detailLineHeight = compactLayout ? '1.28' : '1.7';
    const titleHtml = options.title || `<b style="font-size:13px;">${label}: ${name || '–'}</b>`;
    const showDirectTo = Boolean(options.showDirectTo && icaoForRunways && Number.isFinite(options.lat) && Number.isFinite(options.lon));
    const aipUrl = icaoForRunways ? getAipPopupUrl(icaoForRunways, countryCode) : null;
    const showAip = Boolean(aipUrl);
    const icaoSafe = sanitizeAipIcaoKey(icaoForRunways || '');
    const icaoEsc = escapeJsSingleQuoted(icaoSafe);
    const countryEsc = escapeJsSingleQuoted(String(countryCode || '').toUpperCase());
    const opacityPct = Math.round((typeof getAipCurrentOpacity === 'function' ? getAipCurrentOpacity(icaoSafe) : 0.65) * 100);
    let html = `<div class="${compactLayout ? 'ga-airport-popup-compact' : ''}" style="font-family:'Courier New',monospace; min-width:${compactLayout ? '0' : '190px'}; color:#111;">`;
    html += titleHtml;

    if (elev != null) {
        const elevRnd = Math.round(elev);
        const tpa = elevRnd + 1000;
        html += `<hr style="border-color:#ccc; margin:${dividerMargin};">`;
        html += `<div style="font-size:11px; line-height:${detailLineHeight};">`;
        html += compactLayout
            ? `<span class="ga-airport-altitude-line">📍 <b>${elevRnd} ft<span class="ga-airport-altitude-desktop-only"> MSL</span></b> · 🔄 <span class="ga-airport-altitude-desktop-only">TPA </span><b><span class="ga-airport-altitude-desktop-only">~</span>${tpa} ft</b></span>`
            : `📍 Platz: <b>${elevRnd} ft MSL</b><br>🔄 Platzrunde: <b>~${tpa} ft MSL</b>`;
        html += `</div>`;
    }

    const runwayHtml = (() => {
        if (!rwCacheKey || typeof runwayCache === 'undefined' || !runwayCache[rwCacheKey] || runwayCache[rwCacheKey] === 'Keine Daten gefunden') {
            return runwayContainerId
                ? `<div id="${runwayContainerId}" style="font-size:11px; line-height:${detailLineHeight}; color:#666;">Pisten laden…</div>`
                : '';
        }

        const rwys = runwayCache[rwCacheKey]
            .split(/\s*(?:\||\n|<br\s*\/?>)\s*/i)
            .filter(r => r.trim());

        if (rwys.length === 0) return '';
        const lines = compactLayout
            ? `🛫 ${rwys.join('<br>🛫 ')}`
            : `🛫 Pisten:<br>${rwys.map(r => `&nbsp;&nbsp;${r}`).join('<br>')}`;
        return runwayContainerId
            ? `<div id="${runwayContainerId}" style="font-size:11px; line-height:${detailLineHeight};">${lines}</div>`
            : `<div style="font-size:11px; line-height:${detailLineHeight};">${lines}</div>`;
    })();

    if (runwayHtml) {
        html += `<hr style="border-color:#ccc; margin:${dividerMargin};">`;
        html += runwayHtml;
    }

    if (icaoForRunways) {
        html += `<hr style="border-color:#ccc; margin:${dividerMargin};">`;
        const freqBody = buildPopupFrequencyLines(icaoForRunways);
        html += freqContainerId
            ? `<div id="${freqContainerId}" style="font-size:11px; line-height:${compactLayout ? '1.25' : '1.6'};">${freqBody}</div>`
            : `<div style="font-size:11px; line-height:${compactLayout ? '1.25' : '1.6'};">${freqBody}</div>`;
    }

    if (showAip) {
        html += `<hr style="border-color:#ccc; margin:${dividerMargin};">`;
        html += `<a data-ga-airport-aip="${escapePopupText(icaoSafe)}" data-country="${escapePopupText(countryCode)}" href="${aipUrl}" target="_blank" rel="noopener noreferrer" style="display:block; font-size:11px; text-decoration:none; color:#0b1f65; font-weight:bold;">📄 AIP VFR ${window.gaAirportPopupHost?.openAip ? 'im PC-Browser öffnen' : 'öffnen'} ↗</a>`;
        if (typeof AIP_CHART_UI_ENABLED !== 'undefined' && AIP_CHART_UI_ENABLED) {
            html += `<div style="margin-top:6px; border:1px solid #ddd; border-radius:5px; padding:6px; background:#f8f8f8;">`;
            html += `<div class="aip-overlay-status" data-aip-icao="${icaoSafe}" style="font-size:10px; color:#444; margin-bottom:6px;">Overlay aus</div>`;
            html += `<button onclick="window.loadAipChartOverlay('${icaoEsc}','${countryEsc}')" style="display:block; width:100%; background:#235ea7; color:#fff; border:none; padding:6px 8px; cursor:pointer; border-radius:3px; font-size:11px; margin-bottom:4px;">🗺️ Overlay laden</button>`;
            html += `<button class="aip-calibrate-btn" data-aip-icao="${icaoSafe}" onclick="window.startAipChartCalibration('${icaoEsc}')" style="display:block; width:100%; background:#7c4d9e; color:#fff; border:none; padding:6px 8px; cursor:pointer; border-radius:3px; font-size:11px; margin-bottom:6px;">🎯 Kalibrieren (2 Punkte)</button>`;
            html += `<div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">`;
            html += `<span style="font-size:10px; color:#555; min-width:64px;">Transparenz</span>`;
            html += `<input class="aip-opacity-slider" data-aip-icao="${icaoSafe}" type="range" min="15" max="100" value="${opacityPct}" oninput="window.setAipChartOpacity(this.value, '${icaoEsc}'); this.nextElementSibling.textContent=this.value+'%';" style="flex:1;">`;
            html += `<span class="aip-opacity-value" data-aip-icao="${icaoSafe}" style="font-size:10px; color:#222; min-width:34px; text-align:right;">${opacityPct}%</span>`;
            html += `</div>`;
            html += `<button onclick="window.clearAipChartOverlay()" style="display:block; width:100%; background:#666; color:#fff; border:none; padding:5px 8px; cursor:pointer; border-radius:3px; font-size:10px;">Overlay aus</button>`;
            html += `</div>`;
        }
    }

    html += `<hr style="border-color:#ccc; margin:${dividerMargin};">`;
    html += `<div id="${wxContainerId}" style="min-height:${compactLayout ? '24px' : '36px'};">`;
    html += `<div style="font-size:10px; color:#aaa; text-align:center; padding:${compactLayout ? '4px' : '8px'} 0;">Wetter lädt…</div>`;
    html += `</div>`;

    if (showDirectTo) {
        const encodedName = encodeURIComponent(options.directToName || name || icaoForRunways);
        html += `<button onclick="window.confirmAirportDirectTo('${icaoForRunways}', ${Number(options.lat)}, ${Number(options.lon)}, '${encodedName}')" style="margin-top:${compactLayout ? '4px' : '8px'}; width:100%; background:#1f7a45; color:#fff; border:none; padding:${compactLayout ? '6px 8px' : '8px 10px'}; cursor:pointer; border-radius:4px; font-weight:bold;">✈️ Direct To</button>`;
    }

    html += `</div>`;
    return html;
}

function getAirportDisplayName(apt) {
    return apt?.name || apt?.n || apt?.city || apt?.icao || 'Flugplatz';
}

function normalizeAirportForMap(apt) {
    if (!apt) return null;
    return {
        icao: String(apt.icao || apt.ident || '').trim().toUpperCase(),
        name: getAirportDisplayName(apt),
        lat: Number(apt.lat),
        lon: Number(apt.lon ?? apt.lng),
        elevation: apt.elevation ?? null,
        country: apt.country || apt.iso_country || apt.cc || '',
        sourceId: String(apt.sourceId || apt._id || apt.id || '').trim()
    };
}

const AIRPORT_INFO_POPUP_CACHE_TTL_MS = 15 * 60 * 1000;
const AIRPORT_INFO_POPUP_CACHE_MAX = 32;
const airportInfoPopupCache = new Map();
let airportInfoPopupLayer = null;

function getAirportInfoPopupCacheKey(apt) {
    if (!apt) return '';
    if (apt.icao) return `icao:${apt.icao}`;
    if (apt.sourceId) return `source:${apt.sourceId}`;
    return `pos:${apt.lat.toFixed(5)},${apt.lon.toFixed(5)}`;
}

function rememberAirportInfoPopupEntry(key, entry) {
    airportInfoPopupCache.delete(key);
    airportInfoPopupCache.set(key, entry);
    while (airportInfoPopupCache.size > AIRPORT_INFO_POPUP_CACHE_MAX) {
        const oldestKey = airportInfoPopupCache.keys().next().value;
        if (!oldestKey) break;
        airportInfoPopupCache.delete(oldestKey);
    }
}

function updateAirportInfoPopupFrequency(entry, icao) {
    if (!entry || !entry.content || !icao) return;
    const el = entry.content.querySelector(`#${entry.freqId}`);
    if (!el) return;
    el.innerHTML = buildPopupFrequencyLines(icao);
}

function openAirportInfoPopup(airport) {
    if (!map) return;
    const apt = normalizeAirportForMap(airport);
    if (!apt || !apt.icao || !Number.isFinite(apt.lat) || !Number.isFinite(apt.lon)) return;

    const cacheKey = getAirportInfoPopupCacheKey(apt);
    const now = Date.now();
    let entry = airportInfoPopupCache.get(cacheKey);
    if (entry && (now - entry.createdAt) >= AIRPORT_INFO_POPUP_CACHE_TTL_MS) {
        airportInfoPopupCache.delete(cacheKey);
        entry = null;
    }

    const popupIdSafe = apt.icao.replace(/[^a-zA-Z0-9_-]/g, '_');
    const runwayId = `wxRwy_${popupIdSafe}`;
    const freqId = `wxFreq_${popupIdSafe}`;
    // Prefix "wxPopup" erzwingt im Widget die gleiche kompakte Start/Ziel-Darstellung
    const wxId = `wxPopupApt_${popupIdSafe}`;

    if (!entry) {
        const elev = apt.elevation ?? (globalAirports?.[apt.icao]?.elevation ?? null);
        const countryCode = getAirportCountryCode(apt.icao, apt.country);
        const title = `<b style="font-size:13px;">${apt.icao}</b><div style="font-size:11px; color:#555; margin-top:2px;">${apt.name}</div>`;
        const content = document.createElement('div');
        content.innerHTML = _buildAptPopup('APT', apt.name, elev, apt.icao, {
            title,
            wxContainerId: wxId,
            runwayContainerId: runwayId,
            freqContainerId: freqId,
            countryCode,
            showDirectTo: true,
            directToName: apt.name,
            lat: apt.lat,
            lon: apt.lon
        });
        entry = {
            createdAt: now,
            content,
            runwayId,
            freqId,
            wxId,
            loadingStarted: false
        };
    }
    rememberAirportInfoPopupEntry(cacheKey, entry);

    if (!airportInfoPopupLayer) airportInfoPopupLayer = L.popup({ maxWidth: 290 });
    airportInfoPopupLayer
        // Immer am kanonischen Flugplatz statt am zufälligen Klickpunkt verankern.
        .setLatLng([apt.lat, apt.lon])
        .setContent(entry.content)
        .openOn(map);
    if (typeof refreshAipOverlayPopupUi === 'function') setTimeout(() => refreshAipOverlayPopupUi(apt.icao), 0);
    updateAirportInfoPopupFrequency(entry, apt.icao);

    // Pisten dürfen nach einem temporären Quellenfehler beim nächsten Öffnen
    // erneut versucht werden; positive und echte Leerdaten werden separat gecacht.
    if (typeof fetchRunwayDetails === 'function') {
        fetchRunwayDetails(apt.lat, apt.lon, entry.runwayId, apt.icao);
    }

    // Frequenzen und Wetter pro Popup-Eintrag nur einmal starten. Derselbe
    // Flugplatz behält seinen DOM- und Ladezustand über Folgeklicks.
    if (entry.loadingStarted) return;
    entry.loadingStarted = true;
    if (typeof fetchAirportFreq === 'function') {
        const hasCachedFrequencies = (
            typeof freqCache !== 'undefined'
            && Object.prototype.hasOwnProperty.call(freqCache, apt.icao)
        );
        if (!hasCachedFrequencies) {
            fetchAirportFreq(apt.icao, null, null)
                .finally(() => updateAirportInfoPopupFrequency(entry, apt.icao));
        }
    }
    if (typeof loadMetarWidget === 'function') {
        loadMetarWidget(apt.icao, entry.wxId, apt.lat, apt.lon, true);
    }
}

function getOpenAipNavaidTypeLabel(type) {
    const labels = {
        0: 'DME',
        1: 'TACAN',
        2: 'NDB',
        3: 'VOR',
        4: 'VOR/DME',
        5: 'VORTAC',
        6: 'DVOR',
        7: 'DVOR/DME',
        8: 'DVORTAC'
    };
    const key = Number(type);
    return Object.prototype.hasOwnProperty.call(labels, key) ? labels[key] : 'Funkfeuer';
}

function normalizeOpenAipNavaidForPopup(navaid, source = '') {
    const raw = navaid?.navaidData && typeof navaid.navaidData === 'object'
        ? navaid.navaidData
        : navaid;
    if (!raw) return null;
    const sourceId = String(raw?._id || raw?.id || navaid?.sourceId || '').trim();
    const staticItem = sourceId && typeof openAipStaticNavaidState !== 'undefined' && openAipStaticNavaidState.byId instanceof Map
        ? openAipStaticNavaidState.byId.get(sourceId)
        : null;
    const item = staticItem ? { ...staticItem, ...raw } : raw;
    const coords = item?.geometry?.coordinates;
    const lat = Number(item?.lat ?? navaid?.lat ?? coords?.[1]);
    const lon = Number(item?.lon ?? item?.lng ?? navaid?.lng ?? coords?.[0]);
    if (![lat, lon].every(Number.isFinite)) return null;

    const frequency = item?.frequency ?? (Array.isArray(item?.frequencies) ? item.frequencies[0] : null);
    const frequencyValue = typeof frequency === 'object'
        ? String(frequency?.value ?? '').trim()
        : String(frequency ?? '').trim();
    const frequencyUnitCode = Number(typeof frequency === 'object' ? frequency?.unit : NaN);
    const frequencyUnit = frequencyUnitCode === 1
        ? 'kHz'
        : (frequencyUnitCode === 2 ? 'MHz' : '');
    const rangeValue = typeof item?.range === 'object'
        ? String(item.range?.value ?? '').trim()
        : String(item?.range ?? '').trim();
    const rangeUnit = Number(item?.range?.unit) === 2 ? 'NM' : '';
    const identifier = String(
        item?.identifier
        || item?.designator
        || navaid?.navaidIdentifier
        || ''
    ).trim().toUpperCase();
    return {
        id: sourceId,
        name: String(item?.name || identifier || 'Funkfeuer').trim(),
        identifier,
        type: item?.type ?? navaid?.navaidType ?? null,
        country: String(item?.country || '').trim().toUpperCase(),
        frequencyValue,
        frequencyUnit,
        channel: String(item?.channel || '').trim().toUpperCase(),
        rangeValue,
        rangeUnit,
        lat,
        lon,
        source: String(source || navaid?.navaidSource || 'live')
    };
}

function escapePopupText(v) {
    return String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeJsSingleQuoted(v) {
    return String(v ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '')
        .replace(/\n/g, ' ');
}

function sanitizeAipIcaoKey(icao) {
    return String(icao || '').trim().toUpperCase();
}

function abbreviateMapFrequencyLabel(label) {
    const replacements = [
        [/\bFLIGHT\s+INFORMATION\s+SERVICE\b/gi, 'FIS'],
        [/\bCLEARANCE\s+DELIVERY\b/gi, 'CLR DEL'],
        [/\bROLLKONTROLLE\b/gi, 'GND'],
        [/\bGROUND\b/gi, 'GND'],
        [/\bTOWER\b/gi, 'TWR'],
        [/\bTURM\b/gi, 'TWR'],
        [/\bRADIO\b/gi, 'RDO'],
        [/\bINFORMATION\b/gi, 'INFO'],
        [/\bAPPROACH\b/gi, 'APP'],
        [/\bANFLUG\b/gi, 'APP'],
        [/\bDEPARTURE\b/gi, 'DEP'],
        [/\bABFLUG\b/gi, 'DEP'],
        [/\bAPRON\b/gi, 'APR'],
        [/\bVORFELD\b/gi, 'APR'],
        [/\bCLEARANCE\b/gi, 'CLR'],
        [/\bDELIVERY\b/gi, 'DEL']
    ];
    let result = String(label || 'FREQ').trim();
    replacements.forEach(([pattern, replacement]) => {
        result = result.replace(pattern, replacement);
    });
    return result.replace(/\s+/g, ' ').trim().toUpperCase() || 'FREQ';
}

function buildPopupFrequencyLines(icao) {
    if (!icao || typeof freqCache === 'undefined' || !Array.isArray(freqCache[icao])) {
        return '<span style="color:#666;">Frequenzen laden…</span>';
    }
    if (freqCache[icao].length === 0) {
        return '<span style="color:#666;">Keine Frequenzen verfügbar</span>';
    }
    return freqCache[icao]
        .slice(0, 6)
        .map((f) => `
            <span class="ga-popup-frequency-row">
                <span class="ga-popup-frequency-label">📻 ${escapePopupText(abbreviateMapFrequencyLabel(f.label || 'Freq'))}</span>
                <span class="ga-popup-frequency-value">${escapePopupText(f.value || '--')}</span>
            </span>`)
        .join('');
}

function updatePopupFrequencyBlock(containerId, icao) {
    if (!containerId || !icao) return;
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = buildPopupFrequencyLines(icao);
}

function getAirportTapRadiusPx(basePx = 34) {
    if (!map || !map.getZoom) return basePx;
    const z = map.getZoom();
    // Beim Rauszoomen deutlich kleinerer Clickspot, beim Reinzoomen komfortabel.
    // z=7 -> ~10px, z=10 -> ~19px, z=14 -> ~34px
    const scaled = 10 + ((z - 7) / 7) * (basePx - 10);
    const coarsePointer = Boolean(
        (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches)
        || Number(navigator.maxTouchPoints) > 0
    );
    const minimum = coarsePointer ? Math.min(basePx, 28) : 8;
    return Math.max(minimum, Math.min(basePx, Math.round(scaled)));
}


// Only the EFB host delegates external pages to the authenticated PC tool.
// Standalone keeps its normal browser links.
document.addEventListener('click', function(event) {
    const link = event.target?.closest?.('[data-ga-airport-aip], [data-ga-airport-weather]');
    if (!link || !window.gaAirportPopupHost?.openAip) return;
    event.preventDefault();
    event.stopPropagation();
    if (link.dataset.opening === 'true') return;
    link.dataset.opening = 'true';
    const original = link.dataset.linkLabel || link.textContent;
    link.dataset.linkLabel = original;
    link.textContent = 'Browser wird geöffnet…';
    Promise.resolve().then(() => window.gaAirportPopupHost[link.dataset.gaAirportWeather ? 'openWeather' : 'openAip']({
        icao: link.dataset.gaAirportWeather || link.dataset.gaAirportAip, country: link.dataset.country
    })).then(() => { link.textContent = original; }, () => {
        link.textContent = 'Öffnen fehlgeschlagen – erneut versuchen';
    }).finally(() => { delete link.dataset.opening; });
});

function bindRouteAirportPopup(marker, isStart, latlng) {
        if (isStart) {
            marker.bindPopup('');
            marker.on('popupopen', () => {
                const depCountry = getAirportCountryCode(currentStartICAO);
                marker.getPopup().setContent(_buildAptPopup('DEP', currentSName, currentDepElev, currentStartICAO, {
                    runwayContainerId: 'wxPopupDepRwy',
                    freqContainerId: 'wxPopupDepFreq',
                    countryCode: depCountry,
                    showDirectTo: currentStartICAO && currentStartICAO !== 'GPS' && currentStartICAO !== currentDestICAO,
                    directToName: currentSName,
                    lat: latlng.lat,
                    lon: latlng.lng || latlng.lon
                }));
                marker.getPopup().update();
                const depIcao = currentStartICAO;
                if (depIcao && typeof refreshAipOverlayPopupUi === 'function') setTimeout(() => refreshAipOverlayPopupUi(depIcao), 0);
                if (depIcao && depIcao !== 'GPS' && typeof fetchRunwayDetails === 'function') {
                    fetchRunwayDetails(latlng.lat, latlng.lng || latlng.lon, 'wxPopupDepRwy', depIcao);
                }
                if (depIcao && depIcao !== 'GPS' && typeof fetchAirportFreq === 'function') {
                    updatePopupFrequencyBlock('wxPopupDepFreq', depIcao);
                    fetchAirportFreq(depIcao, null, null).finally(() => updatePopupFrequencyBlock('wxPopupDepFreq', depIcao));
                }
                if (depIcao && typeof loadMetarWidget === 'function') {
                    loadMetarWidget(depIcao, 'wxPopupDep', latlng.lat, latlng.lng || latlng.lon, true);
                }
            });
        } else {
            marker.bindPopup('');
            marker.on('popupopen', () => {
                const missionLikePoi = !!(
                    currentMissionData
                    && (
                        currentMissionData.poiName
                        || currentMissionData.poiPresentation
                        || (typeof missionUsesPoiTaskRecipe === 'function' && missionUsesPoiTaskRecipe(currentMissionData))
                    )
                );
                const icao = missionLikePoi ? currentStartICAO : currentDestICAO;
                const elev = missionLikePoi ? currentDepElev : currentDestElev;
                const destCountry = getAirportCountryCode(icao);
                marker.getPopup().setContent(_buildAptPopup('DEST', currentDName, elev, icao, {
                    runwayContainerId: 'wxPopupDestRwy',
                    freqContainerId: 'wxPopupDestFreq',
                    countryCode: destCountry,
                    showDirectTo: Boolean(icao && icao !== currentDestICAO),
                    directToName: currentDName,
                    lat: latlng.lat,
                    lon: latlng.lng || latlng.lon
                }));
                marker.getPopup().update();
                if (icao && typeof refreshAipOverlayPopupUi === 'function') setTimeout(() => refreshAipOverlayPopupUi(icao), 0);
                if (icao && typeof fetchRunwayDetails === 'function') {
                    fetchRunwayDetails(latlng.lat, latlng.lng || latlng.lon, 'wxPopupDestRwy', icao);
                }
                if (icao && icao !== 'GPS' && typeof fetchAirportFreq === 'function') {
                    updatePopupFrequencyBlock('wxPopupDestFreq', icao);
                    fetchAirportFreq(icao, null, null).finally(() => updatePopupFrequencyBlock('wxPopupDestFreq', icao));
                }
                if (icao && typeof loadMetarWidget === 'function') {
                    loadMetarWidget(icao, 'wxPopupDest', latlng.lat, latlng.lng || latlng.lon, true);
                }
            });
        }
}
