// Shared Standalone click-only layer menu and viewport bounds.
function configureMapLayerControl(map, layerControl) {
    if (layerControl && layerControl._container) {
        const lc = layerControl._container;
        const controlParent = lc.parentElement;
        const mapFrame = map.getContainer().parentElement;
        const nativeEfb = document.body.classList.contains('ga-efb-tracker-host');
        // Coherent can lose the paint surfaces of sibling controls when a live
        // Leaflet control is reparented. Keep a stable parent in the EFB.
        if (nativeEfb && mapFrame) mapFrame.appendChild(lc);
        function portalLayerControl(open) {
            if (nativeEfb) {
                lc.classList.toggle('ga-layer-menu-open', open);
                return;
            }
            if (open && mapFrame) {
                mapFrame.appendChild(lc);
                lc.classList.add('ga-layer-menu-open');
            } else if (controlParent) {
                controlParent.appendChild(lc);
                lc.classList.remove('ga-layer-menu-open');
            }
        }
        function fitMapLayerControl() {
            const rect = lc.getBoundingClientRect();
            const list = lc.querySelector('.leaflet-control-layers-list');
            const bottom = Math.min(window.innerHeight, map.getContainer().getBoundingClientRect().bottom);
            const scale = nativeEfb && window.GAEfbUiScale;
            const logical = value => scale ? scale.delta(value) : value;
            lc.style.maxWidth = Math.max(120, Math.min(320, logical(window.innerWidth) - 24)) + 'px';
            if (list) {
                list.style.maxHeight = Math.max(40, logical(bottom - Math.max(0, rect.top)) - 30) + 'px';
                list.style.overflowY = 'auto';
            }
        }
        window.addEventListener('resize', fitMapLayerControl);
        if (nativeEfb) window.addEventListener('ga-efb-layout-change', fitMapLayerControl);
        const bringLayerControlToFront = () => {
            if (nativeEfb) {
                if (typeof bringMapOverlayToFront === 'function') bringMapOverlayToFront(lc);
                return;
            }
            if (lc.classList.contains('ga-layer-menu-open')) {
                window.gaMapOverlayZ = Math.max(130500, Number(window.gaMapOverlayZ) || 130500) + 1;
                lc.style.zIndex = String(window.gaMapOverlayZ);
                return;
            }
            const controlCorner = lc.closest('.leaflet-top, .leaflet-bottom') || lc.parentElement;
            const controlRoot = lc.closest('.leaflet-control-container');
            if (controlCorner && controlCorner.style) {
                controlCorner.style.position = controlCorner.style.position || 'relative';
                controlCorner.style.pointerEvents = 'auto';
            }
            if (controlRoot && controlRoot.style) {
                controlRoot.style.position = controlRoot.style.position || 'relative';
            }
            lc.style.position = lc.style.position || 'relative';
            if (typeof bringMapOverlayToFront === 'function') {
                bringMapOverlayToFront(controlRoot, controlCorner, lc);
                return;
            }
            window.gaMapOverlayZ = Math.max(130500, Number(window.gaMapOverlayZ) || 130500) + 1;
            if (controlRoot && controlRoot.style) controlRoot.style.zIndex = String(window.gaMapOverlayZ);
            if (controlCorner && controlCorner.style) controlCorner.style.zIndex = String(window.gaMapOverlayZ);
            lc.style.zIndex = String(window.gaMapOverlayZ);
        };
        // Hover-Verhalten robust deaktivieren: Leaflet nutzt je nach Version
        // mouseover/mouseout oder mouseenter/mouseleave.
        const expandFn = (typeof layerControl.expand === 'function') ? layerControl.expand
            : ((typeof layerControl._expand === 'function') ? layerControl._expand : null);
        const collapseFn = (typeof layerControl.collapse === 'function') ? layerControl.collapse
            : ((typeof layerControl._collapse === 'function') ? layerControl._collapse : null);
        const origExpand = expandFn ? expandFn.bind(layerControl) : null;
        const origCollapse = collapseFn ? collapseFn.bind(layerControl) : null;

        // Harte Absicherung: Expand nur aus unserem Klick-Flow erlauben.
        layerControl._allowManualExpand = false;
        if (origExpand) {
            layerControl.expand = function() {
                if (!this._allowManualExpand) return this;
                bringLayerControlToFront();
                const out = origExpand();
                portalLayerControl(true);
                fitMapLayerControl();
                bringLayerControlToFront();
                return out;
            };
            layerControl._expand = layerControl.expand;
        }
        if (origCollapse) {
            layerControl.collapse = function() {
                const result = origCollapse();
                portalLayerControl(false);
                return result;
            };
            layerControl._collapse = layerControl.collapse;
        }
        if (expandFn) {
            L.DomEvent.off(lc, 'mouseover', expandFn, layerControl);
            L.DomEvent.off(lc, 'mouseenter', expandFn, layerControl);
            L.DomEvent.off(lc, 'pointerenter', expandFn, layerControl);
        }
        if (collapseFn) {
            L.DomEvent.off(lc, 'mouseout', collapseFn, layerControl);
            L.DomEvent.off(lc, 'mouseleave', collapseFn, layerControl);
            L.DomEvent.off(lc, 'pointerleave', collapseFn, layerControl);
        }

        const toggle = lc.querySelector('.leaflet-control-layers-toggle');
        if (toggle) {
            // Falls Touch-Click expand bereits von Leaflet gebunden ist, entfernen
            if (expandFn) {
                L.DomEvent.off(toggle, 'click', expandFn, layerControl);
                L.DomEvent.off(toggle, 'focus', expandFn, layerControl);
            }
            L.DomEvent.on(toggle, 'click', L.DomEvent.stop);
            L.DomEvent.on(toggle, 'pointerdown', bringLayerControlToFront);
            L.DomEvent.on(toggle, 'mousedown', bringLayerControlToFront);
            L.DomEvent.on(toggle, 'click', () => {
                bringLayerControlToFront();
                const isOpen = L.DomUtil.hasClass(lc, 'leaflet-control-layers-expanded');
                if (isOpen && typeof layerControl.collapse === 'function') {
                    layerControl.collapse();
                } else if (!isOpen && typeof layerControl.expand === 'function') {
                    layerControl._allowManualExpand = true;
                    layerControl.expand();
                    layerControl._allowManualExpand = false;
                }
            });
        }
        L.DomEvent.on(lc, 'pointerdown', bringLayerControlToFront);
        L.DomEvent.on(lc, 'click', bringLayerControlToFront);

        if (!map._layersOutsideCloseBound) {
            document.addEventListener('click', (e) => {
                const isOpen = L.DomUtil.hasClass(lc, 'leaflet-control-layers-expanded');
                if (!isOpen) return;
                if (lc.contains(e.target)) return;
                if (typeof layerControl.collapse === 'function') layerControl.collapse();
            }, true);
            map._layersOutsideCloseBound = true;
        }
    }

}

