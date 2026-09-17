'use strict';

// Requests and replies share one channel. Never serialize request handling behind
// an awaited simulator call: its reply may need an authority request in reverse.
function createMissionIpc(channel, handlers = {}, options = {}) {
  let sequence = 0;
  let closed = false;
  const pending = new Map();
  const send = message => {
    if (closed || channel.connected === false) {
      const error = Error('mission_process_unavailable'); close(error); throw error;
    }
    channel.send(message, error => { if (error) close(error); });
  };
  const close = (error = Error('mission_process_unavailable')) => {
    closed = true;
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(error); }
    pending.clear();
  };
  channel.on('disconnect', () => close());
  channel.on('error', close);
  channel.on('message', async message => {
    if (message?.protocol !== 'mission-ipc-v1') return;
    if (message.kind === 'reply') {
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id); clearTimeout(entry.timer);
      if (message.error) entry.reject(Error(message.error)); else entry.resolve(message.value);
      return;
    }
    if (message.kind === 'event') { options.onEvent?.(message.name, message.value); return; }
    if (message.kind !== 'request') return;
    try {
      if (!Object.hasOwn(handlers, message.name)) throw Error('mission_ipc_method_unknown');
      const value = await handlers[message.name](...(message.args || []));
      send({ protocol: 'mission-ipc-v1', kind: 'reply', id: message.id, value });
    } catch (error) {
      if (!closed) send({ protocol: 'mission-ipc-v1', kind: 'reply', id: message.id, error: String(error?.message || error) });
    }
  });
  return {
    close,
    event(name, value) { send({ protocol: 'mission-ipc-v1', kind: 'event', name, value }); },
    request(name, ...args) {
      if (closed) return Promise.reject(Error('mission_process_unavailable'));
      if (pending.size >= 256) return Promise.reject(Error('mission_process_busy'));
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          // No automatic replay: the child may already have committed the intent.
          reject(Error('mission_process_response_timeout'));
        }, options.timeoutForRequest?.(name, args) || options.timeoutMs || 30000);
        pending.set(id, { resolve, reject, timer });
        try { send({ protocol: 'mission-ipc-v1', kind: 'request', id, name, args }); }
        catch (error) { pending.delete(id); clearTimeout(timer); reject(error); }
      });
    }
  };
}

// Arrays are atomic; object patches avoid retransmitting immutable mission
// bundles and replay history on every telemetry observation.
function equalJson(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && equalJson(a[key], b[key]));
}
function difference(before, after, path = [], output = []) {
  if (Object.is(before, after)) return output;
  if (before && after && !Array.isArray(before) && !Array.isArray(after)
      && typeof before === 'object' && typeof after === 'object') {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (!Object.hasOwn(after, key)) output.push({ path: [...path, key], remove: true });
      else difference(before[key], after[key], [...path, key], output);
    }
  } else if (!equalJson(before, after)) output.push({ path, value: after });
  return output;
}
function applyDifference(state, changes) {
  for (const change of changes) {
    if (!change.path.length) { state = change.value; continue; }
    let target = state;
    for (const key of change.path.slice(0, -1)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('mission_ipc_invalid_path');
      target = target[key];
    }
    const key = change.path.at(-1);
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('mission_ipc_invalid_path');
    if (change.remove) delete target[key]; else target[key] = change.value;
  }
  return state;
}
// Voice generation + claim + playback already have their own finite budgets
// (up to 180s + 30s + 180s). IPC must not cut a valid workflow off at 30s.
function missionRequestTimeout(name, args = []) {
  if (name === 'callback' && ['playBoardingVoice', 'prepareBoardingVoice', 'playFarewellVoice', 'playComplianceVoice'].includes(args[0])) return 450000;
  if (name === 'intent' && args[0]?.deferEffects !== true) return 600000;
  return 30000;
}
module.exports = { createMissionIpc, difference, applyDifference, missionRequestTimeout };
