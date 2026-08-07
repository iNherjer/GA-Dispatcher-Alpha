const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {
  normalizeRuntimeChannel,
  runtimeChannelDefinition,
  runtimeRootForChannel
} = require('../lib/runtime-channel');

test('unknown or missing runtime channels stay on Stable', () => {
  assert.equal(normalizeRuntimeChannel(''), 'stable');
  assert.equal(normalizeRuntimeChannel('preview'), 'stable');
  assert.equal(normalizeRuntimeChannel(' ALPHA '), 'alpha');
});

test('Stable preserves the legacy runtime path and Alpha remains isolated', () => {
  const applicationRoot = path.resolve('LocalAppData', 'VFR Multitool');
  assert.equal(runtimeRootForChannel(applicationRoot, 'stable'), path.join(applicationRoot, 'Tracker'));
  assert.equal(runtimeRootForChannel(applicationRoot, 'alpha'), path.join(applicationRoot, 'Tracker Alpha'));
  assert.notEqual(runtimeRootForChannel(applicationRoot, 'stable'), runtimeRootForChannel(applicationRoot, 'alpha'));
});

test('each runtime channel resolves its own immutable descriptor URL', () => {
  assert.match(runtimeChannelDefinition('stable').channelUrl, /\/stable\.json$/);
  assert.match(runtimeChannelDefinition('alpha').channelUrl, /\/alpha\.json$/);
});
