const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { TrackerRuntimeManager, sha256Buffer, validateChannel } = require('../lib/runtime-manager');

function channel(versionCode, payload) {
  const version = `v${versionCode}`;
  return {
    schemaVersion: 1,
    publishedAt: '2026-07-28T00:00:00Z',
    version,
    versionCode,
    releaseTag: version,
    asset: {
      name: 'VFR-Multitool-Tracker.exe',
      url: `https://github.com/iNherjer/GA-Dispatcher-Alpha/releases/download/${version}/VFR-Multitool-Tracker.exe`,
      size: payload.length,
      sha256: sha256Buffer(payload)
    }
  };
}

function requestFor(channelValue, payload) {
  return async (url, options = {}) => {
    if (String(url).includes('raw.githubusercontent.com')) return Buffer.from(JSON.stringify(channelValue));
    options.onProgress?.(payload.length, payload.length);
    return payload;
  };
}

test('tracker channel only accepts matching immutable GitHub release metadata', () => {
  const payload = Buffer.from('tracker-v314');
  assert.equal(validateChannel(channel(314, payload)).versionCode, 314);
  assert.throws(() => validateChannel({ ...channel(314, payload), releaseTag: 'v315' }), /Release-Tag/);
  const foreign = channel(314, payload);
  foreign.asset.url = 'https://example.com/tracker.exe';
  assert.throws(() => validateChannel(foreign), /GitHub/);
});

test('first start downloads, hashes and activates an unbundled tracker runtime', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfr-runtime-'));
  const payload = Buffer.from('tracker-v314-binary');
  const stable = channel(314, payload);
  const manager = new TrackerRuntimeManager({
    runtimeRoot: root,
    request: requestFor(stable, payload),
    getUpdatePolicy: () => 'ask'
  });

  const installed = await manager.ensureReady();
  assert.equal(installed.descriptor.version, 'v314');
  assert.deepEqual(fs.readFileSync(installed.executable), payload);
  assert.equal(manager.currentExecutablePath(), installed.executable);
  assert.equal(manager.publicState().phase, 'current');
});

test('future tracker update asks once and preserves the previous verified runtime', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfr-runtime-'));
  const firstPayload = Buffer.from('tracker-v314-binary');
  const first = channel(314, firstPayload);
  const firstManager = new TrackerRuntimeManager({
    runtimeRoot: root,
    request: requestFor(first, firstPayload),
    getUpdatePolicy: () => 'ask'
  });
  await firstManager.ensureReady();

  const secondPayload = Buffer.from('tracker-v315-binary');
  const second = channel(315, secondPayload);
  let policy = 'ask';
  const manager = new TrackerRuntimeManager({
    runtimeRoot: root,
    request: requestFor(second, secondPayload),
    getUpdatePolicy: () => policy,
    saveUpdatePolicy: (next) => { policy = next; }
  });
  const startup = manager.ensureReady();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(manager.publicState().phase, 'choice-required');
  const choice = await manager.handleChoice('automatic');
  assert.equal(choice.ok, true);
  assert.equal(policy, 'automatic');
  const installed = await startup;
  assert.equal(installed.descriptor.version, 'v315');
  const state = JSON.parse(fs.readFileSync(path.join(root, 'runtime-state.json'), 'utf8'));
  assert.equal(state.current.version, 'v315');
  assert.equal(state.previous.version, 'v314');
});

test('invalid runtime hash is rejected without activation', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfr-runtime-'));
  const expected = Buffer.from('expected-runtime');
  const stable = channel(314, expected);
  const manager = new TrackerRuntimeManager({
    runtimeRoot: root,
    request: requestFor(stable, Buffer.from('tampered-runtime')),
    getUpdatePolicy: () => 'automatic'
  });
  await assert.rejects(() => manager.ensureReady(), /Dateigröße|SHA-256/);
  assert.equal(manager.currentExecutablePath(), '');
});

test('current Alpha binary size fits bounded runtime download policy', () => {
  const alpha = require('../../channel/alpha.json');
  assert.equal(validateChannel(alpha).version, alpha.version);
  const oversized = structuredClone(alpha);
  oversized.asset.size = 256 * 1024 * 1024 + 1;
  assert.throws(() => validateChannel(oversized), /Dateigröße/);
});

test('channel validation failure preserves installed runtime and reports actual cause, not deferral', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfr-runtime-error-'));
  t.after(() => fs.rmSync(root,{recursive:true,force:true}));
  const payload=Buffer.from('existing-runtime');
  const first=new TrackerRuntimeManager({runtimeRoot:root,request:requestFor(channel(435,payload),payload)});
  const installed=await first.ensureReady();
  const bad=channel(445,payload);bad.asset.size=256*1024*1024+1;
  const manager=new TrackerRuntimeManager({runtimeRoot:root,request:requestFor(bad,payload)});
  const fallback=await manager.ensureReady({force:true});
  assert.equal(fallback.executable,installed.executable);
  assert.equal(manager.publicState().phase,'error');
  assert.match(manager.publicState().message,/Dateigröße/);
  assert.match(manager.publicState().message,/v435/);
  assert.doesNotMatch(manager.publicState().message,/nicht erreichbar/);
  manager.request=async()=>{throw new Error('DNS lookup failed');};
  await manager.ensureReady({force:true});
  assert.match(manager.publicState().message,/DNS lookup failed/);
});
