import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetDir = path.join(__dirname, 'e6b-assets');
const frontReferencePath = path.join(assetDir, 'reference-front.svg');
const windReferencePath = path.join(assetDir, 'reference-wind.svg');

function extractGroup(svg, id) {
    const start = svg.indexOf(`<g id="${id}"`);
    if (start < 0) {
        throw new Error(`Group not found: ${id}`);
    }

    const tokenPattern = /<\/?g\b[^>]*>/g;
    tokenPattern.lastIndex = start;
    let depth = 0;
    let match;

    while ((match = tokenPattern.exec(svg))) {
        if (match[0].startsWith('</g')) {
            depth -= 1;
            if (depth === 0) {
                return svg.slice(start, tokenPattern.lastIndex);
            }
            continue;
        }
        depth += 1;
    }

    throw new Error(`Unclosed group: ${id}`);
}

function svgDocument({ id, width, height, viewBox, source, body }) {
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" id="${id}" width="${width}px" height="${height}px" viewBox="${viewBox}" xml:space="preserve" role="img">`,
        `<!-- Extracted from ${source} for temporary E6B reference-layer reconstruction. -->`,
        body,
        '</svg>',
        ''
    ].join('\n');
}

const frontReference = fs.readFileSync(frontReferencePath, 'utf8');
const frontFixed = extractGroup(frontReference, 'tas-base');
const frontRotor = extractGroup(frontReference, 'tas-dial');

fs.writeFileSync(path.join(assetDir, 'reference-front-fixed.svg'), svgDocument({
    id: 'e6b-reference-front-fixed',
    width: 510,
    height: 590,
    viewBox: '0 0 510 590',
    source: 'reference-front.svg',
    body: frontFixed
}), 'utf8');
fs.writeFileSync(path.join(assetDir, 'reference-front-rotor.svg'), svgDocument({
    id: 'e6b-reference-front-rotor',
    width: 510,
    height: 590,
    viewBox: '0 0 510 590',
    source: 'reference-front.svg',
    body: frontRotor
}), 'utf8');

if (fs.existsSync(windReferencePath)) {
    const windReference = fs.readFileSync(windReferencePath, 'utf8');
    const windFixed = extractGroup(windReference, 'tas-arc');
    const windIndex = extractGroup(windReference, 'true-index');
    const windPlot = extractGroup(windReference, 'plot-group');

    fs.writeFileSync(path.join(assetDir, 'reference-wind-fixed.svg'), svgDocument({
        id: 'e6b-reference-wind-fixed',
        width: 510,
        height: 1000,
        viewBox: '0 0 510 1000',
        source: 'reference-wind.svg',
        body: windFixed
    }), 'utf8');
    fs.writeFileSync(path.join(assetDir, 'reference-wind-index.svg'), svgDocument({
        id: 'e6b-reference-wind-index',
        width: 510,
        height: 1000,
        viewBox: '0 0 510 1000',
        source: 'reference-wind.svg',
        body: windIndex
    }), 'utf8');
    fs.writeFileSync(path.join(assetDir, 'reference-wind-plot.svg'), svgDocument({
        id: 'e6b-reference-wind-plot',
        width: 510,
        height: 1000,
        viewBox: '0 0 510 1000',
        source: 'reference-wind.svg',
        body: windPlot
    }), 'utf8');
}

console.log('Extracted E6B reference layers');
