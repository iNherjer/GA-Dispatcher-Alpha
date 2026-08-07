const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  EFB_PACKAGE_NAME,
  EFB_REQUIRED_FILES,
  EfbPackageManager,
  validateEfbChannel
} = require('../lib/efb-package-manager');

function writePackage(packageRoot, version = '0.1.0') {
  const content = [];
  for (const relative of EFB_REQUIRED_FILES) {
    const file = path.join(packageRoot, ...relative.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const value = Buffer.from(`fixture:${relative}`);
    fs.writeFileSync(file, value);
    content.push({ path: relative, size: value.length, date: 0 });
  }
  fs.writeFileSync(path.join(packageRoot, 'manifest.json'), JSON.stringify({ package_version: version }));
  fs.writeFileSync(path.join(packageRoot, 'layout.json'), JSON.stringify({ content }));
}

function descriptor(archive) {
  return {
    schemaVersion: 1,
    channel: 'alpha',
    available: true,
    packageName: EFB_PACKAGE_NAME,
    packageVersion: '0.1.0',
    releaseTag: 'efb-app-v0.1.0',
    publishedAt: '2026-08-07T00:00:00Z',
    archive: {
      name: `${EFB_PACKAGE_NAME}-0.1.0.zip`,
      url: `https://github.com/iNherjer/GA-Dispatcher-Alpha/releases/download/efb-app-v0.1.0/${EFB_PACKAGE_NAME}-0.1.0.zip`,
      size: archive.length,
      sha256: crypto.createHash('sha256').update(archive).digest('hex')
    }
  };
}

test('EFB package manager installs, detects damage, repairs and uninstalls only its package', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfr-efb-manager-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const community = path.join(root, 'Community2024');
  const runtime = path.join(root, 'runtime');
  fs.mkdirSync(community, { recursive: true });
  fs.mkdirSync(path.join(community, 'unrelated-package'), { recursive: true });
  const archive = Buffer.from('verified-efb-archive');
  const channel = descriptor(archive);
  const manager = new EfbPackageManager({
    runtimeDirectory: runtime,
    channel: 'alpha',
    resolveCommunityPath: () => community,
    request: async (url) => Buffer.from(url.includes('/releases/download/') ? archive : JSON.stringify(channel)),
    extractArchive: (_buffer, target) => {
      const packageRoot = path.join(target, EFB_PACKAGE_NAME);
      fs.mkdirSync(packageRoot, { recursive: true });
      writePackage(packageRoot);
      return { names: [EFB_PACKAGE_NAME, ...EFB_REQUIRED_FILES.map((file) => `${EFB_PACKAGE_NAME}/${file}`)] };
    }
  });

  assert.equal((await manager.refresh()).ok, true);
  assert.equal(manager.publicState().remoteVersion, '0.1.0');
  const installed = await manager.install();
  assert.equal(installed.ok, true);
  assert.equal(manager.publicState().installedComplete, true);

  const appJs = path.join(community, EFB_PACKAGE_NAME, ...EFB_REQUIRED_FILES[0].split('/'));
  fs.appendFileSync(appJs, 'corrupt');
  assert.equal(manager.inspect().installedComplete, false);
  assert.equal((await manager.install({ repair: true })).ok, true);
  assert.equal(manager.publicState().installedComplete, true);

  assert.equal((await manager.uninstall()).removed, true);
  assert.equal(fs.existsSync(path.join(community, EFB_PACKAGE_NAME)), false);
  assert.equal(fs.existsSync(path.join(community, 'unrelated-package')), true);
});

test('unavailable channels are valid but cannot be installed', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfr-efb-unavailable-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const channel = {
    schemaVersion: 1,
    channel: 'stable',
    available: false,
    packageName: EFB_PACKAGE_NAME,
    message: 'Noch nicht freigegeben.'
  };
  const manager = new EfbPackageManager({
    runtimeDirectory: path.join(root, 'runtime'),
    channel: 'stable',
    resolveCommunityPath: () => root,
    request: async () => Buffer.from(JSON.stringify(channel)),
    extractArchive: () => { throw new Error('darf nicht aufgerufen werden'); }
  });
  assert.equal((await manager.refresh()).ok, true);
  assert.equal(manager.publicState().remoteAvailable, false);
  const result = await manager.install();
  assert.equal(result.ok, false);
  assert.equal(result.code, 'EFB_CHANNEL_UNAVAILABLE');
});

test('EFB channel pins archive name, release tag and immutable GitHub URL', () => {
  const archive = Buffer.from('archive');
  const valid = descriptor(archive);
  assert.equal(validateEfbChannel(valid, 'alpha').packageVersion, '0.1.0');
  assert.throws(() => validateEfbChannel({ ...valid, archive: { ...valid.archive, url: 'https://example.com/app.zip' } }, 'alpha'), /GitHub/);
  assert.throws(() => validateEfbChannel({ ...valid, releaseTag: 'latest' }, 'alpha'), /Release-Tag/);
  assert.throws(() => validateEfbChannel({ ...valid, channel: 'stable' }, 'alpha'), /gewaehlten Kanal/);
  assert.throws(() => validateEfbChannel({ ...valid, channel: 'preview' }, 'stable'), /gueltigen Kanal/);
  assert.throws(() => validateEfbChannel({ ...valid, archive: { ...valid.archive, url: `${valid.archive.url}?latest=1` } }, 'alpha'), /GitHub/);
});
