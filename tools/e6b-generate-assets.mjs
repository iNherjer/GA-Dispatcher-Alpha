import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'e6b-assets');

const SVG_NS = 'http://www.w3.org/2000/svg';
const W = 1000;
const H = 1000;
const CX = 500;
const CY = 500;
const PAPER = '#f6f0d2';
const DISC = '#faf8eb';
const INK = '#090909';
const BAND = '#d6ccb5';
const BAND_DARK = '#bfb39b';
const GRID = '#4a463d';

function n(value) {
    return Number(value.toFixed(3));
}

function polar(cx, cy, radius, angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    return {
        x: n(cx + Math.sin(rad) * radius),
        y: n(cy - Math.cos(rad) * radius)
    };
}

function normalize360(degrees) {
    const value = degrees % 360;
    return value < 0 ? value + 360 : value;
}

function logAngle(value) {
    let mantissa = Math.abs(Number(value) || 10);
    while (mantissa < 10) mantissa *= 10;
    while (mantissa >= 100) mantissa /= 10;
    return Math.log10(mantissa / 10) * 360;
}

function esc(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function attrs(input = {}) {
    return Object.entries(input)
        .filter(([, value]) => value !== undefined && value !== null && value !== false)
        .map(([key, value]) => ` ${key}="${esc(value)}"`)
        .join('');
}

function tag(name, attributes = {}, content = '') {
    if (content === null) return `<${name}${attrs(attributes)}/>`;
    return `<${name}${attrs(attributes)}>${content}</${name}>`;
}

function line(x1, y1, x2, y2, attributes = {}) {
    return tag('line', { x1: n(x1), y1: n(y1), x2: n(x2), y2: n(y2), ...attributes }, null);
}

function circle(cx, cy, r, attributes = {}) {
    return tag('circle', { cx: n(cx), cy: n(cy), r: n(r), ...attributes }, null);
}

function pathEl(d, attributes = {}) {
    return tag('path', { d, ...attributes }, null);
}

function polygon(points, attributes = {}) {
    return tag('polygon', {
        points: points.map(point => `${n(point.x)},${n(point.y)}`).join(' '),
        ...attributes
    }, null);
}

function textEl(text, x, y, attributes = {}) {
    return tag('text', {
        x: n(x),
        y: n(y),
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        ...attributes
    }, esc(text));
}

function radialText(text, cx, cy, radius, angle, attributes = {}) {
    const p = polar(cx, cy, radius, angle);
    return textEl(text, p.x, p.y, {
        transform: `rotate(${n(angle)} ${p.x} ${p.y})`,
        ...attributes
    });
}

function radialPointer(cx, cy, angle, tipRadius, length, halfWidth, attributes = {}) {
    const rad = angle * Math.PI / 180;
    const ux = Math.sin(rad);
    const uy = -Math.cos(rad);
    const px = Math.cos(rad);
    const py = Math.sin(rad);
    const tip = { x: cx + ux * tipRadius, y: cy + uy * tipRadius };
    const base = { x: tip.x - ux * length, y: tip.y - uy * length };
    return polygon([
        tip,
        { x: base.x + px * halfWidth, y: base.y + py * halfWidth },
        { x: base.x - px * halfWidth, y: base.y - py * halfWidth }
    ], attributes);
}

function arrowLine(x1, y1, x2, y2, attributes = {}) {
    const stroke = attributes.stroke || INK;
    const width = attributes['stroke-width'] || 0.8;
    const size = attributes.size || 3.5;
    const left = polygon([
        { x: x1, y: y1 },
        { x: x1 + size, y: y1 - size * 0.7 },
        { x: x1 + size, y: y1 + size * 0.7 }
    ], { fill: stroke });
    const right = polygon([
        { x: x2, y: y2 },
        { x: x2 - size, y: y2 - size * 0.7 },
        { x: x2 - size, y: y2 + size * 0.7 }
    ], { fill: stroke });
    return [
        line(x1, y1, x2, y2, { stroke, 'stroke-width': width, 'stroke-linecap': 'round' }),
        left,
        right
    ].join('\n');
}

function splitArrowPair(cx, y, innerGap, outerHalfWidth, attributes = {}) {
    const stroke = attributes.stroke || INK;
    const width = attributes['stroke-width'] || 0.7;
    const size = attributes.size || 3;
    return [
        line(cx - outerHalfWidth, y, cx - innerGap, y, { stroke, 'stroke-width': width, 'stroke-linecap': 'round' }),
        line(cx + innerGap, y, cx + outerHalfWidth, y, { stroke, 'stroke-width': width, 'stroke-linecap': 'round' }),
        polygon([
            { x: cx - outerHalfWidth - size, y },
            { x: cx - outerHalfWidth + size, y: y - size * 0.72 },
            { x: cx - outerHalfWidth + size, y: y + size * 0.72 }
        ], { fill: stroke }),
        polygon([
            { x: cx + outerHalfWidth + size, y },
            { x: cx + outerHalfWidth - size, y: y - size * 0.72 },
            { x: cx + outerHalfWidth - size, y: y + size * 0.72 }
        ], { fill: stroke })
    ].join('\n');
}

function arcPath(cx, cy, radius, startAngle, endAngle, sweep = 1, largeArcOverride = null) {
    const start = polar(cx, cy, radius, startAngle);
    const end = polar(cx, cy, radius, endAngle);
    const delta = normalize360(endAngle - startAngle);
    const largeArc = largeArcOverride ?? (delta > 180 ? 1 : 0);
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
}

function sectorPath(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
    const outerStart = polar(cx, cy, outerRadius, startAngle);
    const outerEnd = polar(cx, cy, outerRadius, endAngle);
    const innerEnd = polar(cx, cy, innerRadius, endAngle);
    const innerStart = polar(cx, cy, innerRadius, startAngle);
    const delta = normalize360(endAngle - startAngle);
    const largeArc = delta > 180 ? 1 : 0;
    return [
        `M ${outerStart.x} ${outerStart.y}`,
        `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
        `L ${innerEnd.x} ${innerEnd.y}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
        'Z'
    ].join(' ');
}

function annulus(cx, cy, outerRadius, innerRadius, attributes = {}) {
    return pathEl([
        `M ${cx} ${cy - outerRadius}`,
        `A ${outerRadius} ${outerRadius} 0 1 1 ${cx} ${cy + outerRadius}`,
        `A ${outerRadius} ${outerRadius} 0 1 1 ${cx} ${cy - outerRadius}`,
        'Z',
        `M ${cx} ${cy - innerRadius}`,
        `A ${innerRadius} ${innerRadius} 0 1 0 ${cx} ${cy + innerRadius}`,
        `A ${innerRadius} ${innerRadius} 0 1 0 ${cx} ${cy - innerRadius}`,
        'Z'
    ].join(' '), { 'fill-rule': 'evenodd', ...attributes });
}

function logScale({
    cx,
    cy,
    tickOuter,
    tickInner,
    textRadius,
    tickColor,
    textColor,
    fine = false,
    labelValues,
    fontSize,
    textStroke = 'none',
    majorLength = 34,
    midLength = 24,
    minorLength = 15,
    fineLength = 7,
    strokeScale = 1
}) {
    const parts = [];
    if (fine) {
        for (let value = 10; value <= 100.0001; value += value < 20 ? 0.2 : 0.5) {
            const rounded = Math.round(value * 10) / 10;
            if (Math.abs(rounded - Math.round(rounded)) < 0.001) continue;
            const angle = logAngle(rounded);
            const p1 = polar(cx, cy, tickOuter, angle);
            const p2 = polar(cx, cy, tickOuter - fineLength, angle);
            parts.push(line(p1.x, p1.y, p2.x, p2.y, {
                stroke: tickColor,
                'stroke-width': n(0.9 * strokeScale),
                'stroke-linecap': 'round',
                'data-value': rounded
            }));
        }
    }
    for (let value = 10; value < 100; value += 1) {
        const angle = logAngle(value);
        const major = value === 10 || value % 10 === 0;
        const mid = value % 5 === 0;
        const len = major ? majorLength : (mid ? midLength : minorLength);
        const p1 = polar(cx, cy, tickOuter, angle);
        const p2 = polar(cx, cy, tickOuter - len, angle);
        parts.push(line(p1.x, p1.y, p2.x, p2.y, {
            stroke: tickColor,
            'stroke-width': n((major ? 3.3 : (mid ? 2.1 : 1.25)) * strokeScale),
            'stroke-linecap': 'round',
            'data-value': value
        }));
    }
    labelValues.forEach(value => {
        parts.push(radialText(String(value), cx, cy, textRadius, logAngle(value), {
            fill: textColor,
            stroke: textStroke,
            'stroke-width': textStroke === 'none' ? 0 : 2.4,
            'paint-order': 'stroke',
            'font-family': 'Arial, sans-serif',
            'font-size': fontSize,
            'font-weight': 900,
            'data-value': value
        }));
    });
    return parts.join('\n');
}

function svgDocument({ id, width = W, height = H, viewBox = `0 0 ${width} ${height}`, defs = '', body }) {
    return [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<svg xmlns="${SVG_NS}" id="${id}" width="${width}" height="${height}" viewBox="${viewBox}" role="img">`,
        defs ? tag('defs', {}, defs) : '',
        body,
        '</svg>',
        ''
    ].join('\n');
}

function curvedTitle(id, text, radius, startAngle, endAngle, attributes = {}) {
    const pathId = `${id}-path`;
    return {
        def: pathEl(arcPath(CX, CY, radius, startAngle, endAngle), { id: pathId, fill: 'none' }),
        text: tag('text', attributes, tag('textPath', {
            href: `#${pathId}`,
            startOffset: '50%',
            'text-anchor': 'middle'
        }, esc(text)))
    };
}

