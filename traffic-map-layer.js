// Traffic on the Leaflet map, shared by the web app (sync.js) and the EFB map
// (tracker-efb-kartentisch-host.js): symbols per class, warning colours and
// blinking, labels above a height-based shadow, ground traffic.
//
// Markers are keyed by the tracker id (SimConnect object id). Contacts without
// an id (old trackers) are matched to the nearest free marker.
// Needs map-live-presentation.js (window.GAMapLivePresentation). Settings come
// from map-display-controls.js (getTrafficIconSettings, getIconShadowSettings);
// window.vpTrafficAlertingIds lists the contacts the tracker warns about.
// Plain ES2017 (no optional chaining): the MSFS EFB browser loads this file as is.
(function(root) {
'use strict';
if (!root) return;

const MATCH_DEG = 0.025; // ~2 km, only for contacts without an id

const LEVEL_STYLE = {
    resolve:   { fill: '#ff3b30', opacity: 1,    size: 1.25, label: '#ff6b60' },
    alert:     { fill: '#ffb000', opacity: 1,    size: 1.15, label: '#ffb000' },
    proximate: { fill: '#00ccff', opacity: 0.95, size: 1,    label: '#e8f6ff' },
    other:     { fill: '#7fdcff', opacity: 0.8,  size: 0.9,  label: '#cfeaf5' },
    ground:    { fill: '#8a949c', opacity: 0.95, size: 0.8,  label: '#d5dbe0' }
};
const TEXT_OUTLINE = '-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000';
// Crew aircraft (crew live room): always green with a white edge and their call sign;
// a warning shows as an orange/red ring around the green symbol.
const CREW_STYLE = { fill: '#30d158', edge: '#ffffff', label: '#b9f6c8' };
function isCrew(ac) { return !!ac && (ac.crew === 1 || ac.crew === true); }

function num(v, fallback) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function esc(v) {
    return String(v).replace(/[&<>"']/g, function(c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}
function iconOptions() {
    const s = typeof root.getTrafficIconSettings === 'function' ? root.getTrafficIconSettings() : null;
    return { size: num(s && s.size, 28), outline: num(s && s.outline, 1.5) };
}
function labelsFor(ac, info) {
    const cs = isCrew(ac)
        ? [ac.cs, ac.nick && ac.nick !== ac.cs ? ac.nick : ''].filter(Boolean).join(' · ')
        : [ac.cs, ac.m].filter(Boolean).join(' · ');
    if (info.level === 'ground') return { alt: '', cs: cs };
    let alt = '';
    if (info.relAltFt != null) {
        const rounded = Math.round(info.relAltFt / 100) * 100;
        alt = (rounded >= 0 ? '+' : '') + rounded;
        const vs = num(ac.vs, 0);
        if (vs > 500) alt += '↑'; else if (vs < -500) alt += '↓';
    }
    return { alt: alt, cs: cs };
}
// Each contact's own height above ground (tracker v619+); older trackers:
// estimate with the terrain under the own aircraft.
function shadowFilter(ac, own) {
    const pres = root.GAMapLivePresentation;
    if (!ac || ac.gnd || !pres || !pres.iconShadowFilter) return '';
    const ground = own && Number.isFinite(own.groundFt) ? own.groundFt : 0;
    const agl = Number.isFinite(Number(ac.agl)) ? Number(ac.agl) : num(ac.alt, 0) - ground;
    return pres.iconShadowFilter(agl, typeof root.getIconShadowSettings === 'function' ? root.getIconShadowSettings() : null);
}
function zIndex(level) {
    return level === 'resolve' ? 6500 : level === 'alert' ? 6000 : level === 'ground' ? 4000 : 5000;
}
// Zoomed out: symbols shrink, labels and ground traffic go, overlapping contacts
// merge into one count marker. Warnings ("alert"/"resolve") are never shrunk,
// hidden or merged.
const DECLUTTER = { fullZoom: 11, minZoom: 9, minScale: 0.6, callsignZoom: 11, labelZoom: 10, groundZoom: 11, clusterZoom: 10, clusterPx: 40 };
function isWarning(level) { return level === 'alert' || level === 'resolve'; }
function zoomScale(zoom) {
    if (!Number.isFinite(zoom) || zoom >= DECLUTTER.fullZoom) return 1;
    if (zoom <= DECLUTTER.minZoom) return DECLUTTER.minScale;
    const t = (zoom - DECLUTTER.minZoom) / (DECLUTTER.fullZoom - DECLUTTER.minZoom);
    return Math.round((DECLUTTER.minScale + (1 - DECLUTTER.minScale) * t) * 10) / 10;
}
function clusterHtml(count, level) {
    const st = LEVEL_STYLE[level] || LEVEL_STYLE.other;
    return '<div class="trf-cluster" style="transform:translate(-50%,-50%);min-width:20px;height:20px;padding:0 5px;box-sizing:border-box;border-radius:10px;'
        + 'background:rgba(10,20,30,0.82);border:2px solid ' + st.fill + ';color:' + st.label + ';font:bold 11px/16px system-ui,sans-serif;text-align:center;'
        + 'box-shadow:0 0 0 1px #000;pointer-events:none;white-space:nowrap;">' + count + '</div>';
}
function iconHtml(hdg, level, labels, kind, shadow, scale, showLabels, crew) {
    const levelStyle = LEVEL_STYLE[level] || LEVEL_STYLE.other;
    const st = crew ? { fill: CREW_STYLE.fill, opacity: 1, size: Math.max(1, levelStyle.size), label: isWarning(level) ? levelStyle.label : CREW_STYLE.label } : levelStyle;
    const opts = iconOptions();
    const sc = isWarning(level) || crew ? 1 : (scale || 1);
    const size = Math.round(opts.size * st.size * sc);
    const labelPx = Math.max(8, Math.round(opts.size * 0.34));
    if (showLabels === false && !isWarning(level)) labels = { alt: '', cs: crew ? labels.cs : '' };
    const ring = crew && isWarning(level) ? 'border-radius:50%;box-shadow:0 0 0 3px ' + levelStyle.fill + ';' : '';
    const svg = root.GAMapLivePresentation.trafficSymbolSvg(kind, st.fill, size,
        'transform:rotate(' + hdg + 'deg);opacity:' + st.opacity + ';' + ring, opts.outline, crew ? CREW_STYLE.edge : null);
    // Labels sit above the shadow (position + z-index): no aircraft shades its own name.
    return '<div class="trf-wrap trf-' + level + '" style="position:relative; transform:translate(-50%,-' + Math.round(size / 2) + 'px); pointer-events:none; text-align:center; width:max-content;">'
        + '<div class="trf-shadow" style="position:relative; z-index:0;' + (shadow ? ' filter:' + shadow + ';' : '') + '">' + svg + '</div>'
        + '<div class="trf-alt" style="position:relative;z-index:1;font-size:' + (labelPx + 1) + 'px;font-weight:bold;color:' + st.label + ';text-shadow:' + TEXT_OUTLINE + ';line-height:1.15;white-space:nowrap;">' + esc(labels.alt) + '</div>'
        + '<div class="trf-cs" style="position:relative;z-index:1;font-size:' + labelPx + 'px;font-weight:600;color:' + st.label + ';text-shadow:' + TEXT_OUTLINE + ';line-height:1.1;white-space:nowrap;">' + esc(labels.cs) + '</div>'
        + '</div>';
}

// options: { map, L, getOwn() -> { lat, lon, alt, hdg, gs, vs, onGround, groundFt }, pane }
function createTrafficMapLayer(options) {
    const opts = options || {};
    let markers = {};
    let last = [];
    function leaflet() { return opts.L || root.L; }
    function clear() {
        Object.keys(markers).forEach(function(key) { try { markers[key].marker.remove(); } catch (_) {} });
        markers = {};
    }
    let zoomBound = null;
    function bindZoom(map) {
        if (zoomBound === map || typeof map.on !== 'function') return;
        zoomBound = map;
        map.on('zoomend', function() { refresh(); });
    }
    function place(key, latlng, html, z, renderKey, live) {
        const L = leaflet(), map = typeof opts.map === 'function' ? opts.map() : opts.map;
        const existing = markers[key];
        if (existing) {
            existing.lat = latlng[0]; existing.lon = latlng[1];
            existing.marker.setLatLng(latlng);
            if (existing.renderKey !== renderKey) {
                existing.renderKey = renderKey;
                existing.marker.setIcon(L.divIcon({ html: html(), className: 'traffic-marker', iconSize: [0, 0], iconAnchor: [0, 0] }));
                existing.marker.setZIndexOffset(z);
            } else if (live) live(existing.marker.getElement());
            return;
        }
        const markerOptions = { icon: L.divIcon({ html: html(), className: 'traffic-marker', iconSize: [0, 0], iconAnchor: [0, 0] }), interactive: false, zIndexOffset: z };
        if (opts.pane) markerOptions.pane = opts.pane;
        markers[key] = { marker: L.marker(latlng, markerOptions).addTo(map), lat: latlng[0], lon: latlng[1], renderKey: renderKey };
    }
    function update(aircraft) {
        const L = leaflet(), map = typeof opts.map === 'function' ? opts.map() : opts.map;
        const pres = root.GAMapLivePresentation;
        if (!map || !L || !pres) return;
        bindZoom(map);
        last = Array.isArray(aircraft) ? aircraft : [];
        const own = typeof opts.getOwn === 'function' ? (opts.getOwn() || {}) : {};
        const zoom = typeof map.getZoom === 'function' ? Number(map.getZoom()) : NaN;
        const scale = zoomScale(zoom);
        const showLabels = !Number.isFinite(zoom) || zoom >= DECLUTTER.labelZoom;
        const showCallsign = !Number.isFinite(zoom) || zoom >= DECLUTTER.callsignZoom;
        const showGround = !Number.isFinite(zoom) || zoom >= DECLUTTER.groundZoom;
        const clustering = Number.isFinite(zoom) && zoom < DECLUTTER.clusterZoom && typeof map.latLngToLayerPoint === 'function';
        const claimed = new Set();
        const entries = [];
        for (const ac of last) {
            if (!ac || !Number.isFinite(Number(ac.lat)) || !Number.isFinite(Number(ac.lon))) continue;
            const info = pres.classifyTraffic ? pres.classifyTraffic(ac, own) : { level: ac.gnd ? 'ground' : 'other', relAltFt: null };
            const level = pres.trafficDisplayLevel(ac, info, root.vpTrafficAlertingIds, root.vpTrafficLevels);
            if (level === 'ground' && !showGround) continue;
            let key = ac.id != null ? 'id:' + String(ac.id) : null;
            if (key && claimed.has(key)) continue; // duplicate id in one list
            if (!key) {
                let best = MATCH_DEG;
                Object.keys(markers).forEach(function(k) {
                    if (claimed.has(k) || k.indexOf('pos:') !== 0) return;
                    const d = Math.hypot(markers[k].lat - ac.lat, markers[k].lon - ac.lon);
                    if (d < best) { best = d; key = k; }
                });
                if (!key) key = 'pos:' + ac.lat + ',' + ac.lon + ':' + claimed.size;
            }
            claimed.add(key);
            entries.push({ key: key, ac: ac, info: info, level: level });
        }
        // Merge non-warning contacts that are closer than clusterPx on screen
        // (greedy around each group's centre), so chains do not split on a grid.
        const singles = [], groups = [];
        for (const e of entries) {
            if (!clustering || isWarning(e.level) || isCrew(e.ac)) { singles.push(e); continue; }
            const p = map.latLngToLayerPoint([e.ac.lat, e.ac.lon]);
            let hit = null;
            for (const g of groups) {
                if (Math.hypot(g.x - p.x, g.y - p.y) < DECLUTTER.clusterPx) { hit = g; break; }
            }
            if (!hit) { groups.push({ x: p.x, y: p.y, members: [e] }); continue; }
            hit.members.push(e);
            hit.x += (p.x - hit.x) / hit.members.length;
            hit.y += (p.y - hit.y) / hit.members.length;
        }
        const shown = new Set();
        const rank = { proximate: 3, other: 2, ground: 1 };
        groups.forEach(function(g) {
            const group = g.members;
            if (group.length === 1) { singles.push(group[0]); return; }
            const top = group.reduce(function(a, e) { return (rank[e.level] || 0) > (rank[a] || 0) ? e.level : a; }, 'ground');
            const lat = group.reduce(function(n, e) { return n + Number(e.ac.lat); }, 0) / group.length;
            const lon = group.reduce(function(n, e) { return n + Number(e.ac.lon); }, 0) / group.length;
            const key = 'cl:' + group.map(function(e) { return e.key; }).sort()[0];
            shown.add(key);
            place(key, [lat, lon], function() { return clusterHtml(group.length, top); }, 4500, 'cluster|' + group.length + '|' + top);
        });
        for (const e of singles) {
            const ac = e.ac, level = e.level;
            const labels = labelsFor(ac, e.info);
            const crew = isCrew(ac);
            if (!showCallsign && !isWarning(level) && !crew) labels.cs = '';
            if (!showLabels && !isWarning(level)) { labels.alt = ''; if (!crew) labels.cs = ''; }
            const hdg = num(ac.hdg, 0);
            const kind = pres.trafficSymbolKind(ac);
            const shadow = shadowFilter(ac, own);
            shown.add(e.key);
            const renderKey = level + '|' + kind + '|' + (isWarning(level) || crew ? 1 : scale) + '|' + (showLabels || isWarning(level)) + '|' + (showCallsign || isWarning(level) || crew) + '|' + (crew ? 'crew' : '');
            place(e.key, [ac.lat, ac.lon], function() { return iconHtml(hdg, level, labels, kind, shadow, scale, showLabels, crew); }, zIndex(level) + (crew ? 200 : 0), renderKey, function(el) {
                if (!el) return;
                const svgEl = el.querySelector('.trf-svg');
                if (svgEl) svgEl.style.transform = 'rotate(' + hdg + 'deg)';
                if (showLabels || isWarning(level) || crew) {
                    const altEl = el.querySelector('.trf-alt');
                    if (altEl) altEl.textContent = labels.alt;
                    const csEl = el.querySelector('.trf-cs');
                    if (csEl) csEl.textContent = labels.cs;
                }
                const shadowEl = el.querySelector('.trf-shadow');
                if (shadowEl && shadowEl.dataset.filter !== shadow) {
                    shadowEl.dataset.filter = shadow;
                    shadowEl.style.filter = shadow || '';
                }
            });
        }
        Object.keys(markers).forEach(function(key) {
            if (shown.has(key)) return;
            try { markers[key].marker.remove(); } catch (_) {}
            delete markers[key];
        });
    }
    // Settings changed (size, outline, shadow, alerting): redraw every symbol.
    function refresh(list) {
        Object.keys(markers).forEach(function(key) { markers[key].renderKey = null; });
        update(Array.isArray(list) ? list : last);
    }
    function count() { return Object.keys(markers).length; }
    return { update: update, clear: clear, refresh: refresh, count: count };
}

root.GATrafficMapLayer = { createTrafficMapLayer: createTrafficMapLayer, LEVEL_STYLE: LEVEL_STYLE, CREW_STYLE: CREW_STYLE, DECLUTTER: DECLUTTER, zoomScale: zoomScale, iconHtml: iconHtml };
})(typeof window !== 'undefined' ? window : null);
