'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../sync.js'), 'utf8');
const start = source.indexOf('window.clearMissionSceneObjects = function');
const body = source.slice(start, source.indexOf('\n};', start) + 3);
for (const tracker of [true, false]) test(`scene cleanup emits no redundant commands (tracker=${tracker})`, () => {
  const sent = [];
  const context = {
    window: { sendTrackerCommand: command => { sent.push(command); return 'id'; } },
    _missionExecutionAuthorityIsTracker: () => tracker,
    _boardingMarkerSceneId: () => 'marker', _missionTargetSceneId: () => 'target',
    _missionAptArrivalSceneId: () => 'arrival', _missionCargoUnloadSceneId: () => 'cargo',
    _missionSceneId: () => 'scene', _knownMissionSceneIds: () => Array.from({ length: 64 }, (_, i) => `old-${i}`),
    _missionPhaseDebugPush() {}, _missionStartPhase() {}, _missionRuntimePhaseSnapshot() {}
  };
  vm.runInNewContext(body, context);
  context.window.clearMissionSceneObjects();
  assert.equal(sent.length, tracker ? 0 : 1);
  if (!tracker) assert.equal(sent[0].type, 'mission_scene_clear_all');
});

test('payload timeout removes request so late SimConnect response cannot satisfy it', async () => {
  const tracker = fs.readFileSync(path.join(__dirname, 'tracker.js'), 'utf8');
  const begin = tracker.indexOf('  const requestPayloadSnapshot = async');
  const code = tracker.slice(begin, tracker.indexOf('  const applyPayloadStations', begin));
  let timeout, forwarded;
  const pending = new Map(), logs = [];
  const context = { clampPayloadStationCount: value => value, ensurePayloadReadDefinition: () => 9700,
    nextReqId: 9300, pendingPayloadReads: pending, Date, Promise, Math, Number, String, Error,
    setTimeout: (fn, ms) => { timeout = fn; assert.equal(ms, 1200); return 1; }, clearTimeout() {},
    handle: { requestDataOnSimObject: (...args) => { forwarded = args; } },
    SimConnectConstants: { OBJECT_ID_USER: 0 }, SimConnectPeriod: { ONCE: 1 },
    debugLog: line => logs.push(line), onPayloadSnapshot: () => { throw Error('must not apply'); }
  };
  vm.runInNewContext(code + '\nthis.read = requestPayloadSnapshot;', context);
  const promise = context.read(12, { timeoutMs: 1200, reason: 'abort-restore' });
  assert.equal(pending.size, 1);
  timeout();
  await assert.rejects(promise, /payload_read_timeout/);
  assert.equal(pending.has(forwarded[0]), false);
  assert.match(logs[0], /requestId=9300.*reason=abort-restore/);
});
