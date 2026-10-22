(() => {
  'use strict';

  const CHANNEL = 'vfr-homebase';
  const HOMEBASE_SYNC_URL = 'https://ga-proxy.einherjer.workers.dev/api/homebase/';
  const HOMEBASE_CREW_URL = 'https://ga-proxy.einherjer.workers.dev/api/homebase-group/';
  const HOMEBASE_SYNC_DELAY_MS = 20000;
  const HOMEBASE_CREW_POLL_MS = 45000;
  const HOMEBASE_OWN_ENTER_RADIUS_NM = 20;
  const HOMEBASE_OWN_EXIT_RADIUS_NM = 22;
  const HOMEBASE_CREW_CAPABILITY_RETRY_MS = 15000;
  const HOMEBASE_FALLBACK_SCHEMA_VERSION = 1;
  const HOMEBASE_FALLBACK_SYNC_DELAY_MS = 750;
  const HOMEBASE_LOCAL_STORAGE_KEY = 'vfr-homebase-workbench-v2';
  const HOMEBASE_SYNC_META_KEY = 'vfr-homebase-workbench-sync-v1';
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
  let crewTrackerConnectionToken = '';
  const crewCapabilityRetry = window.GAHomebaseCapabilityRetry?.createCapabilityRetryGate?.({
    capability: 'homebase-crew-scene',
    retryMs: HOMEBASE_CREW_CAPABILITY_RETRY_MS
  });
  if (!crewCapabilityRetry) throw new Error('Homebase capability retry core is unavailable.');
  const sceneCore = window.GAHomebaseSceneCore;
  if (!sceneCore) throw new Error('Homebase scene core is unavailable.');
  const homebaseScene = sceneCore.createHomebaseSceneCore({ catalog: () => globalThis.HOMEBASE_ASSET_CATALOG });
  let ownCloudPlan = null;
  let ownCloudRecord = null;
  let ownCloudLoadStarted = false;
  let ownCloudLoadComplete = false;
  let ownPackageStatus = null;
  let ownPackageStatusRequestedAt = 0;
  let ownAutoInside = false;
  let ownAutoSuppressedUntilExit = false;
  let ownAutoInFlight = false;
  let ownAutoQueued = false;
  let ownLastAppliedSignature = '';
  let ownLastAppliedObjectsSignature = '';
  let ownLastAppliedAt = 0;
  let ownLastTelemetry = null;
  let ownAutoPlanSettlesAt = 0;
  let ownAutoPlanApplyTimer = null;
  let ownWorkbenchPeopleSyncInFlight = false;
  let ownFailedPeopleSignature = '';
  let ownFailedPeopleRetryAt = 0;
  let ownFallbackCacheTimer = null;
  let ownFallbackCacheWatchdog = null;
  let ownFallbackCacheInFlight = false;
  let ownFallbackCacheQueued = false;
  let ownLastFallbackCacheSignature = '';
  let ownFallbackCacheRetryAt = 0;
  let ownTrackerSceneStatusKey = '';
  let ownTrackerSuppressRequested = false;

  const overlay = () => document.getElementById('homebaseOverlay');
  const frame = () => document.getElementById('homebaseFrame');

  function postToWorkbench(kind, payload = {}) {
    const target = frame()?.contentWindow;
    if (!target) return false;
    target.postMessage({ channel: CHANNEL, kind, ...payload }, window.location.origin);
    return true;
  }

  function syncHomebaseTheme() {
    return postToWorkbench('theme-change', { theme: 'blueprint' });
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
        ownCloudPlan = null;
        ownCloudRecord = null;
        const delivered = deliverHomebaseLoadResult({ ok: true, record: null, pilotId: context.pilotId, reason });
        applyOwnHomebaseScene(ownLastTelemetry, `${reason}-empty`);
        return { ok: true, record: null, deferred: !delivered };
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Cloud-Antwort ${response.status}`);
      const record = data.record || null;
      ownCloudPlan = record?.plan || null;
      ownCloudRecord = record;
      const delivered = deliverHomebaseLoadResult({ ok: true, record, pilotId: context.pilotId, reason });
      applyOwnHomebaseScene(ownLastTelemetry, `${reason}-loaded`);
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
      schemaVersion: 2,
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
    // Crew-Homebases are a read-only group feature. They only require valid
    // credentials and must stay available when profile auto-sync is disabled.
    return { ...sync, authReady: !!sync.pilotId && !!sync.pin, groupName };
  }

  function crewHeaders(context) {
    return { 'X-Pilot-ID': context.pilotId, 'X-Pilot-PIN': context.pin };
  }

  function publishCrewHomebaseDirectory() {
    const directory = crewHomebaseDirectory.map((entry) => ({ ...entry, spawn: entry?.spawn ? { ...entry.spawn } : null }));
    window.homebaseGroupDirectory = directory;
    window.dispatchEvent(new CustomEvent('homebase-directory-changed', { detail: directory }));
  }

  function finite(value, fallback = 0) { return sceneCore.finite(value, fallback); }

  function heading(value) { return sceneCore.heading(value); }

  function offsetLatLon(lat, lon, northM, eastM) { return sceneCore.offsetLatLon(lat, lon, northM, eastM); }

  function distanceNm(latA, lonA, latB, lonB) { return sceneCore.distanceNm(latA, lonA, latB, lonB); }

  function readJsonStorage(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; }
  }

  function currentOwnHomebasePlan() {
    if (latestHomebaseDraft?.plan) return latestHomebaseDraft.plan;
    const localPlan = readJsonStorage(HOMEBASE_LOCAL_STORAGE_KEY);
    const localMeta = readJsonStorage(HOMEBASE_SYNC_META_KEY);
    if (localMeta?.dirty === true && localPlan) return localPlan;
    if (ownCloudPlan) {
      const localPeople = Array.isArray(localPlan?.people) ? localPlan.people.slice(0, 3) : [];
      const legacyPeopleRecord = finite(ownCloudRecord?.schemaVersion, 1) < 2;
      if (localPeople.length > 0 && legacyPeopleRecord) {
        return { ...ownCloudPlan, people: localPeople };
      }
      return ownCloudPlan;
    }
    return localPlan;
  }

  function homebaseCatalogDefinition(title) { return homebaseScene.catalogDefinition(title); }

  function normalizeHomebasePersonTitle(rawTitle) { return homebaseScene.normalizePersonTitle(rawTitle); }

  function normalizeHomebaseControlStates(raw) { return sceneCore.normalizeControlStates(raw); }

  function sanitizeHomebaseRuntimeConfig(config) { return homebaseScene.sanitizeRuntimeConfig(config); }

  function homebaseHeadingCorrection(title) { return homebaseScene.headingCorrection(title); }

  function isPersistentOnlyHomebaseObject(title) { return homebaseScene.isPersistentOnlyObject(title); }

  function isLiveSpawnableCrewObject(title) { return homebaseScene.isLiveSpawnableCrewObject(title); }

  function homebaseNavigationFootprint(title) { return homebaseScene.navigationFootprint(title); }

  // Gemeinsamer Kern mit dem Tracker (homebase-scene-core.js).
  function ownRuntimeConfigFromPlan(plan) { return homebaseScene.runtimeConfigFromPlan(plan); }

  function currentOwnRuntimeConfig() {
    return sanitizeHomebaseRuntimeConfig(latestHomebaseDraft?.runtimeConfig || ownRuntimeConfigFromPlan(currentOwnHomebasePlan()));
  }

  function compactSceneSignature(serialized) { return sceneCore.compactSceneSignature(serialized); }

  function ownFallbackCachePayload() {
    return homebaseScene.fallbackPayload(currentOwnRuntimeConfig(), ownHomebaseDelta());
  }

  // Ab Tracker v589 laedt der Tracker die eigene Homebase selbst aus der Cloud
  // (homebase-cloud-scene-v1). Die App baut dann nur noch bei einem
  // ungespeicherten Workbench-Entwurf selbst auf; sonst bearbeitet sie nur.
  const TRACKER_CLOUD_SCENE_CAPABILITY = 'homebase-cloud-scene-v1';

  function ownDraftDirty() {
    return latestHomebaseDraft?.dirty === true || readJsonStorage(HOMEBASE_SYNC_META_KEY)?.dirty === true;
  }

  function ownTrackerCloudCapable(position = ownLastTelemetry) {
    const capabilities = position?.homebase?.capabilities;
    return Array.isArray(capabilities) && capabilities.includes(TRACKER_CLOUD_SCENE_CAPABILITY);
  }

  function ownTrackerOwnsScene(position = ownLastTelemetry) {
    if (!ownTrackerCloudCapable(position) || ownDraftDirty()) return false;
    // Rein lokale Homebase (Cloud-Sync aus): die App bleibt zustaendig.
    if (!getHomebaseSyncContext().enabled) return false;
    const status = String(position?.homebase?.cloudScene?.status || '');
    return ['idle', 'loading', 'ok'].includes(status);
  }

  function requestTrackerCloudRefresh(reason, extra = {}) {
    if (!ownTrackerCloudCapable()) return false;
    return !!sendTracker({ type: 'homebase_v1.cloud.refresh', reason, draftDirty: ownDraftDirty(), ...extra }, { kind: 'cloud-refresh', reason });
  }

  function handleTrackerOwnedScene(position, inside, distance) {
    const cloudScene = position?.homebase?.cloudScene || {};
    if (inside && ownAutoSuppressedUntilExit && cloudScene.suppressed !== true && !ownTrackerSuppressRequested) {
      ownTrackerSuppressRequested = !!sendTracker({ type: 'homebase_v1.fallback.suppress', suppressed: true }, { kind: 'fallback-suppress' });
    }
    if (!ownAutoSuppressedUntilExit) ownTrackerSuppressRequested = false;
    const key = `${cloudScene.status || ''}|${cloudScene.revision || ''}|${cloudScene.sceneSignature || ''}|${inside ? 1 : 0}|${ownAutoSuppressedUntilExit ? 1 : 0}`;
    if (key === ownTrackerSceneStatusKey) return;
    ownTrackerSceneStatusKey = key;
    publishOwnAutoStatus({
      status: cloudScene.status === 'ok' ? 'ok' : 'warn',
      distanceNm: distance,
      active: inside && !ownAutoSuppressedUntilExit,
      message: cloudScene.status === 'ok'
        ? (ownAutoSuppressedUntilExit
          ? 'Live-Ergänzungen sind bis zum Verlassen des Radius ausgeblendet.'
          : `Der Tracker baut die Homebase direkt aus der Cloud${cloudScene.objects != null ? ` (${cloudScene.objects} Live-Objekt(e))` : ''}.`)
        : 'Der Tracker lädt die Homebase aus der Cloud …'
    });
  }

  function sendOwnFallbackCache(reason = 'auto') {
    clearTimeout(ownFallbackCacheTimer);
    ownFallbackCacheTimer = null;
    // Den Zwischenspeicher fuellt dann der Tracker selbst aus der Cloud.
    if (ownTrackerOwnsScene()) return false;
    const cache = ownFallbackCachePayload();
    if (!cache || ownFallbackCacheInFlight || Date.now() < ownFallbackCacheRetryAt) {
      if (ownFallbackCacheInFlight) ownFallbackCacheQueued = true;
      return false;
    }
    const signature = JSON.stringify(cache);
    if (signature === ownLastFallbackCacheSignature) return false;
    const commandId = sendTracker({ type: 'homebase_v1.fallback.store', cache, draftDirty: ownDraftDirty() }, {
      kind: 'fallback-store', reason, fallbackCacheSignature: signature
    });
    if (!commandId) return false;
    ownFallbackCacheInFlight = true;
    clearTimeout(ownFallbackCacheWatchdog);
    ownFallbackCacheWatchdog = setTimeout(() => {
      ownFallbackCacheWatchdog = null;
      ownFallbackCacheInFlight = false;
      ownFallbackCacheRetryAt = Date.now() + 3000;
      scheduleOwnFallbackCache('retry');
    }, 10000);
    return true;
  }

  function scheduleOwnFallbackCache(reason = 'auto') {
    const cache = ownFallbackCachePayload();
    if (!cache || JSON.stringify(cache) === ownLastFallbackCacheSignature || ownFallbackCacheTimer) return;
    ownFallbackCacheTimer = setTimeout(() => sendOwnFallbackCache(reason), HOMEBASE_FALLBACK_SYNC_DELAY_MS);
  }

  function runtimeObjectsFromConfig(config) { return homebaseScene.runtimeObjectsFromConfig(config); }

  function angularDifference(left, right) { return sceneCore.angularDifference(left, right); }

  function sameCompiledPlacement(current, compiled) { return sceneCore.sameCompiledPlacement(current, compiled); }

  function ownHomebaseDelta() {
    return homebaseScene.sceneDelta(currentOwnRuntimeConfig(), ownPackageStatus);
  }

  function noteOwnObjectDeltaApplied() {
    if (!ownAutoInside || ownAutoSuppressedUntilExit) return false;
    const delta = ownHomebaseDelta();
    if (!delta.ready) return false;
    ownLastAppliedObjectsSignature = JSON.stringify(delta.objects || []);
    ownLastAppliedAt = Date.now();
    return true;
  }

  function deferOwnAutoApplyForDelta() {
    ownAutoPlanSettlesAt = Date.now() + 5000;
    clearTimeout(ownAutoPlanApplyTimer);
    ownAutoPlanApplyTimer = setTimeout(() => applyOwnHomebaseScene(ownLastTelemetry, 'delta-fallback'), 5000);
  }

  function publishOwnAutoStatus(payload = {}) {
    postToWorkbench('owner-auto-status', payload);
  }

  function updateOwnPackageStatus(status = null) {
    ownPackageStatus = status;
    ownPackageStatusRequestedAt = 0;
    ownLastAppliedSignature = '';
    ownLastAppliedObjectsSignature = '';
    ownLastAppliedAt = 0;
    postToWorkbench('compiled-snapshot', {
      sceneInstalled: status?.sceneInstalled === true,
      snapshotTrusted: status?.snapshotTrusted === true,
      snapshot: status?.installedSnapshot || null
    });
  }

  function requestOwnPackageStatus() {
    if (ownPackageStatusRequestedAt && Date.now() - ownPackageStatusRequestedAt < 15000) return false;
    ownPackageStatusRequestedAt = Date.now();
    const sent = sendTracker({ type: 'homebase_v1.package.status' }, { kind: 'owner-package-status' });
    if (!sent) ownPackageStatusRequestedAt = 0;
    return !!sent;
  }

  function ensureOwnHomebaseCloudLoaded() {
    if (ownCloudLoadStarted) return;
    ownCloudLoadStarted = true;
    loadHomebaseFromCloud('owner-auto').catch(() => {}).finally(() => {
      ownCloudLoadComplete = true;
      applyOwnHomebaseScene(ownLastTelemetry, 'owner-cloud-ready');
    });
  }

  function applyOwnHomebaseScene(position, reason = 'telemetry') {
    if (!position || !Number.isFinite(Number(position.lat)) || !Number.isFinite(Number(position.lon))) return false;
    if (reason === 'telemetry' && Date.now() < ownAutoPlanSettlesAt) return false;
    ownLastTelemetry = position;
    ensureOwnHomebaseCloudLoaded();
    const syncContext = getHomebaseSyncContext();
    const localSyncMeta = readJsonStorage(HOMEBASE_SYNC_META_KEY);
    if (syncContext.enabled && localSyncMeta?.dirty !== true && !latestHomebaseDraft?.dirty && !ownCloudLoadComplete) return false;
    const plan = currentOwnHomebasePlan();
    const baseLat = finite(plan?.spawn?.lat, NaN);
    const baseLon = finite(plan?.spawn?.lon, NaN);
    if (!Number.isFinite(baseLat) || !Number.isFinite(baseLon)) return false;
    const distance = distanceNm(Number(position.lat), Number(position.lon), baseLat, baseLon);
    const inside = ownAutoInside ? distance <= HOMEBASE_OWN_EXIT_RADIUS_NM : distance <= HOMEBASE_OWN_ENTER_RADIUS_NM;
    if (!inside) {
      ownAutoInside = false;
      ownAutoSuppressedUntilExit = false;
    } else {
      ownAutoInside = true;
    }
    if (ownTrackerOwnsScene(position)) {
      handleTrackerOwnedScene(position, inside, distance);
      return false;
    }
    ownTrackerSceneStatusKey = '';
    if (!ownPackageStatus) {
      requestOwnPackageStatus();
      return false;
    }
    const delta = ownHomebaseDelta();
    if (!delta.ready) {
      if (inside && delta.reason === 'snapshot-missing') {
        publishOwnAutoStatus({ status: 'warn', distanceNm: distance, message: 'Installierter Homebase-Mod ohne Vergleichsstand erkannt. Bitte die Homebase einmal neu kompilieren und installieren.' });
      }
      return false;
    }
    const objects = inside && !ownAutoSuppressedUntilExit ? delta.objects : [];
    const config = currentOwnRuntimeConfig();
    const people = inside && !ownAutoSuppressedUntilExit ? (config?.people || []) : [];
    const controlStates = inside && !ownAutoSuppressedUntilExit
      ? normalizeHomebaseControlStates(config?.controlStates)
      : [];
    const navigation = config?.navigation || null;
    const signature = JSON.stringify({ objects, people, navigation });
    const sceneSignature = compactSceneSignature(signature);
    const objectsSignature = JSON.stringify(objects);
    scheduleOwnFallbackCache(reason);
    if (signature === ownFailedPeopleSignature && Date.now() < ownFailedPeopleRetryAt) return false;
    const activePreviewIds = new Set((Array.isArray(position?.homebase?.objects) ? position.homebase.objects : [])
      .filter((item) => item?.collection === 'preview').map((item) => String(item.id || '')));
    const expectedIds = [...objects, ...people].map((item) => String(item.id || ''));
    const trackerSceneMatches = expectedIds.length === activePreviewIds.size && expectedIds.every((id) => activePreviewIds.has(id));
    if (trackerSceneMatches && String(position?.homebase?.sceneSignature || '') === sceneSignature) {
      ownLastAppliedSignature = signature;
      ownLastAppliedObjectsSignature = objectsSignature;
      ownLastAppliedAt = Date.now();
      return false;
    }
    if (signature === ownLastAppliedSignature && (trackerSceneMatches || Date.now() - ownLastAppliedAt < 5000)) return false;
    if (ownAutoInFlight || ownWorkbenchPeopleSyncInFlight) {
      ownAutoQueued = true;
      return false;
    }
    const canSyncPeopleLive = ownLastAppliedObjectsSignature
      && objectsSignature === ownLastAppliedObjectsSignature
      && (objects.every((item) => activePreviewIds.has(String(item.id || '')))
        || Date.now() - ownLastAppliedAt < 5000);
    const commandId = sendTracker(canSyncPeopleLive
      ? { type: 'homebase_v1.preview.people.sync', people, navigation, sceneSignature }
      : { type: 'homebase_v1.preview.set', objects, people, navigation, controlStates, sceneSignature }, {
      kind: canSyncPeopleLive ? 'owner-auto-people-sync' : 'owner-auto-set',
      reason,
      signature,
      objectsSignature,
      stats: delta.stats,
      distanceNm: distance,
      active: objects.length > 0 || people.length > 0 || (inside && !ownAutoSuppressedUntilExit)
    });
    if (!commandId) return false;
    ownAutoInFlight = true;
    publishOwnAutoStatus({
      status: 'warn',
      distanceNm: distance,
      stats: delta.stats,
      message: canSyncPeopleLive
        ? `${people.length} Homebase-Person(en) und ihre Wegpunkte werden live aktualisiert …`
        : (objects.length || people.length ? `Automatische Homebase-Ergänzung wird mit ${objects.length} Objekt(en) und ${people.length} Person(en) aufgebaut …` : (inside ? 'Der installierte Homebase-Mod ist bereits vollständig aktuell.' : 'Live-Ergänzungen werden außerhalb des Homebase-Radius entfernt …'))
    });
    return true;
  }

  function compactCrewId(value) { return sceneCore.compactCrewId(value); }

  function crewObjectsForBase(base) { return homebaseScene.crewObjectsForBase(base); }

  // Gemeinsamer Kern mit dem Tracker (homebase-scene-core.js).
  function crewSceneForPosition(position) { return homebaseScene.crewSceneForPosition(crewHomebases, position); }

  // Ab Tracker v589 baut der Tracker die Crew-Szene selbst aus der Cloud
  // (homebase-crew-cloud-v1), solange er dieselbe Gruppe kennt wie die App.
  const TRACKER_CREW_CLOUD_CAPABILITY = 'homebase-crew-cloud-v1';

  function trackerCrewTelemetry(position) {
    return position?.homebase ? position : ownLastTelemetry;
  }

  function ownTrackerOwnsCrew(position) {
    const telemetry = trackerCrewTelemetry(position);
    const capabilities = telemetry?.homebase?.capabilities;
    if (!Array.isArray(capabilities) || !capabilities.includes(TRACKER_CREW_CLOUD_CAPABILITY)) return false;
    const crewScene = telemetry?.homebase?.crewScene || {};
    if (!['ok', 'no-group'].includes(String(crewScene.status || ''))) return false;
    return String(crewScene.groupName || '').trim().toUpperCase() === getCrewContext().groupName;
  }

  function requestTrackerCrewRefresh(reason) {
    const telemetry = trackerCrewTelemetry(window.lastLiveGpsPos);
    const capabilities = telemetry?.homebase?.capabilities;
    if (!Array.isArray(capabilities) || !capabilities.includes(TRACKER_CREW_CLOUD_CAPABILITY)) return false;
    return !!sendTracker({ type: 'homebase_v1.crew.refresh', reason, groupName: getCrewContext().groupName }, { kind: 'crew-refresh', reason });
  }

  function applyCrewScene(position, reason = 'telemetry') {
    if (ownTrackerOwnsCrew(position)) {
      // Der Tracker baut selbst; bei spaeterer Rueckgabe an die App neu senden.
      crewLastSceneSignature = '';
      return false;
    }
    const objects = crewSceneForPosition(position);
    const signature = JSON.stringify(objects);
    if (signature === crewLastSceneSignature) return false;
    if (!window.liveTrackerConnected || typeof window.sendTrackerCommand !== 'function') return false;
    if (!crewCapabilityRetry.isSupported()) {
      const now = Date.now();
      if (crewCapabilityRetry.shouldRequest(now)) {
        crewCapabilityRetry.noteRequest(now);
        const sent = sendTracker({ type: 'homebase_v1.capabilities' }, { kind: 'crew-capabilities' });
        if (!sent) crewCapabilityRetry.noteSendFailed(now);
      }
      return false;
    }
    const sent = sendTracker({ type: 'homebase_v1.crew.set', objects }, { kind: 'crew-scene', reason });
    if (sent) crewLastSceneSignature = signature;
    return !!sent;
  }

  async function refreshCrewHomebases(reason = 'poll') {
    const context = getCrewContext();
    if (!context.authReady || !context.groupName) {
      crewHomebases = [];
      crewHomebaseDirectory = [];
      publishCrewHomebaseDirectory();
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
      applyCrewScene(window.lastLiveGpsPos, reason);
      return { ok: true, count: crewHomebases.length };
    } catch (error) {
      crewHomebases = [];
      crewHomebaseDirectory = [];
      publishCrewHomebaseDirectory();
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
        postToWorkbench('sync-save-result', {
          ok: false, conflict: true, record: data.record, reason,
          savedPlan: draft.plan,
          savedClientUpdatedAt: draft.localUpdatedAt,
          savedCrewShareEnabled: draft.crewShareEnabled === true
        });
        reportHomebaseSync('Cloud-Konflikt erkannt', 'bad');
        return { ok: false, conflict: true, record: data.record };
      }
      if (!response.ok) throw new Error(data.error || `Cloud-Antwort ${response.status}`);
      postToWorkbench('sync-save-result', {
        ok: true, record: data.record || null, reason,
        savedPlan: draft.plan,
        savedClientUpdatedAt: draft.localUpdatedAt,
        savedCrewShareEnabled: draft.crewShareEnabled === true
      });
      // Neuer Cloud-Stand: der Tracker uebernimmt ihn selbst.
      // Der gespeicherte Entwurf ist jetzt der Cloud-Stand.
      requestTrackerCloudRefresh('app-save', { draftDirty: false });
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
        objects: [...hangar, ...(Array.isArray(config.objects) ? config.objects : [])],
        people: Array.isArray(config.people) ? config.people : [],
        navigation: config.navigation || null
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
      deferOwnAutoApplyForDelta();
      sendTracker({ type: 'homebase_v1.preview.object.add', commandId: stabilizerCommand.commandId, object: stabilizerCommand.object }, { kind: 'object-add' });
      return;
    }
    if (stabilizerCommand.type === 'homebase_v1.preview.object.remove') {
      deferOwnAutoApplyForDelta();
      sendTracker({
        type: 'homebase_v1.preview.object.remove',
        commandId: stabilizerCommand.commandId,
        id: stabilizerCommand.id,
        label: stabilizerCommand.label
      }, { kind: 'object-remove' });
      return;
    }
    if (stabilizerCommand.type === 'homebase_v1.preview.people.sync') {
      if (!ownAutoInside || ownAutoSuppressedUntilExit) {
        relayMessage({
          stabilizerAck: {
            type: 'homebase_v1.preview.people.sync_ack',
            commandId: stabilizerCommand.commandId,
            status: 'noop',
            message: 'Personenplan gespeichert; die Homebase ist derzeit nicht aktiv.'
          }
        });
        return;
      }
      if (ownAutoInFlight || ownWorkbenchPeopleSyncInFlight) {
        ownAutoQueued = true;
        relayMessage({
          stabilizerAck: {
            type: 'homebase_v1.preview.people.sync_ack',
            commandId: stabilizerCommand.commandId,
            status: 'noop',
            message: 'Personenänderung wurde mit der laufenden Aktualisierung gebündelt.'
          }
        });
        return;
      }
      const config = sanitizeHomebaseRuntimeConfig({
        people: Array.isArray(stabilizerCommand.people) ? stabilizerCommand.people : [],
        navigation: stabilizerCommand.navigation || null
      });
      const delta = ownHomebaseDelta();
      const objects = delta.ready ? (delta.objects || []) : [];
      const people = config?.people || [];
      const navigation = config?.navigation || null;
      const signature = JSON.stringify({ objects, people, navigation });
      const objectsSignature = JSON.stringify(objects);
      if (signature === ownFailedPeopleSignature && Date.now() < ownFailedPeopleRetryAt) {
        relayMessage({
          stabilizerAck: {
            type: 'homebase_v1.preview.people.sync_ack',
            commandId: stabilizerCommand.commandId,
            status: 'error',
            message: 'Diese Personenänderung ist gerade fehlgeschlagen und wird erst nach einer kurzen Pause erneut versucht.'
          }
        });
        return;
      }
      const commandId = sendTracker({
        type: 'homebase_v1.preview.people.sync',
        commandId: stabilizerCommand.commandId,
        people,
        navigation,
        sceneSignature: compactSceneSignature(signature)
      }, { kind: 'people-live-sync', signature, objectsSignature });
      if (commandId) ownWorkbenchPeopleSyncInFlight = true;
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
        state: stabilizerCommand.state,
        instanceId: stabilizerCommand.instanceId,
        objectId: stabilizerCommand.objectId,
        lat: stabilizerCommand.lat,
        lon: stabilizerCommand.lon
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
        state: stabilizerCommand.state,
        instanceId: stabilizerCommand.instanceId,
        objectId: stabilizerCommand.objectId,
        lat: stabilizerCommand.lat,
        lon: stabilizerCommand.lon
      }, { kind: 'object-control' });
      if (!sent) console.warn('[Homebase] Objektsteuerung konnte nicht an den Tracker gesendet werden.');
      return;
    }
    if (stabilizerCommand.type === 'homebase_v1.door_automation.set') {
      sendTracker({
        type: 'homebase_v1.door_automation.set',
        commandId: stabilizerCommand.commandId,
        enabled: stabilizerCommand.enabled !== false,
        resetManualOverrides: stabilizerCommand.resetManualOverrides === true
      }, { kind: 'door-automation' });
      return;
    }
    if (stabilizerCommand.type === 'homebase_v1.preview.object.move' || stabilizerCommand.type === 'homebase_v1.preview.hangar.move') {
      deferOwnAutoApplyForDelta();
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
      result = {
        ok: true,
        installed: ack.sdkInstalled === true,
        path: ack.sdkPath || '',
        built: ack.built === true,
        sceneInstalled: ack.sceneInstalled === true,
        snapshotTrusted: ack.snapshotTrusted === true,
        installedSnapshot: ack.installedSnapshot || null
      };
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
      if (meta.pathname === '/api/sdk/status') updateOwnPackageStatus(ack);
      if (meta.pathname === '/api/package/install' && ack.status === 'ok') {
        updateOwnPackageStatus({ ...ack, sceneInstalled: true });
        applyOwnHomebaseScene(ownLastTelemetry, 'package-installed');
      }
      if (meta.pathname === '/api/package/uninstall' && (ack.status === 'ok' || ack.status === 'noop')) {
        updateOwnPackageStatus({ sceneInstalled: false, snapshotTrusted: false, installedSnapshot: null });
        applyOwnHomebaseScene(ownLastTelemetry, 'package-uninstalled');
      }
      rpcResultFromAck(meta, ack);
      return;
    }
    if (meta.kind === 'owner-package-status') {
      updateOwnPackageStatus(ack.status === 'ok' ? ack : null);
      applyOwnHomebaseScene(ownLastTelemetry, 'package-status');
      return;
    }
    if (meta.kind === 'fallback-store') {
      clearTimeout(ownFallbackCacheWatchdog);
      ownFallbackCacheWatchdog = null;
      ownFallbackCacheInFlight = false;
      if (ack.status === 'ok') {
        ownLastFallbackCacheSignature = String(meta.fallbackCacheSignature || '');
        ownFallbackCacheRetryAt = 0;
      } else {
        ownFallbackCacheRetryAt = Date.now() + 15000;
      }
      if (ownFallbackCacheQueued) {
        ownFallbackCacheQueued = false;
        scheduleOwnFallbackCache('queued');
      }
      return;
    }
    if (meta.kind === 'owner-auto-set' || meta.kind === 'owner-auto-people-sync') {
      ownAutoInFlight = false;
      const ok = ack.status === 'ok' || ack.status === 'noop';
      const failedEntries = Array.isArray(ack.failedObjects) ? ack.failedObjects : [];
      const legacyPeopleOnlyFailure = failedEntries.length > 0
        && failedEntries.every((entry) => /^Tarmac_/i.test(String(entry?.title || '')));
      const peopleOnlyFailure = ack.status === 'error'
        && ((Number(ack.objectFailureCount || 0) === 0 && Number(ack.peopleFailureCount || 0) > 0)
          || legacyPeopleOnlyFailure);
      if (ok) {
        ownLastAppliedSignature = String(meta.signature || '');
        ownLastAppliedObjectsSignature = String(meta.objectsSignature || '');
        ownLastAppliedAt = Date.now();
        ownFailedPeopleSignature = '';
        ownFailedPeopleRetryAt = 0;
      } else if (meta.kind === 'owner-auto-people-sync' || peopleOnlyFailure) {
        ownLastAppliedSignature = '';
        ownLastAppliedObjectsSignature = String(meta.objectsSignature || ownLastAppliedObjectsSignature || '');
        ownLastAppliedAt = Date.now();
        ownFailedPeopleSignature = String(meta.signature || '');
        ownFailedPeopleRetryAt = Date.now() + 10000;
      } else {
        ownLastAppliedSignature = '';
        ownLastAppliedObjectsSignature = '';
        ownLastAppliedAt = 0;
      }
      publishOwnAutoStatus({
        status: ok ? 'ok' : 'bad',
        distanceNm: meta.distanceNm,
        stats: meta.stats || {},
        active: meta.active === true,
        message: ok
          ? (meta.active ? `${Number(meta.stats?.dynamic || 0)} Live-Ergänzung(en) aktiv; ${Number(meta.stats?.compiled || 0)} Objekt(e) kommen aus dem installierten Mod.` : 'Automatische Homebase-Ergänzung außerhalb des Radius entfernt.')
          : (ack.error || ack.message || 'Automatische Homebase-Ergänzung konnte nicht aufgebaut werden.')
      });
      if (ownAutoQueued) {
        ownAutoQueued = false;
        setTimeout(() => applyOwnHomebaseScene(ownLastTelemetry, 'queued'), 250);
      }
      return;
    }
    if (meta.kind === 'crew-scene') return;
    if (meta.kind === 'cloud-refresh' || meta.kind === 'crew-refresh') return;
    if (meta.kind === 'fallback-suppress') {
      if (ack.status !== 'ok') ownTrackerSuppressRequested = false;
      return;
    }
    if (ack.type === 'homebase_v1.capabilities_ack' || meta.kind === 'capabilities') {
      const crewSupported = crewCapabilityRetry.noteCapabilities(ack.capabilities, Date.now());
      if (meta.kind === 'crew-capabilities') {
        if (crewSupported) applyCrewScene(window.lastLiveGpsPos, 'crew-capabilities');
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
      if (ack.status === 'ok' && noteOwnObjectDeltaApplied()) applyOwnHomebaseScene(ownLastTelemetry, 'object-add-delta');
      relayMessage({ stabilizerAck: { ...ack, type: 'homebase_v1.preview.object.add_ack' } });
      return;
    }
    if (meta.kind === 'object-remove') {
      if ((ack.status === 'ok' || ack.status === 'noop') && noteOwnObjectDeltaApplied()) applyOwnHomebaseScene(ownLastTelemetry, 'object-remove-delta');
      relayMessage({ stabilizerAck: { ...ack, type: 'homebase_v1.preview.object.remove_ack' } });
      return;
    }
    if (meta.kind === 'people-live-sync') {
      ownWorkbenchPeopleSyncInFlight = false;
      if (ack.status === 'ok' || ack.status === 'noop') {
        ownLastAppliedSignature = String(meta.signature || '');
        ownLastAppliedObjectsSignature = String(meta.objectsSignature || ownLastAppliedObjectsSignature || '');
        ownLastAppliedAt = Date.now();
        ownFailedPeopleSignature = '';
        ownFailedPeopleRetryAt = 0;
      } else {
        ownLastAppliedSignature = '';
        ownLastAppliedObjectsSignature = String(meta.objectsSignature || ownLastAppliedObjectsSignature || '');
        ownLastAppliedAt = Date.now();
        ownFailedPeopleSignature = String(meta.signature || '');
        ownFailedPeopleRetryAt = Date.now() + 10000;
      }
      relayMessage({ stabilizerAck: { ...ack, type: 'homebase_v1.preview.people.sync_ack' } });
      if (ownAutoQueued) {
        ownAutoQueued = false;
        setTimeout(() => applyOwnHomebaseScene(ownLastTelemetry, 'people-sync-queued'), 250);
      }
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
    if (meta.kind === 'door-automation') {
      relayMessage({ stabilizerAck: { ...ack, type: 'homebase_v1.door_automation.set_ack' } });
      return;
    }
    if (meta.kind === 'object-move' || meta.kind === 'hangar-move') {
      if (ack.status === 'ok' && noteOwnObjectDeltaApplied()) applyOwnHomebaseScene(ownLastTelemetry, `${meta.kind}-delta`);
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
    applyOwnHomebaseScene(data, 'telemetry');
  }

  function handleTrackerCapabilitiesChange(event) {
    const connectionToken = String(event?.detail?.connectionToken || '');
    if (connectionToken && connectionToken !== crewTrackerConnectionToken) {
      crewTrackerConnectionToken = connectionToken;
      crewCapabilityRetry.reset();
      crewLastSceneSignature = '';
    }
    // Statuspakete kommen auch im HIB-Modus alle fuenf Sekunden. Damit wird ein
    // anfangs noch nicht bereiter SimConnect-Objektmanager nach dem Backoff neu
    // ausgehandelt, ohne dass dafuer volle GPS-Telemetrie noetig ist.
    applyCrewScene(window.lastLiveGpsPos, 'tracker-status');
  }

  const BLUEPRINT_ZOOM_MS = 1100 / 1.3;
  const BLUEPRINT_PULL_MS = 380 / 1.3;
  const blueprintTransition = { busy: false, openedFromPocket: false, scrollX: 0, scrollY: 0 };
  const blueprintButton = () => document.getElementById('homebaseBlueprintLaunch');
  const blueprintSheet = () => document.getElementById('homebaseBlueprintSheet');
  function prepareHomebaseBlueprint() {
    if (frame()) frame().loading = 'eager';
  }
  const blueprintReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  async function blueprintAnimate(element, frames, duration, easing = 'cubic-bezier(.22,.7,.25,1)') {
    const animation = element.animate(frames, { duration, easing, fill: 'forwards' });
    try { await animation.finished; } catch (_) {}
    return animation;
  }
  function blueprintPortal(rect) {
    const root = document.createElement('div');
    root.className = 'homebase-blueprint-transition';
    root.setAttribute('aria-hidden', 'true');
    const veil = document.createElement('div');
    veil.className = 'homebase-blueprint-veil';
    const paper = document.createElement('img');
    paper.className = 'homebase-blueprint-zoom';
    paper.src = blueprintSheet().currentSrc || blueprintSheet().src;
    paper.alt = '';
    Object.assign(paper.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    root.append(veil, paper);
    root.addEventListener('wheel', event => event.preventDefault(), { passive: false });
    root.addEventListener('touchmove', event => event.preventDefault(), { passive: false });
    document.body.appendChild(root);
    const scale = Math.max(window.innerWidth / rect.width, window.innerHeight / rect.height) * 2.8;
    const dx = window.innerWidth / 2 - (rect.left + rect.width / 2);
    const dy = window.innerHeight / 2 - (rect.top + rect.height / 2);
    return { root, veil, paper, coverProgress: (scale / 2.8 * 1.08 - 1) / (scale - 1), coverZoom: `translate(${dx}px, ${dy}px) scale(${scale / 2.8 * 1.08})`, zoom: `translate(${dx}px, ${dy}px) scale(${scale})` };
  }
  let suspendedBackgroundViews = null;
  function suspendHomebaseBackground() {
    if (suspendedBackgroundViews) return;
    suspendedBackgroundViews = ['mapTableOverlay', 'pinboardOverlay']
      .map(id => document.getElementById(id))
      .filter(element => element?.classList.contains('active'))
      .map(element => ({ element, inert: element.inert }));
    suspendedBackgroundViews.forEach(({ element }) => {
      element.inert = true;
      element.classList.add('homebase-background-suspended');
    });
    if (suspendedBackgroundViews.some(({ element }) => element.id === 'mapTableOverlay')) {
      window.vpPauseMapProfile?.('homebase-designer');
    }
  }
  function restoreHomebaseBackground() {
    const previous = suspendedBackgroundViews || [];
    suspendedBackgroundViews = null;
    previous.forEach(({ element, inert }) => {
      element.inert = inert;
      element.classList.remove('homebase-background-suspended');
    });
    if (previous.some(({ element }) => element.id === 'mapTableOverlay' && element.classList.contains('active'))) {
      window.vpResumeMapProfile?.('homebase-designer-close');
      requestAnimationFrame(() => window.gaRequestLiveMapVisualRefresh?.('homebase-designer-close'));
    }
  }
  function showHomebaseEnvironment() {
    const element = overlay();
    if (!element) return;
    suspendHomebaseBackground();
    element.hidden = false;
    element.classList.add('active');
    document.body.classList.add('homebase-environment-open');
    blueprintButton()?.setAttribute('aria-expanded', 'true');
    setTimeout(() => {
      frame()?.focus();
      syncHomebaseTheme();
      postToWorkbench('environment-opened');
    }, 0);
  }
  function hideHomebaseEnvironment() {
    const element = overlay();
    if (!element) return;
    element.classList.remove('active');
    element.hidden = true;
    document.body.classList.remove('homebase-environment-open');
    restoreHomebaseBackground();
    blueprintButton()?.setAttribute('aria-expanded', 'false');
    flushHomebaseDraft('workbench-close');
  }
  async function openHomebaseEnvironment() {
    if (blueprintTransition.busy || overlay()?.classList.contains('active')) return;
    const sheet = blueprintSheet();
    const button = blueprintButton();
    if (!sheet || !button || blueprintReducedMotion()) {
      blueprintTransition.openedFromPocket = false;
      showHomebaseEnvironment();
      return;
    }
    const rect = button.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= window.innerHeight || !sheet.complete || !sheet.naturalWidth) {
      blueprintTransition.openedFromPocket = false;
      showHomebaseEnvironment();
      return;
    }
    blueprintTransition.busy = true;
    blueprintTransition.openedFromPocket = true;
    blueprintTransition.scrollX = window.scrollX;
    blueprintTransition.scrollY = window.scrollY;
    button.disabled = true;
    prepareHomebaseBlueprint();
    let portal;
    let pull;
    try {
      pull = await blueprintAnimate(sheet, [{ transform: 'translateY(0) rotate(-.7deg)' }, { transform: 'translateY(-32px) rotate(0)' }], BLUEPRINT_PULL_MS);
      portal = blueprintPortal(sheet.getBoundingClientRect());
      // One uninterrupted zoom; fading only changes opacity, never transform.
      const zoom = portal.paper.animate([{ transform: 'none', offset: 0 }, { transform: portal.coverZoom, offset: portal.coverProgress }, { transform: portal.zoom, offset: 1 }], { duration: BLUEPRINT_ZOOM_MS, easing: 'linear', fill: 'forwards' });
      portal.veil.style.opacity = '1';
      await new Promise(resolve => {
        const checkCoverage = () => {
          // Geometry is known from the portal keyframes. Use the animation
          // clock, avoiding delayed compositor bounds updates in Safari.
          if (Number(zoom.currentTime) >= BLUEPRINT_ZOOM_MS * portal.coverProgress || zoom.playState === 'finished') resolve();
          else requestAnimationFrame(checkCoverage);
        };
        requestAnimationFrame(checkCoverage);
      });
      showHomebaseEnvironment();
      await Promise.all([
        zoom.finished,
        // Fade the entire composited layer, including its opaque backing.
        blueprintAnimate(portal.root, [{ opacity: 1 }, { opacity: 0 }], Math.max(1, BLUEPRINT_ZOOM_MS - Number(zoom.currentTime)), 'linear')
      ]);
    } finally {
      if (!overlay()?.classList.contains('active')) showHomebaseEnvironment();
      portal?.root.remove();
      pull?.cancel();
      button.disabled = false;
      blueprintTransition.busy = false;
    }
  }
  async function closeHomebaseEnvironment() {
    if (blueprintTransition.busy || !overlay()?.classList.contains('active')) return;
    const sheet = blueprintSheet();
    const button = blueprintButton();
    if (!blueprintTransition.openedFromPocket || !sheet || !button || blueprintReducedMotion()) {
      hideHomebaseEnvironment();
      button?.focus({ preventScroll: true });
      return;
    }
    blueprintTransition.busy = true;
    button.disabled = true;
    let portal;
    let pull;
    try {
      // The main page remains at its saved position behind the workbench.
      pull = await blueprintAnimate(sheet, [{ transform: 'translateY(-32px) rotate(0)' }, { transform: 'translateY(-32px) rotate(0)' }], 0);
      portal = blueprintPortal(sheet.getBoundingClientRect());
      // Reverse the same continuous zoom while the paper fades in. Switch
      // underneath it once it is opaque, then keep shrinking into the pocket.
      const zoom = portal.paper.animate([{ transform: portal.zoom, offset: 0 }, { transform: portal.coverZoom, offset: 1 - portal.coverProgress }, { transform: 'none', offset: 1 }], { duration: BLUEPRINT_ZOOM_MS, easing: 'linear', fill: 'forwards' });
      portal.veil.style.opacity = '1';
      await blueprintAnimate(portal.root, [{ opacity: 0 }, { opacity: 1 }], BLUEPRINT_ZOOM_MS * (1 - portal.coverProgress), 'linear');
      hideHomebaseEnvironment();
      window.scrollTo(blueprintTransition.scrollX, blueprintTransition.scrollY);
      await Promise.all([
        zoom.finished,
        blueprintAnimate(portal.veil, [{ opacity: 1 }, { opacity: 0 }], Math.max(0, BLUEPRINT_ZOOM_MS - Number(zoom.currentTime)), 'linear')
      ]);
      portal.root.remove();
      await blueprintAnimate(sheet, [{ transform: 'translateY(-32px) rotate(0)' }, { transform: 'translateY(0) rotate(-.7deg)' }], BLUEPRINT_PULL_MS);
    } finally {
      portal?.root.remove();
      pull?.cancel();
      sheet.getAnimations().forEach(animation => animation.cancel());
      button.disabled = false;
      blueprintTransition.busy = false;
      blueprintTransition.openedFromPocket = false;
      button.focus({ preventScroll: true });
    }
  }

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.source !== frame()?.contentWindow) return;
    const message = event.data;
    if (!message || message.channel !== CHANNEL) return;
    if (message.kind === 'relay-command') translateWorkbenchRelay(message.payload || {});
    if (message.kind === 'rpc') handleRpc(message);
    if (message.kind === 'sync-draft') {
      const previousRuntimeSignature = JSON.stringify(currentOwnRuntimeConfig());
      latestHomebaseDraft = {
        plan: message.plan,
        runtimeConfig: message.runtimeConfig || null,
        dirty: message.dirty === true,
        baseRevision: String(message.baseRevision || ''),
        localUpdatedAt: Number(message.localUpdatedAt || Date.now()),
        deviceId: String(message.deviceId || ''),
        crewShareEnabled: message.crewShareEnabled === true
      };
      if (message.suppressAutoSave !== true) scheduleHomebaseSave();
      scheduleOwnFallbackCache('draft-change');
      const nextRuntimeSignature = JSON.stringify(currentOwnRuntimeConfig());
      if (previousRuntimeSignature !== nextRuntimeSignature) {
        ownLastAppliedSignature = '';
        ownAutoPlanSettlesAt = Date.now() + 1200;
        clearTimeout(ownAutoPlanApplyTimer);
        ownAutoPlanApplyTimer = setTimeout(() => applyOwnHomebaseScene(ownLastTelemetry, 'draft-change'), 1200);
      }
    }
    if (message.kind === 'owner-auto-refresh') {
      ownAutoSuppressedUntilExit = false;
      ownTrackerSuppressRequested = false;
      ownTrackerSceneStatusKey = '';
      if (ownTrackerCloudCapable() && !ownDraftDirty()) {
        requestTrackerCloudRefresh('workbench-refresh', { clearSuppression: true });
      }
      ownLastAppliedSignature = '';
      ownLastAppliedObjectsSignature = '';
      ownLastAppliedAt = 0;
      applyOwnHomebaseScene(ownLastTelemetry, 'workbench-refresh');
    }
    if (message.kind === 'owner-auto-clear') {
      ownAutoSuppressedUntilExit = true;
      ownLastAppliedSignature = '';
      ownLastAppliedObjectsSignature = '';
      ownLastAppliedAt = 0;
      applyOwnHomebaseScene(ownLastTelemetry, 'workbench-clear');
    }
    if (message.kind === 'sync-save-now') flushHomebaseDraft(message.reason || 'workbench');
    if (message.kind === 'sync-load') loadHomebaseFromCloud('workbench');
    if (message.kind === 'workbench-ready') {
      homebaseWorkbenchReady = true;
      syncHomebaseTheme();
      if (ownPackageStatus) updateOwnPackageStatus(ownPackageStatus);
      else requestOwnPackageStatus();
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
  window.addEventListener('gatrackercapabilitieschange', handleTrackerCapabilitiesChange);

  window.prepareHomebaseBlueprint = prepareHomebaseBlueprint;
  window.openHomebaseEnvironment = openHomebaseEnvironment;
  window.closeHomebaseEnvironment = closeHomebaseEnvironment;
  window.homebaseUpdateAssetStatus = updateAssetStatus;
  window.homebaseCloudPush = (reason = 'app-push') => flushHomebaseDraft(reason);
  window.homebaseCloudPull = (reason = 'app-pull') => loadHomebaseFromCloud(reason);
  window.homebaseGroupRefresh = (reason = 'external') => {
    requestTrackerCrewRefresh(reason);
    return refreshCrewHomebases(reason);
  };
  window.homebaseApplyTheme = syncHomebaseTheme;
  window.homebaseGroupClear = () => {
    requestTrackerCrewRefresh('group-cleared');
    crewHomebases = [];
    crewHomebaseDirectory = [];
    publishCrewHomebaseDirectory();
    crewLastSceneSignature = '';
    return applyCrewScene(window.lastLiveGpsPos, 'group-cleared');
  };
  scheduleCrewRefresh(1500);
})();
