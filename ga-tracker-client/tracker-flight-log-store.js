'use strict';

const fs = require('fs');
const path = require('path');

const LOG_SCHEMA = 'ga.tracker-flight-log.v1';
const SUMMARY_SCHEMA = 'ga.tracker-flight-summary.v1';

function clean(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

function safeId(value, fallback) {
  const normalized = clean(value, 220)
    .replace(/[^a-zA-Z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return normalized || fallback;
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function telemetrySample(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    observedAt: Math.max(0, Math.round(finite(source.observedAt) || 0)),
    lat: finite(source.lat),
    lon: finite(source.lon),
    altFt: finite(source.altFt),
    aglFt: finite(source.aglFt),
    hdg: finite(source.hdg),
    gsKts: finite(source.gsKts),
    onGround: typeof source.onGround === 'boolean' ? source.onGround : null,
    bankDeg: finite(source.bankDeg),
    gForce: finite(source.gForce),
    vsFpm: finite(source.vsFpm),
    touchdownFpm: finite(source.touchdownFpm),
    windKts: finite(source.windKts),
    windDeg: finite(source.windDeg),
    windGustKts: finite(source.windGustKts),
    tempC: finite(source.tempC),
    visKm: finite(source.visKm),
    precipRateMmH: finite(source.precipRateMmH),
    precipActive: source.precipActive === true,
    inCloud: source.inCloud === true,
    turbulencePct: finite(source.turbulencePct),
    simPaused: source.simPaused === true,
    inMenuOrMap: source.inMenuOrMap === true,
    parkingBrake: typeof source.parkingBrake === 'boolean' ? source.parkingBrake : null
  };
}

function compactCloudModel(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const record = source.record && typeof source.record === 'object' ? source.record : null;
  return {
    schema: SUMMARY_SCHEMA,
    version: 1,
    missionId: clean(source.missionId),
    runId: clean(source.runId, 220),
    status: clean(source.status, 40) || 'completed',
    endedAt: Math.max(0, Math.round(finite(source.endedAt) || Date.now())),
    record: record ? JSON.parse(JSON.stringify(record)) : null
  };
}

function createTrackerFlightLogStore(options = {}) {
  const io = options.fs || fs;
  const directory = path.resolve(options.directory || path.join(process.cwd(), 'flightlogs'));
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const log = typeof options.log === 'function' ? options.log : () => {};
  const initialized = new Set();
  const finalized = new Set();
  io.mkdirSync(directory, { recursive: true });

  const filesFor = (missionId, runId) => {
    const base = `${safeId(missionId, 'mission')}--${safeId(runId, 'run')}`;
    return {
      key: base,
      log: path.join(directory, `${base}.jsonl`),
      summary: path.join(directory, `${base}.summary.json`)
    };
  };

  const append = (filename, payload) => {
    io.appendFileSync(filename, `${JSON.stringify(payload)}\n`, 'utf8');
  };

  const ensure = (missionId, runId) => {
    const files = filesFor(missionId, runId);
    if (!initialized.has(files.key)) {
      if (!io.existsSync(files.log) || io.statSync(files.log).size === 0) {
        append(files.log, {
          schema: LOG_SCHEMA,
          version: 1,
          type: 'run_started',
          missionId: clean(missionId),
          runId: clean(runId, 220),
          recordedAt: now()
        });
      }
      initialized.add(files.key);
    }
    return files;
  };

  const recordSample = request => {
    const missionId = clean(request?.missionId);
    const runId = clean(request?.runId, 220);
    if (!missionId || !runId) return { ok: false, status: 'invalid', error: 'flight_log_run_required' };
    const files = ensure(missionId, runId);
    append(files.log, {
      type: 'telemetry',
      phase: clean(request?.phase, 80),
      sample: telemetrySample(request?.sample),
      destination: request?.destination && typeof request.destination === 'object' ? {
        atDestination: request.destination.atDestination === true,
        hasAptArrival: request.destination.hasAptArrival === true,
        dArrivalNm: finite(request.destination.dArrivalNm),
        dMissionNm: finite(request.destination.dMissionNm),
        reason: clean(request.destination.reason, 80) || null
      } : null
    });
    return { ok: true, status: 'appended', filename: files.log };
  };

  const recordSegment = request => {
    const missionId = clean(request?.missionId);
    const runId = clean(request?.runId, 220);
    if (!missionId || !runId || !request?.record) return { ok: false, status: 'invalid', error: 'flight_log_segment_required' };
    const files = ensure(missionId, runId);
    append(files.log, {
      type: 'segment_completed',
      reason: clean(request.reason, 80) || 'stable-landing',
      record: request.record,
      missionRecord: request.missionRecord || null,
      recordedAt: now()
    });
    return { ok: true, status: 'appended', filename: files.log };
  };

  const finalize = request => {
    const missionId = clean(request?.missionId);
    const runId = clean(request?.runId, 220);
    if (!missionId || !runId) return { ok: false, status: 'invalid', error: 'flight_log_run_required' };
    const files = ensure(missionId, runId);
    const summary = compactCloudModel({ ...request, missionId, runId, endedAt: request?.endedAt || now() });
    if (finalized.has(files.key)) return { ok: true, status: 'noop', summary, filename: files.summary };
    append(files.log, { type: 'run_completed', summary, recordedAt: now() });
    const temporary = `${files.summary}.tmp-${process.pid}`;
    io.writeFileSync(temporary, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    io.renameSync(temporary, files.summary);
    append(path.join(directory, 'flight-log-index-v1.jsonl'), summary);
    finalized.add(files.key);
    log(`FLIGHT_LOG_FINALIZED mission=${missionId} run=${runId} status=${summary.status} segments=${Math.max(0, Number(summary.record?.segmentCount || 0))}`);
    return { ok: true, status: 'completed', summary, filename: files.summary, rawFilename: files.log };
  };

  return Object.freeze({
    directory,
    recordSample,
    recordSegment,
    finalize,
    publicState: () => ({ schema: LOG_SCHEMA, directory, activeRuns: initialized.size, finalizedRuns: finalized.size })
  });
}

module.exports = {
  LOG_SCHEMA,
  SUMMARY_SCHEMA,
  compactCloudModel,
  createTrackerFlightLogStore,
  telemetrySample
};
