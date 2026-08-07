const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { createTrackerStatus, statusFromLine } = require('./status-parser');

function cleanLogLine(line) {
  return String(line || '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/[ \t]+$/g, '')
    .trim();
}

class TrackerProcess extends EventEmitter {
  constructor({ electronApp, dataDirectory, runtimeManager, getCredentials, getRuntimeChannel }) {
    super();
    this.app = electronApp;
    this.dataDirectory = dataDirectory;
    this.runtimeManager = runtimeManager;
    this.getCredentials = typeof getCredentials === 'function' ? getCredentials : () => null;
    this.getRuntimeChannel = typeof getRuntimeChannel === 'function' ? getRuntimeChannel : () => 'stable';
    this.child = null;
    this.status = createTrackerStatus();
    this.logs = [];
    this.stopRequested = false;
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
    const sharedEnvironment = {
      ...process.env,
      VFR_MULTITOOL_TRACKER_DATA_DIR: this.dataDirectory,
      VFR_MULTITOOL_TRACKER_HEADLESS: '1',
      VFR_MULTITOOL_TRACKER_CHANNEL: this.getRuntimeChannel() === 'alpha' ? 'alpha' : 'stable'
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
    const spec = this.executableSpec();
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
}

module.exports = { TrackerProcess, cleanLogLine };
