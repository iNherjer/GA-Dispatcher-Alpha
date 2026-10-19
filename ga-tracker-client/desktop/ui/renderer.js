const elements = {
  versionLine: document.getElementById('versionLine'),
  processBadge: document.getElementById('processBadge'),
  automaticUpdateBanner: document.getElementById('automaticUpdateBanner'),
  automaticUpdateBannerText: document.getElementById('automaticUpdateBannerText'),
  relayDot: document.getElementById('relayDot'),
  relayStatus: document.getElementById('relayStatus'),
  simDot: document.getElementById('simDot'),
  simStatus: document.getElementById('simStatus'),
  telemetryDot: document.getElementById('telemetryDot'),
  telemetryStatus: document.getElementById('telemetryStatus'),
  trackerModuleSummary: document.getElementById('trackerModuleSummary'),
  pilotIdInput: document.getElementById('pilotIdInput'),
  pinInput: document.getElementById('pinInput'),
  credentialsForm: document.getElementById('credentialsForm'),
  saveCredentialsButton: document.getElementById('saveCredentialsButton'),
  formMessage: document.getElementById('formMessage'),
  voiceCredentialsForm: document.getElementById('voiceCredentialsForm'),
  voiceProviderSelect: document.getElementById('voiceProviderSelect'),
  voiceApiKeyInput: document.getElementById('voiceApiKeyInput'),
  saveVoiceCredentialsButton: document.getElementById('saveVoiceCredentialsButton'),
  clearVoiceCredentialsButton: document.getElementById('clearVoiceCredentialsButton'),
  voiceFormMessage: document.getElementById('voiceFormMessage'),
  runtimeChannelSelect: document.getElementById('runtimeChannelSelect'),
  runtimeChannelMessage: document.getElementById('runtimeChannelMessage'),
  aptMissionExecutionCheckbox: document.getElementById('aptMissionExecutionCheckbox'),
  aptMissionExecutionMessage: document.getElementById('aptMissionExecutionMessage'),
  hardMissionResetButton: document.getElementById('hardMissionResetButton'),
  hardMissionResetMessage: document.getElementById('hardMissionResetMessage'),
  trackerAutoUpdateCheckbox: document.getElementById('trackerAutoUpdateCheckbox'),
  desktopAutoUpdateCheckbox: document.getElementById('desktopAutoUpdateCheckbox'),
  desktopModuleSummary: document.getElementById('desktopModuleSummary'),
  desktopUpdateBadge: document.getElementById('desktopUpdateBadge'),
  desktopUpdateVersion: document.getElementById('desktopUpdateVersion'),
  desktopUpdateMessage: document.getElementById('desktopUpdateMessage'),
  desktopUpdateProgressWrap: document.getElementById('desktopUpdateProgressWrap'),
  desktopUpdateProgress: document.getElementById('desktopUpdateProgress'),
  checkDesktopUpdateButton: document.getElementById('checkDesktopUpdateButton'),
  installDesktopUpdateButton: document.getElementById('installDesktopUpdateButton'),
  updateBadge: document.getElementById('updateBadge'),
  updateMessage: document.getElementById('updateMessage'),
  updateProgressWrap: document.getElementById('updateProgressWrap'),
  updateProgress: document.getElementById('updateProgress'),
  checkRuntimeButton: document.getElementById('checkRuntimeButton'),
  assetModuleSummary: document.getElementById('assetModuleSummary'),
  assetBadge: document.getElementById('assetBadge'),
  assetMessage: document.getElementById('assetMessage'),
  assetPath: document.getElementById('assetPath'),
  homebaseAutoUpdateCheckbox: document.getElementById('homebaseAutoUpdateCheckbox'),
  assetPrimaryButton: document.getElementById('assetPrimaryButton'),
  assetRepairButton: document.getElementById('assetRepairButton'),
  assetUninstallButton: document.getElementById('assetUninstallButton'),
  assetRefreshButton: document.getElementById('assetRefreshButton'),
  efbModuleSummary: document.getElementById('efbModuleSummary'),
  efbChannelLabel: document.getElementById('efbChannelLabel'),
  efbBadge: document.getElementById('efbBadge'),
  efbMessage: document.getElementById('efbMessage'),
  efbVersion: document.getElementById('efbVersion'),
  efbPath: document.getElementById('efbPath'),
  efbAutoUpdateCheckbox: document.getElementById('efbAutoUpdateCheckbox'),
  efbPrimaryButton: document.getElementById('efbPrimaryButton'),
  efbRepairButton: document.getElementById('efbRepairButton'),
  efbUninstallButton: document.getElementById('efbUninstallButton'),
  efbRefreshButton: document.getElementById('efbRefreshButton'),
  bridgeModuleSummary: document.getElementById('bridgeModuleSummary'),
  bridgeBadge: document.getElementById('bridgeBadge'),
  bridgeMessage: document.getElementById('bridgeMessage'),
  bridgeVersion: document.getElementById('bridgeVersion'),
  bridgeProcessStatus: document.getElementById('bridgeProcessStatus'),
  bridgeSimStatus: document.getElementById('bridgeSimStatus'),
  bridgeUdpStatus: document.getElementById('bridgeUdpStatus'),
  bridgeProgressWrap: document.getElementById('bridgeProgressWrap'),
  bridgeProgress: document.getElementById('bridgeProgress'),
  bridgeAutoUpdateCheckbox: document.getElementById('bridgeAutoUpdateCheckbox'),
  bridgeInstallButton: document.getElementById('bridgeInstallButton'),
  bridgeStartButton: document.getElementById('bridgeStartButton'),
  bridgeSettingsButton: document.getElementById('bridgeSettingsButton'),
  bridgeRefreshButton: document.getElementById('bridgeRefreshButton'),
  autoStartTrackerCheckbox: document.getElementById('autoStartTrackerCheckbox'),
  startMinimizedCheckbox: document.getElementById('startMinimizedCheckbox'),
  autoStartBridgeCheckbox: document.getElementById('autoStartBridgeCheckbox'),
  stopBridgeWithTrackerCheckbox: document.getElementById('stopBridgeWithTrackerCheckbox'),
  autostartLaunchButton: document.getElementById('autostartLaunchButton'),
  autostartLaunchMessage: document.getElementById('autostartLaunchMessage'),
  autostartModuleSummary: document.getElementById('autostartModuleSummary'),
  autostartBadge: document.getElementById('autostartBadge'),
  autostartEnabledCheckbox: document.getElementById('autostartEnabledCheckbox'),
  autostartCloseOnExitCheckbox: document.getElementById('autostartCloseOnExitCheckbox'),
  autostartSimMessage: document.getElementById('autostartSimMessage'),
  autostartSimChoices: document.getElementById('autostartSimChoices'),
  autostartDetectSimButton: document.getElementById('autostartDetectSimButton'),
  autostartDropZone: document.getElementById('autostartDropZone'),
  autostartImportButton: document.getElementById('autostartImportButton'),
  autostartList: document.getElementById('autostartList'),
  autostartListMessage: document.getElementById('autostartListMessage'),
  startButton: document.getElementById('startButton'),
  stopButton: document.getElementById('stopButton'),
  aptTestLogButton: document.getElementById('aptTestLogButton'),
  openFolderButton: document.getElementById('openFolderButton'),
  detailStatus: document.getElementById('detailStatus'),
  logOutput: document.getElementById('logOutput'),
  updateDialog: document.getElementById('updateDialog'),
  updateDialogTitle: document.getElementById('updateDialogTitle'),
  updateDialogMessage: document.getElementById('updateDialogMessage'),
  desktopInstallDialog: document.getElementById('desktopInstallDialog'),
  desktopInstallDialogTitle: document.getElementById('desktopInstallDialogTitle'),
  confirmDesktopInstallButton: document.getElementById('confirmDesktopInstallButton')
};

