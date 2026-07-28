const { EventEmitter } = require('node:events');
const path = require('node:path');

function createDefaultService({ supportModulePath, runtimeDirectory, appData, localAppData, onProgress }) {
  const { createHomebasePackageService } = require(supportModulePath);
  return createHomebasePackageService({
    runtimeDir: runtimeDirectory,
    appData,
    localAppData,
    sendAck: (event) => {
      if (event?.type === 'homebase_v1.assets.update.progress') onProgress(event);
    },
    log: () => {}
  });
}

class HomebaseAssetManager extends EventEmitter {
  constructor({ supportModulePath, runtimeDirectory, appData, localAppData, service } = {}) {
    super();
    if (!runtimeDirectory) throw new Error('runtimeDirectory fehlt.');
    this.runtimeDirectory = path.resolve(runtimeDirectory);
    this.busy = false;
    this.state = {
      phase: 'idle',
      installed: false,
      installedComplete: false,
      installedVersion: '',
      remoteVersion: '',
      updateAvailable: false,
      communityPath: '',
      message: 'Homebase-Assetstatus wird geprüft.'
    };
    this.service = service || createDefaultService({
      supportModulePath,
      runtimeDirectory: this.runtimeDirectory,
      appData,
      localAppData,
      onProgress: (progress) => this.handleProgress(progress)
    });
  }

  publicState() {
    return { ...this.state, busy: this.busy };
  }

  setState(patch) {
    this.state = { ...this.state, ...patch };
    this.emit('state', this.publicState());
  }

  stateFromInspection(inspection, patch = {}) {
    const installed = Boolean(inspection?.communityFound);
    const installedComplete = inspection?.packageComplete === true;
    const remoteVersion = String(inspection?.remoteVersion || '');
    const installedVersion = String(inspection?.packageVersion || inspection?.installedVersion || '');
    return {
      installed,
      installedComplete,
      installedVersion,
      remoteVersion,
      updateAvailable: inspection?.updateAvailable === true,
      communityPath: String(inspection?.communityPath || ''),
      ...patch
    };
  }

  handleProgress(progress = {}) {
    const phase = String(progress.phase || '');
    this.setState({
      phase: ['download', 'extract', 'validate'].includes(phase) ? 'working' : 'checking',
      message: String(progress.message || 'Homebase-Assetpaket wird verarbeitet …')
    });
  }

  inspect() {
    const inspection = this.service.inspectAssetState();
    const message = inspection.packageComplete
      ? `Homebase Assets ${inspection.packageVersion} sind installiert.`
      : (inspection.communityFound ? 'Die Homebase-Assetinstallation ist unvollständig.' : 'Homebase Assets sind nicht installiert.');
    this.setState(this.stateFromInspection(inspection, { phase: 'ready', message }));
    return this.publicState();
  }

  async refresh({ force = true } = {}) {
    if (this.busy) return { ok: false, message: 'Der Homebase Asset Manager arbeitet bereits.' };
    this.busy = true;
    this.setState({ phase: 'checking', message: 'Homebase-Releasekanal wird geprüft …' });
    try {
      const remote = await this.service.checkRemoteAssets({ force });
      const inspection = this.service.inspectAssetState();
      const merged = { ...inspection, ...remote };
      const message = remote.remoteError
        ? `Online-Prüfung fehlgeschlagen: ${remote.remoteError}`
        : (remote.updateAvailable
          ? `Homebase Assets ${remote.remoteVersion} sind verfügbar.`
          : (inspection.packageComplete
            ? `Homebase Assets ${inspection.packageVersion} sind aktuell.`
            : `Homebase Assets ${remote.remoteVersion || ''} können installiert werden.`));
      this.setState(this.stateFromInspection(merged, {
        phase: remote.remoteError ? 'error' : 'ready',
        message
      }));
      return { ok: !remote.remoteError, state: this.publicState(), message };
    } catch (error) {
      this.setState({ phase: 'error', message: error?.message || String(error) });
      return { ok: false, message: error?.message || String(error), state: this.publicState() };
    } finally {
      this.busy = false;
      this.emit('state', this.publicState());
    }
  }

  async install({ repair = false } = {}) {
    if (this.busy) return { ok: false, message: 'Der Homebase Asset Manager arbeitet bereits.' };
    this.busy = true;
    this.setState({
      phase: 'working',
      message: repair ? 'Homebase Assets werden neu geladen und repariert …' : 'Homebase Assets werden geladen und installiert …'
    });
    try {
      const result = await this.service.installRemoteAssets({ force: repair });
      const inspection = this.service.inspectAssetState();
      const message = result.unchanged
        ? `Homebase Assets ${result.packageVersion} sind bereits aktuell.`
        : `Homebase Assets ${result.packageVersion} wurden geprüft und installiert.`;
      this.setState(this.stateFromInspection(inspection, { phase: 'ready', updateAvailable: false, message }));
      return { ok: true, result, state: this.publicState(), message };
    } catch (error) {
      this.setState({ phase: 'error', message: error?.message || String(error) });
      return { ok: false, message: error?.message || String(error), code: error?.code || '', state: this.publicState() };
    } finally {
      this.busy = false;
      this.emit('state', this.publicState());
    }
  }

  async uninstall() {
    if (this.busy) return { ok: false, message: 'Der Homebase Asset Manager arbeitet bereits.' };
    this.busy = true;
    this.setState({ phase: 'working', message: 'Gemeinsames Homebase-Assetpaket wird entfernt …' });
    try {
      const result = this.service.uninstallAssets();
      const inspection = this.service.inspectAssetState();
      const message = result.removedPaths.length
        ? 'Homebase Assets wurden entfernt. Persönliche Homebase-Daten bleiben erhalten.'
        : 'Homebase Assets waren nicht installiert.';
      this.setState(this.stateFromInspection(inspection, { phase: 'ready', remoteVersion: this.state.remoteVersion, message }));
      return { ok: true, result, state: this.publicState(), message };
    } catch (error) {
      this.setState({ phase: 'error', message: error?.message || String(error) });
      return { ok: false, message: error?.message || String(error), code: error?.code || '', state: this.publicState() };
    } finally {
      this.busy = false;
      this.emit('state', this.publicState());
    }
  }
}

module.exports = { HomebaseAssetManager, createDefaultService };
