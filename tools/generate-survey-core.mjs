import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(here, '..', 'mission-survey-pattern.js');
const targetPath = path.join(here, '..', 'mission-survey-core.js');
const fixturePath = path.join(here, 'fixtures', 'survey-legacy-20260922.js');
const source = fs.readFileSync(sourcePath, 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing original function ${name}`);
  let end = source.indexOf('\n    }', start);
  while (end >= 0) {
    const candidate = source.slice(start, end + 6);
    try { new Function(`${candidate}\nreturn ${name};`)(); return candidate; } catch (_) {}
    end = source.indexOf('\n    }', end + 6);
  }
  throw new Error(`Unterminated original function ${name}`);
}

function extractConst(name) {
  const start = source.indexOf(`const ${name} =`);
  if (start < 0) throw new Error(`Missing original constant ${name}`);
  let end = source.indexOf(';', start);
  while (end >= 0) {
    const candidate = source.slice(start, end + 1);
    try { new Function(`${candidate}\nreturn ${name};`)(); return candidate; } catch (_) {}
    end = source.indexOf(';', end + 1);
  }
  throw new Error(`Unterminated original constant ${name}`);
}

const names = [
  'clamp', 'roundNumber', 'toRad', 'toDeg', 'haversineNm', 'bearingDeg',
  'destinationPoint', 'angleDiffAbs', 'signedAngleDelta', 'interpolateLine',
  'localPointNm', 'localPointToLatLonNm', 'projectPointToLineNm', 'buildScanLines',
  'normalizeType', 'normalizeSpec', 'setFromArray', 'createInitialState',
  'hydrateState', 'snapshotState', 'sampleAltitudeOk', 'sampleSpeedOk',
  'headingMatchesLine', 'findLineCandidate', 'makeScanResetEvent',
  'sampleInsideScanArea', 'tickScanState', 'makeOrbitResetEvent', 'tickOrbitState',
  'tickState'
];
const original = [extractConst('NM_TO_M'), extractConst('EARTH_RADIUS_NM'), extractConst('DEFAULTS'),
  ...names.map(extractFunction)].join('\n\n');
const extractedTick = extractFunction('tickState').replace(/function tickState\(/, 'function tickStateOriginal(')
  .replace(/return tickState\(/g, 'return tickStateOriginal(');
const originalWithoutTick = [extractConst('NM_TO_M'), extractConst('EARTH_RADIUS_NM'), extractConst('DEFAULTS'),
  ...names.filter(name => name !== 'tickState').map(extractFunction), extractedTick].join('\n\n');

const output = `// Generated from the pure survey functions in mission-survey-pattern.js by tools/generate-survey-core.mjs.
// Do not edit by hand. The standalone source remains the behavioral reference.
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAMissionSurveyCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
'use strict';
${originalWithoutTick}

// The standalone tick accepts an App-shaped flightData object through a
// browser-host fallback. The shared core intentionally accepts only an already
// normalized raw sample, so it has no hidden host dependency.
function tickState(specRaw, stateRaw, sampleRaw) {
  if (sampleRaw && typeof sampleRaw === 'object' && sampleRaw.flightData) {
    throw new TypeError('survey_core_requires_normalized_sample');
  }
  return tickStateOriginal(specRaw, stateRaw, sampleRaw);
}

function arrayOfSet(value) { return value instanceof Set ? Array.from(value) : []; }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function serializeActiveScan(active) {
  if (!active || typeof active !== 'object') return null;
  return { lineId: String(active.lineId || ''), direction: active.direction === 'reverse' ? 'reverse' : 'forward',
    bins: arrayOfSet(active.bins), totalBins: Math.max(1, Number(active.totalBins || 1)),
    startedAt: Number(active.startedAt || 0), lastGoodAt: Number(active.lastGoodAt || 0),
    badSince: Number(active.badSince || 0), lastT: Number(active.lastT || 0), endCap: !!active.endCap };
}
function serializeActiveOrbit(active) {
  if (!active || typeof active !== 'object') return null;
  return { sectors: arrayOfSet(active.sectors), totalSectors: Math.max(1, Number(active.totalSectors || 1)),
    startedAt: Number(active.startedAt || 0), lastGoodAt: Number(active.lastGoodAt || 0),
    badSince: Number(active.badSince || 0), lastAngle: Number(active.lastAngle || 0),
    direction: Number(active.direction || 0) };
}
function serializeState(state) {
  if (!state || typeof state !== 'object') return null;
  return {
    schema: 'ga.surveyPatternRuntime.v1', specKey: String(state.specKey || ''), type: String(state.type || ''),
    startedAt: Number(state.startedAt || 0), updatedAt: Number(state.updatedAt || 0), satisfied: !!state.satisfied,
    events: clone(Array.isArray(state.events) ? state.events : []),
    scan: state.scan ? { completedLineIds: arrayOfSet(state.scan.completedLineIds),
      lastResetReason: String(state.scan.lastResetReason || ''), totalLines: Number(state.scan.totalLines || 0),
      active: serializeActiveScan(state.scan.active) } : null,
    orbit: state.orbit ? { completedTurns: Math.max(0, Number(state.orbit.completedTurns || 0)),
      lastResetReason: String(state.orbit.lastResetReason || ''), requiredTurns: Number(state.orbit.requiredTurns || 0),
      active: serializeActiveOrbit(state.orbit.active) } : null
  };
}
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function restoreSet(value, predicate = () => true) { return new Set((Array.isArray(value) ? value : []).filter(predicate)); }
function hydrateRuntimeState(specRaw, saved = null) {
  const spec = normalizeSpec(specRaw);
  const state = createInitialState(spec);
  if (!spec || !saved || typeof saved !== 'object' || saved.specKey !== spec.key) return state;
  state.startedAt = finite(saved.startedAt) ? saved.startedAt : 0;
  state.updatedAt = finite(saved.updatedAt) ? saved.updatedAt : 0;
  state.satisfied = !!saved.satisfied;
  state.events = clone(Array.isArray(saved.events) ? saved.events : []);
  if (saved.scan && state.scan) {
    state.scan.completedLineIds = restoreSet(saved.scan.completedLineIds, value => spec.scan.lines.some(line => String(line.id) === String(value)));
    state.scan.lastResetReason = String(saved.scan.lastResetReason || '');
    const active = saved.scan.active;
    if (active && spec.scan.lines.some(line => String(line.id) === String(active.lineId))) state.scan.active = {
      lineId: String(active.lineId), direction: active.direction === 'reverse' ? 'reverse' : 'forward',
      bins: restoreSet(active.bins, value => Number.isInteger(value) && value >= 0 && value < spec.scan.bins),
      totalBins: spec.scan.bins, startedAt: finite(active.startedAt) ? active.startedAt : 0,
      lastGoodAt: finite(active.lastGoodAt) ? active.lastGoodAt : 0, badSince: finite(active.badSince) ? active.badSince : 0,
      lastT: finite(active.lastT) ? clamp(active.lastT, 0, 1) : 0, endCap: !!active.endCap
    };
  }
  if (saved.orbit && state.orbit) {
    state.orbit.completedTurns = Math.max(0, Math.min(spec.orbit.requiredTurns, Math.round(Number(saved.orbit.completedTurns || 0))));
    state.orbit.lastResetReason = String(saved.orbit.lastResetReason || '');
    const active = saved.orbit.active;
    if (active) state.orbit.active = {
      sectors: restoreSet(active.sectors, value => Number.isInteger(value) && value >= 0 && value < spec.orbit.sectorsPerTurn),
      totalSectors: spec.orbit.sectorsPerTurn, startedAt: finite(active.startedAt) ? active.startedAt : 0,
      lastGoodAt: finite(active.lastGoodAt) ? active.lastGoodAt : 0, badSince: finite(active.badSince) ? active.badSince : 0,
      lastAngle: finite(active.lastAngle) ? active.lastAngle : 0,
      direction: active.direction === 1 || active.direction === -1 ? active.direction : 0
    };
  }
  return state;
}
return Object.freeze({ DEFAULTS, normalizeSpec, createInitialState, hydrateState, hydrateRuntimeState,
  snapshotState, serializeState, tickState, sampleAltitudeOk, sampleSpeedOk, interpolateLine,
  destinationPoint, haversineNm, bearingDeg, projectPointToLineNm });
});
`;

if (process.argv.includes('--check')) {
  if (!fs.existsSync(targetPath) || fs.readFileSync(targetPath, 'utf8') !== output) throw new Error('Survey core drifted from mission-survey-pattern.js; run tools/generate-survey-core.mjs');
} else fs.writeFileSync(targetPath, output);

if (process.argv.includes('--freeze-reference')) {
  const frozen = `'use strict';
// Frozen standalone survey core reference, captured 2026-09-22. Do not regenerate in tests.
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAFrozenSurveyLegacy20260922 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
'use strict';
${original}
return Object.freeze({ DEFAULTS, normalizeSpec, createInitialState, hydrateState, snapshotState, tickState,
  interpolateLine, destinationPoint, haversineNm, bearingDeg });
});
`;
  fs.writeFileSync(fixturePath, frozen);
}
