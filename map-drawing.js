let measureMode = false, measurePoints = [], measurePolyline = null, measureMarkers = [], measureTooltip = null;
/* Shared Standalone drawing, eraser, ruler and floating rail. */
const measureIcon = L.divIcon({ className: 'custom-pin', html: `<div class="pin-hitbox" style="cursor: move;"><div class="pin-dot" style="background-color: #fff; width: 12px; height: 12px; min-width: 12px; min-height: 12px;"></div></div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
const mapDrawState = {
    enabled: false,
    panelOpen: false,
    menuOpen: false,
    tool: 'freehand',
    color: localStorage.getItem('ga_map_draw_color') || '#ff3b30',
    weight: Math.max(2, Math.min(18, parseInt(localStorage.getItem('ga_map_draw_weight') || '5', 10) || 5)),
    layer: null,
    drawings: [],
    lineStart: null,
    lineStartMarker: null,
    previewLine: null,
    drawingLine: null,
    drawingPoints: [],
    isDrawing: false,
    lastLayerPoint: null,
    lastEraseAt: 0,
    suppressButtonClickUntil: 0,
    suppressMapClickUntil: 0,
    justDraggedUntil: 0,
    lastTapToggleAt: 0,
    activeDrawPointerId: null,
    buttonDrag: null
};
const MAP_DRAW_XR_POINTER_UA_RE = /OculusBrowser|Quest|Meta Quest|VR/i;
function isMapUiClickTarget(evt) {
    const t = evt && evt.target;
    if (!t || !t.closest) return false;
    return Boolean(
        t.closest('.leaflet-control') ||
        t.closest('.map-overlay-btn') ||
        t.closest('.map-draw-rail') ||
        t.closest('.map-draw-floating-btn') ||
        t.closest('.map-draw-tool-stack') ||
        t.closest('.map-draw-menu') ||
        t.closest('.map-utility-device') ||
        t.closest('.pb-btn') ||
        t.closest('#vpSettingsMenu') ||
        t.closest('#awmFreqBanner') ||
        t.closest('.telemetry-box') ||
        t.closest('.leaflet-popup') ||
        t.closest('.leaflet-tooltip')
    );
}

window.gaMapOverlayZ = window.gaMapOverlayZ || 130500;

function bringMapOverlayToFront(...items) {
    window.gaMapOverlayZ = Math.max(130500, Number(window.gaMapOverlayZ) || 130500) + 1;
    let drawerWasRequested = false;
    items.forEach(item => {
        const el = typeof item === 'string' ? document.getElementById(item) : item;
        if (!el || !el.style) return;
        if (el.id === 'mapSideDrawer') drawerWasRequested = true;
        el.style.zIndex = String(window.gaMapOverlayZ);
    });
    const drawer = document.getElementById('mapSideDrawer');
    if (drawer && drawer.classList.contains('is-open') && !drawerWasRequested) {
        window.gaMapOverlayZ += 1;
        drawer.style.zIndex = String(window.gaMapOverlayZ);
    }
}

window.gaBringMapOverlayToFront = bringMapOverlayToFront;

function ensureMapDrawLayer() {
    if (!map || mapDrawState.layer) return;
    mapDrawState.layer = L.layerGroup().addTo(map);
}

function getMapDrawStyle(extra = {}) {
    return {
        color: mapDrawState.color,
        weight: mapDrawState.weight,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
        ...(window.gaMapDrawingHost?.pathOptions || {}),
        ...extra
    };
}

function syncMapDrawUi() {
    window.gaMapDrawingHost?.changed?.(mapDrawState.enabled || measureMode);
    const rail = document.getElementById('mapDrawRail');
    const floatingBtn = document.getElementById('mapDrawFloatingBtn');
    const toolStack = document.getElementById('mapDrawToolStack');
    const penBtn = document.getElementById('mapToolPen');
    const eraserToolBtn = document.getElementById('mapToolEraser');
    const settingsToolBtn = document.getElementById('mapToolSettings');
    const measureToolBtn = document.getElementById('mapToolMeasure');
    const stopwatchToolBtn = document.getElementById('mapToolStopwatch');
    const calculatorToolBtn = document.getElementById('mapToolCalculator');
    const e6bToolBtn = document.getElementById('mapToolE6B');
    const menu = document.getElementById('mapDrawMenu');
    const weightInput = document.getElementById('mapDrawWeightInput');
    document.body.classList.toggle('map-drawing-active', mapDrawState.enabled);

    if (rail) {
        rail.style.display = 'block';
        rail.style.visibility = 'visible';
        rail.style.pointerEvents = 'auto';
    }
    if (floatingBtn) {
        floatingBtn.classList.toggle('active', mapDrawState.panelOpen);
    }
    if (toolStack) toolStack.classList.toggle('open', mapDrawState.panelOpen);
    if (penBtn) penBtn.classList.toggle('active', mapDrawState.enabled && mapDrawState.tool === 'freehand');
    if (eraserToolBtn) eraserToolBtn.classList.toggle('active', mapDrawState.enabled && mapDrawState.tool === 'eraser');
    if (settingsToolBtn) settingsToolBtn.classList.toggle('active', mapDrawState.menuOpen);
    if (measureToolBtn) {
        measureToolBtn.classList.toggle('active', !!measureMode);
        measureToolBtn.title = `Messen (${measureMode ? 'An' : 'Aus'})`;
    }
    if (stopwatchToolBtn) {
        const open = typeof window.isMapUtilityToolOpen === 'function' && window.isMapUtilityToolOpen('stopwatch');
        stopwatchToolBtn.classList.toggle('active', !!open);
    }
    if (calculatorToolBtn) {
        const open = typeof window.isMapUtilityToolOpen === 'function' && window.isMapUtilityToolOpen('calculator');
        calculatorToolBtn.classList.toggle('active', !!open);
    }
    if (e6bToolBtn) {
        const open = typeof window.isMapUtilityToolOpen === 'function' && window.isMapUtilityToolOpen('e6b');
        e6bToolBtn.classList.toggle('active', !!open);
    }
    if (menu) {
        const shouldOpen = mapDrawState.menuOpen;
        menu.classList.toggle('open', shouldOpen);
        menu.style.display = shouldOpen ? 'block' : 'none';
        menu.style.visibility = shouldOpen ? 'visible' : 'hidden';
        menu.style.pointerEvents = shouldOpen ? 'auto' : 'none';
    }
    if (weightInput) weightInput.value = String(mapDrawState.weight);

    const mapEl = document.getElementById('map');
    if (mapEl) mapEl.style.cursor = mapDrawState.enabled ? 'crosshair' : '';
    clampMapDrawFloatingButtonPosition();
}

function clearMapDrawPreview() {
    if (!map || !mapDrawState.layer) return;
    if (mapDrawState.previewLine) {
        mapDrawState.layer.removeLayer(mapDrawState.previewLine);
        mapDrawState.previewLine = null;
    }
}

function resetMapDrawGesture() {
    if (mapDrawState.drawingLine && mapDrawState.layer) {
        mapDrawState.layer.removeLayer(mapDrawState.drawingLine);
    }
    mapDrawState.drawingLine = null;
    mapDrawState.drawingPoints = [];
    mapDrawState.isDrawing = false;
    mapDrawState.lastLayerPoint = null;
    mapDrawState.lineStart = null;
    if (mapDrawState.lineStartMarker && mapDrawState.layer) {
        mapDrawState.layer.removeLayer(mapDrawState.lineStartMarker);
    }
    mapDrawState.lineStartMarker = null;
    mapDrawState.activeDrawPointerId = null;
    clearMapDrawPreview();
    if (map && map.dragging && !mapDrawState.enabled) map.dragging.enable();
}

function toggleMapDrawMode(force) {
    const next = typeof force === 'boolean' ? force : !mapDrawState.enabled;
    if (mapDrawState.enabled === next) {
        syncMapDrawUi();
        return;
    }
    mapDrawState.enabled = next;
    mapDrawState.menuOpen = next ? mapDrawState.menuOpen : false;
    if (next) {
        ensureMapDrawLayer();
        if (measureMode) toggleMeasureMode();
        if (typeof freeflightMode !== 'undefined' && freeflightMode) toggleFreeflightMode();
        if (map && typeof map.closePopup === 'function') map.closePopup();
        if (map && map.dragging) map.dragging.disable();
    } else {
        resetMapDrawGesture();
        mapDrawState.menuOpen = false;
        if (map && map.dragging) map.dragging.enable();
    }
    syncMapDrawUi();
}

function toggleMapDrawMenu(force) {
    if (!mapDrawState.panelOpen) return;
    mapDrawState.menuOpen = typeof force === 'boolean' ? force : !mapDrawState.menuOpen;
    syncMapDrawUi();
    if (mapDrawState.menuOpen) {
        positionMapDrawMenuNearButton();
        requestAnimationFrame(positionMapDrawMenuNearButton);
    }
}

function openMapDrawMenu(evt) {
    if (evt) {
        evt.preventDefault();
        evt.stopPropagation();
    }
    if (Date.now() < mapDrawState.justDraggedUntil || Date.now() < mapDrawState.suppressButtonClickUntil) return;
    mapDrawState.panelOpen = true;
    mapDrawState.menuOpen = true;
    syncMapDrawUi();
    requestAnimationFrame(clampMapDrawFloatingButtonPosition);
    positionMapDrawMenuNearButton();
    requestAnimationFrame(positionMapDrawMenuNearButton);
}

function closeMapDrawMenu(evt) {
    if (evt) {
        evt.preventDefault();
        evt.stopPropagation();
    }
    mapDrawState.menuOpen = false;
    // Schutz gegen direktes Wiederöffnen durch denselben Klickzyklus.
    mapDrawState.suppressButtonClickUntil = Date.now() + 220;
    syncMapDrawUi();
}

function toggleMapToolRail(evt) {
    if (evt) {
        evt.preventDefault();
        evt.stopPropagation();
    }
    if (Date.now() < mapDrawState.justDraggedUntil || Date.now() < mapDrawState.suppressButtonClickUntil) return;
    const wasPanelOpen = !!mapDrawState.panelOpen;
    mapDrawState.panelOpen = !mapDrawState.panelOpen;
    if (!mapDrawState.panelOpen) mapDrawState.menuOpen = false;
    if (wasPanelOpen && !mapDrawState.panelOpen) {
        if (mapDrawState.enabled) toggleMapDrawMode(false);
        if (measureMode) toggleMeasureMode();
    }
    if (mapDrawState.panelOpen) bringMapOverlayToFront('mapDrawRail');
    syncMapDrawUi();
    if (mapDrawState.panelOpen) requestAnimationFrame(clampMapDrawFloatingButtonPosition);
    if (mapDrawState.menuOpen) {
        positionMapDrawMenuNearButton();
        requestAnimationFrame(positionMapDrawMenuNearButton);
    }
}

function toggleMapDrawSettingsMenu(evt) {
    if (evt) {
        evt.preventDefault();
        evt.stopPropagation();
    }
    if (Date.now() < mapDrawState.justDraggedUntil || Date.now() < mapDrawState.suppressButtonClickUntil) return;
    mapDrawState.panelOpen = true;
    mapDrawState.menuOpen = !mapDrawState.menuOpen;
    if (mapDrawState.menuOpen) bringMapOverlayToFront('mapDrawRail', 'mapDrawMenu');
    syncMapDrawUi();
    requestAnimationFrame(clampMapDrawFloatingButtonPosition);
    if (mapDrawState.menuOpen) {
        positionMapDrawMenuNearButton();
        requestAnimationFrame(positionMapDrawMenuNearButton);
    }
}

function activateMapDrawTool(kind, evt) {
    if (evt) {
        evt.preventDefault();
        evt.stopPropagation();
    }
    if (kind === 'pen') {
        if (mapDrawState.enabled && mapDrawState.tool === 'freehand') {
            toggleMapDrawMode(false);
        } else {
            if (!mapDrawState.enabled) toggleMapDrawMode(true);
            setMapDrawTool('freehand');
        }
    } else if (kind === 'eraser') {
        if (mapDrawState.enabled && mapDrawState.tool === 'eraser') {
            toggleMapDrawMode(false);
        } else {
            if (!mapDrawState.enabled) toggleMapDrawMode(true);
            setMapDrawTool('eraser');
        }
    } else if (kind === 'line') {
        if (mapDrawState.enabled && mapDrawState.tool === 'line') {
            toggleMapDrawMode(false);
        } else {
            if (!mapDrawState.enabled) toggleMapDrawMode(true);
            setMapDrawTool('line');
        }
    } else if (kind === 'drawClear') {
        clearMapDrawings({ includeMeasure: true });
    } else if (kind === 'measure') {
        if (measureMode) {
            toggleMeasureMode();
        } else {
            toggleMeasureMode();
            if (mapDrawState.enabled) toggleMapDrawMode(false);
        }
        mapDrawState.menuOpen = false;
    } else if (kind === 'measureClear') {
        clearMeasure();
    } else if (kind === 'stopwatch') {
        if (typeof window.toggleMapUtilityTool === 'function') window.toggleMapUtilityTool('stopwatch');
        else if (typeof window.openMapUtilityTool === 'function') window.openMapUtilityTool('stopwatch');
        mapDrawState.menuOpen = false;
    } else if (kind === 'calculator') {
        if (typeof window.toggleMapUtilityTool === 'function') window.toggleMapUtilityTool('calculator');
        else if (typeof window.openMapUtilityTool === 'function') window.openMapUtilityTool('calculator');
        mapDrawState.menuOpen = false;
    } else if (kind === 'e6b') {
        if (typeof window.toggleMapUtilityTool === 'function') window.toggleMapUtilityTool('e6b');
        else if (typeof window.openMapUtilityTool === 'function') window.openMapUtilityTool('e6b');
        if (mapDrawState.enabled) toggleMapDrawMode(false);
        mapDrawState.menuOpen = false;
    }
    syncMapDrawUi();
}

function setMapDrawColor(color) {
    if (!/^#[0-9a-f]{6}$/i.test(String(color || ''))) return;
    mapDrawState.color = color;
    localStorage.setItem('ga_map_draw_color', color);
    syncMapDrawUi();
}

function setMapDrawWeight(value) {
    const weight = Math.max(2, Math.min(18, parseInt(value, 10) || 5));
    mapDrawState.weight = weight;
    localStorage.setItem('ga_map_draw_weight', String(weight));
    syncMapDrawUi();
}

function setMapDrawTool(tool) {
    if (tool !== 'freehand' && tool !== 'line' && tool !== 'eraser') return;
    resetMapDrawGesture();
    mapDrawState.tool = tool;
    syncMapDrawUi();
    if (tool === 'line') showMapToast('Linie: Startpunkt tippen, dann Endpunkt tippen', 2200);
    if (tool === 'eraser') showMapToast('Radierer: Strich oder Lineal antippen zum Löschen', 2200);
}

function hasActiveMeasure() {
    return !!measurePolyline || !!measureTooltip || measureMarkers.length > 0 || measurePoints.length > 0;
}

function clearMapDrawings(options = {}) {
    const includeMeasure = !!options.includeMeasure;
    const hadDrawings = mapDrawState.drawings.length > 0 || !!mapDrawState.drawingLine || !!mapDrawState.previewLine || !!mapDrawState.lineStartMarker;
    const hadMeasure = hasActiveMeasure();
    resetMapDrawGesture();
    if (mapDrawState.layer) mapDrawState.layer.clearLayers();
    mapDrawState.drawings = [];
    if (includeMeasure && hadMeasure) clearMeasure();
    if (includeMeasure) {
        showMapToast(hadDrawings || hadMeasure ? 'Zeichnungen und Lineal gelöscht' : 'Nichts zum Löschen', 1600);
    } else {
        showMapToast(hadDrawings ? 'Zeichnungen gelöscht' : 'Keine Zeichnung zum Löschen', 1600);
    }
}

function addMapDrawLineLabel(line, start, end) {
    if (!mapDrawState.layer || !line || !start || !end) return null;
    const nav = calcNav(start.lat, start.lng || start.lon, end.lat, end.lng || end.lon);
    const centerLat = (start.lat + end.lat) / 2;
    const centerLng = ((start.lng || start.lon) + (end.lng || end.lon)) / 2;
    const labelText = `<div style="font-weight:bold; font-size:14px; color:#111; text-align:center; line-height:1.2;">${nav.brng}°<br>${formatNm(nav.dist)} NM</div>`;
    const label = L.tooltip({ permanent: true, direction: 'center', className: 'measure-label' })
        .setLatLng([centerLat, centerLng])
        .setContent(labelText)
        .addTo(mapDrawState.layer);
    line._mapDrawLabel = label;
    return label;
}

function addMapDrawLineEndpoint(latlng, kind = 'start') {
    if (!mapDrawState.layer || !latlng) return null;
    const isStart = kind === 'start';
    return L.circleMarker(latlng, {
        radius: 5,
        color: '#111',
        weight: 2,
        fillColor: isStart ? '#44ff44' : '#ff4444',
        fillOpacity: 1,
        interactive: false,
        ...(window.gaMapDrawingHost?.pathOptions || {})
    }).addTo(mapDrawState.layer);
}

function getMapDrawLayerPointDistance(latlng, layer) {
    if (!map || !layer || typeof layer.getLatLngs !== 'function') return Infinity;
    const target = map.latLngToLayerPoint(latlng);
    const rawLatLngs = layer.getLatLngs();
    const segments = Array.isArray(rawLatLngs[0]) ? rawLatLngs.flat() : rawLatLngs;
    if (!segments || segments.length === 0) return Infinity;

    let best = Infinity;
    for (let i = 0; i < segments.length; i++) {
        const p = map.latLngToLayerPoint(segments[i]);
        best = Math.min(best, target.distanceTo(p));
        if (i === 0) continue;
        const a = map.latLngToLayerPoint(segments[i - 1]);
        const b = p;
        const abx = b.x - a.x;
        const aby = b.y - a.y;
        const lenSq = abx * abx + aby * aby;
        if (lenSq <= 0) continue;
        const t = Math.max(0, Math.min(1, ((target.x - a.x) * abx + (target.y - a.y) * aby) / lenSq));
        const proj = L.point(a.x + t * abx, a.y + t * aby);
        best = Math.min(best, target.distanceTo(proj));
    }
    return best;
}

function getMapLatLngPointDistance(latlng, targetLatLng) {
    if (!map || !latlng || !targetLatLng) return Infinity;
    const target = map.latLngToLayerPoint(latlng);
    const point = map.latLngToLayerPoint(targetLatLng);
    return target.distanceTo(point);
}

function getMapMeasurePointDistance(latlng) {
    if (!hasActiveMeasure()) return Infinity;
    let best = Infinity;
    if (measurePolyline) best = Math.min(best, getMapDrawLayerPointDistance(latlng, measurePolyline));
    measureMarkers.forEach(marker => {
        if (marker && typeof marker.getLatLng === 'function') {
            best = Math.min(best, getMapLatLngPointDistance(latlng, marker.getLatLng()));
        }
    });
    return best;
}

function eraseMapDrawingAt(latlng, silent = false) {
    const hasDrawings = !!mapDrawState.layer && mapDrawState.drawings.length > 0;
    const hasMeasure = hasActiveMeasure();
    if (!hasDrawings && !hasMeasure) {
        if (!silent) showMapToast('Nichts zum Löschen', 1200);
        return false;
    }
    let bestLayer = null;
    let bestDist = Infinity;
    if (hasDrawings) {
        mapDrawState.drawings.forEach(layer => {
            const dist = getMapDrawLayerPointDistance(latlng, layer);
            if (dist < bestDist) {
                bestDist = dist;
                bestLayer = layer;
            }
        });
    }
    const drawThreshold = Math.max(14, mapDrawState.weight + 10);
    const measureDist = getMapMeasurePointDistance(latlng);
    const measureThreshold = 22;
    const eraseMeasure = hasMeasure && measureDist <= measureThreshold && (!bestLayer || bestDist > drawThreshold || measureDist <= bestDist);
    if (eraseMeasure) {
        clearMeasure();
        if (!silent) showMapToast('Lineal gelöscht', 1000);
        return true;
    }
    if (!bestLayer || bestDist > drawThreshold) {
        if (!silent) showMapToast('Nichts getroffen', 1100);
        return false;
    }
    if (bestLayer._mapDrawLabel) {
        mapDrawState.layer.removeLayer(bestLayer._mapDrawLabel);
        bestLayer._mapDrawLabel = null;
    }
    if (Array.isArray(bestLayer._mapDrawEndpointMarkers)) {
        bestLayer._mapDrawEndpointMarkers.forEach(marker => {
            if (marker) mapDrawState.layer.removeLayer(marker);
        });
        bestLayer._mapDrawEndpointMarkers = null;
    }
    mapDrawState.layer.removeLayer(bestLayer);
    mapDrawState.drawings = mapDrawState.drawings.filter(layer => layer !== bestLayer);
    if (!silent) showMapToast('Strich gelöscht', 1000);
    return true;
}

function handleMapDrawMapClick(e) {
    if (!mapDrawState.enabled) return false;
    if (Date.now() < mapDrawState.suppressMapClickUntil) return true;
    if (isMapUiClickTarget(e.originalEvent)) return true;
    if (mapDrawState.tool === 'eraser') {
        if (Date.now() - mapDrawState.lastEraseAt < 250) return true;
        eraseMapDrawingAt(e.latlng);
        return true;
    }
    if (mapDrawState.tool !== 'line') return true;
    ensureMapDrawLayer();
    if (!mapDrawState.lineStart) {
        mapDrawState.lineStart = e.latlng;
        if (mapDrawState.lineStartMarker) mapDrawState.layer.removeLayer(mapDrawState.lineStartMarker);
        mapDrawState.lineStartMarker = addMapDrawLineEndpoint(e.latlng, 'start');
        clearMapDrawPreview();
        showMapToast('Endpunkt setzen', 1400);
        return true;
    }
    const lineStart = mapDrawState.lineStart;
    const line = L.polyline([lineStart, e.latlng], getMapDrawStyle()).addTo(mapDrawState.layer);
    addMapDrawLineLabel(line, lineStart, e.latlng);
    const startMarker = mapDrawState.lineStartMarker || addMapDrawLineEndpoint(lineStart, 'start');
    const endMarker = addMapDrawLineEndpoint(e.latlng, 'end');
    line._mapDrawEndpointMarkers = [startMarker, endMarker].filter(Boolean);
    mapDrawState.drawings.push(line);
    mapDrawState.lineStart = null;
    mapDrawState.lineStartMarker = null;
    clearMapDrawPreview();
    return true;
}

function handleMapDrawMouseDown(e) {
    if (!mapDrawState.enabled || (mapDrawState.tool !== 'freehand' && mapDrawState.tool !== 'eraser')) return;
    if (isMapUiClickTarget(e.originalEvent)) return;
    if (e.originalEvent && e.originalEvent.button && e.originalEvent.button !== 0) return;
    if (mapDrawState.tool === 'eraser') {
        if (eraseMapDrawingAt(e.latlng, true)) mapDrawState.lastEraseAt = Date.now();
        if (e.originalEvent) L.DomEvent.stop(e.originalEvent);
        return;
    }
    ensureMapDrawLayer();
    mapDrawState.isDrawing = true;
    mapDrawState.drawingPoints = [e.latlng];
    mapDrawState.lastLayerPoint = map.latLngToLayerPoint(e.latlng);
    mapDrawState.drawingLine = L.polyline(mapDrawState.drawingPoints, getMapDrawStyle()).addTo(mapDrawState.layer);
    if (map.dragging) map.dragging.disable();
    if (e.originalEvent) L.DomEvent.stop(e.originalEvent);
}

function handleMapDrawMouseMove(e) {
    if (!mapDrawState.enabled) return;
    if (mapDrawState.tool === 'eraser') {
        const pressed = !e.originalEvent
            || e.originalEvent.buttons === 1
            || (e.originalEvent.touches && e.originalEvent.touches.length > 0)
            || (e.originalEvent.pointerId != null && e.originalEvent.pointerId === mapDrawState.activeDrawPointerId);
        if (pressed) {
            if (eraseMapDrawingAt(e.latlng, true)) mapDrawState.lastEraseAt = Date.now();
            if (e.originalEvent) L.DomEvent.stop(e.originalEvent);
        }
        return;
    }
    if (mapDrawState.tool === 'line' && mapDrawState.lineStart) {
        ensureMapDrawLayer();
        if (!mapDrawState.previewLine) {
            mapDrawState.previewLine = L.polyline([mapDrawState.lineStart, e.latlng], getMapDrawStyle({ opacity: 0.65, dashArray: '8,8' })).addTo(mapDrawState.layer);
        } else {
            mapDrawState.previewLine.setLatLngs([mapDrawState.lineStart, e.latlng]);
        }
        return;
    }
    if (!mapDrawState.isDrawing || !mapDrawState.drawingLine) return;
    const nextPoint = map.latLngToLayerPoint(e.latlng);
    if (mapDrawState.lastLayerPoint && nextPoint.distanceTo(mapDrawState.lastLayerPoint) < 4) return;
    mapDrawState.drawingPoints.push(e.latlng);
    mapDrawState.lastLayerPoint = nextPoint;
    mapDrawState.drawingLine.setLatLngs(mapDrawState.drawingPoints);
    if (e.originalEvent) L.DomEvent.stop(e.originalEvent);
}

function finishMapDrawFreehand() {
    if (!mapDrawState.isDrawing) return;
    if (mapDrawState.drawingLine) {
        if (mapDrawState.drawingPoints.length > 1) {
            mapDrawState.drawings.push(mapDrawState.drawingLine);
        } else if (mapDrawState.layer) {
            mapDrawState.layer.removeLayer(mapDrawState.drawingLine);
        }
    }
    mapDrawState.drawingLine = null;
    mapDrawState.drawingPoints = [];
    mapDrawState.isDrawing = false;
    mapDrawState.lastLayerPoint = null;
    mapDrawState.activeDrawPointerId = null;
    if (map && map.dragging && !mapDrawState.enabled) map.dragging.enable();
}

function getMapDrawPointerLatLng(evt) {
    if (!map || !evt || typeof map.mouseEventToLatLng !== 'function') return null;
    return map.mouseEventToLatLng(evt);
}

function stopMapDrawPointerEvent(evt) {
    if (!evt) return;
    evt.preventDefault();
    evt.stopPropagation();
    if (typeof evt.stopImmediatePropagation === 'function') evt.stopImmediatePropagation();
    if (typeof L !== 'undefined' && L.DomEvent) L.DomEvent.stop(evt);
}

function captureMapDrawPointer(evt) {
    const container = map && map.getContainer && map.getContainer();
    if (!container || !evt || evt.pointerId == null || typeof container.setPointerCapture !== 'function') return;
    try { container.setPointerCapture(evt.pointerId); } catch (_) {}
}

function releaseMapDrawPointer(evt) {
    const container = map && map.getContainer && map.getContainer();
    if (!container || !evt || evt.pointerId == null || typeof container.releasePointerCapture !== 'function') return;
    try {
        if (!container.hasPointerCapture || container.hasPointerCapture(evt.pointerId)) {
            container.releasePointerCapture(evt.pointerId);
        }
    } catch (_) {}
}

function isLikelyMapDrawXrPointer(evt) {
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
    const pointerType = String((evt && evt.pointerType) || '').toLowerCase();
    return pointerType === 'xr' || MAP_DRAW_XR_POINTER_UA_RE.test(ua);
}

function shouldUseMapDrawPointerEvent(evt) {
    if (!evt) return false;
    if (evt.pointerType !== 'mouse') return true;
    return isLikelyMapDrawXrPointer(evt);
}

function handleMapDrawPointerDown(evt) {
    if (!mapDrawState.enabled || !shouldUseMapDrawPointerEvent(evt)) return;
    if (evt.isPrimary === false && !isLikelyMapDrawXrPointer(evt)) return;
    if (mapDrawState.activeDrawPointerId != null && mapDrawState.activeDrawPointerId !== evt.pointerId) return;
    if (isMapUiClickTarget(evt)) return;
    const latlng = getMapDrawPointerLatLng(evt);
    if (!latlng) return;
    mapDrawState.activeDrawPointerId = evt.pointerId;
    captureMapDrawPointer(evt);
    if (map && map.dragging) map.dragging.disable();
    stopMapDrawPointerEvent(evt);

    const drawEvt = { latlng, originalEvent: evt };
    if (mapDrawState.tool === 'line') {
        handleMapDrawMapClick(drawEvt);
        mapDrawState.suppressMapClickUntil = Date.now() + 500;
        return;
    }
    mapDrawState.suppressMapClickUntil = Date.now() + 500;
    handleMapDrawMouseDown(drawEvt);
}

function handleMapDrawPointerMove(evt) {
    if (!mapDrawState.enabled || !shouldUseMapDrawPointerEvent(evt)) return;
    if (mapDrawState.activeDrawPointerId !== evt.pointerId) return;
    const latlng = getMapDrawPointerLatLng(evt);
    if (!latlng) return;
    mapDrawState.suppressMapClickUntil = Date.now() + 500;
    stopMapDrawPointerEvent(evt);
    handleMapDrawMouseMove({ latlng, originalEvent: evt });
}

function handleMapDrawPointerUp(evt) {
    if (!shouldUseMapDrawPointerEvent(evt)) return;
    if (mapDrawState.activeDrawPointerId !== evt.pointerId) return;
    const latlng = evt.type === 'pointercancel' ? null : getMapDrawPointerLatLng(evt);
    mapDrawState.suppressMapClickUntil = Date.now() + 500;
    stopMapDrawPointerEvent(evt);
    if (mapDrawState.tool === 'freehand' && latlng) {
        handleMapDrawMouseMove({ latlng, originalEvent: evt });
    }
    releaseMapDrawPointer(evt);
    finishMapDrawFreehand();
    mapDrawState.activeDrawPointerId = null;
}

function handleMapDrawTouchStart(e) {
    if (!mapDrawState.enabled || mapDrawState.tool !== 'line') {
        handleMapDrawMouseDown(e);
        return;
    }
    if (isMapUiClickTarget(e.originalEvent)) return;
    if (!e || !e.latlng) return;
    const handled = handleMapDrawMapClick(e);
    if (handled) {
        mapDrawState.suppressMapClickUntil = Date.now() + 500;
        if (e.originalEvent) L.DomEvent.stop(e.originalEvent);
    }
}

function bindMapDrawEvents() {
    if (!map || map._mapDrawEventsBound) return;
    const container = map.getContainer && map.getContainer();
    if (container) {
        container.addEventListener('pointerdown', handleMapDrawPointerDown, { capture: true, passive: false });
        container.addEventListener('pointermove', handleMapDrawPointerMove, { capture: true, passive: false });
        container.addEventListener('pointerup', handleMapDrawPointerUp, { capture: true, passive: false });
        container.addEventListener('pointercancel', handleMapDrawPointerUp, { capture: true, passive: false });
    }
    map.on('mousedown', handleMapDrawMouseDown);
    map.on('touchstart', handleMapDrawTouchStart);
    map.on('mousemove', handleMapDrawMouseMove);
    map.on('touchmove', handleMapDrawMouseMove);
    map.on('mouseup', finishMapDrawFreehand);
    map.on('touchend', finishMapDrawFreehand);
    document.addEventListener('mouseup', finishMapDrawFreehand);
    document.addEventListener('touchend', finishMapDrawFreehand);
    map._mapDrawEventsBound = true;
}

function isMapDrawElementVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

function clampMapDrawValue(value, min, max) {
    if (max < min) return min;
    return Math.max(min, Math.min(max, value));
}

function getMapDrawSafeBounds(area, railWidth = 46, railHeight = 46) {
    const areaRect = area.getBoundingClientRect();
    const edgeMargin = 10;
    const blockerGap = 8;
    let left = edgeMargin;
    let right = areaRect.width - edgeMargin;
    let top = edgeMargin;
    let bottom = areaRect.height - edgeMargin;
    const blockers = [
        { id: 'mapToolbarInner', edge: 'top' },
        { id: 'mapToolbarToggleRow', edge: 'top' },
        { id: 'routeProgressBar', edge: 'top' },
        { id: 'profileResizeHandle', edge: 'bottom' },
        { id: 'mapProfileStrip', edge: 'bottom' },
        { id: 'simSpeedStrip', edge: 'bottom' }
    ];

    blockers.forEach(({ id, edge }) => {
        const el = document.getElementById(id);
        if (!isMapDrawElementVisible(el)) return;
        const rect = el.getBoundingClientRect();
        const horizontalOverlap = Math.min(rect.right, areaRect.right) - Math.max(rect.left, areaRect.left);
        if (horizontalOverlap <= 0) return;
        if (edge === 'top') {
            if (rect.bottom < areaRect.top - 2 || rect.top >= areaRect.bottom) return;
            const inset = Math.max(0, rect.bottom - areaRect.top) + blockerGap;
            if (inset < areaRect.height) top = Math.max(top, inset);
        } else {
            if (rect.top > areaRect.bottom + 2 || rect.bottom <= areaRect.top) return;
            const inset = Math.max(0, areaRect.bottom - rect.top) + blockerGap;
            if (inset < areaRect.height) bottom = Math.min(bottom, areaRect.height - inset);
        }
    });

    if (right - left < railWidth) {
        left = Math.max(0, (areaRect.width - railWidth) / 2);
        right = left + railWidth;
    }
    if (bottom - top < railHeight) {
        top = Math.max(0, (areaRect.height - railHeight) / 2);
        bottom = top + railHeight;
    }

    return { areaRect, left, right, top, bottom };
}

function getMapDrawToolStackHeight(stack) {
    const buttonCount = stack && stack.children ? stack.children.length : 0;
    return Math.max(46, stack ? (stack.scrollHeight || stack.offsetHeight || (buttonCount ? ((buttonCount * 40) + ((buttonCount - 1) * 6)) : (5 * 46))) : 46);
}

function getMapDrawToolStackDirection(rawTop, bounds, railHeight, stackHeight) {
    const stackGap = 8;
    const spaceAbove = rawTop - bounds.top - stackGap;
    const spaceBelow = bounds.bottom - (rawTop + railHeight) - stackGap;
    const upFits = spaceAbove >= stackHeight;
    const downFits = spaceBelow >= stackHeight;
    return !upFits && (downFits || spaceBelow > spaceAbove);
}

function getMapDrawClampedFloatingPosition(rawLeft, rawTop, railWidth, railHeight, bounds, stack) {
    const stackGap = 8;
    let minTop = bounds.top;
    let maxTop = bounds.bottom - railHeight;
    let flipDown = false;

    if (mapDrawState.panelOpen && stack) {
        const stackHeight = getMapDrawToolStackHeight(stack);
        flipDown = getMapDrawToolStackDirection(rawTop, bounds, railHeight, stackHeight);
        if (flipDown) {
            maxTop = bounds.bottom - railHeight - stackGap - stackHeight;
        } else {
            minTop = bounds.top + stackHeight + stackGap;
        }
        if (maxTop < minTop) {
            minTop = bounds.top;
            maxTop = bounds.bottom - railHeight;
        }
    }

    return {
        left: clampMapDrawValue(rawLeft, bounds.left, bounds.right - railWidth),
        top: clampMapDrawValue(rawTop, minTop, maxTop),
        flipDown
    };
}

function positionMapDrawToolStack() {
    const rail = document.getElementById('mapDrawRail');
    const button = document.getElementById('mapDrawFloatingBtn');
    const stack = document.getElementById('mapDrawToolStack');
    const area = document.getElementById('mapArea');
    if (!rail || !button || !stack || !area) return;
    if (!mapDrawState.panelOpen) {
        stack.classList.remove('flip-down');
        return;
    }
    const areaRect = area.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    const railHeight = rail.offsetHeight || 46;
    const stackHeight = getMapDrawToolStackHeight(stack);
    const bounds = getMapDrawSafeBounds(area, rail.offsetWidth || 46, railHeight);
    const rawTop = Number.isFinite(parseFloat(rail.style.top)) ? parseFloat(rail.style.top) : (railRect.top - areaRect.top);
    stack.classList.toggle('flip-down', getMapDrawToolStackDirection(rawTop, bounds, railHeight, stackHeight));
}

function positionMapDrawMenuNearButton() {
    const button = document.getElementById('mapDrawFloatingBtn');
    const settingsButton = document.getElementById('mapToolSettings');
    const anchor = settingsButton || button;
    const menu = document.getElementById('mapDrawMenu');
    const area = document.getElementById('mapArea');
    if (!anchor || !menu || !area) return;
    if (!mapDrawState.menuOpen) return;
    const btnRect = anchor.getBoundingClientRect();
    const bounds = getMapDrawSafeBounds(area);
    const areaRect = bounds.areaRect;
    const margin = 12;
    const wasHidden = menu.style.display === 'none';
    if (wasHidden) {
        menu.style.display = 'block';
        menu.style.visibility = 'hidden';
    }
    const gap = 6;
    const swatchesEl = menu.querySelector('.map-draw-swatches');
    const preferredWidth = Math.max(220, swatchesEl ? swatchesEl.offsetWidth : 220);
    const menuWidth = Math.min(preferredWidth, areaRect.width - (margin * 2));
    menu.style.width = `${menuWidth}px`;
    menu.style.maxHeight = '';
    const measuredHeight = Math.max(96, menu.offsetHeight || 160);
    if (wasHidden) {
        menu.style.display = 'none';
        menu.style.visibility = 'hidden';
    }
    const maxLeft = Math.max(bounds.left, bounds.right - menuWidth);
    const maxTop = Math.max(bounds.top, bounds.bottom - measuredHeight);
    const btnLeft = btnRect.left - areaRect.left;
    const btnRight = btnRect.right - areaRect.left;
    const btnTop = btnRect.top - areaRect.top;
    const rightSpace = areaRect.width - btnRight;
    const leftSpace = btnLeft;
    let preferredLeft = btnRight + gap;
    if (rightSpace < (menuWidth + gap + margin) && leftSpace >= (menuWidth + gap + margin)) {
        preferredLeft = btnLeft - menuWidth - gap;
    } else if (rightSpace < (menuWidth + gap + margin) && leftSpace < (menuWidth + gap + margin)) {
        preferredLeft = btnLeft + (anchor.offsetWidth / 2) - (menuWidth / 2);
    }
    const left = clampMapDrawValue(preferredLeft, bounds.left, maxLeft);
    const top = clampMapDrawValue(btnTop, bounds.top, maxTop);
    menu.style.left = `${left}px`;
    menu.style.right = 'auto';
    menu.style.top = `${top}px`;
}

function getMapDrawFloatingDefaultPosition(areaRect, railWidth, railHeight, bounds) {
    const margin = 18;
    if (bounds) {
        return {
            left: clampMapDrawValue(margin, bounds.left, bounds.right - railWidth),
            top: clampMapDrawValue(bounds.bottom - railHeight, bounds.top, bounds.bottom - railHeight)
        };
    }
    return {
        left: margin,
        top: Math.max(margin, areaRect.height - railHeight - margin)
    };
}

function isMapDrawFloatingAreaUsable(areaRect, railWidth, railHeight, bounds) {
    if (bounds) {
        return bounds.right - bounds.left >= railWidth && bounds.bottom - bounds.top >= railHeight;
    }
    return areaRect.width >= railWidth + 16 && areaRect.height >= railHeight + 16;
}

function applyMapDrawFloatingButtonPosition(rail, left, top) {
    rail.style.left = `${left}px`;
    rail.style.top = `${top}px`;
    rail.style.right = 'auto';
    rail.style.bottom = 'auto';
}

function clampMapDrawFloatingButtonPosition(rawPosition) {
    const rail = document.getElementById('mapDrawRail');
    const button = document.getElementById('mapDrawFloatingBtn');
    const stack = document.getElementById('mapDrawToolStack');
    const area = document.getElementById('mapArea');
    if (!rail || !button || !area) return;
    const areaRect = area.getBoundingClientRect();
    const railWidth = rail.offsetWidth || 46;
    const railHeight = rail.offsetHeight || 46;
    const bounds = getMapDrawSafeBounds(area, railWidth, railHeight);
    if (!isMapDrawFloatingAreaUsable(areaRect, railWidth, railHeight, bounds)) return;
    const fallback = getMapDrawFloatingDefaultPosition(areaRect, railWidth, railHeight, bounds);
    const styleLeft = parseFloat(rail.style.left);
    const styleTop = parseFloat(rail.style.top);
    const rawLeft = rawPosition && Number.isFinite(rawPosition.left) ? rawPosition.left : (Number.isFinite(styleLeft) ? styleLeft : fallback.left);
    const rawTop = rawPosition && Number.isFinite(rawPosition.top) ? rawPosition.top : (Number.isFinite(styleTop) ? styleTop : fallback.top);
    const clamped = getMapDrawClampedFloatingPosition(rawLeft, rawTop, railWidth, railHeight, bounds, stack);
    if (stack) stack.classList.toggle('flip-down', clamped.flipDown);
    applyMapDrawFloatingButtonPosition(rail, clamped.left, clamped.top);
    positionMapDrawToolStack();
    if (mapDrawState.menuOpen) positionMapDrawMenuNearButton();
    return clamped;
}

function resetMapDrawFloatingButtonPosition() {
    const rail = document.getElementById('mapDrawRail');
    const area = document.getElementById('mapArea');
    if (!rail || !area) return;
    const railWidth = rail.offsetWidth || 46;
    const railHeight = rail.offsetHeight || 46;
    const bounds = getMapDrawSafeBounds(area, railWidth, railHeight);
    if (!isMapDrawFloatingAreaUsable(bounds.areaRect, railWidth, railHeight, bounds)) return;
    const position = getMapDrawFloatingDefaultPosition(bounds.areaRect, railWidth, railHeight, bounds);
    clampMapDrawFloatingButtonPosition(position);
}

function initMapDrawFloatingButton() {
    const rail = document.getElementById('mapDrawRail');
    const button = document.getElementById('mapDrawFloatingBtn');
    const area = document.getElementById('mapArea');
    if (!rail || !button || !area || button.dataset.drawBound === '1') return;
    const dragThresholdPx = 8;
    const saved = (() => {
        try { return JSON.parse(localStorage.getItem('ga_map_draw_button_pos') || 'null'); } catch (e) { return null; }
    })();
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
        applyMapDrawFloatingButtonPosition(rail, saved.left, saved.top);
        requestAnimationFrame(() => {
            clampMapDrawFloatingButtonPosition();
            positionMapDrawToolStack();
        });
    } else {
        requestAnimationFrame(() => {
            const railWidth = rail.offsetWidth || 46;
            const railHeight = rail.offsetHeight || 46;
            const bounds = getMapDrawSafeBounds(area, railWidth, railHeight);
            if (!isMapDrawFloatingAreaUsable(bounds.areaRect, railWidth, railHeight, bounds)) return;
            const pos = getMapDrawFloatingDefaultPosition(bounds.areaRect, railWidth, railHeight, bounds);
            applyMapDrawFloatingButtonPosition(rail, pos.left, pos.top);
            clampMapDrawFloatingButtonPosition();
            positionMapDrawToolStack();
        });
    }

    button.addEventListener('pointerdown', (evt) => {
        if (evt.button !== 0) return;
        const rect = rail.getBoundingClientRect();
        mapDrawState.buttonDrag = {
            pointerId: evt.pointerId,
            startX: evt.clientX,
            startY: evt.clientY,
            offsetX: evt.clientX - rect.left,
            offsetY: evt.clientY - rect.top,
            moved: false
        };
        mapDrawState.suppressButtonClickUntil = 0;
        button.classList.add('is-dragging');
        button.setPointerCapture(evt.pointerId);
        evt.stopPropagation();
    });

    button.addEventListener('pointermove', (evt) => {
        const drag = mapDrawState.buttonDrag;
        if (!drag || drag.pointerId !== evt.pointerId) return;
        const movedPx = Math.hypot(evt.clientX - drag.startX, evt.clientY - drag.startY);
        if (movedPx < dragThresholdPx && !drag.moved) return;
        drag.moved = true;
        const areaRect = area.getBoundingClientRect();
        clampMapDrawFloatingButtonPosition({
            left: evt.clientX - areaRect.left - drag.offsetX,
            top: evt.clientY - areaRect.top - drag.offsetY
        });
        evt.stopPropagation();
        evt.preventDefault();
    });

    button.addEventListener('pointerup', (evt) => {
        const drag = mapDrawState.buttonDrag;
        if (!drag || drag.pointerId !== evt.pointerId) return;
        button.classList.remove('is-dragging');
        if (button.hasPointerCapture && button.hasPointerCapture(evt.pointerId)) button.releasePointerCapture(evt.pointerId);
        mapDrawState.buttonDrag = null;
        const left = parseFloat(rail.style.left);
        const top = parseFloat(rail.style.top);
        if (Number.isFinite(left) && Number.isFinite(top)) {
            localStorage.setItem('ga_map_draw_button_pos', JSON.stringify({ left, top }));
        }
        if (drag.moved) {
            mapDrawState.suppressButtonClickUntil = Date.now() + 350;
            mapDrawState.justDraggedUntil = Date.now() + 350;
        } else {
            mapDrawState.suppressButtonClickUntil = 0;
            mapDrawState.justDraggedUntil = 0;
        }
        evt.stopPropagation();
    });

    button.addEventListener('pointercancel', (evt) => {
        const drag = mapDrawState.buttonDrag;
        if (!drag || drag.pointerId !== evt.pointerId) return;
        button.classList.remove('is-dragging');
        if (button.hasPointerCapture && button.hasPointerCapture(evt.pointerId)) button.releasePointerCapture(evt.pointerId);
        mapDrawState.buttonDrag = null;
        mapDrawState.suppressButtonClickUntil = Date.now() + 350;
        mapDrawState.justDraggedUntil = Date.now() + 350;
    });

    window.addEventListener('resize', () => {
        clampMapDrawFloatingButtonPosition();
    });
    button.dataset.drawBound = '1';
    syncMapDrawUi();
}

window.toggleMapDrawMode = toggleMapDrawMode;
window.toggleMapToolRail = toggleMapToolRail;
window.activateMapDrawTool = activateMapDrawTool;
window.toggleMapDrawSettingsMenu = toggleMapDrawSettingsMenu;
window.openMapDrawMenu = openMapDrawMenu;
window.closeMapDrawMenu = closeMapDrawMenu;
window.openMapDrawMenuFromButton = function(evt) {
    if (evt) evt.stopPropagation();
    if (!mapDrawState.enabled) return;
    if (Date.now() >= mapDrawState.suppressButtonClickUntil) toggleMapDrawMenu();
};
window.toggleMapDrawMenu = function(force) {
    toggleMapDrawMenu(force);
    if (mapDrawState.menuOpen) {
        positionMapDrawMenuNearButton();
        requestAnimationFrame(positionMapDrawMenuNearButton);
    }
};
window.setMapDrawColor = setMapDrawColor;
window.setMapDrawWeight = setMapDrawWeight;
window.setMapDrawTool = setMapDrawTool;
window.clearMapDrawings = clearMapDrawings;

function toggleMeasureMode() {
    measureMode = !measureMode; const btn = document.getElementById('measureBtn');
    if (measureMode) {
        if (mapDrawState.enabled) toggleMapDrawMode(false);
        if (btn) {
            btn.innerText = '📏 Messen (An)';
            btn.style.background = 'var(--piper-yellow)';
            btn.style.color = '#000';
        }
        document.getElementById('map').style.cursor = 'crosshair';
    } else {
        if (btn) {
            btn.innerText = '📏 Messen (Aus)';
            btn.style.background = '#444';
            btn.style.color = '#fff';
        }
        document.getElementById('map').style.cursor = '';
    }
    if (map && typeof map.closePopup === 'function') map.closePopup();
    if (typeof renderMainRoute === 'function' && routeWaypoints && routeWaypoints.length > 0) renderMainRoute();
    if (typeof renderWeatherMarkers === 'function') renderWeatherMarkers();
    if (typeof liveGpsMarker !== 'undefined' && liveGpsMarker) {
        try {
            if (typeof liveGpsMarker.closePopup === 'function') liveGpsMarker.closePopup();
            const el = liveGpsMarker.getElement && liveGpsMarker.getElement();
            if (el) el.style.pointerEvents = measureMode ? 'none' : 'auto';
        } catch (e) { }
    }
    if (typeof syncMapDrawUi === 'function') syncMapDrawUi();
}

function addMeasurePoint(latlng) {
    if (measureMarkers.length >= 2) { clearMeasure(); }
    const marker = L.marker(latlng, { icon: measureIcon, draggable: true }).addTo(map);
    marker.on('drag', updateMeasureRoute); marker.on('dragend', updateMeasureRoute);
    measureMarkers.push(marker); updateMeasureRoute();
}

function updateMeasureRoute() {
    if (measurePolyline) map.removeLayer(measurePolyline);
    if (measureTooltip) { map.removeLayer(measureTooltip); measureTooltip = null; }
    measurePoints = measureMarkers.map(m => m.getLatLng());

    if (measurePoints.length === 2) {
        measurePolyline = L.polyline(measurePoints, { color: '#f2c12e', weight: 4, dashArray: '6,6', ...(window.gaMapDrawingHost?.pathOptions || {}) }).addTo(map);
        const nav = calcNav(measurePoints[0].lat, measurePoints[0].lng || measurePoints[0].lon, measurePoints[1].lat, measurePoints[1].lng || measurePoints[1].lon);
        const centerLat = (measurePoints[0].lat + measurePoints[1].lat) / 2, centerLng = (measurePoints[0].lng + measurePoints[1].lng) / 2;
        const labelText = `<div style="font-weight:bold; font-size:14px; color:#111; text-align:center; line-height: 1.2;">${nav.brng}°<br>${formatNm(nav.dist)} NM</div>`;
        measureTooltip = L.tooltip({ permanent: true, direction: 'center', className: 'measure-label' }).setLatLng([centerLat, centerLng]).setContent(labelText).addTo(map);
    }
}

function clearMeasure() {
    if (measurePolyline) map.removeLayer(measurePolyline);
    measurePolyline = null;
    if (measureTooltip) { map.removeLayer(measureTooltip); measureTooltip = null; }
    measureMarkers.forEach(m => map.removeLayer(m)); measurePoints = []; measureMarkers = [];
    if (typeof syncMapDrawUi === 'function') syncMapDrawUi();
}


function showMapToast(message, durationMs) {
    if (!durationMs) durationMs = 3000;
    const container = document.getElementById('mapArea') || document.body;
    const toast = document.createElement('div');
    toast.className = 'ff-toast';
    toast.textContent = message;
    toast.style.animationDuration = durationMs + 'ms';
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, durationMs + 100);
}
