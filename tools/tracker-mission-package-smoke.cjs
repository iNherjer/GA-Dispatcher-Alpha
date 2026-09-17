'use strict';
// Package and run to exercise pkg's real child bootstrap through tracker.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createTrackerMissionProcess } = require('../ga-tracker-client/tracker-mission-process.js');
(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-packaged-mission-'));
  let host;
  try {
    host = await createTrackerMissionProcess({
      authority: { storageFile: path.join(directory, 'authority.json'), executionAuthorityEnabled: true },
      enabled: true, pilotId: 'package-smoke', flightLogDirectory: directory, log: console.log
    });
    assert.notEqual(host.runtime.publicState().processId, process.pid);
    assert.equal(host.runtime.publicState().processAvailable, true);
    const acquired = await host.authorityManager.acquire({ missionId: 'packaged-test', clientId: 'test' });
    assert.equal(acquired.ok, true);
    assert.equal(host.authorityManager.getActiveRun().missionId, 'packaged-test');
    await host.runtime.flush();
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'authority.json'), 'utf8')).activeRun.missionId, 'packaged-test');
    console.log('MISSION_PACKAGED_PROCESS_SMOKE_OK');
  } finally {
    await host?.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
