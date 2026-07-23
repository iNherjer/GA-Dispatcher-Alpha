'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const catalog = require('./homebase-asset-catalog.js');
const {
  OPEN_RADIUS_M,
  CLOSE_RADIUS_M,
  PLAYER_OPEN_RADIUS_M,
  PLAYER_CLOSE_RADIUS_M,
  CLOSE_DELAY_MS,
  DOOR_STATE_RETENTION_MS,
  collectDoorControls,
  distanceMeters,
  nearestSource,
  proximityZone,
  proximityForSources,
  finitePosition
} = require('./homebase-door-proximity-test.js');
const { createHomebaseDoorAutomation, advanceDoorAutomationState, doorStateExpired } = require('./homebase-door-automation.js');

const origin = { lat: 48, lon: 8 };
const aboutTenMetersNorth = { lat: 48 + (10 / 6371000) * (180 / Math.PI), lon: 8 };
const distance = distanceMeters(origin, aboutTenMetersNorth);
assert.ok(distance > 9.9 && distance < 10.1, `Distanz war ${distance}`);

const controls = collectDoorControls(catalog.assets);
assert.ok(controls.some((control) => control.simvar === 'L:1:VFR_HOMEBASE_ROUND_HANGAR_DOOR_COMMAND'));
assert.ok(controls.every((control) => control.title && control.simvar.startsWith('L:1:')));
assert.ok(controls.every((control) => Number.isFinite(control.openValue) && Number.isFinite(control.closedValue)));
assert.ok(CLOSE_RADIUS_M > OPEN_RADIUS_M);
assert.equal(PLAYER_OPEN_RADIUS_M, 33);
assert.equal(PLAYER_CLOSE_RADIUS_M, 35);
assert.ok(PLAYER_CLOSE_RADIUS_M > PLAYER_OPEN_RADIUS_M);
assert.ok(CLOSE_DELAY_MS >= 1000);
assert.equal(proximityZone(OPEN_RADIUS_M - .1), 'open');
assert.equal(proximityZone(OPEN_RADIUS_M), 'open');
assert.equal(proximityZone((OPEN_RADIUS_M + CLOSE_RADIUS_M) / 2), 'hold');
assert.equal(proximityZone(CLOSE_RADIUS_M), 'close');
assert.equal(proximityZone(PLAYER_OPEN_RADIUS_M, { kind: 'Flugzeug' }), 'open');
assert.equal(proximityZone((PLAYER_OPEN_RADIUS_M + PLAYER_CLOSE_RADIUS_M) / 2, { kind: 'Avatar' }), 'hold');
assert.equal(proximityZone(PLAYER_CLOSE_RADIUS_M, { kind: 'Aktiver Benutzer' }), 'close');
assert.equal(proximityZone(Infinity), 'unknown');
assert.equal(doorStateExpired({ lastSeenAt: 1000, lastCommandAt: 1000 }, 1000 + DOOR_STATE_RETENTION_MS), false);
assert.equal(doorStateExpired({ lastSeenAt: 1000, lastCommandAt: 1000 }, 1001 + DOOR_STATE_RETENTION_MS), true);
assert.equal(doorStateExpired({ lastSeenAt: 5000, lastCommandAt: 1000 }, 5000 + DOOR_STATE_RETENTION_MS), false);

const now = Date.now();
const pointNorth = (meters, kind) => ({
  lat: 48 + (meters / 6371000) * (180 / Math.PI), lon: 8, kind, at: now
});
const mixedProximity = proximityForSources([
  pointNorth(19, 'Homebase-Person:person-1'),
  pointNorth(27, 'Flugzeug')
], origin, now);
assert.equal(mixedProximity.zone, 'open');
assert.equal(mixedProximity.source.kind, 'Flugzeug');

const nearest = nearestSource(
  [
    { ...origin, kind: 'Flugzeug', at: now },
    { ...aboutTenMetersNorth, kind: 'Avatar', at: now }
  ],
  { ...origin, title: 'VFR Multitool Homebase Round Hangar' },
  now
);
assert.equal(nearest.source.kind, 'Flugzeug');
assert.ok(nearest.distanceM <= OPEN_RADIUS_M);

const stale = nearestSource(
  [{ ...origin, kind: 'Avatar', at: now - 5000 }],
  { ...origin, title: 'VFR Multitool Homebase Round Hangar' },
  now
);
assert.equal(stale, null);

