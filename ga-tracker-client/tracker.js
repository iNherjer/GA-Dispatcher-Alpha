const { open, SimConnectDataType, SimConnectPeriod, InitPosition } = require('node-simconnect');
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
const TRACKER_VERSION = 'v215';
const TRACKER_VERSION_CODE = 215;
const TRACKER_DISPLAY_NAME = `GA Tracker ${TRACKER_VERSION} (build ${TRACKER_VERSION_CODE})`;
const MISSION_SMOKE_DEFAULT_TITLE = 'Chimney_Smoke_V1';
const MISSION_FIRE_DEFAULT_TITLE = 'VO_Fire_R1_40';
const TRACKER_DEBUG_FILE = path.join(process.pkg ? path.dirname(process.execPath) : __dirname, 'ga-tracker-debug.txt');

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

function createMissionSmokeController(handle, getWs, syncId, pin, getLastGpsMsg = null) {
  const missions = new Map();
  const pendingAssign = new Map();
  const lastExceptions = [];
  let nextReqId = 9300;

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
    pendingAssign.set(requestId, (objectId) => {
      clearTimeout(timer);
      resolve(objectId);
    });
  });

  const spawnObject = async (title, pos, timeoutMs = 5000) => {
    const requestId = nextReqId++;
    const waitPromise = waitForAssignedObject(requestId, timeoutMs);
    handle.aICreateSimulatedObject(title, buildInitPos(pos.lat, pos.lon, pos.altFt, pos.hdg, true), requestId);
    return waitPromise;
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
    let positions = [];

    if (smokeSites.length > 0) {
      smokeSites.forEach((site, idx) => {
        positions.push(...buildSpawnPlanForSite(site, { title, altFt, hdg, count, radiusM }, 'smoke', idx + 1));
      });
    } else if (Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(altFt)) {
      positions = buildSpawnPlanForSite({ lat, lon, altFt, hdg, count, radiusM, objectTitle: title, siteId: 'smoke-1', label: 'Rauchentwicklung' }, { title, altFt, hdg, count, radiusM }, 'smoke', 1);
    }

    fireSites.forEach((site, idx) => {
      positions.push(...buildSpawnPlanForSite(site, { title: fireTitle, altFt, hdg, count: 1, radiusM: 0, altOffsetFt: -80 }, 'fire', idx + 1));
    });

    if (positions.length === 0) {
      debugLog(`SPAWN_INVALID mission=${missionId} title="${title}" lat=${lat} lon=${lon} altFt=${altFt} smokeSites=${smokeSites.length} fireSites=${fireSites.length}`);
      sendAck({ type: 'mission_smoke_spawn_ack', commandId, missionId, status: 'error', error: 'invalid spawn sites/lat/lon/altFt' });
      return;
    }

    await clearMission(missionId, 'replace-before-spawn');
    const objects = [];
    console.log(`🔥 Smoke Mission ${missionId}: spawn ${positions.length} Objekte (${JSON.stringify(countByKind(positions))})`);
    debugLog(`SPAWN_START mission=${missionId} extent=${command?.extent || 'n/a'} title="${title}" fireTitle="${fireTitle}" count=${positions.length} byKind=${JSON.stringify(countByKind(positions))}`);

    for (const p of positions) {
      try {
        const objectId = await spawnObject(p.title, p, 5000);
        objects.push({ objectId, ...p });
        console.log(`  OK ${p.kind} site=${p.siteIndex} obj=${p.index}: objectId=${objectId}`);
        debugLog(`SPAWN_OK mission=${missionId} kind=${p.kind} site=${p.siteIndex} index=${p.index} objectId=${objectId} title="${p.title}" lat=${p.lat} lon=${p.lon} altFt=${p.altFt}`);
      } catch (err) {
        console.warn(`  ✗ ${p.kind} site=${p.siteIndex} obj=${p.index}: ${err?.message || err}`);
        debugLog(`SPAWN_ERROR mission=${missionId} kind=${p.kind} site=${p.siteIndex} index=${p.index} title="${p.title}" error=${err?.message || err}`);
      }
    }

    missions.set(missionId, { missionId, title, spawnedAt: Date.now(), command: { ...command }, objects, positions });
    sendAck({
      type: 'mission_smoke_spawn_ack',
      commandId,
      missionId,
      status: objects.length > 0 ? 'ok' : 'error',
      objectTitle: title,
      requested: positions.length,
      spawned: objects.length,
      requestedByKind: countByKind(positions),
      spawnedByKind: countByKind(objects),
      sites: [...new Set(positions.map(p => `${p.kind}:${p.siteId}`))],
      objects: objects.map(o => ({ objectId: o.objectId, index: o.index, kind: o.kind, siteIndex: o.siteIndex }))
    });
  };

  handle.on('assignedObjectID', (recv) => {
    const fn = pendingAssign.get(recv.requestID);
    if (fn) {
      pendingAssign.delete(recv.requestID);
      fn(recv.objectID);
    }
  });

  handle.on('exception', (recv) => {
    const name = recv.exceptionName || String(recv.exception);
    lastExceptions.push(name);
    if (pendingAssign.size > 0) console.warn(`[SimConnect Exception] ${name} sendId=${recv.sendId}`);
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
      return false;
    },
    clearAll(reason = 'shutdown') {
      return Promise.all([...missions.keys()].map(id => clearMission(id, reason)));
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
