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
const { HomebaseAssetManager } = require('./lib/homebase-manager');
const { TrackerRuntimeManager } = require('./lib/runtime-manager');
const { TrackerProcess } = require('./lib/tracker-process');

const singleInstanceLock = app.requestSingleInstanceLock();

let mainWindow = null;
let tray = null;
let configStore = null;
let trackerProcess = null;
let runtimeManager = null;
let homebaseManager = null;
let bridgeManager = null;
let trackerStartupAllowed = false;
let finalQuitReady = false;
let bridgeShutdownInProgress = false;
let trackerApplicationRoot = '';
let runtimeStateListener = null;

function iconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'icon.png')
    : path.resolve(__dirname, '..', '..', 'icon-192.png');
}

function currentState() {
  return {
    appVersion: app.getVersion(),
    trackerVersion: runtimeManager?.publicState().installedVersion || 'nicht installiert',
    settings: configStore?.publicSettings() || {
      pilotId: '',
      hasPin: false,
      runtimeChannel: 'stable',
      updatePolicy: 'ask',
      autoStartTracker: true,
      startMinimized: false,
      autoStartBridge: false,
      stopBridgeWithTracker: true
    },
    tracker: trackerProcess?.publicState() || null,
    update: runtimeManager?.publicState() || null,
    homebaseAssets: homebaseManager?.publicState() || null,
    bridge: bridgeManager?.publicState() || null
  };
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
  const manager = replaceRuntimeManager(requested);
  broadcastState();
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

function createTray() {
  const image = nativeImage.createFromPath(iconPath()).resize({ width: 20, height: 20 });
  tray = new Tray(image);
  tray.setToolTip('VFR Multitool Tracker');
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
      label: 'Beenden',
      click: () => {
        app.isQuitting = true;
        trackerProcess?.stop();
        app.quit();
      }
    }
  ]));
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
  ipcMain.handle('bridge:refresh', () => bridgeAction(() => bridgeManager.refresh({ checkRemote: true })));
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
  ipcMain.handle('settings:set-update-policy', (_event, payload) => {
    configStore.setUpdatePolicy(payload?.policy);
    broadcastState();
    return { ok: true, settings: configStore.publicSettings() };
  });
  ipcMain.handle('settings:set-runtime-channel', (_event, payload) => switchRuntimeChannel(payload?.channel));
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
  ipcMain.handle('homebase:refresh', () => homebaseManager.refresh({ force: true }));
  ipcMain.handle('homebase:install', (_event, payload) => {
    if (payload?.confirmed !== true) return { ok: false, message: 'Ausdrückliche Bestätigung fehlt.' };
    return homebaseManager.install({ repair: payload?.repair === true });
  });
  ipcMain.handle('homebase:uninstall', (_event, payload) => {
    if (payload?.confirmed !== true) return { ok: false, message: 'Ausdrückliche Bestätigung fehlt.' };
    return homebaseManager.uninstall();
  });
  ipcMain.handle('system:open-data-folder', async () => {
    const error = await shell.openPath(configStore.dataDirectory);
    return { ok: !error, message: error || '' };
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
  homebaseManager = new HomebaseAssetManager({
    supportModulePath,
    runtimeDirectory: path.join(applicationRoot, 'Homebase Manager'),
    appData: process.env.APPDATA || app.getPath('appData'),
    localAppData: localAppDataBase
  });
  homebaseManager.inspect();
  trackerProcess = new TrackerProcess({
    electronApp: app,
    dataDirectory: configStore.dataDirectory,
    runtimeManager,
    getCredentials: () => configStore.credentials(),
    getRuntimeChannel: () => configStore.publicSettings().runtimeChannel
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
  homebaseManager.on('state', broadcastState);
  bridgeManager.on('state', broadcastState);

  registerIpc();
  const launchDecision = startupDecision(configStore.publicSettings(), configStore.hasCredentials());
  createWindow({ showOnReady: launchDecision.showWindow || migration.verificationFailed === true });
  createTray();

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
  homebaseManager.refresh({ force: false }).catch(() => {});
  void (async () => {
    await bridgeManager.refresh();
    if (configStore.publicSettings().autoStartBridge) await bridgeManager.start();
    bridgeManager.startPolling();
    await bridgeManager.checkLatest({ quiet: true });
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
