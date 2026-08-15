#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_SOURCE_BASE = 'https://inherjer.github.io/GA-Dispatcher-Aviation-Data/';
const DEFAULT_DATABASE = 'airports.json';
const DEFAULT_BACKUP = 'data/airports-backup-pre-openaip-20260815.json';
const FETCH_CONCURRENCY = 12;

function parseArgs(argv) {
  const result = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const separator = arg.indexOf('=');
    result[arg.slice(2, separator < 0 ? undefined : separator)] = separator < 0
      ? true
      : arg.slice(separator + 1);
  }
  return result;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchBuffer(url, label) {
  let lastError = null;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'GA-Dispatcher-Airport-Database-Builder/1.0'
        },
        signal: AbortSignal.timeout(60_000)
      });
      if (response.ok) return Buffer.from(await response.arrayBuffer());
      lastError = new Error(`${label}: HTTP ${response.status}`);
      if (![408, 425, 429, 500, 502, 503, 504].includes(response.status)) break;
      const retryAfter = Number(response.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(20_000, 500 * (2 ** (attempt - 1))));
    } catch (error) {
      lastError = error;
      if (attempt < 6) await sleep(Math.min(20_000, 500 * (2 ** (attempt - 1))));
    }
  }
  throw lastError || new Error(`${label}: Abruf fehlgeschlagen`);
}

async function fetchVerifiedJson(url, options = {}) {
  const buffer = await fetchBuffer(url, options.label || String(url));
  if (Number.isFinite(Number(options.bytes)) && buffer.byteLength !== Number(options.bytes)) {
    throw new Error(`${options.label || url}: Bytezahl stimmt nicht`);
  }
  if (options.sha256 && sha256(buffer) !== String(options.sha256).toLowerCase()) {
    throw new Error(`${options.label || url}: SHA-256 stimmt nicht`);
  }
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    throw new Error(`${options.label || url}: ungültiges JSON (${error.message})`);
  }
}

async function mapWithConcurrency(items, concurrency, mapper) {
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from(
    { length: Math.min(Math.max(1, concurrency), Math.max(1, items.length)) },
    () => worker()
  ));
}

function cleanCode(value = '', maxLength = 30) {
  return String(value || '').trim().toUpperCase().slice(0, maxLength);
}

function elevationFeet(elevation) {
  const value = Number(elevation?.value);
  if (!Number.isFinite(value)) return null;
  return Number(elevation?.unit) === 1 ? Math.round(value) : Math.round(value * 3.28084);
}

function cleanLegacyRecord(key, record = {}) {
  const cleaned = { ...record };
  cleaned.icao = cleanCode(cleaned.icao || key, 40);
  return cleaned;
}

function stableOpenAipIdent(item = {}, database = {}) {
  const icaoCode = cleanCode(item.icaoCode, 12);
  if (icaoCode) return icaoCode;
  const sourceId = String(item.id || '').trim();
  const candidates = [8, 12, sourceId.length].map(length => (
    `OA-${sourceId.slice(-length).toUpperCase()}`
  ));
  return candidates.find(candidate => (
    !database[candidate] || String(database[candidate]?.sourceId || '') === sourceId
  )) || `OA-${sha256(sourceId).slice(0, 16).toUpperCase()}`;
}