const labels = {
  process: { stopped: 'Bereit', starting: 'Startet', running: 'Aktiv', stopping: 'Stoppt', error: 'Fehler' },
  relay: { waiting: 'Wartet', connecting: 'Verbindet …', connected: 'Verbunden' },
  simulator: { waiting: 'Nicht verbunden', connected: 'Verbunden' },
  telemetry: { off: 'OFF', link: 'LINK', hibernate: 'HIB', live: 'LIVE' }
};

function relayStatusLabel(tracker = {}) {
  const cloudflare = tracker.relayCloudflare === 'connected';
  const render = tracker.relayRender === 'connected';
  if (cloudflare && render) return 'C+R';
  if (cloudflare) return 'C';
  if (render) return 'R';
  return labels.relay[tracker.relay] || 'Wartet';
}

const updateModules = {
  desktop: {
    title: (version) => `Tracker-App v${version || ''} verfügbar`.trim(),
    message: 'Wie möchtest du dieses und künftige Updates der Desktop-App behandeln? Die Installation erfolgt nach einem kontrollierten Neustart.'
  },
  tracker: {
    title: (version) => `Tracker-Update ${version || ''} verfügbar`.trim(),
    message: 'Wie möchtest du dieses und künftige Tracker-Updates behandeln?'
  },
  homebase: {
    title: (version) => `Homebase Assets ${version || ''} verfügbar`.trim(),
    message: 'Das vorhandene Asset Pack kann aktualisiert werden. MSFS muss für die Installation geschlossen sein.'
  },
  efb: {
    title: (version) => `EFB-Update ${version || ''} verfügbar`.trim(),
    message: 'Die vorhandene EFB-App kann aus dem gewählten Tracker-Kanal aktualisiert werden. MSFS muss geschlossen sein.'
  },
  bridge: {
    title: (version) => `Bridge-Update ${version || ''} verfügbar`.trim(),
    message: 'Der verifizierte Bridge-Installer kann geladen werden. Die Windows-Installation wird anschließend sichtbar bestätigt.'
  }
};

let latestState = null;
let activeUpdateDialog = null;
let channelChangePending = false;
let aptMissionExecutionChangePending = false;
let hardMissionResetPending = false;
let dismissedDesktopInstallVersion = '';
const dismissedUpdates = new Set();

function setClass(element, baseClass, state) {
  element.className = `${baseClass} ${state || 'waiting'}`;
}

function setChecked(element, checked) {
  if (document.activeElement !== element) element.checked = checked;
}

