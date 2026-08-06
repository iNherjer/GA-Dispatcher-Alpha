'use strict';

const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { execFile, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { requestBuffer, sha256Buffer } = require('./runtime-manager');
const { CONTROL_PROTOCOL_VERSION, sendBridgeCommand } = require('./bridge-control-client');

const BRIDGE_PRODUCT_NAME = 'AccuSim DRSM Telemetry Router';
const BRIDGE_EXE_NAME = `${BRIDGE_PRODUCT_NAME}.exe`;
const LEGACY_BRIDGE_EXE_NAME = 'AccuSim-DRSM-Telemetry-Router.exe';
const BRIDGE_INSTALLER_ASSET = 'AccuSim-DRSM-Telemetry-Router-Setup.exe';
const BRIDGE_RELEASE_API_URL = 'https://api.github.com/repos/iNherjer/AccuSim-DRSM-Telemetry-Router/releases/latest';
const MIN_BRIDGE_INTEGRATION_VERSION = '1.12.0';
const MAX_RELEASE_BYTES = 1024 * 1024;
const MAX_INSTALLER_BYTES = 16 * 1024 * 1024;
const HASH_PATTERN = /^[a-f0-9]{64}$/;

function cleanVersion(value) {
  const match = String(value || '').trim().match(/(?:^|[^0-9])(\d+)\.(\d+)\.(\d+)(?:[^0-9]|$)/);
  return match ? `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}` : '';
}

function compareVersions(left, right) {
  const a = cleanVersion(left).split('.').map(Number);
  const b = cleanVersion(right).split('.').map(Number);
  if (a.length !== 3 || b.length !== 3) return 0;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
  }
  return 0;
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function validateBridgeRelease(value) {
  const release = safeObject(value);
  if (release.draft === true || release.prerelease === true) throw new Error('Das aktuelle Bridge-Release ist nicht als stabile Version veröffentlicht.');
  const version = cleanVersion(release.tag_name);
  if (!version || String(release.tag_name || '') !== `v${version}`) throw new Error('Bridge-Release besitzt keinen gültigen Versionstag.');
  const asset = Array.isArray(release.assets)
    ? release.assets.find((entry) => entry?.name === BRIDGE_INSTALLER_ASSET)
    : null;
  if (!asset) throw new Error('Bridge-Release enthält keinen Installer.');
  const size = Number(asset.size);
  const digest = String(asset.digest || '').trim().toLowerCase();
  const sha256 = digest.startsWith('sha256:') ? digest.slice(7) : '';
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_INSTALLER_BYTES) throw new Error('Bridge-Installer besitzt eine ungültige Dateigröße.');
  if (!HASH_PATTERN.test(sha256)) throw new Error('Bridge-Release enthält keine gültige SHA-256-Prüfsumme.');
  let url;
  try { url = new URL(String(asset.browser_download_url || '')); } catch (_) { throw new Error('Bridge-Installer besitzt keine gültige Downloadadresse.'); }
  const expectedPath = `/iNherjer/AccuSim-DRSM-Telemetry-Router/releases/download/v${version}/${BRIDGE_INSTALLER_ASSET}`.toLowerCase();
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com' || decodeURIComponent(url.pathname).toLowerCase() !== expectedPath) {
    throw new Error('Bridge-Installer verweist nicht auf das erwartete unveränderliche GitHub-Release.');
  }
  return {
    version,
    tag: `v${version}`,
    publishedAt: String(release.published_at || ''),
    asset: { name: BRIDGE_INSTALLER_ASSET, size, sha256, url: url.toString() }
  };
}