function fixedFrontSvg() {
    const title = curvedTitle('front-title', 'FLIGHT COMPUTER', 456, 316, 44, {
        fill: '#fff',
        'font-family': 'Arial, sans-serif',
        'font-size': 42,
        'font-weight': 900,
        'letter-spacing': 1.5
    });
    const timeTitle = curvedTitle('front-temp', 'TEMPERATURE CONVERSION SCALE', 438, 205, 155, {
        fill: '#fff',
        'font-family': 'Arial, sans-serif',
        'font-size': 13,
        'font-weight': 800
    });
    const labels = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90];
    const body = [];
    body.push(tag('rect', { x: 0, y: 0, width: W, height: H, fill: PAPER }, null));
    body.push(circle(CX, CY, 486, { fill: INK }));
    body.push(circle(CX, CY, 407, { fill: DISC }));
    body.push(annulus(CX, CY, 486, 418, { fill: INK }));
    body.push(logScale({
        cx: CX,
        cy: CY,
        tickOuter: 456,
        tickInner: 418,
        textRadius: 474,
        tickColor: '#fff8d8',
        textColor: '#fff8d8',
        labelValues: labels,
        fontSize: 29,
        textStroke: '#000'
    }));
    body.push(title.text);
    body.push(radialText('DISTANCE NAUT.', CX, CY, 467, 270, { fill: '#fff8d8', 'font-family': 'Arial, sans-serif', 'font-size': 15, 'font-weight': 800 }));
    body.push(radialText('FUEL', CX, CY, 458, 282, { fill: '#fff8d8', 'font-family': 'Arial, sans-serif', 'font-size': 16, 'font-weight': 900 }));
    body.push(radialText('STAT. MILES', CX, CY, 399, 292, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 16, 'font-weight': 800 }));
    body.push(radialText('KM  US GAL  LBS', CX, CY, 467, 52, { fill: '#fff8d8', 'font-family': 'Arial, sans-serif', 'font-size': 15, 'font-weight': 900 }));
    body.push(radialText('TRUE ALT.', CX, CY, 462, 247, { fill: '#fff8d8', 'font-family': 'Arial, sans-serif', 'font-size': 16, 'font-weight': 900 }));
    body.push(radialText('TAS', CX, CY, 450, 163, { fill: '#fff8d8', 'font-family': 'Arial, sans-serif', 'font-size': 16, 'font-weight': 900 }));

    body.push(tag('g', { id: 'altitude-field-behind-windows', 'data-calibration': 'fixed fields visible through front rotor cutouts' }, [
        pathEl(sectorPath(CX, CY, 392, 329, 298, 62), { fill: '#f9f7eb', stroke: INK, 'stroke-width': 1.4 }),
        ...Array.from({ length: 25 }, (_, i) => {
            const angle = 300 + i * 5;
            const major = i % 4 === 0;
            const p1 = polar(CX, CY, 388, angle);
            const p2 = polar(CX, CY, major ? 337 : 349, angle);
            return line(p1.x, p1.y, p2.x, p2.y, { stroke: major ? INK : '#777263', 'stroke-width': major ? 2 : 1 });
        }),
        radialText('-40', CX, CY, 368, 306, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 21, 'font-weight': 800 }),
        radialText('-20', CX, CY, 348, 323, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 19, 'font-weight': 800 }),
        radialText('0', CX, CY, 348, 344, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 19, 'font-weight': 800 }),
        radialText('0', CX, CY, 348, 22, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 19, 'font-weight': 800 }),
        radialText('+50', CX, CY, 369, 43, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 21, 'font-weight': 800 }),
        pathEl('M 413 307 L 587 307 L 566 252 L 434 252 Z', { fill: '#f9f7eb', stroke: INK, 'stroke-width': 1.3 }),
        [-10, -5, 0, 5, 10].map((value, index) => {
            const x = 434 + index * 33;
            return [
                line(x, 302, x, 264, { stroke: INK, 'stroke-width': index === 2 ? 2.5 : 1.5 }),
                textEl(value > 0 ? `+${value}` : String(value), x, 240, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 20, 'font-weight': 800 })
            ].join('\n');
        }).join('\n')
    ].join('\n')));

    body.push(tag('g', { id: 'temperature-conversion-scale' }, [
        timeTitle.text,
        ...Array.from({ length: 37 }, (_, i) => {
            const angle = 205 - i * (50 / 36);
            const major = i % 6 === 0;
            const p1 = polar(CX, CY, 462, angle);
            const p2 = polar(CX, CY, major ? 432 : 445, angle);
            return line(p1.x, p1.y, p2.x, p2.y, { stroke: '#fff8d8', 'stroke-width': major ? 2.2 : 1.1 });
        }),
        ...[-60, -40, -20, 0, 20, 40, 60, 80, 100, 120].map((value, i) => {
            const angle = 205 - i * (50 / 9);
            return radialText(String(value), CX, CY, 473, angle, { fill: '#fff8d8', 'font-family': 'Arial, sans-serif', 'font-size': 16, 'font-weight': 800 });
        })
    ].join('\n')));

    return svgDocument({
        id: 'e6b-front-fixed',
        defs: [title.def, timeTitle.def].join('\n'),
        body: tag('g', { id: 'front-fixed-board', 'data-calibration': 'outer log angle = 360 * log10(mantissa / 10)' }, body.join('\n'))
    });
}

