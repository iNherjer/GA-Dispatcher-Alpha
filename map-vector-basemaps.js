/* OpenFreeMap base layers for the existing Leaflet map. */
(function(root) {
    'use strict';
    const assetBase = new URL('./', document.currentScript.src);
    const attribution = '<a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> · '
        + '&copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> · '
        + 'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';
    let libraryPromise = null;

    function loadScript(path) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = new URL(path, assetBase).href;
            script.onload = resolve;
            script.onerror = () => {
                script.remove();
                reject(new Error('vector_basemap_library_unavailable'));
            };
            document.head.appendChild(script);
        });
    }

    function loadLibraries() {
        if (!libraryPromise) {
            libraryPromise = (async () => {
                if (!root.maplibregl) await loadScript('vendor/maplibre/maplibre-gl.js');
                if (!root.L.maplibreGL) await loadScript('vendor/maplibre/leaflet-maplibre-gl.js');
            })().catch(error => {
                libraryPromise = null;
                throw error;
            });
        }
        return libraryPromise;
    }

    root.createOpenFreeMapLayer = function(style) {
        if (!['positron', 'dark', 'fiord'].includes(style)) throw new Error('unknown_vector_basemap');
        const L = root.L;
        const OpenFreeMapLayer = L.Layer.extend({
            options: { attribution },
            onAdd(map) {
                const generation = this._generation = (this._generation || 0) + 1;
                const current = () => this._generation === generation && map.hasLayer(this);
                this._status = L.control({ position: 'bottomleft' });
                this._status.onAdd = () => {
                    const node = L.DomUtil.create('div', 'ga-vector-map-status');
                    node.setAttribute('role', 'status');
                    node.textContent = 'Basiskarte wird geladen …';
                    this._statusNode = node;
                    return node;
                };
                this._status.addTo(map);
                const fail = error => {
                    if (!current()) return;
                    console.warn('[Basemap]', style, error?.message || error);
                    if (this._statusNode) this._statusNode.textContent = 'Basiskarte nicht verfügbar. Bitte andere Karte wählen.';
                };
                loadLibraries().then(() => {
                    if (!current()) return;
                    if (typeof root.maplibregl.supported === 'function' && !root.maplibregl.supported()) {
                        throw new Error('webgl_unavailable');
                    }
                    // A failed WebGL constructor can leave the adapter's Leaflet
                    // container attached before it has a renderer to dispose.
                    const Renderer = L.MaplibreGL.extend({
                        onRemove(targetMap) {
                            if (this.getMaplibreMap()) L.MaplibreGL.prototype.onRemove.call(this, targetMap);
                            else this.getContainer()?.remove();
                        }
                    });
                    this._inner = new Renderer({
                        style: `https://tiles.openfreemap.org/styles/${style}`,
                        pane: 'tilePane',
                        interactive: false,
                        attributionControl: false,
                        pitch: 0,
                        bearing: 0,
                        maxPitch: 0,
                        renderWorldCopies: true
                    });
                    this._inner.addTo(map);
                    const glMap = this._inner.getMaplibreMap();
                    glMap.once('load', () => {
                        if (current()) {
                            this._loaded = true;
                            this._status.remove();
                        }
                    });
                    glMap.on('error', event => {
                        if (!this._loaded) fail(event.error);
                    });
                }).catch(fail);
            },
            onRemove(map) {
                this._generation = (this._generation || 0) + 1;
                this._status?.remove();
                this._status = null;
                this._statusNode = null;
                if (this._inner) map.removeLayer(this._inner);
                this._inner = null;
                this._loaded = false;
            }
        });
        return new OpenFreeMapLayer();
    };
})(window);
