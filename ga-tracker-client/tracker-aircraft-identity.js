'use strict';
// Which aircraft the pilot flies: sim title and registration (ATC ID). Used by the crew
// status (live flight shows the aircraft) and the crew fleet (Where I Left It: an aircraft
// of the crew counts as flying when it takes off). Own request, only sent by the sim when
// a value changes (checked once a second), so it costs nothing while the aircraft stays.
const CHANGED = 1; // SIMCONNECT_DATA_REQUEST_FLAG_CHANGED

function createAircraftIdentity({ handle, definitionId, requestId, stringType256, stringType32, period, log = () => {}, onChange = () => {} }) {
  let identity = null, disposed = false;
  const sends = new Set();
  const receive = packet => {
    if (disposed || packet?.requestID !== requestId) return;
    try {
      const title = String(packet.data.readString256() || '').replace(/\0/g, '').trim();
      const tail = String(packet.data.readString32() || '').replace(/\0/g, '').trim();
      const next = title ? { title, tail } : null;
      if (next?.title === identity?.title && next?.tail === identity?.tail) return;
      identity = next;
      log(`AIRCRAFT_IDENTITY title="${identity?.title || ''}" tail="${identity?.tail || ''}"`);
      onChange(identity);
    } catch (error) {
      log(`AIRCRAFT_IDENTITY_ERROR error=${error?.message || error}`);
    }
  };
  const exception = packet => {
    if (!disposed && sends.has(packet.sendId)) log(`AIRCRAFT_IDENTITY_ERROR error=${packet.exceptionName || packet.exception}`);
  };
  handle.on('simObjectData', receive);
  handle.on('exception', exception);
  try {
    sends.add(handle.addToDataDefinition(definitionId, 'TITLE', null, stringType256));
    sends.add(handle.addToDataDefinition(definitionId, 'ATC ID', null, stringType32));
    sends.add(handle.requestDataOnSimObject(requestId, definitionId, 0, period, CHANGED, 0, 0, 0));
  } catch (error) {
    log(`AIRCRAFT_IDENTITY_ERROR error=${error?.message || error}`);
  }
  return {
    current: () => identity,
    dispose() {
      disposed = true;
      handle.removeListener('simObjectData', receive);
      handle.removeListener('exception', exception);
    }
  };
}

module.exports = { createAircraftIdentity };
