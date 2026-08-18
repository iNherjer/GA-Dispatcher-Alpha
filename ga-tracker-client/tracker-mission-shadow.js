'use strict';

const executionCore = require('../mission-execution-core.js');

const SHADOW_STATUS_SCHEMA = 'ga.mission-shadow-status.v1';
const SHADOW_STATUS_VERSION = 1;
const DEFAULT_HISTORY_LIMIT = 40;
const COMPARED_FIELDS = Object.freeze([
  'missionId',
  'recipe',
  'sourceRevision',
  'stateRevision',
  'phase',
  'subphase',
  'allowedActions',
  'blockingReasons',
  'cargo',
  'workflows',
  'effects',
  'stateHash',
  'replaySemanticHash',
  'legacyStateHash',
  'legacyDriftFields',
  'legacyComparison'
]);

function cleanString(value, maxLength = 180) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function publicTrace(value) {
  return (Array.isArray(value) ? value : []).slice(-24).map((entry) => ({
    type: cleanString(safeObject(entry).type, 100).toUpperCase(),
    traceId: cleanString(safeObject(entry).traceId, 180) || null,
    sequence: Math.max(0, Math.round(Number(safeObject(entry).sequence) || 0))
  })).filter(entry => entry.type);
}

function compareEnvelope(browserEnvelope, trackerEnvelope) {
  const drift = [];
  for (const field of COMPARED_FIELDS) {
    if (executionCore.canonicalStringify(browserEnvelope[field]) !== executionCore.canonicalStringify(trackerEnvelope[field])) {
      drift.push(field);
    }
  }
  return drift;
}

