'use strict';

const DEFAULT_IDLE_ENTER_MS = 5 * 60 * 1000;
const DEFAULT_GROUND_SPEED_THRESHOLD_KTS = 5;
const DEFAULT_MENU_ZERO_EPSILON_DEG = 0.0001;
const DEFAULT_MSFS_MENU_LONGITUDE_DEG = 90;
const DEFAULT_MSFS_MENU_POSITION_EPSILON_DEG = 0.001;

function isFiniteGeoPosition(lat, lon) {
  return Number.isFinite(Number(lat))
    && Number.isFinite(Number(lon))
    && Math.abs(Number(lat)) <= 90
    && Math.abs(Number(lon)) <= 180;
}

function isMenuZeroPosition(lat, lon, epsilonDeg = DEFAULT_MENU_ZERO_EPSILON_DEG) {
  if (!isFiniteGeoPosition(lat, lon)) return false;
  const epsilon = Math.max(0, Number(epsilonDeg) || 0);
  return Math.abs(Number(lat)) <= epsilon && Math.abs(Number(lon)) <= epsilon;
}

function isMsfsMenuPosition(lat, lon, options = {}) {
  if (!isFiniteGeoPosition(lat, lon)) return false;
  if (isMenuZeroPosition(lat, lon, options.zeroEpsilonDeg)) return true;
  if (options.paused !== true) return false;
  const epsilon = Math.max(
    0,
    Number(options.positionEpsilonDeg ?? DEFAULT_MSFS_MENU_POSITION_EPSILON_DEG) || 0
  );
  return Math.abs(Number(lat)) <= epsilon
    && Math.abs(Number(lon) - DEFAULT_MSFS_MENU_LONGITUDE_DEG) <= epsilon;
}

function disconnectedTelemetryHibernateState(now = Date.now(), reason = 'sim_disconnected') {
  const since = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  return {
    mode: 'hibernate',
    hibernating: true,
    reason: String(reason || 'sim_disconnected'),
    since,
    groundIdleSince: null,
    idleForMs: 0,
    pauseIdleSince: null,
    pauseForMs: 0,
    validPosition: false,
    shouldSendTelemetry: false,
    changed: true
  };
}

function createTelemetryHibernateController(options = {}) {
  const idleEnterMs = Math.max(0, Number(options.idleEnterMs ?? DEFAULT_IDLE_ENTER_MS) || 0);
  const groundSpeedThresholdKts = Math.max(
    0,
    Number(options.groundSpeedThresholdKts ?? DEFAULT_GROUND_SPEED_THRESHOLD_KTS) || 0
  );
  const menuZeroEpsilonDeg = Math.max(
    0,
    Number(options.menuZeroEpsilonDeg ?? DEFAULT_MENU_ZERO_EPSILON_DEG) || 0
  );
  const menuPositionEpsilonDeg = Math.max(
    0,
    Number(options.menuPositionEpsilonDeg ?? DEFAULT_MSFS_MENU_POSITION_EPSILON_DEG) || 0
  );
  let mode = 'active';
  let reason = '';
  let since = null;
  let groundIdleSince = null;
  let pauseIdleSince = null;

  const transition = (nextMode, nextReason, now) => {
    const normalizedReason = String(nextReason || '');
    const changed = mode !== nextMode || reason !== normalizedReason;
    if (changed) {
      mode = nextMode;
      reason = normalizedReason;
      since = now;
    }
    return changed;
  };

  return Object.freeze({
    update(input = {}) {
      const now = Number.isFinite(Number(input.now)) ? Number(input.now) : Date.now();
      const lat = Number(input.lat);
      const lon = Number(input.lon);
      const menuZero = isMenuZeroPosition(lat, lon, menuZeroEpsilonDeg);
      const menuPosition = isMsfsMenuPosition(lat, lon, {
        paused: input.paused === true,
        zeroEpsilonDeg: menuZeroEpsilonDeg,
        positionEpsilonDeg: menuPositionEpsilonDeg
      });
      const finitePosition = isFiniteGeoPosition(lat, lon);
      const menuDetected = input.menuDetected === true;
      let changed = false;

      if (menuPosition || menuDetected || !finitePosition) {
        groundIdleSince = null;
        pauseIdleSince = null;
        const nextReason = menuZero
          ? 'menu_zero'
          : (menuPosition ? 'menu_position' : (menuDetected ? 'sim_stopped' : 'invalid_position'));
        changed = transition('hibernate', nextReason, now);
      } else {
        const onGround = input.onGround === true || Number(input.onGround) > 0.5;
        const paused = input.paused === true;
        const groundSpeedKts = Number(input.groundSpeedKts);
        const groundIdle = onGround
          && Number.isFinite(groundSpeedKts)
          && groundSpeedKts < groundSpeedThresholdKts;

        if (groundIdle && groundIdleSince === null) groundIdleSince = now;
        if (!groundIdle) groundIdleSince = null;
        if (paused && pauseIdleSince === null) pauseIdleSince = now;
        if (!paused) pauseIdleSince = null;

        const pauseExpired = pauseIdleSince !== null && now - pauseIdleSince >= idleEnterMs;
        const groundIdleExpired = groundIdleSince !== null && now - groundIdleSince >= idleEnterMs;
        if (pauseExpired) changed = transition('hibernate', 'paused', now);
        else if (groundIdleExpired) changed = transition('hibernate', 'ground_idle', now);
        else changed = transition('active', '', now);
      }

      const idleForMs = groundIdleSince === null ? 0 : Math.max(0, now - groundIdleSince);
      const pauseForMs = pauseIdleSince === null ? 0 : Math.max(0, now - pauseIdleSince);
      const validPosition = finitePosition && !menuPosition;
      const hibernating = mode === 'hibernate';
      return Object.freeze({
        mode,
        hibernating,
        reason,
        since,
        groundIdleSince,
        idleForMs,
        pauseIdleSince,
        pauseForMs,
        validPosition,
        shouldSendTelemetry: validPosition && !hibernating,
        changed
      });
    },
    getConfig() {
      return Object.freeze({
        idleEnterMs,
        groundSpeedThresholdKts,
        menuZeroEpsilonDeg,
        menuPositionEpsilonDeg
      });
    }
  });
}

module.exports = {
  DEFAULT_GROUND_SPEED_THRESHOLD_KTS,
  DEFAULT_IDLE_ENTER_MS,
  DEFAULT_MENU_ZERO_EPSILON_DEG,
  DEFAULT_MSFS_MENU_LONGITUDE_DEG,
  DEFAULT_MSFS_MENU_POSITION_EPSILON_DEG,
  createTelemetryHibernateController,
  disconnectedTelemetryHibernateState,
  isFiniteGeoPosition,
  isMenuZeroPosition,
  isMsfsMenuPosition
};
