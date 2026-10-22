/* NavCom-Designs: Klassik, Bendix und KX.
   Klassik ist das bestehende Markup. Für Bendix und KX baut dieses Skript eigenes
   Geräte-Markup und hängt die echten Bedienelemente (Eingabefelder mit Flughafen-/
   Favoritenliste, Auswahllisten, Drag-Knöpfe, Tasten) hinein. Beim Wechsel zurück
   kommen alle Elemente exakt an ihren alten Platz.
   Schraube oben rechts: Design. O/M/I-Feld, TEST-Taste bzw. PULL TEST: Anzeigefarbe. */
(function () {
    'use strict';

    var SKIN_KEY = 'ga_navcom_skin';
    var SKINS = ['classic', 'bendix', 'kx'];
    var SKIN_LABEL = { classic: 'NavCom Klassik', bendix: 'NavCom Bendix', kx: 'NavCom KX' };
    var DISPLAY_COLORS = {
        classic: ['orig', 'amber', 'green'],
        bendix: ['amber', 'green', 'cyan', 'red'],
        kx: ['red', 'amber', 'green']
    };
    var DISPLAY_LABEL = { orig: 'Rot', red: 'Rot', amber: 'Amber', green: 'Grün', cyan: 'Cyan' };
    var DISPLAY_CLASSES = ['nc-disp-orig', 'nc-disp-red', 'nc-disp-amber', 'nc-disp-green', 'nc-disp-cyan'];
    var WIDE_MIN_PX = 580;

    function read(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
    function write(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
    function $(id) { return document.getElementById(id); }
    function stackEl() { return $('navcomInputs'); }

    function currentSkin() {
        var saved = read(SKIN_KEY);
        return SKINS.indexOf(saved) >= 0 ? saved : 'classic';
    }
    function currentDisplay(skin) {
        var list = DISPLAY_COLORS[skin];
        var saved = read('ga_navcom_display_' + skin);
        return list.indexOf(saved) >= 0 ? saved : list[0];
    }

    /* ------------------------------------------------------------------
       Markup-Bausteine
       ------------------------------------------------------------------ */
    var KNOB_BIG = '<i class="sh"></i><i class="k1"></i><i class="w1"></i><i class="k2"></i><i class="w2"></i><i class="cap"></i><i class="shine"></i>';
    var KNOB_MINI = '<i class="k1"></i><i class="cap"></i><i class="ptr"></i>';
    var KNOB_MODE = '<i class="sh"></i><i class="k1"></i><i class="cap"></i><i class="ptr"></i><i class="shine"></i>';
    var BX_KNOB = '<i class="ring"></i><i class="cap"></i>';
    var ARROW = '<svg viewBox="0 0 26 10" aria-hidden="true"><path d="M0 5 6 0v3h14V0l6 5-6 5V7H6v3z"/></svg>';
    var SCREWS = '<i class="nc-screw tl"></i><i class="nc-screw tr"></i><i class="nc-screw bl"></i><i class="nc-screw br"></i>';

    function kxRow(c) {
        return '' +
            '<section class="nc-unit ncx kx" data-unit="' + c.unit + '">' +
            '<div class="wins">' +
            '<div class="win" data-slot="dispL"><span class="leg-r">' + c.legL + '</span></div>' +
            '<div class="win" data-slot="dispR"><span class="leg-r">' + c.legR + '</span></div>' +
            '</div>' +
            '<div class="band"><span class="model">' + c.model + '</span>' +
            '<span class="xfer l">' + ARROW + '<span class="ovl" data-slot="xferL"></span></span>' +
            '<span class="blabel l">' + c.lblL + '</span>' +
            '<span class="xfer r">' + ARROW + '<span class="ovl" data-slot="xferR"></span></span>' +
            '<span class="blabel r">' + c.lblR + '</span></div>' +
            '<div class="brand">GA DISPATCHER</div>' +
            '<div class="nc-knob mini l" data-act="' + c.miniL[0] + '" role="button" tabindex="0" title="' + c.miniL[2] + '">' + KNOB_MINI + '</div>' +
            '<div class="pull l">PULL<br>' + c.miniL[1] + '</div>' +
            (c.off ? '<div class="off">OFF</div>' : '') +
            '<div class="nc-knob big l"' + (c.focusL ? ' data-focus="' + c.focusL + '"' : '') + '>' + KNOB_BIG + '<span class="ovl" data-slot="knobL"></span></div>' +
            '<div class="nc-knob mini r" data-act="' + c.miniR[0] + '" role="button" tabindex="0" title="' + c.miniR[2] + '">' + KNOB_MINI + '</div>' +
            '<div class="pull r">PULL<br>' + c.miniR[1] + '</div>' +
            '<div class="nc-knob big r"' + (c.focusR ? ' data-focus="' + c.focusR + '"' : '') + '>' + KNOB_BIG + '<span class="ovl" data-slot="knobR"></span></div>' +
            '</section>';
    }

    var KX_TEMPLATES = {
        audio: '<section class="nc-unit ncx kma" data-unit="audio">' +
            '<div class="mk-win" data-slot="markers"></div>' +
            '<div class="agrid audio-btn-grid" data-slot="keys"></div>' +
            '<div class="model">AUDIO · AIRCRAFT</div><div class="brand">GA DISPATCHER</div></section>',
        com: kxRow({ unit: 'com', model: 'ROUTE', lblL: 'COM 1', lblR: 'COM 2', legL: 'ICAO', legR: 'ICAO', off: true,
            miniL: ['test', 'TEST', 'Anzeigefarbe wechseln (Lampentest)'], miniR: ['clr', 'CLR', 'Ziel löschen'],
            focusL: 'startLocRadio', focusR: 'destLocRadio' }),
        nav: kxRow({ unit: 'nav', model: 'MISSION', lblL: 'NAV 1', lblR: 'NAV 2',
            legL: '<span class="ann rdm">RDM</span>&nbsp;<span class="ann pick">PICK</span>', legR: 'NM',
            miniL: ['pick', 'PICK', 'RDM / PICK umschalten'], miniR: ['rndm', 'RNDM', 'Distanz zufällig'] }),
        adf: kxRow({ unit: 'adf', model: 'FILTER', lblL: 'ADF 1', lblR: 'ADF 2', legL: 'FILTER', legR: 'DIR',
            miniL: ['aptall', 'ALL', 'Alle Platztypen'], miniR: ['hdgany', 'ANY', 'Jede Richtung'] }),
        xpdr: '<section class="nc-unit ncx kt" data-unit="xpdr">' +
            '<div class="win">' +
            '<div class="cell"><div class="seg" data-slot="tas"></div><div class="leg">TAS</div></div>' +
            '<div class="cell"><div class="seg" data-slot="gph"></div><div class="leg">GPH</div></div>' +
            '<div class="cell"><div class="seg" data-slot="pax"></div><div class="leg">PAX</div></div>' +
            '<div class="cell" data-act="altmode" title="Klick: ALT / V/S"><div class="seg" data-slot="alt"></div><div class="leg nc-alt-leg">ALT FT</div></div>' +
            '</div>' +
            '<div class="nc-knob tk c1">' + KNOB_BIG + '<span class="ovl" data-slot="knobTas"></span></div>' +
            '<div class="nc-knob tk c2">' + KNOB_BIG + '<span class="ovl" data-slot="knobGph"></span></div>' +
            '<div class="nc-knob tk c3" data-act="pax" role="button" tabindex="0" title="PAX: drehen oder antippen">' + KNOB_BIG + '</div>' +
            '<div class="nc-knob tk c4">' + KNOB_BIG + '<span class="ovl" data-slot="knobAlt"></span></div>' +
            '<div class="reply"><i></i>R</div>' +
            '<span class="mlab a" data-act="altmode">ALT</span><span class="mlab v" data-act="altmode">V/S</span>' +
            '<div class="nc-knob mode" data-act="altmode" role="button" tabindex="0" title="ALT / V/S umschalten">' + KNOB_MODE + '</div>' +
            '<div class="model">XPDR · AIRCRAFT</div></section>',
        cmd: '<section class="nc-unit ncx kcmd" data-unit="cmd"><div class="model">CMD</div>' +
            '<div class="cmd-btns"><span data-slot="exec"></span><span data-slot="data"></span><span data-slot="clear"></span></div></section>'
    };

    function bxHalf(c) {
        return '' +
            '<section class="ncb-half">' + SCREWS +
            '<div class="unit-label">' + c.label + '</div>' +
            (c.lever ? '<span class="lever-wrap"><span class="tl pick">PICK</span><span class="base"><span class="lever"></span></span><span class="tl rdm">RDM</span><span class="ovl" data-slot="pickSwitch"></span></span>' : '') +
            '<div class="unit-body">' +
            '<div class="win" data-slot="' + c.disp + '"><span class="flag">' + c.flag + '</span></div>' +
            '<span class="xfer">↔<span class="ovl" data-slot="' + c.xfer + '"></span></span>' +
            '<div class="nc-knob bx"' + (c.focus ? ' data-focus="' + c.focus + '"' : '') + (c.act ? ' data-act="' + c.act + '" role="button" tabindex="0" title="' + c.title + '"' : '') + '>' + BX_KNOB +
            (c.knob ? '<span class="ovl" data-slot="' + c.knob + '"></span>' : '') + '</div>' +
            '</div></section>';
    }
    function bxRow(unit, left, right) {
        return '<div class="nc-unit ncb ncb-row" data-unit="' + unit + '">' + bxHalf(left) + bxHalf(right) + '</div>';
    }
    function bxXknob(slot, label, act) {
        return '<div class="xknob-wrap"><div class="nc-knob bx small"' + (act ? ' data-act="' + act + '" role="button" tabindex="0" title="PAX: drehen oder antippen"' : '') + '>' + BX_KNOB +
            (slot ? '<span class="ovl" data-slot="' + slot + '"></span>' : '') + '</div><span>' + label + '</span></div>';
    }

    var BX_TEMPLATES = {
        audio: '<section class="nc-unit ncb ncb-unit" data-unit="audio">' + SCREWS +
            '<div class="unit-label">Audio <small>Aircraft · Sync</small></div>' +
            '<div class="audio"><div class="markers-slot" data-slot="markers"></div><div class="agrid audio-btn-grid" data-slot="keys"></div></div></section>',
        com: bxRow('com',
            { label: 'COM 1', disp: 'dispL', flag: 'USE', xfer: 'xferL', focus: 'startLocRadio' },
            { label: 'COM 2', disp: 'dispR', flag: 'STBY', xfer: 'xferR', act: 'clr', title: 'Klicken: Ziel löschen' }),
        nav: bxRow('nav',
            { label: 'NAV 1', disp: 'dispL', flag: 'PICK', xfer: 'xferL', knob: 'knobL', lever: true },
            { label: 'NAV 2', disp: 'dispR', flag: 'NM', xfer: 'xferR', knob: 'knobR' }),
        adf: bxRow('adf',
            { label: 'ADF 1', disp: 'dispL', flag: '', xfer: 'xferL', knob: 'knobL' },
            { label: 'ADF 2', disp: 'dispR', flag: '', xfer: 'xferR', knob: 'knobR' }),
        xpdr: '<section class="nc-unit ncb ncb-unit" data-unit="xpdr">' + SCREWS +
            '<div class="unit-label">XPDR <small>Aircraft</small></div>' +
            '<div class="xpdr"><div class="win">' +
            '<div class="xcell"><div class="annun"><span>TAS</span><span class="reply"></span></div><div class="seg" data-slot="tas"></div></div>' +
            '<div class="xcell"><div class="annun"><span>GPH</span></div><div class="seg" data-slot="gph"></div></div>' +
            '<div class="xcell"><div class="annun"><span>PAX</span></div><div class="seg" data-slot="pax"></div></div>' +
            '<div class="xcell" data-act="altmode" title="Klick: ALT / V/S"><div class="annun"><span class="nc-alt-lbl">ALT</span><span>FT</span></div><div class="seg" data-slot="alt"></div></div>' +
            '</div><div class="xknobs">' +
            bxXknob('knobTas', 'TAS') + bxXknob('knobGph', 'GPH') + bxXknob(null, 'PAX', 'pax') + bxXknob('knobAlt', '<span class="nc-alt-lbl">ALT</span>') +
            '</div></div></section>',
        cmd: '<section class="nc-unit ncb ncb-unit" data-unit="cmd">' + SCREWS + '<div class="unit-label">CMD</div>' +
            '<div class="cmd-btns"><span data-slot="exec"></span><span data-slot="data"></span><span data-slot="clear"></span></div></section>'
    };

    /* ------------------------------------------------------------------
       Aufbau / Rückbau
       ------------------------------------------------------------------ */
    var built = 'classic';
    var moved = [];

    function adopt(el, slot) {
        if (!el || !slot || !el.parentNode) return;
        var ph = document.createComment('navcom-skin-slot');
        el.parentNode.insertBefore(ph, el);
        moved.push([el, ph]);
        slot.appendChild(el);
    }

    function teardown(stack) {
        for (var i = moved.length - 1; i >= 0; i--) {
            var el = moved[i][0], ph = moved[i][1];
            if (ph.parentNode) { ph.parentNode.insertBefore(el, ph); ph.parentNode.removeChild(ph); }
        }
        moved = [];
        Array.prototype.forEach.call(stack.querySelectorAll('.lcd-input, .radio-disp-inner, .audio-btn'), function (el) {
            el.style.removeProperty('--nc-fit');
            el.style.removeProperty('--nc-ghost-text');
            el.classList.remove('nc-flash');
        });
        Array.prototype.forEach.call(stack.querySelectorAll(':scope > .nc-unit'), function (u) { u.remove(); });
        stack.classList.remove('nc-layout', 'nc-layout-kx', 'nc-layout-bendix');
        built = 'classic';
    }

    function insertBefore(anchor, html) {
        var tpl = document.createElement('template');
        tpl.innerHTML = html;
        var unit = tpl.content.firstElementChild;
        anchor.parentNode.insertBefore(unit, anchor);
        return unit;
    }
    function slot(unit, name) { return unit && unit.querySelector('[data-slot="' + name + '"]'); }
    function parentOf(id) { var el = $(id); return el ? el.parentElement : null; }

    function build(skin) {
        var stack = stackEl();
        if (!stack || built === skin) return;
        teardown(stack);
        if (skin === 'classic') return;
        var T = skin === 'kx' ? KX_TEMPLATES : BX_TEMPLATES;
        var audio = stack.querySelector(':scope > .audio-panel');
        var rows = stack.querySelectorAll(':scope > .radio-row');
        var xpdr = $('tasRadioDisplay') && $('tasRadioDisplay').closest('.radio-module');
        var cmd = stack.querySelector(':scope > .navcom-action-bar');
        if (!audio || rows.length < 3 || !xpdr || !cmd) return;

        var u = insertBefore(audio, T.audio);
        adopt(audio.querySelector('.marker-lights'), slot(u, 'markers'));
        Array.prototype.slice.call(audio.querySelectorAll('.audio-btn-grid > .audio-btn')).forEach(function (btn) {
            if (skin === 'kx' && btn.id === 'navcomTestBtn') return; // im KX übernimmt PULL TEST
            adopt(btn, slot(u, 'keys'));
        });

        var displays = [['startLocRadio', 'destLocRadio'], ['targetTypeRadio', 'distRangeRadio'], ['airportTypeFilterRadioButton', 'dirPrefRadio']];
        ['com', 'nav', 'adf'].forEach(function (name, i) {
            var row = rows[i];
            var halves = row.querySelectorAll(':scope > .half-module');
            var unit = insertBefore(row, T[name]);
            adopt(parentOf(displays[i][0]), slot(unit, 'dispL'));
            adopt(parentOf(displays[i][1]), slot(unit, 'dispR'));
            adopt(halves[0] && halves[0].querySelector('.radio-transfer-btn'), slot(unit, 'xferL'));
            adopt(halves[1] && halves[1].querySelector('.radio-transfer-btn'), slot(unit, 'xferR'));
            if (name !== 'com') {
                adopt(halves[0] && halves[0].querySelector('.radio-knob'), slot(unit, 'knobL'));
                adopt(halves[1] && halves[1].querySelector('.radio-knob'), slot(unit, 'knobR'));
            }
            if (name === 'nav') adopt($('navcomProposalModeSwitch'), slot(unit, 'pickSwitch'));
        });

        var x = insertBefore(xpdr, T.xpdr);
        adopt($('tasRadioDisplay'), slot(x, 'tas'));
        adopt($('gphRadioDisplay'), slot(x, 'gph'));
        adopt($('maxSeatsRadio'), slot(x, 'pax'));
        adopt($('altRadioDisplay'), slot(x, 'alt'));
        adopt($('tasDragKnob'), slot(x, 'knobTas'));
        adopt($('gphDragKnob'), slot(x, 'knobGph'));
        adopt($('altDragKnob'), slot(x, 'knobAlt'));

        var c = insertBefore(cmd, T.cmd);
        adopt($('radioGenerateBtn'), slot(c, 'exec'));
        adopt($('radioTransferBtn'), slot(c, 'data'));
        adopt($('radioClearBtn'), slot(c, 'clear'));

        stack.classList.add('nc-layout', 'nc-layout-' + skin);
        built = skin;
        lastText = new WeakMap();
        syncState();
    }

    /* ------------------------------------------------------------------
       Zusatzfunktionen der Konzept-Bedienelemente
       ------------------------------------------------------------------ */
    function setSelect(id, value) {
        var sel = $(id);
        if (!sel || sel.value === value) return;
        sel.value = value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    function cyclePax(dir) {
        var sel = $('maxSeatsRadio');
        if (!sel || !sel.options.length) return;
        var n = sel.options.length;
        sel.selectedIndex = (sel.selectedIndex + dir + n) % n;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    var ACTIONS = {
        test: function () { cycleNavcomDisplay(); },
        clr: function () { var k = $('com2Knob'); if (k) k.click(); },
        pick: function () { var s = $('navcomProposalModeSwitch'); if (s) s.click(); },
        rndm: function () { setSelect('distRangeRadio', 'any'); },
        aptall: function () { if (window.gaAirportTypes && typeof window.gaAirportTypes.selectAll === 'function') window.gaAirportTypes.selectAll(); },
        hdgany: function () { setSelect('dirPrefRadio', 'any'); },
        pax: function () { cyclePax(1); },
        altmode: function () { if (typeof window.toggleAltRateMode === 'function') window.toggleAltRateMode(); }
    };

    /* Zustand ins Konzept-Markup spiegeln (RDM/PICK, ALT/V-S, Werte-Animation, Einpassen) */
    var lastText = new WeakMap();
    function displayText(el) {
        if (el.tagName === 'SELECT') { var o = el.options[el.selectedIndex]; return o ? o.text : ''; }
        if (el.tagName === 'INPUT') return el.value || el.placeholder || '';
        return (el.textContent || '').trim();
    }
    function syncState() {
        var stack = stackEl();
        if (!stack || built === 'classic') return;
        var sw = $('navcomProposalModeSwitch');
        var pick = !!(sw && sw.classList.contains('is-active'));
        var altLabel = ($('altRateToggle') && $('altRateToggle').textContent.trim()) || 'ALT';
        var vs = altLabel !== 'ALT';
        Array.prototype.forEach.call(stack.querySelectorAll(':scope > .nc-unit'), function (u) {
            u.classList.toggle('nc-pick', pick);
            u.classList.toggle('nc-vs', vs);
        });
        Array.prototype.forEach.call(stack.querySelectorAll('.nc-alt-leg'), function (el) { el.textContent = vs ? 'V/S FPM' : 'ALT FT'; });
        Array.prototype.forEach.call(stack.querySelectorAll('.nc-alt-lbl'), function (el) { el.textContent = vs ? 'V/S' : 'ALT'; });
        fitDisplays(stack);
    }

    var fitCanvas = null;
    function fitDisplays(stack) {
        fitCanvas = fitCanvas || document.createElement('canvas');
        var ctx = fitCanvas.getContext('2d');
        if (!ctx) return;
        var els = stack.querySelectorAll('.nc-unit .lcd-input, .nc-unit .agrid .audio-btn, .nc-unit .cmd-btns .audio-btn');
        Array.prototype.forEach.call(els, function (el) {
            if (!el.offsetParent) return;
            var isKey = el.classList.contains('audio-btn');
            var text = isKey ? (el.textContent || '').trim() : displayText(el).trim();
            // Werte-Animation wie im Konzept, nicht beim eigenen Tippen
            if (!isKey) {
                var prev = lastText.get(el);
                if (prev !== undefined && prev !== text && document.activeElement !== el) {
                    el.classList.remove('nc-flash');
                    void el.offsetWidth;
                    el.classList.add('nc-flash');
                }
                lastText.set(el, text);
            }
            // Größe auf der gemeinsamen Zelle setzen: Ziffern und unbeleuchtete Segmente bleiben deckungsgleich.
            var host = isKey ? el : (el.closest('.radio-disp-inner, .seg') || el);
            el.style.removeProperty('--nc-fit');
            host.style.setProperty('--nc-fit', '1');
            text = text.toUpperCase(); // Anzeige und Taster stehen in Großbuchstaben
            var cs = getComputedStyle(el);
            var spacing = parseFloat(cs.letterSpacing) || 0;
            ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
            var words = parseFloat(cs.wordSpacing) || 0;
            var needed = text ? ctx.measureText(text).width + spacing * text.length + words * (text.split(' ').length - 1) : 0;
            var avail = el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
            var fit = (avail > 0 && needed > avail) ? Math.max(0.4, (avail / needed) * 0.98) : 1;
            host.style.setProperty('--nc-fit', fit.toFixed(3));
            if (isKey) return;
            // Unbeleuchtete Segmente: im Fenster so viele wie hineinpassen, im Transponder genau so viele wie Zeichen.
            var cell = (ctx.measureText('~').width + spacing) * fit;
            var count = text.length;
            if (host.classList.contains('radio-disp-inner') && cell > 0) count = Math.max(count, Math.floor(avail / cell));
            host.style.setProperty('--nc-ghost-text', '"' + new Array(count + 1).join('~') + '"');
        });
        // Transponder: alle vier Werte in derselben Ziffergröße
        var xp = stack.querySelectorAll('.nc-unit[data-unit="xpdr"] .seg');
        var min = 1;
        Array.prototype.forEach.call(xp, function (h) { min = Math.min(min, parseFloat(h.style.getPropertyValue('--nc-fit')) || 1); });
        Array.prototype.forEach.call(xp, function (h) { h.style.setProperty('--nc-fit', String(min)); });
    }

    /* ------------------------------------------------------------------
       Knöpfe des Konzept-Markups: Drehen, Klick, Rad
       ------------------------------------------------------------------ */
    function spin(knob, deg) {
        var rot = (parseFloat(knob.dataset.ncRot) || 0) + deg;
        knob.dataset.ncRot = String(rot);
        knob.style.setProperty('--nc-rot', rot + 'deg');
    }
    function bindKnobs(stack) {
        var active = null, lastY = 0, acc = 0, moved = false;
        stack.addEventListener('pointerdown', function (e) {
            var knob = e.target.closest && e.target.closest('.nc-knob');
            if (!knob) return;
            active = knob; lastY = e.clientY; acc = 0; moved = false;
        }, { passive: true });
        window.addEventListener('pointermove', function (e) {
            if (!active) return;
            var dy = lastY - e.clientY;
            lastY = e.clientY;
            acc += dy;
            if (Math.abs(acc) > 3) moved = true;
            spin(active, dy * 2.2);
            if (active.dataset.act === 'pax') {
                while (Math.abs(acc) >= 14) { var s = acc > 0 ? 1 : -1; acc -= s * 14; cyclePax(s); }
            }
        }, { passive: true });
        window.addEventListener('pointerup', function () {
            if (active && !moved) spin(active, 20);
            active = null;
        }, { passive: true });
        stack.addEventListener('click', function (e) {
            var actEl = e.target.closest && e.target.closest('[data-act]');
            if (actEl && stack.contains(actEl) && ACTIONS[actEl.dataset.act]) {
                if (actEl.dataset.act === 'pax' && moved) return;
                ACTIONS[actEl.dataset.act]();
                setTimeout(syncState, 30);
                return;
            }
            var focusKnob = e.target.closest && e.target.closest('.nc-knob[data-focus]');
            if (focusKnob && !e.target.closest('.ovl')) {
                var input = $(focusKnob.dataset.focus);
                if (input) { input.focus(); if (input.select) input.select(); }
            }
            setTimeout(syncState, 30);
        });
        stack.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            var actEl = e.target.closest && e.target.closest('.nc-knob[data-act]');
            if (actEl && ACTIONS[actEl.dataset.act]) { e.preventDefault(); ACTIONS[actEl.dataset.act](); setTimeout(syncState, 30); }
        });
        stack.addEventListener('wheel', function (e) {
            var knob = e.target.closest && e.target.closest('.nc-knob, .radio-knob');
            if (!knob) return;
            var deco = knob.closest('.nc-knob') || knob;
            spin(deco, e.deltaY < 0 ? 16 : -16);
            if (deco.dataset.act === 'pax') { e.preventDefault(); cyclePax(e.deltaY < 0 ? 1 : -1); }
            setTimeout(syncState, 30);
        }, { passive: false });
    }

    /* ------------------------------------------------------------------
       Design, Farbe, Lampentest
       ------------------------------------------------------------------ */
    function applySkin() {
        var body = document.body;
        if (!body) return;
        var skin = currentSkin();
        body.classList.toggle('navcom-skin-bendix', skin === 'bendix');
        body.classList.toggle('navcom-skin-kx', skin === 'kx');
        DISPLAY_CLASSES.forEach(function (cls) { body.classList.remove(cls); });
        body.classList.add('nc-disp-' + currentDisplay(skin));
        build(skin);
        updateWide();
    }

    function showIndicator(text) {
        var indicator = $('searchIndicator');
        if (!indicator) return;
        indicator.innerText = text;
        setTimeout(function () { if (indicator.innerText === text) indicator.innerText = 'System bereit.'; }, 1800);
    }

    // Lampentest über O/M/I; stellt danach den vorherigen Zustand (KI-Statusanzeige) wieder her.
    var lampTestTimer = null;
    function lampTest() {
        var lights = Array.prototype.slice.call(document.querySelectorAll('#navcomInputs .marker-light'));
        if (!lights.length || lampTestTimer) return;
        var saved = lights.map(function (l) { return { on: l.classList.contains('on'), blinking: l.classList.contains('blinking') }; });
        var stack = stackEl();
        if (stack) { stack.classList.remove('nc-lamp-test'); void stack.offsetWidth; stack.classList.add('nc-lamp-test'); }
        var step = 0;
        lights.forEach(function (l) { l.classList.remove('on', 'blinking'); });
        lampTestTimer = setInterval(function () {
            lights.forEach(function (l, i) { l.classList.toggle('on', step < 6 ? i === step % 3 : true); });
            step += 1;
            if (step > 8) {
                clearInterval(lampTestTimer);
                lampTestTimer = null;
                lights.forEach(function (l, i) { l.classList.toggle('on', saved[i].on); l.classList.toggle('blinking', saved[i].blinking); });
                if (stack) stack.classList.remove('nc-lamp-test');
            }
        }, 140);
    }

    function cycleNavcomSkin() {
        if (!document.body || !document.body.classList.contains('theme-navcom')) return null;
        var skin = currentSkin();
        var next = SKINS[(SKINS.indexOf(skin) + 1) % SKINS.length];
        write(SKIN_KEY, next);
        applySkin();
        showIndicator('Design: ' + SKIN_LABEL[next]);
        lampTest();
        return next;
    }

    function cycleNavcomDisplay() {
        if (!document.body || !document.body.classList.contains('theme-navcom')) return null;
        var skin = currentSkin();
        var list = DISPLAY_COLORS[skin];
        var next = list[(list.indexOf(currentDisplay(skin)) + 1) % list.length];
        write('ga_navcom_display_' + skin, next);
        applySkin();
        showIndicator('Anzeige: ' + DISPLAY_LABEL[next]);
        lampTest();
        var key = $('navcomTestBtn');
        if (key) { key.classList.add('active'); setTimeout(function () { key.classList.remove('active'); }, 700); }
        return next;
    }

    function updateWide() {
        var stack = stackEl();
        if (stack && stack.clientWidth) stack.classList.toggle('nc-wide', stack.clientWidth >= WIDE_MIN_PX);
    }

    function init() {
        var stack = stackEl();
        if (!stack) return;
        bindKnobs(stack);
        applySkin();
        if (typeof ResizeObserver === 'function') new ResizeObserver(function () { updateWide(); syncState(); }).observe(stack);
        else window.addEventListener('resize', updateWide);
        stack.addEventListener('input', function () { setTimeout(syncState, 0); }, true);
        stack.addEventListener('change', function () { setTimeout(syncState, 0); }, true);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncState);
        // Werte werden auch per Code gesetzt (Drag-Knöpfe, Cloud-Load, Missionsstart): leise nachziehen.
        setInterval(function () { if (!document.hidden) syncState(); }, 400);
        setInterval(function () {
            Array.prototype.forEach.call(document.querySelectorAll('#navcomInputs .nc-unit .reply'), function (r) {
                r.classList.add('on');
                setTimeout(function () { r.classList.remove('on'); }, 90);
            });
        }, 2400);
        var markers = stack.querySelector('.marker-lights');
        if (markers) {
            markers.setAttribute('role', 'button');
            markers.setAttribute('tabindex', '0');
            markers.setAttribute('title', 'Anzeigefarbe wechseln (Lampentest)');
            markers.addEventListener('click', cycleNavcomDisplay);
            markers.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleNavcomDisplay(); }
            });
        }
    }

    window.gaCycleNavcomSkin = cycleNavcomSkin;
    window.gaCycleNavcomDisplay = cycleNavcomDisplay;
    window.gaNavcomSkin = { current: currentSkin, apply: applySkin, lampTest: lampTest, sync: syncState };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
