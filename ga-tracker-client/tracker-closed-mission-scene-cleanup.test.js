'use strict';
// Feldtest 13.11.2026: Nach dem Debriefing löscht die Cloud die geschlossene Mission; ausgeladene
// Fracht und Gepäck am Ziel blieben stehen, weil nur ein aktiver Run abgeräumt wurde.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, 'tracker.js'), 'utf8');

test('cloud clear removes the scenes of the closed mission before its state is dropped', () => {
  const start = source.indexOf('cloudMissionReconciler = createCloudMissionReconciler({');
  assert.ok(start > 0);
  const clearStart = source.indexOf('clear: async control => {', start);
  const block = source.slice(clearStart, source.indexOf('load: (candidate, control)', clearStart));
  const cleanup = block.indexOf('clearClosedMissionScenes(closedMissionId');
  const drop = block.indexOf('clearMissionRecoveryState(');
  assert.ok(cleanup > 0 && drop > cleanup, 'Szenen werden vor dem Löschen des Missionsstands abgeräumt');
  assert.match(block, /lastRun\?\.missionId/);
});

test('closed-mission cleanup never touches the active run and uses the mission scene cleanup', () => {
  const start = source.indexOf('async clearClosedMissionScenes(');
  assert.ok(start > 0);
  const body = source.slice(start, source.indexOf('async cleanupExecutionRun(', start));
  assert.match(body, /activeRun\.missionId === id\)\) return \{ ok: true, status: 'noop'/);
  assert.match(body, /clearAuthorityRunEffects\(id, reason\)/);
  assert.match(source, /clearClosedMissionScenes: \(missionId, reason\) => missionSmokeController\.clearClosedMissionScenes\(missionId, reason\)/);
});
