(function() {
    'use strict';

    const STORAGE_KEY = 'ga-e6b-trace-workbench-v1';
    const HISTORY_KEY = 'ga-e6b-trace-workbench-history-v1';
    const PUBLISHED_FRONT_STORAGE_KEY = 'ga-e6b-workbench-front-disc-v1';
    const PUBLISHED_WIND_STORAGE_KEY = 'ga-e6b-workbench-wind-disc-v1';
    const PUBLISHED_FRONT_ENDPOINT = '/api/e6b/front-disc';
    const PUBLISHED_WIND_ENDPOINT = '/api/e6b/wind-disc';
    const DEFAULT_FRONT_CALIBRATION = { cx: 929, cy: 1210, radius: 865, innerRadius: 0, rotation: 0, outlineWidth: 5, innerOutlineWidth: 5, cornerRadius: 0, fillOpacity: 1 };
    const DEFAULT_WIND_ROTOR_BACK_CALIBRATION = { cx: 936, cy: 1055, radius: 790, innerRadius: 0, rotation: 0, outlineWidth: 5, innerOutlineWidth: 5, cornerRadius: 0, fillOpacity: 1 };
    const DEFAULT_WIND_ROTOR_FRONT_CALIBRATION = { cx: 936, cy: 1055, radius: 650, innerRadius: 525, rotation: 0, outlineWidth: 5, innerOutlineWidth: 5, cornerRadius: 0, fillOpacity: 0 };
    const DEFAULT_WIND_SLIDER_CALIBRATION = { cx: 716, cy: 3820, radius: 3350, innerRadius: 0, rotation: 0, outlineWidth: 2, innerOutlineWidth: 2, cornerRadius: 42, fillOpacity: 0.72 };
    const WIND_SLIDER_AXIS_ANGLE = -90;
    const WIND_SLIDER_LEFT_ANGLE = -150;
    const WIND_SLIDER_RIGHT_ANGLE = -30;
    const WIND_SLIDER_MIN_RADIUS_VALUE = 30;
    const WIND_SLIDER_MAX_RADIUS_VALUE = 270;
    const WIND_SLIDER_UNIT_SCALE = 10;
    const HISTORY_LIMIT = 50;
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const SCAN_PRESETS = {
        front: {
            label: 'Vorderseite Scan',
            workface: 'front',
            src: './e6b-assets/scans/e6b-front-scan-original.jpeg?v=20260707-01',
            width: 1858,
            height: 2270,
            calibration: DEFAULT_FRONT_CALIBRATION
        },
        'wind-rotor': {
            label: 'Rueckseite Drehscheibe',
            workface: 'wind-rotor',
            src: './e6b-assets/scans/e6b-wind-rotor-scan.jpeg?v=20260708-01',
            width: 1872,
            height: 2231,
            calibration: DEFAULT_WIND_ROTOR_BACK_CALIBRATION
        },
        'wind-slider': {
            label: 'Rueckseite Schieber',
            workface: 'wind-slider',
            src: './e6b-assets/scans/e6b-wind-slider-scan.jpeg?v=20260708-01',
            width: 1431,
            height: 3600,
            calibration: DEFAULT_WIND_SLIDER_CALIBRATION
        }
    };
    const DEFAULT_IMAGE = SCAN_PRESETS.front.src;
    const DEFAULT_SIZE = { width: SCAN_PRESETS.front.width, height: SCAN_PRESETS.front.height };
    const SCAN_ALIGNMENT_KEYS = ['front', 'wind-rotor', 'wind-slider', 'custom'];
    const SURFACE_OPTIONS = new Set(['back', 'front', 'wind-slider', 'wind-rotor-back', 'wind-rotor-front']);
    const LEGACY_SURFACE_ALIASES = {
        'wind-rotor': 'wind-rotor-front'
    };
    const SURFACE_LABELS = {
        back: 'Vorderseite: Hintergrundscheibe',
        front: 'Vorderseite: Frontscheibe',
        'wind-slider': 'Wind Schieber',
        'wind-rotor-back': 'Rückseite: hintere Scheibe',
        'wind-rotor-front': 'Rückseite: Frontscheibe'
    };
    const CALIBRATION_INPUT_KEYS = {
        calCx: 'cx',
        calCy: 'cy',
        calRadius: 'radius',
        calInnerRadius: 'innerRadius',
        calRotation: 'rotation',
        calOutlineWidth: 'outlineWidth',
        calInnerOutlineWidth: 'innerOutlineWidth',
        calCornerRadius: 'cornerRadius',
        calFillOpacity: 'fillOpacity'
    };
    const HELPER_INPUT_KEYS = {
        helperRadialAngle: 'angle'
    };
    const SCAN_ALIGNMENT_INPUT_KEYS = {
        scanOffsetX: 'x',
        scanOffsetY: 'y',
        scanRotation: 'rotation'
    };
    const PREVIEW_INPUT_KEYS = {
        previewFrontRadius: 'frontRadius'
    };
    const WIND_PREVIEW_INPUT_KEYS = {
        previewWindRotation: 'windRotation',
        previewSliderY: 'sliderY'
    };
    const DEFAULT_TYPOGRAPHY = {
        fontFamily: 'Arial',
        fontWeight: 'normal',
        fontWidth: 'normal'
    };
    const FONT_WEIGHT_VALUES = new Set(['normal', 'bold']);
    const FONT_WIDTH_VALUES = new Set(['normal', 'narrow']);
    const EDITOR_NUMERIC_KEYS = {
        editRadius: 'radius',
        editLabelRadius: 'labelRadius',
        editStartAngle: 'startAngle',
        editEndAngle: 'endAngle',
        editInnerRadius: 'innerRadius',
        editOuterRadius: 'outerRadius',
        editMinorTick: 'minorTick',
        editMediumTick: 'mediumTick',
        editMajorTick: 'majorTick',
        editThinLineWidth: 'thinLineWidth',
        editMediumLineWidth: 'mediumLineWidth',
        editThickLineWidth: 'thickLineWidth',
        editStrokeWidth: 'strokeWidth',
        editStrokeOpacity: 'strokeOpacity',
        editFillOpacity: 'fillOpacity',
        editFontSize: 'fontSize',
        editTextRotation: 'textRotation',
        editTextOffsetX: 'textOffsetX',
        editTextOffsetY: 'textOffsetY',
        editLabelAngleOffset: 'labelAngleOffset',
        editIndexLength: 'indexLength',
        editIndexWidth: 'indexWidth',
        editStemLength: 'stemLength'
    };
    const ELEMENT_EDITOR_FIELD_IDS = [
        'editLabel',
        'editType',
        'editDisc',
        'editRadius',
        'editLabelRadius',
        'editStartAngle',
        'editEndAngle',
        'editInnerRadius',
        'editOuterRadius',
        'editMinorTick',
        'editMediumTick',
        'editMajorTick',
        'editThinLineWidth',
        'editMediumLineWidth',
        'editThickLineWidth',
        'editStrokeWidth',
        'editStrokeOpacity',
        'editFillOpacity',
        'editFontSize',
        'editFontFamily',
        'editFontWidth',
        'editFontWeight',
        'editTextRotation',
        'editTextOffsetX',
        'editTextOffsetY',
        'editTextOrientation',
        'editLabelAngleOffset',
        'editIndexLength',
        'editIndexWidth',
        'editStemLength',
        'editValues',
        'editMediumValues',
        'editMinorValues',
        'editCalibration'
    ];
    const INDEX_PATTERN_SKIP_IDS = new Set(['idx-rate-60']);
    const CONTROL_ANCHOR_ACTIONS = new Set(['move', 'flip', 'zoomIn', 'zoomOut', 'close']);
    const CONTROL_ANCHOR_ALIASES = {
        drag: 'move',
        handle: 'move',
        move: 'move',
        pan: 'move',
        verschieben: 'move',
        flip: 'flip',
        turn: 'flip',
        umdrehen: 'flip',
        rotate: 'flip',
        plus: 'zoomIn',
        '+': 'zoomIn',
        zoomin: 'zoomIn',
        'zoom-in': 'zoomIn',
        minus: 'zoomOut',
        '-': 'zoomOut',
        '−': 'zoomOut',
        zoomout: 'zoomOut',
        'zoom-out': 'zoomOut',
        close: 'close',
        schliessen: 'close',
        schließen: 'close',
        x: 'close'
    };
    const STANDARD_INDEX_PATTERN = {
        fontSize: 40,
        textRotation: 52.2,
        textOrientation: 'arc',
        indexLength: 20,
        indexWidth: 30,
        stemLength: 20
    };
    const INDEX_TEXT_BY_ID = {
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
    const state = {
        image: {
            src: DEFAULT_IMAGE,
            width: DEFAULT_SIZE.width,
            height: DEFAULT_SIZE.height,
            opacity: 0.72,
            overlayOpacity: 1,
            showScan: true,
            showOverlay: true,
            showCalibrationMarkers: true
        },
        calibration: { ...DEFAULT_FRONT_CALIBRATION },
        view: {
            zoom: 1,
            panX: 0,
            panY: 0
        },
        guide: {
            show: false,
            angle: -90
        },
        preview: {
            frontRotation: 0,
            backRotation: 0,
            frontRadius: 0,
            windRotation: 0,
            sliderY: 0
        },
        wind: {
            rotorBackCalibration: { ...DEFAULT_WIND_ROTOR_BACK_CALIBRATION },
            rotorFrontCalibration: { ...DEFAULT_WIND_ROTOR_FRONT_CALIBRATION },
            sliderCalibration: { ...DEFAULT_WIND_SLIDER_CALIBRATION },
            circlePoints: [],
            markedPoint: { radius: 120, angle: -90 }
        },
        scanAlignment: defaultScanAlignmentState(),
        typography: { ...DEFAULT_TYPOGRAPHY },
        workface: 'front',
        calibrationSurface: 'front',
        mode: 'edit',
        selectedId: 'outer-slide-rule',
        pickMode: '',
        elements: []
    };

    let drag = null;
    let undoStack = [];
    let redoStack = [];
    let renderCalibrationOverride = null;

    function qs(selector) {
        return document.querySelector(selector);
    }

    function qsa(selector) {
        return Array.from(document.querySelectorAll(selector));
    }

    function clamp(value, min, max) {
        const number = Number(value);
        if (!Number.isFinite(number)) return min;
        return Math.min(max, Math.max(min, number));
    }

    function uid(prefix) {
        return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function degToRad(degrees) {
        return degrees * Math.PI / 180;
    }

    function normalizeAngle(angle) {
        let next = Number(angle) || 0;
        while (next <= -180) next += 360;
        while (next > 180) next -= 360;
        return next;
    }

    function rangeInclusive(start, end, step) {
        const values = [];
        if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step) || step === 0) return values;
        const direction = end >= start ? 1 : -1;
        const delta = Math.abs(step) * direction;
        for (let value = start; direction > 0 ? value <= end + 1e-9 : value >= end - 1e-9; value += delta) {
            values.push(round(value));
        }
        return values;
    }

    function windSliderRadius(value) {
        return Number(value || 0) * WIND_SLIDER_UNIT_SCALE;
    }

    function mirrorAngleAround(angle, axis = WIND_SLIDER_AXIS_ANGLE) {
        return normalizeAngle(Number(axis || 0) * 2 - Number(angle || 0));
    }

    function defaultScanAlignment() {
        return { x: 0, y: 0, rotation: 0 };
    }

    function defaultScanAlignmentState() {
        return SCAN_ALIGNMENT_KEYS.reduce((result, key) => {
            result[key] = defaultScanAlignment();
            return result;
        }, {});
    }

    function normalizeSurface(value) {
        const raw = String(value || '');
        const surface = LEGACY_SURFACE_ALIASES[raw] || raw;
        return SURFACE_OPTIONS.has(surface) ? surface : '';
    }

    function elementSurface(element) {
        const surface = normalizeSurface(element && (element.surface || element.disc));
        if (surface) return surface;
        return element && element.disc === 'back' ? 'back' : 'front';
    }

    function surfaceWorkface(surface) {
        const normalized = normalizeSurface(surface);
        if (normalized === 'wind-slider') return 'wind-slider';
        if (normalized === 'wind-rotor-back' || normalized === 'wind-rotor-front') return 'wind-rotor';
        return 'front';
    }

    function defaultCalibrationSurfaceForWorkface(workface = state.workface) {
        if (workface === 'wind-slider') return 'wind-slider';
        if (workface === 'wind-rotor') return 'wind-rotor-front';
        return 'front';
    }

    function normalizeCalibrationSurface(surface, workface = state.workface) {
        const normalized = normalizeSurface(surface);
        const allowed = workfaceSurfaces(workface);
        if (allowed.includes(normalized)) return normalized;
        return defaultCalibrationSurfaceForWorkface(workface);
    }

    function ensureCalibrationSurface() {
        state.calibrationSurface = normalizeCalibrationSurface(state.calibrationSurface);
    }

    function activeSurface() {
        return normalizeCalibrationSurface(state.calibrationSurface);
    }

    function isWindWorkface() {
        return state.workface === 'wind-slider' || state.workface === 'wind-rotor';
    }

    function frontSaveAllowed() {
        const preset = scanPresetForCurrentImage();
        return state.workface === 'front' && (!preset || preset === 'front');
    }

    function windSaveAllowed() {
        return isWindWorkface();
    }

    function frontElementActionsAllowed() {
        return state.workface === 'front';
    }

    function windElementActionsAllowed() {
        return isWindWorkface();
    }

    function calibrationForSurface(surface) {
        const normalized = normalizeSurface(surface);
        if (normalized === 'wind-slider') return state.wind.sliderCalibration;
        if (normalized === 'wind-rotor-back') return state.wind.rotorBackCalibration;
        if (normalized === 'wind-rotor-front') return state.wind.rotorFrontCalibration;
        return state.calibration;
    }

    function activeCalibration() {
        return renderCalibrationOverride || calibrationForSurface(activeSurface());
    }

    function withCalibration(calibration, callback) {
        const previous = renderCalibrationOverride;
        renderCalibrationOverride = calibration;
        try {
            return callback();
        } finally {
            renderCalibrationOverride = previous;
        }
    }

    function readableRotation(angle) {
        let next = normalizeAngle(angle);
        if (next > 90) next -= 180;
        if (next < -90) next += 180;
        return next;
    }

    function polarPoint(radius, angle) {
        const cal = activeCalibration();
        const radians = degToRad(Number(angle || 0) + Number(cal.rotation || 0));
        return {
            x: cal.cx + Math.cos(radians) * radius,
            y: cal.cy + Math.sin(radians) * radius
        };
    }

    function angleFromPoint(point) {
        const cal = activeCalibration();
        return normalizeAngle(Math.atan2(point.y - cal.cy, point.x - cal.cx) * 180 / Math.PI - cal.rotation);
    }

    function radiusFromPoint(point) {
        const cal = activeCalibration();
        return Math.hypot(point.x - cal.cx, point.y - cal.cy);
    }

    function circleFromThreePoints(points) {
        if (!Array.isArray(points) || points.length < 3) return null;
        const [a, b, c] = points;
        const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
        if (Math.abs(d) < 1e-6) return null;
        const a2 = a.x * a.x + a.y * a.y;
        const b2 = b.x * b.x + b.y * b.y;
        const c2 = c.x * c.x + c.y * c.y;
        const cx = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
        const cy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
        const radius = Math.hypot(a.x - cx, a.y - cy);
        if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(radius)) return null;
        return { cx: round(cx), cy: round(cy), radius: round(radius) };
    }

    function angleDelta(start, end) {
        let delta = Number(end || 0) - Number(start || 0);
        while (delta < 0) delta += 360;
        return delta;
    }

    function arcPath(radius, startAngle, endAngle) {
        const start = polarPoint(radius, startAngle);
        const end = polarPoint(radius, endAngle);
        const largeArc = angleDelta(startAngle, endAngle) > 180 ? 1 : 0;
        return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
    }

    function textArcPath(radius, startAngle, endAngle, reverse = false) {
        const start = polarPoint(radius, reverse ? endAngle : startAngle);
        const end = polarPoint(radius, reverse ? startAngle : endAngle);
        const delta = angleDelta(startAngle, endAngle);
        const largeArc = delta > 180 ? 1 : 0;
        const sweep = reverse ? 0 : 1;
        return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 ${largeArc} ${sweep} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
    }

    function sectorPath(innerRadius, outerRadius, startAngle, endAngle) {
        const outerStart = polarPoint(outerRadius, startAngle);
        const outerEnd = polarPoint(outerRadius, endAngle);
        const innerEnd = polarPoint(innerRadius, endAngle);
        const innerStart = polarPoint(innerRadius, startAngle);
        const largeArc = angleDelta(startAngle, endAngle) > 180 ? 1 : 0;
        return [
            `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
            `A ${outerRadius.toFixed(2)} ${outerRadius.toFixed(2)} 0 ${largeArc} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
            `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
            `A ${innerRadius.toFixed(2)} ${innerRadius.toFixed(2)} 0 ${largeArc} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
            'Z'
        ].join(' ');
    }

    function circlePath(radius) {
        const cal = activeCalibration();
        const r = Number(radius || 0);
        return [
            `M ${(cal.cx - r).toFixed(2)} ${cal.cy.toFixed(2)}`,
            `A ${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(cal.cx + r).toFixed(2)} ${cal.cy.toFixed(2)}`,
            `A ${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${(cal.cx - r).toFixed(2)} ${cal.cy.toFixed(2)}`,
            'Z'
        ].join(' ');
    }

    function indexGeometry(element) {
        const angle = Number(element.startAngle || 0);
        const radius = Number(element.radius || 0);
        const length = Number(element.indexLength ?? element.majorTick ?? 62);
        const width = Number(element.indexWidth ?? element.minorTick ?? 38);
        const stemLength = Number(element.stemLength || 0);
        const tip = polarPoint(radius, angle);
        const base = polarPoint(radius + length, angle);
        const stemEnd = polarPoint(radius + length + stemLength, angle);
        const radians = degToRad(angle + Number(activeCalibration().rotation || 0));
        const perp = { x: -Math.sin(radians), y: Math.cos(radians) };
        const halfWidth = Math.abs(width) / 2;
        return {
            tip,
            base,
            stemEnd,
            left: { x: base.x + perp.x * halfWidth, y: base.y + perp.y * halfWidth },
            right: { x: base.x - perp.x * halfWidth, y: base.y - perp.y * halfWidth },
            center: { x: (tip.x + base.x) / 2, y: (tip.y + base.y) / 2 },
            angle,
            length,
            stemLength
        };
    }

    function svgEl(tag, attrs = {}) {
        const node = document.createElementNS(SVG_NS, tag);
        Object.entries(attrs).forEach(([key, value]) => {
            if (value !== undefined && value !== null) node.setAttribute(key, String(value));
        });
        return node;
    }

    function parseNumberList(text) {
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

    function parseCalibration(text) {
        return String(text || '')
            .split(/[\n,;]+/)
            .map(part => part.trim())
            .filter(Boolean)
            .map(part => {
                const match = part.match(/^(-?\d+(?:\.\d+)?)\s*=\s*(-?\d+(?:\.\d+)?)$/);
                if (!match) return null;
                return { value: Number(match[1]), angle: Number(match[2]) };
            })
            .filter(item => item && Number.isFinite(item.value) && Number.isFinite(item.angle))
            .sort((a, b) => a.value - b.value);
    }

    function valueAngle(scale, value) {
        const points = parseCalibration(scale.calibrationText);
        if (points.length >= 2) {
            if (value <= points[0].value) {
                return extrapolate(points[0], points[1], value);
            }
            for (let i = 0; i < points.length - 1; i += 1) {
                const a = points[i];
                const b = points[i + 1];
                if (value >= a.value && value <= b.value) return extrapolate(a, b, value);
            }
            return extrapolate(points[points.length - 2], points[points.length - 1], value);
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

    function calibrationPointAngle(scale, value) {
        const points = parseCalibration(scale.calibrationText);
        const point = points.find(item => Math.abs(item.value - value) < 1e-9);
        return point ? point.angle : null;
    }

    function closestEquivalentAngle(angle, reference) {
        let next = Number(angle) || 0;
        const target = Number(reference);
        if (!Number.isFinite(target)) return next;
        while (next - target > 180) next -= 360;
        while (target - next > 180) next += 360;
        return next;
    }

    function upsertCalibrationPoint(scale, value, angle) {
        const points = parseCalibration(scale.calibrationText);
        const nextValue = Number(value);
        if (!Number.isFinite(nextValue) || !Number.isFinite(Number(angle))) return;
        const existing = points.find(point => Math.abs(point.value - nextValue) < 1e-9);
        if (existing) existing.angle = round(angle);
        else points.push({ value: nextValue, angle: round(angle) });
        points.sort((a, b) => a.value - b.value);
        scale.calibrationText = points.map(point => `${formatPointNumber(point.value)}=${formatPointNumber(point.angle)}`).join(', ');
    }

    function formatPointNumber(value) {
        const rounded = Math.round(Number(value) * 1000) / 1000;
        return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '').replace(/\.$/, '');
    }

    function extrapolate(a, b, value) {
        const range = b.value - a.value;
        const t = range ? (value - a.value) / range : 0;
        return a.angle + (b.angle - a.angle) * t;
    }

    function defaultIndexElements() {
        return [
            { id: 'idx-rate-60', type: 'index', label: 'Rate 60 index', text: '', radius: 780, labelRadius: 720, startAngle: 180, indexLength: -82, indexWidth: 62, stemLength: 0, fontSize: 28, textRotation: -90 },
            { id: 'idx-oil-lbs', type: 'index', label: 'Oil lbs index', text: '', radius: 856, labelRadius: 960, startAngle: -96, indexLength: 90, indexWidth: 32, stemLength: 20, fontSize: 24, textRotation: 0 },
            { id: 'idx-imp-gal-top', type: 'index', label: 'Imp gal top index', text: '', radius: 856, labelRadius: 960, startAngle: -74, indexLength: 90, indexWidth: 32, stemLength: 20, fontSize: 24, textRotation: 0 },
            { id: 'idx-km-us-gal', type: 'index', label: 'KM / US gal index', text: '', radius: 856, labelRadius: 960, startAngle: -48, indexLength: 90, indexWidth: 32, stemLength: 20, fontSize: 24, textRotation: 0 },
            { id: 'idx-ft', type: 'index', label: 'FT index', text: '', radius: 856, labelRadius: 960, startAngle: -27, indexLength: 86, indexWidth: 30, stemLength: 18, fontSize: 24, textRotation: 0 },
            { id: 'idx-kg', type: 'index', label: 'KG index', text: '', radius: 856, labelRadius: 960, startAngle: 2, indexLength: 82, indexWidth: 30, stemLength: 18, fontSize: 24, textRotation: 0 },
            { id: 'idx-cas', type: 'index', label: 'CAS index', text: '', radius: 856, labelRadius: 960, startAngle: 71, indexLength: 70, indexWidth: 28, stemLength: 14, fontSize: 24, textRotation: 0 },
            { id: 'idx-tas', type: 'index', label: 'TAS index', text: '', radius: 856, labelRadius: 960, startAngle: 83, indexLength: 70, indexWidth: 28, stemLength: 14, fontSize: 24, textRotation: 0 },
            { id: 'idx-seconds', type: 'index', label: 'Seconds index', text: '', radius: 760, labelRadius: 845, startAngle: 107, indexLength: 76, indexWidth: 28, stemLength: 14, fontSize: 24, textRotation: 0 },
            { id: 'idx-lbs-bottom', type: 'index', label: 'LBS bottom index', text: '', radius: 856, labelRadius: 960, startAngle: 123, indexLength: 70, indexWidth: 28, stemLength: 14, fontSize: 24, textRotation: 0 },
            { id: 'idx-meters', type: 'index', label: 'Meters index', text: '', radius: 856, labelRadius: 960, startAngle: 137, indexLength: 70, indexWidth: 28, stemLength: 14, fontSize: 24, textRotation: 0 },
            { id: 'idx-liters', type: 'index', label: 'Liters index', text: '', radius: 856, labelRadius: 960, startAngle: 156, indexLength: 78, indexWidth: 30, stemLength: 16, fontSize: 24, textRotation: 0 },
            { id: 'idx-true-alt', type: 'index', label: 'True altitude index', text: '', radius: 740, labelRadius: 835, startAngle: 169, indexLength: 78, indexWidth: 30, stemLength: 16, fontSize: 24, textRotation: 0 },
            { id: 'idx-density-pointer', type: 'index', label: 'Density altitude pointer', text: '', radius: 246, labelRadius: 300, startAngle: -90, indexLength: 58, indexWidth: 54, stemLength: 0, fontSize: 24, textRotation: 0 }
        ].map(applyStandardIndexPattern);
    }

    function standardIndexText(element) {
        if (!element) return '';
        if (INDEX_TEXT_BY_ID[element.id]) return INDEX_TEXT_BY_ID[element.id];
        return String(element.label || '')
            .replace(/\s+index$/i, '')
            .trim()
            .toUpperCase();
    }

    function applyStandardIndexPattern(element) {
        if (!element || element.type !== 'index' || INDEX_PATTERN_SKIP_IDS.has(element.id)) return element;
        Object.assign(element, STANDARD_INDEX_PATTERN, { text: standardIndexText(element) });
        return element;
    }

    function defaultElements() {
        const logPoints = '10=-90, 11=-75.1, 12=-61.5, 13=-49.0, 14=-37.4, 15=-26.6, 16=-16.3, 17=-6.8, 18=2.9, 19=11.2, 20=18.4, 25=53.3, 30=81.7, 35=105.0, 40=126.7, 45=145.1, 50=162.3, 55=177.8, 60=191.0, 70=213.3, 80=235.0, 90=253.5';
        return [
            { id: 'outer-case', type: 'ring', label: 'Outer case guide', radius: 1018, startAngle: -180, endAngle: 180 },
            { id: 'outer-slide-rule', type: 'scale', label: 'Outer slide rule', radius: 855, labelRadius: 910, startAngle: -90, endAngle: 270, min: 10, max: 100, mapping: 'log10', majorTick: 40, minorTick: 24, fontSize: 54, valuesText: '10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,30,35,40,45,50,55,60,70,80,90', minorValuesText: '10..100/1', calibrationText: logPoints },
            { id: 'inner-slide-rule', type: 'scale', label: 'Inner slide rule', radius: 760, labelRadius: 805, startAngle: -90, endAngle: 270, min: 10, max: 100, mapping: 'log10', majorTick: -34, minorTick: -20, fontSize: 40, valuesText: '10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,30,35,40,45,50,55,60,70,80,90', minorValuesText: '10..100/1', calibrationText: logPoints },
            { id: 'hours-scale', type: 'scale', label: 'Hours ring', radius: 675, labelRadius: 710, startAngle: -166, endAngle: 113, min: 1, max: 9, mapping: 'linear', majorTick: 34, mediumTick: 26, minorTick: 12, fontSize: 38, valuesText: '1=1:00,1.166667=1:10,1.333333=1:20,1.5=1:30,1.666667=1:40,1.833333=1:50,2=2:00,2.5=2:30,3=3:00,3.5=3:30,4=4:00,4.5=4:30,5=5:00,6=6:00,7=7:00,8=8:00,9=9:00', mediumValuesText: '1..9/0.083333', minorValuesText: '1..9/0.016667', calibrationText: '1=-166, 2=-42, 3=8, 4=45, 5=76, 6=103, 9=159' },
            { id: 'left-temp-window', type: 'window', label: 'Left temp window', innerRadius: 505, outerRadius: 615, startAngle: -156, endAngle: -105 },
            { id: 'right-pa-window', type: 'window', label: 'Right PA window', innerRadius: 505, outerRadius: 615, startAngle: -54, endAngle: 8 },
            { id: 'density-window', type: 'window', label: 'Density altitude window', innerRadius: 290, outerRadius: 350, startAngle: -110, endAngle: -70 },
            { id: 'density-scale', type: 'scale', label: 'Density scale', radius: 326, labelRadius: 304, startAngle: -110, endAngle: -70, min: -10, max: 10, mapping: 'linear', majorTick: -26, minorTick: -14, fontSize: 34, valuesText: '-10,-5,0,5,10', minorValuesText: '-10..10/1', calibrationText: '-10=-110, -5=-100, 0=-90, 5=-80, 10=-70' },
            { id: 'title-label', type: 'label', label: 'Title', text: 'E6B FLIGHT COMPUTER', radius: 990, startAngle: -91, fontSize: 74, textRotation: -8 },
            { id: 'left-help-label', type: 'label', label: 'Left help text', text: 'FOR ALTITUDE\\nCOMPUTATIONS', radius: 390, startAngle: -166, fontSize: 34, textRotation: 0 },
            { id: 'right-help-label', type: 'label', label: 'Right help text', text: 'FOR TRUE\\nAIRSPEED &\\nDENSITY ALT', radius: 390, startAngle: -14, fontSize: 31, textRotation: 0 },
            { id: 'fuel-label', type: 'label', label: 'Fuel block', text: 'FOR FUEL\\nCONSUMPTION', radius: 420, startAngle: 100, fontSize: 30, textRotation: 180 },
            { id: 'time-distance-label', type: 'label', label: 'Time distance block', text: 'FOR TIME\\nAND DISTANCE', radius: 420, startAngle: 56, fontSize: 30, textRotation: 180 },
            ...defaultIndexElements()
        ];
    }

    function defaultWindRotorElements() {
        const compassValues = Array.from({ length: 37 }, (_, index) => {
            const value = index * 10;
            if (value === 0 || value === 360) return `${value}=N`;
            if (value === 90) return '90=E';
            if (value === 180) return '180=S';
            if (value === 270) return '270=W';
            return String(value);
        }).join(',');
        const compassMinor = Array.from({ length: 73 }, (_, index) => String(index * 5)).join(',');
        const windRotorBack = [
            { id: 'wind-rotor-back-outer', type: 'ring', label: 'Wind rotor back outline', disc: 'wind-rotor-back', surface: 'wind-rotor-back', radius: 650, startAngle: -180, endAngle: 180 }
        ];
        const windRotorFront = [
            { id: 'wind-rotor-outer', type: 'ring', label: 'Wind rotor front outline', disc: 'wind-rotor-front', surface: 'wind-rotor-front', radius: 650, startAngle: -180, endAngle: 180 },
            { id: 'wind-compass-scale', type: 'scale', label: 'Wind compass', disc: 'wind-rotor-front', surface: 'wind-rotor-front', radius: 610, labelRadius: 556, startAngle: -90, endAngle: 270, min: 0, max: 360, mapping: 'linear', majorTick: 36, mediumTick: 26, minorTick: 16, fontSize: 36, valuesText: compassValues, mediumValuesText: compassMinor, minorValuesText: '0..360/1', calibrationText: '0=-90, 90=0, 180=90, 270=180, 360=270' },
            { id: 'wind-true-index', type: 'index', label: 'True index', text: 'TRUE INDEX', disc: 'wind-rotor-front', surface: 'wind-rotor-front', radius: 610, labelRadius: 690, startAngle: -90, indexLength: 58, indexWidth: 44, stemLength: 16, fontSize: 28, textOrientation: 'arc', textRotation: 0 },
            { id: 'wind-n-label', type: 'label', label: 'N', text: 'N', disc: 'wind-rotor-front', surface: 'wind-rotor-front', radius: 520, startAngle: -90, fontSize: 58, textRotation: 0 },
            { id: 'wind-e-label', type: 'label', label: 'E', text: 'E', disc: 'wind-rotor-front', surface: 'wind-rotor-front', radius: 520, startAngle: 0, fontSize: 58, textRotation: 0 },
            { id: 'wind-s-label', type: 'label', label: 'S', text: 'S', disc: 'wind-rotor-front', surface: 'wind-rotor-front', radius: 520, startAngle: 90, fontSize: 58, textRotation: 0 },
            { id: 'wind-w-label', type: 'label', label: 'W', text: 'W', disc: 'wind-rotor-front', surface: 'wind-rotor-front', radius: 520, startAngle: 180, fontSize: 58, textRotation: 0 }
        ];
        return [...windRotorBack, ...windRotorFront];
    }

    function defaultWindSliderElements() {
        const sliderRadiusGrid = {
            id: 'wind-slider-radius-grid',
            type: 'slider-radius-grid',
            label: 'Interpolierte Schieber-Radien',
            disc: 'wind-slider',
            surface: 'wind-slider',
            minValue: WIND_SLIDER_MIN_RADIUS_VALUE,
            maxValue: WIND_SLIDER_MAX_RADIUS_VALUE,
            minorStep: 1,
            majorStep: 10,
            minAnchorId: `wind-slider-ring-${WIND_SLIDER_MIN_RADIUS_VALUE}`,
            maxAnchorId: `wind-slider-ring-${WIND_SLIDER_MAX_RADIUS_VALUE}`,
            startAngle: WIND_SLIDER_LEFT_ANGLE,
            endAngle: WIND_SLIDER_RIGHT_ANGLE,
            labelAngle: WIND_SLIDER_AXIS_ANGLE,
            fontSize: 34,
            radialLabelFontSize: 21,
            radialLabelRadiusStep: 50,
            radialLabelMajorStep: 10,
            radialLabelMediumStep: 5,
            radialLabelMediumMinValue: 150,
            thinLineWidth: 0.48,
            mediumLineWidth: 1.28,
            thickLineWidth: 1.7
        };
        const sliderRings = [WIND_SLIDER_MIN_RADIUS_VALUE, WIND_SLIDER_MAX_RADIUS_VALUE].map(value => ({
            id: `wind-slider-ring-${value}`,
            type: 'ring',
            label: `Schieber Radius-Anker ${value}`,
            disc: 'wind-slider',
            surface: 'wind-slider',
            radius: windSliderRadius(value),
            startAngle: WIND_SLIDER_LEFT_ANGLE,
            endAngle: WIND_SLIDER_RIGHT_ANGLE,
            strokeWidth: 2.35,
            strokeOpacity: 0.86,
            strokeDasharray: 'none'
        }));

        const radialAngles = rangeInclusive(WIND_SLIDER_LEFT_ANGLE, WIND_SLIDER_AXIS_ANGLE, 2);
        const sliderRadials = radialAngles.map(angle => ({
            id: `wind-slider-radial-${angle}`,
            type: 'radial',
            label: `Schieber Radial ${Math.abs(angle - WIND_SLIDER_AXIS_ANGLE)} Grad`,
            disc: 'wind-slider',
            surface: 'wind-slider',
            innerValue: WIND_SLIDER_MIN_RADIUS_VALUE,
            outerValue: WIND_SLIDER_MAX_RADIUS_VALUE,
            startAngle: angle,
            endAngle: angle,
            mirrorAxis: WIND_SLIDER_AXIS_ANGLE,
            strokeWidth: angle === WIND_SLIDER_AXIS_ANGLE ? 1.85 : (Math.abs(angle - WIND_SLIDER_AXIS_ANGLE) % 10 === 0 ? 1.35 : 0.95),
            strokeOpacity: angle === WIND_SLIDER_AXIS_ANGLE ? 0.82 : (Math.abs(angle - WIND_SLIDER_AXIS_ANGLE) % 10 === 0 ? 0.7 : 0.48),
            strokeDasharray: 'none'
        }));

        const fineRadials = rangeInclusive(WIND_SLIDER_LEFT_ANGLE + 1, WIND_SLIDER_AXIS_ANGLE - 1, 2).map(angle => ({
            id: `wind-slider-radial-fine-${angle}`,
            type: 'radial',
            label: `Schieber 1 Grad Lineatur ${Math.abs(angle - WIND_SLIDER_AXIS_ANGLE)} Grad`,
            disc: 'wind-slider',
            surface: 'wind-slider',
            innerValue: 150,
            outerValue: WIND_SLIDER_MAX_RADIUS_VALUE,
            startAngle: angle,
            endAngle: angle,
            mirrorAxis: WIND_SLIDER_AXIS_ANGLE,
            variant: 'fine',
            strokeWidth: 0.55,
            strokeOpacity: 0.36,
            strokeDasharray: 'none'
        }));

        const sliderInstruction = {
            id: 'wind-slider-instruction-panel',
            type: 'text-box',
            label: 'Schieber Anleitung',
            text: 'WINDSEITE\\n1 WINDRICHTUNG AM TRUE INDEX\\n2 WINDGESCHW. AB ZENTRUM MARKIEREN\\n3 KURS AM TRUE INDEX EINSTELLEN\\n4 SCHIEBER BIS ZUM TAS-BOGEN\\n5 STEUERKURS UND GS ABLESEN',
            disc: 'wind-slider',
            surface: 'wind-slider',
            radius: 3776.8,
            startAngle: -93.4,
            innerRadius: 720,
            outerRadius: 190,
            endAngle: 14,
            strokeWidth: 3,
            strokeOpacity: 0.92,
            fillOpacity: 1,
            fontSize: 24,
            fontWeight: 'bold',
            fontWidth: 'narrow',
            backgroundFill: '#101418',
            textFill: '#f7f1df'
        };
        const sliderFormula = {
            id: 'wind-slider-formula-panel',
            type: 'text-box',
            label: 'Schieber Formeln',
            text: 'FORMELN\\nA = WIND-KURS-WINKEL\\nHW = W * COS A\\nXW = W * SIN A\\nWCA = ASIN(XW / TAS)\\nGS = TAS * COS WCA - HW',
            disc: 'wind-slider',
            surface: 'wind-slider',
            radius: 3787.3,
            startAngle: -84.5,
            innerRadius: 450,
            outerRadius: 190,
            endAngle: 14,
            strokeWidth: 3,
            strokeOpacity: 0.92,
            fillOpacity: 1,
            fontSize: 23,
            fontWeight: 'bold',
            fontWidth: 'narrow',
            backgroundFill: '#101418',
            textFill: '#f7f1df'
        };

        return [sliderRadiusGrid, ...sliderRings, ...sliderRadials, ...fineRadials, sliderInstruction, sliderFormula];
    }

    function defaultWindElements() {
        return [...defaultWindRotorElements(), ...defaultWindSliderElements()];
    }

    function windSeedElementsForWorkface() {
        if (state.workface === 'wind-slider') return defaultWindSliderElements();
        if (state.workface === 'wind-rotor') return defaultWindRotorElements();
        return defaultWindElements();
    }

    function defaultWindSliderGridSeedElements() {
        const seedIds = new Set([
            'wind-slider-radius-grid',
            windSliderAnchorId(WIND_SLIDER_MIN_RADIUS_VALUE),
            windSliderAnchorId(WIND_SLIDER_MAX_RADIUS_VALUE),
            'wind-slider-instruction-panel',
            'wind-slider-formula-panel'
        ]);
        return defaultWindSliderElements().filter(element => seedIds.has(element.id));
    }

    function ensureWindSliderRadiusGridSeed() {
        const hasSliderElements = state.elements.some(element => elementSurface(element) === 'wind-slider');
        if (!hasSliderElements) return false;
        const existingIds = new Set(state.elements.map(element => element.id));
        const missing = defaultWindSliderGridSeedElements().filter(element => !existingIds.has(element.id));
        if (!missing.length) return false;
        const anchors = missing.filter(element => element.type === 'ring');
        const grids = missing.filter(element => element.type === 'slider-radius-grid');
        state.elements.push(...anchors.map(element => JSON.parse(JSON.stringify(element))));
        state.elements.push(...grids.map(element => JSON.parse(JSON.stringify(element))));
        return true;
    }

    function elementById(id) {
        return state.elements.find(element => element && element.id === id) || null;
    }

    function windSliderAnchorId(value) {
        return `wind-slider-ring-${value}`;
    }

    function windSliderAnchorRadius(value, explicitId = '') {
        const id = explicitId || windSliderAnchorId(value);
        const anchor = elementById(id);
        const radius = Number(anchor && anchor.radius);
        return Number.isFinite(radius) && radius > 0 ? radius : windSliderRadius(value);
    }

    function windSliderInterpolatedRadius(value, grid = null) {
        const minValue = Number(grid && grid.minValue) || WIND_SLIDER_MIN_RADIUS_VALUE;
        const maxValue = Number(grid && grid.maxValue) || WIND_SLIDER_MAX_RADIUS_VALUE;
        const minRadius = windSliderAnchorRadius(minValue, grid && grid.minAnchorId);
        const maxRadius = windSliderAnchorRadius(maxValue, grid && grid.maxAnchorId);
        if (Math.abs(maxValue - minValue) < 1e-9) return minRadius;
        const t = (Number(value || 0) - minValue) / (maxValue - minValue);
        return minRadius + (maxRadius - minRadius) * t;
    }

    function windSliderElementRadius(element, radiusKey, valueKey, fallbackValue) {
        const value = Number(element && element[valueKey]);
        if (elementSurface(element) === 'wind-slider' && Number.isFinite(value)) {
            return windSliderInterpolatedRadius(value);
        }
        const inferredValue = inferredWindSliderRadialValue(element, valueKey);
        if (Number.isFinite(inferredValue)) return windSliderInterpolatedRadius(inferredValue);
        const radius = Number(element && element[radiusKey]);
        if (Number.isFinite(radius)) return radius;
        return elementSurface(element) === 'wind-slider' ? windSliderRadius(fallbackValue) : 0;
    }

    function windSliderRadialOffset(angle) {
        return Math.abs(normalizeAngle(Number(angle || 0) - WIND_SLIDER_AXIS_ANGLE));
    }

    function isStepMultiple(value, step) {
        const number = Number(value);
        const interval = Number(step);
        if (!Number.isFinite(number) || !Number.isFinite(interval) || interval <= 0) return false;
        return Math.abs(number / interval - Math.round(number / interval)) < 1e-6;
    }

    function positiveNumber(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) && number >= 0 ? number : fallback;
    }

    function windSliderRadiusGridElement() {
        return elementById('wind-slider-radius-grid') || defaultWindSliderElements().find(element => element.id === 'wind-slider-radius-grid');
    }

    function windSliderLineWidths(grid = windSliderRadiusGridElement()) {
        return {
            thin: positiveNumber(grid && grid.thinLineWidth, 0.48),
            medium: positiveNumber(grid && grid.mediumLineWidth, 1.28),
            thick: positiveNumber(grid && grid.thickLineWidth, 1.7)
        };
    }

    function windSliderRadialStyle(element, angle) {
        if (!element || elementSurface(element) !== 'wind-slider' || element.type !== 'radial') return '';
        const lineWidths = windSliderLineWidths();
        const offset = windSliderRadialOffset(angle);
        const innerValue = windSliderElementValue(element, 'innerValue');
        const tenDegree = isStepMultiple(offset, 10);
        const fiveDegreeOuter = innerValue >= 150 && isStepMultiple(offset, 5);
        const centerAxis = offset < 0.001;
        if (centerAxis || tenDegree) {
            return `stroke-width:${lineWidths.thick};opacity:.86;stroke-dasharray:none;`;
        }
        if (fiveDegreeOuter) {
            return `stroke-width:${lineWidths.medium};opacity:.72;stroke-dasharray:none;`;
        }
        return `stroke-width:${lineWidths.thin};opacity:.34;stroke-dasharray:none;`;
    }

    function windSliderElementValue(element, key) {
        const value = Number(element && element[key]);
        if (Number.isFinite(value)) return value;
        const inferred = inferredWindSliderRadialValue(element, key);
        return Number.isFinite(inferred) ? inferred : NaN;
    }

    function inferredWindSliderRadialValue(element, valueKey) {
        if (!element || elementSurface(element) !== 'wind-slider' || element.type !== 'radial') return NaN;
        const id = String(element.id || '');
        if (!id.startsWith('wind-slider-radial-')) return NaN;
        if (valueKey === 'outerValue') return WIND_SLIDER_MAX_RADIUS_VALUE;
        if (valueKey === 'innerValue') {
            return id.includes('radial-fine') || element.variant === 'fine'
                ? 150
                : WIND_SLIDER_MIN_RADIUS_VALUE;
        }
        return NaN;
    }

    function isLegacyWindSliderIntermediateRing(element) {
        if (!element || elementSurface(element) !== 'wind-slider' || element.type !== 'ring') return false;
        const match = String(element.id || '').match(/^wind-slider-ring-(\d+(?:\.\d+)?)$/);
        if (!match) return false;
        const value = Number(match[1]);
        return Number.isFinite(value) && value !== WIND_SLIDER_MIN_RADIUS_VALUE && value !== WIND_SLIDER_MAX_RADIUS_VALUE;
    }

    function loadStoredState() {
        let stored = null;
        try {
            stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        } catch (_) {
            stored = null;
        }
        if (!stored || typeof stored !== 'object') {
            state.elements = normalizeStoredElements(defaultElements());
            ensureCalibrationSurface();
            ensureVisibleSelection();
            return;
        }
        Object.assign(state.image, stored.image || {});
        ensureImageSource();
        Object.assign(state.calibration, stored.calibration || {});
        Object.assign(state.view, stored.view || {});
        Object.assign(state.guide, stored.guide || {});
        Object.assign(state.preview, stored.preview || {});
        hydrateWindState(stored.wind);
        hydrateScanAlignment(stored.scanAlignment);
        Object.assign(state.typography, stored.typography || {});
        state.workface = normalizeWorkface(stored.workface);
        state.calibrationSurface = normalizeCalibrationSurface(stored.calibrationSurface, state.workface);
        state.elements = normalizeStoredElements(Array.isArray(stored.elements) ? stored.elements : defaultElements());
        ensureWindSliderRadiusGridSeed();
        state.selectedId = stored.selectedId || (state.elements[0] || {}).id || '';
        ensureCalibrationSurface();
        ensureVisibleSelection();
    }

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(storageState()));
        } catch (_) {}
    }

    function storageState() {
        return {
            image: { ...state.image, src: persistedImageSrc() },
            calibration: { ...state.calibration },
            view: { ...state.view },
            guide: { ...state.guide },
            preview: { ...state.preview },
            wind: windStorageState(),
            scanAlignment: scanAlignmentSnapshot(),
            typography: { ...state.typography },
            workface: state.workface,
            calibrationSurface: state.calibrationSurface,
            selectedId: state.selectedId,
            elements: JSON.parse(JSON.stringify(state.elements))
        };
    }

    function historyState() {
        return {
            image: { ...state.image },
            calibration: { ...state.calibration },
            view: { ...state.view },
            guide: { ...state.guide },
            preview: { ...state.preview },
            wind: windStorageState(),
            scanAlignment: scanAlignmentSnapshot(),
            typography: { ...state.typography },
            workface: state.workface,
            calibrationSurface: state.calibrationSurface,
            selectedId: state.selectedId,
            elements: JSON.parse(JSON.stringify(state.elements))
        };
    }

    function windStorageState() {
        return {
            rotorCalibration: { ...state.wind.rotorFrontCalibration },
            rotorBackCalibration: { ...state.wind.rotorBackCalibration },
            rotorFrontCalibration: { ...state.wind.rotorFrontCalibration },
            sliderCalibration: { ...state.wind.sliderCalibration },
            circlePoints: Array.isArray(state.wind.circlePoints) ? state.wind.circlePoints.map(point => ({ ...point })) : [],
            markedPoint: { ...state.wind.markedPoint }
        };
    }

    function hydrateWindState(nextWind) {
        const next = nextWind && typeof nextWind === 'object' ? nextWind : {};
        const legacyRotor = next.rotorCalibration && typeof next.rotorCalibration === 'object' ? next.rotorCalibration : {};
        Object.assign(state.wind.rotorBackCalibration, DEFAULT_WIND_ROTOR_BACK_CALIBRATION, legacyRotor, next.rotorBackCalibration || {});
        Object.assign(state.wind.rotorFrontCalibration, DEFAULT_WIND_ROTOR_FRONT_CALIBRATION, {
            cx: Number.isFinite(Number(legacyRotor.cx)) ? Number(legacyRotor.cx) : DEFAULT_WIND_ROTOR_FRONT_CALIBRATION.cx,
            cy: Number.isFinite(Number(legacyRotor.cy)) ? Number(legacyRotor.cy) : DEFAULT_WIND_ROTOR_FRONT_CALIBRATION.cy,
            rotation: Number.isFinite(Number(legacyRotor.rotation)) ? Number(legacyRotor.rotation) : DEFAULT_WIND_ROTOR_FRONT_CALIBRATION.rotation
        }, next.rotorFrontCalibration || {});
        Object.assign(state.wind.sliderCalibration, DEFAULT_WIND_SLIDER_CALIBRATION, next.sliderCalibration || {});
        state.wind.circlePoints = Array.isArray(next.circlePoints) ? next.circlePoints.slice(0, 3).map(point => ({
            x: Number(point.x) || 0,
            y: Number(point.y) || 0
        })) : [];
        Object.assign(state.wind.markedPoint, { radius: 120, angle: -90 }, next.markedPoint || {});
    }

    function hydrateScanAlignment(nextAlignment) {
        const next = nextAlignment && typeof nextAlignment === 'object' ? nextAlignment : {};
        state.scanAlignment = defaultScanAlignmentState();
        SCAN_ALIGNMENT_KEYS.forEach(key => {
            const stored = next[key] && typeof next[key] === 'object' ? next[key] : {};
            Object.assign(state.scanAlignment[key], {
                x: Number.isFinite(Number(stored.x)) ? Number(stored.x) : 0,
                y: Number.isFinite(Number(stored.y)) ? Number(stored.y) : 0,
                rotation: Number.isFinite(Number(stored.rotation)) ? Number(stored.rotation) : 0
            });
        });
    }

    function normalizeWorkface(value) {
        return value === 'wind-slider' || value === 'wind-rotor' ? value : 'front';
    }

    function normalizeStoredElements(elements) {
        return elements.map(element => {
            const copy = element && typeof element === 'object' ? element : {};
            const surface = elementSurface(copy);
            copy.disc = surface;
            copy.surface = surface;
            return copy;
        });
    }

    function scanPresetForCurrentImage() {
        return Object.entries(SCAN_PRESETS).find(([, preset]) => preset.src === state.image.src)?.[0] || '';
    }

    function scanAlignmentKey() {
        return scanPresetForCurrentImage() || presetForWorkface(state.workface) || 'custom';
    }

    function activeScanAlignment() {
        const key = scanAlignmentKey();
        if (!state.scanAlignment || typeof state.scanAlignment !== 'object') {
            state.scanAlignment = defaultScanAlignmentState();
        }
        if (!state.scanAlignment[key]) state.scanAlignment[key] = defaultScanAlignment();
        return state.scanAlignment[key];
    }

    function scanAlignmentSnapshot() {
        const snapshot = defaultScanAlignmentState();
        Object.entries(state.scanAlignment || {}).forEach(([key, value]) => {
            if (!snapshot[key]) return;
            Object.assign(snapshot[key], value || {});
        });
        return snapshot;
    }

    function presetForWorkface(workface) {
        if (workface === 'wind-slider') return 'wind-slider';
        if (workface === 'wind-rotor') return 'wind-rotor';
        return 'front';
    }

    function persistedImageSrc() {
        return Object.values(SCAN_PRESETS).some(preset => preset.src === state.image.src) ? state.image.src : '';
    }

    function applyScanPreset(id) {
        return applyScanPresetWithOptions(id, { resetCalibration: true });
    }

    function applyScanPresetWithOptions(id, options = {}) {
        const preset = SCAN_PRESETS[id];
        if (!preset) return false;
        state.image.src = preset.src;
        state.image.width = preset.width;
        state.image.height = preset.height;
        state.workface = normalizeWorkface(preset.workface);
        ensureCalibrationSurface();
        if (options.resetCalibration !== false) {
            resetCalibrationForPreset(id);
        }
        state.view.zoom = 1;
        state.view.panX = 0;
        state.view.panY = 0;
        const visible = state.elements.find(element => elementVisibleOnWorkface(element));
        if (visible) state.selectedId = visible.id;
        return true;
    }

    function resetCalibrationForPreset(id) {
        if (id === 'front') {
            Object.assign(state.calibration, DEFAULT_FRONT_CALIBRATION);
        } else if (id === 'wind-rotor') {
            Object.assign(state.wind.rotorBackCalibration, DEFAULT_WIND_ROTOR_BACK_CALIBRATION);
            Object.assign(state.wind.rotorFrontCalibration, DEFAULT_WIND_ROTOR_FRONT_CALIBRATION);
        } else if (id === 'wind-slider') {
            Object.assign(state.wind.sliderCalibration, DEFAULT_WIND_SLIDER_CALIBRATION);
        }
    }

    function ensureImageSource() {
        if (!state.image.src) {
            state.image.src = DEFAULT_IMAGE;
            state.image.width = DEFAULT_SIZE.width;
            state.image.height = DEFAULT_SIZE.height;
        }
    }

    function serializeHistoryState() {
        return JSON.stringify(historyState());
    }

    function applySerializedState(serialized) {
        let next = null;
        try {
            next = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
        } catch (_) {
            next = null;
        }
        if (!next || typeof next !== 'object') return;
        Object.assign(state.image, {
            src: DEFAULT_IMAGE,
            width: DEFAULT_SIZE.width,
            height: DEFAULT_SIZE.height,
            opacity: 0.72,
            overlayOpacity: 1,
            showScan: true,
            showOverlay: true,
            showCalibrationMarkers: true
        }, next.image || {});
        ensureImageSource();
        Object.assign(state.calibration, DEFAULT_FRONT_CALIBRATION, next.calibration || {});
        Object.assign(state.view, { zoom: 1, panX: 0, panY: 0 }, next.view || {});
        Object.assign(state.guide, { show: false, angle: -90 }, next.guide || {});
        Object.assign(state.preview, { frontRotation: 0, backRotation: 0, frontRadius: 0, windRotation: 0, sliderY: 0 }, next.preview || {});
        hydrateWindState(next.wind);
        hydrateScanAlignment(next.scanAlignment);
        Object.assign(state.typography, DEFAULT_TYPOGRAPHY, next.typography || {});
        state.workface = normalizeWorkface(next.workface);
        state.calibrationSurface = normalizeCalibrationSurface(next.calibrationSurface, state.workface);
        state.elements = normalizeStoredElements(Array.isArray(next.elements) ? next.elements : defaultElements());
        ensureWindSliderRadiusGridSeed();
        state.selectedId = next.selectedId || (state.elements[0] || {}).id || '';
        ensureCalibrationSurface();
        ensureVisibleSelection();
        state.pickMode = '';
        state.mode = 'edit';
        document.body.classList.remove('pick-mode');
    }

    function loadHistory() {
        let stored = null;
        try {
            stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || 'null');
        } catch (_) {
            stored = null;
        }
        undoStack = Array.isArray(stored && stored.undo) ? stored.undo.filter(item => typeof item === 'string') : [];
        redoStack = [];
        if (undoStack.length > HISTORY_LIMIT) undoStack = undoStack.slice(-HISTORY_LIMIT);
    }

    function persistHistory() {
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify({ undo: undoStack }));
        } catch (_) {}
    }

    function pushUndoSnapshot() {
        const snapshot = serializeHistoryState();
        if (undoStack[undoStack.length - 1] === snapshot) return;
        undoStack.push(snapshot);
        if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
        redoStack = [];
        persistHistory();
        updateHistoryControls();
    }

    function undoChange() {
        if (!undoStack.length) return;
        const previous = undoStack.pop();
        redoStack.push(serializeHistoryState());
        if (redoStack.length > HISTORY_LIMIT) redoStack.shift();
        applySerializedState(previous);
        persistHistory();
        render();
    }

    function redoChange() {
        if (!redoStack.length) return;
        const next = redoStack.pop();
        undoStack.push(serializeHistoryState());
        if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
        applySerializedState(next);
        persistHistory();
        render();
    }

    function updateHistoryControls() {
        const undo = qs('#undoChange');
        const redo = qs('#redoChange');
        if (undo) undo.disabled = isPreviewMode() || !undoStack.length;
        if (redo) redo.disabled = isPreviewMode() || !redoStack.length;
    }

    function selectedElement() {
        return state.elements.find(element => element.id === state.selectedId && elementVisibleOnWorkface(element)) || null;
    }

    function workfaceSurfaces(workface = state.workface) {
        if (workface === 'wind-slider') return ['wind-slider'];
        if (workface === 'wind-rotor') return ['wind-rotor-back', 'wind-rotor-front'];
        return ['back', 'front'];
    }

    function visibleElementsForWorkface(workface = state.workface) {
        return state.elements.filter(element => elementVisibleOnWorkface(element, workface));
    }

    function elementVisibleOnWorkface(element, workface = state.workface) {
        return workfaceSurfaces(workface).includes(elementSurface(element));
    }

    function ensureVisibleSelection() {
        const visible = visibleElementsForWorkface();
        if (visible.some(element => element.id === state.selectedId)) return;
        state.selectedId = (visible[0] || {}).id || '';
    }

    function renderTraceElementFor(parent, element) {
        return withCalibration(calibrationForSurface(elementSurface(element)), () => renderTraceElement(parent, element));
    }

    function render() {
        ensureCalibrationSurface();
        ensureVisibleSelection();
        renderModeControls();
        renderImage();
        renderView();
        renderOverlay();
        renderElementSelect();
        renderEditor();
        renderExport();
        renderPublishedFrontStatus();
        renderPublishedWindStatus();
        updateHistoryControls();
        saveState();
    }

    function renderImage() {
        const image = qs('#scanImage');
        if (!image) return;
        image.setAttribute('href', state.image.src || DEFAULT_IMAGE);
        image.setAttribute('x', 0);
        image.setAttribute('y', 0);
        image.setAttribute('width', state.image.width);
        image.setAttribute('height', state.image.height);
        const transform = scanImageTransform();
        if (transform) image.setAttribute('transform', transform);
        else image.removeAttribute('transform');
        image.style.opacity = isPreviewMode() ? '0' : (state.image.showScan ? String(state.image.opacity) : '0');
    }

    function scanImageTransform() {
        const alignment = activeScanAlignment();
        const cal = activeCalibration();
        const x = Number(alignment.x || 0);
        const y = Number(alignment.y || 0);
        const rotation = Number(alignment.rotation || 0);
        const parts = [];
        if (Math.abs(x) > 0.001 || Math.abs(y) > 0.001) {
            parts.push(`translate(${x.toFixed(2)} ${y.toFixed(2)})`);
        }
        if (Math.abs(rotation) > 0.001) {
            parts.push(`rotate(${rotation.toFixed(3)} ${Number(cal.cx || 0).toFixed(2)} ${Number(cal.cy || 0).toFixed(2)})`);
        }
        return parts.join(' ');
    }

    function renderView() {
        const stage = qs('#traceStage');
        if (!stage) return;
        const zoom = clamp(state.view.zoom, 0.25, 12);
        state.view.zoom = zoom;
        const width = state.image.width / zoom;
        const height = state.image.height / zoom;
        const cx = state.image.width / 2 + state.view.panX;
        const cy = state.image.height / 2 + state.view.panY;
        stage.setAttribute('viewBox', `${(cx - width / 2).toFixed(2)} ${(cy - height / 2).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}`);
    }

    function renderOverlay() {
        const overlay = qs('#traceOverlay');
        if (!overlay) return;
        overlay.replaceChildren();
        overlay.style.opacity = isPreviewMode() ? '1' : (state.image.showOverlay ? String(state.image.overlayOpacity) : '0');
        if (isPreviewMode()) {
            renderPreviewOverlay(overlay);
            return;
        }
        renderCalibrationGuides(overlay);
        if (state.workface === 'wind-slider') {
            const sliderGroup = svgEl('g', { class: 'trace-edit-wind-slider' });
            withCalibration(calibrationForSurface('wind-slider'), () => {
                renderSliderMaskedLayer(sliderGroup, 'trace-slider-edit-mask');
            });
            overlay.appendChild(sliderGroup);
            return;
        }
        [...state.elements]
            .filter(element => elementVisibleOnWorkface(element))
            .sort((a, b) => elementDiscRank(a) - elementDiscRank(b))
            .forEach(element => renderTraceElementFor(overlay, element));
    }

    function renderPreviewOverlay(parent) {
        if (state.workface === 'wind-slider' || state.workface === 'wind-rotor') {
            renderWindPreviewOverlay(parent);
            return;
        }
        ['back', 'front'].forEach(surface => {
            const cal = calibrationForSurface(surface);
            const rotation = previewRotation(surface);
            const group = svgEl('g', {
                class: `trace-preview-disc trace-preview-${surface}`,
                'data-preview-disc': surface,
                transform: `rotate(${rotation.toFixed(2)} ${cal.cx} ${cal.cy})`
            });
            withCalibration(cal, () => {
                renderPreviewDiscSurface(group, surface);
                state.elements
                    .filter(element => elementSurface(element) === surface)
                    .forEach(element => renderTraceElement(group, element));
            });
            parent.appendChild(group);
        });
    }

    function renderWindPreviewOverlay(parent) {
        const sliderCal = calibrationForSurface('wind-slider');
        const sliderGroup = svgEl('g', {
            class: 'trace-preview-disc trace-preview-wind-slider',
            'data-preview-disc': 'wind-slider',
            transform: `translate(0 ${Number(state.preview.sliderY || 0).toFixed(2)})`
        });
        withCalibration(sliderCal, () => {
            renderSliderMaskedLayer(sliderGroup, 'trace-slider-preview-mask');
        });
        parent.appendChild(sliderGroup);

        const rotorBackCal = calibrationForSurface('wind-rotor-back');
        const rotorBackGroup = svgEl('g', {
            class: 'trace-preview-disc trace-preview-wind-rotor-back',
            'data-preview-disc': 'wind-rotor-back'
        });
        withCalibration(rotorBackCal, () => {
            renderPreviewDiscSurface(rotorBackGroup, 'wind-rotor-back');
            state.elements
                .filter(element => elementSurface(element) === 'wind-rotor-back')
                .forEach(element => renderTraceElement(rotorBackGroup, element));
        });
        parent.appendChild(rotorBackGroup);

        const rotorFrontCal = calibrationForSurface('wind-rotor-front');
        const rotorRotation = previewRotation('wind-rotor-front');
        const rotorFrontGroup = svgEl('g', {
            class: 'trace-preview-disc trace-preview-wind-rotor-front',
            'data-preview-disc': 'wind-rotor-front',
            transform: `rotate(${rotorRotation.toFixed(2)} ${rotorFrontCal.cx} ${rotorFrontCal.cy})`
        });
        withCalibration(rotorFrontCal, () => {
            renderPreviewDiscSurface(rotorFrontGroup, 'wind-rotor-front');
            state.elements
                .filter(element => elementSurface(element) === 'wind-rotor-front')
                .forEach(element => renderTraceElement(rotorFrontGroup, element));
            renderWindMarkedPoint(rotorFrontGroup);
        });
        parent.appendChild(rotorFrontGroup);
    }

    function renderPreviewDiscSurface(parent, disc) {
        const radius = previewDiscRadius(disc);
        const innerRadius = previewDiscInnerRadius(disc);
        const windows = state.elements.filter(element => elementSurface(element) === disc && element.type === 'window');
        const d = [
            circlePath(radius),
            ...(innerRadius > 0 ? [circlePath(innerRadius)] : []),
            ...windows.map(element => sectorPath(
                Number(element.innerRadius || 0),
                Number(element.outerRadius || 0),
                Number(element.startAngle || 0),
                Number(element.endAngle || 0)
            ))
        ].join(' ');
        parent.appendChild(svgEl('path', {
            class: `trace-preview-surface trace-preview-${disc}-surface`,
            d,
            'fill-rule': 'evenodd',
            style: previewSurfaceFillStyle(disc)
        }));
        renderPreviewSurfaceOutline(parent, disc, radius, 'outer');
        if (innerRadius > 0) {
            renderPreviewSurfaceOutline(parent, disc, innerRadius, 'inner');
        }
    }

    function renderPreviewSurfaceOutline(parent, surface, radius, kind) {
        const cal = activeCalibration();
        parent.appendChild(svgEl('circle', {
            class: `trace-preview-surface-outline trace-preview-${surface}-${kind}-outline`,
            cx: cal.cx,
            cy: cal.cy,
            r: Math.max(0, Number(radius || 0)),
            style: previewSurfaceOutlineStyle(surface, kind)
        }));
    }

    function renderSliderMaskedLayer(parent, clipId) {
        appendSliderClip(parent, clipId);
        const clipped = svgEl('g', {
            class: 'trace-slider-masked-content',
            'clip-path': `url(#${clipId})`
        });
        renderSliderPreviewSurface(clipped);
        state.elements
            .filter(element => elementSurface(element) === 'wind-slider')
            .sort((a, b) => windSliderRenderRank(a) - windSliderRenderRank(b))
            .forEach(element => renderTraceElement(clipped, element));
        parent.appendChild(clipped);
    }

    function windSliderRenderRank(element) {
        if (element.type === 'text-box') return 60;
        if (element.type === 'slider-radius-grid') return 30;
        if (element.type === 'ring') return 20;
        return 10;
    }

    function appendSliderClip(parent, clipId) {
        const defs = svgEl('defs');
        const clipPath = svgEl('clipPath', {
            id: clipId,
            clipPathUnits: 'userSpaceOnUse'
        });
        clipPath.appendChild(svgEl('rect', sliderMaskRectAttrs()));
        defs.appendChild(clipPath);
        parent.appendChild(defs);
    }

    function sliderMaskRectAttrs() {
        return {
            x: 0,
            y: 0,
            width: state.image.width,
            height: state.image.height,
            rx: surfaceCornerRadius('wind-slider'),
            ry: surfaceCornerRadius('wind-slider')
        };
    }

    function renderSliderPreviewSurface(parent) {
        const cal = activeCalibration();
        const width = state.image.width;
        const height = state.image.height;
        parent.appendChild(svgEl('rect', {
            class: 'trace-preview-surface trace-preview-slider-surface',
            x: 0,
            y: 0,
            width,
            height,
            rx: surfaceCornerRadius('wind-slider'),
            ry: surfaceCornerRadius('wind-slider'),
            style: previewSurfaceStyle('wind-slider')
        }));
        parent.appendChild(svgEl('circle', {
            class: 'trace-slider-origin',
            cx: cal.cx,
            cy: cal.cy,
            r: 12
        }));
    }

    function renderWindMarkedPoint(parent) {
        const point = state.wind.markedPoint || {};
        const p = polarPoint(Number(point.radius || 0), Number(point.angle || 0));
        parent.appendChild(svgEl('circle', {
            class: 'trace-wind-marked-point',
            cx: p.x,
            cy: p.y,
            r: 14
        }));
    }

    function previewDiscRadius(disc) {
        if (disc === 'front' && Number(state.preview.frontRadius) > 0) {
            return Number(state.preview.frontRadius);
        }
        return Math.max(1, Number(calibrationForSurface(disc).radius || 0));
    }

    function previewDiscInnerRadius(disc) {
        const radius = previewDiscRadius(disc);
        const innerRadius = Number(calibrationForSurface(disc).innerRadius || 0);
        if (!Number.isFinite(innerRadius) || innerRadius <= 0) return 0;
        return Math.min(Math.max(0, innerRadius), Math.max(0, radius - 1));
    }

    function surfaceOutlineWidth(surface) {
        const value = Number(calibrationForSurface(surface).outlineWidth);
        return Number.isFinite(value) ? Math.max(0, value) : 5;
    }

    function surfaceInnerOutlineWidth(surface) {
        const calibration = calibrationForSurface(surface);
        const value = Number(calibration.innerOutlineWidth ?? calibration.outlineWidth);
        return Number.isFinite(value) ? Math.max(0, value) : surfaceOutlineWidth(surface);
    }

    function surfaceFillOpacity(surface) {
        const value = Number(calibrationForSurface(surface).fillOpacity);
        return Number.isFinite(value) ? clamp(value, 0, 1) : 1;
    }

    function surfaceCornerRadius(surface) {
        const value = Number(calibrationForSurface(surface).cornerRadius);
        return Number.isFinite(value) ? Math.max(0, value) : 0;
    }

    function previewSurfaceFillStyle(surface) {
        return `stroke:none;stroke-width:0;fill-opacity:${surfaceFillOpacity(surface)};`;
    }

    function previewSurfaceOutlineStyle(surface, kind) {
        const width = kind === 'inner' ? surfaceInnerOutlineWidth(surface) : surfaceOutlineWidth(surface);
        return `fill:none;stroke:rgba(18,22,25,.82);stroke-width:${width};vector-effect:non-scaling-stroke;`;
    }

    function previewSurfaceStyle(surface) {
        return `stroke-width:${surfaceOutlineWidth(surface)};fill-opacity:${surfaceFillOpacity(surface)};`;
    }

    function renderTraceElement(parent, element) {
        if (element.type === 'slider-radius-grid') renderSliderRadiusGrid(parent, element);
        if (element.type === 'ring') renderRing(parent, element);
        if (element.type === 'window') renderWindow(parent, element);
        if (element.type === 'scale') renderScale(parent, element);
        if (element.type === 'label') renderLabel(parent, element);
        if (element.type === 'index') renderIndex(parent, element);
        if (element.type === 'radial') renderRadial(parent, element);
        if (element.type === 'circle') renderCircle(parent, element);
        if (element.type === 'line') renderLine(parent, element);
        if (element.type === 'polygon') renderPolygon(parent, element);
        if (element.type === 'text-box') renderTextBox(parent, element);
        if (element.type === 'control-anchor') renderControlAnchor(parent, element);
    }

    function elementDisc(element) {
        return elementSurface(element);
    }

    function elementDiscRank(element) {
        const order = { 'wind-slider': 0, back: 1, 'wind-rotor-back': 2, front: 3, 'wind-rotor-front': 4 };
        return order[elementSurface(element)] ?? 9;
    }

    function elementDiscClass(element) {
        return `${elementSurface(element).replace(/[^a-z0-9_-]/gi, '-')}-disc`;
    }

    function selectedClass(element) {
        return isPreviewMode() ? '' : (element.id === state.selectedId ? 'selected' : '');
    }

    function normalizeControlAnchorAction(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (CONTROL_ANCHOR_ACTIONS.has(raw)) return raw;
        const normalized = raw
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[–—]/g, '-');
        return CONTROL_ANCHOR_ALIASES[normalized] || '';
    }

    function controlAnchorAction(element) {
        return normalizeControlAnchorAction(element && (element.controlAction || element.text || element.label)) || 'move';
    }

    function controlAnchorGlyph(action) {
        if (action === 'flip') return '↻';
        if (action === 'zoomIn') return '+';
        if (action === 'zoomOut') return '−';
        if (action === 'close') return 'x';
        return '≡';
    }

    function textOrientation(element) {
        const value = element && element.textOrientation;
        return ['free', 'radial', 'radial-upright', 'tangent', 'tangent-upright', 'arc', 'arc-upright'].includes(value) ? value : 'free';
    }

    function cleanFontFamily(value, fallback = '') {
        const text = String(value || '').trim();
        return text || fallback;
    }

    function quoteFontFamily(value) {
        const text = cleanFontFamily(value, DEFAULT_TYPOGRAPHY.fontFamily);
        if (text.includes(',') || text.startsWith('"') || text.startsWith("'")) return text;
        return /\s/.test(text) ? `"${text.replace(/"/g, '')}"` : text;
    }

    function effectiveFontWidth(element) {
        const local = element && FONT_WIDTH_VALUES.has(element.fontWidth) ? element.fontWidth : '';
        if (local) return local;
        return FONT_WIDTH_VALUES.has(state.typography.fontWidth) ? state.typography.fontWidth : DEFAULT_TYPOGRAPHY.fontWidth;
    }

    function effectiveFontWeight(element) {
        const local = element && FONT_WEIGHT_VALUES.has(element.fontWeight) ? element.fontWeight : '';
        if (local) return local;
        return FONT_WEIGHT_VALUES.has(state.typography.fontWeight) ? state.typography.fontWeight : DEFAULT_TYPOGRAPHY.fontWeight;
    }

    function effectiveFontFamily(element) {
        return cleanFontFamily(element && element.fontFamily, cleanFontFamily(state.typography.fontFamily, DEFAULT_TYPOGRAPHY.fontFamily));
    }

    function fontFamilyStack(element) {
        const family = effectiveFontFamily(element);
        const quoted = quoteFontFamily(family);
        const fallback = 'Arial, Helvetica, sans-serif';
        if (family.includes(',')) return family;
        if (effectiveFontWidth(element) === 'narrow' && !/(narrow|condensed|compressed)/i.test(family)) {
            return `"Arial Narrow", "Avenir Next Condensed", "Helvetica Neue Condensed", "DIN Condensed", ${quoted}, ${fallback}`;
        }
        return `${quoted}, ${fallback}`;
    }

    function typographyAttrs(element) {
        const narrow = effectiveFontWidth(element) === 'narrow';
        const bold = effectiveFontWeight(element) === 'bold';
        const family = fontFamilyStack(element);
        const weight = bold ? '700' : '400';
        const stretch = narrow ? 'condensed' : 'normal';
        return {
            'font-family': family,
            'font-weight': weight,
            'font-stretch': stretch,
            style: `font-family:${family};font-weight:${weight};font-stretch:${stretch};`
        };
    }

    function glyphWidthFactor(element) {
        const narrow = effectiveFontWidth(element) === 'narrow';
        const bold = effectiveFontWeight(element) === 'bold';
        return (narrow ? 0.5 : 0.62) * (bold ? 1.06 : 1);
    }

    function isArcText(element) {
        const mode = textOrientation(element);
        return mode === 'arc' || mode === 'arc-upright';
    }

    function orientedTextRotation(element, angle) {
        const mode = textOrientation(element);
        const radial = Number(angle || 0) + Number(activeCalibration().rotation || 0);
        if (mode === 'radial') return radial;
        if (mode === 'radial-upright') return readableRotation(radial);
        if (mode === 'tangent') return radial + 90;
        if (mode === 'tangent-upright') return readableRotation(radial + 90);
        return Number(element.textRotation || 0);
    }

    function arcTextGeometry(element, radius, centerAngle, line, lineIndex, lineCount) {
        const fontSize = Number(element.fontSize || 28);
        const safeRadius = Math.max(1, Math.abs(Number(radius || 0)));
        const lineOffset = (lineIndex - (lineCount - 1) / 2) * fontSize * 1.12;
        const lineRadius = Math.max(1, safeRadius + lineOffset);
        const estimatedWidth = Math.max(fontSize * 2.2, String(line || '').length * fontSize * glyphWidthFactor(element));
        const span = clamp((estimatedWidth / lineRadius) * 180 / Math.PI * 1.18, 6, 168);
        const rawCenter = Number(centerAngle || 0);
        const screenCenter = normalizeAngle(rawCenter + Number(activeCalibration().rotation || 0));
        const autoReverse = textOrientation(element) === 'arc-upright' && screenCenter > 0 && screenCenter < 180;
        return {
            radius: lineRadius,
            startAngle: rawCenter - span / 2,
            endAngle: rawCenter + span / 2,
            reverse: autoReverse
        };
    }

    function safeIdPart(value) {
        return String(value || 'item').replace(/[^a-zA-Z0-9_-]+/g, '-');
    }

    function renderArcText(parent, element, textValue, radius, centerAngle, className, dataAttrs = {}) {
        const lines = String(textValue || '').split(/\\n|\n/);
        const group = svgEl('g', {
            class: `trace-arc-text ${selectedClass(element)} ${elementDiscClass(element)}`,
            'data-trace-id': element.id
        });
        const defs = svgEl('defs');
        lines.forEach((line, index) => {
            const geometry = arcTextGeometry(element, radius, centerAngle, line, index, lines.length);
            const pathId = `trace-arc-${safeIdPart(element.id)}-${index}`;
            defs.appendChild(svgEl('path', {
                id: pathId,
                d: textArcPath(geometry.radius, geometry.startAngle, geometry.endAngle, geometry.reverse)
            }));
            const text = svgEl('text', {
                class: className,
                'font-size': Number(element.fontSize || 28),
                'text-anchor': 'middle',
                'dominant-baseline': 'middle',
                ...typographyAttrs(element),
                ...dataAttrs
            });
            const textPath = svgEl('textPath', {
                href: `#${pathId}`,
                'xlink:href': `#${pathId}`,
                startOffset: '50%'
            });
            textPath.textContent = line;
            text.appendChild(textPath);
            group.appendChild(text);
        });
        group.insertBefore(defs, group.firstChild);
        parent.appendChild(group);
    }

    function isPreviewMode() {
        return state.mode === 'preview';
    }

    function previewRotationKey(disc) {
        if (disc === 'wind-rotor-front') return 'windRotation';
        return disc === 'back' ? 'backRotation' : 'frontRotation';
    }

    function previewRotation(disc) {
        if (disc === 'back' || disc === 'wind-slider' || disc === 'wind-rotor-back') return 0;
        return Number(state.preview[previewRotationKey(disc)] || 0);
    }

    function setPreviewRotation(disc, value) {
        if (disc === 'back' || disc === 'wind-slider' || disc === 'wind-rotor-back') return;
        state.preview[previewRotationKey(disc)] = round(value);
    }

    function renderModeControls() {
        document.body.classList.toggle('preview-mode', isPreviewMode());
        const toggle = qs('#togglePreviewMode');
        if (toggle) {
            toggle.textContent = isPreviewMode() ? 'VORSCHAU' : 'BEARBEITEN';
            toggle.setAttribute('aria-pressed', isPreviewMode() ? 'true' : 'false');
        }
        const reset = qs('#resetPreviewRotation');
        if (reset) reset.disabled = !isPreviewMode();
        const publishFront = qs('#publishFrontDisc');
        if (publishFront) {
            publishFront.disabled = !frontSaveAllowed();
            publishFront.title = frontSaveAllowed()
                ? 'Aktuelle Vorderseite nach e6b/e6b-workbench-front-disc.json speichern'
                : 'Front speichern ist nur auf Arbeitsflaeche Vorderseite mit Front-Scan aktiv.';
        }
        const publishWind = qs('#publishWindDisc');
        if (publishWind) {
            publishWind.disabled = !windSaveAllowed();
            publishWind.title = windSaveAllowed()
                ? 'Aktuelle Windseite nach e6b/e6b-workbench-wind-disc.json speichern'
                : 'Wind speichern ist nur auf Rueckseite Drehscheibe oder Rueckseite Schieber aktiv.';
        }
        setButtonAvailability('#resetElements', frontElementActionsAllowed(), 'Front-Elemente neu aus Seed erzeugen.', 'Front Seed ist nur auf der Vorderseite aktiv.');
        setButtonAvailability('#appendIndexes', frontElementActionsAllowed(), 'Front-Indexe ergaenzen.', 'Front Indexe ist nur auf der Vorderseite aktiv.');
        setButtonAvailability('#applyIndexPattern', frontElementActionsAllowed(), 'Front-Index-Muster anwenden.', 'Front Muster ist nur auf der Vorderseite aktiv.');
        const windSeedTitle = state.workface === 'wind-slider'
            ? 'Schieber-Seed mit Maske, Radien und gespiegelter Winkel-Lineatur ergaenzen.'
            : 'Wind-Rotor-Seed fuer hintere und vordere Drehscheibe ergaenzen.';
        setButtonAvailability('#appendWindSeeds', windElementActionsAllowed(), windSeedTitle, 'Wind Seed ist nur auf der Rueckseite aktiv.');
        setButtonAvailability('#appendShapePattern', !isPreviewMode(), 'Form-Muster fuer die aktive Arbeitsflaeche einfuegen.', 'Form Muster ist nur im Bearbeiten-Modus aktiv.');
    }

    function setButtonAvailability(selector, enabled, enabledTitle, disabledTitle) {
        const button = qs(selector);
        if (!button) return;
        button.disabled = !enabled;
        button.title = enabled ? enabledTitle : disabledTitle;
    }

    function renderCalibrationGuides(parent) {
        const cal = activeCalibration();
        const group = svgEl('g', { 'data-trace-calibration': '1' });
        group.appendChild(svgEl('circle', { class: 'trace-ring', cx: cal.cx, cy: cal.cy, r: cal.radius }));
        group.appendChild(svgEl('line', { class: 'trace-center-cross', x1: cal.cx - 36, y1: cal.cy, x2: cal.cx + 36, y2: cal.cy }));
        group.appendChild(svgEl('line', { class: 'trace-center-cross', x1: cal.cx, y1: cal.cy - 36, x2: cal.cx, y2: cal.cy + 36 }));
        const top = polarPoint(cal.radius, -90);
        group.appendChild(svgEl('line', { class: 'trace-radius-line', x1: cal.cx, y1: cal.cy, x2: top.x, y2: top.y }));
        group.appendChild(svgEl('circle', { class: 'trace-handle', cx: cal.cx, cy: cal.cy, r: 7 }));
        if ((state.workface === 'wind-rotor' || state.workface === 'wind-slider') && Array.isArray(state.wind.circlePoints)) {
            state.wind.circlePoints.forEach((point, index) => {
                group.appendChild(svgEl('circle', {
                    class: 'trace-circle-pick-point',
                    cx: point.x,
                    cy: point.y,
                    r: 11
                }));
                const label = svgEl('text', {
                    class: 'trace-circle-pick-label',
                    x: point.x + 20,
                    y: point.y - 20,
                    'font-size': 28
                });
                label.textContent = String(index + 1);
                group.appendChild(label);
            });
        }
        parent.appendChild(group);
        renderHelperRadial(parent);
    }

    function renderHelperRadial(parent) {
        if (!state.guide.show) return;
        const cal = activeCalibration();
        const angle = Number(state.guide.angle || 0);
        const handleRadius = Number(cal.radius || 0) + 90;
        const end = polarPoint(handleRadius, angle);
        const label = polarPoint(handleRadius + 54, angle);
        const group = svgEl('g', {
            class: 'trace-helper-radial',
            'data-helper-radial': '1'
        });
        group.appendChild(svgEl('line', {
            class: 'trace-helper-radial-line',
            x1: cal.cx,
            y1: cal.cy,
            x2: end.x,
            y2: end.y
        }));
        group.appendChild(svgEl('circle', {
            class: 'trace-helper-radial-hitbox',
            cx: end.x,
            cy: end.y,
            r: 48
        }));
        group.appendChild(svgEl('circle', {
            class: 'trace-helper-radial-handle',
            cx: end.x,
            cy: end.y,
            r: 18
        }));
        const text = svgEl('text', {
            class: 'trace-helper-radial-label',
            x: label.x,
            y: label.y,
            'font-size': 30,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            ...typographyAttrs(null)
        });
        text.textContent = `${round(angle)} deg`;
        group.appendChild(text);
        parent.appendChild(group);
    }

    function renderSliderRadiusGrid(parent, element) {
        const minValue = Number(element.minValue || WIND_SLIDER_MIN_RADIUS_VALUE);
        const maxValue = Number(element.maxValue || WIND_SLIDER_MAX_RADIUS_VALUE);
        const minorStep = Math.max(1, Number(element.minorStep || 1));
        const majorStep = Math.max(minorStep, Number(element.majorStep || 10));
        const startAngle = Number(element.startAngle ?? WIND_SLIDER_LEFT_ANGLE);
        const endAngle = Number(element.endAngle ?? WIND_SLIDER_RIGHT_ANGLE);
        const labelAngle = Number(element.labelAngle ?? WIND_SLIDER_AXIS_ANGLE);
        const lineWidths = windSliderLineWidths(element);
        const group = svgEl('g', {
            class: `trace-slider-radius-grid ${selectedClass(element)} ${elementDiscClass(element)}`,
            'data-trace-id': element.id,
            'pointer-events': 'none'
        });

        rangeInclusive(minValue, maxValue, minorStep).forEach(value => {
            const radius = windSliderInterpolatedRadius(value, element);
            const isMajor = Math.abs(value / majorStep - Math.round(value / majorStep)) < 1e-6;
            group.appendChild(svgEl('path', {
                class: `trace-slider-radius-line ${isMajor ? 'major' : 'minor'}`,
                d: arcPath(radius, startAngle, endAngle),
                style: isMajor
                    ? `fill:none;stroke:rgba(0,83,72,.76);stroke-width:${lineWidths.thick};vector-effect:non-scaling-stroke;`
                    : `fill:none;stroke:rgba(0,83,72,.30);stroke-width:${lineWidths.thin};vector-effect:non-scaling-stroke;`
            }));
            if (isMajor) renderSliderRadiusLabel(group, element, value, radius, labelAngle);
        });

        renderSliderRadialEmphasis(group, element);
        renderSliderRadialLabels(group, element);

        parent.appendChild(group);
    }

    function renderSliderRadialEmphasis(parent, element) {
        const minValue = Number(element.minValue || WIND_SLIDER_MIN_RADIUS_VALUE);
        const maxValue = Number(element.maxValue || WIND_SLIDER_MAX_RADIUS_VALUE);
        const majorStep = Math.max(1, Number(element.radialLabelMajorStep || 10));
        const mediumStep = Math.max(1, Number(element.radialLabelMediumStep || 5));
        const mediumMinValue = Number(element.radialLabelMediumMinValue || 150);
        const lineWidths = windSliderLineWidths(element);
        const minRadius = windSliderInterpolatedRadius(minValue, element);
        const maxRadius = windSliderInterpolatedRadius(maxValue, element);
        const mediumMinRadius = windSliderInterpolatedRadius(Math.max(minValue, mediumMinValue), element);

        for (let offset = majorStep; offset <= 60 + 1e-9; offset += majorStep) {
            renderSliderRadialGuide(parent, offset, minRadius, maxRadius, lineWidths.thick, 0.78, 'major');
        }

        for (let offset = mediumStep; offset <= 60 + 1e-9; offset += mediumStep) {
            if (isStepMultiple(offset, majorStep)) continue;
            renderSliderRadialGuide(parent, offset, mediumMinRadius, maxRadius, lineWidths.medium, 0.66, 'medium');
        }
    }

    function renderSliderRadialGuide(parent, offset, innerRadius, outerRadius, strokeWidth, opacity, variant) {
        [WIND_SLIDER_AXIS_ANGLE - offset, WIND_SLIDER_AXIS_ANGLE + offset].forEach(angle => {
            const inner = polarPoint(innerRadius, angle);
            const outer = polarPoint(outerRadius, angle);
            parent.appendChild(svgEl('line', {
                class: `trace-slider-radial-emphasis ${variant}`,
                x1: inner.x,
                y1: inner.y,
                x2: outer.x,
                y2: outer.y,
                style: `fill:none;stroke:rgba(0,83,72,.72);stroke-width:${strokeWidth};opacity:${opacity};stroke-dasharray:none;vector-effect:non-scaling-stroke;`
            }));
        });
    }

    function renderSliderRadiusLabel(parent, element, value, radius, angle) {
        const label = String(value);
        const fontSize = Number(element.fontSize || 34);
        const p = polarPoint(radius, angle);
        const width = Math.max(fontSize * 1.6, label.length * fontSize * 0.66 + fontSize * 0.7);
        const height = fontSize * 1.15;
        parent.appendChild(svgEl('rect', {
            class: 'trace-slider-radius-label-bg',
            x: (p.x - width / 2).toFixed(2),
            y: (p.y - height / 2).toFixed(2),
            width: width.toFixed(2),
            height: height.toFixed(2),
            style: 'fill:rgba(255,255,255,.96);stroke:rgba(18,22,25,.62);stroke-width:1;vector-effect:non-scaling-stroke;'
        }));
        const text = svgEl('text', {
            class: 'trace-slider-radius-label',
            x: p.x,
            y: p.y,
            'font-size': fontSize,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            ...typographyAttrs(element),
            style: `${typographyAttrs(element).style};fill:#101418;stroke:none;font-weight:700;`
        });
        text.textContent = label;
        parent.appendChild(text);
    }

    function renderSliderRadialLabels(parent, element) {
        const minValue = Number(element.minValue || WIND_SLIDER_MIN_RADIUS_VALUE);
        const maxValue = Number(element.maxValue || WIND_SLIDER_MAX_RADIUS_VALUE);
        const radiusStep = Math.max(1, Number(element.radialLabelRadiusStep || 50));
        const majorStep = Math.max(1, Number(element.radialLabelMajorStep || 10));
        const mediumStep = Math.max(1, Number(element.radialLabelMediumStep || 5));
        const mediumMinValue = Number(element.radialLabelMediumMinValue || 150);
        const labelRadii = rangeInclusive(Math.ceil(minValue / radiusStep) * radiusStep, maxValue, radiusStep);
        labelRadii.forEach(radiusValue => {
            const offsets = [];
            for (let offset = majorStep; offset <= 60 + 1e-9; offset += majorStep) offsets.push(offset);
            if (radiusValue >= mediumMinValue) {
                for (let offset = mediumStep; offset <= 60 + 1e-9; offset += mediumStep) {
                    if (!isStepMultiple(offset, majorStep)) offsets.push(offset);
                }
            }
            offsets
                .sort((a, b) => a - b)
                .forEach(offset => {
                    const radius = windSliderInterpolatedRadius(radiusValue, element);
                    renderSliderRadialLabel(parent, element, offset, radius, WIND_SLIDER_AXIS_ANGLE - offset);
                    renderSliderRadialLabel(parent, element, offset, radius, WIND_SLIDER_AXIS_ANGLE + offset);
                });
        });
    }

    function renderSliderRadialLabel(parent, element, value, radius, angle) {
        const label = String(value);
        const fontSize = Number(element.radialLabelFontSize || 21);
        const p = polarPoint(radius, angle);
        const width = Math.max(fontSize * 1.35, label.length * fontSize * 0.62 + fontSize * 0.48);
        const height = fontSize * 1.05;
        parent.appendChild(svgEl('rect', {
            class: 'trace-slider-radial-label-bg',
            x: (p.x - width / 2).toFixed(2),
            y: (p.y - height / 2).toFixed(2),
            width: width.toFixed(2),
            height: height.toFixed(2),
            style: 'fill:rgba(255,255,255,.92);stroke:rgba(18,22,25,.42);stroke-width:.75;vector-effect:non-scaling-stroke;'
        }));
        const attrs = typographyAttrs(element);
        const text = svgEl('text', {
            class: 'trace-slider-radial-label',
            x: p.x,
            y: p.y,
            'font-size': fontSize,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            ...attrs,
            style: `${attrs.style};fill:#101418;stroke:none;font-weight:700;`
        });
        text.textContent = label;
        parent.appendChild(text);
    }

    function renderRing(parent, element) {
        if (isLegacyWindSliderIntermediateRing(element)) return;
        const cal = activeCalibration();
        const startAngle = Number(element.startAngle ?? -180);
        const endAngle = Number(element.endAngle ?? 180);
        const radius = Number(element.radius || 0);
        const span = angleDelta(startAngle, endAngle);
        const commonAttrs = {
            class: `trace-ring ${selectedClass(element)} ${elementDiscClass(element)}`,
            'data-trace-id': element.id,
            style: traceElementStrokeStyle(element)
        };
        if (span > 0.1 && span < 359.9) {
            parent.appendChild(svgEl('path', {
                ...commonAttrs,
                d: arcPath(radius, startAngle, endAngle)
            }));
            return;
        }
        parent.appendChild(svgEl('circle', {
            ...commonAttrs,
            cx: cal.cx,
            cy: cal.cy,
            r: radius
        }));
    }

    function renderWindow(parent, element) {
        const group = svgEl('g', {
            class: `${selectedClass(element)} ${elementDiscClass(element)}`,
            'data-trace-id': element.id
        });
        group.appendChild(svgEl('path', {
            class: `trace-window ${selectedClass(element)}`,
            d: sectorPath(Number(element.innerRadius || 0), Number(element.outerRadius || 0), Number(element.startAngle || 0), Number(element.endAngle || 0))
        }));
        const innerStart = polarPoint(Number(element.innerRadius || 0), Number(element.startAngle || 0));
        const outerStart = polarPoint(Number(element.outerRadius || 0), Number(element.startAngle || 0));
        const innerEnd = polarPoint(Number(element.innerRadius || 0), Number(element.endAngle || 0));
        const outerEnd = polarPoint(Number(element.outerRadius || 0), Number(element.endAngle || 0));
        group.appendChild(svgEl('line', { class: 'trace-window-edge', x1: innerStart.x, y1: innerStart.y, x2: outerStart.x, y2: outerStart.y }));
        group.appendChild(svgEl('line', { class: 'trace-window-edge', x1: innerEnd.x, y1: innerEnd.y, x2: outerEnd.x, y2: outerEnd.y }));
        parent.appendChild(group);
    }

    function renderScale(parent, element) {
        const group = svgEl('g', {
            class: `trace-scale ${selectedClass(element)} ${elementDiscClass(element)}`,
            'data-trace-id': element.id
        });
        group.appendChild(svgEl('path', {
            class: 'trace-scale-guide',
            d: arcPath(Number(element.radius || 0), Number(element.startAngle || 0), Number(element.endAngle || 0))
        }));
        const minorValues = parseNumberList(element.minorValuesText);
        const mediumValues = parseNumberList(element.mediumValuesText);
        const majorValues = parseNumberList(element.valuesText);
        minorValues.forEach(item => renderTick(group, element, item, 'minor'));
        mediumValues.forEach(item => renderTick(group, element, item, 'medium'));
        majorValues.forEach(item => renderTick(group, element, item, 'major'));
        parent.appendChild(group);
    }

    function renderTick(parent, scale, item, tickKind) {
        const kind = tickKind === true ? 'major' : tickKind || 'minor';
        const major = kind === 'major';
        const angle = valueAngle(scale, item.value);
        const radius = Number(scale.radius || 0);
        const tickLength = tickLengthForKind(scale, kind);
        const a = polarPoint(radius, angle);
        const b = polarPoint(radius + tickLength, angle);
        const calibrationAngle = major ? calibrationPointAngle(scale, item.value) : null;
        const calibrated = calibrationAngle !== null;
        const showCalibrationMarker = !isPreviewMode() && calibrated && state.image.showCalibrationMarkers !== false;
        const tickParent = major ? svgEl('g', {
            class: `trace-scale-point ${showCalibrationMarker ? 'calibrated' : ''}`,
            'data-trace-id': scale.id,
            'data-scale-value': item.value,
            'data-scale-label': item.label,
            'data-calibration-angle': showCalibrationMarker ? calibrationAngle : null
        }) : parent;
        if (showCalibrationMarker) {
            const title = svgEl('title');
            title.textContent = `${scale.label || scale.id}: ${item.label} | Wert ${formatPointNumber(item.value)} | Winkel ${formatPointNumber(calibrationAngle)} deg`;
            tickParent.appendChild(title);
        }
        tickParent.appendChild(svgEl('line', {
            class: `trace-tick ${kind}`,
            x1: a.x,
            y1: a.y,
            x2: b.x,
            y2: b.y
        }));
        if (major) {
            const labelRadius = Number(scale.labelRadius || radius + tickLength + 22);
            const p = polarPoint(labelRadius, angle);
            const hitRadius = Math.max(20, Number(scale.fontSize || 24) * 0.62);
            tickParent.appendChild(svgEl('circle', {
                class: 'trace-point-hitbox',
                cx: p.x,
                cy: p.y,
                r: hitRadius
            }));
            const text = svgEl('text', {
                class: 'trace-number',
                x: p.x,
                y: p.y,
                'font-size': Number(scale.fontSize || 24),
                'text-anchor': 'middle',
                'dominant-baseline': 'middle',
                ...typographyAttrs(scale),
                transform: `rotate(${scaleLabelRotation(scale, angle).toFixed(2)} ${p.x.toFixed(2)} ${p.y.toFixed(2)})`
            });
            text.textContent = item.label;
            tickParent.appendChild(text);
            if (showCalibrationMarker) {
                const marker = polarPoint(radius + tickLength * 0.54, angle);
                tickParent.appendChild(svgEl('circle', {
                    class: 'trace-calibration-marker',
                    cx: marker.x,
                    cy: marker.y,
                    r: 9
                }));
            }
            parent.appendChild(tickParent);
        }
    }

    function scaleLabelRotation(scale, angle) {
        const baseRotation = angle + activeCalibration().rotation + 90;
        const textRotation = Number(scale.textRotation);
        return baseRotation + (Number.isFinite(textRotation) ? textRotation : 0);
    }

    function tickLengthForKind(scale, kind) {
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

    function renderLabel(parent, element) {
        const angle = Number(element.startAngle || 0);
        if (isArcText(element)) {
            renderArcText(
                parent,
                element,
                element.text || element.label || '',
                Number(element.radius || 0),
                angle,
                `trace-label ${selectedClass(element)} ${elementDiscClass(element)}`
            );
            return;
        }
        const p = polarPoint(Number(element.radius || 0), angle);
        const text = svgEl('text', {
            class: `trace-label ${selectedClass(element)} ${elementDiscClass(element)}`,
            x: p.x,
            y: p.y,
            'font-size': Number(element.fontSize || 28),
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            ...typographyAttrs(element),
            transform: `rotate(${orientedTextRotation(element, angle).toFixed(2)} ${p.x.toFixed(2)} ${p.y.toFixed(2)})`,
            'data-trace-id': element.id
        });
        String(element.text || element.label || '')
            .split(/\\n|\n/)
            .forEach((line, index, lines) => {
                const tspan = svgEl('tspan', {
                    x: p.x,
                    dy: index === 0 ? `${-(lines.length - 1) * 0.55}em` : '1.1em'
                });
                tspan.textContent = line;
                text.appendChild(tspan);
        });
        parent.appendChild(text);
    }

    function renderIndex(parent, element) {
        const geometry = indexGeometry(element);
        const group = svgEl('g', {
            class: `trace-index ${selectedClass(element)} ${elementDiscClass(element)}`,
            'data-trace-id': element.id
        });
        group.appendChild(svgEl('path', {
            class: 'trace-index-head',
            d: [
                `M ${geometry.tip.x.toFixed(2)} ${geometry.tip.y.toFixed(2)}`,
                `L ${geometry.left.x.toFixed(2)} ${geometry.left.y.toFixed(2)}`,
                `L ${geometry.right.x.toFixed(2)} ${geometry.right.y.toFixed(2)}`,
                'Z'
            ].join(' ')
        }));
        if (geometry.stemLength) {
            group.appendChild(svgEl('line', {
                class: 'trace-index-stem',
                x1: geometry.base.x,
                y1: geometry.base.y,
                x2: geometry.stemEnd.x,
                y2: geometry.stemEnd.y
            }));
        }
        group.appendChild(svgEl('circle', {
            class: 'trace-index-hitbox',
            cx: geometry.center.x,
            cy: geometry.center.y,
            r: Math.max(24, Math.abs(geometry.length) / 2 + Math.abs(Number(element.indexWidth || 0)) / 2)
        }));
        if (element.text) {
            const angle = Number(element.startAngle || 0);
            const labelAngle = angle + Number(element.labelAngleOffset || 0);
            const labelRadius = Number(element.labelRadius || Number(element.radius || 0) + Number(element.indexLength || 0) + 44);
            if (isArcText(element)) {
                renderArcText(group, element, element.text || '', labelRadius, labelAngle, 'trace-index-label');
                parent.appendChild(group);
                return;
            }
            const p = polarPoint(labelRadius, labelAngle);
            const text = svgEl('text', {
                class: 'trace-index-label',
                x: p.x,
                y: p.y,
                'font-size': Number(element.fontSize || 24),
                'text-anchor': 'middle',
                'dominant-baseline': 'middle',
                ...typographyAttrs(element),
                transform: `rotate(${orientedTextRotation(element, labelAngle).toFixed(2)} ${p.x.toFixed(2)} ${p.y.toFixed(2)})`
            });
            String(element.text || '')
                .split(/\\n|\n/)
                .forEach((line, index, lines) => {
                    const tspan = svgEl('tspan', {
                        x: p.x,
                        dy: index === 0 ? `${-(lines.length - 1) * 0.55}em` : '1.1em'
                    });
                    tspan.textContent = line;
                    text.appendChild(tspan);
                });
            group.appendChild(text);
        }
        parent.appendChild(group);
    }

    function renderRadial(parent, element) {
        const angle = Number(element.startAngle || 0);
        renderSingleRadial(parent, element, angle);
        const mirrorAxis = Number(element.mirrorAxis);
        if (Number.isFinite(mirrorAxis)) {
            const mirroredAngle = mirrorAngleAround(angle, mirrorAxis);
            if (Math.abs(normalizeAngle(mirroredAngle - angle)) > 0.01) {
                renderSingleRadial(parent, element, mirroredAngle);
            }
        }
    }

    function renderSingleRadial(parent, element, angle) {
        const innerRadius = windSliderElementRadius(element, 'innerRadius', 'innerValue', WIND_SLIDER_MIN_RADIUS_VALUE);
        const outerRadius = windSliderElementRadius(element, 'outerRadius', 'outerValue', WIND_SLIDER_MAX_RADIUS_VALUE);
        const inner = polarPoint(innerRadius, angle);
        const outer = polarPoint(outerRadius, angle);
        const variant = element.variant ? ` ${String(element.variant).replace(/[^a-z0-9_-]/gi, '-')}` : '';
        parent.appendChild(svgEl('line', {
            class: `trace-radial${variant} ${selectedClass(element)} ${elementDiscClass(element)}`,
            x1: inner.x,
            y1: inner.y,
            x2: outer.x,
            y2: outer.y,
            'data-trace-id': element.id,
            style: traceElementStrokeStyle(element, angle)
        }));
    }

    function renderCircle(parent, element) {
        const center = polarPoint(Number(element.radius || 0), Number(element.startAngle || 0));
        parent.appendChild(svgEl('circle', {
            class: `trace-circle ${selectedClass(element)} ${elementDiscClass(element)}`,
            cx: center.x,
            cy: center.y,
            r: Math.max(0, Number(element.outerRadius || element.innerRadius || 40)),
            'data-trace-id': element.id,
            style: traceShapeStyle(element)
        }));
    }

    function renderLine(parent, element) {
        const start = polarPoint(Number(element.innerRadius || 0), Number(element.startAngle || 0));
        const end = polarPoint(Number(element.outerRadius || element.radius || 0), Number(element.endAngle ?? element.startAngle ?? 0));
        parent.appendChild(svgEl('line', {
            class: `trace-line ${selectedClass(element)} ${elementDiscClass(element)}`,
            x1: start.x,
            y1: start.y,
            x2: end.x,
            y2: end.y,
            'data-trace-id': element.id,
            style: traceElementStrokeStyle(element)
        }));
    }

    function renderPolygon(parent, element) {
        const points = polygonPoints(element);
        if (points.length < 2) return;
        parent.appendChild(svgEl('polygon', {
            class: `trace-polygon ${selectedClass(element)} ${elementDiscClass(element)}`,
            points: points.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '),
            'data-trace-id': element.id,
            style: traceShapeStyle(element)
        }));
    }

    function polygonPoints(element) {
        const text = String(element.pointsText || element.valuesText || '');
        const points = [];
        text.split(/\n|;/).forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;
            let match = trimmed.match(/^(-?\d+(?:[.,]\d+)?)\s*[:=\/]\s*(-?\d+(?:[.,]\d+)?)$/);
            if (!match) match = trimmed.match(/^(-?\d+(?:[.,]\d+)?)\s*,\s*(-?\d+(?:[.,]\d+)?)$/);
            if (!match) return;
            const angle = Number(match[1].replace(',', '.'));
            const radius = Number(match[2].replace(',', '.'));
            if (Number.isFinite(angle) && Number.isFinite(radius)) points.push(polarPoint(radius, angle));
        });
        if (points.length >= 2) return points;
        const innerRadius = Number(element.innerRadius || Math.max(0, Number(element.radius || 380) - 40));
        const outerRadius = Number(element.outerRadius || Number(element.radius || 420));
        const startAngle = Number(element.startAngle ?? -140);
        const endAngle = Number(element.endAngle ?? -40);
        return [
            polarPoint(innerRadius, startAngle),
            polarPoint(outerRadius, startAngle),
            polarPoint(outerRadius, endAngle),
            polarPoint(innerRadius, endAngle)
        ];
    }

    function renderTextBox(parent, element) {
        const center = polarPoint(Number(element.radius || 0), Number(element.startAngle || 0));
        const width = Math.max(1, Number(element.innerRadius || element.width || 520));
        const height = Math.max(1, Number(element.outerRadius || element.height || 120));
        const corner = Math.max(0, Number(element.endAngle || element.cornerRadius || 0));
        const rotation = Number(element.textRotation || 0);
        const group = svgEl('g', {
            class: `trace-text-box ${selectedClass(element)} ${elementDiscClass(element)}`,
            'data-trace-id': element.id,
            transform: Number.isFinite(rotation) && Math.abs(rotation) > 0.001
                ? `rotate(${rotation.toFixed(2)} ${center.x.toFixed(2)} ${center.y.toFixed(2)})`
                : null
        });
        group.appendChild(svgEl('rect', {
            class: 'trace-text-box-bg',
            x: (center.x - width / 2).toFixed(2),
            y: (center.y - height / 2).toFixed(2),
            width: width.toFixed(2),
            height: height.toFixed(2),
            rx: corner,
            ry: corner,
            style: textBoxRectStyle(element)
        }));
        const fontSize = Number(element.fontSize || 28);
        const lines = String(element.text || element.label || '').split(/\\n|\n/);
        const lineGap = fontSize * 1.12;
        const offsetX = Number(element.textOffsetX || 0);
        const offsetY = Number(element.textOffsetY || 0);
        const textX = center.x + (Number.isFinite(offsetX) ? offsetX : 0);
        const textY = center.y + (Number.isFinite(offsetY) ? offsetY : 0);
        const text = svgEl('text', {
            class: 'trace-text-box-label',
            x: textX,
            y: textY - ((lines.length - 1) * lineGap) / 2,
            'font-size': fontSize,
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            ...typographyAttrs(element),
            style: textBoxTextStyle(element)
        });
        lines.forEach((line, index) => {
            const tspan = svgEl('tspan', {
                x: textX,
                dy: index === 0 ? 0 : lineGap
            });
            tspan.textContent = line;
            text.appendChild(tspan);
        });
        group.appendChild(text);
        parent.appendChild(group);
    }

    function renderControlAnchor(parent, element) {
        const angle = Number(element.startAngle || 0);
        const center = polarPoint(Number(element.radius || 0), angle);
        const size = Math.max(20, Number(element.outerRadius || element.fontSize || 40));
        const action = controlAnchorAction(element);
        const group = svgEl('g', {
            class: `trace-control-anchor ${selectedClass(element)} ${elementDiscClass(element)}`,
            'data-trace-id': element.id
        });
        group.appendChild(svgEl('circle', {
            class: 'trace-control-anchor-dot',
            cx: center.x,
            cy: center.y,
            r: size / 2,
            style: 'fill:rgba(245,202,67,.82);stroke:#101418;stroke-width:2;vector-effect:non-scaling-stroke;'
        }));
        const label = svgEl('text', {
            class: 'trace-control-anchor-label',
            x: center.x,
            y: center.y,
            'font-size': Math.max(12, Number(element.fontSize || size * 0.42)),
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            ...typographyAttrs(element),
            style: 'fill:#101418;stroke:none;font-weight:900;'
        });
        label.textContent = controlAnchorGlyph(action);
        group.appendChild(label);
        parent.appendChild(group);
    }

    function traceElementStrokeStyle(element, angle = Number(element && element.startAngle || 0)) {
        const dynamicRadialStyle = windSliderRadialStyle(element, angle);
        if (dynamicRadialStyle) return dynamicRadialStyle;
        const parts = [];
        const strokeWidth = Number(element.strokeWidth);
        const strokeOpacity = Number(element.strokeOpacity);
        if (Number.isFinite(strokeWidth)) parts.push(`stroke-width:${Math.max(0, strokeWidth)}`);
        if (Number.isFinite(strokeOpacity)) parts.push(`opacity:${clamp(strokeOpacity, 0, 1)}`);
        if (element.strokeDasharray) parts.push(`stroke-dasharray:${element.strokeDasharray}`);
        return parts.length ? parts.join(';') : undefined;
    }

    function traceShapeStyle(element) {
        const parts = [traceElementStrokeStyle(element)].filter(Boolean);
        const fillOpacity = Number(element.fillOpacity);
        parts.push(Number.isFinite(fillOpacity) && fillOpacity > 0
            ? `fill:rgba(210,216,220,${clamp(fillOpacity, 0, 1)})`
            : 'fill:none');
        return parts.join(';');
    }

    function textBoxRectStyle(element) {
        const fillOpacity = Number(element.fillOpacity);
        const strokeWidth = Number(element.strokeWidth);
        const strokeOpacity = Number(element.strokeOpacity);
        return [
            `fill:${element.backgroundFill || '#101418'}`,
            `fill-opacity:${Number.isFinite(fillOpacity) ? clamp(fillOpacity, 0, 1) : 1}`,
            `stroke:${element.stroke || element.backgroundFill || '#101418'}`,
            `stroke-width:${Number.isFinite(strokeWidth) ? Math.max(0, strokeWidth) : 0}`,
            `stroke-opacity:${Number.isFinite(strokeOpacity) ? clamp(strokeOpacity, 0, 1) : 1}`,
            'vector-effect:non-scaling-stroke'
        ].join(';');
    }

    function textBoxTextStyle(element) {
        const attrs = typographyAttrs(element);
        return `${attrs.style};fill:${element.textFill || '#f7f1df'};stroke:${element.textStroke || 'none'};`;
    }

    function renderElementSelect() {
        const select = qs('#elementSelect');
        if (!select) return;
        ensureVisibleSelection();
        select.replaceChildren();
        visibleElementsForWorkface().forEach(element => {
            const option = document.createElement('option');
            option.value = element.id;
            option.textContent = `[${SURFACE_LABELS[elementSurface(element)] || elementSurface(element)}] ${element.type}: ${element.label || element.id}`;
            select.appendChild(option);
        });
        select.value = (selectedElement() || {}).id || '';
    }

    function renderDiscSelectOptions() {
        const select = qs('#editDisc');
        if (!select) return;
        const selected = select.value;
        const allowed = workfaceSurfaces();
        select.replaceChildren();
        allowed.forEach(surface => {
            const option = document.createElement('option');
            option.value = surface;
            option.textContent = SURFACE_LABELS[surface] || surface;
            select.appendChild(option);
        });
        if (allowed.includes(selected)) select.value = selected;
    }

    function renderCalibrationSurfaceSelect() {
        const select = qs('#calSurfaceSelect');
        if (!select) return;
        const allowed = workfaceSurfaces();
        const selected = activeSurface();
        select.replaceChildren();
        allowed.forEach(surface => {
            const option = document.createElement('option');
            option.value = surface;
            option.textContent = SURFACE_LABELS[surface] || surface;
            select.appendChild(option);
        });
        select.value = selected;
    }

    function setInput(id, value) {
        const input = qs(`#${id}`);
        if (input && input.value !== String(value ?? '')) input.value = value ?? '';
    }

    function clearElementEditor() {
        ELEMENT_EDITOR_FIELD_IDS.forEach(id => setInput(id, ''));
    }

    function renderEditor() {
        const element = selectedElement();
        const cal = activeCalibration();
        renderDiscSelectOptions();
        renderCalibrationSurfaceSelect();
        setInput('workfaceSelect', state.workface);
        setInput('scanPresetSelect', scanPresetForCurrentImage());
        setInput('calCx', round(cal.cx));
        setInput('calCy', round(cal.cy));
        setInput('calRadius', round(cal.radius));
        setInput('calInnerRadius', round(cal.innerRadius ?? 0));
        setInput('calRotation', round(cal.rotation));
        setInput('calOutlineWidth', round(cal.outlineWidth ?? 5));
        setInput('calInnerOutlineWidth', round(cal.innerOutlineWidth ?? cal.outlineWidth ?? 5));
        setInput('calCornerRadius', round(cal.cornerRadius ?? 0));
        setInput('calFillOpacity', cal.fillOpacity ?? 1);
        const activeSurfaceStatus = qs('#activeSurfaceStatus');
        if (activeSurfaceStatus) {
            const surface = activeSurface();
            const suffix = surface === 'wind-slider'
                ? ' - Center Y verschiebt das Kreiszentrum des Schiebers nach oben/unten.'
                : '';
            activeSurfaceStatus.textContent = `Normalisierung aktiv: ${SURFACE_LABELS[surface] || surface}${suffix}`;
        }
        setInput('helperRadialAngle', round(state.guide.angle));
        setInput('previewFrontRadius', state.preview.frontRadius || 0);
        setInput('previewWindRotation', state.preview.windRotation || 0);
        setInput('previewSliderY', state.preview.sliderY || 0);
        const scanAlignment = activeScanAlignment();
        setInput('scanOffsetX', round(scanAlignment.x || 0));
        setInput('scanOffsetY', round(scanAlignment.y || 0));
        setInput('scanRotation', round(scanAlignment.rotation || 0));
        setInput('imageOpacity', state.image.opacity);
        setInput('overlayOpacity', state.image.overlayOpacity);
        setInput('globalFontFamily', state.typography.fontFamily ?? DEFAULT_TYPOGRAPHY.fontFamily);
        setInput('globalFontWidth', effectiveFontWidth(null));
        setInput('globalFontWeight', effectiveFontWeight(null));
        qs('#showScan').checked = !!state.image.showScan;
        qs('#showOverlay').checked = !!state.image.showOverlay;
        qs('#showCalibrationMarkers').checked = state.image.showCalibrationMarkers !== false;
        qs('#showHelperRadial').checked = !!state.guide.show;
        if (!element) {
            clearElementEditor();
            return;
        }
        setInput('editLabel', element.label || '');
        setInput('editType', element.type || '');
        setInput('editDisc', elementDisc(element));
        setInput('editRadius', element.radius ?? '');
        setInput('editLabelRadius', element.labelRadius ?? '');
        setInput('editStartAngle', element.startAngle ?? '');
        setInput('editEndAngle', element.endAngle ?? '');
        setInput('editInnerRadius', element.innerRadius ?? '');
        setInput('editOuterRadius', element.outerRadius ?? '');
        setInput('editMinorTick', element.minorTick ?? '');
        setInput('editMediumTick', element.mediumTick ?? '');
        setInput('editMajorTick', element.majorTick ?? '');
        const sliderLineWidths = element.type === 'slider-radius-grid' ? windSliderLineWidths(element) : null;
        setInput('editThinLineWidth', element.thinLineWidth ?? (sliderLineWidths ? sliderLineWidths.thin : ''));
        setInput('editMediumLineWidth', element.mediumLineWidth ?? (sliderLineWidths ? sliderLineWidths.medium : ''));
        setInput('editThickLineWidth', element.thickLineWidth ?? (sliderLineWidths ? sliderLineWidths.thick : ''));
        setInput('editStrokeWidth', element.strokeWidth ?? '');
        setInput('editStrokeOpacity', element.strokeOpacity ?? '');
        setInput('editFillOpacity', element.fillOpacity ?? '');
        setInput('editFontSize', element.fontSize ?? '');
        setInput('editFontFamily', element.fontFamily || '');
        setInput('editFontWidth', FONT_WIDTH_VALUES.has(element.fontWidth) ? element.fontWidth : '');
        setInput('editFontWeight', FONT_WEIGHT_VALUES.has(element.fontWeight) ? element.fontWeight : '');
        setInput('editTextRotation', element.textRotation ?? '');
        setInput('editTextOffsetX', element.textOffsetX ?? '');
        setInput('editTextOffsetY', element.textOffsetY ?? '');
        setInput('editTextOrientation', textOrientation(element));
        setInput('editLabelAngleOffset', element.labelAngleOffset ?? 0);
        setInput('editIndexLength', element.indexLength ?? '');
        setInput('editIndexWidth', element.indexWidth ?? '');
        setInput('editStemLength', element.stemLength ?? '');
        setInput('editValues', element.type === 'label' || element.type === 'index' || element.type === 'text-box' || element.type === 'control-anchor'
            ? (element.text || '')
            : element.type === 'polygon'
                ? (element.pointsText || element.valuesText || '')
                : (element.valuesText || ''));
        setInput('editMediumValues', element.mediumValuesText || '');
        setInput('editMinorValues', element.minorValuesText || '');
        setInput('editCalibration', element.calibrationText || '');
    }

    function renderExport() {
        const output = qs('#jsonExport');
        if (!output) return;
        output.value = JSON.stringify({
            image: {
                width: state.image.width,
                height: state.image.height
            },
            calibration: state.calibration,
            wind: windStorageState(),
            scanAlignment: scanAlignmentSnapshot(),
            workface: state.workface,
            typography: state.typography,
            controls: {
                front: runtimeControlAnchors('front'),
                wind: runtimeControlAnchors('wind')
            },
            elements: state.elements
        }, null, 2);
    }

    function runtimeControlSurfaces(side) {
        return side === 'wind'
            ? ['wind-rotor-back', 'wind-rotor-front']
            : ['back', 'front'];
    }

    function runtimeControlAnchors(side) {
        const surfaces = runtimeControlSurfaces(side);
        return state.elements
            .filter(element => element.type === 'control-anchor' && surfaces.includes(elementSurface(element)))
            .reduce((result, element) => {
                const action = controlAnchorAction(element);
                if (!CONTROL_ANCHOR_ACTIONS.has(action)) return result;
                const surface = elementSurface(element);
                const point = withCalibration(calibrationForSurface(surface), () => polarPoint(Number(element.radius || 0), Number(element.startAngle || 0)));
                result[action] = {
                    action,
                    surface,
                    x: round(point.x),
                    y: round(point.y),
                    radius: round(Number(element.radius || 0)),
                    angle: round(Number(element.startAngle || 0))
                };
                return result;
            }, {});
    }

    function renderPublishedFrontStatus() {
        const status = qs('#publishedFrontStatus');
        if (!status) return;
        const savedAt = publishedFrontSavedAt();
        status.textContent = savedAt ? `In E6B gespeichert: ${formatDateTime(savedAt)}` : 'Noch kein E6B-Stand gespeichert.';
    }

    function renderPublishedWindStatus() {
        const status = qs('#publishedWindStatus');
        if (!status) return;
        const savedAt = publishedWindSavedAt();
        status.textContent = savedAt ? `Wind gespeichert: ${formatDateTime(savedAt)}` : 'Noch kein Wind-Stand gespeichert.';
    }

    function publishedFrontSavedAt() {
        try {
            const saved = JSON.parse(localStorage.getItem(PUBLISHED_FRONT_STORAGE_KEY) || 'null');
            return saved && saved.savedAt ? saved.savedAt : '';
        } catch (_) {
            return '';
        }
    }

    function publishedWindSavedAt() {
        try {
            const saved = JSON.parse(localStorage.getItem(PUBLISHED_WIND_STORAGE_KEY) || 'null');
            return saved && saved.savedAt ? saved.savedAt : '';
        } catch (_) {
            return '';
        }
    }

    function formatDateTime(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value || '');
        return date.toLocaleString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    async function publishFrontDisc() {
        const status = qs('#publishedFrontStatus');
        if (!frontSaveAllowed()) {
            if (status) {
                status.textContent = 'Front nicht gespeichert: Bitte Arbeitsflaeche Vorderseite mit Front-Scan waehlen. Fuer die Rueckseite Wind speichern nutzen.';
            }
            return;
        }
        const snapshot = {
            version: 1,
            savedAt: new Date().toISOString(),
            source: storageState(),
            viewBox: {
                width: state.image.width,
                height: state.image.height,
                cx: state.calibration.cx,
                cy: state.calibration.cy,
                radius: state.calibration.radius
            },
            runtime: runtimeExportMetadata('front'),
            controls: runtimeControlAnchors('front'),
            svgs: {
                back: renderRuntimeDiscSvg('back'),
                front: renderRuntimeDiscSvg('front')
            }
        };
        try {
            localStorage.setItem(PUBLISHED_FRONT_STORAGE_KEY, JSON.stringify(snapshot));
        } catch (error) {
            if (status) status.textContent = 'Browser-Kopie fehlgeschlagen: Speicher voll oder blockiert.';
        }

        if (status) status.textContent = 'Speichere e6b/e6b-workbench-front-disc.json ...';
        try {
            const response = await fetch(PUBLISHED_FRONT_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(snapshot)
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const result = await response.json();
            if (status) {
                status.textContent = `Gespeichert: ${result.path || 'e6b/e6b-workbench-front-disc.json'} (${Math.round(Number(result.bytes || 0) / 1024)} KB).`;
            }
        } catch (error) {
            if (status) {
                status.textContent = 'Nur Browser-Kopie gespeichert. Repo-Datei nicht geschrieben: Workbench bitte über start-e6b-workbench.command starten.';
            }
        }
    }

    async function publishWindDisc() {
        const status = qs('#publishedWindStatus');
        if (!windSaveAllowed()) {
            if (status) {
                status.textContent = 'Wind nicht gespeichert: Bitte Rueckseite Drehscheibe oder Rueckseite Schieber waehlen.';
            }
            return;
        }
        const snapshot = {
            version: 1,
            savedAt: new Date().toISOString(),
            source: storageState(),
            viewBox: {
                width: state.image.width,
                height: state.image.height
            },
            wind: windStorageState(),
            runtime: runtimeExportMetadata('wind'),
            controls: runtimeControlAnchors('wind'),
            svgs: {
                slider: renderRuntimeDiscSvg('wind-slider'),
                rotor: renderRuntimeDiscSvg('wind-rotor-front'),
                rotorBack: renderRuntimeDiscSvg('wind-rotor-back'),
                rotorFront: renderRuntimeDiscSvg('wind-rotor-front')
            }
        };
        try {
            localStorage.setItem(PUBLISHED_WIND_STORAGE_KEY, JSON.stringify(snapshot));
        } catch (error) {
            if (status) status.textContent = 'Browser-Kopie Wind fehlgeschlagen: Speicher voll oder blockiert.';
        }

        if (status) status.textContent = 'Speichere e6b/e6b-workbench-wind-disc.json ...';
        try {
            const response = await fetch(PUBLISHED_WIND_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(snapshot)
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const result = await response.json();
            if (status) {
                status.textContent = `Gespeichert: ${result.path || 'e6b/e6b-workbench-wind-disc.json'} (${Math.round(Number(result.bytes || 0) / 1024)} KB).`;
            }
        } catch (error) {
            if (status) {
                status.textContent = 'Nur Browser-Kopie gespeichert. Repo-Datei nicht geschrieben: Workbench bitte ueber start-e6b-workbench.command starten.';
            }
        }
    }

    function renderStandaloneDiscSvg(disc) {
        const previousMode = state.mode;
        const previousImageSize = { width: state.image.width, height: state.image.height };
        const size = standaloneSurfaceSize(disc);
        state.mode = 'preview';
        state.image.width = size.width;
        state.image.height = size.height;
        try {
            const cal = calibrationForSurface(disc);
            const svg = svgEl('svg', {
                xmlns: SVG_NS,
                viewBox: `0 0 ${size.width} ${size.height}`,
                role: 'img',
                'aria-label': standaloneSurfaceLabel(disc),
                preserveAspectRatio: 'xMidYMid meet'
            });
            const style = svgEl('style');
            style.textContent = standaloneSvgStyle();
            svg.appendChild(style);
            const group = svgEl('g', { class: `trace-preview-disc trace-preview-${disc}` });
            withCalibration(cal, () => {
                if (disc === 'wind-slider') {
                    renderSliderMaskedLayer(group, 'trace-slider-standalone-mask');
                } else {
                    renderPreviewDiscSurface(group, disc);
                    state.elements
                        .filter(element => elementSurface(element) === disc)
                        .forEach(element => renderTraceElement(group, element));
                }
                if (disc === 'wind-rotor-front') renderWindMarkedPoint(group);
            });
            svg.appendChild(group);
            return svg.outerHTML;
        } finally {
            state.mode = previousMode;
            state.image.width = previousImageSize.width;
            state.image.height = previousImageSize.height;
        }
    }

    function renderRuntimeDiscSvg(disc) {
        return optimizeRuntimeSvg(renderStandaloneDiscSvg(disc), disc);
    }

    function runtimeExportMetadata(side) {
        return {
            side,
            format: 'inline-svg',
            optimized: true,
            removes: ['editor-hitboxes', 'data-attributes'],
            generatedAt: new Date().toISOString()
        };
    }

    function optimizeRuntimeSvg(svgText, disc) {
        let doc = null;
        try {
            doc = new DOMParser().parseFromString(String(svgText || ''), 'image/svg+xml');
        } catch (_) {
            return svgText;
        }
        if (!doc || doc.querySelector('parsererror')) return svgText;
        const svg = doc.documentElement;
        if (!svg || String(svg.nodeName || '').toLowerCase() !== 'svg') return svgText;

        svg.setAttribute('style', `${svg.getAttribute('style') || ''};overflow:visible;`.replace(/^;/, ''));
        svg.querySelectorAll('.trace-index-hitbox, .trace-point-hitbox, .trace-calibration-marker, .trace-control-anchor').forEach(element => element.remove());
        svg.querySelectorAll('*').forEach(element => {
            Array.from(element.attributes || []).forEach(attribute => {
                if (attribute.name.startsWith('data-')) element.removeAttribute(attribute.name);
            });
        });
        svg.setAttribute('data-e6b-runtime', '1');

        const style = svg.querySelector('style');
        if (style) style.textContent = runtimeSvgStyle(style.textContent, disc);

        try {
            return new XMLSerializer().serializeToString(svg);
        } catch (_) {
            return svg.outerHTML || svgText;
        }
    }

    function runtimeSvgStyle(existingStyle, disc) {
        const extra = [
            'svg{overflow:visible;}',
            '.trace-index-hitbox,.trace-point-hitbox,.trace-calibration-marker,.trace-control-anchor{display:none!important;}'
        ];
        if (disc === 'wind-slider') {
            extra.push('.trace-preview-slider-surface{fill:#d2d8dc!important;fill-opacity:1!important;opacity:1!important;}');
        }
        return `${existingStyle || ''}\n${extra.join('\n')}`;
    }

    function standaloneSurfaceSize(surface) {
        const normalized = normalizeSurface(surface);
        if (normalized === 'wind-slider') {
            return { width: SCAN_PRESETS['wind-slider'].width, height: SCAN_PRESETS['wind-slider'].height };
        }
        if (normalized === 'wind-rotor-back' || normalized === 'wind-rotor-front') {
            return { width: SCAN_PRESETS['wind-rotor'].width, height: SCAN_PRESETS['wind-rotor'].height };
        }
        return { width: state.image.width, height: state.image.height };
    }

    function standaloneSurfaceLabel(surface) {
        if (surface === 'front') return 'E6B Frontscheibe';
        if (surface === 'back') return 'E6B Hintergrundscheibe';
        if (surface === 'wind-slider') return 'E6B Windschieber';
        if (surface === 'wind-rotor-back') return 'E6B Windrotor Hintergrundscheibe';
        if (surface === 'wind-rotor-front') return 'E6B Windrotor Vorderdrehscheibe';
        return 'E6B Element';
    }

    function standaloneSvgStyle() {
        return `
            .trace-preview-back-surface{fill:#d1d5d8;}
            .trace-preview-front-surface{fill:#c5cacf;}
            .trace-preview-wind-rotor-back-surface{fill:#d0d4d7;}
            .trace-preview-wind-rotor-front-surface{fill:#c9cdd1;fill-opacity:0;}
            .trace-preview-surface-outline{fill:none;stroke:rgba(18,22,25,.82);vector-effect:non-scaling-stroke;}
            .trace-preview-slider-surface{fill:rgba(210,216,220,.72);stroke:rgba(18,22,25,.7);stroke-width:2;vector-effect:non-scaling-stroke;}
            .trace-slider-origin{fill:#101418;stroke:none;}
            .trace-wind-marked-point{fill:#3757ff;stroke:#fff;stroke-width:4;vector-effect:non-scaling-stroke;}
            .trace-ring,.trace-radial,.trace-circle,.trace-line,.trace-polygon,.trace-scale-guide{fill:none;stroke:rgba(18,22,25,.74);stroke-width:1.4;vector-effect:non-scaling-stroke;}
            .trace-radial.fine{opacity:.42;}
            .trace-slider-radius-line{fill:none;stroke:rgba(18,22,25,.28);stroke-width:.55;vector-effect:non-scaling-stroke;}
            .trace-slider-radius-line.major{stroke:rgba(18,22,25,.68);stroke-width:1.2;}
            .trace-slider-radial-emphasis{fill:none;stroke:rgba(18,22,25,.68);vector-effect:non-scaling-stroke;}
            .trace-slider-radius-label-bg{fill:rgba(255,255,255,.94);stroke:rgba(18,22,25,.48);stroke-width:.9;vector-effect:non-scaling-stroke;}
            .trace-slider-radius-label{fill:#101418;stroke:none;font-weight:700;}
            .trace-slider-radial-label-bg{fill:rgba(255,255,255,.92);stroke:rgba(18,22,25,.42);stroke-width:.75;vector-effect:non-scaling-stroke;}
            .trace-slider-radial-label{fill:#101418;stroke:none;font-weight:700;}
            .trace-text-box-bg{fill:#101418;stroke:#101418;vector-effect:non-scaling-stroke;}
            .trace-text-box-label{fill:#f7f1df;stroke:none;paint-order:stroke;}
            .trace-window{fill:rgba(255,255,255,.03);stroke:rgba(18,22,25,.78);stroke-width:2;vector-effect:non-scaling-stroke;}
            .trace-window-edge{stroke:rgba(18,22,25,.78);stroke-width:1.3;vector-effect:non-scaling-stroke;}
            .trace-tick{stroke:rgba(18,22,25,.94);stroke-width:1.4;vector-effect:non-scaling-stroke;}
            .trace-tick.medium{stroke-width:1.7;opacity:.9;}
            .trace-tick.major{stroke-width:2.1;}
            .trace-tick.minor{opacity:.72;}
            .trace-number,.trace-label,.trace-index-label{fill:#101418;stroke:rgba(229,233,236,.68);stroke-width:3px;stroke-linejoin:round;paint-order:stroke;}
            .trace-index-head{fill:#101418;stroke:none;}
            .trace-index-stem{stroke:#101418;stroke-width:2.3;vector-effect:non-scaling-stroke;}
            .trace-index-hitbox,.trace-point-hitbox,.trace-calibration-marker{display:none;}
        `;
    }

    function round(value) {
        return Math.round(Number(value || 0) * 10) / 10;
    }

    function bindInputs() {
        Object.entries(CALIBRATION_INPUT_KEYS).forEach(([id, key]) => {
            bindUndoableInput(qs(`#${id}`), 'input', event => {
                const value = parseNumberFieldValue(event.target.value);
                if (value === null) return;
                activeCalibration()[key] = value;
                render();
            });
        });
        qs('#calSurfaceSelect').addEventListener('change', event => {
            pushUndoSnapshot();
            state.calibrationSurface = normalizeCalibrationSurface(event.target.value);
            render();
        });
        qs('#workfaceSelect').addEventListener('change', event => {
            pushUndoSnapshot();
            const nextWorkface = normalizeWorkface(event.target.value);
            applyScanPresetWithOptions(presetForWorkface(nextWorkface), { resetCalibration: false });
            state.workface = nextWorkface;
            ensureCalibrationSurface();
            const visible = state.elements.find(element => elementVisibleOnWorkface(element));
            if (visible) state.selectedId = visible.id;
            render();
        });
        qs('#scanPresetSelect').addEventListener('change', event => {
            if (!event.target.value) return;
            pushUndoSnapshot();
            applyScanPreset(event.target.value);
            render();
        });
        Object.entries(HELPER_INPUT_KEYS).forEach(([id, key]) => {
            bindUndoableInput(qs(`#${id}`), 'input', event => {
                const value = parseNumberFieldValue(event.target.value);
                if (value === null) return;
                state.guide[key] = value;
                render();
            });
        });
        Object.entries(SCAN_ALIGNMENT_INPUT_KEYS).forEach(([id, key]) => {
            bindUndoableInput(qs(`#${id}`), 'input', event => {
                const value = parseNumberFieldValue(event.target.value);
                if (value === null) return;
                activeScanAlignment()[key] = value;
                render();
            });
        });
        qs('#centerScanOnAxis').addEventListener('click', () => {
            pushUndoSnapshot();
            activeScanAlignment().x = round(Number(activeCalibration().cx || 0) - Number(state.image.width || 0) / 2);
            render();
        });
        qs('#resetScanAlignment').addEventListener('click', () => {
            pushUndoSnapshot();
            Object.assign(activeScanAlignment(), defaultScanAlignment());
            render();
        });
        Object.entries(PREVIEW_INPUT_KEYS).forEach(([id, key]) => {
            bindUndoableInput(qs(`#${id}`), 'input', event => {
                const value = parseNumberFieldValue(event.target.value);
                if (value === null) return;
                state.preview[key] = Math.max(0, value);
                render();
            });
        });
        Object.entries(WIND_PREVIEW_INPUT_KEYS).forEach(([id, key]) => {
            bindUndoableInput(qs(`#${id}`), 'input', event => {
                const value = parseNumberFieldValue(event.target.value);
                if (value === null) return;
                state.preview[key] = value;
                render();
            });
        });
        bindUndoableInput(qs('#imageOpacity'), 'input', event => {
            state.image.opacity = Number(event.target.value);
            render();
        });
        bindUndoableInput(qs('#overlayOpacity'), 'input', event => {
            state.image.overlayOpacity = Number(event.target.value);
            render();
        });
        qs('#showScan').addEventListener('change', event => {
            pushUndoSnapshot();
            state.image.showScan = event.target.checked;
            render();
        });
        qs('#showOverlay').addEventListener('change', event => {
            pushUndoSnapshot();
            state.image.showOverlay = event.target.checked;
            render();
        });
        qs('#showCalibrationMarkers').addEventListener('change', event => {
            pushUndoSnapshot();
            state.image.showCalibrationMarkers = event.target.checked;
            render();
        });
        qs('#showHelperRadial').addEventListener('change', event => {
            pushUndoSnapshot();
            state.guide.show = event.target.checked;
            render();
        });
        bindUndoableInput(qs('#globalFontFamily'), 'input', event => {
            state.typography.fontFamily = event.target.value;
            render();
        });
        qs('#globalFontWidth').addEventListener('change', event => {
            pushUndoSnapshot();
            state.typography.fontWidth = FONT_WIDTH_VALUES.has(event.target.value) ? event.target.value : DEFAULT_TYPOGRAPHY.fontWidth;
            render();
        });
        qs('#globalFontWeight').addEventListener('change', event => {
            pushUndoSnapshot();
            state.typography.fontWeight = FONT_WEIGHT_VALUES.has(event.target.value) ? event.target.value : DEFAULT_TYPOGRAPHY.fontWeight;
            render();
        });
        qs('#elementSelect').addEventListener('change', event => {
            state.selectedId = event.target.value;
            const element = selectedElement();
            if (element) state.workface = surfaceWorkface(elementSurface(element));
            render();
        });
        bindEditorInputs();
        bindButtons();
        bindStage();
        bindImageInput();
        bindNumberKeyboardSteps();
    }

    function bindUndoableInput(input, eventName, handler) {
        input.addEventListener(eventName, event => {
            if (event.currentTarget.dataset.ignoreKeyboardInput === '1') {
                delete event.currentTarget.dataset.ignoreKeyboardInput;
                return;
            }
            beginInputUndo(event);
            handler(event);
        });
        ['blur', 'change', 'pointerup'].forEach(name => {
            input.addEventListener(name, event => {
                delete event.currentTarget.dataset.undoActive;
            });
        });
    }

    function beginInputUndo(event) {
        const input = event.currentTarget;
        if (input.dataset.undoActive) return;
        input.dataset.undoActive = '1';
        pushUndoSnapshot();
    }

    function bindNumberKeyboardSteps() {
        qsa('input[data-number-field="1"]').forEach(input => {
            input.addEventListener('keydown', event => {
                const delta = keyboardNumberDelta(event);
                if (!delta) return;
                event.preventDefault();
                event.stopPropagation();
                if (event.stopImmediatePropagation) event.stopImmediatePropagation();
                stepNumberInput(input, delta);
            }, true);
        });
    }

    function stepNumberInput(input, delta) {
        const target = numberInputTarget(input);
        if (!target) return;
        beginInputUndo({ currentTarget: input });
        const fieldValue = parseNumberFieldValue(input.value);
        const current = fieldValue === null ? Number(target.owner[target.key]) : fieldValue;
        let next = Number.isFinite(current) ? current + delta : delta;
        const min = Number(input.getAttribute('min'));
        const max = Number(input.getAttribute('max'));
        if (Number.isFinite(min)) next = Math.max(min, next);
        if (Number.isFinite(max)) next = Math.min(max, next);
        target.owner[target.key] = roundKeyboardNumber(next);
        render();
        requestAnimationFrame(() => {
            input.value = String(target.owner[target.key] ?? '');
        });
    }

    function numberInputTarget(input) {
        const calibrationKey = CALIBRATION_INPUT_KEYS[input.id];
        if (calibrationKey) return { owner: activeCalibration(), key: calibrationKey };
        const helperKey = HELPER_INPUT_KEYS[input.id];
        if (helperKey) return { owner: state.guide, key: helperKey };
        const scanAlignmentKey = SCAN_ALIGNMENT_INPUT_KEYS[input.id];
        if (scanAlignmentKey) return { owner: activeScanAlignment(), key: scanAlignmentKey };
        const previewKey = PREVIEW_INPUT_KEYS[input.id];
        if (previewKey) return { owner: state.preview, key: previewKey };
        const windPreviewKey = WIND_PREVIEW_INPUT_KEYS[input.id];
        if (windPreviewKey) return { owner: state.preview, key: windPreviewKey };
        const editorKey = EDITOR_NUMERIC_KEYS[input.id];
        if (!editorKey) return null;
        const element = selectedElement();
        return element ? { owner: element, key: editorKey } : null;
    }

    function keyboardNumberDelta(event) {
        if (event.metaKey || event.ctrlKey) return 0;
        const key = event.key || event.code || '';
        const code = event.keyCode || event.which || 0;
        const step = event.altKey || event.shiftKey ? 1 : 0.1;
        if (key === 'ArrowUp' || key === 'ArrowRight' || key === 'Up' || key === 'Right' || code === 38 || code === 39) return step;
        if (key === 'ArrowDown' || key === 'ArrowLeft' || key === 'Down' || key === 'Left' || code === 40 || code === 37) return -step;
        return 0;
    }

    function roundKeyboardNumber(value) {
        const rounded = Math.round(Number(value) * 1000) / 1000;
        return Number.isFinite(rounded) ? rounded : 0;
    }

    function parseNumberFieldValue(value) {
        const text = String(value ?? '').trim().replace(',', '.');
        if (!text || text === '-' || text === '+' || text === '.' || text === '-.' || text === '+.') return null;
        const number = Number(text);
        return Number.isFinite(number) ? number : null;
    }

    function bindEditorInputs() {
        Object.entries(EDITOR_NUMERIC_KEYS).forEach(([id, key]) => {
            bindUndoableInput(qs(`#${id}`), 'input', event => {
                const element = selectedElement();
                if (!element) return;
                const value = parseNumberFieldValue(event.target.value);
                if (value === null) return;
                element[key] = value;
                render();
            });
        });
        bindUndoableInput(qs('#editLabel'), 'input', event => {
            const element = selectedElement();
            if (!element) return;
            element.label = event.target.value;
            render();
        });
        qs('#editDisc').addEventListener('change', event => {
            const element = selectedElement();
            if (!element) return;
            pushUndoSnapshot();
            element.disc = normalizeSurface(event.target.value) || defaultElementSurface();
            element.surface = element.disc;
            render();
        });
        qs('#editTextOrientation').addEventListener('change', event => {
            const element = selectedElement();
            if (!element) return;
            pushUndoSnapshot();
            element.textOrientation = textOrientation({ textOrientation: event.target.value });
            render();
        });
        bindUndoableInput(qs('#editFontFamily'), 'input', event => {
            const element = selectedElement();
            if (!element) return;
            const value = cleanFontFamily(event.target.value, '');
            if (value) element.fontFamily = value;
            else delete element.fontFamily;
            render();
        });
        qs('#editFontWidth').addEventListener('change', event => {
            const element = selectedElement();
            if (!element) return;
            pushUndoSnapshot();
            if (FONT_WIDTH_VALUES.has(event.target.value)) element.fontWidth = event.target.value;
            else delete element.fontWidth;
            render();
        });
        qs('#editFontWeight').addEventListener('change', event => {
            const element = selectedElement();
            if (!element) return;
            pushUndoSnapshot();
            if (FONT_WEIGHT_VALUES.has(event.target.value)) element.fontWeight = event.target.value;
            else delete element.fontWeight;
            render();
        });
        bindUndoableInput(qs('#editValues'), 'input', event => {
            const element = selectedElement();
            if (!element) return;
            if (element.type === 'label' || element.type === 'index' || element.type === 'text-box' || element.type === 'control-anchor') element.text = event.target.value;
            else if (element.type === 'polygon') element.pointsText = event.target.value;
            else element.valuesText = event.target.value;
            render();
        });
        bindUndoableInput(qs('#editMediumValues'), 'input', event => {
            const element = selectedElement();
            if (!element || element.type !== 'scale') return;
            element.mediumValuesText = event.target.value;
            render();
        });
        bindUndoableInput(qs('#editMinorValues'), 'input', event => {
            const element = selectedElement();
            if (!element || element.type !== 'scale') return;
            element.minorValuesText = event.target.value;
            render();
        });
        bindUndoableInput(qs('#editCalibration'), 'input', event => {
            const element = selectedElement();
            if (!element) return;
            element.calibrationText = event.target.value;
            render();
        });
    }

    function bindButtons() {
        qs('#togglePreviewMode').addEventListener('click', () => {
            state.mode = isPreviewMode() ? 'edit' : 'preview';
            state.pickMode = '';
            document.body.classList.remove('pick-mode');
            render();
        });
        qs('#resetPreviewRotation').addEventListener('click', () => {
            state.preview.frontRotation = 0;
            state.preview.backRotation = 0;
            state.preview.windRotation = 0;
            render();
        });
        qs('#undoChange').addEventListener('click', undoChange);
        qs('#redoChange').addEventListener('click', redoChange);
        document.addEventListener('keydown', event => {
            const isUndo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z';
            if (!isUndo) return;
            if (isPreviewMode()) return;
            event.preventDefault();
            if (event.shiftKey) redoChange();
            else undoChange();
        });
        qs('#fitView').addEventListener('click', () => {
            state.view.zoom = 1;
            state.view.panX = 0;
            state.view.panY = 0;
            render();
        });
        qs('#zoomIn').addEventListener('click', () => {
            state.view.zoom = clamp(state.view.zoom * 1.25, 0.25, 12);
            render();
        });
        qs('#zoomOut').addEventListener('click', () => {
            state.view.zoom = clamp(state.view.zoom / 1.25, 0.25, 12);
            render();
        });
        qs('#pickCenter').addEventListener('click', () => setPickMode('center'));
        qs('#pickRadius').addEventListener('click', () => setPickMode('radius'));
        qs('#pickRotorCircle').addEventListener('click', () => {
            pushUndoSnapshot();
            state.workface = 'wind-rotor';
            state.calibrationSurface = 'wind-rotor-front';
            state.wind.circlePoints = [];
            setPickMode('rotor-circle');
            render();
        });
        qs('#pickWindDot').addEventListener('click', () => {
            state.workface = 'wind-rotor';
            state.calibrationSurface = 'wind-rotor-front';
            setPickMode('wind-dot');
            render();
        });
        qs('#resetCalibration').addEventListener('click', () => {
            pushUndoSnapshot();
            Object.assign(activeCalibration(), defaultCalibrationForSurface(activeSurface()));
            render();
        });
        qs('#downloadNormalized').addEventListener('click', downloadNormalizedPng);
        qsa('[data-add]').forEach(button => {
            button.addEventListener('click', () => addElement(button.dataset.add));
        });
        qs('#duplicateElement').addEventListener('click', duplicateElement);
        qs('#deleteElement').addEventListener('click', deleteElement);
        qs('#resetElements').addEventListener('click', () => {
            if (!frontElementActionsAllowed()) return;
            pushUndoSnapshot();
            state.elements = defaultElements();
            state.selectedId = 'outer-slide-rule';
            render();
        });
        qs('#appendIndexes').addEventListener('click', appendDefaultIndexes);
        qs('#applyIndexPattern').addEventListener('click', applyIndexPattern);
        qs('#appendWindSeeds').addEventListener('click', appendWindSeeds);
        qs('#appendShapePattern').addEventListener('click', appendShapePattern);
        qs('#copyJson').addEventListener('click', copyJson);
        qs('#downloadJson').addEventListener('click', downloadJson);
        qs('#publishFrontDisc').addEventListener('click', publishFrontDisc);
        qs('#publishWindDisc').addEventListener('click', publishWindDisc);
    }

    function defaultCalibrationForSurface(surface) {
        const normalized = normalizeSurface(surface);
        if (normalized === 'wind-slider') return { ...DEFAULT_WIND_SLIDER_CALIBRATION };
        if (normalized === 'wind-rotor-back') return { ...DEFAULT_WIND_ROTOR_BACK_CALIBRATION };
        if (normalized === 'wind-rotor-front') return { ...DEFAULT_WIND_ROTOR_FRONT_CALIBRATION };
        return { ...DEFAULT_FRONT_CALIBRATION };
    }

    function setPickMode(mode) {
        state.pickMode = state.pickMode === mode ? '' : mode;
        document.body.classList.toggle('pick-mode', !!state.pickMode);
    }

    function addElement(type) {
        pushUndoSnapshot();
        const base = {
            id: uid(type),
            type,
            label: `New ${type}`,
            disc: defaultElementSurface(),
            surface: defaultElementSurface(),
            radius: 600,
            startAngle: -120,
            endAngle: -60,
            fontSize: 28
        };
        if (type === 'window') Object.assign(base, { innerRadius: 500, outerRadius: 620 });
        if (type === 'scale') Object.assign(base, { labelRadius: 650, majorTick: 34, mediumTick: 26, minorTick: 18, valuesText: '0,10,20,30,40,50', mediumValuesText: '', minorValuesText: '0..50/5', calibrationText: '0=-120, 50=-60' });
        if (type === 'label') Object.assign(base, { text: 'LABEL', textRotation: 0 });
        if (type === 'index') Object.assign(base, { text: '', labelRadius: 660, indexLength: 70, indexWidth: 36, stemLength: 0, textRotation: 0 });
        if (type === 'radial') Object.assign(base, { innerRadius: 120, outerRadius: 720, endAngle: -120 });
        if (type === 'circle') Object.assign(base, { radius: 0, startAngle: -90, outerRadius: 42, strokeWidth: 3, strokeOpacity: 0.9, fillOpacity: 0 });
        if (type === 'line') Object.assign(base, { innerRadius: 120, outerRadius: 720, startAngle: -120, endAngle: -60, strokeWidth: 2.6, strokeOpacity: 0.9 });
        if (type === 'polygon') Object.assign(base, {
            innerRadius: 320,
            outerRadius: 430,
            startAngle: -145,
            endAngle: -35,
            strokeWidth: 2.4,
            strokeOpacity: 0.88,
            fillOpacity: 0,
            pointsText: '-145:320\n-35:320\n-35:430\n-145:430'
        });
        if (type === 'text-box') Object.assign(base, {
            label: 'Neues Textfeld',
            text: 'TEXTFELD',
            radius: 420,
            startAngle: -90,
            innerRadius: 520,
            outerRadius: 120,
            endAngle: 10,
            strokeWidth: 2,
            strokeOpacity: 0.9,
            fillOpacity: 1,
            fontSize: 30,
            textOffsetX: 0,
            textOffsetY: 0,
            fontWeight: 'bold',
            backgroundFill: '#101418',
            textFill: '#f7f1df'
        });
        if (type === 'control-anchor') Object.assign(base, {
            label: 'Button-Anker',
            text: 'move',
            radius: Math.max(120, Number(calibrationForSurface(defaultElementSurface()).radius || 720) - 55),
            startAngle: -135,
            endAngle: -135,
            outerRadius: 44,
            fontSize: 30,
            fontWeight: 'bold'
        });
        state.elements.push(base);
        state.selectedId = base.id;
        render();
    }

    function defaultElementSurface() {
        if (state.workface === 'wind-slider') return 'wind-slider';
        if (state.workface === 'wind-rotor') return 'wind-rotor-front';
        return 'front';
    }

    function shapePatternElements() {
        const surface = defaultElementSurface();
        if (state.workface === 'wind-rotor') {
            return [
                {
                    id: uid('ring'),
                    type: 'ring',
                    label: 'Wind Center Kreis',
                    disc: surface,
                    surface,
                    radius: 525,
                    startAngle: -180,
                    endAngle: 180,
                    strokeWidth: 4,
                    strokeOpacity: 0.9
                },
                {
                    id: uid('circle'),
                    type: 'circle',
                    label: 'Wind Mittelpunkt Kreis',
                    disc: surface,
                    surface,
                    radius: 0,
                    startAngle: -90,
                    outerRadius: 18,
                    strokeWidth: 3,
                    strokeOpacity: 0.9,
                    fillOpacity: 0
                }
            ];
        }
        if (state.workface === 'wind-slider') {
            const defaultSliderElements = defaultWindSliderElements();
            const instruction = JSON.parse(JSON.stringify(
                defaultSliderElements.find(element => element.id === 'wind-slider-instruction-panel')
            ));
            const formula = JSON.parse(JSON.stringify(
                defaultSliderElements.find(element => element.id === 'wind-slider-formula-panel')
            ));
            return [
                {
                    id: uid('line'),
                    type: 'line',
                    label: 'Schieber Mittellinie',
                    disc: surface,
                    surface,
                    innerRadius: 30,
                    outerRadius: 2700,
                    startAngle: -90,
                    endAngle: -90,
                    strokeWidth: 2.2,
                    strokeOpacity: 0.72
                },
                instruction,
                formula
            ].filter(Boolean);
        }
        return [
            {
                id: uid('line'),
                type: 'line',
                label: 'Calc Trennlinie horizontal',
                disc: surface,
                surface,
                innerRadius: 420,
                outerRadius: 420,
                startAngle: 180,
                endAngle: 0,
                strokeWidth: 3,
                strokeOpacity: 0.9
            },
            {
                id: uid('line'),
                type: 'line',
                label: 'Calc Trennlinie vertikal',
                disc: surface,
                surface,
                innerRadius: 420,
                outerRadius: 420,
                startAngle: -90,
                endAngle: 90,
                strokeWidth: 3,
                strokeOpacity: 0.9
            },
            {
                id: uid('polygon'),
                type: 'polygon',
                label: 'Calc Vieleck Umriss',
                disc: surface,
                surface,
                pointsText: '-145:320\n-35:320\n-20:455\n-160:455',
                strokeWidth: 2.4,
                strokeOpacity: 0.9,
                fillOpacity: 0
            }
        ];
    }

    function appendShapePattern() {
        const existingIds = new Set(state.elements.map(element => element.id));
        const elements = shapePatternElements().filter(element => !element.id || !existingIds.has(element.id));
        if (!elements.length) return;
        pushUndoSnapshot();
        state.elements.push(...elements);
        state.selectedId = elements[0].id;
        render();
    }

    function appendDefaultIndexes() {
        if (!frontElementActionsAllowed()) return;
        const existingIds = new Set(state.elements.map(element => element.id));
        const missing = defaultIndexElements().filter(element => !existingIds.has(element.id));
        if (!missing.length) return;
        pushUndoSnapshot();
        state.elements.push(...missing.map(element => JSON.parse(JSON.stringify(element))));
        state.selectedId = missing[0].id;
        render();
    }

    function appendWindSeeds() {
        if (!windElementActionsAllowed()) return;
        const existingIds = new Set(state.elements.map(element => element.id));
        const missing = windSeedElementsForWorkface().filter(element => !existingIds.has(element.id));
        if (!missing.length) return;
        pushUndoSnapshot();
        state.elements.push(...missing.map(element => JSON.parse(JSON.stringify(element))));
        state.selectedId = missing[0].id;
        render();
    }

    function applyIndexPattern() {
        if (!frontElementActionsAllowed()) return;
        const indexes = state.elements.filter(element => element.type === 'index' && elementVisibleOnWorkface(element, 'front') && !INDEX_PATTERN_SKIP_IDS.has(element.id));
        if (!indexes.length) return;
        pushUndoSnapshot();
        indexes.forEach(applyStandardIndexPattern);
        state.selectedId = indexes[0].id;
        render();
    }

    function duplicateElement() {
        const element = selectedElement();
        if (!element) return;
        pushUndoSnapshot();
        const copy = JSON.parse(JSON.stringify(element));
        copy.id = uid(element.type || 'element');
        copy.label = `${copy.label || copy.type} copy`;
        if (Number.isFinite(Number(copy.radius))) copy.radius += 20;
        if (Number.isFinite(Number(copy.startAngle))) copy.startAngle += 3;
        if (Number.isFinite(Number(copy.endAngle))) copy.endAngle += 3;
        state.elements.push(copy);
        state.selectedId = copy.id;
        render();
    }

    function deleteElement() {
        if (!state.selectedId) return;
        pushUndoSnapshot();
        state.elements = state.elements.filter(element => element.id !== state.selectedId);
        state.selectedId = (state.elements[0] || {}).id || '';
        render();
    }

    function bindStage() {
        const stage = qs('#traceStage');
        stage.addEventListener('wheel', event => {
            event.preventDefault();
            state.view.zoom = clamp(state.view.zoom * Math.exp(-event.deltaY * 0.0015), 0.25, 12);
            render();
        }, { passive: false });
        stage.addEventListener('pointerdown', event => {
            const point = svgPoint(event);
            if (isPreviewMode()) {
                const previewDisc = event.target.closest ? event.target.closest('[data-preview-disc]') : null;
                if (previewDisc) {
                    const disc = normalizeSurface(previewDisc.getAttribute('data-preview-disc')) || 'front';
                    if (disc === 'front' || disc === 'wind-rotor-front') {
                        drag = {
                            type: 'previewRotate',
                            disc,
                            startAngle: withCalibration(calibrationForSurface(disc), () => angleFromPoint(point)),
                            startRotation: previewRotation(disc)
                        };
                    } else if (disc === 'wind-slider') {
                        drag = {
                            type: 'previewSlide',
                            startClientY: event.clientY,
                            startSliderY: Number(state.preview.sliderY || 0)
                        };
                    } else {
                        drag = null;
                    }
                } else {
                    drag = { type: 'pan', x: event.clientX, y: event.clientY, panX: state.view.panX, panY: state.view.panY };
                }
                if (drag) stage.setPointerCapture(event.pointerId);
                event.preventDefault();
                return;
            }
            if (state.pickMode === 'center') {
                pushUndoSnapshot();
                activeCalibration().cx = round(point.x);
                activeCalibration().cy = round(point.y);
                setPickMode('');
                render();
                return;
            }
            if (state.pickMode === 'radius') {
                pushUndoSnapshot();
                activeCalibration().radius = round(radiusFromPoint(point));
                setPickMode('');
                render();
                return;
            }
            if (state.pickMode === 'rotor-circle') {
                state.workface = 'wind-rotor';
                state.calibrationSurface = 'wind-rotor-front';
                state.wind.circlePoints.push({ x: round(point.x), y: round(point.y) });
                if (state.wind.circlePoints.length >= 3) {
                    const circle = circleFromThreePoints(state.wind.circlePoints);
                    if (circle) Object.assign(activeCalibration(), circle);
                    state.wind.circlePoints = [];
                    setPickMode('');
                }
                render();
                return;
            }
            if (state.pickMode === 'wind-dot') {
                withCalibration(state.wind.rotorFrontCalibration, () => {
                    state.wind.markedPoint = {
                        radius: round(radiusFromPoint(point)),
                        angle: round(angleFromPoint(point))
                    };
                });
                setPickMode('');
                render();
                return;
            }
            const helperRadial = event.target.closest ? event.target.closest('[data-helper-radial]') : null;
            const scalePoint = event.target.closest ? event.target.closest('[data-scale-value][data-trace-id]') : null;
            const target = event.target.closest ? event.target.closest('[data-trace-id]') : null;
            if (helperRadial) {
                drag = { type: 'helperRadial' };
            } else if (scalePoint) {
                state.selectedId = scalePoint.getAttribute('data-trace-id');
                const element = selectedElement();
                const value = Number(scalePoint.getAttribute('data-scale-value'));
                drag = {
                    type: 'scalePoint',
                    value,
                    referenceAngle: calibrationPointAngle(element, value) ?? valueAngle(element, value)
                };
            } else if (target) {
                state.selectedId = target.getAttribute('data-trace-id');
                drag = { type: 'element', point, element: selectedElement() ? JSON.parse(JSON.stringify(selectedElement())) : null };
            } else {
                drag = { type: 'pan', x: event.clientX, y: event.clientY, panX: state.view.panX, panY: state.view.panY };
            }
            stage.setPointerCapture(event.pointerId);
            event.preventDefault();
            render();
        });
        stage.addEventListener('pointermove', event => {
            if (!drag) return;
            if (drag.type === 'pan') {
                const scale = state.image.width / (state.image.width / state.view.zoom);
                state.view.panX = drag.panX - (event.clientX - drag.x) / scale;
                state.view.panY = drag.panY - (event.clientY - drag.y) / scale;
                renderView();
                return;
            }
            const point = svgPoint(event);
            const angle = angleFromPoint(point);
            if (drag.type === 'previewRotate') {
                const dragAngle = withCalibration(calibrationForSurface(drag.disc), () => angleFromPoint(point));
                const delta = normalizeAngle(dragAngle - drag.startAngle);
                setPreviewRotation(drag.disc, drag.startRotation + delta);
                renderOverlay();
                return;
            }
            if (drag.type === 'previewSlide') {
                const rect = qs('#traceStage').getBoundingClientRect();
                const unitsPerPixel = state.image.height / Math.max(1, rect.height) / Math.max(0.25, state.view.zoom);
                state.preview.sliderY = round(drag.startSliderY + (event.clientY - drag.startClientY) * unitsPerPixel);
                renderOverlay();
                return;
            }
            if (drag.type === 'helperRadial') {
                pushDragUndoSnapshot();
                state.guide.show = true;
                state.guide.angle = round(angle);
                render();
                return;
            }
            const element = selectedElement();
            if (!element) return;
            const elementCal = calibrationForSurface(elementSurface(element));
            const elementAngle = withCalibration(elementCal, () => angleFromPoint(point));
            const elementRadius = withCalibration(elementCal, () => radiusFromPoint(point));
            if (drag.type === 'scalePoint') {
                pushDragUndoSnapshot();
                const continuousAngle = closestEquivalentAngle(elementAngle, drag.referenceAngle);
                upsertCalibrationPoint(element, drag.value, continuousAngle);
                drag.referenceAngle = continuousAngle;
                render();
                return;
            }
            if (!drag.element) return;
            pushDragUndoSnapshot();
            if (element.type === 'label' || element.type === 'text-box' || element.type === 'control-anchor') {
                element.startAngle = round(elementAngle);
                element.radius = round(elementRadius);
            } else if (element.type === 'index') {
                const indexLength = Number(element.indexLength ?? element.majorTick ?? 62);
                element.startAngle = round(elementAngle);
                element.radius = round(elementRadius - (Number.isFinite(indexLength) ? indexLength : 0));
            } else if (element.type === 'ring' || element.type === 'scale') {
                element.radius = round(elementRadius);
            } else if (element.type === 'radial') {
                element.startAngle = round(elementAngle);
                element.endAngle = round(elementAngle);
                if (!Number.isFinite(Number(element.outerRadius || element.radius))) {
                    element.outerRadius = round(elementRadius);
                }
            } else if (element.type === 'circle') {
                element.startAngle = round(elementAngle);
                element.radius = round(elementRadius);
            } else if (element.type === 'line') {
                element.endAngle = round(elementAngle);
                element.outerRadius = round(elementRadius);
            } else if (element.type === 'window') {
                const width = Number(drag.element.endAngle || 0) - Number(drag.element.startAngle || 0);
                element.startAngle = round(elementAngle - width / 2);
                element.endAngle = round(elementAngle + width / 2);
            }
            render();
        });
        const endDrag = event => {
            if (!drag) return;
            if (drag.type === 'previewRotate' || drag.type === 'previewSlide') saveState();
            drag = null;
            try {
                stage.releasePointerCapture(event.pointerId);
            } catch (_) {}
        };
        stage.addEventListener('pointerup', endDrag);
        stage.addEventListener('pointercancel', endDrag);
    }

    function pushDragUndoSnapshot() {
        if (!drag || drag.historyPushed) return;
        pushUndoSnapshot();
        drag.historyPushed = true;
    }

    function svgPoint(event) {
        const stage = qs('#traceStage');
        const point = stage.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        return point.matrixTransform(stage.getScreenCTM().inverse());
    }

    function bindImageInput() {
        qs('#imageFile').addEventListener('change', event => {
            const file = event.target.files && event.target.files[0];
            if (!file) return;
            const url = URL.createObjectURL(file);
            const image = new Image();
            image.onload = () => {
                pushUndoSnapshot();
                state.image.src = url;
                state.image.width = image.naturalWidth || DEFAULT_SIZE.width;
                state.image.height = image.naturalHeight || DEFAULT_SIZE.height;
                state.view.zoom = 1;
                state.view.panX = 0;
                state.view.panY = 0;
                render();
            };
            image.src = url;
        });
    }

    function copyJson() {
        const output = qs('#jsonExport');
        if (!output) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(output.value).catch(() => {});
        }
        output.select();
    }

    function downloadJson() {
        const blob = new Blob([qs('#jsonExport').value], { type: 'application/json' });
        downloadBlob(blob, 'e6b-trace-geometry.json');
    }

    function downloadNormalizedPng() {
        const image = new Image();
        image.onload = () => {
            const size = 2200;
            const outputRadius = 940;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            const cal = activeCalibration();
            ctx.fillStyle = '#d8dde2';
            ctx.fillRect(0, 0, size, size);
            ctx.translate(size / 2, size / 2);
            ctx.rotate(degToRad(-cal.rotation));
            const scale = outputRadius / Math.max(1, cal.radius);
            ctx.scale(scale, scale);
            ctx.translate(-cal.cx, -cal.cy);
            applyScanAlignmentToCanvas(ctx, cal);
            ctx.drawImage(image, 0, 0);
            canvas.toBlob(blob => {
                if (blob) downloadBlob(blob, `e6b-normalized-${activeSurface()}.png`);
            }, 'image/png');
        };
        image.src = state.image.src || DEFAULT_IMAGE;
    }

    function applyScanAlignmentToCanvas(ctx, cal) {
        const alignment = activeScanAlignment();
        const x = Number(alignment.x || 0);
        const y = Number(alignment.y || 0);
        const rotation = Number(alignment.rotation || 0);
        ctx.translate(x, y);
        if (Math.abs(rotation) > 0.001) {
            ctx.translate(Number(cal.cx || 0), Number(cal.cy || 0));
            ctx.rotate(degToRad(rotation));
            ctx.translate(-Number(cal.cx || 0), -Number(cal.cy || 0));
        }
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function init() {
        loadStoredState();
        loadHistory();
        bindInputs();
        render();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
