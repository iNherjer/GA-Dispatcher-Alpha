'use strict';

const path = require('node:path');
const { createRotatingDebugLog } = require('./tracker-debug-log.js');

const APT_MISSION_TEST_LOG_FILENAME = 'GA-APT-Missionstest.txt';
const MISSION_TEST_LOG_SCHEMA = 'ga.mission-test-log.v3';
const APT_MISSION_TEST_LOG_SCHEMA = MISSION_TEST_LOG_SCHEMA;
const DEFAULT_SYSTEM_REPEAT_WINDOW_MS = 60000;
const SYSTEM_LINE_PATTERN = /^(?:TRACKER_RELAY_(?:OPEN|CLOSE|ERROR)|TRACKER_TELEMETRY_MODE|EFB_HTTP_(?:LISTEN|START_ERROR|PORT_CONFLICT|CONFIG_ERROR)|MISSION_AUTHORITY_(?:LOADED|LOAD_ERROR|PERSIST_ERROR)|MISSION_PROTOCOL_(?:RECEIVED|RESULT|LEGACY_ACQUIRE)|MISSION_EXECUTION_(?:RUNTIME|CHECKPOINT|TELEMETRY_IGNORED|FINALIZED|FINALIZE_ERROR|ABORTED)|MISSION_SHADOW_ERROR|VOICE_TTS_(?:READY|ERROR))\b/;

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

