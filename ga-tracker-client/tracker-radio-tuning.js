'use strict';
const core = require('../radio-tuning-core');
// One write per explicit intent; bounded readback. Never swaps, changes spacing, mode or IDENT.
function createRadioTuning(handle, api, options = {}) {
  let nextRequest = 750000000;
  const pending = new Map(), definitions = new Map(), events = new Map();
  let closed = false, busy = false;
  const readTimeout = options.readTimeout || 1200;
  handle.on('simObjectData', recv => {
    const entry = pending.get(recv.requestID);
    if (!entry) return;
    pending.delete(recv.requestID); clearTimeout(entry.timer);
    try {
      const data = recv.data;
      entry.resolve(Number(typeof data.readFloat64 === 'function' ? data.readFloat64() : data.readDouble()));
    } catch (error) { entry.reject(error); }
  });
  function close() {
    closed = true;
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('simulator_not_connected')); }
    pending.clear();
  }
  handle.on('close', close);
  function read(spec) {
    if (closed) return Promise.reject(new Error('simulator_not_connected'));
    const name = core.variable(spec);
    if (!definitions.has(name)) {
      const id = 750000000 + definitions.size;
      handle.addToDataDefinition(id, name, spec.unit, api.SimConnectDataType.FLOAT64);
      definitions.set(name, id);
    }
    return new Promise((resolve, reject) => {
      const id = nextRequest++;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('radio_readback_timeout')); }, readTimeout);
      pending.set(id, {resolve, reject, timer});
      try { handle.requestDataOnSimObject(id, definitions.get(name), api.SimConnectConstants.OBJECT_ID_USER, api.SimConnectPeriod.ONCE, 0, 0, 0, 0); }
      catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
    });
  }
  async function execute(input) {
    let spec;
    try { spec = core.normalize(input); } catch (error) { return {ok:false, error:error.message}; }
    if (closed) return {ok:false, error:'simulator_not_connected'};
    if (busy) return {ok:false, error:'radio_busy'};
    busy = true;
    try {
      const eventName = core.event(spec);
      if (!events.has(eventName)) {
        const id = 750000000 + events.size;
        handle.mapClientEventToSimEvent(id, eventName); events.set(eventName, id);
      }
      handle.transmitClientEvent(api.SimConnectConstants.OBJECT_ID_USER, events.get(eventName), spec.encoded, 1, api.EventFlag.EVENT_FLAG_GROUPID_IS_PRIORITY);
      let actual;
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, options.settleMs === undefined ? 200 : options.settleMs));
        actual = await read(spec);
        if (Number.isFinite(actual) && Math.abs(actual - spec.expected) < (spec.kind === 'XPDR' ? 0.5 : 50)) {
          return {ok:true, status:'ok', confirmed:true, target:{kind:spec.kind,index:spec.index,slot:spec.slot,value:spec.value}, actual};
        }
      }
      return {ok:false, error:'radio_not_confirmed', actual};
    } catch (error) { return {ok:false, error:error.message}; }
    finally { busy = false; }
  }
  return {execute, close};
}
module.exports = {createRadioTuning};
