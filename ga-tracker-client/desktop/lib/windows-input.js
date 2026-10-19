'use strict';
const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');

const KEY_NAMES = {
  0x08: 'Rücktaste', 0x09: 'Tab', 0x0D: 'Enter', 0x10: 'Umschalt', 0x11: 'Strg', 0x12: 'Alt', 0x13: 'Pause', 0x14: 'Feststell',
  0x1B: 'Esc', 0x20: 'Leertaste', 0x21: 'Bild auf', 0x22: 'Bild ab', 0x23: 'Ende', 0x24: 'Pos1', 0x25: 'Pfeil links',
  0x26: 'Pfeil hoch', 0x27: 'Pfeil rechts', 0x28: 'Pfeil runter', 0x2D: 'Einfg', 0x2E: 'Entf', 0x5B: 'Windows links',
  0x5C: 'Windows rechts', 0x91: 'Rollen', 0xA0: 'Umschalt links', 0xA1: 'Umschalt rechts', 0xA2: 'Strg links',
  0xA3: 'Strg rechts', 0xA4: 'Alt links', 0xA5: 'Alt rechts (AltGr)', 0xB3: 'Medien Play/Pause'
};
function keyName(vk) {
  if (KEY_NAMES[vk]) return KEY_NAMES[vk];
  if (vk >= 0x30 && vk <= 0x39) return String.fromCharCode(vk);
  if (vk >= 0x41 && vk <= 0x5A) return String.fromCharCode(vk);
  if (vk >= 0x60 && vk <= 0x69) return 'Num ' + (vk - 0x60);
  if (vk >= 0x70 && vk <= 0x87) return 'F' + (vk - 0x6F);
  return 'Taste 0x' + vk.toString(16).toUpperCase().padStart(2, '0');
}
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
function normalizeBinding(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.type === 'key' && integer(value.vk, 0x08, 0xFE) && value.vk !== 0x0A && value.vk !== 0x0B) {
    return { type: 'key', vk: value.vk, label: 'Taste ' + keyName(value.vk) };
  }
  if (value.type === 'joystick' && integer(value.button, 0, 31) && integer(value.device, 0, 15)
    && integer(value.mid, 0, 65535) && integer(value.pid, 0, 65535)) {
    const name = String(value.name || 'Joystick').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 80) || 'Joystick';
    return { type: 'joystick', device: value.device, mid: value.mid, pid: value.pid, button: value.button, name,
      label: name + ' · Button ' + (value.button + 1) };
  }
  return null;
}
const MAX_BINDINGS = 8;
function bindingKey(binding) {
  return binding.type === 'key' ? 'key ' + binding.vk : ['joy', binding.mid, binding.pid, binding.button].join(' ');
}
function normalizeBindings(value) {
  const list = [], seen = new Set();
  for (const entry of Array.isArray(value) ? value : []) {
    const binding = normalizeBinding(entry);
    if (!binding || seen.has(bindingKey(binding))) continue;
    seen.add(bindingKey(binding)); list.push(binding);
    if (list.length >= MAX_BINDINGS) break;
  }
  return list;
}
function watchLine(bindings) {
  const list = normalizeBindings(Array.isArray(bindings) ? bindings : bindings ? [bindings] : []);
  if (!list.length) return 'idle';
  return 'watch ' + list.map(binding => binding.type === 'key' ? 'key ' + binding.vk
    : ['joy', binding.mid, binding.pid, binding.device, binding.button].join(' ')).join(';');
}

