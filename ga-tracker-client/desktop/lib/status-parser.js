function createTrackerStatus() {
  return {
    process: 'stopped',
    relay: 'waiting',
    simulator: 'waiting',
    telemetry: 'waiting',
    detail: 'Tracker ist nicht gestartet.'
  };
}

function statusFromLine(previous, rawLine) {
  const current = { ...createTrackerStatus(), ...(previous || {}) };
  const line = String(rawLine || '').replace(/\u001b\[[0-9;]*m/g, '').trim();
  if (!line) return current;

  current.detail = line;
  if (/Autostart|Prüfe Pilot-Konto|Angemeldet als/.test(line)) current.process = 'starting';
  if (/Verbinde mit WebSocket-Server/.test(line)) {
    current.process = 'running';
    current.relay = 'connecting';
  }
  if (/Relay verbunden/.test(line)) {
    current.process = 'running';
    current.relay = 'connected';
  }
  if (/WebSocket.*(?:getrennt|Fehler|Timeout)|Relay.*getrennt/i.test(line)) current.relay = 'waiting';
  if (/MSFS gefunden/.test(line)) {
    current.process = 'running';
    current.simulator = 'connected';
  }
  if (/MSFS (?:getrennt|nicht gefunden)|SimConnect-Fehler/.test(line)) {
    current.simulator = 'waiting';
    current.telemetry = 'waiting';
  }
  if (/^GPS Lat /.test(line)) {
    current.process = 'running';
    current.simulator = 'connected';
    current.telemetry = 'live';
  }
  if (/GPS wartet/.test(line)) current.telemetry = 'waiting';
  if (/Unbehandelte|❌/.test(line)) current.process = current.process === 'stopped' ? 'error' : current.process;
  return current;
}

module.exports = { createTrackerStatus, statusFromLine };
