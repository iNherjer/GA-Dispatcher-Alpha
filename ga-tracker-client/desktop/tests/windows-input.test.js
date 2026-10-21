'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');
const { WindowsInput, normalizeBinding, watchLine, meterLine, normalizeProcessName } = require('../lib/windows-input');

function fixture() {
  const child = new EventEmitter(), lines = [];
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.stdin = new Writable({ write(chunk, _e, done) { lines.push(...String(chunk).trim().split('\n')); done(); },
    final(done) { setImmediate(() => child.emit('exit', 0)); done(); } });
  let spawns = 0;
  const input = new WindowsInput({ platform: 'win32', restartDelayMs: 5, spawnProcess: () => { spawns++; return child; } });
  const emit = message => child.stdout.write(JSON.stringify(message) + '\n');
  return { input, child, lines, emit, spawns: () => spawns };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 10));

test('non-Windows never spawns a helper', async () => {
  const input = new WindowsInput({ platform: 'darwin', spawnProcess() { throw new Error('must not spawn'); } });
  input.watch({ type: 'key', vk: 0x70 });
  assert.equal((await input.learn()).unsupported, true);
});

test('bindings are validated and serialized as numbers only', () => {
  assert.equal(normalizeBinding({ type: 'key', vk: 2 }), null);
  assert.equal(normalizeBinding({ type: 'joystick', device: 0, mid: 1, pid: 2, button: 40 }), null);
  assert.equal(normalizeBinding({ type: 'key', vk: '0x70; calc' }), null);
  const stick = normalizeBinding({ type: 'joystick', device: 1, mid: 1103, pid: 46629, button: 0, name: 'T.16000M\n' });
  assert.equal(stick.label, 'T.16000M · Button 1');
  assert.equal(watchLine(stick), 'watch joy 1103 46629 1 0');
  assert.equal(watchLine([stick, { type: 'key', vk: 0x4E }, { type: 'key', vk: 2 }]), 'watch joy 1103 46629 1 0;key 78');
  assert.equal(watchLine([]), 'idle');
  assert.equal(normalizeBinding({ type: 'key', vk: 0x70 }).label, 'Taste F1');
});

test('down/up events are forwarded once and a lost helper releases the button', async () => {
  const f = fixture(); const events = [];
  f.input.on('down', () => events.push('down')); f.input.on('up', () => events.push('up'));
  f.input.watch({ type: 'key', vk: 0x70 });
  assert.deepEqual(f.lines, ['watch key 112']);
  f.emit({ event: 'down' }); f.emit({ event: 'down' }); await tick();
  assert.deepEqual(events, ['down']);
  f.child.emit('exit', 1); await tick();
  assert.deepEqual(events, ['down', 'up'], 'a crashed helper must not leave audio held forever');
});

test('learning resolves the binding and restores the previous watch', async () => {
  const f = fixture();
  f.input.watch([{ type: 'key', vk: 0x70 }]);
  const learned = f.input.learn();
  f.emit({ event: 'learn', ok: true, binding: { type: 'joystick', device: 0, mid: 1, pid: 2, button: 3, name: 'Stick' } });
  const result = await learned;
  assert.equal(result.ok, true);
  assert.equal(result.binding.button, 3);
  assert.deepEqual(f.lines, ['watch key 112', 'learn', 'watch key 112']);
});

test('native input helper compiles under Windows PowerShell', { skip: process.platform !== 'win32' }, () => {
  const { spawnSync } = require('node:child_process'), path = require('node:path');
  const source = path.join(__dirname, '../lib/windows-input.cs').replaceAll("'", "''");
  const meter = path.join(__dirname, '../lib/windows-audio-meter.cs').replaceAll("'", "''");
  const script = `$ErrorActionPreference='Stop'; Add-Type -Path @('${source}','${meter}'); if ([GAInput.AudioMeter] -eq $null) { throw 'missing' }; 'INPUT_HELPER_OK'`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /INPUT_HELPER_OK/);
});

