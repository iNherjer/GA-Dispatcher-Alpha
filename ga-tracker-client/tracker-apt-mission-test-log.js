'use strict';

const path = require('node:path');
const { createRotatingDebugLog } = require('./tracker-debug-log.js');

const APT_MISSION_TEST_LOG_FILENAME = 'GA-APT-Missionstest.txt';
const APT_MISSION_TEST_LOG_SCHEMA = 'ga.apt-mission-test-log.v2';
const DEFAULT_SYSTEM_REPEAT_WINDOW_MS = 60000;
const SYSTEM_LINE_PATTERN = /^(?:TRACKER_RELAY_(?:OPEN|CLOSE|ERROR)|TRACKER_TELEMETRY_MODE|EFB_HTTP_(?:LISTEN|START_ERROR|PORT_CONFLICT|CONFIG_ERROR)|MISSION_AUTHORITY_(?:LOADED|LOAD_ERROR|PERSIST_ERROR)|MISSION_PROTOCOL_(?:RECEIVED|RESULT|LEGACY_ACQUIRE)|MISSION_SHADOW_ERROR|VOICE_TTS_(?:READY|ERROR))\b/;

function clean(value, maxLength = 240) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function token(value, fallback = 'none', maxLength = 240) {
  return clean(value, maxLength).replace(/\s+/g, '_') || fallback;
}

function list(value) {
  const entries = Array.isArray(value) ? value.map(entry => token(entry, '', 100)).filter(Boolean) : [];
  return entries.length ? entries.join(',') : 'none';
}

function trace(value) {
  const entries = (Array.isArray(value) ? value : []).slice(-32).map((raw) => {
    const entry = raw && typeof raw === 'object' ? raw : {};
    const type = token(entry.type, '', 100).toUpperCase();
    const sequence = Math.max(0, Math.round(Number(entry.sequence) || 0));
    return type ? `${sequence}:${type}` : '';
  }).filter(Boolean);
  return entries.length ? entries.join('>') : 'none';
}

