'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const core = require('./mission-control-ui-core');
const source = fs.readFileSync(path.join(__dirname, 'tracker-efb-kartentisch-host.js'), 'utf8');
function host(submitIntent, fetchJson) {
  const rendered = [];
  const control = { missionId: 'm', runId: 'r', authorityRevision: 1, phase: 'boarding' };
  const context = {
    window: { GAMissionControlUiCore: core, gaCockpitSessionClient: { submitIntent }, setTimeout: () => 1 },
    missionSnapshot: { control }, missionIntentPending: false, missionIntentStatus: '', missionIntentTone: '',
    missionResponseEpoch: 0, missionIntentQueue: null, pollingClosed: false, cargoManagerOpen: true,
    report() {}, renderSideDrawer() {}, renderCargoManager() {}, renderMissionActionBanner() {}, renderMissionToolbar() {},
    openCargoManager() {}, fetchJson, safePayload: envelope => envelope.message.payload,
    renderMissionPayload: snapshot => { rendered.push(snapshot); context.missionSnapshot = snapshot; },
    Date, Math
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  function submitMissionIntent('), source.indexOf('  function cargoStatusLabel(')), context);
  vm.runInContext(source.slice(source.indexOf('  function pollMission('), source.indexOf('  function syncProfileButton(')), context);
  return { context, rendered, control };
}

test('EFB applies ACK snapshot and sends next item at its new revision without a GET', async () => {
  const revisions = [];
  const { context, rendered, control } = host(async request => {
    revisions.push(request.expectedRevision);
    return { ok: true, missionSnapshot: { available: true, control: { ...control, authorityRevision: request.expectedRevision + 1 } } };
  }, () => { throw new Error('unnecessary GET'); });
  await Promise.all([context.submitMissionIntent('set_manifest_item', { itemId: 'a', action: 'load' }),
    context.submitMissionIntent('set_manifest_item', { itemId: 'b', action: 'load' })]);
  assert.deepEqual(revisions, [1, 2]);
  assert.equal(rendered.length, 2);
  assert.equal(context.missionIntentQueue.size(), 0);
});

test('an older host with a stalled reconciliation GET does not hold the intent queue', async () => {
  let calls = 0;
  const { context } = host(async () => { calls++; return { ok: true }; }, () => new Promise(() => {}));
  await context.submitMissionIntent('set_manifest_item', { itemId: 'a', action: 'load' });
  await context.submitMissionIntent('set_manifest_item', { itemId: 'b', action: 'load' });
  assert.equal(calls, 2);
  assert.equal(context.missionIntentPending, false);
});

test('a mission poll started before ACK cannot overwrite its newer snapshot', async () => {
  let finishPoll;
  const { context, rendered, control } = host(async () => ({ ok: true,
    missionSnapshot: { available: true, control: { ...control, authorityRevision: 2 } }
  }), () => new Promise(resolve => { finishPoll = resolve; }));
  context.pollMission();
  await context.submitMissionIntent('set_manifest_item', { itemId: 'a', action: 'load' });
  finishPoll({ message: { payload: { available: false } } });
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(rendered.length, 1);
  assert.equal(context.missionSnapshot.control.authorityRevision, 2);
});
