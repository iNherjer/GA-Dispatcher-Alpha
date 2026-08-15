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

const legacyCorridorSpec = api.normalizeSpec({
    schema: 'ga.poiChain.v1',
    key: 'poi-chain-legacy-width',
    label: 'Legacy-Korridor',
    overlay: {
        widthNm: 0.6,
        trace: [
            { lat: 48.0, lon: 8.0 },
            { lat: 48.1, lon: 8.0 }
        ]
    },
    points: [
        { id: 'legacy-p1', lat: 48.0, lon: 8.0 },
        { id: 'legacy-p2', lat: 48.1, lon: 8.0 }
    ]
});
assertOk(legacyCorridorSpec.overlay.widthNm === 2.4, 'legacy 0.6 NM corridor should migrate to 2.4 NM');
assertOk(legacyCorridorSpec.corridor.crossTrackToleranceNm === 1.2, '2.4 NM corridor should allow 1.2 NM per side');
const renormalizedCorridorSpec = api.normalizeSpec(legacyCorridorSpec);
assertOk(renormalizedCorridorSpec.overlay.widthNm === 2.4, 'runtime normalization must not multiply corridor width twice');
assertOk(renormalizedCorridorSpec.corridor.crossTrackToleranceNm === 1.2, 'runtime tolerance must remain stable after normalization');

const currentCorridorSpec = api.normalizeSpec({
    schema: 'ga.poiChain.v1',
    key: 'poi-chain-current-width',
    label: 'Aktueller Korridor',
    overlay: {
        widthNm: 2.4,
        widthVersion: 2,
        trace: [
            { lat: 48.0, lon: 8.0 },
            { lat: 48.1, lon: 8.0 }
        ]
    },
    points: [
        { id: 'current-p1', lat: 48.0, lon: 8.0 },
        { id: 'current-p2', lat: 48.1, lon: 8.0 }
    ]
});
assertOk(currentCorridorSpec.overlay.widthNm === 2.4, 'current corridor width must remain literal');
assertOk(currentCorridorSpec.corridor.crossTrackToleranceNm === 1.2, 'current corridor should use half its visual width as tolerance');

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
