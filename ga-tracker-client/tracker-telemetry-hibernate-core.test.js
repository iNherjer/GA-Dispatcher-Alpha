const assert = require('node:assert/strict');
const test = require('node:test');
const {
  DEFAULT_GROUND_SPEED_THRESHOLD_KTS,
  DEFAULT_IDLE_ENTER_MS,
  createTelemetryHibernateController,
  disconnectedTelemetryHibernateState,
  isMenuZeroPosition,
  isMsfsMenuPosition,
  resolveSimPausedState,
  telemetryWakeReasonForCommand
} = require('./tracker-telemetry-hibernate-core');

test('MSFS menu zero position enters hibernate immediately and wakes at a valid position', () => {
  const controller = createTelemetryHibernateController();
  const menu = controller.update({ now: 1000, lat: 0, lon: 0, onGround: true, groundSpeedKts: 0 });
  assert.equal(menu.mode, 'hibernate');
  assert.equal(menu.reason, 'menu_zero');
  assert.equal(menu.shouldSendTelemetry, false);
  assert.equal(isMenuZeroPosition(0.00005, -0.00005), true);

  const airport = controller.update({ now: 1500, lat: 48.27917, lon: 8.42833, onGround: true, groundSpeedKts: 0 });
  assert.equal(airport.mode, 'active');
  assert.equal(airport.groundIdleSince, 1500);
  assert.equal(airport.shouldSendTelemetry, true);
});

test('paused MSFS menu telemetry near 0N 90E hibernates despite implausible flight values', () => {
  const controller = createTelemetryHibernateController();
  const menu = controller.update({
    now: 2000,
    lat: -0.00002,
    lon: 90.0003,
    onGround: false,
    groundSpeedKts: 252,
    paused: true,
    menuDetected: false
  });
  assert.equal(isMsfsMenuPosition(-0.00002, 90.0003, { paused: true }), true);
  assert.equal(menu.mode, 'hibernate');
  assert.equal(menu.reason, 'menu_position');
  assert.equal(menu.shouldSendTelemetry, false);

  const realFlight = createTelemetryHibernateController().update({
    now: 2000,
    lat: -0.00002,
    lon: 90.0003,
    onGround: false,
    groundSpeedKts: 252,
    paused: false
  });
  assert.equal(realFlight.mode, 'active');
  assert.equal(realFlight.shouldSendTelemetry, true);
});

test('ground idle enters hibernate after five minutes below 5 kt', () => {
  const controller = createTelemetryHibernateController();
  const input = { lat: 48.27917, lon: 8.42833, onGround: true, groundSpeedKts: 4.9 };
  assert.equal(DEFAULT_IDLE_ENTER_MS, 300000);
  assert.equal(DEFAULT_GROUND_SPEED_THRESHOLD_KTS, 5);
  assert.equal(controller.update({ ...input, now: 0 }).mode, 'active');
  assert.equal(controller.update({ ...input, now: 299999 }).mode, 'active');
  const sleeping = controller.update({ ...input, now: 300000 });
  assert.equal(sleeping.mode, 'hibernate');
  assert.equal(sleeping.reason, 'ground_idle');
  assert.equal(sleeping.idleForMs, 300000);
  assert.equal(sleeping.shouldSendTelemetry, false);
});

test('airborne state or 5 kt wakes relay telemetry immediately', () => {
  const controller = createTelemetryHibernateController({ idleEnterMs: 1000 });
  const base = { lat: 48.27917, lon: 8.42833, onGround: true, groundSpeedKts: 0 };
  controller.update({ ...base, now: 10 });
  assert.equal(controller.update({ ...base, now: 1010 }).mode, 'hibernate');

  const moving = controller.update({ ...base, now: 1011, groundSpeedKts: 5 });
  assert.equal(moving.mode, 'active');
  assert.equal(moving.shouldSendTelemetry, true);

  controller.update({ ...base, now: 2000 });
  assert.equal(controller.update({ ...base, now: 3000 }).mode, 'hibernate');
  const airborne = controller.update({ ...base, now: 3001, onGround: false });
  assert.equal(airborne.mode, 'active');
  assert.equal(airborne.shouldSendTelemetry, true);
});

test('five minutes of pause hibernates implausible in-flight telemetry and unpause wakes it', () => {
  const controller = createTelemetryHibernateController();
  const paused = {
    lat: 48.5,
    lon: 8.7,
    onGround: false,
    groundSpeedKts: 252,
    paused: true
  };
  assert.equal(controller.update({ ...paused, now: 100 }).mode, 'active');
  assert.equal(controller.update({ ...paused, now: 300099 }).mode, 'active');
  const sleeping = controller.update({ ...paused, now: 300100 });
  assert.equal(sleeping.mode, 'hibernate');
  assert.equal(sleeping.reason, 'paused');
  assert.equal(sleeping.pauseForMs, 300000);

  const awake = controller.update({ ...paused, now: 300101, paused: false });
  assert.equal(awake.mode, 'active');
  assert.equal(awake.pauseIdleSince, null);
  assert.equal(awake.shouldSendTelemetry, true);
});

