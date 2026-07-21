'use strict';

const {
  SimConnectDataType,
  SimConnectPeriod,
  SimConnectConstants,
  RawBuffer
} = require('node-simconnect');
const catalog = require('./homebase-asset-catalog.js');

const OPEN_RADIUS_M = 18;
const CLOSE_RADIUS_M = 20;
const CLOSE_DELAY_MS = 1000;
const SCAN_RADIUS_M = 1000;
const USER_POLL_MS = 400;
const HANGAR_SCAN_MS = 1500;
const HANGAR_SCAN_SETTLE_MS = 450;
const SOURCE_FRESH_MS = 2500;
const REASSERT_COMMAND_MS = 2000;
const TARGET_MATCH_RADIUS_M = 30;

const DEF_USER = 8701;
const DEF_AVATAR = 8702;
const DEF_CURRENT = 8703;
const DEF_NEARBY_OBJECT = 8704;
const REQ_USER = 8751;
const REQ_AVATAR = 8752;
const REQ_CURRENT = 8753;
const REQ_NEARBY_OBJECT = 8754;
const DOOR_DEF_START = 8800;

// MSFS 2024 enum values not yet named by node-simconnect 4.0.0.
const SIMOBJECT_TYPE_ALL = 1;
const SIMOBJECT_TYPE_USER_AVATAR = 8;
const SIMOBJECT_TYPE_USER_CURRENT = 9;

function normalizeObjectLocalVariable(raw) {
  const simvar = String(raw || '').trim().toUpperCase();
  if (/^L:1:VFR_HOMEBASE_[A-Z0-9_]{1,100}$/.test(simvar)) return simvar;
  if (/^Z:VFR_HOMEBASE_[A-Z0-9_]{1,100}$/.test(simvar)) return simvar;
  return '';
}

function collectDoorControls(entries = catalog.assets) {
  const controls = [];
  for (const entry of entries) {
    const door = Array.isArray(entry?.controls)
      ? entry.controls.find((control) => String(control?.id || '').toLowerCase() === 'door')
      : null;
    const legacy = entry?.animation?.type === 'door' ? entry.animation.control : null;
    const control = door || (legacy ? {
      simvar: legacy.simvar,
      scope: legacy.scope,
      states: [
        { id: 'open', value: legacy.values?.open },
        { id: 'closed', value: legacy.values?.closed }
      ]
    } : null);
    if (!control || String(control.scope || '').toLowerCase() !== 'simobject') continue;
    const simvar = normalizeObjectLocalVariable(control.simvar);
    const openState = control.states?.find((state) => String(state?.id || '').toLowerCase() === 'open');
    const closedState = control.states?.find((state) => String(state?.id || '').toLowerCase() === 'closed');
    const openValue = Number(openState?.value ?? legacy?.values?.open);
    const closedValue = Number(closedState?.value ?? legacy?.values?.closed);
    if (!simvar || !Number.isFinite(openValue) || !Number.isFinite(closedValue) || openValue === closedValue) continue;
    controls.push({ title: entry.title, simvar, openValue, closedValue });
  }
  return controls;
}

