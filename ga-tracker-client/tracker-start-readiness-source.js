'use strict';
const { isMsfsMenuPosition } = require('./tracker-telemetry-hibernate-core');
const { START_READINESS_MAX_AGE_MS } = require('./tracker-mission-start-readiness');

// A separate, read-only SimConnect connection. Every datum used by the start
// gate belongs to one required-field packet, never the optional GPS bundle.
const FIELDS = [
  ['CAMERA STATE', 'Enum', 'cameraState'],
  ['IS SLEW ACTIVE', 'Bool', 'slew'],
  ['PLANE LATITUDE', 'degrees', 'lat'],
  ['PLANE LONGITUDE', 'degrees', 'lon'],
  ['PLANE ALTITUDE', 'feet', 'altFt'],
  ['SIM ON GROUND', 'Bool', 'ground'],
  ['GROUND VELOCITY', 'knots', 'gsKts'],
  ['PLANE HEADING DEGREES TRUE', 'degrees', 'hdg']
];
function createStartReadinessSource({ open, float64Type, secondPeriod, onSample,
  now = Date.now, log = () => {}, schedule = setTimeout, cancel = clearTimeout, gapMonitor = null }) {
  let stopped = false, generation = 0, handle = null, retry = null;
  let lastError = null, snapshot = null;
  const invalidate = reason => {
    snapshot = null;
    gapMonitor?.reset();
    onSample(null);
    if (reason !== lastError) log(`MISSION_START_SOURCE status=unavailable reason=${reason}`);
    lastError = reason;
  };
  const connect = async () => {
    const token = ++generation;
    let connection;
    try {
      connection = (await open('VFR-Multitool Mission Start Readiness', 5)).handle;
      if (stopped || token !== generation) { connection.close(); return; }
      handle = connection;
      gapMonitor?.reset();
      let sim = null, paused = null, latest = null, failed = false;
      const emit = () => {
        if (stopped || token !== generation || failed || !latest) return;
        // System events can revoke permission immediately, but must not refresh
        // the age of an older position/ground packet.
        snapshot = { ...latest, simRunning: sim, simPaused: paused !== false,
          inMenuOrMap: sim !== 1 || [9,10,11,12,13,14,19,27,29,30,33].includes(latest.cameraState) };
        onSample(snapshot);
      };
      const lost = reason => {
        if (stopped || token !== generation || failed) return;
        failed = true; generation++; handle = null; invalidate(reason);
        try { connection.close(); } catch (_) {}
        retry = schedule(() => { retry = null; void connect(); }, 5000);
      };
      connection.on('close', () => lost('connection_closed'));
      connection.on('error', error => lost(error?.message || 'connection_error'));
      const sends = new Set();
      connection.on('exception', packet => {
        if (sends.has(packet.sendId)) lost('simconnect_' + (packet.exceptionName || packet.exception));
      });
      connection.on('systemState', packet => {
        if (packet.requestID !== 2 || stopped || token !== generation) return;
        sim = packet.dataInteger === 1 ? 1 : 0; emit();
      });
      connection.on('event', packet => {
        if (stopped || token !== generation) return;
        if (packet.clientEventId === 3) paused = packet.data !== 0;
        else if (packet.clientEventId === 4) sim = 1;
        else if (packet.clientEventId === 5) sim = 0;
        else return;
        emit();
      });
      connection.on('simObjectData', packet => {
        if (stopped || token !== generation || packet.requestID !== 1) return;
        try {
          if (packet.defineID !== 1 || packet.defineCount !== FIELDS.length
            || !Number.isSafeInteger(packet.objectID) || packet.objectID < 0 || packet.objectID > 0xffffffff
            || (packet.entryNumber !== undefined && packet.entryNumber !== 1)
            || (packet.outOf !== undefined && packet.outOf !== 1)
            || packet.data?.remaining?.() !== FIELDS.length * 8) throw Error('packet_identity_or_size');
          const read = packet.data.readFloat64 || packet.data.readDouble;
          if (typeof read !== 'function') throw Error('packet_reader');
          const values = {};
          for (const [, , key] of FIELDS) {
            values[key] = read.call(packet.data);
            if (!Number.isFinite(values[key])) throw Error('packet_value');
          }
          if (!Number.isInteger(values.cameraState) || values.cameraState < 0 || values.cameraState > 33
            || ![0,1].includes(values.slew) || ![0,1].includes(values.ground)) throw Error('packet_enum');
          latest = { observedAt: now(), cameraState: values.cameraState, slewActive: values.slew === 1,
            lat: values.lat, lon: values.lon, altFt: values.altFt, hdg: values.hdg,
            onGround: values.ground === 1, gsKts: values.gsKts };
          if (lastError !== null) log('MISSION_START_SOURCE status=receiving');
          lastError = null;
          try { gapMonitor?.notePacket(); } catch (_) {}
          emit();
        } catch (error) { latest = null; invalidate(error.message); }
      });
      for (const [name, units] of FIELDS) sends.add(connection.addToDataDefinition(1, name, units, float64Type));
      sends.add(connection.requestSystemState(2, 'Sim'));
      sends.add(connection.subscribeToSystemEvent(3, 'Pause_EX1'));
      sends.add(connection.subscribeToSystemEvent(4, 'SimStart'));
      sends.add(connection.subscribeToSystemEvent(5, 'SimStop'));
      sends.add(connection.requestDataOnSimObject(1, 1, 0, secondPeriod, 0, 0, 0, 0));
      log('MISSION_START_SOURCE status=connected source=independent-required-packet');
    } catch (error) {
      if (stopped || token !== generation) return;
      generation++; handle = null; invalidate(error?.message || 'connect_failed');
      try { connection?.close(); } catch (_) {}
      retry = schedule(() => { retry = null; void connect(); }, 5000);
    }
  };
  void connect();
  return { position() {
    const s = snapshot;
    if (!s || now() - s.observedAt < 0 || now() - s.observedAt > START_READINESS_MAX_AGE_MS || s.simRunning !== 1
      || s.simPaused || s.slewActive || s.inMenuOrMap || s.cameraState < 2 || s.cameraState > 8
      || Math.abs(s.lat) > 90 || Math.abs(s.lon) > 180 || isMsfsMenuPosition(s.lat, s.lon, {paused:true})) return null;
    return { lat:s.lat, lon:s.lon, alt:Math.round(s.altFt), hdg:s.hdg };
  }, stop() {
    if (stopped) return;
    stopped = true; generation++;
    if (retry !== null) cancel(retry);
    const connection = handle; handle = null; snapshot = null; onSample(null);
    try { connection?.close(); } catch (_) {}
  } };
}
module.exports = { createStartReadinessSource, FIELDS };
