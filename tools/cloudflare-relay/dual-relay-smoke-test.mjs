import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import WebSocket from '../../ga-tracker-client/node_modules/ws/wrapper.mjs';

const syncId = `DUAL-${crypto.randomUUID()}`.toUpperCase();
const pin = 'dual-relay-smoke';
const room = crypto.createHash('sha256').update(syncId, 'utf8').digest('hex');
const cloudflareUrl = `wss://ga-relay.einherjer.workers.dev/?room=${room}`;
const renderUrl = 'wss://websocketrelais.onrender.com/';

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });
}

function observe(socket) {
  const messages = [];
  socket.on('message', raw => messages.push(JSON.parse(String(raw))));
  return messages;
}

function send(socket, payload) {
  socket.send(JSON.stringify(payload));
}

async function waitFor(messages, predicate, timeoutMs = 6000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const found = messages.find(predicate);
    if (found) return found;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Dual-Relay-Test: erwartete Nachricht blieb aus.');
}

const trackerCloudflare = await connect(cloudflareUrl);
const trackerRender = await connect(renderUrl);
const trackerCloudflareMessages = observe(trackerCloudflare);
const trackerRenderMessages = observe(trackerRender);
send(trackerCloudflare, { type: 'join', syncId, pin, relayRole: 'tracker' });
send(trackerRender, { type: 'join', syncId, pin, relayRole: 'tracker' });

const viewerCloudflare = await connect(cloudflareUrl);
const viewerCloudflareMessages = observe(viewerCloudflare);
send(viewerCloudflare, { type: 'join', syncId, pin, relayRole: 'viewer' });
await new Promise(resolve => setTimeout(resolve, 150));

const firstTelemetry = { type: 'gps', syncId, pin, trackerVersion: 'v346', trackerVersionCode: 346, lat: 48.1, lon: 9.1, flight: {} };
send(trackerCloudflare, firstTelemetry);
send(trackerRender, firstTelemetry);
await waitFor(viewerCloudflareMessages, message => message.lat === 48.1);

viewerCloudflare.close();
const viewerRender = await connect(renderUrl);
const viewerRenderMessages = observe(viewerRender);
send(viewerRender, { type: 'join', syncId, pin, relayRole: 'viewer' });
await new Promise(resolve => setTimeout(resolve, 150));

const fallbackTelemetry = { ...firstTelemetry, lat: 48.2, lon: 9.2 };
send(trackerCloudflare, fallbackTelemetry);
send(trackerRender, fallbackTelemetry);
await waitFor(viewerRenderMessages, message => message.lat === 48.2);

send(viewerRender, {
  type: 'gps', syncId, pin, target: 'tracker', commandOnly: true,
  trackerCommand: { type: 'mission_snapshot_request', commandId: `dual-${Date.now()}`, pin }
});
await waitFor(trackerRenderMessages, message => message.commandOnly === true);
assert.equal(trackerCloudflareMessages.some(message => message.commandOnly === true), false);

trackerCloudflare.close();
trackerRender.close();
viewerRender.close();
console.log(JSON.stringify({ primary: 'C', fallback: 'R', trackerVersion: 'v346', commandOnFallback: true }));
