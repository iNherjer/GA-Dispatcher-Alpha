const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const groupCore = require('./mission-scene-group-core.js');

for (const count of [2, 3, 4, 5]) {
  test(`group sequence plans ${count} people with exact spacing, stagger and vehicle`, () => {
    const plan = groupCore.normalizeGroupSequenceCommand({
      groupSequence: true,
      expectedPassengerCount: count,
      groupSpacingM: 1
    });
    const members = groupCore.buildGroupMemberPlans(count, plan);
    assert.equal(plan.valid, true);
    assert.equal(plan.groupVehicleKind, count <= 3 ? 'van' : 'bus');
    assert.equal(members.length, count);
    assert.equal(new Set(members.map(member => member.kind)).size, count);
    assert.equal(plan.boardingStaggerMs, 2000);
    assert.deepEqual(members.map(member => member.startDelayMs), Array.from({ length: count }, (_, index) => index * 2000));
    for (let index = 1; index < members.length; index++) {
      assert.equal(Math.round((members[index].lateralOffsetM - members[index - 1].lateralOffsetM) * 10) / 10, 1);
    }
    const vehicle = groupCore.resolveGroupVehicleSelection(plan, {
      vehicleTitle: count <= 3 ? 'Microsoft_Van_EUR' : 'Microsoft_MiniBus_ASIA_01',
      vehicleTitleCandidates: ['Car Bush Firefighting']
    });
    assert.equal(vehicle.vehicleKind, count <= 3 ? 'van' : 'bus');
    assert.equal(vehicle.candidates.some(title => /fire|car/i.test(title)), false);
    assert.equal(groupCore.evaluateGroupSequenceCompletion({
      expectedPassengerCount: count,
      spawnedCount: count,
      routeSentCount: count
    }).complete, true);
  });
}

test('group sequence rejects invalid counts and partial spawn or route results', () => {
  assert.equal(groupCore.normalizeGroupSequenceCommand({ groupSequence: true, expectedPassengerCount: 1 }).valid, false);
  assert.equal(groupCore.normalizeGroupSequenceCommand({ groupSequence: true, expectedPassengerCount: 6 }).valid, false);
  assert.equal(groupCore.evaluateGroupSequenceCompletion({
    expectedPassengerCount: 5,
    spawnedCount: 4,
    routeSentCount: 4
  }).error, 'passenger_count_mismatch');
  assert.equal(groupCore.evaluateGroupSequenceCompletion({
    expectedPassengerCount: 5,
    spawnedCount: 5,
    routeSentCount: 4
  }).error, 'waypoint_route_failed');
});

test('legacy commands do not enable group behavior', () => {
  const plan = groupCore.normalizeGroupSequenceCommand({ boarderCount: 3 });
  assert.equal(plan.enabled, false);
  assert.equal(plan.valid, true);
  assert.equal(plan.expectedPassengerCount, null);
});

test('only strictly scoped group debug commands bypass mission authority', () => {
  const base = {
    groupSceneDebug: true,
    groupSequence: true,
    expectedPassengerCount: 3,
    sceneId: 'mission-scene-group-debug-board-3-1786988349935'
  };
  assert.equal(groupCore.isGroupSceneDebugCommand({ ...base, type: 'mission_scene_spawn' }), true);
  assert.equal(groupCore.isGroupSceneDebugCommand({ ...base, type: 'mission_scene_boarding' }), true);
  assert.equal(groupCore.isGroupSceneDebugCommand({ ...base, type: 'mission_scene_clear' }), true);
  assert.equal(groupCore.isGroupSceneDebugCommand({
    ...base,
    type: 'mission_scene_deboarding',
    sceneId: 'mission-scene-group-debug-deboard-3-1786988349935'
  }), true);
  assert.equal(groupCore.isGroupSceneDebugCommand({ ...base, groupSceneDebug: false, type: 'mission_scene_spawn' }), false);
  assert.equal(groupCore.isGroupSceneDebugCommand({ ...base, sceneId: 'real-mission-scene', type: 'mission_scene_spawn' }), false);
  assert.equal(groupCore.isGroupSceneDebugCommand({ ...base, expectedPassengerCount: 4, type: 'mission_scene_spawn' }), false);
  assert.equal(groupCore.isGroupSceneDebugCommand({ ...base, type: 'mission_smoke_clear' }), false);
  assert.equal(groupCore.isGroupSceneDebugCommand({
    groupSceneDebug: true,
    type: 'mission_scene_clear',
    sceneId: 'mission-scene-group-debug-board-3-1786988349935'
  }), true);
});

test('tracker and web app gate the additive sequence on the explicit capability', () => {
  const trackerSource = fs.readFileSync(path.join(__dirname, 'tracker.js'), 'utf8');
  const syncSource = fs.readFileSync(path.join(__dirname, '..', 'sync.js'), 'utf8');
  const relaySource = fs.readFileSync(path.join(__dirname, 'tracker-efb-relay-core.js'), 'utf8');
  assert.match(relaySource, /CAPABILITIES\.MISSION_SCENE_GROUP/);
  assert.match(trackerSource, /normalizeGroupSequenceCommand\(command\)/);
  assert.match(trackerSource, /groupPlan\.enabled \? groupCompletion\.complete : routeSent/);
  assert.match(trackerSource, /groupPlan\.enabled[\s\S]*?passenger_count_mismatch/);
  assert.match(trackerSource, /const groupSceneDebugCommand = isGroupSceneDebugCommand\(command\)/);
  assert.match(trackerSource, /!groupSceneDebugCommand[\s\S]*?rememberMissionCommand\(command\)/);
  assert.match(trackerSource, /for \(let index = 0; index < personPlans\.length; index\+\+\)[\s\S]*?await sleep\(groupPlan\.boardingStaggerMs\)[\s\S]*?spawnSceneObjectFromPlan\(sceneId, plan, 3000\)[\s\S]*?sendWaypointRoute\(obj\.objectId/);
  assert.match(trackerSource, /const baseStart = groupPlan\.enabled\s*\? \{ \.\.\.start \}\s*: \{ \.\.\.start, rightM:/);
  assert.match(syncSource, /window\.liveTrackerCapabilities\.includes\(MISSION_SCENE_GROUP_CAPABILITY\)/);
  assert.match(syncSource, /if \(!partyKind \|\| partyKind === 'single'/);
  assert.match(syncSource, /groupSequence: true/);
  assert.match(syncSource, /_missionSceneValidateGroupFinalAck/);
  assert.match(syncSource, /window\.missionSceneGroupDebug = Object\.freeze/);
  assert.match(syncSource, /GAMissionSceneGroup\?\.isGroupSceneDebugCommand\?\.\(command\)/);
  assert.match(syncSource, /missionSceneGroupDebugWaiters\.has\(ackCommandId\)[\s\S]*?_trackerPendingClear\(ackCommandId\)[\s\S]*?_missionSceneGroupDebugHandleAck\(ack\)/);
});
