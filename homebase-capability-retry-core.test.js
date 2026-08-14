'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  createCapabilityRetryGate
} = require('./homebase-capability-retry-core');

test('negative capability ACK observes the full retry window', () => {
  let now = 1000;
  const gate = createCapabilityRetryGate({ retryMs: 15000, now: () => now });

  assert.equal(gate.shouldRequest(), true);
  gate.noteRequest();
  now = 1100;
  assert.equal(gate.noteCapabilities(['homebase-preview']), false);
  assert.equal(gate.shouldRequest(), false);

  now = 15999;
  assert.equal(gate.shouldRequest(), false);
  now = 16000;
  assert.equal(gate.shouldRequest(), true);
});

test('missing ACK can be retried, but never before the retry window', () => {
  let now = 5000;
  const gate = createCapabilityRetryGate({ retryMs: 15000, now: () => now });

  gate.noteRequest();
  assert.equal(gate.snapshot().awaitingResponse, true);
  now = 19999;
  assert.equal(gate.shouldRequest(), false);
  now = 20000;
  assert.equal(gate.shouldRequest(), true);
});

test('supported capability stays enabled until the relay connection resets', () => {
  let now = 2000;
  const gate = createCapabilityRetryGate({ retryMs: 15000, now: () => now });

  gate.noteRequest();
  assert.equal(gate.noteCapabilities(['HOMEBASE-CREW-SCENE']), true);
  now += 60000;
  assert.equal(gate.isSupported(), true);
  assert.equal(gate.shouldRequest(), false);

  gate.reset();
  assert.equal(gate.isSupported(), false);
  assert.equal(gate.shouldRequest(), true);
});

test('send failure is also rate limited', () => {
  let now = 3000;
  const gate = createCapabilityRetryGate({ retryMs: 15000, now: () => now });

  gate.noteRequest();
  gate.noteSendFailed();
  assert.equal(gate.snapshot().awaitingResponse, false);
  assert.equal(gate.shouldRequest(), false);
  now += 15000;
  assert.equal(gate.shouldRequest(), true);
});

test('Homebase integration uses the gate for HIB status retries without recursive negative ACKs', () => {
  const source = fs.readFileSync(path.join(__dirname, 'homebase-integration.js'), 'utf8');

  assert.match(source, /crewCapabilityRetry\.shouldRequest\(now\)/);
  assert.match(source, /crewCapabilityRetry\.noteRequest\(now\)/);
  assert.match(source, /crewCapabilityRetry\.noteCapabilities\(ack\.capabilities, Date\.now\(\)\)/);
  assert.match(source, /if \(crewSupported\) applyCrewScene\(window\.lastLiveGpsPos, 'crew-capabilities'\)/);
  assert.match(source, /addEventListener\('gatrackercapabilitieschange', handleTrackerCapabilitiesChange\)/);
  assert.doesNotMatch(source, /crewCapabilityRequestedAt\s*=\s*0/);
});

test('periodic Crew refresh preserves the last scene signature', () => {
  const source = fs.readFileSync(path.join(__dirname, 'homebase-integration.js'), 'utf8');
  const refreshBlock = source.match(/async function refreshCrewHomebases[\s\S]*?function scheduleCrewRefresh/)?.[0] || '';

  assert.match(refreshBlock, /applyCrewScene\(window\.lastLiveGpsPos, reason\)/);
  assert.doesNotMatch(refreshBlock, /crewLastSceneSignature\s*=\s*['"]['"]/);
});
