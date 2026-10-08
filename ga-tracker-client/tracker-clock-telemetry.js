'use strict';

// Isolate environment time from the optional aircraft packet. All three
// fields are explicitly FLOAT64; a rejected definition must never shift them.
function createClockTelemetry({handle, definitionId, requestId, float64Type, period,
  intervalFrames = 3, now = Date.now, log = () => {}, maxAgeMs = 2500}) {
  const sends = new Map();
  let values = null, capturedAt = null, error = null, disposed = false, diagnosticKey, diagnosticAt = -Infinity;
  const snapshot = (at = now()) => {
    const ageMs = capturedAt === null ? null : Math.max(0, at - capturedAt);
    const status = disposed ? 'disconnected' : error ? 'error' : !values ? 'waiting'
      : ageMs > maxAgeMs ? 'stale' : 'ok';
    return {source:'isolated-float64', status, ageMs, capturedAt, error,
      simAbsoluteTimeSeconds:status === 'ok' ? values.absolute : null,
      simLocalTimeSeconds:status === 'ok' ? values.local : null,
      simulationRate:status === 'ok' ? values.rate : null};
  };
  const diagnose = (bulk = {}, at = now()) => {
    const current = snapshot(at);
    const mismatch = current.status === 'ok' && Number.isFinite(bulk.simAbsoluteTimeSeconds)
      && Math.abs(current.simAbsoluteTimeSeconds - bulk.simAbsoluteTimeSeconds) > 5;
    const key = JSON.stringify([current.status, current.error, mismatch]);
    if (key !== diagnosticKey || at - diagnosticAt >= 30000) {
      diagnosticKey = key; diagnosticAt = at;
      log(`SIM_ENV_CLOCK_SOURCE data=${JSON.stringify({...current, mismatch,
        bulkAbsoluteSeconds:bulk.simAbsoluteTimeSeconds ?? null,
        bulkLocalSeconds:bulk.simLocalTimeSeconds ?? null, definitionId, requestId})}`);
    }
    return current;
  };
  const fail = reason => {values = null; capturedAt = null; error = reason; diagnose();};
  const receive = recv => {
    if (disposed || recv?.requestID !== requestId) return;
    try {
      if (recv.defineID !== definitionId || recv.objectID !== 0 || recv.defineCount !== 3)
        throw Error('clock_packet_identity_invalid');
      if (typeof recv.data?.remaining !== 'function' || recv.data.remaining() !== 24)
        throw Error('clock_packet_size_invalid');
      const read = recv.data.readFloat64 || recv.data.readDouble;
      if (typeof read !== 'function') throw Error('clock_reader_missing');
      const absolute = read.call(recv.data), local = read.call(recv.data), rate = read.call(recv.data);
      // Absolute time is seconds since year 1, not elapsed flight seconds.
      if (!Number.isFinite(absolute) || absolute < 86400 || !Number.isFinite(local)
          || local < 0 || local >= 86400 || !Number.isFinite(rate) || rate < 0.0625 || rate > 128)
        throw Error('clock_values_invalid');
      values = {absolute, local, rate}; capturedAt = now(); error = null;
    } catch (err) {fail(err.message || 'clock_read_failed');}
  };
  const exception = recv => {
    const operation = sends.get(recv?.sendId);
    if (operation && !disposed) fail(`clock_${operation}:${recv.exceptionName || recv.exception}`);
  };
  handle.on('simObjectData', receive); handle.on('exception', exception);
  try {
    for (const [name, units] of [['ABSOLUTE TIME','seconds'],['LOCAL TIME','seconds'],['SIMULATION RATE','number']])
      sends.set(handle.addToDataDefinition(definitionId, name, units, float64Type), name);
    sends.set(handle.requestDataOnSimObject(requestId, definitionId, 0, period, 0, 0, intervalFrames, 0), 'request');
  } catch (err) {fail(err.message || 'clock_setup_failed');}
  return {snapshot, diagnose, dispose() {
    disposed = true; values = null; capturedAt = null;
    handle.removeListener('simObjectData', receive); handle.removeListener('exception', exception);
  }};
}
module.exports = {createClockTelemetry};
