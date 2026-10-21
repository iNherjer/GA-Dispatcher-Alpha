'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { RadioHold, createMusicHold, normalizeRadioHoldSettings, detectionMeterRules } = require('../lib/radio-hold');

const binding = { type: 'joystick', device: 0, mid: 1103, pid: 46629, button: 4, name: 'Stick' };
function fixture(settings = {}) {
  let time = 1000; const timers = new Map(); let next = 1; const states = [];
  const hold = new RadioHold({ settings: { enabled: true, bindings: [binding], ...settings }, now: () => time,
    setTimer: (fn, ms) => { const id = next++; timers.set(id, { fn, at: time + ms }); return id; },
    clearTimer: id => timers.delete(id) });
  hold.on('state', state => states.push(state));
  const advance = ms => {
    time += ms;
    for (const [id, timer] of [...timers]) if (timer.at <= time) { timers.delete(id); timer.fn(); }
  };
  return { hold, advance, states, timers };
}

test('settings fall back to safe defaults; 30 s and dimmed music are the default', () => {
  const settings = normalizeRadioHoldSettings({ resumeSeconds: 33, voiceMode: 'loud', musicDimPercent: 77, binding: { type: 'key', vk: 1 } });
  assert.equal(settings.resumeSeconds, 30);
  assert.equal(settings.voiceMode, 'pause');
  assert.equal(settings.musicMode, 'dim');
  assert.equal(settings.musicDimPercent, 20);
  assert.deepEqual(settings.bindings, [], 'mouse buttons are not bindable');
  assert.equal(settings.shortPressResumes, true);
  assert.equal(normalizeRadioHoldSettings({ resumeSeconds: 0 }).resumeSeconds, 0);
});

test('1.6.23 single binding migrates; duplicates collapse and the list is capped at 8', () => {
  assert.equal(normalizeRadioHoldSettings({ binding: { type: 'key', vk: 0x4E } }).bindings[0].label, 'Taste N');
  const keys = Array.from({ length: 12 }, (_, index) => ({ type: 'key', vk: 0x41 + index }));
  const settings = normalizeRadioHoldSettings({ bindings: [binding, { ...binding, device: 3 }, ...keys] });
  assert.equal(settings.bindings.length, 8);
  assert.equal(settings.bindings.filter(entry => entry.type === 'joystick').length, 1, 'same stick button on another id is a duplicate');
});

test('a press holds immediately; release starts the timer instead of resuming', () => {
  const { hold, advance } = fixture();
  hold.press();
  assert.equal(hold.publicState().held, true);
  assert.deepEqual(hold.publicState().voice, { mode: 'pause', factor: 0 });
  advance(4000); hold.releasePress();
  assert.equal(hold.publicState().held, true, 'the reply on the radio must not be talked over');
  advance(29000); assert.equal(hold.publicState().held, true);
  advance(1000); assert.equal(hold.publicState().held, false);
});

test('every new transmission restarts the timer', () => {
  const { hold, advance } = fixture({ resumeSeconds: 10 });
  hold.press(); advance(2000); hold.releasePress();
  advance(8000); hold.press(); advance(3000); hold.releasePress();
  advance(9000); assert.equal(hold.publicState().held, true);
  advance(1000); assert.equal(hold.publicState().held, false);
});

test('a short press during a hold resumes at once, only when enabled', () => {
  const on = fixture();
  on.hold.press(); on.advance(2000); on.hold.releasePress();
  on.advance(5000); on.hold.press(); on.advance(200); on.hold.releasePress();
  assert.equal(on.hold.publicState().held, false);
  assert.equal(on.states.at(-1).reason, 'short-press');

  const off = fixture({ shortPressResumes: false });
  off.hold.press(); off.advance(2000); off.hold.releasePress();
  off.hold.press(); off.advance(200); off.hold.releasePress();
  assert.equal(off.hold.publicState().held, true);
});

