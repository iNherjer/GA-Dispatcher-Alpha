'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { RawBuffer, SimConnectDataType: T, SimConnectPeriod: P } = require('node-simconnect');
const { Simulator } = require('./simulator');
const { startServer } = require('./server');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function create(t) { const sim = new Simulator(); sim.connect(); t.after(() => sim.close()); return sim; }
test('SimConnect payload writes are observable through a new binary read, including gross weight', async t => {
  const sim = create(t); sim.addToDataDefinition(1, 'PAYLOAD STATION WEIGHT:2', 'pounds', T.FLOAT64);
  const buffer = new RawBuffer(8); buffer.writeFloat64(185); sim.setDataOnSimObject(1, 0, { buffer }); await delay(50);
  sim.addToDataDefinition(2, 'TITLE', null, T.STRING256); sim.addToDataDefinition(2, 'TOTAL WEIGHT', 'pounds', T.FLOAT64); sim.addToDataDefinition(2, 'PAYLOAD STATION WEIGHT:2', 'pounds', T.FLOAT64);
  const response = once(sim, 'simObjectData'); sim.requestDataOnSimObject(7, 2, 0, P.ONCE);
  const [packet] = await response; assert.equal(packet.requestID, 7); assert.match(packet.data.readString256(), /Cessna/); assert.equal(packet.data.readFloat64(), 2255); assert.equal(packet.data.readFloat64(), 185);
  sim.fault = 'payload-write'; buffer.setOffset(0); buffer.writeFloat64(0); sim.setDataOnSimObject(1, 0, { buffer }); await delay(50); assert.equal(sim.value('PAYLOAD STATION WEIGHT:2'), 185);
});
test('spawn assigns a real object ID, waypoints move it, remove emits the subscribed event', async t => {
  const sim = create(t); sim.subscribeToSystemEvent(77, 'ObjectRemoved');
  const assigned = once(sim, 'assignedObjectID'); sim.aICreateSimulatedObject('Tarmac_Male_Summer_Caucasian', { latitude: 48, longitude: 8, altitude: 500 }, 9);
  const [{ objectID, requestID }] = await assigned; assert.equal(requestID, 9);
  sim.addToDataDefinition(1, 'AI WAYPOINT LIST', 'number', T.WAYPOINT); sim.setDataOnSimObject(1, objectID, [{ latitude: 48.0001, longitude: 8, altitude: 500, speed: 3 }]); await delay(50); sim.tick(60); assert.equal(sim.objects.get(objectID)['PLANE LATITUDE'], 48.0001);
  const removed = once(sim, 'eventAddRemove'); sim.aIRemoveObject(objectID, 10); assert.deepEqual((await removed)[0], { clientEventId: 77, data: objectID }); assert.equal(sim.objects.size, 0);
});
test('missing spawn is not acknowledged and invalid definitions fail explicitly', async t => {
  const sim = create(t); sim.fault = 'spawn'; let ack = false; sim.on('assignedObjectID', () => { ack = true; });
  sim.aICreateSimulatedObject('Pallet01_01', {}, 1); await delay(60); assert.equal(ack, false); assert.equal(sim.objects.size, 0);
  assert.throws(() => sim.setDataOnSimObject(987, 0, []), /unknown_definition/);
});
test('flight interpolation, pause and ground state feed telemetry without any mission mutations', t => {
  const sim = create(t); sim.control({ action: 'fly', lat: 49, lon: 9, alt: 2800, agl: 2000, speed: 90, onGround: false, duration: 100 }); sim.tick(50);
  assert.equal(sim.vars['PLANE ALTITUDE'], 1800); assert.equal(sim.vars['SIM ON GROUND'], 0);
  sim.control({ action: 'pause', value: true }); sim.tick(50); assert.equal(sim.vars['PLANE ALTITUDE'], 1800);
  sim.control({ action: 'pause', value: false }); sim.tick(50); assert.equal(sim.vars['PLANE LATITUDE'], 49); assert.equal(sim.flight, null);
});
test('browser API requires its local token and serves UTF-8', async t => {
  const sim = create(t); const server = await startServer(sim); t.after(() => new Promise(resolve => server.close(resolve))); const url = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(url); assert.match(page.headers.get('content-type'), /charset=utf-8/); const html = await page.text(); assert.match(html, /Zuladung/);
  const denied = await fetch(url + '/control', { method: 'POST', body: '{}' }); assert.equal(denied.status, 403);
  const token = html.match(/const token='([^']+)'/)[1]; const response = await fetch(url + '/control', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Teststand-Token': token }, body: JSON.stringify({ action: 'fault', value: 'remove' }) }); assert.equal(response.status, 200); assert.equal(sim.fault, 'remove');
});
