#!/usr/bin/env node
// Extracts VFR reporting points (OFMX <Dpn>, codeType VFR-MRP/VFR-RP/VFR-ENR)
// with their associated aerodrome from the open flightmaps snapshots into
// data/ofm-reporting-points.json.
//
// Licence: OFMA General Users' License (free use incl. apps; attribution to
// open flightmaps required; users must be able to report errors to OFMA; not a
// primary navigation source). https://www.openflightmaps.org/about/
//
// Usage: node tools/build-ofm-reporting-points.mjs [AIRAC e.g. 2612]
// Without an AIRAC the newest cycle available for ED is used. Needs `unzip`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'data', 'ofm-reporting-points.json');
const REGIONS = ['eb', 'ed', 'ef', 'eh', 'ek', 'ep', 'es', 'fa', 'fy', 'ld', 'lf', 'lg', 'lh', 'li', 'lj', 'lk', 'lm', 'lo', 'lr', 'ls', 'lz'];
const TYPES = { 'VFR-MRP': 'compulsory', 'VFR-RP': 'request', 'VFR-ENR': 'enroute' };
const snapshotUrl = (airac, region) => `https://snapshots.openflightmaps.org/live/${airac}/ofmx/${region}/latest/ofmx_${region}.zip`;

async function exists(url) {
  const response = await fetch(url, { method: 'HEAD' });
  return response.ok;
}

async function latestAirac() {
  const now = new Date();
  for (let year = now.getUTCFullYear() % 100; year >= (now.getUTCFullYear() % 100) - 1; year -= 1) {
    for (let cycle = 14; cycle >= 1; cycle -= 1) {
      const airac = `${String(year).padStart(2, '0')}${String(cycle).padStart(2, '0')}`;
      if (await exists(snapshotUrl(airac, 'ed'))) return airac;
    }
  }
  throw new Error('no_ofm_airac_found');
}

function coordinate(value) {
  const match = /^(\d+(?:\.\d+)?)([NSEW])$/.exec(String(value || '').trim());
  if (!match) return null;
  const number = Number(match[1]);
  return match[2] === 'S' || match[2] === 'W' ? -number : number;
}

const tag = (block, name) => {
  const match = new RegExp(`<${name}>([^<]*)</${name}>`).exec(block);
  return match ? match[1].trim() : '';
};

function parseReportingPoints(xml, region) {
  const points = [];
  for (const match of xml.matchAll(/<Dpn>([\s\S]*?)<\/Dpn>/g)) {
    const block = match[1];
    const kind = TYPES[tag(block, 'codeType')];
    if (!kind) continue;
    const uid = /<DpnUid[^>]*>([\s\S]*?)<\/DpnUid>/.exec(block);
    const assoc = /<AhpUidAssoc[^>]*>([\s\S]*?)<\/AhpUidAssoc>/.exec(block);
    const lat = coordinate(uid && tag(uid[1], 'geoLat'));
    const lon = coordinate(uid && tag(uid[1], 'geoLong'));
    if (lat === null || lon === null) continue;
    points.push({
      id: uid ? tag(uid[1], 'codeId') : '',
      name: tag(block, 'txtName'),
      kind,
      airport: assoc ? tag(assoc[1], 'codeId') : '',
      lat: Math.round(lat * 1e6) / 1e6,
      lon: Math.round(lon * 1e6) / 1e6,
      region: region.toUpperCase()
    });
  }
  return points;
}

const airac = process.argv[2] || await latestAirac();
// Regions are not all published for every cycle: take the newest of the last four.
function previousCycles(start, count) {
  const out = [];
  let year = Number(start.slice(0, 2)), cycle = Number(start.slice(2));
  for (let i = 0; i < count; i += 1) {
    out.push(`${String(year).padStart(2, '0')}${String(cycle).padStart(2, '0')}`);
    cycle -= 1;
    if (cycle < 1) { cycle = 13; year -= 1; }
  }
  return out;
}
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ofm-vrp-'));
const all = [];
const regions = [];
try {
  for (const region of REGIONS) {
    let response = null, regionAirac = '';
    for (const cycle of previousCycles(airac, 4)) {
      const candidate = await fetch(snapshotUrl(cycle, region));
      if (candidate.ok) { response = candidate; regionAirac = cycle; break; }
    }
    if (!response) { console.log(`OFM_REGION_SKIPPED ${region} not_published`); continue; }
    const zip = path.join(work, `${region}.zip`);
    fs.writeFileSync(zip, Buffer.from(await response.arrayBuffer()));
    let xml;
    try {
      xml = execFileSync('unzip', ['-p', zip, `ofmx_${region}/isolated/ofmx_${region}.ofmx`], { maxBuffer: 256 * 1024 * 1024 }).toString('utf8');
    } catch (error) {
      console.log(`OFM_REGION_SKIPPED ${region} unzip_failed`);
      continue;
    }
    const points = parseReportingPoints(xml, region);
    all.push(...points);
    regions.push({ region: region.toUpperCase(), airac: regionAirac, points: points.length });
    console.log(`OFM_REGION ${region} airac=${regionAirac} points=${points.length}`);
  }
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}

const data = {
  schema: 'ga.ofm-reporting-points.v1',
  airac,
  generatedAt: new Date().toISOString(),
  source: 'open flightmaps',
  sourceUrl: 'https://www.openflightmaps.org/',
  license: 'OFMA General Users License: attribution to open flightmaps; report errors to OFMA; not a primary navigation source',
  regions,
  count: all.length,
  points: all
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(data) + '\n');
console.log(`OFM_REPORTING_POINTS_WRITTEN ${path.relative(root, output)} airac=${airac} points=${all.length}`);
