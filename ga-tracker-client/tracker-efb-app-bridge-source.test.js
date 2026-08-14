'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '..');

test('the app exports custom checklists only behind the tracker capability', () => {
  const source = fs.readFileSync(path.join(repositoryRoot, 'checklists.js'), 'utf8');
  assert.match(source, /TRACKER_CHECKLIST_CAPABILITY = 'checklist\.library\.v1'/);
  assert.match(source, /capabilities\.includes\(TRACKER_CHECKLIST_CAPABILITY\)/);
  assert.match(source, /type: 'efb_checklist_library\.store'/);
  assert.match(source, /window\.gaGetCustomChecklistTrackerSnapshot = trackerCustomChecklistSnapshot/);
  assert.match(source, /maybePullKvChecklists\(true\)/);
  assert.match(source, /pendingUploads/);
});

test('the authority bundle carries the bounded EFB mission projection without replacing mission state', () => {
  const checklistSource = fs.readFileSync(path.join(repositoryRoot, 'checklists.js'), 'utf8');
  const syncSource = fs.readFileSync(path.join(repositoryRoot, 'sync.js'), 'utf8');
  assert.match(checklistSource, /window\.gaGetEfbMissionViewSnapshot = function/);
  assert.match(syncSource, /window\.gaGetEfbMissionViewSnapshot\(\)/);
  assert.match(syncSource, /efbMission,/);
  assert.match(syncSource, /missionState,/);
  assert.match(syncSource, /runtime/);
});
