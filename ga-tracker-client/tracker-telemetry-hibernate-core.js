'use strict';

const DEFAULT_IDLE_ENTER_MS = 5 * 60 * 1000;
const DEFAULT_GROUND_SPEED_THRESHOLD_KTS = 5;
const DEFAULT_MENU_ZERO_EPSILON_DEG = 0.0001;
const DEFAULT_MSFS_MENU_LONGITUDE_DEG = 90;
const DEFAULT_MSFS_MENU_POSITION_EPSILON_DEG = 0.001;
const DEFAULT_PAUSE_EVENT_GRACE_MS = 2000;
const NON_WAKEABLE_HIBERNATE_REASONS = new Set([
  'invalid_position',
  'menu_position',
  'menu_zero',
  'sim_disconnected',
  'sim_stopped'
]);
const TELEMETRY_WAKE_COMMAND_TYPES = new Set([
  'aircraft_input_event_set',
  'aircraft_payload_get',
  'aircraft_payload_set',
  'aircraft_var_set',
  'mission_authority_acquire',
  'mission_authority_release',
  'mission_authority_takeover',
  'mission_lifecycle',
  'mission_snapshot_update',
  'tracker_telemetry_wake'
]);

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

function resolveSimPausedState(input = {}) {
  const now = Number.isFinite(Number(input.now)) ? Number(input.now) : Date.now();
  const pauseFlags = Number(input.pauseFlags) || 0;
  const pauseFlagsUpdatedAt = Number(input.pauseFlagsUpdatedAt) || 0;
  const eventGraceMs = Math.max(
    0,
    Number(input.eventGraceMs ?? DEFAULT_PAUSE_EVENT_GRACE_MS) || 0
  );
  const pauseVars = [input.simPausedA, input.simPausedB]
    .map(Number)
    .filter(Number.isFinite);
  const hasPauseVar = pauseVars.length > 0;
  const pausedFromVar = pauseVars.some(value => value > 0.5);
  const eventIsFresh = pauseFlagsUpdatedAt > 0
    && now - pauseFlagsUpdatedAt <= eventGraceMs;
  const pausedFromEvent = pauseFlags !== 0 && (!hasPauseVar || eventIsFresh);
  return pausedFromVar || pausedFromEvent;
}

function telemetryWakeReasonForCommand(command = {}) {
  const type = String(command?.type || '').trim().toLowerCase();
  if (!type) return '';
  if (type === 'tracker_telemetry_wake') {
    return String(command?.reason || 'app-open').trim().slice(0, 96) || 'app-open';
  }
  if (TELEMETRY_WAKE_COMMAND_TYPES.has(type)) return `app-command:${type}`;
  if (/^mission_(scene|smoke)_/.test(type)) return `app-command:${type}`;
  if (/^homebase_v1\.(preview|crew|hangar\.animation|object\.control|door_automation|ground\.)/.test(type)) {
    return `app-command:${type}`;
  }
  return '';
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
  let conditionsInitialized = false;
  let lastGroundIdle = false;
  let lastPaused = false;
  let lastValidPosition = false;

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

  const snapshot = (now, changed) => {
    const idleForMs = groundIdleSince === null ? 0 : Math.max(0, now - groundIdleSince);
    const pauseForMs = pauseIdleSince === null ? 0 : Math.max(0, now - pauseIdleSince);
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
      validPosition: lastValidPosition,
      shouldSendTelemetry: lastValidPosition && !hibernating,
      changed
    });
  };

  const resetIdleTimers = () => {
    groundIdleSince = null;
    pauseIdleSince = null;
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
        resetIdleTimers();
        conditionsInitialized = false;
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

        // Sobald eine ausloesende Regel endet, beginnt auch jede andere noch
        // erfuellte HIB-Regel von vorn. So fuehrt z. B. das Aufheben einer Pause
        // am weiterhin stehenden Flugzeug nicht direkt wieder in Hibernate.
        if (conditionsInitialized && (
          (lastGroundIdle && !groundIdle)
          || (lastPaused && !paused)
        )) {
          resetIdleTimers();
        }

        if (groundIdle && groundIdleSince === null) groundIdleSince = now;
        if (!groundIdle) groundIdleSince = null;
        if (paused && pauseIdleSince === null) pauseIdleSince = now;
        if (!paused) pauseIdleSince = null;

        const pauseExpired = pauseIdleSince !== null && now - pauseIdleSince >= idleEnterMs;
        const groundIdleExpired = groundIdleSince !== null && now - groundIdleSince >= idleEnterMs;
        if (pauseExpired) changed = transition('hibernate', 'paused', now);
        else if (groundIdleExpired) changed = transition('hibernate', 'ground_idle', now);
        else changed = transition('active', '', now);
        conditionsInitialized = true;
        lastGroundIdle = groundIdle;
        lastPaused = paused;
      }

      lastValidPosition = finitePosition && !menuPosition && !menuDetected;
      return snapshot(now, changed);
    },
    wake(input = {}) {
      const now = Number.isFinite(Number(input.now)) ? Number(input.now) : Date.now();
      const blockedReason = mode === 'hibernate' && NON_WAKEABLE_HIBERNATE_REASONS.has(reason)
        ? reason
        : '';
      if (blockedReason) {
        return Object.freeze({
          accepted: false,
          blockedReason,
          state: snapshot(now, false)
        });
      }
      resetIdleTimers();
      const changed = transition('active', '', now);
      return Object.freeze({
        accepted: true,
        blockedReason: '',
        wakeReason: String(input.reason || 'app-interaction').trim().slice(0, 96) || 'app-interaction',
        state: snapshot(now, changed)
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
  DEFAULT_PAUSE_EVENT_GRACE_MS,
  DEFAULT_GROUND_SPEED_THRESHOLD_KTS,
  DEFAULT_IDLE_ENTER_MS,
  DEFAULT_MENU_ZERO_EPSILON_DEG,
  DEFAULT_MSFS_MENU_LONGITUDE_DEG,
  DEFAULT_MSFS_MENU_POSITION_EPSILON_DEG,
  createTelemetryHibernateController,
  disconnectedTelemetryHibernateState,
  isFiniteGeoPosition,
  isMenuZeroPosition,
  isMsfsMenuPosition,
  resolveSimPausedState,
  telemetryWakeReasonForCommand
};
