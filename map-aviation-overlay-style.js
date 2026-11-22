// Customisable OpenAIP overlay in the web map table: airspace colours per
// category, border/fill transparency, line width, and an ICAO-style symbol set
// for airfields (instead of the yellow dots). Map rendering only: airspace
// warnings and the side drawer keep their own fixed colours.
(function (root) {
    'use strict';

    const STORAGE_KEY = 'ga_openaip_overlay_style_v1';

    // Categories follow the previous fixed map colours.
    const AIRSPACE_CATEGORIES = Object.freeze([
        { id: 'prohibited', label: 'Verbotsgebiet (ED-P)', types: [3], color: '#ef4444', fill: 0.16, weight: 2 },
        { id: 'restricted', label: 'ED-R / ED-D', types: [1, 2], color: '#f97316', fill: 0.12, weight: 2 },
        { id: 'ctr', label: 'CTR / Klassen C, D', types: [4, 0], color: '#3b82f6', fill: 0.10, weight: 2 },
        { id: 'tma', label: 'TMA / CTA', types: [7, 26], color: '#0ea5e9', fill: 0.08, weight: 1.6 },
        { id: 'tmz', label: 'TMZ', types: [5, 27], color: '#a855f7', fill: 0.08, weight: 1.6, dash: '5,4' },
        { id: 'rmz', label: 'RMZ', types: [6, 28], color: '#a855f7', fill: 0.08, weight: 1.6, dash: '5,4' },
        { id: 'para', label: 'Fallschirm', types: [6, 28], color: '#f59e0b', fill: 0.10, weight: 1.6, dash: '3,3', para: true },
        { id: 'fis', label: 'FIS / Sonstige', types: [33], color: '#94a3b8', fill: 0.05, weight: 1.4, other: true }
    ]);

    const DEFAULTS = Object.freeze({
        airspaces: Object.freeze(Object.fromEntries(AIRSPACE_CATEGORIES.map(c => [c.id, Object.freeze({ color: c.color, visible: true })]))),
        borderOpacity: 100,
        fill: 100,
        lineWidth: 100,
        airportSymbols: 'icao',
        airportColor: '#1d4ed8',
        airportSize: 100,
        airportLabels: true
    });

    function storageGet() { try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null; } }
    function storageSet(value) { try { localStorage.setItem(STORAGE_KEY, value); } catch (_) {} }
    const isColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
    const percent = (value, fallback, min, max) => Number.isFinite(Number(value))
        ? Math.max(min, Math.min(max, Math.round(Number(value)))) : fallback;

    function read() {
        let stored = {};
        try { stored = JSON.parse(storageGet() || '{}') || {}; } catch (_) { stored = {}; }
        const airspaces = {};
        AIRSPACE_CATEGORIES.forEach((category) => {
            const value = stored.airspaces && stored.airspaces[category.id] || {};
            airspaces[category.id] = {
                color: isColor(value.color) ? value.color.toLowerCase() : category.color,
                visible: value.visible !== false
            };
        });
        return {
            airspaces,
            borderOpacity: percent(stored.borderOpacity, DEFAULTS.borderOpacity, 0, 100),
            fill: percent(stored.fill, DEFAULTS.fill, 0, 300),
            lineWidth: percent(stored.lineWidth, DEFAULTS.lineWidth, 50, 250),
            airportSymbols: stored.airportSymbols === 'dots' ? 'dots' : 'icao',
            airportColor: isColor(stored.airportColor) ? stored.airportColor.toLowerCase() : DEFAULTS.airportColor,
            airportSize: percent(stored.airportSize, DEFAULTS.airportSize, 60, 180),
            airportLabels: stored.airportLabels !== false
        };
    }

    let cache = null;
    function settings() { if (!cache) cache = read(); return cache; }
    function save(next) { cache = next; storageSet(JSON.stringify(next)); }

    function categoryFor(airspace) {
        const type = Number(airspace && airspace.type);
        const para = /\bPARA\b/i.test(String(airspace && airspace.name || ''));
        return AIRSPACE_CATEGORIES.find(c => c.types.includes(type) && (c.para ? para : !(c.types.some(t => t === 6 || t === 28) && para)))
            || AIRSPACE_CATEGORIES.find(c => c.other);
    }

    // Leaflet path options for one airspace, or null when its category is hidden.
    function airspaceStyle(airspace) {
        const s = settings();
        const category = categoryFor(airspace);
        const chosen = s.airspaces[category.id];
        if (!chosen.visible) return null;
        return {
            color: chosen.color,
            opacity: s.borderOpacity / 100,
            weight: Math.round(category.weight * s.lineWidth) / 100,
            fillColor: chosen.color,
            fillOpacity: Math.min(0.9, category.fill * s.fill / 100),
            dashArray: category.dash || null
        };
    }

    // ---- Airfield symbols (simplified ICAO chart symbols) ----
    function airportKind(airport) {
        const type = Number(airport && (airport.type ?? airport.openAipType));
        if (type === 3 || type === 9) return 'intl';
        if (type === 1) return 'glider';
        if (type === 6) return 'ul';
        if (type === 4 || type === 7) return 'heli';
        if (type === 5) return 'military';
        if (type === 10) return 'water';
        if (type === 8) return 'closed';
        if (type === 11 || type === 12 || type === 13) return 'strip';
        return 'civil';
    }

    function runwayHeading(airport) {
        const runways = Array.isArray(airport && airport.runways) ? airport.runways.filter(Boolean) : [];
        const main = runways.find(r => r.mainRunway) || runways[0];
        if (!main) return null;
        const heading = Number(main.trueHeading ?? main.heading);
        if (Number.isFinite(heading)) return heading;
        const match = /^(\d{2})/.exec(String(main.designator || ''));
        return match ? Number(match[1]) * 10 : null;
    }

    const escapeText = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function symbolSvg(kind, color, heading) {
        const ring = '<circle cx="14" cy="14" r="8" fill="#ffffff" fill-opacity="0.9" stroke="' + color + '" stroke-width="2.4"/>';
        const runway = (length) => heading === null ? ''
            : '<rect x="12.6" y="' + (14 - length) + '" width="2.8" height="' + (length * 2) + '" rx="1" fill="' + color + '" transform="rotate(' + heading + ' 14 14)"/>';
        const text = t => '<text x="14" y="17.6" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="'
            + (t.length > 1 ? 8 : 10) + '" fill="' + color + '">' + t + '</text>';
        let inner = '';
        if (kind === 'intl') inner = runway(12.5);
        else if (kind === 'civil') inner = runway(10);
        else if (kind === 'glider') inner = '<path d="M7 15 Q14 10 21 15 M14 12.3 L14 18" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linecap="round"/>';
        else if (kind === 'ul') inner = text('UL');
        else if (kind === 'heli') inner = text('H');
        else if (kind === 'military') inner = runway(10)
            + ['M14 2.5 L14 5.5', 'M14 22.5 L14 25.5', 'M2.5 14 L5.5 14', 'M22.5 14 L25.5 14']
                .map(d => '<path d="' + d + '" stroke="' + color + '" stroke-width="2.2"/>').join('');
        else if (kind === 'water') inner = '<path d="M8.5 15 q1.4 -2 2.8 0 t2.8 0 t2.8 0 t2.8 0" fill="none" stroke="' + color + '" stroke-width="1.8"/>';
        else if (kind === 'closed') inner = '<path d="M9.5 9.5 L18.5 18.5 M18.5 9.5 L9.5 18.5" stroke="' + color + '" stroke-width="2.2"/>';
        else if (kind === 'strip') return '<svg viewBox="0 0 28 28" width="100%" height="100%" aria-hidden="true"><circle cx="14" cy="14" r="6.5" fill="#ffffff" fill-opacity="0.85" stroke="'
            + color + '" stroke-width="1.8" stroke-dasharray="2.5 2"/>' + runway(8) + '</svg>';
        return '<svg viewBox="0 0 28 28" width="100%" height="100%" aria-hidden="true">' + ring + inner + '</svg>';
    }

    // Marker for one airfield; the caller keeps tooltip and click handling.
    function airportMarker(L, latlng, airport, zoom, pane, className) {
        const s = settings();
        const scale = s.airportSize / 100;
        if (s.airportSymbols === 'dots') {
            return L.circleMarker(latlng, {
                pane, radius: (zoom >= 12 ? 7 : (zoom >= 10 ? 6.2 : 5.5)) * scale,
                color: s.airportColor === DEFAULTS.airportColor ? '#fde047' : s.airportColor,
                fillColor: '#07131d', fillOpacity: 0.96, weight: 2, className,
                interactive: true, bubblingMouseEvents: false
            });
        }
        const size = Math.round((zoom >= 12 ? 30 : (zoom >= 10 ? 26 : 22)) * scale);
        const icao = String(airport && (airport.icaoCode || airport.icao) || '').trim().toUpperCase();
        // Only real location indicators (EDTW), not internal OpenAIP ids (OA-...).
        const label = s.airportLabels && zoom >= 10 && /^[A-Z]{2}[A-Z0-9]{2}$/.test(icao)
            ? '<span class="ga-airport-symbol-label" style="color:' + s.airportColor + '">' + escapeText(icao) + '</span>' : '';
        const icon = L.divIcon({
            className: 'ga-airport-symbol ' + className,
            html: '<span class="ga-airport-symbol-glyph" style="width:' + size + 'px;height:' + size + 'px">'
                + symbolSvg(airportKind(airport), s.airportColor, runwayHeading(airport)) + '</span>' + label,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
        });
        return L.marker(latlng, { pane, icon, interactive: true, bubblingMouseEvents: false, keyboard: false });
    }

    function phrase(text) {
        return root.GAI18n && typeof root.GAI18n.phrase === 'function' ? root.GAI18n.phrase(text) : text;
    }

    // Collapsible settings panel for the layer menu (title toggle handled by
    // map-basemap-catalog.js group logic, key "openaip-style").
    function createPanel(createTitle, onChange) {
        const wrap = document.createElement('div');
        wrap.className = 'ga-vfr-style ga-openaip-style';
        const toggle = createTitle('OpenAIP: Darstellung anpassen', 'openaip-style');
        toggle.classList.add('ga-vfr-style-toggle');
        const panel = document.createElement('div');
        panel.className = 'ga-vfr-style-panel';
        wrap.appendChild(toggle);
        wrap.appendChild(panel);
        const controls = [];
        const changed = () => { const next = collect(); save(next); refreshValues(); onChange(next); };
        const heading = (text) => {
            const node = document.createElement('div');
            node.className = 'ga-vfr-style-heading';
            node.textContent = phrase(text);
            panel.appendChild(node);
        };
        const line = (label, inputs) => {
            const row = document.createElement('div');
            row.className = 'ga-vfr-style-row';
            const name = document.createElement('span');
            name.className = 'ga-vfr-style-name';
            name.textContent = phrase(label);
            row.appendChild(name);
            inputs.forEach(input => row.appendChild(input));
            panel.appendChild(row);
            return row;
        };
        const input = (type, attrs, read, write) => {
            const node = document.createElement(type === 'select' ? 'select' : 'input');
            if (type !== 'select') node.type = type;
            Object.keys(attrs || {}).forEach(key => { node[key] = attrs[key]; });
            node.addEventListener(type === 'checkbox' || type === 'select' ? 'change' : 'input', changed);
            controls.push({ node, read, write });
            return node;
        };
        const valueLabel = () => { const span = document.createElement('span'); span.className = 'ga-vfr-style-value'; return span; };

        heading('Lufträume');
        AIRSPACE_CATEGORIES.forEach((category) => {
            const visible = input('checkbox', { className: 'ga-openaip-visible' },
                (s) => s.airspaces[category.id].visible, (s, node) => { s.airspaces[category.id].visible = node.checked; });
            visible.setAttribute('aria-label', phrase(category.label) + ' ' + phrase('anzeigen'));
            const color = input('color', {}, (s) => s.airspaces[category.id].color, (s, node) => { s.airspaces[category.id].color = node.value; });
            color.setAttribute('aria-label', phrase(category.label));
            const row = line(category.label, [color, visible]);
            row.classList.add('ga-openaip-airspace-row');
        });
        const slider = (label, key, min, max) => {
            const node = input('range', { min: String(min), max: String(max), step: '5' }, (s) => s[key], (s, el) => { s[key] = Number(el.value); });
            node.setAttribute('aria-label', phrase(label));
            const value = valueLabel();
            node._gaValue = value;
            line(label, [node, value]);
        };
        slider('Rand-Deckkraft', 'borderOpacity', 0, 100);
        slider('Füllung', 'fill', 0, 300);
        slider('Linienstärke', 'lineWidth', 50, 250);

        heading('Flugplätze');
        const symbols = input('select', {}, (s) => s.airportSymbols, (s, node) => { s.airportSymbols = node.value; });
        [['icao', 'ICAO-Symbole'], ['dots', 'Punkte (bisher)']].forEach(([value, text]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = phrase(text);
            symbols.appendChild(option);
        });
        symbols.setAttribute('aria-label', phrase('Darstellung'));
        line('Darstellung', [symbols]).classList.add('ga-openaip-select-row');
        const airportColor = input('color', {}, (s) => s.airportColor, (s, node) => { s.airportColor = node.value; });
        airportColor.setAttribute('aria-label', phrase('Symbolfarbe'));
        line('Symbolfarbe', [airportColor]);
        slider('Symbolgröße', 'airportSize', 60, 180);
        const labels = input('checkbox', {}, (s) => s.airportLabels, (s, node) => { s.airportLabels = node.checked; });
        labels.setAttribute('aria-label', phrase('Kennung anzeigen'));
        line('Kennung anzeigen', [labels]).classList.add('ga-openaip-check-row');

        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'ga-vfr-style-reset';
        reset.textContent = phrase('Standard wiederherstellen');
        reset.addEventListener('click', () => {
            storageSet('{}');
            cache = null;
            load();
            onChange(settings());
        });
        panel.appendChild(reset);

        function collect() {
            const next = JSON.parse(JSON.stringify(settings()));
            controls.forEach(({ node, write }) => write(next, node));
            return next;
        }
        function refreshValues() {
            controls.forEach(({ node }) => { if (node._gaValue) node._gaValue.textContent = node.value + ' %'; });
        }
        function load() {
            const s = settings();
            controls.forEach(({ node, read }) => {
                const value = read(s);
                if (node.type === 'checkbox') node.checked = !!value;
                else node.value = String(value);
            });
            refreshValues();
        }
        load();
        if (root.L && root.L.DomEvent) {
            root.L.DomEvent.disableClickPropagation(wrap);
            root.L.DomEvent.disableScrollPropagation(wrap);
        }
        return wrap;
    }

    root.gaOpenAipOverlayStyle = Object.freeze({
        AIRSPACE_CATEGORIES,
        DEFAULTS,
        settings,
        airspaceStyle,
        airportKind,
        airportMarker,
        runwayHeading,
        symbolSvg,
        createPanel
    });
})(typeof window !== 'undefined' ? window : globalThis);
