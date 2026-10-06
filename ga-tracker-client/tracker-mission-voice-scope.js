'use strict';

// Only mission audio carries this scope. Navigation warnings remain independent.
function normalizeMissionVoiceScope(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const missionId = String(raw.missionId || '').trim();
  const runId = String(raw.runId || '').trim();
  if (!missionId || missionId.length > 180 || !runId || runId.length > 220
      || !['run', 'flight', 'poi', 'bush'].includes(raw.policy)) return null;
  return { missionId, runId, policy: raw.policy,
    ...(raw.allowInactive === true ? { allowInactive: true } : {}),
    ...(raw.aptTraining === true ? { aptTraining: true } : {}),
    ...(raw.trainingScope ? { trainingScope: String(raw.trainingScope).slice(0, 100) } : {}),
    ...(raw.fireSearchHint === true ? { fireSearchHint: true } : {}),
    ...(raw.sarSearchHint === true ? { sarSearchHint: true } : {}),
    ...(Number.isFinite(Number(raw.expiresAt)) && Number(raw.expiresAt) > 0 ? { expiresAt: Number(raw.expiresAt) } : {}) };
}

function missionVoiceScope(request, policy = 'run') {
  const payload = request.effect?.payload || {};
  return normalizeMissionVoiceScope({ missionId: request.missionId, runId: request.runId, policy,
    allowInactive: policy === 'poi' && !!payload.action, aptTraining: payload.aptTraining,
    trainingScope: payload.trainingScope, fireSearchHint: payload.fireSearchHint,
    sarSearchHint: payload.sarSearchHint, expiresAt: payload.expiresAt });
}

function createMissionVoiceScopeGuard(authorityManager) {
  return scope => {
    const run = authorityManager.getActiveRun();
    if (!scope || !run || run.executionAuthority !== 'tracker'
        || run.missionId !== scope.missionId || run.runId !== scope.runId) return false;
    // Boarding, cargo and compliance can speak before takeoff; Farewell can
    // speak during closing. Their lifetime is the owning run, not flags.active.
    if (scope.policy === 'run') return true;
    const current = authorityManager.getExecutionSnapshot?.();
    if (!current || current.runId !== scope.runId) return false;
    if (scope.policy === 'poi' && !(current.recipe === 'poi' && authorityManager.supportsExecutionRecipe?.('poi')
        || current.recipe === 'apt' && scope.aptTraining && current.state.trainingTask)) return false;
    if (scope.policy === 'bush' && (current.recipe !== 'apt' || current.state.bushTask?.kind !== 'pickup_return')) return false;
    if (scope.trainingScope) {
      const state = (current.state.trainingTask?.state || current.state.poiTask?.trainingState)?.checkpoint?.procedureState?.activeState;
      if (!state || `${state.activeIndex}:${state.exercises[state.activeIndex]?.attempts || 0}:${state.active?.phase || 'preparation'}` !== scope.trainingScope) return false;
    }
    if ((scope.fireSearchHint || scope.sarSearchHint) && Date.now() > Number(scope.expiresAt || 0)) return false;
    if (scope.fireSearchHint && ['smoke_confirmed', 'assessment_complete', 'false_alarm_rtb'].includes(current.state.poiTask?.fireState?.scenario?.state)) return false;
    if (scope.sarSearchHint && (current.state.poiTask?.sarSearchState?.found || current.state.poiTask?.sarSearchState?.complete)) return false;
    return (current.state.flags.active === true || scope.allowInactive === true)
      && !current.state.flags.closingPending && !current.state.flags.farewellStarted
      && !current.state.flags.farewellCompleted && !current.state.flags.unloadConfirmed
      && current.state.phase !== 'closing';
  };
}

module.exports = { normalizeMissionVoiceScope, missionVoiceScope, createMissionVoiceScopeGuard };
