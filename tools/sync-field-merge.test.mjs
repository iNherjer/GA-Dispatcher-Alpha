import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Field-wise profile merge in sync.js (28.10.2026): the block between its marker
// comment and setLastSyncedPayload runs here against a stub localStorage.
const source = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
const block = source.slice(source.indexOf('// === Field-wise profile merge'), source.indexOf('function setLastSyncedPayload('));

function load(local = {}) {
    const values = new Map();
    const context = vm.createContext({
        console, JSON, Math, Date, Number, String, Object, Array, Set, Map, setTimeout: () => {},
        window: {},
        localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) },
        getSyncId: () => 'TEST'
    });
    vm.runInContext(block + '\n;this.api = { _syncMergePinboard, _syncMergeProfileFields, _syncWriteFieldBase, _syncReadFieldBase, _syncLocalAheadOfBase, _syncMissionHash, _syncMissionForUpload, _syncHash };', context);
    return { api: context.api, values, local };
}
const note = (id, text, extra = {}) => ({ id, type: 'note', text, x: 1, y: 2, rot: 0, ...extra });
const texts = list => Array.from(list, n => n.text).join(" | ").split(" | ");

test('pinboard: new notes from both sides stay, deletions from both sides apply', () => {
    const { api } = load();
    const shared = [note(1, 'A'), note(2, 'B'), note(3, 'C')];
    api._syncWriteFieldBase({ pinboard: shared });
    const base = api._syncReadFieldBase();
    const cloud = [note(1, 'A'), note(3, 'C'), note(10, 'REMOTE-NEU')]; // other device removed B, added one
    const local = [note(1, 'A'), note(2, 'B'), note(20, 'LOKAL-NEU')];  // this device removed C, added one
    assert.deepEqual(texts(api._syncMergePinboard(cloud, local, base)), ['A', 'REMOTE-NEU', 'LOKAL-NEU']);
});

test('pinboard: local edit wins over the old cloud copy; remote edit survives a local delete', () => {
    const { api } = load();
    api._syncWriteFieldBase({ pinboard: [note(1, 'A'), note(2, 'B')] });
    const base = api._syncReadFieldBase();
    const cloud = [note(1, 'A'), note(2, 'B-geändert-remote')];
    const local = [note(1, 'A-geändert-lokal')]; // B deleted here, but edited elsewhere
    assert.deepEqual(texts(api._syncMergePinboard(cloud, local, base)), ['A-geändert-lokal', 'B-geändert-remote']);
});

test('pinboard without base: union, nothing is treated as deleted', () => {
    const { api } = load();
    assert.deepEqual(texts(api._syncMergePinboard([note(1, 'A')], [note(2, 'B')], null)), ['A', 'B']);
});

test('fields: only fields changed here since the base go up; others keep the cloud value', () => {
    const { api } = load();
    const synced = { pinboard: [], aircraftPresets: ['C172'], favoriteAirports: ['EDTW'], logbook: [{ completionId: 'a' }], crewShare: { online: true, at: 5 } };
    api._syncWriteFieldBase(synced);
    const cloud = { ...synced, aircraftPresets: ['C172', 'PA24'], logbook: [{ completionId: 'a' }, { completionId: 'b' }] };
    const local = { ...synced, favoriteAirports: ['EDTW', 'EDTD'], logbook: [{ completionId: 'a' }, { completionId: 'c' }], crewShare: { online: false, at: 9 } };
    const merged = api._syncMergeProfileFields(cloud, local);
    assert.deepEqual(merged.aircraftPresets, ['C172', 'PA24'], 'remote preset change kept');
    assert.deepEqual(merged.favoriteAirports, ['EDTW', 'EDTD'], 'local favourite change uploaded');
    assert.deepEqual(merged.logbook.map(e => e.completionId).sort(), ['a', 'b', 'c'], 'logbooks combined');
    assert.equal(merged.crewShare.online, false, 'newest sharing choice wins');
});

test('fields without base: single values from the cloud (as before), lists combined', () => {
    const { api } = load();
    const merged = api._syncMergeProfileFields({ aircraftPresets: ['cloud'], knownNotes: [1] }, { aircraftPresets: ['local'], knownNotes: [2] }, null);
    assert.deepEqual(merged.aircraftPresets, ['cloud']);
    assert.deepEqual(merged.knownNotes, [1, 2]);
});

test('mission: renewed save stamps are not a change, real edits are', () => {
    const { api } = load();
    const mission = { activeMissionSavedAt: 1, currentMissionData: { activeMissionSavedAt: 1, mission: 'Charter' } };
    const seed = { missionId: 'm1', updatedAt: 1 };
    const profile = { pinboard: [], activeMission: mission, activeMissionTrackerSeed: seed };
    api._syncWriteFieldBase(profile);
    const restamped = { activeMissionSavedAt: 2, currentMissionData: { activeMissionSavedAt: 2, mission: 'Charter' } };
    assert.equal(api._syncLocalAheadOfBase({ pinboard: [], activeMission: restamped, activeMissionTrackerSeed: { ...seed, updatedAt: 2 } }), false);
    const reused = api._syncMissionForUpload(profile, restamped, { ...seed, updatedAt: 2 }, null);
    assert.equal(reused.activeMission, mission, 'cloud object reused, so no new upload');
    const edited = { ...restamped, currentMissionData: { ...restamped.currentMissionData, mission: 'Fracht' } };
    assert.equal(api._syncLocalAheadOfBase({ pinboard: [], activeMission: edited, activeMissionTrackerSeed: seed }), true);
});

test('hash ignores key order', () => {
    const { api } = load();
    assert.equal(api._syncHash({ a: 1, b: [{ x: 1, y: 2 }] }), api._syncHash({ b: [{ y: 2, x: 1 }], a: 1 }));
});
