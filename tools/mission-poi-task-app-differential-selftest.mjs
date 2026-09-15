import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import core from '../mission-poi-task-core.js';

const legacy = fs.readFileSync(new URL('./fixtures/poi-legacy-20260915.js', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../passenger-voice.js', import.meta.url), 'utf8');
const adapter = source.slice(source.indexOf('function _poiRequiredTaskItemState('), source.indexOf('\nfunction _aptMissingRequiredCargoItems'))
    + source.slice(source.indexOf('function _poiTaskDetectorState('), source.indexOf('// ─── BOOT'));
assert.ok(adapter.includes('GAMissionPoiTaskCore.observe'));
const fields = {
    inRadius: '_poiInRadius', enteredAt: '_poiEnteredAt', lastTickTime: '_poiLastTickTime',
    dwellSec: '_poiDwellSec', attempts: '_poiAttempts', lastComplaintAt: '_poiLastComplaintAt',
    altWasOk: '_poiAltWasOk', satisfied: '_poiSatisfied', aborted: '_poiAborted',
    manualConfirmed: '_poiManuallyConfirmed', entryDone: '_poiEntryDone',
    sightCallDone: '_poiSightCallDone', atTargetDone: '_paxAtTargetDone'
};
const json = value => JSON.parse(JSON.stringify(value));
function harness(modern, config) {
    const events = [];
    let now = 100000;
    const context = { window: {}, currentMissionData: { ...(config.chain ? { poiChain: {} } : {}) }, Math, Number, Date: { now: () => now } };
    const state = () => Object.fromEntries(Object.entries(fields).map(([key, name]) => [key, context[name]]));
    const record = (...event) => events.push(json({ event, state: state() }));
    Object.entries(fields).forEach(([key, name]) => context[name] = core.createState()[key]);
    Object.assign(context, {
        _activeAptTrainingPlan: () => config.training ? {} : null,
        _getDestCoords: () => config.noTarget ? null : { lat: 0, lon: 0 },
        _activeTaskDomain: () => config.domain,
        _paxStrictMode: config.strict,
        _poiRequiredTaskItemState: () => config.items || { blockingItems: [], reason: 'missing' },
        _handlePoiChainEvents: events => record('chain-events', events),
        _handleSurveyPatternEvents: events => record('survey-events', events),
        _poiChainActiveSpec: () => config.chain?.spec || null,
        _refreshPaxWidgetVisibility: () => record('refresh-widget'),
        _surveyPatternActiveSpec: () => config.surveySpec || null,
        _tickFireMissionSearch: () => config.fire === true,
        _paxLog: (text, level) => record('log', text, level),
        _paxMissionTimeout: (fn, delay) => { record('delay', delay); fn(); },
        _speakAndShow: (prompt, label) => record('speak', prompt, label)
    });
    context.window = {
        GAMissionPoiTaskCore: core,
        missionPoiChainRuntime: { tick: () => config.chain || null },
        missionSurveyPattern: { tick: () => config.survey || null },
        activePassenger: { targetRadiusNm: config.radius ?? 1.5, targetAltFt: config.targetAlt ?? 3000, targetDwellMin: config.dwell ?? 2 },
        lastLiveGpsPos: {},
        missionPersistRuntimeSnapshot: (reason, options) => record('persist', reason, options),
        missionCargoEvaluateOutcome: () => ({
            [config.items?.reason === 'damaged' ? 'damagedRequired'
                : config.items?.reason === 'dropped' ? 'droppedRequired' : 'missingRequired']: config.items?.blockingItems || []
        }),
        missionIsSarHeliMission: () => config.sarHeli === true,
        missionSarHeliHandlePoiTick: input => record('sar', input)
    };
    for (const name of ['_poiInSightPrompt', '_poiEntryPrompt', '_poiMissingCargoAbortPrompt',
        '_poiAltCorrectedPrompt', '_poiSatisfiedPrompt', '_poiAltComplaintPrompt', '_poiAbortPrompt']) {
        context[name] = (...args) => { record('prompt', name, args); return config.noPrompt ? null : name; };
    }
    vm.createContext(context);
    vm.runInContext(legacy + (modern ? '\n' + adapter : ''), context);
    return {
        tick(frame) {
            now += frame.dt ?? 1000;
            const fd = { mslFt: frame.alt ?? 3000, gsKts: frame.gs ?? 95, hdg: frame.hdg ?? 270 };
            // Mirror the actual caller's terminal guard. Special modules remain app-owned.
            if (!context._poiSatisfied && !context._poiAborted) context._tickPoiDwell(0, frame.lon, fd);
            return json({ state: state(), events });
        }
    };
}

const tapes = [
    [{ lon: .08 }, { lon: .04 }, ...Array.from({ length: 150 }, () => ({ lon: .01 }))],
    [200, 200.001, 300, 300.001, 600, 600.001, -200, -200.001, -300, -300.001, -600, -600.001]
        .flatMap(delta => [{ lon: .1 }, { lon: .001, alt: 3000 + delta },
            { lon: .001, alt: 3000 + delta, dt: 15000, gs: 0, hdg: 0 }]),
    [{ lon: .01 }, { lon: .1, dt: 30000 }, { lon: .01, dt: 30000 }, { lon: 0, dt: 20000 }],
    Array.from({ length: 10 }, () => ({ lon: .01, alt: 3900, dt: 46000 })),
    [{ lon: .01, alt: 3900 }, { lon: .01, alt: 3900, dt: 46000 }, { lon: .01, alt: 3000 }],
    Array.from({ length: 70 }, (_, i) => ({ lon: i % 7 === 0 ? .07 : .005, alt: 3000 + (i % 5) * 200, dt: i % 4 ? 500 : 7000 }))
];
let comparisons = 0;
for (const domain of ['media_photo', 'inspection_infra', 'search_and_rescue', 'mapping_survey', 'infra_chain_recon', 'science_bio']) {
    for (const strict of [false, true]) for (const dwell of [0, 2]) for (const tape of tapes) {
        const config = { domain, strict, dwell };
        const old = harness(false, config), migrated = harness(true, config);
        for (const frame of tape) {
            assert.deepEqual(migrated.tick(frame), old.tick(frame), `${domain}/${strict}/${dwell}`);
            comparisons++;
        }
    }
}
for (const extra of [
    { noPrompt: true }, { noTarget: true }, { training: true }, { fire: true, domain: 'fire_watch' },
    { sarHeli: true }, { targetAlt: 0 }, { radius: 0 },
    { items: { blockingItems: ['Kamera'], reason: 'damaged' } },
    { items: { blockingItems: ['Messgerät'], reason: 'dropped' } },
    { chain: { handled: true, progress: { startedAt: 1000 } } },
    { chain: { handled: true, satisfied: true, progress: { startedAt: 1000, updatedAt: 2000 } } },
    { domain: 'mapping_survey', survey: { handled: true, satisfied: true, progress: { startedAt: 1000, updatedAt: 2000 } } },
    { domain: 'mapping_survey', survey: { handled: true, progress: { startedAt: 1000 } } },
    { domain: 'mapping_survey', surveySpec: { type: 'orbit', orbit: { radiusNm: 3, radialToleranceNm: .2 } } }
]) {
    const config = { domain: 'media_photo', strict: false, ...extra };
    const old = harness(false, config), migrated = harness(true, config);
    for (const tape of tapes) for (const frame of tape) {
        assert.deepEqual(migrated.tick(frame), old.tick(frame), JSON.stringify(config));
        comparisons++;
    }
}
console.log(`PASS: ${comparisons} original/app POI comparisons: state, persistence, logs, prompt arguments and delays.`);
