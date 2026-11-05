/* Shared live map instruments. Geometry and styles are the standalone implementation. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.GAMapLivePresentation = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';
// Compare output at the live element, so replacement nodes and external edits
// cannot inherit a stale presentation cache. These reads do not measure layout.
const styleOutputs = new WeakMap();
function setText(node, value) {
    const text = String(value == null ? '' : value);
    if (node && node.textContent !== text) node.textContent = text;
}
function setAttribute(node, name, value) {
    const text = String(value);
    if (node && node.getAttribute(name) !== text) node.setAttribute(name, text);
}
function setStyle(node, name, value, priority = '') {
    if (!node) return;
    const style = node.style, text = String(value);
    const current = style.getPropertyValue(name);
    const outputs = styleOutputs.get(style);
    const last = outputs && outputs[name];
    if (style.getPropertyPriority(name) === priority && (current === text
        || (last && last.input === text && last.output === current))) return;
    style.setProperty(name, text, priority);
    const next = outputs || Object.create(null);
    next[name] = { input: text, output: style.getPropertyValue(name) };
    styleOutputs.set(style, next);
}
// Leaflet 1.9.4 still projects/clips every layer normally. Only its final SVG
// attribute write is deduplicated, per EFB renderer, including newly added paths.
function createEfbSvgRenderer(L, options) {
    const renderer = L.svg ? L.svg(options) : null;
    if (renderer && typeof renderer._setPath === 'function') {
        const write = renderer._setPath;
        renderer._setPath = function (layer, path) {
            if (layer._path && layer._path.getAttribute('d') === path) return;
            return write.call(this, layer, path);
        };
    }
    return renderer;
}
function aircraftHtml() { return `
        <div class="live-plane-inner" style="width: var(--plane-size); height: var(--plane-size); filter: drop-shadow(0 0 5px rgba(0,0,0,0.6)); position: relative; transform: translate(-50%, -37%);">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 447.74 339.91" style="transform-origin: 50% 37%; width: 100%; height: 100%; will-change: transform;">
                <path fill="var(--plane-color)" stroke="#000" stroke-width="16" stroke-linejoin="round" stroke-linecap="round" d="M447.22,118.14a2,2,0,0,0-1.48-.65H443a61.87,61.87,0,0,0-6.2-19.62,8.66,8.66,0,0,0-7.67-4.6H290.3a13.4,13.4,0,0,1-4.61-.81L259.8,83a10.84,10.84,0,0,1-7.09-8.94c-1.44-12.06-4.15-34.18-6.06-46.78a16.45,16.45,0,0,0-10.94-13.17c-.9-.31-1.81-.59-2.69-.82a1.94,1.94,0,0,1-1.4-1.37,29.46,29.46,0,0,0-5.37-10.72,3.45,3.45,0,0,0-5.28,0A29.37,29.37,0,0,0,215.6,12a2,2,0,0,1-1.4,1.37c-.88.23-1.79.51-2.69.82a16.46,16.46,0,0,0-10.95,13.17C198.67,39.84,196,62,194.51,74.09A10.84,10.84,0,0,1,187.42,83l-25.89,9.43a13.4,13.4,0,0,1-4.61.81H18a8.66,8.66,0,0,0-7.66,4.6,61.62,61.62,0,0,0-6.2,19.62H2a2,2,0,0,0-2,2.19l.63,6.83a2,2,0,0,0,2,1.82h.72v.33A71.32,71.32,0,0,0,6.5,150a49.32,49.32,0,0,0,8.4,16.31,5.49,5.49,0,0,0,4.28,2H196.94c.84,5.65,13.56,91.52,17.94,122h-50.2a11.94,11.94,0,0,0-11.92,11.92v13.57a11.94,11.94,0,0,0,11.92,11.92H224.5v11.4c0,.37.64.71,1,.71s1.1-.34,1.1-.71V327.8h59.82a11.94,11.94,0,0,0,11.92-11.92V302.31a11.94,11.94,0,0,0-11.92-11.92H232.34c4.38-30.49,17.1-116.36,17.93-122H428a5.53,5.53,0,0,0,4.29-2,49.32,49.32,0,0,0,8.4-16.31,71.64,71.64,0,0,0,3.14-21.38v-.33h1.24a2,2,0,0,0,2-1.82l.63-6.83A2,2,0,0,0,447.22,118.14Zm-4.62,1c0,.27.07.54.1.81l.09.87C442.74,120.3,442.67,119.74,442.6,119.19ZM443,123c0,.14,0,.29,0,.44s0,.58.05.86h0C443,123.9,443,123.46,443,123Zm.09,1.32v.06c0,.12,0,.24,0,.37C443.08,124.63,443.08,124.49,443.07,124.35Z"/>
            </svg>
            <div style="position:absolute; left:50%; top:37%; width:4px; height:4px; background:#000; border-radius:50%; transform:translate(-50%,-50%); pointer-events:none;"></div>
        </div>
    `; }
function createCompass(document) {
    let rotation = 0;
function buildCompassSvg() {
    const svg = document.getElementById('compassSvg');
    if (!svg || svg.childElementCount > 0) return;
    const CX = 150, CY = 150, NS = 'http://www.w3.org/2000/svg';

    function e(tag, attrs, text) {
        const el = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
        if (text != null) el.textContent = text;
        return el;
    }

    // ── Background ───────────────────────────────────────────────────────────
    svg.appendChild(e('circle', { cx: CX, cy: CY, r: 149,
        fill: 'rgba(2,5,10,0.97)', stroke: 'rgba(255,255,255,0.7)', 'stroke-width': 1.5 }));
    // Thin inner rings (HSI reference circles)
    svg.appendChild(e('circle', { cx: CX, cy: CY, r: 108,
        fill: 'none', stroke: 'rgba(255,255,255,0.12)', 'stroke-width': 0.8 }));
    svg.appendChild(e('circle', { cx: CX, cy: CY, r: 62,
        fill: 'none', stroke: 'rgba(255,255,255,0.08)', 'stroke-width': 0.8 }));

    // ── Tick marks + labels ───────────────────────────────────────────────────
    // Label graduation: every 30° (N/E/S/W + heading÷10 without zero-pad)
    const CARDS  = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
    const OR = 143; // outer ring radius

    for (let deg = 0; deg < 360; deg += 5) {
        const r = (deg - 90) * Math.PI / 180;
        const isCard = deg % 90 === 0;
        const is30   = !isCard && deg % 30 === 0;
        const is10   = !isCard && !is30 && deg % 10 === 0;

        // Tick sizes: cardinal 18 px, 30° 12 px, 10° 7 px, 5° 4 px
        const tLen    = isCard ? 18 : is30 ? 12 : is10 ? 7 : 4;
        const tStroke = isCard ? 2.2 : is30 ? 1.6 : is10 ? 1.0 : 0.7;
        const tColor  = '#ffffff';   // all ticks pure white like the reference

        svg.appendChild(e('line', {
            x1: (CX + OR * Math.cos(r)).toFixed(1),          y1: (CY + OR * Math.sin(r)).toFixed(1),
            x2: (CX + (OR - tLen) * Math.cos(r)).toFixed(1), y2: (CY + (OR - tLen) * Math.sin(r)).toFixed(1),
            stroke: tColor, 'stroke-width': tStroke,
            opacity: isCard ? 1 : is30 ? 0.9 : is10 ? 0.65 : 0.35
        }));

        // Labels only at every 30° (matches reference image graduation)
        if (deg % 30 === 0) {
            const lr = OR - tLen - (isCard ? 14 : 11);
            const lx = CX + lr * Math.cos(r), ly = CY + lr * Math.sin(r);
            // heading÷10 without leading zero for non-cardinals (3, 6, 12, 15 …)
            const label = CARDS[deg] || String(deg / 10);
            svg.appendChild(e('text', {
                x: lx.toFixed(1), y: ly.toFixed(1),
                'text-anchor': 'middle', 'dominant-baseline': 'middle',
                transform: `rotate(${deg},${lx.toFixed(1)},${ly.toFixed(1)})`,
                fill: deg === 0 ? '#ff4d4d' : '#ffffff',
                'font-size': isCard ? 21 : 14,
                'font-family': "'MS33558', 'Arial Narrow', Arial, sans-serif",
                'font-weight': isCard ? 'bold' : '600',
                'letter-spacing': isCard ? '0.5' : '0'
            }, label));
        }
    }

    // ── HDG bug (bearing to next WP, on outer ring at 12 o'clock before rotation) ──
    const bugG = e('g', { id: 'compassBugGroup', transform: `rotate(0,${CX},${CY})` });
    bugG.style.display = 'none';
    // Orange upward-pointing hollow triangle (apex toward disc centre)
    bugG.appendChild(e('polygon', { points: `${CX-10},30 ${CX+10},30 ${CX},8`,
        fill: 'none', stroke: '#f07800', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));
    svg.appendChild(bugG);

    // ── Aircraft symbol (fixed centre reference) ──────────────────────────────
    const ac = e('g', { 'pointer-events': 'none' });
    ac.appendChild(e('line',    { x1: CX, y1: CY - 18, x2: CX, y2: CY + 14, stroke: '#f0a800', 'stroke-width': 2.2 }));
    ac.appendChild(e('line',    { x1: CX - 18, y1: CY + 2, x2: CX + 18, y2: CY + 2, stroke: '#f0a800', 'stroke-width': 2.2 }));
    ac.appendChild(e('line',    { x1: CX - 7, y1: CY + 12, x2: CX + 7, y2: CY + 12, stroke: '#f0a800', 'stroke-width': 2 }));
    svg.appendChild(ac);

    // Centre dot
    svg.appendChild(e('circle', { cx: CX, cy: CY, r: 2.8, fill: 'rgba(180,205,230,0.55)' }));
}

// Update HDG bug + fixed CDI bar
// bearingToWp: bearing° to next WP (disc angle for bug)
// courseDeg:   planned track bearing° (unused – CDI is fixed horizontal)
// xteNm:       cross-track error in NM, positive = right of track
function updateInstruments(bearingToWp, courseDeg, xteNm) {
    const bugG = document.getElementById('compassBugGroup');
    if (bugG) {
        setAttribute(bugG, 'transform', `rotate(${bearingToWp},150,150)`);
        setStyle(bugG, 'display', '');
    }

    const cdiBar = document.getElementById('compassCdiBarFixed');
    if (cdiBar) {
        const MAX_PX = 44, FULL_NM = 2.0;
        // positive xte (right of track) → CDI deflects left (negative x)
        const offset = Math.max(-MAX_PX, Math.min(MAX_PX, -(xteNm / FULL_NM) * MAX_PX));
        setAttribute(cdiBar, 'x1', offset.toFixed(1));
        setAttribute(cdiBar, 'x2', offset.toFixed(1));
        const cdiSvg = document.getElementById('compassCdiSvg');
        setStyle(cdiSvg, 'display', '');
        const cdiGroup = document.getElementById('compassCdiGroup');
        setStyle(cdiGroup, 'display', '');
    }
};

function buildCompassFixed() {
    const svg = document.getElementById('compassCdiSvg');
    if (!svg || svg.childElementCount > 0) return;
    const NS = 'http://www.w3.org/2000/svg';
    function e(tag, attrs, text) {
        const el = document.createElementNS(NS, tag);
        for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
        if (text != null) el.textContent = text;
        return el;
    }
    const cdiGroup = e('g', { id: 'compassCdiGroup' });
    cdiGroup.style.display = 'none';
    svg.appendChild(cdiGroup);
    // Background pill
    cdiGroup.appendChild(e('rect', { x: -52, y: -12, width: 104, height: 24, rx: 5,
        fill: 'rgba(2,5,10,0.82)', stroke: 'rgba(255,255,255,0.18)', 'stroke-width': 1 }));
    // Centre track line (thin, white)
    cdiGroup.appendChild(e('line', { x1: 0, y1: -8, x2: 0, y2: 8,
        stroke: 'rgba(255,255,255,0.35)', 'stroke-width': 1.2, 'stroke-dasharray': '3 2' }));
    // Scale dots at ±22 and ±44 px
    for (const dx of [-44, -22, 22, 44]) {
        cdiGroup.appendChild(e('circle', { cx: dx, cy: 0, r: 2.5,
            fill: 'none', stroke: 'rgba(255,255,255,0.45)', 'stroke-width': 1.5 }));
    }
    // CDI bar (vertical, moves horizontally)
    cdiGroup.appendChild(e('line', { id: 'compassCdiBarFixed', x1: 0, y1: -10, x2: 0, y2: 10,
        stroke: '#ccd8ea', 'stroke-width': 3.5, 'stroke-linecap': 'round' }));
    // Heading readout below CDI strip — DSEG7 7-segment LED font
    svg.appendChild(e('text', { id: 'compassHdgReadout', x: 0, y: 25,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        fill: '#f5e97a', 'font-size': 15, 'font-family': "'DSEG7', 'Courier New', monospace",
        'font-weight': 'bold', 'letter-spacing': '2' }, '---°'));
    svg.style.display = 'none';
}


    function updateHeading(heading) {
        if (heading == null || !Number.isFinite(Number(heading))) return;
        const disc = document.getElementById('compassDisc');
        if (!disc) return;
        rotation += ((-Number(heading) - rotation) % 360 + 540) % 360 - 180;
        setStyle(disc, 'transform', `rotate(${rotation}deg)`);
        const text = document.getElementById('compassHdgReadout');
        const headingSvg = document.getElementById('compassCdiSvg');
        setStyle(headingSvg, 'display', '');
        setText(text, ('00' + ((Math.round(heading) % 360 + 360) % 360)).slice(-3) + '°');
    }
    return { buildRose: buildCompassSvg, buildFixed: buildCompassFixed,
        updateHeading, updateInstruments };
}
function filterTraffic(aircraft, own) {
    return aircraft.filter(function(ac) {
        const dLat = Math.abs((ac.lat == null ? 0 : ac.lat) - own.lat);
        const dLon = Math.abs((ac.lon == null ? 0 : ac.lon) - own.lon);
        if (dLat < 0.0015 && dLon < 0.0015) return false;
        const dAlt = Math.abs((ac.alt == null ? 0 : ac.alt) - own.alt);
        const nearBy = dLat < 0.08 && dLon < 0.08;
        if (!nearBy && dAlt > 5000) return false;
        return true;
    });
}
// Traffic levels for map and profile:
// 'ground'    aircraft on the ground: shown, never warned about
// 'alert'     close now or on a converging path within 40 s, vertically close
// 'proximate' within 6 NM and 1200 ft
// 'other'     everything else in range
const TRAFFIC_ALERT = { nowNm: 1.0, cpaNm: 0.5, cpaSec: 40, altFt: 600 };
const TRAFFIC_PROXIMATE = { nm: 6, altFt: 1200 };
function trafficVelocityNmPerSec(hdg, gs) {
    const rad = (Number(hdg) || 0) * Math.PI / 180, speed = (Number(gs) || 0) / 3600;
    return { x: Math.sin(rad) * speed, y: Math.cos(rad) * speed };
}
function classifyTraffic(ac, own) {
    if (!ac || ac.gnd) return { level: 'ground', distNm: null, relAltFt: null };
    if (!own || !Number.isFinite(Number(own.lat)) || !Number.isFinite(Number(own.lon))) {
        return { level: 'other', distNm: null, relAltFt: null };
    }
    const cosLat = Math.cos(Number(own.lat) * Math.PI / 180);
    const rx = (Number(ac.lon) - Number(own.lon)) * 60 * cosLat, ry = (Number(ac.lat) - Number(own.lat)) * 60;
    const distNm = Math.hypot(rx, ry);
    const relAltFt = Number.isFinite(Number(own.alt)) ? Number(ac.alt) - Number(own.alt) : null;
    // No warnings while the own aircraft sits on the ground.
    if (own.onGround || relAltFt == null) return { level: 'other', distNm, relAltFt };
    const absAlt = Math.abs(relAltFt);
    if (distNm <= TRAFFIC_ALERT.nowNm && absAlt <= TRAFFIC_ALERT.altFt) return { level: 'alert', distNm, relAltFt };
    const va = trafficVelocityNmPerSec(ac.hdg, ac.gs), vo = trafficVelocityNmPerSec(own.hdg, own.gs);
    const vx = va.x - vo.x, vy = va.y - vo.y, v2 = vx * vx + vy * vy;
    if (v2 > 1e-9) {
        const tCpa = -(rx * vx + ry * vy) / v2;
        if (tCpa > 0 && tCpa <= TRAFFIC_ALERT.cpaSec) {
            const cpaNm = Math.hypot(rx + vx * tCpa, ry + vy * tCpa);
            const altAtCpa = relAltFt + ((Number(ac.vs) || 0) - (Number(own.vs) || 0)) * tCpa / 60;
            if (cpaNm <= TRAFFIC_ALERT.cpaNm && Math.min(absAlt, Math.abs(altAtCpa)) <= TRAFFIC_ALERT.altFt) {
                return { level: 'alert', distNm, relAltFt };
            }
        }
    }
    if (distNm <= TRAFFIC_PROXIMATE.nm && absAlt <= TRAFFIC_PROXIMATE.altFt) return { level: 'proximate', distNm, relAltFt };
    return { level: 'other', distNm, relAltFt };
}
// Top-down traffic symbols, nose up, drawn in a -16..16 box.
// Kinds come from the tracker: heli, single, twin, jet, heavy ('' = unknown -> single).
// body: filled in the traffic colour with a black outline; detail: darker
// windows/intakes on top; rotor: translucent disc and blades (helicopter only).
const TRAFFIC_SYMBOLS = {
    single: {
        body: [
            // high-wing single (C172-like): tapered wing, slim fuselage, tailplane
            'M-15.4-4.8H15.4Q16-4.8 16-4.2L15.8-2.2Q15.7-1.6 15-1.6L2-.2H-2L-15-1.6Q-15.7-1.6-15.8-2.2L-16-4.2Q-16-4.8-15.4-4.8Z',
            'M0-11.6C1.2-11.6 1.9-10.6 2-9L2.1-4C2.1-1 1.6 3 .9 8L.7 12.2H-.7L-.9 8C-1.6 3-2.1-1-2.1-4L-2-9C-1.9-10.6-1.2-11.6 0-11.6Z',
            'M-5.8 8.6H5.8Q6.4 8.6 6.4 9.2L6.2 10.6Q6.1 11.2 5.5 11.2H-5.5Q-6.1 11.2-6.2 10.6L-6.4 9.2Q-6.4 8.6-5.8 8.6Z'
        ],
        detail: ['M-1.5-8.4Q0-9.3 1.5-8.4L1.7-6.4H-1.7Z']
    },
    twin: {
        body: [
            // light twin (DA62/Baron-like): nacelles ahead of the wing, long nose
            'M-15-4H15Q15.6-4 15.6-3.4L15.4-1.4Q15.3-.8 14.6-.8L2 .8H-2L-14.6-.8Q-15.3-.8-15.4-1.4L-15.6-3.4Q-15.6-4-15-4Z',
            'M6-8.6Q7.4-8.6 7.4-6.9V1.8Q7.4 2.8 6 2.8T4.6 1.8V-6.9Q4.6-8.6 6-8.6Z',
            'M-6-8.6Q-4.6-8.6-4.6-6.9V1.8Q-4.6 2.8-6 2.8T-7.4 1.8V-6.9Q-7.4-8.6-6-8.6Z',
            'M0-13.4C1.1-13.4 1.8-12.2 1.9-10.4L2-4C2-.5 1.5 4 .8 9L.6 12.8H-.6L-.8 9C-1.5 4-2-.5-2-4L-1.9-10.4C-1.8-12.2-1.1-13.4 0-13.4Z',
            'M-5.6 9.8H5.6Q6.2 9.8 6.2 10.4L6 11.6Q5.9 12.2 5.3 12.2H-5.3Q-5.9 12.2-6 11.6L-6.2 10.4Q-6.2 9.8-5.6 9.8Z'
        ],
        detail: ['M-1.4-9.6Q0-10.5 1.4-9.6L1.6-7.6H-1.6Z']
    },
    jet: {
        body: [
            // swept wing jet with underwing engines
            'M1.8-3.2 15 3.6Q15.6 4 15.4 4.6L15.1 5.4 1.8 3.4ZM-1.8-3.2-15 3.6Q-15.6 4-15.4 4.6L-15.1 5.4-1.8 3.4Z',
            'M1 9.6 6.4 12.6Q6.9 12.9 6.7 13.3L6.5 13.8 1 12.8ZM-1 9.6-6.4 12.6Q-6.9 12.9-6.7 13.3L-6.5 13.8-1 12.8Z',
            'M0-15.6C1.3-15.6 2-14 2-12V9C2 11 1.3 13 .6 15.2H-.6C-1.3 13-2 11-2 9V-12C-2-14-1.3-15.6 0-15.6Z',
            'M6.2-3.4Q7.4-3.4 7.4-2.2V1.4H5V-2.2Q5-3.4 6.2-3.4ZM-6.2-3.4Q-5-3.4-5-2.2V1.4H-7.4V-2.2Q-7.4-3.4-6.2-3.4Z'
        ],
        detail: ['M-1.3-13.2Q0-14 1.3-13.2L1.5-12H-1.5Z', 'M5.5-3H6.9V-2.2H5.5ZM-6.9-3H-5.5V-2.2H-6.9Z']
    },
    heavy: {
        body: [
            // wide-body: broader fuselage, longer swept wing, two engines per side
            'M2.4-3.6 15.6 3.4Q16.1 3.8 15.9 4.4L15.6 5.2 2.4 3ZM-2.4-3.6-15.6 3.4Q-16.1 3.8-15.9 4.4L-15.6 5.2-2.4 3Z',
            'M1.4 9.4 7 12.4Q7.5 12.7 7.3 13.1L7.1 13.6 1.4 12.6ZM-1.4 9.4-7 12.4Q-7.5 12.7-7.3 13.1L-7.1 13.6-1.4 12.6Z',
            'M0-15.6C1.8-15.6 2.6-13.8 2.6-11.6V8.6C2.6 11 1.6 13 .7 15.3H-.7C-1.6 13-2.6 11-2.6 8.6V-11.6C-2.6-13.8-1.8-15.6 0-15.6Z',
            'M6-2.8Q7-2.8 7-1.8V1.2H5V-1.8Q5-2.8 6-2.8ZM-6-2.8Q-5-2.8-5-1.8V1.2H-7V-1.8Q-7-2.8-6-2.8Z',
            'M10.6-.4Q11.6-.4 11.6.6V3.4H9.6V.6Q9.6-.4 10.6-.4ZM-10.6-.4Q-9.6-.4-9.6.6V3.4H-11.6V.6Q-11.6-.4-10.6-.4Z'
        ],
        detail: ['M-1.7-13.2Q0-14.1 1.7-13.2L1.9-12H-1.9Z']
    },
    heli: {
        body: [
            // EC135-like: teardrop cabin, tail boom, stabiliser, fenestron fin
            'M0-9C2.6-9 3.4-6.5 3.4-3.5S2.2 1.8 0 1.8-3.4-.5-3.4-3.5-2.6-9 0-9Z',
            'M-.8 1.2H.8L.6 12H-.6Z',
            'M-3.2 8.2H3.2V9.6H-3.2Z',
            'M-1 11.4H1L1.2 14H-1.2Z'
        ],
        detail: ['M-2.2-6.6Q0-8.4 2.2-6.6L2.5-4.8H-2.5Z'],
        rotor: { cx: 0, cy: -3.5, r: 12.4 }
    }
};
function trafficSymbolKind(ac) {
    const k = ac && ac.k;
    return TRAFFIC_SYMBOLS[k] ? k : 'single';
}
// outlinePx is the visible black edge in screen pixels, independent of size.
function trafficSymbolSvg(kind, fill, sizePx, extraStyle, outlinePx) {
    const sym = TRAFFIC_SYMBOLS[kind] || TRAFFIC_SYMBOLS.single;
    const scale = kind === 'heavy' ? 1.25 : 1;
    const size = Math.round((sizePx || 22) * scale);
    const edgePx = Number.isFinite(Number(outlinePx)) ? Math.max(0, Number(outlinePx)) : 1.5;
    // paint-order puts the stroke under the fill, so only half of it shows.
    const stroke = (edgePx * 2 * 32 / size).toFixed(2);
    let rotor = '';
    if (sym.rotor) {
        const r = sym.rotor;
        const blade = (deg) => '<rect x="-.4" y="' + (r.cy - r.r) + '" width=".8" height="' + (2 * r.r) + '" rx=".4"'
            + ' transform="rotate(' + deg + ' ' + r.cx + ' ' + r.cy + ')"/>';
        rotor = '<circle cx="' + r.cx + '" cy="' + r.cy + '" r="' + r.r + '" fill="' + fill + '" fill-opacity="0.18"'
            + ' stroke="#000" stroke-opacity="0.55" stroke-width="' + (stroke / 2).toFixed(2) + '"/>'
            + '<g fill="' + fill + '" fill-opacity="0.85" stroke="#000" stroke-opacity="0.7" stroke-width="' + (stroke * 0.6).toFixed(2) + '" paint-order="stroke">' + blade(45) + blade(-45) + '</g>';
    }
    return '<svg class="trf-svg" viewBox="-16 -16 32 32" width="' + size + '" height="' + size + '"'
        + ' style="display:block;margin:0 auto;overflow:visible;' + (extraStyle || '') + '">'
        + '<g fill="' + fill + '" stroke="#000" stroke-width="' + stroke + '" stroke-linejoin="round" paint-order="stroke">'
        + sym.body.map(function(d) { return '<path d="' + d + '"/>'; }).join('')
        + '</g>'
        + '<g fill="#000" fill-opacity="0.38">' + (sym.detail || []).map(function(d) { return '<path d="' + d + '"/>'; }).join('') + '</g>'
        + rotor
        + '</svg>';
}
// Standalone live breadcrumb: skip movement <=20 m, trim 12000 to 8000.
const DIRECT_LINE_STYLE = { color: '#ff3fd9', weight: 2, opacity: 0.9, interactive: false };
const TRAIL_STYLE = { color: '#1a4bb3', weight: 3, opacity: 0.7, dashArray: '5, 10', interactive: false };
function appendTrailPoint(points, lat, lon, distance) {
    const point = [Number(lat), Number(lon)];
    if (!point.every(Number.isFinite)) return null;
    const previous = points[points.length - 1];
    if (previous && distance(previous, point) <= 20) return null;
    points.push(point);
    return points.length > 12000 ? points.slice(-8000) : points;
}
function restoreTrail(value, sessionId) {
    if (!sessionId || !value || value.sessionId !== sessionId || !Array.isArray(value.points) || value.points.length > 12000) return [];
    if (!value.points.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)
        && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180)) return [];
    return value.points.map(p => p.slice());
}
return { setText, setAttribute, setStyle, createEfbSvgRenderer, aircraftHtml, createCompass, filterTraffic, classifyTraffic, trafficSymbolKind, trafficSymbolSvg, DIRECT_LINE_STYLE, TRAIL_STYLE, appendTrailPoint, restoreTrail };
}));
