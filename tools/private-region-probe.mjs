import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const core = require('../mission-private-context-core.js');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const airports = JSON.parse(fs.readFileSync(path.join(root, 'airports.json'), 'utf8'));
const targets = process.argv.slice(2);
if (!targets.length) throw new Error('Supply destination ICAOs');
const cases = [];
const reports = [];
const memory = new Map();
for (const icao of targets) {
    const airport = airports[icao];
    if (!airport) throw new Error(`Unknown airport ${icao}`);
    const bytes = { compressed: 0, uncompressed: 0 };
    const wikiReplies = [];
    const region = await core.resolve(airport, {
        cacheGet: key => memory.get(key), cachePut: (key, data) => memory.set(key, data),
        readTile: async key => {
            const [lat, lon] = key.split('|');
            const file = path.join(root, 'obstacles/poi-tiles', lat, `${lon}.json.gz`);
            if (!fs.existsSync(file)) return null;
            const packed = fs.readFileSync(file); const raw = gunzipSync(packed);
            bytes.compressed += packed.length; bytes.uncompressed += raw.length;
            return JSON.parse(raw.toString('utf8'));
        },
        fetchJson: async (url, signal) => {
            const res = await fetch(url, { signal });
            if (!res.ok) throw new Error(`Geography HTTP ${res.status}`);
            const data = await res.json(); wikiReplies.push({ url, data }); return data;
        }
    });
    reports.push({ icao, region, bytes, wikiReplies });
    const start = airports[icao === 'EDTW' ? 'EDTF' : 'EDTW'];
    for (let run = 1; run <= 3; run++) cases.push({ id: `${icao}-${run}`, contract: {
        status: 'ready', profile: { id: 'private_outing', taskDomain: 'private_outing' },
        target: { name: `${airport.name} (${icao})`, lat: airport.lat, lon: airport.lon },
        route: { startName: `${start.name} (${start.icao})`, targetName: `${airport.name} (${icao})` },
        missionDate: '2026-09-14', knowledgeContext: core.knowledge(region), privateRegionContext: region,
        missionPlan: { plan: {} }
    } });
}
const base = 'private-outing-v5-7-discovery';
fs.writeFileSync(path.join(root, 'analysis', `${base}.json`), JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2));
fs.writeFileSync(path.join(root, 'analysis', `${base}-cases.json`), JSON.stringify(cases, null, 2));
console.log(JSON.stringify(reports.map(({ icao, region, bytes }) => ({ icao, stats: region.stats, bytes, places: region.places })), null, 2));