function frontRotorSvg() {
    const labels = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90];
    const mask = [
        tag('mask', { id: 'front-rotor-cutouts', maskUnits: 'userSpaceOnUse' }, [
            tag('rect', { x: 0, y: 0, width: W, height: H, fill: '#fff' }, null),
            pathEl(sectorPath(CX, CY, 389, 326, 303, 351), { fill: '#000' }),
            pathEl(sectorPath(CX, CY, 389, 326, 9, 58), { fill: '#000' }),
            pathEl('M 413 307 L 587 307 L 566 252 L 434 252 Z', { fill: '#000' })
        ].join('\n'))
    ].join('\n');
    const rotor = [];
    rotor.push(tag('g', { id: 'rotor-painted-surface', mask: 'url(#front-rotor-cutouts)' }, [
        circle(CX, CY, 398, { fill: DISC, stroke: INK, 'stroke-width': 2.4 }),
        annulus(CX, CY, 407, 337, { fill: DISC, stroke: INK, 'stroke-width': 1.8 }),
        circle(CX, CY, 330, { fill: DISC, stroke: INK, 'stroke-width': 1.5 }),
        logScale({
            cx: CX,
            cy: CY,
            tickOuter: 405,
            tickInner: 337,
            textRadius: 364,
            tickColor: INK,
            textColor: INK,
            fine: true,
            labelValues: labels,
            fontSize: 25
        }),
        ...[
            [60, '1:00'], [70, '1:10'], [80, '1:20'], [90, '1:30'],
            [10, '1:40'], [11, '1:50'], [12, '2:00'], [15, '2:30'],
            [18, '3:00'], [21, '3:30'], [24, '4:00'], [27, '4:30'], [30, '5:00']
        ].map(([value, label]) => radialText(label, CX, CY, 313, logAngle(value), {
            fill: INK,
            'font-family': 'Arial, sans-serif',
            'font-size': 18,
            'font-weight': 900
        })),
        radialText('TIME', CX, CY, 377, 270, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 16, 'font-weight': 900 }),
        radialText('MINUTES', CX, CY, 317, 190, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 14, 'font-weight': 900 }),
        radialText('HOURS', CX, CY, 318, 56, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 14, 'font-weight': 900 }),
        line(...Object.values(polar(CX, CY, 414, logAngle(60))), ...Object.values(polar(CX, CY, 331, logAngle(60))), { stroke: '#d43b2f', 'stroke-width': 6, 'stroke-linecap': 'round' }),
        radialText('RATE', CX, CY, 317, logAngle(60), { fill: '#d43b2f', 'font-family': 'Arial, sans-serif', 'font-size': 15, 'font-weight': 900 }),
        line(CX, 319, CX, 735, { stroke: INK, 'stroke-width': 3.1 }),
        line(188, 548, 812, 548, { stroke: INK, 'stroke-width': 3.1 }),
        circle(CX, CY, 13, { fill: DISC, stroke: INK, 'stroke-width': 7 }),
        textEl('FOR', 333, 430, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 23, 'font-weight': 900 }),
        textEl('ALTITUDE', 333, 457, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 24, 'font-weight': 900 }),
        textEl('COMPUTATIONS', 333, 484, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 21, 'font-weight': 900 }),
        textEl('FOR TRUE', 667, 430, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 23, 'font-weight': 900 }),
        textEl('AIRSPEED', 667, 457, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 24, 'font-weight': 900 }),
        textEl('& DENSITY ALT.', 667, 484, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 20, 'font-weight': 900 }),
        textEl('DENSITY', 500, 430, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 22, 'font-weight': 900 }),
        textEl('ALTITUDE', 500, 458, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 22, 'font-weight': 900 }),
        textEl('FOR TIME AND DISTANCE', 323, 585, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 23, 'font-weight': 900 }),
        textEl('FOR FUEL CONSUMPTION', 675, 585, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 23, 'font-weight': 900 }),
        textEl('SPEED', 300, 700, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 18, 'font-weight': 800, transform: 'rotate(-8 300 700)' }),
        textEl('DISTANCE', 402, 692, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 18, 'font-weight': 800, transform: 'rotate(8 402 692)' }),
        textEl('G.P.H.', 620, 700, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 18, 'font-weight': 800, transform: 'rotate(-8 620 700)' }),
        textEl('FUEL BURNED', 733, 692, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 18, 'font-weight': 800, transform: 'rotate(8 733 692)' })
    ].join('\n')));

    rotor.push(tag('g', { id: 'window-frames' }, [
        pathEl(sectorPath(CX, CY, 389, 326, 303, 351), { fill: 'none', stroke: INK, 'stroke-width': 4 }),
        pathEl(sectorPath(CX, CY, 389, 326, 9, 58), { fill: 'none', stroke: INK, 'stroke-width': 4 }),
        pathEl('M 413 307 L 587 307 L 566 252 L 434 252 Z', { fill: 'none', stroke: INK, 'stroke-width': 3 }),
        pathEl('M 477 332 L 523 332 L 500 288 Z', { fill: INK }),
        textEl('AIR TEMPERATURE C', 500, 224, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 17, 'font-weight': 900 }),
        textEl('PRESSURE ALTITUDE', 500, 250, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 17, 'font-weight': 900 }),
        textEl('THOUSANDS OF FEET', 500, 272, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 14, 'font-weight': 900 })
    ].join('\n')));

    return svgDocument({
        id: 'e6b-front-rotor',
        defs: mask,
        body: tag('g', { id: 'front-rotor-board', 'data-calibration': 'inner log angle = 360 * log10(mantissa / 10); transparent cutouts reveal fixed board' }, rotor.join('\n'))
    });
}

