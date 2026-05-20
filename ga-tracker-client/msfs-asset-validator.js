const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const {
  open,
  Protocol,
  SimConnectDataType,
  SimConnectConstants,
  SimConnectPeriod,
  InitPosition
} = require('node-simconnect');

const TOOL_VERSION = 'v2';
const APP_NAME = 'GA-MSFS-Asset-Validator';
const OUT_BASENAME = 'msfs2024-spawn-validation';
const RUNTIME_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;

const DEF_IDS = { USER_POS: 9101 };
const REQ_IDS = { USER_POS: 9101, SPAWN_BASE: 9200, REMOVE_BASE: 19200 };

const DEFAULT_ROLES = [
  'vfx.smoke',
  'vfx.fire',
  'vehicle.emergency.fire',
  'vehicle.emergency.medical',
  'vehicle.car',
  'vehicle.van',
  'vehicle.truck',
  'vehicle.bus',
  'vehicle.quad',
  'watercraft.boat',
  'watercraft.ship',
  'sar.liferaft',
  'person.ground_crew',
  'cargo.container',
  'cargo.small_box',
  'cargo.pallet_large',
  'cargo.pallet_medium',
  'cargo.pallet_small',
  'marker.cone'
];

const RISKY_ROLES = new Set([
  'person.passenger',
  'animal',
  'aircraft'
]);

const ROLE_KEYWORDS = {
  'vfx.smoke': [
    /chimney[_\s-]*smoke/i,
    /\bvo[_\s-]*smoke/i,
    /\bsmoke\b/i,
    /wildfire.*smoke/i
  ],
  'vfx.fire': [
    /^vo[_\s-]*fire/i,
    /\bfire[_\s-]*r\d/i,
    /wildfire.*fire/i,
    /\bflame/i
  ],
  'vehicle.emergency.fire': [
    /firefighting/i,
    /\bfire\s*truck\b/i,
    /\bbush\s*fire/i
  ],
  'vehicle.emergency.medical': [
    /ambulance/i,
    /\bems\b/i,
    /medical/i
  ],
  'vehicle.car': [
    /\bcar\b/i,
    /microsoft[_\s-]*car/i,
    /\bminicar\b/i
  ],
  'vehicle.van': [
    /\bvan\b/i,
    /microsoft[_\s-]*van/i
  ],
  'vehicle.truck': [
    /\btruck\b/i,
    /\blorry\b/i,
    /\bcargo\s*truck\b/i
  ],
  'vehicle.bus': [
    /\bbus\b/i
  ],
  'vehicle.quad': [
    /\bquad\b/i,
    /\batv\b/i
  ],
  'watercraft.boat': [
    /\bboat\b/i,
    /\bfishing\b/i,
    /\brescue.*boat\b/i,
    /\brhib\b/i
  ],
  'watercraft.ship': [
    /\bship\b/i,
    /\bferry\b/i,
    /\btanker\b/i,
    /\bcargo\s*ship\b/i
  ],
  'sar.liferaft': [
    /life\s*raft/i,
    /liferaft/i
  ],
  'person.ground_crew': [
    /\btarmac\b/i,
    /\btermac\b/i,
    /marshaller/i,
    /ground.*crew/i,
    /\bworker\b/i,
    /\bmechanic\b/i,
    /\bfemale\b/i,
    /\bmale\b/i
  ],
  'cargo.container': [
    /drop[_\s-]*container/i,
    /\bcontainer\b/i
  ],
  'cargo.small_box': [
    /cardboard/i,
    /\bbox\b/i,
    /coffee\s*cup/i
  ],
  'cargo.pallet_large': [
    /pallet01[_\s-]*01/i,
    /pallet.*large/i
  ],
  'cargo.pallet_medium': [
    /pallet01[_\s-]*02/i,
    /pallet.*medium/i
  ],
  'cargo.pallet_small': [
    /pallet01[_\s-]*03/i,
    /pallet.*small/i
  ],
  'marker.cone': [
    /\bcone\b/i
  ]
};

