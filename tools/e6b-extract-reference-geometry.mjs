import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputPath = process.argv[2];
const outPath = process.argv[3] || path.join(__dirname, 'e6b-assets', 'reference-sliderule-geometry.json');

if (!inputPath) {
    console.error('Usage: node tools/e6b-extract-reference-geometry.mjs <reference-html-or-svg> [out-json]');
    process.exit(1);
}

const raw = fs.readFileSync(inputPath, 'utf8');
const svgMatch = raw.match(/<svg\b[\s\S]*?<\/svg>/i);
if (!svgMatch) {
    throw new Error(`No SVG block found in ${inputPath}`);
}

const svg = svgMatch[0];
const viewBox = (svg.match(/viewBox="([^"]+)"/i)?.[1] || '')
    .trim()
    .split(/\s+/)
    .map(Number);

function round(value, digits = 4) {
    const factor = 10 ** digits;
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function numberList(text) {
    return [...text.matchAll(/-?\d+(?:\.\d+)?/g)].map(match => Number(match[0]));
}

function getElementById(id) {
    const pattern = new RegExp(`<([a-zA-Z]+)\\b(?=[^>]*\\bid="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}")[^>]*>`, 'i');
    return svg.match(pattern)?.[0] || null;
}

function getGroupSlice(id, nextId) {
    const start = svg.indexOf(`id="${id}"`);
    if (start < 0) return '';
    const groupStart = svg.lastIndexOf('<g', start);
    if (groupStart < 0) return '';
    if (!nextId) return svg.slice(groupStart);
    const next = svg.indexOf(`id="${nextId}"`, start + id.length);
    if (next < 0) return svg.slice(groupStart);
    return svg.slice(groupStart, svg.lastIndexOf('<g', next));
}

function bboxFromNumbers(section) {
    const xs = [];
    const ys = [];
    for (const match of section.matchAll(/\b(x1|x2|x|cx)="(-?\d+(?:\.\d+)?)"|\b(y1|y2|y|cy)="(-?\d+(?:\.\d+)?)"/g)) {
        if (match[1]) xs.push(Number(match[2]));
        if (match[3]) ys.push(Number(match[4]));
    }
    for (const dMatch of section.matchAll(/\bd="([^"]+)"/g)) {
        const nums = numberList(dMatch[1]);
        for (let i = 0; i + 1 < nums.length; i += 2) {
            xs.push(nums[i]);
            ys.push(nums[i + 1]);
        }
    }
    if (!xs.length || !ys.length) return null;
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
        x: round(minX),
        y: round(minY),
        width: round(maxX - minX),
        height: round(maxY - minY),
        cx: round((minX + maxX) / 2),
        cy: round((minY + maxY) / 2)
    };
}

function parseTranslateX(element) {
    return Number(element?.match(/transform="translate\((-?\d+(?:\.\d+)?)(?:[ ,][^)]+)?\)"/)?.[1] || 0);
}

const baseEl = getElementById('Base');
const discEl = getElementById('Disc');
const middleCircleEl = getElementById('middle_circle');
const translateX = parseTranslateX(baseEl);

const discNums = numberList(discEl || '');
const discRawCenter = {
    x: discNums[0],
    yTop: discNums[1]
};
const center = {
    x: round(viewBox[0] + viewBox[2] / 2),
    y: round(viewBox[1] + viewBox[3] / 2)
};
const discOuterRadius = round(center.y - discRawCenter.yTop);

function lineTicksWithAttribute(attributeName) {
    const re = new RegExp(`<line\\b([^>]*\\b${attributeName}="([^"]+)"[^>]*)>`, 'g');
    return [...svg.matchAll(re)].map(match => {
        const attrs = match[1];
        const value = match[2];
        const x1 = Number(attrs.match(/\bx1="([^"]+)"/)?.[1]);
        const y1 = Number(attrs.match(/\by1="([^"]+)"/)?.[1]);
        const x2 = Number(attrs.match(/\bx2="([^"]+)"/)?.[1]);
        const y2 = Number(attrs.match(/\by2="([^"]+)"/)?.[1]);
        const r1 = Math.hypot(x1 - center.x, y1 - center.y);
        const r2 = Math.hypot(x2 - center.x, y2 - center.y);
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const angle = (Math.atan2(mx - center.x, center.y - my) * 180 / Math.PI + 360) % 360;
        return {
            value: Number(value),
            angleDeg: round(angle, 3),
            rOuter: round(Math.max(r1, r2), 3),
            rInner: round(Math.min(r1, r2), 3),
            length: round(Math.hypot(x2 - x1, y2 - y1), 3)
        };
    });
}

function simplifyTicks(ticks) {
    const byValue = new Map();
    ticks.forEach(tick => {
        if (!byValue.has(tick.value)) byValue.set(tick.value, tick);
    });
    return [...byValue.values()].sort((a, b) => a.value - b.value);
}

const outerTicks = simplifyTicks(lineTicksWithAttribute('e6b-value'));
const innerTicks = simplifyTicks(lineTicksWithAttribute('e6b-inner-value'));
const rateLocation = innerTicks.find(tick => tick.value === 60) || null;

const geometry = {
    source: {
        note: 'Derived geometry only; original SVG/HTML is not copied into the repo.',
        inputFile: path.basename(inputPath)
    },
    viewBox,
    referenceTransform: {
        commonTranslateX: round(translateX)
    },
    center,
    frontBoard: {
        base: bboxFromNumbers(baseEl || ''),
        outline: bboxFromNumbers(getElementById('Outline') || ''),
        disc: {
            center,
            outerRadius: discOuterRadius,
            outerCutoutRadius: 213.1,
            middleRingOuterRadius: 185.1,
            innerDiscRadius: 160
        },
        pivot: {
            bbox: bboxFromNumbers(middleCircleEl || '')
        }
    },
    namedLayerBounds: {
        outerTickMarks: bboxFromNumbers(getGroupSlice('Tick_Marks_-_Outer_Ring', 'Outer_Numbers')),
        outerNumbers: bboxFromNumbers(getGroupSlice('Outer_Numbers', 'Tick_Marks-2')),
        middleInnerNumbers: bboxFromNumbers(getGroupSlice('Middle_Inner_Numbers', 'Tick_Marks-4')),
        innerTickMarks: bboxFromNumbers(getGroupSlice('Tick_Marks-4', 'Outer')),
        rotorOuterWindow: bboxFromNumbers(getElementById('Tutorial_Outer_Inner_Ring-Window') || ''),
        rotorMiddleWindow: bboxFromNumbers(getElementById('Tutorial_Outer_Middle_Ring-Window') || ''),
        window2: bboxFromNumbers(getGroupSlice('Window_2', 'Pressure_Thousands')),
        window3: bboxFromNumbers(getGroupSlice('Window_3', 'Small_Outer_Text')),
        airspeed: bboxFromNumbers(getGroupSlice('Airspeed', 'Set_MPH'))
    },
    logScale: {
        outerTickCount: outerTicks.length,
        innerReferenceTickCount: innerTicks.length,
        rateLocation,
        outerTicks: outerTicks.filter(tick => [10, 11, 12, 13, 14, 15, 20, 30, 40, 50, 60, 70, 80, 90].includes(tick.value))
    }
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(geometry, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outPath}`);
