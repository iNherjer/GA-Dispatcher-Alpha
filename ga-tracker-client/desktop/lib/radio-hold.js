'use strict';
const { EventEmitter } = require('node:events');
const { normalizeBindings, normalizeProcessName } = require('./windows-input');

const RESUME_SECONDS = Object.freeze([1, 2, 5, 10, 20, 30, 40, 60, 90, 0]);
const DIM_PERCENT = Object.freeze([0, 10, 20, 35, 50]);
const SHORT_PRESS_MS = 600;
const MAX_PROGRAMS = 8;
// Sensitivity combines the peak threshold (0..1 of full scale) and the minimum loud time.
const SENSITIVITY = Object.freeze({
  low: Object.freeze({ threshold: 0.1, minMs: 600 }),
  medium: Object.freeze({ threshold: 0.03, minMs: 300 }),
  high: Object.freeze({ threshold: 0.01, minMs: 100 })
});
const DEFAULTS = Object.freeze({
  enabled: false,
  bindings: [],
  voiceMode: 'pause',
  voiceDimPercent: 20,
  musicMode: 'dim',
  musicDimPercent: 20,
  resumeSeconds: 30,
  shortPressResumes: true,
  detection: Object.freeze({ enabled: false, programs: Object.freeze([]) })
});

function normalizePrograms(value) {
  const list = [], seen = new Set();
  for (const entry of Array.isArray(value) ? value : []) {
    const name = normalizeProcessName(entry?.name);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    list.push({ name, mode: entry.mode === 'dim' ? 'dim' : 'ptt', sensitivity: SENSITIVITY[entry.sensitivity] ? entry.sensitivity : 'medium' });
    if (list.length >= MAX_PROGRAMS) break;
  }
  return list;
}
// Rules for the native meter; empty while the radio hold or the detection is off.
function detectionMeterRules(settings) {
  if (!settings?.enabled || !settings.detection?.enabled) return [];
  return settings.detection.programs.map(program => ({ name: program.name, ...SENSITIVITY[program.sensitivity] }));
}

function normalizeRadioHoldSettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const pick = (key, allowed) => allowed.includes(source[key]) ? source[key] : DEFAULTS[key];
  return {
    enabled: source.enabled === true,
    // Single-binding settings from 1.6.23 migrate into the list.
    bindings: normalizeBindings(Array.isArray(source.bindings) ? source.bindings : source.binding ? [source.binding] : []),
    voiceMode: pick('voiceMode', ['pause', 'dim']),
    voiceDimPercent: pick('voiceDimPercent', DIM_PERCENT),
    musicMode: pick('musicMode', ['pause', 'dim', 'none']),
    musicDimPercent: pick('musicDimPercent', DIM_PERCENT),
    resumeSeconds: pick('resumeSeconds', RESUME_SECONDS),
    shortPressResumes: source.shortPressResumes !== false,
    detection: { enabled: source.detection?.enabled === true, programs: normalizePrograms(source.detection?.programs) }
  };
}

