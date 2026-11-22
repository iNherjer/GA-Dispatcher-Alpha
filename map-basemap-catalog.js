// Basiskarten-Katalog der Web-App.
//
// Alle Basiskarten liegen gemeinsam in einer Gruppe im Leaflet-tilePane:
//
//   tilePane
//   ├─ ga-base-map-group-pane      (wird als Ganzes abgeblendet)
//   │   ├─ globale Basiskarte      (exklusiv, Radio)
//   │   └─ ga-regional-base-pane   (regionale Karten, Checkbox)
//   └─ andere Layer im tilePane    (z. B. Terrain Avoid, bleibt unabgeblendet)
//
// Overlays liegen in eigenen Panes darueber. Regionale Karten werden nach
// fester Prioritaet gestapelt (basemap.de immer ueber swisstopo); bei gleicher
// Prioritaet liegt die zuletzt aktivierte oben.
//
// Alle Quellen hier kommen ohne API-Schluessel aus.

const GA_BASE_MAP_GROUP_PANE = 'ga-base-map-group-pane';
const GA_REGIONAL_BASE_PANE = 'ga-regional-base-pane';
const GA_GLOBAL_BASE_STORAGE_KEY = 'ga_global_base_map_v1';
const GA_REGIONAL_BASE_STORAGE_KEY = 'ga_regional_base_maps_v1';
const GA_BASE_DIM_STORAGE_KEY = 'ga_base_map_dim_percent_v1';
const GA_BASE_DIM_DEFAULT_PERCENT = 50;
const GA_BASE_DIM_MAX_PERCENT = 90;

function gaBaseMapPhrase(text) {
    return (typeof window !== 'undefined' && window.GAI18n && typeof window.GAI18n.phrase === 'function')
        ? window.GAI18n.phrase(text)
        : text;
}

function gaBaseMapStorageGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
}

function gaBaseMapStorageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) { /* privater Modus */ }
}

// Gruppen-Pane und regionales Pane anlegen. Muss vor dem Hinzufuegen der
// ersten Basiskarte laufen, weil Leaflet das Pane beim Hinzufuegen aufloest.
function ensureGaBaseMapPanes(map) {
    let group = map.getPane(GA_BASE_MAP_GROUP_PANE);
    if (!group) group = map.createPane(GA_BASE_MAP_GROUP_PANE, map.getPane('tilePane'));
    // Unter allen uebrigen tilePane-Layern (die haben zIndex >= 1).
    group.style.zIndex = '0';
    group.style.pointerEvents = 'none';
    let regional = map.getPane(GA_REGIONAL_BASE_PANE);
    if (!regional) regional = map.createPane(GA_REGIONAL_BASE_PANE, group);
    regional.style.zIndex = '100';
    regional.style.pointerEvents = 'none';
    return { group, regional };
}

// Globale Basiskarten in die Gruppe legen (vor map-Erzeugung aufrufen).
function assignGaGlobalBaseMapsToGroup(entries) {
    entries.forEach((entry) => {
        if (entry.layer && entry.layer.options) entry.layer.options.pane = GA_BASE_MAP_GROUP_PANE;
    });
}

