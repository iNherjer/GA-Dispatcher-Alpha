const elements = {
  versionLine: document.getElementById('versionLine'),
  processBadge: document.getElementById('processBadge'),
  relayDot: document.getElementById('relayDot'),
  relayStatus: document.getElementById('relayStatus'),
  simDot: document.getElementById('simDot'),
  simStatus: document.getElementById('simStatus'),
  telemetryDot: document.getElementById('telemetryDot'),
  telemetryStatus: document.getElementById('telemetryStatus'),
  pilotIdInput: document.getElementById('pilotIdInput'),
  pinInput: document.getElementById('pinInput'),
  credentialsForm: document.getElementById('credentialsForm'),
  saveCredentialsButton: document.getElementById('saveCredentialsButton'),
  formMessage: document.getElementById('formMessage'),
  runtimeChannelSelect: document.getElementById('runtimeChannelSelect'),
  runtimeChannelMessage: document.getElementById('runtimeChannelMessage'),
  updatePolicySelect: document.getElementById('updatePolicySelect'),
  updateBadge: document.getElementById('updateBadge'),
  updateMessage: document.getElementById('updateMessage'),
  updateProgressWrap: document.getElementById('updateProgressWrap'),
  updateProgress: document.getElementById('updateProgress'),
  checkRuntimeButton: document.getElementById('checkRuntimeButton'),
  assetBadge: document.getElementById('assetBadge'),
  assetMessage: document.getElementById('assetMessage'),
  assetPath: document.getElementById('assetPath'),
  assetPrimaryButton: document.getElementById('assetPrimaryButton'),
  assetRepairButton: document.getElementById('assetRepairButton'),
  assetUninstallButton: document.getElementById('assetUninstallButton'),
  assetRefreshButton: document.getElementById('assetRefreshButton'),
  efbChannelLabel: document.getElementById('efbChannelLabel'),
  efbBadge: document.getElementById('efbBadge'),
  efbMessage: document.getElementById('efbMessage'),
  efbVersion: document.getElementById('efbVersion'),
  efbPath: document.getElementById('efbPath'),
  efbPrimaryButton: document.getElementById('efbPrimaryButton'),
  efbRepairButton: document.getElementById('efbRepairButton'),
  efbUninstallButton: document.getElementById('efbUninstallButton'),
  efbRefreshButton: document.getElementById('efbRefreshButton'),
  bridgeBadge: document.getElementById('bridgeBadge'),
  bridgeMessage: document.getElementById('bridgeMessage'),
  bridgeVersion: document.getElementById('bridgeVersion'),
  bridgeProcessStatus: document.getElementById('bridgeProcessStatus'),
  bridgeSimStatus: document.getElementById('bridgeSimStatus'),
  bridgeUdpStatus: document.getElementById('bridgeUdpStatus'),
  bridgeProgressWrap: document.getElementById('bridgeProgressWrap'),
  bridgeProgress: document.getElementById('bridgeProgress'),
  bridgeInstallButton: document.getElementById('bridgeInstallButton'),
  bridgeStartButton: document.getElementById('bridgeStartButton'),
  bridgeSettingsButton: document.getElementById('bridgeSettingsButton'),
  bridgeRefreshButton: document.getElementById('bridgeRefreshButton'),
  autoStartTrackerCheckbox: document.getElementById('autoStartTrackerCheckbox'),
  startMinimizedCheckbox: document.getElementById('startMinimizedCheckbox'),
  autoStartBridgeCheckbox: document.getElementById('autoStartBridgeCheckbox'),
  stopBridgeWithTrackerCheckbox: document.getElementById('stopBridgeWithTrackerCheckbox'),
  startButton: document.getElementById('startButton'),
  stopButton: document.getElementById('stopButton'),
  openFolderButton: document.getElementById('openFolderButton'),
  detailStatus: document.getElementById('detailStatus'),
  logOutput: document.getElementById('logOutput'),
  updateDialog: document.getElementById('updateDialog'),
  updateDialogTitle: document.getElementById('updateDialogTitle')
};

