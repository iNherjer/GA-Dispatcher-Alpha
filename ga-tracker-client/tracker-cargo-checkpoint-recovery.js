'use strict';
const crypto = require('node:crypto');

// Recovery projects the saved desired state, never the sequence of cargo clicks.
// It does not change the manifest, trigger cargo speech or re-run mission phases.
function createCargoCheckpointRecovery(authority, log = () => {}) {
  const saved = authority.getExecutionSnapshot();
  const runId = saved?.runId;
  const prefix = `checkpoint-cargo-${crypto.randomBytes(8).toString('hex')}-`;
  let pending = Boolean(runId && saved.executionAuthority === 'tracker' && saved.state && !saved.state.flags.closed && !['planned', 'closing'].includes(saved.state.phase));
  if (pending) {
    for (const effect of saved.state.effects || []) {
      if (effect.type !== 'scene.cargo_item_transition' || effect.status !== 'requested') continue;
      const current = authority.getExecutionSnapshot();
      const result = authority.applyExecutionEvent({
        missionId: current.missionId, runId, expectedRevision: current.authorityRevision,
        expectedExecutionRevision: current.executionRevision, expectedExecutionStateHash: current.executionStateHash,
        event: { eventId: `${prefix}${effect.effectId}`, type: 'EFFECT_ACKNOWLEDGED',
          sequence: current.executionRevision + 1, occurredAt: Date.now(),
          payload: { effectId: effect.effectId, status: 'completed' } }
      });
      if (!result.ok) throw Error(`cargo_checkpoint_recovery_failed:${result.error}`);
    }
  }
  const validPosition = position => position && position.lat != null && position.lon != null
    && Number.isFinite(Number(position.lat)) && Number.isFinite(Number(position.lon));
  return {
    ownsAck: id => String(id || '').startsWith(prefix),
    reconcile(bridge, position, syncPayload) {
      if (!pending || !bridge) return;
      const current = authority.getExecutionSnapshot();
      if (!current || current.runId !== runId || current.state.flags.closed) { pending = false; return; }
      if (!validPosition(position)) return; // First valid simulator sample, not startup's empty position.
      pending = false;
      const manifest = current.state.manifest;
      let count = 0;
      for (const item of manifest.items || []) {
        if (item.itemType === 'passenger') continue;
        let action;
        let at = position;
        if (item.status === 'loaded') action = 'load';
        else if (item.status === 'unloaded') {
          action = 'unload';
          const stored = { lat: item.unloadLat, lon: item.unloadLon, altFt: item.unloadAltFt };
          if (validPosition(stored)) at = stored;
        } else if (item.status === 'pending'
            && ((item.pickupLocation === 'target' && current.state.phase === 'on_task')
              || (item.pickupLocation !== 'target' && ['prepare', 'boarding', 'boarded'].includes(current.state.phase)))) action = 'unload';
        else continue;
        const id = prefix + count++;
        Promise.resolve(bridge.dispatch({ missionId: current.missionId, runId, commandId: id,
          effect: { effectId: id, type: 'scene.cargo_item_transition', payload: {
            action, itemId: item.id, item, manifestKey: manifest.key, aircraftSlot: manifest.aircraftSlot,
            position: at, coalesced: true
          } }
        })).catch(error => log(`MISSION_CARGO_RECOVERY_ERROR error=${error.message}`));
      }
      if (syncPayload) Promise.resolve(syncPayload({ missionId: current.missionId, runId,
        commandId: prefix + 'payload', manifest, reason: 'checkpoint-recovery' }))
        .catch(error => log(`MISSION_CARGO_RECOVERY_PAYLOAD_ERROR error=${error.message}`));
      log(`MISSION_CARGO_CHECKPOINT_RECOVERY run=${runId} items=${count}`);
    }
  };
}
module.exports = { createCargoCheckpointRecovery };