const GA_MAP_WEATHER_REFRESH_MS = 5 * 60 * 1000;

function observeMapWeatherVisibility(map, onChange) {
    const board = map.getContainer().closest('#mapTableOverlay');
    document.addEventListener('visibilitychange', onChange);
    if (board) {
        let open = board.classList.contains('active');
        new MutationObserver(() => {
            const next = board.classList.contains('active');
            if (next === open) return;
            open = next;
            onChange();
        }).observe(board, { attributes: true, attributeFilter: ['class'] });
    }
    return () => !document.hidden && (!board || board.classList.contains('active'));
}

function createMapRadarOverlay(map, pane) {
    const overlay = L.layerGroup();
    let framePath = '';
    let request = null;
    let refreshTimer;

    function showFrame(path) {
        if (!active() || !path || framePath === path) return;
        overlay.clearLayers();
        framePath = path;
        L.tileLayer('https://tilecache.rainviewer.com' + path + '/256/{z}/{x}/{y}/2/1_1.png', {
            pane, opacity: 0.65, maxNativeZoom: 7, attribution: 'Radar © RainViewer'
        }).addTo(overlay);
    }

    async function refresh() {
        if (!active() || request) return;
        const controller = window.gaProfileDataProvider ? window.gaProfileDataProvider.createAbortController() : new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        request = controller;
        try {
            const fetchRadar = typeof window.gaMapRadarFetch === 'function' ? window.gaMapRadarFetch : fetch;
            const response = await fetchRadar('https://api.rainviewer.com/public/weather-maps.json', {
                signal: controller.signal, cache: 'no-cache'
            });
            if (!response.ok) throw new Error('Radar HTTP ' + response.status);
            const data = await response.json();
            if (request !== controller) return;
            const frames = Array.isArray(data?.radar?.past) ? data.radar.past : [];
            const newest = frames[frames.length - 1];
            if (/^\/v2\/radar\/[a-zA-Z0-9_/-]+$/.test(newest?.path || '')) showFrame(newest.path);
        } catch (error) {
            if (request !== controller) return;
            console.warn('[RainViewer]', error);
        } finally {
            clearTimeout(timeout);
            if (request === controller) {
                request = null;
                refreshTimer = setTimeout(refresh, GA_MAP_WEATHER_REFRESH_MS);
            }
        }
    }

    function sync() {
        clearTimeout(refreshTimer);
        const previousRequest = request;
        request = null;
        previousRequest?.abort();
        if (active()) {
            void refresh();
        } else {
            overlay.clearLayers();
            framePath = '';
        }
    }
    const visible = observeMapWeatherVisibility(map, sync);
    const active = () => map.hasLayer(overlay) && visible();
    overlay.on('add remove', () => {
        localStorage.setItem('ga_radar_active', String(map.hasLayer(overlay)));
        sync();
    });
    if (localStorage.getItem('ga_radar_active') === 'true') overlay.addTo(map);
    return overlay;
}

