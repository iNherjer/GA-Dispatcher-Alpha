const crypto = require('node:crypto');

const TRACKER_RELAY_ENDPOINTS = Object.freeze([
  Object.freeze({
    key: 'cloudflare',
    code: 'C',
    label: 'Cloudflare',
    url: 'wss://ga-relay.einherjer.workers.dev/'
  }),
  Object.freeze({
    key: 'render',
    code: 'R',
    label: 'Render',
    url: 'wss://websocketrelais.onrender.com/'
  })
]);

function normalizeSyncId(value) {
  return String(value || '').trim().toUpperCase();
}

function trackerRoomKey(syncId) {
  const normalized = normalizeSyncId(syncId);
  if (!normalized) throw new Error('Eine Pilot-ID wird für die Relay-Verbindung benötigt.');
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

function buildTrackerRelayUrl(endpoint, syncId) {
  if (!endpoint || typeof endpoint !== 'object') throw new Error('Relay-Endpunkt fehlt.');
  if (endpoint.key !== 'cloudflare') return String(endpoint.url || '');
  const url = new URL(endpoint.url);
  url.searchParams.set('room', trackerRoomKey(syncId));
  return url.toString();
}

function createRelayFanout(getStates, WebSocketImpl, onSendError = null) {
  if (typeof getStates !== 'function') throw new Error('Relay-State-Leser fehlt.');
  const OPEN = Number(WebSocketImpl?.OPEN ?? 1);
  const CLOSED = Number(WebSocketImpl?.CLOSED ?? 3);
  return {
    get readyState() {
      return Array.from(getStates() || []).some(state => state?.socket?.readyState === OPEN)
        ? OPEN
        : CLOSED;
    },
    send(payload) {
      let sent = 0;
      for (const state of Array.from(getStates() || [])) {
        const socket = state?.socket;
        if (!socket || socket.readyState !== OPEN) continue;
        try {
          socket.send(payload);
          sent += 1;
        } catch (error) {
          if (typeof onSendError === 'function') onSendError(error, state);
        }
      }
      if (sent === 0) throw new Error('Kein Relay ist verbunden.');
      return sent;
    }
  };
}

module.exports = {
  TRACKER_RELAY_ENDPOINTS,
  buildTrackerRelayUrl,
  createRelayFanout,
  normalizeSyncId,
  trackerRoomKey
};
