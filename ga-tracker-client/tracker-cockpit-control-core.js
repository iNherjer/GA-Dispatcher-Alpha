'use strict';

const crypto = require('node:crypto');
const { normalizeCapabilities } = require('./tracker-efb-protocol-core');

const DEFAULT_SESSION_TTL_MS = 45000;
const DEFAULT_COMMAND_TTL_MS = 10 * 60 * 1000;
const MAX_SESSIONS = 32;
const MAX_COMMAND_RESULTS = 256;
const MAX_INTENTS_PER_MINUTE = 60;
const COCKPIT_ROLES = new Set(['web', 'efb', 'toolbar']);
const MISSION_INTENTS = new Set([
  'activate_cloud_mission',
  'prepare_mission',
  'set_manifest_item',
  'sign_manifest',
  'confirm_load',
  'start_mission',
  'confirm_pickup',
  'confirm_unload',
  'request_pax_interaction',
  'request_voice_playback',
  'submit_compliance_evidence',
  'request_close',
  'abort_mission',
  'reset_mission'
]);

function cleanString(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function publicRun(value) {
  const run = safeObject(value);
  if (!cleanString(run.missionId) || !cleanString(run.runId, 220)) return null;
  return {
    missionId: cleanString(run.missionId),
    runId: cleanString(run.runId, 220),
    authority: cleanString(run.authority, 40) || 'tracker',
    state: cleanString(run.state, 60) || null,
    phase: cleanString(run.phase, 100) || null,
    revision: Math.max(0, Math.round(Number(run.revision) || 0)),
    stateHash: cleanString(run.stateHash, 160) || null,
    updatedAt: Number(run.updatedAt || 0) || null
  };
}

function publicSession(session) {
  if (!session) return null;
  return {
    sessionId: session.sessionId,
    clientId: session.clientId,
    role: session.role,
    appVersion: session.appVersion || null,
    capabilities: session.capabilities.slice(),
    audioPlaybackEnabled: session.audioPlaybackEnabled === true,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    expiresAt: session.expiresAt
  };
}

function resultError(error, details = {}) {
  return { ok: false, status: 'error', error, ...details };
}

function createTrackerCockpitControl(options = {}) {
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const sessionTtlMs = Math.max(15000, Math.min(5 * 60 * 1000, Number(options.sessionTtlMs) || DEFAULT_SESSION_TTL_MS));
  const commandTtlMs = Math.max(sessionTtlMs, Number(options.commandTtlMs) || DEFAULT_COMMAND_TTL_MS);
  const idFactory = typeof options.idFactory === 'function'
    ? options.idFactory
    : prefix => `${prefix}-${crypto.randomBytes(18).toString('base64url')}`;
  const tokenFactory = typeof options.tokenFactory === 'function'
    ? options.tokenFactory
    : () => crypto.randomBytes(32).toString('base64url');
  const getMissionRun = typeof options.getMissionRun === 'function' ? options.getMissionRun : () => null;
  const executeIntent = typeof options.executeIntent === 'function' ? options.executeIntent : null;
  const activateMission = typeof options.activateMission === 'function' ? options.activateMission : null;
  const configuredExecutionAuthority = cleanString(options.executionAuthority, 40) || (executeIntent ? 'tracker' : 'web');
  const getExecutionAuthority = typeof options.getExecutionAuthority === 'function'
    ? options.getExecutionAuthority
    : () => configuredExecutionAuthority;
  const executionAuthority = () => cleanString(getExecutionAuthority(), 40) || configuredExecutionAuthority;
  const sessions = new Map();
  const commandResults = new Map();

  const cleanup = () => {
    const timestamp = now();
    for (const [sessionId, session] of sessions) {
      if (session.expiresAt <= timestamp) sessions.delete(sessionId);
    }
    for (const [key, record] of commandResults) {
      if (record.expiresAt <= timestamp) commandResults.delete(key);
    }
    while (commandResults.size > MAX_COMMAND_RESULTS) commandResults.delete(commandResults.keys().next().value);
  };

  const authenticate = (request = {}) => {
    cleanup();
    const sessionId = cleanString(request.sessionId, 220);
    const token = cleanString(request.sessionToken, 320);
    const session = sessions.get(sessionId);
    if (!session || !token) return resultError('cockpit_session_required');
    const left = Buffer.from(session.token);
    const right = Buffer.from(token);
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return resultError('cockpit_session_invalid');
    session.lastSeenAt = now();
    session.expiresAt = session.lastSeenAt + sessionTtlMs;
    return { ok: true, session };
  };

  const register = (request = {}) => {
    cleanup();
    const clientId = cleanString(request.clientId, 220);
    const role = cleanString(request.role, 24).toLowerCase();
    if (!clientId) return resultError('client_id_required');
    if (!COCKPIT_ROLES.has(role)) return resultError('cockpit_role_invalid');
    for (const [sessionId, session] of sessions) {
      if (session.clientId === clientId) sessions.delete(sessionId);
    }
    if (sessions.size >= MAX_SESSIONS) return resultError('cockpit_session_limit');
    const timestamp = now();
    const session = {
      sessionId: cleanString(idFactory('cockpit'), 220),
      token: cleanString(tokenFactory(), 320),
      clientId,
      role,
      appVersion: cleanString(request.appVersion, 80),
      capabilities: normalizeCapabilities(request.capabilities).slice(0, 32),
      audioPlaybackEnabled: request.audioPlaybackEnabled === true,
      intentTimestamps: [],
      createdAt: timestamp,
      lastSeenAt: timestamp,
      expiresAt: timestamp + sessionTtlMs
    };
    if (!session.sessionId || !session.token) return resultError('cockpit_session_generation_failed');
    sessions.set(session.sessionId, session);
    return {
      ok: true,
      status: 'ok',
      session: publicSession(session),
      sessionToken: session.token,
      heartbeatAfterMs: Math.max(5000, Math.floor(sessionTtlMs / 3))
    };
  };

  const heartbeat = (request = {}) => {
    const auth = authenticate(request);
    if (!auth.ok) return auth;
    if (typeof request.audioPlaybackEnabled === 'boolean') {
      auth.session.audioPlaybackEnabled = request.audioPlaybackEnabled;
    }
    return { ok: true, status: 'ok', session: publicSession(auth.session) };
  };

  const release = (request = {}) => {
    const auth = authenticate(request);
    if (!auth.ok) return auth;
    sessions.delete(auth.session.sessionId);
    return { ok: true, status: 'ok', releasedSessionId: auth.session.sessionId };
  };

  const submitIntent = async (request = {}) => {
    const auth = authenticate(request);
    if (!auth.ok) return auth;
    const commandId = cleanString(request.commandId, 220);
    const intent = cleanString(request.intent || request.action, 80).toLowerCase();
    if (!commandId) return resultError('command_id_required');
    if (!MISSION_INTENTS.has(intent)) return resultError('mission_intent_not_allowed');
    if (!Object.hasOwn(request, 'expectedRevision') || !Number.isSafeInteger(Number(request.expectedRevision)) || Number(request.expectedRevision) < 0) {
      return resultError('expected_revision_required');
    }
    const commandKey = `${auth.session.sessionId}:${commandId}`;
    const fingerprint = JSON.stringify({
      intent,
      missionId: cleanString(request.missionId),
      runId: cleanString(request.runId, 220),
      expectedRevision: Number(request.expectedRevision),
      payload: safeObject(request.payload)
    });
    const previous = commandResults.get(commandKey);
    if (previous) {
      if (previous.fingerprint !== fingerprint) return resultError('command_id_conflict');
      return { ...previous.result, duplicate: true };
    }
    const timestamp = now();
    auth.session.intentTimestamps = auth.session.intentTimestamps.filter(at => timestamp - at < 60000);
    if (auth.session.intentTimestamps.length >= MAX_INTENTS_PER_MINUTE) {
      return { ok: false, status: 'rate_limited', error: 'mission_intent_rate_limited', sideEffect: false };
    }
    auth.session.intentTimestamps.push(timestamp);
    const activeRun = publicRun(getMissionRun());
    let result;
    if (intent === 'activate_cloud_mission') {
      if (!activateMission) {
        result = { ok: false, status: 'blocked', error: 'cloud_mission_activation_unavailable', sideEffect: false, activeRun };
      } else if (activeRun) {
        result = { ok: false, status: 'conflict', error: 'mission_authority_conflict', sideEffect: false, activeRun };
      } else {
        try {
          const activated = safeObject(await activateMission({
            commandId,
            intent,
            missionId: cleanString(request.missionId),
            runId: cleanString(request.runId, 220),
            expectedRevision: Number(request.expectedRevision),
            payload: safeObject(request.payload),
            controllerSession: publicSession(auth.session)
          }));
          result = { ...activated, activeRun: publicRun(activated.activeRun || getMissionRun()) };
        } catch (error) {
          result = { ok: false, status: 'error', error: cleanString(error?.code || error?.message || error, 160) || 'cloud_mission_activation_failed', activeRun: publicRun(getMissionRun()) };
        }
      }
    } else if (!activeRun) {
      result = { ok: false, status: 'conflict', error: 'no_active_run', sideEffect: false, activeRun: null };
    } else if (cleanString(request.missionId) !== activeRun.missionId || cleanString(request.runId, 220) !== activeRun.runId) {
      result = { ok: false, status: 'conflict', error: 'mission_run_conflict', sideEffect: false, activeRun };
    } else if (Number(request.expectedRevision) !== activeRun.revision) {
      result = { ok: false, status: 'conflict', error: 'mission_revision_conflict', sideEffect: false, activeRun };
    } else if (!executeIntent) {
      result = {
        ok: false,
        status: 'blocked',
        error: 'mission_intents_read_only',
        executionAuthority: executionAuthority(),
        sideEffect: false,
        activeRun
      };
    } else {
      try {
        const executed = safeObject(await executeIntent({
          commandId,
          intent,
          missionId: activeRun.missionId,
          runId: activeRun.runId,
          expectedRevision: activeRun.revision,
          payload: safeObject(request.payload),
          controllerSession: publicSession(auth.session)
        }));
        result = { ...executed, activeRun: publicRun(executed.activeRun || getMissionRun()) };
      } catch (error) {
        result = { ok: false, status: 'error', error: cleanString(error?.code || error?.message || error, 160) || 'mission_intent_failed', activeRun: publicRun(getMissionRun()) };
      }
    }
    commandResults.set(commandKey, { fingerprint, result, expiresAt: now() + commandTtlMs });
    cleanup();
    return result;
  };

  const publicState = () => {
    cleanup();
    const activeSessions = Array.from(sessions.values()).map(publicSession);
    return {
      schema: 'ga.cockpit-sessions.v1',
      executionAuthority: executionAuthority(),
      missionIntentsEnabled: Boolean(executeIntent || activateMission),
      activeCount: activeSessions.length,
      audioPlaybackCandidates: activeSessions.filter(session => session.audioPlaybackEnabled).length,
      roles: Object.fromEntries(Array.from(COCKPIT_ROLES).map(role => [role, activeSessions.filter(session => session.role === role).length])),
      sessions: activeSessions
    };
  };

  return Object.freeze({
    authenticate,
    cleanup,
    heartbeat,
    publicState,
    register,
    release,
    submitIntent
  });
}

module.exports = {
  COCKPIT_ROLES,
  DEFAULT_SESSION_TTL_MS,
  MAX_SESSIONS,
  MAX_INTENTS_PER_MINUTE,
  MISSION_INTENTS,
  createTrackerCockpitControl
};