// EUMETView provides georeferenced PNGs. The mask style codes clouds as white,
// clear land/water as green/blue and missing observations as black.
const GA_SAT_WMS = 'https://view.eumetsat.int/geoserver';
const GA_SAT_PRODUCTS = {
    clouds: { workspace: 'msg_fes', layer: 'clm', maxNativeZoom: 6 },
    infrared: { workspace: 'mtg_fd', layer: 'ir105_hrfi', maxNativeZoom: 7 }
};
function createMapSatelliteOverlay(map, pane, onChange) {
    let enabled = localStorage.getItem('ga_satellite_clouds_enabled') === 'true';
    let mode = localStorage.getItem('ga_satellite_clouds_mode') === 'infrared' ? 'infrared' : 'clouds';
    let layer = null;
    let time = '';
    let state = 'loading';
    let timer;
    let request = null;
    const CloudTile = L.TileLayer.WMS.extend({
        createTile(coords, done) {
            const tile = document.createElement('canvas');
            const size = this.getTileSize();
            tile.width = size.x;
            tile.height = size.y;
            const image = new Image();
            image.crossOrigin = 'anonymous';
            const releaseImage = () => {
                image.onload = image.onerror = null;
                delete tile.cancelSatelliteTile;
            };
            image.onload = () => {
                try {
                    const ctx = tile.getContext('2d', { willReadFrequently: true });
                    ctx.drawImage(image, 0, 0, size.x, size.y);
                    const pixels = ctx.getImageData(0, 0, size.x, size.y);
                    const rgba = pixels.data;
                    for (let i = 0; i < rgba.length; i += 4) {
                        // Preserve coverage at interpolated boundaries. Only
                        // white contributes across all three color channels.
                        rgba[i + 3] *= Math.min(rgba[i], rgba[i + 1], rgba[i + 2]) / 255;
                        rgba[i] = rgba[i + 1] = rgba[i + 2] = 255;
                    }
                    ctx.putImageData(pixels, 0, 0);
                    done(null, tile);
                } catch (error) {
                    done(error, tile);
                } finally {
                    releaseImage();
                }
            };
            image.onerror = () => {
                releaseImage();
                done(new Error('EUMETView tile failed'), tile);
            };
            tile.cancelSatelliteTile = () => {
                releaseImage();
                if (!image.complete) image.removeAttribute('src');
            };
            image.src = this.getTileUrl(coords);
            return tile;
        }
    });
    const boardVisible = observeMapWeatherVisibility(map, sync);
    const visible = () => enabled && boardVisible();
    const removeLayer = () => {
        if (layer) map.removeLayer(layer);
        layer = null;
        time = '';
    };

    function showFrame(stamp) {
        if (!visible()) return;
        if (stamp === time && state !== 'unavailable') return;
        removeLayer();
        const product = GA_SAT_PRODUCTS[mode];
        const options = {
            layers: product.workspace + ':' + product.layer, version: '1.3.0', format: 'image/png', transparent: true,
            time: stamp, pane, opacity: mode === 'clouds' ? 0.58 : 0.46,
            maxNativeZoom: product.maxNativeZoom, noWrap: true, updateWhenIdle: true,
            bounds: [[-64, -72], [68, 72]], attribution: 'Satellit © EUMETSAT'
        };
        const endpoint = GA_SAT_WMS + '/wms';
        const tiles = window.gaMapSatelliteTileUrl
            ? L.tileLayer(window.gaMapSatelliteTileUrl(mode, stamp, '{z}', '{x}', '{y}'), options)
            : mode === 'clouds' ? new CloudTile(endpoint, options) : L.tileLayer.wms(endpoint, options);
        layer = tiles;
        time = stamp;
        state = 'loading';
        let loadedTile = false;
        tiles.on('tileabort tileunload', event => event.tile.cancelSatelliteTile?.());
        tiles.on('tileload', () => { loadedTile = true; });
        tiles.on('load', () => {
            if (layer !== tiles) return;
            state = loadedTile ? 'ready' : 'unavailable';
            onChange();
        });
        tiles.addTo(map);
        onChange();
    }

    async function refresh() {
        if (!visible() || request) return;
        const product = GA_SAT_PRODUCTS[mode];
        const layerName = product.workspace + ':' + product.layer;
        const controller = window.gaProfileDataProvider ? window.gaProfileDataProvider.createAbortController() : new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        request = controller;
        try {
            const url = GA_SAT_WMS + '/' + product.workspace + '/wms?service=WMS&version=1.3.0&request=GetCapabilities';
            const fetchMetadata = window.gaMapSatelliteFetch || fetch;
            const response = await fetchMetadata(url, { signal: controller.signal, cache: 'no-cache' });
            if (!response.ok) throw new Error('EUMETView HTTP ' + response.status);
            if (window.gaMapSatelliteFetch) {
                const data = await response.json();
                if (request !== controller || !visible()) return;
                if (!Number.isFinite(Date.parse(data?.time))) throw new Error('EUMETView time unavailable');
                showFrame(data.time);
                return;
            }
            const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
            if (request !== controller || !visible()) return;
            const entry = [...xml.getElementsByTagNameNS('*', 'Layer')].find(node =>
                [...node.children].some(child => child.localName === 'Name'
                    && [layerName, product.layer].includes(child.textContent.trim())));
            const nextDimension = [...(entry?.children || [])].find(child =>
                child.localName === 'Dimension' && child.getAttribute('name') === 'time');
            const stamp = nextDimension?.getAttribute('default');
            if (!Number.isFinite(Date.parse(stamp))) throw new Error('EUMETView time unavailable');
            showFrame(stamp);
        } catch (error) {
            if (request !== controller) return;
            if (!layer) state = 'unavailable';
            console.warn('[EUMETView]', error);
        } finally {
            clearTimeout(timeout);
            if (request === controller) {
                request = null;
                if (visible()) timer = setTimeout(refresh, GA_MAP_WEATHER_REFRESH_MS);
                onChange();
            }
        }
    }

    function sync() {
        clearTimeout(timer);
        const previousRequest = request;
        request = null;
        previousRequest?.abort();
        removeLayer();
        state = 'loading';
        if (visible()) void refresh();
        onChange();
    }

    return {
        get enabled() { return enabled; },
        get mode() { return mode; },
        get time() { return time; },
        get state() { return state; },
        sync,
        toggle() {
            enabled = !enabled;
            localStorage.setItem('ga_satellite_clouds_enabled', String(enabled));
            sync();
        },
        setMode(value) {
            if (value === mode || !Object.prototype.hasOwnProperty.call(GA_SAT_PRODUCTS, value)) return;
            mode = value;
            localStorage.setItem('ga_satellite_clouds_mode', mode);
            sync();
        }
    };
}

