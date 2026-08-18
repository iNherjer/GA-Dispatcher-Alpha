const assert = require('node:assert/strict');
const test = require('node:test');
const protocol = require('./tracker-efb-protocol-core');

test('versioned Tracker/EFB messages round-trip without transport assumptions', () => {
  const message = protocol.createMessage('mission.snapshot', { missionId: 'test-1' }, {
    id: 'message-1',
    timestamp: 123456
  });
  assert.deepEqual(protocol.decodeMessage(JSON.stringify(message)), message);
  assert.equal(message.schema, 'ga.tracker-efb');
  assert.equal(message.protocolVersion, 1);
});

test('capabilities are normalized and negotiated explicitly', () => {
  const hello = protocol.createHello({
    role: 'efb',
    clientId: 'efb-test',
    appVersion: '0.1.0',
    capabilities: [
      protocol.CAPABILITIES.EFB_INTERACTION,
      protocol.CAPABILITIES.MISSION_SNAPSHOT,
      protocol.CAPABILITIES.MISSION_SNAPSHOT,
      'invalid capability'
    ],
    id: 'hello-1',
    timestamp: 123456
  });
  const negotiated = protocol.negotiateCapabilities([
    protocol.CAPABILITIES.LEGACY_COMMANDS,
    protocol.CAPABILITIES.MISSION_SNAPSHOT
  ], hello);
  assert.deepEqual(negotiated.capabilities, [protocol.CAPABILITIES.MISSION_SNAPSHOT]);
  assert.equal(negotiated.legacy, false);
  assert.equal(protocol.supportsCapability(negotiated, protocol.CAPABILITIES.MISSION_SNAPSHOT), true);
});

test('toolbar is an explicit cockpit peer without receiving write capabilities implicitly', () => {
  const hello = protocol.createHello({
    role: 'toolbar',
    clientId: 'toolbar-window-1',
    appVersion: '0.0.1',
    capabilities: [
      protocol.CAPABILITIES.COCKPIT_SESSION,
      protocol.CAPABILITIES.MISSION_SNAPSHOT_V2,
      protocol.CAPABILITIES.MISSION_INTENT,
      protocol.CAPABILITIES.VOICE_PLAYBACK
    ],
    id: 'toolbar-hello-1',
    timestamp: 123456
  });

  const peer = protocol.describePeer(hello);
  assert.equal(peer.role, 'toolbar');
  assert.deepEqual(peer.capabilities, [
    protocol.CAPABILITIES.COCKPIT_SESSION,
    protocol.CAPABILITIES.MISSION_INTENT,
    protocol.CAPABILITIES.MISSION_SNAPSHOT_V2,
    protocol.CAPABILITIES.VOICE_PLAYBACK
  ].sort());

  const readOnlyTrackerCapabilities = [protocol.CAPABILITIES.MISSION_SNAPSHOT_V2];
  const negotiated = protocol.negotiateCapabilities(readOnlyTrackerCapabilities, hello);
  assert.deepEqual(negotiated.capabilities, [protocol.CAPABILITIES.MISSION_SNAPSHOT_V2]);
  assert.equal(protocol.supportsCapability(negotiated, protocol.CAPABILITIES.MISSION_INTENT), false);
  assert.equal(protocol.supportsCapability(negotiated, protocol.CAPABILITIES.VOICE_PLAYBACK), false);
});

test('peers without a valid hello remain on the existing legacy contract', () => {
  const peer = protocol.describePeer({ type: 'position', payload: {} });
  assert.equal(peer.legacy, true);
  assert.deepEqual(peer.capabilities, protocol.LEGACY_CAPABILITIES);
  const negotiated = protocol.negotiateCapabilities(protocol.LEGACY_CAPABILITIES, null);
  assert.deepEqual(negotiated.capabilities, protocol.LEGACY_CAPABILITIES);
});

test('malformed or future protocol envelopes are rejected safely', () => {
  assert.equal(protocol.tryDecodeMessage('{bad json').ok, false);
  assert.throws(() => protocol.decodeMessage({
    schema: protocol.SCHEMA,
    schemaVersion: 1,
    protocolVersion: 2,
    id: 'future',
    type: 'protocol.hello',
    timestamp: 1,
    payload: {}
  }), /Protokollversion/);
});
