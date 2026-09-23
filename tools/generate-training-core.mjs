import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(here, '..', 'mission-training-procedure.js');
const targetPath = path.join(here, '..', 'mission-training-core.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const start = source.indexOf('(function(root) {');
const end = source.lastIndexOf('})(typeof window');
if (start !== 0 || end < 0) throw new Error('Unexpected training procedure wrapper');
let body = source.slice(source.indexOf('\n', start) + 1, end);
body = body.replace("    const host = root || (typeof globalThis !== 'undefined' ? globalThis : {});", '    const host = root || {};');
body = body.replaceAll('Date.now()', 'clock.now()');
body = body.replace('        reset,\n        signalReady,', `        reset,
        signalReady,
        initialize: (missionData, passenger) => {
            ensureStateForControl(missionData, passenger);
            return exportFullState();
        },
        exportFullState,
        importFullState,`);
body = body.replace('    const api = {', `    function exportFullState() {
        if (!activeState) return { activeRecipeKey, activeState: null };
        return JSON.parse(JSON.stringify({ activeRecipeKey, activeState }));
    }

    function importFullState(saved) {
        const value = saved && typeof saved === 'object' ? saved : {};
        activeRecipeKey = String(value.activeRecipeKey || '');
        activeState = value.activeState && typeof value.activeState === 'object'
            ? JSON.parse(JSON.stringify(value.activeState)) : null;
        return exportFullState();
    }

    const api = {`);
body = body.replace("    host.missionTrainingProcedure = api;\n    if (typeof module !== 'undefined' && module.exports) module.exports = api;\n", '    return api;\n');
if (body.includes('Date.now()') || !body.includes('return api;') || !body.includes('importFullState')) throw new Error('Training source transformation failed');
const output = `// Generated from mission-training-procedure.js by tools/generate-training-core.mjs.\n// Keep behavior changes in the original source and regenerate this isolated factory.\n(function(root, factory) {\n  const exported = { create: factory };\n  if (typeof module === 'object' && module.exports) module.exports = exported;\n  else if (root) root.GAMissionTrainingCore = exported;\n})(typeof globalThis !== 'undefined' ? globalThis : this, function(root, clock) {\n'use strict';\nclock = clock && typeof clock.now === 'function' ? clock : { now: () => Date.now() };\n${body}\n});\n`;
if (process.argv.includes('--check')) {
  if (!fs.existsSync(targetPath) || fs.readFileSync(targetPath, 'utf8') !== output) throw new Error('Training core drift; run node tools/generate-training-core.mjs');
} else fs.writeFileSync(targetPath, output);
