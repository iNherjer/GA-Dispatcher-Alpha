(function() {
    'use strict';

    const core = window.GAE6B;
    const FRONT_VIEWBOX = { width: 510, height: 590 };
    const WIND_VIEWBOX = { width: 510, height: 1000, cx: 255, cy: 500 };
    const WIND_SLIDER_CENTER_RANGE = { min: 190, max: 948 };
    const WIND_SLIDE_LIMITS = {
        min: WIND_VIEWBOX.cy - WIND_SLIDER_CENTER_RANGE.max,
        max: WIND_VIEWBOX.cy - WIND_SLIDER_CENTER_RANGE.min
    };
    const WIND_SLIDER_HIT = {
        minX: 52,
        maxX: 458,
        compassClearance: 178,
        sliderClearance: 286,
        panInnerRadius: 240,
        panOuterRadius: 286
    };
    const EMBEDDED_CONTROL_KEYS = ['flip', 'zoomOut', 'zoomIn', 'close'];
    const EMBEDDED_CONTROL_FALLBACKS = {
        front: {
            flip: { x: 0.72, y: 0.16 },
            zoomOut: { x: 0.80, y: 0.18 },
            zoomIn: { x: 0.87, y: 0.22 },
            close: { x: 0.92, y: 0.28 }
        },
        wind: {
            flip: { x: 0.72, y: 0.31 },
            zoomOut: { x: 0.79, y: 0.34 },
            zoomIn: { x: 0.85, y: 0.38 },
            close: { x: 0.89, y: 0.43 }
        }
    };
    const CLICK_MOVE_THRESHOLD_PX = 4;
    const EMBEDDED_VIEW_SCALE = { min: 0.55, max: 3.4 };
    const EMBEDDED_VIEW_RESOLUTION_STEPS = [0.65, 0.82, 1, 1.22, 1.48, 1.8, 2.18, 2.65, 3.2, 3.6];
    const PREVIEW_VIEW_SCALE = { min: 0.5, max: 3.2 };
    const WINDOW_PLAN_STORAGE_KEY = 'ga-e6b-window-plan-sectors';
    const WINDOW_PLAN_LABELS_STORAGE_KEY = 'ga-e6b-window-plan-labels-visible';
    const PREVIEW_STORAGE_KEY = 'ga-e6b-preview-toggles';
    const SCALE_PLAN_STORAGE_KEY = 'ga-e6b-window-plan-scales-v2';
    const WORKBENCH_FRONT_STORAGE_KEY = 'ga-e6b-workbench-front-disc-v1';
    const WORKBENCH_FRONT_JSON_VERSION = '20260710-workbenchfront01';
    const WORKBENCH_WIND_STORAGE_KEY = 'ga-e6b-workbench-wind-disc-v1';
    const WORKBENCH_WIND_JSON_VERSION = '20260710-workbenchwind01';
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
    const calibrationMode = false;
    const viewTransformMode = embeddedMode;
    const state = {
        side: 'front',
        activeRatio: 'speed',
        windTool: 'rotate',
        frontRotation: 0,
        windRotation: 0,
        windSlideY: 0,
        windCenterX: WIND_VIEWBOX.cx,
        windCenterY: WIND_VIEWBOX.cy,
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
    const viewState = { scale: 1, renderScale: 1, resolutionScale: 1, x: 0, y: 0 };
    const embeddedBaseSize = {
        frontWidth: 0,
        windWidth: 0,
        appliedResolutionScale: 0,
        appliedFrontWidth: 0,
        appliedWindWidth: 0
    };
    const viewPointers = new Map();
    let viewGesture = null;
    let embeddedViewStatePostPending = false;
    let rotationFramePending = false;
    let windDotUserSet = false;
    let dragFramePending = false;
    let dragSequence = 0;
    const workbenchSvgCache = { fixed: '', rotor: '', windSlider: '', windRotorBack: '', windRotorFront: '' };
    let activeWorkbenchFrontSnapshot = null;
    let activeWorkbenchWindSnapshot = null;

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
        const embeddedSlack = embeddedMode ? (scale > 1.01 ? 1.15 : 0.42) : 0;
        const embeddedSlackX = rect.width * embeddedSlack;
        const embeddedSlackY = rect.height * embeddedSlack;
        const maxX = Math.max(0, (scale - 1) * rect.width / 2) + embeddedSlackX;
        const maxY = Math.max(0, (scale - 1) * rect.height / 2) + embeddedSlackY;
        return {
            x: clamp(x, -maxX, maxX),
            y: clamp(y, -maxY, maxY)
        };
    }

    function embeddedResolutionForScale(scale) {
        if (!embeddedMode) return 1;
        if (embeddedBaseSize.frontWidth <= 0 && embeddedBaseSize.windWidth <= 0) return 1;
        const target = clamp(scale, EMBEDDED_VIEW_SCALE.min, EMBEDDED_VIEW_SCALE.max);
        for (const step of EMBEDDED_VIEW_RESOLUTION_STEPS) {
            if (step >= target - 0.001) return step;
        }
        return EMBEDDED_VIEW_RESOLUTION_STEPS[EMBEDDED_VIEW_RESOLUTION_STEPS.length - 1] || 1;
    }

    function applyEmbeddedResolutionScale(resolutionScale) {
        if (!embeddedMode) return;
        const scale = Number.isFinite(resolutionScale) && resolutionScale > 0 ? resolutionScale : 1;
        const frontWidth = embeddedBaseSize.frontWidth > 0 ? embeddedBaseSize.frontWidth * scale : 0;
        const windWidth = embeddedBaseSize.windWidth > 0 ? embeddedBaseSize.windWidth * scale : 0;
        if (
            embeddedBaseSize.appliedResolutionScale === scale &&
            embeddedBaseSize.appliedFrontWidth === frontWidth &&
            embeddedBaseSize.appliedWindWidth === windWidth
        ) {
            return;
        }
        const target = document.documentElement;
        if (frontWidth > 0) {
            target.style.setProperty('--e6b-embedded-front-width', `${frontWidth.toFixed(2)}px`);
        }
        if (windWidth > 0) {
            target.style.setProperty('--e6b-embedded-wind-width', `${windWidth.toFixed(2)}px`);
        }
        embeddedBaseSize.appliedResolutionScale = scale;
        embeddedBaseSize.appliedFrontWidth = frontWidth;
        embeddedBaseSize.appliedWindWidth = windWidth;
    }

    function applyViewTransform() {
        const computer = qs('#e6bComputer');
        if (!computer) return;
        computer.style.setProperty('--e6b-view-scale', String(viewState.renderScale || viewState.scale));
        computer.style.setProperty('--e6b-view-x', `${viewState.x}px`);
        computer.style.setProperty('--e6b-view-y', `${viewState.y}px`);
        document.body.classList.toggle('e6b-view-zoomed', viewState.scale > 1.01);
        syncPreviewZoomControls();
        syncEmbeddedLocalChrome();
        scheduleEmbeddedViewStatePost();
    }

    function setViewTransform(scale, x, y) {
        const limits = embeddedMode ? EMBEDDED_VIEW_SCALE : PREVIEW_VIEW_SCALE;
        const nextScale = clamp(scale, limits.min, limits.max);
        const resolutionScale = embeddedMode ? embeddedResolutionForScale(nextScale) : 1;
        const renderScale = resolutionScale > 0 ? nextScale / resolutionScale : nextScale;
        applyEmbeddedResolutionScale(resolutionScale);
        const pan = clampViewPan(x, y, nextScale);
        viewState.scale = nextScale;
        viewState.renderScale = renderScale;
        viewState.resolutionScale = resolutionScale;
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

    function setEmbeddedBaseSize(frontWidth, windWidth) {
        if (!embeddedMode) return;
        const front = Number(frontWidth);
        const wind = Number(windWidth);
        if (Number.isFinite(front) && front > 0) {
            embeddedBaseSize.frontWidth = front;
        }
        if (Number.isFinite(wind) && wind > 0) {
            embeddedBaseSize.windWidth = wind;
        }
        setViewTransform(viewState.scale, viewState.x, viewState.y);
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

    function controlKeyToCssName(key) {
        return String(key || '').replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
    }

    function embeddedControlRatios(side = state.side) {
        const snapshot = side === 'wind' ? activeWorkbenchWindSnapshot : activeWorkbenchFrontSnapshot;
        const controls = snapshot && snapshot.controls && typeof snapshot.controls === 'object' ? snapshot.controls : {};
        const fallbacks = EMBEDDED_CONTROL_FALLBACKS[side === 'wind' ? 'wind' : 'front'];
        return EMBEDDED_CONTROL_KEYS.reduce((result, key) => {
            const control = controls[key];
            const ratio = control ? controlPointToStackRatio(side, snapshot, control) : null;
            result[key] = ratio || fallbacks[key] || { x: 0.5, y: 0.5 };
            return result;
        }, {});
    }

    function embeddedControlPositions(stackRect) {
        if (!stackRect) return {};
        const ratios = embeddedControlRatios(state.side);
        return EMBEDDED_CONTROL_KEYS.reduce((result, key) => {
            const ratio = ratios[key];
            if (!ratio) return result;
            result[key] = {
                x: ratio.x * stackRect.width,
                y: ratio.y * stackRect.height
            };
            return result;
        }, {});
    }

    function syncEmbeddedLocalChrome() {
        if (!embeddedMode) return;
        const chrome = qs('#e6bEmbeddedChrome');
        const stack = getActiveViewStack();
        if (!chrome || !stack) return;
        const stackLeft = stack.offsetLeft || 0;
        const stackTop = stack.offsetTop || 0;
        const stackWidth = Math.max(1, stack.offsetWidth || stack.getBoundingClientRect().width || 1);
        const stackHeight = Math.max(1, stack.offsetHeight || stack.getBoundingClientRect().height || 1);
        const ratios = embeddedControlRatios(state.side);
        EMBEDDED_CONTROL_KEYS.forEach(key => {
            const ratio = ratios[key] || { x: 0.5, y: 0.5 };
            const cssName = controlKeyToCssName(key);
            chrome.style.setProperty(`--e6b-local-control-${cssName}-x`, `${stackLeft + ratio.x * stackWidth}px`);
            chrome.style.setProperty(`--e6b-local-control-${cssName}-y`, `${stackTop + ratio.y * stackHeight}px`);
        });
    }

    function postEmbeddedViewState() {
        if (!embeddedMode || !window.parent || window.parent === window) return;
        const stack = getActiveViewStack();
        const stage = qs('.e6b-stage');
        if (!stack) return;
        syncEmbeddedLocalChrome();
        const stackRect = stack.getBoundingClientRect();
        const stageRect = stage ? stage.getBoundingClientRect() : { left: 0, top: 0 };
        try {
            window.parent.postMessage({
                type: 'ga-e6b-view-state',
                localControls: true,
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
                },
                controls: embeddedControlPositions(stackRect)
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

    function readWorkbenchFrontDisc() {
        try {
            return JSON.parse(window.localStorage.getItem(WORKBENCH_FRONT_STORAGE_KEY) || 'null');
        } catch (_) {
            return null;
        }
    }

    function readWorkbenchWindDisc() {
        try {
            return JSON.parse(window.localStorage.getItem(WORKBENCH_WIND_STORAGE_KEY) || 'null');
        } catch (_) {
            return null;
        }
    }

    function workbenchFrontJsonUrl() {
        const base = window.location.pathname.includes('/tools/')
            ? '../e6b/e6b-workbench-front-disc.json'
            : './e6b-workbench-front-disc.json';
        return `${base}?v=${WORKBENCH_FRONT_JSON_VERSION}`;
    }

    function workbenchWindJsonUrl() {
        const base = window.location.pathname.includes('/tools/')
            ? '../e6b/e6b-workbench-wind-disc.json'
            : './e6b-workbench-wind-disc.json';
        return `${base}?v=${WORKBENCH_WIND_JSON_VERSION}`;
    }

    async function fetchWorkbenchFrontDisc() {
        try {
            const response = await fetch(workbenchFrontJsonUrl(), { cache: 'no-store' });
            if (!response.ok) return null;
            return await response.json();
        } catch (_) {
            return null;
        }
    }

    async function fetchWorkbenchWindDisc() {
        try {
            const response = await fetch(workbenchWindJsonUrl(), { cache: 'no-store' });
            if (!response.ok) return null;
            return await response.json();
        } catch (_) {
            return null;
        }
    }

    function validWorkbenchFrontDisc(snapshot) {
        return !!(snapshot && snapshot.svgs && snapshot.svgs.back && snapshot.svgs.front);
    }

    function validWorkbenchWindDisc(snapshot) {
        const svgs = snapshot && snapshot.svgs;
        const wind = snapshot && snapshot.wind;
        return !!(svgs && wind && svgs.slider && (svgs.rotorFront || svgs.rotor) && (svgs.rotorBack || svgs.back));
    }

    function bundledWorkbenchFrontDisc() {
        const source = {
            calibration: { cx: 929, cy: 1210, radius: 865, rotation: 0 },
            image: { width: 1858, height: 2270 },
            typography: { fontFamily: 'Arial', fontWeight: 'normal', fontWidth: 'normal' },
            elements: bundledWorkbenchElements()
        };
        return {
            version: 1,
            savedAt: '',
            source: { bundled: true },
            viewBox: {
                width: source.image.width,
                height: source.image.height,
                cx: source.calibration.cx,
                cy: source.calibration.cy,
                radius: source.calibration.radius
            },
            svgs: {
                back: renderBundledWorkbenchSvg(source, 'back'),
                front: renderBundledWorkbenchSvg(source, 'front')
            }
        };
    }

    function bundledWorkbenchElements() {
        const logPoints = '10=-90, 11=-75.1, 12=-61.5, 13=-49.0, 14=-37.4, 15=-26.6, 16=-16.3, 17=-6.8, 18=2.9, 19=11.2, 20=18.4, 25=53.3, 30=81.7, 35=105.0, 40=126.7, 45=145.1, 50=162.3, 55=177.8, 60=191.0, 70=213.3, 80=235.0, 90=253.5';
        return [
            { id: 'outer-case', type: 'ring', label: 'Outer case guide', disc: 'front', radius: 1018, startAngle: -180, endAngle: 180 },
            { id: 'outer-slide-rule', type: 'scale', label: 'Outer slide rule', disc: 'back', radius: 855, labelRadius: 910, startAngle: -90, endAngle: 270, min: 10, max: 100, mapping: 'log10', majorTick: 40, minorTick: 24, fontSize: 54, valuesText: '10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,30,35,40,45,50,55,60,70,80,90', minorValuesText: '10..100/1', calibrationText: logPoints },
            { id: 'inner-slide-rule', type: 'scale', label: 'Inner slide rule', disc: 'front', radius: 760, labelRadius: 805, startAngle: -90, endAngle: 270, min: 10, max: 100, mapping: 'log10', majorTick: -34, minorTick: -20, fontSize: 40, valuesText: '10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,30,35,40,45,50,55,60,70,80,90', minorValuesText: '10..100/1', calibrationText: logPoints },
            { id: 'hours-scale', type: 'scale', label: 'Hours ring', disc: 'front', radius: 675, labelRadius: 710, startAngle: -166, endAngle: 113, min: 1, max: 9, mapping: 'linear', majorTick: 34, mediumTick: 26, minorTick: 12, fontSize: 38, valuesText: '1=1:00,1.166667=1:10,1.333333=1:20,1.5=1:30,1.666667=1:40,1.833333=1:50,2=2:00,2.5=2:30,3=3:00,3.5=3:30,4=4:00,4.5=4:30,5=5:00,6=6:00,7=7:00,8=8:00,9=9:00', mediumValuesText: '1..9/0.083333', minorValuesText: '1..9/0.016667', calibrationText: '1=-166, 2=-42, 3=8, 4=45, 5=76, 6=103, 9=159' },
            { id: 'left-temp-window', type: 'window', label: 'Left temp window', disc: 'front', innerRadius: 505, outerRadius: 615, startAngle: -156, endAngle: -105 },
            { id: 'right-pa-window', type: 'window', label: 'Right PA window', disc: 'front', innerRadius: 505, outerRadius: 615, startAngle: -54, endAngle: 8 },
            { id: 'density-window', type: 'window', label: 'Density altitude window', disc: 'front', innerRadius: 290, outerRadius: 350, startAngle: -110, endAngle: -70 },
            { id: 'density-scale', type: 'scale', label: 'Density scale', disc: 'back', radius: 326, labelRadius: 304, startAngle: -110, endAngle: -70, min: -10, max: 10, mapping: 'linear', majorTick: -26, minorTick: -14, fontSize: 34, valuesText: '-10,-5,0,5,10', minorValuesText: '-10..10/1', calibrationText: '-10=-110, -5=-100, 0=-90, 5=-80, 10=-70' },
            { id: 'title-label', type: 'label', label: 'Title', text: 'E6B FLIGHT COMPUTER', disc: 'front', radius: 990, startAngle: -91, fontSize: 74, textRotation: -8, fontWeight: 'bold' },
            { id: 'left-help-label', type: 'label', label: 'Left help text', text: 'FOR ALTITUDE\\nCOMPUTATIONS', disc: 'front', radius: 390, startAngle: -166, fontSize: 34, textRotation: 0, fontWeight: 'bold' },
            { id: 'right-help-label', type: 'label', label: 'Right help text', text: 'FOR TRUE\\nAIRSPEED &\\nDENSITY ALT', disc: 'front', radius: 390, startAngle: -14, fontSize: 31, textRotation: 0, fontWeight: 'bold' },
            { id: 'fuel-label', type: 'label', label: 'Fuel block', text: 'FOR FUEL\\nCONSUMPTION', disc: 'front', radius: 420, startAngle: 100, fontSize: 30, textRotation: 180, fontWeight: 'bold' },
            { id: 'time-distance-label', type: 'label', label: 'Time distance block', text: 'FOR TIME\\nAND DISTANCE', disc: 'front', radius: 420, startAngle: 56, fontSize: 30, textRotation: 180, fontWeight: 'bold' },
            ...bundledWorkbenchIndexElements()
        ];
    }

    function bundledWorkbenchIndexElements() {
        const skipIds = new Set(['idx-rate-60']);
        const textById = {
            'idx-oil-lbs': 'OIL LBS',
            'idx-imp-gal-top': 'IMP. GAL.',
            'idx-km-us-gal': 'KM / US GAL',
            'idx-ft': 'FT',
            'idx-kg': 'KG',
            'idx-cas': 'CAS',
            'idx-tas': 'TAS',
            'idx-seconds': 'SECONDS',
            'idx-lbs-bottom': 'LBS',
            'idx-meters': 'METERS',
            'idx-liters': 'LITERS',
            'idx-true-alt': 'TRUE ALT.',
            'idx-density-pointer': 'DENSITY ALTITUDE'
        };
        return [
            { id: 'idx-rate-60', type: 'index', label: 'Rate 60 index', disc: 'front', text: '', radius: 780, labelRadius: 720, startAngle: 180, indexLength: -82, indexWidth: 62, stemLength: 0, fontSize: 28, textRotation: -90 },
            { id: 'idx-oil-lbs', type: 'index', label: 'Oil lbs index', disc: 'front', radius: 856, labelRadius: 960, startAngle: -96 },
            { id: 'idx-imp-gal-top', type: 'index', label: 'Imp gal top index', disc: 'front', radius: 856, labelRadius: 960, startAngle: -74 },
            { id: 'idx-km-us-gal', type: 'index', label: 'KM / US gal index', disc: 'front', radius: 856, labelRadius: 960, startAngle: -48 },
            { id: 'idx-ft', type: 'index', label: 'FT index', disc: 'front', radius: 856, labelRadius: 960, startAngle: -27 },
            { id: 'idx-kg', type: 'index', label: 'KG index', disc: 'front', radius: 856, labelRadius: 960, startAngle: 2 },
            { id: 'idx-cas', type: 'index', label: 'CAS index', disc: 'front', radius: 856, labelRadius: 960, startAngle: 71 },
            { id: 'idx-tas', type: 'index', label: 'TAS index', disc: 'front', radius: 856, labelRadius: 960, startAngle: 83 },
            { id: 'idx-seconds', type: 'index', label: 'Seconds index', disc: 'front', radius: 760, labelRadius: 845, startAngle: 107 },
            { id: 'idx-lbs-bottom', type: 'index', label: 'LBS bottom index', disc: 'front', radius: 856, labelRadius: 960, startAngle: 123 },
            { id: 'idx-meters', type: 'index', label: 'Meters index', disc: 'front', radius: 856, labelRadius: 960, startAngle: 137 },
            { id: 'idx-liters', type: 'index', label: 'Liters index', disc: 'front', radius: 856, labelRadius: 960, startAngle: 156 },
            { id: 'idx-true-alt', type: 'index', label: 'True altitude index', disc: 'front', radius: 740, labelRadius: 835, startAngle: 169 },
            { id: 'idx-density-pointer', type: 'index', label: 'Density altitude pointer', disc: 'front', radius: 246, labelRadius: 300, startAngle: -90 }
        ].map(element => {
            if (skipIds.has(element.id)) return element;
            return {
                ...element,
                text: textById[element.id] || String(element.label || '').replace(/\s+index$/i, '').toUpperCase(),
                fontSize: 40,
                textRotation: 52.2,
                indexLength: 20,
                indexWidth: 30,
                stemLength: 20,
                fontWeight: 'bold'
            };
        });
    }

    function renderBundledWorkbenchSvg(source, disc) {
        const body = [
            bundledSvgStyle(),
            tag('g', { class: `trace-preview-disc trace-preview-${disc}` }, [
                renderBundledSurface(source, disc),
                ...source.elements
                    .filter(element => bundledElementDisc(element) === disc)
                    .map(element => renderBundledElement(source, element))
            ].join(''))
        ].join('');
        return tag('svg', {
            xmlns: SVG_NS,
            viewBox: `0 0 ${source.image.width} ${source.image.height}`,
            role: 'img',
            'aria-label': disc === 'front' ? 'E6B Frontscheibe' : 'E6B Hintergrundscheibe',
            preserveAspectRatio: 'xMidYMid meet'
        }, body);
    }

    function bundledSvgStyle() {
        return tag('style', {}, `
            .trace-preview-back-surface{fill:#d1d5d8;}
            .trace-preview-front-surface{fill:#c5cacf;}
            .trace-ring,.trace-scale-guide{fill:none;stroke:rgba(18,22,25,.74);stroke-width:1.4;vector-effect:non-scaling-stroke;}
            .trace-window{fill:rgba(255,255,255,.03);stroke:rgba(18,22,25,.78);stroke-width:2;vector-effect:non-scaling-stroke;}
            .trace-window-edge{stroke:rgba(18,22,25,.78);stroke-width:1.3;vector-effect:non-scaling-stroke;}
            .trace-tick{stroke:rgba(18,22,25,.94);stroke-width:1.4;vector-effect:non-scaling-stroke;}
            .trace-tick.medium{stroke-width:1.7;opacity:.9;}
            .trace-tick.major{stroke-width:2.1;}
            .trace-tick.minor{opacity:.72;}
            .trace-number,.trace-label,.trace-index-label{fill:#101418;stroke:rgba(229,233,236,.68);stroke-width:3px;stroke-linejoin:round;paint-order:stroke;}
            .trace-index-head{fill:#101418;stroke:none;}
            .trace-index-stem{stroke:#101418;stroke-width:2.3;vector-effect:non-scaling-stroke;}
            .trace-index-hitbox,.trace-point-hitbox{display:none;}
        `);
    }

    function renderBundledSurface(source, disc) {
        const radius = bundledDiscRadius(source, disc);
        const windows = disc === 'front'
            ? source.elements.filter(element => bundledElementDisc(element) === 'front' && element.type === 'window')
            : [];
        const d = [
            bundledCirclePath(source, radius),
            ...windows.map(element => bundledSectorPath(
                source,
                Number(element.innerRadius || 0),
                Number(element.outerRadius || 0),
                Number(element.startAngle || 0),
                Number(element.endAngle || 0)
            ))
        ].join(' ');
        return tag('path', { class: `trace-preview-surface trace-preview-${disc}-surface`, d, 'fill-rule': 'evenodd' });
    }

    function bundledDiscRadius(source, disc) {
        const candidates = [Number(source.calibration.radius || 0)];
        source.elements
            .filter(element => bundledElementDisc(element) === disc)
            .forEach(element => {
                const radius = Number(element.radius || 0);
                const labelRadius = Number(element.labelRadius || 0);
                const outerRadius = Number(element.outerRadius || 0);
                const majorTick = Number(element.majorTick || 0);
                const minorTick = Number(element.minorTick || 0);
                const indexLength = Number(element.indexLength || 0);
                const stemLength = Number(element.stemLength || 0);
                const fontSize = Number(element.fontSize || 0);
                [radius, labelRadius, outerRadius].forEach(value => {
                    if (Number.isFinite(value)) candidates.push(Math.abs(value));
                });
                if (Number.isFinite(radius + majorTick)) candidates.push(Math.abs(radius + majorTick));
                if (Number.isFinite(radius + minorTick)) candidates.push(Math.abs(radius + minorTick));
                if (Number.isFinite(radius + indexLength + stemLength)) candidates.push(Math.abs(radius + indexLength + stemLength));
                if (Number.isFinite(labelRadius + fontSize)) candidates.push(Math.abs(labelRadius + fontSize));
            });
        return Math.max(...candidates.filter(Number.isFinite), 1) + 28;
    }

    function renderBundledElement(source, element) {
        if (element.type === 'ring') return tag('circle', {
            class: 'trace-ring',
            cx: source.calibration.cx,
            cy: source.calibration.cy,
            r: Number(element.radius || 0)
        });
        if (element.type === 'window') return renderBundledWindow(source, element);
        if (element.type === 'scale') return renderBundledScale(source, element);
        if (element.type === 'label') return renderBundledLabel(source, element);
        if (element.type === 'index') return renderBundledIndex(source, element);
        return '';
    }

    function renderBundledWindow(source, element) {
        const innerStart = bundledPolarPoint(source, Number(element.innerRadius || 0), Number(element.startAngle || 0));
        const outerStart = bundledPolarPoint(source, Number(element.outerRadius || 0), Number(element.startAngle || 0));
        const innerEnd = bundledPolarPoint(source, Number(element.innerRadius || 0), Number(element.endAngle || 0));
        const outerEnd = bundledPolarPoint(source, Number(element.outerRadius || 0), Number(element.endAngle || 0));
        return tag('g', {}, [
            tag('path', {
                class: 'trace-window',
                d: bundledSectorPath(source, Number(element.innerRadius || 0), Number(element.outerRadius || 0), Number(element.startAngle || 0), Number(element.endAngle || 0))
            }),
            tag('line', { class: 'trace-window-edge', x1: innerStart.x, y1: innerStart.y, x2: outerStart.x, y2: outerStart.y }),
            tag('line', { class: 'trace-window-edge', x1: innerEnd.x, y1: innerEnd.y, x2: outerEnd.x, y2: outerEnd.y })
        ].join(''));
    }

    function renderBundledScale(source, scale) {
        const ticks = [
            ...parseBundledNumberList(scale.minorValuesText).map(item => renderBundledTick(source, scale, item, 'minor')),
            ...parseBundledNumberList(scale.mediumValuesText).map(item => renderBundledTick(source, scale, item, 'medium')),
            ...parseBundledNumberList(scale.valuesText).map(item => renderBundledTick(source, scale, item, 'major'))
        ].join('');
        return tag('g', { class: 'trace-scale' }, [
            tag('path', {
                class: 'trace-scale-guide',
                d: bundledArcPath(source, Number(scale.radius || 0), Number(scale.startAngle || 0), Number(scale.endAngle || 0))
            }),
            ticks
        ].join(''));
    }

    function renderBundledTick(source, scale, item, kind) {
        const angle = bundledValueAngle(scale, item.value);
        const radius = Number(scale.radius || 0);
        const tickLength = bundledTickLength(scale, kind);
        const a = bundledPolarPoint(source, radius, angle);
        const b = bundledPolarPoint(source, radius + tickLength, angle);
        const line = tag('line', { class: `trace-tick ${kind}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
        if (kind !== 'major') return line;
        const labelRadius = Number(scale.labelRadius || radius + tickLength + 22);
        const p = bundledPolarPoint(source, labelRadius, angle);
        return tag('g', { class: 'trace-scale-point' }, [
            line,
            tag('text', {
                class: 'trace-number',
                x: p.x,
                y: p.y,
                'font-size': Number(scale.fontSize || 24),
                'text-anchor': 'middle',
                'dominant-baseline': 'middle',
                transform: `rotate(${roundSvg(angle + 90)} ${roundSvg(p.x)} ${roundSvg(p.y)})`,
                ...bundledTypographyAttrs(source, scale)
            }, escapeSvgText(item.label))
        ].join(''));
    }

    function renderBundledLabel(source, element) {
        const angle = Number(element.startAngle || 0);
        const p = bundledPolarPoint(source, Number(element.radius || 0), angle);
        const lines = String(element.text || element.label || '').split(/\\n|\n/);
        const tspans = lines.map((line, index) => tag('tspan', {
            x: p.x,
            dy: index === 0 ? `${-(lines.length - 1) * 0.55}em` : '1.1em'
        }, escapeSvgText(line))).join('');
        return tag('text', {
            class: 'trace-label',
            x: p.x,
            y: p.y,
            'font-size': Number(element.fontSize || 28),
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            transform: `rotate(${roundSvg(Number(element.textRotation || 0))} ${roundSvg(p.x)} ${roundSvg(p.y)})`,
            ...bundledTypographyAttrs(source, element)
        }, tspans);
    }

    function renderBundledIndex(source, element) {
        const geometry = bundledIndexGeometry(source, element);
        const parts = [
            tag('path', {
                class: 'trace-index-head',
                d: [
                    `M ${roundSvg(geometry.tip.x)} ${roundSvg(geometry.tip.y)}`,
                    `L ${roundSvg(geometry.left.x)} ${roundSvg(geometry.left.y)}`,
                    `L ${roundSvg(geometry.right.x)} ${roundSvg(geometry.right.y)}`,
                    'Z'
                ].join(' ')
            })
        ];
        if (geometry.stemLength) {
            parts.push(tag('line', {
                class: 'trace-index-stem',
                x1: geometry.base.x,
                y1: geometry.base.y,
                x2: geometry.stemEnd.x,
                y2: geometry.stemEnd.y
            }));
        }
        if (element.text) {
            const angle = Number(element.startAngle || 0);
            const labelAngle = angle + Number(element.labelAngleOffset || 0);
            const labelRadius = Number(element.labelRadius || Number(element.radius || 0) + Number(element.indexLength || 0) + 44);
            const p = bundledPolarPoint(source, labelRadius, labelAngle);
            parts.push(tag('text', {
                class: 'trace-index-label',
                x: p.x,
                y: p.y,
                'font-size': Number(element.fontSize || 24),
                'text-anchor': 'middle',
                'dominant-baseline': 'middle',
                transform: `rotate(${roundSvg(Number(element.textRotation || 0))} ${roundSvg(p.x)} ${roundSvg(p.y)})`,
                ...bundledTypographyAttrs(source, element)
            }, escapeSvgText(element.text)));
        }
        return tag('g', { class: 'trace-index' }, parts.join(''));
    }

    function bundledIndexGeometry(source, element) {
        const angle = Number(element.startAngle || 0);
        const radius = Number(element.radius || 0);
        const length = Number(element.indexLength ?? element.majorTick ?? 62);
        const width = Number(element.indexWidth ?? element.minorTick ?? 38);
        const stemLength = Number(element.stemLength || 0);
        const rotation = Number(element.indexRotation || 0);
        const markerAngle = angle + rotation;
        const tip = bundledPolarPoint(source, radius, angle);
        const radians = (markerAngle + Number(source.calibration.rotation || 0)) * Math.PI / 180;
        const direction = { x: Math.cos(radians), y: Math.sin(radians) };
        const base = { x: tip.x + direction.x * length, y: tip.y + direction.y * length };
        const stemEnd = {
            x: tip.x + direction.x * (length + stemLength),
            y: tip.y + direction.y * (length + stemLength)
        };
        const perp = { x: -Math.sin(radians), y: Math.cos(radians) };
        const halfWidth = Math.abs(width) / 2;
        return {
            tip,
            base,
            stemEnd,
            left: { x: base.x + perp.x * halfWidth, y: base.y + perp.y * halfWidth },
            right: { x: base.x - perp.x * halfWidth, y: base.y - perp.y * halfWidth },
            angle,
            length,
            stemLength
        };
    }

    function bundledElementDisc(element) {
        return element && element.disc === 'back' ? 'back' : 'front';
    }

    function bundledTypographyAttrs(source, element) {
        const family = element.fontFamily || source.typography.fontFamily || 'Arial';
        const bold = element.fontWeight === 'bold' || source.typography.fontWeight === 'bold';
        const stack = family.includes(',') ? family : `${family}, Arial, Helvetica, sans-serif`;
        return {
            'font-family': stack,
            'font-weight': bold ? '700' : '400',
            style: `font-family:${stack};font-weight:${bold ? '700' : '400'};`
        };
    }

    function bundledPolarPoint(source, radius, angle) {
        const radians = (Number(angle || 0) + Number(source.calibration.rotation || 0)) * Math.PI / 180;
        return {
            x: source.calibration.cx + Math.cos(radians) * radius,
            y: source.calibration.cy + Math.sin(radians) * radius
        };
    }

    function bundledArcPath(source, radius, startAngle, endAngle) {
        const start = bundledPolarPoint(source, radius, startAngle);
        const end = bundledPolarPoint(source, radius, endAngle);
        const largeArc = bundledAngleDelta(startAngle, endAngle) > 180 ? 1 : 0;
        return `M ${roundSvg(start.x)} ${roundSvg(start.y)} A ${roundSvg(radius)} ${roundSvg(radius)} 0 ${largeArc} 1 ${roundSvg(end.x)} ${roundSvg(end.y)}`;
    }

    function bundledSectorPath(source, innerRadius, outerRadius, startAngle, endAngle) {
        const outerStart = bundledPolarPoint(source, outerRadius, startAngle);
        const outerEnd = bundledPolarPoint(source, outerRadius, endAngle);
        const innerEnd = bundledPolarPoint(source, innerRadius, endAngle);
        const innerStart = bundledPolarPoint(source, innerRadius, startAngle);
        const largeArc = bundledAngleDelta(startAngle, endAngle) > 180 ? 1 : 0;
        return [
            `M ${roundSvg(outerStart.x)} ${roundSvg(outerStart.y)}`,
            `A ${roundSvg(outerRadius)} ${roundSvg(outerRadius)} 0 ${largeArc} 1 ${roundSvg(outerEnd.x)} ${roundSvg(outerEnd.y)}`,
            `L ${roundSvg(innerEnd.x)} ${roundSvg(innerEnd.y)}`,
            `A ${roundSvg(innerRadius)} ${roundSvg(innerRadius)} 0 ${largeArc} 0 ${roundSvg(innerStart.x)} ${roundSvg(innerStart.y)}`,
            'Z'
        ].join(' ');
    }

    function bundledCirclePath(source, radius) {
        const cx = source.calibration.cx;
        const cy = source.calibration.cy;
        const r = Number(radius || 0);
        return [
            `M ${roundSvg(cx - r)} ${roundSvg(cy)}`,
            `A ${roundSvg(r)} ${roundSvg(r)} 0 1 0 ${roundSvg(cx + r)} ${roundSvg(cy)}`,
            `A ${roundSvg(r)} ${roundSvg(r)} 0 1 0 ${roundSvg(cx - r)} ${roundSvg(cy)}`,
            'Z'
        ].join(' ');
    }

    function bundledAngleDelta(start, end) {
        let delta = Number(end || 0) - Number(start || 0);
        while (delta < 0) delta += 360;
        return delta;
    }

    function parseBundledNumberList(text) {
        return String(text || '')
            .split(/[\n,;]+/)
            .map(part => part.trim())
            .filter(Boolean)
            .flatMap(part => {
                const range = part.match(/^(-?\d+(?:\.\d+)?)\s*\.\.\s*(-?\d+(?:\.\d+)?)(?:\s*\/\s*(-?\d+(?:\.\d+)?))?$/);
                if (!range) return [part];
                const start = Number(range[1]);
                const end = Number(range[2]);
                const step = Math.abs(Number(range[3]) || 1);
                const values = [];
                if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step) || step <= 0) return [];
                const dir = start <= end ? 1 : -1;
                for (let value = start; dir > 0 ? value <= end + 1e-9 : value >= end - 1e-9; value += step * dir) {
                    values.push(String(Math.round(value * 1000000) / 1000000));
                }
                return values;
            })
            .map(part => {
                const labelMatch = String(part).match(/^(-?\d+(?:\.\d+)?)\s*=\s*(.+)$/);
                const value = labelMatch ? Number(labelMatch[1]) : Number(part);
                const label = labelMatch ? labelMatch[2].trim() : String(part).trim();
                return Number.isFinite(value) ? { value, label } : null;
            })
            .filter(Boolean);
    }

    function parseBundledCalibration(text) {
        return String(text || '')
            .split(/[\n,;]+/)
            .map(part => part.trim())
            .filter(Boolean)
            .map(part => {
                const match = part.match(/^(-?\d+(?:\.\d+)?)\s*=\s*(-?\d+(?:\.\d+)?)$/);
                return match ? { value: Number(match[1]), angle: Number(match[2]) } : null;
            })
            .filter(item => item && Number.isFinite(item.value) && Number.isFinite(item.angle))
            .sort((a, b) => a.value - b.value);
    }

    function bundledValueAngle(scale, value) {
        const points = parseBundledCalibration(scale.calibrationText);
        if (points.length >= 2) {
            if (value <= points[0].value) return bundledExtrapolate(points[0], points[1], value);
            for (let i = 0; i < points.length - 1; i += 1) {
                const a = points[i];
                const b = points[i + 1];
                if (value >= a.value && value <= b.value) return bundledExtrapolate(a, b, value);
            }
            return bundledExtrapolate(points[points.length - 2], points[points.length - 1], value);
        }
        const min = Number(scale.min ?? 0);
        const max = Number(scale.max ?? 100);
        if (scale.mapping === 'log10' && value > 0 && min > 0 && max > min) {
            const span = Math.log10(max) - Math.log10(min);
            const t = span ? (Math.log10(value) - Math.log10(min)) / span : 0;
            return Number(scale.startAngle || 0) + (Number(scale.endAngle || 0) - Number(scale.startAngle || 0)) * t;
        }
        const t = max !== min ? (value - min) / (max - min) : 0;
        return Number(scale.startAngle || 0) + (Number(scale.endAngle || 0) - Number(scale.startAngle || 0)) * t;
    }

    function bundledExtrapolate(a, b, value) {
        const range = b.value - a.value;
        const t = range ? (value - a.value) / range : 0;
        return a.angle + (b.angle - a.angle) * t;
    }

    function bundledTickLength(scale, kind) {
        if (kind === 'major') return Number(scale.majorTick || 0);
        if (kind === 'medium') {
            const explicit = Number(scale.mediumTick);
            if (Number.isFinite(explicit)) return explicit;
            const minor = Number(scale.minorTick || 0);
            const major = Number(scale.majorTick || 0);
            return minor + (major - minor) * 0.55;
        }
        return Number(scale.minorTick || 0);
    }

    function tag(name, attrs = {}, content = '') {
        const attributes = Object.entries(attrs)
            .filter(([, value]) => value !== undefined && value !== null && value !== false)
            .map(([key, value]) => `${key}="${escapeSvgAttr(value)}"`)
            .join(' ');
        return `<${name}${attributes ? ` ${attributes}` : ''}>${content}</${name}>`;
    }

    function escapeSvgAttr(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function escapeSvgText(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function roundSvg(value) {
        return String(Math.round(Number(value || 0) * 100) / 100).replace(/\.00$/, '');
    }

    function clearWorkbenchSvg(container, cacheKey) {
        if (container) container.replaceChildren();
        if (cacheKey) {
            workbenchSvgCache[cacheKey] = '';
        }
    }

    function svgWithRuntimeStyle(svgText, cssText) {
        if (!cssText) return svgText;
        return String(svgText || '').replace(/(<svg\b[^>]*>)/i, `$1<style>${cssText}</style>`);
    }

    function prepareWorkbenchSvgText(svgText, cacheKey) {
        let prepared = String(svgText || '');
        if (cacheKey === 'windSlider') {
            prepared = svgWithRuntimeStyle(prepared, [
                'svg{overflow:visible;}',
                '.trace-preview-slider-surface{fill:#d2d8dc!important;fill-opacity:1!important;opacity:1!important;}'
            ].join(''));
        } else if (cacheKey === 'windRotorBack' || cacheKey === 'windRotorFront') {
            prepared = svgWithRuntimeStyle(prepared, 'svg{overflow:visible;}');
        }
        return prepared;
    }

    function shouldRenderWorkbenchSvgAsImage(cacheKey) {
        return embeddedMode && cacheKey === 'windSlider';
    }

    function injectWorkbenchSvgImage(container, svgText, cacheKey) {
        const img = document.createElement('img');
        img.className = 'e6b-workbench-render-image';
        img.alt = cacheKey === 'windSlider' ? 'E6B Wind Schieber' : 'E6B Grafik';
        img.decoding = 'async';
        img.draggable = false;
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
        container.replaceChildren(img);
        if (cacheKey) workbenchSvgCache[cacheKey] = svgText;
    }

    function injectWorkbenchSvg(container, svgText, cacheKey) {
        if (!container || typeof svgText !== 'string' || !svgText.trim()) return;
        const preparedSvg = prepareWorkbenchSvgText(svgText, cacheKey);
        if (cacheKey && workbenchSvgCache[cacheKey] === preparedSvg && container.childElementCount) return;
        if (shouldRenderWorkbenchSvgAsImage(cacheKey)) {
            injectWorkbenchSvgImage(container, preparedSvg, cacheKey);
            return;
        }
        container.innerHTML = preparedSvg;
        if (cacheKey) workbenchSvgCache[cacheKey] = preparedSvg;
        const svg = container.querySelector('svg');
        if (!svg) return;
        svg.classList.add('e6b-workbench-front-svg');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
    }

    function workbenchFrontOrigin(snapshot) {
        const viewBox = snapshot && snapshot.viewBox ? snapshot.viewBox : {};
        const width = Number(viewBox.width);
        const height = Number(viewBox.height);
        const cx = Number(viewBox.cx);
        const cy = Number(viewBox.cy);
        if (!Number.isFinite(width) || width <= 0
            || !Number.isFinite(height) || height <= 0
            || !Number.isFinite(cx) || !Number.isFinite(cy)) {
            return { x: 50, y: 50 };
        }

        let xRatio = cx / width;
        let yRatio = cy / height;
        const stack = qs('#e6bFrontStack');
        const rect = stack ? stack.getBoundingClientRect() : null;
        const elementAspect = rect && rect.width > 0 && rect.height > 0
            ? rect.width / rect.height
            : FRONT_VIEWBOX.width / FRONT_VIEWBOX.height;
        const viewAspect = width / height;
        if (Number.isFinite(elementAspect) && elementAspect > 0 && Number.isFinite(viewAspect) && viewAspect > 0) {
            if (elementAspect > viewAspect) {
                const usedWidthRatio = viewAspect / elementAspect;
                xRatio = (1 - usedWidthRatio) / 2 + xRatio * usedWidthRatio;
            } else if (elementAspect < viewAspect) {
                const usedHeightRatio = elementAspect / viewAspect;
                yRatio = (1 - usedHeightRatio) / 2 + yRatio * usedHeightRatio;
            }
        }

        return {
            x: clamp(xRatio * 100, 0, 100),
            y: clamp(yRatio * 100, 0, 100)
        };
    }

    function applyWorkbenchFrontOrigin(snapshot) {
        const rotor = qs('#e6bFrontRotor');
        if (!rotor) return;
        const origin = workbenchFrontOrigin(snapshot);
        rotor.style.setProperty('--e6b-front-origin-x', `${origin.x}%`);
        rotor.style.setProperty('--e6b-front-origin-y', `${origin.y}%`);
    }

    function applyWorkbenchFrontDisc(snapshot) {
        const fixed = qs('#e6bWorkbenchFrontFixed');
        const rotor = qs('#e6bWorkbenchFrontRotorArt');
        const valid = validWorkbenchFrontDisc(snapshot);

        document.body.classList.toggle('e6b-workbench-front-active', valid);
        document.body.classList.toggle('e6b-workbench-front-missing-active', !valid);
        activeWorkbenchFrontSnapshot = valid ? snapshot : null;

        if (!valid) {
            clearWorkbenchSvg(fixed, 'fixed');
            clearWorkbenchSvg(rotor, 'rotor');
            applyWorkbenchFrontOrigin(null);
            syncEmbeddedLocalChrome();
            return;
        }

        applyWorkbenchFrontOrigin(snapshot);
        injectWorkbenchSvg(fixed, snapshot.svgs.back, 'fixed');
        injectWorkbenchSvg(rotor, snapshot.svgs.front, 'rotor');
        syncEmbeddedLocalChrome();
    }

    function loadWorkbenchFrontDisc() {
        const saved = readWorkbenchFrontDisc();
        applyWorkbenchFrontDisc(validWorkbenchFrontDisc(saved) ? saved : bundledWorkbenchFrontDisc());
        fetchWorkbenchFrontDisc().then(snapshot => {
            if (validWorkbenchFrontDisc(snapshot)) applyWorkbenchFrontDisc(snapshot);
        });
    }

    function svgViewBoxFromText(svgText, fallback = {}) {
        const match = String(svgText || '').match(/\bviewBox=["']\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*["']/i);
        if (!match) return {
            minX: Number(fallback.minX) || 0,
            minY: Number(fallback.minY) || 0,
            width: Number(fallback.width) || 1,
            height: Number(fallback.height) || 1
        };
        return {
            minX: Number(match[1]) || 0,
            minY: Number(match[2]) || 0,
            width: Math.max(1, Number(match[3]) || 1),
            height: Math.max(1, Number(match[4]) || 1)
        };
    }

    function viewBoxPointToStackRatioForAspect(viewBox, x, y, elementAspect) {
        let xRatio = (Number(x) - Number(viewBox.minX || 0)) / Math.max(1, Number(viewBox.width || 1));
        let yRatio = (Number(y) - Number(viewBox.minY || 0)) / Math.max(1, Number(viewBox.height || 1));
        const viewAspect = Math.max(1, Number(viewBox.width || 1)) / Math.max(1, Number(viewBox.height || 1));
        if (elementAspect > viewAspect) {
            const usedWidthRatio = viewAspect / elementAspect;
            xRatio = (1 - usedWidthRatio) / 2 + xRatio * usedWidthRatio;
        } else if (elementAspect < viewAspect) {
            const usedHeightRatio = elementAspect / viewAspect;
            yRatio = (1 - usedHeightRatio) / 2 + yRatio * usedHeightRatio;
        }
        return {
            x: clamp(xRatio, 0, 1),
            y: clamp(yRatio, 0, 1)
        };
    }

    function viewBoxPointToStackRatio(viewBox, x, y) {
        return viewBoxPointToStackRatioForAspect(viewBox, x, y, WIND_VIEWBOX.width / WIND_VIEWBOX.height);
    }

    function frontDiscViewBox(snapshot) {
        const svgs = snapshot && snapshot.svgs ? snapshot.svgs : {};
        const fallback = snapshot && snapshot.viewBox ? snapshot.viewBox : {};
        return svgViewBoxFromText(svgs.back || svgs.front || '', {
            minX: 0,
            minY: 0,
            width: fallback.width || 1858,
            height: fallback.height || 2270
        });
    }

    function controlPointToStackRatio(side, snapshot, control) {
        if (!snapshot || !control) return null;
        const x = Number(control.x);
        const y = Number(control.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        if (side === 'wind') {
            return viewBoxPointToStackRatioForAspect(
                windRotorViewBox(snapshot),
                x,
                y,
                WIND_VIEWBOX.width / WIND_VIEWBOX.height
            );
        }
        return viewBoxPointToStackRatioForAspect(
            frontDiscViewBox(snapshot),
            x,
            y,
            FRONT_VIEWBOX.width / FRONT_VIEWBOX.height
        );
    }

    function windRotorViewBox(snapshot) {
        const svgs = snapshot && snapshot.svgs ? snapshot.svgs : {};
        const fallback = snapshot && snapshot.viewBox ? snapshot.viewBox : {};
        return svgViewBoxFromText(svgs.rotorFront || svgs.rotor || svgs.rotorBack || '', {
            minX: 0,
            minY: 0,
            width: fallback.width || 1872,
            height: fallback.height || 2231
        });
    }

    function windCalibrationPoint(calibration, radius, angle) {
        const radians = (Number(angle || 0) + Number(calibration.rotation || 0)) * Math.PI / 180;
        return {
            x: Number(calibration.cx || 0) + Math.cos(radians) * Number(radius || 0),
            y: Number(calibration.cy || 0) + Math.sin(radians) * Number(radius || 0)
        };
    }

    function windStackPointFromWorkbench(snapshot, point) {
        const ratio = viewBoxPointToStackRatio(windRotorViewBox(snapshot), point.x, point.y);
        return {
            x: ratio.x * WIND_VIEWBOX.width,
            y: ratio.y * WIND_VIEWBOX.height
        };
    }

    function applyWorkbenchWindGeometry(snapshot) {
        const rotor = qs('#e6bWindRotor');
        const cal = snapshot && snapshot.wind && (snapshot.wind.rotorFrontCalibration || snapshot.wind.rotorCalibration);
        if (!cal) return;
        const center = windStackPointFromWorkbench(snapshot, { x: Number(cal.cx || 0), y: Number(cal.cy || 0) });
        state.windCenterX = center.x;
        state.windCenterY = center.y;
        if (rotor) {
            rotor.style.setProperty('--e6b-wind-origin-x', `${center.x / WIND_VIEWBOX.width * 100}%`);
            rotor.style.setProperty('--e6b-wind-origin-y', `${center.y / WIND_VIEWBOX.height * 100}%`);
        }
        if (!windDotUserSet && snapshot.wind.markedPoint) {
            const sourcePoint = windCalibrationPoint(cal, snapshot.wind.markedPoint.radius, snapshot.wind.markedPoint.angle);
            const dot = windStackPointFromWorkbench(snapshot, sourcePoint);
            state.windDotX = clamp(dot.x, 0, WIND_VIEWBOX.width);
            state.windDotY = clamp(dot.y, 0, WIND_VIEWBOX.height);
        }
    }

    function applyWorkbenchWindDisc(snapshot) {
        const slider = qs('#e6bWindSlider');
        const rotorBack = qs('#e6bWorkbenchWindRotorBack');
        const rotorFront = qs('#e6bWorkbenchWindRotorArt');
        const valid = validWorkbenchWindDisc(snapshot);

        document.body.classList.toggle('e6b-workbench-wind-active', valid);
        document.body.classList.toggle('e6b-workbench-wind-missing-active', !valid);
        activeWorkbenchWindSnapshot = valid ? snapshot : null;

        if (!valid) {
            clearWorkbenchSvg(slider, 'windSlider');
            clearWorkbenchSvg(rotorBack, 'windRotorBack');
            clearWorkbenchSvg(rotorFront, 'windRotorFront');
            state.windCenterX = WIND_VIEWBOX.cx;
            state.windCenterY = WIND_VIEWBOX.cy;
            applyRotations();
            syncEmbeddedLocalChrome();
            return;
        }

        const svgs = snapshot.svgs || {};
        injectWorkbenchSvg(slider, svgs.slider, 'windSlider');
        injectWorkbenchSvg(rotorBack, svgs.rotorBack || svgs.back || '', 'windRotorBack');
        injectWorkbenchSvg(rotorFront, svgs.rotorFront || svgs.rotor || '', 'windRotorFront');
        applyWorkbenchWindGeometry(snapshot);
        applyRotations();
        syncEmbeddedLocalChrome();
    }

    function loadWorkbenchWindDisc() {
        const saved = readWorkbenchWindDisc();
        if (validWorkbenchWindDisc(saved)) applyWorkbenchWindDisc(saved);
        fetchWorkbenchWindDisc().then(snapshot => {
            if (validWorkbenchWindDisc(snapshot)) applyWorkbenchWindDisc(snapshot);
            else if (!validWorkbenchWindDisc(saved)) applyWorkbenchWindDisc(null);
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
        const windSliderCenterY = state.windCenterY - state.windSlideY;
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
            windRotor.style.setProperty('--e6b-wind-origin-x', `${state.windCenterX / WIND_VIEWBOX.width * 100}%`);
            windRotor.style.setProperty('--e6b-wind-origin-y', `${state.windCenterY / WIND_VIEWBOX.height * 100}%`);
        }
        if (windSlider) windSlider.style.setProperty('--e6b-wind-slide-y', `${state.windSlideY / WIND_VIEWBOX.height * 100}%`);
        if (windDot) {
            windDot.style.setProperty('--e6b-wind-dot-x', `${state.windDotX / WIND_VIEWBOX.width * 100}%`);
            windDot.style.setProperty('--e6b-wind-dot-y', `${state.windDotY / WIND_VIEWBOX.height * 100}%`);
        }
    }

    function scheduleRotationRender() {
        if (rotationFramePending) return;
        rotationFramePending = true;
        requestAnimationFrame(() => {
            rotationFramePending = false;
            applyRotations();
            updateReadouts();
        });
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
        scheduleRotationRender();
        syncEmbeddedLocalChrome();
        scheduleEmbeddedViewStatePost();
    }

    function setSide(side) {
        state.side = side === 'wind' ? 'wind' : 'front';
        clearWindCursor(qs('#e6bWindStack'));
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

    function pointerAngleFromClient(stack, clientX, clientY, rect = stack.getBoundingClientRect()) {
        const centerX = stack.dataset.dial === 'wind' ? state.windCenterX / WIND_VIEWBOX.width * rect.width : rect.width / 2;
        const centerY = stack.dataset.dial === 'wind' ? state.windCenterY / WIND_VIEWBOX.height * rect.height : rect.height / 2;
        const x = clientX - rect.left - centerX;
        const y = centerY - (clientY - rect.top);
        return Math.atan2(x, y) * 180 / Math.PI;
    }

    function pointerAngle(stack, event) {
        return pointerAngleFromClient(stack, event.clientX, event.clientY);
    }

    function windSvgPointFromClient(stack, clientX, clientY, rect = stack.getBoundingClientRect()) {
        return {
            x: core.clamp((clientX - rect.left) / rect.width * WIND_VIEWBOX.width, 0, WIND_VIEWBOX.width),
            y: core.clamp((clientY - rect.top) / rect.height * WIND_VIEWBOX.height, 0, WIND_VIEWBOX.height)
        };
    }

    function windSvgPointFromEvent(stack, event) {
        return windSvgPointFromClient(stack, event.clientX, event.clientY);
    }

    function rotateWindPoint(point, degrees) {
        const radians = degrees * Math.PI / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const dx = point.x - state.windCenterX;
        const dy = point.y - state.windCenterY;
        return {
            x: state.windCenterX + dx * cos - dy * sin,
            y: state.windCenterY + dx * sin + dy * cos
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
        return Math.hypot(point.x - state.windCenterX, point.y - state.windCenterY);
    }

    function isWindSliderHit(stack, event) {
        const point = windSvgPointFromEvent(stack, event);
        const radius = windRotorRadiusFromEvent(stack, event);
        return point.x >= WIND_SLIDER_HIT.minX
            && point.x <= WIND_SLIDER_HIT.maxX
            && radius > WIND_SLIDER_HIT.sliderClearance;
    }

    function isWindDotSetArea(stack, event) {
        if (!stack || stack.dataset.dial !== 'wind' || state.side !== 'wind') return false;
        const point = windSvgPointFromEvent(stack, event);
        const radius = windRotorRadiusFromEvent(stack, event);
        return point.x >= 0
            && point.x <= WIND_VIEWBOX.width
            && point.y >= 0
            && point.y <= WIND_VIEWBOX.height
            && radius <= WIND_SLIDER_HIT.compassClearance;
    }

    function isWindViewPanHit(stack, event) {
        if (!viewTransformMode || !stack || stack.dataset.dial !== 'wind' || state.side !== 'wind') return false;
        const radius = windRotorRadiusFromEvent(stack, event);
        if (radius >= WIND_SLIDER_HIT.panInnerRadius && radius <= WIND_SLIDER_HIT.panOuterRadius) return true;
        return false;
    }

    function isFrontViewPanHit(stack, event) {
        if (!viewTransformMode || !stack || stack.dataset.dial !== 'front' || state.side !== 'front') return false;
        const rect = stack.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2;
        const y = event.clientY - rect.top - rect.height / 2;
        const radius = Math.hypot(x, y);
        const reference = Math.max(1, Math.min(rect.width, rect.height));
        return radius >= reference * 0.36 && radius <= reference * 0.58;
    }

    function clearWindCursor(stack) {
        if (!stack) return;
        stack.classList.remove('wind-dot-cursor', 'view-pan-cursor', 'wind-slider-cursor', 'wind-rotate-cursor');
    }

    function updateWindCursor(stack, event) {
        if (!stack || event.pointerType !== 'mouse' || drag || viewGesture || viewPointers.size) {
            clearWindCursor(stack);
            return;
        }
        const panHit = isFrontViewPanHit(stack, event) || isWindViewPanHit(stack, event);
        const sliderHit = stack.dataset.dial === 'wind' && isWindSliderHit(stack, event);
        const rotateHit = stack.dataset.dial === 'wind'
            && !panHit
            && !sliderHit
            && windRotorRadiusFromEvent(stack, event) > WIND_SLIDER_HIT.compassClearance
            && windRotorRadiusFromEvent(stack, event) <= WIND_SLIDER_HIT.panInnerRadius;
        stack.classList.toggle('view-pan-cursor', panHit);
        stack.classList.toggle('wind-slider-cursor', sliderHit);
        stack.classList.toggle('wind-rotate-cursor', rotateHit);
        stack.classList.toggle('wind-dot-cursor', isWindDotSetArea(stack, event) && !panHit && !sliderHit);
    }

    function setWindDotFromPointer(stack, event) {
        const rotorPoint = windRotorPointFromEvent(stack, event);
        state.windDotX = core.clamp(rotorPoint.x, 0, WIND_VIEWBOX.width);
        state.windDotY = core.clamp(rotorPoint.y, 0, WIND_VIEWBOX.height);
        windDotUserSet = true;
        applyRotations();
    }

    function windSlideDeltaFromClient(stack, clientY) {
        const rect = drag && drag.rect ? drag.rect : stack.getBoundingClientRect();
        return (clientY - drag.startClientY) / rect.height * WIND_VIEWBOX.height;
    }

    function clampWindSlide(slideY) {
        return core.clamp(slideY, WIND_SLIDE_LIMITS.min, WIND_SLIDE_LIMITS.max);
    }

    function startDrag(stack, event) {
        if (event.button !== undefined && event.button !== 0) return;
        clearWindCursor(stack);
        const kind = stack.dataset.dial;
        const rect = stack.getBoundingClientRect();
        let action = kind === 'front' ? 'front-rotate' : 'wind-rotate';
        if (kind === 'front' && isFrontViewPanHit(stack, event)) {
            action = 'view-pan';
        } else if (kind === 'wind' && isWindSliderHit(stack, event)) {
            action = 'wind-slide';
        } else if (kind === 'wind' && isWindViewPanHit(stack, event)) {
            action = 'view-pan';
        }
        const token = ++dragSequence;
        drag = {
            token,
            stack,
            rect,
            kind,
            action,
            startAngle: pointerAngleFromClient(stack, event.clientX, event.clientY, rect),
            startRotation: kind === 'wind' ? state.windRotation : state.frontRotation,
            startSlideY: state.windSlideY,
            startViewX: viewState.x,
            startViewY: viewState.y,
            startViewScale: viewState.scale,
            startClientX: event.clientX,
            startClientY: event.clientY,
            lastClientX: event.clientX,
            lastClientY: event.clientY,
            moved: false
        };
        stack.setPointerCapture(event.pointerId);
        event.preventDefault();
    }

    function applyDragMove(stack) {
        if (!drag) return;
        const activeStack = drag.stack || stack;
        const clientX = drag.lastClientX;
        const clientY = drag.lastClientY;
        const movement = Math.hypot(clientX - drag.startClientX, clientY - drag.startClientY);
        if (!drag.moved && movement < CLICK_MOVE_THRESHOLD_PX) return;
        drag.moved = true;
        if (drag.action === 'wind-slide') {
            state.windSlideY = clampWindSlide(drag.startSlideY + windSlideDeltaFromClient(activeStack, clientY));
        } else if (drag.action === 'view-pan') {
            setViewTransform(
                drag.startViewScale,
                drag.startViewX + clientX - drag.startClientX,
                drag.startViewY + clientY - drag.startClientY
            );
            return;
        } else if (drag.action === 'wind-rotate') {
            const delta = pointerAngleFromClient(activeStack, clientX, clientY, drag.rect) - drag.startAngle;
            state.windRotation = drag.startRotation + delta;
        } else {
            const delta = pointerAngleFromClient(activeStack, clientX, clientY, drag.rect) - drag.startAngle;
            state.frontRotation = drag.startRotation + delta;
        }
        applyRotations();
        updateReadouts();
    }

    function flushDragMove(stack, token) {
        if (!drag || drag.token !== token) return;
        dragFramePending = false;
        applyDragMove(stack);
    }

    function moveDrag(stack, event) {
        if (!drag) return;
        drag.lastClientX = event.clientX;
        drag.lastClientY = event.clientY;
        if (!dragFramePending) {
            dragFramePending = true;
            const token = drag.token;
            requestAnimationFrame(() => flushDragMove(stack, token));
        }
        event.preventDefault();
    }

    function stopDrag(stack, event, allowClick = true) {
        if (!drag) return;
        if (event) {
            drag.lastClientX = event.clientX;
            drag.lastClientY = event.clientY;
            applyDragMove(stack);
        }
        if (allowClick && drag.action === 'wind-rotate' && !drag.moved) {
            setWindDotFromPointer(stack, event);
        }
        if (event) releasePointerCapture(stack, event.pointerId);
        drag = null;
        dragFramePending = false;
        if (event) updateWindCursor(stack, event);
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
        if (!drag) updateWindCursor(stack, event);
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

    function wheelDeltaPixels(event) {
        if (event.deltaMode === 1) return event.deltaY * 16;
        if (event.deltaMode === 2) return event.deltaY * Math.max(window.innerHeight, 1);
        return event.deltaY;
    }

    function handleViewWheel(event) {
        if (!viewTransformMode) return;
        const directWheelZoom = embeddedMode;
        if (!directWheelZoom && !event.ctrlKey && !event.metaKey) return;
        const stage = qs('.e6b-stage');
        const rect = stage ? stage.getBoundingClientRect() : {
            left: 0,
            top: 0,
            width: Math.max(window.innerWidth, 1),
            height: Math.max(window.innerHeight, 1)
        };
        const beforeScale = viewState.scale || 1;
        const zoomFactor = Math.exp(-wheelDeltaPixels(event) * 0.0025);
        const limits = embeddedMode ? EMBEDDED_VIEW_SCALE : PREVIEW_VIEW_SCALE;
        const nextScale = clamp(beforeScale * zoomFactor, limits.min, limits.max);
        const anchorX = event.clientX - rect.left - rect.width / 2;
        const anchorY = event.clientY - rect.top - rect.height / 2;
        const localX = (anchorX - viewState.x) / beforeScale;
        const localY = (anchorY - viewState.y) / beforeScale;
        const nextX = anchorX - localX * nextScale;
        const nextY = anchorY - localY * nextScale;
        setViewTransform(nextScale, nextX, nextY);
        event.preventDefault();
    }

    function zoomViewByFactor(factor) {
        const nextFactor = Number(factor);
        if (!Number.isFinite(nextFactor) || nextFactor <= 0) return;
        setViewTransform(viewState.scale * nextFactor, viewState.x, viewState.y);
    }

    function postCloseRequestToParent() {
        if (!embeddedMode || !window.parent || window.parent === window) return;
        try {
            window.parent.postMessage({ type: 'ga-e6b-close' }, '*');
        } catch (_) {}
    }

    function handleEmbeddedControlClick(event) {
        const button = event.currentTarget;
        const action = button ? button.dataset.e6bControl : '';
        if (action === 'flip') toggleSide();
        if (action === 'zoomOut') zoomViewByFactor(0.86);
        if (action === 'zoomIn') zoomViewByFactor(1.16);
        if (action === 'close') postCloseRequestToParent();
        event.preventDefault();
        event.stopPropagation();
    }

    function bindEmbeddedChromeControls() {
        if (!embeddedMode) return;
        qsa('[data-e6b-control]').forEach(button => {
            if (button.dataset.bound === '1') return;
            button.addEventListener('click', handleEmbeddedControlClick);
            button.dataset.bound = '1';
        });
        syncEmbeddedLocalChrome();
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
            stack.addEventListener('pointerleave', () => clearWindCursor(stack));
        });
        const stage = qs('.e6b-stage');
        if (stage) stage.addEventListener('wheel', handleViewWheel, { passive: false });
        window.addEventListener('resize', () => setViewTransform(viewState.scale, viewState.x, viewState.y));
        if (!embeddedMode) {
            window.addEventListener('focus', () => {
                loadWorkbenchFrontDisc();
                loadWorkbenchWindDisc();
            });
        }
        window.addEventListener('storage', event => {
            if (event.key === WORKBENCH_FRONT_STORAGE_KEY) loadWorkbenchFrontDisc();
            if (event.key === WORKBENCH_WIND_STORAGE_KEY) loadWorkbenchWindDisc();
        });
        window.addEventListener('message', event => {
            const data = event && event.data;
            if (!data || typeof data !== 'object') return;
            if (data.type === 'ga-e6b-toggle-side') toggleSide();
            if (data.type === 'ga-e6b-set-side') setSide(data.side);
            if (data.type === 'ga-e6b-set-base-size') setEmbeddedBaseSize(data.frontWidth, data.windWidth);
            if (data.type === 'ga-e6b-reset-view') setViewTransform(1, 0, 0);
            if (data.type === 'ga-e6b-set-view') {
                setViewTransform(Number(data.scale) || 1, Number(data.x) || 0, Number(data.y) || 0);
            }
            if (data.type === 'ga-e6b-pan-view') {
                setViewTransform(viewState.scale, viewState.x + Number(data.dx || 0), viewState.y + Number(data.dy || 0));
            }
            if (data.type === 'ga-e6b-zoom-view') zoomViewByFactor(data.factor);
            if (data.type === 'ga-e6b-report-view') scheduleEmbeddedViewStatePost();
        });
        bindWindowPlanControls();
        bindScalePlanControls();
        bindPreviewControls();
        bindEmbeddedChromeControls();
    }

    function init() {
        loadWorkbenchFrontDisc();
        loadWorkbenchWindDisc();
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
