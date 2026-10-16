'use strict';
// Independent INT32 request: optional aircraft SimVars must never shift CAMERA STATE.
function createCameraTelemetry({ handle, definitionId, requestId, int32Type, period, intervalFrames = 3, now = Date.now, log = () => {} }) {
  let state = null, at = null, disposed = false, lastError = null;
  const sends = new Set();
  const fail = reason => { state = null; at = null; if (lastError !== reason) log(`MISSION_CAMERA_SOURCE_ERROR error=${reason}`); lastError = reason; };
  const receive = packet => {
    if (disposed || packet?.requestID !== requestId) return;
    try {
      if (packet.defineID !== definitionId || !Number.isSafeInteger(packet.objectID) || packet.objectID < 0
          || packet.defineCount !== 1 || (packet.entryNumber !== undefined && packet.entryNumber !== 1)
          || (packet.outOf !== undefined && packet.outOf !== 1) || packet.data?.remaining?.() !== 4) throw Error('camera_packet_invalid');
      const value = packet.data.readInt32();
      if (!Number.isInteger(value) || value < 0 || value > 33) throw Error('camera_state_invalid');
      state = value; at = now(); lastError = null;
    } catch (error) { fail(error.message); }
  };
  const exception = packet => { if (!disposed && sends.has(packet.sendId)) fail(packet.exceptionName || packet.exception); };
  handle.on('simObjectData', receive); handle.on('exception', exception);
  try {
    const define = handle.addToDataDefinition(definitionId, 'CAMERA STATE', 'Enum', int32Type);
    if (typeof define === 'number' && define < 0) throw Error('camera_definition_failed');
    sends.add(define);
    const request = handle.requestDataOnSimObject(requestId, definitionId, 0, period, 0, 0, intervalFrames, 0);
    if (typeof request === 'number' && request < 0) throw Error('camera_request_failed');
    sends.add(request);
  } catch (error) { fail(error.message); }
  return { snapshot: () => !disposed && at !== null && now() - at >= 0 && now() - at <= 2500 ? state : null,
    dispose() { disposed = true; state = null; handle.removeListener('simObjectData', receive); handle.removeListener('exception', exception); } };
}
module.exports = { createCameraTelemetry };
