const assert = require('node:assert/strict');
const test = require('node:test');
const {
  DEFAULT_GROUND_SPEED_THRESHOLD_KTS,
  DEFAULT_IDLE_ENTER_MS,
  createTelemetryHibernateController,
  disconnectedTelemetryHibernateState,
  isMenuZeroPosition,
  isMsfsMenuPosition
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
