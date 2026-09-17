'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createMissionCheckpoint } = require('./tracker-mission-checkpoint.js');
function setup(t, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-checkpoint-'));
  const filename = path.join(dir, 'authority.json');
  const state = { manifest: { loaded: false }, effects: [] };
  let captures = 0;
  const writer = createMissionCheckpoint({ filename, getState: () => { captures++; return state; }, ...options });
  t.after(() => { writer.stop(); fs.rmSync(dir, { recursive: true, force: true }); });
  return { writer, filename, state, captures: () => captures };
}
test('100 state changes produce no per-click serialization or disk writes; checkpoint saves only latest state', async t => {
  const x = setup(t);
  for (let n = 0; n < 100; n++) { x.state.manifest.loaded = n % 2 === 1; x.writer.markDirty(); }
  assert.equal(x.captures(), 0);
  assert.equal(fs.existsSync(x.filename), false);
  assert.equal(await x.writer.flush(), true);
  assert.equal(x.captures(), 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(x.filename)), x.state);
  await x.writer.flush();
  assert.equal(x.captures(), 1);
});
test('continuous changes do not postpone the fixed five-second checkpoint', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const x = setup(t);
  for (let n = 0; n < 5; n++) { x.writer.markDirty(); t.mock.timers.tick(1000); }
  assert.equal(x.captures(), 1);
  await x.writer.flush();
  assert.equal(x.writer.metrics().dirty, false);
});
test('slow write captures consistent manifest and effects, permits new mutations, and retains dirty latest state', async t => {
  let release, entered;
  const blocked = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  const x = setup(t, { io: { ...fs.promises, async writeFile(...args) { entered(); await blocked; return fs.promises.writeFile(...args); } } });
  x.state.effects = ['old']; x.writer.markDirty();
  const first = x.writer.flush(); await started;
  x.state.manifest.loaded = true; x.state.effects = ['new']; x.writer.markDirty();
  release(); await first;
  assert.deepEqual(JSON.parse(fs.readFileSync(x.filename)), { manifest: { loaded: false }, effects: ['old'] });
  assert.equal(x.writer.metrics().dirty, true);
  await x.writer.flush();
  assert.deepEqual(JSON.parse(fs.readFileSync(x.filename)), x.state);
});
test('failed replacement preserves previous checkpoint and retries latest state', async t => {
  let fail = false;
  const x = setup(t, { io: { ...fs.promises, async rename(...args) { if (fail) throw Error('disk busy'); return fs.promises.rename(...args); } } });
  x.writer.markDirty(); await x.writer.flush();
  fail = true; x.state.manifest.loaded = true; x.writer.markDirty();
  assert.equal(await x.writer.flush(), false);
  assert.equal(JSON.parse(fs.readFileSync(x.filename)).manifest.loaded, false);
  assert.equal(x.writer.metrics().dirty, true);
  fail = false; await x.writer.flush();
  assert.equal(JSON.parse(fs.readFileSync(x.filename)).manifest.loaded, true);
});
