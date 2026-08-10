const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const STATE_SCHEMA = 'ga.mission-authority.v1';
const STATE_VERSION = 1;
const MAX_EVENTS = 120;
const MAX_EFFECTS = 160;
const MAX_RESUME_BYTES = 384 * 1024;

const TERMINAL_STATES = new Set(['ended', 'closed', 'reset', 'cleared', 'aborted', 'completed']);
const AUTHORITY_COMMANDS = new Set([
  'mission_authority_acquire',
  'mission_authority_takeover',
  'mission_authority_release',
  'mission_snapshot_request',
  'mission_snapshot_update'
]);

function cleanString(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

function jsonClone(value) {
  if (value == null) return null;
  return JSON.parse(JSON.stringify(value));
}

function safeResumeBundle(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  let cloned;
  try {
    cloned = jsonClone(value);
  } catch (_) {
    return null;
  }
  const bytes = Buffer.byteLength(JSON.stringify(cloned), 'utf8');
  if (bytes > MAX_RESUME_BYTES) {
    const error = new Error(`resume_bundle_too_large:${bytes}`);
    error.code = 'resume_bundle_too_large';
    throw error;
  }
  return cloned;
}

function publicEffect(effect = {}) {
  return {
    commandId: cleanString(effect.commandId, 220),
    type: cleanString(effect.type, 120),
    sceneId: cleanString(effect.sceneId, 220) || null,
    status: cleanString(effect.status, 60) || 'requested',
    requestedAt: Number(effect.requestedAt || 0) || null,
    completedAt: Number(effect.completedAt || 0) || null,
    error: cleanString(effect.error, 240) || null
  };
}

function effectAckSummary(ack = {}) {
  if (!ack || typeof ack !== 'object' || Array.isArray(ack)) return null;
  const numberOrNull = value => Number.isFinite(Number(value)) ? Number(value) : null;
  return {
    type: cleanString(ack.type, 140),
    commandId: cleanString(ack.commandId, 220),
    sceneId: cleanString(ack.sceneId, 220) || null,
    missionId: cleanString(ack.missionId) || null,
    status: cleanString(ack.status, 60) || 'ok',
    error: cleanString(ack.error, 240) || null,
    action: cleanString(ack.action, 80) || null,
    stage: cleanString(ack.stage, 80) || null,
    spawned: numberOrNull(ack.spawned),
    cleared: numberOrNull(ack.cleared),
    boarded: numberOrNull(ack.boarded),
    deboarded: numberOrNull(ack.deboarded),
    removed: numberOrNull(ack.removed),
    cargoRemoved: numberOrNull(ack.cargoRemoved),
    routeSent: ack.routeSent === true || ack.routeSent === 1,
    routeSentCount: numberOrNull(ack.routeSentCount),
    vehicleDeparture: ack.vehicleDeparture === true || ack.vehicleDeparture === 1,
    durationMs: numberOrNull(ack.durationMs)
  };
}

function publicRun(run, options = {}) {
  if (!run?.missionId || !run?.runId) return null;
  const result = {
    missionId: cleanString(run.missionId),
    runId: cleanString(run.runId, 220),
    ownerClientId: cleanString(run.ownerClientId, 220) || 'unknown',
    authority: 'tracker',
    state: cleanString(run.state, 60) || 'active',
    active: run.active !== false,
    phase: cleanString(run.phase, 100) || null,
    revision: Math.max(1, Math.round(Number(run.revision) || 1)),
    stateHash: cleanString(run.stateHash, 160) || null,
    acquiredAt: Number(run.acquiredAt || 0) || null,
    updatedAt: Number(run.updatedAt || 0) || null,
    lastCommandType: cleanString(run.lastCommandType, 140) || null,
    lastReason: cleanString(run.lastReason, 240) || null,
    lastSnapshotSequence: Math.max(0, Math.round(Number(run.lastSnapshotSequence) || 0)),
    effectCount: Array.isArray(run.effects) ? run.effects.length : 0,
    lastEffect: Array.isArray(run.effects) && run.effects.length ? publicEffect(run.effects[run.effects.length - 1]) : null
  };
  if (options.includeBundle === true) result.resumeBundle = jsonClone(run.resumeBundle);
  if (options.includeEffects === true) result.effects = (Array.isArray(run.effects) ? run.effects : []).slice(-40).map(publicEffect);
  return result;
}

function commandType(command = {}) {
  return cleanString(command.type || command.command, 140).toLowerCase();
}

function isMissionCommand(command = {}) {
  const type = commandType(command);
  return type === 'mission_lifecycle' || /^mission_(scene|smoke)_/.test(type);
}

function isLegacyCleanupCommand(command = {}) {
  const type = commandType(command);
  const state = cleanString(command.state, 60).toLowerCase();
  if (type === 'mission_lifecycle' && TERMINAL_STATES.has(state)) return true;
  return type === 'mission_scene_clear' || type === 'mission_scene_clear_all' || type === 'mission_smoke_clear';
}

function newState() {
  return {
    schema: STATE_SCHEMA,
    version: STATE_VERSION,
    activeRun: null,
    lastRun: null,
    events: []
  };
}

function normalizeStoredRun(run) {
  if (!run?.missionId || !run?.runId) return null;
  return {
    ...publicRun(run, { includeBundle: true }),
    effects: (Array.isArray(run.effects) ? run.effects : []).slice(-MAX_EFFECTS).map(effect => ({
      ...publicEffect(effect),
      managerSessionId: cleanString(effect.managerSessionId, 160),
      ack: effectAckSummary(effect.ack)
    }))
  };
}

function createMissionAuthorityManager(options = {}) {
  const storageFile = cleanString(options.storageFile, 2000);
  const io = options.fs || fs;
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const idFactory = typeof options.idFactory === 'function'
    ? options.idFactory
    : () => `run-${Date.now().toString(36)}-${crypto.randomBytes(7).toString('hex')}`;
  const managerSessionId = `tracker-${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}`;
  const log = typeof options.log === 'function' ? options.log : () => {};
  let state = newState();

  const addEvent = (kind, payload = {}) => {
    state.events.push({
      at: now(),
      kind: cleanString(kind, 100),
      missionId: cleanString(payload.missionId),
      runId: cleanString(payload.runId, 220),
      clientId: cleanString(payload.clientId, 220),
      commandId: cleanString(payload.commandId, 220),
      reason: cleanString(payload.reason, 240)
    });
    state.events = state.events.slice(-MAX_EVENTS);
  };

  const persist = () => {
    if (!storageFile) return true;
    try {
      const directory = path.dirname(storageFile);
      const temporaryFile = `${storageFile}.tmp`;
      io.mkdirSync(directory, { recursive: true });
      io.writeFileSync(temporaryFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
      io.renameSync(temporaryFile, storageFile);
      return true;
    } catch (error) {
      log(`MISSION_AUTHORITY_PERSIST_ERROR ${error?.message || error}`);
      return false;
    }
  };

  const load = () => {
    if (!storageFile || !io.existsSync(storageFile)) return;
    try {
      const parsed = JSON.parse(io.readFileSync(storageFile, 'utf8'));
      if (parsed?.schema !== STATE_SCHEMA || Number(parsed?.version) !== STATE_VERSION) return;
      state = {
        schema: STATE_SCHEMA,
        version: STATE_VERSION,
        activeRun: normalizeStoredRun(parsed.activeRun),
        lastRun: normalizeStoredRun(parsed.lastRun),
        events: Array.isArray(parsed.events) ? parsed.events.slice(-MAX_EVENTS) : []
      };
      log(`MISSION_AUTHORITY_LOADED active=${state.activeRun?.missionId || 'none'} run=${state.activeRun?.runId || 'none'}`);
    } catch (error) {
      log(`MISSION_AUTHORITY_LOAD_ERROR ${error?.message || error}`);
      state = newState();
    }
  };

  const activeMatches = (command = {}, options = {}) => {
    const active = state.activeRun;
    if (!active) return { ok: false, error: 'no_active_run' };
    const missionId = cleanString(command.missionId);
    const runId = cleanString(command.runId, 220);
    const clientId = cleanString(command.clientId, 220);
    if (missionId && missionId !== active.missionId) return { ok: false, error: 'mission_authority_conflict' };
    if (runId && runId !== active.runId) return { ok: false, error: 'mission_run_conflict' };
    if (options.requireOwner === true) {
      if (!runId || !clientId) return { ok: false, error: 'mission_authority_credentials_required' };
      if (clientId !== active.ownerClientId) return { ok: false, error: 'mission_authority_owner_mismatch' };
    }
    return { ok: true, activeRun: active };
  };

  const acquire = (request = {}) => {
    const missionId = cleanString(request.missionId);
    const clientId = cleanString(request.clientId, 220) || 'unknown-client';
    if (!missionId) return { ok: false, status: 'error', error: 'mission_id_required', activeRun: publicRun(state.activeRun) };
    if (state.activeRun) {
      const requestedRunId = cleanString(request.runId, 220);
      const sameRun = state.activeRun.missionId === missionId
        && (!requestedRunId || requestedRunId === state.activeRun.runId);
      const sameOwner = state.activeRun.ownerClientId === clientId;
      if (sameRun && sameOwner) {
        state.activeRun.updatedAt = now();
        addEvent('acquire_resume', { missionId, runId: state.activeRun.runId, clientId, commandId: request.commandId });
        persist();
        return {
          ok: true,
          status: 'ok',
          resumed: true,
          activeRun: publicRun(state.activeRun)
        };
      }
      addEvent('acquire_conflict', { missionId, runId: requestedRunId, clientId, commandId: request.commandId });
      persist();
      return { ok: false, status: 'conflict', error: 'mission_authority_conflict', activeRun: publicRun(state.activeRun) };
    }
    const timestamp = now();
    const runId = cleanString(request.runId, 220) || idFactory();
    state.activeRun = {
      missionId,
      runId,
      ownerClientId: clientId,
      authority: 'tracker',
      state: cleanString(request.state, 60).toLowerCase() || 'active',
      active: true,
      phase: cleanString(request.phase || request.missionPhase, 100).toLowerCase() || 'planned',
      revision: 1,
      stateHash: cleanString(request.stateHash, 160) || null,
      acquiredAt: timestamp,
      updatedAt: timestamp,
      lastCommandType: 'mission_authority_acquire',
      lastReason: cleanString(request.reason, 240) || 'mission-start',
      lastSnapshotSequence: 0,
      resumeBundle: safeResumeBundle(request.resumeBundle),
      effects: []
    };
    addEvent('acquired', { missionId, runId, clientId, commandId: request.commandId, reason: request.reason });
    persist();
    return {
      ok: true,
      status: 'ok',
      resumed: false,
      activeRun: publicRun(state.activeRun)
    };
  };

  const takeover = (request = {}) => {
    const active = state.activeRun;
    if (!active) return { ok: false, status: 'error', error: 'no_active_run', activeRun: null };
    const missionId = cleanString(request.missionId);
    const runId = cleanString(request.runId, 220);
    const clientId = cleanString(request.clientId, 220);
    const expectedRevision = Math.max(0, Math.round(Number(request.expectedRevision) || 0));
    if (!clientId) return { ok: false, status: 'error', error: 'client_id_required', activeRun: publicRun(active) };
    if (missionId !== active.missionId || runId !== active.runId) {
      return { ok: false, status: 'conflict', error: 'mission_run_conflict', activeRun: publicRun(active) };
    }
    if (expectedRevision && expectedRevision !== active.revision) {
      return { ok: false, status: 'conflict', error: 'mission_revision_conflict', activeRun: publicRun(active) };
    }
    const previousOwner = active.ownerClientId;
    active.ownerClientId = clientId;
    active.revision += 1;
    active.updatedAt = now();
    active.lastCommandType = 'mission_authority_takeover';
    active.lastReason = cleanString(request.reason, 240) || 'device-handoff';
    addEvent('takeover', { missionId, runId, clientId, commandId: request.commandId, reason: `from:${previousOwner}` });
    persist();
    return {
      ok: true,
      status: 'ok',
      previousOwnerClientId: previousOwner,
      activeRun: publicRun(active)
    };
  };

  const validate = (command = {}) => {
    const type = commandType(command);
    if (AUTHORITY_COMMANDS.has(type)) return { ok: true, protocol: true, activeRun: publicRun(state.activeRun) };
    if (!isMissionCommand(command)) return { ok: true, missionScoped: false, activeRun: publicRun(state.activeRun) };
    if (!state.activeRun) {
      if (isLegacyCleanupCommand(command)) return { ok: true, legacyCleanup: true, activeRun: null };
      if (command.runId) return { ok: false, status: 'conflict', error: 'no_active_run', activeRun: null };
      const implicit = acquire({
        missionId: command.missionId,
        clientId: cleanString(command.clientId, 220) || 'legacy-client',
        state: command.state || 'active',
        phase: command.missionPhase || 'prepare',
        commandId: command.commandId,
        reason: 'legacy-implicit-acquire'
      });
      return implicit.ok
        ? { ok: true, legacyImplicit: true, activeRun: implicit.activeRun }
        : { ok: false, status: implicit.status, error: implicit.error, activeRun: implicit.activeRun };
    }
    const missionId = cleanString(command.missionId);
    if (!missionId || missionId !== state.activeRun.missionId) {
      return { ok: false, status: 'conflict', error: 'mission_authority_conflict', activeRun: publicRun(state.activeRun) };
    }
    const hasAuthorityEnvelope = Boolean(command.runId || command.clientId);
    if (!hasAuthorityEnvelope) {
      if (state.activeRun.ownerClientId === 'legacy-client') {
        return { ok: true, legacy: true, activeRun: publicRun(state.activeRun) };
      }
      return { ok: false, status: 'conflict', error: 'mission_authority_owned_by_versioned_client', activeRun: publicRun(state.activeRun) };
    }
    if (!command.runId && cleanString(command.clientId, 220) === state.activeRun.ownerClientId) {
      return { ok: true, ownerRebind: true, activeRun: publicRun(state.activeRun) };
    }
    const match = activeMatches(command, { requireOwner: true });
    if (!match.ok) return { ok: false, status: 'conflict', error: match.error, activeRun: publicRun(state.activeRun) };
    const commandId = cleanString(command.commandId, 220);
    const duplicateEffect = commandId && /^mission_(scene|smoke)_/.test(type)
      ? match.activeRun.effects.find(effect => effect.commandId === commandId)
      : null;
    if (duplicateEffect) {
      if (!duplicateEffect.completedAt && duplicateEffect.managerSessionId !== managerSessionId) {
        return { ok: true, effectRetry: true, activeRun: publicRun(match.activeRun) };
      }
      return {
        ok: false,
        status: cleanString(duplicateEffect.ack?.status || duplicateEffect.status, 60) || 'noop',
        error: cleanString(duplicateEffect.ack?.error || duplicateEffect.error, 240),
        duplicate: true,
        effect: publicEffect(duplicateEffect),
        replayAck: effectAckSummary(duplicateEffect.ack),
        activeRun: publicRun(match.activeRun)
      };
    }
    return { ok: true, activeRun: publicRun(match.activeRun) };
  };

  const updateSnapshot = (request = {}) => {
    const match = activeMatches(request, { requireOwner: true });
    if (!match.ok) return { ok: false, status: 'conflict', error: match.error, activeRun: publicRun(state.activeRun) };
    const active = match.activeRun;
    const snapshotSequence = Math.max(0, Math.round(Number(request.snapshotSequence) || 0));
    if (snapshotSequence && snapshotSequence <= active.lastSnapshotSequence) {
      return { ok: true, status: 'noop', reason: 'stale_snapshot', activeRun: publicRun(active) };
    }
    let resumeBundle;
    try {
      resumeBundle = safeResumeBundle(request.resumeBundle);
    } catch (error) {
      return { ok: false, status: 'error', error: error.code || error.message, activeRun: publicRun(active) };
    }
    if (resumeBundle) active.resumeBundle = resumeBundle;
    if (snapshotSequence) active.lastSnapshotSequence = snapshotSequence;
    active.state = cleanString(request.state, 60).toLowerCase() || active.state;
    active.phase = cleanString(request.phase || request.missionPhase, 100).toLowerCase() || active.phase;
    active.stateHash = cleanString(request.stateHash, 160) || active.stateHash;
    active.revision += 1;
    active.updatedAt = now();
    active.lastCommandType = 'mission_snapshot_update';
    active.lastReason = cleanString(request.reason, 240) || 'runtime-snapshot';
    addEvent('snapshot', { missionId: active.missionId, runId: active.runId, clientId: active.ownerClientId, commandId: request.commandId });
    persist();
    return { ok: true, status: 'ok', activeRun: publicRun(active) };
  };

  const requestSnapshot = (request = {}) => {
    const active = state.activeRun;
    if (!active) return { ok: false, status: 'noop', error: 'no_active_run', activeRun: null, resumeBundle: null };
    const missionId = cleanString(request.missionId);
    const runId = cleanString(request.runId, 220);
    if ((missionId && missionId !== active.missionId) || (runId && runId !== active.runId)) {
      return { ok: false, status: 'conflict', error: 'mission_run_conflict', activeRun: publicRun(active), resumeBundle: null };
    }
    return { ok: true, status: active.resumeBundle ? 'ok' : 'noop', activeRun: publicRun(active), resumeBundle: jsonClone(active.resumeBundle) };
  };

  const release = (request = {}) => {
    const match = activeMatches(request, { requireOwner: true });
    if (!match.ok) return { ok: false, status: 'conflict', error: match.error, activeRun: publicRun(state.activeRun) };
    const active = match.activeRun;
    const outcome = cleanString(request.outcome || request.state, 60).toLowerCase() || 'aborted';
    active.active = false;
    active.state = outcome === 'completed' ? 'completed' : 'ended';
    active.phase = 'closed';
    active.revision += 1;
    active.updatedAt = now();
    active.lastCommandType = 'mission_authority_release';
    active.lastReason = cleanString(request.reason, 240) || outcome;
    state.lastRun = normalizeStoredRun(active);
    state.activeRun = null;
    addEvent('released', { missionId: active.missionId, runId: active.runId, clientId: active.ownerClientId, commandId: request.commandId, reason: outcome });
    persist();
    return { ok: true, status: 'ok', outcome, releasedRun: publicRun(state.lastRun), activeRun: null };
  };

  const releaseLegacy = (request = {}) => {
    const active = state.activeRun;
    const missionId = cleanString(request.missionId);
    if (!active) return { ok: true, status: 'noop', outcome: 'ended', activeRun: null };
    if (!missionId || missionId !== active.missionId) {
      return { ok: false, status: 'conflict', error: 'mission_authority_conflict', activeRun: publicRun(active) };
    }
    active.active = false;
    active.state = 'ended';
    active.phase = 'closed';
    active.revision += 1;
    active.updatedAt = now();
    active.lastCommandType = 'mission_lifecycle';
    active.lastReason = cleanString(request.reason, 240) || 'legacy-terminal-lifecycle';
    state.lastRun = normalizeStoredRun(active);
    state.activeRun = null;
    addEvent('released_legacy', { missionId, runId: active.runId, clientId: active.ownerClientId, commandId: request.commandId, reason: request.state });
    persist();
    return { ok: true, status: 'ok', outcome: cleanString(request.state, 60) || 'ended', releasedRun: publicRun(state.lastRun), activeRun: null };
  };

  const recordCommand = (command = {}) => {
    const active = state.activeRun;
    if (!active || cleanString(command.missionId) !== active.missionId) return publicRun(active);
    const type = commandType(command);
    const stateValue = cleanString(command.state, 60).toLowerCase();
    const phase = cleanString(command.missionPhase, 100).toLowerCase();
    if (stateValue && !TERMINAL_STATES.has(stateValue)) active.state = stateValue;
    if (phase) active.phase = phase;
    active.lastCommandType = type || active.lastCommandType;
    active.lastReason = cleanString(command.reason, 240) || active.lastReason;
    active.revision += 1;
    active.updatedAt = now();
    const commandId = cleanString(command.commandId, 220);
    if (commandId && /^mission_(scene|smoke)_/.test(type)) {
      const exists = active.effects.some(effect => effect.commandId === commandId);
      if (!exists) {
        active.effects.push({
          commandId,
          type,
          sceneId: cleanString(command.sceneId, 220) || null,
          status: 'requested',
          requestedAt: now(),
          completedAt: null,
          error: null,
          managerSessionId,
          ack: null
        });
        active.effects = active.effects.slice(-MAX_EFFECTS);
      } else {
        const existing = active.effects.find(effect => effect.commandId === commandId);
        if (existing && !existing.completedAt && existing.managerSessionId !== managerSessionId) {
          existing.status = 'requested';
          existing.requestedAt = now();
          existing.completedAt = null;
          existing.error = null;
          existing.managerSessionId = managerSessionId;
          existing.ack = null;
        }
      }
    }
    persist();
    return publicRun(active);
  };

  const recordEffectAck = (ack = {}) => {
    const active = state.activeRun;
    const commandId = cleanString(ack.commandId, 220);
    if (!active || !commandId) return false;
    const effect = active.effects.find(item => item.commandId === commandId);
    if (!effect) return false;
    const expectedAckType = effect.type === 'mission_scene_clear_all'
      ? 'mission_scene_clear_ack'
      : `${effect.type}_ack`;
    if (cleanString(ack.type, 140).toLowerCase() !== expectedAckType) return false;
    effect.status = cleanString(ack.status, 60) || 'ok';
    effect.error = cleanString(ack.error, 240) || null;
    effect.completedAt = now();
    effect.ack = effectAckSummary(ack);
    active.updatedAt = now();
    persist();
    return true;
  };

  load();

  return {
    acquire,
    takeover,
    validate,
    updateSnapshot,
    requestSnapshot,
    release,
    releaseLegacy,
    recordCommand,
    recordEffectAck,
    getPublicSnapshot(options = {}) {
      return {
        schema: STATE_SCHEMA,
        version: STATE_VERSION,
        activeRun: publicRun(state.activeRun, { includeBundle: options.includeBundle === true }),
        lastRun: publicRun(state.lastRun, { includeBundle: options.includeBundle === true }),
        updatedAt: Number(state.activeRun?.updatedAt || state.lastRun?.updatedAt || 0) || null
      };
    },
    getActiveRun(options = {}) {
      return publicRun(state.activeRun, {
        includeBundle: options.includeBundle === true,
        includeEffects: options.includeEffects === true
      });
    },
    isAuthorityCommand(command = {}) {
      return AUTHORITY_COMMANDS.has(commandType(command));
    }
  };
}

module.exports = {
  STATE_SCHEMA,
  STATE_VERSION,
  createMissionAuthorityManager,
  isMissionCommand
};
