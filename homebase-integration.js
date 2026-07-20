(() => {
  'use strict';

  const CHANNEL = 'vfr-homebase';
  const HOMEBASE_SYNC_URL = 'https://ga-proxy.einherjer.workers.dev/api/homebase/';
  const HOMEBASE_CREW_URL = 'https://ga-proxy.einherjer.workers.dev/api/homebase-group/';
  const HOMEBASE_SYNC_DELAY_MS = 30000;
  const HOMEBASE_CREW_POLL_MS = 45000;
  const HOMEBASE_CREW_RADIUS_NM = 10;
  const HOMEBASE_CREW_MAX_OBJECTS = 100;
  const HOMEBASE_OWN_ENTER_RADIUS_NM = 20;
  const HOMEBASE_OWN_EXIT_RADIUS_NM = 22;
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
  let crewTrackerSupported = false;
  let crewCapabilityRequestedAt = 0;
  let ownCloudPlan = null;
  let ownCloudLoadStarted = false;
  let ownCloudLoadComplete = false;
  let ownPackageStatus = null;
  let ownPackageStatusRequestedAt = 0;
  let ownAutoInside = false;
  let ownAutoSuppressedUntilExit = false;
  let ownAutoInFlight = false;
  let ownAutoQueued = false;
  let ownLastAppliedSignature = '';
  let ownLastTelemetry = null;
  let ownAutoPlanSettlesAt = 0;
  let ownAutoPlanApplyTimer = null;

  const overlay = () => document.getElementById('homebaseOverlay');
  const frame = () => document.getElementById('homebaseFrame');

  function normalizeHomebaseTheme(value) {
    const theme = String(value || '').trim().toLowerCase();
    if (theme === 'win31') return 'win95';
    return ['classic', 'retro', 'navcom', 'ops1940', 'win95'].includes(theme) ? theme : 'classic';
  }

  function currentHomebaseTheme() {
    const body = document.body;
    if (body?.classList.contains('theme-win95')) return 'win95';
    if (body?.classList.contains('theme-ops1940')) return 'ops1940';
    if (body?.classList.contains('theme-navcom')) return 'navcom';
    if (body?.classList.contains('theme-retro')) return 'retro';
    return normalizeHomebaseTheme(localStorage.getItem('ga_theme'));
  }

  function postToWorkbench(kind, payload = {}) {
    const target = frame()?.contentWindow;
    if (!target) return false;
    target.postMessage({ channel: CHANNEL, kind, ...payload }, window.location.origin);
    return true;
  }

  function syncHomebaseTheme() {
    return postToWorkbench('theme-change', { theme: currentHomebaseTheme() });
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
        const delivered = deliverHomebaseLoadResult({ ok: true, record: null, pilotId: context.pilotId, reason });
        applyOwnHomebaseScene(ownLastTelemetry, `${reason}-empty`);
        return { ok: true, record: null, deferred: !delivered };
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Cloud-Antwort ${response.status}`);
      const record = data.record || null;
      ownCloudPlan = record?.plan || null;
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

  function readJsonStorage(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; }
  }

  function currentOwnHomebasePlan() {
    if (latestHomebaseDraft?.plan) return latestHomebaseDraft.plan;
    const localPlan = readJsonStorage(HOMEBASE_LOCAL_STORAGE_KEY);
    const localMeta = readJsonStorage(HOMEBASE_SYNC_META_KEY);
    if (localMeta?.dirty === true && localPlan) return localPlan;
    return ownCloudPlan || localPlan;
  }

  function homebaseCatalogDefinition(title) {
    const source = globalThis.HOMEBASE_ASSET_CATALOG;
    return [...(source?.assets || []), ...(source?.stockObjects || [])].find((entry) => entry.title === title) || null;
  }

  function homebaseHeadingCorrection(title) {
    return finite(homebaseCatalogDefinition(title)?.headingCorrectionDeg, 0);
  }

  function isPersistentOnlyHomebaseObject(title) {
    return homebaseCatalogDefinition(title)?.persistentOnly === true;
  }

  function ownRuntimeConfigFromPlan(plan) {
    if (!plan?.spawn || !plan?.hangar) return null;
    const spawn = plan.spawn;
    const hangar = plan.hangar;
    const spawnLat = finite(spawn.lat, NaN);
    const spawnLon = finite(spawn.lon, NaN);
    if (!Number.isFinite(spawnLat) || !Number.isFinite(spawnLon)) return null;
    const hangarPosition = offsetLatLon(spawnLat, spawnLon, finite(hangar.northM), finite(hangar.eastM));
    return {
      protocol: 2,
      name: 'VFR Multitool Homebase',
      doorAutomationEnabled: plan.doorAutomationEnabled !== false,
      spawn: {
        lat: spawnLat,
        lon: spawnLon,
        altFt: finite(spawn.altFt),
        heading: heading(spawn.heading),
        mode: 'airport_parking'
      },
      hangar: {
        lat: hangarPosition.lat,
        lon: hangarPosition.lon,
        altFt: finite(spawn.altFt) + finite(hangar.heightFt),
        heightOffsetFt: finite(hangar.heightFt),
        heading: heading(finite(hangar.heading) + homebaseHeadingCorrection(hangar.objectTitle)),
        widthM: finite(hangar.widthM, 18),
        depthM: finite(hangar.depthM, 22),
        objectTitle: String(hangar.objectTitle || '')
      },
      objects: (Array.isArray(plan.objects) ? plan.objects : []).slice(0, 100).map((item, index) => {
        const position = offsetLatLon(spawnLat, spawnLon, finite(item?.northM), finite(item?.eastM));
        return {
          id: String(item?.id || `object-${index + 1}`),
          title: String(item?.title || ''),
          label: String(item?.label || item?.title || `Objekt ${index + 1}`),
          lat: position.lat,
          lon: position.lon,
          altFt: finite(spawn.altFt) + finite(item?.heightFt),
          heightOffsetFt: finite(item?.heightFt),
          heading: heading(finite(item?.heading) + homebaseHeadingCorrection(item?.title)),
          scale: Math.max(.1, Math.min(10, finite(item?.scale, 1)))
        };
      }).filter((item) => item.title)
    };
  }

  function currentOwnRuntimeConfig() {
    return latestHomebaseDraft?.runtimeConfig || ownRuntimeConfigFromPlan(currentOwnHomebasePlan());
  }

  function runtimeObjectsFromConfig(config) {
    if (!config?.hangar) return [];
    const hangar = {
      id: 'hangar',
      title: String(config.hangar.objectTitle || config.hangar.title || ''),
      label: String(config.hangar.objectTitle || config.hangar.title || '') === 'VFR Multitool Homebase Open Parking' ? 'Offener Parkbereich' : 'Homebase-Hangar',
      ...config.hangar,
      scale: 1
    };
    return [hangar, ...(Array.isArray(config.objects) ? config.objects : [])]
      .filter((item) => item?.title && !isPersistentOnlyHomebaseObject(item.title));
  }

  function angularDifference(left, right) {
    const difference = Math.abs(heading(left) - heading(right));
    return Math.min(difference, 360 - difference);
  }

  function sameCompiledPlacement(current, compiled) {
    return !!compiled
      && String(current?.title || '') === String(compiled?.title || compiled?.objectTitle || '')
      && Math.abs(finite(current?.lat) - finite(compiled?.lat)) <= 0.0000001
      && Math.abs(finite(current?.lon) - finite(compiled?.lon)) <= 0.0000001
      && Math.abs(finite(current?.altFt) - finite(compiled?.altFt)) <= 0.1
      && Math.abs(finite(current?.heightOffsetFt) - finite(compiled?.heightOffsetFt)) <= 0.02
      && angularDifference(current?.heading, compiled?.heading) <= 0.1
      && Math.abs(finite(current?.scale, 1) - finite(compiled?.scale, 1)) <= 0.005;
  }

  function ownHomebaseDelta() {
    const config = currentOwnRuntimeConfig();
    if (!config) return { ready: false, reason: 'no-plan', objects: [], stats: {} };
    const currentObjects = runtimeObjectsFromConfig(config);
    if (!ownPackageStatus?.sceneInstalled) {
      return {
        ready: true,
        objects: currentObjects,
        stats: { compiled: 0, dynamic: currentObjects.length, newObjects: currentObjects.length, changedCompiled: 0, staleCompiled: 0 }
      };
    }
    const installedConfig = ownPackageStatus.snapshotTrusted ? ownPackageStatus.installedSnapshot?.config : null;
    if (!installedConfig) return { ready: false, reason: 'snapshot-missing', objects: [], stats: {} };
    const compiledObjects = runtimeObjectsFromConfig(installedConfig);
    const compiledById = new Map(compiledObjects.map((item) => [String(item.id || ''), item]));
    const currentIds = new Set(currentObjects.map((item) => String(item.id || '')));
    const dynamicObjects = [];
    let changedCompiled = 0;
    let newObjects = 0;
    for (const item of currentObjects) {
      const compiled = compiledById.get(String(item.id || ''));
      if (sameCompiledPlacement(item, compiled)) continue;
      dynamicObjects.push(item);
      if (compiled) changedCompiled += 1;
      else newObjects += 1;
    }
    const staleCompiled = compiledObjects.filter((item) => !currentIds.has(String(item.id || ''))).length;
    return {
      ready: true,
      objects: dynamicObjects,
      stats: { compiled: compiledObjects.length, dynamic: dynamicObjects.length, newObjects, changedCompiled, staleCompiled }
    };
  }

  function publishOwnAutoStatus(payload = {}) {
    postToWorkbench('owner-auto-status', payload);
  }

  function updateOwnPackageStatus(status = null) {
    ownPackageStatus = status;
    ownPackageStatusRequestedAt = 0;
    ownLastAppliedSignature = '';
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
    const signature = JSON.stringify(objects);
    const activePreviewIds = new Set((Array.isArray(position?.homebase?.objects) ? position.homebase.objects : [])
      .filter((item) => item?.collection === 'preview').map((item) => String(item.id || '')));
    const expectedIds = objects.map((item) => String(item.id || ''));
    const trackerSceneMatches = expectedIds.length === activePreviewIds.size && expectedIds.every((id) => activePreviewIds.has(id));
    if (signature === ownLastAppliedSignature && trackerSceneMatches) return false;
    if (ownAutoInFlight) {
      ownAutoQueued = true;
      return false;
    }
    const commandId = sendTracker({ type: 'homebase_v1.preview.set', objects }, {
      kind: 'owner-auto-set',
      reason,
      signature,
      stats: delta.stats,
      distanceNm: distance,
      active: objects.length > 0 || (inside && !ownAutoSuppressedUntilExit)
    });
    if (!commandId) return false;
    ownAutoInFlight = true;
    publishOwnAutoStatus({
      status: 'warn',
      distanceNm: distance,
      stats: delta.stats,
      message: objects.length ? `Automatische Homebase-Ergänzung wird mit ${objects.length} Objekt(en) aufgebaut …` : (inside ? 'Der installierte Homebase-Mod ist bereits vollständig aktuell.' : 'Live-Ergänzungen werden außerhalb des Homebase-Radius entfernt …')
    });
    return true;
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
    if (meta.kind === 'owner-auto-set') {
      ownAutoInFlight = false;
      const ok = ack.status === 'ok';
      if (ok) ownLastAppliedSignature = String(meta.signature || '');
      else ownLastAppliedSignature = '';
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
    if (meta.kind === 'door-automation') {
      relayMessage({ stabilizerAck: { ...ack, type: 'homebase_v1.door_automation.set_ack' } });
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
    applyOwnHomebaseScene(data, 'telemetry');
  }

  function openHomebaseEnvironment() {
    const element = overlay();
    if (!element) return;
    element.hidden = false;
    element.classList.add('active');
    document.body.classList.add('homebase-environment-open');
    setTimeout(() => {
      frame()?.focus();
      syncHomebaseTheme();
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
        runtimeConfig: message.runtimeConfig || null,
        dirty: message.dirty === true,
        baseRevision: String(message.baseRevision || ''),
        localUpdatedAt: Number(message.localUpdatedAt || Date.now()),
        deviceId: String(message.deviceId || ''),
        crewShareEnabled: message.crewShareEnabled === true
      };
      scheduleHomebaseSave();
      ownLastAppliedSignature = '';
      ownAutoPlanSettlesAt = Date.now() + 500;
      clearTimeout(ownAutoPlanApplyTimer);
      ownAutoPlanApplyTimer = setTimeout(() => applyOwnHomebaseScene(ownLastTelemetry, 'draft-change'), 500);
    }
    if (message.kind === 'owner-auto-refresh') {
      ownAutoSuppressedUntilExit = false;
      ownLastAppliedSignature = '';
      applyOwnHomebaseScene(ownLastTelemetry, 'workbench-refresh');
    }
    if (message.kind === 'owner-auto-clear') {
      ownAutoSuppressedUntilExit = true;
      ownLastAppliedSignature = '';
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

  if (document.body && typeof MutationObserver === 'function') {
    let lastTheme = currentHomebaseTheme();
    new MutationObserver(() => {
      const nextTheme = currentHomebaseTheme();
      if (nextTheme === lastTheme) return;
      lastTheme = nextTheme;
      syncHomebaseTheme();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  window.openHomebaseEnvironment = openHomebaseEnvironment;
  window.closeHomebaseEnvironment = closeHomebaseEnvironment;
  window.homebaseUpdateAssetStatus = updateAssetStatus;
  window.homebaseCloudPush = (reason = 'app-push') => flushHomebaseDraft(reason);
  window.homebaseCloudPull = (reason = 'app-pull') => loadHomebaseFromCloud(reason);
  window.homebaseGroupRefresh = (reason = 'external') => refreshCrewHomebases(reason);
  window.homebaseApplyTheme = syncHomebaseTheme;
  window.homebaseGroupClear = () => {
    crewHomebases = [];
    crewHomebaseDirectory = [];
    publishCrewHomebaseDirectory();
    crewLastSceneSignature = '';
    return applyCrewScene(window.lastLiveGpsPos, 'group-cleared');
  };
  scheduleCrewRefresh(1500);
})();
