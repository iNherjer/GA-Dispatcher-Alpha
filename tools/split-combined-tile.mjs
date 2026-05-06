#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

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
  const majorHighway = new Set([
    'motorway', 'motorway_link',
    'trunk', 'trunk_link',
    'primary', 'primary_link',
    'secondary', 'secondary_link'
  ]);
  const majorRail = new Set(['rail', 'light_rail', 'narrow_gauge']);
  const majorWaterway = new Set(['river', 'canal']);

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
    if (t === 'power_tower') return hFt >= 200; // only clearly large high-voltage towers
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
      const highway = String(e?.highway || '').toLowerCase();
      const railway = String(e?.railway || '').toLowerCase();
      const waterway = String(e?.waterway || '').toLowerCase();
      const power = String(e?.power || '').toLowerCase();
      let type = '';
      if (rawType === 'highway' || layer === 'road') {
        if (!majorHighway.has(highway)) return null; // only major roads/highways
        type = 'highway';
      } else if (rawType === 'railway' || layer === 'rail') {
        if (!majorRail.has(railway)) return null; // keep main rail corridors only
        type = 'railway';
      } else if (rawType === 'river' || layer === 'hydro') {
        if (waterway && !majorWaterway.has(waterway)) return null; // avoid tiny streams/ditches
        type = 'river';
      } else if (rawType === 'powerline' || layer === 'powerline') {
        if (power && !['line', 'minor_line', 'cable'].includes(power)) return null;
        type = 'powerline';
      }
      if (!type) return null; // Drop poi/man_made helper-lines from core.
      const lat = normCoord(e?.lat);
      const lon = normCoord(e?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const name = String(e?.name || '').trim();
      // Unnamed roads add huge volume with low value; keep unnamed power/rail for infra context.
      if (!name && type === 'highway') return null;
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
    const step = arr.length > 200 ? 8 : (arr.length > 120 ? 6 : (arr.length > 60 ? 4 : (arr.length > 24 ? 2 : 1)));
    for (let i = 0; i < arr.length; i += step) linOut.push(arr[i]);
    if (arr.length > 1 && arr[arr.length - 1] !== arr[Math.floor((arr.length - 1) / step) * step]) linOut.push(arr[arr.length - 1]);
  }

  // Final hard cap to keep core tiles predictable in dense urban areas.
  const linCapped = linOut.slice(0, 12000);
  const obsCapped = obs.slice(0, 2000);
  const rawCounts = input?.counts || {};
  const rawTotal = Number(rawCounts.obs || 0) + Number(rawCounts.lin || 0) + Number(rawCounts.poi || 0);

  return {
    v: 1,
    tile: String(input?.tile || ''),
    source: String(input?.source || ''),
    generatedAt: String(input?.generatedAt || new Date().toISOString()),
    meta: {
      dataStatus: rawTotal === 0 ? 'empty' : 'loaded',
      rawCounts: {
        obs: Number(rawCounts.obs || 0),
        lin: Number(rawCounts.lin || 0),
        poi: Number(rawCounts.poi || 0)
      }
    },
    core: {
      obs: obsCapped,
      lin: linCapped
    },
    counts: {
      obs: obsCapped.length,
      lin: linCapped.length
    }
  };
}

