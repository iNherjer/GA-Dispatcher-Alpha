'use strict';

const MISSION_VIEW_SCHEMA = 'ga.efb-mission-view.v1';
const MISSION_VIEW_VERSION = 1;
const TONES = new Set(['active', 'good', 'warn', 'danger', 'info', 'muted', 'neutral']);

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value, maxLength = 360) {
  return String(value == null ? '' : value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function percent(value) {
  const number = finite(value);
  return number === null ? null : Math.max(0, Math.min(100, Math.round(number)));
}

function tone(value, fallback = 'neutral') {
  const normalized = text(value, 16).toLowerCase();
  return TONES.has(normalized) ? normalized : fallback;
}

function sanitizePhase(value) {
  const source = object(value);
  const stages = (Array.isArray(source.stages) ? source.stages : [])
    .slice(0, 8)
    .map((stage, index) => ({
      id: text(object(stage).id || `stage-${index + 1}`, 60),
      label: text(object(stage).label || stage || `Phase ${index + 1}`, 80)
    }))
    .filter(stage => stage.label);
  const safeStages = stages.length ? stages : [
    { id: 'preparation', label: 'Vorbereitung' },
    { id: 'enroute', label: 'Reiseflug' },
    { id: 'arrival', label: 'Ankunft' },
    { id: 'complete', label: 'Abschluss' }
  ];
  return {
    current: Math.max(0, Math.min(safeStages.length - 1, Math.round(Number(source.current) || 0))),
    stages: safeStages
  };
}

function sanitizeRows(value, maxRows, options = {}) {
  return (Array.isArray(value) ? value : []).slice(0, maxRows).map((row) => {
    const source = object(row);
    const result = {
      label: text(source.label, 100),
      detail: text(source.detail ?? source.value ?? source.text, options.detailLength || 300),
      tone: tone(source.tone ?? source.state, options.defaultTone || 'neutral')
    };
    if (options.withPercent) result.percent = percent(source.percent ?? source.value) ?? 0;
    return result;
  }).filter(row => row.label || row.detail);
}

function sanitizeMissionView(value, fallback = {}) {
  const source = object(value);
  const fallbackSource = object(fallback);
  const target = object(source.target);
  const flight = object(source.flight);
  const comfort = object(source.comfort);
  const cargo = object(source.cargo);
  return {
    schema: MISSION_VIEW_SCHEMA,
    version: MISSION_VIEW_VERSION,
    capturedAt: Math.max(0, Math.round(Number(source.capturedAt) || Number(fallbackSource.updatedAt) || 0)),
    title: text(source.title || fallbackSource.title || fallbackSource.name || fallbackSource.missionId || 'Aktive Mission', 150),
    story: text(source.story || source.summary, 6000),
    status: text(source.status || fallbackSource.state || (fallbackSource.active ? 'Mission aktiv' : 'Mission liegt bereit'), 120),
    detail: text(source.detail, 500),
    currentTask: text(source.currentTask || source.nextStep, 500),
    taskTone: tone(source.taskTone, 'active'),
    active: source.active !== undefined ? source.active === true : fallbackSource.active !== false,
    domain: text(source.domain, 80).toLowerCase(),
    domainLabel: text(source.domainLabel, 100),
    phase: sanitizePhase(source.phase),
    target: {
      name: text(target.name, 120),
      distanceNm: finite(target.distanceNm),
      bearingDeg: finite(target.bearingDeg),
      route: text(target.route, 220)
    },
    flight: {
      mslFt: finite(flight.mslFt),
      aglFt: finite(flight.aglFt),
      gsKts: finite(flight.gsKts),
      onGround: typeof flight.onGround === 'boolean' ? flight.onGround : null,
      trackerLive: flight.trackerLive === true
    },
    progress: sanitizeRows(source.progress, 12, { withPercent: true, defaultTone: 'active' }),
    requirements: sanitizeRows(source.requirements, 14),
    feedback: sanitizeRows(source.feedback, 6, { detailLength: 600, defaultTone: 'info' }),
    comfort: {
      available: comfort.available === true || finite(comfort.score) !== null,
      score: percent(comfort.score),
      tone: tone(comfort.tone, 'muted'),
      state: text(comfort.state || comfort.mood, 100),
      detail: text(comfort.detail, 240)
    },
    cargo: {
      available: cargo.available === true || finite(cargo.conditionPct) !== null,
      conditionPct: percent(cargo.conditionPct),
      tone: tone(cargo.tone, 'muted'),
      state: text(cargo.state, 100),
      detail: text(cargo.detail, 240),
      requiredLoaded: Math.max(0, Math.round(Number(cargo.requiredLoaded) || 0)),
      requiredTotal: Math.max(0, Math.round(Number(cargo.requiredTotal) || 0))
    }
  };
}

function missionParts(activeRun) {
  const bundle = object(activeRun?.resumeBundle);
  const state = object(bundle.missionState);
  const mission = object(state.currentMissionData || state);
  const contract = object(state.activeMissionContract || mission.missionContract);
  const passenger = object(state.activePassenger || mission.passenger || contract.passenger);
  const runtimeRoot = object(bundle.runtime);
  const runtime = object(runtimeRoot.runtime);
  return { bundle, state, mission, contract, passenger, runtimeRoot, runtime };
}

function fallbackView(activeRun, flightSnapshot) {
  const parts = missionParts(activeRun);
  const { mission, contract, passenger, runtimeRoot, runtime } = parts;
  const progress = object(runtimeRoot.poiProgress);
  const domain = text(passenger.taskDomain || contract.taskDomain || mission.taskDomain, 80).toLowerCase();
  const targetName = text(
    mission.targetName || mission.poiName || object(mission.bush).targetRef?.name
      || object(contract.bush).targetRef?.name || mission.dest || 'Missionsziel',
    120
  );
  const active = runtime.active !== undefined ? runtime.active === true : activeRun?.active !== false;
  const phaseName = text(runtime.phase || activeRun?.phase, 80).toLowerCase();
  let current = active ? 1 : 0;
  if (/end_ready|arrival|landing/.test(phaseName)) current = 2;
  if (/closing|complete|closed|ended/.test(phaseName)) current = 3;
  let currentTask = `${targetName} anfliegen`;
  if (!active) currentTask = 'Mission vorbereiten und starten';
  if (progress.aborted) currentTask = 'Sicher landen und Mission mit Abweichung abschließen';
  else if (progress.satisfied) currentTask = 'Zum vorgesehenen Landeplatz zurückkehren und landen';
  const flight = object(flightSnapshot?.flight);
  return sanitizeMissionView({
    capturedAt: activeRun?.updatedAt,
    title: mission.missionTitle || mission.mission || mission.title || activeRun?.missionId,
    story: mission.missionStory || mission.story || mission.s || contract.summary,
    status: active ? 'Mission aktiv' : 'Mission liegt bereit',
    detail: 'Missionsdaten aus der Tracker-Wahrheit.',
    currentTask,
    taskTone: progress.aborted ? 'danger' : (progress.satisfied ? 'good' : 'active'),
    active,
    domain,
    domainLabel: domain ? domain.replace(/_/g, ' ') : 'Flugauftrag',
    phase: { current },
    target: {
      name: targetName,
      route: [mission.start, mission.dest].map(value => text(value, 20)).filter(Boolean).join(' -> ')
    },
    flight: {
      mslFt: finite(flightSnapshot?.alt ?? flight.mslFt ?? flight.altFt),
      aglFt: finite(flight.aglFt),
      gsKts: finite(flight.gsKts ?? flight.gs),
      onGround: typeof flight.onGround === 'boolean' ? flight.onGround : null,
      trackerLive: Boolean(flightSnapshot)
    }
  }, activeRun);
}

function projectTrackerEfbMissionView(activeRun, flightSnapshot, technicalSnapshot = null, executionControl = null) {
  if (!activeRun?.missionId || !activeRun?.runId) return null;
  const bundle = object(activeRun.resumeBundle);
  const view = bundle.efbMission
    ? sanitizeMissionView(bundle.efbMission, activeRun)
    : fallbackView(activeRun, flightSnapshot);
  const liveFlight = object(flightSnapshot?.flight);
  if (flightSnapshot && typeof flightSnapshot === 'object') {
    view.flight = {
      mslFt: finite(flightSnapshot.alt ?? liveFlight.mslFt ?? liveFlight.altFt) ?? view.flight.mslFt,
      aglFt: finite(liveFlight.aglFt) ?? view.flight.aglFt,
      gsKts: finite(liveFlight.gsKts ?? liveFlight.gs) ?? view.flight.gsKts,
      onGround: typeof liveFlight.onGround === 'boolean' ? liveFlight.onGround : view.flight.onGround,
      trackerLive: true
    };
  }
  const technical = object(technicalSnapshot);
  const control = object(executionControl);
  if (control.executionAuthority === 'tracker' && text(control.missionId, 180) === text(activeRun.missionId, 180)) {
    const controlFlags = object(control.flags);
    const controlCargo = object(control.cargo);
    const cargoSummary = object(controlCargo.summary);
    const controlPhase = text(control.phase, 80).toLowerCase() || 'planned';
    const phaseCurrent = /^(closing|closed)$/.test(controlPhase)
      ? 3
      : (/^(end_unloading|end_ready)$/.test(controlPhase)
        ? 2
        : (/^(active|enroute|on_task|return_leg)$/.test(controlPhase) ? 1 : 0));
    const taskLabels = {
      prepare: 'Mission vorbereiten',
      complete_departure_manifest: 'Abflugmanifest vervollständigen',
      sign_departure_manifest: 'Abflugmanifest unterschreiben',
      confirm_load: 'Verladung bestätigen',
      await_boarding: 'Boarding abwarten',
      start_mission: 'Mission starten',
      fly_to_target: 'Zum Ziel fliegen',
      complete_pickup: 'Pickup abschließen',
      complete_task: 'Auftrag am Ziel erfüllen',
      return_and_land: 'Zurückfliegen und landen',
      complete_unload: 'Ladung am Ziel entladen',
      close_mission: 'Mission abschließen',
      await_close: 'Missionsabschluss wird verarbeitet',
      complete: 'Mission abgeschlossen'
    };
    view.active = controlFlags.active === true;
    view.status = controlFlags.closed === true
      ? 'Mission abgeschlossen'
      : (controlFlags.active === true ? 'Mission aktiv' : 'Mission in Vorbereitung');
    view.currentTask = taskLabels[text(control.nextStep, 80)] || view.currentTask;
    view.detail = 'Ausführungsstand und erlaubte Aktionen kommen direkt vom Tracker.';
    view.phase.current = phaseCurrent;
    view.cargo = {
      available: Number(cargoSummary.total || 0) > 0,
      conditionPct: view.cargo.conditionPct,
      tone: Number(cargoSummary.failed || 0) > 0 ? 'danger' : (Number(cargoSummary.pending || 0) > 0 ? 'warn' : 'good'),
      state: `${Math.max(0, Number(cargoSummary.loaded || 0))} geladen / ${Math.max(0, Number(cargoSummary.unloaded || 0))} entladen`,
      detail: Number(cargoSummary.pending || 0) > 0
        ? `${Math.max(0, Number(cargoSummary.pending || 0))} Positionen noch offen`
        : 'Manifest synchron',
      requiredLoaded: Math.max(0, Number(cargoSummary.loaded || 0)),
      requiredTotal: Math.max(0, Number(cargoSummary.requiredTotal || 0))
    };
  }
  return {
    schema: 'ga.mission-snapshot.v2',
    version: 2,
    missionId: text(activeRun.missionId, 180),
    runId: text(activeRun.runId, 220),
    authority: 'tracker',
    state: control.executionAuthority === 'tracker' ? text(control.phase, 60) : (text(activeRun.state, 60) || 'active'),
    active: activeRun.active !== false,
    phase: control.executionAuthority === 'tracker' ? text(control.phase, 100) : text(activeRun.phase, 100),
    revision: Math.max(1, Math.round(Number(control.authorityRevision || activeRun.revision) || 1)),
    updatedAt: Math.max(0, Math.round(Number(activeRun.updatedAt) || 0)),
    sceneCount: Math.max(0, Math.round(Number(technical.sceneCount) || 0)),
    scenes: (Array.isArray(technical.scenes) ? technical.scenes : []).slice(0, 12).map(scene => ({
      sceneId: text(object(scene).sceneId, 220),
      objectCount: Math.max(0, Math.round(Number(object(scene).objectCount) || 0)),
      spawnedAt: Math.max(0, Math.round(Number(object(scene).spawnedAt) || 0))
    })).filter(scene => scene.sceneId),
    title: view.title,
    story: view.story,
    view
  };
}

module.exports = {
  MISSION_VIEW_SCHEMA,
  MISSION_VIEW_VERSION,
  sanitizeMissionView,
  projectTrackerEfbMissionView
};
