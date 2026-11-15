// Web mission panel: tracker-run missions show the tracker's pax comfort and cargo
// condition (same as the EFB); without tracker authority the local values stay.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const sync = fs.readFileSync(require.resolve('../sync.js'), 'utf8');
const checklists = fs.readFileSync(require.resolve('../checklists.js'), 'utf8');

function slice(source, start, end) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, `missing block ${start}`);
    return source.slice(from, to);
}
const syncBlock = slice(sync, 'const _trackerLiveCondition = {', '\n// Outside the simulator mode missions run only under tracker authority.');
const panelBlock = slice(checklists, '    function missionTrackerLiveCondition() {', '\n    function missionSurveySpec');

function harness({ tracker = true, control = null, snapshot = null, comfort = null, outcome = null } = {}) {
    const calls = [];
    const window = {
        gaTrackerExecutionControl: control,
        gaCockpitSessionClient: { missionSnapshot: async () => { calls.push(Date.now()); return snapshot; } },
        paxVoiceGetComfortSummary: () => comfort,
        missionCargoEvaluateOutcome: () => outcome
    };
    const context = vm.createContext({ window, Date, Promise, Number, Array, Set, Object, String,
        _missionExecutionAuthorityIsTracker: () => tracker, _missionExecutionControlSnapshot: () => null });
    vm.runInContext(`${syncBlock}\n${panelBlock}\nthis.api = { missionComfortSummary, missionCargoOutcome };`, context);
    return { api: context.api, calls, window };
}

test('without tracker authority the local legacy values stay', () => {
    const { api, calls } = harness({ tracker: false, comfort: { comfortScore: 100 }, outcome: { status: 'ok', conditionPct: 100 } });
    assert.equal(api.missionComfortSummary().comfortScore, 100);
    assert.equal(api.missionCargoOutcome().conditionPct, 100);
    assert.equal(calls.length, 0);
});

test('tracker-run mission shows the tracker values and polls the local tracker at most every 5 s', async () => {
    const control = { executionAuthority: 'tracker', runId: 'run-1', receivedAt: 1,
        comfort: { comfortScore: 91, mood: 'zufrieden', pilotEvents: 1, pilotSevere: 0, weatherEvents: 0 },
        cargoLive: { conditionPct: 98, requiredBroken: [] } };
    const snapshot = { control: { ...control, comfort: { ...control.comfort, comfortScore: 82 },
        cargoLive: { conditionPct: 30, requiredBroken: ['Ersatzteilkiste'] } }, view: { cargo: { conditionPct: 30 } } };
    const { api, calls } = harness({ control, snapshot, comfort: { comfortScore: 100 },
        outcome: { status: 'ok', conditionPct: 100, damagedRequired: [] } });
    // Before the first poll answers: the last control received from the tracker.
    assert.equal(api.missionComfortSummary().comfortScore, 91);
    assert.equal(api.missionCargoOutcome().conditionPct, 98);
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(calls.length, 1);
    assert.equal(api.missionComfortSummary().comfortScore, 82);
    const cargo = api.missionCargoOutcome();
    assert.equal(cargo.conditionPct, 30);
    assert.equal(JSON.stringify(cargo.damagedRequired), '["Ersatzteilkiste"]');
    api.missionComfortSummary();
    assert.equal(calls.length, 1, 'no second request within 5 s');
});

test('a snapshot of another run is ignored; no tracker comfort means no local fallback', async () => {
    const control = { executionAuthority: 'tracker', runId: 'run-2', receivedAt: 1, comfort: null, cargoLive: null };
    const { api } = harness({ control, snapshot: { control: { executionAuthority: 'tracker', runId: 'old-run', comfort: { comfortScore: 10 } } },
        comfort: { comfortScore: 100 }, outcome: null });
    assert.equal(api.missionComfortSummary(), null);
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(api.missionComfortSummary(), null);
    assert.equal(api.missionCargoOutcome(), null);
});
