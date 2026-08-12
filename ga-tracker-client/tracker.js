const { open, SimConnectDataType, SimConnectPeriod, InitPosition, RawBuffer, Waypoint, SimConnectConstants, EventFlag } = require('node-simconnect');
const WebSocket = require('ws');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { prepareTrackerStorage } = require('./tracker-storage.js');
const { createHomebaseObjectManager } = require('./homebase-object-manager.js');
const { createHomebasePackageService } = require('./homebase-package-service.js');
const homebaseAssetCatalog = require('./homebase-asset-catalog.js');
const {
  normalizeHomebaseFallbackCache,
  compatibleHomebaseFallbackCache,
  fallbackShouldBeActive
} = require('./homebase-fallback-cache.js');
const { verifyTrackerCredentials } = require('./tracker-auth.js');
const { createTrackerRelayHello } = require('./tracker-efb-relay-core.js');
const {
  DEFAULT_EFB_HTTP_PORT,
  createTrackerEfbHttpHello,
  createTrackerEfbHttpServer
} = require('./tracker-efb-http-server.js');
const { createMissionAuthorityManager } = require('./mission-authority-core.js');
const { projectTrackerMapSnapshot } = require('./tracker-efb-map-snapshot-core.js');
const { createRotatingDebugLog } = require('./tracker-debug-log.js');

/**
 * GA TRACKER CLIENT - MSFS 2024 Edition
 * Inklusive Auto-Save Config, PIN-Auth & 5-Sekunden Boot-Timer
 */

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const WS_URL = 'wss://websocketrelais.onrender.com/';
const RUNTIME_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;
const TRACKER_STORAGE = prepareTrackerStorage({ legacyDirectory: RUNTIME_DIR });
const TRACKER_DATA_DIR = TRACKER_STORAGE.dataDirectory;
const HOMEBASE_ENABLED = true;
const CONFIG_BASENAME = 'tracker-config.json';
const CONFIG_FILE = path.join(TRACKER_DATA_DIR, CONFIG_BASENAME);
const LEGACY_CONFIG_FILE = path.resolve(process.cwd(), CONFIG_BASENAME);
const TRACKER_VERSION = 'v338';
const TRACKER_VERSION_CODE = 338;
const TRACKER_DISPLAY_NAME = `GA Tracker ${TRACKER_VERSION} (build ${TRACKER_VERSION_CODE})`;
const TRACKER_RUNTIME_CHANNEL = process.env.VFR_MULTITOOL_TRACKER_CHANNEL === 'alpha' ? 'alpha' : 'stable';
const TRACKER_PROTOCOL_HELLO = createTrackerRelayHello({
  trackerVersion: TRACKER_VERSION,
  trackerVersionCode: TRACKER_VERSION_CODE,
  runtimeChannel: TRACKER_RUNTIME_CHANNEL,
  clientId: 'ga-tracker',
  id: `tracker-hello-${TRACKER_VERSION}-${process.pid}`,
  timestamp: Date.now()
});
const TRACKER_EFB_HTTP_HELLO = createTrackerEfbHttpHello({
  trackerVersion: TRACKER_VERSION,
  trackerVersionCode: TRACKER_VERSION_CODE,
  runtimeChannel: TRACKER_RUNTIME_CHANNEL,
  clientId: 'ga-tracker-local',
  id: `tracker-efb-http-hello-${TRACKER_VERSION}-${process.pid}`,
  timestamp: Date.now()
});
const PA24_DEFAULT_FUEL_WEIGHT_PER_GALLON_LBS = 6;
const PA24_FUEL_TANK_LVARS = [
  { key: 'FuelLeftWingTank', name: 'L:FuelLeftWingTank' },
  { key: 'FuelRightWingTank', name: 'L:FuelRightWingTank' },
  { key: 'FuelLeftTipTank', name: 'L:FuelLeftTipTank' },
  { key: 'FuelRightTipTank', name: 'L:FuelRightTipTank' }
];

function resolveFuelWeightData(standardFuelWeightLbs, fuelWeightPerGallonLbs, pa24Raw = {}, isPa24 = false) {
  if (!isPa24) {
    const weight = Number(standardFuelWeightLbs);
    return {
      fuelWeightLbs: Number.isFinite(weight) && weight >= 0 ? Math.round(weight * 10) / 10 : null,
      fuelTotalGallons: null,
      fuelWeightPerGallonLbs: null,
      fuelSource: 'simconnect'
    };
  }
  const gallons = PA24_FUEL_TANK_LVARS.reduce(
    (sum, tank) => sum + Math.max(0, Number(pa24Raw?.[tank.key]) || 0),
    0
  );
  const reportedDensity = Number(fuelWeightPerGallonLbs);
  const density = Number.isFinite(reportedDensity) && reportedDensity > 0
    ? reportedDensity
    : PA24_DEFAULT_FUEL_WEIGHT_PER_GALLON_LBS;
  return {
    fuelWeightLbs: Math.round(gallons * density * 10) / 10,
    fuelTotalGallons: Math.round(gallons * 10) / 10,
    fuelWeightPerGallonLbs: Math.round(density * 100) / 100,
    fuelSource: 'pa24_accusim'
  };
}

const HEADLESS_MODE = process.env.VFR_MULTITOOL_TRACKER_HEADLESS === '1';
let credentialsProvidedByDesktop = false;
const MISSION_SMOKE_DEFAULT_TITLE = 'Chimney_Smoke_V1';
const MISSION_FIRE_DEFAULT_TITLE = 'VO_Fire_R1_40';
const MISSION_SCENE_VEHICLE_TITLE = 'Car Bush Firefighting';
const MISSION_SCENE_PERSON_TITLE = 'Tarmac_Female_Summer_Asian';
const TRACKER_DEBUG_FILE = path.join(TRACKER_DATA_DIR, 'ga-tracker-debug.txt');
const debugLog = createRotatingDebugLog({
  filename: TRACKER_DEBUG_FILE,
  maxBytes: 8 * 1024 * 1024,
  retainedTailBytes: 512 * 1024,
  maxLineBytes: 32 * 1024,
  dedupeWindowMs: 1500
});
const MISSION_AUTHORITY_FILE = path.join(TRACKER_DATA_DIR, 'mission-authority-v1.json');
const TELEPORT_DEF_ID = 9361;
const WAYPOINT_DEF_ID = 9362;
const DOOR_OPEN_EVENT_ID = 9363;
const DOOR_CLOSE_EVENT_ID = 9364;
const DOOR_TOGGLE_EVENT_ID = 9365;
const DOOR_OPEN_SINGLE_EVENT_ID = 9369;
const DOOR_CLOSE_SINGLE_EVENT_ID = 9370;
const PARKING_BRAKE_DEF_ID = 9371;
const INPUT_EVENT_ENUM_REQUEST_ID = 9372;
const SCENE_GROUND_FREEZE_ALTITUDE_EVENT_ID = 9380;
const SCENE_GROUND_EVENT_GROUP_PRIORITY_HIGHEST = 1;
const SCENE_GROUND_EVENT_FLAG_GROUP_ID_IS_PRIORITY = 16;
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