function modulePolicy(settings, module) {
  const key = module === 'tracker' ? 'updatePolicy' : `${module}UpdatePolicy`;
  return settings?.[key] === 'automatic' ? 'automatic' : 'ask';
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

function renderDesktopUpdate(update = {}, appVersion = '') {
  const phase = String(update.phase || 'idle');
  elements.desktopUpdateVersion.textContent = `Installiert: Desktop v${appVersion || '–'}${update.version ? ` · Verfügbar: v${update.version}` : ''}`;
  elements.desktopUpdateMessage.textContent = update.message || 'App-Updateprüfung wird vorbereitet.';
  elements.desktopUpdateProgressWrap.hidden = phase !== 'downloading';
  elements.desktopUpdateProgress.style.width = `${Math.max(0, Math.min(100, Number(update.percent) || 0))}%`;
  elements.checkDesktopUpdateButton.disabled = update.supported !== true || ['checking', 'downloading', 'ready', 'installing'].includes(phase);
  elements.installDesktopUpdateButton.hidden = phase !== 'ready';
  elements.installDesktopUpdateButton.disabled = phase !== 'ready';

  elements.desktopModuleSummary.textContent = `Desktop v${appVersion || '–'}${update.version && update.version !== appVersion ? ` · v${update.version} verfügbar` : ''}`;
  elements.desktopUpdateBadge.textContent = {
    idle: 'Bereit', checking: 'Prüft', current: 'Aktuell', 'choice-required': 'Update',
    downloading: 'Download', ready: 'Neustart', installing: 'Installiert', error: 'Fehler',
    deferred: 'Später', unsupported: 'Manuell'
  }[phase] || 'Update';
  setClass(elements.desktopUpdateBadge, 'mini-badge', phase);
}

function renderUpdate(update = {}, runtimeChannel = 'stable') {
  const phase = String(update.phase || 'idle');
  elements.updateBadge.textContent = {
    development: 'Entwicklung', idle: 'Bereit', checking: 'Prüft', current: 'Aktuell',
    'choice-required': 'Update', downloading: 'Download', ready: 'Installiert', deferred: 'Später', error: 'Fehler'
  }[phase] || 'Update';
  setClass(elements.updateBadge, 'mini-badge', phase);
  elements.updateMessage.textContent = update.message || '';
  elements.updateProgressWrap.hidden = phase !== 'downloading';
  elements.updateProgress.style.width = `${Math.max(0, Math.min(100, Number(update.percent) || 0))}%`;
  elements.checkRuntimeButton.disabled = ['checking', 'downloading', 'choice-required', 'development'].includes(phase);
  elements.runtimeChannelSelect.disabled = channelChangePending || ['checking', 'downloading', 'choice-required'].includes(phase);
  const installedVersion = update.installedVersion || update.version || 'nicht installiert';
  elements.trackerModuleSummary.textContent = `Engine ${installedVersion} · ${runtimeChannel === 'alpha' ? 'Alpha' : 'Stable'}`;
}

function renderHomebaseAssets(assets = {}) {
  const phase = String(assets.phase || 'idle');
  const installed = assets.installed === true;
  const complete = assets.installedComplete === true;
  const busy = assets.busy === true || ['checking', 'working'].includes(phase);
  elements.assetBadge.textContent = {
    idle: 'Prüfung', checking: 'Prüft', working: 'Update',
    ready: complete ? (assets.updateAvailable ? 'Update' : 'Installiert') : (installed ? 'Reparatur' : 'Optional'), error: 'Fehler'
  }[phase] || 'Status';
  setClass(elements.assetBadge, 'mini-badge', phase === 'ready' && complete && !assets.updateAvailable ? 'current' : phase);
  elements.assetMessage.textContent = assets.message || 'Homebase-Assetstatus wird geprüft.';
  elements.assetPath.textContent = assets.communityPath ? `Community: ${assets.communityPath}` : '';
  elements.assetModuleSummary.textContent = installed
    ? `Installiert ${assets.installedVersion || ''}${assets.updateAvailable && assets.remoteVersion ? ` · ${assets.remoteVersion} verfügbar` : ''}`.trim()
    : 'Nicht installiert · optional';
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
    idle: 'Prüfung', checking: 'Prüft', working: 'Update',
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
  elements.efbModuleSummary.textContent = installed
    ? `Installiert ${efb.installedVersion || ''}${efb.updateAvailable && efb.remoteVersion ? ` · ${efb.remoteVersion} verfügbar` : ''}`.trim()
    : `Nicht installiert · ${runtimeChannel === 'alpha' ? 'Alpha' : 'Stable'}`;
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
  const busy = ['checking', 'downloading', 'starting', 'installer-launched'].includes(phase);
  let badge = 'Optional';
  let badgeClass = 'idle';
  if (phase === 'error') {
    badge = 'Fehler'; badgeClass = 'error';
  } else if (phase === 'installer-launched') {
    badge = 'Installer offen'; badgeClass = 'choice-required';
  } else if (busy) {
    badge = phase === 'downloading' ? 'Download' : (phase === 'starting' ? 'Startet' : 'Prüft'); badgeClass = phase;
  } else if (!installed) {
    badge = 'Optional';
  } else if (bridge.updateAvailable || !supported) {
    badge = 'Update'; badgeClass = 'choice-required';
  } else if (running) {
    badge = 'Aktiv'; badgeClass = 'current';
  } else {
    badge = controlled ? 'Bereit' : 'Installiert'; badgeClass = controlled ? 'current' : 'idle';
  }
  elements.bridgeBadge.textContent = badge;
  setClass(elements.bridgeBadge, 'mini-badge', badgeClass);
  elements.bridgeMessage.textContent = bridge.message || 'Bridge-Status wird geprüft.';
  const versionParts = [];
  if (bridge.installedVersion) versionParts.push(`Installiert: v${bridge.installedVersion}`);
  if (bridge.updateAvailable && bridge.latestVersion) versionParts.push(`Verfügbar: v${bridge.latestVersion}`);
  if (controlled) versionParts.push(bridge.owner === 'tracker' ? 'Tracker-Hintergrundmodus' : 'Eigenständig geöffnet');
  elements.bridgeVersion.textContent = versionParts.join(' · ');
  elements.bridgeModuleSummary.textContent = installed
    ? `Installiert${bridge.installedVersion ? ` v${bridge.installedVersion}` : ''}${bridge.updateAvailable && bridge.latestVersion ? ` · v${bridge.latestVersion} verfügbar` : ''}`
    : 'Nicht installiert · optional';
  elements.bridgeProcessStatus.textContent = running ? 'Aktiv' : (controlled ? 'Bereit' : 'Nicht gestartet');
  elements.bridgeSimStatus.textContent = runtime.simulator === 'connected' ? 'Verbunden' : (runtime.simulator === 'connecting' ? 'Verbindet …' : 'Nicht verbunden');
  elements.bridgeUdpStatus.textContent = runtime.udp === 'active' ? `${Number(runtime.packets) || 0} Pakete` : 'Inaktiv';
  elements.bridgeProgressWrap.hidden = phase !== 'downloading';
  elements.bridgeProgress.style.width = `${Math.max(0, Math.min(100, Number(bridge.percent) || 0))}%`;
  elements.bridgeInstallButton.textContent = !installed
    ? 'Bridge installieren'
    : (!supported ? 'Bridge für Tracker aktualisieren' : (bridge.updateAvailable ? `Auf v${bridge.latestVersion} aktualisieren` : (bridge.latestVersion ? 'Bridge ist aktuell' : 'Bridge installiert')));
  elements.bridgeInstallButton.disabled = busy || (installed && supported && !bridge.updateAvailable);
  elements.bridgeStartButton.textContent = running ? 'Bridge stoppen' : 'Bridge starten';
  elements.bridgeStartButton.disabled = busy || !installed || !supported;
  elements.bridgeSettingsButton.disabled = busy || (!installed && !controlled);
  elements.bridgeRefreshButton.disabled = busy;
}

function renderAutomaticUpdateBanner(state, settings) {
  const active = [];
  const desktopUpdate = state?.desktopUpdate || {};
  if (modulePolicy(settings, 'desktop') === 'automatic' && desktopUpdate.phase === 'downloading') active.push('Tracker-App');
  const trackerUpdate = state?.update || {};
  if (modulePolicy(settings, 'tracker') === 'automatic' && trackerUpdate.phase === 'downloading' && trackerUpdate.installedVersion) active.push('Tracker');
  const homebase = state?.homebaseAssets || {};
  if (modulePolicy(settings, 'homebase') === 'automatic' && homebase.installed && homebase.updateAvailable && homebase.phase === 'working') active.push('Homebase Assets');
  const efb = state?.efbPackage || {};
  if (modulePolicy(settings, 'efb') === 'automatic' && efb.installed && efb.updateAvailable && efb.phase === 'working') active.push('EFB');
  const bridge = state?.bridge || {};
  if (modulePolicy(settings, 'bridge') === 'automatic' && bridge.installed && bridge.updateAvailable && ['checking', 'downloading'].includes(bridge.phase)) active.push('Bridge');
  elements.automaticUpdateBanner.hidden = active.length === 0;
  if (active.length) {
    elements.automaticUpdateBannerText.textContent = active.length === 1
      ? `${active[0]} wird gerade automatisch aktualisiert …`
      : `${active.join(' und ')} werden gerade automatisch aktualisiert …`;
  }
}

function pendingUpdate(state) {
  const settings = state?.settings || {};
  const update = state?.update || {};
  const desktopUpdate = state?.desktopUpdate || {};
  const candidates = [];
  if (modulePolicy(settings, 'desktop') === 'ask' && desktopUpdate.phase === 'choice-required') {
    candidates.push({ module: 'desktop', version: desktopUpdate.version || '', key: `desktop:${desktopUpdate.version || 'unknown'}` });
  }
  if (modulePolicy(settings, 'tracker') === 'ask' && update.phase === 'choice-required') {
    candidates.push({ module: 'tracker', version: update.version || '', key: `tracker:${update.version || 'unknown'}` });
  }
  const managed = [
    { module: 'homebase', state: state?.homebaseAssets, version: state?.homebaseAssets?.remoteVersion },
    { module: 'efb', state: state?.efbPackage, version: state?.efbPackage?.remoteVersion },
    { module: 'bridge', state: state?.bridge, version: state?.bridge?.latestVersion ? `v${state.bridge.latestVersion}` : '' }
  ];
  for (const candidate of managed) {
    if (modulePolicy(settings, candidate.module) !== 'ask') continue;
    if (candidate.state?.installed !== true || candidate.state?.updateAvailable !== true || candidate.state?.phase !== 'ready') continue;
    candidates.push({ module: candidate.module, version: candidate.version || '', key: `${candidate.module}:${candidate.version || 'unknown'}` });
  }
  return candidates.find((candidate) => !dismissedUpdates.has(candidate.key)) || null;
}

function closeUpdateDialog() {
  activeUpdateDialog = null;
  if (elements.updateDialog.open) elements.updateDialog.close();
}

function renderUpdateDialog(state) {
  const pending = pendingUpdate(state);
  if (activeUpdateDialog && activeUpdateDialog.key !== pending?.key) closeUpdateDialog();
  if (!pending || activeUpdateDialog) return;
  activeUpdateDialog = pending;
  const definition = updateModules[pending.module];
  elements.updateDialogTitle.textContent = definition.title(pending.version);
  elements.updateDialogMessage.textContent = definition.message;
  elements.updateDialog.showModal();
}

function renderDesktopInstallDialog(state) {
  const update = state?.desktopUpdate || {};
  const version = String(update.version || '');
  if (update.phase !== 'ready') {
    if (elements.desktopInstallDialog.open) elements.desktopInstallDialog.close();
    if (version !== dismissedDesktopInstallVersion) dismissedDesktopInstallVersion = '';
    return;
  }
  if (elements.updateDialog.open || elements.desktopInstallDialog.open || dismissedDesktopInstallVersion === version) return;
  elements.desktopInstallDialogTitle.textContent = `Tracker-App v${version || '–'} installieren`;
  elements.desktopInstallDialog.showModal();
}

const AUTOSTART_DELAYS = [0, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90, 120];
const autostartResultLabels = { started: 'Gestartet', skipped: 'Lief bereits', failed: 'Fehler' };
let autostartEntries = [];
let autostartListSignature = '';
let autostartDragId = '';
let autostartRenderDeferred = false;
let autostartMenuId = '';
let autostartLaunchPending = false;
let autostartDetectPending = false;

function autostartPayload(entries) {
  return entries.map((entry) => ({ id: entry.id, enabled: entry.enabled, admin: entry.admin, args: entry.args, delaySeconds: entry.delaySeconds }));
}

function saveAutostartEntries(entries) {
  autostartEntries = entries;
  autostartListSignature = '';
  return window.trackerDesktop.updateAutostartEntries(autostartPayload(entries));
}

function moveAutostartEntry(id, targetIndex) {
  const index = autostartEntries.findIndex((entry) => entry.id === id);
  if (index < 0 || targetIndex < 0 || targetIndex >= autostartEntries.length || index === targetIndex) return;
  const next = autostartEntries.slice();
  const [moved] = next.splice(index, 1);
  next.splice(targetIndex, 0, moved);
  void saveAutostartEntries(next);
}

function patchAutostartEntry(id, patch) {
  void saveAutostartEntries(autostartEntries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
}

function autostartOption(labelText, control) {
  const label = document.createElement('label');
  label.append(control, document.createTextNode(labelText));
  return label;
}

// Kontextmenue hinter dem Drei-Punkte-Kreis: seltene Einstellungen eines Eintrags.
function autostartMenu(entry) {
  if (entry.kind !== 'program' && !entry.argsSupported) return null;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'autostart-more';
  button.textContent = '⋯';
  button.title = 'Weitere Einstellungen';
  button.setAttribute('aria-label', `Weitere Einstellungen für ${entry.name}`);
  button.setAttribute('aria-haspopup', 'true');
  const panel = document.createElement('div');
  panel.className = 'autostart-menu';
  panel.hidden = autostartMenuId !== entry.id;
  button.setAttribute('aria-expanded', String(!panel.hidden));
  if (entry.kind === 'program') {
    const admin = document.createElement('input');
    admin.type = 'checkbox';
    admin.checked = entry.admin;
    admin.addEventListener('change', () => patchAutostartEntry(entry.id, { admin: admin.checked }));
    panel.append(autostartOption('Als Admin starten', admin));
  }
  if (entry.argsSupported) {
    const label = document.createElement('label');
    label.className = 'autostart-menu-field';
    const caption = document.createElement('span');
    caption.textContent = 'Startargumente';
    const args = document.createElement('input');
    args.type = 'text';
    args.value = entry.args || '';
    args.placeholder = entry.kind === 'sim' ? 'z. B. -FastLaunch' : 'optional';
    args.spellcheck = false;
    args.addEventListener('change', () => patchAutostartEntry(entry.id, { args: args.value.trim() }));
    args.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') args.blur();
      if (event.key === 'Escape') closeAutostartMenu();
    });
    label.append(caption, args);
    panel.append(label);
  }
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (autostartMenuId === entry.id) closeAutostartMenu();
    else openAutostartMenu(entry.id);
  });
  panel.addEventListener('click', (event) => event.stopPropagation());
  return { button, panel };
}

