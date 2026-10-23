/* Analog-Designs: Klassik und Tower (Schreibtisch der Flugleitung).
   Wie bei NavCom: Für den Tower entsteht eigenes Markup, die echten Felder
   (Start/Ziel mit Flughafen- und Favoritenliste, Auftrag mit Mission-Picker und
   RDM/PICK, Sitze, Platztypen, Flugzeug-Presets) werden hineingehängt und beim
   Wechsel zurück exakt an ihren Platz gelegt. Schieberegler, Richtung, Distanz und
   die Aktionstasten bleiben unsichtbar an ihrem Platz und werden angesteuert.
   Schraube oben rechts: Design wechseln (Analog und NavCom). */
(function () {
    'use strict';

    var SKIN_KEY = 'ga_analog_skin';
    var SKINS = ['classic', 'tower', 'telex'];
    var SKIN_LABEL = { classic: 'Analog Klassik', tower: 'Analog Tower', telex: 'Analog Fernschreiber' };

    function read(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
    function write(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
    function $(id) { return document.getElementById(id); }
    function pad(n) { return String(n).padStart(2, '0'); }

    function currentSkin() {
        var saved = read(SKIN_KEY);
        return SKINS.indexOf(saved) >= 0 ? saved : 'classic';
    }
    function isAnalogTheme() {
        var b = document.body;
        return !!(b && b.classList.contains('theme-retro') && !b.classList.contains('theme-navcom'));
    }

    /* ------------------------------------------------------------------
       Markup
       ------------------------------------------------------------------ */
    function numField(range, label, padTo) {
        return '<div class="tw-f tw-num" data-range="' + range + '"' + (padTo ? ' data-pad="' + padTo + '"' : '') +
            ' tabindex="0" role="slider" aria-label="' + label + '"><span class="tw-k">' + label + '</span><span class="tw-v"></span></div>';
    }
    var DESK =
        '<div class="tw-desk" id="towerDesk">' +
        '<div class="tw-coffee" aria-hidden="true"></div>' +
        '<div class="tw-nameplate">FLUGLEITUNG <span data-tw="place">----</span></div>' +
        '<div class="tw-cards preset-row" data-slot="cards" role="group" aria-label="Flugzeug wählen"></div>' +
        '<section class="tw-clipboard" aria-label="Flugauftrag">' +
        '<div class="tw-clip" aria-hidden="true"></div>' +
        '<div class="tw-sheet">' +
        '<div class="tw-letterhead"><h2>FLUGAUFTRAG</h2><div class="tw-org">Flugleitung <span data-tw="place">----</span><br><span data-tw="date"></span></div></div>' +
        '<div class="tw-form">' +
        '<div class="tw-f tw-slot" data-slot="start"></div>' +
        '<div class="tw-f tw-slot" data-slot="dest"></div>' +
        '<div class="tw-f tw-slot tw-span2 tw-typ" data-slot="type"></div>' +
        numField('altSlider', 'Reiseflughöhe ft') +
        numField('tasSlider', 'TAS kt') +
        numField('rateSlider', 'Steigrate ft/min') +
        numField('gphSlider', 'Verbrauch GPH', 2) +
        '<div class="tw-f tw-slot" data-slot="seats"></div>' +
        '<div class="tw-f tw-slot" data-slot="apt"></div>' +
        '</div>' +
        '<div class="tw-cleared" aria-hidden="true">FREIGEGEBEN<small data-tw="clearedTime"></small></div>' +
        '</div>' +
        '<div class="tw-pencil" aria-hidden="true"></div>' +
        '</section>' +
        '<div class="tw-lower">' +
        '<section class="tw-chart" aria-label="Richtung und Distanz">' +
        '<div class="tw-chart-title"><span>Richtung · Distanz</span><span>NM</span></div>' +
        '<svg class="tw-map" viewBox="0 0 240 200" role="img" aria-label="Kartenausschnitt mit Entfernungsringen; tippen wählt Richtung und Distanz">' +
        '<defs><pattern id="twHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="6" stroke="#33363b" stroke-width="1.2" opacity=".55"/></pattern></defs>' +
        '<rect width="240" height="200" fill="#eef0de"/>' +
        '<path d="M0 40 Q40 30 70 48 T140 40 T240 52 V0 H0 Z" fill="#dfe8c6"/>' +
        '<path d="M150 200 Q170 160 210 150 T240 120 V200 Z" fill="#cfe0b4"/>' +
        '<path d="M0 150 Q30 140 50 160 T80 200 H0 Z" fill="#cfe0b4"/>' +
        '<path d="M-5 120 C40 110 70 135 110 128 S180 90 245 100" fill="none" stroke="#a9c8e0" stroke-width="4"/>' +
        '<g fill="none" stroke="#b9a77d" stroke-width=".7" opacity=".7"><path d="M10 30 Q60 18 110 32 T230 28"/><path d="M20 20 Q70 8 120 22 T235 16"/><path d="M160 190 Q190 160 235 150"/><path d="M175 196 Q200 172 238 165"/></g>' +
        '<g fill="#8a8f7a" opacity=".55"><circle cx="40" cy="80" r="2"/><circle cx="190" cy="70" r="2.4"/><circle cx="150" cy="160" r="2"/><circle cx="60" cy="170" r="1.8"/></g>' +
        '<path class="tw-sector" d="" fill="url(#twHatch)"/>' +
        '<g fill="none" stroke="#33363b" stroke-dasharray="3 3" stroke-width="1" opacity=".65"><circle cx="120" cy="100" r="34"/><circle cx="120" cy="100" r="60"/><circle cx="120" cy="100" r="88"/></g>' +
        '<circle class="tw-ring" cx="120" cy="100" r="0" fill="none" stroke="#33363b" stroke-width="2.6" opacity=".85"/>' +
        '<g font-family="Courier New, monospace" font-size="8" fill="#4c4a44" text-anchor="middle"><text x="120" y="63">50</text><text x="120" y="37">100</text><text x="120" y="9">250</text></g>' +
        '<g font-family="Caveat, cursive" font-size="17" font-weight="700" fill="#33363b" text-anchor="middle"><text x="120" y="196">S</text><text x="232" y="106">O</text><text x="9" y="106">W</text></g>' +
        '<path d="M120 2 l4 9 h-8 z" fill="#33363b"/>' +
        '<circle cx="120" cy="100" r="8" fill="none" stroke="#c2261d" stroke-width="2"/>' +
        '<line x1="114" y1="104" x2="126" y2="96" stroke="#c2261d" stroke-width="2.4"/>' +
        '<text x="133" y="114" font-family="Courier New, monospace" font-size="8" font-weight="700" fill="#c2261d" data-tw="place">----</text>' +
        '</svg>' +
        '<div class="tw-chips"><button type="button" class="tw-chip" data-reset="dir"><span>Richtung</span><b data-tw="dir">egal</b></button>' +
        '<button type="button" class="tw-chip" data-reset="dist"><span>Distanz</span><b data-tw="dist">egal</b></button></div>' +
        '</section>' +
        '<section class="tw-radio" aria-label="Handfunkgerät">' +
        '<div class="tw-rbody">' +
        '<span class="tw-txled" aria-hidden="true"></span>' +
        '<button type="button" class="tw-ptt" data-act="dispatch" aria-label="PTT: Auftrag erteilen" title="PTT: Auftrag erteilen"></button>' +
        '<div class="tw-lcd" aria-live="polite">' +
        '<div class="tw-row"><span data-tw="place">----</span><span class="tw-bars"><i></i><i></i><i></i><i></i></span></div>' +
        '<div class="tw-row tw-big"><span data-tw="lcd">BEREIT</span></div>' +
        '<div class="tw-row"><span data-tw="utc">--:--Z</span><span class="tw-txflag">TX</span></div>' +
        '</div>' +
        '<button type="button" class="tw-rkey tw-k1" data-act="transfer" title="Transfer Hub (Import/Export)">MEM</button>' +
        '<button type="button" class="tw-rkey tw-k2" data-act="reset" title="Briefing verwerfen &amp; Reset">CLR</button>' +
        '<button type="button" class="tw-rkey tw-k3" data-act="dispatch" title="Auftrag generieren">TX</button>' +
        '</div>' +
        '<div class="tw-ptt-hint">PTT = Auftrag</div>' +
        '</section>' +
        '</div>' +
        '</div>';

    /* ------------------------------------------------------------------
       Aufbau / Rückbau
       ------------------------------------------------------------------ */
    var built = null; // null | 'tower' | 'telex'
    var moved = [];
    var desk = null;

    function adopt(el, slot) {
        if (!el || !slot || !el.parentNode) return;
        var ph = document.createComment('analog-skin-slot');
        el.parentNode.insertBefore(ph, el);
        moved.push([el, ph]);
        slot.appendChild(el);
    }
    function slot(name) { return desk && desk.querySelector('[data-slot="' + name + '"]'); }

    function teardown() {
        var host = $('classicInputs');
        for (var i = moved.length - 1; i >= 0; i--) {
            var el = moved[i][0], ph = moved[i][1];
            if (ph.parentNode) { ph.parentNode.insertBefore(el, ph); ph.parentNode.removeChild(ph); }
            if (el.removeAttribute) el.removeAttribute('data-tw-sub');
        }
        moved = [];
        if (desk) desk.remove();
        desk = null;
        if (host) host.classList.remove('tw-on', 'tx-on');
        built = null;
        lastNum = {};
        telexReset();
    }

    function buildTower() {
        var host = $('classicInputs');
        if (!host) return;
        var anchor = host.querySelector(':scope > .ops-route-fields');
        if (!anchor) return;
        var tpl = document.createElement('template');
        tpl.innerHTML = DESK;
        desk = tpl.content.firstElementChild;
        host.insertBefore(desk, anchor);

        Array.prototype.forEach.call(host.querySelectorAll('.preset-row .btn-preset'), function (btn) {
            if (!desk.contains(btn)) adopt(btn, slot('cards'));
        });
        adopt($('startLoc') && $('startLoc').parentElement, slot('start'));
        adopt($('destLoc') && $('destLoc').parentElement, slot('dest'));
        adopt($('targetTypeLabel') && $('targetTypeLabel').parentElement, slot('type'));
        adopt($('maxSeats') && $('maxSeats').parentElement, slot('seats'));
        adopt($('airportTypeFilterButton') && $('airportTypeFilterButton').parentElement, slot('apt'));

        host.classList.add('tw-on');
        built = 'tower';
        bindDesk();
        sync(true);
    }

    function apply() {
        var want = isAnalogTheme() ? currentSkin() : 'classic';
        if (want === 'classic') want = null;
        if (want !== built) {
            if (built) teardown();
            if (want === 'tower') buildTower();
            else if (want === 'telex') buildTelex();
        }
        if (document.body) {
            document.body.classList.toggle('analog-skin-tower', built === 'tower');
            document.body.classList.toggle('analog-skin-telex', built === 'telex');
        }
    }

    /* ------------------------------------------------------------------
       Bedienung
       ------------------------------------------------------------------ */
    function setSelect(id, value) {
        var sel = $(id);
        if (!sel || sel.value === value) return;
        sel.value = value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function stepRange(id, dir) {
        var r = $(id);
        if (!r) return;
        var step = parseFloat(r.step) || 1, min = parseFloat(r.min), max = parseFloat(r.max);
        var v = Math.min(max, Math.max(min, (parseFloat(r.value) || 0) + dir * step));
        if (String(v) === r.value) return;
        r.value = String(v);
        r.dispatchEvent(new Event('input', { bubbles: true }));
        r.dispatchEvent(new Event('change', { bubbles: true }));
        unstamp();
        sync();
    }

    var RINGS = [0, 34, 60, 88];
    var DIST_VALUES = ['any', 'short', 'medium', 'long'];
    var DIST_LABEL = { any: 'egal', short: '10–50 NM', medium: '50–100 NM', long: '100–250 NM' };
    var DIR_LABEL = { any: 'egal', N: 'Norden', E: 'Osten', S: 'Süden', W: 'Westen' };
    var WEDGE = { N: [-45, 45], E: [45, 135], S: [135, 225], W: [225, 315] };
    function arc(a0, a1, r) {
        var p = function (a) { return [120 + Math.sin(a * Math.PI / 180) * r, 100 - Math.cos(a * Math.PI / 180) * r]; };
        var s = p(a0), e = p(a1);
        return 'M120 100 L' + s[0].toFixed(1) + ' ' + s[1].toFixed(1) + ' A' + r + ' ' + r + ' 0 0 1 ' + e[0].toFixed(1) + ' ' + e[1].toFixed(1) + ' Z';
    }

    function act(name) {
        if (name === 'dispatch') { var g = $('generateBtn'); if (g) g.click(); }
        else if (name === 'transfer') { var t = $('importHubBtn'); if (t) t.click(); }
        else if (name === 'reset') { var r = document.querySelector('#classicActionBar .emergency-reset'); if (r) r.click(); unstamp(); }
        setTimeout(sync, 60);
    }

    function bindDesk() {
        // Zahlenfelder: seitlich wischen, rechte/linke Hälfte antippen, Mausrad, Pfeiltasten
        Array.prototype.forEach.call(desk.querySelectorAll('.tw-num'), function (cell) {
            var id = cell.dataset.range, x0 = 0, acc = 0, moved = false, down = false;
            cell.addEventListener('pointerdown', function (e) { down = true; moved = false; acc = 0; x0 = e.clientX; try { cell.setPointerCapture(e.pointerId); } catch (_) {} });
            cell.addEventListener('pointermove', function (e) {
                if (!down) return;
                var dx = e.clientX - x0; x0 = e.clientX; acc += dx;
                if (Math.abs(acc) > 3) moved = true;
                while (Math.abs(acc) >= 16) { var s = acc > 0 ? 1 : -1; acc -= s * 16; stepRange(id, s); }
            });
            cell.addEventListener('pointercancel', function () { down = false; moved = true; });
            cell.addEventListener('pointerup', function (e) {
                if (!down) return;
                down = false;
                if (moved) return;
                var r = cell.getBoundingClientRect();
                stepRange(id, (e.clientX - r.left) > r.width / 2 ? 1 : -1);
            });
            cell.addEventListener('wheel', function (e) { e.preventDefault(); stepRange(id, e.deltaY < 0 ? 1 : -1); }, { passive: false });
            cell.addEventListener('keydown', function (e) {
                if (['ArrowRight', 'ArrowUp', '+'].indexOf(e.key) >= 0) { e.preventDefault(); stepRange(id, 1); }
                if (['ArrowLeft', 'ArrowDown', '-'].indexOf(e.key) >= 0) { e.preventDefault(); stepRange(id, -1); }
            });
        });

        // Karte: Sektor = Richtung, Ring = Distanz, Mitte = Richtung egal
        var map = desk.querySelector('.tw-map');
        map.addEventListener('click', function (e) {
            var pt = map.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
            var p = pt.matrixTransform(map.getScreenCTM().inverse());
            var dx = p.x - 120, dy = p.y - 100, d = Math.hypot(dx, dy);
            if (d < 14) { setSelect('dirPref', 'any'); unstamp(); sync(); return; }
            var a = Math.atan2(dx, -dy) * 180 / Math.PI; if (a < 0) a += 360;
            setSelect('dirPref', a >= 315 || a < 45 ? 'N' : a < 135 ? 'E' : a < 225 ? 'S' : 'W');
            setSelect('distRange', d <= RINGS[1] ? 'short' : d <= RINGS[2] ? 'medium' : 'long');
            unstamp();
            sync();
        });
        Array.prototype.forEach.call(desk.querySelectorAll('.tw-chip'), function (chip) {
            chip.addEventListener('click', function () {
                if (chip.dataset.reset === 'dir') setSelect('dirPref', 'any');
                else setSelect('distRange', 'any');
                unstamp();
                sync();
            });
        });

        Array.prototype.forEach.call(desk.querySelectorAll('[data-act]'), function (b) {
            b.addEventListener('click', function () { act(b.dataset.act); });
        });

        // Jede Änderung am Plan hebt den Freigabe-Stempel auf
        desk.addEventListener('input', function (e) { if (!e.target.closest('.tw-radio')) unstamp(); });
        desk.addEventListener('change', function (e) { if (!e.target.closest('.tw-radio')) unstamp(); });
        desk.querySelector('[data-slot="cards"]').addEventListener('click', function () { unstamp(); setTimeout(sync, 60); });
        var stampBtn = $('analogProposalModeLabel');
        if (stampBtn) stampBtn.addEventListener('click', function () { unstamp(); setTimeout(sync, 60); });
    }

    /* ------------------------------------------------------------------
       Zustand spiegeln
       ------------------------------------------------------------------ */
    var lastNum = {};
    var wasWorking = false;
    var lcdHold = 0;

    function unstamp() {
        if (!desk) return;
        var c = desk.querySelector('.tw-cleared');
        if (c && c.classList.contains('on')) c.classList.remove('on');
    }
    function stamp() {
        if (!desk) return;
        var d = new Date();
        var t = pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + 'Z';
        setText('clearedTime', t);
        var c = desk.querySelector('.tw-cleared');
        c.classList.remove('on'); void c.offsetWidth; c.classList.add('on');
    }
    function setText(key, value) {
        Array.prototype.forEach.call(desk.querySelectorAll('[data-tw="' + key + '"]'), function (el) {
            if (el.textContent !== value) el.textContent = value;
        });
    }
    function placeName() {
        var v = ($('startLoc') && $('startLoc').value || '').trim().toUpperCase();
        var m = v.match(/^[A-Z0-9]{3,4}\b/);
        return m ? m[0] : (v ? v.slice(0, 4) : '----');
    }

    function sync(initial) {
        if (built === 'tower') syncTower(initial);
        else if (built === 'telex') syncTelex(initial);
    }
    function syncTower(initial) {
        if (built !== 'tower' || !desk) return;
        var d = new Date();
        setText('place', placeName());
        setText('date', pad(d.getUTCDate()) + '.' + pad(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear());
        setText('utc', pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + 'Z');

        // Zahlenfelder aus den echten Schiebereglern
        Array.prototype.forEach.call(desk.querySelectorAll('.tw-num'), function (cell) {
            var r = $(cell.dataset.range);
            if (!r) return;
            var v = String(r.value);
            if (cell.dataset.pad) v = v.padStart(+cell.dataset.pad, '0');
            var out = cell.querySelector('.tw-v');
            if (out.textContent !== v) {
                out.textContent = v;
                if (!initial && lastNum[cell.dataset.range] !== undefined) {
                    out.classList.remove('tw-write'); void out.offsetWidth; out.classList.add('tw-write');
                }
            }
            lastNum[cell.dataset.range] = v;
            cell.setAttribute('aria-valuenow', r.value);
        });

        // Karte aus Richtung/Distanz
        var dir = ($('dirPref') && $('dirPref').value) || 'any';
        var dist = ($('distRange') && $('distRange').value) || 'any';
        var di = Math.max(0, DIST_VALUES.indexOf(dist));
        desk.querySelector('.tw-sector').setAttribute('d', WEDGE[dir] ? arc(WEDGE[dir][0], WEDGE[dir][1], di ? RINGS[di] : 96) : '');
        desk.querySelector('.tw-ring').setAttribute('r', di ? RINGS[di] : 0);
        setText('dir', DIR_LABEL[dir] || 'egal');
        setText('dist', DIST_LABEL[dist] || 'egal');

        // Flugzeugkarten: Kurzinfo aus dem Preset-Tooltip (Name · Klasse · TAS · GPH · Sitze …)
        Array.prototype.forEach.call(desk.querySelectorAll('[data-slot="cards"] .btn-preset'), function (btn) {
            var parts = String(btn.title || '').split(' · ');
            var tas = parts.filter(function (p) { return /TAS$/.test(p); })[0] || '';
            var gph = parts.filter(function (p) { return /GPH$/.test(p); })[0] || '';
            var sub = [tas.replace(' TAS', ' kt'), gph.replace(' GPH', ' gph')].filter(Boolean).join(' · ');
            if (btn.getAttribute('data-tw-sub') !== sub) btn.setAttribute('data-tw-sub', sub);
        });

        // Funkgerät: Zustand der Auftrags-Taste und der Signalnadel
        var gen = $('generateBtn');
        var working = !!(gen && gen.classList.contains('dispatch-lamp-working'));
        var error = !!(gen && gen.classList.contains('dispatch-lamp-error'));
        var done = !!(gen && ['dispatch-lamp-ai-g3', 'dispatch-lamp-ai-g25', 'dispatch-lamp-ai-lite', 'dispatch-lamp-local'].some(function (c) { return gen.classList.contains(c); }));
        var radio = desk.querySelector('.tw-radio');
        radio.classList.toggle('tw-tx', working);
        if (working) setText('lcd', 'SENDE …');
        else if (wasWorking && done) { stamp(); setText('lcd', 'FREIGABE'); lcdHold = Date.now() + 4000; }
        else if (error) setText('lcd', 'FEHLER');
        else if (Date.now() > lcdHold) setText('lcd', 'BEREIT');
        wasWorking = working;

        var needle = $('meterNeedle');
        var m = needle && /rotate\((-?[\d.]+)deg\)/.exec(needle.style.transform || '');
        var angle = m ? parseFloat(m[1]) : -45;
        var bars = Math.max(0, Math.min(4, Math.round((angle + 45) / 22.5)));
        Array.prototype.forEach.call(desk.querySelectorAll('.tw-bars i'), function (b, i) { b.classList.toggle('on', i < bars); });
    }


    /* ==================================================================
       FERNSCHREIBER (Entwurf: analysis/fernschreiber-2026-10-23/)
       Einstellfelder an der Maschine, oben das Telegramm mit dem Flugplan.
       Ändert sich der Plan, zieht die Maschine das Papier ein, schlägt die
       Zeile neu und gibt es wieder aus.
       ================================================================== */
    function txCounter(source, label, digits) {
        return '<div class="tx-counter" data-src="' + source + '" data-digits="' + digits + '" tabindex="0" role="slider" aria-label="' + label + '">' +
            '<span class="tx-cl">' + label + '</span><div class="tx-drums"></div></div>';
    }
    function txRotaryHtml(name, label) {
        return '<div class="tx-rotary" data-rot="' + name + '" tabindex="0" role="button" aria-label="' + label + '"><div class="tx-knob"></div></div>';
    }
    var TELEX =
        '<div class="tx-desk" id="telexDesk">' +
        '<div class="tx-paper-window" aria-label="Flugplan-Telegramm"><div class="tx-paper"></div></div>' +
        '<div class="tx-machine">' +
        '<div class="tx-hood">' +
        '<div class="tx-carriage" aria-hidden="true"><div class="tx-ribbon"></div><div class="tx-head"></div><div class="tx-bar"></div></div>' +
        '<button type="button" class="tx-sound" aria-pressed="false" title="Tippgeräusch an/aus"><span class="tx-sw"></span>TON</button>' +
        '<div class="tx-plate">FS · FLUGPLAN</div>' +
        '<div class="tx-lamps"><span class="tx-lamp tx-lamp-line"><i></i>LEITUNG</span><span class="tx-lamp tx-amber tx-lamp-send"><i></i>SENDEN</span></div>' +
        '</div>' +
        '<div class="tx-panel">' +
        '<section class="tx-group tx-route" aria-label="Route"><span class="tx-gl">Route</span>' +
        '<div class="tx-win" data-slot="start"></div>' +
        '<button type="button" class="tx-key tx-swap" data-tx="swap" title="Start und Ziel tauschen">⇄</button>' +
        '<div class="tx-win" data-slot="dest"></div></section>' +
        '<section class="tx-group tx-ac" aria-label="Flugzeug"><span class="tx-gl">Flugzeug</span>' + txRotaryHtml('ac', 'Flugzeug wählen') + '</section>' +
        '<section class="tx-group tx-type" aria-label="Auftrag"><span class="tx-gl">Auftrag</span>' +
        '<span class="tx-lever"><span class="tx-l-rdm">RDM</span><span class="tx-lever-slot" data-slot="pick"></span><span class="tx-l-pick">PICK</span></span>' +
        '<div class="tx-typeslot" data-slot="type"></div>' + txRotaryHtml('type', 'Auftrag weiterschalten') + '</section>' +
        '<section class="tx-group tx-counters" aria-label="Flugzeugwerte"><span class="tx-gl">Werte <small>· seitlich wischen oder links/rechts tippen</small></span>' +
        txCounter('tasSlider', 'TAS KT', 3) + txCounter('altSlider', 'HÖHE FT', 5) + txCounter('rateSlider', 'V/S FPM', 4) +
        txCounter('gphSlider', 'GPH', 2) + txCounter('maxSeats', 'SITZE', 1) + '</section>' +
        '<section class="tx-group tx-dir" aria-label="Richtung"><span class="tx-gl">Richtung</span>' + txRotaryHtml('dir', 'Richtung wählen') + '</section>' +
        '<section class="tx-group tx-dist" aria-label="Distanz"><span class="tx-gl">Distanz <small>NM</small></span>' + txRotaryHtml('dist', 'Distanz wählen') + '</section>' +
        '<section class="tx-group tx-apt" aria-label="Platztypen"><span class="tx-gl">Platztypen</span>' +
        '<button type="button" class="tx-key tx-aptkey" data-tx="apt">VERKEHR+GA</button><span class="tx-apthint">öffnet die Klappe</span></section>' +
        '<section class="tx-keys" aria-label="Senden">' +
        '<button type="button" class="tx-key tx-big tx-send" data-tx="dispatch">SENDEN</button>' +
        '<button type="button" class="tx-key tx-big" data-tx="transfer" title="Transfer Hub (Import/Export)">SPEICHER</button>' +
        '<button type="button" class="tx-key tx-big tx-clear" data-tx="reset" title="Briefing verwerfen &amp; Reset">LÖSCHEN</button>' +
        '</section>' +
        '</div>' +
        '<div class="tx-scrim" hidden></div>' +
        '<section class="tx-flap" role="dialog" aria-modal="true" aria-label="Platztypen" hidden>' +
        '<h3>PLATZTYPEN · MEHRFACHAUSWAHL</h3><div class="tx-flap-grid"></div>' +
        '<div class="tx-flap-keys"><button type="button" class="tx-key" data-tx="aptall">ALLE</button><button type="button" class="tx-key tx-send" data-tx="aptok">OK</button></div>' +
        '</section>' +
        '</div>' +
        '</div>';

    var TX_DIR = [['any', 'RND', 'EGAL'], ['N', 'N', 'NORD'], ['E', 'O', 'OST'], ['S', 'S', 'SUED'], ['W', 'W', 'WEST']];
    var TX_DIST = [['any', 'RND', 'RNDM'], ['short', '50', '10-50NM'], ['medium', '100', '50-100NM'], ['long', '250', '100-250NM']];
    var tx = null; // Laufzeitzustand des Fernschreibers

    function telexReset() {
        if (tx && tx.timer) clearTimeout(tx.timer);
        tx = null;
    }

    function buildTelex() {
        var host = $('classicInputs');
        if (!host) return;
        var anchor = host.querySelector(':scope > .ops-route-fields');
        if (!anchor) return;
        var tpl = document.createElement('template');
        tpl.innerHTML = TELEX;
        desk = tpl.content.firstElementChild;
        host.insertBefore(desk, anchor);
        adopt($('startLoc') && $('startLoc').parentElement, slot('start'));
        adopt($('destLoc') && $('destLoc').parentElement, slot('dest'));
        adopt($('targetTypeLabel') && $('targetTypeLabel').parentElement, slot('type'));
        adopt($('analogProposalModeLabel'), slot('pick'));
        host.classList.add('tx-on');
        built = 'telex';
        tx = { lines: {}, texts: {}, pending: new Set(), running: false, timer: null, ack: [], planTime: new Date(), wasWorking: false, sound: read('ga_telex_sound') === '1', audio: null, rot: {} };
        bindTelex();
        txBuildPaper();
        syncTelex(true);
    }

    /* ---------- Telegramm aus dem echten App-Zustand ---------- */
    function txIcao(v) { return String(v || '').trim().toUpperCase().slice(0, 4) || '----'; }
    function txVal(id) { var el = $(id); return el ? el.value : ''; }
    function txActivePreset() {
        var btns = Array.prototype.slice.call(document.querySelectorAll('.preset-row .btn-preset'));
        return btns.filter(function (b) { return b.classList.contains('active'); })[0] || btns[0] || null;
    }
    function txCall() {
        var b = txActivePreset();
        var name = String(b ? b.textContent : 'GA').toUpperCase().replace(/[^A-Z0-9]/g, '');
        return { call: (name || 'GA').slice(0, 7), type: (name || 'ZZZZ').slice(0, 4) };
    }
    function txTypeText() {
        var sel = $('targetType');
        var o = sel && sel.options[sel.selectedIndex];
        return String(o ? o.text : 'APT').toUpperCase().replace(/[➔→]/g, '-').replace(/[()]/g, ' ').replace(/[^A-Z0-9ÄÖÜ +\-\/.]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
    }
    function txPick() { var b = $('analogProposalModeLabel'); return !!(b && b.classList.contains('is-active')); }
    function txAptSummary() {
        var api = window.gaAirportTypes;
        return api && typeof api.summary === 'function' ? String(api.summary({ compact: true })).toUpperCase().replace(/\s*\+\s*/g, '+') : 'VERKEHR+GA';
    }
    function txPad(n, l) { return String(n).padStart(l, '0'); }
    function txDirIdx() { var v = txVal('dirPref') || 'any'; return Math.max(0, TX_DIR.findIndex(function (d) { return d[0] === v; })); }
    function txDistIdx() { var v = txVal('distRange') || 'any'; return Math.max(0, TX_DIST.findIndex(function (d) { return d[0] === v; })); }
    function txDtg(d) { return pad(d.getUTCDate()) + pad(d.getUTCHours()) + pad(d.getUTCMinutes()); }
    function txHhmm(d) { return pad(d.getUTCHours()) + pad(d.getUTCMinutes()); }

    var TX_LINES = ['zc', 'hd', 'or', 'id', 'ty', 'dp', 'rt', 'ds', 'tp', 'dd', 'pf', 'ap', 'nn'];
    var TX_TIME_LINES = { or: 1, dp: 1 };
    function txTexts() {
        var dep = txVal('startLoc'), dest = String(txVal('destLoc') || '').trim(), c = txCall(), t = tx.planTime;
        var alt = parseFloat(txVal('altSlider')) || 0;
        return {
            zc: 'ZCZC GAD001',
            hd: 'FF ' + txIcao(dep) + 'ZTZX',
            or: txDtg(t) + ' ' + txIcao(dep) + 'ZPZX',
            id: '(FPL-' + c.call + '-VG',
            ty: '-' + c.type + '/L-SDFGY/S',
            dp: '-' + txIcao(dep) + txHhmm(t),
            rt: '-N' + txPad(txVal('tasSlider'), 4) + 'A' + txPad(Math.round(alt / 100), 3) + ' DCT',
            ds: '-' + (dest ? txIcao(dest) : 'ZZZZ') + '0130',
            tp: '-TYP/' + txTypeText() + ' ' + (txPick() ? 'PICK' : 'RDM'),
            dd: '-DIR/' + TX_DIR[txDirIdx()][2] + ' DIST/' + TX_DIST[txDistIdx()][2],
            pf: '-POB/' + txPad(txVal('maxSeats') || 1, 3) + ' FF/' + txPad(txVal('gphSlider'), 2) + 'GPH VS/' + txVal('rateSlider'),
            ap: '-APT/' + txAptSummary() + (dest ? '' : ' DEST/RNDM') + ')',
            nn: 'NNNN'
        };
    }

    function txPaper() { return desk && desk.querySelector('.tx-paper'); }
    function txCharSpan(ch) {
        var s = document.createElement('span');
        s.className = 'tx-c';
        s.textContent = ch;
        s.style.setProperty('--o', (0.82 + Math.random() * 0.18).toFixed(2));
        s.style.setProperty('--y', ((Math.random() - 0.5) * 0.8).toFixed(2) + 'px');
        return s;
    }
    function txSetLine(el, text) { el.textContent = ''; Array.prototype.forEach.call(text, function (ch) { el.appendChild(txCharSpan(ch)); }); }
    function txBuildPaper() {
        var paper = txPaper();
        var texts = txTexts();
        TX_LINES.forEach(function (id) {
            var d = document.createElement('div');
            d.className = 'tx-line';
            d.dataset.id = id;
            paper.appendChild(d);
            tx.lines[id] = d;
            txSetLine(d, texts[id]);
            tx.texts[id] = texts[id];
        });
        txAlign();
    }
    // Zeilen auf Höhe der Lochung (Kachel 1402 px breit, Lochabstand 70 px, erstes Loch bei 38 px)
    function txAlign() {
        var paper = txPaper();
        if (!paper || !paper.clientWidth) return;
        var w = paper.clientWidth, lh = w * 70 / 1402;
        desk.style.setProperty('--tx-line-h', lh.toFixed(2) + 'px');
        desk.style.setProperty('--tx-pad-top', (w * 108 / 1402 - lh / 2).toFixed(2) + 'px');
    }

    /* ---------- Druckwerk ---------- */
    var reduceMotion = false;
    try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}
    function txSleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function txClick() {
        if (!tx || !tx.sound) return;
        try {
            tx.audio = tx.audio || new (window.AudioContext || window.webkitAudioContext)();
            var a = tx.audio, len = 0.025;
            var buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate);
            var data = buf.getChannelData(0);
            for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 4);
            var src = a.createBufferSource(); src.buffer = buf;
            var f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400 + Math.random() * 900; f.Q.value = 0.9;
            var g = a.createGain(); g.gain.value = 0.35;
            src.connect(f); f.connect(g); g.connect(a.destination); src.start(a.currentTime);
        } catch (_) {}
    }
    function txCharW() {
        var line = tx.lines.zc, probe = document.createElement('span');
        probe.className = 'tx-c'; probe.textContent = 'MMMMMMMMMM';
        line.appendChild(probe); var w = probe.getBoundingClientRect().width / 10; probe.remove();
        return w || 8;
    }
    function txCarriageTo(idx) {
        if (!desk) return;
        var car = desk.querySelector('.tx-carriage'), paper = txPaper();
        var wr = desk.querySelector('.tx-paper-window').getBoundingClientRect(), hr = desk.querySelector('.tx-hood').getBoundingClientRect();
        var padL = parseFloat(getComputedStyle(paper).paddingLeft) || 0;
        var cw = tx.charW || (tx.charW = txCharW());
        car.style.left = (wr.left - hr.left + padL + idx * cw + cw / 2) + 'px';
    }
    function txOffsetFor(el) {
        var paper = txPaper();
        var padB = parseFloat(getComputedStyle(paper).paddingBottom) || 0;
        return paper.offsetHeight - padB - (el.offsetTop + el.offsetHeight);
    }
    function txPrintLine(el, text, cls) {
        var paper = txPaper(), car = desk.querySelector('.tx-carriage');
        paper.style.transform = 'translateY(' + txOffsetFor(el) + 'px)';
        return txSleep(reduceMotion ? 0 : 260).then(function () {
            if (!desk) return;
            el.className = 'tx-line' + (cls ? ' ' + cls : '');
            el.textContent = '';
            var per = reduceMotion ? 0 : Math.max(9, Math.min(20, 380 / Math.max(text.length, 1)));
            var i = 0;
            function next() {
                if (!desk) return Promise.resolve();
                if (i >= text.length) { txCarriageTo(text.length); return Promise.resolve(); }
                txCarriageTo(i);
                el.appendChild(txCharSpan(text[i]));
                if (text[i] !== ' ') { car.classList.remove('tx-strike'); void car.offsetWidth; car.classList.add('tx-strike'); txClick(); }
                i += 1;
                return per ? txSleep(per).then(next) : next();
            }
            return next();
        });
    }
    function txRun() {
        if (!tx || tx.running) return;
        tx.running = true;
        var lamp = desk.querySelector('.tx-lamp-send');
        lamp.classList.add('on');
        function loop() {
            if (!tx || !desk) return Promise.resolve();
            var id = TX_LINES.filter(function (x) { return tx.pending.has(x); })[0];
            if (!id) return Promise.resolve();
            tx.pending.delete(id);
            var text = tx.texts[id];
            if (tx.lines[id].textContent === text) return loop();
            return txPrintLine(tx.lines[id], text).then(loop);
        }
        loop().then(function () {
            if (!tx || !desk) return;
            var paper = txPaper();
            paper.classList.add('tx-slow');
            paper.style.transform = 'translateY(0)';
            txCarriageTo(0);
            return txSleep(reduceMotion ? 0 : 340).then(function () {
                if (!tx || !desk) return;
                paper.classList.remove('tx-slow');
                if (!txWorking()) lamp.classList.remove('on');
                tx.running = false;
                if (tx.pending.size) txRun();
            });
        });
    }
    function txQueue(ids) {
        ids.forEach(function (id) { tx.pending.add(id); });
        txClearAck();
        clearTimeout(tx.timer);
        tx.timer = setTimeout(txRun, 110);
    }
    function txClearAck() {
        if (!tx || !tx.ack.length) return;
        tx.ack.splice(0).forEach(function (el) { el.remove(); });
        var paper = txPaper();
        if (paper && !tx.running) paper.style.transform = 'translateY(0)';
    }
    function txPrintAck(ok) {
        if (!tx || tx.running) return;
        txClearAck();
        tx.running = true;
        var paper = txPaper(), now = new Date(), c = txCall();
        var texts = ok
            ? ['', 'ZCZC GAD002', 'ACK ' + txDtg(now) + ' ' + txIcao(txVal('startLoc')) + 'ZPZX', 'FPL ' + c.call + ' FREIGEGEBEN ' + txHhmm(now) + 'Z', 'NNNN']
            : ['', 'ZCZC GAD002', 'NAK ' + txDtg(now) + ' ' + txIcao(txVal('startLoc')) + 'ZPZX', 'FPL ' + c.call + ' NICHT ANGENOMMEN', 'NNNN'];
        var chain = Promise.resolve();
        texts.forEach(function (text) {
            chain = chain.then(function () {
                if (!desk) return;
                var d = document.createElement('div');
                d.className = 'tx-line ' + (ok ? 'tx-ack' : 'tx-nak');
                paper.appendChild(d);
                tx.ack.push(d);
                return txPrintLine(d, text, ok ? 'tx-ack' : 'tx-nak');
            });
        });
        chain.then(function () {
            if (!tx || !desk) return;
            paper.classList.add('tx-slow');
            paper.style.transform = 'translateY(0)';
            txCarriageTo(0);
            return txSleep(reduceMotion ? 0 : 340).then(function () {
                if (!tx || !desk) return;
                paper.classList.remove('tx-slow');
                tx.running = false;
                if (tx.pending.size) txRun();
            });
        });
    }

    /* ---------- Bedienfeld ---------- */
    function txRotary(name) { return desk.querySelector('.tx-rotary[data-rot="' + name + '"]'); }
    function txLayoutRotary(el, labels, spanDeg) {
        Array.prototype.forEach.call(el.querySelectorAll('.tx-lbl'), function (s) { s.remove(); });
        var n = labels.length, span = spanDeg || (n <= 3 ? 90 : 120);
        el._angles = labels.map(function (_, i) { return n === 1 ? 0 : -span / 2 + i * span / (n - 1); });
        labels.forEach(function (text, i) {
            var s = document.createElement('span');
            s.className = 'tx-lbl';
            s.textContent = text;
            s.dataset.i = i;
            el.appendChild(s);
        });
        txPlaceRotary(el);
    }
    function txPlaceRotary(el) {
        if (!el._angles) return;
        var w = el.clientWidth, h = el.clientHeight, cx = w / 2, cy = h * 0.56, r = Math.min(w / 2 - 12, 44);
        var wide = el._angles.length > 1 && (el._angles[el._angles.length - 1] - el._angles[0]) > 150;
        Array.prototype.forEach.call(el.querySelectorAll('.tx-lbl'), function (s) {
            var a = el._angles[+s.dataset.i] * Math.PI / 180;
            s.style.left = (cx + Math.sin(a) * (r + (wide ? 2 : 6))) + 'px';
            s.style.top = (cy - Math.cos(a) * (wide ? r - 6 : r - 4)) + 'px';
        });
    }
    function txSetRotary(el, idx, angle) {
        var knob = el.querySelector('.tx-knob');
        knob.style.setProperty('--a', (angle !== undefined ? angle : (el._angles ? el._angles[idx] : 0)) + 'deg');
        Array.prototype.forEach.call(el.querySelectorAll('.tx-lbl'), function (s) { s.classList.toggle('on', +s.dataset.i === idx); });
    }
    function txPresets() { return Array.prototype.slice.call(document.querySelectorAll('.preset-row .btn-preset')); }
    function txStepSelect(id, dir) {
        var sel = $(id);
        if (!sel || !sel.options.length) return;
        var n = sel.options.length, i = Math.min(n - 1, Math.max(0, sel.selectedIndex + dir));
        if (i === sel.selectedIndex) return;
        sel.selectedIndex = i;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function txStepCounter(src, dir) {
        if (src === 'maxSeats') txStepSelect('maxSeats', dir);
        else stepRange(src, dir);
        syncTelex();
    }

    function txOpenFlap() {
        var api = window.gaAirportTypes;
        if (!api || !api.groups) { if (api && api.open) api.open(); return; }
        var flap = desk.querySelector('.tx-flap'), scrim = desk.querySelector('.tx-scrim'), grid = desk.querySelector('.tx-flap-grid');
        if (!grid.children.length) {
            api.groups.forEach(function (g) {
                var b = document.createElement('button');
                b.type = 'button'; b.className = 'tx-tsw'; b.dataset.id = g.id; b.setAttribute('role', 'switch');
                b.innerHTML = '<span class="tx-tbase"></span><span><b>' + g.label + '</b><small>' + (g.description || '') + '</small></span>';
                b.addEventListener('click', function () {
                    var sel = api.getSelected();
                    var on = sel.indexOf(g.id) >= 0;
                    if (on && sel.length === 1) { b.classList.remove('tx-nope'); void b.offsetWidth; b.classList.add('tx-nope'); return; }
                    api.setSelected(on ? sel.filter(function (x) { return x !== g.id; }) : sel.concat([g.id]));
                    txSyncFlap();
                });
                grid.appendChild(b);
            });
        }
        txSyncFlap();
        flap.hidden = false; scrim.hidden = false;
        requestAnimationFrame(function () { flap.classList.add('on'); scrim.classList.add('on'); });
        setTimeout(function () { var f = grid.querySelector('.tx-tsw'); if (f) f.focus(); }, 120);
    }
    function txSyncFlap() {
        var api = window.gaAirportTypes;
        if (!api || !desk) return;
        var sel = api.getSelected();
        Array.prototype.forEach.call(desk.querySelectorAll('.tx-tsw'), function (b) { b.setAttribute('aria-checked', String(sel.indexOf(b.dataset.id) >= 0)); });
        syncTelex();
    }
    function txCloseFlap() {
        if (!desk) return;
        var flap = desk.querySelector('.tx-flap'), scrim = desk.querySelector('.tx-scrim');
        flap.classList.remove('on'); scrim.classList.remove('on');
        setTimeout(function () { flap.hidden = true; scrim.hidden = true; }, 260);
        var key = desk.querySelector('.tx-aptkey'); if (key) key.focus();
    }

    function bindTelex() {
        // Drehschalter
        [['dir', TX_DIR, 240], ['dist', TX_DIST, 220]].forEach(function (cfg) {
            var el = txRotary(cfg[0]);
            txLayoutRotary(el, cfg[1].map(function (d) { return d[1]; }), cfg[2]);
            var id = cfg[0] === 'dir' ? 'dirPref' : 'distRange';
            var pick = function (i) { setSelect(id, cfg[1][i][0]); syncTelex(); };
            el.addEventListener('click', function (e) {
                var lbl = e.target.closest('.tx-lbl');
                var cur = cfg[0] === 'dir' ? txDirIdx() : txDistIdx();
                pick(lbl ? +lbl.dataset.i : (cur + 1) % cfg[1].length);
            });
            el.addEventListener('keydown', function (e) {
                var cur = cfg[0] === 'dir' ? txDirIdx() : txDistIdx(), n = cfg[1].length;
                if (['ArrowRight', 'ArrowUp', 'Enter', ' '].indexOf(e.key) >= 0) { e.preventDefault(); pick((cur + 1) % n); }
                if (['ArrowLeft', 'ArrowDown'].indexOf(e.key) >= 0) { e.preventDefault(); pick((cur - 1 + n) % n); }
            });
        });
        // Flugzeug: Positionen = Schnellwahl-Presets. Langdruck/Rechtsklick öffnet die
        // Zuweisungsliste – auf einer Beschriftung für diese Position, sonst für die aktive.
        var ac = txRotary('ac');
        var acOpenQuickMenu = function (e) {
            var btns = txPresets(); if (!btns.length || typeof window.openAircraftQuickSlotMenu !== 'function') return false;
            var lbl = e && e.target && e.target.closest ? e.target.closest('.tx-lbl') : null;
            var btn = lbl ? btns[+lbl.dataset.i] : txActivePreset();
            if (!btn || btn.dataset.quickSlot === undefined) return false;
            window.openAircraftQuickSlotMenu(+btn.dataset.quickSlot, lbl || ac, e);
            return true;
        };
        if (typeof window.bindAircraftQuickSlotLongPress === 'function') {
            // Gemeinsame, handyfeste Langdruck-Logik aus app.js (inkl. Rechtsklick).
            window.bindAircraftQuickSlotLongPress(ac, function (e) { acOpenQuickMenu(e); });
        } else {
            ac.addEventListener('contextmenu', function (e) { e.preventDefault(); acOpenQuickMenu(e); });
        }
        ac.addEventListener('click', function (e) {
            var btns = txPresets(); if (!btns.length) return;
            var lbl = e.target.closest('.tx-lbl');
            var cur = btns.indexOf(txActivePreset());
            var target = btns[lbl ? +lbl.dataset.i : (cur + 1) % btns.length];
            if (target) target.click();
            setTimeout(syncTelex, 60);
        });
        ac.addEventListener('selectstart', function (e) { e.preventDefault(); });
        ac.setAttribute('aria-haspopup', 'menu');
        ac.addEventListener('keydown', function (e) {
            if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10') || (e.altKey && e.key === 'ArrowDown')) {
                e.preventDefault(); acOpenQuickMenu(e); return;
            }
            if (['ArrowRight', 'ArrowUp', 'Enter', ' '].indexOf(e.key) >= 0) { e.preventDefault(); ac.click(); }
        });
        // Auftrag: Knopf schaltet die Auswahlliste weiter
        var tp = txRotary('type');
        tp.addEventListener('click', function () {
            var sel = $('targetType'); if (!sel || !sel.options.length) return;
            sel.selectedIndex = (sel.selectedIndex + 1) % sel.options.length;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            syncTelex();
        });
        tp.addEventListener('wheel', function (e) {
            e.preventDefault();
            var sel = $('targetType'); if (!sel || !sel.options.length) return;
            var n = sel.options.length;
            sel.selectedIndex = (sel.selectedIndex + (e.deltaY < 0 ? 1 : -1) + n) % n;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            syncTelex();
        }, { passive: false });
        tp.addEventListener('keydown', function (e) { if (['Enter', ' ', 'ArrowRight', 'ArrowUp'].indexOf(e.key) >= 0) { e.preventDefault(); tp.click(); } });

        // Rollenzählwerke
        Array.prototype.forEach.call(desk.querySelectorAll('.tx-counter'), function (c) {
            var src = c.dataset.src, x0 = 0, acc = 0, movedPx = false, down = false;
            c.addEventListener('pointerdown', function (e) { down = true; movedPx = false; acc = 0; x0 = e.clientX; try { c.setPointerCapture(e.pointerId); } catch (_) {} });
            c.addEventListener('pointermove', function (e) {
                if (!down) return;
                var dx = e.clientX - x0; x0 = e.clientX; acc += dx;
                if (Math.abs(acc) > 3) movedPx = true;
                while (Math.abs(acc) >= 14) { var s = acc > 0 ? 1 : -1; acc -= s * 14; txStepCounter(src, s); }
            });
            c.addEventListener('pointercancel', function () { down = false; movedPx = true; });
            c.addEventListener('pointerup', function (e) {
                if (!down) return;
                down = false;
                if (movedPx) return;
                var r = c.getBoundingClientRect();
                txStepCounter(src, (e.clientX - r.left) > r.width / 2 ? 1 : -1);
            });
            c.addEventListener('wheel', function (e) { e.preventDefault(); txStepCounter(src, e.deltaY < 0 ? 1 : -1); }, { passive: false });
            c.addEventListener('keydown', function (e) {
                if (['ArrowRight', 'ArrowUp', '+'].indexOf(e.key) >= 0) { e.preventDefault(); txStepCounter(src, 1); }
                if (['ArrowLeft', 'ArrowDown', '-'].indexOf(e.key) >= 0) { e.preventDefault(); txStepCounter(src, -1); }
            });
        });

        // Tasten und Klappe
        desk.addEventListener('click', function (e) {
            var b = e.target.closest('[data-tx]');
            if (!b || !desk.contains(b)) return;
            var a = b.dataset.tx;
            if (a === 'swap') { if (typeof window.swapDepDest === 'function') window.swapDepDest(); }
            else if (a === 'dispatch') act('dispatch');
            else if (a === 'transfer') act('transfer');
            else if (a === 'reset') act('reset');
            else if (a === 'apt') txOpenFlap();
            else if (a === 'aptok') txCloseFlap();
            else if (a === 'aptall') { if (window.gaAirportTypes) window.gaAirportTypes.selectAll(); txSyncFlap(); }
            setTimeout(syncTelex, 60);
        });
        desk.querySelector('.tx-scrim').addEventListener('click', txCloseFlap);
        desk.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !desk.querySelector('.tx-flap').hidden) txCloseFlap(); });
        var snd = desk.querySelector('.tx-sound');
        snd.setAttribute('aria-pressed', String(tx.sound));
        snd.addEventListener('click', function () {
            tx.sound = !tx.sound;
            write('ga_telex_sound', tx.sound ? '1' : '0');
            snd.setAttribute('aria-pressed', String(tx.sound));
            if (tx.sound) txClick();
        });
        var stampBtn = $('analogProposalModeLabel');
        if (stampBtn) stampBtn.addEventListener('click', function () { setTimeout(syncTelex, 60); });
        window.addEventListener('resize', function () { if (built === 'telex') { txAlign(); tx.charW = 0; ['ac', 'dir', 'dist'].forEach(function (n) { var el = txRotary(n); if (el) txPlaceRotary(el); }); } });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (built === 'telex') { tx.charW = 0; txAlign(); } });
    }

    function txWorking() { var g = $('generateBtn'); return !!(g && g.classList.contains('dispatch-lamp-working')); }

    function syncTelex(initial) {
        if (built !== 'telex' || !desk || !tx) return;
        // Telegramm: geänderte Zeilen neu drucken; Uhrzeit nur bei echten Planänderungen
        var texts = txTexts(), changed = [];
        TX_LINES.forEach(function (id) { if (!TX_TIME_LINES[id] && texts[id] !== tx.texts[id]) changed.push(id); });
        if (changed.length) {
            tx.planTime = new Date();
            texts = txTexts();
            Object.keys(TX_TIME_LINES).forEach(function (id) { if (texts[id] !== tx.texts[id]) changed.push(id); });
        }
        changed.forEach(function (id) { tx.texts[id] = texts[id]; });
        if (changed.length && !initial) txQueue(changed);

        // Rollenzählwerke
        Array.prototype.forEach.call(desk.querySelectorAll('.tx-counter'), function (c) {
            var digits = +c.dataset.digits, v = String(txVal(c.dataset.src) || '0');
            var s = v.padStart(digits, '0').slice(-digits), drums = c.querySelector('.tx-drums');
            if (drums.children.length !== digits) {
                drums.innerHTML = '';
                for (var i = 0; i < digits; i++) drums.innerHTML += '<div class="tx-drum"><span></span></div>';
            }
            var prev = c.dataset.val ? parseFloat(c.dataset.val) : null, dir = prev === null ? 0 : (parseFloat(v) > prev ? 1 : -1);
            Array.prototype.forEach.call(drums.children, function (d, i) {
                var span = d.firstChild;
                if (span.textContent !== s[i]) {
                    span.textContent = s[i];
                    if (!initial && prev !== null) { span.classList.remove('tx-up', 'tx-down'); void span.offsetWidth; span.classList.add(dir > 0 ? 'tx-up' : 'tx-down'); }
                }
            });
            c.dataset.val = v;
            c.setAttribute('aria-valuenow', v);
        });

        // Drehschalter
        var btns = txPresets(), ac = txRotary('ac');
        var names = btns.map(function (b) { return String(b.textContent || '').trim().toUpperCase(); });
        if (ac._names !== names.join('|')) { ac._names = names.join('|'); txLayoutRotary(ac, names); }
        txSetRotary(ac, Math.max(0, btns.indexOf(txActivePreset())));
        txSetRotary(txRotary('dir'), txDirIdx());
        txSetRotary(txRotary('dist'), txDistIdx());
        var sel = $('targetType'), n = sel ? sel.options.length : 1, si = sel ? Math.max(0, sel.selectedIndex) : 0;
        txSetRotary(txRotary('type'), -1, n > 1 ? -150 + 300 * si / (n - 1) : 0);

        var key = desk.querySelector('.tx-aptkey'), sum = txAptSummary();
        if (key.textContent !== sum) key.textContent = sum;
        desk.classList.toggle('tx-pick', txPick());

        // Lampen und Quittung
        var g = $('generateBtn'), working = txWorking();
        var error = !!(g && g.classList.contains('dispatch-lamp-error'));
        var done = !!(g && ['dispatch-lamp-ai-g3', 'dispatch-lamp-ai-g25', 'dispatch-lamp-ai-lite', 'dispatch-lamp-local'].some(function (c) { return g.classList.contains(c); }));
        var lampSend = desk.querySelector('.tx-lamp-send');
        if (working) lampSend.classList.add('on'); else if (!tx.running) lampSend.classList.remove('on');
        if (tx.wasWorking && !working && (done || error)) txPrintAck(done);
        tx.wasWorking = working;
        desk.querySelector('.tx-lamp-line').classList.toggle('on', !error);
    }

    /* ------------------------------------------------------------------
       Schraube oben rechts: Design je Theme wechseln
       ------------------------------------------------------------------ */
    function showIndicator(text) {
        var indicator = $('searchIndicator');
        if (!indicator) return;
        indicator.innerText = text;
        setTimeout(function () { if (indicator.innerText === text) indicator.innerText = 'System bereit.'; }, 1800);
    }
    function cycleAnalogSkin() {
        if (!isAnalogTheme()) return null;
        var next = SKINS[(SKINS.indexOf(currentSkin()) + 1) % SKINS.length];
        write(SKIN_KEY, next);
        apply();
        showIndicator('Design: ' + SKIN_LABEL[next]);
        return next;
    }
    function cycleTopRightScrew() {
        if (document.body && document.body.classList.contains('theme-navcom')) {
            return typeof window.gaCycleNavcomSkin === 'function' ? window.gaCycleNavcomSkin() : null;
        }
        return cycleAnalogSkin();
    }

    function init() {
        apply();
        // Theme-Wechsel (Klassen am body) bauen den Tower auf bzw. zurück
        if (typeof MutationObserver === 'function') {
            new MutationObserver(apply).observe(document.body, { attributes: true, attributeFilter: ['class'] });
        }
        setInterval(function () { if (built && !document.hidden) sync(); }, 400);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { sync(); });
    }

    window.gaCycleAnalogSkin = cycleAnalogSkin;
    window.gaCycleTopRightScrew = cycleTopRightScrew;
    window.gaAnalogSkin = { current: currentSkin, apply: apply, sync: sync };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
