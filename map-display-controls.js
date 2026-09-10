// Original standalone display menu and aircraft settings, shared with the EFB.
const MAP_HINT_DEFAULTS = {
    magentaLine: true,
    weather: true,
    windBarbs: true,
    cloudFields: true,
    vfrIndex: false,
    terrainAvoid: false,
    traffic: true,
    autoZoom: false,
    telemetry: true,
    currentInfo: true,
    nextLeg: true,
    routeProgress: true,
    compass: true,
    lowFps: false
};
const MAP_SINGLE_CLICK_MODE_KEY = 'ga_map_single_click_mode';
const MAP_SINGLE_CLICK_MODES = ['off', 'tooltip', 'panels'];
const MAP_SINGLE_CLICK_MODE_LABELS = {
    off: 'Aus',
    tooltip: 'Tooltip',
    panels: 'Tafeln'
};
let mapSingleClickMode = 'off';
window.mapHints = window.mapHints || { ...MAP_HINT_DEFAULTS };
Object.keys(MAP_HINT_DEFAULTS).forEach((key) => {
    if (!(key in window.mapHints)) window.mapHints[key] = MAP_HINT_DEFAULTS[key];
});
const MAP_HINT_SUBMENU_DEFAULTS = {
    weatherMenu: false,
    vfrIndexMenu: false,
    terrainAvoidMenu: false
};
window.mapHintSubmenus = window.mapHintSubmenus || { ...MAP_HINT_SUBMENU_DEFAULTS };
function loadMapHintSettings() {
    Object.keys(MAP_HINT_DEFAULTS).forEach(key => {
        const saved = localStorage.getItem(`ga_map_hint_${key}`);
        if (saved === null) window.mapHints[key] = MAP_HINT_DEFAULTS[key];
        else window.mapHints[key] = saved !== 'false';
    });
    // Wetter-/Traffic-Flags mit bestehenden Zuständen synchronisieren
    if (typeof window.vpShowMapMetar === 'boolean') window.mapHints.weather = window.vpShowMapMetar;
    if (typeof window.vpTrafficMapVisible === 'boolean') window.mapHints.traffic = window.vpTrafficMapVisible;
    const storedSingleClickMode = String(localStorage.getItem(MAP_SINGLE_CLICK_MODE_KEY) || '').trim().toLowerCase();
    if (MAP_SINGLE_CLICK_MODES.includes(storedSingleClickMode)) {
        mapSingleClickMode = storedSingleClickMode;
    } else {
        // Ein bereits aktivierter alter Ein/Aus-Schalter entspricht der
        // bisherigen Vollansicht; ansonsten bleibt Einzelklick standardmäßig aus.
        mapSingleClickMode = localStorage.getItem('ga_map_hint_airportSingleClick') === 'true'
            ? 'panels'
            : 'off';
        localStorage.setItem(MAP_SINGLE_CLICK_MODE_KEY, mapSingleClickMode);
    }
    window.mapSingleClickMode = mapSingleClickMode;
}

function saveMapHintSetting(key) {
    if (!(key in MAP_HINT_DEFAULTS)) return;
    localStorage.setItem(`ga_map_hint_${key}`, String(Boolean(window.mapHints[key])));
}

window.isMapHintEnabled = function(key) {
    if (!(key in MAP_HINT_DEFAULTS)) return true;
    return window.mapHints[key] !== false;
};

function getMapSingleClickMode() {
    return MAP_SINGLE_CLICK_MODES.includes(mapSingleClickMode) ? mapSingleClickMode : 'off';
}

function setMapHintSubmenuOpen(key, open) {
    const ids = {
        weatherMenu: { btn: 'btnToggleWeatherMenu', panel: 'weatherMenuBlock', label: 'Wetter' },
        vfrIndexMenu: { btn: 'btnToggleVfrIndexMenu', panel: 'vfrIndexMenuBlock', label: 'VFR-Index' },
        terrainAvoidMenu: { btn: 'btnToggleTerrainAvoidMenu', panel: 'terrainAvoidMenuBlock', label: 'Terrain Avoid' }
    };
    const meta = ids[key];
    if (!meta) return;
    const panel = document.getElementById(meta.panel);
    const btn = document.getElementById(meta.btn);
    const isOpen = !!open;
    if (window.mapHintSubmenus) window.mapHintSubmenus[key] = isOpen;
    if (panel) panel.style.display = isOpen ? 'block' : 'none';
    if (btn) {
        btn.textContent = key === 'weatherMenu' || key === 'vfrIndexMenu' || key === 'terrainAvoidMenu'
            ? (isOpen ? '▾' : '▸')
            : `${isOpen ? '▾' : '▸'} ${meta.label}`;
        btn.classList.toggle('active', isOpen);
    }
}

