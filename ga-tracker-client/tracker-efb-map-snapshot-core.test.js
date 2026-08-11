'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { projectTrackerMapSnapshot } = require('./tracker-efb-map-snapshot-core');

function activeRun() {
  return {
    missionId: 'mission-route-1',
    runId: 'run-route-1',
    revision: 7,
    updatedAt: 1234,
    resumeBundle: {
      version: 2,
      mapProfile: {
        version: 1,
        terrainAvailable: true,
        totalDistanceNm: 38,
        points: [
          { lat: 48.2792, lon: 8.4283, elevFt: 2201, distNM: 0 },
          { lat: 48.38, lon: 8.62, elevFt: 2860, distNM: 12 },
          { lat: 48.51, lon: 8.82, elevFt: 1720, distNM: 24 },
          { lat: 48.6899, lon: 9.2219, elevFt: 1276, distNM: 38 }
        ]
      },
      missionState: {
        currentMissionData: {
          missionTitle: 'Nicht im Kartenvertrag ausgeben',
          missionStory: 'Diese Geschichte ist nicht fuer das EFB-Kartenpayload bestimmt.',
          cruiseAltitudeFt: 4500,
          targetName: 'Zielgebiet',
          targetLat: 48.4,
          targetLon: 8.7,
          routeWaypoints: [
            { id: 'dep', name: 'EDTW', lat: 48.2792, lng: 8.4283, elevationFt: 2201 },
            { id: 'poi', name: 'Korridor', lat: 48.4, lon: 8.7, isPOI: true },
            { id: 'arr', name: 'EDDS', lat: 48.6899, lon: 9.2219, elevFt: 1276 }
          ],
          poiChain: {
            points: [
              { name: 'Punkt 1', lat: 48.35, lon: 8.55 },
              { name: 'Punkt 2', lat: 48.4, lon: 8.7 }
            ]
          }
        }
      }
    }
  };
}

test('map snapshot projects a bounded route and live navigation without narrative data', () => {
  const snapshot = projectTrackerMapSnapshot(activeRun(), { lat: 48.33, lon: 8.52, alt: 3100 });
  assert.equal(snapshot.schema, 'ga.map-snapshot.v1');
  assert.equal(snapshot.missionId, 'mission-route-1');
  assert.equal(snapshot.revision, 7);
  assert.equal(snapshot.route.waypoints.length, 3);
  assert.equal(snapshot.route.legs.length, 2);
  assert.ok(snapshot.route.totalDistanceNm > 30);
  assert.ok(snapshot.navigation.distanceToNextNm > 0);
  assert.ok(snapshot.navigation.progress >= 0 && snapshot.navigation.progress <= 1);
  assert.equal(snapshot.profile.cruiseAltitudeFt, 4500);
  assert.equal(snapshot.profile.terrainAvailable, true);
  assert.equal(snapshot.profile.mode, 'tracker-terrain');
  assert.equal(snapshot.profile.points.length, 4);
  assert.equal(snapshot.profile.points[0].name, 'EDTW');
  assert.equal(snapshot.profile.points.at(-1).name, 'EDDS');
  assert.equal(snapshot.missionGeometry.poiChain.length, 2);
  assert.equal(JSON.stringify(snapshot).includes('Geschichte'), false);
  assert.equal(JSON.stringify(snapshot).includes('missionStory'), false);
});

test('map snapshot keeps a planned profile when an older bundle has no terrain payload', () => {
  const run = activeRun();
  delete run.resumeBundle.mapProfile;
  const snapshot = projectTrackerMapSnapshot(run, { lat: 48.33, lon: 8.52, alt: 3100 });
  assert.equal(snapshot.profile.terrainAvailable, false);
  assert.equal(snapshot.profile.mode, 'planned-with-endpoint-elevation');
  assert.equal(snapshot.profile.points.length, 3);
});

test('map snapshot rejects runs without a persisted route bundle', () => {
  assert.equal(projectTrackerMapSnapshot(null), null);
  assert.equal(projectTrackerMapSnapshot({ missionId: 'm', runId: 'r', resumeBundle: {} }), null);
});