// Zusaetzliche globale Basiskarten ohne Schluessel.
function createGaExtraGlobalBaseMaps(osmAttribution) {
    return [
        {
            id: 'esri-topo',
            label: '🧭 Esri Topo (Welt)',
            layer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
                maxNativeZoom: 18,
                attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, USGS, ' + osmAttribution
            })
        },
        {
            id: 'osm',
            label: '🗺️ OpenStreetMap',
            layer: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxNativeZoom: 19,
                attribution: osmAttribution
            })
        },
        {
            id: 'osm-de',
            label: '🗺️ OpenStreetMap.de (deutscher Stil)',
            layer: L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
                maxNativeZoom: 18,
                attribution: osmAttribution + ', Tiles <a href="https://www.openstreetmap.de" target="_blank" rel="noopener noreferrer">openstreetmap.de</a>'
            })
        },
        {
            id: 'osm-swiss',
            label: '⛰️ OSM Swiss Style (Europa, mit Relief)',
            layer: L.tileLayer('https://tile.osm.ch/osm-swiss-style/{z}/{x}/{y}.png', {
                maxNativeZoom: 18,
                attribution: osmAttribution + ', Tiles <a href="https://osm.ch" target="_blank" rel="noopener noreferrer">osm.ch</a>'
            })
        },
        {
            id: 'cyclosm',
            label: '🚲 CyclOSM (mit Relief)',
            layer: L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
                subdomains: 'abc',
                maxNativeZoom: 18,
                attribution: osmAttribution + ', <a href="https://www.cyclosm.org" target="_blank" rel="noopener noreferrer">CyclOSM</a>'
            })
        },
        {
            // NASA GIBS, gemeinfrei, nur bis Zoomstufe 8 (danach vergrößert).
            id: 'nasa-bluemarble',
            label: '🌍 NASA Blue Marble',
            layer: L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg', {
                maxNativeZoom: 8,
                attribution: 'Imagery &copy; NASA Blue Marble (GIBS)'
            })
        },
        {
            id: 'nasa-night',
            label: '🌃 NASA Earth at Night',
            layer: L.tileLayer('https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png', {
                maxNativeZoom: 8,
                attribution: 'Imagery &copy; NASA Earth Observatory / VIIRS Black Marble (GIBS)'
            })
        }
    ];
}

// Regionale Basiskarten. bounds begrenzt die Kachelabrufe auf das Gebiet der
// jeweiligen Karte. priority: hoeher liegt oben, unabhaengig von der
// Aktivierungsreihenfolge. swisstopo liefert undurchsichtige Kacheln bis in
// die Nachbarlaender; basemap.de ist ausserhalb Deutschlands durchsichtig und
// liegt deshalb immer oben.
function createGaRegionalBaseMaps() {
    const pane = GA_REGIONAL_BASE_PANE;
    return [
        {
            id: 'basemap-de',
            label: '🇩🇪 basemap.de (Deutschland)',
            priority: 20,
            layer: L.tileLayer('https://sgx.geodatenzentrum.de/wmts_basemapde/tile/1.0.0/de_basemapde_web_raster_farbe/default/GLOBAL_WEBMERCATOR/{z}/{y}/{x}.png', {
                pane,
                maxNativeZoom: 18,
                bounds: [[47.2, 5.8], [55.1, 15.1]],
                attribution: '&copy; <a href="https://basemap.de" target="_blank" rel="noopener noreferrer">basemap.de / BKG</a> (CC BY 4.0)'
            })
        },
        {
            id: 'swisstopo',
            label: '🇨🇭 swisstopo Landeskarte (Schweiz)',
            priority: 10,
            layer: L.tileLayer('https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg', {
                pane,
                maxNativeZoom: 18,
                bounds: [[45.4, 5.1], [48.3, 11.5]],
                attribution: '&copy; <a href="https://www.swisstopo.admin.ch" target="_blank" rel="noopener noreferrer">swisstopo</a>'
            })
        }
    ];
}

function gaReadStoredGlobalBaseId(entries, fallbackId) {
    const stored = gaBaseMapStorageGet(GA_GLOBAL_BASE_STORAGE_KEY);
    return entries.some(entry => entry.id === stored) ? stored : fallbackId;
}

function gaReadStoredRegionalOrder(entries) {
    let ids = [];
    try {
        const parsed = JSON.parse(gaBaseMapStorageGet(GA_REGIONAL_BASE_STORAGE_KEY) || '[]');
        if (Array.isArray(parsed)) ids = parsed;
    } catch (_) { ids = []; }
    const known = new Set(entries.map(entry => entry.id));
    return ids.filter((id, index) => known.has(id) && ids.indexOf(id) === index);
}

function installGaGlobalBaseMapMemory(map, entries) {
    map.on('baselayerchange', (event) => {
        const entry = entries.find(item => item.layer === event.layer);
        if (entry) gaBaseMapStorageSet(GA_GLOBAL_BASE_STORAGE_KEY, entry.id);
    });
}

