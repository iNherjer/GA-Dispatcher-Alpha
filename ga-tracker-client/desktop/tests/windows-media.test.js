'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');
const { WindowsMedia } = require('../lib/windows-media');

function fixture() {
  const child = new EventEmitter(), commands = [];
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.stdin = new Writable({ write(chunk, _encoding, done) {
    const request = JSON.parse(String(chunk)); commands.push(request);
    setImmediate(() => child.stdout.write(JSON.stringify({ id: request.id, ok: true, source: 'Spotify.exe' }) + '\n'));
    done();
  }, final(done) { setImmediate(() => child.emit('exit', 0)); done(); } });
  let spec;
  const media = new WindowsMedia({ platform: 'win32', spawnProcess: (...args) => { spec = args; return child; } });
  return { media, child, commands, spec: () => spec };
}
test('non-Windows reports unsupported without launching a helper', async () => {
  const media = new WindowsMedia({ platform: 'darwin', spawnProcess() { throw new Error('must not spawn'); } });
  assert.equal((await media.request({ action: 'snapshot' })).unsupported, true);
});
test('commands are serialized as data, with a fixed helper executable and file', async () => {
  const f = fixture();
  const source = 'player.exe; $(Write-Host injected)';
  const results = await Promise.all([f.media.request({ action: 'select', source }), f.media.request({ action: 'next' })]);
  assert.ok(results.every(result => result.ok));
  assert.deepEqual(f.commands.map(command => command.action), ['select','next']);
  assert.equal(f.commands[0].source, source);
  assert.equal(f.spec()[0], 'powershell.exe');
  assert.ok(!f.spec()[1].join(' ').includes(source));
  assert.equal(f.spec()[2].windowsHide, true);
  await f.media.close();
});
test('invalid requests cannot trigger a native command', async () => {
  const f = fixture();
  for (const command of [null, { action: 'shell' }, { action: 'select', source: {} }, { action:'volume', volume: -1 },
    { action:'volume', volume: Infinity }, { action:'settings', factor: 2 }]) assert.equal((await f.media.request(command)).ok, false);
  assert.equal(f.commands.length, 0);
});
test('helper failures settle pending requests and can reconnect', async () => {
  const f = fixture();
  f.child.stdin = new Writable({ write(_chunk,_encoding,done) { done(); } });
  const pending = f.media.request({ action: 'snapshot' });
  await new Promise(resolve => setImmediate(resolve));
  f.child.emit('error', new Error('helper unavailable'));
  assert.equal((await pending).ok, false);
  assert.equal(f.media.pending.size, 0);
  assert.equal(f.media.child, null);
});
test('shutdown sends EOF for native volume restoration and rejects later commands', async () => {
  const f = fixture(); await f.media.request({ action: 'snapshot' });
  await f.media.close();
  assert.equal(f.child.stdin.writableEnded, true);
  assert.equal((await f.media.request({ action: 'duck', active: true })).ok, false);
});
test('one audio client cannot release attenuation still owned by another', async () => {
  const f=fixture();
  await f.media.request({action:'duck',active:true,clientId:'desktop'});
  await f.media.request({action:'duck',active:true,clientId:'remote-web'});
  await f.media.request({action:'duck',active:false,clientId:'desktop'});
  assert.equal(f.commands.at(-1).active,true);
  await f.media.request({action:'duck',active:false,clientId:'remote-web'});
  assert.equal(f.commands.at(-1).active,false);
  await f.media.close();
});

test('seek serializes a source-bound target and rejects invalid positions before native dispatch',async()=>{
 const f=fixture();for(const positionSeconds of [-1,86400,Infinity,NaN,'10',null])assert.equal((await f.media.request({action:'seek',source:'Chrome',positionSeconds})).ok,false);
 assert.equal(f.commands.length,0);await f.media.request({action:'seek',source:'Chrome',positionSeconds:123.5});
 assert.equal(f.commands[0].positionSeconds,123.5);assert.equal(f.commands[0].source,'Chrome');await f.media.close();
});
