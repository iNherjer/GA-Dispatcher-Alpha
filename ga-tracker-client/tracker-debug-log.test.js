'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createRotatingDebugLog } = require('./tracker-debug-log');

function temporaryLog() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-tracker-debug-'));
  return { directory, filename: path.join(directory, 'ga-tracker-debug.txt') };
}

test('rotating debug log caps an already oversized file and retains only its tail', (t) => {
  const target = temporaryLog();
  t.after(() => fs.rmSync(target.directory, { recursive: true, force: true }));
  fs.writeFileSync(target.filename, `${'old-line\n'.repeat(600)}LAST_OLD_LINE\n`, 'utf8');
  fs.writeFileSync(`${target.filename}.1`, `${'older-line\n'.repeat(300)}LAST_ARCHIVE_LINE\n`, 'utf8');
  const logger = createRotatingDebugLog({
    filename: target.filename,
    maxBytes: 1024,
    retainedTailBytes: 220,
    now: () => Date.parse('2026-08-11T15:00:00.000Z')
  });

  assert.equal(logger('NEW_LINE'), true);
  assert.ok(fs.statSync(target.filename).size < 1024);
  assert.ok(fs.statSync(`${target.filename}.1`).size <= 220);
  assert.ok(fs.statSync(`${target.filename}.2`).size <= 220);
  assert.match(fs.readFileSync(`${target.filename}.1`, 'utf8'), /LAST_OLD_LINE/);
  assert.match(fs.readFileSync(`${target.filename}.2`, 'utf8'), /LAST_ARCHIVE_LINE/);
  assert.match(fs.readFileSync(target.filename, 'utf8'), /LOG_ROTATED previousBytes=/);
  assert.match(fs.readFileSync(target.filename, 'utf8'), /NEW_LINE/);
});

test('rotating debug log suppresses immediate identical entries', (t) => {
  const target = temporaryLog();
  t.after(() => fs.rmSync(target.directory, { recursive: true, force: true }));
  let currentAt = Date.parse('2026-08-11T15:00:00.000Z');
  const logger = createRotatingDebugLog({
    filename: target.filename,
    maxBytes: 4096,
    retainedTailBytes: 512,
    dedupeWindowMs: 1500,
    now: () => currentAt
  });

  assert.equal(logger('HOMEBASE_DOOR_SCAN count=0 reason=heartbeat'), true);
  assert.equal(logger('HOMEBASE_DOOR_SCAN count=0 reason=heartbeat'), false);
  currentAt += 1600;
  assert.equal(logger('HOMEBASE_DOOR_SCAN count=0 reason=heartbeat'), true);
  const entries = fs.readFileSync(target.filename, 'utf8').trim().split('\n');
  assert.equal(entries.length, 2);
});

test('rotating debug log truncates individual pathological lines', (t) => {
  const target = temporaryLog();
  t.after(() => fs.rmSync(target.directory, { recursive: true, force: true }));
  const logger = createRotatingDebugLog({
    filename: target.filename,
    maxBytes: 2048,
    retainedTailBytes: 256,
    maxLineBytes: 128,
    now: () => Date.parse('2026-08-11T15:00:00.000Z')
  });

  assert.equal(logger(`PAYLOAD ${'x'.repeat(2000)}`), true);
  const output = fs.readFileSync(target.filename, 'utf8');
  assert.ok(Buffer.byteLength(output) < 256);
  assert.match(output, /\[truncated\]/);
});
