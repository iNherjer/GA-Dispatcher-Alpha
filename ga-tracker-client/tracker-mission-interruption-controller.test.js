const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('./tracker-mission-interruption-core.js');
const { createMissionInterruptionController } = require('./tracker-mission-interruption-controller.js');

function fixture(phase = 'enroute') {
  let clock = 1_800_000_000_000;
  let record = null;
  let history = [];
  let attached = true;
  let ready = false;
  const notifications = [];
  const rebuilds = [];
  const moves = [];
  const resumed = [];
  const authorityManager = {
    getExecutionSnapshot: () => ({ executionAuthority: 'tracker', missionId: 'm', runId: 'r', state: { phase, flags: {} } }),
    getExecutionInterruption: () => record,
    updateExecutionInterruption: request => {
      record = request.record === null ? null : core.normalize(request.record);
      if (request.historyEntry) history = core.normalizeHistory([...history, request.historyEntry]);
      return { ok: true, status: 'ok' };
    },
    getExecutionRuntimeContext: () => null
  };
  const controller = createMissionInterruptionController({
    authorityManager,
    now: () => clock,
    onChanged: reason => notifications.push(reason),
    simulatorAttached: () => attached,
    worldReady: () => ready,
    rebuild: current => { rebuilds.push(current.status); return { ok: true }; },
    setAircraftPosition: target => { moves.push(target); return { ok: true }; },
    onResumed: mode => resumed.push(mode)
  });
  const air = (over = {}) => ({ observedAt: clock, lat: 48.1, lon: 8.1, altFt: 4500, aglFt: 2500, hdg: 75, gsKts: 110,
    iasKts: 105, onGround: false, simRunning: 1, simPaused: false, inMenuOrMap: false, slewActive: false, engRpm: 2300, ...over });
  const intent = (name, role = 'efb') => controller.handleIntent({ intent: name, missionId: 'm', runId: 'r', controllerSession: { role } });
  return {
    controller, intent, air,
    get clock() { return clock; }, set clock(value) { clock = value; },
    get record() { return record; }, get history() { return history; },
    set attached(value) { attached = value; }, set ready(value) { ready = value; },
    notifications, rebuilds, moves, resumed
  };
}

test('airborne interruption: decision, cockpit rebuild, teleport and 5 NM zone dwell', async () => {
  const f = fixture();
  assert.equal(f.controller.observe(f.air()), false, 'no interruption, normal sample');
  f.attached = false;
  const created = f.controller.begin('simulator_disconnected', 'detach');
  assert.equal(created.zone.radiusNm, 5);
  assert.equal(f.record.status, 'awaiting_decision');
  assert.deepEqual(f.notifications, ['interruption:awaiting_decision']);

  // Mission intents are blocked; teleport is not offered before a decision.
  assert.equal((await f.intent('set_manifest_item')).error, 'mission_interrupted');
  assert.equal((await f.intent('resume_teleport')).error, 'mission_resume_teleport_unavailable');
  assert.equal(await f.intent('abort_mission'), null, 'abort passes through to the normal runtime path');

  // Decision before the simulator is back.
  f.clock += 600000;
  assert.equal((await f.intent('resume_mission')).ok, true);
  assert.equal(f.record.status, 'resuming');
  assert.deepEqual(f.rebuilds, [], 'nothing rebuilt without a simulator');
  assert.equal((await f.intent('resume_mission')).status, 'noop');

  // Simulator back on the ground at another airport, world map first.
  f.attached = true;
  f.controller.observe(f.air({ onGround: true, gsKts: 0, lat: 50, lon: 9 }));
  assert.deepEqual(f.rebuilds, []);
  f.ready = true;
  assert.equal(f.controller.observe(f.air({ onGround: true, gsKts: 0, lat: 50, lon: 9 })), true);
  assert.deepEqual(f.rebuilds, ['resuming']);
  assert.equal(f.record.status, 'awaiting_zone');

  // Teleport needs a running engine.
  f.controller.observe(f.air({ onGround: true, gsKts: 0, lat: 50, lon: 9, engRpm: 0 }));
  assert.equal((await f.intent('resume_teleport')).error, 'mission_resume_engine_not_running');
  f.controller.observe(f.air({ onGround: true, gsKts: 0, lat: 50, lon: 9, engRpm: 2100 }));
  const moved = await f.intent('resume_teleport');
  assert.equal(moved.ok, true);
  assert.deepEqual(f.moves, [{ lat: 48.1, lon: 8.1, altFt: 4500, hdg: 75, airspeedKts: 105 }]);

  // Inside the zone, but slewing does not count; then 10 s of real flight.
  assert.equal(f.controller.observe(f.air({ slewActive: true })), true);
  f.controller.observe(f.air({ lat: 48.12 }));
  f.clock += 9000;
  assert.equal(f.controller.observe(f.air({ lat: 48.13 })), true);
  f.clock += 1500;
  assert.equal(f.controller.observe(f.air({ lat: 48.14 })), false, 'the resuming sample is a normal mission sample');
  assert.equal(f.record, null);
  assert.deepEqual(f.resumed, ['zone']);
  assert.equal(f.history.length, 1);
  assert.equal(f.history[0].mode, 'zone');
  assert.equal(f.history[0].airborne, true);
  assert.equal(f.notifications.at(-1), 'interruption:resumed');
});

