/**
 * GA Dispatcher — Simulations-Testskript
 * Sendet synthetische GPS-Daten an den Relay-Server (Raum DEINA, PIN 0815)
 *
 * Flugmuster (wiederholt, 8 Phasen à 15s):
 *   Phase 1: Nord  + STEIGEN  +800 ft/min
 *   Phase 2: Linkskurve 90°   (HDG 000 → 270) + Steigen
 *   Phase 3: West  + LEVEL    (kein VS)
 *   Phase 4: Linkskurve 90°   (HDG 270 → 180) + Level
 *   Phase 5: Süd   + SINKEN   -800 ft/min
 *   Phase 6: Linkskurve 90°   (HDG 180 → 090) + Sinken
 *   Phase 7: Ost   + LEVEL
 *   Phase 8: Linkskurve 90°   (HDG 090 → 000) + Level → zurück zu Phase 1
 *
 * Start: EDTW (Winzeln-Schramberg), 4500ft, 100 Knoten
 *
 * Starten mit: node sim-test.js
 */

const WebSocket = require('ws');

const WS_URL = 'wss://websocketrelais.onrender.com/';
const SYNC_ID = 'DEINA';
const PIN = '0815';

// Startposition: EDTW Winzeln-Schramberg
let lat = 48.279;
let lon = 8.428;
let alt = 4500;         // Fuss MSL
let hdg = 0;            // Grad (0 = Nord)
const GS_KTS = 100;     // Knoten Groundspeed

// Physik-Konstanten
const GS_MS = GS_KTS * 1852 / 3600;   // m/s (~51.44)
const EARTH_R_M = 6371000;
const TICK_MS = 100;                    // Sende-Interval (10 Hz, wie Tracker)
const PHASE_DURATION_MS = 15000;       // 15 Sekunden pro Phase
const TURN_RATE_DEG_PER_SEC = 90 / 15; // 6°/s für 90° in 15s
const VS_FPM = 800;                     // Steig-/Sinkrate ft/min
const ALT_MIN = 2000;                   // Untergrenze (ft)
const ALT_MAX = 8000;                   // Obergrenze (ft)

// VS pro Tick (ft): 800 ft/min → ft/s × Tick
const VS_PER_TICK = VS_FPM / 60 * (TICK_MS / 1000);

// VS-Muster pro Phase (0 = level, +1 = steigen, -1 = sinken)
// Phase:   0      1      2      3      4      5      6      7
const VS_PATTERN = [+1,  +1,    0,     0,    -1,    -1,     0,     0];

// Zustand
let phaseIndex = 0;
let phaseElapsedMs = 0;

/**
 * Position vorwärts bewegen (Haversine-inverse)
 */
function moveForward(lat, lon, hdgDeg, distM) {
    const hdgRad = hdgDeg * Math.PI / 180;
    const dLat = (distM * Math.cos(hdgRad)) / EARTH_R_M;
    const dLon = (distM * Math.sin(hdgRad)) / (EARTH_R_M * Math.cos(lat * Math.PI / 180));
    return {
        lat: lat + dLat * (180 / Math.PI),
        lon: lon + dLon * (180 / Math.PI)
    };
}

function startSim() {
    console.log(`\n🛫 GA Dispatcher Sim-Test`);
    console.log(`   Server : ${WS_URL}`);
    console.log(`   Raum   : ${SYNC_ID}  PIN: ${PIN}`);
    console.log(`   Start  : ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E  |  ${alt}ft  |  HDG ${hdg}°`);
    console.log(`   GS     : ${GS_KTS} kts`);
    console.log(`   Muster : Quadrat-Linkskurven mit Steigen/Sinken (±${VS_FPM} ft/min)\n`);

    const ws = new WebSocket(WS_URL);

    ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'join', syncId: SYNC_ID, pin: PIN }));
        console.log(`✅ Verbunden. Sende Daten...\n`);

        const interval = setInterval(() => {
            if (ws.readyState !== WebSocket.OPEN) {
                clearInterval(interval);
                return;
            }

            // Phase bestimmen: 0=Nord, 1=Linksdrehen, 2=West, 3=Linksdrehen,
            //                  4=Süd,  5=Linksdrehen, 6=Ost,  7=Linksdrehen
            const isCurrentlyTurning = phaseIndex % 2 === 1;

            if (isCurrentlyTurning) {
                // Linkskurve: Heading um Turnrate verringern
                hdg = (hdg - TURN_RATE_DEG_PER_SEC * (TICK_MS / 1000) + 360) % 360;
            }

            // Höhe aktualisieren (±VS, mit Grenzen)
            const vsDir = VS_PATTERN[phaseIndex];
            alt = Math.max(ALT_MIN, Math.min(ALT_MAX, alt + vsDir * VS_PER_TICK));

            // Position aktualisieren
            const distM = GS_MS * (TICK_MS / 1000);
            const newPos = moveForward(lat, lon, hdg, distM);
            lat = newPos.lat;
            lon = newPos.lon;

            // GPS senden
            ws.send(JSON.stringify({
                type: 'gps',
                syncId: SYNC_ID,
                pin: PIN,
                lat: parseFloat(lat.toFixed(6)),
                lon: parseFloat(lon.toFixed(6)),
                alt: Math.round(alt),
                hdg: Math.round(hdg)
            }));

            // Phasen-Fortschritt
            phaseElapsedMs += TICK_MS;
            if (phaseElapsedMs >= PHASE_DURATION_MS) {
                phaseElapsedMs = 0;
                phaseIndex = (phaseIndex + 1) % 8;

                const dirName = phaseIndex % 2 === 0
                    ? `Geradeaus (HDG ${Math.round(hdg)}°)`
                    : `Linkskurve → ${Math.round((hdg - 90 + 360) % 360)}°`;
                const vsLabel = VS_PATTERN[phaseIndex] > 0 ? '↑ STEIGEN' : VS_PATTERN[phaseIndex] < 0 ? '↓ SINKEN' : '→ LEVEL';
                console.log(`📍 Phase ${phaseIndex + 1}/8: ${dirName}  ${vsLabel}  |  ALT: ${Math.round(alt)}ft  |  Pos: ${lat.toFixed(4)}°, ${lon.toFixed(4)}°`);
            }
        }, TICK_MS);

        // Ctrl+C sauber beenden
        process.on('SIGINT', () => {
            clearInterval(interval);
            ws.close();
            console.log('\n\n🛬 Sim-Test beendet.');
            process.exit(0);
        });
    });

    ws.on('error', (err) => {
        console.error('❌ WebSocket-Fehler:', err.message);
    });

    ws.on('close', () => {
        console.log('🔌 Verbindung getrennt. Reconnect in 3s...');
        setTimeout(startSim, 3000);
    });
}

startSim();
