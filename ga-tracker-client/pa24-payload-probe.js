'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const {
  open,
  Protocol,
  RawBuffer,
  SimConnectConstants,
  SimConnectDataType,
  SimConnectPeriod
} = require('node-simconnect');
const {
  chooseFreeSeatAndCharacter,
  chooseProbeValue,
  csvEscape,
  detectPa24Aircraft,
  finiteNumber,
  payloadSummary,
  round
} = require('./pa24-payload-probe-core');

const TOOL_VERSION = '1.1.0';
const APP_NAME = 'GA-PA24-Payload-Probe';
const RUNTIME_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;
const SNAPSHOT_DEF_ID = 24100;
const REQUEST_ID_START = 24200;
const WRITE_DEF_ID_START = 24500;
const MAX_PAYLOAD_STATIONS = 20;
const OBSERVATION_DELAYS_MS = [0, 250, 1000, 3000, 10000];
const RESTORE_DELAYS_MS = [1000, 3000];
const RECOVERY_FILE = path.join(RUNTIME_DIR, 'PA24-Payload-Probe-Recovery.json');

let handle = null;
let nextRequestId = REQUEST_ID_START;
let nextWriteDefId = WRITE_DEF_ID_START;
let abortRequested = false;
const pendingSnapshots = new Map();
const writeDefinitions = new Map();
const observations = [];
const recentExceptions = [];

const NUMERIC_VARIABLES = [
  ...[1, 2, 3, 4].map((seat) => ({
    key: `Seat${seat}Character`,
    simvar: `L:Seat${seat}Character`,
    unit: 'enum',
    group: 'lvars'
  })),
  ...Array.from({ length: 20 }, (_, index) => ({
    key: `Character${index + 1}Weight`,
    simvar: `L:Character${index + 1}Weight`,
    unit: 'number',
    group: 'lvars'
  })),
  ...['BaggageWeight', 'BaggageAWeight', 'BaggageBWeight', 'BaggageCWeight'].map((key) => ({
    key,
    simvar: `L:${key}`,
    unit: 'pounds',
    group: 'lvars'
  })),
  ...['PayloadWeight', 'TotalWeight', 'GrossWeight', 'EmptyWeight'].map((key) => ({
    key,
    simvar: `L:${key}`,
    unit: 'pounds',
    group: 'lvars'
  })),
  { key: 'totalWeightLbs', simvar: 'TOTAL WEIGHT', unit: 'pounds', group: 'sim' },
  { key: 'emptyWeightLbs', simvar: 'EMPTY WEIGHT', unit: 'pounds', group: 'sim' },
  { key: 'fuelWeightLbs', simvar: 'FUEL TOTAL QUANTITY WEIGHT', unit: 'pounds', group: 'sim' },
  { key: 'payloadStationCount', simvar: 'PAYLOAD STATION COUNT', unit: 'number', group: 'sim' },
  ...Array.from({ length: MAX_PAYLOAD_STATIONS }, (_, index) => ({
    key: `payloadStation${index + 1}`,
    simvar: `PAYLOAD STATION WEIGHT:${index + 1}`,
    unit: 'pounds',
    group: 'stations',
    index: index + 1
  }))
];

function parseArgs(argv) {
  const options = {
    force: false,
    readOnly: false,
    noPause: false,
    yes: false,
    help: false
  };
  argv.forEach((token) => {
    if (token === '--force') options.force = true;
    else if (token === '--read-only') options.readOnly = true;
    else if (token === '--no-pause') options.noPause = true;
    else if (token === '--yes') options.yes = true;
    else if (token === '--help' || token === '-h') options.help = true;
  });
  return options;
}

function printUsage() {
  console.log('');
  console.log('PA24 Payload Probe');
  console.log('');
  console.log('  --read-only   Nur Werte lesen, nichts schreiben');
  console.log('  --force       Schreibtest trotz nicht erkannter Comanche erlauben');
  console.log('  --yes         Sicherheitsabfrage automatisch bestaetigen');
  console.log('  --no-pause    Konsole am Ende nicht offenhalten');
  console.log('');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function fileTimestamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('');
}