function syncAutostartMenus() {
  for (const item of elements.autostartList.children) {
    const open = item.dataset.id === autostartMenuId;
    const panel = item.querySelector('.autostart-menu');
    if (panel) panel.hidden = !open;
    item.classList.toggle('menu-open', open);
    item.querySelector('.autostart-more')?.setAttribute('aria-expanded', String(open));
  }
}

function openAutostartMenu(id) {
  autostartMenuId = id;
  syncAutostartMenus();
  elements.autostartList.querySelector(`[data-id="${CSS.escape(id)}"] .autostart-menu input[type="text"]`)?.focus();
}

function closeAutostartMenu() {
  if (!autostartMenuId) return;
  autostartMenuId = '';
  syncAutostartMenus();
}

document.addEventListener('click', closeAutostartMenu);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeAutostartMenu(); });

function autostartItem(entry, index, run) {
  const item = document.createElement('li');
  item.className = 'autostart-item';
  if (!entry.enabled) item.classList.add('disabled');
  if (run.phase === 'running' && run.currentId === entry.id) item.classList.add('current');
  if (autostartMenuId === entry.id) item.classList.add('menu-open');
  item.dataset.id = entry.id;
  // Der ganze Eintrag ist ziehbar; Schalter, Felder und Pfeile behalten ihre Bedienung.
  item.draggable = true;
  item.title = 'Ziehen zum Sortieren';
  let pressTarget = null;
  item.addEventListener('mousedown', (event) => { pressTarget = event.target; });

  const handle = document.createElement('span');
  handle.className = 'autostart-handle';
  const up = document.createElement('button');
  up.type = 'button';
  up.textContent = '▲';
  up.setAttribute('aria-label', `${entry.name} nach oben`);
  up.disabled = index === 0;
  up.addEventListener('click', () => moveAutostartEntry(entry.id, index - 1));
  const grip = document.createElement('span');
  grip.textContent = String(index + 1);
  const down = document.createElement('button');
  down.type = 'button';
  down.textContent = '▼';
  down.setAttribute('aria-label', `${entry.name} nach unten`);
  down.disabled = index === autostartEntries.length - 1;
  down.addEventListener('click', () => moveAutostartEntry(entry.id, index + 1));
  handle.append(up, grip, down);
  item.addEventListener('dragstart', (event) => {
    if (pressTarget?.closest?.('input, select, button, textarea, .autostart-menu')) {
      event.preventDefault();
      return;
    }
    autostartDragId = entry.id;
    item.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', entry.id);
  });
  item.addEventListener('dragend', () => {
    autostartDragId = '';
    item.classList.remove('dragging');
    if (autostartRenderDeferred) renderAutostart(latestState?.autostart);
  });
  item.addEventListener('dragover', (event) => {
    if (!autostartDragId) return;
    event.preventDefault();
    item.classList.add('drop-target');
  });
  item.addEventListener('dragleave', (event) => {
    if (!item.contains(event.relatedTarget)) item.classList.remove('drop-target');
  });
  item.addEventListener('drop', (event) => {
    if (!autostartDragId) return;
    event.preventDefault();
    event.stopPropagation();
    item.classList.remove('drop-target');
    moveAutostartEntry(autostartDragId, index);
  });

  const icon = document.createElement('span');
  icon.className = 'autostart-icon';
  if (entry.icon) {
    const image = document.createElement('img');
    image.src = entry.icon;
    image.alt = '';
    icon.append(image);
  } else {
    icon.textContent = entry.kind === 'sim' ? 'SIM' : 'EXE';
  }

  const body = document.createElement('div');
  body.className = 'autostart-body';
  const name = document.createElement('div');
  name.className = 'autostart-name';
  const nameText = document.createElement('span');
  nameText.textContent = entry.name;
  name.append(nameText);
  const result = run.results?.[entry.id];
  if (result) {
    const badge = document.createElement('span');
    badge.className = `mini-badge ${result === 'failed' ? 'error' : (result === 'started' ? 'current' : '')}`.trim();
    badge.textContent = autostartResultLabels[result] || result;
    name.append(badge);
  } else if (run.phase === 'running' && run.currentId === entry.id) {
    const badge = document.createElement('span');
    badge.className = 'mini-badge starting';
    badge.textContent = 'Startet';
    name.append(badge);
  }
  const detail = document.createElement('div');
  detail.className = 'autostart-detail';
  detail.textContent = entry.detail;
  detail.title = entry.detail;

  const options = document.createElement('div');
  options.className = 'autostart-options';
  const enabled = document.createElement('input');
  enabled.type = 'checkbox';
  enabled.checked = entry.enabled;
  enabled.addEventListener('change', () => patchAutostartEntry(entry.id, { enabled: enabled.checked }));
  options.append(autostartOption('Aktiv', enabled));
  const delay = document.createElement('select');
  const delays = AUTOSTART_DELAYS.includes(entry.delaySeconds) ? AUTOSTART_DELAYS : AUTOSTART_DELAYS.concat(entry.delaySeconds).sort((a, b) => a - b);
  for (const seconds of delays) {
    const option = document.createElement('option');
    option.value = String(seconds);
    option.textContent = `${seconds} s`;
    delay.append(option);
  }
  delay.value = String(entry.delaySeconds);
  delay.addEventListener('change', () => patchAutostartEntry(entry.id, { delaySeconds: Number(delay.value) }));
  const delayLabel = document.createElement('label');
  delayLabel.append(document.createTextNode('Danach warten'), delay);
  options.append(delayLabel);
  body.append(name, detail, options);

  const side = document.createElement('span');
  side.className = 'autostart-side';
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'autostart-remove';
  remove.textContent = '✕';
  remove.title = 'Entfernen';
  remove.setAttribute('aria-label', `${entry.name} entfernen`);
  remove.addEventListener('click', () => saveAutostartEntries(autostartEntries.filter((other) => other.id !== entry.id)));
  const menu = autostartMenu(entry);
  if (menu) side.append(menu.button);
  side.append(remove);
  if (menu) item.append(menu.panel);

  item.append(handle, icon, body, side);
  return item;
}

