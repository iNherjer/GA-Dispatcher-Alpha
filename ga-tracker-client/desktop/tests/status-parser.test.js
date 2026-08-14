const assert = require('node:assert/strict');
const test = require('node:test');
const { createTrackerStatus, statusFromLine } = require('../lib/status-parser');

test('tracker output advances relay, simulator and telemetry status', () => {
  let state = createTrackerStatus();
  assert.equal(state.telemetry, 'off');
  state = statusFromLine(state, 'Verbinde mit Cloudflare-Relay [C]... (Versuch 1)');
  assert.equal(state.relay, 'connecting');
  assert.equal(state.telemetry, 'link');
  state = statusFromLine(state, '📡 Cloudflare-Relay [C] verbunden für Pilot-ID: Test');
  assert.equal(state.relay, 'connected');
  assert.equal(state.relayCloudflare, 'connected');
  state = statusFromLine(state, '📡 Render-Relay [R] verbunden für Pilot-ID: Test');
  assert.equal(state.relayRender, 'connected');
  state = statusFromLine(state, '✈️ MSFS gefunden! Warte auf Positionsdaten...');
  assert.equal(state.simulator, 'connected');
  state = statusFromLine(state, 'GPS Lat 48.1504 | Lon 7.7099 | Alt 600ft');
  assert.equal(state.telemetry, 'live');
  state = statusFromLine(state, 'TRACKER_UI_STATE telemetry=hibernate reason=paused');
  assert.equal(state.telemetry, 'hibernate');
});

test('disconnect messages return status to waiting', () => {
  const connected = {
    ...createTrackerStatus(),
    process: 'running',
    relay: 'connected',
    relayCloudflare: 'connected',
    relayRender: 'connected',
    simulator: 'connected',
    telemetry: 'live'
  };
  const relayLost = statusFromLine(connected, '⚠️ Render-Relay: Verbindung getrennt. Neuer Versuch in 5 Sekunden...');
  assert.equal(relayLost.relay, 'connected');
  assert.equal(relayLost.relayRender, 'waiting');
  assert.equal(relayLost.telemetry, 'live');
  const simLost = statusFromLine(relayLost, '⚠️ MSFS getrennt. Neuer SimConnect-Versuch in 5 Sekunden...');
  assert.equal(simLost.simulator, 'waiting');
  assert.equal(simLost.telemetry, 'link');
});
