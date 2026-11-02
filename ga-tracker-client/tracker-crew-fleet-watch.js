'use strict';
// Crew fleet notice for the EFB: while the tracker runs it keeps one hibernating WebSocket
// to the crew fleet (worker crew-fleet.mjs). When another pilot changes the fleet (reserved,
// flying, landed, free, moved, new aircraft) the EFB shows "Vereinsflotte geändert ...
// Bitte aktualisieren" for 30 s. Own changes are never reported (wili-fleet-core.js).
//
// Traffic: one fleet read when the connection opens, one read per change; an idle connection
// costs nothing (a "ping" a minute is answered by Cloudflare without waking the object).
// Off without crew or when the pilot switched the crew fleet off on the crew board.
const core = require('../wili-fleet-core.js');

const DEFAULT_FLEET_URL = 'https://ga-proxy.einherjer.workers.dev/api/crew-fleet-v1/';
const TICK_MS = 30 * 1000;
const PING_MS = 60 * 1000;
const RECONNECT_MIN_MS = 30 * 1000;
const RECONNECT_MAX_MS = 10 * 60 * 1000;
const NOTICE_MS = 30 * 1000;

function createCrewFleetWatch(options = {}) {
  const pilotId = String(options.pilotId || '').trim();
  const pin = String(options.pin || '').trim();
  const request = options.request;
  const WebSocketClass = options.WebSocket;
  const getCrew = typeof options.getCrew === 'function' ? options.getCrew : () => ({});
  const log = typeof options.log === 'function' ? options.log : () => {};
  const now = typeof options.now === 'function' ? options.now : Date.now;
  const fleetUrl = String(options.fleetUrl || DEFAULT_FLEET_URL);
  const available = Boolean(pilotId && pin && request && WebSocketClass);

  let records = new Map();
  let rev = 0;
  let loaded = false;
  let group = '';
  let socket = null;
  let pingTimer = null;
  let timer = null;
  let reconnectAt = 0;
  let reconnectDelay = RECONNECT_MIN_MS;
  let fetching = null;
  let pendingRev = null;
  let notice = null;
  let stopped = false;

  function close() {
    clearInterval(pingTimer);
    pingTimer = null;
    const current = socket;
    socket = null;
    try { current?.close(); } catch (_) {}
  }

  function reset(nextGroup) {
    close();
    group = nextGroup;
    records = new Map();
    rev = 0;
    loaded = false;
    reconnectAt = 0;
    reconnectDelay = RECONNECT_MIN_MS;
  }

  async function load() {
    if (fetching) { pendingRev = true; return fetching; }
    const crew = group;
    fetching = (async () => {
      const response = await request(fleetUrl + encodeURIComponent(crew) + '?since=' + rev, {
        headers: { 'X-Pilot-ID': pilotId, 'X-Pilot-PIN': pin }
      });
      if (!response.ok) throw new Error(`fleet_status_${response.status}`);
      const data = await response.json();
      if (crew !== group || data?.unchanged) return;
      const changed = Array.isArray(data?.records) ? data.records.filter(record => core.validKey(record?.key)) : [];
      if (loaded) {
        const text = core.noticeText(core.changeNotes(records, changed, pilotId, now()));
        if (text) {
          notice = { id: `${crew}:${data.rev}`, text, at: now(), until: now() + NOTICE_MS };
          log(`CREW_FLEET_NOTICE rev=${data.rev} text="${text}"`);
        }
      }
      if (data?.full) records = new Map();
      for (const record of changed) records.set(record.key, record);
      rev = Number(data?.rev) || 0;
      loaded = true;
    })().catch(error => {
      log(`CREW_FLEET_WATCH_ERROR code=load error=${error?.message || error}`);
    }).finally(() => {
      fetching = null;
      if (pendingRev) { pendingRev = null; void load(); }
    });
    return fetching;
  }

  function connect() {
    if (socket || now() < reconnectAt) return;
    const url = fleetUrl.replace(/^http/, 'ws') + encodeURIComponent(group) + '/ws';
    let next;
    try {
      next = new WebSocketClass(url, { headers: { 'X-Pilot-ID': pilotId, 'X-Pilot-PIN': pin } });
    } catch (error) {
      log(`CREW_FLEET_WATCH_ERROR code=connect error=${error?.message || error}`);
      reconnectAt = now() + reconnectDelay;
      return;
    }
    socket = next;
    next.on('open', () => {
      reconnectDelay = RECONNECT_MIN_MS;
      log(`CREW_FLEET_WATCH_CONNECTED group=${group}`);
      clearInterval(pingTimer);
      pingTimer = setInterval(() => { try { next.send('ping'); } catch (_) {} }, PING_MS);
      pingTimer.unref?.();
      void load(); // changes while the connection was down
    });
    next.on('message', raw => {
      const text = String(raw);
      if (text === 'pong') return;
      let data = null;
      try { data = JSON.parse(text); } catch (_) {}
      if (data?.type === 'fleet' && data.rev !== rev) void load();
    });
    next.on('close', () => {
      if (socket !== next) return;
      socket = null;
      clearInterval(pingTimer);
      reconnectAt = now() + reconnectDelay;
      reconnectDelay = Math.min(RECONNECT_MAX_MS, reconnectDelay * 2);
    });
    next.on('error', () => {});
  }

  function tick() {
    if (!available || stopped) return;
    const crew = getCrew() || {};
    const wanted = crew.fleetShow !== false && crew.groupName ? String(crew.groupName) : '';
    if (wanted !== group) reset(wanted);
    if (group) connect();
  }

  return {
    available,
    start() {
      if (!available || timer) return;
      timer = setInterval(tick, TICK_MS);
      timer.unref?.();
      setTimeout(tick, 8000).unref?.();
    },
    stop() {
      stopped = true;
      clearInterval(timer);
      timer = null;
      close();
    },
    tick,
    load,
    // For the EFB status: the notice while it is fresh.
    notice: () => (notice && now() < notice.until ? { id: notice.id, text: notice.text, at: notice.at, until: notice.until } : null),
    publicState: () => ({ group, rev, connected: Boolean(socket), aircraft: records.size })
  };
}

module.exports = { createCrewFleetWatch, NOTICE_MS };