function renderAutostartSimChoices(candidates) {
  elements.autostartSimChoices.replaceChildren();
  if (!Array.isArray(candidates) || candidates.length < 2) {
    elements.autostartSimChoices.hidden = true;
    return;
  }
  for (const candidate of candidates) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'secondary-button';
    button.textContent = candidate.label;
    button.addEventListener('click', () => window.trackerDesktop.chooseSimulator(candidate.key));
    elements.autostartSimChoices.append(button);
  }
  elements.autostartSimChoices.hidden = false;
}

function renderAutostart(autostart) {
  const data = autostart || {};
  const entries = Array.isArray(data.entries) ? data.entries : [];
  const run = data.run || {};
  const enabled = data.enabled === true;
  const active = entries.filter((entry) => entry.enabled).length;
  const sim = entries.find((entry) => entry.kind === 'sim');

  setChecked(elements.autostartEnabledCheckbox, enabled);
  setChecked(elements.autostartCloseOnExitCheckbox, data.closeOnExit === true);
  elements.autostartEnabledCheckbox.disabled = data.supported === false;
  elements.autostartBadge.textContent = !enabled ? 'Aus' : (run.phase === 'running' ? 'Startet' : `${active} aktiv`);
  setClass(elements.autostartBadge, 'mini-badge', !enabled ? '' : (run.phase === 'running' ? 'starting' : 'current'));
  elements.autostartModuleSummary.textContent = data.supported === false
    ? 'Nur unter Windows verfügbar'
    : (enabled ? `${entries.length} Einträge${sim ? ` · ${sim.name}` : ''}` : 'Ausgeschaltet');

  elements.autostartLaunchButton.hidden = !enabled;
  elements.autostartLaunchButton.disabled = autostartLaunchPending || run.phase === 'running';
  elements.autostartLaunchButton.textContent = run.phase === 'running' ? 'Programme werden gestartet …' : (sim ? 'Tracker & Sim starten' : 'Tracker & Programme starten');
  if (!enabled) elements.autostartLaunchMessage.hidden = true;
  else if (run.phase === 'done' && run.message) {
    elements.autostartLaunchMessage.hidden = false;
    elements.autostartLaunchMessage.className = `form-message autostart-launch-message ${Object.values(run.results || {}).includes('failed') ? 'error' : 'success'}`;
    elements.autostartLaunchMessage.textContent = run.message;
  }

  if (!autostartDetectPending) {
    const candidates = data.simCandidates;
    if (Array.isArray(candidates) && candidates.length === 0) elements.autostartSimMessage.textContent = 'Kein MSFS über Steam oder den Microsoft Store gefunden. Du kannst die Sim-Verknüpfung auch in die Startliste ziehen.';
    else if (Array.isArray(candidates) && candidates.length > 1) elements.autostartSimMessage.textContent = 'Mehrere Versionen gefunden. Bitte wählen:';
    else if (sim) elements.autostartSimMessage.textContent = `Gewählt: ${sim.name} · ${sim.detail}`;
    else elements.autostartSimMessage.textContent = 'Erkennt installierte MSFS-Versionen über Steam und den Microsoft Store.';
  }
  renderAutostartSimChoices(data.simCandidates);
  elements.autostartDetectSimButton.disabled = autostartDetectPending || data.supported === false;
  elements.autostartDetectSimButton.textContent = autostartDetectPending ? 'Suche …' : (sim ? 'Sim neu erkennen' : 'Sim erkennen');

  const signature = JSON.stringify([entries, run.phase, run.currentId, run.results]);
  if (signature === autostartListSignature) return;
  // Ein Neuaufbau mitten im Ziehen wuerde den Vorgang abbrechen.
  autostartRenderDeferred = Boolean(autostartDragId);
  if (autostartRenderDeferred) return;
  if (elements.autostartList.contains(document.activeElement) && ['SELECT', 'INPUT'].includes(document.activeElement.tagName) && document.activeElement.type !== 'checkbox') return;
  autostartListSignature = signature;
  autostartEntries = entries;
  elements.autostartList.replaceChildren(...entries.map((entry, index) => autostartItem(entry, index, run)));
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
  elements.relayStatus.textContent = relayStatusLabel(tracker);
  setClass(elements.simDot, 'status-dot', tracker.simulator);
  elements.simStatus.textContent = labels.simulator[tracker.simulator] || 'Nicht verbunden';
  setClass(elements.telemetryDot, 'status-dot', tracker.telemetry);
  elements.telemetryStatus.textContent = labels.telemetry[tracker.telemetry] || 'OFF';

  if (document.activeElement !== elements.pilotIdInput) elements.pilotIdInput.value = settings.pilotId || '';
  elements.pinInput.placeholder = settings.hasPin ? 'gespeichert' : '••••';
  if (document.activeElement !== elements.voiceProviderSelect) elements.voiceProviderSelect.value = settings.voiceProvider === 'openai' ? 'openai' : 'gemini';
  elements.voiceApiKeyInput.placeholder = settings.hasVoiceApiKey ? 'geschützt gespeichert' : 'API-Key eingeben';
  elements.clearVoiceCredentialsButton.disabled = !settings.hasVoiceApiKey;
  if (document.activeElement !== elements.runtimeChannelSelect && !channelChangePending) elements.runtimeChannelSelect.value = runtimeChannel;
  if (!channelChangePending) {
    elements.runtimeChannelMessage.className = 'channel-message subtle';
    elements.runtimeChannelMessage.textContent = runtimeChannel === 'alpha'
      ? 'Alpha erhält neue Tracker-Versionen zuerst. Die Stable-Runtime bleibt als Rückweg erhalten.'
      : 'Stable verwendet ausschließlich freigegebene Tracker-Versionen.';
  }
  setChecked(elements.aptMissionExecutionCheckbox, settings.aptMissionExecutionEnabled === false);
  elements.aptMissionExecutionCheckbox.disabled = aptMissionExecutionChangePending;
  elements.aptMissionExecutionMessage.textContent = settings.aptMissionExecutionEnabled !== false
    ? 'Tracker-Missionslogik aktiv (Standard). Nur zur Fehlersuche deaktivieren.'
    : 'Warnung: Tracker-Missionslogik für Debug deaktiviert. Die App übernimmt unterstützte neue Missionsläufe. Für normalen Betrieb wieder einschalten.';
  const hardMissionResetAvailable = tracker.process === 'running'
    && settings.aptMissionExecutionEnabled === true;
  elements.hardMissionResetButton.disabled = !hardMissionResetAvailable || hardMissionResetPending;
  if (!hardMissionResetPending && !elements.hardMissionResetMessage.textContent) {
    elements.hardMissionResetMessage.className = 'form-message';
    elements.hardMissionResetMessage.textContent = hardMissionResetAvailable
      ? 'Nur verwenden, wenn eine Tracker-Mission festhängt. Eine Rückfrage schützt vor Versehen.'
      : 'Verfügbar bei laufendem Tracker mit aktiver Missionslogik.';
  }
  setChecked(elements.trackerAutoUpdateCheckbox, modulePolicy(settings, 'tracker') === 'automatic');
  setChecked(elements.desktopAutoUpdateCheckbox, modulePolicy(settings, 'desktop') === 'automatic');
  setChecked(elements.homebaseAutoUpdateCheckbox, modulePolicy(settings, 'homebase') === 'automatic');
  setChecked(elements.efbAutoUpdateCheckbox, modulePolicy(settings, 'efb') === 'automatic');
  setChecked(elements.bridgeAutoUpdateCheckbox, modulePolicy(settings, 'bridge') === 'automatic');
  setChecked(elements.autoStartTrackerCheckbox, settings.autoStartTracker !== false);
  setChecked(elements.startMinimizedCheckbox, settings.startMinimized === true);
  setChecked(elements.autoStartBridgeCheckbox, settings.autoStartBridge === true);
  setChecked(elements.stopBridgeWithTrackerCheckbox, settings.stopBridgeWithTracker !== false);

  const running = ['starting', 'running', 'stopping'].includes(tracker.process);
  elements.startButton.disabled = running;
  elements.stopButton.disabled = !running;
  elements.detailStatus.textContent = tracker.detail || 'Tracker ist nicht gestartet.';
  renderLogs(tracker.logs);
  renderUpdate(state?.update, runtimeChannel);
  renderDesktopUpdate(state?.desktopUpdate, state?.appVersion);
  renderHomebaseAssets(state?.homebaseAssets);
  renderEfbPackage(state?.efbPackage, runtimeChannel);
  renderBridge(state?.bridge);
  renderAutostart(state?.autostart);
  renderAutomaticUpdateBanner(state, settings);
  renderUpdateDialog(state);
  renderDesktopInstallDialog(state);
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

elements.voiceCredentialsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const provider = elements.voiceProviderSelect.value;
  const apiKey = elements.voiceApiKeyInput.value.trim();
  elements.saveVoiceCredentialsButton.disabled = true;
  elements.voiceFormMessage.className = 'form-message';
  elements.voiceFormMessage.textContent = 'API-Key wird mit dem Windows-Konto geschützt …';
  const result = await window.trackerDesktop.saveVoiceCredentials(provider, apiKey);
  elements.saveVoiceCredentialsButton.disabled = false;
  if (!result?.ok) {
    elements.voiceFormMessage.className = 'form-message error';
    elements.voiceFormMessage.textContent = result?.message || 'API-Key konnte nicht gespeichert werden.';
    return;
  }
  elements.voiceApiKeyInput.value = '';
  elements.voiceFormMessage.className = 'form-message success';
  elements.voiceFormMessage.textContent = 'API-Key geschützt gespeichert. Ein laufender Tracker wird neu gestartet.';
});