function mergeOpenAipAirport(database, item = {}) {
  const coordinates = item?.geometry?.coordinates;
  if (!String(item?.id || '').trim() || !String(item?.name || '').trim()) return false;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return false;
  const lon = Number(coordinates[0]);
  const lat = Number(coordinates[1]);
  const type = Number(item.type);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (!Number.isInteger(type) || type < 0 || type > 13) return false;

  const key = stableOpenAipIdent(item, database);
  const existing = database[key] && typeof database[key] === 'object' ? database[key] : null;
  const elevation = elevationFeet(item.elevation);
  const icaoCode = cleanCode(item.icaoCode, 12);
  const iata = existing?.iata || cleanCode(item.iataCode, 12);
  const altIdentifier = cleanCode(item.altIdentifier, 30);
  database[key] = {
    ...(existing || {}),
    icao: key,
    ...(icaoCode && icaoCode !== key ? { icaoCode } : {}),
    ...(iata ? { iata } : {}),
    ...(altIdentifier ? { altIdentifier } : {}),
    name: existing?.name || String(item.name).trim(),
    country: existing?.country || cleanCode(item.country, 2) || 'ZZ',
    elevation: Number.isFinite(Number(existing?.elevation)) ? Number(existing.elevation) : elevation,
    lat: Number.isFinite(Number(existing?.lat)) ? Number(existing.lat) : lat,
    lon: Number.isFinite(Number(existing?.lon)) ? Number(existing.lon) : lon,
    ...(existing?.tz ? { tz: existing.tz } : {}),
    sourceId: String(item.id).trim(),
    type,
    ...(item.ppr === true ? { ppr: true } : {}),
    ...(item.private === true ? { private: true } : {}),
    ...(item.winchOnly === true ? { winchOnly: true } : {})
  };
  return true;
}

function assertDatabasePath(databasePath) {
  const resolved = path.resolve(databasePath);
  const root = path.parse(resolved).root;
  if (resolved === root || resolved === process.cwd() || path.basename(resolved) !== 'airports.json') {
    throw new Error(`Unsicherer Datenbankpfad: ${resolved}`);
  }
  return resolved;
}