function writeJsonAtomic(filePath, payload) {
  const temporary = `${filePath}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(temporary, filePath);
}

function readRecoveryFile() {
  if (!fs.existsSync(RECOVERY_FILE)) return null;
  try {
    const payload = JSON.parse(fs.readFileSync(RECOVERY_FILE, 'utf8'));
    return payload && typeof payload === 'object' ? payload : null;
  } catch (_) {
    return null;
  }
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(String(answer || '').trim());
    });
  });
}

function readFloat64(data) {
  if (typeof data?.readFloat64 === 'function') return Number(data.readFloat64());
  if (typeof data?.readDouble === 'function') return Number(data.readDouble());
  throw new Error('SimConnect-Datenpuffer hat keinen Float64-Leser.');
}

function readString256(data) {
  if (typeof data?.readString256 === 'function') return String(data.readString256() || '').trim();
  if (typeof data?.readString === 'function') return String(data.readString(256) || '').trim();
  throw new Error('SimConnect-Datenpuffer hat keinen String256-Leser.');
}

function installDefinitions() {
  handle.addToDataDefinition(SNAPSHOT_DEF_ID, 'TITLE', null, SimConnectDataType.STRING256);
  handle.addToDataDefinition(SNAPSHOT_DEF_ID, 'ATC MODEL', null, SimConnectDataType.STRING256);
  handle.addToDataDefinition(SNAPSHOT_DEF_ID, 'ATC TYPE', null, SimConnectDataType.STRING256);
  NUMERIC_VARIABLES.forEach((entry) => {
    handle.addToDataDefinition(SNAPSHOT_DEF_ID, entry.simvar, entry.unit, SimConnectDataType.FLOAT64);
  });
}

function parseSnapshot(data) {
  const snapshot = {
    at: new Date().toISOString(),
    aircraft: {
      title: readString256(data),
      model: readString256(data),
      type: readString256(data)
    },
    lvars: {},
    sim: {
      payloadStations: []
    }
  };
  NUMERIC_VARIABLES.forEach((entry) => {
    const value = readFloat64(data);
    if (entry.group === 'lvars') snapshot.lvars[entry.key] = value;
    else if (entry.group === 'sim') snapshot.sim[entry.key] = value;
    else if (entry.group === 'stations') {
      snapshot.sim.payloadStations.push({
        index: entry.index,
        weightLbs: value
      });
    }
  });
  return snapshot;
}

function installHandlers() {
  handle.on('simObjectData', (recv) => {
    const pending = pendingSnapshots.get(recv.requestID);
    if (!pending) return;
    pendingSnapshots.delete(recv.requestID);
    clearTimeout(pending.timer);
    try {
      pending.resolve(parseSnapshot(recv.data));
    } catch (error) {
      pending.reject(error);
    }
  });

  handle.on('exception', (recv) => {
    const exception = {
      at: new Date().toISOString(),
      name: recv.exceptionName || String(recv.exception || 'SimConnect exception'),
      sendId: recv.sendId ?? null
    };
    recentExceptions.push(exception);
    console.log(`[SimConnect] ${exception.name}${exception.sendId == null ? '' : ` (sendId ${exception.sendId})`}`);
  });

  handle.on('error', (error) => {
    console.log(`[SimConnect] Fehler: ${error?.message || error}`);
  });

  handle.on('close', () => {
    console.log('[SimConnect] Verbindung geschlossen.');
  });
}

function requestSnapshot(timeoutMs = 6000) {
  const requestId = nextRequestId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingSnapshots.delete(requestId);
      reject(new Error('Snapshot-Zeitueberschreitung'));
    }, timeoutMs);
    pendingSnapshots.set(requestId, { resolve, reject, timer });
    try {
      handle.requestDataOnSimObject(
        requestId,
        SNAPSHOT_DEF_ID,
        SimConnectConstants.OBJECT_ID_USER,
        SimConnectPeriod.ONCE,
        0,
        0,
        0,
        0
      );
    } catch (error) {
      clearTimeout(timer);
      pendingSnapshots.delete(requestId);
      reject(error);
    }
  });
}

function ensureWriteDefinition(simvar, unit) {
  const key = `${simvar}\u0000${unit}`;
  if (writeDefinitions.has(key)) return writeDefinitions.get(key);
  const definitionId = nextWriteDefId++;
  handle.addToDataDefinition(definitionId, simvar, unit, SimConnectDataType.FLOAT64);
  writeDefinitions.set(key, definitionId);
  return definitionId;
}

function writeLvar(key, value) {
  const simvar = `L:${key}`;
  const unit = /^Seat\d+Character$/.test(key)
    ? 'enum'
    : (/^Character\d+Weight$/.test(key) ? 'number' : 'pounds');
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) throw new Error(`Ungueltiger Schreibwert fuer ${key}`);
  const definitionId = ensureWriteDefinition(simvar, unit);
  const buffer = new RawBuffer(8);
  buffer.writeFloat64(numericValue);
  handle.setDataOnSimObject(definitionId, SimConnectConstants.OBJECT_ID_USER, {
    buffer,
    arrayCount: 0,
    tagged: false
  });
}

function printSnapshot(snapshot, label = 'Snapshot') {
  const summary = payloadSummary(snapshot);
  console.log('');
  console.log(`--- ${label} ---`);
  console.log(`Flugzeug : ${snapshot.aircraft.title || '-'} | ${snapshot.aircraft.model || '-'} | ${snapshot.aircraft.type || '-'}`);
  console.log(`Sitze    : S1=${summary.seats[0]} S2=${summary.seats[1]} S3=${summary.seats[2]} S4=${summary.seats[3]}`);
  console.log(
    `Baggage : ${summary.baggageWeightLbs} lbs | A=${summary.baggageAWeightLbs} ` +
    `B=${summary.baggageBWeightLbs} C=${summary.baggageCWeightLbs}`
  );
  console.log(
    `Accu-Sim: Payload=${summary.accuPayloadWeightLbs} Total=${summary.accuTotalWeightLbs} ` +
    `Empty=${summary.accuEmptyWeightLbs} Gross=${summary.accuGrossWeightLbs}`
  );
  console.log(
    `MSFS     : PayloadStations=${summary.simPayloadWeightLbs} Total=${summary.simTotalWeightLbs} ` +
    `Empty=${summary.simEmptyWeightLbs} Fuel=${summary.simFuelWeightLbs} Stations=${summary.simPayloadStationCount}`
  );
}

function recordObservation(testName, phase, delayMs, snapshot, requested = null) {
  const summary = payloadSummary(snapshot);
  observations.push({
    testName,
    phase,
    delayMs,
    requested,
    snapshot,
    summary
  });
  console.log(
    `[${testName}] ${phase.padEnd(8)} t=${String(delayMs).padStart(5)}ms ` +
    `Baggage=${summary.baggageWeightLbs} Payload=${summary.accuPayloadWeightLbs} ` +
    `Total=${summary.accuTotalWeightLbs} Seats=${summary.seats.join('/')}`
  );
}

async function observe(testName, phase, delays, requested = null) {
  let elapsed = 0;
  for (const delay of delays) {
    if (abortRequested) throw new Error('Test abgebrochen');
    const waitMs = Math.max(0, Number(delay) - elapsed);
    if (waitMs > 0) await sleep(waitMs);
    elapsed = Number(delay);
    const snapshot = await requestSnapshot();
    recordObservation(testName, phase, delay, snapshot, requested);
  }
}

async function restoreTouchedVariables(touched, baseline, testName = 'RESTORE') {
  const entries = [...touched.entries()].reverse();
  entries.forEach(([key, value]) => writeLvar(key, value));
  if (entries.length) await observe(testName, 'restore', RESTORE_DELAYS_MS);
  touched.clear();
}

async function runSingleVariableProbe(key, baseline, options = {}) {
  const original = finiteNumber(baseline.lvars[key], 0);
  const target = chooseProbeValue(original, {
    min: options.min ?? 0,
    max: options.max ?? 200,
    delta: options.delta ?? 5
  });
  if (target === original) {
    console.log(`[${key}] Kein sicherer Testwert verfuegbar; Test uebersprungen.`);
    return;
  }
  const touched = new Map([[key, original]]);
  console.log('');
  console.log(`[${key}] Schreibe testweise ${target} statt ${round(original)}.`);
  try {
    writeLvar(key, target);
    await observe(key, 'write', OBSERVATION_DELAYS_MS, { key, value: target });
  } finally {
    await restoreTouchedVariables(touched, baseline, key);
  }
}

async function runSeatBindingProbe(baseline) {
  const allocation = chooseFreeSeatAndCharacter(baseline.lvars);
  if (!allocation.available) {
    console.log('');
    console.log('[Seat-Binding] Kein freier Sitz oder keine freie Character-ID; Test sicher uebersprungen.');
    return;
  }
  const seatKey = `Seat${allocation.seat}Character`;
  const characterKey = `Character${allocation.character}Weight`;
  const originalSeat = finiteNumber(baseline.lvars[seatKey], 0);
  const originalWeight = finiteNumber(baseline.lvars[characterKey], 0);
  const testWeight = Math.abs(originalWeight - 17) > 0.001 ? 17 : 23;
  const touched = new Map([
    [characterKey, originalWeight],
    [seatKey, originalSeat]
  ]);
  console.log('');
  console.log(
    `[Seat-Binding] Freier Sitz ${allocation.seat}, freie Character-ID ${allocation.character}. ` +
    `Testgewicht ${testWeight} lbs.`
  );
  try {
    writeLvar(characterKey, testWeight);
    await observe('Seat-Binding', 'char-only', [0, 500, 1500], {
      key: characterKey,
      value: testWeight
    });
    writeLvar(seatKey, allocation.character);
    await observe('Seat-Binding', 'occupied', OBSERVATION_DELAYS_MS, {
      key: seatKey,
      value: allocation.character,
      characterKey,
      characterWeightLbs: testWeight
    });
  } finally {
    await restoreTouchedVariables(touched, baseline, 'Seat-Binding');
  }
}

function recoveryPayload(baseline, restoreRequired) {
  return {
    tool: APP_NAME,
    version: TOOL_VERSION,
    createdAt: new Date().toISOString(),
    restoreRequired,
    aircraft: baseline.aircraft,
    lvars: baseline.lvars
  };
}

async function restoreFromRecovery(recovery) {
  const lvars = recovery?.lvars || {};
  const writableKeys = [
    ...[1, 2, 3, 4].map((seat) => `Seat${seat}Character`),
    ...Array.from({ length: 20 }, (_, index) => `Character${index + 1}Weight`),
    'BaggageWeight',
    'BaggageAWeight',
    'BaggageBWeight',
    'BaggageCWeight'
  ];
  writableKeys.forEach((key) => {
    if (Number.isFinite(Number(lvars[key]))) writeLvar(key, Number(lvars[key]));
  });
  await sleep(1000);
  const restored = await requestSnapshot();
  printSnapshot(restored, 'Nach Recovery-Wiederherstellung');
  writeJsonAtomic(RECOVERY_FILE, {
    ...recovery,
    restoreRequired: false,
    restoredAt: new Date().toISOString(),
    restoredSnapshot: restored
  });
}

function writeReports(baseline, finalSnapshot) {
  const stamp = fileTimestamp();
  const jsonPath = path.join(RUNTIME_DIR, `PA24-Payload-Probe-${stamp}.json`);
  const csvPath = path.join(RUNTIME_DIR, `PA24-Payload-Probe-${stamp}.csv`);
  const payload = {
    tool: APP_NAME,
    version: TOOL_VERSION,
    createdAt: new Date().toISOString(),
    baseline,
    finalSnapshot,
    observations,
    exceptions: recentExceptions
  };
  writeJsonAtomic(jsonPath, payload);

  const headers = [
    'test',
    'phase',
    'delay_ms',
    'requested',
    'timestamp',
    'title',
    'seats',
    'baggage_lbs',
    'baggage_a_lbs',
    'baggage_b_lbs',
    'baggage_c_lbs',
    'accusim_payload_lbs',
    'accusim_total_lbs',
    'msfs_payload_stations_lbs',
    'msfs_total_lbs',
    'msfs_fuel_lbs'
  ];
  const rows = observations.map((item) => {
    const summary = item.summary;
    return [
      item.testName,
      item.phase,
      item.delayMs,
      item.requested ? JSON.stringify(item.requested) : '',
      summary.at,
      summary.title,
      summary.seats.join('/'),
      summary.baggageWeightLbs,
      summary.baggageAWeightLbs,
      summary.baggageBWeightLbs,
      summary.baggageCWeightLbs,
      summary.accuPayloadWeightLbs,
      summary.accuTotalWeightLbs,
      summary.simPayloadWeightLbs,
      summary.simTotalWeightLbs,
      summary.simFuelWeightLbs
    ].map(csvEscape).join(',');
  });
  fs.writeFileSync(csvPath, [headers.join(','), ...rows].join('\r\n') + '\r\n', 'utf8');
  return { jsonPath, csvPath };
}

async function pauseAtEnd(options) {
  if (options.noPause || process.platform !== 'win32' || !process.stdin.isTTY) return;
  await ask('\nENTER druecken zum Schliessen ...');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  console.log('==========================================');
  console.log('  A2A Comanche PA24 Payload Probe');
  console.log('==========================================');
  console.log(`Version : ${TOOL_VERSION}`);
  console.log(`Ausgabe : ${RUNTIME_DIR}`);
  console.log('');
  console.log('Das Tool schreibt nie generische MSFS-Payloadstationen.');
  console.log('Jeder Accu-Sim-Testwert wird einzeln gesetzt und danach wiederhergestellt.');
  console.log('');
  console.log('Verbinde mit Microsoft Flight Simulator ...');

  const connection = await open(APP_NAME, Protocol.KittyHawk);
  handle = connection.handle;
  installHandlers();
  installDefinitions();
  console.log('SimConnect verbunden.');

  const baseline = await requestSnapshot();
  printSnapshot(baseline, 'Ausgangszustand');
  const detection = detectPa24Aircraft(baseline.aircraft);
  console.log(`Automatische Erkennung: ${detection.detected ? 'COMANCHE / PA-24' : 'NICHT ERKANNT'}`);

  const recovery = readRecoveryFile();
  if (recovery?.restoreRequired === true) {
    console.log('');
    console.log('ACHTUNG: Eine unvollstaendige fruehere Testsession wurde gefunden.');
    const answer = options.yes ? 'RESTORE' : await ask('Alten Ausgangszustand jetzt wiederherstellen? Bitte RESTORE eingeben: ');
    if (answer.toUpperCase() === 'RESTORE') {
      await restoreFromRecovery(recovery);
      console.log('Recovery abgeschlossen. Das Tool wird beendet; fuer einen neuen Test bitte erneut starten.');
      return;
    }
    throw new Error('Recovery erforderlich; Schreibtest aus Sicherheitsgruenden abgebrochen.');
  }

  if (options.readOnly) {
    const reports = writeReports(baseline, baseline);
    console.log('');
    console.log(`Read-only JSON: ${reports.jsonPath}`);
    console.log(`Read-only CSV : ${reports.csvPath}`);
    return;
  }

  if (!detection.detected && !options.force) {
    throw new Error(
      'Keine Comanche/PA-24 erkannt. Es wurden keine Werte geschrieben. ' +
      'Nur fuer einen bewusst kontrollierten Sonderfall kann --force verwendet werden.'
    );
  }

  if (!options.yes) {
    console.log('');
    console.log('Voraussetzungen: Flugzeug steht am Boden, Motor aus, Tablet-Payload notiert.');
    const confirmation = await ask('Zum Start des ruecksetzbaren Schreibtests bitte TEST eingeben: ');
    if (confirmation.toUpperCase() !== 'TEST') {
      console.log('Abgebrochen. Es wurden keine Werte geschrieben.');
      return;
    }
  }

  writeJsonAtomic(RECOVERY_FILE, recoveryPayload(baseline, true));
  let finalSnapshot = baseline;
  try {
    await runSingleVariableProbe('BaggageWeight', baseline, { min: 0, max: 200, delta: 5 });
    await runSingleVariableProbe('BaggageAWeight', baseline, { min: 0, max: 200, delta: 5 });
    await runSingleVariableProbe('BaggageBWeight', baseline, { min: 0, max: 200, delta: 5 });
    await runSingleVariableProbe('BaggageCWeight', baseline, { min: 0, max: 200, delta: 5 });
    await runSeatBindingProbe(baseline);
    finalSnapshot = await requestSnapshot();
    printSnapshot(finalSnapshot, 'Endzustand nach Wiederherstellung');
    writeJsonAtomic(RECOVERY_FILE, {
      ...recoveryPayload(baseline, false),
      completedAt: new Date().toISOString(),
      finalSnapshot
    });
  } catch (error) {
    console.log('');
    console.log(`FEHLER: ${error?.message || error}`);
    console.log(`Recovery-Datei bleibt aktiv: ${RECOVERY_FILE}`);
    throw error;
  } finally {
    const reports = writeReports(baseline, finalSnapshot);
    console.log('');
    console.log(`Ergebnis JSON: ${reports.jsonPath}`);
    console.log(`Ergebnis CSV : ${reports.csvPath}`);
    console.log(`Recovery     : ${RECOVERY_FILE}`);
  }
}

const optionsForPause = parseArgs(process.argv.slice(2));

process.on('SIGINT', () => {
  abortRequested = true;
  console.log('');
  console.log('Abbruch angefordert. Recovery-Datei bleibt fuer den naechsten Start erhalten.');
});

main()
  .catch((error) => {
    console.error('');
    console.error(`ABBRUCH: ${error?.message || error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pauseAtEnd(optionsForPause);
  });
