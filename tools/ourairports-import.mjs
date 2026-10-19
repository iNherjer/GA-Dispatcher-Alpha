import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = value => String(value || '').trim().toUpperCase();
const name = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/\b(airport|airfield|airstrip|aerodrome)\b/g, '')
  .replace(/[^a-z0-9]/g, '');

// CSV contains quoted commas, escaped quotes and embedded newlines. Never split it by lines.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (quoted || !field) quoted = !quoted;
      else throw new Error('Invalid CSV quote');
    } else if (!quoted && (char === ',' || char === '\n')) {
      row.push(field.replace(/\r$/, '')); field = '';
      if (char === '\n') { rows.push(row); row = []; }
    } else field += char;
  }
  if (quoted) throw new Error('Unclosed CSV quote');
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const headers = rows.shift()?.map(value => value.replace(/^\uFEFF/, '')) || [];
  const required = ['id', 'ident', 'type', 'name', 'latitude_deg', 'longitude_deg', 'iso_country', 'icao_code', 'gps_code', 'local_code'];
  if (required.some(key => !headers.includes(key))) throw new Error('OurAirports CSV headers missing');
  return rows.filter(row => row.some(Boolean)).map(row => {
    if (row.length !== headers.length) throw new Error('OurAirports CSV column count mismatch');
    return Object.fromEntries(headers.map((header, i) => [header, row[i]]));
  });
}

export async function readOurAirportsSnapshot() {
  const directory = path.join(root, 'data/airport-sources');
  const source = JSON.parse(await fs.readFile(path.join(directory, 'ourairports.json'), 'utf8'));
  if (path.basename(source.snapshot) !== source.snapshot) throw new Error('Invalid OurAirports snapshot path');
  const raw = gunzipSync(await fs.readFile(path.join(directory, source.snapshot)));
  const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  if (raw.length !== source.bytes || sha256 !== source.sha256) throw new Error('OurAirports snapshot checksum mismatch');
  const rows = parseCsv(raw.toString('utf8'));
  if (rows.length < 70_000) throw new Error('Incomplete OurAirports snapshot');
  return { source, rows };
}

function distance(a, b) {
  const rad = Math.PI / 180;
  const lat1 = Number(a.lat) * rad, lat2 = Number(b.lat) * rad;
  const dlat = lat2 - lat1, dlon = (Number(b.lon) - Number(a.lon)) * rad;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(
    Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2
  )));
}

function identifiers(key, record) {
  return [...new Set([key, record.icao, record.icaoCode, record.icao_code,
    record.gpsCode, record.gps_code, record.altIdentifier, record.local_code,
    record.localCode, record.iata, ...(record.aliases || [])].map(code).filter(Boolean))];
}

