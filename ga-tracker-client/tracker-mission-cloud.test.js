'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  CLOUD_MISSION_PENDING_RUN_ID,
  CLOUD_MISSION_SEED_SCHEMA,
  buildCloudMissionCandidate,
  fetchTrackerCloudMission
} = require('./tracker-mission-cloud.js');
const { createMissionAuthorityManager } = require('./mission-authority-core.js');

function profile() {
  return {
    lastModified: 1234,
    activeMission: {
      currentMissionData: {
        missionId: 'mission-cloud-apt',
        missionTitle: 'Cloud Charter',
        missionType: 'apt',
        start: 'EDTW',
        dest: 'EDTL',
        cargoManifest: {
          version: 6,
          items: [{ id: 'cargo-1', itemType: 'cargo', required: true, status: 'pending', weightLbs: 12 }]
        }
      }
    },
    activeMissionTrackerSeed: {
      schema: CLOUD_MISSION_SEED_SCHEMA,
      version: 1,
      missionId: 'mission-cloud-apt',
      adapter: 'apt',
      updatedAt: 1200,
      initialCargoManifest: {
        version: 6,
        items: [{ id: 'cargo-1', itemType: 'cargo', required: true, status: 'pending', weightLbs: 12 }]
      },
      executionEffectPlan: {
        schema: 'ga.mission-apt-effect-plan.v1',
        version: 1,
        recipe: 'apt',
        missionId: 'mission-cloud-apt',
        sceneId: 'scene-cloud',
        effects: {
          'scene.prepare': { command: { type: 'mission_scene_spawn', sceneId: 'scene-cloud', items: [{}] } },
          'scene.boarding': { command: { type: 'mission_scene_boarding', sceneId: 'scene-cloud', path: [{}, {}] } }
        }
      }
    }
  };
}

test('cloud mission seed becomes a deterministic planned tracker candidate', () => {
  const result = buildCloudMissionCandidate(profile());
  assert.equal(result.ok, true);
  assert.equal(result.status, 'ready');
  assert.equal(result.candidate.missionId, 'mission-cloud-apt');
  assert.equal(result.candidate.runId, CLOUD_MISSION_PENDING_RUN_ID);
  assert.equal(result.candidate.bundle.runtime.runtime.phase, 'planned');
  assert.equal(result.candidate.bundle.execution.phase, 'planned');
  assert.deepEqual(result.candidate.control.allowedActions, ['activate_cloud_mission']);
  assert.equal(result.candidate.control.cargo.summary.departureMissing, 1);
});

test('cloud mission seed must identify the same mission as the cloud state', () => {
  const value = profile();
  value.activeMissionTrackerSeed.missionId = 'mission-other';
  const result = buildCloudMissionCandidate(value);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'cloud_mission_identity_mismatch');
});

test('tracker fetches the existing pilot profile without exposing credentials in the candidate', async () => {
  let requestedUrl = '';
  const result = await fetchTrackerCloudMission('Pilot 7', '1234', {
    request: async (url) => {
      requestedUrl = url;
      if (new URL(url).pathname.endsWith('/head')) return { status: 200, data: { revision: 0, manifest: null } };
      return { status: 200, data: profile() };
    }
  });
  assert.equal(result.ok, true);
  assert.match(requestedUrl, /Pilot%207\?pin=1234$/);
  assert.doesNotMatch(JSON.stringify(result.candidate), /1234/);
  assert.equal(result.candidate.bundle.runtime.cargoManifest.pilotId, 'Pilot 7');
});

test('cloud candidate passes the existing two-phase tracker execution handoff unchanged', () => {
  const candidate = buildCloudMissionCandidate(profile()).candidate;
  const authority = createMissionAuthorityManager({
    executionAuthorityEnabled: true,
    now: (() => { let value = 2000; return () => ++value; })(),
    idFactory: () => 'run-cloud'
  });
  const acquired = authority.acquire({
    missionId: candidate.missionId,
    clientId: 'tracker-cloud:efb',
    stateHash: candidate.bundle.execution.stateHash,
    resumeBundle: candidate.bundle
  });
  assert.equal(acquired.ok, true);
  let run = authority.getActiveRun();
  const prepared = authority.prepareExecutionAuthority({
    missionId: run.missionId,
    runId: run.runId,
    clientId: 'tracker-cloud:efb',
    expectedRevision: run.revision,
    expectedStateHash: run.stateHash,
    expectedExecutionStateHash: run.executionStateHash
  });
  assert.equal(prepared.ok, true);
  run = authority.getActiveRun();
  const committed = authority.commitExecutionAuthority({
    missionId: run.missionId,
    runId: run.runId,
    clientId: 'tracker-cloud:efb',
    expectedRevision: run.revision,
    handoffId: prepared.handoff.handoffId,
    expectedExecutionStateHash: prepared.handoff.executionStateHash
  });
  assert.equal(committed.ok, true);
  assert.equal(committed.activeRun.executionAuthority, 'tracker');
});

