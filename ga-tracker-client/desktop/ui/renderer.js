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
  autoStartTrackerCheckbox: document.getElementById('autoStartTrackerCheckbox'),
  startMinimizedCheckbox: document.getElementById('startMinimizedCheckbox'),
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

function render(state) {
  latestState = state;
  const tracker = state?.tracker || {};
  const settings = state?.settings || {};

  elements.versionLine.textContent = `Desktop v${state?.appVersion || '–'} · Engine ${state?.trackerVersion || '–'}`;
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
  if (document.activeElement !== elements.updatePolicySelect) {
    elements.updatePolicySelect.value = settings.updatePolicy || 'ask';
  }
  if (document.activeElement !== elements.autoStartTrackerCheckbox) {
    elements.autoStartTrackerCheckbox.checked = settings.autoStartTracker !== false;
  }
  if (document.activeElement !== elements.startMinimizedCheckbox) {
    elements.startMinimizedCheckbox.checked = settings.startMinimized === true;
  }

  const running = ['starting', 'running', 'stopping'].includes(tracker.process);
  elements.startButton.disabled = running;
  elements.stopButton.disabled = !running;
  elements.detailStatus.textContent = tracker.detail || 'Tracker ist nicht gestartet.';
  renderLogs(tracker.logs);
  renderUpdate(state?.update);
  renderHomebaseAssets(state?.homebaseAssets);
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

async function saveStartupPreferences() {
  await window.trackerDesktop.setStartupPreferences({
    autoStartTracker: elements.autoStartTrackerCheckbox.checked,
    startMinimized: elements.startMinimizedCheckbox.checked
  });
}

elements.autoStartTrackerCheckbox.addEventListener('change', saveStartupPreferences);
elements.startMinimizedCheckbox.addEventListener('change', saveStartupPreferences);

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

for (const button of document.querySelectorAll('[data-update-choice]')) {
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    const choice = button.dataset.updateChoice;
    await window.trackerDesktop.chooseUpdate(choice);
  });
}

window.trackerDesktop.onStateChanged(render);
window.trackerDesktop.getState().then(render);