function closeAllMapHintSubmenus() {
    Object.keys(MAP_HINT_SUBMENU_DEFAULTS).forEach(k => setMapHintSubmenuOpen(k, false));
}

function positionMapHintsMenuInViewport() {
    const menu = document.getElementById('mapHintsMenu');
    const btn = document.getElementById('mapHintsBtn');
    if (!menu || !btn || menu.style.display !== 'block') return;
    const openInViewport = (typeof window._openFloatingMenuInViewport === 'function')
        ? window._openFloatingMenuInViewport
        : (typeof _openFloatingMenuInViewport === 'function' ? _openFloatingMenuInViewport : null);
    if (openInViewport) {
        openInViewport(menu, btn, false);
    }
}

window.toggleMapHintSubmenu = function(key, evt) {
    if (evt && typeof evt.stopPropagation === 'function') evt.stopPropagation();
    if (!(key in MAP_HINT_SUBMENU_DEFAULTS)) return;
    const nowOpen = !!(window.mapHintSubmenus && window.mapHintSubmenus[key]);
    Object.keys(MAP_HINT_SUBMENU_DEFAULTS).forEach(k => {
        let nextOpen = k === key ? !nowOpen : false;
        if (key === 'vfrIndexMenu' && k === 'weatherMenu') nextOpen = true;
        if (key === 'weatherMenu' && nowOpen && k === 'vfrIndexMenu') nextOpen = false;
        setMapHintSubmenuOpen(k, nextOpen);
    });
    positionMapHintsMenuInViewport();
};

function refreshMapHintMenuUi() {
    const labels = {
        magentaLine: '🟣 Direkt-Linie',
        weather: '🌤️ Wetter',
        windBarbs: '🪁 Windbarben',
        cloudFields: '☁️ Wolkenfelder',
        vfrIndex: '🧭 VFR-Index',
        terrainAvoid: '🏔️ Terrain Avoid',
        traffic: '✈️ Traffic',
        autoZoom: '🔍 Autozoom',
        telemetry: '📟 Telemetrie',
        currentInfo: '📍 Aktuell',
        nextLeg: '🧭 Wegpunkt-Info',
        routeProgress: '⏱ Route-Leiste',
        compass: '🔵 Kompassscheibe',
        lowFps: '🐢 Low FPS Mode'
    };
    const ids = {
        magentaLine: 'hintToggleMagentaLine',
        weather: 'hintToggleWeather',
        windBarbs: 'hintToggleWindBarbs',
        cloudFields: 'hintToggleCloudFields',
        vfrIndex: 'hintToggleVfrIndex',
        terrainAvoid: 'hintToggleTerrainAvoid',
        traffic: 'hintToggleTraffic',
        autoZoom: 'hintToggleAutoZoom',
        telemetry: 'hintToggleTelemetry',
        currentInfo: 'hintToggleCurrentInfo',
        nextLeg: 'hintToggleNextLeg',
        routeProgress: 'hintToggleRouteProgress',
        compass: 'hintToggleCompass',
        lowFps: 'hintToggleLowFps'
    };
    Object.keys(ids).forEach(key => {
        const btn = document.getElementById(ids[key]);
        if (!btn) return;
        const on = window.mapHints[key] !== false;
        btn.textContent = `${labels[key]} (${on ? 'An' : 'Aus'})`;
        btn.style.background = on ? '#2E8B57' : '#444';
        btn.style.color = '#fff';
    });
    const singleClickButton = document.getElementById('hintToggleAirportSingleClick');
    if (singleClickButton) {
        const singleClickMode = getMapSingleClickMode();
        singleClickButton.textContent = `🛩️ Einzelklick: ${MAP_SINGLE_CLICK_MODE_LABELS[singleClickMode]}`;
        singleClickButton.style.background = singleClickMode === 'panels'
            ? '#2E8B57'
            : (singleClickMode === 'tooltip' ? '#8a6717' : '#444');
        singleClickButton.style.color = '#fff';
        singleClickButton.setAttribute(
            'aria-label',
            `Einzelklick für Flugplätze, VRPs und Navaids: ${MAP_SINGLE_CLICK_MODE_LABELS[singleClickMode]}`
        );
    }
    if (typeof updateSnapButtonUI === 'function') updateSnapButtonUI();
    Object.keys(MAP_HINT_SUBMENU_DEFAULTS).forEach(k => {
        const isOpen = !!(window.mapHintSubmenus && window.mapHintSubmenus[k]);
        setMapHintSubmenuOpen(k, isOpen);
    });
    if (typeof vpUpdateVfrUi === 'function') vpUpdateVfrUi();
    if (typeof updateTerrainAvoidThresholdUi === 'function') updateTerrainAvoidThresholdUi();
    if (typeof updateMapWeatherSourceBtn === 'function') updateMapWeatherSourceBtn();
    if (typeof updateRouteLegLabelModeButton === 'function') updateRouteLegLabelModeButton();
    if (typeof window.refreshMapAutoZoomUi === 'function') window.refreshMapAutoZoomUi();
    if (window.gaMapDisplayAdapter) window.gaMapDisplayAdapter.refreshUi();
    positionMapHintsMenuInViewport();
}

