#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(toolDir, '..');
const outputPath = path.resolve(
    process.env.OPENAIP_NAVAIDS_OUTPUT || path.join(rootDir, 'data', 'openaip-navaids.json')
);
const sourceBase = String(
    process.env.OPENAIP_NAVAIDS_SOURCE
    || 'https://ga-proxy.einherjer.workers.dev/api/navaids'
).trim();
const pageSize = 250;
const fields = [
    '_id',
    'name',
    'identifier',
    'designator',
    'type',
    'country',
    'frequency',
    'channel',
    'range',
    'geometry',
    'updatedAt'
].join(',');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function buildPageUrl(page) {
    const url = new URL(sourceBase);
    url.searchParams.set('limit', String(pageSize));
    url.searchParams.set('page', String(page));
    url.searchParams.set('fields', fields);
    return url;
}

async function fetchPage(page) {
    const url = buildPageUrl(page);
    let lastError = null;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
        try {
            const response = await fetch(url, {
                headers: {
                    Accept: 'application/json',
                    'User-Agent': 'GA-Dispatcher-OpenAIP-Navaid-Builder/1.0'
                }
            });
            if (response.ok) {
                const payload = await response.json();
                if (!payload || !Array.isArray(payload.items)) {
                    throw new Error(`Seite ${page}: ungültige OpenAIP-Antwort`);
                }
                return payload;
            }
            const retryable = response.status === 429 || response.status >= 500;
            const retryAfterSeconds = Number(response.headers.get('retry-after'));
            lastError = new Error(`Seite ${page}: HTTP ${response.status}`);
            if (!retryable || attempt === 5) break;
            const retryMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
                ? Math.min(30_000, retryAfterSeconds * 1000)
                : Math.min(15_000, 1000 * (2 ** (attempt - 1)));
            console.warn(`${lastError.message}; neuer Versuch in ${retryMs} ms`);
            await sleep(retryMs);
        } catch (error) {
            lastError = error;
            if (attempt === 5) break;
            const retryMs = Math.min(15_000, 1000 * (2 ** (attempt - 1)));
            console.warn(`Seite ${page}: ${error.message}; neuer Versuch in ${retryMs} ms`);
            await sleep(retryMs);
        }
    }
    throw lastError || new Error(`Seite ${page}: Abruf fehlgeschlagen`);
}

function normalizeScalar(value) {
    if (value === undefined || value === null || value === '') return null;
    return value;
}

function normalizeValueWithUnit(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'object') return { value: String(value) };
    const normalizedValue = normalizeScalar(value.value);
    if (normalizedValue === null) return null;
    const result = { value: String(normalizedValue) };
    const unit = normalizeScalar(value.unit);
    if (unit !== null) result.unit = unit;
    return result;
}

function roundCoordinate(value) {
    return Number(Number(value).toFixed(7));
}

function normalizeNavaid(raw) {
    const coordinates = raw?.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
    const lon = Number(coordinates[0]);
    const lat = Number(coordinates[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

    const id = String(raw?._id || raw?.id || '').trim();
    const identifier = String(raw?.identifier || raw?.designator || '').trim().toUpperCase();
    const name = String(raw?.name || identifier || 'Navaid').trim();
    if (!id && !identifier && !name) return null;

    const result = {
        id,
        identifier,
        name,
        lat: roundCoordinate(lat),
        lon: roundCoordinate(lon)
    };
    const type = normalizeScalar(raw?.type);
    const country = String(raw?.country || '').trim().toUpperCase();
    const frequency = normalizeValueWithUnit(raw?.frequency);
    const channel = normalizeScalar(raw?.channel);
    const range = normalizeValueWithUnit(raw?.range);
    const updatedAt = String(raw?.updatedAt || '').trim();

    if (type !== null) result.type = type;
    if (country) result.country = country;
    if (frequency) result.frequency = frequency;
    if (channel !== null) result.channel = channel;
    if (range) result.range = range;
    if (updatedAt) result.updatedAt = updatedAt;
    return result;
}

function stableNavaidKey(item) {
    if (item.id) return `id:${item.id}`;
    return [
        'fallback',
        item.country || '',
        item.identifier || '',
        item.type ?? '',
        item.lat.toFixed(5),
        item.lon.toFixed(5)
    ].join(':');
}

const firstPage = await fetchPage(1);
const totalPages = Math.max(1, Number(firstPage.totalPages) || 1);
const sourceCount = Math.max(0, Number(firstPage.totalCount) || 0);
if (totalPages > 100) {
    throw new Error(`Abbruch: unerwartet viele Seiten (${totalPages})`);
}

const rawItems = [...firstPage.items];
console.log(`OpenAIP Navaids: Seite 1/${totalPages}, ${rawItems.length}/${sourceCount || '?'} Einträge`);
for (let page = 2; page <= totalPages; page += 1) {
    await sleep(400);
    const payload = await fetchPage(page);
    rawItems.push(...payload.items);
    console.log(`OpenAIP Navaids: Seite ${page}/${totalPages}, gesamt ${rawItems.length}/${sourceCount || '?'}`);
}

const byKey = new Map();
let invalidCount = 0;
for (const raw of rawItems) {
    const normalized = normalizeNavaid(raw);
    if (!normalized) {
        invalidCount += 1;
        continue;
    }
    byKey.set(stableNavaidKey(normalized), normalized);
}

const navaids = [...byKey.values()].sort((a, b) => (
    String(a.country || '').localeCompare(String(b.country || ''))
    || String(a.identifier || '').localeCompare(String(b.identifier || ''))
    || String(a.name || '').localeCompare(String(b.name || ''))
    || a.lat - b.lat
    || a.lon - b.lon
));

if (navaids.length < 1000) {
    throw new Error(`Abbruch: nur ${navaids.length} gültige Navaids erzeugt`);
}
if (sourceCount && rawItems.length !== sourceCount) {
    throw new Error(`Abbruch: ${rawItems.length} von ${sourceCount} Quelldatensätzen geladen`);
}

const generatedAt = new Date().toISOString();
const output = {
    schemaVersion: 1,
    generatedAt,
    source: {
        name: 'OpenAIP',
        url: 'https://www.openaip.net/',
        license: 'CC BY-NC 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/'
    },
    sourceCount: sourceCount || rawItems.length,
    count: navaids.length,
    invalidCount,
    navaids
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(output)}\n`, 'utf8');
const stat = await fs.stat(outputPath);
console.log(`Geschrieben: ${path.relative(rootDir, outputPath)} (${navaids.length} Navaids, ${stat.size} Bytes)`);