const labels = {
  process: {
    stopped: 'Bereit',
    starting: 'Startet',
    running: 'Aktiv',
    stopping: 'Stoppt',
    error: 'Fehler'
  },
  relay: {
    waiting: 'Wartet',
    connecting: 'Verbindet …',
    connected: 'Verbunden'
  },
  simulator: {
    waiting: 'Nicht verbunden',
    connected: 'Verbunden'
  },
  telemetry: {
    waiting: 'Keine Positionsdaten',
    live: 'Live'
  }
};

let latestState = null;
let dialogVisible = false;
let channelChangePending = false;

function setClass(element, baseClass, state) {
  element.className = `${baseClass} ${state || 'waiting'}`;
}

function renderLogs(logs) {
  if (!Array.isArray(logs) || !logs.length) {
    elements.logOutput.textContent = 'Noch keine Tracker-Ereignisse.';
    return;
  }
  elements.logOutput.textContent = logs.slice(-90).map((entry) => {
    const time = new Date(entry.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${time}  ${entry.line}`;
  }).join('\n');
  elements.logOutput.scrollTop = elements.logOutput.scrollHeight;
}

function renderUpdate(update) {
  if (!update) return;
  const phase = String(update.phase || 'idle');
  elements.updateBadge.textContent = {
    development: 'Entwicklung',
    idle: 'Bereit',
    checking: 'Prüft',
    current: 'Aktuell',
    'choice-required': 'Verfügbar',
    downloading: 'Download',
    ready: 'Installiert',
    deferred: 'Später',
    error: 'Fehler'
  }[phase] || 'Update';
  setClass(elements.updateBadge, 'mini-badge', phase);
  elements.updateMessage.textContent = update.message || '';
  const showProgress = phase === 'downloading' || phase === 'ready';
  elements.updateProgressWrap.hidden = !showProgress;
  elements.updateProgress.style.width = `${Math.max(0, Math.min(100, Number(update.percent) || 0))}%`;
  elements.checkRuntimeButton.disabled = ['checking', 'downloading', 'choice-required', 'development'].includes(phase);
  elements.runtimeChannelSelect.disabled = channelChangePending || ['checking', 'downloading', 'choice-required'].includes(phase);

  if (phase === 'choice-required' && !dialogVisible) {
    dialogVisible = true;
    elements.updateDialogTitle.textContent = `Tracker-Update ${update.version || ''} verfügbar`;
    elements.updateDialog.showModal();
  }
  if (phase !== 'choice-required' && dialogVisible) {
    dialogVisible = false;
    elements.updateDialog.close();
  }
}

function renderHomebaseAssets(assets = {}) {
  const phase = String(assets.phase || 'idle');
  const installed = assets.installed === true;
  const complete = assets.installedComplete === true;
  const busy = assets.busy === true || ['checking', 'working'].includes(phase);
  elements.assetBadge.textContent = {
    idle: 'Prüfung',
    checking: 'Prüft',
    working: 'Arbeitet',
    ready: complete ? (assets.updateAvailable ? 'Update' : 'Installiert') : (installed ? 'Reparatur' : 'Optional'),
    error: 'Fehler'
  }[phase] || 'Status';
  setClass(elements.assetBadge, 'mini-badge', phase === 'ready' && complete && !assets.updateAvailable ? 'current' : phase);
  elements.assetMessage.textContent = assets.message || 'Homebase-Assetstatus wird geprüft.';
  elements.assetPath.textContent = assets.communityPath ? `Community: ${assets.communityPath}` : '';
  elements.assetPrimaryButton.textContent = !installed
    ? 'Installieren'
    : (assets.updateAvailable ? `Auf ${assets.remoteVersion || 'neue Version'} aktualisieren` : 'Installiert');
  elements.assetPrimaryButton.disabled = busy || (complete && !assets.updateAvailable);
  elements.assetRepairButton.disabled = busy || !installed;
  elements.assetUninstallButton.disabled = busy || !installed;
  elements.assetRefreshButton.disabled = busy;
}

function renderEfbPackage(efb = {}, runtimeChannel = 'stable') {
  const phase = String(efb.phase || 'idle');
  const installed = efb.installed === true;
  const complete = efb.installedComplete === true;
  const remoteAvailable = efb.remoteAvailable === true;
  const busy = efb.busy === true || ['checking', 'working'].includes(phase);
  elements.efbChannelLabel.textContent = runtimeChannel.toUpperCase();
  elements.efbBadge.textContent = {
    idle: 'Prüfung',
    checking: 'Prüft',
    working: 'Arbeitet',
    ready: complete ? (efb.updateAvailable ? 'Update' : 'Installiert') : (installed ? 'Reparatur' : (remoteAvailable ? 'Optional' : 'Vorbereitung')),
    error: 'Fehler'
  }[phase] || 'Status';
  setClass(elements.efbBadge, 'mini-badge', phase === 'ready' && complete && !efb.updateAvailable ? 'current' : phase);
  elements.efbMessage.textContent = efb.message || 'EFB-Paketstatus wird geprüft.';
  const versions = [];
  if (efb.installedVersion) versions.push(`Installiert: ${efb.installedVersion}`);
  if (efb.remoteVersion) versions.push(`Verfügbar: ${efb.remoteVersion}`);
  elements.efbVersion.textContent = versions.join(' · ');
  elements.efbPath.textContent = efb.communityPath ? `Community: ${efb.communityPath}` : '';
  elements.efbPrimaryButton.textContent = !installed
    ? 'Installieren'
    : (efb.updateAvailable ? `Auf ${efb.remoteVersion || 'neue Version'} aktualisieren` : 'Installiert');
  elements.efbPrimaryButton.disabled = busy || !remoteAvailable || (complete && !efb.updateAvailable);
  elements.efbRepairButton.disabled = busy || !installed || !remoteAvailable;
  elements.efbUninstallButton.disabled = busy || !installed;
  elements.efbRefreshButton.disabled = busy;
}

function renderBridge(bridge = {}) {
  const phase = String(bridge.phase || 'idle');
  const installed = bridge.installed === true;
  const supported = bridge.integrationSupported === true;
  const controlled = bridge.controlAvailable === true;
  const runtime = bridge.runtime || {};
  const running = controlled && runtime.process === 'running';
  const busy = ['checking', 'downloading', 'starting'].includes(phase);

  let badge = 'Optional';
  let badgeClass = 'idle';
  if (phase === 'error') {
    badge = 'Fehler';
    badgeClass = 'error';
  } else if (busy) {
    badge = phase === 'downloading' ? 'Download' : (phase === 'starting' ? 'Startet' : 'Prüft');
    badgeClass = phase;
  } else if (!installed) {
    badge = 'Optional';
  } else if (!supported) {
    badge = 'Update nötig';
    badgeClass = 'choice-required';
  } else if (running) {
    badge = 'Aktiv';
    badgeClass = 'current';
  } else {
    badge = controlled ? 'Bereit' : 'Installiert';
    badgeClass = controlled ? 'current' : 'idle';
  }
  elements.bridgeBadge.textContent = badge;
  setClass(elements.bridgeBadge, 'mini-badge', badgeClass);
  elements.bridgeMessage.textContent = bridge.message || 'Bridge-Status wird geprüft.';
  const versionParts = [];
  if (bridge.installedVersion) versionParts.push(`Installiert: v${bridge.installedVersion}`);
  if (bridge.updateAvailable && bridge.latestVersion) versionParts.push(`Verfügbar: v${bridge.latestVersion}`);
  if (controlled) versionParts.push(bridge.owner === 'tracker' ? 'Tracker-Hintergrundmodus' : 'Eigenständig geöffnet');
  elements.bridgeVersion.textContent = versionParts.join(' · ');

  elements.bridgeProcessStatus.textContent = running
    ? 'Aktiv'
    : (controlled ? 'Bereit' : 'Nicht gestartet');
  elements.bridgeSimStatus.textContent = runtime.simulator === 'connected'
    ? 'Verbunden'
    : (runtime.simulator === 'connecting' ? 'Verbindet …' : 'Nicht verbunden');
  elements.bridgeUdpStatus.textContent = runtime.udp === 'active'
    ? `${Number(runtime.packets) || 0} Pakete`
    : 'Inaktiv';

  elements.bridgeProgressWrap.hidden = phase !== 'downloading';
  elements.bridgeProgress.style.width = `${Math.max(0, Math.min(100, Number(bridge.percent) || 0))}%`;
  elements.bridgeInstallButton.textContent = !installed
    ? 'Bridge installieren'
    : (!supported
      ? 'Bridge für Tracker aktualisieren'
      : (bridge.updateAvailable ? `Auf v${bridge.latestVersion} aktualisieren` : (bridge.latestVersion ? 'Bridge ist aktuell' : 'Bridge installiert')));
  elements.bridgeInstallButton.disabled = busy || (installed && supported && !bridge.updateAvailable);
  elements.bridgeStartButton.textContent = running ? 'Bridge stoppen' : 'Bridge starten';
  elements.bridgeStartButton.disabled = busy || !installed || !supported;
  elements.bridgeSettingsButton.disabled = busy || (!installed && !controlled);
  elements.bridgeRefreshButton.disabled = busy;
}

function render(state) {
  latestState = state;
  const tracker = state?.tracker || {};
  const settings = state?.settings || {};
  const runtimeChannel = settings.runtimeChannel === 'alpha' ? 'alpha' : 'stable';
  const runtimeChannelLabel = runtimeChannel === 'alpha' ? 'Alpha' : 'Stable';

  elements.versionLine.textContent = `Desktop v${state?.appVersion || '–'} · Engine ${state?.trackerVersion || '–'} · ${runtimeChannelLabel}`;
  setClass(elements.processBadge, 'process-badge', tracker.process);
  elements.processBadge.textContent = labels.process[tracker.process] || 'Bereit';

  setClass(elements.relayDot, 'status-dot', tracker.relay);
  elements.relayStatus.textContent = labels.relay[tracker.relay] || 'Wartet';
  setClass(elements.simDot, 'status-dot', tracker.simulator);
  elements.simStatus.textContent = labels.simulator[tracker.simulator] || 'Nicht verbunden';
  setClass(elements.telemetryDot, 'status-dot', tracker.telemetry);
  elements.telemetryStatus.textContent = labels.telemetry[tracker.telemetry] || 'Keine Positionsdaten';

  if (document.activeElement !== elements.pilotIdInput) elements.pilotIdInput.value = settings.pilotId || '';
  elements.pinInput.placeholder = settings.hasPin ? 'gespeichert' : '••••';
  if (document.activeElement !== elements.runtimeChannelSelect && !channelChangePending) {
    elements.runtimeChannelSelect.value = runtimeChannel;
  }
  if (!channelChangePending) {
    elements.runtimeChannelMessage.className = 'channel-message subtle';
    elements.runtimeChannelMessage.textContent = runtimeChannel === 'alpha'
      ? 'Alpha erhält neue Tracker-Versionen zuerst. Die Stable-Runtime bleibt als Rückweg erhalten.'
      : 'Stable verwendet ausschließlich freigegebene Tracker-Versionen.';
  }
  if (document.activeElement !== elements.updatePolicySelect) {
    elements.updatePolicySelect.value = settings.updatePolicy || 'ask';
  }
  if (document.activeElement !== elements.autoStartTrackerCheckbox) {
    elements.autoStartTrackerCheckbox.checked = settings.autoStartTracker !== false;
  }
  if (document.activeElement !== elements.startMinimizedCheckbox) {
    elements.startMinimizedCheckbox.checked = settings.startMinimized === true;
  }
  if (document.activeElement !== elements.autoStartBridgeCheckbox) {
    elements.autoStartBridgeCheckbox.checked = settings.autoStartBridge === true;
  }
  if (document.activeElement !== elements.stopBridgeWithTrackerCheckbox) {
    elements.stopBridgeWithTrackerCheckbox.checked = settings.stopBridgeWithTracker !== false;
  }

  const running = ['starting', 'running', 'stopping'].includes(tracker.process);
  elements.startButton.disabled = running;
  elements.stopButton.disabled = !running;
  elements.detailStatus.textContent = tracker.detail || 'Tracker ist nicht gestartet.';
  renderLogs(tracker.logs);
  renderUpdate(state?.update);
  renderHomebaseAssets(state?.homebaseAssets);
  renderEfbPackage(state?.efbPackage, runtimeChannel);
  renderBridge(state?.bridge);
}

elements.credentialsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const pilotId = elements.pilotIdInput.value.trim();
  const pin = elements.pinInput.value.trim();
  elements.saveCredentialsButton.disabled = true;
  elements.formMessage.className = 'form-message';
  elements.formMessage.textContent = 'Pilot-Konto wird geprüft …';
  const result = await window.trackerDesktop.saveCredentials(pilotId, pin);
  elements.saveCredentialsButton.disabled = false;
  if (!result?.ok) {
    elements.formMessage.className = 'form-message error';
    elements.formMessage.textContent = result?.message || 'Konto konnte nicht gespeichert werden.';
    return;
  }
  elements.pinInput.value = '';
  elements.formMessage.className = 'form-message success';
  elements.formMessage.textContent = `Verbunden als ${result.pilotId}.`;
});

elements.updatePolicySelect.addEventListener('change', async () => {
  await window.trackerDesktop.setUpdatePolicy(elements.updatePolicySelect.value);
});

elements.runtimeChannelSelect.addEventListener('change', async () => {
  const previous = latestState?.settings?.runtimeChannel === 'alpha' ? 'alpha' : 'stable';
  const requested = elements.runtimeChannelSelect.value === 'alpha' ? 'alpha' : 'stable';
  if (requested === previous) return;
  if (requested === 'alpha' && !window.confirm('Zum Alpha-Kanal wechseln? Der laufende Tracker wird bei Bedarf neu gestartet. Testversionen können noch Fehler enthalten; Stable bleibt separat installiert.')) {
    elements.runtimeChannelSelect.value = previous;
    return;
  }

  channelChangePending = true;
  elements.runtimeChannelSelect.disabled = true;
  elements.runtimeChannelMessage.className = 'channel-message subtle';
  elements.runtimeChannelMessage.textContent = `Wechsel zu ${requested === 'alpha' ? 'Alpha' : 'Stable'} wird vorbereitet …`;
  const result = await window.trackerDesktop.setRuntimeChannel(requested);
  channelChangePending = false;
  const state = await window.trackerDesktop.getState();
  render(state);
  if (!result?.ok) {
    elements.runtimeChannelMessage.className = 'channel-message subtle error';
    elements.runtimeChannelMessage.textContent = result?.message || 'Tracker-Kanal konnte nicht gewechselt werden.';
  }
});

async function saveStartupPreferences() {
  await window.trackerDesktop.setStartupPreferences({
    autoStartTracker: elements.autoStartTrackerCheckbox.checked,
    startMinimized: elements.startMinimizedCheckbox.checked,
    autoStartBridge: elements.autoStartBridgeCheckbox.checked,
    stopBridgeWithTracker: elements.stopBridgeWithTrackerCheckbox.checked
  });
}

elements.autoStartTrackerCheckbox.addEventListener('change', saveStartupPreferences);
elements.startMinimizedCheckbox.addEventListener('change', saveStartupPreferences);
elements.autoStartBridgeCheckbox.addEventListener('change', saveStartupPreferences);
elements.stopBridgeWithTrackerCheckbox.addEventListener('change', saveStartupPreferences);

elements.startButton.addEventListener('click', async () => {
  const result = await window.trackerDesktop.startTracker();
  if (result?.needsCredentials) {
    elements.formMessage.className = 'form-message error';
    elements.formMessage.textContent = 'Bitte zuerst Pilot-ID und PIN speichern.';
    elements.pilotIdInput.focus();
  }
});

elements.stopButton.addEventListener('click', () => window.trackerDesktop.stopTracker());
elements.openFolderButton.addEventListener('click', () => window.trackerDesktop.openDataFolder());
elements.checkRuntimeButton.addEventListener('click', () => window.trackerDesktop.checkRuntimeUpdate());

elements.assetRefreshButton.addEventListener('click', () => window.trackerDesktop.refreshHomebaseAssets());
elements.assetPrimaryButton.addEventListener('click', async () => {
  const action = latestState?.homebaseAssets?.installed ? 'aktualisiert' : 'installiert';
  if (!window.confirm(`Das Homebase Asset Pack wird in den erkannten MSFS-Community-Ordner ${action}. MSFS muss geschlossen sein. Fortfahren?`)) return;
  await window.trackerDesktop.installHomebaseAssets(false);
});
elements.assetRepairButton.addEventListener('click', async () => {
  if (!window.confirm('Das Homebase Asset Pack wird vollständig neu geladen, geprüft und ersetzt. MSFS muss geschlossen sein. Fortfahren?')) return;
  await window.trackerDesktop.installHomebaseAssets(true);
});
elements.assetUninstallButton.addEventListener('click', async () => {
  if (!window.confirm('Das gemeinsame Homebase Asset Pack aus dem MSFS-Community-Ordner entfernen? Persönliche Homebase-Daten und gebaute Szenen bleiben erhalten.')) return;
  await window.trackerDesktop.uninstallHomebaseAssets();
});

elements.efbRefreshButton.addEventListener('click', () => window.trackerDesktop.refreshEfbPackage());
elements.efbPrimaryButton.addEventListener('click', async () => {
  const action = latestState?.efbPackage?.installed ? 'aktualisiert' : 'installiert';
  if (!window.confirm(`Die VFR Multitool EFB App wird aus dem gewählten Tracker-Kanal geladen, geprüft und im erkannten MSFS-2024-Community-Ordner ${action}. MSFS muss geschlossen sein. Fortfahren?`)) return;
  await window.trackerDesktop.installEfbPackage(false);
});
elements.efbRepairButton.addEventListener('click', async () => {
  if (!window.confirm('Die VFR Multitool EFB App wird vollständig neu geladen, geprüft und ersetzt. MSFS muss geschlossen sein. Fortfahren?')) return;
  await window.trackerDesktop.installEfbPackage(true);
});
elements.efbUninstallButton.addEventListener('click', async () => {
  if (!window.confirm('Nur die VFR Multitool EFB App aus dem MSFS-2024-Community-Ordner entfernen? Tracker, Homebase Assets und persönliche Daten bleiben erhalten.')) return;
  await window.trackerDesktop.uninstallEfbPackage();
});

elements.bridgeRefreshButton.addEventListener('click', () => window.trackerDesktop.refreshBridge());
elements.bridgeInstallButton.addEventListener('click', async () => {
  const action = latestState?.bridge?.installed ? 'aktualisiert' : 'installiert';
  if (!window.confirm(`Die AccuSim DRSM Telemetry Bridge wird aus dem öffentlichen GitHub-Release geladen, geprüft und anschließend ${action}. Der Installer wird dafür separat geöffnet. Fortfahren?`)) return;
  await window.trackerDesktop.installBridge();
});
elements.bridgeStartButton.addEventListener('click', async () => {
  const running = latestState?.bridge?.controlAvailable === true && latestState?.bridge?.runtime?.process === 'running';
  if (running) await window.trackerDesktop.stopBridge();
  else await window.trackerDesktop.startBridge();
});
elements.bridgeSettingsButton.addEventListener('click', () => window.trackerDesktop.showBridgeSettings());

for (const button of document.querySelectorAll('[data-update-choice]')) {
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    const choice = button.dataset.updateChoice;
    await window.trackerDesktop.chooseUpdate(choice);
  });
}

window.trackerDesktop.onStateChanged(render);
window.trackerDesktop.getState().then(render);
