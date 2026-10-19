'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');
const { WindowsInput, normalizeBinding, watchLine } = require('../lib/windows-input');

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
  f.input.watch({ type: 'key', vk: 0x70 });
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
  const script = `$ErrorActionPreference='Stop'; Add-Type -Path '${source}'; if ([GAInput.Helper]::Run -eq $null) { throw 'missing' }; 'INPUT_HELPER_OK'`;
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
