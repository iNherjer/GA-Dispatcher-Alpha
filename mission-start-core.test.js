'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const core = require('./mission-start-core.js');

test('departure confirmation preserves App check ordering', () => {
  assert.equal(core.deriveDepartureConfirmationGate({ freeflightOnly: true }).reason, 'freeflight_only');
  assert.equal(core.deriveDepartureConfirmationGate({ requiredMissingCount: 1 }).reason, 'departure_manifest_incomplete');
  assert.equal(core.deriveDepartureConfirmationGate({ signatureMatches: false }).reason, 'departure_signature_missing');
  assert.equal(core.deriveDepartureConfirmationGate({ signatureMatches: true, signatureAnimating: true }).reason, 'signature_animation_running');
  assert.equal(core.deriveDepartureConfirmationGate({ signatureMatches: true, payloadFinalizeRunning: true }).reason, 'payload_finalize_running');
  assert.equal(core.deriveDepartureConfirmationGate({ signatureMatches: true }).ok, true);
});

test('payload completion preserves connected manual override behavior', () => {
  assert.deepEqual(core.derivePayloadCompletion({ payloadNeedsSync: true, liveTrackerConnected: false }), {
    ok: false,
    reason: 'tracker_disconnected_during_payload_check',
    startOverride: false
  });
  assert.equal(core.derivePayloadCompletion({ payloadNeedsSync: true, liveTrackerConnected: true }).startOverride, true);
  assert.equal(core.derivePayloadCompletion({ simModeActive: true, payloadNeedsSync: true }).ok, true);
});

test('start readiness and boarding ACK plan keep scene, voice and payload independent', () => {
  assert.deepEqual(core.deriveBoardingAckPlan({ sceneConfirmed: false, hasBoardingPassenger: true }), {
    action: 'await_scene', complete: false
  });
  assert.equal(core.deriveBoardingAckPlan({ sceneConfirmed: true, hasBoardingPassenger: true }).action, 'play_boarding_voice');
  assert.equal(core.deriveBoardingAckPlan({ sceneConfirmed: true, hasBoardingVoiceContext: true }).action, 'play_boarding_voice');
  assert.equal(core.deriveBoardingAckPlan({ sceneConfirmed: true, hasBoardingPassenger: false }).complete, true);
  assert.equal(core.deriveStartReadiness({
    loadConfirmed: true,
    dispatchSigned: true,
    loadInteractionReady: true,
    boardingVoiceComplete: true
  }).ready, true);
  assert.deepEqual(core.deriveStartReadiness({
    loadConfirmed: true,
    dispatchSigned: true,
    loadInteractionReady: true,
    boardingVoiceComplete: false
  }).missing, ['boarding_voice_not_complete']);
});

test('browser and Node expose byte-equivalent start policy decisions', () => {
  const source = fs.readFileSync(path.join(__dirname, 'mission-start-core.js'), 'utf8');
  const context = vm.createContext({});
  vm.runInContext(source, context, { filename: 'mission-start-core.js' });
  assert.ok(context.GAMissionStartCore);
  const facts = {
    loadConfirmed: true,
    dispatchSigned: true,
    loadInteractionReady: true,
    boardingVoiceComplete: false
  };
  const browser = context.GAMissionStartCore.deriveStartReadiness(facts);
  const node = core.deriveStartReadiness(facts);
  assert.deepEqual(JSON.parse(JSON.stringify(browser)), node);
});