const EXACT_SCORE = new Map(Object.entries({
  Chimney_Smoke_V1: 500,
  VO_Fire_R1_40: 500,
  'Car Bush Firefighting': 500,
  Tarmac_Female_Summer_Asian: 500,
  Termac_Female_Summer_Asian: 470,
  Drop_Container: 500,
  Cardboard: 490,
  CoffeeCup: 460,
  Cone_Medium: 500,
  Pallet01_01: 500,
  Pallet01_02: 500,
  Pallet01_03: 500,
  LifeRaft: 500,
  Microsoft_Car_EUR_01: 480,
  Microsoft_Car_EUR_02: 480,
  Microsoft_Car_EUR_03: 480,
  Microsoft_Car_EUR_04: 480,
  Microsoft_Minicar_01: 480,
  Microsoft_Quad: 480,
  Microsoft_Van_EUR: 480
}));

const args = parseArgs(process.argv.slice(2));
const outputDir = resolveOutDir(argString(['out', 'output', 'output-dir']) || RUNTIME_DIR);
const debugPath = path.join(outputDir, `${OUT_BASENAME}-debug.txt`);
const jsonPath = path.join(outputDir, `${OUT_BASENAME}.json`);
const csvPath = path.join(outputDir, `${OUT_BASENAME}.csv`);
const curatedPath = path.join(outputDir, 'msfs2024-simobjects-validated-catalog.json');

const options = {
  catalogPath: resolveCatalogPath(),
  roles: splitList(argString(['roles']) || DEFAULT_ROLES.join(',')),
  perRole: clampInt(argNumber(['per-role', 'perRole'], 10), 1, 80),
  max: clampInt(argNumber(['max'], 120), 1, 1000),
  timeoutMs: clampInt(argNumber(['timeout-ms', 'timeoutMs'], 2200), 500, 15000),
  holdMs: clampInt(argNumber(['hold-ms', 'holdMs'], 450), 0, 10000),
  pauseMs: clampInt(argNumber(['pause-ms', 'pauseMs'], 180), 0, 5000),
  offsetM: clampNumber(argNumber(['offset-m', 'offsetM'], 42), 5, 300),
  spacingM: clampNumber(argNumber(['spacing-m', 'spacingM'], 12), 2, 80),
  keepOk: hasArg(['keep-ok', 'keepOk']),
  includeRisky: hasArg(['include-risky', 'includeRisky']),
  dryRun: hasArg(['dry-run', 'dryRun']),
  allowZero: hasArg(['allow-zero', 'allowZero']),
  manualReview: hasArg(['manual-review', 'manualReview', 'review'])
};

let handle = null;
let requestSeq = 0;
let pendingSpawn = null;
let activeObjectIds = [];
let abortRequested = false;
const debugLines = [];
const results = [];

setupConsoleCapture();

