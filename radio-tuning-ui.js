/* Shared App/EFB frequency controls; explicit markup only. */
(function() {
    const core = window.GARadioTuningCore;
    if (!core) return;
    const modes = ['off', 'direct', 'select'];
    let mode = 'off', dialog = null, source = null, busy = false;
    try { const saved = localStorage.getItem('ga-navcom-mode-v1'); if (modes.indexOf(saved) >= 0) mode = saved; } catch (_) {}
    const labels = {off:'AUS', direct:'Gerät 1 aktiv', select:'Auswahl'};
    function each(nodes, fn) { Array.prototype.forEach.call(nodes, fn); }
    const nativeEfb = document.body && document.body.classList.contains('ga-efb-tracker-host');
    function radioNode(target) {
        while (target && target !== document) {
            if (target.nodeType === 1 && target.classList.contains('ga-radio-value')) return target;
            target = target.parentNode;
        }
        return null;
    }
    function bindNativeInput(node) {
        if (!nativeEfb || node._gaRadioInputBound) return;
        node._gaRadioInputBound = true;
        // Coherent controls also need a handler on the actual DOM element.
        node.onclick = function(event) { activate(event, node); };
        ['pointerdown','mousedown','touchstart','pointerup','mouseup','touchend'].forEach(type => {
            node.addEventListener(type, function(event) {
                // Keep draggable windows and dismissible banners from consuming
                // the gesture; do not cancel native click synthesis.
                if (mode !== 'off') event.stopPropagation();
            });
        });
    }
    function refresh() {
        document.body.setAttribute('data-navcom-mode', mode);
        const button = document.getElementById('navcomModeBtn');
        if (button && button.textContent !== 'NAVCOM: ' + labels[mode]) button.textContent = 'NAVCOM: ' + labels[mode];
        each(document.querySelectorAll('.ga-radio-value'), node => {
            bindNativeInput(node);
            node.tabIndex = mode === 'off' ? -1 : 0;
            node.setAttribute('aria-disabled', mode === 'off' ? 'true' : 'false');
        });
    }
    function close() {
        if (dialog) dialog.remove();
        dialog = null;
        if (source && source.isConnected) source.focus();
        source = null;
    }
    function notify(message) {
        if (typeof window.showMapToast === 'function') { window.showMapToast(message, 4500); return; }
        let toast = document.getElementById('gaRadioStatus');
        if (!toast) { toast = document.createElement('div'); toast.id = 'gaRadioStatus'; toast.className = 'ga-radio-status'; toast.setAttribute('role', 'status'); document.body.appendChild(toast); }
        toast.textContent = message;
        toast.hidden = false;
        clearTimeout(notify.timer); notify.timer = setTimeout(() => { toast.hidden = true; }, 5000);
    }
    const errors = {
        simulator_not_connected:'Simulator nicht verbunden.', tracker_not_connected:'Tracker nicht verbunden.',
        radio_unavailable:'Der verbundene Tracker unterstützt NAVCOM noch nicht.', cockpit_tool_not_allowed:'Der verbundene Tracker unterstützt NAVCOM noch nicht.',
        radio_not_confirmed:'Übernahme nicht bestätigt. Bitte das Gerät im Cockpit prüfen.', radio_readback_timeout:'Keine Bestätigung vom Simulator. Bitte das Gerät im Cockpit prüfen.',
        authority_timeout:'Keine Tracker-Bestätigung. Bitte das Gerät im Cockpit prüfen.', radio_busy:'Eine Übernahme läuft bereits.',
        radio_frequency_invalid:'Diese Frequenz kann nicht eingestellt werden.', squawk_invalid:'Ungültiger Squawk-Code.'
    };
    async function send(spec, index, slot) {
        if (busy) return;
        busy = true;
        if (dialog) each(dialog.querySelectorAll('button'), b => { b.disabled = true; });
        try {
            const payload = {kind:spec.kind,value:spec.value,index,slot};
            core.normalize(payload);
            if (typeof window.gaRadioTune !== 'function') throw new Error('radio_unavailable');
            const result = await window.gaRadioTune(payload);
            if (!result || !result.ok || !result.confirmed) throw new Error(result && result.error || 'radio_not_confirmed');
            const target = result.target;
            close();
            notify(target.kind === 'XPDR' ? 'Transponder: ' + target.value : target.kind + target.index + ' ' + (target.slot === 'active' ? 'aktiv' : 'Standby') + ': ' + target.value + (target.kind === 'ADF' ? ' kHz' : ' MHz'));
        } catch (error) { notify(errors[error.message] || 'Übernahme nicht bestätigt. Bitte Verbindung und Cockpitgerät prüfen.'); }
        finally { busy = false; if (dialog) each(dialog.querySelectorAll('button'), b => { b.disabled = false; }); }
    }
    function open(node, spec) {
        close(); source = node;
        dialog = document.createElement('div'); dialog.className = 'ga-radio-dialog'; dialog.setAttribute('role','dialog'); dialog.setAttribute('aria-modal','false'); dialog.setAttribute('aria-label','Frequenz übernehmen');
        dialog.innerHTML = '<div class="ga-radio-heading"><b>' + core.escape(spec.value) + (spec.kind === 'XPDR' ? '' : spec.kind === 'ADF' ? ' kHz' : ' MHz') + '</b><button type="button" class="pb-btn ga-radio-close" aria-label="Schließen">✕</button></div><div class="ga-radio-choices"></div><button type="button" class="pb-btn ga-radio-back">Zurück</button>';
        document.body.appendChild(dialog);
        const rect = node.getBoundingClientRect();
        // The native EFB scales the whole body. Convert screen coordinates back
        // to that containing block instead of scaling the position a second time.
        const scale = dialog.getBoundingClientRect().width / dialog.offsetWidth || 1;
        const transformedBody = window.getComputedStyle(document.body).transform !== 'none';
        const origin = transformedBody ? document.body.getBoundingClientRect() : {left:0,top:0};
        const width = window.innerWidth / scale, height = window.innerHeight / scale;
        dialog.style.width = Math.min(240, width - 16) + 'px';
        dialog.style.maxHeight = Math.max(80, height - 16) + 'px';
        dialog.style.overflowY = 'auto';
        dialog.style.left = Math.max(8, Math.min((rect.left - origin.left) / scale, width - dialog.offsetWidth - 8)) + 'px';
        const choices = dialog.querySelector('.ga-radio-choices');
        const back = dialog.querySelector('.ga-radio-back');
        dialog.querySelector('.ga-radio-close').onclick = close;
        const heading = dialog.querySelector('.ga-radio-heading b');
        const headingText = heading.textContent;
        function deviceStep() {
            heading.textContent = headingText;
            back.style.visibility = 'hidden';
            choices.innerHTML = '<button type="button" class="pb-btn">' + (spec.kind === 'XPDR' ? 'Transponder' : spec.kind + '1') + '</button><button type="button" class="pb-btn">' + (spec.kind === 'XPDR' ? '' : spec.kind + '2') + '</button>';
            const buttons = choices.querySelectorAll('button');
            buttons[1].style.visibility = spec.kind === 'XPDR' ? 'hidden' : 'visible';
            each(buttons, (button, i) => { button.onclick = () => slotStep(i + 1); });
            buttons[0].focus();
        }
        function slotStep(index) {
            heading.textContent = (spec.kind === 'XPDR' ? 'XPDR' : spec.kind + index) + ' · ' + headingText;
            back.style.visibility = 'visible'; back.onclick = deviceStep;
            choices.innerHTML = '<button type="button" class="pb-btn">' + (spec.kind === 'XPDR' ? 'Code setzen' : 'Aktiv') + '</button><button type="button" class="pb-btn">Standby</button>';
            const buttons = choices.querySelectorAll('button');
            buttons[1].style.visibility = spec.kind === 'XPDR' ? 'hidden' : 'visible';
            buttons[0].onclick = () => send(spec,index,'active');
            buttons[1].onclick = () => send(spec,index,'standby');
            buttons[0].focus();
        }
        deviceStep();
        dialog.style.top = Math.max(8, Math.min((rect.bottom - origin.top) / scale + 6, height - dialog.offsetHeight - 8)) + 'px';
    }
    function activate(event, boundNode) {
        const node = boundNode || radioNode(event.target);
        if (!node || mode === 'off') return;
        if (event.preventDefault) event.preventDefault();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        else if (event.stopPropagation) event.stopPropagation();
        if (busy) return;
        const spec = {kind:node.dataset.radioKind,value:node.dataset.radioValue};
        if (mode === 'direct') send(spec,1,'active'); else open(node,spec);
    }
    window.gaCycleNavcomMode = function() {
        mode = modes[(modes.indexOf(mode) + 1) % modes.length];
        try { localStorage.setItem('ga-navcom-mode-v1',mode); } catch (_) {}
        close(); refresh();
    };
    function install() {
        refresh();
        document.addEventListener('click', function(event) {
            if (radioNode(event.target) && mode !== 'off') {
                activate(event);
                return;
            }
            if (dialog && !busy && !dialog.contains(event.target)) close();
        }, true);
        ['pointerdown','mousedown','touchstart'].forEach(type => document.addEventListener(type,function(event) {
            if (!nativeEfb && mode !== 'off' && radioNode(event.target)) event.stopImmediatePropagation();
        },true));
        // Capture release events before the frequency banner's dismiss listener.
        ['pointerup','touchend'].forEach(type => document.addEventListener(type,function(event) {
            if (!nativeEfb && mode !== 'off' && radioNode(event.target)) event.stopImmediatePropagation();
        },true));
        document.addEventListener('keydown',function(event) {
            if (event.key === 'Escape' && dialog && !busy) { event.preventDefault(); close(); }
            else if (event.key === 'Enter' || event.key === ' ') activate(event);
        },true);
        let observed = false;
        try {
            if (typeof window.MutationObserver === 'function') {
                new window.MutationObserver(refresh).observe(document.body,{childList:true,subtree:true});
                observed = true;
            }
        } catch (_) {}
        // Dynamic airport/telemetry fields must remain usable on hosts without
        // MutationObserver. Installing input never depends on this optional API.
        if (!observed) setInterval(refresh, 500);
        if (typeof window.__gaEfbReport === 'function') {
            window.__gaEfbReport('info','navcom-ready','radio-tuning-ui',mode,{nativeInput:nativeEfb,observer:observed});
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',install); else install();
})();
