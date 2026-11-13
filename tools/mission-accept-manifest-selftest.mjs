// Beim Annehmen muss die Ladeliste vor dem Tracker-Seed im Missionsstand stehen,
// sonst aktiviert der Tracker die Mission mit leerer Ladeliste (Feldtest 13.11.2026).
import assert from 'node:assert/strict';
import fs from 'node:fs';
const sync = fs.readFileSync(new URL('../sync.js', import.meta.url), 'utf8');
const start = sync.indexOf('async function _publishSharedMissionReplacement(state, basis) {');
assert.ok(start > 0, 'publish function present');
const body = sync.slice(start, sync.indexOf('\n}\n', start));
const attachAt = body.indexOf('_missionAttachManifestForPublish(state)');
const seedAt = body.indexOf('_syncTrackerMissionSeedPayload(state)');
assert.ok(attachAt > 0 && seedAt > 0 && attachAt < seedAt, 'Ladeliste wird vor dem Seed angelegt');
const helper = sync.slice(sync.indexOf('function _missionAttachManifestForPublish(state) {'), start);
assert.match(helper, /existing\.items\.length\) return false/, 'vorhandene Ladeliste bleibt unberührt');
assert.match(helper, /missionCargoGetManifestSnapshot/, 'gleiche Quelle wie die Verladung');
console.log('[ok] accept manifest selftest');
