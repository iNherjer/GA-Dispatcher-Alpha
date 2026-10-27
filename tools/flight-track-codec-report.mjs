#!/usr/bin/env node
// Shows how small a real tracker flight log gets as a logbook track.
// Usage: node tools/flight-track-codec-report.mjs <flightlogs/...jsonl> [more files]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const codec = require('../flight-track-codec-core.js');

const files = process.argv.slice(2);
if (!files.length) {
    console.error('Usage: node tools/flight-track-codec-report.mjs <flight-log.jsonl> [...]');
    process.exit(1);
}

// Lateral error: nearest of the neighbouring track pieces (times are stored in whole seconds).
function maxError(points, decoded) {
    let lat = 0, vert = 0, k = 0;
    const t0 = points[0].t;
    const piece = i => (i >= 0 && i < decoded.length - 1 && !decoded[i + 1].segmentStart) ? [decoded[i], decoded[i + 1]] : null;
    for (const p of points) {
        const sec = (p.t - t0) / 1000;
        while (k < decoded.length - 2 && decoded[k + 1].sec <= sec) k += 1;
        let bestLat = Infinity, bestVert = Infinity;
        for (const i of [k - 1, k, k + 1]) {
            const ab = piece(i);
            if (!ab) continue;
            const d = codec.deviation({ ...ab[0], t: ab[0].sec }, { ...ab[1], t: ab[1].sec }, { ...p, t: sec });
            bestLat = Math.min(bestLat, d.lateralM);
            bestVert = Math.min(bestVert, d.verticalFt);
        }
        if (bestLat === Infinity) continue;
        lat = Math.max(lat, bestLat);
        vert = Math.max(vert, bestVert);
    }
    return { lat: Math.round(lat), vert: Math.round(vert) };
}

for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n').filter(Boolean).map(line => { try { return JSON.parse(line); } catch { return null; } });
    const samples = lines.filter(line => line?.type === 'telemetry');
    const points = codec.pointsFromSamples(samples);
    console.log(`\n${file}`);
    console.log(`  raw: ${(text.length / 1024).toFixed(0)} KB, ${samples.length} samples, ${points.length} usable`);
    if (points.length < 2) { console.log('  no usable flight'); continue; }
    for (const [lateralM, verticalFt] of [[10, 20], [15, 30], [30, 50], [60, 100]]) {
        const track = codec.encodeTrack(samples, { lateralM, verticalFt });
        const json = JSON.stringify(track);
        const decoded = codec.decodeTrack(track);
        const err = maxError(points, decoded);
        const segments = decoded.filter(p => p.segmentStart).length;
        const used = track.tol[0] !== lateralM ? ` (widened to ${track.tol[0]} m / ${track.tol[1]} ft)` : '';
        console.log(`  ${lateralM} m / ${verticalFt} ft${used}: ${track.n} points, ${json.length} B (gzip ${zlib.gzipSync(json).length} B), `
            + `max error ${err.lat} m / ${err.vert} ft, segments ${segments}, touchdowns ${track.marks.touchdowns.length}`);
    }
}
