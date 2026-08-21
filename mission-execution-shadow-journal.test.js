'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const core = require('./mission-execution-core.js');
const journalCore = require('./mission-execution-shadow-journal.js');

function bundle(options = {}) {
  const phase = options.phase || 'planned';
  const cargoStatus = options.cargoStatus || 'pending';
  const signatureScope = options.signatureScope || null;
  const onGround = options.onGround !== false;
  return {
    version: 2,
    missionId: 'apt-event-replay',
    adapter: 'apt',
    savedAt: Number(options.savedAt || 1000),
    missionState: { currentMissionData: { missionId: 'apt-event-replay', missionStory: 'Private mission narrative' } },
    runtime: {
      version: 1,
      missionId: 'apt-event-replay',
      startPhase: options.startPhase || (phase === 'planned' ? 'planned' : (phase === 'boarding' ? 'boarding' : 'boarded')),
      runtime: {
        missionId: 'apt-event-replay',
        phase,
        active: options.active === true,
        closingPending: options.closingPending === true,
        startedAt: options.started === true ? 900 : 0,
        waitingFarewellDeboarding: options.waitingFarewell === true,
        deboardingAfterFarewellStarted: options.farewellComplete === true,
        farewellSpeechStarted: options.waitingFarewell === true,
        farewellSpeechComplete: options.farewellComplete === true
      },
      cargoManifest: {
        version: 6,
        key: 'manifest-apt-event-replay',
        dispatchSignature: signatureScope ? { scope: signatureScope, by: 'Private Pilot' } : null,
        items: [
          {
            id: 'cargo-one',
            itemType: 'cargo',
            storyName: 'Private cargo narrative',
            required: true,
            status: cargoStatus,
            weightLbs: 14,
            deliverAtDestination: true
          }
        ]
      },
      flightRecorder: {
        hadAirbornePhase: options.airborne === true,
        airborneEvidenceSec: options.airborne === true ? 60 : 0
      },
      lastLiveFlightData: {
        onGround,
        gsKts: Number(options.gsKts ?? (onGround ? 0 : 110)),
        simPaused: false,
        inMenuOrMap: false
      },
      complianceInspection: options.compliance || null
    }
  };
}

function advance(current, snapshot, at) {
  const result = journalCore.advance(current, snapshot, { occurredAt: at });
  assert.ok(result);
  return result;
}

test('normal APT lifecycle becomes a deterministic event replay without legacy drift', () => {
  let current = journalCore.create(bundle());
  let result = advance(current, bundle({ phase: 'boarded', startPhase: 'boarded', cargoStatus: 'loaded', signatureScope: 'departure' }), 1100);
  assert.deepEqual(result.legacyDriftFields, []);
  current = result.journal;
  result = advance(current, bundle({ phase: 'active', active: true, started: true, cargoStatus: 'loaded', signatureScope: 'departure' }), 1200);
  assert.deepEqual(result.legacyDriftFields, []);
  current = result.journal;
  result = advance(current, bundle({ phase: 'active', active: true, started: true, airborne: true, onGround: false, cargoStatus: 'loaded', signatureScope: 'departure' }), 1300);
  assert.deepEqual(result.legacyDriftFields, []);
  current = result.journal;
  result = advance(current, bundle({ phase: 'end_ready', active: true, started: true, airborne: true, onGround: true, gsKts: 0, cargoStatus: 'loaded', signatureScope: 'departure' }), 1400);
  assert.deepEqual(result.legacyDriftFields, []);
  current = result.journal;
  result = advance(current, bundle({ phase: 'end_ready', active: true, started: true, airborne: true, onGround: true, gsKts: 0, cargoStatus: 'unloaded', signatureScope: 'arrival' }), 1500);
  assert.deepEqual(result.legacyDriftFields, []);
  current = result.journal;
  result = advance(current, bundle({ phase: 'closing', closingPending: true, started: true, airborne: true, onGround: true, gsKts: 0, cargoStatus: 'unloaded', signatureScope: 'arrival' }), 1600);
  assert.deepEqual(result.legacyDriftFields, []);
  current = result.journal;
  result = journalCore.finalize(current, bundle({ phase: 'closing', closingPending: true, started: true, airborne: true, onGround: true, gsKts: 0, cargoStatus: 'unloaded', signatureScope: 'arrival' }), { occurredAt: 1700 });

  assert.equal(result.state.phase, 'closed');
  assert.equal(result.state.flags.closed, true);
  assert.deepEqual(result.bundle.events.map(event => event.type), [
    'PREPARE_REQUESTED',
    'EFFECT_ACKNOWLEDGED',
    'BOARDING_STARTED',
    'CARGO_STATE_CHANGED',
    'LOAD_CONFIRMED',
    'BOARDING_CONFIRMED',
    'MISSION_STARTED',
    'AIRBORNE',
    'TOUCHDOWN',
    'GROUND_STILL',
    'CARGO_STATE_CHANGED',
    'UNLOAD_CONFIRMED',
    'CLOSE_REQUESTED',
    'FAREWELL_COMPLETED',
    'MISSION_CLOSED'
  ]);
  assert.equal(result.bundle.events.length, new Set(result.bundle.events.map(event => event.eventId)).size);
  const serializedBundle = JSON.stringify(result.bundle);
  assert.match(serializedBundle, /Private Pilot/);
  assert.match(serializedBundle, /Private cargo narrative/);
  assert.doesNotMatch(serializedBundle, /Private mission narrative/);
});

