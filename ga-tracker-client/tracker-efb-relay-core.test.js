const assert = require('node:assert/strict');
const test = require('node:test');
const protocol = require('./tracker-efb-protocol-core');
const {
  TRACKER_RELAY_CAPABILITIES,
  createTrackerRelayHello,
  normalizeRuntimeChannel,
  readTrackerRelayHello
} = require('./tracker-efb-relay-core');

test('tracker relay hello advertises the implemented legacy and mission-authority capabilities', () => {
  const hello = createTrackerRelayHello({
    trackerVersion: 'v321',
    trackerVersionCode: 321,
    runtimeChannel: 'alpha',
    clientId: 'tracker-test',
    id: 'tracker-hello-test',
    timestamp: 123456
  });
  assert.equal(hello.type, 'protocol.hello');
  assert.equal(hello.payload.runtimeChannel, 'alpha');
  assert.equal(hello.payload.trackerVersionCode, 321);
  assert.equal(hello.payload.transport, 'relay-embedded');
  assert.deepEqual(hello.payload.capabilities, TRACKER_RELAY_CAPABILITIES);
  assert.equal(hello.payload.capabilities.includes(protocol.CAPABILITIES.EFB_INTERACTION), false);
  assert.equal(hello.payload.capabilities.includes(protocol.CAPABILITIES.CHECKLIST_LIBRARY), true);
  assert.equal(hello.payload.capabilities.includes(protocol.CAPABILITIES.MISSION_VIEW), true);
  assert.equal(hello.payload.capabilities.includes(protocol.CAPABILITIES.MISSION_SCENE_GROUP), true);
  assert.equal(hello.payload.capabilities.includes(protocol.CAPABILITIES.TELEMETRY_HIBERNATE), true);
  assert.equal(hello.payload.capabilities.includes(protocol.CAPABILITIES.TELEMETRY_WAKE), true);
  assert.equal(readTrackerRelayHello({ trackerProtocolHello: hello })?.id, 'tracker-hello-test');
});

test('invalid channels fall back to Stable and invalid envelopes stay legacy-safe', () => {
  assert.equal(normalizeRuntimeChannel('preview'), 'stable');
  assert.equal(readTrackerRelayHello({ trackerProtocolHello: { type: 'protocol.hello' } }), null);
  assert.throws(() => createTrackerRelayHello({
    trackerVersion: 'v321',
    trackerVersionCode: 320
  }), /passen/);
});
