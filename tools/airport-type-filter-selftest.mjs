import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolDir, '..');

await import(path.join(rootDir, 'airport-type-filter.js'));
const api = globalThis.gaAirportTypes;

assert.ok(api, 'airport type API missing');
assert.equal(api.groups.length, 8, 'expected eight selectable groups');
assert.deepEqual(api.defaultIds, ['traffic', 'ga']);

assert.equal(api.classify({ type: 2, ppr: false, private: false }), 'traffic');
assert.equal(api.classify({ type: 2, ppr: true }), 'ga');
assert.equal(api.classify({ type: 1 }), 'glider');
assert.equal(api.classify({ type: 6 }), 'ultralight');
assert.equal(api.classify({ type: 4 }), 'military');
assert.equal(api.classify({ type: 5 }), 'military');
assert.equal(api.classify({ type: 7 }), 'heli');
assert.equal(api.classify({ type: 10 }), 'water');
assert.equal(api.classify({ type: 11 }), 'strips');
assert.equal(api.classify({ type: 12 }), 'strips');
assert.equal(api.classify({ type: 13 }), 'strips');
assert.equal(api.classify({ type: 8 }), 'closed');

assert.equal(api.classify({ type: 'large_airport' }), 'traffic');
assert.equal(api.classify({ type: 'small_airport' }), 'ga');
assert.equal(api.classify({ type: 'heliport' }), 'heli');
assert.equal(api.classify({ type: 'seaplane_base' }), 'water');

api.setSelected(['glider', 'ultralight'], { persist: false, emit: false });
assert.equal(api.matches({ type: 1 }), true);
assert.equal(api.matches({ type: 6 }), true);
assert.equal(api.matches({ type: 9 }), false);
assert.equal(api.matches({ type: 8 }), false, 'closed airports must never match');

api.setSelected([], { persist: false, emit: false });
assert.deepEqual(api.getSelected(), ['traffic', 'ga'], 'empty selections must restore safe defaults');

const appSource = await fs.readFile(path.join(rootDir, 'app.js'), 'utf8');
const indexSource = await fs.readFile(path.join(rootDir, 'index.html'), 'utf8');
const swSource = await fs.readFile(path.join(rootDir, 'sw.js'), 'utf8');

assert.match(appSource, /const regionPref = 'any';/);
assert.match(appSource, /missionAirportMatchesTypeFilter\(apt, selectedTypes\)/);
assert.match(appSource, /fetchOpenAipDispatchAirports\(lat, lon, maxNM, regionPref\)/);
assert.match(appSource, /destinationAirportType:/);
assert.match(indexSource, /id="airportTypePickerDialog"/);
assert.match(indexSource, /id="airportTypeFilterButton"/);
assert.match(indexSource, /id="airportTypeFilterRadioButton"/);
assert.match(indexSource, /id="opsAirportTypeButton"/);
assert.match(swSource, /\.\/airport-type-filter\.js/);

console.log('Airport type filter self-test passed.');
