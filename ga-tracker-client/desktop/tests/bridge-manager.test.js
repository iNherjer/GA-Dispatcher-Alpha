'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  BRIDGE_INSTALLER_ASSET,
  BridgeManager,
  cleanVersion,
  compareVersions,
  defaultExecutableCandidates,
  parseRegistryInstallations,
  validateBridgeRelease
} = require('../lib/bridge-manager');

function releaseFixture(version = '1.12.0', installer = Buffer.from('verified bridge installer')) {
  return {
    release: {
      tag_name: `v${version}`,
      draft: false,
      prerelease: false,
      published_at: '2026-08-06T12:00:00Z',
      assets: [{
        name: BRIDGE_INSTALLER_ASSET,
        size: installer.length,
        digest: `sha256:${crypto.createHash('sha256').update(installer).digest('hex')}`,
        browser_download_url: `https://github.com/iNherjer/AccuSim-DRSM-Telemetry-Router/releases/download/v${version}/${BRIDGE_INSTALLER_ASSET}`
      }]
    },
    installer
  };
}

test('bridge versions are normalized and compared as SemVer triples', () => {
  assert.equal(cleanVersion('v1.12.0'), '1.12.0');
  assert.equal(cleanVersion('1.12.0.0'), '1.12.0');
  assert.equal(compareVersions('1.12.0', '1.11.9'), 1);
  assert.equal(compareVersions('1.12.0', '1.12.0'), 0);
  assert.equal(compareVersions('1.9.9', '1.10.0'), -1);
});

test('existing NSIS installations are parsed from the Windows uninstall registry', () => {
  const entries = parseRegistryInstallations(`
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\example
    DisplayName    REG_SZ    Unrelated App
    DisplayVersion    REG_SZ    4.2.0

HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\accusim
    DisplayName    REG_SZ    AccuSim DRSM Telemetry Router
    DisplayVersion    REG_SZ    1.11.0
    InstallLocation    REG_SZ    C:\\Users\\Pilot\\AppData\\Local\\Programs\\accusim-drsm-telemetry-router
    DisplayIcon    REG_SZ    C:\\Users\\Pilot\\AppData\\Local\\Programs\\accusim-drsm-telemetry-router\\AccuSim DRSM Telemetry Router.exe,0
`);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].values.DisplayVersion, '1.11.0');
});

test('standard installer paths cover product and package-name directories', () => {
  const candidates = defaultExecutableCandidates('C:\\Users\\Pilot\\AppData\\Local');
  assert.equal(candidates.length, 3);
  assert.ok(candidates.some((entry) => entry.endsWith(path.join('AccuSim DRSM Telemetry Router', 'AccuSim DRSM Telemetry Router.exe'))));
  assert.ok(candidates.some((entry) => entry.endsWith(path.join('accusim-drsm-telemetry-router', 'AccuSim DRSM Telemetry Router.exe'))));
});

test('GitHub release validation pins installer name, URL, size and digest', () => {
  const fixture = releaseFixture();
  const release = validateBridgeRelease(fixture.release);
  assert.equal(release.version, '1.12.0');
  assert.equal(release.asset.size, fixture.installer.length);
  assert.throws(() => validateBridgeRelease({ ...fixture.release, draft: true }), /stabile Version/);
  const wrongAsset = structuredClone(fixture.release);
  wrongAsset.assets[0].browser_download_url = 'https://example.com/setup.exe';
  assert.throws(() => validateBridgeRelease(wrongAsset), /unveränderliche GitHub-Release/);
});

test('an installed v1.11 Bridge is recognized but requires the first integration update', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfr-bridge-existing-'));
  const executablePath = defaultExecutableCandidates(root)[0];
  fs.mkdirSync(path.dirname(executablePath), { recursive: true });
  fs.writeFileSync(executablePath, 'placeholder');
  const manager = new BridgeManager({
    localAppData: root,
    platform: 'win32',
    execFileImpl: (command, args, _options, callback) => {
      if (command === 'reg.exe') return callback(new Error('not available'));
      callback(null, '1.11.0.0\n');
    },
    sendCommand: async () => { throw new Error('not running'); }
  });
  const state = await manager.refresh();
  assert.equal(state.installed, true);
  assert.equal(state.installedVersion, '1.11.0');
  assert.equal(state.integrationSupported, false);
  assert.match(state.message, /mindestens v1\.12\.0/);
});

test('the same Bridge executable starts headless and later opens its settings', async () => {
  let online = false;
  const launches = [];
  const commands = [];
  const manager = new BridgeManager({
    localAppData: os.tmpdir(),
    platform: 'darwin',
    developmentSpec: {
      command: '/Applications/Electron.app/Contents/MacOS/Electron',
      args: ['/workspace/accusim-router-desktop'],
      cwd: '/workspace/accusim-router-desktop',
      version: '1.12.0'
    },
    spawnDetached: async (command, args) => {
      launches.push({ command, args });
      online = true;
    },
    sendCommand: async (command) => {
      commands.push(command);
      if (!online) throw new Error('offline');
      if (command === 'status') {
        return {
          protocolVersion: 1,
          appVersion: '1.12.0',
          mode: 'background',
          owner: 'tracker',
          runtime: { process: 'running', simulator: 'connected', udp: 'active', packets: 40 }
        };
      }
      return { ok: true };
    }
  });
  assert.deepEqual(await manager.start(), { ok: true });
  assert.deepEqual(launches[0].args, ['/workspace/accusim-router-desktop', '--background', '--owner=tracker', '--start']);
  assert.equal(manager.publicState().runtime.process, 'running');
  assert.deepEqual(await manager.showSettings(), { ok: true, existing: true });
  assert.ok(commands.includes('show-settings'));
});

test('installer download is verified before the visible installer is launched', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vfr-bridge-installer-'));
  const fixture = releaseFixture();
  const launched = [];
  const manager = new BridgeManager({
    localAppData: root,
    installerRoot: path.join(root, 'installer'),
    requestBufferImpl: async (url) => url.includes('/releases/latest')
      ? Buffer.from(JSON.stringify(fixture.release))
      : fixture.installer,
    launchInstaller: async (file) => launched.push(file)
  });
  const result = await manager.install();
  assert.equal(result.ok, true);
  assert.equal(launched.length, 1);
  assert.equal(fs.readFileSync(launched[0]).toString(), fixture.installer.toString());
});
