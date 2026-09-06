const { contextBridge, ipcRenderer } = require('electron');

const EVENTS = new Set(['state:changed']);

contextBridge.exposeInMainWorld('trackerDesktop', {
  getState: () => ipcRenderer.invoke('app:get-state'),
  startTracker: () => ipcRenderer.invoke('tracker:start'),
  stopTracker: () => ipcRenderer.invoke('tracker:stop'),
  hardResetMission: () => ipcRenderer.invoke('tracker:hard-reset-mission'),
  refreshBridge: () => ipcRenderer.invoke('bridge:refresh'),
  installBridge: () => ipcRenderer.invoke('bridge:install'),
  startBridge: () => ipcRenderer.invoke('bridge:start'),
  stopBridge: () => ipcRenderer.invoke('bridge:stop'),
  showBridgeSettings: () => ipcRenderer.invoke('bridge:show-settings'),
  saveCredentials: (pilotId, pin) => ipcRenderer.invoke('settings:save-credentials', { pilotId, pin }),
  saveVoiceCredentials: (provider, apiKey) => ipcRenderer.invoke('settings:save-voice-credentials', { provider, apiKey }),
  clearVoiceCredentials: () => ipcRenderer.invoke('settings:clear-voice-credentials'),
  setRuntimeChannel: (channel) => ipcRenderer.invoke('settings:set-runtime-channel', { channel }),
  setAptMissionExecutionEnabled: (enabled) => ipcRenderer.invoke('settings:set-apt-mission-execution', { enabled }),
  setUpdatePolicy: (policy) => ipcRenderer.invoke('settings:set-update-policy', { policy }),
  setModuleUpdatePolicy: (module, policy) => ipcRenderer.invoke('settings:set-module-update-policy', { module, policy }),
  setStartupPreferences: (preferences) => ipcRenderer.invoke('settings:set-startup-preferences', preferences),
  chooseDesktopUpdate: (choice) => ipcRenderer.invoke('desktop-update:choice', { choice }),
  checkDesktopUpdate: () => ipcRenderer.invoke('desktop-update:check'),
  installDesktopUpdate: () => ipcRenderer.invoke('desktop-update:install'),
  chooseUpdate: (choice) => ipcRenderer.invoke('update:choice', { choice }),
  checkRuntimeUpdate: () => ipcRenderer.invoke('runtime:check'),
  refreshHomebaseAssets: () => ipcRenderer.invoke('homebase:refresh'),
  installHomebaseAssets: (repair = false) => ipcRenderer.invoke('homebase:install', { confirmed: true, repair }),
  uninstallHomebaseAssets: () => ipcRenderer.invoke('homebase:uninstall', { confirmed: true }),
  refreshEfbPackage: () => ipcRenderer.invoke('efb:refresh'),
  installEfbPackage: (repair = false) => ipcRenderer.invoke('efb:install', { confirmed: true, repair }),
  uninstallEfbPackage: () => ipcRenderer.invoke('efb:uninstall', { confirmed: true }),
  openDataFolder: () => ipcRenderer.invoke('system:open-data-folder'),
  showAptTestLog: () => ipcRenderer.invoke('system:show-apt-test-log'),
  onStateChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('state:changed', listener);
    return () => ipcRenderer.removeListener('state:changed', listener);
  },
  removeAllListeners: (eventName) => {
    if (EVENTS.has(eventName)) ipcRenderer.removeAllListeners(eventName);
  }
});
