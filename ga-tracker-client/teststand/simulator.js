'use strict';
const { EventEmitter } = require('node:events');
const { RawBuffer, SimConnectDataType: T, SimConnectPeriod: P } = require('node-simconnect');
const position = p => ({ 'PLANE LATITUDE': p.latitude, 'PLANE LONGITUDE': p.longitude, 'PLANE ALTITUDE': p.altitude, 'PLANE HEADING DEGREES TRUE': p.heading || 0 });
class Simulator extends EventEmitter {
  constructor() {
    super();
    this.definitions = new Map(); this.subscriptions = new Map(); this.systemEvents = new Map(); this.events = new Map();
    this.objects = new Map(); this.journal = []; this.serial = 0; this.objectId = 1000; this.connected = false;
    this.delayMs = 30; this.fault = ''; this.flight = null;
    this.vars = { 'PLANE LATITUDE': 48.0208, 'PLANE LONGITUDE': 7.8342, 'PLANE ALTITUDE': 800,
      'PLANE ALT ABOVE GROUND': 0, 'SIM ON GROUND': 1, 'BRAKE PARKING POSITION': 1,
      'G FORCE': 1, 'GENERAL ENG RPM:1': 700, 'AMBIENT TEMPERATURE': 18, 'AMBIENT VISIBILITY': 30000,
      'TITLE': 'Teststand Cessna 172', 'ATC MODEL': 'C172', 'ATC TYPE': 'Cessna',
      'EMPTY WEIGHT': 1660, 'FUEL TOTAL QUANTITY WEIGHT': 240, 'FUEL WEIGHT PER GALLON': 6, 'PAYLOAD STATION COUNT': 4,
      'PAYLOAD STATION WEIGHT:1': 170 };
    this.timer = setInterval(() => this.tick(0.1), 100); this.timer.unref();
  }
  log(kind, details = {}) { const row = { seq: ++this.serial, at: new Date().toISOString(), kind, ...details }; this.journal.push(row); if (this.journal.length > 2000) this.journal.shift(); this.emit('journal', row); return row.seq; }
  value(name, objectID = 0) {
    const key = name.toUpperCase(); const obj = objectID ? this.objects.get(objectID) : this.vars;
    if (!obj) throw new Error('teststand_unknown_object');
    if (key === 'TOTAL WEIGHT') return this.value('EMPTY WEIGHT') + this.value('FUEL TOTAL QUANTITY WEIGHT') + Object.entries(this.vars).filter(([k]) => k.startsWith('PAYLOAD STATION WEIGHT:')).reduce((n, [, v]) => n + v, 0);
    return obj[key] ?? (key === 'TITLE' ? obj.title : 0);
  }
  addToDataDefinition(id, name, units, type) { const defs = this.definitions.get(id) || []; defs.push({ name, units, type }); this.definitions.set(id, defs); return 0; }
  requestDataOnSimObject(requestID, definitionID, objectID, period) {
    if (period === P.NEVER) { this.subscriptions.delete(requestID); return 0; }
    const request = { requestID, definitionID, objectID };
    if (period !== P.ONCE) this.subscriptions.set(requestID, request);
    else this.respond('read', () => this.sendData(request));
    return 0;
  }
  sendData(request) {
    if (!this.connected || (this.fault === 'telemetry' && this.subscriptions.has(request.requestID))) return;
    const defs = this.definitions.get(request.definitionID); if (!defs) throw new Error('teststand_unknown_definition');
    if (this.fault === 'payload-read' && defs.some(d => d.name.toUpperCase() === 'TITLE')) return;
    const data = new RawBuffer(defs.reduce((n, d) => n + (d.type === T.STRING256 ? 256 : d.type === T.INT32 ? 4 : 8), 0));
    for (const d of defs) { const v = this.value(d.name, request.objectID); if (d.type === T.STRING256) data.writeString256(String(v)); else if (d.type === T.INT32) data.writeInt32(v); else if (d.type === T.FLOAT64) data.writeFloat64(v); else throw new Error('teststand_unsupported_read_type'); }
    data.setOffset(0); this.emit('simObjectData', { ...request, data });
  }
  respond(kind, action, details = {}) {
    const sendId = this.log(kind, details);
    if (this.fault === kind) { this.log('response_dropped', { sendId, operation: kind }); return sendId; }
    setTimeout(() => { if (!this.connected) return; try { action(); } catch (err) { this.emit('exception', { sendId, exceptionName: err.message }); } }, this.delayMs);
    return sendId;
  }
  setDataOnSimObject(definitionID, objectID, data) {
    const defs = this.definitions.get(definitionID); if (!defs) throw new Error('teststand_unknown_definition');
    const target = objectID ? this.objects.get(objectID) : this.vars; if (!target) throw new Error('teststand_unknown_object');
    const operation = defs.some(d => d.name.startsWith('PAYLOAD STATION')) ? 'payload-write' : 'set';
    return this.respond(operation, () => {
      if (Array.isArray(data)) {
        if (defs[0].type === T.WAYPOINT) { target.route = data.map(p => ({ ...p })); this.log('waypoints', { objectID, points: target.route }); }
        else if (defs[0].type === T.INITPOSITION) Object.assign(target, position(data[0]));
        else throw new Error('teststand_unsupported_array');
      } else {
        const reader = new RawBuffer(Buffer.from(data.buffer.getBuffer()));
        for (const d of defs) {
          if (![T.FLOAT64, T.INT32].includes(d.type)) throw new Error('teststand_unsupported_write_type');
          target[d.name.toUpperCase()] = d.type === T.INT32 ? reader.readInt32() : reader.readFloat64();
        }
      }
      this.log('applied', { operation, objectID, definitionID });
    }, { objectID, definitionID, variables: defs.map(d => d.name) });
  }
  aICreateSimulatedObject(title, initialPosition, requestID) {
    return this.respond('spawn', () => {
      const objectID = ++this.objectId; this.objects.set(objectID, { ...position(initialPosition), title });
      this.emit('assignedObjectID', { requestID, objectID }); this.systemEvent('ObjectAdded', objectID);
      this.log('spawned', { objectID, title });
    }, { requestID, title, position: initialPosition });
  }
  aICreateNonATCAircraft(title, tail, pos, requestID) { return this.aICreateSimulatedObject(title, pos, requestID); }
  aIRemoveObject(objectID, requestID) { return this.respond('remove', () => { if (!this.objects.delete(objectID)) throw new Error('teststand_unknown_object'); this.systemEvent('ObjectRemoved', objectID); this.log('removed', { objectID }); }, { requestID, objectID }); }
  subscribeToSystemEvent(id, name) { this.systemEvents.set(id, name); return 0; }
  systemEvent(name, data = 0) { for (const [clientEventId, event] of this.systemEvents) if (event === name) this.emit(name.startsWith('Object') ? 'eventAddRemove' : 'event', { clientEventId, data }); }
  requestSystemState(requestID, name) { return this.respond('system-state', () => this.emit('systemState', { requestID, dataInteger: name === 'Sim' ? 1 : 0 })); }
  mapClientEventToSimEvent(id, name) { this.events.set(id, name); return 0; }
  transmitClientEvent(objectID, id, value) {
    const event = this.events.get(id) || String(id);
    this.log('sim-event', { objectID, event, value });
    if (event === 'PARKING_BRAKES') this.vars['BRAKE PARKING POSITION'] = this.vars['BRAKE PARKING POSITION'] ? 0 : 1;
    else if (event === 'PARKING_BRAKE_SET') this.vars['BRAKE PARKING POSITION'] = value ? 1 : 0;
    else if (!/^(FREEZE_|TOGGLE_AIRCRAFT_EXIT|EXIT_)/.test(event)) this.log('unsupported-event', { event });
    return 0;
  }
  transmitClientEventEx(objectID, id, group, flags, value) { return this.transmitClientEvent(objectID, id, value); }
  requestDataOnSimObjectType() { return 0; } // No ambient AI traffic in this scenario.
  // Aircraft-specific B: input events are deliberately not offered by this generic C172 fixture.
  connect() { this.connected = true; this.log('connected'); return { handle: this }; }
  disconnect() { this.connected = false; this.flight = null; this.subscriptions.clear(); this.log('disconnected'); this.emit('close'); }
  close() { clearInterval(this.timer); }
  tick(seconds) {
    if (this.flight && !this.vars['IS PAUSED']) {
      const f = this.flight; f.elapsed = Math.min(f.duration, f.elapsed + seconds); const t = f.elapsed / f.duration;
      for (const key of ['PLANE LATITUDE', 'PLANE LONGITUDE', 'PLANE ALTITUDE', 'PLANE ALT ABOVE GROUND']) this.vars[key] = f.from[key] + (f.to[key] - f.from[key]) * t;
      if (t >= 1) { this.flight = null; this.vars['VERTICAL SPEED'] = 0; this.log('segment-complete'); }
    }
    for (const obj of this.objects.values()) {
      const p = obj.route?.[0]; if (!p) continue;
      const dist = Math.hypot((p.latitude - obj['PLANE LATITUDE']) * 60, (p.longitude - obj['PLANE LONGITUDE']) * 60 * Math.cos(p.latitude * Math.PI / 180));
      const t = dist ? Math.min(1, (p.speed || 3) * seconds / 3600 / dist) : 1;
      obj['PLANE LATITUDE'] += (p.latitude - obj['PLANE LATITUDE']) * t; obj['PLANE LONGITUDE'] += (p.longitude - obj['PLANE LONGITUDE']) * t;
      if (t === 1) obj.route.shift();
    }
    for (const request of this.subscriptions.values()) this.sendData(request);
  }
  control(input) {
    const action = input.action;
    if (action === 'fault') { if (!['', 'spawn', 'remove', 'payload-read', 'payload-write', 'telemetry'].includes(input.value)) throw new Error('invalid_fault'); this.fault = input.value; }
    else if (action === 'pause') { this.vars['IS PAUSED'] = input.value ? 1 : 0; this.vars['SIM IS PAUSED'] = this.vars['IS PAUSED']; this.systemEvent('Pause', this.vars['IS PAUSED']); }
    else if (action === 'stop') { this.flight = null; }
    else if (action === 'position' || action === 'fly') {
      const lat = Number(input.lat), lon = Number(input.lon), alt = Number(input.alt), agl = Number(input.agl), speed = Number(input.speed);
      if (![lat, lon, alt, agl, speed].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || agl < 0 || speed < 0 || speed > 600) throw new Error('invalid_position');
      const duration = Number(input.duration);
      if (action === 'fly' && (!Number.isFinite(duration) || duration < 1 || duration > 7200)) throw new Error('invalid_duration');
      const to = { 'PLANE LATITUDE': lat, 'PLANE LONGITUDE': lon, 'PLANE ALTITUDE': alt, 'PLANE ALT ABOVE GROUND': agl };
      this.vars['SIM ON GROUND'] = input.onGround ? 1 : 0; this.vars['BRAKE PARKING POSITION'] = input.parkingBrake ? 1 : 0;
      this.vars['GENERAL ENG RPM:1'] = speed > 10 ? 2300 : 700; this.vars['GROUND VELOCITY'] = speed; this.vars['AIRSPEED INDICATED'] = speed;
      this.vars['PLANE TOUCHDOWN NORMAL VELOCITY'] = input.onGround ? 3 : 0;
      this.flight = null;
      if (action === 'fly') {
        this.flight = { from: { ...this.vars }, to, duration, elapsed: 0 };
        this.vars['VERTICAL SPEED'] = (alt - this.vars['PLANE ALTITUDE']) / duration * 60;
        const dy = lat - this.vars['PLANE LATITUDE'], dx = (lon - this.vars['PLANE LONGITUDE']) * Math.cos(lat * Math.PI / 180);
        this.vars['PLANE HEADING DEGREES TRUE'] = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
      } else { Object.assign(this.vars, to); this.vars['VERTICAL SPEED'] = 0; this.systemEvent('PositionChanged'); }
    } else throw new Error('unknown_action');
    this.log('control', input);
  }
  snapshot() { return { connected: this.connected, vars: this.vars, flight: this.flight, fault: this.fault, objects: [...this.objects].map(([id, obj]) => ({ id, ...obj })), journal: this.journal.slice(-100) }; }
}
module.exports = { Simulator };