function createMissionSmokeController(handle, getWs, syncId, pin, getLastGpsMsg = null, getGroundTrafficSnapshot = null, missionAuthority = null) {
  const missions = new Map();
  const scenes = new Map();
  let lastAuthorityMapProjectionSignature = '';
  let sceneOperationQueue = Promise.resolve();
  const sceneObjectOperationStates = new Map();
  const sceneObjectDesiredStates = new Map();
  let authorityReleasePending = false;
  const CREATE_EXCEPTION_GRACE_MS = 900;
  const LATE_ASSIGNED_RETENTION_MS = 30000;
  const pendingAssign = new Map();
  const lateAssignedRequests = new Map();
  const lateAssignedSceneObjects = new Map();
  const pendingPayloadReads = new Map();
  const pendingSceneGroundReads = new Map();
  const payloadReadDefCache = new Map();
  const payloadSetDefCache = new Map();
  const namedVarSetDefCache = new Map();
  const namedVarSetUnsupported = new Set();
  const trackedObjectIds = new Set();
  const activeBoardingScenes = new Set();
  const activeDeboardingScenes = new Set();
  const activeGroundVisitScenes = new Set();
  const activeManualPaxScenes = new Set();
  const pendingDeboardingContinuations = new Map();
  const pendingGroundVisitReleases = new Map();
  const lastExceptions = [];
  let nextReqId = 9300;
  let nextDefId = 9700;
  let teleportDefReady = false;
  let waypointDefReady = false;
  let parkingBrakeDefReady = false;
  let sceneGroundPositionDefId = null;
  let sceneGroundAltitudeDefId = null;
  let sceneGroundDefinitionsReady = false;
  let doorEventsReady = false;
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

  const deboardingContinuationKey = (commandId, sceneId = '') => String(commandId || sceneId || '').trim();

  const waitForDeboardingContinuation = (commandId, sceneId, timeoutMs = 150000) => {
    const key = deboardingContinuationKey(commandId, sceneId);
    if (!key) return Promise.resolve({ action: 'cancel', reason: 'missing_command_id' });
    return new Promise((resolve) => {
      const previous = pendingDeboardingContinuations.get(key);
      if (previous?.timer) clearTimeout(previous.timer);
      if (previous?.resolve) previous.resolve({ action: 'cancel', reason: 'replaced' });
      const timer = setTimeout(() => {
        pendingDeboardingContinuations.delete(key);
        resolve({ action: 'cancel', reason: 'farewell_timeout' });
      }, Math.max(10000, Number(timeoutMs) || 150000));
      pendingDeboardingContinuations.set(key, { key, sceneId: String(sceneId || ''), resolve, timer });
    });
  };

  const resolveDeboardingContinuation = (command, action = 'continue') => {
    const targetCommandId = String(command?.deboardingCommandId || command?.targetCommandId || '').trim();
    const sceneId = String(command?.sceneId || '').trim();
    const directKey = deboardingContinuationKey(targetCommandId, sceneId);
    let entry = pendingDeboardingContinuations.get(directKey) || null;
    if (!entry && !targetCommandId && sceneId) {
      entry = [...pendingDeboardingContinuations.values()].find(candidate => candidate.sceneId === sceneId) || null;
    }
    const ackType = action === 'cancel' ? 'mission_scene_deboarding_cancel_ack' : 'mission_scene_deboarding_continue_ack';
    if (!entry) {
      sendAck({ type: ackType, commandId: command?.commandId || null, sceneId, deboardingCommandId: targetCommandId, status: 'noop', error: 'no_pending_deboarding' });
      return false;
    }
    if (entry.timer) clearTimeout(entry.timer);
    pendingDeboardingContinuations.delete(entry.key);
    entry.resolve({ action, reason: command?.reason || action });
    sendAck({ type: ackType, commandId: command?.commandId || null, sceneId: entry.sceneId || sceneId, deboardingCommandId: targetCommandId || entry.key, status: 'ok' });
    return true;
  };

  const cancelDeboardingContinuationsForScene = (sceneId, reason = 'scene-clear') => {
    const keySceneId = String(sceneId || '');
    for (const entry of [...pendingDeboardingContinuations.values()]) {
      if (entry.sceneId !== keySceneId) continue;
      if (entry.timer) clearTimeout(entry.timer);
      pendingDeboardingContinuations.delete(entry.key);
      entry.resolve({ action: 'cancel', reason });
    }
  };

  const cancelAllDeboardingContinuations = (reason = 'scene-clear-all') => {
    for (const entry of [...pendingDeboardingContinuations.values()]) {
      if (entry.timer) clearTimeout(entry.timer);
      pendingDeboardingContinuations.delete(entry.key);
      entry.resolve({ action: 'cancel', reason });
    }
  };

  const groundVisitReleaseKey = (commandId, sceneId = '') => String(commandId || sceneId || '').trim();

  const waitForGroundVisitRelease = (commandId, sceneId, timeoutMs = 1800000) => {
    const key = groundVisitReleaseKey(commandId, sceneId);
    if (!key) return Promise.resolve({ action: 'cancel', reason: 'missing_command_id' });
    return new Promise((resolve) => {
      const previous = pendingGroundVisitReleases.get(key);
      if (previous?.timer) clearTimeout(previous.timer);
      if (previous?.resolve) previous.resolve({ action: 'cancel', reason: 'replaced' });
      const timer = setTimeout(() => {
        pendingGroundVisitReleases.delete(key);
        resolve({ action: 'cancel', reason: 'inspection_release_timeout' });
      }, clampInt(timeoutMs, 30000, 30 * 60 * 1000));
      pendingGroundVisitReleases.set(key, { key, sceneId: String(sceneId || ''), resolve, timer });
    });
  };

  const resolveGroundVisitRelease = (command, action = 'release') => {
    const targetCommandId = String(command?.visitCommandId || command?.targetCommandId || '').trim();
    const sceneId = String(command?.sceneId || '').trim();
    const directKey = groundVisitReleaseKey(targetCommandId, sceneId);
    let entry = pendingGroundVisitReleases.get(directKey) || null;
    if (!entry && !targetCommandId && sceneId) {
      entry = [...pendingGroundVisitReleases.values()].find(candidate => candidate.sceneId === sceneId) || null;
    }
    if (!entry) {
      sendAck({
        type: 'mission_scene_ground_visit_release_ack',
        commandId: command?.commandId || null,
        sceneId,
        visitCommandId: targetCommandId,
        status: 'noop',
        error: 'no_pending_ground_visit'
      });
      return false;
    }
    if (entry.timer) clearTimeout(entry.timer);
    pendingGroundVisitReleases.delete(entry.key);
    entry.resolve({ action, reason: command?.reason || action });
    sendAck({
      type: 'mission_scene_ground_visit_release_ack',
      commandId: command?.commandId || null,
      sceneId: entry.sceneId || sceneId,
      visitCommandId: targetCommandId || entry.key,
      status: 'ok'
    });
    return true;
  };

  const cancelGroundVisitReleasesForScene = (sceneId, reason = 'scene-clear') => {
    const keySceneId = String(sceneId || '');
    for (const entry of [...pendingGroundVisitReleases.values()]) {
      if (entry.sceneId !== keySceneId) continue;
      if (entry.timer) clearTimeout(entry.timer);
      pendingGroundVisitReleases.delete(entry.key);
      entry.resolve({ action: 'cancel', reason });
    }
  };

  const cancelAllGroundVisitReleases = (reason = 'scene-clear-all') => {
    for (const entry of [...pendingGroundVisitReleases.values()]) {
      if (entry.timer) clearTimeout(entry.timer);
      pendingGroundVisitReleases.delete(entry.key);
      entry.resolve({ action: 'cancel', reason });
    }
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

  const ensureSceneGroundDefinitions = () => {
    if (sceneGroundDefinitionsReady) return true;
    try {
      sceneGroundPositionDefId = nextDefId++;
      sceneGroundAltitudeDefId = nextDefId++;
      handle.addToDataDefinition(sceneGroundPositionDefId, 'Initial Position', null, SimConnectDataType.INITPOSITION);
      handle.addToDataDefinition(sceneGroundAltitudeDefId, 'Plane Altitude', 'feet', SimConnectDataType.FLOAT64, 0, SimConnectConstants.UNUSED);
      handle.mapClientEventToSimEvent(SCENE_GROUND_FREEZE_ALTITUDE_EVENT_ID, 'FREEZE_ALTITUDE_SET');
      sceneGroundDefinitionsReady = true;
      debugLog(`SCENE_GROUND_DEFS_READY positionDef=${sceneGroundPositionDefId} altitudeDef=${sceneGroundAltitudeDefId}`);
      return true;
    } catch (err) {
      debugLog(`SCENE_GROUND_DEFS_ERROR ${err?.message || err}`);
      return false;
    }
  };

  const requestSceneObjectGroundAltitude = (objectId, timeoutMs = 6000) => new Promise((resolve, reject) => {
    if (!ensureSceneGroundDefinitions()) return reject(new Error('scene_ground_definitions_unavailable'));
    const requestId = nextReqId++;
    const timer = setTimeout(() => {
      pendingSceneGroundReads.delete(requestId);
      reject(new Error('scene_ground_altitude_timeout'));
    }, Math.max(1500, Number(timeoutMs) || 6000));
    const pending = { resolve, reject, timer, objectId, sendId: null };
    pendingSceneGroundReads.set(requestId, pending);
    try {
      pending.sendId = handle.requestDataOnSimObject(
        requestId,
        sceneGroundAltitudeDefId,
        objectId,
        SimConnectPeriod.ONCE,
        0,
        0,
        0,
        0
      );
    } catch (err) {
      clearTimeout(timer);
      pendingSceneGroundReads.delete(requestId);
      reject(err);
    }
  });

  const stabilizeSceneGroundObject = async (objectId, title, plan = {}) => {
    const meta = homebaseAssetCatalog.objectDefinitionForTitle(title) || {};
    if (meta.liveGroundStabilization !== true) return { applied: false };
    if (!objectId || !ensureSceneGroundDefinitions()) return { applied: false, error: 'definitions_unavailable' };
    const userOffsetFt = toFiniteNumber(plan?.altOffsetFt, 0) || 0;
    const modelClearanceFt = toFiniteNumber(meta.groundClearanceFt, 0) || 0;
    try {
      // AssignedObjectID may arrive slightly before the object is fully writable.
      await sleep(180);
      handle.setDataOnSimObject(
        sceneGroundPositionDefId,
        objectId,
        [buildInitPos(plan.lat, plan.lon, plan.altFt, plan.hdg, true)]
      );
      await sleep(350);
      const groundAltitudeFt = await requestSceneObjectGroundAltitude(objectId);
      const altitudeFt = groundAltitudeFt + userOffsetFt + modelClearanceFt;
      handle.transmitClientEvent(
        objectId,
        SCENE_GROUND_FREEZE_ALTITUDE_EVENT_ID,
        1,
        SCENE_GROUND_EVENT_GROUP_PRIORITY_HIGHEST,
        SCENE_GROUND_EVENT_FLAG_GROUP_ID_IS_PRIORITY
      );
      const finalPosition = buildInitPos(plan.lat, plan.lon, altitudeFt, plan.hdg, false);
      handle.setDataOnSimObject(sceneGroundPositionDefId, objectId, [finalPosition]);
      await sleep(250);
      handle.setDataOnSimObject(sceneGroundPositionDefId, objectId, [finalPosition]);
      Object.assign(plan, {
        altitudeFt,
        altFt: altitudeFt,
        groundAltitudeFt,
        modelGroundClearanceFt,
        groundStabilized: true
      });
      debugLog(`SCENE_GROUND_STABILIZED objectId=${objectId} title="${title}" groundAltFt=${groundAltitudeFt} userOffsetFt=${userOffsetFt} clearanceFt=${modelClearanceFt} finalAltFt=${altitudeFt}`);
      return { applied: true, altitudeFt, groundAltitudeFt, modelGroundClearanceFt };
    } catch (err) {
      debugLog(`SCENE_GROUND_STABILIZE_ERROR objectId=${objectId} title="${title}" error=${err?.message || err}`);
      return { applied: false, error: err?.message || String(err) };
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
      if (writeOpenPosition) {
        ok = setNamedVarFromCandidates(openVars, 0, ['Bool', 'bool', 'number', 'percent'], `${reason}-openvar-0`) || ok;
        await sleep(70);
        ok = setNamedVarFromCandidates(exitVars, 0, ['percent', 'number', 'Bool', 'bool'], `${reason}-exit-close`) || ok;
        await sleep(70);
      }
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

  const PA24_OPEN_HANDLE_DELAY_MS = 900;
  const PA24_CLOSE_LATCH_DELAY_MS = 3000;
  const PA24_LATCH_UNLOCK_VALUE = 0;
  const PA24_LATCH_LOCK_VALUE = 1;
  const PA24_HANDLE_OPEN_VALUE = 1;
  const PA24_HANDLE_CLOSE_VALUE = 0;

  const setPa24ExactLVar = (name, value, units, reason) => {
    return setNamedVarValue(name, value, units, reason);
  };

  const setPa24ComancheDoorByExactLVars = async (openDoor, doorIndex = 1, reason = 'boarding') => {
    const idx = clampInt(doorIndex, 1, 4);
    const latchName = `L:Door${idx}Latch`;
    const handleName = `L:Door${idx}Handle`;
    const action = openDoor ? 'OPEN' : 'CLOSE';
    debugLog(`PA24_DOOR_EXACT_${action}_START doorIndex=${idx} handleName=${handleName} latchName=${latchName} openHandleDelayMs=${PA24_OPEN_HANDLE_DELAY_MS} closeLatchDelayMs=${PA24_CLOSE_LATCH_DELAY_MS} handleOpen=${PA24_HANDLE_OPEN_VALUE} handleClose=${PA24_HANDLE_CLOSE_VALUE} latchUnlock=${PA24_LATCH_UNLOCK_VALUE} latchLock=${PA24_LATCH_LOCK_VALUE} reason=${reason}`);
    let ok = false;
    if (openDoor) {
      ok = setPa24ExactLVar(latchName, PA24_LATCH_UNLOCK_VALUE, 'number', `${reason}-latch-unlock`) || ok;
      await sleep(PA24_OPEN_HANDLE_DELAY_MS);
      ok = setPa24ExactLVar(handleName, PA24_HANDLE_OPEN_VALUE, 'Bool', `${reason}-handle-open`) || ok;
    } else {
      ok = setPa24ExactLVar(handleName, PA24_HANDLE_CLOSE_VALUE, 'Bool', `${reason}-handle-close`) || ok;
      await sleep(PA24_CLOSE_LATCH_DELAY_MS);
      ok = setPa24ExactLVar(latchName, PA24_LATCH_LOCK_VALUE, 'number', `${reason}-latch-lock`) || ok;
    }
    debugLog(`PA24_DOOR_EXACT_${action}_DONE doorIndex=${idx} status=${ok ? 'ok' : 'error'} reason=${reason}`);
    return ok;
  };

  const holdPa24ComancheDoorOpen = async (doorIndex = 1, reason = 'door-hold-open') => {
    const idx = clampInt(doorIndex, 1, 4);
    const handleName = `L:Door${idx}Handle`;
    debugLog(`PA24_DOOR_EXACT_HOLD_START doorIndex=${idx} handleName=${handleName} handleOpen=${PA24_HANDLE_OPEN_VALUE} reason=${reason}`);
    const ok = setPa24ExactLVar(handleName, PA24_HANDLE_OPEN_VALUE, 'Bool', `${reason}-handle-open`);
    debugLog(`PA24_DOOR_EXACT_HOLD_DONE doorIndex=${idx} status=${ok ? 'ok' : 'error'} reason=${reason}`);
    return ok;
  };

  const setPa24ComancheDoor = async (openDoor, doorIndex = 1, reason = 'boarding') => {
    const action = openDoor ? 'OPEN' : 'CLOSE';
    debugLog(`DOOR_PA24_${action}_START reason=${reason} doorIndex=${doorIndex}`);
    // PA24 door state is explicit via LVars. Do not send latch toggle/input
    // events here: they can flip an already-correct state back again.
    const lvarOk = await setPa24ComancheDoorByExactLVars(openDoor, doorIndex, reason);
    debugLog(`DOOR_PA24_${action}_DONE status=${lvarOk ? 'ok' : 'error'} inputLatchOk=0 eventOk=0 lvarOk=${lvarOk ? 1 : 0} reason=${reason}`);
    return lvarOk;
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
    const isComancheProfile = (profile === 'pa24_comanche' || profile === 'pa24' || profile === 'comanche');
    if (isComancheProfile) {
      const idx = clampInt(doorIndex, 1, 4);
      const pa24Ok = await setPa24ComancheDoor(openDoor, idx, `${reason}-idx-${idx}`);
      doorLastApplyOk = pa24Ok;
      if (pa24Ok) {
        doorLastAppliedState = !!openDoor;
        doorLastAppliedAt = Date.now();
      }
      debugLog(`DOOR_${openDoor ? 'OPEN' : 'CLOSE'}_DONE profile=${profile} index=${doorIndex} status=${pa24Ok ? 'ok' : 'error'} specificOk=${pa24Ok ? 1 : 0} genericOk=0 reason=${reason}`);
      return pa24Ok;
    }
    const tryIndices = [...new Set([
      clampInt(doorIndex, 0, 8),
      1,
      0,
      2
    ])];
    let anySpecificOk = false;
    let anyGenericOk = false;
    for (const idx of tryIndices) {
      const isA2aProfile = profile.includes('a2a');
      if (profile.includes('a2a')) {
        const lvarOk = await setA2aDoorByLVars(openDoor, idx, `${reason}-idx-${idx}`, profile);
        anySpecificOk = anySpecificOk || lvarOk;
      }
      // For A2A, generic door events can fight with custom LVar/event logic.
      // Use generic path only as fallback when specific handling did not succeed.
      if (isA2aProfile && anySpecificOk) {
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
        if (isComancheProfile) {
          await holdPa24ComancheDoorOpen(idx, `${reason}-hold-${tick}-${why}`);
        } else {
          await setA2aDoorByLVars(true, idx, `${reason}-hold-${tick}-${why}`, profile);
        }
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
    if (!Number.isFinite(n)) return Math.max(1, Math.min(20, Math.round(fallback)));
    return Math.max(1, Math.min(20, Math.round(n)));
  };

  const PA24_PAYLOAD_ADAPTER = 'pa24_accusim';
  const PA24_PAYLOAD_SEAT_SETTLE_MS = 220;
  const PA24_PAYLOAD_LVARS = [
    ...[1, 2, 3, 4].map((seat) => ({
      key: `Seat${seat}Character`,
      name: `L:Seat${seat}Character`,
      units: 'enum'
    })),
    ...[1, 2, 3, 4].map((character) => ({
      key: `Character${character}Weight`,
      name: `L:Character${character}Weight`,
      units: 'number'
    })),
    { key: 'BaggageWeight', name: 'L:BaggageWeight', units: 'pounds' },
    { key: 'BaggageAWeight', name: 'L:BaggageAWeight', units: 'pounds' },
    { key: 'BaggageBWeight', name: 'L:BaggageBWeight', units: 'pounds' },
    { key: 'BaggageCWeight', name: 'L:BaggageCWeight', units: 'pounds' },
    { key: 'PayloadWeight', name: 'L:PayloadWeight', units: 'pounds' },
    { key: 'TotalWeight', name: 'L:TotalWeight', units: 'pounds' },
    { key: 'GrossWeight', name: 'L:GrossWeight', units: 'pounds' },
    { key: 'EmptyWeight', name: 'L:EmptyWeight', units: 'pounds' },
    ...PA24_FUEL_TANK_LVARS.map((tank) => ({ ...tank, units: 'number' }))
  ];
  let currentPayloadAdapter = '';

  const detectPayloadAdapter = (aircraft = {}) => {
    const haystack = `${aircraft?.title || ''} ${aircraft?.model || ''} ${aircraft?.type || ''}`;
    return /(?:\bpa\s*-?\s*24\b|\bpa24\b|comanche)/i.test(haystack)
      ? PA24_PAYLOAD_ADAPTER
      : 'msfs_payload_stations';
  };

  const ensurePayloadReadDefinition = (stationCount) => {
    const count = clampPayloadStationCount(stationCount, 12);
    const cached = payloadReadDefCache.get(count);
    if (cached) return cached;
    const defId = nextDefId++;
    handle.addToDataDefinition(defId, 'TITLE', null, SimConnectDataType.STRING256);
    handle.addToDataDefinition(defId, 'ATC MODEL', null, SimConnectDataType.STRING256);
    handle.addToDataDefinition(defId, 'ATC TYPE', null, SimConnectDataType.STRING256);
    handle.addToDataDefinition(defId, 'TOTAL WEIGHT', 'pounds', SimConnectDataType.FLOAT64);
    handle.addToDataDefinition(defId, 'EMPTY WEIGHT', 'pounds', SimConnectDataType.FLOAT64);
    handle.addToDataDefinition(defId, 'FUEL TOTAL QUANTITY WEIGHT', 'pounds', SimConnectDataType.FLOAT64);
    handle.addToDataDefinition(defId, 'FUEL WEIGHT PER GALLON', 'pounds', SimConnectDataType.FLOAT64);
    handle.addToDataDefinition(defId, 'PAYLOAD STATION COUNT', 'number', SimConnectDataType.FLOAT64);
    for (let i = 1; i <= count; i += 1) {
      handle.addToDataDefinition(defId, `PAYLOAD STATION WEIGHT:${i}`, 'pounds', SimConnectDataType.FLOAT64);
    }
    PA24_PAYLOAD_LVARS.forEach((entry) => {
      handle.addToDataDefinition(defId, entry.name, entry.units, SimConnectDataType.FLOAT64);
    });
    payloadReadDefCache.set(count, defId);
    return defId;
  };

  const ensurePayloadSetDefinition = (indices = []) => {
    const clean = [...new Set((indices || [])
      .map(v => Math.round(Number(v)))
      .filter(v => Number.isFinite(v) && v >= 1 && v <= 20))]
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
      .filter(row => Number.isFinite(row.index) && row.index >= 1 && row.index <= 20 && Number.isFinite(row.weightLbs));
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

  const normalizePa24PayloadState = (raw = {}) => {
    const source = raw && typeof raw === 'object' ? raw : {};
    const seatsSource = source.seats && typeof source.seats === 'object' ? source.seats : {};
    const weightsSource = source.characterWeights && typeof source.characterWeights === 'object'
      ? source.characterWeights
      : {};
    const seats = {};
    const characterWeights = {};
    [2, 3, 4].forEach((seat) => {
      const character = Math.round(Number(seatsSource[seat] ?? seatsSource[String(seat)] ?? 0));
      if (!Number.isFinite(character) || character < 0 || character > 4) {
        throw new Error(`pa24_invalid_seat_character_${seat}`);
      }
      seats[seat] = character;
    });
    [2, 3, 4].forEach((character) => {
      const weight = Number(weightsSource[character] ?? weightsSource[String(character)] ?? 0);
      if (!Number.isFinite(weight) || weight < 0 || weight > 500) {
        throw new Error(`pa24_invalid_character_weight_${character}`);
      }
      characterWeights[character] = Math.round(weight * 10) / 10;
    });
    const baggageWeightLbs = Number(source.baggageWeightLbs);
    if (!Number.isFinite(baggageWeightLbs) || baggageWeightLbs < 0 || baggageWeightLbs > 200) {
      throw new Error('pa24_invalid_baggage_weight');
    }
    return {
      seats,
      characterWeights,
      baggageWeightLbs: Math.round(baggageWeightLbs * 10) / 10
    };
  };

  const applyPa24PayloadState = async (rawState = {}, previousRawState = null) => {
    const state = normalizePa24PayloadState(rawState);
    const previousState = previousRawState && typeof previousRawState === 'object'
      ? normalizePa24PayloadState({
        seats: previousRawState.seats,
        characterWeights: previousRawState.characterWeights,
        baggageWeightLbs: previousRawState.baggageWeightLbs
      })
      : null;
    let changed = 0;
    const changedSeats = [2, 3, 4].filter((seat) => (
      !previousState || previousState.seats[seat] !== state.seats[seat]
    ));
    let clearedSeats = 0;
    changedSeats.forEach((seat) => {
      if (previousState && previousState.seats[seat] === 0) return;
      if (!setNamedVarValue(`L:Seat${seat}Character`, 0, 'enum', 'pa24-payload-clear-seat')) {
        throw new Error(`pa24_seat_clear_failed_${seat}`);
      }
      changed += 1;
      clearedSeats += 1;
    });
    if (clearedSeats > 0) await sleep(PA24_PAYLOAD_SEAT_SETTLE_MS);
    [2, 3, 4].forEach((character) => {
      if (previousState
          && Math.abs(previousState.characterWeights[character] - state.characterWeights[character]) <= 0.05) {
        return;
      }
      if (!setNamedVarValue(
        `L:Character${character}Weight`,
        state.characterWeights[character],
        'number',
        'pa24-payload-character-weight'
      )) {
        throw new Error(`pa24_character_weight_failed_${character}`);
      }
      changed += 1;
    });
    if (!previousState || Math.abs(previousState.baggageWeightLbs - state.baggageWeightLbs) > 0.05) {
      if (!setNamedVarValue('L:BaggageWeight', state.baggageWeightLbs, 'pounds', 'pa24-payload-baggage')) {
        throw new Error('pa24_baggage_weight_failed');
      }
      changed += 1;
    }
    changedSeats.forEach((seat) => {
      if (state.seats[seat] === 0) return;
      if (!setNamedVarValue(
        `L:Seat${seat}Character`,
        state.seats[seat],
        'enum',
        'pa24-payload-occupy-seat'
      )) {
        throw new Error(`pa24_seat_occupy_failed_${seat}`);
      }
      changed += 1;
    });
    return { changed, changedSeats, state };
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
      if (missionAuthority?.recordEffectAck) missionAuthority.recordEffectAck(ackPayload);
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

  const commandSceneObjectKeys = (command = {}) => {
    const direct = [
      command?.objectKey,
      ...(Array.isArray(command?.objectKeys) ? command.objectKeys : [])
    ];
    const itemKeys = (Array.isArray(command?.items) ? command.items : [])
      .flatMap(item => [item?.objectKey, ...(Array.isArray(item?.objectKeys) ? item.objectKeys : [])]);
    return uniqueStrings([...direct, ...itemKeys].map(value => String(value || '').trim().toLowerCase()).filter(Boolean));
  };

  const commandSceneObjectItemIds = (command = {}) => uniqueStrings([
    command?.itemId,
    command?.cargoItemId,
    ...(Array.isArray(command?.itemIds) ? command.itemIds : []),
    ...(Array.isArray(command?.items) ? command.items.flatMap(item => [item?.itemId, item?.cargoItemId]) : [])
  ].map(value => String(value || '').trim().toLowerCase()).filter(Boolean));

  const sceneObjectCommandRevision = (command = {}) => {
    const revisions = [
      Number(command?.objectRevision),
      ...(Array.isArray(command?.items) ? command.items.map(item => Number(item?.objectRevision)) : [])
    ].filter(Number.isFinite);
    return revisions.length ? Math.max(0, Math.round(Math.max(...revisions))) : 0;
  };

  const markSceneObjectDesiredState = (command = {}, visible = false) => {
    const revision = sceneObjectCommandRevision(command);
    for (const objectKey of commandSceneObjectKeys(command)) {
      const previous = sceneObjectDesiredStates.get(objectKey);
      if (previous && Number(previous.revision || 0) > revision) continue;
      sceneObjectDesiredStates.set(objectKey, {
        visible: visible === true,
        revision,
        commandId: String(command?.commandId || ''),
        updatedAt: Date.now()
      });
    }
  };

  const sceneObjectOperationKey = (command = {}) => {
    const objectKeys = commandSceneObjectKeys(command);
    if (objectKeys.length) return `object:${objectKeys.join('|')}`;
    const itemIds = commandSceneObjectItemIds(command);
    if (itemIds.length) return `item:${String(command?.missionId || '')}:${itemIds.join('|')}`;
    return `scene:${String(command?.sceneId || 'mission-scene')}`;
  };

  const sceneObjectAckTypeForCommand = (command = {}) => String(command?.type || '') === 'mission_scene_object_spawn'
    ? 'mission_scene_object_spawn_ack'
    : 'mission_scene_object_remove_ack';

  const sendSceneObjectOperationAck = (command = {}, payload = {}) => {
    const objectKeys = commandSceneObjectKeys(command);
    const itemIds = commandSceneObjectItemIds(command);
    sendAck({
      type: sceneObjectAckTypeForCommand(command),
      commandId: command?.commandId || null,
      sceneId: String(command?.sceneId || 'mission-scene'),
      missionId: String(command?.missionId || ''),
      objectKey: objectKeys[0] || '',
      objectKeys,
      itemId: itemIds[0] || '',
      itemIds,
      objectRevision: sceneObjectCommandRevision(command),
      ...payload
    });
  };

  const enqueueSceneObjectOperation = (command = {}, operation) => {
    const key = sceneObjectOperationKey(command);
    let state = sceneObjectOperationStates.get(key);
    if (!state) {
      state = { running: false, activeCommandId: '', pending: null };
      sceneObjectOperationStates.set(key, state);
    }
    const commandId = String(command?.commandId || '');
    if (commandId && (commandId === state.activeCommandId || commandId === String(state.pending?.command?.commandId || ''))) {
      debugLog(`SCENE_OBJECT_COMMAND_DUPLICATE_SKIP key=${key} commandId=${commandId}`);
      return true;
    }
    if (state.pending?.command) {
      sendSceneObjectOperationAck(state.pending.command, {
        status: 'noop',
        spawned: 0,
        removed: 0,
        reason: 'superseded'
      });
      debugLog(`SCENE_OBJECT_COMMAND_SUPERSEDED key=${key} old=${state.pending.command.commandId || ''} next=${commandId}`);
    }
    state.pending = { command, operation };
    if (state.running) return true;
    state.running = true;
    const drain = async () => {
      try {
        while (state.pending) {
          const next = state.pending;
          state.pending = null;
          state.activeCommandId = String(next.command?.commandId || '');
          try {
            await next.operation();
          } catch (err) {
            trackerWarn(`⚠️  Scene object operation failed: ${err?.message || err}`);
            sendSceneObjectOperationAck(next.command, {
              status: 'error',
              error: err?.message || String(err)
            });
          } finally {
            state.activeCommandId = '';
          }
        }
      } finally {
        state.running = false;
        if (!state.pending) sceneObjectOperationStates.delete(key);
      }
    };
    drain().catch((err) => {
      state.running = false;
      sceneObjectOperationStates.delete(key);
      trackerWarn(`⚠️  Scene object queue failed: ${err?.message || err}`);
    });
    return true;
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
    missionAuthority?.recordCommand?.(command);
  };

  const sceneObjectIdentity = (sceneId, obj = {}) => {
    const objectKey = String(obj?.objectKey || '').trim().toLowerCase();
    if (objectKey) return `object:${objectKey}`;
    const itemId = String(obj?.cargoItemId || obj?.itemId || '').trim().toLowerCase();
    if (itemId) return `item:${String(sceneId || '').toLowerCase()}:${itemId}`;
    const kind = String(obj?.kind || '').trim().toLowerCase();
    const index = Number.isFinite(Number(obj?.index)) ? Math.round(Number(obj.index)) : 0;
    return kind ? `plan:${String(sceneId || '').toLowerCase()}:${kind}:${index}` : '';
  };

  const discardLateAssignedSceneObject = (sceneId, obj, reason = 'late-discard') => {
    if (!obj?.objectId) return false;
    try {
      handle.aIRemoveObject(obj.objectId, nextReqId++);
      forgetObjectId(obj.objectId);
      debugLog(`SCENE_LATE_ASSIGN_DISCARDED scene=${sceneId || ''} kind=${obj.kind || ''} objectId=${obj.objectId} objectKey=${obj.objectKey || ''} reason=${reason}`);
      return true;
    } catch (err) {
      debugLog(`SCENE_LATE_ASSIGN_DISCARD_ERROR scene=${sceneId || ''} objectId=${obj.objectId} reason=${reason} error=${err?.message || err}`);
      return false;
    }
  };

  const addLateAssignedSceneObject = (sceneId, obj) => {
    const key = String(sceneId || '').trim();
    if (!key || !obj?.objectId) return false;
    const explicitObjectKey = String(obj?.objectKey || '').trim().toLowerCase();
    const desired = explicitObjectKey ? sceneObjectDesiredStates.get(explicitObjectKey) : null;
    if (desired && (
      desired.visible !== true
      || Number(desired.revision || 0) > Number(obj?.objectRevision || 0)
    )) {
      return discardLateAssignedSceneObject(key, obj, desired.visible === true ? 'stale-revision' : 'desired-hidden');
    }
    const identity = sceneObjectIdentity(key, obj);
    const rec = scenes.get(key);
    if (rec && Array.isArray(rec.objects)) {
      if (identity && rec.objects.some(existing => sceneObjectIdentity(key, existing) === identity)) {
        return discardLateAssignedSceneObject(key, obj, 'semantic-duplicate');
      }
      if (!rec.objects.some(o => Number(o?.objectId) === Number(obj.objectId))) {
        rec.objects.push(obj);
        debugLog(`SCENE_LATE_ASSIGN_ATTACHED scene=${key} kind=${obj.kind || ''} objectId=${obj.objectId} title="${obj.title || ''}"`);
      }
      return true;
    }
    const list = lateAssignedSceneObjects.get(key) || [];
    if (identity && list.some(existing => sceneObjectIdentity(key, existing) === identity)) {
      return discardLateAssignedSceneObject(key, obj, 'buffered-semantic-duplicate');
    }
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

  const dedupeSceneObjects = (sceneId, objects = [], reason = 'semantic-dedupe') => {
    const kept = [];
    const identities = new Set();
    const ordered = (Array.isArray(objects) ? objects : [])
      .slice()
      .sort((a, b) => Number(a?.lateAssigned === true) - Number(b?.lateAssigned === true));
    for (const obj of ordered) {
      const identity = sceneObjectIdentity(sceneId, obj);
      if (!identity || !identities.has(identity)) {
        if (identity) identities.add(identity);
        kept.push(obj);
        continue;
      }
      removeSceneObject({ sceneId, objects }, obj, reason);
    }
    return kept;
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
        await stabilizeSceneGroundObject(objectId, candidate, plan);
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
        objectKey: String(item?.objectKey || command?.objectKey || '').trim(),
        objectRevision: Math.max(0, Math.round(toFiniteNumber(item?.objectRevision ?? command?.objectRevision, 0) || 0)),
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
    const doorEnabled = command?.openDoor === true || command?.door === true;
    const doorIndex = clampInt(command?.doorIndex ?? 1, 0, 8);
    const doorProfile = resolveDoorProfile(command);
    let doorOpened = false;
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

    const requestedBoarders = clampInt(command?.boarderCount ?? command?.passengerCount ?? 1, 0, 3);
    if (requestedBoarders <= 0) {
      debugLog(`SCENE_BOARDING_NOOP scene=${sceneId} reason=no_passengers`);
      sendAck({ type: 'mission_scene_boarding_ack', commandId, sceneId, missionId, status: 'noop', error: 'no_passengers', boarded: 0 });
      return;
    }
    const explicitBoarders = rec.objects
      .filter(o => /^person_boarder/i.test(String(o?.kind || '')) && o?.objectId)
      .sort((a, b) => String(a.kind || '').localeCompare(String(b.kind || '')));
    const fallbackPerson = rec.objects.find(o => String(o?.kind || '').toLowerCase() === 'person' && o?.objectId);
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
      doorOpened = true;
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
    sendAck({
      type: 'mission_scene_boarding_stage',
      commandId,
      sceneId,
      missionId,
      status: 'ok',
      stage: 'passenger_boarded',
      removed,
      boarded: routeSent ? boarderPlans.length : 0
    });
    await sleep(clampInt(command?.boardingCueLeadMs ?? 500, 150, 1500));
    if (doorEnabled) {
      stopDoorHold('boarding-close');
      await sleep(300);
      await setUserAircraftDoor(false, doorIndex, 'boarding-close', doorProfile);
      doorOpened = false;
    }
    const vehicleDeparture = routeSent ? startVehicleDeparture(command, rec, sceneId) : false;
    debugLog(`SCENE_BOARDING_OK scene=${sceneId} boarders=${boarderPlans.length} routeSent=${routeSent ? 1 : 0} routeSentCount=${routeSentCount} removed=${removed} vehicleDeparture=${vehicleDeparture ? 1 : 0}`);
    sendAck({ type: 'mission_scene_boarding_ack', commandId, sceneId, status: routeSent ? 'ok' : 'error', routeSent: routeSent ? 1 : 0, routeSentCount, removed, cargoRemoved, boarded: routeSent ? boarderPlans.length : 0, vehicleDeparture: vehicleDeparture ? 1 : 0, durationMs, error: routeSent ? '' : 'waypoint_route_failed' });
    } finally {
      if (typeof stopDoorHold === 'function') stopDoorHold('boarding-finally');
      if (doorOpened) await setUserAircraftDoor(false, doorIndex, 'boarding-finally-close', doorProfile);
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
    const doorEnabled = command?.openDoor === true || command?.door === true;
    const doorProfile = resolveDoorProfile(command);
    const doorIndex = clampInt(command?.doorIndex ?? 1, 0, 8);
    let doorOpened = false;
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
    const requestedBoarders = clampInt(command?.boarderCount ?? command?.passengerCount ?? 1, 0, 3);
    if (requestedBoarders <= 0) {
      debugLog(`SCENE_DEBOARDING_NOOP scene=${sceneId} reason=no_passengers`);
      sendAck({ type: 'mission_scene_deboarding_ack', commandId, sceneId, missionId, status: 'noop', error: 'no_passengers', deboarded: 0 });
      return;
    }
    const pickupSceneRec = command?.deboardingPickupSceneId
      ? scenes.get(String(command.deboardingPickupSceneId))
      : null;
    const stagedPickupVehicle = (pickupSceneRec?.objects || []).find(obj => obj?.objectId && isPickupVehicleObject(obj)) || null;
    const vehicleArrivalEnabled = (command?.vehicleArrival !== false && command?.vehicleReturn !== false)
      || (!!command?.deboardingPickupSceneId && !stagedPickupVehicle);
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
      if (vehicleRouteSent) {
        await sleep(vehicleArrivalMs);
      } else {
        // Einige Ground-SimObjects akzeptieren sporadisch keine AI-Waypoints.
        // Dann wenigstens sauber am Abholpunkt bereitstellen statt fernab zu warten.
        await sleep(600);
        teleportObject(vehicle.objectId, vehiclePark);
        vehicleArrivalMs = 600;
      }
      holdVehicleAtPoint(vehicle.objectId, vehiclePark, 'scene-deboarding-arrival-park');
    } else {
      debugLog(`SCENE_DEBOARDING_NO_VEHICLE scene=${sceneId}`);
    }

    const farewellTimeoutMs = clampInt(command?.farewellTimeoutMs ?? 150000, 10000, 180000);
    const farewellGatePromise = command?.coordinateFarewell === true
      ? waitForDeboardingContinuation(commandId, sceneId, farewellTimeoutMs)
      : null;
    sendAck({
      type: 'mission_scene_deboarding_stage',
      commandId,
      sceneId,
      missionId,
      status: 'ok',
      stage: 'cue',
      reason: command?.reason || 'mission-end'
    });
    await sleep(clampInt(command?.deboardingCueLeadMs ?? 450, 150, 1500));
    if (doorEnabled) {
      await setUserAircraftDoor(true, doorIndex, 'deboarding-open', doorProfile);
      doorOpened = true;
      stopDoorOpenHold = startUserAircraftDoorOpenHold(
        doorIndex,
        'deboarding-open',
        doorProfile,
        command?.coordinateFarewell === true ? Math.min(190000, farewellTimeoutMs + 10000) : 50000
      );
      await sleep(450);
    }
    sendAck({
      type: 'mission_scene_deboarding_stage',
      commandId,
      sceneId,
      missionId,
      status: 'ok',
      stage: 'door_open',
      reason: command?.reason || 'mission-end'
    });
    if (farewellGatePromise) {
      const gate = await farewellGatePromise;
      if (gate?.action !== 'continue') {
        if (doorEnabled) {
          stopDoorHold('deboarding-close-cancelled');
          await setUserAircraftDoor(false, doorIndex, 'deboarding-close-cancelled', doorProfile);
          doorOpened = false;
        }
        sendAck({
          type: 'mission_scene_deboarding_ack',
          commandId,
          sceneId,
          missionId,
          status: 'error',
          error: gate?.reason || 'farewell_cancelled',
          deboarded: 0
        });
        return;
      }
    }

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
        doorOpened = false;
      }
      sendAck({ type: 'mission_scene_deboarding_ack', commandId, sceneId, status: 'error', error: 'person_spawn_failed', vehicleRouteSent: vehicleRouteSent ? 1 : 0 });
      return;
    }

    // Der Passagier steht jetzt neben dem Flugzeug. Erst die Tür schließen,
    // danach beginnt der Weg zum wartenden Fahrzeug bzw. Abholpunkt.
    if (doorEnabled) {
      await sleep(clampInt(command?.deboardingPostSpawnHoldMs ?? 500, 150, 1800));
      stopDoorHold('deboarding-close-before-walk');
      await setUserAircraftDoor(false, doorIndex, 'deboarding-close-before-walk', doorProfile);
      doorOpened = false;
    }

    const pickupPoint = stagedPickupVehicle
      ? {
          worldLat: Number(stagedPickupVehicle.lat),
          worldLon: Number(stagedPickupVehicle.lon),
          worldAltFt: Number(stagedPickupVehicle.altFt),
          lat: Number(stagedPickupVehicle.lat),
          lon: Number(stagedPickupVehicle.lon),
          altFt: Number(stagedPickupVehicle.altFt)
        }
      : (vehicleArrivalEnabled ? null : (command?.deboardingPickupPoint || command?.pickupPoint || null));
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
    const allPersonRoutesSent = routeSentCount === people.length;
    people.forEach(person => removeSceneObject(
      rec,
      person,
      allPersonRoutesSent
        ? (pickupRoutePoint ? 'deboarding-pickup-boarded' : (vehicleArrivalEnabled ? 'deboarding-vehicle-boarded' : 'deboarding-walkoff-hidden'))
        : 'deboarding-route-failed-cleanup'
    ));
    if (allPersonRoutesSent) {
      sendAck({
        type: 'mission_scene_deboarding_stage',
        commandId,
        sceneId,
        missionId,
        status: 'ok',
        stage: boardedPickup ? 'passenger_vehicle_boarded' : 'passenger_handoff_complete',
        deboarded: routeSentCount,
        pickupBound: boardedPickup ? 1 : 0,
        reason: command?.reason || 'mission-end'
      });
    }
    let pickupVehicleDeparture = false;
    let pickupVehicleDepartureMs = 0;
    if (boardedPickup) {
      const departRoute = buildRelativeSceneRoute(command, rec, command?.vehicleDeparturePath, defaultVehicleDeparturePath(command));
      const departVehicle = (vehicleRec, vehicle, startPoint, reason) => {
        if (!vehicleRec || !vehicle?.objectId || departRoute.length < 2) return 0;
        const speedKts = Math.max(2, Math.min(12, Number(command?.vehicleSpeedKts || command?.vehicleDepartureSpeedKts || 7) || 7));
        setObjectParkingBrake(vehicle.objectId, false, 'scene-deboarding-pickup-depart');
        const sent = sendWaypointRoute(vehicle.objectId, departRoute.slice(1), speedKts);
        if (!sent) {
          const fallbackRemoveMs = 1200;
          debugLog(`SCENE_DEBOARDING_PICKUP_DEPART_FALLBACK scene=${vehicleRec.sceneId || sceneId} objectId=${vehicle.objectId} reason=${reason}`);
          setTimeout(() => removeSceneObject(vehicleRec, vehicle, `${reason}-route-failed`), fallbackRemoveMs);
          return fallbackRemoveMs;
        }
        const distancePath = [startPoint || departRoute[0]].concat(departRoute.slice(1));
        const removeDelayMs = clampInt((pathDistanceM(distancePath) / Math.max(0.5, speedKts * 0.514444)) * 1000 + 1500, 2500, 28000);
        debugLog(`SCENE_DEBOARDING_PICKUP_DEPART scene=${vehicleRec.sceneId || sceneId} objectId=${vehicle.objectId} removeDelayMs=${removeDelayMs} reason=${reason}`);
        setTimeout(() => removeSceneObject(vehicleRec, vehicle, reason), removeDelayMs);
        return removeDelayMs;
      };
      if (arrivalVehicle) {
        pickupVehicleDepartureMs = departVehicle(rec, arrivalVehicle, vehiclePark, 'deboarding-vehicle-depart-hidden');
        pickupVehicleDeparture = pickupVehicleDepartureMs > 0;
      } else if (pickupRoutePoint && command?.deboardingPickupSceneId) {
        pickupVehicleDepartureMs = departVehicle(pickupSceneRec, stagedPickupVehicle, pickupRoutePoint, 'deboarding-pickup-vehicle-depart-hidden');
        pickupVehicleDeparture = pickupVehicleDepartureMs > 0;
      }
    }
    if (pickupVehicleDepartureMs > 0) await sleep(pickupVehicleDepartureMs);
    sendAck({
      type: 'mission_scene_deboarding_ack',
      commandId,
      sceneId,
      missionId,
      status: allPersonRoutesSent ? 'ok' : 'error',
      vehicleRouteSent: vehicleRouteSent ? 1 : 0,
      vehicleArrival: vehicleArrivalEnabled ? 1 : 0,
      pickupVehicleDeparture: pickupVehicleDeparture ? 1 : 0,
      routeSentCount,
      deboarded: routeSentCount,
      durationMs: vehicleArrivalMs + walkMs + pickupVehicleDepartureMs,
      error: allPersonRoutesSent ? '' : 'waypoint_route_failed'
    });
    } finally {
      if (typeof stopDoorHold === 'function') stopDoorHold('deboarding-finally');
      if (doorOpened) await setUserAircraftDoor(false, doorIndex, 'deboarding-finally-close', doorProfile);
      cancelDeboardingContinuationsForScene(sceneId, 'deboarding-finally');
      activeDeboardingScenes.delete(sceneId);
    }
  };

  const animateMissionSceneGroundVisit = async (command) => {
    const sceneId = String(command?.sceneId || 'mission-scene-ground-visit');
    const commandId = command?.commandId || null;
    const missionId = String(command?.missionId || '').trim();
    if (activeGroundVisitScenes.has(sceneId)) {
      sendAck({ type: 'mission_scene_ground_visit_ack', commandId, sceneId, missionId, status: 'noop', error: 'busy' });
      return;
    }
    activeGroundVisitScenes.add(sceneId);
    const rec = scenes.get(sceneId) || { sceneId, command: { ...command }, objects: [], positions: [] };
    rec.sceneId = sceneId;
    rec.missionId = missionId || rec.missionId || '';
    rec.command = { ...(rec.command || {}), ...command };
    if (!Array.isArray(rec.objects)) rec.objects = [];
    scenes.set(sceneId, rec);
    try {
      const arrivalRoute = buildRelativeSceneRoute(command, rec, command?.vehicleArrivalPath, [
        { forwardM: -24, rightM: 18 },
        { forwardM: 22, rightM: 12 }
      ]);
      if (arrivalRoute.length < 2) {
        sendAck({ type: 'mission_scene_ground_visit_ack', commandId, sceneId, missionId, status: 'error', error: 'invalid_vehicle_route' });
        return;
      }
      const vehicleTitle = String(command?.vehicleTitle || 'Microsoft_Car_EUR_04').trim() || 'Microsoft_Car_EUR_04';
      const vehicleStart = arrivalRoute[0];
      const vehiclePark = arrivalRoute[arrivalRoute.length - 1];
      const vehicle = await spawnSceneObjectFromPlan(sceneId, {
        index: 1,
        kind: 'ground_visit_vehicle',
        label: 'Behoerdenfahrzeug',
        title: vehicleTitle,
        titleCandidates: buildTitleCandidates(vehicleTitle, command?.vehicleTitleCandidates || [
          'Microsoft_Car_EUR_04',
          'Microsoft_Car_EUR_03',
          'Microsoft_Car_EUR_02',
          'Microsoft_Car_EUR_01'
        ]),
        lat: vehicleStart.lat,
        lon: vehicleStart.lon,
        altFt: vehicleStart.altFt,
        hdg: headingBetweenOffsets(vehicleStart, arrivalRoute[1] || vehiclePark, command?.hdg || 0),
        baseAltFt: sceneBaseFromCommand(command, rec).altFt,
        altOffsetFt: vehicleStart.altOffsetFt || 0,
        forwardM: vehicleStart.forwardM,
        rightM: vehicleStart.rightM,
        northM: vehicleStart.northM,
        eastM: vehicleStart.eastM
      }, 3200);
      if (!vehicle) {
        sendAck({ type: 'mission_scene_ground_visit_ack', commandId, sceneId, missionId, status: 'error', error: 'vehicle_spawn_failed' });
        return;
      }
      rec.objects.push(vehicle);
      const vehicleSpeedKts = Math.max(2, Math.min(12, Number(command?.vehicleSpeedKts || 7) || 7));
      const vehicleRouteSent = sendWaypointRoute(vehicle.objectId, arrivalRoute.slice(1), vehicleSpeedKts);
      const vehicleArrivalMs = clampInt(
        (pathDistanceM(arrivalRoute) / Math.max(0.5, vehicleSpeedKts * 0.514444)) * 1000 + 1200,
        2500,
        26000
      );
      if (vehicleRouteSent) {
        await sleep(vehicleArrivalMs);
      } else {
        await sleep(600);
        teleportObject(vehicle.objectId, vehiclePark);
      }
      holdVehicleAtPoint(vehicle.objectId, vehiclePark, 'ground-visit-park');
      sendAck({
        type: 'mission_scene_ground_visit_stage',
        commandId,
        sceneId,
        missionId,
        status: vehicleRouteSent ? 'ok' : 'fallback',
        stage: 'vehicle_parked'
      });

      const rawVisitors = Array.isArray(command?.visitorPaths) ? command.visitorPaths.slice(0, 2) : [];
      const visitors = [];
      for (let index = 0; index < rawVisitors.length; index++) {
        const visitor = rawVisitors[index] || {};
        const route = buildRelativeSceneRoute(command, rec, visitor.path, []);
        if (route.length < 2) continue;
        const start = route[0];
        const title = String(visitor.objectTitle || visitor.title || (index === 0 ? 'Tarmac_Male_Summer_Asian' : 'Termac_Female_Summer_Asian')).trim();
        const object = await spawnSceneObjectFromPlan(sceneId, {
          index: index + 2,
          kind: `ground_visit_person_${index + 1}`,
          label: String(visitor.label || `Kontrolleur ${index + 1}`),
          title,
          titleCandidates: buildTitleCandidates(title, visitor.titleCandidates || []),
          lat: start.lat,
          lon: start.lon,
          altFt: start.altFt,
          hdg: headingBetweenOffsets(start, route[1], command?.hdg || 0),
          baseAltFt: sceneBaseFromCommand(command, rec).altFt,
          altOffsetFt: start.altOffsetFt || 0,
          forwardM: start.forwardM,
          rightM: start.rightM,
          northM: start.northM,
          eastM: start.eastM
        }, 3200);
        if (!object) continue;
        rec.objects.push(object);
        visitors.push({ object, route });
      }
      if (visitors.length < 2) {
        sendAck({
          type: 'mission_scene_ground_visit_ack',
          commandId,
          sceneId,
          missionId,
          status: 'error',
          error: 'visitor_spawn_failed',
          spawned: visitors.length
        });
        return;
      }

      const walkSpeedKts = Math.max(2.5, Math.min(4.5, Number(command?.walkSpeedKts || 3.1) || 3.1));
      let visitorRouteSentCount = 0;
      let visitorArrivalMs = 0;
      visitors.forEach((visitor) => {
        const sent = sendWaypointRoute(visitor.object.objectId, visitor.route.slice(1), walkSpeedKts);
        visitor.routeSent = sent;
        visitorRouteSentCount += sent ? 1 : 0;
        visitorArrivalMs = Math.max(visitorArrivalMs, clampInt(
          (pathDistanceM(visitor.route) / Math.max(0.5, walkSpeedKts * 0.514444)) * 1000 + 1000,
          2500,
          26000
        ));
      });
      await sleep(visitorArrivalMs);
      visitors.filter(visitor => !visitor.routeSent).forEach(visitor => {
        teleportObject(visitor.object.objectId, visitor.route[visitor.route.length - 1]);
      });
      sendAck({
        type: 'mission_scene_ground_visit_stage',
        commandId,
        sceneId,
        missionId,
        status: visitorRouteSentCount === visitors.length ? 'ok' : 'fallback',
        stage: 'visitors_at_aircraft',
        visitors: visitors.length,
        routeSentCount: visitorRouteSentCount
      });

      const gate = await waitForGroundVisitRelease(
        commandId,
        sceneId,
        Number(command?.releaseTimeoutMs || 30 * 60 * 1000)
      );
      if (gate?.action !== 'release') {
        sendAck({
          type: 'mission_scene_ground_visit_ack',
          commandId,
          sceneId,
          missionId,
          status: 'error',
          error: gate?.reason || 'ground_visit_cancelled'
        });
        return;
      }

      let visitorReturnSentCount = 0;
      let visitorReturnMs = 0;
      visitors.forEach((visitor) => {
        const reverseRoute = visitor.route.slice().reverse();
        const sent = sendWaypointRoute(visitor.object.objectId, reverseRoute.slice(1), walkSpeedKts);
        visitorReturnSentCount += sent ? 1 : 0;
        visitorReturnMs = Math.max(visitorReturnMs, clampInt(
          (pathDistanceM(reverseRoute) / Math.max(0.5, walkSpeedKts * 0.514444)) * 1000 + 900,
          2500,
          26000
        ));
      });
      await sleep(visitorReturnMs);
      visitors.forEach(visitor => removeSceneObject(rec, visitor.object, 'ground-visit-person-boarded'));

      const departureRoute = buildRelativeSceneRoute(command, rec, command?.vehicleDeparturePath, arrivalRoute.slice().reverse());
      let vehicleDepartureSent = false;
      let vehicleDepartureMs = 900;
      if (departureRoute.length >= 2) {
        setObjectParkingBrake(vehicle.objectId, false, 'ground-visit-depart');
        vehicleDepartureSent = sendWaypointRoute(vehicle.objectId, departureRoute.slice(1), vehicleSpeedKts);
        vehicleDepartureMs = clampInt(
          (pathDistanceM(departureRoute) / Math.max(0.5, vehicleSpeedKts * 0.514444)) * 1000 + 1200,
          2500,
          26000
        );
      }
      await sleep(vehicleDepartureSent ? vehicleDepartureMs : 900);
      removeSceneObject(rec, vehicle, vehicleDepartureSent ? 'ground-visit-vehicle-departed' : 'ground-visit-vehicle-fallback-remove');
      sendAck({
        type: 'mission_scene_ground_visit_ack',
        commandId,
        sceneId,
        missionId,
        status: visitorReturnSentCount === visitors.length && vehicleDepartureSent ? 'ok' : 'fallback',
        visitors: visitors.length,
        routeSentCount: visitorReturnSentCount,
        vehicleDeparture: vehicleDepartureSent ? 1 : 0
      });
    } finally {
      cancelGroundVisitReleasesForScene(sceneId, 'ground-visit-finally');
      const leftovers = (rec.objects || []).filter(obj => /^ground_visit_/i.test(String(obj?.kind || '')));
      leftovers.forEach(obj => removeSceneObject(rec, obj, 'ground-visit-finally-cleanup'));
      activeGroundVisitScenes.delete(sceneId);
      if (!rec.objects.length) scenes.delete(sceneId);
    }
  };

  const clearScene = async (sceneId, reason = 'clear', commandId = null, options = {}) => {
    const key = String(sceneId || 'mission-scene');
    cancelDeboardingContinuationsForScene(key, reason || 'scene-clear');
    cancelGroundVisitReleasesForScene(key, reason || 'scene-clear');
    const ackEnabled = options?.ack !== false;
    const rec = scenes.get(key);
    const missionId = rec?.missionId || rec?.command?.missionId || '';
    const knownObjectKeys = uniqueStrings([
      ...(Array.isArray(rec?.objects) ? rec.objects.map(obj => obj?.objectKey) : []),
      ...(Array.isArray(rec?.positions) ? rec.positions.map(obj => obj?.objectKey) : []),
      ...((lateAssignedSceneObjects.get(key) || []).map(obj => obj?.objectKey))
    ].map(value => String(value || '').trim().toLowerCase()).filter(Boolean));
    knownObjectKeys.forEach((objectKey) => {
      const previous = sceneObjectDesiredStates.get(objectKey);
      sceneObjectDesiredStates.set(objectKey, {
        visible: false,
        revision: Number(previous?.revision || 0),
        commandId: String(commandId || ''),
        updatedAt: Date.now()
      });
    });
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
    if (ids.length) return ids.includes(Number(obj.objectId));
    const objectKeys = new Set((Array.isArray(command.objectKeys) ? command.objectKeys : [command.objectKey]).filter(Boolean).map(v => String(v).toLowerCase()));
    if (objectKeys.size) return objectKeys.has(String(obj.objectKey || '').toLowerCase());
    const itemIds = new Set((Array.isArray(command.itemIds) ? command.itemIds : [command.itemId]).filter(Boolean).map(v => String(v).toLowerCase()));
    if (itemIds.size) return itemIds.has(String(obj.cargoItemId || obj.itemId || '').toLowerCase());
    const cargoSceneKinds = new Set((Array.isArray(command.cargoSceneKinds) ? command.cargoSceneKinds : [command.cargoSceneKind]).filter(Boolean).map(v => String(v).toLowerCase()));
    if (cargoSceneKinds.size) return cargoSceneKinds.has(String(obj.cargoSceneKind || '').toLowerCase());
    const kinds = new Set((Array.isArray(command.kinds) ? command.kinds : [command.kind]).filter(Boolean).map(v => String(v).toLowerCase()));
    if (kinds.size) return kinds.has(String(obj.kind || '').toLowerCase());
    const labels = (Array.isArray(command.labels) ? command.labels : [command.label]).filter(Boolean).map(v => String(v).toLowerCase());
    if (labels.length) {
      const text = `${obj.label || ''} ${obj.title || ''} ${obj.requestedTitle || ''}`.toLowerCase();
      if (labels.some(label => label && text.includes(label))) return true;
    }
    return false;
  };

  const removeBufferedSceneObjectsBySelector = (command = {}, reason = 'object-remove') => {
    let removed = 0;
    const requestedSceneId = String(command?.sceneId || 'mission-scene');
    const sceneIds = command?.allScenes === true
      ? Array.from(lateAssignedSceneObjects.keys())
      : [requestedSceneId];
    for (const sceneId of sceneIds) {
      const buffered = lateAssignedSceneObjects.get(sceneId) || [];
      if (!buffered.length) continue;
      const keep = [];
      for (const obj of buffered) {
        if (!sceneObjectMatchesSelector(obj, command)) {
          keep.push(obj);
          continue;
        }
        removed += discardLateAssignedSceneObject(sceneId, obj, reason) ? 1 : 0;
      }
      if (keep.length) lateAssignedSceneObjects.set(sceneId, keep);
      else lateAssignedSceneObjects.delete(sceneId);
    }
    return removed;
  };

  const removeSceneObjectsMatchingCommand = (command = {}, reason = 'object-remove') => {
    const requestedSceneId = String(command?.sceneId || 'mission-scene');
    const records = command?.allScenes === true
      ? Array.from(scenes.values())
      : [scenes.get(requestedSceneId)].filter(Boolean);
    let removed = 0;
    for (const rec of records) {
      const targets = (rec?.objects || []).filter(obj => sceneObjectMatchesSelector(obj, command));
      for (const obj of targets) {
        removed += removeSceneObject(rec, obj, reason) ? 1 : 0;
      }
    }
    removed += removeBufferedSceneObjectsBySelector(command, reason);
    return removed;
  };

  const removeSceneObjectsBySelector = async (command) => {
    const sceneId = String(command?.sceneId || 'mission-scene');
    const commandId = command?.commandId || null;
    const missionId = String(command?.missionId || '').trim();
    const objectKeys = commandSceneObjectKeys(command);
    const itemIds = commandSceneObjectItemIds(command);
    const removed = removeSceneObjectsMatchingCommand(command, command?.reason || 'object-remove');
    const status = removed > 0 ? 'ok' : 'noop';
    debugLog(`SCENE_OBJECT_REMOVE_DONE scene=${sceneId} allScenes=${command?.allScenes === true ? 1 : 0} status=${status} removed=${removed} objectKey=${objectKeys[0] || ''}`);
    sendAck({
      type: 'mission_scene_object_remove_ack',
      commandId,
      sceneId,
      missionId,
      status,
      removed,
      reason: command?.reason || 'object-remove',
      objectKey: objectKeys[0] || '',
      objectKeys,
      itemId: itemIds[0] || '',
      itemIds,
      objectRevision: sceneObjectCommandRevision(command)
    });
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
    if (command?.replaceExisting === true) {
      const objectKeys = positions.map(position => position.objectKey).filter(Boolean);
      const itemIds = positions.flatMap(position => [position.itemId, position.cargoItemId]).filter(Boolean);
      const replaced = removeSceneObjectsMatchingCommand({
        sceneId,
        allScenes: true,
        objectKeys,
        itemIds: objectKeys.length ? [] : itemIds
      }, command?.reason || 'replace-existing-before-spawn');
      debugLog(`SCENE_OBJECT_REPLACE_EXISTING scene=${sceneId} removed=${replaced} objectKeys=${objectKeys.join(',')}`);
    }
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
    const deduped = dedupeSceneObjects(sceneId, rec.objects, 'scene-object-append-semantic-dedupe');
    rec.objects = deduped;
    const survivingObjectIds = new Set(deduped.map(obj => Number(obj?.objectId)));
    const acknowledgedObjects = objects.filter(obj => survivingObjectIds.has(Number(obj?.objectId)));
    rec.positions.push(...positions);
    const byKind = countByKind(acknowledgedObjects);
    const stabilized = acknowledgedObjects.filter((obj) => obj.groundStabilized === true).length;
    const objectKeys = commandSceneObjectKeys(command);
    const itemIds = commandSceneObjectItemIds(command);
    debugLog(`SCENE_OBJECT_SPAWN_DONE scene=${sceneId} spawned=${acknowledgedObjects.length} stabilized=${stabilized} byKind=${JSON.stringify(byKind)}`);
    sendAck({
      type: 'mission_scene_object_spawn_ack',
      commandId,
      sceneId,
      missionId,
      status: acknowledgedObjects.length ? 'ok' : 'error',
      spawned: acknowledgedObjects.length,
      stabilized,
      spawnedByKind: byKind,
      objectKey: objectKeys[0] || '',
      objectKeys,
      itemId: itemIds[0] || '',
      itemIds,
      objectRevision: sceneObjectCommandRevision(command),
      objects: acknowledgedObjects.map((obj) => ({
        objectId: obj.objectId,
        kind: obj.kind,
        title: obj.title,
        objectKey: obj.objectKey || '',
        itemId: obj.itemId || obj.cargoItemId || '',
        groundStabilized: obj.groundStabilized === true,
        groundAltitudeFt: Number.isFinite(Number(obj.groundAltitudeFt)) ? Number(obj.groundAltitudeFt) : null,
        modelGroundClearanceFt: Number.isFinite(Number(obj.modelGroundClearanceFt)) ? Number(obj.modelGroundClearanceFt) : null
      })),
      error: acknowledgedObjects.length ? '' : 'spawn_failed'
    });
    return { spawned: acknowledgedObjects.length };
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
    const doorEnabled = command?.openDoor !== false && command?.door !== false;
    const doorIndex = clampInt(command?.doorIndex ?? 1, 0, 8);
    const doorProfile = resolveDoorProfile(command);
    let doorOpened = false;
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
        doorOpened = true;
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
        doorOpened = false;
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
      if (doorOpened) await setUserAircraftDoor(false, doorIndex, 'manual-pax-finally-close', doorProfile);
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
    markSceneObjectDesiredState(command, true);
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
          await stabilizeSceneGroundObject(objectId, candidate, p);
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
    const dedupedObjects = dedupeSceneObjects(sceneId, objects, 'scene-spawn-semantic-dedupe');
    objects.splice(0, objects.length, ...dedupedObjects);
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
      objects: objects.map(o => ({
        objectId: o.objectId,
        index: o.index,
        kind: o.kind,
        title: o.title,
        objectKey: o.objectKey || '',
        itemId: o.itemId || o.cargoItemId || '',
        groundStabilized: o.groundStabilized === true,
        groundAltitudeFt: Number.isFinite(Number(o.groundAltitudeFt)) ? Number(o.groundAltitudeFt) : null,
        modelGroundClearanceFt: Number.isFinite(Number(o.modelGroundClearanceFt)) ? Number(o.modelGroundClearanceFt) : null
      }))
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
    activeGroundVisitScenes.clear();
    activeManualPaxScenes.clear();
    cancelAllGroundVisitReleases(reason);
    debugLog(`TRACKED_CLEAR_OK reason=${reason} cleared=${cleared}`);
    return { cleared };
  };

  const applyAircraftVarSetCommand = async (command) => {
    const commandId = command?.commandId || null;
    const name = String(command?.name || command?.varName || command?.simVar || '').trim();
    const units = String(command?.units || command?.unit || 'number').trim() || 'number';
    const value = Number(command?.value ?? 0);
    const reason = String(command?.reason || 'aircraft-var-set').trim() || 'aircraft-var-set';
    if (!name || !Number.isFinite(value)) {
      sendAck({
        type: 'aircraft_var_set_ack',
        commandId,
        status: 'error',
        name,
        units,
        value: Number.isFinite(value) ? value : null,
        reason,
        error: !name ? 'missing_name' : 'invalid_value'
      });
      return false;
    }
    debugLog(`COMMAND aircraft_var_set name=${name} units=${units} value=${value} reason=${reason}`);
    const ok = setNamedVarValue(name, value, units, reason);
    sendAck({
      type: 'aircraft_var_set_ack',
      commandId,
      status: ok ? 'ok' : 'error',
      name,
      units,
      value,
      reason,
      error: ok ? '' : 'set_failed'
    });
    return ok;
  };

  const applyAircraftInputEventSetCommand = async (command) => {
    const commandId = command?.commandId || null;
    const names = uniqueStrings(
      (Array.isArray(command?.names) ? command.names : [command?.name || command?.eventName || command?.inputEvent])
        .map(v => String(v || '').trim())
        .filter(Boolean)
    );
    const value = Number(command?.value ?? 1);
    const reason = String(command?.reason || 'aircraft-input-event-set').trim() || 'aircraft-input-event-set';
    if (!names.length || !Number.isFinite(value)) {
      sendAck({
        type: 'aircraft_input_event_set_ack',
        commandId,
        status: 'error',
        names,
        value: Number.isFinite(value) ? value : null,
        reason,
        error: !names.length ? 'missing_name' : 'invalid_value'
      });
      return false;
    }
    debugLog(`COMMAND aircraft_input_event_set names=${names.join(',')} value=${value} reason=${reason}`);
    const ok = await setInputEventByNameCandidates(names, value, reason);
    sendAck({
      type: 'aircraft_input_event_set_ack',
      commandId,
      status: ok ? 'ok' : 'error',
      names,
      value,
      reason,
      error: ok ? '' : 'set_failed'
    });
    return ok;
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
      stabilizeSceneGroundObject(objectId, spawnedObj.title, spawnedObj).catch((err) => {
        debugLog(`SCENE_GROUND_LATE_ERROR objectId=${objectId} title="${spawnedObj.title || ''}" error=${err?.message || err}`);
      });
      debugLog(`ASSIGNED_LATE_TRACKED requestId=${recv.requestID} objectId=${objectId} scene=${late.sceneId || ''} kind=${spawnedObj.kind || ''} title="${spawnedObj.title || ''}" reason=${late.reason || ''}`);
    }
  });

  handle.on('simObjectData', (recv) => {
    const groundPending = pendingSceneGroundReads.get(recv.requestID);
    if (groundPending) {
      pendingSceneGroundReads.delete(recv.requestID);
      clearTimeout(groundPending.timer);
      try {
        const readFn = typeof recv?.data?.readFloat64 === 'function'
          ? recv.data.readFloat64.bind(recv.data)
          : recv.data.readDouble.bind(recv.data);
        const altitudeFt = Number(readFn());
        if (!Number.isFinite(altitudeFt)) throw new Error('scene_ground_altitude_invalid');
        groundPending.resolve(altitudeFt);
      } catch (err) {
        groundPending.reject(err);
      }
      return;
    }
    const pending = pendingPayloadReads.get(recv.requestID);
    if (!pending) return;
    pendingPayloadReads.delete(recv.requestID);
    clearTimeout(pending.timer);
    try {
      const readString = () => {
        if (typeof recv?.data?.readString256 === 'function') return String(recv.data.readString256() || '').trim();
        if (typeof recv?.data?.readString === 'function') return String(recv.data.readString(256) || '').trim();
        throw new Error('payload_read_string_fn_missing');
      };
      const readFn = (typeof recv?.data?.readFloat64 === 'function')
        ? (() => recv.data.readFloat64())
        : ((typeof recv?.data?.readDouble === 'function') ? (() => recv.data.readDouble()) : null);
      if (!readFn) throw new Error('payload_read_fn_missing');
      const aircraft = {
        title: readString(),
        model: readString(),
        type: readString()
      };
      const totalWeightLbs = Number(readFn());
      const emptyWeightLbs = Number(readFn());
      const standardFuelWeightLbs = Number(readFn());
      const fuelWeightPerGallonLbs = Number(readFn());
      const payloadStationCountReported = clampPayloadStationCount(Number(readFn()), pending.stationCount);
      const stations = [];
      for (let i = 1; i <= pending.stationCount; i += 1) {
        const weight = Number(readFn());
        stations.push({
          index: i,
          weightLbs: Number.isFinite(weight) ? Math.round(weight * 10) / 10 : null
        });
      }
      const pa24Raw = {};
      PA24_PAYLOAD_LVARS.forEach((entry) => {
        pa24Raw[entry.key] = Number(readFn());
      });
      const knownStations = stations.filter(s => s.index <= payloadStationCountReported);
      const stationPayloadWeightLbs = knownStations.reduce((sum, s) => sum + (Number.isFinite(Number(s.weightLbs)) ? Number(s.weightLbs) : 0), 0);
      const payloadAdapter = detectPayloadAdapter(aircraft);
      currentPayloadAdapter = payloadAdapter;
      const isPa24 = payloadAdapter === PA24_PAYLOAD_ADAPTER;
      const fuelData = resolveFuelWeightData(
        standardFuelWeightLbs,
        fuelWeightPerGallonLbs,
        pa24Raw,
        isPa24
      );
      const pa24 = isPa24 ? {
        seats: {
          1: Math.round(Number(pa24Raw.Seat1Character) || 0),
          2: Math.round(Number(pa24Raw.Seat2Character) || 0),
          3: Math.round(Number(pa24Raw.Seat3Character) || 0),
          4: Math.round(Number(pa24Raw.Seat4Character) || 0)
        },
        characterWeights: {
          1: Math.round((Number(pa24Raw.Character1Weight) || 0) * 10) / 10,
          2: Math.round((Number(pa24Raw.Character2Weight) || 0) * 10) / 10,
          3: Math.round((Number(pa24Raw.Character3Weight) || 0) * 10) / 10,
          4: Math.round((Number(pa24Raw.Character4Weight) || 0) * 10) / 10
        },
        baggageWeightLbs: Math.round((Number(pa24Raw.BaggageWeight) || 0) * 10) / 10,
        baggageAWeightLbs: Math.round((Number(pa24Raw.BaggageAWeight) || 0) * 10) / 10,
        baggageBWeightLbs: Math.round((Number(pa24Raw.BaggageBWeight) || 0) * 10) / 10,
        baggageCWeightLbs: Math.round((Number(pa24Raw.BaggageCWeight) || 0) * 10) / 10,
        payloadWeightLbs: Math.round((Number(pa24Raw.PayloadWeight) || 0) * 10) / 10,
        totalWeightLbs: Math.round((Number(pa24Raw.TotalWeight) || 0) * 10) / 10,
        grossWeightLbs: Math.round((Number(pa24Raw.GrossWeight) || 0) * 10) / 10,
        emptyWeightLbs: Math.round((Number(pa24Raw.EmptyWeight) || 0) * 10) / 10,
        fuelTanksGallons: {
          leftWing: Math.round((Number(pa24Raw.FuelLeftWingTank) || 0) * 10) / 10,
          rightWing: Math.round((Number(pa24Raw.FuelRightWingTank) || 0) * 10) / 10,
          leftTip: Math.round((Number(pa24Raw.FuelLeftTipTank) || 0) * 10) / 10,
          rightTip: Math.round((Number(pa24Raw.FuelRightTipTank) || 0) * 10) / 10
        },
        fuelTotalGallons: fuelData.fuelTotalGallons,
        fuelWeightPerGallonLbs: fuelData.fuelWeightPerGallonLbs
      } : null;
      pending.resolve({
        payloadAdapter,
        aircraft,
        pa24,
        totalWeightLbs: isPa24 && Number.isFinite(pa24?.totalWeightLbs)
          ? pa24.totalWeightLbs
          : (Number.isFinite(totalWeightLbs) ? Math.round(totalWeightLbs * 10) / 10 : null),
        emptyWeightLbs: isPa24 && Number.isFinite(pa24?.emptyWeightLbs)
          ? pa24.emptyWeightLbs
          : (Number.isFinite(emptyWeightLbs) ? Math.round(emptyWeightLbs * 10) / 10 : null),
        fuelWeightLbs: fuelData.fuelWeightLbs,
        fuelTotalGallons: fuelData.fuelTotalGallons,
        fuelWeightPerGallonLbs: fuelData.fuelWeightPerGallonLbs,
        fuelSource: fuelData.fuelSource,
        payloadWeightLbs: isPa24 && Number.isFinite(pa24?.payloadWeightLbs)
          ? pa24.payloadWeightLbs
          : Math.round(stationPayloadWeightLbs * 10) / 10,
        stationPayloadWeightLbs: Math.round(stationPayloadWeightLbs * 10) / 10,
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
    const groundEntry = [...pendingSceneGroundReads.entries()]
      .find(([, pending]) => pending?.sendId != null && Number(pending.sendId) === Number(recv.sendId));
    if (groundEntry) {
      const [requestId, pending] = groundEntry;
      pendingSceneGroundReads.delete(requestId);
      clearTimeout(pending.timer);
      pending.reject(new Error(name));
      debugLog(`SCENE_GROUND_EXCEPTION objectId=${pending.objectId || ''} sendId=${recv.sendId ?? ''} error=${name}`);
      return;
    }
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

  const authorityAckType = (type) => {
    const normalized = String(type || '').trim().toLowerCase();
    if (normalized === 'mission_scene_clear_all') return 'mission_scene_clear_ack';
    return normalized ? `${normalized}_ack` : 'mission_authority_rejected_ack';
  };

  const sendAuthorityResult = (type, command, result = {}) => {
    sendAck({
      ...(result?.replayAck && typeof result.replayAck === 'object' ? result.replayAck : {}),
      type: authorityAckType(type),
      commandId: command?.commandId || null,
      missionId: command?.missionId || result?.activeRun?.missionId || '',
      runId: command?.runId || result?.activeRun?.runId || '',
      status: result?.status || (result?.ok ? 'ok' : 'error'),
      error: result?.error || '',
      reason: result?.reason || command?.reason || '',
      previousOwnerClientId: result?.previousOwnerClientId || undefined,
      outcome: result?.outcome || undefined,
      resumed: result?.resumed === true,
      authoritativeRun: result?.activeRun || null,
      releasedRun: result?.releasedRun || null,
      resumeBundle: result?.resumeBundle || undefined,
      effect: result?.effect || undefined,
      deduplicated: result?.duplicate === true
    });
  };

  const clearAuthorityRunEffects = async (missionId, reason = 'mission-authority-release') => {
    const matchingSceneIds = [...scenes.values()]
      .filter(rec => String(rec?.missionId || '') === String(missionId || ''))
      .map(rec => String(rec?.sceneId || ''))
      .filter(Boolean);
    cancelAllDeboardingContinuations(reason);
    cancelAllGroundVisitReleases(reason);
    const results = await Promise.all([
      clearMission(missionId, reason),
      ...matchingSceneIds.map(sceneId => enqueueSceneOperation(sceneId, () => clearScene(sceneId, reason, null)))
    ]);
    return results.reduce((sum, item) => sum + Number(item?.cleared || 0), 0);
  };

  const logAuthorityMapProjection = (command = {}, result = null) => {
    if (!result?.ok) return;
    const projected = projectTrackerMapSnapshot(
      missionAuthority.getActiveRun({ includeBundle: true }),
      typeof getLastGpsMsg === 'function' ? getLastGpsMsg() : null
    );
    const signature = projected ? JSON.stringify({
      missionId: projected.missionId,
      runId: projected.runId,
      route: (projected.route?.waypoints || []).map(point => [point.lat, point.lon]),
      profileMode: projected.profile?.mode || 'none',
      profilePoints: projected.profile?.points?.length || 0
    }) : 'none';
    if (signature === lastAuthorityMapProjectionSignature) return;
    lastAuthorityMapProjectionSignature = signature;
    debugLog(`MISSION_MAP_AUTHORITY mission=${projected?.missionId || command?.missionId || ''} run=${projected?.runId || command?.runId || ''} revision=${projected?.revision || result?.activeRun?.revision || 0} routePoints=${projected?.route?.waypoints?.length || 0} profileMode=${projected?.profile?.mode || 'none'} profilePoints=${projected?.profile?.points?.length || 0} terrain=${projected?.profile?.terrainAvailable === true ? 1 : 0} reason=${command?.reason || command?.type || 'authority-update'}`);
  };

  const handleAuthorityCommand = (type, command) => {
    if (!missionAuthority) return false;
    if (authorityReleasePending && type !== 'mission_snapshot_request' && type !== 'mission_authority_release') {
      sendAuthorityResult(type, command, {
        ok: false,
        status: 'conflict',
        error: 'mission_authority_release_pending',
        activeRun: missionAuthority.getActiveRun()
      });
      return true;
    }
    if (type === 'mission_authority_acquire') {
      try {
        const result = missionAuthority.acquire(command);
        logAuthorityMapProjection(command, result);
        sendAuthorityResult(type, command, result);
      } catch (error) {
        sendAuthorityResult(type, command, { ok: false, status: 'error', error: error?.code || error?.message || String(error) });
      }
      return true;
    }
    if (type === 'mission_authority_takeover') {
      sendAuthorityResult(type, command, missionAuthority.takeover(command));
      return true;
    }
    if (type === 'mission_snapshot_request') {
      sendAuthorityResult(type, command, missionAuthority.requestSnapshot(command));
      return true;
    }
    if (type === 'mission_snapshot_update') {
      const result = missionAuthority.updateSnapshot(command);
      logAuthorityMapProjection(command, result);
      sendAuthorityResult(type, command, result);
      return true;
    }
    if (type === 'mission_authority_release') {
      if (authorityReleasePending) {
        sendAuthorityResult(type, command, { ok: false, status: 'noop', error: 'release_pending', activeRun: missionAuthority.getActiveRun() });
        return true;
      }
      const validation = missionAuthority.validate({ ...command, type: 'mission_lifecycle' });
      if (!validation.ok) {
        sendAuthorityResult(type, command, validation);
        return true;
      }
      authorityReleasePending = true;
      clearAuthorityRunEffects(command?.missionId, command?.reason || 'mission-authority-release')
        .then((cleared) => {
          const result = missionAuthority.release(command);
          sendAck({
            type: 'mission_authority_release_ack',
            commandId: command?.commandId || null,
            missionId: command?.missionId || '',
            runId: command?.runId || '',
            status: result?.status || (result?.ok ? 'ok' : 'error'),
            error: result?.error || '',
            outcome: result?.outcome || command?.outcome || '',
            cleared,
            releasedRun: result?.releasedRun || null,
            authoritativeRun: result?.activeRun || null
          });
        })
        .catch((error) => {
          sendAuthorityResult(type, command, { ok: false, status: 'error', error: error?.message || String(error), activeRun: missionAuthority.getActiveRun() });
        })
        .finally(() => { authorityReleasePending = false; });
      return true;
    }
    return false;
  };

  return {
    handleCommand(command) {
      const type = String(command?.type || command?.command || '').trim();
      if (handleAuthorityCommand(type, command)) return true;
      if (authorityReleasePending && (/^mission_(scene|smoke)_/i.test(type) || type === 'mission_lifecycle')) {
        sendAuthorityResult(type, command, { ok: false, status: 'conflict', error: 'mission_authority_release_pending', activeRun: missionAuthority?.getActiveRun?.() || null });
        return true;
      }
      const authorityValidation = missionAuthority?.validate?.(command);
      if (authorityValidation && !authorityValidation.ok) {
        sendAuthorityResult(type, command, authorityValidation);
        return true;
      }
      if (/^mission_(scene|smoke)_/i.test(type) || type === 'mission_lifecycle') rememberMissionCommand(command);
      if (type === 'mission_lifecycle') {
        const lifecycleTerminal = /^(ended|closed|reset|cleared)$/i.test(String(command?.state || ''));
        if (lifecycleTerminal || /^closing$/i.test(String(command?.state || ''))) {
          cancelAllDeboardingContinuations(command?.reason || `mission-${command?.state || 'ended'}`);
          cancelAllGroundVisitReleases(command?.reason || `mission-${command?.state || 'ended'}`);
        }
        const legacyRelease = lifecycleTerminal && authorityValidation?.legacy === true
          ? missionAuthority?.releaseLegacy?.(command)
          : null;
        sendAck({
          type: 'mission_lifecycle_ack',
          commandId: command?.commandId || null,
          missionId: command?.missionId || '',
          status: 'ok',
          state: command?.state || '',
          phase: command?.missionPhase || '',
          reason: command?.reason || 'mission-lifecycle',
          authorityReleased: legacyRelease?.ok === true,
          releasedRun: legacyRelease?.releasedRun || null
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
        markSceneObjectDesiredState(command, false);
        enqueueSceneObjectOperation(command, () => removeSceneObjectsBySelector(command));
        return true;
      }
      if (type === 'mission_scene_object_spawn') {
        const sceneId = command?.sceneId || 'mission-scene';
        debugLog(`COMMAND mission_scene_object_spawn scene=${sceneId} items=${Array.isArray(command?.items) ? command.items.length : 0}`);
        markSceneObjectDesiredState(command, true);
        enqueueSceneObjectOperation(command, () => spawnSceneObjectsAppend(command));
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
      if (type === 'mission_scene_deboarding_continue') {
        const sceneId = command?.sceneId || 'mission-scene';
        debugLog(`COMMAND mission_scene_deboarding_continue scene=${sceneId} deboardingCommandId=${command?.deboardingCommandId || ''}`);
        resolveDeboardingContinuation(command, 'continue');
        return true;
      }
      if (type === 'mission_scene_deboarding_cancel') {
        const sceneId = command?.sceneId || 'mission-scene';
        debugLog(`COMMAND mission_scene_deboarding_cancel scene=${sceneId} deboardingCommandId=${command?.deboardingCommandId || ''}`);
        resolveDeboardingContinuation(command, 'cancel');
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
      if (type === 'mission_scene_ground_visit_release') {
        const sceneId = command?.sceneId || 'mission-scene-ground-visit';
        debugLog(`COMMAND mission_scene_ground_visit_release scene=${sceneId} visitCommandId=${command?.visitCommandId || ''}`);
        resolveGroundVisitRelease(command, 'release');
        return true;
      }
      if (type === 'mission_scene_ground_visit') {
        const sceneId = command?.sceneId || 'mission-scene-ground-visit';
        debugLog(`COMMAND mission_scene_ground_visit scene=${sceneId} visitors=${Array.isArray(command?.visitorPaths) ? command.visitorPaths.length : 0}`);
        // Nicht in die globale Boarding-/Deboarding-Queue einreihen: Die
        // Kontrolleure duerfen waehrend Farewell und Deboarding schon anlaufen.
        animateMissionSceneGroundVisit(command).catch(err => {
          trackerWarn(`⚠️  Ground visit failed: ${err?.message || err}`);
          sendAck({
            type: 'mission_scene_ground_visit_ack',
            commandId: command?.commandId || null,
            sceneId,
            missionId: command?.missionId || '',
            status: 'error',
            error: err?.message || String(err)
          });
        });
        return true;
      }
      if (type === 'mission_scene_clear') {
        const sceneId = command?.sceneId || 'mission-scene';
        debugLog(`COMMAND mission_scene_clear scene=${sceneId}`);
        cancelDeboardingContinuationsForScene(sceneId, command?.reason || 'command');
        cancelGroundVisitReleasesForScene(sceneId, command?.reason || 'command');
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
        cancelAllDeboardingContinuations(command?.reason || 'command-all');
        cancelAllGroundVisitReleases(command?.reason || 'command-all');
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
      if (type === 'aircraft_var_set') {
        applyAircraftVarSetCommand(command).catch((err) => {
          sendAck({
            type: 'aircraft_var_set_ack',
            commandId: command?.commandId || null,
            status: 'error',
            name: command?.name || command?.varName || command?.simVar || '',
            units: command?.units || command?.unit || 'number',
            value: Number.isFinite(Number(command?.value)) ? Number(command.value) : null,
            reason: command?.reason || 'aircraft-var-set',
            error: err?.message || String(err)
          });
        });
        return true;
      }
      if (type === 'aircraft_input_event_set') {
        applyAircraftInputEventSetCommand(command).catch((err) => {
          sendAck({
            type: 'aircraft_input_event_set_ack',
            commandId: command?.commandId || null,
            status: 'error',
            names: Array.isArray(command?.names) ? command.names : [command?.name || command?.eventName || command?.inputEvent || ''].filter(Boolean),
            value: Number.isFinite(Number(command?.value)) ? Number(command.value) : null,
            reason: command?.reason || 'aircraft-input-event-set',
            error: err?.message || String(err)
          });
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
        const requestedAdapter = String(command?.payloadAdapter || command?.adapter || '').trim();
        const pa24State = command?.pa24State && typeof command.pa24State === 'object' ? command.pa24State : null;
        debugLog(`COMMAND aircraft_payload_set adapter=${requestedAdapter || 'auto'} stations=${stations.length} maxStations=${maxStations}`);
        requestPayloadSnapshot(maxStations)
          .then((before) => {
            if (requestedAdapter === PA24_PAYLOAD_ADAPTER || pa24State) {
              if (before?.payloadAdapter !== PA24_PAYLOAD_ADAPTER) {
                throw new Error(`pa24_adapter_aircraft_mismatch:${before?.aircraft?.title || 'unknown'}`);
              }
              return applyPa24PayloadState(pa24State, before?.pa24).then(result => ({ result, before }));
            }
            if (before?.payloadAdapter === PA24_PAYLOAD_ADAPTER) {
              throw new Error('pa24_adapter_state_required');
            }
            return applyPayloadStations(stations).then(result => ({ result, before }));
          })
          .then(({ result, before }) => sleep(before?.payloadAdapter === PA24_PAYLOAD_ADAPTER ? 350 : 0)
            .then(() => requestPayloadSnapshot(maxStations))
            .then(snapshot => ({ result, snapshot })))
          .then(({ result, snapshot }) => {
            sendAck({
              type: 'aircraft_payload_set_ack',
              commandId,
              status: 'ok',
              payloadAdapter: snapshot?.payloadAdapter || requestedAdapter || 'msfs_payload_stations',
              changedStations: Array.isArray(result?.stations) ? result.stations.length : 0,
              appliedStations: result?.stations || [],
              appliedPa24State: result?.state || null,
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
      const activeRun = missionAuthority?.getActiveRun?.() || null;
      return activeRun?.missionId ? enrichMissionStatusWithScenes(activeRun) : null;
    },
    getMissionAuthoritySnapshot() {
      return missionAuthority?.getPublicSnapshot?.() || null;
    },
    getPayloadAdapter() {
      return currentPayloadAdapter;
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
  debugLog(`START ${TRACKER_DISPLAY_NAME} dataDir=${TRACKER_DATA_DIR} debugFile=${TRACKER_DEBUG_FILE}`);
  for (const event of TRACKER_STORAGE.events) debugLog(event);
  const missionAuthorityManager = createMissionAuthorityManager({
    storageFile: MISSION_AUTHORITY_FILE,
    log: debugLog
  });
  let _reconnecting = false;
  let _reconnectTimer = null;
  let _simStarted = false;
  let _wsAttempt = 0;
  let _currentWs = null;
  let _trackerCommandHandler = null;
  const _pendingTrackerCommands = [];
  const MAX_PENDING_TRACKER_COMMANDS = 64;
  const DIRECT_HANGAR_FALLBACK_DELAY_MS = 750;
  const _pendingDirectHangarCommands = new Map();
  const _dispatchedHangarCommandIds = new Map();
  const _directHangarAckCommandIds = new Map();
  let _homebaseFallbackCache = null;
  let _relayConnected = false;
  let _simulatorConnected = false;
  let _lastEfbSnapshot = null;
  let _lastEfbMissionSnapshot = missionAuthorityManager.getActiveRun();
  let _efbHttpServer = null;
  const updateEfbState = (patch = {}) => {
    if (Object.hasOwn(patch, 'relayConnected')) _relayConnected = patch.relayConnected === true;
    if (Object.hasOwn(patch, 'simulatorConnected')) _simulatorConnected = patch.simulatorConnected === true;
    if (Object.hasOwn(patch, 'snapshot')) _lastEfbSnapshot = patch.snapshot && typeof patch.snapshot === 'object' ? patch.snapshot : null;
    if (Object.hasOwn(patch, 'missionSnapshot')) _lastEfbMissionSnapshot = patch.missionSnapshot && typeof patch.missionSnapshot === 'object' ? patch.missionSnapshot : null;
  };
  try {
    const configuredPort = Number(process.env.VFR_MULTITOOL_EFB_PORT || DEFAULT_EFB_HTTP_PORT);
    _efbHttpServer = createTrackerEfbHttpServer({
      port: configuredPort,
      hello: TRACKER_EFB_HTTP_HELLO,
      getStatus: () => ({
        trackerVersion: TRACKER_VERSION,
        trackerVersionCode: TRACKER_VERSION_CODE,
        runtimeChannel: TRACKER_RUNTIME_CHANNEL,
        relayConnected: _relayConnected,
        simulatorConnected: _simulatorConnected,
        telemetryAvailable: Boolean(_lastEfbSnapshot),
        lastSnapshotAt: Number(_lastEfbSnapshot?.capturedAt) || null,
        missionAvailable: Boolean(_lastEfbMissionSnapshot),
        lastMissionSnapshotAt: Number(_lastEfbMissionSnapshot?.updatedAt) || null
      }),
      getSnapshot: () => _lastEfbSnapshot,
      getMapSnapshot: () => projectTrackerMapSnapshot(
        missionAuthorityManager.getActiveRun({ includeBundle: true }),
        _lastEfbSnapshot
      ),
      getMissionSnapshot: () => ({
        ...(_lastEfbMissionSnapshot || {}),
        authoritySnapshot: missionAuthorityManager.getPublicSnapshot()
      }),
      log: debugLog
    });
    _efbHttpServer.start().then((address) => {
      trackerLog(`📟 EFB-Schnittstelle bereit: http://127.0.0.1:${address.port}`);
    }).catch((error) => {
      _efbHttpServer = null;
      trackerWarn(`⚠️  Lokale EFB-Schnittstelle nicht verfügbar: ${error?.message || error}`);
      debugLog(`EFB_HTTP_START_ERROR error=${error?.message || error}`);
    });
  } catch (error) {
    trackerWarn(`⚠️  Lokale EFB-Schnittstelle konnte nicht vorbereitet werden: ${error?.message || error}`);
    debugLog(`EFB_HTTP_CONFIG_ERROR error=${error?.message || error}`);
  }
  const isHomebaseObjectControlType = (type) => [
    'homebase_v1.hangar.animation.set',
    'homebase_v1.object.control.set',
    'homebase_v1.door_automation.set'
  ].includes(String(type || '').trim());
  const controlAckTypeFor = (type) => String(type || '') === 'homebase_v1.object.control.set'
    ? 'homebase_v1.object.control.set_ack'
    : String(type || '') === 'homebase_v1.door_automation.set'
      ? 'homebase_v1.door_automation.set_ack'
      : 'homebase_v1.hangar.animation.set_ack';

  const getWs = () => _currentWs;
  const readCurrentHomebaseFallback = () => {
    const config = readTrackerConfig();
    const candidate = config?.homebaseFallback;
    if (!candidate) {
      _homebaseFallbackCache = null;
      return null;
    }
    const result = compatibleHomebaseFallbackCache(candidate, { pilotId: syncId, trackerVersionCode: TRACKER_VERSION_CODE });
    if (result.ok) {
      _homebaseFallbackCache = result.cache;
      return _homebaseFallbackCache;
    }
    delete config.homebaseFallback;
    writeTrackerConfig(config);
    _homebaseFallbackCache = null;
    debugLog(`HOMEBASE_FALLBACK_DISCARD reason=${result.reason || 'incompatible'}`);
    return null;
  };
  readCurrentHomebaseFallback();
  const sendHomebaseAck = (payload = {}) => {
    const ws = getWs();
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      const commandId = String(payload?.commandId || '');
      const directHangarAck = commandId && _directHangarAckCommandIds.has(commandId);
      const message = {
        type: 'gps',
        syncId,
        pin,
        trackerVersion: TRACKER_VERSION,
        trackerVersionCode: TRACKER_VERSION_CODE,
        commandAckOnly: true,
        trackerAck: { source: 'tracker', ...payload, at: Date.now() }
      };
      if (directHangarAck) {
        message.target = 'workbench';
        message.stabilizerAck = { ...payload, at: Date.now() };
      }
      ws.send(JSON.stringify(message));
      const errorDetails = payload?.status === 'error' ? JSON.stringify({
        error: payload?.error || payload?.message || '',
        failedObjects: Array.isArray(payload?.failedObjects) ? payload.failedObjects.slice(0, 5) : [],
        failedPeople: Array.isArray(payload?.failedPeople) ? payload.failedPeople.slice(0, 3) : []
      }).slice(0, 4000) : '';
      debugLog(`HOMEBASE_ACK type=${payload?.type || 'unknown'} status=${payload?.status || ''} commandId=${payload?.commandId || ''}${errorDetails ? ` details=${errorDetails}` : ''}`);
      if (directHangarAck) debugLog(`HANGAR_DIRECT_ACK type=${payload?.type || 'unknown'} commandId=${commandId}`);
      return true;
    } catch (error) {
      debugLog(`HOMEBASE_ACK_ERROR type=${payload?.type || 'unknown'} error=${error?.message || error}`);
      return false;
    }
  };
  const homebasePackageService = HOMEBASE_ENABLED
    ? createHomebasePackageService({
        runtimeDir: TRACKER_DATA_DIR,
        sendAck: sendHomebaseAck,
        log: debugLog
      })
    : null;
  const handleAlwaysAvailableHomebaseCommand = (command) => {
    if (!HOMEBASE_ENABLED || !homebasePackageService) return false;
    const type = String(command?.type || '');
    if (type === 'homebase_v1.fallback.store') {
      try {
        const cache = normalizeHomebaseFallbackCache(command?.cache, {
          pilotId: syncId,
          trackerVersionCode: TRACKER_VERSION_CODE,
          savedAt: Date.now()
        });
        const config = readTrackerConfig();
        config.homebaseFallback = cache;
        if (!writeTrackerConfig(config)) throw new Error('Tracker-Konfiguration konnte nicht geschrieben werden.');
        _homebaseFallbackCache = cache;
        sendHomebaseAck({
          type: 'homebase_v1.fallback.store_ack',
          commandId: command?.commandId || null,
          status: 'ok',
          message: 'Homebase-Fallback wurde im Tracker gespeichert.',
          sceneSignature: cache.sceneSignature,
          savedAt: cache.savedAt
        });
        debugLog(`HOMEBASE_FALLBACK_STORE signature=${cache.sceneSignature} objects=${cache.objects.length} people=${cache.people.length}`);
      } catch (error) {
        sendHomebaseAck({
          type: 'homebase_v1.fallback.store_ack',
          commandId: command?.commandId || null,
          status: 'error',
          error: error?.message || String(error),
          message: error?.message || String(error)
        });
      }
      return true;
    }
    if (type === 'homebase_v1.fallback.clear') {
      const config = readTrackerConfig();
      delete config.homebaseFallback;
      const ok = writeTrackerConfig(config);
      _homebaseFallbackCache = null;
      sendHomebaseAck({
        type: 'homebase_v1.fallback.clear_ack',
        commandId: command?.commandId || null,
        status: ok ? 'ok' : 'error',
        message: ok ? 'Homebase-Fallback wurde aus dem Tracker entfernt.' : 'Homebase-Fallback konnte nicht entfernt werden.'
      });
      return true;
    }
    if (homebasePackageService.handleCommand(command)) return true;
    if (type === 'homebase_v1.capabilities' && typeof _trackerCommandHandler !== 'function') {
      sendHomebaseAck({
        type: 'homebase_v1.capabilities_ack',
        commandId: command?.commandId || null,
        status: 'ok',
        protocol: 1,
        simConnected: false,
        assetPackageVersion: homebaseAssetCatalog.assetPackageVersion,
        capabilities: [...homebasePackageService.capabilities, 'homebase-fallback-cache-v1', 'homebase-fallback-control-state-v1']
      });
      return true;
    }
    return false;
  };
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
  const pruneHangarCommandState = (now = Date.now()) => {
    for (const [commandId, at] of _dispatchedHangarCommandIds) {
      if ((now - at) > 30000) _dispatchedHangarCommandIds.delete(commandId);
    }
    for (const [commandId, at] of _directHangarAckCommandIds) {
      if ((now - at) > 30000) _directHangarAckCommandIds.delete(commandId);
    }
  };
  const dispatchTrackerCommand = (command, source = 'tracker-relay') => {
    const type = String(command?.type || '');
    const commandId = String(command?.commandId || '');
    const isHangarDoor = isHomebaseObjectControlType(type);
    pruneHangarCommandState();
    if (isHangarDoor && commandId) {
      if (_dispatchedHangarCommandIds.has(commandId)) {
        debugLog(`HANGAR_COMMAND_DUPLICATE_SKIP source=${source} commandId=${commandId}`);
        return;
      }
      _dispatchedHangarCommandIds.set(commandId, Date.now());
      if (source === 'direct-stabilizer-fallback') _directHangarAckCommandIds.set(commandId, Date.now());
      debugLog(`HOMEBASE_CONTROL_DISPATCH source=${source} type=${type} commandId=${commandId} controlId=${command?.controlId || 'door'} state=${command?.state || ''}`);
    }
    if (handleAlwaysAvailableHomebaseCommand(command)) return;
    if (typeof _trackerCommandHandler === 'function') {
      try {
        const handled = _trackerCommandHandler(command);
        if (isHangarDoor && handled === false) {
          debugLog(`HANGAR_COMMAND_REJECT commandId=${commandId || 'none'} reason=no-handler-accepted-command`);
          sendHomebaseAck({
            type: controlAckTypeFor(type),
            commandId: commandId || null,
            status: 'error',
            error: 'Der Tracker konnte die Objektsteuerung keinem SimConnect-Handler zuordnen.',
            message: 'Der Tracker konnte die Objektsteuerung keinem SimConnect-Handler zuordnen.'
          });
        }
      } catch (error) {
        debugLog(`COMMAND_DISPATCH_ERROR type=${type || 'unknown'} commandId=${commandId || 'none'} error=${error?.message || error}`);
        if (isHangarDoor) {
          sendHomebaseAck({
            type: controlAckTypeFor(type),
            commandId: commandId || null,
            status: 'error',
            error: error?.message || String(error),
            message: error?.message || String(error)
          });
        }
      }
      return;
    }
    if (isHangarDoor) {
      debugLog(`HANGAR_COMMAND_REJECT commandId=${commandId || 'none'} reason=simconnect-handler-not-ready`);
      sendHomebaseAck({
        type: controlAckTypeFor(type),
        commandId: commandId || null,
        status: 'error',
        error: 'SimConnect ist für die Objektsteuerung noch nicht bereit.',
        message: 'SimConnect ist für die Objektsteuerung noch nicht bereit.'
      });
      return;
    }
    if (_pendingTrackerCommands.length >= MAX_PENDING_TRACKER_COMMANDS) _pendingTrackerCommands.shift();
    _pendingTrackerCommands.push(command);
    debugLog(`COMMAND_QUEUE_BUFFERED type=${command?.type || 'unknown'} size=${_pendingTrackerCommands.length}`);
  };
  const handleTrackerMessage = (raw) => {
    let data = null;
    const rawText = String(raw || '');
    try {
      data = JSON.parse(rawText);
    } catch (error) {
      debugLog(`RELAY_MESSAGE_PARSE_REJECT bytes=${Buffer.byteLength(rawText)} error=${error?.message || error}`);
      return;
    }
    const parseEmbeddedCommand = (candidate) => {
      if (candidate && typeof candidate === 'object') return candidate;
      if (typeof candidate !== 'string' || !candidate.trim()) return null;
      try {
        const parsed = JSON.parse(candidate);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (_) {
        return null;
      }
    };
    const target = String(data?.target || '').trim().toLowerCase();
    const embeddedTrackerCommand = parseEmbeddedCommand(data?.trackerCommand);
    const trackerCommand = embeddedTrackerCommand || (target === 'tracker' && !data?.trackerCommand ? data : null);
    const embeddedStabilizerCommand = parseEmbeddedCommand(data?.stabilizerCommand);
    const stabilizerCommand = isHomebaseObjectControlType(embeddedStabilizerCommand?.type)
      ? embeddedStabilizerCommand
      : null;
    const command = trackerCommand || stabilizerCommand;
    if (!command || typeof command !== 'object') return;
    const commandType = String(command?.type || '').trim();
    const commandId = String(command?.commandId || '');
    const envelope = trackerCommand ? 'trackerCommand' : 'stabilizerCommand';
    debugLog(`RELAY_COMMAND_RX envelope=${envelope} target=${target || 'none'} type=${commandType || 'unknown'} commandId=${commandId || 'none'} outerPin=${data?.pin ? 'present' : 'none'} commandPin=${command?.pin ? 'present' : 'none'}`);
    if (data.syncId && String(data.syncId) !== String(syncId)) {
      debugLog(`RELAY_COMMAND_REJECT type=${commandType || 'unknown'} commandId=${commandId || 'none'} reason=sync-id-mismatch`);
      return;
    }
    if (data.pin && String(data.pin) !== String(pin)) {
      debugLog(`RELAY_COMMAND_REJECT type=${commandType || 'unknown'} commandId=${commandId || 'none'} reason=outer-pin-mismatch`);
      return;
    }
    if (command.pin && String(command.pin) !== String(pin)) {
      debugLog(`RELAY_COMMAND_REJECT type=${commandType || 'unknown'} commandId=${commandId || 'none'} reason=command-pin-mismatch`);
      return;
    }
    if (trackerCommand) {
      const pendingDirect = commandId ? _pendingDirectHangarCommands.get(commandId) : null;
      if (pendingDirect) {
        clearTimeout(pendingDirect);
        _pendingDirectHangarCommands.delete(commandId);
        debugLog(`HANGAR_DIRECT_FALLBACK_CANCEL relay=received commandId=${commandId}`);
      }
      if (isHomebaseObjectControlType(commandType)) {
        debugLog(`HOMEBASE_CONTROL_RELAY_RX type=${commandType} commandId=${commandId || 'none'} controlId=${command?.controlId || 'door'} state=${command?.state || ''} title=${command?.title || command?.objectTitle || ''}`);
        dispatchTrackerCommand(trackerCommand, 'tracker-relay');
        return;
      }
      dispatchTrackerCommand(trackerCommand, 'tracker-relay');
      return;
    }
    if (!commandId) {
      debugLog('HANGAR_DIRECT_FALLBACK_REJECT reason=missing-command-id');
      return;
    }
    if (_pendingDirectHangarCommands.has(commandId) || _dispatchedHangarCommandIds.has(commandId)) return;
    const timer = setTimeout(() => {
      _pendingDirectHangarCommands.delete(commandId);
      dispatchTrackerCommand(stabilizerCommand, 'direct-stabilizer-fallback');
    }, DIRECT_HANGAR_FALLBACK_DELAY_MS);
    _pendingDirectHangarCommands.set(commandId, timer);
    debugLog(`HANGAR_DIRECT_FALLBACK_WAIT commandId=${commandId} delayMs=${DIRECT_HANGAR_FALLBACK_DELAY_MS}`);
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
  const startSimConnectOnce = () => {
    if (_simStarted) return;
    _simStarted = true;
    connectSimConnect(
      getWs,
      syncId,
      pin,
      setTrackerCommandHandler,
      (commandId) => _directHangarAckCommandIds.has(String(commandId || '')),
      () => _homebaseFallbackCache,
      updateEfbState,
      missionAuthorityManager
    );
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
    let trackerStatusInterval = null;
    let trackerStatusStartTimer = null;
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
      if (trackerStatusInterval) {
        clearInterval(trackerStatusInterval);
        trackerStatusInterval = null;
      }
      if (trackerStatusStartTimer) {
        clearTimeout(trackerStatusStartTimer);
        trackerStatusStartTimer = null;
      }
    };

    const sendTrackerStatus = () => {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({
        type: 'gps',
        syncId,
        pin,
        trackerStatusOnly: true,
        source: 'tracker',
        status: 'connected',
        trackerVersion: TRACKER_VERSION,
        trackerVersionCode: TRACKER_VERSION_CODE,
        trackerProtocolHello: TRACKER_PROTOCOL_HELLO,
        sentAt: Date.now()
      }));
    };

    ws.on('open', () => {
      opened = true;
      _reconnecting = false;
      updateEfbState({ relayConnected: true });
      clearWsTimers();
      ws.send(JSON.stringify({ type: 'join', syncId: syncId, pin: pin }));
      trackerLog(`📡 Relay verbunden für Pilot-ID: ${syncId} (Konto verifiziert)`);
      debugLog(`TRACKER_PROTOCOL_HELLO version=${TRACKER_PROTOCOL_HELLO.protocolVersion} channel=${TRACKER_RUNTIME_CHANNEL} capabilities=${TRACKER_PROTOCOL_HELLO.payload.capabilities.join(',')}`);
      trackerStatusStartTimer = setTimeout(() => {
        trackerStatusStartTimer = null;
        sendTrackerStatus();
        trackerStatusInterval = setInterval(sendTrackerStatus, 5000);
      }, 250);
      if (homebasePackageService) {
        setTimeout(() => {
          homebasePackageService.checkRemoteAssets({ notify: true }).then((status) => {
            debugLog(`HOMEBASE_ASSET_REMOTE_CHECK available=${status.remoteAvailable} update=${status.updateAvailable} installed=${status.installedVersion || 'none'} remote=${status.remoteVersion || 'none'} error=${status.remoteError || 'none'}`);
          }).catch((error) => {
            debugLog(`HOMEBASE_ASSET_REMOTE_CHECK_ERROR error=${error?.message || error}`);
          });
        }, 1200);
      }
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
      startSimConnectOnce();
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
      updateEfbState({ relayConnected: false });
      scheduleReconnect("WebSocket getrennt. Neuverbindung in 5 Sekunden...");
    });
  }

  startSimConnectOnce();
  connect();
}

function connectSimConnect(getWs, syncId, pin, setTrackerCommandHandler = null, isDirectHangarAckCommand = null, getHomebaseFallback = null, updateEfbState = null, missionAuthorityManager = null) {
  open('VFR-Multitool-v206', 5)
    .then(({ handle }) => {
      if (typeof updateEfbState === 'function') updateEfbState({ simulatorConnected: true });
      trackerLog("✈️ MSFS gefunden! Warte auf Positionsdaten...");
      let lastGpsMsg = null;
      let latestGroundTrafficSnapshot = [];
      const missionSmokeController = createMissionSmokeController(
        handle,
        getWs,
        syncId,
        pin,
        () => lastGpsMsg,
        () => latestGroundTrafficSnapshot,
        missionAuthorityManager
      );
      const sendHomebaseAck = (payload = {}) => {
        const ws = getWs();
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        try {
          const msg = {
            type: 'gps',
            syncId,
            pin,
            trackerVersion: TRACKER_VERSION,
            trackerVersionCode: TRACKER_VERSION_CODE,
            commandAckOnly: true,
            trackerAck: { source: 'tracker', ...payload, at: Date.now() }
          };
          if (typeof isDirectHangarAckCommand === 'function' && isDirectHangarAckCommand(payload?.commandId)) {
            msg.target = 'workbench';
            msg.stabilizerAck = { ...payload, at: Date.now() };
            debugLog(`HANGAR_DIRECT_ACK type=${payload?.type || 'unknown'} commandId=${payload?.commandId || ''}`);
          }
          if (lastGpsMsg && Number.isFinite(Number(lastGpsMsg.lat)) && Number.isFinite(Number(lastGpsMsg.lon))) {
            msg.lat = Number(lastGpsMsg.lat);
            msg.lon = Number(lastGpsMsg.lon);
            msg.alt = Number.isFinite(Number(lastGpsMsg.alt)) ? Number(lastGpsMsg.alt) : 0;
            msg.hdg = Number.isFinite(Number(lastGpsMsg.hdg)) ? Number(lastGpsMsg.hdg) : 0;
          }
          ws.send(JSON.stringify(msg));
          const errorDetails = payload?.status === 'error' ? JSON.stringify({
            error: payload?.error || payload?.message || '',
            failedObjects: Array.isArray(payload?.failedObjects) ? payload.failedObjects.slice(0, 5) : [],
            failedPeople: Array.isArray(payload?.failedPeople) ? payload.failedPeople.slice(0, 3) : []
          }).slice(0, 4000) : '';
          debugLog(`HOMEBASE_ACK type=${payload?.type || 'unknown'} status=${payload?.status || ''} commandId=${payload?.commandId || ''}${errorDetails ? ` details=${errorDetails}` : ''}`);
        } catch (error) {
          debugLog(`HOMEBASE_ACK_ERROR type=${payload?.type || 'unknown'} error=${error?.message || error}`);
        }
      };
      const homebaseManager = HOMEBASE_ENABLED
        ? createHomebaseObjectManager(handle, {
            sendAck: sendHomebaseAck,
            log: debugLog,
            getLastGps: () => lastGpsMsg,
            extraCapabilities: ['homebase-package-prepare', 'homebase-package-build', 'homebase-package-install', 'homebase-package-rollback', 'homebase-fallback-cache-v1']
          })
        : null;
      let homebaseSceneSignature = '';
      let homebaseFallbackInside = false;
      let homebaseAppAuthorityUntil = 0;
      const sceneMutationTypes = new Set([
        'homebase_v1.preview.set',
        'homebase_v1.preview.clear',
        'homebase_v1.preview.object.add',
        'homebase_v1.preview.object.remove',
        'homebase_v1.preview.object.move',
        'homebase_v1.preview.people.sync'
      ]);
      if (typeof setTrackerCommandHandler === 'function') {
        setTrackerCommandHandler((command) => {
          const type = String(command?.type || '');
          if (sceneMutationTypes.has(type)) {
            homebaseAppAuthorityUntil = Date.now() + 5000;
            if (type === 'homebase_v1.preview.clear') homebaseSceneSignature = '';
            else if (command?.sceneSignature) homebaseSceneSignature = String(command.sceneSignature).slice(0, 96);
          }
          if (homebaseManager?.handleCommand(command)) return true;
          const handled = missionSmokeController.handleCommand(command);
          if (handled && (/^mission_(scene|smoke|authority|snapshot)_/i.test(type) || type === 'mission_lifecycle') && typeof updateEfbState === 'function') {
            updateEfbState({ missionSnapshot: missionSmokeController.getTrackerMissionStatus() });
          }
          return handled;
        });
      }

      const applyHomebaseFallback = (position) => {
        if (!homebaseManager || typeof getHomebaseFallback !== 'function' || Date.now() < homebaseAppAuthorityUntil) return;
        const cache = getHomebaseFallback();
        if (!cache) return;
        const shouldBeActive = fallbackShouldBeActive(cache, position, homebaseFallbackInside);
        if (shouldBeActive) {
          homebaseFallbackInside = true;
          if (homebaseSceneSignature === cache.sceneSignature) return;
          const commandId = `homebase-fallback-${Date.now()}`;
          homebaseSceneSignature = cache.sceneSignature;
          homebaseManager.handleCommand({
            type: 'homebase_v1.preview.set',
            commandId,
            objects: cache.objects,
            people: cache.people,
            navigation: cache.navigation,
            controlStates: cache.controlStates,
            sceneSignature: cache.sceneSignature
          });
          homebaseManager.handleCommand({
            type: 'homebase_v1.door_automation.set',
            commandId: `${commandId}-doors`,
            enabled: cache.doorAutomationEnabled !== false,
            resetManualOverrides: false
          });
          debugLog(`HOMEBASE_FALLBACK_APPLY signature=${cache.sceneSignature} objects=${cache.objects.length} people=${cache.people.length}`);
          return;
        }
        homebaseFallbackInside = false;
        if (homebaseSceneSignature !== cache.sceneSignature) return;
        homebaseSceneSignature = '';
        homebaseManager.handleCommand({ type: 'homebase_v1.preview.clear', commandId: `homebase-fallback-clear-${Date.now()}` });
        debugLog(`HOMEBASE_FALLBACK_CLEAR signature=${cache.sceneSignature}`);
      };

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
      addOptionalVar('AIRSPEED INDICATED', 'knots', 'iasKts');
      addOptionalVar('PLANE PITCH DEGREES', 'degrees', 'pitchDeg');
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
      addOptionalVar('FUEL WEIGHT PER GALLON', 'pounds', 'fuelWeightPerGallonLbs');
      PA24_FUEL_TANK_LVARS.forEach((tank) => addOptionalVar(tank.name, 'number', tank.key));
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
              const iasKts = raw.iasKts;
              const pitchDeg = raw.pitchDeg;
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
              const fuelData = resolveFuelWeightData(
                raw.fuelWeightLbs,
                raw.fuelWeightPerGallonLbs,
                raw,
                missionSmokeController.getPayloadAdapter() === 'pa24_accusim'
              );
              const payloadStationCount = raw.payloadStationCount;
              const payloadWeightLbs = (Number.isFinite(totalWeightLbs) && Number.isFinite(emptyWeightLbs))
                ? (totalWeightLbs - emptyWeightLbs)
                : null;
              const simPausedFromVar = Number.isFinite(simPausedA)
                ? (simPausedA > 0.5)
                : (Number.isFinite(simPausedB) ? (simPausedB > 0.5) : false);
              const simPausedFromEvent = (runtimeState.pauseFlags || 0) !== 0;

              const ws = getWs();
              const validPosition = lat !== 0 || lon !== 0;
              if (validPosition) {
                ownLat = lat; ownLon = lon; // für Traffic-Eigenfilter
                lastGpsMsg = { lat, lon, alt: Math.round(alt), hdg: Math.round(hdg) };
                applyHomebaseFallback(lastGpsMsg);
                if (typeof updateEfbState === 'function') {
                  updateEfbState({
                    simulatorConnected: true,
                    snapshot: {
                      capturedAt: now,
                      lat,
                      lon,
                      alt: Math.round(alt),
                      hdg: Math.round(hdg),
                      flight: {
                        gsKts: Number.isFinite(groundSpeedKts) ? Math.round(groundSpeedKts * 10) / 10 : null,
                        iasKts: Number.isFinite(iasKts) ? Math.round(iasKts * 10) / 10 : null,
                        onGround: Boolean(onGround)
                      }
                    }
                  });
                }
              } else if (typeof updateEfbState === 'function') {
                updateEfbState({ snapshot: null });
              }
              if (ws && ws.readyState === WebSocket.OPEN && validPosition) {
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
                  fuelWeightLbs: fuelData.fuelWeightLbs,
                  fuelTotalGallons: fuelData.fuelTotalGallons,
                  fuelWeightPerGallonLbs: fuelData.fuelWeightPerGallonLbs,
                  fuelSource: fuelData.fuelSource,
                  payloadWeightLbs: Number.isFinite(payloadWeightLbs) ? Math.round(payloadWeightLbs * 10) / 10 : null,
                  payloadStationCount: Number.isFinite(payloadStationCount) ? Math.max(0, Math.round(payloadStationCount)) : null,
                  iasKts: Number.isFinite(iasKts) ? Math.round(iasKts * 10) / 10 : null,
                  ias: Number.isFinite(iasKts) ? Math.round(iasKts * 10) / 10 : null,
                  pitchDeg: Number.isFinite(pitchDeg) ? Math.round(pitchDeg * 10) / 10 : null,
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
                if (homebaseManager) {
                  const currentFallback = typeof getHomebaseFallback === 'function' ? getHomebaseFallback() : null;
                  gpsMsg.homebase = {
                    protocol: homebaseManager.protocol,
                    capabilities: homebaseManager.capabilities,
                    sceneSignature: homebaseSceneSignature,
                    fallbackActive: homebaseFallbackInside && currentFallback?.sceneSignature === homebaseSceneSignature,
                    ...homebaseManager.snapshot()
                  };
                }
                const trackerMissionStatus = missionSmokeController.getTrackerMissionStatus();
                const trackerMissionAuthority = missionSmokeController.getMissionAuthoritySnapshot();
                if (typeof updateEfbState === 'function') {
                  updateEfbState({ missionSnapshot: trackerMissionStatus });
                }
                if (trackerMissionStatus?.missionId) {
                  gpsMsg.trackerMissionStatus = trackerMissionStatus;
                }
                if (trackerMissionAuthority) gpsMsg.trackerMissionAuthority = trackerMissionAuthority;
                if (latestTrafficSnapshot && latestTrafficSnapshot.length > 0) {
                  gpsMsg.traffic = latestTrafficSnapshot;
                  latestTrafficSnapshot = null; // einmalig senden, dann löschen
                }
                ws.send(JSON.stringify(gpsMsg));
                if (now - lastFlightLog >= 1000) {
                  lastFlightLog = now;
                  trackerStatus(`GPS Lat ${lat.toFixed(4)} | Lon ${lon.toFixed(4)} | Alt ${Math.round(alt)}ft | Hdg ${Math.round(hdg)}° | AGL ${Math.round(agl || 0)}ft | GS ${flight.gsKts ?? '?'}kts | IAS ${flight.iasKts ?? '?'}kts | Pitch ${flight.pitchDeg ?? '?'}° | OnG ${flight.onGround ? 'Y' : 'N'} | Park ${flight.parkingBrake == null ? '?' : (flight.parkingBrake ? 'Y' : 'N')} | Pause ${flight.simPaused ? 'Y' : 'N'}(${flight.pauseFlags ?? 0}) | Sim ${flight.simRunning ? 'RUN' : 'STOP'} | Menu ${flight.inMenuOrMap ? 'Y' : 'N'} | G ${flight.gForce.toFixed(2)} | Bank ${flight.bankDeg.toFixed(1)}° | Wind ${flight.windKts ?? '?'}kts/${flight.windDeg ?? '?'}° | Gust ${flight.windGustKts ?? '?'}kts | Temp ${flight.tempC ?? '?'}°C | Vis ${flight.visKm ?? '?'}km | Pcp ${flight.precipRateMmH ?? '?'}mm/h | Cloud ${flight.inCloud == null ? '?' : (flight.inCloud ? 'Y' : 'N')} | Turb ${flight.turbulencePct ?? '?'}%`);
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
        if (typeof updateEfbState === 'function') updateEfbState({ simulatorConnected: false, snapshot: null });
        if (typeof setTrackerCommandHandler === 'function') setTrackerCommandHandler(null);
        clearInterval(runtimePollInterval);
        clearInterval(trafficInterval);
        trackerWarn("⚠️  MSFS getrennt. Neuer SimConnect-Versuch in 5 Sekunden...");
        setTimeout(() => connectSimConnect(getWs, syncId, pin, setTrackerCommandHandler, isDirectHangarAckCommand, getHomebaseFallback, updateEfbState, missionAuthorityManager), 5000);
      });
    })
    .catch(err => {
      if (typeof updateEfbState === 'function') updateEfbState({ simulatorConnected: false, snapshot: null });
      trackerWarn("⚠️  MSFS nicht gefunden / SimConnect-Fehler. Neuer Versuch in 5 Sekunden...");
      setTimeout(() => connectSimConnect(getWs, syncId, pin, setTrackerCommandHandler, isDirectHangarAckCommand, getHomebaseFallback, updateEfbState, missionAuthorityManager), 5000);
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
    fs.mkdirSync(TRACKER_DATA_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...(data || {}) }, null, 2), 'utf8');
    return true;
  } catch (err) {
    trackerWarn(`⚠️  Konnte ${CONFIG_BASENAME} nicht im Tracker-Datenordner speichern: ${err?.message || err}`);
    debugLog(`CONFIG_WRITE_ERROR file=${CONFIG_FILE} error=${err?.message || err}`);
    return false;
  }
}

function askCredentials() {
  rl.question("Bitte gib deine Pilot-ID ein (z.B. Foxtrot-Mike-764): ", (idAnswer) => {
    const finalId = idAnswer.trim();
    if (!finalId) {
      trackerLog("❌ Keine Pilot-ID eingegeben.");
      return setTimeout(askCredentials, 50);
    }
    
    rl.question("Bitte gib deinen 4-stelligen PIN ein: ", (pinAnswer) => {
      const finalPin = pinAnswer.trim();
      if (!finalPin) {
        trackerLog("❌ Kein PIN eingegeben.");
        return setTimeout(askCredentials, 50);
      }
      verifyAndStartTracker(finalId, finalPin, { promptOnFailure: true });
    });
  });
}

async function verifyAndStartTracker(syncId, pin, { promptOnFailure = false } = {}) {
  const requestedId = String(syncId || '').trim();
  trackerLog(`🔐 Prüfe Pilot-Konto: ${requestedId} ...`);
  const auth = await verifyTrackerCredentials(requestedId, pin);
  if (!auth.ok) {
    debugLog(`AUTH_REJECT requestedId=${requestedId} code=${auth.code || 'unknown'}`);
    if (auth.code === 'pilot_not_found') {
      trackerError("❌ Pilot-ID nicht gefunden. Bitte Schreibweise und Eingabe prüfen.");
    } else if (auth.code === 'pin_invalid') {
      trackerError("❌ Der PIN für diese Pilot-ID ist falsch.");
    } else {
      trackerError(`❌ ${auth.message || 'Konto-Prüfung fehlgeschlagen.'}`);
    }
    trackerWarn("⚠️  Keine Anmeldung bestätigt; der Tracker sendet keine Sim-Daten.");
    if (promptOnFailure) setTimeout(askCredentials, 100);
    return false;
  }

  const canonicalId = String(auth.pilotId || requestedId).trim();
  if (canonicalId !== requestedId) {
    trackerLog(`ℹ️  Pilot-ID erkannt: ${requestedId} → ${canonicalId}`);
  }
  saveTrackerConfig(canonicalId, pin);
  debugLog(`AUTH_OK requestedId=${requestedId} canonicalId=${canonicalId}`);
  trackerLog(`✅ Angemeldet als ${canonicalId}`);
  startTracker(canonicalId, pin);
  return true;
}

function saveTrackerConfig(syncId, pin, extra = {}) {
  const next = { ...readTrackerConfig(), syncId, consoleMode, ...extra };
  if (credentialsProvidedByDesktop) delete next.pin;
  else next.pin = pin;
  writeTrackerConfig(next);
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
  if (HEADLESS_MODE) {
    consoleMode = normalizeConsoleMode(data.consoleMode || data.displayMode || data.logMode);
    trackerLog(`🔒 Warte auf geschützte Zugangsdaten vom Desktop-Programm.`);
    rl.once('line', (line) => {
      let credentials = null;
      try { credentials = JSON.parse(String(line || '')); } catch (_) {}
      const syncId = String(credentials?.pilotId || '').trim();
      const pin = String(credentials?.pin || '').trim();
      if (!syncId || !/^\d{4}$/.test(pin)) {
        trackerWarn("⚠️  Keine gültigen Zugangsdaten vom Desktop-Programm empfangen.");
        rl.close();
        return;
      }
      credentialsProvidedByDesktop = true;
      rl.close();
      trackerLog(`🔒 Zugangsdaten wurden über eine lokale Prozess-Pipe übernommen.`);
      verifyAndStartTracker(syncId, pin, { promptOnFailure: false });
    });
    return;
  }
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
          trackerLog(`\n\n🚀 Autostart mit Pilot-ID: ${savedId}`);
          verifyAndStartTracker(savedId, savedPin, { promptOnFailure: !HEADLESS_MODE });
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
          askConsoleMode(savedId, savedPin, () => verifyAndStartTracker(savedId, savedPin, { promptOnFailure: !HEADLESS_MODE }));
        } else {
          trackerLog(`\n\n--- Neueingabe gestartet ---`);
          askCredentials();
        }
      }
    });

  } else {
    if (HEADLESS_MODE) trackerWarn("⚠️  Keine geschützten Zugangsdaten vom Desktop-Programm empfangen.");
    else askCredentials();
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
