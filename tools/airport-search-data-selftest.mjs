import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolDir, '..');
const appSource = await fs.readFile(path.join(rootDir, 'app.js'), 'utf8');

await import(path.join(rootDir, 'airport-type-filter.js'));
const airportTypes = globalThis.gaAirportTypes;

function extractFunction(name) {
    const marker = `function ${name}`;
    const start = appSource.indexOf(marker);
    assert.notEqual(start, -1, `${name} missing from app.js`);
    const signatureEnd = appSource.indexOf(') {', start);
    assert.notEqual(signatureEnd, -1, `${name} signature end missing`);
    const bodyStart = signatureEnd + 2;
    let depth = 0;
    let quote = '';
    let escaped = false;
    for (let index = bodyStart; index < appSource.length; index += 1) {
        const char = appSource[index];
        if (quote) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === quote) quote = '';
            continue;
        }
        if (char === '"' || char === "'" || char === '`') {
            quote = char;
            continue;
        }
        if (char === '{') depth += 1;
        else if (char === '}') {
            depth -= 1;
            if (depth === 0) return appSource.slice(start, index + 1);
        }
    }
    throw new Error(`Could not extract ${name}`);
}

const functionNames = [
    'normalizeAirportIdent',
    'openAipAirportStableIdent',
    'airportRealIcao',
    'openAipElevationFeet',
    'parseOpenAipAirportType',
    'normalizeOpenAipAirportRecord',
    'buildAirportDispatchRecord',
    'airportLookupRecordKey',
    'compactAirportLookupRecord'
];
const factory = new Function('window', `${functionNames.map(extractFunction).join('\n')}\nreturn { ${functionNames.join(', ')} };`);
const api = factory({ gaAirportTypes: airportTypes });

const alsfeld = api.normalizeOpenAipAirportRecord({
    _id: '62614a37cb27f42509443db0',
    name: 'ALSFELD',
    type: 1,
    country: 'DE',
    geometry: { type: 'Point', coordinates: [9.248516944444445, 50.75055] },
    elevation: { value: 290, unit: 0 },
    ppr: false,
    private: false,
    winchOnly: false
}, { source: 'openaip-search' });

assert.ok(alsfeld, 'OpenAIP glider record should normalize');
assert.equal(alsfeld.icao, 'OA-09443DB0');
assert.equal(alsfeld.openAipType, 1);
assert.equal(alsfeld.airportTypeCategory, 'glider');
assert.equal(alsfeld.elevation, 951);
assert.equal(airportTypes.matches(alsfeld, ['glider']), true);
assert.equal(airportTypes.matches(alsfeld, ['traffic', 'ga']), false);

const wasserkuppe = api.normalizeOpenAipAirportRecord({
    _id: '62614abb5e9ded5710445c73',
    name: 'WASSERKUPPE',
    icaoCode: 'EDER',
    type: 2,
    country: 'DE',
    geometry: { type: 'Point', coordinates: [9.954027777777778, 50.49877222222222] },
    elevation: { value: 884, unit: 0 },
    ppr: true
});

assert.equal(wasserkuppe.icao, 'EDER');
assert.equal(wasserkuppe.icaoCode, 'EDER');
assert.equal(wasserkuppe.airportTypeCategory, 'ga');

const legacy = api.buildAirportDispatchRecord('EDTW', {
    icao: 'EDTW',
    name: 'Winzeln-Schramberg',
    lat: 48.2794,
    lon: 8.4283,
    type: ''
});
assert.equal(legacy.openAipType, null, 'empty legacy type must remain untyped');
assert.equal(legacy.airportTypeCategory, 'ga');

const compact = api.compactAirportLookupRecord(alsfeld);
assert.equal(compact.icao, 'OA-09443DB0');
assert.equal(compact.openAipType, 1);
assert.equal(compact.sourceId, '62614a37cb27f42509443db0');
assert.equal(compact.source, 'openaip-search');

console.log('Airport search data self-test passed.');
