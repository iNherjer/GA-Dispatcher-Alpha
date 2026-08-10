const { EventEmitter } = require('node:events');

function normalizeChoice(value) {
  const choice = String(value || '').trim();
  return ['once', 'automatic', 'later'].includes(choice) ? choice : 'later';
}

function cleanVersion(value) {
  return String(value || '').trim().replace(/^v/i, '').slice(0, 40);
}

class UpdateController extends EventEmitter {
  constructor({ autoUpdater, isPackaged, platform, getPolicy, savePolicy, beforeInstall }) {
    super();
    this.autoUpdater = autoUpdater;
    this.supported = Boolean(autoUpdater && isPackaged && platform === 'win32');
    this.getPolicy = typeof getPolicy === 'function' ? getPolicy : () => 'ask';
    this.savePolicy = typeof savePolicy === 'function' ? savePolicy : () => {};
    this.beforeInstall = typeof beforeInstall === 'function' ? beforeInstall : async () => {};
    this.manualCheck = false;
    this.state = {
      supported: this.supported,
      phase: this.supported ? 'idle' : 'development',
      version: '',
      percent: 0,
      message: this.supported
        ? 'Updateprüfung für die Desktop-App steht bereit.'
        : 'App-Updates sind erst im installierten Windows-Build aktiv.'
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

  attachUpdaterEvents() {
    this.autoUpdater.autoDownload = false;
    this.autoUpdater.autoInstallOnAppQuit = true;
    this.autoUpdater.on('checking-for-update', () => {
      this.setState({ phase: 'checking', percent: 0, message: 'Suche nach einer neuen Desktop-App …' });
    });
    this.autoUpdater.on('update-not-available', () => {
      this.manualCheck = false;
      this.setState({ phase: 'current', version: '', percent: 0, message: 'Die Desktop-App ist aktuell.' });
    });
    this.autoUpdater.on('update-available', (info) => {
      const version = cleanVersion(info?.version);
      this.manualCheck = false;
      if (this.getPolicy() === 'automatic') {
        this.setState({
          phase: 'downloading',
          version,
          percent: 0,
          message: `Desktop-App v${version} wird automatisch geladen …`
        });
        void this.download();
        return;
      }
      this.setState({
        phase: 'choice-required',
        version,
        percent: 0,
        message: `Desktop-App v${version} ist verfügbar.`
      });
    });
    this.autoUpdater.on('download-progress', (progress) => {
      const percent = Math.max(0, Math.min(100, Number(progress?.percent) || 0));
      this.setState({
        phase: 'downloading',
        percent,
        message: `Desktop-App wird geladen und geprüft … ${Math.round(percent)} %`
      });
    });
    this.autoUpdater.on('update-downloaded', (info) => {
      this.setState({
        phase: 'ready',
        version: cleanVersion(info?.version || this.state.version),
        percent: 100,
        message: 'Das App-Update ist geprüft. Es wird beim nächsten Beenden oder nach einem Neustart installiert.'
      });
      this.emit('install-ready', this.publicState());
    });
    this.autoUpdater.on('error', (error) => {
      this.manualCheck = false;
      this.setState({
        phase: 'error',
        percent: 0,
        message: `App-Update fehlgeschlagen: ${error?.message || error}`
      });
    });
  }

  async check({ manual = false } = {}) {
    if (!this.supported) return { ok: false, message: 'App-Updates sind nur im installierten Windows-Build verfügbar.' };
    if (['checking', 'downloading', 'installing'].includes(this.state.phase)) {
      return { ok: false, message: 'Die App-Aktualisierung läuft bereits.' };
    }
    this.manualCheck = manual === true;
    this.setState({ phase: 'checking', percent: 0, message: 'Suche nach einer neuen Desktop-App …' });
    try {
      await this.autoUpdater.checkForUpdates();
      return { ok: true };
    } catch (error) {
      this.manualCheck = false;
      this.setState({ phase: 'error', percent: 0, message: `App-Update fehlgeschlagen: ${error?.message || error}` });
      return { ok: false, message: error?.message || String(error) };
    }
  }

  checkAtStartup() {
    return this.check({ manual: false });
  }

  async download() {
    if (!this.supported || !['choice-required', 'downloading'].includes(this.state.phase)) {
      return { ok: false, message: 'Derzeit steht kein App-Update zum Download bereit.' };
    }
    if (this.state.phase !== 'downloading') {
      this.setState({ phase: 'downloading', percent: 0, message: 'Desktop-App wird geladen und geprüft …' });
    }
    try {
      await this.autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (error) {
      this.setState({ phase: 'error', percent: 0, message: `App-Update konnte nicht geladen werden: ${error?.message || error}` });
      return { ok: false, message: error?.message || String(error) };
    }
  }

  handleChoice(rawChoice) {
    if (this.state.phase !== 'choice-required') return { ok: false, message: 'Derzeit wartet kein App-Update auf eine Auswahl.' };
    const choice = normalizeChoice(rawChoice);
    if (choice === 'later') {
      this.setState({ phase: 'deferred', message: 'App-Update wurde bis zur nächsten Prüfung zurückgestellt.' });
      return { ok: true, action: 'continue' };
    }
    if (choice === 'automatic') this.savePolicy('automatic');
    this.setState({
      phase: 'downloading',
      percent: 0,
      message: choice === 'automatic'
        ? 'Automatische App-Updates sind aktiviert. Update wird geladen …'
        : 'Dieses App-Update wird geladen …'
    });
    void this.download();
    return { ok: true, action: 'download' };
  }

  async install() {
    if (!this.supported || this.state.phase !== 'ready') {
      return { ok: false, message: 'Das App-Update ist noch nicht installationsbereit.' };
    }
    this.setState({ phase: 'installing', message: 'Tracker und Bridge werden beendet; danach startet die Installation …' });
    try {
      await this.beforeInstall();
      this.autoUpdater.quitAndInstall(false, true);
      return { ok: true };
    } catch (error) {
      this.setState({ phase: 'error', message: `App-Update konnte nicht gestartet werden: ${error?.message || error}` });
      return { ok: false, message: error?.message || String(error) };
    }
  }
}

module.exports = { UpdateController, cleanVersion, normalizeChoice };