test('helper compile errors, device logs and press durations reach the diagnostic log', async () => {
  const child = new EventEmitter(), logs = [];
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.stdin = new Writable({ write(_c, _e, done) { done(); } });
  const input = new WindowsInput({ platform: 'win32', restartDelayMs: 60000, spawnProcess: () => child, log: line => logs.push(line) });
  input.watch({ type: 'key', vk: 0x70 });
  child.stderr.write('Add-Type : c:\\x\\windows-input.cs(12) : error CS1002: ; expected\r\n');
  child.stdout.write(JSON.stringify({ event: 'log', message: 'joysticks found=2' }) + '\n');
  child.stdout.write(JSON.stringify({ event: 'down' }) + '\n');
  child.stdout.write(JSON.stringify({ event: 'up' }) + '\n');
  await tick();
  child.emit('exit', 1); await tick();
  const text = logs.join('\n');
  assert.match(text, /INPUT helper stderr Add-Type .*CS1002/);
  assert.match(text, /INPUT joysticks found=2/);
  assert.match(text, /INPUT button down/);
  assert.match(text, /INPUT button up heldMs=\d+/);
  assert.match(text, /INPUT helper ended code=1/);
  await input.close();
});

test('meter commands carry validated names and numbers only', () => {
  assert.equal(normalizeProcessName('SayIntentionsAI'), 'SayIntentionsAI');
  assert.equal(normalizeProcessName('evil;meter off'), '');
  assert.equal(normalizeProcessName('a:b'), '');
  assert.equal(meterLine([{ name: 'Discord', threshold: 0.03, minMs: 300 }, { name: 'x;y', threshold: 1, minMs: 1 }]), 'meter watch Discord:0.03:300');
  assert.equal(meterLine([], false), 'meter off');
  assert.equal(meterLine([{ name: 'Discord', threshold: 0.01, minMs: 100 }], true), 'meter list Discord:0.01:100');
  assert.equal(meterLine([], true), 'meter list');
});

test('audio events reach listeners once, are logged and end when the helper is lost', async () => {
  const child = new EventEmitter(), logs = [], lines = [], events = [];
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.stdin = new Writable({ write(chunk, _e, done) { lines.push(...String(chunk).trim().split('\n')); done(); } });
  const input = new WindowsInput({ platform: 'win32', restartDelayMs: 60000, spawnProcess: () => child, log: line => logs.push(line) });
  input.on('audio', event => events.push(event.name + ':' + event.active));
  input.meter([{ name: 'Discord', threshold: 0.03, minMs: 300 }]);
  assert.deepEqual(lines, ['meter watch Discord:0.03:300'], 'metering alone starts the helper');
  const emit = message => child.stdout.write(JSON.stringify(message) + '\n');
  emit({ event: 'audio', name: 'Discord', active: true, peak: 0.2 });
  emit({ event: 'audio', name: 'Discord', active: true, peak: 0.2 });
  emit({ event: 'levels', sessions: [{ name: 'Discord', peak: 0.2 }, { name: 'bad;name', peak: 1 }] });
  await tick();
  assert.deepEqual(events, ['Discord:true']);
  assert.ok(logs.some(line => /INPUT audio start name=Discord peak=0.200/.test(line)));
  assert.ok(!logs.some(line => /levels/.test(line)), 'live levels are not written to the log');
  child.emit('exit', 1); await tick();
  assert.deepEqual(events, ['Discord:true', 'Discord:false'], 'a lost helper must not hold audio forever');
  await input.close();
});

test('removing a rule ends its audible state', () => {
  const child = new EventEmitter();
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.stdin = new Writable({ write(_c, _e, done) { done(); } });
  const input = new WindowsInput({ platform: 'win32', spawnProcess: () => child });
  const events = []; input.on('audio', event => events.push(event.name + ':' + event.active));
  input.meter([{ name: 'Discord', threshold: 0.03, minMs: 300 }]);
  input.handle({ event: 'audio', name: 'Discord', active: true });
  input.meter([]);
  assert.deepEqual(events, ['Discord:true', 'Discord:false']);
});
