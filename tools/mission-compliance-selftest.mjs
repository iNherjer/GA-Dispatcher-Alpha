#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../mission-compliance-core.js', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const mapSource = fs.readFileSync(new URL('../map.js', import.meta.url), 'utf8');
const runtimeSource = fs.readFileSync(new URL('../mission-runtime-core.js', import.meta.url), 'utf8');
const syncSource = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
const trackerSource = fs.readFileSync(new URL('../ga-tracker-client/tracker.js', import.meta.url), 'utf8');

const context = {
    window: {
        activeMissionContract: null,
        addEventListener() {},
        missionRuntimeIsActive: () => true,
        missionComplianceAtFinalEndpoint: () => true
    },
    document: {
        readyState: 'complete',
        body: null
    },
    currentMissionData: {
        missionId: 'compliance-selftest',
        cargoManifest: { key: 'compliance-selftest', items: [] }
    },
    setTimeout,
    clearTimeout,
    Date,
    JSON,
    Object,
    Number,
    String,
    Array,
    Math,
    Promise,
    console
};
vm.runInNewContext(source, context);

const api = context.window.MissionComplianceCore;
assert.ok(api, 'MissionComplianceCore export missing');
assert.equal(api.probability, 0.03);
assert.equal(api.shouldInspect(0), true);
assert.equal(api.shouldInspect(0.029999), true);
assert.equal(api.shouldInspect(0.03), false);
assert.equal(api.shouldInspect(0.99, true), true);
assert.deepEqual(Array.from(api.requestedItemIds), ['bordbuch', 'fire-extinguisher', 'first-aid']);

const fixedNow = new Date(2026, 6, 29, 12, 0, 0, 0).getTime();
assert.equal(api.expiryStatus('2026-07-29', fixedNow).daysRemaining, 0);
assert.equal(api.expiryStatus('2026-07-28', fixedNow).overdueDays, 1);
assert.equal(api.classifyOverdue(0), 'valid');
assert.equal(api.classifyOverdue(1), 'warning');
assert.equal(api.classifyOverdue(3), 'warning');
assert.equal(api.classifyOverdue(4), 'entry');

const flightId = 'compliance-selftest|1000';
const missingState = {
    flightId,
    snapshot: {
        items: api.requestedItemIds.map(id => ({ id, status: 'pending', expiresAt: '' }))
    }
};
const missingResult = context._missionComplianceEvidenceResult(missingState, { items: [] });
assert.equal(missingResult.ready, true, 'forgotten optional items must not deadlock evidence submission');
assert.equal(missingResult.blockingUnload.length, 0);
assert.equal(missingResult.offences.filter(item => item.severity === 'entry').length, 3);

const loadedManifest = {
    items: [
        { id: 'bordbuch', status: 'loaded', log: {} },
        { id: 'fire-extinguisher', status: 'loaded', expiresAt: '2026-08-15' },
        { id: 'first-aid', status: 'loaded', expiresAt: '2026-08-15' }
    ]
};
const carriedState = {
    flightId,
    snapshot: {
        items: loadedManifest.items.map(item => ({
            id: item.id,
            status: 'loaded',
            expiresAt: item.expiresAt || ''
        }))
    }
};
const loadedResult = context._missionComplianceEvidenceResult(carriedState, loadedManifest);
assert.equal(loadedResult.ready, false);
assert.deepEqual(Array.from(loadedResult.blockingUnload), ['Bordbuch', 'Feuerloescher', 'Verbandzeug']);

const unloadedManifest = {
    items: loadedManifest.items.map(item => ({ ...item, status: 'unloaded' }))
};
const missingLogResult = context._missionComplianceEvidenceResult(carriedState, unloadedManifest);
assert.deepEqual(Array.from(missingLogResult.missingLogFields), ['start', 'landing']);

unloadedManifest.items[0].log = {
    flightId,
    startAt: fixedNow - 3600000,
    landingAt: fixedNow
};
carriedState.snapshot.items.find(item => item.id === 'fire-extinguisher').expiresAt = '2026-07-26';
carriedState.snapshot.items.find(item => item.id === 'first-aid').expiresAt = '2026-07-25';
const overdueResult = context._missionComplianceEvidenceResult(carriedState, unloadedManifest);
assert.equal(overdueResult.ready, true);
assert.equal(overdueResult.offences.find(item => item.itemId === 'fire-extinguisher')?.severity, 'warning');
assert.equal(overdueResult.offences.find(item => item.itemId === 'first-aid')?.severity, 'entry');

assert.ok(syncSource.includes("type: 'mission_scene_ground_visit'"), 'app ground-visit command missing');
assert.ok(syncSource.includes("type: 'mission_scene_ground_visit_release'"), 'app ground-visit release missing');
assert.ok(trackerSource.includes('animateMissionSceneGroundVisit(command).catch'), 'tracker ground visit must run independently');
assert.ok(!trackerSource.includes('enqueueSceneOperation(sceneId, () => animateMissionSceneGroundVisit(command))'), 'ground visit must not block Farewell/Deboarding queue');
assert.ok(trackerSource.includes("stage: 'visitors_at_aircraft'"), 'inspector arrival stage missing');
assert.match(appSource, /async function generateMission[\s\S]{0,500}missionComplianceBlockReset/, 'new dispatch must not replace an active inspection');
assert.match(appSource, /function clearExpiredActiveMissionPersistence[\s\S]{0,350}missionComplianceBlockReset/, 'expiry cleanup must not remove an active inspection');
assert.match(syncSource, /restoreMissionCompletionFromCloud[\s\S]{0,500}missionComplianceBlockClose/, 'cloud completion must not skip an active inspection');
assert.match(syncSource, /_syncConfirmReplaceRunningLocalMission[\s\S]{0,350}missionComplianceBlockReset/, 'cloud mission replacement must not skip an active inspection');
assert.match(mapSource, /async function applyAirportDirectTo[\s\S]{0,300}missionComplianceBlockReset/, 'airport Direct-To must not replace an active inspection');
assert.match(mapSource, /createCrewHomebaseVisitRoute[\s\S]{0,300}missionComplianceBlockReset/, 'crew route must not replace an active inspection');
assert.match(mapSource, /window\.freeflightDirectTo[\s\S]{0,300}missionComplianceBlockReset/, 'freeflight Direct-To must not replace an active inspection');
assert.ok(syncSource.includes("window.missionCargoRecordFlightEvent?.('landing', Number(earlyRecord.endTs || now)"), 'landing banner must be scheduled from the actual target touchdown');
assert.ok(source.includes('_missionComplianceAwaitVoice'), 'inspection voice needs a bounded fallback');
assert.ok(runtimeSource.includes('_missionRuntimeStartFarewellSpeech:voice-timeout'), 'Farewell voice needs a bounded fallback');

console.log('mission compliance selftest: ok');
