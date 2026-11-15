'use strict';

// Boarding layout (spawn, cargo and boarding points of the aircraft preset) of a
// tracker-led mission. The app freezes the layout into the execution effect plan
// at mission start; before boarding begins the pilot may still move the points.
// This core only replaces positions in the frozen plan: titles, figures, vehicle,
// manifest and timing stay as the app built them.

const SCHEMA = 'ga.mission-boarding-layout.v1';
const MAX_OFFSET_M = 45;
const MAX_PATH_POINTS = 12;
const MARKER_TITLE = 'Cone_Medium';
const MARKER_SCENE_SUFFIX = '-boarding-markers';

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizePoint(raw) {
  const source = safeObject(raw);
  const forwardM = finite(source.forwardM);
  const rightM = finite(source.rightM);
  if (forwardM === null || rightM === null) return null;
  if (Math.abs(forwardM) > MAX_OFFSET_M || Math.abs(rightM) > MAX_OFFSET_M) return null;
  const altOffsetFt = finite(source.altOffsetFt);
  return {
    forwardM: Math.round(forwardM * 100) / 100,
    rightM: Math.round(rightM * 100) / 100,
    altOffsetFt: altOffsetFt === null ? 0 : Math.max(-20, Math.min(20, Math.round(altOffsetFt * 10) / 10))
  };
}

function samePoint(a, b) {
  return !!a && !!b && a.forwardM === b.forwardM && a.rightM === b.rightM && a.altOffsetFt === b.altOffsetFt;
}

// Layout sent by the app. Returns { layout } or { error }.
function normalizeLayout(raw) {
  const source = safeObject(raw);
  const spawn = normalizePoint(source.spawn);
  const cargo = normalizePoint(source.cargo);
  const target = normalizePoint(source.target);
  if (!spawn || !cargo || !target) return { error: 'boarding_layout_point_invalid' };
  const rawPath = Array.isArray(source.path) && source.path.length >= 2 ? source.path : [spawn, cargo, target];
  if (rawPath.length > MAX_PATH_POINTS) return { error: 'boarding_layout_path_too_long' };
  const path = rawPath.map(normalizePoint);
  if (path.some(point => !point)) return { error: 'boarding_layout_point_invalid' };
  const cargoIndex = finite(source.cargoIndex);
  if (cargoIndex === null || cargoIndex < 0 || cargoIndex >= path.length || Math.round(cargoIndex) !== cargoIndex) {
    return { error: 'boarding_layout_cargo_index_invalid' };
  }
  if (!samePoint(path[0], spawn) || !samePoint(path[path.length - 1], target) || !samePoint(path[cargoIndex], cargo)) {
    return { error: 'boarding_layout_path_mismatch' };
  }
  const walkSpeedKts = finite(source.walkSpeedKts);
  const durationMs = finite(source.durationMs);
  const labels = Array.isArray(source.pathLabels) && source.pathLabels.length === path.length
    ? source.pathLabels.map(label => String(label || '').slice(0, 40))
    : null;
  return {
    layout: {
      schema: SCHEMA,
      aircraftSlot: String(source.aircraftSlot || '').trim().slice(0, 80),
      spawn,
      cargo,
      target,
      path,
      cargoIndex,
      pathLabels: labels,
      walkSpeedKts: walkSpeedKts !== null && walkSpeedKts > 0.5 && walkSpeedKts < 12 ? walkSpeedKts : null,
      durationMs: durationMs !== null && durationMs >= 3000 && durationMs <= 120000 ? Math.round(durationMs) : null,
      openDoor: typeof source.openDoor === 'boolean' ? source.openDoor : null
    }
  };
}

