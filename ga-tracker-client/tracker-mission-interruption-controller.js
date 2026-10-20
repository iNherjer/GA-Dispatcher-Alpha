'use strict';
const core = require('./tracker-mission-interruption-core.js');

// Runtime side of a simulator interruption. Owns the persisted record through
// the authority manager and decides when the paused mission may continue.
// The runtime supplies simulator access and the rebuild work; this controller
// never touches the deterministic execution state itself.
function createMissionInterruptionController(options = {}) {
  const authorityManager = options.authorityManager;
  const log = typeof options.log === 'function' ? options.log : () => {};
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const notify = typeof options.onChanged === 'function' ? options.onChanged : () => {};
  const simulatorAttached = typeof options.simulatorAttached === 'function' ? options.simulatorAttached : () => false;
  const worldReady = typeof options.worldReady === 'function' ? options.worldReady : () => false;
  const rebuild = typeof options.rebuild === 'function' ? options.rebuild : async () => ({ ok: true });
  const onResumed = typeof options.onResumed === 'function' ? options.onResumed : () => {};
  const setAircraftPosition = typeof options.setAircraftPosition === 'function' ? options.setAircraftPosition : () => null;
  // Airport reference for interruptions on the ground (departure before take-off,
  // destination after landing); supplied by the runtime from the mission route.
  const anchorFor = typeof options.anchorFor === 'function' ? options.anchorFor : () => null;
  let lastValidSample = null;
  let pendingUnknownStart = false;
  let lastEngineRpm = null;
  let dwell = null;

  const activeExecution = () => {
    const snapshot = authorityManager.getExecutionSnapshot?.();
    return snapshot && snapshot.executionAuthority === 'tracker' ? snapshot : null;
  };
  const record = () => {
    const snapshot = activeExecution();
    if (!snapshot) return null;
    return core.normalize(authorityManager.getExecutionInterruption?.({ missionId: snapshot.missionId, runId: snapshot.runId }));
  };
  const write = (next, reason, historyEntry = null) => {
    const snapshot = activeExecution();
    if (!snapshot) return { ok: false, error: 'no_active_run' };
    const result = authorityManager.updateExecutionInterruption({
      missionId: snapshot.missionId, runId: snapshot.runId, record: next, reason, historyEntry
    });
    if (!result?.ok) {
      log(`MISSION_INTERRUPTION_WRITE_ERROR reason=${reason} error=${result?.error || 'unknown'}`);
      return result || { ok: false, error: 'mission_interruption_write_failed' };
    }
    if (result.status !== 'noop') {
      try { notify(`interruption:${next?.status || 'resumed'}`); } catch (error) { log(`MISSION_INTERRUPTION_NOTIFY_ERROR error=${error?.message || error}`); }
    }
    return result;
  };
  const fallbackPosition = snapshot => {
    if (lastValidSample) return lastValidSample;
    const stored = authorityManager.getExecutionLastPosition?.({ missionId: snapshot.missionId, runId: snapshot.runId });
    if (stored) return stored;
    const context = authorityManager.getExecutionRuntimeContext?.({ missionId: snapshot.missionId, runId: snapshot.runId });
    return context?.latestTelemetry || null;
  };

  // Persist the last valid position of a started run (also before the mission
  // start) so an interruption after a tracker restart still knows its place.
  let persistedPosition = null;
  const POSITION_PERSIST_MS = 30000;
  const POSITION_PERSIST_NM = 0.2;
  const persistPosition = (sample) => {
    const snapshot = activeExecution();
    if (!snapshot || !core.interruptible(snapshot.state) || typeof authorityManager.recordExecutionLastPosition !== 'function') return;
    const position = core.positionFromSample(sample);
    if (!position) return;
    const previous = persistedPosition;
    const due = !previous || previous.runId !== snapshot.runId
      || position.onGround !== previous.position.onGround
      || (position.observedAt || 0) - (previous.position.observedAt || 0) >= POSITION_PERSIST_MS
      || core.haversineNm(previous.position.lat, previous.position.lon, position.lat, position.lon) >= POSITION_PERSIST_NM;
    if (!due) return;
    const result = authorityManager.recordExecutionLastPosition({ missionId: snapshot.missionId, runId: snapshot.runId, position });
    if (result?.ok) persistedPosition = { runId: snapshot.runId, position };
  };

  // Called on simulator detach and on tracker start with a started run.
  // `requirePosition`: at tracker start only a run with a known place is
  // interrupted at once; one without waits for the first simulator connection.
  const begin = (cause, reason, { requirePosition = false } = {}) => {
    const snapshot = activeExecution();
    if (!snapshot || !core.interruptible(snapshot.state)) return null;
    const existing = record();
    dwell = null;
    if (existing) {
      if (existing.status === 'awaiting_decision') return existing;
      // A second interruption before the zone was reached: decide again.
      const reopened = core.normalize({ ...existing, status: 'awaiting_decision', since: now(),
        decidedAt: null, decidedBy: null, rebuiltAt: null, autoResumeUntil: null });
      write(reopened, `${reason}:reopen`);
      return reopened;
    }
    const position = fallbackPosition(snapshot);
    let anchor = null;
    try { anchor = anchorFor(snapshot, core.positionFromSample(position)); } catch (error) { log(`MISSION_INTERRUPTION_ANCHOR_ERROR error=${error?.message || error}`); }
    const created = core.create({ cause, phase: snapshot.state.phase, position, anchor, now: now() });
    if (requirePosition && !created?.position) {
      pendingUnknownStart = true;
      log(`MISSION_INTERRUPTION_DEFERRED cause=${cause} reason=position_unknown phase=${snapshot.state.phase}`);
      return null;
    }
    pendingUnknownStart = false;
    // Without a known position there is no zone and no automatic continuation:
    // the pilot decides, and the run resumes right after the cockpit rebuild.
    write(created, reason);
    log(`MISSION_INTERRUPTION_BEGIN cause=${cause} phase=${snapshot.state.phase} airborne=${created?.zone?.airborne === true ? 1 : 0} position=${created?.position ? 1 : 0} anchor=${created?.anchor?.kind || 'none'}`);
    return created;
  };

  const finish = (mode, current = record()) => {
    if (!current) return null;
    const entry = core.historyEntry(current, mode, now());
    dwell = null;
    const result = write(null, `resumed:${mode}`, entry);
    if (!result.ok) return result;
    log(`MISSION_INTERRUPTION_RESUMED mode=${mode} airborne=${current.zone?.airborne === true ? 1 : 0} pausedMs=${Math.max(0, now() - current.since)}`);
    try { onResumed(mode, current); } catch (error) { log(`MISSION_INTERRUPTION_RESUME_HOOK_ERROR error=${error?.message || error}`); }
    return result;
  };

  // Rebuild once per decision, only in a running cockpit with a simulator.
  // Rebuild work only dispatches simulator commands, so it runs synchronously.
  const rebuildNow = (reason) => {
    const current = record();
    if (!current || current.status !== 'resuming' || !simulatorAttached() || !worldReady()) return false;
    const result = rebuild(current, reason);
    if (result?.ok === false) {
      log(`MISSION_INTERRUPTION_REBUILD_ERROR reason=${reason} error=${result.error || 'unknown'}`);
      return false;
    }
    const next = core.rebuilt(current, now());
    if (!write(next, `rebuilt:${reason}`).ok) return false;
    log(`MISSION_INTERRUPTION_REBUILT reason=${reason} zone=${next?.zone ? `${next.zone.radiusNm}nm` : 'none'}`);
    // An automatic continuation is already where it was; no zone to fly to.
    if (!next?.zone || next.decidedBy === 'auto') finish(next.decidedBy === 'auto' ? 'auto' : 'ground', next);
    return true;
  };
  const maybeRebuild = async (reason) => rebuildNow(reason);

  // Returns true when the sample was consumed by the interruption gate.
  const observe = (sample) => {
    if (core.validSample(sample)) {
      lastValidSample = { ...sample };
      if (Number.isFinite(Number(sample.engRpm))) lastEngineRpm = Number(sample.engRpm);
    }
    const current = record();
    if (!current) {
      if (core.validSample(sample)) persistPosition(sample);
      return false;
    }
    const at = Number(sample?.observedAt) || now();
    if (current.status === 'awaiting_decision' && core.plausibleContinuation(current, sample, at)) {
      // The simulator obviously kept running (SimConnect/tracker gap).
      const decided = core.decide(current, { by: 'auto', now: at });
      if (write(decided, 'auto-continuation').ok) rebuildNow('auto-continuation');
    } else if (current.status === 'resuming') {
      rebuildNow('telemetry');
    } else if (current.status === 'awaiting_zone') {
      const step = core.evaluateZone(current, sample, dwell, at);
      dwell = step.dwell;
      if (step.reached) finish(current.zone ? (current.zone.airborne ? 'zone' : 'ground') : 'ground', current);
    }
    // The sample that ends an interruption is a normal mission sample again.
    return Boolean(record());
  };

  const handleIntent = async (request = {}) => {
    const intent = String(request.intent || request.action || '').trim().toLowerCase();
    const current = record();
    if (!current) {
      return ['resume_mission', 'resume_teleport'].includes(intent)
        ? { ok: false, status: 'noop', error: 'mission_not_interrupted', sideEffect: false }
        : null;
    }
    const snapshot = activeExecution();
    if (String(request.missionId || '') !== String(snapshot?.missionId || '')
        || String(request.runId || '') !== String(snapshot?.runId || '')) {
      if (['resume_mission', 'resume_teleport'].includes(intent)) {
        return { ok: false, status: 'conflict', error: 'mission_run_conflict', sideEffect: false };
      }
    }
    if (!core.INTERRUPTION_INTENTS.has(intent)) {
      return { ok: false, status: 'blocked', error: 'mission_interrupted', interruption: current.status, sideEffect: false };
    }
    if (intent === 'resume_mission') {
      if (current.status !== 'awaiting_decision') return { ok: true, status: 'noop', interruption: current.status, sideEffect: false };
      const role = String(request.controllerSession?.role || 'web').toLowerCase().slice(0, 24);
      const decided = core.decide(current, { by: role, now: now() });
      const written = write(decided, `resume:${role}`);
      if (!written.ok) return { ...written, sideEffect: false };
      log(`MISSION_INTERRUPTION_DECISION by=${role} simulator=${simulatorAttached() ? 1 : 0} ready=${worldReady() ? 1 : 0}`);
      rebuildNow('decision');
      return { ok: true, status: 'ok', interruption: record()?.status || 'resumed', sideEffect: false };
    }
    if (intent === 'resume_teleport') {
      if (current.status !== 'awaiting_zone' || !current.zone?.airborne) {
        return { ok: false, status: 'blocked', error: 'mission_resume_teleport_unavailable', sideEffect: false };
      }
      if (!simulatorAttached() || !worldReady()) {
        return { ok: false, status: 'blocked', error: 'mission_cockpit_not_ready', sideEffect: false };
      }
      if (!(lastEngineRpm > 300)) {
        return { ok: false, status: 'blocked', error: 'mission_resume_engine_not_running', sideEffect: false };
      }
      const target = core.teleportTarget(current);
      if (!target) return { ok: false, status: 'blocked', error: 'mission_resume_teleport_unavailable', sideEffect: false };
      const moved = await setAircraftPosition(target);
      if (!moved || moved.ok === false) {
        return { ok: false, status: 'error', error: moved?.error || 'mission_resume_teleport_failed', sideEffect: false };
      }
      dwell = null;
      log(`MISSION_INTERRUPTION_TELEPORT alt=${target.altFt} speed=${target.airspeedKts}`);
      return { ok: true, status: 'ok', interruption: 'awaiting_zone', sideEffect: true };
    }
    return null;
  };

  // First simulator connection after a tracker start without a stored position.
  const attached = () => {
    if (!pendingUnknownStart) return null;
    pendingUnknownStart = false;
    return begin('tracker_restart', 'first-simulator-attach');
  };

  return Object.freeze({
    record,
    begin,
    attached,
    observe,
    handleIntent,
    maybeRebuild,
    finish,
    // Mission effects stay queued until the run is fully resumed.
    blocksEffects: () => Boolean(record()),
    // Rebuild work (cargo/scenes) waits for the decision and the cockpit.
    blocksRebuild: () => {
      const current = record();
      return Boolean(current) && current.status !== 'awaiting_zone';
    },
    lastValidSample: () => (lastValidSample ? { ...lastValidSample } : null)
  });
}

module.exports = { createMissionInterruptionController };
