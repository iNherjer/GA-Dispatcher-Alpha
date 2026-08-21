'use strict';

const EFFECT_PLAN_SCHEMA = 'ga.mission-apt-effect-plan.v1';
const EFFECT_COMMANDS = Object.freeze({
  'scene.prepare': Object.freeze({
    commandType: 'mission_scene_spawn',
    ackType: 'mission_scene_spawn_ack'
  }),
  'scene.boarding': Object.freeze({
    commandType: 'mission_scene_boarding',
    ackType: 'mission_scene_boarding_ack'
  }),
  'scene.deboarding': Object.freeze({
    commandType: 'mission_scene_deboarding',
    ackType: 'mission_scene_deboarding_ack'
  }),
  'scene.compliance_visit': Object.freeze({
    commandType: 'mission_scene_ground_visit',
    ackType: 'mission_scene_ground_visit_ack'
  })
});

function cleanString(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function errorResult(error, details = {}) {
  return { ok: false, status: 'blocked', error, sideEffect: false, ...details };
}

function normalizeLivePosition(value = {}) {
  const source = safeObject(value);
  const lat = finite(source.lat);
  const lon = finite(source.lon ?? source.lng);
  if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return {
    lat,
    lon,
    altFt: finite(source.altFt ?? source.alt, 0),
    hdg: finite(source.hdg ?? source.heading, 0)
  };
}

function effectPlanFromRun(run = null) {
  const bundle = safeObject(run?.resumeBundle);
  const plan = safeObject(bundle.executionEffectPlan);
  if (plan.schema !== EFFECT_PLAN_SCHEMA || cleanString(plan.recipe, 80).toLowerCase() !== 'apt') return null;
  if (cleanString(plan.missionId) && cleanString(plan.missionId) !== cleanString(run?.missionId)) return null;
  return plan;
}

function commandTemplateFor(plan, effectType) {
  const effectEntry = safeObject(safeObject(plan.effects)[effectType]);
  const command = safeObject(effectEntry.command);
  const contract = EFFECT_COMMANDS[effectType];
  if (!contract || cleanString(command.type, 100).toLowerCase() !== contract.commandType) return null;
  const sceneId = cleanString(command.sceneId, 220);
  if (!sceneId) return null;
  if (contract.commandType === 'mission_scene_spawn') {
    if (!Array.isArray(command.items) || command.items.length < 1 || command.items.length > 80) return null;
  }
  if (contract.commandType === 'mission_scene_boarding' || contract.commandType === 'mission_scene_deboarding') {
    if (!Array.isArray(command.path) || command.path.length < 2 || command.path.length > 24) return null;
  }
  if (contract.commandType === 'mission_scene_ground_visit') {
    if (!Array.isArray(command.vehicleArrivalPath) || command.vehicleArrivalPath.length < 2
        || !Array.isArray(command.visitorPaths) || command.visitorPaths.length !== 2
        || command.visitorPaths.some(visitor => !Array.isArray(visitor?.path) || visitor.path.length < 2)) return null;
  }
  return clone(command);
}

function createTrackerMissionSimulatorEffects(options = {}) {
  const authorityManager = options.authorityManager;
  const getLivePosition = typeof options.getLivePosition === 'function' ? options.getLivePosition : () => null;
  const dispatchCommand = typeof options.dispatchCommand === 'function' ? options.dispatchCommand : null;
  const log = typeof options.log === 'function' ? options.log : () => {};
  const onStage = typeof options.onStage === 'function' ? options.onStage : null;
  let acknowledgeEffect = typeof options.acknowledgeEffect === 'function' ? options.acknowledgeEffect : null;
  const pending = new Map();

  if (!authorityManager || typeof authorityManager.getActiveRun !== 'function') {
    throw new TypeError('mission_simulator_effect_authority_manager_required');
  }

  const dispatch = async (request = {}) => {
    const effectType = cleanString(request?.effect?.type, 100).toLowerCase();
    const commandId = cleanString(request.commandId, 220);
    if (effectType === 'mission.close_requested') {
      return { ok: true, status: 'completed', sideEffect: false, commandId };
    }
    if (effectType === 'scene.compliance_departure') {
      if (!commandId) return errorResult('mission_simulator_effect_command_id_required');
      if (!dispatchCommand) return errorResult('mission_simulator_not_connected');
      const run = authorityManager.getActiveRun({ includeBundle: true });
      if (!run?.missionId || !run?.runId) return errorResult('no_active_run');
      if (run.executionAuthority !== 'tracker') return errorResult('mission_execution_authority_web');
      if (cleanString(request.missionId) !== cleanString(run.missionId)
          || cleanString(request.runId, 220) !== cleanString(run.runId, 220)) {
        return errorResult('mission_run_conflict');
      }
      const visit = [...pending.values()].find(record => record.effectType === 'scene.compliance_visit') || null;
      const plan = effectPlanFromRun(run);
      const sceneId = cleanString(safeObject(safeObject(plan?.effects)['scene.compliance_visit']).command?.sceneId, 220);
      if (!visit?.effectId || !sceneId) return errorResult('mission_compliance_visit_target_missing');
      const released = safeObject(await dispatchCommand({
        type: 'mission_scene_ground_visit_release',
        commandId,
        missionId: run.missionId,
        runId: run.runId,
        sceneId,
        visitCommandId: visit.effectId,
        reason: 'tracker-execution:authority-inspection-complete'
      }));
      if (released.ok !== true) return errorResult(released.error || 'mission_compliance_departure_failed');
      return { ok: true, status: 'completed', sideEffect: released.sideEffect === true, commandId };
    }
    if (effectType === 'scene.deboarding_continue') {
      if (!commandId) return errorResult('mission_simulator_effect_command_id_required');
      if (!dispatchCommand) return errorResult('mission_simulator_not_connected');
      const run = authorityManager.getActiveRun({ includeBundle: true });
      if (!run?.missionId || !run?.runId) return errorResult('no_active_run');
      if (run.executionAuthority !== 'tracker') return errorResult('mission_execution_authority_web');
      if (cleanString(request.missionId) !== cleanString(run.missionId)
          || cleanString(request.runId, 220) !== cleanString(run.runId, 220)) {
        return errorResult('mission_run_conflict');
      }
      const targetEffectId = cleanString(request?.effect?.payload?.deboardingEffectId, 220);
      const plan = effectPlanFromRun(run);
      const sceneId = cleanString(safeObject(safeObject(plan?.effects)['scene.deboarding']).command?.sceneId, 220);
      if (!targetEffectId || !sceneId) return errorResult('mission_deboarding_continuation_target_missing');
      const continued = safeObject(await dispatchCommand({
        type: 'mission_scene_deboarding_continue',
        commandId,
        missionId: run.missionId,
        runId: run.runId,
        sceneId,
        deboardingCommandId: targetEffectId,
        reason: 'tracker-execution:farewell-complete'
      }));
      if (continued.ok !== true) return errorResult(continued.error || 'mission_deboarding_continuation_failed');
      return { ok: true, status: 'completed', sideEffect: continued.sideEffect === true, commandId };
    }
    const contract = EFFECT_COMMANDS[effectType];
    if (!contract) return errorResult('mission_simulator_effect_not_supported');
    if (!commandId) return errorResult('mission_simulator_effect_command_id_required');
    if (!dispatchCommand) {
      return effectType === 'scene.compliance_visit'
        ? { ok: true, status: 'completed', sideEffect: false, commandId, logicalFallback: true }
        : errorResult('mission_simulator_not_connected');
    }

    const run = authorityManager.getActiveRun({ includeBundle: true });
    if (!run?.missionId || !run?.runId) return errorResult('no_active_run');
    if (run.executionAuthority !== 'tracker') return errorResult('mission_execution_authority_web');
    if (cleanString(request.missionId) !== cleanString(run.missionId)
        || cleanString(request.runId, 220) !== cleanString(run.runId, 220)) {
      return errorResult('mission_run_conflict');
    }
    const plan = effectPlanFromRun(run);
    if (!plan) return effectType === 'scene.compliance_visit'
      ? { ok: true, status: 'completed', sideEffect: false, commandId, logicalFallback: true }
      : errorResult('mission_apt_effect_plan_missing');
    const template = commandTemplateFor(plan, effectType);
    if (!template) return effectType === 'scene.compliance_visit'
      ? { ok: true, status: 'completed', sideEffect: false, commandId, logicalFallback: true }
      : errorResult('mission_apt_effect_command_invalid');
    const position = normalizeLivePosition(getLivePosition());
    if (!position) return effectType === 'scene.compliance_visit'
      ? { ok: true, status: 'completed', sideEffect: false, commandId, logicalFallback: true }
      : errorResult('mission_simulator_live_position_missing');

    const command = {
      ...template,
      type: contract.commandType,
      commandId,
      missionId: run.missionId,
      runId: run.runId,
      reason: `tracker-execution:${effectType}`,
      lat: position.lat,
      lon: position.lon,
      altFt: position.altFt,
      hdg: position.hdg
    };
    if (effectType === 'scene.deboarding') {
      command.coordinateFarewell = request?.effect?.payload?.coordinateFarewell === true;
    }
    pending.set(commandId, {
      effectId: commandId,
      effectType,
      ackType: contract.ackType,
      missionId: run.missionId,
      runId: run.runId,
      coordinateFarewell: effectType === 'scene.deboarding' && request?.effect?.payload?.coordinateFarewell === true
    });
    let result;
    try {
      result = safeObject(await dispatchCommand(command));
    } catch (error) {
      pending.delete(commandId);
      return {
        ok: false,
        status: 'error',
        error: cleanString(error?.code || error?.message || error, 180) || 'mission_simulator_dispatch_failed',
        sideEffect: false
      };
    }
    if (result.ok !== true) {
      pending.delete(commandId);
      if (effectType === 'scene.compliance_visit') {
        return { ok: true, status: 'completed', sideEffect: result.sideEffect === true, commandId, logicalFallback: true };
      }
      return {
        ok: false,
        status: cleanString(result.status, 40) || 'error',
        error: cleanString(result.error, 180) || 'mission_simulator_dispatch_failed',
        sideEffect: result.sideEffect === true
      };
    }
    if (cleanString(result.status, 40).toLowerCase() === 'completed') {
      pending.delete(commandId);
      return { ok: true, status: 'completed', sideEffect: false, commandId, duplicate: result.duplicate === true };
    }
    return { ok: true, status: 'pending', sideEffect: true, commandId };
  };

  const handleAck = (ack = {}) => {
    const commandId = cleanString(ack.commandId, 220);
    const record = pending.get(commandId);
    const ackType = cleanString(ack.type, 140).toLowerCase();
    const isDeboardingStage = record?.effectType === 'scene.deboarding'
      && ackType === 'mission_scene_deboarding_stage';
    const isComplianceStage = record?.effectType === 'scene.compliance_visit'
      && ackType === 'mission_scene_ground_visit_stage';
    if (record && (isDeboardingStage || isComplianceStage)) {
      if (onStage) {
        Promise.resolve(onStage({
          effectId: record.effectId,
          effectType: record.effectType,
          missionId: record.missionId,
          runId: record.runId,
          coordinateFarewell: record.coordinateFarewell === true,
          stage: cleanString(ack.stage, 80).toLowerCase(),
          simulatorAck: clone(ack)
        })).catch((error) => {
          log(`MISSION_EFFECT_STAGE_ERROR effect=${record.effectType} commandId=${commandId} error=${error?.message || error}`);
        });
      }
      return true;
    }
    if (!record || cleanString(ack.type, 140).toLowerCase() !== record.ackType) return false;
    pending.delete(commandId);
    const ackStatus = cleanString(ack.status, 40).toLowerCase();
    const completed = ackStatus === 'ok';
    if (!acknowledgeEffect) {
      log(`MISSION_EFFECT_ACK_DROPPED effect=${record.effectType} commandId=${commandId} reason=acknowledger_missing`);
      return true;
    }
    Promise.resolve(acknowledgeEffect({
      effectId: record.effectId,
      status: completed ? 'completed' : 'failed',
      simulatorAck: {
        type: record.ackType,
        status: ackStatus || 'error',
        error: cleanString(ack.error, 180) || null
      }
    })).catch((error) => {
      log(`MISSION_EFFECT_ACK_ERROR effect=${record.effectType} commandId=${commandId} error=${error?.message || error}`);
    });
    return true;
  };

  return Object.freeze({
    dispatch,
    handleAck,
    handlers: Object.freeze({
      'scene.prepare': dispatch,
      'scene.boarding': dispatch,
      'scene.compliance_visit': dispatch,
      'scene.compliance_departure': dispatch,
      'mission.close_requested': dispatch
    }),
    pendingCount: () => pending.size,
    setAcknowledgeEffect(handler) {
      acknowledgeEffect = typeof handler === 'function' ? handler : null;
    }
  });
}

module.exports = {
  EFFECT_COMMANDS,
  EFFECT_PLAN_SCHEMA,
  createTrackerMissionSimulatorEffects,
  effectPlanFromRun,
  normalizeLivePosition
};
