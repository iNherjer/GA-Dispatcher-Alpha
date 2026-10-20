const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('./tracker-mission-interruption-core.js');

const T0 = 1_800_000_000_000;
const airborne = (over = {}) => ({ observedAt: T0, lat: 48.1, lon: 8.1, altFt: 4500, aglFt: 2500, hdg: 75, gsKts: 110, iasKts: 105,
  vsFpm: 0, onGround: false, simRunning: 1, simPaused: false, inMenuOrMap: false, slewActive: false, ...over });
const parked = (over = {}) => airborne({ altFt: 800, aglFt: 0, gsKts: 0, iasKts: 0, onGround: true, ...over });

test('only valid running-simulation samples count', () => {
  assert.equal(core.validSample(airborne()), true);
  for (const bad of [{ simPaused: true }, { inMenuOrMap: true }, { simRunning: 0 }, { slewActive: true },
    { lat: 0, lon: 0 }, { lat: 120 }, { onGround: undefined }]) {
    assert.equal(core.validSample(airborne(bad)), false, JSON.stringify(bad));
  }
  assert.equal(core.validSample(null), false);
});

test('started phases are interruptible; planned and closing runs are not', () => {
  assert.equal(core.interruptible({ phase: 'boarding', flags: {} }), true);
  assert.equal(core.interruptible({ phase: 'enroute', flags: {} }), true);
  for (const phase of ['planned', 'closing', 'closed']) assert.equal(core.interruptible({ phase, flags: {} }), false, phase);
  assert.equal(core.interruptible({ phase: 'end_ready', flags: { closingPending: true } }), false);
  assert.equal(core.interruptible(null), false);
});

test('airborne interruption creates a 5 NM zone, ground interruption a 1 NM zone', () => {
  const air = core.create({ phase: 'enroute', position: airborne(), now: T0 + 1000 });
  assert.equal(air.status, 'awaiting_decision');
  assert.deepEqual(air.zone, { lat: 48.1, lon: 8.1, radiusNm: 5, airborne: true });
  assert.equal(air.autoResumeUntil, T0 + core.AUTO_RESUME_GAP_MS);
  const ground = core.create({ phase: 'boarding', position: parked(), now: T0 });
  assert.deepEqual(ground.zone, { lat: 48.1, lon: 8.1, radiusNm: 1, airborne: false });
  const unknown = core.create({ phase: 'boarding', position: null, now: T0 });
  assert.equal(unknown.zone, null);
  assert.equal(unknown.autoResumeUntil, null);
  assert.deepEqual(core.normalize(JSON.parse(JSON.stringify(air))), air, 'persisted record round-trips');
  assert.equal(core.normalize({ ...air, schema: 'other' }), null);
  assert.equal(core.normalize({ ...air, status: 'bogus' }), null);
});

test('a short plausible gap may resume on its own, a simulator restart may not', () => {
  const record = core.create({ phase: 'enroute', position: airborne(), now: T0 });
  // 20 s later, 0.6 NM further along: SimConnect reconnect while the simulator kept flying.
  assert.equal(core.plausibleContinuation(record, airborne({ observedAt: T0 + 20000, lat: 48.11 }), T0 + 20000), true);
  // Parked at another airport after a restart.
  assert.equal(core.plausibleContinuation(record, parked({ observedAt: T0 + 30000, lat: 48.6 }), T0 + 30000), false);
  // Took off from the stand meanwhile: plausible when reachable in the elapsed time.
  const ground = core.create({ phase: 'boarding', position: parked(), now: T0 });
  assert.equal(core.plausibleContinuation(ground, airborne({ observedAt: T0 + 30000, lat: 48.105 }), T0 + 30000), true);
  assert.equal(core.plausibleContinuation(ground, parked({ observedAt: T0 + 30000, lat: 48.2 }), T0 + 30000), false, 'taxi speed on the ground');
  // Too far for the elapsed time.
  assert.equal(core.plausibleContinuation(record, airborne({ observedAt: T0 + 20000, lat: 48.6 }), T0 + 20000), false);
  // Gap too long.
  const late = T0 + core.AUTO_RESUME_GAP_MS + 1;
  assert.equal(core.plausibleContinuation(record, airborne({ observedAt: late }), late), false);
  // Menu/slew samples never resume.
  assert.equal(core.plausibleContinuation(record, airborne({ observedAt: T0 + 5000, slewActive: true }), T0 + 5000), false);
  // Decision already taken.
  assert.equal(core.plausibleContinuation(core.decide(record, { now: T0 }), airborne({ observedAt: T0 + 5000 }), T0 + 5000), false);
});

