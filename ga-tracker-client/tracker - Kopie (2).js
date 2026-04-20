const { open, SimConnectDataType } = require('node-simconnect');
const WebSocket = require('ws');
const readline = require('readline');
const fs = require('fs'); // NEU: Für das Speichern der Sync-ID

/**
 * GA TRACKER CLIENT - MSFS 2024 Edition
 * Inklusive Auto-Save Config & dynamischem Float64 Puffer-Reader
 */

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const WS_URL = 'wss://websocketrelais.onrender.com/';

function startTracker(syncId) {
  if (!syncId) process.exit(1);

  console.log(`\nVerbinde mit WebSocket-Server: ${WS_URL}...`);
  const ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'join', syncId: syncId }));
    console.log(`📡 Verbunden mit ID: ${syncId}`);
    connectSimConnect(ws, syncId);
  });

  ws.on('error', (err) => console.error("❌ WebSocket-Fehler:", err.message));
  ws.on('close', () => process.exit());
}

function connectSimConnect(ws, syncId) {
  // Version 205, um einen komplett neuen Notizblock im Sim zu erzwingen
  open('GA-Tracker-v205', 5)
    .then(({ handle }) => {
      console.log("✈️ MSFS gefunden! Warte auf Positionsdaten...");

      let lastSent = 0;
      const SEND_INTERVAL_MS = 66; // Ca. 15 Hz
      const DEF_ID = 205;
      const REQ_ID = 205;

      // Alles als FLOAT64 (jeweils 8 Bytes) bestellen
      handle.addToDataDefinition(DEF_ID, 'PLANE LATITUDE', 'degrees', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'PLANE LONGITUDE', 'degrees', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'PLANE ALTITUDE', 'feet', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_ID, 'PLANE HEADING DEGREES TRUE', 'degrees', SimConnectDataType.FLOAT64);

      // 2 = SIM_FRAME
      handle.requestDataOnSimObject(REQ_ID, DEF_ID, 0, 2, 0, 0, 0, 0);

      handle.on('simObjectData', (recv) => {
        if (recv.requestID === REQ_ID) {
          const now = Date.now();
          if (now - lastSent >= SEND_INTERVAL_MS) {
            lastSent = now;
            
            try {
              let lat, lon, alt, hdg;
              
              // Die Bibliothek liest selbst und überspringt den Header automatisch!
              if (typeof recv.data.readFloat64 === 'function') {
                lat = recv.data.readFloat64();
                lon = recv.data.readFloat64();
                alt = recv.data.readFloat64();
                hdg = recv.data.readFloat64();
              } else if (typeof recv.data.readDouble === 'function') {
                // Fallback, falls die Methode in der Bibliothek anders heißt
                lat = recv.data.readDouble();
                lon = recv.data.readDouble();
                alt = recv.data.readDouble();
                hdg = recv.data.readDouble();
              } else {
                console.log("Fehler: Konnte Bibliothek nicht zum Lesen bewegen.");
                return;
              }

              // Funken, sobald wir nicht mehr in Afrika (0/0) sind!
              if (ws.readyState === WebSocket.OPEN && (lat !== 0 || lon !== 0)) {
                ws.send(JSON.stringify({
                  type: 'gps',
                  syncId: syncId,
                  lat: lat,
                  lon: lon,
                  alt: Math.round(alt),
                  hdg: Math.round(hdg)
                }));
                
                console.log(`Sende GPS: Lat ${lat.toFixed(4)} | Lon ${lon.toFixed(4)} | Alt ${Math.round(alt)}ft | Hdg ${Math.round(hdg)}°`);
              } else if (lat === 0) {
                 process.stdout.write("."); // Zeigt im Terminal Punkte an, solange der Sim lädt/im Menü ist
              }
            } catch (e) {
              console.error("❌ Lesefehler:", e.message);
            }
          }
        }
      });
      
      handle.on('close', () => setTimeout(() => connectSimConnect(ws, syncId), 5000));
    })
    .catch(err => setTimeout(() => connectSimConnect(ws, syncId), 5000));
}

function main() {
  // Wenn über Kommandozeile / Batch-Datei gestartet
  const args = process.argv.slice(2);
  if (args.length > 0) {
    console.log(`🚀 Auto-Start mit ID: ${args[0]}`);
    return startTracker(args[0]);
  }

  const configFile = 'tracker-config.json';
  let savedId = '';

  // Versuchen, eine alte ID aus dem config-file zu laden
  if (fs.existsSync(configFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      savedId = data.syncId || '';
    } catch (e) {
       // Falls die Datei kaputt ist, stillschweigend ignorieren
    }
  }

  // Wenn wir eine ID im Gedächtnis haben:
  if (savedId) {
    console.log("=====================================");
    console.log(` Gespeicherte Sync-ID gefunden:`);
    console.log(` [ ${savedId} ]`);
    console.log("=====================================\n");
    
    rl.question("Drücke einfach ENTER um diese zu nutzen, oder tippe eine NEUE ID ein: ", (answer) => {
      const finalId = answer.trim() || savedId; // Nimmt die alte, wenn einfach Enter gedrückt wird
      
      // Neue ID merken, falls der User etwas eingetippt hat
      if (answer.trim()) {
        fs.writeFileSync(configFile, JSON.stringify({ syncId: finalId }));
      }
      startTracker(finalId);
    });
  } else {
    // Wenn er das Tool zum allerersten Mal öffnet:
    rl.question("Bitte gib deine Sync ID ein (z.B. Foxtrot-Mike-764): ", (answer) => {
      const finalId = answer.trim();
      if (finalId) {
        // ID für die Zukunft in die kleine json-Datei schreiben
        fs.writeFileSync(configFile, JSON.stringify({ syncId: finalId }));
        startTracker(finalId);
      } else {
        console.log("Fehler: Keine ID eingegeben.");
        main();
      }
    });
  }
}

main();