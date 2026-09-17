'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRotatingDebugLog } = require('./tracker-debug-log.js');

test('blocked async log I/O does not block enqueueing; bounded queue and flush preserve order', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-async-log-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const block = new Promise(resolve => { release = resolve; });
  const logger = createRotatingDebugLog({ async: true, filename: path.join(dir, 'debug.txt'), maxPendingBytes: 160,
    io: { ...fs.promises, async appendFile(...args) { entered(); await block; return fs.promises.appendFile(...args); } } });
  logger('first');
  const flush = logger.flush();
  await started;
  assert.equal(logger('second'), true);
  assert.equal(logger('x'.repeat(200)), false);
  release(); await flush;
  assert.match(fs.readFileSync(path.join(dir, 'debug.txt'), 'utf8'), /first\n.*second\n/);
  assert.equal(logger.metrics().dropped, 1);
  assert.equal(logger.metrics().pendingBytes, 0);
});

test('async logging batches writes and rotates oversized files using retained tails', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-async-log-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filename = path.join(dir, 'debug.txt');
  fs.writeFileSync(filename, 'old\n'.repeat(2000) + 'LAST\n');
  const logger = createRotatingDebugLog({ async: true, filename, maxBytes: 1024, retainedTailBytes: 128 });
  for (let n = 0; n < 10; n++) logger(`line-${n}`);
  await logger.flush();
  assert.equal(logger.metrics().batches, 1);
  assert.ok(fs.statSync(filename).size <= 1024);
  assert.ok(fs.statSync(filename + '.1').size <= 128);
  assert.match(fs.readFileSync(filename + '.1', 'utf8'), /LAST/);
});


test('failed async writes are counted and subsequent log writes can recover', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-async-log-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const filename = path.join(dir, 'debug.txt');
  let fail = true;
  const logger = createRotatingDebugLog({ async: true, filename,
    io: { ...fs.promises, async appendFile(...args) { if (fail) throw new Error('disk unavailable'); return fs.promises.appendFile(...args); } } });
  logger('lost-one'); logger('lost-two');
  await logger.flush();
  assert.equal(logger.metrics().errors, 1);
  assert.equal(logger.metrics().dropped, 2);
  assert.equal(logger.metrics().pendingBytes, 0);
  fail = false;
  logger('recovered');
  await logger.flush();
  assert.match(fs.readFileSync(filename, 'utf8'), /recovered/);
});
