const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { createTrackerStatus, statusFromLine } = require('./status-parser');

const DEFAULT_EFB_HTTP_PORT = 49880;
const TRACKER_MISSION_HARD_RESET_PATH = '/api/v1/tracker/mission/hard-reset';

function cleanLogLine(line) {
  return String(line || '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/[ \t]+$/g, '')
    .trim();
}

class TrackerProcess extends EventEmitter {
  constructor({ electronApp, dataDirectory, runtimeManager, getCredentials, getRuntimeChannel, getAptMissionExecutionEnabled }) {
    super();
    this.app = electronApp;
    this.dataDirectory = dataDirectory;
    this.runtimeManager = runtimeManager;
    this.getCredentials = typeof getCredentials === 'function' ? getCredentials : () => null;
    this.getRuntimeChannel = typeof getRuntimeChannel === 'function' ? getRuntimeChannel : () => 'stable';
    this.getAptMissionExecutionEnabled = typeof getAptMissionExecutionEnabled === 'function'
      ? getAptMissionExecutionEnabled
      : () => false;
    this.child = null;
    this.status = createTrackerStatus();
    this.logs = [];
    this.stopRequested = false;
    this.desktopControlToken = '';
    this.localControlPort = DEFAULT_EFB_HTTP_PORT;
  }

  ensureDesktopControlToken() {
    if (!this.desktopControlToken) this.desktopControlToken = crypto.randomBytes(32).toString('hex');
    return this.desktopControlToken;
  }

  publicState() {
    return {
      ...this.status,
      pid: this.child?.pid || null,
      logs: [...this.logs]
    };
  }

  executableSpec() {
    const credentials = this.getCredentials();
    const runtimeChannel = this.getRuntimeChannel() === 'alpha' ? 'alpha' : 'stable';
    const aptMissionExecutionEnabled = runtimeChannel === 'alpha' && this.getAptMissionExecutionEnabled() === true;
    const desktopControlToken = this.ensureDesktopControlToken();
    const sharedEnvironment = {
      ...process.env,
      VFR_MULTITOOL_TRACKER_DATA_DIR: this.dataDirectory,
      VFR_MULTITOOL_TRACKER_HEADLESS: '1',
      VFR_MULTITOOL_TRACKER_CHANNEL: runtimeChannel,
      VFR_MULTITOOL_APT_EXECUTION: aptMissionExecutionEnabled ? '1' : '0',
      VFR_MULTITOOL_DESKTOP_CONTROL_TOKEN: desktopControlToken
    };
    if (this.app.isPackaged) {
      const executable = this.runtimeManager?.currentExecutablePath() || '';
      return { command: executable, args: [], cwd: path.dirname(executable), env: sharedEnvironment, credentials };
    }
    const trackerScript = path.resolve(__dirname, '..', '..', 'tracker.js');
    return {
      command: process.execPath,
      args: [trackerScript],
      cwd: path.dirname(trackerScript),
      env: { ...sharedEnvironment, ELECTRON_RUN_AS_NODE: '1' },
      credentials
    };
  }

  emitState() {
    this.emit('state', this.publicState());
  }

  addLog(rawLine, kind = 'info') {
    const line = cleanLogLine(rawLine);
    if (!line) return;
    const entry = { at: Date.now(), kind, line };
    this.logs.push(entry);
    if (this.logs.length > 160) this.logs.splice(0, this.logs.length - 160);
    this.status = statusFromLine(this.status, line);
    this.emit('log', entry);
    this.emitState();
  }

  consumeChunk(chunk, kind) {
    for (const line of String(chunk || '').split(/[\r\n]+/)) this.addLog(line, kind);
  }

  start() {
    if (this.child) return { ok: true, alreadyRunning: true };
    // Ein Reset-Token gilt nur für genau diesen Engine-Kindprozess.
    this.desktopControlToken = crypto.randomBytes(32).toString('hex');
    const spec = this.executableSpec();
    this.localControlPort = Number(spec.env?.VFR_MULTITOOL_EFB_PORT || DEFAULT_EFB_HTTP_PORT) || DEFAULT_EFB_HTTP_PORT;
    if (!this.getCredentials()) {
      const message = 'Pilot-ID und PIN fehlen.';
      this.status = { ...createTrackerStatus(), process: 'error', detail: message };
      this.addLog(message, 'error');
      return { ok: false, needsCredentials: true, message };
    }
    if (this.app.isPackaged && (!spec.command || !fs.existsSync(spec.command))) {
      const message = 'Tracker-Runtime fehlt oder wurde noch nicht vollständig geladen.';
      this.status = { ...createTrackerStatus(), process: 'error', detail: message };
      this.addLog(message, 'error');
      return { ok: false, message };
    }

    this.stopRequested = false;
    this.status = {
      ...createTrackerStatus(),
      process: 'starting',
      detail: 'Tracker wird gestartet …'
    };
    this.emitState();

    try {
      const child = spawn(spec.command, spec.args, {
        cwd: spec.cwd,
        env: spec.env,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      this.child = child;
      child.stdin?.end(`${JSON.stringify(spec.credentials || this.getCredentials())}\n`);
      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');
      child.stdout?.on('data', (chunk) => this.consumeChunk(chunk, 'info'));
      child.stderr?.on('data', (chunk) => this.consumeChunk(chunk, 'error'));
      child.on('error', (error) => {
        this.addLog(`Tracker konnte nicht gestartet werden: ${error.message}`, 'error');
        this.child = null;
        this.status = { ...createTrackerStatus(), process: 'error', detail: error.message };
        this.emitState();
      });
      child.on('exit', (code, signal) => {
        const expected = this.stopRequested;
        this.child = null;
        this.status = {
          ...createTrackerStatus(),
          process: expected ? 'stopped' : (code === 0 ? 'stopped' : 'error'),
          detail: expected
            ? 'Tracker wurde beendet.'
            : `Tracker wurde beendet${code == null ? '' : ` (Code ${code})`}${signal ? `, Signal ${signal}` : ''}.`
        };
        this.addLog(this.status.detail, expected ? 'info' : 'error');
        this.emit('exit', { code, signal, expected });
        this.emitState();
      });
      return { ok: true };
    } catch (error) {
      this.child = null;
      this.status = { ...createTrackerStatus(), process: 'error', detail: error.message };
      this.addLog(`Tracker konnte nicht gestartet werden: ${error.message}`, 'error');
      return { ok: false, message: error.message };
    }
  }

  stop() {
    if (!this.child) return { ok: true, alreadyStopped: true };
    this.stopRequested = true;
    this.status = { ...this.status, process: 'stopping', detail: 'Tracker wird beendet …' };
    this.emitState();
    try {
      this.child.kill();
      return { ok: true };
    } catch (error) {
      this.addLog(`Tracker konnte nicht beendet werden: ${error.message}`, 'error');
      return { ok: false, message: error.message };
    }
  }

  hardResetMission() {
    if (!this.child) {
      return Promise.resolve({ ok: false, status: 'blocked', error: 'tracker_not_running', message: 'Der Tracker muss für den Missionsreset laufen.' });
    }
    const token = String(this.desktopControlToken || '').trim();
    if (!token) {
      return Promise.resolve({ ok: false, status: 'blocked', error: 'tracker_desktop_control_unavailable', message: 'Die lokale Tracker-Steuerung ist noch nicht bereit.' });
    }
    const body = JSON.stringify({ source: 'tracker-desktop' });
    return new Promise((resolve) => {
      let settled = false;
      const done = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      const request = http.request({
        host: '127.0.0.1',
        port: this.localControlPort || DEFAULT_EFB_HTTP_PORT,
        path: TRACKER_MISSION_HARD_RESET_PATH,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'X-GA-Tracker-Desktop-Control': token
        }
      }, (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          let envelope = null;
          try { envelope = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) {}
          const result = envelope?.message?.payload;
          if (result && typeof result === 'object') {
            done({
              ...result,
              message: result.ok === true
                ? 'Tracker-Mission wurde zurückgesetzt und der App-Stand wird neu geladen.'
                : 'Der Tracker konnte den Missionsreset noch nicht sicher ausführen.'
            });
            return;
          }
          done({
            ok: false,
            status: response.statusCode === 423 ? 'blocked' : 'error',
            error: envelope?.error || 'tracker_mission_reset_failed',
            message: response.statusCode === 503
              ? 'Die lokale Missionssteuerung ist noch nicht bereit.'
              : 'Der Tracker konnte den Missionsreset nicht sicher ausführen.'
          });
        });
      });
      request.setTimeout(20000, () => request.destroy(new Error('tracker_mission_reset_timeout')));
      request.on('error', (error) => {
        done({
          ok: false,
          status: 'error',
          error: error?.code || error?.message || 'tracker_mission_reset_transport_failed',
          message: 'Die lokale Tracker-Steuerung ist nicht erreichbar. Bitte Tracker und MSFS-Verbindung prüfen.'
        });
      });
      request.end(body);
    });
  }
}

module.exports = { DEFAULT_EFB_HTTP_PORT, TRACKER_MISSION_HARD_RESET_PATH, TrackerProcess, cleanLogLine };