// Layout currently frozen in the plan, read from the boarding command.
function planLayout(plan) {
  const effects = safeObject(safeObject(plan).effects);
  const boarding = safeObject(safeObject(effects['scene.boarding']).command);
  const path = Array.isArray(boarding.path) ? boarding.path.map(normalizePoint) : [];
  if (path.length < 2 || path.some(point => !point)) return null;
  const cargoIndex = finite(boarding.cargoPathIndex);
  const index = cargoIndex !== null && cargoIndex >= 0 && cargoIndex < path.length ? cargoIndex : 1;
  return {
    aircraftSlot: String(boarding.aircraftSlot || '').trim(),
    spawn: normalizePoint(boarding.spawnPoint) || path[0],
    cargo: normalizePoint(safeObject(plan).cargoPlacement) || path[Math.min(index, path.length - 1)],
    target: normalizePoint(boarding.targetPoint) || path[path.length - 1],
    path,
    cargoIndex: index,
    walkSpeedKts: finite(boarding.walkSpeedKts),
    durationMs: finite(boarding.durationMs),
    openDoor: typeof boarding.openDoor === 'boolean' ? boarding.openDoor : null
  };
}

function layoutDiffers(current, next) {
  if (!current) return true;
  if (!samePoint(current.spawn, next.spawn) || !samePoint(current.cargo, next.cargo) || !samePoint(current.target, next.target)) return true;
  if (current.cargoIndex !== next.cargoIndex || current.path.length !== next.path.length) return true;
  if (current.path.some((point, index) => !samePoint(point, next.path[index]))) return true;
  if (next.walkSpeedKts !== null && current.walkSpeedKts !== next.walkSpeedKts) return true;
  if (next.durationMs !== null && current.durationMs !== next.durationMs) return true;
  if (next.openDoor !== null && current.openDoor !== next.openDoor) return true;
  return false;
}

// Boarders waiting at the spawn point. With a scene vehicle the second boarder
// stands at the vehicle instead and keeps its place; group members stand in a
// row beside the spawn point (same forward offset, lateral spread).
function isSpawnBoarderItem(item, spawn) {
  if (!/^person_boarder_\d+$/.test(String(item?.kind || ''))) return false;
  const forwardM = finite(item.forwardM);
  const rightM = finite(item.rightM);
  return forwardM !== null && rightM !== null
    && Math.abs(forwardM - spawn.forwardM) <= 0.05 && Math.abs(rightM - spawn.rightM) <= 8;
}

function isCargoItem(item) {
  return Boolean(item?.cargoItemId) || /^cargo(_|$)/.test(String(item?.cargoSceneKind || item?.kind || ''));
}

function shiftItem(item, delta) {
  const forwardM = finite(item.forwardM);
  const rightM = finite(item.rightM);
  if (forwardM === null || rightM === null) return item;
  return {
    ...item,
    forwardM: Math.round((forwardM + delta.forwardM) * 100) / 100,
    rightM: Math.round((rightM + delta.rightM) * 100) / 100,
    altOffsetFt: Math.round(((finite(item.altOffsetFt) || 0) + delta.altOffsetFt) * 10) / 10
  };
}

function pointDelta(from, to) {
  return {
    forwardM: to.forwardM - from.forwardM,
    rightM: to.rightM - from.rightM,
    altOffsetFt: to.altOffsetFt - from.altOffsetFt
  };
}

function applyWalkFields(command, layout) {
  const next = { ...command, path: clone(layout.path), cargoPathIndex: layout.cargoIndex,
    spawnPoint: clone(layout.spawn), targetPoint: clone(layout.target) };
  if (layout.walkSpeedKts !== null && Object.hasOwn(command, 'walkSpeedKts')) next.walkSpeedKts = layout.walkSpeedKts;
  if (layout.openDoor !== null && Object.hasOwn(command, 'openDoor')) next.openDoor = layout.openDoor;
  return next;
}