function windGridSvg() {
    const width = 1000;
    const height = 1400;
    const cx = 500;
    const baseY = 1190;
    const scale = 3.05;
    const speedToY = speed => n(baseY - speed * scale);
    const body = [];
    body.push(tag('rect', { x: 0, y: 0, width, height, fill: PAPER }, null));
    body.push(tag('rect', { x: 120, y: 50, width: 760, height: 1250, fill: DISC, stroke: INK, 'stroke-width': 2 }, null));
    for (let speed = 40; speed <= 260; speed += 5) {
        const y = speedToY(speed);
        const major = speed % 50 === 0;
        const mid = speed % 10 === 0;
        body.push(line(125, y, 875, y, {
            stroke: major ? INK : (mid ? '#555' : '#999'),
            'stroke-width': major ? 2.2 : (mid ? 1.25 : 0.75)
        }));
        if (major) {
            body.push(textEl(String(speed), cx + 22, y - 14, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 20, 'font-weight': 900 }));
        }
    }
    for (let angle = -40; angle <= 40; angle += 5) {
        const points = [];
        for (let speed = 40; speed <= 260; speed += 5) {
            const y = speedToY(speed);
            const x = n(cx + Math.tan(angle * Math.PI / 180) * speed * scale);
            points.push(`${x},${y}`);
        }
        body.push(tag('polyline', {
            points: points.join(' '),
            fill: 'none',
            stroke: angle === 0 ? INK : (angle % 10 === 0 ? '#333' : '#999'),
            'stroke-width': angle === 0 ? 2.8 : (angle % 10 === 0 ? 1.7 : 0.85)
        }, null));
        if (angle !== 0 && angle % 10 === 0) {
            const labelSpeed = 150;
            const y = speedToY(labelSpeed);
            const x = n(cx + Math.tan(angle * Math.PI / 180) * labelSpeed * scale);
            body.push(textEl(String(Math.abs(angle)), x, y - 22, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 19, 'font-weight': 900 }));
        }
    }
    body.push(line(cx, 50, cx, 1300, { stroke: INK, 'stroke-width': 2.6 }));
    body.push(textEl('WIND GRID / SPEED CARD', cx, 28, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 23, 'font-weight': 900 }));
    return svgDocument({
        id: 'e6b-wind-grid',
        width,
        height,
        viewBox: `0 0 ${width} ${height}`,
        body: tag('g', { id: 'wind-speed-card', 'data-calibration': 'vertical speed grid; y = baseY - speed * scale' }, body.join('\n'))
    });
}

