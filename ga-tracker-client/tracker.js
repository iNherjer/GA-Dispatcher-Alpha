const { open, SimConnectDataType } = require('node-simconnect');
const WebSocket = require('ws');
const readline = require('readline');
const fs = require('fs');

/**
 * GA TRACKER CLIENT - MSFS 2024 Edition
 * Inklusive Auto-Save Config, PIN-Auth & 5-Sekunden Boot-Timer
 */

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const WS_URL = 'wss://websocketrelais.onrender.com/';
const CONFIG_FILE = 'tracker-config.json';
const TRACKER_VERSION = 'v212';
const TRACKER_VERSION_CODE = 212;
const TRACKER_DISPLAY_NAME = `GA Tracker ${TRACKER_VERSION} (build ${TRACKER_VERSION_CODE})`;

function startTracker(syncId, pin) {
  let _reconnecting = false;
  let _reconnectTimer = null;
  let _simStarted = false;
  let _wsAttempt = 0;
  let _currentWs = null;

  const getWs = () => _currentWs;
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
      console.log(`📡 Verbunden mit ID: ${syncId} (Auth aktiv)`);
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
        connectSimConnect(getWs, syncId, pin);
      }
    });
    ws.on('pong', () => { awaitingPong = false; });

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

function connectSimConnect(getWs, syncId, pin) {
  open('VFR-Multitool-v206', 5)
    .then(({ handle }) => {
      console.log("✈️ MSFS gefunden! Warte auf Positionsdaten...");

      let lastSent = 0;
      const SEND_INTERVAL_MS = 66; 
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

      handle.requestDataOnSimObject(REQ_ID, DEF_ID, 0, 2, 0, 0, 0, 0);

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
                ws.send(JSON.stringify(gpsMsg));
                console.log(`Sende GPS: Lat ${lat.toFixed(4)} | Lon ${lon.toFixed(4)} | Alt ${Math.round(alt)}ft | Hdg ${Math.round(hdg)}° | AGL ${Math.round(agl || 0)}ft | GS ${flight.gsKts ?? '?'}kts | OnG ${flight.onGround ? 'Y' : 'N'} | Pause ${flight.simPaused ? 'Y' : 'N'}(${flight.pauseFlags ?? 0}) | Sim ${flight.simRunning ? 'RUN' : 'STOP'} | Menu ${flight.inMenuOrMap ? 'Y' : 'N'} | G ${flight.gForce.toFixed(2)} | Bank ${flight.bankDeg.toFixed(1)}° | Wind ${flight.windKts ?? '?'}kts/${flight.windDeg ?? '?'}° | Gust ${flight.windGustKts ?? '?'}kts | Temp ${flight.tempC ?? '?'}°C | Vis ${flight.visKm ?? '?'}km | Pcp ${flight.precipRateMmH ?? '?'}mm/h | Cloud ${flight.inCloud == null ? '?' : (flight.inCloud ? 'Y' : 'N')} | Turb ${flight.turbulencePct ?? '?'}%`);
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

      // Traffic alle 2 Sekunden abfragen
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
      }, 2000);

      handle.on('close', () => {
        clearInterval(runtimePollInterval);
        clearInterval(trafficInterval);
        // Nur reconnecten wenn WS noch offen ist, sonst wartet WS-Reconnect auf SimConnect-Neustart
        const ws = getWs();
        if (ws && ws.readyState === WebSocket.OPEN) {
          console.warn("⚠️  MSFS getrennt. Neuer SimConnect-Versuch in 5 Sekunden...");
          setTimeout(() => connectSimConnect(getWs, syncId, pin), 5000);
        }
      });
    })
    .catch(err => {
      const ws = getWs();
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.warn("⚠️  MSFS nicht gefunden / SimConnect-Fehler. Neuer Versuch in 5 Sekunden...");
        setTimeout(() => connectSimConnect(getWs, syncId, pin), 5000);
      }
    });
}

function askCredentials() {
  rl.question("Bitte gib deine Sync ID ein (z.B. Foxtrot-Mike-764): ", (idAnswer) => {
    const finalId = idAnswer.trim();
    if (!finalId) { console.log("Fehler: Keine ID eingegeben."); return process.exit(1); }
    
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
    console.log(` ID:  [ ${savedId} ]`);
    console.log(` PIN: [ **** ]`);
    console.log("=====================================\n");
    
    let timeLeft = 5;
    let timerCompleted = false;

    // Startet den Countdown
    const countdownInterval = setInterval(() => {
      if (timeLeft > 0) {
        // \r überschreibt die aktuelle Zeile im Terminal, so entsteht die Animation
        process.stdout.write(`\r🚀 Autostart in ${timeLeft} Sekunden... (Drücke ENTER zum Ändern der ID/PIN)   `);
        timeLeft--;
      } else {
        clearInterval(countdownInterval);
        if (!timerCompleted) {
          timerCompleted = true;
          console.log(`\n\n✅ Starte automatisch mit ID: ${savedId}`);
          startTracker(savedId, savedPin);
        }
      }
    }, 1000);
    process.stdout.write(`\r🚀 Autostart in 5 Sekunden... (Drücke ENTER zum Ändern der ID/PIN)   `);

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
