/* ==========================================================================
   Glareshield (Analog + NavCom)
   - Seitlich wischen: Material (Carbon, Leder, Wildleder, Velours)
   - Außen über den Schrauben hoch/runter ziehen: Ränder stufenlos biegen
   - Mitte runterziehen bzw. Lasche: Liste der Design-Sets
   Aktiv nur bei body.theme-retro (Analog) und theme-navcom (NavCom, hat theme-retro mit).
   ========================================================================== */
(function () {
    'use strict';

    var MAT_KEY = 'ga_glare_mat', ARC_KEY = 'ga_glare_arc';
    var MATS = [['gs-carbon', 'CARBON'], ['gs-leder', 'LEDER'], ['gs-wild', 'WILDLEDER'], ['gs-velours', 'VELOURS']];
    var SETS = [
        { id: 'modern', slider: 0, name: 'Modern', sub: 'Helles, flaches Bedienfeld' },
        { id: 'analog', slider: 1, name: 'Analog', skins: [['classic', 'Klassik'], ['tower', 'Tower'], ['telex', 'Fernschreiber']], key: 'ga_analog_skin' },
        { id: 'navcom', slider: 2, name: 'NavCom', skins: [['classic', 'Klassik'], ['bendix', 'Bendix'], ['kx', 'KX 165']], key: 'ga_navcom_skin' },
        { id: 'ops1940', slider: 3, name: 'Ops 1940', sub: 'Messing und Olivlack' },
        { id: 'win95', slider: 4, name: 'Win95', sub: 'Fensteroptik mit Taskleiste' }
    ];
    // Geometrie (px): Eckradius, Ohrtiefe, Ohrbreite, Bogenansatz, Nahtabstand, Randzone
    var R = 24, DROP = 54, T = 20, S = 84, STITCH = 10, KAPPA = 0.552, EDGE = 72, FXH = 130;

    var container, glare, drawer, clip, tab, setsEl, screws = [];
    var built = false, idx = 0, arcK = 0, open = false, start = null, anim = 0, nameTimer = 0, peekTimer = 0, ro = null;

    function read(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
    function write(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
    function active() { return document.body && document.body.classList.contains('theme-retro'); }
    function currentSet() {
        var b = document.body.classList;
        if (b.contains('theme-navcom')) return 'navcom';
        if (b.contains('theme-retro')) return 'analog';
        if (b.contains('theme-ops1940')) return 'ops1940';
        if (b.contains('theme-win95')) return 'win95';
        return 'modern';
    }
    function H() { return glare ? glare.clientHeight || 46 : 46; }

    function noise(freq, oct, alpha, seed) {
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="' + freq +
            '" numOctaves="' + oct + '" seed="' + seed + '" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ' + alpha +
            ' 0"/></filter><rect width="200" height="200" filter="url(#n)"/></svg>';
        return 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';
    }

    /* ------------------------------------------------------------------ Aufbau */
    function build() {
        container = document.querySelector('.container');
        glare = container && container.querySelector('.glareshield');
        if (!glare) return false;
        var rs = document.documentElement.style;
        rs.setProperty('--gs-grain-coarse', noise(0.9, 3, 0.55, 4));
        rs.setProperty('--gs-grain-fine', noise(1.6, 2, 0.45, 9));

        glare.innerHTML = '<div class="gs-mats">' + MATS.map(function (m, i) { return '<div class="gs-mat ' + m[0] + (i === 0 ? ' on' : '') + '"></div>'; }).join('') + '</div>' +
            '<svg class="gs-fx" aria-hidden="true"><defs><clipPath id="gsClip"><path class="gs-clip-path"/></clipPath>' +
            // Zu den Seiten wird der breite Lichtverlauf fließend schwächer: dort wirkt die Kante wie ein kleinerer Radius
            '<linearGradient id="gsRollGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="480" y2="0">' +
            '<stop class="gs-rs0" offset="0" stop-color="#fff" stop-opacity=".22"/><stop class="gs-rs1" offset=".26" stop-color="#fff" stop-opacity="1"/>' +
            '<stop class="gs-rs2" offset=".74" stop-color="#fff" stop-opacity="1"/><stop class="gs-rs3" offset="1" stop-color="#fff" stop-opacity=".22"/></linearGradient>' +
            '<mask id="gsRollMask" maskUnits="userSpaceOnUse" x="-40" y="-40" width="4000" height="240"><rect class="gs-roll-mrect" x="-40" y="-40" width="4000" height="240" fill="url(#gsRollGrad)"/></mask></defs>' +
            '<g clip-path="url(#gsClip)"><path class="gs-edge-wide gs-bottom" fill="none" stroke="#000" stroke-opacity=".32" stroke-width="14"/>' +
            '<path class="gs-edge gs-bottom" fill="none" stroke="#000" stroke-opacity=".38" stroke-width="5"/>' +
            '<path class="gs-lip gs-bottom" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="1"/>' +
            // Gerundete Oberkante: weicher Lichtverlauf nach innen, heller Glanz, feine dunkle Silhouette
            '<g mask="url(#gsRollMask)"><path class="gs-roll" fill="none" stroke="#fff" stroke-opacity=".05" stroke-width="26" stroke-linejoin="round"/>' +
            '<path class="gs-roll" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="14" stroke-linejoin="round"/>' +
            '<path class="gs-roll" fill="none" stroke="#fff" stroke-opacity=".11" stroke-width="7" stroke-linejoin="round"/></g>' +
            '<path class="gs-roll gs-roll-shine" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="3.5" stroke-linejoin="round"/>' +
            '<path class="gs-roll" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="1.6" stroke-linejoin="round"/></g>' +
            '<path class="gs-stitch gs-bottom"/></svg>' +
            '<div class="gs-hit" aria-hidden="true"></div><div class="gs-name">CARBON</div>';
        glare.setAttribute('tabindex', '0');
        glare.setAttribute('role', 'button');
        glare.setAttribute('aria-label', 'Glareshield: nach unten ziehen für die Design-Sets, seitlich wischen für das Material, außen ziehen biegt die Ränder');
        glare.setAttribute('aria-expanded', 'false');

        clip = document.createElement('div');
        clip.className = 'gs-drawer-clip';
        clip.innerHTML = '<div class="gs-drawer" aria-hidden="true"><h2>Design-Set</h2><ul class="gs-sets"></ul>' +
            '<div class="gs-tips">' +
            '<div class="gs-tip"><span class="gs-mini-screw"></span><span><b>Schraube oben links:</b> Lackierung des Panels</span></div>' +
            '<div class="gs-tip"><span class="gs-mini-screw"></span><span><b>Schraube oben rechts:</b> Skin innerhalb des Sets</span></div>' +
            '<div class="gs-tip"><span class="gs-mini-swipe"></span><span><b>Glareshield seitlich wischen:</b> Carbon, Leder, Wildleder, Velours. Außen runterziehen biegt die Ränder.</span></div>' +
            '</div><button type="button" class="gs-close">SCHLIESSEN</button><span class="gs-tab" aria-hidden="true"></span></div>';
        glare.insertAdjacentElement('afterend', clip);
        drawer = clip.querySelector('.gs-drawer');
        tab = clip.querySelector('.gs-tab');
        setsEl = clip.querySelector('.gs-sets');
        screws = [].slice.call(container.querySelectorAll('.screw.top-left, .screw.top-right'));

        [glare, tab, drawer].forEach(function (el) { el.addEventListener('pointerdown', down); });
        [glare, tab].forEach(function (el) {
            el.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') peek(0); });
            el.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') peek(700); });
        });
        glare.addEventListener('pointermove', function (e) {
            if (!start && e.pointerType === 'mouse') glare.style.cursor = inEdge(e.clientX) ? 'ns-resize' : '';
        });
        glare.addEventListener('keydown', onKey);
        clip.querySelector('.gs-close').addEventListener('click', function () { setOpen(false); glare.focus(); });
        setsEl.addEventListener('click', onSetClick);
        setsEl.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { onSetClick(e); e.preventDefault(); }
        });

        var savedMat = parseInt(read(MAT_KEY), 10);
        setMaterial(savedMat >= 0 && savedMat < MATS.length ? savedMat : 0, 0, true);
        var savedK = parseFloat(read(ARC_KEY));
        arcK = savedK >= 0 && savedK <= 1 ? savedK : 0;
        if (window.ResizeObserver) { ro = new ResizeObserver(function () { buildArc(); }); ro.observe(glare); ro.observe(container); }
        else window.addEventListener('resize', buildArc);
        built = true;
        return true;
    }

    /* ------------------------------------------------------------- Material */
    function setMaterial(next, dir, silent) {
        var mats = glare.querySelectorAll('.gs-mat');
        next = (next + MATS.length) % MATS.length;
        [].forEach.call(mats, function (m, i) {
            m.classList.remove('from-l', 'from-r');
            if (i === next) {
                if (dir) { m.classList.add(dir > 0 ? 'from-r' : 'from-l'); void m.offsetWidth; }
                m.classList.add('on');
                m.classList.remove('from-l', 'from-r');
            } else m.classList.remove('on');
        });
        idx = next;
        container.dataset.gsMat = String(next);
        glare.querySelector('.gs-name').textContent = MATS[next][1];
        if (silent) return;
        container.classList.add('gs-naming');
        clearTimeout(nameTimer);
        nameTimer = setTimeout(function () { container.classList.remove('gs-naming'); }, 1100);
        write(MAT_KEY, String(next));
    }

    /* ---------------------------------------------------------- Randbiegung */
    function cubic(p0, p1, p2, p3, t) {
        var u = 1 - t;
        return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
    }
    function offset(pts, d) {
        return pts.map(function (p, i) {
            var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
            var tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
            return [p[0] + (ty / l) * d, p[1] - (tx / l) * d];
        });
    }
    function f1(v) { return Math.round(v * 10) / 10; }
    function line(pts) { return 'M' + pts.map(function (p) { return f1(p[0]) + ' ' + f1(p[1]); }).join('L'); }
    // Oberkante: bei k = 0 normale Ecke mit Radius r0, bei k = 1 der Bogen bis zur Tiefe dt
    function topPath(W, k, r0, dt, sArc, ox, oy) {
        var Dy = r0 + (dt - r0) * k, Sx = r0 + (sArc - r0) * k;
        ox = ox || 0; oy = oy || 0;
        return {
            start: [ox, oy + Dy],
            d: 'C' + ox + ' ' + f1(oy + Dy * (1 - KAPPA)) + ' ' + f1(ox + Sx * (1 - KAPPA)) + ' ' + oy + ' ' + f1(ox + Sx) + ' ' + oy +
                'L' + f1(ox + W - Sx) + ' ' + oy +
                'C' + f1(ox + W - Sx * (1 - KAPPA)) + ' ' + oy + ' ' + (ox + W) + ' ' + f1(oy + Dy * (1 - KAPPA)) + ' ' + (ox + W) + ' ' + f1(oy + Dy),
            Dy: Dy
        };
    }
    function buildArc() {
        if (!built || !active()) return;
        // Überstand zuerst setzen: er ändert die Breite des Glareshields (gerade bündig mit dem Rahmen,
        // wächst über die ersten 20 % der Biegung auf den vollen Wert)
        var ovMax = parseFloat(getComputedStyle(container).getPropertyValue('--gs-ov-max')) || 0;
        container.style.setProperty('--gs-ov', f1(ovMax * Math.min(1, arcK / 0.2)) + 'px');
        var W = Math.round(glare.clientWidth), h = H();
        if (!W) return;
        var D = h + DROP, k = arcK, r = T / 2, ry = r * k, Dt = D - r - h;
        var top = topPath(W, k, R, Dt, S);
        var topD = 'M' + top.start[0] + ' ' + f1(top.start[1]) + top.d;
        var by = h + (D - r - h) * k;
        var A = [[T, by], [T, h + (by - h) * 0.42], [T + (S - T) * 0.5, h], [S, h]];
        var pts = [], i;
        for (i = 0; i <= 40; i++) pts.push(cubic(A[0], A[1], A[2], A[3], i / 40));
        pts.push([W - S, h]);
        for (i = 40; i >= 0; i--) { var q = cubic(A[0], A[1], A[2], A[3], i / 40); pts.push([W - q[0], q[1]]); }
        var outline = topD + 'L' + W + ' ' + f1(by) + 'A' + r + ' ' + f1(ry) + ' 0 0 1 ' + (W - T) + ' ' + f1(by) +
            'C' + (W - A[1][0]) + ' ' + f1(A[1][1]) + ' ' + (W - A[2][0]) + ' ' + h + ' ' + (W - S) + ' ' + h +
            'L' + S + ' ' + h + 'C' + A[2][0] + ' ' + h + ' ' + A[1][0] + ' ' + f1(A[1][1]) + ' ' + T + ' ' + f1(by) +
            'A' + r + ' ' + f1(ry) + ' 0 0 1 0 ' + f1(by) + 'Z';
        container.style.setProperty('--gs-hit', "path('" + outline + "')");
        var fx = glare.querySelector('.gs-fx');
        fx.setAttribute('viewBox', '0 0 ' + W + ' ' + FXH);
        fx.querySelector('.gs-clip-path').setAttribute('d', outline);
        var edge = line(pts);
        fx.querySelector('.gs-edge-wide').setAttribute('d', edge);
        fx.querySelector('.gs-edge').setAttribute('d', edge);
        fx.querySelector('.gs-lip').setAttribute('d', line(offset(pts, 7)));
        var inset = 16 * (1 - k);
        fx.querySelector('.gs-stitch').setAttribute('d', line(offset(pts, STITCH).filter(function (p) { return p[0] >= inset - 0.01 && p[0] <= W - inset + 0.01; })));
        // Außenkontur für die Rundung: an den Seiten von der Unterkante hoch, über die Oberkante, wieder runter
        var rollD = 'M0 ' + f1(by) + 'L' + topD.slice(1) + 'L' + W + ' ' + f1(by);
        [].forEach.call(fx.querySelectorAll('.gs-roll'), function (p) { p.setAttribute('d', rollD); });
        var grad = fx.querySelector('#gsRollGrad'), edgeF = Math.min(0.45, (S + 40) / W);
        grad.setAttribute('x2', String(W));
        fx.querySelector('.gs-rs1').setAttribute('offset', edgeF.toFixed(3));
        fx.querySelector('.gs-rs2').setAttribute('offset', (1 - edgeF).toFixed(3));

        // Panel folgt oben genau der Kontur (Koordinaten des Glareshields, um seinen Abstand zur Box versetzt);
        // seitlich, oben und unten bleibt reichlich Platz, damit der Schatten nicht hart abgeschnitten wird
        if (k > 0) {
            var Hb = container.offsetHeight, Wb = container.offsetWidth, gx = glare.offsetLeft, M = 240;
            var top2 = topPath(W, k, R, Dt, S, gx, 0), y0 = f1(top2.start[1]);
            container.style.clipPath = "path('M" + (-M) + ' ' + (-M) + 'L' + gx + ' ' + (-M) + 'L' + gx + ' ' + y0 + top2.d +
                'L' + (gx + W) + ' ' + (-M) + 'L' + (Wb + M) + ' ' + (-M) + 'L' + (Wb + M) + ' ' + (Hb + M) + 'L' + (-M) + ' ' + (Hb + M) + "Z')";
        } else container.style.clipPath = '';
        container.style.setProperty('--gs-shift', f1(DROP * k) + 'px');
        container.classList.toggle('gs-arc', k > 0 || !!(start && start.edge && start.axis));
    }
    function setK(k) { arcK = Math.max(0, Math.min(1, k)); buildArc(); }
    function animateK(target) {
        cancelAnimationFrame(anim);
        var from = arcK, t0 = performance.now(), dur = 240;
        (function step(now) {
            var t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
            setK(from + (target - from) * e);
            if (t < 1) anim = requestAnimationFrame(step);
        })(t0);
        write(ARC_KEY, String(target));
    }
    function commitK() {
        var k = Math.round(arcK * 100) / 100;
        if (k < 0.03) k = 0; else if (k > 0.97) k = 1;
        if (k !== arcK) animateK(k); else { setK(k); write(ARC_KEY, String(k)); }
    }
    function inEdge(x) {
        var r = glare.getBoundingClientRect();
        return x - r.left < EDGE || r.right - x < EDGE;
    }

    /* ------------------------------------------------------------- Auszug */
    function drawerHeight() { return drawer.offsetHeight; }
    function setOpen(v) {
        open = !!v;
        if (open) renderSets();
        drawer.classList.remove('dragging');
        drawer.style.setProperty('--gs-pull', open ? drawerHeight() + 'px' : '0px');
        container.classList.toggle('gs-open', open);
        drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
        glare.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    function peek(ms) {
        clearTimeout(peekTimer);
        container.classList.add('gs-peek');
        if (ms) peekTimer = setTimeout(function () { container.classList.remove('gs-peek'); }, ms);
    }
    function renderSets() {
        var cur = currentSet();
        setsEl.innerHTML = SETS.map(function (s) {
            var sub = s.sub || '';
            if (s.skins) {
                var skin = read(s.key) || 'classic';
                sub = s.skins.map(function (k) {
                    return '<span class="gs-chip' + (cur === s.id && skin === k[0] ? ' on' : '') + '" data-skin="' + k[0] + '">' + k[1] + '</span>';
                }).join('');
            }
            return '<li class="gs-set' + (cur === s.id ? ' on' : '') + '" tabindex="0" data-set="' + s.id + '">' +
                '<span class="gs-sw ' + s.id + '"></span><span><strong>' + s.name + '</strong><small>' + sub + '</small></span><span class="gs-chk"></span></li>';
        }).join('');
    }
    function applySkin(set, skin) {
        var s = SETS.filter(function (x) { return x.id === set; })[0];
        if (!s || !s.key) return;
        write(s.key, skin);
        if (set === 'analog' && window.gaAnalogSkin) window.gaAnalogSkin.apply();
        if (set === 'navcom' && window.gaNavcomSkin) window.gaNavcomSkin.apply();
    }
    function onSetClick(e) {
        var li = e.target.closest('.gs-set');
        if (!li) return;
        var set = li.dataset.set, chip = e.target.closest('.gs-chip');
        var s = SETS.filter(function (x) { return x.id === set; })[0];
        if (chip) applySkin(set, chip.dataset.skin);
        if (currentSet() !== set && typeof window.changeThemeFromSlider === 'function') {
            var stays = set === 'analog' || set === 'navcom';
            if (!stays) setOpen(false);
            window.changeThemeFromSlider(s.slider);
            if (chip) applySkin(set, chip.dataset.skin);
        }
        if (open) renderSets();
    }

    /* -------------------------------------------------------------- Gesten */
    function down(e) {
        if (!active() || (e.pointerType === 'mouse' && e.button !== 0)) return;
        if (start && start.id === e.pointerId) return; // Lasche liegt im Auszug: nur einmal starten
        var el = e.currentTarget;
        start = { x: e.clientX, y: e.clientY, axis: null, el: el, id: e.pointerId,
            base: open ? drawerHeight() : 0, edge: el === glare && inEdge(e.clientX), k0: arcK };
    }
    function move(e) {
        if (!start || e.pointerId !== start.id) return;
        if (e.pointerType === 'mouse' && e.buttons === 0) { end(e); return; }
        var dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (!start.axis && Math.hypot(dx, dy) > 8) {
            start.axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
            if (start.el === drawer && start.axis === 'x') { start = null; return; }
        }
        if (start.axis === 'y' && start.edge) {
            cancelAnimationFrame(anim);
            setK(start.k0 + dy / DROP);
        } else if (start.axis === 'y') {
            var h = drawerHeight();
            drawer.classList.add('dragging');
            if (!open) renderSets();
            drawer.style.setProperty('--gs-pull', Math.max(0, Math.min(h, start.base + dy)) + 'px');
        }
        if (start.axis && e.cancelable) e.preventDefault();
    }
    function end(e) {
        if (!start || (e.pointerId !== undefined && e.pointerId !== start.id)) return;
        var s0 = start; start = null;
        var dx = e.clientX - s0.x, dy = e.clientY - s0.y;
        if (!s0.axis) {
            if (s0.el === tab) setOpen(!open);
            else if (s0.el === glare) { if (open) setOpen(false); else peek(2600); }
        } else if (s0.axis === 'y' && s0.edge) commitK();
        else if (s0.axis === 'y') {
            // weiter als 30 % aufgezogen fährt ganz aus, 30 % hochgeschoben schließt ganz
            var h = drawerHeight(), pull = Math.max(0, Math.min(h, s0.base + dy));
            setOpen(s0.base ? pull > h * 0.7 : pull > h * 0.3);
        } else if (s0.el === glare && Math.abs(dx) > 30) setMaterial(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    }
    function cancel() {
        if (!start) return;
        var s0 = start; start = null;
        if (s0.edge && s0.axis) commitK(); else setOpen(open);
    }
    function onKey(e) {
        if (e.key === 'ArrowRight') { setMaterial(idx + 1, 1); e.preventDefault(); }
        else if (e.key === 'ArrowLeft') { setMaterial(idx - 1, -1); e.preventDefault(); }
        else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { setOpen(e.key === 'ArrowDown' ? true : !open); e.preventDefault(); }
        else if (e.key === 'ArrowUp' || e.key === 'Escape') { setOpen(false); e.preventDefault(); }
    }

    /* ------------------------------------------------------- Theme-Wechsel */
    function sync() {
        if (!built && !build()) return;
        var on = active();
        container.classList.toggle('gs-on', on);
        if (on) {
            var cs = getComputedStyle(container);
            container.style.setProperty('--gs-bt', (parseFloat(cs.borderTopWidth) || 0) + 'px');
            container.style.setProperty('--gs-bl', (parseFloat(cs.borderLeftWidth) || 0) + 'px');
            container.style.setProperty('--gs-br', (parseFloat(cs.borderRightWidth) || 0) + 'px');
        }
        if (!on) {
            if (open) setOpen(false);
            container.style.clipPath = '';
            container.classList.remove('gs-arc', 'gs-peek');
            return;
        }
        buildArc();
        if (open) renderSets();
    }
    function init() {
        sync();
        new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
        window.addEventListener('pointermove', move, { passive: false });
        window.addEventListener('pointerup', end);
        window.addEventListener('pointercancel', cancel);
        window.addEventListener('blur', cancel);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) setOpen(false); });
    }

    window.gaGlareshield = { open: function () { setOpen(true); }, close: function () { setOpen(false); }, setBend: function (k) { setK(k); write(ARC_KEY, String(arcK)); }, setMaterial: function (i) { setMaterial(i, 1); } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
