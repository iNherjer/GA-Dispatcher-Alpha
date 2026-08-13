import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import WebSocket from '../../ga-tracker-client/node_modules/ws/wrapper.mjs';

const baseUrl = process.argv[2] || 'wss://ga-relay.einherjer.workers.dev/';
const syncId = `SMOKE-${crypto.randomUUID()}`.toUpperCase();
const pin = 'relay-smoke-pin';
const room = crypto.createHash('sha256').update(syncId, 'utf8').digest('hex');
const url = new URL(baseUrl);
if (url.hostname.endsWith('.workers.dev')) url.searchParams.set('room', room);

function connect() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

function send(socket, payload) {
  socket.send(JSON.stringify(payload));
}

function waitFor(messages, predicate, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const found = messages.find(predicate);
      if (found) {
        clearInterval(timer);
        resolve(found);
      } else if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        reject(new Error('Live-Relay-Test: erwartete Nachricht blieb aus.'));
      }
    }, 25);
  });
}

const tracker = await connect();
const viewer = await connect();
const trackerMessages = [];
const viewerMessages = [];
tracker.on('message', raw => trackerMessages.push(JSON.parse(String(raw))));
viewer.on('message', raw => viewerMessages.push(JSON.parse(String(raw))));

send(tracker, { type: 'join', syncId, pin, relayRole: 'tracker' });
send(viewer, { type: 'join', syncId, pin, relayRole: 'viewer' });
await new Promise(resolve => setTimeout(resolve, 150));

for (let index = 0; index < 10; index += 1) {
  send(tracker, { type: 'gps', syncId, pin, lat: 48 + index / 1000, lon: 9, flight: { gsKts: 100 } });
  await new Promise(resolve => setTimeout(resolve, 100));
}
await new Promise(resolve => setTimeout(resolve, 300));
const telemetry = viewerMessages.filter(message => message.type === 'gps' && Number.isFinite(message.lat));
assert.ok(telemetry.length >= 2 && telemetry.length <= 3, `unerwartete Telemetrieanzahl: ${telemetry.length}`);

send(viewer, {
  type: 'gps', syncId, pin, target: 'tracker', commandOnly: true,
  trackerCommand: { type: 'mission_snapshot_request', commandId: `smoke-${Date.now()}`, pin }
});
await waitFor(trackerMessages, message => message.commandOnly === true);
assert.equal(viewerMessages.some(message => message.commandOnly === true), false);

tracker.close();
viewer.close();
console.log(JSON.stringify({ endpoint: url.origin, telemetryReceived: telemetry.length, commandImmediate: true }));
