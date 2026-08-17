#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolDir, '..');
const searchRoot = path.join(rootDir, 'data', 'airport-search');
const manifest = JSON.parse(await fs.readFile(path.join(searchRoot, 'manifest.json'), 'utf8'));
const packDir = path.join(searchRoot, manifest.packVersion);

assert.equal(manifest.schemaVersion, 2);
assert.equal(manifest.packVersion, 'snapshot-2026-07-28-v3');
assert.ok(manifest.recordCount >= 65_000, 'FAA-Ergänzungen fehlen in den Suchpaketen');
assert.equal(manifest.bundleCount, 192);
assert.equal(manifest.bundleFileCount, manifest.bundleCount);
assert.equal(manifest.fileCount, manifest.bundleCount + 1);
assert.ok(manifest.trigramCount >= 25_000, 'Trigramm-Index ist unvollständig');
assert.ok(Object.keys(manifest.prefixes).length >= 1_200, 'Präfixabdeckung ist unvollständig');
assert.deepEqual(manifest.tupleFields, [
  'code', 'name', 'city', 'state', 'country', 'type', 'lat', 'lon', 'elevation',
  'iata', 'altIdentifier', 'sourceId', 'icaoCode', 'aliasOf', 'flags', 'codes'
]);

const databaseRaw = await fs.readFile(path.join(rootDir, 'airports.json'), 'utf8');
const supplementRaw = await fs.readFile(path.join(rootDir, 'data', 'faa-local-airports.json'), 'utf8');
assert.equal(manifest.databaseSha256, crypto.createHash('sha256').update(databaseRaw).digest('hex'));
assert.equal(manifest.supplementSha256, crypto.createHash('sha256').update(supplementRaw).digest('hex'));

const fileNames = (await fs.readdir(packDir)).filter(name => name.endsWith('.json')).sort();
assert.equal(fileNames.length, manifest.fileCount);
assert.deepEqual(fileNames, [...Object.keys(manifest.files).map(prefix => `${prefix}.json`), 'lookup.json'].sort());
let measuredTotalBytes = 0;
for (const fileName of fileNames.filter(name => name !== 'lookup.json')) {
  const prefix = path.basename(fileName, '.json');
  const stat = await fs.stat(path.join(packDir, fileName));
  assert.equal(stat.size, manifest.files[prefix].bytes, `${prefix}: Dateigröße stimmt nicht`);
  measuredTotalBytes += stat.size;
}
const lookupRaw = await fs.readFile(path.join(packDir, 'lookup.json'), 'utf8');
assert.equal(Buffer.byteLength(lookupRaw), manifest.lookup.bytes);
assert.equal(crypto.createHash('sha256').update(lookupRaw).digest('hex'), manifest.lookup.sha256);
const lookup = JSON.parse(lookupRaw);
assert.equal(lookup.length, manifest.lookup.count);
measuredTotalBytes += Buffer.byteLength(lookupRaw);
assert.equal(measuredTotalBytes, manifest.totalBytes, 'Gesamtgröße der Suchpakete stimmt nicht');

async function readPack(prefix) {
  const prefixInfo = manifest.prefixes[prefix];
  assert.ok(prefixInfo, `${prefix}: Präfix fehlt im Manifest`);
  const fileId = String(prefixInfo.bundle).padStart(3, '0');
  const raw = await fs.readFile(path.join(packDir, `${fileId}.json`), 'utf8');
  const expected = manifest.files[fileId];
  assert.equal(Buffer.byteLength(raw), expected.bytes, `${fileId}: Bytezahl stimmt nicht`);
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), expected.sha256, `${fileId}: SHA-256 stimmt nicht`);
  const bundle = JSON.parse(raw);
  const tuples = bundle.p?.[prefix];
  assert.ok(Array.isArray(tuples), `${prefix}: Präfix fehlt im Bundle ${fileId}`);
  assert.equal(tuples.length, prefixInfo.count, `${prefix}: Datensatzzahl stimmt nicht`);
  return tuples;
}

const kirchzartenPack = await readPack('ki');
const kirchzartenBundleId = String(manifest.prefixes.ki.bundle).padStart(3, '0');
assert.ok(manifest.files[kirchzartenBundleId].bytes < 250_000, 'Kirchzarten-Suchpaket ist unerwartet groß');
const kirchzarten = kirchzartenPack.find(tuple => tuple[0] === 'OA-09445F82');
assert.ok(kirchzarten, 'Kirchzarten fehlt im KI-Suchpaket');
assert.equal(kirchzarten[1], 'KIRCHZARTEN');
assert.equal(kirchzarten[4], 'DE');
assert.equal(kirchzarten[5], 1);
assert.equal(kirchzarten[6], 47.951389);
assert.equal(kirchzarten[7], 7.956111);

const euskirchenPack = await readPack('eu');
assert.ok(euskirchenPack.some(tuple => tuple[0] === 'OA-094453D2' && tuple[5] === 7), 'Euskirchen-Heliport fehlt');

const faaPack = await readPack('00');
const faaLocal = faaPack.find(tuple => tuple[0] === '00C');
assert.ok(faaLocal, 'FAA-Lokalplatz 00C fehlt');
assert.equal(faaLocal[12], 'K00C');

function bundleIndex(value) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % manifest.bundleCount;
}

const zarBundleId = String(bundleIndex('zar')).padStart(3, '0');
const zarBundle = JSON.parse(await fs.readFile(path.join(packDir, `${zarBundleId}.json`), 'utf8'));
const kirchzartenRecordId = lookup.findIndex(entry => entry?.[1] === 'OA-09445F82');
assert.ok(kirchzartenRecordId >= 0, 'Kirchzarten fehlt im Detail-Lookup');
assert.equal(lookup[kirchzartenRecordId][0], 'ki');
assert.ok(zarBundle.t?.zar?.includes(kirchzartenRecordId), 'Teilwort ZAR verweist nicht auf Kirchzarten');

const appSource = await fs.readFile(path.join(rootDir, 'app.js'), 'utf8');
assert.match(appSource, /async function loadAirportSearchPack\(/);
assert.match(appSource, /async function searchAirportExpandedCandidates\(/);
assert.match(appSource, /function searchAirportFuzzyRecords\(/);
assert.match(appSource, /fetchWithTimeout\(url, 8000\)/);
assert.doesNotMatch(appSource, /function preloadGlobalAirportsOnIntent\(/);
assert.doesNotMatch(appSource, /await loadFaaLocalAirportsSupplement\(\);/);

console.log(
  `Airport search packs ok: ${manifest.recordCount} records in ${manifest.bundleFileCount} bundles; `
  + `KI bundle ${manifest.files[kirchzartenBundleId].bytes} bytes`
);