elements.clearVoiceCredentialsButton.addEventListener('click', async () => {
  if (!window.confirm('Den geschützten Voice-API-Key aus der Tracker-App entfernen?')) return;
  const result = await window.trackerDesktop.clearVoiceCredentials();
  if (!result?.ok) {
    elements.voiceFormMessage.className = 'form-message error';
    elements.voiceFormMessage.textContent = result?.message || 'API-Key konnte nicht entfernt werden.';
    return;
  }
  elements.voiceApiKeyInput.value = '';
  elements.voiceFormMessage.className = 'form-message success';
  elements.voiceFormMessage.textContent = 'Voice-API-Key entfernt.';
});

elements.trackerAutoUpdateCheckbox.addEventListener('change', () => window.trackerDesktop.setUpdatePolicy(elements.trackerAutoUpdateCheckbox.checked ? 'automatic' : 'ask'));
elements.desktopAutoUpdateCheckbox.addEventListener('change', () => window.trackerDesktop.setModuleUpdatePolicy('desktop', elements.desktopAutoUpdateCheckbox.checked ? 'automatic' : 'ask'));
elements.homebaseAutoUpdateCheckbox.addEventListener('change', () => window.trackerDesktop.setModuleUpdatePolicy('homebase', elements.homebaseAutoUpdateCheckbox.checked ? 'automatic' : 'ask'));
elements.efbAutoUpdateCheckbox.addEventListener('change', () => window.trackerDesktop.setModuleUpdatePolicy('efb', elements.efbAutoUpdateCheckbox.checked ? 'automatic' : 'ask'));
elements.bridgeAutoUpdateCheckbox.addEventListener('change', () => window.trackerDesktop.setModuleUpdatePolicy('bridge', elements.bridgeAutoUpdateCheckbox.checked ? 'automatic' : 'ask'));

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
  render(await window.trackerDesktop.getState());
  if (!result?.ok) {
    elements.runtimeChannelMessage.className = 'channel-message subtle error';
    elements.runtimeChannelMessage.textContent = result?.message || 'Tracker-Kanal konnte nicht gewechselt werden.';
  }
});

