const path = require('node:path');
const fs = require('node:fs');
const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  safeStorage,
  shell,
  Tray
} = require('electron');
const { autoUpdater } = require('electron-updater');
const { TrackerConfigStore } = require('./lib/config-store');
const {
  RUNTIME_CHANNELS,
  normalizeRuntimeChannel,
  runtimeChannelDefinition,
  runtimeRootForChannel
} = require('./lib/runtime-channel');
const { startupDecision } = require('./lib/startup-policy');
const { verifyCredentials } = require('./lib/auth-client');
const { BridgeManager } = require('./lib/bridge-manager');
const { EfbPackageManager } = require('./lib/efb-package-manager');
const { HomebaseAssetManager } = require('./lib/homebase-manager');
const { TrackerRuntimeManager } = require('./lib/runtime-manager');
const { TrackerProcess } = require('./lib/tracker-process');
const { UpdateController } = require('./lib/update-controller');

const singleInstanceLock = app.requestSingleInstanceLock();

let mainWindow = null;
let tray = null;
let configStore = null;
let trackerProcess = null;
let runtimeManager = null;
let desktopUpdateController = null;
let homebaseManager = null;
let efbPackageManager = null;
let bridgeManager = null;
let trackerStartupAllowed = false;
let finalQuitReady = false;
let bridgeShutdownInProgress = false;
let trackerApplicationRoot = '';
let runtimeStateListener = null;

const MANAGED_UPDATE_MODULES = Object.freeze({
  homebase: Object.freeze({ policyKey: 'homebaseUpdatePolicy' }),
  efb: Object.freeze({ policyKey: 'efbUpdatePolicy' }),
  bridge: Object.freeze({ policyKey: 'bridgeUpdatePolicy' })
});
const APT_MISSION_TEST_LOG_FILENAME = 'GA-APT-Missionstest.txt';

function iconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'tracker-icon.png')
    : path.resolve(__dirname, 'assets', 'tracker-icon-192.png');
}

function currentState() {
  return {
    appVersion: app.getVersion(),
    trackerVersion: runtimeManager?.publicState().installedVersion || 'nicht installiert',
    settings: configStore?.publicSettings() || {
      pilotId: '',
      hasPin: false,
      voiceProvider: 'gemini',
      hasVoiceApiKey: false,
      runtimeChannel: 'stable',
      desktopUpdatePolicy: 'ask',
      updatePolicy: 'ask',
      homebaseUpdatePolicy: 'ask',
      efbUpdatePolicy: 'ask',
      bridgeUpdatePolicy: 'ask',
      aptMissionExecutionEnabled: false,
      autoStartTracker: true,
      startMinimized: false,
      autoStartBridge: false,
      stopBridgeWithTracker: true
    },
    tracker: trackerProcess?.publicState() || null,
    desktopUpdate: desktopUpdateController?.publicState() || null,
    update: runtimeManager?.publicState() || null,
    homebaseAssets: homebaseManager?.publicState() || null,
    efbPackage: efbPackageManager?.publicState() || null,
    bridge: bridgeManager?.publicState() || null
  };
}

function managedModuleState(module) {
  if (module === 'homebase') return homebaseManager?.publicState() || null;
  if (module === 'efb') return efbPackageManager?.publicState() || null;
  if (module === 'bridge') return bridgeManager?.publicState() || null;
  return null;
}

function managedModuleUpdatePolicy(module) {
  const key = MANAGED_UPDATE_MODULES[module]?.policyKey;
  return key && configStore?.publicSettings()?.[key] === 'automatic' ? 'automatic' : 'ask';
}

function shouldOfferManagedUpdate(module, state = managedModuleState(module)) {
  return Boolean(
    MANAGED_UPDATE_MODULES[module]
    && managedModuleUpdatePolicy(module) === 'ask'
    && state?.installed === true
    && state?.updateAvailable === true
    && String(state?.phase || '') === 'ready'
  );
}

function broadcastManagedModuleState(module, state) {
  broadcastState();
  if (shouldOfferManagedUpdate(module, state)) showWindow();
}

