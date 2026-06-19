#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

function parseArgs(argv) {
  const args = {
    in: '',
    coreOut: '',
    poiOut: '',
    infraOut: ''
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const n = argv[i + 1];
    if (a === '--in' && n) { args.in = n; i++; continue; }
    if (a === '--core-out' && n) { args.coreOut = n; i++; continue; }
    if (a === '--poi-out' && n) { args.poiOut = n; i++; continue; }
    if (a === '--infra-out' && n) { args.infraOut = n; i++; continue; }
    if (a === '--help' || a === '-h') {
      console.log('Usage: node tools/split-combined-tile.mjs --in <combined.json> --core-out <core.json> --poi-out <poi.json> [--infra-out <infra.json>]');
      process.exit(0);
    }
  }
  if (!args.in || !args.coreOut || !args.poiOut) {
    throw new Error('Missing required args: --in, --core-out, --poi-out');
  }
  return args;
}

function normCoord(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 1e5) / 1e5; // ~1.1m precision, much smaller payload
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
  const keepPlace = new Set(['city', 'town', 'village', 'hamlet', 'suburb', 'neighbourhood']);
  const keepLeisure = new Set(['nature_reserve', 'park', 'marina', 'stadium']);
  const keepAmenity = new Set(['university', 'hospital', 'fire_station', 'wastewater_plant', 'waste_transfer_station', 'water_works', 'fuel', 'bus_station']);
  const optionalPoiFields = [
    'ref',
    'operator',
    'osm_kind',
    'osm_id',
    'bridge',
    'service',
    'industrial',
    'building',
    'material',
    'sample_count'
  ];

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
      place: String(e?.place || '').toLowerCase(),
      ref: String(e?.ref || ''),
      operator: String(e?.operator || ''),
      osm_kind: String(e?.osm_kind || ''),
      osm_id: String(e?.osm_id || ''),
      bridge: String(e?.bridge || '').toLowerCase(),
      service: String(e?.service || '').toLowerCase(),
      industrial: String(e?.industrial || '').toLowerCase(),
      building: String(e?.building || '').toLowerCase(),
      material: String(e?.material || '').toLowerCase(),
      sample_count: Number(e?.sample_count || 0) || 0
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
        keepPlace.has(e.place) ||
        keepLeisure.has(e.leisure) ||
        keepAmenity.has(e.amenity) ||
        e.bridge
      );
    })
    .map(e => {
      const out = {
        name: e.name.slice(0, 80),
        lat: Math.round(e.lat * 1e5) / 1e5,
        lon: Math.round(e.lon * 1e5) / 1e5,
        tourism: e.tourism,
        historic: e.historic,
        natural: e.natural,
        water: e.water,
        landuse: e.landuse,
        amenity: e.amenity,
        leisure: e.leisure,
        man_made: e.man_made,
        power: e.power,
        railway: e.railway,
        highway: e.highway,
        place: e.place
      };
      for (const key of optionalPoiFields) {
        const value = e[key];
        if (key === 'sample_count') {
          if (Number(value) > 0) out[key] = Math.round(Number(value));
        } else if (value) {
          out[key] = String(value).slice(0, 120);
        }
      }
      return out;
    });

  // Dedupe identical/tag-identical points.
  const poiDedup = [];
  const seen = new Set();
  for (const e of poiRaw) {
    const k = `${e.osm_kind || ''}|${e.osm_id || ''}|${e.name}|${e.lat}|${e.lon}|${e.tourism}|${e.historic}|${e.natural}|${e.water}|${e.landuse}|${e.amenity}|${e.leisure}|${e.man_made}|${e.power}|${e.railway}|${e.highway}|${e.place}`;
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
    else if (keepLanduse.has(e.landuse) || ['water_works', 'wastewater_plant', 'works', 'storage_tank', 'silo', 'chimney'].includes(e.man_made) || keepAmenity.has(e.amenity)) groups.industry.push(e);
    else if (keepHistoric.has(e.historic)) groups.historic.push(e);
    else if (keepManMade.has(e.man_made)) groups.tower.push(e);
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

function compactInfra(input) {
  const linIn = Array.isArray(input?.lin) ? input.lin : [];
  const poiIn = Array.isArray(input?.poi) ? input.poi : [];
  const obsIn = Array.isArray(input?.obs) ? input.obs : [];
  const majorHighway = new Set([
    'motorway', 'motorway_link',
    'trunk', 'trunk_link',
    'primary', 'primary_link',
    'secondary', 'secondary_link',
    'tertiary', 'tertiary_link'
  ]);
  const drivableHighway = new Set([
    ...majorHighway,
    'living_street',
    'residential',
    'road',
    'service',
    'unclassified'
  ]);
  const majorRail = new Set(['rail', 'light_rail', 'narrow_gauge', 'subway', 'tram']);
  const railFacility = new Set(['station', 'halt', 'signal_box', 'switch', 'signal', 'level_crossing', 'crossing', 'junction', 'buffer_stop']);
  const railClusterTarget = new Set(['switch', 'signal', 'level_crossing', 'crossing', 'junction']);
  const infraManMade = new Set([
    'bridge', 'water_works', 'wastewater_plant', 'works', 'storage_tank', 'silo',
    'chimney', 'tower', 'mast', 'communications_tower'
  ]);
  const infraAmenity = new Set(['wastewater_plant', 'waste_transfer_station', 'water_works', 'fuel', 'bus_station']);
  const marineAmenity = new Set(['ferry_terminal']);
  const marineLeisure = new Set(['marina']);
  const marineManMade = new Set(['pier', 'dock', 'quay', 'jetty']);
  const marineWaterway = new Set(['dock', 'lock_gate']);
  const perimeterBarrier = new Set(['fence', 'gate']);
  const infraPower = new Set([
    'plant', 'generator', 'substation', 'switchgear', 'converter',
    'compensator', 'line', 'minor_line', 'cable', 'tower'
  ]);
  const energyValue = (e, key) => String(e?.[key] || e?.[key.replace('_', ':')] || '').toLowerCase();
  const clean = (v, lower = true, max = 120) => {
    const s = String(v || '').trim();
    return (lower ? s.toLowerCase() : s).slice(0, max);
  };

  function infraType(e) {
    const power = clean(e.power);
    const generatorSource = energyValue(e, 'generator_source');
    const plantSource = energyValue(e, 'plant_source');
    const highway = clean(e.highway);
    const railway = clean(e.railway);
    const waterway = clean(e.waterway);
    const manMade = clean(e.man_made);
    const bridge = clean(e.bridge);
    const landuse = clean(e.landuse);
    const amenity = clean(e.amenity);
    const leisure = clean(e.leisure);
    const barrier = clean(e.barrier);
    const lockTag = clean(e.lock_tag || e.lock);
    const location = clean(e.location);
    const building = clean(e.building);
    const name = clean(e.name);
    const roofish = location === 'roof' || building === 'roof' || name.includes('dach') || name.includes('roof');
    const positiveLock = !!lockTag && !/^(no|false|0)$/i.test(lockTag);
    if ((generatorSource === 'solar' || plantSource === 'solar') && roofish) return 'solar_roof';
    if (generatorSource === 'solar' || plantSource === 'solar') return 'solar';
    if (generatorSource === 'wind' || plantSource === 'wind') return 'wind';
    if (
      marineAmenity.has(amenity) ||
      marineLeisure.has(leisure) ||
      marineManMade.has(manMade) ||
      marineWaterway.has(waterway) ||
      positiveLock ||
      /(hafen|marina|schleuse|anleger|anlegestelle|kai)/.test(name)
    ) return 'marine_infra';
    if (perimeterBarrier.has(barrier) || /(zaun|wildzaun|schutzzaun|perimeter)/.test(name)) return 'perimeter_security';
    if (/(hydro|water)/.test(`${generatorSource} ${plantSource}`) || ['dam', 'weir'].includes(waterway)) return 'hydro';
    if (['substation', 'transformer', 'switchgear', 'converter', 'compensator'].includes(power)) return 'power_station';
    if (['line', 'minor_line', 'cable', 'tower', 'pole'].includes(power)) return 'power_grid';
    if (bridge && bridge !== 'no') return 'bridge';
    if (manMade === 'bridge') return 'bridge';
    if (majorRail.has(railway) || railFacility.has(railway)) return 'rail';
    if (majorHighway.has(highway)) return 'road';
    if (landuse === 'industrial' || infraManMade.has(manMade) || infraAmenity.has(clean(e.amenity))) return 'industrial';
    if (power) return 'power';
    return 'infra';
  }

  function isInfra(e) {
    const power = clean(e.power);
    const highway = clean(e.highway);
    const railway = clean(e.railway);
    const manMade = clean(e.man_made);
    const waterway = clean(e.waterway);
    const bridge = clean(e.bridge);
    const amenity = clean(e.amenity);
    const leisure = clean(e.leisure);
    const barrier = clean(e.barrier);
    const name = clean(e.name);
    const lockTag = clean(e.lock_tag || e.lock);
    const positiveLock = !!lockTag && !/^(no|false|0)$/i.test(lockTag);
    return (
      infraPower.has(power) ||
      !!energyValue(e, 'generator_source') ||
      !!energyValue(e, 'plant_source') ||
      !!energyValue(e, 'generator_method') ||
      !!energyValue(e, 'plant_method') ||
      !!clean(e.substation) ||
      ['dam', 'weir'].includes(waterway) ||
      marineWaterway.has(waterway) ||
      positiveLock ||
      (bridge && bridge !== 'no') ||
      marineAmenity.has(amenity) ||
      marineLeisure.has(leisure) ||
      infraManMade.has(manMade) ||
      marineManMade.has(manMade) ||
      infraAmenity.has(clean(e.amenity)) ||
      perimeterBarrier.has(barrier) ||
      /(hafen|marina|schleuse|anleger|anlegestelle|kai|zaun|wildzaun|schutzzaun|perimeter)/.test(name) ||
      majorHighway.has(highway) ||
      railFacility.has(railway) ||
      clean(e.landuse) === 'industrial' ||
      clean(e.industrial) !== ''
    );
  }

  function isLowValueBridge(e) {
    const bridge = clean(e.bridge);
    const manMade = clean(e.man_made);
    if ((!bridge || bridge === 'no') && manMade !== 'bridge') return false;
    const railway = clean(e.railway);
    const highway = clean(e.highway);
    if (manMade === 'bridge' && !railway && !highway) return !clean(e.name);
    if (majorRail.has(railway)) return false;
    if (drivableHighway.has(highway)) return false;
    return true;
  }

  function isSolarRoof(e) {
    return clean(e.infra_type) === 'solar_roof';
  }

  function isProminentSolar(e) {
    if (clean(e.infra_type) !== 'solar' || isSolarRoof(e)) return false;
    const name = clean(e.name);
    const sampleCount = Math.round(Number(e.sample_count || 0));
    return (
      clean(e.power) === 'plant' ||
      energyValue(e, 'plant_source') === 'solar' ||
      name.includes('solarpark') ||
      name.includes('solar farm') ||
      sampleCount >= 12
    );
  }

  function isLowValuePower(e) {
    const power = clean(e.power);
    if (power === 'pole') return true;
    const distinctName = clean(e.name) && clean(e.name) !== clean(e.operator, true, 90) && clean(e.name) !== clean(e.ref, true, 90);
    const voltageValues = (String(e.voltage || '').match(/\d+/g) || []).map(Number);
    const voltage = Math.max(0, ...voltageValues);
    const substation = clean(e.substation);
    const sampleCount = Math.round(Number(e.sample_count || 0));
    if (power === 'substation') {
      if (['minor_distribution', 'kiosk', 'transformer'].includes(substation) && voltage < 30000) return true;
      if (!substation && !distinctName && sampleCount < 10 && voltage < 30000) return true;
      return false;
    }
    if (power !== 'transformer') return false;
    return !(distinctName || substation);
  }

  function isLowValueRail(e) {
    const railway = clean(e.railway);
    if (!railway) return false;
    if (majorRail.has(railway) && !clean(e.bridge) && !clean(e.tunnel)) return true;
    if (railway === 'platform' && !clean(e.name)) return true;
    return false;
  }

  function isLowValueInfra(e) {
    return isLowValueBridge(e) || isSolarRoof(e) || isLowValuePower(e) || isLowValueRail(e);
  }

  function normalize(e, sourceKind) {
    const lat = normCoord(e?.lat);
    const lon = normCoord(e?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (!isInfra(e)) return null;
    const type = infraType(e);
    const out = {
      name: String(e?.name || e?.ref || e?.operator || '').trim().slice(0, 90),
      lat,
      lon,
      sourceKind: 'infra',
      infra_type: type
    };
    const fields = [
      ['layer', true],
      ['highway', true],
      ['railway', true],
      ['waterway', true],
      ['water', true],
      ['natural', true],
      ['landuse', true],
      ['amenity', true],
      ['leisure', true],
      ['tourism', true],
      ['historic', true],
      ['man_made', true],
      ['power', true],
      ['generator_source', true],
      ['plant_source', true],
      ['generator_method', true],
      ['plant_method', true],
      ['substation', true],
      ['transformer', true],
      ['voltage', false],
      ['frequency', false],
      ['operator', false],
      ['ref', false],
      ['bridge', true],
      ['service', true],
      ['industrial', true],
      ['building', true],
      ['material', true],
      ['barrier', true],
      ['lock_tag', true],
      ['tunnel', true],
      ['pipeline', true],
      ['utility', true]
    ];
    for (const [key, lower] of fields) {
      const value = key.includes('_') ? (e?.[key] || e?.[key.replace('_', ':')]) : e?.[key];
      const s = clean(value, lower);
      if (s) out[key] = s;
    }
    if (e?.osm_kind) out.osm_kind = clean(e.osm_kind, true, 24);
    if (e?.osm_id) out.osm_id = clean(e.osm_id, false, 40);
    if (Number(e?.sample_count || 0) > 0) out.sample_count = Math.round(Number(e.sample_count || 0));
    out.infra_enriched = true;
    if (sourceKind === 'obs' && !out.man_made && String(e?.type || '').toLowerCase().includes('tower')) out.man_made = 'tower';
    if (isLowValueInfra(out)) return null;
    return out;
  }

  const raw = [];
  for (const e of linIn) {
    const mapped = normalize({
      ...e,
      layer: e?.layer || e?.type || ''
    }, 'lin');
    if (mapped) raw.push(mapped);
  }
  for (const e of poiIn) {
    const mapped = normalize(e, 'poi');
    if (mapped) raw.push(mapped);
  }
  for (const e of obsIn) {
    const t = String(e?.type || '').toLowerCase();
    const mapped = normalize({
      ...e,
      power: t.includes('power') ? 'tower' : '',
      generator_source: t.includes('wind') ? 'wind' : '',
      man_made: t.includes('mast') || t.includes('tower') ? 'tower' : ''
    }, 'obs');
    if (mapped) raw.push(mapped);
  }

  const dedup = [];
  const seen = new Set();
  for (const e of raw) {
    const primary = e.osm_kind && e.osm_id ? `${e.osm_kind}|${e.osm_id}` : '';
    const geo = `${e.infra_type}|${e.name}|${e.lat}|${e.lon}|${e.power || ''}|${e.man_made || ''}|${e.highway || ''}|${e.railway || ''}|${e.waterway || ''}`;
    const key = primary || geo;
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(e);
  }

  function haversineNm(aLat, aLon, bLat, bLon) {
    const rNm = 3440.065;
    const lat1 = Number(aLat) * Math.PI / 180;
    const lat2 = Number(bLat) * Math.PI / 180;
    const dLat = lat2 - lat1;
    const dLon = (Number(bLon) - Number(aLon)) * Math.PI / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * rNm * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function clusterLabel(type, members) {
    if (type === 'solar') return 'Solarpark';
    if (type === 'marine_infra') return 'Hafen-/Schleusenbereich';
    if (type === 'perimeter_security') return 'Perimeterbereich';
    const railTags = new Map();
    for (const e of members) {
      const tag = clean(e.railway);
      if (!tag) continue;
      railTags.set(tag, Number(railTags.get(tag) || 0) + 1);
    }
    const dominant = [...railTags.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))[0]?.[0] || '';
    if (dominant === 'switch') return 'Weichengruppe';
    if (dominant === 'signal') return 'Signalgruppe';
    if (dominant === 'level_crossing' || dominant === 'crossing') return 'Bahnuebergangsgruppe';
    if (dominant === 'junction') return 'Bahnknoten';
    return 'Bahninfrastruktur-Gruppe';
  }

  function clusterEntries(items, type, cellNm, minCount) {
    const rows = items
      .map((e, idx) => ({ e, idx }))
      .filter(row => {
        if (type === 'solar') return clean(row.e.infra_type) === 'solar';
        if (type === 'rail') return clean(row.e.infra_type) === 'rail' && railClusterTarget.has(clean(row.e.railway));
        if (type === 'marine_infra') return clean(row.e.infra_type) === 'marine_infra';
        if (type === 'perimeter_security') return clean(row.e.infra_type) === 'perimeter_security' && clean(row.e.barrier) === 'fence';
        return false;
      });
    if (rows.length < minCount) return { clustered: new Set(), clusters: [] };
    const cellDeg = Math.max(0.001, Number(cellNm) / 60);
    const grid = new Map();
    const cellOf = e => `${Math.floor(Number(e.lat) / cellDeg)}|${Math.floor(Number(e.lon) / cellDeg)}`;
    for (let i = 0; i < rows.length; i++) {
      const key = cellOf(rows[i].e);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(i);
    }
    const assigned = new Set();
    const clustered = new Set();
    const clusters = [];
    for (let i = 0; i < rows.length; i++) {
      if (assigned.has(i)) continue;
      const seed = rows[i].e;
      const [cy, cx] = cellOf(seed).split('|').map(Number);
      const candidates = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          candidates.push(...(grid.get(`${cy + dy}|${cx + dx}`) || []));
        }
      }
      const members = [...new Set(candidates)].filter(pos => !assigned.has(pos) && haversineNm(seed.lat, seed.lon, rows[pos].e.lat, rows[pos].e.lon) <= cellNm);
      if (members.length < minCount) continue;
      for (const pos of members) assigned.add(pos);
      const memberRows = members.map(pos => rows[pos]);
      const memberItems = memberRows.map(row => row.e);
      for (const row of memberRows) clustered.add(row.idx);
      const lat = memberItems.reduce((sum, e) => sum + Number(e.lat), 0) / memberItems.length;
      const lon = memberItems.reduce((sum, e) => sum + Number(e.lon), 0) / memberItems.length;
      const radiusNm = Math.max(...memberItems.map(e => haversineNm(lat, lon, e.lat, e.lon)), 0);
      const cluster = {
        name: clusterLabel(type, memberItems),
        lat: Math.round(lat * 1e6) / 1e6,
        lon: Math.round(lon * 1e6) / 1e6,
        sourceKind: 'infra',
        infra_type: type,
        osm_kind: 'cluster',
        osm_id: `${type}:${Math.round(lat * 10000)}:${Math.round(lon * 10000)}`,
        infra_cluster: true,
        cluster_type: type,
        cluster_count: memberItems.length,
        cluster_radius_nm: Math.round(radiusNm * 100) / 100,
        cluster_sample_names: memberItems.map(e => String(e.name || '').trim()).filter(Boolean).slice(0, 4).join(' | '),
        sample_count: memberItems.reduce((sum, e) => sum + Math.max(1, Number(e.sample_count || 1)), 0),
        infra_enriched: true
      };
      if (type === 'solar') cluster.generator_source = 'solar';
      if (type === 'rail') cluster.railway = clean(memberItems[0]?.railway) || 'rail';
      if (type === 'marine_infra') {
        cluster.waterway = 'dock';
        cluster.leisure = 'marina';
      }
      if (type === 'perimeter_security') cluster.barrier = 'fence';
      clusters.push(cluster);
    }
    return { clustered, clusters };
  }

  const solarClusters = clusterEntries(dedup, 'solar', 0.65, 3);
  const railClusters = clusterEntries(dedup, 'rail', 0.28, 3);
  const marineClusters = clusterEntries(dedup, 'marine_infra', 0.45, 2);
  const perimeterClusters = clusterEntries(dedup, 'perimeter_security', 0.35, 4);
  const clusteredIndexes = new Set([...solarClusters.clustered, ...railClusters.clustered, ...marineClusters.clustered, ...perimeterClusters.clustered]);
  const clusters = solarClusters.clusters.concat(railClusters.clusters, marineClusters.clusters, perimeterClusters.clusters);
  const compacted = dedup.filter((e, idx) => {
    if (clusteredIndexes.has(idx)) return false;
    if (clean(e.infra_type) === 'solar' && !isProminentSolar(e)) return false;
    if (clean(e.infra_type) === 'perimeter_security' && clean(e.barrier) === 'fence' && !clean(e.name)) return false;
    return !isLowValueInfra(e);
  });

  const groups = {
    power_station: [],
    power_grid: [],
    solar: [],
    wind: [],
    hydro: [],
    bridge: [],
    road: [],
    rail: [],
    marine_infra: [],
    perimeter_security: [],
    industrial: [],
    infra: []
  };
  for (const e of compacted) {
    const g = Object.prototype.hasOwnProperty.call(groups, e.infra_type) ? e.infra_type : 'infra';
    groups[g].push(e);
  }
  const caps = {
    power_station: 650,
    power_grid: 650,
    solar: 260,
    wind: 300,
    hydro: 350,
    bridge: 900,
    road: 700,
    rail: 900,
    marine_infra: 260,
    perimeter_security: 420,
    industrial: 700,
    infra: 250
  };
  let poi = [];
  for (const key of Object.keys(groups)) poi = poi.concat(groups[key].slice(0, caps[key] || 600));
  poi = poi.slice(0, 4800);
  const cappedClusters = clusters.slice(0, 650);

  const rawCounts = input?.counts || {};
  const rawTotal = Number(rawCounts.obs || 0) + Number(rawCounts.lin || 0) + Number(rawCounts.poi || 0);
  return {
    v: 1,
    tile: String(input?.tile || ''),
    source: String(input?.source || ''),
    generatedAt: String(input?.generatedAt || new Date().toISOString()),
    meta: {
      schema: 'ga.infraTile.v1',
      dataStatus: rawTotal === 0 ? 'empty' : 'loaded',
      rawCounts: {
        obs: Number(rawCounts.obs || 0),
        lin: Number(rawCounts.lin || 0),
        poi: Number(rawCounts.poi || 0)
      },
      groupCounts: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length]))
    },
    infra: {
      poi,
      clusters: cappedClusters
    },
    counts: {
      infra: poi.length,
      clusters: cappedClusters.length
    }
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const raw = await fs.readFile(args.in, 'utf8');
  const parsed = JSON.parse(raw);

  const core = compactCore(parsed);
  const poi = compactPoi(parsed);
  const infra = args.infraOut ? compactInfra(parsed) : null;

  await fs.mkdir(path.dirname(args.coreOut), { recursive: true });
  await fs.mkdir(path.dirname(args.poiOut), { recursive: true });
  if (args.infraOut) await fs.mkdir(path.dirname(args.infraOut), { recursive: true });

  await fs.writeFile(args.coreOut, gzipSync(JSON.stringify(core)));
  await fs.writeFile(args.poiOut, gzipSync(JSON.stringify(poi)));
  if (args.infraOut) await fs.writeFile(args.infraOut, gzipSync(JSON.stringify(infra)));

  console.log(JSON.stringify({
    ok: true,
    in: args.in,
    coreOut: args.coreOut,
    poiOut: args.poiOut,
    infraOut: args.infraOut || '',
    counts: {
      core: core.counts,
      poi: poi.counts,
      infra: infra ? infra.counts : undefined
    }
  }));
}

main().catch(err => {
  console.error(String(err && err.stack || err));
  process.exit(1);
});