// Regionale Karten: Stapelung nach Prioritaet, bei Gleichstand zuletzt
// aktiviert oben; gespeicherte Auswahl wiederherstellen; Gruppenueberschriften.
function installGaRegionalBaseMaps(map, layerControl, entries) {
    if (!map || !entries.length) return null;
    ensureGaBaseMapPanes(map);

    let order = gaReadStoredRegionalOrder(entries);
    let activationCounter = 0;
    const byLayer = new Map(entries.map(entry => [entry.layer, entry]));
    const regionalStamps = new Set(entries.map(entry => L.stamp(entry.layer)));

    const persist = () => gaBaseMapStorageSet(GA_REGIONAL_BASE_STORAGE_KEY, JSON.stringify(order));
    const stack = (entry) => {
        activationCounter += 1;
        entry.layer.setZIndex((Number(entry.priority) || 0) * 1000 + activationCounter);
    };

    map.on('overlayadd', (event) => {
        const entry = byLayer.get(event.layer);
        if (!entry) return;
        order = order.filter(id => id !== entry.id);
        order.push(entry.id);
        stack(entry);
        persist();
    });
    map.on('overlayremove', (event) => {
        const entry = byLayer.get(event.layer);
        if (!entry) return;
        order = order.filter(id => id !== entry.id);
        persist();
    });

    // Gespeicherte Auswahl in der alten Reihenfolge wiederherstellen.
    order.forEach((id) => {
        const entry = entries.find(item => item.id === id);
        if (!entry) return;
        stack(entry);
        entry.layer.addTo(map);
    });

    if (layerControl && layerControl._container) layerControl._container.classList.add('ga-layer-groups');
    if (layerControl && typeof layerControl._update === 'function') {
        const originalUpdate = layerControl._update;
        const decorate = function () {
            const list = this._overlaysList;
            if (!list) return;
            list.querySelectorAll('.ga-layer-group-title').forEach(node => node.remove());
            let regionalTitleDone = false;
            let overlayTitleDone = false;
            Array.from(list.children).forEach((label) => {
                const input = label.querySelector('input');
                if (!input) return;
                const isRegional = regionalStamps.has(input.layerId);
                label.classList.toggle('ga-layer-regional', isRegional);
                if (isRegional && !regionalTitleDone) {
                    list.insertBefore(createGaLayerGroupTitle('Regionale Basiskarten', 'regional'), label);
                    regionalTitleDone = true;
                } else if (!isRegional && !overlayTitleDone) {
                    list.insertBefore(createGaLayerGroupTitle('Overlays', 'overlays'), label);
                    overlayTitleDone = true;
                }
            });
        };
        layerControl._update = function () {
            const result = originalUpdate.apply(this, arguments);
            decorate.call(this);
            return result;
        };
        layerControl._update();
    }

    return {
        get order() { return order.slice(); }
    };
}

// Group titles with a key can be collapsed; the state is remembered per group.
const GA_LAYER_GROUP_STATE_KEY = 'ga_layer_menu_groups_v1';

