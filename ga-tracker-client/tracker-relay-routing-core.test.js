const assert = require('node:assert/strict');
const {
  TRACKER_RELAY_ENDPOINTS,
  buildTrackerRelayUrl,
  createRelayFanout,
  isTrustedMissionIntentEnvelope,
  trackerRoomKey
} = require('./tracker-relay-routing-core');

const cloudflare = TRACKER_RELAY_ENDPOINTS.find(endpoint => endpoint.key === 'cloudflare');
const render = TRACKER_RELAY_ENDPOINTS.find(endpoint => endpoint.key === 'render');
assert.ok(cloudflare);
assert.ok(render);
assert.equal(trackerRoomKey('pilot-42'), trackerRoomKey(' PILOT-42 '));
assert.match(trackerRoomKey('pilot-42'), /^[a-f0-9]{64}$/);
assert.equal(new URL(buildTrackerRelayUrl(cloudflare, 'pilot-42')).searchParams.get('room'), trackerRoomKey('pilot-42'));
assert.equal(buildTrackerRelayUrl(render, 'pilot-42'), render.url);
assert.equal(isTrustedMissionIntentEnvelope({}, { type: 'mission_execution_intent' }, '0815'), false);
assert.equal(isTrustedMissionIntentEnvelope({ pin: '0815' }, { type: 'mission_execution_intent' }, '0815'), true);
assert.equal(isTrustedMissionIntentEnvelope({}, { type: 'mission_execution_intent', pin: '0815' }, '0815'), true);
assert.equal(isTrustedMissionIntentEnvelope({}, { type: 'mission_scene_spawn' }, '0815'), true);

const sent = [];
const states = [
  { config: cloudflare, socket: { readyState: 1, send: payload => sent.push(['C', payload]) } },
  { config: render, socket: { readyState: 1, send: payload => sent.push(['R', payload]) } }
];
const FakeWebSocket = { OPEN: 1, CLOSED: 3 };
const fanout = createRelayFanout(() => states, FakeWebSocket);
assert.equal(fanout.readyState, 1);
assert.equal(fanout.send('telemetry'), 2);
assert.deepEqual(sent, [['C', 'telemetry'], ['R', 'telemetry']]);
states[0].socket.readyState = 3;
assert.equal(fanout.send('fallback'), 1);
assert.deepEqual(sent.at(-1), ['R', 'fallback']);
states[1].socket.readyState = 3;
assert.equal(fanout.readyState, 3);
assert.throws(() => fanout.send('offline'), /Kein Relay/);

console.log('tracker relay routing tests passed');
