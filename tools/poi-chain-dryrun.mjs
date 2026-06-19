import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const chainApi = require(path.join(repoRoot, 'mission-poi-chain.js'));

const TILE_DEG = 25 / 60;

const SCENARIOS = {
    kinzig_bridges_haslach_offenburg: {
        label: 'Kinzig-Bruecken Haslach-Offenburg',
        theme: 'river_bridge_inspection',
        guideNamePattern: 'Kinzig',
        start: { lat: 48.2749, lon: 8.0892, label: 'Haslach im Kinzigtal' },
        end: { lat: 48.4735, lon: 7.9446, label: 'Offenburg' },
        padDeg: 0.18,
        minPoints: 3,
        maxPoints: 8
    },
    a5_junctions_lahr_achern: {
        label: 'A5-Anschlussstellen Lahr-Achern',
        theme: 'road_junction_survey',
        guideNamePattern: '(^|\\b)(A\\s?5|E\\s?35)($|\\b)',
        start: { lat: 48.3375, lon: 7.8382, label: 'Lahr' },
        end: { lat: 48.6382, lon: 8.0165, label: 'Achern' },
        padDeg: 0.2,
        minPoints: 3,
        maxPoints: 8
    },
    rail_offenburg_hausach: {
        label: 'Bahnkette Offenburg-Hausach',
        theme: 'rail_chain_inspection',
        guideNamePattern: '(Kinzigtalbahn|Schwarzwaldbahn|4250)',
        start: { lat: 48.4778, lon: 7.9469, label: 'Offenburg' },
        end: { lat: 48.2841, lon: 8.1761, label: 'Hausach' },
        padDeg: 0.18,
        projectionSlack: 0.02,
        minPoints: 3,
        maxPoints: 8
    },
    power_grid_offenburg_lahr: {
        label: 'Stromnetz Offenburg-Lahr',
        theme: 'power_grid_inspection',
        guideNamePattern: '(DB Energie|EnBW|Umspannwerk|Elgersweier|Pfauenweg|110000|220000|380000)',
        start: { lat: 48.3329, lon: 7.8288, label: 'Lahr-West' },
        end: { lat: 48.5425, lon: 7.961, label: 'Offenburg' },
        padDeg: 0.28,
        minPoints: 2,
        maxPoints: 6
    }
};

function parseArgs(argv) {
    const args = {
        scenario: '',
        all: false,
        list: false,
        json: false,
        out: ''
    };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--all') args.all = true;
        else if (arg === '--list') args.list = true;
        else if (arg === '--json') args.json = true;
        else if (arg === '--scenario') args.scenario = argv[++i] || '';
        else if (arg.startsWith('--scenario=')) args.scenario = arg.slice('--scenario='.length);
        else if (arg === '--out') args.out = argv[++i] || '';
        else if (arg.startsWith('--out=')) args.out = arg.slice('--out='.length);
    }
    return args;
}

function tileIndex(value, offset) {
    return Math.floor((Number(value) + offset) / TILE_DEG);
}

function tileRangeForScenario(scenario) {
    const pad = Number(scenario.padDeg || 0.15);
    const minLat = Math.min(scenario.start.lat, scenario.end.lat) - pad;
    const maxLat = Math.max(scenario.start.lat, scenario.end.lat) + pad;
    const minLon = Math.min(scenario.start.lon, scenario.end.lon) - pad;
    const maxLon = Math.max(scenario.start.lon, scenario.end.lon) + pad;
    const latMin = tileIndex(minLat, 90);
    const latMax = tileIndex(maxLat, 90);
    const lonMin = tileIndex(minLon, 180);
    const lonMax = tileIndex(maxLon, 180);
    const tiles = [];
    for (let latI = latMin; latI <= latMax; latI++) {
        for (let lonI = lonMin; lonI <= lonMax; lonI++) {
            tiles.push({ latI, lonI, key: `${latI}|${lonI}` });
        }
    }
    return tiles;
}

function readTile(layerDir, latI, lonI) {
    const gzPath = path.join(repoRoot, layerDir, String(latI), `${lonI}.json.gz`);
    const jsonPath = path.join(repoRoot, layerDir, String(latI), `${lonI}.json`);
    if (fs.existsSync(gzPath)) {
        return JSON.parse(gunzipSync(fs.readFileSync(gzPath)).toString('utf8'));
    }
    if (fs.existsSync(jsonPath)) {
        return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    }
    return null;
}

function loadTileBundle(tiles) {
    const bundle = {
        coreTiles: [],
        infraTiles: [],
        poiTiles: [],
        missing: []
    };
    const layers = [
        ['coreTiles', 'obstacles/core-tiles', 'core'],
        ['infraTiles', 'obstacles/infra-tiles', 'infra'],
        ['poiTiles', 'obstacles/poi-tiles', 'poi']
    ];
    for (const tile of tiles) {
        for (const [bucket, dir, layer] of layers) {
            const payload = readTile(dir, tile.latI, tile.lonI);
            if (payload) bundle[bucket].push(payload);
            else bundle.missing.push(`${layer}:${tile.key}`);
        }
    }
    return bundle;
}