window.toggleMapHint = function(key) {
    if (!(key in MAP_HINT_DEFAULTS)) return;
    if (window.gaMapDisplayAdapter && !window.gaMapDisplayAdapter.supports(key)) return;
    window.mapHints[key] = !(window.mapHints[key] !== false);
    saveMapHintSetting(key);
    if (window.gaMapDisplayAdapter) window.gaMapDisplayAdapter.apply(key);
    else applyMapHintEffects(key);
    refreshMapHintMenuUi();
};

window.toggleMapHintsMenu = function(force) {
    const menu = document.getElementById('mapHintsMenu');
    const btn = document.getElementById('mapHintsBtn');
    if (!menu) return;
    const isOpen = menu.style.display === 'block';
    const nextOpen = typeof force === 'boolean' ? force : !isOpen;
    if (nextOpen) {
        refreshMapHintMenuUi();
        if (btn) {
            menu.style.display = 'block';
            positionMapHintsMenuInViewport();
        } else {
            menu.style.display = 'block';
        }
        if (typeof window.gaBringMapOverlayToFront === 'function') window.gaBringMapOverlayToFront(menu);
    } else {
        menu.style.display = 'none';
    }
    if (typeof window.gaSetMapFloatingMenuButtonOpen === 'function') {
        window.gaSetMapFloatingMenuButtonOpen('mapHintsBtn', nextOpen);
    } else if (btn) {
        btn.classList.toggle('map-menu-open', nextOpen);
        btn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
    }
    if (!nextOpen) {
        closeAllMapHintSubmenus();
        const planeMenu = document.getElementById('vpPlaneIconMenu');
        if (planeMenu) planeMenu.style.display = 'none';
        const planeBtn = document.getElementById('btnTogglePlaneIconMenu');
        if (planeBtn) planeBtn.classList.remove('active');
    }
};

const PLANE_ICON_COLOR_KEY = 'ga_plane_color';
const PLANE_ICON_SIZE_KEY = 'ga_plane_size';
const PLANE_ICON_DEFAULT_COLOR = '#f2c12e';
const PLANE_ICON_DEFAULT_SIZE = 40;
const PLANE_ICON_MIN_SIZE = 20;
const PLANE_ICON_MAX_SIZE = 100;
function normalizePlaneIconColor(value) {
    const v = String(value || '').trim();
    return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : null;
}

function normalizePlaneIconSize(value) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return null;
    return Math.min(PLANE_ICON_MAX_SIZE, Math.max(PLANE_ICON_MIN_SIZE, n));
}

function getCurrentPlaneIconDefaults() {
    const rootStyle = getComputedStyle(document.documentElement);
    const colorCss = normalizePlaneIconColor(rootStyle.getPropertyValue('--plane-color').trim());
    const sizeCss = normalizePlaneIconSize(rootStyle.getPropertyValue('--plane-size'));
    return {
        color: colorCss || PLANE_ICON_DEFAULT_COLOR,
        size: sizeCss || PLANE_ICON_DEFAULT_SIZE
    };
}