function gaLayerGroupState() {
    try {
        const parsed = JSON.parse(gaBaseMapStorageGet(GA_LAYER_GROUP_STATE_KEY) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) { return {}; }
}

// Groups start expanded; the VFR style settings start collapsed.
function gaLayerGroupCollapsed(key) {
    const value = gaLayerGroupState()[key];
    return value === undefined ? /-style$/.test(String(key)) : value === true;
}

function gaSetLayerGroupCollapsed(key, collapsed) {
    const state = gaLayerGroupState();
    state[key] = !!collapsed;
    gaBaseMapStorageSet(GA_LAYER_GROUP_STATE_KEY, JSON.stringify(state));
}

function createGaLayerGroupTitle(text, groupKey) {
    const node = document.createElement(groupKey ? 'button' : 'div');
    node.className = 'ga-layer-group-title' + (groupKey ? ' ga-layer-group-toggle' : '');
    if (groupKey) {
        node.type = 'button';
        node.dataset.group = groupKey;
        node.dataset.label = gaBaseMapPhrase(text);
    }
    node.textContent = gaBaseMapPhrase(text);
    return node;
}

// Hides the entries below a collapsed title up to the next title. A collapsed
// group names its selected entry so the active map stays visible.
function applyGaLayerGroupCollapse(list) {
    if (!list) return;
    let collapsed = false;
    let title = null;
    const finishTitle = () => {
        if (!title) return;
        const active = title._gaActiveLabel;
        title.textContent = title.dataset.label + (collapsed && active ? ' · ' + active : '');
    };
    Array.from(list.children).forEach((child) => {
        if (child.classList && child.classList.contains('ga-layer-group-toggle')) {
            finishTitle();
            title = child;
            title._gaActiveLabel = '';
            collapsed = gaLayerGroupCollapsed(child.dataset.group);
            child.classList.toggle('is-collapsed', collapsed);
            child.setAttribute('aria-expanded', String(!collapsed));
            return;
        }
        if (!title) return;
        child.style.display = collapsed ? 'none' : '';
        // Only layer entries (<label>) name the active map; settings panels
        // also hold checked inputs but must not end up in the title.
        const input = child.tagName === 'LABEL' && child.querySelector('input');
        if (input && input.checked) {
            const text = String(child.textContent || '').trim();
            title._gaActiveLabel = title._gaActiveLabel ? title._gaActiveLabel + ', ' + text : text;
        }
    });
    finishTitle();
}

// ---- VFR vector style settings (colors, opacity, shading, label size) ----
const GA_VFR_STYLE_STORAGE_KEY = 'ga_vfr_vector_style_v1';
const GA_VFR_STYLE_DEFAULTS = Object.freeze({
    settlement: '#f2cf4a', settlementOpacity: 100,
    wood: '#8fc67a', woodOpacity: 100,
    water: '#9cc3ee',
    motorway: '#d9472b',
    trunk: '#ee7a3c',
    rail: '#555555',
    hillshade: 100,
    labelSize: 100
});

function gaReadVfrStyleSettings() {
    let stored = {};
    try { stored = JSON.parse(gaBaseMapStorageGet(GA_VFR_STYLE_STORAGE_KEY) || '{}') || {}; } catch (_) { stored = {}; }
    const result = { ...GA_VFR_STYLE_DEFAULTS };
    Object.keys(GA_VFR_STYLE_DEFAULTS).forEach((key) => {
        const value = stored[key];
        if (typeof GA_VFR_STYLE_DEFAULTS[key] === 'string') {
            if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) result[key] = value.toLowerCase();
        } else if (Number.isFinite(Number(value))) {
            result[key] = Math.max(0, Math.min(200, Math.round(Number(value))));
        }
    });
    return result;
}

function gaShadeColor(hex, factor) {
    const value = parseInt(String(hex).slice(1), 16);
    const channel = (shift) => Math.max(0, Math.min(255, Math.round(((value >> shift) & 255) * factor)));
    return '#' + [16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, '0')).join('');
}

