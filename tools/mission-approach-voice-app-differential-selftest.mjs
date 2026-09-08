#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import approachCore from '../ga-tracker-client/tracker-mission-approach-voice.js';
const passengerSource = fs.readFileSync(new URL('../passenger-voice.js', import.meta.url), 'utf8');
function blockSource(marker) {
    const start = passengerSource.indexOf(marker);
    assert.ok(start >= 0, `missing ${marker}`);
    const open = passengerSource.indexOf('{', start);
    let depth = 0;
    let quote = '';
    let escaped = false;
    for (let index = open; index < passengerSource.length; index += 1) {
        const char = passengerSource[index];
        if (escaped) { escaped = false; continue; }
        if (char === '\\') { escaped = true; continue; }
        if (quote) {
            if (char === quote) quote = '';
            continue;
        }
        if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                const suffix = marker.startsWith('window.') ? ';' : '';
                return passengerSource.slice(start, index + 1) + suffix;
            }
        }
    }
    throw new Error(`unterminated ${marker}`);
}


for (const flightData of [{}, { bankDeg: -37, gForce: 1.7 }, { windKts: 23, windDeg: 240, windGustKts: 29, tempC: 17, visKm: 5, inCloud: true, turbulencePct: 65 }, { windKts: 30, windDeg: 180, visKm: 3 }]) {
  const context = { supported: true, mode: 'passenger', baseContext: 'EXAKTER APP KONTEXT',
    dest: 'EDTL', passenger: { gTolerance: 'niedrig', bankTolerance: 'niedrig' },
    aptArrivalApproachHint: ' ANKUNFT', inspectionLiveHint: '', professionalProgressHint: ' AUFTRAG',
    bushContinuityHint: '', driftGuard: ' DOMAIN', toneHint: ' TON',
    briefingWeather: { windKts: 3, windDeg: 10, visKm: 25 } };
  const sandbox = { window: { activePassenger: context.passenger }, currentMissionData: { dest: context.dest },
    _baseContext: () => context.baseContext, _isPOIMission: () => false, _activeAptTrainingPlan: () => null,
    _aptArrivalApproachHint: () => context.aptArrivalApproachHint, _inspectionMissionMeta: () => null,
    _professionalTaskHint: () => context.professionalProgressHint, _domainDriftGuard: () => context.driftGuard,
    _bushPickupNarrativeHint: () => '', _toneHint: () => context.toneHint,
    _paxWxMismatchDone: false, _briefingDestWeather: () => context.briefingWeather, flightData };
  vm.createContext(sandbox);
  vm.runInContext([blockSource('function _weatherContext('), blockSource('function _consumeWeatherMismatchEasteregg('),
    blockSource('function _atTargetPrompt(')].join('\n'), sandbox);
  const actualAppPrompt = vm.runInContext('_atTargetPrompt(flightData)', sandbox);
  assert.equal(approachCore.buildApproachPrompt(context, flightData), actualAppPrompt);
}
assert.equal(approachCore.buildApproachPrompt({ supported: false }), null);
console.log('PASS: tracker APT approach prompt matches unchanged standalone function (4 scenarios).');

// Compare actual standalone trigger guards, not just the generated prose.
const executionCore = (await import('../mission-execution-core.js')).default;
for (const phase of ['active', 'enroute', 'end_unloading', 'closing']) {
  for (const onGround of [true, false]) for (const ending of [false, true]) {
    let scheduled = 0;
    const runtime = { active: true, phase, waitingFarewellDeboarding: ending };
    const sandbox = {
      window: { activePassenger: {} }, missionRuntime: runtime,
      _paxVoiceEnabled: true, _paxAtTargetDone: false, _paxFarewellDone: false,
      _paxLandingPhaseAnnounced: false, _paxLog() {}, _missionHasPax: () => true,
      _bushPickupArrivalVoiceBlockedAtPickupStrip: () => false,
      _activeAptTrainingPlan: () => null, _atTargetPrompt: () => 'Approach',
      _isPOIMission: () => false, _activeAptArrivalPlan: () => null,
      _paxMissionTimeout(callback, delay) { assert.equal(delay, 2000); scheduled++; },
      flightData: { onGround }
    };
    vm.createContext(sandbox);
    vm.runInContext(blockSource('function _paxMissionEndVoiceActive(') + '\n' + blockSource('window.triggerPaxAtTarget ='), sandbox);
    await vm.runInContext('window.triggerPaxAtTarget(flightData)', sandbox);
    const state = executionCore.normalizeState({ missionId: 'm', runId: 'r', phase,
      flags: { active: true, onGround, farewellStarted: ending }, manifest: { items: [] } });
    const result = executionCore.reduce(state, { type: 'APT_APPROACH_VOICE_REQUESTED',
      missionId: 'm', runId: 'r', eventId: 'approach', occurredAt: 10000, payload: {} });
    assert.equal(result.effects.some(effect => effect.type === 'voice.approach'), scheduled === 1,
      `${phase}, ground=${onGround}, ending=${ending}`);
  }
}
console.log('PASS: approach guards match standalone in 16 ground/phase/end combinations.');
