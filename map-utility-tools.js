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
        }
    };

    const stopwatchState = {
        running: false,
        elapsedMs: 0,
        startedAt: 0,
        mode: 'analog',
        frame: 0,
        clockTimer: 0
    };

    const calcState = {
        display: '0',
        storedValue: null,
        operator: null,
        waitingForOperand: false,
        justEvaluated: false
    };

    let dragState = null;

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
        const fallback = cfg.panel === 'mapStopwatchDevice'
            ? { left: Math.max(72, Math.round(window.innerWidth * 0.18)), top: 76 }
            : { left: Math.max(104, Math.round(window.innerWidth * 0.52)), top: 86 };
        panel.style.left = `${fallback.left}px`;
        panel.style.top = `${fallback.top}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        clampPanel(panel);
    }

    function openMapUtilityTool(tool) {
        const cfg = getToolConfig(tool);
        if (!cfg) return;
        const panel = el(cfg.panel);
        if (!panel) return;
        const isOpen = panel.style.display !== 'none';
        if (!isOpen) {
            panel.style.display = 'block';
            panel.setAttribute('aria-hidden', 'false');
            restorePanelPosition(cfg);
            if (tool === 'stopwatch') startClockTimer();
        }
        bringToFront(panel);
        syncToolButtons();
    }

    function closeMapUtilityTool(tool) {
        const cfg = getToolConfig(tool);
        if (!cfg) return;
        const panel = el(cfg.panel);
        if (!panel) return;
        savePanelPosition(cfg);
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

    function bindDrag(tool) {
        const cfg = getToolConfig(tool);
        const panel = cfg ? el(cfg.panel) : null;
        const handle = cfg ? el(cfg.handle) : null;
        if (!cfg || !panel || !handle || handle.dataset.utilityDragBound === '1') return;
        handle.addEventListener('pointerdown', event => {
            if (event.button !== undefined && event.button !== 0) return;
            if (event.target && event.target.closest('button, input, select, textarea')) return;
            const rect = panel.getBoundingClientRect();
            panel.style.left = `${rect.left}px`;
            panel.style.top = `${rect.top}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
            dragState = {
                tool,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                left: rect.left,
                top: rect.top
            };
            panel.classList.add('is-dragging');
            bringToFront(panel);
            if (handle.setPointerCapture) handle.setPointerCapture(event.pointerId);
            event.preventDefault();
            event.stopPropagation();
        });
        handle.addEventListener('pointermove', event => {
            if (!dragState || dragState.tool !== tool || dragState.pointerId !== event.pointerId) return;
            panel.style.left = `${dragState.left + event.clientX - dragState.startX}px`;
            panel.style.top = `${dragState.top + event.clientY - dragState.startY}px`;
            clampPanel(panel);
            event.preventDefault();
        });
        const endDrag = event => {
            if (!dragState || dragState.tool !== tool || dragState.pointerId !== event.pointerId) return;
            panel.classList.remove('is-dragging');
            if (handle.releasePointerCapture && handle.hasPointerCapture && handle.hasPointerCapture(event.pointerId)) {
                handle.releasePointerCapture(event.pointerId);
            }
            savePanelPosition(cfg);
            dragState = null;
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

    function updateStopwatchDisplay() {
        const ms = getStopwatchElapsedMs();
        const elapsed = el('mapStopwatchElapsed');
        const secondHand = el('mapStopwatchSecondHand');
        const tenthHand = el('mapStopwatchTenthHand');
        const minuteHand = el('mapStopwatchMinuteHand');
        const subMinutes = el('mapStopwatchSubMinutes');
        if (elapsed) elapsed.textContent = formatElapsed(ms);
        if (secondHand) secondHand.style.transform = `rotate(${(ms / 1000 % 60) * 6}deg)`;
        if (tenthHand) tenthHand.style.transform = `rotate(${(ms / 100 % 10) * 36}deg)`;
        if (minuteHand) minuteHand.style.transform = `rotate(${(ms / 60000 % 60) * 6}deg)`;
        if (subMinutes) subMinutes.textContent = String(Math.floor(ms / 60000) % 100).padStart(2, '0');
        const startStop = el('mapStopwatchStartStop');
        if (startStop) startStop.textContent = stopwatchState.running ? 'STOP' : 'START';
        if (stopwatchState.running) {
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
        if (stopwatchState.running) {
            stopwatchState.elapsedMs = getStopwatchElapsedMs();
            stopwatchState.running = false;
            if (stopwatchState.frame) cancelAnimationFrame(stopwatchState.frame);
            stopwatchState.frame = 0;
        } else {
            stopwatchState.startedAt = performance.now();
            stopwatchState.running = true;
            stopwatchState.frame = requestAnimationFrame(updateStopwatchDisplay);
        }
        updateStopwatchDisplay();
    }

    function resetStopwatch() {
        stopwatchState.elapsedMs = 0;
        stopwatchState.startedAt = performance.now();
        updateStopwatchDisplay();
    }

    function setStopwatchMode(mode) {
        stopwatchState.mode = mode === 'digital' ? 'digital' : 'analog';
        const panel = el('mapStopwatchDevice');
        const analog = el('mapStopwatchModeAnalog');
        const digital = el('mapStopwatchModeDigital');
        if (panel) panel.classList.toggle('is-digital-mode', stopwatchState.mode === 'digital');
        if (analog) analog.classList.toggle('active', stopwatchState.mode === 'analog');
        if (digital) digital.classList.toggle('active', stopwatchState.mode === 'digital');
    }

    function setCalcDisplay(value) {
        calcState.display = String(value || '0');
        if (calcState.display === '-0') calcState.display = '0';
        const display = el('mapCalculatorDisplay');
        if (display) display.textContent = calcState.display;
    }

    function currentCalcValue() {
        const value = Number(calcState.display);
        return Number.isFinite(value) ? value : 0;
    }

    function formatCalcNumber(value) {
        if (!Number.isFinite(value)) return 'ERR';
        const rounded = Math.abs(value) >= 1000000000 || (Math.abs(value) > 0 && Math.abs(value) < 0.000001)
            ? value.toExponential(6)
            : String(Math.round(value * 1000000000) / 1000000000);
        return rounded.length > 12 ? Number(value).toPrecision(7) : rounded;
    }

    function computeCalc(left, operator, right) {
        if (operator === '+') return left + right;
        if (operator === '-') return left - right;
        if (operator === '*') return left * right;
        if (operator === '/') return right === 0 ? NaN : left / right;
        return right;
    }

    function inputDigit(value) {
        if (calcState.waitingForOperand || calcState.justEvaluated || calcState.display === 'ERR') {
            calcState.waitingForOperand = false;
            calcState.justEvaluated = false;
            setCalcDisplay(value);
            return;
        }
        if (calcState.display.replace('-', '').replace('.', '').length >= 10) return;
        setCalcDisplay(calcState.display === '0' ? value : calcState.display + value);
    }

    function inputDecimal() {
        if (calcState.waitingForOperand || calcState.justEvaluated || calcState.display === 'ERR') {
            calcState.waitingForOperand = false;
            calcState.justEvaluated = false;
            setCalcDisplay('0.');
            return;
        }
        if (!calcState.display.includes('.')) setCalcDisplay(`${calcState.display}.`);
    }

    function applyOperator(operator) {
        const value = currentCalcValue();
        if (calcState.operator && !calcState.waitingForOperand) {
            const result = computeCalc(Number(calcState.storedValue || 0), calcState.operator, value);
            calcState.storedValue = result;
            setCalcDisplay(formatCalcNumber(result));
        } else {
            calcState.storedValue = value;
        }
        calcState.operator = operator;
        calcState.waitingForOperand = true;
        calcState.justEvaluated = false;
    }

    function evaluateCalc() {
        if (!calcState.operator || calcState.storedValue === null) return;
        const result = computeCalc(Number(calcState.storedValue), calcState.operator, currentCalcValue());
        setCalcDisplay(formatCalcNumber(result));
        calcState.storedValue = null;
        calcState.operator = null;
        calcState.waitingForOperand = true;
        calcState.justEvaluated = true;
    }

    function clearCalc() {
        calcState.storedValue = null;
        calcState.operator = null;
        calcState.waitingForOperand = false;
        calcState.justEvaluated = false;
        setCalcDisplay('0');
    }

    function backspaceCalc() {
        if (calcState.waitingForOperand || calcState.justEvaluated || calcState.display === 'ERR') {
            clearCalc();
            return;
        }
        const next = calcState.display.length > 1 ? calcState.display.slice(0, -1) : '0';
        setCalcDisplay(next === '-' ? '0' : next);
    }

    function toggleCalcSign() {
        if (calcState.display === '0' || calcState.display === 'ERR') return;
        setCalcDisplay(calcState.display.startsWith('-') ? calcState.display.slice(1) : `-${calcState.display}`);
    }

    function percentCalc() {
        setCalcDisplay(formatCalcNumber(currentCalcValue() / 100));
    }

    function handleCalcButton(event) {
        const button = event.target.closest('[data-calc]');
        if (!button) return;
        const action = button.dataset.calc;
        if (action === 'digit') inputDigit(button.dataset.value || '0');
        else if (action === 'decimal') inputDecimal();
        else if (action === 'operator') applyOperator(button.dataset.op || '+');
        else if (action === 'equals') evaluateCalc();
        else if (action === 'clear') clearCalc();
        else if (action === 'backspace') backspaceCalc();
        else if (action === 'sign') toggleCalcSign();
        else if (action === 'percent') percentCalc();
        event.preventDefault();
    }

    function toggleFormulaDrawer(force) {
        const panel = el('mapCalculatorDevice');
        const drawer = el('mapCalculatorFormulaDrawer');
        if (!panel || !drawer) return;
        const open = typeof force === 'boolean' ? force : !panel.classList.contains('formula-open');
        panel.classList.toggle('formula-open', open);
        drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
        bringToFront(panel);
        requestAnimationFrame(() => clampPanel(panel));
    }

    function bindButtons() {
        const startStop = el('mapStopwatchStartStop');
        const reset = el('mapStopwatchReset');
        const closeStopwatch = el('mapStopwatchClose');
        const analog = el('mapStopwatchModeAnalog');
        const digital = el('mapStopwatchModeDigital');
        const closeCalculator = el('mapCalculatorClose');
        const formulaToggle = el('mapCalculatorFormulaToggle');
        const keypad = document.querySelector('#mapCalculatorDevice .calculator-keypad');

        if (startStop && startStop.dataset.bound !== '1') {
            startStop.addEventListener('click', toggleStopwatch);
            startStop.dataset.bound = '1';
        }
        if (reset && reset.dataset.bound !== '1') {
            reset.addEventListener('click', resetStopwatch);
            reset.dataset.bound = '1';
        }
        if (closeStopwatch && closeStopwatch.dataset.bound !== '1') {
            closeStopwatch.addEventListener('click', () => closeMapUtilityTool('stopwatch'));
            closeStopwatch.dataset.bound = '1';
        }
        if (analog && analog.dataset.bound !== '1') {
            analog.addEventListener('click', () => setStopwatchMode('analog'));
            analog.dataset.bound = '1';
        }
        if (digital && digital.dataset.bound !== '1') {
            digital.addEventListener('click', () => setStopwatchMode('digital'));
            digital.dataset.bound = '1';
        }
        if (closeCalculator && closeCalculator.dataset.bound !== '1') {
            closeCalculator.addEventListener('click', () => closeMapUtilityTool('calculator'));
            closeCalculator.dataset.bound = '1';
        }
        if (formulaToggle && formulaToggle.dataset.bound !== '1') {
            formulaToggle.addEventListener('click', () => toggleFormulaDrawer());
            formulaToggle.dataset.bound = '1';
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
        setStopwatchMode('analog');
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
