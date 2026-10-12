import test from 'node:test';
import assert from 'node:assert/strict';
import { sandbox } from './mission-switch-diagnostic.mjs';

test('empty HTTP snapshot clears stale run, execution control and local authority without reload', async () => {
    const { c } = sandbox();
    let renders = 0;
    c._updateMissionRuntimeUi = () => { renders++; };
    c.lastTrackerMissionStatus = { missionId: 'old', runId: 'old-run', executionAuthority: 'tracker' };
    c.gaTrackerExecutionControl = c.lastTrackerMissionStatus;
    c.localAuthority = { missionId: 'old', runId: 'old-run' };
    await c._refreshTrackerExecutionControl('fresh-empty');
    assert.equal(c.lastTrackerMissionStatus, null);
    assert.equal(c.gaTrackerExecutionControl, null);
    assert.equal(c.localAuthority, null);
    assert.ok(renders > 0);
    assert.equal(await c.handleMissionStartBannerAction(), true);
});

for (const outcome of ['completed', 'aborted']) {
    test(`HTTP and relay reject resurrection of known ${outcome} run`, async () => {
        const { c } = sandbox();
        const original = c.lastTrackerMissionAuthority;
        c.gaTrackerExecutionFinalizedRunId = null;
        c.lastTrackerMissionAuthority = { activeRun: null, lastRun: { runId: 'old-run', state: outcome } };
        const delayed = { activeRun: { missionId: 'old', runId: 'old-run', executionAuthority: 'tracker' } };
        assert.equal(c._handleTrackerMissionAuthoritySnapshot(delayed), false);
        c.gaCockpitSessionClient.missionSnapshot = async () => ({ authoritySnapshot: delayed, control: delayed.activeRun });
        await c._refreshTrackerExecutionControl();
        assert.equal(c.lastTrackerMissionAuthority.activeRun, null);
        assert.equal(c.lastTrackerMissionStatus, null);
        assert.equal(c.gaTrackerExecutionControl, null);
        assert.ok(original.lastExecution);
    });
}

test('new run of the same mission and genuine foreign active run are preserved', () => {
    const { c } = sandbox();
    c.currentMissionData = { missionId: 'old' };
    const next = { missionId: 'old', runId: 'new-run', executionAuthority: 'tracker', ownerClientId: 'web-client', revision: 10 };
    assert.equal(c._handleTrackerMissionAuthoritySnapshot({ activeRun: next }), true);
    assert.equal(c.lastTrackerMissionStatus.runId, 'new-run');
    const foreign = { ...next, missionId: 'another', runId: 'foreign-run', ownerClientId: 'other-client' };
    assert.equal(c._handleTrackerMissionAuthoritySnapshot({ activeRun: foreign }), true);
    assert.equal(c.lastTrackerMissionStatus.runId, 'foreign-run');
});

test('terminal marker blocks only its own mission, not automatic binding of next mission', () => {
    const { c } = sandbox();
    c.missionAuthorityLateBindPending = true;
    assert.equal(c._missionAuthorityRuntimeNeedsLateBind(), true);
    c.currentMissionData = { missionId: 'old' };
    assert.equal(c._missionAuthorityRuntimeNeedsLateBind(), false);
});