function parseRegistryInstallations(output) {
  const entries = [];
  let current = null;
  for (const rawLine of String(output || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (/^HKEY_/i.test(line)) {
      current = { key: line, values: {} };
      entries.push(current);
      continue;
    }
    if (!current || !line) continue;
    const match = line.match(/^([^\s]+)\s+REG_[A-Z0-9_]+\s+(.*)$/i);
    if (match) current.values[match[1]] = match[2].trim();
  }
  return entries.filter((entry) => String(entry.values.DisplayName || '').toLowerCase().includes(BRIDGE_PRODUCT_NAME.toLowerCase()));
}

function stripDisplayIcon(value) {
  return String(value || '').trim().replace(/,\s*-?\d+$/, '').replace(/^"(.*)"$/, '$1');
}

function execFileText(command, args, { execFileImpl = execFile, timeout = 4000 } = {}) {
  return new Promise((resolve, reject) => {
    execFileImpl(command, args, { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error);
      else resolve(String(stdout || ''));
    });
  });
}

function defaultExecutableCandidates(localAppData, explicitPath = '') {
  const base = path.resolve(localAppData || '.');
  const names = [
    path.join(base, 'Programs', BRIDGE_PRODUCT_NAME, BRIDGE_EXE_NAME),
    path.join(base, 'Programs', 'accusim-drsm-telemetry-router', BRIDGE_EXE_NAME),
    path.join(base, 'Programs', 'AccuSim-DRSM-Telemetry-Router', BRIDGE_EXE_NAME)
  ];
  if (explicitPath) names.unshift(path.resolve(explicitPath));
  return [...new Set(names)];
}

