import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const adapters = require('../mission-resume-adapters-core.js');

const cases = [
  ['apt', {}, { currentMissionData: { missionId: 'm', missionType: 'apt' } }],
  ['poi', { poiProgress: { satisfied: false } }, { currentMissionData: { missionId: 'm', isPOI: true } }],
  ['survey_pattern', { poiProgress: { surveyPattern: { legIndex: 2 } } }, {}],
  ['poi_chain', { poiProgress: { poiChain: { index: 3 } } }, {}],
  ['training', { poiProgress: { trainingProcedure: { step: 4 } } }, {}],
  ['bush_pickup', { bushProgress: { status: 'return_home' } }, {}],
  ['sar_heli', { poiProgress: { sarHeli: { patientLoaded: true } } }, {}]
];

for (const [expected, runtime, missionState] of cases) {
  const snapshot = { missionId: 'm', runtime: { missionId: 'm' }, ...runtime };
  const descriptor = adapters.createDescriptor(snapshot, missionState);
  assert.equal(descriptor.primaryAdapter, expected, expected);
}

const descriptor = adapters.createDescriptor({
  missionId: 'm',
  runtime: { missionId: 'm' },
  cargoManifest: { key: 'cargo' },
  complianceInspection: { phase: 'arrival' },
  flightRecorder: { active: true },
  comfort: { score: 90 }
}, { currentMissionData: { missionId: 'm' } });
assert.deepEqual(descriptor.facets, ['cargo', 'compliance', 'flight_recorder', 'passenger_comfort']);

const valid = adapters.validateBundle({
  version: 2,
  missionId: 'm',
  descriptor,
  missionState: { currentMissionData: { missionId: 'm' } },
  runtime: { missionId: 'm', runtime: { missionId: 'm' } }
});
assert.equal(valid.ok, true);
assert.equal(adapters.validateBundle({ ...valid, version: 1 }).ok, false);
assert.equal(adapters.validateBundle({ version: 2, missionId: 'a', descriptor, missionState: {}, runtime: { missionId: 'b' } }).error, 'resume_mission_mismatch');

console.log('mission-resume-adapters selftest: ok');
