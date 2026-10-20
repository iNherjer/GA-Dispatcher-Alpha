'use strict';
// MSFS CAMERA STATE names for the log (2024 adds values without documented names).
const CAMERA_NAMES = { 2: 'cockpit', 3: 'external', 4: 'drone', 5: 'fixed', 6: 'environment', 7: 'six_dof', 8: 'gameplay',
  9: 'showcase', 10: 'drone_aircraft', 11: 'waiting', 12: 'world_map', 13: 'hangar_rtc', 14: 'hangar_custom', 15: 'menu_rtc',
  16: 'ingame_rtc', 17: 'replay', 19: 'drone_top_down', 21: 'hangar', 24: 'ground', 25: 'follow_traffic' };
const cameraName = value => value == null ? 'none' : `${value}=${CAMERA_NAMES[value] || 'unknown'}`;
// Independent INT32 request: optional aircraft SimVars must never shift CAMERA STATE.
function createCameraTelemetry({ handle, definitionId, requestId, int32Type, period, intervalFrames = 3, now = Date.now, log = () => {} }) {
  let state = null, at = null, disposed = false, lastError = null, lastLogged;
  let packetIdentity = null, rawValue = null;
  const sends = new Set();
  const fail = reason => { state = null; at = null; if (lastError !== reason) log(`MISSION_CAMERA_SOURCE_ERROR error=${reason} data=${JSON.stringify({ packetIdentity, rawValue })}`); lastError = reason; };
  const receive = packet => {
    if (disposed || packet?.requestID !== requestId) return;
    try {
      rawValue = null;
      packetIdentity = { requestId: packet.requestID, definitionId: packet.defineID,
        objectId: packet.objectID, defineCount: packet.defineCount,
        entryNumber: packet.entryNumber ?? null, outOf: packet.outOf ?? null,
        bytes: packet.data?.remaining?.() ?? null };
      if (packet.defineID !== definitionId || !Number.isSafeInteger(packet.objectID) || packet.objectID < 0
          || packet.defineCount !== 1 || (packet.entryNumber !== undefined && packet.entryNumber !== 1)
          || (packet.outOf !== undefined && packet.outOf !== 1) || packet.data?.remaining?.() !== 4) throw Error('camera_packet_invalid');
      const value = packet.data.readInt32();
      rawValue = value;
      if (!Number.isInteger(value) || value < 0 || value > 33) throw Error('camera_state_invalid');
      // One line per change only (World Map -> ready-to-fly -> cockpit ...).
      if (value !== lastLogged) { log(`SIM_CAMERA_STATE from=${cameraName(lastLogged)} to=${cameraName(value)}`); lastLogged = value; }
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
module.exports = { createCameraTelemetry, cameraName };
