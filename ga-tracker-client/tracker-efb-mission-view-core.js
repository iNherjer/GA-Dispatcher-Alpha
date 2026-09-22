'use strict';
const poiUiCore = require('../mission-poi-ui-core.js');
const poiTaskCore = require('../mission-poi-task-core.js');

const aptUiCore = require('../mission-apt-ui-core.js');
const payloadCore = require('../mission-payload-core.js');

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
  if (value === null || value === undefined || value === '') return null;
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

function manifestItemId(raw, index) {
  const source = object(raw);
  return text(source.id || source.cargoItemId || `item-${index + 1}`, 120) || `item-${index + 1}`;
}

function distanceMeters(leftLat, leftLon, rightLat, rightLon) {
  const values = [leftLat, leftLon, rightLat, rightLon].map(finite);
  if (values.some(value => value === null)) return null;
  const [lat1, lon1, lat2, lon2] = values.map(value => value * Math.PI / 180);
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function manifestStationLabel(source) {
  const direct = text(source.stationLabel || source.seatLabel || source.station || source.position, 100);
  if (direct) return direct;
  const stations = Array.from(new Set((Array.isArray(source.payloadStations) ? source.payloadStations : [])
    .map(value => Math.round(Number(value)))
    .filter(value => Number.isFinite(value) && value >= 1)));
  if (!stations.length) return '';
  if (text(source.payloadStationAdapter, 80) !== 'pa24_accusim') return stations.join('/');
  const labels = { 2: 'Sitz 2', 3: 'Sitz 3', 4: 'Sitz 4', 5: 'Gepäckfach' };
  return stations.map(station => labels[station] || `S${station}`).join(' / ');
}

function projectMissionManifest(activeRun, executionControl, flightSnapshot = null) {
  const parts = missionParts(activeRun);
  const control = object(executionControl);
  const controlManifest = object(control.manifest);
  const rawManifest = Array.isArray(controlManifest.items)
    ? controlManifest
    : object(parts.runtimeRoot.cargoManifest || parts.state.cargoManifest || parts.mission.cargoManifest);
  const controlCargo = object(control.cargo);
  const controlItems = Array.isArray(controlCargo.items) ? controlCargo.items : [];
  const controlById = new Map(controlItems.map(item => [text(object(item).id, 120), object(item)]));
  const rawItems = Array.isArray(rawManifest.items) ? rawManifest.items : [];
  const liveFlight = object(flightSnapshot?.flight);
  const liveLat = finite(flightSnapshot?.lat ?? liveFlight.lat);
  const liveLon = finite(flightSnapshot?.lon ?? liveFlight.lon);
  const items = rawItems.slice(0, 160).map((rawItem, index) => {
    const source = object(rawItem);
    const id = manifestItemId(source, index);
    const authoritative = controlById.get(id) || {};
    const passenger = text(authoritative.itemType || source.itemType, 30).toLowerCase() === 'passenger';
    const persistentEquipment = source.persistentEquipment === true;
    const unloadLat = finite(source.unloadLat);
    const unloadLon = finite(source.unloadLon);
    const hasUnloadPosition = unloadLat !== null && unloadLon !== null && !(unloadLat === 0 && unloadLon === 0);
    const unloadDistanceM = distanceMeters(liveLat, liveLon, source.unloadLat, source.unloadLon);
    return {
      id,
      label: text(source.storyName || source.label || source.name || id, 180),
      itemType: passenger ? 'passenger' : (persistentEquipment ? 'equipment' : 'cargo'),
      status: text(authoritative.status || source.status || 'pending', 30).toLowerCase(),
      required: authoritative.required === true || source.required === true,
      pickup: text(authoritative.pickup || source.pickup || (source.pickupLocation === 'target' ? 'target' : 'departure'), 30).toLowerCase(),
      delivery: text(authoritative.delivery || source.delivery || (source.deliverAtHome === true
        ? 'home'
        : (source.deliverAtDestination === false ? 'onboard' : 'destination')), 30).toLowerCase(),
      persistentEquipment,
      equipmentType: text(source.equipmentType, 40).toLowerCase(),
      expiresAt: text(source.expiresAt, 20),
      issuedAt: Math.max(0, Math.round(Number(source.issuedAt) || 0)) || null,
      serialId: text(source.serialId, 180),
      log: source.log && typeof source.log === 'object' ? { ...source.log } : {},
      persistentEquipmentInherited: source.persistentEquipmentInherited === true,
      handoffComplete: authoritative.status === 'handed_off' || source.handoffComplete === true,
      passengerCount: passenger
        ? Math.max(1, Math.min(6, Math.round(Number(authoritative.passengerCount || source.passengerCount) || 1)))
        : 0,
      weightLbs: Math.max(0, Math.round(Number(authoritative.weightLbs ?? source.weightLbs) || 0)),
      healthPct: Math.max(0, Math.min(100, Math.round(finite(authoritative.healthPct ?? source.healthPct) ?? 100))),
      station: manifestStationLabel(source),
      reloadDistanceM: unloadDistanceM === null ? null : Math.round(unloadDistanceM),
      reloadAllowed: text(authoritative.status || source.status, 30).toLowerCase() !== 'unloaded'
        || !hasUnloadPosition
        || (unloadDistanceM !== null && unloadDistanceM <= 200)
    };
  });
  return {
    pilotId: text(rawManifest.pilotId, 180) || null,
    aircraftLabel: text(rawManifest.aircraftLabel, 180) || null,
    aircraftSlot: text(rawManifest.aircraftSlot, 120) || null,
    createdAt: Math.max(0, Math.round(Number(rawManifest.createdAt) || 0)) || null,
    dispatchSignature: rawManifest.dispatchSignature && typeof rawManifest.dispatchSignature === 'object'
      ? { ...rawManifest.dispatchSignature }
      : null,
    flightEvents: {
      flightId: `${text(control.missionId, 180)}|flight`,
      ...object(rawManifest.flightEvents),
      ...object(control.flightEvents)
    },
    signatureScope: ['departure', 'pickup', 'arrival'].includes(text(controlCargo.signatureScope || rawManifest.signatureScope || object(rawManifest.dispatchSignature).scope, 20).toLowerCase())
      ? text(controlCargo.signatureScope || rawManifest.signatureScope || object(rawManifest.dispatchSignature).scope, 20).toLowerCase()
      : null,
    summary: object(controlCargo.summary),
    items
  };
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

function projectTrackerEfbMissionView(activeRun, flightSnapshot, technicalSnapshot = null, executionControl = null, payloadSnapshot = null, identity = {}) {
  if (!activeRun?.missionId || !activeRun?.runId) return null;
  const parts = missionParts(activeRun);
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
  const uiControl = control.executionAuthority === 'tracker' && payloadSnapshot
    ? {
        ...control,
        payload: payloadCore.projectOutcome({
          ...object(control.payload),
          weightAndBalance: payloadSnapshot
        })
      }
    : control;
  const boardingVoice = object(object(control.voice).boarding);
  const farewellVoice = object(object(control.voice).farewell);
  const voice = [farewellVoice, object(object(control.voice).poi), object(object(control.voice).flight), object(object(control.voice).approach), boardingVoice]
    .filter(value => value.text).sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0] || {};
  const manifest = projectMissionManifest(activeRun, control, flightSnapshot);
  const pilotId = text(identity.pilotId, 180);
  if (pilotId) {
    manifest.pilotId = pilotId;
    // Older Tracker builds persisted their technical fallback as the signer.
    // Correct only that fallback in the view; preserve genuine signed names.
    if (manifest.dispatchSignature?.by === 'Tracker') manifest.dispatchSignature.by = pilotId;
  }
  const ui = control.executionAuthority === 'tracker'
    ? (control.recipe === 'poi' ? poiUiCore : aptUiCore).project({
        missionId: activeRun.missionId,
        revision: control.authorityRevision || activeRun.revision,
        control: uiControl,
        manifest,
        missionProfileId: text(parts.mission?.bush?.profileId || parts.contract?.bush?.profileId || parts.mission?.profileId, 100).toLowerCase(),
        pickupKind: text(parts.mission?.bush?.pickupKind || parts.contract?.bush?.pickupKind, 40).toLowerCase(),
        destination: object(control.flight).destination
      })
    : null;
  if (control.executionAuthority === 'tracker' && text(control.missionId, 180) === text(activeRun.missionId, 180)) {
    const controlFlags = object(control.flags);
    const controlCargo = object(control.cargo);
    const cargoSummary = object(controlCargo.summary);
    const health = manifest.items.filter(item => item.itemType !== 'passenger' && ['loaded', 'unloaded', 'dropped', 'handed_off'].includes(item.status)).map(item => item.healthPct);
    const conditionPct = Math.round(Math.min(health.length ? Math.min(...health) : 100,
      100 - Math.max(0, Math.min(100, finite(control.manifest?.maxStressDamagePct) ?? 0))));
    const controlPhase = text(control.phase, 80).toLowerCase() || 'planned';
    const phaseCurrent = /^(closing|closed)$/.test(controlPhase)
      ? 3
      : (/^(end_unloading|end_ready)$/.test(controlPhase)
        ? 2
        : (/^(active|enroute|on_task|return_leg)$/.test(controlPhase) ? 1 : 0));
    const taskLabels = {
      activate_cloud_mission: 'Mission aus der Cloud übernehmen und vorbereiten',
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
      sign_arrival_manifest: 'Ankunftsmanifest unterschreiben',
      confirm_unload: 'Entladung bestätigen',
      await_farewell: 'Verabschiedung abwarten',
      await_deboarding: 'Deboarding abwarten',
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
    if (control.recipe === 'poi' && control.poiStatus && controlFlags.active) {
      view.detail = control.poiStatus.detail;
      if (['active', 'enroute', 'on_task', 'return_leg'].includes(controlPhase)) view.currentTask = control.poiStatus.nextStep;
    }
    view.phase.current = phaseCurrent;
    const comfort = control.comfort;
    const comfortScore = finite(comfort?.comfortScore);
    view.comfort = comfortScore === null ? { available: false, score: null, tone: 'muted',
      state: 'Noch keine aktuelle Wertung', detail: 'Wird im Tracker erfasst' } : {
      available: true, score: percent(comfortScore), tone: comfortScore >= 72 ? 'good' : comfortScore >= 55 ? 'warn' : 'danger',
      state: text(comfort.mood, 100), detail: `${Number(comfort.pilotEvents) || 0} Pilot · ${Number(comfort.weatherEvents) || 0} Wetter`
    };
    view.feedback = [];

    view.cargo = {
      available: Number(cargoSummary.total || 0) > 0,
      conditionPct,
      tone: Number(cargoSummary.failed || 0) > 0 || conditionPct <= 35 ? 'danger' : (Number(cargoSummary.pending || 0) > 0 ? 'warn' : 'good'),
      state: `${Math.max(0, Number(cargoSummary.loaded || 0))} geladen / ${Math.max(0, Number(cargoSummary.unloaded || 0))} entladen`,
      detail: Number(cargoSummary.pending || 0) > 0
        ? `${Math.max(0, Number(cargoSummary.pending || 0))} Positionen noch offen`
        : 'Manifest synchron',
      requiredLoaded: manifest.items.filter(item => item.required && item.status === 'loaded').length,
      requiredTotal: Math.max(0, Number(cargoSummary.requiredTotal || 0))
    };
    // Seed rows are briefing-time observations, never live execution truth.
    const required = manifest.items.filter(item => item.required);
    const requiredLoaded = required.filter(item => item.status === 'loaded').length;
    const requiredHealth = required.filter(item => item.itemType !== 'passenger');
    const requiredCondition = Math.round(Math.min(requiredHealth.length ? Math.min(...requiredHealth.map(item => item.healthPct)) : 100,
      100 - Math.max(0, Math.min(100, finite(control.manifest?.maxStressDamagePct) ?? 0))));
    const cargoTone = required.some(item => item.status === 'dropped' || item.healthPct <= 35)
      ? 'danger' : requiredLoaded < required.length || requiredCondition < 75 ? 'warn' : 'good';
    view.cargo.requiredTotal = required.length;
    view.cargo.requiredLoaded = requiredLoaded;
    view.progress = view.progress.filter(row => row.label !== 'Pflichtmanifest');
    view.requirements = view.requirements.filter(row => row.label !== 'Pflichtladung');
    if (required.length) {
      view.progress.push({ label: 'Pflichtmanifest', percent: requiredLoaded / required.length * 100,
        detail: `${requiredLoaded}/${required.length} an Bord`, tone: cargoTone });
      view.requirements.push({ label: 'Pflichtladung',
        detail: `${requiredLoaded}/${required.length} an Bord · Zustand ${requiredCondition}%`, tone: cargoTone });
    }
    const recipe = bundle.executionPoiRecipe;
    if (control.recipe === 'poi' && recipe && control.poiTask) {
      const task = control.poiTask;
      const duration = Math.max(0, Number(recipe.passenger?.targetDwellMin) || 0) * 60 * (recipe.strict ? 1 : 0.5);
      const completed = Math.max(0, Number(task.dwellSec) || 0);
      const formatDuration = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
      view.progress = view.progress.filter(row => row.label === 'Pflichtmanifest');
      view.progress.unshift({ label: 'Zeit im Arbeitsbereich',
        percent: task.satisfied ? 100 : duration > 0 ? Math.min(100, completed / duration * 100) : 0,
        detail: `${formatDuration(completed)} / ${formatDuration(duration)}${task.satisfied ? ' · erfüllt' : ''}`,
        tone: task.aborted ? 'danger' : task.satisfied ? 'good' : 'active' });
      if (recipe.taskDomain === 'mapping_survey') {
        const survey = task.surveyPattern || {};
        const orbit = recipe.surveyPattern?.type === 'orbit';
        const done = orbit ? Number(survey.orbit?.completedTurns || 0) : (survey.scan?.completedLineIds || []).length;
        const total = orbit ? Number(recipe.surveyPattern.orbit.requiredTurns) : recipe.surveyPattern.scan.lines.length;
        const partial = Number(orbit ? survey.orbit?.activeCoverage : survey.scan?.activeCoverage) || 0;
        view.progress[0] = { label: orbit ? 'Survey-Kreise' : 'Survey-Linien',
          percent: task.satisfied ? 100 : Math.min(100, (done + partial) / Math.max(1, total) * 100),
          detail: `${done}/${total} abgeschlossen · laufender Abschnitt ${Math.round(partial * 100)}%`,
          tone: task.aborted ? 'danger' : task.satisfied ? 'good' : 'active' };
      }
      if (recipe.taskDomain === 'infra_chain_recon') {
        const chain = task.poiChain || {};
        const total = recipe.poiChain.points.filter(point => point.required !== false).length;
        const done = recipe.poiChain.points.filter(point => point.required !== false && (chain.completedPointIds || []).includes(point.id)).length;
        view.progress[0] = { label: 'Kettenpunkte', percent: done / Math.max(1, total) * 100, detail: `${done}/${total} dokumentiert`, tone: task.satisfied ? 'good' : 'active' };
        if (chain.corridor?.totalSegments) view.progress.splice(1, 0, { label: 'Korridor', percent: (chain.corridor.completedCount + (chain.corridor.activeCoverage || 0)) / chain.corridor.totalSegments * 100, detail: `${chain.corridor.completedCount}/${chain.corridor.totalSegments} Abschnitte · laufend ${Math.round((chain.corridor.activeCoverage || 0) * 100)}%`, tone: chain.corridor.satisfied ? 'good' : 'active' });
      }
      view.taskTone = task.aborted ? 'danger' : task.satisfied ? 'good' : 'active';
      // The seed feedback describes the preflight state and is stale after handoff.
      view.feedback.push({ label: 'Arbeitsbereich', detail: control.poiStatus?.detail ||
        (task.aborted ? 'Auftrag abgebrochen' : task.satisfied ? 'Auftrag erfüllt' : task.inRadius ? 'Im Arbeitsbereich' : 'Arbeitsbereich anfliegen'), tone: view.taskTone });
      if (recipe.taskDomain !== 'mapping_survey' && task.inRadius && task.altWasOk === false && !task.aborted && !task.satisfied) view.feedback.push({
        label: 'Arbeitshöhe', detail: 'Außerhalb der Arbeitshöhe: Arbeitszeit pausiert. Zielhöhe wieder einhalten.', tone: 'warn' });
    }
    const taskItems = control.taskItems;
    const cargoFeedback = [];
    if (taskItems) {
      for (const [key, label, wording] of [['damaged', 'Pflichtladung beschädigt', 'Beschädigt'],
        ['dropped', 'Pflichtladung abgeworfen', 'Abgeworfen'], ['missing', 'Pflichtladung fehlt', 'Noch nicht geladen']]) {
        if (taskItems[key]?.length) cargoFeedback.push({ label, detail: `${wording}: ${taskItems[key].map(name => text(name, 160)).join(', ')}.`,
          tone: key === 'missing' && !view.active ? 'warn' : 'danger' });
      }
      const unloaded = required.filter(item => item.status === 'unloaded');
      if (unloaded.length && control.recipe === 'poi') cargoFeedback.push({ label: 'Pflichtladung entladen', tone: 'info',
        detail: `${unloaded.map(item => item.label).join(', ')}: nicht an Bord; entladen zählt in der bestehenden POI-Prüfung nicht als fehlend.` });
    }
    if (conditionPct < 75 && !taskItems?.damaged?.length) cargoFeedback.push({ label: 'Ladungszustand', tone: 'warn',
      detail: `Ladung bei ${conditionPct} %. Ruhiger weiterfliegen.` });
    view.feedback = cargoFeedback.concat(view.feedback);
    if (comfort?.pilotEvents > 0) view.feedback.push({ label: 'PAX-Komfort', tone: comfort.pilotSevere > 0 ? 'danger' : 'warn',
      detail: `${comfort.pilotEvents} auffällige Flugbewegungen, davon ${comfort.pilotSevere || 0} schwer.` });
    if (comfort?.weatherEvents > 0) view.feedback.push({ label: 'Wettereinfluss', tone: 'info',
      detail: `${comfort.weatherEvents} Wetterereignisse; getrennt von Pilotenereignissen gewertet.` });
    if (control.recipe === 'poi' && recipe?.target) {
      const lat = finite(flightSnapshot?.lat), lon = finite(flightSnapshot?.lon);
      view.target.distanceNm = lat !== null && lon !== null ? poiTaskCore.distanceNm(lat, lon, recipe.target.lat, recipe.target.lon) : null;
      view.target.bearingDeg = lat !== null && lon !== null ? poiTaskCore.bearingDeg(lat, lon, recipe.target.lat, recipe.target.lon) : null;
      // Replace briefing-time observations with the same live inputs as the cards.
      view.requirements = view.requirements.filter(row => !['Arbeitsbereich', 'Arbeitshöhe', 'Verweilzeit'].includes(row.label));
      const pax = recipe.passenger || {};
      const radius = Number(pax.targetRadiusNm) || 1.5;
      const distance = view.target.distanceNm;
      view.requirements.push({label:'Arbeitsbereich', detail:`Radius ${radius.toFixed(1)} NM · aktuell ${distance === null ? 'unbekannt' : distance.toFixed(1) + ' NM'}`, tone:distance === null ? 'muted' : distance <= radius ? 'good' : 'warn'});
      const targetAlt = Number(pax.targetAltFt) || 0;
      const alt = view.flight.mslFt;
      view.requirements.push({label:'Arbeitshöhe', detail:targetAlt ? `${targetAlt} ft MSL · aktuell ${alt === null ? 'unbekannt' : Math.round(alt) + ' ft MSL'}` : 'Keine Höhenvorgabe', tone:'neutral'});
      const seconds = Math.max(0, Number(pax.targetDwellMin) || 0) * 60 * (recipe.strict ? 1 : 0.5);
      view.requirements.push({label:'Verweilzeit', detail:`${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')} erforderlich`, tone:'neutral'});
      if (recipe.taskDomain === 'mapping_survey') {
        view.requirements = view.requirements.filter(row => !['Arbeitsbereich', 'Verweilzeit'].includes(row.label));
        const spec = recipe.surveyPattern;
        const altitudeRow = view.requirements.find(row => row.label === 'Arbeitshöhe');
        if (altitudeRow) altitudeRow.detail = `${spec.targetAltFt} ft MSL ± ${spec.altitudeToleranceFt} ft · aktuell ${alt === null ? 'unbekannt' : Math.round(alt) + ' ft MSL'}`;
        view.requirements.push({ label: 'Survey-Pattern', detail: spec.type === 'orbit'
          ? `${spec.orbit.requiredTurns} Kreise bei ${spec.orbit.radiusNm} NM Radius`
          : `${spec.scan.lines.length} Scanlinien vollständig abfliegen`, tone: 'neutral' });
      }
      if (recipe.taskDomain === 'infra_chain_recon') {
        view.requirements = view.requirements.filter(row => !['Arbeitsbereich', 'Verweilzeit', 'Arbeitshöhe'].includes(row.label));
        const chain = control.poiTask?.poiChain;
        const next = recipe.poiChain.points[chain?.currentIndex || 0];
        view.requirements.push({ label: 'POI-Kette', detail: next ? `Nächster Punkt: ${next.name} · Radius ${next.triggerRadiusNm} NM` : 'Fotopunkte abgeschlossen', tone: 'neutral' });
      }
      const task = control.poiTask || {};
      view.phase.stages = [{id:'preparation',label:'Vorbereitung'},{id:'enroute',label:'Anflug'},
        {id:'work',label:'Arbeitsbereich'},{id:'return',label:'Rückflug'},{id:'arrival',label:'Landung'},{id:'complete',label:'Abschluss'}];
      view.phase.current = /^(closing|closed)$/.test(controlPhase) ? 5 : /^(end_unloading|end_ready)$/.test(controlPhase) ? 4
        : controlPhase === 'return_leg' ? 3 : controlPhase === 'on_task' || (controlFlags.active && task.inRadius && !task.satisfied && !task.aborted) ? 2
        : /^(active|enroute)$/.test(controlPhase) ? 1 : 0;

    }
  }
  return {
    schema: 'ga.mission-snapshot.v2',
    version: 2,
    available: true,
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
    manifest,
    ui,
    voice: voice.text ? {
      kind: text(voice.kind, 40) || 'boarding',
      ...(voice.kind === 'poi' && voice.label ? { label: text(voice.label, 80) } : {}),
      status: text(voice.status, 40),
      text: text(voice.text, 4000),
      speaker: {
        name: text(object(voice.speaker).name, 120),
        role: text(object(voice.speaker).role, 160),
        gender: text(object(voice.speaker).gender, 20)
      },
      playback: text(voice.playback, 80) || null,
      updatedAt: Math.max(0, Math.round(Number(voice.updatedAt) || 0)) || null
    } : null,
    view
  };
}

module.exports = {
  MISSION_VIEW_SCHEMA,
  MISSION_VIEW_VERSION,
  projectMissionManifest,
  sanitizeMissionView,
  projectTrackerEfbMissionView
};
