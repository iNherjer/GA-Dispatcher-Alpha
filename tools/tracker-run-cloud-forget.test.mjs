import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { declaration } from './gemini-migration-harness.mjs';

// 29.10.2026: a remembered tracker run ("Mission läuft noch") ends with a cloud
// clear or a later activation, also when no tracker is running on this device.
const source = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
function load(run, liveRunId = null) {
    const context = vm.createContext({ Number, window: { gaTrackerExecutionRun: run, gaTrackerExecutionControl: liveRunId ? { runId: liveRunId } : null },
        forgotten: 0, banner: 0 });
    vm.runInContext(`function _rememberedTrackerExecutionRun() {}
        function _forgetTrackerExecutionRun() { forgotten++; window.gaTrackerExecutionRun = null; }
        function _missionPhaseDebugPush() {}
        function _updateMissionStartBanner() { banner++; }
        ${declaration(source, '_syncForgetTrackerRunReplacedInCloud')}
        this.forget = _syncForgetTrackerRunReplacedInCloud;`, context);
    return context;
}
const run = { missionId: 'm1', runId: 'r1', at: 1_000_000_000 };

test('a clear or an activation well after the remembered run forgets it', () => {
    let c = load({ ...run });
    assert.equal(c.forget({ status: 'deleted', updatedAt: 1, revision: 4 }), true);
    assert.equal(c.forgotten, 1); assert.equal(c.banner, 1);
    c = load({ ...run });
    assert.equal(c.forget({ status: 'active', updatedAt: run.at + 6 * 60 * 1000, revision: 5 }), true);
});

test('the activation that started the run, clock skew and a live run keep it', () => {
    let c = load({ ...run });
    assert.equal(c.forget({ status: 'active', updatedAt: run.at - 60 * 1000, revision: 3 }), false);
    assert.equal(c.forget({ status: 'active', updatedAt: run.at + 4 * 60 * 1000, revision: 3 }), false);
    assert.equal(c.forget(null), false);
    c = load({ ...run }, 'r1');
    assert.equal(c.forget({ status: 'deleted', updatedAt: 1, revision: 4 }), false);
    assert.equal(c.forgotten, 0);
});