function createAptMissionTestLog(options = {}) {
  const filename = path.resolve(String(options.filename || '').trim());
  if (!String(options.filename || '').trim()) throw new Error('APT-Missionstest benoetigt einen Dateinamen.');
  const write = typeof options.write === 'function'
    ? options.write
    : createRotatingDebugLog({
      filename,
      maxBytes: 4 * 1024 * 1024,
      retainedTailBytes: 1024 * 1024,
      maxLineBytes: 8 * 1024,
      dedupeWindowMs: 1
    });
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const systemRepeatWindowMs = Math.max(5000, Math.round(Number(options.systemRepeatWindowMs) || DEFAULT_SYSTEM_REPEAT_WINDOW_MS));
  const repeatedSystemLines = new Map();
  const runs = new Map();
  let started = false;

  function repeatedSystemKey(line = '') {
    const match = String(line || '').match(/^(TRACKER_RELAY_(?:ERROR|CLOSE))\s+relay=(render)\b/i);
    return match ? `${match[1].toUpperCase()}:${match[2].toLowerCase()}` : '';
  }

  function start(meta = {}) {
    if (started) return false;
    started = true;
    write([
      'APT_TEST_SESSION_START',
      `schema=${APT_MISSION_TEST_LOG_SCHEMA}`,
      `tracker=${token(meta.trackerVersion)}`,
      `build=${Math.max(0, Math.round(Number(meta.trackerVersionCode) || 0))}`,
      `channel=${token(meta.runtimeChannel)}`,
      'executionAuthority=web',
      'sideEffects=0',
      'automatic=1'
    ].join(' '));
    write('APT_TEST_INFO text=Automatischer_APT-Shadow-Test_aktiv._Datei_unveraendert_an_den_Entwickler_senden.');
    write('APT_TEST_WAITING reason=no_apt_authority_observed action=Mission_in_der_App_normal_starten_und_beenden.');
    return true;
  }

  function recordSystemLine(rawLine) {
    const line = clean(rawLine, 2000);
    if (!SYSTEM_LINE_PATTERN.test(line)) return false;
    const repeatKey = repeatedSystemKey(line);
    if (repeatKey) {
      const currentAt = Math.max(0, Number(now()) || Date.now());
      const previous = repeatedSystemLines.get(repeatKey);
      if (!previous) {
        repeatedSystemLines.set(repeatKey, { lastWrittenAt: currentAt, suppressed: 0 });
      } else if (currentAt - previous.lastWrittenAt < systemRepeatWindowMs) {
        previous.suppressed += 1;
        return false;
      } else {
        const repeats = previous.suppressed + 1;
        previous.lastWrittenAt = currentAt;
        previous.suppressed = 0;
        const [event, relay] = repeatKey.split(':');
        return write([
          'APT_TEST_SYSTEM_SUMMARY',
          `event=${event}`,
          `relay=${relay}`,
          `repeats=${repeats}`,
          `windowMs=${systemRepeatWindowMs}`
        ].join(' ')) !== false;
      }
    }
    return write(`APT_TEST_SYSTEM ${line}`) !== false;
  }

  function observe(rawState = {}) {
    const state = rawState && typeof rawState === 'object' ? rawState : {};
    if (clean(state.recipe, 80).toLowerCase() !== 'apt') return false;
    const missionId = token(state.missionId, 'unknown-mission', 180);
    const runId = token(state.runId, 'unknown-run', 220);
    const runKey = `${missionId}:${runId}`;
    let run = runs.get(runKey);
    if (!run) {
      run = {
        comparisons: 0,
        driftCount: 0,
        unavailableCount: 0,
        mismatchCount: 0,
        phases: [],
        events: [],
        ended: false
      };
      runs.set(runKey, run);
      write([
        'APT_TEST_BEGIN',
        `mission=${missionId}`,
        `run=${runId}`,
        `mode=${token(state.mode, 'unknown', 80)}`,
        'executionAuthority=web',
        'sideEffects=0'
      ].join(' '));
    }

    run.comparisons += 1;
    const status = token(state.status, 'unknown', 80).toLowerCase();
    if (status === 'drift') run.driftCount += 1;
    if (status === 'unavailable') run.unavailableCount += 1;
    if (state.browserStateHash && state.trackerStateHash && state.browserStateHash !== state.trackerStateHash) {
      run.mismatchCount += 1;
    }
    const phase = token(state.phase, 'unknown', 80).toLowerCase();
    if (phase && run.phases[run.phases.length - 1] !== phase) run.phases.push(phase);
    for (const rawEvent of Array.isArray(state.eventTrace) ? state.eventTrace : []) {
      const event = rawEvent && typeof rawEvent === 'object' ? rawEvent : {};
      const eventToken = `${Math.max(0, Math.round(Number(event.sequence) || 0))}:${token(event.type, '', 100).toUpperCase()}`;
      if (!eventToken.endsWith(':') && !run.events.includes(eventToken)) run.events.push(eventToken);
    }

    write([
      'APT_TEST_CHECKPOINT',
      `mission=${missionId}`,
      `run=${runId}`,
      `comparison=${run.comparisons}`,
      `authorityRevision=${Math.max(0, Math.round(Number(state.authorityRevision) || 0))}`,
      `sourceRevision=${Math.max(0, Math.round(Number(state.sourceRevision) || 0))}`,
      `mode=${token(state.mode, 'unknown', 80)}`,
      `status=${status}`,
      `reason=${token(state.reason, 'none', 120)}`,
      `phase=${phase}`,
      `subphase=${token(state.subphase, 'none', 80)}`,
      `browserHash=${token(state.browserStateHash, 'none', 180)}`,
      `trackerHash=${token(state.trackerStateHash, 'none', 180)}`,
      `drift=${list(state.driftFields)}`,
      `legacyDrift=${list(state.legacyDriftFields)}`,
      `trace=${trace(state.eventTrace)}`,
      `observedAt=${Math.max(0, Math.round(Number(state.observedAt) || 0))}`
    ].join(' '));

    if (phase === 'closed' && !run.ended) {
      run.ended = true;
      const parity = run.driftCount === 0
        && run.unavailableCount === 0
        && run.mismatchCount === 0
        && status === 'match'
        && clean(state.mode, 80) === 'event-replay'
        ? 'PASS'
        : 'FAIL';
      write([
        'APT_TEST_END',
        `mission=${missionId}`,
        `run=${runId}`,
        `parity=${parity}`,
        'completion=closed',
        `comparisons=${run.comparisons}`,
        `drifts=${run.driftCount}`,
        `unavailable=${run.unavailableCount}`,
        `hashMismatches=${run.mismatchCount}`,
        `phases=${run.phases.join('>') || 'none'}`,
        `events=${run.events.join('>') || 'none'}`
      ].join(' '));
    }
    return true;
  }

  return {
    filename,
    start,
    observe,
    recordSystemLine
  };
}

module.exports = {
  APT_MISSION_TEST_LOG_FILENAME,
  APT_MISSION_TEST_LOG_SCHEMA,
  DEFAULT_SYSTEM_REPEAT_WINDOW_MS,
  SYSTEM_LINE_PATTERN,
  createAptMissionTestLog
};
