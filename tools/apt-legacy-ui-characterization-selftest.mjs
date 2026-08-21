#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import aptUiCore from '../mission-apt-ui-core.js';

const syncSource = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');

function functionSource(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `missing function ${name}`);
    const open = source.indexOf(') {', start) + 2;
    assert.ok(open > start, `missing function body ${name}`);
    let depth = 0;
    for (let index = open; index < source.length; index += 1) {
        if (source[index] === '{') depth += 1;
        if (source[index] === '}') depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`unterminated function ${name}`);
}

function element() {
    return {
        textContent: '',
        disabled: false,
        style: { display: '' }
    };
}

let elements = null;
const state = {
    phase: 'planned',
    groundReady: true,
    endReady: { ready: false, reason: 'not_at_target', dMissionNm: 12, dArrivalNm: null },
    groundAction: null,
    deboardingBusy: false
};

function resetElements() {
    const classes = new Map();
    const close = element();
    const banner = {
        ...element(),
        classList: {
            toggle(name, enabled) {
                classes.set(name, enabled === true);
            }
        },
        querySelector(selector) {
            return selector === '.mission-start-banner-close' ? close : null;
        }
    };
    elements = {
        missionStartBanner: banner,
        missionStartBannerKicker: element(),
        missionStartBannerText: element(),
        missionStartBannerBtn: element(),
        close,
        classes
    };
}

const context = {
    window: {
        liveTrackerConnected: true,
        simModeActive: false,
        gaTrackerExecutionControl: null,
        missionRuntimeResumeConflict: null,
        missionSceneStatus: {},
        missionComplianceGetCargoUiState: () => null
    },
    missionRuntime: {
        active: false,
        phase: 'planned',
        closingPending: false,
        closingOutcome: null
    },
    document: {
        getElementById(id) {
            return elements?.[id] || null;
        }
    },
    _hasValidMissionForStart: () => true,
    _missionStartGroundReady: () => state.groundReady,
    _missionStartBannerDismissed: () => false,
    _missionStartPhase: () => state.phase,
    _missionEndReadiness: () => state.endReady,
    _missionPoiGroundEndReady: () => false,
    _missionBushGroundEndReady: () => false,
    _missionRuntimeGroundEndReady: () => state.groundAction?.endReady === true,
    _missionEndDeboardingBusy: () => state.deboardingBusy,
    _missionResolveGroundAction: () => state.groundAction,
    _missionRuntimePhaseSnapshot: () => state.phase,
    _missionBushIsPickupMission: () => false,
    _activeBushMissionSpec: () => null,
    _missionCloseOutcomeSummaryText: () => 'Mission erfolgreich abgeschlossen.',
    _missionPoiEndedAtHome: () => false,
    _missionBushEndReadyText: () => 'Bush-Ziel erreicht.',
    _missionSceneBlockReasonBannerText: reason => `Blockiert: ${reason}`,
    _missionLooksLikeFireWatch: () => false,
    _renderTrackerMissionBanner: () => {
        throw new Error('legacy characterization must not enter tracker presentation');
    },
    Number,
    String
};

vm.runInNewContext(
    `let missionStartBoardingPromise = null;\n${functionSource(syncSource, '_updateMissionStartBanner')}`,
    context,
    { filename: 'sync.js#_updateMissionStartBanner' }
);

function render(overrides = {}) {
    resetElements();
    Object.assign(state, {
        phase: 'planned',
        groundReady: true,
        endReady: { ready: false, reason: 'not_at_target', dMissionNm: 12, dArrivalNm: null },
        groundAction: null,
        deboardingBusy: false
    }, overrides.state || {});
    Object.assign(context.missionRuntime, {
        active: false,
        phase: state.phase,
        closingPending: false,
        closingOutcome: null
    }, overrides.runtime || {});
    context.window.missionSceneStatus = { ...(overrides.scene || {}) };
    context._updateMissionStartBanner();
    return {
        visible: elements.missionStartBanner.style.display === 'flex',
        kicker: elements.missionStartBannerKicker.textContent,
        text: elements.missionStartBannerText.textContent,
        button: elements.missionStartBannerBtn.textContent,
        disabled: elements.missionStartBannerBtn.disabled,
        closeDisplay: elements.close.style.display,
        begin: elements.classes.get('is-begin-action') === true,
        endReady: elements.classes.get('is-end-ready') === true,
        final: elements.classes.get('is-final-action') === true
    };
}

