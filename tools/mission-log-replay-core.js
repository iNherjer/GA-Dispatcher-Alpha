'use strict';

const executionCore = require('../mission-execution-core.js');
const complianceCore = require('../mission-compliance-domain-core.js');
const uiCore = require('../mission-apt-ui-core.js');

const CHECKPOINT_PREFIX = /^(?:(?:APT|MISSION)_TEST_SYSTEM\s+)?MISSION_EXECUTION_CHECKPOINT\s+/;
const BEGIN_PREFIX = /^(?:APT_TEST_BEGIN|MISSION_TEST_BEGIN)\s+/;
const END_PREFIX = /^(?:APT_TEST_END|MISSION_TEST_END)\s+/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseFields(line) {
  const result = {};
  const pattern = /([A-Za-z][A-Za-z0-9_]*)=([^\s]+)/g;
  let match;
  while ((match = pattern.exec(String(line || '')))) result[match[1]] = match[2];
  return result;
}

function parseLine(rawLine, lineNumber) {
  const raw = String(rawLine || '').trim();
  const match = raw.match(/^\[([^\]]+)]\s+(.+)$/);
  if (!match) return null;
  const at = Date.parse(match[1]);
  if (!Number.isFinite(at)) return null;
  return { at, text: match[2], lineNumber };
}

function runKey(missionId, runId) {
  return `${missionId || 'unknown-mission'}:${runId || 'unknown-run'}`;
}

function parseMissionTestLog(source) {
  const runs = new Map();
  const sessions = [];
  const lines = String(source || '').split(/\r?\n/);

  function ensureRun(fields, at) {
    const missionId = fields.mission || 'unknown-mission';
    const runId = fields.run || 'unknown-run';
    const key = runKey(missionId, runId);
    if (!runs.has(key)) {
      runs.set(key, {
        key,
        missionId,
        runId,
        recipe: fields.recipe || 'unknown',
        mode: fields.mode || 'unknown',
        beganAt: at,
        endedAt: null,
        completion: null,
        checkpoints: []
      });
    }
    return runs.get(key);
  }

  lines.forEach((rawLine, index) => {
    const parsed = parseLine(rawLine, index + 1);
    if (!parsed) return;
    if (/(?:APT_TEST_SESSION_START|MISSION_TEST_SESSION_START)\b/.test(parsed.text)) {
      sessions.push({ at: parsed.at, lineNumber: parsed.lineNumber, ...parseFields(parsed.text) });
      return;
    }
    if (BEGIN_PREFIX.test(parsed.text)) {
      const fields = parseFields(parsed.text);
      const run = ensureRun(fields, parsed.at);
      run.recipe = fields.recipe || run.recipe;
      run.mode = fields.mode || run.mode;
      run.beganAt = Math.min(run.beganAt || parsed.at, parsed.at);
      return;
    }
    if (CHECKPOINT_PREFIX.test(parsed.text)) {
      const fields = parseFields(parsed.text);
      const run = ensureRun(fields, parsed.at);
      run.checkpoints.push({
        at: parsed.at,
        lineNumber: parsed.lineNumber,
        reason: fields.reason || 'unknown',
        phase: fields.phase || 'unknown',
        authorityRevision: Number(fields.authorityRevision || 0),
        executionRevision: Number(fields.executionRevision || 0),
        stateHash: fields.stateHash || 'none',
        effectsRequested: Number(fields.effectsRequested || 0),
        effectsCompleted: Number(fields.effectsCompleted || 0),
        effectsFailed: Number(fields.effectsFailed || 0)
      });
      return;
    }
    if (END_PREFIX.test(parsed.text)) {
      const fields = parseFields(parsed.text);
      const run = ensureRun(fields, parsed.at);
      run.endedAt = parsed.at;
      run.completion = fields.completion || 'unknown';
    }
  });

  const normalizedRuns = [...runs.values()].map(run => ({
    ...run,
    checkpoints: run.checkpoints.sort((left, right) => left.at - right.at || left.lineNumber - right.lineNumber)
  })).sort((left, right) => (left.beganAt || 0) - (right.beganAt || 0));
  return { sessions, runs: normalizedRuns, lineCount: lines.length };
}

function selectReplayRun(parsed, options = {}) {
  const runs = Array.isArray(parsed?.runs) ? parsed.runs : [];
  const requestedRunId = String(options.runId || '').trim();
  const candidates = runs.filter(run => run.checkpoints.length > 0
    && (!requestedRunId || run.runId === requestedRunId));
  return candidates[candidates.length - 1] || null;
}