function createTrackerMissionShadow(options = {}) {
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const log = typeof options.log === 'function' ? options.log : () => {};
  const onObservation = typeof options.onObservation === 'function' ? options.onObservation : () => {};
  const historyLimit = Math.max(4, Math.min(120, Math.round(Number(options.historyLimit) || DEFAULT_HISTORY_LIMIT)));
  let current = null;
  let history = [];

  const remember = (entry) => {
    current = entry;
    history.push(entry);
    history = history.slice(-historyLimit);
    const state = publicState();
    try { onObservation(state); } catch (_) {}
    return state;
  };

  const unavailable = (input, reason) => {
    const resumeBundle = safeObject(input.resumeBundle);
    const browserEnvelope = safeObject(input.browserEnvelope || resumeBundle.execution);
    const replayBundle = safeObject(input.replayBundle || resumeBundle.executionReplay);
    return remember({
    status: 'unavailable',
    reason,
    mode: replayBundle.schema === executionCore.BUNDLE_SCHEMA ? 'event-replay' : 'snapshot-shadow',
    recipe: cleanString(
      replayBundle.recipe
      || browserEnvelope.recipe
      || safeObject(resumeBundle.descriptor).primaryAdapter
      || resumeBundle.adapter,
      80
    ).toLowerCase() || null,
    missionId: cleanString(input.missionId || safeObject(input.resumeBundle).missionId),
    runId: cleanString(input.runId, 220),
    authorityRevision: Math.max(0, Math.round(Number(input.authorityRevision) || 0)),
    sourceRevision: 0,
    browserStateHash: null,
    trackerStateHash: null,
    driftFields: [],
    legacyDriftFields: [],
    eventTrace: [],
    observedAt: now()
  });
  };

  const observe = (rawInput = {}) => {
    const input = safeObject(rawInput);
    const resumeBundle = safeObject(input.resumeBundle);
    const browserEnvelope = safeObject(input.browserEnvelope || resumeBundle.execution);
    const replayBundle = safeObject(input.replayBundle || resumeBundle.executionReplay);
    const missionId = cleanString(input.missionId || resumeBundle.missionId);
    const runId = cleanString(input.runId, 220);
    const authorityRevision = Math.max(0, Math.round(Number(input.authorityRevision) || 0));
    if (!missionId || !resumeBundle.missionId) return unavailable(input, 'resume_bundle_missing');
    if (!browserEnvelope.schema) return unavailable(input, 'browser_shadow_envelope_missing');
    if (browserEnvelope.schema !== executionCore.SHADOW_SCHEMA || Number(browserEnvelope.version) !== executionCore.CORE_VERSION) {
      return unavailable(input, 'browser_shadow_envelope_incompatible');
    }
    if (cleanString(browserEnvelope.missionId) !== missionId) return unavailable(input, 'browser_shadow_mission_mismatch');
    const hasReplayBundle = replayBundle.schema === executionCore.BUNDLE_SCHEMA;
    const trackerEnvelope = hasReplayBundle
      ? executionCore.createReplayShadowEnvelope(replayBundle, {
        sourceRevision: Math.max(0, Math.round(Number(browserEnvelope.sourceRevision) || 0)),
        legacyBundle: browserEnvelope.legacyComparison === 'terminal_release' ? null : resumeBundle,
        legacyComparison: browserEnvelope.legacyComparison === 'terminal_release' ? 'terminal_release' : 'compared'
      })
      : executionCore.createShadowEnvelope(resumeBundle, {
        sourceRevision: Math.max(0, Math.round(Number(browserEnvelope.sourceRevision) || 0))
      });
    if (!trackerEnvelope) return unavailable(input, 'tracker_shadow_projection_failed');
    const parityDriftFields = compareEnvelope(browserEnvelope, trackerEnvelope);
    const legacyDriftFields = Array.isArray(trackerEnvelope.legacyDriftFields)
      ? trackerEnvelope.legacyDriftFields.map(field => cleanString(field, 100)).filter(Boolean)
      : [];
    const driftFields = parityDriftFields.concat(legacyDriftFields.map(field => `legacy:${field}`));
    const entry = {
      status: driftFields.length ? 'drift' : 'match',
      reason: parityDriftFields.length
        ? 'shadow_replay_drift'
        : (legacyDriftFields.length ? 'shadow_legacy_projection_drift' : 'shadow_replay_match'),
      mode: hasReplayBundle ? 'event-replay' : 'snapshot-shadow',
      recipe: cleanString(trackerEnvelope.recipe, 80).toLowerCase() || null,
      missionId,
      runId,
      authorityRevision,
      sourceRevision: Math.max(0, Math.round(Number(browserEnvelope.sourceRevision) || 0)),
      browserStateHash: cleanString(browserEnvelope.stateHash, 180) || null,
      trackerStateHash: cleanString(trackerEnvelope.stateHash, 180) || null,
      phase: cleanString(trackerEnvelope.phase, 80) || null,
      subphase: cleanString(trackerEnvelope.subphase, 80) || null,
      driftFields,
      legacyDriftFields,
      eventTrace: publicTrace(browserEnvelope.eventTrace),
      observedAt: now()
    };
    if (entry.status === 'drift') {
      log(`MISSION_SHADOW_DRIFT mission=${missionId} run=${runId || 'none'} authorityRevision=${authorityRevision} sourceRevision=${entry.sourceRevision} mode=${entry.mode} fields=${driftFields.join(',') || 'unknown'} browserHash=${entry.browserStateHash || 'none'} trackerHash=${entry.trackerStateHash || 'none'} trace=${entry.eventTrace.map(event => event.type).join('>') || 'snapshot'}`);
    } else {
      const previousKey = current ? `${current.missionId}:${current.runId}:${current.status}` : '';
      const nextKey = `${missionId}:${runId}:${entry.status}`;
      if (previousKey !== nextKey) {
        log(`MISSION_SHADOW_MATCH mission=${missionId} run=${runId || 'none'} authorityRevision=${authorityRevision} sourceRevision=${entry.sourceRevision} mode=${entry.mode} stateHash=${entry.trackerStateHash || 'none'}`);
      }
    }
    return remember(entry);
  };

  const observeAuthorityResult = (rawResult = {}, rawRun = null, source = 'authority-update') => {
    const result = safeObject(rawResult);
    const run = safeObject(rawRun);
    if (result.ok !== true || result.status !== 'ok' || !run.resumeBundle) return publicState();
    return observe({
      missionId: run.missionId,
      runId: run.runId,
      authorityRevision: run.revision,
      resumeBundle: run.resumeBundle,
      source
    });
  };

  function publicState() {
    if (!current) {
      return {
        schema: SHADOW_STATUS_SCHEMA,
        version: SHADOW_STATUS_VERSION,
        enabled: true,
        mode: 'snapshot-shadow',
        sideEffects: false,
        status: 'idle',
        comparisonCount: history.length
      };
    }
    return {
      schema: SHADOW_STATUS_SCHEMA,
      version: SHADOW_STATUS_VERSION,
      enabled: true,
      mode: current.mode || 'snapshot-shadow',
      sideEffects: false,
      status: current.status,
      reason: current.reason,
      recipe: current.recipe || null,
      missionId: current.missionId || null,
      runId: current.runId || null,
      authorityRevision: current.authorityRevision,
      sourceRevision: current.sourceRevision,
      phase: current.phase || null,
      subphase: current.subphase || null,
      browserStateHash: current.browserStateHash,
      trackerStateHash: current.trackerStateHash,
      driftFields: current.driftFields.slice(),
      legacyDriftFields: current.legacyDriftFields.slice(),
      eventTrace: current.eventTrace.slice(),
      observedAt: current.observedAt,
      comparisonCount: history.length
    };
  }

  return {
    observe,
    observeAuthorityResult,
    publicState,
    getHistory() {
      return history.map(entry => ({
        status: entry.status,
        reason: entry.reason,
        recipe: entry.recipe || null,
        missionId: entry.missionId,
        runId: entry.runId,
        authorityRevision: entry.authorityRevision,
        sourceRevision: entry.sourceRevision,
        browserStateHash: entry.browserStateHash,
        trackerStateHash: entry.trackerStateHash,
        driftFields: entry.driftFields.slice(),
        legacyDriftFields: entry.legacyDriftFields.slice(),
        eventTrace: entry.eventTrace.slice(),
        observedAt: entry.observedAt
      }));
    },
    clear() {
      current = null;
      history = [];
      return publicState();
    }
  };
}

module.exports = {
  SHADOW_STATUS_SCHEMA,
  SHADOW_STATUS_VERSION,
  COMPARED_FIELDS,
  compareEnvelope,
  createTrackerMissionShadow
};