test('fresh pause events bridge SimVar lag but stale event flags cannot hold the tracker paused', () => {
  assert.equal(resolveSimPausedState({
    now: 1000,
    simPausedA: 0,
    simPausedB: 0,
    pauseFlags: 1,
    pauseFlagsUpdatedAt: 500
  }), true);
  assert.equal(resolveSimPausedState({
    now: 4000,
    simPausedA: 0,
    simPausedB: 0,
    pauseFlags: 1,
    pauseFlagsUpdatedAt: 500
  }), false);
  assert.equal(resolveSimPausedState({
    now: 4000,
    simPausedA: 1,
    pauseFlags: 0,
    pauseFlagsUpdatedAt: 0
  }), true);
  assert.equal(resolveSimPausedState({
    now: 4000,
    simPausedA: NaN,
    simPausedB: NaN,
    pauseFlags: 1,
    pauseFlagsUpdatedAt: 500
  }), true);
});

test('explicit SimStop and disconnected states stay visible to status consumers', () => {
  const controller = createTelemetryHibernateController();
  const stopped = controller.update({
    now: 50,
    lat: 48.27917,
    lon: 8.42833,
    onGround: true,
    groundSpeedKts: 0,
    menuDetected: true
  });
  assert.equal(stopped.mode, 'hibernate');
  assert.equal(stopped.reason, 'sim_stopped');

  const menuFlags = createTelemetryHibernateController().update({
    now: 60,
    lat: 48.27917,
    lon: 8.42833,
    onGround: false,
    groundSpeedKts: 100,
    paused: true,
    menuDetected: true
  });
  assert.equal(menuFlags.mode, 'hibernate');
  assert.equal(menuFlags.reason, 'sim_stopped');

  const disconnected = disconnectedTelemetryHibernateState(75);
  assert.equal(disconnected.mode, 'hibernate');
  assert.equal(disconnected.reason, 'sim_disconnected');
  assert.equal(disconnected.shouldSendTelemetry, false);
});

test('an app wake interrupts ground or pause hibernate and restarts both timers', () => {
  const controller = createTelemetryHibernateController({ idleEnterMs: 1000 });
  const idle = {
    lat: 48.27917,
    lon: 8.42833,
    onGround: true,
    groundSpeedKts: 0,
    paused: true
  };
  controller.update({ ...idle, now: 10 });
  assert.equal(controller.update({ ...idle, now: 1010 }).mode, 'hibernate');

  const wake = controller.wake({ now: 1100, reason: 'mission-start' });
  assert.equal(wake.accepted, true);
  assert.equal(wake.state.mode, 'active');
  assert.equal(wake.state.groundIdleSince, null);
  assert.equal(wake.state.pauseIdleSince, null);

  const restarted = controller.update({ ...idle, now: 1101 });
  assert.equal(restarted.mode, 'active');
  assert.equal(restarted.groundIdleSince, 1101);
  assert.equal(restarted.pauseIdleSince, 1101);
  assert.equal(controller.update({ ...idle, now: 2100 }).mode, 'active');
  assert.equal(controller.update({ ...idle, now: 2101 }).mode, 'hibernate');
});

test('ending pause resets the already-running ground timer as well', () => {
  const controller = createTelemetryHibernateController({ idleEnterMs: 1000 });
  const idle = { lat: 48.27917, lon: 8.42833, onGround: true, groundSpeedKts: 0 };
  controller.update({ ...idle, paused: true, now: 0 });
  assert.equal(controller.update({ ...idle, paused: true, now: 1000 }).mode, 'hibernate');

  const unpaused = controller.update({ ...idle, paused: false, now: 1001 });
  assert.equal(unpaused.mode, 'active');
  assert.equal(unpaused.groundIdleSince, 1001);
  assert.equal(unpaused.pauseIdleSince, null);
  assert.equal(controller.update({ ...idle, paused: false, now: 2000 }).mode, 'active');
});

test('menu and invalid-position hibernate cannot be woken into useless telemetry', () => {
  const menu = createTelemetryHibernateController();
  menu.update({ now: 10, lat: 0, lon: 90, paused: true, groundSpeedKts: 250 });
  const blockedMenu = menu.wake({ now: 11, reason: 'app-open' });
  assert.equal(blockedMenu.accepted, false);
  assert.equal(blockedMenu.blockedReason, 'menu_position');
  assert.equal(blockedMenu.state.mode, 'hibernate');

  const invalid = createTelemetryHibernateController();
  invalid.update({ now: 20, lat: NaN, lon: NaN });
  assert.equal(invalid.wake({ now: 21 }).accepted, false);
});

test('sim-affecting app commands request a wake while local-only commands do not', () => {
  assert.equal(telemetryWakeReasonForCommand({ type: 'tracker_telemetry_wake', reason: 'app-open' }), 'app-open');
  assert.equal(telemetryWakeReasonForCommand({ type: 'mission_authority_acquire' }), 'app-command:mission_authority_acquire');
  assert.equal(telemetryWakeReasonForCommand({ type: 'mission_scene_boarding' }), 'app-command:mission_scene_boarding');
  assert.equal(telemetryWakeReasonForCommand({ type: 'aircraft_payload_set' }), 'app-command:aircraft_payload_set');
  assert.equal(telemetryWakeReasonForCommand({ type: 'homebase_v1.preview.set' }), 'app-command:homebase_v1.preview.set');
  assert.equal(telemetryWakeReasonForCommand({ type: 'homebase_v1.hangar.animation.set' }), 'app-command:homebase_v1.hangar.animation.set');
  assert.equal(telemetryWakeReasonForCommand({ type: 'homebase_v1.capabilities' }), '');
  assert.equal(telemetryWakeReasonForCommand({ type: 'efb_checklist_library.store' }), '');
});