function windCompassSvg() {
    const width = 1000;
    const height = 1400;
    const cx = 500;
    const cy = 560;
    const body = [];
    body.push(tag('g', { id: 'wind-compass-board', 'data-calibration': 'degree ring: 0 deg north, clockwise positive' }, [
        annulus(cx, cy, 430, 360, { fill: INK }),
        annulus(cx, cy, 360, 306, { fill: DISC, stroke: INK, 'stroke-width': 2 }),
        Array.from({ length: 360 }, (_, deg) => {
            const major = deg % 10 === 0;
            const mid = deg % 5 === 0;
            const p1 = polar(cx, cy, 418, deg);
            const p2 = polar(cx, cy, 418 - (major ? 34 : (mid ? 24 : 14)), deg);
            return line(p1.x, p1.y, p2.x, p2.y, { stroke: '#fff8d8', 'stroke-width': major ? 2.3 : 1.1 });
        }).join('\n'),
        Array.from({ length: 36 }, (_, i) => {
            const deg = i * 10;
            const cardinal = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[deg];
            const label = cardinal || String(deg);
            return radialText(label, cx, cy, cardinal ? 329 : 354, deg, {
                fill: INK,
                'font-family': 'Arial, sans-serif',
                'font-size': cardinal ? 34 : 21,
                'font-weight': 900
            });
        }).join('\n'),
        [
            ['NNE', 22.5], ['ENE', 67.5], ['ESE', 112.5], ['SSE', 157.5],
            ['SSW', 202.5], ['WSW', 247.5], ['WNW', 292.5], ['NNW', 337.5]
        ].map(([label, deg]) => radialText(label, cx, cy, 327, deg, {
            fill: INK,
            'font-family': 'Arial, sans-serif',
            'font-size': 15,
            'font-weight': 900
        })).join('\n'),
        circle(cx, cy, 306, { fill: 'none', stroke: INK, 'stroke-width': 2 }),
        pathEl(`M ${cx - 18} ${cy - 405} L ${cx + 18} ${cy - 405} L ${cx} ${cy - 372} Z`, { fill: DISC, stroke: INK, 'stroke-width': 3 }),
        textEl('TRUE INDEX', cx, cy - 426, { fill: '#fff8d8', 'font-family': 'Arial, sans-serif', 'font-size': 17, 'font-weight': 900 }),
        circle(cx, cy, 9, { fill: DISC, stroke: INK, 'stroke-width': 5 })
    ].join('\n')));
    return svgDocument({
        id: 'e6b-wind-compass',
        width,
        height,
        viewBox: `0 0 ${width} ${height}`,
        body: body.join('\n')
    });
}

function readReferenceSlideruleGeometry() {
    const geometryPath = path.join(outDir, 'reference-sliderule-geometry.json');
    if (!fs.existsSync(geometryPath)) {
        return {
            viewBox: [0, 0, 510, 590],
            center: { x: 255, y: 295 },
            frontBoard: {
                disc: {
                    outerRadius: 213.07,
                    middleRingOuterRadius: 185.1,
                    innerDiscRadius: 160
                }
            },
            logScale: {
                outerTicks: [
                    { value: 10, rOuter: 229.75, rInner: 207.75 },
                    { value: 60, rOuter: 229.44, rInner: 207.44 }
                ]
            }
        };
    }
    return JSON.parse(fs.readFileSync(geometryPath, 'utf8'));
}

function referenceCurvedLabel(id, text, cx, cy, radius, startAngle, endAngle, attributes = {}, pathOptions = {}) {
    const pathId = `${id}-path`;
    return {
        def: pathEl(arcPath(cx, cy, radius, startAngle, endAngle, pathOptions.sweep ?? 1, pathOptions.largeArc ?? null), { id: pathId, fill: 'none' }),
        text: tag('text', attributes, tag('textPath', {
            href: `#${pathId}`,
            startOffset: '50%',
            'text-anchor': 'middle'
        }, esc(text)))
    };
}

function frontGeometryNumbers() {
    const geometry = readReferenceSlideruleGeometry();
    const [x, y, width, height] = geometry.viewBox;
    const center = geometry.center;
    const outerSample = geometry.logScale.outerTicks.find(tick => tick.value === 10) || geometry.logScale.outerTicks[0];
    return {
        geometry,
        viewBox: geometry.viewBox,
        width,
        height,
        x,
        y,
        cx: center.x,
        cy: center.y,
        outerTickOuter: outerSample.rOuter,
        outerTickInner: outerSample.rInner,
        outerLabelRadius: outerSample.rOuter + 12,
        discOuter: geometry.frontBoard.disc.outerRadius,
        rotorOuter: geometry.frontBoard.disc.outerRadius,
        rotorMiddle: geometry.frontBoard.disc.middleRingOuterRadius,
        rotorInner: geometry.frontBoard.disc.innerDiscRadius
    };
}

