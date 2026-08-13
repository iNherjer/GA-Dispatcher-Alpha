'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  checklistIndexKey,
  checklistItemKey,
  fetchTrackerEfbChecklistLibrary
} = require('./tracker-efb-checklist-cloud.js');

test('tracker loads the existing app checklist KV format into its EFB library', async () => {
  const calls = [];
  const result = await fetchTrackerEfbChecklistLibrary('Pilot 7', '1234', {
    request: async (url, options) => {
      calls.push({ url, options });
      if (url.includes('CHKIDX_')) return {
        status: 200,
        data: { kind: 'checklist-index-v1', lastModified: 789, entries: [{ id: 'custom:edtw' }] }
      };
      return {
        status: 200,
        data: { kind: 'checklist-v1', checklist: {
          id: 'custom:edtw',
          title: 'EDTW Eigene Liste',
          updatedAt: 700,
          chapters: [{ id: 'start', title: 'Start', items: [{ id: 'fuel', text: 'Fuel geprueft' }] }]
        } }
      };
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.library.revision, 789);
  assert.equal(result.library.checklists[0].title, 'EDTW Eigene Liste');
  assert.equal(result.library.checklists[0].sections[0].items[0].text, 'Fuel geprueft');
  assert.equal(calls[0].options.pin, '1234');
  assert.match(calls[0].url, /pin=1234/);
});

test('tracker treats a missing index as a valid empty cloud library', async () => {
  const result = await fetchTrackerEfbChecklistLibrary('PILOT', '1234', {
    request: async () => ({ status: 404, data: null })
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'empty');
  assert.deepEqual(result.library.checklists, []);
});

test('tracker keeps errors distinct from an empty list so cached data is not erased', async () => {
  const result = await fetchTrackerEfbChecklistLibrary('PILOT', '1234', {
    request: async () => ({ status: 503, data: null })
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'index_invalid');
});

test('tracker mirrors app checklist key encoding', () => {
  assert.equal(checklistIndexKey('Pilot 7'), 'CHKIDX_Pilot_207');
  assert.equal(checklistItemKey('Pilot 7', 'custom:edtw!?'), 'CHK_Pilot_207_custom:edtw');
});
