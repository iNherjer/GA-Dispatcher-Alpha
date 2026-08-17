#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolDir, '..');
const databasePath = path.join(rootDir, 'airports.json');
const supplementPath = path.join(rootDir, 'data', 'faa-local-airports.json');
const databaseMetaPath = path.join(rootDir, 'data', 'airports-database-meta.json');
const searchRoot = path.join(rootDir, 'data', 'airport-search');
const GENERATION_VERSION = 3;
const BUNDLE_COUNT = 192;
const STOP_WORDS = new Set([
  'aerodrome',
  'airfield',
  'airport',
  'airstrip',
  'field',
  'flugplatz',
  'heliport',
  'landing'
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function cleanIdent(value = '') {
  return String(value || '').trim().toUpperCase();
}

function normalizeSearchText(value = '') {
  return String(value || '')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function bundleIndex(prefix) {
  let hash = 2166136261;
  for (const char of String(prefix || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % BUNDLE_COUNT;
}

function uniqueCodes(key, record = {}) {
  const aliases = Array.isArray(record.aliases) ? record.aliases : [];
  return Array.from(new Set([
    key,
    record.icao,
    record.faa,
    record.local_code,
    record.localCode,
    record.gps_code,
    record.gpsCode,
    record.icao_code,
    record.icaoCode,
    record.iata,
    record.altIdentifier,
    record.designator,
    ...aliases
  ].map(cleanIdent).filter(Boolean)));
}

function tupleForRecord(key, record = {}) {
  const code = cleanIdent(key || record.icao);
  const codes = uniqueCodes(code, record);
  const flags = (record.ppr ? 1 : 0) | (record.private ? 2 : 0) | (record.winchOnly ? 4 : 0);
  const tuple = [
    code,
    String(record.name || record.n || record.city || code),
    String(record.city || ''),
    String(record.state || ''),
    String(record.country || ''),
    record.type ?? '',
    Number(record.lat),
    Number(record.lon),
    Number.isFinite(Number(record.elevation)) ? Number(record.elevation) : null,
    String(record.iata || ''),
    String(record.altIdentifier || record.designator || ''),
    String(record.sourceId || ''),
    String(record.icaoCode || record.icao_code || record.gpsCode || record.gps_code || ''),
    cleanIdent(record.aliasOf || ''),
    flags,
    codes.length > 1 ? codes : null
  ];
  while (tuple.length > 9 && (tuple.at(-1) === '' || tuple.at(-1) === null || tuple.at(-1) === 0)) {
    tuple.pop();
  }
  return tuple;
}

function normalizedTokens(values = []) {
  return normalizeSearchText(values.join(' ')).split(' ')
    .filter(token => token.length >= 2 && !STOP_WORDS.has(token));
}

function searchTokensForRecord(key, record = {}) {
  const codes = uniqueCodes(key, record);
  return Array.from(new Set(normalizedTokens([
    codes.join(' '),
    record.name || record.n || '',
    record.city || '',
    record.state || ''
  ])));
}

function prefixesForRecord(key, record = {}) {
  return Array.from(new Set(searchTokensForRecord(key, record)
    .map(token => token.slice(0, 2))
    .filter(prefix => /^[a-z0-9]{2}$/.test(prefix))));
}

function homePrefixForRecord(key, record = {}) {
  const preferred = normalizedTokens([
    record.name || record.n || '',
    record.city || '',
    record.state || ''
  ])[0];
  const fallback = searchTokensForRecord(key, record)[0] || normalizeSearchText(key);
  return String(preferred || fallback || '').slice(0, 2);
}

function trigramsForRecord(key, record = {}) {
  const trigrams = new Set();
  for (const token of searchTokensForRecord(key, record)) {
    for (let index = 0; index + 2 < token.length; index += 1) {
      trigrams.add(token.slice(index, index + 3));
    }
  }
  return Array.from(trigrams).filter(trigram => /^[a-z0-9]{3}$/.test(trigram));
}

function mergeFaaSupplement(database, supplement) {
  const merged = new Map(Object.entries(database));
  const entries = supplement?.airports && typeof supplement.airports === 'object'
    ? supplement.airports
    : {};
  for (const [rawCode, entry] of Object.entries(entries)) {
    const code = cleanIdent(rawCode);
    if (!code || !entry || typeof entry !== 'object') continue;
    const aliasOf = cleanIdent(entry.aliasOf);
    const target = aliasOf ? database[aliasOf] : null;
    const record = {
      ...(target || {}),
      ...entry,
      icao: code,
      faa: cleanIdent(entry.faa || entry.local_code || code),
      local_code: cleanIdent(entry.local_code || entry.faa || code),
      gps_code: cleanIdent(entry.gps_code || target?.gps_code || target?.icao || ''),
      icao_code: cleanIdent(entry.icao_code || target?.icao_code || ''),
      name: entry.name || target?.name || target?.n || code,
      city: entry.city || target?.city || '',
      state: entry.state || target?.state || '',
      country: entry.country || target?.country || 'US',
      elevation: Number.isFinite(Number(entry.elevation ?? target?.elevation))
        ? Number(entry.elevation ?? target?.elevation)
        : null,
      lat: Number(entry.lat ?? target?.lat),
      lon: Number(entry.lon ?? target?.lon),
      type: entry.type || target?.type || '',
      aliasOf
    };
    if (Number.isFinite(record.lat) && Number.isFinite(record.lon)) merged.set(code, record);
  }
  return merged;
}

async function buildSearchPacks() {
  const [databaseRaw, supplementRaw, databaseMetaRaw] = await Promise.all([
    fs.readFile(databasePath, 'utf8'),
    fs.readFile(supplementPath, 'utf8'),
    fs.readFile(databaseMetaPath, 'utf8')
  ]);
  const database = JSON.parse(databaseRaw);
  const supplement = JSON.parse(supplementRaw);
  const databaseMeta = JSON.parse(databaseMetaRaw);
  if (Object.keys(database).length < 50_000 || Number(databaseMeta.totalCount) !== Object.keys(database).length) {
    throw new Error('airports.json oder Metadaten sind unvollständig');
  }

  const datasetVersion = String(databaseMeta.datasetVersion || '').trim();
  if (!/^snapshot-\d{4}-\d{2}-\d{2}$/.test(datasetVersion)) {
    throw new Error(`Ungültige Dataset-Version: ${datasetVersion}`);
  }
  const packVersion = `${datasetVersion}-v${GENERATION_VERSION}`;
  const targetDir = path.join(searchRoot, packVersion);
  if (path.dirname(targetDir) !== searchRoot || !targetDir.startsWith(`${searchRoot}${path.sep}`)) {
    throw new Error(`Unsicherer Zielpfad: ${targetDir}`);
  }

  const records = mergeFaaSupplement(database, supplement);
  const recordEntries = Array.from(records.entries()).sort(([a], [b]) => a.localeCompare(b));
  const shards = new Map();
  const trigramPostings = new Map();
  const lookup = [];
  for (let recordId = 0; recordId < recordEntries.length; recordId += 1) {
    const [key, record] = recordEntries[recordId];
    const tuple = tupleForRecord(key, record);
    for (const prefix of prefixesForRecord(key, record)) {
      if (!shards.has(prefix)) shards.set(prefix, []);
      shards.get(prefix).push(tuple);
    }
    const homePrefix = homePrefixForRecord(key, record);
    if (!/^[a-z0-9]{2}$/.test(homePrefix)) throw new Error(`Kein Home-Präfix für ${key}`);
    lookup.push([homePrefix, cleanIdent(key)]);
    for (const trigram of trigramsForRecord(key, record)) {
      if (!trigramPostings.has(trigram)) trigramPostings.set(trigram, []);
      trigramPostings.get(trigram).push(recordId);
    }
  }

  const bundles = Array.from({ length: BUNDLE_COUNT }, () => ({ p: {}, t: {} }));
  const prefixes = {};
  for (const prefix of Array.from(shards.keys()).sort()) {
    const items = shards.get(prefix).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    const bundle = bundleIndex(prefix);
    bundles[bundle].p[prefix] = items;
    prefixes[prefix] = { bundle, count: items.length };
  }
  for (const trigram of Array.from(trigramPostings.keys()).sort()) {
    const bundle = bundleIndex(trigram);
    bundles[bundle].t[trigram] = trigramPostings.get(trigram);
  }

  const temporaryDir = path.join(searchRoot, `.tmp-${packVersion}-${process.pid}`);
  await fs.mkdir(temporaryDir, { recursive: true });
  const files = {};
  let totalBytes = 0;
  for (let bundle = 0; bundle < bundles.length; bundle += 1) {
    const fileId = String(bundle).padStart(3, '0');
    const content = `${JSON.stringify(bundles[bundle])}\n`;
    await fs.writeFile(path.join(temporaryDir, `${fileId}.json`), content, 'utf8');
    const bytes = Buffer.byteLength(content);
    totalBytes += bytes;
    files[fileId] = {
      prefixCount: Object.keys(bundles[bundle].p).length,
      trigramCount: Object.keys(bundles[bundle].t).length,
      bytes,
      sha256: sha256(content)
    };
  }
  const lookupContent = `${JSON.stringify(lookup)}\n`;
  await fs.writeFile(path.join(temporaryDir, 'lookup.json'), lookupContent, 'utf8');
  const lookupBytes = Buffer.byteLength(lookupContent);
  totalBytes += lookupBytes;

  await fs.mkdir(searchRoot, { recursive: true });
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.rename(temporaryDir, targetDir);
  const manifest = {
    schemaVersion: 2,
    packVersion,
    datasetVersion,
    databaseSha256: sha256(databaseRaw),
    supplementSha256: sha256(supplementRaw),
    recordCount: records.size,
    prefixLength: 2,
    trigramLength: 3,
    trigramCount: trigramPostings.size,
    bundleCount: BUNDLE_COUNT,
    tupleFields: [
      'code', 'name', 'city', 'state', 'country', 'type', 'lat', 'lon', 'elevation',
      'iata', 'altIdentifier', 'sourceId', 'icaoCode', 'aliasOf', 'flags', 'codes'
    ],
    lookupFields: ['homePrefix', 'code'],
    lookup: {
      url: 'lookup.json',
      count: lookup.length,
      bytes: lookupBytes,
      sha256: sha256(lookupContent)
    },
    bundleFileCount: Object.keys(files).length,
    fileCount: Object.keys(files).length + 1,
    totalBytes,
    prefixes,
    files
  };
  await fs.writeFile(
    path.join(searchRoot, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );
  console.log(JSON.stringify({
    packVersion,
    records: records.size,
    files: Object.keys(files).length + 1,
    trigrams: trigramPostings.size,
    totalBytes,
    kirchzartenPackBytes: files[String(prefixes.ki.bundle).padStart(3, '0')]?.bytes || 0,
    output: path.relative(rootDir, targetDir)
  }, null, 2));
}

buildSearchPacks().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
