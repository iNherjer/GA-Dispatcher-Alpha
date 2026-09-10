// Original sidebar map focus and profile highlighting, shared by App and EFB.
let airspaceMapLayers = [];
let routeToolFocusLayer = null;
let highlightedAirspaceIdx = -1; // track which airspace is toggled on
let vpHighlightPulseIdx = -1; // airspace index pulsing in profile canvas
let vpPulseAnimFrame = null; // requestAnimationFrame ID
let vpPulsePhase = 0; // 0..1 for pulse animation
function vpStartHighlightPulse() {
    vpStopHighlightPulse();
    vpPulsePhase = 0.25; // Startet direkt mit voller Leuchtkraft

    function toggleBlink() {
        vpPulsePhase = (vpPulsePhase === 0.25) ? 0 : 0.25; // Wechselt zwischen 0 und 0.25 (an/aus)
        if (typeof renderMapProfile === 'function') renderMapProfile();
        if (document.getElementById('verticalProfileCanvas')) renderVerticalProfile('verticalProfileCanvas');
    }

    toggleBlink(); // Sofortiges erstes Rendern
    vpPulseAnimFrame = setInterval(toggleBlink, 700); // Alle 700ms entspannt umschalten statt 60x pro Sekunde
}

function vpStopHighlightPulse() {
    if (vpPulseAnimFrame) {
        clearInterval(vpPulseAnimFrame);
        vpPulseAnimFrame = null;
    }
    vpPulsePhase = 0;
}

function clearAirspaceMapLayers() {
    if (map) {
        airspaceMapLayers.forEach(l => map.removeLayer(l));
        airspaceMapLayers = [];
    }
    highlightedAirspaceIdx = -1;
    vpHighlightPulseIdx = -1;
    vpStopHighlightPulse();
    document.querySelectorAll('.as-row.as-active').forEach(el => el.classList.remove('as-active'));
    if (typeof renderMapProfile === 'function') renderMapProfile();
    if (document.getElementById('verticalProfileCanvas')) renderVerticalProfile('verticalProfileCanvas');
}

function clearRouteToolPointFocus() {
    if (map && routeToolFocusLayer) {
        map.removeLayer(routeToolFocusLayer);
    }
    routeToolFocusLayer = null;
}

function clearRouteToolMapFocus() {
    clearRouteToolPointFocus();
    if (highlightedAirspaceIdx !== -1 || airspaceMapLayers.length) clearAirspaceMapLayers();
}

window.gaClearRouteToolMapFocus = clearRouteToolMapFocus;

function toggleAirspaceHighlight(idx) {
    if (!activeAirspaces[idx]) return;

    // If same airspace is already highlighted, toggle it off
    if (highlightedAirspaceIdx === idx) {
        clearAirspaceMapLayers();
        return;
    }

    if (map) {
        airspaceMapLayers.forEach(l => map.removeLayer(l));
        airspaceMapLayers = [];
    }
    document.querySelectorAll('.as-row.as-active').forEach(el => el.classList.remove('as-active'));

    const airspace = activeAirspaces[idx];
    highlightedAirspaceIdx = idx;

    if (map) {
        const coords = airspace.geometry.coordinates;
        let polys = [];
        if (airspace.geometry.type === 'Polygon') {
            polys = [coords[0].map(c => [c[1], c[0]])];
        } else if (airspace.geometry.type === 'MultiPolygon') {
            polys = coords.map(pc => pc[0].map(c => [c[1], c[0]]));
        }
        const info = getAirspaceStyle(airspace);
        polys.forEach(ring => {
            const layer = L.polygon(ring, {
                color: info.mapColor || '#ff4444', weight: 3, fillColor: info.mapColor || '#ff4444',
                fillOpacity: 0.25, dashArray: '6,4', className: 'airspace-highlight-pulse'
            }).addTo(map);
            const displayName = getAirspaceDisplayName(airspace);
            layer.bindTooltip(`<b>${info.icon} ${displayName}</b>`, { sticky: true, className: 'airspace-tooltip' });
            airspaceMapLayers.push(layer);
        });
    }

    const row = document.querySelector(`.as-row[data-as-idx="${idx}"]`);
    if (row) row.classList.add('as-active');

    vpHighlightPulseIdx = idx;
    vpStartHighlightPulse();
}

function getAirspaceLeafletBounds(airspace) {
    if (!airspace?.geometry || typeof L === 'undefined') return null;
    const bounds = L.latLngBounds([]);
    const addRing = (ring) => {
        if (!Array.isArray(ring)) return;
        ring.forEach(c => {
            if (!Array.isArray(c) || c.length < 2) return;
            const lat = Number(c[1]);
            const lon = Number(c[0]);
            if (Number.isFinite(lat) && Number.isFinite(lon)) bounds.extend([lat, lon]);
        });
    };
    if (airspace.geometry.type === 'Polygon') {
        addRing(airspace.geometry.coordinates?.[0]);
    } else if (airspace.geometry.type === 'MultiPolygon') {
        airspace.geometry.coordinates.forEach(poly => addRing(poly?.[0]));
    }
    return bounds.isValid() ? bounds : null;
}

window.gaFocusAirspaceOnMap = function(idx) {
    const numericIdx = Number(idx);
    const airspace = activeAirspaces[numericIdx];
    if (!airspace || !map) return false;
    clearRouteToolPointFocus();
    if (highlightedAirspaceIdx !== numericIdx) toggleAirspaceHighlight(numericIdx);
    const bounds = getAirspaceLeafletBounds(airspace);
    if (bounds) {
        map.fitBounds(bounds.pad(0.18), {
            padding: [48, 48],
            maxZoom: 12,
            animate: true,
            duration: 0.45
        });
    }
    return true;
};

window.gaFocusAirportOnMap = function(airport) {
    const lat = Number(airport?.lat);
    const lon = Number(airport?.lon ?? airport?.lng);
    if (!map || !Number.isFinite(lat) || !Number.isFinite(lon) || typeof L === 'undefined') return false;
    clearRouteToolMapFocus();
    routeToolFocusLayer = L.circleMarker([lat, lon], {
        radius: 13,
        color: '#ffffff',
        weight: 3,
        fillColor: '#ff334f',
        fillOpacity: 0.72,
        className: 'route-tool-map-focus-pulse'
    }).addTo(map);
    const label = `${airport?.icao || ''}${airport?.name ? ` · ${airport.name}` : ''}`.trim();
    if (label) routeToolFocusLayer.bindTooltip(label, { permanent: false, sticky: true, className: 'airspace-tooltip' });
    map.setView([lat, lon], Math.max(map.getZoom() || 10, 12), { animate: true });
    return true;
};
