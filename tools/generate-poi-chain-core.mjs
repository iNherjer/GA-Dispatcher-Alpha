import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(here, '..', 'mission-poi-chain-runtime.js');
const targetPath = path.join(here, '..', 'mission-poi-chain-core.js');
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
  'roundNumber', 'clamp', 'toRad', 'toDeg', 'haversineNm', 'bearingDeg',
  'angleDiffAbs', 'localPointNm', 'projectPointToSegmentNm', 'cleanText',
  'normalizePoint', 'normalizeHiddenOutcome', 'normalizeTracePoint', 'dedupeTracePoints',
  'corridorTraceFromRaw', 'normalizeCorridorWidthNm', 'polylineDistanceSamples',
  'interpolateTraceAtNm', 'projectPointToTraceNm', 'sliceTraceInfoBetweenNm',
  'trimTraceInfoToChainPoints', 'normalizeCorridor', 'normalizeSpec', 'setFromArray',
  'corridorRequired', 'requiredPointsDone', 'corridorDone', 'createInitialState',
  'hydrateState', 'snapshotState', 'sampleSpeedOk',
  'headingMatchesSegment', 'findSegmentProjection', 'sampleNearCorridor',
  'makeCorridorResetEvent', 'tickCorridorState', 'tickState'
];
const original = [
  'NM_TO_M', 'EARTH_RADIUS_NM', 'CORRIDOR_WIDTH_VERSION', 'LEGACY_CORRIDOR_WIDTH_SCALE', 'DEFAULTS'
].map(extractConst).concat(names.map(extractFunction)).join('\n\n');

const output = `// Generated from the pure POI-chain functions in mission-poi-chain-runtime.js by tools/generate-poi-chain-core.mjs.
// Do not edit by hand. The standalone runtime remains the behavioral reference.
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAMissionPoiChainCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
'use strict';
let activeState = null;
${original}

// The app runtime's version also reads browser globals. The core accepts only
// the normalized input supplied by its caller.
function sampleFromInput(input = {}) {
  return { lat: Number(input.lat), lon: Number(input.lon ?? input.lng),
    headingDeg: Number(input.headingDeg ?? input.hdg), gsKts: Number(input.gsKts ?? input.gs),
    nowMs: Number(input.nowMs ?? input.now) };
}

function serializeState(state) {
  const out = snapshotState(state);
  if (!out) return null;
  const active = state?.corridor?.active;
  if (active && typeof active === 'object') {
    out.corridor.active = {
      segmentId: String(active.segmentId || ''), direction: active.direction === 'reverse' ? 'reverse' : 'forward',
      bins: active.bins instanceof Set ? Array.from(active.bins) : [], totalBins: Number(active.totalBins || 0),
      startedAt: Number(active.startedAt || 0), lastGoodAt: Number(active.lastGoodAt || 0),
      badSince: Number(active.badSince || 0), lastT: Number(active.lastT || 0), endCap: active.endCap === true
    };
  }
  return out;
}

function hydrateRuntimeState(specRaw, saved) {
  const spec = specRaw?.schema === 'ga.poiChainRuntime.v1' ? specRaw : normalizeSpec(specRaw);
  if (!spec) return null;
  const state = hydrateState(spec, saved);
  const runtimeSpec = normalizeSpec(spec);
  const active = saved?.corridor?.active;
  const segment = runtimeSpec?.corridor?.segments?.find(item => String(item.id) === String(active?.segmentId || ''));
  const bins = Array.isArray(active?.bins) ? active.bins : null;
  if (segment && bins && bins.length <= runtimeSpec.corridor.bins
      && ['startedAt', 'lastGoodAt', 'badSince', 'lastT'].every(key => Number.isFinite(Number(active[key])))) {
    const legalBins = bins.map(Number).filter(bin => Number.isInteger(bin) && bin >= 0 && bin < runtimeSpec.corridor.bins);
    if (legalBins.length === bins.length) state.corridor.active = {
      segmentId: String(segment.id), direction: active.direction === 'reverse' ? 'reverse' : 'forward', bins: new Set(legalBins),
      totalBins: runtimeSpec.corridor.bins, startedAt: Number(active.startedAt), lastGoodAt: Number(active.lastGoodAt),
      badSince: Number(active.badSince), lastT: Number(active.lastT), endCap: active.endCap === true
    };
  }
  // tickState re-normalizes the original spec before testing corridorDone.
  // Preserve that effective completion predicate on a JSON restore as well;
  // the initial normalized spec can have fewer segments than that tick view.
  state.corridor.satisfied = corridorDone(runtimeSpec, state);
  state.satisfied = requiredPointsDone(runtimeSpec, state) && state.corridor.satisfied;
  return state;
}

return { NM_TO_M, EARTH_RADIUS_NM, DEFAULTS, normalizeSpec, createInitialState, hydrateState,
  hydrateRuntimeState, serializeState, snapshotState, tickState, tickCorridorState, haversineNm };
});
`;

if (process.argv.includes('--check')) {
  if (!fs.existsSync(targetPath) || fs.readFileSync(targetPath, 'utf8') !== output) throw new Error('mission-poi-chain-core.js is out of date');
} else {
  fs.writeFileSync(targetPath, output);
}