export function mergeOurAirports(database, rows, source, faaSupplement = {}) {
  const report = { schemaVersion: 1, source, scope: source.includedTypes,
    inputCount: rows.length, eligibleCount: 0, matchedCount: 0, addedCount: 0,
    aliasesAdded: 0, countries: {}, conflicts: [], aliasConflicts: [], fieldDifferences: [] };
  const codes = new Map(), names = new Map(), grid = new Map();
  const addIndex = (map, key, value) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(value);
  };
  const cell = value => Math.floor(Number(value) * 10);
  function index(key, record) {
    for (const id of identifiers(key, record)) addIndex(codes, id, key);
    const normalizedName = name(record.name);
    if (normalizedName) addIndex(names, `${record.country}:${normalizedName}`, key);
    addIndex(grid, `${record.country}:${cell(record.lat)}:${cell(record.lon)}`, key);
  }
  for (const [key, record] of Object.entries(database)) index(key, record);
  const faaByIdent = new Map();
  for (const [key, record] of Object.entries(faaSupplement.airports || {})) {
    if (record.ourairports_ident) faaByIdent.set(code(record.ourairports_ident), { key, record });
    if (record.aliasOf && database[record.aliasOf]) addIndex(codes, code(key), record.aliasOf);
  }

  // Non-ICAO codes can collide between countries. Only globally unambiguous aliases enter search.
  const sourceCodes = new Map();
  const included = rows.filter(row => source.includedTypes.includes(row.type));
  for (const row of included) {
    for (const id of [row.ident, row.icao_code, row.gps_code, row.local_code, row.iata_code].map(code).filter(Boolean)) {
      addIndex(sourceCodes, id, row.id);
    }
  }
  const seenIds = new Set();
  for (const row of included.sort((a, b) => Number(a.id) - Number(b.id))) {
    if (!/^\d+$/.test(row.id) || seenIds.has(row.id)) throw new Error(`Invalid/duplicate OurAirports ID ${row.id}`);
    seenIds.add(row.id);
    const point = { lat: Number(row.latitude_deg), lon: Number(row.longitude_deg) };
    if (!row.name || !row.iso_country || row.latitude_deg === '' || row.longitude_deg === ''
      || !Number.isFinite(point.lat) || !Number.isFinite(point.lon) || Math.abs(point.lat) > 90 || Math.abs(point.lon) > 180) {
      throw new Error(`Invalid OurAirports position ${row.id}`);
    }
    const summary = report.countries[row.iso_country] ||= { eligible: 0, matched: 0, added: 0, conflicts: 0 };
    summary.eligible += 1; report.eligibleCount += 1;
    const details = { id: row.id, ident: row.ident, name: row.name, country: row.iso_country, ...point };
    function conflict(reason, candidates) {
      summary.conflicts += 1;
      report.conflicts.push({ ...details, reason, candidates: [...candidates].map(key => ({ key,
        name: database[key].name, distanceKm: Math.round(distance(point, database[key]) * 1000) / 1000 })) });
    }
    // IATA alone is not an identity anchor. Local codes only match within their country.
    const anchors = [...new Set([row.icao_code, row.gps_code, row.local_code, row.ident].map(code).filter(Boolean))];
    const candidates = new Set(anchors.flatMap(id => [...(codes.get(id) || [])])
      .filter(key => database[key].country === row.iso_country));
    let target;
    if (candidates.size) {
      if (candidates.size !== 1) { conflict('ambiguous-code', candidates); continue; }
      target = [...candidates][0];
      if (distance(point, database[target]) > 5) { conflict('code-position-conflict', candidates); continue; }
      if (database[target].type === 8 || database[target].type === 'closed') {
        conflict('closed-existing-place', candidates); continue;
      }
    } else {
      const sameName = [...(names.get(`${row.iso_country}:${name(row.name)}`) || [])]
        .filter(key => distance(point, database[key]) <= 2);
      if (sameName.length === 1 && distance(point, database[sameName[0]]) <= 1) {
        const existing = database[sameName[0]];
        const existingIcao = code(existing.icaoCode || existing.icao_code || sameName[0]);
        if (row.icao_code && /^[A-Z]{4}$/.test(existingIcao) && existingIcao !== code(row.icao_code)) {
          conflict('different-icao-review', sameName); continue;
        }
        target = sameName[0];
      }
      else if (sameName.length) { conflict('name-position-review', sameName); continue; }
      else {
        // Nearby, differently named records are held for review rather than creating obvious duplicates.
        const nearby = [];
        const lonCells = Math.ceil(0.003 / Math.max(0.01, Math.cos(point.lat * Math.PI / 180)) / 0.1) + 1;
        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -lonCells; dx <= lonCells; dx += 1) {
          for (const key of grid.get(`${row.iso_country}:${cell(point.lat) + dy}:${cell(point.lon) + dx}`) || []) {
            if (distance(point, database[key]) <= 0.25) nearby.push(key);
          }
        }
        if (nearby.length) { conflict('nearby-place-review', nearby); continue; }
      }
    }
    if (target && (database[target].type === 8 || database[target].type === 'closed')) {
      conflict('closed-existing-place', [target]); continue;
    }
    if (!target) {
      const official = code(row.icao_code);
      const faa = row.iso_country === 'US' ? faaByIdent.get(code(row.ident)) : null;
      target = /^[A-Z]{4}$/.test(official) ? official
        : faa && !faa.record.aliasOf ? faa.key : `OUR-${row.id}`;
      if (database[target] || (official && codes.has(official))) {
        conflict('official-code-collision', codes.get(official) || [target]); continue;
      }
      database[target] = { icao: target, name: row.name, country: row.iso_country,
        city: row.municipality || '', state: row.iso_region || '', ...point,
        elevation: row.elevation_ft.trim() && Number.isFinite(Number(row.elevation_ft)) ? Number(row.elevation_ft) : null,
        type: row.type, source: 'ourairports', ourAirportsId: row.id, ourAirportsIdent: row.ident,
        ...(official ? { icaoCode: official } : {}) };
      index(target, database[target]);
      summary.added += 1; report.addedCount += 1;
    } else {
      summary.matched += 1; report.matchedCount += 1;
      const old = database[target];
      if (row.elevation_ft.trim() && Number.isFinite(Number(row.elevation_ft))
        && old.elevation !== null && old.elevation !== undefined
        && Math.abs(Number(old.elevation) - Number(row.elevation_ft)) > 200) {
        report.fieldDifferences.push({ ...details, key: target, field: 'elevationFt',
          existing: old.elevation, ourAirports: Number(row.elevation_ft) });
      }
      // Existing coordinates, elevation and detailed OpenAIP type remain authoritative in this import.
      old.ourAirportsId ||= row.id;
      old.ourAirportsIdent ||= row.ident;
    }
    const record = database[target];
    const aliases = new Set(record.aliases || []);
    for (const id of [...new Set([row.ident, row.icao_code, row.gps_code, row.local_code, row.iata_code].map(code).filter(Boolean))]) {
      const others = [...(codes.get(id) || [])].filter(key => key !== target);
      if (others.length || sourceCodes.get(id)?.size > 1) {
        report.aliasConflicts.push({ ...details, key: target, alias: id, existingKeys: others });
        continue;
      }
      if (!identifiers(target, record).includes(id) && !aliases.has(id)) { aliases.add(id); report.aliasesAdded += 1; }
      addIndex(codes, id, target);
      if (id === code(row.icao_code) && !record.icaoCode && !record.icao_code) record.icaoCode = id;
      if (id === code(row.iata_code) && record.source === 'ourairports' && !record.iata) record.iata = id;
      if (id === code(row.local_code) && !record.altIdentifier) record.altIdentifier = id;
      if (id === code(row.gps_code) && !record.altIdentifier) record.altIdentifier = id;
    }
    if (aliases.size) record.aliases = [...aliases].sort();
  }
  report.totalCount = Object.keys(database).length;
  report.countries = Object.fromEntries(Object.entries(report.countries).sort(([a], [b]) => a.localeCompare(b)));
  return report;
}
