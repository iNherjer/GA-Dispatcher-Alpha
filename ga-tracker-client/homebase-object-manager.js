'use strict';

const {
  SimConnectDataType,
  SimConnectPeriod,
  SimConnectConstants,
  InitPosition,
  RawBuffer,
  Waypoint
} = require('node-simconnect');
const catalog = require('./homebase-asset-catalog.js');
const routeCore = require('./homebase-route-core.js');
const { createHomebaseDoorAutomation } = require('./homebase-door-automation.js');

const INIT_POSITION_DEFINITION = 52001;
const OBJECT_ALTITUDE_DEFINITION = 52002;
const EVENT_FREEZE_LAT_LON = 52101;
const EVENT_FREEZE_ALTITUDE = 52102;
const EVENT_FREEZE_ATTITUDE = 52103;
const EVENT_OBJECT_ADDED = 52104;
const EVENT_OBJECT_REMOVED = 52105;
const HANGAR_ANIMATION_DEFINITION_START = 52200;
const HANGAR_ANIMATION_DEFINITION_LIMIT = 32;
const PERSON_WAYPOINT_DEFINITION = 52250;
const EVENT_GROUP_PRIORITY_HIGHEST = 1;
const EVENT_FLAG_GROUP_ID_IS_PRIORITY = 16;
const CREATE_TIMEOUT_MS = 12000;
const REMOVE_TIMEOUT_MS = 12000;
const MAX_OBJECTS = 100;
const MAX_CREW_OBJECTS = 100;
const MAX_HOMEBASE_PEOPLE = 3;
const MAX_PERSON_DESTINATIONS = 20;
const MAX_NAVIGATION_OBSTACLES = 300;

const assetByKey = new Map(catalog.assets.map((entry) => [entry.key, entry]));
const allowedPreviewTitles = new Set([
  ...catalog.assets.filter((entry) => entry.preview !== false && entry.kind !== 'internal' && (entry.kind === 'hangar' || entry.homebasePlaceable !== false)).map((entry) => entry.title),
  ...catalog.stockObjects.filter((entry) => entry.preview !== false).map((entry) => entry.title),
  assetByKey.get('spawnProbe')?.title
].filter(Boolean));
const allowedTarmacPeople = new Set((catalog.tarmacPeople || []).map((entry) => entry.title));

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function heading(value) {
  return ((finite(value) % 360) + 360) % 360;
}

function buildPosition(item, altitudeFt = finite(item?.altFt), onGround = true) {
  const position = new InitPosition();
  position.latitude = finite(item?.lat);
  position.longitude = finite(item?.lon);
  position.altitude = finite(altitudeFt);
  position.pitch = 0;
  position.bank = 0;
  position.heading = heading(item?.heading ?? item?.hdg);
  position.onGround = !!onGround;
  position.airspeed = 0;
  return position;
}

function normalizeItem(raw, fallbackId = '') {
  const sourceTitle = String(raw?.title || raw?.objectTitle || '').trim();
  const title = catalog.legacyTitleAliases[sourceTitle] || sourceTitle;
  const id = String(raw?.id || fallbackId || title).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  if (!id) throw new Error('Objekt-ID fehlt.');
  const runtimeDefinition = catalog.objectDefinitionForTitle(title);
  const runtimeAllowed = runtimeDefinition?.runtimeAsset === true
    && runtimeDefinition.preview !== false
    && runtimeDefinition.kind !== 'internal'
    && (runtimeDefinition.kind === 'hangar' || runtimeDefinition.homebasePlaceable !== false);
  if (!allowedPreviewTitles.has(title) && !allowedTarmacPeople.has(title) && !runtimeAllowed) throw new Error(`Objekttitel ist nicht freigegeben: ${title || '(leer)'}`);
  const lat = Number(raw?.lat);
  const lon = Number(raw?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new Error(`Ungültige Koordinaten für ${raw?.label || title}.`);
  }
  return {
    id,
    title,
    label: String(raw?.label || catalog.objectDefinitionForTitle(title)?.label || title),
    lat,
    lon,
    altFt: finite(raw?.altFt),
    heightOffsetFt: Math.max(-20, Math.min(200, finite(raw?.heightOffsetFt))),
    heading: heading(raw?.heading ?? raw?.hdg),
    scale: Math.max(0.1, Math.min(10, finite(raw?.scale, 1)))
  };
}