async function buildDatabase({ sourceBase, databasePath, backupPath, metadataPath }) {
  const targetPath = assertDatabasePath(databasePath);
  const resolvedBackupPath = path.resolve(backupPath || DEFAULT_BACKUP);
  if (resolvedBackupPath === targetPath || path.basename(resolvedBackupPath) !== 'airports-backup-pre-openaip-20260815.json') {
    throw new Error(`Unsicherer Backup-Pfad: ${resolvedBackupPath}`);
  }
  try {
    await fs.access(resolvedBackupPath);
  } catch (_) {
    await fs.mkdir(path.dirname(resolvedBackupPath), { recursive: true });
    await fs.copyFile(targetPath, resolvedBackupPath);
  }
  const backupRaw = await fs.readFile(resolvedBackupPath, 'utf8');
  const current = JSON.parse(backupRaw);
  if (!current || typeof current !== 'object' || Object.keys(current).length < 20_000) {
    throw new Error('Bestehende airports.json ist unvollständig');
  }
  const database = {};
  for (const [key, record] of Object.entries(current)) {
    const cleaned = cleanLegacyRecord(key, record);
    if (cleaned) database[cleanCode(key, 40)] = cleaned;
  }
  const legacyCount = Object.keys(database).length;

  const normalizedSourceBase = `${String(sourceBase || DEFAULT_SOURCE_BASE).replace(/\/+$/, '')}/`;
  const latest = await fetchVerifiedJson(new URL('latest.json', normalizedSourceBase), {
    label: 'latest.json'
  });
  if (
    Number(latest?.schemaVersion) !== 1
    || !/^cycles\/[^/]+\/manifest\.json$/.test(String(latest?.manifest || ''))
    || !/^[a-f0-9]{64}$/i.test(String(latest?.manifestSha256 || ''))
  ) throw new Error('latest.json: ungültiges Format');

  const manifestUrl = new URL(latest.manifest, normalizedSourceBase);
  const manifest = await fetchVerifiedJson(manifestUrl, {
    label: 'Aviation-Manifest',
    bytes: latest.manifestBytes,
    sha256: latest.manifestSha256
  });
  const collection = manifest?.collections?.airports;
  if (
    Number(manifest?.schemaVersion) !== 1
    || String(manifest?.datasetVersion || '') !== String(latest.datasetVersion || '')
    || manifest?.source?.name !== 'OpenAIP'
    || !Array.isArray(collection?.packs)
    || collection.packs.length !== Number(collection.packCount)
  ) throw new Error('Aviation-Manifest: ungültige Airport-Sammlung');

  const cycleBaseUrl = new URL('./', manifestUrl);
  const seenOpenAipIds = new Set();
  let processedPacks = 0;
  let sourceRecords = 0;
  let validRecords = 0;
  await mapWithConcurrency(collection.packs, FETCH_CONCURRENCY, async (entry) => {
    const packUrl = new URL(String(entry.url || ''), cycleBaseUrl);
    if (!packUrl.href.startsWith(cycleBaseUrl.href)) throw new Error(`Unsicherer Packpfad: ${entry.url}`);
    const pack = await fetchVerifiedJson(packUrl, {
      label: entry.url,
      bytes: entry.bytes,
      sha256: entry.sha256
    });
    if (
      Number(pack?.schemaVersion) !== 1
      || pack?.collection !== 'airports'
      || String(pack?.datasetVersion || '') !== String(manifest.datasetVersion)
      || !Array.isArray(pack?.items)
      || pack.items.length !== Number(entry.count)
    ) throw new Error(`${entry.url}: ungültiges Airport-Pack`);
    for (const item of pack.items) {
      sourceRecords += 1;
      const sourceId = String(item?.id || '').trim();
      if (!sourceId || seenOpenAipIds.has(sourceId)) continue;
      seenOpenAipIds.add(sourceId);
      if (mergeOpenAipAirport(database, item)) validRecords += 1;
    }
    processedPacks += 1;
    if (processedPacks % 100 === 0 || processedPacks === collection.packs.length) {
      console.log(`Airport-Packs ${processedPacks}/${collection.packs.length}`);
    }
  });

  if (sourceRecords !== Number(collection.count) || validRecords < 40_000) {
    throw new Error(`OpenAIP-Bilanz stimmt nicht (${validRecords}/${sourceRecords}/${collection.count})`);
  }
  const sorted = Object.fromEntries(Object.entries(database).sort(([a], [b]) => a.localeCompare(b)));
  const totalCount = Object.keys(sorted).length;
  if (totalCount < 50_000 || !sorted.EDDF || !sorted.EDDM) {
    throw new Error(`Zusammengeführte airports.json ist unplausibel (${totalCount})`);
  }
  const content = `${JSON.stringify(sorted)}\n`;
  const databaseSha256 = sha256(content);
  const temporaryPath = `${targetPath}.tmp-${process.pid}`;
  await fs.writeFile(temporaryPath, content, 'utf8');
  await fs.rename(temporaryPath, targetPath);
  const resolvedMetadataPath = path.resolve(
    metadataPath || path.join(path.dirname(resolvedBackupPath), 'airports-database-meta.json')
  );
  if (path.basename(resolvedMetadataPath) !== 'airports-database-meta.json') {
    throw new Error(`Unsicherer Metadatenpfad: ${resolvedMetadataPath}`);
  }
  await fs.writeFile(resolvedMetadataPath, `${JSON.stringify({
    schemaVersion: 1,
    datasetVersion: manifest.datasetVersion,
    sourceGeneratedAt: manifest.generatedAt,
    source: manifest.source,
    legacyBackup: path.relative(process.cwd(), resolvedBackupPath),
    legacyCount,
    legacySha256: sha256(backupRaw),
    openAipCount: validRecords,
    totalCount,
    databaseBytes: Buffer.byteLength(content),
    databaseSha256
  }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    datasetVersion: manifest.datasetVersion,
    legacyCount,
    openAipCount: validRecords,
    totalCount,
    bytes: Buffer.byteLength(content),
    sha256: databaseSha256,
    output: targetPath,
    backup: resolvedBackupPath,
    metadata: resolvedMetadataPath
  }, null, 2));
}

const args = parseArgs(process.argv.slice(2));
buildDatabase({
  sourceBase: args['source-base'] || DEFAULT_SOURCE_BASE,
  databasePath: args.output || DEFAULT_DATABASE,
  backupPath: args.backup || DEFAULT_BACKUP,
  metadataPath: args.metadata
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
