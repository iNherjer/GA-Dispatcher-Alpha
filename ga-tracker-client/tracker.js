const { open, SimConnectDataType, SimConnectPeriod, InitPosition, RawBuffer, Waypoint, SimConnectConstants, EventFlag } = require('node-simconnect');
const WebSocket = require('ws');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

/**
 * GA TRACKER CLIENT - MSFS 2024 Edition
 * Inklusive Auto-Save Config, PIN-Auth & 5-Sekunden Boot-Timer
 */

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const WS_URL = 'wss://websocketrelais.onrender.com/';
const RUNTIME_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;
const CONFIG_BASENAME = 'tracker-config.json';
const CONFIG_FILE = path.join(RUNTIME_DIR, CONFIG_BASENAME);
const LEGACY_CONFIG_FILE = path.resolve(process.cwd(), CONFIG_BASENAME);
const TRACKER_VERSION = 'v270';
const TRACKER_VERSION_CODE = 270;
const TRACKER_DISPLAY_NAME = `GA Tracker ${TRACKER_VERSION} (build ${TRACKER_VERSION_CODE})`;
const MISSION_SMOKE_DEFAULT_TITLE = 'Chimney_Smoke_V1';
const MISSION_FIRE_DEFAULT_TITLE = 'VO_Fire_R1_40';
const MISSION_SCENE_VEHICLE_TITLE = 'Car Bush Firefighting';
const MISSION_SCENE_PERSON_TITLE = 'Tarmac_Female_Summer_Asian';
const TRACKER_DEBUG_FILE = path.join(RUNTIME_DIR, 'ga-tracker-debug.txt');
const TELEPORT_DEF_ID = 9361;
const WAYPOINT_DEF_ID = 9362;
const DOOR_OPEN_EVENT_ID = 9363;
const DOOR_CLOSE_EVENT_ID = 9364;
const DOOR_TOGGLE_EVENT_ID = 9365;
const PA24_DOOR_UNLOCK_EVENT_ID = 9366;
const PA24_DOOR_HANDLE_EVENT_ID = 9367;
const PA24_DOOR_LOCK_EVENT_ID = 9368;
const DOOR_OPEN_SINGLE_EVENT_ID = 9369;
const DOOR_CLOSE_SINGLE_EVENT_ID = 9370;
const PARKING_BRAKE_DEF_ID = 9371;
const INPUT_EVENT_ENUM_REQUEST_ID = 9372;
const PA24_LATCH_INPUT_EVENTS = ['LEVER_door_latch_2States_Toggle', 'B:LEVER_door_latch_2States_Toggle'];
const CONSOLE_MODES = new Set(['status', 'full', 'quiet']);
let consoleMode = 'status';
let consoleStatusLine = '';

function normalizeConsoleMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return CONSOLE_MODES.has(mode) ? mode : 'status';
}

function consoleClearStatusLine() {
  if (!process.stdout.isTTY || !consoleStatusLine) return;
  try {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
  } catch (_) {}
}

function consoleRenderStatusLine(force = false) {
  if (consoleMode !== 'status' || !process.stdout.isTTY || !consoleStatusLine) return;
  try {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(consoleStatusLine.slice(0, Math.max(20, process.stdout.columns || 180) - 1));
  } catch (_) {
    if (force) process.stdout.write(`\r${consoleStatusLine}`);
  }
}

function trackerLog(line = '') {
  consoleClearStatusLine();
  console.log(line);
  consoleRenderStatusLine(true);
}

function trackerWarn(line = '') {
  consoleClearStatusLine();
  console.warn(line);
  consoleRenderStatusLine(true);
}

function trackerError(...args) {
  consoleClearStatusLine();
  console.error(...args);
  consoleRenderStatusLine(true);
}

function trackerStatus(line = '') {
  if (consoleMode === 'quiet') return;
  if (consoleMode === 'full' || !process.stdout.isTTY) {
    console.log(line);
    return;
  }
  consoleStatusLine = line;
  consoleRenderStatusLine();
}

function debugLog(line) {
  try {
    const ts = new Date().toISOString();
    fs.appendFileSync(TRACKER_DEBUG_FILE, `[${ts}] ${line}\n`, 'utf8');
  } catch (_) {}
}

function toFiniteNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampInt(value, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function buildInitPos(lat, lon, altFt, hdg, onGround = true) {
  const pos = new InitPosition();
  pos.latitude = lat;
  pos.longitude = lon;
  pos.altitude = altFt;
  pos.heading = hdg;
  pos.onGround = onGround;
  pos.airspeed = 0;
  return pos;
}

function offsetLatLonMeters(lat, lon, northM, eastM) {
  const earthRadiusM = 6371000;
  const latRad = lat * Math.PI / 180;
  const dLat = northM / earthRadiusM;
  const dLon = eastM / (earthRadiusM * Math.cos(latRad));
  return {
    lat: lat + dLat * 180 / Math.PI,
    lon: lon + dLon * 180 / Math.PI
  };
}

function geoDistanceM(lat1, lon1, lat2, lon2) {
  const aLat = Number(lat1), aLon = Number(lon1), bLat = Number(lat2), bLon = Number(lon2);
  if (![aLat, aLon, bLat, bLon].every(Number.isFinite)) return Infinity;
  const r = 6371000;
  const phi1 = aLat * Math.PI / 180;
  const phi2 = bLat * Math.PI / 180;
  const dPhi = (bLat - aLat) * Math.PI / 180;
  const dLam = (bLon - aLon) * Math.PI / 180;
  const h = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

function buildSmokeFieldPositions(lat, lon, altFt, hdg, count, radiusM) {
  const n = clampInt(count, 1, 20);
  const radius = Math.max(0, Number(radiusM) || 0);
  const out = [{ index: 1, lat, lon, altFt, hdg, offsetNorthM: 0, offsetEastM: 0, radiusM: 0, bearingDeg: null }];
  if (n === 1 || radius <= 0) return out;
  for (let i = 1; i < n; i++) {
    const bearingDeg = (hdg + ((i - 1) * 360 / (n - 1))) % 360;
    const rad = bearingDeg * Math.PI / 180;
    const northM = Math.cos(rad) * radius;
    const eastM = Math.sin(rad) * radius;
    const p = offsetLatLonMeters(lat, lon, northM, eastM);
    out.push({
      index: i + 1,
      lat: p.lat,
      lon: p.lon,
      altFt,
      hdg,
      offsetNorthM: Math.round(northM * 10) / 10,
      offsetEastM: Math.round(eastM * 10) / 10,
      radiusM: radius,
      bearingDeg: Math.round(bearingDeg * 10) / 10
    });
  }
  return out;
}

function buildSpawnPlanForSite(site, defaults, kind, siteIndex) {
  const title = String(site?.objectTitle || site?.title || defaults.title || '').trim();
  const lat = toFiniteNumber(site?.lat, null);
  const lon = toFiniteNumber(site?.lon, null);
  const baseAltFt = toFiniteNumber(site?.altFt ?? site?.alt, defaults.altFt);
  const altOffsetFt = toFiniteNumber(site?.altOffsetFt, defaults.altOffsetFt || 0) || 0;
  const altFt = Number.isFinite(baseAltFt) ? baseAltFt + altOffsetFt : null;
  const hdg = toFiniteNumber(site?.hdg ?? site?.heading, defaults.hdg || 0);
  const count = clampInt(site?.count ?? defaults.count ?? 1, 1, kind === 'fire' ? 6 : 20);
  const radiusM = Math.max(0, toFiniteNumber(site?.radiusM ?? defaults.radiusM, 0) || 0);
  if (!title || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(altFt)) return [];
  return buildSmokeFieldPositions(lat, lon, altFt, hdg, count, radiusM).map((p) => ({
    ...p,
    title,
    kind,
    siteIndex,
    siteId: String(site?.siteId || `${kind}-${siteIndex}`),
    label: String(site?.label || `${kind} ${siteIndex}`),
    baseAltFt,
    altOffsetFt
  }));
}

function countByKind(items) {
  return items.reduce((acc, item) => {
    const key = item?.kind || 'object';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildRelativePosition(base, forwardM, rightM) {
  const hdgRad = Number(base.hdg || 0) * Math.PI / 180;
  const fwd = Number(forwardM) || 0;
  const right = Number(rightM) || 0;
  const northM = Math.cos(hdgRad) * fwd + (-Math.sin(hdgRad)) * right;
  const eastM = Math.sin(hdgRad) * fwd + Math.cos(hdgRad) * right;
  const p = offsetLatLonMeters(Number(base.lat), Number(base.lon), northM, eastM);
  return { ...p, northM, eastM };
}

function worldPointToRelativeScenePoint(base, point, fallback = {}) {
  const lat = toFiniteNumber(point?.worldLat ?? point?.lat, null);
  const lon = toFiniteNumber(point?.worldLon ?? point?.lon, null);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(Number(base?.lat)) || !Number.isFinite(Number(base?.lon))) {
    return null;
  }
  const earthRadiusM = 6371000;
  const northM = (lat - Number(base.lat)) * Math.PI / 180 * earthRadiusM;
  const eastM = (lon - Number(base.lon)) * Math.PI / 180 * earthRadiusM * Math.cos(Number(base.lat) * Math.PI / 180);
  const hdgRad = Number(base.hdg || 0) * Math.PI / 180;
  const forwardM = Math.cos(hdgRad) * northM + Math.sin(hdgRad) * eastM;
  const rightM = -Math.sin(hdgRad) * northM + Math.cos(hdgRad) * eastM;
  const altFt = toFiniteNumber(point?.worldAltFt ?? point?.altFt ?? point?.alt, toFiniteNumber(base.altFt, 0) + toFiniteNumber(fallback.altOffsetFt ?? fallback.altOffset, 0));
  return {
    forwardM,
    rightM,
    altOffsetFt: Number.isFinite(Number(base.altFt)) ? altFt - Number(base.altFt) : 0,
    lat,
    lon,
    altFt,
    hdg: normalizeHeading(base.hdg),
    northM,
    eastM
  };
}

function normalizeHeading(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return ((n % 360) + 360) % 360;
}

function uniqueStrings(values) {
  const out = [];
  for (const value of values || []) {
    const s = String(value || '').trim();
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

function buildTitleCandidates(title, extra = []) {
  const base = String(title || '').trim();
  const candidates = [base, ...(Array.isArray(extra) ? extra : [])];
  const paren = base.match(/\(([^)]+)\)/);
  if (paren) candidates.push(paren[1], base.replace(/\s*\([^)]+\)\s*/g, ' ').trim());
  if (/termac/i.test(base)) candidates.push(base.replace(/termac/ig, 'Tarmac'));
  if (/tarmac/i.test(base)) candidates.push(base.replace(/tarmac/ig, 'Termac'));
  return uniqueStrings(candidates);
}

function createMissionSmokeController(handle, getWs, syncId, pin, getLastGpsMsg = null, getGroundTrafficSnapshot = null) {
  const missions = new Map();
  const scenes = new Map();
  let sceneOperationQueue = Promise.resolve();
  let trackerMissionStatus = null;
  const CREATE_EXCEPTION_GRACE_MS = 900;
  const LATE_ASSIGNED_RETENTION_MS = 30000;
  const pendingAssign = new Map();
  const lateAssignedRequests = new Map();
  const lateAssignedSceneObjects = new Map();
  const pendingPayloadReads = new Map();
  const payloadReadDefCache = new Map();
  const payloadSetDefCache = new Map();
  const namedVarSetDefCache = new Map();
  const namedVarSetUnsupported = new Set();
  const trackedObjectIds = new Set();
  const activeBoardingScenes = new Set();
  const activeDeboardingScenes = new Set();
  const activeManualPaxScenes = new Set();
  const lastExceptions = [];
  let nextReqId = 9300;
  let nextDefId = 9700;
  let teleportDefReady = false;
  let waypointDefReady = false;
  let parkingBrakeDefReady = false;
  let doorEventsReady = false;
  let pa24DoorEventsReady = false;
  let inputEventsEnumerating = false;
  let inputEventsEnumerationDone = false;
  let doorLastAppliedState = null; // true=open, false=closed
  let doorLastAppliedAt = 0;
  let doorLastApplyOk = false;
  const inputEventHashCache = new Map();
  const pendingInputEventLookups = [];

  const enqueueSceneOperation = (sceneId, operation) => {
    const current = sceneOperationQueue.catch(() => {}).then(operation);
    sceneOperationQueue = current.catch(() => {});
    return current;
  };

  const ensureTeleportDefinition = () => {
    if (teleportDefReady) return true;
    try {
      handle.addToDataDefinition(TELEPORT_DEF_ID, 'PLANE LATITUDE', 'degrees', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(TELEPORT_DEF_ID, 'PLANE LONGITUDE', 'degrees', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(TELEPORT_DEF_ID, 'PLANE ALTITUDE', 'feet', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(TELEPORT_DEF_ID, 'PLANE HEADING DEGREES TRUE', 'degrees', SimConnectDataType.FLOAT64);
      teleportDefReady = true;
      debugLog('TELEPORT_DEF_READY');
      return true;
    } catch (err) {
      debugLog(`TELEPORT_DEF_ERROR ${err?.message || err}`);
      return false;
    }
  };

  const teleportObject = (objectId, pos) => {
    if (!ensureTeleportDefinition()) return false;
    try {
      const buf = new RawBuffer(32);
      buf.writeFloat64(Number(pos.lat));
      buf.writeFloat64(Number(pos.lon));
      buf.writeFloat64(Number(pos.altFt));
      buf.writeFloat64(Number(pos.hdg || 0));
      handle.setDataOnSimObject(TELEPORT_DEF_ID, objectId, { buffer: buf, arrayCount: 0, tagged: false });
      return true;
    } catch (err) {
      debugLog(`TELEPORT_ERROR objectId=${objectId} error=${err?.message || err}`);
      return false;
    }
  };

  const ensureWaypointDefinition = () => {
    if (waypointDefReady) return true;
    try {
      handle.addToDataDefinition(WAYPOINT_DEF_ID, 'AI WAYPOINT LIST', 'number', SimConnectDataType.WAYPOINT);
      waypointDefReady = true;
      debugLog('WAYPOINT_DEF_READY');
      return true;
    } catch (err) {
      debugLog(`WAYPOINT_DEF_ERROR ${err?.message || err}`);
      return false;
    }
  };

  const sendWaypointRoute = (objectId, points, speedKts = 5) => {
    if (!ensureWaypointDefinition()) return false;
    const route = (points || [])
      .filter(p => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lon)) && Number.isFinite(Number(p?.altFt)))
      .map((p) => {
        const wp = new Waypoint();
        wp.latitude = Number(p.lat);
        wp.longitude = Number(p.lon);
        wp.altitude = Number(p.altFt);
        wp.flags = SimConnectConstants.WAYPOINT_ON_GROUND | SimConnectConstants.WAYPOINT_SPEED_REQUESTED;
        wp.speed = Math.max(0.5, Number(speedKts) || 5);
        wp.throttle = 0;
        return wp;
      });
    if (route.length === 0) return false;
    try {
      handle.setDataOnSimObject(WAYPOINT_DEF_ID, objectId, route);
      const last = route[route.length - 1];
      debugLog(`WAYPOINT_ROUTE_SENT objectId=${objectId} points=${route.length} speedKts=${Math.max(0.5, Number(speedKts) || 5)} targetLat=${last?.latitude ?? ''} targetLon=${last?.longitude ?? ''}`);
      return true;
    } catch (err) {
      debugLog(`WAYPOINT_ROUTE_ERROR objectId=${objectId} points=${route.length} error=${err?.message || err}`);
      return false;
    }
  };

  const ensureParkingBrakeDefinition = () => {
    if (parkingBrakeDefReady) return true;
    try {
      handle.addToDataDefinition(PARKING_BRAKE_DEF_ID, 'BRAKE PARKING POSITION', 'Bool', SimConnectDataType.INT32);
      parkingBrakeDefReady = true;
      debugLog('PARKING_BRAKE_DEF_READY');
      return true;
    } catch (err) {
      debugLog(`PARKING_BRAKE_DEF_ERROR ${err?.message || err}`);
      return false;
    }
  };

  const setObjectParkingBrake = (objectId, engaged = true, reason = 'scene-vehicle-hold') => {
    if (!objectId || !ensureParkingBrakeDefinition()) return false;
    try {
      const buf = new RawBuffer(4);
      buf.writeInt32(engaged ? 1 : 0);
      handle.setDataOnSimObject(PARKING_BRAKE_DEF_ID, objectId, { buffer: buf, arrayCount: 0, tagged: false });
      debugLog(`SCENE_VEHICLE_BRAKE objectId=${objectId} engaged=${engaged ? 1 : 0} reason=${reason}`);
      return true;
    } catch (err) {
      debugLog(`SCENE_VEHICLE_BRAKE_ERROR objectId=${objectId} engaged=${engaged ? 1 : 0} reason=${reason} error=${err?.message || err}`);
      return false;
    }
  };

  const holdVehicleAtPoint = (objectId, point, reason = 'scene-vehicle-hold') => {
    const holdSent = sendWaypointRoute(objectId, [point], 0.5);
    const brakeSet = setObjectParkingBrake(objectId, true, reason);
    setTimeout(() => setObjectParkingBrake(objectId, true, `${reason}-retry1`), 350);
    setTimeout(() => setObjectParkingBrake(objectId, true, `${reason}-retry2`), 1200);
    debugLog(`SCENE_VEHICLE_HOLD objectId=${objectId} holdSent=${holdSent ? 1 : 0} brakeSet=${brakeSet ? 1 : 0} reason=${reason}`);
    return holdSent || brakeSet;
  };

  const ensureDoorEvents = () => {
    if (doorEventsReady) return true;
    try {
      handle.mapClientEventToSimEvent(DOOR_OPEN_EVENT_ID, 'OPEN_AIRCRAFT_DOORS');
      handle.mapClientEventToSimEvent(DOOR_CLOSE_EVENT_ID, 'CLOSE_AIRCRAFT_DOORS');
      handle.mapClientEventToSimEvent(DOOR_TOGGLE_EVENT_ID, 'TOGGLE_AIRCRAFT_EXIT');
      try {
        handle.mapClientEventToSimEvent(DOOR_OPEN_SINGLE_EVENT_ID, 'OPEN_AIRCRAFT_DOOR');
        handle.mapClientEventToSimEvent(DOOR_CLOSE_SINGLE_EVENT_ID, 'CLOSE_AIRCRAFT_DOOR');
      } catch (err) {
        debugLog(`DOOR_EVENTS_OPTIONAL_MAP_WARN ${err?.message || err}`);
      }
      doorEventsReady = true;
      debugLog('DOOR_EVENTS_READY');
      return true;
    } catch (err) {
      debugLog(`DOOR_EVENTS_ERROR ${err?.message || err}`);
      return false;
    }
  };

  const ensurePa24DoorEvents = () => {
    if (pa24DoorEventsReady) return true;
    try {
      handle.mapClientEventToSimEvent(PA24_DOOR_UNLOCK_EVENT_ID, 'PA24-door_latch_unlock');
      handle.mapClientEventToSimEvent(PA24_DOOR_HANDLE_EVENT_ID, 'PA24-door_handle_open');
      handle.mapClientEventToSimEvent(PA24_DOOR_LOCK_EVENT_ID, 'PA24-door_latch_lock');
      pa24DoorEventsReady = true;
      debugLog('DOOR_PA24_EVENTS_READY');
      return true;
    } catch (err) {
      debugLog(`DOOR_PA24_EVENTS_ERROR ${err?.message || err}`);
      return false;
    }
  };

  const sendDoorClientEvent = (eventId, value, label, reason) => {
    try {
      if (typeof handle.transmitClientEventEx === 'function') {
        handle.transmitClientEventEx(
          SimConnectConstants.OBJECT_ID_USER,
          eventId,
          1,
          EventFlag.EVENT_FLAG_GROUPID_IS_PRIORITY,
          value,
          0,
          0,
          0,
          0
        );
      } else {
        handle.transmitClientEvent(
          SimConnectConstants.OBJECT_ID_USER,
          eventId,
          value,
          1,
          EventFlag.EVENT_FLAG_GROUPID_IS_PRIORITY
        );
      }
      trackerLog(`🚪 Door event: ${label}=${value} (${reason})`);
      debugLog(`DOOR_EVENT_SENT label=${label} value=${value} reason=${reason}`);
      return true;
    } catch (err) {
      debugLog(`DOOR_EVENT_ERROR label=${label} value=${value} reason=${reason} error=${err?.message || err}`);
      return false;
    }
  };

  const normalizeInputEventName = (name) => String(name || '').trim().replace(/^B:/i, '').toLowerCase();
  const compactInputEventName = (name) => normalizeInputEventName(name).replace(/[^a-z0-9]/g, '');

  const isInputEventFuzzyMatch = (cachedName, requestedName) => {
    const cached = normalizeInputEventName(cachedName);
    const requested = normalizeInputEventName(requestedName);
    const cachedCompact = compactInputEventName(cached);
    const requestedCompact = compactInputEventName(requested);
    if (!cachedCompact || !requestedCompact) return false;
    if (cachedCompact === requestedCompact || cachedCompact.includes(requestedCompact)) return true;
    const requestedWithoutLever = requestedCompact.replace(/^lever/, '');
    if (requestedWithoutLever && cachedCompact.includes(requestedWithoutLever)) return true;
    if (requestedCompact.includes('doorlatch')) {
      return ['door', 'latch', 'toggle'].every((token) => cached.includes(token) || cachedCompact.includes(token));
    }
    return false;
  };

  const findInputEventHash = (names = []) => {
    const list = Array.isArray(names) ? names : [names];
    for (const name of list) {
      const hash = inputEventHashCache.get(normalizeInputEventName(name));
      if (hash !== undefined && hash !== null) return hash;
    }
    for (const [cachedName, hash] of inputEventHashCache.entries()) {
      const requestedName = list.find((name) => isInputEventFuzzyMatch(cachedName, name));
      if (requestedName && hash !== undefined && hash !== null) {
        debugLog(`INPUT_EVENT_FUZZY_MATCH requested=${normalizeInputEventName(requestedName)} matched=${cachedName}`);
        return hash;
      }
    }
    return null;
  };

  const resolvePendingInputEventLookups = () => {
    for (let i = pendingInputEventLookups.length - 1; i >= 0; i -= 1) {
      const pending = pendingInputEventLookups[i];
      const hash = findInputEventHash(pending.names);
      if (hash !== null || inputEventsEnumerationDone) {
        pendingInputEventLookups.splice(i, 1);
        clearTimeout(pending.timer);
        pending.resolve(hash);
      }
    }
  };

  const cacheInputEventDescriptors = (descriptors = []) => {
    let added = 0;
    descriptors.forEach((descriptor) => {
      const name = String(descriptor?.name || '').trim();
      const hash = descriptor?.inputEventIdHash;
      if (!name || hash === undefined || hash === null) return;
      const key = normalizeInputEventName(name);
      if (!inputEventHashCache.has(key)) added++;
      inputEventHashCache.set(key, hash);
    });
    return added;
  };

  const requestInputEventEnumeration = (reason = 'input-event') => {
    if (inputEventsEnumerationDone || inputEventsEnumerating) return true;
    if (typeof handle.enumerateInputEvents !== 'function') {
      debugLog(`INPUT_EVENT_ENUM_UNSUPPORTED reason=${reason}`);
      inputEventsEnumerationDone = true;
      resolvePendingInputEventLookups();
      return false;
    }
    try {
      handle.enumerateInputEvents(INPUT_EVENT_ENUM_REQUEST_ID);
      inputEventsEnumerating = true;
      debugLog(`INPUT_EVENT_ENUM_REQUEST reason=${reason}`);
      setTimeout(() => {
        if (!inputEventsEnumerating) return;
        inputEventsEnumerating = false;
        inputEventsEnumerationDone = true;
        debugLog(`INPUT_EVENT_ENUM_TIMEOUT cached=${inputEventHashCache.size} reason=${reason}`);
        resolvePendingInputEventLookups();
      }, 1600);
      return true;
    } catch (err) {
      inputEventsEnumerating = false;
      inputEventsEnumerationDone = true;
      debugLog(`INPUT_EVENT_ENUM_ERROR reason=${reason} error=${err?.message || err}`);
      resolvePendingInputEventLookups();
      return false;
    }
  };

  const resolveInputEventHash = async (names = [], reason = 'input-event') => {
    const found = findInputEventHash(names);
    if (found !== null) return found;
    if (inputEventsEnumerationDone) return null;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const index = pendingInputEventLookups.findIndex((pending) => pending.resolve === resolve);
        if (index >= 0) pendingInputEventLookups.splice(index, 1);
        resolve(findInputEventHash(names));
      }, 1650);
      pendingInputEventLookups.push({ names: Array.isArray(names) ? names : [names], resolve, timer });
      requestInputEventEnumeration(reason);
    });
  };

  const setInputEventByNameCandidates = async (names = [], value = 1, reason = 'input-event') => {
    if (typeof handle.setInputEvent !== 'function') {
      debugLog(`INPUT_EVENT_SET_UNSUPPORTED names=${(Array.isArray(names) ? names : [names]).join(',')} reason=${reason}`);
      return false;
    }
    const hash = await resolveInputEventHash(names, reason);
    if (hash === null || hash === undefined) {
      debugLog(`INPUT_EVENT_HASH_MISSING names=${(Array.isArray(names) ? names : [names]).join(',')} reason=${reason}`);
      return false;
    }
    try {
      handle.setInputEvent(hash, value);
      debugLog(`INPUT_EVENT_SET hash=${hash.toString()} value=${value} reason=${reason}`);
      return true;
    } catch (err) {
      debugLog(`INPUT_EVENT_SET_ERROR hash=${hash.toString()} value=${value} reason=${reason} error=${err?.message || err}`);
      return false;
    }
  };

  const ensureNamedVarSetDefinition = (name, units = 'number') => {
    const varName = String(name || '').trim();
    const unitName = String(units || 'number').trim() || 'number';
    if (!varName) return null;
    const key = `${varName}|${unitName}`;
    if (namedVarSetUnsupported.has(key)) return null;
    if (namedVarSetDefCache.has(key)) return namedVarSetDefCache.get(key);
    try {
      const defId = nextDefId++;
      const hr = handle.addToDataDefinition(defId, varName, unitName, SimConnectDataType.FLOAT64);
      if (typeof hr === 'number' && hr < 0) {
        namedVarSetUnsupported.add(key);
        debugLog(`A2A_VAR_DEF_UNSUPPORTED name=${varName} units=${unitName} hr=${hr}`);
        return null;
      }
      namedVarSetDefCache.set(key, defId);
      debugLog(`A2A_VAR_DEF_READY name=${varName} units=${unitName} defId=${defId}`);
      return defId;
    } catch (err) {
      namedVarSetUnsupported.add(key);
      debugLog(`A2A_VAR_DEF_ERROR name=${varName} units=${unitName} error=${err?.message || err}`);
      return null;
    }
  };

  const setNamedVarValue = (name, value, units = 'number', reason = 'door') => {
    const defId = ensureNamedVarSetDefinition(name, units);
    if (!defId) return false;
    try {
      const buf = new RawBuffer(8);
      buf.writeFloat64(Number(value) || 0);
      handle.setDataOnSimObject(defId, SimConnectConstants.OBJECT_ID_USER, { buffer: buf, arrayCount: 0, tagged: false });
      debugLog(`A2A_VAR_SET name=${name} units=${units} value=${Number(value) || 0} reason=${reason}`);
      return true;
    } catch (err) {
      debugLog(`A2A_VAR_SET_ERROR name=${name} units=${units} value=${Number(value) || 0} reason=${reason} error=${err?.message || err}`);
      return false;
    }
  };

  const setNamedVarFromCandidates = (candidates = [], value = 0, unitsList = ['number', 'Bool', 'bool'], reason = 'door') => {
    const names = uniqueStrings(Array.isArray(candidates) ? candidates : []);
    const units = uniqueStrings(Array.isArray(unitsList) ? unitsList : [unitsList]);
    for (const name of names) {
      for (const unit of units) {
        if (setNamedVarValue(name, value, unit || 'number', reason)) return true;
      }
    }
    return false;
  };

  const buildDoorVarCandidates = (doorIndex = 1, baseName = 'Door') => {
    const idx = clampInt(doorIndex, 1, 4);
    const useIndices = idx === 1 ? [1, 2] : [idx, 1, 2];
    const out = [];
    const nameVariants = (n) => {
      const cleanBaseName = String(baseName || '');
      const variants = [];
      // A2A Comanche often uses Door1Handle / Door1Latch (index in the middle).
      if (/^Door.*Handle$/i.test(cleanBaseName)) variants.push(`Door${n}Handle`);
      if (/^Door.*Latch$/i.test(cleanBaseName)) variants.push(`Door${n}Latch`);
      if (/^ExitOpen$/i.test(cleanBaseName)) variants.push(`Exit${n}Open`);
      variants.push(cleanBaseName + String(n));
      return uniqueStrings(variants);
    };
    useIndices.forEach((n) => {
      nameVariants(n).forEach((name) => {
        out.push(`L:${name}`);
        out.push(`L:1:${name}`);
        out.push(`Z:${name}`);
      });
    });
    return uniqueStrings(out);
  };

  const setA2aDoorByLVars = async (openDoor, doorIndex = 1, reason = 'boarding', profile = 'a2a', options = {}) => {
    const handleVars = buildDoorVarCandidates(doorIndex, 'DoorHandle');
    const latchVars = buildDoorVarCandidates(doorIndex, 'DoorLatch');
    const exitVars = buildDoorVarCandidates(doorIndex, 'ExitOpen');
    const openVars = buildDoorVarCandidates(doorIndex, 'DoorOpen').concat(buildDoorVarCandidates(doorIndex, 'CabinDoorOpen'));
    const action = openDoor ? 'OPEN' : 'CLOSE';
    const opts = options && typeof options === 'object' ? options : {};
    const isPa24Profile = /pa24|comanche/i.test(String(profile || ''));
    const writeOpenPosition = Object.prototype.hasOwnProperty.call(opts, 'writeOpenPosition')
      ? opts.writeOpenPosition !== false
      : true;
    const writeLatch = opts.writeLatch !== false;
    const latchUnlockValue = Number.isFinite(Number(opts.latchUnlockValue))
      ? Number(opts.latchUnlockValue)
      : (isPa24Profile ? 1 : 0);
    const latchLockValue = Number.isFinite(Number(opts.latchLockValue))
      ? Number(opts.latchLockValue)
      : (isPa24Profile ? 0 : 1);
    const handleOpenValue = Number.isFinite(Number(opts.handleOpenValue)) ? Number(opts.handleOpenValue) : 1;
    const handleCloseValue = Number.isFinite(Number(opts.handleCloseValue)) ? Number(opts.handleCloseValue) : 0;
    debugLog(`A2A_DOOR_LVAR_${action}_START profile=${profile} doorIndex=${doorIndex} writeOpenPosition=${writeOpenPosition ? 1 : 0} writeLatch=${writeLatch ? 1 : 0} handleOpen=${handleOpenValue} handleClose=${handleCloseValue} latchUnlock=${latchUnlockValue} latchLock=${latchLockValue} reason=${reason}`);

    let ok = false;
    if (openDoor) {
      if (writeLatch) ok = setNamedVarFromCandidates(latchVars, latchUnlockValue, ['number', 'Bool', 'bool'], `${reason}-latch-unlock`) || ok;
      await sleep(80);
      ok = setNamedVarFromCandidates(handleVars, handleOpenValue, ['Bool', 'bool', 'number'], `${reason}-handle-open`) || ok;
      if (writeOpenPosition) {
        ok = setNamedVarFromCandidates(openVars, 1, ['Bool', 'bool', 'number'], `${reason}-openvar-bool`) || ok;
        ok = setNamedVarFromCandidates(openVars, 100, ['percent'], `${reason}-openvar-percent`) || ok;
        await sleep(80);
        ok = setNamedVarFromCandidates(exitVars, 1, ['Bool', 'bool', 'number'], `${reason}-exit-open-bool`) || ok;
        ok = setNamedVarFromCandidates(exitVars, 100, ['percent'], `${reason}-exit-open-percent`) || ok;
      }
    } else {
      ok = setNamedVarFromCandidates(handleVars, handleCloseValue, ['Bool', 'bool', 'number'], `${reason}-handle-close`) || ok;
      ok = setNamedVarFromCandidates(openVars, 0, ['Bool', 'bool', 'number', 'percent'], `${reason}-openvar-0`) || ok;
      await sleep(70);
      ok = setNamedVarFromCandidates(exitVars, 0, ['percent', 'number', 'Bool', 'bool'], `${reason}-exit-close`) || ok;
      await sleep(70);
      if (writeLatch) ok = setNamedVarFromCandidates(latchVars, latchLockValue, ['number', 'Bool', 'bool'], `${reason}-latch-lock`) || ok;
    }
    debugLog(`A2A_DOOR_LVAR_${action}_DONE profile=${profile} doorIndex=${doorIndex} status=${ok ? 'ok' : 'error'} reason=${reason}`);
    return ok;
  };

  const buildGenericExitOpenCandidates = (doorIndex = 1) => {
    const idx = clampInt(doorIndex, 0, 8);
    const indices = uniqueStrings([String(idx), '1', '0', '2']);
    const vars = [];
    indices.forEach((token) => {
      vars.push(`EXIT OPEN:${token}`);
      vars.push(`INTERACTIVE POINT OPEN:${token}`);
      vars.push(`INTERACTIVE POINT GOAL:${token}`);
    });
    if (idx === 1) vars.push('CANOPY OPEN');
    return uniqueStrings(vars);
  };

  const setGenericDoorBySimVars = async (openDoor, doorIndex = 1, reason = 'boarding') => {
    const valuePrimary = openDoor ? 100 : 0;
    const valueBool = openDoor ? 1 : 0;
    const candidates = buildGenericExitOpenCandidates(doorIndex);
    let ok = false;
    candidates.forEach((name) => {
      ok = setNamedVarValue(name, valueBool, 'number', `${reason}-simvar-number`) || ok;
      ok = setNamedVarValue(name, valueBool, 'Bool', `${reason}-simvar-bool`) || ok;
      ok = setNamedVarValue(name, valuePrimary, 'percent', `${reason}-simvar-percent`) || ok;
    });
    debugLog(`DOOR_GENERIC_SIMVAR_${openDoor ? 'OPEN' : 'CLOSE'} candidates=${candidates.join(',')} status=${ok ? 'ok' : 'error'} reason=${reason}`);
    await sleep(70);
    return ok;
  };

  const setGenericDoorByEvents = async (openDoor, doorIndex = 1, reason = 'boarding') => {
    if (!ensureDoorEvents()) return false;
    const idx = clampInt(doorIndex, 0, 8);
    const indices = [...new Set([idx, 1, 0, 2].filter(v => Number.isFinite(v) && v >= 0 && v <= 8))];
    const eventId = openDoor ? DOOR_OPEN_EVENT_ID : DOOR_CLOSE_EVENT_ID;
    const label = openDoor ? 'OPEN_AIRCRAFT_DOORS' : 'CLOSE_AIRCRAFT_DOORS';
    const singleEventId = openDoor ? DOOR_OPEN_SINGLE_EVENT_ID : DOOR_CLOSE_SINGLE_EVENT_ID;
    const singleLabel = openDoor ? 'OPEN_AIRCRAFT_DOOR' : 'CLOSE_AIRCRAFT_DOOR';
    const toggleLabel = 'TOGGLE_AIRCRAFT_EXIT';
    let ok = false;
    for (const eventIndex of indices) {
      ok = sendDoorClientEvent(eventId, eventIndex, label, `${reason}-idx-${eventIndex}`) || ok;
      await sleep(60);
      // Some default aircraft only react to singular open/close events.
      ok = sendDoorClientEvent(singleEventId, eventIndex, singleLabel, `${reason}-single-idx-${eventIndex}`) || ok;
      await sleep(60);
    }
    let toggleOk = false;
    // Toggle only as last resort for opening; toggling while closing can re-open doors.
    if (!ok && openDoor) {
      for (const eventIndex of indices) {
        toggleOk = sendDoorClientEvent(DOOR_TOGGLE_EVENT_ID, eventIndex, toggleLabel, `${reason}-toggle-idx-${eventIndex}`) || toggleOk;
        await sleep(60);
      }
    }
    const finalOk = ok || toggleOk;
    debugLog(`DOOR_GENERIC_EVENT_${openDoor ? 'OPEN' : 'CLOSE'} indices=${indices.join(',')} status=${finalOk ? 'ok' : 'error'} directOk=${ok ? 1 : 0} toggleOk=${toggleOk ? 1 : 0} reason=${reason}`);
    return finalOk;
  };

  const setPa24ComancheDoor = async (openDoor, doorIndex = 1, reason = 'boarding') => {
    const action = openDoor ? 'OPEN' : 'CLOSE';
    debugLog(`DOOR_PA24_${action}_START reason=${reason} doorIndex=${doorIndex}`);
    let ok = false;
    let inputLatchOk = false;

    if (openDoor) {
      inputLatchOk = await setInputEventByNameCandidates(PA24_LATCH_INPUT_EVENTS, 1, `${reason}-behavior-latch-toggle-open`);
      ok = inputLatchOk || ok;
      if (inputLatchOk) await sleep(120);
    }

    // Legacy custom latch events only as fallback; the behavior input event is the real PA24 latch path.
    let eventOk = false;
    if (openDoor && !inputLatchOk && ensurePa24DoorEvents()) {
      eventOk = sendDoorClientEvent(PA24_DOOR_UNLOCK_EVENT_ID, 1, 'PA24-door_latch_unlock', reason) || eventOk;
      ok = eventOk || ok;
    }

    // LVar fallback path for A2A aircraft (works without PA24 custom key-event mapping).
    const lvarOk = await setA2aDoorByLVars(openDoor, doorIndex, reason, 'pa24_comanche', {
      writeOpenPosition: true,
      writeLatch: true,
      handleOpenValue: 1,
      handleCloseValue: 0,
      latchUnlockValue: 0,
      latchLockValue: 1
    });
    if (!openDoor) {
      await sleep(120);
      inputLatchOk = await setInputEventByNameCandidates(PA24_LATCH_INPUT_EVENTS, 1, `${reason}-behavior-latch-toggle-close`);
      ok = inputLatchOk || ok;
      if (!inputLatchOk && ensurePa24DoorEvents()) {
        eventOk = sendDoorClientEvent(PA24_DOOR_LOCK_EVENT_ID, 1, 'PA24-door_latch_lock', reason) || eventOk;
        ok = eventOk || ok;
      }
    }
    const finalOk = ok || lvarOk;
    debugLog(`DOOR_PA24_${action}_DONE status=${finalOk ? 'ok' : 'error'} inputLatchOk=${inputLatchOk ? 1 : 0} eventOk=${eventOk ? 1 : 0} lvarOk=${lvarOk ? 1 : 0} reason=${reason}`);
    return finalOk;
  };

  const setUserAircraftDoor = async (openDoor, doorIndex = 1, reason = 'boarding', doorProfile = 'default') => {
    const profile = String(doorProfile || 'default').trim().toLowerCase();
    const now = Date.now();
    // Duplicate-open suppression caused missed Comanche openings in practice.
    // Keep suppression only for repeated/early close commands.
    const sameCloseRecent = !openDoor
      && doorLastApplyOk
      && doorLastAppliedState === false
      && (now - doorLastAppliedAt) <= 5000;
    if (sameCloseRecent) {
      debugLog(`DOOR_SKIP_DUPLICATE_CLOSE profile=${profile} ageMs=${now - doorLastAppliedAt} reason=${reason}`);
      return true;
    }
    if (!openDoor && doorLastApplyOk && doorLastAppliedState === true && (now - doorLastAppliedAt) < 2200) {
      debugLog(`DOOR_SKIP_EARLY_CLOSE profile=${profile} ageMs=${now - doorLastAppliedAt} reason=${reason}`);
      return true;
    }
    trackerLog(`🚪 Door ${openDoor ? 'open' : 'close'} profile=${profile} index=${doorIndex} (${reason})`);
    const tryIndices = [...new Set([
      clampInt(doorIndex, 0, 8),
      1,
      0,
      2
    ])];
    let anySpecificOk = false;
    let anyGenericOk = false;
    for (const idx of tryIndices) {
      const isComancheProfile = (profile === 'pa24_comanche' || profile === 'pa24' || profile === 'comanche');
      const isA2aProfile = profile.includes('a2a');
      if (profile === 'pa24_comanche' || profile === 'pa24' || profile === 'comanche') {
        const pa24Ok = await setPa24ComancheDoor(openDoor, idx, `${reason}-idx-${idx}`);
        anySpecificOk = anySpecificOk || pa24Ok;
      }
      if (profile.includes('a2a')) {
        const lvarOk = await setA2aDoorByLVars(openDoor, idx, `${reason}-idx-${idx}`, profile);
        anySpecificOk = anySpecificOk || lvarOk;
      }
      // For A2A/Comanche, generic door events can fight with custom LVar/event logic.
      // Use generic path only as fallback when specific handling did not succeed.
      if ((isComancheProfile || isA2aProfile) && anySpecificOk) {
        break;
      }
      // Default aircraft path: apply both SimVar set and key events to increase compatibility.
      const simVarOk = await setGenericDoorBySimVars(openDoor, idx, `${reason}-idx-${idx}`);
      const eventOk = await setGenericDoorByEvents(openDoor, idx, `${reason}-idx-${idx}`);
      anyGenericOk = anyGenericOk || simVarOk || eventOk;
      if (anyGenericOk) break;
    }
    const finalOk = anySpecificOk || anyGenericOk;
    doorLastApplyOk = finalOk;
    if (finalOk) {
      doorLastAppliedState = !!openDoor;
      doorLastAppliedAt = Date.now();
    }
    debugLog(`DOOR_${openDoor ? 'OPEN' : 'CLOSE'}_DONE profile=${profile} index=${doorIndex} status=${finalOk ? 'ok' : 'error'} specificOk=${anySpecificOk ? 1 : 0} genericOk=${anyGenericOk ? 1 : 0} reason=${reason}`);
    return finalOk;
  };

  const startUserAircraftDoorOpenHold = (doorIndex = 1, reason = 'door-hold-open', doorProfile = 'default', maxMs = 45000) => {
    const profile = String(doorProfile || 'default').trim().toLowerCase();
    const isComancheProfile = (profile === 'pa24_comanche' || profile === 'pa24' || profile === 'comanche');
    const isA2aProfile = profile.includes('a2a');
    if (!isComancheProfile && !isA2aProfile) return null;
    const idx = clampInt(doorIndex, 0, 8);
    const holdMaxMs = clampInt(maxMs, 5000, 90000);
    const startedAt = Date.now();
    const intervalMs = 1250;
    let active = true;
    let inFlight = false;
    let tick = 0;
    let timer = null;
    const runHold = async (why = 'interval') => {
      if (!active || inFlight) return;
      if ((Date.now() - startedAt) > holdMaxMs) {
        active = false;
        if (timer) clearInterval(timer);
        debugLog(`DOOR_HOLD_OPEN_TIMEOUT profile=${profile} index=${idx} ageMs=${Date.now() - startedAt} reason=${reason}`);
        return;
      }
      inFlight = true;
      tick++;
      try {
        const holdProfile = isComancheProfile ? 'pa24_comanche' : profile;
        await setA2aDoorByLVars(true, idx, `${reason}-hold-${tick}-${why}`, holdProfile, {
          writeOpenPosition: !isComancheProfile,
          writeLatch: !isComancheProfile,
          handleOpenValue: isComancheProfile ? 1 : undefined,
          handleCloseValue: isComancheProfile ? 0 : undefined,
          latchUnlockValue: isComancheProfile ? 1 : undefined,
          latchLockValue: isComancheProfile ? 0 : undefined
        });
      } catch (err) {
        debugLog(`DOOR_HOLD_OPEN_ERROR profile=${profile} index=${idx} tick=${tick} reason=${reason} error=${err?.message || err}`);
      } finally {
        inFlight = false;
      }
    };
    timer = setInterval(() => {
      runHold('interval').catch(() => {});
    }, intervalMs);
    setTimeout(() => {
      runHold('initial').catch(() => {});
    }, 650);
    debugLog(`DOOR_HOLD_OPEN_START profile=${profile} index=${idx} intervalMs=${intervalMs} maxMs=${holdMaxMs} reason=${reason}`);
    return (stopReason = 'stop') => {
      if (!active && !timer) return;
      active = false;
      if (timer) clearInterval(timer);
      timer = null;
      debugLog(`DOOR_HOLD_OPEN_STOP profile=${profile} index=${idx} ticks=${tick} ageMs=${Date.now() - startedAt} reason=${reason} stopReason=${stopReason}`);
    };
  };

  const clampPayloadStationCount = (value, fallback = 12) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return Math.max(1, Math.min(15, Math.round(fallback)));
    return Math.max(1, Math.min(15, Math.round(n)));
  };

  const ensurePayloadReadDefinition = (stationCount) => {
    const count = clampPayloadStationCount(stationCount, 12);
    const cached = payloadReadDefCache.get(count);
    if (cached) return cached;
    const defId = nextDefId++;
    handle.addToDataDefinition(defId, 'TOTAL WEIGHT', 'pounds', SimConnectDataType.FLOAT64);
    handle.addToDataDefinition(defId, 'EMPTY WEIGHT', 'pounds', SimConnectDataType.FLOAT64);
    handle.addToDataDefinition(defId, 'FUEL TOTAL QUANTITY WEIGHT', 'pounds', SimConnectDataType.FLOAT64);
    handle.addToDataDefinition(defId, 'PAYLOAD STATION COUNT', 'number', SimConnectDataType.FLOAT64);
    for (let i = 1; i <= count; i += 1) {
      handle.addToDataDefinition(defId, `PAYLOAD STATION WEIGHT:${i}`, 'pounds', SimConnectDataType.FLOAT64);
    }
    payloadReadDefCache.set(count, defId);
    return defId;
  };

  const ensurePayloadSetDefinition = (indices = []) => {
    const clean = [...new Set((indices || [])
      .map(v => Math.round(Number(v)))
      .filter(v => Number.isFinite(v) && v >= 1 && v <= 15))]
      .sort((a, b) => a - b);
    if (!clean.length) throw new Error('no_valid_station_indices');
    const key = clean.join(',');
    const cached = payloadSetDefCache.get(key);
    if (cached) return cached;
    const defId = nextDefId++;
    clean.forEach((idx) => {
      handle.addToDataDefinition(defId, `PAYLOAD STATION WEIGHT:${idx}`, 'pounds', SimConnectDataType.FLOAT64);
    });
    const entry = { defId, indices: clean };
    payloadSetDefCache.set(key, entry);
    return entry;
  };

  const requestPayloadSnapshot = async (maxStations = 12) => {
    const stationCount = clampPayloadStationCount(maxStations, 12);
    const defId = ensurePayloadReadDefinition(stationCount);
    const requestId = nextReqId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingPayloadReads.delete(requestId);
        reject(new Error('payload_read_timeout'));
      }, 5500);
      pendingPayloadReads.set(requestId, { resolve, reject, timer, stationCount });
      try {
        handle.requestDataOnSimObject(
          requestId,
          defId,
          SimConnectConstants.OBJECT_ID_USER,
          SimConnectPeriod.ONCE,
          0,
          0,
          0,
          0
        );
      } catch (err) {
        clearTimeout(timer);
        pendingPayloadReads.delete(requestId);
        reject(err);
      }
    });
  };

  const applyPayloadStations = async (stations = []) => {
    const normalized = (Array.isArray(stations) ? stations : [])
      .map((row) => ({
        index: Math.round(Number(row?.index)),
        weightLbs: Math.max(0, Number(row?.weightLbs))
      }))
      .filter(row => Number.isFinite(row.index) && row.index >= 1 && row.index <= 15 && Number.isFinite(row.weightLbs));
    if (!normalized.length) throw new Error('no_valid_station_data');
    const { defId, indices } = ensurePayloadSetDefinition(normalized.map(row => row.index));
    const byIndex = new Map(normalized.map(row => [row.index, row.weightLbs]));
    const buf = new RawBuffer(indices.length * 8);
    indices.forEach((idx) => {
      buf.writeFloat64(Number(byIndex.get(idx) || 0));
    });
    handle.setDataOnSimObject(defId, SimConnectConstants.OBJECT_ID_USER, { buffer: buf, arrayCount: 0, tagged: false });
    return {
      changed: indices.length,
      stations: indices.map(idx => ({ index: idx, weightLbs: Math.round((Number(byIndex.get(idx) || 0)) * 10) / 10 }))
    };
  };

  const resolveDoorProfile = (command) => {
    const raw = String(command?.doorProfile || command?.aircraftDoorProfile || '').trim();
    const haystack = `${raw} ${command?.aircraftSlot || ''} ${command?.aircraftName || ''} ${command?.aircraftTitle || ''}`.toLowerCase();
    if (haystack.includes('pa-24') || haystack.includes('pa24') || haystack.includes('comanche')) return 'pa24_comanche';
    if (haystack.includes('a2a')) return 'a2a_generic';
    return raw || 'default';
  };

  const sendAck = (payload) => {
    const ws = getWs();
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      const lastGps = typeof getLastGpsMsg === 'function' ? getLastGpsMsg() : null;
      const ackPayload = { ...(payload || {}) };
      if (!ackPayload.missionId && ackPayload.sceneId) {
        const rec = scenes.get(String(ackPayload.sceneId));
        if (rec?.missionId) ackPayload.missionId = rec.missionId;
      }
      const msg = {
        type: 'gps',
        syncId,
        pin,
        trackerVersion: TRACKER_VERSION,
        trackerVersionCode: TRACKER_VERSION_CODE,
        commandAckOnly: true,
        trackerAck: {
          source: 'tracker',
          ...ackPayload,
          at: Date.now()
        }
      };
      if (lastGps && Number.isFinite(Number(lastGps.lat)) && Number.isFinite(Number(lastGps.lon))) {
        msg.lat = Number(lastGps.lat);
        msg.lon = Number(lastGps.lon);
        msg.alt = Number.isFinite(Number(lastGps.alt)) ? Math.round(Number(lastGps.alt)) : 0;
        msg.hdg = Number.isFinite(Number(lastGps.hdg)) ? Math.round(Number(lastGps.hdg)) : 0;
      }
      debugLog(`ACK ${ackPayload?.type || 'unknown'} mission=${ackPayload?.missionId || 'n/a'} status=${ackPayload?.status || 'n/a'} spawned=${ackPayload?.spawned ?? ''} cleared=${ackPayload?.cleared ?? ''} error=${ackPayload?.error || ''}`);
      ws.send(JSON.stringify(msg));
    } catch (_) {}
  };

  const sceneSummaryForMission = (missionId) => Array.from(scenes.values())
    .filter(rec => String(rec?.missionId || '') === String(missionId || ''))
    .map(rec => ({
      sceneId: rec.sceneId || '',
      objectCount: Array.isArray(rec.objects) ? rec.objects.length : 0,
      spawnedAt: Number(rec.spawnedAt || 0)
    }))
    .filter(row => row.sceneId);

  const enrichMissionStatusWithScenes = (status = null) => {
    if (!status?.missionId) return status;
    const sceneSummary = sceneSummaryForMission(status.missionId);
    return {
      ...status,
      sceneCount: sceneSummary.length,
      scenes: sceneSummary.slice(0, 12)
    };
  };

  const rememberMissionCommand = (command) => {
    const missionId = String(command?.missionId || '').trim();
    if (!missionId) return;
    const lifecycleState = String(command?.state || '').trim().toLowerCase();
    const phase = String(command?.missionPhase || '').trim().toLowerCase();
    const type = String(command?.type || command?.command || '').trim().toLowerCase();
    const reason = String(command?.reason || '').trim().toLowerCase();
    const terminal = /^(ended|closed|reset|cleared|closing)$/i.test(lifecycleState)
      || phase === 'closing'
      || (/^mission_scene_clear/.test(type) && /mission-runtime-reset|mission-close|manual-mission-end/.test(reason));
    const sceneSummary = sceneSummaryForMission(missionId);
    trackerMissionStatus = {
      missionId,
      state: lifecycleState || (terminal ? 'ended' : 'active'),
      active: !terminal,
      phase: phase || null,
      sceneId: command?.sceneId ? String(command.sceneId) : null,
      sceneCount: sceneSummary.length,
      scenes: sceneSummary.slice(0, 12),
      lastCommandType: String(command?.type || command?.command || '').trim() || null,
      updatedAt: Date.now()
    };
  };

  const addLateAssignedSceneObject = (sceneId, obj) => {
    const key = String(sceneId || '').trim();
    if (!key || !obj?.objectId) return false;
    const rec = scenes.get(key);
    if (rec && Array.isArray(rec.objects)) {
      if (!rec.objects.some(o => Number(o?.objectId) === Number(obj.objectId))) {
        rec.objects.push(obj);
        debugLog(`SCENE_LATE_ASSIGN_ATTACHED scene=${key} kind=${obj.kind || ''} objectId=${obj.objectId} title="${obj.title || ''}"`);
      }
      return true;
    }
    const list = lateAssignedSceneObjects.get(key) || [];
    if (!list.some(o => Number(o?.objectId) === Number(obj.objectId))) {
      list.push(obj);
      lateAssignedSceneObjects.set(key, list);
      debugLog(`SCENE_LATE_ASSIGN_BUFFERED scene=${key} kind=${obj.kind || ''} objectId=${obj.objectId} title="${obj.title || ''}"`);
    }
    return true;
  };

  const consumeLateAssignedSceneObjects = (sceneId) => {
    const key = String(sceneId || '').trim();
    if (!key) return [];
    const list = lateAssignedSceneObjects.get(key) || [];
    lateAssignedSceneObjects.delete(key);
    return list;
  };

  const rememberLateAssignableRequest = (requestId, pending, reason = 'failed') => {
    if (!pending) return;
    const expiresAt = Date.now() + LATE_ASSIGNED_RETENTION_MS;
    lateAssignedRequests.set(requestId, {
      ...(pending.meta || {}),
      title: pending.title,
      pos: pending.pos,
      reason,
      expiresAt
    });
    setTimeout(() => {
      const rec = lateAssignedRequests.get(requestId);
      if (rec && rec.expiresAt <= Date.now()) lateAssignedRequests.delete(requestId);
    }, LATE_ASSIGNED_RETENTION_MS + 1000);
  };

  const rejectPendingAssign = (requestId, pending, err, reason = 'exception') => {
    if (!pendingAssign.has(requestId)) return;
    pendingAssign.delete(requestId);
    clearTimeout(pending.timer);
    if (pending.exceptionTimer) clearTimeout(pending.exceptionTimer);
    rememberLateAssignableRequest(requestId, pending, reason);
    pending.reject(err instanceof Error ? err : new Error(String(err || reason)));
  };

  const waitForAssignedObject = (requestId, timeoutMs = 5000, meta = {}) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const hint = lastExceptions.length ? lastExceptions.splice(0).join(', ') : 'keine Antwort vom Sim';
      const pending = pendingAssign.get(requestId);
      if (pending) rejectPendingAssign(requestId, pending, new Error(hint), 'timeout');
    }, timeoutMs);
    pendingAssign.set(requestId, { resolve, reject, timer, exceptionTimer: null, title: meta.title || '', pos: meta.pos || null, meta });
  });

  const usesAltitudeSensitiveVfx = (title, pos = {}, meta = {}) => {
    const plan = meta?.plan || {};
    const altOffsetFt = toFiniteNumber(pos?.altOffsetFt ?? plan?.altOffsetFt, 0) || 0;
    if (Math.abs(altOffsetFt) < 0.5) return false;
    const text = [
      title,
      pos?.title,
      pos?.requestedTitle,
      pos?.kind,
      pos?.label,
      plan?.title,
      plan?.requestedTitle,
      plan?.kind,
      plan?.label
    ].filter(Boolean).join(' ').toLowerCase();
    return /(smoke|rauch|fire|feuer|vfx|vo_smoke|vo_fire|chimney_smoke|signal)/.test(text);
  };

  const isSceneAircraftSpawn = (title, pos = {}, meta = {}) => {
    const plan = meta?.plan || {};
    const text = [
      title,
      pos?.title,
      pos?.requestedTitle,
      pos?.kind,
      pos?.label,
      plan?.title,
      plan?.requestedTitle,
      plan?.kind,
      plan?.label
    ].filter(Boolean).join(' ').toLowerCase();
    return /(aircraft_wreck|aircraft\.wreck|kleinflugzeug|ul-wrack|flugzeug|skyhawk|cessna|savage cub|vl3|pipistrel|da40)/.test(text);
  };

  const spawnObject = async (title, pos, timeoutMs = 5000, meta = {}) => {
    const requestId = nextReqId++;
    lastExceptions.length = 0;
    const waitPromise = waitForAssignedObject(requestId, timeoutMs, { ...meta, title, pos });
    try {
      const onGround = !usesAltitudeSensitiveVfx(title, pos, meta);
      if (!onGround) debugLog(`SPAWN_CREATE_VFX_ALT title="${title}" altFt=${pos.altFt} altOffsetFt=${pos.altOffsetFt} onGround=0`);
      const initPos = buildInitPos(pos.lat, pos.lon, pos.altFt, pos.hdg, onGround);
      if (isSceneAircraftSpawn(title, pos, meta) && typeof handle.aICreateNonATCAircraft === 'function') {
        const tailNumber = `D-SAR${String(requestId % 1000).padStart(3, '0')}`;
        debugLog(`SPAWN_CREATE_NON_ATC_AIRCRAFT title="${title}" tail="${tailNumber}" onGround=${onGround ? 1 : 0}`);
        handle.aICreateNonATCAircraft(title, tailNumber, initPos, requestId);
      } else {
        handle.aICreateSimulatedObject(title, initPos, requestId);
      }
    } catch (err) {
      const pending = pendingAssign.get(requestId);
      if (pending) rejectPendingAssign(requestId, pending, err, 'create-throw');
    }
    return waitPromise;
  };

  const trackObjectId = (objectId) => {
    const id = Number(objectId);
    if (Number.isFinite(id) && id > 0) trackedObjectIds.add(id);
    return id;
  };

  const forgetObjectId = (objectId) => {
    const id = Number(objectId);
    if (Number.isFinite(id) && id > 0) trackedObjectIds.delete(id);
    return id;
  };

  const removeSceneObject = (rec, obj, reason = 'scene-remove') => {
    if (!obj || !obj.objectId) return false;
    try {
      handle.aIRemoveObject(obj.objectId, nextReqId++);
      forgetObjectId(obj.objectId);
      if (rec && Array.isArray(rec.objects)) {
        rec.objects = rec.objects.filter(o => o.objectId !== obj.objectId);
      }
      debugLog(`SCENE_OBJECT_REMOVE scene=${rec?.sceneId || 'n/a'} kind=${obj.kind || ''} objectId=${obj.objectId} reason=${reason}`);
      return true;
    } catch (err) {
      debugLog(`SCENE_OBJECT_REMOVE_ERROR scene=${rec?.sceneId || 'n/a'} kind=${obj.kind || ''} objectId=${obj.objectId} reason=${reason} error=${err?.message || err}`);
      return false;
    }
  };

  const spawnSceneObjectFromPlan = async (sceneId, plan, timeoutMs = 2600) => {
    const candidates = plan.titleCandidates?.length ? plan.titleCandidates : [plan.title];
    let lastError = null;
    for (const candidate of candidates) {
      try {
        debugLog(`SCENE_TRY scene=${sceneId} kind=${plan.kind} title="${candidate}"`);
        const objectId = await spawnObject(candidate, plan, timeoutMs, {
          sceneId,
          plan,
          requestedTitle: plan.title
        });
        trackObjectId(objectId);
        const spawnedObj = { objectId, ...plan, title: candidate, requestedTitle: plan.title };
        trackerLog(`  OK scene ${plan.kind}: objectId=${objectId} title="${candidate}"`);
        debugLog(`SCENE_SPAWN_OK scene=${sceneId} kind=${plan.kind} index=${plan.index} objectId=${objectId} title="${candidate}" requestedTitle="${plan.title}" lat=${plan.lat} lon=${plan.lon} altFt=${plan.altFt} hdg=${plan.hdg} forwardM=${plan.forwardM} rightM=${plan.rightM}`);
        return spawnedObj;
      } catch (err) {
        lastError = err;
        trackerWarn(`  ✗ scene ${plan.kind} title="${candidate}": ${err?.message || err}`);
        debugLog(`SCENE_TRY_ERROR scene=${sceneId} kind=${plan.kind} title="${candidate}" error=${err?.message || err}`);
      }
    }
    debugLog(`SCENE_SPAWN_ERROR scene=${sceneId} kind=${plan.kind} title="${plan.title}" candidates=${JSON.stringify(candidates)} error=${lastError?.message || lastError || 'all candidates failed'}`);
    return null;
  };

  const defaultSceneItems = () => ([
    {
      kind: 'vehicle',
      label: 'Feuerwehrfahrzeug',
      objectTitle: MISSION_SCENE_VEHICLE_TITLE,
      titleCandidates: [
        MISSION_SCENE_VEHICLE_TITLE,
        'Car Bush Firefighting (FIREFIGHTING_DEFAULT)',
        'FIREFIGHTING_DEFAULT',
        'Car_Bush_Firefighting'
      ],
      forwardM: 22,
      rightM: -12,
      headingMode: 'face_aircraft',
      altOffsetFt: 0
    },
    {
      kind: 'person',
      label: 'Einweiserin',
      objectTitle: MISSION_SCENE_PERSON_TITLE,
      titleCandidates: [
        MISSION_SCENE_PERSON_TITLE,
        'Termac_Female_Summer_Asian',
        'Tarmac_Female_Summer_Asian'
      ],
      forwardM: 14,
      rightM: -5,
      headingMode: 'face_aircraft',
      altOffsetFt: 0
    }
  ]);

  const aptArrivalCandidatePoint = (candidate = null) => {
    const lat = toFiniteNumber(candidate?.lat ?? candidate?.point?.lat, null);
    const lon = toFiniteNumber(candidate?.lon ?? candidate?.point?.lon, null);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return {
      lat,
      lon,
      source: String(candidate?.source || candidate?.kind || ''),
      sourceId: String(candidate?.sourceId || ''),
      name: String(candidate?.name || '')
    };
  };

  const aptArrivalLiveTraffic = () => {
    try {
      const snapshot = typeof getGroundTrafficSnapshot === 'function' ? getGroundTrafficSnapshot() : [];
      return Array.isArray(snapshot) ? snapshot : [];
    } catch (_) {
      return [];
    }
  };

  const aptArrivalPointOccupied = (point, traffic, radiusM = 35) => {
    if (!point || !Array.isArray(traffic) || traffic.length === 0) return false;
    return traffic.some(ac => geoDistanceM(point.lat, point.lon, ac?.lat, ac?.lon) <= radiusM);
  };

  const resolveAptArrivalLivePlacement = (command) => {
    if (String(command?.targetSceneKind || '').toLowerCase() !== 'apt_arrival') return command;
    const candidates = command?.placementCandidates && typeof command.placementCandidates === 'object' ? command.placementCandidates : null;
    const parking = (Array.isArray(candidates?.parking) ? candidates.parking : []).map(aptArrivalCandidatePoint).filter(Boolean);
    const apron = (Array.isArray(candidates?.apron) ? candidates.apron : []).map(aptArrivalCandidatePoint).filter(Boolean);
    if (!parking.length && !apron.length) return command;
    const traffic = aptArrivalLiveTraffic();
    if (!traffic.length) return command;
    const ordered = [
      ...parking.map(p => ({ ...p, liveSource: 'osm_parking_position', radiusM: 35 })),
      ...apron.map(p => ({ ...p, liveSource: 'osm_apron', radiusM: 45 }))
    ];
    const picked = ordered.find(p => !aptArrivalPointOccupied(p, traffic, p.radiusM));
    if (!picked) {
      debugLog(`APT_ARRIVAL_LIVE_SNAP_NO_CLEAR_POINT airport=${command?.airportIcao || ''} traffic=${traffic.length} candidates=${ordered.length}`);
      return {
        ...command,
        snapStatus: {
          ...(command.snapStatus || {}),
          liveOccupancy: 'all_candidates_occupied_or_too_close',
          liveTrafficCount: traffic.length,
          liveCheckedAt: Date.now()
        }
      };
    }
    if (Math.abs(Number(command.lat) - picked.lat) < 0.0000001 && Math.abs(Number(command.lon) - picked.lon) < 0.0000001) {
      return {
        ...command,
        snapStatus: {
          ...(command.snapStatus || {}),
          liveOccupancy: 'checked_clear',
          liveTrafficCount: traffic.length,
          liveCheckedAt: Date.now()
        }
      };
    }
    debugLog(`APT_ARRIVAL_LIVE_SNAP airport=${command?.airportIcao || ''} source=${picked.liveSource} sourceId=${picked.sourceId} traffic=${traffic.length} lat=${picked.lat} lon=${picked.lon}`);
    return {
      ...command,
      lat: picked.lat,
      lon: picked.lon,
      snapStatus: {
        ...(command.snapStatus || {}),
        source: picked.liveSource,
        reason: picked.liveSource === 'osm_apron' ? 'parking_candidates_occupied_use_apron' : 'live_unoccupied_parking_candidate',
        sourceId: picked.sourceId || '',
        name: picked.name || '',
        liveOccupancy: 'checked_clear',
        liveTrafficCount: traffic.length,
        liveCheckedAt: Date.now()
      },
      osmPlacement: {
        ...(command.osmPlacement || {}),
        source: picked.liveSource,
        point: { lat: picked.lat, lon: picked.lon },
        sourceId: picked.sourceId || '',
        name: picked.name || ''
      }
    };
  };

  const buildScenePlan = (command) => {
    command = resolveAptArrivalLivePlacement(command);
    const lastGps = typeof getLastGpsMsg === 'function' ? getLastGpsMsg() : null;
    const base = {
      lat: toFiniteNumber(command?.lat, toFiniteNumber(command?.aircraftLat, toFiniteNumber(lastGps?.lat, null))),
      lon: toFiniteNumber(command?.lon, toFiniteNumber(command?.aircraftLon, toFiniteNumber(lastGps?.lon, null))),
      altFt: toFiniteNumber(command?.altFt ?? command?.alt, toFiniteNumber(command?.aircraftAltFt ?? command?.aircraftAlt, toFiniteNumber(lastGps?.alt, null))),
      hdg: toFiniteNumber(command?.hdg ?? command?.heading, toFiniteNumber(command?.aircraftHdg ?? command?.aircraftHeading, toFiniteNumber(lastGps?.hdg, 0)))
    };
    if (!Number.isFinite(base.lat) || !Number.isFinite(base.lon) || !Number.isFinite(base.altFt)) return [];
    const items = Array.isArray(command?.items) && command.items.length > 0 ? command.items : defaultSceneItems();
    return items.map((item, idx) => {
      const title = String(item?.objectTitle || item?.title || '').trim();
      const titleCandidates = buildTitleCandidates(title, item?.titleCandidates || item?.objectTitleCandidates || item?.titles || []);
      const forwardM = toFiniteNumber(item?.forwardM ?? item?.forward, 0);
      const rightM = toFiniteNumber(item?.rightM ?? item?.right, 0);
      const rel = buildRelativePosition(base, forwardM, rightM);
      const altOffsetFt = toFiniteNumber(item?.altOffsetFt, 0) || 0;
      const mode = String(item?.headingMode || '').trim().toLowerCase();
      const hdg = mode === 'face_aircraft'
        ? normalizeHeading(base.hdg + 180)
        : normalizeHeading(Number.isFinite(Number(item?.hdg ?? item?.heading)) ? Number(item?.hdg ?? item?.heading) : base.hdg + toFiniteNumber(item?.hdgOffsetDeg, 0));
      return {
        index: idx + 1,
        kind: String(item?.kind || `scene-${idx + 1}`),
        label: String(item?.label || item?.kind || `Scene ${idx + 1}`),
        title,
        titleCandidates,
        lat: rel.lat,
        lon: rel.lon,
        altFt: base.altFt + altOffsetFt,
        hdg,
        baseAltFt: base.altFt,
        altOffsetFt,
        forwardM,
        rightM,
        itemId: item?.itemId || item?.cargoItemId || '',
        cargoItemId: item?.cargoItemId || item?.itemId || '',
        cargoSceneKind: item?.cargoSceneKind || item?.sceneKind || item?.kind || '',
        northM: Math.round(rel.northM * 10) / 10,
        eastM: Math.round(rel.eastM * 10) / 10
      };
    }).filter(p => p.title && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Number.isFinite(p.altFt));
  };

  const sceneBoardingProfiles = {
    ga_right_cockpit_v1: [
      { forwardM: 16, rightM: -8 },
      { forwardM: 4.5, rightM: 8.5 }
    ]
  };

  const normalizeBoardingPathPoint = (point, fallback = {}) => {
    const src = point && typeof point === 'object' ? point : {};
    return {
      forwardM: toFiniteNumber(src.forwardM ?? src.forward ?? src.x, toFiniteNumber(fallback.forwardM ?? fallback.forward ?? fallback.x, 0)),
      rightM: toFiniteNumber(src.rightM ?? src.right ?? src.y, toFiniteNumber(fallback.rightM ?? fallback.right ?? fallback.y, 0)),
      altOffsetFt: toFiniteNumber(src.altOffsetFt ?? src.altOffset ?? src.z, toFiniteNumber(fallback.altOffsetFt ?? fallback.altOffset ?? fallback.z, 0))
    };
  };

  const commandBoardingPath = (command) => {
    const raw = Array.isArray(command?.path) ? command.path
      : (Array.isArray(command?.boardingPath) ? command.boardingPath
        : (Array.isArray(command?.waypoints) ? command.waypoints : null));
    return raw && raw.length >= 2 ? raw : null;
  };

  const sceneBaseFromCommand = (command, rec) => {
    const lastGps = typeof getLastGpsMsg === 'function' ? getLastGpsMsg() : null;
    const original = rec?.command || {};
    return {
      lat: toFiniteNumber(command?.lat, toFiniteNumber(command?.aircraftLat, toFiniteNumber(original?.lat, toFiniteNumber(lastGps?.lat, null)))),
      lon: toFiniteNumber(command?.lon, toFiniteNumber(command?.aircraftLon, toFiniteNumber(original?.lon, toFiniteNumber(lastGps?.lon, null)))),
      altFt: toFiniteNumber(command?.altFt ?? command?.alt, toFiniteNumber(command?.aircraftAltFt ?? command?.aircraftAlt, toFiniteNumber(original?.altFt ?? original?.alt, toFiniteNumber(lastGps?.alt, null)))),
      hdg: normalizeHeading(toFiniteNumber(command?.hdg ?? command?.heading, toFiniteNumber(command?.aircraftHdg ?? command?.aircraftHeading, toFiniteNumber(original?.hdg ?? original?.heading, toFiniteNumber(lastGps?.hdg, 0)))))
    };
  };

  const headingBetweenOffsets = (from, to, fallbackHdg = 0) => {
    const north = Number(to?.northM) - Number(from?.northM);
    const east = Number(to?.eastM) - Number(from?.eastM);
    if (!Number.isFinite(north) || !Number.isFinite(east) || (Math.abs(north) < 0.01 && Math.abs(east) < 0.01)) {
      return normalizeHeading(fallbackHdg);
    }
    return normalizeHeading(Math.atan2(east, north) * 180 / Math.PI);
  };

  const lerp = (a, b, t) => Number(a) + (Number(b) - Number(a)) * t;

  const pathDistanceM = (points) => {
    let total = 0;
    for (let i = 0; i < (points || []).length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      total += Math.hypot(Number(b?.northM) - Number(a?.northM), Number(b?.eastM) - Number(a?.eastM));
    }
    return Number.isFinite(total) ? total : 0;
  };

  const relativeScenePoint = (base, point, fallback = {}) => {
    const normalized = normalizeBoardingPathPoint(point, fallback);
    const rel = buildRelativePosition(base, normalized.forwardM, normalized.rightM);
    return {
      ...normalized,
      lat: rel.lat,
      lon: rel.lon,
      altFt: base.altFt + (Number(normalized.altOffsetFt) || 0),
      hdg: normalizeHeading(base.hdg),
      northM: rel.northM,
      eastM: rel.eastM
    };
  };

  const buildRelativeSceneRoute = (command, rec, rawPoints, fallbackPoints = []) => {
    const base = sceneBaseFromCommand(command, rec);
    const source = Array.isArray(rawPoints) && rawPoints.length >= 2 ? rawPoints : fallbackPoints;
    return source.map((point, index) => relativeScenePoint(base, point, fallbackPoints[index] || point));
  };

  const vehicleParkPoint = (command = {}) => normalizeBoardingPathPoint(command?.vehiclePoint || command?.vehicleParkPoint, { forwardM: 22, rightM: -12 });

  const defaultVehicleDeparturePath = (command = {}) => {
    const park = vehicleParkPoint(command);
    return [
      park,
      { forwardM: 10, rightM: -18 },
      { forwardM: -8, rightM: -18 },
      { forwardM: -22, rightM: -14 }
    ];
  };

  const startVehicleDeparture = (command, rec, sceneId) => {
    if (command?.vehicleDeparture === false) return false;
    const vehicle = rec?.objects?.find(o => String(o?.kind || '').toLowerCase() === 'vehicle' && o.objectId);
    if (!vehicle) {
      debugLog(`SCENE_VEHICLE_DEPART_NOOP scene=${sceneId} reason=no_vehicle`);
      return false;
    }
    const route = buildRelativeSceneRoute(command, rec, command?.vehicleDeparturePath, defaultVehicleDeparturePath(command));
    if (route.length < 2) {
      debugLog(`SCENE_VEHICLE_DEPART_NOOP scene=${sceneId} reason=invalid_route`);
      return false;
    }
    const base = sceneBaseFromCommand(command, rec);
    const boardVehiclePeople = rec.objects.filter(o => /^person_idle/i.test(String(o?.kind || '')) && o.objectId);
    const boardDelayMs = boardVehiclePeople.length ? clampInt(command?.vehicleBoardDelayMs ?? 2600, 800, 7000) : 0;
    if (boardVehiclePeople.length) {
      boardVehiclePeople.forEach((obj, index) => {
        const rearPoint = {
          forwardM: Number(obj.forwardM || 0) + 2,
          rightM: Number(obj.rightM || 0) + (index === 0 ? 0.2 : -0.2),
          altOffsetFt: Number(obj.altOffsetFt || 0)
        };
        const rearAbs = relativeScenePoint(base, rearPoint, rearPoint);
        const sent = sendWaypointRoute(obj.objectId, [rearAbs], Math.max(1.5, Math.min(3.5, Number(command?.walkSpeedKts || 2.6) || 2.6)));
        debugLog(`SCENE_VEHICLE_CREW_BOARD scene=${sceneId} objectId=${obj.objectId} status=${sent ? 'ok' : 'failed'} targetForwardM=${rearPoint.forwardM} targetRightM=${rearPoint.rightM}`);
        setTimeout(() => removeSceneObject(rec, obj, 'vehicle-crew-boarded'), Math.max(700, boardDelayMs - 250));
      });
    }
    const speedKts = Math.max(2, Math.min(12, Number(command?.vehicleSpeedKts || command?.vehicleDepartureSpeedKts || 7) || 7));
    let routeSent = false;
    const sendVehicleRoute = () => {
      setObjectParkingBrake(vehicle.objectId, false, 'scene-vehicle-depart');
      routeSent = sendWaypointRoute(vehicle.objectId, route.slice(1), speedKts);
      debugLog(`SCENE_VEHICLE_DEPART scene=${sceneId} objectId=${vehicle.objectId} status=${routeSent ? 'ok' : 'failed'} points=${route.length - 1} speedKts=${speedKts} boardDelayMs=${boardDelayMs}`);
    };
    if (boardDelayMs > 0) setTimeout(sendVehicleRoute, boardDelayMs);
    else sendVehicleRoute();
    const removeDelayMs = clampInt(boardDelayMs + (pathDistanceM(route) / Math.max(0.5, speedKts * 0.514444)) * 1000 + 1500, 2500, 28000);
    setTimeout(() => {
      removeSceneObject(rec, vehicle, 'vehicle-depart-hidden');
    }, removeDelayMs);
    return true;
  };

  const isPickupVehicleObject = (obj) => {
    const text = `${obj?.kind || ''} ${obj?.label || ''} ${obj?.title || ''} ${obj?.requestedTitle || ''}`.toLowerCase();
    return /vehicle|fahrzeug|van|shuttle|car|auto|truck|medic|fire/.test(text)
      && !/person|pax|passenger|cargo|box|kit|equipment/.test(text);
  };

  const buildBoardingPath = (command, rec, person, options = {}) => {
    const profileName = String(command?.profile || command?.pathProfile || 'ga_right_cockpit_v1').trim();
    const profile = sceneBoardingProfiles[profileName] || sceneBoardingProfiles.ga_right_cockpit_v1;
    const appPath = commandBoardingPath(command);
    const base = sceneBaseFromCommand(command, rec);
    if (!Number.isFinite(base.lat) || !Number.isFinite(base.lon) || !Number.isFinite(base.altFt)) return [];
    const defaultStart = {
      forwardM: toFiniteNumber(person?.forwardM, profile[0].forwardM),
      rightM: toFiniteNumber(person?.rightM, profile[0].rightM)
    };
    let points = appPath
      ? appPath.map((pt, index) => normalizeBoardingPathPoint(pt, index === 0 ? defaultStart : profile[Math.min(index, profile.length - 1)]))
      : [defaultStart, ...profile.slice(1).map(pt => normalizeBoardingPathPoint(pt))];
    if (options.startAtPerson && points[0]) {
      points[0] = normalizeBoardingPathPoint(defaultStart, points[0]);
    } else if (command?.spawnPoint && points[0]) {
      points[0] = normalizeBoardingPathPoint(command.spawnPoint, points[0]);
    }
    if (command?.targetPoint && points.length >= 2) {
      points[points.length - 1] = normalizeBoardingPathPoint(command.targetPoint, points[points.length - 1]);
    }
    return points.map((pt) => {
      const rel = buildRelativePosition(base, pt.forwardM, pt.rightM);
      return {
        ...rel,
        forwardM: Number(pt.forwardM) || 0,
        rightM: Number(pt.rightM) || 0,
        altFt: base.altFt + (toFiniteNumber(pt.altOffsetFt, toFiniteNumber(person?.altOffsetFt, 0)) || 0),
        hdg: base.hdg
      };
    });
  };

  const animateMissionSceneBoarding = async (command) => {
    const sceneId = String(command?.sceneId || 'mission-scene');
    const commandId = command?.commandId || null;
    const missionId = String(command?.missionId || '').trim();
    if (activeBoardingScenes.has(sceneId)) {
      debugLog(`SCENE_BOARDING_NOOP scene=${sceneId} reason=busy`);
      sendAck({ type: 'mission_scene_boarding_ack', commandId, sceneId, missionId, status: 'noop', error: 'busy' });
      return;
    }
    activeBoardingScenes.add(sceneId);
    let stopDoorOpenHold = null;
    const stopDoorHold = (why = 'stop') => {
      if (stopDoorOpenHold) {
        stopDoorOpenHold(why);
        stopDoorOpenHold = null;
      }
    };
    try {
    const rec = scenes.get(sceneId);
    if (!rec || !Array.isArray(rec.objects) || rec.objects.length === 0) {
      debugLog(`SCENE_BOARDING_NOOP scene=${sceneId} reason=no_scene`);
      sendAck({ type: 'mission_scene_boarding_ack', commandId, sceneId, missionId, status: 'noop', error: 'no_scene' });
      return;
    }

    const requestedBoarders = clampInt(command?.boarderCount ?? command?.passengerCount ?? 1, 1, 3);
    const explicitBoarders = rec.objects
      .filter(o => /^person_boarder/i.test(String(o?.kind || '')) && o?.objectId)
      .sort((a, b) => String(a.kind || '').localeCompare(String(b.kind || '')));
    const fallbackPerson = rec.objects.find(o => String(o?.kind || '').toLowerCase() === 'person')
      || rec.objects.find(o => /female|male|human|person|tarmac/i.test(String(o?.title || o?.requestedTitle || '')));
    const boarders = (explicitBoarders.length ? explicitBoarders : (fallbackPerson ? [fallbackPerson] : [])).slice(0, requestedBoarders);
    if (!boarders.length) {
      debugLog(`SCENE_BOARDING_NOOP scene=${sceneId} reason=no_person`);
      sendAck({ type: 'mission_scene_boarding_ack', commandId, sceneId, missionId, status: 'noop', error: 'no_person' });
      return;
    }

    const boarderPlans = boarders.map((person, index) => ({
      person,
      path: buildBoardingPath(command, rec, person, { startAtPerson: index > 0 })
    })).filter(plan => Array.isArray(plan.path) && plan.path.length >= 2);
    if (!boarderPlans.length) {
      debugLog(`SCENE_BOARDING_ERROR scene=${sceneId} reason=invalid_path`);
      sendAck({ type: 'mission_scene_boarding_ack', commandId, sceneId, missionId, status: 'error', error: 'invalid_path' });
      return;
    }

    const requestedDurationMs = clampInt(command?.durationMs ?? 18000, 3000, 45000);
    const finalHoldMs = clampInt(command?.finalHoldMs ?? 450, 0, 2000);
    const removePerson = command?.removePerson !== false;
    const removeCargoAtWaypoint = command?.removeCargoAtWaypoint !== false;
    const cargoHoldMs = clampInt(command?.cargoHoldMs ?? command?.cargoPauseMs ?? 0, 0, 9000);
    const speedKts = Math.max(0.5, toFiniteNumber(command?.speedKts ?? command?.walkSpeedKts, 3.1) || 3.1);
    const doorEnabled = command?.openDoor === true || command?.door === true;
    const doorIndex = clampInt(command?.doorIndex ?? 1, 0, 8);
    const doorProfile = resolveDoorProfile(command);
    const primaryPath = boarderPlans[0].path;
    const distanceM = Math.max(...boarderPlans.map(plan => pathDistanceM(plan.path)));
    const speedMps = Math.max(0.25, speedKts * 0.514444);
    const durationMs = clampInt(Math.max(requestedDurationMs, (distanceM / speedMps) * 1000 + cargoHoldMs + 8500), 3000, 45000);
    const pathSource = commandBoardingPath(command) ? 'app' : (command?.profile || command?.pathProfile || 'ga_right_cockpit_v1');
    const cargoKind = String(command?.cargoObjectKind || 'cargo').toLowerCase();
    const cargoObjects = rec.objects.filter((o) => {
      const kind = String(o?.kind || '').toLowerCase();
      const label = String(o?.label || o?.title || o?.requestedTitle || '').toLowerCase();
      return kind === cargoKind || kind.startsWith(`${cargoKind}_`) || /cargo|load|fracht|container|karton|palette|pallet/.test(kind) || /cargo|load|fracht|container|cardboard|pallet|drop_container/.test(label);
    });
    const cargo = cargoObjects[0] || null;
    let cargoRemoved = 0;
    const removeCargoObjects = (why = 'cargo-waypoint') => {
      if (!cargoObjects.length || cargoRemoved > 0) return 0;
      let removedCount = 0;
      const removedIds = new Set();
      for (const obj of cargoObjects) {
        if (!obj?.objectId || removedIds.has(obj.objectId)) continue;
        try {
          handle.aIRemoveObject(obj.objectId, nextReqId++);
          removedIds.add(obj.objectId);
          removedCount++;
          debugLog(`SCENE_CARGO_REMOVE_OK scene=${sceneId} kind=${obj.kind || ''} objectId=${obj.objectId} reason=${why}`);
        } catch (err) {
          debugLog(`SCENE_CARGO_REMOVE_ERROR scene=${sceneId} kind=${obj.kind || ''} objectId=${obj.objectId} reason=${why} error=${err?.message || err}`);
        }
      }
      if (removedIds.size && Array.isArray(rec.objects)) {
        rec.objects = rec.objects.filter(o => !removedIds.has(o.objectId));
      }
      cargoRemoved += removedCount;
      return removedCount;
    };
    const cargoPathIndex = clampInt(command?.cargoPathIndex ?? command?.cargoIndex ?? 1, 1, Math.max(1, primaryPath.length - 2));
    debugLog(`SCENE_BOARDING_START scene=${sceneId} boarders=${boarderPlans.length} objectIds=${boarderPlans.map(p => p.person.objectId).join(',')} path=${pathSource} durationMs=${durationMs} waypoints=${primaryPath.length - 1} speedKts=${speedKts} door=${doorEnabled ? 1 : 0} doorProfile=${doorProfile} aircraftSlot=${command?.aircraftSlot || ''} aircraftName="${command?.aircraftName || ''}" cargo=${cargoObjects.map(o => o.objectId).join(',') || 0} cargoPathIndex=${cargoPathIndex}`);
    trackerLog(`🚶 Scene ${sceneId}: Boarding-Animation startet (${boarderPlans.length} Pax, ${Math.round(durationMs / 1000)}s).`);

    if (doorEnabled) {
      await setUserAircraftDoor(true, doorIndex, 'boarding-open', doorProfile);
      stopDoorOpenHold = startUserAircraftDoorOpenHold(doorIndex, 'boarding-open', doorProfile, durationMs + 8000);
      await sleep(350);
    }

    const cargoRouteDistanceForPath = (path) => {
      let total = 0;
      for (let i = 0; i < cargoPathIndex && i < path.length - 1; i++) {
        total += Math.hypot(Number(path[i + 1]?.northM) - Number(path[i]?.northM), Number(path[i + 1]?.eastM) - Number(path[i]?.eastM));
      }
      return total;
    };
    const cargoRouteDistanceM = Math.max(...boarderPlans.map(plan => cargoRouteDistanceForPath(plan.path)));
    const cargoRouteMs = Math.max(0, (cargoRouteDistanceM / speedMps) * 1000);
    const cargoArrivalSlackMs = clampInt(command?.cargoArrivalSlackMs ?? 250, 0, 6000);
    const cargoTimingFactor = Math.max(0.7, Math.min(1.4, Number(command?.cargoTimingFactor || 1) || 1));
    const splitCargoRoute = command?.splitCargoRoute === true || command?.stopAtCargo === true;
    const canSplitAtCargo = splitCargoRoute && removeCargoAtWaypoint && cargoObjects.length > 0 && primaryPath.length >= 3 && cargoPathIndex < primaryPath.length - 1;
    let routeSent = false;
    let routeSentCount = 0;
    if (canSplitAtCargo) {
      routeSentCount = boarderPlans.reduce((count, plan) => {
        const sent = sendWaypointRoute(plan.person.objectId, plan.path.slice(1, cargoPathIndex + 1), speedKts);
        return count + (sent ? 1 : 0);
      }, 0);
      routeSent = routeSentCount > 0;
      if (routeSent) {
        const cargoDelayMs = clampInt((cargoRouteMs * cargoTimingFactor) + cargoArrivalSlackMs + cargoHoldMs, 1200, Math.max(1500, durationMs - finalHoldMs - 500));
        setTimeout(() => {
          removeCargoObjects('route-cargo-hold');
          const restartDelayMs = clampInt(command?.cargoRestartDelayMs ?? 850, 250, 2500);
          const restartSpeedKts = Math.max(1, Math.min(speedKts, Number(command?.cargoRestartSpeedKts || 2.1) || 2.1));
          boarderPlans.forEach((plan) => {
            const continuePoints = plan.path.slice(cargoPathIndex + 1);
            if (!continuePoints.length) return;
            const kickPoint = continuePoints[0];
            const kickSent = sendWaypointRoute(plan.person.objectId, [kickPoint], restartSpeedKts);
            debugLog(`SCENE_BOARDING_RESTART_KICK scene=${sceneId} objectId=${plan.person.objectId} status=${kickSent ? 'ok' : 'failed'} speedKts=${restartSpeedKts} delayMs=${restartDelayMs}`);
            setTimeout(() => {
              const continued = sendWaypointRoute(plan.person.objectId, continuePoints, speedKts);
              debugLog(`SCENE_BOARDING_CONTINUE scene=${sceneId} objectId=${plan.person.objectId} points=${continuePoints.length} status=${continued ? 'ok' : 'failed'}`);
            }, restartDelayMs);
          });
        }, cargoDelayMs);
        debugLog(`SCENE_CARGO_HOLD_SCHEDULED scene=${sceneId} objects=${cargoObjects.map(o => o.objectId).join(',')} routeMs=${Math.round(cargoRouteMs)} timingFactor=${cargoTimingFactor} slackMs=${cargoArrivalSlackMs} holdMs=${cargoHoldMs} delayMs=${cargoDelayMs} cargoPathIndex=${cargoPathIndex} routeSent=${routeSentCount}/${boarderPlans.length}`);
      }
    }
    if (!routeSent) {
      routeSentCount = boarderPlans.reduce((count, plan) => {
        const sent = sendWaypointRoute(plan.person.objectId, plan.path.slice(1), speedKts);
        return count + (sent ? 1 : 0);
      }, 0);
      routeSent = routeSentCount > 0;
      if (routeSent && removeCargoAtWaypoint && cargoObjects.length > 0 && primaryPath.length >= 2) {
        const cargoDelayMs = clampInt((cargoRouteMs * cargoTimingFactor) + cargoArrivalSlackMs + cargoHoldMs, 400, Math.max(800, durationMs - finalHoldMs - 500));
        setTimeout(() => removeCargoObjects('route-cargo-waypoint'), cargoDelayMs);
        debugLog(`SCENE_CARGO_REMOVE_SCHEDULED scene=${sceneId} objects=${cargoObjects.map(o => o.objectId).join(',')} routeMs=${Math.round(cargoRouteMs)} timingFactor=${cargoTimingFactor} slackMs=${cargoArrivalSlackMs} holdMs=${cargoHoldMs} delayMs=${cargoDelayMs} splitCargoRoute=${splitCargoRoute ? 1 : 0}`);
      }
    }

    if (!routeSent && command?.fallbackTeleport === true) {
      const plan = boarderPlans[0];
      const segments = [];
      let totalDist = 0;
      for (let i = 0; i < plan.path.length - 1; i++) {
        const from = plan.path[i];
        const to = plan.path[i + 1];
        const dist = Math.hypot(Number(to.northM) - Number(from.northM), Number(to.eastM) - Number(from.eastM));
        totalDist += dist;
        segments.push({ from, to, dist });
      }
      if (totalDist <= 0) totalDist = segments.length;
      const usableDuration = Math.max(500, durationMs - finalHoldMs);
      for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
        const segment = segments[segmentIndex];
        const segmentDuration = usableDuration * (segment.dist > 0 ? segment.dist / totalDist : 1 / segments.length);
        const steps = Math.max(1, Math.round(segmentDuration / 250));
        const hdg = headingBetweenOffsets(segment.from, segment.to, rec?.command?.hdg || 0);
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          teleportObject(plan.person.objectId, {
            lat: lerp(segment.from.lat, segment.to.lat, t),
            lon: lerp(segment.from.lon, segment.to.lon, t),
            altFt: lerp(segment.from.altFt, segment.to.altFt, t),
            hdg
          });
          await sleep(Math.max(40, Math.round(segmentDuration / steps)));
        }
        if (removeCargoAtWaypoint && !cargoRemoved && segmentIndex === cargoPathIndex - 1) {
          if (cargoHoldMs > 0) await sleep(cargoHoldMs);
          removeCargoObjects('fallback-cargo-waypoint');
        }
      }
    } else {
      await sleep(Math.max(500, durationMs - finalHoldMs));
    }
    if (finalHoldMs > 0) await sleep(finalHoldMs);

    let removed = 0;
    if (removePerson) {
      for (const plan of boarderPlans) {
        try {
          handle.aIRemoveObject(plan.person.objectId, nextReqId++);
          removed++;
          rec.objects = rec.objects.filter(o => o.objectId !== plan.person.objectId);
        } catch (err) {
          debugLog(`SCENE_BOARDING_REMOVE_ERROR scene=${sceneId} objectId=${plan.person.objectId} error=${err?.message || err}`);
        }
      }
    }
    if (doorEnabled) {
      stopDoorHold('boarding-close');
      await sleep(300);
      await setUserAircraftDoor(false, doorIndex, 'boarding-close', doorProfile);
    }
    const vehicleDeparture = routeSent ? startVehicleDeparture(command, rec, sceneId) : false;
    debugLog(`SCENE_BOARDING_OK scene=${sceneId} boarders=${boarderPlans.length} routeSent=${routeSent ? 1 : 0} routeSentCount=${routeSentCount} removed=${removed} vehicleDeparture=${vehicleDeparture ? 1 : 0}`);
    sendAck({ type: 'mission_scene_boarding_ack', commandId, sceneId, status: routeSent ? 'ok' : 'error', routeSent: routeSent ? 1 : 0, routeSentCount, removed, cargoRemoved, boarded: routeSent ? boarderPlans.length : 0, vehicleDeparture: vehicleDeparture ? 1 : 0, durationMs, error: routeSent ? '' : 'waypoint_route_failed' });
    } finally {
      if (typeof stopDoorHold === 'function') stopDoorHold('boarding-finally');
      activeBoardingScenes.delete(sceneId);
    }
  };

  const animateMissionSceneDeboarding = async (command) => {
    const sceneId = String(command?.sceneId || 'mission-scene');
    const commandId = command?.commandId || null;
    const missionId = String(command?.missionId || '').trim();
    if (activeDeboardingScenes.has(sceneId)) {
      debugLog(`SCENE_DEBOARDING_NOOP scene=${sceneId} reason=busy`);
      sendAck({ type: 'mission_scene_deboarding_ack', commandId, sceneId, missionId, status: 'noop', error: 'busy' });
      return;
    }
    activeDeboardingScenes.add(sceneId);
    let stopDoorOpenHold = null;
    const stopDoorHold = (why = 'stop') => {
      if (stopDoorOpenHold) {
        stopDoorOpenHold(why);
        stopDoorOpenHold = null;
      }
    };
    try {
    const rec = scenes.get(sceneId) || { sceneId, command: { ...command }, objects: [], positions: [] };
    rec.sceneId = sceneId;
    rec.missionId = missionId || rec.missionId || '';
    rec.command = { ...(rec.command || {}), ...command };
    if (!Array.isArray(rec.objects)) rec.objects = [];
    scenes.set(sceneId, rec);

    const pathSource = commandBoardingPath(command) ? 'app' : (command?.profile || command?.pathProfile || 'ga_right_cockpit_v1');
    const normalPath = buildBoardingPath(command, rec, { forwardM: command?.spawnPoint?.forwardM ?? 16, rightM: command?.spawnPoint?.rightM ?? -8 });
    if (!Array.isArray(normalPath) || normalPath.length < 2) {
      debugLog(`SCENE_DEBOARDING_ERROR scene=${sceneId} reason=invalid_path`);
      sendAck({ type: 'mission_scene_deboarding_ack', commandId, sceneId, missionId, status: 'error', error: 'invalid_path' });
      return;
    }
    const reversePath = normalPath.slice().reverse();
    const vehicleArrivalEnabled = command?.vehicleArrival !== false && command?.vehicleReturn !== false;
    const vehiclePoint = vehicleParkPoint(command);
    const vehicleRouteForward = defaultVehicleDeparturePath(command);
    const vehicleReturnRoute = buildRelativeSceneRoute(command, rec, command?.vehicleReturnPath, vehicleRouteForward.slice().reverse());
    const vehiclePark = vehicleReturnRoute[vehicleReturnRoute.length - 1] || relativeScenePoint(sceneBaseFromCommand(command, rec), vehiclePoint, vehiclePoint);
    let vehicleRouteSent = false;
    let vehicleArrivalMs = 0;
    let arrivalVehicle = null;
    trackerLog(`Scene ${sceneId}: Deboarding-Sequenz startet${vehicleArrivalEnabled ? ' mit Fahrzeug' : ' ohne Fahrzeug'}.`);
    if (vehicleArrivalEnabled) {
      const vehicleStart = vehicleReturnRoute[0];
      const vehicleTitle = String(command?.vehicleTitle || command?.vehicleObjectTitle || MISSION_SCENE_VEHICLE_TITLE).trim() || MISSION_SCENE_VEHICLE_TITLE;
      const vehiclePlan = {
        index: 1,
        kind: 'vehicle_return',
        label: 'Rueckkehr Fahrzeug',
        title: vehicleTitle,
        titleCandidates: buildTitleCandidates(vehicleTitle, command?.vehicleTitleCandidates || ['Car Bush Firefighting', 'Car Bush Firefighting (FIREFIGHTING_DEFAULT)', 'FIREFIGHTING_DEFAULT', 'Car_Bush_Firefighting']),
        lat: vehicleStart.lat,
        lon: vehicleStart.lon,
        altFt: vehicleStart.altFt,
        hdg: headingBetweenOffsets(vehicleStart, vehicleReturnRoute[1] || vehiclePark, command?.hdg || 0),
        baseAltFt: sceneBaseFromCommand(command, rec).altFt,
        altOffsetFt: vehicleStart.altOffsetFt || 0,
        forwardM: vehicleStart.forwardM,
        rightM: vehicleStart.rightM,
        northM: vehicleStart.northM,
        eastM: vehicleStart.eastM
      };
      const vehicle = await spawnSceneObjectFromPlan(sceneId, vehiclePlan, 3000);
      if (!vehicle) {
        sendAck({ type: 'mission_scene_deboarding_ack', commandId, sceneId, status: 'error', error: 'vehicle_spawn_failed' });
        return;
      }
      rec.objects.push(vehicle);
      arrivalVehicle = vehicle;

      const vehicleSpeedKts = Math.max(2, Math.min(12, Number(command?.vehicleSpeedKts || command?.vehicleReturnSpeedKts || 7) || 7));
      vehicleRouteSent = sendWaypointRoute(vehicle.objectId, vehicleReturnRoute.slice(1), vehicleSpeedKts);
      vehicleArrivalMs = clampInt((pathDistanceM(vehicleReturnRoute) / Math.max(0.5, vehicleSpeedKts * 0.514444)) * 1000 + 1200, 2500, 24000);
      debugLog(`SCENE_DEBOARDING_VEHICLE scene=${sceneId} objectId=${vehicle.objectId} routeSent=${vehicleRouteSent ? 1 : 0} arrivalMs=${vehicleArrivalMs}`);
      await sleep(vehicleRouteSent ? vehicleArrivalMs : 1200);
      holdVehicleAtPoint(vehicle.objectId, vehiclePark, 'scene-deboarding-arrival-park');
    } else {
      debugLog(`SCENE_DEBOARDING_NO_VEHICLE scene=${sceneId}`);
    }

    const doorEnabled = command?.openDoor === true || command?.door === true;
    const doorProfile = resolveDoorProfile(command);
    const doorIndex = clampInt(command?.doorIndex ?? 1, 0, 8);
    if (doorEnabled) {
      await setUserAircraftDoor(true, doorIndex, 'deboarding-open', doorProfile);
      stopDoorOpenHold = startUserAircraftDoorOpenHold(doorIndex, 'deboarding-open', doorProfile, 50000);
      await sleep(450);
    }

    const requestedBoarders = clampInt(command?.boarderCount ?? command?.passengerCount ?? 1, 1, 3);
    const personTitles = Array.isArray(command?.personTitleCandidates) ? command.personTitleCandidates : [];
    const primaryPersonTitle = String(command?.personTitle || command?.personObjectTitle || MISSION_SCENE_PERSON_TITLE).trim() || MISSION_SCENE_PERSON_TITLE;
    const personPlans = [];
    const start = reversePath[0];
    for (let i = 0; i < requestedBoarders; i++) {
      const offset = i * 0.8;
      const baseStart = {
        ...start,
        rightM: Number(start.rightM || 0) + offset
      };
      const absStart = relativeScenePoint(sceneBaseFromCommand(command, rec), baseStart, start);
      personPlans.push({
        index: i + 2,
        kind: `person_deboard_${i + 1}`,
        label: `Deboarding Pax ${i + 1}`,
        title: primaryPersonTitle,
        titleCandidates: buildTitleCandidates(primaryPersonTitle, personTitles.length ? personTitles : [MISSION_SCENE_PERSON_TITLE, 'Tarmac_Male_Summer_Asian', 'Termac_Female_Summer_Asian', 'Termac_Male_Summer_Asian']),
        lat: absStart.lat,
        lon: absStart.lon,
        altFt: absStart.altFt,
        hdg: headingBetweenOffsets(reversePath[0], reversePath[1] || vehiclePark, command?.hdg || 0),
        baseAltFt: sceneBaseFromCommand(command, rec).altFt,
        altOffsetFt: absStart.altOffsetFt || 0,
        forwardM: absStart.forwardM,
        rightM: absStart.rightM,
        northM: absStart.northM,
        eastM: absStart.eastM
      });
    }

    const people = [];
    for (const plan of personPlans) {
      const obj = await spawnSceneObjectFromPlan(sceneId, plan, 3000);
      if (obj) {
        rec.objects.push(obj);
        people.push(obj);
      }
    }
    if (!people.length) {
      if (doorEnabled) {
        stopDoorHold('deboarding-close-no-pax');
        await setUserAircraftDoor(false, doorIndex, 'deboarding-close-no-pax', doorProfile);
      }
      sendAck({ type: 'mission_scene_deboarding_ack', commandId, sceneId, status: 'error', error: 'person_spawn_failed', vehicleRouteSent: vehicleRouteSent ? 1 : 0 });
      return;
    }

    const pickupPoint = command?.deboardingPickupPoint || command?.pickupPoint || null;
    const deboardingBase = sceneBaseFromCommand(command, rec);
    const pickupRoutePoint = pickupPoint
      ? (worldPointToRelativeScenePoint(deboardingBase, pickupPoint, vehiclePoint)
        || relativeScenePoint(deboardingBase, normalizeBoardingPathPoint(pickupPoint, vehiclePoint), vehiclePoint))
      : null;
    const walkOffRoute = (!pickupRoutePoint && !vehicleArrivalEnabled)
      ? buildRelativeSceneRoute(command, rec, command?.deboardingWalkOffPath, defaultVehicleDeparturePath(command))
      : [];
    const routeToExit = pickupRoutePoint
      ? reversePath.concat([pickupRoutePoint])
      : (vehicleArrivalEnabled ? reversePath.concat([vehiclePark]) : reversePath.concat(walkOffRoute));
    const walkSpeedKts = Math.max(2.8, Math.min(4.5, Number(command?.walkSpeedKts || 3.3) || 3.3));
    let routeSentCount = 0;
    people.forEach((person, index) => {
      const personRoute = index === 0 ? routeToExit : routeToExit.map((pt, ptIndex) => {
        if (ptIndex === 0) return pt;
        return {
          ...pt,
          rightM: Number(pt.rightM || 0) + (index * 0.8)
        };
      });
      const absRoute = buildRelativeSceneRoute(command, rec, personRoute, personRoute);
      const sent = sendWaypointRoute(person.objectId, absRoute.slice(1), walkSpeedKts);
      routeSentCount += sent ? 1 : 0;
    });
    const walkMs = clampInt((pathDistanceM(routeToExit) / Math.max(0.5, walkSpeedKts * 0.514444)) * 1000 + 1200, 3000, 36000);
    debugLog(`SCENE_DEBOARDING_WALK scene=${sceneId} people=${people.length} routeSent=${routeSentCount}/${people.length} walkMs=${walkMs} path=${pathSource} pickupBound=${pickupRoutePoint ? 1 : 0} walkOff=${walkOffRoute.length}`);
    await sleep(walkMs);
    const boardedPickup = !!pickupRoutePoint || !!vehicleArrivalEnabled;
    if (routeSentCount > 0 && boardedPickup) {
      people.forEach(person => removeSceneObject(rec, person, pickupRoutePoint ? 'deboarding-pickup-boarded' : 'deboarding-vehicle-boarded'));
    }
    let pickupVehicleDeparture = false;
    if (routeSentCount > 0 && boardedPickup) {
      const departRoute = buildRelativeSceneRoute(command, rec, command?.vehicleDeparturePath, defaultVehicleDeparturePath(command));
      const departVehicle = (vehicleRec, vehicle, startPoint, reason) => {
        if (!vehicleRec || !vehicle?.objectId || departRoute.length < 2) return false;
        const speedKts = Math.max(2, Math.min(12, Number(command?.vehicleSpeedKts || command?.vehicleDepartureSpeedKts || 7) || 7));
        setObjectParkingBrake(vehicle.objectId, false, 'scene-deboarding-pickup-depart');
        const sent = sendWaypointRoute(vehicle.objectId, departRoute.slice(1), speedKts);
        if (!sent) return false;
        const distancePath = [startPoint || departRoute[0]].concat(departRoute.slice(1));
        const removeDelayMs = clampInt((pathDistanceM(distancePath) / Math.max(0.5, speedKts * 0.514444)) * 1000 + 1500, 2500, 28000);
        debugLog(`SCENE_DEBOARDING_PICKUP_DEPART scene=${vehicleRec.sceneId || sceneId} objectId=${vehicle.objectId} removeDelayMs=${removeDelayMs} reason=${reason}`);
        setTimeout(() => removeSceneObject(vehicleRec, vehicle, reason), removeDelayMs);
        return true;
      };
      if (arrivalVehicle) {
        pickupVehicleDeparture = departVehicle(rec, arrivalVehicle, vehiclePark, 'deboarding-vehicle-depart-hidden');
      } else if (pickupRoutePoint && command?.deboardingPickupSceneId) {
        const pickupRec = scenes.get(String(command.deboardingPickupSceneId));
        const targetLat = Number(command?.deboardingPickupPoint?.worldLat ?? command?.deboardingPickupPoint?.lat ?? pickupRoutePoint.lat);
        const targetLon = Number(command?.deboardingPickupPoint?.worldLon ?? command?.deboardingPickupPoint?.lon ?? pickupRoutePoint.lon);
        const pickupVehicle = (pickupRec?.objects || [])
          .filter(obj => obj?.objectId && isPickupVehicleObject(obj))
          .map(obj => ({ obj, distanceM: geoDistanceM(obj.lat, obj.lon, targetLat, targetLon) }))
          .filter(entry => entry.distanceM <= 70)
          .sort((a, b) => a.distanceM - b.distanceM)[0]?.obj || null;
        pickupVehicleDeparture = departVehicle(pickupRec, pickupVehicle, pickupRoutePoint, 'deboarding-pickup-vehicle-depart-hidden');
      }
    }
    if (doorEnabled) {
      stopDoorHold('deboarding-close');
      await setUserAircraftDoor(false, doorIndex, 'deboarding-close', doorProfile);
    }
    sendAck({
      type: 'mission_scene_deboarding_ack',
      commandId,
      sceneId,
      status: routeSentCount > 0 ? 'ok' : 'error',
      vehicleRouteSent: vehicleRouteSent ? 1 : 0,
      vehicleArrival: vehicleArrivalEnabled ? 1 : 0,
      pickupVehicleDeparture: pickupVehicleDeparture ? 1 : 0,
      routeSentCount,
      deboarded: routeSentCount,
      durationMs: vehicleArrivalMs + walkMs,
      error: routeSentCount > 0 ? '' : 'waypoint_route_failed'
    });
    } finally {
      if (typeof stopDoorHold === 'function') stopDoorHold('deboarding-finally');
      activeDeboardingScenes.delete(sceneId);
    }
  };

  const clearScene = async (sceneId, reason = 'clear', commandId = null, options = {}) => {
    const key = String(sceneId || 'mission-scene');
    const ackEnabled = options?.ack !== false;
    const rec = scenes.get(key);
    const missionId = rec?.missionId || rec?.command?.missionId || '';
    const bufferedLateObjects = !rec ? consumeLateAssignedSceneObjects(key) : [];
    if (!rec || !Array.isArray(rec.objects) || rec.objects.length === 0) {
      if (bufferedLateObjects.length) {
        let lateCleared = 0;
        debugLog(`SCENE_CLEAR_LATE_START scene=${key} reason=${reason} objects=${bufferedLateObjects.length}`);
        for (const obj of bufferedLateObjects) {
          try {
            handle.aIRemoveObject(obj.objectId, nextReqId++);
            forgetObjectId(obj.objectId);
            lateCleared++;
          } catch (err) {
            debugLog(`SCENE_CLEAR_LATE_ERROR scene=${key} objectId=${obj.objectId} error=${err?.message || err}`);
          }
        }
        debugLog(`SCENE_CLEAR_LATE_OK scene=${key} cleared=${lateCleared} reason=${reason}`);
        if (ackEnabled) sendAck({ type: 'mission_scene_clear_ack', commandId, sceneId: key, missionId, status: lateCleared > 0 ? 'ok' : 'noop', cleared: lateCleared, reason });
        return { cleared: lateCleared };
      }
      debugLog(`SCENE_CLEAR_NOOP scene=${key} reason=${reason}`);
      if (ackEnabled) sendAck({ type: 'mission_scene_clear_ack', commandId, sceneId: key, missionId, status: 'noop', reason });
      return { cleared: 0 };
    }
    const lateObjects = consumeLateAssignedSceneObjects(key);
    if (lateObjects.length) {
      for (const obj of lateObjects) {
        if (!rec.objects.some(o => Number(o?.objectId) === Number(obj.objectId))) rec.objects.push(obj);
      }
      debugLog(`SCENE_CLEAR_LATE_MERGED scene=${key} objects=${lateObjects.length}`);
    }
    let cleared = 0;
    debugLog(`SCENE_CLEAR_START scene=${key} reason=${reason} objects=${rec.objects.length}`);
    for (const obj of rec.objects) {
      try {
        handle.aIRemoveObject(obj.objectId, nextReqId++);
        forgetObjectId(obj.objectId);
        cleared++;
      } catch (err) {
        debugLog(`SCENE_CLEAR_ERROR scene=${key} objectId=${obj.objectId} error=${err?.message || err}`);
      }
    }
    scenes.delete(key);
    trackerLog(`🚒 Scene ${key}: ${cleared} Objekte entfernt (${reason}).`);
    debugLog(`SCENE_CLEAR_OK scene=${key} cleared=${cleared} reason=${reason}`);
    if (ackEnabled) sendAck({ type: 'mission_scene_clear_ack', commandId, sceneId: key, missionId, status: 'ok', cleared, reason });
    return { cleared };
  };

  const sceneObjectMatchesSelector = (obj, command = {}) => {
    if (!obj || !obj.objectId) return false;
    const ids = Array.isArray(command.objectIds) ? command.objectIds.map(Number).filter(Number.isFinite) : [];
    if (ids.length && ids.includes(Number(obj.objectId))) return true;
    const itemIds = new Set((Array.isArray(command.itemIds) ? command.itemIds : [command.itemId]).filter(Boolean).map(v => String(v).toLowerCase()));
    if (itemIds.size && itemIds.has(String(obj.cargoItemId || obj.itemId || '').toLowerCase())) return true;
    const cargoSceneKinds = new Set((Array.isArray(command.cargoSceneKinds) ? command.cargoSceneKinds : [command.cargoSceneKind]).filter(Boolean).map(v => String(v).toLowerCase()));
    if (cargoSceneKinds.size && cargoSceneKinds.has(String(obj.cargoSceneKind || '').toLowerCase())) return true;
    const kinds = new Set((Array.isArray(command.kinds) ? command.kinds : [command.kind]).filter(Boolean).map(v => String(v).toLowerCase()));
    if (kinds.size && kinds.has(String(obj.kind || '').toLowerCase())) return true;
    const labels = (Array.isArray(command.labels) ? command.labels : [command.label]).filter(Boolean).map(v => String(v).toLowerCase());
    if (labels.length) {
      const text = `${obj.label || ''} ${obj.title || ''} ${obj.requestedTitle || ''}`.toLowerCase();
      if (labels.some(label => label && text.includes(label))) return true;
    }
    return false;
  };

  const removeSceneObjectsBySelector = async (command) => {
    const sceneId = String(command?.sceneId || 'mission-scene');
    const commandId = command?.commandId || null;
    const missionId = String(command?.missionId || '').trim();
    const rec = scenes.get(sceneId);
    if (!rec || !Array.isArray(rec.objects) || rec.objects.length === 0) {
      debugLog(`SCENE_OBJECT_REMOVE_NOOP scene=${sceneId} reason=no_scene`);
      sendAck({ type: 'mission_scene_object_remove_ack', commandId, sceneId, missionId, status: 'noop', removed: 0, reason: command?.reason || 'object-remove' });
      return { removed: 0 };
    }
    const targets = rec.objects.filter(obj => sceneObjectMatchesSelector(obj, command));
    let removed = 0;
    for (const obj of targets) {
      removed += removeSceneObject(rec, obj, command?.reason || 'object-remove') ? 1 : 0;
    }
    const status = removed > 0 ? 'ok' : 'noop';
    debugLog(`SCENE_OBJECT_REMOVE_DONE scene=${sceneId} status=${status} removed=${removed} requested=${targets.length}`);
    sendAck({ type: 'mission_scene_object_remove_ack', commandId, sceneId, status, removed, reason: command?.reason || 'object-remove' });
    return { removed };
  };

  const spawnSceneObjectsAppend = async (command) => {
    const sceneId = String(command?.sceneId || 'mission-scene');
    const commandId = command?.commandId || null;
    const missionId = String(command?.missionId || '').trim();
    const positions = buildScenePlan(command);
    if (positions.length === 0) {
      debugLog(`SCENE_OBJECT_SPAWN_INVALID scene=${sceneId}`);
      sendAck({ type: 'mission_scene_object_spawn_ack', commandId, sceneId, missionId, status: 'error', error: 'invalid scene base/items' });
      return { spawned: 0 };
    }
    const rec = scenes.get(sceneId) || { sceneId, command: { ...command }, objects: [], positions: [] };
    rec.sceneId = sceneId;
    rec.missionId = missionId || String(rec.missionId || '').trim();
    rec.command = { ...(rec.command || {}), ...command };
    if (!Array.isArray(rec.objects)) rec.objects = [];
    if (!Array.isArray(rec.positions)) rec.positions = [];
    scenes.set(sceneId, rec);
    const objects = [];
    debugLog(`SCENE_OBJECT_SPAWN_START scene=${sceneId} count=${positions.length}`);
    for (const p of positions) {
      const obj = await spawnSceneObjectFromPlan(sceneId, p, 3000);
      if (obj) {
        rec.objects.push(obj);
        if (String(obj.kind || '').toLowerCase().includes('vehicle')) {
          await sleep(120);
          holdVehicleAtPoint(obj.objectId, obj, 'scene-object-append-park');
        }
        objects.push(obj);
      }
    }
    rec.positions.push(...positions);
    const byKind = countByKind(objects);
    debugLog(`SCENE_OBJECT_SPAWN_DONE scene=${sceneId} spawned=${objects.length} byKind=${JSON.stringify(byKind)}`);
    sendAck({
      type: 'mission_scene_object_spawn_ack',
      commandId,
      sceneId,
      status: objects.length ? 'ok' : 'error',
      spawned: objects.length,
      spawnedByKind: byKind,
      error: objects.length ? '' : 'spawn_failed'
    });
    return { spawned: objects.length };
  };

  const animateMissionSceneManualPax = async (command) => {
    const sceneId = String(command?.sceneId || 'mission-scene-manual-pax');
    const commandId = command?.commandId || null;
    const missionId = String(command?.missionId || '').trim();
    const action = String(command?.action || command?.mode || 'unload').trim().toLowerCase() === 'load' ? 'load' : 'unload';
    if (activeBoardingScenes.size || activeDeboardingScenes.size || activeManualPaxScenes.size) {
      debugLog(`SCENE_MANUAL_PAX_NOOP scene=${sceneId} action=${action} reason=busy`);
      sendAck({ type: 'mission_scene_manual_pax_ack', commandId, sceneId, missionId, status: 'error', action, error: 'busy' });
      return { spawned: 0, removed: 0 };
    }
    activeManualPaxScenes.add(sceneId);
    let stopDoorOpenHold = null;
    const stopDoorHold = (why = 'stop') => {
      if (stopDoorOpenHold) {
        stopDoorOpenHold(why);
        stopDoorOpenHold = null;
      }
    };
    try {
      const rec = scenes.get(sceneId) || { sceneId, command: { ...command }, objects: [], positions: [] };
      rec.sceneId = sceneId;
      rec.missionId = missionId || rec.missionId || '';
      rec.command = { ...(rec.command || {}), ...command };
      if (!Array.isArray(rec.objects)) rec.objects = [];
      if (!Array.isArray(rec.positions)) rec.positions = [];
      scenes.set(sceneId, rec);

      const base = sceneBaseFromCommand(command, rec);
      if (!Number.isFinite(base.lat) || !Number.isFinite(base.lon) || !Number.isFinite(base.altFt)) {
        debugLog(`SCENE_MANUAL_PAX_ERROR scene=${sceneId} action=${action} reason=invalid_scene_base`);
        sendAck({ type: 'mission_scene_manual_pax_ack', commandId, sceneId, missionId, status: 'error', action, error: 'invalid_scene_base' });
        return { spawned: 0, removed: 0 };
      }

      const doorEnabled = command?.openDoor !== false && command?.door !== false;
      const doorIndex = clampInt(command?.doorIndex ?? 1, 0, 8);
      const doorProfile = resolveDoorProfile(command);
      const openWaitMs = clampInt(command?.doorOpenWaitMs ?? command?.openWaitMs ?? 2000, 0, 12000);
      const closeWaitMs = clampInt(command?.doorCloseWaitMs ?? command?.closeWaitMs ?? 1000, 0, 12000);
      const personKind = String(command?.personKind || command?.kind || 'manual_pax').trim() || 'manual_pax';
      const personLabel = String(command?.personLabel || command?.label || 'Passenger').trim() || 'Passenger';
      const personKinds = Array.isArray(command?.personKinds) ? command.personKinds : [];
      const personLabels = Array.isArray(command?.personLabels) ? command.personLabels : [];
      const selector = {
        kinds: uniqueStrings([personKind, ...personKinds].map(v => String(v || '').trim()).filter(Boolean)),
        labels: uniqueStrings([personLabel, command?.label, command?.storyName, ...personLabels].map(v => String(v || '').trim()).filter(Boolean))
      };
      const removeMatchingPax = (reason) => {
        const targets = rec.objects.filter(obj => sceneObjectMatchesSelector(obj, selector));
        let removed = 0;
        for (const obj of targets) {
          removed += removeSceneObject(rec, obj, reason) ? 1 : 0;
        }
        return removed;
      };

      trackerLog(`🚶 Scene ${sceneId}: manueller Pax ${action === 'load' ? 'steigt ein' : 'steigt aus'}.`);
      if (doorEnabled) {
        await setUserAircraftDoor(true, doorIndex, `manual-pax-${action}-open`, doorProfile);
        stopDoorOpenHold = startUserAircraftDoorOpenHold(doorIndex, `manual-pax-${action}-open`, doorProfile, openWaitMs + closeWaitMs + 6000);
      }
      if (openWaitMs > 0) await sleep(openWaitMs);

      let removed = 0;
      let spawned = 0;
      if (action === 'load') {
        removed = removeMatchingPax('manual-pax-load');
      } else {
        removed = removeMatchingPax('manual-pax-unload-refresh');
        const title = String(command?.personTitle || command?.personObjectTitle || command?.objectTitle || MISSION_SCENE_PERSON_TITLE).trim() || MISSION_SCENE_PERSON_TITLE;
        const titleCandidates = buildTitleCandidates(title, command?.personTitleCandidates || command?.titleCandidates || [MISSION_SCENE_PERSON_TITLE, 'Tarmac_Male_Summer_Asian', 'Termac_Female_Summer_Asian']);
        const boardingPoint = command?.boardingPoint || command?.targetPoint || command?.passengerPoint || { forwardM: 4.5, rightM: 8.5, altOffsetFt: 0 };
        const absPoint = relativeScenePoint(base, boardingPoint, { forwardM: 4.5, rightM: 8.5, altOffsetFt: 0 });
        const hdg = normalizeHeading(base.hdg + toFiniteNumber(command?.hdgOffsetDeg, 165));
        const plan = {
          index: rec.positions.length + 1,
          kind: personKind,
          label: personLabel,
          title,
          titleCandidates,
          lat: absPoint.lat,
          lon: absPoint.lon,
          altFt: absPoint.altFt,
          hdg,
          baseAltFt: base.altFt,
          altOffsetFt: absPoint.altOffsetFt || 0,
          forwardM: absPoint.forwardM,
          rightM: absPoint.rightM,
          northM: absPoint.northM,
          eastM: absPoint.eastM
        };
        const obj = await spawnSceneObjectFromPlan(sceneId, plan, 3000);
        if (obj) {
          rec.objects.push(obj);
          rec.positions.push(plan);
          spawned = 1;
        }
      }

      if (closeWaitMs > 0) await sleep(closeWaitMs);
      if (doorEnabled) {
        stopDoorHold(`manual-pax-${action}-close`);
        await setUserAircraftDoor(false, doorIndex, `manual-pax-${action}-close`, doorProfile);
      }
      const ok = action === 'load' ? true : spawned > 0;
      const status = ok ? (action === 'load' && removed === 0 ? 'noop' : 'ok') : 'error';
      debugLog(`SCENE_MANUAL_PAX_DONE scene=${sceneId} action=${action} status=${status} spawned=${spawned} removed=${removed}`);
      sendAck({
        type: 'mission_scene_manual_pax_ack',
        commandId,
        sceneId,
        missionId,
        status,
        action,
        spawned,
        removed,
        error: ok ? '' : 'spawn_failed'
      });
      return { spawned, removed };
    } finally {
      stopDoorHold('manual-pax-finally');
      activeManualPaxScenes.delete(sceneId);
    }
  };

  const spawnMissionScene = async (command) => {
    const sceneId = String(command?.sceneId || 'mission-scene');
    const commandId = command?.commandId || null;
    const missionId = String(command?.missionId || '').trim();
    const positions = buildScenePlan(command);
    if (positions.length === 0) {
      debugLog(`SCENE_SPAWN_INVALID scene=${sceneId}`);
      sendAck({ type: 'mission_scene_spawn_ack', commandId, sceneId, missionId, status: 'error', error: 'invalid scene base/items' });
      return;
    }
    await clearScene(sceneId, 'replace-before-scene', null, { ack: false });
    const objects = [];
    trackerLog(`🚒 Scene ${sceneId}: spawn ${positions.length} Objekte (${JSON.stringify(countByKind(positions))})`);
    debugLog(`SCENE_SPAWN_START scene=${sceneId} count=${positions.length} byKind=${JSON.stringify(countByKind(positions))}`);
    for (const p of positions) {
      const candidates = p.titleCandidates?.length ? p.titleCandidates : [p.title];
      let spawned = false;
      let lastError = null;
      for (const candidate of candidates) {
        try {
          debugLog(`SCENE_TRY scene=${sceneId} kind=${p.kind} title="${candidate}"`);
          const objectId = await spawnObject(candidate, p, 2200, {
            sceneId,
            plan: p,
            requestedTitle: p.title
          });
          const spawnedObj = { objectId, ...p, title: candidate, requestedTitle: p.title };
          objects.push(spawnedObj);
          trackerLog(`  OK scene ${p.kind}: objectId=${objectId} title="${candidate}"`);
          debugLog(`SCENE_SPAWN_OK scene=${sceneId} kind=${p.kind} index=${p.index} objectId=${objectId} title="${candidate}" requestedTitle="${p.title}" lat=${p.lat} lon=${p.lon} altFt=${p.altFt} hdg=${p.hdg} forwardM=${p.forwardM} rightM=${p.rightM}`);
          if (String(p.kind || '').toLowerCase().includes('vehicle')) {
            await sleep(250);
            holdVehicleAtPoint(objectId, p, `scene-spawn-park-${sceneId}`);
          }
          spawned = true;
          break;
        } catch (err) {
          lastError = err;
          trackerWarn(`  ✗ scene ${p.kind} title="${candidate}": ${err?.message || err}`);
          debugLog(`SCENE_TRY_ERROR scene=${sceneId} kind=${p.kind} title="${candidate}" error=${err?.message || err}`);
        }
      }
      if (!spawned) {
        debugLog(`SCENE_SPAWN_ERROR scene=${sceneId} kind=${p.kind} title="${p.title}" candidates=${JSON.stringify(candidates)} error=${lastError?.message || lastError || 'all candidates failed'}`);
      }
    }
    const lateObjects = consumeLateAssignedSceneObjects(sceneId);
    if (lateObjects.length) {
      for (const obj of lateObjects) {
        if (!objects.some(o => Number(o?.objectId) === Number(obj.objectId))) objects.push(obj);
      }
      debugLog(`SCENE_SPAWN_LATE_MERGED scene=${sceneId} objects=${lateObjects.length}`);
    }
    scenes.set(sceneId, { sceneId, missionId, spawnedAt: Date.now(), command: { ...command }, objects, positions });
    sendAck({
      type: 'mission_scene_spawn_ack',
      commandId,
      sceneId,
      missionId,
      status: objects.length > 0 ? 'ok' : 'error',
      requested: positions.length,
      spawned: objects.length,
      requestedByKind: countByKind(positions),
      spawnedByKind: countByKind(objects),
      objects: objects.map(o => ({ objectId: o.objectId, index: o.index, kind: o.kind }))
    });
  };

  const clearMission = async (missionId, reason = 'clear') => {
    const key = String(missionId || 'active');
    const rec = missions.get(key);
    if (!rec || !Array.isArray(rec.objects) || rec.objects.length === 0) {
      debugLog(`CLEAR_NOOP mission=${key} reason=${reason}`);
      sendAck({ type: 'mission_smoke_clear_ack', missionId: key, status: 'noop', reason });
      return { cleared: 0 };
    }
    let cleared = 0;
    debugLog(`CLEAR_START mission=${key} reason=${reason} objects=${rec.objects.length}`);
    for (const obj of rec.objects) {
      try {
        handle.aIRemoveObject(obj.objectId, nextReqId++);
        forgetObjectId(obj.objectId);
        cleared++;
      } catch (err) {
        trackerWarn(`⚠️  Smoke clear objectId=${obj.objectId}: ${err?.message || err}`);
        debugLog(`CLEAR_ERROR mission=${key} objectId=${obj.objectId} error=${err?.message || err}`);
      }
    }
    missions.delete(key);
    trackerLog(`🔥 Smoke Mission ${key}: ${cleared} Objekte entfernt (${reason}).`);
    debugLog(`CLEAR_OK mission=${key} cleared=${cleared} reason=${reason}`);
    sendAck({ type: 'mission_smoke_clear_ack', missionId: key, status: 'ok', cleared, reason });
    return { cleared };
  };

  const clearTrackedObjects = async (reason = 'clear-all') => {
    const ids = [...trackedObjectIds.values()];
    if (!ids.length) {
      debugLog(`TRACKED_CLEAR_NOOP reason=${reason}`);
      return { cleared: 0 };
    }
    let cleared = 0;
    debugLog(`TRACKED_CLEAR_START reason=${reason} objects=${ids.length}`);
    for (const objectId of ids) {
      try {
        handle.aIRemoveObject(objectId, nextReqId++);
        cleared++;
      } catch (err) {
        debugLog(`TRACKED_CLEAR_ERROR objectId=${objectId} reason=${reason} error=${err?.message || err}`);
      } finally {
        forgetObjectId(objectId);
      }
    }
    activeBoardingScenes.clear();
    activeDeboardingScenes.clear();
    activeManualPaxScenes.clear();
    debugLog(`TRACKED_CLEAR_OK reason=${reason} cleared=${cleared}`);
    return { cleared };
  };

  const spawnMissionSmoke = async (command) => {
    const missionId = String(command?.missionId || 'active');
    const title = String(command?.objectTitle || command?.title || MISSION_SMOKE_DEFAULT_TITLE).trim() || MISSION_SMOKE_DEFAULT_TITLE;
    const fireTitle = String(command?.fireObjectTitle || MISSION_FIRE_DEFAULT_TITLE).trim() || MISSION_FIRE_DEFAULT_TITLE;
    const lat = toFiniteNumber(command?.lat, null);
    const lon = toFiniteNumber(command?.lon, null);
    const altFt = toFiniteNumber(command?.altFt ?? command?.alt, null);
    const hdg = toFiniteNumber(command?.hdg ?? command?.heading, 0);
    const count = clampInt(command?.count ?? 5, 1, 20);
    const radiusM = Math.max(0, toFiniteNumber(command?.radiusM ?? command?.['radius-m'], 120) || 0);
    const commandId = command?.commandId || null;
    const smokeSites = Array.isArray(command?.sites) ? command.sites : [];
    const fireSites = Array.isArray(command?.fireSites) ? command.fireSites : [];
    const spawnMode = String(command?.spawnMode || '').trim().toLowerCase();
    const prewarmLat = toFiniteNumber(command?.prewarmLat, null);
    const prewarmLon = toFiniteNumber(command?.prewarmLon, null);
    const prewarmAltFt = toFiniteNumber(command?.prewarmAltFt ?? command?.prewarmAlt, null);
    const prewarmHdg = toFiniteNumber(command?.prewarmHdg ?? command?.prewarmHeading, hdg);
    const usePrewarm = spawnMode === 'prewarm' && Number.isFinite(prewarmLat) && Number.isFinite(prewarmLon) && Number.isFinite(prewarmAltFt);
    const prewarmDelayMs = clampInt(command?.prewarmDelayMs ?? 1400, 100, 5000);
    let positions = [];

    if (smokeSites.length > 0) {
      smokeSites.forEach((site, idx) => {
        positions.push(...buildSpawnPlanForSite(site, { title, altFt, hdg, count, radiusM }, 'smoke', idx + 1));
      });
    } else if (Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(altFt)) {
      positions = buildSpawnPlanForSite({ lat, lon, altFt, hdg, count, radiusM, objectTitle: title, siteId: 'smoke-1', label: 'Rauchentwicklung' }, { title, altFt, hdg, count, radiusM }, 'smoke', 1);
    }

    fireSites.forEach((site, idx) => {
      positions.push(...buildSpawnPlanForSite(site, { title: fireTitle, altFt, hdg, count: 1, radiusM: 0, altOffsetFt: 0 }, 'fire', idx + 1));
    });

    if (positions.length === 0) {
      debugLog(`SPAWN_INVALID mission=${missionId} title="${title}" lat=${lat} lon=${lon} altFt=${altFt} smokeSites=${smokeSites.length} fireSites=${fireSites.length}`);
      sendAck({ type: 'mission_smoke_spawn_ack', commandId, missionId, status: 'error', error: 'invalid spawn sites/lat/lon/altFt' });
      return;
    }

    await clearMission(missionId, 'replace-before-spawn');
    const objects = [];
    trackerLog(`🔥 Smoke Mission ${missionId}: spawn ${positions.length} Objekte (${JSON.stringify(countByKind(positions))}) mode=${usePrewarm ? 'prewarm' : 'target'}`);
    debugLog(`SPAWN_START mission=${missionId} extent=${command?.extent || 'n/a'} mode=${usePrewarm ? 'prewarm' : 'target'} title="${title}" fireTitle="${fireTitle}" count=${positions.length} byKind=${JSON.stringify(countByKind(positions))}`);

    for (const p of positions) {
      try {
        const spawnPos = usePrewarm
          ? { lat: prewarmLat, lon: prewarmLon, altFt: prewarmAltFt, hdg: prewarmHdg }
          : p;
        const objectId = await spawnObject(p.title, spawnPos, 5000, {
          missionId,
          plan: p,
          requestedTitle: p.title
        });
        trackObjectId(objectId);
        objects.push({ objectId, ...p, spawnedAt: { ...spawnPos }, teleported: !usePrewarm });
        trackerLog(`  OK ${p.kind} site=${p.siteIndex} obj=${p.index}: objectId=${objectId}`);
        debugLog(`SPAWN_OK mission=${missionId} kind=${p.kind} site=${p.siteIndex} index=${p.index} objectId=${objectId} title="${p.title}" spawnLat=${spawnPos.lat} spawnLon=${spawnPos.lon} targetLat=${p.lat} targetLon=${p.lon} targetAltFt=${p.altFt} baseAltFt=${p.baseAltFt} altOffsetFt=${p.altOffsetFt}`);
      } catch (err) {
        trackerWarn(`  ✗ ${p.kind} site=${p.siteIndex} obj=${p.index}: ${err?.message || err}`);
        debugLog(`SPAWN_ERROR mission=${missionId} kind=${p.kind} site=${p.siteIndex} index=${p.index} title="${p.title}" error=${err?.message || err}`);
      }
    }

    let teleported = 0;
    if (usePrewarm && objects.length > 0) {
      debugLog(`PREWARM_WAIT mission=${missionId} delayMs=${prewarmDelayMs} objects=${objects.length}`);
      await sleep(prewarmDelayMs);
      for (const obj of objects) {
        const ok = teleportObject(obj.objectId, obj);
        obj.teleported = ok;
        if (ok) teleported++;
        debugLog(`TELEPORT_${ok ? 'OK' : 'FAIL'} mission=${missionId} objectId=${obj.objectId} kind=${obj.kind} site=${obj.siteIndex} lat=${obj.lat} lon=${obj.lon} altFt=${obj.altFt}`);
      }
    }

    missions.set(missionId, { missionId, title, spawnedAt: Date.now(), command: { ...command }, objects, positions });
    sendAck({
      type: 'mission_smoke_spawn_ack',
      commandId,
      missionId,
      status: objects.length > 0 ? 'ok' : 'error',
      objectTitle: title,
      spawnMode: usePrewarm ? 'prewarm' : 'target',
      requested: positions.length,
      spawned: objects.length,
      teleported,
      requestedByKind: countByKind(positions),
      spawnedByKind: countByKind(objects),
      sites: [...new Set(positions.map(p => `${p.kind}:${p.siteId}`))],
      objects: objects.map(o => ({ objectId: o.objectId, index: o.index, kind: o.kind, siteIndex: o.siteIndex }))
    });
  };

  handle.on('assignedObjectID', (recv) => {
    const pending = pendingAssign.get(recv.requestID);
    if (pending) {
      pendingAssign.delete(recv.requestID);
      clearTimeout(pending.timer);
      if (pending.exceptionTimer) clearTimeout(pending.exceptionTimer);
      pending.resolve(recv.objectID);
      return;
    }
    const late = lateAssignedRequests.get(recv.requestID);
    if (late) {
      lateAssignedRequests.delete(recv.requestID);
      const objectId = trackObjectId(recv.objectID);
      const plan = late.plan || late.pos || {};
      const spawnedObj = {
        objectId,
        ...plan,
        title: late.title || plan.title,
        requestedTitle: late.requestedTitle || plan.title || late.title,
        lateAssigned: true
      };
      if (late.sceneId) addLateAssignedSceneObject(late.sceneId, spawnedObj);
      debugLog(`ASSIGNED_LATE_TRACKED requestId=${recv.requestID} objectId=${objectId} scene=${late.sceneId || ''} kind=${spawnedObj.kind || ''} title="${spawnedObj.title || ''}" reason=${late.reason || ''}`);
    }
  });

  handle.on('simObjectData', (recv) => {
    const pending = pendingPayloadReads.get(recv.requestID);
    if (!pending) return;
    pendingPayloadReads.delete(recv.requestID);
    clearTimeout(pending.timer);
    try {
      const readFn = (typeof recv?.data?.readFloat64 === 'function')
        ? (() => recv.data.readFloat64())
        : ((typeof recv?.data?.readDouble === 'function') ? (() => recv.data.readDouble()) : null);
      if (!readFn) throw new Error('payload_read_fn_missing');
      const totalWeightLbs = Number(readFn());
      const emptyWeightLbs = Number(readFn());
      const fuelWeightLbs = Number(readFn());
      const payloadStationCountReported = clampPayloadStationCount(Number(readFn()), pending.stationCount);
      const stations = [];
      for (let i = 1; i <= pending.stationCount; i += 1) {
        const weight = Number(readFn());
        stations.push({
          index: i,
          weightLbs: Number.isFinite(weight) ? Math.round(weight * 10) / 10 : null
        });
      }
      const knownStations = stations.filter(s => s.index <= payloadStationCountReported);
      const payloadWeightLbs = knownStations.reduce((sum, s) => sum + (Number.isFinite(Number(s.weightLbs)) ? Number(s.weightLbs) : 0), 0);
      pending.resolve({
        totalWeightLbs: Number.isFinite(totalWeightLbs) ? Math.round(totalWeightLbs * 10) / 10 : null,
        emptyWeightLbs: Number.isFinite(emptyWeightLbs) ? Math.round(emptyWeightLbs * 10) / 10 : null,
        fuelWeightLbs: Number.isFinite(fuelWeightLbs) ? Math.round(fuelWeightLbs * 10) / 10 : null,
        payloadWeightLbs: Math.round(payloadWeightLbs * 10) / 10,
        payloadStationCount: payloadStationCountReported,
        sampledStationCount: pending.stationCount,
        stations: knownStations
      });
    } catch (err) {
      pending.reject(err);
    }
  });

  handle.on('inputEventsList', (recv) => {
    const added = cacheInputEventDescriptors(recv?.inputEventDescriptors || []);
    const entryNumber = Number(recv?.entryNumber);
    const outOf = Number(recv?.outOf);
    const done = Number.isFinite(entryNumber) && Number.isFinite(outOf)
      ? entryNumber >= outOf - 1
      : true;
    debugLog(`INPUT_EVENT_ENUM_RESULT requestId=${recv?.requestID ?? ''} added=${added} cached=${inputEventHashCache.size} entry=${recv?.entryNumber ?? ''}/${recv?.outOf ?? ''} done=${done ? 1 : 0}`);
    if (done) {
      inputEventsEnumerating = false;
      inputEventsEnumerationDone = true;
    }
    resolvePendingInputEventLookups();
  });

  handle.on('exception', (recv) => {
    const name = recv.exceptionName || String(recv.exception);
    lastExceptions.push(name);
    if (pendingAssign.size > 0) {
      trackerWarn(`[SimConnect Exception] ${name} sendId=${recv.sendId}`);
      const [requestId, pending] = pendingAssign.entries().next().value || [];
      if (pending && !pending.exceptionTimer) {
        pending.lastException = name;
        pending.exceptionTimer = setTimeout(() => {
          const stillPending = pendingAssign.get(requestId);
          if (stillPending) rejectPendingAssign(requestId, stillPending, new Error(name), 'exception');
        }, CREATE_EXCEPTION_GRACE_MS);
      }
    }
    if (pendingPayloadReads.size > 0) {
      const [requestId, pending] = pendingPayloadReads.entries().next().value || [];
      if (pending) {
        pendingPayloadReads.delete(requestId);
        clearTimeout(pending.timer);
        pending.reject(new Error(name));
      }
    }
  });

  return {
    handleCommand(command) {
      const type = String(command?.type || command?.command || '').trim();
      if (/^mission_(scene|smoke)_/i.test(type) || type === 'mission_lifecycle') rememberMissionCommand(command);
      if (type === 'mission_lifecycle') {
        sendAck({
          type: 'mission_lifecycle_ack',
          commandId: command?.commandId || null,
          missionId: command?.missionId || '',
          status: 'ok',
          state: command?.state || '',
          phase: command?.missionPhase || '',
          reason: command?.reason || 'mission-lifecycle'
        });
        return true;
      }
      if (type === 'mission_smoke_spawn') {
        debugLog(`COMMAND mission_smoke_spawn mission=${command?.missionId || 'active'} title="${command?.objectTitle || command?.title || MISSION_SMOKE_DEFAULT_TITLE}" sites=${Array.isArray(command?.sites) ? command.sites.length : 0} fireSites=${Array.isArray(command?.fireSites) ? command.fireSites.length : 0}`);
        spawnMissionSmoke(command).catch(err => {
          trackerWarn(`⚠️  Smoke spawn failed: ${err?.message || err}`);
          sendAck({ type: 'mission_smoke_spawn_ack', commandId: command?.commandId || null, missionId: command?.missionId || 'active', status: 'error', error: err?.message || String(err) });
        });
        return true;
      }
      if (type === 'mission_smoke_clear') {
        debugLog(`COMMAND mission_smoke_clear mission=${command?.missionId || 'active'}`);
        clearMission(command?.missionId || 'active', 'command').catch(err => {
          sendAck({ type: 'mission_smoke_clear_ack', commandId: command?.commandId || null, missionId: command?.missionId || 'active', status: 'error', error: err?.message || String(err) });
        });
        return true;
      }
      if (type === 'mission_scene_spawn') {
        const sceneId = command?.sceneId || 'mission-scene';
        debugLog(`COMMAND mission_scene_spawn scene=${sceneId} items=${Array.isArray(command?.items) ? command.items.length : 0}`);
        enqueueSceneOperation(sceneId, () => spawnMissionScene(command)).catch(err => {
          trackerWarn(`⚠️  Scene spawn failed: ${err?.message || err}`);
          sendAck({ type: 'mission_scene_spawn_ack', commandId: command?.commandId || null, sceneId: command?.sceneId || 'mission-scene', missionId: command?.missionId || '', status: 'error', error: err?.message || String(err) });
        });
        return true;
      }
      if (type === 'mission_scene_object_remove') {
        const sceneId = command?.sceneId || 'mission-scene';
        debugLog(`COMMAND mission_scene_object_remove scene=${sceneId} kinds=${Array.isArray(command?.kinds) ? command.kinds.join(',') : (command?.kind || '')}`);
        removeSceneObjectsBySelector(command).catch(err => {
          trackerWarn(`⚠️  Scene object remove failed: ${err?.message || err}`);
          sendAck({ type: 'mission_scene_object_remove_ack', commandId: command?.commandId || null, sceneId: command?.sceneId || 'mission-scene', missionId: command?.missionId || '', status: 'error', error: err?.message || String(err) });
        });
        return true;
      }
      if (type === 'mission_scene_object_spawn') {
        const sceneId = command?.sceneId || 'mission-scene';
        debugLog(`COMMAND mission_scene_object_spawn scene=${sceneId} items=${Array.isArray(command?.items) ? command.items.length : 0}`);
        spawnSceneObjectsAppend(command).catch(err => {
          trackerWarn(`⚠️  Scene object spawn failed: ${err?.message || err}`);
          sendAck({ type: 'mission_scene_object_spawn_ack', commandId: command?.commandId || null, sceneId: command?.sceneId || 'mission-scene', missionId: command?.missionId || '', status: 'error', error: err?.message || String(err) });
        });
        return true;
      }
      if (type === 'mission_scene_manual_pax') {
        const sceneId = command?.sceneId || 'mission-scene';
        debugLog(`COMMAND mission_scene_manual_pax scene=${sceneId} action=${command?.action || command?.mode || 'unload'} door=${command?.openDoor === false || command?.door === false ? 0 : 1} doorProfile=${command?.doorProfile || command?.aircraftDoorProfile || ''}`);
        enqueueSceneOperation(sceneId, () => animateMissionSceneManualPax(command)).catch(err => {
          trackerWarn(`⚠️  Scene manual pax failed: ${err?.message || err}`);
          sendAck({ type: 'mission_scene_manual_pax_ack', commandId: command?.commandId || null, sceneId: command?.sceneId || 'mission-scene', missionId: command?.missionId || '', status: 'error', action: command?.action || command?.mode || 'unload', error: err?.message || String(err) });
        });
        return true;
      }
      if (type === 'mission_scene_boarding') {
        const pathCount = Array.isArray(command?.path) ? command.path.length : (Array.isArray(command?.boardingPath) ? command.boardingPath.length : (Array.isArray(command?.waypoints) ? command.waypoints.length : 0));
        const sceneId = command?.sceneId || 'mission-scene';
        debugLog(`COMMAND mission_scene_boarding scene=${sceneId} profile=${command?.profile || command?.pathProfile || 'ga_right_cockpit_v1'} pathPoints=${pathCount} cargoPathIndex=${command?.cargoPathIndex ?? ''} door=${command?.openDoor === true || command?.door === true ? 1 : 0} doorProfile=${command?.doorProfile || command?.aircraftDoorProfile || ''} aircraftSlot=${command?.aircraftSlot || ''} aircraftName="${command?.aircraftName || ''}"`);
        enqueueSceneOperation(sceneId, () => animateMissionSceneBoarding(command)).catch(err => {
          trackerWarn(`⚠️  Scene boarding failed: ${err?.message || err}`);
          sendAck({ type: 'mission_scene_boarding_ack', commandId: command?.commandId || null, sceneId: command?.sceneId || 'mission-scene', missionId: command?.missionId || '', status: 'error', error: err?.message || String(err) });
        });
        return true;
      }
      if (type === 'mission_scene_deboarding') {
        const pathCount = Array.isArray(command?.path) ? command.path.length : (Array.isArray(command?.boardingPath) ? command.boardingPath.length : (Array.isArray(command?.waypoints) ? command.waypoints.length : 0));
        const sceneId = command?.sceneId || 'mission-scene';
        debugLog(`COMMAND mission_scene_deboarding scene=${sceneId} profile=${command?.profile || command?.pathProfile || 'ga_right_cockpit_v1'} pathPoints=${pathCount} boarderCount=${command?.boarderCount ?? ''} door=${command?.openDoor === true || command?.door === true ? 1 : 0} doorProfile=${command?.doorProfile || command?.aircraftDoorProfile || ''} aircraftSlot=${command?.aircraftSlot || ''} aircraftName="${command?.aircraftName || ''}"`);
        enqueueSceneOperation(sceneId, () => animateMissionSceneDeboarding(command)).catch(err => {
          trackerWarn(`⚠️  Scene deboarding failed: ${err?.message || err}`);
          sendAck({ type: 'mission_scene_deboarding_ack', commandId: command?.commandId || null, sceneId: command?.sceneId || 'mission-scene', missionId: command?.missionId || '', status: 'error', error: err?.message || String(err) });
        });
        return true;
      }
      if (type === 'mission_scene_clear') {
        const sceneId = command?.sceneId || 'mission-scene';
        debugLog(`COMMAND mission_scene_clear scene=${sceneId}`);
        enqueueSceneOperation(sceneId, () => clearScene(sceneId, command?.reason || 'command', command?.commandId || null)).catch(err => {
          sendAck({ type: 'mission_scene_clear_ack', commandId: command?.commandId || null, sceneId: command?.sceneId || 'mission-scene', missionId: command?.missionId || '', status: 'error', error: err?.message || String(err) });
        });
        return true;
      }
      if (type === 'mission_scene_clear_all') {
        const commandId = command?.commandId || null;
        const missionId = command?.missionId || '';
        const ids = [...scenes.keys()];
        debugLog(`COMMAND mission_scene_clear_all scenes=${ids.length}`);
        Promise.all(ids.map(id => enqueueSceneOperation(id, () => clearScene(id, command?.reason || 'command-all', commandId))))
          .then(async (results) => {
            const sceneCleared = results.reduce((sum, item) => sum + Number(item?.cleared || 0), 0);
            const tracked = await clearTrackedObjects(command?.reason || 'command-all');
            const cleared = sceneCleared + Number(tracked?.cleared || 0);
            const status = cleared > 0 || ids.length > 0 ? 'ok' : 'noop';
            sendAck({ type: 'mission_scene_clear_ack', commandId, sceneId: 'all', missionId, status, cleared, reason: command?.reason || 'command-all' });
          })
          .catch(err => {
            sendAck({ type: 'mission_scene_clear_ack', commandId, sceneId: 'all', missionId, status: 'error', error: err?.message || String(err) });
          });
        return true;
      }
      if (type === 'aircraft_payload_get') {
        const commandId = command?.commandId || null;
        const maxStations = clampPayloadStationCount(command?.maxStations ?? command?.stationCount ?? 12, 12);
        debugLog(`COMMAND aircraft_payload_get maxStations=${maxStations}`);
        requestPayloadSnapshot(maxStations)
          .then((snapshot) => {
            sendAck({
              type: 'aircraft_payload_get_ack',
              commandId,
              status: 'ok',
              ...snapshot
            });
          })
          .catch((err) => {
            sendAck({
              type: 'aircraft_payload_get_ack',
              commandId,
              status: 'error',
              error: err?.message || String(err)
            });
          });
        return true;
      }
      if (type === 'aircraft_payload_set') {
        const commandId = command?.commandId || null;
        const stations = Array.isArray(command?.stations) ? command.stations : [];
        const maxStations = clampPayloadStationCount(command?.maxStations ?? 12, 12);
        debugLog(`COMMAND aircraft_payload_set stations=${stations.length} maxStations=${maxStations}`);
        applyPayloadStations(stations)
          .then((result) => requestPayloadSnapshot(maxStations).then(snapshot => ({ result, snapshot })))
          .then(({ result, snapshot }) => {
            sendAck({
              type: 'aircraft_payload_set_ack',
              commandId,
              status: 'ok',
              changedStations: result.changed,
              appliedStations: result.stations,
              ...snapshot
            });
          })
          .catch((err) => {
            sendAck({
              type: 'aircraft_payload_set_ack',
              commandId,
              status: 'error',
              error: err?.message || String(err)
            });
          });
        return true;
      }
      return false;
    },
    getTrackerMissionStatus() {
      return trackerMissionStatus?.missionId ? enrichMissionStatusWithScenes(trackerMissionStatus) : null;
    },
    clearAll(reason = 'shutdown') {
      return Promise.all([
        ...[...missions.keys()].map(id => clearMission(id, reason)),
        ...[...scenes.keys()].map(id => clearScene(id, reason)),
        clearTrackedObjects(reason)
      ]);
    }
  };
}

