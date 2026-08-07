'use strict';

const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { requestBuffer } = require('./runtime-manager');

const EFB_PACKAGE_NAME = 'vfr-multitool-efb';
const EFB_REQUIRED_FILES = Object.freeze([
  'html_ui/efb_ui/efb_apps/vfrmultitool/VfrMultitool.js',
  'html_ui/efb_ui/efb_apps/vfrmultitool/VfrMultitool.css',
  'html_ui/efb_ui/efb_apps/vfrmultitool/Assets/app-icon.svg'
]);
const EFB_CHANNELS = Object.freeze({
  stable: Object.freeze({
    id: 'stable',
    label: 'Stable',
    url: 'https://raw.githubusercontent.com/iNherjer/GA-Dispatcher-Alpha/main/ga-tracker-client/efb/channel/stable.json'
  }),
  alpha: Object.freeze({
    id: 'alpha',
    label: 'Alpha',
    url: 'https://raw.githubusercontent.com/iNherjer/GA-Dispatcher-Alpha/main/ga-tracker-client/efb/channel/alpha.json'
  })
});
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const MAX_CHANNEL_BYTES = 256 * 1024;
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;

function normalizeEfbChannel(value) {
  return String(value || '').trim().toLowerCase() === 'alpha' ? 'alpha' : 'stable';
}

function efbChannelDefinition(value) {
  return EFB_CHANNELS[normalizeEfbChannel(value)];
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function normalizedRelativePath(value) {
  const text = String(value || '').replaceAll('\\', '/');
  if (!text || text.startsWith('/') || /^[A-Za-z]:/.test(text)) throw new Error(`Unsicherer EFB-Paketpfad: ${value}`);
  const parts = text.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || /[\u0000-\u001f:]/.test(part))) {
    throw new Error(`Unsicherer EFB-Paketpfad: ${value}`);
  }
  return parts.join('/');
}

function inside(root, relative) {
  const target = path.resolve(root, ...normalizedRelativePath(relative).split('/'));
  const prefix = `${path.resolve(root)}${path.sep}`;
  if (!target.startsWith(prefix)) throw new Error(`EFB-Paketpfad verlaesst den Paketordner: ${relative}`);
  return target;
}

function validateEfbChannel(value, expectedChannel) {
  const descriptor = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const channel = String(descriptor.channel || '').trim().toLowerCase();
  if (Number(descriptor.schemaVersion) !== 1) throw new Error('Nicht unterstuetzte EFB-Kanalversion.');
  if (!Object.hasOwn(EFB_CHANNELS, channel)) throw new Error('EFB-Kanaldatei enthaelt keinen gueltigen Kanal.');
  if (channel !== normalizeEfbChannel(expectedChannel)) throw new Error('EFB-Kanaldatei passt nicht zum gewaehlten Kanal.');
  if (String(descriptor.packageName || '') !== EFB_PACKAGE_NAME) throw new Error('EFB-Kanal verweist auf einen unerwarteten Paketnamen.');
  if (descriptor.available !== true) {
    return {
      schemaVersion: 1,
      channel,
      available: false,
      packageName: EFB_PACKAGE_NAME,
      message: String(descriptor.message || 'In diesem Kanal ist noch kein EFB-Paket freigegeben.')
    };
  }

  const packageVersion = String(descriptor.packageVersion || '').trim();
  const releaseTag = String(descriptor.releaseTag || '').trim();
  const archive = descriptor.archive && typeof descriptor.archive === 'object' ? descriptor.archive : {};
  const archiveName = String(archive.name || '').trim();
  const size = Number(archive.size);
  const sha256 = String(archive.sha256 || '').trim().toLowerCase();
  let archiveUrl;
  try { archiveUrl = new URL(String(archive.url || '')); } catch (_) { throw new Error('EFB-Kanal enthaelt keine gueltige Archiv-URL.'); }
  if (!VERSION_PATTERN.test(packageVersion)) throw new Error('EFB-Kanal enthaelt keine gueltige numerische Paketversion.');
  if (releaseTag !== `efb-app-v${packageVersion}`) throw new Error('EFB-Release-Tag passt nicht zur Paketversion.');
  if (archiveName !== `${EFB_PACKAGE_NAME}-${packageVersion}.zip`) throw new Error('EFB-Archivname passt nicht zur Paketversion.');
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_ARCHIVE_BYTES) throw new Error('EFB-Archivgroesse ist ungueltig.');
  if (!HASH_PATTERN.test(sha256)) throw new Error('EFB-Kanal enthaelt keine gueltige SHA-256-Pruefsumme.');
  if (archiveUrl.protocol !== 'https:' || archiveUrl.hostname.toLowerCase() !== 'github.com' || archiveUrl.username || archiveUrl.password || archiveUrl.port || archiveUrl.search || archiveUrl.hash) {
    throw new Error('EFB-Archiv muss direkt und sicher von GitHub geladen werden.');
  }
  const expectedPath = `/iNherjer/GA-Dispatcher-Alpha/releases/download/${releaseTag}/${archiveName}`.toLowerCase();
  if (archiveUrl.pathname.toLowerCase() !== expectedPath) throw new Error('EFB-Archiv verweist nicht auf das erwartete unveraenderliche Release.');
  return {
    schemaVersion: 1,
    channel,
    available: true,
    packageName: EFB_PACKAGE_NAME,
    packageVersion,
    releaseTag,
    publishedAt: String(descriptor.publishedAt || ''),
    message: String(descriptor.message || ''),
    archive: { name: archiveName, url: archiveUrl.toString(), size, sha256 }
  };
}