elements.aptMissionExecutionCheckbox.addEventListener('change', async () => {
  const previous = latestState?.settings?.aptMissionExecutionEnabled === false;
  const enabled = !elements.aptMissionExecutionCheckbox.checked;
  if (!enabled && !window.confirm('Tracker-Missionslogik nur zu Debug-Zwecken deaktivieren?\n\nDiese Option ist ausschließlich zur Fehlersuche gedacht. Der Tracker wird neu gestartet. Nicht während einer laufenden Mission umschalten. Für den normalen Betrieb die Missionslogik anschließend wieder aktivieren.')) {
    elements.aptMissionExecutionCheckbox.checked = previous;
    return;
  }
  aptMissionExecutionChangePending = true;
  elements.aptMissionExecutionCheckbox.disabled = true;
  elements.aptMissionExecutionMessage.textContent = enabled
    ? 'Tracker-Steuerung wird aktiviert und der Tracker bei Bedarf neu gestartet …'
    : 'Tracker-Steuerung wird deaktiviert und der Tracker bei Bedarf neu gestartet …';
  const result = await window.trackerDesktop.setAptMissionExecutionEnabled(enabled);
  aptMissionExecutionChangePending = false;
  render(await window.trackerDesktop.getState());
  if (!result?.ok) {
    elements.aptMissionExecutionCheckbox.checked = previous;
    elements.aptMissionExecutionMessage.textContent = result?.message || 'Tracker-Missionssteuerung konnte nicht geändert werden.';
  } else if (result.restartFailed) {
    elements.aptMissionExecutionMessage.textContent = result.message;
  }
});

