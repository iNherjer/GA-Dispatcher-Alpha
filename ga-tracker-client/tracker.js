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

function startTracker(syncId, pin) {
  let _reconnecting = false;

  function connect() {
    if (_reconnecting) return;
    _reconnecting = true;
    console.log(`\nVerbinde mit WebSocket-Server: ${WS_URL}...`);
    const ws = new WebSocket(WS_URL);

    ws.on('open', () => {
      _reconnecting = false;
      ws.send(JSON.stringify({ type: 'join', syncId: syncId, pin: pin }));
      console.log(`📡 Verbunden mit ID: ${syncId} (Auth aktiv)`);
      connectSimConnect(ws, syncId, pin);
    });

    ws.on('error', (err) => {
      console.error("❌ WebSocket-Fehler:", err.message);
      // 'close' wird danach automatisch gefeuert, daher hier kein reconnect nötig
    });

    ws.on('close', () => {
      console.warn("⚠️  WebSocket getrennt. Neuverbindung in 5 Sekunden...");
      _reconnecting = false;
      setTimeout(connect, 5000);
    });
  }

  connect();
}

function connectSimConnect(ws, syncId, pin) {
  open('VFR-Multitool-v206', 5)
    .then(({ handle }) => {
      console.log("✈️ MSFS gefunden! Warte auf Positionsdaten...");

      let lastSent = 0;
      const SEND_INTERVAL_MS = 66; 
      const DEF_ID = 206;
      const REQ_ID = 206;

      handle.addToDataDefinition(DEF_ID, 'PLANE LATITUDE', 'degrees', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'PLANE LONGITUDE', 'degrees', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'PLANE ALTITUDE', 'feet', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'PLANE HEADING DEGREES TRUE', 'degrees', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'PLANE ALT ABOVE GROUND', 'feet', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'PLANE BANK DEGREES', 'degrees', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'G FORCE', 'GForce', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'VERTICAL SPEED', 'feet per minute', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'GENERAL ENG RPM:1', 'rpm', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'SIM ON GROUND', 'Bool', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'PLANE TOUCHDOWN NORMAL VELOCITY', 'feet per second', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'AMBIENT WIND VELOCITY', 'knots', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'AMBIENT WIND DIRECTION', 'degrees', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'AMBIENT TEMPERATURE', 'celsius', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'AMBIENT VISIBILITY', 'meters', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'INCIDENCE ALPHA', 'degrees', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'STALL WARNING', 'Bool', SimConnectDataType.FLOAT64);

      handle.requestDataOnSimObject(REQ_ID, DEF_ID, 0, 2, 0, 0, 0, 0);

      handle.on('simObjectData', (recv) => {
        if (recv.requestID === REQ_ID) {
          const now = Date.now();
          if (now - lastSent >= SEND_INTERVAL_MS) {
            lastSent = now;
            
            try {
              let lat, lon, alt, hdg, agl, bank, gForce, vsFpm, engRpm, onGround, touchdownFps;
              let windKts, windDeg, tempC, visMeters, aoaDeg, stallState;

              if (typeof recv.data.readFloat64 === 'function') {
                lat = recv.data.readFloat64(); lon = recv.data.readFloat64(); alt = recv.data.readFloat64(); hdg = recv.data.readFloat64();
                agl = recv.data.readFloat64(); bank = recv.data.readFloat64(); gForce = recv.data.readFloat64(); vsFpm = recv.data.readFloat64();
                engRpm = recv.data.readFloat64(); onGround = recv.data.readFloat64(); touchdownFps = recv.data.readFloat64();
                windKts = recv.data.readFloat64(); windDeg = recv.data.readFloat64(); tempC = recv.data.readFloat64(); visMeters = recv.data.readFloat64();
                aoaDeg = recv.data.readFloat64(); stallState = recv.data.readFloat64();
              } else if (typeof recv.data.readDouble === 'function') {
                lat = recv.data.readDouble(); lon = recv.data.readDouble(); alt = recv.data.readDouble(); hdg = recv.data.readDouble();
                agl = recv.data.readDouble(); bank = recv.data.readDouble(); gForce = recv.data.readDouble(); vsFpm = recv.data.readDouble();
                engRpm = recv.data.readDouble(); onGround = recv.data.readDouble(); touchdownFps = recv.data.readDouble();
                windKts = recv.data.readDouble(); windDeg = recv.data.readDouble(); tempC = recv.data.readDouble(); visMeters = recv.data.readDouble();
                aoaDeg = recv.data.readDouble(); stallState = recv.data.readDouble();
              } else return;

              if (ws.readyState === WebSocket.OPEN && (lat !== 0 || lon !== 0)) {
                ownLat = lat; ownLon = lon; // für Traffic-Eigenfilter
                // GPS-Paket senden; Traffic wird alle 2s als Feld eingebettet (Relay-kompatibler Weg)
                const flight = {
                  mslFt: Math.round(alt || 0),
                  aglFt: Math.round(agl || 0),
                  bankDeg: Number.isFinite(bank) ? Math.round(bank * 10) / 10 : 0,
                  gForce: Number.isFinite(gForce) ? Math.round(gForce * 100) / 100 : 1,
                  vsFpm: Math.round(vsFpm || 0),
                  engRpm: Math.round(engRpm || 0),
                  onGround: !!onGround,
                  touchdownFps: Number.isFinite(touchdownFps) ? Math.round(touchdownFps * 100) / 100 : null,
                  touchdownFpm: Number.isFinite(touchdownFps) ? Math.round(touchdownFps * 60) : null,
                  windKts:  Number.isFinite(windKts)  ? Math.round(windKts  * 10) / 10 : null,
                  windDeg:  Number.isFinite(windDeg)  ? Math.round(windDeg)          : null,
                  tempC:    Number.isFinite(tempC)    ? Math.round(tempC * 10) / 10   : null,
                  visKm:    Number.isFinite(visMeters) ? Math.round(visMeters / 100) / 10 : null,
                  aoaDeg:   Number.isFinite(aoaDeg) ? Math.round(aoaDeg * 10) / 10 : null,
                  stallState: Number.isFinite(stallState) ? (stallState > 0.5) : false
                };
                const gpsMsg = {
                  type: 'gps',
                  syncId: syncId,
                  pin: pin,
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
                console.log(`Sende GPS: Lat ${lat.toFixed(4)} | Lon ${lon.toFixed(4)} | Alt ${Math.round(alt)}ft | Hdg ${Math.round(hdg)}° | AGL ${Math.round(agl || 0)}ft | G ${flight.gForce.toFixed(2)} | Bank ${flight.bankDeg.toFixed(1)}° | Wind ${flight.windKts ?? '?'}kts/${flight.windDeg ?? '?'}° | Temp ${flight.tempC ?? '?'}°C | Vis ${flight.visKm ?? '?'}km`);
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
        if (ws.readyState !== 1 /*OPEN*/) return;
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
        clearInterval(trafficInterval);
        // Nur reconnecten wenn WS noch offen ist, sonst wartet WS-Reconnect auf SimConnect-Neustart
        if (ws.readyState === WebSocket.OPEN) {
          console.warn("⚠️  MSFS getrennt. Neuer SimConnect-Versuch in 5 Sekunden...");
          setTimeout(() => connectSimConnect(ws, syncId, pin), 5000);
        }
      });
    })
    .catch(err => {
      if (ws.readyState === WebSocket.OPEN) {
        console.warn("⚠️  MSFS nicht gefunden / SimConnect-Fehler. Neuer Versuch in 5 Sekunden...");
        setTimeout(() => connectSimConnect(ws, syncId, pin), 5000);
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
