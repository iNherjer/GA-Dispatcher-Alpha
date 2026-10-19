'use strict';
const { EventEmitter } = require('node:events');
const { normalizeBindings } = require('./windows-input');

const RESUME_SECONDS = Object.freeze([10, 20, 30, 40, 60, 90, 0]);
const DIM_PERCENT = Object.freeze([0, 10, 20, 35, 50]);
const SHORT_PRESS_MS = 600;
const DEFAULTS = Object.freeze({
  enabled: false,
  bindings: [],
  voiceMode: 'pause',
  voiceDimPercent: 20,
  musicMode: 'dim',
  musicDimPercent: 20,
  resumeSeconds: 30,
  shortPressResumes: true
});

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
    shortPressResumes: source.shortPressResumes !== false
  };
}

// Radio hold: every press holds tracker audio (voices and warnings) and music.
// Releasing the button never resumes directly, because the reply usually follows;
// the auto-resume timer starts instead and restarts with every further press.
// Optionally, a short press during an existing hold resumes immediately.
class RadioHold extends EventEmitter {
  constructor({ settings, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    super();
    this.now = now; this.setTimer = setTimer; this.clearTimer = clearTimer;
    this.settings = normalizeRadioHoldSettings(settings);
    this.held = false; this.pressed = false; this.pressedAt = 0; this.heldBeforePress = false;
    this.resumeAt = 0; this.timer = null;
  }
  configure(settings) {
    this.settings = normalizeRadioHoldSettings(settings);
    if (!this.settings.enabled || !this.settings.bindings.length) { this.pressed = false; this.resume('disabled'); return; }
    if (this.held && !this.pressed) this.arm();
    else this.emitState();
  }
  press() {
    if (!this.settings.enabled || this.pressed) return;
    this.pressed = true; this.pressedAt = this.now(); this.heldBeforePress = this.held;
    this.cancelTimer();
    this.held = true;
    this.emitState(this.heldBeforePress ? 'transmit' : 'hold');
  }
  releasePress() {
    if (!this.pressed) return;
    this.pressed = false;
    const short = this.now() - this.pressedAt < SHORT_PRESS_MS;
    if (this.heldBeforePress && short && this.settings.shortPressResumes) { this.resume('short-press'); return; }
    this.arm();
  }
  arm() {
    this.cancelTimer();
    const seconds = this.settings.resumeSeconds;
    if (seconds > 0) {
      this.resumeAt = this.now() + seconds * 1000;
      this.timer = this.setTimer(() => { this.timer = null; this.resume('timer'); }, seconds * 1000);
      this.timer?.unref?.();
    }
    this.emitState('released');
  }
  resume(reason = 'manual') {
    this.cancelTimer();
    this.pressed = false;
    if (!this.held) { this.emitState(); return; }
    this.held = false;
    this.emitState(reason);
  }
  cancelTimer() { if (this.timer) this.clearTimer(this.timer); this.timer = null; this.resumeAt = 0; }
  publicState() {
    const { settings } = this;
    return {
      held: this.held, pressed: this.pressed, resumeAt: this.resumeAt || null,
      voice: this.held ? { mode: settings.voiceMode, factor: settings.voiceMode === 'dim' ? settings.voiceDimPercent / 100 : 0 } : null,
      music: this.held && settings.musicMode !== 'none' ? { mode: settings.musicMode, factor: settings.musicDimPercent / 100 } : null
    };
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

module.exports = { RadioHold, createMusicHold, normalizeRadioHoldSettings, RESUME_SECONDS, DIM_PERCENT, SHORT_PRESS_MS, DEFAULTS };