function parseArgs(list) {
  const out = {};
  for (let i = 0; i < list.length; i += 1) {
    const token = String(list[i] || '').trim();
    if (!token.startsWith('--')) continue;
    const eq = token.indexOf('=');
    if (eq >= 0) {
      out[token.slice(2, eq)] = token.slice(eq + 1).replace(/^"|"$/g, '');
    } else {
      const key = token.slice(2);
      const next = list[i + 1];
      if (next && !String(next).startsWith('--')) {
        out[key] = String(next).replace(/^"|"$/g, '');
        i += 1;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

function argString(names) {
  for (const name of names) {
    const value = args[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function argNumber(names, fallback) {
  const value = argString(names);
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function hasArg(names) {
  return names.some((name) => args[name] === true || String(args[name] || '').toLowerCase() === 'true');
}

function splitList(value) {
  return String(value || '')
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function clampInt(value, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function resolveOutDir(value) {
  const dir = path.resolve(String(value || RUNTIME_DIR).replace(/^"|"$/g, ''));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function fileExists(p) {
  try { return p && fs.statSync(p).isFile(); } catch (_) { return false; }
}

function resolveCatalogPath() {
  const explicit = argString(['catalog', 'catalog-path', 'input']);
  const candidates = [];
  if (explicit) candidates.push(explicit);
  candidates.push(path.join(RUNTIME_DIR, 'msfs2024-simobjects-catalog.json'));
  candidates.push(path.join(RUNTIME_DIR, 'msfs2024-simobjects.json'));
  candidates.push(path.join(process.cwd(), 'msfs2024-simobjects-catalog.json'));
  candidates.push(path.join(process.cwd(), 'msfs2024-simobjects.json'));
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (fileExists(resolved)) return resolved;
  }
  return explicit ? path.resolve(explicit) : path.join(RUNTIME_DIR, 'msfs2024-simobjects-catalog.json');
}

function setupConsoleCapture() {
  const original = {
    log: console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
  };
  const capture = (level, items) => {
    debugLines.push(`[${new Date().toISOString()}] [${level}] ${items.map(formatLogItem).join(' ')}`);
    writeDebug('running');
  };
  console.log = (...items) => {
    capture('INFO', items);
    original.log(...items);
  };
  console.warn = (...items) => {
    capture('WARN', items);
    original.warn(...items);
  };
  console.error = (...items) => {
    capture('ERROR', items);
    original.error(...items);
  };
}

function formatLogItem(value) {
  if (value instanceof Error) return value.stack || value.message || String(value);
  if (typeof value === 'string') return value;
  if (value === undefined) return 'undefined';
  try { return JSON.stringify(value); } catch (_) { return String(value); }
}

function writeDebug(reason) {
  const snapshot = {
    tool: APP_NAME,
    version: TOOL_VERSION,
    reason,
    generatedAt: new Date().toISOString(),
    host: os.hostname(),
    platform: `${process.platform}/${process.arch}`,
    runtimeDir: RUNTIME_DIR,
    outputDir,
    options,
    activeObjectIds,
    resultCount: results.length
  };
  const text = [
    'MSFS 2024 Spawn Validation Debug',
    '================================',
    '',
    JSON.stringify(snapshot, null, 2),
    '',
    'Log',
    '---',
    debugLines.join('\n'),
    ''
  ].join('\n');
  try { fs.writeFileSync(debugPath, text, 'utf8'); } catch (_) {}
}

function readJsonFile(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
}

function loadRecords(catalogPath) {
  const json = readJsonFile(catalogPath);
  const records = Array.isArray(json.records)
    ? json.records
    : (Array.isArray(json.items) ? json.items : (Array.isArray(json.simObjects) ? json.simObjects : []));
  return records
    .map((record) => normalizeRecord(record))
    .filter((record) => record.title);
}

function normalizeRecord(record) {
  const title = String(record.title || record.name || record.displayName || '').trim();
  return {
    ...record,
    title,
    displayName: String(record.displayName || title).trim(),
    roleHints: Array.isArray(record.roleHints) ? record.roleHints.map(String) : [],
    tags: Array.isArray(record.tags) ? record.tags.map(String) : [],
    kind: String(record.kind || '').trim(),
    category: String(record.category || '').trim(),
    confidence: String(record.confidence || '').trim(),
    packageName: String(record.packageName || '').trim(),
    path: String(record.path || '').trim()
  };
}

function lower(value) {
  return String(value || '').toLowerCase();
}

function unique(values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const s = String(value || '').trim();
    const key = s.toLowerCase();
    if (s && !seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

function titleVariants(title) {
  const raw = String(title || '').trim();
  const variants = [raw];
  variants.push(raw.replace(/\^+$/g, '').trim());
  variants.push(raw.replace(/\s*\([^)]*\)\^?$/g, '').trim());
  variants.push(raw.replace(/\s*\[[^\]]*\]\^?$/g, '').trim());
  return unique(variants);
}

function allRoles(record) {
  const roles = new Set(record.roleHints || []);
  const title = record.title;
  for (const [role, tests] of Object.entries(ROLE_KEYWORDS)) {
    if (tests.some((rx) => rx.test(title))) roles.add(role);
  }
  if (/aircraft/i.test(record.kind) || /simobjects[\\\/]airplanes/i.test(record.path)) roles.add('aircraft');
  if (/animals?/i.test(record.kind) || record.tags.some((tag) => /animal/i.test(tag))) roles.add('animal');
  return roles;
}

function isVehicleLike(record) {
  const t = lower(`${record.title} ${record.kind} ${record.category} ${record.path}`);
  return /(car|truck|bus|van|vehicle|firefighting|quad|minicar)/i.test(t);
}

function shouldSkip(record, role, includeRisky) {
  const roles = allRoles(record);
  const text = `${record.title} ${record.kind} ${record.category} ${record.path}`;
  if (!includeRisky && (RISKY_ROLES.has(role) || [...roles].some((item) => RISKY_ROLES.has(item)))) {
    if (role !== 'person.ground_crew') return true;
  }
  if (role === 'person.ground_crew' && roles.has('animal')) return true;
  if (role === 'vfx.fire' && isVehicleLike(record)) return true;
  if (role === 'vfx.smoke' && /tire|smoker|smoking/i.test(record.title)) return true;
  if (role === 'vehicle.emergency.fire' && !/(car|truck|vehicle|firefighting|bush\s*fire)/i.test(text)) return true;
  if (role === 'vehicle.emergency.medical' && !/(ambulance|ems|medical|medic)/i.test(text)) return true;
  if (/^vehicle\./.test(role) && !/emergency/.test(role) && /ship|boat|sink/i.test(text)) return true;
  if (/^watercraft\./.test(role) && !includeRisky && /\b_sink\b|_sink\b|\bsink\b/i.test(record.title)) return true;
  if (role === 'sar.liferaft' && !/life\s*raft|liferaft/i.test(record.title)) return true;
  if (!includeRisky && /passenger/i.test(record.title)) return true;
  return false;
}

function confidenceScore(confidence) {
  if (/high/i.test(confidence)) return 60;
  if (/medium/i.test(confidence)) return 35;
  if (/layout/i.test(confidence)) return 18;
  if (/low/i.test(confidence)) return 8;
  return 20;
}

function roleScore(record, role) {
  const title = record.title;
  let score = 0;
  if ((record.roleHints || []).includes(role)) score += 100;
  if (ROLE_KEYWORDS[role]?.some((rx) => rx.test(title))) score += 90;
  score += confidenceScore(record.confidence);
  score += EXACT_SCORE.get(title) || 0;
  if (record.sceneCandidate) score += 25;
  if (/^microsoft_/i.test(title)) score += 20;
  if (/^asobo_/i.test(title)) score += 12;
  if (/sample|test|debug|edtw/i.test(title)) score -= 40;
  if (/^A[A-Z][a-z]+(Female|Male)/.test(title) && role === 'person.ground_crew') score -= 120;
  if (/moose|bear|deer|cow|horse|animal/i.test(`${title} ${record.kind} ${record.path}`)) score -= 200;
  if (role === 'person.ground_crew' && /\btarmac\b|\btermac\b/i.test(title)) score += 160;
  if (role === 'vfx.fire' && /^vo[_\s-]*fire/i.test(title)) score += 180;
  if (role === 'vfx.smoke' && /chimney[_\s-]*smoke/i.test(title)) score += 180;
  if (role === 'vehicle.emergency.fire' && /firefighting/i.test(title)) score += 160;
  if (role.startsWith('cargo.') && /drop[_\s-]*container|cardboard|pallet|coffee/i.test(title)) score += 120;
  return score;
}

function selectCandidates(records, roles, perRole, max, includeRisky) {
  const selected = [];
  const seenRoleTitle = new Set();
  const usedTitles = new Set();

  for (const role of roles) {
    const ranked = records
      .map((record) => {
        const rolesForRecord = allRoles(record);
        if (!rolesForRecord.has(role)) return null;
        if (shouldSkip(record, role, includeRisky)) return null;
        return { role, record, score: roleScore(record, role), rolesForRecord: [...rolesForRecord].sort() };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.record.title.localeCompare(b.record.title));

    let count = 0;
    for (const item of ranked) {
      const titleKey = item.record.title.toLowerCase();
      const roleTitleKey = `${role}\n${titleKey}`;
      if (seenRoleTitle.has(roleTitleKey)) continue;
      if (usedTitles.has(titleKey)) continue;
      seenRoleTitle.add(roleTitleKey);
      usedTitles.add(titleKey);
      selected.push(item);
      count += 1;
      if (count >= perRole) break;
      if (selected.length >= max) break;
    }
    if (selected.length >= max) break;
  }

  return selected.slice(0, max);
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

function relativeOffset(lat, lon, hdgDeg, forwardM, rightM) {
  const hdg = hdgDeg * Math.PI / 180;
  const northM = Math.cos(hdg) * forwardM - Math.sin(hdg) * rightM;
  const eastM = Math.sin(hdg) * forwardM + Math.cos(hdg) * rightM;
  return offsetLatLonMeters(lat, lon, northM, eastM);
}

function spawnPositionForIndex(userPos, index) {
  const lane = index % 7;
  const ring = Math.floor(index / 7) % 3;
  const lateral = (lane - 3) * options.spacingM;
  const forward = options.offsetM + ring * options.spacingM;
  const p = relativeOffset(userPos.lat, userPos.lon, userPos.hdg || 0, forward, lateral);
  return {
    lat: p.lat,
    lon: p.lon,
    altFt: userPos.alt,
    hdg: userPos.hdg || 0,
    forwardM: round1(forward),
    rightM: round1(lateral)
  };
}

function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readFloat64FromRecv(recv, count) {
  const readFn = typeof recv.data.readFloat64 === 'function'
    ? () => recv.data.readFloat64()
    : (typeof recv.data.readDouble === 'function' ? () => recv.data.readDouble() : null);
  if (!readFn) throw new Error('SimConnect buffer has no Float64 reader');
  const values = [];
  for (let i = 0; i < count; i += 1) values.push(readFn());
  return values;
}

function requestUserPosition() {
  return new Promise((resolve, reject) => {
    try {
      handle.addToDataDefinition(DEF_IDS.USER_POS, 'PLANE LATITUDE', 'degrees', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_IDS.USER_POS, 'PLANE LONGITUDE', 'degrees', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_IDS.USER_POS, 'PLANE ALTITUDE', 'feet', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_IDS.USER_POS, 'PLANE HEADING DEGREES TRUE', 'degrees', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_IDS.USER_POS, 'SIM ON GROUND', 'Bool', SimConnectDataType.FLOAT64);
      handle.addToDataDefinition(DEF_IDS.USER_POS, 'PLANE ALT ABOVE GROUND', 'feet', SimConnectDataType.FLOAT64);
      handle.requestDataOnSimObject(
        REQ_IDS.USER_POS,
        DEF_IDS.USER_POS,
        SimConnectConstants.OBJECT_ID_USER,
        SimConnectPeriod.ONCE,
        0,
        0,
        0,
        0
      );
    } catch (err) {
      reject(err);
      return;
    }

    const timer = setTimeout(() => {
      handle.removeListener('simObjectData', onData);
      reject(new Error('Keine Positionsdaten vom User-Flugzeug erhalten.'));
    }, 5000);

    const onData = (recv) => {
      if (recv.requestID !== REQ_IDS.USER_POS) return;
      clearTimeout(timer);
      handle.removeListener('simObjectData', onData);
      try {
        const [lat, lon, alt, hdg, onGround, agl] = readFloat64FromRecv(recv, 6);
        resolve({ lat, lon, alt, hdg, onGround: onGround > 0.5, agl });
      } catch (err) {
        reject(err);
      }
    };

    handle.on('simObjectData', onData);
  });
}

function waitForAssignedObject(requestId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pendingSpawn?.requestId === requestId) pendingSpawn = null;
      reject(new Error('TIMEOUT'));
    }, timeoutMs);
    pendingSpawn = {
      requestId,
      resolve: (objectId) => {
        clearTimeout(timer);
        pendingSpawn = null;
        resolve(objectId);
      },
      reject: (err) => {
        clearTimeout(timer);
        pendingSpawn = null;
        reject(err);
      }
    };
  });
}

async function spawnTitle(title, initPos, timeoutMs) {
  const requestId = REQ_IDS.SPAWN_BASE + (++requestSeq);
  const waitPromise = waitForAssignedObject(requestId, timeoutMs);
  handle.aICreateSimulatedObject(title, initPos, requestId);
  return waitPromise;
}

async function removeObject(objectId) {
  if (!handle || !Number.isFinite(Number(objectId))) return;
  try {
    handle.aIRemoveObject(Number(objectId), REQ_IDS.REMOVE_BASE + (++requestSeq));
  } catch (err) {
    console.warn(`remove failed objectId=${objectId}: ${err?.message || err}`);
  }
  activeObjectIds = activeObjectIds.filter((id) => Number(id) !== Number(objectId));
}

async function cleanupAll() {
  const ids = [...new Set(activeObjectIds)];
  if (!ids.length) return;
  console.log(`Cleanup: entferne ${ids.length} Objekt(e) ...`);
  for (const id of ids) {
    await removeObject(id);
    await sleep(40);
  }
}

function installSimConnectHandlers() {
  handle.on('assignedObjectID', (recv) => {
    if (pendingSpawn && pendingSpawn.requestId === recv.requestID) {
      pendingSpawn.resolve(recv.objectID);
    }
  });

  handle.on('exception', (recv) => {
    const name = recv.exceptionName || String(recv.exception || 'SimConnect Exception');
    const msg = `${name}${recv.sendId !== undefined ? ` sendId=${recv.sendId}` : ''}`;
    console.log(`[SimConnect Exception] ${msg}`);
    if (pendingSpawn) pendingSpawn.reject(new Error(name));
  });

  handle.on('error', (err) => console.log('SimConnect error: ' + (err?.message || err)));
  handle.on('close', () => console.log('SimConnect closed.'));
}

async function validateCandidate(item, index, userPos) {
  const spawnPos = spawnPositionForIndex(userPos, index);
  const initPos = buildInitPos(spawnPos.lat, spawnPos.lon, spawnPos.altFt, spawnPos.hdg, true);
  const variants = titleVariants(item.record.title);
  const started = Date.now();
  const attemptLog = [];

  for (const title of variants) {
    try {
      const objectId = await spawnTitle(title, initPos, options.timeoutMs);
      activeObjectIds.push(objectId);
      console.log(`  ACK ${item.role} | "${title}" objectId=${objectId}`);

      let visualStatus = 'unverified';
      let visualNote = '';
      if (options.manualReview) {
        const review = await askManualReview(item, title, objectId, spawnPos);
        visualStatus = review.visualStatus;
        visualNote = review.visualNote;
        if (review.abort) abortRequested = true;
      } else if (options.holdMs > 0) {
        await sleep(options.holdMs);
      }

      if (!options.keepOk) await removeObject(objectId);
      const result = {
        status: 'accepted',
        createStatus: 'simconnect_ack',
        validationLevel: visualStatus === 'visible' ? 'manual_visual_confirmed' : 'simconnect_ack_unverified',
        visualStatus,
        visualNote,
        role: item.role,
        title: item.record.title,
        spawnedTitle: title,
        objectId,
        durationMs: Date.now() - started,
        score: item.score,
        roleHints: item.record.roleHints,
        roles: item.rolesForRecord,
        kind: item.record.kind,
        category: item.record.category,
        confidence: item.record.confidence,
        packageName: item.record.packageName,
        path: item.record.path,
        spawnPos
      };
      return result;
    } catch (err) {
      const error = err?.message || String(err);
      attemptLog.push({ title, error });
      console.log(`  --  ${item.role} | "${title}" -> ${error}`);
      await sleep(80);
    }
  }

  return {
    status: 'failed',
    createStatus: 'failed',
    validationLevel: 'create_failed',
    visualStatus: 'not_spawned',
    visualNote: '',
    role: item.role,
    title: item.record.title,
    spawnedTitle: '',
    objectId: null,
    durationMs: Date.now() - started,
    score: item.score,
    error: attemptLog.map((entry) => `${entry.title}: ${entry.error}`).join(' | '),
    attempts: attemptLog,
    roleHints: item.record.roleHints,
    roles: item.rolesForRecord,
    kind: item.record.kind,
    category: item.record.category,
    confidence: item.record.confidence,
    packageName: item.record.packageName,
    path: item.record.path,
    spawnPos
  };
}

function askQuestion(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(String(answer || '').trim());
    });
  });
}

async function askManualReview(item, title, objectId, spawnPos) {
  console.log(
    `      Sichttest: ${round1(spawnPos.forwardM)}m vorne, ${round1(spawnPos.rightM)}m rechts. ` +
    `Objekt bleibt bis zur Eingabe stehen.`
  );
  const answer = (await askQuestion('      [j] sichtbar/nutzbar, [n] nicht sichtbar/falsch, [u] unsicher, [q] abbrechen: ')).toLowerCase();
  if (answer.startsWith('j') || answer.startsWith('y')) {
    return { visualStatus: 'visible', visualNote: 'manual yes', abort: false };
  }
  if (answer.startsWith('n')) {
    return { visualStatus: 'rejected', visualNote: 'manual no', abort: false };
  }
  if (answer.startsWith('q')) {
    return { visualStatus: 'unverified', visualNote: 'manual abort', abort: true };
  }
  return { visualStatus: 'uncertain', visualNote: `manual ${answer || 'uncertain'}`, abort: false };
}

function csvEscape(value) {
  const s = value === null || value === undefined
    ? ''
    : (Array.isArray(value) ? value.join('|') : String(value));
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeOutputs(sourceCatalog, selected, userPos) {
  const accepted = results.filter((r) => r.status === 'accepted' || r.status === 'ok');
  const visualConfirmed = accepted.filter((r) => r.visualStatus === 'visible');
  const visualRejected = accepted.filter((r) => r.visualStatus === 'rejected');
  const visualUncertain = accepted.filter((r) => r.visualStatus === 'uncertain');
  const realFailed = results.filter((r) => r.status !== 'accepted' && r.status !== 'ok');
  const payload = {
    tool: APP_NAME,
    version: TOOL_VERSION,
    createdAt: new Date().toISOString(),
    sourceCatalog,
    options,
    userPosition: userPos || null,
    stats: {
      selected: selected.length,
      tested: results.length,
      accepted: accepted.length,
      ok: accepted.length,
      visualConfirmed: visualConfirmed.length,
      visualRejected: visualRejected.length,
      visualUncertain: visualUncertain.length,
      failed: realFailed.length
    },
    results
  };
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');

  const headers = [
    'status',
    'createStatus',
    'validationLevel',
    'visualStatus',
    'visualNote',
    'role',
    'title',
    'spawnedTitle',
    'objectId',
    'score',
    'durationMs',
    'error',
    'roleHints',
    'kind',
    'category',
    'confidence',
    'packageName',
    'path'
  ];
  const lines = [
    headers.join(';'),
    ...results.map((r) => headers.map((key) => csvEscape(r[key])).join(';'))
  ];
  fs.writeFileSync(csvPath, `${lines.join('\n')}\n`, 'utf8');

  const grouped = {};
  const catalogMode = options.manualReview ? 'manual_visual_confirmed' : 'simconnect_ack_unverified';
  const catalogResults = options.manualReview
    ? accepted.filter((result) => result.visualStatus === 'visible')
    : accepted;
  for (const result of catalogResults) {
    if (!grouped[result.role]) grouped[result.role] = [];
    grouped[result.role].push({
      title: result.spawnedTitle,
      catalogTitle: result.title,
      role: result.role,
      validationLevel: result.validationLevel,
      visualStatus: result.visualStatus || 'unverified',
      roleHints: result.roleHints,
      kind: result.kind,
      category: result.category,
      confidence: result.confidence,
      packageName: result.packageName,
      sourcePath: result.path,
      validatedAt: payload.createdAt
    });
  }
  fs.writeFileSync(curatedPath, JSON.stringify({
    tool: APP_NAME,
    version: TOOL_VERSION,
    createdAt: payload.createdAt,
    sourceCatalog,
    catalogMode,
    stats: payload.stats,
    roles: grouped
  }, null, 2), 'utf8');

  writeDebug('outputs-written');
}

function printDryRun(selected) {
  console.log('');
  console.log('Dry-Run Kandidaten:');
  selected.forEach((item, index) => {
    console.log(`${String(index + 1).padStart(3, ' ')}. ${item.role.padEnd(24)} score=${String(Math.round(item.score)).padStart(4, ' ')} "${item.record.title}"`);
  });
}

function validateUserPosition(pos) {
  if (!Number.isFinite(pos.lat) || !Number.isFinite(pos.lon) || !Number.isFinite(pos.alt)) {
    throw new Error('User-Flugzeugposition ist unvollstaendig.');
  }
  if (!options.allowZero && Math.abs(pos.lat) < 0.0001 && Math.abs(pos.lon) < 0.0001) {
    throw new Error('User-Flugzeug steht noch auf 0/0. Bitte erst Flug laden und am Startplatz warten.');
  }
}

async function main() {
  console.log('====================================');
  console.log('  MSFS 2024 Asset Spawn Validator');
  console.log('====================================');
  console.log(`Version : ${TOOL_VERSION}`);
  console.log(`Catalog : ${options.catalogPath}`);
  console.log(`Output  : ${outputDir}`);
  console.log(`Roles   : ${options.roles.join(', ')}`);
  console.log(`Limit   : ${options.perRole}/role, max ${options.max}`);
  console.log(`Mode    : ${options.manualReview ? 'manual visual review' : 'SimConnect ACK scan (visual unverified)'}`);
  console.log('');

  if (!fileExists(options.catalogPath)) {
    throw new Error(`Katalog nicht gefunden: ${options.catalogPath}`);
  }

  const records = loadRecords(options.catalogPath);
  const selected = selectCandidates(records, options.roles, options.perRole, options.max, options.includeRisky);
  console.log(`Katalog: ${records.length} Records, ${selected.length} Kandidaten ausgewaehlt.`);

  if (options.dryRun) {
    printDryRun(selected);
    writeOutputs(options.catalogPath, selected, null);
    console.log('');
    console.log(`Dry-Run geschrieben: ${jsonPath}`);
    return;
  }

  console.log('Verbinde mit SimConnect ...');
  const conn = await open(APP_NAME, Protocol.KittyHawk);
  handle = conn.handle;
  installSimConnectHandlers();
  console.log('SimConnect verbunden.');

  const userPos = await requestUserPosition();
  validateUserPosition(userPos);
  console.log(
    `User pos: lat=${userPos.lat.toFixed(6)} lon=${userPos.lon.toFixed(6)} ` +
    `alt=${userPos.alt.toFixed(0)}ft hdg=${userPos.hdg.toFixed(0)} onGround=${userPos.onGround ? 'Y' : 'N'} agl=${Math.round(userPos.agl)}ft`
  );
  if (!userPos.onGround) {
    console.log('Hinweis: Flugzeug ist laut Sim nicht am Boden. Der Test laeuft trotzdem, aber Bodenszenerie kann schlechter sitzen.');
  }
  console.log('');

  for (let i = 0; i < selected.length; i += 1) {
    const item = selected[i];
    console.log(`[${i + 1}/${selected.length}] ${item.role} "${item.record.title}"`);
    const result = await validateCandidate(item, i, userPos);
    results.push(result);
    writeOutputs(options.catalogPath, selected, userPos);
    if (abortRequested) {
      console.log('Manueller Sichttest abgebrochen.');
      break;
    }
    if (options.pauseMs > 0) await sleep(options.pauseMs);
  }

  if (!options.keepOk) await cleanupAll();
  writeOutputs(options.catalogPath, selected, userPos);

  const accepted = results.filter((r) => r.status === 'accepted' || r.status === 'ok').length;
  const visible = results.filter((r) => r.visualStatus === 'visible').length;
  const rejected = results.filter((r) => r.visualStatus === 'rejected').length;
  const failed = results.filter((r) => r.status !== 'accepted' && r.status !== 'ok').length;
  console.log('');
  console.log(`Fertig: ${accepted} SimConnect-ACK, ${visible} sichtbar bestaetigt, ${rejected} visuell abgelehnt, ${failed} fehlgeschlagen.`);
  console.log(`JSON : ${jsonPath}`);
  console.log(`CSV  : ${csvPath}`);
  console.log(`Kurz : ${curatedPath}`);
  console.log(`Debug: ${debugPath}`);
}

process.on('SIGINT', async () => {
  console.log('');
  console.log('Abbruch angefordert.');
  await cleanupAll();
  writeOutputs(options.catalogPath, [], null);
  process.exit(130);
});

main().catch(async (err) => {
  console.error('ABBRUCH: ' + (err?.message || err));
  await cleanupAll();
  writeDebug('fatal-error');
  process.exit(1);
});