function distanceMeters(a, b) {
  if (![a?.lat, a?.lon, b?.lat, b?.lon].every(Number.isFinite)) return Infinity;
  const rad = Math.PI / 180;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

function proximityZone(distanceM) {
  if (!Number.isFinite(distanceM)) return 'unknown';
  if (distanceM <= OPEN_RADIUS_M) return 'open';
  if (distanceM >= CLOSE_RADIUS_M) return 'close';
  return 'hold';
}

function finitePosition(lat, lon, altFt = null, extra = {}) {
  const position = { lat: Number(lat), lon: Number(lon), altFt: Number(altFt), at: Date.now(), ...extra };
  return Number.isFinite(position.lat) && Number.isFinite(position.lon) && (position.lat !== 0 || position.lon !== 0)
    ? position
    : null;
}

function nearestSource(sources, hangar, now = Date.now()) {
  let nearest = null;
  for (const source of sources) {
    if (!source || now - source.at > SOURCE_FRESH_MS) continue;
    const distanceM = distanceMeters(source, hangar);
    if (!nearest || distanceM < nearest.distanceM) nearest = { source, distanceM };
  }
  return nearest;
}

function advanceDoorAutomationState(rawRecord = {}, zone, now = Date.now()) {
  const record = {
    commandedState: 'unknown',
    lastCommandAt: 0,
    outsideSince: null,
    manualOverrideState: null,
    ...rawRecord
  };
  let automaticTarget = null;
  if (zone === 'open') {
    record.outsideSince = null;
    automaticTarget = 'open';
  } else if (zone === 'hold') {
    record.outsideSince = null;
  } else if (zone === 'close') {
    if (record.outsideSince == null) record.outsideSince = now;
    if (now - record.outsideSince >= CLOSE_DELAY_MS) automaticTarget = 'closed';
  }

  if (record.manualOverrideState) {
    if (automaticTarget === record.manualOverrideState) {
      const releasedState = record.manualOverrideState;
      record.manualOverrideState = null;
      record.commandedState = releasedState;
      record.lastCommandAt = now;
      return { record, automaticTarget, writeState: null, manualOverrideReleased: releasedState };
    }
    return { record, automaticTarget, writeState: null, manualOverrideReleased: null };
  }

  const writeState = automaticTarget
    && (record.commandedState !== automaticTarget || now - record.lastCommandAt >= REASSERT_COMMAND_MS)
    ? automaticTarget
    : null;
  return { record, automaticTarget, writeState, manualOverrideReleased: null };
}

function readFloat64(data) {
  if (typeof data?.readFloat64 === 'function') return data.readFloat64();
  if (typeof data?.readDouble === 'function') return data.readDouble();
  throw new Error('SimConnect-Datenpuffer hat keinen Float64-Leser.');
}

function readString256(data) {
  if (typeof data?.readString256 === 'function') return String(data.readString256() || '').trim();
  if (typeof data?.readString === 'function') return String(data.readString(256) || '').trim();
  throw new Error('SimConnect-Datenpuffer hat keinen String256-Leser.');
}

function createHomebaseDoorAutomation(handle, options = {}) {
  const log = typeof options.log === 'function' ? options.log : () => {};
  const controls = collectDoorControls(options.assets || catalog.assets);
  const controlsByTitle = new Map(controls.map((control) => [control.title, control]));
  const definitionsBySimvar = new Map();
  const hangars = new Map();
  const states = new Map();
  let enabled = options.enabled !== false;
  let lastUser = null;
  let lastAvatar = null;
  let lastCurrent = null;
  let dynamicSources = [];
  let scanBuffer = new Map();
  let hangarFinalizeTimer = null;
  let userTimer = null;
  let hangarTimer = null;
  let stopped = false;

  const definitionFor = (control) => {
    if (definitionsBySimvar.has(control.simvar)) return definitionsBySimvar.get(control.simvar);
    const definitionId = DOOR_DEF_START + definitionsBySimvar.size;
    handle.addToDataDefinition(definitionId, control.simvar, 'number', SimConnectDataType.FLOAT64);
    definitionsBySimvar.set(control.simvar, definitionId);
    return definitionId;
  };

  for (const control of controls) definitionFor(control);

  const writeState = (hangar, state, reason = 'automatic') => {
    const control = controlsByTitle.get(String(hangar?.title || ''));
    const objectId = Number(hangar?.objectId);
    if (!control || !Number.isFinite(objectId) || objectId <= 0) throw new Error('Keine instanzlokale Torsteuerung für dieses SimObject verfügbar.');
    const value = state === 'open' ? control.openValue : control.closedValue;
    const buffer = new RawBuffer(8);
    buffer.writeFloat64(value);
    handle.setDataOnSimObject(definitionFor(control), objectId, { buffer, arrayCount: 0, tagged: false });
    const record = states.get(objectId) || {};
    states.set(objectId, { ...record, commandedState: state, lastCommandAt: Date.now(), outsideSince: null });
    log(`HOMEBASE_DOOR_${state.toUpperCase()} objectId=${objectId} title="${hangar.title}" reason=${reason}`);
    return { objectId, title: hangar.title, state, value, simvar: control.simvar };
  };

  const evaluate = () => {
    if (!enabled || stopped) return;
    const now = Date.now();
    const sources = [lastUser, lastAvatar, lastCurrent, ...dynamicSources.map((source) => ({ ...source, at: now }))].filter(Boolean);
    for (const hangar of hangars.values()) {
      const nearest = nearestSource(sources, hangar, now);
      if (!nearest) continue;
      const objectId = Number(hangar.objectId);
      const record = states.get(objectId) || { commandedState: 'unknown', lastCommandAt: 0, outsideSince: null };
      const zone = proximityZone(nearest.distanceM);
      const transition = advanceDoorAutomationState(record, zone, now);
      states.set(objectId, transition.record);
      if (transition.manualOverrideReleased) {
        log(`HOMEBASE_DOOR_MANUAL_OVERRIDE_RELEASED objectId=${objectId} title="${hangar.title}" state=${transition.manualOverrideReleased} distance=${nearest.distanceM.toFixed(1)}m`);
      }
      if (transition.writeState) {
        const reason = transition.writeState === 'open'
          ? `${nearest.source.kind}:${nearest.distanceM.toFixed(1)}m`
          : `distance:${nearest.distanceM.toFixed(1)}m`;
        writeState(hangar, transition.writeState, reason);
      }
    }
  };

  const requestUsers = () => {
    if (stopped) return;
    try {
      handle.requestDataOnSimObject(REQ_USER, DEF_USER, Number(SimConnectConstants.OBJECT_ID_USER) || 0, SimConnectPeriod.ONCE, 0, 0, 0, 0);
      handle.requestDataOnSimObjectType(REQ_AVATAR, DEF_AVATAR, SCAN_RADIUS_M, SIMOBJECT_TYPE_USER_AVATAR);
      handle.requestDataOnSimObjectType(REQ_CURRENT, DEF_CURRENT, SCAN_RADIUS_M, SIMOBJECT_TYPE_USER_CURRENT);
    } catch (error) {
      log(`HOMEBASE_DOOR_USER_REQUEST_ERROR ${error?.message || error}`);
    }
  };

  const requestHangars = () => {
    if (stopped) return;
    scanBuffer = new Map();
    try {
      handle.requestDataOnSimObjectType(REQ_NEARBY_OBJECT, DEF_NEARBY_OBJECT, SCAN_RADIUS_M, SIMOBJECT_TYPE_ALL);
    } catch (error) {
      log(`HOMEBASE_DOOR_SCAN_ERROR ${error?.message || error}`);
      return;
    }
    clearTimeout(hangarFinalizeTimer);
    hangarFinalizeTimer = setTimeout(() => {
      hangars.clear();
      for (const [objectId, hangar] of scanBuffer) hangars.set(objectId, hangar);
      const activeIds = new Set(hangars.keys());
      for (const objectId of states.keys()) if (!activeIds.has(objectId)) states.delete(objectId);
      log(`HOMEBASE_DOOR_SCAN count=${hangars.size}`);
      evaluate();
    }, HANGAR_SCAN_SETTLE_MS);
  };

  handle.addToDataDefinition(DEF_USER, 'PLANE LATITUDE', 'degrees', SimConnectDataType.FLOAT64);
  handle.addToDataDefinition(DEF_USER, 'PLANE LONGITUDE', 'degrees', SimConnectDataType.FLOAT64);
  handle.addToDataDefinition(DEF_USER, 'PLANE ALTITUDE', 'feet', SimConnectDataType.FLOAT64);
  handle.addToDataDefinition(DEF_AVATAR, 'PLANE LATITUDE', 'degrees', SimConnectDataType.FLOAT64);
  handle.addToDataDefinition(DEF_AVATAR, 'PLANE LONGITUDE', 'degrees', SimConnectDataType.FLOAT64);
  handle.addToDataDefinition(DEF_AVATAR, 'PLANE ALTITUDE', 'feet', SimConnectDataType.FLOAT64);
  handle.addToDataDefinition(DEF_CURRENT, 'PLANE LATITUDE', 'degrees', SimConnectDataType.FLOAT64);
  handle.addToDataDefinition(DEF_CURRENT, 'PLANE LONGITUDE', 'degrees', SimConnectDataType.FLOAT64);
  handle.addToDataDefinition(DEF_CURRENT, 'PLANE ALTITUDE', 'feet', SimConnectDataType.FLOAT64);
  handle.addToDataDefinition(DEF_NEARBY_OBJECT, 'TITLE', null, SimConnectDataType.STRING256);
  handle.addToDataDefinition(DEF_NEARBY_OBJECT, 'PLANE LATITUDE', 'degrees', SimConnectDataType.FLOAT64);
  handle.addToDataDefinition(DEF_NEARBY_OBJECT, 'PLANE LONGITUDE', 'degrees', SimConnectDataType.FLOAT64);
  handle.addToDataDefinition(DEF_NEARBY_OBJECT, 'PLANE ALTITUDE', 'feet', SimConnectDataType.FLOAT64);

  const onSimObjectData = (recv) => {
    if (recv.requestID !== REQ_USER) return;
    try {
      lastUser = finitePosition(readFloat64(recv.data), readFloat64(recv.data), readFloat64(recv.data), { kind: 'Flugzeug', objectId: Number(recv.objectID ?? 0) });
      evaluate();
    } catch (error) {
      log(`HOMEBASE_DOOR_USER_DATA_ERROR ${error?.message || error}`);
    }
  };

  const onSimObjectDataByType = (recv) => {
    try {
      if (recv.requestID === REQ_AVATAR || recv.requestID === REQ_CURRENT) {
        const position = finitePosition(readFloat64(recv.data), readFloat64(recv.data), readFloat64(recv.data), {
          kind: recv.requestID === REQ_AVATAR ? 'Avatar' : 'Aktiver Benutzer', objectId: Number(recv.objectID ?? 0)
        });
        if (recv.requestID === REQ_AVATAR) lastAvatar = position;
        else lastCurrent = position;
        evaluate();
        return;
      }
      if (recv.requestID !== REQ_NEARBY_OBJECT) return;
      const title = readString256(recv.data);
      const position = finitePosition(readFloat64(recv.data), readFloat64(recv.data), readFloat64(recv.data), { title, objectId: Number(recv.objectID ?? 0) });
      if (!position || !controlsByTitle.has(title)) return;
      scanBuffer.set(position.objectId, position);
    } catch (error) {
      log(`HOMEBASE_DOOR_OBJECT_DATA_ERROR ${error?.message || error}`);
    }
  };

  handle.on('simObjectData', onSimObjectData);
  handle.on('simObjectDataByType', onSimObjectDataByType);
  requestUsers();
  requestHangars();
  userTimer = setInterval(requestUsers, USER_POLL_MS);
  hangarTimer = setInterval(requestHangars, HANGAR_SCAN_MS);
  userTimer.unref?.();
  hangarTimer.unref?.();

  return {
    setEnabled(value, setOptions = {}) {
      const nextEnabled = value !== false;
      const changed = enabled !== nextEnabled;
      enabled = nextEnabled;
      let resetManualOverrides = 0;
      if (changed || setOptions.resetManualOverrides === true) {
        for (const record of states.values()) {
          record.outsideSince = null;
          if (record.manualOverrideState) {
            record.manualOverrideState = null;
            resetManualOverrides += 1;
          }
        }
      }
      log(`HOMEBASE_DOOR_AUTOMATION enabled=${enabled ? 1 : 0} changed=${changed ? 1 : 0} resetOverrides=${resetManualOverrides}`);
      if (enabled) evaluate();
      return { enabled, changed, resetManualOverrides };
    },
    isEnabled: () => enabled,
    setDynamicSources(sources = []) {
      dynamicSources = (Array.isArray(sources) ? sources : []).map((source) => finitePosition(
        source?.lat, source?.lon, source?.altFt, { kind: String(source?.kind || 'Homebase-Person'), objectId: Number(source?.objectId || 0) }
      )).filter(Boolean);
      evaluate();
      return dynamicSources.length;
    },
    noteManualState(hangar, state) {
      const objectId = Number(hangar?.objectId);
      const normalizedState = String(state || '').toLowerCase();
      if (!Number.isFinite(objectId) || objectId <= 0 || !['open', 'closed'].includes(normalizedState)) {
        throw new Error('Manueller Hangartorstatus konnte keiner gültigen SimObject-Instanz zugeordnet werden.');
      }
      const record = states.get(objectId) || { commandedState: 'unknown', lastCommandAt: 0, outsideSince: null, manualOverrideState: null };
      record.commandedState = normalizedState;
      record.lastCommandAt = Date.now();
      record.manualOverrideState = enabled ? normalizedState : null;
      states.set(objectId, record);
      log(`HOMEBASE_DOOR_MANUAL_OVERRIDE objectId=${objectId} title="${hangar?.title || ''}" state=${normalizedState} active=${record.manualOverrideState ? 1 : 0}`);
      return { enabled, active: Boolean(record.manualOverrideState), state: normalizedState, objectId };
    },
    writeState,
    resolveTarget(input = {}) {
      const directId = Number(input.objectId);
      if (directId > 0 && hangars.has(directId)) return hangars.get(directId);
      const title = String(input.title || '');
      const point = { lat: Number(input.lat), lon: Number(input.lon) };
      let nearest = null;
      for (const hangar of hangars.values()) {
        if (title && hangar.title !== title) continue;
        const distanceM = distanceMeters(point, hangar);
        if (!nearest || distanceM < nearest.distanceM) nearest = { hangar, distanceM };
      }
      return nearest && nearest.distanceM <= TARGET_MATCH_RADIUS_M ? nearest.hangar : null;
    },
    snapshot: () => ({ enabled, hangars: [...hangars.values()].map((hangar) => ({ ...hangar })), states: [...states.entries()] }),
    stop() {
      stopped = true;
      clearInterval(userTimer);
      clearInterval(hangarTimer);
      clearTimeout(hangarFinalizeTimer);
      handle.removeListener?.('simObjectData', onSimObjectData);
      handle.removeListener?.('simObjectDataByType', onSimObjectDataByType);
    }
  };
}

module.exports = {
  OPEN_RADIUS_M,
  CLOSE_RADIUS_M,
  CLOSE_DELAY_MS,
  SOURCE_FRESH_MS,
  collectDoorControls,
  distanceMeters,
  proximityZone,
  finitePosition,
  nearestSource,
  advanceDoorAutomationState,
  createHomebaseDoorAutomation
};
