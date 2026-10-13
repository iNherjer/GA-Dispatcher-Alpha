import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const app = fs.readFileSync(new URL('../mission-compliance-core.js', import.meta.url), 'utf8');
const block = app.slice(app.indexOf('let missionComplianceDebugForcePromise'), app.indexOf('function _missionComplianceDebugStartError'));
function fixture(submit, allowed = true) {
  const alerts = [], calls = [], state = { selected: false, phase: 'none' };
  const context = { window: { gaTrackerExecutionControl: { allowedActions: allowed ? ['debug_force_compliance'] : [],
      workflows: { complianceInspection: state } },
    gaTrackerExecutionSubmitIntent: (...args) => { calls.push(args); return submit(...args); } },
    _missionComplianceTrackerAuthority: () => true,
    _missionComplianceGetState: () => { throw Error('local state must not be read'); },
    _missionCompliancePersist: () => { throw Error('local state must not be mutated'); },
    alert: value => alerts.push(value) };
  vm.createContext(context); vm.runInContext(block, context);
  return { context, calls, state, alerts, force: () => context.window.missionComplianceDebugForceCurrentFlight() };
}
test('Web debug button sends one intent, awaits tracker ACK and never mutates the local state', async () => {
  let finish;
  const f = fixture(() => new Promise(resolve => { finish = resolve; }));
  const pending = f.force(); assert.equal(f.force(), pending);
  await Promise.resolve(); assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][0], 'debug_force_compliance');
  assert.equal(f.state.selected, false);
  finish({ ok: true }); assert.equal(await pending, true);
  assert.equal(f.alerts.length, 0);
  assert.equal(f.state.phase, 'none');
});
test('rejected/offline/older tracker never falls back to a local inspection', async () => {
  for (const submit of [() => ({ ok: false }), () => { throw Error('offline'); }]) {
    const f = fixture(submit); assert.equal(await f.force(), false);
    assert.equal(f.alerts.length, 1); assert.equal(f.state.selected, false);
  }
  const older = fixture(() => { throw Error('must not be called'); }, false);
  assert.equal(await older.force(), false); assert.equal(older.calls.length, 0);
});
