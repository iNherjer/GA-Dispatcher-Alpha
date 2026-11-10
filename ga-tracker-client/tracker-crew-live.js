'use strict';
// Crew live traffic: MSFS 2024 does not expose multiplayer aircraft via SimConnect.
// Every tracker of a crew sends its own position to the crew room on the Cloudflare
// relay and receives the other crew aircraft (field test 09.11.2026).
//
// - Ticket from ga-proxy (membership checked there), room = sha256('crew:' + CREW).
// - Sends only while somebody else listens: another crew tracker every 2 s (warnings),
//   only app viewers every 5 s (map), nobody: nothing. Respects the "share flight" switch.
// - Received crew aircraft become traffic contacts {id:'crew:<pid>', crew:1, ...}.
const crypto = require('node:crypto');
const { requestJson } = require('./tracker-navcom-preferences');

const DEFAULT_TICKET_URL = 'https://ga-proxy.einherjer.workers.dev/api/crew-presence-v1/';
const DEFAULT_RELAY_URL = 'wss://ga-relay.einherjer.workers.dev/crew';
const FAST_MS = 2000;
const SLOW_MS = 5000;
const CONTACT_TTL_MS = 15000;
const TICKET_MARGIN_MS = 5 * 60 * 1000;
const RECONNECT_MIN_MS = 5000;
const RECONNECT_MAX_MS = 120000;
const NM_PER_DEG = 60;

function crewRoomKey(crew) {
  return crypto.createHash('sha256').update('crew:' + String(crew || '').trim().toUpperCase()).digest('hex');
}

function ticketPayload(ticket) {
  try { return JSON.parse(Buffer.from(String(ticket).split('.')[0], 'base64url').toString('utf8')); } catch (_) { return null; }
}

// Dead reckoning from the receive time to `at` (bounded, ground contacts stay).
function extrapolate(p, ageMs) {
  const age = Math.max(-10000, Math.min(10000, ageMs)) / 1000;
  if (!Number.isFinite(p.gs) || !Number.isFinite(p.hdg) || p.gnd || !age) return { lat: p.lat, lon: p.lon, alt: p.alt };
  const distNm = p.gs * age / 3600;
  const rad = p.hdg * Math.PI / 180;
  const lat = p.lat + (distNm * Math.cos(rad)) / NM_PER_DEG;
  const lon = p.lon + (distNm * Math.sin(rad)) / (NM_PER_DEG * Math.max(0.01, Math.cos(p.lat * Math.PI / 180)));
  const alt = Number.isFinite(p.alt) && Number.isFinite(p.vs) ? Math.round(p.alt + p.vs * age / 60) : p.alt;
  return { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6, alt };
}

