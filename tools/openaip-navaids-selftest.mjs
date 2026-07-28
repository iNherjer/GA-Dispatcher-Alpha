#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const datasetPath = path.resolve(toolDir, '..', 'data', 'openaip-navaids.json');
const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

assert.equal(dataset.schemaVersion, 1);
assert.equal(dataset.source?.name, 'OpenAIP');
assert.equal(dataset.source?.license, 'CC BY-NC 4.0');
assert.ok(Date.parse(dataset.generatedAt) > 0);
assert.ok(Array.isArray(dataset.navaids));
assert.equal(dataset.count, dataset.navaids.length);
assert.ok(dataset.navaids.length >= 1000);

const ids = new Set();
for (const navaid of dataset.navaids) {
    assert.ok(typeof navaid.name === 'string' && navaid.name.length > 0);
    assert.ok(Number.isFinite(navaid.lat) && navaid.lat >= -90 && navaid.lat <= 90);
    assert.ok(Number.isFinite(navaid.lon) && navaid.lon >= -180 && navaid.lon <= 180);
    if (navaid.id) {
        assert.ok(!ids.has(navaid.id), `doppelte OpenAIP-ID: ${navaid.id}`);
        ids.add(navaid.id);
    }
    if (navaid.frequency) {
        assert.ok(typeof navaid.frequency.value === 'string' && navaid.frequency.value.length > 0);
    }
}

const sul = dataset.navaids.find(item => item.identifier === 'SUL');
assert.ok(sul, 'SUL fehlt im statischen Navaid-Datensatz');
assert.equal(sul.name, 'SULZ');
assert.equal(sul.frequency?.value, '116.100');

console.log(`OpenAIP Navaid dataset ok: ${dataset.navaids.length} records, SUL ${sul.frequency.value}`);
