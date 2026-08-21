'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const complianceCore = require('../mission-compliance-domain-core.js');
const { createTrackerMissionComplianceVoice } = require('./tracker-mission-compliance-voice.js');

function request(type, text) {
  return {
    commandId: `effect-${type}`,
    missionId: 'apt-compliance',
    runId: 'run-compliance',
    effect: {
      effectId: `effect-${type}`,
      type,
      payload: { text, speaker: complianceCore.INSPECTOR_SPEAKER }
    }
  };
}

test('compliance voice sends the exact fixed App text through the central tracker audio lease', async () => {
  const calls = [];
  const service = {
    publicState: () => ({ configured: true }),
    request(value) {
      calls.push(value);
      return { status: 'pending' };
    },
    wait: async effectId => ({
      effectId,
      status: 'ready',
      audioAvailable: true,
      text: calls.at(-1).text,
      speaker: calls.at(-1).speaker,
      provider: 'gemini',
      model: 'tts-model',
      voiceName: 'Charon'
    }),
    waitForPlayback: async () => ({ status: 'completed', completed: true })
  };
  const handler = createTrackerMissionComplianceVoice({
    authorityManager: {
      getActiveRun: () => ({
        missionId: 'apt-compliance', runId: 'run-compliance', executionAuthority: 'tracker'
      })
    },
    voiceService: service,
    getAudioPlaybackCandidates: () => 2
  });
  const result = await handler.dispatch(request('voice.compliance_request', complianceCore.REQUEST_TEXT));
  assert.equal(result.ok, true);
  assert.equal(result.status, 'completed');
  assert.equal(result.voiceOutcome.kind, 'compliance_request');
  assert.equal(result.voiceOutcome.text, complianceCore.REQUEST_TEXT);
  assert.equal(result.voiceOutcome.playback, 'completed');
  assert.equal(calls[0].kind, 'direct');
  assert.equal(calls[0].text, complianceCore.REQUEST_TEXT);
  assert.deepEqual(calls[0].speaker, complianceCore.INSPECTOR_SPEAKER);
});

test('missing tracker voice configuration remains best effort and cannot hard-lock compliance', async () => {
  const handler = createTrackerMissionComplianceVoice({
    authorityManager: {
      getActiveRun: () => ({
        missionId: 'apt-compliance', runId: 'run-compliance', executionAuthority: 'tracker'
      })
    },
    voiceService: { publicState: () => ({ configured: false }) }
  });
  const result = await handler.dispatch(request('voice.compliance_result', 'Die Kontrolle ist abgeschlossen.'));
  assert.equal(result.ok, true);
  assert.equal(result.status, 'completed');
  assert.equal(result.voiceOutcome.status, 'warning');
  assert.equal(result.voiceOutcome.error, 'voice_not_configured');
  assert.equal(result.voiceOutcome.kind, 'compliance_result');
});