test('V2 large APT and POI mission packages reach the original candidate builder intact', async () => {
  const core = require('../cloud-sync-core.js');
  const poi = require('./tracker-mission-poi-runtime.js');
  for (const adapter of ['apt', 'poi']) {
    const value = profile();
    value.activeMission.currentMissionData.missionTruth = { content: 'Kontext 🌍 '.repeat(50000) };
    if (adapter === 'poi') {
      value.activeMission.currentMissionData.missionType = 'poi';
      value.activeMissionTrackerSeed.adapter = 'poi';
      value.activeMissionTrackerSeed.executionPoiRecipe = {
        schema: poi.RECIPE_SCHEMA, version: 1, missionId: 'mission-cloud-apt',
        taskDomain: 'media_photo', target: { lat: 48.39, lon: 8.43 }, home: { lat: 48.4, lon: 8.5 },
        strict: true, trackingActive: true,
        passenger: { targetRadiusNm: .5, targetAltFt: 4000, targetDwellMin: 5 }
      };
      const recipe = value.activeMissionTrackerSeed.executionPoiRecipe;
      recipe.lifecycle = { schema: require('../mission-poi-lifecycle-core.js').SCHEMA };
      recipe.voiceContext = {
        schema: require('../mission-poi-voice-core.js').CONTEXT_SCHEMA, version: 1,
        missionId: recipe.missionId, taskDomain: recipe.taskDomain, strict: recipe.strict,
        passenger: recipe.passenger, baseContext: 'Fotograf am Ziel.', audioEnabled: false
      };
      value.activeMissionTrackerSeed.executionEffectPlan = {
        schema: 'ga.mission-poi-effect-plan.v1', recipe: 'poi', missionId: recipe.missionId,
        effects: {
          'scene.prepare': { none: true }, 'scene.boarding': { none: true },
          'scene.deboarding': { none: true }, 'scene.target': { none: true },
          'voice.boarding': { recipe: require('../mission-boarding-voice-core.js').createRecipe({ missionId: recipe.missionId, prompt: 'Bereit.', audioEnabled: false }) },
          'voice.approach': { context: { ...recipe.voiceContext, supported: true } },
          'voice.farewell': { poiContextRef: true }
        }
      };
    }
    value.logbook = [{ content: 'not needed by tracker' }];
    const packed = await core.pack(value);
    const requested = [];
    const result = await fetchTrackerCloudMission('Pilot 7', '1234', {
      poiExecutionEnabled: true,
      request: async (url, options) => {
        requested.push(url); assert.equal(options.headers['X-Pilot-ID'], 'Pilot 7');
        assert.ok(!url.includes('1234'));
        if (new URL(url).pathname.endsWith('/head')) return { status: 200, data: { revision: 1, manifest: packed.manifest } };
        return { status: 200, data: { data: packed.chunks[url.split('/').pop()] } };
      }
    });
    assert.equal(result.status, 'ready', JSON.stringify(result));
    assert.equal(result.candidate.bundle.adapter, adapter);
    assert.equal(result.candidate.bundle.missionState.currentMissionData.missionTruth.content, value.activeMission.currentMissionData.missionTruth.content);
    for (const id of packed.manifest.sections['field:logbook'].chunks) assert.ok(!requested.some(url => url.endsWith(id)));
  }
});

test('large lossless mission survives acquire and restart; oversized candidates fail before presentation', t => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const adapters = require('../mission-resume-adapters-core.js');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'large-mission-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const source = profile();
  source.activeMission.currentMissionData.missionTruth = { evidence: 'Original ä '.repeat(60000) };
  const candidate = buildCloudMissionCandidate(source).candidate;
  const options = { storageFile: path.join(directory, 'authority.json'), executionAuthorityEnabled: true };
  let manager = createMissionAuthorityManager(options);
  const acquired = manager.acquire({ missionId: candidate.missionId, clientId: 'test', resumeBundle: candidate.bundle });
  assert.equal(acquired.ok, true);
  manager = createMissionAuthorityManager(options);
  assert.deepEqual(manager.getActiveRun({ includeBundle: true }).resumeBundle.missionState, source.activeMission);
  source.activeMission.currentMissionData.missionTruth.evidence = 'x'.repeat(adapters.MAX_RESUME_BYTES);
  const rejected = buildCloudMissionCandidate(source);
  assert.equal(rejected.code, 'resume_bundle_too_large');
  assert.equal(rejected.candidate, null);
  assert.equal(adapters.validateSize('x'.repeat(adapters.MAX_RESUME_BYTES - 2)).ok, true);
  assert.equal(adapters.validateSize('x'.repeat(adapters.MAX_RESUME_BYTES - 1)).ok, false);
});
