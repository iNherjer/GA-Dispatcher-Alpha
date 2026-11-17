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
            id: 'cyclosm',
            label: '🚲 CyclOSM (mit Relief)',
            layer: L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
                subdomains: 'abc',
                maxNativeZoom: 18,
                attribution: osmAttribution + ', <a href="https://www.cyclosm.org" target="_blank" rel="noopener noreferrer">CyclOSM</a>'
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
                    list.insertBefore(createGaLayerGroupTitle('Regionale Basiskarten'), label);
                    regionalTitleDone = true;
                } else if (!isRegional && !overlayTitleDone) {
                    list.insertBefore(createGaLayerGroupTitle('Overlays'), label);
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

function createGaLayerGroupTitle(text) {
    const node = document.createElement('div');
    node.className = 'ga-layer-group-title';
    node.textContent = gaBaseMapPhrase(text);
    return node;
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
