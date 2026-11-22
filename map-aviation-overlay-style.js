// Customisable OpenAIP overlay in the web map table: airspace colours per
// category, border/fill transparency, line width, and an ICAO-style symbol set
// for airfields (instead of the yellow dots). Map rendering only: airspace
// warnings and the side drawer keep their own fixed colours.
(function (root) {
    'use strict';

    const STORAGE_KEY = 'ga_openaip_overlay_style_v1';

    // OpenAIP types: 0 other, 1 restricted, 2 danger, 3 prohibited, 4 CTR, 5 TMZ,
    // 6 RMZ, 7 TMA, 8 TRA, 9 TSA, 21 gliding sector, 26 CTA, 27/28 (legacy TMZ/RMZ
    // mapping of the map), 33 FIS. Controlled airspace (0, 7, 26) by ICAO class
    // (0 A ... 6 G), so single classes such as E can be hidden.
    const CLASSED_TYPES = [0, 7, 26];
    const AIRSPACE_CATEGORIES = Object.freeze([
        { id: 'prohibited', label: 'Verbotsgebiet (ED-P)', short: 'ED-P', color: '#ef4444', fill: 0.16, weight: 2, match: (t) => t === 3 },
        { id: 'restricted', label: 'ED-R / ED-D', short: 'ED-R', color: '#f97316', fill: 0.12, weight: 2, match: (t) => t === 1 || t === 2 },
        { id: 'ctr', label: 'CTR', short: 'CTR', color: '#3b82f6', fill: 0.10, weight: 2, match: (t) => t === 4 },
        { id: 'classC', label: 'Klasse A–C (TMA/CTA)', short: 'C', color: '#0ea5e9', fill: 0.08, weight: 1.8, match: (t, c) => CLASSED_TYPES.includes(t) && c >= 0 && c <= 2 },
        { id: 'classD', label: 'Klasse D', short: 'D', color: '#2563eb', fill: 0.08, weight: 1.8, match: (t, c) => CLASSED_TYPES.includes(t) && c === 3 },
        { id: 'classE', label: 'Klasse E', short: 'E', color: '#64748b', fill: 0.03, weight: 1.4, dash: '8,5', match: (t, c) => CLASSED_TYPES.includes(t) && c === 4 },
        { id: 'classFG', label: 'Klasse F / G', short: 'G', color: '#94a3b8', fill: 0.03, weight: 1.2, dash: '4,4', match: (t, c) => CLASSED_TYPES.includes(t) },
        { id: 'tmz', label: 'TMZ', short: 'TMZ', color: '#a855f7', fill: 0.08, weight: 1.6, dash: '5,4', match: (t) => t === 5 || t === 27 },
        { id: 'para', label: 'Fallschirm', short: 'PJA', color: '#f59e0b', fill: 0.10, weight: 1.6, dash: '3,3', match: (t, c, para) => (t === 6 || t === 28) && para },
        { id: 'rmz', label: 'RMZ', short: 'RMZ', color: '#a855f7', fill: 0.08, weight: 1.6, dash: '5,4', match: (t) => t === 6 || t === 28 },
        { id: 'glider', label: 'Segelflugsektor', short: 'GLD', color: '#16a34a', fill: 0.06, weight: 1.4, dash: '6,3', visible: false, match: (t) => t === 21 },
        { id: 'tra', label: 'TRA / TSA', short: 'TRA', color: '#db2777', fill: 0.06, weight: 1.4, dash: '6,3', visible: false, match: (t) => t === 8 || t === 9 },
        { id: 'fis', label: 'FIS / Sonstige', short: '', color: '#94a3b8', fill: 0.05, weight: 1.4, match: () => true }
    ]);
    const RENDERED_TYPES = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 21, 26, 27, 28, 33]);

    const DEFAULTS = Object.freeze({
        airspaces: Object.freeze(Object.fromEntries(AIRSPACE_CATEGORIES.map(c => [c.id, Object.freeze({ color: c.color, visible: c.visible !== false })]))),
        borderStyle: 'band',
        borderOpacity: 100,
        bandWidth: 10,
        bandOpacity: 35,
        fill: 100,
        lineWidth: 100,
        labels: true,
        labelSize: 100,
        labelMinZoom: 10,
        labelPlacement: 'border',
        vfrHandoff: true,
        vfrHandoffZoom: 12,
        vrpVisible: true,
        vrpColor: '#1d4ed8',
        vrpMinZoom: 9,
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
                visible: typeof value.visible === 'boolean' ? value.visible : category.visible !== false
            };
        });
        return {
            airspaces,
            borderStyle: stored.borderStyle === 'line' ? 'line' : 'band',
            borderOpacity: percent(stored.borderOpacity, DEFAULTS.borderOpacity, 0, 100),
            bandWidth: percent(stored.bandWidth, DEFAULTS.bandWidth, 2, 40),
            bandOpacity: percent(stored.bandOpacity, DEFAULTS.bandOpacity, 0, 100),
            fill: percent(stored.fill, DEFAULTS.fill, 0, 300),
            lineWidth: percent(stored.lineWidth, DEFAULTS.lineWidth, 50, 500),
            labels: stored.labels !== false,
            labelSize: percent(stored.labelSize, DEFAULTS.labelSize, 60, 220),
            labelMinZoom: percent(stored.labelMinZoom, DEFAULTS.labelMinZoom, 7, 14),
            labelPlacement: stored.labelPlacement === 'center' ? 'center' : 'border',
            vfrHandoff: stored.vfrHandoff !== false,
            vfrHandoffZoom: percent(stored.vfrHandoffZoom, DEFAULTS.vfrHandoffZoom, 9, 14),
            vrpVisible: stored.vrpVisible !== false,
            vrpColor: isColor(stored.vrpColor) ? stored.vrpColor.toLowerCase() : DEFAULTS.vrpColor,
            vrpMinZoom: percent(stored.vrpMinZoom, DEFAULTS.vrpMinZoom, 7, 14),
            airportSymbols: stored.airportSymbols === 'dots' ? 'dots' : 'icao',
            airportColor: isColor(stored.airportColor) ? stored.airportColor.toLowerCase() : DEFAULTS.airportColor,
            airportSize: percent(stored.airportSize, DEFAULTS.airportSize, 60, 300),
            airportLabels: stored.airportLabels !== false
        };
    }

    let cache = null;
    function settings() { if (!cache) cache = read(); return cache; }
    function save(next) { cache = next; storageSet(JSON.stringify(next)); }

    function categoryFor(airspace) {
        const type = Number(airspace && airspace.type);
        const icaoClass = Number(airspace && airspace.icaoClass);
        const para = /\bPARA\b/i.test(String(airspace && airspace.name || ''));
        return AIRSPACE_CATEGORIES.find(c => c.match(type, icaoClass, para));
    }

    // Leaflet path options for one airspace, or null when its category is hidden.
    function airspaceStyle(airspace) {
        const s = settings();
        const category = categoryFor(airspace);
        const chosen = s.airspaces[category.id];
        if (!chosen.visible) return null;
        return {
            category: category.id,
            color: chosen.color,
            opacity: s.borderOpacity / 100,
            weight: Math.round(category.weight * s.lineWidth) / 100,
            fillColor: chosen.color,
            fillOpacity: Math.min(0.9, category.fill * s.fill / 100),
            dashArray: category.dash || null,
            band: s.borderStyle === 'band' ? { width: s.bandWidth, opacity: s.bandOpacity / 100 } : null
        };
    }

    // ---- Border band: a wide, transparent stroke clipped to the inside of
    // the airspace (SVG clipPath that reuses the outline path via <use>).
    let clipCounter = 0;
    function airspaceLayers(L, latlngs, style, pane, tooltip) {
        const outline = L.polygon(latlngs, {
            pane, color: style.color, opacity: style.opacity, weight: style.weight,
            fillColor: style.fillColor, fillOpacity: style.fillOpacity, dashArray: style.dashArray,
            interactive: false
        });
        if (tooltip) outline.bindTooltip(tooltip, { sticky: true, className: 'airspace-tooltip' });
        if (!style.band || style.band.opacity <= 0) return [outline];
        const band = L.polygon(latlngs, {
            pane, color: style.color, opacity: Math.min(1, style.band.opacity * Math.max(style.opacity, 0.15)),
            weight: style.band.width * 2, fill: false, lineJoin: 'round', interactive: false
        });
        band.on('add', () => {
            const path = band._path;
            const source = outline._path;
            const svg = path && path.ownerSVGElement;
            if (!path || !source || !svg) return;
            clipCounter += 1;
            const id = 'ga-airspace-clip-' + clipCounter;
            if (!source.id) source.id = id + '-outline';
            let defs = svg.querySelector('defs');
            if (!defs) { defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); svg.insertBefore(defs, svg.firstChild); }
            const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
            clip.id = id;
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttribute('href', '#' + source.id);
            clip.appendChild(use);
            defs.appendChild(clip);
            path.setAttribute('clip-path', 'url(#' + id + ')');
            band._gaClip = clip;
        });
        band.on('remove', () => {
            if (band._gaClip && band._gaClip.parentNode) band._gaClip.parentNode.removeChild(band._gaClip);
            band._gaClip = null;
        });
        return [outline, band];
    }

    // ---- Labels: category or name plus vertical limits ----
    function formatLimit(limit) {
        if (!limit || limit.value === undefined || limit.value === null) return '?';
        const value = Number(limit.value);
        const unit = Number(limit.unit);
        const datum = Number(limit.referenceDatum);
        if (unit === 6) return 'FL' + String(Math.round(value)).padStart(3, '0').replace(/^0(?=\d{3})/, '');
        const feet = unit === 0 ? Math.round(value * 3.28084) : Math.round(value);
        if (datum === 0) return feet === 0 ? 'GND' : feet + ' AGL';
        return String(feet);
    }

    function airspaceLabel(airspace, category) {
        const name = String(airspace && airspace.name || '').replace(/\s+/g, ' ').trim();
        let title = category.short;
        if (['prohibited', 'restricted', 'tra', 'glider'].includes(category.id)) {
            const code = /^(ED|LS|LO|LF|EB|EH|EP|LK)[- ]?[RDP]\s*\d+[A-Z]?/i.exec(name);
            title = code ? code[0].toUpperCase().replace(/\s+/, ' ') : (name.slice(0, 20) || category.short);
        } else if (category.id === 'ctr') {
            title = 'CTR ' + name.replace(/\bCTR\b/i, '').trim().slice(0, 18);
        }
        const limits = formatLimit(airspace.lowerLimit) + '–' + formatLimit(airspace.upperLimit);
        return { title: title.trim(), limits };
    }

    // Area centroid of a ring (planar, fine at airspace scale).
    function ringCentroid(L, latlngs) {
        let area = 0, x = 0, y = 0;
        for (let i = 0, j = latlngs.length - 1; i < latlngs.length; j = i++) {
            const f = latlngs[j][1] * latlngs[i][0] - latlngs[i][1] * latlngs[j][0];
            area += f;
            x += (latlngs[j][1] + latlngs[i][1]) * f;
            y += (latlngs[j][0] + latlngs[i][0]) * f;
        }
        if (Math.abs(area) < 1e-12) return null;
        return L.latLng(y / (3 * area), x / (3 * area));
    }

    function pointInRing(point, ring) {
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const a = ring[i], b = ring[j];
            if ((a.y > point.y) !== (b.y > point.y)
                && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || 1e-9) + a.x) inside = !inside;
        }
        return inside;
    }

    // Point on the boundary nearest to the view centre, with the segment angle
    // and the inward normal (screen coordinates).
    function borderAnchor(ring, centre, width, height, margin) {
        let best = null;
        for (let i = 0; i < ring.length - 1; i++) {
            const a = ring[i], b = ring[i + 1];
            const dx = b.x - a.x, dy = b.y - a.y;
            const length2 = dx * dx + dy * dy;
            if (length2 < 400) continue;
            const t = Math.max(0.1, Math.min(0.9, ((centre.x - a.x) * dx + (centre.y - a.y) * dy) / length2));
            const p = { x: a.x + dx * t, y: a.y + dy * t };
            if (p.x < margin || p.y < margin || p.x > width - margin || p.y > height - margin) continue;
            const distance = (p.x - centre.x) ** 2 + (p.y - centre.y) ** 2;
            if (!best || distance < best.distance) best = { p, dx, dy, distance };
        }
        if (!best) return null;
        const length = Math.sqrt(best.dx * best.dx + best.dy * best.dy);
        let normal = { x: -best.dy / length, y: best.dx / length };
        if (!pointInRing({ x: best.p.x + normal.x * 6, y: best.p.y + normal.y * 6 }, ring)) normal = { x: -normal.x, y: -normal.y };
        let angle = Math.atan2(best.dy, best.dx) * 180 / Math.PI;
        if (angle > 90) angle -= 180;
        if (angle <= -90) angle += 180;
        return { p: best.p, normal, angle };
    }

    // Keeps the label markers inside the airspace layer group (toggles with the overlay).
    function updateAirspaceLabels(L, map, group, airspaces, pane) {
        if (!map || !group) return;
        (group._gaLabels || []).forEach(marker => group.removeLayer(marker));
        group._gaLabels = [];
        const s = settings();
        if (!s.labels || !Array.isArray(airspaces) || map.getZoom() < s.labelMinZoom) return;
        const size = map.getSize();
        const centre = { x: size.x / 2, y: size.y / 2 };
        const view = map.getBounds();
        const scale = s.labelSize / 100;
        const placed = [];
        const candidates = [];
        airspaces.forEach((airspace) => {
            const type = Number(airspace && airspace.type);
            if (!RENDERED_TYPES.includes(type) || type === 33) return;
            const style = airspaceStyle(airspace);
            if (!style) return;
            const geometry = airspace.geometry;
            const coords = geometry && (geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.type === 'MultiPolygon' ? geometry.coordinates[0][0] : null);
            if (!Array.isArray(coords) || coords.length < 3) return;
            const latlngs = coords.map(p => [Number(p[1]), Number(p[0])]).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
            const bounds = L.latLngBounds(latlngs);
            if (!view.intersects(bounds)) return;
            const ring = latlngs.map(ll => map.latLngToContainerPoint(ll));
            const xs = ring.map(p => p.x), ys = ring.map(p => p.y);
            const boxW = Math.max(...xs) - Math.min(...xs), boxH = Math.max(...ys) - Math.min(...ys);
            if (boxW < 50 || boxH < 30) return;
            const label = airspaceLabel(airspace, categoryFor(airspace));
            const textWidth = Math.max(label.title.length, label.limits.length) * 6.6 * scale + 12;
            const textHeight = 28 * scale;
            let anchorPoint = null, angle = 0;
            if (s.labelPlacement === 'border') {
                const anchor = borderAnchor(ring, centre, size.x, size.y, 24);
                if (!anchor) return;
                const offset = textHeight / 2 + 2;
                anchorPoint = { x: anchor.p.x + anchor.normal.x * offset, y: anchor.p.y + anchor.normal.y * offset };
                angle = anchor.angle;
            } else {
                const c = ringCentroid(L, latlngs) || bounds.getCenter();
                anchorPoint = map.latLngToContainerPoint(c);
                if (anchorPoint.x < 0 || anchorPoint.y < 0 || anchorPoint.x > size.x || anchorPoint.y > size.y) return;
            }
            const distance = (anchorPoint.x - centre.x) ** 2 + (anchorPoint.y - centre.y) ** 2;
            candidates.push({ airspace, style, label, anchorPoint, angle, textWidth, textHeight, distance });
        });
        candidates.sort((a, b) => a.distance - b.distance);
        candidates.forEach((candidate) => {
            if (group._gaLabels.length >= 60) return;
            // Simple collision check on the (unrotated) box radius.
            const radius = Math.max(candidate.textWidth, candidate.textHeight) / 2;
            if (placed.some(p => Math.hypot(p.x - candidate.anchorPoint.x, p.y - candidate.anchorPoint.y) < (p.r + radius) * 0.8)) return;
            placed.push({ x: candidate.anchorPoint.x, y: candidate.anchorPoint.y, r: radius });
            const marker = L.marker(map.containerPointToLatLng(L.point(candidate.anchorPoint.x, candidate.anchorPoint.y)), {
                pane, interactive: false, keyboard: false,
                icon: L.divIcon({
                    className: 'ga-airspace-label',
                    html: '<span style="--ga-airspace-color:' + candidate.style.color + ';font-size:' + Math.round(11 * scale * 10) / 10 + 'px;transform:translate(-50%,-50%) rotate(' + Math.round(candidate.angle) + 'deg)"><b>'
                        + escapeText(candidate.label.title) + '</b><i>' + escapeText(candidate.label.limits) + '</i></span>',
                    iconSize: null
                })
            });
            group.addLayer(marker);
            group._gaLabels.push(marker);
        });
    }

    // ---- VFR reporting points: open flightmaps (with type and aerodrome) where
    // published, OpenAIP names elsewhere. OFMA licence: attribution and a way
    // to report errors (popup link); not a primary navigation source.
    const OFM_POINTS_URL = './data/ofm-reporting-points.json';
    const OFM_ATTRIBUTION = 'Meldepunkte &copy; <a href="https://www.openflightmaps.org/" target="_blank" rel="noopener noreferrer">open flightmaps</a>';
    const KIND_LABEL = { compulsory: 'Pflichtmeldepunkt', request: 'Bedarfsmeldepunkt', enroute: 'Streckenmeldepunkt' };
    const ofmState = { points: null, promise: null, meta: null };

    function loadOfmPoints(onLoaded) {
        if (ofmState.points) return Promise.resolve(ofmState.points);
        if (!ofmState.promise) {
            ofmState.promise = fetch(OFM_POINTS_URL).then(r => r.ok ? r.json() : null).then((data) => {
                ofmState.points = data && Array.isArray(data.points) ? data.points : [];
                ofmState.meta = data ? { airac: data.airac, regions: data.regions } : null;
                if (typeof onLoaded === 'function') onLoaded();
                return ofmState.points;
            }).catch(() => { ofmState.points = []; return ofmState.points; });
        }
        return ofmState.promise;
    }

    function vrpSvg(kind, color, source) {
        const filled = kind === 'compulsory';
        const small = kind === 'enroute' || source === 'openaip';
        const points = small ? '14,7 20.5,19 7.5,19' : '14,5 22,20 6,20';
        return '<svg viewBox="0 0 28 28" width="100%" height="100%" aria-hidden="true"><polygon points="' + points + '" fill="' + (filled ? color : '#ffffff')
            + '" fill-opacity="' + (filled ? 1 : 0.85) + '" stroke="' + color + '" stroke-width="2.2" stroke-linejoin="round"/>'
            + (filled ? '' : '<circle cx="14" cy="15.5" r="1.8" fill="' + color + '"/>') + '</svg>';
    }

    function updateReportingPoints(L, map, overlayGroup, pane, openAipPoints) {
        if (!map || !overlayGroup) return;
        if (!overlayGroup._gaVrpLayer) {
            overlayGroup._gaVrpLayer = L.layerGroup();
            overlayGroup._gaVrpLayer.on('remove', function (event) {
                const layer = event.target;
                if (layer._gaAttribution && map.attributionControl) map.attributionControl.removeAttribution(OFM_ATTRIBUTION);
                layer._gaAttribution = false;
            });
            overlayGroup.addLayer(overlayGroup._gaVrpLayer);
        }
        const layer = overlayGroup._gaVrpLayer;
        layer.clearLayers();
        const s = settings();
        const attribution = map.attributionControl;
        const showOfm = (on) => {
            if (!attribution) return;
            if (on && !layer._gaAttribution) { attribution.addAttribution(OFM_ATTRIBUTION); layer._gaAttribution = true; }
            if (!on && layer._gaAttribution) { attribution.removeAttribution(OFM_ATTRIBUTION); layer._gaAttribution = false; }
        };
        if (!s.vrpVisible || map.getZoom() < s.vrpMinZoom) { showOfm(false); return; }
        if (!ofmState.points) {
            loadOfmPoints(() => updateReportingPoints(L, map, overlayGroup, pane, openAipPoints));
            return;
        }
        const view = map.getBounds().pad(0.05);
        const ofm = ofmState.points.filter(p => view.contains([p.lat, p.lon]));
        const near = (p) => ofm.some(o => Math.abs(o.lat - p.lat) < 0.02 && Math.abs(o.lon - p.lon) < 0.03);
        const fallback = (Array.isArray(openAipPoints) ? openAipPoints : [])
            .filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)) && view.contains([Number(p.lat), Number(p.lon)]) && !near(p))
            .map(p => ({ id: '', name: String(p.name || ''), kind: 'request', airport: '', lat: Number(p.lat), lon: Number(p.lon), source: 'openaip' }));
        const scale = s.airportSize / 100;
        const zoom = map.getZoom();
        const size = Math.round((zoom >= 11 ? 24 : 20) * scale);
        const entries = ofm.map(p => ({ ...p, source: 'ofm' })).concat(fallback).slice(0, 400);
        entries.forEach((point) => {
            const short = point.id || point.name;
            const label = zoom >= 10 && short
                ? '<span class="ga-vrp-label" style="color:' + s.vrpColor + '">' + escapeText(short.length > 10 ? short.slice(0, 10) : short) + '</span>' : '';
            const marker = L.marker([point.lat, point.lon], {
                pane, keyboard: false, bubblingMouseEvents: false,
                icon: L.divIcon({
                    className: 'ga-vrp-symbol',
                    html: '<span class="ga-airport-symbol-glyph" style="width:' + size + 'px;height:' + size + 'px">' + vrpSvg(point.kind, s.vrpColor, point.source) + '</span>' + label,
                    iconSize: [size, size], iconAnchor: [size / 2, size / 2]
                })
            });
            const kind = point.source === 'ofm' ? phrase(KIND_LABEL[point.kind] || 'Meldepunkt') : phrase('Meldepunkt');
            const lines = ['<b>' + escapeText(point.name || point.id) + (point.id && point.name && point.id !== point.name ? ' (' + escapeText(point.id) + ')' : '') + '</b>',
                escapeText(kind) + (point.airport ? ' · ' + escapeText(point.airport) : '')];
            lines.push(point.source === 'ofm'
                ? phrase('Quelle') + ': open flightmaps · <a href="https://www.openflightmaps.org/contact/" target="_blank" rel="noopener noreferrer">' + phrase('Fehler melden') + '</a>'
                : phrase('Quelle') + ': OpenAIP');
            lines.push('<small>' + phrase('Nicht zur realen Navigation verwenden.') + '</small>');
            marker.bindPopup(lines.join('<br>'), { className: 'ga-vrp-popup' });
            marker.bindTooltip(escapeText(point.name || point.id) + (point.airport ? ' · ' + escapeText(point.airport) : ''), { direction: 'top', offset: [0, -size / 2], className: 'airspace-tooltip' });
            layer.addLayer(marker);
        });
        showOfm(ofm.length > 0);
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

    function escapeText(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

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

        // Close in, the VFR overlay tiles show circuits and approach routes that
        // OpenAIP lacks: hide the OpenAIP drawing there and show those tiles.
        heading('Nahbereich');
        const handoff = input('checkbox', {}, (s) => s.vfrHandoff, (s, node) => { s.vfrHandoff = node.checked; });
        handoff.setAttribute('aria-label', phrase('Beim Reinzoomen auf VFR-Overlay umschalten'));
        line('Beim Reinzoomen auf VFR-Overlay umschalten', [handoff]).classList.add('ga-openaip-check-row');
        const handoffZoom = input('range', { min: '9', max: '14', step: '1' }, (s) => s.vfrHandoffZoom, (s, el) => { s.vfrHandoffZoom = Number(el.value); });
        handoffZoom.setAttribute('aria-label', phrase('Umschalten ab Zoomstufe'));
        const handoffZoomValue = valueLabel();
        handoffZoom._gaValue = handoffZoomValue;
        handoffZoom._gaUnit = '';
        line('Ab Zoomstufe', [handoffZoom, handoffZoomValue]);

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
        const select = (label, key, options) => {
            const node = input('select', {}, (s) => s[key], (s, el) => { s[key] = el.value; });
            options.forEach(([value, text]) => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = phrase(text);
                node.appendChild(option);
            });
            node.setAttribute('aria-label', phrase(label));
            line(label, [node]).classList.add('ga-openaip-select-row');
        };
        select('Randstil', 'borderStyle', [['band', 'Linie + Band innen'], ['line', 'Nur Linie']]);
        slider('Rand-Deckkraft', 'borderOpacity', 0, 100);
        slider('Linienstärke', 'lineWidth', 50, 500);
        const pxSlider = (label, key, min, max) => {
            const node = input('range', { min: String(min), max: String(max), step: '1' }, (s) => s[key], (s, el) => { s[key] = Number(el.value); });
            node.setAttribute('aria-label', phrase(label));
            const value = valueLabel();
            node._gaValue = value;
            node._gaUnit = ' px';
            line(label, [node, value]);
        };
        pxSlider('Bandbreite', 'bandWidth', 2, 40);
        slider('Band-Deckkraft', 'bandOpacity', 0, 100);
        slider('Füllung', 'fill', 0, 300);
        const airspaceLabels = input('checkbox', {}, (s) => s.labels, (s, node) => { s.labels = node.checked; });
        airspaceLabels.setAttribute('aria-label', phrase('Bezeichnung und Höhen'));
        line('Bezeichnung und Höhen', [airspaceLabels]).classList.add('ga-openaip-check-row');
        select('Beschriftung', 'labelPlacement', [['border', 'An der Grenzlinie'], ['center', 'In der Mitte']]);
        slider('Schriftgröße', 'labelSize', 60, 220);
        const zoomSlider = input('range', { min: '7', max: '14', step: '1' }, (s) => s.labelMinZoom, (s, el) => { s.labelMinZoom = Number(el.value); });
        zoomSlider.setAttribute('aria-label', phrase('Ab Zoomstufe'));
        const zoomValue = valueLabel();
        zoomSlider._gaValue = zoomValue;
        zoomSlider._gaUnit = '';
        line('Ab Zoomstufe', [zoomSlider, zoomValue]);

        heading('Meldepunkte');
        const vrpVisible = input('checkbox', {}, (s) => s.vrpVisible, (s, node) => { s.vrpVisible = node.checked; });
        vrpVisible.setAttribute('aria-label', phrase('Meldepunkte anzeigen'));
        const vrpColor = input('color', {}, (s) => s.vrpColor, (s, node) => { s.vrpColor = node.value; });
        vrpColor.setAttribute('aria-label', phrase('Farbe Meldepunkte'));
        line('Meldepunkte anzeigen', [vrpColor, vrpVisible]).classList.add('ga-openaip-airspace-row');
        const vrpZoom = input('range', { min: '7', max: '14', step: '1' }, (s) => s.vrpMinZoom, (s, el) => { s.vrpMinZoom = Number(el.value); });
        vrpZoom.setAttribute('aria-label', phrase('Meldepunkte ab Zoomstufe'));
        const vrpZoomValue = valueLabel();
        vrpZoom._gaValue = vrpZoomValue;
        vrpZoom._gaUnit = '';
        line('Ab Zoomstufe', [vrpZoom, vrpZoomValue]);

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
        slider('Symbolgröße', 'airportSize', 60, 300);
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
            controls.forEach(({ node }) => { if (node._gaValue) node._gaValue.textContent = node.value + (node._gaUnit || ' %'); });
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
        RENDERED_TYPES,
        DEFAULTS,
        airspaceLayers,
        airspaceLabel,
        categoryFor,
        formatLimit,
        updateAirspaceLabels,
        updateReportingPoints,
        loadOfmPoints,
        settings,
        airspaceStyle,
        airportKind,
        airportMarker,
        runwayHeading,
        symbolSvg,
        createPanel
    });
})(typeof window !== 'undefined' ? window : globalThis);
