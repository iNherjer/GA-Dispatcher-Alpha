'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
test('App relay rejects oversized full command with a correlated error; normal commands stay intact', () => {
  const source = read('../sync.js');
  const start = source.indexOf('    const serializedCommand = JSON.stringify(payload);');
  const end = source.indexOf('    _trackerPendingMarkSent', start);
  let sent = [], ack;
  const ctx = { TextEncoder, payload: { resumeBundle: { evidence: 'ä'.repeat(300000) } },
    missionAuthorityLastSnapshotHash: '', missionAuthorityProtocol: false, window: {}, commandId: 'request', missionAuthorityAckWaiters: new Map([['request', { timer: 1, resolve: value => { ack = value; } }]]),
    clearTimeout() {}, console: { warn() {} }, ws: { send: value => sent.push(value) } };
  vm.createContext(ctx);
  vm.runInContext('(function(){' + source.slice(start, end) + '})()', ctx);
  assert.equal(sent.length, 0); assert.equal(ack.error, 'mission_relay_payload_too_large');
  assert.equal(ack.commandId, 'request');
  ctx.payload = { resumeBundle: { missionTruth: { value: 'vollständig' } } };
  vm.runInContext('(function(){' + source.slice(start, end) + '})()', ctx);
  assert.deepEqual(JSON.parse(sent[0]), ctx.payload);
  assert.ok(source.includes('_missionAuthorityInjectLiveRoute(_safeCloneJson(missionState, null))'));
});
test('Tracker returns a small explicit error for oversized snapshots instead of breaking relay connection', () => {
  const source = read('tracker.js'), start = source.indexOf('      let wire = JSON.stringify(msg);');
  const end = source.indexOf('      ws.send(wire);', start) + '      ws.send(wire);'.length;
  let sent;
  const ctx = { Buffer, Date, msg: { type: 'gps', trackerAck: { resumeBundle: { x: 'x'.repeat(600000) } } },
    ackPayload: { type: 'mission_snapshot_ack', commandId: 'snapshot', missionId: 'test' }, debugLog() {}, ws: { send: value => { sent = value; } } };
  vm.createContext(ctx); vm.runInContext('(function(){' + source.slice(start, end) + '})()', ctx);
  assert.ok(Buffer.byteLength(sent) < 512 * 1024);
  assert.equal(JSON.parse(sent).trackerAck.commandId, 'snapshot');
  assert.equal(JSON.parse(sent).trackerAck.error, 'mission_relay_payload_too_large');
});
test('start banner displays failed intent directly, and restores normal text after success', () => {
  const source = read('tracker-efb-kartentisch-host.js');
  const start = source.indexOf('  function renderMissionActionBanner('), end = source.indexOf('  function updateMissionLiveFields', start);
  const text = {};
  const ctx = { setupMissionActionBanner: () => ({ classList: { remove() {}, add() {} }, style: {}, setAttribute() {} }),
    missionActionBannerModel: () => ({ key: 'mission', text: 'Normal', kicker: 'Start', button: 'Beginnen' }),
    missionBannerDismissedKey: '', missionIntentTone: 'danger', missionIntentStatus: 'Paket zu gross', missionIntentPending: false,
    setText: (id, value) => { text[id] = value; }, byId: () => null };
  vm.createContext(ctx); vm.runInContext(source.slice(start, end), ctx);
  ctx.renderMissionActionBanner({}); assert.equal(text.missionStartBannerText, 'Paket zu gross');
  ctx.missionIntentTone = 'good'; ctx.renderMissionActionBanner({}); assert.equal(text.missionStartBannerText, 'Normal');
});

test('actual App send path negotiates chunk transfer and keeps complete payload', () => {
  const source = read('../sync.js');
  const start = source.indexOf('    if (missionAuthorityProtocol && window.GAMissionTransfer) {');
  const end = source.indexOf('    _trackerPendingMarkSent', start);
  let queued;
  const payload = { trackerCommand: { type: 'mission_snapshot_update', commandId: 'large', resumeBundle: { value: 'ä'.repeat(400000) } } };
  const ctx = { TextEncoder, payload, trackerCommand: payload.trackerCommand, missionAuthorityProtocol: true,
    window: { GAMissionTransfer: {}, liveTrackerCapabilities: ['mission.transfer.v1'] }, _missionRelayPeerId: () => 'phone',
    _missionRelayTransport: () => ({ enqueue: (value, peer) => { queued = { value, peer }; return true; } }), commandId: 'large',
    ws: { send: () => assert.fail('oversized direct frame') } };
  vm.createContext(ctx);
  assert.equal(vm.runInContext('(function(){' + source.slice(start, end) + '})()', ctx), 'large');
  assert.equal(queued.value, payload); assert.equal(queued.peer, 'phone');
  assert.equal(payload.trackerCommand.missionTransferPeer, 'phone');
});
test('actual Tracker ACK path uses negotiated transfer without reducing resume bundle', () => {
  const source = read('tracker.js'), start = source.indexOf('      let wire = JSON.stringify(msg);');
  const end = source.indexOf('      ws.send(wire);', start) + '      ws.send(wire);'.length;
  const msg = { trackerAck: { missionTransferPeer: 'phone', resumeBundle: { value: 'x'.repeat(600000) } } };
  let queued;
  const ctx = { Buffer, msg, ackPayload: msg.trackerAck,
    missionTransfer: { enqueue: (value, peer) => { queued = { value, peer }; return true; } },
    ws: { send: () => assert.fail('oversized direct ACK') } };
  vm.createContext(ctx); vm.runInContext('(function(){' + source.slice(start, end) + '})()', ctx);
  assert.equal(queued.value, msg); assert.equal(queued.peer, 'phone');
  assert.equal(msg.trackerAck.resumeBundle.value.length, 600000);
});
