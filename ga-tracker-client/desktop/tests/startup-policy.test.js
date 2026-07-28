const assert = require('node:assert/strict');
const test = require('node:test');
const { startupDecision } = require('../lib/startup-policy');

test('tracker auto-start is enabled by default when credentials exist', () => {
  assert.deepEqual(startupDecision({}, true), {
    showWindow: true,
    startTracker: true
  });
});

test('minimized launch hides the window but still starts the tracker', () => {
  assert.deepEqual(startupDecision({
    autoStartTracker: true,
    startMinimized: true
  }, true), {
    showWindow: false,
    startTracker: true
  });
});

test('missing credentials always opens the window and prevents engine start', () => {
  assert.deepEqual(startupDecision({
    autoStartTracker: true,
    startMinimized: true
  }, false), {
    showWindow: true,
    startTracker: false
  });
});