async function maybeAutoUpdateManagedModule(module) {
  const state = managedModuleState(module);
  if (managedModuleUpdatePolicy(module) !== 'automatic' || state?.installed !== true || state?.updateAvailable !== true) {
    return { ok: true, skipped: true };
  }
  if (state?.busy === true || ['checking', 'working', 'downloading', 'starting', 'installer-launched'].includes(String(state?.phase || ''))) {
    return { ok: true, skipped: true, busy: true };
  }
  if (module === 'homebase') return homebaseManager.install({ repair: false });
  if (module === 'efb') return efbPackageManager.install({ repair: false });
  if (module === 'bridge') return bridgeAction(() => bridgeManager.install());
  return { ok: false, message: 'Unbekanntes Update-Modul.' };
}

async function refreshManagedModule(module, { force = true } = {}) {
  let result;
  if (module === 'homebase') result = await homebaseManager.refresh({ force });
  else if (module === 'efb') result = await efbPackageManager.refresh({ force });
  else if (module === 'bridge') result = await bridgeAction(() => bridgeManager.refresh({ checkRemote: true }));
  else return { ok: false, message: 'Unbekanntes Update-Modul.' };
  if (result?.ok !== false) await maybeAutoUpdateManagedModule(module);
  return result;
}

function createRuntimeManager(channel) {
  const definition = runtimeChannelDefinition(channel);
  const manager = new TrackerRuntimeManager({
    runtimeRoot: runtimeRootForChannel(trackerApplicationRoot, definition.id),
    channelUrl: definition.channelUrl,
    getUpdatePolicy: () => configStore.publicSettings().updatePolicy,
    saveUpdatePolicy: (policy) => configStore.setUpdatePolicy(policy)
  });
  runtimeStateListener = (state) => {
    broadcastState();
    if (state?.phase === 'choice-required') showWindow();
  };
  manager.on('state', runtimeStateListener);
  return manager;
}

function replaceRuntimeManager(channel) {
  if (runtimeManager && runtimeStateListener) runtimeManager.off('state', runtimeStateListener);
  runtimeManager = createRuntimeManager(channel);
  if (trackerProcess) trackerProcess.runtimeManager = runtimeManager;
  return runtimeManager;
}

function setDevelopmentRuntimeState(channel) {
  const label = runtimeChannelDefinition(channel).label;
  runtimeManager.setState({
    phase: 'development',
    version: 'v314',
    installedVersion: 'v314',
    message: `Entwicklungsmodus: tracker.js wird direkt gestartet. Zielkanal: ${label}.`
  });
}

async function stopTrackerAndWait() {
  if (!trackerProcess?.child) return { ok: true, wasRunning: false };
  return new Promise((resolve) => {
    let finished = false;
    const done = (result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      trackerProcess.off('exit', onExit);
      resolve(result);
    };
    const onExit = () => done({ ok: true, wasRunning: true });
    const timeout = setTimeout(() => done({ ok: false, wasRunning: true, message: 'Der laufende Tracker konnte nicht rechtzeitig beendet werden.' }), 10000);
    trackerProcess.once('exit', onExit);
    const result = trackerProcess.stop();
    if (result?.ok === false) done({ ok: false, wasRunning: true, message: result.message || 'Tracker konnte nicht beendet werden.' });
  });
}

async function switchRuntimeChannel(rawChannel) {
  const requested = String(rawChannel || '').trim().toLowerCase();
  if (!Object.hasOwn(RUNTIME_CHANNELS, requested)) return { ok: false, message: 'Unbekannter Tracker-Kanal.' };
  const current = normalizeRuntimeChannel(configStore.publicSettings().runtimeChannel);
  if (requested === current) return { ok: true, channel: current, unchanged: true };
  if (['checking', 'downloading', 'choice-required'].includes(runtimeManager.publicState().phase) || runtimeManager.busy) {
    return { ok: false, message: 'Der Tracker-Kanal kann während einer laufenden Updateprüfung nicht gewechselt werden.' };
  }

  const stopped = await stopTrackerAndWait();
  if (!stopped.ok) return stopped;

  configStore.setRuntimeChannel(requested);
  efbPackageManager?.setChannel(requested);
  const manager = replaceRuntimeManager(requested);
  broadcastState();
  refreshManagedModule('efb', { force: true }).catch(() => {});
  try {
    if (app.isPackaged) await manager.ensureReady();
    else setDevelopmentRuntimeState(requested);
    if (stopped.wasRunning) {
      trackerStartupAllowed = true;
      const started = await startTrackerIfReady();
      if (!started?.ok) return { ...started, channel: requested };
    }
    broadcastState();
    return { ok: true, channel: requested };
  } catch (error) {
    showWindow();
    broadcastState();
    return { ok: false, channel: requested, message: error?.message || String(error) };
  }
}