function frontReferenceWindows() {
    return {
        altitude: 'M 130.15 238.22 L 109.67 228.92 A 160.18 160.18 0 0 1 193.75 147.57 L 202.38 168.34 A 137.66 137.66 0 0 0 130.15 238.22 Z',
        airspeedInner: 'M 351.29 259.14 A 103.21 103.21 0 0 0 294.29 199.96 L 302.83 179.45 A 125.52 125.52 0 0 1 372.08 251.45 Z',
        airspeedMiddle: 'M 362.3 150.7 C 379.5 162.9 394.1 178.3 405.2 196.2 L 388.7 206.5 C 378.9 190.8 366.2 177.2 351.1 166.5 Z',
        densityWindow: 'M 211 184 L 299 184 L 288 156 L 222 156 Z',
        densityPointer: 'M 242 212 L 268 212 L 255 186 Z'
    };
}

function windowTicks(cx, cy, outerRadius, innerRadius, startAngle, endAngle, count, attributes = {}) {
    return Array.from({ length: count }, (_, index) => {
        const t = count === 1 ? 0 : index / (count - 1);
        const angle = startAngle + (endAngle - startAngle) * t;
        const major = index === 0 || index === count - 1 || index % 4 === 0;
        const p1 = polar(cx, cy, outerRadius, angle);
        const p2 = polar(cx, cy, major ? innerRadius : innerRadius + 6, angle);
        return line(p1.x, p1.y, p2.x, p2.y, {
            stroke: major ? INK : '#6e6a5e',
            'stroke-width': major ? 1.05 : 0.55,
            ...attributes
        });
    }).join('\n');
}

function densityWindowScale(f, windows) {
    return [
        pathEl(windows.densityWindow, { fill: 'none', stroke: INK, 'stroke-width': 1.1 }),
        pathEl(windows.densityPointer, { fill: INK })
    ].join('\n');
}

function fixedIndexArrows(f) {
    return tag('g', { id: 'front-fixed-index-arrows' }, [
        radialPointer(f.cx, f.cy, logAngle(60), f.outerTickInner + 6, 32, 11, { fill: INK })
    ].join('\n'));
}

function fixedOuterUnitLabels(f) {
    const attrs = {
        fill: INK,
        'font-family': 'Arial, sans-serif',
        'font-size': 7.2,
        'font-weight': 900
    };
    return tag('g', { id: 'fixed-outer-unit-labels' }, [
        radialText('DISTANCE NAUT.', f.cx, f.cy, f.outerTickInner + 12, 270, attrs),
        radialText('FUEL', f.cx, f.cy, f.outerTickInner + 4, 282, attrs),
        radialText('TRUE ALT.', f.cx, f.cy, f.outerTickInner + 10, 247, attrs),
        radialText('STAT. MILES', f.cx, f.cy, f.outerTickInner - 16, 292, attrs),
        radialText('KM  US GAL  LBS', f.cx, f.cy, f.outerTickInner + 12, 52, attrs),
        radialText('TAS', f.cx, f.cy, f.outerTickInner + 1, 163, attrs)
    ].join('\n'));
}

function rotorIndexArrows(f) {
    return tag('g', { id: 'front-rotor-index-arrows' }, [
        splitArrowPair(f.cx, f.cy - 164, 37, 72, { stroke: INK, 'stroke-width': 0.65, size: 2.8 }),
        splitArrowPair(f.cx, f.cy - 154, 47, 82, { stroke: INK, 'stroke-width': 0.65, size: 2.8 })
    ].join('\n'));
}

function fixedDensityAltitudeScale(f, windows) {
    const values = [
        { label: '10', x: 221 },
        { label: '-5', x: 238 },
        { label: '0', x: 255 },
        { label: '+5', x: 272 },
        { label: '+10', x: 289 }
    ];
    return tag('g', { id: 'fixed-density-altitude-scale' }, [
        pathEl(windows.densityWindow, { fill: BAND_DARK, stroke: 'none' }),
        Array.from({ length: 25 }, (_, index) => {
            const x = 216 + index * 3.25;
            const major = index % 6 === 0;
            const mid = index % 3 === 0;
            return line(x, 181, x, major ? 161 : (mid ? 165 : 169), {
                stroke: INK,
                'stroke-width': major ? 0.75 : 0.42
            });
        }).join('\n'),
        values.map(item => textEl(item.label, item.x, 164, {
            fill: INK,
            'font-family': 'Arial, sans-serif',
            'font-size': item.label.length > 2 ? 5.8 : 6.5,
            'font-weight': 900
        })).join('\n')
    ].join('\n'));
}

