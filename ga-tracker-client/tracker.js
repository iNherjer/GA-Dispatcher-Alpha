const { open, SimConnectDataType, SimConnectPeriod, InitPosition, RawBuffer, Waypoint, SimConnectConstants } = require('node-simconnect');
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
const CONFIG_FILE = 'tracker-config.json';
const TRACKER_VERSION = 'v230';
const TRACKER_VERSION_CODE = 230;
const TRACKER_DISPLAY_NAME = `GA Tracker ${TRACKER_VERSION} (build ${TRACKER_VERSION_CODE})`;
const MISSION_SMOKE_DEFAULT_TITLE = 'Chimney_Smoke_V1';
const MISSION_FIRE_DEFAULT_TITLE = 'VO_Fire_R1_40';
const MISSION_SCENE_VEHICLE_TITLE = 'Car Bush Firefighting';
const MISSION_SCENE_PERSON_TITLE = 'Tarmac_Female_Summer_Asian';
const TRACKER_DEBUG_FILE = path.join(process.pkg ? path.dirname(process.execPath) : __dirname, 'ga-tracker-debug.txt');
const TELEPORT_DEF_ID = 9361;
const WAYPOINT_DEF_ID = 9362;
const DOOR_OPEN_EVENT_ID = 9363;
const DOOR_CLOSE_EVENT_ID = 9364;
const DOOR_TOGGLE_EVENT_ID = 9365;
const PA24_DOOR_UNLOCK_EVENT_ID = 9366;
const PA24_DOOR_HANDLE_EVENT_ID = 9367;
const PA24_DOOR_LOCK_EVENT_ID = 9368;

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