test('a short first press still holds; "off" waits for a manual resume', () => {
  const { hold, advance, timers } = fixture({ resumeSeconds: 0 });
  hold.press(); advance(150); hold.releasePress();
  assert.equal(hold.publicState().held, true);
  assert.equal(timers.size, 0);
  advance(600000); assert.equal(hold.publicState().held, true);
  hold.resume('manual'); assert.equal(hold.publicState().held, false);
});

test('disabling releases an active hold; music and voice modes are reported', () => {
  const { hold } = fixture({ voiceMode: 'dim', voiceDimPercent: 35, musicMode: 'pause' });
  hold.press();
  assert.deepEqual(hold.publicState().voice, { mode: 'dim', factor: 0.35 });
  assert.equal(hold.publicState().music.mode, 'pause');
  hold.configure({ enabled: false, bindings: [binding] });
  assert.equal(hold.publicState().held, false);
  hold.press(); assert.equal(hold.publicState().held, false);
});

test('music hold restarts only music it paused itself', async () => {
  const calls = []; let playing = true;
  const music = createMusicHold({ request: async command => { calls.push(command.action); if (command.action === 'snapshot') return { ok: true, playing }; return { ok: true }; } });
  await music({ mode: 'pause', factor: 0.2 });
  await music({ mode: 'pause', factor: 0.2 });
  await music(null);
  assert.deepEqual(calls, ['snapshot', 'pause', 'play']);
  calls.length = 0; playing = false;
  await music({ mode: 'pause', factor: 0.2 }); await music(null);
  assert.deepEqual(calls, ['snapshot'], 'a stopped player stays stopped');
  calls.length = 0;
  await music({ mode: 'dim', factor: 0.1 }); await music(null);
  assert.deepEqual(calls, ['hold', 'hold']);
});
test('a 1 s auto-resume is available for quick radio calls', () => {
  assert.equal(normalizeRadioHoldSettings({ resumeSeconds: 1 }).resumeSeconds, 1);
  for (const seconds of [2, 5]) assert.equal(normalizeRadioHoldSettings({ resumeSeconds: seconds }).resumeSeconds, seconds);
  const { hold, advance } = fixture({ resumeSeconds: 1 });
  hold.press(); advance(2000); hold.releasePress();
  advance(999); assert.equal(hold.publicState().held, true);
  advance(1); assert.equal(hold.publicState().held, false);
});

const programs = (extra = {}) => ({ detection: { enabled: true, programs: [
  { name: 'SayIntentionsAI', mode: 'ptt', sensitivity: 'medium' },
  { name: 'Discord', mode: 'dim', sensitivity: 'high' }] }, ...extra });

test('program rules normalize, dedupe and translate sensitivity into meter rules', () => {
  const settings = normalizeRadioHoldSettings({ enabled: true, detection: { enabled: true, programs: [
    { name: 'Discord', mode: 'loud', sensitivity: 'x' }, { name: 'discord' }, { name: 'bad:name' }, { name: 'SayIntentionsAI', mode: 'dim', sensitivity: 'low' }] } });
  assert.deepEqual(settings.detection.programs, [{ name: 'Discord', mode: 'ptt', sensitivity: 'medium', triggerMs: 300 }, { name: 'SayIntentionsAI', mode: 'dim', sensitivity: 'low', triggerMs: 600 }],
    'programs saved before 1.6.31 keep their former delay');
  assert.deepEqual(detectionMeterRules(settings), [{ name: 'Discord', threshold: 0.03, minMs: 300 }, { name: 'SayIntentionsAI', threshold: 0.1, minMs: 600 }]);
  assert.deepEqual(detectionMeterRules({ ...settings, enabled: false }), [], 'no metering while the radio hold is off');
  assert.deepEqual(normalizeRadioHoldSettings({}).detection, { enabled: false, programs: [] });
});