assert.deepEqual(render(), {
    visible: true,
    kicker: 'Mission bereit',
    text: 'Mission ist geplant. Mit "Mission starten" wird erst dann Szene, Boarding und Verladen freigegeben.',
    button: 'Mission starten',
    disabled: false,
    closeDisplay: '',
    begin: true,
    endReady: false,
    final: false
}, 'planned APT banner drifted');

assert.deepEqual(render({ state: { phase: 'prepare' } }), {
    visible: true,
    kicker: 'Mission bereit',
    text: 'Missionstart freigegeben. Mit dem nächsten Klick beginnt Boarding und Verladen.',
    button: 'Boarding und Verladen beginnen',
    disabled: false,
    closeDisplay: '',
    begin: false,
    endReady: false,
    final: false
}, 'prepared APT banner drifted');

assert.deepEqual(render({
    state: { phase: 'boarding' },
    scene: { boardingPreparing: true }
}), {
    visible: true,
    kicker: 'Mission bereit',
    text: 'Missionstart angefordert. Szene, Boarding und Verladen werden vorbereitet.',
    button: 'Bitte warten...',
    disabled: true,
    closeDisplay: '',
    begin: false,
    endReady: false,
    final: false
}, 'busy boarding APT banner drifted');

assert.deepEqual(render({
    state: { phase: 'boarding' },
    scene: { boardingComplete: true, boardingVoiceComplete: true }
}), {
    visible: true,
    kicker: 'Mission bereit',
    text: 'Boarding und Ansage sind abgeschlossen. Die Verladung im Ladefenster noch bestätigen.',
    button: 'Verladefenster öffnen',
    disabled: false,
    closeDisplay: '',
    begin: false,
    endReady: false,
    final: false
}, 'boarding-complete APT banner drifted');

assert.deepEqual(render({ state: { phase: 'boarded' } }), {
    visible: true,
    kicker: 'Mission bereit',
    text: 'Boarding abgeschlossen. Wenn du die Ladung sicher verstaut hast, kann es losgehen.',
    button: 'Mission starten',
    disabled: false,
    closeDisplay: '',
    begin: false,
    endReady: false,
    final: false
}, 'boarded APT banner drifted');

assert.equal(render({
    state: { phase: 'enroute' },
    runtime: { active: true, phase: 'active' }
}).visible, false, 'normal APT enroute must not show an action banner');

assert.deepEqual(render({
    state: {
        phase: 'end_unloading',
        endReady: { ready: true, reason: 'apt_arrival_point', dMissionNm: 0.08, dArrivalNm: 0.04 },
        groundAction: { action: 'unload', endReady: true }
    },
    runtime: { active: true, phase: 'active' }
}), {
    visible: true,
    kicker: 'Ladung entladen',
    text: 'Du stehst am Boden. Vor dem Missionsabschluss jetzt Ladung entladen bzw. Passagiere aussteigen lassen.',
    button: 'Ausladen',
    disabled: false,
    closeDisplay: 'none',
    begin: false,
    endReady: true,
    final: false
}, 'APT unload banner drifted');

assert.deepEqual(render({
    state: {
        phase: 'end_ready',
        endReady: { ready: true, reason: 'apt_arrival_point', dMissionNm: 0.08, dArrivalNm: 0.04 },
        groundAction: { action: 'end', endReady: true }
    },
    runtime: { active: true, phase: 'active' }
}), {
    visible: true,
    kicker: 'Mission abschliessen',
    text: 'Du stehst am Ziel. 0.04 NM zum Empfangspunkt.',
    button: 'Mission beenden',
    disabled: false,
    closeDisplay: 'none',
    begin: false,
    endReady: true,
    final: true
}, 'APT end-ready banner drifted');