async function setAptMissionExecutionEnabled(rawEnabled) {
  const enabled = rawEnabled === true;
  const settings = configStore.publicSettings();
  if (enabled && settings.runtimeChannel !== 'alpha') {
    return { ok: false, message: 'Die experimentelle APT-Tracker-Steuerung kann nur im Alpha-Kanal aktiviert werden.' };
  }
  if (settings.aptMissionExecutionEnabled === enabled) {
    return { ok: true, unchanged: true, settings };
  }

  const stopped = await stopTrackerAndWait();
  if (!stopped.ok) return stopped;

  try {
    configStore.setAptMissionExecutionEnabled(enabled);
  } catch (error) {
    if (stopped.wasRunning) {
      trackerStartupAllowed = true;
      await startTrackerIfReady();
    }
    return { ok: false, message: error?.message || String(error) };
  }
  if (stopped.wasRunning) {
    trackerStartupAllowed = true;
    const started = await startTrackerIfReady();
    if (!started?.ok) {
      broadcastState();
      return {
        ok: true,
        enabled,
        restartFailed: true,
        message: 'Einstellung gespeichert. Der Tracker konnte nicht automatisch neu gestartet werden.'
      };
    }
  }
  broadcastState();
  return { ok: true, enabled, settings: configStore.publicSettings() };
}

function broadcastState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('state:changed', currentState());
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.show();
  mainWindow.focus();
}

function createWindow({ showOnReady = true } = {}) {
  mainWindow = new BrowserWindow({
    width: 520,
    height: 840,
    minWidth: 460,
    minHeight: 680,
    show: false,
    backgroundColor: '#07111d',
    icon: iconPath(),
    title: 'VFR Multitool Tracker',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault();
  });
  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    if (showOnReady) mainWindow.show();
  });
  mainWindow.webContents.once('did-finish-load', () => {
    const capturePath = String(process.env.VFR_TRACKER_CAPTURE_PATH || '').trim();
    if (!capturePath) return;
    setTimeout(async () => {
      try {
        const captureScrollY = Number(process.env.VFR_TRACKER_CAPTURE_SCROLL_Y || 0);
        if (Number.isFinite(captureScrollY) && captureScrollY > 0) {
          await mainWindow.webContents.executeJavaScript(`window.scrollTo(0, ${Math.round(captureScrollY)})`);
          await new Promise((resolve) => setTimeout(resolve, 120));
        }
        const image = await mainWindow.webContents.capturePage();
        fs.writeFileSync(capturePath, image.toPNG());
      } finally {
        app.isQuitting = true;
        app.quit();
      }
    }, 500);
  });
  mainWindow.on('close', (event) => {
    if (app.isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });
}

function updateTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  const desktopUpdate = desktopUpdateController?.publicState() || {};
  const desktopUpdateBusy = ['checking', 'downloading', 'installing'].includes(desktopUpdate.phase);
  const desktopUpdateLabel = desktopUpdate.phase === 'ready'
    ? `Tracker-App v${desktopUpdate.version || ''} installieren`.trim()
    : (desktopUpdate.phase === 'checking' ? 'App-Update wird geprüft …' : 'App-Update prüfen');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Tracker anzeigen', click: showWindow },
    { type: 'separator' },
    {
      label: 'Tracker starten',
      click: () => {
        trackerStartupAllowed = true;
        startTrackerIfReady().catch(() => {});
      }
    },
    { label: 'Tracker stoppen', click: () => trackerProcess?.stop() },
    { type: 'separator' },
    {
      label: desktopUpdateLabel,
      enabled: desktopUpdate.supported === true && !desktopUpdateBusy,
      click: () => {
        showWindow();
        if (desktopUpdateController?.publicState().phase === 'ready') void desktopUpdateController.install();
        else void desktopUpdateController?.check({ manual: true });
      }
    },
    { type: 'separator' },
    {
      label: 'Beenden',
      click: () => {
        app.isQuitting = true;
        trackerProcess?.stop();
        app.quit();
      }
    }
  ]));
}