function inspectEfbPackage(packageRoot, expectedVersion = '') {
  const result = {
    installed: false,
    installedComplete: false,
    packageVersion: '',
    packageRoot,
    error: ''
  };
  try {
    if (!fs.statSync(packageRoot).isDirectory()) return result;
    result.installed = true;
    const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'manifest.json'), 'utf8'));
    const layout = JSON.parse(fs.readFileSync(path.join(packageRoot, 'layout.json'), 'utf8'));
    result.packageVersion = String(manifest.package_version || '');
    if (!VERSION_PATTERN.test(result.packageVersion)) throw new Error('manifest.json enthaelt keine gueltige EFB-Paketversion.');
    if (expectedVersion && result.packageVersion !== expectedVersion) throw new Error(`EFB-Paketversion ${result.packageVersion} statt ${expectedVersion}.`);
    if (!Array.isArray(layout.content) || !layout.content.length) throw new Error('layout.json enthaelt keine EFB-Dateiliste.');
    const layoutPaths = new Set();
    for (const entry of layout.content) {
      const relative = normalizedRelativePath(entry?.path).toLowerCase();
      if (layoutPaths.has(relative)) throw new Error(`Doppelter EFB-Layoutpfad: ${entry?.path}`);
      layoutPaths.add(relative);
      const file = inside(packageRoot, entry.path);
      const stat = fs.statSync(file);
      if (!stat.isFile() || stat.size !== Number(entry?.size)) throw new Error(`EFB-Layoutgroesse stimmt nicht: ${entry?.path}`);
    }
    for (const required of EFB_REQUIRED_FILES) {
      if (!layoutPaths.has(required.toLowerCase())) throw new Error(`EFB-App-Datei fehlt im Layout: ${required}`);
      if (!fs.statSync(inside(packageRoot, required)).isFile()) throw new Error(`EFB-App-Datei fehlt: ${required}`);
    }
    result.installedComplete = true;
    return result;
  } catch (error) {
    if (error?.code === 'ENOENT' && !result.installed) return result;
    result.error = error?.message || String(error);
    return result;
  }
}

class EfbPackageManager extends EventEmitter {
  constructor(options = {}) {
    super();
    if (!options.runtimeDirectory) throw new Error('EFB-Runtimeverzeichnis fehlt.');
    this.runtimeDirectory = path.resolve(options.runtimeDirectory);
    this.appData = options.appData || '';
    this.localAppData = options.localAppData || '';
    this.supportModulePath = options.supportModulePath || '';
    this.updaterModulePath = options.updaterModulePath || '';
    this.request = typeof options.request === 'function' ? options.request : requestBuffer;
    this.resolveCommunityPath = typeof options.resolveCommunityPath === 'function'
      ? options.resolveCommunityPath
      : () => {
          const { discoverCommunityFolders, selectCommunityFolder } = require(this.supportModulePath);
          return selectCommunityFolder(discoverCommunityFolders({ appData: this.appData, localAppData: this.localAppData }), [EFB_PACKAGE_NAME]);
        };
    this.extractArchive = typeof options.extractArchive === 'function'
      ? options.extractArchive
      : (archive, target) => require(this.updaterModulePath).extractZipBuffer(archive, target, {
          maxEntries: 2000,
          maxExtractedBytes: MAX_ARCHIVE_BYTES * 2
        });
    this.channel = normalizeEfbChannel(options.channel);
    this.remote = null;
    this.busy = false;
    this.state = {
      phase: 'idle',
      channel: this.channel,
      installed: false,
      installedComplete: false,
      installedVersion: '',
      remoteAvailable: false,
      remoteVersion: '',
      updateAvailable: false,
      communityPath: '',
      message: 'EFB-App-Status wird geprueft.'
    };
  }