function startTracker(syncId, pin) {
  debugLog(`START ${TRACKER_DISPLAY_NAME} debugFile=${TRACKER_DEBUG_FILE}`);
  let _reconnecting = false;
  let _reconnectTimer = null;
  let _simStarted = false;
  let _wsAttempt = 0;
  let _currentWs = null;
  let _trackerCommandHandler = null;
  const _pendingTrackerCommands = [];
  const MAX_PENDING_TRACKER_COMMANDS = 64;

  const getWs = () => _currentWs;
  const setTrackerCommandHandler = (handler) => {
    _trackerCommandHandler = handler;
    if (typeof _trackerCommandHandler !== 'function' || !_pendingTrackerCommands.length) return;
    const queued = _pendingTrackerCommands.splice(0, _pendingTrackerCommands.length);
    debugLog(`COMMAND_QUEUE_FLUSH size=${queued.length}`);
    for (const command of queued) {
      try {
        _trackerCommandHandler(command);
      } catch (err) {
        debugLog(`COMMAND_QUEUE_FLUSH_ERROR type=${command?.type || 'unknown'} error=${err?.message || err}`);
      }
    }
  };
  const handleTrackerMessage = (raw) => {
    let data = null;
    try { data = JSON.parse(String(raw || '')); } catch (_) { return; }
    const command = data?.trackerCommand || (data?.target === 'tracker' ? data : null);
    if (!command || typeof command !== 'object') return;
    if (data.syncId && String(data.syncId) !== String(syncId)) return;
    if (data.pin && String(data.pin) !== String(pin)) return;
    if (command.pin && String(command.pin) !== String(pin)) return;
    if (typeof _trackerCommandHandler === 'function') {
      _trackerCommandHandler(command);
      return;
    }
    if (_pendingTrackerCommands.length >= MAX_PENDING_TRACKER_COMMANDS) {
      _pendingTrackerCommands.shift();
    }
    _pendingTrackerCommands.push(command);
    debugLog(`COMMAND_QUEUE_BUFFERED type=${command?.type || 'unknown'} size=${_pendingTrackerCommands.length}`);
  };
  const scheduleReconnect = (reason, delayMs = 5000) => {
    if (_reconnectTimer) return;
    _reconnecting = false;
    if (reason) trackerWarn(`⚠️  ${reason}`);
    _reconnectTimer = setTimeout(() => {
      _reconnectTimer = null;
      connect();
    }, delayMs);
  };

  function connect() {
    if (_reconnecting) return;
    _reconnecting = true;
    _wsAttempt += 1;
    trackerLog(`\nVerbinde mit WebSocket-Server: ${WS_URL}... (Versuch ${_wsAttempt})`);
    const ws = new WebSocket(WS_URL, { handshakeTimeout: 10000 });
    _currentWs = ws;
    let opened = false;
    let awaitingPong = false;
    let pingInterval = null;
    const connectWatchdog = setTimeout(() => {
      if (!opened) {
        trackerWarn("⚠️  WebSocket-Handshake Timeout. Erzwinge Neuverbindung...");
        try { ws.terminate(); } catch (_) {}
      }
    }, 12000);

    const clearWsTimers = () => {
      clearTimeout(connectWatchdog);
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
    };

    ws.on('open', () => {
      opened = true;
      _reconnecting = false;
      clearWsTimers();
      ws.send(JSON.stringify({ type: 'join', syncId: syncId, pin: pin }));
      trackerLog(`📡 Verbunden mit Pilot-ID: ${syncId} (Auth aktiv)`);
      pingInterval = setInterval(() => {
        try {
          if (ws.readyState !== WebSocket.OPEN) return;
          if (awaitingPong) {
            trackerWarn("⚠️  WebSocket-Ping Timeout. Erzwinge Neuverbindung...");
            try { ws.terminate(); } catch (_) {}
            return;
          }
          awaitingPong = true;
          ws.ping();
        } catch (_) {}
      }, 25000);
      if (!_simStarted) {
        _simStarted = true;
        connectSimConnect(getWs, syncId, pin, setTrackerCommandHandler);
      }
    });
    ws.on('pong', () => { awaitingPong = false; });
    ws.on('message', handleTrackerMessage);

    ws.on('error', (err) => {
      trackerError("❌ WebSocket-Fehler:", err.message);
      if (!opened) scheduleReconnect("WebSocket-Verbindung fehlgeschlagen. Neuer Versuch in 5 Sekunden...");
    });

    ws.on('close', () => {
      clearWsTimers();
      if (_currentWs === ws) _currentWs = null;
      scheduleReconnect("WebSocket getrennt. Neuverbindung in 5 Sekunden...");
    });
  }

  connect();
}

