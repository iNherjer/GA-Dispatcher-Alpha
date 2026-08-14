function createTrackerStatus() {
  return {
    process: 'stopped',
    relay: 'waiting',
    relayCloudflare: 'waiting',
    relayRender: 'waiting',
    simulator: 'waiting',
    telemetry: 'off',
    detail: 'Tracker ist nicht gestartet.'
  };
}

function relayField(label) {
  const normalized = String(label || '').toLowerCase();
  if (normalized === 'cloudflare' || normalized === 'c') return 'relayCloudflare';
  if (normalized === 'render' || normalized === 'r') return 'relayRender';
  return '';
}

function refreshRelaySummary(current) {
  const states = [current.relayCloudflare, current.relayRender];
  if (states.includes('connected')) current.relay = 'connected';
  else if (states.includes('connecting')) current.relay = 'connecting';
  else current.relay = 'waiting';
}

function setTelemetryLink(current) {
  if (current.telemetry !== 'hibernate' && current.telemetry !== 'live') current.telemetry = 'link';
}

function statusFromLine(previous, rawLine) {
  const current = { ...createTrackerStatus(), ...(previous || {}) };
  const line = String(rawLine || '').replace(/\u001b\[[0-9;]*m/g, '').trim();
  if (!line) return current;

  current.detail = line;
  if (/Autostart|Prüfe Pilot-Konto|Angemeldet als/.test(line)) current.process = 'starting';
  const relayConnect = line.match(/Verbinde mit (Cloudflare|Render)-Relay/i);
  if (relayConnect) {
    current.process = 'running';
    current[relayField(relayConnect[1])] = 'connecting';
    refreshRelaySummary(current);
    setTelemetryLink(current);
  } else if (/Verbinde mit WebSocket-Server/.test(line)) {
    current.process = 'running';
    current.relay = 'connecting';
    setTelemetryLink(current);
  }
  const relayConnected = line.match(/(Cloudflare|Render)-Relay\s*(?:\[[CR]\])?\s*verbunden/i);
  if (relayConnected) {
    current.process = 'running';
    current[relayField(relayConnected[1])] = 'connected';
    refreshRelaySummary(current);
    setTelemetryLink(current);
  } else if (/Relay verbunden/.test(line)) {
    current.process = 'running';
    current.relay = 'connected';
    setTelemetryLink(current);
  }
  const relayDisconnected = line.match(/(Cloudflare|Render)-Relay[^\n]*(?:getrennt|Fehler|Timeout)/i);
  if (relayDisconnected) {
    current[relayField(relayDisconnected[1])] = 'waiting';
    refreshRelaySummary(current);
    if (current.relay !== 'connected' && current.telemetry !== 'hibernate') current.telemetry = 'link';
  } else if (/WebSocket.*(?:getrennt|Fehler|Timeout)|Relay.*getrennt/i.test(line)) {
    current.relay = 'waiting';
    if (current.telemetry !== 'hibernate') current.telemetry = 'link';
  }
  if (/MSFS gefunden/.test(line)) {
    current.process = 'running';
    current.simulator = 'connected';
    setTelemetryLink(current);
  }
  if (/MSFS (?:getrennt|nicht gefunden)|SimConnect-Fehler/.test(line)) {
    current.simulator = 'waiting';
    current.telemetry = 'link';
  }
  if (/^GPS Lat /.test(line)) {
    current.process = 'running';
    current.simulator = 'connected';
    current.telemetry = 'live';
  }
  if (/GPS wartet/.test(line)) current.telemetry = 'link';
  const trackerState = line.match(/TRACKER_UI_STATE\s+telemetry=(live|active|hibernate|hib|link|off)\b/i);
  if (trackerState) {
    const state = trackerState[1].toLowerCase();
    current.process = state === 'off' ? current.process : 'running';
    current.telemetry = state === 'active' ? 'live' : (state === 'hib' ? 'hibernate' : state);
  }
  if (/Unbehandelte|❌/.test(line)) current.process = current.process === 'stopped' ? 'error' : current.process;
  return current;
}

module.exports = { createTrackerStatus, statusFromLine };
