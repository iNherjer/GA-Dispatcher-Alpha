const assert = require('node:assert/strict');
const test = require('node:test');
const { createTrackerStatus, statusFromLine } = require('../lib/status-parser');

test('tracker output advances relay, simulator and telemetry status', () => {
  let state = createTrackerStatus();
  state = statusFromLine(state, 'Verbinde mit WebSocket-Server: wss://example.test ...');
  assert.equal(state.relay, 'connecting');
  state = statusFromLine(state, '📡 Relay verbunden für Pilot-ID: Test');
  assert.equal(state.relay, 'connected');
  state = statusFromLine(state, '✈️ MSFS gefunden! Warte auf Positionsdaten...');
  assert.equal(state.simulator, 'connected');
  state = statusFromLine(state, 'GPS Lat 48.1504 | Lon 7.7099 | Alt 600ft');
  assert.equal(state.telemetry, 'live');
});

test('disconnect messages return status to waiting', () => {
  const connected = {
    ...createTrackerStatus(),
    process: 'running',
    relay: 'connected',
    simulator: 'connected',
    telemetry: 'live'
  };
  const relayLost = statusFromLine(connected, '⚠️ WebSocket getrennt. Neuverbindung in 5 Sekunden...');
  assert.equal(relayLost.relay, 'waiting');
  const simLost = statusFromLine(relayLost, '⚠️ MSFS getrennt. Neuer SimConnect-Versuch in 5 Sekunden...');
  assert.equal(simLost.simulator, 'waiting');
  assert.equal(simLost.telemetry, 'waiting');
});
