import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modulePath = path.join(__dirname, '..', 'mission-poi-chain-runtime.js');
const code = fs.readFileSync(modulePath, 'utf8');
const context = {
    window: {},
    console,
    Date,
    Math,
    Set,
    Map,
    Number,
    String,
    Array,
    Object,
    JSON
};
vm.createContext(context);
vm.runInContext(code, context, { filename: modulePath });

const api = context.window.missionPoiChainRuntime?._test;
if (!api) throw new Error('missionPoiChainRuntime test API unavailable');

function assertOk(condition, message) {
    if (!condition) throw new Error(message);
}

const spec = api.normalizeSpec({
    key: 'poi-chain-selftest',
    label: 'POI-Kette Test',
    corridor: { enabled: false },
    points: [
        { id: 'p1', name: 'Punkt 1', lat: 48.1, lon: 8.2, triggerRadiusNm: 0.5 },
        { id: 'p2', name: 'Punkt 2', lat: 48.11, lon: 8.21, triggerRadiusNm: 0.5 }
    ]
});

let state = api.createInitialState(spec);
const initialVisualKey = api.overlayVisualKey(spec, state);

let result = api.tickState(spec, state, {
    lat: 48.1,
    lon: 8.2,
    headingDeg: 45,
    gsKts: 95,
    nowMs: 100
});
state = result.state;
assertOk(result.events.some(event => event.type === 'point_complete'), 'first point should trigger at 10 Hz sample');
assertOk(state.currentIndex === 1, 'chain should advance to second point');
assertOk(api.overlayVisualKey(spec, state) !== initialVisualKey, 'semantic progress must invalidate overlay');

const stableVisualKey = api.overlayVisualKey(spec, state);
result = api.tickState(spec, state, {
    lat: 48.1,
    lon: 8.18,
    headingDeg: 45,
    gsKts: 95,
    nowMs: 200
});
state = result.state;
assertOk(api.overlayVisualKey(spec, state) === stableVisualKey, 'timestamp-only tick must not invalidate overlay');

result = api.tickState(spec, state, {
    lat: 48.11,
    lon: 8.21,
    headingDeg: 45,
    gsKts: 95,
    nowMs: 300
});
assertOk(result.state.completedPointIds.has('p2'), 'second point should trigger on next 10 Hz sample');
assertOk(result.events.some(event => event.type === 'point_complete'), 'second point completion event missing');

console.log('[ok] poi-chain runtime selftest');