// Radio hold: every press holds tracker audio (voices and warnings) and music.
// Releasing the button never resumes directly, because the reply usually follows;
// the auto-resume timer starts instead and restarts with every further press.
// Optionally, a short press during an existing hold resumes immediately.
// Detected programs (e.g. SayIntentions, Discord) act like a held button while they
// are audible: "ptt" applies the shared rules, "dim" only lowers everything.
class RadioHold extends EventEmitter {
  constructor({ settings, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    super();
    this.now = now; this.setTimer = setTimer; this.clearTimer = clearTimer;
    this.settings = normalizeRadioHoldSettings(settings);
    this.held = false; this.pressed = false; this.pressedAt = 0; this.heldBeforePress = false;
    this.resumeAt = 0; this.timer = null;
    // Audible programs (name -> mode), programs muted by a manual resume until they go quiet,
    // and whether this hold applies the full rules (PTT or a "ptt" program) or only dims.
    this.sources = new Map(); this.suppressed = new Set(); this.full = false;
  }
  get detecting() { return this.settings.enabled && this.settings.detection.enabled && this.settings.detection.programs.length > 0; }
  configure(settings) {
    this.settings = normalizeRadioHoldSettings(settings);
    if (!this.settings.enabled || (!this.settings.bindings.length && !this.detecting)) { this.pressed = false; this.resume('disabled'); return; }
    const programs = new Map(this.detecting ? this.settings.detection.programs.map(program => [program.name.toLowerCase(), program]) : []);
    for (const name of [...this.sources.keys()]) {
      const program = programs.get(name.toLowerCase());
      if (program) this.sources.set(name, program.mode); else this.sources.delete(name);
    }
    if (this.held && !this.pressed && !this.sources.size) this.arm();
    else this.emitState();
  }
  press() {
    if (!this.settings.enabled || this.pressed) return;
    this.pressed = true; this.pressedAt = this.now(); this.heldBeforePress = this.held;
    this.cancelTimer();
    this.held = true; this.full = true;
    this.emitState(this.heldBeforePress ? 'transmit' : 'hold');
  }
  audio(name, active) {
    if (!active) {
      this.suppressed.delete(name);
      if (!this.sources.delete(name)) return;
      if (!this.pressed && !this.sources.size) this.arm('audio-end ' + name);
      else this.emitState('audio-end ' + name);
      return;
    }
    const program = this.detecting && this.settings.detection.programs.find(entry => entry.name.toLowerCase() === name.toLowerCase());
    if (!program || this.suppressed.has(name) || this.sources.has(name)) return;
    this.sources.set(name, program.mode);
    this.cancelTimer();
    if (program.mode === 'ptt') this.full = true;
    const reason = (this.held ? 'audio-join ' : 'audio-start ') + name;
    this.held = true;
    this.emitState(reason);
  }
  releasePress() {
    if (!this.pressed) return;
    this.pressed = false;
    const short = this.now() - this.pressedAt < SHORT_PRESS_MS;
    if (this.heldBeforePress && short && this.settings.shortPressResumes) { this.resume('short-press'); return; }
    if (this.sources.size) { this.emitState('released'); return; }
    this.arm();
  }
  arm(reason = 'released') {
    this.cancelTimer();
    const seconds = this.settings.resumeSeconds;
    if (seconds > 0) {
      this.resumeAt = this.now() + seconds * 1000;
      this.timer = this.setTimer(() => { this.timer = null; this.resume('timer'); }, seconds * 1000);
      this.timer?.unref?.();
    }
    this.emitState(reason);
  }
  resume(reason = 'manual') {
    this.cancelTimer();
    this.pressed = false;
    // A manual resume wins over programs that are still talking until they go quiet.
    for (const name of this.sources.keys()) this.suppressed.add(name);
    this.sources.clear(); this.full = false;
    if (!this.held) { this.emitState(); return; }
    this.held = false;
    this.emitState(reason);
  }
  cancelTimer() { if (this.timer) this.clearTimer(this.timer); this.timer = null; this.resumeAt = 0; }
  publicState() {
    const { settings } = this;
    const voice = !this.held ? null : this.full
      ? { mode: settings.voiceMode, factor: settings.voiceMode === 'dim' ? settings.voiceDimPercent / 100 : 0 }
      : { mode: 'dim', factor: settings.voiceDimPercent / 100 };
    const music = !this.held || settings.musicMode === 'none' ? null
      : { mode: this.full ? settings.musicMode : 'dim', factor: settings.musicDimPercent / 100 };
    return { held: this.held, pressed: this.pressed, resumeAt: this.resumeAt || null, sources: [...this.sources.keys()], voice, music };
  }
  emitState(reason = '') { this.emit('state', { ...this.publicState(), reason }); }
}

// Applies the hold to the Windows music player. Only music the hold itself paused
// is restarted later; a player the user had stopped stays stopped.
function createMusicHold(media, log = () => {}) {
  let queue = Promise.resolve(), pausedByHold = false, dimmed = false;
  const call = async payload => {
    const result = await media.request(payload);
    {
      log('MUSIC ' + payload.action + (payload.active !== undefined ? ' active=' + payload.active : '') + (payload.factor !== undefined ? ' factor=' + payload.factor : '')
        + ' ok=' + (result?.ok === true) + (result?.error ? ' error=' + result.error : '') + (payload.action === 'snapshot' ? ' playing=' + (result?.playing === true) + ' volumeSession=' + (result?.volumeAvailable === true) : ''));
    }
    return result;
  };
  const run = async music => {
    if (music && music.mode === 'dim') { const first = !dimmed; dimmed = true; if (first) log('MUSIC dim start factor=' + music.factor); await call({ action: 'hold', active: true, factor: music.factor }); }
    else if (dimmed) { dimmed = false; log('MUSIC dim end'); await call({ action: 'hold', active: false }); }
    if (music && music.mode === 'pause' && !pausedByHold) {
      const snapshot = await call({ action: 'snapshot' });
      if (snapshot?.ok && snapshot.playing) pausedByHold = (await call({ action: 'pause' }))?.ok === true;
    } else if ((!music || music.mode !== 'pause') && pausedByHold) {
      pausedByHold = false;
      await call({ action: 'play' });
    }
  };
  return music => { const next = queue.then(() => run(music)).catch(() => {}); queue = next; return next; };
}

module.exports = { RadioHold, createMusicHold, normalizeRadioHoldSettings, detectionMeterRules, SENSITIVITY, MAX_PROGRAMS, RESUME_SECONDS, DIM_PERCENT, SHORT_PRESS_MS, DEFAULTS };
