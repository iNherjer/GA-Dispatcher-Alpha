// Basiskarten-Katalog der Web-App.
//
// Globale Basiskarten sind exklusiv (Radio) und liegen im normalen Leaflet-
// tilePane. Regionale Basiskarten (z. B. basemap.de, swisstopo) sind frei
// kombinierbar (Checkbox) und liegen in einem eigenen Pane zwischen globaler
// Karte und allen Overlays. Ueberlappen sich zwei regionale Karten, liegt die
// zuletzt aktivierte oben; die Reihenfolge wird gespeichert.
//
// Alle Quellen hier kommen ohne API-Schluessel aus.

const GA_REGIONAL_BASE_PANE = Object.freeze({ name: 'ga-regional-base-pane', zIndex: 220 });
const GA_GLOBAL_BASE_STORAGE_KEY = 'ga_global_base_map_v1';
const GA_REGIONAL_BASE_STORAGE_KEY = 'ga_regional_base_maps_v1';

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
// jeweiligen Karte, damit ausserhalb nichts nachgeladen wird.
function createGaRegionalBaseMaps() {
    const pane = GA_REGIONAL_BASE_PANE.name;
    return [
        {
            id: 'basemap-de',
            label: '🇩🇪 basemap.de (Deutschland)',
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

// Regionale Karten: eigenes Pane, Stapelreihenfolge "zuletzt aktiviert oben",
// gespeicherte Auswahl wiederherstellen, Gruppenueberschriften im Menue.
function installGaRegionalBaseMaps(map, layerControl, entries) {
    if (!map || !entries.length) return null;
    let pane = map.getPane(GA_REGIONAL_BASE_PANE.name);
    if (!pane) pane = map.createPane(GA_REGIONAL_BASE_PANE.name);
    pane.style.zIndex = String(GA_REGIONAL_BASE_PANE.zIndex);
    // Wie das tilePane: Klicks gehen an die Karte darunter.
    pane.style.pointerEvents = 'none';

    let order = gaReadStoredRegionalOrder(entries);
    let stackCounter = 0;
    const byLayer = new Map(entries.map(entry => [entry.layer, entry]));
    const regionalStamps = new Set(entries.map(entry => L.stamp(entry.layer)));

    const persist = () => gaBaseMapStorageSet(GA_REGIONAL_BASE_STORAGE_KEY, JSON.stringify(order));
    const bringToTop = (entry) => {
        stackCounter += 1;
        entry.layer.setZIndex(stackCounter);
    };

    map.on('overlayadd', (event) => {
        const entry = byLayer.get(event.layer);
        if (!entry) return;
        order = order.filter(id => id !== entry.id);
        order.push(entry.id);
        bringToTop(entry);
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
        bringToTop(entry);
        entry.layer.addTo(map);
    });

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
                    list.insertBefore(createGroupTitle('Regionale Basiskarten'), label);
                    regionalTitleDone = true;
                } else if (!isRegional && !overlayTitleDone) {
                    list.insertBefore(createGroupTitle('Overlays'), label);
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

    function createGroupTitle(text) {
        const node = document.createElement('div');
        node.className = 'ga-layer-group-title';
        node.textContent = gaBaseMapPhrase(text);
        return node;
    }

    return {
        get order() { return order.slice(); }
    };
}
