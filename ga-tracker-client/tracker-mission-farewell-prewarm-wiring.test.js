'use strict';
// Regression (17.09.2026 – v645): the separate mission process dropped the touchdown farewell prewarm,
// because neither the worker nor the parent forwarded prepareFarewellVoice.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

test('mission worker forwards the touchdown farewell prewarm to the tracker process', () => {
  assert.match(read('tracker-mission-worker.js'), /prepareFarewellVoice: request => invokeParent\('prepareFarewellVoice', request\)/);
  assert.match(read('tracker-mission-process.js'), /'prepareFarewellVoice'/);
  const tracker = read('tracker.js');
  assert.equal(tracker.match(/prepareFarewellVoice: request => prepareFarewellAndRecap\(request\)/g)?.length, 2, 'process and in-process runtime');
});