function createMissionSmokeController(handle, getWs, syncId, pin, getLastGpsMsg = null) {
  const missions = new Map();
  const scenes = new Map();
  const pendingAssign = new Map();
  const lastExceptions = [];
  let nextReqId = 9300;
  let teleportDefReady = false;
  let waypointDefReady = false;
  let doorEventsReady = false;
  let pa24DoorEventsReady = false;

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

  const ensureDoorEvents = () => {
    if (doorEventsReady) return true;
    try {
      handle.mapClientEventToSimEvent(DOOR_OPEN_EVENT_ID, 'OPEN_AIRCRAFT_DOORS');
      handle.mapClientEventToSimEvent(DOOR_CLOSE_EVENT_ID, 'CLOSE_AIRCRAFT_DOORS');
      handle.mapClientEventToSimEvent(DOOR_TOGGLE_EVENT_ID, 'TOGGLE_AIRCRAFT_EXIT');
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
        handle.transmitClientEventEx(SimConnectConstants.OBJECT_ID_USER, eventId, 0, 0, value, 0, 0, 0, 0);
      } else {
        handle.transmitClientEvent(SimConnectConstants.OBJECT_ID_USER, eventId, value, 0, 0);
      }
      debugLog(`DOOR_EVENT_SENT label=${label} value=${value} reason=${reason}`);
      return true;
    } catch (err) {
      debugLog(`DOOR_EVENT_ERROR label=${label} value=${value} reason=${reason} error=${err?.message || err}`);
      return false;
    }
  };

  const setPa24ComancheDoor = async (openDoor, reason = 'boarding') => {
    if (!ensurePa24DoorEvents()) return false;
    const action = openDoor ? 'OPEN' : 'CLOSE';
    debugLog(`DOOR_PA24_${action}_START reason=${reason}`);
    let ok = true;
    ok = sendDoorClientEvent(PA24_DOOR_UNLOCK_EVENT_ID, 1, 'PA24-door_latch_unlock', reason) && ok;
    await sleep(120);
    ok = sendDoorClientEvent(PA24_DOOR_HANDLE_EVENT_ID, 1, 'PA24-door_handle_open', reason) && ok;
    if (!openDoor) {
      await sleep(120);
      ok = sendDoorClientEvent(PA24_DOOR_LOCK_EVENT_ID, 1, 'PA24-door_latch_lock', reason) && ok;
    }
    debugLog(`DOOR_PA24_${action}_DONE status=${ok ? 'ok' : 'partial'} reason=${reason}`);
    return ok;
  };

  const setUserAircraftDoor = async (openDoor, doorIndex = 1, reason = 'boarding', doorProfile = 'default') => {
    const profile = String(doorProfile || 'default').trim().toLowerCase();
    console.log(`🚪 Door ${openDoor ? 'open' : 'close'} profile=${profile} index=${doorIndex} (${reason})`);
    if (profile === 'pa24_comanche' || profile === 'pa24' || profile === 'comanche') {
      return setPa24ComancheDoor(openDoor, reason);
    }
    if (!ensureDoorEvents()) return false;
    const index = clampInt(doorIndex, 0, 8);
    const doorParam = index <= 0 ? 0 : index;
    try {
      const eventId = openDoor ? DOOR_OPEN_EVENT_ID : DOOR_CLOSE_EVENT_ID;
      const ok = sendDoorClientEvent(typeof handle.transmitClientEventEx === 'function' ? eventId : DOOR_TOGGLE_EVENT_ID, doorParam, openDoor ? 'OPEN_AIRCRAFT_DOORS' : 'CLOSE_AIRCRAFT_DOORS', reason);
      debugLog(`DOOR_${openDoor ? 'OPEN' : 'CLOSE'}_ATTEMPT index=${doorParam} profile=${profile} status=${ok ? 'ok' : 'error'} reason=${reason}`);
      return ok;
    } catch (err) {
      debugLog(`DOOR_${openDoor ? 'OPEN' : 'CLOSE'}_ERROR index=${doorParam} profile=${profile} reason=${reason} error=${err?.message || err}`);
      return false;
    }
  };

  const resolveDoorProfile = (command) => {
    const raw = String(command?.doorProfile || command?.aircraftDoorProfile || '').trim();
    const haystack = `${raw} ${command?.aircraftSlot || ''} ${command?.aircraftName || ''} ${command?.aircraftTitle || ''}`.toLowerCase();
    if (haystack.includes('pa-24') || haystack.includes('pa24') || haystack.includes('comanche')) return 'pa24_comanche';
    return raw || 'default';
  };

  const sendAck = (payload) => {
    const ws = getWs();
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      const lastGps = typeof getLastGpsMsg === 'function' ? getLastGpsMsg() : null;
      const msg = {
        type: 'gps',
        syncId,
        pin,
        trackerVersion: TRACKER_VERSION,
        trackerVersionCode: TRACKER_VERSION_CODE,
        commandAckOnly: true,
        trackerAck: {
          source: 'tracker',
          ...payload,
          at: Date.now()
        }
      };
      if (lastGps && Number.isFinite(Number(lastGps.lat)) && Number.isFinite(Number(lastGps.lon))) {
        msg.lat = Number(lastGps.lat);
        msg.lon = Number(lastGps.lon);
        msg.alt = Number.isFinite(Number(lastGps.alt)) ? Math.round(Number(lastGps.alt)) : 0;
        msg.hdg = Number.isFinite(Number(lastGps.hdg)) ? Math.round(Number(lastGps.hdg)) : 0;
      }
      debugLog(`ACK ${payload?.type || 'unknown'} mission=${payload?.missionId || 'n/a'} status=${payload?.status || 'n/a'} spawned=${payload?.spawned ?? ''} cleared=${payload?.cleared ?? ''} error=${payload?.error || ''}`);
      ws.send(JSON.stringify(msg));
    } catch (_) {}
  };

  const waitForAssignedObject = (requestId, timeoutMs = 5000) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingAssign.delete(requestId);
      const hint = lastExceptions.length ? lastExceptions.splice(0).join(', ') : 'keine Antwort vom Sim';
      reject(new Error(hint));
    }, timeoutMs);
    pendingAssign.set(requestId, { resolve, reject, timer });
  });

  const spawnObject = async (title, pos, timeoutMs = 5000) => {
    const requestId = nextReqId++;
    lastExceptions.length = 0;
    const waitPromise = waitForAssignedObject(requestId, timeoutMs);
    handle.aICreateSimulatedObject(title, buildInitPos(pos.lat, pos.lon, pos.altFt, pos.hdg, true), requestId);
    return waitPromise;
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

  const buildScenePlan = (command) => {
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
    const rec = scenes.get(sceneId);
    if (!rec || !Array.isArray(rec.objects) || rec.objects.length === 0) {
      debugLog(`SCENE_BOARDING_NOOP scene=${sceneId} reason=no_scene`);
      sendAck({ type: 'mission_scene_boarding_ack', commandId, sceneId, status: 'noop', error: 'no_scene' });
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
      sendAck({ type: 'mission_scene_boarding_ack', commandId, sceneId, status: 'noop', error: 'no_person' });
      return;
    }

    const boarderPlans = boarders.map((person, index) => ({
      person,
      path: buildBoardingPath(command, rec, person, { startAtPerson: index > 0 })
    })).filter(plan => Array.isArray(plan.path) && plan.path.length >= 2);
    if (!boarderPlans.length) {
      debugLog(`SCENE_BOARDING_ERROR scene=${sceneId} reason=invalid_path`);
      sendAck({ type: 'mission_scene_boarding_ack', commandId, sceneId, status: 'error', error: 'invalid_path' });
      return;
    }

    const requestedDurationMs = clampInt(command?.durationMs ?? 18000, 3000, 45000);
    const finalHoldMs = clampInt(command?.finalHoldMs ?? 450, 0, 2000);
    const removePerson = command?.removePerson !== false;
    const removeCargoAtWaypoint = command?.removeCargoAtWaypoint !== false;
    const cargoHoldMs = clampInt(command?.cargoHoldMs ?? command?.cargoPauseMs ?? 2600, 0, 9000);
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
    const cargo = rec.objects.find(o => String(o?.kind || '').toLowerCase() === cargoKind)
      || rec.objects.find(o => /cargo|load|marker/i.test(String(o?.kind || '')));
    let cargoRemoved = 0;
    const removeCargoObject = (why = 'cargo-waypoint') => {
      if (!cargo || !cargo.objectId || cargoRemoved) return false;
      try {
        handle.aIRemoveObject(cargo.objectId, nextReqId++);
        cargoRemoved = 1;
        rec.objects = rec.objects.filter(o => o.objectId !== cargo.objectId);
        debugLog(`SCENE_CARGO_REMOVE_OK scene=${sceneId} objectId=${cargo.objectId} reason=${why}`);
        return true;
      } catch (err) {
        debugLog(`SCENE_CARGO_REMOVE_ERROR scene=${sceneId} objectId=${cargo.objectId} reason=${why} error=${err?.message || err}`);
        return false;
      }
    };
    const cargoPathIndex = clampInt(command?.cargoPathIndex ?? command?.cargoIndex ?? 1, 1, Math.max(1, primaryPath.length - 2));
    debugLog(`SCENE_BOARDING_START scene=${sceneId} boarders=${boarderPlans.length} objectIds=${boarderPlans.map(p => p.person.objectId).join(',')} path=${pathSource} durationMs=${durationMs} waypoints=${primaryPath.length - 1} speedKts=${speedKts} door=${doorEnabled ? 1 : 0} doorProfile=${doorProfile} aircraftSlot=${command?.aircraftSlot || ''} aircraftName="${command?.aircraftName || ''}" cargo=${cargo?.objectId || 0} cargoPathIndex=${cargoPathIndex}`);
    console.log(`🚶 Scene ${sceneId}: Boarding-Animation startet (${boarderPlans.length} Pax, ${Math.round(durationMs / 1000)}s).`);

    if (doorEnabled) {
      await setUserAircraftDoor(true, doorIndex, 'boarding-open', doorProfile);
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
    const cargoArrivalSlackMs = clampInt(command?.cargoArrivalSlackMs ?? 1800, 0, 6000);
    const canSplitAtCargo = removeCargoAtWaypoint && cargo && primaryPath.length >= 3 && cargoPathIndex < primaryPath.length - 1;
    let routeSent = false;
    let routeSentCount = 0;
    if (canSplitAtCargo) {
      routeSentCount = boarderPlans.reduce((count, plan) => {
        const sent = sendWaypointRoute(plan.person.objectId, plan.path.slice(1, cargoPathIndex + 1), speedKts);
        return count + (sent ? 1 : 0);
      }, 0);
      routeSent = routeSentCount > 0;
      if (routeSent) {
        const cargoDelayMs = clampInt((cargoRouteMs * 1.2) + cargoArrivalSlackMs + cargoHoldMs, 1200, Math.max(1500, durationMs - finalHoldMs - 500));
        setTimeout(() => {
          removeCargoObject('route-cargo-hold');
          boarderPlans.forEach((plan) => {
            const continuePoints = plan.path.slice(cargoPathIndex + 1);
            if (!continuePoints.length) return;
            const continued = sendWaypointRoute(plan.person.objectId, continuePoints, speedKts);
            debugLog(`SCENE_BOARDING_CONTINUE scene=${sceneId} objectId=${plan.person.objectId} points=${continuePoints.length} status=${continued ? 'ok' : 'failed'}`);
          });
        }, cargoDelayMs);
        debugLog(`SCENE_CARGO_HOLD_SCHEDULED scene=${sceneId} objectId=${cargo.objectId} routeMs=${Math.round(cargoRouteMs)} slackMs=${cargoArrivalSlackMs} holdMs=${cargoHoldMs} delayMs=${cargoDelayMs} cargoPathIndex=${cargoPathIndex} routeSent=${routeSentCount}/${boarderPlans.length}`);
      }
    }
    if (!routeSent) {
      routeSentCount = boarderPlans.reduce((count, plan) => {
        const sent = sendWaypointRoute(plan.person.objectId, plan.path.slice(1), speedKts);
        return count + (sent ? 1 : 0);
      }, 0);
      routeSent = routeSentCount > 0;
      if (routeSent && removeCargoAtWaypoint && cargo && primaryPath.length >= 2) {
        const cargoDelayMs = clampInt((cargoRouteMs * 1.2) + cargoArrivalSlackMs + cargoHoldMs, 1200, Math.max(1500, durationMs - finalHoldMs - 500));
        setTimeout(() => removeCargoObject('route-cargo-waypoint'), cargoDelayMs);
        debugLog(`SCENE_CARGO_REMOVE_SCHEDULED scene=${sceneId} objectId=${cargo.objectId} routeMs=${Math.round(cargoRouteMs)} slackMs=${cargoArrivalSlackMs} holdMs=${cargoHoldMs} delayMs=${cargoDelayMs}`);
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
          removeCargoObject('fallback-cargo-waypoint');
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
      await sleep(300);
      await setUserAircraftDoor(false, doorIndex, 'boarding-close', doorProfile);
    }
    debugLog(`SCENE_BOARDING_OK scene=${sceneId} boarders=${boarderPlans.length} routeSent=${routeSent ? 1 : 0} routeSentCount=${routeSentCount} removed=${removed}`);
    sendAck({ type: 'mission_scene_boarding_ack', commandId, sceneId, status: routeSent ? 'ok' : 'error', routeSent: routeSent ? 1 : 0, routeSentCount, removed, cargoRemoved, boarded: routeSent ? boarderPlans.length : 0, durationMs, error: routeSent ? '' : 'waypoint_route_failed' });
  };

  const clearScene = async (sceneId, reason = 'clear', commandId = null) => {
    const key = String(sceneId || 'mission-scene');
    const rec = scenes.get(key);
    if (!rec || !Array.isArray(rec.objects) || rec.objects.length === 0) {
      debugLog(`SCENE_CLEAR_NOOP scene=${key} reason=${reason}`);
      sendAck({ type: 'mission_scene_clear_ack', commandId, sceneId: key, status: 'noop', reason });
      return { cleared: 0 };
    }
    let cleared = 0;
    debugLog(`SCENE_CLEAR_START scene=${key} reason=${reason} objects=${rec.objects.length}`);
    for (const obj of rec.objects) {
      try {
        handle.aIRemoveObject(obj.objectId, nextReqId++);
        cleared++;
      } catch (err) {
        debugLog(`SCENE_CLEAR_ERROR scene=${key} objectId=${obj.objectId} error=${err?.message || err}`);
      }
    }
    scenes.delete(key);
    console.log(`🚒 Scene ${key}: ${cleared} Objekte entfernt (${reason}).`);
    debugLog(`SCENE_CLEAR_OK scene=${key} cleared=${cleared} reason=${reason}`);
    sendAck({ type: 'mission_scene_clear_ack', commandId, sceneId: key, status: 'ok', cleared, reason });
    return { cleared };
  };

  const spawnMissionScene = async (command) => {
    const sceneId = String(command?.sceneId || 'mission-scene');
    const commandId = command?.commandId || null;
    const positions = buildScenePlan(command);
    if (positions.length === 0) {
      debugLog(`SCENE_SPAWN_INVALID scene=${sceneId}`);
      sendAck({ type: 'mission_scene_spawn_ack', commandId, sceneId, status: 'error', error: 'invalid scene base/items' });
      return;
    }
    await clearScene(sceneId, 'replace-before-scene', commandId);
    const objects = [];
    console.log(`🚒 Scene ${sceneId}: spawn ${positions.length} Objekte (${JSON.stringify(countByKind(positions))})`);
    debugLog(`SCENE_SPAWN_START scene=${sceneId} count=${positions.length} byKind=${JSON.stringify(countByKind(positions))}`);
    for (const p of positions) {
      const candidates = p.titleCandidates?.length ? p.titleCandidates : [p.title];
      let spawned = false;
      let lastError = null;
      for (const candidate of candidates) {
        try {
          debugLog(`SCENE_TRY scene=${sceneId} kind=${p.kind} title="${candidate}"`);
          const objectId = await spawnObject(candidate, p, 2200);
          const spawnedObj = { objectId, ...p, title: candidate, requestedTitle: p.title };
          objects.push(spawnedObj);
          console.log(`  OK scene ${p.kind}: objectId=${objectId} title="${candidate}"`);
          debugLog(`SCENE_SPAWN_OK scene=${sceneId} kind=${p.kind} index=${p.index} objectId=${objectId} title="${candidate}" requestedTitle="${p.title}" lat=${p.lat} lon=${p.lon} altFt=${p.altFt} hdg=${p.hdg} forwardM=${p.forwardM} rightM=${p.rightM}`);
          if (String(p.kind || '').toLowerCase() === 'vehicle') {
            await sleep(250);
            const parked = sendWaypointRoute(objectId, [p], 0.5);
            debugLog(`SCENE_VEHICLE_HOLD scene=${sceneId} objectId=${objectId} status=${parked ? 'ok' : 'failed'}`);
          }
          spawned = true;
          break;
        } catch (err) {
          lastError = err;
          console.warn(`  ✗ scene ${p.kind} title="${candidate}": ${err?.message || err}`);
          debugLog(`SCENE_TRY_ERROR scene=${sceneId} kind=${p.kind} title="${candidate}" error=${err?.message || err}`);
        }
      }
      if (!spawned) {
        debugLog(`SCENE_SPAWN_ERROR scene=${sceneId} kind=${p.kind} title="${p.title}" candidates=${JSON.stringify(candidates)} error=${lastError?.message || lastError || 'all candidates failed'}`);
      }
    }
    scenes.set(sceneId, { sceneId, spawnedAt: Date.now(), command: { ...command }, objects, positions });
    sendAck({
      type: 'mission_scene_spawn_ack',
      commandId,
      sceneId,
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
        cleared++;
      } catch (err) {
        console.warn(`⚠️  Smoke clear objectId=${obj.objectId}: ${err?.message || err}`);
        debugLog(`CLEAR_ERROR mission=${key} objectId=${obj.objectId} error=${err?.message || err}`);
      }
    }
    missions.delete(key);
    console.log(`🔥 Smoke Mission ${key}: ${cleared} Objekte entfernt (${reason}).`);
    debugLog(`CLEAR_OK mission=${key} cleared=${cleared} reason=${reason}`);
    sendAck({ type: 'mission_smoke_clear_ack', missionId: key, status: 'ok', cleared, reason });
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
    console.log(`🔥 Smoke Mission ${missionId}: spawn ${positions.length} Objekte (${JSON.stringify(countByKind(positions))}) mode=${usePrewarm ? 'prewarm' : 'target'}`);
    debugLog(`SPAWN_START mission=${missionId} extent=${command?.extent || 'n/a'} mode=${usePrewarm ? 'prewarm' : 'target'} title="${title}" fireTitle="${fireTitle}" count=${positions.length} byKind=${JSON.stringify(countByKind(positions))}`);

    for (const p of positions) {
      try {
        const spawnPos = usePrewarm
          ? { lat: prewarmLat, lon: prewarmLon, altFt: prewarmAltFt, hdg: prewarmHdg }
          : p;
        const objectId = await spawnObject(p.title, spawnPos, 5000);
        objects.push({ objectId, ...p, spawnedAt: { ...spawnPos }, teleported: !usePrewarm });
        console.log(`  OK ${p.kind} site=${p.siteIndex} obj=${p.index}: objectId=${objectId}`);
        debugLog(`SPAWN_OK mission=${missionId} kind=${p.kind} site=${p.siteIndex} index=${p.index} objectId=${objectId} title="${p.title}" spawnLat=${spawnPos.lat} spawnLon=${spawnPos.lon} targetLat=${p.lat} targetLon=${p.lon} targetAltFt=${p.altFt} baseAltFt=${p.baseAltFt} altOffsetFt=${p.altOffsetFt}`);
      } catch (err) {
        console.warn(`  ✗ ${p.kind} site=${p.siteIndex} obj=${p.index}: ${err?.message || err}`);
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
      pending.resolve(recv.objectID);
    }
  });

  handle.on('exception', (recv) => {
    const name = recv.exceptionName || String(recv.exception);
    lastExceptions.push(name);
    if (pendingAssign.size > 0) {
      console.warn(`[SimConnect Exception] ${name} sendId=${recv.sendId}`);
      const [requestId, pending] = pendingAssign.entries().next().value || [];
      if (pending) {
        pendingAssign.delete(requestId);
        clearTimeout(pending.timer);
        pending.reject(new Error(name));
      }
    }
  });

  return {
    handleCommand(command) {
      const type = String(command?.type || command?.command || '').trim();
      if (type === 'mission_smoke_spawn') {
        debugLog(`COMMAND mission_smoke_spawn mission=${command?.missionId || 'active'} title="${command?.objectTitle || command?.title || MISSION_SMOKE_DEFAULT_TITLE}" sites=${Array.isArray(command?.sites) ? command.sites.length : 0} fireSites=${Array.isArray(command?.fireSites) ? command.fireSites.length : 0}`);
        spawnMissionSmoke(command).catch(err => {
          console.warn(`⚠️  Smoke spawn failed: ${err?.message || err}`);
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
        debugLog(`COMMAND mission_scene_spawn scene=${command?.sceneId || 'mission-scene'} items=${Array.isArray(command?.items) ? command.items.length : 0}`);
        spawnMissionScene(command).catch(err => {
          console.warn(`⚠️  Scene spawn failed: ${err?.message || err}`);
          sendAck({ type: 'mission_scene_spawn_ack', commandId: command?.commandId || null, sceneId: command?.sceneId || 'mission-scene', status: 'error', error: err?.message || String(err) });
        });
        return true;
      }
      if (type === 'mission_scene_boarding') {
        const pathCount = Array.isArray(command?.path) ? command.path.length : (Array.isArray(command?.boardingPath) ? command.boardingPath.length : (Array.isArray(command?.waypoints) ? command.waypoints.length : 0));
        debugLog(`COMMAND mission_scene_boarding scene=${command?.sceneId || 'mission-scene'} profile=${command?.profile || command?.pathProfile || 'ga_right_cockpit_v1'} pathPoints=${pathCount} cargoPathIndex=${command?.cargoPathIndex ?? ''} door=${command?.openDoor === true || command?.door === true ? 1 : 0} doorProfile=${command?.doorProfile || command?.aircraftDoorProfile || ''} aircraftSlot=${command?.aircraftSlot || ''} aircraftName="${command?.aircraftName || ''}"`);
        animateMissionSceneBoarding(command).catch(err => {
          console.warn(`⚠️  Scene boarding failed: ${err?.message || err}`);
          sendAck({ type: 'mission_scene_boarding_ack', commandId: command?.commandId || null, sceneId: command?.sceneId || 'mission-scene', status: 'error', error: err?.message || String(err) });
        });
        return true;
      }
      if (type === 'mission_scene_clear') {
        debugLog(`COMMAND mission_scene_clear scene=${command?.sceneId || 'mission-scene'}`);
        clearScene(command?.sceneId || 'mission-scene', 'command', command?.commandId || null).catch(err => {
          sendAck({ type: 'mission_scene_clear_ack', commandId: command?.commandId || null, sceneId: command?.sceneId || 'mission-scene', status: 'error', error: err?.message || String(err) });
        });
        return true;
      }
      return false;
    },
    clearAll(reason = 'shutdown') {
      return Promise.all([
        ...[...missions.keys()].map(id => clearMission(id, reason)),
        ...[...scenes.keys()].map(id => clearScene(id, reason))
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

  const getWs = () => _currentWs;
  const setTrackerCommandHandler = (handler) => { _trackerCommandHandler = handler; };
  const handleTrackerMessage = (raw) => {
    if (!_trackerCommandHandler) return;
    let data = null;
    try { data = JSON.parse(String(raw || '')); } catch (_) { return; }
    const command = data?.trackerCommand || (data?.target === 'tracker' ? data : null);
    if (!command || typeof command !== 'object') return;
    if (data.syncId && String(data.syncId) !== String(syncId)) return;
    if (data.pin && String(data.pin) !== String(pin)) return;
    if (command.pin && String(command.pin) !== String(pin)) return;
    _trackerCommandHandler(command);
  };
  const scheduleReconnect = (reason, delayMs = 5000) => {
    if (_reconnectTimer) return;
    _reconnecting = false;
    if (reason) console.warn(`⚠️  ${reason}`);
    _reconnectTimer = setTimeout(() => {
      _reconnectTimer = null;
      connect();
    }, delayMs);
  };

  function connect() {
    if (_reconnecting) return;
    _reconnecting = true;
    _wsAttempt += 1;
    console.log(`\nVerbinde mit WebSocket-Server: ${WS_URL}... (Versuch ${_wsAttempt})`);
    const ws = new WebSocket(WS_URL, { handshakeTimeout: 10000 });
    _currentWs = ws;
    let opened = false;
    let awaitingPong = false;
    let pingInterval = null;
    const connectWatchdog = setTimeout(() => {
      if (!opened) {
        console.warn("⚠️  WebSocket-Handshake Timeout. Erzwinge Neuverbindung...");
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
      console.log(`📡 Verbunden mit Pilot-ID: ${syncId} (Auth aktiv)`);
      pingInterval = setInterval(() => {
        try {
          if (ws.readyState !== WebSocket.OPEN) return;
          if (awaitingPong) {
            console.warn("⚠️  WebSocket-Ping Timeout. Erzwinge Neuverbindung...");
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
      console.error("❌ WebSocket-Fehler:", err.message);
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
      console.log("✈️ MSFS gefunden! Warte auf Positionsdaten...");
      let lastGpsMsg = null;
      const missionSmokeController = createMissionSmokeController(handle, getWs, syncId, pin, () => lastGpsMsg);
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
            console.warn(`ℹ️ SystemEvent nicht verfuegbar: ${name}`);
          }
        } catch (e) {
          console.warn(`ℹ️ SystemEvent Fehler (${name}):`, e?.message || e);
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
          console.warn(`ℹ️ Optionaler SimVar nicht verfuegbar: ${name}`);
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
                    console.warn(
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
                if (latestTrafficSnapshot && latestTrafficSnapshot.length > 0) {
                  gpsMsg.traffic = latestTrafficSnapshot;
                  latestTrafficSnapshot = null; // einmalig senden, dann löschen
                }
                lastGpsMsg = { lat: gpsMsg.lat, lon: gpsMsg.lon, alt: gpsMsg.alt, hdg: gpsMsg.hdg };
                ws.send(JSON.stringify(gpsMsg));
                if (now - lastFlightLog >= 1000) {
                  lastFlightLog = now;
                  console.log(`Sende GPS: Lat ${lat.toFixed(4)} | Lon ${lon.toFixed(4)} | Alt ${Math.round(alt)}ft | Hdg ${Math.round(hdg)}° | AGL ${Math.round(agl || 0)}ft | GS ${flight.gsKts ?? '?'}kts | OnG ${flight.onGround ? 'Y' : 'N'} | Pause ${flight.simPaused ? 'Y' : 'N'}(${flight.pauseFlags ?? 0}) | Sim ${flight.simRunning ? 'RUN' : 'STOP'} | Menu ${flight.inMenuOrMap ? 'Y' : 'N'} | G ${flight.gForce.toFixed(2)} | Bank ${flight.bankDeg.toFixed(1)}° | Wind ${flight.windKts ?? '?'}kts/${flight.windDeg ?? '?'}° | Gust ${flight.windGustKts ?? '?'}kts | Temp ${flight.tempC ?? '?'}°C | Vis ${flight.visKm ?? '?'}km | Pcp ${flight.precipRateMmH ?? '?'}mm/h | Cloud ${flight.inCloud == null ? '?' : (flight.inCloud ? 'Y' : 'N')} | Turb ${flight.turbulencePct ?? '?'}%`);
                }
              } else if (lat === 0) {
                 process.stdout.write("."); 
              }
            } catch (e) { console.error("❌ Lesefehler:", e.message); }
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
          // Filter: nur fliegende Flieger (GS > 10 kts), eigenes Objekt per Position ausschließen
          const moving = all.filter(ac => {
            if (ac.gs < 10) return false; // Bodenfahrzeuge / geparkte Flieger raus
            const dLat = Math.abs(ac.lat - ownLat), dLon = Math.abs(ac.lon - ownLon);
            if (dLat < 0.0015 && dLon < 0.0015) return false; // eigene Position ~0.1 NM
            return true;
          });
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
            console.log(`[TRAFFIC] ${all.length} gesamt → ${moving.length} fliegend → ${nearest.length} gesendet`);
        }, 500);
      }, TRAFFIC_POLL_MS);

      handle.on('close', () => {
        if (typeof setTrackerCommandHandler === 'function') setTrackerCommandHandler(null);
        clearInterval(runtimePollInterval);
        clearInterval(trafficInterval);
        // Nur reconnecten wenn WS noch offen ist, sonst wartet WS-Reconnect auf SimConnect-Neustart
        const ws = getWs();
        if (ws && ws.readyState === WebSocket.OPEN) {
          console.warn("⚠️  MSFS getrennt. Neuer SimConnect-Versuch in 5 Sekunden...");
          setTimeout(() => connectSimConnect(getWs, syncId, pin, setTrackerCommandHandler), 5000);
        }
      });
    })
    .catch(err => {
      const ws = getWs();
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.warn("⚠️  MSFS nicht gefunden / SimConnect-Fehler. Neuer Versuch in 5 Sekunden...");
        setTimeout(() => connectSimConnect(getWs, syncId, pin, setTrackerCommandHandler), 5000);
      }
    });
}

function askCredentials() {
  rl.question("Bitte gib deine Pilot-ID ein (z.B. Foxtrot-Mike-764): ", (idAnswer) => {
    const finalId = idAnswer.trim();
    if (!finalId) { console.log("Fehler: Keine Pilot-ID eingegeben."); return process.exit(1); }
    
    rl.question("Bitte gib deinen 4-stelligen PIN ein: ", (pinAnswer) => {
      const finalPin = pinAnswer.trim();
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({ syncId: finalId, pin: finalPin }));
      startTracker(finalId, finalPin);
    });
  });
}

function main() {
  console.log("=====================================");
  console.log(` ${TRACKER_DISPLAY_NAME}`);
  console.log("=====================================");

  let savedId = '';
  let savedPin = '';

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      savedId = data.syncId || '';
      savedPin = data.pin || '';
    } catch (e) {}
  }

  if (savedId && savedPin) {
    console.log("=====================================");
    console.log(` Gespeicherte Pilot-Daten gefunden:`);
    console.log(` Pilot-ID: [ ${savedId} ]`);
    console.log(` PIN: [ **** ]`);
    console.log("=====================================\n");
    
    let timeLeft = 5;
    let timerCompleted = false;

    // Startet den Countdown
    const countdownInterval = setInterval(() => {
      if (timeLeft > 0) {
        // \r überschreibt die aktuelle Zeile im Terminal, so entsteht die Animation
        process.stdout.write(`\r🚀 Autostart in ${timeLeft} Sekunden... (Drücke ENTER zum Ändern der Pilot-ID/PIN)   `);
        timeLeft--;
      } else {
        clearInterval(countdownInterval);
        if (!timerCompleted) {
          timerCompleted = true;
          console.log(`\n\n✅ Starte automatisch mit Pilot-ID: ${savedId}`);
          startTracker(savedId, savedPin);
        }
      }
    }, 1000);
    process.stdout.write(`\r🚀 Autostart in 5 Sekunden... (Drücke ENTER zum Ändern der Pilot-ID/PIN)   `);

    // Lauscht auf die ENTER Taste
    rl.once('line', () => {
      if (!timerCompleted) {
        timerCompleted = true;
        clearInterval(countdownInterval);
        console.log(`\n\n--- Neueingabe gestartet ---`);
        askCredentials();
      }
    });

  } else {
    askCredentials();
  }
}

// Globale Fehlerbehandlung: Prozess darf nie durch unbehandelte Fehler sterben
process.on('uncaughtException', (err) => {
  console.error("💥 Unbehandelter Fehler (Prozess läuft weiter):", err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error("💥 Unbehandelte Promise-Ablehnung (Prozess läuft weiter):", reason);
});

main();