function createMissionTestLog(options = {}) {
  const filename = path.resolve(String(options.filename || '').trim());
  if (!String(options.filename || '').trim()) throw new Error('Missionstest benoetigt einen Dateinamen.');
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
  let activeRunKey = '';
  let started = false;

  function repeatedSystemKey(line = '') {
    const match = String(line || '').match(/^(TRACKER_RELAY_(?:ERROR|CLOSE))\s+relay=(render)\b/i);
    return match ? `${match[1].toUpperCase()}:${match[2].toLowerCase()}` : '';
  }

  function start(meta = {}) {
    if (started) return false;
    started = true;
    write([
      'MISSION_TEST_SESSION_START',
      `schema=${MISSION_TEST_LOG_SCHEMA}`,
      `tracker=${token(meta.trackerVersion)}`,
      `build=${Math.max(0, Math.round(Number(meta.trackerVersionCode) || 0))}`,
      `channel=${token(meta.runtimeChannel)}`,
      'executionAuthority=web',
      'sideEffects=0',
      `executionRuntime=${meta.executionRuntimeEnabled === true ? 'guarded' : 'disabled'}`,
      'automatic=1',
      'scope=all'
    ].join(' '));
    write('MISSION_TEST_INFO text=Automatischer_Missions-Transport-und-Shadow-Test_aktiv._Datei_unveraendert_an_den_Entwickler_senden.');
    write('MISSION_TEST_WAITING reason=no_mission_authority_observed action=Mission_in_der_App_normal_starten_und_beenden.');
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
          'MISSION_TEST_SYSTEM_SUMMARY',
          `event=${event}`,
          `relay=${relay}`,
          `repeats=${repeats}`,
          `windowMs=${systemRepeatWindowMs}`
        ].join(' ')) !== false;
      }
    }
    const written = write(`MISSION_TEST_SYSTEM ${line}`) !== false;
    if (/^MISSION_PROTOCOL_RESULT\s+type=mission_authority_release\s+status=ok\b/i.test(line)) {
      endActiveRun('authority_released');
    }
    if (/^MISSION_EXECUTION_FINALIZED\b/i.test(line)) endActiveRun('execution_finalized');
    if (/^MISSION_EXECUTION_ABORTED\b/i.test(line)) endActiveRun('execution_aborted');
    return written;
  }

  function observe(rawState = {}) {
    const state = rawState && typeof rawState === 'object' ? rawState : {};
    const recipe = token(state.recipe, 'unknown', 80).toLowerCase();
    const mode = token(state.mode, 'unknown', 80).toLowerCase();
    const missionId = token(state.missionId, 'unknown-mission', 180);
    const runId = token(state.runId, 'unknown-run', 220);
    const runKey = `${missionId}:${runId}`;
    let run = runs.get(runKey);
    if (!run) {
      run = {
        missionId,
        runId,
        comparisons: 0,
        driftCount: 0,
        unavailableCount: 0,
        mismatchCount: 0,
        phases: [],
        events: [],
        recipes: [],
        modes: [],
        lastStatus: 'unknown',
        lastPhase: 'unknown',
        lastMode: mode,
        ended: false
      };
      runs.set(runKey, run);
      write([
        'MISSION_TEST_BEGIN',
        `mission=${missionId}`,
        `run=${runId}`,
        `recipe=${recipe}`,
        `mode=${mode}`,
        'executionAuthority=web',
        'sideEffects=0'
      ].join(' '));
    }
    activeRunKey = runKey;

    run.comparisons += 1;
    const status = token(state.status, 'unknown', 80).toLowerCase();
    if (status === 'drift') run.driftCount += 1;
    if (status === 'unavailable') run.unavailableCount += 1;
    if (state.browserStateHash && state.trackerStateHash && state.browserStateHash !== state.trackerStateHash) {
      run.mismatchCount += 1;
    }
    const phase = token(state.phase, 'unknown', 80).toLowerCase();
    if (phase && run.phases[run.phases.length - 1] !== phase) run.phases.push(phase);
    if (recipe && run.recipes[run.recipes.length - 1] !== recipe) run.recipes.push(recipe);
    if (mode && run.modes[run.modes.length - 1] !== mode) run.modes.push(mode);
    run.lastStatus = status;
    run.lastPhase = phase;
    run.lastMode = mode;
    for (const rawEvent of Array.isArray(state.eventTrace) ? state.eventTrace : []) {
      const event = rawEvent && typeof rawEvent === 'object' ? rawEvent : {};
      const eventToken = `${Math.max(0, Math.round(Number(event.sequence) || 0))}:${token(event.type, '', 100).toUpperCase()}`;
      if (!eventToken.endsWith(':') && !run.events.includes(eventToken)) run.events.push(eventToken);
    }

    write([
      'MISSION_TEST_CHECKPOINT',
      `mission=${missionId}`,
      `run=${runId}`,
      `comparison=${run.comparisons}`,
      `authorityRevision=${Math.max(0, Math.round(Number(state.authorityRevision) || 0))}`,
      `sourceRevision=${Math.max(0, Math.round(Number(state.sourceRevision) || 0))}`,
      `recipe=${recipe}`,
      `mode=${mode}`,
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
    return true;
  }

  function endActiveRun(completion = 'authority_released') {
    const run = activeRunKey ? runs.get(activeRunKey) : null;
    if (!run || run.ended) return false;
    run.ended = true;
    const hasEventReplay = run.modes.includes('event-replay');
    const shadow = run.unavailableCount > 0
      ? 'UNAVAILABLE'
      : ((run.driftCount > 0 || run.mismatchCount > 0 || run.lastStatus === 'drift') ? 'DRIFT' : (run.lastStatus === 'match' ? 'MATCH' : 'UNKNOWN'));
    const executionFinalized = completion === 'execution_finalized';
    const parity = executionFinalized
      ? 'NOT_APPLICABLE'
      : hasEventReplay
      ? (shadow === 'MATCH' && run.lastMode === 'event-replay' && run.lastPhase === 'closed' ? 'PASS' : 'FAIL')
      : 'NOT_APPLICABLE';
    write([
      'MISSION_TEST_END',
      `mission=${run.missionId || 'unknown-mission'}`,
      `run=${run.runId || 'unknown-run'}`,
      `recipe=${run.recipes[run.recipes.length - 1] || 'unknown'}`,
      `mode=${executionFinalized ? 'tracker-execution' : (run.lastMode || 'unknown')}`,
      `transport=PASS`,
      `shadow=${shadow}`,
      `parity=${parity}`,
      `completion=${token(completion, 'authority_released', 80)}`,
      `comparisons=${run.comparisons}`,
      `drifts=${run.driftCount}`,
      `unavailable=${run.unavailableCount}`,
      `hashMismatches=${run.mismatchCount}`,
      `recipes=${run.recipes.join('>') || 'none'}`,
      `modes=${run.modes.join('>') || 'none'}`,
      `phases=${run.phases.join('>') || 'none'}`,
      `events=${run.events.join('>') || 'none'}`
    ].join(' '));
    activeRunKey = '';
    return true;
  }

  return {
    filename,
    start,
    observe,
    recordSystemLine,
    endActiveRun
  };
}

const createAptMissionTestLog = createMissionTestLog;

module.exports = {
  APT_MISSION_TEST_LOG_FILENAME,
  APT_MISSION_TEST_LOG_SCHEMA,
  MISSION_TEST_LOG_SCHEMA,
  DEFAULT_SYSTEM_REPEAT_WINDOW_MS,
  SYSTEM_LINE_PATTERN,
  createMissionTestLog,
  createAptMissionTestLog
};
