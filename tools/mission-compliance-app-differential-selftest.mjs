#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import complianceCore from '../mission-compliance-domain-core.js';

const appSource = fs.readFileSync(new URL('../mission-compliance-core.js', import.meta.url), 'utf8');

function blockSource(marker) {
    const start = appSource.indexOf(marker);
    assert.ok(start >= 0, `missing ${marker}`);
    const parametersOpen = appSource.indexOf('(', start);
    let parametersDepth = 0;
    let parametersQuote = '';
    let parametersEscaped = false;
    let parametersClose = -1;
    for (let index = parametersOpen; index < appSource.length; index += 1) {
        const char = appSource[index];
        if (parametersEscaped) { parametersEscaped = false; continue; }
        if (char === '\\') { parametersEscaped = true; continue; }
        if (parametersQuote) {
            if (char === parametersQuote) parametersQuote = '';
            continue;
        }
        if (char === "'" || char === '"' || char === '`') { parametersQuote = char; continue; }
        if (char === '(') parametersDepth += 1;
        if (char === ')') {
            parametersDepth -= 1;
            if (parametersDepth === 0) { parametersClose = index; break; }
        }
    }
    assert.ok(parametersClose > parametersOpen, `unterminated parameters for ${marker}`);
    const open = appSource.indexOf('{', parametersClose);
    let depth = 0;
    let quote = '';
    let escaped = false;
    for (let index = open; index < appSource.length; index += 1) {
        const char = appSource[index];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === '\\') {
            escaped = true;
            continue;
        }
        if (quote) {
            if (char === quote) quote = '';
            continue;
        }
        if (char === "'" || char === '"' || char === '`') {
            quote = char;
            continue;
        }
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                return appSource.slice(start, index + 1)
                    + (marker.startsWith('window.') ? ';' : '');
            }
        }
    }
    throw new Error(`unterminated ${marker}`);
}

const executable = [
    blockSource('function _missionComplianceClone('),
    blockSource('function _missionComplianceNormalizeState('),
    blockSource('function _missionCompliancePhaseAtLeast('),
    blockSource('function _missionComplianceItemLabel('),
    blockSource('function _missionComplianceDateDayNumber('),
    blockSource('function missionComplianceExpiryStatus('),
    blockSource('function missionComplianceClassifyOverdue('),
    blockSource('function missionComplianceShouldInspect('),
    blockSource('function _missionComplianceTakeSnapshot('),
    blockSource('function _missionComplianceUpdateRemediation('),
    blockSource('function _missionComplianceEvidenceResult('),
    blockSource('function _missionComplianceResultVoiceText('),
    blockSource('function _missionComplianceCreateSanction('),
    blockSource('window.missionComplianceCanMutateCargo = function('),
    blockSource('window.missionComplianceBoardBookWriteAllowed = function('),
    blockSource('window.missionComplianceGetCargoUiState = function(')
].join('\n\n');

const TEST_NOW = new Date(2026, 7, 21, 12, 0, 0).getTime();

