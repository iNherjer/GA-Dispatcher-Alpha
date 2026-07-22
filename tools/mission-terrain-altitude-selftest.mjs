import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const taws = fs.readFileSync(path.join(root, 'taws.js'), 'utf8');
const sync = fs.readFileSync(path.join(root, 'sync.js'), 'utf8');

function section(source, start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0, `section start missing: ${start}`);
    assert.ok(to > from, `section end missing: ${end}`);
    return source.slice(from, to);
}

const altitudeCore = section(
    app,
    'function resolvePoiAltitudeTerrainFt',
    'const TRAINING_AIRWORK_ITEMS'
);
const context = { Math, Number, String, Set };
vm.createContext(context);
vm.runInContext(altitudeCore, context, { filename: 'app.js#mission-terrain-altitude' });

assert.equal(context.resolvePoiAltitudeTerrainFt(1200, 3200), 3200);
assert.equal(context.resolvePoiAltitudeTerrainFt(1200, null), 1200);
assert.equal(context.resolvePoiAltitudeTerrainFt(null, null), null);
assert.equal(context.minimumPoiWorkAltitudeFt(3200, { taskDomain: 'inspection_infra' }), 4000);
assert.equal(context.minimumPoiWorkAltitudeFt(3200, { taskDomain: 'general' }), 4300);

const technical = context.enforcePoiPassengerAltitudeRule({
    taskDomain: 'inspection_infra',
    targetAltFt: 2500,
    targetRadiusNm: 2,
    targetDwellMin: 2
}, true, 3200);
assert.equal(technical.targetAltFt, 4000, 'technical band must keep its lower edge 500 ft above terrain');

const general = context.enforcePoiPassengerAltitudeRule({
    taskDomain: 'general',
    targetAltFt: 2500,
    targetRadiusNm: 2,
    targetDwellMin: 2
}, true, 3200);
assert.equal(general.targetAltFt, 4500, 'general band must include its wider tolerance in the terrain floor');

const alreadyHigh = context.enforcePoiPassengerAltitudeRule({
    taskDomain: 'inspection_infra',
    targetAltFt: 6000,
    targetRadiusNm: 2,
    targetDwellMin: 2
}, true, 3200);
assert.equal(alreadyHigh.targetAltFt, 6000);

const routeOnly = context.enforcePoiPassengerAltitudeRule({
    taskDomain: 'charter',
    targetAltFt: 6000,
    targetRadiusNm: 2,
    targetDwellMin: 2
}, false, 3200);
assert.equal(routeOnly.targetAltFt, 0, 'A-B missions must not gain a POI work altitude');

assert.match(taws, /const TAWS_MISSION_TERRAIN_ZOOM = 12/);
assert.match(taws, /async function sampleTerrainEnvelope\(/);
assert.match(taws, /window\.sampleTerrainEnvelope = sampleTerrainEnvelope/);
assert.match(app, /fetchPoiTerrainEnvelopeFt\(dest\.lat, dest\.lon, 1\)/);
assert.match(app, /enforcePoiPassengerAltitudeRule\(m\.passenger, isPOI, effectiveWorkAreaTerrainFt, poiTaskDefaults\)/);
assert.match(app, /'poiTerrainFt', 'poiTerrainMaxFt', 'poiTerrainRadiusNm', 'poiTerrainEnvelope'/);
assert.match(sync, /'poiTerrainFt', 'poiTerrainMaxFt', 'poiTerrainRadiusNm', 'poiTerrainEnvelope'/);

console.log('[ok] mission terrain altitude selftest');