test('second interruption before reaching the zone asks again and keeps the original point', async () => {
  const f = fixture();
  f.controller.observe(f.air());
  f.controller.begin('simulator_disconnected', 'detach');
  f.ready = true;
  await f.intent('resume_mission');
  assert.equal(f.record.status, 'awaiting_zone');
  f.clock += 1000;
  f.controller.observe(f.air({ lat: 49, lon: 9 }));
  f.controller.begin('simulator_disconnected', 'detach-again');
  assert.equal(f.record.status, 'awaiting_decision');
  assert.equal(f.record.position.lat, 48.1, 'zone stays at the first interruption point');
  assert.equal(f.record.decidedAt, null);
});

test('tracker restart while flying continues automatically at the current position', () => {
  const f = fixture();
  f.controller.observe(f.air());
  f.controller.begin('tracker_restart', 'tracker-start');
  f.ready = true;
  f.clock += 30000;
  // ~0.9 NM further along after 30 s at 110 kt.
  assert.equal(f.controller.observe(f.air({ lat: 48.115 })), false);
  assert.equal(f.record, null);
  assert.deepEqual(f.resumed, ['auto']);
  assert.deepEqual(f.rebuilds, ['resuming'], 'scenes are still rebuilt after a tracker restart');
});

test('automatic continuation waits for the running cockpit before it resumes', () => {
  const f = fixture();
  f.controller.observe(f.air());
  f.controller.begin('simulator_disconnected', 'detach');
  f.clock += 10000;
  assert.equal(f.controller.observe(f.air()), true, 'not yet world-ready');
  assert.equal(f.record.status, 'resuming');
  assert.equal(f.record.decidedBy, 'auto');
  f.ready = true;
  assert.equal(f.controller.observe(f.air()), false);
  assert.equal(f.record, null);
  assert.deepEqual(f.resumed, ['auto']);
});

test('no interruption for planned runs', () => {
  const planned = fixture('planned');
  planned.controller.observe(planned.air());
  assert.equal(planned.controller.begin('simulator_disconnected', 'detach'), null);
  assert.equal(planned.record, null);
});

test('without a known position the run waits for a running cockpit and then continues', () => {
  const f = fixture('boarding');
  const created = f.controller.begin('tracker_restart', 'tracker-start');
  assert.equal(created.status, 'awaiting_decision');
  assert.equal(created.zone, null);
  // World map / menu samples keep it interrupted (no loading prompts there).
  assert.equal(f.controller.observe(f.air({ onGround: true, gsKts: 0, inMenuOrMap: true })), true);
  assert.equal(f.record.status, 'awaiting_decision');
  f.ready = true;
  assert.equal(f.controller.observe(f.air({ onGround: true, gsKts: 0 })), false, 'first cockpit sample continues');
  assert.equal(f.record, null);
  assert.deepEqual(f.resumed, ['auto']);
});

test('the last valid position of a started run is persisted, throttled', () => {
  const f = fixture('boarding');
  const writes = [];
  f.authority = null;
  const stored = [];
  const controller = require('./tracker-mission-interruption-controller.js').createMissionInterruptionController({
    authorityManager: {
      getExecutionSnapshot: () => ({ executionAuthority: 'tracker', missionId: 'm', runId: 'r', state: { phase: 'boarding', flags: {} } }),
      getExecutionInterruption: () => null,
      recordExecutionLastPosition: request => { writes.push(request.position); stored.push(request); return { ok: true }; }
    },
    now: () => f.clock
  });
  controller.observe(f.air({ onGround: true, gsKts: 0 }));
  controller.observe(f.air({ onGround: true, gsKts: 0, observedAt: f.clock + 1000 }));
  controller.observe(f.air({ onGround: true, gsKts: 0, inMenuOrMap: true, observedAt: f.clock + 2000 }));
  assert.equal(writes.length, 1, 'unchanged position within 30 s is not written again; menu samples never');
  controller.observe(f.air({ onGround: true, gsKts: 0, observedAt: f.clock + 31000 }));
  controller.observe(f.air({ onGround: false, observedAt: f.clock + 32000 }));
  assert.equal(writes.length, 3);
  assert.equal(writes[2].onGround, false);
  assert.equal(stored[0].runId, 'r');
});

test('a running cockpit continues without a button; the save point zone follows', () => {
  const f = fixture();
  f.controller.observe(f.air());
  f.attached = false;
  f.controller.begin('simulator_disconnected', 'detach');
  f.clock += 3_600_000; // long after the automatic-continuation window
  f.attached = true;
  // Ready-to-fly screen / World Map: not a running cockpit, nothing happens.
  assert.equal(f.controller.observe(f.air({ lat: 50, lon: 9 })), true);
  assert.equal(f.record.status, 'awaiting_decision');
  assert.deepEqual(f.rebuilds, []);
  // Slew samples are not a running flight either.
  f.ready = true;
  f.controller.observe(f.air({ lat: 50, lon: 9, slewActive: true }));
  assert.equal(f.record.status, 'awaiting_decision');
  // Cockpit at another place: continued, scenes rebuilt, the zone is the way back.
  assert.equal(f.controller.observe(f.air({ lat: 50, lon: 9 })), true);
  assert.equal(f.record.status, 'awaiting_zone');
  assert.equal(f.record.decidedBy, 'cockpit');
  assert.deepEqual(f.rebuilds, ['resuming']);
  // Air start at the save point: 10 s of real flight there resume the mission.
  f.controller.observe(f.air({ lat: 48.11 }));
  f.clock += 10_500;
  assert.equal(f.controller.observe(f.air({ lat: 48.12 })), false);
  assert.equal(f.record, null);
  assert.deepEqual(f.resumed, ['zone']);
});
