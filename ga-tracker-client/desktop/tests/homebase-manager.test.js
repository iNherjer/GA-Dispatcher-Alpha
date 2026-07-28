const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { HomebaseAssetManager } = require('../lib/homebase-manager');

class FakeAssetService {
  constructor() {
    this.installed = false;
    this.version = '';
    this.installCalls = [];
    this.uninstallCalls = 0;
  }

  inspectAssetState() {
    return {
      communityFound: this.installed,
      communityPath: this.installed ? 'C:\\MSFS\\Community2024' : '',
      packageComplete: this.installed,
      packageVersion: this.version,
      remoteVersion: '0.6.20',
      updateAvailable: this.installed && this.version !== '0.6.20'
    };
  }

  async checkRemoteAssets() {
    return {
      remoteAvailable: true,
      remoteVersion: '0.6.20',
      updateAvailable: !this.installed || this.version !== '0.6.20',
      remoteError: ''
    };
  }

  async installRemoteAssets(options) {
    this.installCalls.push(options);
    this.installed = true;
    this.version = '0.6.20';
    return { packageVersion: this.version, unchanged: false };
  }

  uninstallAssets() {
    this.uninstallCalls += 1;
    this.installed = false;
    this.version = '';
    return { removedPaths: ['C:\\MSFS\\Community2024\\vfr-multitool-homebase-assets'] };
  }
}

test('Homebase asset manager exposes install, repair, update check and isolated uninstall', async () => {
  const service = new FakeAssetService();
  const manager = new HomebaseAssetManager({
    runtimeDirectory: path.join(os.tmpdir(), 'vfr-homebase-manager-test'),
    service
  });

  assert.equal((await manager.refresh()).ok, true);
  assert.equal(manager.publicState().updateAvailable, true);
  assert.equal((await manager.install()).ok, true);
  assert.equal(manager.publicState().installedComplete, true);
  assert.equal((await manager.install({ repair: true })).ok, true);
  assert.deepEqual(service.installCalls, [{ force: false }, { force: true }]);

  const removed = await manager.uninstall();
  assert.equal(removed.ok, true);
  assert.equal(service.uninstallCalls, 1);
  assert.equal(manager.publicState().installed, false);
});
