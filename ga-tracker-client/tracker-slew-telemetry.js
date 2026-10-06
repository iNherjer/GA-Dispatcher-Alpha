'use strict';

// One explicitly typed datum for the user aircraft. Never decode the optional
// weather/payload packet as a source of the authoritative Slew status.
function createSlewTelemetry({ handle, definitionId, requestId, int32Type, period,
  intervalFrames = 3, now = Date.now, log = () => {}, maxAgeMs = 2500 }) {
  const sends = new Map();
  let value = null, capturedAt = null, error = null, disposed = false;
  let lastDiagnosticKey = null, lastDiagnosticAt = null, comparisonRaw = null;
  const snapshot = (at = now()) => {
    const ageMs = capturedAt === null ? null : Math.max(0, at - capturedAt);
    const status = disposed ? 'disconnected' : error ? 'error'
      : capturedAt === null ? 'waiting' : ageMs > maxAgeMs ? 'stale' : 'ok';
    return { source: 'isolated-int32', active: status === 'ok' ? value > 0 : null,
      raw: value, capturedAt, ageMs, status, error };
  };
  const diagnose = (bulkRaw = comparisonRaw, at = now()) => {
    comparisonRaw = bulkRaw;
    const current = snapshot(at);
    const bulk = typeof bulkRaw === 'number' && Number.isFinite(bulkRaw) ? bulkRaw : null;
    const bulkActive = bulk === null ? null : bulk > 0.5;
    const mismatch = current.active !== null && bulkActive !== null && current.active !== bulkActive;
    const key = JSON.stringify([current.status, current.raw, current.error, mismatch, bulkActive]);
    if (key !== lastDiagnosticKey || (mismatch && at - lastDiagnosticAt >= 30000)) {
      lastDiagnosticKey = key; lastDiagnosticAt = at;
      log(`TRACKER_SLEW_DIAGNOSTIC data=${JSON.stringify({ ...current, bulkRaw: bulk,
        bulkActive, mismatch, definitionId, requestId })}`);
    }
    return current;
  };
  const fail = reason => { value = null; capturedAt = null; error = reason; diagnose(); };
  const receive = recv => {
    if (disposed || recv?.requestID !== requestId) return;
    if (recv.defineID !== definitionId || recv.objectID !== 0 || recv.defineCount !== 1) {
      fail('slew_packet_identity_invalid'); return;
    }
    try {
      if (typeof recv.data?.remaining !== 'function' || recv.data.remaining() !== 4
          || typeof recv.data.readInt32 !== 'function') throw Error('slew_packet_size_invalid');
      const raw = recv.data.readInt32();
      if (!Number.isInteger(raw)) throw Error('slew_value_invalid');
      value = raw; capturedAt = now(); error = null;
    } catch (err) { fail(err?.message || 'slew_read_failed'); }
  };
  const exception = recv => {
    const operation = sends.get(recv?.sendId);
    if (!operation || disposed) return;
    fail(`slew_${operation}:${recv.exceptionName || recv.exception}`);
  };
  handle.on('simObjectData', receive);
  handle.on('exception', exception);
  try {
    // node-simconnect returns a send ID, not the native API's HRESULT.
    // Server-side rejection is delivered asynchronously through exception.
    sends.set(handle.addToDataDefinition(definitionId, 'IS SLEW ACTIVE', 'Bool', int32Type), 'definition');
    sends.set(handle.requestDataOnSimObject(requestId, definitionId, 0, period,
      0, 0, intervalFrames, 0), 'request');
  } catch (err) { fail(err?.message || 'slew_setup_failed'); }
  const dispose = () => {
    disposed = true; value = null; capturedAt = null;
    handle.removeListener('simObjectData', receive);
    handle.removeListener('exception', exception);
  };
  return { snapshot, diagnose, dispose };
}

module.exports = { createSlewTelemetry };
