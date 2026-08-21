'use strict';

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
  const values = [leftLat, leftLon, rightLat, rightLon].map(Number);
  if (!values.every(Number.isFinite)) return null;
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
      healthPct: Math.max(0, Math.min(100, Math.round(Number(authoritative.healthPct ?? source.healthPct) || 100))),
      station: manifestStationLabel(source),
      reloadDistanceM: unloadDistanceM === null ? null : Math.round(unloadDistanceM),
      reloadAllowed: text(authoritative.status || source.status, 30).toLowerCase() !== 'unloaded'
        || (unloadDistanceM !== null && unloadDistanceM <= 200)
    };
  });
  return {
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

function projectTrackerEfbMissionView(activeRun, flightSnapshot, technicalSnapshot = null, executionControl = null, payloadSnapshot = null) {
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
  const voice = farewellVoice.text && Number(farewellVoice.updatedAt || 0) >= Number(boardingVoice.updatedAt || 0)
    ? farewellVoice
    : boardingVoice;
  const manifest = projectMissionManifest(activeRun, control, flightSnapshot);
  const ui = control.executionAuthority === 'tracker'
    ? aptUiCore.project({
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
