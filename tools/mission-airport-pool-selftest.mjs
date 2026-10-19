import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

await import('../airport-type-filter.js');
const types = globalThis.gaAirportTypes;
const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function extract(name) {
    const match = new RegExp(`^(?:async )?function ${name}\\(`, 'm').exec(source);
    assert.ok(match, name);
    const rest = source.slice(match.index);
    const end = rest.search(/\n(?:async )?function |\nwindow\./);
    return end < 0 ? rest : rest.slice(0, end);
}
function nav(lat, lon, targetLat, targetLon) {
    const rad = Math.PI / 180;
    const dlat = (targetLat - lat) * rad, dlon = (targetLon - lon) * rad;
    const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat * rad) * Math.cos(targetLat * rad) * Math.sin(dlon / 2) ** 2;
    return { dist: 3440.065 * 2 * Math.asin(Math.min(1, Math.sqrt(a))), brng: targetLon >= lon ? 90 : 270 };
}
const airport = (icao, type, lon, extra = {}) => ({ icao, name: icao, lat: 0, lon, type, country: 'BW', ...extra });
let hosted = [], database = {}, loads = 0, failHosted = false, failLocal = false;
const math = Object.create(Math); math.random = () => 0;
const context = { console, Math: math, window: { gaAirportTypes: types }, globalAirports: database,
    currentStartICAO: 'HOME', faaLocalAirportsSupplementPromise: null,
    calcNav: nav, checkBearing: (bearing, direction) => direction === 'any' || (direction === 'east' && bearing === 90),
    loadGlobalAirports: async () => { loads += 1; if (failLocal) throw Error('local unavailable'); },
    fetchOpenAipDispatchAirports: async () => { if (failHosted) throw Error('hosted unavailable'); return hosted; }
};
vm.createContext(context);
['normalizeAirportIdent', 'airportIdentMatches', 'openAipAirportStableIdent', 'airportRealIcao',
    'parseOpenAipAirportType', 'buildAirportDispatchRecord', '_airportMatchesRegionPref',
    'getSelectedMissionAirportTypeIds', 'missionAirportMatchesTypeFilter', 'normalizeMissionText',
    'scoreBushAirportCandidate', 'collectMissionAirportPool', 'findGithubAirport', 'findBushAirport',
    'collectMissionProposalAirportCandidates'].forEach(name => vm.runInContext(extract(name), context));

function reset(local, remote, selection = ['traffic', 'ga']) {
    database = local; context.globalAirports = local; hosted = remote; failHosted = false; failLocal = false;
    context.faaLocalAirportsSupplementPromise = null;
    types.setSelected(selection, { persist: false, emit: false });
}
reset({ 'OUR-1': airport('OUR-1', 'small_airport', 0.5) }, [airport('FBZZ', 2, 1)]);
const normal = await context.findGithubAirport(0, 0, 5, 100, 'any', 'any');
assert.equal(normal.icao, 'OUR-1', 'local additions must be selectable even while hosted candidates exist');
assert.equal((await context.collectMissionAirportPool(0, 0, 100)).length, 2);
assert.ok(loads > 0);
const proposals = await context.collectMissionProposalAirportCandidates({ start: airport('HOME', 0, 0), minNM: 5, maxNM: 100, dirPref: 'any', regionPref: 'any', limit: 1 });
assert.equal(proposals[0].icao, 'OUR-1', 'proposal ranking must see local additions even when hosted alone would fill the limit');

reset({ 'OUR-2': airport('OUR-2', 'small_airport', 0.5, { name: 'River Camp Strip' }) },
    [airport('FBBB', 11, 1, { name: 'Hosted Strip' })]);
assert.equal((await context.findBushAirport(0, 0, 5, 100, 'any', 'any')).icao, 'OUR-2');

const local = {
    HOME: airport('HOME', 0, 0), LOCAL: airport('LOCAL', 'small_airport', 0.5, { sourceId: 'same', aliases: ['FBAB'] }),
    ALIAS: airport('ALIAS', 0, 0.5, { aliasOf: 'LOCAL' }),
    CLOSED: airport('CLOSED', 8, 0.6), WATER: airport('WATER', 'seaplane_base', 0.7),
    STRIP: airport('STRIP', 11, 0.8), GLIDER: airport('GLIDER', 1, 0.9),
    WEST: airport('WEST', 0, -0.7), FAR: airport('FAR', 0, 5), BAD: { icao: 'BAD', lat: null, lon: 0 }
};
reset(local, [airport('REMOTE-COPY', 0, 0.5, { sourceId: 'same' }),
    airport('FBAB', 0, 0.5001), airport('FBAB', 0, 1.4)]);
const pool = await context.collectMissionAirportPool(0, 0, 100);
assert.ok(!pool.some(r => ['ALIAS', 'REMOTE-COPY', 'FAR', 'BAD'].includes(r.icao)));
assert.equal(pool.filter(r => r.icao === 'FBAB').length, 1, 'distant code collisions must not be silently merged');
assert.ok(pool.find(r => r.icao === 'LOCAL').aliases.includes('REMOTE-COPY'));
const defaults = await context.collectMissionProposalAirportCandidates({ start: airport('HOME', 0, 0), minNM: 5, maxNM: 60, dirPref: 'east', regionPref: 'any', limit: 30 });
assert.deepEqual(Array.from(defaults, r => r.icao), ['LOCAL']);
for (const [group, expected] of [['water', 'WATER'], ['strips', 'STRIP'], ['glider', 'GLIDER']]) {
    types.setSelected([group], { persist: false, emit: false });
    assert.equal((await context.findGithubAirport(0, 0, 5, 60, 'east', 'any')).icao, expected);
}
context.currentStartICAO = 'REMOTE-COPY';
types.setSelected(['ga'], { persist: false, emit: false });
assert.equal(await context.findGithubAirport(0, 0, 5, 40, 'east', 'any'), null, 'suppressed source IDs must still exclude the start airport');
context.currentStartICAO = 'HOME';

reset({ 'OUR-1': airport('OUR-1', 'small_airport', 0.5) }, []);
failHosted = true;
assert.equal((await context.findGithubAirport(0, 0, 5, 100, 'any', 'any')).icao, 'OUR-1');
reset({}, [airport('FBAA', 0, 0.5)]); failLocal = true;
assert.equal((await context.findGithubAirport(0, 0, 5, 100, 'any', 'any')).icao, 'FBAA');

reset({}, []);
context.faaLocalAirportsSupplementPromise = Promise.resolve().then(() => {
    database.U60 = airport('U60', 'small_airport', 0.5);
});
assert.equal((await context.findGithubAirport(0, 0, 5, 100, 'any', 'any')).icao, 'U60');

const real = JSON.parse(fs.readFileSync(new URL('../airports.json', import.meta.url), 'utf8'));
reset(real, [{ ...real.FBMN }]);
const realPool = await context.collectMissionAirportPool(-19.9725, 23.4311, 100, 'any');
assert.ok(realPool.some(r => r.icao === 'OUR-595499'), 'Mopiri missing from actual Botswana pool');
assert.ok(realPool.some(r => r.icao === 'OUR-317575'), 'Hunda missing from actual Botswana pool');
assert.equal(realPool.filter(r => r.sourceId === real.FBMN.sourceId).length, 1, 'Maun must not be duplicated across sources');
console.log('Mission airport pool: unified APT/Bush/proposals, type/range/direction/start filters, deduplication, source failures, FAA and real Botswana catalog passed');