function applyPlaneIconSettings({ color, size, persist = false } = {}) {
    const defaults = getCurrentPlaneIconDefaults();
    const nextColor = normalizePlaneIconColor(color) || defaults.color;
    const nextSize = normalizePlaneIconSize(size) || defaults.size;
    document.documentElement.style.setProperty('--plane-color', nextColor);
    document.documentElement.style.setProperty('--plane-size', `${nextSize}px`);
    if (persist) {
        localStorage.setItem(PLANE_ICON_COLOR_KEY, nextColor);
        localStorage.setItem(PLANE_ICON_SIZE_KEY, String(nextSize));
    }

    const colorPicker = document.getElementById('vpPlaneColorPicker');
    if (colorPicker && colorPicker.value !== nextColor) colorPicker.value = nextColor;

    const sizeSlider = document.getElementById('vpPlaneSizeSlider');
    if (sizeSlider) sizeSlider.value = String(nextSize);

    const sizeLabel = document.getElementById('vpPlaneSizeValue');
    if (sizeLabel) sizeLabel.textContent = `${nextSize} px`;
}

function initPlaneIconSettingsUi() {
    const defaults = getCurrentPlaneIconDefaults();
    const storedColor = normalizePlaneIconColor(localStorage.getItem(PLANE_ICON_COLOR_KEY));
    const storedSize = normalizePlaneIconSize(localStorage.getItem(PLANE_ICON_SIZE_KEY));
    applyPlaneIconSettings({
        color: storedColor || defaults.color,
        size: storedSize || defaults.size
    });

    const colorPicker = document.getElementById('vpPlaneColorPicker');
    if (colorPicker && !colorPicker.dataset.boundPlaneIcon) {
        colorPicker.dataset.boundPlaneIcon = '1';
        colorPicker.addEventListener('input', (e) => {
            applyPlaneIconSettings({ color: e.target.value, persist: true });
        });
    }

    const sizeSlider = document.getElementById('vpPlaneSizeSlider');
    if (sizeSlider && !sizeSlider.dataset.boundPlaneIcon) {
        sizeSlider.dataset.boundPlaneIcon = '1';
        sizeSlider.addEventListener('input', (e) => {
            applyPlaneIconSettings({ size: e.target.value, persist: true });
        });
    }
}

    function toggleVpPlaneIconMenu(e) {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        const menu = document.getElementById('vpPlaneIconMenu');
        const btn = document.getElementById('btnTogglePlaneIconMenu');
        if (!menu || !btn) return;
        const open = menu.style.display === 'block';
        menu.style.display = open ? 'none' : 'block';
        btn.classList.toggle('active', !open);
    }

    document.addEventListener('click', (e) => {
        const menu = document.getElementById('mapHintsMenu');
        if (!menu || menu.style.display !== 'block') return;
        const t = e.target;
        if (t && t.closest && (t.closest('#mapHintsMenu') || t.closest('#mapHintsBtn'))) return;
        window.toggleMapHintsMenu(false);
    }, true);

// Original route leg labels: angle, size, distance and planned-speed duration.
let routeLegLabelMarkers = [];
const ROUTE_LEG_LABEL_MODE_KEY = 'ga_route_leg_label_mode';
const ROUTE_LEG_LABEL_MODES = ['distance', 'duration', 'both'];
let routeLegLabelMode = ROUTE_LEG_LABEL_MODES.includes(localStorage.getItem(ROUTE_LEG_LABEL_MODE_KEY))
    ? localStorage.getItem(ROUTE_LEG_LABEL_MODE_KEY)
    : 'distance';
function ensureRouteLegLabelPane() {
    if (!map) return;
    if (map.getPane('routeLegLabelPane')) return;
    const pane = map.createPane('routeLegLabelPane');
    pane.style.zIndex = '350'; // Unter der Route (Overlay-Pane ~400)
    pane.style.pointerEvents = 'none';
}

function clearRouteLegLabels() {
    if (!map || !routeLegLabelMarkers.length) return;
    routeLegLabelMarkers.forEach(m => map.removeLayer(m));
    routeLegLabelMarkers = [];
}

function getLegScreenAngle(p1, p2) {
    const a = map.latLngToLayerPoint([p1.lat, p1.lng || p1.lon]);
    const b = map.latLngToLayerPoint([p2.lat, p2.lng || p2.lon]);
    let angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;
    return angle;
}

function formatNm(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.0';
    return (Math.round(n * 10) / 10).toFixed(1);
}

