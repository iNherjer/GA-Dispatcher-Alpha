'use strict';
// Extra simulator weather values for the weather diagnostics (SIM_WEATHER), 26.11.2026.
// Each value has its OWN data definition and request (one FLOAT64, once per second):
// a variable the simulator rejects only loses itself and never shifts the main aircraft
// packet. Diagnostics only; nothing here feeds voice, missions or the UI.
//
// MSFS documents no fog, humidity or dew point variable. These are the documented
// environment values that can still tell weather situations apart.

const EXTRA_WEATHER_VARS = Object.freeze([
  { key: 'pressInHg', name: 'AMBIENT PRESSURE', units: 'inHg' },
  { key: 'qnhHpa', name: 'SEA LEVEL PRESSURE', units: 'millibars' },
  { key: 'densitySlugFt3', name: 'AMBIENT DENSITY', units: 'slugs per cubic feet' },
  { key: 'tatC', name: 'TOTAL AIR TEMPERATURE', units: 'celsius' },
  { key: 'icePct', name: 'STRUCTURAL ICE PCT', units: 'percent over 100' },
  { key: 'windVertMs', name: 'AMBIENT WIND Y', units: 'meters per second' }
]);

function createWeatherExtraTelemetry({ handle, firstId = 230, float64Type, period, now = Date.now,
  log = () => {}, maxAgeMs = 5000, vars = EXTRA_WEATHER_VARS }) {
  const entries = vars.map((v, i) => ({ ...v, id: firstId + i, value: null, at: null, error: null }));
  const byId = new Map(entries.map(e => [e.id, e]));
  const sends = new Map();
  let disposed = false;

  const fail = (entry, reason) => {
    if (entry.error === reason) return;
    entry.value = null; entry.at = null; entry.error = reason;
    log(`SIM_WEATHER_EXTRA_ERROR var="${entry.name}" units="${entry.units}" error=${reason}`);
  };
  const receive = recv => {
    if (disposed) return;
    const entry = byId.get(recv?.requestID);
    if (!entry) return;
    try {
      if (recv.defineID !== entry.id || recv.defineCount !== 1) throw Error('packet_identity_invalid');
      if (typeof recv.data?.remaining !== 'function' || recv.data.remaining() !== 8) throw Error('packet_size_invalid');
      const read = recv.data.readFloat64 || recv.data.readDouble;
      if (typeof read !== 'function') throw Error('reader_missing');
      const value = read.call(recv.data);
      if (!Number.isFinite(value)) throw Error('value_invalid');
      entry.value = value; entry.at = now(); entry.error = null;
    } catch (err) { fail(entry, err.message || 'read_failed'); }
  };
  const exception = recv => {
    const hit = sends.get(recv?.sendId);
    if (hit && !disposed) fail(hit.entry, `${hit.operation}:${recv.exceptionName || recv.exception}`);
  };
  handle.on('simObjectData', receive);
  handle.on('exception', exception);
  for (const entry of entries) {
    try {
      sends.set(handle.addToDataDefinition(entry.id, entry.name, entry.units, float64Type), { entry, operation: 'define' });
      sends.set(handle.requestDataOnSimObject(entry.id, entry.id, 0, period, 0, 0, 0, 0), { entry, operation: 'request' });
    } catch (err) { fail(entry, err.message || 'setup_failed'); }
  }

  // Fresh values only; stale or rejected values are null.
  function snapshot(at = now()) {
    const out = {};
    for (const e of entries) out[e.key] = e.at !== null && at - e.at <= maxAgeMs ? e.value : null;
    return out;
  }

  return { snapshot, dispose() {
    disposed = true;
    handle.removeListener('simObjectData', receive);
    handle.removeListener('exception', exception);
  } };
}

module.exports = { createWeatherExtraTelemetry, EXTRA_WEATHER_VARS };