function runScenario(name, scenario) {
    const t0 = Date.now();
    const tiles = tileRangeForScenario(scenario);
    const bundle = loadTileBundle(tiles);
    const loadMs = Date.now() - t0;
    const result = chainApi.buildPoiChain(scenario, bundle);
    const prospectRun = typeof chainApi.buildPoiChainProspects === 'function'
        ? chainApi.buildPoiChainProspects({
            dispatchStartLat: 48.27917,
            dispatchStartLon: 8.42833,
            minNM: 5,
            maxNM: 75,
            dirPref: 'any',
            category: scenario.theme === 'rail_chain_inspection' ? 'rail' : (scenario.theme === 'road_junction_survey' ? 'road' : (scenario.theme === 'power_grid_inspection' ? 'infrastructure' : 'bridge')),
            forceTheme: scenario.theme,
            guideNamePattern: scenario.guideNamePattern,
            maxGroupsPerTheme: 6,
            minPoints: scenario.minPoints,
            maxPoints: scenario.maxPoints,
            projectionSlack: scenario.projectionSlack
        }, bundle)
        : null;
    const prospect = prospectRun?.prospects?.[0] || null;
    return {
        name,
        label: scenario.label,
        ok: result.ok,
        status: result.status,
        reason: result.reason,
        loadMs,
        tiles: {
            requested: tiles.length,
            core: bundle.coreTiles.length,
            infra: bundle.infraTiles.length,
            poi: bundle.poiTiles.length,
            missing: bundle.missing.length
        },
        diagnostics: result.diagnostics,
        prospect: prospect ? {
            ok: true,
            status: prospect.status,
            score: prospect.score,
            theme: prospect.theme,
            group: prospect.group,
            label: prospect.chain?.label || '',
            points: prospect.chain?.points?.length || 0,
            firstPointDistanceNm: prospect.chain?.dispatch?.firstPointDistanceNm || null
        } : {
            ok: false,
            status: prospectRun?.status || 'not_available',
            diagnostics: prospectRun?.diagnostics || null
        },
        points: result.chain?.points?.map(point => ({
            index: point.index + 1,
            name: point.name,
            category: point.category,
            sourceLayer: point.sourceLayer,
            score: point.score,
            orderT: point.orderT,
            distCorridorNm: point.distCorridorNm,
            distanceFromPrevNm: point.distanceFromPrevNm,
            lat: point.lat,
            lon: point.lon
        })) || []
    };
}

function printScenario(result) {
    const status = result.ok ? 'OK' : `FAIL ${result.status}`;
    console.log(`\n${result.name}: ${status}`);
    if (result.reason) console.log(`  reason: ${result.reason}`);
    console.log(`  load: ${result.loadMs}ms | tiles core/infra/poi ${result.tiles.core}/${result.tiles.infra}/${result.tiles.poi} requested=${result.tiles.requested} missing=${result.tiles.missing}`);
    const d = result.diagnostics || {};
    console.log(`  guide=${d.guidePoints || 0} raw=${d.rawCandidates || 0} clusters=${d.clusteredCandidates || 0} selected=${d.selectedPoints || 0}`);
    if (Array.isArray(d.guideNames) && d.guideNames.length) console.log(`  guide names: ${d.guideNames.join(' | ')}`);
    if (Array.isArray(d.candidateNames) && d.candidateNames.length) console.log(`  candidates: ${d.candidateNames.join(' | ')}`);
    if (result.prospect?.ok) {
        console.log(`  prospect: ${result.prospect.label} | ${result.prospect.points} points | score ${result.prospect.score} | first ${result.prospect.firstPointDistanceNm}NM`);
    } else {
        console.log(`  prospect: ${result.prospect?.status || 'n/a'}`);
    }
    for (const point of result.points) {
        const dist = point.index === 1 ? 'start' : `${point.distanceFromPrevNm}NM`;
        console.log(`  ${point.index}. ${point.name} (${point.category}, ${point.sourceLayer}, score ${point.score}, ${dist}, xtrk ${point.distCorridorNm}NM)`);
    }
}

const args = parseArgs(process.argv.slice(2));

if (args.list) {
    console.log(Object.keys(SCENARIOS).join('\n'));
    process.exit(0);
}

const names = args.all || !args.scenario
    ? Object.keys(SCENARIOS)
    : args.scenario.split(',').map(s => s.trim()).filter(Boolean);

const unknown = names.filter(name => !SCENARIOS[name]);
if (unknown.length) {
    console.error(`Unknown scenario(s): ${unknown.join(', ')}`);
    console.error(`Known: ${Object.keys(SCENARIOS).join(', ')}`);
    process.exit(2);
}

const results = names.map(name => runScenario(name, SCENARIOS[name]));

if (args.json) {
    const text = JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2);
    if (args.out) {
        const outPath = path.isAbsolute(args.out) ? args.out : path.join(repoRoot, args.out);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, text);
    } else {
        console.log(text);
    }
} else {
    for (const result of results) printScenario(result);
    const okCount = results.filter(r => r.ok).length;
    console.log(`\nsummary: ${okCount}/${results.length} ready`);
}

if (results.some(result => !result.ok)) process.exitCode = 1;
