'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');
const { createMediaTimeline } = require('./media-timeline');

// A single helper owns Windows media sessions and their volume restoration.
// JSON over stdin only; user input never becomes executable PowerShell text.
class WindowsMedia {
  constructor({ platform = process.platform, spawnProcess = spawn, onSettings = null } = {}) {
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
    this.holdFactor = null;
    this.holdTimer = null;
    this.timeline = createMediaTimeline();
    // Announcement ducking is owned here: every client (desktop, web, EFB) only
    // requests changes, the value is persisted by the app and re-applied when
    // the helper restarts. Clients never re-assert their own copy.
    this.duckSettings = null;
    this.onSettings = onSettings;
  }
  restoreSettings(value) {
    const factor = [0.1, 0.2, 0.35, 0.5].includes(value?.factor) ? value.factor : 0.2;
    this.duckSettings = { enabled: value?.enabled !== false, factor };
    if (this.child) this.child.stdin.write(JSON.stringify({ action: 'settings', ...this.duckSettings, id: 0 }) + '\n');
  }
  start() {
    if (this.child) return;
    const child = this.spawnProcess('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive',
      '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'windows-media.ps1').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1')],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.child = child;
    if (this.duckSettings) child.stdin.write(JSON.stringify({ action: 'settings', ...this.duckSettings, id: 0 }) + '\n');
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
    const allowed = ['snapshot', 'select', 'play', 'pause', 'playPause', 'next', 'previous', 'seek', 'volume', 'duck', 'hold', 'settings'];
    if (!payload || typeof payload !== 'object' || !allowed.includes(payload.action)) return Promise.resolve({ ok: false, error: 'Ungültiger Medienbefehl.' });
    if (this.platform !== 'win32') return Promise.resolve({ ok: false, unsupported: true, error: 'Mediensteuerung benötigt den Windows-Tracker.' });
    if (this.closed) return Promise.resolve({ ok: false, error: 'Mediensteuerung wurde beendet.' });
    const command = { action: payload.action };
    if (payload.action === 'select' || payload.action === 'seek') {
      if (typeof payload.source !== 'string' || !payload.source || payload.source.length > 256) return Promise.resolve({ ok: false, error: 'Ungültiger Player.' });
      command.source = payload.source;
    }
    if (payload.action === 'seek') {
      if (!Number.isFinite(payload.positionSeconds) || payload.positionSeconds < 0 || payload.positionSeconds >= 86400) return Promise.resolve({ok:false,error:'media_position_invalid'});
      command.positionSeconds = payload.positionSeconds;
    }
    if (payload.action === 'volume' || payload.action === 'settings') {
      const value = payload.action === 'volume' ? payload.volume : payload.factor;
      if (!Number.isFinite(value) || value < 0 || value > 1) return Promise.resolve({ ok: false, error: 'Ungültige Lautstärke.' });
      if (payload.action === 'volume') command.volume = value;
      else {
        command.factor = value; command.enabled = payload.enabled === true;
        const changed = !this.duckSettings || this.duckSettings.enabled !== command.enabled || this.duckSettings.factor !== value;
        this.duckSettings = { enabled: command.enabled, factor: value };
        if (changed && typeof this.onSettings === 'function') { try { this.onSettings({ ...this.duckSettings }, String(payload.clientId || 'desktop')); } catch (_) {} }
      }
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
    if (payload.action === 'hold') {
      if (payload.active === true && (!Number.isFinite(payload.factor) || payload.factor < 0 || payload.factor > 1)) return Promise.resolve({ ok: false, error: 'Ungültige Lautstärke.' });
      this.holdFactor = payload.active === true ? payload.factor : null;
      command.active = this.holdFactor !== null; if (command.active) command.factor = this.holdFactor;
      clearInterval(this.holdTimer); this.holdTimer = null;
      // Heartbeat keeps the helper's five-second lease; a frozen app restores the music.
      if (command.active) {
        this.holdTimer = setInterval(() => {
          if (this.closed || this.holdFactor === null) return;
          const beat = () => this.send({ action: 'hold', active: true, factor: this.holdFactor });
          this.queue = this.queue.then(beat, beat).catch(() => {});
        }, 1000);
        this.holdTimer.unref?.();
      }
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
    clearInterval(this.holdTimer); this.holdFactor = null;
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