function createTray() {
  const image = nativeImage.createFromPath(iconPath()).resize({ width: 20, height: 20 });
  tray = new Tray(image);
  tray.setToolTip('VFR Multitool Tracker');
  updateTrayMenu();
  tray.on('double-click', showWindow);
}

async function startTrackerIfReady() {
  if (!trackerStartupAllowed || !configStore.hasCredentials()) {
    broadcastState();
    return { ok: false, needsCredentials: !configStore.hasCredentials() };
  }
  if (app.isPackaged && !runtimeManager.currentExecutablePath()) {
    try {
      await runtimeManager.ensureReady();
    } catch (error) {
      showWindow();
      broadcastState();
      return { ok: false, message: error?.message || String(error) };
    }
  }
  const result = trackerProcess.start();
  broadcastState();
  return result;
}

async function bridgeAction(action) {
  try {
    const result = await action();
    broadcastState();
    return result;
  } catch (error) {
    const message = error?.message || String(error);
    bridgeManager?.setState({ phase: 'error', message, error });
    broadcastState();
    return { ok: false, message };
  }
}

function registerIpc() {
  ipcMain.handle('app:get-state', () => currentState());
  ipcMain.handle('tracker:start', async () => {
    trackerStartupAllowed = true;
    return startTrackerIfReady();
  });
  ipcMain.handle('tracker:stop', () => trackerProcess.stop());
  ipcMain.handle('bridge:refresh', () => refreshManagedModule('bridge', { force: true }));
  ipcMain.handle('bridge:install', () => bridgeAction(() => bridgeManager.install()));
  ipcMain.handle('bridge:start', () => bridgeAction(() => bridgeManager.start()));
  ipcMain.handle('bridge:stop', () => bridgeAction(() => bridgeManager.stop()));
  ipcMain.handle('bridge:show-settings', () => bridgeAction(() => bridgeManager.showSettings()));
  ipcMain.handle('settings:save-credentials', async (_event, payload) => {
    const pilotId = String(payload?.pilotId || '').trim();
    const pin = String(payload?.pin || '').trim();
    const verification = await verifyCredentials(pilotId, pin);
    if (!verification.ok) return verification;
    try {
      configStore.saveCredentials(verification.pilotId, pin);
    } catch (error) {
      return { ok: false, message: error?.message || String(error) };
    }
    trackerStartupAllowed = true;
    if (trackerProcess.child) {
      trackerProcess.once('exit', () => startTrackerIfReady().catch(() => {}));
      trackerProcess.stop();
    } else {
      startTrackerIfReady().catch(() => {});
    }
    broadcastState();
    return { ok: true, pilotId: verification.pilotId };
  });
  ipcMain.handle('settings:save-voice-credentials', (_event, payload) => {
    try {
      const saved = configStore.saveVoiceCredentials(payload?.provider, payload?.apiKey);
      if (trackerProcess.child) {
        trackerProcess.once('exit', () => startTrackerIfReady().catch(() => {}));
        trackerProcess.stop();
      }
      broadcastState();
      return { ok: true, ...saved };
    } catch (error) {
      return { ok: false, message: error?.message || String(error) };
    }
  });
  ipcMain.handle('settings:clear-voice-credentials', () => {
    try {
      const cleared = configStore.clearVoiceCredentials();
      if (trackerProcess.child) {
        trackerProcess.once('exit', () => startTrackerIfReady().catch(() => {}));
        trackerProcess.stop();
      }
      broadcastState();
      return { ok: true, ...cleared };
    } catch (error) {
      return { ok: false, message: error?.message || String(error) };
    }
  });
  ipcMain.handle('settings:set-update-policy', (_event, payload) => {
    configStore.setUpdatePolicy(payload?.policy);
    broadcastState();
    return { ok: true, settings: configStore.publicSettings() };
  });
  ipcMain.handle('settings:set-module-update-policy', async (_event, payload) => {
    const module = String(payload?.module || '').trim().toLowerCase();
    if (module === 'desktop') {
      const policy = payload?.policy === 'automatic' ? 'automatic' : 'ask';
      configStore.setModuleUpdatePolicy('desktop', policy);
      broadcastState();
      const update = policy === 'automatic' && desktopUpdateController?.publicState().phase === 'choice-required'
        ? desktopUpdateController.handleChoice('automatic')
        : { ok: true, skipped: true };
      return { ok: update?.ok !== false, settings: configStore.publicSettings(), update };
    }
    if (!MANAGED_UPDATE_MODULES[module]) return { ok: false, message: 'Unbekanntes Update-Modul.' };
    configStore.setModuleUpdatePolicy(module, payload?.policy);
    broadcastState();
    const update = await maybeAutoUpdateManagedModule(module);
    return { ok: update?.ok !== false, settings: configStore.publicSettings(), update };
  });
  ipcMain.handle('settings:set-runtime-channel', (_event, payload) => switchRuntimeChannel(payload?.channel));
  ipcMain.handle('settings:set-apt-mission-execution', (_event, payload) => setAptMissionExecutionEnabled(payload?.enabled));
  ipcMain.handle('settings:set-startup-preferences', (_event, payload) => {
    configStore.setStartupPreferences({
      autoStartTracker: payload?.autoStartTracker === true,
      startMinimized: payload?.startMinimized === true,
      autoStartBridge: payload?.autoStartBridge === true,
      stopBridgeWithTracker: payload?.stopBridgeWithTracker !== false
    });
    broadcastState();
    return { ok: true, settings: configStore.publicSettings() };
  });
  ipcMain.handle('desktop-update:choice', (_event, payload) => desktopUpdateController.handleChoice(payload?.choice));
  ipcMain.handle('desktop-update:check', () => desktopUpdateController.check({ manual: true }));
  ipcMain.handle('desktop-update:install', () => desktopUpdateController.install());
  ipcMain.handle('update:choice', (_event, payload) => runtimeManager.handleChoice(payload?.choice));
  ipcMain.handle('runtime:check', async () => {
    const wasRunning = Boolean(trackerProcess.child);
    try {
      if (wasRunning) {
        await new Promise((resolve) => {
          trackerProcess.once('exit', resolve);
          trackerProcess.stop();
        });
      }
      const result = await runtimeManager.ensureReady({ force: true });
      if (wasRunning) {
        trackerStartupAllowed = true;
        await startTrackerIfReady();
      }
      return { ok: Boolean(result) };
    } catch (error) {
      if (wasRunning && runtimeManager.currentExecutablePath()) {
        trackerStartupAllowed = true;
        await startTrackerIfReady();
      }
      return { ok: false, message: error?.message || String(error) };
    }
  });
  ipcMain.handle('homebase:refresh', () => refreshManagedModule('homebase', { force: true }));
  ipcMain.handle('homebase:install', (_event, payload) => {
    if (payload?.confirmed !== true) return { ok: false, message: 'Ausdrückliche Bestätigung fehlt.' };
    return homebaseManager.install({ repair: payload?.repair === true });
  });
  ipcMain.handle('homebase:uninstall', (_event, payload) => {
    if (payload?.confirmed !== true) return { ok: false, message: 'Ausdrückliche Bestätigung fehlt.' };
    return homebaseManager.uninstall();
  });
  ipcMain.handle('efb:refresh', () => refreshManagedModule('efb', { force: true }));
  ipcMain.handle('efb:install', (_event, payload) => {
    if (payload?.confirmed !== true) return { ok: false, message: 'Ausdrückliche Bestätigung fehlt.' };
    return efbPackageManager.install({ repair: payload?.repair === true });
  });
  ipcMain.handle('efb:uninstall', (_event, payload) => {
    if (payload?.confirmed !== true) return { ok: false, message: 'Ausdrückliche Bestätigung fehlt.' };
    return efbPackageManager.uninstall();
  });
  ipcMain.handle('system:open-data-folder', async () => {
    const error = await shell.openPath(configStore.dataDirectory);
    return { ok: !error, message: error || '' };
  });
  ipcMain.handle('system:show-apt-test-log', async () => {
    const filename = path.join(configStore.dataDirectory, APT_MISSION_TEST_LOG_FILENAME);
    if (!fs.existsSync(filename)) {
      const error = await shell.openPath(configStore.dataDirectory);
      return {
        ok: false,
        missing: true,
        message: error || 'Das APT-Testlog entsteht automatisch, sobald Tracker v366 oder neuer gestartet wurde.'
      };
    }
    shell.showItemInFolder(filename);
    return { ok: true, filename };
  });
}