// Applies the settings to a loaded MapLibre map of the "vfr" style.
function gaApplyVfrStyleSettings(glMap, settings = gaReadVfrStyleSettings()) {
    if (!glMap || typeof glMap.getLayer !== 'function') return;
    const set = (id, property, value) => {
        if (!glMap.getLayer(id)) return;
        try { glMap.setPaintProperty(id, property, value); } catch (_) { /* style still loading */ }
    };
    const scale = (stops, factor) => {
        const out = ['interpolate', ['linear'], ['zoom']];
        for (let i = 0; i < stops.length; i += 2) out.push(stops[i], Math.min(1, stops[i + 1] * factor));
        return out;
    };
    const s = settings;
    const settlement = s.settlementOpacity / 100;
    const wood = s.woodOpacity / 100;
    set('landuse_residential', 'fill-color', s.settlement);
    set('landuse_residential', 'fill-opacity', scale([6, 0.75, 12, 0.6, 15, 0.35], settlement));
    set('landuse_urban', 'fill-color', gaShadeColor(s.settlement, 0.93));
    set('landuse_urban', 'fill-opacity', scale([6, 0.6, 15, 0.3], settlement));
    set('landcover_wood', 'fill-color', s.wood);
    set('landcover_wood', 'fill-opacity', scale([5, 0.65, 13, 0.55], wood));
    set('water', 'fill-color', s.water);
    ['waterway_river', 'waterway_other', 'waterway_tunnel'].forEach((id) => set(id, 'line-color', gaShadeColor(s.water, 0.62)));
    ['road', 'bridge', 'tunnel'].forEach((prefix) => {
        set(`${prefix}_motorway`, 'line-color', s.motorway);
        set(`${prefix}_motorway_link`, 'line-color', s.motorway);
        set(`${prefix}_motorway_casing`, 'line-color', gaShadeColor(s.motorway, 0.72));
        set(`${prefix}_motorway_link_casing`, 'line-color', gaShadeColor(s.motorway, 0.72));
        set(`${prefix}_trunk_primary`, 'line-color', s.trunk);
        set(`${prefix}_trunk_primary_casing`, 'line-color', gaShadeColor(s.trunk, 0.75));
        set(`${prefix}_major_rail`, 'line-color', s.rail);
        set(`${prefix}_major_rail_hatching`, 'line-color', s.rail);
    });
    const shading = s.hillshade / 100;
    if (glMap.getLayer('vfr_hillshade')) {
        try { glMap.setLayoutProperty('vfr_hillshade', 'visibility', shading > 0 ? 'visible' : 'none'); } catch (_) {}
        set('vfr_hillshade', 'hillshade-exaggeration', scale([5, 0.45, 10, 0.35, 14, 0.2], shading));
    }
    const size = s.labelSize / 100;
    const textSize = (id, stops) => {
        if (!glMap.getLayer(id)) return;
        const out = ['interpolate', ['linear'], ['zoom']];
        for (let i = 0; i < stops.length; i += 2) out.push(stops[i], Math.round(stops[i + 1] * size * 10) / 10);
        try { glMap.setLayoutProperty(id, 'text-size', out); } catch (_) {}
    };
    textSize('label_village', [9, 11, 12, 14, 15, 16]);
    textSize('label_town', [6, 11, 9, 14, 12, 17]);
    textSize('label_city', [4, 12, 8, 16, 12, 20]);
}

// map-vector-basemaps.js calls this once a vector style has loaded.
if (typeof window !== 'undefined') {
    window.gaOnVectorStyleLoaded = function (style, glMap) {
        if (style === 'vfr') gaApplyVfrStyleSettings(glMap);
    };
}

function createGaVfrStylePanel(getGlMap) {
    const wrap = document.createElement('div');
    wrap.className = 'ga-vfr-style';
    const toggle = createGaLayerGroupTitle('VFR Vektor: Darstellung anpassen', 'vfr-style');
    toggle.classList.add('ga-vfr-style-toggle');
    const panel = document.createElement('div');
    panel.className = 'ga-vfr-style-panel';
    wrap.appendChild(toggle);
    wrap.appendChild(panel);
    const controls = {};
    const save = (settings) => gaBaseMapStorageSet(GA_VFR_STYLE_STORAGE_KEY, JSON.stringify(settings));
    const current = () => {
        const settings = gaReadVfrStyleSettings();
        Object.keys(controls).forEach((key) => {
            settings[key] = controls[key].type === 'color' ? controls[key].value : Number(controls[key].value);
        });
        return settings;
    };
    const apply = () => {
        const settings = current();
        save(settings);
        Object.keys(controls).forEach((key) => {
            if (controls[key]._gaValue) controls[key]._gaValue.textContent = controls[key].value + ' %';
        });
        gaApplyVfrStyleSettings(getGlMap(), settings);
    };
    const row = (label, key, kind, min, max) => {
        const line = document.createElement('div');
        line.className = 'ga-vfr-style-row';
        const name = document.createElement('span');
        name.className = 'ga-vfr-style-name';
        name.textContent = gaBaseMapPhrase(label);
        const input = document.createElement('input');
        input.type = kind;
        input.setAttribute('aria-label', gaBaseMapPhrase(label));
        if (kind === 'range') { input.min = String(min); input.max = String(max); input.step = '5'; }
        input.addEventListener('input', apply);
        controls[key] = input;
        line.appendChild(name);
        line.appendChild(input);
        if (kind === 'range') {
            const value = document.createElement('span');
            value.className = 'ga-vfr-style-value';
            input._gaValue = value;
            line.appendChild(value);
        }
        panel.appendChild(line);
    };
    row('Ortsflächen', 'settlement', 'color');
    row('Deckkraft Orte', 'settlementOpacity', 'range', 0, 150);
    row('Wald', 'wood', 'color');
    row('Deckkraft Wald', 'woodOpacity', 'range', 0, 150);
    row('Gewässer', 'water', 'color');
    row('Autobahn', 'motorway', 'color');
    row('Bundesstraße', 'trunk', 'color');
    row('Bahn', 'rail', 'color');
    row('Relief', 'hillshade', 'range', 0, 200);
    row('Schriftgröße', 'labelSize', 'range', 70, 150);
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'ga-vfr-style-reset';
    reset.textContent = gaBaseMapPhrase('Standard wiederherstellen');
    reset.addEventListener('click', () => {
        gaBaseMapStorageSet(GA_VFR_STYLE_STORAGE_KEY, '{}');
        load();
        apply();
    });
    panel.appendChild(reset);
    function load() {
        const settings = gaReadVfrStyleSettings();
        Object.keys(controls).forEach((key) => {
            controls[key].value = String(settings[key]);
            if (controls[key]._gaValue) controls[key]._gaValue.textContent = settings[key] + ' %';
        });
    }
    load();
    if (typeof L !== 'undefined' && L.DomEvent) {
        L.DomEvent.disableClickPropagation(wrap);
        L.DomEvent.disableScrollPropagation(wrap);
    }
    return wrap;
}

