'use strict';
// Neuer Homebase-Stand ohne kompletten Neuaufbau, wenn die Objekte schon genau
// so im Sim stehen (z. B. nach Workbench-Bearbeitung und Speichern).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { createHomebaseObjectManager } = require('./homebase-object-manager.js');
const catalog = require('./homebase-asset-catalog.js');

class FakeHandle extends EventEmitter {
  constructor() { super(); this.nextObjectId = 7000; this.created = []; this.removed = []; }
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
    this.removed.push(objectId);
    setTimeout(() => this.emit('eventAddRemove', { clientEventId: this.removedEventId, data: objectId }), 3);
    return requestId + 2000;
  }
  setDataOnSimObject() { return 0; }
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

const placeable = catalog.assets.filter((entry) => entry.preview !== false && entry.kind !== 'internal'
  && entry.kind !== 'hangar' && entry.homebasePlaceable !== false).map((entry) => entry.title);
const objects = [
  { id: 'obj-a', title: placeable[0], label: 'A', lat: 48.27921, lon: 8.42831, altFt: 2201, heightOffsetFt: 0, heading: 45, scale: 1 },
  { id: 'obj-b', title: placeable[1] || placeable[0], label: 'B', lat: 48.27925, lon: 8.42840, altFt: 2201, heightOffsetFt: 0.5, heading: 170, scale: 1.2 }
];
const person = { id: 'p1', title: catalog.tarmacPeople[0].title, label: 'Crew', startNorthM: 0, startEastM: 0, speedKts: 2, targetMode: 'manual', destinations: [] };
const navigation = { spawn: { lat: 48.2792, lon: 8.4283, altFt: 2201, heading: 168 }, obstacles: [] };

test('Vorschau-Objekte werden erkannt, Verschieben/Entfernen aendern den Vergleich korrekt', async () => {
  const acks = [];
  const handle = new FakeHandle();
  const manager = createHomebaseObjectManager(handle, { sendAck: (ack) => acks.push(ack), log: () => {}, random: () => 0 });
  manager.handleCommand({ type: 'homebase_v1.preview.set', commandId: 'set-1', objects, people: [person], navigation });
  const setAck = await waitForAck(acks, 'homebase_v1.preview.set_ack');
  assert.equal(setAck.status, 'ok', JSON.stringify(setAck));
  const createdAfterSet = handle.created.length;

  assert.equal(manager.previewObjectsMatch(objects), true, 'gleicher Stand, Personen zaehlen nicht mit');
  assert.equal(manager.previewObjectsMatch([...objects].reverse()), true, 'Reihenfolge egal');
  assert.equal(manager.previewObjectsMatch([{ ...objects[0], lat: objects[0].lat + 0.00001 }, objects[1]]), false, 'verschoben');
  assert.equal(manager.previewObjectsMatch([{ ...objects[0], heading: 46 }, objects[1]]), false, 'gedreht');
  assert.equal(manager.previewObjectsMatch([objects[0]]), false, 'eines fehlt');
  assert.equal(manager.previewObjectsMatch([...objects, { ...objects[0], id: 'obj-c' }]), false, 'eines zu viel');
  assert.equal(manager.previewObjectsMatch([{ ...objects[0], title: 'Nicht freigegeben' }, objects[1]]), false);

  // Live-Verschieben aus der Workbench: kein Neu-Spawn, Vergleich folgt der neuen Position.
  const moved = { ...objects[1], lat: objects[1].lat + 0.00002, heading: 175 };
  manager.handleCommand({ type: 'homebase_v1.preview.object.move', commandId: 'move-1', object: moved });
  assert.equal((await waitForAck(acks, 'homebase_v1.preview.object.move_ack')).status, 'ok');
  assert.equal(handle.created.length, createdAfterSet, 'Verschieben spawnt nichts neu');
  assert.equal(manager.previewObjectsMatch([objects[0], moved]), true);

  // Entfernen aus der Workbench.
  manager.handleCommand({ type: 'homebase_v1.preview.object.remove', commandId: 'remove-1', id: 'obj-a', label: 'A' });
  await waitForAck(acks, 'homebase_v1.preview.object.remove_ack');
  assert.equal(manager.previewObjectsMatch([moved]), true);

  // Personen/Wege schonend angleichen: gleiche Person wird nicht neu gespawnt.
  const before = handle.created.length;
  manager.handleCommand({ type: 'homebase_v1.preview.people.sync', commandId: 'sync-1', people: [person], navigation, sceneSignature: 'hb1-test' });
  const syncAck = await waitForAck(acks, 'homebase_v1.preview.people.sync_ack');
  assert.equal(syncAck.status, 'ok', JSON.stringify(syncAck));
  assert.equal(handle.created.length, before, 'keine neuen Spawns');
  manager.clearAll?.();
});

test('Tracker uebernimmt passenden Stand ohne Neuaufbau', () => {
  const source = fs.readFileSync(path.join(__dirname, 'tracker.js'), 'utf8');
  assert.match(source, /homebaseManager\.previewObjectsMatch\(cache\.objects\)\) \{\s*homebaseSceneSignature = cache\.sceneSignature;\s*homebaseManager\.handleCommand\(\{\s*type: 'homebase_v1\.preview\.people\.sync'/);
  assert.match(source, /HOMEBASE_FALLBACK_ADOPT/);
});
