(function() {
    'use strict';

    const STORAGE_PREFIX = 'ga_map_utility_';
    const TOOL_IDS = {
        stopwatch: {
            panel: 'mapStopwatchDevice',
            handle: 'mapStopwatchHandle',
            button: 'mapToolStopwatch',
            storage: `${STORAGE_PREFIX}stopwatch_pos`
        },
        calculator: {
            panel: 'mapCalculatorDevice',
            handle: 'mapCalculatorHandle',
            button: 'mapToolCalculator',
            storage: `${STORAGE_PREFIX}calculator_pos`
        },
        e6b: {
            panel: 'mapE6BDevice',
            handle: '',
            button: 'mapToolE6B',
            storage: `${STORAGE_PREFIX}e6b_pos`
        }
    };
    const E6B_SIZE_STORAGE = `${STORAGE_PREFIX}e6b_size`;
    const E6B_CONTROL_KEYS = ['flip', 'zoomOut', 'zoomIn', 'close'];
    const TIMER_MIN_MS = 1000;
    const TIMER_MAX_SECONDS = 99 * 60 + 59;
    const TIMER_MAX_MS = TIMER_MAX_SECONDS * 1000;
    const TIMER_DIGIT_MAX = [9, 9, 5, 9];
    const TIMER_DIGIT_DRAG_STEP_PX = 14;
    function reportUtility(level, event, stage, message, details) {
        if (typeof window.__gaEfbReport === 'function') {
            window.__gaEfbReport(level, event, stage, message, details);
        }
    }
    const FORMULA_HELP = {
        'time-distance': {
            title: 'Zeit / Distanz / GS',
            formula: 'Zeit = Distanz / GS\nDistanz = GS * Zeit\nGS = Distanz / Zeit',
            body: [
                'Grundrechnung für Navigation, ETA und Fuelplanung.',
                'Zeit wird hier in Stunden eingegeben: 30 Minuten = 0.5 h.'
            ]
        },
        'rule-60': {
            title: '1:60 Regel',
            formula: 'Parallel-Korr. = Ablage * 60 / geflogene Strecke\nZiel-Korr. = Ablage * 60 / Reststrecke',
            body: [
                'Näherung für kleine Winkel: 1 NM Ablage nach 60 NM entspricht etwa 1 Grad.',
                'Parallel-Korrektur bringt dich wieder parallel zum geplanten Kurs. Ziel-Korrektur dreht direkter zum Ziel.'
            ]
        },
        variation: {
            title: 'Missweisung',
            formula: 'mwK = rwK - Ost\nmwK = rwK + West',
            body: [
                'Wandelt rechtweisenden Kurs in missweisenden Kurs um.',
                'Merksatz: East is least, West is best.'
            ]
        },
        'map-scale': {
            title: 'Kartenmaßstab',
            formula: '1:500k: km = cm * 5\n1:250k: km = cm * 2.5\n1:100k: km = cm * 1',
            body: [
                'Hilft beim schnellen Abschätzen von Strecken auf Papierkarten.',
                'Die Formel nutzt Zentimeter auf der Karte und liefert Kilometer in der Realwelt.'
            ]
        },
        'fuel-range': {
            title: 'Fuel / Range',
            formula: 'Fuel = GPH * Zeit\nEndurance = Fuel / GPH\nRange = GS * Endurance',
            body: [
                'Berechnet Verbrauch, Flugzeit aus vorhandenem Fuel und Reichweite.',
                'GS statt TAS verwenden, weil Wind die tatsächlich geflogene Strecke pro Zeit bestimmt.'
            ]
        },
        'fuel-reserve': {
            title: 'Reserve',
            formula: 'Reservezeit = Reservefuel / Verbrauch\nReserve-NM = GS * Reservezeit\nTagreserve = GPH * 0.5\nNachtreserve = GPH * 0.75',
            body: [
                'Zeigt, wie viel Zeit und Strecke nach dem geplanten Flug noch übrig bleibt.',
                'Die festen Faktoren sind schnelle Cockpitwerte für 30 bzw. 45 Minuten Reserve.'
            ]
        },
        'descent-profile': {
            title: 'Sinkflug / 3 Grad',
            formula: '3 Grad Profil = NM * 300 ft\nTOD = Höhe abzubauen / 300\nVS = GS * 5',
            body: [
                'Grobe Planung für einen stabilen Sinkflug mit etwa 3 Grad.',
                'TOD ist der Punkt, an dem der Sinkflug beginnen sollte.'
            ]
        },
        'climb-gradient': {
            title: 'Steig- / Sinkwinkel',
            formula: 'Winkel = Gradient % / 1.7\nGradient % = ft/NM / 60.8\nft/NM = ROC / GS * 60',
            body: [
                'Verbindet Steig- oder Sinkrate, Groundspeed und geforderte Hindernisfreiheit.',
                'Nützlich für Abflugprofile, Anflugprofile und Mindeststeigleistung.'
            ]
        },
        'wind-components': {
            title: 'Windkomponenten',
            formula: 'Headwind = Wind * cos(Winkel)\nCrosswind = Wind * sin(Winkel)\nWCA = Crosswind / TAS * 60',
            body: [
                'Zerlegt Wind in Gegenwind/Rückenwind und Seitenwind.',
                'Der Winkel ist die Differenz zwischen Bahn- oder Kursrichtung und Windrichtung.'
            ]
        },
        'crosswind-thirds': {
            title: 'Crosswind Drittel',
            formula: '0-30 Grad = 1/3 Wind\n30-60 Grad = 2/3 Wind\n60-90 Grad = voller Wind',
            body: [
                'Schnelle Faustregel, wenn kein genauer Sinus gerechnet werden soll.',
                'Gut für eine Plausibilitätsprüfung vor Start und Landung.'
            ]
        },
        'sine-short': {
            title: 'Sinus kurz',
            formula: 'sin 10 Grad = .2\nsin 30 Grad = .5\nsin 60 Grad = .9',
            body: [
                'Kurztabelle für Seitenwind und Windkorrekturwinkel.',
                'Exakter ist die sin/cos/tan Funktion des Rechners.'
            ]
        },
        'gust-additive': {
            title: 'Gust-Zuschlag',
            formula: 'Vref-Zuschlag = Böendifferenz / 2',
            body: [
                'Ein schneller Zuschlag bei böigem Wind.',
                'Die Flugzeugdokumentation und lokale Verfahren bleiben maßgeblich.'
            ]
        },
        tas: {
            title: 'TAS',
            formula: 'TAS = IAS * (1 + 0.02 * Höhe / 1000)',
            body: [
                'True Airspeed steigt mit der Höhe, weil das Flugzeug bei gleicher IAS in dünnerer Luft schneller durchs Luftpaket läuft.',
                'Die 2 Prozent pro 1000 ft sind eine Cockpitnäherung.'
            ]
        },
        'true-altitude': {
            title: 'Wahre Höhe',
            formula: 'True Alt = Indicated + Temp-Korr.\nTemp-Korr. = 4 ft / 1000 ft je Grad ISA-Abweichung\nQNH-Höhe = FL*100 + (QNH - 1013) * 30',
            body: [
                'Wahre Höhe korrigiert angezeigte Höhe um Temperatur- und Druckeffekte.',
                'Wichtig bei Hindernisfreiheit und niedrigen Temperaturen.'
            ]
        },
        'isa-temp': {
            title: 'ISA Temperatur',
            formula: 'ISA = 15 Grad C - 2 Grad C * Höhe / 1000',
            body: [
                'Standardtemperatur in der Internationalen Standardatmosphäre.',
                'Du brauchst sie unter anderem für Dichtehöhe und Temperaturkorrekturen.'
            ]
        },
        'density-altitude': {
            title: 'Dichtehöhe',
            formula: 'PA = Elevation + (1013 - QNH) * 30\nISA = 15 - 2 * PA / 1000\nDA = PA + 120 * (OAT - ISA)',
            body: [
                'Dichtehöhe ist die Höhe in der Standardatmosphäre, die zur aktuellen Luftdichte passt.',
                'Sie ist wichtig, weil hohe Dichtehöhe Startstrecke verlängert, Steigleistung reduziert und Motorleistung verschlechtert.',
                'Du brauchst Platzhöhe, QNH, OAT und daraus Druckhöhe plus ISA-Abweichung.'
            ]
        },
        'takeoff-factors': {
            title: 'Startstrecke Zuschläge',
            formula: 'Steigung: +10 Prozent je 1 Prozent Steigung\nFeuchtes Gras: * 1.1\nTrockenes Gras: * 1.2\nAufgeweicht: * 1.5',
            body: [
                'Schnelle Zuschläge für Pistenlage und Oberfläche.',
                'Sie ersetzen nicht das AFM/POH, sind aber gut für konservatives Kopfrechnen und Plausibilitätschecks.'
            ]
        },
        'turn-stall': {
            title: 'Kurvenstall',
            formula: 'Vs 20 Grad = Vs * 1.03\nVs 40 Grad = Vs * 1.14\nVs 45 Grad = Vs * 1.19\nVs 60 Grad = Vs * 1.41',
            body: [
                'In der Kurve steigt die Lastvielfache und damit die Stallgeschwindigkeit.',
                'Besonders wichtig im Platzrunden- und Kurvenflug nahe am Boden.'
            ]
        },
        'lowest-fl': {
            title: 'Niedrigste FL',
            formula: 'Druckdifferenz zu 1013 hPa * 30 ft',
            body: [
                'Schätzt den Höhenunterschied zwischen QNH und Standarddruck.',
                'Bei QNH unter 1013 liegt die wahre Höhe eines Flight Levels niedriger, die niedrigste nutzbare FL steigt.'
            ]
        },
        'unit-standard': {
            title: 'Einheiten',
            formula: 'km = NM * 1.852\nkm/h = kt * 1.852\nm = ft * 0.3048\nl = gal * 3.785\nkg = lb * 0.454',
            body: [
                'Standardumrechnungen für Navigation, Performance und Fuel.',
                'Die kt nach km/h Faustformel kt * 2 minus 10 Prozent ist schneller, aber weniger genau.'
            ]
        }
    };

    const stopwatchState = {
        running: false,
        elapsedMs: 0,
        startedAt: 0,
        compact: false,
        frame: 0,
        clockTimer: 0,
        timer: {
            durationMs: 5 * 60000,
            remainingMs: 5 * 60000,
            running: false,
            startedAt: 0,
            alarm: false,
            audioCtx: null,
            pickerOpen: false,
            pickerDraftMs: 5 * 60000
        }
    };

    const calcState = {
        display: '0',
        expression: '',
        justEvaluated: false,
        formula: null
    };

    let dragState = null;
    let timerDigitDragState = null;
    const e6bChromeState = { x: 0, y: 0, scale: 1, side: 'front', stack: null, controls: {} };
    let pendingE6BSide = '';

    function el(id) {
        return document.getElementById(id);
    }

    function getToolConfig(tool) {
        return TOOL_IDS[String(tool || '').toLowerCase()] || null;
    }

    function syncToolButtons() {
        Object.keys(TOOL_IDS).forEach(tool => {
            const cfg = TOOL_IDS[tool];
            const panel = el(cfg.panel);
            const btn = el(cfg.button);
            if (btn) btn.classList.toggle('active', !!panel && panel.style.display !== 'none');
        });
        syncTimerAlarmUi();
    }

    function syncTimerAlarmUi() {
        const panel = el('mapStopwatchDevice');
        const isOpen = !!panel && panel.style.display !== 'none';
        const alarm = !!stopwatchState.timer.alarm;
        if (panel) panel.classList.toggle('timer-alert', alarm && isOpen);
        ['mapDrawFloatingBtn', 'mapToolStopwatch'].forEach(id => {
            const btn = el(id);
            if (btn) btn.classList.toggle('timer-alert', alarm && !isOpen);
        });
        const timerDisplay = el('mapStopwatchTimerDisplay');
        if (timerDisplay) {
            timerDisplay.classList.toggle('is-running', stopwatchState.timer.running);
            timerDisplay.classList.toggle('is-alarm', alarm);
        }
    }

    function bringToFront(panel) {
        if (!panel) return;
        if (typeof window.gaBringMapOverlayToFront === 'function') {
            window.gaBringMapOverlayToFront(panel);
            return;
        }
        window.gaMapOverlayZ = Math.max(130500, Number(window.gaMapOverlayZ) || 130500) + 1;
        panel.style.zIndex = String(window.gaMapOverlayZ);
    }

    function clampPanel(panel) {
        if (!panel) return;
        const margin = 8;
        const rect = panel.getBoundingClientRect();
        const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
        const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
        let left = Number.parseFloat(panel.style.left);
        let top = Number.parseFloat(panel.style.top);
        if (!Number.isFinite(left)) left = rect.left;
        if (!Number.isFinite(top)) top = rect.top;
        panel.style.left = `${Math.min(Math.max(margin, left), maxLeft)}px`;
        panel.style.top = `${Math.min(Math.max(margin, top), maxTop)}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
    }

    function savePanelPosition(cfg) {
        const panel = el(cfg.panel);
        if (!panel) return;
        const left = Number.parseFloat(panel.style.left);
        const top = Number.parseFloat(panel.style.top);
        if (!Number.isFinite(left) || !Number.isFinite(top)) return;
        try {
            localStorage.setItem(cfg.storage, JSON.stringify({ left, top }));
        } catch (_) {}
    }

    function restorePanelPosition(cfg) {
        const panel = el(cfg.panel);
        if (!panel) return;
        let pos = null;
        try {
            pos = JSON.parse(localStorage.getItem(cfg.storage) || 'null');
        } catch (_) {
            pos = null;
        }
        if (pos && Number.isFinite(Number(pos.left)) && Number.isFinite(Number(pos.top))) {
            panel.style.left = `${Number(pos.left)}px`;
            panel.style.top = `${Number(pos.top)}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            clampPanel(panel);
            return;
        }
        let fallback;
        if (cfg.panel === 'mapStopwatchDevice') {
            fallback = { left: Math.max(72, Math.round(window.innerWidth * 0.18)), top: 76 };
        } else if (cfg.panel === 'mapE6BDevice') {
            const rect = panel.getBoundingClientRect();
            const width = rect.width || Math.min(520, window.innerHeight * 0.5 * 510 / 590);
            fallback = {
                left: Math.max(18, Math.round((window.innerWidth - width) / 2)),
                top: Math.max(18, Math.round(window.innerHeight * 0.08))
            };
        } else {
            fallback = { left: Math.max(104, Math.round(window.innerWidth * 0.52)), top: 86 };
        }
        panel.style.left = `${fallback.left}px`;
        panel.style.top = `${fallback.top}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        clampPanel(panel);
    }

    function readE6BSizeMode() {
        let value = '';
        try { value = localStorage.getItem(E6B_SIZE_STORAGE) || ''; } catch (_) {}
        return value === 'full' ? 'full' : 'half';
    }

    function applyE6BSize(mode, persist = true) {
        const panel = el('mapE6BDevice');
        const nextMode = mode === 'full' ? 'full' : 'half';
        if (!panel) return;
        panel.classList.toggle('map-e6b-full', nextMode === 'full');
        panel.classList.toggle('map-e6b-half', nextMode !== 'full');
        if (persist) {
            try { localStorage.setItem(E6B_SIZE_STORAGE, nextMode); } catch (_) {}
        }
        requestAnimationFrame(() => {
            clampPanel(panel);
            const cfg = getToolConfig('e6b');
            if (cfg && panel.style.display !== 'none') savePanelPosition(cfg);
            syncE6BBaseSize(panel);
            postE6BMessage({ type: 'ga-e6b-report-view' });
        });
    }

    function toggleE6BSize() {
        const panel = el('mapE6BDevice');
        const current = panel && panel.classList.contains('map-e6b-full') ? 'full' : 'half';
        applyE6BSize(current === 'full' ? 'half' : 'full');
    }

    function postE6BMessage(message) {
        const frame = el('mapE6BFrame');
        if (!frame || !frame.contentWindow) return;
        try {
            frame.contentWindow.postMessage(message, '*');
        } catch (_) {}
    }

    function requestE6BSide(side) {
        const target = side === 'wind' ? 'wind' : 'front';
        pendingE6BSide = target;
        e6bChromeState.side = target;
        postE6BMessage({ type: 'ga-e6b-set-side', side: target });
        window.setTimeout(() => {
            if (pendingE6BSide === target) postE6BMessage({ type: 'ga-e6b-set-side', side: target });
        }, 80);
        window.setTimeout(() => {
            if (pendingE6BSide === target) postE6BMessage({ type: 'ga-e6b-set-side', side: target });
        }, 240);
    }

    function toggleE6BSide() {
        const baseSide = pendingE6BSide || e6bChromeState.side;
        requestE6BSide(baseSide === 'wind' ? 'front' : 'wind');
    }

    function zoomE6BView(factor) {
        postE6BMessage({ type: 'ga-e6b-zoom-view', factor });
    }

    function clampE6BViewOffset(x, y) {
        const maxX = Math.max(0, window.innerWidth * 0.9);
        const maxY = Math.max(0, window.innerHeight * 0.9);
        return {
            x: Math.min(Math.max(Number(x) || 0, -maxX), maxX),
            y: Math.min(Math.max(Number(y) || 0, -maxY), maxY)
        };
    }

    function finiteE6BNumber(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function setE6BPixelVar(panel, name, value) {
        panel.style.setProperty(name, `${Math.round(value)}px`);
    }

    function getE6BShellSize(panel) {
        const shell = panel ? panel.querySelector('.map-e6b-shell') : null;
        const rect = shell ? shell.getBoundingClientRect() : (panel ? panel.getBoundingClientRect() : null);
        return {
            width: rect ? Math.max(1, rect.width) : window.innerWidth,
            height: rect ? Math.max(1, rect.height) : window.innerHeight
        };
    }

    function getE6BFrameOffset(panel) {
        const shell = panel ? panel.querySelector('.map-e6b-shell') : null;
        const frame = el('mapE6BFrame');
        const shellRect = shell ? shell.getBoundingClientRect() : null;
        const frameRect = frame ? frame.getBoundingClientRect() : null;
        return {
            x: shellRect && frameRect ? frameRect.left - shellRect.left : 0,
            y: shellRect && frameRect ? frameRect.top - shellRect.top : 0
        };
    }

    function getE6BBaseSize(panel) {
        const size = getE6BShellSize(panel);
        const frontWidth = Math.min(size.width, size.height * 510 / 590);
        const windWidth = Math.min(size.width * 1.25, size.height * 510 / 1000 * 1.38);
        return { frontWidth, windWidth };
    }

    function syncE6BBaseSize(panel) {
        const size = getE6BBaseSize(panel || el('mapE6BDevice'));
        postE6BMessage({
            type: 'ga-e6b-set-base-size',
            frontWidth: size.frontWidth,
            windWidth: size.windWidth
        });
    }

    function clampE6BStackForChrome(stack, panel) {
        if (!stack) return null;
        const offset = getE6BFrameOffset(panel);
        return {
            left: finiteE6BNumber(stack.left) + offset.x,
            top: finiteE6BNumber(stack.top) + offset.y,
            right: finiteE6BNumber(stack.right, 1) + offset.x,
            bottom: finiteE6BNumber(stack.bottom, 1) + offset.y,
            width: Math.max(1, finiteE6BNumber(stack.width, 1)),
            height: Math.max(1, finiteE6BNumber(stack.height, 1))
        };
    }

    function nudgeE6BChromeStack(dx, dy) {
        if (!e6bChromeState.stack) return;
        const stack = e6bChromeState.stack;
        e6bChromeState.stack = {
            left: stack.left + dx,
            top: stack.top + dy,
            right: stack.right + dx,
            bottom: stack.bottom + dy,
            width: stack.width,
            height: stack.height
        };
    }

    function applyE6BChromePosition() {
        const panel = el('mapE6BDevice');
        if (!panel) return;
        const stack = clampE6BStackForChrome(e6bChromeState.stack, panel);
        if (!stack) return;
        setE6BPixelVar(panel, '--e6b-tool-stack-left', stack.left);
        setE6BPixelVar(panel, '--e6b-tool-stack-top', stack.top);
        setE6BPixelVar(panel, '--e6b-tool-stack-right', stack.right);
        setE6BPixelVar(panel, '--e6b-tool-stack-bottom', stack.bottom);
        setE6BPixelVar(panel, '--e6b-tool-stack-width', stack.width);
        setE6BPixelVar(panel, '--e6b-tool-stack-height', stack.height);
        applyE6BControlPositions(panel, stack);
    }

    function fallbackE6BControlPoint(key, stack) {
        const points = e6bChromeState.side === 'wind'
            ? {
                flip: { x: 0.72, y: 0.31 },
                zoomOut: { x: 0.79, y: 0.34 },
                zoomIn: { x: 0.85, y: 0.38 },
                close: { x: 0.89, y: 0.43 }
            }
            : {
                flip: { x: 0.72, y: 0.16 },
                zoomOut: { x: 0.80, y: 0.18 },
                zoomIn: { x: 0.87, y: 0.22 },
                close: { x: 0.92, y: 0.28 }
            };
        const point = points[key] || points.flip;
        return {
            x: stack.left + stack.width * point.x,
            y: stack.top + stack.height * point.y
        };
    }

    function e6bControlPoint(key, stack) {
        const control = e6bChromeState.controls && e6bChromeState.controls[key];
        if (control && Number.isFinite(Number(control.x)) && Number.isFinite(Number(control.y))) {
            return {
                x: stack.left + Number(control.x),
                y: stack.top + Number(control.y)
            };
        }
        return fallbackE6BControlPoint(key, stack);
    }

    function applyE6BControlPositions(panel, stack) {
        E6B_CONTROL_KEYS.forEach(key => {
            const point = e6bControlPoint(key, stack);
            const cssKey = key.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
            setE6BPixelVar(panel, `--e6b-control-${cssKey}-x`, point.x);
            setE6BPixelVar(panel, `--e6b-control-${cssKey}-y`, point.y);
        });
    }

    function moveE6BViewBy(dx, dy) {
        const next = clampE6BViewOffset(e6bChromeState.x + dx, e6bChromeState.y + dy);
        const sentDx = next.x - e6bChromeState.x;
        const sentDy = next.y - e6bChromeState.y;
        e6bChromeState.x = next.x;
        e6bChromeState.y = next.y;
        nudgeE6BChromeStack(sentDx, sentDy);
        applyE6BChromePosition();
        if (sentDx || sentDy) {
            postE6BMessage({ type: 'ga-e6b-pan-view', dx: sentDx, dy: sentDy });
        }
    }

    function reclampE6BViewOffset() {
        const next = clampE6BViewOffset(e6bChromeState.x, e6bChromeState.y);
        const dx = next.x - e6bChromeState.x;
        const dy = next.y - e6bChromeState.y;
        e6bChromeState.x = next.x;
        e6bChromeState.y = next.y;
        nudgeE6BChromeStack(dx, dy);
        applyE6BChromePosition();
        postE6BMessage({ type: 'ga-e6b-report-view' });
    }

    function updateE6BChromeFromFrame(data) {
        if (!data || typeof data !== 'object') return;
        const stack = data.stack;
        if (!stack || typeof stack !== 'object') return;
        e6bChromeState.x = finiteE6BNumber(data.x, e6bChromeState.x);
        e6bChromeState.y = finiteE6BNumber(data.y, e6bChromeState.y);
        e6bChromeState.scale = Math.max(0.1, finiteE6BNumber(data.scale, e6bChromeState.scale));
        const reportedSide = data.side === 'wind' ? 'wind' : 'front';
        if (pendingE6BSide && pendingE6BSide !== reportedSide) {
            e6bChromeState.side = pendingE6BSide;
            postE6BMessage({ type: 'ga-e6b-set-side', side: pendingE6BSide });
        } else {
            e6bChromeState.side = reportedSide;
            if (pendingE6BSide === reportedSide) pendingE6BSide = '';
        }
        e6bChromeState.stack = {
            left: finiteE6BNumber(stack.left),
            top: finiteE6BNumber(stack.top),
            right: finiteE6BNumber(stack.right),
            bottom: finiteE6BNumber(stack.bottom),
            width: Math.max(1, finiteE6BNumber(stack.width, 1)),
            height: Math.max(1, finiteE6BNumber(stack.height, 1))
        };
        e6bChromeState.controls = data.controls && typeof data.controls === 'object' ? data.controls : {};
        const panel = el('mapE6BDevice');
        if (panel) panel.classList.toggle('e6b-iframe-controls', data.localControls === true);
        applyE6BChromePosition();
    }

    function handleE6BFrameMessage(event) {
        const frame = el('mapE6BFrame');
        if (!frame || (event.source && event.source !== frame.contentWindow)) return;
        const data = event && event.data;
        if (!data || typeof data !== 'object') return;
        if (data.type === 'ga-e6b-diagnostic') {
            reportUtility(data.level || 'info', `e6b-${data.event || 'runtime'}`, data.stage || '', data.message || '', data.details || '');
            return;
        }
        if (data.type === 'ga-e6b-close') {
            closeMapUtilityTool('e6b');
            return;
        }
        if (data.type !== 'ga-e6b-view-state') return;
        updateE6BChromeFromFrame(data);
    }

    function isMobileE6BOverlay(tool) {
        if (tool !== 'e6b') return false;
        try {
            return window.matchMedia('(max-width: 767px), (pointer: coarse) and (max-width: 900px)').matches;
        } catch (_) {
            return window.innerWidth <= 900;
        }
    }

    function openMapUtilityTool(tool) {
        const cfg = getToolConfig(tool);
        if (!cfg) return;
        const panel = el(cfg.panel);
        if (!panel) return;
        reportUtility('info', 'utility-action', `open-${tool}`, 'Kartenwerkzeug geoeffnet');
        const isOpen = panel.style.display !== 'none';
        if (!isOpen) {
            panel.style.display = 'block';
            panel.setAttribute('aria-hidden', 'false');
            if (tool === 'e6b') applyE6BSize(readE6BSizeMode(), false);
            restorePanelPosition(cfg);
            if (tool === 'stopwatch') startClockTimer();
        }
        bringToFront(panel);
        if (tool === 'e6b') requestAnimationFrame(() => {
            clampPanel(panel);
            syncE6BBaseSize(panel);
            reclampE6BViewOffset();
        });
        syncToolButtons();
    }

    function closeMapUtilityTool(tool) {
        const cfg = getToolConfig(tool);
        if (!cfg) return;
        const panel = el(cfg.panel);
        if (!panel) return;
        reportUtility('info', 'utility-action', `close-${tool}`, 'Kartenwerkzeug geschlossen');
        savePanelPosition(cfg);
        if (tool === 'stopwatch') setTimerPickerOpen(false);
        if (tool === 'calculator') closeFormulaHelp();
        panel.style.display = 'none';
        panel.setAttribute('aria-hidden', 'true');
        if (tool === 'stopwatch') stopClockTimerIfIdle();
        syncToolButtons();
    }

    function isMapUtilityToolOpen(tool) {
        const cfg = getToolConfig(tool);
        const panel = cfg ? el(cfg.panel) : null;
        return !!panel && panel.style.display !== 'none';
    }

    function getStopwatchDialTapAction(event) {
        if (!event || !event.target) return '';
        const dial = event.target.closest('.stopwatch-dial');
        if (!dial) return '';
        const rect = dial.getBoundingClientRect();
        if (!rect.height) return '';
        const localY = event.clientY - rect.top;
        return localY < rect.height / 2 ? 'toggleStopwatch' : 'toggleTimer';
    }

    function bindDrag(tool) {
        const cfg = getToolConfig(tool);
        const panel = cfg ? el(cfg.panel) : null;
        const handle = cfg ? el(cfg.handle) : null;
        if (!cfg || !panel || !handle || handle.dataset.utilityDragBound === '1') return;
        handle.addEventListener('pointerdown', event => {
            if (event.button !== undefined && event.button !== 0) return;
            if (event.target && event.target.closest('button, input, select, textarea, .stopwatch-timer-picker')) return;
            const e6bPanMode = tool === 'e6b' || isMobileE6BOverlay(tool);
            const styleLeft = Number.parseFloat(panel.style.left);
            const styleTop = Number.parseFloat(panel.style.top);
            const startLeft = Number.isFinite(styleLeft) ? styleLeft : panel.offsetLeft;
            const startTop = Number.isFinite(styleTop) ? styleTop : panel.offsetTop;
            panel.style.left = `${startLeft}px`;
            panel.style.top = `${startTop}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            dragState = {
                tool,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                left: startLeft,
                top: startTop,
                panMode: e6bPanMode,
                lastX: event.clientX,
                lastY: event.clientY,
                moved: false,
                tapAction: tool === 'stopwatch' ? getStopwatchDialTapAction(event) : ''
            };
            panel.classList.add('is-dragging');
            bringToFront(panel);
            if (handle.setPointerCapture) handle.setPointerCapture(event.pointerId);
            event.preventDefault();
            event.stopPropagation();
        });
        handle.addEventListener('pointermove', event => {
            if (!dragState || dragState.tool !== tool || dragState.pointerId !== event.pointerId) return;
            const dx = event.clientX - dragState.startX;
            const dy = event.clientY - dragState.startY;
            if (!dragState.moved && Math.hypot(dx, dy) < 6) {
                event.preventDefault();
                return;
            }
            dragState.moved = true;
            if (dragState.panMode) {
                const panDx = event.clientX - dragState.lastX;
                const panDy = event.clientY - dragState.lastY;
                dragState.lastX = event.clientX;
                dragState.lastY = event.clientY;
                moveE6BViewBy(panDx, panDy);
            } else {
                panel.style.left = `${dragState.left + dx}px`;
                panel.style.top = `${dragState.top + dy}px`;
                clampPanel(panel);
            }
            event.preventDefault();
        });
        const endDrag = event => {
            if (!dragState || dragState.tool !== tool || dragState.pointerId !== event.pointerId) return;
            const tapAction = !dragState.moved ? dragState.tapAction : '';
            panel.classList.remove('is-dragging');
            if (handle.releasePointerCapture && handle.hasPointerCapture && handle.hasPointerCapture(event.pointerId)) {
                handle.releasePointerCapture(event.pointerId);
            }
            if (dragState.moved && !dragState.panMode) savePanelPosition(cfg);
            dragState = null;
            if (tapAction === 'toggleStopwatch') toggleStopwatch();
            else if (tapAction === 'toggleTimer') toggleTimerFromDial();
            event.stopPropagation();
        };
        handle.addEventListener('pointerup', endDrag);
        handle.addEventListener('pointercancel', endDrag);
        handle.dataset.utilityDragBound = '1';
    }

    function getStopwatchElapsedMs() {
        return stopwatchState.running
            ? stopwatchState.elapsedMs + performance.now() - stopwatchState.startedAt
            : stopwatchState.elapsedMs;
    }

    function formatElapsed(ms) {
        const totalTenths = Math.floor(Math.max(0, ms) / 100);
        const tenths = totalTenths % 10;
        const totalSeconds = Math.floor(totalTenths / 10);
        const seconds = totalSeconds % 60;
        const minutes = Math.floor(totalSeconds / 60) % 60;
        const hours = Math.floor(totalSeconds / 3600);
        if (hours > 0) {
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
    }

    function formatTimerDuration(ms) {
        const totalSeconds = Math.ceil(Math.min(TIMER_MAX_MS, Math.max(0, ms)) / 1000);
        const seconds = totalSeconds % 60;
        const minutes = Math.floor(totalSeconds / 60);
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function parseTimerDuration(input) {
        const text = String(input || '').trim().replace(',', '.').toLowerCase();
        if (!text) return null;
        if (/^\d+(\.\d+)?m$/.test(text)) {
            return Math.round(Number.parseFloat(text) * 60000);
        }
        if (/^\d+(\.\d+)?s$/.test(text)) {
            return Math.round(Number.parseFloat(text) * 1000);
        }
        if (/^\d+(\.\d+)?$/.test(text)) {
            return Math.round(Number.parseFloat(text) * 60000);
        }
        if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(text)) {
            const parts = text.split(':').map(part => Number.parseInt(part, 10));
            if (parts.some(part => !Number.isFinite(part) || part < 0 || part > 59)) return null;
            const seconds = parts.length === 2
                ? parts[0] * 60 + parts[1]
                : parts[0] * 3600 + parts[1] * 60 + parts[2];
            return seconds * 1000;
        }
        return null;
    }

    function getTimerRemainingMs() {
        const timer = stopwatchState.timer;
        return timer.running
            ? Math.max(0, timer.remainingMs - (performance.now() - timer.startedAt))
            : Math.max(0, timer.remainingMs);
    }

    function clampTimerDuration(ms) {
        const value = Number(ms);
        if (!Number.isFinite(value)) return 5 * 60000;
        return Math.min(TIMER_MAX_MS, Math.max(TIMER_MIN_MS, Math.ceil(value / 1000) * 1000));
    }

    function durationToTimerDigits(ms) {
        const totalSeconds = Math.round(clampTimerDuration(ms) / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return [
            Math.floor(minutes / 10),
            minutes % 10,
            Math.floor(seconds / 10),
            seconds % 10
        ];
    }

    function timerDigitsToDuration(digits) {
        const minutes = (Number(digits[0]) || 0) * 10 + (Number(digits[1]) || 0);
        const seconds = (Number(digits[2]) || 0) * 10 + (Number(digits[3]) || 0);
        return clampTimerDuration((minutes * 60 + Math.min(59, seconds)) * 1000);
    }

    function readTimerPickerDigits() {
        const digits = [0, 0, 0, 1];
        const picker = el('mapStopwatchTimerPicker');
        if (!picker) return digits;
        picker.querySelectorAll('[data-timer-drag]').forEach(button => {
            const index = Number(button.dataset.timerDrag);
            const value = Number.parseInt(button.textContent || '0', 10);
            if (Number.isInteger(index) && index >= 0 && index < digits.length && Number.isFinite(value)) {
                digits[index] = Math.min(TIMER_DIGIT_MAX[index], Math.max(0, value));
            }
        });
        return digits;
    }

    function getTimerPickerBaseMs() {
        const timer = stopwatchState.timer;
        if (timer.running) return getTimerRemainingMs();
        return timer.remainingMs || timer.durationMs;
    }

    function persistTimerDuration() {
        try { localStorage.setItem(`${STORAGE_PREFIX}stopwatch_timer_duration`, String(stopwatchState.timer.durationMs)); } catch (_) {}
    }

    function ensureTimerAudioContext() {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        if (!stopwatchState.timer.audioCtx) {
            try { stopwatchState.timer.audioCtx = new AudioCtx(); } catch (_) { return null; }
        }
        if (stopwatchState.timer.audioCtx.state === 'suspended') {
            stopwatchState.timer.audioCtx.resume().catch(() => {});
        }
        return stopwatchState.timer.audioCtx;
    }

    function getUtilityAudioGain(baseGain = 1) {
        try {
            if (localStorage.getItem('awm_audio_effects') === '0') return 0;
        } catch (_) {}
        let volume = 1;
        try {
            const stored = Number.parseFloat(localStorage.getItem('awm_volume') || '1');
            if (Number.isFinite(stored)) volume = Math.min(1, Math.max(0, stored));
        } catch (_) {}
        return Math.min(1, Math.max(0, Number(baseGain) || 0)) * volume;
    }

    function playUtilityTone(ctx, start, frequency, duration, peakGain, type = 'sine') {
        if (!ctx || peakGain <= 0) return;
        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(frequency, start);
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peakGain), start + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + duration + 0.025);
        } catch (_) {}
    }

    function playUtilityClickSound(kind = 'button') {
        const peak = getUtilityAudioGain(kind === 'crown' ? 0.1 : 0.07);
        if (peak <= 0) return;
        const ctx = ensureTimerAudioContext();
        if (!ctx) return;
        const start = ctx.currentTime + 0.012;
        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(kind === 'soft' ? 420 : 680, start);
            osc.frequency.exponentialRampToValueAtTime(kind === 'soft' ? 170 : 230, start + 0.04);
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(peak, start + 0.006);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.038);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.055);
        } catch (_) {}
    }

    function playTimerToggleSignal(starting) {
        const peak = getUtilityAudioGain(0.11);
        if (peak <= 0) return;
        const ctx = ensureTimerAudioContext();
        if (!ctx) return;
        const start = ctx.currentTime + 0.016;
        const tones = starting ? [760, 980] : [620, 460];
        tones.forEach((frequency, index) => {
            playUtilityTone(ctx, start + index * 0.105, frequency, 0.07, peak, 'square');
        });
    }

    function playTimerAlarmSignal() {
        const ctx = ensureTimerAudioContext();
        if (!ctx) return;
        const peak = getUtilityAudioGain(0.18);
        if (peak <= 0) return;
        const start = ctx.currentTime + 0.02;
        for (let i = 0; i < 5; i += 1) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const toneStart = start + i * 0.22;
            osc.type = 'square';
            osc.frequency.setValueAtTime(i % 2 ? 920 : 740, toneStart);
            gain.gain.setValueAtTime(0.0001, toneStart);
            gain.gain.exponentialRampToValueAtTime(peak, toneStart + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, toneStart + 0.14);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(toneStart);
            osc.stop(toneStart + 0.16);
        }
    }

    function updateTimerDisplay() {
        const timer = stopwatchState.timer;
        const remaining = getTimerRemainingMs();
        const value = el('mapStopwatchTimerValue');
        const label = el('mapStopwatchTimerLabel');
        if (value) value.textContent = formatTimerDuration(timer.alarm ? 0 : (remaining || timer.durationMs));
        if (label) label.textContent = timer.alarm ? 'DONE' : (timer.running ? 'RUN' : 'TIMER');
        syncTimerAlarmUi();
        syncTimerPicker();
    }

    function syncTimerPicker() {
        const timer = stopwatchState.timer;
        const picker = el('mapStopwatchTimerPicker');
        if (!picker) return;
        if (timer.pickerOpen && timer.running) timer.pickerDraftMs = clampTimerDuration(getTimerRemainingMs());
        const digits = durationToTimerDigits(timer.pickerDraftMs || timer.durationMs);
        picker.querySelectorAll('[data-timer-drag]').forEach(button => {
            const index = Number(button.dataset.timerDrag);
            if (Number.isInteger(index) && index >= 0 && index < digits.length) {
                button.textContent = String(digits[index]);
            }
        });
        const startStop = el('mapStopwatchTimerStartStop');
        if (startStop) startStop.textContent = timer.running ? 'STOP' : 'START';
        picker.classList.toggle('open', !!timer.pickerOpen);
        picker.classList.toggle('is-running', !!timer.running);
        picker.classList.toggle('is-alarm', !!timer.alarm);
        picker.setAttribute('aria-hidden', timer.pickerOpen ? 'false' : 'true');
    }

    function setTimerPickerOpen(open) {
        const timer = stopwatchState.timer;
        timer.pickerOpen = !!open;
        if (timer.pickerOpen) {
            timer.pickerDraftMs = clampTimerDuration(getTimerPickerBaseMs());
            const panel = el('mapStopwatchDevice');
            if (panel) bringToFront(panel);
        }
        syncTimerPicker();
    }

    function setTimerPickerDraft(durationMs, commit = true) {
        const timer = stopwatchState.timer;
        timer.pickerDraftMs = clampTimerDuration(durationMs);
        if (commit) {
            if (timer.running) pauseTimer();
            timer.alarm = false;
            timer.durationMs = timer.pickerDraftMs;
            timer.remainingMs = timer.pickerDraftMs;
            timer.startedAt = 0;
            persistTimerDuration();
            updateStopwatchDisplay();
            return;
        }
        syncTimerPicker();
    }

    function adjustTimerPickerDigit(index, delta) {
        const digitIndex = Number(index);
        const step = Number(delta);
        if (!Number.isInteger(digitIndex) || digitIndex < 0 || digitIndex > 3 || !Number.isFinite(step) || step === 0) return;
        const digits = durationToTimerDigits(stopwatchState.timer.pickerDraftMs || getTimerPickerBaseMs());
        const max = TIMER_DIGIT_MAX[digitIndex];
        const range = max + 1;
        digits[digitIndex] = ((digits[digitIndex] + step) % range + range) % range;
        playUtilityClickSound('soft');
        setTimerPickerDraft(timerDigitsToDuration(digits), true);
    }

    function resetTimerFromPicker() {
        playUtilityClickSound('soft');
        const timer = stopwatchState.timer;
        timer.alarm = false;
        timer.running = false;
        timer.startedAt = 0;
        timer.pickerDraftMs = clampTimerDuration(timer.durationMs);
        timer.remainingMs = timer.pickerDraftMs;
        updateStopwatchDisplay();
    }

    function handleTimerPickerStartStop(event) {
        cleanupTimerDigitDrag();
        const timer = stopwatchState.timer;
        if (timer.running) {
            pauseTimer();
            playTimerToggleSignal(false);
            timer.pickerDraftMs = clampTimerDuration(timer.remainingMs || timer.durationMs);
        } else {
            timer.pickerDraftMs = timerDigitsToDuration(readTimerPickerDigits());
            startTimer(timer.pickerDraftMs || timer.durationMs);
            playTimerToggleSignal(true);
        }
        event.preventDefault();
        event.stopPropagation();
    }

    function handleTimerPickerClick(event) {
        const stepButton = event.target.closest('[data-timer-step]');
        if (!stepButton) return;
        adjustTimerPickerDigit(stepButton.dataset.timerDigitIndex, Number(stepButton.dataset.timerStep));
        event.preventDefault();
        event.stopPropagation();
    }

    function handleTimerPickerPointerDown(event) {
        const valueButton = event.target.closest('[data-timer-drag]');
        if (!valueButton) return;
        if (event.button !== undefined && event.button !== 0) return;
        startTimerDigitDrag(valueButton, event.pointerId, event.clientY, event);
    }

    function handleTimerPickerMouseDown(event) {
        const valueButton = event.target.closest('[data-timer-drag]');
        if (!valueButton || timerDigitDragState) return;
        if (event.button !== undefined && event.button !== 0) return;
        startTimerDigitDrag(valueButton, 'mouse', event.clientY, event);
    }

    function startTimerDigitDrag(valueButton, pointerId, clientY, event) {
        cleanupTimerDigitDrag();
        timerDigitDragState = {
            pointerId,
            index: Number(valueButton.dataset.timerDrag),
            startY: clientY,
            lastStep: 0,
            moved: false,
            target: valueButton
        };
        valueButton.classList.add('is-dragging');
        if (pointerId !== 'mouse') {
            if (valueButton.setPointerCapture) valueButton.setPointerCapture(pointerId);
            window.addEventListener('pointermove', handleTimerPickerPointerMove, true);
            window.addEventListener('pointerup', endTimerPickerDrag, true);
            window.addEventListener('pointercancel', endTimerPickerDrag, true);
        } else {
            window.addEventListener('mousemove', handleTimerPickerMouseMove, true);
            window.addEventListener('mouseup', endTimerPickerMouseDrag, true);
        }
        event.preventDefault();
        event.stopPropagation();
    }

    function handleTimerPickerPointerMove(event) {
        if (!timerDigitDragState || timerDigitDragState.pointerId !== event.pointerId) return;
        moveTimerDigitDrag(event.pointerId, event.clientY, event);
    }

    function handleTimerPickerMouseMove(event) {
        if (!timerDigitDragState || timerDigitDragState.pointerId !== 'mouse') return;
        moveTimerDigitDrag('mouse', event.clientY, event);
    }

    function moveTimerDigitDrag(pointerId, clientY, event) {
        if (!timerDigitDragState || timerDigitDragState.pointerId !== pointerId) return;
        const nextStep = Math.trunc((timerDigitDragState.startY - clientY) / TIMER_DIGIT_DRAG_STEP_PX);
        const delta = nextStep - timerDigitDragState.lastStep;
        if (delta !== 0) {
            timerDigitDragState.moved = true;
            timerDigitDragState.lastStep = nextStep;
            adjustTimerPickerDigit(timerDigitDragState.index, delta);
        }
        event.preventDefault();
        event.stopPropagation();
    }

    function cleanupTimerDigitDrag(event) {
        if (!timerDigitDragState) return;
        const target = timerDigitDragState.target;
        if (target) {
            target.classList.remove('is-dragging');
            if (
                event
                && target.releasePointerCapture
                && target.hasPointerCapture
                && target.hasPointerCapture(event.pointerId)
            ) {
                target.releasePointerCapture(event.pointerId);
            }
        }
        window.removeEventListener('pointermove', handleTimerPickerPointerMove, true);
        window.removeEventListener('pointerup', endTimerPickerDrag, true);
        window.removeEventListener('pointercancel', endTimerPickerDrag, true);
        window.removeEventListener('mousemove', handleTimerPickerMouseMove, true);
        window.removeEventListener('mouseup', endTimerPickerMouseDrag, true);
        timerDigitDragState = null;
    }

    function endTimerPickerDrag(event) {
        if (!timerDigitDragState || timerDigitDragState.pointerId !== event.pointerId) return;
        cleanupTimerDigitDrag(event);
        event.preventDefault();
        event.stopPropagation();
    }

    function endTimerPickerMouseDrag(event) {
        if (!timerDigitDragState || timerDigitDragState.pointerId !== 'mouse') return;
        cleanupTimerDigitDrag(event);
        event.preventDefault();
        event.stopPropagation();
    }

    function finishTimer() {
        const timer = stopwatchState.timer;
        timer.running = false;
        timer.remainingMs = 0;
        timer.startedAt = 0;
        timer.alarm = true;
        updateTimerDisplay();
        playTimerAlarmSignal();
    }

    function startTimer(durationMs) {
        const timer = stopwatchState.timer;
        const nextDuration = Number(durationMs);
        if (Number.isFinite(nextDuration) && nextDuration > 0) {
            timer.durationMs = clampTimerDuration(nextDuration);
            timer.remainingMs = timer.durationMs;
            timer.pickerDraftMs = timer.durationMs;
            persistTimerDuration();
        }
        if (timer.remainingMs <= 0) timer.remainingMs = timer.durationMs;
        timer.alarm = false;
        timer.startedAt = performance.now();
        timer.running = true;
        ensureTimerAudioContext();
        updateStopwatchDisplay();
    }

    function pauseTimer() {
        const timer = stopwatchState.timer;
        timer.remainingMs = getTimerRemainingMs();
        timer.pickerDraftMs = clampTimerDuration(timer.remainingMs || timer.durationMs);
        timer.running = false;
        timer.startedAt = 0;
        updateStopwatchDisplay();
    }

    function acknowledgeTimerAlarm() {
        const timer = stopwatchState.timer;
        timer.alarm = false;
        timer.running = false;
        timer.remainingMs = timer.durationMs;
        timer.pickerDraftMs = timer.durationMs;
        updateStopwatchDisplay();
    }

    function toggleTimerFromDial() {
        cleanupTimerDigitDrag();
        const timer = stopwatchState.timer;
        if (timer.alarm) {
            playUtilityClickSound('soft');
            acknowledgeTimerAlarm();
            return;
        }
        ensureTimerAudioContext();
        if (timer.running) {
            pauseTimer();
            playTimerToggleSignal(false);
            return;
        }
        if (timer.pickerOpen) {
            timer.pickerDraftMs = timerDigitsToDuration(readTimerPickerDigits());
            startTimer(timer.pickerDraftMs);
            playTimerToggleSignal(true);
            return;
        }
        startTimer();
        playTimerToggleSignal(true);
    }

    function handleTimerDisplayClick(event) {
        playUtilityClickSound('soft');
        setTimerPickerOpen(true);
        event.preventDefault();
        event.stopPropagation();
    }

    function updateStopwatchDisplay() {
        stopwatchState.frame = 0;
        const ms = getStopwatchElapsedMs();
        const elapsed = el('mapStopwatchElapsed');
        const secondHand = el('mapStopwatchSecondHand');
        const tenthHand = el('mapStopwatchTenthHand');
        const minuteHand = el('mapStopwatchMinuteHand');
        if (elapsed) elapsed.textContent = formatElapsed(ms);
        if (secondHand) secondHand.style.transform = `rotate(${(ms / 1000 % 60) * 6}deg)`;
        if (tenthHand) tenthHand.style.transform = `rotate(${(ms / 100 % 10) * 36}deg)`;
        if (minuteHand) minuteHand.style.transform = `rotate(${(ms / 60000 % 60) * 6}deg)`;
        if (stopwatchState.timer.running && getTimerRemainingMs() <= 0) finishTimer();
        else updateTimerDisplay();
        const startStop = el('mapStopwatchStartStop');
        if (startStop) startStop.textContent = stopwatchState.running ? 'STOP' : 'START';
        if (stopwatchState.running || stopwatchState.timer.running) {
            stopwatchState.frame = requestAnimationFrame(updateStopwatchDisplay);
        }
    }

    function updateClockFields() {
        const now = new Date();
        const utc = el('mapStopwatchUtc');
        const local = el('mapStopwatchLocal');
        if (utc) utc.textContent = now.toISOString().slice(11, 19);
        if (local) {
            local.textContent = now.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
    }

    function startClockTimer() {
        updateClockFields();
        if (stopwatchState.clockTimer) return;
        stopwatchState.clockTimer = window.setInterval(updateClockFields, 1000);
    }

    function stopClockTimerIfIdle() {
        if (isMapUtilityToolOpen('stopwatch')) return;
        if (stopwatchState.clockTimer) {
            clearInterval(stopwatchState.clockTimer);
            stopwatchState.clockTimer = 0;
        }
    }

    function toggleStopwatch() {
        playUtilityClickSound('crown');
        if (stopwatchState.running) {
            stopwatchState.elapsedMs = getStopwatchElapsedMs();
            stopwatchState.running = false;
            if (stopwatchState.frame) cancelAnimationFrame(stopwatchState.frame);
            stopwatchState.frame = 0;
        } else {
            stopwatchState.startedAt = performance.now();
            stopwatchState.running = true;
        }
        updateStopwatchDisplay();
    }

    function resetStopwatch() {
        playUtilityClickSound('soft');
        stopwatchState.elapsedMs = 0;
        stopwatchState.startedAt = performance.now();
        updateStopwatchDisplay();
    }

    function applyStopwatchScale(compact, persist = true) {
        const panel = el('mapStopwatchDevice');
        const button = el('mapStopwatchScale');
        stopwatchState.compact = !!compact;
        if (panel) {
            panel.classList.toggle('is-compact', stopwatchState.compact);
            if (panel.style.display !== 'none') {
                requestAnimationFrame(() => {
                    clampPanel(panel);
                    const cfg = getToolConfig('stopwatch');
                    if (cfg) savePanelPosition(cfg);
                });
            }
        }
        if (button) {
            button.textContent = stopwatchState.compact ? '100%' : '50%';
            button.title = stopwatchState.compact ? 'Uhr auf 100% vergrößern' : 'Uhr auf 50% verkleinern';
        }
        if (persist) {
            try { localStorage.setItem(`${STORAGE_PREFIX}stopwatch_scale`, stopwatchState.compact ? '50' : '100'); } catch (_) {}
        }
    }

    function toggleStopwatchScale() {
        playUtilityClickSound('soft');
        applyStopwatchScale(!stopwatchState.compact);
    }

    function setCalcDisplay(value, stateValue) {
        const displayValue = String(value || '0');
        calcState.display = String(typeof stateValue === 'undefined' ? displayValue : (stateValue || '0'));
        if (calcState.display === '-0') calcState.display = '0';
        const result = el('mapCalculatorResult');
        if (result) {
            result.textContent = displayValue === '-0' ? '0' : displayValue;
            result.classList.toggle('is-labeled', result.textContent !== calcState.display);
        }
    }

    function setCalcExpression(value) {
        calcState.expression = String(value || '');
        const expression = el('mapCalculatorExpression');
        if (expression) expression.textContent = calcState.expression || 'DEG';
    }

    function setCalcExpressionHtml(value, plainText) {
        calcState.expression = String(plainText || '');
        const expression = el('mapCalculatorExpression');
        if (expression) expression.innerHTML = value || 'DEG';
    }

    function calcOperatorSymbol(operator) {
        if (operator === '*') return '×';
        if (operator === '/') return '÷';
        if (operator === '-') return '−';
        return '+';
    }

    function escapeCalcHtml(value) {
        return String(value || '').replace(/[&<>"']/g, char => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char] || char));
    }

    function escapeCalcRegExp(value) {
        return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function formatCalcNumber(value) {
        if (!Number.isFinite(value)) return 'ERR';
        const displayValue = Math.abs(value) < 1e-12 ? 0 : value;
        const rounded = Math.abs(displayValue) >= 1000000000 || (Math.abs(displayValue) > 0 && Math.abs(displayValue) < 0.000001)
            ? displayValue.toExponential(6)
            : String(Math.round(displayValue * 1000000000) / 1000000000);
        return rounded.length > 12 ? Number(displayValue).toPrecision(7) : rounded;
    }

    function formatCalcFormulaNumber(value) {
        const text = String(value || '0').trim();
        if (!text || text === '-' || text === '.' || text === '-.' || text.endsWith('.')) return text || '0';
        const number = Number(text);
        if (!Number.isFinite(number)) return text;
        const rounded = Math.round((number + Math.sign(number) * Number.EPSILON) * 100) / 100;
        if (Math.abs(rounded) < 0.005) return '0';
        return rounded.toFixed(2).replace(/\.?0+$/, '');
    }

    function inferFormulaUnit(formula, name, role = 'variable') {
        const cleanName = String(name || '').replace(/[()]/g, '').trim();
        const resultName = String(formula && formula.result || '');
        const expr = String(formula && formula.expr || '');
        const speedNames = new Set(['GS', 'IAS', 'TAS', 'Wind', 'Headwind', 'Crosswind', 'Vs', 'Böendifferenz', 'kt']);
        const distanceNames = new Set(['Distanz', 'Ablage', 'Range', 'Reserve-NM', 'NM', 'TOD', 'Rest']);
        const altitudeNames = new Set(['Höhe', 'PA', 'DA', 'Indicated', 'True Alt', 'QNH-Höhe', 'Elevation', 'ft']);
        const timeNames = new Set(['Zeit', 'Reservezeit', 'Endurance']);
        const fuelNames = new Set(['Fuel', 'Reservefuel', 'TripFuel', 'Tagreserve', 'Nachtreserve', 'Fuel+5%']);
        if (role === 'result') {
            if (cleanName === 'Zeit h' || /Zeit|Endurance/.test(cleanName)) return 'h';
            if (/NM$|Distanz|Range/.test(cleanName)) return 'NM';
            if (/°$|mwK|Korrektur|Winkel/.test(cleanName)) return '°';
            if (/km\/h/.test(cleanName)) return 'km/h';
            if (/Fuel/.test(cleanName)) return 'gal';
            if (/VS|ROC/.test(cleanName)) return 'ft/min';
            if (cleanName === 'ft/NM') return 'ft/NM';
            if (cleanName === 'ft' || /PA|DA|True Alt|QNH-Höhe|Startstrecke/.test(cleanName)) return 'ft';
            if (/GS|IAS|TAS|Headwind|Crosswind|Vs |Vref/.test(cleanName)) return 'Kn';
            if (cleanName === 'ISA °C') return '°C';
            if (['km', 'm', 'l', 'kg'].includes(cleanName)) return cleanName;
        }
        if (speedNames.has(cleanName) || /^Vs /.test(cleanName)) return 'Kn';
        if (fuelNames.has(cleanName)) return 'gal';
        if (cleanName === 'GPH' || cleanName === 'Verbrauch') return 'gal/h';
        if (timeNames.has(cleanName)) return 'h';
        if (altitudeNames.has(cleanName) || cleanName === 'Startstrecke' || resultName === 'ft') return 'ft';
        if (cleanName === 'Druckdiff' || cleanName === 'QNH') return 'hPa';
        if (cleanName === 'FL') return '';
        if (cleanName === 'ftNM' || cleanName === 'GradientFtNm') return 'ft/NM';
        if (cleanName === 'ROC') return 'ft/min';
        if (cleanName === 'OAT' || cleanName === 'ISA' || cleanName === 'DeltaISA' || cleanName === 'ISA °C') return '°C';
        if (cleanName === 'Gradient' || cleanName === 'Steigung') return '%';
        if (cleanName === 'Winkel' || cleanName === 'Korrektur °' || cleanName === 'mwK' || cleanName === 'rwK' || cleanName === 'Ost' || cleanName === 'West' || cleanName === 'Winkel °' || cleanName === 'Parallel' || cleanName === 'Ziel') return '°';
        if (cleanName === 'cm') return 'cm';
        if (cleanName === 'km') return 'km';
        if (cleanName === 'km/h') return 'km/h';
        if (cleanName === 'm') return 'm';
        if (cleanName === 'l') return 'l';
        if (cleanName === 'kg') return 'kg';
        if (cleanName === 'gal') return 'gal';
        if (cleanName === 'lb') return 'lb';
        if (cleanName === 'Strecke' && /Steigung|1\.2|1\.3/.test(expr)) return 'ft';
        if (distanceNames.has(cleanName) || cleanName === 'Strecke') return 'NM';
        return '';
    }

    function cleanFormulaLabel(label, unit) {
        let text = String(label || '').trim();
        const suffixes = ['ft/min', 'ft/NM', 'km/h', 'NM', '°C', '°', 'ft', 'Kn', 'kt', 'hPa', 'h', 'gal', 'km', 'm', 'l', 'kg', '%'];
        suffixes.forEach(suffix => {
            if (unit === suffix && text.endsWith(` ${suffix}`)) text = text.slice(0, -suffix.length - 1).trim();
        });
        if (unit === 'NM' && text.endsWith('-NM')) text = text.slice(0, -3).trim();
        return text || label;
    }

    function formatCalcLabeledValue(label, value, unit) {
        const text = formatCalcFormulaNumber(value);
        const cleanLabel = cleanFormulaLabel(label, unit);
        return `${cleanLabel} ${text}${unit ? ` ${unit}` : ''}`;
    }

    function getCalcFormulaButtons() {
        const keypad = document.querySelector('#mapCalculatorDevice .calculator-keypad');
        if (!keypad) return { keypad: null, sin: null, cos: null, tan: null };
        return {
            keypad,
            sin: keypad.querySelector('[data-calc="function"][data-fn="sin"], [data-calc="formulaNext"][data-fn="sin"]'),
            cos: keypad.querySelector('[data-calc="function"][data-fn="cos"], [data-calc="formulaNext"][data-fn="cos"]'),
            tan: keypad.querySelector('[data-calc="function"][data-fn="tan"], [data-calc="formulaNext"][data-fn="tan"]')
        };
    }

    function setCalcFormulaKeyMode(active) {
        const { keypad, sin, cos, tan } = getCalcFormulaButtons();
        if (keypad) keypad.classList.toggle('formula-entry', !!active);
        [sin, cos, tan].forEach(button => {
            if (!button) return;
            button.hidden = false;
            if (!button.dataset.normalCalc) button.dataset.normalCalc = 'function';
            if (!button.dataset.normalText) button.dataset.normalText = button.textContent || button.dataset.fn || '';
            button.dataset.calc = 'function';
            button.textContent = button.dataset.normalText;
            button.title = '';
        });
        if (!active || !sin) return;
        sin.dataset.calc = 'formulaNext';
        sin.textContent = 'TAB';
        sin.title = 'Nächste Variable';
    }

    function clearActiveFormulaLine() {
        document.querySelectorAll('.formula-panel span.is-selected-formula').forEach(line => {
            line.classList.remove('is-selected-formula');
        });
    }

    function splitFormulaVars(value) {
        return String(value || '')
            .split(',')
            .map(part => part.trim())
            .filter(Boolean);
    }

    function isFormulaEntryComplete(value) {
        const text = String(value || '').trim();
        if (!text || text === '-' || text === '.' || text === '-.') return false;
        return Number.isFinite(Number(text));
    }

    function substituteCalcFormulaExpression(formula) {
        if (!formula) return '';
        let expression = formula.expr;
        formula.vars.slice().sort((a, b) => b.length - a.length).forEach(name => {
            const value = Object.prototype.hasOwnProperty.call(formula.values, name)
                ? formula.values[name]
                : '0';
            expression = expression.replace(new RegExp(escapeCalcRegExp(name), 'g'), value);
        });
        return expression;
    }

    function renderCalcFormula() {
        const formula = calcState.formula;
        if (!formula) return;
        const activeName = formula.vars[formula.current] || '';
        const activeUnit = inferFormulaUnit(formula, activeName);
        let html = escapeCalcHtml(formula.display);
        formula.vars.slice().sort((a, b) => b.length - a.length).forEach(name => {
            const stored = Object.prototype.hasOwnProperty.call(formula.values, name) ? formula.values[name] : '';
            const rawValue = name === activeName ? (formula.entry || stored) : stored;
            const raw = rawValue || name;
            const classes = ['formula-var'];
            if (name === activeName) classes.push('is-active');
            if (stored) classes.push('has-value');
            const visibleValue = rawValue ? formatCalcFormulaNumber(rawValue) : raw;
            const replacement = `<span class="${classes.join(' ')}">${escapeCalcHtml(visibleValue)}</span>`;
            html = html.replace(new RegExp(escapeCalcRegExp(escapeCalcHtml(name)), 'g'), replacement);
        });
        setCalcExpressionHtml(html, formula.display);
        const entryValue = formula.entry || formula.values[activeName] || '0';
        setCalcDisplay(formatCalcLabeledValue(activeName, entryValue, activeUnit), entryValue);
    }

    function commitCalcFormulaEntry() {
        const formula = calcState.formula;
        if (!formula) return;
        const activeName = formula.vars[formula.current];
        if (!activeName) return;
        if (isFormulaEntryComplete(formula.entry)) formula.values[activeName] = formula.entry;
    }

    function endCalcFormulaMode() {
        if (!calcState.formula) return;
        clearActiveFormulaLine();
        calcState.formula = null;
        setCalcFormulaKeyMode(false);
    }

    function startCalcFormulaFromLine(line) {
        if (!line || !line.dataset.formulaExpr) return;
        const vars = splitFormulaVars(line.dataset.formulaVars);
        if (!vars.length) return;
        clearActiveFormulaLine();
        line.classList.add('is-selected-formula');
        calcState.formula = {
            expr: line.dataset.formulaExpr,
            vars,
            result: line.dataset.formulaResult || 'Result',
            display: (line.textContent || '').trim(),
            values: {},
            current: 0,
            entry: ''
        };
        calcState.justEvaluated = false;
        setCalcFormulaKeyMode(true);
        renderCalcFormula();
        playUtilityClickSound('soft');
    }

    function nextCalcFormulaVariable() {
        const formula = calcState.formula;
        if (!formula) return;
        commitCalcFormulaEntry();
        formula.current = (formula.current + 1) % formula.vars.length;
        const activeName = formula.vars[formula.current];
        formula.entry = formula.values[activeName] || '';
        renderCalcFormula();
    }

    function inputCalcFormulaDigit(value) {
        const formula = calcState.formula;
        if (!formula || formula.entry.replace('-', '').replace('.', '').length >= 10) return;
        formula.entry = formula.entry === '0' ? String(value || '0') : `${formula.entry}${value || '0'}`;
        renderCalcFormula();
    }

    function inputCalcFormulaDecimal() {
        const formula = calcState.formula;
        if (!formula || formula.entry.includes('.')) return;
        formula.entry = formula.entry ? `${formula.entry}.` : '0.';
        renderCalcFormula();
    }

    function backspaceCalcFormula() {
        const formula = calcState.formula;
        if (!formula) return;
        const activeName = formula.vars[formula.current];
        if (formula.entry) {
            formula.entry = formula.entry.slice(0, -1);
        } else if (activeName && Object.prototype.hasOwnProperty.call(formula.values, activeName)) {
            delete formula.values[activeName];
        }
        renderCalcFormula();
    }

    function toggleCalcFormulaSign() {
        const formula = calcState.formula;
        if (!formula) return;
        const value = formula.entry || '0';
        formula.entry = value.startsWith('-') ? value.slice(1) : `-${value}`;
        renderCalcFormula();
    }

    function evaluateCalcFormula() {
        const formula = calcState.formula;
        if (!formula) return;
        commitCalcFormulaEntry();
        const missingIndex = formula.vars.findIndex(name => !isFormulaEntryComplete(formula.values[name]));
        if (missingIndex >= 0) {
            formula.current = missingIndex;
            formula.entry = formula.values[formula.vars[missingIndex]] || '';
            renderCalcFormula();
            return;
        }
        const expression = substituteCalcFormulaExpression(formula);
        try {
            const result = evaluateCalcExpression(expression);
            const formattedResult = formatCalcFormulaNumber(result);
            const resultUnit = inferFormulaUnit(formula, formula.result, 'result');
            endCalcFormulaMode();
            setCalcExpression(`${formula.result} = ${expression}`);
            setCalcDisplay(formatCalcLabeledValue(formula.result, formattedResult, resultUnit), formattedResult);
            calcState.justEvaluated = true;
        } catch (_) {
            endCalcFormulaMode();
            setCalcExpression(formula.display);
            setCalcDisplay('ERR');
            calcState.justEvaluated = true;
        }
    }

    function normalizeCalcExpression(expression) {
        return String(expression || '')
            .replace(/×/g, '*')
            .replace(/÷/g, '/')
            .replace(/−/g, '-')
            .replace(/,/g, '.')
            .replace(/\s+/g, '');
    }

    function prepareCalcExpression(expression) {
        let prepared = String(expression || '').trim();
        while (/[+×÷*/.]$/.test(prepared)) prepared = prepared.slice(0, -1).trim();
        if (prepared.endsWith('−') || prepared.endsWith('-')) prepared = prepared.slice(0, -1).trim();
        if (!prepared) return '';
        const opens = (prepared.match(/\(/g) || []).length;
        const closes = (prepared.match(/\)/g) || []).length;
        if (opens > closes) prepared += ')'.repeat(opens - closes);
        return prepared;
    }

    function evaluateCalcExpression(rawExpression) {
        const source = normalizeCalcExpression(rawExpression);
        let index = 0;

        function peek() {
            return source[index] || '';
        }

        function match(char) {
            if (source[index] === char) {
                index += 1;
                return true;
            }
            return false;
        }

        function parseExpression() {
            let value = parseTerm();
            while (index < source.length) {
                if (match('+')) value += parseTerm();
                else if (match('-')) value -= parseTerm();
                else break;
            }
            return value;
        }

        function parseTerm() {
            let value = parseUnary();
            while (index < source.length) {
                if (match('*')) value *= parseUnary();
                else if (match('/')) {
                    const divisor = parseUnary();
                    value = divisor === 0 ? NaN : value / divisor;
                } else {
                    break;
                }
            }
            return value;
        }

        function parseUnary() {
            if (match('+')) return parseUnary();
            if (match('-')) return -parseUnary();
            return parsePostfix();
        }

        function parsePostfix() {
            let value = parsePrimary();
            while (match('%')) value /= 100;
            return value;
        }

        function parsePrimary() {
            const char = peek();
            if (match('(')) {
                const value = parseExpression();
                if (!match(')')) throw new Error('missing-paren');
                return value;
            }
            if (/[a-z]/i.test(char)) {
                const start = index;
                while (/[a-z]/i.test(peek())) index += 1;
                const name = source.slice(start, index).toLowerCase();
                if (!['sin', 'cos', 'tan'].includes(name)) throw new Error('unknown-function');
                if (!match('(')) throw new Error('function-paren');
                const degrees = parseExpression();
                if (!match(')')) throw new Error('missing-paren');
                const radians = degrees * Math.PI / 180;
                if (name === 'sin') return Math.sin(radians);
                if (name === 'cos') return Math.cos(radians);
                return Math.tan(radians);
            }
            if (/\d|\./.test(char)) {
                const start = index;
                while (/\d|\./.test(peek())) index += 1;
                const numberText = source.slice(start, index);
                if ((numberText.match(/\./g) || []).length > 1) throw new Error('bad-number');
                const value = Number(numberText);
                if (!Number.isFinite(value)) throw new Error('bad-number');
                return value;
            }
            throw new Error('unexpected-token');
        }

        const result = parseExpression();
        if (index !== source.length) throw new Error('trailing-token');
        return result;
    }

    function currentCalcSegment(expression) {
        const compact = String(expression || '').trim();
        const match = compact.match(/(?:^|[+\-×÷*/(])\s*([−-]?\d+(?:\.\d*)?|[−-]?\.\d+)%?$/);
        return match ? match[1] : '';
    }

    function trimCalcEnd(value) {
        return String(value == null ? '' : value).replace(/\s+$/, '');
    }

    function previewCalcEntry() {
        const segment = currentCalcSegment(calcState.expression);
        if (segment) {
            setCalcDisplay(segment);
            return;
        }
        if (!calcState.expression) setCalcDisplay('0');
    }

    function appendCalcExpression(part, options = {}) {
        let expression = calcState.expression;
        if (calcState.justEvaluated) {
            expression = options.continueResult ? calcState.display : '';
            calcState.justEvaluated = false;
        }
        if (expression.length >= 48) return;
        setCalcExpression(expression + part);
        if (options.preview !== false) previewCalcEntry();
    }

    function inputDigit(value) {
        let expression = calcState.justEvaluated ? '' : calcState.expression;
        calcState.justEvaluated = false;
        const segment = currentCalcSegment(expression);
        if (segment === '0' && /(?:^|[+\-×÷*/(])\s*0$/.test(expression.trim())) {
            expression = expression.replace(/0$/, value);
            setCalcExpression(expression);
            previewCalcEntry();
            return;
        }
        appendCalcExpression(value);
    }

    function inputDecimal() {
        let expression = calcState.expression;
        if (calcState.justEvaluated) {
            expression = '';
            calcState.justEvaluated = false;
        }
        const segment = currentCalcSegment(expression);
        if (segment.includes('.')) return;
        if (!segment) {
            setCalcExpression(`${expression}0.`);
            setCalcDisplay('0.');
            return;
        }
        appendCalcExpression('.');
    }

    function applyOperator(operator) {
        let expression = calcState.justEvaluated ? calcState.display : trimCalcEnd(calcState.expression);
        calcState.justEvaluated = false;
        const symbol = calcOperatorSymbol(operator);
        if (!expression) {
            if (operator === '-') setCalcExpression('−');
            return;
        }
        if (/[+×÷*/−-]\s*$/.test(expression)) expression = expression.replace(/[+×÷*/−-]\s*$/, symbol);
        else expression += ` ${symbol} `;
        setCalcExpression(expression);
    }

    function evaluateCalc() {
        const expression = prepareCalcExpression(calcState.expression);
        if (!expression) return;
        try {
            const result = evaluateCalcExpression(expression);
            setCalcExpression(expression);
            setCalcDisplay(formatCalcNumber(result));
        } catch (error) {
            setCalcDisplay('ERR');
            reportUtility('warn', 'calculator', 'evaluation-error', error && error.message || 'Ungueltiger Ausdruck');
        }
        calcState.justEvaluated = true;
    }

    function clearCalc() {
        endCalcFormulaMode();
        setCalcExpression('');
        calcState.justEvaluated = false;
        setCalcDisplay('0');
    }

    function backspaceCalc() {
        if (calcState.justEvaluated || calcState.display === 'ERR') {
            clearCalc();
            return;
        }
        const trimmed = trimCalcEnd(calcState.expression);
        setCalcExpression(trimmed.slice(0, -1));
        previewCalcEntry();
    }

    function toggleCalcSign() {
        if (calcState.justEvaluated) {
            const value = Number(calcState.display);
            if (!Number.isFinite(value) || value === 0) return;
            setCalcDisplay(formatCalcNumber(-value));
            setCalcExpression(calcState.display);
            return;
        }
        const expression = calcState.expression;
        const match = expression.match(/([−-]?\d+(?:\.\d*)?|[−-]?\.\d+)$/);
        if (!match) {
            appendCalcExpression('−');
            return;
        }
        const start = expression.length - match[0].length;
        const replacement = match[0].startsWith('-') || match[0].startsWith('−')
            ? match[0].slice(1)
            : `−${match[0]}`;
        setCalcExpression(expression.slice(0, start) + replacement);
        previewCalcEntry();
    }

    function percentCalc() {
        appendCalcExpression('%');
    }

    function inputCalcFunction(name) {
        const fn = String(name || '').toLowerCase();
        if (!['sin', 'cos', 'tan'].includes(fn)) return;
        let prefix = '';
        const expression = calcState.justEvaluated ? '' : trimCalcEnd(calcState.expression);
        calcState.justEvaluated = false;
        if (expression && /[+×÷−-]$/.test(expression)) prefix = ' ';
        else if (expression && /[\d)%]$/.test(expression)) prefix = ' × ';
        setCalcExpression(`${expression}${prefix}${fn}(`);
        setCalcDisplay('0');
    }

    function inputCalcParen(paren) {
        const value = paren === ')' ? ')' : '(';
        let expression = calcState.justEvaluated ? '' : trimCalcEnd(calcState.expression);
        calcState.justEvaluated = false;
        if (value === '(' && expression && /[\d)%]$/.test(expression)) expression += ' × ';
        setCalcExpression(expression + value);
        previewCalcEntry();
    }

    function handleCalcButton(event) {
        const button = event.target.closest('[data-calc]');
        if (!button) return;
        const action = button.dataset.calc;
        if (calcState.formula) {
            if (action === 'digit') inputCalcFormulaDigit(button.dataset.value || '0');
            else if (action === 'decimal') inputCalcFormulaDecimal();
            else if (action === 'backspace') backspaceCalcFormula();
            else if (action === 'formulaNext' || action === 'function') nextCalcFormulaVariable();
            else if (action === 'operator' && (button.dataset.op || '') === '-') toggleCalcFormulaSign();
            else if (action === 'equals') evaluateCalcFormula();
            else if (action === 'clear') clearCalc();
            event.preventDefault();
            return;
        }
        if (action === 'digit') inputDigit(button.dataset.value || '0');
        else if (action === 'decimal') inputDecimal();
        else if (action === 'operator') applyOperator(button.dataset.op || '+');
        else if (action === 'equals') evaluateCalc();
        else if (action === 'clear') clearCalc();
        else if (action === 'backspace') backspaceCalc();
        else if (action === 'sign') toggleCalcSign();
        else if (action === 'percent') percentCalc();
        else if (action === 'function') inputCalcFunction(button.dataset.fn);
        else if (action === 'paren') inputCalcParen(button.dataset.value);
        event.preventDefault();
    }

    function placeFormulaDrawer(panel, drawer) {
        if (!panel || !drawer) return;
        const margin = 12;
        const gap = 12;
        const panelRect = panel.getBoundingClientRect();
        const spaceRight = window.innerWidth - panelRect.right;
        const spaceLeft = panelRect.left;
        const crampedSide = Math.max(spaceRight, spaceLeft) < 260;
        const narrowLayout = window.innerWidth <= 767 || crampedSide;
        const drawerHeight = () => Math.min(maxHeight, Math.max(180, drawer.scrollHeight || 220));

        const viewportWidth = Math.max(220, window.innerWidth - margin * 2);
        const preferredMaxWidth = Math.min(400, viewportWidth);
        const sideCapacity = Math.max(spaceRight, spaceLeft) - gap - margin;
        let width = Math.min(preferredMaxWidth, Math.max(260, sideCapacity));
        let maxHeight = Math.min(480, Math.max(220, window.innerHeight - margin * 2 - 28));

        if (narrowLayout) {
            width = Math.min(380, Math.max(220, viewportWidth));
            maxHeight = Math.min(340, Math.max(190, window.innerHeight - margin * 2));
            let left = panelRect.left + (panelRect.width - width) / 2;
            left = Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - width - margin));
            const belowTop = panelRect.bottom + gap;
            const availableBelow = window.innerHeight - margin - belowTop;
            const availableAbove = panelRect.top - margin - gap;
            let top;
            if (availableBelow >= 190) {
                maxHeight = Math.min(maxHeight, availableBelow);
                top = belowTop;
            } else if (availableAbove >= 190) {
                maxHeight = Math.min(maxHeight, availableAbove);
                top = panelRect.top - maxHeight - gap;
            } else {
                top = panelRect.top + 86;
            }
            const visibleHeight = drawerHeight();
            top = Math.min(Math.max(margin, top), Math.max(margin, window.innerHeight - visibleHeight - margin));
            panel.classList.remove('formula-left');
            panel.classList.add('formula-under');
            drawer.style.setProperty('--formula-drawer-left', `${Math.round(left - panelRect.left)}px`);
            drawer.style.setProperty('--formula-drawer-top', `${Math.round(top - panelRect.top)}px`);
            drawer.style.setProperty('--formula-drawer-width', `${Math.round(width)}px`);
            drawer.style.setProperty('--formula-drawer-max-height', `${Math.round(maxHeight)}px`);
            return;
        }

        const openLeft = spaceRight < width + gap + margin && spaceLeft > spaceRight;
        let left = openLeft ? panelRect.left - width - gap : panelRect.right + gap;
        left = Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - width - margin));
        let top = panelRect.top + 8;
        top = Math.min(Math.max(margin, top), Math.max(margin, window.innerHeight - drawerHeight() - margin));
        panel.classList.toggle('formula-left', openLeft);
        panel.classList.remove('formula-under');
        drawer.style.setProperty('--formula-drawer-left', `${Math.round(left - panelRect.left)}px`);
        drawer.style.setProperty('--formula-drawer-top', `${Math.round(top - panelRect.top)}px`);
        drawer.style.setProperty('--formula-drawer-width', `${Math.round(width)}px`);
        drawer.style.setProperty('--formula-drawer-max-height', `${Math.round(maxHeight)}px`);
    }

    function setFormulaSectionOpen(section, open) {
        if (!section) return;
        const button = section.querySelector('.formula-section-toggle');
        const panel = section.querySelector('.formula-panel');
        section.classList.toggle('is-open', !!open);
        if (button) button.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (panel) panel.hidden = !open;
    }

    function closeFormulaSections(drawer) {
        if (!drawer) return;
        drawer.querySelectorAll('.formula-section').forEach(section => setFormulaSectionOpen(section, false));
    }

    function scrollFormulaSectionIntoView(drawer, section) {
        if (!drawer || !section) return;
        const maxScroll = Math.max(0, drawer.scrollHeight - drawer.clientHeight);
        const targetTop = Math.min(maxScroll, Math.max(0, section.offsetTop - 8));
        drawer.scrollTop = targetTop;
    }

    function closeFormulaHelp() {
        const overlay = el('mapFormulaHelpOverlay');
        if (!overlay) return;
        overlay.hidden = true;
        overlay.setAttribute('aria-hidden', 'true');
        overlay.classList.remove('is-open');
    }

    function openFormulaHelp(trigger) {
        const key = trigger && trigger.dataset ? trigger.dataset.helpKey : '';
        const data = key ? FORMULA_HELP[key] : null;
        const overlay = el('mapFormulaHelpOverlay');
        const title = el('mapFormulaHelpTitle');
        const formula = el('mapFormulaHelpFormula');
        const body = el('mapFormulaHelpBody');
        if (!data || !overlay || !title || !formula || !body) return;
        title.textContent = data.title || 'Formelhilfe';
        formula.textContent = data.formula || '';
        const paragraphs = (Array.isArray(data.body) ? data.body : [data.body])
            .filter(Boolean)
            .map(text => {
                const p = document.createElement('p');
                p.textContent = String(text);
                return p;
            });
        while (body.firstChild) body.removeChild(body.firstChild);
        paragraphs.forEach(paragraph => body.appendChild(paragraph));
        overlay.hidden = false;
        overlay.setAttribute('aria-hidden', 'false');
        overlay.classList.add('is-open');
        bringToFront(el('mapCalculatorDevice'));
    }

    function handleFormulaDrawerClick(event) {
        const helpTrigger = event.target.closest('.formula-help-trigger');
        if (helpTrigger) {
            openFormulaHelp(helpTrigger);
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        const formulaLine = event.target.closest('.formula-panel span[data-formula-expr]');
        if (formulaLine) {
            startCalcFormulaFromLine(formulaLine);
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        const button = event.target.closest('.formula-section-toggle');
        if (!button) return;
        const drawer = el('mapCalculatorFormulaDrawer');
        const panel = el('mapCalculatorDevice');
        const section = button.closest('.formula-section');
        if (!section) return;
        const open = !section.classList.contains('is-open');
        closeFormulaSections(drawer);
        setFormulaSectionOpen(section, open);
        if (panel && drawer) {
            requestAnimationFrame(() => {
                placeFormulaDrawer(panel, drawer);
                if (open) scrollFormulaSectionIntoView(drawer, section);
            });
        }
        event.preventDefault();
        event.stopPropagation();
    }

    function toggleFormulaDrawer(force) {
        const panel = el('mapCalculatorDevice');
        const drawer = el('mapCalculatorFormulaDrawer');
        if (!panel || !drawer) return;
        const open = typeof force === 'boolean' ? force : !panel.classList.contains('formula-open');
        panel.classList.toggle('formula-open', open);
        drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (!open) {
            panel.classList.remove('formula-left', 'formula-under');
            closeFormulaSections(drawer);
            closeFormulaHelp();
        }
        if (open) {
            closeFormulaSections(drawer);
            drawer.scrollTop = 0;
        }
        if (open) placeFormulaDrawer(panel, drawer);
        bringToFront(panel);
        requestAnimationFrame(() => {
            clampPanel(panel);
            if (open) placeFormulaDrawer(panel, drawer);
        });
    }

    function bindButtons() {
        const startStop = el('mapStopwatchStartStop');
        const reset = el('mapStopwatchReset');
        const scale = el('mapStopwatchScale');
        const timerDisplay = el('mapStopwatchTimerDisplay');
        const timerPicker = el('mapStopwatchTimerPicker');
        const timerPickerStartStop = el('mapStopwatchTimerStartStop');
        const timerPickerReset = el('mapStopwatchTimerReset');
        const timerPickerClose = el('mapStopwatchTimerClose');
        const closeStopwatch = el('mapStopwatchClose');
        const closeCalculator = el('mapCalculatorClose');
        const closeE6B = el('mapE6BClose');
        const flipE6B = el('mapE6BFlip');
        const zoomOutE6B = el('mapE6BZoomOut');
        const zoomInE6B = el('mapE6BZoomIn');
        const formulaToggle = el('mapCalculatorFormulaToggle');
        const formulaDrawer = el('mapCalculatorFormulaDrawer');
        const formulaHelpOverlay = el('mapFormulaHelpOverlay');
        const formulaHelpClose = el('mapFormulaHelpClose');
        const keypad = document.querySelector('#mapCalculatorDevice .calculator-keypad');

        if (startStop && startStop.dataset.bound !== '1') {
            startStop.addEventListener('click', toggleStopwatch);
            startStop.dataset.bound = '1';
        }
        if (reset && reset.dataset.bound !== '1') {
            reset.addEventListener('click', resetStopwatch);
            reset.dataset.bound = '1';
        }
        if (scale && scale.dataset.bound !== '1') {
            scale.addEventListener('click', toggleStopwatchScale);
            scale.dataset.bound = '1';
        }
        if (timerDisplay && timerDisplay.dataset.bound !== '1') {
            timerDisplay.addEventListener('click', handleTimerDisplayClick);
            timerDisplay.dataset.bound = '1';
        }
        if (timerPicker && timerPicker.dataset.bound !== '1') {
            timerPicker.addEventListener('click', handleTimerPickerClick);
            timerPicker.addEventListener('pointerdown', handleTimerPickerPointerDown);
            timerPicker.addEventListener('pointermove', handleTimerPickerPointerMove);
            timerPicker.addEventListener('pointerup', endTimerPickerDrag);
            timerPicker.addEventListener('pointercancel', endTimerPickerDrag);
            timerPicker.addEventListener('mousedown', handleTimerPickerMouseDown);
            timerPicker.dataset.bound = '1';
        }
        if (timerPickerStartStop && timerPickerStartStop.dataset.bound !== '1') {
            timerPickerStartStop.addEventListener('click', handleTimerPickerStartStop);
            timerPickerStartStop.dataset.bound = '1';
        }
        if (timerPickerReset && timerPickerReset.dataset.bound !== '1') {
            timerPickerReset.addEventListener('click', event => {
                resetTimerFromPicker();
                event.preventDefault();
                event.stopPropagation();
            });
            timerPickerReset.dataset.bound = '1';
        }
        if (timerPickerClose && timerPickerClose.dataset.bound !== '1') {
            timerPickerClose.addEventListener('click', event => {
                playUtilityClickSound('soft');
                setTimerPickerOpen(false);
                event.preventDefault();
                event.stopPropagation();
            });
            timerPickerClose.dataset.bound = '1';
        }
        if (closeStopwatch && closeStopwatch.dataset.bound !== '1') {
            closeStopwatch.addEventListener('click', () => {
                playUtilityClickSound('soft');
                closeMapUtilityTool('stopwatch');
            });
            closeStopwatch.dataset.bound = '1';
        }
        if (closeCalculator && closeCalculator.dataset.bound !== '1') {
            closeCalculator.addEventListener('click', () => closeMapUtilityTool('calculator'));
            closeCalculator.dataset.bound = '1';
        }
        if (closeE6B && closeE6B.dataset.bound !== '1') {
            closeE6B.addEventListener('click', () => closeMapUtilityTool('e6b'));
            closeE6B.dataset.bound = '1';
        }
        if (flipE6B && flipE6B.dataset.bound !== '1') {
            flipE6B.addEventListener('click', () => {
                bringToFront(el('mapE6BDevice'));
                toggleE6BSide();
            });
            flipE6B.dataset.bound = '1';
        }
        if (zoomOutE6B && zoomOutE6B.dataset.bound !== '1') {
            zoomOutE6B.addEventListener('click', () => {
                bringToFront(el('mapE6BDevice'));
                zoomE6BView(0.86);
            });
            zoomOutE6B.dataset.bound = '1';
        }
        if (zoomInE6B && zoomInE6B.dataset.bound !== '1') {
            zoomInE6B.addEventListener('click', () => {
                bringToFront(el('mapE6BDevice'));
                zoomE6BView(1.16);
            });
            zoomInE6B.dataset.bound = '1';
        }
        if (formulaToggle && formulaToggle.dataset.bound !== '1') {
            formulaToggle.addEventListener('click', () => toggleFormulaDrawer());
            formulaToggle.dataset.bound = '1';
        }
        if (formulaDrawer && formulaDrawer.dataset.bound !== '1') {
            formulaDrawer.addEventListener('click', handleFormulaDrawerClick);
            formulaDrawer.dataset.bound = '1';
        }
        if (formulaHelpOverlay && formulaHelpOverlay.dataset.bound !== '1') {
            formulaHelpOverlay.addEventListener('click', event => {
                if (event.target === formulaHelpOverlay) closeFormulaHelp();
            });
            formulaHelpOverlay.dataset.bound = '1';
        }
        if (formulaHelpClose && formulaHelpClose.dataset.bound !== '1') {
            formulaHelpClose.addEventListener('click', event => {
                closeFormulaHelp();
                event.preventDefault();
                event.stopPropagation();
            });
            formulaHelpClose.dataset.bound = '1';
        }
        if (keypad && keypad.dataset.bound !== '1') {
            keypad.addEventListener('click', handleCalcButton);
            keypad.dataset.bound = '1';
        }
    }

    function initMapUtilityTools() {
        bindButtons();
        bindDrag('stopwatch');
        bindDrag('calculator');
        bindDrag('e6b');
        window.addEventListener('message', handleE6BFrameMessage);
        const e6bFrame = el('mapE6BFrame');
        if (e6bFrame && e6bFrame.dataset.e6bViewBound !== '1') {
            e6bFrame.addEventListener('load', () => {
                syncE6BBaseSize(el('mapE6BDevice'));
                postE6BMessage({ type: 'ga-e6b-report-view' });
            });
            e6bFrame.dataset.e6bViewBound = '1';
        }
        let storedScale = '';
        try { storedScale = localStorage.getItem(`${STORAGE_PREFIX}stopwatch_scale`) || ''; } catch (_) {}
        applyStopwatchScale(storedScale === '50', false);
        applyE6BSize(readE6BSizeMode(), false);
        let storedTimerDuration = 0;
        try { storedTimerDuration = Number(localStorage.getItem(`${STORAGE_PREFIX}stopwatch_timer_duration`) || 0); } catch (_) {}
        if (Number.isFinite(storedTimerDuration) && storedTimerDuration >= 1000) {
            stopwatchState.timer.durationMs = clampTimerDuration(storedTimerDuration);
            stopwatchState.timer.remainingMs = stopwatchState.timer.durationMs;
            stopwatchState.timer.pickerDraftMs = stopwatchState.timer.durationMs;
        }
        updateStopwatchDisplay();
        updateClockFields();
        clearCalc();
        syncToolButtons();
        window.addEventListener('resize', () => {
            Object.keys(TOOL_IDS).forEach(tool => {
                const cfg = TOOL_IDS[tool];
                const panel = el(cfg.panel);
                if (panel && panel.style.display !== 'none') {
                    clampPanel(panel);
                    if (tool === 'e6b') {
                        syncE6BBaseSize(panel);
                        reclampE6BViewOffset();
                    }
                    savePanelPosition(cfg);
                }
            });
        });
    }

    window.openMapUtilityTool = openMapUtilityTool;
    window.closeMapUtilityTool = closeMapUtilityTool;
    window.isMapUtilityToolOpen = isMapUtilityToolOpen;
    window.toggleMapUtilityFormulaDrawer = toggleFormulaDrawer;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMapUtilityTools);
    } else {
        initMapUtilityTools();
    }
})();
