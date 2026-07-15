(() => {
  'use strict';

  const CHANNEL = 'vfr-homebase';
  const HOMEBASE_SYNC_URL = 'https://ga-proxy.einherjer.workers.dev/api/homebase/';
  const HOMEBASE_SYNC_DELAY_MS = 30000;
  const pendingCommands = new Map();
  const pendingRpc = new Map();
  let commandSeq = 0;
  let latestHomebaseDraft = null;
  let homebaseSyncTimer = null;
  let homebaseSaveInFlight = false;
  let homebaseSaveQueued = false;

  const overlay = () => document.getElementById('homebaseOverlay');
  const frame = () => document.getElementById('homebaseFrame');

  function postToWorkbench(kind, payload = {}) {
    const target = frame()?.contentWindow;
    if (!target) return false;
    target.postMessage({ channel: CHANNEL, kind, ...payload }, window.location.origin);
    return true;
  }

  function relayMessage(payload) {
    postToWorkbench('relay-message', { payload });
  }

  function getHomebaseSyncContext() {
    const enabled = localStorage.getItem('ga_sync_enabled') === 'true';
    const pilotId = typeof window.getSyncId === 'function' ? window.getSyncId() : (localStorage.getItem('ga_sync_id') || '');
    const pin = typeof window.getSyncPin === 'function' ? window.getSyncPin() : (localStorage.getItem('ga_sync_pin') || '');
    return { enabled, pilotId: String(pilotId || '').trim(), pin: String(pin || '').trim() };
  }

  function homebaseSyncHeaders(context) {
    return {
      'Content-Type': 'application/json',
      'X-Pilot-ID': context.pilotId,
      'X-Pilot-PIN': context.pin
    };
  }

  function reportHomebaseSync(text, kind = 'muted') {
    postToWorkbench('sync-status', { text, status: kind });
  }

  async function loadHomebaseFromCloud() {
    const context = getHomebaseSyncContext();
    if (!context.enabled || !context.pilotId || !context.pin) {
      reportHomebaseSync('Nur lokal gespeichert', 'muted');
      postToWorkbench('sync-load-result', { ok: false, disabled: true });
      return;
    }
    reportHomebaseSync('Cloud wird geprüft …', 'warn');
    try {
      const response = await fetch(HOMEBASE_SYNC_URL + encodeURIComponent(context.pilotId), {
        headers: homebaseSyncHeaders(context),
        cache: 'no-store'
      });
      if (response.status === 404) {
        postToWorkbench('sync-load-result', { ok: true, record: null, pilotId: context.pilotId });
        reportHomebaseSync('Cloud bereit', 'ok');
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Cloud-Antwort ${response.status}`);
      postToWorkbench('sync-load-result', { ok: true, record: data.record || null, pilotId: context.pilotId });
      reportHomebaseSync('Cloud geladen', 'ok');
    } catch (error) {
      postToWorkbench('sync-load-result', { ok: false, error: error?.message || String(error) });
      reportHomebaseSync('Cloud derzeit nicht erreichbar', 'bad');
    }
  }

  function scheduleHomebaseSave() {
    clearTimeout(homebaseSyncTimer);
    if (!latestHomebaseDraft?.dirty) return;
    const context = getHomebaseSyncContext();
    if (!context.enabled || !context.pilotId || !context.pin) return;
    reportHomebaseSync('Änderungen lokal gesichert', 'warn');
    homebaseSyncTimer = setTimeout(() => flushHomebaseDraft('idle'), HOMEBASE_SYNC_DELAY_MS);
  }

  function homebaseSaveBody(draft) {
    return JSON.stringify({
      schemaVersion: 1,
      baseRevision: draft.baseRevision || '',
      clientUpdatedAt: draft.localUpdatedAt || Date.now(),
      deviceId: draft.deviceId || '',
      plan: draft.plan
    });
  }

  async function flushHomebaseDraft(reason = 'manual') {
    clearTimeout(homebaseSyncTimer);
    homebaseSyncTimer = null;
    if (!latestHomebaseDraft?.dirty || !latestHomebaseDraft.plan) return false;
    const context = getHomebaseSyncContext();
    if (!context.enabled || !context.pilotId || !context.pin) return false;
    if (homebaseSaveInFlight) {
      homebaseSaveQueued = true;
      return false;
    }

    homebaseSaveInFlight = true;
    const draft = latestHomebaseDraft;
    reportHomebaseSync('Homebase wird gespeichert …', 'warn');
    try {
      const response = await fetch(HOMEBASE_SYNC_URL + encodeURIComponent(context.pilotId), {
        method: 'POST',
        headers: homebaseSyncHeaders(context),
        body: homebaseSaveBody(draft),
        keepalive: true
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409 && data.record) {
        postToWorkbench('sync-save-result', { ok: false, conflict: true, record: data.record, reason });
        reportHomebaseSync('Cloud-Konflikt erkannt', 'bad');
        return false;
      }
      if (!response.ok) throw new Error(data.error || `Cloud-Antwort ${response.status}`);
      postToWorkbench('sync-save-result', { ok: true, record: data.record || null, reason });
      reportHomebaseSync('Homebase synchronisiert', 'ok');
      return true;
    } catch (error) {
      postToWorkbench('sync-save-result', { ok: false, error: error?.message || String(error), reason });
      reportHomebaseSync('Cloud-Speichern fehlgeschlagen', 'bad');
      return false;
    } finally {
      homebaseSaveInFlight = false;
      if (homebaseSaveQueued) {
        homebaseSaveQueued = false;
        if (latestHomebaseDraft?.dirty) setTimeout(() => flushHomebaseDraft('queued'), 1100);
      }
    }
  }

  function flushHomebaseOnPageExit() {
    if (!latestHomebaseDraft?.dirty || !latestHomebaseDraft.plan || homebaseSaveInFlight) return;
    const context = getHomebaseSyncContext();
    if (!context.enabled || !context.pilotId || !context.pin) return;
    fetch(HOMEBASE_SYNC_URL + encodeURIComponent(context.pilotId), {
      method: 'POST',
      headers: homebaseSyncHeaders(context),
      body: homebaseSaveBody(latestHomebaseDraft),
      keepalive: true
    }).catch(() => {});
  }

  function nextCommandId(prefix = 'homebase-app') {
    return `${prefix}-${Date.now()}-${++commandSeq}`;
  }

  function sendTracker(command, meta = {}) {
    if (!window.liveTrackerConnected || typeof window.sendTrackerCommand !== 'function') {
      if (meta.rpcRequestId) {
        postToWorkbench('rpc-result', {
          requestId: meta.rpcRequestId,
          ok: false,
          code: 'TRACKER_OFFLINE',
          error: 'Der PC-Tracker ist nicht mit der Haupt-App verbunden.'
        });
      } else {
        relayMessage({
          trackerAck: {
            type: `${command.type}_ack`,
            commandId: command.commandId || null,
            status: 'error',
            message: 'Der PC-Tracker ist nicht verbunden.'
          }
        });
      }
      return false;
    }
    const commandId = command.commandId || nextCommandId();
    pendingCommands.set(commandId, { ...meta, sentAt: Date.now() });
    if (meta.rpcRequestId) pendingRpc.set(commandId, meta.rpcRequestId);
    const sent = window.sendTrackerCommand({ ...command, commandId });
    if (!sent) {
      pendingCommands.delete(commandId);
      pendingRpc.delete(commandId);
      if (meta.rpcRequestId) {
        postToWorkbench('rpc-result', { requestId: meta.rpcRequestId, ok: false, code: 'SEND_FAILED', error: 'Homebase-Auftrag konnte nicht gesendet werden.' });
      }
      return false;
    }
    return commandId;
  }

  function translateWorkbenchRelay(payload = {}) {
    const trackerCommand = payload.trackerCommand;
    const stabilizerCommand = payload.stabilizerCommand;
    if (trackerCommand?.type === 'homebase_v1.capabilities') {
      sendTracker({ type: 'homebase_v1.capabilities', commandId: trackerCommand.commandId }, { kind: 'capabilities' });
      return;
    }
    if (trackerCommand?.type === 'homebase_v1.preview.clear') {
      sendTracker({ type: 'homebase_v1.preview.clear', commandId: trackerCommand.commandId }, { kind: 'primary-clear' });
      return;
    }
    if (trackerCommand?.type === 'homebase_v1.preview.set') {
      const config = trackerCommand.config || {};
      const hangar = config.hangar ? [{ id: 'hangar', title: config.hangar.objectTitle, label: 'Homebase-Hangar', ...config.hangar }] : [];
      sendTracker({
        type: 'homebase_v1.preview.set',
        commandId: trackerCommand.commandId,
        objects: [...hangar, ...(Array.isArray(config.objects) ? config.objects : [])]
      }, { kind: 'legacy-preview-set' });
      return;
    }
    if (!stabilizerCommand) return;
    if (stabilizerCommand.type === 'homebase_v1.preview.extras.clear') {
      sendTracker({ type: 'homebase_v1.preview.clear', commandId: stabilizerCommand.commandId }, { kind: 'extras-clear' });
      return;
    }
    if (stabilizerCommand.type === 'homebase_v1.preview.extras.set_standalone') {
      sendTracker({
        type: 'homebase_v1.preview.set',
        commandId: stabilizerCommand.commandId,
        parentCommandId: stabilizerCommand.parentCommandId,
        objects: Array.isArray(stabilizerCommand.objects) ? stabilizerCommand.objects : []
      }, { kind: 'preview-set', parentCommandId: stabilizerCommand.parentCommandId });
      return;
    }
    if (stabilizerCommand.type === 'homebase_v1.preview.object.add') {
      sendTracker({ type: 'homebase_v1.preview.object.add', commandId: stabilizerCommand.commandId, object: stabilizerCommand.object }, { kind: 'object-add' });
      return;
    }
    if (stabilizerCommand.type === 'homebase_v1.preview.object.remove') {
      sendTracker({
        type: 'homebase_v1.preview.object.remove',
        commandId: stabilizerCommand.commandId,
        id: stabilizerCommand.id,
        label: stabilizerCommand.label
      }, { kind: 'object-remove' });
      return;
    }
    if (stabilizerCommand.type === 'homebase_v1.preview.object.move' || stabilizerCommand.type === 'homebase_v1.preview.hangar.move') {
      sendTracker({ type: 'homebase_v1.preview.object.move', commandId: stabilizerCommand.commandId, object: stabilizerCommand.object }, {
        kind: stabilizerCommand.type.endsWith('hangar.move') ? 'hangar-move' : 'object-move'
      });
    }
  }

  const RPC_COMMANDS = Object.freeze({
    '/api/assets/inspection': 'homebase_v1.assets.status',
    '/api/assets/install': 'homebase_v1.assets.install',
    '/api/assets/update-check': 'homebase_v1.assets.update.check',
    '/api/assets/update-install': 'homebase_v1.assets.update.install',
    '/api/sdk/status': 'homebase_v1.package.status',
    '/api/simulator/status': 'homebase_v1.simulator.status',
    '/api/simulator/stop': 'homebase_v1.simulator.stop',
    '/api/package/prepare': 'homebase_v1.package.prepare',
    '/api/package/build': 'homebase_v1.package.build',
    '/api/package/install': 'homebase_v1.package.install',
    '/api/package/uninstall': 'homebase_v1.package.uninstall'
  });

  function handleRpc(message) {
    const type = RPC_COMMANDS[String(message.pathname || '')];
    if (!type) {
      postToWorkbench('rpc-result', { requestId: message.requestId, ok: false, code: 'UNKNOWN_RPC', error: `Unbekannter Homebase-Auftrag: ${message.pathname || ''}` });
      return;
    }
    const commandId = nextCommandId('homebase-rpc');
    sendTracker({ type, commandId, ...(message.body || {}) }, {
      kind: 'rpc',
      rpcRequestId: message.requestId,
      pathname: message.pathname
    });
  }

  function rpcResultFromAck(meta, ack) {
    if (ack.status !== 'ok' && ack.status !== 'noop') {
      postToWorkbench('rpc-result', {
        requestId: meta.rpcRequestId,
        ok: false,
        code: ack.code || '',
        error: ack.error || ack.message || 'Homebase-Auftrag fehlgeschlagen.',
        help: ack.help || ''
      });
      return;
    }
    let result = { ...ack, ok: true };
    if (meta.pathname === '/api/sdk/status') {
      result = { ok: true, installed: ack.sdkInstalled === true, path: ack.sdkPath || '', built: ack.built === true };
    } else if (meta.pathname === '/api/simulator/status') {
      result = { ok: true, running: ack.running === true };
    }
    postToWorkbench('rpc-result', { requestId: meta.rpcRequestId, ok: true, result });
  }

  function handleHomebaseAck(event) {
    const ack = event?.detail?.ack;
    if (!ack || !String(ack.type || '').startsWith('homebase_v1.')) return;
    const commandId = String(ack.commandId || '');
    const meta = pendingCommands.get(commandId) || {};
    pendingCommands.delete(commandId);
    pendingRpc.delete(commandId);

    if (String(ack.type || '').startsWith('homebase_v1.assets.')) {
      updateAssetStatus(ack);
      postToWorkbench('asset-update', { update: ack });
    }

    if (ack.type === 'homebase_v1.assets.update.progress' || ack.type === 'homebase_v1.assets.update.status') return;

    if (meta.kind === 'rpc') {
      rpcResultFromAck(meta, ack);
      return;
    }
    if (ack.type === 'homebase_v1.capabilities_ack' || meta.kind === 'capabilities') {
      relayMessage({
        homebaseHello: {
          version: ack.protocol ? `v1 / Tracker ${window.liveTrackerVersionCode || ''}` : 'nicht verfügbar',
          simConnected: ack.simConnected === true,
          capabilities: Array.isArray(ack.capabilities) ? ack.capabilities : []
        }
      });
      return;
    }
    if (meta.kind === 'extras-clear') {
      relayMessage({ stabilizerAck: { ...ack, type: 'homebase_v1.preview.extras.clear_ack' } });
      return;
    }
    if (meta.kind === 'primary-clear') {
      relayMessage({
        trackerAck: { ...ack, type: 'homebase_v1.preview.clear_ack' },
        stabilizerAck: { ...ack, type: 'homebase_v1.preview.primary.clear_ack' }
      });
      return;
    }
    if (meta.kind === 'preview-set') {
      relayMessage({
        stabilizerAck: {
          ...ack,
          type: 'homebase_v1.preview.extras.set_ack',
          parentCommandId: meta.parentCommandId || ack.parentCommandId || commandId
        }
      });
      return;
    }
    if (meta.kind === 'legacy-preview-set') {
      relayMessage({ trackerAck: { ...ack, type: 'homebase_v1.preview.set_ack' } });
      return;
    }
    if (meta.kind === 'object-add') {
      relayMessage({ stabilizerAck: { ...ack, type: 'homebase_v1.preview.object.add_ack' } });
      return;
    }
    if (meta.kind === 'object-remove') {
      relayMessage({ stabilizerAck: { ...ack, type: 'homebase_v1.preview.object.remove_ack' } });
      return;
    }
    if (meta.kind === 'object-move' || meta.kind === 'hangar-move') {
      relayMessage({
        stabilizerAck: {
          ...ack,
          type: meta.kind === 'hangar-move' ? 'homebase_v1.preview.hangar.move_ack' : 'homebase_v1.preview.object.move_ack'
        }
      });
    }
  }

  function updateAssetStatus(status = {}) {
    const element = document.getElementById('homebaseAssetStatus');
    if (!element) return;
    element.classList.remove('ok', 'update', 'warn');
    if (status.phase && status.status === 'progress') {
      element.textContent = status.message || 'Assetprüfung läuft …';
      element.classList.add('warn');
      return;
    }
    if (status.updateAvailable) {
      element.textContent = `Asset-Update ${status.remoteVersion || ''} verfügbar`;
      element.classList.add('update');
      return;
    }
    if ((status.type === 'homebase_v1.assets.update.install_ack' || status.type === 'homebase_v1.assets.install_ack') && status.packageVersion) {
      element.textContent = `Assets ${status.packageVersion} installiert`;
      element.classList.add('ok');
      return;
    }
    if (status.packageComplete || (status.installedComplete && status.installedVersion)) {
      element.textContent = `Assets ${status.packageVersion || status.installedVersion} installiert`;
      element.classList.add('ok');
      return;
    }
    if (status.remoteError) {
      element.textContent = 'Assetserver derzeit nicht erreichbar';
      element.classList.add('warn');
      return;
    }
    element.textContent = 'Assetpaket prüfen';
  }

  function handleTelemetry(event) {
    const data = event?.detail?.data;
    if (!data || !Number.isFinite(Number(data.lat)) || !Number.isFinite(Number(data.lon))) return;
    relayMessage(data);
  }

  function openHomebaseEnvironment() {
    const element = overlay();
    if (!element) return;
    element.hidden = false;
    element.classList.add('active');
    document.body.classList.add('homebase-environment-open');
    setTimeout(() => {
      frame()?.focus();
      postToWorkbench('environment-opened');
    }, 0);
  }

  function closeHomebaseEnvironment() {
    const element = overlay();
    if (!element) return;
    element.classList.remove('active');
    element.hidden = true;
    document.body.classList.remove('homebase-environment-open');
    flushHomebaseDraft('workbench-close');
  }

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.source !== frame()?.contentWindow) return;
    const message = event.data;
    if (!message || message.channel !== CHANNEL) return;
    if (message.kind === 'relay-command') translateWorkbenchRelay(message.payload || {});
    if (message.kind === 'rpc') handleRpc(message);
    if (message.kind === 'sync-draft') {
      latestHomebaseDraft = {
        plan: message.plan,
        dirty: message.dirty === true,
        baseRevision: String(message.baseRevision || ''),
        localUpdatedAt: Number(message.localUpdatedAt || Date.now()),
        deviceId: String(message.deviceId || '')
      };
      scheduleHomebaseSave();
    }
    if (message.kind === 'sync-save-now') flushHomebaseDraft(message.reason || 'workbench');
    if (message.kind === 'sync-load') loadHomebaseFromCloud();
    if (message.kind === 'workbench-ready') {
      if (overlay()?.classList.contains('active')) postToWorkbench('environment-opened');
      loadHomebaseFromCloud();
    }
  });
  window.addEventListener('pagehide', flushHomebaseOnPageExit);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushHomebaseDraft('app-hidden');
  });
  window.addEventListener('homebasetrackerack', handleHomebaseAck);
  window.addEventListener('homebasetelemetry', handleTelemetry);

  window.openHomebaseEnvironment = openHomebaseEnvironment;
  window.closeHomebaseEnvironment = closeHomebaseEnvironment;
  window.homebaseUpdateAssetStatus = updateAssetStatus;
})();