function compactPoi(input) {
  const poiIn = Array.isArray(input?.poi) ? input.poi : [];
  const keepNatural = new Set(['water', 'peak', 'valley', 'ridge', 'cliff', 'saddle', 'hill', 'cave_entrance', 'rock']);
  const keepWater = new Set(['lake', 'reservoir', 'pond', 'basin']);
  const keepLanduse = new Set(['industrial', 'quarry', 'brownfield', 'landfill', 'reservoir', 'basin']);
  const keepRailway = new Set(['station', 'halt', 'tram_stop', 'subway_entrance', 'level_crossing', 'crossing', 'junction', 'switch', 'signal']);
  const keepHighwayPoi = new Set(['motorway_junction', 'trunk_junction']);
  const keepTourism = new Set(['attraction', 'viewpoint', 'museum', 'theme_park', 'zoo', 'aquarium']);
  const keepHistoric = new Set(['castle', 'ruins', 'fort', 'monument', 'memorial', 'archaeological_site']);
  const keepManMade = new Set([
    'tower', 'mast', 'bridge', 'dam', 'lighthouse', 'water_tower', 'chimney', 'antenna',
    'water_works', 'wastewater_plant', 'works', 'storage_tank', 'silo'
  ]);
  const keepPower = new Set(['tower', 'substation', 'plant', 'generator', 'transformer']);
  const keepPlace = new Set(['city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood']);
  const keepLeisure = new Set(['nature_reserve', 'park', 'marina', 'stadium']);
  const keepAmenity = new Set(['university', 'hospital', 'fire_station', 'wastewater_plant', 'waste_transfer_station', 'water_works', 'fuel', 'bus_station']);

  const poiRaw = poiIn
    .map(e => ({
      name: String(e?.name || ''),
      lat: Number(e?.lat),
      lon: Number(e?.lon),
      tourism: String(e?.tourism || '').toLowerCase(),
      historic: String(e?.historic || '').toLowerCase(),
      natural: String(e?.natural || '').toLowerCase(),
      water: String(e?.water || '').toLowerCase(),
      landuse: String(e?.landuse || '').toLowerCase(),
      amenity: String(e?.amenity || '').toLowerCase(),
      leisure: String(e?.leisure || '').toLowerCase(),
      man_made: String(e?.man_made || '').toLowerCase(),
      power: String(e?.power || '').toLowerCase(),
      railway: String(e?.railway || '').toLowerCase(),
      highway: String(e?.highway || '').toLowerCase(),
      place: String(e?.place || '').toLowerCase()
    }))
    .filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lon))
    .filter(e => {
      return (
        keepNatural.has(e.natural) ||
        keepWater.has(e.water) ||
        keepLanduse.has(e.landuse) ||
        keepRailway.has(e.railway) ||
        keepHighwayPoi.has(e.highway) ||
        keepTourism.has(e.tourism) ||
        keepHistoric.has(e.historic) ||
        keepManMade.has(e.man_made) ||
        keepPower.has(e.power) ||
        keepPlace.has(e.place) ||
        keepLeisure.has(e.leisure) ||
        keepAmenity.has(e.amenity)
      );
    })
    .map(e => ({
      ...e,
      lat: Math.round(e.lat * 1e5) / 1e5,
      lon: Math.round(e.lon * 1e5) / 1e5,
      name: e.name.slice(0, 80)
    }));

  // Dedupe identical/tag-identical points.
  const poiDedup = [];
  const seen = new Set();
  for (const e of poiRaw) {
    const k = `${e.name}|${e.lat}|${e.lon}|${e.tourism}|${e.historic}|${e.natural}|${e.water}|${e.landuse}|${e.amenity}|${e.leisure}|${e.man_made}|${e.power}|${e.railway}|${e.highway}|${e.place}`;
    if (seen.has(k)) continue;
    seen.add(k);
    poiDedup.push(e);
  }

  // Balanced cap per mission-relevant group to avoid single-tag domination.
  const groups = {
    place: [],
    water: [],
    mountain: [],
    road: [],
    rail: [],
    industry: [],
    historic: [],
    tower: [],
    tourism: [],
    other: []
  };
  for (const e of poiDedup) {
    if (keepPlace.has(e.place)) groups.place.push(e);
    else if (keepWater.has(e.water) || e.natural === 'water') groups.water.push(e);
    else if (['peak', 'valley', 'ridge', 'cliff', 'saddle', 'hill'].includes(e.natural)) groups.mountain.push(e);
    else if (keepHighwayPoi.has(e.highway)) groups.road.push(e);
    else if (keepRailway.has(e.railway)) groups.rail.push(e);
    else if (keepLanduse.has(e.landuse) || ['substation', 'plant', 'generator', 'transformer'].includes(e.power) || ['water_works', 'wastewater_plant', 'works', 'storage_tank', 'silo', 'chimney'].includes(e.man_made) || keepAmenity.has(e.amenity)) groups.industry.push(e);
    else if (keepHistoric.has(e.historic)) groups.historic.push(e);
    else if (keepManMade.has(e.man_made) || keepPower.has(e.power)) groups.tower.push(e);
    else if (keepTourism.has(e.tourism)) groups.tourism.push(e);
    else groups.other.push(e);
  }
  const capPerGroup = {
    place: 1200,
    water: 900,
    mountain: 900,
    road: 800,
    rail: 900,
    industry: 1000,
    historic: 900,
    tower: 1200,
    tourism: 700,
    other: 600
  };
  let poi = [];
  for (const g of Object.keys(groups)) poi = poi.concat(groups[g].slice(0, capPerGroup[g] || 500));
  poi = poi.slice(0, 5000);
  const rawCounts = input?.counts || {};
  const rawTotal = Number(rawCounts.obs || 0) + Number(rawCounts.lin || 0) + Number(rawCounts.poi || 0);

  return {
    v: 1,
    tile: String(input?.tile || ''),
    source: String(input?.source || ''),
    generatedAt: String(input?.generatedAt || new Date().toISOString()),
    meta: {
      dataStatus: rawTotal === 0 ? 'empty' : 'loaded',
      rawCounts: {
        obs: Number(rawCounts.obs || 0),
        lin: Number(rawCounts.lin || 0),
        poi: Number(rawCounts.poi || 0)
      }
    },
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

  await fs.writeFile(args.coreOut, gzipSync(JSON.stringify(core)));
  await fs.writeFile(args.poiOut, gzipSync(JSON.stringify(poi)));

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
