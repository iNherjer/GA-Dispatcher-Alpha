import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { declaration } from './gemini-migration-harness.mjs';
// POI-Zielkontext wie die Flughafen-Ankunft gehaertet (19.11.2026): zwei Overpass-Server, gemeinsame
// Pause nach Fehlern, OSM-Karte als Ersatz fuer alle POI-Missionen, Orientierungspunkte zuletzt.
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const core = fs.readFileSync(new URL('../mission-arrival-core.js', import.meta.url), 'utf8');
const constLine = name => app.match(new RegExp(`const ${name} = [^\\n]+`))[0];
const res = (status, body = '') => ({ ok: status >= 200 && status < 300, status, json: async () => JSON.parse(body), text: async () => body });

function setup(handler, { reporter = false } = {}) {
    const store = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k), key: i => [...m.keys()][i] ?? null, get length() { return m.size; } }; };
    const calls = [];
    const c = vm.createContext({ console: { warn() {}, log() {} }, Map, Set, AbortController, setTimeout, clearTimeout, sessionStorage: store(), localStorage: store(),
        fetch: async (url, opts) => { calls.push(String(url)); return handler(String(url), opts, calls); } });
    c.window = c;
    vm.runInContext(core, c); // gemeinsame Pause (aptArrivalGeoCooldown*)
    for (const name of ['MISSION_TARGET_GEO_CONTEXT_RADIUS_M', 'MISSION_TARGET_GEO_CONTEXT_TTL_MS', 'missionTargetGeoContextInflight', 'MISSION_TARGET_OVERPASS_ENDPOINTS', 'MISSION_TARGET_OSM_MAP_ENDPOINT']) vm.runInContext(constLine(name), c);
    for (const name of ['missionGeoCooldownActive', 'missionGeoCooldownSet', 'missionGeoCooldownClear', 'fetchMissionTargetGeoContext', 'fetchReporterSceneMapFallback']) vm.runInContext(declaration(app, name), c);
    c.GAMissionStorageCore = { prune() {}, writeGeo() {} };
    c.MissionReporterSceneCore = { enabled: () => reporter, geometry: () => ({ placement: 'reporter' }) };
    c.missionTargetGeoContextCacheKey = (lat, lon, r) => `geo_${lat}_${lon}_${r}`;
    c.fetchMissionLocalVisualLandmarks = async () => [{ kind: 'peak', name: 'Feldberg' }];
    c.normalizeMissionTargetGeoContext = (raw, lat, lon, radiusM) => ({ elements: raw.elements.length, radiusM });
    c.mergeMissionVisualLandmarks = (ctx, landmarks) => ({ ...(ctx || {}), landmarks: landmarks.length });
    const mapCalls = [];
    c.fetchMissionTargetOsmMapRaw = async (lat, lon, radii) => { mapCalls.push(radii || 'default'); return { raw: { elements: [1, 2, 3] }, radiusM: 500 }; };
    return { c, calls, mapCalls, md: { isPOI: true, targetLat: 47.87, targetLon: 8.0 } };
}

test('second Overpass server answers when the first is overloaded', async () => {
    const { c, calls, md } = setup(url => url.includes('overpass-api.de') ? res(502) : res(200, JSON.stringify({ elements: [1, 2] })));
    const ctx = await c.fetchMissionTargetGeoContext(md);
    assert.equal(ctx.elements, 2);
    assert.deepEqual(calls, ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']);
});

test('a failed server is skipped for a while, also by the arrival scene (shared pause)', async () => {
    const { c, calls, md } = setup(url => url.includes('overpass-api.de') ? res(502) : res(200, JSON.stringify({ elements: [1] })));
    await c.fetchMissionTargetGeoContext(md);
    assert.equal(c.aptArrivalGeoCooldownActive('https://overpass-api.de/api/interpreter'), true);
    calls.length = 0;
    await c.fetchMissionTargetGeoContext({ ...md, targetLat: 47.9 });
    assert.deepEqual(calls, ['https://overpass.private.coffee/api/interpreter'], 'paused server not asked again');
});

test('both servers down: every POI mission falls back to the OSM map with landmarks', async () => {
    const { c, mapCalls, md } = setup(() => res(504));
    const ctx = await c.fetchMissionTargetGeoContext(md);
    assert.equal(ctx.source, 'osm-map');
    assert.equal(ctx.elements, 3);
    assert.equal(ctx.landmarks, 1, 'tile landmarks merged');
    assert.deepEqual(mapCalls, ['default']);
});

test('reporter missions keep their own map fallback with the reporter placement', async () => {
    const { c, mapCalls, md } = setup(() => res(504), { reporter: true });
    const ctx = await c.fetchMissionTargetGeoContext(md);
    assert.equal(ctx.source, 'osm-api');
    assert.equal(ctx.reporterPlacement.placement, 'reporter');
    assert.equal(JSON.stringify(mapCalls), JSON.stringify([[800, 500, 350]]));
});

test('OSM map down as well: landmarks from the tiles stay the last resort', async () => {
    const { c, md } = setup(() => res(504));
    c.fetchMissionTargetOsmMapRaw = async () => null;
    const ctx = await c.fetchMissionTargetGeoContext(md);
    assert.equal(ctx.landmarks, 1);
    assert.equal(ctx.source, undefined);
});
