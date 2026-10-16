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
      enabled: true, pilotId: 'package-smoke', flightLogDirectory: directory, log: console.log,
      requireCockpitReady: true, independentStartReadiness: true
    });
    assert.notEqual(host.runtime.publicState().processId, process.pid);
    assert.equal(host.runtime.publicState().processAvailable, true);
    const acquired = await host.authorityManager.acquire({ missionId: 'packaged-test', clientId: 'test' });
    assert.equal(acquired.ok, true);
    assert.equal(host.authorityManager.getActiveRun().missionId, 'packaged-test');
    await host.runtime.flush();
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'authority.json'), 'utf8')).activeRun.missionId, 'packaged-test');
    host.runtime.attachSimulator({getLivePosition:()=>({lat:51.5,lon:7,alt:600})});
    const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
    for(let n=0;n<4;n++) {
      if(n) await delay(1000);
      const observedAt = Date.now();
      host.runtime.observeStartReadiness({observedAt,lat:51.5,lon:7,altFt:600,cameraState:2,
        simRunning:1,simPaused:false,inMenuOrMap:false,slewActive:false,onGround:true,gsKts:0});
      const deadline=Date.now()+3000;
      while(host.runtime.publicState().startReadiness?.observedAt !== observedAt && Date.now()<deadline) await delay(20);
      assert.equal(host.runtime.publicState().startReadiness.observedAt,observedAt);
    }
    assert.equal(host.runtime.publicState().startReadinessSource,'independent-simconnect');
    assert.equal(host.runtime.publicState().startReadiness.ready,true);
    host.runtime.observeStartReadiness(null);
    const deadline=Date.now()+3000;
    while(host.runtime.publicState().startReadiness?.ready && Date.now()<deadline) await delay(20);
    assert.equal(host.runtime.publicState().startReadiness.ready,false);
    console.log('MISSION_PACKAGED_INDEPENDENT_READINESS_OK');
    console.log('MISSION_PACKAGED_PROCESS_SMOKE_OK');
  } finally {
    await host?.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
