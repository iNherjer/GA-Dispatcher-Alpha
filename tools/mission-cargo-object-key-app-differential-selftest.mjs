#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../mission-execution-core.js';
import simulator from '../ga-tracker-client/tracker-mission-simulator-effects.js';
const source = fs.readFileSync(new URL('../mission-cargo-core.js', import.meta.url), 'utf8');
const between = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
const app = { window: {} };
vm.createContext(app);
vm.runInContext(between('function _missionCargoAircraftSlot(', 'function _missionCargoCalendarDayNumber(')
  + between('function _missionCargoStableObjectKey(', 'function _missionCargoLivePos('), app);
let count = 0;
for (const aircraftSlot of ['PA-24', ' c172 g1000 ', '---', 'DA_62.1', 'X'.repeat(60), undefined]) {
  for (const persistentEquipment of [true, false]) for (const action of ['load', 'unload']) {
    const manifest = { key: 'Mission / Ä Test', aircraftSlot,
      items: [{ id: 'First Aid:1', itemType: 'cargo', persistentEquipment, status: action === 'load' ? 'loaded' : 'unloaded' }] };
    const state = core.reduce(core.normalizeState({ missionId: 'm', runId: 'r', manifest }), {
      type: 'CARGO_STATE_CHANGED', eventId: 'cargo', occurredAt: 1234,
      payload: { manifest, payloadTransition: { itemId: manifest.items[0].id, action } }
    });
    const effect = state.effects.find(effect => effect.type === 'scene.cargo_item_transition');
    const commands = [];
    const bridge = simulator.createTrackerMissionSimulatorEffects({
      authorityManager: { getActiveRun: () => ({ missionId: 'm', runId: 'r', executionAuthority: 'tracker',
        resumeBundle: { executionEffectPlan: { schema: simulator.EFFECT_PLAN_SCHEMA, recipe: 'apt', sceneId: 'scene-m', effects: {} } } }) },
      getLivePosition: () => ({ lat: 48, lon: 8, alt: 500, hdg: 90 }),
      dispatchCommand: command => { commands.push(command); return { ok: true, status: 'completed' }; }
    });
    const result = await bridge.dispatch({ missionId: 'm', runId: 'r', commandId: effect.effectId, effect });
    assert.equal(result.ok, true);
    await new Promise(resolve => setTimeout(resolve, 190));
    const expected = app._missionCargoStableObjectKey(manifest.items[0], manifest);
    assert.equal(commands[0].objectKey, expected);
    if (action === 'load') assert.deepEqual(commands[0].objectKeys, [expected]);
    else assert.equal(commands[0].items[0].objectKey, expected);
    count++;
  }
}
console.log(`PASS ${count} cargo object identities match unchanged standalone through core and simulator bridge.`);
