import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { extractOriginalFunction } from './extract-original-function.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const syncPath = path.join(here, '..', 'sync.js');
const appPath = path.join(here, '..', 'app.js');
const targetPath = path.join(here, '..', 'mission-bush-pickup-scene-core.js');
const syncSource = fs.readFileSync(syncPath, 'utf8');
const appSource = fs.readFileSync(appPath, 'utf8');
const relative = extractOriginalFunction(syncSource, '_missionSceneWorldPointToRelative');
const calcNav = extractOriginalFunction(appSource, 'calcNav');
// The extracted command fragment is emitted verbatim inside the pure adapter.
// Compile candidates so nested objects and braces in the command are respected.
function extractAsyncOriginalFunction(source, name) {
  const start = source.indexOf(`async function ${name}(`);
  if (start < 0) throw new Error(`Missing original async function: ${name}`);
  let end = source.indexOf('\n}', start);
  while (end >= 0) {
    const candidate = source.slice(start, end + 2);
    try { new vm.Script(candidate); return candidate; } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
    end = source.indexOf('\n}', end + 2);
  }
  throw new Error(`Unterminated original async function: ${name}`);
}
const boarding = extractAsyncOriginalFunction(syncSource, '_missionBushPickupBoarding');
function extractBoardingCommandFragment(source) {
  const start = source.indexOf('    const spawnPoint = {');
  if (start < 0) throw new Error('Missing original Bush pickup boarding command fragment');
  let end = source.indexOf('\n', start);
  while (end >= 0) {
    const candidate = source.slice(start, end);
    try {
      new vm.Script(`(function() {\n${candidate}\nreturn command;\n})`);
      if (!candidate.includes('const command = {')) throw new Error('premature command fragment boundary');
      return candidate;
    } catch (error) {
      if (!(error instanceof SyntaxError) && error.message !== 'premature command fragment boundary') throw error;
    }
    end = source.indexOf('\n', end + 1);
  }
  throw new Error('Unterminated original Bush pickup boarding command fragment');
}
const commandFragment = extractBoardingCommandFragment(boarding);

const output = `// Generated from sync.js and app.js by tools/generate-bush-pickup-scene-core.mjs.
// Do not edit by hand. The original App behavior remains the reference.
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAMissionBushPickupSceneCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
'use strict';
${calcNav}
${relative}
function buildCommand(recipe = {}, livePosition = {}) {
  const aptSceneId = recipe.sceneId;
  const personPoint = recipe.personPoint;
  const pos = livePosition || {};
  const hdg = Number(pos.hdg);
  if (!aptSceneId || !personPoint || !Number.isFinite(Number(pos.lat))
      || !Number.isFinite(Number(pos.lon)) || !Number.isFinite(hdg)) return null;
  const personRel = _missionSceneWorldPointToRelative(
    Number(pos.lat), Number(pos.lon), hdg, personPoint.worldLat, personPoint.worldLon
  );
  if (!personRel) return null;
  const boardingConfig = recipe.boardingConfig || {};
  const options = { reason: recipe.reason };
  const _missionSceneCommonSceneCommandFields = () => recipe.commonFields || {};
${commandFragment}
  return command;
}
return Object.freeze({ buildCommand });
});
`;

if (process.argv.includes('--check')) {
  if (!fs.existsSync(targetPath) || fs.readFileSync(targetPath, 'utf8') !== output) {
    throw new Error('mission-bush-pickup-scene-core.js drifted from sync.js/app.js; run tools/generate-bush-pickup-scene-core.mjs');
  }
} else {
  fs.writeFileSync(targetPath, output);
}
