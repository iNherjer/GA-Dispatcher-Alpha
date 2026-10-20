'use strict';

// Mission commands that arrive while no SimConnect handler is attached.
// The mission runtime and authority live outside SimConnect, so a closed
// simulator must neither hide them nor replay stale user decisions later.
//
// - abort_mission / close_cargo_window / resume_mission: executed immediately. Abort skips the
//   simulator cleanup (nothing is left in a closed simulator) per contract.
// - every other mission_execution_intent: rejected immediately with
//   `simulator_disconnected` instead of being buffered until the next launch.
// - mission_snapshot_request: read-only, answered from the authority.
// - all other commands keep the existing buffering behaviour.

const SIMULATOR_DISCONNECTED = 'simulator_disconnected';
// resume_mission only records the decision; rebuilding waits for the cockpit.
const SIMULATOR_INDEPENDENT_INTENTS = Object.freeze(new Set(['abort_mission', 'close_cargo_window', 'resume_mission']));

function normalizedType(command) {
  return String(command?.type || '').trim().toLowerCase();
}

function normalizedIntent(command) {
  return String(command?.intent || command?.action || '').trim().toLowerCase();
}

function classifyMissionCommandWithoutSimulator(command = {}) {
  const type = normalizedType(command);
  if (type === 'mission_execution_intent') {
    const intent = normalizedIntent(command);
    if (SIMULATOR_INDEPENDENT_INTENTS.has(intent)) return { action: 'execute_intent', intent };
    return { action: 'reject_intent', intent, error: SIMULATOR_DISCONNECTED };
  }
  if (type === 'mission_snapshot_request') return { action: 'snapshot' };
  return { action: 'buffer' };
}

function buildMissionIntentAck(command = {}, result = {}, authoritySnapshot = null, now = Date.now()) {
  return {
    source: 'tracker',
    type: 'mission_execution_intent_ack',
    commandId: command?.commandId || null,
    missionId: command?.missionId || result?.activeRun?.missionId || result?.releasedRun?.missionId || '',
    runId: command?.runId || result?.activeRun?.runId || result?.releasedRun?.runId || '',
    intent: command?.intent || '',
    ok: result?.ok === true,
    status: result?.status || (result?.ok ? 'ok' : 'error'),
    error: result?.error || '',
    sideEffect: result?.sideEffect === true,
    activeRun: result?.activeRun || authoritySnapshot?.activeRun || null,
    releasedRun: result?.releasedRun || null,
    duplicate: result?.duplicate === true,
    at: now
  };
}

function buildAuthorityAck(type, command = {}, result = {}) {
  const normalized = String(type || '').trim().toLowerCase();
  return {
    ...(result?.replayAck && typeof result.replayAck === 'object' ? result.replayAck : {}),
    missionTransferPeer: command?.missionTransferPeer || undefined,
    type: normalized ? `${normalized}_ack` : 'mission_authority_rejected_ack',
    commandId: command?.commandId || null,
    missionId: command?.missionId || result?.activeRun?.missionId || '',
    runId: command?.runId || result?.activeRun?.runId || '',
    status: result?.status || (result?.ok ? 'ok' : 'error'),
    error: result?.error || '',
    reason: result?.reason || command?.reason || '',
    authoritativeRun: result?.activeRun || null,
    releasedRun: result?.releasedRun || null,
    resumeBundle: result?.resumeBundle || undefined,
    executionAuthority: result?.executionAuthority || result?.activeRun?.executionAuthority || undefined,
    deduplicated: result?.duplicate === true
  };
}

module.exports = {
  SIMULATOR_DISCONNECTED,
  SIMULATOR_INDEPENDENT_INTENTS,
  classifyMissionCommandWithoutSimulator,
  buildMissionIntentAck,
  buildAuthorityAck
};
