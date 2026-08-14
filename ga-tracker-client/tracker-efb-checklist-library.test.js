'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  CHECKLIST_LIBRARY_SCHEMA,
  MAX_LIBRARY_BYTES,
  createTrackerEfbChecklistStore,
  normalizeChecklistLibrary
} = require('./tracker-efb-checklist-library');

test('custom checklist libraries are bounded and converted to the EFB section model', () => {
  const library = normalizeChecklistLibrary({
    revision: 7,
    checklists: [{
      id: 'custom:edtw',
      title: 'EDTW Platzrunde',
      updatedAt: 123,
      chapters: [{
        id: 'before-start',
        title: 'Vor dem Start',
        items: [
          { id: 'doors', text: 'Tueren und Fenster verriegelt' },
          { id: 'fuel', text: '  Fuel   geprueft  ' }
        ]
      }]
    }]
  }, { now: () => 456 });
  assert.equal(library.schema, CHECKLIST_LIBRARY_SCHEMA);
  assert.equal(library.revision, 7);
  assert.equal(library.checklists[0].source, 'custom');
  assert.equal(library.checklists[0].sections[0].items[1].text, 'Fuel geprueft');
});

test('tracker checklist storage survives restarts and clears with an empty library', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-efb-checklists-'));
  const storageFile = path.join(directory, 'checklists.json');
  const first = createTrackerEfbChecklistStore({ storageFile, now: () => 1000 });
  const stored = first.store({ revision: 3, checklists: [{
    id: 'custom-one', title: 'Eigene Liste', chapters: [{ title: 'Start', items: [{ id: 'a', text: 'Item A' }] }]
  }] });
  assert.equal(stored.ok, true);
  assert.equal(stored.status, 'ok');
  assert.equal(stored.snapshot.revision, 3);

  const reloaded = createTrackerEfbChecklistStore({ storageFile, now: () => 2000 });
  assert.equal(reloaded.getSnapshot().checklists[0].title, 'Eigene Liste');
  assert.equal(reloaded.store({ revision: 4, checklists: [] }).snapshot.checklists.length, 0);
});

test('oversized checklist payloads are rejected before persistence', () => {
  assert.throws(() => normalizeChecklistLibrary({ checklists: [{
    id: 'too-big', title: 'Gross', chapters: [{ title: 'X', items: [{ text: 'x'.repeat(MAX_LIBRARY_BYTES) }] }]
  }] }), /too_large/);
});

test('failed persistence does not make an unsaved checklist look stored', () => {
  const memoryFs = {
    existsSync() { return false; },
    mkdirSync() {},
    writeFileSync() { throw new Error('disk-full'); },
    renameSync() {},
    unlinkSync() {}
  };
  const store = createTrackerEfbChecklistStore({
    storageFile: '/virtual/efb-checklists-v1.json',
    fs: memoryFs,
    now: () => 44
  });
  const result = store.store({
    checklists: [{
      id: 'custom-one',
      title: 'Custom',
      chapters: [{ id: 'start', title: 'Start', items: [{ id: 'one', text: 'Item' }] }]
    }]
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'error');
  assert.equal(store.getSnapshot().checklists.length, 0);
  assert.equal(store.getSnapshot().revision, 0);
});

test('identical checklist content is a noop and keeps the stored revision', () => {
  let writes = 0;
  const memoryFs = {
    existsSync() { return false; },
    mkdirSync() {},
    writeFileSync() { writes += 1; },
    renameSync() {},
    unlinkSync() {}
  };
  const store = createTrackerEfbChecklistStore({
    storageFile: '/virtual/efb-checklists-v1.json',
    fs: memoryFs,
    now: () => 100
  });
  const library = {
    revision: 7,
    updatedAt: 80,
    checklists: [{
      id: 'same',
      title: 'Identisch',
      chapters: [{ id: 'start', title: 'Start', items: [{ id: 'one', text: 'Prüfen' }] }]
    }]
  };
  const first = store.store(library);
  const second = store.store({ ...library, revision: 99, updatedAt: 999 });
  assert.equal(first.status, 'ok');
  assert.equal(second.status, 'noop');
  assert.equal(second.snapshot.revision, first.snapshot.revision);
  assert.equal(writes, 1);
});