test('decision, rebuild and zone dwell follow the agreed order', () => {
  const record = core.create({ phase: 'enroute', position: airborne(), now: T0 });
  assert.equal(core.rebuilt(record, T0), null, 'no rebuild before a decision');
  const resuming = core.decide(record, { by: 'efb', now: T0 + 1 });
  assert.equal(resuming.status, 'resuming');
  assert.equal(resuming.decidedBy, 'efb');
  assert.equal(resuming.autoResumeUntil, null);
  assert.equal(core.decide(resuming, { now: T0 }), null, 'one decision only');
  const zone = core.rebuilt(resuming, T0 + 2);
  assert.equal(zone.status, 'awaiting_zone');

  // Outside, on the ground, in slew: never reached.
  assert.equal(core.evaluateZone(zone, airborne({ lat: 48.3 }), null, T0).inside, false);
  assert.equal(core.evaluateZone(zone, parked(), null, T0).inside, false, 'ground below an airborne zone does not count');
  assert.equal(core.evaluateZone(zone, airborne({ slewActive: true }), null, T0).inside, false);

  let step = core.evaluateZone(zone, airborne(), null, T0 + 10);
  assert.equal(step.inside, true);
  assert.equal(step.reached, false);
  step = core.evaluateZone(zone, airborne({ lat: 48.12 }), step.dwell, T0 + 5000);
  assert.equal(step.reached, false);
  step = core.evaluateZone(zone, airborne({ lat: 48.13 }), step.dwell, T0 + 10010);
  assert.equal(step.reached, true);
  // Leaving the zone resets the dwell.
  const left = core.evaluateZone(zone, airborne({ lat: 48.3 }), { since: T0 }, T0 + 20000);
  assert.equal(left.dwell, null);
  assert.ok(left.distanceNm > 5);

  const groundZone = core.rebuilt(core.decide(core.create({ phase: 'boarding', position: parked(), now: T0 }), { now: T0 }), T0);
  let ground = core.evaluateZone(groundZone, parked(), null, T0);
  ground = core.evaluateZone(groundZone, parked(), ground.dwell, T0 + core.GROUND_DWELL_MS);
  assert.equal(ground.reached, true);
  assert.equal(core.evaluateZone(groundZone, airborne(), null, T0).inside, false, 'a ground zone requires being on ground');

  const noPosition = core.rebuilt(core.decide(core.create({ phase: 'boarding', now: T0 }), { now: T0 }), T0);
  assert.equal(core.evaluateZone(noPosition, null, null, T0).reached, true, 'unknown position resumes after rebuild');
});

test('allowed actions shrink to the interruption choices', () => {
  const actions = ['abort_mission', 'set_manifest_item', 'start_mission', 'prepare_mission'];
  const record = core.create({ phase: 'enroute', position: airborne(), now: T0 });
  assert.deepEqual(core.filterAllowedActions(actions, record), ['abort_mission', 'resume_mission']);
  const resuming = core.decide(record, { now: T0 });
  assert.deepEqual(core.filterAllowedActions(actions, resuming), ['abort_mission']);
  assert.deepEqual(core.filterAllowedActions(actions, core.rebuilt(resuming, T0)), ['abort_mission', 'resume_teleport']);
  const ground = core.rebuilt(core.decide(core.create({ phase: 'boarding', position: parked(), now: T0 }), { now: T0 }), T0);
  assert.deepEqual(core.filterAllowedActions(actions, ground), ['abort_mission']);
  assert.deepEqual(core.filterAllowedActions(actions, null), actions);
  assert.deepEqual(core.filterAllowedActions(['set_manifest_item'], record), ['resume_mission'], 'abort only when the run allows it');
});

test('teleport target keeps a safe height and a flyable speed', () => {
  const record = core.create({ phase: 'enroute', position: airborne({ altFt: 1200, aglFt: 300, iasKts: 40, gsKts: 45 }), now: T0 });
  assert.deepEqual(core.teleportTarget(record), { lat: 48.1, lon: 8.1, altFt: 1400, hdg: 75, airspeedKts: 60 });
  assert.equal(core.teleportTarget(core.create({ position: parked(), now: T0 })), null);
});

