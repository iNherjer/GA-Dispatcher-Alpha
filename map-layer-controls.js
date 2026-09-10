// Shared Standalone click-only layer menu and viewport bounds.
function configureMapLayerControl(map, layerControl) {
    if (layerControl && layerControl._container) {
        const lc = layerControl._container;
        const controlParent = lc.parentElement;
        const mapFrame = map.getContainer().parentElement;
        function portalLayerControl(open) {
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
            lc.style.maxWidth = Math.max(120, Math.min(320, window.innerWidth - 24)) + 'px';
            if (list) {
                list.style.maxHeight = Math.max(80, bottom - Math.max(0, rect.top) - 30) + 'px';
                list.style.overflowY = 'auto';
            }
        }
        window.addEventListener('resize', fitMapLayerControl);
        const bringLayerControlToFront = () => {
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

function createMapRadarOverlay(map, pane) {
    const overlay = L.layerGroup();
    let selected = localStorage.getItem('ga_radar_active') === 'true';
    map.on('overlayadd overlayremove', function(event) {
        if (event.layer !== overlay) return;
        selected = event.type === 'overlayadd';
        localStorage.setItem('ga_radar_active', String(selected));
    });
    if (selected) overlay.addTo(map);
    const request = typeof window.gaMapRadarFetch === 'function' ? window.gaMapRadarFetch : fetch;
    request('https://api.rainviewer.com/public/weather-maps.json')
        .then(res => { if (!res.ok) throw new Error('Radar HTTP ' + res.status); return res.json(); })
        .then(data => {
            const past = data && data.radar && data.radar.past;
            if (!Array.isArray(past) || !past.length) return;
            const latest = past[past.length - 1].path;
            if (!/^\/v2\/radar\/[a-zA-Z0-9_/-]+$/.test(latest)) throw new Error('invalid_radar_path');
            L.tileLayer('https://tilecache.rainviewer.com' + latest + '/256/{z}/{x}/{y}/2/1_1.png', {
                pane: pane, opacity: 0.65, transparent: true, maxNativeZoom: 7, attribution: 'Radar © RainViewer'
            }).addTo(overlay);
        }).catch(error => console.warn('RainViewer Fetch Fehler:', error));
    return overlay;
}
