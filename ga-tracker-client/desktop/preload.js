const { contextBridge, ipcRenderer } = require('electron');

const EVENTS = new Set(['state:changed']);

contextBridge.exposeInMainWorld('trackerDesktop', {
  getState: () => ipcRenderer.invoke('app:get-state'),
  startTracker: () => ipcRenderer.invoke('tracker:start'),
  stopTracker: () => ipcRenderer.invoke('tracker:stop'),
  refreshBridge: () => ipcRenderer.invoke('bridge:refresh'),
  installBridge: () => ipcRenderer.invoke('bridge:install'),
  startBridge: () => ipcRenderer.invoke('bridge:start'),
  stopBridge: () => ipcRenderer.invoke('bridge:stop'),
  showBridgeSettings: () => ipcRenderer.invoke('bridge:show-settings'),
  saveCredentials: (pilotId, pin) => ipcRenderer.invoke('settings:save-credentials', { pilotId, pin }),
  setUpdatePolicy: (policy) => ipcRenderer.invoke('settings:set-update-policy', { policy }),
  setStartupPreferences: (preferences) => ipcRenderer.invoke('settings:set-startup-preferences', preferences),
  chooseUpdate: (choice) => ipcRenderer.invoke('update:choice', { choice }),
  checkRuntimeUpdate: () => ipcRenderer.invoke('runtime:check'),
  refreshHomebaseAssets: () => ipcRenderer.invoke('homebase:refresh'),
  installHomebaseAssets: (repair = false) => ipcRenderer.invoke('homebase:install', { confirmed: true, repair }),
  uninstallHomebaseAssets: () => ipcRenderer.invoke('homebase:uninstall', { confirmed: true }),
  openDataFolder: () => ipcRenderer.invoke('system:open-data-folder'),
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
