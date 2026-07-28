const { EventEmitter } = require('node:events');

const STARTUP_CHECK_TIMEOUT_MS = 10000;

function normalizeChoice(value) {
  const choice = String(value || '').trim();
  return ['once', 'automatic', 'later'].includes(choice) ? choice : 'later';
}

class UpdateController extends EventEmitter {
  constructor({ autoUpdater, isPackaged, platform, getPolicy, savePolicy }) {
    super();
    this.autoUpdater = autoUpdater;
    this.supported = Boolean(isPackaged && platform === 'win32');
    this.getPolicy = getPolicy;
    this.savePolicy = savePolicy;
    this.startupGateOpen = false;
    this.startupResolve = null;
    this.startupTimer = null;
    this.state = {
      supported: this.supported,
      phase: this.supported ? 'idle' : 'development',
      version: '',
      percent: 0,
      message: this.supported ? 'Updateprüfung steht bereit.' : 'Updates sind erst im installierten Windows-Build aktiv.'
    };
    if (this.supported) this.attachUpdaterEvents();
  }

  publicState() {
    return { ...this.state };
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    this.emit('state', this.publicState());
  }

  resolveStartup(result) {
    if (!this.startupResolve) return;
    const resolve = this.startupResolve;
    this.startupResolve = null;
    this.startupGateOpen = false;
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.startupTimer = null;
    resolve(result);
  }

  attachUpdaterEvents() {
    this.autoUpdater.autoDownload = false;
    this.autoUpdater.autoInstallOnAppQuit = false;
    this.autoUpdater.on('checking-for-update', () => {
      this.setState({ phase: 'checking', message: 'Suche nach Updates …', percent: 0 });
    });
    this.autoUpdater.on('update-not-available', () => {
      this.setState({ phase: 'current', message: 'Die installierte Version ist aktuell.', percent: 0 });
      this.resolveStartup('continue');
    });
    this.autoUpdater.on('update-available', (info) => {
      const version = String(info?.version || '');
      if (!this.startupGateOpen) {
        this.setState({
          phase: 'deferred',
          version,
          message: `Version ${version} ist verfügbar und wird beim nächsten Trackerstart angeboten.`
        });
        return;
      }
      if (this.getPolicy() === 'automatic') {
        this.setState({ phase: 'downloading', version, message: `Version ${version} wird automatisch geladen …`, percent: 0 });
        this.download();
        return;
      }
      this.setState({
        phase: 'choice-required',
        version,
        message: `Version ${version} ist verfügbar.`
      });
    });
    this.autoUpdater.on('download-progress', (progress) => {
      const percent = Math.max(0, Math.min(100, Number(progress?.percent) || 0));
      this.setState({
        phase: 'downloading',
        percent,
        message: `Update wird geladen … ${Math.round(percent)} %`
      });
    });
    this.autoUpdater.on('update-downloaded', (info) => {
      this.setState({
        phase: 'ready',
        version: String(info?.version || this.state.version || ''),
        percent: 100,
        message: 'Update ist geprüft und wird installiert …'
      });
      this.emit('install-ready');
    });
    this.autoUpdater.on('error', (error) => {
      this.setState({
        phase: 'error',
        message: `Updateprüfung fehlgeschlagen: ${error?.message || error}`,
        percent: 0
      });
      this.resolveStartup('continue');
    });
  }

  async checkAtStartup() {
    if (!this.supported) return 'continue';
    this.startupGateOpen = true;
    const result = new Promise((resolve) => {
      this.startupResolve = resolve;
      this.startupTimer = setTimeout(() => {
        if (!this.startupResolve) return;
        this.setState({
          phase: 'deferred',
          message: 'Updateprüfung dauerte zu lange und wird beim nächsten Start wiederholt.'
        });
        this.resolveStartup('continue');
      }, STARTUP_CHECK_TIMEOUT_MS);
    });
    Promise.resolve(this.autoUpdater.checkForUpdates()).catch((error) => {
      this.setState({ phase: 'error', message: `Updateprüfung fehlgeschlagen: ${error?.message || error}` });
      this.resolveStartup('continue');
    });
    return result;
  }

  async download() {
    try {
      await this.autoUpdater.downloadUpdate();
    } catch (error) {
      this.setState({ phase: 'error', message: `Update konnte nicht geladen werden: ${error?.message || error}` });
      this.resolveStartup('continue');
    }
  }

  handleChoice(rawChoice) {
    if (this.state.phase !== 'choice-required') return { ok: false, message: 'Derzeit wartet kein Update auf eine Auswahl.' };
    const choice = normalizeChoice(rawChoice);
    if (choice === 'later') {
      this.setState({ phase: 'deferred', message: 'Update wurde bis zum nächsten Start zurückgestellt.' });
      this.resolveStartup('continue');
      return { ok: true, action: 'continue' };
    }
    if (choice === 'automatic') this.savePolicy('automatic');
    this.setState({
      phase: 'downloading',
      message: choice === 'automatic'
        ? 'Automatische Updates sind aktiviert. Update wird geladen …'
        : 'Dieses Update wird geladen …',
      percent: 0
    });
    this.download();
    return { ok: true, action: 'download' };
  }

  quitAndInstall() {
    if (!this.supported) return false;
    this.autoUpdater.quitAndInstall(false, true);
    return true;
  }
}

module.exports = { STARTUP_CHECK_TIMEOUT_MS, UpdateController, normalizeChoice };