function createCrewLive(options = {}) {
  const pilotId = String(options.pilotId || '').trim();
  const pin = String(options.pin || '').trim();
  const getCrew = typeof options.getCrew === 'function' ? options.getCrew : () => '';
  const getShareFlight = typeof options.getShareFlight === 'function' ? options.getShareFlight : () => true;
  const WebSocketImpl = options.WebSocketImpl;
  const request = typeof options.request === 'function' ? options.request : requestJson;
  const log = typeof options.log === 'function' ? options.log : () => {};
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const later = options.setTimeout || setTimeout;
  const ticketUrl = String(options.ticketUrl || DEFAULT_TICKET_URL);
  const relayUrl = String(options.relayUrl || DEFAULT_RELAY_URL);
  const available = Boolean(pilotId && pin && WebSocketImpl);

  let crew = '', socket = null, joined = false, connecting = false, stopped = false;
  let ticket = null, ownPid = '', members = [], reconnectDelay = RECONNECT_MIN_MS, reconnectAt = 0;
  let lastSentAt = 0, sending = false, lastAudienceKey = '';
  const contacts = new Map();

  function others() {
    const list = members.filter(m => m.pid !== ownPid);
    return { trackers: list.filter(m => m.role === 'tracker').length, viewers: list.filter(m => m.role === 'viewer').length };
  }
  function interval() {
    const o = others();
    return o.trackers ? FAST_MS : (o.viewers ? SLOW_MS : 0);
  }
  function close(reason) {
    const old = socket;
    socket = null; joined = false; members = []; sending = false;
    if (old) { try { old.removeAllListeners?.(); old.close(1000, String(reason || 'close').slice(0, 60)); } catch (_) {} }
  }
  function send(data) {
    if (!socket || !joined) return false;
    try { socket.send(JSON.stringify(data)); return true; } catch (_) { return false; }
  }

  async function freshTicket() {
    if (ticket && ticket.crew === crew && ticket.exp - now() > TICKET_MARGIN_MS) return ticket;
    const response = await request(ticketUrl + encodeURIComponent(crew) + '/live-ticket', {
      headers: { 'X-Pilot-ID': pilotId, 'X-Pilot-PIN': pin }
    });
    if (!response.ok) throw new Error(`ticket_status_${response.status}`);
    const body = await response.json();
    const payload = ticketPayload(body?.ticket);
    if (!payload?.pid || !body?.ticket) throw new Error('ticket_invalid');
    ticket = { value: body.ticket, exp: Number(body.exp) || Number(payload.exp) || 0, crew };
    ownPid = String(payload.pid).toLowerCase();
    return ticket;
  }

  async function connect() {
    if (connecting || socket || stopped || !crew) return;
    connecting = true;
    const forCrew = crew;
    try {
      const t = await freshTicket();
      if (stopped || crew !== forCrew) return;
      const ws = new WebSocketImpl(`${relayUrl}?room=${crewRoomKey(forCrew)}`, { handshakeTimeout: 10000 });
      socket = ws;
      ws.on('open', () => {
        try { ws.send(JSON.stringify({ type: 'crew_join', ticket: t.value, role: 'tracker', clientId: `tracker-${ownPid}` })); } catch (_) {}
      });
      ws.on('message', raw => onMessage(ws, raw));
      ws.on('close', () => {
        if (socket !== ws) return;
        socket = null; joined = false; members = []; sending = false;
        reconnectAt = now() + reconnectDelay;
        reconnectDelay = Math.min(RECONNECT_MAX_MS, reconnectDelay * 2);
        log(`CREW_LIVE_CLOSED crew=${forCrew} retryMs=${reconnectAt - now()}`);
      });
      ws.on('error', error => { log(`CREW_LIVE_ERROR error=${error?.message || error}`); });
    } catch (error) {
      reconnectAt = now() + reconnectDelay;
      reconnectDelay = Math.min(RECONNECT_MAX_MS, reconnectDelay * 2);
      log(`CREW_LIVE_ERROR code=connect error=${error?.message || error}`);
    } finally {
      connecting = false;
    }
  }

  function onMessage(ws, raw) {
    if (ws !== socket) return;
    let data;
    try { data = JSON.parse(String(raw)); } catch (_) { return; }
    if (data?.type === 'crew_joined') {
      joined = true; reconnectDelay = RECONNECT_MIN_MS;
      log(`CREW_LIVE_JOINED crew=${crew}`);
    } else if (data?.type === 'crew_audience' && Array.isArray(data.members)) {
      members = data.members.map(m => ({ pid: String(m?.pid || '').toLowerCase(), role: m?.role === 'tracker' ? 'tracker' : 'viewer' }));
      const o = others(), key = `${o.trackers}/${o.viewers}`;
      if (key !== lastAudienceKey) { lastAudienceKey = key; log(`CREW_LIVE_AUDIENCE trackers=${o.trackers} viewers=${o.viewers}`); }
    } else if (data?.type === 'crew_pos' && data.p && data.pid && data.pid !== ownPid) {
      contacts.set(String(data.pid), { nick: String(data.nick || data.pid).slice(0, 64), p: data.p, at: now() });
    } else if (data?.type === 'crew_gone' && data.pid) {
      contacts.delete(String(data.pid));
    } else if (data?.type === 'error') {
      log(`CREW_LIVE_ERROR code=relay error=${String(data.message || '').slice(0, 120)}`);
    }
  }

  // Called regularly (e.g. every few seconds): follows crew changes, reconnects.
  function maintain() {
    if (!available || stopped) return;
    const next = String(getCrew() || '').trim().toUpperCase();
    if (next !== crew) {
      if (socket) close('crew-changed');
      crew = next; ticket = null; contacts.clear(); reconnectDelay = RECONNECT_MIN_MS; reconnectAt = 0;
    }
    if (!crew) return;
    if (!socket && !connecting && now() >= reconnectAt) void connect();
  }

  // Own position (every telemetry tick); sends at the rate the audience needs.
  function observe(sample) {
    if (!available || stopped) return;
    const share = getShareFlight() !== false;
    const valid = sample && Number.isFinite(sample.lat) && Number.isFinite(sample.lon) && !(sample.lat === 0 && sample.lon === 0) && sample.inMenu !== true;
    const rate = interval();
    if (!joined || !share || !valid || !rate) {
      if (sending && joined) { send({ type: 'crew_off' }); sending = false; }
      return;
    }
    const t = now();
    if (t - lastSentAt < rate) return;
    const p = { lat: sample.lat, lon: sample.lon };
    if (Number.isFinite(sample.altFt)) p.alt = Math.round(sample.altFt);
    if (Number.isFinite(sample.hdg)) p.hdg = Math.round(((sample.hdg % 360) + 360) % 360);
    if (Number.isFinite(sample.gsKts)) p.gs = Math.round(sample.gsKts);
    if (Number.isFinite(sample.vsFpm)) p.vs = Math.round(sample.vsFpm);
    if (Number.isFinite(sample.aglFt)) p.agl = Math.round(sample.aglFt);
    if (sample.onGround === true) p.gnd = 1;
    if (sample.callsign) p.cs = String(sample.callsign).slice(0, 12);
    if (sample.iconKind) { p.ic = String(sample.iconKind); p.k = String(sample.iconKind); }
    if (send({ type: 'crew_pos', p })) { lastSentAt = t; sending = true; }
  }

  // Crew aircraft as traffic contacts, positions extrapolated to `at`.
  function contactsAt(at = now()) {
    const out = [];
    for (const [pid, c] of contacts) {
      if (now() - c.at > CONTACT_TTL_MS) { contacts.delete(pid); continue; }
      const pos = extrapolate(c.p, at - c.at);
      const ac = { id: `crew:${pid}`, crew: 1, nick: c.nick, lat: pos.lat, lon: pos.lon };
      if (Number.isFinite(pos.alt)) ac.alt = pos.alt;
      ['hdg', 'gs', 'vs', 'agl'].forEach(key => { if (Number.isFinite(c.p[key])) ac[key] = c.p[key]; });
      if (c.p.gnd) ac.gnd = 1;
      ac.cs = String(c.p.cs || c.nick || pid).slice(0, 12);
      if (c.p.k) ac.k = c.p.k;
      if (c.p.ic) ac.ic = c.p.ic;
      out.push(ac);
    }
    return out;
  }

  function state() {
    const o = others();
    return { crew, connected: !!socket, joined, trackers: o.trackers, viewers: o.viewers, sending, contacts: contacts.size };
  }

  function stop() {
    if (stopped) return;
    if (sending) send({ type: 'crew_off' });
    stopped = true;
    close('stop');
  }

  return { available, maintain, observe, contacts: contactsAt, state, stop, start() {
    if (!available) return;
    const timer = (options.setInterval || setInterval)(maintain, 5000);
    timer?.unref?.();
    later(maintain, 3000)?.unref?.();
  } };
}

module.exports = { createCrewLive, crewRoomKey, extrapolate, FAST_MS, SLOW_MS, CONTACT_TTL_MS };