test('skipped APT snapshots synthesize prerequisite transitions and duplicate snapshots add no events', () => {
  const initial = journalCore.create(bundle());
  const active = bundle({ phase: 'active', active: true, started: true, airborne: true, onGround: false, cargoStatus: 'loaded', signatureScope: 'departure' });
  const first = advance(initial, active, 2000);
  assert.deepEqual(first.bundle.events.map(event => event.type), [
    'PREPARE_REQUESTED',
    'EFFECT_ACKNOWLEDGED',
    'BOARDING_STARTED',
    'CARGO_STATE_CHANGED',
    'LOAD_CONFIRMED',
    'BOARDING_CONFIRMED',
    'MISSION_STARTED',
    'AIRBORNE'
  ]);
  assert.deepEqual(first.legacyDriftFields, []);
  const duplicate = advance(first.journal, active, 2100);
  assert.equal(duplicate.bundle.events.length, first.bundle.events.length);
  assert.deepEqual(duplicate.acceptedEvents, []);
  assert.equal(duplicate.stateHash, first.stateHash);
});

test('serialized journal and transported execution bundle recover the same replay', () => {
  const active = bundle({ phase: 'active', active: true, started: true, airborne: true, onGround: false, cargoStatus: 'loaded', signatureScope: 'departure' });
  const first = advance(journalCore.create(bundle()), active, 3000);
  const restoredJournal = journalCore.normalizeJournal(JSON.parse(JSON.stringify(first.journal)));
  const recoveredJournal = journalCore.recover(JSON.parse(JSON.stringify(first.bundle)), active);
  assert.ok(restoredJournal);
  assert.ok(recoveredJournal);
  assert.equal(core.replay(journalCore.executionBundle(restoredJournal)).stateHash, first.stateHash);
  assert.equal(core.replay(journalCore.executionBundle(recoveredJournal)).stateHash, first.stateHash);
  const afterReload = advance(recoveredJournal, active, 3100);
  assert.equal(afterReload.bundle.events.length, first.bundle.events.length);
});

test('farewell wait and a skipped completion snapshot remain drift-free before close', () => {
  const ready = bundle({
    phase: 'end_ready', active: true, started: true, airborne: true, onGround: true,
    cargoStatus: 'unloaded', signatureScope: 'arrival'
  });
  let result = advance(journalCore.create(ready), bundle({
    phase: 'end_ready', active: true, started: true, airborne: true, onGround: true,
    cargoStatus: 'unloaded', signatureScope: 'arrival', waitingFarewell: true
  }), 3200);
  assert.deepEqual(result.acceptedEvents, ['CLOSE_REQUESTED']);
  assert.deepEqual(result.legacyDriftFields, []);
  result = advance(result.journal, bundle({
    phase: 'closing', closingPending: true, started: true, airborne: true, onGround: true,
    cargoStatus: 'unloaded', signatureScope: 'arrival'
  }), 3210);
  assert.deepEqual(result.acceptedEvents, ['FAREWELL_COMPLETED']);
  assert.deepEqual(result.legacyDriftFields, []);
});