async function startApplication() {
  const documentsDirectory = String(process.env.VFR_MULTITOOL_DOCUMENTS_DIR || '').trim() || app.getPath('documents');
  const localAppDataBase = String(process.env.VFR_MULTITOOL_LOCAL_APP_DATA_DIR || process.env.LOCALAPPDATA || '').trim() || app.getPath('appData');
  const applicationRoot = path.join(localAppDataBase, 'VFR Multitool');
  trackerApplicationRoot = applicationRoot;
  const desktopDataDirectory = path.join(applicationRoot, 'Desktop');
  configStore = new TrackerConfigStore({
    documentsDirectory,
    applicationDataDirectory: desktopDataDirectory,
    secureStorage: safeStorage
  });
  configStore.ensureDataDirectory();
  const migration = await configStore.migrateLegacyCredentials(verifyCredentials);
  const portableBuild = Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
  desktopUpdateController = new UpdateController({
    autoUpdater,
    isPackaged: app.isPackaged && !portableBuild,
    platform: process.platform,
    getPolicy: () => configStore.publicSettings().desktopUpdatePolicy,
    savePolicy: (policy) => configStore.setModuleUpdatePolicy('desktop', policy),
    beforeInstall: async () => {
      app.isQuitting = true;
      trackerProcess?.stop();
      bridgeManager?.stopPolling();
      if (bridgeManager) await bridgeManager.shutdownOwned();
      finalQuitReady = true;
    }
  });
  desktopUpdateController.on('state', (state) => {
    updateTrayMenu();
    broadcastState();
    if (['choice-required', 'ready'].includes(state?.phase)) showWindow();
  });
  const previewDesktopUpdate = String(process.env.VFR_TRACKER_PREVIEW_DESKTOP_UPDATE || '').trim();
  if (previewDesktopUpdate) {
    const phase = ['choice-required', 'downloading', 'ready'].includes(previewDesktopUpdate) ? previewDesktopUpdate : 'choice-required';
    desktopUpdateController.setState({
      supported: true,
      phase,
      version: '1.6.1',
      percent: phase === 'downloading' ? 46 : (phase === 'ready' ? 100 : 0),
      message: phase === 'ready'
        ? 'Das App-Update ist geprüft und zur Installation bereit.'
        : (phase === 'downloading' ? 'Desktop-App wird geladen und geprüft … 46 %' : 'Desktop-App v1.6.1 ist verfügbar.')
    });
  }
  runtimeManager = createRuntimeManager(configStore.publicSettings().runtimeChannel);
  if (process.env.VFR_TRACKER_PREVIEW_UPDATE === '1') {
    runtimeManager.setState({
      phase: 'choice-required',
      version: 'v315',
      installedVersion: 'v314',
      message: 'Tracker v315 ist verfügbar.'
    });
  }
  const supportModulePath = app.isPackaged
    ? path.join(process.resourcesPath, 'homebase-support', 'homebase-package-service.js')
    : path.resolve(__dirname, '..', 'homebase-package-service.js');
  const updaterModulePath = app.isPackaged
    ? path.join(process.resourcesPath, 'homebase-support', 'homebase-asset-updater.js')
    : path.resolve(__dirname, '..', 'homebase-asset-updater.js');
  homebaseManager = new HomebaseAssetManager({
    supportModulePath,
    runtimeDirectory: path.join(applicationRoot, 'Homebase Manager'),
    appData: process.env.APPDATA || app.getPath('appData'),
    localAppData: localAppDataBase
  });
  homebaseManager.inspect();
  efbPackageManager = new EfbPackageManager({
    supportModulePath,
    updaterModulePath,
    runtimeDirectory: path.join(applicationRoot, 'EFB Package Manager'),
    appData: process.env.APPDATA || app.getPath('appData'),
    localAppData: localAppDataBase,
    channel: configStore.publicSettings().runtimeChannel
  });
  efbPackageManager.inspect();
  trackerProcess = new TrackerProcess({
    electronApp: app,
    dataDirectory: configStore.dataDirectory,
    runtimeManager,
    getCredentials: () => {
      const credentials = configStore.credentials();
      if (!credentials) return null;
      const voice = configStore.voiceCredentials();
      return voice ? { ...credentials, voice } : credentials;
    },
    getRuntimeChannel: () => configStore.publicSettings().runtimeChannel,
    getAptMissionExecutionEnabled: () => configStore.publicSettings().aptMissionExecutionEnabled
  });
  const developmentBridgeDirectory = path.resolve(__dirname, '..', 'accusim-router-desktop');
  let developmentBridgeVersion = '';
  if (!app.isPackaged) {
    try {
      developmentBridgeVersion = String(JSON.parse(fs.readFileSync(path.join(developmentBridgeDirectory, 'package.json'), 'utf8')).version || '');
    } catch (_) {}
  }
  bridgeManager = new BridgeManager({
    localAppData: localAppDataBase,
    installerRoot: path.join(applicationRoot, 'Bridge Installer'),
    explicitExecutablePath: String(process.env.VFR_MULTITOOL_BRIDGE_EXECUTABLE || '').trim(),
    developmentSpec: app.isPackaged ? null : {
      command: process.execPath,
      args: [developmentBridgeDirectory],
      cwd: developmentBridgeDirectory,
      env: process.env,
      version: developmentBridgeVersion
    },
    launchInstaller: async (file) => {
      const error = await shell.openPath(file);
      if (error) throw new Error(error);
    }
  });

  trackerProcess.on('state', broadcastState);
  trackerProcess.on('log', (entry) => {
    if (/Keine Anmeldung bestätigt|Pilot-ID nicht gefunden|PIN .* falsch/.test(String(entry?.line || ''))) showWindow();
  });
  homebaseManager.on('state', (state) => broadcastManagedModuleState('homebase', state));
  efbPackageManager.on('state', (state) => broadcastManagedModuleState('efb', state));
  bridgeManager.on('state', (state) => broadcastManagedModuleState('bridge', state));

  registerIpc();
  const launchDecision = startupDecision(configStore.publicSettings(), configStore.hasCredentials());
  createWindow({ showOnReady: launchDecision.showWindow || migration.verificationFailed === true });
  createTray();
  if (!previewDesktopUpdate) void desktopUpdateController.checkAtStartup();

  if (app.isPackaged) {
    try {
      const runtime = await runtimeManager.ensureReady();
      if (runtime) {
        trackerStartupAllowed = true;
        const decision = startupDecision(configStore.publicSettings(), configStore.hasCredentials());
        if (decision.startTracker) await startTrackerIfReady();
      }
    } catch (_) {
      showWindow();
    }
  } else {
    setDevelopmentRuntimeState(configStore.publicSettings().runtimeChannel);
    trackerStartupAllowed = true;
    const decision = startupDecision(configStore.publicSettings(), configStore.hasCredentials());
    if (decision.startTracker && !trackerProcess.child) await startTrackerIfReady();
  }
  if (!configStore.hasCredentials()) showWindow();
  if (migration.verificationFailed) showWindow();
  refreshManagedModule('homebase', { force: false }).catch(() => {});
  refreshManagedModule('efb', { force: false }).catch(() => {});
  void (async () => {
    await refreshManagedModule('bridge', { force: false });
    if (configStore.publicSettings().autoStartBridge && bridgeManager.publicState().phase !== 'installer-launched') await bridgeManager.start();
    bridgeManager.startPolling();
  })().catch(() => {});
  broadcastState();
}

if (!singleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(startApplication);
  app.on('activate', showWindow);
  app.on('before-quit', (event) => {
    app.isQuitting = true;
    trackerProcess?.stop();
    bridgeManager?.stopPolling();
    const shouldStopBridge = configStore?.publicSettings().stopBridgeWithTracker !== false;
    if (finalQuitReady || !shouldStopBridge || !bridgeManager) return;
    event.preventDefault();
    if (bridgeShutdownInProgress) return;
    bridgeShutdownInProgress = true;
    bridgeManager.shutdownOwned().finally(() => {
      finalQuitReady = true;
      app.quit();
    });
  });
  app.on('window-all-closed', () => {
    // Die App bleibt als Windows-Tray-Anwendung aktiv.
  });
}
