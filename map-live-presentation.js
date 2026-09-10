/* Shared live map instruments. Geometry and styles are the standalone implementation. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.GAMapLivePresentation = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';
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
        bugG.setAttribute('transform', `rotate(${bearingToWp},150,150)`);
        bugG.style.display = '';
    }

    const cdiBar = document.getElementById('compassCdiBarFixed');
    if (cdiBar) {
        const MAX_PX = 44, FULL_NM = 2.0;
        // positive xte (right of track) → CDI deflects left (negative x)
        const offset = Math.max(-MAX_PX, Math.min(MAX_PX, -(xteNm / FULL_NM) * MAX_PX));
        cdiBar.setAttribute('x1', offset.toFixed(1));
        cdiBar.setAttribute('x2', offset.toFixed(1));
        const cdiSvg = document.getElementById('compassCdiSvg');
        if (cdiSvg) cdiSvg.style.display = '';
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
    // Background pill
    svg.appendChild(e('rect', { x: -52, y: -12, width: 104, height: 24, rx: 5,
        fill: 'rgba(2,5,10,0.82)', stroke: 'rgba(255,255,255,0.18)', 'stroke-width': 1 }));
    // Centre track line (thin, white)
    svg.appendChild(e('line', { x1: 0, y1: -8, x2: 0, y2: 8,
        stroke: 'rgba(255,255,255,0.35)', 'stroke-width': 1.2, 'stroke-dasharray': '3 2' }));
    // Scale dots at ±22 and ±44 px
    for (const dx of [-44, -22, 22, 44]) {
        svg.appendChild(e('circle', { cx: dx, cy: 0, r: 2.5,
            fill: 'none', stroke: 'rgba(255,255,255,0.45)', 'stroke-width': 1.5 }));
    }
    // CDI bar (vertical, moves horizontally)
    svg.appendChild(e('line', { id: 'compassCdiBarFixed', x1: 0, y1: -10, x2: 0, y2: 10,
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
        disc.style.transform = `rotate(${rotation}deg)`;
        const text = document.getElementById('compassHdgReadout');
        if (text) text.textContent = ('00' + ((Math.round(heading) % 360 + 360) % 360)).slice(-3) + '°';
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
return { aircraftHtml, createCompass, filterTraffic, DIRECT_LINE_STYLE, TRAIL_STYLE, appendTrailPoint, restoreTrail };
}));
