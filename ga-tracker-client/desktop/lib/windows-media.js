'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');
const { createMediaTimeline } = require('./media-timeline');

// A single helper owns Windows media sessions and their volume restoration.
// JSON over stdin only; user input never becomes executable PowerShell text.
class WindowsMedia {
  constructor({ platform = process.platform, spawnProcess = spawn } = {}) {
    this.platform = platform;
    this.spawnProcess = spawnProcess;
    this.child = null;
    this.pending = new Map();
    this.sequence = 0;
    this.queue = Promise.resolve();
    this.closed = false;
    this.ending = false;
    this.duckClients = new Map();
    this.duckTimer = null;
    this.duckBusy = false;
    this.timeline = createMediaTimeline();
  }
  start() {
    if (this.child) return;
    const child = this.spawnProcess('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive',
      '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'windows-media.ps1').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.child = child;
    const lines = readline.createInterface({ input: child.stdout });
    lines.on('line', line => {
      let result;
      try { result = JSON.parse(line); } catch (_) { return; }
      const entry = this.pending.get(result.id);
      if (!entry) return;
      this.pending.delete(result.id); clearTimeout(entry.timer); entry.resolve(result);
    });
    const fail = () => {
      lines.close();
      if (this.child !== child) return;
      this.child = null; this.ending = false;
      for (const entry of this.pending.values()) {
        clearTimeout(entry.timer); entry.resolve({ ok: false, error: 'Windows-Mediensteuerung ist nicht verfügbar.' });
      }
      this.pending.clear();
    };
    child.on('error', fail); child.on('exit', fail);
    child.stdin.on('error', fail);
    // Consume diagnostics without exposing potentially personal media metadata.
    child.stderr.on('data', () => {});
  }
  request(payload = {}) {
    const allowed = ['snapshot', 'select', 'play', 'pause', 'playPause', 'next', 'previous', 'volume', 'duck', 'settings'];
    if (!payload || typeof payload !== 'object' || !allowed.includes(payload.action)) return Promise.resolve({ ok: false, error: 'Ungültiger Medienbefehl.' });
    if (this.platform !== 'win32') return Promise.resolve({ ok: false, unsupported: true, error: 'Mediensteuerung benötigt den Windows-Tracker.' });
    if (this.closed) return Promise.resolve({ ok: false, error: 'Mediensteuerung wurde beendet.' });
    const command = { action: payload.action };
    if (payload.action === 'select') {
      if (typeof payload.source !== 'string' || payload.source.length > 256) return Promise.resolve({ ok: false, error: 'Ungültiger Player.' });
      command.source = payload.source;
    }
    if (payload.action === 'volume' || payload.action === 'settings') {
      const value = payload.action === 'volume' ? payload.volume : payload.factor;
      if (!Number.isFinite(value) || value < 0 || value > 1) return Promise.resolve({ ok: false, error: 'Ungültige Lautstärke.' });
      if (payload.action === 'volume') command.volume = value;
      else { command.factor = value; command.enabled = payload.enabled === true; }
    }
    if (payload.action === 'duck') {
      const clientId = String(payload.clientId || 'desktop');
      if (!/^[A-Za-z0-9._:-]{1,240}$/.test(clientId)) return Promise.resolve({ok:false,error:'media_client_invalid'});
      if (payload.active === true) this.duckClients.set(clientId, Date.now() + 5000);
      else this.duckClients.delete(clientId);
      command.active = this.duckActive();
      if (command.active && !this.duckTimer) this.duckTimer = setInterval(() => {
        const active = this.duckActive();
        if (!active) { clearInterval(this.duckTimer); this.duckTimer = null; }
        if (this.duckBusy || this.closed) return;
        this.duckBusy = true;
        const operation = () => this.send({action:'duck',active:this.duckActive()});
        const result = this.queue.then(operation,operation);
        this.queue = result.catch(() => {});
        result.finally(() => { this.duckBusy = false; });
      }, 1000);
      this.duckTimer?.unref();
    }
    const operation = async () => this.timeline(await this.send(command), command.action);
    const result = this.queue.then(operation, operation);
    this.queue = result.catch(() => {});
    return result;
  }
  send(command) {
    if (this.closed) return Promise.resolve({ ok: false, error: 'Mediensteuerung wurde beendet.' });
    if (this.ending) return Promise.resolve({ ok: false, error: 'Windows-Mediensteuerung wird wiederhergestellt.' });
    this.start();
    return new Promise(resolve => {
      const id = ++this.sequence;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        // EOF allows the helper to restore volume in its finally block.
        this.ending = true; this.child?.stdin.end();
        resolve({ ok: false, error: 'Windows-Mediensteuerung antwortet nicht.' });
      }, 20000);
      this.pending.set(id, { resolve, timer });
      this.child.stdin.write(JSON.stringify({ ...command, id }) + '\n');
    });
  }
  duckActive() {
    for (const [clientId, deadline] of this.duckClients) if (deadline <= Date.now()) this.duckClients.delete(clientId);
    return this.duckClients.size > 0;
  }
  async close() {
    this.closed = true;
    clearInterval(this.duckTimer); this.duckClients.clear();
    const child = this.child;
    if (!child) return;
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 6000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
      child.stdin.end();
    });
  }
}
module.exports = { WindowsMedia };
