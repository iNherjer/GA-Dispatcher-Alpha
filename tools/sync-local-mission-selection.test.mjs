import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { declaration } from './gemini-migration-harness.mjs';

// 29.10.2026: a mission picked on this device (pinboard, flight code, MSFS import)
// replaces a server-controlled cloud slot with an explicit activate; other uploads do not.
const require = createRequire(import.meta.url);
const control = require('../mission-cloud-control-core.js');
const source = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
const start = source.indexOf('// A mission the pilot deliberately picked on this device');
const block = source.slice(start, source.indexOf('function _syncMissionStatesShareIdentity(', start));

function load(now = 1_000_000) {
    const context = vm.createContext({ JSON, Date: { now: () => context.nowMs }, String, Array, Object, nowMs: now,
        window: { GAMissionCloudControlCore: control }, getSyncId: () => 'pilot' });
    vm.runInContext(declaration(source, '_syncMissionIdentityValues') + '\n' + block
        + '\n;this.api = { mark: window.gaMarkLocalMissionSelection, activation: _syncLocalSelectionActivation, clear: _syncClearLocalSelectionFor };', context);
    return context;
}
const mission = id => ({ currentMissionData: { missionId: id } });
const cloud = (status, missionId, revision = 3) => ({ missionControl: { status, missionId, revision } });
const payload = id => ({ activeMission: mission(id), activeMissionTrackerSeed: { missionId: id } });

test('pinboard choice activates over a deleted or different cloud mission', () => {
    const c = load();
    c.api.mark(mission('new-1'), 'pinboard');
    assert.deepEqual({ ...c.api.activation(cloud('deleted', null), payload('new-1')) },
        { action: 'activate', expectedMissionRevision: 3, operationId: 'pinboard:new-1:3' });
    assert.equal(c.api.activation(cloud('active', 'other'), payload('new-1')).action, 'activate');
});

test('no activation without a choice, for another mission, a matching slot, no slot or after 10 minutes', () => {
    const c = load();
    assert.equal(c.api.activation(cloud('deleted', null), payload('new-1')), null);
    c.api.mark(mission('new-1'), 'pinboard');
    assert.equal(c.api.activation(cloud('deleted', null), payload('stale-2')), null);
    assert.equal(c.api.activation(cloud('active', 'new-1'), payload('new-1')), null);
    assert.equal(c.api.activation({}, payload('new-1')), null);
    c.nowMs += 10 * 60 * 1000 + 1;
    assert.equal(c.api.activation(cloud('deleted', null), payload('new-1')), null);
});

test('a successful upload of the chosen mission ends the choice', () => {
    const c = load();
    c.api.mark(mission('new-1'), 'pinboard');
    c.api.clear(payload('other'));
    assert.ok(c.api.activation(cloud('deleted', null), payload('new-1')));
    c.api.clear(payload('new-1'));
    assert.equal(c.api.activation(cloud('deleted', null), payload('new-1')), null);
});
