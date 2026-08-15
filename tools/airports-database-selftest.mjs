#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolDir, '..');
const databaseRaw = await fs.readFile(path.join(rootDir, 'airports.json'), 'utf8');
const backupRaw = await fs.readFile(
  path.join(rootDir, 'data/airports-backup-pre-openaip-20260815.json'),
  'utf8'
);
const metadata = JSON.parse(await fs.readFile(
  path.join(rootDir, 'data/airports-database-meta.json'),
  'utf8'
));
const database = JSON.parse(databaseRaw);
const backup = JSON.parse(backupRaw);
const records = Object.values(database);
await import(path.join(rootDir, 'airport-type-filter.js'));
const airportTypes = globalThis.gaAirportTypes;

assert.equal(
  crypto.createHash('sha256').update(backupRaw).digest('hex'),
  'b2657af3cbe3413e870fbe3da968144469b063b9f188218fc1d724de5de609a1',
  'das unveränderte Legacy-Backup wurde überschrieben'
);
assert.equal(Object.keys(backup).length, 29_303);
assert.ok(Object.keys(database).length >= 59_000, 'zusammengeführter Airport-Bestand ist zu klein');
assert.equal(metadata.totalCount, Object.keys(database).length);
assert.equal(metadata.databaseBytes, Buffer.byteLength(databaseRaw));
assert.equal(
  metadata.databaseSha256,
  crypto.createHash('sha256').update(databaseRaw).digest('hex'),
  'Prüfsumme der zusammengeführten airports.json stimmt nicht'
);
assert.ok(Object.keys(database).length > Object.keys(backup).length + 25_000);
assert.ok(Object.keys(database).filter(key => key.startsWith('OA-')).length >= 27_000);

for (const key of Object.keys(backup)) {
  assert.ok(database[key], `Legacy-Platz ${key} fehlt in der erweiterten Datenbank`);
}

const alsfeld = database['OA-09443DB0'];
assert.equal(alsfeld?.name, 'ALSFELD');
assert.equal(alsfeld?.type, 1);
assert.equal(alsfeld?.country, 'DE');
assert.equal(alsfeld?.elevation, 951);
assert.equal(alsfeld?.sourceId, '62614a37cb27f42509443db0');
assert.equal(airportTypes.matches(alsfeld, ['glider']), true);
assert.equal(airportTypes.matches(alsfeld, ['traffic', 'ga']), false);

assert.ok(records.filter(record => record.type === 1).length >= 400, 'Segelflugplätze fehlen');
assert.ok(records.filter(record => record.type === 6).length >= 1_400, 'UL-Plätze fehlen');
assert.ok(records.every(record => Number.isFinite(Number(record.lat)) && Number.isFinite(Number(record.lon))));

const appSource = await fs.readFile(path.join(rootDir, 'app.js'), 'utf8');
assert.doesNotMatch(appSource, /function fetchRemoteAirportSearchCandidates\(/);
assert.match(appSource, /async function searchAirportCatalogCandidates\(/);
assert.match(appSource, /return searchAirportCandidates\(query, limit, \{ \.\.\.options, classicId \}\);/);
assert.match(appSource, /const AIRPORT_DATABASE_MIN_RECORDS = 50_000;/);
assert.match(appSource, /\.\/airports\.json\?v=\$\{AIRPORT_DATABASE_VERSION\}/);
assert.match(appSource, /const gliderSample = parsed\['OA-09445F82'\];/);

function extractFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers.map(marker => appSource.indexOf(marker)).find(index => index >= 0);
  assert.ok(Number.isInteger(start) && start >= 0, `${name} fehlt in app.js`);
  const signatureEnd = appSource.indexOf(') {', start);
  const bodyStart = signatureEnd + 2;
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    const char = appSource[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return appSource.slice(start, index + 1);
    }
  }
  throw new Error(`${name}: Funktionskörper nicht abgeschlossen`);
}

const searchFunctions = [
  'normalizeAirportIdent',
  'airportRealIcao',
  'airportDisplayIdent',
  'openAipAirportStableIdent',
  'normalizeAirportSearchText',
  'getAirportSearchCodes',
  'buildAirportSearchRecord',
  'buildAirportSearchIndex',
  'scoreAirportSearchRecord',
  'airportSearchFieldAllowsRecord',
  'searchAirportCandidates'
];
const searchFactory = new Function('window', 'database', `
  let globalAirports = database;
  let airportSearchIndex = null;
  let airportSearchIndexSourceSize = 0;
  function getSelectedMissionAirportTypeIds() { return window.gaAirportTypes.getSelected(); }
  function missionAirportMatchesTypeFilter(apt, selectedIds = getSelectedMissionAirportTypeIds()) {
    return window.gaAirportTypes.matches(apt, selectedIds) !== false;
  }
  ${searchFunctions.map(extractFunction).join('\n')}
  return { searchAirportCandidates };
`);
const searchApi = searchFactory({ gaAirportTypes: airportTypes }, database);
airportTypes.setSelected(['glider'], { persist: false, emit: false });
assert.equal(searchApi.searchAirportCandidates('Alsfeld', 5, { classicId: 'startLoc' })[0]?.code, 'OA-09443DB0');
assert.equal(searchApi.searchAirportCandidates('Alsfeld', 5, { classicId: 'destLoc' })[0]?.code, 'OA-09443DB0');
airportTypes.setSelected(['traffic', 'ga'], { persist: false, emit: false });
assert.equal(searchApi.searchAirportCandidates('Alsfeld', 5, { classicId: 'destLoc' }).length, 0);
assert.equal(searchApi.searchAirportCandidates('Alsfeld', 5, { classicId: 'startLoc' }).length, 0);
airportTypes.setSelected(['glider'], { persist: false, emit: false });
assert.equal(searchApi.searchAirportCandidates('Euskirchen', 5, { classicId: 'startLoc' }).length, 0);
assert.equal(searchApi.searchAirportCandidates('Euskirchen', 5, { classicId: 'destLoc' }).length, 0);
airportTypes.setSelected(['heli'], { persist: false, emit: false });
assert.equal(searchApi.searchAirportCandidates('Euskirchen', 5, { classicId: 'startLoc' })[0]?.code, 'OA-094453D2');
assert.equal(searchApi.searchAirportCandidates('Euskirchen', 5, { classicId: 'destLoc' })[0]?.code, 'OA-094453D2');

console.log(
  `Airports database ok: ${Object.keys(backup).length} legacy + OpenAIP = `
  + `${Object.keys(database).length} self-hosted records`
);
