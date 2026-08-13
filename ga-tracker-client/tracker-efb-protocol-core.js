(function initTrackerEfbProtocol(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GATrackerEfbProtocol = api;
})(typeof window !== 'undefined' ? window : null, function createTrackerEfbProtocol() {
  'use strict';

  const SCHEMA = 'ga.tracker-efb';
  const SCHEMA_VERSION = 1;
  const PROTOCOL_VERSION = 1;
  const MESSAGE_TYPE_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
  const CAPABILITY_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*\.v[1-9][0-9]*$/;

  const CAPABILITIES = Object.freeze({
    LEGACY_TELEMETRY: 'legacy.telemetry.v1',
    LEGACY_COMMANDS: 'legacy.commands.v1',
    TRACKER_STATUS: 'tracker.status.v1',
    FLIGHT_SNAPSHOT: 'flight.snapshot.v1',
    MAP_SNAPSHOT: 'map.snapshot.v1',
    MAP_CONTEXT: 'map.context.v1',
    MISSION_SNAPSHOT: 'mission.snapshot.v1',
    MISSION_SNAPSHOT_V2: 'mission.snapshot.v2',
    MISSION_VIEW: 'mission.view.v1',
    MISSION_AUTHORITY: 'mission.authority.v1',
    CHECKLIST_LIBRARY: 'checklist.library.v1',
    EFB_INTERACTION: 'efb.interaction.v1',
    EFB_WEB_CLIENT: 'efb.web-client.v1',
    EFB_CLIENT_DIAGNOSTICS: 'efb.client-diagnostics.v1'
  });

  const LEGACY_CAPABILITIES = Object.freeze([
    CAPABILITIES.LEGACY_TELEMETRY,
    CAPABILITIES.LEGACY_COMMANDS
  ].sort());

  function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function normalizeCapabilities(value) {
    const source = Array.isArray(value)
      ? value
      : Object.entries(safeObject(value)).filter(([, enabled]) => enabled === true).map(([name]) => name);
    return Object.freeze(Array.from(new Set(source
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter((entry) => CAPABILITY_PATTERN.test(entry))))
      .sort());
  }

  function randomId() {
    const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
    return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }

  function createMessage(type, payload = {}, options = {}) {
    const normalizedType = String(type || '').trim().toLowerCase();
    if (!MESSAGE_TYPE_PATTERN.test(normalizedType)) throw new Error('Ungueltiger Tracker-/EFB-Nachrichtentyp.');
    const id = String(options.id || randomId()).trim();
    if (!id || id.length > 160) throw new Error('Ungueltige Tracker-/EFB-Nachrichten-ID.');
    const timestamp = Number(options.timestamp ?? Date.now());
    if (!Number.isSafeInteger(timestamp) || timestamp < 0) throw new Error('Ungueltiger Tracker-/EFB-Zeitstempel.');
    const replyTo = String(options.replyTo || '').trim();
    if (replyTo.length > 160) throw new Error('Ungueltige Tracker-/EFB-Antwort-ID.');

    const message = {
      schema: SCHEMA,
      schemaVersion: SCHEMA_VERSION,
      protocolVersion: PROTOCOL_VERSION,
      id,
      type: normalizedType,
      timestamp,
      payload: safeObject(payload)
    };
    if (replyTo) message.replyTo = replyTo;
    return message;
  }

  function decodeMessage(value) {
    let parsed = value;
    if (typeof value === 'string') {
      try { parsed = JSON.parse(value); } catch (_) { throw new Error('Tracker-/EFB-Nachricht ist kein gueltiges JSON.'); }
    }
    const message = safeObject(parsed);
    if (message.schema !== SCHEMA || Number(message.schemaVersion) !== SCHEMA_VERSION) {
      throw new Error('Nicht unterstuetztes Tracker-/EFB-Nachrichtenschema.');
    }
    if (Number(message.protocolVersion) !== PROTOCOL_VERSION) {
      throw new Error('Nicht unterstuetzte Tracker-/EFB-Protokollversion.');
    }
    return createMessage(message.type, message.payload, {
      id: message.id,
      replyTo: message.replyTo,
      timestamp: message.timestamp
    });
  }

  function tryDecodeMessage(value) {
    try {
      return { ok: true, message: decodeMessage(value), error: '' };
    } catch (error) {
      return { ok: false, message: null, error: error?.message || String(error) };
    }
  }

  function createHello(options = {}) {
    const role = String(options.role || '').trim().toLowerCase();
    if (!['tracker', 'efb', 'web'].includes(role)) throw new Error('Tracker-/EFB-Hello benoetigt eine gueltige Rolle.');
    return createMessage('protocol.hello', {
      role,
      clientId: String(options.clientId || '').trim(),
      appVersion: String(options.appVersion || '').trim(),
      capabilities: normalizeCapabilities(options.capabilities)
    }, options);
  }

  function describePeer(value) {
    const decoded = tryDecodeMessage(value);
    if (!decoded.ok || decoded.message.type !== 'protocol.hello') {
      return {
        protocolVersion: 0,
        role: 'legacy',
        clientId: '',
        appVersion: '',
        capabilities: LEGACY_CAPABILITIES,
        legacy: true
      };
    }
    const payload = safeObject(decoded.message.payload);
    return {
      protocolVersion: decoded.message.protocolVersion,
      role: String(payload.role || '').trim().toLowerCase(),
      clientId: String(payload.clientId || '').trim(),
      appVersion: String(payload.appVersion || '').trim(),
      capabilities: normalizeCapabilities(payload.capabilities),
      legacy: false
    };
  }

  function negotiateCapabilities(localCapabilities, peerValue) {
    const local = normalizeCapabilities(localCapabilities);
    const peer = describePeer(peerValue);
    const remote = new Set(peer.capabilities);
    return {
      protocolVersion: peer.legacy ? 0 : Math.min(PROTOCOL_VERSION, peer.protocolVersion),
      capabilities: Object.freeze(local.filter((capability) => remote.has(capability))),
      legacy: peer.legacy,
      peer
    };
  }

  function supportsCapability(negotiated, capability) {
    const target = String(capability || '').trim().toLowerCase();
    return Array.isArray(negotiated?.capabilities) && negotiated.capabilities.includes(target);
  }

  return Object.freeze({
    CAPABILITIES,
    LEGACY_CAPABILITIES,
    PROTOCOL_VERSION,
    SCHEMA,
    SCHEMA_VERSION,
    createHello,
    createMessage,
    decodeMessage,
    describePeer,
    negotiateCapabilities,
    normalizeCapabilities,
    supportsCapability,
    tryDecodeMessage
  });
});
