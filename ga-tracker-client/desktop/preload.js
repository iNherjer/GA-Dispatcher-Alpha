const { contextBridge, ipcRenderer, webUtils } = require('electron');

const EVENTS = new Set(['state:changed', 'radio-hold:changed', 'radio-hold:levels']);

contextBridge.exposeInMainWorld('trackerDesktop', {
  getState: () => ipcRenderer.invoke('app:get-state'),
  audioRequest: (kind, payload) => ipcRenderer.invoke('tracker:audio', kind, payload),
  mediaRequest: payload => ipcRenderer.invoke('tracker:media', payload),
  setAudioOutputDeviceId: id => ipcRenderer.invoke('settings:audio-output', id),
  getRadioHold: () => ipcRenderer.invoke('radio-hold:get'),
  resumeRadioHold: () => ipcRenderer.invoke('radio-hold:resume'),
  logRadioHold: line => ipcRenderer.invoke('radio-hold:log', String(line || '').slice(0, 400)),
  learnRadioHoldButton: () => ipcRenderer.invoke('radio-hold:learn'),
  removeRadioHoldButton: index => ipcRenderer.invoke('radio-hold:remove', index),
  listRadioHoldAudio: active => ipcRenderer.invoke('radio-hold:list-audio', active === true),
  addRadioHoldProgram: name => ipcRenderer.invoke('radio-hold:add-program', String(name || '').slice(0, 64)),
  onRadioHoldLevels: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, sessions) => callback(sessions);
    ipcRenderer.on('radio-hold:levels', listener);
    return () => ipcRenderer.removeListener('radio-hold:levels', listener);
  },
  setRadioHold: settings => ipcRenderer.invoke('settings:set-radio-hold', settings),
  onRadioHoldChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('radio-hold:changed', listener);
    return () => ipcRenderer.removeListener('radio-hold:changed', listener);
  },
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
  setAutostartOptions: (options) => ipcRenderer.invoke('autostart:set-options', options),
  // Der Renderer uebergibt ein echtes Array: eine FileList kommt ueber die
  // contextBridge nur als leeres Objekt an.
  addAutostartFiles: (files) => ipcRenderer.invoke('autostart:add-paths', {
    paths: (Array.isArray(files) ? files : []).map((file) => {
      try { return webUtils.getPathForFile(file); } catch (_) { return ''; }
    }).filter(Boolean)
  }),
  browseAutostartPrograms: () => ipcRenderer.invoke('autostart:browse'),
  updateAutostartEntries: (entries) => ipcRenderer.invoke('autostart:update-entries', { entries }),
  detectSimulators: () => ipcRenderer.invoke('autostart:detect-sims'),
  chooseSimulator: (key) => ipcRenderer.invoke('autostart:choose-sim', { key }),
  launchAutostart: () => ipcRenderer.invoke('autostart:launch-all'),
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
