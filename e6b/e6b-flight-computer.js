(function() {
    'use strict';

    const core = window.GAE6B;
    const WIND_VIEWBOX = { width: 510, height: 1000, cx: 255, cy: 500 };
    const WIND_SLIDER_CENTER_RANGE = { min: 190, max: 948 };
    const WIND_SLIDE_LIMITS = {
        min: WIND_VIEWBOX.cy - WIND_SLIDER_CENTER_RANGE.max,
        max: WIND_VIEWBOX.cy - WIND_SLIDER_CENTER_RANGE.min
    };
    const WIND_SLIDER_HIT = { minX: 52, maxX: 458, compassClearance: 252 };
    const CLICK_MOVE_THRESHOLD_PX = 4;
    const EMBEDDED_VIEW_SCALE = { min: 0.55, max: 3.4 };
    const PREVIEW_VIEW_SCALE = { min: 0.5, max: 3.2 };
    const WINDOW_PLAN_STORAGE_KEY = 'ga-e6b-window-plan-sectors';
    const WINDOW_PLAN_LABELS_STORAGE_KEY = 'ga-e6b-window-plan-labels-visible';
    const PREVIEW_STORAGE_KEY = 'ga-e6b-preview-toggles';
    const SCALE_PLAN_STORAGE_KEY = 'ga-e6b-window-plan-scales-v2';
    const WINDOW_PLAN_FIELDS = ['startAngle', 'endAngle', 'outerRadius', 'innerRadius'];
    const SCALE_PLAN_NUMERIC_FIELDS = ['startAngle', 'endAngle', 'radius', 'tickLength', 'labelRadius', 'min', 'max', 'minorStep', 'majorStep', 'fontSize'];
    const SCALE_PLAN_MAX_TICKS = 1200;
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const searchParams = (() => {
        try {
            return new URLSearchParams(window.location.search);
        } catch (_) {
            return new URLSearchParams();
        }
    })();
    const embeddedMode = searchParams.has('embedded');
    const windowPlanMode = searchParams.has('windowPlan') || searchParams.has('windowDebug');
    const calibrationMode = windowPlanMode && !embeddedMode;
    const viewTransformMode = embeddedMode || calibrationMode;
    const state = {
        side: 'front',
        activeRatio: 'speed',
        windTool: 'rotate',
        frontRotation: 0,
        windRotation: 0,
        windSlideY: 0,
        windDotX: 255,
        windDotY: 500,
        speedKt: 120,
        minutes: 10,
        fuelRateGph: 9.5,
        fuelMinutes: 45,
        pressureAltFt: 5000,
        oatC: 25,
        casKt: 100,
        courseDeg: 90,
        windTasKt: 100,
        windFromDeg: 360,
        windSpeedKt: 20
    };

    let drag = null;
    let activeWindowPlanSectorId = 'leftTemp';
    let activeScalePlanId = 'leftTempScale';
    let initialWindowPlanSectors = null;
    let initialScalePlanScales = null;
    const viewState = { scale: 1, x: 0, y: 0 };
    const viewPointers = new Map();
    let viewGesture = null;
    let embeddedViewStatePostPending = false;

    if (embeddedMode && document.body) {
        document.body.classList.add('e6b-embedded');
    }

    if (viewTransformMode && document.body) {
        document.body.classList.add('e6b-preview-transform');
    }

    if (calibrationMode && document.body) {
        document.body.classList.add('e6b-window-plan');
    }

    function qs(selector) {
        return document.querySelector(selector);
    }

    function qsa(selector) {
        return Array.from(document.querySelectorAll(selector));
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, Number(value) || 0));
    }

    function pointerSnapshot(event) {
        return { x: event.clientX, y: event.clientY };
    }

    function pointerDistance(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function pointerMidpoint(a, b) {
        return {
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2
        };
    }

    function getViewPointerPair() {
        const points = Array.from(viewPointers.values());
        return points.length >= 2 ? [points[0], points[1]] : null;
    }

    function clampViewPan(x, y, scale) {
        const stage = qs('.e6b-stage');
        const rect = stage ? stage.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
        const embeddedSlackX = embeddedMode ? rect.width * 0.42 : 0;
        const embeddedSlackY = embeddedMode ? rect.height * 0.42 : 0;
        const maxX = Math.max(0, (scale - 1) * rect.width / 2) + embeddedSlackX;
        const maxY = Math.max(0, (scale - 1) * rect.height / 2) + embeddedSlackY;
        return {
            x: clamp(x, -maxX, maxX),
            y: clamp(y, -maxY, maxY)
        };
    }

    function applyViewTransform() {
        const computer = qs('#e6bComputer');
        if (!computer) return;
        computer.style.setProperty('--e6b-view-scale', String(viewState.scale));
        computer.style.setProperty('--e6b-view-x', `${viewState.x}px`);
        computer.style.setProperty('--e6b-view-y', `${viewState.y}px`);
        document.body.classList.toggle('e6b-view-zoomed', viewState.scale > 1.01);
        syncPreviewZoomControls();
        scheduleEmbeddedViewStatePost();
    }

    function setViewTransform(scale, x, y) {
        const limits = embeddedMode ? EMBEDDED_VIEW_SCALE : PREVIEW_VIEW_SCALE;
        const nextScale = clamp(scale, limits.min, limits.max);
        const pan = clampViewPan(x, y, nextScale);
        viewState.scale = nextScale;
        viewState.x = pan.x;
        viewState.y = pan.y;
        applyViewTransform();
    }

    function startViewGesture() {
        const pair = getViewPointerPair();
        if (!pair) return;
        const mid = pointerMidpoint(pair[0], pair[1]);
        viewGesture = {
            startDistance: Math.max(1, pointerDistance(pair[0], pair[1])),
            startMidX: mid.x,
            startMidY: mid.y,
            startScale: viewState.scale,
            startX: viewState.x,
            startY: viewState.y
        };
        drag = null;
        document.body.classList.add('e6b-view-gesturing');
    }

    function updateViewGesture() {
        const pair = getViewPointerPair();
        if (!pair) return false;
        if (!viewGesture) startViewGesture();
        if (!viewGesture) return false;
        const mid = pointerMidpoint(pair[0], pair[1]);
        const distance = Math.max(1, pointerDistance(pair[0], pair[1]));
        const nextScale = viewGesture.startScale * (distance / viewGesture.startDistance);
        const nextX = viewGesture.startX + (mid.x - viewGesture.startMidX);
        const nextY = viewGesture.startY + (mid.y - viewGesture.startMidY);
        setViewTransform(nextScale, nextX, nextY);
        return true;
    }

    function endViewGestureIfNeeded() {
        if (viewPointers.size >= 2) {
            startViewGesture();
            return;
        }
        viewGesture = null;
        document.body.classList.remove('e6b-view-gesturing');
    }

    function releasePointerCapture(stack, pointerId) {
        if (!stack || typeof stack.releasePointerCapture !== 'function') return;
        try {
            stack.releasePointerCapture(pointerId);
        } catch (error) {
            // Pointer capture may already be gone after touch gestures.
        }
    }

    function getActiveViewStack() {
        return state.side === 'wind' ? qs('#e6bWindStack') : qs('#e6bFrontStack');
    }

    function postEmbeddedViewState() {
        if (!embeddedMode || !window.parent || window.parent === window) return;
        const stack = getActiveViewStack();
        const stage = qs('.e6b-stage');
        if (!stack) return;
        const stackRect = stack.getBoundingClientRect();
        const stageRect = stage ? stage.getBoundingClientRect() : { left: 0, top: 0 };
        try {
            window.parent.postMessage({
                type: 'ga-e6b-view-state',
                side: state.side,
                scale: viewState.scale,
                x: viewState.x,
                y: viewState.y,
                stack: {
                    left: stackRect.left - stageRect.left,
                    top: stackRect.top - stageRect.top,
                    right: stackRect.right - stageRect.left,
                    bottom: stackRect.bottom - stageRect.top,
                    width: stackRect.width,
                    height: stackRect.height
                }
            }, '*');
        } catch (_) {}
    }

    function scheduleEmbeddedViewStatePost() {
        if (!embeddedMode || embeddedViewStatePostPending) return;
        embeddedViewStatePostPending = true;
        requestAnimationFrame(() => {
            embeddedViewStatePostPending = false;
            postEmbeddedViewState();
        });
    }

    function stripCalibrationDomForEmbedded() {
        if (!embeddedMode) return;
        qsa('.e6b-front-window-plan-overlay, .preview-controls, .window-plan-controls, .scale-plan-controls').forEach(element => {
            element.remove();
        });
    }

    function numberFromInput(id, fallback) {
        const input = qs(`#${id}`);
        const value = Number(input ? input.value : NaN);
        return Number.isFinite(value) ? value : fallback;
    }

    function setInput(id, value, digits = 0) {
        const input = qs(`#${id}`);
        if (!input) return;
        input.value = digits > 0 ? String(core.round(value, digits)) : String(Math.round(value));
    }

    function svgPolarPoint(cx, cy, radius, degrees) {
        const radians = degrees * Math.PI / 180;
        return {
            x: cx + radius * Math.cos(radians),
            y: cy + radius * Math.sin(radians)
        };
    }

    function svgNumber(value) {
        return String(Math.round(value * 10) / 10).replace(/\.0$/, '');
    }

    function createSvgElement(tagName, attributes = {}) {
        const element = document.createElementNS(SVG_NS, tagName);
        Object.entries(attributes).forEach(([key, value]) => {
            element.setAttribute(key, String(value));
        });
        return element;
    }

    function arcPath(cx, cy, radius, startAngle, endAngle) {
        const start = svgPolarPoint(cx, cy, radius, startAngle);
        const end = svgPolarPoint(cx, cy, radius, endAngle);
        const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
        const sweep = endAngle >= startAngle ? 1 : 0;
        return [
            `M${svgNumber(start.x)} ${svgNumber(start.y)}`,
            `A${svgNumber(radius)} ${svgNumber(radius)} 0 ${largeArc} ${sweep} ${svgNumber(end.x)} ${svgNumber(end.y)}`
        ].join(' ');
    }

    function sectorPath({ cx, cy, outerRadius, innerRadius, startAngle, endAngle }) {
        const outerStart = svgPolarPoint(cx, cy, outerRadius, startAngle);
        const outerEnd = svgPolarPoint(cx, cy, outerRadius, endAngle);
        const innerEnd = svgPolarPoint(cx, cy, innerRadius, endAngle);
        const innerStart = svgPolarPoint(cx, cy, innerRadius, startAngle);
        const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
        const sweep = endAngle >= startAngle ? 1 : 0;
        const reverseSweep = sweep ? 0 : 1;
        return [
            `M${svgNumber(outerStart.x)} ${svgNumber(outerStart.y)}`,
            `A${svgNumber(outerRadius)} ${svgNumber(outerRadius)} 0 ${largeArc} ${sweep} ${svgNumber(outerEnd.x)} ${svgNumber(outerEnd.y)}`,
            `L${svgNumber(innerEnd.x)} ${svgNumber(innerEnd.y)}`,
            `A${svgNumber(innerRadius)} ${svgNumber(innerRadius)} 0 ${largeArc} ${reverseSweep} ${svgNumber(innerStart.x)} ${svgNumber(innerStart.y)}`,
            'Z'
        ].join(' ');
    }

    function sectorGeometryFromDataset(data) {
        return {
            cx: Number(data.cx),
            cy: Number(data.cy),
            outerRadius: Number(data.outerRadius),
            innerRadius: Number(data.innerRadius),
            startAngle: Number(data.startAngle),
            endAngle: Number(data.endAngle)
        };
    }

    function planSectorElements() {
        return qsa('[data-e6b-sector]');
    }

    function activePlanSector() {
        return planSectorElements().find(path => path.dataset.sectorId === activeWindowPlanSectorId) || planSectorElements()[0] || null;
    }

    function planSectorExportData() {
        const sectors = {};
        planSectorElements().forEach(path => {
            const data = path.dataset;
            sectors[data.sectorId] = {
                label: data.sectorLabel || data.sectorId,
                cx: Number(data.cx),
                cy: Number(data.cy),
                outerRadius: Number(data.outerRadius),
                innerRadius: Number(data.innerRadius),
                startAngle: Number(data.startAngle),
                endAngle: Number(data.endAngle)
            };
        });
        return sectors;
    }

    function captureWindowPlanDefaults() {
        initialWindowPlanSectors = planSectorExportData();
    }

    function syncPlanExport() {
        const output = qs('#e6bPlanExport');
        if (!output) return;
        output.value = JSON.stringify(planSectorExportData(), null, 2);
    }

    function saveWindowPlanSectors() {
        try {
            window.localStorage.setItem(WINDOW_PLAN_STORAGE_KEY, JSON.stringify(planSectorExportData()));
        } catch (_) {}
    }

    function loadWindowPlanSectors() {
        let saved = null;
        try {
            saved = JSON.parse(window.localStorage.getItem(WINDOW_PLAN_STORAGE_KEY) || 'null');
        } catch (_) {
            saved = null;
        }
        if (!saved || typeof saved !== 'object') return;
        planSectorElements().forEach(path => {
            const stored = saved[path.dataset.sectorId];
            if (!stored || typeof stored !== 'object') return;
            WINDOW_PLAN_FIELDS.forEach(field => {
                if (Number.isFinite(Number(stored[field]))) {
                    path.dataset[field] = String(Number(stored[field]));
                }
            });
        });
    }

    function setPlanInputPair(field, value) {
        const normalized = String(Number(value));
        const range = qs(`#e6bPlan${field[0].toUpperCase()}${field.slice(1)}Range`);
        const input = qs(`#e6bPlan${field[0].toUpperCase()}${field.slice(1)}`);
        if (range) range.value = normalized;
        if (input) input.value = normalized;
    }

    function syncWindowPlanControls() {
        const sector = activePlanSector();
        const select = qs('#e6bPlanSectorSelect');
        if (!sector || !select) return;
        select.value = sector.dataset.sectorId;
        WINDOW_PLAN_FIELDS.forEach(field => {
            setPlanInputPair(field, sector.dataset[field]);
        });
        planSectorElements().forEach(path => {
            path.classList.toggle('active', path === sector);
        });
        syncPlanExport();
    }

    function renderWindowPlanSectors() {
        qsa('[data-e6b-sector]').forEach(path => {
            const geometry = sectorGeometryFromDataset(path.dataset);
            if (Object.values(geometry).some(value => !Number.isFinite(value))) return;
            path.setAttribute('d', sectorPath(geometry));
        });
        syncPlanExport();
    }

    function applyWindowPlanField(field, rawValue) {
        const sector = activePlanSector();
        if (!sector) return;
        const value = Number(rawValue);
        if (!Number.isFinite(value)) return;
        sector.dataset[field] = String(value);
        renderWindowPlanSectors();
        syncWindowPlanControls();
        saveWindowPlanSectors();
    }

    function resetWindowPlanSectors() {
        const initial = initialWindowPlanSectors || {};
        planSectorElements().forEach(path => {
            const stored = initial[path.dataset.sectorId];
            if (!stored) return;
            WINDOW_PLAN_FIELDS.forEach(field => {
                if (Number.isFinite(Number(stored[field]))) {
                    path.dataset[field] = String(Number(stored[field]));
                }
            });
        });
        try {
            window.localStorage.removeItem(WINDOW_PLAN_STORAGE_KEY);
        } catch (_) {}
        renderWindowPlanSectors();
        syncWindowPlanControls();
    }

    function setWindowPlanLabelsVisible(visible, save = true) {
        const isVisible = !!visible;
        document.body.classList.toggle('e6b-hide-window-plan-labels', !isVisible);
        const checkbox = qs('#e6bPlanLabelsVisible');
        if (checkbox) checkbox.checked = isVisible;
        if (!save) return;
        try {
            window.localStorage.setItem(WINDOW_PLAN_LABELS_STORAGE_KEY, isVisible ? '1' : '0');
        } catch (_) {}
    }

    function loadWindowPlanLabelsVisible() {
        let visible = true;
        try {
            const stored = window.localStorage.getItem(WINDOW_PLAN_LABELS_STORAGE_KEY);
            if (stored === '0') visible = false;
        } catch (_) {}
        setWindowPlanLabelsVisible(visible, false);
    }

    function normalizePreviewZoomPercent(value, fallback = 100) {
        const numeric = Number(value);
        const base = Number.isFinite(numeric) ? numeric : fallback;
        return Math.round(clamp(base, PREVIEW_VIEW_SCALE.min * 100, PREVIEW_VIEW_SCALE.max * 100));
    }

    function syncPreviewZoomControls() {
        if (!calibrationMode) return;
        const percent = Math.round(viewState.scale * 100);
        const range = qs('#e6bPreviewZoomRange');
        const input = qs('#e6bPreviewZoom');
        if (range) range.value = String(percent);
        if (input && document.activeElement !== input) input.value = String(percent);
    }

    function previewSettingsFromControls() {
        const zoomInput = qs('#e6bPreviewZoom') || qs('#e6bPreviewZoomRange');
        const zoomFallback = Math.round(viewState.scale * 100);
        return {
            originalVisible: !!(qs('#e6bPreviewOriginalVisible') || {}).checked,
            referenceFaded: !!(qs('#e6bPreviewReferenceFaded') || {}).checked,
            newVisible: !!(qs('#e6bPreviewNewVisible') || {}).checked,
            helpersVisible: !!(qs('#e6bPreviewHelpersVisible') || {}).checked,
            zoomPercent: normalizePreviewZoomPercent(zoomInput ? zoomInput.value : zoomFallback, zoomFallback)
        };
    }

    function setPreviewSettings(settings, save = true) {
        const zoomFallback = Math.round(viewState.scale * 100);
        const next = {
            originalVisible: settings.originalVisible !== false,
            referenceFaded: !!settings.referenceFaded,
            newVisible: settings.newVisible !== false,
            helpersVisible: settings.helpersVisible !== false,
            zoomPercent: normalizePreviewZoomPercent(settings.zoomPercent, zoomFallback)
        };
        document.body.classList.toggle('e6b-preview-hide-reference', !next.originalVisible);
        document.body.classList.toggle('e6b-preview-reference-faded', next.referenceFaded && next.originalVisible);
        document.body.classList.toggle('e6b-preview-hide-new', !next.newVisible);
        document.body.classList.toggle('e6b-preview-hide-helpers', !next.helpersVisible);
        const original = qs('#e6bPreviewOriginalVisible');
        const faded = qs('#e6bPreviewReferenceFaded');
        const newer = qs('#e6bPreviewNewVisible');
        const helpers = qs('#e6bPreviewHelpersVisible');
        if (original) original.checked = next.originalVisible;
        if (faded) faded.checked = next.referenceFaded;
        if (newer) newer.checked = next.newVisible;
        if (helpers) helpers.checked = next.helpersVisible;
        if (calibrationMode) setViewTransform(next.zoomPercent / 100, viewState.x, viewState.y);
        if (!save) return;
        try {
            window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(next));
        } catch (_) {}
    }

    function loadPreviewSettings() {
        let settings = { originalVisible: true, referenceFaded: false, newVisible: true, helpersVisible: true, zoomPercent: 100 };
        try {
            const stored = JSON.parse(window.localStorage.getItem(PREVIEW_STORAGE_KEY) || 'null');
            if (stored && typeof stored === 'object') settings = { ...settings, ...stored };
        } catch (_) {}
        setPreviewSettings(settings, false);
    }

    function bindPreviewControls() {
        if (!calibrationMode) return;
        ['OriginalVisible', 'ReferenceFaded', 'NewVisible', 'HelpersVisible'].forEach(name => {
            const control = qs(`#e6bPreview${name}`);
            if (!control) return;
            control.addEventListener('change', () => {
                setPreviewSettings(previewSettingsFromControls());
            });
        });
        [qs('#e6bPreviewZoomRange'), qs('#e6bPreviewZoom')].forEach(control => {
            if (!control) return;
            control.addEventListener('input', () => {
                const percent = normalizePreviewZoomPercent(control.value, Math.round(viewState.scale * 100));
                setViewTransform(percent / 100, viewState.x, viewState.y);
                setPreviewSettings(previewSettingsFromControls());
            });
        });
        const reset = qs('#e6bPreviewViewReset');
        if (reset) {
            reset.addEventListener('click', () => {
                setViewTransform(1, 0, 0);
                setPreviewSettings(previewSettingsFromControls());
            });
        }
        loadPreviewSettings();
    }

    function bindWindowPlanControls() {
        if (!calibrationMode) return;
        const select = qs('#e6bPlanSectorSelect');
        if (!select) return;
        if (!initialWindowPlanSectors) captureWindowPlanDefaults();
        select.innerHTML = '';
        planSectorElements().forEach(path => {
            const option = document.createElement('option');
            option.value = path.dataset.sectorId;
            option.textContent = path.dataset.sectorLabel || path.dataset.sectorId;
            select.appendChild(option);
            path.addEventListener('click', () => {
                activeWindowPlanSectorId = path.dataset.sectorId;
                syncWindowPlanControls();
            });
        });
        select.addEventListener('change', () => {
            activeWindowPlanSectorId = select.value;
            syncWindowPlanControls();
        });
        WINDOW_PLAN_FIELDS.forEach(field => {
            const baseId = `#e6bPlan${field[0].toUpperCase()}${field.slice(1)}`;
            const range = qs(`${baseId}Range`);
            const input = qs(baseId);
            [range, input].forEach(control => {
                if (!control) return;
                control.addEventListener('input', () => {
                    applyWindowPlanField(field, control.value);
                });
            });
        });
        const copyButton = qs('#e6bPlanCopy');
        const output = qs('#e6bPlanExport');
        if (copyButton && output) {
            copyButton.addEventListener('click', () => {
                output.select();
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(output.value).catch(() => {});
                } else {
                    document.execCommand('copy');
                }
            });
        }
        const resetButton = qs('#e6bPlanReset');
        if (resetButton) resetButton.addEventListener('click', resetWindowPlanSectors);
        const labelsToggle = qs('#e6bPlanLabelsVisible');
        if (labelsToggle) {
            labelsToggle.addEventListener('change', () => {
                setWindowPlanLabelsVisible(labelsToggle.checked);
            });
        }
        loadWindowPlanSectors();
        loadWindowPlanLabelsVisible();
        renderWindowPlanSectors();
        syncWindowPlanControls();
    }

    function scaleElements() {
        return qsa('[data-e6b-scale]');
    }

    function activeScaleElement() {
        return scaleElements().find(group => group.dataset.scaleId === activeScalePlanId) || scaleElements()[0] || null;
    }

    function normalizeScaleLayer(value) {
        return value === 'background' ? 'background' : 'rotor';
    }

    function normalizeScaleMapping(value) {
        if (value === 'log10' || value === 'e6bLog60') return value;
        return 'linear';
    }

    function scaleLayerRoot(layer) {
        return qs(`[data-scale-layer-root="${normalizeScaleLayer(layer)}"]`);
    }

    function placeScaleElement(group) {
        const root = scaleLayerRoot(group.dataset.scaleLayer);
        if (root && group.parentNode !== root) {
            root.appendChild(group);
        }
    }

    function scaleGeometryFromDataset(data) {
        return {
            layer: normalizeScaleLayer(data.scaleLayer),
            mapping: normalizeScaleMapping(data.scaleMapping),
            cx: Number(data.cx),
            cy: Number(data.cy),
            radius: Number(data.radius),
            startAngle: Number(data.startAngle),
            endAngle: Number(data.endAngle),
            min: Number(data.min),
            max: Number(data.max),
            minorStep: Number(data.minorStep),
            majorStep: Number(data.majorStep),
            tickLength: Number(data.tickLength),
            labelRadius: Number(data.labelRadius),
            fontSize: Number(data.fontSize || 6)
        };
    }

    function scalePlanExportData() {
        const scales = {};
        scaleElements().forEach(group => {
            const data = group.dataset;
            scales[data.scaleId] = {
                label: data.scaleLabel || data.scaleId,
                layer: normalizeScaleLayer(data.scaleLayer),
                mapping: normalizeScaleMapping(data.scaleMapping),
                cx: Number(data.cx),
                cy: Number(data.cy),
                radius: Number(data.radius),
                startAngle: Number(data.startAngle),
                endAngle: Number(data.endAngle),
                min: Number(data.min),
                max: Number(data.max),
                minorStep: Number(data.minorStep),
                majorStep: Number(data.majorStep),
                tickLength: Number(data.tickLength),
                labelRadius: Number(data.labelRadius),
                fontSize: Number(data.fontSize || 6)
            };
        });
        return scales;
    }

    function captureScalePlanDefaults() {
        initialScalePlanScales = scalePlanExportData();
    }

    function syncScalePlanExport() {
        const output = qs('#e6bScalePlanExport');
        if (!output) return;
        output.value = JSON.stringify(scalePlanExportData(), null, 2);
    }

    function saveScalePlanScales() {
        try {
            window.localStorage.setItem(SCALE_PLAN_STORAGE_KEY, JSON.stringify(scalePlanExportData()));
        } catch (_) {}
    }

    function loadScalePlanScales() {
        let saved = null;
        try {
            saved = JSON.parse(window.localStorage.getItem(SCALE_PLAN_STORAGE_KEY) || 'null');
        } catch (_) {
            saved = null;
        }
        if (!saved || typeof saved !== 'object') return;
        scaleElements().forEach(group => {
            const stored = saved[group.dataset.scaleId];
            if (!stored || typeof stored !== 'object') return;
            const storedLayer = stored.layer || stored.scaleLayer;
            if (storedLayer) {
                group.dataset.scaleLayer = normalizeScaleLayer(storedLayer);
            }
            const storedMapping = stored.mapping || stored.scaleMapping;
            if (storedMapping) {
                group.dataset.scaleMapping = normalizeScaleMapping(storedMapping);
            }
            SCALE_PLAN_NUMERIC_FIELDS.forEach(field => {
                if (Number.isFinite(Number(stored[field]))) {
                    group.dataset[field] = String(Number(stored[field]));
                }
            });
        });
    }

    function scaleValueDomain(geometry, values) {
        if (geometry.mapping !== 'log10') return geometry;
        const positiveValues = values.filter(value => Number.isFinite(value) && value > 0);
        if (!positiveValues.length) return null;
        const low = positiveValues[0];
        const high = positiveValues[positiveValues.length - 1];
        if (geometry.min <= geometry.max) {
            return {
                min: geometry.min > 0 ? geometry.min : low,
                max: geometry.max > 0 ? geometry.max : high
            };
        }
        return {
            min: geometry.min > 0 ? geometry.min : high,
            max: geometry.max > 0 ? geometry.max : low
        };
    }

    function scaleValueRatio(value, geometry, domain = geometry) {
        if (geometry.mapping === 'log10') {
            if (!domain || domain.min <= 0 || domain.max <= 0 || value <= 0) return NaN;
            const minLog = Math.log10(domain.min);
            const maxLog = Math.log10(domain.max);
            const span = maxLog - minLog;
            if (!Number.isFinite(span) || span === 0) return NaN;
            return (Math.log10(value) - minLog) / span;
        }
        const span = geometry.max - geometry.min;
        if (!Number.isFinite(span) || span === 0) return NaN;
        return (value - geometry.min) / span;
    }

    function normalizeAngleNear(angle, anchorAngle) {
        let next = angle;
        while (next - anchorAngle > 180) next -= 360;
        while (next - anchorAngle <= -180) next += 360;
        return next;
    }

    function e6bLog60Angle(value, geometry) {
        if (value <= 0) return NaN;
        const rawAngle = geometry.startAngle + 360 * Math.log10(value / 60);
        return normalizeAngleNear(rawAngle, geometry.startAngle);
    }

    function valueToAngle(value, geometry, domain = geometry) {
        if (geometry.mapping === 'e6bLog60') {
            return e6bLog60Angle(value, geometry);
        }
        const ratio = scaleValueRatio(value, geometry, domain);
        if (!Number.isFinite(ratio)) return NaN;
        return geometry.startAngle + (geometry.endAngle - geometry.startAngle) * ratio;
    }

    function isMajorScaleValue(value, geometry) {
        if (!geometry.majorStep) return false;
        const offset = (value - geometry.min) / geometry.majorStep;
        return Math.abs(offset - Math.round(offset)) < 0.001;
    }

    function formatScaleValue(value) {
        return Math.abs(value - Math.round(value)) < 0.001
            ? String(Math.round(value))
            : String(Math.round(value * 10) / 10);
    }

    function renderScale(group) {
        placeScaleElement(group);
        const geometry = scaleGeometryFromDataset(group.dataset);
        const numericGeometry = { ...geometry };
        delete numericGeometry.layer;
        delete numericGeometry.mapping;
        if (Object.values(numericGeometry).some(value => !Number.isFinite(value))) return;
        if (!geometry.minorStep || !geometry.majorStep) return;
        group.replaceChildren();
        group.appendChild(createSvgElement('path', {
            class: 'scale-arc',
            d: arcPath(geometry.cx, geometry.cy, geometry.radius, geometry.startAngle, geometry.endAngle)
        }));
        const min = Math.min(geometry.min, geometry.max);
        const max = Math.max(geometry.min, geometry.max);
        const tickCount = Math.min(SCALE_PLAN_MAX_TICKS, Math.floor((max - min) / Math.abs(geometry.minorStep)));
        const values = Array.from({ length: tickCount + 1 }, (_, index) => min + index * Math.abs(geometry.minorStep));
        const domain = scaleValueDomain(geometry, values);
        if (!domain) return;
        values.forEach((value, index) => {
            const angle = valueToAngle(value, geometry, domain);
            if (!Number.isFinite(angle)) return;
            const major = isMajorScaleValue(value, geometry) || index === 0 || index === tickCount;
            const tickLength = major ? geometry.tickLength * 1.45 : geometry.tickLength;
            const start = svgPolarPoint(geometry.cx, geometry.cy, geometry.radius, angle);
            const end = svgPolarPoint(geometry.cx, geometry.cy, geometry.radius + tickLength, angle);
            group.appendChild(createSvgElement('line', {
                class: `scale-tick${major ? ' major' : ''}`,
                x1: svgNumber(start.x),
                y1: svgNumber(start.y),
                x2: svgNumber(end.x),
                y2: svgNumber(end.y)
            }));
            if (major) {
                const label = svgPolarPoint(geometry.cx, geometry.cy, geometry.labelRadius, angle);
                const text = createSvgElement('text', {
                    class: 'scale-label',
                    x: svgNumber(label.x),
                    y: svgNumber(label.y),
                    transform: `rotate(${svgNumber(angle + 90)} ${svgNumber(label.x)} ${svgNumber(label.y)})`
                });
                text.style.fontSize = `${geometry.fontSize}px`;
                text.textContent = formatScaleValue(value);
                group.appendChild(text);
            }
        });
    }

    function renderScalePlanScales() {
        scaleElements().forEach(renderScale);
        syncScalePlanExport();
    }

    function setScaleInputPair(field, value) {
        const normalized = String(Number(value));
        const range = qs(`#e6bScalePlan${field[0].toUpperCase()}${field.slice(1)}Range`);
        const input = qs(`#e6bScalePlan${field[0].toUpperCase()}${field.slice(1)}`);
        if (range) range.value = normalized;
        if (input) input.value = normalized;
    }

    function syncScalePlanControls() {
        const scale = activeScaleElement();
        const select = qs('#e6bScalePlanSelect');
        if (!scale || !select) return;
        select.value = scale.dataset.scaleId;
        const layerSelect = qs('#e6bScalePlanLayer');
        if (layerSelect) layerSelect.value = normalizeScaleLayer(scale.dataset.scaleLayer);
        const mappingSelect = qs('#e6bScalePlanMapping');
        if (mappingSelect) mappingSelect.value = normalizeScaleMapping(scale.dataset.scaleMapping);
        SCALE_PLAN_NUMERIC_FIELDS.forEach(field => {
            setScaleInputPair(field, scale.dataset[field]);
        });
        scaleElements().forEach(group => {
            group.classList.toggle('active', group === scale);
        });
        syncScalePlanExport();
    }

    function applyScalePlanField(field, rawValue) {
        const scale = activeScaleElement();
        if (!scale) return;
        const value = Number(rawValue);
        if (!Number.isFinite(value)) return;
        scale.dataset[field] = String(value);
        renderScalePlanScales();
        syncScalePlanControls();
        saveScalePlanScales();
    }

    function resetScalePlanScales() {
        const initial = initialScalePlanScales || {};
        scaleElements().forEach(group => {
            const stored = initial[group.dataset.scaleId];
            if (!stored) return;
            group.dataset.scaleLayer = normalizeScaleLayer(stored.layer || stored.scaleLayer);
            group.dataset.scaleMapping = normalizeScaleMapping(stored.mapping || stored.scaleMapping);
            SCALE_PLAN_NUMERIC_FIELDS.forEach(field => {
                if (Number.isFinite(Number(stored[field]))) {
                    group.dataset[field] = String(Number(stored[field]));
                }
            });
        });
        try {
            window.localStorage.removeItem(SCALE_PLAN_STORAGE_KEY);
        } catch (_) {}
        renderScalePlanScales();
        syncScalePlanControls();
    }

    function bindScalePlanControls() {
        if (!calibrationMode) return;
        const select = qs('#e6bScalePlanSelect');
        if (!select) return;
        if (!initialScalePlanScales) captureScalePlanDefaults();
        select.innerHTML = '';
        scaleElements().forEach(group => {
            const option = document.createElement('option');
            option.value = group.dataset.scaleId;
            option.textContent = group.dataset.scaleLabel || group.dataset.scaleId;
            select.appendChild(option);
            group.addEventListener('click', () => {
                activeScalePlanId = group.dataset.scaleId;
                syncScalePlanControls();
            });
        });
        select.addEventListener('change', () => {
            activeScalePlanId = select.value;
            syncScalePlanControls();
        });
        const layerSelect = qs('#e6bScalePlanLayer');
        if (layerSelect) {
            layerSelect.addEventListener('change', () => {
                const scale = activeScaleElement();
                if (!scale) return;
                scale.dataset.scaleLayer = normalizeScaleLayer(layerSelect.value);
                renderScalePlanScales();
                syncScalePlanControls();
                saveScalePlanScales();
            });
        }
        const mappingSelect = qs('#e6bScalePlanMapping');
        if (mappingSelect) {
            mappingSelect.addEventListener('change', () => {
                const scale = activeScaleElement();
                if (!scale) return;
                scale.dataset.scaleMapping = normalizeScaleMapping(mappingSelect.value);
                renderScalePlanScales();
                syncScalePlanControls();
                saveScalePlanScales();
            });
        }
        SCALE_PLAN_NUMERIC_FIELDS.forEach(field => {
            const baseId = `#e6bScalePlan${field[0].toUpperCase()}${field.slice(1)}`;
            const range = qs(`${baseId}Range`);
            const input = qs(baseId);
            [range, input].forEach(control => {
                if (!control) return;
                control.addEventListener('input', () => {
                    applyScalePlanField(field, control.value);
                });
            });
        });
        const copyButton = qs('#e6bScalePlanCopy');
        const output = qs('#e6bScalePlanExport');
        if (copyButton && output) {
            copyButton.addEventListener('click', () => {
                output.select();
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(output.value).catch(() => {});
                } else {
                    document.execCommand('copy');
                }
            });
        }
        const resetButton = qs('#e6bScalePlanReset');
        if (resetButton) resetButton.addEventListener('click', resetScalePlanScales);
        loadScalePlanScales();
        renderScalePlanScales();
        syncScalePlanControls();
    }

    function readInputs() {
        state.speedKt = Math.max(1, numberFromInput('e6bSpeed', state.speedKt));
        state.minutes = Math.max(0.1, numberFromInput('e6bMinutes', state.minutes));
        state.fuelRateGph = Math.max(0.1, numberFromInput('e6bFuelRate', state.fuelRateGph));
        state.fuelMinutes = Math.max(0.1, numberFromInput('e6bFuelMinutes', state.fuelMinutes));
        state.pressureAltFt = numberFromInput('e6bPressureAlt', state.pressureAltFt);
        state.oatC = numberFromInput('e6bOat', state.oatC);
        state.casKt = Math.max(0, numberFromInput('e6bCas', state.casKt));
        state.courseDeg = core.normalize360(numberFromInput('e6bCourse', state.courseDeg));
        state.windTasKt = Math.max(1, numberFromInput('e6bWindTas', state.windTasKt));
        state.windFromDeg = core.normalize360(numberFromInput('e6bWindFrom', state.windFromDeg));
        state.windSpeedKt = Math.max(0, numberFromInput('e6bWindSpeed', state.windSpeedKt));
    }

    function syncInputs() {
        setInput('e6bSpeed', state.speedKt);
        setInput('e6bFuelRate', state.fuelRateGph, 1);
        setInput('e6bCourse', state.courseDeg);
        setInput('e6bWindTas', state.windTasKt);
        setInput('e6bWindFrom', state.windFromDeg);
        setInput('e6bWindSpeed', state.windSpeedKt);
    }

    function currentWindSolution() {
        return core.solveHeadingForCourse({
            courseDeg: state.courseDeg,
            trueAirspeedKt: state.windTasKt,
            windFromDeg: state.windFromDeg,
            windSpeedKt: state.windSpeedKt
        });
    }

    function updateReadouts() {
        const distance = core.solveTimeDistanceSpeed({ speedKt: state.speedKt, timeMinutes: state.minutes });
        const fuel = core.solveFuel({ fuelRateGph: state.fuelRateGph, timeMinutes: state.fuelMinutes });
        const ringMantissa = core.outerMantissaAtInnerValue(60, state.frontRotation);
        const reference = state.activeRatio === 'fuel' ? state.fuelRateGph : state.speedKt;
        const ringValue = core.nearestValueForMantissa(ringMantissa, reference);
        const densityAlt = core.densityAltitudeFt({ pressureAltitudeFt: state.pressureAltFt, oatC: state.oatC });
        const tas = core.trueAirspeedFromCas({ calibratedAirspeedKt: state.casKt, pressureAltitudeFt: state.pressureAltFt });
        const wind = currentWindSolution();

        qs('#e6bDistanceReadout').textContent = `${core.round(distance.distanceNm, 1)} NM`;
        qs('#e6bFuelReadout').textContent = `${core.round(fuel.fuelGallons, 2)} gal`;
        qs('#e6bRingReadout').textContent = `${core.round(state.frontRotation, 1)} deg / 60 -> ${core.round(ringValue, 1)} ${state.activeRatio === 'fuel' ? 'GPH' : 'kt'}`;
        qs('#e6bDensityReadout').textContent = `${Math.round(densityAlt)} ft`;
        qs('#e6bTasReadout').textContent = `${core.round(tas, 1)} kt`;
        qs('#e6bHeadingReadout').textContent = `${Math.round(wind.headingDeg).toString().padStart(3, '0')} deg`;
        qs('#e6bWcaReadout').textContent = `${core.round(wind.windCorrectionDeg, 1)} deg`;
        qs('#e6bGsReadout').textContent = `${core.round(wind.groundSpeedKt, 1)} kt`;
        const windSliderCenterY = WIND_VIEWBOX.cy - state.windSlideY;
        qs('#e6bCompassReadout').textContent = `${core.round(state.windRotation, 1)} deg / slider ${core.round(windSliderCenterY, 0)}`;
    }

    function applyRotations() {
        const rotor = qs('#e6bFrontRotor');
        const windRotor = qs('#e6bWindRotor');
        const windSlider = qs('#e6bWindSlider');
        const windDot = qs('#e6bWindDot');
        if (rotor) rotor.style.setProperty('--e6b-rotation', `${state.frontRotation}deg`);
        if (windRotor) {
            windRotor.style.setProperty('--e6b-rotation', `${state.windRotation}deg`);
        }
        if (windSlider) windSlider.style.setProperty('--e6b-wind-slide-y', `${state.windSlideY / WIND_VIEWBOX.height * 100}%`);
        if (windDot) {
            windDot.style.setProperty('--e6b-wind-dot-x', `${state.windDotX / WIND_VIEWBOX.width * 100}%`);
            windDot.style.setProperty('--e6b-wind-dot-y', `${state.windDotY / WIND_VIEWBOX.height * 100}%`);
        }
    }

    function render() {
        const computer = qs('#e6bComputer');
        if (computer) {
            computer.classList.toggle('showing-front', state.side === 'front');
            computer.classList.toggle('showing-wind', state.side === 'wind');
        }
        qsa('[data-side]').forEach(button => {
            button.classList.toggle('active', button.dataset.side === state.side);
        });
        qsa('[data-align]').forEach(button => {
            button.classList.toggle('active', button.dataset.align === state.activeRatio);
        });
        qsa('[data-wind-tool]').forEach(button => {
            button.classList.toggle('active', button.dataset.windTool === state.windTool);
        });
        applyRotations();
        updateReadouts();
        scheduleEmbeddedViewStatePost();
    }

    function setSide(side) {
        state.side = side === 'wind' ? 'wind' : 'front';
        render();
    }

    function toggleSide() {
        setSide(state.side === 'wind' ? 'front' : 'wind');
    }

    function setFrontAlignment(kind) {
        state.activeRatio = kind === 'fuel' ? 'fuel' : 'speed';
        const outer = state.activeRatio === 'fuel' ? state.fuelRateGph : state.speedKt;
        state.frontRotation = core.rotationForAlignment(outer, 60);
        render();
    }

    function pointerAngle(stack, event) {
        const rect = stack.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2;
        const y = rect.height / 2 - (event.clientY - rect.top);
        return Math.atan2(x, y) * 180 / Math.PI;
    }

    function windSvgPointFromEvent(stack, event) {
        const rect = stack.getBoundingClientRect();
        return {
            x: core.clamp((event.clientX - rect.left) / rect.width * WIND_VIEWBOX.width, 0, WIND_VIEWBOX.width),
            y: core.clamp((event.clientY - rect.top) / rect.height * WIND_VIEWBOX.height, 0, WIND_VIEWBOX.height)
        };
    }

    function rotateWindPoint(point, degrees) {
        const radians = degrees * Math.PI / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const dx = point.x - WIND_VIEWBOX.cx;
        const dy = point.y - WIND_VIEWBOX.cy;
        return {
            x: WIND_VIEWBOX.cx + dx * cos - dy * sin,
            y: WIND_VIEWBOX.cy + dx * sin + dy * cos
        };
    }

    function windRotorPointFromEvent(stack, event) {
        const visiblePoint = windSvgPointFromEvent(stack, event);
        return rotateWindPoint(visiblePoint, -state.windRotation);
    }

    function windSliderPointFromEvent(stack, event) {
        const visiblePoint = windSvgPointFromEvent(stack, event);
        return {
            x: visiblePoint.x,
            y: visiblePoint.y - state.windSlideY
        };
    }

    function windRotorRadiusFromEvent(stack, event) {
        const point = windSvgPointFromEvent(stack, event);
        return Math.hypot(point.x - WIND_VIEWBOX.cx, point.y - WIND_VIEWBOX.cy);
    }

    function isWindSliderHit(stack, event) {
        const point = windSvgPointFromEvent(stack, event);
        const radius = windRotorRadiusFromEvent(stack, event);
        return point.x >= WIND_SLIDER_HIT.minX
            && point.x <= WIND_SLIDER_HIT.maxX
            && radius > WIND_SLIDER_HIT.compassClearance;
    }

    function setWindDotFromPointer(stack, event) {
        const rotorPoint = windRotorPointFromEvent(stack, event);
        state.windDotX = core.clamp(rotorPoint.x, 0, WIND_VIEWBOX.width);
        state.windDotY = core.clamp(rotorPoint.y, 0, WIND_VIEWBOX.height);
        applyRotations();
    }

    function windSlideDeltaFromEvent(stack, event) {
        const rect = stack.getBoundingClientRect();
        return (event.clientY - drag.startClientY) / rect.height * WIND_VIEWBOX.height;
    }

    function clampWindSlide(slideY) {
        return core.clamp(slideY, WIND_SLIDE_LIMITS.min, WIND_SLIDE_LIMITS.max);
    }

    function startDrag(stack, event) {
        if (event.button !== undefined && event.button !== 0) return;
        const kind = stack.dataset.dial;
        const action = kind === 'wind' && isWindSliderHit(stack, event)
            ? 'wind-slide'
            : kind === 'wind'
                ? 'wind-rotate'
                : 'front-rotate';
        drag = {
            kind,
            action,
            startAngle: pointerAngle(stack, event),
            startRotation: kind === 'wind' ? state.windRotation : state.frontRotation,
            startSlideY: state.windSlideY,
            startClientX: event.clientX,
            startClientY: event.clientY,
            moved: false
        };
        stack.setPointerCapture(event.pointerId);
        event.preventDefault();
    }

    function moveDrag(stack, event) {
        if (!drag) return;
        const movement = Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY);
        if (!drag.moved && movement < CLICK_MOVE_THRESHOLD_PX) return;
        drag.moved = true;
        if (drag.action === 'wind-slide') {
            state.windSlideY = clampWindSlide(drag.startSlideY + windSlideDeltaFromEvent(stack, event));
        } else if (drag.action === 'wind-rotate') {
            const delta = pointerAngle(stack, event) - drag.startAngle;
            state.windRotation = drag.startRotation + delta;
        } else {
            const delta = pointerAngle(stack, event) - drag.startAngle;
            state.frontRotation = drag.startRotation + delta;
        }
        applyRotations();
        updateReadouts();
    }

    function stopDrag(stack, event, allowClick = true) {
        if (!drag) return;
        if (allowClick && drag.action === 'wind-rotate' && !drag.moved) {
            setWindDotFromPointer(stack, event);
        }
        if (event) releasePointerCapture(stack, event.pointerId);
        drag = null;
    }

    function handleStackPointerDown(stack, event) {
        if (event.button !== undefined && event.button !== 0) return;
        if (viewTransformMode && event.pointerType !== 'mouse') {
            viewPointers.set(event.pointerId, pointerSnapshot(event));
            if (typeof stack.setPointerCapture === 'function') {
                try { stack.setPointerCapture(event.pointerId); } catch (_) {}
            }
            if (viewPointers.size >= 2) {
                startViewGesture();
                event.preventDefault();
                return;
            }
        }
        startDrag(stack, event);
    }

    function handleStackPointerMove(stack, event) {
        if (viewTransformMode && viewPointers.has(event.pointerId)) {
            viewPointers.set(event.pointerId, pointerSnapshot(event));
            if (viewGesture || viewPointers.size >= 2) {
                updateViewGesture();
                event.preventDefault();
                return;
            }
        }
        moveDrag(stack, event);
    }

    function handleStackPointerEnd(stack, event, allowClick = true) {
        if (viewTransformMode && viewPointers.has(event.pointerId)) {
            const wasViewGesture = !!viewGesture || viewPointers.size > 1;
            viewPointers.delete(event.pointerId);
            releasePointerCapture(stack, event.pointerId);
            if (wasViewGesture) {
                endViewGestureIfNeeded();
                event.preventDefault();
                return;
            }
        }
        stopDrag(stack, event, allowClick);
    }

    function handleViewWheel(event) {
        if (!viewTransformMode || (!event.ctrlKey && !event.metaKey)) return;
        const zoomFactor = Math.exp(-event.deltaY * 0.01);
        setViewTransform(viewState.scale * zoomFactor, viewState.x, viewState.y);
        event.preventDefault();
    }

    function bindEvents() {
        qsa('[data-side]').forEach(button => {
            button.addEventListener('click', () => {
                setSide(button.dataset.side);
            });
        });
        qsa('[data-align]').forEach(button => {
            button.addEventListener('click', () => {
                readInputs();
                setFrontAlignment(button.dataset.align);
            });
        });
        qsa('[data-wind-tool]').forEach(button => {
            button.addEventListener('click', () => {
                state.windTool = button.dataset.windTool === 'slide' ? 'slide' : 'rotate';
                render();
            });
        });
        qsa('input').forEach(input => {
            input.addEventListener('input', () => {
                readInputs();
                updateReadouts();
            });
        });
        qsa('.e6b-stack').forEach(stack => {
            stack.addEventListener('pointerdown', event => handleStackPointerDown(stack, event));
            stack.addEventListener('pointermove', event => handleStackPointerMove(stack, event));
            stack.addEventListener('pointerup', event => handleStackPointerEnd(stack, event));
            stack.addEventListener('pointercancel', event => handleStackPointerEnd(stack, event, false));
        });
        const stage = qs('.e6b-stage');
        if (stage) stage.addEventListener('wheel', handleViewWheel, { passive: false });
        window.addEventListener('resize', () => setViewTransform(viewState.scale, viewState.x, viewState.y));
        window.addEventListener('message', event => {
            const data = event && event.data;
            if (!data || typeof data !== 'object') return;
            if (data.type === 'ga-e6b-toggle-side') toggleSide();
            if (data.type === 'ga-e6b-set-side') setSide(data.side);
            if (data.type === 'ga-e6b-reset-view') setViewTransform(1, 0, 0);
            if (data.type === 'ga-e6b-set-view') {
                setViewTransform(Number(data.scale) || 1, Number(data.x) || 0, Number(data.y) || 0);
            }
            if (data.type === 'ga-e6b-pan-view') {
                setViewTransform(viewState.scale, viewState.x + Number(data.dx || 0), viewState.y + Number(data.dy || 0));
            }
            if (data.type === 'ga-e6b-report-view') scheduleEmbeddedViewStatePost();
        });
        bindWindowPlanControls();
        bindScalePlanControls();
        bindPreviewControls();
    }

    function init() {
        stripCalibrationDomForEmbedded();
        if (calibrationMode) {
            renderWindowPlanSectors();
            renderScalePlanScales();
        }
        readInputs();
        syncInputs();
        bindEvents();
        applyViewTransform();
        render();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    window.GAE6BPrototype = {
        setSide,
        toggleSide
    };
})();
