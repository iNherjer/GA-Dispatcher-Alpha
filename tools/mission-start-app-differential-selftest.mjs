#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import startCore from '../mission-start-core.js';

const syncSource = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');

function functionSource(name) {
  const start = syncSource.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name}`);
  const open = syncSource.indexOf(') {', start) + 2;
  let depth = 0;
  for (let index = open; index < syncSource.length; index += 1) {
    if (syncSource[index] === '{') depth += 1;
    if (syncSource[index] === '}') depth -= 1;
    if (depth === 0) return syncSource.slice(start, index + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const executable = functionSource('_missionCargoMaybePromoteStartReady');

function run(coreEnabled, facts) {
  const effects = [];
  let phase = facts.alreadyBoarded ? 'boarded' : 'boarding';
  const context = {
    window: {
      GAMissionStartCore: coreEnabled ? startCore : null,
      missionCargoStatus: { loadConfirmed: facts.loadConfirmed, error: 'old-error' },
      missionSceneStatus: { boardingVoiceComplete: facts.boardingVoiceComplete }
    },
    document: {
      getElementById: () => facts.overlayOpen ? { style: { display: 'flex' } } : null
    },
    _missionCargoEnsureManifest: () => ({ dispatchSignature: facts.dispatchSigned ? { scope: 'departure' } : null }),
    _missionCargoLoadInteractionReady: () => facts.loadInteractionReady,
    _missionStartPhase: () => phase,
    _setMissionStartPhase: next => { phase = next; effects.push(['start-phase', next]); },
    _setMissionRuntimePhase: (next, options) => effects.push(['runtime-phase', next, options]),
    _updateMissionRuntimeUi: () => effects.push(['ui']),
    _missionCargoRenderDialog: (mode, options) => effects.push(['render', mode, options]),
    console
  };
  context.window.window = context.window;
  vm.runInNewContext(executable, context, { filename: 'sync.js#_missionCargoMaybePromoteStartReady' });
  const result = context._missionCargoMaybePromoteStartReady('differential');
  return JSON.parse(JSON.stringify({ result, phase, status: context.window.missionCargoStatus, effects }));
}

const scenarios = [
  { loadConfirmed: false, dispatchSigned: false, loadInteractionReady: false, boardingVoiceComplete: false },
  { loadConfirmed: true, dispatchSigned: false, loadInteractionReady: true, boardingVoiceComplete: true },
  { loadConfirmed: true, dispatchSigned: true, loadInteractionReady: false, boardingVoiceComplete: true },
  { loadConfirmed: true, dispatchSigned: true, loadInteractionReady: true, boardingVoiceComplete: false },
  { loadConfirmed: true, dispatchSigned: true, loadInteractionReady: true, boardingVoiceComplete: true },
  { loadConfirmed: true, dispatchSigned: true, loadInteractionReady: true, boardingVoiceComplete: true, overlayOpen: true },
  { loadConfirmed: true, dispatchSigned: true, loadInteractionReady: true, boardingVoiceComplete: true, alreadyBoarded: true }
];

for (const facts of scenarios) {
  assert.deepEqual(run(true, facts), run(false, facts), `shared start policy drifted: ${JSON.stringify(facts)}`);
}

console.log('mission start/app differential selftest: ok');
