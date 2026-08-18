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
      return { status: 200, data: profile() };
    }
  });
  assert.equal(result.ok, true);
  assert.match(requestedUrl, /Pilot%207\?pin=1234$/);
  assert.doesNotMatch(JSON.stringify(result.candidate), /1234/);
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
