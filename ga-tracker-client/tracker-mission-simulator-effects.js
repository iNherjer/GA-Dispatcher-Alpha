'use strict';

const { haversineNm } = require('../mission-location-core.js');

const EFFECT_PLAN_SCHEMA = 'ga.mission-apt-effect-plan.v1';
const EFFECT_COMMANDS = Object.freeze({
  'scene.arrival': Object.freeze({
    commandType: 'mission_scene_spawn',
    ackType: 'mission_scene_spawn_ack'
  }),
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

function normalizedKey(value, fallback = 'cargo-item') {
  return cleanString(value, 220).toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
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

function effectPlanFromRun(run = null, effectPlan = run?.resumeBundle?.executionEffectPlan) {
  const plan = safeObject(effectPlan);
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
  const cargoQueue = new Map();
  const cargoRevisions = new Map();
  let cargoRevision = 0;
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const scheduleTimeout = options.setTimeout || setTimeout;
  const cancelTimeout = options.clearTimeout || clearTimeout;

  if (!authorityManager || typeof authorityManager.getActiveRun !== 'function') {
    throw new TypeError('mission_simulator_effect_authority_manager_required');
  }

  const hasPlanReader = typeof authorityManager.getExecutionEffectPlan === 'function';
  const currentRun = () => authorityManager.getActiveRun({ includeBundle: !hasPlanReader });
  const readEffectPlan = run => effectPlanFromRun(run,
    hasPlanReader ? authorityManager.getExecutionEffectPlan() : run?.resumeBundle?.executionEffectPlan);

  const dispatch = async (request = {}, flushCargo = false) => {
    const effectType = cleanString(request?.effect?.type, 100).toLowerCase();
    const commandId = cleanString(request.commandId, 220);
    if (effectType === 'mission.close_requested') {
      return { ok: true, status: 'completed', sideEffect: false, commandId };
    }
    if (effectType === 'scene.compliance_departure') {
      if (!commandId) return errorResult('mission_simulator_effect_command_id_required');
      if (!dispatchCommand) return errorResult('mission_simulator_not_connected');
      const run = currentRun();
      if (!run?.missionId || !run?.runId) return errorResult('no_active_run');
      if (run.executionAuthority !== 'tracker') return errorResult('mission_execution_authority_web');
      if (cleanString(request.missionId) !== cleanString(run.missionId)
          || cleanString(request.runId, 220) !== cleanString(run.runId, 220)) {
        return errorResult('mission_run_conflict');
      }
      const visit = [...pending.values()].find(record => record.effectType === 'scene.compliance_visit') || null;
      const plan = readEffectPlan(run);
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
      const run = currentRun();
      if (!run?.missionId || !run?.runId) return errorResult('no_active_run');
      if (run.executionAuthority !== 'tracker') return errorResult('mission_execution_authority_web');
      if (cleanString(request.missionId) !== cleanString(run.missionId)
          || cleanString(request.runId, 220) !== cleanString(run.runId, 220)) {
        return errorResult('mission_run_conflict');
      }
      const targetEffectId = cleanString(request?.effect?.payload?.deboardingEffectId, 220);
      const plan = readEffectPlan(run);
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
    if (effectType === 'scene.manual_pax') {
      const fail = error => ({ ...errorResult(error), terminal: true });
      const run = currentRun();
      if (!run || run.executionAuthority !== 'tracker' || run.missionId !== request.missionId || run.runId !== request.runId) return fail('mission_run_conflict');
      if (pending.has(commandId)) return { ok: true, status: 'pending', commandId };
      const payload = safeObject(request.effect?.payload);
      const plan = readEffectPlan(run);
      const recipe = (plan?.manualPassengerCommands || []).find(entry => entry.itemId === payload.itemId && entry.operation === payload.operation);
      if (!recipe?.command || recipe.command.type !== 'mission_scene_manual_pax') return fail('mission_manual_passenger_recipe_missing');
      const remainingMs = 70000 - Math.max(0, now() - Number(payload.requestedAt || now()));
      if (remainingMs <= 0) return fail('manual_pax_timeout');
      const position = normalizeLivePosition(payload.position || getLivePosition());
      if (!dispatchCommand || !position) return fail('mission_simulator_live_position_missing');
      const record = { effectId: commandId, effectType, ackType: 'mission_scene_manual_pax_ack', missionId: run.missionId, runId: run.runId };
      pending.set(commandId, record);
      try {
        const result = safeObject(await dispatchCommand({ ...clone(recipe.command), ...position,
          commandId, missionId: run.missionId, runId: run.runId }));
        if (result.ok !== true || result.status === 'completed') {
          pending.delete(commandId);
          return result.ok === true ? { ok: true, status: 'completed', commandId } : fail(result.error || 'manual_pax_failed');
        }
        if (pending.has(commandId)) {
          record.timer = scheduleTimeout(() => handleAck({ commandId, type: record.ackType, status: 'timeout', error: 'manual_pax_timeout' }), remainingMs);
          record.timer?.unref?.();
        }
        return { ok: true, status: 'pending', commandId };
      } catch (error) {
        pending.delete(commandId);
        return fail(error?.message || 'manual_pax_failed');
      }
    }
    if (effectType === 'scene.cargo_item_transition') {
      if (!commandId) return errorResult('mission_simulator_effect_command_id_required');
      if (!dispatchCommand) return errorResult('mission_simulator_not_connected');
      const run = currentRun();
      if (!run?.missionId || !run?.runId) return errorResult('no_active_run');
      if (run.executionAuthority !== 'tracker') return errorResult('mission_execution_authority_web');
      if (cleanString(request.missionId) !== cleanString(run.missionId)
          || cleanString(request.runId, 220) !== cleanString(run.runId, 220)) {
        return errorResult('mission_run_conflict');
      }
      const plan = readEffectPlan(run);
      if (!plan) return errorResult('mission_apt_effect_plan_missing');
      const payload = safeObject(request?.effect?.payload);
      const item = safeObject(payload.item);
      const itemId = cleanString(payload.itemId || item.id, 120);
      const action = cleanString(payload.action, 40).toLowerCase();
      if (!itemId || !['load', 'reload', 'unload', 'drop'].includes(action)) {
        return errorResult('mission_cargo_visual_transition_invalid');
      }
      const baseKind = cleanString(item.sceneKind || item.id || itemId, 120) || itemId;
      const unloadedKind = `unloaded_${baseKind}`;
      const manifestKey = normalizedKey(payload.manifestKey || run.missionId, 'active-mission');
      const objectKey = item.persistentEquipment === true
        ? `aircraft-equipment:${String(payload.aircraftSlot || 'PA-24').trim().toUpperCase().replace(/[^A-Z0-9_.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'PA-24'}:${normalizedKey(itemId)}`
        : `mission-cargo:${manifestKey}:${normalizedKey(itemId)}`;
      if (!flushCargo) {
        const previous = cargoQueue.get(objectKey);
        if (previous?.request.commandId === commandId) return { ok: true, status: 'pending', commandId };
        if (previous) {
          cancelTimeout(previous.timer);
          cargoRevisions.delete(previous.request.commandId);
          Promise.resolve(acknowledgeEffect?.({ effectId: previous.request.commandId, status: 'completed',
            simulatorAck: { status: 'superseded' } })).catch(error => log(`MISSION_CARGO_QUEUE_ACK_ERROR ${error?.message || error}`));
        }
        if (!cargoRevisions.has(commandId)) {
          cargoRevision = Math.max(cargoRevision, Number(plan.cargoObjectRevision) || 0, Number(options.getCargoRevision?.()) || 0) + 1;
          options.onCargoRevision?.(cargoRevision);
          cargoRevisions.set(commandId, cargoRevision);
        }
        const entry = { request: clone(request), timer: null };
        entry.timer = scheduleTimeout(async () => {
          if (cargoQueue.get(objectKey) !== entry) return;
          cargoQueue.delete(objectKey);
          try {
            const result = await dispatch(entry.request, true);
            if (result.status !== 'pending') {
              cargoRevisions.delete(commandId);
              await acknowledgeEffect?.({ effectId: commandId,
                status: result.ok ? 'completed' : 'failed', simulatorAck: { status: result.status, error: result.error || null } });
            }
          } catch (error) {
            cargoRevisions.delete(commandId);
            await acknowledgeEffect?.({ effectId: commandId, status: 'failed', simulatorAck: { status: 'error', error: error?.message } });
          }
        }, payload.coalesced === true ? 0 : 180);
        entry.timer?.unref?.();
        cargoQueue.set(objectKey, entry);
        return { ok: true, status: 'pending', commandId };
      }
      const objectRevision = cargoRevisions.get(commandId) || ++cargoRevision;
      let command;
      let ackType;
      if (action === 'load' || action === 'reload') {
        command = {
          type: 'mission_scene_object_remove',
          commandId,
          missionId: run.missionId,
          runId: run.runId,
          sceneId: cleanString(plan.sceneId, 220),
          reason: `tracker-execution:cargo-${action}`,
          objectKey,
          objectRevision,
          allScenes: true,
          objectKeys: [objectKey],
          kinds: Array.from(new Set([baseKind, unloadedKind, item.pickupLocation === 'target' ? 'arrival_equipment_1' : 'cargo'].filter(Boolean))),
          labels: [item.label, item.storyName].map(value => cleanString(value, 180)).filter(Boolean),
          itemIds: [itemId],
          cargoSceneKinds: [baseKind, unloadedKind]
        };
        ackType = 'mission_scene_object_remove_ack';
      } else {
        const position = normalizeLivePosition(payload.position || getLivePosition());
        if (!position) return errorResult('mission_simulator_live_position_missing');
        const placement = safeObject(plan.cargoPlacement);
        command = {
          type: 'mission_scene_object_spawn',
          commandId,
          missionId: run.missionId,
          runId: run.runId,
          sceneId: `${cleanString(plan.sceneId, 180)}-cargo-unload`,
          reason: `tracker-execution:cargo-${action}`,
          objectKey,
          objectRevision,
          replaceExisting: true,
          lat: position.lat,
          lon: position.lon,
          altFt: position.altFt,
          hdg: position.hdg,
          items: [{
            kind: unloadedKind,
            itemId,
            cargoItemId: itemId,
            cargoSceneKind: item.sceneKind || unloadedKind,
            objectKey,
            objectRevision,
            label: cleanString(item.storyName || item.label || itemId, 180),
            objectTitle: cleanString(item.objectTitle, 180) || 'Cardboard',
            titleCandidates: Array.isArray(item.titleCandidates) ? item.titleCandidates.slice(0, 24)
              : (plan.cargoItemAssets || []).find(entry => entry.itemId === itemId)?.titleCandidates || [],
            forwardM: finite(placement.forwardM, 4) + finite(item.forwardM, finite(item.forwardOffsetM, 0)),
            rightM: finite(placement.rightM, 4) + finite(item.rightM, finite(item.rightOffsetM, 0)),
            headingMode: 'with_aircraft',
            altOffsetFt: finite(placement.altOffsetFt, 0) + finite(item.altOffsetFt, 0)
          }]
        };
        ackType = 'mission_scene_object_spawn_ack';
      }
      pending.set(commandId, {
        effectId: commandId,
        effectType,
        ackType,
        missionId: run.missionId,
        runId: run.runId,
        coordinateFarewell: false
      });
      let result;
      try {
        result = safeObject(await dispatchCommand(command));
      } catch (error) {
        pending.delete(commandId);
        return { ok: false, status: 'error', error: cleanString(error?.code || error?.message || error, 180) || 'mission_simulator_dispatch_failed', sideEffect: false };
      }
      if (result.ok !== true) {
        pending.delete(commandId);
        return errorResult(result.error || 'mission_simulator_dispatch_failed', { sideEffect: result.sideEffect === true });
      }
      if (cleanString(result.status, 40).toLowerCase() === 'completed') {
        pending.delete(commandId);
        return { ok: true, status: 'completed', sideEffect: result.sideEffect === true, commandId };
      }
      return { ok: true, status: 'pending', sideEffect: true, commandId };
    }
    const contract = EFFECT_COMMANDS[effectType];
    if (!contract) return errorResult('mission_simulator_effect_not_supported');
    if (!commandId) return errorResult('mission_simulator_effect_command_id_required');
    if (!dispatchCommand) {
      return effectType === 'scene.compliance_visit'
        ? { ok: true, status: 'completed', sideEffect: false, commandId, logicalFallback: true }
        : errorResult('mission_simulator_not_connected');
    }

    const run = currentRun();
    if (!run?.missionId || !run?.runId) return errorResult('no_active_run');
    if (run.executionAuthority !== 'tracker') return errorResult('mission_execution_authority_web');
    if (cleanString(request.missionId) !== cleanString(run.missionId)
        || cleanString(request.runId, 220) !== cleanString(run.runId, 220)) {
      return errorResult('mission_run_conflict');
    }
    const plan = readEffectPlan(run);
    if (!plan) return effectType === 'scene.compliance_visit'
      ? { ok: true, status: 'completed', sideEffect: false, commandId, logicalFallback: true }
      : errorResult('mission_apt_effect_plan_missing');
    const template = commandTemplateFor(plan, effectType);
    if (!template) return effectType === 'scene.compliance_visit'
      ? { ok: true, status: 'completed', sideEffect: false, commandId, logicalFallback: true }
      : errorResult('mission_apt_effect_command_invalid');
    const position = normalizeLivePosition(effectType === 'scene.arrival' ? template : getLivePosition());
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
      // Same 0.12 NM arrival gate as standalone. The existing simulator handler
      // verifies the actual vehicle and falls back if it has disappeared.
      const arrival = commandTemplateFor(plan, 'scene.arrival');
      const arrivalConfirmed = authorityManager.getExecutionSnapshot?.()?.state?.effects?.some(
        effect => effect.type === 'scene.arrival' && effect.status === 'completed');
      if (arrival && arrivalConfirmed && haversineNm(position.lat, position.lon, arrival.lat, arrival.lon) <= 0.12) {
        command.deboardingPickupSceneId = arrival.sceneId;
        command.vehicleDeparture = false;
        command.vehicleArrival = false;
        command.vehicleReturn = false;
      }
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
    cargoRevisions.delete(commandId);
    if (record.timer) cancelTimeout(record.timer);
    const ackStatus = cleanString(ack.status, 40).toLowerCase();
    const completed = ackStatus === 'ok'
      || (['scene.cargo_item_transition', 'scene.manual_pax'].includes(record.effectType) && ackStatus === 'noop');
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
    cancelPending({ preserveManual = false } = {}) {
      for (const entry of cargoQueue.values()) cancelTimeout(entry.timer);
      cargoQueue.clear();
      cargoRevisions.clear();
      for (const [id, record] of pending) {
        if (preserveManual && record.effectType === 'scene.manual_pax') continue;
        if (record.timer) cancelTimeout(record.timer);
        pending.delete(id);
      }
    },
    handlers: Object.freeze({
      'scene.prepare': dispatch,
      'scene.arrival': dispatch,
      'scene.boarding': dispatch,
      'scene.cargo_item_transition': dispatch,
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
