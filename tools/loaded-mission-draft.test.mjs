import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// 29.10.2026: pinboard, flight code and MSFS backup missions open as a draft; the
// cloud slot changes only through "Mission akzeptieren" (draft commit with activate).
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const board = fs.readFileSync(new URL('../board.js', import.meta.url), 'utf8');
const helper = app.slice(app.indexOf('window.gaOpenLoadedMissionAsDraft = '), app.indexOf('window.rejectMissionDraft = '));

test('loaded missions replace a shown draft and keep route-only plans and the accepted mission direct', () => {
    assert.ok(helper.length > 200);
    assert.match(helper, /missionIsFreeflightOnly\?\.\(state\)\) return \{ handled: false \}/);
    assert.match(helper, /acceptedId === md\.missionId\) return \{ handled: false \}/);
    assert.match(helper, /if \(session\.active\(\)\) \{[\s\S]*?session\.discard\(\)/);
    assert.match(helper, /session\.begin\(\{ previousMissionId: acceptedId \}\)/);
    assert.match(helper, /allowDraft: true/);
    assert.doesNotMatch(helper, /queueActiveMissionCloudSave|triggerCloudSave/);
});

test('pinboard, flight code and MSFS import try the draft path before any direct save', () => {
    for (const source of ['pinboard', 'flight-code', 'msfs-import']) {
        const at = board.indexOf(`gaOpenLoadedMissionAsDraft?.(`, board.indexOf(source === 'pinboard' ? 'async function pinboardRestoreFlightData' : source === 'flight-code' ? "source: 'import'" : "'Backup enthaelt nur") - 2000);
        assert.ok(at > 0, source);
    }
    const pin = board.slice(board.indexOf('async function pinboardRestoreFlightData'), board.indexOf('function pinboardCreateElement'));
    assert.ok(pin.indexOf('gaOpenLoadedMissionAsDraft') < pin.indexOf('pinboardStoreActiveMissionStateForRestore(flightData)'));
    assert.doesNotMatch(fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8'), /gaMarkLocalMissionSelection/);
});
