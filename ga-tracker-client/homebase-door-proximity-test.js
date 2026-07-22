'use strict';

const fs = require('fs');
const path = require('path');
const { open, Protocol } = require('node-simconnect');
const {
  OPEN_RADIUS_M,
  CLOSE_RADIUS_M,
  PLAYER_OPEN_RADIUS_M,
  PLAYER_CLOSE_RADIUS_M,
  CLOSE_DELAY_MS,
  collectDoorControls,
  distanceMeters,
  proximityZone,
  proximityForSources,
  finitePosition,
  nearestSource,
  createHomebaseDoorAutomation
} = require('./homebase-door-automation.js');

const APP_NAME = 'VFR Multitool Homebase Door Proximity Test';
const RUNTIME_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;
const LOG_FILE = path.join(RUNTIME_DIR, 'homebase-door-proximity-test.log');

function writeLog(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, `${line}\n`, 'utf8'); } catch (_) {}
}

function startConnection() {
  let stopped = false;
  let reconnectTimer = null;
  let controller = null;
  let handle = null;

  const connect = () => {
    if (stopped) return;
    writeLog(`Verbinde separaten SimConnect-Client "${APP_NAME}" ...`);
    open(APP_NAME, Protocol.KittyHawk)
      .then((connection) => {
        handle = connection.handle;
        controller = createHomebaseDoorAutomation(handle, { log: writeLog, enabled: true });
        writeLog(
          `Instanztest aktiv: Spieler öffnen jedes Tor bei <= ${PLAYER_OPEN_RADIUS_M} m und schließen es bei >= ${PLAYER_CLOSE_RADIUS_M} m; ` +
          `Homebase-Mitarbeiter verwenden ${OPEN_RADIUS_M}/${CLOSE_RADIUS_M} m. Schließverzögerung: ${Math.round(CLOSE_DELAY_MS / 1000)} s.`
        );
        handle.on('exception', (recv) => {
          writeLog(`SimConnect-Ausnahme: ${recv.exceptionName || recv.exception || 'unbekannt'} (sendId ${recv.sendId ?? '?'})`);
        });
        handle.on('close', () => {
          controller?.stop();
          controller = null;
          handle = null;
          if (!stopped) {
            writeLog('MSFS/SimConnect nicht verbunden. Neuer Versuch in 5 Sekunden.');
            reconnectTimer = setTimeout(connect, 5000);
          }
        });
      })
      .catch((error) => {
        writeLog(`SimConnect-Verbindung fehlgeschlagen: ${error?.message || error}`);
        if (!stopped) reconnectTimer = setTimeout(connect, 5000);
      });
  };

  const stop = () => {
    stopped = true;
    clearTimeout(reconnectTimer);
    controller?.stop();
    try { handle?.close(); } catch (_) {}
    writeLog('Test beendet.');
  };

  process.once('SIGINT', () => { stop(); process.exit(0); });
  process.once('SIGTERM', () => { stop(); process.exit(0); });
  connect();
  return { stop };
}

if (require.main === module) {
  console.log('VFR Multitool Homebase – instanzbezogener Tor-Nähetest');
  console.log('Diese Test-EXE läuft unabhängig und parallel zum normalen Tracker.');
  console.log(`Logdatei: ${LOG_FILE}`);
  console.log('Zum Beenden Strg+C drücken.\n');
  startConnection();
}

module.exports = {
  OPEN_RADIUS_M,
  CLOSE_RADIUS_M,
  PLAYER_OPEN_RADIUS_M,
  PLAYER_CLOSE_RADIUS_M,
  CLOSE_DELAY_MS,
  collectDoorControls,
  distanceMeters,
  proximityZone,
  proximityForSources,
  finitePosition,
  nearestSource,
  startConnection
};