// Global base maps in two collapsible groups (vector maps first, then tile
// maps), the VFR vector settings below their entry, and collapsible regional
// and overlay groups (titles from installGaRegionalBaseMaps).
function installGaBaseMapMenu(layerControl, entries, overlayPanels = []) {
    if (!layerControl || typeof layerControl._update !== 'function') return;
    const kindByStamp = {};
    entries.forEach((entry) => { kindByStamp[L.stamp(entry.layer)] = entry.kind === 'vector' ? 'vector' : 'raster'; });
    const vfrEntry = entries.find((entry) => entry.id === 'vfr-vector');
    const vfrStamp = vfrEntry ? L.stamp(vfrEntry.layer) : null;
    const getGlMap = () => {
        const inner = vfrEntry && vfrEntry.layer && vfrEntry.layer._inner;
        return inner && typeof inner.getMaplibreMap === 'function' ? inner.getMaplibreMap() : null;
    };
    const vfrPanel = vfrEntry ? createGaVfrStylePanel(getGlMap) : null;
    const originalUpdate = layerControl._update;
    const decorate = function () {
        const base = this._baseLayersList;
        if (base) {
            base.querySelectorAll('.ga-layer-group-title').forEach((node) => node.remove());
            if (vfrPanel && vfrPanel.parentNode) vfrPanel.parentNode.removeChild(vfrPanel);
            const labels = Array.from(base.children);
            const firstOf = (kind) => labels.find((label) => {
                const input = label.querySelector('input');
                return input && kindByStamp[input.layerId] === kind;
            });
            const vector = firstOf('vector');
            const raster = firstOf('raster');
            if (vector) base.insertBefore(createGaLayerGroupTitle('Vektorkarten (OSM)', 'base-vector'), vector);
            if (raster) base.insertBefore(createGaLayerGroupTitle('Kachelkarten', 'base-raster'), raster);
            const vfrLabel = labels.find((label) => {
                const input = label.querySelector('input');
                return input && input.layerId === vfrStamp;
            });
            if (vfrPanel && vfrLabel) base.insertBefore(vfrPanel, vfrLabel.nextSibling);
            applyGaLayerGroupCollapse(base);
            if (vfrPanel) applyGaLayerGroupCollapse(vfrPanel);
        }
        const overlays = this._overlaysList;
        if (overlays) {
            overlayPanels.forEach(({ layer, panel }) => {
                if (panel.parentNode) panel.parentNode.removeChild(panel);
                const stamp = L.stamp(layer);
                const label = Array.from(overlays.children).find((child) => {
                    const input = child.querySelector && child.querySelector('input');
                    return input && input.layerId === stamp;
                });
                if (label) overlays.insertBefore(panel, label.nextSibling);
                applyGaLayerGroupCollapse(panel);
            });
        }
        applyGaLayerGroupCollapse(overlays);
    };
    layerControl._update = function () {
        const result = originalUpdate.apply(this, arguments);
        decorate.call(this);
        return result;
    };
    const container = layerControl._container;
    if (container && !container._gaGroupClicks) {
        container._gaGroupClicks = true;
        container.addEventListener('click', (event) => {
            const toggle = event.target && event.target.closest && event.target.closest('.ga-layer-group-toggle');
            if (!toggle || !container.contains(toggle)) return;
            event.preventDefault();
            event.stopPropagation();
            gaSetLayerGroupCollapsed(toggle.dataset.group, !gaLayerGroupCollapsed(toggle.dataset.group));
            applyGaLayerGroupCollapse(layerControl._baseLayersList);
            applyGaLayerGroupCollapse(layerControl._overlaysList);
            if (vfrPanel) applyGaLayerGroupCollapse(vfrPanel);
            overlayPanels.forEach(({ panel }) => applyGaLayerGroupCollapse(panel));
        });
        // A new selection updates the "· active" hint of collapsed groups.
        container.addEventListener('change', () => {
            applyGaLayerGroupCollapse(layerControl._baseLayersList);
            applyGaLayerGroupCollapse(layerControl._overlaysList);
        });
    }
    layerControl._update();
}