test('projection and history are bounded and public', () => {
  const record = core.create({ phase: 'enroute', position: airborne(), now: T0 });
  const projection = core.publicProjection(record, [{ since: 1, resumedAt: 2, cause: 'tracker_restart', airborne: false, mode: 'auto' }]);
  assert.equal(projection.status, 'awaiting_decision');
  assert.equal(projection.airborne, true);
  assert.equal(projection.count, 2);
  assert.equal(projection.position.iasKts, undefined, 'only the presentation fields leave the tracker');
  assert.equal(core.publicProjection(null), null);
  const history = core.normalizeHistory(Array.from({ length: 12 }, (_, index) => ({ since: index, resumedAt: index + 1, mode: 'teleport' })));
  assert.equal(history.length, 8);
  assert.equal(core.historyEntry(record, 'zone', T0 + 9).mode, 'zone');
  assert.equal(core.historyEntry(record, 'zone', T0 + 9).airborne, true);
  assert.ok(Math.abs(core.bearingDeg(48, 8, 49, 8) - 0) < 0.01);
  assert.ok(Math.abs(core.haversineNm(48, 8, 49, 8) - 60) < 0.2);
});

test('before take-off and after landing the airport is the ground reference', () => {
  const departure = { kind: 'departure', lat: 48.02, lon: 7.83, label: 'EDTF' };
  const record = core.create({ phase: 'boarding', position: parked({ lat: 48.025, lon: 7.835 }), anchor: departure, now: T0 });
  assert.deepEqual(record.zone, { lat: 48.02, lon: 7.83, radiusNm: core.AIRPORT_RADIUS_NM, airborne: false, kind: 'departure', label: 'EDTF' });
  assert.deepEqual(core.normalize(JSON.parse(JSON.stringify(record))).zone, record.zone, 'anchor survives persistence');
  // Another stand on the same airport counts, another airport does not.
  const zone = core.rebuilt(core.decide(record, { now: T0 }), T0);
  let step = core.evaluateZone(zone, parked({ lat: 48.03, lon: 7.82 }), null, T0);
  step = core.evaluateZone(zone, parked({ lat: 48.03, lon: 7.82 }), step.dwell, T0 + core.GROUND_DWELL_MS);
  assert.equal(step.reached, true);
  assert.equal(core.evaluateZone(zone, parked({ lat: 48.3, lon: 8.4 }), null, T0).inside, false);
  // An airborne interruption keeps its own point.
  assert.equal(core.create({ phase: 'enroute', position: airborne(), anchor: departure, now: T0 }).zone.airborne, true);
  // Older runs without a position continue only at their airport (or when airborne).
  const unknown = core.create({ phase: 'boarding', anchor: departure, now: T0 });
  assert.equal(unknown.zone.kind, 'departure');
  assert.equal(core.plausibleContinuation(unknown, parked({ lat: 48.021, lon: 7.831 }), T0), true);
  assert.equal(core.plausibleContinuation(unknown, parked({ lat: 50, lon: 9 }), T0), false, 'parked at another airport: decision needed');
  assert.equal(core.normalize({ ...unknown, anchor: { kind: 'bogus', lat: 1, lon: 1 } }).anchor, null);
});

test('air start altitude is the save point altitude, at least 500 ft AGL, always rounded up', () => {
  const at = position => core.airStartAltitudeFt(core.create({ phase: 'enroute', position: airborne(position), now: T0 }));
  assert.equal(at({ altFt: 4501, aglFt: 2500 }), 4600);
  assert.equal(at({ altFt: 4500, aglFt: 2500 }), 4500, 'already on 100 ft stays');
  assert.equal(at({ altFt: 4410.2, aglFt: 2500 }), 4500);
  assert.equal(at({ altFt: 1322, aglFt: 320 }), 1600, 'low over terrain: lifted to 500 ft AGL (1502), then up');
  assert.equal(core.airStartAltitudeFt(core.create({ phase: 'boarding', position: parked(), now: T0 })), null, 'ground: no air start');
  const projection = core.publicProjection(core.create({ phase: 'enroute', position: airborne({ altFt: 6612 }), now: T0 }));
  assert.equal(projection.zone.airStartAltFt, 6700);
});