function checkpoint(run, reason, last = false) {
  const matches = (run?.checkpoints || []).filter(entry => entry.reason === reason);
  return last ? matches[matches.length - 1] || null : matches[0] || null;
}

function analyzeRun(run) {
  if (!run) return null;
  const requiredReasons = [
    'intent:prepare_mission',
    'intent:start_mission',
    'telemetry:AIRBORNE',
    'telemetry:TOUCHDOWN',
    'telemetry:GROUND_STILL',
    'intent:set_manifest_item',
    'intent:confirm_unload',
    'intent:request_close'
  ];
  const missingReasons = requiredReasons.filter(reason => !checkpoint(run, reason));
  const revisionRegressions = [];
  for (let index = 1; index < run.checkpoints.length; index += 1) {
    const previous = run.checkpoints[index - 1];
    const current = run.checkpoints[index];
    if (current.authorityRevision < previous.authorityRevision
        || current.executionRevision < previous.executionRevision) {
      revisionRegressions.push({ previous, current });
    }
  }
  const first = run.checkpoints[0] || null;
  const last = run.checkpoints[run.checkpoints.length - 1] || null;
  return {
    missionId: run.missionId,
    runId: run.runId,
    recipe: run.recipe,
    mode: run.mode,
    checkpointCount: run.checkpoints.length,
    beganAt: run.beganAt || first?.at || null,
    lastAt: last?.at || null,
    durationMs: first && last ? Math.max(0, last.at - first.at) : 0,
    firstPhase: first?.phase || 'unknown',
    lastPhase: last?.phase || 'unknown',
    missingReasons,
    revisionRegressions,
    recordedCompliance: run.checkpoints.some(entry => /compliance/i.test(entry.reason)),
    recordedTerminal: last?.phase === 'closed' || Boolean(run.endedAt),
    maximumPendingEffects: run.checkpoints.reduce((max, entry) => Math.max(max, entry.effectsRequested), 0),
    failedEffects: run.checkpoints.reduce((max, entry) => Math.max(max, entry.effectsFailed), 0)
  };
}