class FixedDate extends Date {
    static now() { return TEST_NOW; }
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function baseManifest() {
    return {
        key: 'manifest-apt-compliance',
        aircraftSlot: 'D-EINA',
        items: [
            {
                id: 'bordbuch', storyName: 'Bordbuch', status: 'loaded',
                log: { flightId: 'apt-compliance|100', startAt: 100, landingAt: 200 }
            },
            {
                id: 'fire-extinguisher', storyName: 'Feuerloescher', status: 'loaded',
                expiresAt: '2026-08-25', serialId: 'FIRE-1'
            },
            {
                id: 'first-aid', storyName: 'Verbandzeug', status: 'loaded',
                expiresAt: '2026-08-21', serialId: 'FIRST-1'
            }
        ]
    };
}

function run(coreEnabled, configure) {
    const originalManifest = baseManifest();
    if (configure?.beforeSnapshot) configure.beforeSnapshot(originalManifest);
    let manifest = clone(originalManifest);
    const persisted = [];
    const sanctions = [];
    const context = {
        window: {
            GAMissionComplianceDomainCore: coreEnabled ? complianceCore : null,
            addAuthoritySanctionToCrewboard: record => {
                sanctions.push(clone(record));
                return true;
            }
        },
        MISSION_COMPLIANCE_DOMAIN_CORE: coreEnabled ? complianceCore : null,
        MISSION_COMPLIANCE_PROBABILITY: 0,
        MISSION_COMPLIANCE_REQUESTED_ITEM_IDS: Object.freeze(['bordbuch', 'fire-extinguisher', 'first-aid']),
        MISSION_COMPLIANCE_PHASE_ORDER: Object.freeze({
            none: 0,
            not_selected: 1,
            selected: 2,
            approach_started: 3,
            inspectors_waiting: 4,
            request_playing: 5,
            evidence_open: 6,
            result_playing: 7,
            departing: 8,
            released: 9
        }),
        Date: FixedDate,
        Math,
        Number,
        String,
        JSON,
        Object,
        Array,
        RegExp,
        Set,
        console,
        _missionComplianceMissionKey: () => 'apt-compliance',
        _missionComplianceFlightId: () => 'apt-compliance|100',
        _missionComplianceManifest: () => manifest,
        _missionCompliancePersist: (state, reason) => {
            persisted.push([reason, state.phase]);
            return true;
        }
    };
    context.window.window = context.window;
    vm.runInNewContext(executable, context, { filename: 'mission-compliance-core.js#differential' });

    const state = context._missionComplianceNormalizeState({
        missionKey: 'apt-compliance',
        flightId: 'apt-compliance|100',
        selected: true,
        phase: 'evidence_open',
        farewellComplete: true
    });
    const snapshot = context._missionComplianceTakeSnapshot(state, originalManifest);
    manifest.items.forEach(item => { item.status = 'unloaded'; });
    if (configure?.afterSnapshot) configure.afterSnapshot(manifest, state);
    const missingFields = context._missionComplianceUpdateRemediation(state, manifest);
    const evidence = context._missionComplianceEvidenceResult(state, manifest);
    const completed = evidence.ready && !evidence.missingLogFields.length
        ? {
            ...evidence,
            completedAt: TEST_NOW,
            warningCount: evidence.offences.filter(item => item.severity === 'warning').length,
            entryCount: evidence.offences.filter(item => item.severity === 'entry').length
        }
        : evidence;
    const resultText = context._missionComplianceResultVoiceText(completed);
    const sanctionAdded = context._missionComplianceCreateSanction(state, completed);

    context.__state = state;
    context._missionComplianceGetState = () => context.__state;
    const uiPhases = ['selected', 'approach_started', 'inspectors_waiting', 'request_playing', 'evidence_open', 'result_playing', 'departing', 'released']
        .map(phase => {
            context.__state = context._missionComplianceNormalizeState({
                ...state,
                phase,
                inspectorsWaiting: phase === 'inspectors_waiting',
                remediation: phase === 'evidence_open'
                    ? { required: true, missingFields: ['landing'] }
                    : { required: false, missingFields: [] }
            });
            return [phase, context.window.missionComplianceGetCargoUiState()];
        });
    context.__state = state;
    const cargoGuards = [
        ['unload-requested', context.window.missionComplianceCanMutateCargo('first-aid', 'unload')],
        ['replace-requested', context.window.missionComplianceCanMutateCargo('first-aid', 'replace')],
        ['replace-other', context.window.missionComplianceCanMutateCargo('mission-crate', 'replace')]
    ];
    context.__state = context._missionComplianceNormalizeState({
        ...state,
        remediation: { required: true, missingFields: ['landing'] }
    });
    const boardBookGuards = [
        ['start', context.window.missionComplianceBoardBookWriteAllowed('start')],
        ['landing', context.window.missionComplianceBoardBookWriteAllowed('landing')]
    ];

    return clone({
        normalized: state,
        probability: [
            context.missionComplianceShouldInspect(0, false),
            context.missionComplianceShouldInspect(0.99, false),
            context.missionComplianceShouldInspect(0.99, true)
        ],
        expiry: [
            context.missionComplianceExpiryStatus('2026-08-25', TEST_NOW),
            context.missionComplianceExpiryStatus('2026-08-19', TEST_NOW),
            context.missionComplianceExpiryStatus('', TEST_NOW)
        ],
        classification: [0, 1, 3, 4].map(days => context.missionComplianceClassifyOverdue(days)),
        snapshot,
        missingFields,
        evidence,
        resultText,
        sanctionAdded,
        sanctions,
        uiPhases,
        cargoGuards,
        boardBookGuards,
        persisted
    });
}

const scenarios = [
    { name: 'valid evidence' },
    {
        name: 'loaded item blocks evidence',
        afterSnapshot: manifest => { manifest.items.find(item => item.id === 'first-aid').status = 'loaded'; }
    },
    {
        name: 'missing item on controlled flight',
        beforeSnapshot: manifest => { manifest.items.find(item => item.id === 'first-aid').status = 'pending'; }
    },
    {
        name: 'boardbook remediation',
        afterSnapshot: manifest => { manifest.items.find(item => item.id === 'bordbuch').log.landingAt = 0; }
    },
    {
        name: 'warning and authority entry',
        beforeSnapshot: manifest => {
            manifest.items.find(item => item.id === 'fire-extinguisher').expiresAt = '2026-08-19';
            manifest.items.find(item => item.id === 'first-aid').expiresAt = '2026-08-17';
        }
    }
];

for (const scenario of scenarios) {
    const legacy = run(false, scenario);
    const shared = run(true, scenario);
    assert.deepEqual(shared, legacy, `${scenario.name}: shared compliance core drifted from the executable App fallback`);
}

console.log('mission compliance/app differential selftest: ok');