function installMapWeatherQuickControls(map, layerControl, radar, satellitePane, weather) {
    const list = layerControl._container.querySelector('.leaflet-control-layers-list');
    const panel = document.createElement('div');
    panel.className = 'ga-map-weather-quick';
    const tiles = document.createElement('div');
    tiles.className = 'ga-map-weather-tiles';
    panel.appendChild(tiles);

    const cloud = '<path d="M6.5 16a4 4 0 1 1 .8-7.9 5.3 5.3 0 0 1 10.2 1.2A3.4 3.4 0 1 1 18 16z"/>';
    const icons = {
        satellite: cloud,
        radar: cloud + '<path d="m8 19-1 2m6-2-1 2m6-2-1 2"/>',
        vfr: '<path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="m9 4 0 14m6-12v14" /><path d="M5.5 10v5" stroke="#6ccc8e"/><path d="M12 9v5" stroke="#f0ce55"/><path d="M18.5 8v5" stroke="#ed887e"/>',
        weather: '<path d="M3 8h12a2.5 2.5 0 1 0-2.5-2.5M3 12h16a2 2 0 1 1-2 2M3 16h8a2.5 2.5 0 1 1-2.5 2.5"/>'
    };
    const buttons = {};
    const actions = {
        satellite: () => satellite.toggle(),
        radar: () => map.hasLayer(radar) ? map.removeLayer(radar) : radar.addTo(map),
        vfr: weather.toggleVfr,
        weather: () => weather.toggleFields()
    };
    const text = (key, fallback) => window.GAI18n?.t('map.quickWeather.' + key, null, fallback) ?? fallback;
    const labels = { satellite: 'Satellit', radar: 'Radar', vfr: 'VFR-Index', weather: 'Wetter' };
    for (const [key, action] of Object.entries(actions)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' + icons[key] + '</svg><span></span>';
        button.addEventListener('click', action);
        tiles.appendChild(button);
        buttons[key] = button;
    }

    const options = document.createElement('div');
    options.className = 'ga-map-satellite-options';
    const mode = document.createElement('select');
    mode.add(new Option('', 'clouds'));
    mode.add(new Option('', 'infrared'));
    mode.addEventListener('change', () => satellite.setMode(mode.value));
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    options.appendChild(mode);
    options.appendChild(status);
    panel.appendChild(options);
    if (weather.installOptions) weather.installOptions(panel);
    list.insertBefore(panel, list.firstChild);

    function refresh() {
        const states = {
            satellite: satellite.enabled,
            radar: map.hasLayer(radar),
            vfr: weather.isVfrOn(),
            weather: weather.fieldsState()
        };
        for (const [key, button] of Object.entries(buttons)) {
            button.lastElementChild.textContent = text(key, labels[key]);
            button.setAttribute('aria-pressed', String(states[key]));
        }
        buttons.weather.title = text('weatherTitle', 'Windbarben und Wolkenfelder');
        if (weather.vfrTitle) buttons.vfr.title = weather.vfrTitle;
        mode.setAttribute('aria-label', text('mode', 'Satellitendarstellung'));
        mode.options[0].textContent = text('clouds', 'Nur Wolken');
        mode.options[1].textContent = text('infrared', 'Infrarotbild');
        mode.value = satellite.mode;
        options.hidden = !satellite.enabled;
        const timeLabel = satellite.time ? satellite.time.slice(11, 16) + ' UTC' : '';
        status.title = satellite.time;
        status.textContent = satellite.state === 'unavailable'
            ? text('unavailable', 'Nicht verfügbar') : timeLabel || text('loading', 'Lädt …');
    }
    const satellite = createMapSatelliteOverlay(map, satellitePane, refresh);
    radar.on('add remove', refresh);
    window.addEventListener('ga:languagechange', refresh);
    window.refreshMapWeatherQuickControls = refresh;
    satellite.sync();
}