function simulateComplianceReplay(run) {
  const analysis = analyzeRun(run);
  if (!analysis) throw new Error('mission_log_replay_run_required');
  const sourceStart = checkpoint(run, 'intent:start_mission')?.at || analysis.beganAt || Date.now();
  const sourceTouchdown = checkpoint(run, 'telemetry:TOUCHDOWN')?.at || sourceStart + 60000;
  const sourceGroundStill = checkpoint(run, 'telemetry:GROUND_STILL')?.at || sourceTouchdown + 5000;
  const sourceCargo = checkpoint(run, 'intent:set_manifest_item', true)?.at || sourceGroundStill + 30000;
  const sourceUnload = checkpoint(run, 'intent:confirm_unload', true)?.at || sourceCargo + 30000;
  const sourceClose = checkpoint(run, 'intent:request_close', true)?.at || sourceUnload + 10000;
  const flightId = `log-replay-${run.runId}|${sourceStart}`;
  const loadedManifest = {
    version: 6,
    key: `manifest-log-replay-${run.runId}`,
    aircraftSlot: 'LOG-REPLAY',
    flightEvents: { flightId, startAt: sourceStart, landingAt: sourceTouchdown },
    dispatchSignature: { scope: 'departure', by: 'Log-Replay', at: sourceStart },
    items: [
      {
        id: 'recorded-main-cargo', storyName: 'Aufgezeichnetes Missionsgut', itemType: 'cargo',
        required: true, status: 'loaded', weightLbs: 42, deliverAtDestination: true
      },
      {
        id: 'bordbuch', label: 'Bordbuch', itemType: 'cargo', status: 'loaded',
        persistentEquipment: true, deliverAtDestination: false,
        log: { flightId, startAt: sourceStart, landingAt: sourceTouchdown }
      },
      {
        id: 'fire-extinguisher', label: 'Feuerloescher', itemType: 'cargo', status: 'loaded',
        persistentEquipment: true, deliverAtDestination: false, equipmentType: 'expiry',
        expiresAt: '2099-12-31', serialId: 'LOG-FIRE-1'
      },
      {
        id: 'first-aid', label: 'Verbandzeug', itemType: 'cargo', status: 'loaded',
        persistentEquipment: true, deliverAtDestination: false, equipmentType: 'expiry',
        expiresAt: '2099-12-31', serialId: 'LOG-FIRST-1'
      }
    ]
  };
  const initialState = executionCore.normalizeState({
    missionId: `log-replay-${run.missionId}`,
    recipe: 'apt',
    phase: 'enroute',
    subphase: 'outbound_flight',
    flags: { started: true, active: true, onGround: false },
    progress: { airborneSeen: true },
    manifest: loadedManifest,
    flightEvents: loadedManifest.flightEvents
  });
  let state = initialState;
  let sequence = 0;
  let lastAt = Math.max(0, sourceTouchdown - 1);
  const events = [];
  const trace = [];
  const effectDispatches = [];
  const uiChecks = [];
  let restartChecks = 0;
  let duplicateChecks = 0;

  function monotonicAt(value) {
    lastAt = Math.max(lastAt + 1, Math.round(Number(value) || 0));
    return lastAt;
  }

  function uiProjection() {
    const view = executionCore.deriveView(state);
    const source = {
      control: {
        ...view,
        missionId: state.missionId,
        executionAuthority: 'tracker',
        authorityRevision: state.revision,
        flags: clone(state.flags),
        workflows: clone(state.workflows),
        cargo: clone(state.cargo)
      },
      manifest: clone(state.manifest)
    };
    const appProjection = uiCore.project(source);
    const efbProjection = uiCore.project(clone(source));
    const equal = executionCore.canonicalStringify(appProjection) === executionCore.canonicalStringify(efbProjection);
    uiChecks.push({ revision: state.revision, phase: state.phase, compliancePhase: state.workflows.complianceInspection.phase, equal });
    return equal;
  }

  function apply(type, payload, at, label = '') {
    const event = {
      eventId: `log-replay-${sequence + 1}-${String(type).toLowerCase()}`,
      type,
      sequence: sequence + 1,
      occurredAt: monotonicAt(at),
      payload: payload || {}
    };
    const beforeHash = executionCore.stateHash(state);
    const next = executionCore.reduce(state, event);
    if (executionCore.stateHash(next) === beforeHash) {
      throw new Error(`mission_log_replay_transition_blocked:${type}:${state.phase}:${state.workflows.complianceInspection.phase}`);
    }
    state = next;
    sequence += 1;
    events.push(event);
    const onceHash = executionCore.stateHash(state);
    const duplicate = executionCore.reduce(state, event);
    if (executionCore.stateHash(duplicate) !== onceHash) throw new Error(`mission_log_replay_duplicate_drift:${type}`);
    duplicateChecks += 1;
    const restored = executionCore.deserializeState(executionCore.serializeState(state));
    if (!restored || executionCore.stateHash(restored) !== onceHash) throw new Error(`mission_log_replay_restart_drift:${type}`);
    state = restored;
    restartChecks += 1;
    if (!uiProjection()) throw new Error(`mission_log_replay_ui_drift:${type}`);
    trace.push({
      sequence,
      type,
      label: label || type,
      at: event.occurredAt,
      phase: state.phase,
      subphase: state.subphase,
      compliancePhase: state.workflows.complianceInspection.phase,
      stateHash: executionCore.stateHash(state)
    });
    return state;
  }

  function pendingEffect(type) {
    return state.effects.find(effect => effect.type === type && effect.status === 'requested') || null;
  }

  function completeEffect(type, at, followUpType = '', followUpPayload = {}) {
    const effect = pendingEffect(type);
    if (!effect) throw new Error(`mission_log_replay_effect_missing:${type}`);
    effectDispatches.push({ type, effectId: effect.effectId, at: Math.round(Number(at) || lastAt + 1) });
    if (followUpType) apply(followUpType, followUpPayload, at, `${type}:follow-up`);
    apply('EFFECT_ACKNOWLEDGED', {
      effectId: effect.effectId,
      status: 'completed'
    }, Number(at) + 1, `${type}:ack`);
  }

  apply('TOUCHDOWN', {}, sourceTouchdown, 'recorded:telemetry:TOUCHDOWN');
  apply('GROUND_STILL', {
    atDestination: true,
    complianceRoll: 0.5,
    complianceForced: true
  }, sourceGroundStill, 'recorded:telemetry:GROUND_STILL+synthetic:force-compliance');
  apply('COMPLIANCE_INSPECTORS_WAITING', {}, Math.min(sourceCargo - 1, sourceGroundStill + 15000), 'synthetic:visitors-at-aircraft');

  const arrivalManifest = clone(loadedManifest);
  arrivalManifest.dispatchSignature = { scope: 'arrival', by: 'Log-Replay', at: sourceUnload };
  arrivalManifest.items.find(item => item.id === 'recorded-main-cargo').status = 'unloaded';
  apply('CARGO_STATE_CHANGED', { manifest: arrivalManifest }, sourceCargo, 'recorded:intent:set_manifest_item');
  apply('UNLOAD_CONFIRMED', { manifest: arrivalManifest }, sourceUnload, 'recorded:intent:confirm_unload');
  completeEffect('cargo.unload_confirmed', sourceUnload + 1);
  apply('CLOSE_REQUESTED', { manifest: arrivalManifest }, sourceClose, 'recorded:intent:request_close');
  completeEffect('voice.farewell', sourceClose + 12000, 'FAREWELL_COMPLETED');
  completeEffect('voice.compliance_request', sourceClose + 20000, 'COMPLIANCE_REQUEST_COMPLETED');

  const evidenceManifest = clone(arrivalManifest);
  evidenceManifest.items.forEach(item => {
    if (['bordbuch', 'fire-extinguisher', 'first-aid'].includes(item.id)) item.status = 'unloaded';
  });
  apply('CARGO_STATE_CHANGED', { manifest: evidenceManifest }, sourceClose + 23000, 'synthetic:present-compliance-items');
  const evidence = complianceCore.evaluateEvidence(state.workflows.complianceInspection, state.manifest, {
    now: sourceClose + 24000
  });
  if (!evidence.ready || evidence.blockingUnload.length || evidence.missingLogFields.length) {
    throw new Error('mission_log_replay_evidence_not_ready');
  }
  const result = complianceCore.completeEvidenceResult(evidence, sourceClose + 24000);
  const resultText = complianceCore.resultVoiceText(result);
  apply('COMPLIANCE_EVENT', {
    action: 'evidence_complete',
    state: {
      ...state.workflows.complianceInspection,
      revision: state.workflows.complianceInspection.revision + 1,
      phase: 'result_playing',
      result,
      resultText,
      remediation: { required: false, missingFields: [] }
    }
  }, sourceClose + 24000, 'synthetic:submit-compliance-evidence');
  completeEffect('voice.compliance_result', sourceClose + 32000, 'COMPLIANCE_RESULT_COMPLETED');
  completeEffect('scene.compliance_departure', sourceClose + 34000);
  completeEffect('scene.compliance_visit', sourceClose + 37000, 'COMPLIANCE_RELEASED');
  completeEffect('mission.close_requested', sourceClose + 38000, 'MISSION_CLOSED');

  const replay = executionCore.replay({
    schema: executionCore.BUNDLE_SCHEMA,
    version: executionCore.CORE_VERSION,
    missionId: initialState.missionId,
    recipe: 'apt',
    initialState,
    events
  });
  const finalHash = executionCore.stateHash(state);
  if (!replay.ok || replay.stateHash !== finalHash) throw new Error('mission_log_replay_bundle_drift');
  const requestedEffects = state.effects.filter(effect => effect.status === 'requested');
  if (state.phase !== 'closed' || requestedEffects.length) throw new Error('mission_log_replay_not_closed');

  return {
    schema: 'ga.mission-log-replay-report.v1',
    source: analysis,
    simulation: {
      scope: 'current-standard-apt-compliance-tail',
      fixture: 'canonical-apt-cargo-plus-onboard-equipment',
      complianceSelection: 'synthetic-force',
      sideEffects: 'dry-run',
      finalPhase: state.phase,
      finalCompliancePhase: state.workflows.complianceInspection.phase,
      finalStateHash: finalHash,
      eventCount: events.length,
      restartChecks,
      duplicateChecks,
      uiChecks: uiChecks.length,
      uiParity: uiChecks.every(entry => entry.equal),
      requestedEffects: requestedEffects.length,
      resultText,
      effectDispatches,
      trace
    },
    limitations: [
      'source_log_contains_checkpoint_summaries_not_full_manifest_payloads',
      'canonical_fixture_replaces_unrecorded_manifest_and_position_payloads',
      analysis.recordedCompliance ? null : 'compliance_branch_is_synthetic_force',
      analysis.recordedTerminal ? null : 'source_recording_ends_before_terminal_close'
    ].filter(Boolean)
  };
}

module.exports = {
  parseFields,
  parseMissionTestLog,
  selectReplayRun,
  analyzeRun,
  simulateComplianceReplay
};