// Owns the native read-only input helper. Emits 'down', 'up' and 'device'.
class WindowsInput extends EventEmitter {
  constructor({ platform = process.platform, spawnProcess = spawn, restartDelayMs = 3000, log = () => {} } = {}) {
    super();
    this.log = line => { try { log('INPUT ' + line); } catch (_) {} };
    this.pressedAt = 0;
    this.platform = platform; this.spawnProcess = spawnProcess; this.restartDelayMs = restartDelayMs;
    this.child = null; this.bindings = []; this.learning = null; this.closed = false;
    this.restartTimer = null; this.down = false; this.connected = null;
  }
  get supported() { return this.platform === 'win32'; }
  start() {
    if (this.child || this.closed || !this.supported) return;
    const script = path.join(__dirname, 'windows-input.ps1').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
    const child = this.spawnProcess('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.child = child;
    this.log('helper spawn script=' + script);
    let stderrBytes = 0;
    const lines = readline.createInterface({ input: child.stdout });
    lines.on('line', line => { let message; try { message = JSON.parse(line); } catch (_) { return; } this.handle(message); });
    const fail = (code) => {
      lines.close();
      if (this.child !== child) return;
      this.log('helper ended ' + (code instanceof Error ? 'error=' + code.message : 'code=' + code));
      this.child = null;
      this.release();
      this.settleLearn({ ok: false, error: 'Eingabe-Helfer ist nicht verfügbar.' });
      if (!this.closed && this.bindings.length && !this.restartTimer) {
        this.restartTimer = setTimeout(() => { this.restartTimer = null; this.start(); this.send(watchLine(this.bindings)); }, this.restartDelayMs);
        this.restartTimer.unref?.();
      }
    };
    child.on('error', fail); child.on('exit', fail); child.stdin.on('error', fail);
    // PowerShell compile/runtime errors arrive here; keep the first 4 KB per helper run.
    child.stderr.on('data', chunk => {
      if (stderrBytes >= 4096) return;
      const text = String(chunk).slice(0, 4096 - stderrBytes); stderrBytes += text.length;
      for (const line of text.split(/\r?\n/)) if (line.trim()) this.log('helper stderr ' + line.trim().slice(0, 400));
    });
  }
  handle(message) {
    if (message.event === 'log') { this.log(String(message.message || '').slice(0, 400)); return; }
    if (message.event === 'ready') { this.log('helper ready clr=' + message.clr + ' os=' + message.os); return; }
    if (message.event === 'error') { this.log('helper error ' + String(message.error || '').slice(0, 400)); return; }
    if (message.event === 'down' && !this.down) { this.pressedAt = Date.now(); this.log('button down'); this.down = true; this.emit('down'); }
    else if (message.event === 'up') this.release();
    else if (message.event === 'device') { this.connected = message.connected === true; this.log('device connected=' + this.connected); this.emit('device', this.connected); }
    else if (message.event === 'learn') {
      const binding = message.ok ? normalizeBinding(message.binding) : null;
      this.log('learn result ' + (binding ? 'ok ' + binding.label + (binding.type === 'joystick' ? ' vid=' + binding.mid + ' pid=' + binding.pid + ' id=' + binding.device : '') : 'failed ' + (message.error || 'invalid')));
      this.settleLearn(binding ? { ok: true, binding }
        : { ok: false, error: message.error === 'timeout' ? 'Kein Button erkannt.' : 'Eingabe konnte nicht gelernt werden.' });
    }
  }
  release() { if (this.down) { this.down = false; this.log('button up heldMs=' + (Date.now() - this.pressedAt)); this.emit('up'); } }
  settleLearn(result) {
    const learning = this.learning;
    if (!learning) return;
    this.learning = null; clearTimeout(learning.timer); learning.resolve(result);
    // Learning replaces the watch loop inside the helper; resume the previous bindings.
    if (this.child) this.send(watchLine(this.bindings));
  }
  send(line) { if (line !== 'idle' || this.child) this.log('command ' + line); try { this.child?.stdin.write(line + '\n'); } catch (_) {} }
  watch(bindings) {
    this.bindings = normalizeBindings(Array.isArray(bindings) ? bindings : bindings ? [bindings] : []);
    this.release(); this.connected = null;
    if (!this.supported || this.closed) return;
    if (!this.bindings.length && !this.child) return;
    this.start(); this.send(watchLine(this.bindings));
  }
  learn() {
    if (!this.supported) return Promise.resolve({ ok: false, unsupported: true, error: 'Button-Erkennung benötigt Windows.' });
    if (this.closed) return Promise.resolve({ ok: false, error: 'Eingabe-Helfer wurde beendet.' });
    if (this.learning) return this.learning.promise;
    this.release();
    this.start();
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    this.learning = { promise, resolve, timer: setTimeout(() => this.settleLearn({ ok: false, error: 'Kein Button erkannt.' }), 20000) };
    this.send('learn');
    return promise;
  }
  publicState() { return { supported: this.supported, connected: this.connected, pressed: this.down }; }
  close() {
    this.closed = true; clearTimeout(this.restartTimer); this.restartTimer = null;
    this.settleLearn({ ok: false, error: 'Eingabe-Helfer wurde beendet.' });
    this.release();
    const child = this.child;
    if (!child) return Promise.resolve();
    return new Promise(resolve => {
      const timer = setTimeout(() => { try { child.kill(); } catch (_) {} resolve(); }, 2000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
      try { child.stdin.end(); } catch (_) { clearTimeout(timer); resolve(); }
    });
  }
}
module.exports = { WindowsInput, normalizeBinding, normalizeBindings, bindingKey, keyName, watchLine, MAX_BINDINGS };