function fixedFrontSvgReference() {
    const f = frontGeometryNumbers();
    const windows = frontReferenceWindows();
    const labels = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90];
    const title = referenceCurvedLabel('front-ref-title', 'FLIGHT COMPUTER', f.cx, f.cy, 270, 323, 37, {
        fill: INK,
        'font-family': 'Arial, sans-serif',
        'font-size': 18,
        'font-weight': 900,
        'letter-spacing': 0.8
    });
    const temp = referenceCurvedLabel('front-ref-temp', 'TEMPERATURE CONVERSION SCALE', f.cx, f.cy, 242, 222, 138, {
        fill: INK,
        'font-family': 'Arial, sans-serif',
        'font-size': 8,
        'font-weight': 800
    }, { sweep: 0, largeArc: 0 });
    const body = [];
    body.push(tag('rect', { x: f.x, y: f.y, width: f.width, height: f.height, fill: PAPER }, null));
    body.push(pathEl('M255 0 C146 0 81 59 30 147 L30 443 C81 531 146 590 255 590 C364 590 429 531 480 443 L480 147 C429 59 364 0 255 0 Z', { fill: '#e2d9c0', stroke: INK, 'stroke-width': 1.4 }));
    body.push(annulus(f.cx, f.cy, 256, f.outerTickInner + 2, { fill: BAND, stroke: INK, 'stroke-width': 1.1 }));
    body.push(logScale({
        cx: f.cx,
        cy: f.cy,
        tickOuter: f.outerTickOuter - 6,
        tickInner: f.outerTickInner,
        textRadius: f.outerTickOuter + 14,
        tickColor: INK,
        textColor: INK,
        textStroke: BAND,
        labelValues: labels,
        fontSize: 13.4,
        majorLength: 19,
        midLength: 13,
        minorLength: 9,
        strokeScale: 0.9
    }));
    body.push(title.text);
    body.push(fixedIndexArrows(f));
    body.push(fixedOuterUnitLabels(f));
    body.push(tag('g', { id: 'fixed-reference-fields' }, [
        pathEl(windows.altitude, { fill: '#f9f7eb', stroke: INK, 'stroke-width': 0.85 }),
        windowTicks(f.cx, f.cy, 158, 140, 296, 336, 17),
        radialText('-40', f.cx, f.cy, 148, 299, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 8, 'font-weight': 800 }),
        radialText('-20', f.cx, f.cy, 148, 315, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 8, 'font-weight': 800 }),
        radialText('0', f.cx, f.cy, 148, 336, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 8, 'font-weight': 800 }),
        pathEl(windows.airspeedMiddle, { fill: '#f9f7eb', stroke: INK, 'stroke-width': 0.85 }),
        windowTicks(f.cx, f.cy, 178, 162, 38, 55, 9),
        radialText('+50', f.cx, f.cy, 170, 43, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 8, 'font-weight': 800 }),
        pathEl(windows.airspeedInner, { fill: '#f9f7eb', stroke: INK, 'stroke-width': 0.85 }),
        windowTicks(f.cx, f.cy, 123, 106, 24, 68, 17),
        radialText('0', f.cx, f.cy, 116, 24, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 8, 'font-weight': 800 }),
        radialText('5', f.cx, f.cy, 114, 48, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 8, 'font-weight': 800 }),
        radialText('10', f.cx, f.cy, 116, 68, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 8, 'font-weight': 800 })
    ].join('\n')));
    body.push(fixedDensityAltitudeScale(f, windows));
    body.push(tag('g', { id: 'temperature-conversion-scale' }, [
        temp.text,
        Array.from({ length: 37 }, (_, index) => {
            const angle = 205 - index * (50 / 36);
            const major = index % 6 === 0;
            const p1 = polar(f.cx, f.cy, 242, angle);
            const p2 = polar(f.cx, f.cy, major ? 225 : 233, angle);
            return line(p1.x, p1.y, p2.x, p2.y, { stroke: INK, 'stroke-width': major ? 1.4 : 0.75 });
        }).join('\n')
    ].join('\n')));
    return svgDocument({
        id: 'e6b-front-fixed',
        width: f.width,
        height: f.height,
        viewBox: f.viewBox.join(' '),
        defs: [title.def, temp.def].join('\n'),
        body: tag('g', { id: 'front-fixed-reference-board', 'data-calibration': 'reference geometry; original artwork not copied' }, body.join('\n'))
    });
}

