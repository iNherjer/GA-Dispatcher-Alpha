'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');

// Execute the real logger declarations in their original entry-point scopes,
// without starting Windows SimConnect, authentication, HTTP or mission IPC.
function entryPoint(worker) {
  const source = fs.readFileSync(require.resolve('./tracker.js'), 'utf8');
  const ast = babel.parseSync(source, { sourceType: 'script' });
  const isLogger = node => node.type === 'VariableDeclaration'
    && node.declarations.some(d => ['debugLog', 'environmentDiagnostics'].includes(d.id.name));
  const branch = ast.program.body.find(node => node.type === 'IfStatement'
    && source.slice(node.test.start, node.test.end).includes('--mission-worker'));
  assert.ok(branch, 'entry point retains a separate mission-worker branch');
  branch.alternate.body = branch.alternate.body.filter(isLogger);
  branch.alternate.body.push(...babel.parseSync(`
    environmentDiagnostics.observe({observedAt:1000,simAbsoluteTimeSeconds:100000});
    environmentDiagnostics.observe({observedAt:2000,simAbsoluteTimeSeconds:110000});
  `).program.body);
  ast.program.body = ast.program.body.filter(node => isLogger(node) || node === branch);
  const rows = [], systemRows = [], loaded = [];
  vm.runInNewContext(babel.transformFromAstSync(ast, null, {configFile:false, babelrc:false}).code, {
    process: {argv: worker ? ['--mission-worker'] : [], send: worker ? () => {} : undefined},
    require(name) {
      loaded.push(name);
      if (name === './tracker-mission-worker.js') return {runMissionWorker() {}};
      return require(name);
    },
    writeDebugLog(line) {rows.push(line); return true;},
    missionTestLog: {recordSystemLine(line) {systemRows.push(line);}}
  });
  return {rows, systemRows, loaded};
}

test('entry-point environment diagnostics reach both logs without aborting telemetry', () => {
  const {rows, systemRows} = entryPoint(false);
  assert.equal(rows.length, 3);
  assert.match(rows[0], /SIM_ENV_PRESET/);
  assert.match(rows[1], /SIM_ENV_TIME.*initial/);
  assert.match(rows[2], /SIM_ENV_TIME.*jump/);
  assert.deepEqual(systemRows, rows);
});

test('mission-worker entry point does not initialize main-process diagnostics', () => {
  const {rows, loaded} = entryPoint(true);
  assert.deepEqual(rows, []);
  assert.deepEqual(loaded, ['./tracker-mission-worker.js']);
});
