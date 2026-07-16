(() => {
  'use strict';

  const CHANNEL = 'vfr-homebase';
  const HOMEBASE_SYNC_URL = 'https://ga-proxy.einherjer.workers.dev/api/homebase/';
  const HOMEBASE_CREW_URL = 'https://ga-proxy.einherjer.workers.dev/api/homebase-group/';
  const HOMEBASE_SYNC_DELAY_MS = 30000;
  const HOMEBASE_CREW_POLL_MS = 45000;
  const HOMEBASE_CREW_RADIUS_NM = 10;
  const HOMEBASE_CREW_MAX_OBJECTS = 100;
  const pendingCommands = new Map();
  const pendingRpc = new Map();
  let commandSeq = 0;
  let latestHomebaseDraft = null;
  let homebaseSyncTimer = null;
  let homebaseSaveInFlight = false;
  let homebaseSaveQueued = false;
  let homebaseWorkbenchReady = false;
  let pendingHomebaseLoadResult = null;
  let crewHomebases = [];
  let crewHomebaseDirectory = [];
  let crewRefreshInFlight = false;
  let crewLastSceneSignature = '';
  let crewRefreshTimer = null;
  let crewTrackerSupported = false;
  let crewCapabilityRequestedAt = 0;

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

  function deliverHomebaseLoadResult(payload) {
    if (!homebaseWorkbenchReady) {
      pendingHomebaseLoadResult = payload;
      return false;
    }
    pendingHomebaseLoadResult = null;
    return postToWorkbench('sync-load-result', payload);
  }

  async function loadHomebaseFromCloud(reason = 'manual') {
    const context = getHomebaseSyncContext();
    if (!context.enabled || !context.pilotId || !context.pin) {
      reportHomebaseSync('Nur lokal gespeichert', 'muted');
      deliverHomebaseLoadResult({ ok: false, disabled: true, reason });
      return { ok: false, disabled: true };
    }
    reportHomebaseSync('Cloud wird geprüft …', 'warn');
    try {
      const response = await fetch(HOMEBASE_SYNC_URL + encodeURIComponent(context.pilotId), {
        headers: homebaseSyncHeaders(context),
        cache: 'no-store'
      });
      if (response.status === 404) {
        const delivered = deliverHomebaseLoadResult({ ok: true, record: null, pilotId: context.pilotId, reason });
        return { ok: true, record: null, deferred: !delivered };
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Cloud-Antwort ${response.status}`);
      const record = data.record || null;
      const delivered = deliverHomebaseLoadResult({ ok: true, record, pilotId: context.pilotId, reason });
      return { ok: true, record, deferred: !delivered };
    } catch (error) {
      const message = error?.message || String(error);
      deliverHomebaseLoadResult({ ok: false, error: message, reason });
      reportHomebaseSync('Cloud derzeit nicht erreichbar', 'bad');
      return { ok: false, error: message };
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
      crewShareEnabled: draft.crewShareEnabled === true,
      plan: draft.plan
    });
  }

  function getCrewContext() {
    const sync = getHomebaseSyncContext();
    const rawGroupName = typeof window.getGroupName === 'function'
      ? window.getGroupName()
      : localStorage.getItem('ga_group_name');
    const groupName = String(rawGroupName || '').trim().toUpperCase();
    return { ...sync, groupName };
  }

  function crewHeaders(context) {
    return { 'X-Pilot-ID': context.pilotId, 'X-Pilot-PIN': context.pin };
  }

  function publishCrewHomebaseDirectory() {
    const directory = crewHomebaseDirectory.map((entry) => ({ ...entry, spawn: entry?.spawn ? { ...entry.spawn } : null }));
    window.homebaseGroupDirectory = directory;
    window.dispatchEvent(new CustomEvent('homebase-directory-changed', { detail: directory }));
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function heading(value) {
    return ((finite(value) % 360) + 360) % 360;
  }

  function offsetLatLon(lat, lon, northM, eastM) {
    const radius = 6371000;
    const latRad = lat * Math.PI / 180;
    return {
      lat: lat + (northM / radius) * 180 / Math.PI,
      lon: lon + (eastM / (radius * Math.max(.05, Math.cos(latRad)))) * 180 / Math.PI
    };
  }

  function distanceNm(latA, lonA, latB, lonB) {
    const toRad = Math.PI / 180;
    const dLat = (latB - latA) * toRad;
    const dLon = (lonB - lonA) * toRad;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(latA * toRad) * Math.cos(latB * toRad) * Math.sin(dLon / 2) ** 2;
    return 3440.065 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  }

  function compactCrewId(value) {
    let hash = 2166136261;
    const text = String(value || 'crew');
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function crewObjectsForBase(base) {
    const plan = base?.plan || {};
    const spawn = plan.spawn || {};
    const hangar = plan.hangar || {};
    const lat = finite(spawn.lat, NaN);
    const lon = finite(spawn.lon, NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { hangar: null, extras: [] };
    const prefix = `crew-${compactCrewId(base.pilotId)}-`;
    const owner = String(base.nick || 'Pilot').slice(0, 48);
    const hangarPosition = offsetLatLon(lat, lon, finite(hangar.northM), finite(hangar.eastM));
    const hangarObject = String(hangar.objectTitle || '').trim() ? {
      id: `${prefix}hangar`, title: String(hangar.objectTitle), label: `${owner} · Hangar`,
      lat: hangarPosition.lat, lon: hangarPosition.lon,
      altFt: finite(spawn.altFt) + finite(hangar.heightFt), heightOffsetFt: finite(hangar.heightFt),
      heading: heading(finite(hangar.heading) + 180), scale: 1
    } : null;
    const extras = (Array.isArray(plan.objects) ? plan.objects : []).slice(0, 20).map((item, index) => {
      const position = offsetLatLon(lat, lon, finite(item?.northM), finite(item?.eastM));
      return {
        id: `${prefix}object-${index + 1}`, title: String(item?.title || ''),
        label: `${owner} · ${String(item?.label || 'Ausstattung').slice(0, 48)}`,
        lat: position.lat, lon: position.lon,
        altFt: finite(spawn.altFt) + finite(item?.heightFt), heightOffsetFt: finite(item?.heightFt),
        heading: heading(item?.heading), scale: Math.max(.1, Math.min(10, finite(item?.scale, 1)))
      };
    }).filter((item) => item.title);
    return { hangar: hangarObject, extras };
  }

  function crewSceneForPosition(position) {
    const ownLat = finite(position?.lat, NaN);
    const ownLon = finite(position?.lon, NaN);
    if (!Number.isFinite(ownLat) || !Number.isFinite(ownLon)) return [];
    const nearby = crewHomebases.map((base) => {
      const spawn = base?.plan?.spawn || {};
      return { base, distance: distanceNm(ownLat, ownLon, finite(spawn.lat, NaN), finite(spawn.lon, NaN)) };
    }).filter((entry) => Number.isFinite(entry.distance) && entry.distance <= HOMEBASE_CREW_RADIUS_NM)
      .sort((left, right) => left.distance - right.distance)
      .map((entry) => ({ ...entry, objects: crewObjectsForBase(entry.base) }));
    const scene = nearby.map((entry) => entry.objects.hangar).filter(Boolean).slice(0, HOMEBASE_CREW_MAX_OBJECTS);
    for (let index = 0; scene.length < HOMEBASE_CREW_MAX_OBJECTS; index += 1) {
      let added = false;
      for (const entry of nearby) {
        const object = entry.objects.extras[index];
        if (!object || scene.length >= HOMEBASE_CREW_MAX_OBJECTS) continue;
        scene.push(object);
        added = true;
      }
      if (!added) break;
    }
    return scene;
  }

  function applyCrewScene(position, reason = 'telemetry') {
    const objects = crewSceneForPosition(position);
    const signature = JSON.stringify(objects);
    if (signature === crewLastSceneSignature) return false;
    if (!window.liveTrackerConnected || typeof window.sendTrackerCommand !== 'function') return false;
    if (!crewTrackerSupported) {
      if (!crewCapabilityRequestedAt || Date.now() - crewCapabilityRequestedAt > 15000) {
        crewCapabilityRequestedAt = Date.now();
        sendTracker({ type: 'homebase_v1.capabilities' }, { kind: 'crew-capabilities' });
      }
      return false;
    }
    const sent = sendTracker({ type: 'homebase_v1.crew.set', objects }, { kind: 'crew-scene', reason });
    if (sent) crewLastSceneSignature = signature;
    return !!sent;
  }

  async function refreshCrewHomebases(reason = 'poll') {
    const context = getCrewContext();
    if (!context.enabled || !context.pilotId || !context.pin || !context.groupName) {
      crewHomebases = [];
      crewHomebaseDirectory = [];
      publishCrewHomebaseDirectory();
      crewLastSceneSignature = '';
      applyCrewScene(window.lastLiveGpsPos, `${reason}-no-group`);
      return { ok: true, cleared: true };
    }
    if (crewRefreshInFlight) return { ok: true, queued: true };
    crewRefreshInFlight = true;
    try {
      const response = await fetch(HOMEBASE_CREW_URL + encodeURIComponent(context.groupName), { headers: crewHeaders(context), cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Crew-Antwort ${response.status}`);
      crewHomebases = Array.isArray(data.bases) ? data.bases : [];
      crewHomebaseDirectory = Array.isArray(data.directory) ? data.directory : [];
      publishCrewHomebaseDirectory();
      crewLastSceneSignature = '';
      applyCrewScene(window.lastLiveGpsPos, reason);
      return { ok: true, count: crewHomebases.length };
    } catch (error) {
      crewHomebases = [];
      crewHomebaseDirectory = [];
      publishCrewHomebaseDirectory();
      crewLastSceneSignature = '';
      applyCrewScene(window.lastLiveGpsPos, `${reason}-failed`);
      return { ok: false, error: error?.message || String(error) };
    } finally {
      crewRefreshInFlight = false;
    }
  }

  function scheduleCrewRefresh(delay = HOMEBASE_CREW_POLL_MS) {
    clearTimeout(crewRefreshTimer);
    crewRefreshTimer = setTimeout(async () => {
      await refreshCrewHomebases('poll');
      scheduleCrewRefresh();
    }, delay);
  }

  async function flushHomebaseDraft(reason = 'manual') {
    clearTimeout(homebaseSyncTimer);
    homebaseSyncTimer = null;
    if (!latestHomebaseDraft?.dirty || !latestHomebaseDraft.plan) return { ok: true, skipped: true };
    const context = getHomebaseSyncContext();
    if (!context.enabled || !context.pilotId || !context.pin) return { ok: false, disabled: true };
    if (homebaseSaveInFlight) {
      homebaseSaveQueued = true;
      return { ok: true, queued: true };
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
        return { ok: false, conflict: true, record: data.record };
      }
      if (!response.ok) throw new Error(data.error || `Cloud-Antwort ${response.status}`);
      postToWorkbench('sync-save-result', { ok: true, record: data.record || null, reason });
      return { ok: true, saved: true, record: data.record || null };
    } catch (error) {
      const message = error?.message || String(error);
      postToWorkbench('sync-save-result', { ok: false, error: message, reason });
      reportHomebaseSync('Cloud-Speichern fehlgeschlagen', 'bad');
      return { ok: false, error: message };
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
    if (stabilizerCommand.type === 'homebase_v1.hangar.animation.set') {
      console.info('[Homebase] Hangartor-Befehl aus der Workbench übernommen.', {
        commandId: stabilizerCommand.commandId,
        state: stabilizerCommand.state,
        title: stabilizerCommand.title
      });
      const sent = sendTracker({
        type: 'homebase_v1.hangar.animation.set',
        commandId: stabilizerCommand.commandId,
        title: stabilizerCommand.title,
        state: stabilizerCommand.state
      }, { kind: 'hangar-animation' });
      if (!sent) console.warn('[Homebase] Hangartor-Befehl konnte nicht an den Tracker gesendet werden.');
      return;
    }
    if (stabilizerCommand.type === 'homebase_v1.object.control.set') {
      console.info('[Homebase] Objektsteuerung aus der Workbench übernommen.', {
        commandId: stabilizerCommand.commandId,
        title: stabilizerCommand.title,
        controlId: stabilizerCommand.controlId,
        state: stabilizerCommand.state
      });
      const sent = sendTracker({
        type: 'homebase_v1.object.control.set',
        commandId: stabilizerCommand.commandId,
        title: stabilizerCommand.title,
        controlId: stabilizerCommand.controlId,
        state: stabilizerCommand.state
      }, { kind: 'object-control' });
      if (!sent) console.warn('[Homebase] Objektsteuerung konnte nicht an den Tracker gesendet werden.');
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
    if (meta.kind === 'crew-scene') return;
    if (ack.type === 'homebase_v1.capabilities_ack' || meta.kind === 'capabilities') {
      crewTrackerSupported = Array.isArray(ack.capabilities) && ack.capabilities.includes('homebase-crew-scene');
      crewCapabilityRequestedAt = 0;
      if (meta.kind === 'crew-capabilities') {
        applyCrewScene(window.lastLiveGpsPos, 'crew-capabilities');
        return;
      }
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
    if (meta.kind === 'hangar-animation') {
      relayMessage({ stabilizerAck: { ...ack, type: 'homebase_v1.hangar.animation.set_ack' } });
      return;
    }
    if (meta.kind === 'object-control') {
      relayMessage({ stabilizerAck: { ...ack, type: 'homebase_v1.object.control.set_ack' } });
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
    applyCrewScene(data, 'telemetry');
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
        deviceId: String(message.deviceId || ''),
        crewShareEnabled: message.crewShareEnabled === true
      };
      scheduleHomebaseSave();
    }
    if (message.kind === 'sync-save-now') flushHomebaseDraft(message.reason || 'workbench');
    if (message.kind === 'sync-load') loadHomebaseFromCloud('workbench');
    if (message.kind === 'workbench-ready') {
      homebaseWorkbenchReady = true;
      if (overlay()?.classList.contains('active')) postToWorkbench('environment-opened');
      if (pendingHomebaseLoadResult) {
        const pending = pendingHomebaseLoadResult;
        pendingHomebaseLoadResult = null;
        postToWorkbench('sync-load-result', pending);
      } else {
        loadHomebaseFromCloud('workbench-ready');
      }
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
  window.homebaseCloudPush = (reason = 'app-push') => flushHomebaseDraft(reason);
  window.homebaseCloudPull = (reason = 'app-pull') => loadHomebaseFromCloud(reason);
  window.homebaseGroupRefresh = (reason = 'external') => refreshCrewHomebases(reason);
  window.homebaseGroupClear = () => {
    crewHomebases = [];
    crewHomebaseDirectory = [];
    publishCrewHomebaseDirectory();
    crewLastSceneSignature = '';
    return applyCrewScene(window.lastLiveGpsPos, 'group-cleared');
  };
  scheduleCrewRefresh(1500);
})();
