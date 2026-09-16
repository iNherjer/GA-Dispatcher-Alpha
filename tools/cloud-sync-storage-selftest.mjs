import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
function section(start, end) { const at = source.indexOf(start); return source.slice(at, source.indexOf(end, at + start.length)); }
const records = new Map();
const ctx = {
    window: {}, Date, JSON, Number, Object, Array, Set, Map,
    console: { warn() {} }, getSyncId: () => 'PILOT',
    localStorage: {
        getItem: key => records.get(key) || null,
        removeItem: key => records.delete(key),
        setItem: (key, value) => {
            if (key === 'ga_pinboard' && value.length > 1000) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
            records.set(key, value);
        }
    },
    _syncIsStorageQuotaError: e => e.name === 'QuotaExceededError',
    _syncPruneLocalStorageForQuota() {},
    _syncCompactPinboard: notes => notes.map(note => ({ ...note, text: note.text.slice(0, 20) })),
    _syncProfileClient: () => ({ acknowledge: revision => records.set('ga_sync_revision_v2:PILOT', String(revision)) })
};
vm.createContext(ctx);
vm.runInContext(section('function _syncProtectIncompleteCloudRestore()', 'function _syncPayloadComponentChars'), ctx);
vm.runInContext(section('function _syncStoreCloudPinboard(pinboard)', 'let syncLegacyPinboardCleanupScheduled'), ctx);
const full = [{ id: 'note', type: 'text', text: 'Wichtig'.repeat(1000) }];
const restored = vm.runInContext('_syncStoreCloudPinboard', ctx)(full);
assert.equal(restored.compacted, true);
assert.equal(full[0].text.length, 7000, 'cloud source remains complete');
assert.equal(records.get('ga_sync_revision_v2:PILOT'), '-1', 'partial local restore blocks automatic write persistently');
ctx.window.gaLastCloudMissionPullOutcome = { status: 'cloud-mission-applied' };
vm.runInContext('_syncAcknowledgeProfile({ _syncRevision: 7 })', ctx);
assert.equal(records.get('ga_sync_revision_v2:PILOT'), '-1', 'successful mission restore must not acknowledge a truncated profile');
ctx.window.gaCloudRestoreIncomplete = false;
vm.runInContext('_syncStoreCloudPinboard', ctx)([{ id: 'small', text: 'complete' }]);
vm.runInContext('_syncAcknowledgeProfile({ _syncRevision: 7 })', ctx);
assert.equal(records.get('ga_sync_revision_v2:PILOT'), '7', 'complete restore can acknowledge normally');

// Legacy input normalization still happens locally, without altering transport data.
ctx._missionLogbookForSync = source => source || [{ id: 'local', title: 'local full title' }];
ctx._compactLegacyLogbookEntry = entry => entry && ({ ...entry, completionId: entry.id });
ctx._storeMissionLogbookEntries = entries => ({ entries, compacted: false });
vm.runInContext(section('function _mergeMissionLogbooks(', 'function _persistMissionCompletion('), ctx);
const merged = vm.runInContext('_mergeMissionLogbooks', ctx)([{ id: 'remote' }, null]);
assert.deepEqual(Array.from(merged.entries, item => item.completionId).sort(), ['local', 'remote']);
console.log('[ok] cloud local-storage protection and legacy logbook merge');