async function defaultSpawnDetached(command, args = [], options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || path.dirname(command),
      env: options.env || process.env,
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

class BridgeManager extends EventEmitter {
  constructor({
    localAppData,
    installerRoot,
    platform = process.platform,
    explicitExecutablePath = '',
    developmentSpec = null,
    fsModule = fs,
    execFileImpl = execFile,
    requestBufferImpl = requestBuffer,
    sendCommand = sendBridgeCommand,
    spawnDetached = defaultSpawnDetached,
    launchInstaller = null,
    releaseApiUrl = BRIDGE_RELEASE_API_URL
  } = {}) {
    super();
    this.localAppData = path.resolve(localAppData || '.');
    this.installerRoot = path.resolve(installerRoot || path.join(this.localAppData, 'VFR Multitool', 'Bridge Installer'));
    this.platform = platform;
    this.explicitExecutablePath = explicitExecutablePath;
    this.developmentSpec = developmentSpec;
    this.fs = fsModule;
    this.execFileImpl = execFileImpl;
    this.requestBuffer = requestBufferImpl;
    this.sendCommand = sendCommand;
    this.spawnDetached = spawnDetached;
    this.launchInstaller = launchInstaller || ((file) => defaultSpawnDetached(file));
    this.releaseApiUrl = releaseApiUrl;
    this.installation = null;
    this.release = null;
    this.pollTimer = null;
    this.state = {
      phase: 'idle',
      installed: false,
      installedVersion: '',
      latestVersion: '',
      updateAvailable: false,
      integrationSupported: false,
      controlAvailable: false,
      executablePath: '',
      source: '',
      mode: '',
      owner: '',
      runtime: null,
      update: null,
      percent: 0,
      message: 'Bridge-Status wird geprüft.',
      error: ''
    };
  }

  publicState() {
    return {
      ...this.state,
      runtime: this.state.runtime ? { ...this.state.runtime, recording: { ...(this.state.runtime.recording || {}) } } : null,
      update: this.state.update ? { ...this.state.update } : null
    };
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    this.emit('state', this.publicState());
  }

  async registryCandidates() {
    if (this.platform !== 'win32') return [];
    try {
      const output = await execFileText('reg.exe', [
        'query',
        'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
        '/s'
      ], { execFileImpl: this.execFileImpl });
      return parseRegistryInstallations(output).map((entry) => {
        const values = entry.values;
        const icon = stripDisplayIcon(values.DisplayIcon);
        const installLocation = stripDisplayIcon(values.InstallLocation);
        const executablePath = icon || (installLocation ? path.join(installLocation, BRIDGE_EXE_NAME) : '');
        return { executablePath, version: cleanVersion(values.DisplayVersion), source: 'registry' };
      }).filter((entry) => entry.executablePath);
    } catch (_) {
      return [];
    }
  }

  async executableVersion(executablePath) {
    if (this.platform !== 'win32') return '';
    const script = '[Console]::OutputEncoding=[Text.Encoding]::UTF8; (Get-Item -LiteralPath $args[0]).VersionInfo.ProductVersion';
    try {
      return cleanVersion(await execFileText('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script, executablePath
      ], { execFileImpl: this.execFileImpl }));
    } catch (_) {
      return '';
    }
  }

  async detectInstallation() {
    if (this.developmentSpec?.command) {
      return {
        command: this.developmentSpec.command,
        baseArgs: Array.isArray(this.developmentSpec.args) ? [...this.developmentSpec.args] : [],
        cwd: this.developmentSpec.cwd || path.dirname(this.developmentSpec.command),
        env: this.developmentSpec.env || process.env,
        executablePath: this.developmentSpec.command,
        version: cleanVersion(this.developmentSpec.version),
        source: 'development'
      };
    }
    const registry = await this.registryCandidates();
    const known = defaultExecutableCandidates(this.localAppData, this.explicitExecutablePath)
      .map((executablePath) => ({ executablePath, version: '', source: 'standard-path' }));
    for (const candidate of [...registry, ...known]) {
      try {
        if (!candidate.executablePath || !this.fs.existsSync(candidate.executablePath)) continue;
        const basename = path.basename(candidate.executablePath).toLowerCase();
        if (![BRIDGE_EXE_NAME.toLowerCase(), LEGACY_BRIDGE_EXE_NAME.toLowerCase()].includes(basename) && candidate.executablePath !== path.resolve(this.explicitExecutablePath || '.')) continue;
        return {
          command: candidate.executablePath,
          baseArgs: [],
          cwd: path.dirname(candidate.executablePath),
          env: process.env,
          executablePath: candidate.executablePath,
          version: candidate.version || await this.executableVersion(candidate.executablePath),
          source: candidate.source
        };
      } catch (_) {}
    }
    return null;
  }

  async queryControl(command = 'status', payload, timeoutMs = 900) {
    return this.sendCommand(command, payload, { timeoutMs });
  }

  applyControlStatus(status) {
    const value = safeObject(status);
    const protocolVersion = Number(value.protocolVersion);
    if (!Number.isInteger(protocolVersion) || protocolVersion < CONTROL_PROTOCOL_VERSION) throw new Error('Bridge-Steuerprotokoll ist zu alt.');
    const appVersion = cleanVersion(value.appVersion);
    this.setState({
      phase: 'ready',
      installed: true,
      installedVersion: appVersion || this.installation?.version || this.state.installedVersion,
      integrationSupported: true,
      controlAvailable: true,
      executablePath: this.installation?.executablePath || this.state.executablePath,
      source: this.installation?.source || this.state.source || 'running-instance',
      mode: String(value.mode || ''),
      owner: String(value.owner || ''),
      runtime: safeObject(value.runtime),
      update: safeObject(value.update),
      message: value.runtime?.process === 'running'
        ? 'Bridge läuft und wird vom Tracker überwacht.'
        : 'Bridge ist erreichbar und bereit.',
      error: ''
    });
    return value;
  }

  async probeControl({ quiet = false } = {}) {
    try {
      return this.applyControlStatus(await this.queryControl('status'));
    } catch (error) {
      if (!quiet && this.state.controlAvailable) {
        this.setState({ controlAvailable: false, mode: '', owner: '', runtime: null, update: null });
      }
      return null;
    }
  }

  async refresh({ checkRemote = false } = {}) {
    this.setState({ phase: 'checking', message: 'Bridge-Installation wird geprüft.', error: '' });
    this.installation = await this.detectInstallation();
    const control = await this.probeControl({ quiet: true });
    if (!control) {
      const version = this.installation?.version || '';
      const supported = Boolean(version) && compareVersions(version, MIN_BRIDGE_INTEGRATION_VERSION) >= 0;
      this.setState({
        phase: 'ready',
        installed: Boolean(this.installation),
        installedVersion: version,
        integrationSupported: supported,
        controlAvailable: false,
        executablePath: this.installation?.executablePath || '',
        source: this.installation?.source || '',
        mode: '',
        owner: '',
        runtime: null,
        update: null,
        message: !this.installation
          ? 'Die optionale AccuSim-DRSM-Bridge ist nicht installiert.'
          : (supported
            ? `Bridge ${version || ''} ist installiert und derzeit nicht gestartet.`.trim()
            : `Bridge ${version || 'unbekannt'} wurde erkannt. Für den Tracker-Hintergrundmodus ist mindestens v${MIN_BRIDGE_INTEGRATION_VERSION} erforderlich.`),
        error: ''
      });
    }
    if (checkRemote) await this.checkLatest({ quiet: true });
    return this.publicState();
  }

  async fetchLatestRelease() {
    const buffer = await this.requestBuffer(this.releaseApiUrl, {
      maxBytes: MAX_RELEASE_BYTES,
      accept: 'application/vnd.github+json',
      noCache: true,
      timeoutMs: 15000
    });
    let value;
    try { value = JSON.parse(buffer.toString('utf8')); } catch (_) { throw new Error('Bridge-Releaseinformationen sind kein gültiges JSON.'); }
    return validateBridgeRelease(value);
  }

  async checkLatest({ quiet = false } = {}) {
    try {
      this.release = await this.fetchLatestRelease();
      const installedVersion = this.state.installedVersion;
      const updateAvailable = Boolean(installedVersion) && compareVersions(this.release.version, installedVersion) > 0;
      this.setState({
        latestVersion: this.release.version,
        updateAvailable,
        message: updateAvailable
          ? `Bridge ${this.release.version} ist verfügbar.`
          : this.state.message,
        error: ''
      });
      return { ok: true, release: this.release };
    } catch (error) {
      if (!quiet) this.setState({ error: error?.message || String(error), message: `Bridge-Updateprüfung fehlgeschlagen: ${error?.message || error}` });
      return { ok: false, message: error?.message || String(error) };
    }
  }

  async install() {
    this.setState({ phase: 'checking', percent: 0, message: 'Aktuelles Bridge-Release wird ermittelt.', error: '' });
    const release = this.release || await this.fetchLatestRelease();
    this.release = release;
    this.fs.mkdirSync(this.installerRoot, { recursive: true });
    this.setState({
      phase: 'downloading',
      latestVersion: release.version,
      percent: 0,
      message: `Bridge ${release.version} wird geladen.`
    });
    const buffer = await this.requestBuffer(release.asset.url, {
      maxBytes: MAX_INSTALLER_BYTES,
      noCache: true,
      timeoutMs: 30000,
      onProgress: (received, total) => {
        const denominator = total > 0 ? total : release.asset.size;
        const percent = denominator > 0 ? Math.max(0, Math.min(100, (received / denominator) * 100)) : 0;
        this.setState({ percent, message: `Bridge ${release.version} wird geladen … ${Math.round(percent)} %` });
      }
    });
    if (buffer.length !== release.asset.size) throw new Error('Bridge-Installer ist unvollständig.');
    if (sha256Buffer(buffer) !== release.asset.sha256) throw new Error('Prüfsumme des Bridge-Installers stimmt nicht.');
    const installerPath = path.join(this.installerRoot, `AccuSim-DRSM-Telemetry-Router-Setup-${release.version}.exe`);
    const temporaryPath = `${installerPath}.${process.pid}.tmp`;
    this.fs.writeFileSync(temporaryPath, buffer);
    if (this.fs.existsSync(installerPath)) this.fs.rmSync(installerPath, { force: true });
    this.fs.renameSync(temporaryPath, installerPath);
    this.setState({ phase: 'installer-launched', percent: 100, message: 'Bridge-Installer wird geöffnet. Bitte die Installation bestätigen.' });
    await this.launchInstaller(installerPath);
    return { ok: true, version: release.version, installerPath };
  }

  async waitForControl(timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const status = await this.probeControl({ quiet: true });
      if (status) return status;
      await new Promise((resolve) => setTimeout(resolve, 180));
    }
    return null;
  }

  async start() {
    await this.refresh();
    const existing = await this.probeControl({ quiet: true });
    if (existing) {
      await this.queryControl('start');
      await this.probeControl({ quiet: true });
      return { ok: true, alreadyRunning: true };
    }
    if (!this.installation) return { ok: false, needsInstall: true, message: 'Bridge ist nicht installiert.' };
    if (!this.state.integrationSupported) return { ok: false, needsUpdate: true, message: `Bridge muss mindestens auf v${MIN_BRIDGE_INTEGRATION_VERSION} aktualisiert werden.` };
    this.setState({ phase: 'starting', message: 'Bridge wird ohne Oberfläche gestartet.', error: '' });
    await this.spawnDetached(
      this.installation.command,
      [...this.installation.baseArgs, '--background', '--owner=tracker', '--start'],
      { cwd: this.installation.cwd, env: this.installation.env }
    );
    const status = await this.waitForControl();
    if (!status) {
      const message = 'Bridge wurde gestartet, aber der lokale Steuerkanal antwortet nicht.';
      this.setState({ phase: 'error', message, error: message, controlAvailable: false });
      return { ok: false, message };
    }
    return { ok: true };
  }

  async stop() {
    const status = await this.probeControl({ quiet: true });
    if (!status) return { ok: true, alreadyStopped: true };
    if (String(status.owner || '') === 'tracker') {
      await this.queryControl('quit');
      this.setState({ phase: 'ready', controlAvailable: false, runtime: null, mode: '', owner: '', message: 'Bridge wurde beendet.' });
      return { ok: true, quit: true };
    }
    await this.queryControl('stop');
    await this.probeControl({ quiet: true });
    return { ok: true, quit: false };
  }

  async showSettings() {
    const status = await this.probeControl({ quiet: true });
    if (status) {
      await this.queryControl('show-settings');
      return { ok: true, existing: true };
    }
    if (!this.installation) await this.refresh();
    if (!this.installation) return { ok: false, needsInstall: true, message: 'Bridge ist nicht installiert.' };
    await this.spawnDetached(
      this.installation.command,
      [...this.installation.baseArgs, '--show-settings'],
      { cwd: this.installation.cwd, env: this.installation.env }
    );
    return { ok: true, existing: false };
  }

  async shutdownOwned() {
    try {
      const status = await this.probeControl({ quiet: true });
      if (!status || String(status.owner || '') !== 'tracker') return { ok: true, skipped: true };
      await this.queryControl('quit', null, 700);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error?.message || String(error) };
    }
  }

  startPolling(intervalMs = 1500) {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => { void this.probeControl(); }, intervalMs);
    this.pollTimer.unref?.();
  }

  stopPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }
}

module.exports = {
  BRIDGE_EXE_NAME,
  BRIDGE_INSTALLER_ASSET,
  BRIDGE_PRODUCT_NAME,
  BRIDGE_RELEASE_API_URL,
  BridgeManager,
  MAX_INSTALLER_BYTES,
  MIN_BRIDGE_INTEGRATION_VERSION,
  cleanVersion,
  compareVersions,
  defaultExecutableCandidates,
  parseRegistryInstallations,
  stripDisplayIcon,
  validateBridgeRelease
};
