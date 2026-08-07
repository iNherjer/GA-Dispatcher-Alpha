const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const { runtimeChannelDefinition } = require('./runtime-channel');

const TRACKER_EXE_NAME = 'VFR-Multitool-Tracker.exe';
const DEFAULT_CHANNEL_URL = runtimeChannelDefinition('stable').channelUrl;
const MAX_CHANNEL_BYTES = 256 * 1024;
const MAX_RUNTIME_BYTES = 160 * 1024 * 1024;
const MIN_RUNTIME_VERSION_CODE = 314;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const VERSION_PATTERN = /^v([1-9][0-9]*)$/;

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(file, fsModule = fs) {
  return crypto.createHash('sha256').update(fsModule.readFileSync(file)).digest('hex');
}

function validateHttpsUrl(value, label) {
  let url;
  try { url = new URL(String(value || '')); } catch (_) { throw new Error(`${label} enthält keine gültige URL.`); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${label} muss eine sichere HTTPS-URL sein.`);
  return url;
}

function validateChannel(value) {
  const channel = safeObject(value);
  const version = String(channel.version || '').trim();
  const versionMatch = version.match(VERSION_PATTERN);
  const versionCode = Number(channel.versionCode);
  const releaseTag = String(channel.releaseTag || '').trim();
  const asset = safeObject(channel.asset);
  const name = String(asset.name || '').trim();
  const size = Number(asset.size);
  const hash = String(asset.sha256 || '').trim().toLowerCase();
  const assetUrl = validateHttpsUrl(asset.url, 'Tracker-Asset');

  if (Number(channel.schemaVersion) !== 1) throw new Error('Nicht unterstützte Tracker-Kanalversion.');
  if (!versionMatch || versionCode !== Number(versionMatch[1])) throw new Error('Tracker-Version und Versionscode passen nicht zusammen.');
  if (versionCode < MIN_RUNTIME_VERSION_CODE) throw new Error(`Tracker-Runtime ${version} ist für diesen Bootstrapper zu alt.`);
  if (releaseTag !== version) throw new Error('Tracker-Release-Tag passt nicht zur Version.');
  if (name !== TRACKER_EXE_NAME) throw new Error(`Unerwarteter Tracker-Dateiname: ${name || '(leer)'}`);
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_RUNTIME_BYTES) throw new Error(`Ungültige Tracker-Dateigröße: ${asset.size}`);
  if (!HASH_PATTERN.test(hash)) throw new Error('Tracker-Kanal enthält keine gültige SHA-256-Prüfsumme.');
  if (assetUrl.hostname.toLowerCase() !== 'github.com') throw new Error('Tracker-Asset muss direkt von GitHub geladen werden.');
  const expectedPath = `/iNherjer/GA-Dispatcher-Alpha/releases/download/${releaseTag}/${name}`.toLowerCase();
  if (decodeURIComponent(assetUrl.pathname).toLowerCase() !== expectedPath) throw new Error('Tracker-Asset verweist nicht auf das erwartete unveränderliche Release.');

  return {
    schemaVersion: 1,
    version,
    versionCode,
    releaseTag,
    publishedAt: String(channel.publishedAt || ''),
    asset: { name, url: assetUrl.toString(), size, sha256: hash }
  };
}

function requestBuffer(rawUrl, options = {}, redirects = 0) {
  const url = validateHttpsUrl(rawUrl, 'Download');
  const maxBytes = Number(options.maxBytes || MAX_RUNTIME_BYTES);
  const timeoutMs = Number(options.timeoutMs || 20000);
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {};
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.get(url, {
      headers: {
        Accept: options.accept || '*/*',
        'Accept-Encoding': 'identity',
        'Cache-Control': options.noCache ? 'no-cache, no-store' : 'no-cache',
        'User-Agent': 'VFR-Multitool-Tracker-Bootstrap'
      }
    }, (response) => {
      const status = Number(response.statusCode || 0);
      if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
        response.resume();
        if (redirects >= 5) return reject(new Error('Zu viele Weiterleitungen beim Tracker-Download.'));
        const target = new URL(response.headers.location, url);
        if (target.protocol !== 'https:' || target.username || target.password) return reject(new Error('Unsichere Weiterleitung beim Tracker-Download.'));
        return requestBuffer(target.toString(), options, redirects + 1).then(resolve, reject);
      }
      if (status !== 200) {
        response.resume();
        return reject(new Error(`Downloadserver antwortete mit HTTP ${status}.`));
      }
      const declared = Number(response.headers['content-length'] || 0);
      if (declared > maxBytes) {
        response.destroy();
        return reject(new Error(`Download ist größer als erlaubt: ${declared} Bytes.`));
      }
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          response.destroy(new Error(`Download überschreitet ${maxBytes} Bytes.`));
          return;
        }
        chunks.push(chunk);
        onProgress(size, declared);
      });
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error('Zeitüberschreitung beim Tracker-Download.')));
    request.on('error', reject);
  });
}

class TrackerRuntimeManager extends EventEmitter {
  constructor({ runtimeRoot, channelUrl = DEFAULT_CHANNEL_URL, request = requestBuffer, fsModule = fs, getUpdatePolicy, saveUpdatePolicy } = {}) {
    super();
    if (!runtimeRoot) throw new Error('runtimeRoot fehlt.');
    this.fs = fsModule;
    this.runtimeRoot = path.resolve(runtimeRoot);
    this.channelUrl = validateHttpsUrl(channelUrl, 'Tracker-Kanal').toString();
    this.request = request;
    this.getUpdatePolicy = typeof getUpdatePolicy === 'function' ? getUpdatePolicy : () => 'ask';
    this.saveUpdatePolicy = typeof saveUpdatePolicy === 'function' ? saveUpdatePolicy : () => {};
    this.statePath = path.join(this.runtimeRoot, 'runtime-state.json');
    this.pendingChannel = null;
    this.choiceResolve = null;
    this.busy = false;
    this.state = {
      source: 'runtime',
      phase: 'idle',
      version: '',
      installedVersion: '',
      percent: 0,
      message: 'Tracker-Runtime wird vorbereitet.'
    };
  }

  publicState() {
    return { ...this.state };
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    this.emit('state', this.publicState());
  }

  readStateFile() {
    try {
      if (!this.fs.existsSync(this.statePath)) return {};
      return safeObject(JSON.parse(this.fs.readFileSync(this.statePath, 'utf8')));
    } catch (_) {
      return {};
    }
  }

  writeStateFile(value) {
    this.fs.mkdirSync(this.runtimeRoot, { recursive: true });
    const temporary = `${this.statePath}.${process.pid}.tmp`;
    this.fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    this.fs.renameSync(temporary, this.statePath);
  }

  executablePath(descriptor) {
    return path.join(this.runtimeRoot, 'runtimes', descriptor.version, TRACKER_EXE_NAME);
  }

  validateInstalledDescriptor(value) {
    try {
      const descriptor = validateChannel(value);
      const executable = this.executablePath(descriptor);
      if (!this.fs.existsSync(executable)) return null;
      const stat = this.fs.statSync(executable);
      if (!stat.isFile() || stat.size !== descriptor.asset.size) return null;
      if (sha256File(executable, this.fs) !== descriptor.asset.sha256) return null;
      return { descriptor, executable };
    } catch (_) {
      return null;
    }
  }

  inspectInstalled() {
    const state = this.readStateFile();
    const current = this.validateInstalledDescriptor(state.current);
    if (current) return current;
    const previous = this.validateInstalledDescriptor(state.previous);
    if (previous) {
      this.writeStateFile({ current: previous.descriptor, previous: null });
      return previous;
    }
    return null;
  }

  currentExecutablePath() {
    return this.inspectInstalled()?.executable || '';
  }

  async fetchChannel() {
    const url = new URL(this.channelUrl);
    url.searchParams.set('_vfrcb', String(Date.now()));
    const buffer = await this.request(url.toString(), {
      maxBytes: MAX_CHANNEL_BYTES,
      timeoutMs: 15000,
      accept: 'application/json',
      noCache: true
    });
    let parsed;
    try { parsed = JSON.parse(Buffer.from(buffer).toString('utf8')); } catch (error) {
      throw new Error(`Tracker-Kanal ist kein gültiges JSON: ${error.message}`);
    }
    return validateChannel(parsed);
  }

  async install(channel) {
    if (this.busy) throw new Error('Ein Tracker-Download läuft bereits.');
    this.busy = true;
    try {
      this.setState({
        phase: 'downloading',
        version: channel.version,
        percent: 0,
        message: `Tracker ${channel.version} wird von origin geladen …`
      });
      const buffer = await this.request(channel.asset.url, {
        maxBytes: channel.asset.size + 1,
        timeoutMs: 180000,
        accept: 'application/octet-stream',
        onProgress: (received, total) => {
          const expected = total > 0 ? total : channel.asset.size;
          const percent = Math.max(0, Math.min(100, (received / expected) * 100));
          this.setState({ phase: 'downloading', percent, message: `Tracker ${channel.version} wird geladen … ${Math.round(percent)} %` });
        }
      });
      if (buffer.length !== channel.asset.size) throw new Error(`Tracker-Dateigröße stimmt nicht: ${buffer.length} statt ${channel.asset.size}.`);
      if (sha256Buffer(buffer) !== channel.asset.sha256) throw new Error('SHA-256 des geladenen Trackers stimmt nicht.');

      const target = this.executablePath(channel);
      const targetDirectory = path.dirname(target);
      const temporary = path.join(this.runtimeRoot, `.${TRACKER_EXE_NAME}.${process.pid}.tmp`);
      this.fs.mkdirSync(targetDirectory, { recursive: true });
      this.fs.writeFileSync(temporary, buffer);
      this.fs.renameSync(temporary, target);
      const verified = this.validateInstalledDescriptor(channel);
      if (!verified) {
        try { this.fs.rmSync(target, { force: true }); } catch (_) {}
        throw new Error('Installierte Tracker-Runtime konnte nicht validiert werden.');
      }

      const previousState = this.readStateFile();
      const previous = this.validateInstalledDescriptor(previousState.current)?.descriptor || null;
      this.writeStateFile({
        schemaVersion: 1,
        installedAt: new Date().toISOString(),
        current: channel,
        previous: previous && previous.version !== channel.version ? previous : safeObject(previousState.previous)
      });
      this.setState({
        phase: 'current',
        version: channel.version,
        installedVersion: channel.version,
        percent: 100,
        message: `Tracker ${channel.version} ist installiert und geprüft.`
      });
      return verified;
    } finally {
      this.busy = false;
    }
  }

  waitForChoice(channel, installed) {
    this.pendingChannel = channel;
    this.setState({
      phase: 'choice-required',
      version: channel.version,
      installedVersion: installed.descriptor.version,
      percent: 0,
      message: `Tracker ${channel.version} ist verfügbar.`
    });
    return new Promise((resolve) => {
      this.choiceResolve = resolve;
    });
  }

  resolveChoice(result) {
    const resolve = this.choiceResolve;
    this.choiceResolve = null;
    this.pendingChannel = null;
    if (resolve) resolve(result);
  }

  async handleChoice(rawChoice) {
    if (this.state.phase !== 'choice-required' || !this.pendingChannel) {
      return { ok: false, message: 'Derzeit wartet kein Tracker-Update auf eine Auswahl.' };
    }
    const choice = ['once', 'automatic', 'later'].includes(String(rawChoice || '')) ? String(rawChoice) : 'later';
    const installed = this.inspectInstalled();
    if (choice === 'later') {
      this.setState({
        phase: 'deferred',
        installedVersion: installed?.descriptor.version || '',
        message: `Update ${this.pendingChannel.version} wurde bis zum nächsten Start zurückgestellt.`
      });
      this.resolveChoice(installed);
      return { ok: true, action: 'continue' };
    }
    if (choice === 'automatic') this.saveUpdatePolicy('automatic');
    const pending = this.pendingChannel;
    try {
      const result = await this.install(pending);
      this.resolveChoice(result);
      return { ok: true, action: 'installed' };
    } catch (error) {
      this.setState({ phase: 'error', message: `Tracker-Update fehlgeschlagen: ${error?.message || error}` });
      this.resolveChoice(installed);
      return { ok: false, message: error?.message || String(error) };
    }
  }

  async ensureReady({ force = false } = {}) {
    const installed = this.inspectInstalled();
    this.setState({
      phase: 'checking',
      installedVersion: installed?.descriptor.version || '',
      percent: 0,
      message: installed ? 'Tracker-Updatekanal wird geprüft …' : 'Tracker wird für den ersten Start vorbereitet …'
    });

    let channel;
    try {
      channel = await this.fetchChannel();
    } catch (error) {
      if (installed) {
        this.setState({
          phase: 'deferred',
          version: installed.descriptor.version,
          installedVersion: installed.descriptor.version,
          message: `Updateprüfung nicht erreichbar; Tracker ${installed.descriptor.version} wird verwendet.`
        });
        return installed;
      }
      this.setState({ phase: 'error', message: `Tracker konnte nicht geladen werden: ${error?.message || error}` });
      throw error;
    }

    if (!installed) return this.install(channel);
    const currentCode = installed.descriptor.versionCode;
    const needsInstall = channel.versionCode > currentCode
      || (channel.versionCode === currentCode && (
        channel.asset.sha256 !== installed.descriptor.asset.sha256
        || channel.asset.size !== installed.descriptor.asset.size
      ));
    if (!needsInstall) {
      this.setState({
        phase: 'current',
        version: installed.descriptor.version,
        installedVersion: installed.descriptor.version,
        percent: 100,
        message: `Tracker ${installed.descriptor.version} ist aktuell.`
      });
      return installed;
    }
    if (!force && this.getUpdatePolicy() !== 'automatic') return this.waitForChoice(channel, installed);
    try {
      return await this.install(channel);
    } catch (error) {
      this.setState({
        phase: 'error',
        version: channel.version,
        installedVersion: installed.descriptor.version,
        message: `Update fehlgeschlagen; Tracker ${installed.descriptor.version} bleibt verfügbar: ${error?.message || error}`
      });
      return installed;
    }
  }
}

module.exports = {
  DEFAULT_CHANNEL_URL,
  MAX_RUNTIME_BYTES,
  MIN_RUNTIME_VERSION_CODE,
  TRACKER_EXE_NAME,
  TrackerRuntimeManager,
  requestBuffer,
  sha256Buffer,
  sha256File,
  validateChannel
};