function formatLegDurationMinutes(distNm) {
    const speedKts = Math.max(1, getTasForRouteEstimate());
    const dist = Number(distNm);
    if (!Number.isFinite(dist) || dist <= 0) return '0 min';
    const minutes = Math.max(1, Math.round((dist / speedKts) * 60));
    return `${minutes} min`;
}

function getRouteLegLabelDetail(nav) {
    const distText = `${formatNm(nav.dist)} NM`;
    const durationText = formatLegDurationMinutes(nav.dist);
    if (routeLegLabelMode === 'duration') return durationText;
    if (routeLegLabelMode === 'both') return `${distText} / ${durationText}`;
    return distText;
}

function getRouteLegLabelWidthPx(detailText, fontSize) {
    const minWidth = routeLegLabelMode === 'both' ? 108 : 68;
    const textWidth = Math.ceil(String(detailText || '').length * fontSize * 0.62) + 18;
    return Math.max(minWidth, textWidth);
}

function updateRouteLegLabelModeButton() {
    const btn = document.getElementById('routeLegLabelModeBtn');
    if (!btn) return;
    const labels = {
        distance: 'Distanz',
        duration: 'Dauer',
        both: 'Distanz + Dauer'
    };
    btn.textContent = `📏 Legs: ${labels[routeLegLabelMode] || labels.distance}`;
    btn.title = 'Leg-Anzeige wechseln: Distanz, Dauer oder beides. Dauer basiert auf dem Speed-Setting im Hauptmenü.';
}

window.cycleRouteLegLabelMode = function() {
    const currentIdx = ROUTE_LEG_LABEL_MODES.indexOf(routeLegLabelMode);
    routeLegLabelMode = ROUTE_LEG_LABEL_MODES[(currentIdx + 1) % ROUTE_LEG_LABEL_MODES.length] || 'distance';
    localStorage.setItem(ROUTE_LEG_LABEL_MODE_KEY, routeLegLabelMode);
    updateRouteLegLabelModeButton();
    renderRouteLegLabels();
};

function renderRouteLegLabels() {
    clearRouteLegLabels();
    if (!map || !routeWaypoints || routeWaypoints.length < 2) return;
    ensureRouteLegLabelPane();
    const zoom = map.getZoom ? map.getZoom() : 10;
    const fontSize = Math.max(9, Math.min(14, Math.round(9 + ((zoom - 6) / 7) * 5)));
    const gap = Math.max(7, Math.round(fontSize * 0.4) + 4);

    for (let i = 0; i < routeWaypoints.length - 1; i++) {
        const p1 = routeWaypoints[i];
        const p2 = routeWaypoints[i + 1];
        if (!routeLegShouldRenderOnMainMap(p1, p2)) continue;
        const nav = calcNav(p1.lat, p1.lng || p1.lon, p2.lat, p2.lng || p2.lon);

        const midLat = (p1.lat + p2.lat) / 2;
        const midLng = ((p1.lng || p1.lon) + (p2.lng || p2.lon)) / 2;
        const angle = getLegScreenAngle(p1, p2).toFixed(1);
        const detailText = getRouteLegLabelDetail(nav);
        const labelWidth = getRouteLegLabelWidthPx(detailText, fontSize);

        const html = `
            <div class="route-leg-label" style="transform: translate(-50%, -50%) rotate(${angle}deg); --leg-fz:${fontSize}px; --leg-gap:${gap}px; --leg-w:${labelWidth}px;">
                <div class="route-leg-course">${nav.brng}°</div>
                <div class="route-leg-detail">${detailText}</div>
            </div>
        `;

        const labelIcon = L.divIcon({
            className: 'route-leg-label-icon',
            html,
            iconSize: [0, 0],
            iconAnchor: [0, 0]
        });

        const marker = L.marker([midLat, midLng], {
            icon: labelIcon,
            interactive: false,
            pane: 'routeLegLabelPane'
        }).addTo(map);

        routeLegLabelMarkers.push(marker);
    }
}

function routeLegShouldRenderOnMainMap(p1 = null, p2 = null) {
    const hasPoiChain = !!(
        typeof currentMissionData !== 'undefined'
        && currentMissionData
        && currentMissionData.poiChain
    );
    if (!hasPoiChain) return true;
    return true;
}

function getTasForRouteEstimate() {
    if (window.gaProfileDataProvider && Number.isFinite(window.gaProfileDataProvider.tasKts)) return window.gaProfileDataProvider.tasKts;
    return parseInt(document.getElementById('tasSlider')?.value || 160, 10) || 160;
}
