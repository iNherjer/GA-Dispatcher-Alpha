'use strict';
// Eigene Figuren aus dem Asset-Pack als Homebase-Mitarbeiter: Freigabe aus dem
// installierten Pack, Tarmac-Ersatz ohne Pack, Tempo begrenzt auf die Figur.
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createHomebaseObjectManager } = require('./homebase-object-manager.js');
const catalog = require('./homebase-asset-catalog.js');

class FakeHandle extends EventEmitter {
  constructor() { super(); this.nextObjectId = 9000; this.created = []; this.waypointSpeeds = []; }
  addToDataDefinition() { return 0; }
  mapClientEventToSimEvent() { return 0; }
  transmitClientEvent() { return 0; }
  subscribeToSystemEvent(eventId, name) {
    if (name === 'ObjectAdded') this.addedEventId = eventId;
    if (name === 'ObjectRemoved') this.removedEventId = eventId;
    return 0;
  }
  aICreateSimulatedObject(title, _position, requestId) {
    const objectId = this.nextObjectId++;
    this.created.push(title);
    setTimeout(() => this.emit('assignedObjectID', { requestID: requestId, objectID: objectId }), 2);
    setTimeout(() => this.emit('eventAddRemove', { clientEventId: this.addedEventId, data: objectId }), 4);
    return requestId + 1000;
  }
  aIRemoveObject(objectId, requestId) {
    setTimeout(() => this.emit('eventAddRemove', { clientEventId: this.removedEventId, data: objectId }), 3);
    return requestId + 2000;
  }
  setDataOnSimObject(_defId, _objectId, data) {
    if (Array.isArray(data)) data.forEach((point) => { if (Number.isFinite(point?.speed)) this.waypointSpeeds.push(point.speed); });
    return 0;
  }
  requestDataOnSimObject(requestId) {
    setTimeout(() => this.emit('simObjectData', { requestID: requestId, data: { readFloat64: () => 514.25 } }), 3);
    return 0;
  }
}

function waitForAck(acks, type, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const index = acks.findIndex((ack) => ack.type === type);
      if (index >= 0) return resolve(acks.splice(index, 1)[0]);
      if (Date.now() - started > timeoutMs) return reject(new Error(`ACK timeout: ${type}`));
      setTimeout(tick, 5);
    };
    tick();
  });
}

const HIKER = 'tw-pod-hiker-f-01';
const STAND_IN = 'Tarmac_Female_Summer_Caucasian';
const navigation = { spawn: { lat: 48.2792, lon: 8.4283, altFt: 2201, heading: 168 }, obstacles: [] };
const person = (extra = {}) => ({
  id: 'p1', title: HIKER, fallbackTitle: STAND_IN, label: 'Wanderin', startNorthM: 0, startEastM: 0, speedKts: 4.5,
  targetMode: 'manual', destinations: [{ id: 'd1', targetType: 'waypoint', northM: 12, eastM: 0, waitMinS: 0, waitMaxS: 0 }],
  ...extra
});

async function preview(people) {
  const acks = [];
  const logs = [];
  const handle = new FakeHandle();
  const manager = createHomebaseObjectManager(handle, { sendAck: (ack) => acks.push(ack), log: (line) => logs.push(line), random: () => 0 });
  manager.handleCommand({ type: 'homebase_v1.preview.set', commandId: `set-${Date.now()}`, objects: [], people, navigation });
  const ack = await waitForAck(acks, 'homebase_v1.preview.set_ack');
  await new Promise((resolve) => setTimeout(resolve, 60));
  return { ack, handle, logs, manager };
}

test('ohne installierte Figur: Tarmac-Ersatz, ohne Ersatz abgelehnt', async () => {
  const { ack, handle, logs, manager } = await preview([person(), person({ id: 'p2', fallbackTitle: undefined })]);
  await manager.clearAll?.();
  assert.deepEqual(handle.created, [STAND_IN]);
  assert.equal(ack.spawnedPeople[0].title, STAND_IN);
  assert.equal(ack.failedPeople.length, 1);
  assert.match(ack.failedPeople[0].error, /nicht freigegeben/);
  assert.ok(logs.some((line) => line.includes('HOMEBASE_PERSON_FALLBACK')));
});

test('Figur aus dem Pack: eigener Titel, Tempo höchstens maxWalkKts, kein Objekt', async () => {
  catalog.registerRuntimeAssets([{
    key: 'tumbleweedHiker', folder: 'tw-pod-hikers', title: HIKER, label: 'Wanderin', kind: 'object',
    homebasePlaceable: false, missionSpawnable: true, missionRoles: ['passenger', 'scene-person'],
    person: { schemaVersion: 1, gender: 'female', locomotion: { type: 'waypoint-ground', maxWalkKts: 3 } }
  }]);
  assert.equal(catalog.objectDefinitionForTitle(HIKER), null, 'nicht als platzierbares Objekt');
  const { ack, handle, manager } = await preview([person()]);
  await manager.clearAll?.();
  assert.equal(ack.status, 'ok', JSON.stringify(ack));
  assert.deepEqual(handle.created, [HIKER]);
  assert.ok(handle.waypointSpeeds.length > 0, 'Wegpunkt gesendet');
  assert.ok(handle.waypointSpeeds.every((speed) => speed <= 3), `Tempo begrenzt: ${handle.waypointSpeeds}`);
});

test('ungültige Personendaten im Pack werden nicht registriert', () => {
  const base = { folder: 'x', kind: 'object', person: { gender: 'female', locomotion: { type: 'waypoint-ground', maxWalkKts: 3 } } };
  assert.equal(catalog.registerRuntimeAssets([{ ...base, title: 'Tarmac_Fake' }]), 0);
  assert.equal(catalog.personModelForTitle('Tarmac_Fake'), null);
  for (const [title, person] of [
    ['bad-gender', { gender: 'x', locomotion: { type: 'waypoint-ground', maxWalkKts: 3 } }],
    ['bad-speed', { gender: 'male', locomotion: { type: 'waypoint-ground', maxWalkKts: 9 } }],
    ['bad-type', { gender: 'male', locomotion: { type: 'teleport', maxWalkKts: 3 } }],
    ['array', []]
  ]) {
    catalog.registerRuntimeAssets([{ ...base, title, person }]);
    assert.equal(catalog.personModelForTitle(title), null, title);
  }
});
