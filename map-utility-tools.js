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
    const TIMER_MIN_MS = 1000;
    const TIMER_MAX_SECONDS = 99 * 60 + 59;
    const TIMER_MAX_MS = TIMER_MAX_SECONDS * 1000;
    const TIMER_DIGIT_MAX = [9, 9, 5, 9];
    const TIMER_DIGIT_DRAG_STEP_PX = 14;

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
        storedValue: null,
        operator: null,
        waitingForOperand: false,
        justEvaluated: false
    };

    let dragState = null;
    let timerDigitDragState = null;

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
        if (tool === 'stopwatch') setTimerPickerOpen(false);
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
            panel.style.left = `${dragState.left + dx}px`;
            panel.style.top = `${dragState.top + dy}px`;
            clampPanel(panel);
            event.preventDefault();
        });
        const endDrag = event => {
            if (!dragState || dragState.tool !== tool || dragState.pointerId !== event.pointerId) return;
            const tapAction = !dragState.moved ? dragState.tapAction : '';
            panel.classList.remove('is-dragging');
            if (handle.releasePointerCapture && handle.hasPointerCapture && handle.hasPointerCapture(event.pointerId)) {
                handle.releasePointerCapture(event.pointerId);
            }
            if (dragState.moved) savePanelPosition(cfg);
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
        const scale = el('mapStopwatchScale');
        const timerDisplay = el('mapStopwatchTimerDisplay');
        const timerPicker = el('mapStopwatchTimerPicker');
        const timerPickerStartStop = el('mapStopwatchTimerStartStop');
        const timerPickerReset = el('mapStopwatchTimerReset');
        const timerPickerClose = el('mapStopwatchTimerClose');
        const closeStopwatch = el('mapStopwatchClose');
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
        let storedScale = '';
        try { storedScale = localStorage.getItem(`${STORAGE_PREFIX}stopwatch_scale`) || ''; } catch (_) {}
        applyStopwatchScale(storedScale === '50', false);
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
