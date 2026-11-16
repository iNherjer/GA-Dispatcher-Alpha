import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// Feldtest 15.11.2026 (Freiburg): Overpass war ueberlastet und die OSM-Karten-API lehnt den
// 1,4-km-Ausschnitt einer Stadtnaehe ab („too many nodes“). Ohne Kartendaten keine Empfangsszene.
const core = fs.readFileSync(new URL('../mission-arrival-core.js', import.meta.url), 'utf8');
const osm = JSON.parse(fs.readFileSync(new URL('fixtures/arrival-edtw-osm-20261021.json', import.meta.url), 'utf8'));

function setup(handler) {
  const storage = new Map();
  const sessionStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k), key: i => [...storage.keys()][i] ?? null, get length() { return storage.size; } };
  const calls = [];
  const events = [];
  class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
  const c = vm.createContext({ CustomEvent, window: { dispatchEvent: e => events.push(e.detail) }, console: { warn() {}, log() {}, debug() {} }, Map, sessionStorage, AbortController, setTimeout, clearTimeout,
    fetch: async (url, opts) => { calls.push(String(url)); return handler(String(url), opts, calls); } });
  vm.runInContext(core, c);
  c.aptArrivalParseOsmMapXml = () => osm;
  c.normalizeAptArrivalRole = () => ({ role: 'charter_pickup', personRole: 'person.ground_crew', vehicleRole: 'vehicle.car' });
  c.normalizeMissionType = () => 'apt';
  const plan = c.buildAptArrivalPlan({ dest: { lat: 48.27917, lon: 8.42833, icao: 'EDTW' }, heading: 75 });
  return { c, plan, calls, storage, events };
}
const res = (status, body = '') => ({ ok: status >= 200 && status < 300, status, json: async () => JSON.parse(body), text: async () => body });

test('Overpass down on both servers, OSM map too big at 1400 m: retries smaller and finds the apron', async () => {
  const { c, plan, calls, events } = setup(url => {
    if (url.includes('interpreter')) return res(429);
    if (calls.filter(u => u.includes('/map?')).length === 1) return res(400, 'You requested too many nodes (limit is 50000). Either request a smaller area, or use planet.osm');
    return res(200, '<osm/>');
  });
  const resolved = await c.resolveAptArrivalPlanPlacement(plan);
  assert.equal(resolved.snapStatus.status, 'resolved');
  assert.equal(resolved.snapStatus.spawnAllowed, true);
  assert.equal(resolved.snapStatus.osmMapRadiusM, 900);
  assert.equal(calls.filter(u => u.includes('interpreter')).length, 2, 'both Overpass servers tried');
  assert.ok(calls.some(u => u.includes('overpass.private.coffee')));
  assert.deepEqual(events.map(e => e.stage), ['retry', 'retry', 'retry', 'done'], 'pilot sees each step');
  assert.match(events[0].text, /anderen Server, bitte hab etwas Geduld/);
  assert.match(events[1].text, /auf anderem Weg/);
  assert.match(events[2].text, /zu groß/);
});

test('a normal successful fetch stays silent', async () => {
  const { c, plan, events } = setup(() => res(200, JSON.stringify(osm)));
  const resolved = await c.resolveAptArrivalPlanPlacement(plan);
  assert.equal(resolved.snapStatus.status, 'resolved');
  assert.equal(events.length, 0);
});

test('total failure marks the plan, cools the servers down, and a forced retry asks again', async () => {
  let down = true;
  const { c, plan, calls, storage, events } = setup(url => {
    if (down) return url.includes('interpreter') ? res(504) : res(503);
    return url.includes('overpass-api.de') ? res(200, JSON.stringify(osm)) : res(500);
  });
  const failed = await c.resolveAptArrivalPlanPlacement(plan);
  assert.equal(failed.snapStatus.spawnAllowed, false);
  assert.equal(failed.snapStatus.reason, 'overpass_unavailable');
  assert.equal(failed.snapStatus.geoFetchFailed, true);
  assert.equal(events.at(-1).stage, 'failed');
  assert.match(events.at(-1).text, /ohne Kartendaten/);
  assert.deepEqual([...failed.snapStatus.geoFetchErrors], ['overpass-api.de:overpass_http_504', 'overpass.private.coffee:overpass_http_504', 'osm-map:1400m:osm_map_http_503']);
  const before = calls.length;
  const again = await c.resolveAptArrivalPlanPlacement(plan);
  assert.equal(calls.length, before, 'cooldown: no request right after a failure (accept after generation)');
  assert.ok(again.snapStatus.geoFetchErrors.every(e => e.endsWith(':cooldown')));
  down = false;
  storage.clear();
  const retried = await c.resolveAptArrivalPlanPlacement(failed, { force: true });
  assert.equal(retried.snapStatus.status, "resolved");
  assert.equal(retried.snapStatus.geoFetchFailed, undefined);
  assert.ok(retried.placementGeometry);
});

// Feldtest 16.11.2026: OSM-Map lief bei 1400 m in die Zeitgrenze und der Ersatzweg gab auf.
test('OSM map timeout at the large window steps down to a smaller one', async () => {
  const { c, plan, calls, events } = setup((url, opts) => {
    if (url.includes('interpreter')) return res(502);
    if (calls.filter(u => u.includes('/map?')).length === 1) { const e = new Error('aborted'); e.name = 'AbortError'; throw e; }
    return res(200, '<osm/>');
  });
  const resolved = await c.resolveAptArrivalPlanPlacement(plan);
  assert.equal(resolved.snapStatus.status, 'resolved');
  assert.equal(resolved.snapStatus.osmMapRadiusM, 900);
  assert.ok(events.some(e => /sehr langsam/.test(e.text)));
});

test('service worker never routes Overpass mirrors or the OSM map API through its cache', () => {
  const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const list = sw.slice(sw.indexOf('const NETWORK_ONLY'), sw.indexOf('];', sw.indexOf('const NETWORK_ONLY')));
  const core = fs.readFileSync(new URL('../mission-arrival-core.js', import.meta.url), 'utf8');
  for (const host of ['overpass-api.de', 'overpass.private.coffee', 'api.openstreetmap.org']) assert.ok(list.includes(`'${host}'`), host);
  assert.match(core, /'https:\/\/overpass\.private\.coffee\/api\/interpreter'/);
});
