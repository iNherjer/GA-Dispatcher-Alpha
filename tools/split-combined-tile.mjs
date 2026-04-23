#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const args = {
    in: '',
    coreOut: '',
    poiOut: ''
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const n = argv[i + 1];
    if (a === '--in' && n) { args.in = n; i++; continue; }
    if (a === '--core-out' && n) { args.coreOut = n; i++; continue; }
    if (a === '--poi-out' && n) { args.poiOut = n; i++; continue; }
    if (a === '--help' || a === '-h') {
      console.log('Usage: node tools/split-combined-tile.mjs --in <combined.json> --core-out <core.json> --poi-out <poi.json>');
      process.exit(0);
    }
  }
  if (!args.in || !args.coreOut || !args.poiOut) {
    throw new Error('Missing required args: --in, --core-out, --poi-out');
  }
  return args;
}

function compactCore(input) {
  const obsIn = Array.isArray(input?.obs) ? input.obs : [];
  const linIn = Array.isArray(input?.lin) ? input.lin : [];
  const commTowerNameRe = /(funk|radio|fernseh|tv|sender|tower|turm|antenne|mast)/i;

  function normalizeObstacleType(raw) {
    const t = String(raw || '').toLowerCase();
    if (t.includes('wind')) return 'wind';
    if (t.includes('power')) return 'power_tower';
    return 'mast';
  }

  function keepObstacle(e) {
    const t = normalizeObstacleType(e?.type);
    const hFt = Math.max(0, Math.round(Number(e?.hFt || 0)));
    const name = String(e?.name || '');
    if (t === 'wind') return hFt >= 60;
    if (t === 'power_tower') return hFt >= 150; // keep only larger transmission towers
    // Keep only clearly relevant comm towers or larger masts.
    return hFt >= 180 || (hFt >= 120 && commTowerNameRe.test(name));
  }

  function normCoord(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return NaN;
    return Math.round(n * 1e5) / 1e5; // ~1.1m precision, much smaller payload
  }

  const obs = obsIn
    .filter(keepObstacle)
    .map(e => ({
      type: normalizeObstacleType(e?.type),
      hFt: Math.max(0, Math.round(Number(e?.hFt || 0))),
      elevFt: Math.max(0, Math.round(Number(e?.elevFt || 0))),
      lat: normCoord(e?.lat),
      lon: normCoord(e?.lon),
      name: String(e?.name || '')
    }))
    .filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lon) && e.hFt >= 30)
    .map(e => ({ type: e.type, hFt: e.hFt, elevFt: e.elevFt, lat: e.lat, lon: e.lon, ...(e.name ? { name: e.name.slice(0, 48) } : {}) }));

  const lin = linIn
    .map(e => {
      const layer = String(e?.layer || '').toLowerCase();
      const rawType = String(e?.type || '').toLowerCase();
      let type = '';
      if (rawType === 'highway' || layer === 'road') type = 'highway';
      else if (rawType === 'river' || layer === 'hydro') type = 'river';
      else if (rawType === 'powerline' || layer === 'powerline') type = 'powerline';
      if (!type) return null; // Drop poi/man_made helper-lines from core.
      const lat = normCoord(e?.lat);
      const lon = normCoord(e?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const name = String(e?.name || '').trim();
      // Unnamed roads/powerlines add much volume with low value in profile.
      if (!name && (type === 'highway' || type === 'powerline')) return null;
      return { type, name: name.slice(0, 64), lat, lon };
    })
    .filter(Boolean);

  const linDedup = [];
  const seen = new Set();
  for (const e of lin) {
    const key = `${e.type}|${e.name}|${e.lat}|${e.lon}`;
    if (seen.has(key)) continue;
    seen.add(key);
    linDedup.push(e);
  }

  // Adaptive downsample per feature line signature to keep files manageable.
  const grouped = new Map();
  for (const e of linDedup) {
    const gk = `${e.type}|${e.name}`;
    if (!grouped.has(gk)) grouped.set(gk, []);
    grouped.get(gk).push(e);
  }
  const linOut = [];
  for (const arr of grouped.values()) {
    const step = arr.length > 120 ? 4 : (arr.length > 60 ? 3 : (arr.length > 24 ? 2 : 1));
    for (let i = 0; i < arr.length; i += step) linOut.push(arr[i]);
    if (arr.length > 1 && arr[arr.length - 1] !== arr[Math.floor((arr.length - 1) / step) * step]) linOut.push(arr[arr.length - 1]);
  }

  return {
    v: 1,
    tile: String(input?.tile || ''),
    source: String(input?.source || ''),
    generatedAt: String(input?.generatedAt || new Date().toISOString()),
    core: {
      obs,
      lin: linOut
    },
    counts: {
      obs: obs.length,
      lin: linOut.length
    }
  };
}

function compactPoi(input) {
  const poiIn = Array.isArray(input?.poi) ? input.poi : [];
  const poi = poiIn
    .map(e => ({
      name: String(e?.name || ''),
      lat: Number(e?.lat),
      lon: Number(e?.lon),
      tourism: String(e?.tourism || ''),
      historic: String(e?.historic || ''),
      natural: String(e?.natural || ''),
      water: String(e?.water || ''),
      amenity: String(e?.amenity || ''),
      leisure: String(e?.leisure || ''),
      man_made: String(e?.man_made || ''),
      power: String(e?.power || ''),
      place: String(e?.place || '')
    }))
    .filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lon));

  return {
    v: 1,
    tile: String(input?.tile || ''),
    source: String(input?.source || ''),
    generatedAt: String(input?.generatedAt || new Date().toISOString()),
    poi: { poi },
    counts: { poi: poi.length }
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const raw = await fs.readFile(args.in, 'utf8');
  const parsed = JSON.parse(raw);

  const core = compactCore(parsed);
  const poi = compactPoi(parsed);

  await fs.mkdir(path.dirname(args.coreOut), { recursive: true });
  await fs.mkdir(path.dirname(args.poiOut), { recursive: true });

  await fs.writeFile(args.coreOut, JSON.stringify(core));
  await fs.writeFile(args.poiOut, JSON.stringify(poi));

  console.log(JSON.stringify({
    ok: true,
    in: args.in,
    coreOut: args.coreOut,
    poiOut: args.poiOut,
    counts: {
      core: core.counts,
      poi: poi.counts
    }
  }));
}

main().catch(err => {
  console.error(String(err && err.stack || err));
  process.exit(1);
});