elements.hardMissionResetButton.addEventListener('click', async () => {
  if (hardMissionResetPending) return;
  if (!window.confirm('Laufende Tracker-Mission wirklich hart zurücksetzen?\n\nDer Tracker stellt zuerst Payload und Simulator-Szenen wieder her, entfernt danach nur seinen Missionszustand und lädt die aktuelle Mission erneut aus der App. Fluglog und App-Mission werden nicht gelöscht.')) return;
  hardMissionResetPending = true;
  elements.hardMissionResetButton.disabled = true;
  elements.hardMissionResetMessage.className = 'form-message';
  elements.hardMissionResetMessage.textContent = 'Tracker-Mission wird sicher zurückgesetzt …';
  const result = await window.trackerDesktop.hardResetMission();
  hardMissionResetPending = false;
  await window.trackerDesktop.getState().then(render);
  elements.hardMissionResetMessage.className = result?.ok ? 'form-message success' : 'form-message error';
  elements.hardMissionResetMessage.textContent = result?.message || (result?.ok
    ? 'Tracker-Mission wurde zurückgesetzt und der App-Stand wird neu geladen.'
    : 'Der Tracker konnte den Missionsreset nicht sicher ausführen.');
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
    const trackerPanel = elements.pilotIdInput.closest('[data-module-panel]');
    if (trackerPanel) trackerPanel.open = true;
    elements.pilotIdInput.focus();
  }
});

elements.stopButton.addEventListener('click', () => window.trackerDesktop.stopTracker());

function showAutostartAddResult(result, droppedCount = 0) {
  const rejected = Array.isArray(result?.rejected) ? result.rejected : [];
  const added = Number(result?.added) || 0;
  let message = '';
  if (rejected.length) message = `Nicht übernommen: ${rejected.join(', ')} (nur .exe, .lnk, .bat oder .cmd).`;
  else if (droppedCount > 0 && added === 0) message = 'Die Datei konnte nicht übernommen werden oder steht bereits in der Liste. Alternativ über „Importieren“ auswählen.';
  elements.autostartListMessage.className = `form-message ${message ? 'error' : ''}`.trim();
  elements.autostartListMessage.textContent = message;
}

elements.autostartEnabledCheckbox.addEventListener('change', () => window.trackerDesktop.setAutostartOptions({ enabled: elements.autostartEnabledCheckbox.checked }));
elements.autostartCloseOnExitCheckbox.addEventListener('change', () => window.trackerDesktop.setAutostartOptions({ closeOnExit: elements.autostartCloseOnExitCheckbox.checked }));
elements.autostartDetectSimButton.addEventListener('click', async () => {
  autostartDetectPending = true;
  renderAutostart(latestState?.autostart);
  try {
    const result = await window.trackerDesktop.detectSimulators();
    if (result?.candidates?.length === 1) await window.trackerDesktop.chooseSimulator(result.candidates[0].key);
  } finally {
    autostartDetectPending = false;
    renderAutostart(latestState?.autostart);
  }
});
async function importAutostartPrograms() {
  showAutostartAddResult(await window.trackerDesktop.browseAutostartPrograms());
}
elements.autostartImportButton.addEventListener('click', importAutostartPrograms);
elements.autostartDropZone.addEventListener('dragover', (event) => {
  if (!event.dataTransfer?.types?.includes('Files')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  elements.autostartDropZone.classList.add('drag-over');
});
elements.autostartDropZone.addEventListener('dragleave', (event) => {
  // Wechsel auf den Button im Feld zählt nicht als Verlassen.
  if (elements.autostartDropZone.contains(event.relatedTarget)) return;
  elements.autostartDropZone.classList.remove('drag-over');
});
elements.autostartDropZone.addEventListener('drop', async (event) => {
  event.preventDefault();
  elements.autostartDropZone.classList.remove('drag-over');
  if (!event.dataTransfer?.files?.length) return;
  showAutostartAddResult(await window.trackerDesktop.addAutostartFiles(Array.from(event.dataTransfer.files)), event.dataTransfer.files.length);
});
// Dateien ausserhalb der Ablagefläche dürfen das Fenster nicht navigieren.
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => event.preventDefault());
elements.autostartLaunchButton.addEventListener('click', async () => {
  autostartLaunchPending = true;
  elements.autostartLaunchButton.disabled = true;
  elements.autostartLaunchMessage.hidden = true;
  try {
    const result = await window.trackerDesktop.launchAutostart();
    if (result?.tracker?.needsCredentials) {
      elements.formMessage.className = 'form-message error';
      elements.formMessage.textContent = 'Bitte zuerst Pilot-ID und PIN speichern. Die Programme wurden trotzdem gestartet.';
    }
  } finally {
    autostartLaunchPending = false;
    renderAutostart(latestState?.autostart);
  }
});
elements.aptTestLogButton.addEventListener('click', async () => {
  const result = await window.trackerDesktop.showAptTestLog();
  if (result?.missing) {
    elements.formMessage.className = 'form-message';
    elements.formMessage.textContent = result.message;
  }
});
elements.openFolderButton.addEventListener('click', () => window.trackerDesktop.openDataFolder());
elements.checkDesktopUpdateButton.addEventListener('click', () => window.trackerDesktop.checkDesktopUpdate());
elements.installDesktopUpdateButton.addEventListener('click', () => window.trackerDesktop.installDesktopUpdate());
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

async function runUpdateChoice(choice) {
  const pending = activeUpdateDialog;
  if (!pending) return;
  if (choice === 'later') {
    dismissedUpdates.add(pending.key);
    closeUpdateDialog();
    renderUpdateDialog(latestState);
    return;
  }
  closeUpdateDialog();
  if (pending.module === 'desktop') {
    await window.trackerDesktop.chooseDesktopUpdate(choice);
    return;
  }
  if (pending.module === 'tracker') {
    await window.trackerDesktop.chooseUpdate(choice);
    return;
  }
  if (choice === 'automatic') {
    await window.trackerDesktop.setModuleUpdatePolicy(pending.module, 'automatic');
    return;
  }
  if (pending.module === 'homebase') await window.trackerDesktop.installHomebaseAssets(false);
  if (pending.module === 'efb') await window.trackerDesktop.installEfbPackage(false);
  if (pending.module === 'bridge') await window.trackerDesktop.installBridge();
}

elements.confirmDesktopInstallButton.addEventListener('click', async (event) => {
  event.preventDefault();
  elements.desktopInstallDialog.close();
  await window.trackerDesktop.installDesktopUpdate();
});

elements.desktopInstallDialog.addEventListener('close', () => {
  if (latestState?.desktopUpdate?.phase === 'ready') {
    dismissedDesktopInstallVersion = String(latestState.desktopUpdate.version || '');
  }
});

for (const button of document.querySelectorAll('[data-update-choice]')) {
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    await runUpdateChoice(button.dataset.updateChoice);
  });
}

for (const panel of document.querySelectorAll('[data-module-panel]')) {
  panel.addEventListener('toggle', () => {
    if (!panel.open) return;
    for (const other of document.querySelectorAll('[data-module-panel]')) {
      if (other !== panel) other.open = false;
    }
  });
}

window.trackerDesktop.onStateChanged(render);
window.trackerDesktop.getState().then(render);