  publicState() { return { ...this.state, busy: this.busy }; }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    this.emit('state', this.publicState());
  }

  setChannel(value) {
    this.channel = normalizeEfbChannel(value);
    this.remote = null;
    this.setState({
      channel: this.channel,
      remoteAvailable: false,
      remoteVersion: '',
      updateAvailable: false,
      message: `EFB-${efbChannelDefinition(this.channel).label}-Kanal wird geprueft.`
    });
    return this.inspect();
  }

  inspect() {
    try {
      const communityPath = this.resolveCommunityPath();
      const inspection = inspectEfbPackage(path.join(communityPath, EFB_PACKAGE_NAME));
      const updateAvailable = Boolean(this.remote?.available && (
        !inspection.installedComplete || inspection.packageVersion !== this.remote.packageVersion
      ));
      const message = inspection.installedComplete
        ? `VFR Multitool EFB ${inspection.packageVersion} ist installiert.`
        : (inspection.installed ? `Die EFB-Installation ist unvollstaendig: ${inspection.error}` : 'VFR Multitool EFB ist nicht installiert.');
      this.setState({
        phase: 'ready',
        installed: inspection.installed,
        installedComplete: inspection.installedComplete,
        installedVersion: inspection.packageVersion,
        remoteAvailable: this.remote?.available === true,
        remoteVersion: this.remote?.packageVersion || '',
        updateAvailable,
        communityPath,
        message
      });
      return this.publicState();
    } catch (error) {
      this.setState({
        phase: 'ready',
        installed: false,
        installedComplete: false,
        installedVersion: '',
        communityPath: '',
        message: error?.message || String(error)
      });
      return this.publicState();
    }
  }

  async fetchChannel({ force = true } = {}) {
    const definition = efbChannelDefinition(this.channel);
    const url = new URL(definition.url);
    if (force) url.searchParams.set('_vfrcb', String(Date.now()));
    const buffer = await this.request(url.toString(), {
      maxBytes: MAX_CHANNEL_BYTES,
      timeoutMs: 15000,
      accept: 'application/json',
      noCache: force
    });
    let parsed;
    try { parsed = JSON.parse(Buffer.from(buffer).toString('utf8')); } catch (error) {
      throw new Error(`EFB-Kanal ist kein gueltiges JSON: ${error.message}`);
    }
    return validateEfbChannel(parsed, this.channel);
  }

  async refresh({ force = true } = {}) {
    if (this.busy) return { ok: false, message: 'Der EFB-Paketmanager arbeitet bereits.' };
    this.busy = true;
    this.setState({ phase: 'checking', message: `EFB-${efbChannelDefinition(this.channel).label}-Kanal wird geprueft.` });
    try {
      this.remote = await this.fetchChannel({ force });
      const state = this.inspect();
      const message = !this.remote.available
        ? this.remote.message
        : (state.updateAvailable
          ? `VFR Multitool EFB ${this.remote.packageVersion} ist im ${efbChannelDefinition(this.channel).label}-Kanal verfuegbar.`
          : (state.installedComplete ? `VFR Multitool EFB ${state.installedVersion} ist aktuell.` : `VFR Multitool EFB ${this.remote.packageVersion} kann installiert werden.`));
      this.setState({ phase: 'ready', message });
      return { ok: true, state: this.publicState(), descriptor: this.remote };
    } catch (error) {
      this.remote = null;
      this.setState({ phase: 'error', remoteAvailable: false, remoteVersion: '', updateAvailable: false, message: error?.message || String(error) });
      return { ok: false, state: this.publicState(), message: error?.message || String(error) };
    } finally {
      this.busy = false;
      this.emit('state', this.publicState());
    }
  }

  async install({ repair = false } = {}) {
    if (this.busy) return { ok: false, message: 'Der EFB-Paketmanager arbeitet bereits.' };
    this.busy = true;
    this.setState({ phase: 'working', message: repair ? 'EFB-App wird neu geladen und repariert.' : 'EFB-App wird geladen und installiert.' });
    let stagingRoot = '';
    let incoming = '';
    let backup = '';
    let destination = '';
    let backupMade = false;
    let activated = false;
    try {
      const descriptor = await this.fetchChannel({ force: true });
      this.remote = descriptor;
      if (!descriptor.available) throw Object.assign(new Error(descriptor.message), { code: 'EFB_CHANNEL_UNAVAILABLE' });
      const communityPath = this.resolveCommunityPath();
      destination = path.join(communityPath, EFB_PACKAGE_NAME);
      const installed = inspectEfbPackage(destination);
      if (!repair && installed.installedComplete && installed.packageVersion === descriptor.packageVersion) {
        this.inspect();
        this.setState({ phase: 'ready', updateAvailable: false, message: `VFR Multitool EFB ${descriptor.packageVersion} ist bereits aktuell.` });
        return { ok: true, unchanged: true, state: this.publicState() };
      }

      this.setState({ phase: 'working', message: `EFB-Paket ${descriptor.packageVersion} wird heruntergeladen.` });
      const archive = Buffer.from(await this.request(descriptor.archive.url, {
        maxBytes: descriptor.archive.size + 1,
        timeoutMs: 120000,
        accept: 'application/zip, application/octet-stream'
      }));
      if (archive.length !== descriptor.archive.size) throw new Error(`EFB-Downloadgroesse stimmt nicht: ${archive.length} statt ${descriptor.archive.size}.`);
      if (sha256Buffer(archive) !== descriptor.archive.sha256) throw new Error('SHA-256 des EFB-Pakets stimmt nicht.');

      fs.mkdirSync(this.runtimeDirectory, { recursive: true });
      stagingRoot = path.join(this.runtimeDirectory, `staging-${descriptor.packageVersion}-${crypto.randomUUID()}`);
      const extracted = this.extractArchive(archive, stagingRoot) || {};
      const names = Array.isArray(extracted.names) ? extracted.names : [];
      if (names.some((name) => {
        const normalized = normalizedRelativePath(name).toLowerCase();
        return normalized !== EFB_PACKAGE_NAME && !normalized.startsWith(`${EFB_PACKAGE_NAME}/`);
      })) throw new Error('EFB-Archiv enthaelt Dateien ausserhalb des erwarteten Paketordners.');
      const stagedPackage = path.join(stagingRoot, EFB_PACKAGE_NAME);
      const stagedInspection = inspectEfbPackage(stagedPackage, descriptor.packageVersion);
      if (!stagedInspection.installedComplete) throw new Error(stagedInspection.error || 'Entpacktes EFB-Paket ist unvollstaendig.');

      incoming = path.join(communityPath, `.${EFB_PACKAGE_NAME}.incoming-${crypto.randomUUID()}`);
      backup = path.join(communityPath, `.${EFB_PACKAGE_NAME}.backup-${crypto.randomUUID()}`);
      fs.cpSync(stagedPackage, incoming, { recursive: true, errorOnExist: true });
      const copiedInspection = inspectEfbPackage(incoming, descriptor.packageVersion);
      if (!copiedInspection.installedComplete) throw new Error(copiedInspection.error || 'Kopiertes EFB-Paket ist unvollstaendig.');

      if (fs.existsSync(destination)) {
        fs.renameSync(destination, backup);
        backupMade = true;
      }
      fs.renameSync(incoming, destination);
      activated = true;
      const finalInspection = inspectEfbPackage(destination, descriptor.packageVersion);
      if (!finalInspection.installedComplete) throw new Error(finalInspection.error || 'Installiertes EFB-Paket konnte nicht validiert werden.');
      if (backupMade) fs.rmSync(backup, { recursive: true, force: true });
      backupMade = false;
      const state = this.inspect();
      this.setState({ phase: 'ready', updateAvailable: false, message: `VFR Multitool EFB ${descriptor.packageVersion} wurde geprueft und installiert.` });
      return { ok: true, unchanged: false, state, packageVersion: descriptor.packageVersion, packageRoot: destination };
    } catch (error) {
      try {
        if (backupMade) {
          if (activated && fs.existsSync(destination)) fs.rmSync(destination, { recursive: true, force: true });
          if (fs.existsSync(backup)) fs.renameSync(backup, destination);
        }
      } catch (_) {}
      this.setState({ phase: 'error', message: error?.message || String(error) });
      return { ok: false, code: error?.code || '', message: error?.message || String(error), state: this.publicState() };
    } finally {
      for (const target of [incoming, stagingRoot]) {
        try { if (target && fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true }); } catch (_) {}
      }
      this.busy = false;
      this.emit('state', this.publicState());
    }
  }

  async uninstall() {
    if (this.busy) return { ok: false, message: 'Der EFB-Paketmanager arbeitet bereits.' };
    this.busy = true;
    this.setState({ phase: 'working', message: 'VFR Multitool EFB wird aus dem Community-Ordner entfernt.' });
    try {
      const communityPath = this.resolveCommunityPath();
      const destination = path.join(communityPath, EFB_PACKAGE_NAME);
      const removed = fs.existsSync(destination);
      if (removed) fs.rmSync(destination, { recursive: true, force: true });
      this.inspect();
      const message = removed ? 'VFR Multitool EFB wurde entfernt.' : 'VFR Multitool EFB war nicht installiert.';
      this.setState({ phase: 'ready', message });
      return { ok: true, removed, state: this.publicState(), message };
    } catch (error) {
      this.setState({ phase: 'error', message: error?.message || String(error) });
      return { ok: false, message: error?.message || String(error), state: this.publicState() };
    } finally {
      this.busy = false;
      this.emit('state', this.publicState());
    }
  }
}

module.exports = {
  EFB_CHANNELS,
  EFB_PACKAGE_NAME,
  EFB_REQUIRED_FILES,
  EfbPackageManager,
  efbChannelDefinition,
  inspectEfbPackage,
  normalizeEfbChannel,
  validateEfbChannel
};
