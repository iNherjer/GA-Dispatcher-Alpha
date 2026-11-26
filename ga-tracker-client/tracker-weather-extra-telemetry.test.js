'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createWeatherExtraTelemetry, EXTRA_WEATHER_VARS } = require('./tracker-weather-extra-telemetry');

function fakeHandle() {
  const handle = new EventEmitter();
  let send = 100;
  handle.defs = []; handle.requests = [];
  handle.addToDataDefinition = (id, name, units) => { handle.defs.push({ id, name, units }); return ++send; };
  handle.requestDataOnSimObject = (req, def) => { handle.requests.push({ req, def }); return ++send; };
  return handle;
}
const packet = (id, value) => {
  const buf = Buffer.alloc(8); buf.writeDoubleLE(value);
  let used = false;
  return { requestID: id, defineID: id, defineCount: 1, data: { remaining: () => used ? 0 : 8, readFloat64() { used = true; return buf.readDoubleLE(0); } } };
};

test('one definition per value; a rejected variable only loses itself', () => {
  let t = 1000;
  const logs = [];
  const handle = fakeHandle();
  const extra = createWeatherExtraTelemetry({ handle, float64Type: 4, period: 4, now: () => t, log: l => logs.push(l) });
  assert.deepEqual(handle.defs.map(d => d.id), EXTRA_WEATHER_VARS.map((_, i) => 230 + i));
  assert.deepEqual(handle.requests.map(r => r.req), handle.requests.map(r => r.def), 'request id = definition id');
  handle.emit('simObjectData', packet(231, 1031.2));
  handle.emit('simObjectData', packet(234, 0.12));
  handle.emit('exception', { sendId: 101, exceptionName: 'NAME_UNRECOGNIZED' });
  const snap = extra.snapshot();
  assert.equal(snap.qnhHpa, 1031.2);
  assert.equal(snap.icePct, 0.12);
  assert.equal(snap.pressInHg, null);
  assert.deepEqual(logs, ['SIM_WEATHER_EXTRA_ERROR var="AMBIENT PRESSURE" units="inHg" error=define:NAME_UNRECOGNIZED']);
  t += 6000;
  assert.equal(extra.snapshot().qnhHpa, null, 'stale values are dropped');
  handle.emit('simObjectData', { ...packet(232, 1), defineCount: 2 });
  assert.match(logs.at(-1), /AMBIENT DENSITY.*packet_identity_invalid/);
  extra.dispose();
  assert.equal(handle.listenerCount('simObjectData'), 0);
});