function frontRotorSvgReference() {
    const f = frontGeometryNumbers();
    const windows = frontReferenceWindows();
    const labels = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90];
    const mask = tag('mask', { id: 'front-ref-rotor-cutouts', maskUnits: 'userSpaceOnUse' }, [
        tag('rect', { x: f.x, y: f.y, width: f.width, height: f.height, fill: '#fff' }, null),
        pathEl(windows.altitude, { fill: '#000' }),
        pathEl(windows.airspeedMiddle, { fill: '#000' }),
        pathEl(windows.airspeedInner, { fill: '#000' }),
        pathEl(windows.densityWindow, { fill: '#000' })
    ].join('\n'));
    const body = [];
    body.push(tag('g', { id: 'front-reference-rotor-surface', mask: 'url(#front-ref-rotor-cutouts)' }, [
        circle(f.cx, f.cy, f.rotorOuter, { fill: '#f6f0dc', stroke: INK, 'stroke-width': 1.3 }),
        annulus(f.cx, f.cy, f.outerTickInner - 1, f.rotorMiddle, { fill: '#ebe2cb', stroke: INK, 'stroke-width': 0.9 }),
        circle(f.cx, f.cy, f.rotorInner, { fill: DISC, stroke: INK, 'stroke-width': 0.9 }),
        line(...Object.values(polar(f.cx, f.cy, f.outerTickInner + 1, logAngle(60))), ...Object.values(polar(f.cx, f.cy, f.rotorInner + 17, logAngle(60))), { stroke: '#d43b2f', 'stroke-width': 2, 'stroke-linecap': 'round' }),
        logScale({
            cx: f.cx,
            cy: f.cy,
            tickOuter: f.outerTickInner - 4,
            tickInner: f.rotorMiddle,
            textRadius: f.rotorMiddle + 5.5,
            tickColor: INK,
            textColor: INK,
            textStroke: '#ebe2cb',
            fine: true,
            labelValues: labels,
            fontSize: 7.8,
            majorLength: 9,
            midLength: 7,
            minorLength: 5,
            fineLength: 3.5,
            strokeScale: 0.58
        }),
        [
            [60, '1:00'], [70, '1:10'], [80, '1:20'], [90, '1:30'],
            [10, '1:40'], [11, '1:50'], [12, '2:00'], [15, '2:30'],
            [18, '3:00'], [21, '3:30'], [24, '4:00'], [27, '4:30'], [30, '5:00']
        ].map(([value, label]) => radialText(label, f.cx, f.cy, f.rotorInner + 12, logAngle(value), {
            fill: INK,
            stroke: '#f6f0dc',
            'stroke-width': 1.25,
            'paint-order': 'stroke',
            'font-family': 'Arial, sans-serif',
            'font-size': 8,
            'font-weight': 900
        })).join('\n'),
        radialText('RATE', f.cx, f.cy, f.rotorInner + 17, logAngle(60), { fill: '#d43b2f', 'font-family': 'Arial, sans-serif', 'font-size': 5.8, 'font-weight': 900 }),
        line(f.cx, f.cy - 70, f.cx, f.cy + 110, { stroke: INK, 'stroke-width': 1.6 }),
        line(f.cx - 150, f.cy + 28, f.cx + 150, f.cy + 28, { stroke: INK, 'stroke-width': 1.6 }),
        circle(f.cx, f.cy, 6, { fill: DISC, stroke: INK, 'stroke-width': 3 }),
        textEl('FOR', f.cx - 78, f.cy - 45, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 12, 'font-weight': 900 }),
        textEl('ALTITUDE', f.cx - 78, f.cy - 30, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 12, 'font-weight': 900 }),
        textEl('COMPUTATIONS', f.cx - 78, f.cy - 15, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 10, 'font-weight': 900 }),
        textEl('FOR TRUE', f.cx + 94, f.cy - 27, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 10.4, 'font-weight': 900 }),
        textEl('AIRSPEED', f.cx + 94, f.cy - 14, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 10.9, 'font-weight': 900 }),
        textEl('& DENSITY ALT.', f.cx + 94, f.cy - 1, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 8.6, 'font-weight': 900 }),
        textEl('DENSITY', f.cx, f.cy - 28, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 10.2, 'font-weight': 900 }),
        textEl('ALTITUDE', f.cx, f.cy - 15, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 10.2, 'font-weight': 900 }),
        textEl('FOR TIME AND DISTANCE', f.cx - 76, f.cy + 42, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 9.2, 'font-weight': 900 }),
        textEl('FOR FUEL CONSUMPTION', f.cx + 80, f.cy + 42, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 9.2, 'font-weight': 900 }),
        textEl('SPEED', f.cx - 90, f.cy + 100, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 8, 'font-weight': 800, transform: `rotate(-8 ${f.cx - 90} ${f.cy + 100})` }),
        textEl('DISTANCE', f.cx - 25, f.cy + 96, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 8, 'font-weight': 800, transform: `rotate(8 ${f.cx - 25} ${f.cy + 96})` }),
        textEl('G.P.H.', f.cx + 68, f.cy + 100, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 8, 'font-weight': 800, transform: `rotate(-8 ${f.cx + 68} ${f.cy + 100})` }),
        textEl('FUEL BURNED', f.cx + 135, f.cy + 96, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 8, 'font-weight': 800, transform: `rotate(8 ${f.cx + 135} ${f.cy + 96})` })
    ].join('\n')));
    body.push(tag('g', { id: 'front-reference-window-frames' }, [
        pathEl(windows.altitude, { fill: 'none', stroke: INK, 'stroke-width': 1.4 }),
        pathEl(windows.airspeedMiddle, { fill: 'none', stroke: INK, 'stroke-width': 1.4 }),
        pathEl(windows.airspeedInner, { fill: 'none', stroke: INK, 'stroke-width': 1.4 }),
        densityWindowScale(f, windows),
        rotorIndexArrows(f),
        textEl('AIR TEMPERATURE C', f.cx, f.cy - 165, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 5.8, 'font-weight': 900 }),
        textEl('PRESSURE ALTITUDE', f.cx, f.cy - 155, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 5.8, 'font-weight': 900 }),
        textEl('THOUSANDS OF FEET', f.cx, f.cy - 148, { fill: INK, 'font-family': 'Arial, sans-serif', 'font-size': 4.7, 'font-weight': 900 })
    ].join('\n')));
    return svgDocument({
        id: 'e6b-front-rotor',
        width: f.width,
        height: f.height,
        viewBox: f.viewBox.join(' '),
        defs: mask,
        body: tag('g', { id: 'front-rotor-reference-board', 'data-calibration': 'reference geometry; original artwork not copied' }, body.join('\n'))
    });
}

function write(name, content) {
    fs.writeFileSync(path.join(outDir, name), content, 'utf8');
}

fs.mkdirSync(outDir, { recursive: true });
write('front-fixed.svg', fixedFrontSvgReference());
write('front-rotor.svg', frontRotorSvgReference());
write('wind-grid.svg', windGridSvg());
write('wind-compass.svg', windCompassSvg());
write('calibration.json', `${JSON.stringify({
    generatedBy: 'tools/e6b-generate-assets.mjs',
    front: {
        viewBox: readReferenceSlideruleGeometry().viewBox,
        center: [readReferenceSlideruleGeometry().center.x, readReferenceSlideruleGeometry().center.y],
        logScale: 'angleDeg = 360 * log10(mantissa / 10)',
        referenceAngles: {
            '10': n(logAngle(10)),
            '20': n(logAngle(20)),
            '30': n(logAngle(30)),
            '60': n(logAngle(60)),
            '90': n(logAngle(90))
        }
    },
    wind: {
        gridViewBox: [0, 0, 1000, 1400],
        compassCenter: [500, 560],
        compassDegrees: '0 north, clockwise positive'
    },
    assets: [
        'front-fixed.svg',
        'front-rotor.svg',
        'wind-grid.svg',
        'wind-compass.svg'
    ]
}, null, 2)}\n`);

console.log(`Generated E6B SVG assets in ${outDir}`);