function connectSimConnect(getWs, syncId, pin, setTrackerCommandHandler = null) {
  open('VFR-Multitool-v206', 5)
    .then(({ handle }) => {
      trackerLog("✈️ MSFS gefunden! Warte auf Positionsdaten...");
      let lastGpsMsg = null;
      let latestGroundTrafficSnapshot = [];
      const missionSmokeController = createMissionSmokeController(handle, getWs, syncId, pin, () => lastGpsMsg, () => latestGroundTrafficSnapshot);
      if (typeof setTrackerCommandHandler === 'function') {
        setTrackerCommandHandler((command) => missionSmokeController.handleCommand(command));
      }

      let lastSent = 0;
      let lastFlightLog = 0;
      const SEND_INTERVAL_MS = 100;
      const GPS_SOURCE_INTERVAL_FRAMES = 3;
      const TRAFFIC_POLL_MS = 5000;
      const DEF_ID = 206;
      const REQ_ID = 206;
      const EVT_PAUSE_EX1 = 910;
      const EVT_PAUSE = 911;
      const EVT_SIM_START = 912;
      const EVT_SIM_STOP = 913;
      const EVT_POSITION_CHANGED = 914;
      const EVT_FLIGHT_LOADED = 915;
      const SYS_REQ_SIM = 920;
      const SYS_REQ_DIALOG = 921;

      const runtimeState = {
        pauseFlags: 0,
        simRunning: 1,
        dialogMode: 0,
        lastPositionChangedAt: 0,
        lastFlightLoadedAt: 0
      };
      const isInMenuOrMap = () => (runtimeState.simRunning === 0) || (runtimeState.dialogMode === 1);
      const requestRuntimeStates = () => {
        try { handle.requestSystemState(SYS_REQ_SIM, 'Sim'); } catch (_) {}
        try { handle.requestSystemState(SYS_REQ_DIALOG, 'DialogMode'); } catch (_) {}
      };

      const subscribeSystemEventSafe = (evtId, name) => {
        try {
          const hr = handle.subscribeToSystemEvent(evtId, name);
          if (typeof hr === 'number' && hr < 0) {
            trackerWarn(`ℹ️ SystemEvent nicht verfuegbar: ${name}`);
          }
        } catch (e) {
          trackerWarn(`ℹ️ SystemEvent Fehler (${name}): ${e?.message || e}`);
        }
      };
      subscribeSystemEventSafe(EVT_PAUSE_EX1, 'Pause_EX1');
      subscribeSystemEventSafe(EVT_PAUSE, 'Pause');
      subscribeSystemEventSafe(EVT_SIM_START, 'SimStart');
      subscribeSystemEventSafe(EVT_SIM_STOP, 'SimStop');
      subscribeSystemEventSafe(EVT_POSITION_CHANGED, 'PositionChanged');
      subscribeSystemEventSafe(EVT_FLIGHT_LOADED, 'FlightLoaded');
      requestRuntimeStates();
      const runtimePollInterval = setInterval(requestRuntimeStates, 3000);

      handle.on('eventEx1', (recvEventEx1) => {
        if (recvEventEx1.clientEventId === EVT_PAUSE_EX1) {
          const flags = Number(recvEventEx1?.data?.[0] || 0);
          runtimeState.pauseFlags = Number.isFinite(flags) ? flags : 0;
        }
      });

      handle.on('event', (recvEvent) => {
        switch (recvEvent.clientEventId) {
          case EVT_PAUSE:
            runtimeState.pauseFlags = Number(recvEvent.data) ? 1 : 0;
            break;
          case EVT_SIM_START:
            runtimeState.simRunning = 1;
            break;
          case EVT_SIM_STOP:
            runtimeState.simRunning = 0;
            break;
          case EVT_POSITION_CHANGED:
            runtimeState.lastPositionChangedAt = Date.now();
            break;
          default:
            break;
        }
      });

      handle.on('eventFilename', (recvEventFilename) => {
        if (recvEventFilename.clientEventId === EVT_FLIGHT_LOADED) {
          runtimeState.lastFlightLoadedAt = Date.now();
        }
      });

      handle.on('systemState', (recvState) => {
        if (recvState.requestID === SYS_REQ_SIM) {
          runtimeState.simRunning = Number(recvState.dataInteger) ? 1 : 0;
        } else if (recvState.requestID === SYS_REQ_DIALOG) {
          runtimeState.dialogMode = Number(recvState.dataInteger) ? 1 : 0;
        }
      });

      const simVarOrder = [];
      let shortReadWarned = false;
      const addRequiredVar = (name, units, key) => {
        const hr = handle.addToDataDefinition(DEF_ID, name, units, SimConnectDataType.FLOAT64);
        if (typeof hr === 'number' && hr < 0) throw new Error(`SimVar nicht verfuegbar: ${name}`);
        simVarOrder.push({ key, required: true });
      };
      const addOptionalVar = (name, units, key) => {
        const hr = handle.addToDataDefinition(DEF_ID, name, units, SimConnectDataType.FLOAT64);
        if (typeof hr === 'number' && hr < 0) {
          trackerWarn(`ℹ️ Optionaler SimVar nicht verfuegbar: ${name}`);
          return;
        }
        simVarOrder.push({ key, required: false, name });
      };

      addRequiredVar('PLANE LATITUDE', 'degrees', 'lat');
      addRequiredVar('PLANE LONGITUDE', 'degrees', 'lon');
      addRequiredVar('PLANE ALTITUDE', 'feet', 'alt');
      addRequiredVar('PLANE HEADING DEGREES TRUE', 'degrees', 'hdg');
      addRequiredVar('PLANE ALT ABOVE GROUND', 'feet', 'agl');
      addRequiredVar('PLANE BANK DEGREES', 'degrees', 'bank');
      addRequiredVar('G FORCE', 'GForce', 'gForce');
      addRequiredVar('VERTICAL SPEED', 'feet per minute', 'vsFpm');
      addRequiredVar('GENERAL ENG RPM:1', 'rpm', 'engRpm');
      addRequiredVar('SIM ON GROUND', 'Bool', 'onGround');
      addRequiredVar('PLANE TOUCHDOWN NORMAL VELOCITY', 'feet per second', 'touchdownFps');
      addRequiredVar('AMBIENT WIND VELOCITY', 'knots', 'windKts');
      addRequiredVar('AMBIENT WIND DIRECTION', 'degrees', 'windDeg');
      addRequiredVar('AMBIENT TEMPERATURE', 'celsius', 'tempC');
      addRequiredVar('AMBIENT VISIBILITY', 'meters', 'visMeters');
      addRequiredVar('INCIDENCE ALPHA', 'degrees', 'aoaDeg');
      addRequiredVar('STALL WARNING', 'Bool', 'stallState');
      // Wetter-Zusatzwerte (optional je nach SimConnect/Sim-Version)
      addOptionalVar('GROUND VELOCITY', 'knots', 'groundSpeedKts');
      addOptionalVar('AMBIENT WIND GUST', 'knots', 'windGustKts');
      addOptionalVar('AMBIENT PRECIP STATE', 'Enum', 'precipState');
      addOptionalVar('AMBIENT PRECIP RATE', 'millimeters of water', 'precipRateMmH');
      addOptionalVar('AMBIENT IN CLOUD', 'Bool', 'inCloud');
      addOptionalVar('AMBIENT TURBULENCE', 'percent', 'turbulencePct');
      addOptionalVar('IS PAUSED', 'Bool', 'simPausedA');
      addOptionalVar('SIM IS PAUSED', 'Bool', 'simPausedB');
      addOptionalVar('BRAKE PARKING POSITION', 'Bool', 'parkingBrake');
      addOptionalVar('TOTAL WEIGHT', 'pounds', 'totalWeightLbs');
      addOptionalVar('EMPTY WEIGHT', 'pounds', 'emptyWeightLbs');
      addOptionalVar('FUEL TOTAL QUANTITY WEIGHT', 'pounds', 'fuelWeightLbs');
      addOptionalVar('PAYLOAD STATION COUNT', 'number', 'payloadStationCount');

      handle.requestDataOnSimObject(
        REQ_ID,
        DEF_ID,
        0,
        SimConnectPeriod.VISUAL_FRAME,
        0,
        0,
        GPS_SOURCE_INTERVAL_FRAMES,
        0
      );

      handle.on('simObjectData', (recv) => {
        if (recv.requestID === REQ_ID) {
          const now = Date.now();
          if (now - lastSent >= SEND_INTERVAL_MS) {
            lastSent = now;
            
            try {
              const readFn = typeof recv.data.readFloat64 === 'function'
                ? () => recv.data.readFloat64()
                : (typeof recv.data.readDouble === 'function' ? () => recv.data.readDouble() : null);
              if (!readFn) return;

              const raw = {};
              for (const entry of simVarOrder) raw[entry.key] = null;
              let readCount = 0;
              for (const entry of simVarOrder) {
                try {
                  raw[entry.key] = readFn();
                  readCount += 1;
                } catch (readErr) {
                  if (!shortReadWarned) {
                    shortReadWarned = true;
                    trackerWarn(
                      `ℹ️ SimConnect liefert kuerzeres Paket als erwartet (${readCount}/${simVarOrder.length} Werte). ` +
                      `Optionale Wetterwerte werden fuer diese Session deaktiviert.`
                    );
                  }
                  // Sobald der Buffer zu Ende ist, restliche optionale Felder null lassen.
                  // Bei required-Feldern brechen wir den Tick sauber ab.
                  if (entry.required) throw readErr;
                  break;
                }
              }

              const lat = raw.lat;
              const lon = raw.lon;
              const alt = raw.alt;
              const hdg = raw.hdg;
              const agl = raw.agl;
              const bank = raw.bank;
              const gForce = raw.gForce;
              const vsFpm = raw.vsFpm;
              const engRpm = raw.engRpm;
              const onGround = raw.onGround;
              const touchdownFps = raw.touchdownFps;
              const windKts = raw.windKts;
              const windDeg = raw.windDeg;
              const tempC = raw.tempC;
              const visMeters = raw.visMeters;
              const aoaDeg = raw.aoaDeg;
              const stallState = raw.stallState;
              const groundSpeedKts = raw.groundSpeedKts;
              const windGustKts = raw.windGustKts;
              const precipState = raw.precipState;
              const precipRateMmH = raw.precipRateMmH;
              const inCloud = raw.inCloud;
              const turbulencePct = raw.turbulencePct;
              const simPausedA = raw.simPausedA;
              const simPausedB = raw.simPausedB;
              const parkingBrake = raw.parkingBrake;
              const totalWeightLbs = raw.totalWeightLbs;
              const emptyWeightLbs = raw.emptyWeightLbs;
              const fuelWeightLbs = raw.fuelWeightLbs;
              const payloadStationCount = raw.payloadStationCount;
              const payloadWeightLbs = (Number.isFinite(totalWeightLbs) && Number.isFinite(emptyWeightLbs))
                ? (totalWeightLbs - emptyWeightLbs)
                : null;
              const simPausedFromVar = Number.isFinite(simPausedA)
                ? (simPausedA > 0.5)
                : (Number.isFinite(simPausedB) ? (simPausedB > 0.5) : false);
              const simPausedFromEvent = (runtimeState.pauseFlags || 0) !== 0;

              const ws = getWs();
              if (ws && ws.readyState === WebSocket.OPEN && (lat !== 0 || lon !== 0)) {
                ownLat = lat; ownLon = lon; // für Traffic-Eigenfilter
                // GPS-Paket senden; Traffic wird alle 2s als Feld eingebettet (Relay-kompatibler Weg)
                const flight = {
                  mslFt: Math.round(alt || 0),
                  aglFt: Math.round(agl || 0),
                  bankDeg: Number.isFinite(bank) ? Math.round(bank * 10) / 10 : 0,
                  gForce: Number.isFinite(gForce) ? Math.round(gForce * 100) / 100 : 1,
                  vsFpm: Math.round(vsFpm || 0),
                  gsKts: Number.isFinite(groundSpeedKts) ? Math.round(groundSpeedKts * 10) / 10 : null,
                  gs: Number.isFinite(groundSpeedKts) ? Math.round(groundSpeedKts * 10) / 10 : null,
                  engRpm: Math.round(engRpm || 0),
                  onGround: !!onGround,
                  touchdownFps: Number.isFinite(touchdownFps) ? Math.round(touchdownFps * 100) / 100 : null,
                  touchdownFpm: Number.isFinite(touchdownFps) ? Math.round(touchdownFps * 60) : null,
                  windKts:  Number.isFinite(windKts)  ? Math.round(windKts  * 10) / 10 : null,
                  windDeg:  Number.isFinite(windDeg)  ? Math.round(windDeg)          : null,
                  windGustKts: Number.isFinite(windGustKts) ? Math.round(windGustKts * 10) / 10 : null,
                  tempC:    Number.isFinite(tempC)    ? Math.round(tempC * 10) / 10   : null,
                  visKm:    Number.isFinite(visMeters) ? Math.round(visMeters / 100) / 10 : null,
                  precipState: Number.isFinite(precipState) ? Math.round(precipState) : null,
                  precipRateMmH: Number.isFinite(precipRateMmH) ? Math.round(precipRateMmH * 10) / 10 : null,
                  precipActive: Number.isFinite(precipRateMmH)
                    ? precipRateMmH > 0.05
                    : (Number.isFinite(precipState) ? precipState > 0 : null),
                  inCloud: Number.isFinite(inCloud) ? (inCloud > 0.5) : null,
                  turbulencePct: Number.isFinite(turbulencePct) ? Math.round(turbulencePct) : null,
                  simPaused: simPausedFromEvent || simPausedFromVar,
                  pauseFlags: runtimeState.pauseFlags || 0,
                  simRunning: runtimeState.simRunning,
                  dialogMode: runtimeState.dialogMode,
                  inMenuOrMap: isInMenuOrMap(),
                  parkingBrake: Number.isFinite(parkingBrake) ? parkingBrake > 0.5 : null,
                  totalWeightLbs: Number.isFinite(totalWeightLbs) ? Math.round(totalWeightLbs * 10) / 10 : null,
                  emptyWeightLbs: Number.isFinite(emptyWeightLbs) ? Math.round(emptyWeightLbs * 10) / 10 : null,
                  fuelWeightLbs: Number.isFinite(fuelWeightLbs) ? Math.round(fuelWeightLbs * 10) / 10 : null,
                  payloadWeightLbs: Number.isFinite(payloadWeightLbs) ? Math.round(payloadWeightLbs * 10) / 10 : null,
                  payloadStationCount: Number.isFinite(payloadStationCount) ? Math.max(0, Math.round(payloadStationCount)) : null,
                  aoaDeg:   Number.isFinite(aoaDeg) ? Math.round(aoaDeg * 10) / 10 : null,
                  stallState: Number.isFinite(stallState) ? (stallState > 0.5) : false
                };
                const gpsMsg = {
                  type: 'gps',
                  syncId: syncId,
                  pin: pin,
                  trackerVersion: TRACKER_VERSION,
                  trackerVersionCode: TRACKER_VERSION_CODE,
                  lat: lat,
                  lon: lon,
                  alt: Math.round(alt),
                  hdg: Math.round(hdg),
                  flight
                };
                const trackerMissionStatus = missionSmokeController.getTrackerMissionStatus();
                if (trackerMissionStatus?.missionId) {
                  gpsMsg.trackerMissionStatus = trackerMissionStatus;
                }
                if (latestTrafficSnapshot && latestTrafficSnapshot.length > 0) {
                  gpsMsg.traffic = latestTrafficSnapshot;
                  latestTrafficSnapshot = null; // einmalig senden, dann löschen
                }
                lastGpsMsg = { lat: gpsMsg.lat, lon: gpsMsg.lon, alt: gpsMsg.alt, hdg: gpsMsg.hdg };
                ws.send(JSON.stringify(gpsMsg));
                if (now - lastFlightLog >= 1000) {
                  lastFlightLog = now;
                  trackerStatus(`GPS Lat ${lat.toFixed(4)} | Lon ${lon.toFixed(4)} | Alt ${Math.round(alt)}ft | Hdg ${Math.round(hdg)}° | AGL ${Math.round(agl || 0)}ft | GS ${flight.gsKts ?? '?'}kts | OnG ${flight.onGround ? 'Y' : 'N'} | Park ${flight.parkingBrake == null ? '?' : (flight.parkingBrake ? 'Y' : 'N')} | Pause ${flight.simPaused ? 'Y' : 'N'}(${flight.pauseFlags ?? 0}) | Sim ${flight.simRunning ? 'RUN' : 'STOP'} | Menu ${flight.inMenuOrMap ? 'Y' : 'N'} | G ${flight.gForce.toFixed(2)} | Bank ${flight.bankDeg.toFixed(1)}° | Wind ${flight.windKts ?? '?'}kts/${flight.windDeg ?? '?'}° | Gust ${flight.windGustKts ?? '?'}kts | Temp ${flight.tempC ?? '?'}°C | Vis ${flight.visKm ?? '?'}km | Pcp ${flight.precipRateMmH ?? '?'}mm/h | Cloud ${flight.inCloud == null ? '?' : (flight.inCloud ? 'Y' : 'N')} | Turb ${flight.turbulencePct ?? '?'}%`);
                }
              } else if (lat === 0) {
                if (consoleMode === 'full') process.stdout.write(".");
                else trackerStatus("GPS wartet auf plausible Sim-Position ...");
              }
            } catch (e) { trackerError("❌ Lesefehler:", e.message); }
          }
        }
      });
      // --- TRAFFIC: AI-Verkehr aus MSFS ---
      const TRAFFIC_DEF_ID = 208;
      const TRAFFIC_REQ_ID = 208;

      handle.addToDataDefinition(TRAFFIC_DEF_ID, 'PLANE LATITUDE', 'degrees', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(TRAFFIC_DEF_ID, 'PLANE LONGITUDE', 'degrees', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(TRAFFIC_DEF_ID, 'PLANE ALTITUDE', 'feet', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(TRAFFIC_DEF_ID, 'PLANE HEADING DEGREES TRUE', 'degrees', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(TRAFFIC_DEF_ID, 'GROUND VELOCITY', 'knots', SimConnectDataType.FLOAT64);

      let trafficBuffer = {};
      let latestTrafficSnapshot = null; // wird beim nächsten GPS-Tick eingebettet
      let ownLat = 0, ownLon = 0; // wird aus GPS-Tick aktualisiert

      handle.on('simObjectDataByType', (recv) => {
        if (recv.requestID !== TRAFFIC_REQ_ID) return;
        try {
          const d = recv.data;
          let tLat, tLon, tAlt, tHdg, tGs;
          if (typeof d.readFloat64 === 'function') {
            tLat = d.readFloat64(); tLon = d.readFloat64(); tAlt = d.readFloat64(); tHdg = d.readFloat64(); tGs = d.readFloat64();
          } else if (typeof d.readDouble === 'function') {
            tLat = d.readDouble(); tLon = d.readDouble(); tAlt = d.readDouble(); tHdg = d.readDouble(); tGs = d.readDouble();
          } else return;
          if (tLat === 0 && tLon === 0) return; // Skip invalid positions
          // Stabiler Key aus gerundeter Position (SimConnect vergibt bei jedem Request neue Object-IDs)
          // 0.001° ≈ 100 m – auch Formation-Flieger mit >100m Abstand erhalten eigene Zellen
          const stableKey = `${Math.round(tLat * 1000)}_${Math.round(tLon * 1000)}`;
          trafficBuffer[stableKey] = {
            id: stableKey,
            lat: parseFloat(tLat.toFixed(5)),
            lon: parseFloat(tLon.toFixed(5)),
            alt: Math.round(tAlt),
            hdg: Math.round(tHdg),
            gs: Math.round(tGs)
          };
        } catch(e) { /* Lesefehler ignorieren */ }
      });

      // Traffic bewusst moderat abfragen; andere SimConnect-Clients (z.B. Motion-Rigs)
      // reagieren empfindlich auf unnötig dichte Object-Enumeration.
      const trafficInterval = setInterval(() => {
        const ws = getWs();
        if (!ws || ws.readyState !== 1 /*OPEN*/) return;
        trafficBuffer = {};
        // SIMCONNECT_SIMOBJECT_TYPE_AIRCRAFT = 1, Radius 50 NM = 92600m
        handle.requestDataOnSimObjectType(TRAFFIC_REQ_ID, TRAFFIC_DEF_ID, 92600, 1);

        // 500ms warten damit alle simObjectDataByType-Events ankommen, dann filtern & als Snapshot merken
        setTimeout(() => {
          const all = Object.values(trafficBuffer);
          const notOwnship = (ac) => {
            const dLat = Math.abs(ac.lat - ownLat), dLon = Math.abs(ac.lon - ownLon);
            if (dLat < 0.0015 && dLon < 0.0015) return false; // eigene Position ~0.1 NM
            return true;
          };
          latestGroundTrafficSnapshot = all.filter(ac => ac.gs < 10 && notOwnship(ac)).slice(0, 80);
          // Filter: nur fliegende Flieger (GS > 10 kts), eigenes Objekt per Position ausschließen
          const moving = all.filter(ac => ac.gs >= 10 && notOwnship(ac));
          // Die 20 nächsten nach einfachem Winkelabstand sortieren
          const nearest = moving
            .map(ac => {
              const dLat = ac.lat - ownLat, dLon = ac.lon - ownLon;
              return { ...ac, _d: dLat * dLat + dLon * dLon };
            })
            .sort((a, b) => a._d - b._d)
            .slice(0, 20)
            .map(({ _d, ...ac }) => ac);

          latestTrafficSnapshot = nearest;
          if (nearest.length > 0)
            trackerLog(`[TRAFFIC] ${all.length} gesamt → ${moving.length} fliegend → ${nearest.length} gesendet`);
        }, 500);
      }, TRAFFIC_POLL_MS);

      handle.on('close', () => {
        if (typeof setTrackerCommandHandler === 'function') setTrackerCommandHandler(null);
        clearInterval(runtimePollInterval);
        clearInterval(trafficInterval);
        // Nur reconnecten wenn WS noch offen ist, sonst wartet WS-Reconnect auf SimConnect-Neustart
        const ws = getWs();
        if (ws && ws.readyState === WebSocket.OPEN) {
          trackerWarn("⚠️  MSFS getrennt. Neuer SimConnect-Versuch in 5 Sekunden...");
          setTimeout(() => connectSimConnect(getWs, syncId, pin, setTrackerCommandHandler), 5000);
        }
      });
    })
    .catch(err => {
      const ws = getWs();
      if (ws && ws.readyState === WebSocket.OPEN) {
        trackerWarn("⚠️  MSFS nicht gefunden / SimConnect-Fehler. Neuer Versuch in 5 Sekunden...");
        setTimeout(() => connectSimConnect(getWs, syncId, pin, setTrackerCommandHandler), 5000);
      }
    });
}

function readTrackerConfig() {
  const candidates = uniqueStrings([CONFIG_FILE, LEGACY_CONFIG_FILE]);
  for (const file of candidates) {
    if (!file || !fs.existsSync(file)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (file !== CONFIG_FILE) debugLog(`CONFIG_LEGACY_READ file=${file}`);
      return data && typeof data === 'object' ? data : {};
    } catch (err) {
      debugLog(`CONFIG_READ_ERROR file=${file} error=${err?.message || err}`);
    }
  }
  return {};
}

function writeTrackerConfig(data = {}) {
  try {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...(data || {}) }, null, 2), 'utf8');
    return true;
  } catch (err) {
    trackerWarn(`⚠️  Konnte ${CONFIG_BASENAME} nicht neben der Tracker-EXE speichern: ${err?.message || err}`);
    debugLog(`CONFIG_WRITE_ERROR file=${CONFIG_FILE} error=${err?.message || err}`);
    return false;
  }
}

function askCredentials() {
  rl.question("Bitte gib deine Pilot-ID ein (z.B. Foxtrot-Mike-764): ", (idAnswer) => {
    const finalId = idAnswer.trim();
    if (!finalId) { trackerLog("Fehler: Keine Pilot-ID eingegeben."); return process.exit(1); }
    
    rl.question("Bitte gib deinen 4-stelligen PIN ein: ", (pinAnswer) => {
      const finalPin = pinAnswer.trim();
      writeTrackerConfig({ syncId: finalId, pin: finalPin, consoleMode });
      startTracker(finalId, finalPin);
    });
  });
}

function saveTrackerConfig(syncId, pin, extra = {}) {
  writeTrackerConfig({ syncId, pin, consoleMode, ...extra });
}

function askConsoleMode(savedId, savedPin, afterSave) {
  trackerLog("\n--- Anzeige-Modus ---");
  trackerLog("1 = Statuszeile + Eventlog (empfohlen)");
  trackerLog("2 = Voller Verlauf wie bisher");
  trackerLog("3 = Leise, nur Events ohne GPS");
  rl.question("Auswahl [1]: ", (answer) => {
    const a = String(answer || '').trim().toLowerCase();
    if (a === '2' || a === 'full') consoleMode = 'full';
    else if (a === '3' || a === 'quiet') consoleMode = 'quiet';
    else consoleMode = 'status';
    if (savedId && savedPin) saveTrackerConfig(savedId, savedPin);
    trackerLog(`Anzeige-Modus: ${consoleMode}`);
    if (typeof afterSave === 'function') afterSave();
  });
}

function main() {
  trackerLog("=====================================");
  trackerLog(` ${TRACKER_DISPLAY_NAME}`);
  trackerLog("=====================================");

  let savedId = '';
  let savedPin = '';

  const data = readTrackerConfig();
  savedId = data.syncId || '';
  savedPin = data.pin || '';
  consoleMode = normalizeConsoleMode(data.consoleMode || data.displayMode || data.logMode);

  if (savedId && savedPin) {
    trackerLog("=====================================");
    trackerLog(` Gespeicherte Pilot-Daten gefunden:`);
    trackerLog(` Pilot-ID: [ ${savedId} ]`);
    trackerLog(` PIN: [ **** ]`);
    trackerLog(` Anzeige: [ ${consoleMode} ]`);
    trackerLog("=====================================\n");
    
    let timeLeft = 5;
    let timerCompleted = false;

    // Startet den Countdown
    const countdownInterval = setInterval(() => {
      if (timeLeft > 0) {
        // \r überschreibt die aktuelle Zeile im Terminal, so entsteht die Animation
        process.stdout.write(`\r🚀 Autostart in ${timeLeft} Sekunden... (ENTER: Pilot-ID/PIN, M+ENTER: Anzeige)   `);
        timeLeft--;
      } else {
        clearInterval(countdownInterval);
        if (!timerCompleted) {
          timerCompleted = true;
          trackerLog(`\n\n✅ Starte automatisch mit Pilot-ID: ${savedId}`);
          startTracker(savedId, savedPin);
        }
      }
    }, 1000);
    process.stdout.write(`\r🚀 Autostart in 5 Sekunden... (ENTER: Pilot-ID/PIN, M+ENTER: Anzeige)   `);

    // Lauscht auf die ENTER Taste
    rl.once('line', (line) => {
      if (!timerCompleted) {
        timerCompleted = true;
        clearInterval(countdownInterval);
        const input = String(line || '').trim().toLowerCase();
        if (input === 'm' || input === 'menu' || input === 'modus' || input === 'display') {
          askConsoleMode(savedId, savedPin, () => startTracker(savedId, savedPin));
        } else {
          trackerLog(`\n\n--- Neueingabe gestartet ---`);
          askCredentials();
        }
      }
    });

  } else {
    askCredentials();
  }
}

// Globale Fehlerbehandlung: Prozess darf nie durch unbehandelte Fehler sterben
process.on('uncaughtException', (err) => {
  trackerError("💥 Unbehandelter Fehler (Prozess läuft weiter):", err.message);
});
process.on('unhandledRejection', (reason) => {
  trackerError("💥 Unbehandelte Promise-Ablehnung (Prozess läuft weiter):", reason);
});

main();