test('compliance revisions and release gates replay exactly before closing', () => {
  const ready = bundle({
    phase: 'end_ready', active: true, started: true, airborne: true, onGround: true,
    cargoStatus: 'unloaded', signatureScope: 'arrival'
  });
  let result = advance(journalCore.create(ready), bundle({
    phase: 'inspection', active: true, started: true, airborne: true, onGround: true,
    cargoStatus: 'unloaded', signatureScope: 'arrival',
    compliance: { selected: true, phase: 'evidence_open', revision: 4, inspectorsWaiting: true }
  }), 3300);
  assert.deepEqual(result.acceptedEvents, ['COMPLIANCE_EVENT']);
  assert.deepEqual(result.legacyDriftFields, []);
  result = advance(result.journal, bundle({
    phase: 'closing', closingPending: true, started: true, airborne: true, onGround: true,
    cargoStatus: 'unloaded', signatureScope: 'arrival',
    compliance: { selected: true, phase: 'released', revision: 7, released: true, releasedAt: 3310 }
  }), 3310);
  assert.deepEqual(result.acceptedEvents, ['COMPLIANCE_EVENT', 'CLOSE_REQUESTED', 'FAREWELL_COMPLETED']);
  assert.deepEqual(result.legacyDriftFields, []);
  assert.equal(result.state.workflows.complianceInspection.revision, 7);
  assert.equal(result.state.workflows.complianceInspection.released, true);
});

test('a new planned run with the same mission id cannot inherit a closed journal', () => {
  let result = advance(
    journalCore.create(bundle()),
    bundle({ phase: 'boarded', startPhase: 'boarded', cargoStatus: 'loaded', signatureScope: 'departure' }),
    3500
  );
  result = advance(result.journal, bundle({ phase: 'active', active: true, started: true, cargoStatus: 'loaded', signatureScope: 'departure' }), 3510);
  const closingSnapshot = bundle({ phase: 'closing', closingPending: true, started: true, cargoStatus: 'unloaded', signatureScope: 'arrival' });
  // Seed an admissible terminal state directly; this test is about run separation, not arrival gates.
  const closedJournal = journalCore.recover(
    core.createExecutionBundle(closingSnapshot, {
      events: [{ eventId: 'same-id-close', type: 'MISSION_CLOSED', sequence: 1 }]
    }),
    closingSnapshot
  );
  const restarted = advance(closedJournal, bundle(), 3600);
  assert.equal(restarted.state.phase, 'planned');
  assert.equal(restarted.bundle.events.length, 0);
  assert.equal(restarted.state.flags.closed, false);
});

test('browser and Node journal modules create byte-equivalent replay bundles', () => {
  const payloadSource = fs.readFileSync(path.join(__dirname, 'mission-payload-core.js'), 'utf8');
  const complianceSource = fs.readFileSync(path.join(__dirname, 'mission-compliance-domain-core.js'), 'utf8');
  const coreSource = fs.readFileSync(path.join(__dirname, 'mission-execution-core.js'), 'utf8');
  const journalSource = fs.readFileSync(path.join(__dirname, 'mission-execution-shadow-journal.js'), 'utf8');
  const context = vm.createContext({ console });
  vm.runInContext(payloadSource, context, { filename: 'mission-payload-core.js' });
  vm.runInContext(complianceSource, context, { filename: 'mission-compliance-domain-core.js' });
  vm.runInContext(coreSource, context, { filename: 'mission-execution-core.js' });
  vm.runInContext(journalSource, context, { filename: 'mission-execution-shadow-journal.js' });
  const target = bundle({ phase: 'active', active: true, started: true, airborne: true, onGround: false, cargoStatus: 'loaded', signatureScope: 'departure' });
  const nodeResult = journalCore.advance(journalCore.create(bundle()), target, { occurredAt: 4000 });
  const browserResult = context.GAMissionExecutionShadowJournal.advance(
    context.GAMissionExecutionShadowJournal.create(JSON.parse(JSON.stringify(bundle()))),
    JSON.parse(JSON.stringify(target)),
    { occurredAt: 4000 }
  );
  assert.equal(core.canonicalStringify(browserResult.bundle), core.canonicalStringify(nodeResult.bundle));
  assert.equal(browserResult.stateHash, nodeResult.stateHash);
});