function gaReadStoredDimPercent() {
    const value = Number(gaBaseMapStorageGet(GA_BASE_DIM_STORAGE_KEY));
    if (!Number.isFinite(value) || gaBaseMapStorageGet(GA_BASE_DIM_STORAGE_KEY) === null) return GA_BASE_DIM_DEFAULT_PERCENT;
    return Math.max(0, Math.min(GA_BASE_DIM_MAX_PERCENT, Math.round(value)));
}

// Abblenden der gesamten Basiskarten-Gruppe (global + regional), solange
// isActive() wahr ist (z. B. VFR-Lufttraum-Overlay sichtbar). Der Regler im
// Kartenmenue stellt die Staerke ein und wird gespeichert.
function installGaBaseMapDimming(map, layerControl, isActive) {
    const { group } = ensureGaBaseMapPanes(map);
    let percent = gaReadStoredDimPercent();

    const apply = () => {
        const active = typeof isActive === 'function' && !!isActive();
        const opacity = active ? (1 - percent / 100) : 1;
        group.style.opacity = opacity >= 1 ? '' : String(opacity);
    };

    const section = layerControl && layerControl._section;
    if (section) {
        const wrap = document.createElement('div');
        wrap.className = 'ga-base-dim-control';
        const title = createGaLayerGroupTitle('Basiskarte abblenden');
        // Kein <label>: die Menue-Stile fuer Layer-Zeilen (Hover, Auswahl) sollen
        // hier nicht greifen.
        const row = document.createElement('div');
        row.className = 'ga-base-dim-row';
        const input = document.createElement('input');
        input.type = 'range';
        input.min = '0';
        input.max = String(GA_BASE_DIM_MAX_PERCENT);
        input.step = '5';
        input.value = String(percent);
        input.setAttribute('aria-label', gaBaseMapPhrase('Basiskarte abblenden'));
        const value = document.createElement('span');
        value.className = 'ga-base-dim-value';
        value.textContent = percent + ' %';
        const hint = document.createElement('div');
        hint.className = 'ga-base-dim-hint';
        hint.textContent = gaBaseMapPhrase('Wirkt, solange die VFR-Lufträume eingeblendet sind.');
        input.addEventListener('input', () => {
            percent = Math.max(0, Math.min(GA_BASE_DIM_MAX_PERCENT, Number(input.value) || 0));
            value.textContent = percent + ' %';
            gaBaseMapStorageSet(GA_BASE_DIM_STORAGE_KEY, String(percent));
            apply();
        });
        row.appendChild(input);
        row.appendChild(value);
        wrap.appendChild(title);
        wrap.appendChild(row);
        wrap.appendChild(hint);
        if (L && L.DomEvent) {
            L.DomEvent.disableClickPropagation(wrap);
            L.DomEvent.disableScrollPropagation(wrap);
        }
        section.appendChild(wrap);
    }

    apply();
    return { update: apply, get percent() { return percent; } };
}