assert.deepEqual(render({
    state: { phase: 'end_unloading', deboardingBusy: true },
    runtime: { active: true, phase: 'active' }
}), {
    visible: true,
    kicker: 'Mission abschliessen',
    text: 'Deboarding laeuft. Missionabschluss wird vorbereitet.',
    button: 'Bitte warten...',
    disabled: true,
    closeDisplay: 'none',
    begin: false,
    endReady: false,
    final: false
}, 'APT deboarding banner drifted');

assert.deepEqual(render({
    state: { phase: 'closing' },
    runtime: { active: false, phase: 'closing', closingPending: true }
}), {
    visible: true,
    kicker: 'Mission auswerten',
    text: 'Mission erfolgreich abgeschlossen.',
    button: 'Abschluss & Debrief',
    disabled: false,
    closeDisplay: 'none',
    begin: false,
    endReady: false,
    final: false
}, 'APT debrief banner drifted');

function canonicalRender(source) {
    const model = aptUiCore.bannerModel(source);
    return {
        visible: !!model,
        kicker: model?.kicker || '',
        text: model?.text || '',
        button: model?.button || '',
        disabled: model?.disabled === true,
        closeDisplay: model?.closeHidden === true ? 'none' : '',
        begin: model?.begin === true,
        endReady: model?.endReady === true,
        final: model?.final === true
    };
}

const tracker = (phase, allowedActions, flags = {}) => ({
    missionId: 'apt-characterization',
    executionAuthority: 'tracker',
    authorityRevision: 1,
    phase,
    allowedActions,
    flags
});

assert.deepEqual(canonicalRender(tracker('planned', ['prepare_mission'])), render(), 'tracker planned banner differs from App');
assert.deepEqual(canonicalRender(tracker('prepare', ['start_boarding'])), render({ state: { phase: 'prepare' } }), 'tracker prepare banner differs from App');
assert.deepEqual(canonicalRender(tracker('boarding', [], { boardingConfirmed: false })), render({
    state: { phase: 'boarding' }, scene: { boardingPreparing: true }
}), 'tracker boarding wait banner differs from App');
assert.deepEqual(canonicalRender(tracker('boarding', ['set_manifest_item'], { boardingConfirmed: true })), render({
    state: { phase: 'boarding' }, scene: { boardingComplete: true, boardingVoiceComplete: true }
}), 'tracker boarding cargo banner differs from App');
assert.deepEqual(canonicalRender(tracker('boarded', ['start_mission'], { boardingConfirmed: true })), render({
    state: { phase: 'boarded' }
}), 'tracker boarded banner differs from App');
assert.deepEqual(canonicalRender({
    control: tracker('end_unloading', ['set_manifest_item'], { active: true }),
    manifest: { items: [{ id: 'box', itemType: 'cargo', status: 'loaded', delivery: 'destination' }] }
}), render({
    state: {
        phase: 'end_unloading',
        endReady: { ready: true, reason: 'apt_arrival_point', dMissionNm: 0.08, dArrivalNm: 0.04 },
        groundAction: { action: 'unload', endReady: true }
    },
    runtime: { active: true, phase: 'active' }
}), 'tracker unload banner differs from App');
assert.deepEqual(canonicalRender({
    control: { ...tracker('end_ready', ['request_close'], { active: true }), flight: { destination: { hasAptArrival: true, dArrivalNm: 0.04 } } }
}), render({
    state: {
        phase: 'end_ready',
        endReady: { ready: true, reason: 'apt_arrival_point', dMissionNm: 0.08, dArrivalNm: 0.04 },
        groundAction: { action: 'end', endReady: true }
    },
    runtime: { active: true, phase: 'active' }
}), 'tracker end-ready banner differs from App');
assert.deepEqual(canonicalRender(tracker('end_unloading', [], {
    active: true, farewellStarted: true, farewellCompleted: false
})), render({
    state: { phase: 'end_unloading', deboardingBusy: true },
    runtime: { active: true, phase: 'active' }
}), 'tracker deboarding banner differs from App');
assert.deepEqual(canonicalRender(tracker('closing', [], { closingPending: true })), render({
    state: { phase: 'closing' }, runtime: { active: false, phase: 'closing', closingPending: true }
}), 'tracker debrief banner differs from App');

console.log('APT legacy UI characterization selftest passed');