test('a "Wie PTT" program holds with the shared rules and resumes through the timer after it goes quiet', () => {
  const { hold, advance, states } = fixture({ bindings: [], resumeSeconds: 10, ...programs() });
  hold.audio('SayIntentionsAI', true);
  assert.equal(hold.publicState().held, true);
  assert.deepEqual(hold.publicState().voice, { mode: 'pause', factor: 0 });
  assert.deepEqual(hold.publicState().sources, ['SayIntentionsAI']);
  advance(60000); assert.equal(hold.publicState().held, true, 'no timer while the program still talks');
  hold.audio('SayIntentionsAI', false);
  assert.equal(states.at(-1).reason, 'audio-end SayIntentionsAI');
  advance(9999); assert.equal(hold.publicState().held, true);
  advance(1); assert.equal(hold.publicState().held, false);
});

test('a "Nur leiser" program only dims voices and music, PTT upgrades the hold to the full rules', () => {
  const { hold } = fixture({ musicMode: 'pause', ...programs() });
  hold.audio('Discord', true);
  assert.deepEqual(hold.publicState().voice, { mode: 'dim', factor: 0.2 });
  assert.equal(hold.publicState().music.mode, 'dim', 'dim-only programs never pause the music');
  hold.press();
  assert.deepEqual(hold.publicState().voice, { mode: 'pause', factor: 0 });
  assert.equal(hold.publicState().music.mode, 'pause');
});

test('PTT and programs combine: resume waits for the button and every program', () => {
  const { hold, advance } = fixture({ resumeSeconds: 1, ...programs() });
  hold.press(); hold.audio('Discord', true); advance(2000); hold.releasePress();
  advance(5000); assert.equal(hold.publicState().held, true, 'Discord still audible');
  hold.audio('Discord', false); advance(1000);
  assert.equal(hold.publicState().held, false);
});

test('a short press resumes over a talking program until it goes quiet; unknown programs are ignored', () => {
  const { hold, advance } = fixture(programs());
  hold.audio('SayIntentionsAI', true);
  hold.press(); advance(100); hold.releasePress();
  assert.equal(hold.publicState().held, false);
  hold.audio('SayIntentionsAI', true);
  assert.equal(hold.publicState().held, false, 'the same phase stays suppressed');
  hold.audio('SayIntentionsAI', false); hold.audio('SayIntentionsAI', true);
  assert.equal(hold.publicState().held, true, 'the next phase holds again');
  hold.resume('manual');
  hold.audio('Spotify', true);
  assert.equal(hold.publicState().held, false);
});

test('removing a program or disabling detection releases its hold', () => {
  const { hold, advance } = fixture({ resumeSeconds: 1, ...programs() });
  hold.audio('Discord', true);
  hold.configure({ enabled: true, bindings: [binding], resumeSeconds: 1, detection: { enabled: true, programs: [{ name: 'SayIntentionsAI' }] } });
  advance(1000); assert.equal(hold.publicState().held, false);
  hold.audio('SayIntentionsAI', true);
  hold.configure({ enabled: true, bindings: [], detection: { enabled: false, programs: [{ name: 'SayIntentionsAI' }] } });
  assert.equal(hold.publicState().held, false, 'no button and no detection disables the hold');
});

test('the trigger delay is chosen per program and independent of the sensitivity', () => {
  const settings = normalizeRadioHoldSettings({ enabled: true, detection: { enabled: true, programs: [
    { name: 'Discord', sensitivity: 'high', triggerMs: 1000 }, { name: 'SayIntentionsAI', sensitivity: 'low', triggerMs: 0 }, { name: 'X', triggerMs: 777 }] } });
  assert.deepEqual(detectionMeterRules(settings), [
    { name: 'Discord', threshold: 0.01, minMs: 1000 }, { name: 'SayIntentionsAI', threshold: 0.1, minMs: 0 }, { name: 'X', threshold: 0.03, minMs: 300 }]);
});
