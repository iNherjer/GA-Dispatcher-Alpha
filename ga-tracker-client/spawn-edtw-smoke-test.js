/**
 * GA Smoke Marker Injector – MSFS 2024 edition
 *
 * Start:
 *   node spawn-edtw-smoke-test.js
 *   edtw-smoke-test.exe
 *
 * Optionen:
 *   --lat=48.2792245 --lon=8.4283415 --alt-ft=2310 --hdg=140
 *   --marker-title="Chimney_Smoke_V1" --count=5 --radius-m=120
 *   --auto-remove-sec=120
 *   --keep
 *   --marker-title="Asobo Airport Vehicle Fuel Truck"
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  open,
  Protocol,
  SimConnectDataType,
  SimConnectConstants,
  SimConnectPeriod,
  InitPosition,
  RawBuffer
} = require('node-simconnect');

// EDTW RWY 14/32 Mittelpunkt
const EDTW_CENTER = {
  lat: (48.281768 + 48.276681) / 2,
  lon: (8.425521  + 8.431162)  / 2
};

const DEFAULT_ALT_FT = 2310;
const DEFAULT_HDG    = 140;
const APP_NAME       = 'GA-EDTW-Smoke-Test';
const CUSTOM_SMOKE_MARKER_TITLE = 'EDTW Smoke Marker';

// Smoke/Wildfire-Objekte zuerst – eigenständige Partikeleffekte, kein SMOKE_ENABLE nötig.
// Danach Aerobatik-Flieger mit Smoke-System, dann Fahrzeuge als reiner Positionsmarker.
const SMOKE_TITLES = new Set([
  'Asobo_Wildfire_Smoke_Large',
  'Asobo_Wildfire_Smoke_Medium',
  'Asobo_Wildfire_Smoke_Small',
  'Asobo_Wildfire_Fire_Large',
  'Asobo_Wildfire_Fire_Medium',
  'Asobo_Wildfire_Fire_Small',
  'Asobo Wildfire Smoke Large',
  'Asobo Wildfire Smoke Medium',
  'Asobo Wildfire Smoke Small',
  'Asobo Wildfire Fire Large',
  'Asobo Wildfire Fire Medium',
  'Asobo Wildfire Fire Small',
  'fs-base-scenery-smoke-large',
  'fs-base-scenery-smoke-medium',
  'fs-base-scenery-fire-smoke-large',
  'Asobo_FX_Smoke_Column',
  'Asobo_FX_WildFire_Smoke',
  'SmokeSystem',
  'Chimney_Smoke_V1',
]);

// Unser Community-Package ist ein SimObject mit fest verdrahtetem VFX im Model-XML.
const SELF_EMITTING_TITLES = new Set([
  CUSTOM_SMOKE_MARKER_TITLE,
  ...SMOKE_TITLES,
]);

const FALLBACK_CANDIDATES = [
  // Wildfire / Smoke-Effekte
  ...SMOKE_TITLES,
  // Aerobatik-Flugzeuge mit Smoke-System
  'Asobo Extra 330LT',
  'Extra 330LT',
  'Cap 10 C',
  'Asobo Cap 10 C',
  // Ground vehicles (kein Smoke, aber sichtbarer Marker)
  'Asobo Airport Vehicle Fuel Truck',
  'Asobo Airport Vehicle Pushback',
  'Asobo Airport Vehicle Baggage',
  // Fallback: einfache GA-Flugzeuge
  'Cessna 172 Skyhawk (G1000)',
  'Cessna 172 Skyhawk',
  'Diamond DA62',
  'TBM 930'
];

const DEF_IDS = { USER_TITLE: 7001, SMOKE_ENABLE: 7002 };
const REQ_IDS = { USER_TITLE: 7001, MARKER_BASE: 7100 };

const args        = parseArgs(process.argv.slice(2));
const spawnLat    = toNumber(args.lat,       EDTW_CENTER.lat);
const spawnLon    = toNumber(args.lon,       EDTW_CENTER.lon);
const spawnAltFt  = toNumber(args['alt-ft'], DEFAULT_ALT_FT);
const spawnHdg    = toNumber(args.hdg,       DEFAULT_HDG);
const autoRemoveSec = Math.max(0, toNumber(args['auto-remove-sec'], 0));
const keepSpawned = args.keep === true || args['no-cleanup'] === true;
const markerTitleArg = getStringArg(args['marker-title']);
const smokeCount = clampInt(toNumber(args.count, 1), 1, 20);
const smokeRadiusM = Math.max(0, toNumber(args['radius-m'], 0));
const smokeFieldPositions = buildSmokeFieldPositions(spawnLat, spawnLon, spawnAltFt, spawnHdg, smokeCount, smokeRadiusM);

let handle = null;
let spawnedObjectIds = [];
const pendingAssign  = new Map();
const lastExceptions = [];

const DEBUG_FILE_BASENAME = 'edtw-smoke-test-debug.txt';
const RUNTIME_DIR = getRuntimeDir();
let debugFilePath = path.join(RUNTIME_DIR, DEBUG_FILE_BASENAME);
let debugWriteProblem = '';
const debugLines = [];
const debugContext = {
  appName: APP_NAME,
  packageMode: !!process.pkg,
  runtimeDir: RUNTIME_DIR,
  execPath: process.execPath,
  scriptPath: __filename,
  cwdAtStart: process.cwd(),
  nodeVersion: process.version,
  platform: `${process.platform}/${process.arch}`,
  hostname: os.hostname(),
  argv: process.argv,
  parsedArgs: args,
  resolvedSpawn: {
    lat: spawnLat,
    lon: spawnLon,
    altFt: spawnAltFt,
    hdg: spawnHdg,
    autoRemoveSec,
    keepSpawned,
    markerTitleArg: markerTitleArg || null,
    smokeCount,
    smokeRadiusM,
    smokeFieldPositions
  },
  smokeTitles: [...SMOKE_TITLES],
  fallbackCandidates: [...FALLBACK_CANDIDATES],
  assignedObjectEvents: [],
  spawnedObjectIds,
  result: null,
  cleanup: null,
  fatalError: null
};
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

console.log = (...items) => {
  appendDebugLine('INFO', items);
  originalConsole.log(...items);
};
console.warn = (...items) => {
  appendDebugLine('WARN', items);
  originalConsole.warn(...items);
};
console.error = (...items) => {
  appendDebugLine('ERROR', items);
  originalConsole.error(...items);
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getRuntimeDir() {
  if (process.pkg) return path.dirname(process.execPath);
  return __dirname;
}

function serializeDebugValue(value) {
  if (value instanceof Error) return value.stack || value.message || String(value);
  if (typeof value === 'string') return value;
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value, null, 2);
  } catch (_) {
    return String(value);
  }
}

function appendDebugLine(level, items) {
  const line = `[${new Date().toISOString()}] [${level}] ${items.map(serializeDebugValue).join(' ')}`;
  debugLines.push(line);
  writeDebugSnapshot('running');
}

function buildDebugSnapshot(reason) {
  const snapshot = {
    reason,
    generatedAt: new Date().toISOString(),
    debugFilePath,
    debugWriteProblem: debugWriteProblem || null,
    pendingRequestIds: [...pendingAssign.keys()],
    spawnedObjectIds: [...spawnedObjectIds],
    lastExceptions: [...lastExceptions],
    context: {
      ...debugContext,
      spawnedObjectIds: [...spawnedObjectIds],
      assignedObjectEvents: [...debugContext.assignedObjectEvents]
    }
  };
  return [
    'GA Smoke Marker Injector Debug',
    '================================',
    '',
    JSON.stringify(snapshot, null, 2),
    '',
    'Log',
    '---',
    debugLines.join('\n'),
    ''
  ].join('\n');
}

function writeDebugSnapshot(reason = 'snapshot') {
  try {
    fs.writeFileSync(debugFilePath, buildDebugSnapshot(reason), 'utf8');
    return;
  } catch (err) {
    const fallback = path.join(process.cwd(), DEBUG_FILE_BASENAME);
    debugWriteProblem = `Primary debug write failed: ${err?.message || err}; fallback=${fallback}`;
    debugFilePath = fallback;
  }
  try {
    fs.writeFileSync(debugFilePath, buildDebugSnapshot(reason), 'utf8');
  } catch (err) {
    debugWriteProblem += `; fallback write failed: ${err?.message || err}`;
  }
}

function writeDebugFinal(reason) {
  writeDebugSnapshot(reason || 'final');
  return debugFilePath;
}

function printFinalDebugPath(reason) {
  const finalPath = writeDebugFinal(reason);
  console.log('Debug TXT: ' + finalPath);
  writeDebugFinal(reason);
}

function parseArgs(list) {
  const out = {};
  for (const token of list) {
    if (!token.startsWith('--')) continue;
    const eq = token.indexOf('=');
    if (eq === -1) { out[token.slice(2)] = true; }
    else { out[token.slice(2, eq).trim()] = token.slice(eq + 1).trim(); }
  }
  return out;
}

function toNumber(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clampInt(value, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function getStringArg(v) {
  if (typeof v !== 'string') return '';
  const s = v.trim();
  return s.length > 0 ? s : '';
}

function buildInitPos(lat, lon, altFt, hdg, onGround = true) {
  const pos = new InitPosition();
  pos.latitude  = lat;
  pos.longitude = lon;
  pos.altitude  = altFt;
  pos.heading   = hdg;
  pos.onGround  = onGround;
  pos.airspeed  = 0;
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
  const out = [{
    index: 1,
    lat,
    lon,
    altFt,
    hdg,
    offsetNorthM: 0,
    offsetEastM: 0,
    radiusM: 0,
    bearingDeg: null
  }];
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isSelfEmittingTitle(title) {
  const t = String(title || '').trim();
  if (!t) return false;
  if (SELF_EMITTING_TITLES.has(t)) return true;
  return /(chimney|smoke|wildfire|fire|fx)/i.test(t);
}

// readline-basiert – funktioniert auch im kompilierten exe.
function waitForEnter(msg) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(msg || '\n[ ENTER zum Beenden ]\n', () => { rl.close(); resolve(); });
  });
}

// ─── SimConnect helpers ──────────────────────────────────────────────────────

function waitForAssignedObject(requestId, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingAssign.delete(requestId);
      const hint = lastExceptions.length
        ? lastExceptions.splice(0).join(', ')
        : 'keine Antwort vom Sim';
      reject(new Error(hint));
    }, timeoutMs);
    pendingAssign.set(requestId, (objectId) => {
      clearTimeout(timer);
      resolve(objectId);
    });
  });
}

async function spawnObjectByTitle(title, initPos, requestId, timeoutMs) {
  const waitPromise = waitForAssignedObject(requestId, timeoutMs);
  handle.aICreateSimulatedObject(title, initPos, requestId);
  const objectId = await waitPromise;
  spawnedObjectIds.push(objectId);
  return objectId;
}

async function spawnNonATCAircraft(title, initPos, requestId, timeoutMs) {
  const waitPromise = waitForAssignedObject(requestId, timeoutMs);
  handle.aICreateNonATCAircraft(title, 'D-SMOKE', initPos, requestId);
  const objectId = await waitPromise;
  spawnedObjectIds.push(objectId);
  return objectId;
}

// Versucht eine Liste von Titeln via aICreateSimulatedObject.
async function trySpawnFromList(candidates, initPos, label, timeoutMs = 5000) {
  console.log(`--- ${label} ---`);
  for (let i = 0; i < candidates.length; i++) {
    const title = candidates[i];
    const reqId = REQ_IDS.MARKER_BASE + spawnedObjectIds.length + i;
    try {
      const objectId = await spawnObjectByTitle(title, initPos, reqId, timeoutMs);
      console.log(`  OK  "${title}"  objectId=${objectId}`);
      return { ok: true, title, objectId };
    } catch (err) {
      console.log(`  ✗   "${title}"  →  ${err.message}`);
    }
  }
  return { ok: false };
}

// Versucht eine Liste von Titeln via aICreateNonATCAircraft (umgeht AI-Traffic-Registrierung).
async function trySpawnNonATCFromList(candidates, initPos, label, timeoutMs = 5000) {
  console.log(`--- ${label} (NonATC) ---`);
  for (let i = 0; i < candidates.length; i++) {
    const title = candidates[i];
    const reqId = REQ_IDS.MARKER_BASE + spawnedObjectIds.length + i + 100;
    try {
      const objectId = await spawnNonATCAircraft(title, initPos, reqId, timeoutMs);
      console.log(`  OK  "${title}"  objectId=${objectId}`);
      return { ok: true, title, objectId };
    } catch (err) {
      console.log(`  ✗   "${title}"  →  ${err.message}`);
    }
  }
  return { ok: false };
}

async function spawnFieldCopies(title, positions, timeoutMs = 5000) {
  const out = [];
  if (!title || !Array.isArray(positions) || positions.length <= 1) return out;
  console.log(`\nRauchfeld: ${positions.length} Objekte, Radius ${smokeRadiusM.toFixed(0)} m`);
  for (let i = 1; i < positions.length; i++) {
    const p = positions[i];
    const initPos = buildInitPos(p.lat, p.lon, p.altFt, p.hdg, true);
    const reqId = REQ_IDS.MARKER_BASE + 500 + i;
    try {
      const objectId = await spawnObjectByTitle(title, initPos, reqId, timeoutMs);
      const item = { ok: true, title, objectId, ...p };
      out.push(item);
      console.log(`  OK  Feld ${p.index}/${positions.length} "${title}" objectId=${objectId} lat=${p.lat.toFixed(7)} lon=${p.lon.toFixed(7)}`);
    } catch (err) {
      const item = { ok: false, title, error: err?.message || String(err), ...p };
      out.push(item);
      console.log(`  ✗   Feld ${p.index}/${positions.length} "${title}" → ${item.error}`);
    }
  }
  return out;
}

function enableSmoke(objectId) {
  try {
    handle.addToDataDefinition(DEF_IDS.SMOKE_ENABLE, 'SMOKE ENABLE', 'Bool', SimConnectDataType.INT32);
    const buf = new RawBuffer(4);
    buf.writeInt32(1);
    handle.setDataOnSimObject(DEF_IDS.SMOKE_ENABLE, objectId, { buffer: buf, arrayCount: 0, tagged: false });
    return true;
  } catch (err) {
    console.log('  ⚠  SMOKE_ENABLE: ' + (err?.message || err));
    return false;
  }
}

function requestUserAircraftTitle() {
  return new Promise((resolve) => {
    try {
      handle.addToDataDefinition(DEF_IDS.USER_TITLE, 'TITLE', null, SimConnectDataType.STRING256);
      handle.requestDataOnSimObject(
        REQ_IDS.USER_TITLE, DEF_IDS.USER_TITLE,
        SimConnectConstants.OBJECT_ID_USER,
        SimConnectPeriod.ONCE, 0, 0, 0, 0
      );
    } catch (err) {
      console.log('  ⚠  User-Titel konnte nicht abgefragt werden: ' + (err?.message || err));
      resolve('');
      return;
    }
    const timeout = setTimeout(() => {
      handle.removeListener('simObjectData', onData);
      resolve('');
    }, 3000);
    const onData = (recv) => {
      if (recv.requestID !== REQ_IDS.USER_TITLE) return;
      clearTimeout(timeout);
      handle.removeListener('simObjectData', onData);
      let title = '';
      try {
        if (typeof recv.data.readString256 === 'function')
          title = String(recv.data.readString256() || '').trim();
        else if (typeof recv.data.readString === 'function')
          title = String(recv.data.readString(256) || '').trim();
      } catch (_) {}
      resolve(title);
    };
    handle.on('simObjectData', onData);
  });
}

// ─── Cleanup / Signals ───────────────────────────────────────────────────────

async function cleanupSpawnedObjects() {
  if (!handle || !spawnedObjectIds.length) return;
  const ids = [...new Set(spawnedObjectIds)];
  debugContext.cleanup = { startedAt: new Date().toISOString(), ids, done: false };
  writeDebugSnapshot('cleanup-start');
  for (let i = 0; i < ids.length; i++) {
    try { handle.aIRemoveObject(ids[i], 7900 + i); } catch (_) {}
  }
  spawnedObjectIds = [];
  debugContext.cleanup.done = true;
  debugContext.cleanup.finishedAt = new Date().toISOString();
  writeDebugSnapshot('cleanup-done');
}

function setupSignals() {
  process.on('SIGINT', async () => {
    if (keepSpawned) {
      console.log('\nBeende Injector, gespawnte Objekte bleiben im Sim.');
    } else {
      console.log('\nEntferne gespawnte Test-Objekte ...');
      await cleanupSpawnedObjects();
    }
    printFinalDebugPath('sigint');
    process.exit(0);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=========================================');
  console.log('  GA Smoke-Marker Injector  (MSFS 2024)');
  console.log('=========================================');
  console.log(`Position : lat=${spawnLat.toFixed(7)}  lon=${spawnLon.toFixed(7)}`);
  console.log(`           alt=${spawnAltFt.toFixed(0)} ft  hdg=${spawnHdg} deg\n`);
  if (smokeFieldPositions.length > 1) {
    console.log(`Rauchfeld: ${smokeFieldPositions.length} Objekte im Radius ${smokeRadiusM.toFixed(0)} m`);
  } else {
    console.log('Rauchfeld: einzelnes Objekt am Zielpunkt');
  }
  console.log(`Debug TXT: ${debugFilePath}`);
  if (keepSpawned) console.log('Cleanup   : aus, gespawnte Objekte bleiben nach dem Beenden im Sim.');
  else if (autoRemoveSec > 0) console.log(`Cleanup   : automatisch nach ${autoRemoveSec} Sekunden.`);
  else console.log('Cleanup   : ENTER oder Ctrl+C entfernt die gespawnten Objekte.');
  console.log('');

  console.log('Verbinde mit SimConnect (Protocol: KittyHawk) ...');

  const conn = await open(APP_NAME, Protocol.KittyHawk);
  handle = conn.handle;
  console.log('SimConnect verbunden.\n');

  handle.on('assignedObjectID', (recv) => {
    debugContext.assignedObjectEvents.push({
      at: new Date().toISOString(),
      requestID: recv.requestID,
      objectID: recv.objectID
    });
    const fn = pendingAssign.get(recv.requestID);
    if (fn) { pendingAssign.delete(recv.requestID); fn(recv.objectID); }
  });

  handle.on('exception', (recv) => {
    const name = recv.exceptionName || String(recv.exception);
    lastExceptions.push(name);
    console.log(`  [Exception] ${name}  sendId=${recv.sendId}`);
  });

  handle.on('error',  (err) => console.log('SimConnect-Fehler: ' + (err?.message || err)));
  handle.on('close',  ()    => console.log('SimConnect getrennt.'));

  setupSignals();

  // User-Flugzeug auslesen – dieser Titel ist garantiert im Sim vorhanden
  console.log('Lese User-Aircraft-Titel ...');
  const userTitle = await requestUserAircraftTitle();
  if (userTitle) {
    console.log(`Dein Flugzeug: "${userTitle}"`);
  } else {
    console.log('User-Titel nicht verfuegbar (Sim noch nicht bereit?)');
  }

  const primaryFieldPos = smokeFieldPositions[0];
  const initPos = buildInitPos(primaryFieldPos.lat, primaryFieldPos.lon, primaryFieldPos.altFt, primaryFieldPos.hdg, true);
  let spawn = { ok: false };
  let fieldSpawnResults = [];

  if (markerTitleArg) {
    // Expliziter Titel per Argument
    spawn = await trySpawnFromList([markerTitleArg], initPos, 'Expliziter Titel', 5000);
  } else {
    // 0) Eigenes Community-Package (wenn installiert)
    console.log(`\nSchritt 0: Community-Package "${CUSTOM_SMOKE_MARKER_TITLE}" ...`);
    spawn = await trySpawnFromList([CUSTOM_SMOKE_MARKER_TITLE], initPos, 'Community-Package', 5000);
    if (!spawn.ok) {
      console.log('  Hinweis: Das Package muss in Community2024/Community liegen und MSFS danach neu gestartet werden.');
    }

    // 1) Smoke/Wildfire-Objekte (2s Timeout – scheitern fast wenn Titel unbekannt)
    if (!spawn.ok) {
      console.log('\nSchritt 1: Smoke/Wildfire-Objekte testen (2s Timeout je Kandidat) ...');
      spawn = await trySpawnFromList([...SMOKE_TITLES], initPos, 'Smoke/Wildfire', 2000);
    }

    // 2) Aerobatik-Flugzeuge mit Smoke-System via NonATC-API
    if (!spawn.ok) {
      console.log('\nSchritt 2: Aerobatik-Flugzeuge via NonATC-API ...');
      spawn = await trySpawnNonATCFromList([
        'Asobo Extra 330LT', 'Extra 330LT', 'Cap 10 C', 'Asobo Cap 10 C',
        'Robin Cap 10 C', 'Extra 330LT Asobo'
      ], initPos, 'Aerobatik', 5000);
    }

    // 3) User-Flugzeug und einfache Fallbacks als letzter Ausweg
    if (!spawn.ok) {
      console.log('\nSchritt 3: Fallback (dein Flugzeug / GA) ...');
      const fallbacks = [
        ...(userTitle ? [userTitle] : []),
        'Asobo Airport Vehicle Fuel Truck',
        'Cessna 172 Skyhawk (G1000)',
        'Cessna 172 Skyhawk',
        'Diamond DA62',
      ];
      spawn = await trySpawnFromList(fallbacks, initPos, 'Fallback', 5000);
    }
  }

  if (!spawn.ok) {
    debugContext.result = { ok: false, at: new Date().toISOString() };
    writeDebugSnapshot('spawn-failed');
    console.log('\nFEHLER: Kein Kandidat konnte gespawnt werden.');
    console.log('UNRECOGNIZED_ID = Titel stimmt nicht exakt ueberein.');
    console.log('Loesung: --marker-title="<Titel exakt aus MSFS Aircraft-Selector>"');
    printFinalDebugPath('spawn-failed');
    await waitForEnter();
    process.exit(1);
  }

  debugContext.result = {
    ok: true,
    at: new Date().toISOString(),
    title: spawn.title,
    objectId: spawn.objectId,
    spawn,
    field: {
      requestedCount: smokeFieldPositions.length,
      requestedRadiusM: smokeRadiusM,
      positions: smokeFieldPositions,
      spawned: [{ ok: true, ...primaryFieldPos, title: spawn.title, objectId: spawn.objectId }]
    }
  };
  writeDebugSnapshot('spawn-ok');

  fieldSpawnResults = await spawnFieldCopies(spawn.title, smokeFieldPositions, 5000);
  debugContext.result.field.spawned = [
    { ok: true, ...primaryFieldPos, title: spawn.title, objectId: spawn.objectId },
    ...fieldSpawnResults
  ];
  debugContext.result.field.okCount = debugContext.result.field.spawned.filter(x => x && x.ok).length;
  debugContext.result.field.failCount = debugContext.result.field.spawned.filter(x => x && !x.ok).length;
  writeDebugSnapshot('field-spawn-done');

  await new Promise(r => setTimeout(r, 1500));

  if (isSelfEmittingTitle(spawn.title)) {
    console.log('\nSmoke/Marker-Objekt gespawnt – Effekt sollte direkt sichtbar sein.');
    console.log('-> Smoke/Fire/FX/Chimney-Objekte bekommen kein SMOKE_ENABLE, weil sie selbst emittieren.');
    console.log('-> Schau an der Testposition nach Rauch/FX.');
  } else {
    console.log('\nSetze SMOKE_ENABLE = 1 ...');
    const smokeOk = enableSmoke(spawn.objectId);
    if (smokeOk) {
      console.log('SMOKE_ENABLE gesetzt.');
      console.log('-> Extra 330 / Cap 10: Rauch sichtbar.');
      console.log('-> C172 / Fahrzeuge: kein Smoke-System, nur Marker sichtbar.');
    } else {
      console.log('SMOKE_ENABLE nicht gesetzt – Marker laeuft trotzdem.');
    }
  }

  if (autoRemoveSec > 0) {
    console.log(`\nLaeuft. Objekte werden in ${autoRemoveSec} Sekunden entfernt.`);
    await sleep(autoRemoveSec * 1000);
  } else {
    console.log(keepSpawned
      ? '\nLaeuft. ENTER beendet den Injector, Objekte bleiben im Sim.'
      : '\nLaeuft. ENTER oder Ctrl+C entfernt die gespawnten Objekte.');
    await waitForEnter(keepSpawned
      ? '\n[ ENTER: Injector beenden, Objekte bleiben ]\n'
      : '\n[ ENTER: Objekte entfernen und beenden ]\n');
  }

  if (!keepSpawned) {
    await cleanupSpawnedObjects();
  }
  printFinalDebugPath('normal-exit');
}

main().catch(async (err) => {
  debugContext.fatalError = {
    at: new Date().toISOString(),
    message: err?.message || String(err),
    stack: err?.stack || null
  };
  writeDebugSnapshot('fatal-error');
  console.log('\nABBRUCH: ' + (err?.message || String(err)));
  if (!keepSpawned) await cleanupSpawnedObjects();
  printFinalDebugPath('fatal-error');
  await waitForEnter();
  process.exit(1);
});