assert.equal(finitePosition(0, 0), null);
assert.equal(finitePosition(48, 8, 500, { kind: 'Avatar' }).kind, 'Avatar');

let manualOpenFar = {
  commandedState: 'open', lastCommandAt: 1000, outsideSince: null, manualOverrideState: 'open'
};
let transition = advanceDoorAutomationState(manualOpenFar, 'close', 2000);
manualOpenFar = transition.record;
assert.equal(transition.writeState, null);
assert.equal(manualOpenFar.manualOverrideState, 'open');
transition = advanceDoorAutomationState(manualOpenFar, 'close', 2000 + CLOSE_DELAY_MS);
manualOpenFar = transition.record;
assert.equal(transition.automaticTarget, 'closed');
assert.equal(transition.writeState, null);
assert.equal(manualOpenFar.manualOverrideState, 'open');
transition = advanceDoorAutomationState(manualOpenFar, 'open', 6000);
manualOpenFar = transition.record;
assert.equal(transition.manualOverrideReleased, 'open');
assert.equal(manualOpenFar.manualOverrideState, null);
transition = advanceDoorAutomationState(manualOpenFar, 'close', 7000);
manualOpenFar = transition.record;
transition = advanceDoorAutomationState(manualOpenFar, 'close', 7000 + CLOSE_DELAY_MS);
assert.equal(transition.writeState, 'closed');

let manualClosedNear = {
  commandedState: 'closed', lastCommandAt: 1000, outsideSince: null, manualOverrideState: 'closed'
};
transition = advanceDoorAutomationState(manualClosedNear, 'open', 2000);
manualClosedNear = transition.record;
assert.equal(transition.writeState, null);
assert.equal(manualClosedNear.manualOverrideState, 'closed');
transition = advanceDoorAutomationState(manualClosedNear, 'close', 3000);
manualClosedNear = transition.record;
transition = advanceDoorAutomationState(manualClosedNear, 'close', 3000 + CLOSE_DELAY_MS);
manualClosedNear = transition.record;
assert.equal(transition.manualOverrideReleased, 'closed');
assert.equal(manualClosedNear.manualOverrideState, null);
transition = advanceDoorAutomationState(manualClosedNear, 'open', 7000);
assert.equal(transition.writeState, 'open');

class FakeHandle extends EventEmitter {
  constructor() { super(); this.writes = []; }
  addToDataDefinition() { return 0; }
  requestDataOnSimObject() { return 0; }
  requestDataOnSimObjectType() { return 0; }
  setDataOnSimObject(definitionId, objectId, payload) {
    this.writes.push({ definitionId, objectId, value: payload.buffer.getBuffer().readDoubleLE(0) });
    return 0;
  }
}

const handle = new FakeHandle();
const controller = createHomebaseDoorAutomation(handle);
controller.writeState({ objectId: 101, title: 'VFR Multitool Homebase Round Hangar' }, 'open', 'self-test');
controller.writeState({ objectId: 202, title: 'VFR Multitool Homebase Round Hangar' }, 'closed', 'self-test');
const manualOverride = controller.noteManualState({ objectId: 101, title: 'VFR Multitool Homebase Round Hangar' }, 'open');
assert.equal(manualOverride.active, true);
assert.equal(controller.snapshot().states.find(([objectId]) => objectId === 101)?.[1]?.manualOverrideState, 'open');
const syncResult = controller.setEnabled(true, { resetManualOverrides: false });
assert.equal(syncResult.resetManualOverrides, 0);
assert.equal(controller.snapshot().states.find(([objectId]) => objectId === 101)?.[1]?.manualOverrideState, 'open');
const resetResult = controller.setEnabled(true, { resetManualOverrides: true });
assert.equal(resetResult.resetManualOverrides, 1);
assert.equal(controller.snapshot().states.find(([objectId]) => objectId === 101)?.[1]?.manualOverrideState, null);
controller.noteManualState({ objectId: 202, title: 'VFR Multitool Homebase Round Hangar' }, 'closed');
assert.equal(controller.forgetObject(202), true);
assert.equal(controller.snapshot().states.some(([objectId]) => objectId === 202), false);
controller.stop();
assert.deepEqual(handle.writes.map((write) => [write.objectId, write.value]), [[101, 0], [202, 1]]);

console.log('homebase door proximity self-test ok');