// Returns { ok, plan, changed } or { ok:false, error }. The plan is a copy.
function applyLayout(plan, rawLayout) {
  const normalized = normalizeLayout(rawLayout);
  if (normalized.error) return { ok: false, error: normalized.error };
  const layout = normalized.layout;
  const source = safeObject(plan);
  const effects = safeObject(source.effects);
  const boardingEntry = safeObject(effects['scene.boarding']);
  const prepareEntry = safeObject(effects['scene.prepare']);
  if (!boardingEntry.command || !prepareEntry.command) return { ok: false, error: 'boarding_layout_not_supported' };
  const current = planLayout(source);
  if (!current) return { ok: false, error: 'boarding_layout_not_supported' };
  if (current.aircraftSlot && layout.aircraftSlot && current.aircraftSlot !== layout.aircraftSlot) {
    return { ok: false, error: 'boarding_layout_aircraft_mismatch' };
  }
  if (!layoutDiffers(current, layout)) return { ok: true, changed: false, plan: clone(source), layout };

  const next = clone(source);
  const nextEffects = next.effects;
  const spawnDelta = pointDelta(current.spawn, layout.spawn);
  const cargoDelta = pointDelta(current.cargo, layout.cargo);
  const prepare = nextEffects['scene.prepare'].command;
  if (Array.isArray(prepare.items)) {
    prepare.items = prepare.items.map(item => {
      if (isSpawnBoarderItem(item, current.spawn)) return shiftItem(item, spawnDelta);
      if (isCargoItem(item)) return shiftItem(item, cargoDelta);
      return item;
    });
  }
  const boarding = applyWalkFields(nextEffects['scene.boarding'].command, layout);
  if (layout.durationMs !== null && Object.hasOwn(boarding, 'durationMs')) boarding.durationMs = layout.durationMs;
  nextEffects['scene.boarding'].command = boarding;
  const deboarding = safeObject(safeObject(nextEffects['scene.deboarding']).command);
  if (Array.isArray(deboarding.path)) nextEffects['scene.deboarding'].command = applyWalkFields(deboarding, layout);
  if (Array.isArray(next.manualPassengerCommands)) {
    next.manualPassengerCommands = next.manualPassengerCommands.map(entry => {
      const command = safeObject(entry?.command);
      if (!Array.isArray(command.path)) return entry;
      const moved = applyWalkFields(command, layout);
      if (samePoint(normalizePoint(command.boardingPoint), current.target)) moved.boardingPoint = clone(layout.target);
      if (samePoint(normalizePoint(command.targetPoint), current.target)) moved.targetPoint = clone(layout.target);
      return { ...entry, command: moved };
    });
  }
  next.cargoPlacement = clone(layout.cargo);
  next.boardingLayoutRevision = Math.max(0, Math.round(Number(source.boardingLayoutRevision) || 0)) + 1;
  return { ok: true, changed: true, plan: next, layout };
}

function markerSceneId(plan) {
  const sceneId = String(safeObject(plan).sceneId || safeObject(safeObject(safeObject(plan).effects)['scene.prepare']).command?.sceneId || '').trim();
  return sceneId ? `${sceneId}${MARKER_SCENE_SUFFIX}` : '';
}

function isMarkerSceneId(sceneId) {
  return String(sceneId || '').endsWith(MARKER_SCENE_SUFFIX);
}

// Cones at every point of the boarding path, relative to the aircraft.
function buildMarkerItems(plan, labels = null) {
  const layout = planLayout(plan);
  if (!layout) return [];
  return layout.path.slice(0, 10).map((point, index) => {
    const label = Array.isArray(labels) && labels[index] ? labels[index]
      : (index === 0 ? 'Spawn' : (index === layout.path.length - 1 ? 'Boarding'
        : (index === layout.cargoIndex ? 'Cargo' : `Wegpunkt ${index}`)));
    return {
      kind: `marker_${index + 1}`,
      label: `Boarding ${label} Marker`,
      objectTitle: MARKER_TITLE,
      titleCandidates: [MARKER_TITLE, 'Cone Medium'],
      forwardM: point.forwardM,
      rightM: point.rightM,
      headingMode: 'with_aircraft',
      altOffsetFt: point.altOffsetFt
    };
  });
}

module.exports = Object.freeze({
  SCHEMA,
  MARKER_SCENE_SUFFIX,
  normalizeLayout,
  planLayout,
  applyLayout,
  markerSceneId,
  isMarkerSceneId,
  buildMarkerItems
});
