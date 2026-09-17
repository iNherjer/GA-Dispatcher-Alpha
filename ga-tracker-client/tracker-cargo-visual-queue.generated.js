// Generated from mission-cargo-core.js by tools/extract-cargo-visual-queue.cjs.
'use strict';
function createCargoVisualQueue(options) {
  const _MISSION_CARGO_OBJECT_ACTION_QUEUE = new Map();
  let missionCargoObjectActionRevision = Number(options.initialRevision) || 0;
  const MISSION_CARGO_OBJECT_ACTION_DEBOUNCE_MS = 180;
  const setTimeout = options.setTimeout || globalThis.setTimeout;
  const clearTimeout = options.clearTimeout || globalThis.clearTimeout;
  const Date = { now: options.now || globalThis.Date.now };
  const _missionCargoStableObjectKey = options.getObjectKey;
  const _missionCargoSpawnVisibleItem = options.spawn;
  const _missionCargoRemoveVisibleItem = options.remove;
  const onSuperseded = options.onSuperseded || (() => {});
function _missionCargoFlushVisibleItemState(objectKey) {
    const key = String(objectKey || '').trim();
    const state = _MISSION_CARGO_OBJECT_ACTION_QUEUE.get(key);
    if (!state) return false;
    state.timer = null;
    const desired = state.desired;
    if (!desired) {
        _MISSION_CARGO_OBJECT_ACTION_QUEUE.delete(key);
        return false;
    }
    const sendOptions = {
        ...(desired.options || {}),
        objectKey: key,
        objectRevision: desired.revision
    };
    const commandId = desired.visible
        ? _missionCargoSpawnVisibleItem(desired.item, sendOptions)
        : _missionCargoRemoveVisibleItem(desired.item, { ...sendOptions, allScenes: true });
    if (!commandId) {
        _MISSION_CARGO_OBJECT_ACTION_QUEUE.delete(key);
        return false;
    }
    state.pendingCommandId = String(commandId);
    state.pendingRevision = desired.revision;
    state.sentAt = Date.now();
    return commandId;
}

function _missionCargoQueueVisibleItemState(item = null, visible = false, options = {}) {
    if (!item) return false;
    const objectKey = _missionCargoStableObjectKey(item);
    const previous = _MISSION_CARGO_OBJECT_ACTION_QUEUE.get(objectKey);
    if (previous?.timer) { clearTimeout(previous.timer); onSuperseded(previous.desired); }
    const revision = ++missionCargoObjectActionRevision;
    const state = previous || {
        objectKey,
        pendingCommandId: '',
        pendingRevision: 0,
        sentAt: 0,
        timer: null,
        desired: null
    };
    state.desired = {
        visible: visible === true,
        revision,
        item: JSON.parse(JSON.stringify(item)),
        options: { ...options }
    };
    const delayMs = options.immediate === true
        ? 0
        : Math.max(0, Number(options.delayMs ?? MISSION_CARGO_OBJECT_ACTION_DEBOUNCE_MS));
    state.timer = setTimeout(() => _missionCargoFlushVisibleItemState(objectKey), delayMs);
    _MISSION_CARGO_OBJECT_ACTION_QUEUE.set(objectKey, state);
    return true;
}

const resolveAck = function(ack = {}) {
    if (ack.type !== 'mission_scene_object_spawn_ack' && ack.type !== 'mission_scene_object_remove_ack') return false;
    const commandId = String(ack.commandId || '');
    if (!commandId) return false;
    for (const [objectKey, state] of _MISSION_CARGO_OBJECT_ACTION_QUEUE.entries()) {
        if (String(state?.pendingCommandId || '') !== commandId) continue;
        state.pendingCommandId = '';
        state.pendingRevision = 0;
        if (!state.timer && Number(state.desired?.revision || 0) <= Number(ack.objectRevision || state.desired?.revision || 0)) {
            _MISSION_CARGO_OBJECT_ACTION_QUEUE.delete(objectKey);
        }
        return true;
    }
    return false;
};

function _missionCargoCancelVisibleItemActions() {
    for (const state of _MISSION_CARGO_OBJECT_ACTION_QUEUE.values()) {
        if (state?.timer) clearTimeout(state.timer);
    }
    _MISSION_CARGO_OBJECT_ACTION_QUEUE.clear();
    missionCargoObjectActionRevision += 1;
}
  return { enqueue: _missionCargoQueueVisibleItemState, resolveAck, cancel: _missionCargoCancelVisibleItemActions, peek: key => { const state = _MISSION_CARGO_OBJECT_ACTION_QUEUE.get(key); return state?.timer != null ? state.desired : null; } };
}
module.exports = { createCargoVisualQueue };
