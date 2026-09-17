'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCargoCheckpointRecovery } = require('./tracker-cargo-checkpoint-recovery.js');
test('recovery retires historical cargo effects and projects latest items once without changing manifest', () => {
  const snapshot = { executionAuthority: 'tracker', missionId: 'm', runId: 'r', authorityRevision: 2, executionRevision: 1,
    state: { phase: 'boarding', flags: {}, manifest: { key: 'cargo', items: [
      { id: 'loaded', status: 'loaded', itemType: 'cargo' },
      { id: 'unloaded', status: 'unloaded', itemType: 'cargo', unloadLat: 50, unloadLon: 9 },
      { id: 'pending', status: 'pending', itemType: 'cargo' },
      { id: 'pax', status: 'loaded', itemType: 'passenger' }
    ] }, effects: [{ effectId: 'old-unload', type: 'scene.cargo_item_transition', status: 'requested' }] }
  };
  const manifest = structuredClone(snapshot.state.manifest), retired = [], dispatched = [], payloads = [];
  const authority = { getExecutionSnapshot: () => snapshot,
    applyExecutionEvent: request => { retired.push(request.event.payload.effectId); return { ok: true }; } };
  const recovery = createCargoCheckpointRecovery(authority);
  const bridge = { dispatch: request => { dispatched.push(request); return { ok: true }; } };
  recovery.reconcile(bridge, null);
  assert.equal(dispatched.length, 0);
  recovery.reconcile(bridge, { lat: 48, lon: 8 }, request => payloads.push(request));
  recovery.reconcile(bridge, { lat: 48, lon: 8 });
  assert.deepEqual(retired, ['old-unload']);
  assert.deepEqual(dispatched.map(request => request.effect.payload.action), ['load', 'unload', 'unload']);
  assert.equal(dispatched[1].effect.payload.position.lat, 50);
  assert.ok(dispatched.every(request => recovery.ownsAck(request.commandId)));
  assert.equal(payloads.length, 1);
  assert.deepEqual(snapshot.state.manifest, manifest);
});
