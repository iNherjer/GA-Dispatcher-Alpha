const {
  CAPABILITIES,
  createHello,
  decodeMessage
} = require('./tracker-efb-protocol-core');

const TRACKER_RELAY_CAPABILITIES = Object.freeze([
  CAPABILITIES.LEGACY_COMMANDS,
  CAPABILITIES.LEGACY_TELEMETRY,
  CAPABILITIES.MISSION_AUTHORITY,
  CAPABILITIES.MISSION_SNAPSHOT_V2
].sort());

function normalizeRuntimeChannel(value) {
  return String(value || '').trim().toLowerCase() === 'alpha' ? 'alpha' : 'stable';
}

function createTrackerRelayHello(options = {}) {
  const trackerVersion = String(options.trackerVersion || '').trim();
  const trackerVersionCode = Number(options.trackerVersionCode);
  if (!/^v[1-9][0-9]*$/.test(trackerVersion)) throw new Error('Ungueltige Tracker-Version fuer den EFB-Handshake.');
  if (!Number.isSafeInteger(trackerVersionCode) || trackerVersion !== `v${trackerVersionCode}`) {
    throw new Error('Tracker-Version und Versionscode passen beim EFB-Handshake nicht zusammen.');
  }
  const hello = createHello({
    role: 'tracker',
    clientId: String(options.clientId || 'ga-tracker').trim(),
    appVersion: trackerVersion,
    capabilities: TRACKER_RELAY_CAPABILITIES,
    id: options.id,
    timestamp: options.timestamp
  });
  hello.payload = {
    ...hello.payload,
    trackerVersionCode,
    runtimeChannel: normalizeRuntimeChannel(options.runtimeChannel),
    transport: 'relay-embedded'
  };
  return hello;
}

function readTrackerRelayHello(packet) {
  try {
    const hello = decodeMessage(packet?.trackerProtocolHello);
    if (hello.type !== 'protocol.hello' || hello.payload?.role !== 'tracker') return null;
    return hello;
  } catch (_) {
    return null;
  }
}

module.exports = {
  TRACKER_RELAY_CAPABILITIES,
  createTrackerRelayHello,
  normalizeRuntimeChannel,
  readTrackerRelayHello
};