function createHomebaseObjectManager(handle, options = {}) {
  const sendAck = typeof options.sendAck === 'function' ? options.sendAck : () => {};
  const log = typeof options.log === 'function' ? options.log : () => {};
  const getLastGps = typeof options.getLastGps === 'function' ? options.getLastGps : () => null;
  const capabilities = Object.freeze([
    'homebase-preview',
    'homebase-ground-probe',
    'homebase-object-move',
    'homebase-object-remove',
    'homebase-crew-scene',
    'homebase-hangar-animation',
    'homebase-object-controls-v1',
    'homebase-door-automation-v1',
    'homebase-door-manual-override-v1',
    'homebase-people-routes-v1',
    'homebase-people-live-update-v1',
    ...(Array.isArray(options.extraCapabilities) ? options.extraCapabilities : [])
  ]);
  const generations = { preview: 0, crew: 0 };
  let nextRequestId = 53000;
  const objectsById = new Map();
  const objectsBySimId = new Map();
  const pendingCreates = new Map();
  const pendingCreatesByObjectId = new Map();
  const recentlyAddedObjectIds = new Set();
  const pendingGround = new Map();
  const pendingRemovals = new Map();
  const hangarAnimationDefinitions = new Map();
  const personControllers = new Map();
  let personWaypointDefinitionReady = false;
  let operationQueue = Promise.resolve();
  const doorAutomation = createHomebaseDoorAutomation(handle, { log });

  const nextId = () => {
    const id = nextRequestId++;
    if (nextRequestId > 64900) nextRequestId = 53000;
    return id;
  };

  const enqueue = (operation) => {
    const current = operationQueue.catch(() => {}).then(operation);
    operationQueue = current.catch(() => {});
    return current;
  };

  const offsetLatLon = (lat, lon, northM, eastM) => {
    const radius = 6371000;
    const latRad = finite(lat) * Math.PI / 180;
    return {
      lat: finite(lat) + (finite(northM) / radius) * 180 / Math.PI,
      lon: finite(lon) + (finite(eastM) / (radius * Math.max(.05, Math.cos(latRad)))) * 180 / Math.PI
    };
  };

  const localOffsetMeters = (baseLat, baseLon, lat, lon) => {
    const radius = 6371000;
    return {
      northM: (finite(lat) - finite(baseLat)) * Math.PI / 180 * radius,
      eastM: (finite(lon) - finite(baseLon)) * Math.PI / 180 * radius * Math.cos(finite(baseLat) * Math.PI / 180)
    };
  };

  const waitWhileCurrent = async (controller, durationMs, runToken = controller.runToken) => {
    let remaining = Math.max(0, finite(durationMs));
    while (remaining > 0 && controller.active && controller.runToken === runToken && isCurrentRecord(controller.record)) {
      const chunk = Math.min(500, remaining);
      await new Promise((resolve) => setTimeout(resolve, chunk));
      remaining -= chunk;
    }
    return controller.active && controller.runToken === runToken && isCurrentRecord(controller.record);
  };

  const pointAlongRoute = (path, progress) => {
    const points = Array.isArray(path) ? path : [];
    if (!points.length) return null;
    if (points.length === 1) return { ...points[0] };
    const lengths = [];
    let total = 0;
    for (let index = 1; index < points.length; index += 1) {
      const length = Math.hypot(
        finite(points[index].northM) - finite(points[index - 1].northM),
        finite(points[index].eastM) - finite(points[index - 1].eastM)
      );
      lengths.push(length);
      total += length;
    }
    if (total <= .001) return { ...points[points.length - 1] };
    let remaining = Math.max(0, Math.min(1, finite(progress))) * total;
    for (let index = 0; index < lengths.length; index += 1) {
      const length = lengths[index];
      if (remaining <= length || index === lengths.length - 1) {
        const ratio = length > .001 ? Math.max(0, Math.min(1, remaining / length)) : 1;
        return {
          northM: finite(points[index].northM) + (finite(points[index + 1].northM) - finite(points[index].northM)) * ratio,
          eastM: finite(points[index].eastM) + (finite(points[index + 1].eastM) - finite(points[index].eastM)) * ratio
        };
      }
      remaining -= length;
    }
    return { ...points[points.length - 1] };
  };

  const followRouteWhileCurrent = async (controller, path, durationMs, runToken = controller.runToken) => {
    const totalMs = Math.max(1, finite(durationMs));
    let elapsedMs = 0;
    while (elapsedMs < totalMs && controller.active && controller.runToken === runToken && isCurrentRecord(controller.record)) {
      const chunk = Math.min(500, totalMs - elapsedMs);
      await new Promise((resolve) => setTimeout(resolve, chunk));
      elapsedMs += chunk;
      const position = pointAlongRoute(path, elapsedMs / totalMs);
      if (position) {
        controller.current = { ...position };
        controller.doorCurrent = { ...position };
        refreshPersonDoorSources();
      }
    }
    return controller.active && controller.runToken === runToken && isCurrentRecord(controller.record);
  };

  const ensurePersonWaypointDefinition = () => {
    if (personWaypointDefinitionReady) return true;
    handle.addToDataDefinition(PERSON_WAYPOINT_DEFINITION, 'AI WAYPOINT LIST', 'number', SimConnectDataType.WAYPOINT);
    personWaypointDefinitionReady = true;
    return true;
  };

  const sendPersonWaypointRoute = (objectId, points, speedKts) => {
    if (!ensurePersonWaypointDefinition()) return false;
    const route = (Array.isArray(points) ? points : []).map((point) => {
      const waypoint = new Waypoint();
      waypoint.latitude = finite(point.lat);
      waypoint.longitude = finite(point.lon);
      waypoint.altitude = finite(point.altFt);
      waypoint.flags = SimConnectConstants.WAYPOINT_ON_GROUND | SimConnectConstants.WAYPOINT_SPEED_REQUESTED;
      waypoint.speed = Math.max(1, Math.min(5, finite(speedKts, 2.6)));
      waypoint.throttle = 0;
      return waypoint;
    });
    if (!route.length) return false;
    handle.setDataOnSimObject(PERSON_WAYPOINT_DEFINITION, objectId, route);
    return true;
  };

  const normalizeNavigation = (raw = {}) => {
    const spawn = raw.spawn || {};
    const rawHangars = Array.isArray(raw.hangars) && raw.hangars.length ? raw.hangars : (raw.hangar ? [raw.hangar] : []);
    const obstacles = (Array.isArray(raw.obstacles) ? raw.obstacles : []).slice(0, MAX_NAVIGATION_OBSTACLES).map((obstacle, index) => ({
      id: String(obstacle?.id || `obstacle-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64),
      label: String(obstacle?.label || obstacle?.id || `Hindernis ${index + 1}`).slice(0, 120),
      northM: finite(obstacle?.northM), eastM: finite(obstacle?.eastM), heading: heading(obstacle?.heading),
      widthM: Math.max(.1, finite(obstacle?.widthM, 1)), depthM: Math.max(.1, finite(obstacle?.depthM, 1)),
      scale: Math.max(.1, Math.min(10, finite(obstacle?.scale, 1))), kind: String(obstacle?.kind || 'object')
    }));
    const hangars = rawHangars.slice(0, 32).map((rawHangar, index) => ({
      id: String(rawHangar?.id || (index === 0 ? 'hangar' : `hangar-${index + 1}`)).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64),
      label: String(rawHangar?.label || 'Hangar-Innenraum').slice(0, 120), kind: 'hangar-zone',
      northM: finite(rawHangar?.northM), eastM: finite(rawHangar?.eastM), heading: heading(rawHangar?.heading),
      widthM: Math.max(4, finite(rawHangar?.widthM, 18)), depthM: Math.max(4, finite(rawHangar?.depthM, 22))
    }));
    const hangar = hangars.find((candidate) => candidate.id === 'hangar') || hangars[0] || null;
    return {
      spawn: { lat: finite(spawn.lat), lon: finite(spawn.lon), altFt: finite(spawn.altFt), heading: heading(spawn.heading) },
      obstacles,
      hangar,
      hangars,
      hangarId: hangar ? 'hangar' : (obstacles.some((obstacle) => obstacle.id === 'hangar') ? 'hangar' : '')
    };
  };

  const normalizePersonPlan = (raw, index, navigation) => {
    const title = String(raw?.title || '').trim();
    if (!allowedTarmacPeople.has(title)) throw new Error(`Personenmodell ist nicht als Tarmac-Modell freigegeben: ${title || '(leer)'}`);
    const id = String(raw?.id || `homebase-person-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    const start = { northM: finite(raw?.startNorthM), eastM: finite(raw?.startEastM) };
    const destinations = (Array.isArray(raw?.destinations) ? raw.destinations : []).slice(0, MAX_PERSON_DESTINATIONS).flatMap((destination, targetIndex) => {
      const targetType = destination?.targetType === 'waypoint' ? 'waypoint' : 'object';
      const targetId = String(destination?.targetId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
      if (targetType === 'object' && !navigation.hangars.some((hangar) => hangar.id === targetId) && !navigation.obstacles.some((obstacle) => obstacle.id === targetId)) return [];
      return [{
        id: String(destination?.id || `destination-${targetIndex + 1}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64),
        targetType, targetId,
        northM: finite(destination?.northM), eastM: finite(destination?.eastM),
        waitMinS: Math.max(0, Math.min(3600, finite(destination?.waitMinS))),
        waitMaxS: Math.max(0, Math.min(3600, finite(destination?.waitMaxS, destination?.waitMinS)))
      }];
    });
    const absolute = offsetLatLon(navigation.spawn.lat, navigation.spawn.lon, start.northM, start.eastM);
    return {
      id, title, label: String(raw?.label || `Mitarbeiter ${index + 1}`).slice(0, 80), start,
      lat: absolute.lat, lon: absolute.lon, altFt: navigation.spawn.altFt,
      heading: navigation.spawn.heading, speedKts: Math.max(1, Math.min(5, finite(raw?.speedKts, 2.6))), destinations
    };
  };

  const collectionFor = (record) => record?.collection === 'crew' ? 'crew' : 'preview';
  const generationFor = (collection) => generations[collection === 'crew' ? 'crew' : 'preview'];
  const isCurrentRecord = (record) => !!record && record.generation === generationFor(collectionFor(record));
  const advanceGeneration = (collection) => {
    const key = collection === 'crew' ? 'crew' : 'preview';
    generations[key] += 1;
    return generations[key];
  };

  const refreshPersonDoorSources = () => {
    const sources = [...personControllers.values()].filter((controller) => controller.active && controller.current).map((controller) => {
      const position = controller.doorCurrent || controller.current;
      const absolute = offsetLatLon(controller.navigation.spawn.lat, controller.navigation.spawn.lon, position.northM, position.eastM);
      return { ...absolute, altFt: controller.navigation.spawn.altFt, kind: `Homebase-Person:${controller.person.id}`, objectId: controller.record?.objectId };
    });
    doorAutomation.setDynamicSources(sources);
  };

  const aircraftObstacleForNavigation = (navigation) => {
    const gps = getLastGps();
    if (!Number.isFinite(Number(gps?.lat)) || !Number.isFinite(Number(gps?.lon))) return null;
    const local = localOffsetMeters(navigation.spawn.lat, navigation.spawn.lon, gps.lat, gps.lon);
    return { ...local, heading: heading(gps?.hdg ?? gps?.heading), sizeM: 10, clearanceM: .65 };
  };

  const navigationHangarContaining = (navigation, point) => {
    return (navigation.hangars || []).find((hangar) => routeCore.pointInsideObstacle(point, routeCore.normalizeObstacle({ ...hangar, clearanceM: 0 }))) || null;
  };

  const pointInsideNavigationHangar = (navigation, point) => {
    return !!navigationHangarContaining(navigation, point);
  };

  const navigationHangarEntry = (navigation, hangar = navigation.hangar) => {
    return hangar ? routeCore.interactionCandidates(routeCore.normalizeObstacle(hangar, { clearanceM: .65 }), { interactionOffsetM: 1 })[0] : null;
  };

  const planPersonLeg = (navigation, start, destination) => {
    const obstacles = navigation.obstacles;
    const aircraft = aircraftObstacleForNavigation(navigation);
    const targetHangar = destination.targetType === 'object'
      ? navigation.hangars.find((hangar) => hangar.id === destination.targetId) || null
      : null;
    const goal = destination.targetType === 'waypoint'
      ? { northM: destination.northM, eastM: destination.eastM }
      : targetHangar
        ? { ...targetHangar, insideHangar: true }
        : { targetId: destination.targetId };
    const startHangar = navigationHangarContaining(navigation, start);
    const targetObstacle = goal.targetId ? obstacles.find((obstacle) => obstacle.id === goal.targetId) : null;
    const goalHangar = targetHangar || navigationHangarContaining(navigation, targetObstacle || goal);
    const entry = goalHangar ? navigationHangarEntry(navigation, goalHangar) : null;
    const planToGoal = (routeStart) => goal.targetId
      ? routeCore.planRouteToObject({ start: routeStart, targetObjectId: goal.targetId, obstacles, aircraft, cellSizeM: .5, clearanceM: .65, interactionOffsetM: 1 })
      : routeCore.planRoute({ start: routeStart, goal: { northM: goal.northM, eastM: goal.eastM }, obstacles, aircraft, cellSizeM: .5, clearanceM: .65 });
    if (!entry || startHangar?.id === goalHangar?.id) return planToGoal(start);
    if (goalHangar) {
      const approach = routeCore.planRoute({ start, goal: entry, obstacles, aircraft, cellSizeM: .5, clearanceM: .65 });
      if (!approach.ok) return approach;
      const interior = planToGoal(entry);
      if (!interior.ok) return interior;
      return { ...interior, path: [...approach.path, ...interior.path.slice(1)], hangarId: goalHangar.id };
    }
    return planToGoal(start);
  };

  const chooseNextDestination = (controller) => {
    const candidates = controller.person.destinations.filter((destination) => destination.id !== controller.lastDestinationId);
    const pool = candidates.length ? candidates : controller.person.destinations;
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  };

  const runPersonLoop = async (controller, runToken = controller.runToken) => {
    while (controller.active && controller.runToken === runToken && isCurrentRecord(controller.record)) {
      const destination = chooseNextDestination(controller);
      if (!destination) break;
      const result = planPersonLeg(controller.navigation, controller.current, destination);
      if (!result.ok || !Array.isArray(result.path) || result.path.length < 2) {
        log(`HOMEBASE_PERSON_ROUTE_ERROR id=${controller.person.id} target=${destination.id} error=${result.error || 'no_route'}`);
        if (!await waitWhileCurrent(controller, 3000, runToken)) break;
        controller.lastDestinationId = destination.id;
        continue;
      }
      const sendPath = (path) => {
        const routePoints = path.slice(1).map((point) => {
          const absolute = offsetLatLon(controller.navigation.spawn.lat, controller.navigation.spawn.lon, point.northM, point.eastM);
          return { ...absolute, altFt: controller.navigation.spawn.altFt };
        });
        return sendPersonWaypointRoute(controller.record.objectId, routePoints, controller.person.speedKts);
      };
      const travelTimeMs = (path) => Math.max(800, (routeCore.pathDistance(path) / Math.max(.5, controller.person.speedKts * .514444)) * 1000 + 500);
      try {
        sendPath(result.path);
        const travelMs = travelTimeMs(result.path);
        if (!await followRouteWhileCurrent(controller, result.path, travelMs, runToken)) break;
      } catch (error) {
        log(`HOMEBASE_PERSON_WAYPOINT_ERROR id=${controller.person.id} error=${error?.message || error}`);
        if (!await waitWhileCurrent(controller, 3000, runToken)) break;
        continue;
      }
      const distanceM = routeCore.pathDistance(result.path);
      log(`HOMEBASE_PERSON_ROUTE id=${controller.person.id} target=${destination.id} distanceM=${distanceM.toFixed(1)}`);
      controller.current = { ...result.path[result.path.length - 1] };
      controller.doorCurrent = { ...controller.current };
      controller.lastDestinationId = destination.id;
      refreshPersonDoorSources();
      const minWait = Math.min(destination.waitMinS, destination.waitMaxS);
      const maxWait = Math.max(destination.waitMinS, destination.waitMaxS);
      const waitMs = (minWait + Math.random() * (maxWait - minWait)) * 1000;
      if (!await waitWhileCurrent(controller, Math.max(250, waitMs), runToken)) break;
    }
    if (controller.runToken === runToken) {
      controller.active = false;
      refreshPersonDoorSources();
    }
  };

  const startPersonLoop = (controller) => {
    controller.active = true;
    controller.runToken = finite(controller.runToken) + 1;
    const runToken = controller.runToken;
    runPersonLoop(controller, runToken).catch((error) => log(`HOMEBASE_PERSON_LOOP_ERROR id=${controller.person.id} error=${error?.message || error}`));
  };

  const stopPersonControllers = () => {
    for (const controller of personControllers.values()) controller.active = false;
    personControllers.clear();
    doorAutomation.setDynamicSources([]);
  };

  const transmitFreeze = (objectId, eventId, enabled) => {
    handle.transmitClientEvent(
      objectId,
      eventId,
      enabled ? 1 : 0,
      EVENT_GROUP_PRIORITY_HIGHEST,
      EVENT_FLAG_GROUP_ID_IS_PRIORITY
    );
  };

  const modelDefinition = (item) => catalog.objectDefinitionForTitle(item.title) || {};
  const effectiveOffsetFt = (item) => finite(item.heightOffsetFt) + finite(modelDefinition(item).groundClearanceFt);
  const isParkedVehicle = (item) => modelDefinition(item).parkedVehicle === true;

  const hangarDoorAnimationForTitle = (rawTitle) => {
    const definition = catalog.objectDefinitionForTitle(rawTitle);
    const animation = definition?.kind === 'hangar' ? definition.animation : null;
    if (!animation || animation.type !== 'door' || animation.control?.transport !== 'simconnect-lvar') return null;
    const simvar = String(animation.control.simvar || '').trim().toUpperCase();
    const scope = String(animation.control.scope || 'global').toLowerCase();
    const open = Number(animation.control.values?.open);
    const closed = Number(animation.control.values?.closed);
    const validVariable = scope === 'simobject'
      ? /^(?:L:1:|Z:)VFR_HOMEBASE_[A-Z0-9_]{1,100}$/.test(simvar)
      : /^L:VFR_HOMEBASE_[A-Z0-9_]{1,100}$/.test(simvar);
    if (!validVariable || !['global', 'simobject'].includes(scope) || !Number.isFinite(open) || !Number.isFinite(closed) || open === closed) return null;
    return { simvar, scope, open, closed, defaultState: animation.defaultState === 'closed' ? 'closed' : 'open' };
  };

  const objectControlForTitle = (rawTitle, rawControlId) => {
    const definition = catalog.objectDefinitionForTitle(rawTitle);
    const controlId = String(rawControlId || '').trim().toLowerCase();
    const control = Array.isArray(definition?.controls)
      ? definition.controls.find((entry) => entry.id === controlId)
      : null;
    const scope = String(control?.scope || 'global').toLowerCase();
    if (!control || control.transport !== 'simconnect-lvar' || !['global', 'simobject'].includes(scope)) return null;
    const simvar = String(control.simvar || '').trim().toUpperCase();
    const validVariable = scope === 'simobject'
      ? /^(?:L:1:|Z:)VFR_HOMEBASE_[A-Z0-9_]{1,100}$/.test(simvar)
      : /^L:VFR_HOMEBASE_[A-Z0-9_]{1,100}$/.test(simvar);
    if (!validVariable) return null;
    const states = Array.isArray(control.states)
      ? control.states.filter((entry) => Number.isFinite(Number(entry?.value))).map((entry) => ({
          id: String(entry.id || '').trim().toLowerCase(),
          label: String(entry.label || entry.id || ''),
          value: Number(entry.value)
        }))
      : [];
    if (states.length < 2) return null;
    return { ...control, scope, simvar, states };
  };

  const dataDefinitionForHangarAnimation = (animation) => {
    if (hangarAnimationDefinitions.has(animation.simvar)) return hangarAnimationDefinitions.get(animation.simvar);
    if (hangarAnimationDefinitions.size >= HANGAR_ANIMATION_DEFINITION_LIMIT) throw new Error('Zu viele unterschiedliche Hangar-Animationsvariablen aktiv.');
    const definitionId = HANGAR_ANIMATION_DEFINITION_START + hangarAnimationDefinitions.size;
    handle.addToDataDefinition(definitionId, animation.simvar, 'number', SimConnectDataType.FLOAT64, 0, SimConnectConstants.UNUSED);
    hangarAnimationDefinitions.set(animation.simvar, definitionId);
    return definitionId;
  };

  const applyFinalPosition = (record, groundAltitudeFt) => {
    if (!isCurrentRecord(record)) return;
    const offsetFt = effectiveOffsetFt(record.item);
    const vehicle = isParkedVehicle(record.item);
    const altitudeFt = finite(groundAltitudeFt, record.item.altFt) + offsetFt;
    if (vehicle) {
      transmitFreeze(record.objectId, EVENT_FREEZE_LAT_LON, true);
      transmitFreeze(record.objectId, EVENT_FREEZE_ATTITUDE, true);
    }
    transmitFreeze(record.objectId, EVENT_FREEZE_ALTITUDE, Math.abs(offsetFt) >= 0.005 || vehicle);
    const position = buildPosition(record.item, altitudeFt, Math.abs(offsetFt) < 0.005 && !vehicle);
    handle.setDataOnSimObject(INIT_POSITION_DEFINITION, record.objectId, [position]);
    setTimeout(() => {
      if (!isCurrentRecord(record) || !objectsBySimId.has(record.objectId)) return;
      try { handle.setDataOnSimObject(INIT_POSITION_DEFINITION, record.objectId, [position]); } catch (_) {}
    }, 250);
  };

  const readGroundAtObject = (record, reason = 'place') => new Promise((resolve, reject) => {
    if (!isCurrentRecord(record)) return reject(new Error('Homebase-Objektgeneration ist veraltet.'));
    const requestId = nextId();
    const timer = setTimeout(() => {
      pendingGround.delete(requestId);
      reject(new Error('Zeitüberschreitung beim Lesen der lokalen Bodenhöhe.'));
    }, 6000);
    pendingGround.set(requestId, { record, resolve, reject, timer, reason });
    try {
      handle.setDataOnSimObject(INIT_POSITION_DEFINITION, record.objectId, [buildPosition(record.item, record.item.altFt, true)]);
      setTimeout(() => {
        if (!pendingGround.has(requestId) || !isCurrentRecord(record)) return;
        try {
          handle.requestDataOnSimObject(
            requestId,
            OBJECT_ALTITUDE_DEFINITION,
            record.objectId,
            SimConnectPeriod.ONCE,
            0,
            0,
            0,
            0
          );
        } catch (error) {
          clearTimeout(timer);
          pendingGround.delete(requestId);
          reject(error);
        }
      }, 350);
    } catch (error) {
      clearTimeout(timer);
      pendingGround.delete(requestId);
      reject(error);
    }
  });

  const finishCreate = (pending, objectId) => {
    if (!pending || pending.settled) return;
    pending.settled = true;
    clearTimeout(pending.timer);
    pendingCreates.delete(pending.requestId);
    pendingCreatesByObjectId.delete(objectId);
    const record = { objectId, item: pending.item, collection: pending.collection, generation: pending.generation, addedAt: Date.now() };
    objectsById.set(pending.item.id, record);
    objectsBySimId.set(objectId, record);
    log(`HOMEBASE_OBJECT_ADDED id=${pending.item.id} objectId=${objectId} title="${pending.item.title}" collection=${pending.collection} generation=${pending.generation}`);
    pending.resolve(record);
  };

  const spawnObject = (raw, collection = 'preview', targetGeneration = generationFor(collection)) => new Promise((resolve, reject) => {
    let item;
    try { item = normalizeItem(raw); } catch (error) { reject(error); return; }
    if (objectsById.has(item.id)) { reject(new Error(`${item.label} ist bereits aktiv.`)); return; }
    const requestId = nextId();
    const pending = {
      requestId,
      item,
      collection: collection === 'crew' ? 'crew' : 'preview',
      generation: targetGeneration,
      resolve,
      reject,
      objectId: null,
      settled: false,
      timer: null
    };
    pending.timer = setTimeout(() => {
      if (pending.settled) return;
      pending.settled = true;
      pendingCreates.delete(requestId);
      if (pending.objectId) pendingCreatesByObjectId.delete(pending.objectId);
      reject(new Error(`Keine ObjectAdded-Bestätigung für ${item.label}.`));
    }, CREATE_TIMEOUT_MS);
    pendingCreates.set(requestId, pending);
    try {
      const sendId = handle.aICreateSimulatedObject(item.title, buildPosition(item, item.altFt, true), requestId);
      pending.sendId = sendId;
      log(`HOMEBASE_OBJECT_CREATE_REQUEST id=${item.id} requestId=${requestId} sendId=${sendId} title="${item.title}"`);
    } catch (error) {
      clearTimeout(pending.timer);
      pendingCreates.delete(requestId);
      pending.settled = true;
      reject(error);
    }
  });

  const stabilizeRecord = async (record, alwaysReadGround = false) => {
    if (!isCurrentRecord(record)) throw new Error('Homebase-Objektgeneration ist veraltet.');
    const offset = effectiveOffsetFt(record.item);
    if (!alwaysReadGround && Math.abs(offset) < 0.005 && !isParkedVehicle(record.item)) return null;
    const groundAltitudeFt = await readGroundAtObject(record, alwaysReadGround ? 'move' : 'spawn');
    applyFinalPosition(record, groundAltitudeFt);
    return groundAltitudeFt;
  };

  const removeRecord = (record) => new Promise((resolve) => {
    if (!record?.objectId) { resolve({ ok: true, record }); return; }
    const objectId = record.objectId;
    const requestId = nextId();
    const timer = setTimeout(() => {
      pendingRemovals.delete(objectId);
      resolve({ ok: false, record, error: 'Keine ObjectRemoved-Bestätigung' });
    }, REMOVE_TIMEOUT_MS);
    pendingRemovals.set(objectId, { record, requestId, timer, resolve });
    try {
      const sendId = handle.aIRemoveObject(objectId, requestId);
      log(`HOMEBASE_OBJECT_REMOVE_REQUEST id=${record.item.id} objectId=${objectId} requestId=${requestId} sendId=${sendId}`);
    } catch (error) {
      clearTimeout(timer);
      pendingRemovals.delete(objectId);
      resolve({ ok: false, record, error: error?.message || String(error) });
    }
  });

  const clearCollection = async (collection) => {
    const records = [...objectsById.values()].filter((record) => collectionFor(record) === collection);
    const removed = [];
    const failed = [];
    for (const record of records) {
      const result = await removeRecord(record);
      if (result.ok) removed.push({ id: record.item.id, title: record.item.title, label: record.item.label, objectId: record.objectId });
      else failed.push({ id: record.item.id, title: record.item.title, label: record.item.label, objectId: record.objectId, error: result.error });
    }
    return { removed, failed };
  };

  const clearAll = async () => {
    stopPersonControllers();
    const preview = await clearCollection('preview');
    const crew = await clearCollection('crew');
    return { removed: [...preview.removed, ...crew.removed], failed: [...preview.failed, ...crew.failed] };
  };

  const sendError = (type, command, error, extra = {}) => {
    sendAck({
      type: `${type}_ack`,
      commandId: command?.commandId || null,
      status: 'error',
      error: error?.message || String(error),
      message: error?.message || String(error),
      ...extra
    });
  };

  const handlePreviewSet = async (command) => {
    const targetGeneration = advanceGeneration('preview');
    stopPersonControllers();
    for (const [requestId, pending] of pendingGround.entries()) {
      if (collectionFor(pending.record) !== 'preview') continue;
      clearTimeout(pending.timer);
      pending.reject(new Error('Vorschau wurde ersetzt.'));
      pendingGround.delete(requestId);
    }
    const teardown = await clearCollection('preview');
    if (teardown.failed.length) throw new Error(`${teardown.failed.length} vorhandene Objekt(e) wurden nicht bestätigt entfernt.`);
    const input = Array.isArray(command?.objects) ? command.objects.slice(0, MAX_OBJECTS) : [];
    const spawned = [];
    const failed = [];
    for (const raw of input) {
      try {
        const record = await spawnObject(raw, 'preview', targetGeneration);
        if (!isCurrentRecord(record)) throw new Error('Vorschau wurde während des Aufbaus ersetzt.');
        const groundAltitudeFt = await stabilizeRecord(record, record.item.id === '__homebase_spawn_probe__');
        spawned.push({ id: record.item.id, title: record.item.title, label: record.item.label, objectId: record.objectId, groundAltitudeFt });
      } catch (error) {
        failed.push({ id: raw?.id, title: raw?.title, label: raw?.label, error: error?.message || String(error) });
      }
    }
    const navigation = normalizeNavigation(command?.navigation || { spawn: command?.spawn, obstacles: [] });
    const peopleInput = (Array.isArray(command?.people) ? command.people : []).slice(0, MAX_HOMEBASE_PEOPLE);
    const spawnedPeople = [];
    for (let index = 0; index < peopleInput.length; index += 1) {
      const raw = peopleInput[index];
      try {
        const person = normalizePersonPlan(raw, index, navigation);
        const record = await spawnObject(person, 'preview', targetGeneration);
        if (!isCurrentRecord(record)) throw new Error('Personenszene wurde während des Aufbaus ersetzt.');
        const controller = { active: false, runToken: 0, person, record, navigation, current: { ...person.start }, doorCurrent: { ...person.start }, lastDestinationId: '' };
        personControllers.set(person.id, controller);
        spawnedPeople.push({ id: person.id, title: person.title, label: person.label, objectId: record.objectId, destinationCount: person.destinations.length });
        startPersonLoop(controller);
      } catch (error) {
        failed.push({ id: raw?.id, title: raw?.title, label: raw?.label, error: error?.message || String(error) });
      }
    }
    refreshPersonDoorSources();
    sendAck({
      type: 'homebase_v1.preview.set_ack',
      commandId: command?.commandId || null,
      parentCommandId: command?.parentCommandId || command?.commandId || null,
      status: failed.length ? 'error' : 'ok',
      message: failed.length ? `Vorschau mit ${failed.length} Fehler(n) aufgebaut.` : 'Homebase-Vorschau gesetzt.',
      extraCount: spawned.length,
      objectCount: spawned.length + spawnedPeople.length,
      spawnedObjects: spawned,
      spawnedPeople,
      peopleCount: spawnedPeople.length,
      failedObjects: failed,
      generation: targetGeneration
    });
  };

  const handlePeopleSync = async (command) => {
    const navigation = normalizeNavigation(command?.navigation || { spawn: command?.spawn, obstacles: [] });
    const input = (Array.isArray(command?.people) ? command.people : []).slice(0, MAX_HOMEBASE_PEOPLE);
    const plans = input.map((raw, index) => normalizePersonPlan(raw, index, navigation));
    const desiredIds = new Set(plans.map((person) => person.id));
    const removedPeople = [];
    const updatedPeople = [];
    const spawnedPeople = [];

    for (const [id, controller] of [...personControllers.entries()]) {
      if (desiredIds.has(id)) continue;
      controller.active = false;
      controller.runToken = finite(controller.runToken) + 1;
      personControllers.delete(id);
      const result = await removeRecord(controller.record);
      if (!result.ok) throw new Error(`${controller.person.label} konnte nicht bestätigt entfernt werden: ${result.error}`);
      removedPeople.push({ id, title: controller.person.title, objectId: controller.record.objectId });
    }

    for (const person of plans) {
      let controller = personControllers.get(person.id);
      if (controller && controller.person.title !== person.title) {
        controller.active = false;
        controller.runToken = finite(controller.runToken) + 1;
        personControllers.delete(person.id);
        const result = await removeRecord(controller.record);
        if (!result.ok) throw new Error(`${controller.person.label} konnte für den Modellwechsel nicht bestätigt entfernt werden: ${result.error}`);
        controller = null;
      }
      if (!controller) {
        const record = await spawnObject(person, 'preview', generationFor('preview'));
        const next = { active: false, runToken: 0, person, record, navigation, current: { ...person.start }, doorCurrent: { ...person.start }, lastDestinationId: '' };
        personControllers.set(person.id, next);
        startPersonLoop(next);
        spawnedPeople.push({ id: person.id, title: person.title, label: person.label, objectId: record.objectId, destinationCount: person.destinations.length });
        continue;
      }

      const startChanged = Math.abs(controller.person.start.northM - person.start.northM) > .01
        || Math.abs(controller.person.start.eastM - person.start.eastM) > .01;
      controller.active = false;
      controller.runToken = finite(controller.runToken) + 1;
      controller.person = person;
      controller.navigation = navigation;
      controller.lastDestinationId = '';
      if (startChanged) {
        controller.record.item = normalizeItem(person);
        await stabilizeRecord(controller.record, true);
        controller.current = { ...person.start };
        controller.doorCurrent = { ...person.start };
      }
      startPersonLoop(controller);
      updatedPeople.push({ id: person.id, title: person.title, label: person.label, objectId: controller.record.objectId, destinationCount: person.destinations.length, repositioned: startChanged });
    }
    refreshPersonDoorSources();
    sendAck({
      type: 'homebase_v1.preview.people.sync_ack',
      commandId: command?.commandId || null,
      status: 'ok',
      message: 'Homebase-Personen und Wegpunkte wurden live aktualisiert.',
      peopleCount: plans.length,
      spawnedPeople,
      updatedPeople,
      removedPeople
    });
  };

  const handleCrewSet = async (command) => {
    const targetGeneration = advanceGeneration('crew');
    for (const [requestId, pending] of pendingGround.entries()) {
      if (collectionFor(pending.record) !== 'crew') continue;
      clearTimeout(pending.timer);
      pending.reject(new Error('Crew-Szene wurde ersetzt.'));
      pendingGround.delete(requestId);
    }
    const teardown = await clearCollection('crew');
    if (teardown.failed.length) throw new Error(`${teardown.failed.length} Crew-Objekt(e) wurden nicht bestätigt entfernt.`);
    const input = Array.isArray(command?.objects) ? command.objects.slice(0, MAX_CREW_OBJECTS) : [];
    const spawned = [];
    const failed = [];
    for (const raw of input) {
      try {
        const record = await spawnObject(raw, 'crew', targetGeneration);
        if (!isCurrentRecord(record)) throw new Error('Crew-Szene wurde während des Aufbaus ersetzt.');
        const groundAltitudeFt = await stabilizeRecord(record);
        spawned.push({ id: record.item.id, title: record.item.title, label: record.item.label, objectId: record.objectId, groundAltitudeFt });
      } catch (error) {
        failed.push({ id: raw?.id, title: raw?.title, label: raw?.label, error: error?.message || String(error) });
      }
    }
    sendAck({
      type: 'homebase_v1.crew.set_ack',
      commandId: command?.commandId || null,
      status: failed.length ? 'error' : 'ok',
      message: failed.length ? `Crew-Szene mit ${failed.length} Fehler(n) aufgebaut.` : 'Crew-Homebases aktualisiert.',
      objectCount: spawned.length,
      spawnedObjects: spawned,
      failedObjects: failed,
      generation: targetGeneration
    });
  };

  const handleObjectAdd = async (command) => {
    const record = await spawnObject(command?.object, 'preview');
    const groundAltitudeFt = await stabilizeRecord(record, record.item.id === '__homebase_spawn_probe__');
    sendAck({
      type: 'homebase_v1.preview.object.add_ack',
      commandId: command?.commandId || null,
      status: 'ok',
      message: `${record.item.label} wurde erzeugt.`,
      spawnedObjects: [{ id: record.item.id, title: record.item.title, label: record.item.label, objectId: record.objectId, groundAltitudeFt }]
    });
  };

  const handleObjectMove = async (command) => {
    const item = normalizeItem(command?.object);
    const record = objectsById.get(item.id);
    if (!record) throw new Error(`${item.label} ist in der aktiven Vorschau nicht registriert.`);
    record.item = item;
    const groundAltitudeFt = await stabilizeRecord(record, true);
    sendAck({
      type: 'homebase_v1.preview.object.move_ack',
      commandId: command?.commandId || null,
      status: 'ok',
      message: `${item.label} wurde ohne neuen Spawn verschoben.`,
      id: item.id,
      objectId: record.objectId,
      groundAltitudeFt
    });
  };

  const handleObjectRemove = async (command) => {
    const id = String(command?.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    if (!id) throw new Error('Objekt-ID fehlt.');
    const record = objectsById.get(id);
    if (!record) {
      sendAck({
        type: 'homebase_v1.preview.object.remove_ack',
        commandId: command?.commandId || null,
        status: 'noop',
        message: `${String(command?.label || id)} war in der aktiven Vorschau nicht registriert.`,
        id,
        removedCount: 0
      });
      return;
    }
    const result = await removeRecord(record);
    if (!result.ok) throw new Error(`${record.item.label} konnte nicht bestätigt entfernt werden: ${result.error}`);
    sendAck({
      type: 'homebase_v1.preview.object.remove_ack',
      commandId: command?.commandId || null,
      status: 'ok',
      message: `${record.item.label} wurde aus der Live-Vorschau entfernt.`,
      id: record.item.id,
      objectId: record.objectId,
      removedCount: 1
    });
  };

  const writeObjectControl = async ({ command, title, control, stateDefinition, ackType }) => {
    const commandId = String(command?.commandId || '');
    const definitionId = dataDefinitionForHangarAnimation(control);
    const value = stateDefinition.value;
    const buffer = new RawBuffer(8);
    buffer.writeFloat64(value);
    const instanceId = String(command?.instanceId || command?.id || '').trim();
    let targetObjectId = Number.isFinite(Number(SimConnectConstants.OBJECT_ID_USER))
      ? Number(SimConnectConstants.OBJECT_ID_USER)
      : 0;
    if (control.scope === 'simobject') {
      const tracked = instanceId ? objectsById.get(instanceId) : null;
      const scanned = tracked || doorAutomation.resolveTarget({
        objectId: command?.objectId,
        title,
        lat: command?.lat,
        lon: command?.lon
      });
      targetObjectId = Number(scanned?.objectId);
      if (!Number.isFinite(targetObjectId) || targetObjectId <= 0) {
        throw new Error(`${control.label || 'Objektsteuerung'} konnte die gewählte Hangarinstanz noch nicht in MSFS finden.`);
      }
    }
    log(`OBJECT_CONTROL_LVAR_WRITE_BEGIN commandId=${commandId || 'none'} instanceId=${instanceId || 'none'} objectId=${targetObjectId} title=${title} controlId=${control.id || 'door'} state=${stateDefinition.id} simvar=${control.simvar} value=${value}`);
    try {
      await Promise.resolve(handle.setDataOnSimObject(definitionId, targetObjectId, { buffer, arrayCount: 0, tagged: false }));
    } catch (error) {
      log(`OBJECT_CONTROL_LVAR_WRITE_ERROR commandId=${commandId || 'none'} controlId=${control.id || 'door'} state=${stateDefinition.id} simvar=${control.simvar} value=${value} error=${error?.message || error}`);
      throw error;
    }
    const manualAutomation = control.scope === 'simobject' && String(control.id || '').toLowerCase() === 'door'
      ? doorAutomation.noteManualState({ objectId: targetObjectId, title }, stateDefinition.id)
      : null;
    log(`OBJECT_CONTROL_LVAR_WRITE_OK commandId=${commandId || 'none'} controlId=${control.id || 'door'} state=${stateDefinition.id} simvar=${control.simvar} value=${value}`);
    const action = stateDefinition.id === 'open' ? 'wird geöffnet'
      : stateDefinition.id === 'closed' ? 'wird geschlossen'
        : stateDefinition.id === 'on' ? 'wird eingeschaltet'
          : stateDefinition.id === 'off' ? 'wird ausgeschaltet'
            : `wird auf „${stateDefinition.label}“ gesetzt`;
    const scopeMessage = control.scope === 'simobject'
      ? `${control.label || 'Objektsteuerung'} ${action}. Nur die gewählte Hangarinstanz wird angesteuert.`
      : `${control.label || 'Objektsteuerung'} ${action}. Die Steuerung gilt für alle Kopien dieses Modells.`;
    const automationMessage = manualAutomation?.active
      ? stateDefinition.id === 'open'
        ? ' Die manuelle Öffnung bleibt bestehen, bis die Automatik beim nächsten Annähern auf höchstens 18 m wieder übernimmt.'
        : ' Die manuelle Schließung bleibt bestehen, bis die Automatik nach dem nächsten Entfernen auf mindestens 20 m wieder übernimmt.'
      : manualAutomation
        ? ' Die automatische Torsteuerung ist global deaktiviert.'
        : '';
    sendAck({
      type: ackType,
      commandId: commandId || null,
      status: 'ok',
      title,
      controlId: control.id || 'door',
      controlType: control.type || 'animation',
      state: stateDefinition.id,
      value,
      simvar: control.simvar,
      controlScope: control.scope,
      instanceId: instanceId || null,
      objectId: control.scope === 'simobject' ? targetObjectId : null,
      manualOverrideActive: manualAutomation?.active === true,
      automaticResumeOnState: manualAutomation?.active ? stateDefinition.id : null,
      doorAutomationEnabled: manualAutomation ? manualAutomation.enabled : null,
      durationMs: Number(control.durationMs) || 0,
      message: `${scopeMessage}${automationMessage}`
    });
    log(`OBJECT_CONTROL_ACK_SENT commandId=${commandId || 'none'} controlId=${control.id || 'door'} state=${stateDefinition.id} type=${ackType}`);
  };

  const handleObjectControl = async (command) => {
    const title = String(command?.title || command?.objectTitle || '').trim();
    const controlId = String(command?.controlId || '').trim().toLowerCase();
    const state = String(command?.state || '').trim().toLowerCase();
    if (!title) throw new Error('Objekttitel fehlt.');
    if (!controlId) throw new Error('Steuerungs-ID fehlt.');
    const control = objectControlForTitle(title, controlId);
    if (!control) throw new Error(`${title} hat keine freigegebene Steuerung „${controlId}“.`);
    const stateDefinition = control.states.find((entry) => entry.id === state);
    if (!stateDefinition) throw new Error(`Status „${state}“ ist für ${control.label || controlId} nicht definiert.`);
    await writeObjectControl({ command, title, control, stateDefinition, ackType: 'homebase_v1.object.control.set_ack' });
  };

  const handleDoorAutomation = async (command) => {
    const result = doorAutomation.setEnabled(command?.enabled !== false, {
      resetManualOverrides: command?.resetManualOverrides === true
    });
    sendAck({
      type: 'homebase_v1.door_automation.set_ack',
      commandId: command?.commandId || null,
      status: 'ok',
      enabled: result.enabled,
      changed: result.changed,
      resetManualOverrides: result.resetManualOverrides,
      openRadiusM: 18,
      closeRadiusM: 20,
      closeDelayMs: 1000,
      message: result.enabled
        ? result.resetManualOverrides
          ? `Automatische Hangartorsteuerung ist aktiv. ${result.resetManualOverrides} manuelle Vorgabe(n) wurden zurückgesetzt.`
          : 'Automatische Hangartorsteuerung ist aktiv.'
        : 'Automatische Hangartorsteuerung ist deaktiviert.'
    });
  };

  const handleHangarAnimation = async (command) => {
    const title = String(command?.title || command?.objectTitle || '').trim();
    const state = String(command?.state || '').trim().toLowerCase();
    if (!title) throw new Error('Hangartitel fehlt.');
    if (!['open', 'closed'].includes(state)) throw new Error('Hangarstatus muss "open" oder "closed" sein.');
    const generic = objectControlForTitle(title, 'door');
    if (generic) {
      const stateDefinition = generic.states.find((entry) => entry.id === state);
      if (!stateDefinition) throw new Error(`${title} hat für das Tor keinen Status „${state}“.`);
      await writeObjectControl({ command, title, control: generic, stateDefinition, ackType: 'homebase_v1.hangar.animation.set_ack' });
      return;
    }
    const animation = hangarDoorAnimationForTitle(title);
    if (!animation) throw new Error(`${title} hat keine steuerbare Toranimation.`);
    const legacyControl = {
      id: 'door', type: 'animation', label: 'Hangartor', simvar: animation.simvar, durationMs: 0,
      scope: animation.scope,
      states: [{ id: 'open', label: 'Öffnen', value: animation.open }, { id: 'closed', label: 'Schließen', value: animation.closed }]
    };
    await writeObjectControl({
      command, title, control: legacyControl,
      stateDefinition: legacyControl.states.find((entry) => entry.id === state),
      ackType: 'homebase_v1.hangar.animation.set_ack'
    });
  };

  try {
    handle.addToDataDefinition(INIT_POSITION_DEFINITION, 'Initial Position', null, SimConnectDataType.INITPOSITION);
    handle.addToDataDefinition(OBJECT_ALTITUDE_DEFINITION, 'Plane Altitude', 'feet', SimConnectDataType.FLOAT64, 0, SimConnectConstants.UNUSED);
    handle.mapClientEventToSimEvent(EVENT_FREEZE_LAT_LON, 'FREEZE_LATITUDE_LONGITUDE_SET');
    handle.mapClientEventToSimEvent(EVENT_FREEZE_ALTITUDE, 'FREEZE_ALTITUDE_SET');
    handle.mapClientEventToSimEvent(EVENT_FREEZE_ATTITUDE, 'FREEZE_ATTITUDE_SET');
    handle.subscribeToSystemEvent(EVENT_OBJECT_ADDED, 'ObjectAdded');
    handle.subscribeToSystemEvent(EVENT_OBJECT_REMOVED, 'ObjectRemoved');
  } catch (error) {
    log(`HOMEBASE_INIT_ERROR ${error?.message || error}`);
    throw error;
  }

  handle.on('assignedObjectID', (recv) => {
    const pending = pendingCreates.get(recv.requestID);
    if (!pending) return;
    const objectId = Number(recv.objectID);
    pending.objectId = objectId;
    pendingCreatesByObjectId.set(objectId, pending);
    if (recentlyAddedObjectIds.has(objectId)) finishCreate(pending, objectId);
  });

  handle.on('eventAddRemove', (recv) => {
    const objectId = Number(recv.data);
    if (!objectId) return;
    if (recv.clientEventId === EVENT_OBJECT_ADDED) {
      recentlyAddedObjectIds.add(objectId);
      const recentTimer = setTimeout(() => recentlyAddedObjectIds.delete(objectId), 30000);
      recentTimer.unref?.();
      const pending = pendingCreatesByObjectId.get(objectId);
      if (pending) finishCreate(pending, objectId);
      return;
    }
    if (recv.clientEventId !== EVENT_OBJECT_REMOVED) return;
    recentlyAddedObjectIds.delete(objectId);
    const record = objectsBySimId.get(objectId);
    if (record) {
      objectsBySimId.delete(objectId);
      if (objectsById.get(record.item.id)?.objectId === objectId) objectsById.delete(record.item.id);
    }
    const pending = pendingRemovals.get(objectId);
    if (pending) {
      clearTimeout(pending.timer);
      pendingRemovals.delete(objectId);
      pending.resolve({ ok: true, record: pending.record });
    }
    log(`HOMEBASE_OBJECT_REMOVED objectId=${objectId} id=${record?.item?.id || ''}`);
  });

  handle.on('simObjectData', (recv) => {
    const pending = pendingGround.get(recv.requestID);
    if (!pending) return;
    pendingGround.delete(recv.requestID);
    clearTimeout(pending.timer);
    try {
      const read = typeof recv?.data?.readFloat64 === 'function'
        ? recv.data.readFloat64.bind(recv.data)
        : recv.data.readDouble.bind(recv.data);
      const altitudeFt = Number(read());
      if (!Number.isFinite(altitudeFt)) throw new Error('Ungültige Bodenhöhe empfangen.');
      pending.resolve(altitudeFt);
    } catch (error) {
      pending.reject(error);
    }
  });

  handle.on('exception', (recv) => {
    const pending = [...pendingCreates.values()].find((entry) => entry.sendId === recv.sendId);
    if (!pending || pending.settled) return;
    pending.settled = true;
    clearTimeout(pending.timer);
    pendingCreates.delete(pending.requestId);
    if (pending.objectId) pendingCreatesByObjectId.delete(pending.objectId);
    pending.reject(new Error(recv.exceptionName || recv.exception || 'CREATE_OBJECT_FAILED'));
  });

  return {
    protocol: 1,
    capabilities,
    handleCommand(command) {
      const type = String(command?.type || '').trim();
      if (!type.startsWith('homebase_v1.')) return false;
      if (type === 'homebase_v1.capabilities') {
        sendAck({
          type: 'homebase_v1.capabilities_ack',
          commandId: command?.commandId || null,
          status: 'ok',
          protocol: 1,
          simConnected: true,
          assetPackageVersion: catalog.assetPackageVersion,
          capabilities
        });
        return true;
      }
      if (type === 'homebase_v1.preview.set') {
        enqueue(() => handlePreviewSet(command)).catch((error) => sendError(type, command, error));
        return true;
      }
      if (type === 'homebase_v1.preview.clear') {
        enqueue(async () => {
          const generation = advanceGeneration('preview');
          stopPersonControllers();
          const result = await clearCollection('preview');
          sendAck({
            type: 'homebase_v1.preview.clear_ack',
            commandId: command?.commandId || null,
            status: result.failed.length ? 'error' : 'ok',
            message: result.failed.length ? 'Nicht alle Homebase-Objekte wurden bestätigt entfernt.' : 'Homebase-Vorschau bestätigt entfernt.',
            removedCount: result.removed.length,
            removedObjects: result.removed,
            failedObjects: result.failed,
            generation
          });
        }).catch((error) => sendError(type, command, error));
        return true;
      }
      if (type === 'homebase_v1.crew.set') {
        enqueue(() => handleCrewSet(command)).catch((error) => sendError(type, command, error));
        return true;
      }
      if (type === 'homebase_v1.hangar.animation.set') {
        enqueue(() => handleHangarAnimation(command)).catch((error) => sendError(type, command, error));
        return true;
      }
      if (type === 'homebase_v1.object.control.set') {
        enqueue(() => handleObjectControl(command)).catch((error) => sendError(type, command, error));
        return true;
      }
      if (type === 'homebase_v1.door_automation.set') {
        enqueue(() => handleDoorAutomation(command)).catch((error) => sendError(type, command, error));
        return true;
      }
      if (type === 'homebase_v1.preview.object.add') {
        enqueue(() => handleObjectAdd(command)).catch((error) => sendError(type, command, error, { failedObjects: [{ ...command?.object, error: error?.message || String(error) }] }));
        return true;
      }
      if (type === 'homebase_v1.preview.object.remove') {
        enqueue(() => handleObjectRemove(command)).catch((error) => sendError(type, command, error, { id: command?.id || '' }));
        return true;
      }
      if (type === 'homebase_v1.preview.object.move') {
        enqueue(() => handleObjectMove(command)).catch((error) => sendError(type, command, error));
        return true;
      }
      if (type === 'homebase_v1.preview.people.sync') {
        enqueue(() => handlePeopleSync(command)).catch((error) => sendError(type, command, error));
        return true;
      }
      sendError(type, command, new Error(`Unbekannter Homebase-Befehl: ${type}`));
      return true;
    },
    clearAll,
    snapshot() {
      return {
        generation: generations.preview,
        objectCount: objectsById.size,
        crewObjectCount: [...objectsById.values()].filter((record) => collectionFor(record) === 'crew').length,
        doorAutomationEnabled: doorAutomation.isEnabled(),
        objects: [...objectsById.values()].map((record) => ({ id: record.item.id, title: record.item.title, collection: collectionFor(record), objectId: record.objectId }))
      };
    }
  };
}

module.exports = { createHomebaseObjectManager, normalizeItem, allowedPreviewTitles };
